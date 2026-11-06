// AH ölçüm JSON'larının özeti: node ozet.mjs <json>...
import { readFileSync } from "node:fs";
import path from "node:path";
for (const file of process.argv.slice(2)) {
  try {
    const r = JSON.parse(readFileSync(file, "utf8"));
    console.log(path.basename(file), JSON.stringify({ acilis: r.acilislar.map(a => a.createAppMs), olayDongusu: r.acilislar.map(a => a.olayDongusuEnCokMs), onarim: r.onarimlar.map(o => `${o.ms} ms (fixed ${o.fixed}, locked ${o.locked})`), aday: r.aday, taban: r.tabanTaramasiMs, yukBasta: r.yukBasta, yukSonda: r.yukSonda }));
  } catch (error) {
    console.log(path.basename(file), "okunamadı:", error.message);
  }
}
