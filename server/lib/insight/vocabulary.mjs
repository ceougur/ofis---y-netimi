// Sabit seçenek listesi (kontrollü kelime dağarcığı) analizi (v1.7.0).
//
// Bir kolonun değer dağılımı ("Derdest 40 · Haciz 12") ancak kolon gerçekten birkaç SABİT seçenekten oluşuyorsa doğru
// bilgidir. Serbest yazılmış kolonda aynı anlam farklı biçimlerde geçer ("tebliğ", "Tebliğ edildi", "her ikisinde
// tebliğ", "12.03.2025 tebliğ"); tam eşleşen değerleri saymak yanlış bir tablo çizer. Bu modül dağılımı yalnızca şu
// süzgeçlerin hepsinden geçerse kabul eder:
//   1. Hücrelerin en az %98'i kısa bir etiket (tarih, tutar, telefon, uzun not değil) ve bir seçenekten biri.
//   2. Seçenek sayısı makul (durum/tür için 2–12).
//   3. Seçenekler birbirinden açıkça farklı:
//      - biri diğerini içermiyor ("Tebliğ" ⊂ "Her ikisinde tebliğ"),
//      - aynı kökten türememiş ("Haciz" / "Hacizli", "Kapandı" / "Kapalı"),
//      - yazım farkı değil ("Derdest" / "Derdset"),
//      - bilinen eş anlamlılar değil ("Beklemede" / "Bekliyor", "Açık" / "Aktif").
//      Olumsuzluk bir ayrımdır, örtüşme değil: "Ödendi" / "Ödenmedi", "Tebliğ edildi" / "Tebliğ edilemedi", "Uygun" /
//      "Uygun değil", "Tebliğ" / "Bila tebliğ" ayrı seçeneklerdir.
// Büyük/küçük harf, Türkçe karakter ve noktalama farkları aynı seçenek sayılır ("DERDEST", "derdest.", "Derdest").
import { embeddedDates, readCell } from "./cells.mjs";
import { percentOf } from "./text.mjs";
import { foldText } from "./validators.mjs";

export const CERTAINTY = 0.98;

// Genel durum kavramları (sektörden bağımsız). Yalnızca değerin TAMAMI bu ifadelerden biriyse kullanılır: "Ödeme
// bekliyor" ile "Evrak bekliyor" ayrı seçeneklerdir, "Beklemede" ile "Bekliyor" değildir.
const CONCEPTS = [
  ["bekliyor", "beklemede", "bekleme", "beklenen", "beklenmekte", "bekletiliyor", "askida"],
  ["tamamlandi", "tamam", "tamamlanan", "tamamlanmis", "bitti", "bitmis", "bitirildi", "sonuclandi", "kapandi", "kapali", "kapatildi", "kapanan", "kapanmis"],
  ["acik", "aktif", "devam", "devam ediyor", "devam eden", "suruyor", "surmekte", "derdest", "islemde", "acildi", "acilan", "yururlukte"],
  ["iptal", "iptal edildi", "iptal oldu", "vazgecildi"],
  ["odendi", "odenmis", "odeme yapildi", "odeme alindi", "tahsil edildi"],
  ["odenmedi", "odenmemis", "odeme yapilmadi", "odeme alinmadi", "tahsil edilemedi"],
  ["evet", "var", "olumlu"],
  ["hayir", "yok", "olumsuz"],
  ["red", "ret", "reddedildi", "reddedilen"],
  ["onay", "onaylandi", "onayli", "onaylanan", "kabul", "kabul edildi"],
];
const CONCEPT_OF = new Map(CONCEPTS.flatMap((terms, index) => terms.map(term => [term, index])));
// Tek başına olumsuzluk bildiren kelimeler: "Uygun değil", "Bila tebliğ" ayrı seçeneklerdir.
const NEGATION_WORDS = new Set(["degil", "yok", "olmayan", "olmadi", "olmaz", "bila", "gayri", "edilmedi", "edilemedi", "yapilmadi", "yapilamadi", "alinmadi", "gelmedi", "verilmedi", "kismi", "kismen", "arti", "eksi"]);
// Anlamı değiştirmeyen yardımcı fiiller: "Tebliğ edildi" ile "Tebligat yapıldı", "Haciz konuldu" ile "Hacizli" aynı durumdur.
const LIGHT_VERBS = new Set(["edildi", "yapildi", "konuldu", "konuldu", "verildi", "alindi", "oldu", "olundu", "gerceklesti", "gerceklestirildi", "edilmis", "yapilmis", "konulmus", "verilmis"]);
// Kişi değil birim bildiren kelimeler: "Hukuk Birimi", "Muhasebe Servisi" kişi sayılmaz.
const UNIT_WORDS = new Set(["birim", "birimi", "servis", "servisi", "mudurluk", "mudurlugu", "departman", "departmani", "bolum", "bolumu", "sube", "subesi", "ekip", "ekibi", "merkez", "merkezi", "ofis", "ofisi", "masa", "masasi", "kalem", "kalemi", "daire", "dairesi", "grup", "grubu", "takim", "takimi", "komisyon", "kurul", "kurulu", "bankasi", "sirketi", "ltd", "sti", "as"]);
// Kişi adlarının önündeki unvanlar kişi karşılaştırmasında sayılmaz ("Av. Ayşe Kaya" = "Ayşe Kaya" olabilir).
const TITLES = new Set(["av", "avukat", "dr", "doktor", "uzm", "op", "prof", "doc", "sn", "bay", "bayan", "hanim", "bey", "ogr", "gor", "muh", "smmm", "stj", "stajyer", "ecz", "vet", "dt", "psk"]);

