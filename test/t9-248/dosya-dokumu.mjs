// T9 ÖLÇEK — veri dosyalarında tablo/dizin başına yer (SQLite dbstat; salt okunur kopya üzerinde). Kullanım: node dosya-dokumu.mjs <sqlite> [ilk N]
import { DatabaseSync } from "node:sqlite";
const [dosya, n = "12"] = process.argv.slice(2);
const db = new DatabaseSync(dosya, { readOnly: true });
const satirlar = db.prepare("SELECT name, SUM(pgsize) AS bayt, COUNT(*) AS sayfa FROM dbstat GROUP BY name ORDER BY bayt DESC LIMIT ?").all(Number(n));
const sayi = ad => { try { return db.prepare(`SELECT COUNT(*) AS c FROM "${ad}"`).get().c; } catch { return null; } };
console.log(JSON.stringify(satirlar.map(r => ({ ad: r.name, mb: Math.round((r.bayt / 1048576) * 10) / 10, satir: sayi(r.name) }))));
