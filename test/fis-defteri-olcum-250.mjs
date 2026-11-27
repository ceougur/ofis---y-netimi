#!/usr/bin/env node
// 2.5.0 Ç2 — fiş okuması eklenince Ana Defter yollarının hızı (ders 47; plan §8 hacim bütçesi; ders 15: aynı veri kopyası, ölçümler tek tek).
// Veri: test/defter-esdegerlik-250.mjs "uret" ile programın KENDİ API'sinden üretilmiş mutabakat motoru verisi (en az 3.000 işlem). Her koşuda veri klasörü taze
// kopyaya alınır (iki kod aynı baytlardan başlar); sunucu aynı süreçte açılır (sahte saat verinin günü), giriş yapılır, ısınma turundan sonra her uç N kez ölçülür:
// yanıt süresi (ms) ve olay döngüsünün en büyük gecikmesi (perf_hooks.monitorEventLoopDelay, istek boyunca; ms).
//   node test/fis-defteri-olcum-250.mjs --kod <kök> --veri <üretilmiş veri> --cikti <dosya.json> [--tur 15] [--fis 0] [--satir 40]
// --fis N (yalnız yeni kod): ölçümden önce N fiş × --satir satır yazılır (iç API; fiş okumasının maliyeti). Lisans servisine istek yok: HUKUK_LICENSE_URL=http://127.0.0.1:9 (ders 30).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const root = path.resolve(opt("kod"));
const veri = path.resolve(opt("veri"));
const output = path.resolve(opt("cikti"));
const rounds = Number(opt("tur", 15));
const vouchers = Number(opt("fis", 0));
const linesPer = Number(opt("satir", 40));
const saved = JSON.parse(readFileSync(path.join(veri, "esdegerlik-saat.json"), "utf8"));
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test/helpers.mjs")).href);

const work = mkdtempSync(path.join(path.dirname(output), "olcum-"));
const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
const result = { kod: root, veri, now: saved.now, tur: rounds, fis: vouchers, satir: linesPer, node: process.version, uclar: {} };
let tests = 0;
let failed = 0;
const check = (ok, text) => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
};
try {
  cpSync(path.join(veri, "data"), path.join(work, "data"), { recursive: true });
  const server = await startTestServer({ dataDir: path.join(work, "data"), backupDir: path.join(work, "backups"), bankPickLegacy: true, now: { time: saved.now, fixed: true } });
  try {
    const admin = await loginAdmin(server);
    if (vouchers > 0) {
      const V = server.app.ledger.vouchers;
      if (!V) throw new Error("--fis yalnız fiş defteri olan kodda");
      const day = String(server.clock().toISOString()).slice(0, 10);
      for (let i = 0; i < vouchers; i += 1) {
        const lines = [];
        for (let k = 0; k < linesPer / 2; k += 1) lines.push({ account: "590", debit: 100 + k }, { account: "519", credit: 100 + k });
        V.post({ id: "olcum", display_name: "Ölçüm" }, { type: "opening-match", date: day, requestKey: `olcum-fis-${i}`, lines });
      }
      result.yazilanFis = vouchers;
    }
    const year = String(saved.now).slice(0, 4);
    const ends = {
      "ledger (tüm zaman)": "/api/workspace/ledger",
      "ledger (bu yıl)": `/api/workspace/ledger?from=${year}-01-01&to=${year}-12-31`,
      "hesap-mizani (tüm)": "/api/workspace/report-center/hesap-mizani?preset=all",
      "yevmiye (tüm)": "/api/workspace/report-center/yevmiye?preset=all",
    };
    const histogram = monitorEventLoopDelay({ resolution: 1 });
    histogram.enable();
    for (const [name, url] of Object.entries(ends)) {
      const warm = await admin.get(url);
      check(warm.status === 200, `${name}: ısınma 200`);
      const times = [];
      const loops = [];
      for (let k = 0; k < rounds; k += 1) {
        histogram.reset();
        const at = performance.now();
        const response = await admin.get(url);
        times.push(performance.now() - at);
        loops.push(histogram.max / 1e6);
        if (response.status !== 200) check(false, `${name}: tur ${k + 1} ${response.status}`);
      }
      result.uclar[name] = { medyanMs: Math.round(median(times) * 10) / 10, enCokMs: Math.round(Math.max(...times) * 10) / 10, olayDongusuEnCokMs: Math.round(Math.max(...loops) * 10) / 10, olayDongusuMedyanMs: Math.round(median(loops) * 10) / 10 };
      console.log(`# ${name}: medyan ${result.uclar[name].medyanMs} ms, en çok ${result.uclar[name].enCokMs} ms, olay döngüsü en çok ${result.uclar[name].olayDongusuEnCokMs} ms`);
    }
    histogram.disable();
    const build = server.app.ledger.build();
    result.madde = build.length;
    result.fisMaddesi = build.filter(entry => String(entry.id).startsWith("voucher")).length;
    check(result.madde > 0, `yevmiye ${result.madde} madde (fiş ${result.fisMaddesi})`);
  } finally {
    await server.close();
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
writeFileSync(output, JSON.stringify(result, null, 1));
console.log(`1..${tests}\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exit(failed ? 1 : 0);
