// Rapor ve ekstre başlığı — TEK YARDIMCI (2.4.5 madde 6c, müşteri isteği M1: "ekstrelerde tabela isimleri olsun … isterse sadece tabela ismi,
// isterse hem firma bilgisi hem tabela ismi").
// - Ayar şirketin kendi veri tabanında (settings "office.reportHeader", JSON { signName, mode }): iki şirket ayrı ayar taşır, yedek / geri yükleme
//   ayarı kendiliğinden taşır (ortak ayar listesine — company-backups COMMON_SETTINGS — GİRMEZ).
// - Düzenleme Fatura Ayarları → Firma Bilgisi'nden (invoices.settings yetkisi; PUT /api/workspace/invoices/settings gövdesinde reportHeader).
// - Tabela Adı BOŞSA başlık bugünkü gibidir (geri uyum): PDF'in sol üstünde tek satır unvan (ya da Rapor Merkezi'nde "001 · Unvan"), Excel'de
//   bugünkü ön satırlar; başlıksız Excel dosyalarına ön satır eklenmez.
// - Dolu Tabela Adı: "Yalnız Tabela Adı" → tek satır Tabela Adı; "Tabela Adı ve Firma Bilgileri" → Tabela Adı + Unvan + VKN / TCKN · Vergi Dairesi +
//   Adres (Fatura Ayarları'ndaki firma bilgisinden; boş alan basılmaz).
// - YASAL BELGELER DEĞİŞMEZ: fatura, e-Belge ve makbuz (tahsilat / serbest meslek) unvanı bu yardımcıyı KULLANMAZ (invoice-pdf.mjs, plan-report
//   receiptPdf, e-Belge XML'i firma bilgisini olduğu gibi basar).
import { HttpError } from "./http.mjs";

export const REPORT_HEADER_KEY = "office.reportHeader";
export const REPORT_HEADER_MODES = Object.freeze({ sign: "Yalnız Tabela Adı", full: "Tabela Adı ve Firma Bilgileri" });
export const SIGN_NAME_MAX = 120;
const INVOICE_SETTINGS_KEY = "invoice.settings";

const clean = value => String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
const parse = raw => {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

/** Kayıtlı ayar: { signName, mode }. Bozuk / eksik ayar varsayılana döner (Tabela Adı boş, Yalnız Tabela Adı). */
export function readReportHeader(store) {
  const raw = parse(store.setting(REPORT_HEADER_KEY, "{}"));
  return { signName: clean(raw.signName).slice(0, SIGN_NAME_MAX), mode: Object.hasOwn(REPORT_HEADER_MODES, raw.mode) ? raw.mode : "sign" };
}

/** PUT gövdesindeki reportHeader'ı denetler; verilmeyen alan öncekinden gelir. */
export function reportHeaderInput(body, previous) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const signName = input.signName === undefined ? previous.signName : clean(input.signName);
  if (signName.length > SIGN_NAME_MAX) throw new HttpError(400, `Tabela Adı en çok ${SIGN_NAME_MAX} karakter olabilir.`, { code: "report-header-invalid", field: "reportHeader.signName" });
  const mode = input.mode === undefined || input.mode === "" ? previous.mode : String(input.mode);
  if (!Object.hasOwn(REPORT_HEADER_MODES, mode)) throw new HttpError(400, "Rapor ve Ekstre Başlığı seçimi tanınmadı.", { code: "report-header-invalid", field: "reportHeader.mode" });
  return { signName, mode };
}

