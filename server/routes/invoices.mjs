// Fatura (v2.0.15): satış, alış, satıştan iade, alıştan iade ve serbest meslek makbuzu. Belge birincil kayıttır; stok
// hareketi, cari borç/alacağı, peşin tahsilat/ödeme (Kasa), çek/senet (portföy, verilen evrak, ciro) ve vadeli satışın
// taksit kartı faturaya bağlı olarak AYNI işlem bloğunda yazılır (store.tx: BEGIN IMMEDIATE … COMMIT; bir adım
// başarısız olursa ROLLBACK, hiçbir satır kalmaz). En dış COMMIT'ten önce mutabakat kapısı (lib/integrity.mjs) fatura
// ↔ kalemler ↔ cari ↔ stok ↔ çek/senet ↔ taksit ↔ Ana Defter eşitliğini denetler; sapma varsa işlem geri alınır.
//
// Yaşam döngüsü
//   taslak (draft)  : deftere dokunmaz, numarası yoktur; düzeltilir, silinir, proforma olarak yazdırılır.
//   kesildi (issued): numara verilir (seri + yıl + 9 hane; VUK sıra-tarih uyumu), defterlere yazılır. Kesilmiş fatura
//                     düzeltilmez (yasal belge): iptal edilir ya da iade faturası kesilir.
//   iptal (cancelled): numara korunur; bütün defter etkileri birebir geri alınır. Tahsilatı olan taksit kartı, tahsil
//                     ya da ciro edilmiş çek, satılmış mal (stok eksiye düşer), kilitli dönem ve iadesi olan fatura
//                     iptali durdurur (iade faturası kesilir).
import { randomInt, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseQty } from "../lib/accounts.mjs";
import { ADAPTERS, DEFAULT_ADAPTER, adapterInfo, connect, integratorPortalUrl, integratorUrl, isPortalUrl, testOnlyUrl } from "../lib/einvoice/adapters.mjs";
import { EDM_URLS } from "../lib/einvoice/edm.mjs";
import { readUbl } from "../lib/einvoice/ubl-read.mjs";
import { UNIT_CODE_KEYS, buildUbl, ublFileName } from "../lib/einvoice/ubl-tr.mjs";
import { viewXslt } from "../lib/einvoice/gorunum.mjs";
import { karekodOf } from "../lib/einvoice/karekod.mjs";
import { NOT_SENT_CODES, TRANSMITTED, attemptWindow, cancelDeadlineText, cancelLateText, cancelWindow, transmissionOf, windowLabel } from "../lib/einvoice/iptal-suresi.mjs";
import { HttpError, limited, ok, parseJson, readJson, sendBuffer, text } from "../lib/http.mjs";
import { bodyHash, createIdempotency } from "../lib/idempotency.mjs";
import { invoicePdf } from "../lib/invoice-pdf.mjs";
import { jpegInfo } from "../lib/pdf-write.mjs";
import { CURRENCIES, EXEMPTIONS, EXPENSES, INVOICE_KINDS, InvoiceInputError, SCENARIOS, STOPPAGE_DEFAULT, VAT_RATES, WITHHOLDING, amountInWords, cents, computeInvoice, exclusiveParts, lineAccount, priceForNetFee, toTry, typeCode } from "../lib/invoice-math.mjs";
import { CLOSER_MODES, PAY_STATES, settleInvoices } from "../lib/invoice-settle.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { METHODS, METHODS_IN, METHODS_OUT, methodLabel, methodInput } from "../lib/pay-method.mjs";
import { bankForm, negativeConfirmed } from "../lib/bank/module-ref.mjs";
import { posMetaOf } from "../lib/bank/pos.mjs";
import { canUser } from "../lib/permissions.mjs";
import { createSecretBox } from "../lib/secret-box.mjs";
import { addMonths, dayText, isoDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { ANONYMOUS_TCKN, classifyTaxId, isValidIban, isValidMersis, normalizeIban, partyIssues, partyProblems, splitPersonName } from "../lib/tax-id.mjs";
import { UNITS, unitLabel } from "../lib/units.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";
import { createZip } from "../lib/zip.mjs";
import { systemClock } from "../lib/clock.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = value => {
  if (!DATE.test(String(value || ""))) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const SETTINGS_KEY = "invoice.settings";
// 2.4.4 (E5; kullanıcı sorunu 19.10.2026 "Kullanıcı Bulunamadı (11010)"): Web Servis Kullanıcı Adı alanına servis adresi yazılmış mı. İstemcide aynı
// kural (hof-invoices.js integratorUsernameIsUrl) kaydetmeden önce uyarır; sunucu da reddeder (istemci atlanabilir).
export const integratorUsernameIsUrl = value => /https?:\/\/|\.svc/i.test(String(value || ""));
export const INTEGRATOR_USERNAME_URL_MESSAGE = "Web Servis Kullanıcı Adı alanına servis adresi yazılmış. Bu alana EDM'nin verdiği web servis kullanıcı adını yazın (adres değil); servis adresi gerekiyorsa Servis Adresi alanına yazılır, boş bırakılırsa seçilen ortamın adresi kullanılır.";
export const PROFILES = Object.freeze({
  KAGIT: "Kâğıt Fatura",
  EARSIVFATURA: "e-Arşiv Fatura",
  TEMELFATURA: "e-Fatura (Temel)",
  TICARIFATURA: "e-Fatura (Ticari)",
  ESMM: "e-SMM",
});
// waiting: "Kes, Sonra Gönder" — etkileri işlenmiş, e-Belge numarası gönderimde verilir (GİB serisinde boşluk kalmaz).
// withdrawn: Gönderilecekler'den silindi — etkiler yerinde, Müşteri Fişi numarasıyla kalır; istenirse yine gönderilir.
const E_STATES = Object.freeze({ waiting: "Gönderilecek", withdrawn: "Gönderilmeyecek", none: "Gönderilmedi", exported: "XML Hazır", draft: "Portalda Taslak", processing: "İşleniyor", sent: "Gönderildi", accepted: "Kabul Edildi", rejected: "Reddedildi", error: "Hata", cancelled: "Entegratörde İptal" });
// Gönderilebilir (ilk kez ya da hatadan sonra yeniden) ve sorgulanabilir e-Belge durumları.
// draft (İz 7.3): EDM portalına taslak yüklendi (LoadInvoice) — henüz gönderilmedi; belge düzenlenebilir, taslak yenilenir ya da gönderilir.
const E_SENDABLE = new Set(["", "none", "exported", "error", "waiting", "withdrawn", "draft"]);
const E_TRACKED = new Set(["draft", "processing", "sent", "accepted", "rejected", "error", "cancelled"]);
// Sonucu belirsiz gönderim (2.4.0 bitiş turu, yargıç Y3 / eleştirmen S1): entegratöre istek gitti ama yanıt gelmedi (bağlantı koptu) — durum
// "none" kalır, e_adapter yazılır. Belge EDM'ye ulaşmış olabilir: durum sorulmadan silinmez, düzenlenmez, iptal edilmez, yeniden gönderilmez.
const uncertainSend = row => (row.eStatus || "none") === "none" && Boolean(row.eAdapter);
const UNCERTAIN_TEXT = "Son e-Belge gönderiminin sonucu belirsiz (entegratöre bağlantı koptu; belge ulaşmış olabilir). Önce Durum Sorgula: belge entegratörde yoksa yeniden gönderilir ya da değiştirilir.";
// EDM: hiç gönderilmemiş belgenin durumu sorulunca "Fatura bulunamadı" (hata kodu 11017) — gerçek test ortamında görüldü (16.10.2026,
// docs/kanit/2026-10-16/edm-bilinmeyen).
// 2.4.4 madde 22: "belge entegratörde YOK" kodları servis (profil) başınadır, TEK yerde. e-SMM servisi (ESmmEDM.svc) de aynı kodu verir — gerçek EDM
// test ortamında DOĞRULANDI (madde 24, 22.10.2026, docs/kanit/2026-10-22/244-edm/gercek-2/f-bulunamadi.json): olmayan makbuz için GetSMMStatus ve CancelSMM
// "SMM bulunamadı (EDM hata kodu 11017)". Belirsiz e-SMM gönderimi bu yüzden e-Arşiv gibi Durum Sorgula'dan temizlenir, aynı numarayla yeniden gönderilir,
// 8 gün geçmişse yalnız programda iptal EDM'de yoksa serbesttir.
const MISSING_CODES = Object.freeze({ default: new Set(["11017"]), ESMM: new Set(["11017"]) });
const remoteMissing = (error, profile = "") => (MISSING_CODES[profile] || MISSING_CODES.default).has(String(error?.extra?.integratorCode || error?.integratorCode || ""));
const E_VIEWABLE = new Set(["processing", "sent", "accepted", "rejected", "cancelled"]);
// Resmî görüntü önbelleğe yalnız son hâlinde alınır (işlenirken entegratörün görüntüsü değişebilir).
const E_FINAL_VIEW = new Set(["sent", "accepted", "rejected", "cancelled"]);
// Test ortamı serileri (kullanıcı kararı 16.10.2026: "entegre et ama müşteriler şimdilik yalnız test linkiyle denesin"): entegratörün TEST
// ortamına giden e-Belge firmanın kendi serisinden değil bu serilerden numara alır — canlıya geçince firmanın serisi 1'den başlar, test
// belgesinin numarası değişmez, belgenin test olduğu serisinden anlaşılır (ekranda, PDF'te ve görünümde "Test" işareti). Firma bu adları
// kendi serisi olarak seçemez; test serisinden numara almış belge canlı ortamda gönderilmez.
export const TEST_SERIES = Object.freeze({ efatura: "TEF", earsiv: "TEA", esmm: "TES" });
const TEST_SERIES_SET = new Set(Object.values(TEST_SERIES));
// Seri alanlarının ekrandaki adları (Fatura Ayarları → Seriler; iletilerde hangi alanın değişeceği söylenir).
const SERIES_LABELS = { paper: "Belge Serisi (Fiş ve Kâğıt Belge)", smm: "Serbest Meslek Makbuzu Serisi", internal: "İç İade Serisi", efatura: "e-Fatura Serisi", earsiv: "e-Arşiv Serisi", esmm: "e-SMM Serisi" };
const SIDE_KINDS = { sale: ["sale", "smm", "sale_return"], purchase: ["purchase", "purchase_return"] };
const MAX_LINES = 500;
const DEFAULTS = Object.freeze({
  // stamp: kaşe / imza görseli (JPEG, logo kurallarıyla; İz 9, kullanıcı isteği 16.10.2026) — e-Belge görünümünde GİB logosunun altında, PDF'te
  // "Düzenleyen" kutusunda; varsayılan yalnız e-Arşivde (eView.stampEfatura ile e-Faturada da). Belgeye kopyalanmaz.
  // logo: belgenin sol üstüne basılan JPEG (data:image/jpeg;base64,…; en çok LOGO_MAX_BYTES). Belgeye kopyalanmaz (seller_json'a girmez); PDF her zaman güncel logoyu basar.
  seller: { name: "", partyKind: "company", firstName: "", familyName: "", taxNo: "", taxOffice: "", mersisNo: "", tradeRegistry: "", address: "", district: "", city: "", postalCode: "", country: "Türkiye", phone: "", email: "", website: "", banks: [], logo: "", stamp: "" },
  // e-Dönüşüm (firmanın GİB'e kayıtlı olduğu sistemler). e-Arşiv, e-Fatura kaydı olmadan kullanılamaz.
  efatura: false,
  earsiv: false,
  esmm: false,
  // paper: programın kestiği bilgi fişi / kâğıt belge serisi (FIS2026000000001); e-Belge serileri bağlantı açılınca.
  series: { paper: "FIS", earsiv: "EAR", efatura: "EFT", smm: "SMM", esmm: "ESM", internal: "IAD" },
  start: {},
  // signatureArea: PDF'in altında "Teslim Alan" ve "Düzenleyen (Kaşe / İmza)" kutuları (v2.0.15, QA A9).
  // itemTracking: fatura kaleminde Seri No / Lot No alanları (İz 7.4, isteğe bağlı; e-Belgede cac:ItemInstance, PDF'te kalem adının altında).
  defaults: { vatRate: 20, pricesIncludeVat: false, stoppageRate: STOPPAGE_DEFAULT, efaturaProfile: "TEMELFATURA", dueDays: 0, footer: "", saleScenario: "", purchaseScenario: "", signatureArea: true, itemTracking: false },
  // Entegratör bağlantısı (kullanıcı kararı: şimdilik yalnız EDM Bilişim). Parola veritabanında şifreli tutulur
  // (lib/secret-box.mjs); ekrana ve günlüğe hiç çıkmaz.
  // mailboxAlias: firmanın kendi posta kutusu (PK, gelen fatura); senderAlias: gönderici birim (GB). earchiveEmail: e-Arşiv faturası alıcının
  // e-postasına entegratörce gönderilir (ELEKTRONIK; kapalıysa KAGIT). autoCheckUser: cari kartında VKN/TCKN yazılınca mükellefiyet sorgulanır.
  // lastTest: son Bağlantıyı Test Et sonucu (Durum satırı). Kullanıcı kararı 16.10.2026 (Entegratör Ayarları kartı).
  // eView: e-Belge görünüm tasarımı (16.10.2026; lib/einvoice/gorunum.mjs). enabled kapalıysa entegratörün varsayılan görünümü; logo, banka
  // hesapları ve alt not Fatura Ayarları'ndaki değerlerdir (tek kaynak), burada yalnız gösterilip gösterilmeyeceği seçilir.
  eView: { enabled: true, logo: true, banks: true, footer: true, stamp: true, stampEfatura: false },
  // eOptions (Wolvox karşılaştırmasının kalan maddeleri; kullanıcı kararı 16.10.2026 "isteğe bağlı olarak olsun"):
  // balanceNote: cari bakiyesi e-Belgenin notuna; paymentMeans: ödeme şekli kodu (Nakit 10, Havale / EFT 42, Kart 48, Çek 20, Senet 60);
  // draftUpload: Gönder yerine EDM portalına taslak yükle (LoadInvoice; gönderim portaldan ya da programdan).
  // 2.4.3 (kullanıcı kararı 17.10.2026): paymentMeans varsayılan AÇIK — kapalıyken nakit ödenen belgede görünüm "Ödeme Şekli: Havale / EFT"
  // diyordu (IBAN varsa 42). eOptionsSet: kullanıcının kendisi kaydettiği seçenekler; 2.4.0–2.4.2'de ayar kaydedilirken seçenek dokunulmadan
  // false yazılmış olabilir, işaretsiz false varsayılana döner (kullanıcının bilerek kapattığı korunur).
  eOptions: { balanceNote: false, paymentMeans: true, draftUpload: false },
  eOptionsSet: {},
  integrator: { id: "edm", env: "test", baseUrl: "", username: "", passwordSealed: "", senderAlias: "", mailboxAlias: "", autoSend: false, earchiveEmail: true, autoCheckUser: false, lastTest: null },
});
const clone = value => JSON.parse(JSON.stringify(value));
const LOGO_MAX_BYTES = 150 * 1024;
const LOGO_MAX_SIDE = 1200;
const fail400 = (message, field = "", extra = {}) => {
  throw new HttpError(400, message, { code: "invoice-invalid", field, ...extra });
};
const pad2 = value => String(value).padStart(2, "0");
const moneyText = (value, currency = "TRY") => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency === "TRY" ? "TL" : currency}`;
const c2 = value => roundMoney((Number(value) || 0) / 100);
const toCents = value => Math.round((Number(value) || 0) * 100);

export function registerInvoiceRoutes(router, { store, bank, auth, audit, events, config = {}, period = null, cash = null, trash = null, accounts = () => null, stock = () => null, plans = () => null, cheques = () => null, bankModule = () => null, now: clock = systemClock }) {
  // e-Belge bağlantısı kapalıyken (varsayılan; program sahibi açana kadar) her belge kâğıt/bilgi fişidir: e-Fatura,
  // e-Arşiv, XML ve entegratör uçları çalışmaz, ekranda görünmez.
  const edocEnabled = config.edocEnabled === true;
  const edocLive = edocEnabled && config.edocLive === true;
  // İptal öncesi "işleniyor" durumunun yeniden sorulma aralıkları (ms; H7). Testler kısa verir (config.edocStatusPollMs).
  const STATUS_POLL_MS = Array.isArray(config.edocStatusPollMs) ? config.edocStatusPollMs.map(Number).filter(value => value >= 0) : [1000, 2000];
  // Dar kontrol 2.4.3 (Y1): Tümünü Gönder'in istek başına süre bütçesi (config.mjs edocSendBudgetMs; üretimde 10 sn).
  const SEND_BUDGET_MS = Number(config.edocSendBudgetMs) > 0 ? Number(config.edocSendBudgetMs) : 10_000;
  // e-SMM gönderimi (config.mjs esmmEnabled; 2.4.4'te üretim girişi açar, testler vermedikçe kapalı): kapalıyken eski "esmm: true" kaydı da etkisizdir
  // (makbuz kâğıt).
  const esmmEnabled = edocEnabled && config.esmmEnabled === true;
  // 2.4.4 madde 22 (E1): e-Belge GÖNDERİM KAPILARININ TEK kuralı — bu tür ve bu profil entegratöre e-Belge olarak gider mi? Gönderilecekler (liste ve
  // SQL), kartın Gönder / Durum Sorgula / Resmî Görüntü / Portala Taslak düğmeleri, "Kes, Sonra Gönder", kayıtta O1 sırası, kayıtta gönderim denetimi,
  // toplu XML ve /meta bununla karar verir. INVOICE_KINDS.smm.send false KALIR: e-SMM yalnız e-SMM açıkken (config.esmmEnabled) ve ESMM profilli
  // makbuzda gönderilir; bayrak kapalıyken 2.4.0'dan kalan numaralı ESMM makbuzları ve kâğıt SMM (KAGIT) hiçbir gönderim yoluna girmez (eski davranış).
  const sendKind = (kind, profile) => Boolean(INVOICE_KINDS[kind]?.send) || (kind === "smm" && profile === "ESMM" && esmmEnabled);
  // Belgenin e-Belge profili: Müşteri Fişi Olarak Bırakılmış (withdrawn) belge KAGIT görünür, e-Belge olarak e_profile'ıyla gönderilir.
  const eProfileOf = row => (row?.eStatus === "withdrawn" ? row.eProfile : row?.profile) || "";
  const sendsDoc = row => sendKind(row.kind, eProfileOf(row));
  // 2.4.2 (kullanıcı denemesi 17.10.2026): EDM'nin test hesabı ORTAKTIR; test serisi 1'den başlarsa numara başka firmanınkiyle çakışır (EDM 11048).
  // Test serisi her yıl ilk kullanımda firmaya özgü rastgele büyük numaradan başlar; başlangıç ayara yazılır (önizleme ile kayıt aynı numarayı görür).
  const testSeriesStart = typeof config.testSeriesStart === "function" ? config.testSeriesStart : () => randomInt(100_000_001, 900_000_000);
  // Fatura kapaması (lib/invoice-settle.mjs). config.legacyClosing yalnız testlerde: K1 öncesi kural (2.0.26 ile birebir karşılaştırmalar);
  // o kuralda iadenin geri ödenen kısmı da faturadan düşülür ve kartın hedefine geri eklenir (ownTarget, açılış onarımı, retarget).
  const settle = config.legacyClosing || settleInvoices;
  const legacyClosing = Boolean(config.legacyClosing);
  const requireEdoc = () => {
    if (!edocEnabled) throw new HttpError(404, "e-Belge (e-Fatura / e-Arşiv) bağlantısı bu kurulumda kapalı. Belgeler bilgi amaçlı müşteri fişi olarak kaydedilir.", { code: "edoc-disabled" });
  };
  let box = null;
  const secrets = () => (box ||= createSecretBox(config.dataDir || "."));
  // İş saati (v2.1.0): context.now (config.now); fatura saati de buradan.
  const now = () => clock().toISOString();
  const today = () => (period ? period.today() : isoDay(clock()));
  // 2.4.4 madde 23 (kullanıcı kararı 21.10.2026): e-Arşiv ve e-SMM iptal süresi — kural lib/einvoice/iptal-suresi.mjs'te TEK yerde. İletim anı belgenin
  // İşlem Geçmişi'ndeki gönderim girişimlerinden okunur (2.4.3 verisi de aynı kayıtları taşır); yazım sırasıyla (rowid; sahte saat geri alınsa da).
  const E_ATTEMPTS = ["invoice.e.sent", "invoice.e.draft", "invoice.e.send-failed"];
  const transmittedAtOf = id =>
    transmissionOf(store.all(`SELECT type, payload_json AS payload, created_at AS at FROM audit_events WHERE entity_id = ? AND type IN (${E_ATTEMPTS.map(() => "?").join(", ")}) ORDER BY rowid`, id, ...E_ATTEMPTS).map(row => ({ ...row, payload: parseJson(row.payload, {}) })));
  // eStatus: iptal sırasında entegratörden okunan yeni durum (ör. "Hata" sanılan belge EDM'de oluşturulmuş çıktıysa süre ona da uygulanır).
  const cancelWindowOf = (row, eStatus = row.eStatus) =>
    edocEnabled && row.status === "issued" && windowLabel(row.profile) && TRANSMITTED.has(eStatus)
      ? cancelWindow({ profile: row.profile, eStatus, issueDate: row.issueDate, transmittedAt: transmittedAtOf(row.id), today: today() })
      : null;
  const nowTime = () => {
    const d = clock();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const AUDITOR = { id: "invoices", role: "admin", permissions: [] };
  const publish = (user, detail) => events?.publish("workspace.changed", { actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  // İstek kimliği (v2.1.0): şirketin veri tabanında (request_keys), belge yazımıyla aynı işlemde; yeniden başlatmada da hatırlanır.
  const requests = createIdempotency({ store, now: clock });

  // ---------- Ayarlar ----------
  function settings() {
    const raw = parseJson(store.setting(SETTINGS_KEY, "{}"), {});
    const out = clone(DEFAULTS);
    for (const key of Object.keys(out)) {
      if (raw?.[key] === undefined) continue;
      out[key] = out[key] && typeof out[key] === "object" && !Array.isArray(out[key]) ? { ...out[key], ...(raw[key] || {}) } : raw[key];
    }
    if (!ADAPTERS[out.integrator.id]) out.integrator.id = DEFAULT_ADAPTER;
    if (!out.seller.name) out.seller.name = store.setting("office.name", "") || "";
    if (!Array.isArray(out.seller.banks)) out.seller.banks = [];
    if (out.eOptionsSet?.paymentMeans !== true) out.eOptions.paymentMeans = DEFAULTS.eOptions.paymentMeans;
    return out;
  }
  // Logo: yalnız JPEG, data URL, en çok 150 KB ve 1200 piksel (PDF'e olduğu gibi gömülür; dev dosya her belgeyi şişirir).
  // Logo ve kaşe / imza görseli aynı kurallarla (JPEG, en çok 150 KB ve 1200 piksel).
  function logoInput(value, field = "seller.logo", label = "Logo") {
    if (value === null || value === "" || value === false) return "";
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(value || ""));
    if (!match) fail400(`${label} JPEG olmalı (ekrandan seçilen görsel programca JPEG'e çevrilir).`, field);
    const raw = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
    if (raw.length > LOGO_MAX_BYTES) fail400(`${label} en çok ${Math.round(LOGO_MAX_BYTES / 1024)} KB olmalı (şu an ${Math.round(raw.length / 1024)} KB).`, field);
    const info = jpegInfo(raw);
    if (!info) fail400(`${label} dosyası okunamadı; geçerli bir JPEG seçin.`, field);
    if (info.width > LOGO_MAX_SIDE || info.height > LOGO_MAX_SIDE) fail400(`${label} en çok ${LOGO_MAX_SIDE} piksel olmalı (${info.width}×${info.height}).`, field);
    return `data:image/jpeg;base64,${raw.toString("base64")}`;
  }
  function settingsInput(body, previous) {
    const next = clone(previous);
    const seller = body.seller && typeof body.seller === "object" ? body.seller : {};
    const pick = (key, max, label) => limited(seller[key] ?? previous.seller[key] ?? "", max, label);
    next.seller = {
      name: pick("name", 200, "Unvan"),
      partyKind: ["company", "person"].includes(text(seller.partyKind)) ? text(seller.partyKind) : previous.seller.partyKind || "company",
      firstName: pick("firstName", 80, "Adı"),
      familyName: pick("familyName", 80, "Soyadı"),
      taxNo: String(seller.taxNo ?? previous.seller.taxNo ?? "").replace(/\s+/g, ""),
      taxOffice: pick("taxOffice", 120, "Vergi Dairesi"),
      mersisNo: String(seller.mersisNo ?? previous.seller.mersisNo ?? "").replace(/\s+/g, ""),
      tradeRegistry: pick("tradeRegistry", 40, "Ticaret Sicil No"),
      address: pick("address", 500, "Adres"),
      district: pick("district", 80, "İlçe"),
      city: pick("city", 80, "İl"),
      postalCode: pick("postalCode", 10, "Posta Kodu"),
      country: pick("country", 80, "Ülke") || "Türkiye",
      phone: pick("phone", 60, "Telefon"),
      email: pick("email", 160, "E-Posta"),
      website: pick("website", 200, "Web Sitesi"),
      // 2.3.0 (İz 3.4, E2.16): Banka modülünde hesap açıldıktan sonra eski liste düzenlenmez (ekran salt okunur gösterir; gövdedekiler yok sayılır).
      banks: (Array.isArray(seller.banks) && !bankModuleActive() ? seller.banks : previous.seller.banks || []).slice(0, 4).map(bank => ({ name: limited(bank?.name, 80, "Banka"), iban: normalizeIban(bank?.iban) })).filter(bank => bank.iban || bank.name),
      logo: seller.logo === undefined ? previous.seller.logo || "" : logoInput(seller.logo),
      stamp: seller.stamp === undefined ? previous.seller.stamp || "" : logoInput(seller.stamp, "seller.stamp", "Kaşe / İmza görseli"),
    };
    if (next.seller.taxNo) {
      const id = classifyTaxId(next.seller.taxNo);
      if (!id.ok) fail400(id.kind === "vkn" ? "Firmanın VKN'si geçersiz: denetim hanesi tutmuyor." : id.kind === "tckn" ? "Firmanın TC kimlik numarası geçersiz." : "VKN 10, TCKN 11 haneli olmalı.", "seller.taxNo");
      next.seller.partyKind = id.kind === "vkn" ? "company" : "person";
    }
    if (next.seller.mersisNo && !isValidMersis(next.seller.mersisNo)) fail400("MERSİS numarası 16 haneli olmalı.", "seller.mersisNo");
    for (const bank of next.seller.banks) if (bank.iban && !isValidIban(bank.iban)) fail400(`IBAN geçersiz (${bank.iban}).`, "seller.banks");
    if (!edocEnabled && (body.efatura === true || body.earsiv === true || body.esmm === true || (body.integrator && typeof body.integrator === "object"))) requireEdoc();
    if (body.efatura !== undefined) next.efatura = body.efatura === true;
    if (body.earsiv !== undefined) next.earsiv = body.earsiv === true;
    if (next.earsiv && !next.efatura) fail400("e-Arşiv için önce e-Fatura mükellefi olmak gerekir (GİB): e-Fatura kutusunu da işaretleyin.", "earsiv");
    if (body.esmm === true && !esmmEnabled) fail400("e-SMM gönderimi bu sürümde yok; serbest meslek makbuzu kâğıt olarak düzenlenir.", "esmm", { code: "esmm-unavailable" });
    if (body.esmm !== undefined) next.esmm = body.esmm === true;
    if (body.series && typeof body.series === "object") {
      for (const key of Object.keys(DEFAULTS.series)) {
        if (body.series[key] === undefined) continue;
        const value = String(body.series[key] || "").trim().toLocaleUpperCase("tr-TR");
        if (!/^[A-Z0-9]{3}$/.test(value)) fail400("Seri 3 karakter olmalı: büyük harf (Türkçe harfsiz) ya da rakam (ör. FTR, EAR).", `series.${key}`);
        next.series[key] = value;
      }
      const used = Object.values(next.series);
      if (new Set(used).size !== used.length) fail400("Her belge türünün serisi farklı olmalı (aynı seri iki türde kullanılamaz).", "series");
    }
    // Test serisi adları (TEF, TEA, TES) firmanın serisi olamaz — her kayıtta, birleşik ayarda denetlenir (bitiş turu E3: 2.3.0'da serbestti; eski
    // kurulumda kâğıt serisi TEA kalmışsa test e-Arşiviyle aynı numara sırasını paylaşıyordu). İleti hangi alanın değişeceğini söyler.
    const reserved = Object.entries(next.series).find(([, value]) => TEST_SERIES_SET.has(value));
    if (reserved) fail400(`${reserved[1]} serisi entegratörün test ortamına ayrılmıştır (TEF, TEA, TES). Fatura Ayarları → Seriler'de ${SERIES_LABELS[reserved[0]] || reserved[0]} serisini değiştirin.`, `series.${reserved[0]}`, { code: "series-reserved" });
    if (body.start && typeof body.start === "object") {
      // Kısmi kayıt öbür serilerin başlangıcını silmez (2.4.2; test serisinin rastgele başlangıcı da burada durur).
      next.start = { ...(next.start || {}) };
      for (const [key, value] of Object.entries(body.start).slice(0, 40)) {
        if (!/^[A-Z0-9]{3}\d{4}$/.test(key)) continue;
        const seq = Math.trunc(Number(value));
        if (!Number.isFinite(seq) || seq < 1 || seq > 999_999_999) fail400("Sonraki numara 1 ile 999.999.999 arasında olmalı.", "start");
        // Test serisi (2.4.2): yalnız ileri alınır — kesilmiş son test numarasından küçük değer etkisizdi ve sessiz kalıyordu.
        // Yalnız DEĞİŞEN değer denetlenir: Fatura Ayarları ekranı her kayıtta tam haritayı (rastgele test başlangıcı dahil) geri gönderir (kontrol turu K1).
        if (TEST_SERIES_SET.has(key.slice(0, 3)) && seq !== Number(previous.start?.[key])) {
          const last = store.get("SELECT COALESCE(MAX(seq), 0) AS n FROM invoices WHERE series = ? AND year = ? AND seq > 0", key.slice(0, 3), Number(key.slice(3))).n;
          if (seq <= last) fail400(`${key.slice(0, 3)} test serisinde son numara ${last}; sıradaki numara en az ${last + 1} olabilir (yalnız ileri alınır).`, "start", { code: "start-backward" });
        }
        next.start[key] = seq;
      }
    }
    if (body.eView && typeof body.eView === "object") {
      for (const key of Object.keys(DEFAULTS.eView)) if (body.eView[key] !== undefined) next.eView[key] = body.eView[key] === true;
    }
    if (body.eOptions && typeof body.eOptions === "object") {
      for (const key of Object.keys(DEFAULTS.eOptions)) {
        if (body.eOptions[key] === undefined) continue;
        next.eOptions[key] = body.eOptions[key] === true;
        next.eOptionsSet = { ...(next.eOptionsSet || {}), [key]: true };
      }
    }
    if (body.defaults && typeof body.defaults === "object") {
      const d = body.defaults;
      if (d.vatRate !== undefined) {
        if (!VAT_RATES.includes(Number(d.vatRate))) fail400("Varsayılan KDV oranı %0, %1, %10 ya da %20 olmalı.", "defaults.vatRate");
        next.defaults.vatRate = Number(d.vatRate);
      }
      if (d.pricesIncludeVat !== undefined) next.defaults.pricesIncludeVat = d.pricesIncludeVat === true;
      if (d.stoppageRate !== undefined) {
        const rate = Number(d.stoppageRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 40) fail400("Stopaj oranı 0 ile 40 arasında olmalı.", "defaults.stoppageRate");
        next.defaults.stoppageRate = rate;
      }
      if (d.efaturaProfile !== undefined) next.defaults.efaturaProfile = d.efaturaProfile === "TICARIFATURA" ? "TICARIFATURA" : "TEMELFATURA";
      if (d.dueDays !== undefined) {
        const days = Math.trunc(Number(d.dueDays) || 0);
        if (days < 0 || days > 3650) fail400("Vade günü 0 ile 3650 arasında olmalı.", "defaults.dueDays");
        next.defaults.dueDays = days;
      }
      if (d.footer !== undefined) next.defaults.footer = limited(d.footer, 500, "Fatura Alt Notu");
      if (d.signatureArea !== undefined) next.defaults.signatureArea = d.signatureArea === true;
      if (d.itemTracking !== undefined) next.defaults.itemTracking = d.itemTracking === true;
      if (d.saleScenario !== undefined) next.defaults.saleScenario = SCENARIOS[d.saleScenario] && ["sale", "smm"].includes(SCENARIOS[d.saleScenario].kind) ? d.saleScenario : "";
      if (d.purchaseScenario !== undefined) next.defaults.purchaseScenario = SCENARIOS[d.purchaseScenario]?.kind === "purchase" ? d.purchaseScenario : "";
    }
    if (body.integrator && typeof body.integrator === "object") {
      const input = body.integrator;
      const prev = previous.integrator;
      const id = text(input.id ?? prev.id) || DEFAULT_ADAPTER;
      if (!ADAPTERS[id]) fail400("Entegratör tanınmadı.", "integrator.id");
      const env = input.env === undefined ? prev.env : input.env === "live" ? "live" : "test";
      // Canlı ortam "entegre et" kararına dek seçilemez (yanlışlıkla canlıya belge gitmesin); kayıtlı eski "live" de test sayılmaz → reddedilir.
      if (env === "live" && !edocLive) fail400("Canlı ortam, test ortamındaki kabulden sonra açılır. Şimdilik Test Ortamı'nı kullanın.", "integrator.env", { code: "integrator-live-locked" });
      const baseUrl = input.baseUrl === undefined ? prev.baseUrl : String(input.baseUrl || "").trim().replace(/\?.*$/, "");
      if (baseUrl && !/^https:\/\/[^\s/]+\/\S+$/i.test(baseUrl) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/\S*$/i.test(baseUrl)) fail400("Servis adresi https:// ile başlayan tam adres olmalı; boş bırakılırsa seçilen ortamın adresi kullanılır.", "integrator.baseUrl");
      // Canlı kilidi Servis Adresi'nden de delinmez (bitiş turu Y1/E1): kilit açılana dek yalnız test ortamının adresi (ya da boş).
      if (!edocLive && !testOnlyUrl(baseUrl)) fail400("Canlı ortam açılana kadar Servis Adresi yalnız entegratörün test adresi olabilir; alanı boş bırakın (Test Ortamı'nın adresi kullanılır).", "integrator.baseUrl", { code: "integrator-live-locked" });
      // 2.4.1 (G3): canlı açıkken de ortam ↔ adres uyumlu olmalı — Test Ortamı + canlı adres test serisi belgeyi canlıya, Canlı Ortam + test adresi yasal numaralı belgeyi teste gönderirdi.
      const mismatch = envUrlMismatch(env, baseUrl);
      if (mismatch) fail400(mismatch, "integrator.baseUrl", { code: "integrator-env-url" });
      const username = input.username === undefined ? prev.username : limited(input.username, 120, "Kullanıcı Adı");
      // Yalnız ad DEĞİŞTİYSE reddedilir: eski sürümde adres olarak kaydedilmiş ad değişmeden gelirse ilgisiz ayarların (seri, görünüm, firma) kaydı
      // kilitlenmez; o kurulum bağlantıda 409 integrator-username-url ile aynı açıklamayı görür.
      if (username !== prev.username && integratorUsernameIsUrl(username)) fail400(INTEGRATOR_USERNAME_URL_MESSAGE, "integrator.username", { code: "integrator-username-url" });
      let passwordSealed = prev.passwordSealed;
      if (input.clearPassword === true) passwordSealed = "";
      else if (typeof input.password === "string" && input.password !== "") {
        if (input.password.length > 200) fail400("Parola en çok 200 karakter olabilir.", "integrator.password");
        passwordSealed = secrets().seal(input.password);
      }
      const senderAlias = input.senderAlias === undefined ? prev.senderAlias : String(input.senderAlias || "").trim();
      if (senderAlias && !/^urn:mail:[^\s@]+@[^\s@]+$/i.test(senderAlias)) fail400("Gönderici birim etiketi urn:mail:…@… biçiminde olmalı (ör. urn:mail:defaultgb@edmbilisim.com.tr); bilmiyorsanız boş bırakın.", "integrator.senderAlias");
      const mailboxAlias = input.mailboxAlias === undefined ? prev.mailboxAlias || "" : String(input.mailboxAlias || "").trim();
      if (mailboxAlias && !/^urn:mail:[^\s@]+@[^\s@]+$/i.test(mailboxAlias)) fail400("Posta kutusu etiketi urn:mail:…@… biçiminde olmalı (ör. urn:mail:defaultpk@firmaniz.com.tr); bilmiyorsanız boş bırakın.", "integrator.mailboxAlias");
      const flag = (name, fallback) => (input[name] === undefined ? (prev[name] === undefined ? fallback : prev[name] === true) : input[name] === true);
      const autoSend = flag("autoSend", false);
      const changed = id !== prev.id || env !== prev.env || baseUrl !== prev.baseUrl || username !== prev.username || passwordSealed !== prev.passwordSealed;
      next.integrator = { id, env, baseUrl, username, passwordSealed, senderAlias, mailboxAlias, autoSend, earchiveEmail: flag("earchiveEmail", true), autoCheckUser: flag("autoCheckUser", false), lastTest: changed ? null : prev.lastTest || null };
    }
    return next;
  }
  // MM1: asıl faturanın numarasından 16 karakterlik e-Belge referansı önerisi — seri harfleri + sıfırla doldurulmuş sıra ("A 004512" → "A000000000004512").
  // Harf ve rakam dışı karakterler atılır; 16'dan uzunsa öneri yok (kullanıcı yazar).
  const returnRefSuggestion = number => {
    const alnum = String(number || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!alnum || alnum.length > 16) return "";
    const prefix = /^[A-Z]*/.exec(alnum)[0];
    return `${prefix}${alnum.slice(prefix.length).padStart(16 - prefix.length, "0")}`;
  };
  const RETURN_REF = /^[0-9A-Z]{16}$/;
  const returnRefText = originalNumber => {
    const original = String(originalNumber || "").trim();
    const suggested = returnRefSuggestion(original);
    return `İade e-Belgesi asıl faturayı 16 karakterlik bir numarayla gösterir (GİB). Asıl faturanın numarası (${original || "yok"}) 16 karakter değil: İade Edilen Belge No (e-Belge Referansı) alanına 16 karakterlik değeri yazın${suggested ? ` (önerilen: ${suggested})` : ""}. Asıl fatura kaydı değişmez; gerçek numarası belgenin açıklamasında yazar.`;
  };
  // GİB UBL-TR şematronu (IADEInvioceCheck): iade e-Belgesi asıl faturayı 16 haneli numarasıyla gösterir; kâğıt numaralı asıl faturaya
  // e-Belge iadesi entegratörde reddedilir. Kayıtta ve gönderimde önceden söylenir.
  // Dar kontrol 2 (MM2): iade e-Belgesinin profili TICARIFATURA olamaz (GİB Common şematronu: IADE tipinde profil TEMELFATURA / EARSIVFATURA …).
  // Dar kontrol 2 (MM1, mali müşavir): asıl faturanın numarası 16 karakter değilse (kâğıt alış faturası, ör. "A 004512") iade e-Belgesi "İade Edilen
  // Belge No (e-Belge Referansı)" ile kesilir (reference); asıl kayıt değiştirilmez (VUK 219/227) — önceki ileti "asıl faturanın numarasını düzeltin"
  // diyordu, asıl kaydın numarası düzenlenemediği için iade hiçbir yoldan kesilemiyordu. GİB şematronu (IADEInvioceCheck) yalnız UZUNLUĞU denetler.
  const returnProblems = (profile, kind, reference, originalNumber = reference) => [
    ...(profile && profile !== "KAGIT" && INVOICE_KINDS[kind]?.return && String(reference || "").trim().length !== 16
      ? [returnRefText(originalNumber)]
      : []),
    ...(profile === "TICARIFATURA" && INVOICE_KINDS[kind]?.return ? ["İade faturası e-Faturada yalnız Temel Fatura senaryosuyla gönderilir (GİB: iade belgesinde Ticari Fatura senaryosu kullanılamaz). Belgeyi Düzenle ile açıp kaydedin: Temel Fatura olarak kaydedilir (numara değişmez), sonra gönderin."] : []),
  ];
  // Kontrol turu K3: tevkifatlı kalem ile istisna kodlu (%0, 351 dışı) kalem aynı e-Belgede geçerli tip bulamaz (GİB şematronu: tevkifat → TEVKIFAT,
  // istisna kodu → ISTISNA; ikisi birden reddedilir). Kayıtta ve gönderimde önceden söylenir.
  const mixProblems = (profile, lines = []) =>
    profile && profile !== "KAGIT" && lines.some(line => line.withholdingCode) && lines.some(line => Number(line.vatRate) === 0 && line.exemptionCode && line.exemptionCode !== "351")
      ? ["Tevkifatlı kalem ile KDV istisnalı kalem (351 dışı) aynı e-Belgede olamaz (GİB: tevkifatlı belgenin tipi TEVKIFAT, istisnalınınki ISTISNA). Bu kalemleri ayrı faturalarda kesin."]
      : [];
  const sellerProblems = (profile, s = settings()) => partyProblems(sellerParty(s), { profile: profile === "KAGIT" ? "KAGIT" : profile === "EARSIVFATURA" ? "EARSIV" : profile === "ESMM" ? "EARSIV" : "EFATURA", role: "seller" });
  // GG2 (orta; plan §8.9): Banka hesap kartındaki "IBAN Faturada Gösterilsin" işaretli hesaplar faturanın satıcı banka listesine girer (önce Banka
  // hesapları, sonra Fatura Ayarları'ndaki liste; aynı IBAN bir kez; en çok 4). Önceden kutunun hiçbir etkisi yoktu.
  // 2.3.0 (İz 3.4; plan §8.9 "Fatura Ayarları → Banka Hesapları", E2.16, #31): Banka modülünde İLK HESAP AÇILANA KADAR Fatura Ayarları'ndaki eski
  // liste (seller.banks) belgeye basılır ve düzenlenebilir; ilk hesap açıldıktan sonra liste YALNIZ "IBAN Faturada Gösterilsin" işaretli hesaplardan
  // dolar, eski liste yalnız sihirbazın "Hesap Olarak Aç" önerisi olur (göç v23 eski listedeki IBAN'ı taşıyan hesapları bir kez işaretler; mevcut iş
  // kesilmez). Önceden (2.1.0 GG2) iki liste birleştiriliyordu: hesabı pasife alınan / işareti kaldırılan IBAN eski listeden basılmaya devam ediyordu.
  const bankModuleActive = () => {
    try {
      return Boolean(store.get("SELECT 1 AS found FROM bank_accounts WHERE deleted_at IS NULL LIMIT 1"));
    } catch {
      return false;
    }
  };
  const invoiceBankRows = () => {
    try {
      return store.all("SELECT id, bank_name AS bankName, name, iban FROM bank_accounts WHERE show_on_invoice = 1 AND iban <> '' AND status = 'active' AND deleted_at IS NULL ORDER BY position, created_at");
    } catch {
      return [];
    }
  };
  /** Fatura Ayarları ekranı için durum: modül etkin mi, basılacak hesaplar, eski listeden henüz hesap olarak açılmamış IBAN'lar (öneri). */
  const bankAccountsState = s => {
    const active = bankModuleActive();
    const accounts = active ? invoiceBankRows() : [];
    let known = new Set();
    try {
      known = new Set(store.all("SELECT iban FROM bank_accounts WHERE deleted_at IS NULL AND iban <> ''").map(row => normalizeIban(row.iban)));
    } catch {
      known = new Set();
    }
    const legacy = (Array.isArray(s?.seller?.banks) ? s.seller.banks : []).map(bank => ({ name: String(bank?.name || ""), iban: normalizeIban(bank?.iban || "") })).filter(bank => bank.iban);
    return { active, accounts, suggestions: active ? legacy.filter(bank => !known.has(bank.iban)) : [] };
  };
  // 2.3.0 (İz 3.2): peşininde etkin POS satışı olan belgeler (İptal / Sil penceresinin "POS İşlemi" seçimi). POS tabloları yoksa boş.
  const posCashSet = ids => {
    if (!ids.length) return new Set();
    try {
      return new Set(store.all("SELECT DISTINCT e.source_id AS id FROM account_entries e JOIN pos_sales s ON s.event_id = e.event_id WHERE e.source = 'invoice' AND s.kind = 'sale' AND s.status = 'active' AND s.src <> 'cancel' AND e.source_id IN (SELECT value FROM json_each(?))", JSON.stringify(ids)).map(row => row.id));
    } catch {
      return new Set();
    }
  };
  const invoiceBanks = list => {
    const rows = bankModuleActive() ? invoiceBankRows().map(row => ({ name: row.bankName, iban: row.iban })) : list || [];
    const seen = new Set();
    const out = [];
    for (const bank of rows) {
      const key = normalizeIban(bank?.iban || "");
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push({ name: String(bank?.name || ""), iban: key });
    }
    return out.slice(0, 4);
  };
  const sellerParty = s => {
    const seller = { ...s.seller, banks: invoiceBanks(s.seller?.banks) };
    delete seller.logo;
    delete seller.stamp;
    if (seller.partyKind === "person" && (!seller.firstName || !seller.familyName)) Object.assign(seller, { ...splitPersonName(seller.name), ...(seller.firstName ? { firstName: seller.firstName } : {}), ...(seller.familyName ? { familyName: seller.familyName } : {}) });
    return seller;
  };

  // Ekrana giden ayarlar: parola (şifreli hâli de) hiç gönderilmez; yalnız girilmiş olup olmadığı.
  // e-Belge XML'i (gönderilen, indirilen ve toplu dışa aktarılan aynı): görünüm şablonu açıksa belgeye gömülür (lib/einvoice/gorunum.mjs).
  // Şablon yalnız satıcısı biz olan belgeye gömülür: alış faturası ve satıştan iade XML'inde satıcı karşı taraftır — logomuz ve IBAN'ımız basılmaz.
  const ownsDocument = doc => doc.kind !== "purchase" && doc.kind !== "sale_return";
  // Karekod (İz 9; GİB Karekod Standardı, zorunlu): şablonsuz belge önce üretilir, karekod o XML'in kendi alanlarından okunur (karekodda ne varsa
  // belgede de o), sonra şablon karekodla gömülür. Şablon gömülmesi XML'in karekoda giren alanlarını değiştirmez.
  const ublFor = (doc, { variant = "tr" } = {}, s = settings()) => {
    const options = { variant, earchiveEmail: s.integrator.earchiveEmail !== false, notes: s.eOptions.balanceNote === true ? [balanceNoteOf(doc)] : [], paymentMeans: s.eOptions.paymentMeans === true };
    // e-SMM (2.4.4): programın görünüm şablonu fatura içindir (e-SMM alanları yok) → gömülmez; makbuzu EDM'nin kendi e-SMM görünümü çizer.
    if (!(variant === "tr" && s.eView.enabled !== false && ownsDocument(doc) && doc.profile !== "ESMM")) return buildUbl(doc, options);
    const qr = karekodOf(buildUbl(doc, options))?.dataUrl || "";
    return buildUbl(doc, { ...options, xslt: viewXslt({ logo: s.seller.logo, banks: doc.seller?.banks || [], footer: s.defaults.footer, view: s.eView, test: doc.eTest === true, qr, stamp: s.seller.stamp }) });
  };
  // Cari bakiyesi notu (İz 7.1): cari listesinin bakiyesiyle aynı hesap (taksit kartları dahil; lib tek kaynak). Belgenin üretildiği an itibarıyla,
  // bu fatura dahil; alıcının gözünden "borç" (bize borçlu) ya da "alacak". Yalnız satıcısı biz olan ve cariye bağlı belgede.
  const balanceNoteOf = doc => {
    if (!doc.accountId || !ownsDocument(doc) || !accounts()?.list) return "";
    const item = accounts().list(AUDITOR, { ids: [doc.accountId], status: "all" }).accounts.find(row => row.id === doc.accountId);
    if (!item) return "";
    const side = item.balance > 0.004 ? " borç" : item.balance < -0.004 ? " alacak" : "";
    return `Cari hesap bakiyeniz (${dayText(today())} itibarıyla, bu fatura dahil): ${moneyText(Math.abs(item.balance))}${side}`;
  };
  // Entegratör kartında bağlantının hangi yoldan çıktığı (vekil sunucu; ayar Yönetim → Sistem → Ağ Bağlantısı'nda, kimlik bilgisi yok).
  const networkSummary = () => (edocEnabled && config.describeNetwork ? config.describeNetwork().effective : null);
  // Entegratör bağlantı ayrıntısı (kullanıcı adı, servis adresi, son test iletisi, vekil) yalnız Fatura Ayarları yetkisine (bitiş turu E10); öbürleri
  // yalnız ortamı ve bağlantının kurulu olup olmadığını görür.
  const publicSettings = (raw, full = true) => {
    const s = esmmEnabled || !raw.esmm ? raw : { ...raw, esmm: false };
    const { passwordSealed, ...rest } = s.integrator;
    if (!full) return { ...s, integrator: { id: rest.id, env: rest.env, label: ADAPTERS[s.integrator.id]?.label || "", configured: Boolean(rest.username && passwordSealed), autoSend: rest.autoSend === true, autoCheckUser: rest.autoCheckUser === true, liveAllowed: edocLive } };
    return { ...s, integrator: { ...rest, hasPassword: Boolean(passwordSealed), url: integratorUrl(s.integrator), label: ADAPTERS[s.integrator.id]?.label || "", liveAllowed: edocLive, network: networkSummary() } };
  };
  const integratorSummary = s => ({ id: s.integrator.id, label: ADAPTERS[s.integrator.id]?.label || "", env: s.integrator.env, configured: Boolean(s.integrator.username && s.integrator.passwordSealed), autoSend: s.integrator.autoSend === true, autoCheckUser: s.integrator.autoCheckUser === true });
  // e-Fatura Portalı düğmesi (2.4.4 E7): adres sunucunun sabit listesinden, Çalışma Ortamı'na göre (Test → test portalı, Canlı → canlı portal).
  // Yetki: Fatura Kesme ve İptal (invoices.manage) — portalda yapılan işler (belge kesme/iptal, gelen faturaya yanıt) bu yetkinin programdaki
  // karşılığı; Faturaları Görme yetkisi portal işlerini kapsamaz. Bağlantı (kullanıcı adı + parola) kayıtlı değilse portala girilecek hesap da
  // yok. Engel varsa adres GÖNDERİLMEZ, yalnız nedeni gider (düğme pasif, nedeni görünür). Kullanıcı adı/parola hiçbir zaman gitmez.
  const portalState = (s, user) => {
    const url = integratorPortalUrl(s.integrator);
    if (!url || !isPortalUrl(url)) return { url: "", block: "Bu entegratörün portal adresi programda tanımlı değil." };
    if (!canUser(user, "invoices.manage")) return { url: "", block: "e-Fatura Portalı, Fatura Kesme ve İptal yetkisi ister; yöneticinize başvurun." };
    if (!(s.integrator.username && s.integrator.passwordSealed)) return { url: "", block: "Önce Entegratör Ayarları'nda web servis kullanıcı adını ve parolasını kaydedin." };
    return { url, env: s.integrator.env, block: "" };
  };
  // Dar kontrol B2/B3: adres yazım varyantlarıyla (sonda "/", büyük harf, :443) karşılaştırılır — istemci (edm.mjs) sondaki "/"yi zaten atar.
  const sameUrl = (a, b) => {
    const norm = url => { try { const u = new URL(String(url).trim()); return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`; } catch { return String(url).trim(); } };
    return norm(a) === norm(b);
  };
  function envUrlMismatch(env, baseUrl) {
    const value = String(baseUrl || "").trim();
    if (!value || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/\S*)?$/i.test(value)) return "";
    const isTest = testOnlyUrl(value) || sameUrl(value, EDM_URLS.test);
    if (env !== "live" && !isTest) return "Test Ortamı seçiliyken Servis Adresi yalnız entegratörün test adresi olabilir. Canlıya geçmek için Çalışma Ortamı'nda Canlı Ortam'ı seçin; Servis Adresi boş kalabilir.";
    if (env === "live" && isTest) return "Canlı Ortam seçiliyken Servis Adresi test adresi olamaz; alanı boş bırakın (canlı adres kullanılır).";
    return "";
  }
  function integrator(s = settings()) {
    requireEdoc();
    const cfg = s.integrator;
    // Canlıya çıkış kilidi (16.10.2026): ayar ekranı canlıyı reddeder; veri tabanında eskiden kalmış "live" kaydı da bağlantı katmanında
    // reddedilir — ağa hiç çıkılmaz (test/einvoice-edm.test.mjs "canlı kilit").
    if (cfg.env === "live" && !edocLive) throw new HttpError(409, "Entegratör ayarında Canlı Ortam seçili ama canlı ortam henüz açılmadı (test ortamındaki kabulden sonra açılır). Entegratör Ayarları'nda Test Ortamı'nı seçin.", { code: "integrator-live-locked" });
    // Bitiş turu Y1/E1: veri tabanında (eski kayıt, yedekten geri yükleme) test dışı bir Servis Adresi kalmışsa da ağa çıkılmaz.
    if (!edocLive && !testOnlyUrl(cfg.baseUrl)) throw new HttpError(409, "Entegratör ayarındaki Servis Adresi test ortamının adresi değil; canlı ortam henüz açılmadı. Entegratör Ayarları'nda Servis Adresi'ni boşaltın.", { code: "integrator-live-locked" });
    const mismatch = envUrlMismatch(cfg.env, cfg.baseUrl);
    if (mismatch) throw new HttpError(409, mismatch, { code: "integrator-env-url" });
    if (integratorUsernameIsUrl(cfg.username)) throw new HttpError(409, `Entegratör Ayarları'nda ${INTEGRATOR_USERNAME_URL_MESSAGE}`, { code: "integrator-username-url" });
    if (!cfg.username || !cfg.passwordSealed) throw new HttpError(409, `${ADAPTERS[cfg.id]?.label || "Entegratör"} web servis kullanıcı adı ve parolası girilmemiş. Fatura → Entegratör Ayarları'ndan girin.`, { code: "integrator-not-configured" });
    const password = secrets().open(cfg.passwordSealed);
    if (!password) throw new HttpError(409, "Kayıtlı entegratör parolası bu bilgisayarda açılamadı (veriler başka bilgisayardan taşınmış olabilir). Fatura → Entegratör Ayarları'nda parolayı yeniden girin.", { code: "integrator-password" });
    return connect({ integrator: { ...cfg, password }, seller: sellerParty(s), fetchImpl: config.fetchImpl });
  }

  // ---------- Okuma ----------
  const INVOICE_SQL = `SELECT i.id, i.kind, i.scenario, i.status, i.series, i.year, i.seq, i.number, i.ettn, i.issue_date AS issueDate, i.issue_time AS issueTime, i.account_id AS accountId,
      i.party_json AS partyJson, i.seller_json AS sellerJson, i.profile, i.type_code AS typeCode, i.currency, i.rate, i.prices_include_vat AS pricesIncludeVat, i.discount_rate AS discountRate,
      i.stoppage_rate AS stoppageRate, i.base_total AS baseTotal, i.discount_total AS discountTotal, i.net_total AS netTotal, i.goods_net AS goodsNet, i.service_net AS serviceNet, i.vat_total AS vatTotal,
      i.withheld_total AS withheldTotal, i.stoppage_total AS stoppageTotal, i.gross_total AS grossTotal, i.payable_total AS payableTotal, i.try_net AS tryNet, i.try_vat AS tryVat,
      i.try_withheld AS tryWithheld, i.try_stoppage AS tryStoppage, i.try_payable AS tryPayable, i.gl_json AS glJson, i.payment_json AS paymentJson, i.due_date AS dueDate, i.plan_id AS planId,
      i.original_id AS originalId, i.order_no AS orderNo, i.order_date AS orderDate, i.despatch_no AS despatchNo, i.despatch_date AS despatchDate, i.paper_no AS paperNo, i.return_ref AS returnRef, i.note, i.e_status AS eStatus, i.e_profile AS eProfile, i.e_adapter AS eAdapter,
      i.e_message AS eMessage, i.e_at AS eAt, i.created_by AS createdBy, i.created_at AS createdAt, i.updated_at AS updatedAt, i.issued_at AS issuedAt, i.cancelled_at AS cancelledAt, i.cancel_reason AS cancelReason,
      COALESCE(a.name, '') AS accountName, COALESCE(a.ref_no, '') AS accountRef, COALESCE(a.phone, '') AS accountPhone, COALESCE(a.tax_no, '') AS accountTaxNo, COALESCE(a.type, '') AS accountType,
      COALESCE(u.display_name, '') AS actorName, COALESCE(o.number, '') AS originalNumber, COALESCE(o.issue_date, '') AS originalDate
    FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id LEFT JOIN users u ON u.id = i.created_by LEFT JOIN invoices o ON o.id = i.original_id`;
  const LINE_SQL = `SELECT l.id, l.invoice_id AS invoiceId, l.seq, l.item_id AS itemId, l.goods, l.code, l.name, l.description, l.unit, l.qty, l.unit_price AS unitPrice, l.discount_rate AS discountRate,
      l.base, l.discount, l.net, l.vat_rate AS vatRate, l.vat, l.withholding_code AS withholdingCode, l.withholding_num AS withholdingNum, l.withholding_den AS withholdingDen, l.withheld,
      CASE l.exemption_code WHEN '308' THEN '304' ELSE l.exemption_code END AS exemptionCode, l.gross, l.payable, l.gl_account AS glAccount, l.expense_code AS expenseCode, l.unit_cost AS unitCost, l.origin_line_id AS originLineId, l.move_id AS moveId,
      l.serial_no AS serialNo, l.lot_no AS lotNo
    FROM invoice_lines l`;
  const invoiceRow = id => {
    const row = store.get(`${INVOICE_SQL} WHERE i.id = ?`, limited(id, 120, "Fatura"));
    if (!row) throw new HttpError(404, "Fatura bulunamadı.");
    return row;
  };
  const linesOf = invoiceId => store.all(`${LINE_SQL} WHERE l.invoice_id = ? ORDER BY l.seq`, invoiceId);
  const label = row => INVOICE_KINDS[row.kind]?.label || "Fatura";
  const displayNo = row => row.number || (row.status === "draft" ? "Taslak" : row.eStatus === "waiting" ? "Gönderilecek" : "");
  // İade edilebilir miktar: asıl kalem − kesilmiş iadelerdeki miktar (iptal edilen iade sayılmaz).
  const returnedQty = (lineIds, exceptInvoiceId = "") => {
    const out = new Map();
    if (!lineIds.length) return out;
    for (const row of store.all(
      `SELECT r.origin_line_id AS originId, SUM(r.qty) AS qty FROM invoice_lines r JOIN invoices i ON i.id = r.invoice_id AND i.status = 'issued' AND i.id <> ?
       WHERE r.origin_line_id IN (${lineIds.map(() => "?").join(", ")}) GROUP BY r.origin_line_id`,
      exceptInvoiceId, ...lineIds,
    )) out.set(row.originId, Number(row.qty) || 0);
    return out;
  };

  // Ödeme durumu (kapama): carinin defteri + faturaya bağlı ödemeler (lib/invoice-settle.mjs).
  // v2.0.17: mahsup fişinin karşı belgesinin adı ("Mahsup · ALS2026…" / "Mahsup · Alacak Yaz 15.09.2026").
  function offsetLabel(offset) {
    if (offset.counterType === "invoice") {
      const counter = store.get("SELECT number, kind FROM invoices WHERE id = ?", offset.counterId);
      return counter ? `Mahsup · ${INVOICE_KINDS[counter.kind]?.short || "Fatura"} ${counter.number}` : "Mahsup · fatura";
    }
    const entry = store.get("SELECT kind, date, note FROM account_entries WHERE id = ?", offset.counterId);
    return entry ? `Mahsup · ${entry.kind === "credit" ? "Alacak Yaz" : "Borç Yaz"} ${dayText(entry.date)}${entry.note ? ` (${entry.note})` : ""}` : "Mahsup · cari satırı";
  }
  // v2.0.22 (Excel denetimi, yük ölçümü): liste ve sol menü rozeti her cari için ayrı ayrı cari ayrıntısı + 5–7 sorgu
  // çalıştırıyordu (2.948 faturada 1,1 sn; her açık pencere başkasının her kaydında yeniden istiyordu). Çok carili istekte
  // aynı girdiler birkaç toplu sorguyla okunur, kapama kuralı (settleInvoices) AYNIDIR; sonuç veri tabanına yazma olana
  // ya da gün dönene kadar saklanır (total_changes(): bu bağlantının her INSERT/UPDATE/DELETE'inde artar; data_version: başka
  // bir bağlantının kesinleşen yazmasında değişir — veri dosyasını paylaşan şirket, 2.0.21 "Ayır" öncesi). Tek carili
  // istek (fatura kartı) aşağıdaki cari başına yoldan hesaplanır; iki yolun aynı sonucu verdiği testle denetlenir.
  let statesCache = { key: "", map: null };
  const BATCH_ACCOUNTS = 8;
  // Çek/senet olaylarının kapama girdisi (iki yol da bu tek kuralla): satırın olay türü (chequeEvents) ve faturaya bağı (links).
  // events: { chequeId, kind, invoiceId, own (cheques.invoice_id), effects } — olay sırasında (rowid). planned: taksitli faturalar.
  //   - Faturanın kendi evrakı (fatura kesilirken alınan/verilen; cheques.invoice_id = olay bağı) ve faturayla ciro: bağ her zaman (v2.0.15).
  //   - 2.4.4 UX18: "Kapatılacak Fatura" ile alınan/verilen evrak (yalnız olay bağı): cari kartından kurulan bağ gibi taksitli faturada yok sayılır
  //     (taksitli fatura kendi kartıyla kapanır; v2.0.23 Bulgu 2 — eski/bozuk veride de).
  //   - Karşılıksız (bounce) satırı, ters çevirdiği satırın bağını alır: alındığı caride borç satırı alış satırının, ciro edilen caride alacak satırı
  //     cironun bağını. Kapama bu satırı bağlı faturanın yükümlülüğü sayar → fatura yeniden açılır (lib/invoice-settle.mjs; taksitli faturada değil).
  function chequeLinks(events, planned, links, chequeEvents) {
    const byCheque = new Map();
    for (const event of events) {
      if (!byCheque.has(event.chequeId)) byCheque.set(event.chequeId, []);
      byCheque.get(event.chequeId).push(event);
    }
    for (const list of byCheque.values()) {
      const reversed = new Map();
      for (const event of list) {
        // İptal edilen faturanın evrakında olay etkileri geri alınmıştır ve alan nesne olarak işaretlenir ({ reverted }).
        const effects = parseJson(event.effects, []);
        const lines = (Array.isArray(effects) ? effects : []).filter(effect => effect?.table === "account_entries" && effect.id);
        const own = event.kind === "endorse" || (Boolean(event.own) && event.own === event.invoiceId);
        const link = event.invoiceId && (own || !planned.has(event.invoiceId)) ? event.invoiceId : "";
        for (const effect of lines) {
          chequeEvents.set(effect.id, event.kind);
          if (event.kind === "bounce") {
            const from = reversed.get(effect.accountId || "");
            if (from) links.set(effect.id, from);
            continue;
          }
          if (link) links.set(effect.id, link);
          if (["receive", "issue", "endorse"].includes(event.kind)) reversed.set(effect.accountId || "", link);
        }
      }
    }
  }
  function allPaymentStates() {
    const day = today();
    // Veri tabanı işleminin içinde (yazmalar henüz kesinleşmemiş, geri alınabilir) önbellek ne okunur ne yazılır: geri
    // alınan işlemin durumu saklanıp sonra gösterilmesin (total_changes() geri alınca azalmaz).
    const inTx = store.inTransaction;
    const key = `${store.get("SELECT total_changes() AS n").n}|${store.get("PRAGMA data_version").data_version}|${day}`;
    if (!inTx && statesCache.key === key && statesCache.map) return statesCache.map;
    const group = (rows, field) => {
      const map = new Map();
      for (const row of rows) {
        const id = row[field];
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(row);
      }
      return map;
    };
    const ledgers = accounts()?.allLedgers ? accounts().allLedgers({ invoiced: true }).lines : new Map();
    // issuedAt (v2.0.23): borcun doğduğu an (Mevcut Borç kartının kapsamı, lib/invoice-settle.mjs).
    const invoicesOf = group(store.all("SELECT id, account_id AS accountId, kind, status, try_payable AS payable, original_id AS originalId, due_date AS dueDate, plan_id AS planId, COALESCE(NULLIF(issued_at, ''), created_at) AS issuedAt FROM invoices"), "accountId");
    const baseLinks = new Map();
    for (const entry of store.all("SELECT id, account_id AS accountId, source_id AS invoiceId FROM account_entries WHERE source = 'invoice' AND kind IN ('in', 'out')")) {
      if (!baseLinks.has(entry.accountId)) baseLinks.set(entry.accountId, new Map());
      baseLinks.get(entry.accountId).set(entry.id, entry.invoiceId);
    }
    // v2.0.23: taksitli faturaya cari kartından kurulmuş bağ (eski veri) yok sayılır: taksitli fatura kendi kartıyla kapanır.
    const planned = new Set(store.all("SELECT id FROM invoices WHERE plan_id <> ''").map(row => row.id));
    // 2.2.0: POS komisyon kesintisi/iadesi (source 'bank') yalnız bağlandığı komisyon faturasını kapatır (pos-fee, lib/invoice-settle.mjs).
    for (const entry of store.all("SELECT id, account_id AS accountId, invoice_id AS invoiceId FROM account_entries WHERE source IN ('', 'bank') AND invoice_id <> ''")) {
      if (planned.has(entry.invoiceId)) continue;
      if (!baseLinks.has(entry.accountId)) baseLinks.set(entry.accountId, new Map());
      baseLinks.get(entry.accountId).set(entry.id, entry.invoiceId);
    }
    // Çek olayı, cari başına yolda olduğu gibi evrakın carisine, ciro edilen cariye ve olayın carisine sayılır.
    const eventsOf = new Map();
    for (const event of store.all("SELECT ev.cheque_id AS chequeId, ev.kind, ev.invoice_id AS invoiceId, ev.effects_json AS effects, c.invoice_id AS own, c.account_id AS a1, c.endorse_account_id AS a2, ev.account_id AS a3 FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id ORDER BY ev.rowid")) {
      for (const accountId of new Set([event.a1, event.a2, event.a3].filter(Boolean))) {
        if (!eventsOf.has(accountId)) eventsOf.set(accountId, []);
        eventsOf.get(accountId).push(event);
      }
    }
    const offsetsOf = group(store.all("SELECT id, account_id AS accountId, invoice_id AS invoiceId, counter_type AS counterType, counter_id AS counterId, amount, date, note, created_at AS createdAt FROM invoice_offsets ORDER BY date, created_at"), "accountId");
    const planTotals = new Map(store.all("SELECT id, total FROM plans WHERE deleted_at IS NULL").map(row => [row.id, Number(row.total) || 0]));
    const scheduleOf = group(store.all("SELECT plan_id AS planId, due_date AS dueDate, amount FROM plan_items ORDER BY due_date"), "planId");
    const map = new Map();
    for (const [accountId, all] of invoicesOf) {
      const links = new Map(baseLinks.get(accountId) || []);
      const chequeEvents = new Map();
      chequeLinks(eventsOf.get(accountId) || [], planned, links, chequeEvents);
      const offsets = (offsetsOf.get(accountId) || []).map(({ accountId: _, ...offset }) => ({ ...offset, label: offsetLabel(offset) }));
      const invoices = all.map(({ accountId: _, ...item }) => (item.planId ? { ...item, planTotal: planTotals.get(item.planId) || 0, schedule: (scheduleOf.get(item.planId) || []).map(({ planId: __, ...row }) => row) } : item));
      const states = settle({ lines: ledgers.get(accountId) || [], invoices, links, chequeEvents, offsets, today: day });
      for (const [id, state] of states) map.set(id, state);
    }
    if (!inTx) statesCache = { key, map };
    return map;
  }
  function paymentStates(rows) {
    const out = new Map();
    const byAccount = new Map();
    for (const row of rows) {
      if (!byAccount.has(row.accountId)) byAccount.set(row.accountId, []);
      byAccount.get(row.accountId).push(row);
    }
    if (byAccount.size > BATCH_ACCOUNTS) {
      const all = allPaymentStates();
      for (const row of rows) out.set(row.id, all.get(row.id) || { payable: row.tryPayable, paid: 0, open: row.tryPayable, state: "open", label: PAY_STATES.open });
      return out;
    }
    const day = today();
    for (const [accountId, list] of byAccount) {
      let ledger = [];
      try {
        ledger = accounts()?.detail ? accounts().detail(accountId, AUDITOR).ledger || [] : [];
      } catch {
        ledger = [];
      }
      // Bu carinin bütün faturaları (listede olmayanlar da kapamada yer tutar).
      const all = store.all("SELECT id, kind, status, try_payable AS payable, original_id AS originalId, due_date AS dueDate, plan_id AS planId, COALESCE(NULLIF(issued_at, ''), created_at) AS issuedAt FROM invoices WHERE account_id = ?", accountId);
      const links = new Map();
      for (const entry of store.all("SELECT id, source_id AS invoiceId FROM account_entries WHERE account_id = ? AND source = 'invoice' AND kind IN ('in', 'out')", accountId)) links.set(entry.id, entry.invoiceId);
      // v2.0.17: cari kartından "Kapatılacak Fatura" seçilerek girilen tahsilat/ödeme.
      // v2.0.23: taksitli faturaya kurulmuş bağ (eski veri) yok sayılır (toplu yolla aynı kural).
      const planned = new Set(all.filter(item => item.planId).map(item => item.id));
      for (const entry of store.all("SELECT id, invoice_id AS invoiceId FROM account_entries WHERE account_id = ? AND source IN ('', 'bank') AND invoice_id <> ''", accountId)) if (!planned.has(entry.invoiceId)) links.set(entry.id, entry.invoiceId);
      // Çek/senet satırlarının olay türü (karşılıksız → yükümlülük yeniden açılır) ve faturaya bağı.
      const chequeEvents = new Map();
      // Bağlı fatura başka carinin olsa (bozuk veri) kapamada zaten yer almaz (yalnız bu carinin faturaları); taksitli olanlar bu carinin kümesinde.
      chequeLinks(store.all("SELECT ev.cheque_id AS chequeId, ev.kind, ev.invoice_id AS invoiceId, ev.effects_json AS effects, c.invoice_id AS own FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE c.account_id = ? OR c.endorse_account_id = ? OR ev.account_id = ? ORDER BY ev.rowid", accountId, accountId, accountId), planned, links, chequeEvents);
      const offsets = store.all("SELECT id, invoice_id AS invoiceId, counter_type AS counterType, counter_id AS counterId, amount, date, note, created_at AS createdAt FROM invoice_offsets WHERE account_id = ? ORDER BY date, created_at", accountId).map(offset => ({ ...offset, label: offsetLabel(offset) }));
      const plansById = new Map();
      for (const invoice of all.filter(item => item.planId)) {
        const plan = store.get("SELECT total FROM plans WHERE id = ? AND deleted_at IS NULL", invoice.planId);
        const schedule = store.all("SELECT due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date", invoice.planId);
        plansById.set(invoice.id, { planTotal: Number(plan?.total) || 0, schedule });
      }
      const states = settle({ lines: ledger, invoices: all.map(item => ({ ...item, ...(plansById.get(item.id) || {}) })), links, chequeEvents, offsets, today: day });
      for (const row of list) out.set(row.id, states.get(row.id) || { payable: row.tryPayable, paid: 0, open: row.tryPayable, state: "open", label: PAY_STATES.open });
    }
    return out;
  }

  const unsentNumbered = row => row.status === "issued" && sendKind(row.kind, row.profile) && row.profile !== "KAGIT" && Boolean(row.number) && ["", "none", "error"].includes(row.eStatus || "");
  // unsentSql ile aynı kural: canlı ortamda test serisinden numara almış, gönderilmemiş belge (gönderilemez; iptal edilir).
  const testSeriesInLive = row => unsentNumbered(row) && TEST_SERIES_SET.has(row.series) && edocLive && settings().integrator.env === "live";
  const TEST_LIVE_TEXT = number => `${number} test ortamında numara almış bir belgedir (seri ${String(number || "").slice(0, 3)}); test serisi canlı ortamda gönderilmez. İptal Et ile iptal edip yeniden kesin: firmanızın serisinden numara alır.`;
  const shape = (row, state = null) => ({
    id: row.id,
    kind: row.kind,
    kindLabel: label(row),
    scenario: row.scenario,
    scenarioLabel: SCENARIOS[row.scenario]?.label || "",
    status: row.status,
    statusLabel: { draft: "Taslak", issued: "Kaydedildi", cancelled: "İptal Edildi" }[row.status] || row.status,
    number: row.number,
    displayNo: displayNo(row),
    // 2.4.3 (uzman UX28): müşteri numara vermediği için programın iç seriden numara verdiği satıştan iade (düzenlemede "Müşterinin İade Faturası No"
    // kutusu boş ve salt okunur gelir; iç numara açıklamada).
    internalNumber: row.kind === "sale_return" && Number(row.seq) > 0,
    ettn: row.ettn,
    issueDate: row.issueDate,
    issueTime: row.issueTime,
    accountId: row.accountId,
    accountName: parseJson(row.partyJson, {}).name || row.accountName,
    accountRef: row.accountRef,
    accountPhone: row.accountPhone,
    profile: row.profile,
    profileLabel: PROFILES[row.profile] || row.profile,
    typeCode: row.typeCode,
    currency: row.currency,
    rate: row.rate,
    netTotal: row.netTotal,
    vatTotal: row.vatTotal,
    withheldTotal: row.withheldTotal,
    stoppageTotal: row.stoppageTotal,
    payableTotal: row.payableTotal,
    tryNet: row.tryNet,
    tryVat: row.tryVat,
    tryPayable: row.tryPayable,
    dueDate: row.dueDate,
    // v2.0.23: taksitli faturanın kartı (cari kartındaki "Kapatılacak Fatura" seçenekleri taksitli faturayı göstermez).
    planId: row.planId || "",
    originalId: row.originalId,
    originalNumber: row.originalNumber,
    originalDate: row.originalDate,
    note: row.note,
    eStatus: row.eStatus,
    eStatusLabel: testSeriesInLive(row) ? "Test Serisi" : uncertainSend(row) ? "Sonucu Belirsiz" : E_STATES[row.eStatus] || row.eStatus,
    // 2.4.3 (H1): numara almış, entegratöre ulaşmamış kendi e-Belgemiz (Gönderilmedi / Sonucu Belirsiz / Hata) — listede rozet, Gönderilecekler'de.
    // Gözden geçirme 2.4.3 (5b): canlı ortamda test serili (TEF / TEA / TES) gönderilmemiş belge Gönderilecekler'de sayılmaz (unsentSql) — rozeti de
    // "Gönderilmedi" demez: "Test Serisi" (eTestLive), kartında "canlıda gönderilmez; İptal Edin".
    eUnsent: unsentNumbered(row) && !testSeriesInLive(row),
    eTestLive: testSeriesInLive(row),
    // Test ortamı belgesi (seri TEF / TEA / TES): yasal geçerliliği yok.
    eTest: row.profile !== "KAGIT" && TEST_SERIES_SET.has(row.series),
    actorName: row.actorName,
    createdAt: row.createdAt,
    payState: state?.state || (row.status === "draft" ? "draft" : row.status === "cancelled" ? "cancelled" : ""),
    payStateLabel: state?.label || (row.status === "draft" ? PAY_STATES.draft : row.status === "cancelled" ? PAY_STATES.cancelled : ""),
    paid: state?.paid ?? 0,
    open: state?.open ?? 0,
    // v2.0.17: "Bu Faturayı Kapatanlar" — her ödenen kuruşun kaynağı (tarih, tür, tutar, bağlı/otomatik/mahsup).
    closers: (state?.closers || []).map(item => ({ ...item, modeLabel: CLOSER_MODES[item.mode] || item.mode, methodLabel: item.method ? methodLabel(item.method) : "" })),
  });

  function exclusiveTotals(lines, includeVat) {
    let baseNet = 0;
    let discountNet = 0;
    for (const line of lines) {
      const parts = exclusiveParts(line, includeVat, 100);
      baseNet += Math.round(parts.baseNet * 100);
      discountNet += Math.round(parts.discountNet * 100);
    }
    return { baseNetTotal: baseNet / 100, discountNetTotal: discountNet / 100 };
  }
  // Düzenleme engeli (boşsa düzenlenebilir). Çek/senedin sonradan işlem görmesi kayıt anında denetlenir (voidFor).
  const E_SENT = new Set(["processing", "sent", "accepted", "rejected", "cancelled"]);
  // v2.0.17 (müşteri: "iade faturasında Düzenle pasif"): iade belgesi de düzenlenir — aynı numara, tek işlemde eski etkiler
  // geri alınır, yenisi yazılır; asıl fatura ve cari değişmez, miktar asıl faturanın kalanını aşamaz, tarih asıl faturadan
  // önce olamaz (documentInput/linesInput denetler).
  // Faturanın kendi ödeme satırları: peşin tahsilat/ödeme ve formdan alınan/verilen çek-senedin cari satırları.
  // 2.4.4 UX18: faturaya Kapatılacak Fatura ile bağlanmış (faturanın parçası olmayan, silinmemiş) evrak sayısı.
  const bondedCheques = invoiceId => store.get("SELECT COUNT(*) AS n FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE ev.invoice_id = ? AND ev.kind IN ('receive', 'issue') AND c.invoice_id = '' AND c.deleted_at IS NULL", invoiceId).n;
  // 2.4.4 UX18: "Kapatılacak Fatura" ile bağlanan evrak (yalnız olay bağı) burada da sayılır, ama sonradan taksitlendirmeyi bondedCheques zaten
  // reddeder (editInvoice; silinmiş evrakın satırı yoktur) — kural tek yerde.
  function ownPaymentLines(invoiceId) {
    const ids = new Set(store.all("SELECT id FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out')", invoiceId).map(row => row.id));
    for (const event of store.all("SELECT effects_json AS effects FROM cheque_events WHERE invoice_id = ?", invoiceId)) {
      const effects = parseJson(event.effects, []);
      for (const effect of Array.isArray(effects) ? effects : []) if (effect?.table === "account_entries" && effect.id) ids.add(effect.id);
    }
    return ids;
  }
  // v2.1.0 Aşama 4 (banka planı §3.7 #13, K2): Banka penceresinden girilen KDV'li masrafın faturası (masraf başlığı faturaya bağlı, ödeme bu
  // hesaptan havale). Fatura penceresinden düzenlenmez, iptal edilmez, silinmez, iadesi kesilmez: Banka → İşlem Kartı → Ters Kaydet faturayı ve
  // masraf başlığını TEK işlemde iptal eder (yalnız fatura iptal edilirse banka başlığı ödemesiz kalırdı; kapı bank:voucher reddeder).
  // GG2: kilitli dönemdeki KDV'li masrafın Ters Kaydet'i bugün tarihli Alıştan İade faturası keser (başlık "ters kaydedildi"); asıl fatura ve iade
  // faturası da Fatura penceresinden değiştirilmez (iade iptal edilseydi Banka'da ters kaydedilmiş görünen masraf geri gelirdi).
  const bankFeeOf = invoiceId => (invoiceId ? store.get("SELECT id, no, type, status, bank_ref AS bankRef FROM fin_events WHERE invoice_id = ? AND invoice_id <> '' AND +src_table = '' AND ((+type = 'fee' AND +status IN ('active', 'reversed')) OR (+type = 'reversal' AND +status = 'active')) LIMIT 1", invoiceId) || null : null);
  const bankFeeText = fee => {
    if (fee.type === "reversal") return `Bu iade faturası Banka masrafının Ters Kaydet'iyle kesildi (İşlem No ${fee.no}); Fatura penceresinden iptal edilmez, silinmez, düzenlenmez.`;
    if (fee.status === "reversed") return `Bu fatura Banka penceresinden girilen masrafın faturasıdır (İşlem No ${fee.no}); masraf Ters Kaydet ile iade faturasıyla geri alındı. Fatura penceresinden değiştirilmez.`;
    return `Bu fatura Banka penceresinden girilen masrafın faturasıdır (İşlem No ${fee.no}); Banka → İşlem Kartı → Ters Kaydet ile iptal edilir (kilitli dönemde bugün tarihli iade faturasıyla).`;
  };
  function modifyBlock(row, activeReturns = 0, plan = null) {
    const fee = row.status === "issued" ? bankFeeOf(row.id) : null;
    if (fee) return bankFeeText(fee);
    if (activeReturns) return `Bu faturanın ${activeReturns} iade faturası var; düzenlenmez. Önce iadeleri iptal edin.`;
    if (E_SENT.has(row.eStatus)) return `Bu belge e-Belge olarak ${(E_STATES[row.eStatus] || "gönderildi").toLocaleLowerCase("tr-TR")}; düzenlenmez. İptal ya da iade faturasıyla düzeltin.`;
    if (uncertainSend(row)) return UNCERTAIN_TEXT;
    const lock = period?.lockedUntil?.();
    if (lock && row.issueDate <= lock) return `Belge ${dayText(row.issueDate)} tarihli; ${dayText(lock)} ve öncesi kilitli dönem. Düzenlemek için dönem kilidi açılmalı.`;
    const planId = plan?.id || row.planId;
    if (planId && store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", planId).n) return "Faturanın taksit kartında tahsilat var; düzenlenmez. Borcu düşürmek için iade faturası kaydedin.";
    return "";
  }
  // Kaydedilmiş belgeyi düzenleme: tek işlemde eski etkiler (stok, cari, Kasa, taksit, çek/senet) geri alınır, yenileri
  // yazılır; numara, seri, ETTN ve ilk kayıt bilgisi korunur. Kasa ve stok yalnız SON durumda denetlenir (ara durum yok).
  function editInvoice(user, id, body) {
    const existing = invoiceRow(id);
    if (existing.status !== "issued") throw new HttpError(409, "Yalnız kaydedilmiş belge bu yolla düzenlenir; taslak için Düzenle ve Kaydet.", { code: "invoice-not-issued" });
    const activeReturns = store.get("SELECT COUNT(*) AS n FROM invoices WHERE original_id = ? AND status = 'issued'", existing.id).n;
    const block = modifyBlock(existing, activeReturns);
    if (block) throw new HttpError(409, block, { code: "invoice-locked" });
    // v2.0.23 (gözden geçirme): taksitsiz faturaya kendi ödeme satırları dışında ödeme sayılmışsa (cari kartından, mahsup,
    // Mevcut Borç kartı) ya da borcu bir Mevcut Borç kartınca taksitlendirilmişse sonradan taksitlendirme o ödemeyi açıkta
    // bırakıyordu (kart faturanın tamamı oluyor, ödeme hiçbir yere sayılmıyordu). Kalan için doğru yol cari kartındaki kart.
    if (!existing.planId && text(body?.payment?.rest) === "installments") {
      const state = paymentStates([existing]).get(existing.id);
      const own = ownPaymentLines(existing.id);
      // 2.4.4 UX18: karşılıksız evrakın eksi kapatanı (mode bounce) yabancı ödemeyi gizlemez; Kapatılacak Fatura ile bağlanmış evrak varken reddedilir.
      const foreign = roundMoney((state?.closers || []).filter(item => !own.has(item.id) && item.mode !== "bounce").reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
      const bonded = bondedCheques(existing.id);
      if (bonded) throw new HttpError(409, `Bu faturaya Kapatılacak Fatura olarak bağlanmış ${bonded} çek/senet var; sonradan taksitlendirilirse fatura ile kart ayrışır. Faturayı taksitlendirmeden kaydedin; kalanı için cari kartında + Taksit Planı → Borcun Kaynağı: Carinin Mevcut Borcu.`, { code: "invoice-paid-elsewhere" });
      if (foreign > 0.004 || (Number(state?.covered) || 0) > 0.004) {
        throw new HttpError(409, `${foreign > 0.004 ? `Bu faturaya kendi ödemesi dışında ${tl(foreign)} ödeme sayılmış` : "Bu faturanın borcu bir taksit kartıyla taksitlendirilmiş"}; sonradan taksitlendirilirse fatura ile kart ayrışır. Faturayı taksitlendirmeden kaydedin; kalanı için cari kartında + Taksit Planı → Borcun Kaynağı: Carinin Mevcut Borcu.`, { code: "invoice-paid-elsewhere" });
      }
    }
    if (INVOICE_KINDS[existing.kind].return && text(body.originalId) && text(body.originalId) !== existing.originalId) fail400("İadenin asıl faturası düzenlemede değişmez; iptal edip yeni iade kaydedin.", "originalId", { code: "return-original-fixed" });
    const doc = documentInput({ ...body, kind: existing.kind }, { mode: "issue", existing });
    if (doc.kind !== existing.kind) fail400("Belgenin türü düzenlemede değişmez.", "kind");
    if (doc.account?.id && doc.account.id !== existing.accountId && INVOICE_KINDS[existing.kind].return) fail400("İadenin carisi asıl faturadan gelir; değiştirilmez.", "accountId");
    // 2.4.4 UX18: Kapatılacak Fatura bağı (cari kartından tahsilat/ödeme ya da çek/senet) carinin kendi faturasınadır; cari değişince bağ başka cariyi
    // gösterirdi (kapı invoice:offset reddeder, ama nedeni söylemeden). Bağlıyken cari değiştirilmez.
    if (doc.account?.id && doc.account.id !== existing.accountId) {
      const entries = store.get("SELECT COUNT(*) AS n FROM account_entries WHERE invoice_id = ?", existing.id).n;
      const bonded = bondedCheques(existing.id);
      if (entries || bonded) fail400(`Bu faturaya cari kartından Kapatılacak Fatura olarak bağlanmış ${[entries ? `${entries} tahsilat/ödeme` : "", bonded ? `${bonded} çek/senet` : ""].filter(Boolean).join(" ve ")} var; cari değiştirilemez. Önce o kayıtlarda Kapatılacak Fatura'yı Otomatik yapın ya da faturayı iptal edip doğru cariye yeniden kaydedin.`, "accountId", { code: "invoice-bonded" });
    }
    // 2.4.4 (UX15): kural tek yerde (editChronologyProblem); formun ön hesabı (calc) aynı fonksiyonla onaydan önce söyler.
    const chronology = editChronologyProblem(existing, doc);
    if (chronology) fail400(chronology, "issueDate", { code: "chronology" });
    const force = forceOf(body);
    const before = linesOf(existing.id);
    const oldCash = store.all("SELECT kind, amount, method, date, event_id AS eventId, fin_ref AS finRef FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out') ORDER BY rowid", existing.id);
    // Aşama 7 (plan §3.8): eski peşin satırların satır anahtarı (lineKey) payment_json'daki sırayla (satırlar o sırayla yazıldı); anahtarsız eski
    // faturada i0, i1… (ekran da öyle gönderir). Hesap (fin_ref) satırın kendisinden: Banka'dan "Bu Hesaba Ata" sonradan bağlamış olabilir.
    const oldPay = (parseJson(existing.paymentJson, {}).cash || []).filter(item => Number(item?.amount) > 0);
    const oldLines = oldCash.map((row, index) => ({ ...row, lineKey: LINE_KEY.test(String(oldPay[index]?.lineKey || "")) ? oldPay[index].lineKey : `i${index}` }));
    const previousLines = new Map(oldLines.map(row => [row.lineKey, { method: row.method || "cash", amount: row.amount, date: row.date, finRef: row.finRef || "" }]));
    // Gözden geçirme D2 (Aşama 2): özeti (yön, tutar, yol, hesap, tarih) aynı kalan peşin satır eski işlem başlığını (İşlem No) korur; yalnız Not ya
    // da kalem düzeltmesi peşini yeni numarayla yeniden açmaz (plan §3.8). Önce aynı satır anahtarlı satır, yoksa aynı özetli satır sırayla eşlenir.
    const keyOf = row => `${row.kind}|${Math.round((Number(row.amount) || 0) * 100)}|${row.method || "cash"}|${row.date}|${row.finRef || ""}`;
    const pool = new Map();
    const byLine = new Map();
    for (const row of oldLines) {
      if (!row.eventId) continue;
      pool.set(keyOf(row), [...(pool.get(keyOf(row)) || []), row.eventId]);
      byLine.set(row.lineKey, { key: keyOf(row), eventId: row.eventId });
    }
    const keepEvents = {
      take: row => {
        const own = row.lineKey ? byLine.get(row.lineKey) : null;
        if (own && own.key === keyOf(row) && pool.get(own.key)?.includes(own.eventId)) {
          pool.set(own.key, pool.get(own.key).filter(id => id !== own.eventId));
          return own.eventId;
        }
        return pool.get(keyOf(row))?.shift() || "";
      },
    };
    // K7 (Aşama 7): eski ve yeni hesapların bakiyesi düzenlemeden önce yakalanır. Yeni hesap ödeme bölümünden (paymentInput işlemin içinde, eski
    // etkiler geri alındıktan sonra) gelir; ön yakalama gövdedeki hesapları ve tek uygun hesabı (kendiliğinden seçim) kapsar.
    const askedRefs = (Array.isArray(body?.payment?.cash) ? body.payment.cash : []).map(item => text(item?.bankAccountId)).filter(Boolean);
    const single = banking.eligible();
    // K2: alış tarafında tek kurumsal kart da kendiliğinden seçilir (kart limiti K7'de).
    const singleCard = INVOICE_KINDS[existing.kind]?.side === "purchase" ? banking.eligible("card") : [];
    const k7 = banking.negative([...oldLines.map(row => row.finRef), ...askedRefs, ...(single.length === 1 ? single : []), ...(singleCard.length === 1 ? singleCard : [])], existing.issueDate < doc.date ? existing.issueDate : doc.date, force.negative === true);
    const touched = { accounts: new Set([existing.accountId]), items: new Set(), cash: false, cheques: { accountIds: [], chequeIds: [] }, plans: new Set() };
    const stockBefore = new Map();
    for (const itemId of new Set(before.filter(line => line.itemId && line.goods).map(line => line.itemId))) {
      try {
        stockBefore.set(itemId, stock().invoiceStock.available(itemId));
      } catch {
        // silinmiş ürün: denetlenmez
      }
    }
    // v2.1.0 (bank.post op 'update'): eski peşin satırların işlem başlıkları iptal olur, yenileri açılır (tek işlemde).
    const result = bank.post({ user, module: "invoice", op: "update", prev: existing, similarOk: force.similar === true, guard: k7.guard, write: () => {
      k7.capture();
      period?.assertOpen(existing.issueDate, "Bu fatura");
      // v2.0.24: eski iadenin küçülttüğü kartlar önce geri büyür; yeni iade kaydedilirken yeniden hesaplanır.
      if (existing.kind === "sale_return" && existing.originalId) restoreCuts(user, { id: existing.id }, touched, `İade düzenlendi ${existing.number}`);
      reverseEffects(user, existing, touched, { force, edit: true });
      const pre = existing.kind === "sale_return" && existing.originalId ? coverState(existing.originalId) : null;
      const payment = paymentInput(body, doc, user, { previous: previousLines });
      const written = writeIssued(user, doc, payment, { id: existing.id, force, edit: existing, pre, keepEvents });
      // Son durum denetimi — stok: düzenleme bir ürünü eksiye düşürdüyse (ya da eksiyi büyüttüyse) sorulur.
      if (!force.stock) {
        for (const [itemId, was] of stockBefore) {
          const left = stock().invoiceStock.available(itemId);
          if (left < -1e-9 && left < was - 1e-9) {
            const item = stock().invoiceStock.itemFor(itemId);
            throw new HttpError(409, `“${item.name}” bu düzenlemeyle stokta ${String(Math.round(left * 1000) / 1000).replace(".", ",")} ${item.unit} kalır (eksi). Kayıttan sonra stok: ${String(Math.round(left * 1000) / 1000).replace(".", ",")} ${item.unit} olacak.`, { code: "stock-negative", itemId, itemName: item.name, available: left, after: left });
          }
        }
      }
      // Kasa: yöntem başına net giriş azaldıysa (peşin tahsilat küçüldü / ödeme büyüdü) eksiye düşme denetimi.
      const signed = rows => rows.reduce((map, row) => map.set(row.method || "cash", (map.get(row.method || "cash") || 0) + (row.kind === "in" ? row.amount : -row.amount)), new Map());
      const was = signed(oldCash);
      const now2 = signed(store.all("SELECT kind, amount, method FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out')", existing.id));
      for (const method of new Set([...was.keys(), ...now2.keys()])) {
        const delta = Math.round(((now2.get(method) || 0) - (was.get(method) || 0)) * 100) / 100;
        // Bakiye burada zaten SON durumdadır (eski etki çıktı, yenisi girdi): kuruşun altında bir tutarla "son bakiye eksi
        // mi" sorulur; farkı yeniden düşmek çift sayım olurdu.
        if (delta < -0.004) cash?.guardOut?.(0.001, doc.date, force.cash === true, method);
      }
      const after = linesOf(existing.id);
      audit(user, "invoice.edited", existing.id, {
        number: existing.number,
        kind: existing.kind,
        before: { accountId: existing.accountId, date: existing.issueDate, payable: existing.tryPayable, lines: before.map(line => ({ name: line.name, qty: line.qty, unitPrice: line.unitPrice, vatRate: line.vatRate })) },
        after: { accountId: doc.account.id, date: doc.date, payable: c2(doc.money.payable), lines: after.map(line => ({ name: line.name, qty: line.qty, unitPrice: line.unitPrice, vatRate: line.vatRate })) },
      });
      return written;
    } });
    k7.prime(result);
    publishAll(user, touched, result.id);
    return result;
  }
  // v2.0.17: iade belgesinde kart/banka iadesi "POS İadesi" / "Kredi Kartı İadesi" (müşteriye karta iade; Kredi Kartı değil).
  const refundMethodLabel = (kind, entry) => {
    if (entry.method === "card" && kind === "sale_return" && entry.kind === "out") return "POS İadesi";
    if (entry.method === "card" && kind === "purchase_return" && entry.kind === "in") return "Kredi Kartı İadesi";
    return methodLabel(entry.method, entry.kind);
  };
  // excludeReturnId: bir iade belgesi düzenlenirken asıl faturanın "iade edilebilir kalanı" o iadenin kendi miktarı hariç
  // hesaplanır (yoksa kendi miktarı kadar eksik görünür, artırma yapılamazdı).
  // Aşama 7: peşin satırın hesabı satırın kendisinden (Banka'dan "Bu Hesaba Ata" sonradan bağlamış olabilir); satırlar payment_json sırasıyla yazıldı.
  const paymentView = (row, payments) => {
    const payment = parseJson(row.paymentJson, {});
    if (row.status !== "issued" || !Array.isArray(payment.cash)) return payment;
    const cash = payment.cash.filter(item => Number(item?.amount) > 0);
    if (cash.length !== payments.length) return payment;
    return { ...payment, cash: cash.map((item, index) => ({ ...item, bankAccountId: payments[index].finRef || "", ...posLineOf(payments[index]) })) };
  };
  // 2.2.0 (İz 3.2): POS'lu peşin satırın POS bilgisi (Düzenle formu dolu açılsın): POS, POS Taksit Sayısı, Provizyon No, kartın son 4 hanesi ve
  // POS İadesinde asıl POS işlemi — satırın etkin POS kaydından (pos_sales; payment_json bunları taşımaz).
  function posLineOf(entry) {
    if (!entry?.eventId || entry.method !== "card" || !entry.finRef) return {};
    let sale = null;
    try {
      sale = store.get("SELECT pos_id AS posId, installments, auth_code AS authCode, card_last4 AS cardLast4, origin_id AS originId, src FROM pos_sales WHERE event_id = ? AND status = 'active' AND src <> 'cancel' ORDER BY created_at DESC LIMIT 1", entry.eventId);
    } catch {
      return {}; // POS tabloları yoksa (göç öncesi veri)
    }
    if (!sale || sale.posId !== entry.finRef) return {};
    return { posId: sale.posId, posInstallments: Number(sale.installments) || 1, authCode: sale.authCode || "", cardLast4: sale.cardLast4 || "", ...(sale.originId ? { posRefundOf: sale.originId } : {}), ...(sale.src === "sourceless" ? { posSourceless: true } : {}) };
  }
  function detail(id, user, { excludeReturnId = "" } = {}) {
    const row = invoiceRow(id);
    const lines = linesOf(row.id);
    const returned = returnedQty(lines.map(line => line.id), excludeReturnId);
    const state = row.status === "issued" ? paymentStates([row]).get(row.id) : null;
    const returns = store.all("SELECT id, number, issue_date AS issueDate, status, try_payable AS tryPayable, kind FROM invoices WHERE original_id = ? ORDER BY issue_date, created_at", row.id);
    const linkedCheques = cheques()?.invoiceCheques ? cheques().invoiceCheques.forInvoice(row.id) : [];
    const plan = row.planId ? store.get("SELECT id, name, total, status, ref_no AS refNo FROM plans WHERE id = ? AND deleted_at IS NULL", row.planId) : null;
    const payments = store.all("SELECT id, kind, amount, date, method, fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out') ORDER BY created_at, rowid", row.id).map(entry => ({ ...entry, methodLabel: refundMethodLabel(row.kind, entry) }));
    const manage = canUser(user, "invoices.manage");
    const kind = INVOICE_KINDS[row.kind];
    const activeReturns = returns.filter(item => item.status === "issued").length;
    const bankFee = row.status === "issued" ? bankFeeOf(row.id) : null;
    const cancelLimit = cancelWindowOf(row);
    const returnable = lines.map(line => ({ id: line.id, left: Math.max(0, Math.round((line.qty - (returned.get(line.id) || 0)) * 1000) / 1000) }));
    return {
      ...shape(row, state),
      party: parseJson(row.partyJson, {}),
      seller: parseJson(row.sellerJson, {}),
      pricesIncludeVat: Boolean(row.pricesIncludeVat),
      discountRate: row.discountRate,
      stoppageRate: row.stoppageRate,
      baseTotal: row.baseTotal,
      discountTotal: row.discountTotal,
      // v2.0.16: Ara Toplam ve İskonto KDV hariç (KDV dahil fiyatta da Ara Toplam − İskonto = Matrah).
      ...exclusiveTotals(lines, Boolean(row.pricesIncludeVat)),
      goodsNet: row.goodsNet,
      serviceNet: row.serviceNet,
      grossTotal: row.grossTotal,
      tryWithheld: row.tryWithheld,
      tryStoppage: row.tryStoppage,
      gl: parseJson(row.glJson, []),
      orderNo: row.orderNo,
      orderDate: row.orderDate,
      despatchNo: row.despatchNo,
      despatchDate: row.despatchDate,
      paperNo: row.paperNo,
      returnRef: row.returnRef || "",
      payment: paymentView(row, payments),
      eMessage: row.eMessage,
      eAt: row.eAt,
      eAdapter: row.eAdapter,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,
      amountInWords: amountInWords(row.payableTotal, row.currency),
      byRate: vatBreakdown(lines),
      lines: lines.map(line => ({ ...line, goods: Boolean(line.goods), returned: returned.get(line.id) || 0, expenseLabel: EXPENSES[line.expenseCode]?.label || "" })),
      returnable,
      returns,
      cheques: linkedCheques.map(cheque => ({ id: cheque.id, direction: cheque.direction, instrument: cheque.instrument, instrumentLabel: cheque.instrumentLabel, serialNo: cheque.serialNo, bank: cheque.bank, amount: cheque.amount, dueDate: cheque.dueDate, status: cheque.status, statusLabel: cheque.statusLabel, endorsed: cheque.invoiceId !== row.id })),
      plan,
      payments,
      // 2.3.0 (İz 3.2): peşininde etkin POS satışı olan belge — İptal / Sil penceresi "POS İşlemi" seçimini (Müşteriye İade Edildi / Kayıt Hatası) yalnız bunlarda gösterir.
      posCash: posCashSet([row.id]).has(row.id),
      canManage: manage,
      canEdit: manage && row.status === "draft",
      // v2.0.16 (müşteri): kaydedilmiş belge düzenlenir (aynı numara; eski etkiler geri alınıp yenileri yazılır).
      canModify: manage && row.status === "issued" && !modifyBlock(row, activeReturns, plan),
      modifyBlock: row.status === "issued" ? modifyBlock(row, activeReturns, plan) : "",
      canIssue: manage && row.status === "draft",
      // v2.0.17 (müşteri): her belge silinebilir — taslak, kaydedilmiş (etkiler iptaldeki gibi geri alınır), iptal edilmiş.
      canDelete: manage && !deleteBlock(row, activeReturns, plan),
      deleteBlock: manage ? deleteBlock(row, activeReturns, plan) : "",
      canCancel: manage && row.status === "issued" && activeReturns === 0 && !bankFee && !uncertainSend(row) && !cancelLimit?.late,
      // 2.4.4 madde 23: iletilmiş e-Arşiv / e-SMM'nin son iptal günü (süre içindeyse kartta "Son İptal Günü"; dolduysa cancelBlock nedeni yazar).
      cancelWindow: cancelLimit ? { start: cancelLimit.start, source: cancelLimit.source, lastDay: cancelLimit.lastDay, late: cancelLimit.late } : null,
      cancelDeadline: cancelLimit && !cancelLimit.late ? cancelDeadlineText(cancelLimit) : "",
      // Yalnız programda iptal (entegratöre ulaşılamıyorsa; belirsiz gönderim ya da portal taslağı): Fatura Ayarları yetkisi.
      canLocalCancel: edocEnabled && manage && canUser(user, "invoices.settings") && row.status === "issued" && activeReturns === 0 && !bankFee && (uncertainSend(row) || row.eStatus === "draft"),
      // K4: iptal penceresinde söylenir (şüpheli carinin "Normal Cariye İşlendi" tahsilatı iptalle şüpheliden düşmeye başlar).
      cancelNotice: manage && row.status === "issued" ? doubtfulRelinkText(doubtfulRelinks(row.id)) : "",
      cancelBlock: row.status === "issued" && bankFee ? bankFeeText(bankFee) : row.status === "issued" && activeReturns ? `Bu faturanın ${activeReturns} iade faturası var; önce iadeleri iptal edin.` : cancelLimit?.late ? cancelLateText(cancelLimit) : "",
      canReturn: manage && row.status === "issued" && !kind?.return && row.kind !== "smm" && returnable.some(item => item.left > 0) && !bankFee,
      // v2.0.17: pasif düğmenin nedeni ekranda yazılı (yalnız title değil).
      returnBlock: row.status !== "issued" ? "" : bankFee ? bankFeeText(bankFee) : kind?.return ? "" : row.kind === "smm" ? "Serbest meslek makbuzundan iade belgesi olmaz; yanlışsa iptal edin." : returnable.some(item => item.left > 0) ? "" : "İade edilebilecek kalem kalmadı; faturanın tamamı iade edildi.",
      repeat: repeatOf(row.id),
      canRepeat: manage && row.status === "issued" && !kind?.return,
      canSend: edocEnabled && manage && row.status === "issued" && sendsDoc(row) && (row.profile !== "KAGIT" || row.eStatus === "withdrawn") && E_SENDABLE.has(row.eStatus || "none") && !sendBlockOf(row) && !buyerBlockOf(row) && !testSeriesInLive(row),
      canWithdraw: edocEnabled && manage && row.status === "issued" && row.eStatus === "waiting",
      sendBlock: edocEnabled ? sendBlockOf(row) || buyerBlockOf(row) || (testSeriesInLive(row) ? TEST_LIVE_TEXT(row.number) : "") : "",
      canRefresh: edocEnabled && manage && sendKind(row.kind, row.profile) && row.profile !== "KAGIT" && (E_TRACKED.has(row.eStatus) || uncertainSend(row)),
      // İz 7.3: portala taslak (ayar açıkken ya da belge zaten taslaktaysa yenileme). draftStale: taslak yüklendikten sonra belge düzenlendi.
      // 2.4.4 madde 22: e-SMM'de portala taslak yok (adapters.mjs: einvoice-draft-unsupported) — taslak ayarı açıkken de makbuz Gönder ile gider.
      canDraft: edocEnabled && manage && row.status === "issued" && sendsDoc(row) && eProfileOf(row) !== "ESMM" && (row.profile !== "KAGIT" || row.eStatus === "withdrawn") && E_SENDABLE.has(row.eStatus || "none") && !sendBlockOf(row) && !buyerBlockOf(row) && !testSeriesInLive(row) && (row.eStatus === "draft" || settings().eOptions.draftUpload === true),
      draftStale: row.eStatus === "draft" && Boolean(row.updatedAt && row.eAt && row.updatedAt > row.eAt),
      // Resmî görüntü (entegratörün ürettiği PDF): entegratöre ulaşmış belge (hata alanlar hariç).
      canOfficial: edocEnabled && sendKind(row.kind, row.profile) && row.profile !== "KAGIT" && E_VIEWABLE.has(row.eStatus) && Boolean(row.ettn),
      edocEnabled,
    };
  }
  const vatBreakdown = lines => {
    const map = new Map();
    for (const line of lines) {
      const item = map.get(line.vatRate) || { rate: line.vatRate, net: 0, vat: 0, withheld: 0 };
      item.net = roundMoney(item.net + line.net);
      item.vat = roundMoney(item.vat + line.vat);
      item.withheld = roundMoney(item.withheld + line.withheld);
      map.set(line.vatRate, item);
    }
    return [...map.values()].sort((a, b) => a.rate - b.rate);
  };

  // ---------- Liste ----------
  const SORTS = new Set(["date", "number", "amount", "party"]);
  // Ekran sekmeleri: Kesilen (satış + serbest meslek), Alınan (alış), İadeler, Taslaklar, İptal Edilenler, Tümü.
  const TABS = Object.freeze({
    sale: { kinds: ["sale", "smm"], status: "issued" },
    purchase: { kinds: ["purchase"], status: "issued" },
    returns: { kinds: ["sale_return", "purchase_return"], status: "issued" },
    drafts: { kinds: null, status: "draft" },
    // e-Belge: kesilmiş (etkileri işlenmiş), entegratöre sonra gönderilecek belgeler. 2.4.3 (hız testi H1, keşif B3): numara almış ama entegratöre
    // ulaşmamış e-Belge de (Gönderilmedi / Sonucu Belirsiz / Hata) burada — önceden yalnız kartından fark ediliyordu.
    pending: { kinds: null, status: "issued", unsent: true },
    cancelled: { kinds: null, status: "cancelled" },
    all: { kinds: null, status: "" },
  });
  const listQuery = params => ({
    tab: TABS[text(params.get("tab"))] ? text(params.get("tab")) : "",
    side: ["sale", "purchase"].includes(text(params.get("side"))) ? text(params.get("side")) : "",
    kind: INVOICE_KINDS[text(params.get("kind"))] ? text(params.get("kind")) : "",
    status: ["draft", "issued", "cancelled"].includes(text(params.get("status"))) ? text(params.get("status")) : "",
    pay: ["open", "paid", "overdue", "partial", "unpaid"].includes(text(params.get("pay"))) ? text(params.get("pay")) : "",
    profile: PROFILES[text(params.get("profile"))] ? text(params.get("profile")) : "",
    from: validDate(text(params.get("from"))) ? text(params.get("from")) : "",
    to: validDate(text(params.get("to"))) ? text(params.get("to")) : "",
    account: text(params.get("account")).slice(0, 120),
    item: text(params.get("item")).slice(0, 120),
    q: text(params.get("q")).slice(0, 120),
    ids: text(params.get("ids")).split(",").map(value => value.trim()).filter(Boolean).slice(0, 5000),
    sort: SORTS.has(text(params.get("sort"))) ? text(params.get("sort")) : "date",
  });
  // 2.4.3 H3 (fatura yükte hız testi): liste ucu her istekte bütün belgeleri ağır sütunlarıyla (alıcı/satıcı JSON'u, defter, ödeme) okuyup
  // her birini şekillendiriyor, sonra 200'ünü gönderiyordu: 10.000 belgede 200 satırlık sayfa 215–354 ms, tek satırlık numara araması
  // 267 ms; menü rozeti (limit=1) de aynı işi yapıyordu. page verilince ({ offset, limit }) süzgeç, ödeme durumu, sıralama ve toplamlar
  // hafif satırlardan AYNI kuralla hesaplanır; ağır sütunlar ve satırın tam şekli yalnız sayfadaki satırlar için okunur. Sonuç eski
  // list() + dilimle satır satır aynıdır (test/fatura-liste-243-fark.test.mjs). page yoksa (PDF / Excel) bütün satırlar şekillenir.
  const LIST_SQL = `SELECT i.id, i.kind, i.status, i.number, i.issue_date AS issueDate, i.issue_time AS issueTime, i.account_id AS accountId, i.party_json AS partyJson,
      i.try_net AS tryNet, i.try_vat AS tryVat, i.try_payable AS tryPayable, i.e_status AS eStatus, i.created_at AS createdAt, i.note, i.order_no AS orderNo,
      i.despatch_no AS despatchNo, i.paper_no AS paperNo, i.ettn, COALESCE(a.name, '') AS accountName, COALESCE(a.tax_no, '') AS accountTaxNo
    FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id LEFT JOIN users u ON u.id = i.created_by LEFT JOIN invoices o ON o.id = i.original_id`;
  // Süzgeç, sıralama ve toplamın okuduğu alanlar; değerler shape() ile aynı (party: Cari adı yalnız cari sıralamasında gerekir).
  const leanRow = (row, state, party) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    displayNo: displayNo(row),
    issueDate: row.issueDate,
    issueTime: row.issueTime,
    createdAt: row.createdAt,
    accountName: party ? parseJson(row.partyJson, {}).name || row.accountName : "",
    tryNet: row.tryNet,
    tryVat: row.tryVat,
    tryPayable: row.tryPayable,
    payState: state?.state || (row.status === "draft" ? "draft" : row.status === "cancelled" ? "cancelled" : ""),
    open: state?.open ?? 0,
  });
  function list(user, query, page = null) {
    const where = [];
    const args = [];
    if (query.ids?.length) {
      where.push(`i.id IN (${query.ids.map(() => "?").join(", ")})`);
      args.push(...query.ids);
    }
    if (query.side) {
      where.push(`i.kind IN (${SIDE_KINDS[query.side].map(() => "?").join(", ")})`);
      args.push(...SIDE_KINDS[query.side]);
    }
    if (query.tab) {
      const tab = TABS[query.tab];
      if (tab.kinds) {
        where.push(`i.kind IN (${tab.kinds.map(() => "?").join(", ")})`);
        args.push(...tab.kinds);
      }
      if (tab.status) {
        where.push("i.status = ?");
        args.push(tab.status);
      }
      if (tab.eStatus) {
        where.push("i.e_status = ?");
        args.push(tab.eStatus);
      }
      if (tab.unsent) {
        const unsent = unsentSql();
        where.push(unsent.sql);
        args.push(...unsent.args);
      }
    }
    if (query.kind) {
      where.push("i.kind = ?");
      args.push(query.kind);
    }
    if (query.status) {
      where.push("i.status = ?");
      args.push(query.status);
    }
    if (query.profile) {
      where.push("i.profile = ?");
      args.push(query.profile);
    }
    if (query.from) {
      where.push("i.issue_date >= ?");
      args.push(query.from);
    }
    if (query.to) {
      where.push("i.issue_date <= ?");
      args.push(query.to);
    }
    if (query.account) {
      where.push("i.account_id = ?");
      args.push(query.account);
    }
    if (query.item) {
      where.push("EXISTS (SELECT 1 FROM invoice_lines l WHERE l.invoice_id = i.id AND l.item_id = ?)");
      args.push(query.item);
    }
    const needle = String(query.q || "").toLocaleLowerCase("tr-TR").trim();
    // 2.4.3 H3: sayfalı istekte (liste ucu) önce hafif sütunlar; ağır sütunlar yalnız sayfadaki satırlar için (aşağıda). Süzgeçler aynı.
    let rows = store.all(`${page ? LIST_SQL : INVOICE_SQL}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`, ...args);
    if (needle) {
      const lineHits = new Set(store.all("SELECT DISTINCT invoice_id AS id FROM invoice_lines WHERE lower(name) LIKE ? OR lower(code) LIKE ?", `%${needle}%`, `%${needle}%`).map(row => row.id));
      rows = rows.filter(row => lineHits.has(row.id) || `${row.number} ${row.accountName} ${parseJson(row.partyJson, {}).name || ""} ${row.accountTaxNo} ${row.note} ${row.orderNo} ${row.despatchNo} ${row.paperNo} ${row.ettn}`.toLocaleLowerCase("tr-TR").includes(needle));
    }
    const states = paymentStates(rows.filter(row => row.status === "issued"));
    // Sayfalı istekte ödeme durumu süzgeci, sıralama ve toplamlar hafif satırla (leanRow: shape() ile aynı değerler) yapılır; tam şekil
    // yalnız sayfadaki satırlar için kurulur (aşağıda). Sayfasız istek (PDF / Excel) eski yoldan: önce bütün satırlar şekillenir.
    let shaped;
    // 2.4.4 (E6, müşteri isteği "seçilenlerden gönderilebilir olanların sayısıyla"): numarasız bekleyenin KALICI gönderim engeli (seride daha yeni
    // numara / alıcı e-Fatura mükellefi) listede işaretlenir; ekranda "Seçilenleri Gönder (N)" sayısına girmez. Yalnız bekleyen satırlarda; seri
    // başına son numara bir kez okunur (lastOf).
    const lastCache = new Map();
    const lastOf = (key, read) => (lastCache.has(key) ? lastCache.get(key) : lastCache.set(key, read()).get(key));
    const eBlocked = row => edocEnabled && row.status === "issued" && row.eStatus === "waiting" && Boolean(sendBlockOf(row, lastOf) || buyerBlockOf(row));
    if (page) shaped = rows.map(row => leanRow(row, states.get(row.id), query.sort === "party"));
    else {
      const posCash = posCashSet(rows.filter(row => row.status === "issued").map(row => row.id));
      shaped = rows.map(row => ({ ...shape(row, states.get(row.id)), posCash: posCash.has(row.id), eBlocked: eBlocked(row) }));
    }
    if (query.pay) shaped = shaped.filter(row => (query.pay === "open" ? ["open", "partial", "overdue", "installment"].includes(row.payState) : query.pay === "unpaid" ? row.payState === "open" : row.payState === query.pay));
    const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
    const compare = {
      date: (a, b) => (a.issueDate === b.issueDate ? (a.issueTime === b.issueTime ? (a.createdAt < b.createdAt ? 1 : -1) : a.issueTime < b.issueTime ? 1 : -1) : a.issueDate < b.issueDate ? 1 : -1),
      number: (a, b) => collator.compare(b.displayNo, a.displayNo),
      amount: (a, b) => b.tryPayable - a.tryPayable,
      party: (a, b) => collator.compare(a.accountName, b.accountName),
    }[query.sort];
    shaped.sort(compare);
    let invoices = shaped;
    if (page) {
      const chosen = shaped.slice(page.offset, page.offset + page.limit);
      const full = new Map(store.all(`${INVOICE_SQL} WHERE i.id IN (SELECT value FROM json_each(?))`, JSON.stringify(chosen.map(item => item.id))).map(row => [row.id, row]));
      const posCash = posCashSet(chosen.filter(item => item.status === "issued").map(item => item.id));
      invoices = chosen.map(item => ({ ...shape(full.get(item.id), states.get(item.id)), posCash: posCash.has(item.id), eBlocked: eBlocked(full.get(item.id)) }));
    }
    // Toplamlar yalnız kesilmiş faturalardan (taslak ve iptal hariç); iade faturaları ters işaretle.
    const totals = { count: shaped.length, issued: 0, sale: 0, purchase: 0, net: 0, vat: 0, payable: 0, open: 0, overdue: 0 };
    for (const row of shaped) {
      if (row.status !== "issued") continue;
      const sign = INVOICE_KINDS[row.kind].return ? -1 : 1;
      totals.issued += 1;
      totals.net = roundMoney(totals.net + sign * row.tryNet);
      totals.vat = roundMoney(totals.vat + sign * row.tryVat);
      totals.payable = roundMoney(totals.payable + sign * row.tryPayable);
      if (INVOICE_KINDS[row.kind].side === "sale") totals.sale = roundMoney(totals.sale + sign * row.tryPayable);
      else totals.purchase = roundMoney(totals.purchase + sign * row.tryPayable);
      totals.open = roundMoney(totals.open + (row.open || 0));
      if (row.payState === "overdue") totals.overdue = roundMoney(totals.overdue + (row.open || 0));
    }
    const out = { invoices, totals, tabCounts: tabCounts(query.account), canManage: canUser(user, "invoices.manage") };
    // Gözden geçirme 2.4.3 (S2): "Tümünü Gönder" düğmesinin sayısı Gönderilecekler'in tamamı (sekme sayısı; cari süzgecinden bağımsız — sunucu
    // bütün bekleyenleri eski tarihliden başlayarak gönderir).
    if (query.tab === "pending") out.pendingTotal = query.account ? tabCounts("").pending : out.tabCounts.pending;
    if (page) out.total = shaped.length;
    return out;
  }
  // Sekme sayıları (cari kartından açıldıysa o carininkiler).
  function tabCounts(accountId = "") {
    const unsent = unsentSql();
    const rows = store.all(`SELECT i.kind, i.status, i.e_status AS eStatus, CASE WHEN ${unsent.sql} THEN 1 ELSE 0 END AS unsent, COUNT(*) AS n FROM invoices i${accountId ? " WHERE i.account_id = ?" : ""} GROUP BY 1, 2, 3, 4`, ...unsent.args, ...(accountId ? [accountId] : []));
    const out = Object.fromEntries(Object.keys(TABS).map(key => [key, 0]));
    for (const row of rows) {
      out.all += row.n;
      for (const [key, tab] of Object.entries(TABS)) if (key !== "all" && (!tab.kinds || tab.kinds.includes(row.kind)) && (!tab.status || tab.status === row.status) && (!tab.eStatus || tab.eStatus === row.eStatus) && (!tab.unsent || row.unsent === 1)) out[key] += row.n;
    }
    return out;
  }
  // Gönderilecekler: "Kes, Sonra Gönder" ile numarasız bekleyen ya da numara almış ama entegratöre ulaşmamış (Gönderilmedi, Sonucu Belirsiz, Hata) kendi
  // e-Belgemiz. Kâğıt belge / Müşteri Fişi ve listeden silinen (withdrawn) girmez; canlı ortamda test serisinden numara almış belge gönderilemeyeceği
  // için girmez (iptal edilir).
  // 2.4.4 madde 22: tür/profil koşulu sendKind'ın SQL karşılığı (e-SMM: yalnız açıkken, ESMM profilli makbuz).
  function unsentSql() {
    const sendKinds = Object.entries(INVOICE_KINDS).filter(([, value]) => value.send).map(([key]) => key);
    const live = edocEnabled && liveEnv(settings());
    const testSeries = [...TEST_SERIES_SET];
    const kinds = `(i.kind IN (${sendKinds.map(() => "?").join(", ")})${esmmEnabled ? " OR (i.kind = 'smm' AND i.profile = 'ESMM')" : ""})`;
    return {
      sql: `(i.status = 'issued' AND (i.e_status = 'waiting' OR (COALESCE(i.e_status, '') IN ('', 'none', 'error') AND i.profile <> 'KAGIT' AND COALESCE(i.number, '') <> '' AND ${kinds}${live ? ` AND i.series NOT IN (${testSeries.map(() => "?").join(", ")})` : ""})))`,
      args: [...sendKinds, ...(live ? testSeries : [])],
    };
  }

  // ---------- Girdi ----------
  const accountOf = id => {
    const service = accounts();
    if (!id) fail400("Faturanın carisini seçin.", "accountId");
    if (!service?.exists?.(id)) fail400("Seçilen cari bulunamadı; silinmiş olabilir.", "accountId");
    return service.accountRow(id);
  };
  const numberOf = (value, label, field, { min = 0, max = 1e12 } = {}) => {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const number = typeof value === "number" ? value : parseAmount(value);
    if (!Number.isFinite(number) || number < min || number > max) fail400(`${label} geçerli bir sayı olmalı.`, field);
    return number;
  };
  const qtyOf = (value, at) => {
    const qty = typeof value === "number" ? value : parseQty(value);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1e9) fail400(`${at}: miktar sıfırdan büyük olmalı.`, "qty");
    return Math.round(qty * 1000) / 1000;
  };
  // Belge türü (profil). Kendi kestiğimiz belgede GİB kuralı (VUK 509 Sıra No'lu Tebliğ):
  //   alıcı e-Fatura mükellefi ve biz e-Fatura kullanıcısıysak  → e-Fatura (Temel ya da Ticari; seçilebilir)
  //   alıcı e-Fatura mükellefi değilse ve biz e-Arşiv kullanıcısıysak → e-Arşiv
  //   aksi hâlde                                                 → kâğıt fatura
  // Kullanıcı türü değiştirebilir; yasal olmayan seçim nedeni söylenerek engellenir (alıcı e-Fatura mükellefiyken e-Arşiv
  // kesilmez; e-Arşiv kullanıcısı kâğıt fatura kesmez). Karşı tarafın belgesinde (alış, müşterinin iade faturası) tür
  // bize nasıl geldiğidir (bilgi).
  const allowedProfiles = (kind, account, s) => {
    if (!edocEnabled) return ["KAGIT"];
    if (kind === "smm") return esmmEnabled && s.esmm ? ["ESMM"] : ["KAGIT"];
    if (!INVOICE_KINDS[kind].own) return ["KAGIT", "EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"];
    if (!s.efatura) return ["KAGIT"];
    // Dar kontrol 2 (MM2, mali müşavir): kendi kestiğimiz iade belgesi (Alıştan İade) e-Faturada yalnız TEMELFATURA olur — GİB UBL-TR Common
    // şematronu: fatura tipi IADE iken profil TICARIFATURA olamaz. Ticari profilli tedarikçiye iade önceden TICARIFATURA + IADE kesiliyor, EDM/GİB
    // reddediyor ve numara harcanıyordu.
    if (Number(account.eInvoice) === 1) return INVOICE_KINDS[kind].return ? ["TEMELFATURA"] : ["TEMELFATURA", "TICARIFATURA"];
    return s.earsiv ? ["EARSIVFATURA"] : ["KAGIT"];
  };
  function profileFor(kind, account, requested, s) {
    // 2.4.1 (gözden geçirme G1): e-SMM kapalıyken 2.4.0'dan kalan taslağın / formun "ESMM" isteği kâğıt makbuz sayılır (gizli işareti isteyen 400 yok).
    if (kind === "smm" && requested === "ESMM" && !(esmmEnabled && s.esmm)) requested = "";
    // MM2: iade belgesinde Ticari Fatura isteği (formda kalan seçim; eski sürümde kesilmiş iadenin Düzenle'si) Temel Fatura sayılır — aynı seri.
    if (INVOICE_KINDS[kind]?.return && requested === "TICARIFATURA") requested = "TEMELFATURA";
    const allowed = allowedProfiles(kind, account, s);
    const auto = kind === "smm" || !INVOICE_KINDS[kind].own ? allowed[0] : allowed.includes("TEMELFATURA") ? (allowed.includes(account.eProfile) ? account.eProfile : allowed.includes(s.defaults.efaturaProfile) ? s.defaults.efaturaProfile : "TEMELFATURA") : allowed[0];
    if (!requested || !PROFILES[requested]) return auto;
    if (allowed.includes(requested)) return requested;
    const efatura = Number(account.eInvoice) === 1;
    let reason;
    if (kind === "smm") reason = requested === "ESMM" ? "e-SMM için Fatura Ayarları'nda e-SMM kullanıcısı olduğunuzu işaretleyin." : "e-SMM kullanıcısı kâğıt serbest meslek makbuzu düzenlemez.";
    else if (!s.efatura) reason = "e-Fatura / e-Arşiv için Fatura Ayarları'nda e-Fatura mükellefi olduğunuzu işaretleyin (entegratör bilgileriyle).";
    else if (efatura && requested === "EARSIVFATURA") reason = "Alıcı e-Fatura mükellefi: GİB kuralı gereği e-Arşiv değil e-Fatura kesilir. Mükellefiyet bilgisi yanlışsa cari kartında Mükellef Sorgula ile yenileyin.";
    else if (efatura && requested === "KAGIT") reason = "Alıcı e-Fatura mükellefi: kâğıt fatura kesilmez, e-Fatura kesilir.";
    else if (!efatura && (requested === "TEMELFATURA" || requested === "TICARIFATURA")) reason = "Alıcı e-Fatura mükellefi değil: e-Fatura gönderilemez. Mükellef ise cari kartında Mükellef Sorgula ile işaretleyin.";
    else if (requested === "KAGIT" && s.earsiv) reason = "e-Arşiv kullanıcısı e-Fatura mükellefi olmayan alıcıya kâğıt değil e-Arşiv fatura keser.";
    else if (requested === "EARSIVFATURA") reason = "e-Arşiv için Fatura Ayarları'nda e-Arşiv kullanıcısı olduğunuzu işaretleyin.";
    else reason = "Bu belge türü bu alıcıya kesilemez.";
    fail400(reason, "profile", { code: "profile-not-allowed", allowed });
  }
  // 2.4.3 (kullanıcı denemesi 17.10.2026, TESTER): numara almış e-Belgenin türü düzenlemede değişmez — numara serisi türe bağlıdır (e-Fatura TEF /
  // e-Arşiv TEA). Cari kartında e-Fatura işareti kaldırılınca Düzenle'de "e-Arşiv" seçilebiliyor, belge TEF numarasıyla e-Arşiv oluyordu. Temel ↔
  // Ticari aynı seridir (serbest). Kâğıt belge (2.4.3 öncesi kural sürer) ve numarasız belge (Kes, Sonra Gönder: numara gönderimde) bu kurala girmez.
  const PROFILE_GROUP = { TEMELFATURA: "efatura", TICARIFATURA: "efatura", EARSIVFATURA: "earsiv", ESMM: "esmm" };
  // Gözden geçirme 2.4.3 (B2): kâğıt (FIS) numaralı belge de Düzenle'de e-Belge türüne geçemez — FIS numarasıyla e-Arşiv/e-Fatura EDM'ye gidiyordu.
  // Gönderilecekler'den silinmiş (withdrawn) belge istisna: gönderimde e-Belge serisinden yeni numara alır.
  function profileLock(kind, account, existing, body, s) {
    if (!existing || existing.status === "draft" || !(Number(existing.seq) > 0)) return;
    const requested = text(body.profile) || existing.profile;
    if (existing.profile === "KAGIT") {
      if (!PROFILE_GROUP[requested] || existing.eStatus === "withdrawn") return;
    } else if (!PROFILE_GROUP[existing.profile]) return;
    const allowed = allowedProfiles(kind, account, s);
    const moved = PROFILE_GROUP[requested] !== PROFILE_GROUP[existing.profile];
    // MM2: eski sürümde Ticari Fatura olarak kesilmiş iade Düzenle'de Temel Fatura olur (aynı seri; profileFor).
    if (!moved && (allowed.includes(existing.profile) || (INVOICE_KINDS[kind]?.return && existing.profile === "TICARIFATURA" && allowed.includes("TEMELFATURA")))) return;
    // B4: neden doğru söylenir — e-Belge işaretleri kapalıysa ayar, değilse carinin mükellefiyeti.
    const why = moved ? "" : allowed.every(item => item === "KAGIT") ? " Fatura Ayarları'nda e-Fatura / e-Arşiv işaretleri kapalı; belge bu türle kalamaz." : " Cari kartındaki e-Fatura mükellefiyeti değişmiş; belge bu türle kalamaz.";
    throw new HttpError(409, `${existing.number} ${PROFILES[existing.profile]} olarak numara aldı; belge türü düzenlemede değişmez (numara serisi belge türüne bağlıdır).${why} Belgeyi İptal Et ile iptal edip Kopyala ile yeniden kesin: yeni belge doğru türden numara alır.`, { code: "profile-locked", profile: existing.profile });
  }
  // 2.4.3: e-Fatura alıcısının posta kutusu bilinmiyorsa belge numara almadan durur (önceden "Kaydet ve Gönder" numarayı verip gönderimde düşüyordu).
  const aliasMissing = doc => edocEnabled && ["TEMELFATURA", "TICARIFATURA"].includes(doc.profile) && !["purchase", "sale_return"].includes(doc.kind) && !String(doc.party?.eAlias || "").trim();
  const ALIAS_HINT = "Cari kartında Mükellef Sorgula'ya basın: alıcı mükellefse posta kutusunu seçin; mükellef değilse e-Fatura işareti kalkar ve fatura e-Arşiv olarak kesilir.";
  const aliasBlockText = () => `Alıcının e-Fatura posta kutusu (PK) seçilmemiş; fatura kaydedilmedi, numara harcanmadı. ${ALIAS_HINT} Sonra faturayı yeniden kaydedin.`;
  function assertAliasBeforeNumber(doc, body) {
    if (body?.eSend === "later" || !aliasMissing(doc)) return;
    throw new HttpError(409, aliasBlockText(), { code: "buyer-alias" });
  }
  const partySnapshot = (account, override = null) => {
    const party = {
      id: account.id,
      name: account.name,
      partyKind: account.partyKind || (classifyTaxId(account.taxNo).kind === "tckn" ? "person" : account.taxNo ? "company" : "person"),
      firstName: account.firstName || "",
      familyName: account.familyName || "",
      taxNo: account.taxNo || "",
      taxOffice: account.taxOffice || "",
      mersisNo: account.mersisNo || "",
      tradeRegistry: account.tradeRegistry || "",
      address: account.address || "",
      district: account.district || "",
      city: account.city || "",
      postalCode: account.postalCode || "",
      country: account.country || "Türkiye",
      phone: account.phone || "",
      email: account.email || "",
      website: account.website || "",
      iban: account.iban || "",
      eInvoice: Number(account.eInvoice) === 1,
      eAlias: account.eAlias || "",
    };
    // Nihai tüketici (kimliksiz perakende carisi): alıcının adı/kimliği faturada ayrıca yazılabilir.
    if (override && typeof override === "object" && (!account.taxNo || account.taxNo === ANONYMOUS_TCKN)) {
      for (const key of ["name", "taxNo", "address", "district", "city", "phone", "email"]) {
        const value = limited(override[key], key === "address" ? 500 : 200, "Alıcı");
        if (value) party[key] = key === "taxNo" ? value.replace(/\s+/g, "") : value;
      }
      if (party.taxNo) {
        const id = classifyTaxId(party.taxNo, { allowAnonymous: true });
        if (!id.ok) fail400("Alıcının VKN/TCKN'si geçersiz.", "buyer.taxNo");
        party.partyKind = id.kind === "vkn" ? "company" : "person";
      }
    }
    if (party.partyKind === "person" && (!party.firstName || !party.familyName)) {
      const split = splitPersonName(party.name);
      party.firstName = party.firstName || split.firstName;
      party.familyName = party.familyName || split.familyName;
    }
    return party;
  };

  /**
   * İstek gövdesinden belge. mode: "draft" (eksik ödeme ve stok denetimi yok) ya da "issue".
   * Dönüş: { kind, scenario, account, party, date, time, profile, currency, rate, … lines, computed, money }.
   */
  // MM1: iade belgesinin e-Belge referansı. Asıl faturanın numarası 16 karakterse boş (asıl numara kullanılır; davranış değişmez). Değilse
  // kullanıcının yazdığı (onayladığı) değer: boşluklar atılır, büyük harf; biçimi issueBlockers / preflight denetler.
  function returnRefOf(meta, original, body, existing) {
    if (!meta.return || !original || String(original.number || "").trim().length === 16) return "";
    return limited(String(body.returnRef ?? existing?.returnRef ?? "").replace(/\s+/g, "").toUpperCase(), 40, "İade Edilen Belge No");
  }
  // exceptReturnId (2.4.3, uzman UX2): ön hesapta (calc) düzenlenen iade belgesinin kimliği — iadenin kendi miktarı "önce iade edilen"e sayılmaz
  // (kayıt yolu existing ile aynısını yapar). Yalnız aynı asıl faturanın kayıtlı iadesiyse kullanılır (calc ucunda denetlenir).
  function documentInput(body, { mode = "issue", existing = null, fromBank = false, exceptReturnId = "" } = {}) {
    const s = settings();
    const scenario = SCENARIOS[text(body.scenario)] ? text(body.scenario) : existing?.scenario || "";
    const kind = INVOICE_KINDS[text(body.kind)] ? text(body.kind) : SCENARIOS[scenario]?.kind || existing?.kind || "";
    if (!INVOICE_KINDS[kind]) fail400("Fatura türünü seçin (satış, alış, iade ya da serbest meslek makbuzu).", "kind");
    if (scenario && SCENARIOS[scenario].kind !== kind) fail400("Seçilen senaryo bu fatura türüne uymuyor.", "scenario");
    const meta = INVOICE_KINDS[kind];
    // İade: asıl fatura zorunlu; cari, para birimi, kur ve fiyatlar asıl faturadan gelir.
    let original = null;
    if (meta.return) {
      const originalId = text(body.originalId) || existing?.originalId || "";
      if (!originalId) fail400("İade edilecek faturayı seçin (üstteki arama kutusundan).", "originalId");
      original = invoiceRow(originalId);
      if (original.kind !== meta.of) fail400(`${meta.label} yalnız ${INVOICE_KINDS[meta.of].label.toLocaleLowerCase("tr-TR")} için kaydedilir.`, "originalId");
      if (original.status !== "issued") fail400("İptal edilmiş ya da taslak faturanın iadesi olmaz.", "originalId");
      if (original.eStatus === "waiting") fail400("Bu belge henüz entegratöre gönderilmedi (Gönderilecekler). İadeden önce gönderin ya da Müşteri Fişi olarak bırakın.", "originalId", { code: "invoice-waiting" });
      const fee = fromBank ? null : bankFeeOf(original.id);
      if (fee) throw new HttpError(409, bankFeeText(fee), { code: "invoice-bank-fee", eventNo: fee.no });
    }
    const account = accountOf(original ? original.accountId : text(body.accountId) || existing?.accountId || "");
    const date = text(body.issueDate ?? body.date ?? existing?.issueDate ?? today());
    if (!validDate(date)) fail400("Fatura tarihi geçerli bir tarih değil. Takvimden seçin.", "issueDate");
    if (mode === "issue" && date > today()) fail400(`İleri tarihli fatura kaydedilemez (${dayText(date)}). Taslak olarak kaydedin; günü gelince kaydedin.`, "issueDate", { code: "date-future" });
    if (original && date < original.issueDate) fail400(`İade tarihi, asıl faturanın tarihinden (${dayText(original.issueDate)}) önce olamaz.`, "issueDate", { code: "return-before-original" });
    const time = text(body.issueTime ?? existing?.issueTime ?? "") || nowTime();
    if (!TIME.test(time)) fail400("Fatura saati SS:DD biçiminde olmalı (ör. 14:30).", "issueTime");
    // 2.4.1 (G1/G2): 2.4.0'da e-SMM serisinden numara almış makbuz düzenlenirken türü korunur (numarası TES/ESM; kâğıt belgeye geçmez, gönderilemez — 2.4.0'daki gibi).
    // Dar kontrol B1: bayrak açıkken işaret sonradan kaldırılsa da aynı kural (numaralı e-SMM makbuzu kâğıda dönmez).
    const legacyEsmm = kind === "smm" && existing && existing.status !== "draft" && existing.profile === "ESMM";
    if (!legacyEsmm && meta.own) profileLock(kind, account, existing, body, s);
    const profile = legacyEsmm ? "ESMM" : original && !meta.own ? profileFor(kind, account, text(body.profile) || "KAGIT", s) : profileFor(kind, account, text(body.profile ?? (existing && existing.status === "draft" ? "" : existing?.profile) ?? ""), s);
    const currency = original ? original.currency : CURRENCIES[text(body.currency)] ? text(body.currency) : existing?.currency || "TRY";
    let rate = 1;
    if (original) rate = Number(original.rate) || 1;
    else if (currency !== "TRY") {
      rate = numberOf(body.rate ?? existing?.rate, "Döviz kuru", "rate", { min: 0.000001, max: 1e6 });
      if (!(rate > 0)) fail400(`${CURRENCIES[currency].label} kurunu yazın (1 ${currency} kaç TL).`, "rate");
      rate = Math.round(rate * 1e6) / 1e6;
    }
    const pricesIncludeVat = original ? Boolean(original.pricesIncludeVat) : body.pricesIncludeVat === undefined ? (existing ? Boolean(existing.pricesIncludeVat) : s.defaults.pricesIncludeVat) : body.pricesIncludeVat === true;
    const discountRate = original ? Number(original.discountRate) || 0 : numberOf(body.discountRate ?? existing?.discountRate, "Genel iskonto", "discountRate", { min: 0, max: 99.99 }) || 0;
    // Stopaj: SMM'de alıcı tüzel kişiyse (vergi sorumlusu) varsayılan %20; gerçek kişiye (nihai tüketici) stopajsız.
    // Alışta (bize kesilen serbest meslek makbuzu / kira) alıcı biz olduğumuz için kesen biziz: 360'a yazılır.
    let stoppageRate = 0;
    if (original) stoppageRate = Number(original.stoppageRate) || 0;
    else if (kind === "smm" || kind === "purchase") {
      const given = numberOf(body.stoppageRate ?? existing?.stoppageRate, "Stopaj oranı", "stoppageRate", { min: 0, max: 40 });
      stoppageRate = given ?? (kind === "smm" && account.partyKind !== "person" && classifyTaxId(account.taxNo).kind !== "tckn" ? s.defaults.stoppageRate : 0);
    }
    const lines = linesInput(kind, Array.isArray(body.lines) ? body.lines : [], { original, s, existingId: existing?.id || exceptReturnId || "" });
    let computed;
    try {
      computed = computeInvoice(lines, { pricesIncludeVat, discountRate, stoppageRate });
    } catch (error) {
      if (error instanceof InvoiceInputError) fail400(error.message, error.field);
      throw error;
    }
    const money = toTry(computed.totals, rate);
    const note = limited(body.note ?? existing?.note ?? "", 2000, "Not");
    const dateField = (value, label, field) => {
      const v = text(value);
      if (v && !validDate(v)) fail400(`${label} geçerli bir tarih değil.`, field);
      return v;
    };
    const party = partySnapshot(account, body.buyer || (existing ? parseJson(existing.partyJson, null) : null));
    const number = !meta.own ? limited(body.number ?? existing?.number ?? "", 40, "Fatura No").toLocaleUpperCase("tr-TR") : "";
    return {
      kind,
      scenario: scenario || (kind === "sale" ? (lines.some(line => line.goods) ? "goods_sale" : "service_sale") : kind === "purchase" ? (lines.some(line => line.goods) ? "goods_purchase" : "expense_purchase") : kind),
      meta,
      account,
      party,
      original,
      date,
      time,
      profile,
      currency,
      rate,
      pricesIncludeVat,
      discountRate,
      stoppageRate,
      note,
      number,
      orderNo: limited(body.orderNo ?? existing?.orderNo ?? "", 60, "Sipariş No"),
      orderDate: dateField(body.orderDate ?? existing?.orderDate, "Sipariş tarihi", "orderDate"),
      despatchNo: limited(body.despatchNo ?? existing?.despatchNo ?? "", 60, "İrsaliye No"),
      // Elle kesilen matbu (kâğıt) faturanın seri/numarası (varsa): program fişi yasal faturayla eşleşir.
      paperNo: limited(body.paperNo ?? existing?.paperNo ?? "", 40, "Kâğıt Fatura No"),
      returnRef: returnRefOf(meta, original, body, existing),
      despatchDate: dateField(body.despatchDate ?? existing?.despatchDate, "İrsaliye tarihi", "despatchDate"),
      lines,
      computed,
      money,
      settings: s,
    };
  }

  function linesInput(kind, raw, { original, s, existingId = "" }) {
    if (!raw.length) fail400("Faturaya en az bir kalem ekleyin.", "lines");
    if (raw.length > MAX_LINES) fail400(`Bir faturada en çok ${MAX_LINES} kalem olabilir.`, "lines");
    const meta = INVOICE_KINDS[kind];
    if (meta.return) {
      const originLines = new Map(linesOf(original.id).map(line => [line.id, line]));
      const returned = returnedQty([...originLines.keys()], existingId);
      const seen = new Set();
      return raw.map((item, index) => {
        const at = `${index + 1}. kalem`;
        const origin = originLines.get(text(item?.originLineId));
        if (!origin) fail400(`${at} asıl faturada yok; iade kalemleri asıl faturadan seçilir.`, "lines");
        if (seen.has(origin.id)) fail400(`${at}: aynı kalem iki kez iade edilemez; miktarı tek satırda yazın.`, "lines");
        seen.add(origin.id);
        const qty = qtyOf(item.qty, at);
        const left = Math.round((origin.qty - (returned.get(origin.id) || 0)) * 1000) / 1000;
        if (qty > left + 1e-9) fail400(`${at} (${origin.name}): en çok ${String(left).replace(".", ",")} ${origin.unit} iade edilebilir (faturada ${String(origin.qty).replace(".", ",")}, önce iade edilen ${String(returned.get(origin.id) || 0).replace(".", ",")}).`, "qty", { code: "return-exceeds" });
        return {
          originLineId: origin.id,
          itemId: origin.itemId,
          goods: Boolean(origin.goods),
          code: origin.code,
          name: origin.name,
          description: origin.description,
          serialNo: origin.serialNo,
          lotNo: origin.lotNo,
          unit: origin.unit,
          qty,
          unitPrice: origin.unitPrice,
          discountRate: origin.discountRate,
          vatRate: origin.vatRate,
          withholdingCode: origin.withholdingCode,
          exemptionCode: origin.exemptionCode,
          expenseCode: origin.expenseCode,
          account: kind === "sale_return" ? "610" : origin.glAccount,
        };
      });
    }
    return raw.map((item, index) => {
      const at = `${index + 1}. kalem`;
      if (!item || typeof item !== "object") fail400(`${at} okunamadı.`, "lines");
      const itemId = text(item.itemId);
      const stockItem = itemId ? stock()?.invoiceStock?.itemFor(itemId) : null;
      if (itemId && !stockItem) fail400(`${at}: ürün bulunamadı.`, "lines");
      // v2.0.16 (müşteri): alışta stokta olmayan mal için "+ Yeni Stok Kartı" — kart faturanın kaydıyla aynı işlemde açılır.
      const create = !stockItem && item.newItem === true && kind === "purchase" ? { code: limited(item.code, 60, "Stok Kodu"), salePrice: Math.max(0, Number(item.newSalePrice) || 0) } : null;
      const goods = Boolean(create) || Boolean(stockItem && stockItem.kind !== "service");
      if (kind === "smm" && goods) fail400(`${at}: serbest meslek makbuzunda stoklu ürün olmaz; hizmet kalemi yazın.`, "lines");
      const name = limited(item.name || stockItem?.name || "", 200, "Kalem adı");
      if (!name) fail400(`${at}: kalemin adını yazın ya da stoktan ürün seçin.`, "lines");
      const purchaseSide = INVOICE_KINDS[kind].side === "purchase";
      const expenseCode = purchaseSide && !goods ? (EXPENSES[text(item.expenseCode)] ? text(item.expenseCode) : "other") : "";
      const unitPrice = numberOf(item.unitPrice, `${at} birim fiyatı`, "unitPrice", { min: 0, max: 1e12 });
      if (unitPrice === null) fail400(`${at}: birim fiyatı yazın.`, "unitPrice");
      const vatRate = item.vatRate === undefined || item.vatRate === "" || item.vatRate === null ? s.defaults.vatRate : Number(item.vatRate);
      return {
        originLineId: "",
        itemId: stockItem?.id || "",
        goods,
        // Stoklu kalemde Stok Kodu kartın kodudur (yazılan "fk-a4" değil kayıtlı "FK-A4"); stoksuzda yazılan.
        code: limited(stockItem ? stockItem.code || item.code || "" : item.code || "", 60, "Stok Kodu"),
        name,
        description: limited(item.description, 300, "Açıklama"),
        // İz 7.4 (isteğe bağlı): Seri No / Lot No — yalnız belgede (e-Belge cac:ItemInstance, PDF); stokta izlenmez.
        serialNo: limited(item.serialNo, 60, "Seri No"),
        lotNo: limited(item.lotNo, 60, "Lot No"),
        unit: unitLabel(limited(item.unit || stockItem?.unit || "Adet", 20, "Birim")),
        qty: qtyOf(item.qty, at),
        unitPrice: Math.round(unitPrice * 10000) / 10000,
        discountRate: numberOf(item.discountRate, `${at} iskontosu`, "discountRate", { min: 0, max: 100 }) || 0,
        vatRate,
        withholdingCode: text(item.withholdingCode),
        exemptionCode: text(item.exemptionCode),
        expenseCode,
        account: lineAccount(kind, { goods, expenseCode }),
        create,
      };
    });
  }
  // Yeni stok kartları (alış): kalem stoğa bağlanır; aynı ad ve birimde kart varsa o kullanılır. Yazma işleminin içinde.
  function ensureNewItems(user, doc, invoiceId, touched) {
    for (const input of doc.lines) {
      if (!input.create || input.itemId) continue;
      // 2.4.3 (H8): faturadan açılan kart kalemin KDV oranını alır (sonraki faturada önerilir).
      const made = stock().invoiceStock.createFor(user, { name: input.name, unit: input.unit, code: input.code, salePrice: input.create.salePrice, vatRate: input.vatRate, invoiceId });
      input.itemId = made.id;
      input.create = null;
      touched?.items.add(made.id);
    }
  }

  // Ödeme: { cash: [{ amount, method }], cheques: [{ instrument, amount, dueDate, serialNo, bank }], endorse: [chequeId],
  //          rest: 'open' | 'installments', dueDate, installments: { count, firstDue, everyMonths } }
  // v2.1.0 Aşama 7 (plan §3.7 #4, §3.8): peşin satırın banka hesabı. Her peşin satır bir satır anahtarı (lineKey) taşır; Düzenle'de eski satırla
  // anahtardan eşlenir (satır sırası değişse ya da biri silinse de doğru satır). previous: Map(lineKey → { method, amount, date, finRef }).
  const banking = bankForm(bankModule);
  const LINE_KEY = /^[A-Za-z0-9_-]{1,40}$/;
  function paymentInput(body, doc, user, { previous = null } = {}) {
    const p = body.payment && typeof body.payment === "object" ? body.payment : {};
    const kind = doc.kind;
    const payable = c2(doc.money.payable);
    const amount = (value, label, field) => {
      const n = numberOf(value, label, field, { min: 0, max: 1e12 });
      return n === null ? 0 : roundMoney(n);
    };
    const cashList = (Array.isArray(p.cash) ? p.cash : p.cash && typeof p.cash === "object" ? [p.cash] : [])
      .slice(0, 3)
      .map((item, index) => ({ amount: amount(item?.amount, "Peşin tutar", "payment.cash"), method: methodInput(item?.method), lineKey: LINE_KEY.test(text(item?.lineKey)) ? text(item.lineKey) : `i${index}`, given: LINE_KEY.test(text(item?.lineKey)), bankAccountId: item?.bankAccountId === undefined || item?.bankAccountId === null ? undefined : text(item.bankAccountId).slice(0, 120), posId: item?.posId === undefined || item?.posId === null ? undefined : text(item.posId).slice(0, 120), pos: posMetaOf(item || {}), index }))
      .filter(item => item.amount > 0);
    // Yargıç K4: istemcinin verdiği satır anahtarı tekil olmalı (Düzenle'de olay eşleşmesi anahtarla); yinelenen anahtar 400. Anahtarsız satıra
    // (eski istemci) sunucunun verdiği i<n> başka satırın anahtarıyla çakışırsa tekilleştirilir.
    const given = new Set();
    for (const item of cashList.filter(row => row.given)) {
      if (given.has(item.lineKey)) fail400(`Peşin satırların satır anahtarı (lineKey) tekil olmalı: "${item.lineKey}" iki kez gönderildi.`, "payment.cash", { code: "line-key-duplicate", line: item.index });
      given.add(item.lineKey);
    }
    const keys = new Set();
    for (const item of cashList) {
      if (keys.has(item.lineKey) || (!item.given && given.has(item.lineKey))) item.lineKey = `${item.lineKey}-${item.index}`;
      keys.add(item.lineKey);
      delete item.given;
      const prev = previous?.get(item.lineKey) || null;
      const changed = !prev || prev.method !== item.method || Math.abs(Number(prev.amount) - item.amount) > 0.004 || prev.date !== doc.date;
      try {
        // K2 (plan §3.7 #5, §4.6): alış tarafında (alış faturası, alıştan iade) kart yolu kurumsal kartla ödeme / kurumsal karta iadedir (309);
        // satış tarafında POS (2.2.0).
        // 2.2.0: satış tarafında kart yolu POS'tur (posId, taksit sayısı, provizyon); satıştan iadede POS İadesi (asıl faturanın POS satışı).
        item.finRef = banking.ref({ method: item.method, value: item.bankAccountId, date: doc.date, previous: prev, changed, corporate: INVOICE_KINDS[kind]?.side === "purchase", posId: item.posId, posRefundOf: item.pos?.refundOf || "" });
      } catch (error) {
        if (error?.extra?.code !== "bank-account-required") throw error;
        const card = item.method === "card";
        throw new HttpError(400, card ? `Kredi kartı seçilmedi: ${item.index + 1}. peşin satır kredi kartı; hangi kredi kartından ödendiğini (ya da iadenin hangi karta geldiğini) seçin.` : `Banka hesabı seçilmedi: ${item.index + 1}. peşin satır havale/EFT; hangi hesaba girdiğini ya da hangi hesaptan çıktığını seçin.`, { ...error.extra, field: `payment.cash.${item.index}.bankAccountId`, line: item.index });
      }
      if (!inflow(kind) && item.finRef && item.finRef !== (prev?.finRef || "")) banking.requireOut(user, true, item.finRef);
      delete item.index;
      delete item.bankAccountId;
      if (!item.finRef || item.method !== "card") delete item.pos;
      delete item.posId;
    }
    const chequeAllowed = ["sale", "smm", "purchase"].includes(kind);
    const chequeList = (Array.isArray(p.cheques) ? p.cheques : []).slice(0, 20).map((item, index) => {
      if (!chequeAllowed) fail400("İade faturasında çek/senet alınmaz ya da verilmez; iade Kasa'dan ya da cariden mahsupla yapılır.", "payment.cheques");
      const value = amount(item?.amount, `${index + 1}. evrak tutarı`, "payment.cheques");
      if (!(value > 0)) fail400(`${index + 1}. evrakın tutarını yazın.`, "payment.cheques");
      const dueDate = text(item?.dueDate);
      if (!validDate(dueDate)) fail400(`${index + 1}. evrakın vade tarihini seçin.`, "payment.cheques");
      if (dueDate < doc.date) fail400(`${index + 1}. evrakın vadesi (${dayText(dueDate)}) fatura tarihinden (${dayText(doc.date)}) önce olamaz.`, "payment.cheques", { code: "cheque-due-before-issue" });
      // v2.2.0 (İz 2.5): alış faturasında verilen çekin Çek Hesabı / senedin ödeme hesabı önerisi (kural çek modülünde: lib routes/cheques.mjs
      // chequeAccountOf). Satış (alınan) evrakında hesap seçilmez.
      const accountId = text(item?.bankAccountId);
      if (accountId && kind !== "purchase") fail400(`${index + 1}. evrak: alınan (müşteri) çek/senette banka hesabı seçilmez; müşterinin bankası “Banka / Şube”ye yazılır.`, "payment.cheques", { code: "bank-account-invalid" });
      return { instrument: text(item?.instrument) === "note" ? "note" : "cheque", amount: value, dueDate, serialNo: limited(item?.serialNo, 60, "Seri No"), bank: limited(item?.bank, 120, "Banka / Şube"), drawer: limited(item?.drawer, 160, "Keşideci"), ...(accountId ? { bankAccountId: accountId } : {}) };
    });
    const endorseIds = kind === "purchase" ? [...new Set((Array.isArray(p.endorse) ? p.endorse : []).map(value => text(value)).filter(Boolean))].slice(0, 20) : [];
    if (!["purchase"].includes(kind) && Array.isArray(p.endorse) && p.endorse.length) fail400("Çek cirosu yalnız alış faturasının ödemesinde kullanılır.", "payment.endorse");
    const endorse = endorseIds.map(id => {
      const cheque = store.get("SELECT id, amount, status, direction, issue_date AS issueDate, account_id AS accountId, serial_no AS serialNo FROM cheques WHERE id = ? AND deleted_at IS NULL", id);
      if (!cheque || cheque.direction !== "in" || cheque.status !== "portfolio") fail400("Ciro edilecek evrak portföyde değil (tahsil edilmiş, ciro edilmiş ya da silinmiş olabilir).", "payment.endorse", { code: "cheque-not-in-portfolio" });
      if (cheque.issueDate > doc.date) fail400(`Evrak${cheque.serialNo ? ` No ${cheque.serialNo}` : ""} fatura tarihinden sonra alınmış; ciro tarihi alış tarihinden önce olamaz.`, "payment.endorse", { code: "cheque-endorse-before-receive" });
      if (cheque.accountId === doc.account.id) fail400("Evrak, alındığı cariye ciro edilemez.", "payment.endorse");
      return { id: cheque.id, amount: roundMoney(cheque.amount) };
    });
    if ((chequeList.length || endorse.length) && !canUser(user, "cheques.manage")) throw new HttpError(403, "Çek/senetle ödeme için Çek / Senet İşlemleri yetkisi gerekir.");
    const paid = roundMoney([...cashList, ...chequeList, ...endorse].reduce((sum, item) => sum + item.amount, 0));
    if (paid > payable + 0.005) fail400(`Ödemeler (${moneyText(paid)}) faturanın ödenecek tutarını (${moneyText(payable)}) aşıyor.`, "payment", { code: "payment-exceeds" });
    const rest = roundMoney(payable - paid);
    let mode = "none";
    let installments = null;
    let dueDate = doc.date;
    if (rest > 0.005 && !doc.meta.return) {
      if (p.rest === "installments") {
        if (!["sale", "smm"].includes(kind)) fail400("Taksitlendirme yalnız satışta (müşteriden alacak) yapılır; alışta vade tarihi yazın.", "payment.rest");
        if (!canUser(user, "plans.manage")) throw new HttpError(403, "Satışı taksitlendirmek taksit yönetimi yetkisidir.");
        const count = Math.trunc(Number(p.installments?.count));
        if (!(count >= 1 && count <= 120)) fail400("Taksit sayısı 1 ile 120 arasında olmalı.", "payment.installments");
        const firstDue = text(p.installments?.firstDue);
        if (!validDate(firstDue)) fail400("İlk taksitin vadesini seçin.", "payment.installments");
        if (firstDue < doc.date) fail400(`İlk vade (${dayText(firstDue)}) fatura tarihinden (${dayText(doc.date)}) önce olamaz.`, "payment.installments", { code: "due-before-start" });
        const everyMonths = Math.min(12, Math.max(1, Math.trunc(Number(p.installments?.everyMonths) || 1)));
        mode = "installments";
        installments = { count, firstDue, everyMonths };
        dueDate = addMonths(firstDue, everyMonths * (count - 1));
      } else {
        mode = "open";
        const days = Number(doc.account.dueDays) || Number(doc.settings.defaults.dueDays) || 0;
        dueDate = text(p.dueDate) || (days ? isoDay(new Date(Date.parse(`${doc.date}T12:00:00`) + days * 86_400_000)) : doc.date);
        if (!validDate(dueDate)) fail400("Vade tarihi geçerli bir tarih değil.", "payment.dueDate");
        if (dueDate < doc.date) fail400(`Vade (${dayText(dueDate)}) fatura tarihinden (${dayText(doc.date)}) önce olamaz.`, "payment.dueDate", { code: "due-before-start" });
      }
    }
    if (doc.meta.return) mode = rest > 0.005 ? "offset" : "none";
    return { cash: cashList, cheques: chequeList, endorse, paid, rest, mode, installments, dueDate };
  }

  // ---------- Numara ----------
  // Canlı ortam açık ve seçili değilse e-Belge test serisinden numara alır (TEST_SERIES).
  const liveEnv = s => edocLive && s.integrator.env === "live";
  const seriesFor = (kind, profile, s) => {
    const own = liveEnv(s) ? s.series : { ...s.series, ...TEST_SERIES };
    if (kind === "smm") return profile === "ESMM" ? own.esmm : s.series.smm;
    if (profile === "EARSIVFATURA") return own.earsiv;
    if (profile === "TEMELFATURA" || profile === "TICARIFATURA") return own.efatura;
    return s.series.paper;
  };
  // 2.4.4 madde 22 ek (kâhin bulgusu, 22.10.2026): e-Belge olarak gönderilmeyen ("Gönderilecekler'den bırakılan") belge kâğıda döner ve KÂĞIT serisinden
  // numara alır — tek kaynak seriesFor(tür, KAGIT): serbest meslek makbuzu kâğıt makbuz serisinden (Fatura Ayarları → Serbest Meslek Makbuzu Serisi), öbür
  // türler Müşteri Fişi serisinden. Önceden her tür Müşteri Fişi (FIS) serisinden alıyordu: e-SMM makbuzu fiş numarasıyla kalıyordu.
  const paperSeriesOf = (kind, s) => seriesFor(kind, "KAGIT", s);
  // Ekrandaki ve iletilerdeki adı: makbuzda "kâğıt makbuz", faturada "Müşteri Fişi" (yazım düzeni: düğmede "Kâğıt Makbuz Olarak Bırak").
  const paperNameOf = kind => (kind === "smm" ? { name: "kâğıt makbuz", button: "Kâğıt Makbuz Olarak Bırak", number: "kâğıt makbuz numarasıyla" } : { name: "Müşteri Fişi", button: "Müşteri Fişi Olarak Bırak", number: "fiş numarasıyla" });
  function ensureTestStart(series, year, s) {
    const key = `${series}${year}`;
    if (!TEST_SERIES_SET.has(series) || Number(s.start?.[key]) >= 1) return;
    const seq = Math.trunc(Number(testSeriesStart())) || 1;
    if (seq <= 1) return; // 1'den başlamak başlangıç yazılmamasıyla aynıdır (testlerin sabit başlangıcı)
    const raw = parseJson(store.setting(SETTINGS_KEY, "{}"), {}) || {};
    raw.start = { ...(raw.start || {}), [key]: seq };
    store.setSetting(SETTINGS_KEY, JSON.stringify(raw));
    s.start = { ...(s.start || {}), [key]: seq };
  }
  function nextNumber(series, year, s = settings()) {
    ensureTestStart(series, year, s);
    const max = store.get("SELECT COALESCE(MAX(seq), 0) AS n FROM invoices WHERE series = ? AND year = ? AND seq > 0", series, year).n;
    const seq = Math.max(max + 1, Number(s.start?.[`${series}${year}`]) || 1);
    if (seq > 999_999_999) throw new HttpError(409, `${series} serisinde ${year} yılı için numara kalmadı.`);
    return { seq, number: `${series}${year}${String(seq).padStart(9, "0")}` };
  }
  // Ayarlar ekranı: bu yıl her serinin sıradaki numarası (kâğıt / iç seri; e-Belge açıksa e-Belge serileri de).
  function nextNumbers(s) {
    const year = Number(today().slice(0, 4));
    const keys = edocEnabled ? Object.keys(s.series).filter(key => key !== "esmm" || esmmEnabled) : ["paper", "smm", "internal"];
    return Object.fromEntries(keys.map(key => [key, { series: s.series[key], year, ...nextNumber(s.series[key], year, s) }]));
  }
  // Test ortamındayken e-Belgenin gerçekte alacağı numara (TEST_SERIES); canlıdaysa boş.
  function testNumbers(s) {
    if (!edocEnabled || liveEnv(s)) return null;
    const year = Number(today().slice(0, 4));
    return Object.fromEntries(Object.entries(TEST_SERIES).filter(([key]) => key !== "esmm" || esmmEnabled).map(([key, series]) => [key, { series, year, ...nextNumber(series, year, s) }]));
  }
  // VUK md. 231 ve GİB: aynı seride numara sırası ile tarih sırası uyuşmalı — yeni fatura serinin son faturasından eski
  // tarihli olamaz (iptal edilmiş numara da sırada yer tutar).
  // 2.4.4 (UX15): numara / tarih çakışmaları kayıtta (writeIssued, editInvoice) ve formun ön hesabında (calc → numberingCheck) AYNI fonksiyonlarla
  // denetlenir — form onaydan önce söyler, kural tek yerde kalır. Asıl güvence işlem içindeki denetimdir (iki kişi aynı anda kaydederse).
  // later: "Kes, Sonra Gönder" — numara gönderimde serinin SONUNA verilir; koşul aynı (serinin son numaralı belgesinden eski tarih olmaz), ileti farklı.
  function chronologyProblem(series, year, date, { later = false } = {}) {
    const last = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 ORDER BY seq DESC LIMIT 1", series, year);
    if (!(last && last.issueDate > date)) return "";
    const head = later
      ? `${series} serisinde son gönderilen belge ${last.number} ${dayText(last.issueDate)} tarihli; numarası gönderimde verilecek bu belge ondan eski tarihli olamaz (numara ve tarih sırası).`
      : `${series} serisinde son belge ${last.number} ${dayText(last.issueDate)} tarihli; yeni belge daha eski tarihli kaydedilemez (numara ve tarih sırası uyuşmalı).`;
    return `${head} Belge tarihini ${dayText(last.issueDate)} ya da sonrası yapın.`;
  }
  function assertChronology(series, year, date) {
    const problem = chronologyProblem(series, year, date);
    if (problem) fail400(problem, "issueDate", { code: "chronology" });
  }
  // Yeni belgede numarayı program mı verir (kendi serimiz; müşterinin numara vermediği satıştan iade → iç seri) ve hangi seriden.
  const ownNumbered = doc => Boolean(doc.meta.own || (doc.kind === "sale_return" && !doc.number));
  const numberSeriesOf = doc => (doc.meta.own ? seriesFor(doc.kind, doc.profile, doc.settings) : doc.settings.series.internal);
  // e-Belge numarası kayıtta ertelenebilir mi (O1: serinin daha eski numarasız bekleyeni varken numara verilmez).
  const deferableDoc = doc => Boolean(edocEnabled && doc.meta.own && sendKind(doc.kind, doc.profile) && doc.profile !== "KAGIT");
  // Elle yazılan numara (alış, müşterinin iade faturası): aynı caride aynı türde kayıtlı belge numarası.
  function duplicateProblem(doc, invoiceId = "") {
    if (!doc.number) return "";
    const twin = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE account_id = ? AND kind = ? AND number = ? AND status = 'issued' AND id <> ?", doc.account.id, doc.kind, doc.number, invoiceId || "");
    return twin ? `${doc.number} numaralı ${doc.meta.label.toLocaleLowerCase("tr-TR")} bu caride ${dayText(twin.issueDate)} tarihiyle zaten kayıtlı.` : "";
  }
  // Düzenle'de tarih: numara, seri, yıl değişmez; yeni tarih numaranın serideki yerine uymalı.
  function editChronologyProblem(existing, doc) {
    const own = INVOICE_KINDS[existing.kind].own || existing.seq > 0;
    if (!own || doc.date === existing.issueDate) return "";
    if (!(existing.seq > 0) && existing.eStatus === "waiting" && doc.profile !== "KAGIT") {
      // Dar kontrol 2.4.3 (D4): numarasız bekleyen belge (Kes, Sonra Gönder) numarasını gönderimde serinin SONUNA alır. Tarih denetimi o konuma
      // göre: serinin son numaralı belgesinden eski olamaz; ileri almak serbesttir. (Önceden seq = 0 için "sonraki belge" serinin İLK numaralısı
      // okunuyordu; kalıcı kronoloji engelli belgenin tarihi ileri alınamıyordu.)
      const series = seriesFor(existing.kind, doc.profile, settings());
      const last = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 ORDER BY seq DESC LIMIT 1", series, Number(doc.date.slice(0, 4)));
      return last && doc.date < last.issueDate ? `${series} serisinde son gönderilen belge ${last.number} ${dayText(last.issueDate)} tarihli; numarası gönderimde verilecek bu belge ondan eski tarihli olamaz (numara ve tarih sırası).` : "";
    }
    // Numara sırası ile tarih sırası uyuşmalı (VUK 231): yeni tarih, serideki önceki ve sonraki belgenin arasında kalmalı.
    const prev = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 AND seq < ? ORDER BY seq DESC LIMIT 1", existing.series, existing.year, existing.seq);
    const next = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > ? ORDER BY seq LIMIT 1", existing.series, existing.year, existing.seq);
    if (doc.date.slice(0, 4) !== String(existing.year)) return `Numara ${existing.year} yılına ait; tarih başka yıla alınamaz.`;
    if (prev && doc.date < prev.issueDate) return `Önceki belge ${prev.number} ${dayText(prev.issueDate)} tarihli; bu belge ondan eski tarihli olamaz (numara ve tarih sırası).`;
    if (next && doc.date > next.issueDate) return `Sonraki belge ${next.number} ${dayText(next.issueDate)} tarihli; bu belge ondan yeni tarihli olamaz (numara ve tarih sırası).`;
    return "";
  }
  // Dönem kilidi: kayıttaki denetimin KENDİSİ (period.assertOpen) çağrılır; yalnız iletisi alınır.
  function lockProblem(date, what) {
    try {
      period?.assertOpen(date, what);
      return "";
    } catch (error) {
      if (error?.extra?.code === "period-locked") return error.message;
      throw error;
    }
  }
  // Formun ön hesabı (calc): kaydet/gönder onayından ÖNCE, kaydetmeden ve ağa çıkmadan — writeIssued / editInvoice'ın sırası ve dallarıyla.
  // problems: kaydı kesin reddedecek çakışmalar (dönem kilidi, numara/tarih sırası, elle numara çakışması).
  // orderHold: numara kayıtta verilmeyecek (aynı seride daha eski tarihli gönderilmemiş belge var; belge numarasız Gönderilecekler'e girer).
  function numberingCheck(doc, existing = null) {
    const problems = [];
    const push = text => text && problems.push(text);
    if (existing) {
      push(lockProblem(existing.issueDate, "Bu fatura"));
      push(lockProblem(doc.date, "Fatura"));
      if (INVOICE_KINDS[existing.kind].own || existing.seq > 0) push(editChronologyProblem(existing, doc));
      else push(duplicateProblem(doc, existing.id));
      return { problems, orderHold: null };
    }
    push(lockProblem(doc.date, "Fatura"));
    if (!ownNumbered(doc)) {
      push(duplicateProblem(doc));
      return { problems, orderHold: null };
    }
    const series = numberSeriesOf(doc);
    const year = Number(doc.date.slice(0, 4));
    push(chronologyProblem(series, year, doc.date));
    const count = !problems.length && deferableDoc(doc) ? olderPending(series, year, doc.date) : 0;
    return { problems, orderHold: count ? { count, text: orderText(count, "Belge numarasız Gönderilecekler'e eklenecek") } : null };
  }

  // ---------- Kesme (tek işlem bloğu) ----------
  const stockKind = kind => INVOICE_KINDS[kind].stock;
  const stockReason = kind => (kind === "sale_return" ? "return" : kind === "purchase_return" ? "preturn" : "");
  const inflow = kind => ["sale", "smm", "purchase_return"].includes(kind);
  const lineTryNet = (line, rate) => (rate === 1 ? line.net : Math.round(line.net * rate));

  // edit (v2.0.16): kaydedilmiş belgenin satırı; numara, seri, ETTN ve ilk kayıt bilgisi korunur, çağıran (editInvoice)
  // aynı işlemde önce eski etkileri geri alır.
  // ---------- İade ↔ taksit kartı (v2.0.24) ----------
  // Asıl faturanın açığı ve onu kapsayan Mevcut Borç kartlarının payı (kart kimliği → tutar).
  function coverState(originalId) {
    const row = store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson FROM invoices WHERE id = ?", originalId);
    if (!row || !plans()?.shrinkPlan) return null;
    const state = paymentStates([row]).get(row.id) || {};
    return { row, open: Number(state.open) || 0, excess: Number(state.excess) || 0, coveredBy: { ...(state.coveredBy || {}) } };
  }
  // İade (kaydı, düzenlemesi, iptali) sonrası asıl faturayı taksitlendiren kart yeni duruma getirilir:
  //  - faturanın kendi kartının kalanı = faturanın açığı (küçülür; iade azaldıysa/iptal edildiyse fatura kalanına kadar büyür);
  //  - kapsayan Mevcut Borç kartı, faturadaki payı ne kadar azaldıysa o kadar küçülür. Küçülen tutar iade belgesinde
  //    (payment_json.coverCuts) saklanır; iade iptal edilince ya da düzenlenince kart aynı tutarda geri büyür.
  // Başka kartlara dokunulmaz. Aynı veri tabanı işleminin içinde çalışır.
  // Parası geri verilen iade (nakit/banka/POS iadesi) müşterinin borcunu düşürmez: iadenin geri ödenen kısmı iade belgesini kapatır, asıl
  // faturaya mahsup edilmez (v2.1.0 K1, lib/invoice-settle.mjs adım R). Kart bu tutar kadar küçülmez (gözden geçirme G1).
  const refundOf = returnId => roundMoney(store.all("SELECT amount FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out'", returnId).reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  const refundsFor = originalId => roundMoney(store.all("SELECT id FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND original_id = ?", originalId).reduce((sum, row) => sum + refundOf(row.id), 0));
  // v2.1.0 (Canlı Hata 2, 2.0.24 G1'in gerilemesi; K1): hedef = max(0, imzalı açık). İmzalı açık = fatura − (peşin + kart tahsilatı +
  // çek/senet + iadelerin mahsup edilen kısmı); faturaya bağlı ödemeler faturayı aşınca eksidir (açık 0'da kırpılmaz). Faturanın açığı aynı
  // kuralla hesaplanır: kartın kalanı = faturanın açığı. 2.0.24–2.0.26'da hedef = açık(0'da kırpılı) + geri ödenen idi (peşinli taksitli
  // faturada malın tamamı iade edilip peşin geri ödenince kart yeniden büyüyordu); K1'e kadar açık geri ödenen iadeyi de düşüyor, hedef
  // geri ödemeyi geri ekliyordu (fatura 360 ↔ kart 600).
  function ownTarget(originalId) {
    const state = coverState(originalId);
    return roundMoney(Math.max(0, (state?.open ?? 0) - (state?.excess ?? 0) + (legacyClosing ? refundsFor(originalId) : 0)));
  }
  function ownCard(user, original, touched, note) {
    if (!original?.planId) return;
    const p = plans();
    const open = ownTarget(original.id);
    const left = p.leftOf(original.planId);
    if (left > open + 0.005) {
      if (p.shrinkPlan(user, original.planId, roundMoney(left - open), note) > 0) touched.plans.add(original.planId);
    } else if (open > left + 0.005 && p.growForInvoice) {
      const rest = Number(parseJson(original.paymentJson, {}).rest) || 0;
      // v2.1.0 (R5; 2.0.24'ten beri): kart fazla tahsilatlıysa (iade kartı 0'a indirdikten sonra tahsilat almış; ödenen > toplam) eksi
      // kalan da kapanır — büyüme = hedef − imzalı kalan. Önceden kalan 0'da kırpılı okunuyor, kart avansa dönen tahsilat kadar kısa büyüyordu
      // (fatura açığı 1.500 ↔ kartın kalanı 1.000).
      const signed = p.signedLeftOf ? Math.min(left, p.signedLeftOf(original.planId)) : left;
      if (p.growForInvoice(user, original.planId, roundMoney(open - signed), rest, note)) touched.plans.add(original.planId);
    }
  }
  // Açılış onarımı (v2.1.0, Canlı Hata 2; plan §10.6 düzeni): 2.0.24–2.0.26 eski kuralla (hedef = açık + geri ödenen) yanlış
  // büyümüş ya da küçülmemiş faturaya ait kartlar, dokunulmadıkça yanlış kalırdı. Sessiz, tek işlem, idempotent: yalnız paralı iadesi
  // olan taksitli faturanın etkin kartı; kalan yeni hedeften büyük ve eski kuralın hedefini aşmıyorsa (yani fark bu hatadan) kalan
  // hedefe indirilir (shrinkPlan: yalnız ödenmemiş kısım, son taksitten geriye). Küçülecek taksitlerden biri kilitli dönemdeyse kart
  // değişmez (kilitli döneme yazılmaz), yalnız sonuçta listelenir. Her değişiklik audit'e (plan.repaired, previous) yazılır.
  function repairOwnCards({ log = null } = {}) {
    const p = plans();
    if (!p?.shrinkPlan || !p.leftOf) return { fixed: [], locked: [] };
    const actor = { id: "system", role: "admin", display_name: "Açılış onarımı" };
    const lock = period?.lockedUntil?.() || "";
    const rows = store.all(`SELECT DISTINCT i.id, i.number, i.plan_id AS planId FROM invoices i
      JOIN invoices r ON r.original_id = i.id AND r.kind = 'sale_return' AND r.status = 'issued'
      JOIN plans pl ON pl.id = i.plan_id AND pl.deleted_at IS NULL AND pl.status <> 'closed'
      WHERE i.status = 'issued' AND i.plan_id <> ''`);
    const fixed = [];
    const locked = [];
    for (const row of rows) {
      const refunds = refundsFor(row.id);
      if (!(refunds > 0.005)) continue;
      const state = coverState(row.id);
      if (!state) continue;
      // İmzalı açık (K1: geri ödenen iade faturadan düşülmez). Yeni hedef = max(0, imzalı açık); eski kuralın (2.0.24–2.0.26) hedefi = o
      // sürümlerin açığı (geri ödenen iade de düşülmüş, 0'da kırpılı) + geri ödenen.
      const signed = roundMoney(state.open - state.excess + (legacyClosing ? refunds : 0));
      const target = roundMoney(Math.max(0, signed));
      const before = roundMoney(Math.max(0, signed - refunds) + refunds);
      const left = p.leftOf(row.planId);
      if (!(left > target + 0.005) || left > before + 0.005) continue;
      const cut = roundMoney(left - target);
      const plan = store.get("SELECT total FROM plans WHERE id = ?", row.planId);
      const items = store.all("SELECT id, due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", row.planId);
      // shrinkPlan'ın keseceği taksitler (son taksitten geriye).
      let rest = cut;
      const touchedItems = [];
      for (const item of [...items].reverse()) {
        if (!(rest > 0.005)) break;
        touchedItems.push(item);
        rest = roundMoney(rest - Math.min(rest, Number(item.amount) || 0));
      }
      if (lock && touchedItems.some(item => item.dueDate <= lock)) {
        locked.push({ invoiceId: row.id, number: row.number, planId: row.planId, left, target });
        continue;
      }
      store.tx(() => {
        const done = p.shrinkPlan(actor, row.planId, cut, `Açılış onarımı (2.1.0): iade geri ödemesi kartı büyütmüştü · ${row.number}`);
        if (done > 0) {
          audit(actor, "plan.repaired", row.planId, { invoiceId: row.id, number: row.number, reason: "iade-geri-odeme", previous: { total: Number(plan?.total) || 0, left, items: items.map(item => ({ dueDate: item.dueDate, amount: item.amount })) }, total: roundMoney((Number(plan?.total) || 0) - done), left: target, cut: done });
          fixed.push({ invoiceId: row.id, number: row.number, planId: row.planId, from: left, to: target });
        }
      });
    }
    if (fixed.length || locked.length) log?.info?.("Açılış onarımı: iade geri ödemesiyle büyümüş taksit kartları", { fixed: fixed.length, locked: locked.length });
    return { fixed, locked };
  }
  function retarget(user, pre, touched, note, returnId) {
    if (!pre) return;
    const post = coverState(pre.row.id);
    if (!post) return;
    ownCard(user, pre.row, touched, note);
    const cuts = {};
    // Geri ödenen kısım borcu düşürmez (G1): K1'den beri kapama onu asıl faturaya hiç mahsup etmez, kartın payındaki azalış yalnız
    // mahsup edilen kısımdır (önceden — K1 öncesi kural, yalnız testlerde — azalıştan geri ödeme ayrıca düşülüyordu).
    let refund = legacyClosing && returnId ? refundOf(returnId) : 0;
    for (const planId of Object.keys(pre.coveredBy)) {
      let delta = roundMoney((pre.coveredBy[planId] || 0) - (post.coveredBy[planId] || 0));
      const offset = Math.min(refund, Math.max(0, delta));
      delta = roundMoney(delta - offset);
      refund = roundMoney(refund - offset);
      if (!(delta > 0.005)) continue;
      const cut = plans().shrinkPlan(user, planId, delta, note);
      if (cut > 0) {
        cuts[planId] = cut;
        touched.plans.add(planId);
      }
    }
    // Asıl faturanın açığını aşan iade avans olur; carinin borcundan büyük kalan Mevcut Borç kartları en yeniden başlayarak
    // küçülür (2.0.23 davranışı; faturanın kendi kartına dokunulmaz — trimCovers onları atlar). Kesinti de iadeye yazılır (G3).
    if (plans()?.trimCovers) {
      for (const plan of plans().trimCovers(pre.row.accountId, user, note)) {
        cuts[plan.id] = roundMoney((cuts[plan.id] || 0) + plan.cut);
        touched.plans.add(plan.id);
      }
    }
    if (returnId && Object.keys(cuts).length) {
      const payment = parseJson(store.get("SELECT payment_json AS j FROM invoices WHERE id = ?", returnId)?.j, {});
      store.run("UPDATE invoices SET payment_json = ? WHERE id = ?", JSON.stringify({ ...payment, coverCuts: cuts }), returnId);
    }
  }
  // İadenin küçülttüğü Mevcut Borç kartları geri büyür (iade iptali / düzenlemesi).
  function restoreCuts(user, returnRow, touched, note) {
    const cuts = parseJson(returnRow?.paymentJson ?? store.get("SELECT payment_json AS j FROM invoices WHERE id = ?", returnRow?.id)?.j, {}).coverCuts || {};
    for (const [planId, cut] of Object.entries(cuts)) {
      const total = Number(store.get("SELECT total FROM plans WHERE id = ? AND deleted_at IS NULL", planId)?.total);
      if (!Number.isFinite(total) || !plans()?.growForInvoice) continue;
      if (plans().growForInvoice(user, planId, Number(cut) || 0, roundMoney(total + (Number(cut) || 0)), note)) touched.plans.add(planId);
    }
  }

  // Kesimi kesin reddedecek e-Belge sorunları (satıcı, alıcı, iade referansı, tür karışımı). Hesaplama ucu (calc) da aynısını döner (B7).
  function issueBlockers(doc) {
    if (doc.profile === "KAGIT" || !doc.meta.own) return [];
    return [...sellerProblems(doc.profile, doc.settings), ...partyProblems(doc.party, { profile: doc.profile === "EARSIVFATURA" || doc.profile === "ESMM" ? "EARSIV" : "EFATURA", role: "buyer", payable: c2(doc.money.payable) }), ...returnProblems(doc.profile, doc.kind, doc.returnRef || doc.original?.number, doc.original?.number), ...returnRefShape(doc), ...mixProblems(doc.profile, doc.computed?.lines || [])];
  }
  // MM1: yazılan referans 16 karakter ama harf/rakam dışı (ör. "/") ise ayrıca söylenir.
  const returnRefShape = doc => (doc.returnRef && doc.returnRef.length === 16 && !RETURN_REF.test(doc.returnRef) ? ["İade Edilen Belge No (e-Belge Referansı) yalnız harf (A–Z) ve rakam içermeli."] : []);
  function writeIssued(user, doc, payment, { id = null, force = {}, defer = false, edit = null, pre = undefined, keepEvents = null } = {}) {
    const s = doc.settings;
    const meta = doc.meta;
    // "Kes, Sonra Gönder" (e-Belge): bütün etkiler şimdi işlenir; resmî numara entegratöre gönderilirken verilir.
    let later = Boolean(!edit && defer && deferableDoc(doc));
    // Dar kontrol 2.4.3 (O1): numara kayıtta verilecekse (Kaydet ve Gönder, düz Kaydet, toplu kayıt, banka iade faturası) ve aynı seride daha eski
    // tarihli gönderilebilir numarasız bekleyen varsa yeni belge numara ALMAZ: kaydedilir, numarasız Gönderilecekler'e girer (yoksa eskiler kalıcı
    // kronoloji engeline düşerdi). Kural tek yerde (olderPending); gönderimdeki numara (numberForSend) aynı kuralı işlem içinde yeniden uygular.
    const deferable = Boolean(!edit && deferableDoc(doc));
    let orderHeld = 0;
    // e-Belge: alıcı ve satıcı bilgisi eksiksiz olmalı (GİB doğrulaması).
    const problems = issueBlockers(doc);
    // MM1: iade referansı sorunu iadeye özgü kodla (alan: returnRef) söylenir.
    const refProblems = doc.profile === "KAGIT" || !doc.meta.own ? [] : [...returnProblems(doc.profile, doc.kind, doc.returnRef || doc.original?.number, doc.original?.number), ...returnRefShape(doc)];
    if (refProblems.length) fail400(refProblems.join(" "), "returnRef", { code: "einvoice-return-reference", problems: refProblems });
    if (problems.length) fail400(problems.join(" "), "party", { code: "einvoice-party", problems });
    const invoiceId = id || newId("invoice");
    const touched = { accounts: new Set([doc.account.id]), items: new Set(), cash: false, cheques: { accountIds: [], chequeIds: [] }, plans: new Set() };
    // v2.1.0 (bank.post): fatura, stok, cari, peşin tahsilat/ödeme (her peşin satır kendi İşlem No'lu işlem başlığıyla), çek/senet
    // ve taksit kartı tek işlemde. Düzenlemede (edit) çağıran editInvoice'ın bank.post işleminin içindedir.
    // K7 (Aşama 7): formdan seçilen hesaplar (finRef); Düzenle'de çağıran (editInvoice) eski ve yeni hesaplarla kendisi denetler. Banka → masraf
    // yolu (bankAccountId) Banka servisinin kendi K7'sinden geçer.
    const k7 = edit ? null : banking.negative(payment.cash.map(item => item.finRef).filter(Boolean), doc.date, force.negative === true);
    const result = bank.post({ user, module: "invoice", op: edit ? "update" : "create", prev: edit || undefined, similarOk: force.similar === true, guard: k7?.guard || null, write: () => {
      k7?.capture();
      period?.assertOpen(doc.date, "Fatura");
      // v2.0.24: iadeden önce asıl faturanın açığı ve onu kapsayan kartlar (düzenlemede eski iade geri alınmadan önce).
      const before = pre !== undefined ? pre : doc.kind === "sale_return" && doc.original?.id ? coverState(doc.original.id) : null;
      ensureNewItems(user, doc, invoiceId, touched);
      // Numara (kesme anında; iki kişi aynı anda kesse de BEGIN IMMEDIATE sıraya sokar).
      let series = "";
      let year = 0;
      let seq = 0;
      let number = doc.number;
      if (edit && (meta.own || edit.seq > 0)) {
        ({ series, year, seq, number } = edit);
      } else if (edit) {
        if (!number) fail400(doc.kind === "purchase" ? "Tedarikçinin fatura numarasını yazın (faturanın üstündeki No)." : "Fatura numarasını yazın.", "number");
        const twin = duplicateProblem(doc, invoiceId);
        if (twin) throw new HttpError(409, twin, { code: "invoice-duplicate", field: "number" });
      } else if (later) {
        series = numberSeriesOf(doc);
        year = Number(doc.date.slice(0, 4));
        // Dar kontrol 2 (B5): numarasız kaydedilen belge (Kes, Sonra Gönder) numarasını gönderimde serinin SONUNA alır; serinin son numaralı
        // belgesinden eski tarihliyse doğar doğmaz kalıcı kronoloji engeline düşerdi. D4 (Düzenle'de tarih) ile aynı kural, kayıtta reddedilir.
        const tail = chronologyProblem(series, year, doc.date, { later: true });
        if (tail) fail400(tail, "issueDate", { code: "chronology" });
      } else if (ownNumbered(doc)) {
        series = numberSeriesOf(doc);
        year = Number(doc.date.slice(0, 4));
        assertChronology(series, year, doc.date);
        orderHeld = deferable ? olderPending(series, year, doc.date, invoiceId) : 0;
        if (orderHeld) later = true;
        else ({ seq, number } = nextNumber(series, year, s));
      } else {
        if (!number) fail400(doc.kind === "purchase" ? "Tedarikçinin fatura numarasını yazın (faturanın üstündeki No)." : "Fatura numarasını yazın.", "number");
        const twin = duplicateProblem(doc, invoiceId);
        if (twin) throw new HttpError(409, twin, { code: "invoice-duplicate", field: "number" });
      }
      const totals = doc.computed.totals;
      const money = doc.money;
      const ettn = id ? store.get("SELECT ettn FROM invoices WHERE id = ?", id)?.ettn || randomUUID() : randomUUID();
      const stamp = now();
      const columns = {
        kind: doc.kind,
        scenario: doc.scenario,
        status: "issued",
        series,
        year,
        seq,
        number,
        ettn,
        issue_date: doc.date,
        issue_time: doc.time,
        account_id: doc.account.id,
        party_json: JSON.stringify(doc.party),
        seller_json: JSON.stringify(sellerParty(s)),
        profile: doc.profile,
        type_code: typeCode(doc.kind, doc.computed.lines),
        currency: doc.currency,
        rate: doc.rate,
        prices_include_vat: doc.pricesIncludeVat ? 1 : 0,
        discount_rate: doc.discountRate,
        stoppage_rate: doc.stoppageRate,
        base_total: c2(totals.base),
        discount_total: c2(totals.discount),
        net_total: c2(totals.net),
        goods_net: c2(totals.goodsNet),
        service_net: c2(totals.serviceNet),
        vat_total: c2(totals.vat),
        withheld_total: c2(totals.withheld),
        stoppage_total: c2(totals.stoppage),
        gross_total: c2(totals.gross),
        payable_total: c2(totals.payable),
        try_net: c2(money.net),
        try_vat: c2(money.vat),
        try_withheld: c2(money.withheld),
        try_stoppage: c2(money.stoppage),
        try_payable: c2(money.payable),
        gl_json: JSON.stringify(money.byAccount),
        payment_json: JSON.stringify({ cash: payment.cash.map(item => ({ amount: item.amount, method: item.method, ...(item.lineKey ? { lineKey: item.lineKey } : {}), ...((item.finRef ?? item.bankAccountId) ? { bankAccountId: item.finRef ?? item.bankAccountId } : {}) })), cheques: payment.cheques.map(item => ({ instrument: item.instrument, amount: item.amount, dueDate: item.dueDate, serialNo: item.serialNo, bank: item.bank, ...(item.bankAccountId ? { bankAccountId: item.bankAccountId } : {}) })), endorse: payment.endorse.map(item => item.id), mode: payment.mode, installments: payment.installments, rest: payment.rest }),
        due_date: payment.dueDate,
        plan_id: "",
        original_id: doc.original?.id || "",
        order_no: doc.orderNo,
        order_date: doc.orderDate,
        despatch_no: doc.despatchNo,
        despatch_date: doc.despatchDate,
        paper_no: doc.paperNo,
        return_ref: doc.returnRef || "",
        note: doc.note,
        updated_by: user.id,
        updated_at: stamp,
        issued_by: user.id,
        issued_at: stamp,
      };
      if (edit) {
        delete columns.issued_by;
        delete columns.issued_at;
        store.run("DELETE FROM invoice_lines WHERE invoice_id = ?", invoiceId);
        store.run(`UPDATE invoices SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...Object.values(columns), invoiceId);
        if (edit.eStatus) store.run("UPDATE invoices SET e_status = ? WHERE id = ?", edit.eStatus, invoiceId);
      } else if (id) {
        const draft = store.get("SELECT status FROM invoices WHERE id = ?", id);
        if (draft?.status !== "draft") throw new HttpError(409, "Bu taslak bu arada kaydedilmiş ya da silinmiş. Listeyi yenileyin.", { code: "invoice-stale" });
        store.run("DELETE FROM invoice_lines WHERE invoice_id = ?", id);
        store.run(`UPDATE invoices SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...Object.values(columns), id);
      } else {
        const all = { id: invoiceId, ...columns, created_by: user.id, created_at: stamp };
        store.run(`INSERT INTO invoices (${Object.keys(all).join(", ")}) VALUES (${Object.keys(all).map(() => "?").join(", ")})`, ...Object.values(all));
      }
      if (later) store.run("UPDATE invoices SET e_status = 'waiting', e_profile = ? WHERE id = ?", doc.profile, invoiceId);
      // Kalemler ve stok hareketleri.
      const what = `${meta.label} ${number || "(gönderilecek)"}`;
      const noteFor = line => `${what} · ${doc.party.name}${line.description ? ` · ${line.description}` : ""}`.slice(0, 300);
      doc.computed.lines.forEach((line, index) => {
        const input = doc.lines[index];
        const lineId = newId("iline");
        let moveId = "";
        let unitCost = 0;
        if (input.itemId && input.goods && stockKind(doc.kind)) {
          const tryNet = lineTryNet(line, doc.rate);
          unitCost = doc.kind === "purchase" ? roundMoney(tryNet / 100 / line.qty) : 0;
          if (doc.kind === "sale") unitCost = Number(stock().invoiceStock.itemFor(input.itemId).unitPrice) || 0;
          moveId = stock().invoiceStock.add(user, {
            itemId: input.itemId,
            kind: stockKind(doc.kind),
            qty: line.qty,
            unitPrice: roundMoney(tryNet / 100 / line.qty),
            amount: c2(tryNet),
            date: doc.date,
            note: noteFor(input),
            reason: stockReason(doc.kind),
            invoiceId,
            force: force.stock === true,
            unitCost: doc.kind === "purchase" ? tryNet / 100 / line.qty : 0,
          });
          touched.items.add(input.itemId);
        } else if (input.itemId && doc.kind === "sale") unitCost = Number(stock()?.invoiceStock?.itemFor(input.itemId)?.unitPrice) || 0;
        store.run(
          `INSERT INTO invoice_lines (id, invoice_id, seq, item_id, goods, code, name, description, unit, qty, unit_price, discount_rate, base, discount, net, vat_rate, vat, withholding_code, withholding_num,
             withholding_den, withheld, exemption_code, gross, payable, gl_account, expense_code, unit_cost, origin_line_id, move_id, serial_no, lot_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          lineId, invoiceId, index + 1, input.itemId, input.goods ? 1 : 0, input.code, input.name, input.description, input.unit, line.qty, line.unitPrice, line.discountRate, c2(line.base), c2(line.discount), c2(line.net),
          line.vatRate, c2(line.vat), line.withholdingCode, line.withholdingNum, line.withholdingDen, c2(line.withheld), line.exemptionCode, c2(line.gross), c2(line.payable), input.account, input.expenseCode, unitCost,
          input.originLineId, moveId, input.serialNo || "", input.lotNo || "",
        );
      });
      // Cari: faturanın borcu/alacağı (TL karşılığı).
      const service = accounts();
      service.invoiceEntry.add(user, doc.account.id, { kind: meta.party, amount: c2(money.payable), date: doc.date, note: `${what}${doc.currency !== "TRY" ? ` (${moneyText(c2(totals.payable), doc.currency)} × ${doc.rate})` : ""}`, invoiceId });
      // Peşin tahsilat / ödeme (Kasa ↔ cari).
      for (const item of payment.cash) {
        const into = inflow(doc.kind);
        if (!into) cash?.guardOut?.(item.amount, doc.date, force.cash === true, item.method);
        // bankAccountId (v2.1.0 Aşama 4): Banka → KDV'li masraf (issueBankFee) hesabı kendisi denetleyip verir; fatura formunun satırında hesap
        // paymentInput'ta seçilir (finRef, Aşama 7). Satır o hesaba bağlı yazılır (fin_ref).
        const ref = item.finRef !== undefined ? item.finRef : item.bankAccountId || "";
        service.invoiceEntry.add(user, doc.account.id, { kind: into ? "in" : "out", amount: item.amount, date: doc.date, note: `${what} · ${doc.meta.return ? (into ? "iade tahsilatı" : "iade ödemesi") : into ? "peşin tahsilat" : "peşin ödeme"}`, invoiceId, method: item.method, eventId: keepEvents?.take({ lineKey: item.lineKey, kind: into ? "in" : "out", amount: item.amount, method: item.method, date: doc.date, finRef: ref }) || "", finRef: ref, pos: item.pos || null });
        touched.cash = true;
      }
      // Çek / senet: satışta alınan (portföy), alışta verilen; carinin bakiyesiyle mahsup çek olayından gelir.
      for (const item of payment.cheques) {
        const created = cheques().invoiceCheques.create(user, { direction: INVOICE_KINDS[doc.kind].side === "sale" ? "in" : "out", instrument: item.instrument, amount: item.amount, issueDate: doc.date, dueDate: item.dueDate, accountId: doc.account.id, serialNo: item.serialNo, bank: item.bank, drawer: item.drawer || doc.party.name, note: what, ...(item.bankAccountId ? { bankAccountId: item.bankAccountId } : {}) }, { invoiceId, note: number });
        touched.cheques.chequeIds.push(created.id);
      }
      for (const item of payment.endorse) {
        const endorsed = cheques().invoiceCheques.endorse(user, item.id, { accountId: doc.account.id, date: doc.date, invoiceId, note: number });
        touched.cheques.chequeIds.push(endorsed.id);
        for (const effect of endorsed.effects) if (effect.accountId) touched.accounts.add(effect.accountId);
      }
      // Kalan: taksit kartı (satış) ya da vadeli açık hesap.
      let planId = "";
      if (payment.mode === "installments") {
        planId = plans().createForAccount(user, doc.account, { total: payment.rest, count: payment.installments.count, firstDue: payment.installments.firstDue, everyMonths: payment.installments.everyMonths, note: what, coversBalance: true, registeredOn: doc.date, invoiceId });
        store.run("UPDATE invoices SET plan_id = ? WHERE id = ?", planId, invoiceId);
        touched.plans.add(planId);
      }
      // Satıştan iade: müşterinin borcu düştü; taksitlendirilmiş borç kalandan büyük kalmasın (kart küçülür).
      // v2.0.24: asıl faturayı taksitlendiren kart küçülür (kendi kartı / kapsayan Mevcut Borç kartı). Carinin bakiyesine
      // göre genel kırpma (trimCovers) faturada yapılmaz: müşterinin başka yerdeki avansı faturanın kartını küçültüyordu
      // (fatura açığı ≠ kartın kalanı). Asıl faturanın açığını aşan iade avans olur (kartlarla netleşmez; 2.0.23 kuralı).
      if (doc.kind === "sale_return") retarget(user, before, touched, `İade ${number}`, invoiceId);
      // 2.2.0 (plan §4.3/4): POS komisyon faturası taslağı kaydedilince o ayın KDV'li kesinti ve iade satırları bu faturaya bağlanır (aynı işlem).
      if (id && !edit) bankModule?.()?.pos?.invoiceIssued?.(user, invoiceId);
      if (!edit) audit(user, id ? "invoice.issued" : "invoice.created", invoiceId, { kind: doc.kind, number, accountId: doc.account.id, payable: c2(money.payable), currency: doc.currency, date: doc.date, originalId: doc.original?.id || "", payment: { cash: payment.cash.length, cheques: payment.cheques.length, endorse: payment.endorse.length, mode: payment.mode } });
      return { id: invoiceId, number, ...(orderHeld ? { orderHeld } : {}) };
    } });
    k7?.prime(result);
    publishAll(user, touched, result.id);
    return result;
  }
  function publishAll(user, touched, invoiceId) {
    publish(user, { kind: "invoices", invoiceId });
    for (const accountId of touched.accounts) publish(user, { kind: "accounts", accountId });
    for (const itemId of touched.items) publish(user, { kind: "stock", itemId });
    if (touched.cash) publish(user, { kind: "cash" });
    if (touched.cheques.chequeIds.length || touched.cheques.accountIds.length) cheques()?.invoiceCheques?.publish(user, touched.cheques);
    for (const planId of touched.plans) publish(user, { kind: "plans", planId });
  }

  function writeDraft(user, doc, { id = null } = {}) {
    const invoiceId = id || newId("invoice");
    const totals = doc.computed.totals;
    const money = doc.money;
    const created = { items: new Set() };
    store.tx(() => {
      ensureNewItems(user, doc, invoiceId, created);
      const stamp = now();
      const columns = {
        kind: doc.kind,
        scenario: doc.scenario,
        status: "draft",
        number: doc.meta.own ? "" : doc.number,
        issue_date: doc.date,
        issue_time: doc.time,
        account_id: doc.account.id,
        party_json: JSON.stringify(doc.party),
        seller_json: JSON.stringify(sellerParty(doc.settings)),
        profile: doc.profile,
        type_code: typeCode(doc.kind, doc.computed.lines),
        currency: doc.currency,
        rate: doc.rate,
        prices_include_vat: doc.pricesIncludeVat ? 1 : 0,
        discount_rate: doc.discountRate,
        stoppage_rate: doc.stoppageRate,
        base_total: c2(totals.base),
        discount_total: c2(totals.discount),
        net_total: c2(totals.net),
        goods_net: c2(totals.goodsNet),
        service_net: c2(totals.serviceNet),
        vat_total: c2(totals.vat),
        withheld_total: c2(totals.withheld),
        stoppage_total: c2(totals.stoppage),
        gross_total: c2(totals.gross),
        payable_total: c2(totals.payable),
        try_net: c2(money.net),
        try_vat: c2(money.vat),
        try_withheld: c2(money.withheld),
        try_stoppage: c2(money.stoppage),
        try_payable: c2(money.payable),
        gl_json: JSON.stringify(money.byAccount),
        payment_json: JSON.stringify(doc.paymentDraft || {}),
        original_id: doc.original?.id || "",
        order_no: doc.orderNo,
        order_date: doc.orderDate,
        despatch_no: doc.despatchNo,
        despatch_date: doc.despatchDate,
        paper_no: doc.paperNo,
        return_ref: doc.returnRef || "",
        note: doc.note,
        updated_by: user.id,
        updated_at: stamp,
      };
      if (id) {
        const row = store.get("SELECT status FROM invoices WHERE id = ?", id);
        if (row?.status !== "draft") throw new HttpError(409, "Yalnız taslak fatura düzeltilir; kesilmiş fatura iptal edilir ya da iade faturası kesilir.", { code: "invoice-not-draft" });
        store.run("DELETE FROM invoice_lines WHERE invoice_id = ?", id);
        store.run(`UPDATE invoices SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...Object.values(columns), id);
      } else {
        const all = { id: invoiceId, ...columns, ettn: doc.importUuid || randomUUID(), created_by: user.id, created_at: stamp };
        store.run(`INSERT INTO invoices (${Object.keys(all).join(", ")}) VALUES (${Object.keys(all).map(() => "?").join(", ")})`, ...Object.values(all));
      }
      doc.computed.lines.forEach((line, index) => {
        const input = doc.lines[index];
        store.run(
          `INSERT INTO invoice_lines (id, invoice_id, seq, item_id, goods, code, name, description, unit, qty, unit_price, discount_rate, base, discount, net, vat_rate, vat, withholding_code, withholding_num,
             withholding_den, withheld, exemption_code, gross, payable, gl_account, expense_code, unit_cost, origin_line_id, move_id, serial_no, lot_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?, ?)`,
          newId("iline"), invoiceId, index + 1, input.itemId, input.goods ? 1 : 0, input.code, input.name, input.description, input.unit, line.qty, line.unitPrice, line.discountRate, c2(line.base), c2(line.discount), c2(line.net),
          line.vatRate, c2(line.vat), line.withholdingCode, line.withholdingNum, line.withholdingDen, c2(line.withheld), line.exemptionCode, c2(line.gross), c2(line.payable), input.account, input.expenseCode, input.originLineId,
          input.serialNo || "", input.lotNo || "",
        );
      });
      audit(user, id ? "invoice.draft.updated" : "invoice.draft.created", invoiceId, { kind: doc.kind, accountId: doc.account.id, payable: c2(money.payable) });
    });
    publish(user, { kind: "invoices", invoiceId });
    for (const itemId of created.items) publish(user, { kind: "stock", itemId });
    return invoiceId;
  }

  // ---------- Etkileri geri alma (iptal ve düzenleme) ----------
  // Taksit kartı, çek/senet (ve ciro), Kasa, stok hareketleri ve cari kaydı birebir geri alınır. Düzenlemede (edit) ara
  // durum denetlenmez (Kasa/stok eksi): yeni etkiler yazıldıktan sonra son durum denetlenir (editInvoice).
  function reverseEffects(user, invoice, touched, { force = {}, edit = false } = {}) {
    touched.accounts.add(invoice.accountId);
    for (const planId of plans()?.removeForInvoice ? plans().removeForInvoice(user, invoice.id) : []) touched.plans.add(planId);
    if (cheques()?.invoiceCheques) {
      const voided = cheques().invoiceCheques.voidFor(user, invoice.id);
      touched.cheques.accountIds.push(...voided.accountIds);
      touched.cheques.chequeIds.push(...voided.chequeIds);
      for (const accountId of voided.accountIds) touched.accounts.add(accountId);
    }
    // Kasa: iptal edilen peşin tahsilat Kasa'dan düşer (eksiye düşürüyorsa sorulur).
    for (const entry of store.all("SELECT kind, amount, method, date FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out')", invoice.id)) {
      if (!edit) cash?.guardChange?.({ kind: entry.kind, amount: entry.amount, method: entry.method, date: entry.date }, null, force.cash === true);
      touched.cash = true;
    }
    for (const itemId of stock()?.invoiceStock ? stock().invoiceStock.removeFor(invoice.id, { force: edit || force.stock === true }) : []) touched.items.add(itemId);
    accounts().invoiceEntry.removeFor(invoice.id);
  }

  // ---------- İptal ----------
  // dryRun: bütün engeller ve yazımlar denenir, sonra geri alınır (e-Arşiv iptali entegratöre gitmeden önce programda
  // iptalin yapılabildiği kesinleşsin diye).
  const DRY_RUN = Symbol("dry-run");
  // fromBank (v2.1.0 Aşama 4): Banka → Ters Kaydet'in KDV'li masraf faturasını iptali (masraf başlığı aynı işlemde iptal edilir); başka yol 409.
  // posOutcome (2.2.0, plan §3.8 / §4.6): POS peşinli faturada "refunded" (Müşteriye İade Edildi; varsayılan: provizyon içinde ve valörden önce
  // void, değilse İptal İadesi) ya da "entry-error" (Kayıt Hatası: valörden önce void; bankaya geçtiyse yeniden planlama ya da 409 pos-settled).
  function cancel(user, id, { reason = "", force = {}, confirmExternal = false, dryRun = false, fromBank = false, posOutcome = "refunded" } = {}) {
    const touched = { accounts: new Set(), items: new Set(), cash: false, cheques: { accountIds: [], chequeIds: [] }, plans: new Set() };
    let row;
    try {
      row = runCancel();
    } catch (error) {
      if (error === DRY_RUN) return null;
      throw error;
    }
    publishAll(user, touched, row.id);
    return row;
    function runCancel() {
      // Hızlı Nasıl Bozarım (H1/H2): iptal ve silme bağlı peşini hesaptan düşer → K7 (Engelle 409 cash-blocked, Uyar 409 cash-negative +
      // accountId → cashForce / negativeOk; hakem K5). Önceden iptal Engelle'deki hesabı sessizce eksiye düşürüyordu (taksit/kayıt tahsilatının silmesi 409 veriyordu).
      const head = invoiceRow(id);
      const refs = store.all("SELECT DISTINCT fin_ref AS ref FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out') AND fin_ref <> ''", head.id).map(row => row.ref);
      const k7 = banking.negative(refs, head.issueDate, force?.negative === true);
      // v2.1.0 (bank.post op 'delete'): peşin satırların işlem başlıkları iptal olur (kopyası kalır).
      const result = bank.post({ user, module: "invoice", op: "delete", prev: { invoiceId: id }, guard: k7.guard, posOutcome: posOutcome === "entry-error" ? "entry-error" : "refunded", write: () => {
      k7.capture();
      const invoice = invoiceRow(id);
      if (invoice.status === "draft") throw new HttpError(409, "Taslak iptal edilmez; silinir.", { code: "invoice-draft" });
      if (invoice.status === "cancelled") throw new HttpError(409, "Bu fatura zaten iptal edilmiş.", { code: "invoice-cancelled" });
      const fee = fromBank ? null : bankFeeOf(invoice.id);
      if (fee) throw new HttpError(409, bankFeeText(fee), { code: "invoice-bank-fee", eventNo: fee.no });
      period?.assertOpen(invoice.issueDate, "Bu fatura");
      const returns = store.get("SELECT COUNT(*) AS n FROM invoices WHERE original_id = ? AND status = 'issued'", invoice.id).n;
      if (returns) throw new HttpError(409, `Bu faturanın ${returns} iade faturası var; önce iade faturalarını iptal edin.`, { code: "invoice-has-returns" });
      // İz 7.3: e-Fatura taslağı EDM'den programla silinemez (EDM'de iptal yalnız e-Arşiv'de); kullanıcı portaldan siler, burada onaylar.
      if (invoice.eStatus === "draft" && invoice.profile !== "EARSIVFATURA" && !confirmExternal) throw new HttpError(409, "Bu e-Fatura EDM portalında taslak olarak duruyor. Önce EDM portalında taslağı silin, sonra burada onaylayın (yoksa taslak portaldan gönderilebilir).", { code: "einvoice-draft" });
      if (["sent", "accepted"].includes(invoice.eStatus) && !confirmExternal) throw new HttpError(409, `Bu belge ${E_STATES[invoice.eStatus].toLocaleLowerCase("tr-TR")}. Önce GİB / entegratör tarafında iptal edin (e-Arşiv iptali ya da e-Fatura iade/itiraz), sonra burada onaylayın.`, { code: "einvoice-sent" });
      reverseEffects(user, invoice, touched, { force });
      const stamp = now();
      store.run("UPDATE invoices SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, cancel_reason = ?, updated_by = ?, updated_at = ? WHERE id = ?", user.id, stamp, limited(reason, 300, "İptal nedeni"), user.id, stamp, invoice.id);
      // İade iptali: asıl faturanın taksit kartı iadeyle küçüldüyse geri büyür (müşteri borcu yine taksitlerde izlenir).
      if (invoice.kind === "sale_return" && invoice.originalId && plans()?.shrinkPlan) {
        restoreCuts(user, { id: invoice.id }, touched, `İade iptali ${invoice.number}`);
        ownCard(user, store.get("SELECT id, plan_id AS planId, payment_json AS paymentJson FROM invoices WHERE id = ?", invoice.originalId), touched, `İade iptali ${invoice.number}`);
      }
      // v2.0.17: iptal edilen belgenin mahsup fişleri ve ona bağlanmış tahsilat/ödemelerin bağı kalkar (satırlar kalır,
      // kapama yeniden hesaplanır: otomatik en eski açık faturaya).
      store.run("DELETE FROM invoice_offsets WHERE invoice_id = ? OR (counter_type = 'invoice' AND counter_id = ?)", invoice.id, invoice.id);
      // K4 (2.3.0 kontrol turu 2): bağ kalkınca şüpheli cariye tahsilat "Normal Cariye İşlendi" olmaktan çıkar ve şüpheli alacaktan düşer
      // (lib/doubtful-gl doubtfulSkipOf). Para kuralı aynı; değişiklik işlem kaydına yazılır, ekranda iptalden önce ve sonra söylenir.
      const relinked = doubtfulRelinks(invoice.id);
      store.run("UPDATE account_entries SET invoice_id = '' WHERE invoice_id = ?", invoice.id);
      // 2.4.4 UX18 (kullanıcı kararı 21.10.2026): Kapatılacak Fatura ile bağlanan çek/senet faturanın parçası değildir — evrak portföyde (ve
      // işlem geçmişiyle) kalır, yalnız bağ düşer; kapama yeniden hesaplanır (en eski açık faturaya). Faturanın kendi evrakı voidFor'la geri alındı.
      const unbonded = store.all("SELECT ev.id, ev.cheque_id AS chequeId, c.account_id AS accountId FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE ev.invoice_id = ? AND ev.kind IN ('receive', 'issue') AND c.invoice_id <> ev.invoice_id", invoice.id);
      for (const row of unbonded) {
        store.run("UPDATE cheque_events SET invoice_id = '' WHERE id = ?", row.id);
        touched.cheques.chequeIds.push(row.chequeId);
        if (row.accountId) touched.cheques.accountIds.push(row.accountId);
      }
      audit(user, "invoice.cancelled", invoice.id, { number: invoice.number, kind: invoice.kind, payable: invoice.tryPayable, reason, ...(relinked.length ? { doubtfulRelinked: relinked.map(entry => ({ id: entry.id, date: entry.date, amount: entry.amount })) } : {}), ...(unbonded.length ? { chequesUnbonded: unbonded.map(row => row.chequeId) } : {}) });
      if (dryRun) throw DRY_RUN;
      return invoice;
      } });
      k7.prime(result);
      return result;
    }
  }

  // ---------- Son fiyatlar ----------
  // Ürün (ya da stoksuz kalemde ad) + cari: bu cariye son satış / bu cariden son alış ve başka carilere son satış / alış.
  // Fiyat karşılaştırılabilir olsun diye iskontolu, KDV hariç TL birim fiyat (ve KDV dahil karşılığı) verilir.
  function lastPrices({ itemId = "", name = "", accountId = "" }) {
    if (!itemId && !name) return { thisParty: {}, others: { sale: [], purchase: [] } };
    const rows = store.all(
      `SELECT l.qty, l.net, l.unit_price AS unitPrice, l.discount_rate AS discountRate, l.vat_rate AS vatRate, l.unit, i.kind, i.currency, i.rate, i.prices_include_vat AS includeVat,
              i.issue_date AS date, i.number, i.account_id AS accountId, COALESCE(a.name, '') AS accountName
       FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued' AND i.kind IN ('sale', 'purchase', 'smm') LEFT JOIN accounts a ON a.id = i.account_id
       WHERE ${itemId ? "l.item_id = ?" : "l.item_id = '' AND l.name = ? COLLATE NOCASE"}
       ORDER BY i.issue_date DESC, i.issue_time DESC, i.created_at DESC LIMIT 400`,
      itemId || name,
    );
    const shapeRow = row => {
      const net = roundMoney((row.net * (row.rate || 1)) / row.qty);
      return { side: row.kind === "purchase" ? "purchase" : "sale", date: row.date, number: row.number, accountId: row.accountId, accountName: row.accountName, qty: row.qty, unit: row.unit, unitNet: net, unitGross: roundMoney(net * (1 + row.vatRate / 100)), vatRate: row.vatRate, entered: row.unitPrice, discountRate: row.discountRate, currency: row.currency, includeVat: Boolean(row.includeVat) };
    };
    const shaped = rows.map(shapeRow);
    const thisParty = {
      sale: shaped.find(row => row.side === "sale" && row.accountId === accountId) || null,
      purchase: shaped.find(row => row.side === "purchase" && row.accountId === accountId) || null,
    };
    const others = { sale: [], purchase: [] };
    for (const side of ["sale", "purchase"]) {
      const seen = new Set();
      for (const row of shaped) {
        if (row.side !== side || row.accountId === accountId || seen.has(row.accountId)) continue;
        seen.add(row.accountId);
        others[side].push(row);
        if (others[side].length >= 3) break;
      }
    }
    // Stok kartından: son alış (maliyet) ve satış fiyatı; stok modülünden (faturasız) yapılan son satış/alış.
    let card = null;
    if (itemId) {
      const item = store.get("SELECT name, unit, unit_price AS unitPrice, sale_price AS salePrice, kind FROM stock_items WHERE id = ?", itemId);
      const move = side => store.get(`SELECT m.date, m.unit_price AS unitPrice, COALESCE(a.name, '') AS accountName FROM stock_moves m LEFT JOIN accounts a ON a.id = m.account_id WHERE m.item_id = ? AND m.invoice_id = '' AND m.pay <> 'none' AND m.kind = ? AND m.reason = '' ORDER BY m.date DESC, m.created_at DESC LIMIT 1`, itemId, side);
      const available = stock()?.invoiceStock && item?.kind !== "service" ? stock().invoiceStock.available(itemId) : null;
      card = item ? { unitCost: item.unitPrice, salePrice: item.salePrice, unit: item.unit, available, lastStockSale: move("out") || null, lastStockPurchase: move("in") || null } : null;
    }
    return { thisParty, others, card };
  }

  // ---------- İade arama ----------
  function returnable({ side = "sale", q = "", accountId = "" }) {
    const kind = side === "purchase" ? "purchase" : "sale";
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    const rows = store.all(`${INVOICE_SQL} WHERE i.kind = ? AND i.status = 'issued'${accountId ? " AND i.account_id = ?" : ""} ORDER BY i.issue_date DESC, i.issue_time DESC LIMIT 2000`, kind, ...(accountId ? [accountId] : []));
    const out = [];
    for (const row of rows) {
      const party = parseJson(row.partyJson, {});
      const lines = linesOf(row.id);
      if (needle) {
        const hay = `${row.number} ${party.name || row.accountName} ${row.accountTaxNo} ${lines.map(line => `${line.name} ${line.code}`).join(" ")}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(needle)) continue;
      }
      const returned = returnedQty(lines.map(line => line.id));
      const left = lines.map(line => ({ id: line.id, name: line.name, unit: line.unit, qty: line.qty, left: Math.max(0, Math.round((line.qty - (returned.get(line.id) || 0)) * 1000) / 1000) }));
      if (!left.some(line => line.left > 0)) continue;
      out.push({ id: row.id, number: row.number, issueDate: row.issueDate, accountId: row.accountId, accountName: party.name || row.accountName, tryPayable: row.tryPayable, currency: row.currency, payableTotal: row.payableTotal, lines: left });
      if (out.length >= 50) break;
    }
    return out;
  }

  // Uyarılar (engellemez): VUK md. 231 — fatura, malın teslimi / hizmetin yapılmasından itibaren 7 gün içinde düzenlenir.
  const DAY = 86_400_000;
  const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
  function docWarnings(doc) {
    const out = [];
    if (!doc.meta.own) return out;
    if (aliasMissing(doc)) out.push(`Alıcının e-Fatura posta kutusu (PK) seçilmemiş; belge gönderilemez. ${ALIAS_HINT}`);
    if (doc.despatchDate && daysBetween(doc.despatchDate, doc.date) > 7) out.push(`İrsaliye (teslim) tarihinden ${daysBetween(doc.despatchDate, doc.date)} gün sonra kesiliyor; fatura teslimden itibaren 7 gün içinde düzenlenmeli (VUK 231).`);
    else if (daysBetween(doc.date, today()) > 7) out.push(`Fatura tarihi bugünden ${daysBetween(doc.date, today())} gün önce; teslimden itibaren 7 gün içinde düzenlenmeli (VUK 231). Teslim tarihi buysa sorun yok.`);
    return out;
  }

  // ---------- Yollar ----------
  const requireView = req => auth.requirePermission(req, "invoices.view");
  const requireManage = req => auth.requirePermission(req, "invoices.manage");
  // Hakem K5: banka hesabının eksi bakiye onayı cashForce (plan §3.9) ya da eşanlamlı negativeOk (module-ref.mjs negativeConfirmed).
  const forceOf = body => ({ stock: body?.force === true || body?.stockForce === true, cash: body?.cashForce === true, negative: negativeConfirmed(body), similar: body?.similarOk === true });

  router.get("/api/workspace/invoices/meta", async ({ req, res }) => {
    const user = requireView(req);
    const repeated = safeRepeats();
    const s = settings();
    ok(res, {
      // send: bu tür HERHANGİ bir profilde gönderilir mi (madde 22: serbest meslek makbuzu yalnız e-SMM açıkken, ESMM profiliyle) — istemci profili
      // ayrıca denetler (kâğıt belgede "Kaydet ve Gönder" yok).
      kinds: Object.fromEntries(Object.entries(INVOICE_KINDS).map(([key, value]) => [key, { label: value.label, short: value.short, side: value.side, return: value.return, own: value.own, send: Object.keys(PROFILES).some(profile => sendKind(key, profile)) }])),
      scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([key, value]) => [key, { ...value, side: INVOICE_KINDS[value.kind].side }])),
      profiles: PROFILES,
      vatRates: VAT_RATES,
      withholding: Object.entries(WITHHOLDING).map(([code, value]) => ({ code, label: value.label, num: value.num, den: value.den })),
      exemptions: Object.entries(EXEMPTIONS).map(([code, label]) => ({ code, label })),
      expenses: Object.entries(EXPENSES).map(([code, value]) => ({ code, label: value.label, account: value.account })),
      currencies: Object.entries(CURRENCIES).map(([code, value]) => ({ code, label: value.label, symbol: value.symbol })),
      units: UNITS,
      // e-Belgede kendi koduyla giden birimler; öbürleri Adet (C62) + kalem notu gider (gerçek EDM, docs/kanit/2026-10-16/edm-birim).
      eUnits: edocEnabled ? UNIT_CODE_KEYS : [],
      methods: METHODS,
      methodsIn: METHODS_IN,
      methodsOut: METHODS_OUT,
      payStates: PAY_STATES,
      eStates: E_STATES,
      adapters: edocEnabled ? Object.entries(ADAPTERS).map(([id, value]) => adapterInfo(id, value)) : [],
      edocEnabled,
      settings: { efatura: edocEnabled && s.efatura, earsiv: edocEnabled && s.earsiv, esmm: esmmEnabled && s.esmm, defaults: s.defaults, series: s.series, sellerReady: sellerProblems("KAGIT", s).length === 0 && Boolean(s.seller.name), sellerName: s.seller.name, integrator: edocEnabled ? { ...integratorSummary(s), portal: portalState(s, user) } : null, draftUpload: edocEnabled && s.eOptions.draftUpload === true },
      today: today(),
      repeated: repeated.length,
      lockedUntil: period?.lockedUntil?.() || "",
      canManage: canUser(user, "invoices.manage"),
      canSettings: canUser(user, "invoices.settings"),
      canCheques: canUser(user, "cheques.manage"),
      canPlans: canUser(user, "plans.manage"),
    });
  });
  router.get("/api/workspace/invoices/settings", async ({ req, res }) => {
    const user = requireView(req);
    const s = settings();
    ok(res, { ...publicSettings(s, canUser(user, "invoices.settings")), edocEnabled, esmmAvailable: esmmEnabled, nextNumbers: nextNumbers(s), testNumbers: testNumbers(s), testSeries: TEST_SERIES, bankAccounts: bankAccountsState(s), problems: { KAGIT: sellerProblems("KAGIT", s), EARSIVFATURA: sellerProblems("EARSIVFATURA", s), TEMELFATURA: sellerProblems("TEMELFATURA", s) } });
  });
  router.put("/api/workspace/invoices/settings", async ({ req, res }) => {
    const user = auth.requirePermission(req, "invoices.settings");
    const body = await readJson(req);
    const previous = settings();
    const next = settingsInput(body, previous);
    store.tx(() => {
      store.setSetting(SETTINGS_KEY, JSON.stringify(next), user.id);
      // Günlüğe parola yazılmaz; yalnız değişip değişmediği.
      const integratorLog = { id: next.integrator.id, env: next.integrator.env, username: next.integrator.username, passwordChanged: next.integrator.passwordSealed !== previous.integrator.passwordSealed, autoSend: next.integrator.autoSend };
      audit(user, "invoice.settings.updated", "settings", { efatura: next.efatura, earsiv: next.earsiv, series: next.series, integrator: integratorLog });
    });
    publish(user, { kind: "invoices", settings: true });
    ok(res, { ...publicSettings(next), edocEnabled, esmmAvailable: esmmEnabled, nextNumbers: nextNumbers(next), testNumbers: testNumbers(next), testSeries: TEST_SERIES, bankAccounts: bankAccountsState(next), problems: { KAGIT: sellerProblems("KAGIT", next), EARSIVFATURA: sellerProblems("EARSIVFATURA", next), TEMELFATURA: sellerProblems("TEMELFATURA", next) } });
  });
  router.get("/api/workspace/invoices", async ({ req, res, url }) => {
    const user = requireView(req);
    safeRepeats();
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(url.searchParams.get("limit")) || 200)));
    const offset = Math.max(0, Math.trunc(Number(url.searchParams.get("offset")) || 0));
    const data = list(user, listQuery(url.searchParams), { offset, limit });
    ok(res, { ...data, offset, limit, hasMore: offset + limit < data.total });
  });
  // ---------- Tekrarlayan fatura ----------
  const REPEAT_SQL = "SELECT id, template_id AS templateId, every_months AS everyMonths, next_date AS nextDate, until_date AS untilDate, active, made, last_invoice_id AS lastInvoiceId FROM invoice_repeats";
  const repeatOf = templateId => store.get(`${REPEAT_SQL} WHERE template_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1`, templateId) || null;
  // Günü gelen tekrarlar için taslak hazırlar (en çok 12 dönem geriye). Deftere yazmaz; kullanıcı Taslaklar'dan keser.
  function runRepeats() {
    const day = today();
    const made = [];
    for (const rep of store.all(`${REPEAT_SQL} WHERE active = 1 AND next_date <= ?`, day)) {
      const template = store.get(`${INVOICE_SQL} WHERE i.id = ?`, rep.templateId);
      if (!template || template.status === "draft") continue;
      const system = { id: store.get("SELECT created_by AS id FROM invoice_repeats WHERE id = ?", rep.id).id, display_name: "Tekrarlayan Fatura", role: "admin", permissions: [] };
      let next = rep.nextDate;
      let count = 0;
      try {
        while (next <= day && count < 12 && (!rep.untilDate || next <= rep.untilDate)) {
          const lines = linesOf(template.id).map(line => ({ itemId: line.itemId, name: line.name, code: line.code, description: line.description, unit: line.unit, qty: line.qty, unitPrice: line.unitPrice, discountRate: line.discountRate, vatRate: line.vatRate, withholdingCode: line.withholdingCode, exemptionCode: line.exemptionCode, expenseCode: line.expenseCode }));
          const doc = documentInput({ kind: template.kind, scenario: template.scenario, accountId: template.accountId, issueDate: next, issueTime: template.issueTime, currency: template.currency, rate: template.rate, pricesIncludeVat: Boolean(template.pricesIncludeVat), discountRate: template.discountRate, stoppageRate: template.stoppageRate, note: template.note, lines, status: "draft" }, { mode: "draft" });
          doc.paymentDraft = { rest: "open" };
          const id = writeDraft(system, doc);
          made.push(id);
          count += 1;
          next = addMonths(next, rep.everyMonths);
          store.run("UPDATE invoice_repeats SET next_date = ?, made = made + 1, last_invoice_id = ?, updated_at = ? WHERE id = ?", next, id, now(), rep.id);
        }
        if (rep.untilDate && next > rep.untilDate) store.run("UPDATE invoice_repeats SET active = 0, updated_at = ? WHERE id = ?", now(), rep.id);
      } catch {
        // Şablonun carisi silinmiş ya da kalem artık geçersizse tekrar durur; kart üstünde görünür.
        store.run("UPDATE invoice_repeats SET active = 0, updated_at = ? WHERE id = ?", now(), rep.id);
      }
    }
    return made;
  }
  const safeRepeats = () => {
    try {
      return runRepeats();
    } catch {
      return [];
    }
  };
  router.post("/api/workspace/invoices/:id/repeat", async ({ req, res, params }) => {
    const user = requireManage(req);
    const row = invoiceRow(params.id);
    if (row.status !== "issued" || INVOICE_KINDS[row.kind].return) throw new HttpError(409, "Yalnız kaydedilmiş satış / alış faturası tekrarlanır.", { code: "repeat-invalid" });
    const body = await readJson(req);
    const every = Math.trunc(Number(body.everyMonths) || 0);
    if (every < 1 || every > 12) fail400("Tekrar aralığı 1 ile 12 ay arasında olmalı.", "everyMonths");
    const nextDate = text(body.nextDate) || addMonths(row.issueDate, every);
    if (!validDate(nextDate) || nextDate <= row.issueDate) fail400("İlk tekrar tarihi faturanın tarihinden sonra olmalı.", "nextDate");
    const untilDate = text(body.untilDate);
    if (untilDate && (!validDate(untilDate) || untilDate < nextDate)) fail400("Bitiş tarihi ilk tekrar tarihinden önce olamaz.", "untilDate");
    store.tx(() => {
      store.run("UPDATE invoice_repeats SET active = 0, updated_at = ? WHERE template_id = ? AND active = 1", now(), row.id);
      store.run("INSERT INTO invoice_repeats (id, template_id, every_months, next_date, until_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", newId("irep"), row.id, every, nextDate, untilDate, user.id, now());
      audit(user, "invoice.repeat.set", row.id, { every, nextDate, untilDate });
    });
    const made = safeRepeats();
    publish(user, { kind: "invoices", invoiceId: row.id });
    ok(res, { ...detail(row.id, user), repeatMade: made.length });
  });
  router.post("/api/workspace/invoices/:id/repeat-stop", async ({ req, res, params }) => {
    const user = requireManage(req);
    const row = invoiceRow(params.id);
    store.tx(() => {
      store.run("UPDATE invoice_repeats SET active = 0, updated_at = ? WHERE template_id = ? AND active = 1", now(), row.id);
      audit(user, "invoice.repeat.stop", row.id, {});
    });
    publish(user, { kind: "invoices", invoiceId: row.id });
    ok(res, detail(row.id, user));
  });

  // Kalem için ürün/hizmet araması (fatura yetkisiyle; stok ekranı yetkisi gerekmez): ad, kod; mevcut miktar, son alış
  // (maliyet) ve satış fiyatı.
  router.get("/api/workspace/invoices/items", async ({ req, res, url }) => {
    requireView(req);
    const needle = String(url.searchParams.get("q") || "").toLocaleLowerCase("tr-TR").trim().slice(0, 120);
    const rows = store.all("SELECT id, kind, code, name, unit, unit_price AS unitPrice, sale_price AS salePrice, vat_rate AS vatRate FROM stock_items WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE");
    const hits = [];
    // v2.0.16: Stok Kodu (barkod) tam eşleşmesi en üstte ve "exact" işaretli; faturada Enter ya da barkod okuyucu onu seçer.
    const exact = needle ? rows.find(row => row.code && row.code.toLocaleLowerCase("tr-TR") === needle) : null;
    for (const row of exact ? [exact, ...rows.filter(item => item !== exact)] : rows) {
      if (needle && !`${row.name} ${row.code}`.toLocaleLowerCase("tr-TR").includes(needle)) continue;
      const service = row.kind === "service";
      hits.push({ ...row, kind: row.kind || "product", unit: unitLabel(row.unit), exact: row === exact, available: service || !stock()?.invoiceStock ? null : stock().invoiceStock.available(row.id) });
      if (hits.length >= 25) break;
    }
    ok(res, { items: hits });
  });
  router.get("/api/workspace/invoices/returnable", async ({ req, res, url }) => {
    requireView(req);
    ok(res, { invoices: returnable({ side: text(url.searchParams.get("side")), q: text(url.searchParams.get("q")).slice(0, 120), accountId: text(url.searchParams.get("account")).slice(0, 120) }) });
  });
  router.get("/api/workspace/invoices/last-prices", async ({ req, res, url }) => {
    requireView(req);
    ok(res, lastPrices({ itemId: text(url.searchParams.get("item")).slice(0, 120), name: text(url.searchParams.get("name")).slice(0, 200), accountId: text(url.searchParams.get("account")).slice(0, 120) }));
  });
  router.get("/api/workspace/invoices/portfolio", async ({ req, res }) => {
    requireView(req);
    ok(res, { cheques: cheques()?.invoiceCheques ? cheques().invoiceCheques.portfolio() : [] });
  });
  // Ön hesap (kaydetmeden): ekranda görülen toplam deftere yazılanla aynı motordan.
  router.post("/api/workspace/invoices/calc", async ({ req, res }) => {
    requireView(req);
    const body = await readJson(req, { limit: 2_000_000 });
    // 2.4.3 (uzman UX2): tam iade Düzenle'de hiç kaydedilemiyordu — ön hesap düzenlenen iadenin kendi miktarını "önce iade edilen" sayıyordu
    // ("en çok 0 Adet iade edilebilir"). Form düzenlenen belgenin kimliğini gönderir; yalnız aynı asıl faturanın iadesiyse dışarıda bırakılır.
    const editedId = text(body.existingId);
    const exceptReturnId = editedId && text(body.originalId) ? store.get("SELECT id FROM invoices WHERE id = ? AND original_id = ? AND kind IN ('sale_return', 'purchase_return')", editedId, text(body.originalId))?.id || "" : "";
    const doc = documentInput(body, { mode: "draft", exceptReturnId });
    const t = doc.computed.totals;
    // 2.4.4 (UX15): numara / tarih çakışması (dönem kilidi, seri sırası, elle numara) onaydan ÖNCE — kayıttaki fonksiyonlarla, kaydetmeden, ağa
    // çıkmadan. Düzenle'de (existingId kayıtlı belge) Düzenle kuralı; taslak ve yeni belge yeni belge kuralıyla.
    const edited = editedId ? store.get("SELECT id FROM invoices WHERE id = ? AND status = 'issued' AND kind = ?", editedId, doc.kind) : null;
    const numbering = numberingCheck(doc, edited ? invoiceRow(edited.id) : null);
    ok(res, {
      kind: doc.kind,
      profile: doc.profile,
      profileLabel: PROFILES[doc.profile],
      profiles: allowedProfiles(doc.kind, doc.account, doc.settings).map(id => ({ id, label: PROFILES[id] })),
      typeCode: typeCode(doc.kind, doc.computed.lines),
      currency: doc.currency,
      rate: doc.rate,
      stoppageRate: doc.stoppageRate,
      lines: doc.computed.lines.map((line, index) => ({ net: c2(line.net), vat: c2(line.vat), withheld: c2(line.withheld), gross: c2(line.gross), payable: c2(line.payable), discount: c2(line.discount), base: c2(line.base), goods: doc.lines[index].goods, account: doc.lines[index].account, originLineId: doc.lines[index].originLineId })),
      totals: { base: c2(t.base), discount: c2(t.discount), baseNet: c2(t.baseNet), discountNet: c2(t.discountNet), net: c2(t.net), vat: c2(t.vat), withheld: c2(t.withheld), stoppage: c2(t.stoppage), gross: c2(t.gross), payable: c2(t.payable), goodsNet: c2(t.goodsNet), serviceNet: c2(t.serviceNet), byRate: t.byRate.map(item => ({ rate: item.rate, net: c2(item.net), vat: c2(item.vat) })), byWithholding: t.byWithholding.map(item => ({ code: item.code, num: item.num, den: item.den, vat: c2(item.vat), withheld: c2(item.withheld) })) },
      try: { net: c2(doc.money.net), vat: c2(doc.money.vat), withheld: c2(doc.money.withheld), stoppage: c2(doc.money.stoppage), payable: c2(doc.money.payable) },
      amountInWords: amountInWords(c2(t.payable), doc.currency),
      party: doc.party,
      partyProblems: doc.profile === "KAGIT" ? [] : partyProblems(doc.party, { profile: doc.profile === "EARSIVFATURA" || doc.profile === "ESMM" ? "EARSIV" : "EFATURA", role: "buyer", payable: c2(doc.money.payable) }),
      // 2.4.4 (uzman UX9): sorunların cari kartındaki alanları — fatura formu "Cariyi Düzenle"de bunları zorunlu işaretler (denetimin kendisi değişmez).
      partyFields: doc.profile === "KAGIT" ? [] : [...new Set(partyIssues(doc.party, { profile: doc.profile === "EARSIVFATURA" || doc.profile === "ESMM" ? "EARSIV" : "EFATURA", role: "buyer", payable: c2(doc.money.payable) }).map(issue => issue.field))],
      warnings: docWarnings(doc),
      sellerProblems: doc.profile === "KAGIT" || !doc.meta.own ? [] : sellerProblems(doc.profile, doc.settings),
      dueDays: Number(doc.account.dueDays) || Number(doc.settings.defaults.dueDays) || 0,
      nextNumber: doc.meta.own ? nextNumber(seriesFor(doc.kind, doc.profile, doc.settings), Number(doc.date.slice(0, 4)), doc.settings).number : "",
      // 2.4.3 (keşif B7): kesimi kesin reddedecek sorunlar (writeIssued'ın e-Belge denetiminin aynısı) — form, numaralı onay penceresini açmadan söyler.
      blockers: [...issueBlockers(doc), ...numbering.problems],
      // UX15: formda gösterilecek çakışmalar (blockers'ın içinde de) ve numaranın kayıtta verilmeyeceği durum (O1: seride daha eski bekleyen).
      numbering: numbering.problems,
      orderHold: numbering.orderHold,
      // MM1: iade formunun e-Belge referansı alanı (asıl numara 16 karakter değilse gerekli; öneri sunucuda da aynı kuralla).
      ...(doc.meta.return && doc.meta.own && doc.original ? { returnRef: { needed: doc.profile !== "KAGIT" && String(doc.original.number || "").trim().length !== 16, original: doc.original.number || "", suggested: returnRefSuggestion(doc.original.number), value: doc.returnRef || "" } } : {}),
      // Posta kutusu seçilmemiş e-Fatura alıcısı: "Kaydet ve Gönder" / düz Kaydet numara harcamadan durur (Kaydet, Sonra Gönder serbest).
      aliasBlock: aliasMissing(doc) ? aliasBlockText() : "",
    });
  });
  // SMM "Netten Brüte" (2.4.4 madde 26): istenen Net Ücretten (brüt − stopaj, KDV hariç; makbuzun tamamı) ilk kalemin birim fiyatı. Gövde formun
  // ön hesap gövdesidir (calc ile aynı) + net. Belge kaydın KENDİ yolundan çözülür (documentInput → computeInvoice): stopaj oranı kayıtta hangisi
  // uygulanacaksa o — kutu boşsa alıcıya göre (şirket alıcıda ayardaki oran, gerçek kişide 0; GVK md. 94), yazılmışsa yazılan —; KDV dahil fiyat,
  // iskontolar ve öbür kalemler de hesaba girer. Önceden istemci kutu boşken her alıcıda ayardaki oranı (%20) gönderiyor, KDV dahil fiyatı ve
  // iskontoyu bilmiyordu: gerçek kişi alıcıda brüt %25 fazla, "Fiyatlar KDV Dahil"de matrah KDV kadar eksik yazılıyordu.
  router.post("/api/workspace/invoices/gross-from-net", async ({ req, res }) => {
    requireView(req);
    const body = await readJson(req, { limit: 2_000_000 });
    const target = numberOf(body.net, "Net ücret", "net", { min: 0, max: 1e12 });
    if (!(target > 0)) fail400("Net ücreti sıfırdan büyük bir tutar olarak yazın.", "net");
    const lines = Array.isArray(body.lines) && body.lines.length ? body.lines : [{}];
    const first = { ...(lines[0] && typeof lines[0] === "object" ? lines[0] : {}), qty: 1, unitPrice: roundMoney(target) };
    if (!text(first.name) && !text(first.itemId)) first.name = "Serbest meslek ücreti";
    const doc = documentInput({ ...body, lines: [first, ...lines.slice(1)] }, { mode: "draft" });
    if (doc.kind !== "smm") fail400("Netten Brüte yalnız serbest meslek makbuzunda kullanılır.", "kind");
    let found;
    try {
      found = priceForNetFee(doc.lines, 0, cents(target), { pricesIncludeVat: doc.pricesIncludeVat, discountRate: doc.discountRate, stoppageRate: doc.stoppageRate });
    } catch (error) {
      if (error instanceof InvoiceInputError) fail400(error.message, error.field);
      throw error;
    }
    if (!found) fail400("Öbür kalemlerin net ücreti yazdığınız tutarı aşıyor; tutarı büyütün ya da öbür kalemleri çıkarın.", "net");
    const t = found.totals;
    ok(res, { unitPrice: found.unitPrice, gross: c2(t.net), stoppageRate: doc.stoppageRate, stoppage: c2(t.stoppage), net: c2(t.net - t.stoppage), vat: c2(t.vat), withheld: c2(t.withheld), payable: c2(t.payable) });
  });
  router.post("/api/workspace/invoices", async ({ req, res }) => {
    const user = requireManage(req);
    const body = await readJson(req, { limit: 2_000_000 });
    // v2.0.22 (madde 5): istek kimliği — aynı formun ikinci gönderimi (yanıt gecikince yeniden Kaydet, ağ tekrarı) ikinci
    // belge açmaz; ilk belge döner. Denetim ile kayıt arasında bekleme (await) yoktur: aynı anda gelen iki istekten biri
    // kaydeder, öbürü onun sonucunu görür. Taslak ve kayıt AYNI işlemdir (bir form = bir belge): "Taslak Olarak Kaydet"in
    // yanıtı kaybolup ardından "Kaydet"e basılırsa ikinci belge açılmaz, taslak söylenir. İlk belge sonradan silindiyse
    // yineleme yeni belge açmaz; nedeni söylenir.
    const requestKey = requests.key(user, "invoice.create", req.headers["x-hof-request"] || body.requestId);
    const hash = requestKey ? bodyHash(body) : "";
    const gone = () => new HttpError(409, "Bu formla kaydedilen belge sonradan silindi; yeniden kaydetmek için yeni bir fatura başlatın.", { code: "request-id-gone" });
    const prior = requests.lookup(requestKey, hash, refId => {
      const row = store.get("SELECT number, kind, status FROM invoices WHERE id = ?", refId);
      if (!row) throw gone();
      if (row.status === "draft") return "Bu form taslak olarak zaten kaydedildi; ikinci belge açılmadı. Taslağı Taslaklar sekmesinden açıp kaydedin.";
      return `Bu ${label(row).toLocaleLowerCase("tr-TR")} zaten kaydedildi${row.number ? ` (${row.number})` : ""}; sonradan yapılan değişiklik yeni belge açmaz. Kayıtlı belgeyi açıp Düzenle'yi kullanın ya da yeni bir fatura başlatın.`;
    });
    if (prior) {
      if (!store.get("SELECT 1 AS found FROM invoices WHERE id = ?", prior.refId)) throw gone();
      return ok(res, { ...detail(prior.refId, user), replayed: true });
    }
    // Kimlik belgeyle AYNI işlemde yazılır (v2.1.0): biri geri alınırsa (kapı sapması, kimlik yazılamadı) ikisi birden.
    if (body.status === "draft") {
      const doc = documentInput(body, { mode: "draft" });
      doc.paymentDraft = body.payment && typeof body.payment === "object" ? body.payment : {};
      const id = store.tx(() => {
        const written = writeDraft(user, doc);
        requests.remember(requestKey, hash, written);
        return written;
      });
      return ok(res, detail(id, user));
    }
    const doc = documentInput(body, { mode: "issue" });
    assertAliasBeforeNumber(doc, body);
    await assertArchiveBuyerBeforeNumber(user, doc, body);
    const loginHold = await sendLoginBlock(doc, body);
    const payment = paymentInput(body, doc, user);
    const result = store.tx(() => {
      const written = writeIssued(user, doc, payment, { force: forceOf(body), defer: body.eSend === "later" || Boolean(loginHold) });
      requests.remember(requestKey, hash, written.id);
      return written;
    });
    const autoSend = loginHold ? loginHoldResult(loginHold) : result.orderHeld ? orderHeldResult(result.orderHeld) : await sendChoice(user, result.id, body.eSend);
    ok(res, { ...detail(result.id, user), ...(autoSend ? { autoSend } : {}) });
  });
  router.put("/api/workspace/invoices/:id", async ({ req, res, params }) => {
    const user = requireManage(req);
    const existing = invoiceRow(params.id);
    if (existing.status !== "draft") throw new HttpError(409, "Yalnız taslak fatura düzeltilir; kesilmiş fatura iptal edilir ya da iade faturası kesilir.", { code: "invoice-not-draft" });
    const body = await readJson(req, { limit: 2_000_000 });
    const doc = documentInput(body, { mode: "draft", existing });
    doc.paymentDraft = body.payment && typeof body.payment === "object" ? body.payment : parseJson(existing.paymentJson, {});
    writeDraft(user, doc, { id: existing.id });
    ok(res, detail(existing.id, user));
  });
  // Taslağı kes: gövdedeki alanlar taslağın üstüne yazılır (Düzenle ve Kes); toplu kesmede yalnız zorlama ve e-Belge seçimi gelir.
  // access (isteğe bağlı; Seçilenleri Kaydet): aynı istekteki taslakların ortak erişim sonucu. Giriş reddedildi ya da EDM'ye ulaşılamadıysa
  // öbür taslaklar için entegratöre YENİDEN gidilmez (dar kontrol 2.4.3: EDM hesabı ardışık hatalı girişte kilitlenebilir).
  async function issueDraft(user, id, body, access = null) {
    const existing = invoiceRow(id);
    if (existing.status !== "draft") throw new HttpError(409, "Bu fatura zaten kaydedilmiş.", { code: "invoice-not-draft" });
    const lines = linesOf(existing.id).map(line => ({ itemId: line.itemId, name: line.name, code: line.code, description: line.description, unit: line.unit, qty: line.qty, unitPrice: line.unitPrice, discountRate: line.discountRate, vatRate: line.vatRate, withholdingCode: line.withholdingCode, exemptionCode: line.exemptionCode, expenseCode: line.expenseCode, originLineId: line.originLineId }));
    const merged = { kind: existing.kind, scenario: existing.scenario, accountId: existing.accountId, originalId: existing.originalId, lines, buyer: parseJson(existing.partyJson, {}), payment: parseJson(existing.paymentJson, {}), ...body };
    const doc = documentInput(merged, { mode: "issue", existing });
    assertAliasBeforeNumber(doc, body);
    const known = access?.hold && sendWouldContact(doc, body) ? access.hold : "";
    if (!known) await assertArchiveBuyerBeforeNumber(user, doc, body);
    const loginHold = known || (await sendLoginBlock(doc, body));
    if (loginHold && access) access.hold = loginHold;
    const payment = paymentInput(merged, doc, user);
    const written = writeIssued(user, doc, payment, { id: existing.id, force: forceOf(body), defer: body.eSend === "later" || Boolean(loginHold) });
    const autoSend = loginHold ? loginHoldResult(loginHold) : written.orderHeld ? orderHeldResult(written.orderHeld) : await sendChoice(user, existing.id, body.eSend);
    return { ...detail(existing.id, user), ...(autoSend ? { autoSend } : {}) };
  }
  // Portaldaki taslak (İz 7.3) EDM portalından gönderilmiş olabilir (bitiş turu, eleştirmen E2: taslak portaldan 1.200 TL gönderildi, programda
  // 6.000 TL'ye düzenlendi — defter ile yasal belge ayrıştı). Taslaktaki belge düzenlenmeden / iptal edilmeden önce EDM'ye sorulur: artık taslak
  // değilse durum güncellenir ve işlem reddedilir; portaldan silinmişse (EDM'de yok) belge e-Belge durumundan çıkar. EDM'ye ulaşılamazsa reddedilir.
  async function confirmDraft(user, id) {
    const row = invoiceRow(id);
    if (!edocEnabled || row.eStatus !== "draft") return;
    const doc = detail(row.id, user);
    let remote;
    try {
      remote = await integrator().status({ invoice: doc });
    } catch (error) {
      if (!remoteMissing(error, row.profile)) throw error;
      clearE(user, row.id, "Taslak EDM portalında bulunamadı (portaldan silinmiş); belge e-Belge olarak yeniden gönderilebilir.");
      return;
    }
    if (remote.status === "draft") return;
    setE(user, row.id, { status: remote.status, message: remote.message }, "invoice.e.status", { raw: remote.raw || "" });
    throw new HttpError(409, `Taslak EDM'de artık taslak değil (portaldan gönderilmiş olabilir; durum: ${E_STATES[remote.status] || remote.status}). Durum güncellendi; belge bu hâliyle değiştirilmez.`, { code: "einvoice-draft-gone" });
  }
  router.post("/api/workspace/invoices/:id/edit", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req, { limit: 2_000_000 });
    const release = holdInvoice(params.id, "editing");
    let result;
    try {
      await confirmDraft(user, params.id);
      result = editInvoice(user, params.id, body);
    } finally {
      release();
    }
    ok(res, detail(result.id, user));
  });
  router.post("/api/workspace/invoices/:id/issue", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req, { limit: 2_000_000 });
    ok(res, await issueDraft(user, params.id, body));
  });
  // Toplu işlemler (v2.0.15, QA A6): seçilen taslaklar tarih sırasıyla kesilir, seçilen belgeler iptal edilir. Her belge
  // kendi işleminde (biri düşerse diğerleri etkilenmez); sonuç belge belge döner. En çok 200 belge.
  const bulkIds = body => [...new Set((Array.isArray(body.ids) ? body.ids : []).map(value => text(value)).filter(Boolean))].slice(0, 200);
  // POS İşlemi seçimi (plan §3.8 Fatura): "refunded" = Müşteriye İade Edildi (varsayılan), "entry-error" = Kayıt Hatası (POS işlemi hiç olmadı).
  const posOutcomeOf = body => (text(body?.posOutcome) === "entry-error" ? "entry-error" : "refunded");
  // Hakem K5: banka hesabının eksi bakiye reddi Kasa'nınkiyle aynı kodu (cash-negative) taşır; accountId istemcinin sorusunu ayırır.
  const bulkError = error => ({ ok: false, message: error?.message || String(error), code: error?.extra?.code || "", status: error?.status || 500, ...(error?.extra?.accountId ? { accountId: error.extra.accountId } : {}) });
  router.post("/api/workspace/invoices/bulk-issue", async ({ req, res }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const ids = bulkIds(body);
    if (!ids.length) fail400("Kaydedilecek taslak seçilmedi.", "ids");
    const rows = ids.map(id => {
      try {
        return invoiceRow(id);
      } catch (error) {
        return { id, missing: error };
      }
    });
    // Tarih sırası: eski tarihli taslak önce kesilir (seri kronolojisi; aynı günde kayıt sırası).
    rows.sort((a, b) => `${a.issueDate || ""} ${a.issueTime || ""} ${a.createdAt || ""}`.localeCompare(`${b.issueDate || ""} ${b.issueTime || ""} ${b.createdAt || ""}`));
    // 2.4.3 (keşif B3): seçim gelmezse Entegratör Ayarları'ndaki "Toplu kaydedilen faturalar entegratöre hemen gönderilsin" uygulanır — kapalıyken
    // belge "Kes, Sonra Gönder" gibi numarasız Gönderilecekler'de bekler (önceden numara alıp gönderilmeden, hiçbir listede görünmeden kalıyordu).
    const autoSend = edocEnabled && settings().integrator?.autoSend === true;
    const options = { force: body.force === true, cashForce: body.cashForce === true, eSend: body.eSend === "later" ? "later" : body.eSend === "now" ? "now" : edocEnabled && !autoSend ? "later" : "" };
    const results = [];
    const access = {};
    for (const row of rows) {
      if (row.missing) {
        results.push({ id: row.id, ...bulkError(row.missing) });
        continue;
      }
      try {
        const doc = await issueDraft(user, row.id, options, access);
        results.push({ id: row.id, ok: true, number: doc.number, displayNo: doc.displayNo, accountName: doc.accountName, payable: doc.payableTotal, ...(doc.autoSend ? { autoSend: doc.autoSend } : {}) });
      } catch (error) {
        results.push({ id: row.id, accountName: row.accountName, ...bulkError(error) });
      }
      // 2.3.0 (İz 3.4; plan A7 "kesim sürerken başka kullanıcının tekil tahsilatı beklemez"): her belge kendi bank.post işleminde (store.tx) kesilir;
      // belgeler arasında olay döngüsüne dönülür ki başka isteğin (tekil tahsilat, liste) yanıtı 200 belgenin sonunu beklemesin. e-Belge kapalıyken
      // issueDraft'ın await'i gerçek G/Ç'ye inmez, döngü tek parça koşardı.
      await new Promise(resolve => setImmediate(resolve));
    }
    // Erişim sonucu tek ileti (her taslağa ayrı ayrı yazılmaz; ekran bir kez gösterir).
    ok(res, { results, issued: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length, ...(access.hold ? { notice: loginHoldResult(access.hold).message.replace("belge numarasız Gönderilecekler'e eklendi", "belgeler numarasız Gönderilecekler'e eklendi").replace("Belge numara verilmeden Gönderilecekler'e eklendi", "Belgeler numara verilmeden Gönderilecekler'e eklendi") } : {}) });
  });
  router.post("/api/workspace/invoices/bulk-cancel", async ({ req, res }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const ids = bulkIds(body);
    if (!ids.length) fail400("İptal edilecek belge seçilmedi.", "ids");
    // Yargıç K3: gövdedeki negativeOk / cashForce (Uyar'daki hesap için "Yine de İptal Et"; hakem K5 negativeConfirmed) toplu silmedeki gibi işlenir; Engelle hiçbir koşulda delinmez.
    // 2.3.0 (İz 3.2, plan §3.8 Fatura / §4.6): toplu iptalde de POS İşlemi seçimi (posOutcome) belge belge uygulanır; önceden toplu yol seçimi
    // taşımıyordu — "Kayıt Hatası" seçilse de İptal İadesi yapılıyordu.
    const options = { reason: text(body.reason), force: body.force === true, cashForce: body.cashForce === true, negativeOk: typeof body.negativeOk === "boolean" ? body.negativeOk : undefined, confirmExternal: body.confirmExternal === true, localOnly: body.localOnly === true, confirmLocal: body.confirmLocal === true, posOutcome: posOutcomeOf(body) };
    const results = [];
    // Yeni tarihli belge önce iptal edilir (iade faturası asıl faturadan önce; aynı seçimde ikisi de varsa sıra tutar).
    const rows = ids.map(id => {
      try {
        return invoiceRow(id);
      } catch (error) {
        return { id, missing: error };
      }
    });
    rows.sort((a, b) => `${b.issueDate || ""} ${b.createdAt || ""}`.localeCompare(`${a.issueDate || ""} ${a.createdAt || ""}`));
    for (const row of rows) {
      if (row.missing) {
        results.push({ id: row.id, ...bulkError(row.missing) });
        continue;
      }
      try {
        const doc = await cancelInvoice(user, row.id, options);
        results.push({ id: row.id, ok: true, number: doc.number, displayNo: doc.displayNo, accountName: doc.accountName, ...(doc.notices?.length ? { notices: doc.notices } : {}) });
      } catch (error) {
        results.push({ id: row.id, number: row.number, accountName: row.accountName, ...bulkError(error) });
      }
    }
    ok(res, { results, cancelled: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length });
  });
  // ---------- Silme (v2.0.17, müşteri: "tümünü seçip komple sil; kartta Sil") ----------
  // Taslak: deftere girmemişti, doğrudan Silinenler'e. Kaydedilmiş: önce iptal (bütün etkiler tek işlemde geri alınır:
  // stok, cari, Kasa, taksit, çek/senet; mutabakat kapısı), sonra Silinenler'e. İptal edilmiş: Silinenler'e. Belge
  // satırlarıyla birlikte Silinenler'de saklanır; geri yüklenirse etkisiz, "İptal Edildi" olarak döner. Numara: silinen
  // belge serinin son numarasıysa sayaç kendiliğinden geri gelir (MAX(seq)); aradaysa boşluk kalır.
  function deleteBlock(row, activeReturns = 0, plan = null) {
    if (row.status === "draft") return "";
    const lock = period?.lockedUntil?.();
    if (lock && row.issueDate <= lock) return `Belge ${dayText(row.issueDate)} tarihli; ${dayText(lock)} ve öncesi kilitli dönem. Silmek için dönem kilidi açılmalı.`;
    // Dar kontrol turu 3 (B2): numarası entegratörde kullanılmış (ya da kullanılmış olabilecek) iptal belgesi silinirse seri MAX(seq) ile geri gelir
    // ve aynı e-Belge numarası yeni belgeye verilir (EDM'de ilk belge durur). Entegratör izi olan iptal belgesi "İptal Edildi" olarak kalır.
    // Kontrol turu 4: kural iptal edilmemiş belgede de geçerli — "İşleniyor", "Reddedildi", "Hata" durumundaki kaydedilmiş belge doğrudan Sil ile
    // (arkada onaysız iptal) silinip numarası yeniden veriliyordu.
    const traced = Boolean(row.number) && (Boolean(row.eAdapter) || E_TRACKED.has(row.eStatus));
    if (row.status === "cancelled") return traced ? "Bu belgenin numarası entegratörde (EDM) kullanıldı; e-Belge numarası yeniden verilemeyeceği için belge silinmez, “İptal Edildi” olarak kalır." : "";
    const fee = bankFeeOf(row.id);
    if (fee) return bankFeeText(fee);
    if (activeReturns) return `Bu faturanın ${activeReturns} iade faturası var; önce iade faturalarını silin ya da iptal edin.`;
    if (["sent", "accepted"].includes(row.eStatus)) return `Bu belge e-Belge olarak ${(E_STATES[row.eStatus] || "gönderildi").toLocaleLowerCase("tr-TR")}; silinmez. Önce entegratör tarafında iptal edin.`;
    if (uncertainSend(row)) return UNCERTAIN_TEXT;
    if (row.eStatus === "draft") return "Bu belge EDM portalına taslak olarak yüklendi; silinmez. Önce İptal edin (e-Arşiv taslağı EDM'de de iptal edilir; e-Fatura taslağını EDM portalından silin).";
    if (traced) return `Bu belge entegratöre (EDM) iletildi (durum: ${E_STATES[row.eStatus] || row.eStatus}); numarası kullanıldı, silinmez. Gerekirse İptal edin: belge “İptal Edildi” olarak kalır.`;
    const planId = plan?.id || row.planId;
    if (planId && store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", planId).n) return "Faturanın taksit kartında tahsilat var; silinmez. Önce tahsilatları silin ya da iade faturası kaydedin.";
    return "";
  }
  function deleteInvoice(user, id, { reason = "", force = {}, posOutcome = "refunded" } = {}) {
    const row = bank.post({ user, module: "invoice", op: "delete", prev: { invoiceId: id }, posOutcome: posOutcome === "entry-error" ? "entry-error" : "refunded", write: () => {
      let invoice = invoiceRow(id);
      assertNotBusy(invoice.id);
      const activeReturns = store.get("SELECT COUNT(*) AS n FROM invoices WHERE original_id = ? AND status = 'issued'", invoice.id).n;
      const block = deleteBlock(invoice, activeReturns);
      if (block) throw new HttpError(409, block, { code: "invoice-locked" });
      if (invoice.status === "issued") {
        // Etkiler iptaldeki gibi geri alınır (çeki işlem görmüş, taksitinden tahsilat alınmış belge burada 409 verir).
        cancel(user, invoice.id, { reason: reason || "Silindi", force, posOutcome });
        invoice = invoiceRow(id);
      }
      const raw = store.get("SELECT * FROM invoices WHERE id = ?", invoice.id);
      const lines = store.all("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY seq", invoice.id);
      trash?.add({
        kind: "invoice",
        ref: invoice.id,
        title: `${INVOICE_KINDS[invoice.kind]?.label || "Fatura"} ${displayNo(invoice) || ""}`.trim(),
        detail: [parseJson(invoice.partyJson, {}).name || invoice.accountName, tl(invoice.tryPayable), dayText(invoice.issueDate)].filter(Boolean).join(" · "),
        payload: { invoice: raw, lines, wasStatus: invoice.status, reason: limited(reason, 300, "Silme nedeni") },
        user,
      });
      store.run("DELETE FROM invoice_lines WHERE invoice_id = ?", invoice.id);
      store.run("DELETE FROM invoices WHERE id = ?", invoice.id);
      // Gelen e-Faturadan açılan belge silinirse kutudaki belge yeniden "Yeni" olur (tekrar alınabilir).
      store.run("UPDATE einvoice_inbox SET state = 'new', invoice_id = '', updated_at = ? WHERE invoice_id = ?", now(), invoice.id);
      store.run("UPDATE invoice_repeats SET active = 0, updated_at = ? WHERE template_id = ? AND active = 1", now(), invoice.id);
      audit(user, invoice.status === "draft" ? "invoice.draft.deleted" : "invoice.deleted", invoice.id, { number: invoice.number, kind: invoice.kind, accountId: invoice.accountId, payable: invoice.tryPayable, wasStatus: invoice.status, reason });
      return invoice;
    } });
    publish(user, { kind: "invoices", invoiceId: row.id, accountId: row.accountId });
    return row;
  }
  // Silinenler'den geri yükleme: belge satırlarıyla geri gelir; kaydedilmiş belge iptal edilerek silindiğinden "İptal
  // Edildi" olarak döner (etkisiz). Numarası bu arada başka belgeye verildiyse numara metni kalır, sıra numarası düşer.
  function restoreDeleted(user, item, payload) {
    const raw = payload?.invoice;
    if (!raw?.id) throw new HttpError(409, "Belgenin bilgisi eksik; geri yüklenemez.");
    if (store.get("SELECT 1 AS found FROM invoices WHERE id = ?", raw.id)) throw new HttpError(409, "Bu belge zaten geri yüklenmiş.");
    if (raw.account_id && accounts()?.exists && !accounts().exists(raw.account_id)) throw new HttpError(409, "Belgenin carisi silinmiş. Önce cariyi geri yükleyin.");
    const row = { ...raw };
    let renumbered = false;
    if (row.status === "issued") {
      row.status = "cancelled";
      row.cancelled_by = user.id;
      row.cancelled_at = now();
      row.cancel_reason = row.cancel_reason || "Silinmişti; geri yüklendi (etkisiz)";
    }
    if (Number(row.seq) > 0 && store.get("SELECT 1 AS found FROM invoices WHERE series = ? AND year = ? AND seq = ?", row.series, row.year, row.seq)) {
      row.seq = 0;
      renumbered = true;
    }
    if (row.ettn && store.get("SELECT 1 AS found FROM invoices WHERE ettn = ?", row.ettn)) row.ettn = randomUUID();
    row.updated_by = user.id;
    row.updated_at = now();
    store.tx(() => {
      store.run(`INSERT INTO invoices (${Object.keys(row).join(", ")}) VALUES (${Object.keys(row).map(() => "?").join(", ")})`, ...Object.values(row));
      for (const line of payload.lines || []) store.run(`INSERT INTO invoice_lines (${Object.keys(line).join(", ")}) VALUES (${Object.keys(line).map(() => "?").join(", ")})`, ...Object.values(line));
      trash?.markRestored(item.id, user);
      audit(user, "invoice.restored", row.id, { number: row.number, kind: row.kind, status: row.status, renumbered });
    });
    publish(user, { kind: "invoices", invoiceId: row.id, accountId: row.account_id });
    return `${INVOICE_KINDS[row.kind]?.label || "Belge"} ${row.number || ""} geri geldi (${row.status === "draft" ? "taslak" : "iptal edilmiş, etkisiz"}${renumbered ? "; numarası bu arada başka belgeye verildiği için sıra numarası düştü" : ""}).`;
  }
  router.delete("/api/workspace/invoices/:id", async ({ req, res, params, url }) => {
    const user = requireManage(req);
    const row = deleteInvoice(user, params.id, { reason: text(url.searchParams.get("reason")).slice(0, 300), force: { stock: url.searchParams.get("force") === "1", cash: url.searchParams.get("cashForce") === "1", negative: negativeConfirmed(null, url) }, posOutcome: text(url.searchParams.get("posOutcome")) === "entry-error" ? "entry-error" : "refunded" });
    ok(res, { id: row.id, number: row.number, status: row.status });
  });
  // Toplu silme: iade belgeleri önce (yeni tarihli önce), sonra öbürleri yeni tarihliden eskiye (serinin son numarası
  // silinince sayaç geri gelir). Her belge kendi işleminde; sonuç belge belge.
  router.post("/api/workspace/invoices/bulk-delete", async ({ req, res }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const ids = bulkIds(body);
    if (!ids.length) fail400("Silinecek belge seçilmedi.", "ids");
    const rows = ids.map(id => {
      try {
        return invoiceRow(id);
      } catch (error) {
        return { id, missing: error };
      }
    });
    const stamp = row => `${row.issueDate || ""} ${row.issueTime || ""} ${row.createdAt || ""}`;
    rows.sort((a, b) => Number(Boolean(INVOICE_KINDS[b.kind]?.return)) - Number(Boolean(INVOICE_KINDS[a.kind]?.return)) || stamp(b).localeCompare(stamp(a)));
    const results = [];
    for (const row of rows) {
      if (row.missing) {
        results.push({ id: row.id, ...bulkError(row.missing) });
        continue;
      }
      try {
        const doc = deleteInvoice(user, row.id, { reason: limited(body.reason, 300, "Silme nedeni"), force: forceOf(body), posOutcome: posOutcomeOf(body) });
        results.push({ id: row.id, ok: true, number: doc.number, displayNo: displayNo(doc), accountName: parseJson(doc.partyJson, {}).name || doc.accountName, amount: doc.tryPayable });
      } catch (error) {
        results.push({ id: row.id, number: row.number, displayNo: displayNo(row), accountName: parseJson(row.partyJson, {}).name || row.accountName, ...bulkError(error) });
      }
    }
    ok(res, { results, deleted: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length });
  });
  // K4: iptal edilince Kapatılacak Fatura bağı kalkacak, şüpheli alacağı açık carideki "Normal Cariye İşlendi" tahsilatlar.
  function doubtfulRelinks(invoiceId) {
    return store.all(
      `SELECT e.id, e.date, e.amount FROM account_entries e
       WHERE e.invoice_id = ? AND e.kind = 'in' AND e.doubtful_skip = 0 AND e.source <> 'invoice'
         AND EXISTS (SELECT 1 FROM doubtful_receivables d WHERE d.account_id = e.account_id AND d.status NOT IN ('cancelled', 'released'))
       ORDER BY e.date, e.rowid`,
      invoiceId,
    );
  }
  function doubtfulRelinkText(list, { done = false } = {}) {
    if (!list.length) return "";
    const total = list.reduce((sum, entry) => sum + Math.round((Number(entry.amount) || 0) * 100), 0) / 100;
    const what = list.length === 1 ? `Bu faturaya bağlı ${moneyText(total)} tahsilat` : `Bu faturaya bağlı ${list.length} tahsilat (toplam ${moneyText(total)})`;
    return done
      ? `${what} artık şüpheli alacaktan düşüyor (faturayla bağı kalktı). Normal cari hesapta kalmasını isterseniz cari kartında tahsilatı açıp "Normal Cari Hesaba İşle"yi işaretleyin.`
      : `${what} şu an normal cari hesaba işli (cari şüpheli alacakta). Fatura iptal edilince bağı kalkar ve tahsilat şüpheli alacaktan düşer. Normal cari hesapta kalmasını isterseniz iptalden sonra cari kartında tahsilatı açıp "Normal Cari Hesaba İşle"yi işaretleyin.`;
  }
  // Belge başına tek entegratör işlemi (gönderim YA DA iptal). Yük denemesi (iki şirket, on kullanıcı; dar kontrol turu 3 B6): iki kullanıcı aynı
  // e-Arşivi aynı anda iptal edince ikisi de entegratöre iptal gönderiyordu. Kontrol turu 4: gönderim sürerken başka kullanıcı iptal edebiliyordu
  // (numaralı, durumu "none" belge onaysız iptal edilir; gönderim bitince iptal edilmiş belge "Gönderildi" olur — GİB'de geçerli, defterde iptal).
  // Kontrol turu 5: Sil ve Düzenle de aynı kilide bakar — gönderim sürerken silinen belge EDM'de geçerli kalıp numarası yeniden veriliyordu, düzenlenen
  // belgede defter (6.000 TL) ile GİB'e giden belge (1.200 TL) ayrışıyordu.
  const busy = new Map();
  const BUSY_TEXT = {
    sending: ["Bu belge şu anda gönderiliyor; birkaç saniye bekleyin.", "einvoice-sending"],
    cancelling: ["Bu belge şu anda başka bir kullanıcı tarafından iptal ediliyor; birkaç saniye sonra yenileyin.", "invoice-cancelling"],
    editing: ["Bu belge şu anda başka bir kullanıcı tarafından düzenleniyor; birkaç saniye sonra yenileyin.", "invoice-editing"],
  };
  // Kontrol turu 6: anahtar her zaman belgenin kayıtlı kimliği (istekteki kimlik boşluklu / farklı yazılmış olsa da aynı kilide düşer).
  const busyKey = id => invoiceRow(id).id;
  function assertNotBusy(id) {
    const held = busy.get(busyKey(id));
    if (held) throw new HttpError(409, BUSY_TEXT[held][0], { code: BUSY_TEXT[held][1] });
  }
  function holdInvoice(id, kind) {
    const key = busyKey(id);
    assertNotBusy(key);
    busy.set(key, kind);
    return () => busy.delete(key);
  }
  async function cancelInvoice(user, id, body) {
    const release = holdInvoice(id, "cancelling");
    try {
      return await cancelInvoiceOnce(user, id, body);
    } finally {
      release();
    }
  }
  // Kullanıcı kararı 22.10.2026 (madde 23 ek): sonucu BELİRSİZ gönderimde "Yalnız Programda İptal", son gönderim girişiminden 8 gün geçtiyse önce EDM'ye
  // sorar. EDM "bulunamadı" (11017) derse belge iletilmemiştir → iptal serbest (true döner). Belge EDM'de varsa durum belgeye yazılır ve iptal reddedilir
  // (iletilmişse süre doldu). EDM'ye ulaşılamazsa ya da yanıt tanınmazsa iptal yapılmaz. e-SMM'de de "bulunamadı" 11017 (madde 24'te gerçek EDM'de doğrulandı).
  // 8 gün dolmadıysa sorulmaz (bugünkü K4 çıkış yolu aynen; false döner).
  async function uncertainLocalCheck(user, row) {
    const limit = edocEnabled ? attemptWindow({ profile: row.profile, issueDate: row.issueDate, transmittedAt: transmittedAtOf(row.id), today: today() }) : null;
    if (!limit?.late) return false;
    const since = `Son gönderim girişiminin (${dayText(limit.start)}) üzerinden ${limit.days} günden fazla geçti; belgenin EDM'de olup olmadığı sorulmadan yalnız programda iptal edilmez.`;
    let remote;
    try {
      remote = await integrator().status({ invoice: detail(row.id, user) });
    } catch (error) {
      if (remoteMissing(error, row.profile)) return true;
      const code = error?.extra?.code || error?.code || "";
      const reason = String(error?.message || error).slice(0, 300);
      if (["integrator-unreachable", "integrator-uncertain"].includes(code)) throw new HttpError(502, `${since} EDM'ye ulaşılamadı (${reason}). İptal yapılmadı; bağlantı kurulunca yeniden deneyin.`, { code: "einvoice-cancel-unreachable", lastDay: limit.lastDay });
      throw new HttpError(409, `${since} EDM belgenin durumunu bildirmedi (${reason}). İptal yapılmadı; Durum Sorgula ile bakın ya da entegratörle görüşün.`, { code: "einvoice-cancel-unknown", lastDay: limit.lastDay });
    }
    setE(user, row.id, { status: remote.status, message: remote.message }, "invoice.e.status", { raw: remote.raw || "", during: "cancel" });
    const found = cancelWindowOf(invoiceRow(row.id));
    if (found?.late) throw new HttpError(409, `Belge EDM'de bulundu: alıcıya iletilmiş, GİB'de geçerli. ${cancelLateText(found)}`, { code: "einvoice-cancel-late", lastDay: found.lastDay, start: found.start, source: found.source });
    throw new HttpError(409, `Belge EDM'de bulundu (durum: ${E_STATES[remote.status] || remote.status}); durum belgeye yazıldı, yalnız programda iptal edilmedi. Kartı yeniden açıp İptal Et ile deneyin.`, { code: "einvoice-found" });
  }
  async function cancelInvoiceOnce(user, id, body) {
    const relinks = invoiceRow(id).status === "issued" ? doubtfulRelinks(id) : [];
    const notices = relinks.length ? [doubtfulRelinkText(relinks, { done: true })] : [];
    const options = { reason: text(body.reason), force: forceOf(body), confirmExternal: body.confirmExternal === true, posOutcome: text(body.posOutcome) === "entry-error" ? "entry-error" : "refunded" };
    // Çıkış yolu (kullanıcı kararı 16.10.2026, kontrol turu K4): entegratöre ulaşılamıyor ya da test hesabı kapandıysa belirsiz / portalda taslak belge
    // yalnız programda iptal edilir — Fatura Ayarları yetkisi + açık onay ("Entegratörde yok, yalnız programda iptal et"); işlem kaydına düşer.
    const head = invoiceRow(id);
    const localOnly = body.localOnly === true;
    const stuck = head.status === "issued" && (uncertainSend(head) || head.eStatus === "draft");
    // e-Arşiv: entegratörde de iptal edilir (EDM: taslak, hatalı ya da başarıyla oluşturulmuş e-Arşiv iptal edilebilir). e-SMM (2.4.4): e-SMM gönderimi
    // açıkken aynı yoldan (adapters.mjs cancel → CancelSMM); kapalıyken makbuz entegratöre hiç gitmemiştir.
    const remoteEligible = row => edocEnabled && row.status === "issued" && (row.profile === "EARSIVFATURA" || (row.profile === "ESMM" && esmmEnabled)) && ["draft", "processing", "sent", "accepted", "error"].includes(row.eStatus);
    // 2.4.4 madde 23: iletilmiş e-Arşiv / e-SMM iletimden sonraki 8 gün dolunca HİÇBİR yoldan iptal edilmez — "yalnız programda iptal" de (programda
    // iptal edilen belge yasal olarak geçerli kalırdı). Taslak, Hata ve sonucu belirsiz belge iletilmiş sayılmaz (K4 çıkış yolu sürer).
    const assertWindow = (row, eStatus = row.eStatus) => {
      const limit = cancelWindowOf(row, eStatus);
      if (limit?.late) throw new HttpError(409, cancelLateText(limit), { code: "einvoice-cancel-late", lastDay: limit.lastDay, start: limit.start, source: limit.source });
    };
    assertWindow(head);
    // Dar kontrol turu 3 (B3): entegratörü atlayan her "yalnız programda" iptal (belirsiz / taslak ya da EDM'de iptal edilecek e-Arşiv) aynı kapıdan geçer.
    const bypass = localOnly && (stuck || remoteEligible(head));
    if (bypass) {
      if (!canUser(user, "invoices.settings")) throw new HttpError(403, "Yalnız programda iptal, Fatura Ayarları yetkisi ister; yöneticinize başvurun.", { code: "FORBIDDEN", permission: "invoices.settings" });
      if (body.confirmLocal !== true) throw new HttpError(409, "Belgenin entegratörde olmadığını ya da entegratöre ulaşılamadığını onaylayın (onay kutusu).", { code: "einvoice-local-confirm" });
    }
    const missingAtEdm = bypass && uncertainSend(head) ? await uncertainLocalCheck(user, head) : false;
    if (uncertainSend(head) && !localOnly) throw new HttpError(409, UNCERTAIN_TEXT, { code: "einvoice-uncertain" });
    if (!bypass) await confirmDraft(user, id);
    if (bypass) options.confirmExternal = true;
    const existing = invoiceRow(id);
    // Önce programdaki iptal denenir (iade, kilitli dönem, tahsil edilmiş çek, stok…); geçerse entegratör, sonra program.
    const remote = remoteEligible(existing) && !localOnly;
    // 8 gün kuralı alıcıya iletilmiş e-Arşiv / e-SMM içindir (iletim gününden; lib/einvoice/iptal-suresi.mjs); portaldaki taslak (İz 7.3) ve "Hata"daki
    // belge (gözden geçirme 2.4.2) iletilmedi, süreye girmez. Yalnız programda iptalde de aynı kapı (assertWindow head; burada güncel satırla).
    assertWindow(existing);
    if (remote) {
      cancel(user, existing.id, { ...options, confirmExternal: true, dryRun: true });
      const doc = detail(existing.id, user);
      // Gerçek EDM test ortamı (16.10.2026): belge EDM'de işlenirken (PROCESSING) iptal reddedilir ("Fatura'ler iptal edilemedi", 11049).
      // Önce durum sorulur; işleniyorsa iptal gönderilmez, açık ileti verilir.
      // 2.4.3 (hız testi H7): gönderimden hemen sonra iptal edilen belge kısa süre "işleniyor" görünür; kullanıcı önce elle Durum Sorgula'ya basmak
      // zorundaydı. Durum birkaç saniye içinde yeniden sorulur ve sonuç belgeye yazılır; hâlâ işleniyorsa iptal gönderilmez (açık ileti).
      let current = await integrator().status({ invoice: doc }).catch(() => null);
      for (const wait of STATUS_POLL_MS) {
        if (current?.status !== "processing") break;
        await new Promise(resolve => setTimeout(resolve, wait));
        current = (await integrator().status({ invoice: doc }).catch(() => null)) || current;
      }
      if (current?.status && current.status !== existing.eStatus) setE(user, existing.id, { status: current.status, message: current.message }, "invoice.e.status", { raw: current.raw || "", during: "cancel" });
      // Taslak / Hata sanılan belge EDM'de oluşturulmuş çıktıysa süre ona da uygulanır.
      if (current?.status) assertWindow(existing, current.status);
      if (current?.status === "processing") {
        throw new HttpError(409, `${existing.profile === "ESMM" ? "e-SMM" : "e-Arşiv fatura"} EDM'de henüz işleniyor; iptal ancak işlem bitince yapılabilir. Birkaç dakika sonra Durum Sorgula ile bakıp yeniden deneyin.`, { code: "einvoice-processing" });
      }
      let result;
      try {
        result = await integrator().cancel({ invoice: doc });
      } catch (error) {
        // 2.4.2 (kullanıcı denemesi 17.10.2026): EDM'nin reddettiği ("Hata") belge EDM'de yoktur — iptal "Fatura bulunamadı" (11017) döner.
        // Belge yalnız programda iptal edilir (entegratörde iptal edilecek bir şey yok); başka her hata iptali durdurur.
        if (!(remoteMissing(error, existing.profile) && existing.eStatus === "error")) throw error;
        const row = cancel(user, existing.id, { ...options, confirmExternal: true });
        store.tx(() => {
          store.run("UPDATE invoices SET e_message = ? WHERE id = ?", "EDM belgeyi kabul etmemişti (EDM'de yok); yalnız programda iptal edildi.", existing.id);
          audit(user, "invoice.e.local-cancel", existing.id, { number: existing.number, eStatus: "error", adapter: existing.eAdapter || "", reason: "integrator-missing" });
        });
        return { ...detail(row.id, user), notices };
      }
      store.tx(() => {
        store.run("UPDATE invoices SET e_status = 'cancelled', e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", String(result.message || "").slice(0, 500), now(), now(), existing.id);
        audit(user, "invoice.e.cancelled", existing.id, { number: existing.number, adapter: existing.eAdapter });
      });
      const row = cancel(user, existing.id, { ...options, confirmExternal: true });
      return { ...detail(row.id, user), integratorResult: result, notices };
    }
    const row = cancel(user, existing.id, options);
    if (bypass) {
      store.tx(() => {
        store.run("UPDATE invoices SET e_message = ? WHERE id = ?", missingAtEdm ? "EDM'de bulunamadı (belge iletilmemiş); yalnız programda iptal edildi." : "Yalnız programda iptal edildi (entegratöre iptal gönderilmedi). Entegratörde belge varsa orada ayrıca iptal edin.", existing.id);
        audit(user, "invoice.e.local-cancel", existing.id, { number: existing.number, eStatus: head.eStatus || "none", adapter: head.eAdapter || "", ...(missingAtEdm ? { reason: "integrator-missing" } : {}) });
      });
    }
    return { ...detail(row.id, user), notices };
  }
  router.post("/api/workspace/invoices/:id/cancel", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    ok(res, await cancelInvoice(user, params.id, body));
  });

  // ---------- Mahsup (v2.0.17) ----------
  // Satış ↔ alış faturası (ya da fatura ↔ Alacak/Borç Yaz satırı) karşılıklı kapama yalnız açık mahsup fişiyle olur;
  // otomatik FIFO karşı yöndeki belgeyi ödeme saymaz. Cari bakiyesi değişmez; yalnız iki belgenin "ödendi" durumu.
  const OFFSET_SQL = "SELECT id, account_id AS accountId, invoice_id AS invoiceId, counter_type AS counterType, counter_id AS counterId, amount, date, note, created_by AS createdBy, created_at AS createdAt FROM invoice_offsets";
  const sideOfKind = kind => (["sale", "smm"].includes(kind) ? "sale" : kind === "purchase" ? "purchase" : "");
  // v2.0.23 (gözden geçirme): taksitli fatura kendi kartıyla kapanır; mahsup faturayı kapatıp kartı açık bırakıyordu.
  const PLANNED_OFFSET = "Taksitli fatura mahsup edilmez; kendi taksit kartıyla kapanır (tahsilat ya da iade taksit kartından girilir).";
  const offsetTarget = row => {
    if (row.status !== "issued") throw new HttpError(409, "Yalnız kaydedilmiş fatura mahsup edilir.");
    if (!sideOfKind(row.kind)) throw new HttpError(409, "İade faturası mahsup edilmez; iade zaten asıl faturayı kapatır.");
    if (row.planId) throw new HttpError(409, PLANNED_OFFSET);
  };
  // Mahsupta kullanılabilecek karşı belgeler: aynı carinin karşı yöndeki açık faturaları ve kapanmamış Alacak/Borç Yaz satırları.
  function offsetCandidates(row, user) {
    offsetTarget(row);
    const side = sideOfKind(row.kind);
    const state = paymentStates([row]).get(row.id);
    const counterKinds = side === "sale" ? ["purchase"] : ["sale", "smm"];
    const rows = store.all(`${INVOICE_SQL} WHERE i.account_id = ? AND i.status = 'issued' AND i.kind IN (${counterKinds.map(() => "?").join(", ")}) ORDER BY i.issue_date, i.created_at`, row.accountId, ...counterKinds);
    const states = paymentStates(rows);
    const invoices = rows.map(item => ({ ...shape(item, states.get(item.id)) })).filter(item => item.open > 0.004 && !item.planId).map(item => ({ id: item.id, number: item.number, displayNo: item.displayNo, kindLabel: item.kindLabel, issueDate: item.issueDate, tryPayable: item.tryPayable, open: item.open }));
    const used = new Map(store.all("SELECT counter_id AS id, SUM(amount) AS total FROM invoice_offsets WHERE counter_type = 'entry' AND account_id = ? GROUP BY counter_id", row.accountId).map(item => [item.id, Number(item.total) || 0]));
    const entryKind = side === "sale" ? "credit" : "debt";
    const entries = store
      .all("SELECT id, kind, amount, date, note FROM account_entries WHERE account_id = ? AND source = '' AND kind = ? ORDER BY date, created_at", row.accountId, entryKind)
      .map(entry => ({ ...entry, label: entry.kind === "credit" ? "Alacak Yaz" : "Borç Yaz", left: roundMoney(Number(entry.amount) - (used.get(entry.id) || 0)) }))
      .filter(entry => entry.left > 0.004);
    const offsets = store.all(`${OFFSET_SQL} WHERE invoice_id = ? OR (counter_type = 'invoice' AND counter_id = ?) ORDER BY date, created_at`, row.id, row.id).map(offset => ({ ...offset, label: offsetLabel(offset.invoiceId === row.id ? offset : { ...offset, counterType: "invoice", counterId: offset.invoiceId }) }));
    return { invoiceId: row.id, open: state?.open ?? row.tryPayable, side, invoices, entries, offsets, canManage: canUser(user, "invoices.manage") };
  }
  function addOffset(user, row, body) {
    offsetTarget(row);
    const counterType = String(body.counterType || "") === "entry" ? "entry" : "invoice";
    const counterId = limited(body.counterId, 120, "Karşı belge");
    if (!counterId) throw new HttpError(400, "Mahsup edilecek karşı belge seçilmedi.");
    const amount = roundMoney(parseAmount(body.amount));
    if (!(amount > 0)) throw new HttpError(400, "Mahsup tutarı sıfırdan büyük olmalı.");
    const date = period ? period.movementDate(body) : (body.date ? String(body.date).slice(0, 10) : today());
    const note = limited(body.note, 300, "Açıklama");
    const candidates = offsetCandidates(row, user);
    if (counterType === "invoice" && store.get("SELECT plan_id AS planId FROM invoices WHERE id = ? AND account_id = ?", counterId, row.accountId)?.planId) throw new HttpError(409, PLANNED_OFFSET);
    const counter = (counterType === "invoice" ? candidates.invoices : candidates.entries).find(item => item.id === counterId);
    if (!counter) throw new HttpError(409, counterType === "invoice" ? "Karşı fatura bu carinin açık, karşı yöndeki faturası olmalı." : "Karşı satır bu carinin kapanmamış Alacak/Borç Yaz satırı olmalı.");
    const counterLeft = counterType === "invoice" ? counter.open : counter.left;
    if (amount > candidates.open + 0.004) throw new HttpError(409, `Mahsup tutarı faturanın açık tutarını (${tl(candidates.open)}) aşamaz.`);
    if (amount > counterLeft + 0.004) throw new HttpError(409, `Mahsup tutarı karşı belgenin kalanını (${tl(counterLeft)}) aşamaz.`);
    if (date < row.issueDate || (counterType === "invoice" && date < counter.issueDate) || (counterType === "entry" && date < counter.date)) throw new HttpError(409, "Mahsup tarihi iki belgenin tarihinden önce olamaz.");
    const id = newId("offset");
    store.tx(() => {
      store.run("INSERT INTO invoice_offsets (id, account_id, invoice_id, counter_type, counter_id, amount, date, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, row.accountId, row.id, counterType, counterId, amount, date, note, user.id, now());
      audit(user, "invoice.offset", row.id, { number: row.number, counterType, counterId, amount, date, note });
    });
    publish(user, { kind: "invoices", invoiceId: row.id, accountId: row.accountId });
    publish(user, { kind: "accounts", accountId: row.accountId });
    return id;
  }
  function removeOffset(user, row, offsetId) {
    const offset = store.get(`${OFFSET_SQL} WHERE id = ? AND (invoice_id = ? OR (counter_type = 'invoice' AND counter_id = ?))`, limited(offsetId, 120, "Mahsup"), row.id, row.id);
    if (!offset) throw new HttpError(404, "Mahsup fişi bulunamadı; kaldırılmış olabilir.");
    period?.assertOpen(offset.date, "Bu mahsup");
    store.tx(() => {
      store.run("DELETE FROM invoice_offsets WHERE id = ?", offset.id);
      audit(user, "invoice.offset.removed", row.id, { number: row.number, offsetId: offset.id, amount: offset.amount, counterType: offset.counterType, counterId: offset.counterId });
    });
    publish(user, { kind: "invoices", invoiceId: row.id, accountId: row.accountId });
    publish(user, { kind: "accounts", accountId: row.accountId });
  }
  router.get("/api/workspace/invoices/:id/offsets", async ({ req, res, params }) => {
    const user = requireView(req);
    ok(res, offsetCandidates(invoiceRow(params.id), user));
  });
  router.post("/api/workspace/invoices/:id/offsets", async ({ req, res, params }) => {
    const user = requireManage(req);
    const row = invoiceRow(params.id);
    const body = await readJson(req);
    const offsetId = addOffset(user, row, body);
    ok(res, { ...detail(row.id, user), offsetId });
  });
  router.delete("/api/workspace/invoices/:id/offsets/:offsetId", async ({ req, res, params }) => {
    const user = requireManage(req);
    const row = invoiceRow(params.id);
    removeOffset(user, row, params.offsetId);
    ok(res, detail(row.id, user));
  });

  // ---------- Belge çıktıları ----------
  const pdfFor = (ids, user) => {
    const s = settings();
    // e-Belge (kayıtlı, satıcısı biz) PDF'inde de aynı karekod: belgenin XML'inden (karekod.mjs).
    // Bitiş turu (eleştirmen E4, yargıç Y7): karekod yalnız entegratöre ulaşmış belgede (Gönderilecekler'deki numarasız ya da hiç gönderilmemiş
    // belgenin PDF'i resmî görünmesin). E8: karekod şablonsuz XML'den (logo/kaşe gömülü şablon kurulmaz; toplu PDF'te yük).
    const docs = ids.map(id => detail(id, user)).map(doc => (edocEnabled && doc.status === "issued" && doc.profile !== "KAGIT" && ownsDocument(doc) && E_VIEWABLE.has(doc.eStatus) ? { ...doc, karekodText: karekodOf(buildUbl(doc, { variant: "tr" }))?.text || "" } : doc));
    return invoicePdf(docs, { footer: s.defaults.footer, officeName: store.setting("office.name", "") || "", logo: s.seller.logo, signatureArea: s.defaults.signatureArea === true, stamp: s.eView.stamp !== false ? s.seller.stamp : "", stampEfatura: s.eView.stampEfatura === true });
  };
  const safeName = value => String(value || "Fatura").replace(/[^\p{L}\p{N} _.-]+/gu, "-").slice(0, 80);
  router.get("/api/workspace/invoices/:id/fatura.pdf", async ({ req, res, params, url }) => {
    const user = requireView(req);
    const row = invoiceRow(params.id);
    const pdf = pdfFor([row.id], user);
    audit(user, "invoice.pdf", row.id, { number: row.number });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${safeName(row.number || "Taslak Fatura")} ${safeName(parseJson(row.partyJson, {}).name || row.accountName)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  // Görünüm önizlemesi (Entegratör Ayarları → Görünüm → Önizle): firmanın bilgisiyle ÖRNEK bir e-Fatura (kayıt yazılmaz, numara harcanmaz) ve
  // ekrandaki (kaydedilmemiş olabilir) görünüm seçimleriyle şablon. Tarayıcı XSLT'yi kendisi işler (XSLTProcessor) — entegratörün göreceği şablon.
  router.post("/api/workspace/invoices/view-preview", async ({ req, res }) => {
    auth.requirePermission(req, "invoices.settings");
    requireEdoc();
    const body = await readJson(req);
    const s = settings();
    const view = { ...s.eView, ...Object.fromEntries(["logo", "banks", "footer", "stamp", "stampEfatura"].filter(key => body?.eView?.[key] !== undefined).map(key => [key, body.eView[key] === true])), enabled: true };
    const lines = [
      { name: "Örnek Ürün", code: "URN-001", qty: 2, unit: "Adet", unitPrice: 500, discount: 0, net: 1000, vat: 200, vatRate: 20 },
      { name: "Örnek Hizmet", description: "Kalem açıklaması örneği", qty: 1, unit: "Saat", unitPrice: 250, discount: 0, net: 250, vat: 25, vatRate: 10 },
    ];
    const day = today();
    const seller = sellerParty(s);
    const doc = {
      kind: "sale", number: `${s.series.efatura || "EFT"}${day.slice(0, 4)}000000001`, ettn: "00000000-0000-4000-8000-000000000000", issueDate: day, issueTime: "10:30",
      profile: "TEMELFATURA", typeCode: "SATIS", currency: "TRY", pricesIncludeVat: false, lines, payableTotal: 1475, amountInWords: amountInWords(1475, "TRY"),
      seller, party: { name: "Örnek Müşteri A.Ş.", partyKind: "company", taxNo: "1234567890", taxOffice: "Örnek", address: "Örnek Cad. No:1", district: "Merkez", city: "Ankara", country: "Türkiye" },
    };
    const xslt = viewXslt({ logo: s.seller.logo, banks: seller.banks || [], footer: s.defaults.footer, view, stamp: s.seller.stamp, qr: karekodOf(buildUbl(doc, { variant: "tr" }))?.dataUrl || "" });
    ok(res, { xml: buildUbl(doc, { variant: "tr", xslt }), xslt });
  });
  router.get("/api/workspace/invoices/:id/ubl.xml", async ({ req, res, params, url }) => {
    const user = requireView(req);
    requireEdoc();
    const doc = detail(params.id, user);
    if (doc.status !== "issued") throw new HttpError(409, "Yalnız kaydedilmiş faturanın e-Belgesi (UBL-TR XML) üretilir.");
    const xml = ublFor(doc, { variant: url.searchParams.get("peppol") === "1" ? "peppol" : "tr" });
    sendBuffer(res, Buffer.from(xml, "utf8"), { type: "application/xml; charset=utf-8", name: ublFileName(doc, url.searchParams.get("peppol") === "1"), inline: false });
  });
  // ---------- e-Belge: gönder, durum, mükellef, bağlantı ----------
  const sending = new Set();
  // e_at ile updated_at aynı damga: portaldaki taslağın eskidiği (belge taslaktan sonra düzenlendi) updated_at > e_at ile anlaşılır.
  const setE = (user, id, { status, adapter = null, message = "" }, action, extra = {}) => {
    store.tx(() => {
      const stamp = now();
      if (adapter) store.run("UPDATE invoices SET e_status = ?, e_adapter = ?, e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", status, adapter, String(message || "").slice(0, 500), stamp, stamp, id);
      else store.run("UPDATE invoices SET e_status = ?, e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", status, String(message || "").slice(0, 500), stamp, stamp, id);
      audit(user, action, id, { status, ...extra });
    });
    publish(user, { kind: "invoices", invoiceId: id });
  };
  // Entegratörde bulunmayan belge (Durum Sorgula → EDM "Fatura bulunamadı"): e-Belge durumundan çıkar, yeniden gönderilebilir.
  const clearE = (user, id, message) => {
    store.tx(() => {
      const stamp = now();
      store.run("UPDATE invoices SET e_status = 'none', e_adapter = '', e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", String(message || "").slice(0, 500), stamp, stamp, id);
      audit(user, "invoice.e.status", id, { status: "none", missing: true });
    });
    publish(user, { kind: "invoices", invoiceId: id });
  };
  // Faturadan doğan satırların açıklamasındaki "(gönderilecek)" yer tutucusu verilen numarayla değişir (cari ekstre,
  // stok kartı, taksit kartı, çek/senet ve Kasa aynı numarayı gösterir).
  const PENDING_TAG = "(gönderilecek)";
  // Yalnız açıklama (note) değişir: para satırının parası ve işlem başlığı değişmez (K6 (c): para alanı olmayan kolon).
  function renumberNotes(id, number) {
    store.run("UPDATE account_entries SET note = REPLACE(note, ?, ?) WHERE source = 'invoice' AND source_id = ?", PENDING_TAG, number, id);
    store.run("UPDATE stock_moves SET note = REPLACE(note, ?, ?) WHERE invoice_id = ?", PENDING_TAG, number, id);
    store.run("UPDATE plans SET note = REPLACE(note, ?, ?) WHERE invoice_id = ?", PENDING_TAG, number, id);
    store.run("UPDATE cheques SET note = REPLACE(note, ?, ?) WHERE invoice_id = ?", PENDING_TAG, number, id);
    store.run("UPDATE account_entries SET note = REPLACE(note, ?, ?) WHERE source = 'cheque' AND source_id IN (SELECT id FROM cheques WHERE invoice_id = ?)", PENDING_TAG, number, id);
    // Dar kontrol 2.4.3 (ek 3): Banka → Ters Kaydet'in iade faturası numarasız ertelenirse (O1) banka işleminin açıklaması da "(gönderilecek)"
    // yazar; numara verilince o da değişir (açıklama para alanı değildir — K6).
    store.run("UPDATE fin_events SET description = REPLACE(description, ?, ?) WHERE invoice_id = ? AND instr(description, ?) > 0", PENDING_TAG, number, id, PENDING_TAG);
  }
  // Dar kontrol 2 (B3 + K12): gönderim isteği EDM'ye kesin ulaşmadı (bağlantı kurulamadı) — bu istekte verilen numara geri bırakılır. Koşullar (hepsi
  // işlem içinde): belge hâlâ o numarada, gönderilmemiş (durum none), numara serinin + yılın SON numarası (başka belge araya girdiyse bırakılmaz:
  // seride boşluk olmaz; belge numaralı, gönderilmemiş kalır). Açıklamalardaki numara "(gönderilecek)" yer tutucusuna döner (renumberNotes'un tersi).
  function releaseNumber(user, id, number, error) {
    const released = store.tx(() => {
      const row = store.get("SELECT status, series, year, seq, number, profile, e_status AS eStatus FROM invoices WHERE id = ?", id);
      if (!row || row.status !== "issued" || !number || row.number !== number || !(row.seq > 0) || (row.eStatus || "none") !== "none" || row.profile === "KAGIT") return false;
      const top = store.get("SELECT MAX(seq) AS n FROM invoices WHERE series = ? AND year = ? AND seq > 0", row.series, row.year)?.n;
      if (top !== row.seq) return false;
      const message = `${String(error?.message || error).slice(0, 300)} Belge EDM'ye ulaşmadı; numara verilmedi, Gönderilecekler'de bekliyor.`;
      store.run("UPDATE invoices SET seq = 0, number = '', e_status = 'waiting', e_profile = ?, e_message = ? WHERE id = ?", row.profile, message, id);
      for (const [table, where] of [["account_entries", "source = 'invoice' AND source_id = ?"], ["stock_moves", "invoice_id = ?"], ["plans", "invoice_id = ?"], ["cheques", "invoice_id = ?"], ["account_entries", "source = 'cheque' AND source_id IN (SELECT id FROM cheques WHERE invoice_id = ?)"]]) {
        store.run(`UPDATE ${table} SET note = REPLACE(note, ?, ?) WHERE ${where} AND instr(note, ?) > 0`, number, PENDING_TAG, id, number);
      }
      store.run("UPDATE fin_events SET description = REPLACE(description, ?, ?) WHERE invoice_id = ? AND instr(description, ?) > 0", number, PENDING_TAG, id, number);
      audit(user, "invoice.unnumbered", id, { number, reason: "integrator-unreachable" });
      return true;
    });
    if (released) {
      if (error && typeof error === "object") {
        error.message = `${String(error.message || "").replace(/\s+$/, "")} Belge EDM'ye ulaşmadı; numara verilmedi, Gönderilecekler'de bekliyor.`;
        if (error.extra && typeof error.extra === "object") error.extra.released = true;
        else error.released = true;
      }
      publish(user, { kind: "invoices", invoiceId: id });
    }
    return released;
  }
  // Sonra gönderilecek (ya da listeden silinip yeniden gönderilen) belgeye e-Belge numarası: gönderim anında, serinin
  // sırasıyla. Belge serideki son gönderilen belgeden eski tarihliyse gönderilmez (VUK 231 / GİB: numara ve tarih sırası).
  // lastOf (isteğe bağlı): aynı turda birçok belge için serinin son numaralı belgesini bir kez okuyan önbellek (Tümünü Gönder).
  function sendBlockOf(row, lastOf = null) {
    if (!["waiting", "withdrawn"].includes(row.eStatus) || row.status !== "issued") return "";
    const profile = row.eStatus === "withdrawn" ? row.eProfile : row.profile;
    if (!profile || profile === "KAGIT") return "";
    const series = seriesFor(row.kind, profile, settings());
    const year = Number(row.issueDate.slice(0, 4));
    const read = () => store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 ORDER BY seq DESC LIMIT 1", series, year) || null;
    const last = lastOf ? lastOf(`${series}|${year}`, read) : read();
    if (!(last && last.issueDate > row.issueDate)) return "";
    // Gözden geçirme 2.4.3 (S1): kalıcı engel — iletisi çıkış yollarını düğme adlarıyla söyler. Dar kontrol 2 (B7): yalnız gerçekten açık olan yol —
    // Listeden Sil yalnız Gönderilecekler'deki belgede ve Müşteri Fişi serisinin sırası (K31: son fişten eski tarihli belgeye fiş numarası verilmez)
    // izin veriyorsa önerilir; değilse yalnız İptal Et.
    const paper = paperSeriesOf(row.kind, settings());
    const readPaper = () => store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 ORDER BY seq DESC LIMIT 1", paper, year) || null;
    const lastPaper = row.eStatus === "waiting" ? (lastOf ? lastOf(`${paper}|${year}`, readPaper) : readPaper()) : null;
    const withdrawOpen = row.eStatus === "waiting" && !(lastPaper && lastPaper.issueDate > row.issueDate);
    const head = `${series} serisinde son gönderilen belge ${last.number} ${dayText(last.issueDate)} tarihli; bu belge (${dayText(row.issueDate)}) daha eski tarihli olduğu için e-Belge olarak gönderilemez.`;
    return withdrawOpen
      ? `${head} “${paperNameOf(row.kind).button}” ile ${paperNameOf(row.kind).number} bırakın ya da İptal Et ile iptal edip bugünün tarihiyle yeniden kesin.`
      : `${head} İptal Et ile iptal edip bugünün tarihiyle yeniden kesin.`;
  }
  // Dar kontrol 2.4.3 (O3): belgeye özgü, kullanıcı müdahalesi olmadan düzelmeyecek gönderim engelleri KALICIDIR — aynı serinin yeni belgelerini
  // bekletmez, Tümünü Gönder her turda yeniden denemez:
  //   chronology        seride daha yeni tarihli numara verilmiş (sendBlockOf);
  //   buyer-is-efatura  alıcı e-Fatura mükellefi; numarasız e-Arşiv belge bu seride hiç gönderilemez (İptal Et, yeniden kes: e-Fatura).
  // Düzeltilebilir belge/alıcı bilgisi (buyer-incomplete, buyer-alias, einvoice-type-mix, einvoice-return-reference), bağlantı, oturum ve ayar
  // hataları GEÇİCİDİR: belge düzeltilince AYNI seride numara alır, daha yeni belge önüne geçmemeli (B1).
  const PERMANENT_SEND_CODES = new Set(["chronology", "buyer-is-efatura"]);
  // Bağlantı / entegratör hesabı hatası bütün belgelerde aynı düşer: Tümünü Gönder ilk görüldüğünde durur, kalanlara numara verilmez (BİLGİ, r7).
  // integrator-reference (2.4.4 madde 22): entegratör belgeyi başka numarayla kaydetti — kendi numarasını veriyorsa kalan belgeler de ayrışırdı.
  const TURN_STOP_CODES = new Set(["integrator-unreachable", "integrator-url", "integrator-credentials", "integrator-login", "integrator-reference"]);
  const UNREACHABLE_TEXT = "EDM'ye ulaşılamadı; bağlantı gelince yeniden deneyin.";
  const LOGIN_REJECTED_TEXT = "Entegratör girişi reddedildi (kullanıcı adı/parola). Kalan belgelere numara verilmedi; Entegratör Ayarları'nı düzeltip yeniden deneyin.";
  // Dar kontrol 2.4.3 (ek 1): entegratör GİRİŞİ reddedildi mi (yanlış kullanıcı adı/parola, hesap)? EDM girişte de "isteği reddetti" der; ayıran
  // adımdır (stage: login). Mükellef sorgusundan sarılarak gelen hata (buyer-check-failed) da sayılır.
  function loginRejected(error) {
    const extra = error?.extra || {};
    const code = extra.code || error?.code || "";
    const stage = extra.stage || error?.stage || "";
    if (code === "integrator-login") return true;
    if (code === "buyer-check-failed") return extra.stage === "login" && ["integrator-rejected", "integrator-login"].includes(extra.cause);
    return stage === "login" && code === "integrator-rejected";
  }
  const withdrawnText = kind => `Gönderilmedi: belge gönderim sürerken ${paperNameOf(kind).name} olarak bırakıldı.`;
  const ALREADY_SENT_TEXT = "Bu belge başka oturumda gönderildi.";
  // O3: alıcısı e-Fatura mükellefi olarak işaretlenmiş (Mükellef Sorgula ya da gönderimdeki sorgu) carinin numarasız e-Arşiv belgesi. Kalıcı:
  // e-Arşiv olarak hiç gönderilemez. Belgedeki numara carinin şimdiki numarasıyla aynıysa (sorgunun cariyi işaretleme koşulu) anlaşılır.
  // Dar kontrol 2.4.3 (ek 2): belgedeki alıcı numarası carinin şimdiki numarasından farklıysa cari işaretlenmez; o numaranın mükellefiyeti
  // entegratörün son sorgu sonucundan (registry) okunur — turda kalıcı sayılan engel kartta da kalıcı görünür, yeni belgeleri bekletmez.
  // Kayıt: her mükellef sorgusu (gönderim öncesi denetim, Mükellef Sorgula) numaranın son sonucunu yazar; mükellef değil diyen sorgu siler.
  const REGISTRY_KEY = "einvoice.taxpayers";
  const REGISTRY_MAX = 5000;
  const taxDigits = value => String(value || "").replace(/\D/g, "");
  // Dar kontrol 2 (B4): kayıt defteri (5.000'e dek numara, ~150 KB JSON) her satırda yeniden ayrıştırılıyordu (olderPending / buyerBlockOf; 1.500
  // bekleyen + 5.000 kayıtta Kaydet ve Gönder 2,6 sn). Ayrıştırılmış hâl, ayardaki metin değişmedikçe yeniden kullanılır (metin karşılaştırması
  // geri yükleme / şirket değişimini de yakalar). Dönen nesne değiştirilmez (noteTaxpayer kopyasını değiştirir).
  // Aynı eşzamanlı adım (tek bir döngü: liste, tur ön taraması, olderPending) ayar satırını da bir kez okur (registryMemo; adım bitince — mikro
  // görevde — düşer, sonraki istek yeniden okur).
  let registryCache = { raw: null, value: {} };
  let registryMemo = null;
  function registryOf() {
    if (registryMemo) return registryMemo;
    const raw = store.setting(REGISTRY_KEY, "{}");
    if (raw !== registryCache.raw) registryCache = { raw, value: parseJson(raw, {}) || {} };
    registryMemo = registryCache.value;
    queueMicrotask(() => {
      registryMemo = null;
    });
    return registryMemo;
  }
  function noteTaxpayer(taxNo, registered) {
    const key = taxDigits(taxNo);
    if (![10, 11].includes(key.length)) return;
    const registry = { ...registryOf() };
    if (Boolean(registry[key]) === Boolean(registered)) return;
    if (registered) registry[key] = now();
    else delete registry[key];
    const keys = Object.keys(registry);
    if (keys.length > REGISTRY_MAX) for (const old of keys.sort((a, b) => String(registry[a]).localeCompare(String(registry[b]))).slice(0, keys.length - REGISTRY_MAX)) delete registry[old];
    store.setSetting(REGISTRY_KEY, JSON.stringify(registry));
    registryMemo = null;
  }
  // pre (isteğe bağlı; B4): satırla birlikte okunmuş alıcı bilgisi (partyJson, accountFound, accountTaxNo, accountEInvoice) — satır başına sorgu yok.
  function buyerBlockOf(row, pre = null) {
    if (row.status !== "issued" || row.eStatus !== "waiting" || row.profile !== "EARSIVFATURA" || row.kind === "purchase" || row.kind === "sale_return") return "";
    const partyJson = pre ? pre.partyJson : store.get("SELECT party_json AS partyJson FROM invoices WHERE id = ?", row.id)?.partyJson;
    const partyTaxNo = taxDigits(parseJson(partyJson, {})?.taxNo);
    if (![10, 11].includes(partyTaxNo.length) || partyTaxNo === "11111111111" || partyTaxNo === "2222222222") return "";
    const account = !row.accountId ? null : pre ? (pre.accountFound ? { taxNo: pre.accountTaxNo, eInvoice: pre.accountEInvoice } : null) : store.get("SELECT tax_no AS taxNo, e_invoice AS eInvoice FROM accounts WHERE id = ?", row.accountId);
    if (account && partyTaxNo === taxDigits(account.taxNo)) {
      return Number(account.eInvoice) === 1 ? "Alıcı e-Fatura mükellefi (cari kartında işaretli); bu belge e-Arşiv olarak gönderilemez (GİB). İptal Et ile iptal edip yeniden kesin: e-Fatura olarak kesilir. Mükellefiyet bilgisi yanlışsa cari kartında Mükellef Sorgula ile yenileyin." : "";
    }
    return registryOf()[partyTaxNo] ? `Belgedeki alıcı numarası (${partyTaxNo}) e-Fatura mükellefine ait; bu belge e-Arşiv olarak gönderilemez (GİB). İptal Et ile iptal edin; alıcı firmanın carisini VKN'siyle açıp faturayı ona e-Fatura olarak kesin.` : "";
  }
  // O1: aynı serinin (seri + yıl), verilen tarihten ESKİ tarihli, gönderilebilir (kalıcı engelsiz) numarasız bekleyenlerinin sayısı. Bütün numara
  // verme yolları bunu sorar: kayıtta numara (writeIssued) ve gönderimde numara (numberForSend). Aynı gün sırayı bozmaz (kronoloji katı: tarih).
  // Dar kontrol 2 (B4): tek sorgu — serinin son numaralı belgesinden ESKİ bekleyen zaten kalıcı engellidir (sendBlockOf), sayılmaz: tarih aralığı o
  // belgenin tarihinden başlar (çoğunlukla yakın bir gün; tarih dizini). Alıcı bilgisi aynı sorguda gelir; satır başına sorgu ve ayrıştırma yok.
  function olderPending(series, year, date, exceptId = "") {
    const s = settings();
    const last = store.get("SELECT issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 ORDER BY seq DESC LIMIT 1", series, year);
    const floor = last && last.issueDate > `${year}-01-01` ? last.issueDate : `${year}-01-01`;
    if (floor >= date) return 0;
    const rows = store.all(`SELECT i.id, i.kind, i.status, i.profile, i.e_status AS eStatus, i.issue_date AS issueDate, i.account_id AS accountId, i.party_json AS partyJson, a.id AS accountFound, a.tax_no AS accountTaxNo, a.e_invoice AS accountEInvoice FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id WHERE i.issue_date >= ? AND i.issue_date < ? AND i.status = 'issued' AND i.e_status = 'waiting' AND i.profile <> 'KAGIT' AND i.id <> ?`, floor, date, exceptId || "");
    return rows.filter(row => row.profile && seriesFor(row.kind, row.profile, s) === series && !buyerBlockOf(row, row)).length;
  }
  const orderText = (count, where) => `Bu seride daha eski tarihli gönderilmemiş ${count.toLocaleString("tr-TR")} belge var; GİB sıra kuralı gereği önce onlar gönderilmeli. ${where} — Tümünü Gönder ile eskiden yeniye gönderin.`;
  // Kayıtta numarası ertelenen belgenin yanıtı (autoSend yerine): hata değil, belge Gönderilecekler'de numarasız bekler.
  // Dar kontrol 2.4.3 (ek 1, kâhin BEKLENEN-AG): kayıtta hemen gönderilecek belge (Kaydet ve Gönder; otomatik gönderim açıkken Kaydet / Seçilenleri
  // Kaydet) için entegratöre erişim ve giriş numara verilmeden denenir; giriş REDDEDİLİRSE ya da EDM'ye ULAŞILAMAZSA belge numara almadan
  // Gönderilecekler'e girer (önceki 2.4.3 H1 davranışı — bugünün belgesi numarasını alıp "Gönderilmedi" bekliyordu — kalktı). Oturum
  // önbellekteyse ağa çıkılmaz.
  // Kayıtta hemen gönderim denenecek mi (entegratöre gidilecek mi)?
  function sendWouldContact(doc, body) {
    if (!edocEnabled || body?.eSend === "later" || !doc.meta?.own || !sendKind(doc.kind, doc.profile) || doc.profile === "KAGIT") return false;
    return body?.eSend === "now" || settings().integrator?.autoSend === true;
  }
  // Dar kontrol 2 (B3): geçerli oturum ve son 5 dk içinde EDM yanıtı varsa giriş yapılmaz (edm.mjs ensureSession); yoksa giriş NUMARADAN ÖNCE.
  async function sendLoginBlock(doc, body) {
    if (!sendWouldContact(doc, body)) return "";
    const s = settings();
    let link;
    try {
      link = integrator(s);
    } catch {
      return "";
    }
    try {
      // 2.4.4 (e-SMM): giriş belgenin servisinde denenir (ESMM → ESmmEDM.svc; adapters.mjs ensureSession).
      await link.ensureSession?.({ invoice: doc });
    } catch (error) {
      if (loginRejected(error)) return { code: "integrator-login", detail: String(error?.message || error).slice(0, 300) };
      if (["integrator-unreachable", "integrator-uncertain"].includes(error?.extra?.code || error?.code)) return { code: "integrator-unreachable", detail: "" };
    }
    return "";
  }
  const loginHoldResult = hold =>
    hold.code === "integrator-unreachable"
      ? { ok: false, pending: true, held: true, code: "integrator-unreachable", number: "", message: "EDM'ye ulaşılamadı; belge numarasız Gönderilecekler'e eklendi, bağlantı gelince Tümünü Gönder ile gönderin." }
      : { ok: false, pending: true, held: true, code: "integrator-login", number: "", message: `Entegratör girişi reddedildi (kullanıcı adı/parola): ${hold.detail} Belge numara verilmeden Gönderilecekler'e eklendi; Entegratör Ayarları'nı düzeltip Tümünü Gönder ile gönderin.` };
  const orderHeldResult = count => ({ ok: false, pending: true, held: true, code: "einvoice-order", number: "", message: orderText(count, "Belge Gönderilecekler'e eklendi") });
  function numberForSend(user, id, { listedOnly = false } = {}) {
    return store.tx(() => {
      const row = invoiceRow(id);
      if (row.status !== "issued" || !["waiting", "withdrawn"].includes(row.eStatus)) return null;
      // O2: Tümünü Gönder'in seçtiği belge sonradan Listeden Silindiyse (Müşteri Fişi) e-Belge olarak gönderilmez.
      if (listedOnly && row.eStatus === "withdrawn") throw new HttpError(409, withdrawnText(row.kind), { code: "einvoice-withdrawn" });
      const block = sendBlockOf(row);
      if (block) throw new HttpError(409, block, { code: "chronology" });
      const buyer = buyerBlockOf(row);
      if (buyer) throw new HttpError(409, buyer, { code: "buyer-is-efatura" });
      const s = settings();
      const profile = row.eStatus === "withdrawn" ? row.eProfile : row.profile;
      const series = seriesFor(row.kind, profile, s);
      const year = Number(row.issueDate.slice(0, 4));
      const older = olderPending(series, year, row.issueDate, row.id);
      if (older) throw new HttpError(409, orderText(older, "Belge Gönderilecekler'de bekliyor"), { code: "einvoice-order", count: older });
      const { seq, number } = nextNumber(series, year, s);
      // Listeden silinip Müşteri Fişi numarası almış belge: fiş numarası "Kâğıt Fatura No" alanında kalır (iz).
      const paperNo = row.eStatus === "withdrawn" && !row.paperNo ? row.number : row.paperNo;
      store.run("UPDATE invoices SET profile = ?, series = ?, year = ?, seq = ?, number = ?, paper_no = ?, e_status = 'none', updated_by = ?, updated_at = ? WHERE id = ?", profile, series, year, seq, number, paperNo, user.id, now(), row.id);
      if (row.eStatus === "waiting") renumberNotes(row.id, number);
      else if (row.number) {
        // Fiş numarasıyla yazılmış açıklamalar e-Belge numarasına döner.
        for (const [table, where] of [["account_entries", "source = 'invoice' AND source_id = ?"], ["stock_moves", "invoice_id = ?"], ["plans", "invoice_id = ?"], ["cheques", "invoice_id = ?"]]) store.run(`UPDATE ${table} SET note = REPLACE(note, ?, ?) WHERE ${where}`, row.number, number, row.id);
        store.run("UPDATE fin_events SET description = REPLACE(description, ?, ?) WHERE invoice_id = ? AND instr(description, ?) > 0", row.number, number, row.id, row.number);
      }
      audit(user, "invoice.numbered", row.id, { number, series, from: row.eStatus });
      return number;
    });
  }
  // draft (İz 7.3, isteğe bağlı): EDM portalına taslak yükle / yenile (LoadInvoice; aynı ETTN ile yeniden yükleme EDM'de içeriği değiştirir —
  // gerçek test ortamında görüldü, docs/kanit/2026-10-16/edm-taslak). Taslaktaki belge "Gönder"le gönderilirken ÖNCE son hâli yüklenir, sonra
  // gönderilir: defterdeki belge ile giden e-Belge aynı kalır. Taslak portaldan gönderilmişse (EDM durumu artık taslak değil) yükleme yapılmaz.
  function preflight(doc, s) {
    const seller = sellerProblems(doc.profile, s);
    if (seller.length) throw new HttpError(409, `Firma bilgisi eksik (Fatura Ayarları): ${seller.join(" ")}`, { code: "seller-incomplete", problems: seller });
    const buyer = partyProblems(doc.party, { profile: doc.profile === "EARSIVFATURA" || doc.profile === "ESMM" ? "EARSIV" : "EFATURA", role: "buyer", payable: doc.tryPayable });
    if (buyer.length) throw new HttpError(409, `Alıcı bilgisi eksik: ${buyer.join(" ")}`, { code: "buyer-incomplete", problems: buyer });
    const ret = [...returnProblems(doc.profile, doc.kind, doc.returnRef || doc.originalNumber, doc.originalNumber), ...returnRefShape(doc)];
    if (ret.length) throw new HttpError(409, ret.join(" "), { code: "einvoice-return-reference", problems: ret });
    // e-Fatura alıcının posta kutusu etiketi bilinmeden gönderilmez (EDM istemcisi de reddeder ama numara verildikten sonra) — arayüz denemesi.
    if (["TEMELFATURA", "TICARIFATURA"].includes(doc.profile) && !["purchase", "sale_return"].includes(doc.kind) && !String(doc.party?.eAlias || "").trim()) {
      throw new HttpError(409, "Alıcının e-Fatura posta kutusu etiketi bilinmiyor: cari kartında Mükellef Sorgula ile posta kutusunu seçin, sonra bu faturayı Düzenle ile yeniden kaydedip gönderin (belge alıcı bilgisini kaydedildiği anki cari kartından alır). Sorgu alıcının mükellef olmadığını söylerse bu belgeyi İptal Et ile iptal edip Kopyala ile yeniden kesin: e-Arşiv olarak kesilir.", { code: "buyer-alias" });
    }
    const mix = mixProblems(doc.profile, doc.lines || []);
    if (mix.length) throw new HttpError(409, mix.join(" "), { code: "einvoice-type-mix", problems: mix });
  }
  // GİB: e-Fatura mükellefine e-Arşiv kesilemez. Arayüzden gerçek EDM test ortamında görüldü (16.10.2026, docs/kanit/2026-10-16/edm-arayuz): cari
  // kartında mükellefiyet sorgulanmamışsa program alıcıyı e-Arşiv sayar, EDM belgeyi e-Fatura kurallarıyla reddeder ("Geçersiz cbc:ProfileID
  // 'EARSIVFATURA'") ve numara harcanır. e-Arşiv, kimlik numaralı alıcıya gönderilmeden (numara verilmeden) önce mükellefiyet sorulur; mükellefse
  // cari kartı işaretlenir ve gönderim açık iletiyle durur. Sorgu yapılamazsa (bağlantı) gönderim sürer — sonucu entegratör söyler.
  // Gözden geçirme 2.4.3 (B3): numara hemen verilecekse (Kaydet ve Gönder) mükellefiyet KAYITTAN ÖNCE sorulur — önceden TEA numarası verilip gönderim
  // "e-Fatura mükellefi" diye düşüyordu. Sorgu yapılamazsa (bağlantı) kayıt eskisi gibi sürer; gönderimdeki denetim yine koşar.
  async function assertArchiveBuyerBeforeNumber(user, doc, body) {
    if (!edocEnabled || body?.eSend === "later" || doc.profile !== "EARSIVFATURA") return;
    const s = settings();
    let link;
    try {
      link = integrator(s);
    } catch {
      return;
    }
    try {
      await assertNotEFaturaBuyer(user, { profile: doc.profile, kind: doc.kind, party: doc.party, accountId: doc.account?.id || "", number: "" }, link, { beforeSave: true });
    } catch (error) {
      if (error?.extra?.code === "buyer-is-efatura") throw error;
    }
  }
  async function assertNotEFaturaBuyer(user, doc, link, { beforeSave = false } = {}) {
    if (doc.profile !== "EARSIVFATURA" || doc.kind === "purchase" || doc.kind === "sale_return") return;
    const taxNo = String(doc.party?.taxNo || "").replace(/\D/g, "");
    if (![10, 11].includes(taxNo.length) || taxNo === "11111111111" || taxNo === "2222222222") return;
    let result;
    try {
      result = await link.checkUser(taxNo);
    } catch (error) {
      // Dar kontrol turu 3 (B5): sorgu yapılamadıysa (bağlantı, giriş, zaman aşımı) numara verilmeden durulur — mükellefe giden e-Arşiv numarası
      // hiç gönderilemeyecek bir belgede kalmasın. Belge Gönderilecekler'de, numarasız kalır.
      const where = doc.number ? "Belge gönderilmedi" : "Belge numara verilmeden Gönderilecekler'de kaldı";
      // Dar kontrol 2.4.3 (ek 1): sorgu entegratör GİRİŞİ reddedildiği için yapılamadıysa neden açıkça söylenir.
      if (loginRejected(error)) throw new HttpError(502, `Entegratör girişi reddedildi (kullanıcı adı/parola): ${String(error?.message || error).slice(0, 300)} ${where}; Entegratör Ayarları'nı düzeltip yeniden deneyin.`, { code: "integrator-login", stage: "login" });
      throw new HttpError(502, `Alıcının e-Fatura mükellefiyeti entegratöre sorulamadı (${String(error?.message || error).slice(0, 200)}). ${where}; bağlantı düzelince yeniden gönderin.`, { code: "buyer-check-failed", cause: error?.extra?.code || error?.code || "", stage: error?.extra?.stage || error?.stage || "" });
    }
    noteTaxpayer(taxNo, Boolean(result?.registered));
    if (!result?.registered) return;
    // Posta kutusu yalnız tekse kendiliğinden yazılır; birden çoksa kullanıcı cari kartında seçer (yanlış kutuya fatura gitmesin).
    const aliases = result.aliases || [];
    // Dar kontrol turu 3 (B1): sorgulanan numara BELGEDEKİ alıcının numarasıdır; cari kartı yalnız kendi numarası aynıysa işaretlenir. Kimliksiz
    // (perakende) cariye belgede yazılan firma numarası o cariyi e-Fatura mükellefi yapmaz (sonraki kişi satışları yanlış kutuya giderdi).
    const own = doc.accountId ? String(store.get("SELECT tax_no AS taxNo FROM accounts WHERE id = ?", doc.accountId)?.taxNo || "").replace(/\D/g, "") : "";
    if (own === taxNo) {
      // 2.4.3 (uzman UX5): çok posta kutulu mükellefte kullanıcının daha önce seçtiği etiket (listedeyse) korunur; ileti korunan kutuyu söyler,
      // seçim gerekiyorsa bunu söyler (önceden seçili kutu korunsa da "Mükellef Sorgula ile seçin" deniyordu).
      const marked = accounts().taxIdentity.setEInvoice(user, doc.accountId, { registered: true, alias: aliases.length === 1 ? aliases[0] : "", aliases, title: result.title });
      const kept = aliases.length > 1 && marked?.eAlias ? marked.eAlias : "";
      const choose = kept ? ` Önceden seçtiğiniz posta kutusu (${kept}) korundu.` : aliases.length > 1 ? ` Alıcının ${aliases.length} posta kutusu var: cari kartında Mükellef Sorgula ile doğru posta kutusunu seçin.` : "";
      const next = beforeSave ? " Fatura kaydedilmedi, numara harcanmadı; yeniden kaydedin: e-Fatura olarak kesilir." : " Bu belgeyi iptal edip yeniden kaydedin: e-Fatura olarak kesilir.";
      throw new HttpError(409, `Alıcı (${taxNo}) e-Fatura mükellefi; ona e-Arşiv fatura kesilemez (GİB). Cari kartı e-Fatura mükellefi olarak işaretlendi.${choose}${next}`, { code: "buyer-is-efatura", aliases });
    }
    throw new HttpError(409, `Belgedeki alıcı numarası (${taxNo}) e-Fatura mükellefine ait; ona e-Arşiv fatura kesilemez (GİB). Belgedeki numara carinin şimdiki numarasıyla aynı olmadığı için cari kartı işaretlenmedi: alıcı firmanın carisini VKN'siyle açıp faturayı ona e-Fatura olarak kesin; ${beforeSave ? "fatura kaydedilmedi, numara harcanmadı" : "bu belgeyi iptal edin"}.`, { code: "buyer-is-efatura", aliases });
  }
  // Entegratörün yanıtındaki numara / ETTN (adapters.mjs send → reference, uuid) belgeninkinden farklı mı? Fark yoksa "".
  function referenceMismatch(doc, result) {
    const number = String(result?.reference ?? "").trim();
    const uuid = String(result?.uuid ?? "").trim();
    const numberOff = Boolean(number) && number.toUpperCase() !== String(doc.number || "").toUpperCase();
    const uuidOff = Boolean(uuid) && uuid.toLowerCase() !== String(doc.ettn || "").toLowerCase();
    if (!numberOff && !uuidOff) return "";
    const what = [numberOff ? `numarayla (${number})` : "", uuidOff ? `ETTN ile (${uuid})` : ""].filter(Boolean).join(" ve ");
    const next = ["EARSIVFATURA", "ESMM"].includes(doc.profile) ? "Belgeyi İptal Et ile entegratörde ve programda iptal edip yeniden kesin" : "e-Fatura entegratörden iptal edilmez: alıcıyla ve entegratörle görüşün (iade faturası ya da GİB iptal yolu)";
    return `Entegratör belgeyi programdakinden farklı ${what} kaydetti; programdaki numara ${doc.number}, ETTN ${doc.ettn}. Defterdeki belge ile resmî belge ayrıştı. ${next}; sorun sürerse entegratörün seri / numara ayarını sorun.`;
  }
  async function sendInvoice(user, id, options = {}) {
    const release = holdInvoice(id, "sending");
    try {
      return await sendInvoiceOnce(user, id, options);
    } finally {
      release();
    }
  }
  // fresh: belge numarasını bu istekte kayıtta aldı (Kaydet ve Gönder, Seçilenleri Kaydet, otomatik gönderim) — releaseNumber'a bakın.
  async function sendInvoiceOnce(user, id, { draft = false, listedOnly = false, fresh = false } = {}) {
    requireEdoc();
    // Dar kontrol 2.4.3: ağa çıkmadan bilinen sonuçlar önce söylenir (mükellef sorgusu ve numara harcanmaz) — D2: başka oturumda gönderilmiş;
    // O2: Tümünü Gönder sürerken Listeden Silinmiş; O3: alıcı e-Fatura mükellefi (kalıcı); O1: seride daha eski tarihli gönderilebilir bekleyen var.
    // Asıl güvence numberForSend'in işlemi (aynı denetimler, yarışa karşı).
    {
      const row = invoiceRow(id);
      if (row.status === "issued" && !E_SENDABLE.has(row.eStatus || "none")) throw new HttpError(409, `Bu belge zaten entegratöre iletildi (durum: ${E_STATES[row.eStatus] || row.eStatus}). Sonucu Durum Sorgula ile alın.`, { code: "einvoice-already-sent" });
      if (listedOnly && row.status === "issued" && row.eStatus === "withdrawn") throw new HttpError(409, withdrawnText(row.kind), { code: "einvoice-withdrawn" });
      const buyer = buyerBlockOf(row);
      if (buyer) throw new HttpError(409, buyer, { code: "buyer-is-efatura" });
      // Tümünü Gönder (listedOnly) eskiden yeniye gider; O1 orada yalnız numberForSend'in işleminde denetlenir (her belgede bir sorgu: 10.000
      // faturada ~12 ms, 50.000'de ~55 ms ölçüldü).
      if (!listedOnly && row.status === "issued" && ["waiting", "withdrawn"].includes(row.eStatus) && !sendBlockOf(row)) {
        const profile = row.eStatus === "withdrawn" ? row.eProfile : row.profile;
        if (profile && profile !== "KAGIT") {
          const older = olderPending(seriesFor(row.kind, profile, settings()), Number(row.issueDate.slice(0, 4)), row.issueDate, row.id);
          if (older) throw new HttpError(409, orderText(older, "Belge Gönderilecekler'de bekliyor"), { code: "einvoice-order", count: older });
        }
      }
    }
    if (draft) {
      const row = invoiceRow(id);
      // 2.4.4 madde 22: ağa çıkmadan — e-SMM portala taslak olarak yüklenmez (bağdaştırıcının reddi "isteği gitmiş olabilir" sayılıp belgeyi
      // "Sonucu Belirsiz"e düşürürdü).
      if (eProfileOf(row) === "ESMM") throw new HttpError(409, "e-SMM portala taslak olarak yüklenmez; makbuzu e-Belge Gönder ile gönderin.", { code: "einvoice-draft-unsupported" });
      if (settings().eOptions.draftUpload !== true && row.eStatus !== "draft") throw new HttpError(409, "Portala taslak yükleme kapalı (Entegratör Ayarları → Ek Seçenekler).", { code: "einvoice-draft-off" });
    }
    // Bitiş turu Y2: bağlantı (canlı kilidi, kullanıcı adı/parola), firma, alıcı ve iade denetimleri NUMARA VERİLMEDEN önce — gönderilemeyecek
    // belge Gönderilecekler'den çıkıp test serisinden kalıcı numara almasın.
    {
      const s = settings();
      const pre = detail(id, user);
      // Gönderilecekler'den silinmiş (withdrawn) belge KAGIT görünür ama e-Belge profiliyle (eProfile) gönderilir — denetim onu da kapsar (kontrol turu K1).
      const withdrawn = pre.eStatus === "withdrawn";
      if (pre.status === "issued" && (pre.profile !== "KAGIT" || withdrawn)) {
        const clash = Object.entries(s.series).find(([, value]) => TEST_SERIES_SET.has(value));
        if (clash) throw new HttpError(409, `${clash[1]} serisi test ortamına ayrılmıştır; Fatura Ayarları → Seriler'de ${SERIES_LABELS[clash[0]] || clash[0]} serisini değiştirin, sonra gönderin.`, { code: "series-reserved" });
        const link = integrator(s);
        const checked = withdrawn ? { ...pre, profile: invoiceRow(id).eProfile } : pre;
        preflight(checked, s);
        await assertNotEFaturaBuyer(user, checked, link);
        // Dar kontrol 2.4.3 (ek 1): numara entegratör oturumu kurulduktan SONRA verilir — yanlış kullanıcı adı/parola ya da kapalı bağlantıda belge
        // numara almadan Gönderilecekler'de kalır (önceden numara girişten önce veriliyordu; her belge numara alıp düşüyordu).
        if (["waiting", "withdrawn"].includes(pre.eStatus) && link.ensureSession) {
          try {
            // B3: geçerli oturum + yakın zamanda EDM yanıtı varsa yeniden giriş yok (erişim kanıtı); yoksa giriş numaradan önce.
            // 2.4.4 (e-SMM): belgenin servisinde (checked.profile: Müşteri Fişi Olarak Bırakılmış belgede asıl e-Belge profili).
            await link.ensureSession({ invoice: checked });
          } catch (error) {
            if (loginRejected(error)) throw new HttpError(502, `Entegratör girişi reddedildi (kullanıcı adı/parola): ${String(error?.message || error).slice(0, 300)} Belge numara verilmeden Gönderilecekler'de kaldı; Entegratör Ayarları'nı düzeltip yeniden deneyin.`, { code: "integrator-login", stage: "login" });
            throw error;
          }
        }
      }
    }
    const wasWaiting = invoiceRow(id).eStatus === "waiting";
    const numberedNow = Boolean(numberForSend(user, id, { listedOnly })) && wasWaiting;
    const doc = detail(id, user);
    // B3 + K12: numara bu çağrıda (numarasız bekleyene gönderim anında; Listeden Silinmiş fiş değil) ya da bu istekte kayıtta verildiyse, gönderim
    // EDM'ye KESİN ulaşmadığında geri bırakılır.
    const releasable = !draft && doc.eStatus !== "draft" && (fresh || numberedNow);
    if (doc.eTest && liveEnv(settings())) throw new HttpError(409, `${doc.number} test ortamında numara almış bir belgedir; canlı ortamda gönderilmez (seri ${doc.number.slice(0, 3)}). Belgeyi iptal edip yeniden kaydedin: firmanızın serisinden numara alır.`, { code: "einvoice-test-series" });
    if (!doc.canSend) {
      if (doc.profile === "KAGIT") throw new HttpError(409, "Kâğıt belge / müşteri fişi e-Belge olarak gönderilmez.", { code: "einvoice-paper" });
      if (doc.status !== "issued") throw new HttpError(409, "Yalnız kaydedilmiş fatura gönderilir.", { code: "einvoice-not-issued" });
      if (!E_SENDABLE.has(doc.eStatus || "none")) throw new HttpError(409, `Bu belge zaten entegratöre iletildi (durum: ${E_STATES[doc.eStatus] || doc.eStatus}). Sonucu Durum Sorgula ile alın.`, { code: "einvoice-already-sent" });
      throw new HttpError(409, "Bu belge gönderilemez.", { code: "einvoice-not-sendable" });
    }
    const s = settings();
    preflight(doc, s);
    try {
      const link = integrator(s);
      // Önceki gönderimin sonucu belirsizse (Y3/S1) önce sorulur: belge EDM'deyse yeniden gönderilmez (aynı ETTN ikinci kez reddedilir ve belge
      // yanlışlıkla "Hata"ya düşerdi), durum güncellenir; EDM'de yoksa gönderim sürer.
      if (uncertainSend(doc)) {
        try {
          const remote = await link.status({ invoice: doc });
          setE(user, doc.id, { status: remote.status, adapter: link.id, message: remote.message }, "invoice.e.status", { raw: remote.raw || "" });
          return { ...remote, message: `Belge önceki gönderimde entegratöre ulaşmış; yeniden gönderilmedi. ${remote.message}` };
        } catch (error) {
          if (!remoteMissing(error, doc.profile)) throw error;
        }
      }
      if (doc.eStatus === "draft") {
        const remote = await link.status({ invoice: doc });
        if (remote.status !== "draft") {
          setE(user, doc.id, { status: remote.status, message: remote.message }, "invoice.e.status", { raw: remote.raw || "" });
          return { ...remote, message: `Taslak EDM'de artık taslak değil (portaldan gönderilmiş ya da işlenmiş olabilir); durum güncellendi. ${remote.message}` };
        }
      }
      const xml = ublFor(doc, {}, s);
      let result;
      try {
        if (draft) result = await link.loadDraft({ invoice: doc, xml });
        else if (doc.eStatus === "draft") {
          await link.loadDraft({ invoice: doc, xml });
          result = await link.sendDraft({ invoice: doc });
        } else result = await link.send({ invoice: doc, xml });
      } catch (error) {
        // Entegratör reddettiyse belge gitmemiştir: "Hata" işlenir, düzeltilip yeniden gönderilir. Bağlantı koptuysa
        // sonuç belirsizdir: durum değişmez (aynı ETTN ikinci kez kabul edilmez; önce Durum Sorgula).
        const code = error?.extra?.code || error?.code || "";
        const rejected = ["integrator-rejected", "integrator-contract", "integrator-alias"].includes(code);
        // Portaldaki taslak reddedilse de taslak olarak kalır (yeniden yüklenir); "Hata"ya düşerse sonraki Gönder taslağı tanımaz.
        // Taslaktaki belgede damga (e_at) değişmez: yenileme başarısızsa portaldaki kopya hâlâ eskidir, "taslak eski" uyarısı kalkmamalı.
        if (doc.eStatus === "draft") {
          store.tx(() => {
            store.run("UPDATE invoices SET e_message = ? WHERE id = ?", String(error?.message || error).slice(0, 500), doc.id);
            audit(user, draft ? "invoice.e.draft-failed" : "invoice.e.send-failed", doc.id, { status: "draft", adapter: link.id, code });
          });
          publish(user, { kind: "invoices", invoiceId: doc.id });
          throw error;
        }
        // Kontrol turu K2: istek gitmiş olabilecek her hata (bağlantı, zaman aşımı, okunamayan yanıt) önceki durum ne olursa olsun (ör. "Hata"dan yeniden
        // gönderim) "belirsiz" yazılır. K5: isteğin hiç gitmediği bilinen hatalar (kanal, adres, kimlik, oturum) belirsiz sayılmaz, durum değişmez.
        // 2.4.2 (kullanıcı denemesi 17.10.2026): EDM "Daha önce gönderdiğiniz bir faturayı tekrar göndermeye çalıştınız" (11048) — numara EDM'de
        // kullanılmış; test hesabı ortak olduğu için çoğunlukla başka firmanın numarası. İleti ne yapılacağını söyler.
        if (String(error?.extra?.integratorCode || error?.integratorCode || "") === "11048" && error instanceof Error) {
          const testDoc = TEST_SERIES_SET.has(String(doc.number || "").slice(0, 3));
          error.message = `${error.message} ${testDoc
            ? "Bu numara EDM'de daha önce kullanılmış: test hesabı ortaktır, başka bir firma aynı numarayı kullanmış olabilir. Bu belgeyi İptal Et ile iptal edip yeniden kesin; yeni belge bir sonraki numarayı alır (gerekirse Entegratör Ayarları → Otomatik Seriler'den sıradaki test numarasını ileri alın)."
            : "Bu numarayla EDM'ye daha önce belge gönderilmiş. Bu belgeyi İptal Et ile iptal edip yeniden kesin; gerekirse Fatura Ayarları → Numaralar'dan sıradaki numarayı ileri alın."}`;
        }
        // Dar kontrol 2 (B3 + K12): erişim kanıtı önbellekteki oturumdan geldiği için ağ, numara verildikten sonra kopmuş olabilir. Bağlantı HİÇ
        // KURULAMADIYSA (integrator-unreachable; edm.mjs B2 sınıflaması) EDM belgeyi görmemiştir: numara bu istekte verildiyse ve serinin son numarasıysa
        // geri bırakılır (seride boşluk kalmaz), belge numarasız Gönderilecekler'e döner — ağ yokken numara verilmez kuralı korunur.
        if (code === "integrator-unreachable" && releasable && releaseNumber(user, doc.id, doc.number, error)) throw error;
        const notSent = NOT_SENT_CODES.has(code);
        if (notSent) setE(user, doc.id, { status: doc.eStatus || "none", message: error?.message || String(error) }, draft ? "invoice.e.draft-failed" : "invoice.e.send-failed", { adapter: link.id, code });
        else setE(user, doc.id, { status: rejected ? "error" : "none", adapter: link.id, message: error?.message || String(error) }, draft ? "invoice.e.draft-failed" : "invoice.e.send-failed", { adapter: link.id, code });
        throw error;
      }
      // 2.4.4 madde 22: entegratörün kaydettiği numara ve ETTN programdakiyle AYNI olmalı (numarayı program verir). Farklıysa sessizce "gönderildi"
      // denmez: belge entegratöre ulaştığı için durumu yazılır (iletim kaydı, Durum Sorgula / İptal Et açık), iletisi farkı ve ne yapılacağını söyler,
      // istek hata döner; Tümünü Gönder durur (entegratör kendi numarasını veriyorsa kalan belgeler de ayrışırdı).
      const mismatch = referenceMismatch(doc, result);
      setE(user, doc.id, { status: result.status, adapter: link.id, message: mismatch || result.message }, draft ? "invoice.e.draft" : "invoice.e.sent", { adapter: link.id, reference: result.reference, ...(mismatch ? { uuid: String(result.uuid || ""), mismatch: true } : {}) });
      if (mismatch) throw new HttpError(502, mismatch, { code: "integrator-reference", reference: String(result.reference || "") });
      return result;
    } finally {
      // kilit sendInvoice'ta (gönderim ↔ iptal)
    }
  }
  // Gönderilecekler'den silme: hiçbir etki geri alınmaz. Belge Müşteri Fişi olarak kalır ve fiş serisinden numara alır
  // (fiş resmî belge değildir; tarih sırası aranmaz). İstenirse sonra yine e-Belge olarak gönderilir.
  function withdraw(user, id) {
    const result = store.tx(() => {
      const row = invoiceRow(id);
      if (row.status !== "issued" || row.eStatus !== "waiting") throw new HttpError(409, `Yalnız Gönderilecekler'deki belge ${paperNameOf(row.kind).name} olarak bırakılır.`, { code: "invoice-not-waiting" });
      const s = settings();
      const series = paperSeriesOf(row.kind, s);
      const year = Number(row.issueDate.slice(0, 4));
      // Dar kontrol 2.4.3 (kâhin BASKA-FIS-SIRA): Müşteri Fişi serisi de numara–tarih sırasına uyar (kâğıt kaydındaki kural, assertChronology):
      // belge serinin son fişinden eski tarihliyse fiş numarası verilmez.
      const last = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 ORDER BY seq DESC LIMIT 1", series, year);
      if (last && last.issueDate > row.issueDate) throw new HttpError(409, `${series} serisinde son belge ${last.number} ${dayText(last.issueDate)} tarihli; bu belge (${dayText(row.issueDate)}) ondan eski. Belgenin tarihini düzeltin ya da İptal Edin.`, { code: "chronology" });
      const { seq, number } = nextNumber(series, year, s);
      store.run("UPDATE invoices SET profile = 'KAGIT', series = ?, year = ?, seq = ?, number = ?, e_status = 'withdrawn', updated_by = ?, updated_at = ? WHERE id = ?", series, year, seq, number, user.id, now(), row.id);
      renumberNotes(row.id, number);
      audit(user, "invoice.withdrawn", row.id, { number, profile: row.profile });
      return { id: row.id, number };
    });
    publish(user, { kind: "invoices", invoiceId: result.id });
    publish(user, { kind: "accounts", accountId: invoiceRow(result.id).accountId });
    return result;
  }
  // Portala taslak açıkken (İz 7.3) otomatik / toplu / "Kes ve Gönder" gönderimi taslak yükler; taslaktaki belge "Gönder"le gönderilir.
  // 2.4.4 madde 22: e-SMM'de portala taslak yok — ayar açıkken de makbuz doğrudan gönderilir (yoksa taslak yükleme reddedilip belge düşerdi).
  const draftFirst = id => {
    const row = settings().eOptions.draftUpload === true ? invoiceRow(id) : null;
    return Boolean(row) && row.eStatus !== "draft" && eProfileOf(row) !== "ESMM";
  };
  async function maybeAutoSend(user, id) {
    if (!edocEnabled) return null;
    const s = settings();
    if (!s.integrator.autoSend) return null;
    const doc = detail(id, user);
    if (!doc.canSend) return null;
    try {
      return { ok: true, ...(await sendInvoice(user, id, { draft: draftFirst(id), fresh: true })) };
    } catch (error) {
      if (released(error)) return loginHoldResult({ code: "integrator-unreachable" });
      noteSendFailure(user, id, error);
      return unsentResult(id, error);
    }
  }
  // Kesimdeki seçim: "now" = Kes ve Gönder, "later" = Kes, Sonra Gönder (Gönderilecekler), boş = ayardaki otomatik gönderim.
  // Belge her durumda kesilmiştir; gönderim hatası kesimi geri almaz, kartta ve Gönderilecekler'de görünür.
  async function sendChoice(user, id, choice) {
    if (choice === "later") return null;
    if (choice !== "now") return maybeAutoSend(user, id);
    if (!edocEnabled || !detail(id, user).canSend) return null;
    try {
      return { ok: true, ...(await sendInvoice(user, id, { draft: draftFirst(id), fresh: true })) };
    } catch (error) {
      if (released(error)) return loginHoldResult({ code: "integrator-unreachable" });
      noteSendFailure(user, id, error);
      return unsentResult(id, error);
    }
  }
  // 2.4.3 (hız testi H1): "Kaydet ve Gönder"de entegratöre ulaşılamazsa (bağlantı, mükellef sorgusu) belge numarasını almış, gönderilmemiş kalıyordu;
  // nedeni belgede yazmıyordu ve Gönderilecekler'de görünmüyordu. Gönderim isteği hiç gitmeden düşen hata da (ön denetim, bağlantı) belgenin e-Belge
  // iletisine yazılır (durum değişmez; isteği gitmiş olabilecek hatayı sendInvoiceOnce zaten "belirsiz" işler). Portal taslağındaki belgenin damgası
  // (e_at) değişmez: taslağın eskiliği ona bakar.
  // Dar kontrol 2.4.3 (D2): başka oturumun işi (gönderiliyor / gönderildi), sıra beklemesi ve listeden silinme belgenin e-Belge iletisine yazılmaz
  // (gönderilmiş belgenin iletisi "zaten iletildi" hatasıyla eziliyordu).
  const NOT_NOTED = new Set(["einvoice-already-sent", "einvoice-sending", "einvoice-order", "einvoice-withdrawn"]);
  const released = error => Boolean(error?.extra?.released || error?.released);
  function noteSendFailure(user, id, error) {
    if (NOT_NOTED.has(error?.extra?.code || error?.code || "") || released(error)) return;
    const row = store.get("SELECT status, e_status AS eStatus, e_message AS eMessage FROM invoices WHERE id = ?", id);
    const message = String(error?.message || error || "").slice(0, 500);
    if (!row || row.status !== "issued" || row.eStatus === "draft" || !message || row.eMessage === message) return;
    setE(user, id, { status: row.eStatus || "none", message }, "invoice.e.send-failed", { code: error?.extra?.code || error?.code || "", stage: "before-send", detail: String(error?.extra?.detail || error?.detail || "").slice(0, 200) });
  }
  // Kaydedilip gönderilemeyen belgenin yanıtı: numara, neden ve nerede beklediği (Gönderilecekler) açıkça söylenir.
  function unsentResult(id, error) {
    const row = invoiceRow(id);
    const reason = error?.message || String(error);
    // 2.4.4 madde 22: belge entegratöre ulaştı ama başka numarayla kaydedildi — "gönderilmedi" denmez; ileti farkı ve yapılacağı söyler.
    if ((error?.extra?.code || error?.code) === "integrator-reference") return { ok: false, pending: false, number: row.number, code: "integrator-reference", message: reason };
    const where = row.eStatus === "waiting" ? "Belge numarasız olarak Gönderilecekler'de bekliyor" : row.number ? `Belge ${row.number} numarasıyla kaydedildi, entegratöre gönderilmedi; Gönderilecekler'de bekliyor` : "Belge Gönderilecekler'de bekliyor";
    const next = uncertainSend(row) ? "Sonuç belirsiz: önce kartında Durum Sorgula'ya basın." : "Bağlantı ya da sorun düzelince Gönderilecekler'den (Tümünü Gönder) ya da kartındaki e-Belge Gönder ile gönderin.";
    return { ok: false, pending: true, number: row.number, code: error?.extra?.code || error?.code || "", message: `${reason} ${where}. ${next}` };
  }
  router.post("/api/workspace/invoices/:id/withdraw", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    // Kontrol turu 6: gönderim sürerken "Listeden Sil" belgeyi fişe çeviriyor, gönderim yine e-Arşiv olarak gidiyordu.
    const withdrawId = invoiceRow(params.id).id;
    const release = holdInvoice(withdrawId, "editing");
    try {
      withdraw(user, withdrawId);
    } finally {
      release();
    }
    ok(res, detail(params.id, user));
  });
  // Gözden geçirme 2.4.3 (S2): "Tümünü Gönder" yalnız ekrandaki sayfanın (≤200) kimliklerini gönderiyordu; listede olmayan daha eski bekleyenler
  // kronoloji engeline düşüp kalıcı olarak gönderilemiyordu. Artık istemci "tümü" der ({ all: true }); sunucu Gönderilecekler'in TAMAMINI kendisi
  // seçer (yetki ve şirket aynen), en eskiden başlayarak tarih + saat + kayıt anı + yazım sırasıyla (ders 31) gönderir. Kalıcı engelli (seride daha
  // yeni numara verilmiş; alıcı e-Fatura mükellefi) belge nedeniyle listelenir, gönderilmez.
  // Dar kontrol 2.4.3 (Y1): bir istek en çok SEND_CHUNK belgeyi entegratöre GÖNDERMEYİ DENER ya da süre bütçesi (SEND_BUDGET_MS, üretimde 10 sn)
  // dolunca durur — hangisi önce dolarsa; ulaşılmayan belge sayısı (remaining) döner, istemci kalan bitene / ilerleme durana dek yineler. (Önceden
  // bir istek 200 belgeyi gönderiyordu: gerçek EDM hızında ~37 sn+ — tarayıcı 30 sn'de "Sunucu zamanında yanıt vermedi" diyordu, sunucu arkada
  // sürüyordu.) Ağa çıkmadan bekletilen belge (sıra) sınıra sayılmaz. Seçili kimliklerle gönderim ({ ids }, en çok SEND_TURN) parçalanmaz.
  // 2.4.4 (E6, müşteri isteği "Seçilenleri Gönder"): { only: [kimlikler] } Tümünü Gönder'in AYNI turunu yürür — aynı sıra, kalıcı engel, imleç,
  // 20'lik parça / süre bütçesi, durma, belge kilidi, sonucu belirsiz önce sorulur — yalnız seçilen Gönderilecekler'le. e-Belge numarası seri + yıl
  // içinde tarih sırasıyla verilir (GİB): seçilmemiş, daha eski tarihli, gönderilebilir numarasız bekleyen belge varken seçilen yenisi numara alırsa
  // eski belge e-Belge olarak hiç gönderilemez. Bu yüzden turun İLK isteği hiçbir belgeyi göndermeden bunu sorar (409 einvoice-selection-older:
  // eski belgeler ve kimlikleri; ekran "Onları da Ekle ve Gönder / Vazgeç" der) — sessiz atlama ya da yarım tur yok. { only, check: true } aynı
  // denetimi gönderimsiz yapar (numara yok, entegratöre gidilmez). Eski { ids } biçimi (2.4.3 API'si) değişmedi; ekran kullanmaz.
  // Gönderim sırasında başka oturum daha eski tarihli belge kaydederse (ön denetimden sonra) o belge "dahil değil" (outside) ile seriyi bekletir.
  const SEND_SELECT_MAX = 5000;
  const SEND_OLDER_SHOWN = 50;
  const SEND_TURN = 200;
  const SEND_CHUNK = 20;
  const sendOrder = (x, y) => `${x.issueDate || ""} ${x.issueTime || ""} ${x.createdAt || ""}`.localeCompare(`${y.issueDate || ""} ${y.issueTime || ""} ${y.createdAt || ""}`) || x.rn - y.rn;
  const SEND_COLS = "i.id, i.kind, i.status, i.profile, i.e_status AS eStatus, i.e_profile AS eProfile, i.issue_date AS issueDate, i.issue_time AS issueTime, i.created_at AS createdAt, i.rowid AS rn, i.account_id AS accountId";
  // B1: istemcinin geri verdiği imleç (sıra anahtarı); bozuk ya da eksikse tur baştan başlar.
  const cursorOf = value => {
    if (!value || typeof value !== "object") return null;
    const rn = Number(value.rn);
    if (!Number.isSafeInteger(rn) || typeof value.issueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.issueDate)) return null;
    return { issueDate: value.issueDate, issueTime: String(value.issueTime || "").slice(0, 40), createdAt: String(value.createdAt || "").slice(0, 40), rn };
  };
  router.post("/api/workspace/invoices/send-pending", async ({ req, res }) => {
    const user = requireManage(req);
    requireEdoc();
    const body = await readJson(req);
    // E6: { only } seçilenlerle tur (all ile birlikte gelse de yalnız seçilenler — fazlası gönderilmez); { all } Gönderilecekler'in tamamı.
    const only = Array.isArray(body.only) ? [...new Set(body.only.map(value => text(value)).filter(Boolean))] : null;
    if (only && !only.length) throw new HttpError(400, "Gönderilecek belge seçilmedi.", { code: "einvoice-selection-empty" });
    if (only && only.length > SEND_SELECT_MAX) throw new HttpError(400, `Seçilenleri Gönder en çok ${SEND_SELECT_MAX.toLocaleString("tr-TR")} belgeyle çalışır; Gönderilecekler'in tamamı için Tümünü Gönder'i kullanın.`, { code: "einvoice-selection-large" });
    const all = body.all === true && !only;
    const check = Boolean(only) && body.check === true;
    // Parçalı tur (imleç, parça / süre bütçesi): Tümünü Gönder ve Seçilenleri Gönder.
    const turn = all || Boolean(only);
    const lastCache = new Map();
    const lastOf = (key, read) => (lastCache.has(key) ? lastCache.get(key) : lastCache.set(key, read()).get(key));
    const unnumberedSeries = row => {
      if (!["waiting", "withdrawn"].includes(row.eStatus) || row.status !== "issued") return "";
      const profile = row.eStatus === "withdrawn" ? row.eProfile : row.profile;
      return profile && profile !== "KAGIT" ? `${seriesFor(row.kind, profile, settings())}|${row.issueDate.slice(0, 4)}` : "";
    };
    let ids;
    let order;
    const results = [];
    // Dar kontrol 2 (2.4.3, B1): tur bir İMLEÇLE ilerler. İmleç, önceki istekte ulaşılan son belgenin sıra anahtarıdır (sendOrder); istemci onu
    // sonraki isteğe geri verir. Bir turda her belge EN ÇOK BİR KEZ denenir: imleçten önceki belgeler (gönderilemeyen / reddedilen) bu turda yeniden
    // denenmez — önceden kuyruğun başındaki reddedilen belgeler her istekte yeniden gidip 20'lik parçayı dolduruyor, yeni belgeler hiç gitmiyordu.
    const cursor = turn && !check ? cursorOf(body.after) : null;
    const held = new Map();
    const byId = new Map();
    const onlySet = only ? new Set(only) : null;
    // E6: seçilmemiş, gönderilebilir (kalıcı engelsiz) numarasız bekleyenler — eskiden yeniye; seri + yıl başına ilki "outside" (bekleten).
    const outsideRows = [];
    if (!all) {
      const unselected = only ? id => !onlySet.has(id) : () => true;
      for (const row of store.all(`SELECT ${SEND_COLS}, a.name AS accountName, i.party_json AS partyJson, a.id AS accountFound, a.tax_no AS accountTaxNo, a.e_invoice AS accountEInvoice FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id WHERE i.status = 'issued' AND i.e_status = 'waiting'`).sort(sendOrder)) {
        if (!unselected(row.id) || sendBlockOf(row, lastOf) || buyerBlockOf(row, row)) continue;
        if (unnumberedSeries(row)) outsideRows.push(row);
      }
    }
    if (turn) {
      const unsent = unsentSql();
      // B4: alıcı bilgisi (buyerBlockOf) aynı sorguda okunur — istek başına satır sayısı kadar ek sorgu yok (tur 20'lik parçalarla ilerler).
      const rows = store.all(`SELECT ${SEND_COLS}, i.party_json AS partyJson, a.id AS accountFound, a.tax_no AS accountTaxNo, a.e_invoice AS accountEInvoice FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id WHERE ${unsent.sql}${only ? " AND i.id IN (SELECT value FROM json_each(?))" : ""}`, ...unsent.args, ...(only ? [JSON.stringify(only)] : [])).sort(sendOrder);
      const sendable = [];
      const passed = [];
      const permanent = [];
      for (const row of rows) {
        const block = sendBlockOf(row, lastOf);
        const buyer = block ? "" : buyerBlockOf(row, row);
        if (block || buyer) permanent.push({ id: row.id, ok: false, permanent: true, code: block ? "chronology" : "buyer-is-efatura", message: block || buyer });
        else if (cursor && sendOrder(row, cursor) <= 0) passed.push(row);
        else sendable.push(row);
      }
      results.push(...permanent);
      if (only && !cursor) {
        // E6 ön denetim (turun ilk isteği; hiçbir belge gönderilmeden, numara verilmeden): seçilenlerden numara alacak olanların her seri + yılında,
        // seçimin o serideki en yeni tarihinden ESKİ seçilmemiş gönderilebilir numarasız bekleyenler. Aynı gün bekletmez (kronoloji katı: tarih).
        const newest = new Map();
        for (const row of sendable) {
          const key = unnumberedSeries(row);
          if (key && !(newest.get(key) >= row.issueDate)) newest.set(key, row.issueDate);
        }
        const older = outsideRows.filter(row => {
          const key = unnumberedSeries(row);
          return newest.has(key) && row.issueDate < newest.get(key);
        });
        const found = new Set(rows.map(row => row.id));
        const notPending = only.filter(id => !found.has(id));
        const olderInfo = row => ({ id: row.id, issueDate: row.issueDate, accountName: row.accountName || "", series: unnumberedSeries(row).split("|")[0] });
        const summary = { count: older.length, older: older.slice(0, SEND_OLDER_SHOWN).map(olderInfo), olderIds: older.map(row => row.id) };
        if (check) return ok(res, { check: true, sendable: sendable.length, permanent: permanent.length, notPending: notPending.length, ...summary });
        if (older.length) {
          const first = older[0];
          throw new HttpError(409, `Seçilenlerle aynı seride, seçilmemiş ve daha eski tarihli ${older.length.toLocaleString("tr-TR")} belge Gönderilecekler'de bekliyor (en eskisi: ${first.accountName || "cari"}, ${dayText(first.issueDate)}). e-Belge numarası tarih sırasıyla verilir: önce onlar gönderilmeli. Onları da seçime ekleyip gönderin ya da Tümünü Gönder'i kullanın; hiçbir belge gönderilmedi.`, { code: "einvoice-selection-older", ...summary });
        }
        // Seçimde olup artık Gönderilecekler'de olmayan belge (bu arada gönderildi, iptal edildi, Müşteri Fişi olarak bırakıldı) sessizce düşmez.
        results.push(...notPending.map(id => ({ id, ok: false, skipped: true, reason: "not-pending", code: "einvoice-not-pending", message: "Gönderilmedi: belge artık Gönderilecekler'de değil (başka oturumda gönderilmiş, iptal edilmiş ya da Müşteri Fişi olarak bırakılmış olabilir)." })));
      }
      // İmleçten önceki, hâlâ numarasız bekleyen (bu turda gönderilemedi ya da sırası bekletildi) belge aynı serinin daha yeni belgelerini bu turda
      // da bekletir (sıra kuralı; turun ilk isteğindeki "held" ile aynı). En eski olan engeldir.
      // Dar kontrol 3 (2.4.3, B-2): imleçten önce kalan belge bu turda hiç DENENMEMİŞ olabilir — tur sürerken kaydedildi (aynı gün daha erken saat) ya
      // da tarihi geri alındı. Önceden hepsi "gönderilemedi; önce onu düzeltip yeniden gönderin" diye bildiriliyordu (yanlış neden). Bu turda yeniden
      // denenmez (B1: turda her belge en çok bir kez; imleç durumsuzdur, denenmiş/denenmemiş ayrımı ancak belgenin kaydedilmiş gönderim hatasından
      // okunur). Gönderim hatası yazılmamış (e_message boş) belge "sırada" sayılır: sonrakiler GİB kronolojisi için bekletilir, ileti "daha eski belge
      // sırada; Tümünü Gönder'e yeniden basın" der ve yanıt turun yarım kaldığını bildirir (rerun) — yeni basış en eski belgeden başlar.
      if (passed.length) {
        const names = new Map(store.all(`SELECT i.id, a.name AS accountName, i.e_message AS eMessage FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id WHERE i.id IN (${passed.map(() => "?").join(", ")})`, ...passed.map(row => row.id)).map(row => [row.id, row]));
        for (const row of passed) {
          const key = unnumberedSeries(row);
          const seen = names.get(row.id) || {};
          if (key && !held.has(key)) held.set(key, { issueDate: row.issueDate, accountName: seen.accountName || "", number: "", code: "", reason: seen.eMessage ? "failed" : "queued" });
        }
      }
      order = sendable.map(row => row.id);
      for (const row of rows) byId.set(row.id, row);
      ids = [...results.map(item => item.id), ...order];
    } else {
      ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(value => text(value)).filter(Boolean))].slice(0, SEND_TURN);
      // 2.4.3 (keşif B1): belgeler istemcinin sırasıyla (liste: yeniden eskiye) gönderiliyordu; en yeni belge numarayı alınca eski tarihli bütün
      // bekleyenler seri kronolojisi yüzünden (sendBlockOf) e-Belge olamıyordu. Sıra sunucuda: tarih, saat, kayıt anı, yazım sırası (rowid; ders 31 —
      // kimlik rastgeledir, sıra anahtarı olamaz).
      const known = new Map(ids.length ? store.all(`SELECT ${SEND_COLS} FROM invoices i WHERE i.id IN (${ids.map(() => "?").join(", ")})`, ...ids).map(row => [row.id, row]) : []);
      order = ids.filter(id => known.has(id)).sort((a, b) => sendOrder(known.get(a), known.get(b)));
      results.push(...ids.filter(id => !known.has(id)).map(id => ({ id, ok: false, message: "Fatura bulunamadı; silinmiş olabilir." })));
    }
    // Gözden geçirme 2.4.3 (S2): seçili kimliklerle gönderimde, aynı serinin bu gönderime dahil olmayan daha eski numarasız bekleyeni varsa yenisi
    // numaralandırılmaz (yoksa eski belge sonradan hiç gönderilemezdi). Kalıcı engelli eski belge (sendBlockOf, buyerBlockOf) beklenmez: zaten
    // gönderilemez.
    // E6: Seçilenleri Gönder'de "dahil olmayan" = seçilmemiş (ön denetimden sonra, tur sürerken kaydedilen daha eski belge de burada yakalanır).
    const inTurn = only ? onlySet : new Set(order);
    const outside = new Map();
    for (const row of outsideRows) {
      if (inTurn.has(row.id)) continue;
      const key = unnumberedSeries(row);
      if (!outside.has(key)) outside.set(key, row);
    }
    // Numarasız bir belge GEÇİCİ bir nedenle (bağlantı, entegratör, başka oturumda gönderiliyor, düzeltilebilir alıcı bilgisi, sıra) gönderilemezse
    // aynı serinin daha yeni tarihli numarasız belgeleri bu turda gönderilmez: önce eski belge numara almalı. Gözden geçirme 2.4.3 (S1) ve dar kontrol
    // (O3): KALICI engelli belge (PERMANENT_SEND_CODES) bekletmez; o belge bu seride hiç gönderilemez, yenileri gönderilir.
    const skipText = (reason, blocker) =>
      reason === "busy"
        ? `Gönderilmedi, sırasını koruyarak bekliyor: aynı serideki daha eski tarihli belge (${blocker.accountName}, ${dayText(blocker.issueDate)}) şu anda başka oturumda gönderiliyor. Gönderim bitince listeyi yenileyin; kalan belge olursa Tümünü Gönder'e yeniden basın.`
        : reason === "outside"
          ? `Gönderilmedi, sırasını koruyarak bekliyor: aynı serideki daha eski tarihli belge (${blocker.accountName}, ${dayText(blocker.issueDate)}) Gönderilecekler'de ve bu gönderime dahil değil. Önce o gönderilmeli: Gönderilecekler'deki Tümünü Gönder eski tarihliden başlar.`
          : reason === "alias"
            ? `Gönderilmedi, sırasını koruyarak bekliyor: daha eski tarihli belgenin (${blocker.number || blocker.accountName}, ${dayText(blocker.issueDate)}) posta kutusu seçilmeli (Mükellef Sorgula / Posta Kutusu Seçin). O belge gönderilince bu belge de gönderilir.`
          : reason === "queued"
            ? `Gönderilmedi, sırasını koruyarak bekliyor: aynı serideki daha eski tarihli belge (${blocker.accountName}, ${dayText(blocker.issueDate)}) bu gönderim sürerken kaydedildi ya da tarihi değişti; bu turda denenmedi. Tümünü Gönder'e yeniden basın: gönderim en eski belgeden başlar.`
          : reason === "order"
            ? `Gönderilmedi, sırasını koruyarak bekliyor: aynı serideki daha eski tarihli belge (${blocker.accountName}, ${dayText(blocker.issueDate)}) de sırasını bekliyor. Önce daha eski tarihli belgeler gönderilmeli; Tümünü Gönder'e yeniden basın.`
            : `Gönderilmedi, sırasını koruyarak bekliyor: aynı serideki daha eski tarihli belge (${blocker.accountName}, ${dayText(blocker.issueDate)}) gönderilemedi. O belge gönderilmeden bu belge numara alırsa eski belge e-Belge olamaz; önce onu düzeltip yeniden gönderin.`;
    const started = Date.now(); // saat: gerçek (süre ölçümü / entegratör erişim tazeliği)
    let attempted = 0;
    let reached = 0;
    let stopped = null;
    let last = null;
    // Dar kontrol 2.4.3 (kâhin BASKA-ESZ): belge öbür oturumda gönderiliyorsa (einvoice-sending) o gönderimin bitmesi beklenir (en çok süre
    // bütçesi kadar): gittiyse "başka oturumda gönderildi" (hata değil, ok), gitmediyse (öbür oturumda düştü) bu oturum bir kez dener.
    const releasedWithin = async (invoiceId, ms) => {
      const until = Date.now() + ms; // saat: gerçek (süre ölçümü / entegratör erişim tazeliği)
      while (busy.has(invoiceId)) {
        if (Date.now() >= until) return false; // saat: gerçek (süre ölçümü / entegratör erişim tazeliği)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return true;
    };
    const sentElsewhere = invoiceId => {
      const now = invoiceRow(invoiceId);
      return now.status === "issued" && !E_SENDABLE.has(now.eStatus || "none") ? now : null;
    };
    for (const id of order) {
      // Y1: parça sınırı (deneme sayısı) ya da süre bütçesi — her istekte en az bir belge denenir (ilerleme).
      if (turn && (attempted >= SEND_CHUNK || (attempted > 0 && Date.now() - started >= SEND_BUDGET_MS))) break; // saat: gerçek (süre ölçümü / entegratör erişim tazeliği)
      if (turn && stopped) break;
      reached += 1;
      if (turn) last = byId.get(id) || last;
      if (stopped) {
        results.push({ id, ok: false, skipped: true, reason: "stopped", code: stopped.code, message: `Gönderilmedi (numara verilmedi): ${stopped.message}` });
        continue;
      }
      let row;
      try {
        row = invoiceRow(id);
      } catch {
        results.push({ id, ok: false, code: "invoice-missing", message: "Fatura bulunamadı; silinmiş olabilir." });
        continue;
      }
      const key = unnumberedSeries(row);
      const blocker = key ? held.get(key) : null;
      if (blocker && blocker.issueDate < row.issueDate) {
        results.push({ id, ok: false, skipped: true, reason: blocker.reason, code: "einvoice-held", blockerCode: blocker.code || "", message: skipText(blocker.reason, blocker) });
        continue;
      }
      const older = key ? outside.get(key) : null;
      if (older && older.issueDate < row.issueDate) {
        results.push({ id, ok: false, skipped: true, reason: "outside", code: "einvoice-held", message: skipText("outside", { accountName: older.accountName || "", issueDate: older.issueDate }) });
        continue;
      }
      attempted += 1;
      let retried = false;
      for (;;) {
        try {
          // Kâhin BEKLENEN-AG: EDM'ye erişim bu tur içinde doğrulanmadıysa numara vermeden önce denenir (turun ilk belgesi).
          const sent = await sendInvoice(user, row.id, { draft: draftFirst(row.id), listedOnly: true });
          results.push({ id, ok: true, number: invoiceRow(id).number, status: sent.status });
          break;
        } catch (error) {
          const code = error?.extra?.code || error?.code || "";
          // Gözden geçirme 2.4.3 (S3) ve kâhin BASKA-ESZ: iki kişi aynı anda Tümünü Gönder — belge öbür oturumda gönderiliyor.
          if (code === "einvoice-sending" && !retried && (await releasedWithin(row.id, Math.max(2000, SEND_BUDGET_MS)))) {
            const other = sentElsewhere(id);
            if (other) {
              results.push({ id, ok: true, done: true, code, number: other.number, status: other.eStatus, message: ALREADY_SENT_TEXT });
              break;
            }
            retried = true;
            continue;
          }
          const busyNow = code === "einvoice-sending";
          // Dar kontrol 2.4.3 (D2): belge bu arada başka oturumda gönderildi — hata değil (ok, done); iletisi değişmez.
          if (code === "einvoice-already-sent") {
            const other = sentElsewhere(id);
            results.push({ id, ok: true, done: true, code, number: other?.number || "", message: ALREADY_SENT_TEXT });
            break;
          }
          // O2: tur sürerken Listeden Silindi — Müşteri Fişi kalır; seriyi bekletmez.
          if (code === "einvoice-withdrawn") {
            results.push({ id, ok: false, skipped: true, reason: "withdrawn", code, message: withdrawnText(row.kind) });
            break;
          }
          // O1: seride daha eski tarihli gönderilebilir bekleyen var (ör. tur sürerken tarihi ileri alındı, başka oturumda eski tarihli belge kaydedildi).
          const waitOrder = code === "einvoice-order";
          noteSendFailure(user, row.id, error);
          const permanent = PERMANENT_SEND_CODES.has(code);
          let state = "";
          try {
            state = invoiceRow(id).eStatus;
          } catch {
            state = "";
          }
          if (key && !permanent && ["waiting", "withdrawn"].includes(state) && !held.has(key)) held.set(key, { issueDate: row.issueDate, accountName: row.accountName || "", number: row.number || "", code, reason: busyNow ? "busy" : waitOrder ? "order" : code === "buyer-alias" ? "alias" : "failed" });
          results.push({ id, ok: false, code: code || "einvoice-failed", ...(busyNow ? { busy: true } : {}), ...(waitOrder ? { skipped: true, reason: "order" } : {}), ...(permanent ? { permanent: true } : {}), message: busyNow ? "Bu belge şu anda başka oturumda gönderiliyor; gönderim bitince listeyi yenileyin." : error?.message || String(error) || "Gönderilemedi." });
          // BİLGİ (r7): bağlantı / entegratör hesabı hatası bütün belgelerde aynı düşer — tur durur, kalanlara numara verilmez.
          const cause = code === "buyer-check-failed" ? error?.extra?.cause || "" : code;
          if (loginRejected(error)) stopped = { code: "integrator-login", message: LOGIN_REJECTED_TEXT };
          else if (TURN_STOP_CODES.has(cause)) stopped = { code: cause, message: cause === "integrator-unreachable" ? UNREACHABLE_TEXT : `${error?.message || error} Kalan belgelere numara verilmedi; ayarı düzeltip yeniden deneyin.` };
          break;
        }
      }
    }
    const remaining = turn ? order.length - reached : 0;
    const byInput = new Map(results.map(item => [item.id, item]));
    const sorted = (turn ? ids : [...order, ...ids.filter(id => !order.includes(id))]).filter(id => byInput.has(id)).map(id => byInput.get(id));
    // B1: imleç — bu istekte ulaşılan son belgenin sıra anahtarı (ulaşılan yoksa gelen imleç aynen). attempted: entegratöre gönderimi denenen belge sayısı.
    const nextCursor = turn ? (last ? { issueDate: last.issueDate || "", issueTime: last.issueTime || "", createdAt: last.createdAt || "", rn: Number(last.rn) } : cursor) : null;
    // "Başka oturumda gönderildi" (done) ve "gönderiliyor" (busy) bilgi sayılır: gönderilen ya da gönderilemeyen sayısına girmez.
    ok(res, { results: sorted, sent: sorted.filter(item => item.ok && !item.done).length, failed: sorted.filter(item => !item.ok && !item.busy).length, skipped: sorted.filter(item => item.skipped).length, done: sorted.filter(item => item.done).length, remaining, attempted, ...(turn ? { cursor: nextCursor } : {}), ...(sorted.some(item => item.skipped && item.reason === "queued") ? { rerun: true } : {}), ...(stopped ? { stopped } : {}) });
  });
  router.post("/api/workspace/invoices/:id/send", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const result = await sendInvoice(user, invoiceRow(params.id).id);
    ok(res, { ...detail(params.id, user), sendResult: result });
  });
  // Portala taslak yükle / taslağı yenile (İz 7.3).
  router.post("/api/workspace/invoices/:id/e-draft", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const result = await sendInvoice(user, invoiceRow(params.id).id, { draft: true });
    ok(res, { ...detail(params.id, user), sendResult: result });
  });
  router.post("/api/workspace/invoices/:id/e-refresh", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const doc = detail(invoiceRow(params.id).id, user);
    if (!doc.canRefresh) throw new HttpError(409, doc.profile === "KAGIT" ? "Kâğıt belgenin e-Belge durumu olmaz." : "Bu belge henüz entegratöre gönderilmedi.", { code: "einvoice-not-sent" });
    let result;
    try {
      result = await integrator().status({ invoice: doc });
    } catch (error) {
      // Belirsiz gönderim ya da portaldan silinen taslak: EDM'de yoksa belge gönderilmemiştir (Y3, E2).
      if (!(remoteMissing(error, doc.profile) && (uncertainSend(doc) || doc.eStatus === "draft"))) throw error;
      clearE(user, doc.id, "Belge entegratörde bulunamadı: gönderilmemiş. Yeniden gönderebilir ya da değiştirebilirsiniz.");
      return ok(res, { ...detail(doc.id, user), statusResult: { status: "none", message: "Belge entegratörde bulunamadı: gönderilmemiş. Yeniden gönderebilir ya da değiştirebilirsiniz." } });
    }
    setE(user, doc.id, { status: result.status, message: result.message }, "invoice.e.status", { raw: result.raw || "" });
    const hint = result.status === "rejected" && doc.status === "issued" ? "Alıcı faturayı reddetti: faturayı programda İptal edin (stok, cari ve kasa etkileri geri alınır), gerekirse yeniden kesin." : "";
    ok(res, { ...detail(doc.id, user), statusResult: { ...result, hint } });
  });
  // Resmî görüntü (16.10.2026, Wolvox karşılaştırması madde 2): entegratörün belgeden ürettiği PDF — alıcının ve GİB'in gördüğü sayfa. İlk
  // açılışta EDM'den alınır; belge son hâlindeyse veri klasöründe saklanır (e-belge-gorunum/<ETTN>.pdf; veri tabanına girmez — her faturanın
  // ~70 KB'ı 30 yedeğin hepsini büyütmesin; yasal saklama entegratördedir, dosya silinse yeniden alınır).
  router.get("/api/workspace/invoices/:id/resmi.pdf", async ({ req, res, params, url }) => {
    const user = requireView(req);
    requireEdoc();
    const doc = detail(invoiceRow(params.id).id, user);
    if (!doc.canOfficial) throw new HttpError(409, doc.profile === "KAGIT" ? "Kâğıt belgenin resmî e-Belge görüntüsü olmaz." : "Bu belge henüz entegratöre ulaşmadı; resmî görüntüsü yok.", { code: "einvoice-not-sent" });
    const cacheDir = path.join(config.dataDir || ".", "e-belge-gorunum");
    // Önbellek dosyası belgenin e-Belge durumuna bağlı (bitiş turu E9): iptal / kabul / ret sonrası görüntü EDM'den yeniden alınır.
    const file = path.join(cacheDir, `${String(doc.ettn).replace(/[^0-9a-f-]/gi, "")}-${String(doc.eStatus).replace(/[^a-z]/g, "")}.pdf`);
    let data = existsSync(file) ? readFileSync(file) : null;
    if (!data) {
      data = (await integrator().officialPdf({ invoice: doc })).data;
      if (E_FINAL_VIEW.has(doc.eStatus)) {
        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(`${file}.tmp`, data);
        renameSync(`${file}.tmp`, file);
      }
    }
    audit(user, "invoice.e.official", doc.id, { number: doc.number });
    sendBuffer(res, data, { type: "application/pdf", name: `${safeName(doc.number)} Resmi Gorunum.pdf`, inline: url.searchParams.get("inline") === "1" });
  });
  router.post("/api/workspace/invoices/integrator/test", async ({ req, res }) => {
    const user = auth.requirePermission(req, "invoices.settings");
    requireEdoc();
    const s = settings();
    let result;
    try {
      const link = integrator(s);
      result = await link.test();
      // 2.4.4 madde 22: e-SMM kullanıcısında e-SMM servisi (ESmmEDM.svc; ayrı uç nokta, ayrı oturum) de denenir — e-Fatura girişi e-SMM'nin çalıştığını
      // göstermez.
      if (esmmEnabled && s.esmm) {
        try {
          const smm = await link.testSmm();
          result = { ...result, message: `${result.message} ${smm.message}`, smmContract: smm.contract };
        } catch (error) {
          if (error instanceof Error) error.message = `e-Fatura / e-Arşiv bağlantısı çalışıyor; e-SMM servisi çalışmıyor: ${error.message}`;
          throw error;
        }
      }
    } catch (error) {
      saveLastTest({ ok: false, message: String(error?.message || error).slice(0, 300) });
      throw error;
    }
    saveLastTest({ ok: true, message: String(result.message || "").slice(0, 300) });
    audit(user, "invoice.integrator.tested", "settings", { id: s.integrator.id, env: s.integrator.env, contract: result.contract?.source || "" });
    ok(res, result);
  });
  // Durum satırı (Entegratör Ayarları): son testin sonucu ayarlarda saklanır; kullanıcı adı/parola/ortam değişince silinir (settingsInput).
  function saveLastTest({ ok: success, message }) {
    const current = settings();
    current.integrator.lastTest = { ok: success, message, at: now() };
    store.setSetting(SETTINGS_KEY, JSON.stringify(current));
  }
  // Firmanın kendi etiketleri (Entegratör Ayarları → GB / PK listeleri): kayıtlı bağlantıyla EDM'de kendi VKN'si sorgulanır.
  router.post("/api/workspace/invoices/integrator/aliases", async ({ req, res }) => {
    auth.requirePermission(req, "invoices.settings");
    requireEdoc();
    const s = settings();
    const taxNo = String(s.seller.taxNo || "").replace(/\s+/g, "");
    if (!classifyTaxId(taxNo).ok) fail400("Önce Firma / Etiket Tanımları'nda firmanın VKN'sini (ya da TCKN'sini) yazıp kaydedin.", "seller.taxNo", { code: "seller-tax-id" });
    const result = await integrator(s).checkUser(taxNo);
    ok(res, { taxNo, registered: result.registered, title: result.title, senders: result.senderAliases || [], mailboxes: result.aliases || [] });
  });
  // 2.4.3 (KÖ1, kullanıcı kararı 18.10.2026): faturada "Nihai Tüketici" hızlı seçeneği — kimliği bilinmeyen perakende alıcı için TEK cari
  // (TCKN 11111111111; GİB e-Arşiv'de kimliği bilinmeyen nihai tüketici). Varsa en eski kayıt yeniden kullanılır (çift cari açılmaz), yoksa ilk
  // kullanımda açılır; il / ilçe firmanın adresinden (e-Arşiv alıcıda il zorunlu). Tutar sınırı (ANONYMOUS_LIMIT) belge denetiminde (partyProblems).
  router.post("/api/workspace/invoices/retail-account", async ({ req, res }) => {
    const user = requireManage(req);
    const existingId = accounts().taxIdentity.findByTaxNo(ANONYMOUS_TCKN);
    let id = existingId;
    if (!id) {
      const seller = settings().seller || {};
      id = store.tx(() => accounts().taxIdentity.findByTaxNo(ANONYMOUS_TCKN) || accounts().taxIdentity.createForParty(user, { name: "Nihai Tüketici", taxNo: ANONYMOUS_TCKN, partyKind: "person", firstName: "Nihai", familyName: "Tüketici", city: seller.city || "", district: seller.district || "", country: "Türkiye" }, "customer"));
      publish(user, { kind: "accounts", accountId: id });
    }
    const row = store.get("SELECT id, name FROM accounts WHERE id = ?", id);
    ok(res, { id: row.id, name: row.name, created: !existingId });
  });
  // Mükellef sorgusu: VKN/TCKN GİB e-Fatura kullanıcısı mı, posta kutusu etiketi ne? Cari verilirse kartına yazılır.
  router.post("/api/workspace/invoices/check-user", async ({ req, res }) => {
    const user = requireManage(req);
    requireEdoc();
    const body = await readJson(req);
    const taxNo = String(body.taxNo || "").replace(/\s+/g, "");
    const id = classifyTaxId(taxNo);
    if (!id.ok) fail400("Geçerli bir VKN (10 hane) ya da TC kimlik numarası (11 hane) yazın.", "taxNo");
    const result = await integrator().checkUser(taxNo);
    noteTaxpayer(taxNo, Boolean(result?.registered));
    let accountId = "";
    if (text(body.accountId)) accountId = accounts().taxIdentity.setEInvoice(user, text(body.accountId), { registered: result.registered, alias: result.aliases[0] || "", title: result.title }).id;
    ok(res, { ...result, taxNo, accountId });
  });
  // Entegratör portalına elle yüklenen belgenin durumu (Dosya adaptörü): kullanıcı GİB/entegratördeki sonucu işler.
  router.post("/api/workspace/invoices/:id/e-status", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const body = await readJson(req);
    const status = text(body.status);
    if (!["sent", "accepted", "rejected", "exported"].includes(status)) fail400("Durum gönderildi, kabul edildi, reddedildi ya da XML hazır olabilir.", "status");
    const row = invoiceRow(params.id);
    if (row.status !== "issued") throw new HttpError(409, "Yalnız kaydedilmiş faturanın e-Belge durumu işlenir.");
    store.tx(() => {
      store.run("UPDATE invoices SET e_status = ?, e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", status, limited(body.message, 500, "Açıklama"), now(), now(), row.id);
      audit(user, "invoice.e.status", row.id, { status });
    });
    publish(user, { kind: "invoices", invoiceId: row.id });
    ok(res, detail(row.id, user));
  });
  const idsOf = url => text(url.searchParams.get("ids")).split(",").map(value => value.trim()).filter(Boolean).slice(0, 500);
  router.get("/api/workspace/invoices/toplu.pdf", async ({ req, res, url }) => {
    const user = requireView(req);
    const ids = idsOf(url);
    if (!ids.length) fail400("Yazdırılacak faturaları seçin.", "ids");
    const pdf = pdfFor(ids.map(id => invoiceRow(id).id), user);
    audit(user, "invoice.pdf.bulk", "bulk", { count: ids.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Faturalar (${ids.length}).pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/invoices/ubl.zip", async ({ req, res, url }) => {
    const user = requireView(req);
    requireEdoc();
    const ids = idsOf(url);
    if (!ids.length) fail400("XML'i alınacak faturaları seçin.", "ids");
    const entries = [];
    for (const id of ids) {
      const doc = detail(id, user);
      if (doc.status !== "issued" || doc.profile === "KAGIT" || !sendKind(doc.kind, doc.profile)) continue;
      entries.push({ name: ublFileName(doc, false), data: Buffer.from(ublFor(doc), "utf8") });
    }
    if (!entries.length) fail400("Seçilenler arasında e-Belge olarak gönderilecek kaydedilmiş fatura yok (kâğıt fatura, taslak, iptal ve alış faturası XML'e girmez).", "ids");
    audit(user, "invoice.ubl.bulk", "bulk", { count: entries.length });
    sendBuffer(res, createZip(entries), { type: "application/zip", name: `e-Belgeler (${entries.length}).zip`, inline: false });
  });
  router.get("/api/workspace/invoices/export.xlsx", async ({ req, res, url }) => {
    const user = requireView(req);
    const data = list(user, listQuery(url.searchParams));
    const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
    const columns = ["Tarih", "Saat", "Fatura No", "Tür", "Senaryo", "Durum", "Cari", "Profil", "Para Birimi", "Kur", "Matrah (TL)", "KDV (TL)", "Ödenecek (TL)", "Ödenen (TL)", "Kalan (TL)", "Ödeme Durumu", "Vade", "Not"];
    const rows = data.invoices.map(row => ({
      Tarih: dayText(row.issueDate),
      Saat: row.issueTime,
      "Fatura No": row.displayNo,
      Tür: row.kindLabel,
      Senaryo: row.scenarioLabel,
      Durum: row.statusLabel,
      Cari: row.accountName,
      Profil: row.profileLabel,
      "Para Birimi": row.currency,
      Kur: row.rate,
      "Matrah (TL)": money(row.tryNet),
      "KDV (TL)": money(row.tryVat),
      "Ödenecek (TL)": money(row.tryPayable),
      "Ödenen (TL)": money(row.paid),
      "Kalan (TL)": money(row.open),
      "Ödeme Durumu": row.payStateLabel,
      Vade: dayText(row.dueDate),
      Not: row.note,
    }));
    const lineRows = [];
    for (const row of data.invoices.slice(0, 5000)) {
      for (const line of linesOf(row.id)) lineRows.push({ "Fatura No": row.displayNo, Tarih: dayText(row.issueDate), Cari: row.accountName, Kod: line.code, Kalem: line.name, Miktar: String(line.qty).replace(".", ","), Birim: line.unit, "Birim Fiyat": money(line.unitPrice), "İskonto %": line.discountRate, Matrah: money(line.net), "KDV %": line.vatRate, KDV: money(line.vat), Tevkifat: money(line.withheld), Toplam: money(line.payable) });
    }
    const buffer = buildXlsx([
      { name: "Faturalar", columns, rows },
      { name: "Kalemler", columns: ["Fatura No", "Tarih", "Cari", "Stok Kodu", "Kalem", "Miktar", "Birim", "Birim Fiyat", "İskonto %", "Matrah", "KDV %", "KDV", "Tevkifat", "Toplam"], rows: lineRows },
    ], { now: clock(), title: "Faturalar" });
    audit(user, "invoice.exported", "xlsx", { count: rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "Faturalar.xlsx", inline: false });
  });
  router.get("/api/workspace/invoices/liste.pdf", async ({ req, res, url }) => {
    const user = requireView(req);
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const pdf = tablePdf({
      now: clock(),
      title: "Fatura Listesi",
      subtitle: [query.from || query.to ? `${query.from ? dayText(query.from) : "…"} – ${query.to ? dayText(query.to) : "…"}` : "Tüm tarihler", `${data.invoices.length} belge`].join(" · "),
      headers: ["Tarih", "Fatura No", "Tür", "Cari", "Durum", "Matrah", "KDV", "Ödenecek", "Kalan"],
      types: ["", "", "", "", "", "money", "money", "money", "money"],
      rows: data.invoices.slice(0, 20_000).map(row => [dayText(row.issueDate), row.displayNo, row.kindLabel, row.accountName, row.payStateLabel || row.statusLabel, tl(row.tryNet), tl(row.tryVat), tl(row.tryPayable), tl(row.open)]),
      summary: [["Satış", tl(data.totals.sale)], ["Alış", tl(data.totals.purchase)], ["KDV", tl(data.totals.vat)], ["Açık", tl(data.totals.open)]],
      officeName: store.setting("office.name", "") || "",
      userName: user.display_name || user.username || "",
    });
    sendBuffer(res, pdf, { type: "application/pdf", name: "Fatura Listesi.pdf", inline: url.searchParams.get("download") !== "1" });
  });

  // Tek belge (sabit yollardan sonra: router kayıt sırasıyla eşler).
  // ---------- Gelen e-Faturalar (entegratörün gelen kutusu) ----------
  // Çekilen belgeler einvoice_inbox'a yazılır (ETTN tekil: aynı belge iki kez gelmez), entegratörde "okundu" işaretlenir.
  // "Alış Faturası Olarak Al" belgeden alış faturası TASLAĞI açar: satıcı VKN/TCKN ile cari bulunur ya da vergi
  // bilgileriyle açılır (kişi bir kez girilir), kalemler stok kartına kod ya da adla eşlenir; kullanıcı ödemeyi seçip keser.
  const INBOX_SQL = `SELECT b.id, b.uuid, b.number, b.sender_vkn AS senderVkn, b.sender_name AS senderName, b.issue_date AS issueDate, b.payable, b.currency, b.profile, b.type_code AS typeCode,
      b.status, b.state, b.invoice_id AS invoiceId, b.fetched_at AS fetchedAt, COALESCE(i.number, '') AS invoiceNumber, COALESCE(i.status, '') AS invoiceStatus
    FROM einvoice_inbox b LEFT JOIN invoices i ON i.id = b.invoice_id`;
  const INBOX_STATES = Object.freeze({ new: "Yeni", imported: "Alındı", ignored: "Yok Sayıldı" });
  const inboxShape = row => {
    const accountId = accounts()?.taxIdentity ? accounts().taxIdentity.findByTaxNo(row.senderVkn) : "";
    const twin = accountId && row.number ? store.get("SELECT id, number FROM invoices WHERE account_id = ? AND kind = 'purchase' AND number = ? AND status = 'issued' AND id <> ?", accountId, row.number, row.invoiceId || "") : null;
    return { ...row, stateLabel: INBOX_STATES[row.state] || row.state, accountId, duplicateId: twin?.id || "", duplicateNumber: twin?.number || "" };
  };
  const inboxRow = id => {
    const row = store.get(`${INBOX_SQL} WHERE b.id = ?`, text(id));
    if (!row) throw new HttpError(404, "Gelen belge bulunamadı.", { code: "inbox-not-found" });
    return row;
  };
  const matchItem = line => {
    const code = String(line.code || "").trim();
    const byCode = code ? store.get("SELECT id, name, code FROM stock_items WHERE deleted_at IS NULL AND code <> '' AND code = ? COLLATE NOCASE ORDER BY created_at LIMIT 1", code) : null;
    return byCode || store.get("SELECT id, name, code FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE ORDER BY created_at LIMIT 1", String(line.name || "").trim()) || null;
  };
  function inboxPreview(row, xml) {
    const parsed = readUbl(xml);
    const s = settings();
    const ours = String(s.seller.taxNo || "");
    return {
      parsed,
      addressedToOther: Boolean(ours && parsed.customer.taxNo && parsed.customer.taxNo !== ours),
      lines: parsed.lines.map(line => {
        const item = matchItem(line);
        return { ...line, itemId: item?.id || "", itemName: item?.name || "" };
      }),
    };
  }
  router.get("/api/workspace/invoices/inbox", async ({ req, res, url }) => {
    requireView(req);
    requireEdoc();
    const state = text(url.searchParams.get("state"));
    const rows = store.all(`${INBOX_SQL}${INBOX_STATES[state] ? " WHERE b.state = ?" : ""} ORDER BY b.issue_date DESC, b.fetched_at DESC LIMIT 1000`, ...(INBOX_STATES[state] ? [state] : []));
    const counts = Object.fromEntries(store.all("SELECT state, COUNT(*) AS n FROM einvoice_inbox GROUP BY state").map(item => [item.state, item.n]));
    ok(res, { items: rows.map(inboxShape), counts, states: INBOX_STATES });
  });
  router.post("/api/workspace/invoices/inbox/fetch", async ({ req, res }) => {
    const user = requireManage(req);
    requireEdoc();
    const body = await readJson(req);
    const to = validDate(body.to) ? body.to : today();
    const from = validDate(body.from) ? body.from : isoDay(new Date(Date.parse(`${to}T00:00:00Z`) - 30 * 86_400_000));
    if (from > to) fail400("Başlangıç tarihi bitişten sonra olamaz.", "from");
    const link = integrator();
    const list = await link.inbox({ from, to, limit: 100 });
    let added = 0;
    let known = 0;
    const stamp = now();
    store.tx(() => {
      for (const item of list) {
        if (!item.uuid) continue;
        if (store.get("SELECT 1 FROM einvoice_inbox WHERE uuid = ?", item.uuid)) {
          known += 1;
          continue;
        }
        store.run(
          "INSERT INTO einvoice_inbox (id, uuid, number, sender_vkn, sender_name, issue_date, payable, currency, profile, type_code, status, xml, state, fetched_by, fetched_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)",
          newId("inb"), item.uuid, String(item.number || "").slice(0, 40), String(item.senderVkn || "").slice(0, 11), String(item.senderName || "").slice(0, 200), String(item.issueDate || "").slice(0, 10), roundMoney(item.payable),
          String(item.currency || "TRY").slice(0, 3), String(item.profile || "").slice(0, 40), String(item.typeCode || "").slice(0, 40), String(item.status || "").slice(0, 300), String(item.xml || ""), user.id, stamp, stamp,
        );
        added += 1;
      }
      audit(user, "invoice.inbox.fetched", "inbox", { from, to, received: list.length, added, known });
    });
    // Kaydedilenler entegratörde okundu işaretlenir; işaret konamasa da belge kaybolmaz (bir sonraki çekişte "zaten var").
    let marked = true;
    try {
      await link.markRead(list.map(item => item.uuid).filter(Boolean));
    } catch {
      marked = false;
    }
    publish(user, { kind: "invoices", inbox: true });
    ok(res, { from, to, received: list.length, added, known, marked });
  });
  router.get("/api/workspace/invoices/inbox/:id", async ({ req, res, params }) => {
    requireView(req);
    requireEdoc();
    const row = inboxRow(params.id);
    const xml = store.get("SELECT xml FROM einvoice_inbox WHERE id = ?", row.id).xml;
    let preview = null;
    let readError = "";
    try {
      preview = inboxPreview(row, xml);
    } catch (error) {
      readError = `Belge okunamadı: ${error?.message || error}`;
    }
    ok(res, { ...inboxShape(row), preview, readError });
  });
  router.get("/api/workspace/invoices/inbox/:id/belge.xml", async ({ req, res, params }) => {
    requireView(req);
    requireEdoc();
    const row = inboxRow(params.id);
    const xml = store.get("SELECT xml FROM einvoice_inbox WHERE id = ?", row.id).xml;
    sendBuffer(res, Buffer.from(xml, "utf8"), { type: "application/xml; charset=utf-8", name: `${safeName(row.number || row.uuid)}.xml`, inline: false });
  });
  router.post("/api/workspace/invoices/inbox/:id/import", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const row = inboxRow(params.id);
    if (row.state === "imported" && row.invoiceId) throw new HttpError(409, `Bu belge ${row.invoiceNumber ? `${row.invoiceNumber} numarasıyla ` : ""}zaten alındı.`, { code: "inbox-imported", invoiceId: row.invoiceId });
    const xml = store.get("SELECT xml FROM einvoice_inbox WHERE id = ?", row.id).xml;
    let preview;
    try {
      preview = inboxPreview(row, xml);
    } catch (error) {
      throw new HttpError(422, `Belge okunamadı: ${error?.message || error}`, { code: "inbox-unreadable" });
    }
    const { parsed } = preview;
    if (!classifyTaxId(parsed.supplier.taxNo).ok) throw new HttpError(422, "Belgedeki satıcının VKN/TCKN'si geçersiz; alış faturasını elle girin.", { code: "inbox-supplier" });
    if (!preview.lines.length) throw new HttpError(422, "Belgede kalem yok.", { code: "inbox-empty" });
    const body = await readJson(req);
    let accountId = accounts().taxIdentity.findByTaxNo(parsed.supplier.taxNo);
    const accountCreated = !accountId;
    let draftId = "";
    store.tx(() => {
      if (!accountId) accountId = accounts().taxIdentity.createForParty(user, parsed.supplier, "supplier");
      const goods = preview.lines.some(line => line.itemId);
      const input = {
        kind: "purchase",
        scenario: goods ? "goods_purchase" : "expense_purchase",
        accountId,
        number: parsed.number,
        issueDate: parsed.issueDate,
        issueTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.issueTime) ? parsed.issueTime : "00:00",
        currency: CURRENCIES[parsed.currency] ? parsed.currency : "TRY",
        rate: parsed.rate || 1,
        pricesIncludeVat: false,
        orderNo: parsed.orderNo,
        despatchNo: parsed.despatchNo,
        note: [`e-Fatura ETTN ${parsed.uuid}`, ...parsed.notes].join(" · ").slice(0, 1000),
        lines: preview.lines.map(line => ({ itemId: line.itemId, name: line.name, code: line.code, description: line.description, unit: line.unit, qty: line.qty, unitPrice: line.unitPrice, discountRate: line.discountRate, vatRate: line.vatRate, withholdingCode: line.withholdingCode, exemptionCode: line.exemptionCode, expenseCode: line.itemId ? "" : text(body.expenseCode) || "other" })),
        status: "draft",
      };
      let doc;
      try {
        doc = documentInput(input, { mode: "draft" });
      } catch (error) {
        throw new HttpError(422, `Belge alış faturasına çevrilemedi: ${error?.message || error}`, { code: "inbox-convert", field: error?.extra?.field || "" });
      }
      doc.paymentDraft = { rest: "open" };
      doc.importUuid = parsed.uuid && !store.get("SELECT 1 FROM invoices WHERE ettn = ?", parsed.uuid) ? parsed.uuid : "";
      draftId = writeDraft(user, doc);
      store.run("UPDATE einvoice_inbox SET state = 'imported', invoice_id = ?, updated_at = ? WHERE id = ?", draftId, now(), row.id);
      audit(user, "invoice.inbox.imported", row.id, { uuid: row.uuid, draftId, accountId, accountCreated });
    });
    const draft = detail(draftId, user);
    const difference = roundMoney(draft.payableTotal - (parsed.totals.payable || 0));
    publish(user, { kind: "invoices", inbox: true, invoiceId: draftId });
    ok(res, {
      draft,
      accountCreated,
      unmatched: preview.lines.filter(line => !line.itemId).map(line => line.name),
      difference,
      warning: Math.abs(difference) >= 0.01 ? `Programın hesapladığı toplam (${moneyText(draft.payableTotal, draft.currency)}) belgedekinden (${moneyText(parsed.totals.payable, draft.currency)}) farklı; kalemleri kontrol edip kesin.` : "",
    });
  });
  router.post("/api/workspace/invoices/inbox/:id/state", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const row = inboxRow(params.id);
    const body = await readJson(req);
    const state = text(body.state);
    if (!["new", "ignored"].includes(state)) fail400("Durum Yeni ya da Yok Sayıldı olabilir.", "state");
    if (row.state === "imported") throw new HttpError(409, "Alış faturası olarak alınmış belge yok sayılamaz; önce taslağı silin ya da faturayı iptal edin.", { code: "inbox-imported" });
    store.tx(() => {
      store.run("UPDATE einvoice_inbox SET state = ?, updated_at = ? WHERE id = ?", state, now(), row.id);
      audit(user, "invoice.inbox.state", row.id, { state });
    });
    publish(user, { kind: "invoices", inbox: true });
    ok(res, inboxShape(inboxRow(row.id)));
  });

  router.get("/api/workspace/invoices/:id", async ({ req, res, params, url }) => {
    const user = requireView(req);
    ok(res, detail(params.id, user, { excludeReturnId: text(url.searchParams.get("excludeReturn")).slice(0, 120) }));
  });

  // ---------- Diğer modüller için ----------
  // Kasa (v2.1.0, K5): faturanın peşin tahsilat ve ödemeleri (cari satırı, source = 'invoice') tek kaynaktan (lib/bank/money-lines.mjs,
  // kaynak 4) okunur. İptal edilen faturanınki silinmiştir.
  // Vade takip ve nakit akışı: açık (kısmen ödenmiş dahil) vadeli faturalar. Taksitli olanlar taksit kartından gelir.
  // v2.0.23 (Bulgu 2 D): "Carinin Mevcut Borcu" kartı (ya da stoktan taksitli satışın kartı) açık faturanın borcunu
  // taksitlendirebilir; fatura açığının kartça kapsanan kısmı (kapama, covered) kartın taksitleriyle aynı paradır. Birleşik
  // listeler (yaşlandırma, nakit akış, vade takip, takvim/bildirim) { net: true } ile ister: o kısım faturadan düşülür, kartın
  // taksitleri gösterir. Açık Faturalar raporu ve fatura kartı faturanın kendi açığını gösterir (net istemez).
  // returns (v2.1.0, K1): Açık Faturalar raporu mahsup edilmemiş iade belgelerini de gösterir (iade belgesinin açığı; satıştan iade
  // müşterinin alacağı → borç tarafı, alıştan iade tedarikçinin borcu → alacak tarafı). Birleşik listeler (yaşlandırma, nakit akış, vade
  // takip, takvim/bildirim, ANLIK DURUM) iade belgesi istemez: orada iade alacağı carinin avansı gibidir (bakiye zaten net).
  const RETURN_SIDE = { sale_return: "purchase", purchase_return: "sale" };
  function openItems(day = today(), { net = false, returns = false } = {}) {
    const rows = store.all(`${INVOICE_SQL} WHERE i.status = 'issued' AND i.kind IN ('sale', 'smm', 'purchase'${returns ? ", 'sale_return', 'purchase_return'" : ""}) AND i.plan_id = ''`);
    const states = paymentStates(rows);
    return rows
      .map(row => ({ row, state: states.get(row.id) }))
      .map(({ row, state }) => ({ row, state, open: state ? roundMoney(state.open - (net ? state.covered || 0 : 0)) : 0 }))
      .filter(({ state, open }) => state && open > 0.005)
      .map(({ row, state, open }) => ({ id: row.id, number: row.number, kind: row.kind, side: RETURN_SIDE[row.kind] || INVOICE_KINDS[row.kind].side, ...(RETURN_SIDE[row.kind] ? { isReturn: true } : {}), accountId: row.accountId, accountName: parseJson(row.partyJson, {}).name || row.accountName, phone: row.accountPhone, dueDate: row.dueDate || row.issueDate, issueDate: row.issueDate, payable: row.tryPayable, open, ...(net && state.covered > 0.005 ? { coveredByPlan: state.covered } : {}), state: state.state, days: Math.round((Date.parse(`${row.dueDate || row.issueDate}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000) }));
  }
  // Tahsilat takvimi ve sağ alt bildirimler: vadesi geçen, bugün ve 7 gün içinde vadesi gelen açık faturalar.
  function dueItems(day = today()) {
    return openItems(day, { net: true })
      .filter(item => item.days <= 7)
      .map(item => ({
        id: `invoice|${item.id}`,
        source: "invoice",
        invoiceId: item.id,
        direction: item.side === "sale" ? "in" : "out",
        person: item.accountName,
        caseNo: "",
        caseKey: "",
        tab: "",
        label: `${item.side === "sale" ? "Tahsil Edilecek" : "Ödenecek"} Fatura ${item.number}`,
        kind: "date",
        dueDate: item.dueDate,
        dueText: dayText(item.dueDate),
        amount: item.open,
        partial: item.open < item.payable - 0.005,
        days: item.days,
        state: item.days === 0 ? "today" : item.days < 0 ? "overdue" : "upcoming",
      }));
  }
  const fingerprint = () => {
    const row = store.get("SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') AS f FROM invoices");
    // Kapama (ödenen/kalan) cari hareketlerine de bağlıdır: tahsilat girilince açık fatura kapanır.
    const entries = store.get("SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS f FROM account_entries");
    return `${row.f}|${entries.f}`;
  };
  const countForAccount = accountId => store.get("SELECT COUNT(*) AS n FROM invoices WHERE account_id = ? AND status <> 'cancelled'", accountId).n;
  // Taksit kartı tahsilatı değişince (plans.mjs) faturanın kendi kartı faturanın açığına eşitlenir; aynı işlemin içinde.
  const syncOwnCard = (user, invoiceId) => {
    const row = store.get("SELECT id, plan_id AS planId, payment_json AS paymentJson, status FROM invoices WHERE id = ?", invoiceId);
    if (row?.status === "issued" && row.planId) ownCard(user, row, { plans: new Set() }, "Taksit tahsilatı değişti");
  };
  /**
   * Banka → Masraf, KDV'li (faturalı) kip (v2.1.0 Aşama 4; banka planı §3.7 #13, K2): Hizmet ve Gider Alışı faturası (tek kalem, masraf türünün
   * adıyla; hesap 770 Banka Masrafları ya da 653 Komisyon) + bu banka hesabından peşin havale ödemesi. Çağıran Banka servisidir ve kendi
   * bank.post işleminin İÇİNDEN çağırır (fatura, cari, ödeme satırı ve masraf başlığı tek işlem). Tutarlar faturanın kendi hesabından gelir
   * (KDV dahilde ödenecek = girilen tutar). Dönüş: { id, number, netMinor, vatMinor, payableMinor, paymentEventId }.
   */
  function issueBankFee(user, { partyId, number, date, name, expenseCode, vatRate, unitPrice, pricesIncludeVat, bankAccountId, note = "" }) {
    const doc = documentInput({ kind: "purchase", scenario: "expense_purchase", accountId: partyId, number, issueDate: date, pricesIncludeVat, discountRate: 0, stoppageRate: 0, note, lines: [{ name, qty: 1, unitPrice, vatRate, expenseCode }] }, { mode: "issue" });
    const payable = c2(doc.money.payable);
    const payment = { cash: [{ amount: payable, method: "bank", bankAccountId }], cheques: [], endorse: [], paid: payable, rest: 0, mode: "none", installments: null, dueDate: doc.date };
    const written = writeIssued(user, doc, payment, {});
    const paymentRow = store.get("SELECT event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out' AND method = 'bank' LIMIT 1", written.id);
    return { id: written.id, number: written.number, netMinor: Math.round(Number(doc.money.net) || 0), vatMinor: Math.round(Number(doc.money.vat) || 0), payableMinor: Math.round(Number(doc.money.payable) || 0), paymentEventId: paymentRow?.eventId || "" };
  }
  /**
   * GG2 (Banka → Ters Kaydet, kilitli dönemdeki KDV'li masraf): asıl faturanın bütün kalemleri için bugün (date) tarihli Alıştan İade faturası +
   * bu banka hesabına iade tahsilatı (havale, fin_ref). Kapanmış dönem değişmez (yaygın uygulama: kilitli dönemdeki faturanın düzeltmesi açık
   * dönemde iade faturasıyla). Banka servisi kendi bank.post işleminin İÇİNDEN çağırır. Dönüş: { id, number, payableMinor, paymentEventId }.
   */
  function issueBankFeeReturn(user, { invoiceId, date, bankAccountId, note = "" }) {
    const original = invoiceRow(invoiceId);
    const lines = linesOf(original.id).map(line => ({ originLineId: line.id, qty: line.qty }));
    const doc = documentInput({ kind: "purchase_return", originalId: original.id, issueDate: date, note, lines }, { mode: "issue", fromBank: true });
    const payable = c2(doc.money.payable);
    const payment = { cash: [{ amount: payable, method: "bank", bankAccountId }], cheques: [], endorse: [], paid: payable, rest: 0, mode: "none", installments: null, dueDate: doc.date };
    const written = writeIssued(user, doc, payment, {});
    const paymentRow = store.get("SELECT event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in' AND method = 'bank' LIMIT 1", written.id);
    return { id: written.id, number: written.number, payableMinor: Math.round(Number(doc.money.payable) || 0), paymentEventId: paymentRow?.eventId || "" };
  }
  /**
   * POS komisyon faturası taslağı (2.2.0, plan §4.3/3): sağlayıcı carisine "Hizmet ve Gider Alışı", tek kalem "POS ve Ödeme Kuruluşu Komisyonları"
   * (653), KDV %20 DAHİL, tutar = ayın bağlanmamış kesintileri − komisyon iadeleri. Kullanıcı gelen e-faturayla karşılaştırıp kaydeder. Dönüş: kimlik.
   */
  function createCommissionDraft(user, { partyId, date, amountMinor, note = "" }) {
    const doc = documentInput({ kind: "purchase", scenario: "expense_purchase", accountId: partyId, issueDate: date, pricesIncludeVat: true, discountRate: 0, stoppageRate: 0, note, lines: [{ name: "POS ve Ödeme Kuruluşu Komisyonları", qty: 1, unitPrice: amountMinor / 100, vatRate: 20, expenseCode: "commission" }] }, { mode: "draft" });
    doc.paymentDraft = {};
    return writeDraft(user, doc);
  }
  return { openItems, dueItems, fingerprint, countForAccount, list, listQuery, detail, settings, paymentStates, lastPrices, returnable, cancel, deleteInvoice, restoreDeleted, syncOwnCard, repairOwnCards, issueBankFee, issueBankFeeReturn, createCommissionDraft };
}
