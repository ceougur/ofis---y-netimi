// Ölçüm (2.0.23 gözden geçirme bulgusu 1): fatura ↔ taksit kartı kapamasının birleşik listelere maliyeti. Her caride
//   VERI=mevcut  (varsayılan) açık satış faturası + "Carinin Mevcut Borcu" kartı (faturanın borcunu taksitlendirir)
//   VERI=taksitli taksitli satış faturası (faturanın kendi kartı)
// Her ölçümden önce bir yazma (yeni cari) önbelleği geçersiz kılar; 5 koşu, ortanca (en az, en çok).
// Kullanım: KOD=<sunucu kodunun kökü> VERI=mevcut node olcum-kapama-223.mjs [cari sayısı]
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "../helpers.mjs";
import { HERE } from "./ortak.mjs";

const KOD = path.resolve(process.env.KOD || path.join(HERE, "..", ".."));
const VERI = process.env.VERI === "taksitli" ? "taksitli" : "mevcut";
const N = Number(process.argv[2] || 300);
const { createApp } = await import(pathToFileURL(path.join(KOD, "server", "app.mjs")).href);
const PASS = "Olcum-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "olcum-kapama-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const api = createClient(`http://127.0.0.1:${port}`);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = (r, what) => {
  if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return unwrap(r);
};
try {
  await api.login("admin", PASS);
  const item = must(await api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }), "hizmet");
  const started = performance.now();
  for (let i = 0; i < N; i += 1) {
    const account = must(await api.post("/api/workspace/accounts", { name: `Ölçüm ${i}`, type: "customer", registeredOn: "2025-01-01", phone: `0500 ${String(100000 + i)}` }), "cari");
    const payment = VERI === "taksitli" ? { rest: "installments", installments: { count: 3, firstDue: "2025-03-01", everyMonths: 1 } } : { rest: "open", dueDate: "2025-02-01" };
    must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, issueDate: "2025-02-01", lines: [{ itemId: item.id, qty: 1, unitPrice: 1200, vatRate: 0 }], payment }), "fatura");
    if (VERI === "mevcut") must(await api.post("/api/workspace/plans", { name: account.name, registeredOn: "2025-02-02", total: "1200", accountId: account.id, mode: "auto", count: "3", firstDue: "2025-03-01", coversBalance: true }), "kart");
  }
  console.log(`Kod: ${KOD} · veri: ${VERI} · ${N} cari (kurulum ${((performance.now() - started) / 1000).toFixed(0)} sn)`);
  const time = async (label, url) => {
    const runs = [];
    for (let k = 0; k < 5; k += 1) {
      must(await api.post("/api/workspace/accounts", { name: `Tetik ${label} ${k}`, type: "customer", registeredOn: "2025-01-01" }), "tetik"); // önbelleği boz
      const t = performance.now();
      const r = await api.get(url);
      runs.push(performance.now() - t);
      if (r.status !== 200) throw new Error(`${url} ${r.status}`);
    }
    runs.sort((a, b) => a - b);
    console.log(`  ${label}: ortanca ${runs[2].toFixed(0)} ms (en az ${runs[0].toFixed(0)}, en çok ${runs[4].toFixed(0)})`);
  };
  await time("takvim /dues", "/api/workspace/dues");
  await time("yaşlandırma", "/api/workspace/report-center/alacak-yaslandirma");
  await time("nakit akış", "/api/workspace/overview/nakit-akisi?from=2025-01-01&to=2026-12-31&overdue=1&table=0");
  await time("vade takip", "/api/workspace/overview/vade-takip");
  await time("fatura listesi", "/api/workspace/invoices?limit=50");
} finally {
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
