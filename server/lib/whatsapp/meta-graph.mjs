// Meta WhatsApp Cloud API (Graph) istemcisi — 2.4.8 W1 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2, §4, §6 W1).
//
// Programın Meta'ya giden BÜTÜN istekleri bu modülden geçer: tek sürüm sabiti, tek temel adres (config.whatsappGraphUrl; üretimde
// graph.facebook.com, testlerde yalnız yerel sahte sunucu — ders 30 düzeni, config.mjs), tek hata sınıfı. Erişim belirteci (System User
// belirteci; Yol 2'de Business Integration belirteci) modüle AÇIK verilmez: çağıran `openToken` verir, belirteç yalnız isteğin hemen
// önünde açılır, Authorization başlığına girer ve başka hiçbir yere (hata iletisi, günlük, dönüş değeri) çıkmaz — Meta'nın hata metni
// belirteci içerse bile silinir (redact).
//
// Ağ: config.fetchImpl (vekil sunucu ayarı; lib/net-proxy.mjs), TLS kapatılmaz, yönlendirme izlenmez (redirect: "manual" — belirteçli istek
// başka adrese taşınmaz), 15 sn zaman aşımı.

// Graph API sürümü (plan §2.1: belgelerdeki güncel sürüm). Sürümlerin kaldırılma takvimi D0'da okunur; değişirse yalnız bu satır değişir.
export const GRAPH_VERSION = "v26.0";
export const DEFAULT_GRAPH_URL = "https://graph.facebook.com";
export const TIMEOUT_MS = 15_000;
// Meta yanıtı en çok bu kadar okunur (Graph yanıtları küçüktür; bozuk/kötü niyetli sunucu belleği doldurmasın).
const MAX_BODY = 2_000_000;

