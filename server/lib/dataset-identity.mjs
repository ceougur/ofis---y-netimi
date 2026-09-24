// Çalışma verisindeki satırların kimliği: yeni bir Excel/Sheets içeri alınırken hangi satırın mevcut hangi satırla
// aynı olduğunu belirler. Saf fonksiyonlardır; göç 4 ve çalışma zamanı aynı kuralı kullanır.
//
// Kural (belirleyici, sırası önemli):
// - Dosya kimliği (ör. "2025/1234", ya da "DOSYA NO" kolonundaki değer) olan satır: sekme + dosya kimliği + o sekmede
//   o kimliğin kaçıncı kez geçtiği. Aynı dosya iki sekmede ayrı satırdır; aynı sekmede iki kez geçerse ikisi de korunur.
// - Kimliği olmayan satır: sekme + kimliksiz satırlar arasındaki sırası. Değerleri değişse de yerinde güncellenir.
// Satırın "dosya kimliği" (caseKey) notların, görevlerin ve düzeltmelerin bağlandığı anahtardır; 1.4.0 ile aynı
// kuralla (canonicalCaseKey) hesaplanır ki mevcut kayıtlar aynı satırlara bağlı kalsın.
import { createHash } from "node:crypto";
import { canonicalCaseKey, columnOrder } from "./sources.mjs";

export const FINGERPRINT_PREFIX = "satir:";

export function rowIdentities(rows) {
  const columns = columnOrder(rows);
  const seen = new Map();
  return rows.map(row => {
    const caseKey = canonicalCaseKey(row, columns);
    const tab = String(row.__sheet || "");
    const base = caseKey.startsWith(FINGERPRINT_PREFIX) ? `p|${tab}` : `k|${tab}|${caseKey}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return { id: `${base}#${count}`, caseKey, tab };
  });
}

// Satır içeriğinin özeti: değişmeyen satır yeniden yazılmaz.
export const rowHash = values => createHash("sha1").update(JSON.stringify(values)).digest("hex");
