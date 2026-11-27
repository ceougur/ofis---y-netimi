#!/usr/bin/env node
// 2.5.1 D3 TUR 2 — HIZ İNCELEMESİ (görev iş 5; H-1 kararı KULLANICIDA — KOD DEĞİŞİKLİĞİ YOK, yalnız karar için sayı). Devir ön izlemesinin en pahalı bileşeni olan TEK BORÇ SIRASI
// (lib/obligation-queue.mjs buildObligations, cari başına, K'de) çağrısının İÇİNDE sürenin nereye gittiği ve devir tarafında (tek borç sırasına dokunmadan) yapılabilecek kazançlar.
// Okuyucunun (lib/devir/plan-reader.mjs readDevirFacts) tek borç sırası bölümü AYNI işlevlerle, aynı sırayla adım adım yeniden koşulur:
//   şüpheli ayırımı (K'de) → girdi kurucusu (ledgerLines, settleTables, obligationExtras) → cari başına süzgeç + girdi + buildObligations.
// buildObligations'ın İÇ adımları (withEditCuts, implicitRefunds, runQueue "side" — fatura durumu görünümü, runQueue "net" — TYK, assemble) yalnız ÖLÇÜM KOPYASINDA (kod kökü olarak
// verilen ayrı kopya; buildObligations'a globalThis.__tykOlcum sayaçları eklenmiş) okunur — ürün kodu değişmez; kanca yoksa iç adımlar "okunamadı" yazılır (ders 4). Ayrıca V8 CPU
// profili (node:inspector) tek borç sırası döngüsünde işlev başına öz süre. Devir tarafı: değerleme ikinci çağrısı, canlı türetme / karma yevmiye, Bilanço / Gelir Tablosu (önceki yıllar).
// Kullanım (ÖZEL kilitle, tek seferlik): flock -x -w 1800 <olcum.lock> node test/devir-d3-hacim-tyk.mjs <kod kökü> <veri kopyası (data/, backups/)> [K] [şimdi]
// Yük (/proc/loadavg 1 dk) > 2 ise ölçüm GEÇERSİZ yazılır (ders 52; 4 çekirdek).
import { readFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, K = "2025-12-31", NOW = "2026-10-08T12:00:00+03:00"] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const loadOne = () => Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]);
const loads = [loadOne()];
const r = value => Math.round(value * 10) / 10;
const mod = file => import(pathToFileURL(path.join(root, file)).href);
console.log(`kod ${root} · veri ${dir} · K ${K} · şimdi ${NOW} · yük (başta) ${load()}`);
const { createApp } = await mod("server/app.mjs");
const PASS = process.env.D3_ADMIN_PASSWORD || "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: NOW, fixed: true }, moneyStrict: false,
});
const { createObligationInput } = await mod("server/lib/obligation-input.mjs");
const { buildObligations } = await mod("server/lib/obligation-queue.mjs");
const { allocateDoubtful } = await mod("server/lib/doubtful-gl.mjs");
const { doubtfulCredits, doubtfulRows } = await mod("server/lib/bank/doubtful.mjs");
const { createStockValuation, loadValuationInput } = await mod("server/lib/stock-valuation.mjs");
const { balanceSheet, incomeStatement, closingDayOf } = await mod("server/lib/financial-statements.mjs");
const { bookTypeOf } = await mod("server/lib/book-type.mjs");
const { readDevirFacts } = await mod("server/lib/devir/plan-reader.mjs");
const { buildDevirPlan, dayAfter } = await mod("server/lib/devir/plan.mjs");
const store = app.store;
const ledger = app.context.ledger;
const out = {};
const tm = (name, fn) => {
  const t = performance.now();
  const value = fn();
  out[name] = r(performance.now() - t);
  return value;
};
const money = ["account_entries", "cash_entries", "stock_moves", "plan_entries", "invoices", "fin_events", "cheque_events", "payments"].map(table => [table, Number(store.get(`SELECT COUNT(*) AS n FROM ${table}`).n)]);
console.log(`veri: ${money.map(([t, n]) => `${t} ${n}`).join(" · ")} · Σ ${money.reduce((s, [, n]) => s + n, 0)} · cari ${store.get("SELECT COUNT(*) AS n FROM accounts").n}`);
app.db.exec("BEGIN");
// ---- (1) okuyucunun tek borç sırası bölümü, adım adım ----
const nextDay = dayAfter(K);
const doubtful = tm("supheliAyirimi", () => {
  const rows = doubtfulRows(store);
  const byParty = new Map();
  if (!rows.records.length) return byParty;
  const records = rows.records.filter(record => record.date <= K).map(record => (record.status === "released" && (!record.closedDate || record.closedDate > K) ? { ...record, status: "open", closedDate: "", closeEventId: "" } : record));
  const credits = doubtfulCredits(store, new Set(records.map(record => record.party))).filter(credit => credit.date <= K);
  const { state } = allocateDoubtful({ records, provisions: rows.provisions.filter(item => item.date <= K), credits, linked: rows.linked || null, writeOrder: rows.writeOrder || null });
  for (const record of records) {
    const s = state.get(record.id);
    if (s && s.remaining > 0) byParty.set(record.party, [...(byParty.get(record.party) || []), { id: record.id, date: record.date, remainingMinor: s.remaining }]);
  }
  return byParty;
});
const input = createObligationInput({ store });
const ledgers = tm("ledgerLines", () => input.ledgerLines());
const tables = tm("settleTables", () => input.settleTables());
const extras = tm("obligationExtras", () => input.obligationExtras(null, doubtful));
const acc = { suzgec: 0, girdi: 0, tyk: 0 };
const perParty = [];
let parties = 0;
let skipped = 0;
let linesTotal = 0;
let linesAfter = 0;
let noItems = 0;
const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 250 });
globalThis.__tykOlcum = { editCuts: 0, implicitRefunds: 0, side: 0, net: 0, assemble: 0, calls: 0 };
await session.post("Profiler.start");
const loopStart = performance.now();
for (const [id, lines] of ledgers) {
  let t = performance.now();
  const own = lines.filter(line => line.date <= K);
  acc.suzgec += performance.now() - t;
  linesTotal += lines.length;
  linesAfter += lines.length - own.length;
  if (!own.length) {
    skipped += 1;
    continue;
  }
  t = performance.now();
  const queued = input.withExtras(input.batchSettleInput(id, own, tables, nextDay), extras, id);
  const invoiceIds = new Set(own.filter(line => line.origin === "invoice").map(line => line.sourceId));
  queued.invoices = queued.invoices.filter(invoice => invoiceIds.has(invoice.id));
  queued.offsets = queued.offsets.filter(offset => offset.date <= K);
  acc.girdi += performance.now() - t;
  t = performance.now();
  const result = buildObligations(queued);
  const ms = performance.now() - t;
  acc.tyk += ms;
  parties += 1;
  if (!result.items.some(item => item.remaining - item.doubtful > 0.005)) noItems += 1;
  perParty.push({ id, ms, lines: own.length, invoices: queued.invoices.length });
}
const loopMs = performance.now() - loopStart;
const { profile } = await session.post("Profiler.stop");
session.disconnect();
const inner = globalThis.__tykOlcum.calls ? globalThis.__tykOlcum : null;
console.log(`(1) TEK BORÇ SIRASI bölümü (ms): şüpheli ayırımı ${out.supheliAyirimi} · ledgerLines ${out.ledgerLines} · settleTables ${out.settleTables} · obligationExtras ${out.obligationExtras} · döngü ${r(loopMs)} (süzgeç ${r(acc.suzgec)} · girdi ${r(acc.girdi)} · buildObligations ${r(acc.tyk)}) · cari ${parties} (≤K satırı olmayan ${skipped}) · satır ${linesTotal} (K sonrası ${linesAfter}) · açık kalemsiz cari ${noItems}`);
console.log(`    buildObligations İÇİ (ms; ölçüm kopyası): ${inner ? `withEditCuts ${r(inner.editCuts)} · implicitRefunds ${r(inner.implicitRefunds)} · runQueue "side" (fatura durumu) ${r(inner.side)} · runQueue "net" (TYK) ${r(inner.net)} · assemble ${r(inner.assemble)} · çağrı ${inner.calls}` : "okunamadı (kod kökü ölçüm kopyası değil — kanca yok)"}`);
perParty.sort((a, b) => b.ms - a.ms);
const msSorted = perParty.map(row => row.ms).sort((a, b) => a - b);
const q = p => r(msSorted[Math.min(msSorted.length - 1, Math.floor(p * msSorted.length))] || 0);
console.log(`    cari başına buildObligations (ms): ortanca ${q(0.5)} · %90 ${q(0.9)} · %99 ${q(0.99)} · en çok ${r(perParty[0]?.ms || 0)} · en pahalı 5: ${perParty.slice(0, 5).map(row => `${r(row.ms)} ms / ${row.lines} satır / ${row.invoices} fatura`).join(" ; ")}`);
// Profil: işlev başına öz süre (ms) — yalnız örnekleme; toplamı döngüyle aynı olmaz.
const self = new Map();
const byId = new Map(profile.nodes.map(node => [node.id, node]));
const counts = new Map();
for (const sample of profile.samples) counts.set(sample, (counts.get(sample) || 0) + 1);
const interval = (profile.endTime - profile.startTime) / Math.max(1, profile.samples.length) / 1000;
for (const [nodeId, n] of counts) {
  const node = byId.get(nodeId);
  const file = String(node.callFrame.url || "").split("/").slice(-2).join("/");
  const key = `${node.callFrame.functionName || "(anonim)"} @ ${file || node.callFrame.url || "(yerleşik)"}:${node.callFrame.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + n * interval);
}
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(`    CPU profili (öz süre, ms; ilk 15): ${top.map(([key, value]) => `${r(value)} ${key}`).join(" | ")}`);
const byFile = new Map();
for (const [key, value] of self) {
  const file = key.split(" @ ")[1]?.split(":")[0] || "?";
  byFile.set(file, (byFile.get(file) || 0) + value);
}
console.log(`    dosya başına öz süre (ms): ${[...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([file, value]) => `${file} ${r(value)}`).join(" · ")}`);
// ---- (2) devir tarafı: tek borç sırasına DOKUNMADAN yapılabilecek kazançlar için ölçümler ----
const live = tm("canliTuretme", () => ledger.build());
const entries = tm("karmaYevmiye", () => ledger.book({ to: K, live }).filter(entry => entry.date <= K));
const valuation = tm("degerlemeKurulum", () => createStockValuation(loadValuationInput(store)));
tm("degerlemeAt1", () => valuation.at(K, { detail: true }));
tm("degerlemeAt2", () => valuation.at(K, { detail: true }));
const bookType = bookTypeOf(store);
const closedOn = closingDayOf(store, K);
const bs = tm("bilanco", () => balanceSheet({ entries, valuation, date: K, bookType, closedOn }));
tm("gelirTablosuK", () => incomeStatement({ entries, valuation, from: `${K.slice(0, 4)}-01-01`, to: K, bookType }));
const prior = bs.hesaplanmis.gecmisYillar.map(row => row.yil);
tm("gelirTablosuOncekiYillar", () => prior.forEach(yil => incomeStatement({ entries, valuation, from: `${yil}-01-01`, to: `${yil}-12-31`, bookType })));
tm("ikinciLedgerLines", () => createObligationInput({ store }).ledgerLines());
console.log(`(2) devir tarafı (ms): canlı türetme ${out.canliTuretme} · karma yevmiye ${out.karmaYevmiye} · değerleme kurulum ${out.degerlemeKurulum} · at(K) 1. ${out.degerlemeAt1} · at(K) 2. (planın yinelemesi) ${out.degerlemeAt2} · Bilanço ${out.bilanco} · Gelir Tablosu (K yılı) ${out.gelirTablosuK} · önceki ${prior.length} yılın Gelir Tablosu ${out.gelirTablosuOncekiYillar} · ledgerLines (ikinci kez — karşılaştırma için) ${out.ikinciLedgerLines}`);
// ---- (3) baştan sona (okuyucu + plan; ana iş parçacığında) ----
const facts = tm("okuyucu", () => readDevirFacts({ store, ledger, K, today: NOW.slice(0, 10) }));
tm("plan", () => buildDevirPlan(facts));
console.log(`(3) okuyucu ${out.okuyucu} (${JSON.stringify(facts.timings)}) · plan ${out.plan}`);
app.db.exec("COMMIT");
loads.push(loadOne());
const maxLoad = Math.max(...loads);
console.log(`yük (sonda) ${load()} · en yüksek 1 dk yükü ${maxLoad} → ölçüm ${maxLoad > 2 ? "GEÇERSİZ (yük > 2)" : "GEÇERLİ"}`);
await app.close?.();
process.exit(0);
