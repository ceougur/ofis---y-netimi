// Hareket tarihi ve dönem kilidi (v2.0.13) — Kasa, Cari, Stok ve Taksit hareketlerinin tek tarih kuralı.
//
//   · Tarih alanı gönderilmişse boş, null ya da geçersiz olamaz ("2026-13-40", "31.12.2026", "abc" → 400).
//     Alan hiç gönderilmezse sunucu bugünü yazar (veritabanında tarihsiz hareket olmaz).
//   · İleri tarihli hareket girilemez: hareket gerçekleşmiş bir olaydır; gelecekteki ödeme/tahsilat taksit ya da
//     çek/senet vadesiyle planlanır.
//   · Dönem kilidi: yönetici bir tarih kilitler (ör. ay kapanışı 30.09.2026); o tarih ve öncesine hareket eklenemez,
//     o dönemdeki hareket düzeltilemez, silinemez, başka tarihe taşınamaz (409, code "period-locked").
// Mutabakat kapısı aynı kuralları veritabanı düzeyinde ikinci kez denetler (lib/integrity.mjs).
import { HttpError } from "./http.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = value => {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
const pad = value => String(value).padStart(2, "0");
const dayText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
export const LOCK_KEY = "ledger.lockedUntil";

export function createPeriod({ store, now = () => new Date() }) {
  const today = () => {
    const d = now();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const lockedUntil = () => {
    const value = String(store.setting(LOCK_KEY, "") || "");
    return isIsoDate(value) ? value : "";
  };
  /** Kilitli döneme dokunuyor mu? (hareketin eski ya da yeni tarihi) */
  function assertOpen(date, what = "Bu hareket") {
    const lock = lockedUntil();
    if (lock && date && date <= lock) throw new HttpError(409, `${what} ${dayText(date)} tarihli; ${dayText(lock)} ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı.`, { code: "period-locked", lockedUntil: lock });
  }
  /**
   * Hareket tarihi. body[field] hiç yoksa bugün; varsa geçerli, ileri tarihli olmayan ve kilitli dönem dışında olmalı.
   * @param {object} body  istek gövdesi
   * @param {{ field?: string, label?: string, fallback?: string }} options  fallback: alan yoksa kullanılacak tarih
   */
  function movementDate(body, { field = "date", label = "Tarih", fallback = "" } = {}) {
    const present = body && Object.hasOwn(body, field) && body[field] !== undefined;
    const raw = present ? body[field] : fallback || today();
    if (raw === null || String(raw).trim() === "") throw new HttpError(400, `${label} boş olamaz; hareketin tarihini seçin.`, { code: "date-missing" });
    const date = String(raw).trim();
    if (!isIsoDate(date)) throw new HttpError(400, `${label} geçerli bir tarih değil (${date.slice(0, 20)}). Takvimden seçin.`, { code: "date-invalid" });
    if (date > today()) throw new HttpError(400, `İleri tarihli hareket girilemez (${dayText(date)}). Gelecekteki ödeme ya da tahsilatı taksit veya çek/senet vadesiyle planlayın.`, { code: "date-future" });
    assertOpen(date, "Hareket");
    return date;
  }
  /** Vade: işlem (kayıt/satış) tarihinden önce olamaz; geçerli takvim günü olmalı. */
  function dueDate(value, { from, label = "Vade" } = {}) {
    const date = String(value ?? "").trim();
    if (!isIsoDate(date)) throw new HttpError(400, `${label} geçerli bir tarih değil.`, { code: "date-invalid" });
    if (from && date < from) throw new HttpError(400, `${label} (${dayText(date)}) işlem tarihinden (${dayText(from)}) önce olamaz.`, { code: "due-before-start" });
    return date;
  }
  function setLock(value) {
    const date = String(value ?? "").trim();
    if (date && !isIsoDate(date)) throw new HttpError(400, "Kilit tarihi geçerli bir tarih olmalı.");
    if (date && date > today()) throw new HttpError(400, "Gelecekteki bir dönem kilitlenemez.");
    store.setSetting(LOCK_KEY, date);
    return date;
  }
  return { today, lockedUntil, assertOpen, movementDate, dueDate, setLock };
}
