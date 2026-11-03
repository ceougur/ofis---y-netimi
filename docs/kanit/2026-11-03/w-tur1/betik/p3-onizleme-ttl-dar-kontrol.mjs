// Dar kontrol W — P3: W-2b (önizlemenin taze şablon okuması kayda yazılır) "Süresi Doldu" kararını değiştiriyor mu?
// Senaryo: ekstre A'ya gitti (Meta Kabul Etti, bildirim yolu canlı), o an Meta listesinde teslim süresi YOK (30 gün). 14 saat sonra Meta listesi şablonda 12 saat
// (43.200 sn) bildiriyor (müşteri WhatsApp Yöneticisi'nde değiştirdi). Kullanıcı Şablonları Denetle'ye BASMADAN yalnız yeni bir önizleme yapar.
// Ölçülen: önizlemeden sonra bakım A'nın işini "Süresi Doldu" yapar mı; A aynı dönemde yeniden "gönderilecek" mi; ikinci toplu işte A'ya kaçıncı ileti gider.
// Yol: "onizleme" (Denetle yok) ve "denetle" (kullanıcı Denetle'ye bastı — 2.4.8'de de olan yol).
// Kullanım: node p3-onizleme-ttl.mjs <kod kopyası kökü> <onizleme|denetle>
import path from "node:path";
import { pathToFileURL } from "node:url";

const [rootArg, mode = "onizleme"] = process.argv.slice(2);
const root = path.resolve(rootArg);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { URLS, startWa } = await imp("test/whatsapp-248-ortak.mjs");
const HOUR = 3_600_000;
const ENSURE = "/api/workspace/whatsapp/templates/ensure";
const ctx = await startWa();
try {
  ctx.fake.state.ttlRange = [30, 43_200]; // gerçek Meta gibi (eski kodun 259.200 denemesi reddedilir)
  console.log("Denetle 1:", (await ctx.api.post(ENSURE, {})).status);
  const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
  const body = { kind: "statement", ids: [a.id], preset: "thisMonth" };
  const first = await ctx.batch(body);
  await ctx.drain();
  const job = (await ctx.jobs(first.data.data.batch.id))[0];
  ctx.statuses([{ id: job.wamid, status: "sent", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]);
  console.log("1. iş:", job.state, "giden ileti:", ctx.messages().length);
  ctx.clock.advance(14 * HOUR);
  for (const t of ctx.fake.state.templates) if (t.name.startsWith("destekofis_")) t.message_send_ttl_seconds = 43_200;
  if (mode === "denetle") console.log("Denetle 2:", (await ctx.api.post(ENSURE, {})).status);
  const p1 = await ctx.api.post(URLS.preview, body);
  console.log("önizleme 1 (14. saat):", p1.status, "A:", p1.data.data?.people?.[0]?.skip || "gönderilecek");
  await ctx.drain(); // bakım
  console.log("bakımdan sonra 1. iş:", (await ctx.jobs(first.data.data.batch.id))[0].state, "| kayıttaki TTL:", JSON.parse(ctx.store.setting("whatsapp.templates", "{}")).items?.find(i => i.name === "destekofis_ekstre")?.meta?.message_send_ttl_seconds ?? "yok");
  const p2 = await ctx.api.post(URLS.preview, body);
  console.log("önizleme 2:", p2.status, "A:", p2.data.data?.people?.[0]?.skip || "gönderilecek");
  const second = await ctx.batch({ ...body, requestId: "ikinci-1" });
  console.log("2. toplu iş:", second.status, second.data?.error || second.data?.data?.batch?.state || "");
  await ctx.drain();
  const toA = ctx.messages().filter(m => String(m.to || m.body?.to || "").endsWith("5321112233")).length;
  console.log(`SONUC kod=${path.basename(root)} yol=${mode} A'ya aynı dönemde giden ileti=${toA} (toplam ${ctx.messages().length})`);
} finally {
  await ctx.close();
}
