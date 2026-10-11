// Senaryo D: ESKİ KOD AYRI KOPYADA (git archive 07b8f60 → eski-07b8f60/) ↔ HEAD, aynı veri dosyasının iki kopyası, HTTP üzerinden:
// Rapor Merkezi ön izleme JSON'u (ilk 200 satır + toplam + TOPLAM + özet) ve Excel (bütün satırlar) birebir. HEAD iş parçacığı açık (üretim yolu).
// Veri: senaryo A adımları + mutabakat motoru (tohum, işlem sayısı). Kullanım: node senaryo-d.mjs <tohum> <işlem> [çıktı.json]
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addDays, reportCases } from "./ortak.mjs";
import { buildA } from "./veri-a.mjs";
const R = "/home/user/ofis---y-netimi";
const OLD = new URL("./eski-07b8f60/", import.meta.url).pathname;
const newHelpers = await import(`${R}/test/helpers.mjs`);
const oldHelpers = await import(`${OLD}test/helpers.mjs`);
const { apiOf, rawAll, xlsxSheets } = await import(`${R}/test/banka-210-ortak.mjs`);
const { runReconciliation } = await import(`${R}/test/mutabakat/motor.mjs`);

const seed = Number(process.argv[2] || 41);
const operations = Number(process.argv[3] || 300);
const out = process.argv[4] || `senaryo-d-${seed}.json`;
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "hiz-inceleme-d-"));
const dataDir = path.join(root, "veri");
const result = { seed, operations, steps: [] };
try {
  // 1) Veri (HEAD kodu, programın kendi API'si).
  {
    const server = await newHelpers.startTestServer({ dataDir, now: NOW, bankPickLegacy: true });
    try {
      const client = await newHelpers.loginAdmin(server);
      const ctx = { api: apiOf(client), db: server.app.db, server, app: server.app };
      if (operations > 0) {
        const report = await runReconciliation({ client, seed, operations, verifyEvery: 1000, reportEvery: 100000, burst: 0 });
        result.motor = { ops: report.operations, mismatches: report.mismatches.length };
      }
      const log = [];
      const marks = await buildA(ctx, NOW, log);
      result.marks = marks;
      result.red = log.filter(x => x.status !== 200).map(x => `${x.label} ${x.status}`);
    } finally {
      await server.app.close();
    }
  }
  const oldDir = path.join(root, "eski");
  const newDir = path.join(root, "yeni");
  cpSync(dataDir, oldDir, { recursive: true });
  cpSync(dataDir, newDir, { recursive: true });
  const fixed = { time: NOW, fixed: true };
  const oldServer = await oldHelpers.startTestServer({ dataDir: oldDir, now: fixed, bankPickLegacy: true });
  const newServer = await newHelpers.startTestServer({ dataDir: newDir, now: fixed, bankPickLegacy: true, reportWorker: true });
  try {
    const oldApi = apiOf(await oldHelpers.loginAdmin(oldServer));
    const newApi = apiOf(await newHelpers.loginAdmin(newServer));
    const banks = rawAll(newServer.app.db, "SELECT id, kind FROM bank_accounts");
    const { today, D0, T1 } = result.marks;
    const firstDay = rawAll(newServer.app.db, "SELECT MIN(date) AS d FROM (SELECT date FROM account_entries UNION ALL SELECT date FROM fin_events UNION ALL SELECT date FROM cash_entries)")[0].d;
    const periods = [["varsayılan", {}], ["all", { preset: "all" }], ["thisMonth", { preset: "thisMonth" }], ["lastMonth", { preset: "lastMonth" }], ["last30", { preset: "last30" }],
      ["D0 başı", { from: D0, to: today }], ["D0+1", { from: addDays(D0, 1), to: today }], ["T1 başı", { from: T1, to: today }], ["T1 tek", { from: T1, to: T1 }], ["ilk gün", { from: firstDay, to: firstDay }],
      ["gelecek", { from: addDays(today, 1), to: addDays(today, 40) }], ["ileri dahil", { from: addDays(today, -10), to: addDays(today, 25) }], ["yalnız bitiş", { to: addDays(today, -19) }]];
    let compared = 0;
    const diffs = [];
    const started = newServer.app.context.reportRunner?.stats.started ?? -1;
    for (const [periodName, period] of periods) {
      for (const [id, filter] of reportCases(banks)) {
        const qs = new URLSearchParams({ ...period, ...filter }).toString();
        const tag = `${id} ${JSON.stringify(filter)} · ${periodName}`;
        const [a, b] = await Promise.all([oldApi.get(`/api/workspace/report-center/${id}?${qs}`), newApi.get(`/api/workspace/report-center/${id}?${qs}`)]);
        compared += 1;
        if (a.status !== b.status || JSON.stringify(a.data) !== JSON.stringify(b.data)) {
          const rows = (a.data?.rows || []).findIndex((row, i) => JSON.stringify(row) !== JSON.stringify(b.data?.rows?.[i]));
          diffs.push({ tag, kind: "ön izleme", status: [a.status, b.status], firstRow: rows, old: JSON.stringify(rows >= 0 ? a.data.rows[rows] : a.data).slice(0, 300), new: JSON.stringify(rows >= 0 ? b.data?.rows?.[rows] : b.data).slice(0, 300) });
        }
        if (a.status === 200 && ["banka-bakiye", "banka-hareket", "banka-masraf", "banka-pos-hareketleri"].includes(id)) {
          const [x, y] = await Promise.all([oldApi.raw("GET", `/api/workspace/report-center/${id}/xlsx?${qs}`), newApi.raw("GET", `/api/workspace/report-center/${id}/xlsx?${qs}`)]);
          compared += 1;
          const sx = JSON.stringify(xlsxSheets(x.buffer));
          const sy = JSON.stringify(xlsxSheets(y.buffer));
          if (x.status !== y.status || sx !== sy) diffs.push({ tag, kind: "excel", status: [x.status, y.status], old: sx.slice(0, 300), new: sy.slice(0, 300) });
        }
      }
    }
    result.compared = compared;
    result.viaWorker = (newServer.app.context.reportRunner?.stats.started ?? -1) - started;
    result.diffs = diffs.length;
    result.first = diffs.slice(0, 20);
  } finally {
    await oldServer.close();
    await newServer.close();
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ seed, motor: result.motor, red: result.red, compared: result.compared, viaWorker: result.viaWorker, diffs: result.diffs, first: (result.first || []).slice(0, 3) }));
