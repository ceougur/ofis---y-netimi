// Ölçüm (2.0.22 gözden geçirme bulgusu 1): çok carili veride (20.000 / 60.000 cari, yalnız 10'unun faturası var) fatura
// listesi, sol menü rozeti, vade takvimi ve ANLIK DURUM — her turdan önce bir yazma (başka personelin tahsilatı gibi) önbelleği
// geçersiz kılar. Toplu ödeme durumu hesabı önce BÜTÜN carilerin defterini kuruyordu (20.000 caride liste ~600 ms); artık
// yalnız faturası olan carilerinkini.
// Kullanım: KOD=<sunucu kodunun kökü> node olcum-cok-cari.mjs [cari sayısı]
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "../helpers.mjs";
import { HERE } from "./ortak.mjs";

const KOD = path.resolve(process.env.KOD || path.join(HERE, "..", ".."));
const { createApp } = await import(pathToFileURL(path.join(KOD, "server", "app.mjs")).href);
const PASS = "Olcum-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "olcum-cok-cari-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const api = createClient(`http://127.0.0.1:${port}`);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const pad = value => String(value).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
try {
  await api.login("admin", PASS);
  const N = Number(process.argv[2] || 20000);
  const matrix = [["Ad Soyad", "Telefon", "Bakiye"], ...Array.from({ length: N }, (_, i) => [`Kişi ${i}`, `0532${String(i).padStart(7, "0")}`, String(100 + (i % 50))])];
  const started = Date.now();
  const imported = await api.post("/api/workspace/accounts/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "phone", 2: "balance" }, type: "customer", mode: "skip" });
  console.log(`${path.basename(KOD)}: ${N.toLocaleString("tr-TR")} cari içe aktarıldı (${imported.status}, ${Date.now() - started} ms)`);
  const list = unwrap(await api.get("/api/workspace/accounts?limit=20&status=all"));
  const item = unwrap(await api.post("/api/workspace/stock", { name: "Ürün", code: "P-1", unit: "Adet", unitPrice: 10, salePrice: 100 })).id;
  for (let i = 0; i < 10; i += 1) {
    const invoice = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: list.accounts[i].id, issueDate: TODAY, lines: [{ itemId: item, qty: 1, unitPrice: 100, vatRate: 0 }], payment: { rest: "open" }, force: true });
    if (invoice.status !== 200) throw new Error(`fatura ${invoice.status}`);
  }
  const time = async (label, url) => {
    const t0 = performance.now();
    const response = await api.get(url);
    if (response.status !== 200) throw new Error(`${label} ${response.status}`);
    return `${label} ${Math.round(performance.now() - t0)} ms`;
  };
  for (let round = 1; round <= 3; round += 1) {
    await api.post(`/api/workspace/accounts/${list.accounts[15].id}/entries`, { kind: "in", amount: 1, date: TODAY, method: "cash" });
    console.log(`  tur ${round}: ${await time("fatura listesi", "/api/workspace/invoices?tab=sale&limit=200")} · ${await time("rozet", "/api/workspace/invoices?tab=sale&pay=overdue&limit=1")} · ${await time("vade takvimi", "/api/workspace/dues")} · ${await time("ANLIK DURUM", "/api/workspace/overview")}`);
  }
} finally {
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
