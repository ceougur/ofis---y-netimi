// Kılavuzdaki ekran adlarının (kalın/eğik yazılan düğme, sekme, alan, seçenek adları) ekranda BİREBİR göründüğünü denetler.
// Ekran metinleri ekran-banka.mjs'in EKRAN_METIN çıktısından gelir (gerçek ekrandan, Playwright ile okunan innerText + seçenekler).
// Kullanım: node docs/kilavuz/metin-denetle.mjs <metinler.json> [bölüm numaraları, virgülle; varsayılan 7,8]
// Çıkış kodu: ekranda bulunmayan ad varsa 1 (liste yazılır; ekranda olmayan bir ad kılavuza girmez).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(HERE, "DestekOfis-Kullanim-Kilavuzu.html"), "utf8");
const texts = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sections = (process.argv[3] || "7,8").split(",").map(Number);
const screen = Object.values(texts).join("\n").replace(/\s+/g, " ");
const norm = value => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// Ekrandaki ad değil (kılavuzun kendi vurgusu, yol tarifi, örnek ya da başka bölüme ait genel ad): bunlar denetim dışında, listede ayrıca yazılır.
const NOT_LABEL = new Set([
  // Madde başı vurguları (kılavuzun kendi sözü; ekranda ad olarak geçmez).
  "Ödeme ve tahsilat yolu", "Kasa ile banka arasında para", "Kasa eksiye düşecekse", "İleri tarih yok", "Hesap ayrıntısı", "Yanlış girdiyseniz", "Kimler kullanır",
]);
const out = { checked: [], missing: [], skipped: [] };
for (const n of sections) {
  const start = html.indexOf(`<h2>${n}. `);
  const end = html.indexOf("<h2>", start + 5);
  if (start < 0) throw new Error(`bölüm ${n} yok`);
  const part = html.slice(start, end < 0 ? undefined : end);
  for (const m of part.matchAll(/<(b|i)>(.*?)<\/\1>/g)) {
    const raw = norm(m[2]);
    // "A → B → C" yolu parçalara bölünür; "A / B" düğme adıdır (ör. Havale / EFT), bölünmez.
    for (const term of raw.split(/\s*→\s*/).map(item => item.replace(/[:.]$/, "").trim()).filter(Boolean)) {
      if (/^\d/.test(term) || term.length < 2) continue;
      if (screen.includes(term)) out.checked.push(`${n}: ${term}`);
      else if (NOT_LABEL.has(term)) out.skipped.push(`${n}: ${term}`);
      else out.missing.push(`${n}: ${term}`);
    }
  }
}
const uniq = list => [...new Set(list)];
console.log(`ekranda bulunan: ${uniq(out.checked).length}`);
for (const item of uniq(out.checked)) console.log("  ✓", item);
console.log(`ekran adı değil (vurgu/yol): ${uniq(out.skipped).length}`);
for (const item of uniq(out.skipped)) console.log("  ·", item);
console.log(`EKRANDA BULUNMAYAN: ${uniq(out.missing).length}`);
for (const item of uniq(out.missing)) console.log("  ✗", item);
console.log(`# tests ${uniq(out.checked).length + uniq(out.missing).length}`);
console.log(`# pass ${uniq(out.checked).length}`);
console.log(`# fail ${uniq(out.missing).length}`);
if (out.missing.length) process.exitCode = 1;
