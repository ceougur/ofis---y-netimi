// 2.5.0 WhatsApp tur 3 — dar kontrol DÜŞÜK-1 fikstürü (KAYIT 06.11 18:47; betik scratchpad/dk-wa2c3-betik/f2-eski-veri-hata-metni.mjs düzeni): tur 2'den ÖNCEKİ kodun (329d5d1b =
// WhatsApp tur 1 + W-3) GERÇEK koduyla (git archive; ders 23) programın KENDİ API'si ve işçisiyle üretilir. Senaryo (S42 + Meta hatası): A'nın isteği Meta'dayken (sahte Graph kapısı)
// KVKK talebi — içerik + telefon talep anında silinir; istek bırakılınca Meta 131009 hatası döner, ayrıntısında numara ("+90 532 111 22 33"). Eski kod metni silinmiş satıra AYNEN yazar
// (tur 2'nin updateJob scrubDigits CASE'i yok). B (Bora) talepsiz, Başarısız değil — karşılaştırma (dokunulmaz). Program kapanır.
// Beklenen eski kod sonucu: A'nın satırı içeriği silinmiş + hata metninde numara; veri klasöründe numara (destekofis.sqlite).
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node uret.mjs <329d5d1b kökü> <çıktı klasörü>   (sonra *.sqlite gzip'lenir; secret.key fikstüre GİRMEZ)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, out] = process.argv.slice(2);
if (process.env.HUKUK_LICENSE_URL !== "http://127.0.0.1:9") throw new Error("ders 30");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const ortak = await imp("test/whatsapp-248-ortak.mjs");
const dataDir = path.join(out, "data");
const backupDir = path.join(out, "backups");
mkdirSync(out, { recursive: true });
const NEEDLE = "+90 532 111 22 33";
const ok = (res, label) => {
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};
const metaBody = (code, details) => ({ error: { message: `(#${code}) Invalid parameter`, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details }, fbtrace_id: "x" } });
const info = { kod: "329d5d1b (2.5.0 WhatsApp tur 1 + W-3)", node: process.version };
const ctx = await ortak.startWa({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, dataDir, backupDir, whatsappTimeoutMs: 60_000, now: { time: new Date(2026, 10, 3, 10).toISOString(), fixed: true } });
try {
  const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
  const b = await ctx.account("Bora Demir", "0533 444 55 66", 300);
  const madeB = ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "B");
  await ctx.drain();
  let release;
  ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
  ctx.fake.state.failQueue.push({ match: /messages/, status: 400, body: metaBody(131009, `Parameter value is not valid: to ${NEEDLE}`) });
  const madeA = ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "A");
  const run = ctx.drain();
  for (let i = 0; i < 2000 && !(ctx.fake.state.held >= 1); i += 1) await new Promise(r => setTimeout(r, 10));
  if (ctx.fake.state.held !== 1) throw new Error("ön koşul: A'nın isteği Meta'da değil");
  const er = await ctx.api.post("/api/workspace/whatsapp/kvkk-erase", { accountId: a.id, confirm: true });
  ctx.fake.state.hold = null;
  release();
  await run;
  const rowA = ctx.store.get("SELECT id, state, params_json AS p, error_text AS t FROM wa_jobs WHERE batch_id = ?", madeA.batch.id);
  const rowB = ctx.store.get("SELECT id, state, error_text AS t FROM wa_jobs WHERE batch_id = ?", madeB.batch.id);
  info.talep = er.status;
  info.accounts = { A: a.id, B: b.id };
  info.jobs = { A: { id: rowA.id, state: rowA.state, erased: rowA.p.startsWith("{"), numberInText: rowA.t.includes(NEEDLE) }, B: { id: rowB.id, state: rowB.state } };
  info.at = new Date(ctx.clock.ms()).toISOString();
  info.version = ctx.server.app.store.get("PRAGMA user_version").user_version;
} finally {
  await ctx.close();
}
info.dosyadaNumara = readFileSync(path.join(dataDir, "destekofis.sqlite")).includes(Buffer.from(NEEDLE));
writeFileSync(path.join(out, "bilgi.json"), `${JSON.stringify(info, null, 1)}\n`);
console.log(JSON.stringify(info));
