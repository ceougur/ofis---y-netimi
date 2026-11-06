#!/usr/bin/env node
// 2.5.0 D2 — HACİM ÖLÇÜMÜ (ders 47; DEVIR-PLANI G9; çekirdek planı §8): 100.000 hareketli şirket + 5 arşivde arşiv kayıt defteri, yedek listeleri, arşiv bütünlük
// denetimi, arşivin ilk açılışı, kalıcı devir yedeği ve bakım kipi. Her işte yanıt süresi ve OLAY DÖNGÜSÜ EN ÇOK gecikmesi (monitorEventLoopDelay) okunur.
// Veri programın KENDİ API'sinden (POST /api/workspace/cash; üretim kapı yolu gateVerify: false), arşivler D4 benzetimiyle (test/devir-d2-yardimci.mjs makeArchive).
// Ölçüm tek başına koşar (ders 15): flock <not defteri>/olcum.lock node test/devir-d2-hacim-250.mjs [--hareket 100000] [--json <dosya>]
import { writeFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { statSync } from "node:fs";
import { companyDbFile, makeArchive } from "./devir-d2-yardimci.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const MOVES = Number(opt("--hareket", 100_000));
const JSON_OUT = opt("--json", "");
let tests = 0;
let failed = 0;
const check = (ok, text) => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
};
const results = {};
async function measure(name, fn) {
  const histogram = monitorEventLoopDelay({ resolution: 5 });
  histogram.enable();
  const started = performance.now();
  const value = await fn();
  const ms = Math.round(performance.now() - started);
  histogram.disable();
  const loopMax = Math.round(histogram.max / 1e6);
  results[name] = { ms, loopMaxMs: loopMax };
  console.log(`# ${name}: ${ms} ms, olay döngüsü en çok ${loopMax} ms`);
  return { value, ms, loopMax };
}

const server = await startTestServer({ gateVerify: false, now: { time: "2026-11-02T10:00:00+03:00", fixed: true } });
try {
  const admin = await loginAdmin(server);
  const app = server.app;
  // 1) veri: 100.000 Kasa hareketi (8 eşzamanlı istek)
  let bad = 0;
  await measure("veri-uretimi", async () => {
    for (let i = 0; i < MOVES; i += 8) {
      const batch = await Promise.all(Array.from({ length: Math.min(8, MOVES - i) }, (_, k) => admin.post("/api/workspace/cash", { kind: "in", amount: 10 + ((i + k) % 90), date: `2026-${String(1 + ((i + k) % 10)).padStart(2, "0")}-15`, description: `Hacim ${i + k}` })));
      bad += batch.filter(item => item.status !== 200).length;
    }
  });
  const count = app.store.get("SELECT COUNT(*) AS n FROM cash_entries").n;
  check(bad === 0 && count === MOVES, `${MOVES} hareket programın API'siyle yazıldı (başarısız ${bad}, satır ${count})`);
  const file = companyDbFile(app, app.companyId);
  results.dosyaBoyuMB = Math.round(statSync(file).size / 1024 / 1024);
  // 2) 5 arşiv (2021–2025)
  await measure("bes-arsiv-benzetimi", async () => {
    for (const year of ["2021", "2022", "2023", "2024", "2025"]) await makeArchive(app, app.companyId, { year });
  });
  // 3) listeler (özet hesaplanmaz)
  const archives = await measure("arsiv-listesi", () => admin.get("/api/admin/devir/archives"));
  check(archives.value.status === 200 && archives.value.data.data.archives.length === 5, "arşiv listesi 5 arşiv");
  check(archives.ms <= 1000 && archives.loopMax <= 50, `arşiv listesi ≤ 1 sn ve olay döngüsü ≤ 50 ms (${archives.ms} / ${archives.loopMax})`);
  const backups = await measure("yedek-listesi", () => admin.get("/api/admin/backups"));
  check(backups.value.status === 200 && backups.ms <= 1000 && backups.loopMax <= 50, `Yedekler listesi ≤ 1 sn / ≤ 50 ms (${backups.ms} / ${backups.loopMax})`);
  // 5) arşivin ilk açılışı (bütünlük özeti açılışta hesaplanır) ve arşivde liste
  const open = await measure("arsiv-ilk-acilis", () => admin.get("/api/workspace/cash?hofArchive=2021&limit=200"));
  check(open.value.status === 200, `arşiv açıldı (${open.ms} ms, olay döngüsü ${open.loopMax} ms)`);
  // 4) bütünlük denetimi (akışla özet; olay döngüsü tutulmamalı)
  const verify = await measure("bes-arsiv-dogrulama", async () => {
    for (const year of ["2021", "2022", "2023", "2024", "2025"]) {
      const response = await admin.post("/api/admin/devir/archives/verify", { company: app.companyId, year });
      if (response.status !== 200 || response.data.data.state !== "ok") throw new Error(`${year}: ${response.status} ${JSON.stringify(response.data)}`);
    }
  });
  check(verify.loopMax <= 50, `5 arşivin bütünlük denetimi olay döngüsünü ≤ 50 ms tutar (${verify.loopMax} ms; toplam ${verify.ms} ms)`);
  // 6) kalıcı devir yedeği (VACUUM INTO + 5 arşiv kopyası + özetler)
  const devir = await measure("devir-yedegi", () => app.backups.createDevirBackupFor(app.companies.get(app.companyId), { label: "devir-oncesi-2026", year: "2026" }));
  results.devirYedegiMB = Math.round(devir.value.size / 1024 / 1024);
  check(devir.value.files >= 6, `devir yedeği alındı (${devir.value.files} dosya, ${results.devirYedegiMB} MB, ${devir.ms} ms, olay döngüsü en çok ${devir.loopMax} ms — VACUUM INTO ana iş parçacığında, rutin yedekle aynı)`);
  const devirList = await measure("devir-yedekleri-listesi", () => admin.get("/api/admin/devir/backups"));
  check(devirList.value.status === 200 && devirList.ms <= 1000 && devirList.loopMax <= 50, `Devir Yedekleri listesi ≤ 1 sn / ≤ 50 ms (${devirList.ms} / ${devirList.loopMax})`);
  // 7) bakım kipi aç / kapat (001: geçici tetikleyiciler) ve açılıştaki diskten tanıma taraması
  const enter = await measure("bakim-ac", () => app.maintenance.enter(app.companyId, { reason: "devir" }));
  check(enter.ms <= 500, `bakım kipi açılışı ≤ 500 ms (${enter.ms})`);
  await measure("bakim-kapat", () => app.maintenance.exit(app.companyId));
  const reconcile = await measure("diskten-tanima-taramasi", () => app.companies.reconcileArchives());
  check(reconcile.ms <= 500, `açılıştaki arşiv taraması ≤ 500 ms (${reconcile.ms})`);
} finally {
  await server.close();
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ hareket: MOVES, ...results }, null, 2));
console.log(JSON.stringify(results));
console.log(`1..${tests}\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exit(failed ? 1 : 0);
