// T6 (h, Aday 2 yeniden koşu T56b) — GÖÇ SIRASINDA KESİNTİ: YENİ göç adımları v41 → v42 (wa_batches.send_again_after) ve v42 → v43 (wa_batches.key_day); T6_ESKI_V = 40 ile v40 → v43 zinciri (aday 1'in v40 → v41 adımı dahil).
// h-goc-kesinti.mjs'in (v40 → v41, aday 1) aynı düzeni; ESKİ verisi eski sürümün GERÇEK koduyla (h-eski-uret.mjs; T6_ESKI = `git archive` kopyası, T6_ESKI_V = 41 | 42;
// v41 = 135946fe, v42 = 83100a79), kuyrukta bekleyen toplu gönderimle. (h1) Aday 2 açılırken 20 farklı anda SIGKILL: her öldürmeden sonra dosya V..43 arası TAM bir
// sürümde (göç adımı başına işlem: sürüm ile sütunlar tutarlı, ARA YOK), bütünlük "ok", sonra tam açılış → v43, iş satırları aynı, bekleyen gönderim BİR kez gider.
// (h2) ZORLA (ders 20): sonraki adımın ALTER'ı ayrı süreçte işlem İÇİNDE yazılır, süreç COMMIT'ten önce SIGKILL → yeni kod temiz v43. (h3) göçte DİSK DOLU (tmpfs).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, closeSync, openSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before, after } from "node:test";
import { DEAD_LICENSE_URL, KOK, companyDb, fakeMeta, freshDir, mountTmpfs, perRecipient, query, rmrf, startChild, until, wait } from "./ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ESKI = process.env.T6_ESKI;
const V = Number(process.env.T6_ESKI_V);
if (!ESKI || ![40, 41, 42].includes(V)) throw new Error("T6_ESKI (eski kodun ayrı kopyası, git archive) ve T6_ESKI_V (40 | 41 | 42) verilmeli");
const SON = 43;
// sürüm → o sürümde OLMASI gereken (yeni) sütunlar: v41 wa_jobs.prepared_at + pdf_blob, v42 wa_batches.send_again_after, v43 wa_batches.key_day (server/lib/migrations.mjs; yalnız ekleyici)
const COLS_AT = v => [["prepared_at", 41], ["pdf_blob", 41], ["send_again_after", 42], ["key_day", 43]].filter(([, at]) => v >= at).map(([name]) => name);
const NEXT = { 40: ["ALTER TABLE wa_jobs ADD COLUMN prepared_at TEXT", "prepared_at"], 41: ["ALTER TABLE wa_batches ADD COLUMN send_again_after TEXT NOT NULL DEFAULT ''", "send_again_after"], 42: ["ALTER TABLE wa_batches ADD COLUMN key_day TEXT NOT NULL DEFAULT ''", "key_day"] }[V];
const NEXT_ALTER = NEXT[0];
const NEXT_COL = NEXT[1];
const N = 5;
let fake;
let template;
let batchId;
const ver = file => query(file, "PRAGMA user_version")[0].user_version;
const cols = file => [...query(file, "PRAGMA table_info(wa_jobs)"), ...query(file, "PRAGMA table_info(wa_batches)")].map(row => row.name);

