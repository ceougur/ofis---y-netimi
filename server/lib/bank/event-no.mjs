// İşlem No (v2.1.0; docs/BANKA-MODULU-PLAN.md §5.4): her para olayının (fin_events) kalıcı, okunur numarası. Biçim
// BNK-<yıl>-<en az 6 hane sıra> (ör. BNK-2026-000123); yıl olayın TARİHİNİN yılıdır (fatura serisindeki gibi), sıra yıl içinde.
//
// Kural (§5.4):
//   - Numara BEGIN IMMEDIATE işleminin İÇİNDE verilir: max(sayaç, o yılın en büyük sırası) + 1; sayaç (settings
//     "meta.bank.seq.<yıl>") aynı işlemde yazılır. İşlem geri alınırsa sayaç da geri alınır (numara hiçbir yere basılmadı).
//   - Sayaç yalnız artar: olaylar silinse ya da şirket sıfırlansa da ("meta." öneki sıfırlamada korunur) numara yeniden
//     kullanılmaz; sayaç kaybolsa (elle silinse) en büyük sıradan sürer. Yedekten geri yüklemede sayaç canlı ile yedeğin BÜYÜĞÜ olur
//     (lib/company-backups.mjs; 001 ve 002 aynı kural — gözden geçirme B4): numara ikinci kez verilmez.
//   - Her şirketin veri tabanı ayrı: şirketlerin sayaçları ayrı.
import { systemClock } from "../clock.mjs";
import { HttpError } from "../http.mjs";

export const EVENT_NO_PREFIX = "BNK";
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
export const eventCounterKey = year => `meta.bank.seq.${year}`;

/** "BNK-2026-000123"; 999.999'dan sonra hane eklenir (kırpılmaz). */
export function eventNoText(year, seq) {
  if (!Number.isSafeInteger(year) || year < 1000 || year > 9999) throw new TypeError(`Geçersiz yıl: ${year}`);
  if (!Number.isSafeInteger(seq) || seq < 1) throw new TypeError(`Geçersiz sıra: ${seq}`);
  return `${EVENT_NO_PREFIX}-${year}-${String(seq).padStart(6, "0")}`;
}

function yearOf(date) {
  const match = DAY.exec(String(date || ""));
  if (!match) throw new HttpError(400, "İşlem tarihi geçerli değil.", { code: "event-date-invalid", field: "date" });
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) throw new HttpError(400, "İşlem tarihi geçerli değil.", { code: "event-date-invalid", field: "date" });
  return year;
}

/**
 * Sıradaki İşlem No: { year, seq, no }. Yalnız işlemin içinde (store.tx) çağrılır; sayaç aynı işlemde yazılır.
 * @param {{ get, run, inTransaction: boolean }} store
 * @param {string} date olayın tarihi (YYYY-AA-GG)
 * @param {{ now?: () => Date }} options iş saati (context.now); sayacın güncellenme damgası
 */
export function nextEventNo(store, date, { now = systemClock } = {}) {
  if (!store.inTransaction) throw new Error("İşlem No yalnız veri tabanı işleminin içinde verilir (store.tx).");
  const year = yearOf(date);
  const key = eventCounterKey(year);
  const counter = Number.parseInt(store.get("SELECT value FROM settings WHERE key = ?", key)?.value || "0", 10);
  const highest = store.get("SELECT COALESCE(MAX(seq), 0) AS n FROM fin_events WHERE year = ?", year).n;
  const seq = Math.max(Number.isSafeInteger(counter) && counter > 0 ? counter : 0, Number(highest) || 0) + 1;
  // Sayaç işlemle birlikte yazılır (settings para tablosu değil: kapıyı tetiklemez).
  store.run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", key, String(seq), now().toISOString());
  return { year, seq, no: eventNoText(year, seq) };
}
