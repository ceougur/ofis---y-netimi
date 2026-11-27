// WhatsApp tur 2 ölçümü (ders 47): 100.000 iş + 100.000 defter talebi olan kurulumda (a) Yönetim → WhatsApp KVKK araması — Silinenler'deki cariler (kvkk-deleted),
// (b) bakım turu: saatlik süpürme (silinmiş satırın açık wamid özeti dahil pencere sorgusu) + talep yeniden uygulaması (200 talep × 500 iş — defter tarafı) + denetim noktası
// denemesi, (c) boş bakım turu (taban). Yanıt süresi + olay döngüsü en çok gecikme. Veri: programın KENDİ ürettiği 200 ekstre işinin program kapalıyken çoğaltılması (dar kontrol
// W-3 e6 / test/w3-250/olcum-100k.mjs düzeni). Kullanım: ROOT=<kod kökü> VERI=<boş klasör> node olcum.mjs
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const ROOT = process.env.ROOT;
const root = process.env.VERI;
if (!ROOT || !root) throw new Error("ROOT ve VERI gerekli");
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ortak = await import(pathToFileURL(path.join(ROOT, "test/whatsapp-248-ortak.mjs")).href);
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const copies = Number(process.env.KOPYA || 500);
mkdirSync(root, { recursive: true });
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
const T0 = "2026-06-02T07:00:00.000Z";
const out = { kod: ROOT, copies };
let ctx = await ortak.startWa({ env: DEAD, dataDir, backupDir, now: { time: T0, fixed: true } });
const ids = [];
for (let i = 0; i < 200; i += 1) ids.push((await ctx.account(`Ölçüm Carisi ${i}`, `0532 ${String(1000000 + i).slice(0, 3)} ${String(1000000 + i).slice(3, 5)} ${String(1000000 + i).slice(5, 7)}`, 0)).id);
const made = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
await ctx.drain();
for (const job of await ctx.jobs(made.data.data.batch.id)) if (job.wamid) ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(Date.parse(T0) / 1000) + 60), recipient_id: "905" }]);
await ctx.close();
const company = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
const ledger = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"));
const cols = company.prepare("PRAGMA table_info(wa_batches)").all().map(c => c.name);
const jcols = company.prepare("PRAGMA table_info(wa_jobs)").all().map(c => c.name);
const sel = (list, map) => list.map(c => map[c] || c).join(", ");
company.exec("BEGIN");
ledger.exec("BEGIN");
for (let k = 1; k < copies; k += 1) {
  const s = `-k${k}`;
  company.prepare(`INSERT INTO wa_batches (${cols.join(", ")}) SELECT ${sel(cols, { id: "id || ?1", request_key: "NULL" })} FROM wa_batches WHERE id NOT LIKE '%-k%'`).run(s);
  company.prepare(`INSERT INTO wa_jobs (${jcols.join(", ")}) SELECT ${sel(jcols, { id: "id || ?1", batch_id: "batch_id || ?1", wamid: "CASE WHEN wamid IS NULL THEN NULL ELSE wamid || ?1 END" })} FROM wa_jobs WHERE id NOT LIKE '%-k%'`).run(s);
  ledger.prepare("INSERT INTO claims SELECT job_id || ?1, attempt, batch_id || ?1, company_id, waba_id, phone, account_id, kind, period_key, at FROM claims WHERE job_id NOT LIKE '%-k%'").run(s);
  ledger.prepare("INSERT INTO outcomes SELECT job_id || ?1, attempt, outcome, CASE WHEN wamid = '' THEN '' ELSE wamid || ?1 END, at FROM outcomes WHERE job_id NOT LIKE '%-k%'").run(s);
}
company.exec("COMMIT");
ledger.exec("COMMIT");
out.jobs = company.prepare("SELECT COUNT(*) AS n FROM wa_jobs").get().n;
out.claims = ledger.prepare("SELECT COUNT(*) AS n FROM claims").get().n;
company.close();
ledger.close();
let failAnon = false;
ctx = await ortak.startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, whatsappLedgerFault: op => failAnon && op === "anonymize", now: { time: "2026-06-02T09:00:00.000Z", fixed: true } });
try {
  await ctx.wa.scheduler.maintain(); // ısınma
  let maxLag = 0;
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    maxLag = Math.max(maxLag, now - last - 10);
    last = now;
  }, 10);
  const lagOf = async (label, make) => {
    await new Promise(resolve => setTimeout(resolve, 60));
    maxLag = 0;
    const t = performance.now();
    const res = await make();
    await new Promise(resolve => setTimeout(resolve, 60));
    out[label] = { status: res?.status ?? "-", ms: Math.round(performance.now() - t), olayDongusuEnCokMs: Math.round(maxLag), ...(res?.data?.data && Array.isArray(res.data.data) ? { sonuc: res.data.data.length } : {}) };
  };
  // 100 cari Silinenler'e (hareketsiz; WhatsApp kaydı var).
  for (const id of ids.slice(0, 100)) {
    const res = await ctx.api.del(`/api/workspace/accounts/${id}`);
    if (res.status !== 200) throw new Error(`cari silinemedi: ${res.status}`);
  }
  await lagOf("kvkk_arama_ad", () => ctx.api.get(`/api/workspace/whatsapp/kvkk-deleted?q=${encodeURIComponent("Ölçüm Carisi 5")}`));
  await lagOf("kvkk_arama_telefon", () => ctx.api.get(`/api/workspace/whatsapp/kvkk-deleted?q=${encodeURIComponent("0532 100")}`));
  await lagOf("kvkk_arama_eslesmeyen", () => ctx.api.get(`/api/workspace/whatsapp/kvkk-deleted?q=${encodeURIComponent("yokboyle")}`));
  // 200 cari için talep (her biri 500 iş) — yanıt süresi bilgi için; ardından saatlik bakım turu (süpürme + 200 talebin defter yeniden uygulaması + denetim noktası).
  // Talep anında defter YAZILAMAZ (programın kesinti kancası — disk dolu benzetimi): 100.000 iş telefonu / wamid'i defterde açık kalır → bayraklı bakım turu hepsini anonimleştirir.
  const t0 = performance.now();
  failAnon = true;
  for (const id of ids) {
    const res = await ctx.api.post("/api/workspace/whatsapp/kvkk-erase", { accountId: id, confirm: true });
    if (res.status !== 200) throw new Error(`talep: ${res.status}`);
  }
  failAnon = false;
  out.talep200_toplamMs = Math.round(performance.now() - t0);
  out.silinmisIs = ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE params_json LIKE '{%'").n;
  const plainPhones = () => {
    const led = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"), { readOnly: true });
    try {
      return led.prepare("SELECT COUNT(*) AS n FROM claims WHERE phone <> 'silinmis:' || job_id").get().n;
    } finally {
      led.close();
    }
  };
  out.defterAcikTelefon_talepSonrasi = plainPhones();
  await lagOf("bakim_bayrakli_200_talep_100k_is", () => ctx.wa.scheduler.maintain());
  out.defterAcikTelefon_bakimSonrasi = plainPhones();
  ctx.clock.advance(61 * 60_000);
  await lagOf("bakim_saatlik_bayraksiz", () => ctx.wa.scheduler.maintain());
  await lagOf("bakim_bos", () => ctx.wa.scheduler.maintain());
  // Açılıştaki talep uygulaması (recover → reapplyRequests; eşzamanlı, ilk istekten önce): 200 talep, defter temiz.
  await lagOf("acilis_talepler_200_temiz", async () => ctx.server.app.context.whatsapp.queue.reapplyRequests());
  // Açılıştan sonraki ilk bakım turu (açılış yeniden denemeyi kurdu): 200 talebin defter tarafı eşgüçlü denetlenir (temiz — yazım yok).
  await lagOf("bakim_acilis_sonrasi_200_talep_temiz", () => ctx.wa.scheduler.maintain());
  clearInterval(timer);
} finally {
  await ctx.close();
}
console.log(JSON.stringify(out));
