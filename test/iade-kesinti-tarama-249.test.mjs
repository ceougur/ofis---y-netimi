// 2.4.9 R2 (ders 47; docs/2.4.9-tasarim/B2-elle-toplu-alici.md §11 R2, docs/2.4.9-IS-LISTESI.md "B2 KODLANDI"): taksit kartının iade kesintisi (routes/plans.mjs
// returnCuts — iade belgesindeki payment_json.coverCuts) her forAccount çağrısında BÜTÜN satıştan iade faturalarını tarayıp ayrıştırıyordu. forAccount'u cari kartı
// (accounts.detail) ve kartın WhatsApp çekirdeği (accounts.waFacts) çağırır; elle alıcı listesi ve otomatik önizleme cari başına bir kez → 1.001 iadeli şirkette 2.000 kişi
// 10,9 sn, olay döngüsü ~10 sn. Düzeltme: tarama sonucu veri tabanına bir yazma olana kadar saklanır (total_changes() + data_version damgası; işlem içinde eski yol). KURAL AYNEN.
// Bu dosya: (1) YAPI — toplu yollarda iade taraması istek başına en çok bir kez (eski kodda e6ee52a8 cari sayısı kadar → beklenen nedenle KIRMIZI, ders 38);
// (2) EŞDEĞERLİK — her kartın kesintisi ESKİ KODUN kuralıyla (e6ee52a8 returnCuts gövdesi aşağıda AYNEN; fark testi, ders 5) ve elle yazılmış kâhin değerleriyle
// (iade-224'ün kart kuralından; sınıf sınıf), forAccount ↔ mizan (ledgerPlansByAccount) ↔ işlem içi yol; (3) BAYATLIK — iade iptali / düzenlemesi / silinmesi, aynı
// bağlantıdan doğrudan yazım, BAŞKA bağlantının yazması ve GERİ ALINAN işlem sonrası kesinti hemen güncel (saklanan değer bayatlamaz). Gerçek program + yerel sahte Meta
// (ders 30), sahte saat (ders 13).
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { roundMoney } from "../server/lib/money.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

// ESKİ KOD (e6ee52a8 routes/plans.mjs returnCuts) — AYNEN; kâhin olarak yalnız bu dosyada (programın yeni kodundan türetilmedi).
function eskiKesinti(store) {
  const out = new Map();
  for (const row of store.all("SELECT payment_json AS j FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'")) {
    let cuts = {};
    try {
      cuts = JSON.parse(row.j || "{}").coverCuts || {};
    } catch {
      cuts = {};
    }
    for (const [planId, cut] of Object.entries(cuts)) out.set(planId, roundMoney((out.get(planId) || 0) + (Number(cut) || 0)));
  }
  return out;
}

let ctx;
let user;
let plans;
let service;
const c = {};
const k = {};
const r = {};

const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};
let gun = 0;
// Belge tarihleri yazım sırasıyla artar (seri kronolojisi); hepsi bugünden (03.11.2026) önce.
const d = () => new Date(Date.UTC(2026, 8, 1 + gun++)).toISOString().slice(0, 10);
let tel = 0;
const cari = async (anahtar, ad, ek = {}) => {
  tel += 1;
  c[anahtar] = await must(`cari ${anahtar}`, ctx.api.post("/api/workspace/accounts", { name: ad, type: "customer", registeredOn: "2026-01-01", phone: `0532 249 ${String(tel).padStart(2, "0")} 00`, ...ek }));
  return c[anahtar];
};
let item;
const satis = async (acc, qty) => {
  const doc = await must("satış", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: d(), lines: [{ itemId: item.id, qty, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }));
  return must("satış oku", ctx.api.get(`/api/workspace/invoices/${doc.id}`));
};
const kapsayan = async (acc, total) => must(`kart ${acc.name}`, ctx.api.post("/api/workspace/plans", { accountId: acc.id, name: `${acc.name} ${total}`, registeredOn: d(), total: String(total), mode: "auto", count: "2", firstDue: "2026-12-01", coversBalance: true }));
const iade = async (inv, qty, ek = {}) => must("iade", ctx.api.post("/api/workspace/invoices", { kind: "sale_return", originalId: inv.id, issueDate: d(), lines: [{ originLineId: inv.lines[0].id, qty }], payment: {}, ...ek }));
const kartKesintisi = (accountId, planId) => {
  const kart = plans.forAccount(accountId, user).find(plan => plan.id === planId);
  assert.ok(kart, `kart carisinde yok: ${planId}`);
  return kart.returnCuts;
};
// İade satırının payment_json'u AYNI bağlantıdan, store'un yazım yolu dışından (store.db; kapı yok) — eski / bozuk biçimli veri ve "store dışı yazım".
const hamYaz = (id, json) => ctx.store.db.prepare("UPDATE invoices SET payment_json = ? WHERE id = ?").run(json, id);
const hamOku = id => ctx.store.get("SELECT payment_json AS j FROM invoices WHERE id = ?", id).j;
// Toplu yolda iade taraması (coverCuts sorgusu) sayımı.
async function taramaSay(fn) {
  const asil = ctx.store.all;
  let n = 0;
  ctx.store.all = (sql, ...args) => {
    if (/sale_return/.test(sql) && /coverCuts/.test(sql)) n += 1;
    return asil.call(ctx.store, sql, ...args);
  };
  try {
    await fn();
  } finally {
    ctx.store.all = asil;
  }
  return n;
}