// Seçenek anahtarı: büyük/küçük harf, Türkçe karakter ve noktalama farkı aynı seçenektir; ama "+" ve kelimeye bitişik "-"
// anlam taşır ("A Rh+" / "A Rh-", "A+" / "A-"), kelime olarak korunur.
export const labelKey = value =>
  foldText(
    String(value ?? "")
      .replace(/\+/g, " arti ")
      .replace(/(\S)-(?=\s|$)/g, "$1 eksi "),
  );

// Etiket gibi okunan değer: kısa, tek satır, tarih/tutar/telefon/tarih içeren metin değil. Rakam içerebilir
// ("İstanbul 5. İcra Dairesi", "1. aşama") ama salt sayı olamaz.
export function isLabelish(text) {
  const reading = readCell(text);
  if (reading.kind === "label") return true;
  if (reading.kind !== "mixed") return false;
  const value = String(text).trim();
  return value.length <= 48 && value.split(/\s+/).length <= 6 && !/[\r\n]/.test(value) && !embeddedDates(value).length && /\p{L}/u.test(value);
}

// Karşılaştırma kelimeleri. Kişi adlarında tek harfli kelimeler (ör. "A. Kaya"daki "a") atlanır; seçeneklerde tek harf
// de ayırt edicidir ("Şube A" / "Şube B").
const tokensOf = key => key.split(" ").filter(Boolean);
const commonPrefix = (a, b) => {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return index;
};
// Olumsuzluk bir ayrımdır: ortak kökten sonra bir tarafta olumsuzluk eki, diğer tarafta aynı ekin olumlusu var:
// "öden|di" / "öden|me|di", "edil|di" / "edil|eme|di", "gel|iyor" / "gel|m|iyor", "ilam|lı" / "ilam|sız".
function stripNegation(rest) {
  for (const morpheme of ["eme", "ama", "me", "ma"]) if (rest.startsWith(morpheme) && rest.length > morpheme.length) return rest.slice(morpheme.length);
  if (/^m[iu]yor/.test(rest)) return rest.slice(1);
  return null;
}
// Ek karşılaştırması ses uyumundan bağımsız: "di" = "dı" = "du" = "ti", "miş" = "muş".
const suffixShape = text => text.replace(/[iu]/g, "i").replace(/[ea]/g, "a").replace(/t/g, "d").replace(/c/g, "c");
function negationPair(a, b) {
  const shared = commonPrefix(a, b);
  if (shared < 2) return false;
  const check = (negative, positive) => {
    if (/^(?:siz|suz)/.test(negative) && /^(?:li|lu)/.test(positive)) return true;
    if (/^(?:mez|maz)$/.test(negative) && /^[aeiu]r$/.test(positive)) return true;
    const stripped = stripNegation(negative);
    return stripped !== null && suffixShape(stripped) === suffixShape(positive);
  };
  // Ortak kısım olumsuzluk ekinin ilk harfini yutabilir ("ödenm|iş" / "ödenm|emiş"): bir-iki harf geri çekilerek de bakılır.
  for (let back = 0; back <= 2 && shared - back >= 2; back += 1) {
    const restA = a.slice(shared - back);
    const restB = b.slice(shared - back);
    if (check(restA, restB) || check(restB, restA)) return true;
  }
  return false;
}
// "E" / "Evet", "K" / "Kadın", "Şhs" / "Şahıs": kısa kelime uzun kelimenin kısaltması olabilir.
function abbreviation(short, long) {
  if (short.length > 3 || long.length < short.length + 1 || short[0] !== long[0] || /\d/.test(short + long)) return false;
  let index = 0;
  for (const char of long) if (char === short[index]) index += 1;
  return index === short.length;
}
// Damerau–Levenshtein (bitişik harf yer değişimi dahil), `limit`i aşınca erken biter.
export function editDistance(a, b, limit = 2) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows = [Array.from({ length: b.length + 1 }, (_, index) => index)];
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, rows[i - 2][j - 2] + 1);
      row.push(value);
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    rows.push(row);
  }
  return rows[a.length][b.length];
}

