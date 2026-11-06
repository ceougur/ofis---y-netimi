// WhatsApp Business API bağlantısı — 2.4.8 W1 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §4, §6 W1). Şirket başına (her şirketin kendi veri
// dosyasındaki settings satırı "whatsapp.meta"; Şirket Verisini Sıfırla'da korunur — app.mjs KEEP_SETTINGS "whatsapp").
//
// Yol 1 "Elle Bağla": müşterinin kendi Meta uygulamasının kalıcı System User belirteci + Telefon Numarası Kimliği (Phone Number ID) + WhatsApp
// Business Hesap Kimliği (WABA ID) + isteğe bağlı Uygulama Kimliği (App ID; D0 — şablon örnek dosyası yüklenirken gerekebilir, plan §2.4).
//
// GÜVENLİK (plan §4): belirteç secret-box ile şifreli saklanır (anahtar veri klasöründe secret.key; yedeğe girmez → yedek başka bilgisayarda
// açılınca belirteç yeniden girilir). Belirteç istemciye (yalnız "Kayıtlı" işareti; son karakterleri de dönmez), günlüğe, işlem geçmişine
// (audit), hata iletisine, yedeğe ve dışa aktarmaya ÇIKMAZ; açık hâli yalnız lib/whatsapp/meta-graph.mjs isteğinin içinde yaşar.
// Kimlikler gizli değildir (Meta panelinde görünürler); ekranda gösterilir.
import { createHash, randomBytes, randomInt } from "node:crypto";
import { HttpError } from "../http.mjs";
import { createSecretBox } from "../secret-box.mjs";
import { META_D0, META_D0_W7, MetaGraphError, createMetaGraph, qualityLabel, splitMetaErrorMessage, tierInfo } from "./meta-graph.mjs";

export const SETTING_KEY = "whatsapp.meta";
// Deneme gönderiminden sonra aynı şirketten yeni deneme için bekleme (çift tık / iki sekme iki ileti göndermesin).
export const SELF_TEST_COOLDOWN_MS = 15_000;

// ---------- 2.5.0 W-1(a) BELİRTEÇ SÜRESİ (docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 W-1; docs/devir/2.5.0-DEVREDEN.md W-1) ----------
// Yol 2 (WhatsApp'ı Bağla): Meta'daki yapılandırma ("DestekOfis WhatsApp Bağla", config_id 1468332482078262) belirteci 60 GÜNLÜK verir (değiştirilemez). Süre Meta
// yanıtında gelirse (expires_in / data_access_expires_at — kapıcı aktarırsa) o kaydedilir; gelmezse bağlanma anı + 60 gün. Yol 1 (Elle Bağla, kalıcı System User
// belirteci) SÜRESİZ sayılır. Meta 190 (OAuthException) dönerse bağlantı "Süresi Doldu" olur — yalnız daha önce Meta'nın kabul ettiği (sınanmış / Yol 2) belirteçte
// ya da Meta açıkça "süresi doldu" (alt kod 463) dediğinde; yeni yazılmış, hiç çalışmamış belirtecin 190'ı yanlış yazımdır ("Sınama Başarısız" kalır).
// Bitişe 7 gün kala ve sonra her gün EN ÇOK BİR KEZ (kullanıcı başına) uyarı; süre dolunca yeni gönderim başlatılamaz, Yeniden Bağla her zaman açık.
// Belirteci YENİLEME (W-1(b), kapıcıda) Meta izninden sonra; burada yok.
export const EMBEDDED_TOKEN_DAYS = 60;
export const TOKEN_WARN_DAYS = 7;
export const TOKEN_EXPIRED_CODE = 190;
export const TOKEN_EXPIRED_SUBCODE = 463;
// 2.5.0 W TUR 2 — KULLANICI KARARI 05.11.2026 21:08 (S-W4 = A, "Kod 0 da 190 gibi işlensin"): Meta'nın belirteci REDDETTİĞİ kodlar — 190 (OAuthException: süresi dolmuş / iptal
// edilmiş belirteç) ve 0 (AuthException: belirteç süresi dolmuş / geçersiz). Listedeki her kod HER YERDE 190 gibi işlenir (tek liste; kopya mantık yok): bağlantı "Süresi Doldu" olur
// (noteMetaError), o anda iletisi gitmeyen kişi bekleyenlere döner ve toplu iş duraklar (queue.mjs applyFailure), Meta'da kaldırmanın nedeni "süresi dolmuş" yazılır. Kod 102 (API oturumu)
// kararın DIŞINDA — bugünkü gibi. Kodsuz Meta hatası (code null) bu listeye GİRMEZ (Number(null) = 0 tuzağı).
export const TOKEN_REJECT_CODES = Object.freeze([0, TOKEN_EXPIRED_CODE]);
export const isTokenRejectCode = code => code !== null && code !== undefined && code !== "" && TOKEN_REJECT_CODES.includes(Number(code));
// 2.5.0 W-2: Meta tarafında kaldırılamazsa kullanıcının izleyeceği adımlar (site; uygulamayı Business Settings → Integrations → Connected apps'ten kaldırma).
export const DATA_DELETION_URL = "https://destekofis.net/veri-silme";
const DAY_MS = 86_400_000;
const MAX_TOKEN_SECONDS = 10 * 365 * 86_400; // Meta'dan gelen süre bundan uzunsa / geçersizse yok sayılır
const isoOrNull = value => (typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(Date.parse(value)).toISOString() : null);
const pad2 = value => String(value).padStart(2, "0");
// Ekrandaki gün (programın yerel günü; kurulumda Türkiye saati).
const dayText = ms => {
  const date = new Date(ms);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
};
const localDay = date => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
/** Meta'nın kapıcı yoluyla aktardığı süre alanlarından bitiş anı (ms) ya da null: expires_in (sn, verildiği andan) ve data_access_expires_at (Unix sn) — erken olanı. */
export function metaExpiryOf({ expiresIn = null, dataAccessExpiresAt = null } = {}, issuedMs) {
  const seconds = Number(expiresIn);
  const fromIn = Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_TOKEN_SECONDS ? issuedMs + seconds * 1000 : null;
  const unix = Number(dataAccessExpiresAt);
  const fromData = Number.isFinite(unix) && unix * 1000 > issuedMs && unix * 1000 <= issuedMs + MAX_TOKEN_SECONDS * 1000 ? unix * 1000 : null;
  return { fromIn, fromData };
}
// Programın W5'te açacağı iki bilgilendirme şablonu (plan §6 W5); W1'de yalnız durumları okunur ("Henüz Açılmadı").
export const PROGRAM_TEMPLATES = Object.freeze(["destekofis_ekstre", "destekofis_odeme_hatirlatma"]);

