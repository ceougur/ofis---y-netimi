// Ç5-A tur 1c: depodaki sürüm fikstürünü <hedef>/data ve <hedef>/backups olarak açar; fikstürün "bugün"ünü yazar. Kullanım: node fikstur-ac.mjs <depo kökü> <ad> <hedef>
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [repo, name, dest] = process.argv.slice(2);
const { readFixture, unpackFixture } = await import(pathToFileURL(path.join(repo, "test", "guvenilirlik", "fikstur.mjs")).href);
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
unpackFixture(name, { root: dest });
const manifest = readFixture(name);
console.log(manifest?.oncesi?.today || manifest?.today || String(manifest?.now || "").slice(0, 10) || "2026-10-08");
