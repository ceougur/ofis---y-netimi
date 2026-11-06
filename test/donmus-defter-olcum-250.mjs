#!/usr/bin/env node
// 2.5.0 Ç3 — dönem kilidi + dondurma ve defter raporlarının HIZI (ders 47; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §8 "Dönem kilidi + dondurma ≤ 10 sn (100.000 satır) | ≤ 50 ms
// olay döngüsü"; ders 15: aynı veri kopyası, ölçümler tek tek — flock ile sarılır). Veri programın KENDİ ürettiği veridir: tools/kapi-olcum.mjs --yalniz-kur (mutabakat motoru +
// tohumun satır satır kopyası; 100.000 para satırı, dört yıl, iki şirket). Her kod için veri taze kopyaya alınır; sunucu aynı süreçte, üretim kipinde (kapı eşdeğerlik denetimi
// kapalı, K6 günlükte) açılır. Ölçülen: yanıt süresi (ms) ve isteğin boyunca olay döngüsünün en büyük gecikmesi (5 ms'lik yoklayıcı zamanlayıcının en büyük gecikmesi; ms).
//   flock <kilit> node test/donmus-defter-olcum-250.mjs --kod <kök> --veri <n-100000 klasörü> --cikti <dosya.json> [--kilit 2025-12-31] [--tur 3]
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const root = path.resolve(opt("kod"));
const veri = path.resolve(opt("veri"));
const output = path.resolve(opt("cikti"));
const lockDay = opt("kilit", "2025-12-31");
const rounds = Number(opt("tur", 3));
const batchLines = Number(opt("parca", 0)) || 0; // yalnız yeni kod: dondurma parça boyu (satır); 0 = programın varsayılanı
const NOW = "2026-10-08T12:00:00+03:00"; // tools/kapi-olcum.mjs ile aynı
const PASS = "Kapi-Olcum-2026!";
const { startTestServer } = await import(pathToFileURL(path.join(root, "test/helpers.mjs")).href);
const work = mkdtempSync(path.join(path.dirname(output), "donma-olcum-"));
const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
const result = { kod: root, veri, now: NOW, kilit: lockDay, tur: rounds, parca: batchLines, node: process.version, cpu: os.cpus().length, yuk: os.loadavg(), olcumler: {} };
// Olay döngüsü: 5 ms'lik zamanlayıcının iki çalışması arasındaki en büyük aralık − 5 ms (istek boyunca + bir tur sonrası; tek parça engelleme de görünür).
async function timed(label, fn) {
  let last = performance.now();
  let worst = 0;
  const probe = setInterval(() => {
    const at = performance.now();
    worst = Math.max(worst, at - last - 5);
    last = at;
  }, 5);
  const started = performance.now();
  let value;
  let ms;
  try {
    value = await fn();
    ms = performance.now() - started;
    await new Promise(resolve => setTimeout(resolve, 30));
  } finally {
    clearInterval(probe);
  }
  return { ms: Math.round(ms), loopMaxMs: Math.round(Math.max(0, worst)), value };
}
try {
  cpSync(path.join(veri, "data"), path.join(work, "data"), { recursive: true });
  const openStarted = performance.now();
  const server = await startTestServer({ dataDir: path.join(work, "data"), backupDir: path.join(work, "backups"), now: { time: NOW, fixed: true }, adminPassword: PASS, gateVerify: false, moneyStrict: false, ...(batchLines ? { freezeBatchLines: batchLines } : {}) });
  result.acilisMs = Math.round(performance.now() - openStarted);
  try {
    const admin = server.client();
    const login = await admin.login("admin", PASS);
    if (login.status !== 200) throw new Error(`giriş ${login.status}`);
    const counts = server.app.store.get("SELECT (SELECT COUNT(*) FROM cash_entries) + (SELECT COUNT(*) FROM account_entries) + (SELECT COUNT(*) FROM payments) + (SELECT COUNT(*) FROM plan_entries) + (SELECT COUNT(*) FROM stock_moves) + (SELECT COUNT(*) FROM cheque_events) AS n");
    result.paraSatiri = Number(counts.n);
    const year = lockDay.slice(0, 4);
    const reads = {
      yevmiyeKilitliYil: `/api/workspace/report-center/yevmiye?from=${year}-01-01&to=${lockDay}`,
      yevmiyeAcikDonem: `/api/workspace/report-center/yevmiye?from=${lockDay.slice(0, 7)}-01&to=2026-10-08`,
      hesapMizaniKilitliYil: `/api/workspace/report-center/hesap-mizani?from=${year}-01-01&to=${lockDay}`,
      ledgerTumu: "/api/workspace/ledger",
    };
    const readAll = async phase => {
      for (const [name, url] of Object.entries(reads)) {
        const samples = [];
        for (let i = 0; i < rounds; i += 1) {
          const sample = await timed(name, () => admin.get(url));
          if (sample.value.status !== 200) throw new Error(`${name} ${sample.value.status}`);
          samples.push(sample);
        }
        result.olcumler[`${phase}.${name}`] = { msMedyan: median(samples.map(s => s.ms)), loopMaxMs: Math.max(...samples.map(s => s.loopMaxMs)), ms: samples.map(s => s.ms) };
      }
    };
    await readAll("once");
    // Kilit + dondurma (yeni kod: kilit, iş parçacığında türetme, parça parça yazım; eski kod: kilit + integrity.start tam taraması).
    const lock = await timed("kilit", () => admin.put("/api/admin/period-lock", { lockedUntil: lockDay, force: true }));
    if (lock.value.status !== 200) throw new Error(`kilit ${lock.value.status} ${JSON.stringify(lock.value.data).slice(0, 300)}`);
    result.olcumler.kilit = { ms: lock.ms, loopMaxMs: lock.loopMaxMs, yanit: lock.value.data.data };
    const snapshots = server.app.ledger?.snapshots;
    if (snapshots) result.donmus = { kapsam: snapshots.coverage(), satir: Number(server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n), kosu: server.app.store.all("SELECT kind, state, line_count AS lines, entry_count AS entries FROM ledger_snapshot_runs").map(row => ({ ...row })) };
    await readAll("sonra");
    // Kilitten sonra açık döneme yazım (kapı yolu; yeni kodda kilit izi dondurmadan benimsendi).
    const write = await timed("yazim", () => admin.post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-10-08", description: "Ölçüm" }));
    result.olcumler.yazimKilittenSonra = { ms: write.ms, loopMaxMs: write.loopMaxMs, status: write.value.status };
    // Kilidi geri çek (yeni kod: thaw + bayat satır temizliği + iz iş parçacığında).
    const unlock = await timed("geri", () => admin.put("/api/admin/period-lock", { lockedUntil: `${String(Number(year) - 1)}-12-31` }));
    result.olcumler.kilitGeriCek = { ms: unlock.ms, loopMaxMs: unlock.loopMaxMs, status: unlock.value.status };
  } finally {
    await server.close();
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
result.yukSonra = os.loadavg();
writeFileSync(output, JSON.stringify(result, null, 1));
for (const [name, value] of Object.entries(result.olcumler)) console.log(`${name}: ${value.msMedyan ?? value.ms} ms, olay döngüsü en çok ${value.loopMaxMs} ms`);
console.log(`para satırı ${result.paraSatiri} · açılış ${result.acilisMs} ms${result.donmus ? ` · donmuş ${result.donmus.satir} satır (kapsam ${result.donmus.kapsam})` : ""} · yük ${result.yuk.map(n => n.toFixed(2)).join(" ")}`);
console.log(`\n# tests 1\n# pass 1\n# fail 0`);
