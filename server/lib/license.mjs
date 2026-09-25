// Lisans motoru (Faz 3, v2.0.0).
//
// Kararlar (Faz planı): demo ve lisanslı sürüm aynı kurulum dosyasıdır; deneme süresi ilk etkinleştirmede başlar ve
// bilgisayar başına bir kez verilir (lisans servisi denetler); lisans servisi (Vercel) imzalı yanıt verir; süre dolunca,
// lisans engellenince ya da doğrulanamayınca program SALT OKUNUR çalışır (kayıtlar görüntülenir, dışa aktarılır,
// yedeklenir; yeni işlem yapılamaz); internetsiz 7 gün tolerans; saat geri alma koruması. 2.0.0 öncesinden gelen ve
// kullanılmış kurulumlar 30 günlük geçiş döneminde kesintisiz çalışır.
//
// Durumlar: none (etkinleştirilmemiş) · transition (geçiş) · trial (deneme) · licensed (lisanslı) · expired (süresi
// doldu) · blocked (engellendi) · verify (7 günden uzun süredir doğrulanamadı) · clock (bilgisayar saati geri alınmış).
// Yazılabilir olanlar: transition, trial, licensed.
//
// Güven modeli: lisansın kendisi (süre, tür, bilgisayar) imzalı belirteçtedir ve değiştirilemez. Yerel durum
// (görülen en ileri zaman, son başarılı doğrulama, geçiş başlangıcı) veritabanında bütünlük özetiyle saklanır; özet
// tutmazsa en sıkı varsayımlar kullanılır. Etkin zaman, bilgisayar saati ile görülen en ileri zamanın büyüğüdür;
// saat geri alınsa bile süre geri gelmez. Lisans servisine başarılı her bağlantı servisin saatini güvenilir zaman yapar.
import { createHmac } from "node:crypto";
import { HttpError } from "./http.mjs";
import { TRUSTED_LICENSE_KEYS } from "./license-keys.mjs";
import { LicenseError, PRODUCT, decodeCode, formatInstallCode, normalizeMachineId, verifyToken } from "./license-token.mjs";
import { resolveMachineId } from "./machine.mjs";

// Lisans uyarılarında gösterilen iletişim bilgisi (deneme/lisans bitişi, engel, taşıma).
export const SUPPORT_CONTACT = Object.freeze({ name: "Destek Ofis", phone: "0532 605 05 87", phoneHref: "tel:+905326050587", email: "bilgi.ugurcetin@gmail.com" });
const CONTACT_TEXT = `${SUPPORT_CONTACT.name}: ${SUPPORT_CONTACT.phone} · ${SUPPORT_CONTACT.email}`;
export const GRACE_DAYS = 7;
export const TRANSITION_DAYS = 30;
export const WARN_DAYS = 7;
export const CLOCK_TOLERANCE_MS = 24 * 3_600_000;
// Faz 4'te lisans API'si bu adreste yayımlanır; ortamda HUKUK_LICENSE_URL (virgülle birden çok) ile değiştirilebilir.
// Yanıtlar imzalı olduğundan adresin değişmesi güveni zayıflatmaz.
export const DEFAULT_LICENSE_SERVICES = Object.freeze(["https://destek-ofis.vercel.app/api/lisans"]);
const DAY = 86_400_000;
const WRITABLE = new Set(["transition", "trial", "licensed"]);

// Salt okunur modda ekranlardan gizlenen yetkiler (sunucu zaten her yazma isteğini reddeder).
export const WRITE_PERMISSIONS = Object.freeze([
  "records.create", "records.edit", "records.delete", "notes.write", "phones.create", "payments.create", "liens.create",
  "tasks.create", "tasks.complete", "messages.create", "sources.manage", "profile.manage",
]);

// Salt okunur modda da izin verilen değiştirici istekler: giriş/çıkış/parola, lisans işlemleri, yönetim (kullanıcılar,
// yedek almak, ofis adı, güncelleme), sohbette "okundu" bilgisi ve tanıtım kartını kapatmak.
const READ_ONLY_ALLOWED = [
  /^\/api\/auth\//,
  /^\/api\/license(\/|$)/,
  /^\/api\/admin\//,
  /^\/api\/chat\/conversations\/[^/]+\/read$/,
  /^\/api\/workspace\/insight\/intro$/,
];
export const allowedWhenReadOnly = pathname => READ_ONLY_ALLOWED.some(pattern => pattern.test(pathname));

const iso = time => (Number.isFinite(time) ? new Date(time).toISOString() : null);
const daysBetween = (from, to) => Math.max(0, Math.ceil((to - from) / DAY));
const toTime = value => {
  const time = typeof value === "number" ? value : Date.parse(value ?? "");
  return Number.isFinite(time) ? time : null;
};