// ---------- D0'DA DOĞRULANACAK VARSAYIMLAR (TEK YER) ----------
// Meta belgesinde okunmamış ya da belirsiz olup kodun dayandığı her şey burada; kod bu değerleri buradan okur. D0'da (kullanıcının
// "DestekOfis Mesaj" uygulaması + test numarası) her biri doğrulanır; yanlış çıkan yalnız burada düzeltilir.
export const META_D0 = Object.freeze({
  // D0-1: Meta kimlikleri (Phone Number ID, WABA ID, App ID) yalnız rakamdır. Belgelerdeki bütün örnekler rakam (106540352242922,
  // 102290129340398); biçim tanımı okunmadı. Kimlik istek ADRESİNE girdiği için rakam dışı her şey reddedilir (adres enjeksiyonu yok).
  idPattern: /^[0-9]{5,30}$/,
  // D0-2: Belirteç yazdırılabilir ASCII'dir (boşluk ve denetim karakteri yok). Meta yalnız "opaque string, uzunluğu değişir" der (access-tokens);
  // HTTP başlığına girdiği için satır sonu / boşluk zaten taşınamaz. Uzunluk sınırı KONMAZ (Meta: "without a specific maximum size").
  tokenPattern: /^[\x21-\x7e]+$/,
  // D0-3: "Kendime Deneme Gönder" şablonu: Meta'nın yeni WhatsApp Business hesabında hazır, değişkensiz, onaylı "hello_world" şablonu. Belgelerde
  // adı ve hazır geldiği OKUNMADI (kullanıcının Adım 1 denemesinde gelen "Order Confirmation" idi). Program şablonu varsaymaz: hesabın şablon
  // listesinde ADIYLA ve APPROVED aranır, dili listeden okunur; yoksa gönderilmez ve nedeni söylenir. W5 şablonları açılınca deneme ekstreyle yapılır.
  testTemplate: "hello_world",
  // D0-4: Gönderim sınırı basamağının adı TIER_<n>[K|M] ya da TIER_UNLIMITED (belgede yalnız "TIER_250" örneği; basamaklar 250 / 2.000 /
  // 10.000 / 100.000 / sınırsız — messaging-limits). Tanınmayan değer olduğu gibi gösterilir, sayıya çevrilmez.
  tierPattern: /^TIER_([0-9]+)(K|M)?$/i,
  tierUnlimited: /^TIER_UNLIMITED$/i,
  // D0-5: Numaranın kalite değerleri GREEN / YELLOW / RED / UNKNOWN (phone_numbers belgesi değer listesi vermiyor; şablon kalitesinin değerleri
  // — template-quality). Tanınmayan değer olduğu gibi gösterilir.
  quality: Object.freeze({ GREEN: "Yüksek", YELLOW: "Orta", RED: "Düşük", UNKNOWN: "Henüz Belirlenmedi", NA: "Henüz Belirlenmedi" }),
  // D0-6: code_verification_status için belgede yalnız "VERIFIED" okundu (local-storage); başka değer olduğu gibi gösterilir.
  verified: "VERIFIED",
  // D0-7: Liste uçları (phone_numbers, message_templates) imleçle sayfalanır; sonraki sayfa `after=<paging.cursors.after>` sorgu değişkeniyle
  // istenir (yanıttaki paging.cursors.after / paging.next belgeli, `after` istek değişkeni okunmadı). Yanıttaki mutlak `paging.next` adresi
  // İZLENMEZ (belirteç yalnız yapılandırılmış temel adrese gider). `limit` değişkeni belgeli (limit=5 örneği), üst sınırı okunmadı.
  pageLimit: 100,
  maxPages: 3,
  // D0-8: Şablon ileti dil kodu, şablon listesinin `language` alanındaki değerdir (ör. en_US); ayrıca eşleme yapılmaz.
  // ---------- 2.4.8 W2/W3/W9 (gönderim çekirdeği) ----------
  // D0-9: İleti isteğindeki `biz_opaque_callback_data` (en çok 512 karakter varsayımı) durum bildiriminde aynen geri gelir (plan §2.2: alan durum kancası
  // başvurusunda var, istek tarafı okunmadı). Program buraya İŞ KİMLİĞİNİ koyar; sonucu belirsiz iş, bildirim gelince bununla çözülür.
  bizOpaqueMax: 512,
  // D0-10: Gönderim sınırına (24 saatte farklı kişi) takılınca Meta'nın döndüğü hata kodu belgede okunmadı (plan §2.5). Program 131048'i (gönderim
  // sınırlandı) "sınır" sayar: aynı WABA'nın BÜTÜN işleri 24 saat bekler (plan §7a madde 30). Gerçek kod D0'da okunur, buraya eklenir.
  limitCodes: Object.freeze([131048]),
  // Kod sınıfları (plan §6 W2 + §7a madde 12; "Liste META_D0'da gözden geçirilir"). Burada olmayan TANINMAYAN kod → o iş Başarısız (kodlu), toplu iş sürer.
  //   tempCodes: geçici — iş 30 sn → 2 dk → 15 dk bekler (3 deneme), sonra Başarısız; toplu işte art arda 5 → duraklar.
  //   pauseCodes: belirteç / yetki / hesap / ödeme / numara / şablon — toplu iş İLK hatada duraklar, hatayı alan iş Başarısız (madde 13).
  //   jobFailCodes: alıcıya ya da bu iletiye özgü — o iş Başarısız (kodlu), toplu iş sürer (madde 12; 131009 alıcı numarası).
  tempCodes: Object.freeze([1, 2, 4, 80007, 130429, 131000, 131016, 131057, 133004, 2494100]),
  pauseCodes: Object.freeze([0, 3, 10, 33, 190, 368, 130497, 131005, 131031, 131037, 131042, 131045, 133010, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 132018]),
  jobFailCodes: Object.freeze([100, 130403, 131008, 131009, 131021, 131026, 131047, 131050, 131051, 131053, 131063, 131064, 133016, 135000]),
  // 131056: aynı kişiye kısa sürede çok ileti → o iş 1 dk sonra. 131049: ekosistem sağlığı → "Meta Bekletti (24 Saat Sonra Yeniden)", en çok bir kez (madde 14).
  pairRateCode: 131056,
  ecosystemCode: 131049,
  // D0-11: İleti ömrü (TTL) ileti isteğinde değil ŞABLONDA tanımlanır (message_send_ttl_seconds; şablonları W5 açar). Program kendi "Süresi Doldu"
  // kararını iç kuralla verir (plan §7a madde 16): durum bildirimi yolu çalışıyorsa (son 7 günde en az bir bildirim geldi) teslim olmayan ileti TTL
  // (S2 A: 3 gün) + 1 saatte "Süresi Doldu"; bildirim yolu yoksa "Meta Kabul Etti"de kalır.
  defaultTtlHours: 72,
  // D0-12: Medya yükleme (POST /<PHONE_NUMBER_ID>/media, multipart: messaging_product, type, file) yanıtı { id }; silme (DELETE /<MEDIA_ID>) { success: true }.
  // Zaten silinmiş / süresi dolmuş medyanın silinmesi hata kodu 100 (ya da HTTP 404) döner varsayımı → program "silinmiş" sayar.
  // D0-13: TESLİM EDİLMİŞ iletinin medyasını silmek alıcının telefonundaki belgeyi ETKİLEMEZ (WhatsApp belgeyi teslimde kendi sunucusundan iletir;
  // Cloud API medya kimliği yalnız işletmenin yüklediği kopyadır). Bu yüzden silme yalnız kesin durumdan (teslim / okundu / başarısız / süresi doldu /
  // 7 günde durum gelmedi / iptal) sonra yapılır (plan §2.3, S3 A).
  mediaGoneCodes: Object.freeze([100]),
  // D0-14: Şablon değişken değerinde satır sonu, sekme ve 4'ten çok ardışık boşluk yasak, tek değer en çok 1024 karakter (plan §2.2 "D0"). Program
  // değerleri tek satıra indirir, ardışık boşluğu teke düşürür ve kısaltır (ad / firma 60 karakter).
  paramMax: 60,
  // D0-15: Durum bildirimlerinin (statuses[]) alanları: id (wamid), status (sent / delivered / read / failed), timestamp (Unix saniye), recipient_id,
  // errors[] { code, title, message, error_data.details }, pricing { billable, category, pricing_model, type }, biz_opaque_callback_data (webhooks/reference/
  // messages/status). "read" yalnız "delivered"dan sonra gelir; aynı bildirim birden çok kez ve sırasız gelebilir (plan §3).
  statusOrder: Object.freeze({ accepted: 1, sent: 2, delivered: 3, read: 4 }),
  // D0-16: Web kancası imzası "X-Hub-Signature-256: sha256=<gövdenin uygulama gizli anahtarıyla HMAC-SHA256'sı, onaltılık>" (webhooks/overview). Yol 1'de
  // anahtar müşterinin uygulamasınındır (programda yok); kapıcı yalnız DestekOfis uygulamasının (Yol 2) imzasını denetleyebilir (plan §3 C).
  // D0-17: Abonelik (POST /<WABA_ID>/subscribed_apps { override_callback_uri, verify_token }) yanıtı { success: true }; adres doğrulaması GET
  // ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… ile gelir, yanıt challenge'ın kendisi (düz metin, 200).
  // D0-18 (W9): Kanca gövdesinin zarfı { object: "whatsapp_business_account", entry: [{ id: <WABA>, changes: [{ field: "messages", value: { messaging_product,
  // metadata: { display_phone_number, phone_number_id }, statuses[] | messages[] } }] }] } (webhooks/reference/messages); bir istekte birden çok entry/change
  // olabilir; durum dışı olaylar (gelen ileti, şablon/hesap) aynı uca gelir ve 200 ile kabul edilir. Gövde boyutu için Meta sınırı belgede bulunmadı (programda
  // ve kapıcıda 3 MB, plan §6 W9). 200 dışı yanıtta Meta 7 güne kadar yeniden dener (plan §3) — D0'da Dev moddaki uygulamayla denenir.
  hookEnvelope: Object.freeze({ object: "whatsapp_business_account", field: "messages" }),
});

