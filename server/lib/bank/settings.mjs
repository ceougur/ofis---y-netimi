// Banka Ayarları (v2.1.0 Aşama 3; docs/BANKA-MODULU-PLAN.md §8.11, §5.4, Ek A).
//
// Kullanıcı kararı: "arayüz içinden çıkılmaz olmasın" — ayarlar Temel (açık gelir) ve Gelişmiş (kapalı gelir; "Gelişmiş Ayarları Göster")
// bölümlerinden oluşur, standartlar seçili gelir (en yaygın ve modern seçenek, Ek A), profesyonel kullanıcı Gelişmiş'te istediğini açar; her
// bölümde ve tümünde "Varsayılanlara Dön". Saklama: settings "bank.settings" (JSON); okumada kod varsayılanlarıyla birleştirilir (eksik
// anahtar varsayılandır, tanınmayan anahtar atılır), içindeki hesap kimlikleri doğrulanır (silinmiş/pasif/uygunsuz hesap boş sayılır).
// Ayarlar yalnız YENİ kayıtlara uygulanır (ör. hesap eşlemesi bank_lines.gl'ye yazım anında saklanır; geçmiş değişmez).
//
// Spesifikasyon tek yerde (SPEC): bölüm (id, düzey, ad) ve kalemler (anahtar, ad, tür, varsayılan, seçenekler, sınır). Arayüz bu listeden
// çizer; doğrulama da buradan. Adlar başlık yazımıyla (test/banka-210-ayarlar.test.mjs ve yazım düzeni testi denetler).
import { HttpError } from "../http.mjs";
import { EVENT_PREFIX_RULE } from "./event-no.mjs";
import { ROLE_GL } from "./voucher.mjs";

export const SETTINGS_KEY = "bank.settings";

const EXPENSE_GL = ROLE_GL.expense;
const INCOME_GL = ROLE_GL.income;
/** Masraf ve komisyon eşlemesi: faturalı masrafın gider kalemi olabilen hesaplar (770 Genel Giderler, 653 Komisyon Giderleri). */
export const FEE_GL = Object.freeze(["770", "653"]);

// Masraf türleri (§8.11 Temel → Masraf): hesabı masraf türü belirler (vergi kipinden bağımsız; Ek A.1/24).
const FEE_TYPES = [
  { key: "eft", name: "EFT", gl: "770" },
  { key: "fast", name: "FAST", gl: "770" },
  { key: "havale", name: "Havale", gl: "770" },
  { key: "swift", name: "SWIFT", gl: "770" },
  { key: "hesap-isletim", name: "Hesap İşletim", gl: "770" },
  { key: "doviz-islem", name: "Döviz İşlem", gl: "770" },
  { key: "diger", name: "Diğer", gl: "770" },
  { key: "pos-komisyonu", name: "POS Komisyonu", gl: "653" },
  { key: "sanal-pos-komisyonu", name: "Sanal POS Komisyonu", gl: "653" },
];
// Ekstre eşleştirmesinin anahtar sözcükleri (§3.13/5): bankaların kendi açıklamaları.
const KEYWORDS = {
  pos: ["POS", "ÜYE İŞYERİ", "UYE ISYERI", "POS İADE"],
  cash: ["NAKİT", "NAKIT", "ATM", "PARA ÇEKME"],
  transfer: ["VİRMAN", "VIRMAN", "HESAPLAR ARASI"],
  fee: ["ÜCRET", "UCRET", "MASRAF", "KOMİSYON", "BSMV"],
  interest: ["FAİZ", "FAIZ", "STOPAJ", "KMH"],
};

const choice = (value, options) => ({ type: "select", default: value, options });
const bool = value => ({ type: "bool", default: value });
const int = (value, min, max) => ({ type: "number", default: value, min, max });
const fixed = (value, text) => ({ type: "fixed", default: value, value, text });

