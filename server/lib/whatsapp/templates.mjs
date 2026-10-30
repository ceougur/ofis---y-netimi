// WhatsApp bilgilendirme şablonları — 2.4.8 W5 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2.4, §6 W5; ürün kararları §1).
//
// Program bu şirketin WhatsApp Business hesabında (WABA) YALNIZ iki bilgilendirme (UTILITY) şablonunu kendisi açar ve izler:
//   destekofis_ekstre            BELGE başlıklı (ekstre PDF'i), alt satırda KVKK cümlesi
//   destekofis_odeme_hatirlatma  yalnız gövde
// Kampanya, serbest metin, şablona ek cümle, pazarlama şablonu YOK (kullanıcı kararı 30.10.2026). Metinler sabittir; değişirse YENİ ad gerekir
// (Meta: onaylı şablonun kategorisi düzenlenemez; silinen onaylı şablonun adı 30 gün kullanılamaz — plan §2.4).
//
// Denetim (Şablonları Denetle ve Oluştur; bağlantı kaydedilip sınanınca da kendiliğinden): Meta'dan şablon listesi okunur, olmayan şablon açılır,
// durum (PENDING / APPROVED / REJECTED / PAUSED / DISABLED), kategori, kalite ve ret nedeni ekrana yazılır. Meta UTILITY şablonu MARKETING'e
// alırsa (09.04.2025'ten beri kendiliğinden — template-categorization) ekranda açık uyarı çıkar; `templateUsable` bu şablonu kullanılamaz sayar
// (gönderim çekirdeği W2 bu işlevle karar verir).
//
// Sonuç şirketin settings satırında ("whatsapp.templates"; Şirket Verisini Sıfırla'da korunur — app.mjs KEEP_SETTINGS "whatsapp"). Belirteç bu
// modülde yalnız istek anında açılır (meta-graph.mjs); kayda, işlem geçmişine ve ekrana girmez.
import { HttpError } from "../http.mjs";
import { tablePdf } from "../report-pdf.mjs";
import { META_D0, META_D0_W5, MetaGraphError, PROGRAM_TEMPLATE_CATEGORY, createMetaTemplates } from "./meta-graph.mjs";

export const TEMPLATES_KEY = "whatsapp.templates";
// Ekstre şablonunun alt satırı (plan §1; Meta alt satır sınırı 60 karakter — templates/components "Footer").
export const KVKK_FOOTER = "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.";
export const SAMPLE_PDF_NAME = "Ornek-Cari-Ekstre.pdf";

const freeze = value => {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};

// Şablon tanımları (plan §6 W5'teki metinler AYNEN; ekstre gövdesi plan §7a madde 23 / K3: "Dönem sonu bakiyesi" — geçmiş dönemde "Güncel bakiye" yanlış
// etiketti — ve gövde değişkenle bitmez, Meta 2388299; dil tr, kategori UTILITY). example: Meta'nın değişkenli gövde için istediği örnek değerler.
export const TEMPLATE_DEFS = freeze([
  {
    kind: "statement",
    name: "destekofis_ekstre",
    label: "Ekstre",
    language: META_D0_W5.language,
    category: PROGRAM_TEMPLATE_CATEGORY,
    header: "DOCUMENT",
    body: "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Dönem sonu bakiyesi: {{4}}. İyi günler dileriz.",
    example: ["Ahmet Yılmaz", "Örnek Ticaret Ltd. Şti.", "01.10.2026 – 31.10.2026", "1.250,00 TL (borç)"],
    footer: KVKK_FOOTER,
  },
  {
    kind: "reminder",
    name: "destekofis_odeme_hatirlatma",
    label: "Ödeme Hatırlatma",
    language: META_D0_W5.language,
    category: PROGRAM_TEMPLATE_CATEGORY,
    header: "",
    body: "Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız.",
    example: ["Ahmet Yılmaz", "Örnek Ticaret Ltd. Şti.", "15.11.2026", "2.500,00 TL", "7.500,00 TL (borç)"],
    footer: "",
  },
]);