// ---------- Hata kodları (plan §2.7; Meta support/error-codes) ----------
// retry: "never" (aynı istek yinelenirse yine düşer; kullanıcı ya da Meta tarafında düzeltme gerekir), "later" (geçici; bekleyip yinelenir),
// "unknown" (sonuç belirsiz: ağ, zaman aşımı, gövdesiz yanıt — W2'de "Sonucu Belirsiz", kendiliğinden yinelenmez).
const AUTH = { title: "Meta erişim belirtecini kabul etmedi (süresi dolmuş, iptal edilmiş ya da hatalı olabilir). Meta İşletme Ayarları → Sistem Kullanıcıları'ndan yeni kalıcı belirteç oluşturup Elle Bağla ile girin.", retry: "never", kind: "token" };
const PERMISSION = { title: "Belirtecin bu işleme izni yok. Sistem kullanıcısına WhatsApp hesabı ve Messaging hesabı için erişim ile whatsapp_business_management ve whatsapp_business_messaging izinleri verilmeli.", retry: "never", kind: "permission" };
const TEMPORARY = { title: "Meta şu an yanıt veremedi; biraz sonra yeniden deneyin.", retry: "later", kind: "temporary" };
const THROTTLE = { title: "Meta istek sınırına ulaşıldı; biraz sonra yeniden deneyin.", retry: "later", kind: "temporary" };
const META_ERRORS = Object.freeze({
  0: AUTH,
  190: { ...AUTH, title: "Erişim belirtecinin süresi dolmuş. Meta İşletme Ayarları → Sistem Kullanıcıları'ndan yeni kalıcı belirteç oluşturup Elle Bağla ile girin." },
  3: PERMISSION,
  10: PERMISSION,
  131005: PERMISSION,
  100: { title: "Meta isteği tanımadı: Telefon Numarası Kimliği (Phone Number ID) ya da WhatsApp Business Hesap Kimliği (WABA ID) yanlış olabilir.", retry: "never", kind: "request" },
  33: { title: "Bu telefon numarası Meta'da silinmiş.", retry: "never", kind: "account" },
  368: { title: "WhatsApp Business hesabı Meta tarafından kısıtlandı ya da kapatıldı (ilke ihlali). WhatsApp Yöneticisi'nden denetleyin.", retry: "never", kind: "account" },
  131031: { title: "WhatsApp Business hesabı Meta tarafından kısıtlandı ya da kapatıldı. WhatsApp Yöneticisi'nden denetleyin.", retry: "never", kind: "account" },
  130497: { title: "WhatsApp Business hesabının bu ülkeye ileti göndermesi kısıtlı.", retry: "never", kind: "account" },
  131042: { title: "Meta ödeme yöntemiyle ilgili sorun bildirdi. WhatsApp Yöneticisi'nde (Messaging hesabı) ödeme yöntemini denetleyin.", retry: "never", kind: "account" },
  133010: { title: "Numara WhatsApp Business Platformu'na kayıtlı değil.", retry: "never", kind: "account" },
  131045: { title: "Numara kayıt hatası nedeniyle ileti gönderilemedi; numaranın WhatsApp Business Platformu'na kaydını tamamlayın.", retry: "never", kind: "account" },
  131037: { title: "Numaranın onaylı görünen adı yok; WhatsApp Yöneticisi'nde görünen adı onaylatın.", retry: "never", kind: "account" },
  132000: { title: "Şablon değişkenlerinin sayısı şablonla uyuşmadı.", retry: "never", kind: "template" },
  132001: { title: "Şablon bu dilde yok ya da henüz onaylanmamış.", retry: "never", kind: "template" },
  132005: { title: "Şablonun çevirisi çok uzun.", retry: "never", kind: "template" },
  132007: { title: "Şablon içeriği WhatsApp ilkesine aykırı bulundu.", retry: "never", kind: "template" },
  132012: { title: "Şablon değişkenlerinin biçimi şablonla uyuşmadı.", retry: "never", kind: "template" },
  132018: { title: "Şablon değişkenlerinde sorun var.", retry: "never", kind: "template" },
  132015: { title: "Şablon düşük kalite nedeniyle Meta tarafından duraklatıldı.", retry: "never", kind: "template" },
  132016: { title: "Şablon düşük kalite nedeniyle Meta tarafından kalıcı olarak kapatıldı; yeni şablon gerekir.", retry: "never", kind: "template" },
  131026: { title: "İleti alıcıya iletilemedi (numara WhatsApp kullanmıyor, WhatsApp'ın koşullarını kabul etmemiş ya da WhatsApp'ı çok eski).", retry: "never", kind: "recipient" },
  131021: { title: "Alıcı numarası gönderen numarayla aynı.", retry: "never", kind: "recipient" },
  131009: { title: "Değerlerden biri geçersiz (ör. alıcı numarası).", retry: "never", kind: "request" },
  131008: { title: "İstekte gerekli bir değer eksik.", retry: "never", kind: "request" },
  135000: { title: "İstek değerlerinde bilinmeyen bir sorun var.", retry: "never", kind: "request" },
  131047: { title: "Alıcının son yanıtının üzerinden 24 saatten çok geçti; yalnız şablon iletisi gönderilebilir.", retry: "never", kind: "recipient" },
  131050: { title: "Alıcı bu işletmeden pazarlama iletisi almayı durdurmuş.", retry: "never", kind: "recipient" },
  131051: { title: "İleti türü desteklenmiyor.", retry: "never", kind: "request" },
  131053: { title: "İletideki dosya (medya) yüklenemedi.", retry: "never", kind: "request" },
  130403: { title: "Bu alıcı işletme tarafından WhatsApp'ta engellenmiş.", retry: "never", kind: "recipient" },
  131063: { title: "Şablon Meta'ca pazarlama sayıldı ve bu hesapta pazarlama iletisi kapalı.", retry: "never", kind: "template" },
  4: THROTTLE,
  80007: THROTTLE,
  130429: THROTTLE,
  131056: { title: "Aynı alıcıya kısa sürede çok ileti gönderildi; bir dakika sonra yeniden deneyin.", retry: "later", kind: "temporary" },
  131048: { title: "Bu numaradan gönderim Meta tarafından sınırlandı (çok ileti engellenmiş ya da şikâyet edilmiş olabilir). WhatsApp Yöneticisi'nde kaliteyi denetleyin.", retry: "later", kind: "account" },
  131064: { title: "Şablon sınıflandırma ihlali nedeniyle hesabın gönderim sınırı geçici olarak düşürüldü.", retry: "later", kind: "account" },
  131049: { title: "Meta iletiyi ekosistem sağlığı gerekçesiyle iletmedi; en az 24 saat sonra yeniden deneyin.", retry: "later", kind: "recipient" },
  131057: { title: "WhatsApp Business hesabı bakım kipinde; birkaç dakika sonra yeniden deneyin.", retry: "later", kind: "temporary" },
  2494100: { title: "Numara bakım kipinde; birkaç dakika sonra yeniden deneyin.", retry: "later", kind: "temporary" },
  131000: TEMPORARY,
  131016: TEMPORARY,
  133004: TEMPORARY,
  2: TEMPORARY,
  1: { title: "Meta isteği işleyemedi (geçersiz istek ya da Meta tarafında sunucu hatası).", retry: "unknown", kind: "temporary" },
});

