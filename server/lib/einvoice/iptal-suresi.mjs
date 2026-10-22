// e-Belge İPTAL SÜRESİ (2.4.4 madde 23; kullanıcı kararı 21.10.2026 — CLAUDE.md "KARARLAR" (5)). Kural TEK yerde: bu dosya.
//
// Kaynak: GİB "e-Arşiv Uygulamaları (e-Arşiv Fatura, e-Serbest Meslek Makbuzu) İptal, İhtar/İtiraz Bildirim Kılavuzu" V1.1 §3 (depoda
// docs/kanit/2026-10-22/244-iptal/kaynak/, sha256 KAYNAK.md'de): "e-Arşiv Fatura ve e-SMM belgelerinin iptal işlemlerinde 8 günlük sürenin tespiti
// e-belgenin alıcıya iletilme tarihinden itibaren başlar. İptal işlemi her durumda 8 günlük süre içinde yapılmalıdır." (dayanak TTK 21/2).
// Sayım TBK 92: başlangıç günü sayılmaz, 8. gün dahildir (iletim 14.10 → son iptal günü 22.10). Son günün tatile denk gelmesi süreyi UZATMAZ
// (kılavuz "her durumda" diyor; katı olan seçildi). Gün sınırı programın "bugün"üyle aynı: sunucunun yerel günü (Türkiye kurulumunda UTC+3).
//
// e-Fatura bu kılavuzun konusu değildir (ayrı kılavuz): entegratörden iptal edilmez (adapters.mjs cancel → einvoice-cancel-unsupported); bugünkü
// davranışı değişmez.
import { dayText, isoDay } from "../plans.mjs";

export const CANCEL_WINDOW_DAYS = 8;

// Kuralın kapsadığı belge türleri (profil) ve iletide görünen adı (yalın / -in hâli).
const WINDOW_PROFILES = Object.freeze({ EARSIVFATURA: ["e-Arşiv fatura", "e-Arşiv faturanın"], ESMM: ["e-SMM", "e-SMM'nin"] });

// Alıcıya iletilmiş sayılan e-Belge durumları (entegratör belgeyi kabul etti). Portaldaki taslak (GİB'e gitmedi), Hata (entegratör kabul etmedi),
// sonucu belirsiz ve gönderilmemiş belge bu kurala girmez.
export const TRANSMITTED = Object.freeze(new Set(["processing", "sent", "accepted"]));

// İsteği entegratöre HİÇ gitmemiş gönderim hataları (routes/invoices.mjs sendInvoiceOnce "notSent" sınıfı): iletim girişimi sayılmaz.
export const NOT_SENT_CODES = Object.freeze(new Set(["integrator-channel", "integrator-url", "integrator-credentials", "integrator-login", "integrator-session"]));

export const windowLabel = profile => WINDOW_PROFILES[profile]?.[0] || "";

/**
 * İletim anı, belgenin İşlem Geçmişi kayıtlarından (audit_events: { type, payload, at }, yazım sırasıyla). Belgeyi entegratöre ulaştırmış
 * OLABİLECEK SON girişimin zamanı:
 *   - invoice.e.sent — gönderim (ya da portal taslağının gönderimi) entegratörce kabul edildi;
 *   - invoice.e.draft — portala taslak yüklendi (belge sonra portaldan gönderilmiş olabilir; gönderim bu andan önce olamaz);
 *   - invoice.e.send-failed { status: "none", adapter } ve kod "hiç gitmedi" sınıfında değil — sonucu belirsiz (entegratör almış olabilir).
 * "SON" girişim: iletilmiş belge yeniden gönderilemez (gönderilebilir durumlar dışında; belirsizde önce durum sorulur), bu yüzden iletimden sonra yeni
 * girişim yazılmaz; Hata ya da "bulunamadı" sonrası yeniden gönderilen belgede önceki girişimler eskide kalır. Girişim anı gerçek iletimden önce ya da
 * onunla aynıdır → süre hiçbir zaman gerçek yasal sürenin ötesine uzamaz. Durum sorgusu (invoice.e.status) girişim değildir.
 * 2.4.3 ve önceki sürümler aynı kayıtları aynı anlamla yazdığı için kural eski veride de aynı çalışır. İz yoksa "" (çağıran kesim gününe düşer).
 */