/** Meta'ya giden şablon açma isteğinin içeriği (templates/components: HEADER DOCUMENT + header_handle, BODY + body_text örneği, FOOTER). */
export function templateComponents(def, headerHandle = "") {
  const components = [];
  if (def.header === "DOCUMENT") components.push({ type: "HEADER", format: "DOCUMENT", example: { header_handle: [headerHandle] } });
  components.push({ type: "BODY", text: def.body, example: { body_text: [[...def.example]] } });
  if (def.footer) components.push({ type: "FOOTER", text: def.footer });
  return components;
}

// Örnek ekstre PDF'i (belge başlıklı şablonun örneği; Meta incelemesinde görülür). Gerçek veri DEĞİL; tarih sabit, çıktı her seferinde aynı.
export function samplePdf() {
  return tablePdf({
    title: "Cari Hesap Ekstresi",
    subtitle: "Örnek Belge · 01.10.2026 – 31.10.2026 · Ahmet Yılmaz",
    headers: ["Tarih", "Açıklama", "Borç", "Alacak", "Bakiye"],
    types: ["", "", "money", "money", "money"],
    rows: [
      ["01.10.2026", "Devir", "", "", "1.000,00 TL"],
      ["08.10.2026", "Satış Faturası", "750,00 TL", "", "1.750,00 TL"],
      ["20.10.2026", "Tahsilat", "", "500,00 TL", "1.250,00 TL"],
    ],
    footer: ["", "TOPLAM", "750,00 TL", "500,00 TL", "1.250,00 TL"],
    officeName: "Örnek Ticaret Ltd. Şti.",
    brand: "",
    now: new Date("2026-10-31T09:00:00Z"),
  });
}

const STATUS_LABELS = Object.freeze({
  APPROVED: "Onaylandı",
  PENDING: "Onay Bekliyor",
  IN_APPEAL: "İtiraz İnceleniyor",
  REJECTED: "Reddedildi",
  PAUSED: "Duraklatıldı",
  DISABLED: "Kapatıldı",
  PENDING_DELETION: "Silinmeyi Bekliyor",
  DELETED: "Silindi",
  ARCHIVED: "Arşivlendi",
  LIMIT_EXCEEDED: "Sınır Aşıldı",
});
const CATEGORY_LABELS = Object.freeze({ UTILITY: "Bilgilendirme (Utility)", MARKETING: "Pazarlama (Marketing)", AUTHENTICATION: "Kimlik Doğrulama (Authentication)" });
const QUALITY_LABELS = Object.freeze({ GREEN: "Yüksek", YELLOW: "Orta", RED: "Düşük", UNKNOWN: "Henüz Belirlenmedi" });
const upper = value => String(value || "").trim().toUpperCase();
const textOf = value => String(value ?? "").replace(/\r\n?/g, "\n").trim();

// Meta'daki şablonun içeriği programın tanımıyla aynı mı (müşteri WhatsApp Yöneticisi'nde değiştirdiyse). components gelmediyse bilinmez (null).
function contentMatches(def, found) {
  if (!Array.isArray(found?.components)) return null;
  const part = type => found.components.find(item => upper(item?.type) === type);
  const header = part("HEADER");
  const body = part("BODY");
  const footer = part("FOOTER");
  if (def.header ? upper(header?.format) !== def.header : Boolean(header)) return false;
  if (textOf(body?.text) !== def.body) return false;
  return def.footer ? textOf(footer?.text) === def.footer : !footer;
}

/** Şablonla gönderim yapılabilir mi: yalnız APPROVED + UTILITY (ve içerik değiştirilmemiş). W2 gönderim çekirdeği bu işlevi kullanır. */
export function templateUsable(item) {
  return Boolean(item && item.exists && item.status === "APPROVED" && item.category === PROGRAM_TEMPLATE_CATEGORY && item.contentMatches !== false);
}