// İki seçenek aynı anlama gelebilir mi? Gelebilirse nedenini döner, açıkça farklıysa null.
export function overlapReason(keyA, keyB, { person = false } = {}) {
  if (keyA === keyB) return "aynı";
  if (keyA.replace(/\s+/g, "") === keyB.replace(/\s+/g, "")) return "yazım"; // yalnızca boşluk farkı
  let a = tokensOf(keyA);
  let b = tokensOf(keyB);
  if (person) {
    a = a.filter(token => !TITLES.has(token) && token.length > 1);
    b = b.filter(token => !TITLES.has(token) && token.length > 1);
    if (!a.length || !b.length) return null;
  }
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyA = [...setA].filter(token => !setB.has(token));
  const onlyB = [...setB].filter(token => !setA.has(token));
  // Biri diğerini içeriyor: fazlalık bir olumsuzluk kelimesiyse ayrı seçenektir ("Uygun" / "Uygun değil").
  if (!onlyA.length || !onlyB.length) {
    const extra = onlyA.length ? onlyA : onlyB;
    if (!extra.length) return "aynı";
    if (!person && extra.some(token => NEGATION_WORDS.has(token))) return null;
    return "içeriyor";
  }
  // Farkı bir sayı olan seçenekler ayrıdır: "1. aşama" / "2. aşama", "İstanbul 5. İcra" / "İstanbul 6. İcra".
  if ([...onlyA, ...onlyB].some(token => /\d/.test(token))) return null;
  const sameStem = (x, y) => {
    const shared = commonPrefix(x, y);
    return shared >= 4 && shared >= 0.6 * Math.min(x.length, y.length) && !negationPair(x, y);
  };
  if (onlyA.length === 1 && onlyB.length === 1) {
    const [x] = onlyA;
    const [y] = onlyB;
    if (!person && negationPair(x, y)) return null;
    const shortest = Math.min(x.length, y.length);
    if (sameStem(x, y)) return "kök";
    if (!person && (abbreviation(x, y) || abbreviation(y, x))) return "kısaltma";
    // Yazım farkı yalnızca yeterince uzun kelimelerde aranır: "Şube A" / "Şube B" bir yazım hatası değildir.
    if (shortest >= (person ? 5 : 4) && editDistance(x, y, 2) <= (shortest >= 8 ? 2 : 1)) return "yazım";
  } else if (!person) {
    // Çok kelimeli: aynı kökten bir kelime çifti ve geri kalanı yalnızca yardımcı fiil ("Tebliğ edildi" / "Tebligat yapıldı").
    for (const x of onlyA) {
      for (const y of onlyB) {
        if (!sameStem(x, y)) continue;
        const restA = onlyA.filter(token => token !== x);
        const restB = onlyB.filter(token => token !== y);
        if ([...restA, ...restB].every(token => LIGHT_VERBS.has(token))) return "kök";
      }
    }
  }
  if (!person && CONCEPT_OF.has(keyA) && CONCEPT_OF.get(keyA) === CONCEPT_OF.get(keyB)) return "eş anlam";
  return null;
}

const REASON_TEXT = {
  içeriyor: (a, b) => `“${a}” ile “${b}” birbirini içeriyor; aynı durumu mu anlatıyor belli değil`,
  kök: (a, b) => `“${a}” ile “${b}” aynı kökten; aynı durumu mu anlatıyor belli değil`,
  yazım: (a, b) => `“${a}” ile “${b}” arasında yalnızca yazım farkı var`,
  kısaltma: (a, b) => `“${a}” ile “${b}” aynı şeyin kısaltması olabilir`,
  "eş anlam": (a, b) => `“${a}” ile “${b}” aynı anlama gelebilir`,
};
export const overlapText = (reason, a, b) => (REASON_TEXT[reason] || REASON_TEXT.içeriyor)(a, b);

