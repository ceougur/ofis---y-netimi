// T6 (h) — GÖÇ SIRASINDA KESİNTİ (v40 → v41). v40 verisi eski sürümün GERÇEK koduyla (h-eski-uret.mjs; v40 = 7364660a, T2-6'dan önceki aday), kuyrukta bekleyen
// toplu gönderimle. (h1) Yeni kod (aday 1) açılırken farklı anlarda SIGKILL (0–2000 ms, 20 nokta): her öldürmeden sonra dosya v40 ya da v41 (ARA YOK), bütünlük
// "ok", sonra tam açılış → v41, iş satırları aynı, bekleyen gönderim BİR kez gider. (h2) ZORLA (ders 20: öldürme anı göçün içine düşmüyorsa ön koşul elle kurulur):
// v41'in ilk adımı (ALTER TABLE wa_jobs ADD COLUMN prepared_at) ayrı süreçte işlem İÇİNDE yazılır ve süreç COMMIT'ten önce SIGKILL ile öldürülür — "göçün
// ortasında elektrik gitti" diskteki hâli; sonra yeni kod açılır. (h3) göç sırasında DİSK DOLU (tmpfs): program açılmazsa açık hata, yer açılınca v41.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, closeSync, openSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before, after } from "node:test";
import { DEAD_LICENSE_URL, KOK, companyDb, fakeMeta, freshDir, mountTmpfs, perRecipient, query, rmrf, startChild, until, wait } from "./ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ESKI = process.env.T6_ESKI_V40;
if (!ESKI) throw new Error("T6_ESKI_V40: v40 kodunun ayrı kopyası (git archive 7364660a)");
const N = 5;
let fake;
let template;
let batchId;
const ver = file => query(file, "PRAGMA user_version")[0].user_version;
const cols = file => query(file, "PRAGMA table_info(wa_jobs)").map(row => row.name);

