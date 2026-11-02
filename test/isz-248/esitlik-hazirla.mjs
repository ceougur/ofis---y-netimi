// İŞ Z (2.4.8) — eşitlik verisinin hazırlanması: GÖÇ EDİLMİŞ (v44) bir veri kopyasında eleme sınıflarını çoğaltır. Değişiklik AYNI SQL ile bir kez yapılır; eski ve yeni
// kod sonra bu klasörün taze kopyalarıyla koşar (esitlik-kos.mjs) → girdi iki yanda bit bit aynı. Sınıflar: pasif, "WhatsApp Mesajı İstemiyor", silinmiş, geçersiz /
// boş / yurt dışı / sabit hat telefon, aynı telefonlu iki cari, hareketsiz cari, yalnız ileri tarihli hareketi olan cari; geçmişli veride bir kısım toplu iş "başka
// bilgisayarın defterinde açılmış" (taşınan veri: ledger_id başka) sayılır. Kullanım: node test/isz-248/esitlik-hazirla.mjs <veri klasörü (içinde data/)> [taşınan=8]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [VERI, TASINAN = "8"] = process.argv.slice(2);
if (!VERI) throw new Error("kullanım: esitlik-hazirla.mjs <veri> [taşınan]");
const sirketler = JSON.parse(readFileSync(path.join(VERI, "data/sirketler.json"), "utf8")).companies;
const ozet = {};
for (const sirket of sirketler) {
  const file = path.join(VERI, "data", sirket.dir || "", "destekofis.sqlite");
  if (!existsSync(file)) continue;
  const db = new DatabaseSync(file);
  const kolonlar = tablo => db.prepare(`PRAGMA table_info(${tablo})`).all().map(row => row.name);
  const kopyala = (tablo, kaynakId, degisen) => {
    const cols = kolonlar(tablo);
    const secim = cols.map(c => (c in degisen ? "?" : c)).join(", ");
    db.prepare(`INSERT INTO ${tablo} (${cols.join(", ")}) SELECT ${secim} FROM ${tablo} WHERE id = ?`).run(...cols.filter(c => c in degisen).map(c => degisen[c]), kaynakId);
  };
  const ids = db.prepare("SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY ref_no COLLATE NOCASE, id").all().map(row => row.id);
  const dilim = (a, b) => ids.slice(a, b);
  const guncelle = (sql, list) => {
    const st = db.prepare(sql);
    for (const id of list) st.run(id);
    return list.length;
  };
  db.exec("BEGIN");
  const s = {
    pasif: guncelle("UPDATE accounts SET status = 'passive' WHERE id = ?", dilim(3, 18)),
    istemiyor: guncelle("UPDATE accounts SET wa_opt_out = 1 WHERE id = ?", dilim(20, 35)),
    silinmis: guncelle("UPDATE accounts SET deleted_at = '2026-01-05T10:00:00.000Z' WHERE id = ?", dilim(40, 55)),
    gecersizTelefon: guncelle("UPDATE accounts SET phone = '123' WHERE id = ?", dilim(60, 70)),
    bosTelefon: guncelle("UPDATE accounts SET phone = '' WHERE id = ?", dilim(70, 80)),
    yurtDisi: guncelle("UPDATE accounts SET phone = '+44 20 7946 0958' WHERE id = ?", dilim(80, 85)),
    sabitHat: guncelle("UPDATE accounts SET phone = '0212 555 01 02' WHERE id = ?", dilim(85, 90)),
    ayniTelefon: guncelle("UPDATE accounts SET phone = '0532 111 22 33' WHERE id = ?", dilim(95, 97)),
  };
  // Hareketsiz cari (5) ve yalnız ileri tarihli hareketi olan cari (3): var olan bir carinin satırından sabit kimlikle.
  const kaynak = ids[100];
  const borc = db.prepare("SELECT id FROM account_entries WHERE kind = 'debt' AND source = '' ORDER BY id LIMIT 1").get()?.id;
  for (let i = 1; i <= 5; i += 1) kopyala("accounts", kaynak, { id: `isz-hareketsiz-${i}`, name: `İSZ Hareketsiz ${i}`, ref_no: `ISZ-H-${i}`, phone: `0532 000 00 0${i}`, deleted_at: null, status: "active", wa_opt_out: 0 });
  for (let i = 1; i <= 3; i += 1) {
    kopyala("accounts", kaynak, { id: `isz-ileri-${i}`, name: `İSZ İleri Tarihli ${i}`, ref_no: `ISZ-I-${i}`, phone: `0532 000 01 0${i}`, deleted_at: null, status: "active", wa_opt_out: 0 });
    if (borc) kopyala("account_entries", borc, { id: `isz-ileri-e-${i}`, account_id: `isz-ileri-${i}`, date: "2026-12-15", created_at: "2026-01-04T09:00:00.000Z", event_id: "", fin_ref: "", receipt_no: null });
  }
  s.hareketsiz = 5;
  s.ileriTarihli = borc ? 3 : 0;
  // Geçmişli veri: bir kısım toplu iş başka bilgisayarın defterinde açılmış sayılır (taşınan veri yolu: movedSentBefore / movedUnsettled).
  const waVar = db.prepare("SELECT 1 AS found FROM sqlite_master WHERE name = 'wa_batches'").get();
  if (waVar) {
    const tasinan = db.prepare("SELECT id FROM wa_batches ORDER BY created_at, rowid LIMIT ? OFFSET 10").all(Number(TASINAN)).map(row => row.id);
    s.tasinanToplu = guncelle("UPDATE wa_batches SET ledger_id = 'isz-tasinan-defter' WHERE id = ?", tasinan);
  }
  db.exec("COMMIT");
  db.close();
  ozet[sirket.code] = s;
}
console.log(JSON.stringify(ozet));
