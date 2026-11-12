// Ç5-B kapanış düzeltmesi madde 5 — YALNIZ kuyruk motorunun (buildObligations) işlemci süresi, AYNI girdilerle birden çok motor sürümünde (kabul ölçümü DEĞİL).
// Girdiler yakalama yamalı kopyadan (benim kodum + ilk satırda globalThis.__yakala?.push(input)) açılışta toplanır; sonra her motor aynı girdileri sırayla, dönüşümlü işler.
// Kullanım: node hiz-uc.mjs <yakalama kopyası> <veri kopyası> <ad=kök> <ad=kök> ...   (kök: obligation-queue.mjs'in bulunduğu kod kökü)
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [capture, dir, ...pairs] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
globalThis.__yakala = [];
const { createApp } = await import(pathToFileURL(path.join(capture, "server", "app.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const accounts = app.store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n;
if (!globalThis.__yakala.length) app.context.invoices.allObligations();
const inputs = globalThis.__yakala.slice(0, Math.min(globalThis.__yakala.length, accounts));
const captured = globalThis.__yakala.length;
globalThis.__yakala = null;
await app.close();
const isCover = input => (input.lines || []).some(line => line.origin === "plan" && line.kind === "plan" && line.covers);
const engines = [];
for (const pair of pairs) {
  const [name, root] = pair.split("=");
  engines.push({ name, build: (await import(pathToFileURL(path.join(root, "server", "lib", "obligation-queue.mjs")).href)).buildObligations, rounds: [] });
}
const cpuNow = () => { const c = process.cpuUsage(); return (c.user + c.system) / 1000; };
const pass = engine => {
  const acc = { kartli: 0, kartsiz: 0, kalem: 0, sigma: 0, gecis: 0, derin: 0, enCok: 0, guvenli: 0, derinMs: 0 };
  for (const input of inputs) {
    const c0 = cpuNow();
    const result = engine.build(input);
    const spent = cpuNow() - c0;
    acc[isCover(input) ? "kartli" : "kartsiz"] += spent;
    const pp = result.prepaidPasses;
    if (pp) { acc.gecis += pp.count; if (pp.count > 12) { acc.derin += 1; acc.derinMs += spent; } if (pp.count > acc.enCok) acc.enCok = pp.count; if (pp.stable === false) acc.guvenli += 1; }
    acc.kalem += result.items.length;
    for (const item of result.items) acc.sigma += Math.round((item.side === "receivable" ? item.remaining : -item.remaining) * 100);
  }
  return { kartli: Math.round(acc.kartli), kartsiz: Math.round(acc.kartsiz), hepsi: Math.round(acc.kartli + acc.kartsiz), kalem: acc.kalem, sigma: acc.sigma, gecis: acc.gecis, derin: acc.derin, enCok: acc.enCok, guvenli: acc.guvenli, derinMs: Math.round(acc.derinMs) };
};
for (const engine of engines) pass(engine); // ısınma
for (let i = 0; i < 5; i += 1) for (const engine of i % 2 ? [...engines].reverse() : engines) engine.rounds.push(pass(engine));
console.log(`girdi ${inputs.length} (yakalanan ${captured}; kartlı ${inputs.filter(isCover).length}) · yük ${load()}`);
for (const engine of engines) {
  const min = key => Math.min(...engine.rounds.map(r => r[key]));
  const med = key => engine.rounds.map(r => r[key]).sort((a, b) => a - b)[2];
  console.log(`${engine.name.padEnd(8)} en iyi hepsi ${min("hepsi")} · kartlı ${min("kartli")} · kartsız ${min("kartsiz")} | ortanca hepsi ${med("hepsi")} · kartlı ${med("kartli")} · kartsız ${med("kartsiz")} | kalem ${engine.rounds[0].kalem} · Σ kalan (kuruş) ${engine.rounds[0].sigma} · ön ödeme geçişi toplam ${engine.rounds[0].gecis}, 12'den çok geçişli cari ${engine.rounds[0].derin} (${engine.rounds[0].derinMs} ms), en çok ${engine.rounds[0].enCok}, güvenli kapanış ${engine.rounds[0].guvenli}`);
}