// ---------- Saf değerlendirme (testlerde doğrudan sınanır) ----------
// token: doğrulanmış iddialar (claims) veya null · tokenProblem: belirteç var ama bu bilgisayara ait değilse açıklama.
export function evaluateLicense({
  token = null,
  tokenProblem = null,
  machineId,
  local = {},
  now,
  graceDays = GRACE_DAYS,
  transitionDays = TRANSITION_DAYS,
  warnDays = WARN_DAYS,
  clockToleranceMs = CLOCK_TOLERANCE_MS,
}) {
  const highWater = toTime(local.highWater);
  const effective = Math.max(now, highWater ?? 0);
  const clockBack = highWater != null && now < highWater - clockToleranceMs;
  const base = { state: "none", writable: false, severity: "error", kind: null, title: "", message: "", daysLeft: null, expiresAt: null, customer: "", licenseId: null, offline: false, lastOnlineAt: null, graceUntil: null, transitionEndsAt: null, effectiveNow: iso(effective), reason: null };
  const allowed = "kayıtlar görüntülenebilir, dışa aktarılabilir ve yedeklenebilir, ancak yeni işlem yapılamaz.";
  const readOnly = `Program salt okunur çalışıyor: ${allowed}`;
  const stopped = `Program durduruldu: ${allowed}`;
  const clockState = () => ({
    ...base,
    state: "clock",
    title: "Bilgisayar saati geri alınmış",
    message: `Sunucu bilgisayarın tarihi daha önce görülen tarihten (${new Date(highWater).toLocaleDateString("tr-TR")}) geride. Windows'ta tarih ve saati düzeltin (Ayarlar → Saat ve dil → "Saati otomatik ayarla"). ${readOnly}`,
  });

  if (token && token.machine === machineId) {
    const expiresAt = toTime(token.expiresAt);
    const common = { ...base, kind: token.kind, expiresAt: token.expiresAt, customer: token.customer, licenseId: token.licenseId, offline: token.offline };
    const kindName = token.kind === "trial" ? "Deneme süresi" : "Lisans süresi";
    if (token.status === "blocked") {
      return { ...common, state: "blocked", title: "Lisans engellendi", message: `${token.message || `Bu lisans lisans servisi tarafından engellendi. Bizimle görüşün: ${CONTACT_TEXT}.`} ${readOnly}` };
    }
    if (expiresAt != null && effective >= expiresAt) {
      return { ...common, state: "expired", daysLeft: 0, title: `${kindName} doldu`, message: `${kindName} ${new Date(expiresAt).toLocaleDateString("tr-TR")} tarihinde doldu. ${stopped} Verileriniz silinmez. Kullanmaya devam etmek için bizimle görüşün: ${CONTACT_TEXT}. Lisansınız tanımlanınca kaldığınız yerden devam edersiniz.` };
    }
    if (clockBack) return { ...common, ...clockState() };
    const daysLeft = expiresAt == null ? null : daysBetween(effective, expiresAt);
    let lastOnlineAt = null;
    let graceUntil = null;
    if (!token.offline) {
      lastOnlineAt = Math.max(toTime(local.lastOnlineAt) ?? 0, toTime(token.issuedAt) ?? 0);
      graceUntil = lastOnlineAt + graceDays * DAY;
      if (effective > graceUntil) {
        return {
          ...common,
          daysLeft,
          lastOnlineAt: iso(lastOnlineAt),
          graceUntil: iso(graceUntil),
          state: "verify",
          title: "Lisans doğrulanamadı",
          message: `Sunucu ${graceDays} günden uzun süredir lisans servisine ulaşamadı (son doğrulama ${new Date(lastOnlineAt).toLocaleDateString("tr-TR")}). İnternet bağlantısını kontrol edip Yönetim → Lisans → "Şimdi doğrula"ya basın. ${readOnly}`,
        };
      }
    }
    const active = { ...common, daysLeft, lastOnlineAt: iso(lastOnlineAt), graceUntil: iso(graceUntil), writable: true, state: token.kind === "trial" ? "trial" : "licensed", severity: "ok" };
    const graceLeft = graceUntil == null ? null : daysBetween(effective, graceUntil);
    if (token.kind === "trial") {
      active.severity = daysLeft <= warnDays ? "warn" : "info";
      active.title = `Deneme sürümü · ${daysLeft} gün kaldı`;
      active.message = `Ücretsiz deneme ${new Date(expiresAt).toLocaleDateString("tr-TR")} tarihinde bitiyor. Süre dolunca program salt okunur olur; verileriniz kaybolmaz. Kullanmaya devam etmek için bizimle görüşün: ${CONTACT_TEXT}.`;
    } else {
      active.title = token.customer ? `Lisanslı · ${token.customer}` : "Lisanslı";
      active.message = expiresAt == null ? "Süresiz lisans." : `Lisans ${new Date(expiresAt).toLocaleDateString("tr-TR")} tarihine kadar geçerli.`;
      if (daysLeft != null && daysLeft <= warnDays) {
        active.severity = "warn";
        active.title = `Lisansın bitmesine ${daysLeft} gün kaldı`;
        active.message = `Lisans ${new Date(expiresAt).toLocaleDateString("tr-TR")} tarihinde bitiyor. Yenilemek için bizimle görüşün (${CONTACT_TEXT}); yenilenen lisans Yönetim → Lisans → "Şimdi doğrula" ile hemen gelir.`;
      }
    }
    if (graceLeft != null && graceLeft <= 3) {
      active.severity = "warn";
      active.reason = "grace";
      active.message = `Lisans ${Math.round((effective - lastOnlineAt) / DAY)} gündür doğrulanamadı. ${graceLeft} gün içinde sunucu internete bağlanamazsa program salt okunur olur. ${active.message}`;
    }
    return active;
  }

  const transitionStart = toTime(local.transitionStart);
  if (transitionStart != null) {
    const endsAt = transitionStart + transitionDays * DAY;
    if (effective < endsAt) {
      if (clockBack) return clockState();
      const daysLeft = daysBetween(effective, endsAt);
      return {
        ...base,
        state: "transition",
        writable: true,
        severity: "warn",
        daysLeft,
        transitionEndsAt: iso(endsAt),
        title: `Lisans geçiş dönemi · ${daysLeft} gün kaldı`,
        message: `Bu kurulum lisans sisteminden önce kurulduğu için ${new Date(endsAt).toLocaleDateString("tr-TR")} tarihine kadar kesintisiz çalışır. Bu tarihten önce yönetici Yönetim → Lisans bölümünden lisansı etkinleştirmeli; aksi hâlde program salt okunur olur.`,
      };
    }
    return { ...base, transitionEndsAt: iso(endsAt), reason: "transition-ended", title: "Geçiş dönemi doldu", message: `Lisans geçiş dönemi ${new Date(endsAt).toLocaleDateString("tr-TR")} tarihinde doldu. ${stopped} Yönetici Yönetim → Lisans bölümünden lisansı etkinleştirmeli. Lisans için: ${CONTACT_TEXT}.` };
  }
  if (tokenProblem) return { ...base, reason: "machine", title: "Lisans bu bilgisayara ait değil", message: `${tokenProblem} ${readOnly}` };
  return {
    ...base,
    title: "Ücretsiz deneme henüz başlamadı",
    message: `30 günlük ücretsiz deneme, sunucu bilgisayar internete bağlanınca kendiliğinden başlar. İnternet bağlantısını kontrol edin; sorun sürerse bizi arayın: ${CONTACT_TEXT}. O zamana kadar ${readOnly.charAt(0).toLocaleLowerCase("tr-TR")}${readOnly.slice(1)}`,
  };
}

