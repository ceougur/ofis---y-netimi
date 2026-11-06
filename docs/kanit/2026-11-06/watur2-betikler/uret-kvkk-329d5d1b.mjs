// 2.5.0 WhatsApp tur 2 — İş 5 (W-3 dk ORTA-1) fikstürü: tur 2'den ÖNCEKİ kodun (329d5d1b = WhatsApp tur 1 + W-3) GERÇEK koduyla (git archive; ders 23) programın KENDİ API'si,
// işçisi ve kesinti kancasıyla (whatsappLedgerFault "anonymize" — disk dolu benzetimi) üretilir. Dar kontrol W-3 betiği e2'nin talep anı.
// Senaryo: A (Ayşe) teslim edildi; B (Bora) isteği Meta'dayken (sahte Graph kapısı) iki KVKK talebi — talep anında makine defteri anonimleştirmesi YAZILAMAZ (yalnız o an). İstek
// bırakılır → B Meta Kabul Etti. Sahte Meta'nın wamid'i gerçek Meta gibi alıcının numarasını base64 taşır (W-3 sızıntı düzeni). Program kapanır.
// Beklenen eski kod sonucu (dar kontrol ORTA-1): defterde A ve B'nin telefonu / açık wamid'i, dosyada B'nin silinmiş satırında AÇIK wamid.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node uret-kvkk-329d5d1b.mjs <329d5d1b kökü> <çıktı klasörü>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const [root, out] = process.argv.slice(2);
if (process.env.HUKUK_LICENSE_URL !== "http://127.0.0.1:9") throw new Error("ders 30");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const ortak = await imp("test/whatsapp-248-ortak.mjs");
const { startFakeGraph } = await imp("test/whatsapp-sahte-graph.mjs");
const dataDir = path.join(out, "data");
const backupDir = path.join(out, "backups");
mkdirSync(out, { recursive: true });
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const ok = (res, label) => {
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};
const waitFor = async (check, label, ms = 8000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error(`zaman aşımı: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const graph = await startFakeGraph({ token: ortak.TOKEN, phoneNumberId: ortak.PNID, wabaId: ortak.WABA });
graph.state.templates.push(...ortak.PROGRAM_TEMPLATES());
graph.state.wamidOf = (to, n) => `wamid.${Buffer.from(`\x1c\x18\x0c${String(to).replace(/\D/g, "")}\x15\x02\x00\x11\x18\x12${String(n).padStart(18, "0")}`, "latin1").toString("base64")}`;
let failAnon = false;
const info = { kod: "329d5d1b (2.5.0 WhatsApp tur 1 + W-3)", node: process.version };
const ctx = await ortak.startWa({ fake: graph, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, dataDir, backupDir, whatsappLedgerFault: op => failAnon && op === "anonymize", now: { time: localIso(2026, 11, 3, 10), fixed: true } });
try {
  const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
  const b = await ctx.account("Bora Demir", "0533 444 55 66", 300);
  const madeA = ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "A");
  await ctx.drain();
  const jobA = (await ctx.jobs(madeA.batch.id))[0];
  ctx.statuses([{ id: jobA.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock.ms() / 1000)), recipient_id: "905321112233" }]);
  let release;
  graph.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
  const madeB = ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "B");
  const run = ctx.drain();
  await waitFor(() => graph.state.held >= 1, "B isteği Meta'da");
  failAnon = true;
  const ra = await ctx.api.post("/api/workspace/whatsapp/kvkk-erase", { accountId: a.id, confirm: true });
  const rb = await ctx.api.post("/api/workspace/whatsapp/kvkk-erase", { accountId: b.id, confirm: true });
  failAnon = false;
  graph.state.hold = null;
  release();
  await run;
  const jobB = (await ctx.jobs(madeB.batch.id))[0];
  const wamidB = graph.state.messages.find(m => m.to === "+905334445566")?.wamid;
  info.talep = { A: ra.status, B: rb.status };
  info.accounts = { A: a.id, B: b.id };
  info.jobs = { A: { id: jobA.id, batchId: madeA.batch.id, wamid: jobA.wamid }, B: { id: jobB.id, batchId: madeB.batch.id, wamid: wamidB, state: jobB.state, fileWamidAcik: jobB.wamid === wamidB } };
  info.phones = { A: "+905321112233", B: "+905334445566" };
  const ledger = new DatabaseSync(ctx.wa.ledger.file, { readOnly: true });
  try {
    info.defter = {
      telefonAcik: ledger.prepare("SELECT COUNT(*) AS n FROM claims WHERE phone LIKE '+90%'").get().n,
      wamidAcik: ledger.prepare("SELECT COUNT(*) AS n FROM outcomes WHERE wamid <> '' AND substr(wamid, 1, 2) <> 'h:'").get().n,
    };
  } finally {
    ledger.close();
  }
  info.at = new Date(ctx.clock.ms()).toISOString();
  info.version = ctx.server.app.store.get("PRAGMA user_version").user_version;
} finally {
  await ctx.close();
}
writeFileSync(path.join(out, "bilgi.json"), `${JSON.stringify(info, null, 1)}\n`);
console.log(JSON.stringify(info));
