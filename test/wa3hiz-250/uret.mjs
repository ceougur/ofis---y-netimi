// Eşdeğerlik fikstürünü üretir: bu dosya + senaryo.mjs, REFERANS kodun (tur 3'ün bildirim-başına GERÇEK kodu, sinama-wa3 028e1b76) `git archive` kopyasına test/wa3hiz-250/ altına konur ve
// O kopyada koşulur (ders 23 / 51). Kullanım: TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 node <kopya>/test/wa3hiz-250/uret.mjs <çıktı.json> <tohum> [<tohum> …]
import { writeFileSync } from "node:fs";
import { runScenario } from "./senaryo.mjs";

const [out, ...seeds] = process.argv.slice(2);
const result = { kaynak: process.env.WA3HIZ_KAYNAK || "", tz: Intl.DateTimeFormat().resolvedOptions().timeZone, uretildi: new Date().toISOString(), senaryolar: {} };
for (const seed of seeds.map(Number)) result.senaryolar[seed] = await runScenario({ seed });
writeFileSync(out, `${JSON.stringify(result)}\n`);
console.log(`yazıldı ${out}: ${seeds.join(", ")}`);
