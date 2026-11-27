// tyk-mutasyon-250.mjs API_MUTANTS: her desenin hedef dosyasındaki eşleşme sayısı (kullanım: node desen-say.mjs <kök> [--yeni-yol])
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const root = process.argv[2];
const src = readFileSync(path.join(root, "test/tyk-mutasyon-250.mjs"), "utf8");
const start = src.indexOf("const API_MUTANTS = [");
const end = src.indexOf("\n];", start);
const list = Function(`return ${src.slice(start + "const API_MUTANTS = ".length, end + 3)}`)();
const read = file => (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), "utf8") : "");
const mod = read("server/lib/obligation-input.mjs");
for (const [id, , file, from] of list) {
  const hits = read(file).split(from).length - 1;
  const inMod = mod ? mod.split(from).length - 1 : 0;
  if (hits !== 1 || inMod) console.log(`${id}\t${file}\tdosyada ${hits}\tmodülde ${inMod}`);
}
console.log(`toplam ${list.length}`);
