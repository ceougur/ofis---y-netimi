// Ders 20 (2.4.5): senaryo-211'in ara sıra kırmızısını ZORLA üretir. Arayüz paketi detay panelindeki "Kaynağı değiştir" /
// "Sheet'te aç" düğmelerini çizer; hof-sources.js gateControls onları HOF.onDom ile (requestAnimationFrame) bir kare sonra
// gizliyordu. Gezinti o aradan okuyunca m7 "küçük harfle başlayan ad kaldı" diyordu.
// Betik senaryo-211'i S211_RAF_GECIKME=<ms> ile koşar (sayfanın requestAnimationFrame'i geciktirilir) ve senaryonun
// "[s211-zorla]" günlüğünden ön koşulu sayar: düğme DOM'a gizleme geciktirilmişken girdi mi (eklendi), girdiği anda
// görünür müydü (görünür=evet). Hüküm:
//   - eklendi = 0 → ön koşul OLUŞMADI, koşu GEÇERSİZ (çıkış 2).
//   - senaryo kırmızı → çıkış 1 (eski kodda beklenen); yeşil + eklendi > 0 → çıkış 0.
// Çalıştırma: node test/e2e/senaryo-211-yaris-zorla.mjs [--gecikme 200]. CI listesinde değildir.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf("--gecikme");
const delay = at >= 0 ? Number(args[at + 1]) : 200;
const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(here, "senaryo-211.mjs")], {
  env: { ...process.env, S211_RAF_GECIKME: String(delay), HUKUK_LICENSE_URL: process.env.HUKUK_LICENSE_URL || "http://127.0.0.1:9" },
  stdio: ["ignore", "pipe", "pipe"],
});
let out = "";
child.stdout.on("data", chunk => {
  out += chunk;
  process.stdout.write(chunk);
});
child.stderr.on("data", chunk => {
  out += chunk;
  process.stderr.write(chunk);
});
const code = await new Promise(resolve => child.on("close", resolve));
const lines = out.split(/\r?\n/);
const added = lines.filter(line => line.startsWith("[s211-zorla] eklendi"));
const shownAtAdd = added.filter(line => line.includes("görünür=evet"));
const later = lines.filter(line => line.startsWith("[s211-zorla] sonra"));
const m7 = lines.find(line => line.includes("küçük harfle başlayan ad kaldı")) || "";
console.log(`\n# s211-zorla gecikme=${delay}ms senaryo-cikis=${code}`);
console.log(`# on-kosul eklendi=${added.length} eklendiginde-gorunur=${shownAtAdd.length} sonra-olculen=${later.length} sonra-gorunur=${later.filter(line => line.includes("görünür=evet")).length}`);
if (m7) console.log(`# m7: ${m7.trim()}`);
if (added.length === 0) {
  console.log("# HÜKÜM: GEÇERSİZ — ön koşul oluşmadı (paket düğmesi geciktirilmiş gizleme sırasında DOM'a girmedi)");
  process.exit(2);
}
console.log(code === 0 ? "# HÜKÜM: YEŞİL (ön koşul oluştu)" : "# HÜKÜM: KIRMIZI");
process.exit(code === 0 ? 0 : 1);
