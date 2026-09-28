// Kendi kendini onaran veri akışı (v2.0.2): içeri alınan hücrelerdeki, sonucu kesin olan bozuklukları düzeltir ve ne
// yaptığını okuma raporuna yazar. İlke: yalnızca tek bir doğru karşılığı olan bozukluk onarılır; belirsiz olan
// (karışık sayı yazımı, kaymış satır) onarılmaz, veri sağlığında nokta atışı öneriyle gösterilir (quality.mjs).
//
// Onarılanlar:
//   mojibake  — UTF-8 metnin Windows-1254 sanılıp yeniden kodlanması: "Ã§" → "ç", "ÅŸ" → "ş", "Ä±" → "ı".
//   whitespace— görünmez karakterler (sıfır genişlikli boşluk, BOM), tekrar eden boşluklar, baştaki/sondaki boşluk.
//   placeholder— yalnız tire/uzun tire/"n/a" gibi "boş" anlamına gelen hücreler boş yazılır (toplama girmez).
//
// Windows-1254'te 0x80–0x9F ve Türkçe harfler Latin-1'den farklı kod noktalarına gider; ters çevrim için o tablo.
const CP1254 = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98], [0x2122, 0x99],
  [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x0178, 0x9f], [0x011e, 0xd0], [0x0130, 0xdd], [0x015e, 0xde],
  [0x011f, 0xf0], [0x0131, 0xfd], [0x015f, 0xfe],
]);
const MOJIBAKE = /[ÃÄÅÂ][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/;
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;
const decoder = new TextDecoder("utf-8", { fatal: true });

/** "Ã§ocuk" → "çocuk"; onarım kesin değilse (geçersiz UTF-8) metin olduğu gibi kalır. */
export function repairMojibake(text) {
  if (!MOJIBAKE.test(text)) return text;
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code <= 0xff) bytes[index] = code;
    else if (CP1254.has(code)) bytes[index] = CP1254.get(code);
    else return text; // Windows-1254'te olmayan bir karakter: bu metin bozuk kodlama değil
  }
  try {
    const decoded = decoder.decode(bytes);
    return TURKISH.test(decoded) || !MOJIBAKE.test(decoded) ? decoded : text;
  } catch {
    return text;
  }
}

const INVISIBLE = /[​‌‍⁠﻿­]/g;
const NBSP = /[   ]/g;
// Excel/Sheets hata değerleri de boş sayılır: #SAYI/0!, #DIV/0!, #REF!, #BAŞV!, #DEĞER!, #AD?, #YOK…
const PLACEHOLDER = /^(?:-{1,3}|—|–|\.|\?|n\/a|na|yok|null|none|#yok|#n\/a|#(?:div|sayı|sayi)\/0!|#ref!|#başv!|#basv!|#value!|#değer!|#deger!|#name\?|#ad\?|#num!|#sayı!|#sayi!|#null!|#boş!|#bos!|#error!|#hata!|#spill!|#taşma!|#tasma!|#calc!)$/i;

/** Tek hücre: görünmez karakterler, NBSP, fazla boşluk; yer tutucu boş sayılır. Döner: { value, kind|null }. */
export function healCell(value) {
  const text = String(value ?? "");
  if (!text) return { value: text, kind: null };
  let out = text;
  let kind = null;
  if (INVISIBLE.test(out) || NBSP.test(out)) {
    out = out.replace(INVISIBLE, "").replace(NBSP, " ");
    kind = "whitespace";
  }
  const repaired = repairMojibake(out);
  if (repaired !== out) {
    out = repaired;
    kind = "mojibake";
  }
  const trimmed = out.replace(/[ \t]+/g, " ").replace(/^ +| +$/g, "").replace(/ *\n */g, "\n");
  if (trimmed !== out) {
    out = trimmed;
    kind = kind || "whitespace";
  }
  if (out && PLACEHOLDER.test(out)) return { value: "", kind: "placeholder" };
  return { value: out, kind };
}

/**
 * Kayıt dizisini yerinde onarır (kolon adları dâhil). Döner: { cells: onarılan hücre sayısı, kinds: {tür: sayı},
 * samples: [{from, to}] } — okuma raporuna yazılır.
 */
export function healRows(rows, { maxSamples = 6 } = {}) {
  const summary = { cells: 0, kinds: {}, samples: [] };
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith("__")) continue;
      const healed = healCell(value);
      const cleanKey = key.startsWith("Kolon ") ? key : healCell(key).value || key;
      if (cleanKey !== key) {
        delete row[key];
        row[cleanKey] = healed.value;
      } else if (healed.value !== value) row[key] = healed.value;
      if (healed.kind) {
        summary.cells += 1;
        summary.kinds[healed.kind] = (summary.kinds[healed.kind] || 0) + 1;
        if (healed.kind !== "whitespace" && summary.samples.length < maxSamples) summary.samples.push({ from: String(value).slice(0, 40), to: healed.value.slice(0, 40) });
      }
    }
  }
  return summary;
}

const KIND_LABELS = { mojibake: "bozuk Türkçe karakter", whitespace: "görünmez boşluk", placeholder: "boş anlamına gelen işaret" };
/** Rapor notu: "12 hücre onarıldı: 8 bozuk Türkçe karakter (Ã§ocuk → çocuk), 4 görünmez boşluk". */
export function healNote(summary) {
  if (!summary?.cells) return "";
  const parts = Object.entries(summary.kinds).map(([kind, count]) => {
    const sample = summary.samples.find(item => kind === "mojibake" && item.to !== item.from);
    return `${count} ${KIND_LABELS[kind] || kind}${sample ? ` (“${sample.from}” → “${sample.to}”)` : ""}`;
  });
  return `${summary.cells} hücre kendiliğinden onarıldı: ${parts.join(", ")}.`;
}
