// Başlarken (2.4.4, iş listesi 16 / KÖ3): yeni kurulumda yöneticiye ilk adımlar listesi. Her adımın durumu VERİDEN hesaplanır
// (elle işaretlenmez); para çekirdeğine dokunmaz, yalnız okur.
//
// "Zaten kurulu" tabanı: şirketin veri dosyası bu sürümle İLK açıldığında (createApp → registerGettingStartedRoutes) bir kez yazılır.
// O an iş verisi (kayıt, cari, fatura, kasa, banka, stok, taksit, çek/senet…) ya da kaydedilmiş Fatura Ayarları varsa şirket
// "established" sayılır ve liste kendiliğinden hiç çıkmaz (2.4.3'ten güncellenen, verisi dolu şirket); boşsa "new".
// Anahtar "client." önekindedir: şirketin veri dosyasıyla birlikte yedeğe girer ve geri yüklenir (meta.* gibi canlıdan aktarılmaz —
// company-backups.mjs COMMON_SETTINGS), Şirket Verisini Sıfırla'da kalır (app.mjs KEEP_SETTINGS). Anahtarı olmayan eski yedek geri
// yüklenince şirket yeniden açılırken taban o dosyanın verisinden hesaplanır.
import { classifyTaxId } from "./tax-id.mjs";

export const BASELINE_KEY = "client.gettingStarted.baseline";
export const hiddenKey = userId => `client.gettingStarted.hidden.${userId}`;
// Adımlar ve sırası (istemcide ad, açıklama ve kısa yol; burada yalnız durum).
export const STEP_IDS = Object.freeze(["company", "seller", "invoiceSettings", "bank", "account"]);
// Varsayılan şirket adı (server/lib/companies.mjs: ofis adı yoksa "Şirket 1"; companies-on-disk "Şirket <n>").
const DEFAULT_COMPANY_NAME = /^şirket\s*\d*$/i;
// İş verisi tabloları: birinde tek satır bile varsa şirket kullanılmış sayılır. Yapılandırma tabloları (kullanıcı, rol, oturum,
// sohbet, değişiklik geçmişi, ayar) sayılmaz.
const BUSINESS_TABLES = Object.freeze([
  "records", "dataset_rows", "notes", "case_notes", "tasks", "payments", "liens", "cash_entries", "plans", "accounts", "account_entries",
  "stock_items", "stock_moves", "cheques", "invoices", "bank_accounts", "fin_events", "bank_lines",
]);

const parse = value => {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
const has = (store, table) => {
  try {
    return Boolean(store.get(`SELECT 1 AS found FROM ${table} LIMIT 1`));
  } catch {
    return false; // tablo yok (çok eski dosya) → veri yok sayılır
  }
};
const invoiceRaw = store => parse(store.setting("invoice.settings", "{}"));
// Fatura Ayarları penceresinden en az bir kez kaydedilmiş mi: PUT bütün ayarı (seller + defaults…) yazar; yalnız test serisi
// başlangıcı (ensureTestStart) ya da sayaç yazımı bu iki anahtarı koymaz.
const invoiceSettingsSaved = raw => Boolean(raw.seller && typeof raw.seller === "object" && raw.defaults && typeof raw.defaults === "object");

export function hasBusinessData(store) {
  return BUSINESS_TABLES.some(table => has(store, table)) || invoiceSettingsSaved(invoiceRaw(store));
}

/** Taban yoksa bir kez yazar; dönüş "new" | "established". */
export function ensureBaseline(store) {
  const current = store.setting(BASELINE_KEY, "");
  if (current === "new" || current === "established") return current;
  const value = hasBusinessData(store) ? "established" : "new";
  store.setSetting(BASELINE_KEY, value);
  return value;
}

/** Adımların durumu (yalnız boole; kişisel ya da gizli bilgi dönmez). companyName: şirket kayıt defterindeki ad. */
export function stepStatus(store, { companyName = "" } = {}) {
  const raw = invoiceRaw(store);
  const seller = raw.seller && typeof raw.seller === "object" ? raw.seller : {};
  const sellerName = String(seller.name || store.setting("office.name", "") || "").trim();
  const taxNo = String(seller.taxNo || "").replace(/\s+/g, "");
  const name = String(companyName || "").trim();
  let bank = false;
  try {
    bank = Boolean(store.get("SELECT 1 AS found FROM bank_accounts WHERE deleted_at IS NULL AND kind NOT IN ('card', 'loan') LIMIT 1"));
  } catch {
    bank = false;
  }
  let account = false;
  try {
    account = Boolean(store.get("SELECT 1 AS found FROM accounts WHERE deleted_at IS NULL LIMIT 1"));
  } catch {
    account = false;
  }
  return {
    company: Boolean(name) && !DEFAULT_COMPANY_NAME.test(name),
    // Firma bilgisi: unvan, geçerli VKN / TCKN, vergi dairesi ve il (faturanın üstündeki zorunlu satıcı bilgisi).
    seller: Boolean(sellerName) && classifyTaxId(taxNo).ok && Boolean(String(seller.taxOffice || "").trim()) && Boolean(String(seller.city || "").trim()),
    invoiceSettings: invoiceSettingsSaved(raw),
    bank,
    account,
  };
}

/** Yanıt gövdesi: show = liste kendiliğinden görünsün mü (yönetici, gizlenmemiş, "new" şirket, eksik adım var). */
export function gettingStarted(store, { userId, companyName = "" } = {}) {
  const baseline = ensureBaseline(store);
  const status = stepStatus(store, { companyName });
  const steps = STEP_IDS.map(id => ({ id, done: status[id] === true }));
  const done = steps.filter(step => step.done).length;
  const hidden = store.setting(hiddenKey(userId), "") === "1";
  const established = baseline === "established";
  return { allowed: true, steps, done, total: steps.length, hidden, established, complete: done === steps.length, show: !hidden && !established && done < steps.length };
}