// Meta'daki kayıt → ekrandaki satır (durum adı, kategori adı, uyarı). Uyarılar cümle düzeninde.
export function describeTemplate(def, found) {
  const base = { kind: def.kind, name: def.name, label: def.label, language: def.language };
  if (!found) return { ...base, exists: false, status: "", statusLabel: "Henüz Açılmadı", category: "", categoryLabel: "", quality: "", qualityLabel: "", rejectedReason: "", contentMatches: null, usable: false, tone: "off", warnings: [] };
  const status = upper(found.status);
  const category = upper(found.category);
  const quality = upper(found.quality_score?.score ?? found.quality_score);
  const reason = upper(found.rejected_reason);
  const matches = contentMatches(def, found);
  const warnings = [];
  if (category === "MARKETING") {
    warnings.push(
      "Meta bu şablonu Pazarlama (Marketing) sınıfına aldı; program bu şablonla gönderim YAPMAZ (yalnız bilgilendirme iletisi gönderilir, pazarlama iletisi yaklaşık 12 kat pahalıdır). WhatsApp Yöneticisi → İleti Şablonları'ndan yeniden inceleme isteyin (kategori değişikliğinden sonra 60 gün içinde).",
    );
  } else if (category && category !== PROGRAM_TEMPLATE_CATEGORY) warnings.push(`Şablonun sınıfı bilgilendirme (Utility) değil (${CATEGORY_LABELS[category] || category}); program bu şablonla gönderim yapmaz.`);
  if (status === "REJECTED") {
    const why = Object.hasOwn(META_D0_W5.rejectedReasons, reason) ? META_D0_W5.rejectedReasons[reason] : reason.toLowerCase();
    warnings.push(`Meta şablonu reddetti${why ? ` (${why})` : ""}. Program bu şablonla gönderim yapmaz; WhatsApp Yöneticisi'nden nedeni görüp yeniden inceleme isteyebilir ya da DestekOfis desteğine başvurabilirsiniz.`);
  } else if (status === "PAUSED") warnings.push("Meta şablonu düşük kalite nedeniyle duraklattı; duraklama bitene kadar bu şablonla gönderim yapılmaz.");
  else if (status === "DISABLED") warnings.push("Meta şablonu kalıcı olarak kapattı; bu şablonla bir daha gönderim yapılamaz. DestekOfis desteğine başvurun.");
  else if (status === "PENDING" || status === "IN_APPEAL") warnings.push("Meta incelemesi sürüyor; onaylanınca bu şablonla gönderim yapılabilir. Durumu yeniden görmek için Şablonları Denetle ve Oluştur'a basın.");
  else if (status && status !== "APPROVED") warnings.push("Şablon onaylı değil; bu şablonla gönderim yapılmaz.");
  if (quality === "RED") warnings.push("Şablonun kalitesi düşük (alıcılar engelliyor ya da şikâyet ediyor olabilir); Meta şablonu yakında duraklatabilir. Yalnız iş ilişkiniz olan carilere gönderin.");
  if (matches === false) warnings.push("Şablonun içeriği WhatsApp Yöneticisi'nde değiştirilmiş görünüyor; program bu şablonla gönderim yapmaz. DestekOfis desteğine başvurun.");
  const item = {
    ...base,
    exists: true,
    id: String(found.id || ""),
    status,
    statusLabel: STATUS_LABELS[status] || status || "Bilinmiyor",
    category,
    categoryLabel: CATEGORY_LABELS[category] || category,
    quality,
    qualityLabel: QUALITY_LABELS[quality] || quality,
    rejectedReason: reason,
    contentMatches: matches,
    warnings,
  };
  item.usable = templateUsable(item);
  item.tone = item.usable ? (quality === "RED" ? "warn" : "ok") : status === "PENDING" || status === "IN_APPEAL" ? "warn" : "error";
  return item;
}

const findExact = (items, def) => (Array.isArray(items) ? items.find(item => item?.name === def.name && String(item.language || "") === def.language) : null) || null;

