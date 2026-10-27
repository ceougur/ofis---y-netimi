// 2.4.7 E4 — kâhin ↔ program FARK ANALİZİ (belge başına). Her senaryonun her belgesi (şirket + ortam + ETTN; bakım olayları o şirketin belgelerine eklenir)
// ayrı ayrı programın sürücüsünden (program-surucu.mjs ile aynı eşleme, alt süreç) ve kâhinin KOMUT SATIRINDAN (`kahin.py hesapla`, README arayüzü)
// geçirilir; sayıları ayrışan belgelerin olay dizisi yazılır. Kâhinin koduna bakılmaz.
// Komut: TZ=Europe/Istanbul node test/bagimsiz/edm-sayac/fark-analiz.mjs kabul.json "<birlesim>" <çıktı.json>
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , inputPath, combo, outputPath] = process.argv;
const params = combo.split(";").flatMap(item => ["--param", item]);
const input = JSON.parse(readFileSync(inputPath, "utf8"));
const work = mkdtempSync(path.join(tmpdir(), "edm247-fark-"));
const diffs = [];
try {
  for (const scenario of input.senaryolar) {
    const groups = new Map();
    for (const event of scenario.olaylar) {
      if (!event.ettn) continue;
      const key = `${event.sirket}|${event.ortam}|${String(event.ettn).trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    }
    const maintenance = scenario.olaylar.filter(event => !event.ettn);
    for (const [key, events] of groups) {
      const [company] = key.split("|");
      const list = [...events, ...maintenance.filter(event => event.sirket === company)];
      const gecmis = (scenario.gecmis || []).filter(item => `${item.sirket}|${item.ortam}|${String(item.ettn).trim().toLowerCase()}` === key);
      const one = { senaryolar: [{ ...scenario, ad: "x", olaylar: list, gecmis, referanslar: [] }] };
      const file = path.join(work, "bir.json");
      writeFileSync(file, JSON.stringify(one));
      execFileSync(process.execPath, [path.join(here, "program-surucu.mjs"), file, path.join(work, "p.json")], { env: { ...process.env, TZ: "Europe/Istanbul" } });
      const program = JSON.parse(readFileSync(path.join(work, "p.json"), "utf8")).x.sayilar;
      writeFileSync(path.join(work, "olaylar.json"), JSON.stringify(list));
      const kahin = JSON.parse(execFileSync("python3", ["-I", path.join(here, "kahin.py"), "hesapla", path.join(work, "olaylar.json"), ...params], { encoding: "utf8" })).sayilar;
      if (JSON.stringify(Object.entries(program).sort()) !== JSON.stringify(Object.entries(kahin).sort())) {
        diffs.push({ senaryo: scenario.ad, belge: key, kahin, program, olaylar: list.map(event => `${event.zaman} ${event.olay}`), gecmis: gecmis.map(item => `${item.zaman} ${item.durum} (${item.surum})`) });
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
const pattern = diff => diff.olaylar.map(line => line.split(" ")[1]).join(" → ");
const byPattern = {};
for (const diff of diffs) (byPattern[pattern(diff)] ||= []).push(`${diff.senaryo} ${diff.belge}`);
writeFileSync(outputPath, `${JSON.stringify({ birlesim: combo, fark_belge: diffs.length, desenler: byPattern, ayrinti: diffs }, null, 1)}\n`);
console.log(`ayrışan belge: ${diffs.length}; desen: ${Object.keys(byPattern).length}`);
for (const [key, items] of Object.entries(byPattern)) console.log(`${items.length} × ${key}`);
