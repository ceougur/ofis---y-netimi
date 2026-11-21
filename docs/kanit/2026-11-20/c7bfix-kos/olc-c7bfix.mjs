// Ç7b aday düzeltme turu HIZ (ders 47, 53 (a)): değişen yol — Kartı Kapat (closeRemaining ile; YB-1 denetimi işlem içinde tek carinin kuyruğunu kurar) + kart GET.
// Kalıp: ana oturumun ana-c7ba/betik/olc-c7b3b.mjs'i (okundu, kopyalandı; yollar bu turunkiler). Kullanım:
//   node olc-c7bfix.mjs <kod kökü> <veri kopyası> <own|shown> [tekrar=5]   (özel ölçüm kilidiyle çağrılır)
// own: closeRemaining = totals.ownRemaining (TABAN kodun denetiminin kabul ettiği sayı — tabanda 409'suz tam yazım ölçülsün); shown: totals.remaining (yeni kod; pencerenin sayısı).
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, mode, repeatText = "5"] = process.argv.slice(2);
if (!["own", "shown"].includes(mode)) throw new Error("kip own | shown");
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const r = v => Math.round(v * 10) / 10;
console.log(`kod ${root} · kip ${mode} · yük (başta) ${load()} · TZ ${process.env.TZ || "(yerel)"} · açılış ${r(performance.now() - t0)} ms`);
{
  const st = app.ledger.snapshots.state();
  if (st.pending) { const d0 = performance.now(); await app.ledger.snapshots.runPending(); console.log(`donma (bekleyen koşu) ${r(performance.now() - d0)} ms`); }
}
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
// Ölçülen kartlar: carili, açık, Yeni Borç (faturasız, kapsamasız), kalanı olan — en çok satırlı carilerin kartları (iki kodda aynı seçim; olc-c7b3b.mjs ile aynı sorgu).
const cards = store.all(`SELECT p.id, p.account_id AS acc, p.total - COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS left
  FROM plans p WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.account_id <> '' AND p.covers_balance = 0 AND p.invoice_id = ''
  ORDER BY (SELECT COUNT(*) FROM account_entries x WHERE x.account_id = p.account_id) DESC, p.id LIMIT 40`).filter(c => c.left > 1).slice(0, 2);
if (cards.length < 2) throw new Error("ölçülecek açık kart yok");
const [B, C] = cards;
const accRows = id => store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", id).n;
const counts = store.get("SELECT (SELECT COUNT(*) FROM account_entries) AS e, (SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL) AS p, (SELECT value FROM settings WHERE key = 'ledger.lockedUntil') AS kilit");
const g0 = (await client.get(`/api/workspace/plans/${B.id}`)).data?.data?.totals || {};
console.log(`veri: ${counts.e} cari satırı, ${counts.p} kart, kilit ${counts.kilit || "(yok)"}; kart B ${B.id} (cari ${B.acc}, ${accRows(B.acc)} cari satırı; pencere kalan ${g0.remaining}, kendi ${g0.ownRemaining}), kart C ${C.id} (cari ${C.acc})`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const results = new Map();
const first = new Map();
const timed = async (label, call, cold) => {
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  if (cold) {
    if (!first.has(label)) first.set(label, { ms, loop: h.max / 1e6, status: res.status });
    return res;
  }
  if (!results.has(label)) results.set(label, { ms: [], loop: [], status: new Set() });
  const row = results.get(label);
  row.ms.push(ms); row.loop.push(h.max / 1e6); row.status.add(res.status);
  return res;
};
const round = async cold => {
  const view = await timed("kart GET (açık kart B)", () => client.get(`/api/workspace/plans/${B.id}`), cold);
  const t = view.data?.data?.totals || {};
  const closeRemaining = mode === "own" ? Number(t.ownRemaining ?? t.remaining) : Number(t.remaining);
  await timed("YAZIM Kartı Kapat closeRemaining (kart B; Borçta Kalsın)", () => client.put(`/api/workspace/plans/${B.id}`, { status: "closed", closeRemaining }), cold);
  await timed("kart GET (kapalı kart B)", () => client.get(`/api/workspace/plans/${B.id}`), cold);
  await timed("YAZIM Yeniden Aç (kart B)", () => client.put(`/api/workspace/plans/${B.id}`, { status: "active" }), cold);
  await timed("YAZIM Kartı Kapat eski istemci (kart C)", () => client.put(`/api/workspace/plans/${C.id}`, { status: "closed" }), cold);
  await timed("YAZIM Yeniden Aç (kart C)", () => client.put(`/api/workspace/plans/${C.id}`, { status: "active" }), cold);
};
await round(true);
for (let i = 0; i < repeat; i += 1) await round(false);
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
for (const [label, row] of first) console.log(`  İLK ${label}: durum ${row.status} · ${r(row.ms)} ms · olay döngüsü en çok ${r(row.loop)} ms`);
for (const [label, row] of results) console.log(`  ${label}: durum ${[...row.status].join("/")} · en iyi ${r(Math.min(...row.ms))} ms · ortanca ${r(median(row.ms))} ms · olay döngüsü en çok ${r(Math.max(...row.loop))} ms (n=${row.ms.length})`);
console.log(`son durum: kart B ${store.get("SELECT status FROM plans WHERE id = ?", B.id).status}, kart C ${store.get("SELECT status FROM plans WHERE id = ?", C.id).status}`);
console.log(`yük (sonda) ${load()}`);
await app.close();
