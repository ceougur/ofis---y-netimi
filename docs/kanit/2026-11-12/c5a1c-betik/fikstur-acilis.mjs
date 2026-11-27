// Hangi sürüm fikstürünün 001 dosyasında "Açılış…" açıklamalı (göç 48 adayı) ve is_opening işaretli cari satırı var? Kullanım: node fikstur-acilis.mjs <depo>
import path from "node:path";
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const repo = process.argv[2];
const { unpackFixture } = await import(pathToFileURL(path.join(repo, "test/guvenilirlik/fikstur.mjs")).href);
const fold = note => String(note ?? "").trimStart().toLocaleLowerCase("tr-TR").replace(/ç/g, "c").replace(/ı/g, "i").replace(/ş/g, "s");
for (const name of readdirSync(path.join(repo, "test/fixtures")).filter(n => n.startsWith("surum-") && n !== "surum-nesneler")) {
  const fx = unpackFixture(name, { root: `/dev/shm/c5a1c-fa-${name}` });
  const file = ["destekofis.sqlite", "hukuk-ofisi.sqlite"].map(f => path.join(fx.dataDir, f)).find(f => { try { return readdirSync(path.dirname(f)).includes(path.basename(f)); } catch { return false; } });
  try {
    const db = new DatabaseSync(file, { readOnly: true });
    const cols = db.prepare("PRAGMA table_info(account_entries)").all().map(c => c.name);
    const rows = db.prepare(`SELECT note, kind, COALESCE(source, '') AS source${cols.includes("is_opening") ? ", is_opening" : ", 0 AS is_opening"} FROM account_entries`).all();
    const cand = rows.filter(r => ["debt", "credit"].includes(r.kind) && !r.source && Number(r.is_opening) !== 1 && fold(r.note).startsWith("acilis")).length;
    const marked = rows.filter(r => Number(r.is_opening) === 1).length;
    console.log(`${name}: satır ${rows.length} · aday (açıklama) ${cand} · işaretli ${marked}`);
    db.close();
  } catch (e) {
    console.log(`${name}: okunamadı ${e.message}`);
  }
  fx.cleanup();
}