/** Meta hata kodunun Türkçe başlığı ve yeniden deneme sınıfı (bilinmeyen kod: başlık boş, retry "unknown"). */
export function classifyMetaCode(code) {
  const number = Number(code);
  if (Number.isInteger(number) && Object.hasOwn(META_ERRORS, number)) return META_ERRORS[number];
  if (Number.isInteger(number) && number >= 200 && number <= 299) return PERMISSION;
  return { title: "", retry: "unknown", kind: "unknown" };
}

// Meta'nın verdiği metinden belirteci (ve belirtecin 8 karakterden uzun her parçasını değil, TAMAMINI) siler; kısaltır.
const clip = (value, max) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
export function redact(value, secret) {
  let text = String(value ?? "");
  if (secret && secret.length >= 4) text = text.split(secret).join("***");
  // "Bearer <belirteç>" biçimi (Meta isteği yankılarsa): belirteç tanınmasa da başlık değeri silinir.
  return text.replace(/Bearer\s+[\x21-\x7e]+/gi, "Bearer ***");
}

export class MetaGraphError extends Error {
  constructor({ code = null, subcode = null, httpStatus = 0, title = "", details = "", fbtraceId = "", retry = "unknown", kind = "unknown", reason = "" } = {}) {
    const known = title || (code != null ? `Meta işlemi reddetti.` : "Meta'ya ulaşılamadı.");
    const tail = code != null ? ` (Meta hata kodu ${code}${details ? `: ${details}` : ""})` : details ? ` (${details})` : "";
    super(`${known}${tail}`);
    this.name = "MetaGraphError";
    this.code = code;
    this.subcode = subcode;
    this.httpStatus = httpStatus;
    this.title = known;
    this.details = details;
    this.fbtraceId = fbtraceId;
    this.retry = retry;
    this.kind = kind;
    // reason: ağ katmanının sınıfı ("timeout", "network", "http", "body", "redirect", "graph-off", "token") — Meta yanıtı yoksa.
    this.reason = reason;
  }
  /** Ekrana / kayda giden özet (belirteç içermez; details zaten redact edilmiştir). */
  toJSON() {
    return { code: this.code, subcode: this.subcode, httpStatus: this.httpStatus, title: this.title, details: this.details, retry: this.retry, kind: this.kind, reason: this.reason };
  }
}

