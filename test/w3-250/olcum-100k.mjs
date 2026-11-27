// 2.5.0 W-3 ÖLÇÜM (ders 47: yeni toplu yol büyük veride erken ölçülür; ders 15: ölçümler tek tek — `flock <not defteri>/olcum.lock`): 100.000 iş satırında 1 yıl süpürmesi.
// Veri: programın KENDİSİNİN ürettiği gönderimler (gerçek program + yerel sahte Graph; 200 cari → 200 ekstre işi, kabul + teslim) program kapalıyken SQL ile çoğaltılır
// (toplu iş + iş + defter talebi / sonucu; her kopya yeni kimlik ve yeni wamid) → 100.000 iş, 100.000 defter talebi; hepsi 1 yıldan eski. Sonra program bir yıl sonraki saatle
// açılır ve ilk bakım turu (süpürme) ölçülür: toplam süre, olay döngüsü en çok gecikmesi (10 ms sayaç) ve süpürme sürerken başka kullanıcının isteğinin (Gönderimler listesi) yanıt süresi.
// Kullanım: node test/w3-250/olcum-100k.mjs <çalışma klasörü> [kopya=500]   (çıktı JSON stdout'a)
// Ders 30: lisans servisi ölü yerel adres. Ders 13: sahte saat.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { startWa, URLS } from "../whatsapp-248-ortak.mjs";

const root = process.argv[2];
const copies = Number(process.argv[3] || 500);
if (!root) throw new Error("çalışma klasörü verin");
mkdirSync(root, { recursive: true });
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
const env = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const T0 = "2025-06-02T07:00:00.000Z";
const T1 = "2026-06-03T07:00:00.000Z";
const out = { copies };

// 1. Program kendi verisini üretir: 200 cari, tek toplu iş, 200 ekstre (kabul + teslim).
let ctx = await startWa({ env, dataDir, backupDir, now: { time: T0, fixed: true } });
const ids = [];
for (let i = 0; i < 200; i += 1) ids.push((await ctx.account(`Ölçüm Carisi ${i}`, `0532 ${String(1000000 + i).slice(0, 3)} ${String(1000000 + i).slice(3, 5)} ${String(1000000 + i).slice(5, 7)}`, 100 + i)).id);
const made = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
assert.equal(made.status, 200, JSON.stringify(made.data));
await ctx.drain();
for (const job of await ctx.jobs(made.data.data.batch.id)) if (job.wamid) ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(Date.parse(T0) / 1000) + 60), recipient_id: "905" }]);
await ctx.close();

// 2. Çoğaltma (program kapalı): şirket dosyası + makine defteri.
const company = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
const ledger = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"));
const t2 = performance.now();
company.exec("BEGIN");
ledger.exec("BEGIN");
for (let k = 1; k < copies; k += 1) {
  const s = `-k${k}`;
  company.prepare(`INSERT INTO wa_batches SELECT id || ?, kind, period_from, period_to, preset, template, lang, phone_number_id, waba_id, ledger_id, company_id, state, pause_reason, pause_code, NULL, retry_at, troubles, offline_tries, created_by, created_at, updated_at, finished_at, send_again_after, key_day FROM wa_batches WHERE id NOT LIKE '%-k%'`).run(s);
  company.prepare(`INSERT INTO wa_jobs (id, batch_id, account_id, account_name, phone_e164, template, lang, params_json, pdf_name, period_from, period_to, state, skip_reason, media_id, media_at, media_deleted_at, media_delete_tries, wamid, attempt, temp_tries, error_code, error_text, next_at, retry_131049, sending_at, accepted_at, sent_at, delivered_at, read_at, failed_at, closed_at, billable, created_at, updated_at, prepared_at, pdf_blob, inherit_of)
    SELECT id || ?1, batch_id || ?1, account_id, account_name, phone_e164, template, lang, params_json, pdf_name, period_from, period_to, state, skip_reason, media_id, media_at, media_deleted_at, media_delete_tries, CASE WHEN wamid IS NULL THEN NULL ELSE wamid || ?1 END, attempt, temp_tries, error_code, error_text, next_at, retry_131049, sending_at, accepted_at, sent_at, delivered_at, read_at, failed_at, closed_at, billable, created_at, updated_at, prepared_at, pdf_blob, inherit_of FROM wa_jobs WHERE id NOT LIKE '%-k%'`).run(s);
  ledger.prepare("INSERT INTO claims SELECT job_id || ?1, attempt, batch_id || ?1, company_id, waba_id, phone, account_id, kind, period_key, at FROM claims WHERE job_id NOT LIKE '%-k%'").run(s);
  ledger.prepare("INSERT INTO outcomes SELECT job_id || ?1, attempt, outcome, CASE WHEN wamid = '' THEN '' ELSE wamid || ?1 END, at FROM outcomes WHERE job_id NOT LIKE '%-k%'").run(s);
}
company.exec("COMMIT");
ledger.exec("COMMIT");
out.jobs = company.prepare("SELECT COUNT(*) AS n FROM wa_jobs").get().n;
out.claims = ledger.prepare("SELECT COUNT(*) AS n FROM claims").get().n;
out.cogaltmaMs = Math.round(performance.now() - t2);
company.close();
ledger.close();

