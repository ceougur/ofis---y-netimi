// Ç2 tur 3 — ders 47 ölçümü (flock scratchpad/olcum.lock ile koşulur): kayıt ayrıntısını yazma süresi 475 / 600 / 5.000 / 10.200 öğede, eski (`JSON.stringify(...).slice(0, 20000)`) ↔ yeni
// (boundedDetail); ve onarımın uçtan uca süresi (eşzamanlı → olay döngüsü süresi) aynı veri kopyasıyla eski (bc495a1c) ↔ yeni kodla (ders 15).
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node olcum-kayit.mjs <yeni kök> <eski kök> <N...>
import { mkdirSync, rmSync } from "node:fs";
import { loadavg } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const [NEW, OLD, ...ns] = process.argv.slice(2);
const SCR = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t3-calisma";
const { boundedDetail } = await import(pathToFileURL(path.join(NEW, "server/lib/log-detail.mjs")).href);
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const time = (fn, runs = 21) => {
  const out = [];
  for (let i = 0; i < runs; i += 1) {
    const t = performance.now();
    fn();
    out.push(performance.now() - t);
  }
  return Math.round(median(out) * 1000) / 1000;
};
console.log(`yük ${loadavg().map(v => v.toFixed(1)).join(" ")}`);
for (const n of [475, 600, 5000, 10200]) {
  const ids = Array.from({ length: n }, (_, i) => `lv-${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`);
  const half = ids.slice(0, Math.floor(n / 2));
  const events = Array.from({ length: n }, (_, i) => `ev-${String(i).padStart(8, "0")}-0000-0000-000000000000`);
  const pending = Array.from({ length: n }, (_, i) => ({ kind: "g", id: events[i], reason: "POS tahsilatı eski sürümde değiştirilmiş (POS kaydı 120.00 TL · 2027-01-05, satır 125.00 TL · 2027-01-05); bankaya aktarılmaz." }));
  const report = { at: "2027-01-10T09:00:00.000Z", unassigned: 0, unassignedSample: [], undoneMatches: [], voidedSales: [], cancelledEvents: events, clearedRefs: [], refreshedEvents: [], closedCollections: [], reopenedCollections: [], pending };
  const r = {
    kaldirmaEskiMs: time(() => JSON.stringify({ ids, resetAt: "x", kept: [] }).slice(0, 20000)),
    kaldirmaYeniMs: time(() => boundedDetail({ ids, removedCount: n, resetAt: "x", kept: [], keptCount: 0 }, { maxList: 50, maxChars: 20000 })),
    karisikYeniMs: time(() => boundedDetail({ ids: half, removedCount: half.length, resetAt: "x", kept: half, keptCount: half.length }, { maxList: 50, maxChars: 20000 })),
    kuskuYeniMs: time(() => boundedDetail({ kept: ids, keptCount: n, doubts: Object.fromEntries(ids.map(id => [id, "after-traced"])), resetAt: "" }, { maxList: 50, maxChars: 20000 })),
    bankaEskiMs: time(() => JSON.stringify({ ...report, unassignedIds: undefined }).slice(0, 20000)),
    bankaYeniMs: time(() => boundedDetail({ ...report, unassignedIds: undefined, counts: { cancelledEvents: n, pending: n } }, { maxList: 50, maxChars: 20000 })),
    bankaYeniUzunluk: boundedDetail({ ...report, unassignedIds: undefined, counts: { cancelledEvents: n, pending: n } }, { maxList: 50, maxChars: 20000 }).length,
  };
  console.log(`yardımcı n=${n}: ${JSON.stringify(r)}`);
}

// Uçtan uca: programın kendi yoluyla N fiş (postAll, 1.000'lik öbekler) → eski sürüm sıfırlaması → iki kopya (VACUUM INTO) → eski / yeni repairLegacyReset.
const hNew = await import(pathToFileURL(path.join(NEW, "test/helpers.mjs")).href);
const USER = { id: "olcum", display_name: "Ölçüm" };
for (const n of ns.map(Number)) {
  const base = `${SCR}/olcum-${n}`;
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  const server = await hNew.startTestServer({ now: { time: "2027-01-10T10:00:00+03:00", fixed: true }, dataDir: `${base}/data`, backupDir: `${base}/backups` });
  let file;
  try {
    for (let start = 0; start < n; start += 1000) server.app.ledger.vouchers.postAll(USER, Array.from({ length: Math.min(1000, n - start) }, (_, k) => ({ type: "opening-match", date: "2027-01-05", requestKey: `olcum-${n}-${start + k}`, lines: [{ account: "590", debit: 100 + start + k }, { account: "519", credit: 100 + start + k }] })));
    file = server.app.config.dbPath;
  } finally {
    await server.close();
  }
  {
    const db = new DatabaseSync(file);
    db.exec("BEGIN IMMEDIATE; DELETE FROM audit_events; DELETE FROM integrity_log;");
    db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES ('event-olcum', 'company.reset', 'sirket-001', 'a', 'a', '{}', '2027-01-10T08:00:00.000Z')").run();
    db.exec("COMMIT");
    for (const name of ["eski", "yeni"]) db.exec(`VACUUM INTO '${base}/${name}.sqlite'`);
    db.close();
  }
  const out = {};
  for (const [name, root] of [["eski", OLD], ["yeni", NEW]]) {
    const { repairLegacyReset } = await import(pathToFileURL(path.join(root, "server/lib/ledger-vouchers.mjs")).href);
    const { createStore, openDatabase } = await import(pathToFileURL(path.join(root, "server/lib/db.mjs")).href);
    const store = createStore(openDatabase(`${base}/${name}.sqlite`));
    const t = performance.now();
    const result = repairLegacyReset({ store, companyId: "sirket-001", now: () => new Date("2027-01-10T09:00:00.000Z") });
    const ms = Math.round(performance.now() - t);
    const row = store.get("SELECT length(detail_json) AS len, detail_json AS detail FROM integrity_log WHERE action = 'repair' ORDER BY rowid LIMIT 1");
    let valid = true;
    try {
      JSON.parse(row.detail);
    } catch {
      valid = false;
    }
    out[name] = { ms, removed: result?.removed, kayitUzunluk: row?.len, gecerli: valid };
    store.close?.();
  }
  console.log(`onarım uçtan uca n=${n}: ${JSON.stringify(out)} · yük ${loadavg().map(v => v.toFixed(1)).join(" ")}`);
  rmSync(base, { recursive: true, force: true });
}
