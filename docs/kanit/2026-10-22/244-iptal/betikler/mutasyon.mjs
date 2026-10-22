// Program mutasyon koşucusu (2.4.4 madde 23): her mutasyonda dosyayı yedekler, tek yerdeki metni değiştirir, testleri kanit.mjs ile koşar
// (TZ=Europe/Istanbul: Türkiye kurulumunun gün sınırı), dosyayı geri yazar ve özetin değişmediğini doğrular.
// Kullanım (depo kökünden): node docs/kanit/2026-10-22/244-iptal/betikler/mutasyon.mjs docs/kanit/2026-10-22/244-iptal/betikler/mutasyon.json mutasyon
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const W = process.cwd();
const [list, prefix] = process.argv.slice(2);
const sha = text => createHash("sha256").update(text).digest("hex");
const rows = [];
for (const m of JSON.parse(readFileSync(list, "utf8"))) {
  const originals = new Map();
  try {
    for (const edit of m.edits) {
      const path = `${W}/${edit.file}`;
      const original = originals.get(path) ?? readFileSync(path, "utf8");
      originals.set(path, original);
      const current = readFileSync(path, "utf8");
      const count = current.split(edit.old).length - 1;
      if (count !== 1) throw new Error(`${m.id}: metin ${count} kez bulundu (${edit.file})`);
      writeFileSync(path, current.replace(edit.old, edit.new));
    }
    const result = spawnSync("node", [`${W}/tools/kanit.mjs`, "kos", `244-iptal/${prefix}-${m.id}`, "--", "node", "--test", ...m.tests], {
      cwd: W, encoding: "utf8", timeout: 900000, env: { ...process.env, TZ: "Europe/Istanbul", HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
    });
    const out = `${result.stdout}\n${result.stderr}`;
    const pick = key => (out.match(new RegExp(`^# ${key} (\\d+)`, "m")) || [])[1];
    rows.push({ id: m.id, desc: m.desc, exit: result.status, tests: pick("tests"), pass: pick("pass"), fail: pick("fail"), caught: result.status !== 0 && Number(pick("fail")) > 0 });
  } finally {
    for (const [path, original] of originals) writeFileSync(path, original);
  }
  for (const [path, original] of originals) if (sha(readFileSync(path, "utf8")) !== sha(original)) throw new Error(`${m.id}: dosya geri yazılamadı`);
}
console.log(JSON.stringify(rows, null, 1));
const caught = rows.filter(row => row.caught).length;
console.log(`# tests ${rows.length}\n# pass ${caught}\n# fail ${rows.length - caught}`);
console.log("git diff (mutasyon sonrası değişmemeli):", execFileSync("git", ["-C", W, "status", "--short"], { encoding: "utf8" }));
process.exitCode = caught === rows.length ? 0 : 1;
