// 2.4.8 İş P1 — ARKA PLAN yazımlarında şirket dosyası kilidi (KULLANICI İSTEĞİ "2.5.0'a bırakmayalım"; tasarım notu P1).
//
// Şirket dosyası başka bir süreçte yazmaya kilitliyken (yedekleme / virüs tarayıcı / ikinci kurulum) her yazım denemesi busy_timeout (10 sn) boyunca olay döngüsünü
// tutar ve programın bütün HTTP yanıtları bekler. Arka plan işleri (WhatsApp işçisi ve bakımı, belge temizliği, Sheets eşitlemesi, POS valör kuyruğu, oturum temizliği,
// sohbet arşivi, mutabakat taraması, mobil özet) turunun BAŞINDA guard() çağırır: şirket "kilitli" işaretliyse ya da kısa sınama (store.probeWritable, 150 ms, senkron)
// kilit görürse işaretlenir ve o tur yazım yapılmaz. KULLANICI istekleri bugünkü 10 sn beklemeyi KORUR (yalnız arka plan atlar; veri kaybı yok).
// İşaret gerçek saatle (Date.now) LOCK_BACKOFF_MS sürer, sonra kendiliğinden kalkar. Tur içinde başlayan kilit yine ilk yazımda 10 sn tutar (İş N/O) ve mark() ile işaretlenir.

import { PROBE_CLOSED } from "./db.mjs";

export const LOCK_BACKOFF_MS = 30_000;

/**
 * @param {object} [o]
 * @param {number} [o.backoffMs] işaret süresi
 * @param {boolean} [o.probe] false → sınama yapılmaz (yalnız test oluşturucu; üretim yapılandırmasından ulaşılmaz)
 * @param {() => number} [o.now] gerçek saat
 */
export function createWriteLock({ backoffMs = LOCK_BACKOFF_MS, probe = true, now = () => Date.now() } = {}) {
  const until = new Map(); // anahtar (şirket kimliği) → işaretin bitişi (ms)
  const isMarked = key => {
    const end = until.get(key);
    if (!end) return false;
    if (end <= now()) {
      until.delete(key);
      return false;
    }
    return true;
  };
  return {
    backoffMs,
    mark: key => void until.set(key, now() + backoffMs),
    isMarked,
    /** Arka plan işi bu şirkete şimdi yazabilir mi. Sınama sonucu bilinmiyorsa (işlem içinde) true — bugünkü yol. */
    guard(key, store) {
      if (isMarked(key)) return false;
      if (!probe) return true;
      const probed = store?.probeWritable?.();
      // İş R1: kapalı bağlantı (şirket kapandı) yazılamaz ama KİLİT DEĞİL — işaret konmaz, ekranda not yanmaz.
      if (probed === PROBE_CLOSED) return false;
      if (probed === false) {
        until.set(key, now() + backoffMs);
        return false;
      }
      return true;
    },
  };
}
