// Yerel veri için mutabakat denetimi: npm run mutabakat
//
// Kasa, Cari, Stok ve Taksit alt defterlerini ana defterle (mizan) karşılaştırır; cari bazında, kart bazında, kuruş/işaret
// ve tarih kurallarını denetler. Veritabanına dokunmaz: dosya salt okunur açılır, VACUUM INTO ile geçici bir kopyası
// alınır ve denetim o kopyada çalışır (sunucu çalışırken de güvenlidir). Kopya iş bitince silinir.
//
//   npm run mutabakat                 özet + sapmalar
//   npm run mutabakat -- --ayrinti    her denetim ve mizan satırları
//   npm run mutabakat -- --json       makine okunur çıktı
//   HUKUK_DATA_DIR=D:\DestekOfis\data npm run mutabakat
//
// Çıkış kodu: 0 tutarlı, 1 sapma var, 2 çalıştırılamadı.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../server/lib/db.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const detail = args.has("--ayrinti") || args.has("--detail");
const asJson = args.has("--json");
const dataDir = path.resolve(process.env.HUKUK_DATA_DIR || path.join(root, "data"));
const source = resolveDbPath(dataDir);
const tl = value => `${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const day = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");

if (!existsSync(source)) {
  console.error(`Veritabanı bulunamadı: ${source}\nVeri klasörünü HUKUK_DATA_DIR ile belirtin.`);
  process.exit(2);
}

const work = mkdtempSync(path.join(os.tmpdir(), "destekofis-mutabakat-"));
let app = null;
let code = 2;
try {
  const copyDir = path.join(work, "data");
  const copy = path.join(copyDir, path.basename(source));
  const { mkdirSync } = await import("node:fs");
  mkdirSync(copyDir, { recursive: true });
  const db = openDatabase(source, { readOnly: true });
  try {
    db.prepare("VACUUM INTO ?").run(copy);
  } finally {
    db.close();
  }
  const { createApp } = await import("../server/app.mjs");
  const quiet = { debug() {}, info() {}, warn() {}, error() {} };
  app = createApp({ dataDir: copyDir, backupDir: path.join(work, "backups"), log: quiet });
  const result = app.integrity.run();
  const { trial } = app.ledger.check();
  const lockedUntil = app.period.lockedUntil();
  const today = app.period.today();
  code = result.ok ? 0 : 1;

  if (asJson) {
    console.log(JSON.stringify({ source, today, lockedUntil, ok: result.ok, durationMs: result.durationMs, trial, checks: result.checks }, null, 2));
  } else {
    console.log(`DestekOfis mutabakat denetimi · ${source}`);
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
} catch (error) {
  console.error(`Denetim çalıştırılamadı: ${error.message}`);
  code = 2;
} finally {
  await app?.close().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}
process.exit(code);