/** Firma bilgisi satırları (Tabela Adı ve Firma Bilgileri seçeneği): Fatura Ayarları'ndaki firma kartından; boş alan atlanır. */
export function firmLines(store) {
  const seller = parse(store.setting(INVOICE_SETTINGS_KEY, "{}")).seller || {};
  const name = clean(seller.name) || clean([seller.firstName, seller.familyName].filter(Boolean).join(" ")) || clean(store.setting("office.name", ""));
  const taxNo = clean(seller.taxNo).replace(/\s+/g, "");
  const taxLabel = taxNo.length === 11 ? "TCKN" : "VKN";
  const tax = [taxNo ? `${taxLabel}: ${taxNo}` : "", clean(seller.taxOffice) ? `Vergi Dairesi: ${clean(seller.taxOffice)}` : ""].filter(Boolean).join(" · ");
  const place = [clean(seller.district), clean(seller.city)].filter(Boolean).join(" / ");
  const address = [clean(seller.address), place].filter(Boolean).join(" ");
  return [name, tax, address].filter(Boolean);
}

/**
 * Bir şirketin (store) rapor başlığı. company: kayıt defterindeki şirket ({ code, name }) döndüren işlev (Rapor Merkezi / Banka / Tablo Raporları
 * etiketi "001 · Unvan").
 */
export function createReportHeader({ store, company = null }) {
  const office = () => clean(store.setting("office.name", ""));
  // Rapor Merkezi etiketi (2.2.0 İz 1.1; 2.0.17 m2 kararı "rapor/PDF/Excel başlığında 001 · Unvan"); önceden üç rotada aynı kopya.
  const companyLabel = () => {
    let entry = null;
    try {
      entry = typeof company === "function" ? company() : null;
    } catch {
      entry = null;
    }
    const name = clean(office() || entry?.name || "");
    const code = clean(entry?.code || "");
    return code && name ? `${code} · ${name}` : name || code;
  };
  /** Tabela açıksa başlık satırları (ilki Tabela Adı), kapalıysa null. */
  const signLines = () => {
    const setting = readReportHeader(store);
    if (!setting.signName) return null;
    if (setting.mode !== "full") return [setting.signName];
    return [setting.signName, ...firmLines(store).filter(line => line !== setting.signName)];
  };
  return {
    office,
    companyLabel,
    signLines,
    /**
     * tablePdf / cashPdf / planStatementPdf seçenekleri: { officeName, officeLines, brand }. Tabela kapalıyken officeName bugünkü değer
     * (withCode → "001 · Unvan"), officeLines yok, brand verilen değer (altbilgi) — çıktı bugünküyle aynı.
     */
    pdf({ withCode = false, brand } = {}) {
      const lines = signLines();
      if (!lines) return { officeName: withCode ? companyLabel() : office(), ...(brand === undefined ? {} : { brand }) };
      return { officeName: lines[0], officeLines: lines, ...(brand === undefined ? {} : { brand: brand ? lines[0] : brand }) };
    },
    /** Excel ön satırları ({ text, bold }): tabela kapalıyken fallback (bugünkü tek satır; boşsa hiç). */
    preamble({ withCode = false } = {}) {
      const lines = signLines();
      if (!lines) {
        const label = withCode ? companyLabel() : office();
        return label ? [{ text: label, bold: true }] : [];
      }
      return lines.map((text, index) => ({ text, bold: index === 0 }));
    },
    /** Başlığı olmayan Excel dosyaları için: tabela kapalıyken [] (dosya bugünküyle aynı), açıkken başlık satırları + rapor adı. */
    extraPreamble(title = "") {
      const lines = signLines();
      if (!lines) return [];
      return [...lines.map((text, index) => ({ text, bold: index === 0 })), ...(title ? [{ text: title, bold: true }] : [])];
    },
    /** Excel Özet sayfasının şirket satırları: tabela kapalıyken [["Şirket", etiket]] (bugünkü), açıkken Tabela Adı + firma satırları. */
    summaryRows({ withCode = true } = {}) {
      const lines = signLines();
      if (!lines) {
        const label = withCode ? companyLabel() : office();
        return label ? [["Şirket", label]] : [];
      }
      return [["Tabela Adı", lines[0]], ...lines.slice(1).map(line => ["Firma", line])];
    },
  };
}