/** Bölümler: id, düzey (basic | advanced), ad, kalemler [anahtar, ad, tanım, yardım]. */
export const SPEC = Object.freeze([
  {
    id: "account", level: "basic", label: "Hesap",
    items: [
      ["selection", "Banka Hesabı Seçimi", fixed("auto", "Tek Hesapta Otomatik, Birden Çokta Zorunlu"), "Tek uygun hesap varsa formda seçici gizlenir ve o hesap kullanılır; birden çoksa seçim zorunludur."],
      ["defaultAccountId", "Varsayılan Tahsilat Hesabı", { type: "account", default: "" }, "Boş bırakılırsa ilk açılan TL vadesiz hesap."],
      ["defaultPosId", "Varsayılan POS", { type: "pos", default: "" }, "Boş bırakılırsa ilk tanımlanan POS."],
    ],
  },
  {
    id: "negative", level: "basic", label: "Eksi Bakiye",
    items: [["policy", "Banka Hesapları", choice("warn", [["warn", "Uyar"], ["block", "Engelle"], ["off", "Kontrol Yok"]]), "Açılış bakiyesi doğrulanana kadar denetim kapalıdır; KMH ve kart limitine kadar serbest. Hesap kartında hesap bazında da değiştirilir."]],
  },
  {
    id: "similar", level: "basic", label: "Mükerrer",
    items: [["enabled", "Benzer İşlem Uyarısı", bool(true), "Aynı iş günü, aynı hesap, aynı cari, aynı tutar ve aynı hedefte ikinci hareket uyarı verir (hesaba bağlı banka, POS ve kurumsal kart hareketleri)."]],
  },
  {
    id: "pos", level: "basic", label: "POS",
    items: [
      ["valorRule", "Valör", choice("business", [["business", "İş Günü"], ["calendar", "Takvim Günü"], ["same_day", "Aynı Gün"]]), "POS kartında ayrıca değiştirilir."],
      ["valorDays", "Valör Günü", int(1, 0, 60), "Satıştan kaç gün sonra bankaya geçer."],
      ["taxMode", "Komisyon Vergisi", choice("by_provider", [["by_provider", "Sağlayıcı Türüne Göre"], ["bsmv_incl", "BSMV Dahil"], ["bsmv_excl", "BSMV Hariç"], ["vat_incl", "KDV Dahil (Faturalı)"], ["vat_excl", "KDV Hariç (Faturalı)"], ["none", "Yok"]]), "Banka POS'unda BSMV dahil, ödeme kuruluşunda KDV hariç (faturalı)."],
      ["refundCommission", "İadede Komisyon", choice("none", [["none", "İade Edilmez"], ["proportional", "Oransal"], ["full", "Tam"]]), ""],
    ],
  },
  {
    id: "fee", level: "basic", label: "Masraf",
    items: [
      ["tax", "Banka Masrafı Vergisi", choice("bsmv_incl", [["bsmv_incl", "BSMV Dahil"], ["bsmv_excl", "BSMV Hariç"], ["vat_incl", "KDV Dahil (Faturalı)"], ["vat_excl", "KDV Hariç (Faturalı)"], ["none", "Yok"]]), "Masraf formunda da seçilir."],
      ["types", "Masraf Türleri", { type: "feeTypes", default: FEE_TYPES }, "Her türün hesabı sabittir (770 ya da 653); vergi kipi hesabı değiştirmez."],
    ],
  },
  {
    id: "fx", level: "basic", label: "Döviz",
    items: [
      ["source", "Kur Kaynağı", choice("tcmb", [["tcmb", "TCMB Otomatik ve Elle"], ["manual", "Yalnız Elle"]]), ""],
      ["invoiceSuggest", "Faturada Kur Önerisi", bool(true), "Satışta TCMB döviz alış, alışta döviz satış kuru önerilir."],
      ["revaluationReminder", "Ay Sonu Değerleme Hatırlatması", bool(true), ""],
    ],
  },
  {
    id: "holiday", level: "basic", label: "Tatil",
    items: [["calendar", "Takvim", fixed("tr", "Türkiye Resmî Tatilleri"), "Resmî tatiller ve arife yarım günleri programda hazır gelir; hafta sonu ve arife ayarı Gelişmiş → Tatil'de."]],
  },
  {
    id: "posAdvanced", level: "advanced", label: "POS",
    items: [
      ["settlement", "Bankaya Geçiş", choice("auto", [["auto", "Otomatik (Valör Gününde)"], ["statement", "Ekstre ile"], ["manual", "Elle Onay"]]), ""],
      ["installmentPayout", "Taksitli Satışta Ödeme", choice("monthly", [["monthly", "Taksit Taksit (Her Ay, İlki 1 Ay Sonra)"], ["single", "Tek Seferde"], ["first_valor", "İlki Valör Gününde"]]), ""],
      ["blockDays", "Bloke Süresi (Gün)", int(0, 0, 365), ""],
      ["provisionDays", "Provizyon Süresi (Gün)", int(0, 0, 30), "0: aynı gün (gün sonuna kadar iptal)."],
      ["commissionInvoice", "Komisyon Faturası (KDV)", choice("month_end", [["month_end", "Ay Sonunda Toplu Taslak"], ["each_valor", "Her Valörde Taslak"], ["manual", "Elle"]]), ""],
    ],
  },
  {
    id: "fxAdvanced", level: "advanced", label: "Döviz",
    items: [
      ["revaluationRate", "Değerleme Kuru", fixed("tcmb_buy", "TCMB Döviz Alış"), "VUK 280."],
      ["costMethod", "Maliyet Yöntemi", fixed("weighted_average", "Ağırlıklı Ortalama"), ""],
      ["reverseNextDay", "Değerlemeyi Ertesi Gün Ters Kaydet", bool(false), ""],
      ["partyRate", "Döviz Hesabında Cari Kuru", choice("transaction", [["transaction", "İşlem Kuru; Yoksa TCMB Döviz Alış"], ["manual", "Elle"]]), ""],
      ["exchangeTaxPermille", "Kambiyo Vergisi Oranı (Binde)", { type: "number", default: null, min: 0, max: 100, nullable: true }, "Boş bırakılırsa dekonttan girilir."],
    ],
  },
  {
    id: "interest", level: "advanced", label: "Faiz",
    items: [["stoppage", "Mevduat Stopajı", fixed("last", "Son Kullanılan Oran Önerilir"), "Oran sık değiştiği için programa sabit oran yazılmaz."]],
  },
  {
    id: "holidayAdvanced", level: "advanced", label: "Tatil",
    items: [
      ["weekend", "Hafta Sonu", choice("sat_sun", [["sat_sun", "Cumartesi ve Pazar"], ["sun", "Yalnız Pazar"]]), ""],
      ["halfDay", "Yarım Gün (Arife)", choice("business", [["business", "İş Günü Sayılır"], ["holiday", "İş Günü Sayılmaz"]]), ""],
      ["shift", "Tatile Düşen Valör", choice("following", [["following", "Sonraki İş Günü"], ["preceding", "Önceki İş Günü"], ["modified_following", "Ay İçinde Kalacak Biçimde"]]), ""],
    ],
  },
  {
    id: "statement", level: "advanced", label: "Ekstre",
    items: [
      ["toleranceDays", "Tarih Toleransı (Gün)", int(3, 0, 10), ""],
      ["autoConfirmStrong", "Güçlü Önerileri Otomatik Onayla", bool(false), "Onaysız eşleşme yapılmaz; açılırsa yalnız Güçlü öneriler onaylanır."],
      ["continuityWarning", "Bakiye Sürekliliği Uyarısı", bool(true), ""],
      ["keywords", "Anahtar Sözcükler", { type: "keywords", default: KEYWORDS }, "Bankanın açıklamalarındaki sözcükler: POS, Nakit, Virman, Ücret ve Faiz."],
    ],
  },
  {
    id: "movement", level: "advanced", label: "Hareket",
    items: [["channel", "Kanal Alanı", choice("optional", [["optional", "İsteğe Bağlı"], ["required", "Zorunlu"]]), ""]],
  },
  {
    id: "gl", level: "advanced", label: "Hesap Eşlemeleri",
    items: [
      // GG2 (düşük): faturalı (KDV'li) masraf da eşlemedeki hesaba yazılır; fatura gider kalemi yalnız 770 ya da 653 olabildiği için iki eşleme bu
      // iki hesapla sınırlı (önceden 659 seçilince BSMV'li masraf 659'a, KDV'li masraf 770'e gidiyordu: aynı masraf türü iki hesapta).
      ["fee", "Banka Masrafları", { type: "gl", default: "770", allowed: FEE_GL }, "BSMV'li ve faturalı (KDV'li) masraf aynı hesaba yazılır: 770 ya da 653."],
      ["commission", "POS ve Ödeme Kuruluşu Komisyonları", { type: "gl", default: "653", allowed: FEE_GL }, "BSMV'li ve faturalı (KDV'li) komisyon aynı hesaba yazılır: 770 ya da 653."],
      ["interestIncome", "Faiz Geliri", { type: "gl", default: "642", allowed: INCOME_GL }, ""],
      ["interestExpense", "Faiz Gideri", { type: "gl", default: "780", allowed: EXPENSE_GL }, ""],
      ["fxGain", "Kambiyo Kârı", { type: "gl", default: "646", allowed: ROLE_GL.fx_gain }, ".01 değerleme, .02 gerçekleşen."],
      ["fxLoss", "Kambiyo Zararı", { type: "gl", default: "656", allowed: ROLE_GL.fx_loss }, ".01 değerleme, .02 gerçekleşen."],
      ["otherIncome", "Diğer Gelir", { type: "gl", default: "649", allowed: INCOME_GL }, ""],
      ["otherExpense", "Diğer Gider", { type: "gl", default: "659", allowed: EXPENSE_GL }, ""],
      // Sabit eşlemeler: görünür, değiştirilemez (§3.11).
      ["bank", "Bankalar", fixed("102", "102"), ""],
      ["pos", "Kredi Kartı Tahsilatları (POS)", fixed("108", "108"), ""],
      ["loan", "Banka Kredileri", fixed("300", "300"), ""],
      ["card", "Kurumsal Kredi Kartları", fixed("309", "309"), ""],
      ["opening", "Açılış ve Devir Bakiyeleri", fixed("500", "500"), ""],
    ],
  },
  {
    id: "other", level: "advanced", label: "Diğer",
    items: [
      ["eventPrefix", "İşlem No Öneki", { type: "text", default: "BNK", pattern: EVENT_PREFIX_RULE, hint: "2–6 büyük harf (A–Z)" }, "Yeni İşlem No'lar bu önekle başlar; sıra numarası sürer."],
      ["manualVoucher", "Elle Banka Fişi", bool(false), "Açılırsa Hareketler'de serbest banka fişi (beyaz listedeki hesaplarla) girilir."],
      ["adapters", "Bağdaştırıcılar", fixed(false, "Kapalı"), "Açık bankacılık ve sanal POS bağlantısı kapalıdır."],
    ],
  },
]);

