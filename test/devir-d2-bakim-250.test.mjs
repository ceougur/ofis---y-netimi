// 2.5.0 D2 — BAKIM KİPİ (docs/devir/D2-ALTYAPI-TASARIM.md §5, §10; DEVIR-PLANI G1.1, G10.10 / G10.17).
// Nasıl bozulur (testler buradan): 001 bakımda (ortak katman aynı dosyada) / 002 bakımda (001 çalışmalı); bakımda her yazma ucu; bakımda GET'te yazan yol (tekrarlayan
// fatura taslağı); bakımda açılan şirket örneği; arka plan işleri (otomatik yedek, WhatsApp işçisi, Sheets, mutabakat taraması); güncelleme kurulumu (kendiliğinden,
// ertelenmiş, Şimdi Güncelle, indirme sürerken kip açılması, tutma süresinin dolması); bakım açıkken süreç ölümü.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { createUpdateOrchestrator } from "../server/lib/update-orchestrator.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { ARCHIVE_MARK_KEY, ARCHIVE_SIDECAR, DEVIR_BACKUP_DIR, DEVIR_BACKUP_MANIFEST, DEVIR_YEARS_KEY, HUB_BLOCKED, HUB_ONLY, MAINTENANCE_MARKER, MIGRATION_WORK_FILE, companyDbFile, diffKeys, fingerprint, getRoutes, hashFile, makeArchive, placeLegacyArchive, schemaOf, writeRoutes } from "./devir-d2-yardimci.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOW = "2026-11-02T10:00:00+03:00";
const COMMON = ["users", "roles", "sessions", "mobile_access", "mobile_codes", "mobile_devices", "mobile_sessions"];
const roots = [];
after(() => {
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d2-bakim-"));
  roots.push(dir);
  return dir;
};
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const must = async (label, promise, status = 200) => {
  const response = await promise;
  assert.equal(response.status, status, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return unwrap(response);
};

async function seed(server) {
  const admin = await loginAdmin(server);
  const customer = await must("cari", admin.post("/api/workspace/accounts", { name: "Bakım Carisi", type: "customer" }));
  await must("kasa", admin.post("/api/workspace/cash", { kind: "in", amount: 100, date: "2026-11-02", description: "001 girişi" }));
  // GET'te yazan yolun ön koşulu (ders 20): tekrarlayan fatura — ilk tekrar 10 gün sonra; saat ilerletilince fatura listesi (GET) taslak yazmak ister.
  const invoice = await must("fatura", admin.post("/api/workspace/invoices", { kind: "sale", accountId: customer.id, issueDate: "2026-11-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: "2026-11-30" }, force: true }));
  await must("tekrar", admin.post(`/api/workspace/invoices/${invoice.id}/repeat`, { everyMonths: 1, nextDate: "2026-11-12" }));
  const second = (await must("002", admin.post("/api/companies", { name: "Bakım İkinci" }))).company;
  const q = `?hofCompany=${second.id}`;
  await must("002 kasa", admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 70, date: "2026-11-02", description: "002 girişi" }));
  const customer2 = await must("002 cari", admin.post(`/api/workspace/accounts${q}`, { name: "İkinci Cari", type: "customer" }));
  const invoice2 = await must("002 fatura", admin.post(`/api/workspace/invoices${q}`, { kind: "sale", accountId: customer2.id, issueDate: "2026-11-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: "2026-11-30" }, force: true }));
  await must("002 tekrar", admin.post(`/api/workspace/invoices/${invoice2.id}/repeat${q}`, { everyMonths: 1, nextDate: "2026-11-12" }));
  return { admin, second, q };
}
// Yazma ucu taraması: her uç için yanıt; beklenen 503 + code maintenance olmayanlar döner.
async function sweepWrites(client, { query = "", only = () => true, expect }) {
  const bad = [];
  let count = 0;
  for (const route of writeRoutes().routes) {
    if (!only(route)) continue;
    count += 1;
    const sep = route.path.includes("?") ? "&" : "?";
    const response = await client.raw(route.method, `${route.path}${query ? `${sep}${query}` : ""}`, { body: "{}", headers: { "content-type": "application/json" } });
    const problem = expect(response, route);
    if (problem) bad.push(`${route.method} ${route.route} (${route.file}) → ${response.status} ${response.data?.code || ""} ${problem}`);
  }
  return { count, bad };
}
const isMaintenance = response => (response.status === 503 && response.data?.code === "maintenance" ? "" : "bakım kipi 503 değil");
// Bakımda 503 dönmesi BİLİNEN okuma uçları (veri değişmez; nedenleri tasarım notu §5.5): yalnız bunlar, yalnız 503 (500 hiçbir uçta kabul değil).
//   app-webhook: 2.5.0 WE ilk GET'te Elle Bağla webhook çiftini 001'in ayarına yazar; bu taban kodda anahtar ortak katman (COMMON_SETTINGS) dışında → 001 bakımda yazamaz,
//   uç kendi "hazırlanamadı" 503'ünü verir. WE + BS-7 düzeltmesi (anahtar ortak katmana) birleşince 200 döner; liste o zaman da geçerli (fazla izin, eksik değil).
const KNOWN_503 = new Set(["/api/workspace/whatsapp/app-webhook"]);
async function sweepGets(client, query) {
  const failures = [];
  for (const route of getRoutes()) {
    const response = await client.raw("GET", `${route}?${query}`);
    if (response.status >= 500 && !(response.status === 503 && KNOWN_503.has(route))) failures.push(`${route} → ${response.status} ${response.data?.error || ""}`);
  }
  return failures;
}

describe("D2 bakım kipi (G1.1)", () => {
  test("tarama tam: kaynaktaki her router.post/put/patch/delete kaydı çözüldü; HUB_ONLY ifadesi sunucudakiyle aynı", () => {
    const { routes, registrations } = writeRoutes();
    assert.equal(routes.length, registrations, `çözülemeyen yazma kaydı var (${routes.length}/${registrations})`);
    assert.ok(routes.length > 200, `yazma uçları okunamadı (${routes.length})`);
    const source = readFileSync(new URL("../server/app.mjs", import.meta.url), "utf8");
    assert.ok(source.includes(`const HUB_ONLY = /${HUB_ONLY.source}/;`), "HUB_ONLY ifadesi sunucudakiyle aynı değil (yardımcıyı güncelleyin)");
    assert.ok(source.includes(`const MAINTENANCE_HUB_BLOCKED = /${HUB_BLOCKED.source}/;`), "MAINTENANCE_HUB_BLOCKED ifadesi sunucudakiyle aynı değil");
  });

  test("sözleşme sabitleri: test yardımcısının yerel değerleri programınkiyle aynı (işaret anahtarları, dosya adları)", async () => {
    const archives = await import("../server/lib/devir/archives.mjs");
    const maintenance = await import("../server/lib/devir/maintenance.mjs");
    const backups = await import("../server/lib/devir/devir-backups.mjs");
    assert.deepEqual(
      [archives.ARCHIVE_MARK_KEY, archives.DEVIR_YEARS_KEY, archives.ARCHIVE_SIDECAR, maintenance.MAINTENANCE_MARKER, backups.DEVIR_BACKUP_DIR, backups.DEVIR_BACKUP_MANIFEST],
      [ARCHIVE_MARK_KEY, DEVIR_YEARS_KEY, ARCHIVE_SIDECAR, MAINTENANCE_MARKER, DEVIR_BACKUP_DIR, DEVIR_BACKUP_MANIFEST],
    );
    assert.equal(archives.archiveDirOf("/v", "2025"), path.join("/v", "arsiv", "2025"));
  });

  test("001 bakımda: şirket yazma uçlarının HEPSİ 503, ortak katmanın şirket / yedek / güncelleme / devir yazmaları 503, giriş çalışır; GET'ler 001'in verisini değiştirmez (GET'te yazan yol dahil); kip kalkınca yazılır", async () => {
    const dir = workDir();
    const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
    try {
      const { admin } = await seed(server);
      server.clock.set("2026-11-20T10:00:00+03:00"); // tekrar artık günü gelmiş (GET'te yazan yolun ön koşulu)
      const file = companyDbFile(server.app, ROOT_COMPANY_ID);
      await server.app.maintenance.enter(ROOT_COMPANY_ID, { reason: "devir", runId: "t-001", label: "001 · Test" });
      assert.ok(server.app.store.get("SELECT COUNT(*) AS n FROM sqlite_temp_master WHERE type = 'trigger' AND name LIKE 'destekofis_bakim_%'").n > 200, "001'in bağlantısında geçici koruma tetikleyicileri kuruldu");
      const before = fingerprint(file, { skip: COMMON, commonSettings: false });
      const company = await sweepWrites(admin, { only: route => !HUB_ONLY.test(route.path), expect: isMaintenance });
      assert.deepEqual(company.bad, [], `001 şirket yazma uçları (${company.count}) bakımda 503 olmalı:\n${company.bad.join("\n")}`);
      assert.ok(company.count > 150, `şirket yazma uçları ${company.count}`);
      const hubBlocked = await sweepWrites(admin, { only: route => HUB_BLOCKED.test(route.path), expect: isMaintenance });
      assert.deepEqual(hubBlocked.bad, [], `ortak katmanın kapalı yazmaları:\n${hubBlocked.bad.join("\n")}`);
      assert.ok(hubBlocked.count >= 10, `ortak katman kapalı uç sayısı ${hubBlocked.count}`);
      // Ortak katman açık: giriş (oturum tablosu ortak), şirket seçimi.
      const other = server.client();
      assert.equal((await other.login("admin", "Test-Admin-2026!")).status, 200, "bakımda giriş yapılabilmeli (ortak katman)");
      assert.equal((await admin.post("/api/companies/select", { id: ROOT_COMPANY_ID })).status, 200, "bakımda şirket seçimi");
      const gets = await sweepGets(admin, `hofCompany=${ROOT_COMPANY_ID}`);
      assert.deepEqual(gets, [], `bakımda GET uçları 5xx vermemeli:\n${gets.join("\n")}`);
      const afterSweep = fingerprint(file, { skip: COMMON, commonSettings: false });
      assert.deepEqual(diffKeys(before, afterSweep), [], "bakımda 001'in şirket verisi (ortak katman dışı tablolar ve ayarlar) değişmemeli");
      let blocked = "";
      try {
        server.app.store.run("UPDATE accounts SET name = name");
      } catch (error) {
        blocked = error.message;
      }
      assert.match(blocked, /DESTEKOFIS_BAKIM/, "gözden kaçan bir yazıcı da 001'in şirket tablosuna yazamaz");
      await server.app.maintenance.exit(ROOT_COMPANY_ID, { runId: "t-001" });
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM sqlite_temp_master WHERE type = 'trigger' AND name LIKE 'destekofis_bakim_%'").n, 0, "kip kalkınca tetikleyiciler kalkar");
      await must("kip kalkınca kasa", admin.post("/api/workspace/cash", { kind: "in", amount: 5, date: "2026-11-20", description: "sonra" }));
      // Ön koşul gerçekten vardı: kip kalkınca aynı GET taslağı yazar.
      const drafts = n => server.app.store.get("SELECT COUNT(*) AS n FROM invoices WHERE status = 'draft'").n + n;
      const draftsBefore = drafts(0);
      await must("fatura listesi", admin.get("/api/workspace/invoices"));
      assert.ok(drafts(0) > draftsBefore, `GET'te yazan yol bakımda gerçekten tetikleniyordu (taslak ${draftsBefore} → ${drafts(0)})`);
    } finally {
      await server.close();
    }
  });

  test("002 bakımda: 002 yazmaları 503, 001 yazar; 002 bağlantısı query_only (bakımda açılan örnek dahil); GET'ler 002'yi değiştirmez; ortak katmanın şirket / yedek yazmaları 503", async () => {
    const dir = workDir();
    const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
    try {
      const { admin, second, q } = await seed(server);
      server.clock.set("2026-11-20T10:00:00+03:00");
      const file = companyDbFile(server.app, second.id);
      await server.app.maintenance.enter(second.id, { reason: "devir", runId: "t-002", label: "002 · Test" });
      const child = server.app.openCompany(second.id);
      assert.ok(child, "002 açık örnek");
      assert.equal(child.db.prepare("PRAGMA query_only").get().query_only, 1, "açık 002 örneğinin bağlantısı query_only");
      const before = fingerprint(file);
      const company = await sweepWrites(admin, { query: `hofCompany=${second.id}`, only: route => !HUB_ONLY.test(route.path), expect: isMaintenance });
      assert.deepEqual(company.bad, [], `002 yazma uçları bakımda 503 olmalı:\n${company.bad.join("\n")}`);
      const hubBlocked = await sweepWrites(admin, { only: route => HUB_BLOCKED.test(route.path), expect: isMaintenance });
      assert.deepEqual(hubBlocked.bad, [], `ortak katmanın kapalı yazmaları (002 bakımda):\n${hubBlocked.bad.join("\n")}`);
      await must("001 bakımda değil: kasa", admin.post("/api/workspace/cash", { kind: "in", amount: 9, date: "2026-11-20", description: "001 sürer" }));
      const gets = await sweepGets(admin, `hofCompany=${second.id}`);
      assert.deepEqual(gets, [], `bakımda 002 GET uçları 5xx vermemeli:\n${gets.join("\n")}`);
      // Bakım sürerken örnek kapanır, ilk istekte yeniden açılır: yeni bağlantı da query_only.
      await server.app.context.closeCompany(second.id);
      await must("002 okuma (yeniden açılış)", admin.get(`/api/workspace/cash${q}`));
      assert.equal(server.app.openCompany(second.id).db.prepare("PRAGMA query_only").get().query_only, 1, "bakımda açılan 002 örneği de query_only");
      assert.deepEqual(diffKeys(before, fingerprint(file)), [], "bakımda 002'nin dosyası değişmemeli (GET'te yazan yol dahil)");
      await server.app.maintenance.exit(second.id);
      assert.equal(server.app.openCompany(second.id).db.prepare("PRAGMA query_only").get().query_only, 0, "kip kalkınca query_only kalkar");
      await must("kip kalkınca 002 kasa", admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 4, date: "2026-11-20", description: "002 sonra" }));
    } finally {
      await server.close();
    }
  });

  test("arka plan yazıcıları bakımdaki şirkette durur, öbür şirkette sürer (canWriteInBackground, WhatsApp işçisi, otomatik yedek)", async () => {
    const dir = workDir();
    const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
    try {
      const { second, q, admin } = await seed(server);
      await must("002 açık", admin.get(`/api/workspace/cash${q}`));
      const root = server.app;
      const child = root.openCompany(second.id);
      const codesOf = results => results.map(item => /destekofis-(\d{3})-/.exec(item.name)?.[1]).sort();
      for (const [inside, outside, label] of [[root, child, "001"], [child, root, "002"]]) {
        await root.maintenance.enter(inside.companyId, { reason: "devir", runId: `bg-${label}` });
        assert.equal(inside.context.canWriteInBackground(), false, `${label} bakımda: arka plan yazamaz`);
        assert.equal(outside.context.canWriteInBackground(), true, `${label} bakımda: öbür şirket yazabilir`);
        assert.equal(inside.context.writeLock.isMarked(inside.companyId), true, `${label}: WhatsApp işçisi şirketi kilitli görür`);
        assert.equal(inside.context.writeLock.guard(inside.companyId, inside.store), false, `${label}: işçinin sınaması geçmez`);
        assert.equal(inside.context.writeLock.isMarked("whatsapp-gonderim-defteri"), false, `${label}: makine defterinin anahtarı etkilenmez`);
        if (inside.context.whatsapp?.queue) assert.equal(inside.context.whatsapp.queue.canWrite(), false, `${label}: WhatsApp kuyruğu bu turda yürümez`);
        const targets = root.backups.scheduleTargets().map(item => item.label);
        assert.ok(!targets.some(item => item.startsWith(`${label} ·`)), `${label} bakımda: otomatik yedek hedefi değil (${targets.join(", ")})`);
        const due = root.runDueBackups();
        assert.ok(!codesOf(due).includes(label), `${label} bakımda: zamanlayıcı turu yedeklemez (${codesOf(due).join(", ")})`);
        await root.maintenance.exit(inside.companyId);
        assert.equal(inside.context.canWriteInBackground(), true, `${label}: kip kalkınca arka plan yazabilir`);
      }
    } finally {
      await server.close();
    }
  });

  test("güncelleme tutması (uygulama): kip açılırken update:hold istenir, kapanınca bırakılır; güncelleme geçişteyse kip açılmaz; güncelleyici yoksa sürer; ulaşılamazsa açılmaz", async () => {
    const calls = [];
    let reply = () => ({ held: [], switching: false });
    const link = { supervised: true, request: async (action, payload) => (calls.push({ action, ...payload }), reply(action, payload)) };
    const dir = workDir();
    const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), supervisorLink: link });
    try {
      const m = server.app.maintenance;
      const entry = await m.enter(ROOT_COMPANY_ID, { reason: "devir", runId: "h1" });
      assert.equal(entry.updateHold, true);
      assert.deepEqual(calls.map(item => [item.action, item.key, item.on]), [["update:hold", ROOT_COMPANY_ID, true]]);
      assert.ok(calls[0].ttlMs >= 60_000, "tutma süreli");
      await m.exit(ROOT_COMPANY_ID);
      assert.deepEqual(calls.at(-1), { action: "update:hold", key: ROOT_COMPANY_ID, on: false, ttlMs: calls[0].ttlMs });
      reply = (action, payload) => ({ held: payload.on ? [payload.key] : [], switching: Boolean(payload.on) });
      await assert.rejects(m.enter(ROOT_COMPANY_ID, { reason: "devir" }), error => error.status === 503 && error.extra?.code === "update-switching");
      assert.equal(m.has(ROOT_COMPANY_ID), false, "güncelleme geçişteyken kip açılmadı");
      assert.equal(calls.at(-1).on, false, "istenen tutma geri bırakıldı");
      reply = () => {
        throw Object.assign(new Error("Otomatik güncelleme bu kurulumda kapatılmış."), { code: "UPDATES_DISABLED" });
      };
      assert.equal((await m.enter(ROOT_COMPANY_ID, { reason: "devir" })).updateHold, false, "güncelleyici yoksa kip açılır (tutulacak bir şey yok)");
      await m.exit(ROOT_COMPANY_ID);
      reply = () => {
        throw Object.assign(new Error("Servis yöneticisi zamanında yanıt vermedi."), { code: null });
      };
      await assert.rejects(m.enter(ROOT_COMPANY_ID, { reason: "devir" }), error => error.status === 503 && error.extra?.code === "update-hold-failed");
      assert.equal(m.has(ROOT_COMPANY_ID), false);
    } finally {
      await server.close();
    }
  });

  test("güncelleme orkestratörü: tutma varken kendiliğinden kurmaz, Şimdi Güncelle reddedilir; indirme sürerken tutma gelirse eski sürüm durdurulmaz; geçiş adımında tutma 'switching' döner; tutma kalkınca / süresi dolunca kurar", async t => {
    const found = { status: "available", version: "9.0.1", manifest: { package: { size: 10 } }, retryable: false };
    let gate = null;
    const updater = {
      config: () => ({ enabled: true, channel: "stable", feed: "github:test/repo" }),
      state: () => ({ lastCheck: null, failed: {}, history: [] }),
      check: async () => found,
      download: async () => {
        if (gate) await gate.promise;
        return "/tmp/paket.zip";
      },
      stage: () => "/tmp/yeni",
      addHistory() {},
      activate() {},
    };
    let stops = 0;
    let stopGate = null;
    const controller = {
      appVersion: () => "9.0.0",
      appDir: () => "/x",
      busy: () => false,
      isRunning: () => true,
      stopping: () => false,
      async waitReady() {},
      async start() {},
      async stop() {
        stops += 1;
        if (stopGate) await stopGate.promise;
      },
      schemaVersion: () => 47,
      backupDatabase() {
        throw new Error("test: yedek yok (kurulum burada biter)");
      },
      release() {},
      setAppDir() {},
      setPhase() {},
    };
    const quiet = { info() {}, warn() {}, error() {} };
    const orchestrator = createUpdateOrchestrator({ updater, controller, appsDir: path.join(tmpdir(), "d2-yok"), runningVersion: "9.0.0", log: quiet, quietTime: () => true, deferRecheckMs: 60_000, periodicCheckMs: 0, retryDelays: [], applyDelayMs: 0 });
    try {
      assert.deepEqual(await orchestrator.handle("hold", { key: "sirket-001", on: true, ttlMs: 60_000 }), { held: ["sirket-001"], switching: false });
      await orchestrator.runCheck({ auto: true });
      await orchestrator.idle();
      assert.equal(stops, 0, "tutma varken mesai dışında / boşta bile kurulmaz");
      assert.equal(orchestrator.status().deferred?.version, "9.0.1", "ertelendi");
      await assert.rejects(orchestrator.handle("apply", {}), error => error.code === "MAINTENANCE");
      await orchestrator.handle("hold", { key: "sirket-001", on: false });
      // İndirme sürerken tutma gelir → kurulum eski sürümü durdurmadan bırakılır.
      let release;
      gate = { promise: new Promise(resolve => (release = resolve)) };
      const job = orchestrator.install(found);
      await orchestrator.handle("hold", { key: "sirket-002", on: true, ttlMs: 60_000 });
      release();
      await job;
      assert.equal(stops, 0, "indirme sırasında başlayan bakım: eski sürüm durdurulmadı");
      assert.equal(orchestrator.status().lastResult?.outcome, "held");
      gate = null;
      // Tutma süresi dolar (uygulama öldü, yenilemedi): kurulum yeniden mümkün.
      t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
      t.mock.timers.tick(61_000);
      let releaseStop;
      stopGate = { promise: new Promise(resolve => (releaseStop = resolve)) };
      const second = orchestrator.install(found);
      while (stops === 0) await new Promise(resolve => setImmediate(resolve));
      assert.equal((await orchestrator.handle("hold", { key: "sirket-001", on: true, ttlMs: 60_000 })).switching, true, "geçiş adımındayken tutma 'switching' döner (uygulama kipi açmaz)");
      await orchestrator.handle("hold", { key: "sirket-001", on: false });
      releaseStop();
      await second;
      assert.equal(stops, 1, "süresi dolan tutma kurulumu engellemez");
      t.mock.timers.reset();
    } finally {
      orchestrator.stop();
    }
  });

  test("yarıda kesilme: bakım kipi açıkken süreç ölür → açılışta kip YOK (canlı veri aynı), önceki çalışmanın izi lastAborted'da, işaret dosyası silinir, geçici tetikleyici kalmaz", async () => {
    const dir = workDir();
    const dataDir = path.join(dir, "data");
    const backupDir = path.join(dir, "backups");
    let server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true } });
    const { second } = await seed(server);
    const files = [companyDbFile(server.app, ROOT_COMPANY_ID), companyDbFile(server.app, second.id)];
    await server.app.close();
    const before = files.map(file => fingerprint(file, { skip: COMMON, commonSettings: false }));
    const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(HERE, "fixtures", "devir-d2-bakim-isci.mjs"), dataDir, backupDir, `${ROOT_COMPANY_ID},${second.id}`], { env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stderr.on("data", chunk => (err += chunk));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`işçi HAZIR demedi: ${out} ${err}`)), 60_000);
      child.stdout.on("data", chunk => {
        out += chunk;
        if (out.includes("HAZIR")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("exit", code => reject(new Error(`işçi erken çıktı (${code}): ${err}`)));
    });
    assert.ok(existsSync(path.join(dataDir, MAINTENANCE_MARKER)), "kip açıkken işaret dosyası var");
    // Kip açıkken dosyaların hâli (işçinin açılış yazımları — oturum temizliği, açılış izi — kipten ÖNCE; WAL okuyucusu eşzamanlı okur).
    const during = files.map(file => fingerprint(file, { skip: COMMON, commonSettings: false }));
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGKILL");
    await exited;
    // Ölümden hemen sonra (yeniden açılıştan önce): kip açıkken hiçbir şey yazılmamış, ölüm yarım yazım bırakmamış.
    assert.deepEqual(files.map(file => fingerprint(file, { skip: COMMON, commonSettings: false })).map((print, index) => diffKeys(during[index], print)), [[], []], "kip açıkken / ölümde canlı dosyalar değişmedi");
    server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true } });
    try {
      const status = server.app.maintenance.status();
      assert.deepEqual(status.active, [], "süreç ölünce kip kalkar (yeniden açılmaz)");
      assert.deepEqual(status.lastAborted?.entries.map(item => item.companyId).sort(), [ROOT_COMPANY_ID, second.id].sort(), "yarıda kalan kip bilgi olarak görünür");
      assert.equal(existsSync(path.join(dataDir, MAINTENANCE_MARKER)), false, "işaret dosyası silindi");
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM sqlite_temp_master WHERE type = 'trigger'").n, 0, "geçici tetikleyici kalmadı");
      const admin = await loginAdmin(server);
      const view = await must("bakım durumu", admin.get("/api/admin/maintenance"));
      assert.equal(view.lastAborted.entries.length, 2);
      // İş verisi (açılışların kendi izleri — audit_events, integrity_log, ayarlar — dışında) devir öncesiyle aynı.
      const business = print => Object.fromEntries(Object.entries(print).filter(([key]) => !["audit_events", "integrity_log", "settings", "request_keys"].includes(key)));
      assert.deepEqual(files.map(file => business(fingerprint(file, { skip: COMMON, commonSettings: false }))).map((print, index) => diffKeys(business(before[index]), print)), [[], []], "canlı iş verisi devir öncesiyle aynı");
      await must("001 yazar", admin.post("/api/workspace/cash", { kind: "in", amount: 1, date: "2026-11-02", description: "ölümden sonra" }));
      await must("002 yazar", admin.post(`/api/workspace/cash?hofCompany=${second.id}`, { kind: "in", amount: 1, date: "2026-11-02", description: "ölümden sonra" }));
    } finally {
      await server.close();
    }
  });

  // 2.5.0 D2 tur 2 (dar kontrol 06.11 ORTA-2): openArchive yalnız busyCompanies'e bakıyordu — 001 bakımdayken eski şemalı arşiv istenince 200, arşiv 19 → 47 göç etti, kayıt
  // yazıldı; 002 bakımdayken arşiv açıldı, closeCompany kapattı, sıradaki istek yeniden açtı (G1.1 güvencesi arşiv dosyası / kaydı için tutmuyordu; Windows'ta açık tutamak
  // D4'ün arsiv/silinen taşımasını düşürür — ders 48). Eski şemalı arşiv GERÇEK v2.0.26 fikstüründen (ders 17).
  test("bakımdaki şirketin arşivi açılmaz (503 maintenance): 001 bakımda eski şemalı arşiv istenince dosya / klasör / kayıt değişmez; açılış sürerken kip açılırsa (özet alınırken, göç kopyası hazırken) iş durur; 002 bakımda açık arşiv örneğine de istek gitmez, closeCompany sonrası yeniden açılmaz; öbür şirketin arşivi açılır; kip kalkınca açılır", async () => {
    const dir = workDir();
    const fixture = unpackFixture("surum-2.0.26-zincir", { root: path.join(dir, "fikstur") });
    const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
    try {
      const admin = await loginAdmin(server);
      const second = (await must("002", admin.post("/api/companies", { name: "Arşiv Bakım İkinci" }))).company;
      const q = `hofCompany=${second.id}`;
      await must("002 kasa", admin.post(`/api/workspace/cash?${q}`, { kind: "in", amount: 70, date: "2026-11-02", description: "002 girişi" }));
      const legacy = await placeLegacyArchive(server.app, ROOT_COMPANY_ID, { source: resolveDbPath(fixture.dataDir), year: "2024" });
      assert.ok(legacy.schemaVersion < LATEST_VERSION, `fikstür eski şemada (${legacy.schemaVersion})`);
      const openIds = () => server.app.openArchiveIds?.() ?? [];
      const state = async () => ({ sha256: await hashFile(legacy.file), schema: schemaOf(legacy.file), entry: JSON.stringify(server.app.companies.archiveOf?.(ROOT_COMPANY_ID, "2024") ?? null), files: readdirSync(legacy.dir).sort() });
      const before = await state();
      const refusedWith = (response, label) => {
        assert.deepEqual([response.status, response.data?.code], [503, "maintenance"], `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 240)}`);
        assert.match(response.data.error, /şirketinde .* bu sırada şirketin \d{4} arşivi açılamaz\. Birkaç dakika sonra yeniden deneyin\.$/, `${label}: Türkçe ileti`);
        assert.equal(response.headers.get("retry-after"), "30", `${label}: retry-after`);
      };
      // (1) 001 bakımda: istek reddedilir, arşivin göçü YAPILMAZ.
      await server.app.maintenance.enter(ROOT_COMPANY_ID, { reason: "devri-yenile", runId: "a-1", label: "001 · Arşiv" });
      refusedWith(await admin.get("/api/workspace/cash?hofArchive=2024"), "001 bakımda 001 arşivi");
      assert.deepEqual(await state(), before, "001 bakımda arşiv dosyası, klasörü ve kaydı değişmedi (göç yok, göç öncesi kopya yok)");
      assert.deepEqual(openIds(), [], "arşiv örneği açılmadı");
      await server.app.maintenance.exit(ROOT_COMPANY_ID, { runId: "a-1" });
      const company = server.app.companies.get(ROOT_COMPANY_ID);
      // (2) açılış sürerken (arşivin özeti alınırken — ilk bekleme) kip açılır: iş durur, hiçbir şey yazılmaz.
      let settled = false;
      const first = server.app.openArchive(company, "2024").finally(() => (settled = true));
      await server.app.maintenance.enter(ROOT_COMPANY_ID, { reason: "devri-yenile", runId: "a-2", label: "001 · Arşiv" });
      assert.equal(settled, false, "ön koşul: kip, açılış sürerken açıldı (ders 20)");
      const firstError = await first.then(() => null, error => error);
      assert.deepEqual([firstError?.status, firstError?.extra?.code], [503, "maintenance"], `özet alınırken bakıma giren şirket: ${firstError?.message}`);
      assert.deepEqual(await state(), before, "özet alınırken bakıma giren şirkette arşiv dosyası, klasörü ve kaydı değişmedi");
      await server.app.maintenance.exit(ROOT_COMPANY_ID, { runId: "a-2" });
      // (3) göç çalışma kopyası hazırken (kopyanın özeti alınırken — ikinci bekleme) kip açılır: bekleyen özet yazılmaz, taşınmaz, kopya silinir.
      const work = path.join(legacy.dir, MIGRATION_WORK_FILE);
      settled = false;
      let sawWork = false;
      const second2 = server.app.openArchive(company, "2024").finally(() => (settled = true));
      await new Promise(resolve => {
        const tick = () => {
          if (existsSync(work)) {
            sawWork = true;
            resolve();
          } else if (settled) resolve();
          else setImmediate(tick);
        };
        setImmediate(tick);
      });
      assert.equal(sawWork, true, "ön koşul: göç çalışma kopyası hazırlanırken kip açılacak (ders 20)");
      await server.app.maintenance.enter(ROOT_COMPANY_ID, { reason: "devri-yenile", runId: "a-3", label: "001 · Arşiv" });
      assert.equal(settled, false, "ön koşul: kip, göç sürerken açıldı");
      const secondError = await second2.then(() => null, error => error);
      assert.deepEqual([secondError?.status, secondError?.extra?.code], [503, "maintenance"], `göç kopyası hazırken bakıma giren şirket: ${secondError?.message}`);
      const during = await state();
      assert.deepEqual([during.sha256, during.schema, during.entry], [before.sha256, before.schema, before.entry], "göç kopyası hazırken bakıma giren şirkette arşiv dosyası ve kaydı değişmedi (bekleyen özet yok, taşıma yok)");
      assert.ok(!during.files.includes(MIGRATION_WORK_FILE), `çalışma kopyası silindi (${during.files.join(", ")})`);
      await server.app.maintenance.exit(ROOT_COMPANY_ID, { runId: "a-3" });
      // (4) kip kalkınca açılır ve göç eder.
      await must("kip kalkınca 001 arşivi", admin.get("/api/workspace/cash?hofArchive=2024"));
      assert.equal(schemaOf(legacy.file), LATEST_VERSION, "kip kalkınca arşiv göç etti");
      // (5) 002: arşiv örneği bakımdan önce açık; bakımda ona da istek gitmez; closeCompany (D4 sırası) kapatır, sıradaki istek yeniden AÇMAZ; 001'in arşivi açılır.
      await makeArchive(server.app, second.id, { year: "2025" });
      await must("002 arşivi (bakımdan önce)", admin.get(`/api/workspace/cash?${q}&hofArchive=2025`));
      assert.ok(openIds().some(key => key.startsWith(`${second.id}@`)), "002 arşiv örneği açık");
      await server.app.maintenance.enter(second.id, { reason: "devri-geri-al", runId: "a-5", label: "002 · Arşiv" });
      refusedWith(await admin.get(`/api/workspace/cash?${q}&hofArchive=2025`), "002 bakımda açık arşiv örneği");
      await server.app.context.closeCompany(second.id);
      assert.ok(!openIds().some(key => key.startsWith(`${second.id}@`)), "closeCompany 002'nin arşiv örneğini kapattı");
      refusedWith(await admin.get(`/api/workspace/cash?${q}&hofArchive=2025`), "002 bakımda closeCompany sonrası");
      assert.ok(!openIds().some(key => key.startsWith(`${second.id}@`)), "bakım sürerken 002'nin arşiv örneği yeniden açılmadı");
      await must("002 bakımdayken 001'in arşivi açılır", admin.get("/api/workspace/cash?hofArchive=2024"));
      await server.app.maintenance.exit(second.id, { runId: "a-5" });
      await must("kip kalkınca 002 arşivi", admin.get(`/api/workspace/cash?${q}&hofArchive=2025`));
    } finally {
      await server.close();
      fixture.cleanup();
    }
  });

  // 2.5.0 D2 tur 2 (dar kontrol 06.11 DÜŞÜK-1): 001 bakımdayken ortak katmandaki "görevlerini devrederek kullanıcı sil" şirketin görev tablosuna (tasks) yazar, geçici
  // tetikleyiciye çarpar; DESTEKOFIS_BAKIM 503'e çevrilmiyordu → 500 "Sunucu işlemi tamamlayamadı." (veri değişmiyordu). Beklenen: 503 maintenance, veri aynı, kip kalkınca 200.
  // Ayrıca koruma TABLO TABLO (dar kontrol DÜŞÜK-2 B1: 001 koruması yalnız accounts ile sınanıyordu): ortak katman dışındaki her tabloya ekleme DESTEKOFIS_BAKIM ile düşer.
  test("001 bakımda veri tabanı korumasının düşürdüğü yazım 503 maintenance (görevlerini devrederek kullanıcı sil), veri değişmez, kip kalkınca 200; koruma ortak katman dışındaki HER tabloda", async () => {
    const dir = workDir();
    const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
    try {
      const admin = await loginAdmin(server);
      const me = unwrap(await admin.get("/api/auth/me"));
      const adminId = me?.user?.id || me?.id;
      assert.ok(adminId, "yönetici kimliği");
      const worker = await must("kullanıcı", admin.post("/api/admin/users", { username: "gorevli1", name: "Görevli Bir", role: "personel", password: "Personel-2026!", mustChangePassword: false }));
      await must("görev", admin.post("/api/workspace/tasks", { title: "Bakım görevi", assigneeId: worker.id, dueDate: "2026-11-10" }));
      const tasksOf = id => server.app.store.get("SELECT COUNT(*) AS n FROM tasks WHERE assignee_id = ? AND status = 'open'", id).n;
      const deletedAt = () => server.app.store.get("SELECT deleted_at FROM users WHERE id = ?", worker.id)?.deleted_at || null;
      assert.equal(tasksOf(worker.id), 1, "ön koşul: kişinin açık görevi var");
      await server.app.maintenance.enter(ROOT_COMPANY_ID, { reason: "devir", runId: "k-1", label: "001 · Görev" });
      const removed = await admin.del(`/api/admin/users/${worker.id}?reassignTo=${adminId}`);
      assert.deepEqual([removed.status, removed.data?.code], [503, "maintenance"], `bakımda görevlerini devrederek kullanıcı sil: ${removed.status} ${JSON.stringify(removed.data).slice(0, 240)}`);
      assert.equal(removed.data.error, "“001 · Görev” şirketinde yıl sonu devri yapılıyor; bu sırada kayıt girilemez. Birkaç dakika sonra yeniden deneyin.");
      assert.equal(removed.headers.get("retry-after"), "30");
      assert.deepEqual([tasksOf(worker.id), tasksOf(adminId), deletedAt()], [1, 0, null], "veri değişmedi (görev devredilmedi, kullanıcı silinmedi — işlem geri alındı)");
      // Koruma tablo tablo: ortak katman (users, roles, sessions, mobile_*) dışındaki her tabloya ekleme DESTEKOFIS_BAKIM ile düşer; ayarlarda yalnız ortak anahtar yazılır.
      const db = server.app.db;
      const tables = db.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name).filter(name => !COMMON.includes(name));
      assert.ok(tables.length > 50, `şirket tabloları ${tables.length}`);
      const unguarded = [];
      const attempt = (label, sql) => {
        db.exec("SAVEPOINT d2_tablo");
        try {
          db.exec(sql);
          return null;
        } catch (error) {
          return error.message;
        } finally {
          db.exec("ROLLBACK TO d2_tablo; RELEASE d2_tablo");
        }
      };
      for (const table of tables) {
        const sql = table === "settings" ? "INSERT INTO settings (key, value, updated_at) VALUES ('d2tur2.sirket-ayari', '1', '')" : `INSERT INTO "${table.replace(/"/g, '""')}" DEFAULT VALUES`;
        const message = attempt(table, sql);
        if (!/DESTEKOFIS_BAKIM/.test(message || "")) unguarded.push(`${table}: ${message === null ? "ekleme GEÇTİ" : message}`);
      }
      assert.deepEqual(unguarded, [], `001 bakımda korumasız tablo:\n${unguarded.join("\n")}`);
      assert.equal(attempt("ortak ayar", "INSERT INTO settings (key, value, updated_at) VALUES ('license.d2tur2', '1', '')"), null, "ortak ayar anahtarı (lisans) bakımda da yazılır");
      await server.app.maintenance.exit(ROOT_COMPANY_ID, { runId: "k-1" });
      await must("kip kalkınca görevlerini devrederek kullanıcı sil", admin.del(`/api/admin/users/${worker.id}?reassignTo=${adminId}`));
      assert.deepEqual([tasksOf(worker.id), tasksOf(adminId), Boolean(deletedAt())], [0, 1, true], "kip kalkınca görev devredildi, kullanıcı silindi");
    } finally {
      await server.close();
    }
  });
});
