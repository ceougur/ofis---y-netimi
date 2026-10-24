// tools/m30-goc.mjs kesinti — göç sırasında kesinti ve arıza (2.4.4 madde 30; ders 20 ön koşul zorla). Her deneme taban verisinin (v2.4.3) kopyasında:
//   A) zorla: 2.4.4'ün göç koşucusu ayrı süreçte (test/guvenilirlik/m30-goc-kesinti.mjs) seçilen noktada kendini SIGKILL ile öldürür ya da disk dolu
//      hatası alır → dosya (şema sürümü, bütünlük, yarım yedek) okunur → 2.4.4 yeniden açılır → olgular göç ölçüsüyle (guncel-goc) aynı mı;
//   B) gerçek süreç: 2.4.4'ün server.mjs'i (üretim girişi) ayrı süreçte açılır, açılıştan d ms sonra SIGKILL (yalnız kendi pid'imiz; ders 36);
//   C) kilitli dosya: başka bir süreç 001'in veri dosyasında yazma kilidi (BEGIN EXCLUSIVE) tutarken 2.4.4 açılır; kilit kalkınca yeniden açılır.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA } from "../test/guvenilirlik/m30-olgular.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Windows'ta sinyal yoktur (process.kill süreci sonlandırır, signal null, çıkış kodu sıfırdan farklı); Linux/macOS'ta SIGKILL.
const killed = result => (process.platform === "win32" ? (result.status ?? result.code) !== 0 : result.signal === "SIGKILL");

