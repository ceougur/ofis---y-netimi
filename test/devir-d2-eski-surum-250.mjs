#!/usr/bin/env node
// 2.5.0 D2 — ESKİ SÜRÜM VERİSİ (CLAUDE.md test kuralı: "eski sürüm verisi, o sürümün GERÇEK kodu çalıştırılıp API'sinden girilerek üretilir"; ders 17).
// v2.4.9'un GERÇEK kodu (`git archive v2.4.9` kopyası; ders 23) 001 + 002 + iki şirketin yedeğini programın kendi API'siyle üretir. Sonra yeni kod (D2):
//   1) kayıt defterini okur (arşiv alanı yok) — iki şirket, arşiv yok;
//   2) 002'nin v2.4.9 dosyası (şema 45) D4 benzetimiyle arşive ayrılır (arşiv işareti + çalışma dosyasında devir yılı; kayda YAZILMAZ) → açılışta DİSKTEN TANINIR,
//      ilk açılışta özet kayda girer ve arşiv son şemaya GÖÇ eder; arşivde yazma 403, okuma 200, canlı 002 yazar;
//   3) v2.4.9'da alınmış 002 yedeği (devir kaydı yok) geri yüklenmez (409 devir-oncesi-yedek); 001'in v2.4.9 yedeği (001'in arşivi yok) hazırlanır;
//   4) v2.4.9'dan gelen veride bakım kipi: 002 yazması 503, kip kalkınca 200;
//   5) ESKİ KOD yeniden açar (bootstrap dönüşü benzetimi) ve 002'nin adını değiştirir → arşiv alanını bilmediği için kayıttan düşürür; yeni kod açılışta arşivi
//      YENİDEN tanır (özet arşiv klasöründen), arşiv yine açılır.
//   node test/devir-d2-eski-surum-250.mjs --eski <v2.4.9 kopyası>   (HUKUK_LICENSE_URL=http://127.0.0.1:9; ders 30)
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const OLD = path.resolve(argv[argv.indexOf("--eski") + 1] || "");
const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-11-02T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "d2-eski-surum-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const helpersOf = async code => import(pathToFileURL(path.join(code, "test/helpers.mjs")).href);
const neu = await helpersOf(NEW);
const old = await helpersOf(OLD);
const { LATEST_VERSION: LATEST } = await import(pathToFileURL(path.join(NEW, "server/lib/migrations.mjs")).href);
const { hashFile } = await import(pathToFileURL(path.join(NEW, "server/lib/devir/archives.mjs")).href);
let tests = 0;
let failed = 0;
const check = (ok, text) => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
};
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const schemaOf = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("PRAGMA user_version").get().user_version;
  } finally {
    db.close();
  }
};
const setSetting = (file, key, value) => {
  const db = new DatabaseSync(file);
  try {
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value, new Date().toISOString());
  } finally {
    db.close();
  }
};

// 1) v2.4.9 gerçek kodu — 001 + 002 + yedekler
let server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
let admin = await old.loginAdmin(server);
check((await admin.post("/api/workspace/cash", { kind: "in", amount: 100, date: "2026-11-02", description: "v2.4.9 001" })).status === 200, "v2.4.9: 001 kasa");
const created = unwrap(await admin.post("/api/companies", { name: "Eski İkinci" }));
const secondId = created?.company?.id;
check(Boolean(secondId), "v2.4.9: 002 açıldı");
check((await admin.post(`/api/workspace/cash?hofCompany=${secondId}`, { kind: "in", amount: 70, date: "2026-11-02", description: "v2.4.9 002" })).status === 200, "v2.4.9: 002 kasa");
const taken = unwrap(await admin.post("/api/admin/backups", { scope: "all" }));
const backup002 = taken?.backups?.find(item => item.companyId === secondId);
const backup001 = taken?.backups?.find(item => item.companyId !== secondId);
check(Boolean(backup002 && backup001), "v2.4.9: iki şirketin yedeği alındı");
const secondDir = server.app.companies.dirsOf(server.app.companies.get(secondId)).dataDir;
const oldSchema = server.app.store.get("PRAGMA user_version").user_version;

await server.close();