describe("2.4.9 R2 — taksit kartının iade kesintisi toplu yolda cari başına yeniden taranmaz (kural aynen)", () => {
  before(async () => {
    // Saat AKAR (üretimdeki gibi; 03.11.2026 09:00'dan): Mevcut Borç kartının kapsamı kartın açıldığı ANA göre kurulur — duran saatte bütün kayıtlar aynı
    // damgayı taşır ve "iki kart" sınıfı iade-224'ün kuralından ayrışır (not defterinde denendi: duran saatte 2.000 / 500, akan saatte 1.500 / 1.000).
    ctx = await startWa({ now: "2026-11-03T09:00:00+03:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    plans = ctx.server.app.context.plans;
    service = ctx.server.app.context.accounts;
    user = ctx.store.get("SELECT id, username, display_name, role FROM users WHERE username = 'admin'");
    item = await must("hizmet", ctx.api.post("/api/workspace/stock", { kind: "service", code: "R2-HZM", name: "R2 Hizmet", unit: "Adet", salePrice: "1000" }));
    // Kartsız cariler (çoğunluk): açılış borcu, hareketsiz, satışlı.
    await cari("kartsiz1", "Kartsız Bir", { openingBalance: "500" });
    await cari("kartsiz2", "Kartsız İki");
    await satis(await cari("kartsiz3", "Kartsız Üç"), 1);
    // TAM İADE: 2.000 borç, kart 1.000'i taksitlendirir, satış tümden iade → kartın payı düşer (kesinti 1.000).
    const tamSatis = await satis(await cari("tam", "Tam İade"), 2);
    k.tam = await kapsayan(c.tam, 1000);
    r.tam = await iade(tamSatis, 2);
    // KISMİ İADE: 2.000 borç, kart 2.000; 1 adet iade → kesinti 1.000 (iade-224 "Mevcut Borç kartında iade iptali": kalan 1.000).
    const kismiSatis = await satis(await cari("kismi", "Kısmi İade"), 2);
    k.kismi = await kapsayan(c.kismi, 2000);
    r.kismi = await iade(kismiSatis, 1);
    // AYNI CARİ İKİ KART: iade faturayı kapsayan kartı küçültür, öbürünü değil (iade-224 "iki Mevcut Borç kartı": 1.500 / 1.000 → kesinti 500 / 0).
    const ikiA = await satis(await cari("ikiKart", "İki Kartlı"), 2);
    k.ikiKart1 = await kapsayan(c.ikiKart, 2000);
    await satis(c.ikiKart, 1);
    k.ikiKart2 = await kapsayan(c.ikiKart, 1000);
    r.ikiKart = await iade(ikiA, 0.5);
    // BİR İADE İKİ KART: fatura iki kartla kapsanır (1.000 + 1.000), tümden iade → iki kart da 1.000 küçülür (tek belgede iki kesinti).
    const tekIadeSatis = await satis(await cari("tekIadeIkiKart", "Tek İade İki Kart"), 2);
    k.tekIade1 = await kapsayan(c.tekIadeIkiKart, 1000);
    k.tekIade2 = await kapsayan(c.tekIadeIkiKart, 1000);
    r.tekIade = await iade(tekIadeSatis, 2);
    // İPTAL EDİLEN İADE: kesinti sayılmaz (kart geri büyür).
    const iptalSatis = await satis(await cari("iptal", "İptal Edilen İade"), 2);
    k.iptal = await kapsayan(c.iptal, 2000);
    r.iptal = await iade(iptalSatis, 1);
    await must("iade iptali", ctx.api.post(`/api/workspace/invoices/${r.iptal.id}/cancel`, {}));
    // TASLAK İADE: etkisi yok; satırına coverCuts yazılsa da sayılmaz (yalnız kesinleşmiş iade).
    const taslakSatis = await satis(await cari("taslak", "Taslak İade"), 2);
    k.taslak = await kapsayan(c.taslak, 2000);
    r.taslak = await iade(taslakSatis, 1, { status: "draft" });
    hamYaz(r.taslak.id, JSON.stringify({ coverCuts: { [k.taslak.id]: 700 } }));
    // SATIŞ faturasına (iade değil) yazılmış coverCuts da sayılmaz.
    hamYaz(taslakSatis.id, JSON.stringify({ ...JSON.parse(hamOku(taslakSatis.id) || "{}"), coverCuts: { [k.taslak.id]: 300 } }));
    // AYNI ADLI İKİ CARİ: her biri yalnız kendi kartının kesintisini taşır.
    const ayniA = await satis(await cari("ayniA", "Aynı Ad"), 2);
    k.ayniA = await kapsayan(c.ayniA, 2000);
    const ayniB = await satis(await cari("ayniB", "Aynı Ad"), 2);
    k.ayniB = await kapsayan(c.ayniB, 2000);
    r.ayniA = await iade(ayniA, 1);
    r.ayniB = await iade(ayniB, 0.5);
    // KARTI BAŞKA CARİYE TAŞINAN: kesinti eski carinin iadesinde, kart yeni caride → yeni carinin kartında görünür (kesinti kart kimliğine bağlı, cariye değil).
    const tasSatis = await satis(await cari("tasKaynak", "Taşıma Kaynak"), 2);
    k.tasinan = await kapsayan(c.tasKaynak, 2000);
    r.tasinan = await iade(tasSatis, 1);
    await cari("tasHedef", "Taşıma Hedef", { openingBalance: "3000" });
    await must("kartı taşı", ctx.api.put(`/api/workspace/plans/${k.tasinan.id}`, { accountId: c.tasHedef.id }));
    // ESKİ / BOZUK BİÇİM denemeleri için: gerçek iade (kesinti 1.000), sonra satırı BAYATLIK hücresinde değiştirilir.
    const bozukSatis = await satis(await cari("bozuk", "Bozuk Biçim"), 2);
    k.bozuk = await kapsayan(c.bozuk, 2000);
    r.bozuk = await iade(bozukSatis, 1);
    // API ile değişecek (BAYATLIK — API): düzenlenecek, silinecek iadeler.
    const duzSatis = await satis(await cari("duzenle", "Düzenlenen İade"), 2);
    k.duzenle = await kapsayan(c.duzenle, 2000);
    r.duzenle = await iade(duzSatis, 1);
    r.duzenleSatis = duzSatis;
    const silSatis = await satis(await cari("sil", "Silinen İade"), 2);
    k.sil = await kapsayan(c.sil, 2000);
    r.sil = await iade(silSatis, 1);
  });
  after(async () => ctx?.close());

  const tumCariler = () => ctx.store.all("SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY rowid").map(row => row.id);

  it("YAPI: elle alıcı listesi, otomatik önizleme ve cari kartı döngüsü iade faturalarını cari başına yeniden taramaz (istek başına en çok 1)", async t => {
    const ids = tumCariler();
    assert.ok(ids.length >= 15, `cari kurulmadı: ${ids.length}`);
    const sayim = {};
    sayim.elleTumune = await taramaSay(async () => {
      const res = await ctx.api.post("/api/workspace/whatsapp/targets", { kind: "statement", all: true, status: "all", preset: "all" });
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      assert.equal(res.data.data.recipients.length, ids.length);
    });
    sayim.elleSecili = await taramaSay(async () => assert.equal((await ctx.api.post("/api/workspace/whatsapp/targets", { kind: "message", ids })).status, 200));
    sayim.onizleme = await taramaSay(async () => {
      const res = await ctx.api.post(URLS.preview, { kind: "statement", ids, preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
    });
    sayim.kartDongusu = await taramaSay(async () => {
      for (const id of ids) {
        service.waFacts(id, user);
        service.detail(id, user);
      }
    });
    t.diagnostic(`iade taraması: ${JSON.stringify(sayim)} (cari ${ids.length})`);
    const asim = Object.entries(sayim).filter(([, n]) => n > 1);
    assert.deepEqual(asim, [], `iade faturaları cari başına yeniden taranıyor: ${JSON.stringify(sayim)} (cari ${ids.length}; beklenen her istekte ≤ 1)`);
  });

  it("EŞDEĞERLİK: her kartın kesintisi eski kuralla ve kâhinle birebir — kısmi / tam iade, iki kart, tek iadede iki kart, iptal, taslak, satışa yazılmış, aynı ad, taşınan kart", () => {
    const eski = eskiKesinti(ctx.store);
    const ids = tumCariler();
    let kart = 0;
    let kesintili = 0;
    const mizan = plans.ledgerPlansByAccount();
    for (const id of ids) {
      const liste = plans.forAccount(id, user);
      // İşlem içi yol (saklanan değer okunmaz) aynı sonucu verir.
      let islemIci;
      ctx.store.tx(() => {
        islemIci = plans.forAccount(id, user);
      });
      assert.deepEqual(islemIci, liste, `işlem içi yol farklı: ${id}`);
      const mizanKartlari = new Map((mizan.get(id) || []).map(plan => [plan.id, plan.returnCuts]));
      for (const plan of liste) {
        kart += 1;
        if (plan.returnCuts) kesintili += 1;
        assert.equal(plan.returnCuts, eski.get(plan.id) || 0, `${plan.name}: kesinti eski kuraldan farklı`);
        assert.equal(mizanKartlari.get(plan.id), plan.returnCuts, `${plan.name}: mizan ↔ cari kartı farklı`);
      }
    }
    // Kâhin (iade-224'ün kart kuralından; programın çıktısından okunmadı).
    const beklenen = {
      tam: [c.tam, k.tam, 1000],
      kismi: [c.kismi, k.kismi, 1000],
      ikiKart1: [c.ikiKart, k.ikiKart1, 500],
      ikiKart2: [c.ikiKart, k.ikiKart2, 0],
      tekIade1: [c.tekIadeIkiKart, k.tekIade1, 1000],
      tekIade2: [c.tekIadeIkiKart, k.tekIade2, 1000],
      iptal: [c.iptal, k.iptal, 0],
      taslak: [c.taslak, k.taslak, 0],
      ayniA: [c.ayniA, k.ayniA, 1000],
      ayniB: [c.ayniB, k.ayniB, 500],
      tasinan: [c.tasHedef, k.tasinan, 1000],
      bozuk: [c.bozuk, k.bozuk, 1000],
    };
    for (const [ad, [acc, plan, tutar]] of Object.entries(beklenen)) assert.equal(kartKesintisi(acc.id, plan.id), tutar, `${ad} kesintisi`);
    assert.equal(plans.forAccount(c.tasKaynak.id, user).length, 0, "taşınan kart eski caride kaldı");
    for (const anahtar of ["kartsiz1", "kartsiz2", "kartsiz3"]) assert.deepEqual(plans.forAccount(c[anahtar].id, user), [], `${anahtar} kartı var`);
    assert.deepEqual(plans.forAccount("olmayan-cari", user), []);
    assert.deepEqual(plans.forAccount("", user), []);
    // Eşitlik boş geçmesin: kurulan 14 kartın 11'i kesintili (tam, kısmi, iki kartın biri, tek iadede iki kart, aynı ad ×2, taşınan, bozuk, düzenlenecek, silinecek);
    // kesintisiz 3: iki kartın öbürü, iptal edilen, taslak.
    assert.deepEqual({ kart, kesintili }, { kart: 14, kesintili: 11 });
  });

  it("BAYATLIK — API: iade düzenlenince, silinince, iptal edilince saklanan kesinti kullanılmaz (hemen güncel)", async () => {
    const isit = () => tumCariler().forEach(id => plans.forAccount(id, user));
    isit();
    assert.equal(kartKesintisi(c.duzenle.id, k.duzenle.id), 1000);
    const tarih = (await must("iade oku", ctx.api.get(`/api/workspace/invoices/${r.duzenle.id}`))).issueDate;
    await must("iade düzenle", ctx.api.post(`/api/workspace/invoices/${r.duzenle.id}/edit`, { originalId: r.duzenleSatis.id, issueDate: tarih, lines: [{ originLineId: r.duzenleSatis.lines[0].id, qty: 2 }], payment: {} }));
    assert.equal(kartKesintisi(c.duzenle.id, k.duzenle.id), 2000, "düzenleme sonrası (1 → 2 adet)");
    isit();
    assert.equal(kartKesintisi(c.sil.id, k.sil.id), 1000);
    await must("iade sil", ctx.api.del(`/api/workspace/invoices/${r.sil.id}`));
    assert.equal(kartKesintisi(c.sil.id, k.sil.id), 0, "silinen iade");
    isit();
    await must("iade iptali", ctx.api.post(`/api/workspace/invoices/${r.kismi.id}/cancel`, {}));
    assert.equal(kartKesintisi(c.kismi.id, k.kismi.id), 0, "iptal edilen iade");
    const eski = eskiKesinti(ctx.store);
    for (const id of tumCariler()) for (const plan of plans.forAccount(id, user)) assert.equal(plan.returnCuts, eski.get(plan.id) || 0, `${plan.name}: API sonrası eski kuraldan farklı`);
  });

  it("BAYATLIK — doğrudan yazım, eski / bozuk biçimli satır, başka bağlantının yazması, geri alınan işlem: kesinti eski kuralla birebir", () => {
    const kim = k.bozuk.id;
    const asil = hamOku(r.bozuk.id);
    assert.match(asil, new RegExp(`"coverCuts":\\{"${kim}":1000\\}`), `iade satırı beklenen biçimde değil: ${asil}`);
    const kacisli = `"\\u0070${kim.slice(1)}"`;
    // [ad, payment_json, beklenen kesinti (JSON.parse kuralıyla elle)]
    const durumlar = [
      ["özgün", asil, 1000],
      ["bozuk JSON", `{"coverCuts":{"${kim}":1000}`, 0],
      ["metin tutar", `{"coverCuts":{"${kim}":"750.5"}}`, 750.5],
      ["sayı olmayan tutar", `{"coverCuts":{"${kim}":"abc"}}`, 0],
      ["kaçışlı anahtar (\\u0070)", `{"coverCuts":{${kacisli}:400}}`, 400],
      ["coverCuts null", `{"coverCuts":null}`, 0],
      ["coverCuts metin", `{"coverCuts":"abc"}`, 0],
      ["coverCuts dizi", `{"coverCuts":[1000]}`, 0],
      ["kimlik başka alanda", `{"note":"${kim}","coverCuts":{"plan-baska":5}}`, 0],
      ["büyük harfli alan", `{"COVERCUTS":{"${kim}":1000}}`, 0],
      ["yinelenen anahtar (sonuncusu)", `{"coverCuts":{"${kim}":100,"${kim}":300}}`, 300],
      ["boş", "", 0],
    ];
    for (const [ad, json, tutar] of durumlar) {
      plans.forAccount(c.bozuk.id, user);
      hamYaz(r.bozuk.id, json);
      const yeni = kartKesintisi(c.bozuk.id, kim);
      assert.equal(yeni, tutar, `${ad}: kesinti`);
      assert.equal(yeni, eskiKesinti(ctx.store).get(kim) || 0, `${ad}: eski kuraldan farklı`);
    }
    hamYaz(r.bozuk.id, asil);
    assert.equal(kartKesintisi(c.bozuk.id, kim), 1000, "özgün satıra dönüş");
    // BAŞKA BAĞLANTI (aynı veri dosyası): kesinleşen yazım data_version ile görülür.
    const dosya = ctx.store.all("PRAGMA database_list").find(row => row.name === "main").file;
    assert.ok(dosya, "veri dosyası bulunamadı");
    const baska = new DatabaseSync(dosya);
    try {
      baska.exec("PRAGMA busy_timeout = 5000");
      plans.forAccount(c.bozuk.id, user);
      baska.prepare("UPDATE invoices SET payment_json = ? WHERE id = ?").run(`{"coverCuts":{"${kim}":250}}`, r.bozuk.id);
      assert.equal(kartKesintisi(c.bozuk.id, kim), 250, "başka bağlantının yazması görülmedi");
      baska.prepare("UPDATE invoices SET payment_json = ? WHERE id = ?").run(asil, r.bozuk.id);
      assert.equal(kartKesintisi(c.bozuk.id, kim), 1000, "başka bağlantının geri yazması görülmedi");
    } finally {
      baska.close();
    }
    // GERİ ALINAN İŞLEM: işlemin içinde okunan (geri alınacak) değer işlem bitince kullanılmaz (total_changes geri alınca azalmaz).
    plans.forAccount(c.bozuk.id, user);
    let icerde = null;
    assert.throws(() =>
      ctx.store.tx(() => {
        hamYaz(r.bozuk.id, `{"coverCuts":{"${kim}":10}}`);
        icerde = kartKesintisi(c.bozuk.id, kim);
        throw new Error("R2 geri al");
      }),
    /R2 geri al/);
    assert.equal(icerde, 10, "işlem içinde yazım görülmedi");
    assert.equal(hamOku(r.bozuk.id), asil, "işlem geri alınmadı");
    assert.equal(kartKesintisi(c.bozuk.id, kim), 1000, "geri alınan işlemin kesintisi kaldı");
    const eski = eskiKesinti(ctx.store);
    for (const id of tumCariler()) for (const plan of plans.forAccount(id, user)) assert.equal(plan.returnCuts, eski.get(plan.id) || 0, `${plan.name}: son durumda eski kuraldan farklı`);
  });
});