// Temel adres: üretimde https, testte yalnız yerel (127.0.0.1 / localhost) http. Başka her adres reddedilir (yanlış yapılandırmayla belirteç
// düz http'den ya da beklenmeyen bir sunucuya gitmesin).
export function graphBaseOk(baseUrl) {
  const value = String(baseUrl || "");
  return /^https:\/\/[^\s/?#]+$/i.test(value) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(value);
}

/**
 * createMetaGraph({ baseUrl, fetchImpl, openToken, timeoutMs }) → { phoneNumbers, phoneLimit, templates, sendTemplate, request }.
 * openToken: () => belirteç (açık metin) — her istekte bir kez çağrılır; boş dönerse istek yapılmaz.
 */
export function createMetaGraph({ baseUrl = "", fetchImpl = (...args) => globalThis.fetch(...args), openToken = () => "", timeoutMs = TIMEOUT_MS } = {}) {
  const base = String(baseUrl || "").replace(/\/+$/, "");

  async function request(method, parts, { query = {}, body = null, form = null } = {}) {
    if (!base) throw new MetaGraphError({ title: "Bu kurulumda WhatsApp Business API'ye bağlanılamaz (Meta adresi tanımlı değil).", reason: "graph-off", kind: "config", retry: "never" });
    if (!graphBaseOk(base)) throw new MetaGraphError({ title: "WhatsApp Business API adresi geçersiz (https olmalı).", reason: "graph-off", kind: "config", retry: "never" });
    for (const part of parts) if (!/^[A-Za-z0-9_]+$/.test(String(part))) throw new MetaGraphError({ title: "Meta isteğinin adresi geçersiz.", reason: "request", kind: "request", retry: "never" });
    const url = new URL(`${base}/${GRAPH_VERSION}/${parts.join("/")}`);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    // Belirteç YALNIZ burada açılır (plan §6 W1); hata iletileri ondan arındırılır.
    const token = String(openToken() || "");
    if (!token) throw new MetaGraphError({ title: "Kayıtlı erişim belirteci açılamadı; Elle Bağla ile belirteci yeniden girin.", reason: "token", kind: "token", retry: "never" });
    const headers = { authorization: `Bearer ${token}`, accept: "application/json" };
    if (body) headers["content-type"] = "application/json";
    // form (2.4.8 W3, medya yükleme): çok parçalı gövde; içerik türünü (sınır dizgesiyle) fetch koyar.
    const payload = form || (body ? JSON.stringify(body) : undefined);
    const controller = new AbortController();
    let timer = null;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new MetaGraphError({ title: `Meta ${Math.round(timeoutMs / 1000) || 1} saniyede yanıt vermedi; sonuç bilinmiyor.`, reason: "timeout", kind: "network", retry: "unknown" }));
      }, timeoutMs);
    });
    let status = 0;
    let raw = "";
    try {
      const response = await Promise.race([fetchImpl(url.href, { method, headers, body: payload, redirect: "manual", signal: controller.signal }), deadline]);
      status = response.status;
      if (status >= 300 && status < 400) {
        await response.body?.cancel?.().catch(() => {});
        throw new MetaGraphError({ title: "Meta yanıtı beklenmeyen bir yönlendirme oldu; istek izlenmedi.", httpStatus: status, reason: "redirect", kind: "network", retry: "unknown" });
      }
      const declared = Number(response.headers?.get?.("content-length") || 0);
      if (declared > MAX_BODY) {
        await response.body?.cancel?.().catch(() => {});
        throw new MetaGraphError({ title: "Meta yanıtı beklenenden büyük; okunmadı.", httpStatus: status, reason: "body", kind: "network", retry: "unknown" });
      }
      raw = await Promise.race([response.text(), deadline]);
    } catch (error) {
      if (error instanceof MetaGraphError) throw error;
      // fetch'in kendi hatası (DNS, bağlantı, vekil, TLS, iptal): iletisi belirteç taşımaz ama yine de arındırılır.
      throw new MetaGraphError({ title: "Meta'ya ulaşılamadı (internet bağlantısını ve vekil sunucu ayarını denetleyin); sonuç bilinmiyor.", details: clip(redact(error?.cause?.code || error?.message || "", token), 120), reason: "network", kind: "network", retry: "unknown" });
    } finally {
      clearTimeout(timer);
    }
    if (raw.length > MAX_BODY) throw new MetaGraphError({ title: "Meta yanıtı beklenenden büyük; okunmadı.", httpStatus: status, reason: "body", kind: "network", retry: "unknown" });
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    const failure = json && typeof json === "object" ? json.error : null;
    if (failure && typeof failure === "object") {
      const known = classifyMetaCode(failure.code);
      const details = clip(redact(failure.error_data?.details || failure.message || "", token), 200);
      throw new MetaGraphError({
        code: Number.isFinite(Number(failure.code)) ? Number(failure.code) : null,
        subcode: Number.isFinite(Number(failure.error_subcode)) ? Number(failure.error_subcode) : null,
        httpStatus: status,
        title: known.title,
        details,
        fbtraceId: clip(failure.fbtrace_id, 60),
        retry: known.retry,
        kind: known.kind,
        reason: "meta",
      });
    }
    if (status < 200 || status >= 300 || !json || typeof json !== "object") {
      // Gövdesiz ya da JSON olmayan yanıt (vekil hata sayfası, 5xx): Meta işledi mi bilinmez.
      throw new MetaGraphError({ title: `Meta'dan okunamayan yanıt geldi (HTTP ${status}); sonuç bilinmiyor.`, httpStatus: status, reason: "http", kind: "network", retry: status >= 500 || !status ? "unknown" : "never" });
    }
    return json;
  }

  // İmleçli liste (D0-7): en çok maxPages sayfa; `after` imleciyle.
  async function list(parts, query = {}) {
    const out = [];
    let after = "";
    for (let page = 0; page < META_D0.maxPages; page += 1) {
      const json = await request("GET", parts, { query: { ...query, limit: META_D0.pageLimit, after } });
      if (Array.isArray(json.data)) out.push(...json.data);
      const next = json.paging?.next && json.paging?.cursors?.after ? String(json.paging.cursors.after) : "";
      if (!next || next === after) return { items: out, complete: true };
      after = next;
    }
    return { items: out, complete: false };
  }

  return {
    request,
    // WABA'nın numaraları (varsayılan alanlar: verified_name, code_verification_status, display_phone_number, quality_rating, platform_type,
    // throughput, id — embedded-signup "Get the customer's phone numbers" yanıtı).
    phoneNumbers: wabaId => list([wabaId, "phone_numbers"]),
    // Numaranın gönderim sınırı basamağı (messaging-limits: ?fields=whatsapp_business_manager_messaging_limit).
    phoneLimit: async phoneNumberId => {
      const json = await request("GET", [phoneNumberId], { query: { fields: "whatsapp_business_manager_messaging_limit" } });
      return String(json.whatsapp_business_manager_messaging_limit || "");
    },
    // Şablonlar (template-management: ?fields=name,category,status; dil de istenir).
    templates: wabaId => list([wabaId, "message_templates"], { fields: "name,language,status,category" }),
    // Şablon iletisi (send-messages; numara "+" ve ülke koduyla — "+" yoksa Meta işletmenin ülke kodunu ekler). Yanıt kabuldür, teslim değil.
    // bizOpaque (2.4.8 W2, D0-9): iş kimliği; durum bildiriminde biz_opaque_callback_data olarak geri gelir.
    sendTemplate: async (phoneNumberId, { to, name, language, components, bizOpaque = "" }) => {
      const template = { name, language: { code: language } };
      if (Array.isArray(components) && components.length) template.components = components;
      const message = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template };
      if (bizOpaque) message.biz_opaque_callback_data = String(bizOpaque).slice(0, META_D0.bizOpaqueMax);
      const json = await request("POST", [phoneNumberId, "messages"], { body: message });
      const id = String(json.messages?.[0]?.id || "");
      if (!id) throw new MetaGraphError({ title: "Meta yanıtında ileti kimliği yok; iletinin gidip gitmediği bilinmiyor.", httpStatus: 200, reason: "body", kind: "network", retry: "unknown" });
      return { wamid: id, waId: String(json.contacts?.[0]?.wa_id || ""), pacing: String(json.messages?.[0]?.message_status || "") };
    },
    // ---------- 2.4.8 W3: medya (ekstre PDF'i; plan §2.3, D0-12/13) ----------
    // PDF bellekten yüklenir (diske yazılmaz); dönen medya kimliği 30 gün geçerli.
    uploadMedia: async (phoneNumberId, { data, filename, mime = "application/pdf" }) => {
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", mime);
      form.append("file", new Blob([data], { type: mime }), filename || "belge.pdf");
      const json = await request("POST", [phoneNumberId, "media"], { form });
      const id = String(json.id || "");
      if (!/^[A-Za-z0-9_]+$/.test(id)) throw new MetaGraphError({ title: "Meta medya yükleme yanıtında dosya kimliği yok.", httpStatus: 200, reason: "body", kind: "network", retry: "unknown" });
      return id;
    },
    // Kesin durumdan sonra (S3 A). Zaten silinmiş medya (D0-12) başarı sayılır: { deleted: true, gone }.
    deleteMedia: async mediaId => {
      try {
        await request("DELETE", [mediaId]);
        return { deleted: true, gone: false };
      } catch (error) {
        if (error instanceof MetaGraphError && (META_D0.mediaGoneCodes.includes(error.code) || (error.code == null && error.httpStatus === 404))) return { deleted: true, gone: true };
        throw error;
      }
    },
    // ---------- 2.4.8 W9: durum bildirimi aboneliği (plan §3 C, D0-17) ----------
    subscribeApp: async (wabaId, { callbackUri, verifyToken }) => {
      const json = await request("POST", [wabaId, "subscribed_apps"], { body: { override_callback_uri: callbackUri, verify_token: verifyToken } });
      return json.success === true || json.success === "true";
    },
  };
}

