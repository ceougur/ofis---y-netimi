// Ç5-A tur 1 kabul D (ders 17, 23): v2.4.9'un GERÇEK koduyla API'den veri üretimi ve okuma; aynı okuma yeni kodla (göç 48 / 49 sonrası).
// Kullanım: node v249-veri.mjs <kod kökü> <veri klasörü> gen|lock|read <çıktı.json>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, dataDir, mode, outFile] = process.argv.slice(2);
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ dataDir, now: { time: "2026-11-10T12:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client();
if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş");
const data = r => r.data?.data ?? r.data;
const must = async (label, call) => {
  const r = await call;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return data(r);
};
const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };
try {
  if (mode === "gen") {
    await c.post("/api/workspace/bank/setup/dismiss", {});
    await must("kasa açılış", c.post("/api/workspace/cash/opening", { amount: "10.000", date: "2025-01-02" }));
    const m1 = (await must("m1", c.post("/api/workspace/accounts", { name: "Müşteri Bir", registeredOn: "2025-01-02", openingBalance: "3.000", openingSide: "auto" }))).id;
    const m2 = (await must("m2", c.post("/api/workspace/accounts", { name: "Müşteri İki", registeredOn: "2025-01-02" }))).id;
    const t1 = (await must("t1", c.post("/api/workspace/accounts", { name: "Tedarikçi Bir", type: "supplier", registeredOn: "2025-01-02", openingBalance: "2.000", openingSide: "credit" }))).id;
    // 2.4.9 kuralında açıklamadan açılış: "Açılış bakiyesi" (500), "AÇILIŞ" (602 — P1), "Açilış farkı" (602), "Devir" (602)
    await must("by1", c.post(`/api/workspace/accounts/${m2}/entries`, { kind: "debt", amount: "1.500", date: "2025-01-02", note: "Açılış bakiyesi" }));
    await must("by2", c.post(`/api/workspace/accounts/${m2}/entries`, { kind: "debt", amount: "400", date: "2025-02-01", note: "AÇILIŞ BAKİYESİ" }));
    await must("ay1", c.post(`/api/workspace/accounts/${t1}/entries`, { kind: "credit", amount: "250", date: "2025-02-01", note: "Açilış farkı" }));
    await must("by3", c.post(`/api/workspace/accounts/${m1}/entries`, { kind: "debt", amount: "100", date: "2025-03-01", note: "Devir bakiyesi" }));
    const bank = await must("banka", c.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2025-01-02", amount: "20.000", confirmed: true } }));
    const bankId = bank.id || bank.account?.id;
    await must("çek kullan", c.put(`/api/workspace/bank/accounts/${bankId}`, { usePos: true, useCheque: true, useNote: true }));
    await must("kart", c.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Kart", kind: "card", currency: "TRY", creditLimit: "5.000", opening: { date: "2025-01-02", amount: "700", confirmed: true } }));
    await must("stok", c.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "100", openingDate: "2025-01-02" }));
    await must("portföy", c.post("/api/workspace/cheques/import", { matrix: [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], ["Alınan", "Çek", "AP-1", "Akbank", "Eski Keşideci", "1.200", "15.03.2025", "02.01.2025"], ["Alınan", "Senet", "AP-2", "Akbank", "Eski Borçlu", "600", "20.12.2026", "02.01.2025"], ["Verilen", "Çek", "AP-3", "Akbank", "Eski Lehtar", "300", "25.12.2026", "02.01.2025"]], headerAt: 0, roles, fileName: "acilis.xlsx", post: false }));
    await must("carisiz çek", c.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "FC-1", bank: "Akbank", drawer: "Tanımsız Kişi", amount: "450", issueDate: "2025-04-01", dueDate: "2026-12-01" }));
    const plan = (name, total, paid) => [name, total, "6", "15.01.2026", paid, "01.10.2025"];
    await must("excel kart", c.post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"], plan("Kart Bir", "6000", "1500"), plan("Kart İki", "2400", "0")], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" }, fileName: "kart.xlsx", linkRecords: false }));
    await must("kasa giriş", c.post("/api/workspace/cash", { kind: "in", amount: "500", date: "2025-05-01", description: "Giriş" }));
    await must("kasa çıkış", c.post("/api/workspace/cash", { kind: "out", amount: "200", date: "2026-03-01", description: "Kira" }));
    await must("tahsilat", c.post(`/api/workspace/accounts/${m1}/entries`, { kind: "in", amount: "800", date: "2026-02-01", method: "cash", note: "Tahsilat" }));
    await must("fatura", c.post("/api/workspace/invoices", { kind: "sale", accountId: m2, issueDate: "2026-04-01", lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
    await must("2026 açılış portföyü", c.post("/api/workspace/cheques/import", { matrix: [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], ["Alınan", "Çek", "AP-4", "Akbank", "Yeni Keşideci", "350", "20.12.2026", "01.06.2026"]], headerAt: 0, roles, fileName: "acilis2.xlsx", post: false }));
  }
  if (mode === "lock") await must("kilit", c.put("/api/admin/period-lock", { lockedUntil: "2025-12-31" }));
  // Göç 47'nin bekleyen 2.4.9 koşusu (kilitli dosya) okumadan önce tamamlansın (programda açılıştan sonra arka planda donar).
  if (process.env.DONDUR === "1") await server.app.ledger.snapshots.runPending?.();
  // Okuma (her kodda aynı): mizan (bütün zaman, 2025, 2026), cari bakiyeleri, Kasa / banka, KDV özeti, stok, 2025 Yevmiye satırları, Mutabakat Testi, Defter Mutabakatı.
  const out = { schema: server.app.store.get("PRAGMA user_version").user_version };
  const trial = async q => Object.fromEntries((await must("mizan", c.get(`/api/workspace/ledger${q}`))).trial.accounts.filter(a => a.balance || a.debit || a.credit).map(a => [a.code, a.balance]));
  out.mizan = await trial("");
  out.mizan2025 = await trial("?from=2025-01-01&to=2025-12-31");
  out.mizan2026 = await trial("?from=2026-01-01&to=2026-12-31");
  out.cari = Object.fromEntries((await must("cari", c.get("/api/workspace/accounts?status=all&limit=500"))).accounts.map(a => [a.name, a.balance]));
  const kdv = await must("kdv", c.get("/api/workspace/report-center/kdv-ozeti?from=2026-01-01&to=2026-12-31"));
  out.kdv = kdv.summary;
  out.stok = (await must("stok", c.get("/api/workspace/stock"))).items.map(i => [i.code || i.name, String(i.qty), i.value ?? i.stockValue ?? null]);
  out.yevmiye2025 = (await must("yevmiye", c.get("/api/workspace/report-center/yevmiye?from=2025-01-01&to=2025-12-31"))).rows;
  const scan = await must("Mutabakat Testi", c.get("/api/workspace/ledger/integrity"));
  out.mutabakat = { ok: scan.ok, failures: scan.checks.filter(check => !check.ok).map(check => ({ code: check.code, name: check.name, notice: Boolean(check.notice), count: check.count, difference: check.difference })), acilis: scan.checks.filter(check => String(check.code).startsWith("opening:")).map(check => ({ code: check.code, ok: check.ok, ledger: check.ledger, subledger: check.subledger })) };
  const dm = await must("Defter Mutabakatı", c.get("/api/workspace/report-center/defter-mutabakati"));
  out.defterMutabakati = { subtitle: dm.subtitle, summary: dm.summary, uyumsuz: dm.rows.filter(row => row[5] !== "Tutarlı") };
  const review = await c.get("/api/workspace/opening-review?all=1");
  out.acilisOlabilir = review.status === 200 ? data(review) : { status: review.status };
  out.kilit = await must("kilit", c.get("/api/workspace/ledger/lock"));
  writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(`yazıldı ${outFile} · şema ${out.schema} · Mutabakat Testi ok ${out.mutabakat.ok}`);
} finally {
  await server.app.close();
}
