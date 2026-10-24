// 2.4.4 (karar 22.10.2026, baş mimar; "en yaygın ve doğru uygulama"): verilmiş kâğıt / fiş numarası BİR DAHA KULLANILMAZ. Yaygın muhasebe programlarında belge
// numarası tekildir, seride boşluk kalabilir (VUK müteselsil sıra). "Müşteri Fişi / Kâğıt Makbuz Olarak Bırak" ile Müşteri Fişi (FIS) ya da kâğıt makbuz (SMM)
// serisinden numara almış belge sonra e-Belge olarak gönderilse de o numara seride "kullanılmış" sayılır; sıradaki numara serinin o güne dek verilmiş EN BÜYÜK
// numarasından (izdeki / Kâğıt Fatura No'ya taşınan dahil) sonra gelir. Bırakılmış belgenin yeniden gönderimi açık kalır (değişmez) — kâğıt makbuz HARİÇ:
// 2.4.4 MM4 alt kararıyla kâğıt makbuz olarak bırakılan makbuz e-SMM olarak gönderilmez, numarası seride kalır.
// Kök neden (7502485): numberForSend bırakılmış belgeyi e-Belge serisine taşır (numara Kâğıt Fatura No'ya — o alan boşsa); nextNumber yalnız seride DURAN
// belgelerin MAX(seq)'ini sayar → boşalan numara sıradaki belgeye yeniden verilir (SMM2026000000001 / FIS2026000000001 iki belgede).
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan):
//   T1  bırak → gönder → başka belge bırak: aynı FIS / SMM numarası ikinci belgeye verilir (kök hata)
//   T2  belgenin Kâğıt Fatura No'su önceden doluysa fiş numarası o alana taşınmaz (iz yalnız işlem geçmişinde) → numara yine tekrar verilir
//   T3  aynı seriden numara alan öbür yollar: kâğıt fatura kaydı (Kâğıt profil), toplu kayıt (Seçilenleri Kaydet) ayrılan numarayı alır
//   T4  numara–tarih sırası (BASKA-FIS-SIRA): ayrılan numaradan ESKİ tarihli yeni fiş / kâğıt fatura / bırakma kabul edilir; gönderilemeyen belgede
//       "Müşteri Fişi Olarak Bırak" yolu, seride artık belge kalmadığı için yanlışlıkla önerilir; Düzenle'de ayrılan numaranın komşusu tarihini aşar
//   T5  Fatura Ayarları → "Sıradaki No" geri alınınca ayrılan numara yeniden verilir; ekran sıradaki numarayı yanlış gösterir
//   T6  bırakılmış belgenin gönderimi EDM'ye ulaşmaz (e-Belge numarası belgede kalır, Gönderilmedi) → fiş numarası ayrılmış sayılmaz, başka belgeye verilir
//   T7  iki oturum aynı anda: biri bırakılmış belgeyi gönderirken öbürü başka belgeyi bırakır
//   T8  002 şirketi: 001'deki ayrılış 002'nin sayacını etkiler ya da tersi
//   T9  Şirket Verisini Sıfırla: faturalar silinince ayrılış kaydı kalır, boş seri ileriden başlar (MAX(seq) gibi o da silinmeli)
//   T10 eski sürüm verisi (v2.4.3'te tekrar verilmiş numara): yalnız ölçülür, göç yok (not defteri betiği; teslim notunda)
// Kâhin: karar metni (yukarıda) + veri tabanı sayımı (bir numara en çok bir belgede: number ∪ paper_no ∪ işlem geçmişi). Bu dosya programla aynı elden (ders 5);
// bağımsız kâhin test/bagimsiz/ebelge (kâhine dokunulmadı) ayrıca koşulur.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const TODAY = "2026-06-17";
const day = offset => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const fis = seq => `FIS2026${String(seq).padStart(9, "0")}`;
const smm = seq => `SMM2026${String(seq).padStart(9, "0")}`;
const fetchFailed = () => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });

