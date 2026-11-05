// Defter Türü — TEK YARDIMCI (2.5.0 Ç4; docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §5; BAŞ MİMAR KARARI S2, docs/2.5.0-IS-LISTESI.md D).
// - Ayar şirketin kendi veri tabanında (settings "accounting.bookType", düz metin: sabit kod). İki şirket ayrı ayar taşır; yedek / geri yükleme ayarı dosyayla
//   taşır (ortak ayar listesine — company-backups COMMON_SETTINGS — GİRMEZ). Şirket Verisini Sıfırla korur (app.mjs KEEP_SETTINGS "accounting.").
// - Varsayılan "Seçilmedi" (unset): yeni kurulumda ve eski sürüm verisinde ayar satırı yoktur. Sessiz çıkarım YOK — Kişi Türü (partyKind) ya da VKN / TCKN
//   uzunluğundan defter türü tahmin edilmez (şahıs bilanço esasında, şirket işletme esasında olabilir).
// - Düzenleme Fatura Ayarları → Firma Bilgisi'nden (invoices.settings yetkisi; PUT /api/workspace/invoices/settings gövdesinde bookType).
// - Etki Ç6'da (Bilanço / Gelir Tablosu): okuyan her yer bookTypeOf() kullanır; bozuk / tanınmayan kayıtlı değer "unset" sayılır.
import { HttpError } from "./http.mjs";

export const BOOK_TYPE_KEY = "accounting.bookType";
export const BOOK_TYPE_UNSET = "unset";
// Kayıtlı kod → ekranda görünen ad (yazım düzeni: her sözcüğün ilk harfi büyük). Sıra ekrandaki sıradır.
export const BOOK_TYPES = Object.freeze({
  unset: "Seçilmedi",
  balance: "Bilanço Esası",
  operating: "İşletme Hesabı Esası",
  professional: "Serbest Meslek Kazanç Defteri",
});

const isStore = source => source && typeof source === "object" && typeof source.setting === "function";

/**
 * Şirketin defter türü kodu: "balance" | "operating" | "professional" | "unset".
 * source: şirketin store'u (settings okur) ya da kayıtlı ham değer (metin / null). Tanınmayan, boş ya da okunamayan değer "unset".
 */
export function bookTypeOf(source) {
  let raw = source;
  if (isStore(source)) {
    try {
      raw = source.setting(BOOK_TYPE_KEY, BOOK_TYPE_UNSET);
    } catch {
      raw = BOOK_TYPE_UNSET;
    }
  }
  const code = String(raw ?? "").trim();
  return Object.hasOwn(BOOK_TYPES, code) ? code : BOOK_TYPE_UNSET;
}

/** Ekranda görünen ad. */
export const bookTypeLabel = code => BOOK_TYPES[bookTypeOf(code)];

/** Seçenek listesi (istemci): [{ code, label }]. */
export const bookTypeChoices = () => Object.entries(BOOK_TYPES).map(([code, label]) => ({ code, label }));

/** PUT gövdesindeki bookType'ı denetler; yalnız sabit kodlar kabul edilir (ad, boş değer ya da başka tür 400). */
export function bookTypeInput(value) {
  if (typeof value !== "string" || !Object.hasOwn(BOOK_TYPES, value)) {
    throw new HttpError(400, "Defter Türü seçimi tanınmadı.", { code: "book-type-invalid", field: "bookType" });
  }
  return value;
}
