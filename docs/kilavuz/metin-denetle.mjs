// Kılavuzdaki ekran adlarının (kalın/eğik yazılan düğme, sekme, alan, seçenek adları) ekranda BİREBİR göründüğünü denetler.
// Ekran metinleri ekran-banka.mjs'in EKRAN_METIN çıktısından gelir (gerçek ekrandan, Playwright ile okunan innerText + seçenekler).
// Kullanım: node docs/kilavuz/metin-denetle.mjs <metinler.json> [bölüm numaraları, virgülle; varsayılan 7,8]
// ya da ekran-banka.mjs --denetim (npm run test:kilavuz-metin) içinden: denetle(texts) + yazdir(sonuç).
// Çıkış kodu: ekranda bulunmayan ad varsa 1 (liste yazılır; ekranda olmayan bir ad kılavuza girmez).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const norm = value => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// Ekrandaki ad değil (kılavuzun kendi vurgusu, yol tarifi, örnek ya da başka bölüme ait genel ad): bunlar denetim dışında, listede ayrıca yazılır.
const NOT_LABEL = new Set([
  // Madde başı vurguları (kılavuzun kendi sözü; ekranda ad olarak geçmez).
  "Ödeme ve tahsilat yolu", "Kasa ile banka arasında para", "Kasa eksiye düşecekse", "İleri tarih yok", "Hesap ayrıntısı", "Yanlış girdiyseniz", "Kimler kullanır",
  "Hesap açılışından önceki havaleyi girmek ya da düzeltmek", "\"Aktarılmış eski hareket\" uyarısı",
  // v2.2.0 (İz 2): madde başı vurguları.
  "Kullanım işaretleri", "Bakiye", "Hesap yoksa",
  // v2.2.0 (İz 3): POS ile Tahsilat madde başları.
  "POS tanımlama", "POS ile tahsilat", "İptal ve iade",
  // 2.4.9 B4: madde başı vurguları (iki ekran adını birleştiren kılavuz sözü; parçaları — Vade Takip, PDF, Excel — ayrıca denetlenir).
  "Zil ve Vade Takip", "Hareketler sekmesinde PDF / Excel",
]);

/** Kılavuzun verilen bölümlerindeki <b>/<i> adlarını ekran metinleriyle karşılaştırır. html verilmezse depodaki kılavuz okunur. */
export function denetle(texts, sections = [7, 8], html = readFileSync(path.join(HERE, "DestekOfis-Kullanim-Kilavuzu.html"), "utf8")) {
  const screen = Object.values(texts).join("\n").replace(/\s+/g, " ");
  const out = { checked: [], missing: [], skipped: [] };
  for (const n of sections) {
    const start = html.indexOf(`<h2>${n}. `);
    const end = html.indexOf("<h2>", start + 5);
    if (start < 0) throw new Error(`bölüm ${n} yok`);
    const part = html.slice(start, end < 0 ? undefined : end);
    for (const m of part.matchAll(/<(b|i)>(.*?)<\/\1>/g)) {
      const raw = norm(m[2]);
      // "A → B → C" yolu ve "A · B · C" sırası parçalara bölünür; "A / B" düğme adıdır (ör. Havale / EFT), bölünmez.
      for (const term of raw.split(/\s*(?:→|\s·\s)\s*/).map(item => item.replace(/[:.]$/, "").trim()).filter(Boolean)) {
        if (/^\d/.test(term) || term.length < 2) continue;
        if (screen.includes(term)) out.checked.push(`${n}: ${term}`);
        else if (NOT_LABEL.has(term)) out.skipped.push(`${n}: ${term}`);
        else out.missing.push(`${n}: ${term}`);
      }
    }
  }
  const uniq = list => [...new Set(list)];
  return { checked: uniq(out.checked), missing: uniq(out.missing), skipped: uniq(out.skipped) };
}

/** Sonucu yazar; ozet: false iken node:test biçimli özet satırları yazılmaz (çağıran kendi toplamını yazar). */
export function yazdir(result, { ozet = true } = {}) {
  console.log(`ekranda bulunan: ${result.checked.length}`);
  for (const item of result.checked) console.log("  ✓", item);
  console.log(`ekran adı değil (vurgu/yol): ${result.skipped.length}`);
  for (const item of result.skipped) console.log("  ·", item);
  console.log(`EKRANDA BULUNMAYAN: ${result.missing.length}`);
  for (const item of result.missing) console.log("  ✗", item);
  if (!ozet) return;
  console.log(`# tests ${result.checked.length + result.missing.length}`);
  console.log(`# pass ${result.checked.length}`);
  console.log(`# fail ${result.missing.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const texts = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const sections = (process.argv[3] || "7,8").split(",").map(Number);
  const result = denetle(texts, sections);
  yazdir(result);
  if (result.missing.length) process.exitCode = 1;
}
