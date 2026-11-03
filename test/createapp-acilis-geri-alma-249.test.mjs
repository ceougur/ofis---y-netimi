// 2.4.9 B1 (docs/2.4.9-tasarim/B1-createApp-baglanti.md §6; 2.4.8 dar kontrol ORTA-1): createApp açılışı openDatabase BAŞARILI olduktan sonra düşerse
// şirket dosyası (ve hub'da iki makine defteri) açık kalmamalı; açılışın kurduğu zamanlayıcı, işçi kaydı ve olay dinleyicisi geri alınmalı.
// Ölçüler (her hücre): (a) Linux /proc/self/fd → dosyaya (ve -wal / -shm'e) bağlı tutamak = 0, gc ÇAĞRILMADAN, düşen istekten hemen sonra (kırmızı kanıt
// Linux'ta da alınır); (b) HER PLATFORM dosya silinebilir / yeniden adlandırılabilir (Windows'ta asıl kanıt — ders 48). Linux'a özgü sayım başka platformda
// atlanan bir assert'tir (`skip` YOK; db-bozuk-dosya-tutamak-248 emsali) → Linux ve Windows'ta aynı sayıda test.
// Yetim zamanlayıcı ölçüsü: unref'li zamanlayıcılar process.getActiveResourcesInfo()'da GÖRÜNMEZ; bu yüzden test, setTimeout / setInterval / setImmediate'i
// sarar ve düşen istek sırasında server/ altındaki koddan kurulup temizlenmeyen (ateşlenmemiş) zamanlayıcıları sayar.
// Kanca __testOpenFault(stage, companyId) yalnız programdan (startTestServer / createApp seçeneği) verilir (server/app.mjs openFault).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createApp } from "../server/app.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { USAGE_LEDGER_FILE } from "../server/lib/einvoice/kullanim-defteri.mjs";
import { WA_LEDGER_FILE } from "../server/lib/whatsapp/defter.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const DEAD_LICENSE_URL = "http://127.0.0.1:9"; // ders 30
const ROOT = "sirket-001";
const MACHINE = "0123456789abcdef0123456789abcdef";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_DIR = path.join(REPO, "server") + path.sep;
const SERVER_URL = pathToFileURL(SERVER_DIR).href;
const STAGES = ["after-open", "after-migrations", "after-users", "after-dataset", "after-integrity", "after-register", "after-app"];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------- Ölçüler ----------
const real = file => {
  try {
    return realpathSync(file);
  } catch {
    return path.resolve(file);
  }
};
/** Linux: dosyaya (ve -wal / -shm'e) bağlı açık tutamak ve "(deleted)" tutamak sayısı; başka platformda null. */
function handlesTo(file) {
  if (process.platform !== "linux") return null;
  const base = path.join(real(path.dirname(file)), path.basename(file));
  const names = [base, `${base}-wal`, `${base}-shm`];
  let open = 0;
  let deleted = 0;
  for (const fd of readdirSync("/proc/self/fd")) {
    let link;
    try {
      link = readlinkSync(`/proc/self/fd/${fd}`);
    } catch {
      continue;
    }
    if (names.includes(link)) open += 1;
    else if (names.some(name => link === `${name} (deleted)`)) deleted += 1;
  }
  return { open, deleted };
}
const fdCount = () => (process.platform === "linux" ? readdirSync("/proc/self/fd").length : null);
/** Linux sayımı (null → başka platform; atlanan assert). Sorunlar listeye yazılır (bütün nedenler tek iletide — ders 38). */
function expectNoHandles(problems, file, label) {
  const h = handlesTo(file);
  if (h === null) return;
  if (h.open) problems.push(`${label}: ${h.open} açık tutamak kaldı (${path.basename(file)})`);
  if (h.deleted) problems.push(`${label}: ${h.deleted} "(deleted)" tutamak kaldı (${path.basename(file)})`);
}
/** Her platform: dosya yeniden adlandırılabilir ve geri alınabilir (Windows'ta açık dosya EBUSY/EPERM). */
function expectMovable(problems, file, label) {
  if (!existsSync(file)) return problems.push(`${label}: dosya yok (${file})`);
  try {
    renameSync(file, `${file}.kenar`);
    renameSync(`${file}.kenar`, file);
  } catch (error) {
    problems.push(`${label}: dosya taşınamadı (${error.code || error.message}) — açık tutamak`);
  }
}
/** Her platform: dosya (+ -wal / -shm) silinebilir. */
function expectRemovable(problems, file, label) {
  try {
    rmSync(file);
    for (const suffix of ["-wal", "-shm"]) rmSync(file + suffix, { force: true });
    if (existsSync(file)) problems.push(`${label}: dosya silinmedi`);
  } catch (error) {
    problems.push(`${label}: dosya silinemedi (${error.code || error.message}) — açık tutamak`);
  }
}