// ---------- Lisans servisi hataları ----------
const SERVICE_MESSAGES = {
  TRIAL_USED: "Bu bilgisayarda ücretsiz deneme daha önce kullanılmış.",
  LICENSE_NOT_FOUND: "Lisans anahtarı bulunamadı. Anahtarı eksiksiz yazdığınızdan emin olun.",
  LICENSE_IN_USE: `Bu lisans anahtarı başka bir bilgisayarda etkin. Taşımak için bizimle görüşün: ${CONTACT_TEXT}.`,
  LICENSE_BLOCKED: `Bu lisans engellenmiş. Bizimle görüşün: ${CONTACT_TEXT}.`,
  LICENSE_EXPIRED: `Bu lisansın süresi dolmuş. Yenilemek için bizimle görüşün: ${CONTACT_TEXT}.`,
  RATE_LIMITED: "Çok sık deneme yapıldı. Birkaç dakika sonra tekrar deneyin.",
};
const networkMessage = error => {
  const code = error?.cause?.code || error?.code || "";
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "Lisans servisi zamanında yanıt vermedi.";
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return "İnternet bağlantısı yok veya lisans servisinin adı çözülemedi.";
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/.test(code)) return "Güvenli bağlantı doğrulanamadı (antivirüs/güvenlik duvarı SSL denetimi yapıyor olabilir).";
  return `Lisans servisine ulaşılamadı${code ? ` (${code})` : ""}.`;
};
const LICENSE_KEY = /^DO(?:-[0-9A-HJKMNP-TV-Z]{5}){4}$/;
export const normalizeLicenseKey = value => {
  // Crockford base32: O → 0, I/L → 1 okunur (elle yazımda karışmasın). "DO-" öneki yazılmasa da kabul edilir.
  const compact = String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const body = compact.length === 22 && compact.startsWith("D0") ? compact.slice(2) : compact;
  if (body.length !== 20) return null;
  const key = `DO-${body.match(/.{5}/g).join("-")}`;
  return LICENSE_KEY.test(key) ? key : null;
};

