#!/usr/bin/env node
// 2.5.0 Ç3 — dondurma ÇEKİRDEĞİNİN hızı ve BELLEĞİ, programın açılışı OLMADAN (1.000.000 satır: açılıştaki repairOwnCards onarımı 100.000 satırda ~93 sn, 1.000.000'da dakikalar sürüyor —
// Ç3 dışı bulgu AH; docs/erp/C3-DONDURMA-TASARIM.md §15, §16). Şirket dosyası kopyada doğrudan açılır (göç yok: dosya zaten 47), aynı modüller kurulur (routes/ledger.mjs: build + donmuş
// defter + iş parçacığı); kapı (integrity) ve HTTP KURULMAZ — kilit ucunun çekirdeği: kilit + koşu (küçük işlem) → iş parçacığında türetme → parça parça yazım → tamamlama. Olay döngüsü
// 5 ms'lik yoklayıcıyla; tepe bellek sürecin VmHWM'i (Linux; ana iş parçacığı + dondurma iş parçacığı), her adımdan önce sıfırlanır (/proc/self/clear_refs 5). Veri programın kendi
// ürettiği veri (tools/kapi-olcum.mjs --yalniz-kur). Ders 15: flock ile, tek başına.
//   flock <kilit> node [--max-old-space-size=<MB>] test/donmus-defter-olcum-cekirdek-250.mjs --veri <n-1000000 klasörü> --cikti <dosya.json> [--kilit 2025-12-31] [--parca 500] [--canli-yok] [--esdeger]
//   --canli-yok: ana iş parçacığındaki karşılaştırma türetmesi ve kural farkı atlanır (yalnız dondurma). BELLEK SINIRLI DENEME: node --max-old-space-size=<MB> (iş parçacıklarına da
//   uygulanır; Node worker_threads resourceLimits) + --canli-yok — 100.000 satırda eski okuma (store.all) dondurmayı düşürür, sıkı okuma tamamlar (docs/kanit c3-bellek-sinirli-*).
//   --esdeger: dondurmadan sonra donmuş = canlı, yıl yıl (kanonik madde listesinin sha256'sı; madde madde aynı biçim test/donmus-defter-250.test.mjs canon).
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import v8 from "node:v8";
import { createClock } from "../server/lib/clock.mjs";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { createPeriod } from "../server/lib/period.mjs";
import { createRouter } from "../server/lib/router.mjs";
import { registerLedgerRoutes } from "../server/routes/ledger.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const veri = path.resolve(opt("veri"));
const output = path.resolve(opt("cikti"));
const lockDay = opt("kilit", "2025-12-31");
const batchLines = Number(opt("parca", 500));
const work = mkdtempSync(path.join(path.dirname(output), "donma-cekirdek-"));
const file = path.join(work, "destekofis.sqlite");
const mb = bytes => Math.round(bytes / 1048576);
const result = {
  veri, kilit: lockDay, parca: batchLines, nodeSecenek: process.execArgv.join(" ") || "varsayılan", node: process.version, cpu: os.cpus().length, bellekGb: Math.round(os.totalmem() / 2 ** 30),
  anaYiginSiniriMb: mb(v8.getHeapStatistics().heap_size_limit), yuk: os.loadavg(), olcumler: {},
};
// Sürecin tepe RSS'i (VmHWM, MB); Linux dışında null. resetPeak: sayaç sıfırlanır (her adım kendi tepesini ölçer).
const peakRss = () => {
  try {
    return Math.round(Number(/VmHWM:\s+(\d+)/.exec(readFileSync("/proc/self/status", "utf8"))[1]) / 1024);
  } catch {
    return null;
  }
};
const resetPeak = () => {
  try {
    writeFileSync("/proc/self/clear_refs", "5");
  } catch {
    // Linux dışı
  }
};
// label: olay döngüsünde 50 ms'yi aşan her boşlukta o anki adım (en büyük 8 boşluk sonuçta; nerede takıldığı).
async function timed(fn, label = null) {
  resetPeak();
  let last = performance.now();
  let worst = 0;
  const gaps = [];
  // Boşluğun adımı bir önceki yoklamada görülen adımdır (takılma o adımda başladı).
  let previous = label ? label() : "";
  const probe = setInterval(() => {
    const at = performance.now();
    const gap = at - last - 5;
    worst = Math.max(worst, gap);
    const current = label ? label() : "";
    if (label && gap > 50) gaps.push({ ms: Math.round(gap), at: Math.round(at - started), adim: previous });
    previous = current;
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
  return { ms: Math.round(ms), loopMaxMs: Math.round(Math.max(0, worst)), tepeRssMb: peakRss(), value, ...(label ? { bosluklar: gaps.sort((a, b) => b.ms - a.ms).slice(0, 8), bosluk50: gaps.length } : {}) };
}
const canonLine = entry => JSON.stringify({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) });
let db = null;
let failure = null;
try {
  copyFileSync(path.join(veri, "data", "destekofis.sqlite"), file);
  db = openDatabase(file);
  const store = createStore(db);
  const now = createClock({ time: "2026-10-08T12:00:00+03:00", fixed: true });
  const period = createPeriod({ store, now });
  if (period.lockedUntil()) throw new Error("veride kilit var; kilitsiz veri gerekli");
  const ledger = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: null, period, integrity: () => null, money: null, config: { dbPath: file }, freezeBatchLines: batchLines });
  const S = ledger.snapshots;
  result.satir = Number(store.get("SELECT (SELECT COUNT(*) FROM cash_entries) + (SELECT COUNT(*) FROM account_entries) + (SELECT COUNT(*) FROM payments) + (SELECT COUNT(*) FROM plan_entries) + (SELECT COUNT(*) FROM stock_moves) + (SELECT COUNT(*) FROM cheque_events) AS n").n);
  if (!argv.includes("--canli-yok")) {
    const build = await timed(() => ledger.build().length);
    result.olcumler.canliTuretmeAnaIsParcacigi = { ms: build.ms, loopMaxMs: build.loopMaxMs, tepeRssMb: build.tepeRssMb, madde: build.value };
  }
  const stepOf = () => {
    const status = S.status();
    return status.running ? `${status.phase} ${status.done}` : status.phase || "kilit";
  };
  const lock = await timed(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    store.tx(() => {
      const value = period.setLock(lockDay);
      S.lockChanged({ next: value, user: { id: "olcum", display_name: "Ölçüm" }, reason: "lock" });
    });
    return S.runPending();
  }, stepOf);
  result.olcumler.kilitVeDondurma = { ms: lock.ms, loopMaxMs: lock.loopMaxMs, tepeRssMb: lock.tepeRssMb, durum: lock.value, kapsam: S.coverage(), donmusSatir: Number(store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n), bosluk50: lock.bosluk50, bosluklar: lock.bosluklar };
  if (lock.value.phase !== "tamam") throw new Error(`dondurma tamamlanmadı: ${JSON.stringify(lock.value)}`);
  const year = lockDay.slice(0, 4);
  const read = await timed(() => S.entries({ from: `${year}-01-01`, to: lockDay }).length);
  result.olcumler.donmusYilOkuma = { ms: read.ms, loopMaxMs: read.loopMaxMs, tepeRssMb: read.tepeRssMb, madde: read.value };
  const trial1 = await timed(() => S.trial({ from: `${year}-01-01`, to: lockDay }).accounts.length);
  const trial2 = await timed(() => S.trial({ from: `${year}-01-01`, to: lockDay }).accounts.length);
  result.olcumler.donmusMizanIlk = { ms: trial1.ms, loopMaxMs: trial1.loopMaxMs, tepeRssMb: trial1.tepeRssMb };
  result.olcumler.donmusMizanOnbellek = { ms: trial2.ms, loopMaxMs: trial2.loopMaxMs };
  if (!argv.includes("--canli-yok")) {
    // Kural Değişikliği Farkı (tam taramanın Ç3 denetimi; canlı türetme dahil): kural değişmediği için 0 madde.
    const diff = await timed(() => S.ruleDiff());
    result.olcumler.kuralFarki = { ms: diff.ms, loopMaxMs: diff.loopMaxMs, tepeRssMb: diff.tepeRssMb, madde: diff.value.count, hesap: diff.value.balances.length };
  }
  if (argv.includes("--esdeger")) {
    const check = await timed(() => {
      const byYear = new Map();
      const hashOf = key => {
        if (!byYear.has(key)) byYear.set(key, { frozen: createHash("sha256"), live: createHash("sha256"), frozenCount: 0, liveCount: 0 });
        return byYear.get(key);
      };
      for (const entry of ledger.build()) {
        if (entry.date > lockDay) continue;
        const item = hashOf(entry.date.slice(0, 4));
        item.live.update(canonLine(entry)).update("\n");
        item.liveCount += 1;
      }
      const first = Number(store.get("SELECT MIN(date) AS d FROM ledger_snapshots").d.slice(0, 4));
      for (let y = first; y <= Number(year); y += 1) {
        for (const entry of S.entries({ from: `${y}-01-01`, to: `${y}-12-31` })) {
          const item = hashOf(String(y));
          item.frozen.update(canonLine(entry)).update("\n");
          item.frozenCount += 1;
        }
      }
      return [...byYear.entries()].sort().map(([key, item]) => {
        const frozen = item.frozen.digest("hex");
        const live = item.live.digest("hex");
        return { yil: key, donmusMadde: item.frozenCount, canliMadde: item.liveCount, ayni: frozen === live && item.frozenCount === item.liveCount };
      });
    });
    result.olcumler.esdegerlik = { ms: check.ms, tepeRssMb: check.tepeRssMb, yillar: check.value, hepsiAyni: check.value.every(item => item.ayni) };
    if (!result.olcumler.esdegerlik.hepsiAyni) throw new Error(`donmuş ≠ canlı: ${JSON.stringify(check.value)}`);
  }
  let thawStep = "kilit işlemi (thaw)";
  const thaw = await timed(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    store.tx(() => {
      const value = period.setLock(`${String(Number(year) - 1)}-12-31`);
      S.lockChanged({ next: value, user: null, reason: "lock" });
    });
    thawStep = "bayat satır silme";
    return S.purgeStale();
  }, () => thawStep);
  result.olcumler.kilitGeriCek = { ms: thaw.ms, loopMaxMs: thaw.loopMaxMs, tepeRssMb: thaw.tepeRssMb, silinen: thaw.value, kapsam: S.coverage(), bosluk50: thaw.bosluk50, bosluklar: thaw.bosluklar };
  await S.close();
} catch (error) {
  failure = error;
} finally {
  try {
    db?.close();
  } catch {
    // kapalı
  }
  rmSync(work, { recursive: true, force: true });
}
result.yukSonra = os.loadavg();
if (failure) result.hata = String(failure?.stack || failure);
writeFileSync(output, JSON.stringify(result, null, 1));
for (const [name, value] of Object.entries(result.olcumler)) {
  console.log(`${name}: ${value.ms} ms, olay döngüsü en çok ${value.loopMaxMs ?? "-"} ms, tepe RSS ${value.tepeRssMb ?? "-"} MB${value.donmusSatir ? ` · ${value.donmusSatir} donmuş satır` : ""}${value.madde !== undefined ? ` · ${value.madde} madde` : ""}${value.hepsiAyni !== undefined ? ` · donmuş = canlı ${value.hepsiAyni ? "EVET" : "HAYIR"} (${value.yillar.map(item => `${item.yil} ${item.donmusMadde}/${item.canliMadde}`).join(", ")})` : ""}${value.bosluklar ? ` · 50 ms'yi aşan boşluk ${value.bosluk50}${value.bosluklar.length ? ` (en büyükler: ${value.bosluklar.slice(0, 4).map(gap => `${gap.ms} ms @${gap.adim}`).join("; ")})` : ""}` : ""}`);
}
console.log(`para satırı ${result.satir} · ana yığın sınırı ${result.anaYiginSiniriMb} MB · node ${result.nodeSecenek} · yük ${result.yuk.map(n => n.toFixed(2)).join(" ")} → ${result.yukSonra.map(n => n.toFixed(2)).join(" ")}`);
if (failure) {
  console.log(`HATA: ${failure.message}`);
  console.log(`\n# tests 1\n# pass 0\n# fail 1`);
  process.exitCode = 1;
} else console.log(`\n# tests 1\n# pass 1\n# fail 0`);