// Kişi adı gibi görünen değer: unvanlar dışında 2–4 kelime, yalnızca harf (noktalı kısaltma olabilir: "A. Kaya").
// Tek kelimelik değerler ("Ayşe", "Muhasebe") kişi mi birim mi bilinemez; kişi sayısı olarak sayılmaz.
export function looksLikePersonLabel(text) {
  const value = String(text).trim();
  if (value.length > 60 || /\d/.test(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (!/^[\p{L}.'’\s-]+$/u.test(value)) return false;
  const bare = words.filter(word => !TITLES.has(foldText(word)));
  if (bare.some(word => UNIT_WORDS.has(foldText(word)))) return false;
  return bare.length >= 2 && bare.length <= 4;
}

/**
 * Bir kolonun kapsamdaki dolu değerleri sabit seçenek listesi mi?
 * @param {string[]} values dolu hücreler (kırpılmış)
 * @param {{ maxLabels?: number, minFilled?: number, singletons?: boolean, person?: boolean }} options
 *   singletons: tek geçen değer de seçenek sayılır (sorumlu kişi listesinde bir kişinin tek kaydı olabilir)
 */
export function assessVocabulary(values, { maxLabels = 12, minFilled = 6, singletons = false, person = false } = {}) {
  const filled = values.length;
  const groups = new Map();
  for (const value of values) {
    const key = labelKey(value);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { key, count: 0, forms: new Map(), labelish: null }));
    group.count += 1;
    group.forms.set(value, (group.forms.get(value) || 0) + 1);
  }
  const display = group => [...group.forms].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0]), "tr"))[0][0];
  const main = [];
  const tail = [];
  for (const group of groups.values()) {
    const form = display(group);
    group.value = form;
    group.labelish = Boolean(group.key) && isLabelish(form) && (!person || looksLikePersonLabel(form));
    if (group.labelish && (singletons || group.count >= 2)) main.push(group);
    else tail.push(group);
  }
  main.sort((x, y) => y.count - x.count || x.value.localeCompare(y.value, "tr"));
  tail.sort((x, y) => y.count - x.count);
  const other = tail.reduce((sum, group) => sum + group.count, 0);
  const labels = main.map(group => ({ value: group.value, key: group.key, count: group.count }));
  const result = { filled, labels, other, otherExamples: tail.slice(0, 3).map(group => group.value), distinct: groups.size };
  const fail = (code, reason, examples = []) => ({ ...result, ok: false, code, reason, examples });

  if (filled < minFilled) return fail("few", `yalnızca ${filled} dolu hücre var; dağılım için az`);
  // Seçeneklerin dışında kalan hücrelerin ne olduğu (raporda neden olarak yazılır).
  const kinds = { tarih: 0, sayı: 0, numara: 0, "uzun not": 0, telefon: 0, "kişi adı olmayan değer": 0, "tek geçen ifade": 0 };
  for (const group of tail) {
    const reading = readCell(group.value);
    const kind =
      reading.kind === "date" || (reading.kind === "mixed" && reading.dates?.length) ? "tarih"
      : reading.kind === "amount" ? "sayı"
      : reading.kind === "phone" ? "telefon"
      : reading.kind === "mixed" && !group.labelish && group.value.length <= 48 && !/\p{L}/u.test(group.value) ? "numara"
      : reading.kind === "text" || (reading.kind === "mixed" && !group.labelish) ? "uzun not"
      : person && !group.labelish ? "kişi adı olmayan değer"
      : "tek geçen ifade";
    kinds[kind] += group.count;
  }
  const breakdown = Object.entries(kinds).filter(([, count]) => count).sort((x, y) => y[1] - x[1]).map(([name, count]) => `${name} ${count}`).join(", ");
  if (kinds.sayı >= filled * 0.5) return fail("numeric", "değerler sayı; ne anlama geldikleri bilinmediği için dağılım gösterilmez", result.otherExamples);
  if (kinds.tarih >= filled * 0.5) return fail("dates", "değerlerin çoğu tarih; seçenek listesi değil", result.otherExamples);
  if (main.length < 2) {
    if (groups.size === 1) return fail("single", `tüm dolu hücrelerde aynı değer var (“${labels[0]?.value || display([...groups.values()][0])}”)`);
    return fail("freetext", `değerler serbest yazılmış; sabit seçenekler yok (${breakdown})`, result.otherExamples);
  }
  if (main.length > maxLabels) return fail("many", `çok fazla farklı değer (${main.length}); birkaç sabit seçenekten oluşmuyor`);
  // Örtüşen seçenekler: önce asıl seçenekler arasında; nedene somut örnek vermek için tek geçen etiketler de taranır
  // (en çok 60 değer: çok değerli kolonlar yukarıda zaten elenmiştir).
  const findOverlap = list => {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const reason = overlapReason(list[i].key, list[j].key, { person });
        if (reason) return { text: overlapText(reason, list[i].value, list[j].value), examples: [list[i].value, list[j].value] };
      }
    }
    return null;
  };
  const mainOverlap = findOverlap(main);
  const anyOverlap = mainOverlap || findOverlap([...main, ...tail.filter(group => group.labelish)].slice(0, 60));
  const alsoOverlap = anyOverlap ? `; ayrıca ${anyOverlap.text}` : "";
  if (other > filled * (1 - CERTAINTY)) {
    return fail("freetext", `hücrelerin ${percentOf(other, filled)} sabit seçeneklerin dışında (${breakdown})${alsoOverlap}`, anyOverlap?.examples || result.otherExamples);
  }
  if (mainOverlap) return fail("overlap", mainOverlap.text, mainOverlap.examples);
  return { ...result, ok: true };
}
