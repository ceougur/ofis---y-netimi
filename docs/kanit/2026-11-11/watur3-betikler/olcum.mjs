// WhatsApp tur 3 ölçümü (ders 47 / 53): 100.000 iş + 100.000 defter talebi olan kurulumda (a) durum bildirimi işleme yolu (S70 zincir okuması + S90 işaret kapısı) — 1.000 teslim
// bildirimi (her biri ayrı çağrı, kanca gibi), (b) açılıştan sonraki ilk bakım turu (bayraklı defter yeniden uygulaması: 200 talep × 500 iş) — temiz veri ve (c) DÜŞÜK-1'in en kötü durumu:
// silinmiş 100.000 satırın hepsinde numaralı eski hata metni. Yanıt süresi + olay döngüsü en çok gecikme; /proc/loadavg. Veri: programın KENDİ ürettiği 200 ekstre işinin (Meta Kabul
// Etti) program kapalıyken çoğaltılması (watur2 olcum.mjs / test/w3-250/olcum-100k.mjs düzeni).
// Kullanım: KIP=uret ROOT=<kod> SABLON=<boş klasör> node olcum.mjs   (veri şablonu)
//           KIP=olc  ROOT=<kod> SABLON=<şablon> VERI=<boş klasör> node olcum.mjs   (şablonun kopyasında ölçüm)
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const { KIP, ROOT, SABLON, VERI } = process.env;
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ortak = await import(pathToFileURL(path.join(ROOT, "test/whatsapp-248-ortak.mjs")).href);
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const T0 = "2026-06-02T07:00:00.000Z";
const loadavg = () => readFileSync("/proc/loadavg", "utf8").trim();

if (KIP === "uret") {
  const dataDir = path.join(SABLON, "data");
  mkdirSync(dataDir, { recursive: true });
  const ctx = await ortak.startWa({ env: DEAD, dataDir, backupDir: path.join(SABLON, "backups"), now: { time: T0, fixed: true } });
  const ids = [];
  for (let i = 0; i < 200; i += 1) ids.push((await ctx.account(`Ölçüm Carisi ${i}`, `0532 ${String(1000000 + i).slice(0, 3)} ${String(1000000 + i).slice(3, 5)} ${String(1000000 + i).slice(5, 7)}`, 0)).id);
  await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
  await ctx.drain();
  await ctx.close();
  const company = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
  const ledger = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"));
  const cols = company.prepare("PRAGMA table_info(wa_batches)").all().map(c => c.name);
  const jcols = company.prepare("PRAGMA table_info(wa_jobs)").all().map(c => c.name);
  const sel = (list, map) => list.map(c => map[c] || c).join(", ");
  company.exec("BEGIN");
  ledger.exec("BEGIN");
  for (let k = 1; k < 500; k += 1) {
    const s = `-k${k}`;
    company.prepare(`INSERT INTO wa_batches (${cols.join(", ")}) SELECT ${sel(cols, { id: "id || ?1", request_key: "NULL" })} FROM wa_batches WHERE id NOT LIKE '%-k%'`).run(s);
    company.prepare(`INSERT INTO wa_jobs (${jcols.join(", ")}) SELECT ${sel(jcols, { id: "id || ?1", batch_id: "batch_id || ?1", wamid: "CASE WHEN wamid IS NULL THEN NULL ELSE wamid || ?1 END" })} FROM wa_jobs WHERE id NOT LIKE '%-k%'`).run(s);
    ledger.prepare("INSERT INTO claims SELECT job_id || ?1, attempt, batch_id || ?1, company_id, waba_id, phone, account_id, kind, period_key, at FROM claims WHERE job_id NOT LIKE '%-k%'").run(s);
    ledger.prepare("INSERT INTO outcomes SELECT job_id || ?1, attempt, outcome, CASE WHEN wamid = '' THEN '' ELSE wamid || ?1 END, at FROM outcomes WHERE job_id NOT LIKE '%-k%'").run(s);
  }
  company.exec("COMMIT");
  ledger.exec("COMMIT");
  console.log(JSON.stringify({ jobs: company.prepare("SELECT COUNT(*) AS n FROM wa_jobs").get().n, claims: ledger.prepare("SELECT COUNT(*) AS n FROM claims").get().n, accounts: ids.length }));
  company.close();
  ledger.close();
  process.exit(0);
}