// Bu sürümde olmayan özelliklerin ayarları (yarım özellik görünmez; plan §12.1): POS 2.2.0'da, Ekstre ve Mutabakat 2.3.0'da, döviz ve değerleme
// (Kambiyo Kârı/Zararı eşlemeleri dahil) 2.1.x'te gelir. GG2: Kanal Alanı (ekstre ve POS kanalıyla gelir) ve Elle Banka Fişi (formu yok)
// etkisiz görünüyordu; onlar da gizli. Arayüz "available: false" bölümü ve kalemi göstermez.
// 2.1.0 temel sürüm (ertelenenler denetimi, kullanıcı kararı "ertelenenler sürümde GÖRÜNMEZ"): gizli ayar API'den de DEĞİŞTİRİLEMEZ (400
// bank-setting-later) ve okunurken kod varsayılanıdır — önceden PUT ile Elle Banka Fişi açılıp gizli fiş (Kambiyo Kârı/Zararı satırları dahil)
// API'den yazılabiliyordu. Yalnız testler (config.bankLater) değiştirir. Bağdaştırıcılar ("Açık bankacılık ve sanal POS bağlantısı kapalıdır")
// olmayan özelliği anlattığı için o da gizli.
const NOT_YET = Object.freeze({
  sections: new Set(["pos", "posAdvanced", "statement", "fx", "fxAdvanced", "movement"]),
  items: new Set(["account.defaultPosId", "holidayAdvanced.shift", "gl.fxGain", "gl.fxLoss", "other.manualVoucher", "other.adapters"]),
});
const hiddenSetting = (sectionId, key) => NOT_YET.sections.has(sectionId) || NOT_YET.items.has(`${sectionId}.${key}`);
// Gizli ayarın geldiği özellik (ret iletisinde).
const LATER_FEATURE = { pos: "POS", posAdvanced: "POS", statement: "Ekstre ve Mutabakat", fx: "Döviz", fxAdvanced: "Döviz", movement: "Ekstre ve POS kanalı", "account.defaultPosId": "POS", "holidayAdvanced.shift": "POS valörü", "gl.fxGain": "Döviz", "gl.fxLoss": "Döviz", "other.manualVoucher": "Elle Banka Fişi formu", "other.adapters": "Bağdaştırıcılar" };

