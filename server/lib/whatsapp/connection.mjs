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
import { HttpError } from "../http.mjs";
import { createSecretBox } from "../secret-box.mjs";
import { META_D0, MetaGraphError, createMetaGraph, qualityLabel, tierInfo } from "./meta-graph.mjs";

export const SETTING_KEY = "whatsapp.meta";
// Deneme gönderiminden sonra aynı şirketten yeni deneme için bekleme (çift tık / iki sekme iki ileti göndermesin).
export const SELF_TEST_COOLDOWN_MS = 15_000;
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
 * createWhatsappConnection({ store, config, audit, now }) — bu şirketin bağlantısı.
 * config: dataDir (secret.key), whatsappGraphUrl (boşsa dış istek YOK), fetchImpl (vekil sunucu ayarı), whatsappTimeoutMs (yalnız testler).
 */
export function createWhatsappConnection({ store, config = {}, audit = () => {}, now = () => new Date() }) {
  let box = null;
  const secrets = () => (box ||= createSecretBox(config.dataDir || "."));
  const iso = () => now().toISOString();
  let selfTestBusy = false;

  function read() {
    const raw = parse(store.setting(SETTING_KEY, ""));
    if (!raw || !raw.phoneNumberId || !raw.wabaId) return null;
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
    };
  }
  const write = (record, userId = null) => store.setSetting(SETTING_KEY, JSON.stringify(record), userId);

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
    };
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
    };
    write(record, user.id);
    // İşlem geçmişine belirteç YAZILMAZ; yalnız değişip değişmediği.
    audit(user, "whatsapp.connection.saved", "whatsapp", { mode: "manual", phoneNumberId, wabaId, appId, tokenChanged, first: !previous });
    return view();
  }

  function remove(user) {
    const previous = read();
    if (!previous) return view();
    store.run("DELETE FROM settings WHERE key = ?", SETTING_KEY);
    audit(user, "whatsapp.connection.removed", "whatsapp", { phoneNumberId: previous.phoneNumberId, wabaId: previous.wabaId });
    return view();
  }

  // Meta istemcisi: belirteç yalnız istek anında, meta-graph.mjs içinde açılır.
  function graphFor(record) {
    if (!config.whatsappGraphUrl) fail(409, "Bu kurulumda WhatsApp Business API'ye bağlanılamaz (Meta adresi tanımlı değil).", "whatsapp-graph-off");
    if (!record.tokenSealed) fail(409, "Kalıcı erişim belirteci kayıtlı değil; Elle Bağla ile girin.", "whatsapp-token-missing");
    if (!secrets().open(record.tokenSealed)) fail(409, "Kayıtlı erişim belirteci bu bilgisayarda açılamadı (veriler başka bilgisayardan taşınmış olabilir). Elle Bağla ile belirteci yeniden girin.", "whatsapp-token-unreadable");
    return createMetaGraph({ baseUrl: config.whatsappGraphUrl, fetchImpl: config.fetchImpl, openToken: () => secrets().open(record.tokenSealed), timeoutMs: Number(config.whatsappTimeoutMs) > 0 ? Number(config.whatsappTimeoutMs) : undefined });
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
    saveResult({ lastTest: result }, record);
    audit(user, "whatsapp.connection.tested", "whatsapp", { ok: true, tier: result.phone.tier, quality: result.phone.quality });
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
      saveResult({ lastSelfTest: outcome }, record);
      audit(user, "whatsapp.selftest.sent", "whatsapp", { to4: outcome.to4, wamid: sent.wamid, template: template.name });
      return { result: outcome, connection: view() };
    } finally {
      selfTestBusy = false;
    }
  }

  // 2.4.8 W5: başka WhatsApp modüllerinin (şablonlar; meta-graph createMetaTemplates) Meta seçenekleri — graphFor ile AYNI denetimler; belirteç yalnız
  // istek anında openToken içinde açılır (mühürlü belirtece yalnız bu modül dokunur).
  function metaOptions(record) {
    graphFor(record);
    return { baseUrl: config.whatsappGraphUrl, fetchImpl: config.fetchImpl, openToken: () => secrets().open(record.tokenSealed), timeoutMs: Number(config.whatsappTimeoutMs) > 0 ? Number(config.whatsappTimeoutMs) : undefined };
  }

  return { read, view, save, remove, test, selfTest, metaOptions };
}
