// Tüm sunucu, araç ve istemci betiklerinin sözdizimini denetler: npm run check
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "vendor", "artifacts", ".git", "dist", "data", "backups"]);
const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(mjs|js)$/.test(name) && !/^(app|xlsx)-[\w-]+\.js$/.test(name)) files.push(full);
  }
};
for (const dir of ["server", "tools", "client", "test"]) walk(path.join(root, dir));
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failed += 1;
    console.error(`✗ ${path.relative(root, file)}\n${error.stderr?.toString() || error.message}`);
  }
}
console.log(`${files.length - failed}/${files.length} dosya sözdizimi denetiminden geçti.`);
process.exit(failed ? 1 : 0);
