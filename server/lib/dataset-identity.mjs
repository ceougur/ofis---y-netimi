// Çalışma verisindeki satırların kimliği: yeni bir Excel/Sheets içeri alınırken hangi satırın mevcut hangi satırla
// aynı olduğunu belirler. Saf fonksiyonlardır; göç 4 ve çalışma zamanı aynı kuralı kullanır.
//
// Kural (belirleyici, sırası önemli):
// - Dosya kimliği (ör. "2025/1234", ya da "DOSYA NO" kolonundaki değer) olan satır: sekme + dosya kimliği + o sekmede
//   o kimliğin kaçıncı kez geçtiği. Aynı dosya iki sekmede ayrı satırdır; aynı sekmede iki kez geçerse ikisi de korunur.
// - Kimliği olmayan satır: sekme + kimliksiz satırlar arasındaki sırası. Değerleri değişse de yerinde güncellenir.
// Satırın "dosya kimliği" (caseKey) notların, görevlerin ve düzeltmelerin bağlandığı anahtardır; 1.4.0 ile aynı
// kuralla (canonicalCaseKey) hesaplanır ki mevcut kayıtlar aynı satırlara bağlı kalsın.
//
// 1.6.0: Dosya numarası taşımayan verilerde (klinik, mağaza, okul…) her satırın kendi kimlik kolonu vardır ("HASTA NO",
// "SİPARİŞ NO", "PLAKA"). Böyle bir kolon kesin biçimde bulunursa (neredeyse her satırda dolu ve aynı sekmede
// tekrarsız) kimlik o kolondan alınır ("column" kipi); satırın başka bir hücresi değişse de notlar ve düzeltmeler
// kaybolmaz. Hukuk verisi gibi dosya numaralı verilerde eski kural ("legacy" kipi) aynen geçerlidir.
import { createHash } from "node:crypto";
import { analyzeColumn } from "./insight/columns.mjs";
import { canonicalCaseKey, columnOrder } from "./sources.mjs";

export const FINGERPRINT_PREFIX = "satir:";
export const LEGACY_IDENTITY = Object.freeze({ mode: "legacy" });

const keyFor = (row, columns, identity) => {
  if (identity?.mode === "column") {
    const value = String(row[identity.column] ?? "").trim().replace(/\s+/g, " ");
    if (value) return value.slice(0, 300);
  }
  return canonicalCaseKey(row, columns);
};

export function rowIdentities(rows, identity = LEGACY_IDENTITY) {
  const columns = columnOrder(rows);
  const seen = new Map();
  return rows.map(row => {
    const caseKey = keyFor(row, columns, identity);
    const tab = String(row.__sheet || "");
    const base = caseKey.startsWith(FINGERPRINT_PREFIX) ? `p|${tab}` : `k|${tab}|${caseKey}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return { id: `${base}#${count}`, caseKey, tab };
  });
}

// Veriye uygun kimlik kuralı. Dosya numaralı veri (satırların yarısından çoğunda eski kural bir kimlik buluyor ve bu
// kimlikler büyük ölçüde tekrarsız) eski kuralla kalır. Aksi hâlde kesin bir kimlik kolonu aranır; bulunamazsa eski
// kural (içerik parmak izi) kullanılır.
const ID_ROLES = ["id", "plate", "tckn", "vkn", "iban", "email"];
export function detectIdentity(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return LEGACY_IDENTITY;
  const columns = columnOrder(rows);
  let keyed = 0;
  const legacyKeys = new Set();
  for (const row of rows) {
    const key = canonicalCaseKey(row, columns);
    if (key.startsWith(FINGERPRINT_PREFIX)) continue;
    keyed += 1;
    legacyKeys.add(`${row.__sheet || ""}\u0000${key}`);
  }
  if (keyed >= rows.length * 0.5 && legacyKeys.size >= keyed * 0.5) return LEGACY_IDENTITY;

  const candidates = [];
  for (const column of columns) {
    let present = 0;
    let filled = 0;
    let longest = 0;
    const values = new Set();
    let duplicates = 0;
    for (const row of rows) {
      if (!(column in row)) continue;
      present += 1;
      const value = String(row[column] ?? "").trim();
      if (!value) continue;
      filled += 1;
      if (value.length > longest) longest = value.length;
      const key = `${row.__sheet || ""}\u0000${value}`;
      if (values.has(key)) duplicates += 1;
      else values.add(key);
    }
    if (present < rows.length * 0.9 || filled < present * 0.95 || duplicates > filled * 0.02 || longest > 60) continue;
    const analysis = analyzeColumn(rows, column);
    const rank = ID_ROLES.indexOf(analysis.role);
    if (rank < 0) continue;
    // Başlığı kimlik diyen kolon (no, kod, numara…) en güvenilir adaydır; sonra plaka, T.C., VKN, IBAN, e-posta.
    const headerSaysId = analysis.header.includes("id");
    candidates.push({ column, score: (headerSaysId ? 100 : 0) + (ID_ROLES.length - rank) * 10 - duplicates });
  }
  candidates.sort((a, b) => b.score - a.score || columns.indexOf(a.column) - columns.indexOf(b.column));
  return candidates.length ? { mode: "column", column: candidates[0].column } : LEGACY_IDENTITY;
}

export const sameIdentity = (a, b) => (a?.mode || "legacy") === (b?.mode || "legacy") && (a?.column || "") === (b?.column || "");

// Satır içeriğinin özeti: değişmeyen satır yeniden yazılmaz.
export const rowHash = values => createHash("sha1").update(JSON.stringify(values)).digest("hex");
