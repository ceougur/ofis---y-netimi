// DAR KONTROL betik f2 — W-3 dk ORTA-2'nin ESKİ VERİSİ: tur 2'den önceki kodun (ESKI kökü) silinmiş işe talepten SONRA yazdığı numaralı Meta hata metni, yeni kodla (YENI kökü)
// açılış + bakım turu + saklama süpürmesinden sonra veri klasöründe kalıyor mu? Veri ESKİ kodun kendi API'siyle üretilir (S42: istek Meta'dayken talep, Meta 131009 hatası).
// Kullanım: ESKI=<kök> YENI=<kök> node f2-eski-veri-hata-metni.mjs
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ESKI = process.env.ESKI;
const YENI = process.env.YENI;
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const HOUR = 3_600_000;
const NEEDLE = "+90 532 111 22 33";
const files = dir => (existsSync(dir) ? readdirSync(dir).flatMap(name => (statSync(path.join(dir, name)).isDirectory() ? files(path.join(dir, name)) : [path.join(dir, name)])) : []);
const hits = dir => files(dir).filter(file => readFileSync(file).includes(Buffer.from(NEEDLE))).map(file => path.relative(dir, file));
const metaBody = (code, details) => ({ error: { message: `(#${code}) Invalid parameter`, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details }, fbtrace_id: "x" } });
const root = mkdtempSync(path.join(tmpdir(), "dk-wa2c3-f2-"));
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
let verdict = 2;
try {
  // 1) ESKİ kod: S42 + Meta hatası (talepten SONRA yazılan numaralı metin)
  {
    const { startWa } = await import(`${ESKI}/test/whatsapp-248-ortak.mjs`);
    const ctx = await startWa({ env: DEAD, dataDir, backupDir, now: { time: new Date(2026, 10, 3, 10).toISOString(), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      let release;
      ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
      ctx.fake.state.failQueue.push({ match: /messages/, status: 400, body: metaBody(131009, `Parameter value is not valid: to ${NEEDLE}`) });
      const made = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data;
      const run = ctx.drain();
      for (let i = 0; i < 800 && !(ctx.fake.state.held >= 1); i += 1) await new Promise(r => setTimeout(r, 10));
      const er = await ctx.api.post("/api/workspace/whatsapp/kvkk-erase", { accountId: a.id, confirm: true });
      ctx.fake.state.hold = null;
      release();
      await run;
      const row = ctx.store.get("SELECT id, state, params_json AS p, error_text AS t FROM wa_jobs WHERE batch_id = ?", made.batch.id);
      console.log(`1) ESKİ kod: talep HTTP ${er.status}; iş ${row.state}, içerik silindi ${row.p.startsWith("{")}; hata metni: "${row.t}"`);
      globalThis.jobId = row.id;
    } finally {
      await ctx.close();
    }
  }
  console.log(`2) ESKİ kod kapandı — veri klasöründe "${NEEDLE}": ${JSON.stringify(hits(dataDir))}`);
  // 2) YENİ kod: aynı veriyle açılış + 2 sa sonra bakım turu (saklama süpürmesi dahil)
  {
    const { startWa } = await import(`${YENI}/test/whatsapp-248-ortak.mjs`);
    const ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, office: null, now: { time: new Date(2026, 10, 3, 12).toISOString(), fixed: true } });
    try {
      await ctx.server.app.context.whatsapp.queue.maintain();
      ctx.clock.advance(2 * HOUR);
      await ctx.server.app.context.whatsapp.queue.maintain();
      const row = ctx.store.get("SELECT error_text AS t FROM wa_jobs WHERE id = ?", globalThis.jobId);
      console.log(`3) YENİ kod: açılış + iki bakım turu sonra hata metni: "${row.t}"`);
    } finally {
      await ctx.close();
    }
  }
  const left = hits(dataDir);
  console.log(`4) YENİ kod kapandı — veri klasöründe "${NEEDLE}": ${JSON.stringify(left)}`);
  verdict = left.length ? 1 : 0;
  console.log(`# SONUÇ: ${verdict ? "eski kodun silinmiş işe yazdığı numaralı metin yeni kodda KALIYOR" : "temizlendi"}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
process.exit(verdict);