const NOT_APPROVED = Object.freeze({
  PENDING: name => `Şablon (${name}) Meta onayını bekliyor; onaylanınca gönderim başlatılabilir.`,
  IN_APPEAL: name => `Şablon (${name}) için Meta itirazı inceliyor; onaylanınca gönderim başlatılabilir.`,
  REJECTED: name => `Şablon (${name}) Meta tarafından reddedildi.`,
  PAUSED: name => `Şablon (${name}) düşük kalite nedeniyle Meta tarafından duraklatıldı.`,
  DISABLED: name => `Şablon (${name}) Meta tarafından kalıcı olarak kapatıldı; yeni şablon gerekir.`,
});
/**
 * T2-7 (bağımsız gözden geçirme r6): GÖNDERİM KARARI — gönderim çekirdeği (lib/whatsapp/queue.mjs: toplu iş başlarken, önizlemede ve R2 yeniden okumasında) ve
 * ekrandaki "Gönderime Hazır" (describeTemplate → templateUsable) AYNI kuralla karar verir; kural yalnız burada. items: Meta'nın şablon listesi (ayrıntılı
 * alanlar, components dahil — META_D0_W5.detailFields), name: programın şablon adı. Dönüş { ok, code, reason, template }.
 * Plan §1 "yalnız 2 sabit bilgilendirme şablonu; kampanya / serbest metin yok" sunucuda zorlanır: içeriği programın sabit metninden farklı şablonla gönderilmez
 * ("template-content"). İçerik okunamadıysa (Meta components vermedi — D0-W5-5 temel alanlara düşüş) ekranla aynı kural: içerik bilinmez, engellenmez.
 */