cpSync(SABLON, VERI, { recursive: true });
const dataDir = path.join(VERI, "data");
const out = { kod: ROOT, loadavg_basta: loadavg() };
let ctx = await ortak.startWa({ env: DEAD, dataDir, backupDir: path.join(VERI, "backups"), connect: false, ack: false, now: { time: "2026-06-02T09:00:00.000Z", fixed: true } });
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
  out[label] = { ms: Math.round(performance.now() - t), olayDongusuEnCokMs: Math.round(maxLag), ...(res && typeof res === "object" && !Array.isArray(res) ? { sonuc: res } : {}) };
};
try {
  out.jobs = ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs").n;
  await ctx.wa.scheduler.maintain(); // ısınma
  const queue = ctx.server.app.context.whatsapp.queue;
  const rows = ctx.store.all("SELECT wamid FROM wa_jobs WHERE state = 'accepted' AND wamid IS NOT NULL ORDER BY rowid LIMIT 1000");
  const at = String(Math.floor(Date.parse("2026-06-02T09:00:00.000Z") / 1000));
  // (a) 1.000 teslim bildirimi — her biri ayrı çağrı (kanca POST başına), olay döngüsü ölçülür; via verilir (S90 yolu; eski kod yok sayar).
  await lagOf("bildirim_1000_teslim_ayri_cagri", async () => {
    let applied = 0;
    for (const row of rows) {
      applied += queue.applyStatuses([{ id: row.wamid, status: "delivered", timestamp: at, recipient_id: "905" }], { phoneNumberId: ortak.PNID, via: "manual" }).applied;
      await new Promise(resolve => setImmediate(resolve));
    }
    return { applied };
  });
  // Tek çağrıda en uzun bildirim: aynı yolun 100 bildirimi tek çağrıda (yanıt süresi = olay döngüsü).
  const more = ctx.store.all("SELECT wamid FROM wa_jobs WHERE state = 'accepted' AND wamid IS NOT NULL ORDER BY rowid LIMIT 100");
  await lagOf("bildirim_100_teslim_tek_cagri", async () => ({ applied: queue.applyStatuses(more.map(row => ({ id: row.wamid, status: "delivered", timestamp: at, recipient_id: "905" })), { phoneNumberId: ortak.PNID, via: "manual" }).applied }));
  // 200 cari için KVKK talebi (her biri 500 iş).
  const accounts = ctx.store.all("SELECT DISTINCT account_id AS id FROM wa_jobs").map(row => row.id);
  for (const id of accounts) {
    const res = await ctx.api.post("/api/workspace/whatsapp/kvkk-erase", { accountId: id, confirm: true });
    if (res.status !== 200) throw new Error(`talep ${res.status}`);
  }
  out.silinmisIs = ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE params_json LIKE '{%'").n;
  await ctx.close();
  // (b) temiz veri: açılış (talepler yeniden uygulanır, bayrak kurulur) → ilk bakım turu.
  ctx = await ortak.startWa({ env: DEAD, dataDir, backupDir: path.join(VERI, "backups"), connect: false, ack: false, now: { time: "2026-06-02T11:00:00.000Z", fixed: true } });
  await lagOf("bakim_acilis_sonrasi_200_talep_temiz", () => ctx.wa.scheduler.maintain());
  await lagOf("bakim_sonraki_bayraksiz", () => ctx.wa.scheduler.maintain());
  await ctx.close();
  // (c) DÜŞÜK-1 en kötü durum: silinmiş 100.000 satırın hepsinde numaralı eski metin (program kapalıyken; tur 2 öncesi kodun bırakabileceği veri).
  {
    const company = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
    company.prepare("UPDATE wa_jobs SET error_text = 'Değerlerden biri geçersiz (Meta hata kodu 131009: Parameter value is not valid: to +90 532 111 22 33)' WHERE params_json LIKE '{%'").run();
    company.close();
  }
  ctx = await ortak.startWa({ env: DEAD, dataDir, backupDir: path.join(VERI, "backups"), connect: false, ack: false, now: { time: "2026-06-02T13:00:00.000Z", fixed: true } });
  await lagOf("bakim_acilis_sonrasi_200_talep_100k_eski_metin", () => ctx.wa.scheduler.maintain());
  out.numaraliMetinKalan = ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE error_text LIKE '%532 111 22 33%'").n;
  await lagOf("bakim_sonraki_bayraksiz_2", () => ctx.wa.scheduler.maintain());
} finally {
  clearInterval(timer);
  await ctx.close().catch(() => {});
}
out.loadavg_sonda = loadavg();
console.log(JSON.stringify(out));
