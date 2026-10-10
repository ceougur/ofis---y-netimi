// 2.1.0 — K1 İADE KAPANIŞI (bağımsız kâhin + hakem bulgusu, docs/kanit/2026-10-10/kahin/hakem-hukumleri.json "IADE-KAPAMA"; orta;
// v2.0.26'da da VAR; R1'den — iadenin geri ödemesinin karşı tarafta ödeme sayılması — AYRI kök).
//
// Hata: iade belgesi bir alacak notudur; ya asıl faturaya mahsup edilir ya geri ödenir, ikisi birden olmaz. Program (lib/invoice-settle.mjs)
// iade belgesinin bütün tutarını asıl faturanın açığından düşüyor, geri ödenen kısmı da ayrıca ödüyordu: aynı alacak iki kez kullanılıyor →
// faturada kimsenin ödemediği "Fatura 240" kapatanı (hayalet ödeme), kalan alacak hiçbir açık belgede/yaşlandırmada yok, Σ açık ≠ cari bakiye.
// Geri ödenmemiş iade asıl faturadan büyükse artan alacak hiçbir belgede görünmüyordu (iade belgesinin açığı hep 0).
//
// Doğru kural (hakem; plan susuyor → yaygın uygulama, açık kalem kapama; test/bagimsiz/SENARYO-DILI.md §7 kural 2 ve 5), kuruşla:
//   mahsup     = iade tutarı − geri ödenen
//   asıl.açık  = max(0, asılAçık − mahsup)          (asılAçık: peşin ve bağlı ödemelerden sonra kalan)
//   iade.açık  = max(0, mahsup − asılAçık)          (artan alacak notu; carinin başka açık belgesi varsa en eski borçtan
//                                                    kapatılır — 2.0.15'ten beri FIFO kuralı, R1c korunur — kalanı iade belgesinde görünür)
// Taksitli faturada kartın kalanı = faturanın açığı (ikisi aynı formülle).
//
// Nasıl bozarım (önce yazıldı; testler buradan; her satırın beklenen sayısı elle, programın kodundan değil):
//   N1  açık satış + paralı iade (nakit geri)                 → fatura açığı değişmez, hayalet kapatan yok
//   N2  alış tarafı simetrik (tedarikçi parayı geri öder)
//   N3  kısmi peşinli satış + paralı iade                    → peşinden sonra kalan açık değişmez
//   N4  KISMİ geri ödeme (240 iade, 100 geri)               → mahsup 140
//   N5  geri ödenmemiş iade (bugünkü davranış korunur)      → asıl fatura iade kadar azalır
//   N6  asıl tamamı peşin + geri ödenmemiş iade (satış ve alış) → artan alacak iade belgesinin açığı; Açık Faturalar'da görünür
//   N7  hakemin en küçük senaryosu (alış 23,93, 9,84 peşin, tam iade açık) → iade açığı 9,84
//   N8  taksitli satış + paralı iade                         → fatura açığı = kart kalanı = cari
//   N9  iade iptali / silme sonrası asıl fatura eski hâline döner
//   N10 birden çok iade (biri paralı, biri açık)
//   N11 R1 komşusu: aynı caride başka açık satış (paralı iade onu kapatmaz) ve aynı caride açık alış (hayalet ödeme yok)
//   N12 sıra: iade önce açık kaydedilip sonra Düzenle ile geri ödeme eklenir / geri ödeme kaldırılır
//   N13 açık iade sonradan cari kartından bağsız ödemeyle müşteriye geri verilir → iade belgesinin açığı kapanır
//   N14 liste (toplu yol, 8'den çok cari) = fatura kartı (cari başına yol); her caride Σ belge açığı (işaretli) = cari bakiye
//   (hesaba bağlı havaleyle geri ödeme: R1b ve iade-210 G aynı yolu kapsar; eski veri: iade-210-onarim.)
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
const dayOf = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data });
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Number(`${match[1] ? "-" : ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};

async function boot() {
  const server = await startTestServer();
  const client = await loginAdmin(server);
  const api = {
    get: async url => unwrap(await client.get(url)),
    post: async (url, body) => unwrap(await client.post(url, body)),
    put: async (url, body) => unwrap(await client.put(url, body)),
    del: async url => unwrap(await client.del(url)),
  };
  // Kasa eksiye düşme sorusu bu testin konusu değil (geri ödemeler Kasa'dan çıkar).
  await must("eksi bakiye denetimi", api.put("/api/admin/negative-policy", { cash: "off" }));
  return { server, api };
}

// Yardımcılar: KDV'siz hizmet kalemleri (tutarlar elle izlenebilsin); iade asıl faturanın 1. kaleminden.
function helpers(api) {
  let purchaseNo = 0;
  const h = {
    async account(name, type = "customer") {
      return must("cari", api.post("/api/workspace/accounts", { name, type, registeredOn: dayOf(-120) }));
    },
    async sale(acc, { qty = 10, price = 60, cash = [], date = dayOf(-60), installments = null } = {}) {
      const payment = installments ? { cash, cheques: [], endorse: [], rest: "installments", installments } : { cash, cheques: [], endorse: [], rest: "open", dueDate: date };
      const doc = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: date, lines: [{ name: "Hizmet", qty, unitPrice: price, vatRate: 0 }], payment, force: true, cashForce: true }));
      return { id: doc.id, planId: doc.plan?.id || doc.planId || "", lineId: doc.lines[0].id };
    },
    async purchase(acc, { qty = 10, price = 120, cash = [], date = dayOf(-60), lines = null } = {}) {
      purchaseNo += 1;
      const doc = await must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: acc.id, number: `K1-AL-${purchaseNo}-${Date.now() % 100000}`, issueDate: date, lines: lines || [{ name: "Hizmet Alımı", qty, unitPrice: price, vatRate: 0 }], payment: { cash, cheques: [], endorse: [], rest: "open", dueDate: date }, force: true, cashForce: true }));
      return { id: doc.id, lineId: doc.lines[0].id };
    },
    async giveBack(acc, inv, qty, refund = [], { date = dayOf(-30), kind = "sale_return" } = {}) {
      return must("iade", api.post("/api/workspace/invoices", { kind, accountId: acc.id, originalId: inv.id, issueDate: date, lines: [{ originLineId: inv.lineId, qty }], payment: { cash: refund, cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    },
    async doc(id) {
      return must("fatura kartı", api.get(`/api/workspace/invoices/${id}`));
    },
    async balance(acc) {
      const d = await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
      return d.totals?.balance ?? d.account?.balance ?? d.balance;
    },
    async openReport(acc) {
      const r = await must("Açık Faturalar", api.get(`/api/workspace/report-center/acik-faturalar?account=${acc.id}`));
      const at = name => r.headers.indexOf(name);
      return {
        alacak: moneyOf(r.summary.find(([k]) => k === "Açık Alacak")?.[1]),
        borc: moneyOf(r.summary.find(([k]) => k === "Açık Borç")?.[1]),
        rows: r.rows.map(row => ({ no: row[at("Fatura No")], taraf: row[at("Taraf")], kalan: moneyOf(row[at("Kalan")]) })),
      };
    },
    async aging(acc) {
      const r = await must("Alacak Yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
      const row = r.rows.find(cells => cells[0] === acc.name);
      return row ? moneyOf(row.at(-1)) : 0;
    },
  };
  return h;
}
const nakit = amount => [{ amount, method: "cash" }];
// Fatura kartında iade belgesinin (ya da başka bir faturanın) "Fatura" kapatanı: kimsenin ödemediği iade alacağının izi.
const ghost = doc => (doc.closers || []).filter(c => c.label === "Fatura").reduce((sum, c) => sum + c.amount, 0);

async function scenario(fn) {
  const { server, api } = await boot();
  try {
    await fn(api, helpers(api));
  } finally {
    await server.close();
  }
}

describe("K1 — iade kapanışı: geri ödenen iade asıl faturayı kapatmaz, artan alacak iade belgesinin açığıdır", () => {
  test("N1: açık satış 600 → 240 iade + 240 nakit geri → fatura açığı 600, hayalet kapatan yok, iade açığı 0, cari 600, raporlar 600", () => scenario(async (api, h) => {
    // Elle: cari = 600 (satış) − 240 (iade) + 240 (geri ödeme) = 600. Müşteri bir kuruş ödemedi: fatura açığı 600, ödenen 0.
    const acc = await h.account("N1 Müşteri");
    const f1 = await h.sale(acc);
    const r1 = await h.giveBack(acc, f1, 4, nakit(240));
    const doc = await h.doc(f1.id);
    assert.equal(doc.open, 600, "fatura açığı 600 (programda 360: iade alacağı hem geri ödendi hem faturadan düşüldü)");
    assert.equal(doc.paid, 0, "ödenen 0");
    assert.equal(ghost(doc), 0, `hayalet "Fatura" kapatanı yok: ${JSON.stringify(doc.closers)}`);
    assert.equal((await h.doc(r1.id)).open, 0, "iade belgesi geri ödemeyle kapandı");
    assert.equal(await h.balance(acc), 600);
    const report = await h.openReport(acc);
    assert.equal(report.alacak, 600, "Açık Faturalar: Açık Alacak = cari bakiye");
    assert.equal(await h.aging(acc), 600, "Alacak Yaşlandırma = cari bakiye");
  }));

  test("N2: alış 1.200 açık → 240 alıştan iade, tedarikçi 240 nakit geri öder → alış açığı 1.200, cari −1.200", () => scenario(async (api, h) => {
    // Elle: cari = −1.200 (alış) + 240 (iade) − 240 (tedarikçiden alınan para) = −1.200. Biz tedarikçiye hiç ödemedik.
    const acc = await h.account("N2 Tedarikçi", "supplier");
    const f1 = await h.purchase(acc);
    const r1 = await h.giveBack(acc, f1, 2, nakit(240), { kind: "purchase_return" });
    const doc = await h.doc(f1.id);
    assert.equal(doc.open, 1200, "alış açığı 1.200 (programda 960)");
    assert.equal(ghost(doc), 0, `hayalet kapatan yok: ${JSON.stringify(doc.closers)}`);
    assert.equal((await h.doc(r1.id)).open, 0);
    assert.equal(await h.balance(acc), -1200);
    assert.equal((await h.openReport(acc)).borc, 1200, "Açık Borç = 1.200");
  }));

  test("N3: satış 600 (300 nakit peşin) → 240 iade + 240 nakit geri → açık 300 (= cari)", () => scenario(async (api, h) => {
    // Elle: cari = 600 − 300 − 240 + 240 = 300; açık = 600 − 300 (peşin) = 300 (programda 60).
    const acc = await h.account("N3 Müşteri");
    const f1 = await h.sale(acc, { cash: nakit(300) });
    await h.giveBack(acc, f1, 4, nakit(240));
    const doc = await h.doc(f1.id);
    assert.deepEqual([doc.open, doc.paid], [300, 300]);
    assert.equal(await h.balance(acc), 300);
    assert.equal(await h.aging(acc), 300);
  }));

  test("N4: KISMİ geri ödeme — satış 600 açık → 240 iade, 100 nakit geri → mahsup 140, açık 460 (= cari)", () => scenario(async (api, h) => {
    // Elle: mahsup = 240 − 100 = 140; açık = 600 − 140 = 460; cari = 600 − 240 + 100 = 460.
    const acc = await h.account("N4 Müşteri");
    const f1 = await h.sale(acc);
    const r1 = await h.giveBack(acc, f1, 4, nakit(100));
    const doc = await h.doc(f1.id);
    assert.deepEqual([doc.open, doc.paid], [460, 140]);
    assert.equal(ghost(doc), 140, "kapatan: iadenin mahsup edilen 140'ı");
    assert.equal((await h.doc(r1.id)).open, 0);
    assert.equal(await h.balance(acc), 460);
  }));

  test("N5 (korunur): satış 600 açık → 240 iade, geri ödenmez → açık 360 (= cari)", () => scenario(async (api, h) => {
    const acc = await h.account("N5 Müşteri");
    const f1 = await h.sale(acc);
    const r1 = await h.giveBack(acc, f1, 4);
    const doc = await h.doc(f1.id);
    assert.deepEqual([doc.open, doc.paid], [360, 240]);
    assert.equal((await h.doc(r1.id)).open, 0);
    assert.equal(await h.balance(acc), 360);
  }));

  test("N6: satış 600 tamamı peşin → 240 iade açık → iade açığı 240 (müşteri alacaklı); Açık Faturalar'da borç 240", () => scenario(async (api, h) => {
    // Elle: cari = 600 − 600 − 240 = −240; asıl açık 0 → artan 240 iade belgesinin açığı (biz müşteriye 240 borçluyuz).
    const acc = await h.account("N6 Müşteri");
    const f1 = await h.sale(acc, { cash: nakit(600) });
    const r1 = await h.giveBack(acc, f1, 4);
    assert.equal((await h.doc(f1.id)).open, 0);
    const ret = await h.doc(r1.id);
    assert.equal(ret.open, 240, "iade belgesinin açığı 240 (programda 0)");
    assert.equal(await h.balance(acc), -240);
    const report = await h.openReport(acc);
    assert.deepEqual([report.alacak, report.borc], [0, 240], "Açık Faturalar: müşteriye 240 borç (iade)");
    assert.ok(report.rows.some(row => row.no === ret.number && row.kalan === 240), `iade satırı raporda: ${JSON.stringify(report.rows)}`);
  }));

  test("N6b: alış 1.200 tamamı peşin → 240 alıştan iade açık → iade açığı 240 (tedarikçi borçlu); Açık Alacak 240", () => scenario(async (api, h) => {
    const acc = await h.account("N6b Tedarikçi", "supplier");
    const f1 = await h.purchase(acc, { cash: nakit(1200) });
    const r1 = await h.giveBack(acc, f1, 2, [], { kind: "purchase_return" });
    assert.equal((await h.doc(f1.id)).open, 0);
    assert.equal((await h.doc(r1.id)).open, 240);
    assert.equal(await h.balance(acc), 240);
    assert.deepEqual([(await h.openReport(acc)).alacak, (await h.openReport(acc)).borc], [240, 0]);
  }));

  test("N7: hakemin en küçük senaryosu — alış 23,93 (20,99 × %5 iskonto, KDV %20 hariç), 9,84 peşin; tam iade açık → iade açığı 9,84", () => scenario(async (api, h) => {
    // Elle: matrah 20,99 × 0,95 = 19,94; KDV 3,99; toplam 23,93. Açık 23,93 − 9,84 = 14,09; iade 23,93 bunu kapatır, 9,84 artar.
    const acc = await h.account("N7 Tedarikçi", "supplier");
    const f6 = await h.purchase(acc, { cash: nakit(9.84), lines: [{ name: "Adaptör", qty: 1, unitPrice: 20.99, discountRate: 5, vatRate: 20 }] });
    const r1 = await h.giveBack(acc, f6, 1, [], { kind: "purchase_return" });
    const doc = await h.doc(f6.id);
    assert.equal(doc.payableTotal ?? doc.tryPayable, 23.93);
    assert.equal(doc.open, 0);
    assert.equal((await h.doc(r1.id)).open, 9.84, "iade açığı 9,84 (programda 0)");
    assert.equal(await h.balance(acc), 9.84);
  }));

  test("N8: taksitli satış 600 (peşinsiz, 3 taksit) → 240 iade + 240 nakit geri → fatura açığı 600 = kart kalanı 600 = cari 600", () => scenario(async (api, h) => {
    const acc = await h.account("N8 Müşteri");
    const f1 = await h.sale(acc, { date: dayOf(-20), installments: { count: 3, firstDue: dayOf(10), everyMonths: 1 } });
    await h.giveBack(acc, f1, 4, nakit(240), { date: dayOf(-10) });
    const doc = await h.doc(f1.id);
    const plan = await must("kart", api.get(`/api/workspace/plans/${f1.planId || doc.planId}`));
    assert.equal(plan.totals.remaining, 600, "kart kalanı 600 (müşterinin borcu değişmedi)");
    assert.equal(doc.open, 600, "fatura açığı = kart kalanı (programda 360)");
    assert.equal(await h.balance(acc), 600);
  }));

  test("N9: iade iptal edilince ve silinince asıl fatura eski hâline (600) döner", () => scenario(async (api, h) => {
    const acc = await h.account("N9 Müşteri");
    const f1 = await h.sale(acc);
    const r1 = await h.giveBack(acc, f1, 4, nakit(240));
    assert.equal((await h.doc(f1.id)).open, 600);
    await must("iade iptali", api.post(`/api/workspace/invoices/${r1.id}/cancel`, { force: true, cashForce: true }));
    assert.equal((await h.doc(f1.id)).open, 600, "iptalden sonra 600");
    assert.equal(await h.balance(acc), 600);
    const r2 = await h.giveBack(acc, f1, 4, nakit(100), { date: dayOf(-29) });
    assert.equal((await h.doc(f1.id)).open, 460, "yeni iade: mahsup 140");
    await must("iade sil", api.del(`/api/workspace/invoices/${r2.id}?force=1&cashForce=1`));
    assert.equal((await h.doc(f1.id)).open, 600, "silmeden sonra 600");
    assert.equal(await h.balance(acc), 600);
  }));

  test("N10: birden çok iade — satış 600 açık → R1 240 + 240 nakit geri, R2 120 açık → açık 480 (= cari)", () => scenario(async (api, h) => {
    // Elle: cari = 600 − 240 + 240 − 120 = 480; açık = 600 − 0 (R1 mahsup) − 120 (R2) = 480.
    const acc = await h.account("N10 Müşteri");
    const f1 = await h.sale(acc);
    const r1 = await h.giveBack(acc, f1, 4, nakit(240));
    const r2 = await h.giveBack(acc, f1, 2, [], { date: dayOf(-29) });
    const doc = await h.doc(f1.id);
    assert.deepEqual([doc.open, doc.paid], [480, 120]);
    assert.deepEqual([(await h.doc(r1.id)).open, (await h.doc(r2.id)).open], [0, 0]);
    assert.equal(await h.balance(acc), 480);
  }));

  test("N11: R1 komşusu — eski açık satış F0 500 + F1 600; F1'den 240 iade + 240 geri → F0 500, F1 600; aynı caride açık alış 400 ödenmez", () => scenario(async (api, h) => {
    // Elle: cari = 500 + 600 − 400 (alış) − 240 + 240 = 700 = 500 + 600 − 400.
    const acc = await h.account("N11 Hem Müşteri Hem Tedarikçi");
    const p1 = await h.purchase(acc, { qty: 1, price: 400, date: dayOf(-90) });
    const f0 = await h.sale(acc, { qty: 1, price: 500, date: dayOf(-80) });
    const f1 = await h.sale(acc);
    await h.giveBack(acc, f1, 4, nakit(240));
    const [d0, d1, dp] = [await h.doc(f0.id), await h.doc(f1.id), await h.doc(p1.id)];
    assert.deepEqual([d0.open, d1.open, dp.open], [500, 600, 400]);
    assert.deepEqual([ghost(d0), ghost(d1)], [0, 0]);
    assert.equal(await h.balance(acc), 700);
  }));

  test("N12: sıra — iade önce açık kaydedilir, Düzenle ile 240 nakit geri ödeme eklenir (açık 600), sonra kaldırılır (açık 360)", () => scenario(async (api, h) => {
    const acc = await h.account("N12 Müşteri");
    const f1 = await h.sale(acc);
    const r1 = await h.giveBack(acc, f1, 4);
    assert.equal((await h.doc(f1.id)).open, 360);
    const edit = refund => must("iade düzenle", api.post(`/api/workspace/invoices/${r1.id}/edit`, { kind: "sale_return", accountId: acc.id, originalId: f1.id, issueDate: dayOf(-30), lines: [{ originLineId: f1.lineId, qty: 4 }], payment: { cash: refund, cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    await edit(nakit(240));
    assert.equal((await h.doc(f1.id)).open, 600, "geri ödeme eklenince açık 600");
    assert.equal(await h.balance(acc), 600);
    await edit([]);
    assert.equal((await h.doc(f1.id)).open, 360, "geri ödeme kaldırılınca 360");
    assert.equal(await h.balance(acc), 360);
  }));

  test("N13: açık iade (müşteri 240 alacaklı) sonradan cari kartından 240 nakit ödemeyle geri verilir → iade açığı 0, cari 0", () => scenario(async (api, h) => {
    // Elle: cari = 600 − 600 − 240 + 240 = 0. Müşteriye ödenen 240 alacak notunu kapatır (dil §7 kural 6: bağsız çıkış borç belgesini kapatır).
    const acc = await h.account("N13 Müşteri");
    const f1 = await h.sale(acc, { cash: nakit(600) });
    const r1 = await h.giveBack(acc, f1, 4);
    assert.equal((await h.doc(r1.id)).open, 240);
    await must("cariye ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: 240, date: dayOf(-20), method: "cash", note: "İade bedeli", cashForce: true }));
    assert.equal((await h.doc(r1.id)).open, 0, "iade açığı ödemeyle kapandı");
    assert.equal(await h.balance(acc), 0);
    assert.deepEqual([(await h.openReport(acc)).alacak, (await h.openReport(acc)).borc], [0, 0]);
  }));

  describe("N14: toplu yol (liste, 8'den çok cari) = fatura kartı; Σ işaretli belge açığı = cari bakiye", () => {
    let server;
    let api;
    let h;
    const accounts = [];
    before(async () => {
      ({ server, api } = await boot());
      h = helpers(api);
      // Her cari kendi durumunu taşır; tarihler artan (seri/tarih sırası).
      const add = async (name, type, build) => {
        const acc = await h.account(name, type);
        accounts.push(acc);
        await build(acc);
      };
      let step = -100;
      const next = () => (step += 2);
      await add("T1 açık + paralı iade", "customer", async acc => { const f = await h.sale(acc, { date: dayOf(next()) }); await h.giveBack(acc, f, 4, nakit(240), { date: dayOf(next()) }); });
      await add("T2 kısmi peşin + paralı iade", "customer", async acc => { const f = await h.sale(acc, { cash: nakit(300), date: dayOf(next()) }); await h.giveBack(acc, f, 4, nakit(240), { date: dayOf(next()) }); });
      await add("T3 kısmi geri ödeme", "customer", async acc => { const f = await h.sale(acc, { date: dayOf(next()) }); await h.giveBack(acc, f, 4, nakit(100), { date: dayOf(next()) }); });
      await add("T4 açık iade", "customer", async acc => { const f = await h.sale(acc, { date: dayOf(next()) }); await h.giveBack(acc, f, 4, [], { date: dayOf(next()) }); });
      await add("T5 peşin + açık iade", "customer", async acc => { const f = await h.sale(acc, { cash: nakit(600), date: dayOf(next()) }); await h.giveBack(acc, f, 4, [], { date: dayOf(next()) }); });
      await add("T6 alış + paralı iade", "supplier", async acc => { const f = await h.purchase(acc, { date: dayOf(next()) }); await h.giveBack(acc, f, 2, nakit(240), { date: dayOf(next()), kind: "purchase_return" }); });
      await add("T7 peşin alış + açık iade", "supplier", async acc => { const f = await h.purchase(acc, { cash: nakit(1200), date: dayOf(next()) }); await h.giveBack(acc, f, 2, [], { date: dayOf(next()), kind: "purchase_return" }); });
      await add("T8 iki iade", "customer", async acc => { const f = await h.sale(acc, { date: dayOf(next()) }); await h.giveBack(acc, f, 4, nakit(240), { date: dayOf(next()) }); await h.giveBack(acc, f, 2, [], { date: dayOf(next()) }); });
      await add("T9 eski açık + paralı iade", "customer", async acc => { await h.sale(acc, { qty: 1, price: 500, date: dayOf(next()) }); const f = await h.sale(acc, { date: dayOf(next()) }); await h.giveBack(acc, f, 4, nakit(240), { date: dayOf(next()) }); });
      await add("T10 taksitli + paralı iade", "customer", async acc => { const f = await h.sale(acc, { date: dayOf(next()), installments: { count: 2, firstDue: dayOf(30), everyMonths: 1 } }); await h.giveBack(acc, f, 4, nakit(240), { date: dayOf(next()) }); });
    });
    after(() => server?.close());

    test("liste ile kart aynı durum, ödenen ve açığı gösterir", async () => {
      const list = (await must("liste", api.get("/api/workspace/invoices?tab=all&limit=500"))).invoices.filter(doc => doc.status === "issued");
      assert.ok(new Set(list.map(doc => doc.accountId)).size > 8, "toplu yol (8'den çok cari)");
      for (const doc of list) {
        const card = await h.doc(doc.id);
        assert.deepEqual([doc.payState, doc.paid, doc.open], [card.payState, card.paid, card.open], `${doc.number}: liste ≠ kart`);
      }
    });

    test("her caride Σ açık (satış + alıştan iade) − Σ açık (alış + satıştan iade) = cari bakiye (beklenen bakiyeler elle)", async () => {
      // Elle: T1 600 · T2 300 · T3 460 · T4 360 · T5 −240 · T6 −1.200 · T7 240 · T8 480 · T9 1.100 · T10 600.
      const expected = [600, 300, 460, 360, -240, -1200, 240, 480, 1100, 600];
      const list = (await must("liste", api.get("/api/workspace/invoices?tab=all&limit=500"))).invoices.filter(doc => doc.status === "issued");
      const sign = kind => (["sale", "smm", "purchase_return"].includes(kind) ? 1 : -1);
      const got = [];
      for (const [index, acc] of accounts.entries()) {
        const balance = await h.balance(acc);
        assert.equal(balance, expected[index], `${acc.name}: cari bakiye`);
        const docs = list.filter(doc => doc.accountId === acc.id);
        const signed = Math.round(docs.reduce((sum, doc) => sum + sign(doc.kind) * doc.open, 0) * 100) / 100;
        got.push(signed);
      }
      assert.deepEqual(got, expected, "Σ işaretli açık = cari bakiye");
    });
  });
});
