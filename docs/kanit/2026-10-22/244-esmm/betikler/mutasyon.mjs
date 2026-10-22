// Mutasyon koşucusu: her mutasyonda dosyayı yedekler, tek yerdeki metni değiştirir, testleri kanit.mjs ile koşar, dosyayı geri yazar ve
// özetin değişmediğini doğrular. Kullanım: node mutasyon.mjs <liste.json> <ad-öneki>
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const W = "/home/user/wt/esmm";
const [list, prefix] = process.argv.slice(2);
const sha = text => createHash("sha256").update(text).digest("hex");
const rows = [];
for (const m of JSON.parse(readFileSync(list, "utf8"))) {
  const path = `${W}/${m.file}`;
  const original = readFileSync(path, "utf8");
  const count = original.split(m.old).length - 1;
  if (count !== 1) throw new Error(`${m.id}: metin ${count} kez bulundu`);
  writeFileSync(path, original.replace(m.old, m.new));
  let result;
  try {
    result = spawnSync("node", [`${W}/tools/kanit.mjs`, "kos", `244-esmm/${prefix}-${m.id}`, "--", "node", "--test", ...m.tests], { cwd: W, encoding: "utf8", timeout: 900000 });
  } finally {
    writeFileSync(path, original);
  }
  if (sha(readFileSync(path, "utf8")) !== sha(original)) throw new Error(`${m.id}: dosya geri yazılamadı`);
  const out = `${result.stdout}\n${result.stderr}`;
  const pick = key => (out.match(new RegExp(`^# ${key} (\\d+)`, "m")) || [])[1];
  rows.push({ id: m.id, desc: m.desc, exit: result.status, tests: pick("tests"), pass: pick("pass"), fail: pick("fail"), caught: result.status !== 0 && Number(pick("fail")) > 0 });
}
console.log(JSON.stringify(rows, null, 1));
console.log("git diff (mutasyon sonrası değişmemeli):", execFileSync("git", ["-C", W, "status", "--short"], { encoding: "utf8" }));
