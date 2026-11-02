// Sızan bağlantı çöp toplayıcıyla kapanıyor mu? node --expose-gc gc.mjs <depo> 
import { mkdtempSync, writeFileSync, readdirSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
const { openDatabase } = await import(pathToFileURL(path.join(root, "server/lib/db.mjs")).href);
const dir = mkdtempSync(path.join(tmpdir(), "dk-gc-"));
const file = path.join(dir, "x.sqlite");
writeFileSync(file, "bozuk ".repeat(500));
const count = () => readdirSync("/proc/self/fd").filter(fd => { try { return readlinkSync(`/proc/self/fd/${fd}`) === file; } catch { return false; } }).length;
for (let i = 0; i < 3; i += 1) { try { openDatabase(file); } catch {} }
const before = count();
for (let i = 0; i < 5; i += 1) { globalThis.gc(); await new Promise(r => setTimeout(r, 50)); }
console.log(JSON.stringify({ before, afterGc: count() }));
rmSync(dir, { recursive: true, force: true });