/**
 * İsteğin Meta'ya HİÇ ULAŞMADIĞI kesin mi (2.4.8 W2: yeniden göndermek çift ileti üretmez)? Adres yok / belirteç açılamadı / yapılandırma hatası ya da
 * bağlantı kurulmadan düşen ağ hatası (ad çözülemedi, bağlantı reddedildi, ağa ulaşılamadı). Zaman aşımı, bağlantı kopması, gövdesiz 5xx: BELİRSİZ.
 */
export function neverReachedMeta(error) {
  if (!(error instanceof MetaGraphError)) return false;
  if (["graph-off", "token", "request"].includes(error.reason)) return true;
  if (error.reason !== "network") return false;
  return /\b(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ERR_INVALID_URL|UND_ERR_CONNECT_TIMEOUT|CERT_|ERR_TLS_CERT|UNABLE_TO_VERIFY|SELF_SIGNED|DEPTH_ZERO)/.test(String(error.details || ""));
}

/** Sınır basamağını ekranda okunur hâle getirir (D0-4): { limit: sayı | null (sınırsız: Infinity), label }. */
export function tierInfo(tier) {
  const value = String(tier || "");
  if (!value) return { tier: "", limit: null, label: "" };
  if (META_D0.tierUnlimited.test(value)) return { tier: value, limit: Infinity, label: "Sınırsız" };
  const match = META_D0.tierPattern.exec(value);
  if (!match) return { tier: value, limit: null, label: value };
  const limit = Number(match[1]) * (match[2]?.toUpperCase() === "K" ? 1000 : match[2]?.toUpperCase() === "M" ? 1_000_000 : 1);
  return { tier: value, limit, label: `24 saatte ${new Intl.NumberFormat("tr-TR").format(limit)} farklı kişi` };
}
export const qualityLabel = value => META_D0.quality[String(value || "").toUpperCase()] || String(value || "");