async function boot() {
  resetEdmCaches();
  const edm = await startMockEdm();
  const faults = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    const at = faults.findIndex(op => String(init.body || "").includes(`${op}Request`));
    if (at >= 0) {
      faults.splice(at, 1);
      throw fetchFailed();
    }
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, esmmEnabled: true, fetchImpl, now: `${TODAY}T10:00:00`, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  const ctx = { edm, server, api, faults, store: server.app.store };
  ctx.setup = async (q = "", name = SELLER.name, extra = {}) => {
    const saved = await api.put(`/api/workspace/invoices/settings${q}`, { ...extra, seller: { ...SELLER, name }, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const ids = {};
    for (const [key, body] of [["client", CLIENT], ["person", PERSON]]) {
      const created = await api.post(`/api/workspace/accounts${q}`, body);
      assert.equal(created.status, 200, JSON.stringify(created.data));
      ids[key] = created.data.id || created.data.account?.id;
    }
    return ids;
  };
  ctx.ids = await ctx.setup();
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  ctx.must = must;
  // e-Arşiv satış (kişi alıcı) ve e-SMM makbuzu; "Kes, Sonra Gönder" → numarasız Gönderilecekler'de.
  ctx.sale = (extra = {}, q = "", accountId = ctx.ids.person) => api.post(`/api/workspace/invoices${q}`, { scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, issueDate: day(0), eSend: "later", ...extra });
  ctx.makbuz = (extra = {}) => api.post("/api/workspace/invoices", { scenario: "smm", accountId: ctx.ids.client, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, issueDate: day(0), eSend: "later", ...extra });
  ctx.withdraw = (id, q = "") => api.post(`/api/workspace/invoices/${id}/withdraw${q}`, {});
  ctx.send = (id, q = "") => api.post(`/api/workspace/invoices/${id}/send${q}`, {});
  // Bırak → gönder: belge e-Belge serisine geçer, kâğıt numarası seriden ayrılır.
  ctx.departed = async (create, label, q = "") => {
    const doc = await must(`${label} kayıt`, create());
    const left = await must(`${label} bırak`, ctx.withdraw(doc.id, q));
    const sent = await must(`${label} gönder`, ctx.send(doc.id, q));
    assert.notEqual(sent.number, left.number, "e-Belge numarası aldı");
    return { id: doc.id, paperNumber: left.number, sent };
  };
  // Kâhin sayımı: bir numara en çok bir belgede (belge numarası ya da Kâğıt Fatura No).
  ctx.holders = number => ctx.store.all("SELECT id, number, paper_no AS paperNo FROM invoices WHERE number = ? OR paper_no = ?", number, number);
  ctx.close = async () => {
    await server.close();
    await edm.close();
  };
  return ctx;
}

describe("Numara tekil: bırakılıp e-Belge olarak gönderilen belgenin kâğıt numarası bir daha verilmez (T1, T2, T5)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("T1 Müşteri Fişi (FIS): A bırakıldı FIS…001 → gönderildi; B bırakılınca FIS…002 alır (FIS…001 iki belgede değil)", async () => {
    const a = await ctx.departed(() => ctx.sale(), "A");
    assert.equal(a.paperNumber, fis(1));
    assert.equal(a.sent.paperNo, fis(1), "iz: Kâğıt Fatura No");
    const b = await ctx.must("B kayıt", ctx.sale());
    const left = await ctx.must("B bırak", ctx.withdraw(b.id));
    assert.equal(left.number, fis(2), `B'nin fiş numarası: ${left.number}`);
    assert.equal(ctx.holders(fis(1)).length, 1, JSON.stringify(ctx.holders(fis(1))));
  });

  test("T1 kâğıt makbuz (SMM): e-SMM makbuzu A bırakıldı SMM…001 → e-SMM gönderimi reddedilir (MM4 alt kararı; numara seride kalır); B bırakılınca SMM…002 alır", async () => {
    const a = await ctx.must("makbuz A kayıt", ctx.makbuz());
    const leftA = await ctx.must("makbuz A bırak", ctx.withdraw(a.id));
    assert.equal(leftA.number, smm(1));
    const sentA = await ctx.send(a.id);
    assert.equal(sentA.status, 409, JSON.stringify(sentA.data));
    assert.equal(sentA.data.code, "einvoice-paper-receipt");
    const b = await ctx.must("makbuz B kayıt", ctx.makbuz());
    const left = await ctx.must("makbuz B bırak", ctx.withdraw(b.id));
    assert.equal(left.number, smm(2), `B'nin kâğıt makbuz numarası: ${left.number}`);
    assert.equal(ctx.holders(smm(1)).length, 1, JSON.stringify(ctx.holders(smm(1))));
  });

  test("T2 Kâğıt Fatura No önceden doluysa fiş numarası o alana taşınmaz; iz işlem geçmişinde (paperNumber) ve numara yine tekrar verilmez", async () => {
    const doc = await ctx.must("C kayıt", ctx.sale({ paperNo: "EL-55" }));
    const left = await ctx.must("C bırak", ctx.withdraw(doc.id));
    assert.equal(left.number, fis(3));
    const sent = await ctx.must("C gönder", ctx.send(doc.id));
    assert.equal(sent.paperNo, "EL-55", "kullanıcının yazdığı Kâğıt Fatura No değişmez");
    const trail = ctx.store.all("SELECT payload_json AS p FROM audit_events WHERE type = 'invoice.numbered' AND entity_id = ?", doc.id).map(row => JSON.parse(row.p));
    assert.equal(trail.at(-1).paperNumber, fis(3), JSON.stringify(trail));
    const d = await ctx.must("D kayıt", ctx.sale());
    assert.equal((await ctx.must("D bırak", ctx.withdraw(d.id))).number, fis(4));
  });

  test("T5 Fatura Ayarları: \"Sıradaki No\" geri alınsa da ayrılan numara verilmez; ekran sıradaki numarayı doğru gösterir", async () => {
    // Seride kalan fişler B (FIS…002) ve D (FIS…004); ayrılan en büyük numara C'nin FIS…003'ü. İkisi de gönderilince FIS…004 de ayrılır, seride hiç belge kalmaz.
    for (const n of [2, 4]) await ctx.must(`${fis(n)} gönder`, ctx.send(ctx.store.get("SELECT id FROM invoices WHERE number = ?", fis(n)).id));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE series = 'FIS'").n, 0, "ön koşul: FIS serisinde belge kalmadı");
    const saved = await ctx.must("ayar", ctx.api.put("/api/workspace/invoices/settings", { start: { FIS2026: 1, SMM2026: 1 } }));
    assert.equal(saved.nextNumbers.paper.number, fis(5), JSON.stringify(saved.nextNumbers.paper));
    const shown = await ctx.must("ayar oku", ctx.api.get("/api/workspace/invoices/settings"));
    assert.equal(shown.nextNumbers.paper.number, fis(5));
    assert.equal(shown.nextNumbers.smm.number, smm(3), JSON.stringify(shown.nextNumbers.smm));
    const e = await ctx.must("E kayıt", ctx.sale());
    assert.equal((await ctx.must("E bırak", ctx.withdraw(e.id))).number, fis(5));
  });
});

