// 2.5.0 Ç6-HESAP tur 2 — Bilanço okuma ucu, programın KENDİ yollarından girilen veriyle (arayüzün kullandığı API; docs/erp/C6-HESAP-TASARIM.md §6, §8, §9).
// BEKLENENLER ELLE (kitabın formülüyle; programın çıktısından değil):
//   Ürün P: açılış 10.01 10 × 50 = 500,00 (M-07: B 153 / A 519) · alış faturası 01.03 20 × 60 = 1.200,00 + KDV 240,00 (açık hesap, Tedarikçi T) · satış faturası 04.05 25 × 100 = 2.500,00
//   + KDV 500,00 (açık hesap, "Ayşe Yılmaz" 1) · tedarikçiye iade 01.06 5 × 70 = 350,00 (açık hesap) · müşteri iadesi 01.07 2 × 100 = 200,00 (açık hesap, Ayşe 1) · Kasa girişi 01.02 1.000,00 (carisiz)
//   · Kasa çıkışı 15.08 300,00 · AYNI ADLI ikinci "Ayşe Yılmaz"dan 01.09 nakit 400,00 tahsilat (borcu yok → alacaklı).
//   30.09: stok 2 Adet × 54,00 = 108,00 (birim (500 + 1200 − 350) / 25); T = 1.350,00 − 108,00 = 1.242,00; Dönem Net Kârı 2.500 − 200 − 1.242 − 300 + 1.000 = 1.758,00.
//   Defter: 100 = 1.000 − 300 + 400 = 1.100,00 · 120 Ayşe 1 = 3.000 − 200 = 2.800,00, Ayşe 2 = −400,00 · 153 = 1.350,00 · 191 = 240,00 · 320 T = −1.440 + 350 = −1.090,00 · 391 = −500,00 · 519 = −500,00.
//   Bilanço 30.09: AKTİF I.A 1.100 · I.C 2.800 · I.E 108 (tahmini) · I.H 240 → 4.248,00. PASİF III.B 1.090 · III.D 340 ← Ayşe 2 400 · III.I 500 · V.F hesaplanmış 1.758 · V.G 519 500 → 4.248,00.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { apiOf, boot, must } from "./banka-210-ortak.mjs";
import { ADMIN_PASSWORD, createUser } from "./helpers.mjs";
import { lockAndWait } from "./fixtures/donma-bekle.mjs";

const FS = "/api/workspace/financial-statements";
const NOW = "2026-10-08T12:00:00+03:00";
const items = out => [...out.aktif.gruplar, ...out.pasif.gruplar].flatMap(grup => grup.kalemler);
const itemOf = (out, kod) => items(out).find(row => row.kod === kod);
const amounts = out => Object.fromEntries(items(out).filter(row => row.tutarMinor !== 0).map(row => [row.kod, row.tutarMinor]));