const bad = (message, extra = {}) => new HttpError(400, message, { code: "bank-setting", ...extra });
const clone = value => JSON.parse(JSON.stringify(value));

// Sabit kalemler (type "fixed": 102/108/300/309/500 eşlemesi, Türkiye takvimi, değerleme kuru …) ekranda görünür, değerlerde yer almaz:
// değiştirilemez (gönderilirse 400).
const editable = section => section.items.filter(([, , item]) => item.type !== "fixed");
/** Bütün varsayılanlar: { bölüm: { anahtar: değer } } (değiştirilebilir kalemler). */
export function defaults() {
  return Object.fromEntries(SPEC.map(section => [section.id, Object.fromEntries(editable(section).map(([key, , item]) => [key, clone(item.default)]))]));
}

const itemOf = (sectionId, key) => SPEC.find(section => section.id === sectionId)?.items.find(([name]) => name === key) || null;

/** Tek değerin doğrulaması; hata 400 (bank-setting / bank-gl-forbidden / bank-account-invalid). accounts: hesap kimliği denetleyicisi. */
function validate(sectionId, key, value, { accountOk = () => true, posOk = () => true } = {}) {
  const found = itemOf(sectionId, key);
  if (!found) throw bad(`Tanınmayan ayar: ${sectionId}.${key}.`, { field: `${sectionId}.${key}` });
  const [, label, item] = found;
  const field = `${sectionId}.${key}`;
  switch (item.type) {
    case "fixed":
      if (sectionId === "gl") throw new HttpError(400, `${label} (${item.value}) eşlemesi değiştirilemez.`, { code: "bank-gl-forbidden", field });
      if (JSON.stringify(value) !== JSON.stringify(item.value)) throw bad(`${label} değiştirilemez.`, { field });
      return item.value;
    case "select":
      if (!item.options.some(([option]) => option === value)) throw bad(`${label}: tanınmayan seçenek (${String(value).slice(0, 30)}).`, { field });
      return value;
    case "bool":
      if (typeof value !== "boolean") throw bad(`${label} açık ya da kapalı olmalı.`, { field });
      return value;
    case "number": {
      // Boş değer yalnız boş bırakılabilen alanda (Kambiyo Vergisi Oranı) "yok"tur; başka alanda Number("") = 0 sessizce kaydedilmez.
      if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
        if (item.nullable) return null;
        throw bad(`${label} boş bırakılamaz (${item.min}–${item.max}).`, { field });
      }
      const number = Number(value);
      if (!Number.isInteger(number) || number < item.min || number > item.max) throw bad(`${label} ${item.min}–${item.max} arasında tamsayı olmalı.`, { field });
      return number;
    }
    case "gl": {
      const code = String(value ?? "").trim();
      if (!item.allowed.includes(code)) throw new HttpError(400, `${label} için ${code || "boş"} hesabı seçilemez. İzinli: ${item.allowed.join(", ")}.`, { code: "bank-gl-forbidden", field });
      return code;
    }
    case "text": {
      const text = String(value ?? "").trim();
      if (!item.pattern.test(text)) throw bad(`${label}: ${item.hint}.`, { field });
      return text;
    }
    case "account": {
      const id = String(value ?? "").trim();
      if (id && !accountOk(id)) throw new HttpError(400, `${label}: etkin bir TL vadesiz, ticari ya da diğer banka hesabı seçin.`, { code: "bank-account-invalid", field });
      return id;
    }
    case "pos": {
      const id = String(value ?? "").trim();
      if (id && !posOk(id)) throw new HttpError(400, `${label}: etkin bir POS seçin.`, { code: "bank-account-invalid", field });
      return id;
    }
    case "feeTypes": {
      if (!Array.isArray(value) || !value.length || value.length > 40) throw bad(`${label}: en az bir, en çok 40 masraf türü.`, { field });
      const seen = new Set();
      return value.map(entry => {
        const name = String(entry?.name ?? "").trim();
        const gl = String(entry?.gl ?? "").trim();
        const keyOf = String(entry?.key ?? "").trim() || name.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
        if (!name || name.length > 60) throw bad(`${label}: tür adı 1–60 karakter olmalı.`, { field });
        if (!["770", "653"].includes(gl)) throw new HttpError(400, `${label}: ${name} türünün hesabı 770 ya da 653 olmalı (${gl || "boş"}).`, { code: "bank-gl-forbidden", field });
        if (!keyOf || seen.has(keyOf)) throw bad(`${label}: tür adları tekil olmalı (${name}).`, { field });
        seen.add(keyOf);
        return { key: keyOf, name, gl };
      });
    }
    case "keywords": {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw bad(`${label} tanınmadı.`, { field });
      const out = {};
      for (const group of Object.keys(KEYWORDS)) {
        const list = value[group] ?? KEYWORDS[group];
        if (!Array.isArray(list) || list.length > 50 || list.some(word => typeof word !== "string" || !word.trim() || word.length > 40)) throw bad(`${label}: ${group} listesi tanınmadı.`, { field });
        out[group] = list.map(word => word.trim());
      }
      for (const group of Object.keys(value)) if (!Object.hasOwn(KEYWORDS, group)) throw bad(`${label}: tanınmayan grup (${group}).`, { field });
      return out;
    }
    default:
      throw bad(`Tanınmayan ayar türü: ${field}.`, { field });
  }
}