export function transmissionOf(events = []) {
  let at = "";
  for (const event of events) {
    const payload = event.payload || {};
    const attempt =
      event.type === "invoice.e.sent" ||
      event.type === "invoice.e.draft" ||
      (event.type === "invoice.e.send-failed" && payload.status === "none" && Boolean(payload.adapter) && !NOT_SENT_CODES.has(payload.code || ""));
    if (attempt && event.at) at = event.at;
  }
  return at;
}

const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Belgenin iptal penceresi. Kural dışı (tür kapsamda değil, belge iletilmemiş) → null.
 * @param {{ profile: string, eStatus: string, issueDate: string, transmittedAt?: string, today: string }} input
 *   transmittedAt: iletim anı (ISO zaman damgası; transmissionOf). Boşsa kesim günü esas alınır: ileri tarihli belge kaydedilmediği için kesim günü
 *   iletim gününden sonra olamaz — süre uzamaz (2.4.3'ün davranışı).
 * @returns {null | { days, start, source: "iletim" | "kesim", lastDay, late, label }}
 */
export function cancelWindow({ profile, eStatus, issueDate, transmittedAt = "", today }) {
  if (!TRANSMITTED.has(eStatus)) return null;
  return attemptWindow({ profile, issueDate, transmittedAt, today });
}

/**
 * Durumdan bağımsız pencere: belge iletilmiş OLSAYDI süresi (sonucu belirsiz gönderimde "Yalnız Programda İptal" için; kullanıcı kararı 22.10.2026).
 * Kural dışı tür → null.
 */
export function attemptWindow({ profile, issueDate, transmittedAt = "", today }) {
  const label = windowLabel(profile);
  if (!label || !issueDate) return null;
  const sentDay = transmittedAt ? isoDay(new Date(transmittedAt)) : "";
  // Kesimden önce iletim olamaz; olursa (saat geri alınmış vb.) geç olan gün esas alınmaz — erken olan kesim günü de iletimden önce değildir.
  const fromSend = Boolean(sentDay) && sentDay >= issueDate;
  const start = fromSend ? sentDay : issueDate;
  const lastDay = addDays(start, CANCEL_WINDOW_DAYS);
  return { days: CANCEL_WINDOW_DAYS, start, source: fromSend ? "iletim" : "kesim", lastDay, late: today > lastDay, label };
}

/** Süre dolduysa iptal düğmesinin altında ve 409 yanıtında görünen ileti (son gün tarihiyle). */
export function cancelLateText(window) {
  const of = (Object.values(WINDOW_PROFILES).find(([label]) => label === window.label) || [window.label, window.label])[1];
  const from = window.source === "iletim" ? `alıcıya iletildiği ${dayText(window.start)}` : `kesildiği ${dayText(window.start)}`;
  const basis = window.source === "iletim" ? "" : " İletim günü programda kayıtlı olmadığı için kesim günü esas alındı.";
  const remedy = window.label === "e-SMM"
    ? "Makbuz geçerli kalır; düzeltme için mali müşavirinize danışın."
    : "İade faturası kesin; gerekirse doğrusunu yeniden kesin.";
  return `${of} iptal süresi doldu: ${from} gününden sonraki ${window.days} gün içinde (en geç ${dayText(window.lastDay)}) iptal edilebilirdi.${basis} ${remedy}`;
}

/** Süre içindeyse kartta görünen bilgi ("Son İptal Günü"). */
export function cancelDeadlineText(window) {
  const from = window.source === "iletim" ? `alıcıya iletildiği ${dayText(window.start)}` : `kesildiği ${dayText(window.start)}`;
  return `${dayText(window.lastDay)} (${from} gününden sonraki ${window.days} gün${window.source === "iletim" ? "" : "; iletim günü kayıtlı değil"})`;
}
