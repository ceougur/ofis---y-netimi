// Başlık yazımı (v2.0.11): pencere, menü, rapor, kolon ve gösterge adlarında her sözcüğün ilk harfi büyük; bağlaçlar
// ("ve", "ile", "veya", "ya da", "de/da", "ki") küçük; parantez içi açıklama olduğu gibi; kısaltmalar (PDF, KDV) ve
// rakamla başlayan sözcükler değişmez. Türkçe kurala göre büyütür (i → İ). Kullanıcının yazdığı veriye uygulanmaz.
const SMALL = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki"]);

export function titleCase(text) {
  let depth = 0;
  let seenWord = false;
  return String(text ?? "")
    .split(/(\s+)/)
    .map(word => {
      if (!word || /^\s+$/.test(word)) return word;
      const inside = depth > 0 || word.startsWith("(");
      for (const ch of word) {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth = Math.max(0, depth - 1);
      }
      if (inside) return word;
      const bare = word.replace(/[^\p{L}]/gu, "");
      const first = !seenWord;
      if (bare) seenWord = true;
      if (!first && SMALL.has(bare) && word === word.toLocaleLowerCase("tr-TR")) return word;
      const at = word.search(/\p{L}/u);
      if (at < 0 || (at > 0 && /[\p{L}\p{N}]/u.test(word.slice(0, at)))) return word;
      const head = word.slice(0, at) + word[at].toLocaleUpperCase("tr-TR") + word.slice(at + 1);
      // Tireli sözcükte her parça büyük harfle başlar: "Alım-satım" → "Alım-Satım", "E-posta" → "E-Posta".
      return head.split("-").map((part, index) => (index && /^\p{L}/u.test(part) ? part[0].toLocaleUpperCase("tr-TR") + part.slice(1) : part)).join("-");
    })
    .join("");
}