// ---------- Uygulamadaki lisans hizmeti ----------
export function createLicenseService({
  store,
  audit = () => {},
  events = null,
  log = console,
  dataDir,
  version,
  enforce = true,
  trustedKeys = TRUSTED_LICENSE_KEYS,
  services = DEFAULT_LICENSE_SERVICES,
  fetchImpl = (...args) => globalThis.fetch(...args),
  machineId: machineOverride = null,
  now = () => Date.now(),
  usedBefore = () => false,
  graceDays = GRACE_DAYS,
  transitionDays = TRANSITION_DAYS,
  checkIntervalMs = 12 * 3_600_000,
  retryMs = 30 * 60_000,
  firstCheckDelayMs = 30_000,
  tickMs = 10 * 60_000,
  requestTimeoutMs = 15_000,
  autoTrial = true,
  autoTrialDelaysMs = [3_000, 2 * 60_000, 10 * 60_000],
  contactAfterDays = 2,
  onChange = () => {},
}) {
  const S = { token: "license.token", local: "license.local", initialized: "license.initialized", machine: "license.machine", contact: "license.contact" };
  const instanceId = () => store.setting("meta.instanceId", "") || "";
  const macKey = () => `DestekOfis|lisans-yerel|1|${instanceId()}`;
  const macOf = fields => createHmac("sha256", macKey()).update(JSON.stringify([fields.highWater ?? null, fields.lastOnlineAt ?? null, fields.transitionStart ?? null, fields.trustedAt ?? null])).digest("hex");

  // Bilgisayar kimliği: işletim sisteminden okunan değer kaydedilir; geçici bir okuma hatasında kayıtlı değer
  // kullanılır (kimlik bir anda değişip lisans "başka bilgisayarın" sayılmasın).
  const machine = (() => {
    const resolved = resolveMachineId({ dataDir, override: machineOverride, log });
    const cached = normalizeMachineId(store.setting(S.machine, ""));
    if ((resolved.source === "file" || resolved.source === "fallback") && cached) return { id: cached, source: "saved" };
    if (resolved.id !== cached) store.setSetting(S.machine, resolved.id);
    return resolved;
  })();

  // ---------- Yerel durum ----------
  // trustedAt: kabul edilen imzalı belirteçlerin en yeni düzenlenme zamanı (servis veya kod). Yalnızca ondan daha yeni
  // bir imzalı zaman, görülen en ileri zamanı geri çekebilir (yanlışlıkla ileri alınmış saat böyle düzelir; eski kodlarla
  // zaman geri alınamaz).
  let local = { highWater: null, lastOnlineAt: null, transitionStart: null, trustedAt: null, lastCheck: null };
  let tampered = false;
  function loadLocal() {
    let stored = {};
    try {
      stored = JSON.parse(store.setting(S.local, "") || "{}") || {};
    } catch {
      stored = { corrupt: true };
    }
    local = { highWater: toTime(stored.highWater), lastOnlineAt: toTime(stored.lastOnlineAt), transitionStart: toTime(stored.transitionStart), trustedAt: toTime(stored.trustedAt), lastCheck: stored.lastCheck || null };
    const hasFields = local.highWater != null || local.lastOnlineAt != null || local.transitionStart != null || local.trustedAt != null;
    if (stored.corrupt || (hasFields && stored.mac !== macOf(local))) {
      // Yerel kayıt değiştirilmiş: saat ve doğrulama bilgisi en sıkı hâle getirilir.
      tampered = true;
      log.warn?.("Lisans yerel kaydının bütünlük özeti tutmadı; en sıkı varsayımlar kullanılıyor.");
      audit(null, "license.tamper", "license", {});
      local = { highWater: Math.max(now(), local.highWater ?? 0), lastOnlineAt: null, transitionStart: local.transitionStart == null ? null : Math.min(local.transitionStart, now()), trustedAt: local.trustedAt, lastCheck: local.lastCheck };
      saveLocal();
    }
  }
  let savedHighWater = null;
  function saveLocal() {
    const fields = { highWater: local.highWater, lastOnlineAt: local.lastOnlineAt, transitionStart: local.transitionStart, trustedAt: local.trustedAt };
    store.setSetting(S.local, JSON.stringify({ ...fields, lastCheck: local.lastCheck, mac: macOf(fields) }));
    savedHighWater = local.highWater;
  }

  // ---------- Belirteç ----------
  let token = null;
  let tokenProblem = null;
  function loadToken() {
    token = null;
    tokenProblem = null;
    const raw = store.setting(S.token, "");
    if (!raw) return;
    try {
      const { claims } = verifyToken(JSON.parse(raw), trustedKeys);
      if (claims.machine !== machine.id) {
        tokenProblem = `Kayıtlı lisans başka bir bilgisayara ait. Sunucu başka bir bilgisayara taşındıysa lisansı bu bilgisayarda yeniden etkinleştirin (lisans taşıma için: ${CONTACT_TEXT}).`;
        return;
      }
      token = claims;
    } catch (error) {
      tokenProblem = "Kayıtlı lisans bilgisi doğrulanamadı.";
      log.warn?.("Kayıtlı lisans belirteci doğrulanamadı", error);
    }
  }
  function storeToken(envelope, claims) {
    store.setSetting(S.token, JSON.stringify(envelope));
    token = claims;
    tokenProblem = null;
  }
  // Servis ya da kod tarafından imzalanan zaman güvenilirdir. Şimdiye kadar görülen en yeni imzalı zamandan yeniyse görülen
  // en ileri zaman ona çekilir (ileri alınıp düzeltilmiş saat takılı kalmaz); daha eskiyse yalnızca ileri götürebilir.
  function trustTime(issuedAt, { fromService }) {
    const time = toTime(issuedAt);
    if (time == null) return;
    if (time >= (local.trustedAt ?? 0)) {
      local.highWater = time;
      local.trustedAt = time;
    } else local.highWater = Math.max(local.highWater ?? 0, time);
    if (fromService) local.lastOnlineAt = time;
  }

  // ---------- Değerlendirme ----------
  let last = null;
  function evaluate() {
    const current = now();
    const status = evaluateLicense({ token, tokenProblem, machineId: machine.id, local, now: current, graceDays, transitionDays });
    // Saat ileri gidiyorsa görülen en ileri zaman güncellenir (geri alınmışsa değişmez).
    if (current > (local.highWater ?? 0)) local.highWater = current;
    if (!enforce) status.writable = true;
    const changed = !last || last.state !== status.state || last.writable !== status.writable || last.severity !== status.severity || last.licenseId !== status.licenseId || last.expiresAt !== status.expiresAt;
    const previous = last;
    last = status;
    if (changed && previous) {
      audit(null, "license.state_changed", "license", { from: previous.state, to: status.state });
      log.info?.(`Lisans durumu: ${previous.state} → ${status.state}`);
      events?.publish("license.changed", summaryFor(null, status));
      try {
        onChange(status);
      } catch (error) {
        log.warn?.("Lisans değişikliği bildirilemedi", error);
      }
    }
    return status;
  }
  const status = () => evaluate();
  const writable = () => evaluate().writable;

  // ---------- Açılış ----------
  function init() {
    loadLocal();
    loadToken();
    if (!store.setting(S.initialized)) {
      // 2.0.0 öncesinden gelen ve kullanılmış kurulum: geçiş dönemi başlar (Faz 3 kararı).
      if (!token && usedBefore() && local.transitionStart == null) {
        local.transitionStart = now();
        audit(null, "license.transition_started", "license", { days: transitionDays });
        log.info?.(`Lisans geçiş dönemi başladı (${transitionDays} gün).`);
      }
      store.setSetting(S.initialized, version || "1");
    }
    if (local.highWater == null || now() > local.highWater) local.highWater = now();
    saveLocal();
    evaluate();
  }

  // ---------- Lisans servisi ----------
  const endpoints = () => (Array.isArray(services) ? services : String(services || "").split(",")).map(item => String(item).trim().replace(/\/+$/, "")).filter(Boolean);
  async function callService(path, body) {
    let lastError = null;
    for (const base of endpoints()) {
      let response;
      try {
        response = await fetchImpl(`${base}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "user-agent": `DestekOfis-Lisans/${version}` },
          body: JSON.stringify({ product: PRODUCT, version, machine: machine.id, instanceId: instanceId(), ...body }),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (error) {
        lastError = new LicenseError(networkMessage(error), "NETWORK");
        continue;
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        lastError = new LicenseError(`Lisans servisi beklenmeyen bir yanıt verdi (HTTP ${response.status}).`, "SERVICE_RESPONSE");
        continue;
      }
      if (payload?.ok && payload.token) return payload;
      if (payload && payload.ok === false && typeof payload.code === "string") {
        // Servisin reddi kesin bir yanıttır; diğer adresler denenmez.
        const message = SERVICE_MESSAGES[payload.code] || (typeof payload.error === "string" ? payload.error.slice(0, 300) : "Lisans servisi isteği kabul etmedi.");
        throw new LicenseError(message, payload.code);
      }
      lastError = new LicenseError(`Lisans servisi beklenmeyen bir yanıt verdi (HTTP ${response.status}).`, "SERVICE_RESPONSE");
    }
    throw lastError || new LicenseError("Lisans servisi adresi tanımlı değil.", "NO_SERVICE");
  }
  function acceptServiceToken(envelope, { kind = null, licenseId = null } = {}) {
    const { claims } = verifyToken(envelope, trustedKeys);
    if (claims.machine !== machine.id) throw new LicenseError("Lisans servisi başka bir bilgisayar için yanıt verdi.", "MACHINE_MISMATCH");
    if (kind && claims.kind !== kind) throw new LicenseError("Lisans servisinin yanıtı beklenen türde değil.", "KIND_MISMATCH");
    if (licenseId && claims.licenseId !== licenseId) throw new LicenseError("Lisans servisinin yanıtı bu lisansa ait değil.", "LICENSE_MISMATCH");
    return claims;
  }

  let checking = null;
  async function check({ manual = false, user = null } = {}) {
    if (!token) {
      if (manual) throw new HttpError(409, "Doğrulanacak bir lisans yok. Önce denemeyi başlatın veya lisansınızı girin.");
      return status();
    }
    if (checking) return checking;
    checking = (async () => {
      const at = iso(now());
      try {
        const payload = await callService("/v1/check", { licenseId: token.licenseId, kind: token.kind });
        // Operatör bu bilgisayara panelden lisans verdiyse servis farklı numaralı bir LİSANS belirteci döndürür:
        // deneme lisansa, eski lisans yenisine dönüşür (bilgisayar ve imza yine denetlenir). Deneme belirteci ise
        // yalnızca aynı numarayla kabul edilir.
        const claims = acceptServiceToken(payload.token);
        if (claims.licenseId !== token.licenseId && claims.kind !== "license") {
          throw new LicenseError("Lisans servisinin yanıtı bu lisansa ait değil.", "LICENSE_MISMATCH");
        }
        const previous = token.licenseId;
        storeToken(payload.token, claims);
        if (claims.licenseId !== previous) audit(user, "license.assigned", claims.licenseId, { previous, customer: claims.customer, expiresAt: claims.expiresAt });
        trustTime(claims.issuedAt, { fromService: true });
        local.lastCheck = { at, ok: true };
        saveLocal();
        if (manual) audit(user, "license.checked", claims.licenseId, { status: claims.status, expiresAt: claims.expiresAt });
        return { ok: true };
      } catch (error) {
        local.lastCheck = { at, ok: false, message: error.message };
        saveLocal();
        if (manual) audit(user, "license.checked", token?.licenseId || "license", { error: error.message });
        log.warn?.(`Lisans doğrulanamadı: ${error.message}`);
        return { ok: false, error };
      } finally {
        checking = null;
      }
    })();
    const result = await checking;
    const current = status();
    if (manual && !result.ok) throw new HttpError(502, result.error.message, { license: summaryFor(user) });
    return current;
  }

  async function startTrial(details = {}, user) {
    const current = status();
    if (token && current.state === "licensed") throw new HttpError(409, "Bu kurulum zaten lisanslı.");
    if (token && current.state === "trial") return current;
    const office = {
      name: String(details.officeName ?? store.setting("office.name", "") ?? "").trim().slice(0, 120),
      contact: String(details.contact ?? "").trim().slice(0, 120),
      email: String(details.email ?? "").trim().slice(0, 160),
      phone: String(details.phone ?? "").trim().slice(0, 40),
    };
    let payload;
    try {
      payload = await callService("/v1/activate", { kind: "trial", office });
    } catch (error) {
      throw new HttpError(error.code === "NETWORK" || error.code === "SERVICE_RESPONSE" || error.code === "NO_SERVICE" ? 502 : 409, error.message, { code: error.code });
    }
    const claims = acceptServiceToken(payload.token, { kind: "trial" });
    storeToken(payload.token, claims);
    trustTime(claims.issuedAt, { fromService: true });
    local.lastCheck = { at: iso(now()), ok: true };
    saveLocal();
    audit(user, "license.trial_started", claims.licenseId, { expiresAt: claims.expiresAt, office: office.name, auto: !user });
    return status();
  }

  async function activateKey(rawKey, user) {
    const key = normalizeLicenseKey(rawKey);
    if (!key) throw new HttpError(400, "Lisans anahtarı DO-XXXXX-XXXXX-XXXXX-XXXXX biçiminde olmalı.");
    let payload;
    try {
      payload = await callService("/v1/activate", { kind: "license", licenseKey: key });
    } catch (error) {
      throw new HttpError(error.code === "NETWORK" || error.code === "SERVICE_RESPONSE" || error.code === "NO_SERVICE" ? 502 : 409, error.message, { code: error.code });
    }
    const claims = acceptServiceToken(payload.token, { kind: "license" });
    storeToken(payload.token, claims);
    trustTime(claims.issuedAt, { fromService: true });
    local.lastCheck = { at: iso(now()), ok: true };
    saveLocal();
    audit(user, "license.activated", claims.licenseId, { customer: claims.customer, expiresAt: claims.expiresAt });
    return status();
  }

  // ---------- Denemenin 3. gününde iletişim bilgisi ----------
  // Programı denemenin 3. gününde hâlâ açan yöneticiye firma adı ve iletişim bilgisi sorulur (kullanmaya devam etme
  // isteğinin işareti). Bilgi doğrulama isteğiyle lisans servisine gider ve operatör merkezinde görünür.
  const contactInfo = () => {
    try {
      return JSON.parse(store.setting(S.contact, "") || "null");
    } catch {
      return null;
    }
  };
  function askContact(current = evaluate()) {
    if (!enforce || !token || token.kind !== "trial" || current.state !== "trial" || contactInfo()) return false;
    const started = toTime(token.startsAt);
    return started != null && now() - started >= contactAfterDays * DAY;
  }
  async function submitContact(details = {}, user) {
    if (!token) throw new HttpError(409, "Önce ücretsiz denemenin başlaması gerekir.");
    const office = {
      name: String(details.companyName ?? "").trim().slice(0, 120),
      contact: String(details.contact ?? "").trim().slice(0, 120),
      email: String(details.email ?? "").trim().slice(0, 160),
      phone: String(details.phone ?? "").trim().slice(0, 40),
    };
    if (!office.name) throw new HttpError(400, "Firma adını yazın.");
    if (!office.phone && !office.email) throw new HttpError(400, "Size ulaşabilmemiz için telefon veya e-posta yazın.");
    if (office.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(office.email)) throw new HttpError(400, "E-posta adresi geçerli görünmüyor.");
    let payload;
    try {
      payload = await callService("/v1/check", { licenseId: token.licenseId, kind: token.kind, office });
    } catch (error) {
      throw new HttpError(error.code === "NETWORK" || error.code === "SERVICE_RESPONSE" || error.code === "NO_SERVICE" ? 502 : 409, `Bilgiler gönderilemedi: ${error.message}`, { code: error.code });
    }
    const claims = acceptServiceToken(payload.token);
    if (claims.licenseId !== token.licenseId && claims.kind !== "license") throw new HttpError(502, "Lisans servisinin yanıtı bu lisansa ait değil.");
    storeToken(payload.token, claims);
    trustTime(claims.issuedAt, { fromService: true });
    local.lastCheck = { at: iso(now()), ok: true };
    saveLocal();
    store.setSetting(S.contact, JSON.stringify({ at: iso(now()), name: office.name }));
    if (!String(store.setting("office.name", "") || "").trim()) store.setSetting("office.name", office.name);
    audit(user, "license.contact_sent", claims.licenseId, { company: office.name });
    return status();
  }

  // ---------- Kendiliğinden başlayan deneme ----------
  // Yeni kurulumda (lisans ve geçiş dönemi yoksa) 30 günlük deneme program açılınca kendiliğinden başlar; internet
  // yoksa artan aralıklarla (3 sn, 2 dk, 10 dk, sonra 30 dk'da bir) yeniden denenir.
  const autoState = { attempts: 0, lastError: null, lastAt: null, running: false };
  const shouldAutoTrial = () => enforce && autoTrial && !token && local.transitionStart == null;
  let autoTimer = null;
  function scheduleAutoTrial(delay) {
    clearTimeout(autoTimer);
    if (!shouldAutoTrial()) return;
    autoTimer = setTimeout(async () => {
      if (!shouldAutoTrial() || autoState.running) return;
      autoState.running = true;
      autoState.attempts += 1;
      autoState.lastAt = iso(now());
      try {
        await startTrial({}, null);
        autoState.lastError = null;
        log.info?.("Ücretsiz deneme kendiliğinden başladı.");
      } catch (error) {
        autoState.lastError = error.message;
        log.warn?.(`Ücretsiz deneme başlatılamadı: ${error.message}`);
        scheduleAutoTrial(autoTrialDelaysMs[autoState.attempts] ?? retryMs);
      } finally {
        autoState.running = false;
      }
    }, delay);
    autoTimer.unref?.();
  }

  // İnternetsiz etkinleştirme kodu (operatör aracıyla bu bilgisayarın kurulum koduna üretilir).
  function applyCode(code, user) {
    let claims;
    let envelope;
    try {
      envelope = decodeCode(code);
      claims = verifyToken(envelope, trustedKeys).claims;
    } catch (error) {
      throw new HttpError(400, error instanceof LicenseError ? error.message : "Etkinleştirme kodu okunamadı.");
    }
    if (claims.machine !== machine.id) throw new HttpError(400, `Bu kod başka bir bilgisayar için üretilmiş. Bu sunucunun kurulum kodu: ${formatInstallCode(machine.id)}`);
    if (token && claims.licenseId === token.licenseId && Date.parse(claims.issuedAt) < Date.parse(token.issuedAt)) {
      throw new HttpError(409, `Bu kod, kurulu lisanstan daha eski. Güncel kodu bizden isteyin: ${CONTACT_TEXT}.`);
    }
    storeToken(envelope, claims);
    // Kod da imzalıdır: içindeki zaman saat geri alma denetiminde kullanılır. Kod internetli bir lisans içinse
    // (offline: false) 7 günlük tolerans kodun üretildiği andan başlar.
    trustTime(claims.issuedAt, { fromService: false });
    if (!claims.offline) local.lastOnlineAt = Math.max(local.lastOnlineAt ?? 0, Date.parse(claims.issuedAt));
    saveLocal();
    audit(user, "license.code_applied", claims.licenseId, { kind: claims.kind, customer: claims.customer, expiresAt: claims.expiresAt, offline: claims.offline });
    return status();
  }

  // ---------- Zamanlayıcılar ----------
  let checkTimer = null;
  let tickTimer = null;
  const scheduleCheck = delay => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(async () => {
      const result = token ? await check().then(() => local.lastCheck?.ok, () => false) : true;
      scheduleCheck(result === false ? retryMs : checkIntervalMs);
    }, delay);
    checkTimer.unref?.();
  };
  function start() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      evaluate();
      if ((local.highWater ?? 0) > (savedHighWater ?? 0)) saveLocal();
    }, tickMs);
    tickTimer.unref?.();
    scheduleCheck(firstCheckDelayMs);
    scheduleAutoTrial(autoTrialDelaysMs[0] ?? 3_000);
  }
  function stop() {
    clearTimeout(checkTimer);
    clearTimeout(autoTimer);
    clearInterval(tickTimer);
    tickTimer = null;
    try {
      if ((local.highWater ?? 0) > (savedHighWater ?? 0)) saveLocal();
    } catch {
      // veritabanı kapanıyor olabilir
    }
  }

  // ---------- Dışa açılan bilgiler ----------
  function summaryFor(user, current = evaluate()) {
    const brief = {
      state: current.state,
      writable: current.writable,
      severity: current.severity,
      kind: current.kind,
      title: current.title,
      message: current.message,
      daysLeft: current.daysLeft,
      expiresAt: current.expiresAt,
      customer: current.customer,
      transitionEndsAt: current.transitionEndsAt,
      contact: SUPPORT_CONTACT,
    };
    if (!user || user.role !== "admin") return brief;
    return {
      ...brief,
      licenseId: current.licenseId,
      offline: current.offline,
      lastOnlineAt: current.lastOnlineAt,
      graceUntil: current.graceUntil,
      reason: current.reason,
      installCode: formatInstallCode(machine.id),
      machineSource: machine.source,
      lastCheck: local.lastCheck,
      tampered,
      enforced: enforce,
      canStartTrial: !token || current.state === "none",
      autoTrial: shouldAutoTrial() ? { attempts: autoState.attempts, lastError: autoState.lastError, lastAt: autoState.lastAt } : null,
      askContact: askContact(current),
      contactGiven: Boolean(contactInfo()),
      companyName: String(store.setting("office.name", "") || ""),
    };
  }
  // Salt okunur modda yazma yetkileri ekranlarda gösterilmez.
  const permissionsFor = list => (writable() ? list : list.filter(permission => !WRITE_PERMISSIONS.includes(permission)));
  function assertWritable(method, pathname) {
    if (method === "GET" || method === "HEAD" || allowedWhenReadOnly(pathname)) return;
    const current = evaluate();
    if (current.writable) return;
    throw new HttpError(403, `${current.title}. Program salt okunur çalışıyor; bu işlem yapılamaz.`, { code: "LICENSE_READ_ONLY", license: summaryFor(null) });
  }

  return { init, start, stop, status, writable, summary: summaryFor, permissionsFor, assertWritable, check, startTrial, activateKey, applyCode, submitContact, machine: () => ({ ...machine, installCode: formatInstallCode(machine.id) }) };
}
