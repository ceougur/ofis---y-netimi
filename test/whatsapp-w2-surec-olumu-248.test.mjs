// 2.4.8 W2 ARIZA (plan §9 "'Gönderiliyor' anında süreç öldürülür → yeniden başlat: çift yok, kayıp yok"; §8 ÇİFT "yanıt gelmeden program kapanır / elektrik gider";
// "medya yüklendi, ileti yanıtsız"): GERÇEK program ayrı süreçte (test/fixtures/wa-surec-cocuk.mjs), işçi kendi zamanlayıcısıyla gönderirken SIGKILL. Sonra aynı veri
// klasörüyle yeniden açılır: (1) istek Meta'dayken öldü → "Sonucu Belirsiz", kendiliğinden YENİDEN GÖNDERİLMEZ (sahte Meta'nın kaydında tek istek);
// (2) PDF yüklenirken öldü → iş "Bekliyor"a döner ve BİR kez gider. Sayılar sahte Meta'nın kaydından (ders 3). Lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { removeTestDir } from "./helpers.mjs";
// Lisans servisi ölü yerel adres (ders 30; test/lisans-servisi-izolasyonu.test.mjs DEAD_LICENSE_URL ile aynı).
const DEAD_LICENSE_URL = "http://127.0.0.1:9";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, PROGRAM_TEMPLATES, TOKEN, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "wa-surec-cocuk.mjs");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await wait(25);
  }
  throw new Error(`${what}: ${ms} ms içinde olmadı`);
}

async function killDuring(hang) {
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  fake.state.templates.push(...PROGRAM_TEMPLATES());
  fake.state.hang = hang;
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-w2-olum-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const child = spawn(process.execPath, ["--no-warnings", CHILD, dataDir, backupDir, fake.url, "w2-olum-000001"], { env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", chunk => (out += chunk));
  child.stderr.on("data", chunk => (out += chunk));
  const exited = new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
  try {
    const ready = await until(() => out.split("\n").map(line => { try { return JSON.parse(line); } catch { return null; } }).find(item => item?.ready), 30_000, `çocuk hazır (${out.slice(-400)})`);
    assert.equal(ready.status, 200, out);
    const target = hang.source.includes("messages") ? "/messages" : "/media";
    await until(() => fake.requests.some(item => item.method === "POST" && item.path.endsWith(target)), 20_000, `istek Meta'da (${target})`);
    child.kill("SIGKILL");
    const end = await exited;
    // Windows'ta öldürülen süreç sinyal adıyla değil sıfır olmayan çıkış koduyla biter.
    assert.ok(process.platform === "win32" ? end.code !== 0 : end.signal === "SIGKILL", `süreç öldürüldü (${JSON.stringify(end)})`);
    fake.state.hang = null;
    return { fake, root, dataDir, backupDir, batchId: ready.batchId };
  } catch (error) {
    child.kill("SIGKILL");
    await fake.close();
    removeTestDir(root);
    throw error;
  }
}

describe("2.4.8 W2 — gönderim ortasında süreç ölümü (SIGKILL)", () => {
  it("ileti isteği Meta'dayken süreç öldü → yeniden açılışta Sonucu Belirsiz; kendiliğinden ikinci istek YOK", async () => {
    const { fake, root, dataDir, backupDir, batchId } = await killDuring(/^POST \/106540352242922\/messages$/);
    let ctx = null;
    try {
      const messageRequests = () => fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/messages")).length;
      assert.equal(messageRequests(), 1);
      ctx = await startWa({ dataDir, backupDir, fake, connect: false, ack: false });
      const job = (await ctx.jobs(batchId))[0];
      assert.equal(job.state, "uncertain", JSON.stringify(job));
      assert.match(job.reason, /program kapandı/);
      assert.deepEqual(ctx.wa.ledger.attempts(job.id).map(item => item.outcome), ["uncertain"], "defterde talep + belirsiz sonuç");
      for (let i = 0; i < 3; i += 1) {
        ctx.clock.advance(3_600_000);
        await ctx.drain();
      }
      assert.equal(messageRequests(), 1, "kendiliğinden yeniden gönderilmedi (çift ileti yok)");
      assert.equal((await ctx.detail(batchId)).state, "done", "belirsiz iş toplu işi bitirmeye engel değil");
    } finally {
      await ctx?.server.close();
      await fake.close();
      removeTestDir(root);
    }
  });

  it("PDF Meta'ya yüklenirken süreç öldü → yeniden açılışta iş Bekliyor; ileti BİR kez gider (yarım medya 30 günde Meta'da düşer)", async () => {
    const { fake, root, dataDir, backupDir, batchId } = await killDuring(/^POST \/106540352242922\/media$/);
    let ctx = null;
    try {
      ctx = await startWa({ dataDir, backupDir, fake, connect: false, ack: false });
      const job = (await ctx.jobs(batchId))[0];
      assert.equal(job.state, "pending", JSON.stringify(job));
      assert.deepEqual(ctx.wa.ledger.attempts(job.id), [], "ileti denenmedi");
      await ctx.drain();
      const after = (await ctx.jobs(batchId))[0];
      assert.equal(after.state, "accepted");
      assert.equal(fake.state.messages.length, 1, "tek ileti");
    } finally {
      await ctx?.server.close();
      await fake.close();
      removeTestDir(root);
    }
  });
});