// ---------- Yetim zamanlayıcı izleyicisi ----------
const original = { setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval, setImmediate: globalThis.setImmediate, clearTimeout: globalThis.clearTimeout, clearInterval: globalThis.clearInterval, clearImmediate: globalThis.clearImmediate };
const live = new Map();
let tracking = false;
const programFrame = () => {
  const lines = String(new Error().stack || "").split(/\r?\n/).slice(3);
  const hit = lines.find(line => line.includes(SERVER_URL) || line.includes(SERVER_DIR));
  return hit ? hit.trim().replace(SERVER_URL, "server/").replace(SERVER_DIR, "server/") : null;
};
const wrapOnce = (kind, create, repeat) =>
  function (fn, ...rest) {
    const where = tracking && typeof fn === "function" ? programFrame() : null;
    if (!where) return create(fn, ...rest);
    let handle = null;
    const run = repeat ? fn : (...args) => {
      live.delete(handle);
      return fn(...args);
    };
    handle = create(run, ...rest);
    live.set(handle, `${kind} ← ${where}`);
    return handle;
  };
globalThis.setTimeout = Object.assign(wrapOnce("setTimeout", original.setTimeout, false), original.setTimeout);
globalThis.setInterval = Object.assign(wrapOnce("setInterval", original.setInterval, true), original.setInterval);
globalThis.setImmediate = Object.assign(wrapOnce("setImmediate", original.setImmediate, false), original.setImmediate);
globalThis.clearTimeout = handle => {
  live.delete(handle);
  return original.clearTimeout(handle);
};
globalThis.clearInterval = handle => {
  live.delete(handle);
  return original.clearInterval(handle);
};
globalThis.clearImmediate = handle => {
  live.delete(handle);
  return original.clearImmediate(handle);
};
/** İzlemeyi başlatır; stop() → izleme süresince program kodunun kurup temizlemediği (ateşlenmemiş) zamanlayıcılar. */
function trackTimers() {
  live.clear();
  tracking = true;
  return {
    stop() {
      tracking = false;
      const left = [...live.values()];
      live.clear();
      return left;
    },
  };
}

// ---------- Düzenek ----------
const captureLog = logs => ({
  info() {},
  debug() {},
  warn: (message, error) => logs.push(`warn: ${message}${error?.message ? ` ${error.message}` : ""}`),
  error: (message, error) => logs.push(`error: ${message}${error?.message ? ` ${error.message}` : ""}`),
});
const bodyOf = res => (typeof res.data === "string" ? res.data : JSON.stringify(res.data));
const companyFileOf = (dataDir, company) => resolveDbPath(path.join(dataDir, "sirketler", company.code));

/**
 * İki şirketli sunucu: 002 açılıp bir cari girilir, sonra kapatılır (dosyası sağlam, açık değil). fault.stage / fault.mode ile 002'nin açılışı düşürülür.
 * Dönüş: { server, api, company, q, file, logs, fault, get() }.
 */
async function twoCompanies({ autoSync = false, ...options } = {}) {
  const logs = [];
  const fault = { stage: null, mode: true };
  const server = await startTestServer({
    maxCompanies: 2,
    env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL, ...(autoSync ? { HUKUK_DATASET_AUTOSYNC: "1" } : {}) },
    log: captureLog(logs),
    __testOpenFault: (stage, companyId) => (companyId !== ROOT && fault.stage === stage ? fault.mode : false),
    ...options,
  });
  try {
    const api = await loginAdmin(server);
    const created = await api.post("/api/companies", { name: "Deneme Şirketi", select: false });
    assert.equal(created.status, 200, `ön koşul: 002 açıldı (${bodyOf(created)})`);
    const company = created.data.data.company;
    const q = `?hofCompany=${encodeURIComponent(company.id)}`;
    const account = await api.post(`/api/workspace/accounts${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" });
    assert.equal(account.status, 200, `ön koşul: 002'ye cari girildi (${bodyOf(account)})`);
    assert.equal(await server.app.context.closeCompany(company.id), true, "ön koşul: 002 kapatıldı");
    const file = companyFileOf(server.dataDir, company);
    assert.ok(existsSync(file), "ön koşul: 002'nin veri dosyası var");
    return { server, api, company, q, file, logs, fault, get: () => api.get(`/api/workspace/accounts${q}`) };
  } catch (error) {
    await server.close().catch(() => {});
    throw error;
  }
}
/** Gerçek bozulma (dar kontrol betiği "tablo-bozuk"): başlık ve şema sağlam, yalnız verilen tablonun kök sayfası bozulur (PRAGMA'lar geçer). */
function corruptTable(file, table) {
  const c = new DatabaseSync(file);
  let pageSize;
  let rootpage;
  try {
    c.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    pageSize = c.prepare("PRAGMA page_size").get().page_size;
    rootpage = c.prepare("SELECT rootpage FROM sqlite_master WHERE type = 'table' AND name = ?").get(table).rootpage;
  } finally {
    c.close();
  }
  for (const suffix of ["-wal", "-shm"]) rmSync(file + suffix, { force: true });
  const fd = openSync(file, "r+");
  try {
    writeSync(fd, Buffer.alloc(pageSize, 0xa5), 0, pageSize, (rootpage - 1) * pageSize);
  } finally {
    closeSync(fd);
  }
}
const userVersion = file => {
  const c = new DatabaseSync(file, { readOnly: true });
  try {
    return c.prepare("PRAGMA user_version").get().user_version;
  } finally {
    c.close();
  }
};
const findFiles = (dir, pattern, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) findFiles(full, pattern, out);
    else if (pattern.test(name)) out.push(full);
  }
  return out;
};
/** Aynı süreçte createApp (hub 001) — startTestServer'ın seçenekleriyle; lisans uygulaması kapalı, zamanlayıcısı kapalı (ders 30). */
const hubApp = (dataDir, backupDir, extra = {}) =>
  createApp({ dataDir, backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, license: { enforce: false, machineId: MACHINE }, startLicenseTimers: false, whatsappWorker: "manual", moneyStrict: true, reportWorker: false, ...extra });

