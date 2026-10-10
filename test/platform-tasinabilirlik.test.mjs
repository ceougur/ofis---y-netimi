// Taşınabilirlik (10.10.2026): program müşteride Windows'ta çalışır, CI Windows'ta da koşar. 08.10–10.10 arasında CI'nin
// Windows işi 34 koşu kırmızı kaldı: test dosyaları modülü import(path.join(...)) ile yüklüyordu; Windows'ta "D:\…" geçerli
// bir ESM adresi değil, yükleme düştü. Linux'ta geçtiği için fark edilmedi. Bu test o hata sınıflarını Linux'ta da yakalar:
//   1. import(path.join(…)) / import(path.resolve(…)) — dosya yolu ESM adresi değildir; pathToFileURL(…).href kullanılır.
//   2. new URL(…, import.meta.url).pathname — Windows'ta "/D:/…" verir; fileURLToPath kullanılır.
//   3. Çocuk sürecin signal'ının "SIGKILL" olduğunu iddia etmek — Windows'ta zorla sonlandırılan sürecin sinyal adı dönmez
//      (signal null, status 1); iddia process.platform === "win32" koluyla birlikte yazılır.
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["server", "tools", "client", "test", "scripts"];
const SKIP = new Set(["node_modules", "fixtures", "cikti", ".git"]);

function files() {
  const out = [];
  const walk = dir => {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP.has(name)) continue;
      const full = path.join(dir, name);
      const stats = statSync(full);
      if (stats.isDirectory()) walk(full);
      else if (/\.(mjs|js|cjs)$/.test(name) && !/\.min\.js$/.test(name) && stats.size < 2_000_000) out.push(full);
    }
  };
  for (const root of ROOTS) walk(path.join(ROOT, root));
  return out;
}

const RULES = [
  {
    name: "import(path.join/resolve(…)) yerine import(pathToFileURL(…).href)",
    test: line => /\bimport\(\s*(?:path\.)?(?:join|resolve)\(/.test(line),
  },
  {
    name: "new URL(…, import.meta.url).pathname yerine fileURLToPath(…)",
    test: line => /import\.meta\.url\s*\)\s*\.pathname\b/.test(line),
  },
  {
    name: "signal === \"SIGKILL\" iddiası Windows kolu olmadan (process.platform === \"win32\")",
    test: line => /\.signal\s*(?:,|===|==)\s*["']SIGKILL["']/.test(line) && !/win32/.test(line),
  },
];

describe("platform taşınabilirliği: Windows'ta kırılan kalıplar kaynakta yok", () => {
  const list = files();
  it("taranan dosya var", () => assert.ok(list.length > 100, `yalnız ${list.length} dosya bulundu`));
  for (const rule of RULES) {
    it(rule.name, () => {
      const hits = [];
      for (const file of list) {
        if (file === fileURLToPath(import.meta.url)) continue;
        const lines = readFileSync(file, "utf8").split(/\r?\n/);
        lines.forEach((line, index) => {
          if (rule.test(line)) hits.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 140)}`);
        });
      }
      assert.deepEqual(hits, [], `Windows'ta kırılan kalıp:\n${hits.join("\n")}`);
    });
  }
});