export function sendingVerdict(items, name) {
  const def = TEMPLATE_DEFS.find(item => item.name === name);
  const found = def ? findExact(items, def) : null;
  if (!found) return { ok: false, code: "template-missing", reason: `Şablon (${name}) bu WhatsApp Business hesabında yok; şablonlar bağlantıdan sonra program tarafından açılır.` };
  const item = describeTemplate(def, found);
  const template = { name, language: String(found.language || ""), status: item.status, category: item.category };
  if (item.status !== "APPROVED") {
    const reason = NOT_APPROVED[item.status]?.(name) || `Şablon (${name}) onaylı değil (Meta durumu: ${item.status || "bilinmiyor"}).`;
    return { ok: false, code: `template-${(item.status || "unknown").toLowerCase().replace(/_/g, "-")}`, reason, template };
  }
  // Plan §2.4 KATEGORİ RİSKİ + §7a 27: yalnız UTILITY + APPROVED ile gönderilir; pazarlamaya alınmış şablonla gönderim başlamaz / süren iş durur.
  if (item.category === "MARKETING") return { ok: false, code: "template-marketing", reason: "Şablon Pazarlama'ya Alındı: Meta şablonu pazarlama kategorisine aldı; WhatsApp Yöneticisi'nden yeniden inceleme isteyin. Bu şablonla gönderim yapılmaz.", template };
  if (item.category !== PROGRAM_TEMPLATE_CATEGORY) return { ok: false, code: "template-category", reason: `Şablonun Meta kategorisi bilgilendirme (Utility) değil (${item.category || "bilinmiyor"}); gönderim yapılmaz.`, template };
  if (item.contentMatches === false) {
    return { ok: false, code: "template-content", reason: `Şablonun (${name}) içeriği WhatsApp Yöneticisi'nde değiştirilmiş görünüyor; program yalnız kendi sabit bilgilendirme metniyle gönderir, bu şablonla gönderim yapılmaz. DestekOfis desteğine başvurun.`, template };
  }
  if (!item.usable) return { ok: false, code: "template-unusable", reason: `Şablon (${name}) gönderime hazır değil.`, template };
  return { ok: true, template };
}
const parse = value => {
  try {
    const parsed = JSON.parse(value || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};
const fail = (status, message, code, extra = {}) => {
  throw new HttpError(status, message, { code, ...extra });
};

/**
 * createWhatsappTemplates({ store, config, audit, connection, now }) — bu şirketin şablonları.
 * connection: lib/whatsapp/connection.mjs nesnesi (read() ve metaOptions(); bağlantı kaydına yazılmaz).
 */
export function createWhatsappTemplates({ store, config = {}, audit = () => {}, connection, now = () => new Date(), ttlHours = () => META_D0.defaultTtlHours }) {
  const iso = () => now().toISOString();
  let busy = false;
  // T2-5 (S2 A): şablona yazılan teslim süresi = gönderim ayarındaki teslim süresi (saat; varsayılan 72). D0-W5-8.
  const ttlHoursNow = () => {
    const value = Number(ttlHours?.());
    return Number.isInteger(value) && value >= 1 && value <= 720 ? value : META_D0.defaultTtlHours;
  };
  const TTL_RETRY_MS = 24 * 3_600_000; // Meta: onaylı şablon 24 saatte bir düzenlenir

  // Meta istemcisi: denetimler ve belirtecin açılması bağlantı modülünde (connection.metaOptions); belirteç yalnız istek anında açılır.
  const apiFor = record => createMetaTemplates(connection.metaOptions(record));
  const metaFailure = error => new HttpError(error.reason === "meta" ? 502 : error.kind === "request" ? 409 : 502, error.message, { code: error.reason === "meta" ? "whatsapp-meta" : error.kind === "request" ? "whatsapp-template" : "whatsapp-meta-unreachable", meta: error.toJSON() });

  function stored() {
    const raw = parse(store.setting(TEMPLATES_KEY, ""));
    return raw && raw.v === 1 ? raw : null;
  }

  // Ekran görünümü (Meta'ya istek YOK). Kayıt başka hesaba (WABA) aitse bayattır: satırlar "Denetlenmedi".
  function view() {
    const record = connection.read();
    const last = stored();
    const fresh = Boolean(record && last && last.wabaId === record.wabaId);
    const items = TEMPLATE_DEFS.map(def => {
      const saved = fresh ? (last.items || []).find(item => item?.name === def.name) : null;
      if (!saved) return { ...describeTemplate(def, null), statusLabel: "Denetlenmedi", checked: false };
      const item = describeTemplate(def, saved.meta || null);
      // T2-5: Meta teslim süresini kabul etmediyse (D0-W5-8) uyarı; gönderimi engellemez.
      const ttl = item.id ? last.ttl?.[item.id] : null;
      if (ttl?.rejected) item.warnings.push(`Meta bu şablonun teslim süresini (${Math.round(ttl.seconds / 3600)} saat) kabul etmedi; Meta'nın varsayılanı (30 gün) geçerli. DestekOfis desteğine başvurun.`);
      return item;
    });
    return {
      configured: Boolean(record),
      graphAvailable: Boolean(config.whatsappGraphUrl),
      hasAppId: Boolean(record?.appId),
      checkedAt: fresh ? last.at : null,
      checkedByName: fresh ? last.byName || "" : "",
      complete: fresh ? last.complete !== false : true,
      lastError: fresh && last.error ? last.error : null,
      actions: fresh ? last.actions || [] : [],
      items,
      usable: Object.fromEntries(items.map(item => [item.kind, item.usable])),
      definitions: TEMPLATE_DEFS.map(def => ({ kind: def.kind, name: def.name, label: def.label, language: def.language, category: def.category, header: def.header, body: def.body, footer: def.footer })),
    };
  }

  // Meta'daki kaydın yalnız gereken alanları saklanır (components dahil; belirteç yok).
  const keep = found =>
    found
      ? {
          id: String(found.id || ""),
          name: String(found.name || ""),
          language: String(found.language || ""),
          status: String(found.status || ""),
          category: String(found.category || ""),
          ...(found.quality_score !== undefined ? { quality_score: found.quality_score } : {}),
          ...(found.rejected_reason !== undefined ? { rejected_reason: String(found.rejected_reason || "") } : {}),
          ...(Array.isArray(found.components) ? { components: found.components } : {}),
        }
      : null;

  // ---------- Şablonları Denetle ve Oluştur ----------
  // 1) liste → 2) olmayan şablon açılır (ekstre: önce örnek PDF Resumable Upload ile; App ID yoksa açılmaz, nedeni yazılır) → 3) açıldıysa liste
  // yeniden okunur. Bir şablonun açılamaması öbürünü durdurmaz; belirteç / yetki / hesap hatası ikisini de durdurur.
  async function ensure(user) {
    const record = connection.read();
    if (!record) fail(409, "WhatsApp Business API bağlantısı yok; önce Elle Bağla ile bilgileri girin.", "whatsapp-not-configured");
    const api = apiFor(record);
    if (busy) fail(409, "Şablon denetimi sürüyor; sonucunu bekleyin.", "whatsapp-templates-busy");
    busy = true;
    try {
      // T2-5: şablonlara uygulanan teslim süresinin kaydı (şablon kimliği → { seconds, at, ok, rejected }); Meta listesi bu alanı vermez (D0-W5-8).
      const previousTtl = stored()?.wabaId === record.wabaId ? stored().ttl || {} : {};
      const ttl = { ...previousTtl };
      const ttlSeconds = ttlHoursNow() * 3600;
      let listing;
      try {
        listing = await api.details(record.wabaId);
      } catch (error) {
        if (!(error instanceof MetaGraphError)) throw error;
        save(record, user, { items: stored()?.wabaId === record.wabaId ? stored().items : [], actions: [], complete: false, error: { at: iso(), message: error.message, meta: error.toJSON() }, ttl: previousTtl });
        audit(user, "whatsapp.templates.checked", "whatsapp", { ok: false, code: error.code, reason: error.reason });
        throw metaFailure(error);
      }
      const actions = [];
      const created = new Map();
      let stop = false;
      for (const def of TEMPLATE_DEFS) {
        if (stop || findExact(listing.items, def)) continue;
        if (def.header === "DOCUMENT" && !record.appId) {
          // Neden bağlantı yoluna göre: Elle Bağla'da kullanıcı App ID'yi girer; WhatsApp'ı Bağla'da App ID kapıcıdan gelir (ekranda "Bilgileri Değiştir" yok).
          const fix = record.mode === "embedded" ? "WhatsApp'ı Bağla bu kimliği vermedi; WhatsApp'ı Yeniden Bağla ile yeniden bağlayın, sorun sürerse DestekOfis destekle görüşün." : "Bilgileri Değiştir ile Meta uygulama panelindeki App ID'yi girin, sonra Şablonları Denetle ve Oluştur'a basın.";
          actions.push({ name: def.name, label: def.label, ok: false, code: "app-id", message: `${def.label} şablonunun örnek PDF'i Meta'ya yüklenirken Uygulama Kimliği (App ID) gerekir; ${fix}` });
          continue;
        }
        try {
          const handle = def.header === "DOCUMENT" ? await api.resumableUpload(record.appId, { fileName: SAMPLE_PDF_NAME, fileType: "application/pdf", bytes: samplePdf() }) : "";
          const spec = { name: def.name, language: def.language, category: def.category, components: templateComponents(def, handle) };
          // T2-5 (S2 A): teslim süresi şablonla birlikte. Meta alanı / değeri reddederse (100; 2388024 "zaten var" değil) BİR KEZ TTL'siz açılır (D0-W5-8).
          let made;
          let ttlRejected = null;
          try {
            made = await api.createTemplate(record.wabaId, { ...spec, ttlSeconds });
          } catch (error) {
            if (!(error instanceof MetaGraphError) || error.code !== 100 || error.subcode === 2388024) throw error;
            ttlRejected = error;
            made = await api.createTemplate(record.wabaId, spec);
          }
          if (made.id) ttl[made.id] = { seconds: ttlSeconds, at: iso(), ok: !ttlRejected, ...(ttlRejected ? { rejected: true } : {}) };
          created.set(def.name, { id: made.id, name: def.name, language: def.language, status: made.status || "PENDING", category: made.category || def.category, components: templateComponents(def, handle) });
          actions.push({ name: def.name, label: def.label, ok: true, created: true, message: `${def.label} şablonu Meta'ya gönderildi; Meta onayı bekleniyor.${ttlRejected ? ` Meta teslim süresini (${ttlSeconds / 3600} saat) kabul etmedi; Meta'nın varsayılanı (30 gün) geçerli.` : ""}` });
        } catch (error) {
          if (!(error instanceof MetaGraphError)) throw error;
          if (error.code === 100 && error.subcode === 2388024) {
            // Aynı ad + dil Meta'da var ama listede görülmedi (liste eksik ya da sayfalı): açılmış sayılır, liste yeniden okunur.
            actions.push({ name: def.name, label: def.label, ok: true, created: false, message: `${def.label} şablonu Meta'da zaten var.` });
            continue;
          }
          actions.push({ name: def.name, label: def.label, ok: false, code: error.code ?? error.reason, message: error.message });
          if (["token", "permission", "account", "config"].includes(error.kind)) stop = true;
        }
      }
      if (actions.some(action => action.ok)) {
        try {
          listing = await api.details(record.wabaId);
        } catch (error) {
          if (!(error instanceof MetaGraphError)) throw error;
          // Açma başarılı, yeniden okuma düştü: açma yanıtıyla gösterilir; sonraki denetim düzeltir.
        }
      }
      // T2-5: zaten açık şablonun teslim süresi programın ayarından farklıysa (kayıtta yok / ayar değişti) Meta'da güncellenir — yalnız TTL alanı; Meta'nın
      // düzenlemeye izin verdiği durumlarda; düşerse 24 saat beklenir (onaylı şablon 24 saatte bir düzenlenir); Meta değeri reddettiyse aynı değer yinelenmez.
      if (!stop) {
        for (const def of TEMPLATE_DEFS) {
          const found = findExact(listing.items, def);
          const id = String(found?.id || "");
          if (!id || created.has(def.name) || !META_D0_W5.ttlEditable.includes(upper(found.status))) continue;
          const last = ttl[id];
          const lastAt = Date.parse(last?.at || "");
          if (last && last.seconds === ttlSeconds && (last.ok || last.rejected || (Number.isFinite(lastAt) && now().getTime() - lastAt < TTL_RETRY_MS))) continue;
          try {
            await api.editTemplateTtl(id, ttlSeconds);
            ttl[id] = { seconds: ttlSeconds, at: iso(), ok: true };
            actions.push({ name: def.name, label: def.label, ok: true, ttl: true, message: `${def.label} şablonunun teslim süresi Meta'da ${ttlSeconds / 3600} saat olarak ayarlandı.` });
          } catch (error) {
            if (!(error instanceof MetaGraphError)) throw error;
            ttl[id] = { seconds: ttlSeconds, at: iso(), ok: false, ...(error.code === 100 ? { rejected: true } : {}) };
            actions.push({ name: def.name, label: def.label, ok: false, ttl: true, code: error.code ?? error.reason, message: `${def.label} şablonunun teslim süresi Meta'da ayarlanamadı: ${error.message}` });
          }
        }
      }
      const items = TEMPLATE_DEFS.map(def => ({ name: def.name, meta: keep(findExact(listing.items, def) || created.get(def.name) || null) }));
      save(record, user, { items, actions, complete: listing.complete !== false, error: null, ttl });
      audit(user, "whatsapp.templates.checked", "whatsapp", {
        ok: true,
        created: actions.filter(action => action.created).map(action => action.name),
        failed: actions.filter(action => !action.ok).map(action => `${action.name}:${action.code}`),
        statuses: Object.fromEntries(items.map(item => [item.name, item.meta ? `${upper(item.meta.status)}/${upper(item.meta.category)}` : "yok"])),
      });
      return view();
    } finally {
      busy = false;
    }
  }

  function save(record, user, { items, actions, complete, error, ttl = {} }) {
    store.setSetting(TEMPLATES_KEY, JSON.stringify({ v: 1, at: iso(), wabaId: record.wabaId, phoneNumberId: record.phoneNumberId, by: user?.id || "", byName: user?.display_name || user?.name || "", items, actions, complete, error, ttl }), user?.id || null);
  }

  return { view, ensure };
}