describe("Ç6-HESAP Bilanço okuma ucu — API'den girilen veri, iş parçacığı, yetki, kilit, iki şirket, yedek", () => {
  const rule = { on: false };
  // Kural değişikliği benzetimi (YALNIZ TEST kancası): açıkken satış faturasının 600 / 120 satırlarına 100,00 eklenir.
  rule.fn = entries => (!rule.on ? entries : entries.map(entry => {
    if (!entry.lines.some(line => line.account === "600")) return entry;
    return { ...entry, lines: entry.lines.map(line => (line.account === "600" ? { ...line, credit: line.credit + 10000 } : line.account === "120" ? { ...line, debit: line.debit + 10000 } : line)) };
  }));
  let ctx;
  let api;
  const ids = {};
  before(async () => {
    ctx = await boot({ now: { time: NOW, fixed: true }, __testLedgerRule: rule });
    api = ctx.api;
    ids.supplier = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier" }))).id;
    ids.ayse1 = (await must("Ayşe 1", api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer" }))).id;
    ids.ayse2 = (await must("Ayşe 2", api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", force: true }))).id;
    assert.notEqual(ids.ayse1, ids.ayse2, "aynı adlı iki cari ayrı");
    ids.item = (await must("ürün", api.post("/api/workspace/stock", { name: "Ürün P", unit: "Adet", unitPrice: "50", openingQty: "10", openingDate: "2026-01-10" }))).id;
    await must("kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "1000", description: "Danışmanlık", date: "2026-02-01" }));
    const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
    await must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.supplier, number: "AL-1", issueDate: "2026-03-01", lines: [{ itemId: ids.item, name: "", qty: 20, unitPrice: 60, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.ayse1, issueDate: "2026-05-04", lines: [{ itemId: ids.item, name: "", qty: 25, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("tedarikçiye iade", api.post(`/api/workspace/stock/${ids.item}/moves`, { kind: "out", reason: "preturn", qty: "5", unitPrice: "70", pay: "account", accountId: ids.supplier, date: "2026-06-01" }));
    await must("müşteri iadesi", api.post(`/api/workspace/stock/${ids.item}/moves`, { kind: "in", reason: "return", qty: "2", unitPrice: "100", pay: "account", accountId: ids.ayse1, date: "2026-07-01" }));
    await must("kasa çıkışı", api.post("/api/workspace/cash", { kind: "out", amount: "300", description: "Kırtasiye", date: "2026-08-15" }));
    await must("Ayşe 2 tahsilat", api.post(`/api/workspace/accounts/${ids.ayse2}/entries`, { kind: "in", amount: "400", date: "2026-09-01", note: "Avans" }));
  });
  after(() => ctx?.server.close());

  it("Bilanço 30.09.2026 elle hesaplanan sayılarla; aynı adlı iki cari brüt (biri 120'de, öbürü 340'ta); Aktif = Pasif", async () => {
    const out = await must("bilanço", api.get(`${FS}/balance-sheet?date=2026-09-30`));
    assert.deepEqual(amounts(out), { "I.A": 110000, "I.C": 280000, "I.E": 10800, "I.H": 24000, "III.B": 109000, "III.D": 40000, "III.I": 50000, "V.F": 175800, "V.G": 50000 });
    assert.deepEqual(out.toplamlar, { aktifMinor: 424800, pasifMinor: 424800, farkMinor: 0 });
    assert.deepEqual(itemOf(out, "III.D").hesaplar.map(row => [row.hesap, row.tutarMinor, row.cariSayisi, row.kaynaklar.map(source => [source.hesap, source.adet])]), [["340", 40000, 1, [["120", 1]]]]);
    assert.equal(itemOf(out, "I.C").hesaplar[0].cariSayisi, 1);
    assert.deepEqual(out.kesinDegil.map(row => row.kod), ["tamamlanmamis-acilis", "smm-tahmini", "bilgi-amacli"]);
  });

  it("hesaplanmış Dönem Net Kârı = aynı t'nin Gelir Tablosu ucu (1 Ocak – t) — ay / çeyrek / yıl sonu, gelecek tarih; Aktif = Pasif her t'de", async () => {
    for (const date of ["2026-01-31", "2026-03-31", "2026-06-30", "2026-09-30", "2026-12-31"]) {
      const out = await must(`bilanço ${date}`, api.get(`${FS}/balance-sheet?date=${date}`));
      const gt = await must(`gelir tablosu ${date}`, api.get(`${FS}/income-statement?from=2026-01-01&to=${date}`));
      assert.equal(out.hesaplanmis.donemNetKari.tutarMinor, gt.subtotals.donemNetKari, date);
      assert.equal(out.toplamlar.farkMinor, 0, date);
    }
  });

  it("iç tutarlılık: hesap başına defter bakiyesi = aynı t'nin Hesap Planı Mizanı (1–5); bilançodaki tutar = defter (153 hariç: DSS_t)", async () => {
    for (const date of ["2026-03-31", "2026-09-30"]) {
      const out = await must("bilanço", api.get(`${FS}/balance-sheet?date=${date}`));
      const trial = await must("mizan", api.get(`/api/workspace/ledger?to=${date}`));
      const want = new Map(trial.trial.accounts.filter(row => /^[1-5]/.test(row.code) && Math.round(row.balance * 100) !== 0).map(row => [row.code, Math.round(row.balance * 100)]));
      const got = new Map(out.accounts.filter(row => row.defterMinor !== 0).map(row => [row.hesap, row.defterMinor]));
      assert.deepEqual(got, want, date);
      for (const row of out.accounts) if (row.hesap !== "153") assert.equal(row.bilancoMinor, row.defterMinor, `${date} ${row.hesap}`);
    }
  });

  it("iş parçacığı ↔ iş parçacığısız sonuç birebir; varsayılan tarih bugün; geçersiz tarih 400", async () => {
    const viaWorker = await must("bilanço", api.get(`${FS}/balance-sheet?date=2026-09-30`));
    assert.deepEqual(ctx.app.context.financialStatements.inline({ kind: "balance", date: "2026-09-30" }), viaWorker);
    const today = await must("bugün", api.get(`${FS}/balance-sheet`));
    assert.equal(today.date, "2026-10-08");
    assert.equal((await api.get(`${FS}/balance-sheet?date=2026-02-30`)).status, 400);
  });

  it("yetki: Muhasebe görür; Personel ve Avukat 403", async () => {
    const admin = api.client;
    const accounting = apiOf(await createUser(ctx.server, admin, { username: "muh2", role: "muhasebe" }));
    const staff = apiOf(await createUser(ctx.server, admin, { username: "per2", role: "personel" }));
    const lawyer = apiOf(await createUser(ctx.server, admin, { username: "avk2", role: "avukat" }));
    assert.equal((await accounting.get(`${FS}/balance-sheet?date=2026-09-30`)).status, 200);
    for (const user of [staff, lawyer]) assert.equal((await user.get(`${FS}/balance-sheet?date=2026-09-30`)).status, 403);
  });

  it("kilitli t DONMUŞ defterden (kural değişikliği benzetiminde değişmez), kilitsiz t canlı", async () => {
    const before = await must("önce", api.get(`${FS}/balance-sheet?date=2026-06-30`));
    await lockAndWait(api.client, "2026-06-30");
    const lockedSame = await must("kilitli", api.get(`${FS}/balance-sheet?date=2026-06-30`));
    assert.deepEqual([lockedSame.aktif, lockedSame.pasif], [before.aktif, before.pasif], "kilit konunca sayılar aynı");
    rule.on = true;
    try {
      const fs = ctx.app.context.financialStatements;
      const locked = fs.inline({ kind: "balance", date: "2026-06-30" });
      assert.deepEqual([locked.aktif, locked.pasif], [before.aktif, before.pasif], "kilitli t donmuş defterden (canlı türetme +100,00 gösterirdi)");
      const open = fs.inline({ kind: "balance", date: "2026-09-30" });
      assert.equal(open.toplamlar.farkMinor, 0);
    } finally {
      rule.on = false;
    }
  });

  it("iki şirket + yedek: ikinci şirketin Bilanço'su birinciyi görmez; 002'de yedek → kayıt → geri yükleme → Bilanço yedekteki gibi; 001'e dönünce sayılar aynı", async () => {
    const before = await must("001", api.get(`${FS}/balance-sheet?date=2026-09-30`));
    const list = await must("şirketler", api.get("/api/companies"));
    const first = list.current;
    const created = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: true }));
    const empty = await must("002 bilanço", api.get(`${FS}/balance-sheet?date=2026-09-30`));
    assert.deepEqual(empty.toplamlar, { aktifMinor: 0, pasifMinor: 0, farkMinor: 0 });
    assert.equal(empty.entryCount, 0);
    await must("002 kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "500", description: "Hizmet", date: "2026-09-05" }));
    const saved = await must("002 bilanço 2", api.get(`${FS}/balance-sheet?date=2026-09-30`));
    assert.deepEqual([saved.toplamlar.aktifMinor, saved.hesaplanmis.donemNetKari.tutarMinor, saved.toplamlar.farkMinor], [50000, 50000, 0], "elle: Kasa 500,00 = Dönem Net Kârı 500,00");
    const backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: created.company.id }))).backups[0].name;
    await must("yeni kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "77", description: "Ek", date: "2026-09-20" }));
    const changed = await must("değişti", api.get(`${FS}/balance-sheet?date=2026-09-30`));
    assert.equal(changed.toplamlar.aktifMinor, 57700);
    const restoredReply = await must("geri yükle", api.post("/api/admin/backups/restore", { name: backup, company: created.company.id, confirm: created.company.code || "002", password: ADMIN_PASSWORD }));
    assert.equal(restoredReply.restored, true, JSON.stringify(restoredReply));
    const restored = await must("geri yüklendi", api.get(`${FS}/balance-sheet?date=2026-09-30`));
    assert.deepEqual([restored.aktif, restored.pasif, restored.toplamlar], [saved.aktif, saved.pasif, saved.toplamlar]);
    await must("001 seç", api.post("/api/companies/select", { id: first }));
    assert.deepEqual(await must("001 yeniden", api.get(`${FS}/balance-sheet?date=2026-09-30`)), before);
  });
});
