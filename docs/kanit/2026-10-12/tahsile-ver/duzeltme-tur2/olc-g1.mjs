// Tur 2 G1 — Alt Hesap Mizanı hızı, AYNI veri kopyasında (gerileme-tur2/olcum/veri.mjs ile üretilen 15.000 alınan çek), düzeltme öncesi (4d8003a,
// ayrı kopyada bu dosyanın kopyasıyla) ↔ sonrası. Uç başına ilk istek (first) + 5 tekrar, medyan ms. Ayrıca 101.01/101.02 satırları kaydedilir
// (iki kodun Alt Hesap Mizanı birebir aynı olmalı). Koşum: node olc-g1.mjs <dataDir> <cikti.json>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { CURRENT, bootVersion } from "../../../../../test/guvenilirlik/surumler.mjs";

const [dir, out] = process.argv.slice(2);
const R = 5;
const app = await bootVersion(CURRENT, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, gateVerify: false, reportWorker: false });
const api = await app.login();
const URLS = {
  "bank/sub-trial": "/api/workspace/bank/sub-trial",
  "bank/sub-trial dönem": "/api/workspace/bank/sub-trial?from=2026-04-01&to=2026-06-30",
  "rapor alt-hesap-mizani": "/api/workspace/report-center/alt-hesap-mizani?preset=all",
  "rapor cek-hareketleri": "/api/workspace/report-center/cek-hareketleri?preset=all",
  "cheques": "/api/workspace/cheques",
  "dues": "/api/workspace/dues",
};
const result = { cheques: (await api.get("/api/workspace/cheques?limit=1")).data.total, get: {}, rows: {} };
for (const [name, url] of Object.entries(URLS)) {
  const times = [];
  let first = 0;
  let status = 0;
  for (let i = 0; i < R + 1; i += 1) {
    const t = performance.now();
    const res = await api.get(url);
    const ms = performance.now() - t;
    status = res.status;
    if (i) times.push(ms);
    else first = Math.round(ms);
    if (i === 0 && name.startsWith("bank/sub-trial")) result.rows[name] = (res.data.rows || []).filter(row => row.account === "101");
  }
  times.sort((a, b) => a - b);
  // first: ilk istek (sunucu açılışından sonra; yeni kodda saklanan toplam henüz yok — yazımdan sonraki ilk açılışın süresi).
  result.get[name] = { status, first, median: Math.round(times[Math.floor(times.length / 2)]), min: Math.round(times[0]) };
}
await app.close();
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result.get));
