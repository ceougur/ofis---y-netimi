// 2.5.0 D2 — ARŞİV kayıt defteri, salt okunur açma, merkezî yazma yasağı, arşivin göçü, şema kapısı (docs/devir/D2-ALTYAPI-TASARIM.md §2–§4, §10; DEVIR-PLANI G1.6,
// G6, §2.1–§2.3, G10.25–26, §8.12, §8.15).
// Arşivler D4'ün (devri yapan iş akışı) işinin BENZETİMİYLE üretilir (test/devir-d2-yardimci.mjs makeArchive: şirket dosyasının tutarlı kopyası + işaretler); eski sürüm
// arşivi GERÇEK v2.0.26 koduyla üretilmiş fikstürden (test/fixtures/surum-2.0.26-zincir — ders 17).
// Nasıl bozulur: şirket adı / kodu değişir (kayıt korunur mu); kayıt defteri kaybolur (diskten tanınır mı — yarım devirde tanınmamalı); eski sürüm alanı düşürür;
// arşivde her yazma ucu; arşivde GET; arşiv dosyası değişmiş / silinmiş; arşiv eski şemada (göç) / yeni şemada (kapı); iki istek aynı anda (tek göç); iki şirket;
// şirket kapanınca arşiv örneği; arşiv kapanınca canlı şirketin WhatsApp kuyruğu; arşiv şirket sınırına sayılır mı.
import assert from "node:assert/strict";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, test } from "node:test";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";

import { LATEST_VERSION, runMigrations } from "../server/lib/migrations.mjs";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { ARCHIVE_MARK_KEY, ARCHIVE_SIDECAR, DEVIR_YEARS_KEY, HUB_ONLY, archiveDirOf, diffKeys, fingerprint, getRoutes, hashFile, makeArchive, schemaOf, writeRoutes, writeSettingRaw } from "./devir-d2-yardimci.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const NOW = "2026-11-02T10:00:00+03:00";
const roots = [];
after(() => {
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d2-arsiv-"));
  roots.push(dir);
  return dir;
};
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const must = async (label, promise, status = 200) => {
  const response = await promise;
  assert.equal(response.status, status, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return unwrap(response);
};
const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const start = dir => startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
// D2 öncesi kodda bu işlevler yok: testler çökmek yerine beklenen nedenle (kayıt yok, örnek açılmadı) kırmızı olur (ders 7 / 38).
const archivesOf = (app, id) => app.companies.archivesOf?.(id) ?? [];
const archiveOf = (app, id, year) => app.companies.archiveOf?.(id, year) ?? null;
const openArchives = app => app.openArchiveIds?.() ?? [];

async function seed(server) {
  const admin = await loginAdmin(server);
  await must("cari", admin.post("/api/workspace/accounts", { name: "Arşiv Carisi", type: "customer" }));
  await must("kasa", admin.post("/api/workspace/cash", { kind: "in", amount: 100, date: "2026-11-02", description: "001 girişi" }));
  const second = (await must("002", admin.post("/api/companies", { name: "Arşiv İkinci" }))).company;
  const q = `?hofCompany=${second.id}`;
  await must("002 cari", admin.post(`/api/workspace/accounts${q}`, { name: "İkinci Cari", type: "customer" }));
  await must("002 kasa", admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 70, date: "2026-11-02", description: "002 girişi" }));
  return { admin, second, q };
}
const cashCount = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM cash_entries").get().n;
  } finally {
    db.close();
  }
};