describe("Numara tekil: aynı seriden numara alan öbür yollar ve numara–tarih sırası (T3, T4)", () => {
  let ctx;
  // Kâğıt fatura (Kâğıt profil) Müşteri Fişi ile AYNI seriden (Fatura Ayarları → Kâğıt Fatura / Müşteri Fişi Serisi) numara alır; e-Arşiv kullanıcısı kişiye kâğıt
  // fatura kesemez (profile-not-allowed) → kâğıt kayıtlar e-Arşiv kapatılarak yapılır (firma e-Arşiv'i bırakmış), ayrılışlar e-Arşiv açıkken.
  const earsiv = async on => ctx.must(`e-Arşiv ${on ? "açık" : "kapalı"}`, ctx.api.put("/api/workspace/invoices/settings", { earsiv: on }));
  const paperSale = (extra = {}) => ctx.sale({ profile: "KAGIT", eSend: undefined, ...extra });
  before(async () => {
    ctx = await boot();
    // A (bugün) bırakıldı FIS…001 → gönderildi: FIS serisinde belge kalmadı, ayrılan numara FIS…001 (bugün).
    ctx.a = await ctx.departed(() => ctx.sale(), "A");
    assert.equal(ctx.a.paperNumber, fis(1));
  });
  after(async () => {
    await ctx?.close();
  });

  test("T4 tarih sırası: ayrılan numaradan (bugün) eski tarihli kâğıt fatura kaydedilmez (form ön hesabı da söyler), eski tarihli belge bırakılmaz", async () => {
    await earsiv(false);
    const paper = await paperSale({ issueDate: day(-1) });
    assert.equal(paper.status, 400, JSON.stringify(paper.data));
    assert.equal(paper.data.code, "chronology", JSON.stringify(paper.data));
    assert.match(paper.data.error, new RegExp(`FIS serisinde son belge ${fis(1)}`));
    const calc = await ctx.must("ön hesap", ctx.api.post("/api/workspace/invoices/calc", { scenario: "service_sale", accountId: ctx.ids.person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, issueDate: day(-1), profile: "KAGIT" }));
    assert.ok((calc.numbering || []).some(text => text.includes(fis(1))), `formun ön hesabı: ${JSON.stringify(calc.numbering)}`);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE series = 'FIS'").n, 0, "kayıt reddedildi (veri tabanı)");
    await earsiv(true);
    // Eski tarihli bekleyen belge (eski veri / yarış benzetimi; kayıtta TEA serisinin sırası zaten reddeder).
    const old = await ctx.must("eski bekleyen", ctx.sale());
    ctx.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", day(-1), old.id);
    const left = await ctx.withdraw(old.id);
    assert.equal(left.status, 409, JSON.stringify(left.data));
    assert.equal(left.data.code, "chronology");
    assert.match(left.data.error, new RegExp(`FIS serisinde son belge ${fis(1)}`));
    // Gönderilemeyen (kronoloji engelli) belgede bırakma yolu önerilmez: Müşteri Fişi serisinin son verilen numarası (ayrılan FIS…001, bugün) daha yeni.
    const card = await ctx.must("kart", ctx.api.get(`/api/workspace/invoices/${old.id}`));
    assert.match(card.sendBlock, /TEA serisinde son gönderilen belge/);
    assert.doesNotMatch(card.sendBlock, /Müşteri Fişi Olarak Bırak/, card.sendBlock);
    assert.equal((await ctx.must("eski iptal", ctx.api.post(`/api/workspace/invoices/${old.id}/cancel`, { reason: "test: sıra" }))).status, "cancelled");
  });

  test("T3 kâğıt fatura kaydı ve toplu kayıt (Seçilenleri Kaydet) ayrılan numaradan sonra numara alır", async () => {
    await earsiv(false);
    const paper = await ctx.must("kâğıt fatura", paperSale());
    assert.equal(paper.profile, "KAGIT");
    assert.equal(paper.number, fis(2), `kâğıt fatura: ${paper.number}`);
    const drafts = [];
    for (let i = 0; i < 2; i += 1) drafts.push((await ctx.must("taslak", paperSale({ status: "draft" }))).id);
    const bulk = await ctx.must("toplu kayıt", ctx.api.post("/api/workspace/invoices/bulk-issue", { ids: drafts }));
    assert.equal(bulk.issued, 2, JSON.stringify(bulk.results));
    const numbers = drafts.map(id => ctx.store.get("SELECT number FROM invoices WHERE id = ?", id).number).sort();
    assert.deepEqual(numbers, [fis(3), fis(4)]);
    for (const n of [1, 2, 3, 4]) assert.equal(ctx.holders(fis(n)).length, 1, `${fis(n)}: ${JSON.stringify(ctx.holders(fis(n)))}`);
    await earsiv(true);
  });

  test("T4 Düzenle: serinin son numarası ayrılmışsa önceki belge onun tarihini aşamaz (numara ve tarih sırası)", async () => {
    // İki gün ileri: F (yarın) bırakıldı FIS…005 → gönderildi; serinin son verilen numarası F'nin (yarın). FIS…004 (17.06) Düzenle'de 19.06'ya alınamaz.
    ctx.server.clock.advance({ days: 2 });
    const f = await ctx.departed(() => ctx.sale({ issueDate: day(1) }), "F");
    assert.equal(f.paperNumber, fis(5));
    await earsiv(false);
    const prev = ctx.store.get("SELECT id FROM invoices WHERE number = ?", fis(4));
    const edited = await ctx.api.post(`/api/workspace/invoices/${prev.id}/edit`, { scenario: "service_sale", accountId: ctx.ids.person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, profile: "KAGIT", issueDate: day(2) });
    assert.equal(edited.status, 400, JSON.stringify(edited.data));
    assert.equal(edited.data.code, "chronology", JSON.stringify(edited.data));
    assert.match(edited.data.error, new RegExp(`Sonraki belge ${fis(5)}`), edited.data.error);
    // Ayrılan numaranın tarihine kadar (yarın) serbest.
    const moved = await ctx.must("Düzenle (yarın)", ctx.api.post(`/api/workspace/invoices/${prev.id}/edit`, { scenario: "service_sale", accountId: ctx.ids.person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, profile: "KAGIT", issueDate: day(1) }));
    assert.equal(moved.issueDate, day(1));
    await earsiv(true);
  });
});