const fail = (status, message, code, extra = {}) => {
  throw new HttpError(status, message, { code, ...extra });
};
const parse = value => {
  try {
    const parsed = JSON.parse(value || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};
const idOf = (value, label, field, { required = true } = {}) => {
  const text = typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, "") : "";
  if (!text) {
    if (required) fail(400, `${label} girilmedi.`, "whatsapp-invalid", { field });
    return "";
  }
  if (!META_D0.idPattern.test(text)) fail(400, `${label} yalnız rakamlardan oluşur (Meta uygulama panelindeki değeri olduğu gibi kopyalayın).`, "whatsapp-invalid", { field });
  return text;
};
const last4 = e164 => String(e164 || "").replace(/\D/g, "").slice(-4);

/**
 * createWhatsappConnection({ store, config, audit, now, onChange, hooks, publicUrl }) — bu şirketin bağlantısı.
 * config: dataDir (secret.key), whatsappGraphUrl (boşsa dış istek YOK), fetchImpl (vekil sunucu ayarı), whatsappTimeoutMs (yalnız testler).
 * onChange(summary) (2.4.8 W2/W9): bağlantı kaydedilince / kaldırılınca / durum bildirimi adresi kaydedilince — ortak katmandaki kayıt (tünelin açık olma
 * kuralı) güncellenir. summary gizli değer taşımaz.
 * hooks (T2-3/4): durum bildirimi adresinin WABA düzeyindeki kaydı — makine defteri (lib/whatsapp/defter.mjs hookOf / hookEvent / hookByPath); şirket dosyasında
 * DEĞİL. publicUrl: () => ofisin uzaktan (telefon) adresi (Bağlantıyı Sına kanca adresini de Meta'dakiyle karşılaştırır).
 */
export const HOOK_PATH = /^[A-Za-z0-9_-]{43}$/;
// Kanca kaydı düştüyse / yarım kaldıysa bakım turunun yeniden denemesi (Meta'ya saatte en çok bir abonelik isteği).
export const HOOK_RETRY_MS = 3_600_000;
/** Ayar satırından (whatsapp.meta, JSON) ortak katmanın özeti — açık olmayan şirketin dosyası salt okunur okunurken de (lib/whatsapp/hub.mjs). */
export function summaryOf(value) {
  const raw = parse(value);
  if (!raw || !raw.phoneNumberId || !raw.wabaId) return { configured: false };
  return { configured: typeof raw.tokenSealed === "string" && raw.tokenSealed !== "", mode: raw.mode === "embedded" ? "embedded" : "manual", wabaId: String(raw.wabaId), phoneNumberId: String(raw.phoneNumberId) };
}
export const sha256 = value => createHash("sha256").update(String(value)).digest("hex");
// Ofisin uzaktan (telefon) adresi kanca kökü olarak: sondaki "/" atılır; yalnız HTTPS kök (testte .test / .localhost üzerinde HTTP). 2.5.0 WE: Elle Bağla'nın uygulama düzeyi
// webhook adresi de (lib/whatsapp/app-webhook.mjs) AYNI kuralla.
export const hookBase = value => String(value || "").replace(/\/+$/, "");
export const usableBase = base => /^https:\/\/[^\s/?#]+$/i.test(base) || /^http:\/\/[^\s/?#]+\.(test|localhost)(:\d+)?$/i.test(base);
// sharedWaba(wabaId) (2.5.0 W-2): bu bilgisayarda BAŞKA bir şirket aynı WhatsApp Business hesabına belirteçli bağlı mı (ortak kayıt — lib/whatsapp/hub.mjs). Bağlıysa
// Bağlantıyı Kaldır Meta'daki aboneliği SİLMEZ (abonelik uygulama + WABA başına tektir; öbür şirketinki de odur — plan §3 "Nasıl bozulur" 1).
export function createWhatsappConnection({ store, config = {}, audit = () => {}, now = () => new Date(), onChange = () => {}, hooks = null, publicUrl = () => "", sharedWaba = () => false }) {
  let box = null;
  const secrets = () => (box ||= createSecretBox(config.dataDir || "."));
  const iso = () => now().toISOString();
  let selfTestBusy = false;
  // 2.5.0 W-2: süren Bağlantıyı Kaldır (aynı şirketin ikinci isteği aynı sonucu bekler; bu arada gönderim başlatılamaz).
  let removing = null;

  function read() {
    const raw = parse(store.setting(SETTING_KEY, ""));
    if (!raw || !raw.phoneNumberId || !raw.wabaId) return null;
    // 2.5.0 W-1(a): süre alanları 2.5.0'dan önce kaydedilmiş bağlantıda yok — Yol 2 için bağlanma anı + 60 gün, Yol 1 süresiz (göç yazmaz; okurken hesaplanır).
    const known = Object.hasOwn(raw, "tokenExpiresAt");
    const legacyEmbedded = !known && raw.mode === "embedded";
    const connectedMs = Date.parse(raw.embedded?.at || raw.savedAt || "");
    return {
      mode: raw.mode === "embedded" ? "embedded" : "manual",
      phoneNumberId: String(raw.phoneNumberId),
      wabaId: String(raw.wabaId),
      appId: raw.appId ? String(raw.appId) : "",
      tokenSealed: typeof raw.tokenSealed === "string" ? raw.tokenSealed : "",
      savedAt: raw.savedAt || null,
      savedBy: raw.savedBy || "",
      savedByName: raw.savedByName || "",
      lastTest: raw.lastTest && typeof raw.lastTest === "object" ? raw.lastTest : null,
      lastSelfTest: raw.lastSelfTest && typeof raw.lastSelfTest === "object" ? raw.lastSelfTest : null,
      // 2.4.8 W7: "WhatsApp'ı Bağla" bilgisi (olay türü, birlikte kullanım, Meta adımlarının sonucu) ve kayıt PIN'i (mühürlü; ekrana çıkmaz).
      embedded: raw.embedded && typeof raw.embedded === "object" ? raw.embedded : null,
      pinSealed: typeof raw.pinSealed === "string" ? raw.pinSealed : "",
      // 2.5.0 W-1(a): belirtecin bitişi (ISO; null = süresiz / bilinmiyor), kaynağı ("meta" | "default" | ""), Meta'nın bu belirteci son kabul ettiği an ve Meta'nın
      // 190 ile reddettiği an ({ at, code, subcode } | null). Belirteç değişince dördü sıfırlanır.
      tokenExpiresAt: known ? isoOrNull(raw.tokenExpiresAt) : legacyEmbedded && Number.isFinite(connectedMs) ? new Date(connectedMs + EMBEDDED_TOKEN_DAYS * DAY_MS).toISOString() : null,
      tokenExpirySource: known ? String(raw.tokenExpirySource || "") : legacyEmbedded && Number.isFinite(connectedMs) ? "default" : "",
      tokenVerifiedAt: isoOrNull(raw.tokenVerifiedAt),
      tokenExpired: raw.tokenExpired && typeof raw.tokenExpired === "object" ? raw.tokenExpired : null,
    };
  }
  const write = (record, userId = null) => store.setSetting(SETTING_KEY, JSON.stringify(record), userId);

  // ---------- 2.5.0 W-1(a): belirteç süresi ----------
  // Meta bu belirteci daha önce kabul etti mi: sınama / deneme başarılı oldu ya da belirteci Meta verdi (Yol 2). 2.5.0 öncesi kayıtta son sınama / deneme sonucu.
  const tokenWorked = record => Boolean(record.tokenVerifiedAt || record.mode === "embedded" || record.lastTest?.ok || record.lastSelfTest?.ok);
  const tokenFieldsOf = record => ({ tokenExpiresAt: record.tokenExpiresAt, tokenExpirySource: record.tokenExpirySource, tokenVerifiedAt: record.tokenVerifiedAt, tokenExpired: record.tokenExpired });
  const NO_TOKEN_FIELDS = Object.freeze({ tokenExpiresAt: null, tokenExpirySource: "", tokenVerifiedAt: null, tokenExpired: null });
  const RECONNECT = "Yönetim → WhatsApp'ta Yeniden Bağla ile yeniden bağlayın";
  /**
   * Belirtecin durumu (gizli değer YOK): state "ok" | "expiring" (bitişe ≤ 7 gün) | "expired" (Meta 190 ya da bitiş anı geçti); expiresAt (ISO | null = süresiz),
   * source ("meta" | "default" | ""), expiredBy ("meta" | "clock" | ""), daysLeft, message (ekranda ve bildirimde aynen; uyarı yoksa "").
   */
  function tokenStatus(record = read()) {
    if (!record) return null;
    const nowMs = now().getTime();
    const endMs = Date.parse(record.tokenExpiresAt || "");
    const hasEnd = Number.isFinite(endMs);
    const byMeta = Boolean(record.tokenExpired);
    const byClock = hasEnd && nowMs >= endMs;
    const left = hasEnd ? endMs - nowMs : null;
    const state = byMeta || byClock ? "expired" : hasEnd && left <= TOKEN_WARN_DAYS * DAY_MS ? "expiring" : "ok";
    const daysLeft = hasEnd && left > 0 ? Math.ceil(left / DAY_MS) : hasEnd ? 0 : null;
    let message = "";
    if (state === "expired") {
      message = byMeta
        ? `WhatsApp bağlantınızın süresi doldu: Meta erişim belirtecini artık kabul etmiyor (süresi dolmuş ya da iptal edilmiş). Yeni gönderim başlatılamaz; ${RECONNECT}.`
        : `WhatsApp bağlantınızın süresi doldu (${dayText(endMs)}). Yeni gönderim başlatılamaz; ${RECONNECT}.`;
    } else if (state === "expiring") {
      message = `WhatsApp bağlantınızın süresi doluyor — yeniden bağlayın. Bağlantı ${dayText(endMs)} tarihinde sona erer (${left < DAY_MS ? "1 günden az kaldı" : `${daysLeft} gün kaldı`}).`;
    }
    return {
      state,
      expiresAt: hasEnd ? new Date(endMs).toISOString() : null,
      source: record.tokenExpirySource || "",
      expiredBy: byMeta ? "meta" : byClock ? "clock" : "",
      expiredAt: byMeta ? record.tokenExpired.at || null : byClock ? new Date(endMs).toISOString() : null,
      daysLeft,
      message,
    };
  }
  /**
   * Gönderimi başlatmayı / sürdürmeyi engelleyen bağlantı nedeni (lib/whatsapp/queue.mjs startBlock'un ilk adımı) ya da null: bağlantı kaldırılıyor ya da belirtecin
   * süresi doldu. pauseReason süren toplu işin ekranındaki nedendir.
   */
  function sendBlock() {
    if (removing) {
      return { code: "whatsapp-removing", message: "WhatsApp bağlantısı kaldırılıyor; gönderim başlatılamaz.", pauseCode: "connection", pauseReason: "WhatsApp bağlantısı kaldırılıyor; gönderim duraklatıldı." };
    }
    const status = tokenStatus();
    if (status?.state !== "expired") return null;
    return {
      code: "whatsapp-token-expired",
      message: status.message,
      pauseCode: "token-expired",
      pauseReason: `${status.expiredBy === "meta" ? "WhatsApp bağlantınızın süresi doldu: Meta erişim belirtecini artık kabul etmiyor." : `WhatsApp bağlantınızın süresi doldu (${dayText(Date.parse(status.expiresAt))}).`} Gönderim duraklatıldı; ${RECONNECT} ve Devam Et'e basın.`,
    };
  }
  /**
   * 2.5.0 W-1(a) (KULLANICI KARARI 05.11 ~19:15; W TUR 2: kod 0 da — S-W4): toplu gönderim sürerken Meta belirteci 190 / 0 ile reddetti — toplu işin duraklatma kodu ve nedeni. Bağlantı bu redle "Süresi
   * Doldu" olduysa onun nedeni (Yeniden Bağla — iki yolda da kartta görünür); olmadıysa (belirteç arada değişti / hiç çalışmamış belirteç) yola göre ne yapılacağı. Her
   * durumda "yeniden bağlandıktan sonra Devam Et" (iletisi gitmeyen kişi bekleyenlerle birlikte gönderilir). Meta'nın genel 190 başlığındaki "Elle Bağla ile girin" Yol 2'de
   * yanlış yönlendirdiği için kullanılmaz.
   */
  function tokenRejectedPause() {
    const block = sendBlock();
    if (block?.code === "whatsapp-token-expired") return { pauseCode: block.pauseCode, pauseReason: block.pauseReason };
    const how =
      read()?.mode === "embedded"
        ? "Yönetim → WhatsApp'ta WhatsApp'ı Yeniden Bağla ile yeniden bağlayın"
        : "Yönetim → WhatsApp'ta Bilgileri Değiştir ile Meta'dan aldığınız yeni kalıcı belirteci (System User) girin";
    return { pauseCode: "meta-token", pauseReason: `Meta erişim belirtecini kabul etmedi (süresi dolmuş, iptal edilmiş ya da hatalı olabilir); ileti gönderilmedi ve gönderim duraklatıldı. ${how}, sonra Devam Et'e basın.` };
  }
  // Meta'nın yanıtladığı her hata buradan geçer (meta-graph onMetaError): 190 ve 0 (TOKEN_REJECT_CODES; W TUR 2, S-W4) → "Süresi Doldu" (yalnız Meta'nın daha önce kabul ettiği
  // belirteçte ya da alt kod 463'te). Belirteç arada değiştiyse (yeniden bağlandı) yazılmaz; ilk an kalır.
  function noteMetaError(record, error) {
    if (!(error instanceof MetaGraphError) || error.reason !== "meta" || !isTokenRejectCode(error.code)) return;
    const current = read();
    if (!current || current.tokenSealed !== record.tokenSealed || current.tokenExpired) return;
    if (!tokenWorked(current) && Number(error.subcode) !== TOKEN_EXPIRED_SUBCODE) return;
    write({ v: 1, ...current, tokenExpired: { at: iso(), code: Number(error.code), subcode: Number.isFinite(Number(error.subcode)) ? Number(error.subcode) : null } });
    audit(null, "whatsapp.token.expired", "whatsapp", { wabaId: current.wabaId, code: Number(error.code), subcode: error.subcode ?? null });
  }
  // Meta bu belirteçle bir isteği kabul etti (meta-graph onMetaOk): "çalıştı" işareti ilk kez yazılır, Meta 190 kaynaklı "Süresi Doldu" kalkar (belirteç geçerli). Yalnız
  // durum değişince yazar (belirteç başına bir kez) — her istekte değil. Bitiş anı (Yol 2: 60 gün) değişmez.
  function noteMetaOk(record) {
    const current = read();
    if (!current || current.tokenSealed !== record.tokenSealed) return;
    if (current.tokenVerifiedAt && !current.tokenExpired) return;
    write({ v: 1, ...current, tokenVerifiedAt: iso(), tokenExpired: null });
  }
  /**
   * Bitişe 7 gün kala ve sonra her gün EN ÇOK BİR KEZ uyarı (kullanıcı başına; programın yerel günü). İlk soran "göster" yanıtını alır, aynı gün sonrakiler almaz
   * (Kritik stok bildirimiyle aynı düzen — routes/stock.mjs alerts/notified). Uyarı yoksa gün yazılmaz (durum gün içinde değişirse aynı gün yine gösterilir).
   */
  function expiryNotice(user) {
    const status = tokenStatus();
    if (!status || status.state === "ok") return { show: false, state: status?.state || "none" };
    const key = `whatsapp.expiryNotice.${user.id}`;
    const day = localDay(now());
    // Günde en çok BİR bildirim (durum aynı gün "doluyor"dan "doldu"ya geçse de; o gün ekranlardaki satır ve gönderim engeli nedeni gösterir).
    if (store.setting(key, "") === day) return { show: false, state: status.state, day };
    store.setSetting(key, day, user.id);
    return { show: true, state: status.state, day, message: status.message, expiresAt: status.expiresAt };
  }

  // İstemciye giden görünüm: tokenSealed YOK; yalnız kayıtlı mı ve bu bilgisayarda açılabiliyor mu.
  function view({ writable = true } = {}) {
    const record = read();
    const graph = Boolean(config.whatsappGraphUrl);
    if (!record) return { configured: false, graphAvailable: graph, writable };
    const hasToken = Boolean(record.tokenSealed);
    return {
      configured: true,
      graphAvailable: graph,
      writable,
      mode: record.mode,
      phoneNumberId: record.phoneNumberId,
      wabaId: record.wabaId,
      appId: record.appId,
      hasToken,
      tokenUsable: hasToken && Boolean(secrets().open(record.tokenSealed)),
      savedAt: record.savedAt,
      savedByName: record.savedByName,
      lastTest: record.lastTest,
      lastSelfTest: record.lastSelfTest,
      // 2.5.0 W-1(a): belirtecin süresi ve durumu (Süresi Doldu / doluyor; gizli değer YOK).
      // Alan adı "token" DEĞİL: yanıtta belirteç adlı alan olmaz (test/whatsapp-w1-baglanti.test.mjs).
      tokenExpiry: tokenStatus(record),
      // 2.4.8 W9 / T2-3/4: durum bildirimi kaydı (WABA düzeyinde, makine defterinde; gizli yol ve belirteç YOK — yalnız durum).
      ...hookView(record.wabaId),
      // 2.4.8 W7: WhatsApp'ı Bağla — birlikte kullanım mı, Meta adımlarının sonucu (PIN ve belirteç YOK).
      ...(record.mode === "embedded" && record.embedded
        ? { embedded: { coex: Boolean(record.embedded.coex), event: String(record.embedded.olay || ""), at: record.embedded.at || null, steps: (Array.isArray(record.embedded.adimlar) ? record.embedded.adimlar : []).map(step => ({ name: String(step.ad || ""), ok: step.ok === true, message: String(step.ileti || ""), at: step.at || null })) } }
        : {}),
    };
  }
  // Ortak katmanın kaydı (tünel kuralı, web kancasının şirketi): gizli değer YOK.
  const summary = () => summaryOf(store.setting(SETTING_KEY, ""));
  const announce = () => {
    try {
      onChange(summary());
    } catch {
      // ortak kayıt güncellenemese de bağlantı yazıldı; ortak katman açılışta yeniden tarar
    }
  }

  function save(user, input = {}) {
    const previous = read();
    const phoneNumberId = idOf(input.phoneNumberId, "Telefon Numarası Kimliği (Phone Number ID)", "phoneNumberId");
    const wabaId = idOf(input.wabaId, "WhatsApp Business Hesap Kimliği (WABA ID)", "wabaId");
    const appId = idOf(input.appId, "Uygulama Kimliği (App ID)", "appId", { required: false });
    let tokenSealed = previous?.tokenSealed || "";
    let tokenChanged = false;
    if (typeof input.token === "string" && input.token.trim() !== "") {
      const token = input.token.trim();
      if (!META_D0.tokenPattern.test(token)) fail(400, "Erişim belirteci boşluk ya da satır sonu içeremez; Meta'daki belirteci olduğu gibi kopyalayıp yapıştırın.", "whatsapp-invalid", { field: "token" });
      tokenSealed = secrets().seal(token);
      tokenChanged = true;
    } else if (input.token !== undefined && typeof input.token !== "string") fail(400, "Erişim belirteci metin olmalı.", "whatsapp-invalid", { field: "token" });
    if (!tokenSealed) fail(400, "Kalıcı erişim belirteci (System User) girilmedi.", "whatsapp-invalid", { field: "token" });
    const changed = tokenChanged || !previous || previous.phoneNumberId !== phoneNumberId || previous.wabaId !== wabaId || previous.appId !== appId;
    const record = {
      v: 1,
      mode: "manual",
      phoneNumberId,
      wabaId,
      appId,
      tokenSealed,
      savedAt: changed ? iso() : previous.savedAt,
      savedBy: changed ? user.id : previous.savedBy,
      savedByName: changed ? user.display_name || user.name || "" : previous.savedByName,
      // Bağlantı değişince eski sınama sonucu geçersizdir (e-Belge Entegratör Ayarları düzeni).
      lastTest: changed ? null : previous.lastTest,
      lastSelfTest: changed ? null : previous.lastSelfTest,
      // 2.5.0 W-1(a): yeni belirteç (Yol 1, kalıcı System User) SÜRESİZ ve henüz sınanmamış; belirteç aynı kaldıysa (yalnız kimlikler değişti) süresi ve durumu
      // aynen taşınır (ör. Yol 2 belirteciyle Bilgileri Değiştir — 60 günlük süre sürer).
      ...(tokenChanged || !previous ? NO_TOKEN_FIELDS : tokenFieldsOf(previous)),
    };
    write(record, user.id);
    // İşlem geçmişine belirteç YAZILMAZ; yalnız değişip değişmediği.
    audit(user, "whatsapp.connection.saved", "whatsapp", { mode: "manual", phoneNumberId, wabaId, appId, tokenChanged, first: !previous });
    announce();
    return view();
  }

  // ---------- 2.4.8 W7: "WhatsApp'ı Bağla" (Embedded Signup; plan §6 W7) ----------
  // Belirteç kapıcıdan programa ofisin imzalı kanalıyla, programın geçici anahtarına şifreli gelir (lib/whatsapp/embedded.mjs açar); burada Elle Bağla ile
  // AYNI kuralla mühürlenir (işletme belirteci; Tech Provider'ın müşteriye özel Business Integration System User belirteci). Kipi "embedded": durum
  // bildirimleri yalnız kapıcının Meta imzasını doğruladığı (wa1) yoldan kabul edilir (lib/whatsapp/hook.mjs).
  function saveEmbedded(user, input = {}) {
    const previous = read();
    const phoneNumberId = idOf(input.phoneNumberId, "Telefon Numarası Kimliği (Phone Number ID)", "phoneNumberId");
    const wabaId = idOf(input.wabaId, "WhatsApp Business Hesap Kimliği (WABA ID)", "wabaId");
    const token = typeof input.token === "string" ? input.token.trim() : "";
    if (!token || !META_D0.tokenPattern.test(token)) fail(502, "Meta'dan gelen erişim belirteci okunamadı; WhatsApp'ı Bağla'yı yeniden deneyin.", "whatsapp-embedded-token");
    const coex = String(input.olay || "") === META_D0_W7.coexEvent;
    // App ID: belirtecin ait olduğu Meta uygulaması (kapıcının verdiği DestekOfis uygulaması); ekstre şablonunun örnek PDF'i bununla yüklenir. Gelmezse boş
    // (eski kapıcı / eksik ayar) — Şablonlar kartı bu kipe uygun nedeni yazar (lib/whatsapp/templates.mjs).
    const appId = META_D0.idPattern.test(String(input.appId || "")) ? String(input.appId) : "";
    const at = iso();
    // 2.5.0 W-1(a): bitiş — Meta'nın verdiği süre (expires_in) varsa o, yoksa bağlanma anı + 60 gün (yapılandırmanın süresi); veri erişim bitişi
    // (data_access_expires_at) yalnız KISALTIR. Bugünkü kapıcı bu alanları aktarmaz → 60 gün (W-1(b)'de kapıcı aynen aktarırsa kaydedilir).
    const issuedMs = Date.parse(at);
    const meta = metaExpiryOf({ expiresIn: input.expiresIn, dataAccessExpiresAt: input.dataAccessExpiresAt }, issuedMs);
    const endMs = Math.min(meta.fromIn ?? issuedMs + EMBEDDED_TOKEN_DAYS * DAY_MS, meta.fromData ?? Infinity);
    const record = {
      v: 1,
      mode: "embedded",
      phoneNumberId,
      wabaId,
      appId,
      tokenSealed: secrets().seal(token),
      savedAt: at,
      savedBy: user.id,
      savedByName: user.display_name || user.name || "",
      lastTest: null,
      lastSelfTest: null,
      embedded: { olay: String(input.olay || "FINISH"), coex, at, adimlar: [] },
      pinSealed: "",
      tokenExpiresAt: new Date(endMs).toISOString(),
      tokenExpirySource: meta.fromIn !== null || (meta.fromData !== null && meta.fromData <= endMs) ? "meta" : "default",
      // Belirteci Meta şimdi verdi (kod değişimi): kabul edilmiş sayılır.
      tokenVerifiedAt: at,
      tokenExpired: null,
    };
    write(record, user.id);
    audit(user, "whatsapp.connection.saved", "whatsapp", { mode: "embedded", phoneNumberId, wabaId, appId, coex, first: !previous, tokenExpiresAt: record.tokenExpiresAt, tokenExpirySource: record.tokenExpirySource });
    announce();
    return view();
  }
  /**
   * Bağlamadan sonraki Meta adımları (plan §2.8; D0 — META_D0_W7): birlikte kullanımda kişi + geçmiş eşitlemesi (24 saat içinde başlatılmazsa Meta müşteriyi
   * çıkarır; içerik saklanmaz), değilse numaranın kaydı (programca üretilen 6 haneli PIN, mühürlü). Hata bağlantıyı bozmaz; sonuç kartta görünür.
   */
  async function embeddedSteps(user) {
    const record = required();
    if (record.mode !== "embedded") return view();
    const graph = graphFor(record);
    const adimlar = [];
    const step = async (ad, fn) => {
      try {
        await fn();
        adimlar.push({ ad, ok: true, at: iso() });
      } catch (error) {
        if (!(error instanceof MetaGraphError)) throw error;
        adimlar.push({ ad, ok: false, ileti: error.message, at: iso() });
      }
    };
    let pinSealed = record.pinSealed || "";
    if (record.embedded?.coex) for (const type of META_D0_W7.syncTypes) await step(type, () => graph.startSync(record.phoneNumberId, type));
    else {
      const pin = String(randomInt(0, 10 ** META_D0_W7.pinLength)).padStart(META_D0_W7.pinLength, "0");
      await step("register", async () => {
        await graph.registerPhone(record.phoneNumberId, pin);
        pinSealed = secrets().seal(pin);
      });
    }
    saveResult({ embedded: { ...(record.embedded || {}), adimlar }, pinSealed }, record);
    audit(user, "whatsapp.embedded.steps", "whatsapp", { coex: Boolean(record.embedded?.coex), steps: adimlar.map(item => `${item.ad}:${item.ok ? "ok" : "hata"}`).join(",") });
    return view();
  }

  // ---------- 2.5.0 W-2: Bağlantıyı Kaldır (Meta'da da; plan §1 W-2) ----------
  // Sıra: (1) bu şirketin bekleyen gönderimleri durdurulur (stopSending; "Durduruldu" — ilke 1) → (2) Meta'da uygulamanın bu WABA'ya aboneliği silinir (DELETE
  // subscribed_apps; aynı WABA bu bilgisayarda başka şirkette bağlıysa SİLİNMEZ) → (3) yerel kayıt HER ZAMAN silinir (ilke 4: çıkmaz yok; Meta düşse de) → (4) arada
  // açılmış gönderim de durdurulur. Kesinti (2)'de olursa yerel kayıt durur, Kaldır yeniden denenir. Meta çağrısı düşerse sonuç "Meta tarafında kaldırılamadı" +
  // destekofis.net/veri-silme adımı. Aynı anda ikinci Kaldır aynı işlemin sonucunu alır (Meta'ya ikinci istek gitmez); bittikten sonraki Kaldır etkisizdir.
  // Belirtecin kendisini iptal eden Meta ucu belgede yok (meta-graph unsubscribeApp açıklaması) — müşteri Meta'dan kaldırır (veri silme sayfası).
  // Dönüş: { removed (yerel kayıt silindi), already (zaten bağlı değildi), meta: { state: "removed" | "failed" | "skipped", reason, message, link? } }.
  function remove(user, { stopSending = () => 0 } = {}) {
    if (removing) return removing;
    const previous = read();
    if (!previous) return Promise.resolve({ removed: false, already: true, meta: { state: "skipped", reason: "none", message: "" } });
    removing = removeNow(user, previous, stopSending).finally(() => {
      removing = null;
    });
    return removing;
  }
  async function removeNow(user, previous, stopSending) {
    const stopped = safeStop(stopSending);
    const meta = await unsubscribeAtMeta(previous);
    if (meta.state === "removed") forgetHook(previous.wabaId);
    const current = read();
    // Meta beklenirken bağlantı yeniden kurulduysa (başka pencerede yeni belirteç / kimlik) YENİSİ silinmez.
    const same = current && current.tokenSealed === previous.tokenSealed && current.wabaId === previous.wabaId && current.phoneNumberId === previous.phoneNumberId;
    if (same) store.run("DELETE FROM settings WHERE key = ?", SETTING_KEY);
    const late = same ? safeStop(stopSending) : 0;
    audit(user, "whatsapp.connection.removed", "whatsapp", { phoneNumberId: previous.phoneNumberId, wabaId: previous.wabaId, meta: meta.state, metaReason: meta.reason, metaCode: meta.code ?? null, stopped: stopped + late, replaced: !same });
    announce();
    return { removed: same, already: false, replaced: !same, stopped: stopped + late, meta };
  }
  const safeStop = stopSending => {
    try {
      return Number(stopSending()) || 0;
    } catch {
      return 0; // durdurma yazılamasa da kaldırma sürer; işçi bağlantısız toplu işi zaten yürütmez (duraklatır)
    }
  };
  // 2.5.0 W-2 dar kontrol DÜŞÜK-3: Meta'daki abonelik (ve onunla durum bildirimi adresi) silindi → WABA'nın makine defterindeki kanca kaydına "kaldırıldı" olayı yazılır
  // (adres boş: bakım turu / Bağlantıyı Sına bağlantı yeniden kurulunca HEMEN yeniden kaydeder — saatlik bekleme yok; kart "Kayıtlı Değil" der, eski "Çalışıyor" değil).
  // Gizli yolun ve doğrulama belirtecinin karması korunur: Meta'nın kaldırmadan önce kuyruğa aldığı geç bildirimler (teslim) yine tanınır. Defter yazılamazsa kaldırma
  // sürer (eski kayıt kalır; bakım turu en geç saatte bir Meta'daki adresi okuyup yeniden kaydeder).
  const HOOK_REMOVED = "removed";
  function forgetHook(wabaId) {
    const hook = hooks ? hooks.hookOf(wabaId) : null;
    if (!hook || hook.reason === HOOK_REMOVED) return;
    try {
      hooks.hookEvent({ ...hook, base: "", state: "failed", reason: HOOK_REMOVED, error: "Bağlantı kaldırıldı; durum bildirimi aboneliği Meta'dan silindi.", at: iso() });
    } catch {
      // defter yazılamadı (disk dolu / kilit): yukarıdaki açıklama
    }
  }
  // Meta tarafı kaldırılamadı: yola göre kimin aboneliği (Yol 2: DestekOfis uygulamasının erişimi; Yol 1: müşterinin kendi Meta uygulamasının aboneliği) + veri silme adımları.
  const failedAtMeta = (record, reason, why, extra = {}) => ({
    state: "failed",
    reason,
    message: `Bağlantı bu programdan kaldırıldı; ancak Meta tarafında kaldırılamadı (${why}). ${record.mode === "embedded" ? "DestekOfis uygulamasının WhatsApp hesabınıza erişimini" : "Meta uygulamanızın WhatsApp hesabınızdaki aboneliğini"} Meta'dan kaldırmak için ${DATA_DELETION_URL.replace(/^https:\/\//, "")} sayfasındaki adımları izleyin.`,
    link: DATA_DELETION_URL,
    ...extra,
  });
  async function unsubscribeAtMeta(record) {
    let shared = false;
    try {
      shared = Boolean(sharedWaba(record.wabaId));
    } catch {
      shared = false;
    }
    if (shared) {
      // Çıkmaz yok (ilke 4): öbür şirkette kaldırılamıyorsa (dosyası açılamıyor vb.) veri silme adımları da yazılır.
      return {
        state: "skipped",
        reason: "shared",
        message: `Bağlantı bu şirketten kaldırıldı. Aynı WhatsApp Business hesabı bu bilgisayarda başka bir şirkette de bağlı olduğu için Meta'daki abonelik korundu; tamamen kaldırmak için o şirkette de Bağlantıyı Kaldır'ı kullanın. Orada kaldıramıyorsanız ${DATA_DELETION_URL.replace(/^https:\/\//, "")} sayfasındaki adımları izleyin (öbür şirketin WhatsApp gönderimi de durur).`,
        link: DATA_DELETION_URL,
      };
    }
    if (!config.whatsappGraphUrl) return failedAtMeta(record, "graph-off", "bu kurulumda Meta adresi tanımlı değil");
    if (!record.tokenSealed || !secrets().open(record.tokenSealed)) return failedAtMeta(record, "token", "kayıtlı erişim belirteci bu bilgisayarda açılamıyor");
    if (record.tokenExpired) return failedAtMeta(record, "expired", "erişim belirtecinin süresi dolmuş");
    try {
      await createMetaGraph({ baseUrl: config.whatsappGraphUrl, fetchImpl: config.fetchImpl, openToken: () => secrets().open(record.tokenSealed), timeoutMs: Number(config.whatsappTimeoutMs) > 0 ? Number(config.whatsappTimeoutMs) : undefined }).unsubscribeApp(record.wabaId);
    } catch (error) {
      // Yerel kaldırma her durumda sürer (ilke 4): Meta dışı beklenmeyen hata da "kaldırılamadı" sonucudur.
      if (!(error instanceof MetaGraphError)) return failedAtMeta(record, "unexpected", "beklenmeyen bir hata oluştu");
      const why = error.reason === "meta" ? (isTokenRejectCode(error.code) ? "erişim belirtecinin süresi dolmuş" : `Meta isteği reddetti, hata kodu ${error.code}`) : "Meta'ya ulaşılamadı ya da yanıt okunamadı";
      return failedAtMeta(record, error.reason === "meta" ? "meta" : "unreachable", why, { code: error.code ?? null });
    }
    return { state: "removed", reason: "", message: "WhatsApp bağlantısı kaldırıldı; Meta'daki abonelik de silindi." };
  }

  // Meta istemcisi: belirteç yalnız istek anında, meta-graph.mjs içinde açılır.
  function graphFor(record) {
    if (!config.whatsappGraphUrl) fail(409, "Bu kurulumda WhatsApp Business API'ye bağlanılamaz (Meta adresi tanımlı değil).", "whatsapp-graph-off");
    if (!record.tokenSealed) fail(409, "Kalıcı erişim belirteci kayıtlı değil; Elle Bağla ile girin.", "whatsapp-token-missing");
    if (!secrets().open(record.tokenSealed)) fail(409, "Kayıtlı erişim belirteci bu bilgisayarda açılamadı (veriler başka bilgisayardan taşınmış olabilir). Elle Bağla ile belirteci yeniden girin.", "whatsapp-token-unreadable");
    return createMetaGraph({ baseUrl: config.whatsappGraphUrl, fetchImpl: config.fetchImpl, openToken: () => secrets().open(record.tokenSealed), timeoutMs: Number(config.whatsappTimeoutMs) > 0 ? Number(config.whatsappTimeoutMs) : undefined, onMetaError: error => noteMetaError(record, error), onMetaOk: () => noteMetaOk(record) });
  }
  const required = () => {
    const record = read();
    if (!record) fail(409, "WhatsApp Business API bağlantısı yok; önce Elle Bağla ile bilgileri girin.", "whatsapp-not-configured");
    return record;
  };
  // Meta hatası → HTTP 502 (Meta reddetti: whatsapp-meta; ulaşılamadı / yanıt okunamadı: whatsapp-meta-unreachable). Meta yanıt verdi ama numara bu hesapta
  // değil ya da deneme şablonu yok → 409 (kullanıcının düzelteceği durum). İleti ve ek alanlar belirteç taşımaz.
  const FAILURE_CODES = { meta: [502, "whatsapp-meta"], mismatch: [409, "whatsapp-mismatch"], template: [409, "whatsapp-test-template"] };
  const metaFailure = error => {
    const [status, code] = FAILURE_CODES[error.reason] || [502, "whatsapp-meta-unreachable"];
    return new HttpError(status, error.message, { code, meta: error.toJSON() });
  };

  // ---------- Bağlantıyı Sına ----------
  // 1) WABA'nın numaraları (belirteç + WABA erişimi; numara bu hesapta mı; görünen ad, kalite, doğrulama) → 2) numaranın sınır basamağı →
  // 3) şablonlar (deneme şablonu ve programın iki şablonunun durumu). İlk hata sınamayı durdurur; sonuç kaydedilir (Durum satırı).
  async function test(user) {
    const record = required();
    const graph = graphFor(record);
    let result;
    try {
      const numbers = await graph.phoneNumbers(record.wabaId);
      const phone = numbers.items.find(item => String(item?.id || "") === record.phoneNumberId);
      if (!phone) {
        const message = numbers.complete
          ? "Telefon Numarası Kimliği (Phone Number ID) bu WhatsApp Business hesabında (WABA ID) bulunamadı; iki kimliği Meta uygulama panelinden yeniden kopyalayın."
          : "Telefon Numarası Kimliği bu WhatsApp Business hesabının ilk numaraları arasında bulunamadı; kimliği Meta uygulama panelinden yeniden kopyalayın.";
        throw new MetaGraphError({ title: message, reason: "mismatch", kind: "request", retry: "never" });
      }
      const tier = tierInfo(await graph.phoneLimit(record.phoneNumberId));
      const templates = await graph.templates(record.wabaId);
      const byName = name => {
        const found = templates.items.filter(item => item?.name === name);
        const approved = found.find(item => String(item.status || "").toUpperCase() === "APPROVED");
        const pick = approved || found[0];
        return pick ? { name, status: String(pick.status || ""), language: String(pick.language || ""), category: String(pick.category || "") } : null;
      };
      result = {
        ok: true,
        at: iso(),
        message: "Bağlantı çalışıyor.",
        phone: {
          display: String(phone.display_phone_number || ""),
          verifiedName: String(phone.verified_name || ""),
          quality: String(phone.quality_rating || ""),
          qualityLabel: qualityLabel(phone.quality_rating),
          verification: String(phone.code_verification_status || ""),
          verified: String(phone.code_verification_status || "").toUpperCase() === META_D0.verified,
          tier: tier.tier,
          tierLabel: tier.label,
          limit: Number.isFinite(tier.limit) ? tier.limit : tier.limit === Infinity ? "unlimited" : null,
        },
        templates: {
          total: templates.items.length,
          complete: templates.complete,
          test: byName(META_D0.testTemplate),
          program: Object.fromEntries(PROGRAM_TEMPLATES.map(name => [name, byName(name)])),
        },
      };
    } catch (error) {
      if (!(error instanceof MetaGraphError)) throw error;
      const outcome = { ok: false, at: iso(), message: error.message, error: error.toJSON() };
      saveResult({ lastTest: outcome }, record);
      audit(user, "whatsapp.connection.tested", "whatsapp", { ok: false, code: error.code, reason: error.reason });
      throw metaFailure(error);
    }
    // 2.5.0 W-1(a): Meta belirteci kabul etti — "Süresi Doldu" (190) kalkar; bitiş anı (Yol 2: 60 gün) değişmez.
    saveResult({ lastTest: result, tokenVerifiedAt: result.at, tokenExpired: null }, record);
    audit(user, "whatsapp.connection.tested", "whatsapp", { ok: true, tier: result.phone.tier, quality: result.phone.quality });
    // T2-3/4: Bağlantıyı Sına durum bildirimi adresini de Meta'daki kayıtlı adresle HEMEN karşılaştırır (farklıysa / yoksa yeniden kaydeder). Hata sınamayı bozmaz.
    try {
      await ensureHook(publicUrl(), { force: true });
    } catch {
      // kanca sonucu kartta (hook.state); sınama sonucu değişmez
    }
    return view();
  }
  // Sonucu kaydederken kayıt arada değiştiyse (başka pencerede yeni bilgi kaydedildi) eski kimliklerin sonucu yeni kayda yazılmaz.
  function saveResult(patch, expected = null) {
    const current = read();
    if (!current) return;
    if (expected && (current.phoneNumberId !== expected.phoneNumberId || current.wabaId !== expected.wabaId || current.tokenSealed !== expected.tokenSealed)) return;
    write({ v: 1, ...current, ...patch });
  }

  // ---------- Kendime Deneme Gönder ----------
  // to: "+905…" (route waNumber ile doğrular). Şablon: META_D0.testTemplate, hesabın listesinde APPROVED olmalı; dil listeden.
  async function selfTest(user, to) {
    const record = required();
    const graph = graphFor(record);
    // 2.5.0 W-1(a): süresi dolan bağlantıyla ileti gönderilmez (deneme de bir gönderimdir); Bağlantıyı Sına açık kalır.
    const expired = tokenStatus(record);
    if (expired?.state === "expired") fail(409, expired.message, "whatsapp-token-expired");
    const last = record.lastSelfTest;
    const lastAt = Date.parse(last?.at || "");
    if (last?.ok && Number.isFinite(lastAt) && now().getTime() - lastAt >= 0 && now().getTime() - lastAt < SELF_TEST_COOLDOWN_MS) {
      fail(429, `Az önce deneme iletisi gönderildi; ${Math.ceil(SELF_TEST_COOLDOWN_MS / 1000)} saniye sonra yeniden deneyin.`, "whatsapp-selftest-cooldown", { retryAfter: Math.ceil(SELF_TEST_COOLDOWN_MS / 1000) });
    }
    if (selfTestBusy) fail(409, "Deneme gönderimi sürüyor; sonucunu bekleyin.", "whatsapp-selftest-busy");
    selfTestBusy = true;
    try {
      let sent;
      let template;
      try {
        const templates = await graph.templates(record.wabaId);
        template = templates.items.find(item => item?.name === META_D0.testTemplate && String(item.status || "").toUpperCase() === "APPROVED");
        if (!template) {
          const exists = templates.items.some(item => item?.name === META_D0.testTemplate);
          throw new MetaGraphError({
            title: exists
              ? `Meta'nın deneme şablonu (${META_D0.testTemplate}) bu WhatsApp Business hesabında onaylı değil; deneme gönderilmedi.`
              : `Meta'nın deneme şablonu (${META_D0.testTemplate}) bu WhatsApp Business hesabında yok; deneme gönderilmedi. Ekstre şablonları açılınca deneme ekstreyle yapılır.`,
            reason: "template",
            kind: "template",
            retry: "never",
          });
        }
        sent = await graph.sendTemplate(record.phoneNumberId, { to, name: template.name, language: String(template.language || "") });
      } catch (error) {
        if (!(error instanceof MetaGraphError)) throw error;
        saveResult({ lastSelfTest: { ok: false, at: iso(), to4: last4(to), message: error.message, error: error.toJSON() } }, record);
        audit(user, "whatsapp.selftest.failed", "whatsapp", { to4: last4(to), code: error.code, reason: error.reason });
        throw metaFailure(error);
      }
      const outcome = { ok: true, at: iso(), to4: last4(to), wamid: sent.wamid, template: template.name, language: String(template.language || ""), message: "Deneme iletisi Meta'ya kabul edildi; birkaç saniye içinde telefona gelmelidir (kabul, teslim değildir)." };
      saveResult({ lastSelfTest: outcome, tokenVerifiedAt: outcome.at, tokenExpired: null }, record);
      audit(user, "whatsapp.selftest.sent", "whatsapp", { to4: outcome.to4, wamid: sent.wamid, template: template.name });
      return { result: outcome, connection: view() };
    } finally {
      selfTestBusy = false;
    }
  }

  // ---------- 2.4.8 W2: gönderim çekirdeğinin Meta istemcisi (belirteç yine yalnız meta-graph.mjs isteğinde açılır) ----------
  function client() {
    const record = required();
    return { record, graph: graphFor(record) };
  }

  // ---------- 2.4.8 W9 + T2-3/4: durum bildirimi (web kancası) adresinin Meta'ya kaydı (plan §3 C) ----------
  // Adres: <ofisin telefon adresi>/wa/kanca/<32 baytlık gizli yol> (kapıcı yalnız bu yolu cihazsız ofisin tüneline geçirir; saklamaz). Doğrulama belirteci
  // (verify_token) Meta'nın GET doğrulamasında karşılaştırılır. T2-3/4 (bağımsız gözden geçirme r2 + r7): Meta'da alternatif adres WABA + uygulama başına TEKTİR
  // (plan §3; D0-17b) → kayıt da WABA başına tek ve ŞİRKET DOSYASININ DIŞINDA (makine defteri, hooks.hookEvent); gizli yol ve belirteç YALNIZ Meta'ya giden
  // istekte açık durur, saklanan yalnız SHA-256 karmaları. Aynı WABA'yı kullanan iki şirket aynı adresi paylaşır (bildirim wamid'le doğru şirkete gider —
  // lib/whatsapp/hook.mjs); Yedekten Geri Yükle / Şirket Verisini Sıfırla kaydı değiştirmez. Kayıt önce "Bekliyor" yazılır (Meta abonelik sırasında adresi
  // doğrulayabilir), Meta kabul edince "Kayıtlı".
  const lastCheck = new Map(); // WABA → son "Meta'daki adres" okuması (ISO; bakım turunda saatte en çok bir kez)
  const ms = value => Date.parse(value || "");
  const within = (value, span) => {
    const at = ms(value);
    return Number.isFinite(at) && now().getTime() >= at && now().getTime() - at < span;
  };
  // 2.4.9 UI tur B (ORTA-3): kaydedilemeyen Bildirim Yolunda kart nedeni Türkçe (cause) ve Meta'nın ham iletisini (metaMessage, metaCode) AYRI alır; at: son olayın
  // (kaydedilemediği) anı. Defterdeki kayıt (error) değişmez — eski kurulumun kaydı da aynı biçimde ayrılır.
  function hookView(wabaId) {
    const hook = hooks && wabaId ? hooks.hookOf(wabaId) : null;
    // 2.5.0 W-2 (DÜŞÜK-3): Bağlantıyı Kaldır Meta'daki aboneliği sildi — adres kayıtlı değil ("Kayıtlı Değil"; bakım turu yeniden kaydeder).
    if (!hook || hook.reason === HOOK_REMOVED) return {};
    const view = { state: hook.state, at: hook.at || null, registeredAt: hook.registeredAt || null, error: hook.error || "" };
    if (hook.state === "failed") {
      const split = splitMetaErrorMessage(hook.error);
      Object.assign(view, { cause: split.cause, metaCode: split.code, metaMessage: split.details });
    }
    return { hook: view };
  }
  const hookEvent = row => {
    try {
      return hooks.hookEvent(row);
    } catch (error) {
      return fail(503, `Durum bildirimi adresi kaydedilemedi (gönderim defteri yazılamadı: ${error.code || error.message}); disk dolu olabilir.`, "whatsapp-hook-ledger");
    }
  };
  // Meta'daki adres bu kaydın adresi mi: aynı köken + /wa/kanca/<gizli yol> ve gizli yolun karması kayıttaki.
  function sameHook(uri, hook) {
    try {
      const url = new URL(String(uri || ""));
      const secret = url.pathname.startsWith("/wa/kanca/") ? url.pathname.slice("/wa/kanca/".length) : "";
      return url.origin === new URL(hook.base).origin && HOOK_PATH.test(secret) && sha256(secret) === hook.pathHash;
    } catch {
      return false;
    }
  }
  async function registerHook(user, publicUrl, { reason = "manual" } = {}) {
    const record = required();
    if (!hooks) fail(503, "Durum bildirimi defteri açılamadı; program yeniden başlatılınca yeniden deneyin.", "whatsapp-hook-ledger");
    const base = hookBase(publicUrl);
    if (!usableBase(base)) fail(409, "Ofisin uzaktan bağlantı adresi henüz hazır değil; Yönetim → Mobil Cihazlar'da uzaktan bağlantı açılınca yeniden deneyin.", "whatsapp-hook-url");
    const graph = graphFor(record);
    const secret = randomBytes(32).toString("base64url");
    const verify = randomBytes(32).toString("base64url");
    const pending = { wabaId: record.wabaId, pathHash: sha256(secret), verifyHash: sha256(verify), base, state: "pending", reason, error: "", at: iso() };
    hookEvent(pending);
    announce();
    const settle = (state, error = "") => {
      if (hooks.hookOf(record.wabaId)?.pathHash !== pending.pathHash) return; // arada başka kayıt (başka şirket / pencere) yapıldı
      try {
        hooks.hookEvent({ ...pending, state, error, at: iso() });
      } catch {
        // defter yazılamadı: kayıt "Bekliyor"da kalır, bakım turu saatte bir yeniden dener
      }
    };
    try {
      await graph.subscribeApp(record.wabaId, { callbackUri: `${base}/wa/kanca/${secret}`, verifyToken: verify });
    } catch (error) {
      if (!(error instanceof MetaGraphError)) throw error;
      settle("failed", error.message);
      announce();
      audit(user, "whatsapp.hook.failed", "whatsapp", { code: error.code, reason: error.reason });
      throw metaFailure(error);
    }
    settle("active");
    lastCheck.set(record.wabaId, iso());
    announce();
    audit(user, "whatsapp.hook.registered", "whatsapp", { wabaId: record.wabaId, reason });
    return view();
  }
  /**
   * Bakım turunda (lib/whatsapp/queue.mjs maintain; plan §3 C "program adresi kendisi kaydeder") ve Bağlantıyı Sına'da (force): belirteçli bağlantı + ofisin uzaktan
   * adresi hazırsa WABA'nın kaydı denetlenir — kayıt yok / ofis adresi değişti / düşmüş ya da yarım kalmış (en çok saatte bir yeniden) → Meta'ya kaydedilir;
   * "Kayıtlı" ise Meta'daki KAYITLI adres okunur (GET subscribed_apps, saatte en çok bir kez) ve programınkiyle karşılaştırılır, farklıysa yeniden kaydedilir.
   * Aynı nedenle 24 saat içinde ikinci kez farklı çıkarsa (aynı WhatsApp hesabı başka bir kurulumda da bağlı: iki kurulum sırayla birbirinin adresini ezerdi)
   * kendiliğinden yeniden kaydedilmez — "Çakışma" yazılır; Yeniden Kaydet / Bağlantıyı Sına bu kurulumu seçer. Dönüş: ne yapıldığı (günlük ve test için).
   */
  async function ensureHook(publicUrl, { force = false } = {}) {
    const record = read();
    if (!record?.tokenSealed || !config.whatsappGraphUrl) return { skipped: "no-connection" };
    // 2.5.0 W-1(a): süresi dolan belirteçle bakım turu Meta'ya saatte bir boşuna istek göndermez (Bağlantıyı Sına — force — yine dener).
    if (!force && tokenStatus(record)?.state === "expired") return { skipped: "token-expired" };
    if (!hooks) return { skipped: "no-ledger" };
    const base = hookBase(publicUrl);
    if (!usableBase(base)) return { skipped: "no-url" };
    const register = async why => {
      try {
        await registerHook(null, base, { reason: why });
        return { registered: true, reason: why };
      } catch (error) {
        return { failed: error.message };
      }
    };
    const hook = hooks.hookOf(record.wabaId);
    if (!hook || hook.base !== base) return register(force ? "manual" : "auto");
    if (hook.state === "pending" || hook.state === "failed") return !force && within(hook.at, HOOK_RETRY_MS) ? { skipped: "recent" } : register(force ? "manual" : "auto");
    if (!force && (hook.state === "conflict" || within(lastCheck.get(record.wabaId), HOOK_RETRY_MS) || within(hook.at, HOOK_RETRY_MS))) return { skipped: hook.state };
    lastCheck.set(record.wabaId, iso());
    let apps;
    try {
      apps = await graphFor(record).subscribedApps(record.wabaId);
    } catch (error) {
      if (!(error instanceof MetaGraphError)) throw error;
      return { failed: error.message };
    }
    if (apps.some(app => sameHook(app.overrideUri, hook))) {
      if (hook.state === "conflict") hookEvent({ ...hook, state: "active", reason: "manual", error: "", at: iso() });
      return { verified: true };
    }
    if (!force && hook.reason === "mismatch" && within(hook.requestedAt, 24 * HOOK_RETRY_MS)) {
      hookEvent({
        ...hook,
        state: "conflict",
        error: "Meta'daki durum bildirimi adresi bu bilgisayarınkinden farklı (aynı WhatsApp hesabı başka bir bilgisayarda da bağlı olabilir); kendiliğinden yeniden kaydedilmedi. Bu bilgisayarda bildirim almak için Bağlantıyı Sına'ya basın.",
        at: iso(),
      });
      announce();
      return { conflict: true };
    }
    return register(force ? "manual" : "mismatch");
  }
  /** Gelen web kancası isteğinin gizli yolu / doğrulama belirteci bu şirketin WABA kaydının mı (SHA-256 karmasıyla; gizli değer saklanmaz). */
  function hookMatches(secret) {
    const record = read();
    const hook = hooks && record && HOOK_PATH.test(String(secret || "")) ? hooks.hookByPath(sha256(secret)) : null;
    return Boolean(hook && hook.wabaId === record.wabaId);
  }
  function verifyMatches(token) {
    const record = read();
    const hook = hooks && record ? hooks.hookOf(record.wabaId) : null;
    return Boolean(hook && token && hook.verifyHash === sha256(token));
  }

  // 2.4.8 W5: başka WhatsApp modüllerinin (şablonlar; meta-graph createMetaTemplates) Meta seçenekleri — graphFor ile AYNI denetimler; belirteç yalnız
  // istek anında openToken içinde açılır (mühürlü belirtece yalnız bu modül dokunur).
  function metaOptions(record) {
    graphFor(record);
    return { baseUrl: config.whatsappGraphUrl, fetchImpl: config.fetchImpl, openToken: () => secrets().open(record.tokenSealed), timeoutMs: Number(config.whatsappTimeoutMs) > 0 ? Number(config.whatsappTimeoutMs) : undefined, onMetaError: error => noteMetaError(record, error), onMetaOk: () => noteMetaOk(record) };
  }

  return { read, view, save, saveEmbedded, embeddedSteps, remove, test, selfTest, client, summary, registerHook, ensureHook, hookMatches, verifyMatches, metaOptions, tokenStatus, sendBlock, tokenRejectedPause, expiryNotice };
}
