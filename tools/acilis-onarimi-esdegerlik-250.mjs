#!/usr/bin/env node
// 2.5.0 AH — açılış onarımı (repairOwnCards) eşdeğerliği: aynı verinin iki ayrı kopyası ESKİ kod kökü ve YENİ kod kökü ile sırayla açılır, ikisinden
// aynı döküm alınır (test/guvenilirlik/onarim-dokum.mjs: onarım sonucu, izler, kartlar, taksitler, bütün fatura durumları, cariler, Kasa, aday kart
// görünümleri, Mutabakat Testi) ve bölüm bölüm karşılaştırılır. Eski kod `git archive <taban> | tar -x` kopyasında (ders 23). Sahte durağan saat.
//
//   node tools/acilis-onarimi-esdegerlik-250.mjs --eski <eski kök> [--yeni <yeni kök>] (--veri <data/ + backups/ klasörü> | --fikstur <ad>) --bugun <YYYY-AA-GG>
//        [--ozet] (büyük bölümler sayı + sha256) [--parola <yönetici parolası; kapi-olcum verisi Kapi-Olcum-2026!>] [--eleme] (yeni kodda aday başına toplu ↔ cari başına durum) --calisma <boş klasör> [--cikti <json>]
// Çıkış: 0 = aynı, 1 = fark var.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diffDumps, dumpRepair, openWith } from "../test/guvenilirlik/onarim-dokum.mjs";
import { unpackFixture } from "../test/guvenilirlik/fikstur.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const flag = name => argv.includes(`--${name}`);
const eski = path.resolve(opt("eski"));
const yeni = path.resolve(opt("yeni", ROOT));
const work = path.resolve(opt("calisma"));
const today = opt("bugun");
if (!today || !opt("calisma") || !opt("eski")) throw new Error("--eski, --bugun ve --calisma gerekli");
let source = opt("veri") ? path.resolve(opt("veri")) : null;
let cleanup = null;
if (!source) {
  const unpacked = unpackFixture(opt("fikstur"));
  source = path.dirname(unpacked.dataDir);
  cleanup = unpacked.cleanup;
}
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const run = async (label, root, extra) => {
  const dir = path.join(work, label);
  cpSync(source, dir, { recursive: true });
  const { app, openMs } = await openWith(root, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), today });
  try {
    const dump = await dumpRepair(app, { hash: flag("ozet"), ...(opt("parola") ? { password: opt("parola") } : {}), ...extra });
    return { dump, openMs: Math.round(openMs) };
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
};
const before = await run("eski", eski, {});
if (flag("yalniz-eski")) {
  // Kâhin dosyası: eski kodun gerçek dökümü (test/fixtures/onarim-hiz-250-beklenen.json).
  writeFileSync(path.resolve(opt("cikti")), `${JSON.stringify({ kod: eski, bugun: today, fikstur: opt("fikstur"), dokum: before.dump }, null, 1)}\n`);
  console.log(`eski kod dökümü yazıldı: aday ${before.dump.aday}, onarılan ${before.dump.repair?.fixed?.length}, kilitli ${before.dump.repair?.locked?.length}`);
  cleanup?.();
  rmSync(work, { recursive: true, force: true });
  process.exit(0);
}
const after = await run("yeni", yeni, { screen: flag("eleme") });
const differences = diffDumps(before.dump, after.dump);
const result = {
  eski, yeni, bugun: today,
  acilisMs: { eski: before.openMs, yeni: after.openMs },
  aday: after.dump.aday,
  onarim: { eski: { fixed: before.dump.repair?.fixed?.length, locked: before.dump.repair?.locked?.length }, yeni: { fixed: after.dump.repair?.fixed?.length, locked: after.dump.repair?.locked?.length } },
  bolumler: Object.fromEntries(Object.entries(after.dump).filter(([key]) => !["repair", "eleme"].includes(key)).map(([key, value]) => [key, Array.isArray(value) ? value.length : value?.n ?? (typeof value === "object" ? Object.keys(value || {}).length : value)])),
  eleme: after.dump.eleme || null,
  farklar: differences,
  sonuc: differences.length || (after.dump.eleme && after.dump.eleme.farkli) ? "FARK VAR" : "AYNI",
};
if (opt("cikti")) writeFileSync(path.resolve(opt("cikti")), JSON.stringify({ ...result, dokum: flag("ozet") ? { eski: before.dump, yeni: after.dump } : undefined }, null, 2));
console.log(JSON.stringify(result, null, 2));
cleanup?.();
rmSync(work, { recursive: true, force: true });
process.exitCode = result.sonuc === "AYNI" ? 0 : 1;
