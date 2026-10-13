// Gerileme fark testi — eski sürüm verisi (bağımsız doğrulayıcı, 12.10.2026; KOD DEĞİŞTİRMEZ). Eski sürümlerin GERÇEK koduyla üretilmiş
// fikstür (test/fixtures/surum-*) iki kez ayrı klasöre açılır; biri v2.1.0'ın gerçek etiket koduyla (git archive ayrı kopya), öbürü bu
// worktree'nin koduyla açılır (ikisi de v20 göçünü kendi koduyla uygular). Her şirkette aynı ekran/rapor uçları okunur: çek listesi + süzgeçler,
// her çekin kartı, Ana Defter mizanı, Mutabakat Testi, Alt Hesap Mizanı, banka hesapları, cariler, Nakit Akış, Vade Takip, takvim, ANLIK DURUM,
// Rapor Merkezi'nin bütün raporları (Tüm Zamanlar + varsayılan). Veri aynı olduğundan kimlikler aynıdır; yalnız zaman damgaları atılır.
//
//   node docs/kanit/2026-10-12/tahsile-ver/gerileme/fark-fikstur.mjs <fikstur-adi> <v2.1.0|guncel> <cikti.json>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CURRENT, bootVersion } from "../../../../../test/guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "../../../../../test/guvenilirlik/fikstur.mjs";

const [name, version = CURRENT, out = "fikstur.json"] = process.argv.slice(2);
const fixture = unpackFixture(name);
const today = readFixture(name).oncesi?.today || "2026-10-08";
const app = await bootVersion(version, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, reportWorker: false });
const api = await app.login();
let registry = [{ id: "sirket-001" }];
try {
  registry = JSON.parse(readFileSync(path.join(fixture.dataDir, "sirketler.json"), "utf8")).companies || registry;
} catch {
  // tek şirketli eski kurulum
}
const result = {};
for (const company of registry) {
  const select = await api.post("/api/companies/select", { id: company.id });
  const reads = { select: select.status };
  if (select.status !== 200) {
    result[company.id] = reads;
    continue;
  }
  const read = async (key, url) => {
    const res = await api.get(url);
    reads[key] = { status: res.status, data: res.data };
  };
  await read("cekListe", "/api/workspace/cheques");
  for (const status of ["portfolio", "collected", "endorsed", "bounced", "paid", "pending", "open", "closed", "overdue", "soon"]) await read(`cekListe:${status}`, `/api/workspace/cheques?status=${status}`);
  for (const row of reads.cekListe.data?.cheques || []) await read(`cekKart:${row.id}`, `/api/workspace/cheques/${row.id}`);
  await read("portfoy", "/api/workspace/invoices/portfolio");
  await read("anaDefter", "/api/workspace/ledger");
  await read("mutabakat", "/api/workspace/ledger/integrity");
  await read("altHesap", "/api/workspace/bank/sub-trial");
  await read("bankaHesaplar", "/api/workspace/bank/accounts");
  await read("cariler", "/api/workspace/accounts");
  await read("nakitAkis", "/api/workspace/overview/nakit-akisi");
  await read("vadeTakip", "/api/workspace/overview/vade-takip");
  await read("anlikDurum", "/api/workspace/overview");
  await read("dues", "/api/workspace/dues");
  const catalog = (await api.get("/api/workspace/report-center")).data;
  for (const report of catalog?.reports || []) {
    await read(`rapor:${report.id}`, `/api/workspace/report-center/${report.id}?preset=all`);
    await read(`rapor:${report.id}:varsayilan`, `/api/workspace/report-center/${report.id}`);
  }
  result[company.id] = reads;
}
await api.post("/api/companies/select", { id: "sirket-001" });
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SKIP = new Set(["createdAt", "updatedAt", "created_at", "updated_at", "generatedAt", "durationMs", "ms", "took", "elapsedMs"]);
const norm = value => {
  if (Array.isArray(value)) return value.map(norm);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !SKIP.has(key)).map(([key, item]) => [key, norm(item)]));
  if (typeof value === "string" && ISO.test(value)) return "<zaman>";
  return value;
};
writeFileSync(out, JSON.stringify({ version, commit: app.commit, fixture: name, today, steps: [], reads: norm(result) }, null, 1));
console.log(`${name} ${version}: ${registry.length} şirket → ${out}`);
await app.close();
fixture.cleanup();
