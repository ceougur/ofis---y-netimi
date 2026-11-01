// 2.4.8 İş Q3 (dar kontrol 10 DÜŞÜK-3; "KİME KAÇ KEZ" ilkesi 2 + 5): ileti isteği Meta'dayken (Gönderiliyor) süreç öldü ve veri gönderim defteri OLMADAN başka bilgisayara
// taşındı. Yeni bilgisayarda talep (claims) yok; iş "Bekliyor"a dönüp toplu iş "Taşınan Veri — Durduruldu" ile duruyor, kişi elenmiyordu → yeni gönderim aynı kişiye
// İKİNCİ istek (dar kontrol 10 b3: kişiye 2 istek). Şimdi iş "Sonucu Belirsiz" (deneme numarası korunur): yeni gönderim "Sonucu Belirsiz" ile eler; göndermek için
// işteki "Yine de Gönder" (onaylı). Aynı bilgisayarda talepsiz Gönderiliyor → Bekliyor (istek gitmedi) DEĞİŞMEDİ: test/whatsapp-w2-surec-olumu-248.test.mjs.
// Düzenek: GERÇEK program ayrı süreçte (test/fixtures/wa-surec-cocuk.mjs) + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sayılar sahte Meta'nın kaydından (ders 3).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { removeTestDir } from "./helpers.mjs";
// Lisans servisi ölü yerel adres (ders 30).
const DEAD_LICENSE_URL = "http://127.0.0.1:9";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

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
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-q3-tasinan-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const child = spawn(process.execPath, ["--no-warnings", CHILD, dataDir, backupDir, fake.url, "q3-tasi-000001"], { env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, stdio: ["ignore", "pipe", "pipe"] });
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

const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");

describe("2.4.8 İş Q3 — taşınan veride Gönderiliyor'da kalmış iş Sonucu Belirsiz", () => {
  it("istek Meta'dayken süreç öldü, veri defter olmadan taşındı → iş Sonucu Belirsiz (deneme 1); yeni gönderim kişiyi eler (ikinci istek yok); Yine de Gönder gider", { timeout: 120_000 }, async () => {
    const { fake, root, dataDir, backupDir, batchId } = await killDuring(/^POST \/106540352242922\/messages$/);
    let ctx = null;
    try {
      const messageRequests = () => fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/messages")).length;
      assert.equal(messageRequests(), 1, "ön koşul: istek Meta'da");
      const moved = path.join(root, "tasindi");
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) rmSync(path.join(moved, name), { force: true });
      ctx = await startWa({ dataDir: moved, backupDir, fake, connect: false, ack: false });
      const job = (await ctx.jobs(batchId))[0];
      assert.deepEqual([job.state, job.attempt], ["uncertain", 1], `taşınan veride iş Sonucu Belirsiz, deneme korunur (geldi ${JSON.stringify(job)})`);
      assert.match(job.reason, /başka bilgisayarda/);
      assert.equal((await ctx.detail(batchId)).state, "stopped", "toplu iş Taşınan Veri — Durduruldu");
      const accountId = job.accountId;
      const body = { kind: "statement", ids: [accountId], preset: "thisMonth" };
      const pv = await ctx.api.post(URLS.preview, body);
      assert.equal(pv.status, 200, JSON.stringify(pv.data));
      assert.deepEqual(skipOf(pv.data.data), ["Sonucu Belirsiz"], "yeni gönderimde kişi Sonucu Belirsiz ile elenir");
      const again = await ctx.batch(body);
      if (again.status === 200) await ctx.drain();
      assert.equal(messageRequests(), 1, `yeni gönderim kişiye ikinci istek göndermedi (yanıt ${again.status})`);
      const anyway = await ctx.api.post(`/api/workspace/whatsapp/jobs/${job.id}/send-anyway`, { confirm: true });
      assert.equal(anyway.status, 200, `işteki Yine de Gönder açıldı (${anyway.status} ${JSON.stringify(anyway.data)})`);
      await ctx.drain();
      assert.equal(messageRequests(), 2, "Yine de Gönder (onaylı) kişiye gitti");
    } finally {
      await ctx?.server.close();
      await fake.close();
      removeTestDir(root);
    }
  });
});