before(async () => {
  fake = await fakeMeta();
  template = freshDir(`hv-v${V}`);
  // spawnSync DEĞİL: sahte Meta bu süreçte; olay döngüsü tutulursa eski kodun isteği yanıtsız kalır.
  const out = await new Promise(resolve => {
    const child = spawn(process.execPath, ["--no-warnings", path.join(HERE, "h-eski-uret.mjs"), ESKI, path.join(template, "data"), path.join(template, "backups"), fake.url, String(N)], { env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL, TMPDIR: path.join(KOK, "tmp") }, stdio: ["ignore", "pipe", "pipe"] });
    const acc = { stdout: "", stderr: "" };
    child.stdout.on("data", chunk => (acc.stdout += chunk));
    child.stderr.on("data", chunk => (acc.stderr += chunk));
    child.once("exit", () => resolve(acc));
  });
  const line = out.stdout.split("\n").map(item => { try { return JSON.parse(item); } catch { return null; } }).find(Boolean);
  assert.ok(line?.ok, `v${V} verisi üretilemedi: ${out.stdout.slice(-400)} ${out.stderr.slice(-800)}`);
  assert.equal(line.version, V, `eski kod v${V} üretti`);
  batchId = line.batchId;
  console.log(`# T6hv v${V} verisi: ${JSON.stringify({ ...line, isler: query(companyDb(path.join(template, "data")), "SELECT state, COUNT(*) n FROM wa_jobs GROUP BY state") })}`);
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
    r.acilistaSutunlar = COLS_AT(SON).every(name => cols(companyDb(dataDir)).includes(name));
    await until(async () => (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data.state !== "running", 60_000, "bekleyen toplu iş bitti");
    const d = (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data;
    r.toplu = d.state;
    r.isler = d.jobs.map(job => job.state).join(",");
    r.giden = fake.state.messages.length - before;
  } finally {
    await prog.stop();
  }
}

describe(`T6 (h, T56b) — göç sırasında kesinti (v${V} → v43)`, () => {
  it(`h1: Aday 2 açılırken 20 farklı anda SIGKILL → her seferinde v${V}..v43 tam sürüm (ara yok), bütünlük ok; tam açılışta v43 ve bekleyen gönderim bir kez`, { timeout: 600_000 }, async () => {
    const satirlar = [];
    for (let i = 0; i < 20; i += 1) {
      const delay = 40 + i * 100;
      const root = copy(`h1-${i}`);
      const dataDir = path.join(root, "data");
      try {
        const k = await spawnKill(root, delay);
        const file = companyDb(dataDir);
        const r = { delay, olduruldu: k.end.signal, hazirdi: k.ready, surum: ver(file), butunluk: query(file, "PRAGMA integrity_check")[0].integrity_check, sutunlar: cols(file).filter(name => COLS_AT(SON).includes(name)).join(","), isSatiri: query(file, "SELECT COUNT(*) n FROM wa_jobs")[0].n };
        await fullOpenAndSend(root, r);
        satirlar.push(r);
      } finally {
        rmrf(root);
      }
    }
    console.log(`# T6hv1 ${JSON.stringify(satirlar)}`);
    const dagilim = {};
    for (const r of satirlar) dagilim[`v${r.surum}`] = (dagilim[`v${r.surum}`] || 0) + 1;
    console.log(`# T6hv1 öldürme sonrası sürüm dağılımı: ${JSON.stringify(dagilim)}`);
    for (const r of satirlar) {
      assert.ok(r.surum >= V && r.surum <= SON, JSON.stringify(r));
      assert.equal(r.butunluk, "ok");
      assert.equal(r.sutunlar, COLS_AT(r.surum).join(","), `sürüm ile sütunlar tutarlı (ara durum yok): ${JSON.stringify(r)}`);
      assert.equal(r.isSatiri, N);
      assert.equal(r.acilistaSurum, SON);
      assert.equal(r.acilistaSutunlar, true);
      assert.equal(r.toplu, "done");
      if (!r.hazirdi) assert.equal(r.giden, N, `öldürme hazır olmadan: kopya başına bekleyen ${N} kişi tam açılışta bir kez: ${JSON.stringify(r)}`);
    }
    const counts = perRecipient(fake);
    console.log(`# T6hv1 alıcı başına (20 kopya toplamı): ${JSON.stringify(counts)}`);
    assert.ok(Object.values(counts).every(n => n <= 20), `bir kopyada bir kişiye en çok bir ileti (20 kopya): ${JSON.stringify(counts)}`);
  });

  it(`h2 ZORLA: v${V + 1}'in ALTER'ı işlem içinde yazıldı, COMMIT'ten önce süreç öldü → Aday 2 temiz v43'e geçer, bekleyen gönderim bir kez`, { timeout: 200_000 }, async () => {
    const root = copy("h2");
    const file = companyDb(path.join(root, "data"));
    try {
      const code = `const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(${JSON.stringify(file)}); db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; BEGIN IMMEDIATE; ${NEXT_ALTER};"); process.stdout.write("YARIM\\n"); setInterval(() => {}, 1000);`;
      const child = spawn(process.execPath, ["--no-warnings", "-e", code], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", chunk => (out += chunk));
      const exited = new Promise(resolve => child.once("exit", (c, s) => resolve(s)));
      await until(() => out.includes("YARIM"), 10_000, "yarım göç");
      child.kill("SIGKILL");
      await exited;
      const r = { olumSonrasiSurum: ver(file), olumSonrasiSutun: cols(file).includes(NEXT_COL), butunluk: query(file, "PRAGMA integrity_check")[0].integrity_check };
      await fullOpenAndSend(root, r);
      console.log(`# T6hv2 ${JSON.stringify(r)}`);
      assert.equal(r.olumSonrasiSurum, V);
      assert.equal(r.olumSonrasiSutun, false, "COMMIT'siz ALTER geri alındı");
      assert.equal(r.acilistaSurum, SON);
      assert.equal(r.acilistaSutunlar, true);
      assert.equal(r.giden, N);
    } finally {
      rmrf(root);
    }
  });

  it(`h3: göç sırasında disk DOLU (tmpfs) → program açılmaz/açık hata, dosya v${V}..v43 tam sürüm ve sağlam; yer açılınca v43, gönderim bir kez`, { timeout: 200_000 }, async () => {
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
      r.doluSonrasiSutunlar = cols(file).filter(name => COLS_AT(SON).includes(name)).join(","); // göçten (tam açılıştan) ÖNCE okunur
      r.butunluk = query(file, "PRAGMA integrity_check")[0].integrity_check;
      unlinkSync(filler);
      await fullOpenAndSend(mount, r);
      console.log(`# T6hv3 ${JSON.stringify(r)}`);
      assert.equal(r.butunluk, "ok");
      assert.ok(r.doluSonrasiSurum >= V && r.doluSonrasiSurum <= SON);
      assert.equal(r.doluSonrasiSutunlar, COLS_AT(r.doluSonrasiSurum).join(","), "ara durum yok");
      assert.equal(r.acilistaSurum, SON);
      assert.equal(r.giden, N);
    } finally {
      umount();
      rmrf(root);
    }
  });
});
