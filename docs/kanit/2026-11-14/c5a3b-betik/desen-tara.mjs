// tyk-mutasyon-250 API_MUTANTS ve başka mutasyon dosyalarının desenleri: bugünkü ağaçta (dosya, eski metin) kaç kez; taşınan metin account-lines.mjs'te kaç kez.
// Kullanım: node desen-tara.mjs <ağaç kökü>
import { readFileSync } from "node:fs";
import path from "node:path";
const [root] = process.argv.slice(2);
const text = readFileSync(path.join(root, "test/tyk-mutasyon-250.mjs"), "utf8");
const start = text.indexOf("const API_MUTANTS = [");
const end = text.indexOf("\n];", start);
const API_MUTANTS = eval(text.slice(start + "const API_MUTANTS = ".length, end + 3));
const count = (file, s) => {
  try {
    return readFileSync(path.join(root, file), "utf8").split(s).length - 1;
  } catch {
    return -1;
  }
};
let bad = 0;
for (const [id, , file, eski] of API_MUTANTS) {
  const here = count(file, eski);
  const lib = count("server/lib/account-lines.mjs", eski);
  if (here !== 1 || lib > 0) {
    bad += 1;
    console.log(`${id}\t${file}\tburada=${here}\taccount-lines=${lib}`);
  }
}
console.log(`tyk-mutasyon API_MUTANTS toplam ${API_MUTANTS.length}; tek eşleşmeyen ${bad}`);
// Öbür mutasyon dosyalarında account-lines'a taşınan metni hedefleyen desen var mı (dizgi sabitlerini kaba tarama)
const lib = readFileSync(path.join(root, "server/lib/account-lines.mjs"), "utf8");
for (const file of ["test/b2-249/mutasyon.mjs", "test/kasa-acilis-once-250-mutasyon.mjs", "test/bs234-250-mutasyon.mjs", "test/mobil-yazma-247-mutasyon.mjs", "test/r2-249/mutasyon.mjs", "test/obligation-input-250-mutasyon.mjs"]) {
  const src = readFileSync(path.join(root, file), "utf8");
  const lits = [...src.matchAll(/"((?:[^"\\\n]|\\.){20,})"/g)].map(m => {
    try {
      return JSON.parse(`"${m[1]}"`);
    } catch {
      return null;
    }
  }).filter(Boolean);
  const hits = lits.filter(s => lib.includes(s));
  console.log(`${file}: ${lits.length} dizgi, account-lines'ta geçen ${hits.length}${hits.length ? ` → ${hits.map(s => JSON.stringify(s.slice(0, 60))).join(" | ")}` : ""}`);
}
