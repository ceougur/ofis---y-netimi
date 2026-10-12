// Tur 2 gerileme — aynı veri kopyasında uç süreleri (ms, medyan). node olc.mjs <v2.1.0|guncel> <dataDir> <tekrar> <cikti.json>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { bootVersion } from "../../../../../../test/guvenilirlik/surumler.mjs";

const [version, dir, repeatText = "5", out] = process.argv.slice(2);
const R = Number(repeatText);
const app = await bootVersion(version, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, gateVerify: false, reportWorker: false });
const api = await app.login();
const list = (await api.get("/api/workspace/cheques")).data.cheques;
const portfolio = list.filter(row => row.direction === "in" && row.status === "portfolio");
const URLS = {
  "bank/sub-trial": "/api/workspace/bank/sub-trial",
  "rapor alt-hesap-mizani": "/api/workspace/report-center/alt-hesap-mizani?preset=all",
  "rapor yevmiye": "/api/workspace/report-center/yevmiye?preset=all",
  "rapor cek-hareketleri": "/api/workspace/report-center/cek-hareketleri?preset=all",
  "rapor cek-portfoy": "/api/workspace/report-center/cek-portfoy?preset=all",
  "ledger": "/api/workspace/ledger",
  "ledger/integrity": "/api/workspace/ledger/integrity",
  "cheques": "/api/workspace/cheques",
  "cheque kart": `/api/workspace/cheques/${portfolio[0].id}`,
  "nakit-akisi": "/api/workspace/overview/nakit-akisi",
  "vade-takip": "/api/workspace/overview/vade-takip",
  "dues": "/api/workspace/dues",
  "invoices/portfolio": "/api/workspace/invoices/portfolio",
};
const result = { version, commit: app.commit, cheques: list.length, portfolio: portfolio.length, get: {}, post: {} };
for (const [name, url] of Object.entries(URLS)) {
  const times = [];
  let status = 0;
  for (let i = 0; i < R + 1; i += 1) {
    const t = performance.now();
    const res = await api.get(url);
    const ms = performance.now() - t;
    status = res.status;
    if (i) times.push(ms);
  }
  times.sort((a, b) => a - b);
  result.get[name] = { status, median: Math.round(times[Math.floor(times.length / 2)]), min: Math.round(times[0]) };
}
// Yazım (kapı dahil): 10 portföy çeki havaleyle tahsil, 10 yeni çek. Aynı sıra iki kodda.
const bank = (await api.get("/api/workspace/bank/accounts")).data.accounts?.[0] || (await api.get("/api/workspace/bank/accounts")).data[0];
const writes = { collect: [], create: [] };
for (const row of portfolio.slice(0, 10)) {
  const t = performance.now();
  const res = await api.post(`/api/workspace/cheques/${row.id}/actions`, { action: "collect", date: "2026-10-08", method: "bank", bankAccountId: bank.id });
  writes.collect.push(Math.round(performance.now() - t));
  if (res.status !== 200) result.post.collectError = `${res.status} ${JSON.stringify(res.data).slice(0, 200)}`;
}
for (let i = 0; i < 10; i += 1) {
  const t = performance.now();
  const res = await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "250", drawer: "Ölçüm", serialNo: `O-${i}`, issueDate: "2026-10-08", dueDate: "2026-11-08" });
  writes.create.push(Math.round(performance.now() - t));
  if (res.status !== 200) result.post.createError = `${res.status} ${JSON.stringify(res.data).slice(0, 200)}`;
}
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
result.post.collect = { median: med(writes.collect), all: writes.collect };
result.post.create = { median: med(writes.create), all: writes.create };
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
await app.close();