/**
 * Banka ayarları servisi. accountOk(id): varsayılan tahsilat hesabı olabilir mi (etkin, TL, havale seçicisinde); posOk(id): etkin POS.
 */
export function createBankSettings({ store, accountOk = () => false, posOk = () => false, laterOk = () => false }) {
  const raw = () => {
    try {
      const value = JSON.parse(store.setting(SETTINGS_KEY, "") || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };
  /** Okunan değerler: varsayılanlar + kayıtlı (geçerli olanlar); kimlikler doğrulanır (geçersiz → boş). */
  function read() {
    const stored = raw();
    const out = defaults();
    for (const section of SPEC) {
      for (const [key] of editable(section)) {
        const value = stored?.[section.id]?.[key];
        if (value === undefined) continue;
        // Gizli (bu sürümde olmayan özelliğin) ayarı etkisizdir: kayıtlı değer okunmaz, varsayılan kalır (testlerde config.bankLater).
        if (hiddenSetting(section.id, key) && !laterOk()) continue;
        try {
          out[section.id][key] = validate(section.id, key, value, { accountOk, posOk });
        } catch {
          // Kayıtlı değer artık geçersiz (silinmiş hesap, eski sürümün değeri): varsayılan.
        }
      }
    }
    return out;
  }
  /** Kısmi güncelleme: { bölüm: { anahtar: değer } }. Hepsi doğrulanır; biri hatalıysa hiçbiri yazılmaz. Dönüş: { previous, next }. */
  function update(values, userId = null) {
    if (!values || typeof values !== "object" || Array.isArray(values)) throw bad("Ayar değerleri tanınmadı.");
    const previous = read();
    const next = clone(previous);
    for (const [sectionId, items] of Object.entries(values)) {
      if (!SPEC.some(section => section.id === sectionId)) throw bad(`Tanınmayan ayar bölümü: ${sectionId}.`, { field: sectionId });
      if (!items || typeof items !== "object" || Array.isArray(items)) throw bad(`${sectionId} bölümü tanınmadı.`, { field: sectionId });
      for (const [key, value] of Object.entries(items)) {
        const checked = validate(sectionId, key, value, { accountOk, posOk });
        // Gizli ayar değiştirilemez (aynı değeri yeniden göndermek serbest): ekranda yok, özelliği bu sürümde yok.
        if (hiddenSetting(sectionId, key) && !laterOk() && JSON.stringify(checked) !== JSON.stringify(previous[sectionId][key])) {
          const label = itemOf(sectionId, key)?.[1] || key;
          const feature = LATER_FEATURE[`${sectionId}.${key}`] || LATER_FEATURE[sectionId] || "ilgili özellik";
          throw new HttpError(400, `${label} bu sürümde kullanılmıyor (${feature} sonraki sürümde gelir); değiştirilemez.`, { code: "bank-setting-later", field: `${sectionId}.${key}` });
        }
        next[sectionId][key] = checked;
      }
    }
    store.setSetting(SETTINGS_KEY, JSON.stringify(next), userId);
    return { previous, next };
  }
  /** Varsayılanlara Dön: { section } bir bölüm, { level } Temel ya da Gelişmiş, hiçbiri: tümü. */
  function reset({ section = "", level = "" } = {}, userId = null) {
    const previous = read();
    const base = defaults();
    let targets;
    if (section) {
      if (!SPEC.some(item => item.id === section)) throw bad(`Tanınmayan ayar bölümü: ${section}.`, { field: "section" });
      targets = [section];
    } else if (level) {
      if (!["basic", "advanced"].includes(level)) throw bad("Düzey Temel (basic) ya da Gelişmiş (advanced) olmalı.", { field: "level" });
      targets = SPEC.filter(item => item.level === level).map(item => item.id);
    } else targets = SPEC.map(item => item.id);
    const next = clone(previous);
    for (const id of targets) next[id] = base[id];
    store.setSetting(SETTINGS_KEY, JSON.stringify(next), userId);
    return { previous, next, sections: targets };
  }
  /**
   * Arayüz için bölümler (ad, düzey, kalemler: anahtar, ad, tür, seçenekler, sınır, yardım). available: bu sürümde görünür mü (POS ve Ekstre
   * ayarları o özellikler gelince; NOT_YET).
   */
  function sections() {
    return SPEC.map(section => ({
      id: section.id,
      level: section.level,
      label: section.label,
      available: !NOT_YET.sections.has(section.id),
      items: section.items.map(([key, label, item, help]) => ({
        key,
        label,
        type: item.type,
        available: !NOT_YET.sections.has(section.id) && !NOT_YET.items.has(`${section.id}.${key}`),
        ...(item.options ? { options: item.options } : {}),
        ...(item.type === "fixed" ? { value: item.value, text: item.text } : {}),
        ...(item.min !== undefined ? { min: item.min, max: item.max } : {}),
        ...(item.nullable ? { nullable: true } : {}),
        ...(item.allowed ? { allowed: item.allowed } : {}),
        ...(item.hint ? { hint: item.hint } : {}),
        help: help || "",
      })),
    }));
  }
  return { read, update, reset, sections, defaults };
}