// 2) D4 benzetimi: 002'nin v2.4.9 dosyası arşive (kayda yazılmaz — diskten tanınmalı)
const liveFile = path.join(secondDir, "destekofis.sqlite");
const archiveDir = path.join(secondDir, "arsiv", "2025");
mkdirSync(archiveDir, { recursive: true });
const archiveFile = path.join(archiveDir, "destekofis.sqlite");
const twin = new DatabaseSync(liveFile);
twin.exec(`VACUUM INTO '${archiveFile.replace(/'/g, "''")}'`);
twin.close();
setSetting(archiveFile, "devir.archive", JSON.stringify({ companyId: secondId, year: "2025", cutoff: "2025-12-31", runId: "devir-2025-eski-surum" }));
setSetting(liveFile, "devir.years", JSON.stringify([{ year: "2025", cutoff: "2025-12-31", runId: "devir-2025-eski-surum", at: new Date().toISOString() }]));
check(schemaOf(archiveFile) === oldSchema && oldSchema < LATEST, `arşiv v2.4.9 şemasında (${schemaOf(archiveFile)} < ${LATEST})`);
const archiveCash = (() => {
  const db = new DatabaseSync(archiveFile, { readOnly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM cash_entries").get().n;
  } finally {
    db.close();
  }
})();

// 3) yeni kod
server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
try {
  admin = await neu.loginAdmin(server);
  const companies = server.app.companies;
  check(companies.list().length === 2 && companies.limit().count === 2, "yeni kod: v2.4.9 kayıt defteri okundu (2 şirket)");
  check(companies.archivesOf(server.app.companyId).length === 0, "001'in arşivi yok");
  const adopted = companies.archivesOf(secondId);
  check(adopted.length === 1 && adopted[0].recovered === true && !adopted[0].sha256, `002'nin arşivi diskten tanındı (özet yok: ilk kullanımda güven) ${JSON.stringify(adopted)}`);
  const q = `?hofCompany=${secondId}`;
  const read = await admin.get(`/api/workspace/cash${q}&hofArchive=2025`);
  check(read.status === 200 && unwrap(read).entries.some(item => item.description === "v2.4.9 002"), `arşiv okunur (v2.4.9 kaydı görünür) ${read.status}`);
  check(schemaOf(archiveFile) === LATEST, `arşiv son şemaya göç etti (${oldSchema} → ${schemaOf(archiveFile)})`);
  const entry = companies.archiveOf(secondId, "2025");
  check(entry.sha256 === (await hashFile(archiveFile)) && entry.migratedFrom === oldSchema, "kayıttaki özet göç sonrası dosyanınki; göçün kaynağı yazıldı");
  const archiveCashAfter = (() => {
    const db = new DatabaseSync(archiveFile, { readOnly: true });
    try {
      return db.prepare("SELECT COUNT(*) AS n FROM cash_entries").get().n;
    } finally {
      db.close();
    }
  })();
  check(archiveCashAfter === archiveCash, `göçten sonra arşivin kasa satırları aynı (${archiveCash})`);
  const write = await admin.post(`/api/workspace/cash${q}&hofArchive=2025`, { kind: "in", amount: 1, date: "2025-12-01", description: "x" });
  check(write.status === 403 && write.data?.code === "archive-read-only", `arşivde yazma 403 (${write.status} ${write.data?.code})`);
  check((await admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 2, date: "2026-11-02", description: "yeni kod 002" })).status === 200, "canlı 002 yazar");
  // v2.4.9 yedekleri
  const pre = await admin.post("/api/admin/backups/restore", { name: backup002.name, company: secondId, confirm: "002", password: neu.ADMIN_PASSWORD });
  check(pre.status === 409 && pre.data?.code === "devir-oncesi-yedek", `v2.4.9'da alınmış 002 yedeği geri yüklenmez (${pre.status} ${pre.data?.code})`);
  const root001 = await admin.post("/api/admin/backups/restore", { name: backup001.name, company: server.app.companyId, confirm: "001", password: neu.ADMIN_PASSWORD });
  check(root001.status === 200 && unwrap(root001).staged === true, `001'in v2.4.9 yedeği hazırlanır (001'in arşivi yok) ${root001.status}`);
  check((await admin.del("/api/admin/backups/restore")).status === 200, "hazırlıktan vazgeçildi");
  // bakım kipi v2.4.9 verisinde
  await server.app.maintenance.enter(secondId, { reason: "devir", runId: "eski-surum" });
  const blocked = await admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 3, date: "2026-11-02", description: "bakımda" });
  check(blocked.status === 503 && blocked.data?.code === "maintenance", `bakımda 002 yazması 503 (${blocked.status})`);
  check((await admin.post("/api/workspace/cash", { kind: "in", amount: 4, date: "2026-11-02", description: "001 sürer" })).status === 200, "bakımda 001 yazar");
  await server.app.maintenance.exit(secondId);
  check((await admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 5, date: "2026-11-02", description: "sonra" })).status === 200, "kip kalkınca 002 yazar");
} finally {
  await server.close();
}

// 4) ESKİ KOD yeniden açar ve 002'nin adını değiştirir (arşiv alanını bilmez → kayıttan düşer)
server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
try {
  admin = await old.loginAdmin(server);
  const renamed = await admin.put(`/api/companies/${secondId}`, { name: "Eski Kod Adı" });
  check(renamed.status === 200, `v2.4.9: 002 ad değişikliği ${renamed.status}`);
} finally {
  await server.close();
}
const registry = JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8"));
check(!registry.companies.find(item => item.id === secondId)?.archives, "v2.4.9 ad değişikliği arşiv alanını düşürdü (beklenen eski davranış)");

// 5) yeni kod: arşiv yeniden tanınır
server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
try {
  admin = await neu.loginAdmin(server);
  const again = server.app.companies.archivesOf(secondId);
  check(again.length === 1 && again[0].sha256 === (await hashFile(archiveFile)), "yeni kod: arşiv yeniden tanındı, özet arşiv klasöründen (arsiv-kaydi.json)");
  const reread = await admin.get(`/api/workspace/cash?hofCompany=${secondId}&hofArchive=2025`);
  check(reread.status === 200, `arşiv yine açılır (${reread.status})`);
} finally {
  await server.close();
  neu.removeTestDir(root);
}
console.log(`1..${tests}\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exit(failed ? 1 : 0);
