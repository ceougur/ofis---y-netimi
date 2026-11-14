// Fikstürü iki ayrı kopyaya açar: <hedef>/eski ve <hedef>/yeni (aynı bayt). Bugünün tarihini yazar.
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
const [name, target] = process.argv.slice(2);
const F = await import("/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3/yeni/test/guvenilirlik/fikstur.mjs");
const meta = F.readFixture(name);
mkdirSync(target, { recursive: true });
const fx = F.unpackFixture(name, { root: path.join(target, "eski") });
cpSync(path.join(target, "eski"), path.join(target, "yeni"), { recursive: true, preserveTimestamps: true });
console.log(meta.oncesi?.today || String(meta.now || "").slice(0, 10));
