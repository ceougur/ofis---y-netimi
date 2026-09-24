// Dağıtım paketi üretir: npm run package → dist/destekofis-<sürüm>.zip
// Pakete yalnızca çalışma için gereken dosyalar girer; veri, yedek, test ve geliştirme dosyaları girmez.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip, readZip } from "../server/lib/zip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const INCLUDE = ["server", "client", "docs", "tools/backup.mjs", "package.json", "README.md", "CHANGELOG.md", "start-server.cmd", "open-client.cmd"];
const EXCLUDE = /(^|\/)(\.DS_Store|Thumbs\.db|.*\.log)$/;

const files = [];
const add = relative => {
  const full = path.join(root, relative);
  let stats;
  try {
    stats = statSync(full);
  } catch {
    return;
  }
  if (stats.isDirectory()) for (const name of readdirSync(full).sort()) add(path.posix.join(relative, name));
  else if (!EXCLUDE.test(relative)) files.push({ name: `destekofis-${pkg.version}/${relative}`, data: readFileSync(full), date: stats.mtime });
};
INCLUDE.forEach(add);

const zip = createZip(files);
readZip(zip); // üretilen paketi hemen doğrula
mkdirSync(path.join(root, "dist"), { recursive: true });
const target = path.join(root, "dist", `destekofis-${pkg.version}.zip`);
writeFileSync(target, zip);
const sha256 = createHash("sha256").update(zip).digest("hex");
writeFileSync(`${target}.sha256`, `${sha256}  ${path.basename(target)}\n`);
console.log(`${path.relative(root, target)} · ${files.length} dosya · ${(zip.length / 1024).toFixed(0)} KB · sha256 ${sha256}`);