before(async () => {
  fake = await fakeMeta();
  template = freshDir("h-v40");
  // spawnSync DEĞİL: sahte Meta bu süreçte; olay döngüsü tutulursa eski kodun isteği yanıtsız kalır.
  const out = await new Promise(resolve => {
    const child = spawn(process.execPath, ["--no-warnings", path.join(HERE, "h-eski-uret.mjs"), ESKI, path.join(template, "data"), path.join(template, "backups"), fake.url, String(N)], { env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL, TMPDIR: path.join(KOK, "tmp") }, stdio: ["ignore", "pipe", "pipe"] });
    const acc = { stdout: "", stderr: "" };
    child.stdout.on("data", chunk => (acc.stdout += chunk));
    child.stderr.on("data", chunk => (acc.stderr += chunk));
    child.once("exit", () => resolve(acc));
  });
  const line = out.stdout.split("\n").map(item => { try { return JSON.parse(item); } catch { return null; } }).find(Boolean);
  assert.ok(line?.ok, `v40 verisi üretilemedi: ${out.stdout.slice(-400)} ${out.stderr.slice(-800)}`);
  assert.equal(line.version, 40, "eski kod v40 üretti");
  batchId = line.batchId;
  console.log(`# T6h v40 verisi: ${JSON.stringify({ ...line, isler: query(companyDb(path.join(template, "data")), "SELECT state, COUNT(*) n FROM wa_jobs GROUP BY state") })}`);
});
after(async () => {
  await fake?.close();
  rmrf(template);
});
function copy(label) {
  const root = freshDir(label);
  cpSync(template, root, { recursive: true });
  return root;
}
async function spawnKill(root, delayMs) {
  const arg = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), graphUrl: fake.url, timeoutMs: 3000, gapMs: 200, now: "2026-11-03T10:00:00+03:00" };
  const child = spawn(process.execPath, ["--no-warnings", path.join(HERE, "cocuk.mjs"), JSON.stringify(arg)], { env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL, TMPDIR: path.join(KOK, "tmp") }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", chunk => (out += chunk));
  child.stderr.on("data", chunk => (out += chunk));
  const exited = new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
  await wait(delayMs);
  child.kill("SIGKILL");
  const end = await exited;
  return { end, ready: /"ready":true/.test(out), out };
}
async function fullOpenAndSend(root, r) {
  const dataDir = path.join(root, "data");
  const before = fake.state.messages.length;
  const prog = await startChild({ dataDir, backupDir: path.join(root, "backups"), fake, gapMs: 100, now: "2026-11-03T10:05:00+03:00" });
  try {
    r.acilistaSurum = ver(companyDb(dataDir));
    r.acilistaSutunlar = ["prepared_at", "pdf_blob"].every(name => cols(companyDb(dataDir)).includes(name));
    await until(async () => (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data.state !== "running", 60_000, "bekleyen toplu iş bitti");
    const d = (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data;
    r.toplu = d.state;
    r.isler = d.jobs.map(job => job.state).join(",");
    r.giden = fake.state.messages.length - before;
  } finally {
    await prog.stop();
  }
}

describe("T6 (h) — göç sırasında kesinti (v40 → v41)", () => {
  it("h1: yeni kod açılırken 20 farklı anda SIGKILL → her seferinde v40|v41 (ara yok), bütünlük ok; tam açılışta v41 ve bekleyen gönderim bir kez", { timeout: 600_000 }, async () => {
    const satirlar = [];
    for (let i = 0; i < 20; i += 1) {
      const delay = 40 + i * 100;
      const root = copy(`h1-${i}`);
      const dataDir = path.join(root, "data");
      try {
        const k = await spawnKill(root, delay);
        const file = companyDb(dataDir);
        const r = { delay, olduruldu: k.end.signal, hazirdi: k.ready, surum: ver(file), butunluk: query(file, "PRAGMA integrity_check")[0].integrity_check, sutunlar: cols(file).filter(name => ["prepared_at", "pdf_blob"].includes(name)).length, isSatiri: query(file, "SELECT COUNT(*) n FROM wa_jobs")[0].n };
        await fullOpenAndSend(root, r);
        satirlar.push(r);
      } finally {
        rmrf(root);
      }
    }
    console.log(`# T6h1 ${JSON.stringify(satirlar)}`);
    for (const r of satirlar) {
      assert.ok([40, 41].includes(r.surum), JSON.stringify(r));
      assert.equal(r.butunluk, "ok");
      assert.equal(r.sutunlar, r.surum === 41 ? 2 : 0, `sürüm ile sütunlar tutarlı: ${JSON.stringify(r)}`);
      assert.equal(r.isSatiri, N);
      assert.equal(r.acilistaSurum, 41);
      assert.equal(r.toplu, "done");
    }
    const counts = perRecipient(fake);
    console.log(`# T6h1 alıcı başına (20 kopya toplamı): ${JSON.stringify(counts)}`);
    assert.ok(Object.values(counts).every(n => n <= 20), `bir kopyada bir kişiye en çok bir ileti (20 kopya): ${JSON.stringify(counts)}`);
  });

  it("h2 ZORLA: v41'in ilk ALTER'ı işlem içinde yazıldı, COMMIT'ten önce süreç öldü → yeni kod temiz v41'e geçer, bekleyen gönderim bir kez", { timeout: 200_000 }, async () => {
    const root = copy("h2");
    const file = companyDb(path.join(root, "data"));
    try {
      const code = `const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(${JSON.stringify(file)}); db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; BEGIN IMMEDIATE; ALTER TABLE wa_jobs ADD COLUMN prepared_at TEXT;"); process.stdout.write("YARIM\\n"); setInterval(() => {}, 1000);`;
      const child = spawn(process.execPath, ["--no-warnings", "-e", code], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", chunk => (out += chunk));
      const exited = new Promise(resolve => child.once("exit", (c, s) => resolve(s)));
      await until(() => out.includes("YARIM"), 10_000, "yarım göç");
      child.kill("SIGKILL");
      await exited;
      const r = { olumSonrasiSurum: ver(file), olumSonrasiSutun: cols(file).includes("prepared_at"), butunluk: query(file, "PRAGMA integrity_check")[0].integrity_check };
      await fullOpenAndSend(root, r);
      console.log(`# T6h2 ${JSON.stringify(r)}`);
      assert.equal(r.olumSonrasiSurum, 40);
      assert.equal(r.olumSonrasiSutun, false, "COMMIT'siz ALTER geri alındı");
      assert.equal(r.acilistaSurum, 41);
      assert.equal(r.acilistaSutunlar, true);
      assert.equal(r.giden, N);
    } finally {
      rmrf(root);
    }
  });

  it("h3: göç sırasında disk DOLU (tmpfs) → program açılmaz/açık hata, dosya v40 ve sağlam; yer açılınca v41, gönderim bir kez", { timeout: 200_000 }, async () => {
    const root = freshDir("h3");
    const mount = path.join(root, "m");
    const umount = mountTmpfs(mount, "24m");
    try {
      cpSync(template, mount, { recursive: true });
      const filler = path.join(mount, "dolgu.bin");
      const fd = openSync(filler, "a");
      for (const size of [1 << 20, 4096, 512]) {
        try {
          for (;;) writeSync(fd, Buffer.alloc(size));
        } catch (error) {
          if (error.code !== "ENOSPC") throw error;
        }
      }
      closeSync(fd);
      const r = {};
      try {
        const prog = await startChild({ dataDir: path.join(mount, "data"), backupDir: path.join(mount, "backups"), fake, now: "2026-11-03T10:00:00+03:00" });
        r.doluyken = "açıldı";
        r.doluyken_surum = ver(companyDb(path.join(mount, "data")));
        await prog.stop();
      } catch (error) {
        r.doluyken = `açılmadı: ${String(error.message).replace(/\s+/g, " ").slice(-500)}`;
      }
      const file = companyDb(path.join(mount, "data"));
      r.doluSonrasiSurum = ver(file);
      r.butunluk = query(file, "PRAGMA integrity_check")[0].integrity_check;
      unlinkSync(filler);
      await fullOpenAndSend(mount, r);
      console.log(`# T6h3 ${JSON.stringify(r)}`);
      assert.equal(r.butunluk, "ok");
      assert.equal(r.acilistaSurum, 41);
      assert.ok(r.giden <= N);
    } finally {
      umount();
      rmrf(root);
    }
  });
});