describe("2.4.9 B1 — createApp açılışı yarıda düşünce dosya açık kalmaz, açılış geri alınır", () => {
  it("T0 new DatabaseSync kurucusu düşer (olmayan dizin) → Node tutamak bırakmaz", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "b1-t0-"));
    try {
      const missing = path.join(dir, "yok", "alt", "destekofis.sqlite");
      const before = fdCount();
      for (let i = 0; i < 20; i += 1) assert.throws(() => new DatabaseSync(missing), "olmayan dizinde açılış düşmeli");
      const after = fdCount();
      if (before !== null) assert.equal(after, before, `kurucu düşünce ${after - before} tutamak arttı (20 deneme)`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("T1 002'nin users kök sayfası bozuk (gerçek bozulma) → 503 ×3; tutamak 0; dosya silinebilir", { timeout: 120_000 }, async () => {
    const s = await twoCompanies();
    try {
      corruptTable(s.file, "users");
      const statuses = [];
      for (let i = 0; i < 3; i += 1) statuses.push((await s.get()).status);
      const problems = [];
      expectNoHandles(problems, s.file, "002 açılamadıktan sonra (3 istek)");
      expectRemovable(problems, s.file, "002");
      assert.deepEqual(statuses, [503, 503, 503], "bozuk dosya 503");
      assert.deepEqual(problems, []);
    } finally {
      await s.server.close();
    }
  });

  it("T2 T1 + Yedekten Geri Yükle → 200; sonra açılır; \"(deleted)\" tutamak 0", { timeout: 120_000 }, async () => {
    const s = await twoCompanies();
    try {
      const backup = await s.api.post("/api/admin/backups", { scope: "one", companyId: s.company.id });
      assert.equal(backup.status, 200, `ön koşul: yedek (${bodyOf(backup)})`);
      const name = backup.data.data.backups[0].name;
      corruptTable(s.file, "users");
      const statuses = [];
      for (let i = 0; i < 3; i += 1) statuses.push((await s.get()).status);
      assert.deepEqual(statuses, [503, 503, 503], "bozuk dosya 503");
      const restored = await s.api.post("/api/admin/backups/restore", { name, company: s.company.id, confirm: s.company.code, password: ADMIN_PASSWORD });
      const problems = [];
      if (restored.status !== 200) problems.push(`geri yükleme ${restored.status} (${bodyOf(restored)})`);
      expectNoHandles(problems, s.file, "geri yüklemeden sonra");
      const after = await s.get();
      if (after.status !== 200) problems.push(`geri yüklemeden sonra istek ${after.status}`);
      else if (!(after.data.data?.accounts || after.data.data || []).length && !JSON.stringify(after.data).includes("Burak Kaya")) problems.push("geri yüklenen veride cari yok");
      await s.server.app.context.closeCompany(s.company.id);
      expectNoHandles(problems, s.file, "geri yüklenen şirket kapanınca");
      assert.deepEqual(problems, []);
    } finally {
      await s.server.close();
    }
  });

  it("T3 göç ortasında düşme (göç 44 ALTER TABLE'da düşer) → 503; tutamak 0; user_version değişmez; göç öncesi yedek var; düzelince sonraki açılış göçleri yeniden koşar", { timeout: 120_000 }, async () => {
    const s = await twoCompanies();
    try {
      // wa_jobs görünüme çevrilir (inherit_of sütunu yok) ve user_version SABİT 43'e iner (v44 = wa_jobs.inherit_of; "son göç - 1" DEĞİL — sonraki sürüm yeni
      // göç ekleyince test kırılmasın, 2.4.9 B1 dar kontrol DÜŞÜK-1): göç 44 addColumn → "Cannot add a column to a view" (göç işlemi geri alınır; v45+ hiç koşmaz).
      const BEFORE_V44 = 43;
      const c = new DatabaseSync(s.file);
      const latest = c.prepare("PRAGMA user_version").get().user_version;
      try {
        assert.ok(latest > BEFORE_V44, `ön koşul: şirket dosyası en az v44'te (${latest})`);
        const cols = c.prepare("PRAGMA table_info(wa_jobs)").all().map(col => col.name).filter(name => name !== "inherit_of");
        c.exec(`ALTER TABLE wa_jobs RENAME TO wa_jobs_b1; CREATE VIEW wa_jobs AS SELECT ${cols.join(", ")} FROM wa_jobs_b1; PRAGMA user_version = ${BEFORE_V44};`);
      } finally {
        c.close();
      }
      const res = await s.get();
      const problems = [];
      expectNoHandles(problems, s.file, "göç düştükten sonra");
      expectMovable(problems, s.file, "göç düştükten sonra");
      assert.equal(res.status, 503, `göç düşünce 503 (${bodyOf(res)})`);
      assert.match(bodyOf(res), /açılamadı/);
      assert.equal(userVersion(s.file), BEFORE_V44, "göç işlemi geri alındı: user_version değişmedi");
      assert.ok(findFiles(s.server.backupDir, new RegExp(`pre-migration-v${latest}`)).length >= 1, "göç öncesi yedek alındı");
      const fix = new DatabaseSync(s.file);
      try {
        // Yalnız tablo geri gelir (inherit_of yok); sürüm 43'te KALIR → sonraki açılış göç 44'ten sona kadar göçleri kendisi yeniden koşar (tasarım §5.1).
        fix.exec("DROP VIEW wa_jobs; ALTER TABLE wa_jobs_b1 RENAME TO wa_jobs;");
      } finally {
        fix.close();
      }
      const again = await s.get();
      if (again.status !== 200) problems.push(`düzelince açılmadı (${again.status} ${bodyOf(again)})`);
      await s.server.app.context.closeCompany(s.company.id);
      const migrated = userVersion(s.file);
      if (migrated !== latest) problems.push(`sonraki açılış göçleri yeniden koşmadı: user_version ${migrated}, beklenen ${latest}`);
      const fixed = new DatabaseSync(s.file, { readOnly: true });
      try {
        if (!fixed.prepare("PRAGMA table_info(wa_jobs)").all().some(col => col.name === "inherit_of")) problems.push("göç 44 yeniden koşmadı: wa_jobs.inherit_of yok");
      } finally {
        fixed.close();
      }
      expectNoHandles(problems, s.file, "düzelip kapanınca");
      assert.deepEqual(problems, []);
    } finally {
      await s.server.close();
    }
  });

  for (const stage of STAGES) {
    it(`T4 geç düşme ${stage} (002) → tutamak 0; yetim zamanlayıcı / işçi kaydı / hub olay dinleyicisi yok; kapalı bağlantıya çarpan iş yok; sonra açılır`, { timeout: 120_000 }, async () => {
      const s = await twoCompanies({ autoSync: true });
      try {
        const scheduler = s.server.app.whatsapp.scheduler;
        const queuesBefore = scheduler.size();
        const tapsBefore = s.server.app.events.tapCount();
        s.fault.stage = stage;
        const timers = trackTimers();
        let res;
        let left;
        const problems = [];
        try {
          res = await s.get();
          expectNoHandles(problems, s.file, `${stage} düştükten hemen sonra`);
          await sleep(2_000);
        } finally {
          left = timers.stop();
        }
        s.fault.stage = null;
        assert.equal(res.status, 503, `kesinti 503 (${bodyOf(res)})`);
        assert.match(bodyOf(res), new RegExp(`test: açılış kesintisi ${stage}`), "istemciye giden ileti asıl hatanın iletisi");
        expectMovable(problems, s.file, stage);
        if (left.length) problems.push(`${stage}: ${left.length} yetim zamanlayıcı kaldı: ${left.join(" | ")}`);
        if (scheduler.size() !== queuesBefore) problems.push(`${stage}: hub WhatsApp işçisinde ${scheduler.size() - queuesBefore} yetim kuyruk kaydı kaldı`);
        if (s.server.app.events.tapCount() !== tapsBefore) problems.push(`${stage}: hub olay kanalında ${s.server.app.events.tapCount() - tapsBefore} yetim dinleyici kaldı`);
        const closedHits = s.logs.filter(line => /database is not open/i.test(line));
        if (closedHits.length) problems.push(`${stage}: kapalı bağlantıya çarpan iş günlükte (${closedHits.length}): ${closedHits[0]}`);
        const again = await s.get();
        if (again.status !== 200) problems.push(`${stage}: kanca kalkınca açılmadı (${again.status} ${bodyOf(again)})`);
        await s.server.app.context.closeCompany(s.company.id);
        expectNoHandles(problems, s.file, `${stage}: sonraki açılış kapanınca`);
        assert.deepEqual(problems, []);
      } finally {
        await s.server.close();
      }
    });
  }

  it("T5 kilitli dosya (AYRI SÜREÇ BEGIN EXCLUSIVE) → 503 (~10 sn); kilit kalkınca tutamak 0, sonraki istek 200, kapanınca 0", { timeout: 120_000 }, async () => {
    const s = await twoCompanies();
    // Kilit tutucusu ayrı süreçte (aynı süreçteki bağlantı POSIX fd ertelemesiyle sayımı şişirir — tasarım notu §1 "kilit").
    const holder = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "-e", [
      "const { DatabaseSync } = require('node:sqlite');",
      "const db = new DatabaseSync(process.argv[1]);",
      "db.exec('PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE');",
      "process.stdout.write('hazir\\n');",
      "process.stdin.once('data', () => { db.exec('ROLLBACK'); db.close(); process.exit(0); });",
    ].join(" "), s.file], { stdio: ["pipe", "pipe", "inherit"] });
    const exited = new Promise(resolve => holder.once("exit", resolve));
    try {
      await new Promise((resolve, reject) => {
        holder.stdout.once("data", resolve);
        holder.once("error", reject);
        holder.once("exit", code => reject(new Error(`kilit süreci çıktı (${code})`)));
      });
      const started = Date.now();
      const res = await s.get();
      const tookMs = Date.now() - started;
      holder.stdin.write("bitir\n");
      await exited;
      const problems = [];
      expectNoHandles(problems, s.file, "kilitli açılış düşüp kilit kalkınca");
      expectMovable(problems, s.file, "kilit kalkınca");
      assert.equal(res.status, 503, `kilitli dosya 503 (${bodyOf(res)})`);
      assert.ok(tookMs >= 5_000, `ön koşul: açılış kilitte bekledi (${tookMs} ms)`);
      const again = await s.get();
      if (again.status !== 200) problems.push(`kilit kalkınca istek ${again.status}`);
      await s.server.app.context.closeCompany(s.company.id);
      expectNoHandles(problems, s.file, "sonraki açılış kapanınca");
      assert.deepEqual(problems, []);
    } finally {
      if (holder.exitCode === null) holder.kill();
      await s.server.close();
    }
  });

  it("T6 geri alma adımı da düşer → istemciye giden 503 iletisi ASIL hatanın; öbür adımlar yine çalışır (tutamak 0); günlükte uyarı", { timeout: 120_000 }, async () => {
    const s = await twoCompanies();
    try {
      s.fault.stage = "after-dataset";
      s.fault.mode = "geri-alma-da-duser";
      const res = await s.get();
      s.fault.stage = null;
      const problems = [];
      expectNoHandles(problems, s.file, "geri alma adımı düştükten sonra");
      expectMovable(problems, s.file, "geri alma adımı düştükten sonra");
      assert.equal(res.status, 503, bodyOf(res));
      assert.match(bodyOf(res), /test: açılış kesintisi after-dataset/, "istemciye giden ileti asıl hatanın iletisi");
      assert.doesNotMatch(bodyOf(res), /geri alma kesintisi/, "temizlik hatası asıl hatayı ezmez (ders 21)");
      if (!s.logs.some(line => /Açılış geri alınırken/.test(line) && /test: geri alma kesintisi/.test(line) && /test: açılış kesintisi after-dataset/.test(line))) problems.push(`günlükte geri alma uyarısı (adımın hatası + asıl hata) yok: ${JSON.stringify(s.logs.slice(-3))}`);
      assert.deepEqual(problems, []);
    } finally {
      await s.server.close();
    }
  });

  it("T7 salt okunur lisans + T1 → 503; tutamak 0; sağlam şirkette salt okunur yanıt değişmez (GET 200, yazım 403 LICENSE_READ_ONLY)", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "b1-t7-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    try {
      const first = await twoCompanies({ dataDir, backupDir });
      const { company, file } = first;
      await first.server.close();
      corruptTable(file, "users");
      const server = await startTestServer({
        dataDir,
        backupDir,
        maxCompanies: 2,
        env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL },
        license: { enforce: true, autoTrial: false, machineId: MACHINE, services: [DEAD_LICENSE_URL], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 },
      });
      try {
        const api = await loginAdmin(server);
        const statuses = [];
        for (let i = 0; i < 3; i += 1) statuses.push((await api.get(`/api/workspace/accounts?hofCompany=${encodeURIComponent(company.id)}`)).status);
        const problems = [];
        expectNoHandles(problems, file, "salt okunur lisansta 002 açılamadıktan sonra (3 istek)");
        expectRemovable(problems, file, "salt okunur lisansta 002");
        assert.deepEqual(statuses, [503, 503, 503], "bozuk dosya 503");
        assert.equal((await api.get("/api/workspace/accounts")).status, 200, "001 okunur");
        const write = await api.post("/api/workspace/accounts", { name: "Yeni Cari" });
        assert.equal(write.status, 403, bodyOf(write));
        assert.equal(write.data.code, "LICENSE_READ_ONLY");
        assert.deepEqual(problems, []);
      } finally {
        await server.close();
      }
    } finally {
      removeTestDir(root);
    }
  });

  it("T8 iki şirket: 002 açılışı düşerken 001'e paralel istekler 200, 001'in tutamakları değişmez; sonra Şirket Sil 200 + klasör arşive taşındı", { timeout: 120_000 }, async () => {
    const s = await twoCompanies();
    try {
      const hubFile = resolveDbPath(s.server.dataDir);
      const hubBefore = handlesTo(hubFile);
      s.fault.stage = "after-integrity";
      const results = await Promise.all([s.get(), s.api.get("/api/workspace/accounts"), s.get(), s.api.get("/api/workspace/accounts"), s.get(), s.api.get("/api/workspace/accounts"), s.api.get("/api/workspace/accounts")]);
      s.fault.stage = null;
      const problems = [];
      expectNoHandles(problems, s.file, "002 üç kez düştükten sonra");
      const hubAfter = handlesTo(hubFile);
      if (hubBefore && hubAfter.open !== hubBefore.open) problems.push(`001'in tutamak sayısı değişti (${hubBefore.open} → ${hubAfter.open})`);
      assert.deepEqual(results.map(r => r.status), [503, 200, 503, 200, 503, 200, 200], "002 düşer, 001 çalışır");
      const companyDir = path.dirname(s.file);
      const removed = await s.api.raw("DELETE", `/api/companies/${s.company.id}`, { body: JSON.stringify({ confirm: s.company.code, password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });
      if (removed.status !== 200) problems.push(`Şirket Sil ${removed.status} (${removed.buffer.toString("utf8")})`);
      if (existsSync(companyDir)) problems.push("002'nin klasörü yerinde kaldı (arşive taşınmadı)");
      const archived = existsSync(path.join(s.server.dataDir, "silinen-sirketler")) ? readdirSync(path.join(s.server.dataDir, "silinen-sirketler")).filter(name => name.startsWith(`${s.company.code}-`)) : [];
      if (archived.length !== 1) problems.push(`silinen-sirketler altında ${archived.length} arşiv klasörü`);
      assert.deepEqual(problems, []);
    } finally {
      await s.server.close();
    }
  });

  it("T9 tekrar: bozuk 002'ye 10 ekran isteği + 10 WhatsApp durum bildirimi (kanca → appFor) → hepsi 503; tutamak 0", { timeout: 180_000 }, async () => {
    const ctx = await startWa({ maxCompanies: 2, now: { time: "2026-11-03T10:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL } });
    try {
      const api = ctx.api;
      const created = await api.post("/api/companies", { name: "Deneme Şirketi", select: false });
      assert.equal(created.status, 200, bodyOf(created));
      const company = created.data.data.company;
      const q = `?hofCompany=${encodeURIComponent(company.id)}`;
      for (const [url, body] of [[URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }], [URLS.ack, { ack: true }]]) {
        const res = await api.put(`${url}${q}`, body);
        assert.equal(res.status, 200, `ön koşul ${url}: ${bodyOf(res)}`);
      }
      const person = await api.post(`/api/workspace/accounts${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" });
      assert.equal(person.status, 200, bodyOf(person));
      const batch = await api.post(`${URLS.batches}${q}`, { kind: "statement", ids: [person.data.data.id], preset: "thisMonth" });
      assert.equal(batch.status, 200, bodyOf(batch));
      await ctx.drain();
      const job = (await api.get(`${URLS.batches}/${batch.data.data.batch.id}${q}`)).data.data.jobs[0];
      assert.ok(job?.wamid, "ön koşul: iş Meta'ya kabul edildi (wamid)");
      const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
      ctx.server.app.mobileRemote.setPublicUrl("http://ofis-t.destekofis.test");
      await ctx.server.app.context.whatsapp.connection.registerHook(null, "http://ofis-t.destekofis.test");
      const secret = new URL(ctx.fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop();
      const hook = () =>
        new Promise((resolve, reject) => {
          const status = { id: job.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566" };
          const payload = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses: [status] } }] }] }));
          const req = http.request(`http://127.0.0.1:${remote.port}/wa/kanca/${secret}`, { method: "POST", headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
            res.resume();
            res.on("end", () => resolve(res.statusCode));
          });
          req.on("error", reject);
          req.end(payload);
        });
      assert.equal(await ctx.server.app.context.closeCompany(company.id), true, "ön koşul: 002 kapatıldı");
      const file = companyFileOf(ctx.server.dataDir, company);
      corruptTable(file, "users");
      const screen = [];
      const hooks = [];
      for (let i = 0; i < 10; i += 1) {
        screen.push((await api.get(`/api/workspace/accounts${q}`)).status);
        hooks.push(await hook());
      }
      const problems = [];
      expectNoHandles(problems, file, "20 düşen açılıştan sonra");
      expectRemovable(problems, file, "002");
      assert.deepEqual(screen, Array(10).fill(503), "ekran istekleri 503");
      assert.deepEqual(hooks, Array(10).fill(503), "kanca bildirimleri 503 (geçici; Meta yineler)");
      assert.deepEqual(problems, []);
    } finally {
      await ctx.close();
    }
  });

  it("T10 yeni şirket ilk açılışta düşer (after-open) → dosya serbest, company.opened işareti yok; dosya kalkınca boş şirket açılır", { timeout: 120_000 }, async () => {
    const logs = [];
    const fault = { on: true };
    const server = await startTestServer({ maxCompanies: 2, env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, log: captureLog(logs), __testOpenFault: (stage, companyId) => fault.on && companyId !== ROOT && stage === "after-open" });
    try {
      const api = await loginAdmin(server);
      const created = await api.post("/api/companies", { name: "Yeni Şirket", select: false });
      fault.on = false;
      assert.notEqual(created.status, 200, "ilk açılışı düşen şirket oluşturma yanıtı başarı değil");
      const company = (await api.get("/api/companies")).data.data.companies.find(item => item.code === "002");
      assert.ok(company, "ön koşul: kayıt defterinde 002 var");
      const file = companyFileOf(server.dataDir, company);
      const problems = [];
      expectNoHandles(problems, file, "yeni şirketin ilk açılışı düştükten sonra");
      if (server.app.store.setting(`company.opened.${company.id}`, "")) problems.push("company.opened işareti kondu (açılmayan şirket açılmış sayıldı)");
      expectRemovable(problems, file, "yeni şirketin dosyası");
      const again = await api.get(`/api/workspace/accounts?hofCompany=${encodeURIComponent(company.id)}`);
      if (again.status !== 200) problems.push(`dosya kalkınca boş şirket açılmadı (${again.status} ${bodyOf(again)})`);
      assert.deepEqual(problems, []);
    } finally {
      await server.close();
    }
  });

  for (const stage of ["after-integrity", "after-app"]) {
    it(`T11 hub (001) ${stage} düşer (doğrudan createApp) → fırlatır; 001 + iki defter dosyası serbest; yetim zamanlayıcı yok; aynı veriyle ikinci createApp açılır`, { timeout: 120_000 }, async () => {
      const root = mkdtempSync(path.join(tmpdir(), "b1-t11-"));
      const dataDir = path.join(root, "data");
      const backupDir = path.join(root, "backups");
      const problems = [];
      try {
        const timers = trackTimers();
        let left;
        try {
          assert.throws(() => hubApp(dataDir, backupDir, { __testOpenFault: (s, id) => s === stage && id === ROOT }), new RegExp(`test: açılış kesintisi ${stage}`));
          for (const file of [resolveDbPath(dataDir), path.join(dataDir, USAGE_LEDGER_FILE), path.join(dataDir, WA_LEDGER_FILE)]) expectNoHandles(problems, file, `001 ${stage} düştükten sonra`);
          await sleep(500);
        } finally {
          left = timers.stop();
        }
        if (left.length) problems.push(`001 ${stage}: ${left.length} yetim zamanlayıcı kaldı: ${left.join(" | ")}`);
        for (const file of [resolveDbPath(dataDir), path.join(dataDir, USAGE_LEDGER_FILE), path.join(dataDir, WA_LEDGER_FILE)]) expectMovable(problems, file, `001 ${stage}`);
        const app = hubApp(dataDir, backupDir);
        await app.close();
        for (const file of [resolveDbPath(dataDir), path.join(dataDir, USAGE_LEDGER_FILE), path.join(dataDir, WA_LEDGER_FILE)]) expectNoHandles(problems, file, "ikinci createApp kapanınca");
        try {
          rmSync(root, { recursive: true });
        } catch (error) {
          problems.push(`geçici klasör silinemedi (${error.code || error.message}) — açık tutamak`);
        }
        assert.deepEqual(problems, []);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  // 2.4.9 B1 dar kontrol DÜŞÜK-2: yukarıdaki hub hücreleri lisans / yedek / tünel zamanlayıcılarını KAPALI açar (hubApp) → bunların geri alınmasını ölçmez.
  // Bu hücre üretime yakın seçeneklerle açar (otomatik yedek, lisans zamanlayıcıları + uygulama + otomatik deneme, sahte kapıcı + sahte cloudflared tünel,
  // WhatsApp işçisi otomatik, rapor iş parçacığı). Gerçek lisans servisine ULAŞMAZ (ders 30): ölü adres + reddeden fetchImpl. Kaynak: dar kontrol betiği p2-hub-uretim.
  it("T11 hub (001) after-app düşer, ÜRETİME YAKIN seçenekler (yedek + lisans + tünel zamanlayıcıları açık) → yetim zamanlayıcı yok; kapalı bağlantıya çarpan iş yok; dosyalar serbest", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "b1-t11u-"));
    const dataDir = path.join(root, "data");
    const fake = path.join(REPO, "test", "fixtures", "sahte-cloudflared.mjs");
    const gate = { provision: async () => ({ tunnelId: "12345678-1234-4234-8234-123456789abc", hostname: "oabc.destekofis.net", publicUrl: "https://oabc.destekofis.net", token: "sahte" }) };
    const baseOptions = (logs, extra = {}) => ({
      dataDir,
      backupDir: path.join(root, "backups"),
      log: captureLog(logs),
      scheduleBackups: true,
      backupOnStartDelayMs: 50,
      env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "1", HUKUK_LICENSE_URL: DEAD_LICENSE_URL },
      license: { enforce: true, autoTrial: true, machineId: MACHINE, services: [DEAD_LICENSE_URL], fetchImpl: async () => { throw new TypeError("fetch failed"); } },
      startLicenseTimers: true,
      whatsappWorker: "auto",
      reportWorker: true,
      tunnel: { gate, runner: { command: process.execPath, argsPrefix: [fake, "--sahte-log", path.join(root, "cf.log"), "--sahte-mod", "bagli"], identity: fake }, tickMs: 50, firstTickMs: 10, stopGraceMs: 0, root: path.join(root, "bilesen") },
      ...extra,
    });
    const files = () => [resolveDbPath(dataDir), path.join(dataDir, USAGE_LEDGER_FILE), path.join(dataDir, WA_LEDGER_FILE)];
    const problems = [];
    try {
      const warm = createApp(baseOptions([])); // önce sağlam açılış: dosyalar var, düşen açılış göç yapmaz
      await warm.close();
      const logs = [];
      const timers = trackTimers();
      let left;
      try {
        assert.throws(() => createApp(baseOptions(logs, { __testOpenFault: (s, id) => s === "after-app" && id === ROOT })), /test: açılış kesintisi after-app/);
        for (const file of files()) expectNoHandles(problems, file, "001 after-app (üretime yakın) düştükten sonra");
        await sleep(2_000); // yedek 50 ms, tünel ilk adım 10 ms: geri alınmayan zamanlayıcı bu sürede kapalı bağlantıya çarpar
      } finally {
        left = timers.stop();
      }
      if (left.length) problems.push(`001 after-app (üretime yakın): ${left.length} yetim zamanlayıcı kaldı: ${left.join(" | ")}`);
      const closedHits = logs.filter(line => /database is not open|statement has been finalized/i.test(line));
      if (closedHits.length) problems.push(`001 after-app (üretime yakın): kapalı bağlantıya çarpan iş günlükte (${closedHits.length}): ${closedHits.join(" | ")}`);
      for (const file of files()) expectMovable(problems, file, "001 after-app (üretime yakın)");
      const second = createApp(baseOptions([]));
      await second.close();
      for (const file of files()) expectNoHandles(problems, file, "ikinci createApp kapanınca");
      try {
        rmSync(root, { recursive: true });
      } catch (error) {
        problems.push(`geçici klasör silinemedi (${error.code || error.message}) — açık tutamak`);
      }
      assert.deepEqual(problems, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  for (const [label, ledgerFile, breakLedger] of [
    ["e-Belge kullanım defteri uyumsuz şema (CREATE INDEX düşer)", USAGE_LEDGER_FILE, file => {
      rmSync(file, { force: true });
      for (const suffix of ["-wal", "-shm"]) rmSync(file + suffix, { force: true });
      const c = new DatabaseSync(file);
      try {
        c.exec("CREATE TABLE usage (company_id TEXT)");
      } finally {
        c.close();
      }
    }],
    ["WhatsApp gönderim defteri meta sayfası bozuk (ilk okuma düşer)", WA_LEDGER_FILE, file => corruptTable(file, "meta")],
  ]) {
    it(`T11 hub açılışında ${label} → createApp fırlatır; defter ve 001 dosyası serbest; defter kalkınca açılır`, { timeout: 120_000 }, async () => {
      const root = mkdtempSync(path.join(tmpdir(), "b1-t11d-"));
      const dataDir = path.join(root, "data");
      const backupDir = path.join(root, "backups");
      const problems = [];
      try {
        const first = hubApp(dataDir, backupDir);
        await first.close();
        const file = path.join(dataDir, ledgerFile);
        breakLedger(file);
        assert.throws(() => hubApp(dataDir, backupDir), "bozuk defterle hub açılmamalı");
        expectNoHandles(problems, resolveDbPath(dataDir), `${ledgerFile} düştükten sonra 001`);
        expectNoHandles(problems, file, `${ledgerFile} düştükten sonra defter`);
        expectMovable(problems, resolveDbPath(dataDir), "001");
        expectRemovable(problems, file, ledgerFile);
        const app = hubApp(dataDir, backupDir);
        await app.close();
        try {
          rmSync(root, { recursive: true });
        } catch (error) {
          problems.push(`geçici klasör silinemedi (${error.code || error.message}) — açık tutamak`);
        }
        assert.deepEqual(problems, []);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("T12 sağlam açılış: kanca verilmiş ama düşmüyor → davranış aynen; 002 kapanınca ve sunucu kapanınca tutamak 0", { timeout: 120_000 }, async () => {
    const s = await twoCompanies();
    const problems = [];
    let hubFile;
    try {
      const res = await s.get();
      assert.equal(res.status, 200, bodyOf(res));
      assert.ok(JSON.stringify(res.data).includes("Burak Kaya"), "002'nin verisi okunur");
      const h = handlesTo(s.file);
      if (h && h.open < 1) problems.push("ön koşul: açık 002'nin tutamağı görünmeli");
      await s.server.app.context.closeCompany(s.company.id);
      expectNoHandles(problems, s.file, "002 kapanınca");
      hubFile = resolveDbPath(s.server.dataDir);
    } finally {
      await s.server.app.close();
    }
    for (const file of [hubFile, path.join(s.server.dataDir, USAGE_LEDGER_FILE), path.join(s.server.dataDir, WA_LEDGER_FILE)]) expectNoHandles(problems, file, "sunucu kapanınca");
    removeTestDir(s.server.root);
    assert.deepEqual(problems, []);
  });
});
