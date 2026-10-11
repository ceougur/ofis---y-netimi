// Yerel veri için mutabakat denetimi: npm run mutabakat
//
// Kasa, Cari, Stok ve Taksit alt defterlerini ana defterle (mizan) karşılaştırır; cari bazında, kart bazında, kuruş/işaret
// ve tarih kurallarını denetler. Veritabanına dokunmaz: dosya salt okunur açılır, VACUUM INTO ile geçici bir kopyası
// alınır ve denetim o kopyada çalışır (sunucu çalışırken de güvenlidir). Kopya iş bitince silinir. Kopya programın açtığı gibi
// açılır (bekleyen göç ve eski sürümden dönüş onarımı kopyada uygulanır; asıl dosya değişmez).
//
//   npm run mutabakat                       001 (ilk şirket): özet + sapmalar
//   npm run mutabakat -- --sirket 002       yalnız 002 kodlu şirket (v2.1.0, §10.7)
//   npm run mutabakat -- --sirket tümü      bütün şirketler (her sonuç şirketin kodu ve adıyla)
//   npm run mutabakat -- --ayrinti          her denetim ve mizan satırları
//   npm run mutabakat -- --json             makine okunur çıktı (--sirket ile: { companies: [...] })
//   HUKUK_DATA_DIR=D:\DestekOfis\data npm run mutabakat
//
// Çıkış kodu: 0 tutarlı, 1 sapma var, 2 çalıştırılamadı (bilinmeyen şirket kodu dahil).
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../server/lib/db.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { REGISTRY_COPY, ROOT_COMPANY_ID, readRegistryFile } from "../server/lib/companies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const args = new Set(argv);
const detail = args.has("--ayrinti") || args.has("--detail");
const asJson = args.has("--json");
// --sirket <kod|tümü> ya da --sirket=<kod|tümü>
const companyArg = (() => {
  const index = argv.findIndex(item => item === "--sirket" || item === "--company");
  if (index >= 0) return argv[index + 1] ?? "";
  const inline = argv.find(item => item.startsWith("--sirket=") || item.startsWith("--company="));
  return inline ? inline.slice(inline.indexOf("=") + 1) : null;
})();
const dataDir = path.resolve(process.env.HUKUK_DATA_DIR || path.join(root, "data"));
const tl = value => `${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const day = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const quiet = { debug() {}, info() {}, warn() {}, error() {} };

/** Şirket listesi (kayıt defteri; yoksa yalnız 001). */
function companiesOf() {
  const registry = readRegistryFile(path.join(dataDir, "sirketler.json")) || readRegistryFile(path.join(dataDir, REGISTRY_COPY));
  const list = registry?.companies?.length ? registry.companies : [{ id: ROOT_COMPANY_ID, code: "001", name: "", dir: "" }];
  return list
    .filter(company => !company.deletedAt)
    .map(company => ({ id: company.id, code: String(company.code), name: String(company.name || ""), source: resolveDbPath(company.id === ROOT_COMPANY_ID || !company.dir ? dataDir : path.join(dataDir, company.dir)) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Bir veri dosyasının salt okunur kopyasında mutabakat. */
async function check(source, work) {
  const copyDir = path.join(work, "data");
  mkdirSync(copyDir, { recursive: true });
  const copy = path.join(copyDir, path.basename(source));
  const db = openDatabase(source, { readOnly: true });
  try {
    db.prepare("VACUUM INTO ?").run(copy);
  } finally {
    db.close();
  }
  const { createApp } = await import("../server/app.mjs");
  const app = createApp({ dataDir: copyDir, backupDir: path.join(work, "backups"), log: quiet, integrityScan: false });
  try {
    const result = app.integrity.run();
    const { trial } = app.ledger.check();
    return { source, today: app.period.today(), lockedUntil: app.period.lockedUntil(), ok: result.ok, durationMs: result.durationMs, trial, checks: result.checks, failures: result.failures };
  } finally {
    await app.close().catch(() => {});
  }
}

function print(report, heading = "") {
  const { source, today, lockedUntil, trial } = report;
  const result = { ok: report.ok, checks: report.checks, failures: report.failures, durationMs: report.durationMs };
  console.log(`DestekOfis mutabakat denetimi · ${heading ? `${heading} · ` : ""}${source}`);
  console.log(`Bugün ${day(today)} · Dönem kilidi: ${lockedUntil ? `${day(lockedUntil)} ve öncesi kilitli` : "yok"} · ${result.checks.length} denetim, ${result.durationMs} ms`);
  console.log(`Mizan: borç ${tl(trial.totals.debit)} · alacak ${tl(trial.totals.credit)} · fark ${tl(trial.totals.difference)}${trial.unbalanced ? ` · dengesiz fiş ${trial.unbalanced}` : ""}`);
  if (detail) {
    console.log("\nMizan (hesap · borç · alacak · bakiye)");
    for (const row of trial.accounts) console.log(`  ${row.code.padEnd(4)} ${row.name.padEnd(34).slice(0, 34)} ${tl(row.debit).padStart(18)} ${tl(row.credit).padStart(18)} ${tl(row.balance).padStart(18)}`);
    console.log("\nDenetimler");
    for (const item of result.checks) {
      const extra = item.ledger !== undefined ? ` (defter ${tl(item.ledger)} / alt defter ${tl(item.subledger)})` : item.count ? ` (${item.count})` : "";
      console.log(`  ${item.ok ? "✓" : "✗"} ${item.name}${extra}`);
    }
  }
  if (result.ok) console.log("\n✓ Ana defter ile Kasa, Cari, Stok ve Taksit alt defterleri kuruşu kuruşuna tutarlı.");
  else {
    console.log(`\n✗ ${result.failures.length} denetimde sapma:`);
    for (const item of result.failures) {
      const money = item.difference ? ` · fark ${tl(item.difference)}` : "";
      const sides = item.ledger !== undefined ? ` · defter ${tl(item.ledger)} / alt defter ${tl(item.subledger)}` : "";
      // v2.0.26 (2. gözden geçirme İ8): yalnız eski sürümden kalan satır: uyarı (⚠) ve ne yapılacağı.
      const legacy = item.legacy && item.legacy >= item.count;
      console.log(`  ${legacy ? "⚠" : "✗"} ${item.name}${sides}${money}${item.count ? ` · ${item.count} kayıt` : ""}${legacy ? " · eski sürümden kalan, yeni işlemler engellenmez" : ""}`);
      if (item.hint) console.log(`      ${item.hint}`);
      for (const line of item.sample || []) console.log(`      ${line}`);
    }
    console.log("\nVeri değiştirilmedi. Sapmalar eski sürümlerden kalmış olabilir; program yeni sapmaya izin vermez.");
  }
}

const work = mkdtempSync(path.join(os.tmpdir(), "destekofis-mutabakat-"));
let code = 2;
try {
  if (companyArg === null) {
    // Eski biçim (bayraksız): kök veri dosyası (001).
    const source = resolveDbPath(dataDir);
    if (!existsSync(source)) {
      console.error(`Veritabanı bulunamadı: ${source}\nVeri klasörünü HUKUK_DATA_DIR ile belirtin.`);
      process.exitCode = 2;
    } else {
      const report = await check(source, work);
      code = report.ok ? 0 : 1;
      if (asJson) console.log(JSON.stringify({ source, today: report.today, lockedUntil: report.lockedUntil, ok: report.ok, durationMs: report.durationMs, trial: report.trial, checks: report.checks }, null, 2));
      else print(report);
    }
  } else {
    const wanted = companyArg.trim().toLocaleLowerCase("tr-TR");
    const all = companiesOf();
    const selected = ["tümü", "tumu", "hepsi", "all"].includes(wanted) ? all : all.filter(company => company.code === companyArg.trim());
    if (!selected.length) {
      console.error(`Şirket bulunamadı: "${companyArg}". Kayıtlı şirketler: ${all.map(company => `${company.code} · ${company.name}`).join(", ") || "yok"}. Bütün şirketler için --sirket tümü.`);
      code = 2;
    } else {
      const reports = [];
      for (const company of selected) {
        if (!existsSync(company.source)) {
          reports.push({ code: company.code, name: company.name, source: company.source, ok: false, error: "Veri dosyası bulunamadı.", checks: [] });
          continue;
        }
        const companyWork = path.join(work, company.code);
        mkdirSync(companyWork, { recursive: true });
        const report = await check(company.source, companyWork);
        reports.push({ code: company.code, name: company.name, ...report });
      }
      const missing = reports.some(report => report.error);
      code = missing ? 2 : reports.every(report => report.ok) ? 0 : 1;
      if (asJson) {
        console.log(JSON.stringify({ dataDir, ok: reports.every(report => report.ok), companies: reports.map(({ failures, ...rest }) => rest) }, null, 2));
      } else {
        reports.forEach((report, index) => {
          if (index) console.log("\n" + "─".repeat(72) + "\n");
          const heading = `${report.code} · ${report.name}`;
          if (report.error) console.log(`DestekOfis mutabakat denetimi · ${heading} · ${report.source}\n✗ ${report.error}`);
          else print(report, heading);
        });
        if (reports.length > 1) {
          console.log("\n" + "─".repeat(72));
          for (const report of reports) console.log(`  ${report.error ? "✗" : report.ok ? "✓" : "✗"} ${report.code} · ${report.name}${report.error ? ` — ${report.error}` : report.ok ? "" : ` — ${report.failures.length} denetimde sapma`}`);
        }
      }
    }
  }
} catch (error) {
  console.error(`Denetim çalıştırılamadı: ${error.message}`);
  code = 2;
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(process.exitCode ?? code);
