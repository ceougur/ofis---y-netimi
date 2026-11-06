// Fikstür paketleyici (tur 2): <kaynak çıktı> → <hedef fikstür klasörü>. sqlite dosyaları gzip; json'lar aynen; secret.key / e-belge-kullanim ALINMAZ; üretim betiği uret.mjs.txt.
// Kullanım: node paketle.mjs <kaynak> <hedef> <üretim betiği>
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const [src, dst, script] = process.argv.slice(2);
mkdirSync(dst, { recursive: true });
const data = path.join(src, "data");
const put = (from, name) => writeFileSync(path.join(dst, name), gzipSync(readFileSync(from), { level: 9 }));
const listed = [];
for (const name of readdirSync(data)) {
  const full = path.join(data, name);
  if (statSync(full).isDirectory()) continue;
  if (name === "secret.key" || name.startsWith("e-belge-kullanim")) continue;
  if (name.endsWith(".sqlite")) {
    put(full, `${name}.gz`);
    listed.push(`${name}.gz`);
  } else if (name.endsWith(".json")) {
    copyFileSync(full, path.join(dst, name));
    listed.push(name);
  } else throw new Error(`beklenmeyen dosya: ${name}`);
}
const companies = path.join(data, "sirketler");
try {
  for (const code of readdirSync(companies)) {
    for (const name of readdirSync(path.join(companies, code))) {
      if (name === "secret.key") continue;
      if (!name.endsWith(".sqlite")) throw new Error(`beklenmeyen dosya: ${code}/${name}`);
      put(path.join(companies, code, name), `${code}.sqlite.gz`);
      listed.push(`${code}.sqlite.gz`);
    }
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
copyFileSync(path.join(src, "bilgi.json"), path.join(dst, "bilgi.json"));
copyFileSync(script, path.join(dst, "uret.mjs.txt"));
console.log(JSON.stringify({ dst, listed }));