export async function run({ root, value, log, measure, summary, writeJson, readJson, dayOf }) {
  const { stableDiff } = await import("../test/guvenilirlik/m30-tatbikat.mjs");
  const { companyDbFile, readRegistry } = await import("../test/guvenilirlik/uretici.mjs");
  const { fileFacts } = await import("../test/guvenilirlik/m30-olgular.mjs");
  const day = dayOf();
  const goc = readJson("guncel-goc");
  const manifest = readJson("manifest-taban");
  const taban = path.join(root, "taban");
  const checks = [];
  const check = (name, ok, detail = {}) => {
    checks.push({ name, ok: Boolean(ok), detail });
    log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${JSON.stringify(detail).slice(0, 700)}`}`);
  };
  const companyOf = dir => {
    const registry = readRegistry(path.join(dir, "data"));
    const entry = registry.find(e => e.id === "sirket-001");
    const backupRel = manifest.backups.find(b => b.companyId === "sirket-001")?.path;
    return { file: companyDbFile(path.join(dir, "data"), entry), backupDir: path.join(dir, "backups", path.dirname(backupRel)), identity: { id: entry.id, code: entry.code, name: entry.name } };
  };
  const backupsOf = backupDir => readdirSync(backupDir).sort();
  const quick = file => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      return { check: Object.values(db.prepare("PRAGMA quick_check").get())[0], version: db.prepare("PRAGMA user_version").get().user_version };
    } finally {
      db.close();
    }
  };
  // Yeniden açılış: 2.4.4 (bütün şirketler) — olgular göç ölçüsüyle aynı mı; şema 32; numara tabanı aynı.
  const reopen = async (dir, label) => {
    const facts = await measure({ version: "guncel", dir, day });
    for (const code of Object.keys(goc.companies)) {
      const diff = stableDiff(goc.companies[code], facts.companies[code]);
      check(`${label}: yeniden açılınca ${code} olguları göç ölçüsüyle aynı`, !diff.length, { diff });
      check(`${label}: ${code} şema ${SCHEMA}, bütünlük ok, numara tabanı göçtekiyle aynı`, facts.files[code].version === SCHEMA && facts.files[code].integrity === "ok" && facts.files[code].numberFloor === goc.files[code].numberFloor, { file: facts.files[code], expectedFloor: goc.files[code].numberFloor });
    }
    return facts;
  };
  const fresh = name => {
    const dir = path.join(root, `kesinti-${name}`);
    rmSync(dir, { recursive: true, force: true });
    cpSync(taban, dir, { recursive: true });
    return dir;
  };
  const only = value("noktalar", "yedek-yazildi,v31-icinde,v31-v32-arasi,v32-icinde,disk-dolu,gercek,kilit").split(",");

  // ---------- A) zorla kesinti / disk dolu ----------
  for (const point of ["yedek-yazildi", "v31-icinde", "v31-v32-arasi", "v32-icinde", "disk-dolu"].filter(p => only.includes(p))) {
    const dir = fresh(point);
    const c = companyOf(dir);
    const before = backupsOf(c.backupDir);
    const child = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(REPO, "test", "guvenilirlik", "m30-goc-kesinti.mjs"), c.file, c.backupDir, JSON.stringify(c.identity), point], { encoding: "utf8", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const after = backupsOf(c.backupDir);
    const added = after.filter(f => !before.includes(f));
    const state = fileFacts(c.file);
    const partial = added.filter(f => f.endsWith(".yaziliyor"));
    const premig = added.filter(f => new RegExp(`pre-migration-v${SCHEMA}\\.sqlite$`).test(f));
    const detail = { signal: child.signal, status: child.status, stdout: child.stdout.trim().slice(0, 300), stderr: child.stderr.trim().slice(-300), version: state.version, integrity: state.integrity, added, numberFloor: state.numberFloor };
    if (point === "disk-dolu") {
      check(`kesinti ${point}: göç öncesi yedek yazılamayınca göç YAPILMAZ (şema 30, yarım yedek silinir, hata bildirilir)`, child.status === 3 && state.version === 30 && state.integrity === "ok" && !added.length && /disk is full/.test(child.stdout), detail);
    } else {
      const expectVersion = { "yedek-yazildi": 30, "v31-icinde": 30, "v31-v32-arasi": 31, "v32-icinde": 31 }[point];
      check(`kesinti ${point}: süreç öldü (SIGKILL), dosya tutarlı (şema ${expectVersion}, bütünlük ok, yarım işlem yok)`, killed(child) && state.version === expectVersion && state.integrity === "ok" && (point !== "v32-icinde" || state.numberFloor === null), detail);
      if (point === "yedek-yazildi") check(`kesinti ${point}: yarım yedek ".yaziliyor" adıyla kalır, geçerli yedek sayılmaz`, partial.length === 1 && !premig.length, detail);
      else check(`kesinti ${point}: göç öncesi yedek tamam (şema 30, bütünlük ok)`, premig.length === 1 && quick(path.join(c.backupDir, premig[0])).version === 30 && quick(path.join(c.backupDir, premig[0])).check === "ok", { ...detail, premig: premig.map(f => quick(path.join(c.backupDir, f))) });
    }
    await reopen(dir, `kesinti ${point}`);
    const finalList = backupsOf(c.backupDir).filter(f => !before.includes(f));
    check(`kesinti ${point}: yeniden açılış göçü tamamlar; yedek klasöründe ${finalList.length} yeni dosya`, finalList.filter(f => new RegExp(`pre-migration-v${SCHEMA}\\.sqlite$`).test(f)).length >= 1, { added: finalList });
    rmSync(dir, { recursive: true, force: true });
  }

  // ---------- B) gerçek süreç (server.mjs) açılışta SIGKILL ----------
  if (only.includes("gercek")) {
    const delays = value("gecikmeler", "60,120,200,300,450,700,1000,1500").split(",").map(Number);
    for (const delay of delays) {
      const dir = fresh(`gercek-${delay}`);
      const c = companyOf(dir);
      const before = backupsOf(c.backupDir);
      const port = await freePort();
      const env = { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9", HUKUK_DATA_DIR: path.join(dir, "data"), HUKUK_BACKUP_DIR: path.join(dir, "backups"), PORT: String(port), HOST: "127.0.0.1", HUKUK_ADMIN_PASSWORD: "Test-Admin-2026!", HUKUK_DATASET_AUTOSYNC: "0" };
      const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(REPO, "server", "server.mjs")], { cwd: REPO, env, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout.on("data", chunk => (output += chunk));
      child.stderr.on("data", chunk => (output += chunk));
      const exited = new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
      await new Promise(resolve => setTimeout(resolve, delay));
      const pid = child.pid;
      if (child.exitCode === null) child.kill("SIGKILL"); // yalnız kendi başlattığımız süreç
      const ended = await exited;
      const state = fileFacts(c.file);
      const added = backupsOf(c.backupDir).filter(f => !before.includes(f));
      const stage = state.version === SCHEMA ? "göç bitmişti" : state.version === 31 ? "v31 ile v32 arası" : added.some(f => f.endsWith(".yaziliyor")) ? "göç öncesi yedek yazılırken" : added.some(f => /pre-migration/.test(f)) ? "yedekten sonra, v31'den önce" : "göç başlamadan";
      check(`gerçek süreç SIGKILL ${delay} ms (pid ${pid}, ${stage}): dosya tutarlı`, killed(ended) && state.integrity === "ok" && [30, 31, 32, SCHEMA].includes(state.version), { ended, version: state.version, added, log: output.split(/\r?\n/).filter(line => /göç|Göç|yedek/.test(line)).slice(0, 6) });
      await reopen(dir, `gerçek süreç SIGKILL ${delay} ms`);
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // ---------- C) kilitli dosya ----------
  if (only.includes("kilit")) {
    const dir = fresh("kilit");
    const c = companyOf(dir);
    const holdMs = Number(value("kilit-sure", "15000"));
    const holder = spawn(process.execPath, ["-e", `const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(process.argv[1]); db.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE"); console.log("kilit"); setTimeout(() => { db.exec("ROLLBACK"); db.close(); process.exit(0); }, ${holdMs});`, c.file], { stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((resolve, reject) => {
      holder.stdout.once("data", resolve);
      holder.once("exit", code => reject(new Error(`kilit tutucu çıktı (${code})`)));
    });
    const started = performance.now();
    let outcome;
    try {
      const facts = await measure({ version: "guncel", dir, day });
      outcome = { opened: true, ms: Math.round(performance.now() - started), version: facts.files["001"].version };
    } catch (error) {
      outcome = { opened: false, ms: Math.round(performance.now() - started), error: String(error.message || error).slice(0, 300) };
    }
    const state = fileFacts(c.file);
    check(`kilitli dosya (${holdMs} ms yazma kilidi): 2.4.4 yarım göç bırakmaz (sonuç: ${outcome.opened ? `açıldı ${outcome.ms} ms` : "açılmadı"})`, state.integrity === "ok" && [30, SCHEMA].includes(state.version), { outcome, version: state.version });
    await new Promise(resolve => (holder.exitCode !== null ? resolve() : holder.once("exit", resolve)));
    await reopen(dir, "kilit kalktıktan sonra");
    rmSync(dir, { recursive: true, force: true });
  }
  writeJson("kesinti", { day, checks });
  summary(checks.length, checks.filter(item => !item.ok).length, "kesinti / arıza denetimleri");
  process.exitCode = checks.some(item => !item.ok) ? 1 : 0;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}
