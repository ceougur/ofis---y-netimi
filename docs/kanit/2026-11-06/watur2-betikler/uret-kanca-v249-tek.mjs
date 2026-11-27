// 2.5.0 WhatsApp tur 2 — İş 1 (tur 1 dk ORTA-1) + İş 3 (S63 göçü, tek uygulama) fikstürü: v2.4.9'un GERÇEK koduyla (git archive v2.4.9 = ccf0b0ca) programın KENDİ API'sinden
// ve KENDİ işçisinden üretilir (CLAUDE.md TEST VERİSİ kuralı; ders 23: eski kod ayrı kopyada). Kopyalama / elle SQL YOK. Dar kontrol tur 1 betiği f1'in 1. aşaması.
// Senaryo: tek şirket, Yol 1 (Elle Bağla), şablonun teslim süresi 12 sa (Meta listesinde). Bildirim Yolu → Yeniden Kaydet (Meta'ya alternatif adres). Ayşe'ye ekstre → Meta Kabul
// Etti (teslim bilgisi YOK). 1 dk sonra WABA'nın alternatif adresine wamid'i TANINMAYAN imzasız "delivered" (bu kurulumun göndermediği ileti) → v2.4.9 WABA düzeyi hook_seen
// satırı yazar, şirket işareti YOK.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node uret-kanca-v249-tek.mjs <v2.4.9 kökü> <çıktı klasörü>
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const [root, out] = process.argv.slice(2);
if (process.env.HUKUK_LICENSE_URL !== "http://127.0.0.1:9") throw new Error("ders 30");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { startWa, WABA, PNID, URLS } = await imp("test/whatsapp-248-ortak.mjs");
const dataDir = path.join(out, "data");
const backupDir = path.join(out, "backups");
mkdirSync(out, { recursive: true });
const PUBLIC = "http://ofis-watur2.destekofis.test";
function raw(base, method, p, body) {
  const url = new URL(base);
  const payload = body ? Buffer.from(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: p, headers: payload ? { "content-type": "application/json", "content-length": payload.length } : {} }, res => {
      const parts = [];
      res.on("data", c => parts.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const ok = (res, label) => {
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};
const info = { kod: "v2.4.9 (ccf0b0ca)", node: process.version };
const ctx = await startWa({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, dataDir, backupDir });
try {
  for (const tpl of ctx.fake.state.templates) if (String(tpl.name).startsWith("destekofis_")) tpl.message_send_ttl_seconds = 43_200;
  ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
  const base = `http://127.0.0.1:${(await ctx.server.app.listenRemote(0, "127.0.0.1")).port}`;
  ok(await ctx.api.post(`${URLS.conn}/hook`, {}), "Bildirim Yolu kaydı");
  const secret = new URL(ctx.fake.state.override).pathname.split("/").pop();
  const account = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 800);
  const batch = ok(await ctx.batch({ kind: "statement", ids: [account.id], preset: "thisMonth" }), "toplu iş");
  await ctx.drain();
  const job = (await ctx.jobs(batch.batch.id))[0];
  if (job.state !== "accepted") throw new Error(`iş: ${job.state}`);
  ctx.clock.advance(60_000);
  const ts = String(Math.floor(ctx.clock.ms() / 1000));
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses: [{ id: "wamid.BASKA-ARAC-WATUR2", status: "delivered", timestamp: ts, recipient_id: "905339998877" }] } }] }] });
  const res = await raw(base, "POST", `/wa/kanca/${secret}`, body);
  if (res.status !== 200) throw new Error(`tanınmayan bildirim: ${res.status}`);
  const preview = ok(await ctx.api.post(URLS.preview, { kind: "statement", ids: [account.id], preset: "thisMonth" }), "önizleme");
  info.publicUrl = PUBLIC;
  info.secretPath = secret; // test kurulumunun gizli yolu (gerçek kurulum değil) — yeni testte Meta'nın (vekilin) kayıtlı adresi olarak kurulur
  info.accountId = account.id;
  info.batchId = batch.batch.id;
  info.jobId = job.id;
  info.jobState = job.state;
  info.wamid = job.wamid;
  info.unknownStatus = res.status;
  info.previewSkip = (preview.people || []).map(p => p.skip || "gönderilecek");
  info.at = new Date(ctx.clock.ms()).toISOString();
  info.companyMark = ctx.store.setting("whatsapp.hookSeen", "");
  const ledger = new DatabaseSync(ctx.wa.ledger.file, { readOnly: true });
  try {
    info.hookSeenRows = ledger.prepare("SELECT COUNT(*) AS n FROM hook_seen").get().n;
    info.hookEvents = ledger.prepare("SELECT COUNT(*) AS n FROM hook_events").get().n;
    info.hookColumns = ledger.prepare("SELECT name FROM pragma_table_info('hook_events')").all().map(r => r.name);
  } finally {
    ledger.close();
  }
  info.version = ctx.server.app.store.get("PRAGMA user_version").user_version;
} finally {
  await ctx.close();
}
writeFileSync(path.join(out, "bilgi.json"), `${JSON.stringify(info, null, 1)}\n`);
console.log(JSON.stringify(info));