describe("D2 arşiv kayıt defteri ve salt okunur açma", () => {
  test("kayıt defteri: arşiv sirketler.json + ikinci kopya + ortak katman kopyasında ve arşiv klasöründe; ad / kod değişince korunur; şirket sınırına sayılmaz; aynı yıl ve geçersiz yıl reddedilir", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const admin = await loginAdmin(server);
      const made = await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2025" });
      assert.equal(server.app.companies.limit().count, 1, "001'in arşivi şirket sayılmaz");
      const second = (await must("arşiv varken 002 açılır (sınır 2)", admin.post("/api/companies", { name: "Sınır İkinci" }))).company;
      await makeArchive(server.app, second.id, { year: "2025" });
      assert.equal(server.app.companies.limit().count, 2);
      assert.equal(server.app.companies.list().length, 2, "arşiv listede ayrı şirket olmaz");
      const registry = readJson(path.join(server.dataDir, "sirketler.json"));
      const copy = readJson(path.join(server.dataDir, "sirketler.yedek.json"));
      const hub = JSON.parse(server.app.store.setting("company.registry", "{}"));
      for (const [label, value] of [["sirketler.json", registry], ["sirketler.yedek.json", copy], ["ortak katman", hub]]) {
        const root = value.companies.find(item => item.id === ROOT_COMPANY_ID);
        assert.equal(root.archives?.[0]?.year, "2025", `${label}: 001 arşiv kaydı`);
        assert.equal(root.archives[0].sha256, made.sha256, `${label}: özet`);
      }
      assert.equal(readJson(path.join(made.dir, ARCHIVE_SIDECAR)).sha256, made.sha256, "arşiv klasöründeki kopya (arsiv-kaydi.json)");
      await must("002 ad + kod değişikliği", admin.put(`/api/companies/${second.id}`, { name: "Yeni Ad", code: "007" }));
      assert.equal(archiveOf(server.app, second.id, "2025")?.sha256, readJson(path.join(made.dir.replace(server.dataDir, server.app.companies.dirsOf(server.app.companies.get(second.id)).dataDir), ARCHIVE_SIDECAR)).sha256, "ad / kod değişince arşiv kaydı korunur");
      assert.ok(archiveOf(server.app, second.id, "2025"), "ad / kod değişince arşiv kaydı düşmez");
      assert.throws(() => server.app.companies.addArchive(ROOT_COMPANY_ID, { year: "2025" }), error => error.status === 409 && error.extra?.code === "archive-exists");
      assert.throws(() => server.app.companies.addArchive(ROOT_COMPANY_ID, { year: "25" }), error => error.status === 400);
      assert.throws(() => server.app.companies.addArchive(ROOT_COMPANY_ID, { year: "../../x" }), error => error.status === 400);
      const view = await must("arşiv listesi", admin.get("/api/admin/devir/archives"));
      assert.deepEqual(view.archives.map(item => [item.companyId === ROOT_COMPANY_ID ? "001" : "002", item.year, item.status]).sort(), [["001", "2025", "unverified"], ["002", "2025", "unverified"]]);
    } finally {
      await server.close();
    }
  });

  test("diskten yeniden kurma: kayıt defteri tamamen kaybolunca ve eski sürüm alanı düşürünce arşivler tanınır (özet arşiv klasöründen); yarım devirde (çalışma dosyasında devir yok) TANINMAZ, sahipsiz listesine girer", async () => {
    const dir = workDir();
    let server = await start(dir);
    const { second } = await seed(server);
    const a1 = await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2024" });
    const a2 = await makeArchive(server.app, second.id, { year: "2025" });
    const data = server.dataDir;
    await server.app.close();
    // (1) kayıt defteri tamamen kayıp: dosya, ikinci kopya ve ortak katmandaki kopya.
    for (const name of ["sirketler.json", "sirketler.yedek.json"]) rmSync(path.join(data, name), { force: true });
    writeSettingRaw(resolveDbPath(data), "company.registry", "");
    writeFileSync(path.join(data, "sirketler.json"), "{bozuk");
    server = await start(dir);
    try {
      const companies = server.app.companies.list();
      const recovered = companies.find(item => item.id !== ROOT_COMPANY_ID);
      assert.ok(recovered, "002 diskten kuruldu");
      assert.deepEqual(archivesOf(server.app, ROOT_COMPANY_ID).map(item => [item.year, item.sha256, item.recovered]), [["2024", a1.sha256, true]], "001 arşivi diskten tanındı, özeti arşiv klasöründen");
      assert.deepEqual(archivesOf(server.app, recovered.id).map(item => [item.year, item.sha256, item.recovered]), [["2025", a2.sha256, true]], "002 arşivi diskten tanındı (kurtarılan kimlikle)");
      const admin = await loginAdmin(server);
      await must("tanınan arşiv açılır", admin.get(`/api/workspace/cash?hofCompany=${recovered.id}&hofArchive=2025`));
    } finally {
      await server.app.close();
    }
    // (2) eski sürüm (alanı bilmeyen) kaydı yeniden yazdı: archives alanı düştü.
    const strip = file => {
      const value = readJson(file);
      for (const item of value.companies) delete item.archives;
      writeFileSync(file, JSON.stringify(value, null, 2));
    };
    strip(path.join(data, "sirketler.json"));
    strip(path.join(data, "sirketler.yedek.json"));
    server = await start(dir);
    try {
      const other = server.app.companies.list().find(item => item.id !== ROOT_COMPANY_ID);
      assert.equal(archivesOf(server.app, ROOT_COMPANY_ID).length, 1, "eski sürümün düşürdüğü 001 arşivi yeniden tanındı");
      assert.equal(archivesOf(server.app, other.id).length, 1, "002 arşivi yeniden tanındı");
      assert.deepEqual((server.app.companies.orphanArchives?.() ?? []), []);
    } finally {
      await server.app.close();
    }
    // (3) yarım devir: 002'nin çalışma dosyasında devir kaydı yok (arşiv yazılmış, takas olmamış) → tanınmaz.
    strip(path.join(data, "sirketler.json"));
    strip(path.join(data, "sirketler.yedek.json"));
    const registry = readJson(path.join(data, "sirketler.json"));
    const otherEntry = registry.companies.find(item => item.id !== ROOT_COMPANY_ID);
    const otherFile = resolveDbPath(path.join(data, otherEntry.dir));
    const db = new DatabaseSync(otherFile);
    db.prepare("DELETE FROM settings WHERE key = ?").run(DEVIR_YEARS_KEY);
    db.close();
    server = await start(dir);
    try {
      assert.equal(archivesOf(server.app, otherEntry.id).length, 0, "yarım devrin arşivi kayda girmez (K yılı iki dosyada olmasın)");
      assert.equal(archivesOf(server.app, ROOT_COMPANY_ID).length, 1, "001 etkilenmez");
      const orphans = (server.app.companies.orphanArchives?.() ?? []);
      assert.equal(orphans.length, 1);
      assert.match(orphans[0].reason, /çalışma dosyasında bu yılın devri yok/);
      const admin = await loginAdmin(server);
      const view = await must("arşiv listesi", admin.get("/api/admin/devir/archives"));
      assert.equal(view.orphans.length, 1, "sahipsiz arşiv yöneticiye görünür");
      assert.ok(existsSync(path.join(path.dirname(otherFile), "arsiv", "2025", "destekofis.sqlite")), "sahipsiz arşivin dosyasına dokunulmadı");
    } finally {
      await server.close();
    }
  });

  // 2.5.0 D2 tur 2 (dar kontrol 06.11 DÜŞÜK-2, A2): diskten tanımanın "aynı devir çalışması" şartı sınanmıyordu (yaşayan mutant). Aynı yıl, FARKLI devir çalışması
  // (ör. devir geri alınıp yeniden yapılmış; klasördeki arşiv eski çalışmanın) tanınmaz — tanınsaydı yeni yılın açılışları eski arşivle eşleşmezdi.
  test("diskten tanıma: aynı yıl ama FARKLI devir çalışması (arşivin işareti ↔ çalışma dosyasının devir kaydı) tanınmaz, sahipsiz listesine girer; aynı çalışmanınki tanınır", async () => {
    const dir = workDir();
    let server = await start(dir);
    try {
      await loginAdmin(server);
      await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2023", runId: "devir-2023-a", register: false });
      await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2022", runId: "devir-2022-a", register: false });
      const years = JSON.parse(server.app.store.setting(DEVIR_YEARS_KEY, "[]"));
      server.app.store.setSetting(DEVIR_YEARS_KEY, JSON.stringify(years.map(item => (item.year === "2023" ? { ...item, runId: "devir-2023-b" } : item))));
    } finally {
      await server.app.close();
    }
    server = await start(dir);
    try {
      assert.deepEqual(archivesOf(server.app, ROOT_COMPANY_ID).map(item => [item.year, item.runId, item.recovered]), [["2022", "devir-2022-a", true]], "yalnız aynı devir çalışmasının arşivi tanındı");
      const orphans = server.app.companies.orphanArchives?.() ?? [];
      assert.deepEqual(orphans.map(item => [item.year, item.reason]), [["2023", "devir çalışması çalışma dosyasındakiyle aynı değil"]], "farklı çalışmanın arşivi sahipsiz");
      assert.ok(existsSync(path.join(archiveDirOf(server.dataDir, "2023"), "destekofis.sqlite")), "sahipsiz arşivin dosyasına dokunulmadı");
    } finally {
      await server.close();
    }
  });

  test("salt okunur açma (002 ve 001): arşivde HER yazma ucu 403 archive-read-only, GET'ler 5xx vermez, arşiv dosyası bayt bayt aynı; canlı şirket yazmaya devam eder; arşiv kapanınca canlı şirketin WhatsApp kuyruğu işçiden çıkmaz", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { admin, second, q } = await seed(server);
      for (const [companyId, query] of [[second.id, `hofCompany=${second.id}`], [ROOT_COMPANY_ID, `hofCompany=${ROOT_COMPANY_ID}`]]) {
        const made = await makeArchive(server.app, companyId, { year: "2025" });
        const archiveQuery = `${query}&hofArchive=2025`;
        const liveBefore = (await must("canlı okuma", admin.get(`/api/workspace/cash?${query}`))).entries.length;
        const sample = await admin.post(`/api/workspace/cash?${archiveQuery}`, { kind: "in", amount: 1, date: "2025-12-01", description: "arşive yazma denemesi" });
        assert.equal(sample.status, 403, `arşive yazma 403 olmalı (gelen ${sample.status} ${sample.data?.code || ""})`);
        assert.equal((await must("canlı okuma", admin.get(`/api/workspace/cash?${query}`))).entries.length, liveBefore, "arşive yazma denemesi canlı şirkete de yazmadı");
        await must("arşiv okuma", admin.get(`/api/workspace/cash?${archiveQuery}`));
        const archive = openArchives(server.app).find(key => key.startsWith(`${companyId}@`));
        assert.ok(archive, "arşiv örneği açıldı");
        let count = 0;
        const bad = [];
        for (const route of writeRoutes().routes) {
          if (HUB_ONLY.test(route.path)) continue;
          count += 1;
          const response = await admin.raw(route.method, `${route.path}${route.path.includes("?") ? "&" : "?"}${archiveQuery}`, { body: "{}", headers: { "content-type": "application/json" } });
          if (response.status !== 403 || response.data?.code !== "archive-read-only") bad.push(`${route.method} ${route.route} → ${response.status} ${response.data?.code || ""}`);
        }
        assert.ok(count > 150, `yazma uçları ${count}`);
        assert.deepEqual(bad, [], `arşivde yazma uçları 403 olmalı:\n${bad.join("\n")}`);
        const failures = [];
        for (const route of getRoutes()) {
          const response = await admin.raw("GET", `${route}?${archiveQuery}`);
          if (response.status >= 500) failures.push(`${route} → ${response.status} ${response.data?.error || ""}`);
        }
        assert.deepEqual(failures, [], `arşivde GET uçları 5xx vermemeli:\n${failures.join("\n")}`);
        assert.equal(await hashFile(made.file), made.sha256, "arşiv dosyası bayt bayt aynı (salt okunur bağlantı, göç yok)");
        assert.deepEqual(readdirSync(made.dir).filter(name => /-wal$|-shm$|-journal$/.test(name)), [], "arşivin yanında günlük dosyası oluşmadı");
        await must("canlı şirket yazar", admin.post(`/api/workspace/cash?${query}`, { kind: "in", amount: 3, date: "2026-11-02", description: "canlı" }));
      }
      // Arşiv örneği kapanırken canlı 002'nin WhatsApp kuyruğu işçiden çıkarılmaz (aynı şirket kimliği).
      const removed = [];
      const scheduler = server.app.whatsapp.scheduler;
      const original = scheduler.unregister;
      scheduler.unregister = key => (removed.push(key), original(key));
      try {
        assert.equal(await server.app.closeArchives(second.id), 1);
      } finally {
        scheduler.unregister = original;
      }
      assert.deepEqual(removed, [], "arşiv kapanışı canlı şirketin kuyruğunu işçiden çıkarmadı");
      await must("002 sürer", admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 2, date: "2026-11-02", description: "sonra" }));
    } finally {
      await server.close();
    }
  });

  test("bütünlük: değişmiş arşiv (son şema) uyarıyla salt okunur açılır, değişmiş + eski şema 409 archive-changed (göç edilmez), dosyası silinmiş arşiv 503 archive-missing; liste durumları", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { admin, second, q } = await seed(server);
      const changed = await makeArchive(server.app, second.id, { year: "2024" });
      appendFileSync(changed.file, Buffer.alloc(4096));
      const opened = await must("değişmiş arşiv okunur", admin.get(`/api/workspace/cash${q}&hofArchive=2024`));
      assert.ok(Array.isArray(opened.entries));
      const child = openArchives(server.app).find(key => key.endsWith("arsiv-2024"));
      assert.ok(child);
      const verified = await must("doğrula", admin.post("/api/admin/devir/archives/verify", { company: second.id, year: "2024" }));
      assert.equal(verified.state, "changed");
      const old = await makeArchive(server.app, second.id, { year: "2023" });
      const tamper = new DatabaseSync(old.file);
      tamper.exec(`PRAGMA user_version = ${LATEST_VERSION - 1}`);
      tamper.close();
      const refused = await admin.get(`/api/workspace/cash${q}&hofArchive=2023`);
      assert.equal(refused.status, 409, JSON.stringify(refused.data));
      assert.equal(refused.data.code, "archive-changed");
      assert.equal(schemaOf(old.file), LATEST_VERSION - 1, "değişmiş arşiv göç ettirilmedi");
      const missing = await makeArchive(server.app, second.id, { year: "2022" });
      rmSync(missing.file);
      const gone = await admin.get(`/api/workspace/cash${q}&hofArchive=2022`);
      assert.equal(gone.status, 503);
      assert.equal(gone.data.code, "archive-missing");
      const none = await admin.get(`/api/workspace/cash${q}&hofArchive=2019`);
      assert.equal(none.status, 404);
      assert.equal(none.data.code, "archive-not-found");
      assert.equal((await admin.get(`/api/workspace/cash${q}&hofArchive=20x5`)).status, 400);
      const view = await must("liste", admin.get("/api/admin/devir/archives"));
      const states = Object.fromEntries(view.archives.filter(item => item.companyId === second.id).map(item => [item.year, item.status]));
      assert.deepEqual(states, { 2022: "missing", 2023: "changed", 2024: "changed" }, "açma denemesi bütünlüğü denetledi: 2023 de değişmiş görünür");
    } finally {
      await server.close();
    }
  });

  test("arşivin göçü: GERÇEK v2.0.26 koduyla üretilmiş eski şemalı arşiv ilk açılışta son şemaya taşınır (göç öncesi kopya kalır, kayıt özeti güncellenir, veri aynı); iki eşzamanlı istek tek göç; daha yeni şemalı arşiv göç edilmez, salt okunur açılır", async () => {
    const dir = workDir();
    const fixture = unpackFixture("surum-2.0.26-zincir", { root: path.join(dir, "fikstur") });
    const server = await start(path.join(dir, "kurulum"));
    try {
      const admin = await loginAdmin(server);
      const archiveDir = archiveDirOf(server.dataDir, "2025");
      mkdirSync(archiveDir, { recursive: true });
      const file = path.join(archiveDir, "destekofis.sqlite");
      copyFileSync(resolveDbPath(fixture.dataDir), file);
      const oldSchema = schemaOf(file);
      assert.ok(oldSchema < LATEST_VERSION, `fikstür eski şemada (${oldSchema})`);
      writeSettingRaw(file, ARCHIVE_MARK_KEY, JSON.stringify({ companyId: ROOT_COMPANY_ID, year: "2025", cutoff: "2025-12-31", runId: "devir-2025-eski" }));
      const db = new DatabaseSync(file);
      db.exec("PRAGMA journal_mode = DELETE");
      db.close();
      const expected = cashCount(file);
      // İkiz: aynı dosya canlı şirket gibi (runMigrations) göç ettirilir — arşiv yolundaki göç verisi bununla AYNI olmalı.
      const twin = path.join(dir, "ikiz.sqlite");
      copyFileSync(file, twin);
      const sha = await hashFile(file);
      server.app.companies.addArchive?.(ROOT_COMPANY_ID, { year: "2025", cutoff: "2025-12-31", runId: "devir-2025-eski", sha256: sha, schemaVersion: oldSchema });
      const [a, b] = await Promise.all([admin.get("/api/workspace/cash?hofArchive=2025"), admin.get("/api/workspace/cash?hofArchive=2025")]);
      assert.equal(a.status, 200, JSON.stringify(a.data).slice(0, 300));
      assert.equal(b.status, 200);
      assert.equal(schemaOf(file), LATEST_VERSION, "arşiv son şemaya taşındı");
      const entry = archiveOf(server.app, ROOT_COMPANY_ID, "2025");
      assert.equal(entry.migratedFrom, oldSchema);
      assert.equal(entry.previousSha256, sha);
      assert.equal(entry.sha256, await hashFile(file), "kayıttaki özet göçten sonraki dosyanınki");
      assert.deepEqual(readdirSync(archiveDir).filter(name => name.startsWith("goc-oncesi-v")), [`goc-oncesi-v${oldSchema}.sqlite`], "tek göç öncesi kopya (iki eşzamanlı istek tek göç)");
      assert.equal(await hashFile(path.join(archiveDir, `goc-oncesi-v${oldSchema}.sqlite`)), sha, "göç öncesi kopya göçten önceki dosyayla aynı");
      assert.deepEqual(readdirSync(archiveDir).filter(name => /-wal$|-shm$/.test(name)), [], "göçten sonra günlük kipi DELETE");
      assert.equal(cashCount(file), expected, "veri aynı (kasa satırları)");
      const twinDb = openDatabase(twin);
      runMigrations(createStore(twinDb), { backupDir: null, company: { id: ROOT_COMPANY_ID, code: "001", name: server.app.companies.get(ROOT_COMPANY_ID).name }, now: server.clock });
      twinDb.close();
      // Tek ayrım: göç 47'nin bekleyen dondurma koşusunun rastgele kimliği (ledger_snapshot_runs.id) — koşunun kendisi (tür, durum, kapsam, kural) aynı olmalı.
      const differs = diffKeys(fingerprint(file), fingerprint(twin)).filter(key => key !== "ledger_snapshot_runs");
      assert.deepEqual(differs, [], `arşiv yolundaki göç, aynı dosyanın canlı şirket göçüyle aynı veri (fark: ${differs.join(", ")})`);
      const runsOf = target => {
        const handle = new DatabaseSync(target, { readOnly: true });
        try {
          return handle.prepare("SELECT no, kind, state, from_date, through, rule_version, reason FROM ledger_snapshot_runs ORDER BY no").all().map(row => ({ ...row }));
        } finally {
          handle.close();
        }
      };
      assert.deepEqual(runsOf(file), runsOf(twin), "göç 47'nin koşu kaydı iki yolda aynı (kimlik dışında)");
      assert.ok(unwrap(a).entries.length >= expected, "arşiv ekranı kasa satırlarını gösterir");
      assert.equal((await admin.post("/api/workspace/cash?hofArchive=2025", { kind: "in", amount: 1, date: "2025-12-01", description: "x" })).status, 403);
      // Daha yeni şemalı arşiv (BS-7 kapısı arşive de): göç edilmez, salt okunur.
      const ahead = await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2026" });
      const raw = new DatabaseSync(ahead.file);
      raw.exec(`PRAGMA user_version = ${LATEST_VERSION + 1}`);
      raw.close();
      server.app.companies.updateArchive?.(ROOT_COMPANY_ID, "2026", { sha256: await hashFile(ahead.file) });
      await must("yeni şemalı arşiv okunur", admin.get("/api/workspace/cash?hofArchive=2026"));
      assert.equal(schemaOf(ahead.file), LATEST_VERSION + 1, "göç edilmedi");
      const key = openArchives(server.app).find(item => item.endsWith("arsiv-2026"));
      assert.ok(key);
      const written = await admin.post("/api/workspace/cash?hofArchive=2026", { kind: "in", amount: 1, date: "2025-12-01", description: "x" });
      assert.equal(written.status, 403);
      assert.equal(written.data.archive.schemaAhead, true, "arşiv kapısı şema kapısını da bildirir");
    } finally {
      await server.close();
      fixture.cleanup();
    }
  });

  test("ortak katmanın arka plan işleri arşivi görmez: otomatik yedek hedefleri yalnız şirketler, zamanlayıcı turu arşivi açmaz / değiştirmez (güncellemenin deneme açılışında arşiv göç etmez — BS-7 Y5)", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { second } = await seed(server);
      const made = [await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2025" }), await makeArchive(server.app, second.id, { year: "2025" })];
      const targets = server.app.backups.scheduleTargets();
      assert.equal(targets.length, 2, "iki şirket, arşiv hedefi yok");
      assert.ok(targets.every(item => !item.backupDir.includes(`${path.sep}arsiv${path.sep}`)));
      const done = server.app.runDueBackups();
      assert.equal(done.length, 2);
      assert.deepEqual(openArchives(server.app), [], "zamanlayıcı arşiv örneği açmadı");
      for (const item of made) assert.equal(await hashFile(item.file), item.sha256, "arşiv dosyası değişmedi");
      assert.equal(server.app.backups.list({ role: "admin" }).filter(item => item.dir.includes(`${path.sep}arsiv${path.sep}`)).length, 0, "Yedekler listesinde arşiv yok");
    } finally {
      await server.close();
    }
  });

  test("şirket kapanınca (geri yükleme / silme / Ayır yolu) o şirketin arşiv örnekleri de kapanır; öbür şirketinki açık kalır", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const { admin, second, q } = await seed(server);
      await makeArchive(server.app, second.id, { year: "2025" });
      await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2025" });
      await must("002 arşivi", admin.get(`/api/workspace/cash${q}&hofArchive=2025`));
      await must("001 arşivi", admin.get("/api/workspace/cash?hofArchive=2025"));
      assert.equal(openArchives(server.app).length, 2);
      await server.app.context.closeCompany(second.id);
      assert.deepEqual(openArchives(server.app), [`${ROOT_COMPANY_ID}@arsiv-2025`], "yalnız 002'nin arşivi kapandı");
      assert.ok(!server.app.openCompanyIds().includes(second.id));
    } finally {
      await server.close();
    }
  });
});
