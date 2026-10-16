// Ders 13 (tarihe bağlı test yok): sabit tarihli örnek Excel'in tarihlerini koşu gününe göre kaydıran kopya. Dosya adı korunur (senaryo
// başlığı ve işlem kaydı adı denetler); yalnız hücre metnindeki gg.aa.yyyy tarihleri değişir, başka bayt değişmez.
// 16.10.2026: ornek-dosyalar.xlsx "Ödeme Sözü" kolonu 15.10.2026'yı sabit taşıyordu; o gün geçince "Önümüzdeki 30 Gün" listesi boşaldı ve
// e2e "akıllı özet kartı" adımı kırmızı oldu (2.3.0 kodunda da; CI #751 bcc542a).
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createZip, readZip } from "../../server/lib/zip.mjs";

const pad = value => String(value).padStart(2, "0");
const dayText = date => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;

/**
 * shifts: { "15.10.2026": 5 } → o tarih koşu gününden 5 gün sonrası olur. Kopyanın yolunu döndürür.
 * Kopyada aranan tarih hiç bulunamazsa hata verir (örnek dosya değişmişse sessizce eski davranışa dönülmez).
 */
export function relativeFixture(file, shifts, { today = new Date() } = {}) {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const found = new Set();
  const entries = readZip(readFileSync(file))
    .filter(entry => !entry.directory)
    .map(entry => {
      if (!/^xl\/(worksheets\/sheet\d+|sharedStrings)\.xml$/.test(entry.name)) return { name: entry.name, data: entry.data };
      let text = entry.data.toString("utf8");
      for (const [fixed, offset] of Object.entries(shifts)) {
        const target = new Date(base);
        target.setDate(target.getDate() + offset);
        const before = text;
        text = text.replaceAll(`>${fixed}<`, `>${dayText(target)}<`);
        if (text !== before) found.add(fixed);
      }
      return { name: entry.name, data: Buffer.from(text, "utf8") };
    });
  const missing = Object.keys(shifts).filter(fixed => !found.has(fixed));
  if (missing.length) throw new Error(`${path.basename(file)}: göreli yapılacak tarih bulunamadı: ${missing.join(", ")}`);
  const out = path.join(mkdtempSync(path.join(tmpdir(), "destekofis-goreli-")), path.basename(file));
  writeFileSync(out, createZip(entries));
  return out;
}
