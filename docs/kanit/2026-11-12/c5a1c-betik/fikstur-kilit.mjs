// Hangi sürüm fikstürünün veri dosyalarında dönem kilidi var (settings ledger.lockedUntil)? Kullanım: node fikstur-kilit.mjs <depo>
import path from "node:path"; import { readdirSync } from "node:fs"; import { pathToFileURL } from "node:url"; import { DatabaseSync } from "node:sqlite";
const repo = process.argv[2];
const { unpackFixture } = await import(pathToFileURL(path.join(repo, "test/guvenilirlik/fikstur.mjs")).href);
for (const name of readdirSync(path.join(repo, "test/fixtures")).filter(n => n.startsWith("surum-") && n !== "surum-nesneler")) {
  const fx = unpackFixture(name, { root: `/dev/shm/c5a1c-fk-${name}` });
  const files = [];
  const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/destekofis\.sqlite$|hukuk.*\.sqlite$/.test(e.name)) files.push(f); } };
  walk(fx.dataDir);
  const out = files.map(f => { try { const db = new DatabaseSync(f, { readOnly: true }); const v = db.prepare("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'").get()?.value || ""; db.close(); return `${path.relative(fx.dataDir, f)}=${v || "-"}`; } catch (e) { return `${path.relative(fx.dataDir, f)}=?(${e.message.slice(0, 40)})`; } });
  console.log(`${name}: ${out.join(" ")}`);
  fx.cleanup();
}