// 3. Bir yıl sonra açılış + ilk bakım turu (süpürme) ölçümü.
const t3 = performance.now();
ctx = await startWa({ env, dataDir, backupDir, connect: false, ack: false, now: { time: T1, fixed: true } });
out.acilisMs = Math.round(performance.now() - t3);
let maxLag = 0;
let last = performance.now();
const timer = setInterval(() => {
  const now = performance.now();
  maxLag = Math.max(maxLag, now - last - 10);
  last = now;
}, 10);
const listAt = performance.now();
let listMs = null;
const listing = ctx.api.get(`${URLS.batches}?limit=30`).then(res => {
  listMs = Math.round(performance.now() - listAt);
  return res.status;
});
const t4 = performance.now();
await ctx.wa.scheduler.maintain();
out.supurmeMs = Math.round(performance.now() - t4);
out.listeDurum = await listing;
out.listeYanitMs = listMs;
await new Promise(resolve => setTimeout(resolve, 60));
clearInterval(timer);
out.olayDongusuEnCokMs = Math.round(maxLag);
out.silinen = ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE params_json LIKE '{%'").n;
out.acikTelefon = ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE phone_e164 <> ''").n;
const l2 = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"), { readOnly: true });
out.defterAcikTelefon = l2.prepare("SELECT COUNT(*) AS n FROM claims WHERE substr(phone, 1, 9) <> 'silinmis:'").get().n;
out.defterAcikWamid = l2.prepare("SELECT COUNT(*) AS n FROM outcomes WHERE wamid <> '' AND substr(wamid, 1, 2) <> 'h:'").get().n;
l2.close();
// İkinci tur (aynı saat + 1 sa): yapılacak iş yok — ucuz olmalı. Süpürme tek başına ve bakım turu bütünü ayrı ölçülür (olay döngüsü de).
ctx.clock.advance(3_600_001);
maxLag = 0;
last = performance.now();
const timer2 = setInterval(() => {
  const now = performance.now();
  maxLag = Math.max(maxLag, now - last - 10);
  last = now;
}, 10);
const t5 = performance.now();
await ctx.server.app.context.whatsapp.queue.sweepRetention({ force: true });
out.ikinciSupurmeMs = Math.round(performance.now() - t5);
const t6 = performance.now();
ctx.clock.advance(3_600_001);
await ctx.wa.scheduler.maintain();
out.ikinciBakimTuruMs = Math.round(performance.now() - t6);
await new Promise(resolve => setTimeout(resolve, 60));
clearInterval(timer2);
out.ikinciOlayDongusuEnCokMs = Math.round(maxLag);
await ctx.close();
console.log(JSON.stringify(out));