describe("Numara tekil: kopma, iki oturum, 002 şirketi, Şirket Verisini Sıfırla (T6, T7, T8, T9)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("T6 bırakılmış belgenin gönderimi EDM'ye ulaşmadı: e-Belge numarası belgede kalır (Gönderilmedi), fiş numarası yine de ayrılmıştır — başka belgeye verilmez", async () => {
    const a = await ctx.must("A kayıt", ctx.sale());
    assert.equal((await ctx.must("A bırak", ctx.withdraw(a.id))).number, fis(1));
    ctx.faults.push("SendInvoice");
    const failed = await ctx.send(a.id);
    assert.notEqual(failed.status, 200, JSON.stringify(failed.data));
    const card = ctx.store.get("SELECT number, paper_no AS paperNo, e_status AS eStatus FROM invoices WHERE id = ?", a.id);
    assert.match(card.number, /^TEA2026\d{9}$/, JSON.stringify(card));
    assert.equal(card.paperNo, fis(1), "iz");
    const b = await ctx.must("B kayıt", ctx.sale());
    assert.equal((await ctx.must("B bırak", ctx.withdraw(b.id))).number, fis(2));
    const again = await ctx.must("A yeniden gönder", ctx.send(a.id));
    assert.equal(again.number, card.number, "aynı e-Belge numarasıyla");
    assert.equal(ctx.holders(fis(1)).length, 1, JSON.stringify(ctx.holders(fis(1))));
  });

  test("T1 sıra: büyük numara önce, küçüğü sonra ayrılırsa sıradaki numara yine en büyükten sonra gelir", async () => {
    // Önceki testten: B bırakılmış FIS…002 (seride). C bırakılır FIS…003; önce C, sonra B gönderilir → seride belge kalmaz.
    const b = ctx.store.get("SELECT id FROM invoices WHERE number = ?", fis(2));
    const c = await ctx.must("C kayıt", ctx.sale());
    assert.equal((await ctx.must("C bırak", ctx.withdraw(c.id))).number, fis(3));
    await ctx.must("C gönder", ctx.send(c.id));
    await ctx.must("B gönder", ctx.send(b.id));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE series = 'FIS'").n, 0, "ön koşul: FIS serisinde belge kalmadı");
    const d = await ctx.must("D kayıt", ctx.sale());
    assert.equal((await ctx.must("D bırak", ctx.withdraw(d.id))).number, fis(4));
    for (const n of [2, 3, 4]) assert.equal(ctx.holders(fis(n)).length, 1, `${fis(n)}: ${JSON.stringify(ctx.holders(fis(n)))}`);
  });

  test("T7 iki oturum aynı anda: bırakılmış belgeler gönderilirken başka belgeler bırakılır → her fiş numarası tek belgede", async () => {
    const other = ctx.server.client();
    assert.equal((await other.login("admin", ADMIN_PASSWORD)).status, 200);
    const withdrawOther = async id => unwrap(await other.post(`/api/workspace/invoices/${id}/withdraw`, {}));
    for (let round = 0; round < 6; round += 1) {
      const leaving = await ctx.must("bırakılmış", ctx.sale());
      await ctx.must("bırak", ctx.withdraw(leaving.id));
      const next = await ctx.must("bekleyen", ctx.sale());
      // İstekler sırayla başlatılır: tek turlarda önce gönderim, çift turlarda önce bırakma (iki sıra da denenir).
      const [sent, left] = round % 2 ? await Promise.all([ctx.send(leaving.id), withdrawOther(next.id)]) : (await Promise.all([withdrawOther(next.id), ctx.send(leaving.id)])).reverse();
      assert.equal(sent.status, 200, JSON.stringify(sent.data));
      assert.equal(left.status, 200, JSON.stringify(left.data));
    }
    const all = ctx.store.all("SELECT number AS n FROM invoices WHERE number LIKE 'FIS%' UNION ALL SELECT paper_no AS n FROM invoices WHERE paper_no LIKE 'FIS%'").map(row => row.n);
    assert.equal(new Set(all).size, all.length, `tekrar eden fiş numarası: ${all.filter((n, i) => all.indexOf(n) !== i)}`);
  });

  test("T8 002 şirketi kendi sayacını tutar: 001'deki ayrılış 002'yi, 002'deki 001'i etkilemez", async () => {
    const created = await ctx.must("002", ctx.api.post("/api/companies", { name: "İkinci Büro", select: false }));
    const q = `?hofCompany=${encodeURIComponent((created.company || created).id)}`;
    // Sahte EDM iki şirkette ortak (gerçek test hesabı gibi): 002'nin e-Arşiv test serisi ayrı başlangıçtan (11048 "daha önce gönderildi" olmasın).
    const ids = await ctx.setup(q, "İkinci Büro Ltd.", { start: { TEA2026: 500 } });
    const before001 = (await ctx.must("001 ayar", ctx.api.get("/api/workspace/invoices/settings"))).nextNumbers.paper.number;
    const a = await ctx.departed(() => ctx.sale({}, q, ids.person), "002 A", q);
    assert.equal(a.paperNumber, fis(1), "002 kendi serisinde baştan");
    const b = await ctx.must("002 B", ctx.sale({}, q, ids.person));
    assert.equal((await ctx.must("002 B bırak", ctx.withdraw(b.id, q))).number, fis(2));
    assert.equal((await ctx.must("001 ayar", ctx.api.get("/api/workspace/invoices/settings"))).nextNumbers.paper.number, before001, "001'in sıradaki numarası değişmedi");
    const c = await ctx.must("001 C", ctx.sale());
    assert.equal((await ctx.must("001 C bırak", ctx.withdraw(c.id))).number, before001);
  });

  test("T9 Şirket Verisini Sıfırla (Tüm Hareketleri Sil): faturalarla birlikte ayrılış kaydı da silinir; seri MAX(seq) gibi baştan", async () => {
    await ctx.must("sıfırla", ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, 0);
    const shown = await ctx.must("ayar oku", ctx.api.get("/api/workspace/invoices/settings"));
    assert.equal(shown.nextNumbers.paper.number, fis(1), JSON.stringify(shown.nextNumbers.paper));
    const doc = await ctx.must("kayıt", ctx.sale());
    assert.equal((await ctx.must("bırak", ctx.withdraw(doc.id))).number, fis(1));
  });
});
