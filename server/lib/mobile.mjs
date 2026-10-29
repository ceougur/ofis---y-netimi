// Mobil görünüm (2.4.7 M1; docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md §3.1): telefon arayüzü (client/mobil/, kullanıcının DestekOfis Mobil v0.3 ekranları)
// programın İÇİNDE sunulur; ayrı süreç, ayrı port, ayrı ağ geçidi yok. Telefon yalnız /api/mobil/… uçlarını çağırır; bu dosya her mobil ucu
// programın MEVCUT bir ucuna çevirir (yöntem + yol + izinli parametreler). Yetki, şirket erişimi (hofCompany), oturum çerezi (hof_session),
// istek kaynağı denetimi (assertSameOrigin) ve lisans kuralı o ucun kendisinde aynen uygulanır — burada TEKRAR EDİLMEZ (tek kaynak).
// Bu katmanın kendi işi: (1) beyaz liste — listede olmayan yol 404, giriş/çıkış dışındaki her yazma isteği 405 (mobil SALT OKUNUR);
// (2) Raporlar'da yalnız MOBILE_REPORT_IDS (v0.3'ün izinli rapor listesi) ve raporun izinli parametreleri, değerleri doğrulanmış olarak;
// (3) iki yanıtın mobil biçimi (oturum özeti, rapor kataloğu). Dalga 2'de (uzaktan erişim) dışarıya YALNIZ /mobil/ ve /api/mobil/ açılır.
import { HttpError } from "./http.mjs";

// Raporlar sekmesinde görünen raporlar (v0.3 src/gateway.mjs MOBILE_REPORT_IDS ile aynı; 2.4.6 report-center.mjs'teki kimlikler).
export const MOBILE_REPORT_IDS = Object.freeze([
  "mizan", "cari-listesi", "cari-ekstre", "cari-hareketleri", "cari-tahsilat",
  "alacak-yaslandirma", "taksit-kartlari", "taksit-vadeleri", "geciken-taksitler", "taksit-tahsilatlari",
]);
const REPORT_IDS = new Set(MOBILE_REPORT_IDS);
// Rapor başına izinli süzgeçler (v0.3 reportParams; report-center.mjs raporun params alanıyla aynı: "range" → preset/from/to).
const REPORT_PARAMS = Object.freeze({
  mizan: ["preset", "from", "to", "type", "side"],
  "cari-listesi": ["type", "side"],
  "cari-ekstre": ["preset", "from", "to", "account", "items"],
  "cari-hareketleri": ["preset", "from", "to", "type"],
  "cari-tahsilat": ["preset", "from", "to", "type"],
  "alacak-yaslandirma": [],
  "taksit-kartlari": ["planStatus"],
  "taksit-vadeleri": ["preset", "from", "to"],
  "geciken-taksitler": [],
  "taksit-tahsilatlari": ["preset", "from", "to"],
});
const PRESETS = new Set(["today", "thisWeek", "thisMonth", "lastMonth", "thisYear", "lastYear", "last7", "last30", "last90", "next7", "next30", "next90", "all", "custom", "future"]);
const CHOICES = { type: ["customer", "supplier", "other"], side: ["debtor", "creditor", "nonzero", "zero", "overdue"], planStatus: ["active", "closed", "all"], items: ["1"] };

const ID = /^[\w-]{1,120}$/;
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const bad = message => new HttpError(400, message, { code: "mobile-param" });
const id = value => {
  if (!ID.test(String(value || ""))) throw bad("Geçersiz kayıt kimliği.");
  return value;
};

function reportQuery(reportId, input) {
  const out = new URLSearchParams();
  for (const key of REPORT_PARAMS[reportId]) {
    const raw = input.get(key);
    if (raw === null || raw === "") continue;
    if (key === "from" || key === "to") {
      if (!isDay(raw)) throw bad("Geçerli tarih gerekli.");
    } else if (key === "account") id(raw);
    else if (key === "preset") {
      if (!PRESETS.has(raw)) throw bad("Geçersiz dönem.");
    } else if (!CHOICES[key].includes(raw)) throw bad("Geçersiz süzgeç değeri.");
    out.set(key, raw);
  }
  if (out.get("from") && out.get("to") && out.get("from") > out.get("to")) throw bad("Tarih aralığı ters olamaz.");
  if (reportId === "cari-ekstre" && !out.get("account")) throw bad("Cari ekstre için cari seçilmeli.");
  return out;
}

// Liste uçlarının izinli parametreleri (ad → en çok uzunluk); limit telefonda en çok 100.
function listQuery(input, fields) {
  const out = new URLSearchParams();
  for (const [name, max] of Object.entries(fields)) {
    const raw = input.get(name);
    if (raw !== null && raw !== "") out.set(name, String(raw).trim().slice(0, max));
  }
  if ("limit" in fields) out.set("limit", String(Math.min(100, Math.max(1, Math.trunc(Number(out.get("limit"))) || 30))));
  if (out.has("offset")) out.set("offset", String(Math.max(0, Math.trunc(Number(out.get("offset"))) || 0)));
  return out;
}

// Sözleşme: mobil yol → programın ucu. transform: yanıtın mobil biçimi (yalnız 200 + ok:true yanıtta).
const ROUTES = [
  { method: "GET", path: /^\/api\/mobil\/session$/, target: () => "/api/auth/me", transform: "session", company: false },
  { method: "POST", path: /^\/api\/mobil\/session\/login$/, target: () => "/api/auth/login", company: false },
  { method: "POST", path: /^\/api\/mobil\/session\/logout$/, target: () => "/api/auth/logout", company: false },
  { method: "GET", path: /^\/api\/mobil\/reports$/, target: () => "/api/workspace/report-center", transform: "reports" },
  {
    method: "GET",
    path: /^\/api\/mobil\/reports\/([a-z0-9-]+)(?:\/(pdf|xlsx))?$/,
    target: ([reportId, format], query) => {
      if (!REPORT_IDS.has(reportId)) throw new HttpError(404, "Bu rapor mobil görünümde yok.", { code: "mobile-report" });
      const params = reportQuery(reportId, query);
      if (format === "pdf") params.set("download", "1");
      return [`/api/workspace/report-center/${reportId}${format ? `/${format}` : ""}`, params];
    },
  },
  { method: "GET", path: /^\/api\/mobil\/accounts$/, target: (_, query) => ["/api/workspace/accounts", listQuery(query, { q: 120, limit: 4, offset: 12, status: 20, type: 30 })] },
  { method: "GET", path: /^\/api\/mobil\/accounts\/search$/, target: (_, query) => ["/api/workspace/accounts/search", listQuery(query, { q: 120, type: 30 })] },
  { method: "GET", path: /^\/api\/mobil\/accounts\/([^/]+)\/statement\.pdf$/, target: ([account]) => `/api/workspace/accounts/${id(account)}/ekstre.pdf` },
  { method: "GET", path: /^\/api\/mobil\/accounts\/([^/]+)\/entries\/([^/]+)\/receipt\.pdf$/, target: ([account, entry]) => `/api/workspace/accounts/${id(account)}/entries/${id(entry)}/makbuz.pdf` },
  { method: "GET", path: /^\/api\/mobil\/accounts\/([^/]+)$/, target: ([account]) => `/api/workspace/accounts/${id(account)}` },
  { method: "GET", path: /^\/api\/mobil\/cash$/, target: () => "/api/workspace/cash" },
  { method: "GET", path: /^\/api\/mobil\/bank$/, target: () => "/api/workspace/bank/summary" },
  { method: "GET", path: /^\/api\/mobil\/bank\/accounts$/, target: () => "/api/workspace/bank/accounts" },
  { method: "GET", path: /^\/api\/mobil\/stock$/, target: (_, query) => ["/api/workspace/stock", listQuery(query, { q: 120, limit: 4, offset: 12, category: 60 })] },
  { method: "GET", path: /^\/api\/mobil\/stock\/([^/]+)$/, target: ([item]) => `/api/workspace/stock/${id(item)}` },
  // 2.4.7 M2 (docs/mobil/M2-TASARIM.md §6.10): Eylül özetinin iki bölümü için salt okunur uç — taksit özeti (Taksit Kartlarını Görme) ve ANLIK DURUM (yalnız
  // yönetici, overview.card). Yetki o uçların kendisinde.
  { method: "GET", path: /^\/api\/mobil\/plans$/, target: () => ["/api/workspace/plans", new URLSearchParams({ count: "1" })] },
  { method: "GET", path: /^\/api\/mobil\/overview$/, target: () => "/api/workspace/overview" },
];
// Yalnız uzaktan erişim dinleyicisinde (lib/mobile-remote.mjs) anlamlı uçlar: ofis ağında cihaz eşlenmez, giriş cihaza bağlanmaz (olağan oturum).
const REMOTE_ONLY = new Set(["/api/mobil/eslesme", "/api/mobil/session/challenge"]);
export const MOBILE_PREFIX = "/api/mobil/";
// Sözleşme matrisinin makinece okunur hâli (test ve belge için): mobil yol kalıbı → programın ucu.
export const MOBILE_CONTRACT = Object.freeze(ROUTES.map(route => ({ method: route.method, path: route.path.source })));

/**
 * Mobil isteği programın ucuna çevirir. Dönüş: { url, transform } (url: hedef yol + izinli sorgu + hofCompany). Beyaz liste dışı: HttpError.
 * method: isteğin yöntemi (HEAD, GET gibi işlenir). pathname/query: isteğin yolu ve sorgusu (URLSearchParams).
 */
export function resolveMobile(method, pathname, query) {
  const verb = method === "HEAD" ? "GET" : method;
  if (REMOTE_ONLY.has(pathname)) throw new HttpError(404, "Cihaz eşleme ve cihazlı giriş yalnız uzaktan bağlantı adresinden yapılır; ofis ağında olağan girişi kullanın.", { code: "mobile-remote-only" });
  let matchedPath = false;
  for (const route of ROUTES) {
    const found = route.path.exec(pathname);
    if (!found) continue;
    matchedPath = true;
    if (route.method !== verb) continue;
    const target = route.target(found.slice(1), query);
    const [path, params] = Array.isArray(target) ? target : [target, new URLSearchParams()];
    // Pencerenin şirketi: telefon her isteğe seçili şirketi ekler (company=); program bunu hofCompany ile okur ve kullanıcının o şirkete
    // erişimini denetler (app.mjs dispatch: company-forbidden / company-missing). Verilmezse kullanıcının seçili şirketi.
    if (route.company !== false) {
      const company = query.get("company");
      if (company) params.set("hofCompany", id(company));
    }
    const search = params.toString();
    return { url: search ? `${path}?${search}` : path, transform: route.transform || null };
  }
  if (matchedPath || verb !== "GET") throw new HttpError(405, "Mobil görünüm salt okunurdur; kayıt girişi masaüstü programdan yapılır.", { code: "mobile-read-only" });
  throw new HttpError(404, "Bu işlem mobil görünümde yok.", { code: "mobile-unknown" });
}

// Yanıtın mobil biçimi. session: oturum özeti (kullanıcı, görebildiği şirketler, seçili şirket; mobil yazma kapalı).
// reports: Raporlar sekmesinin kataloğu — kullanıcının programda görebildiği raporlardan yalnız MOBILE_REPORT_IDS.
export function transformMobile(kind, data) {
  if (kind === "session") {
    const companies = (Array.isArray(data?.companies) ? data.companies : []).filter(item => ID.test(String(item?.id || ""))).map(item => ({ id: item.id, code: item.code || "", name: item.name || "", current: item.current === true }));
    const current = companies.find(item => item.current) || companies[0] || null;
    return {
      user: { id: data?.id || "", username: data?.username || "", name: data?.name || "", roleLabel: data?.roleLabel || "", mustChangePassword: data?.mustChangePassword === true },
      office: { name: data?.office?.name || "" },
      companies,
      company: current?.id || "",
      writesEnabled: false,
    };
  }
  if (kind === "reports") {
    const list = Array.isArray(data?.reports) ? data.reports : [];
    return {
      reports: list.filter(report => REPORT_IDS.has(report.id)).map(({ id: reportId, group, title, description, params, preset, accountRequired }) => ({ id: reportId, group, title, description: description || "", params: params || [], preset: preset || "", accountRequired: accountRequired === true })),
      today: data?.today || "",
    };
  }
  return data;
}

// Yanıtı yakalayan küçük yanıt nesnesi (transform gereken iki uç için; ikili dosya yanıtları doğrudan akar). send()/ok() ile yazılan JSON'u tutar.
export function captureResponse() {
  const headers = {};
  const chunks = [];
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    getHeader: name => headers[String(name).toLowerCase()],
    removeHeader(name) {
      delete headers[String(name).toLowerCase()];
    },
    writeHead(status, extra = {}) {
      this.statusCode = status;
      for (const [name, value] of Object.entries(extra)) headers[name.toLowerCase()] = value;
      this.headersSent = true;
      return this;
    },
    write(chunk) {
      if (chunk !== undefined) chunks.push(Buffer.from(chunk));
      return true;
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk));
      this.headersSent = true;
      return this;
    },
    on() {
      return this;
    },
    once() {
      return this;
    },
  };
  return { res, headers, body: () => Buffer.concat(chunks) };
}

// Telefon tarayıcısı (2.4.7 M1: "telefonda masaüstü ekranı gelmez"): ana adres açılınca mobil görünüme yönlendirilir. Yalnız telefon imzası
// (iPhone/iPod, Android + Mobile, Windows Phone); tablet ve bilgisayar masaüstünü görür (tablet /mobil/ adresini de açabilir). "?masaustu=1" ile
// telefonda da masaüstü açılır.
const PHONE = /\b(iPhone|iPod|Windows Phone)\b|Android.*\bMobile\b/i;
export const isPhone = userAgent => PHONE.test(String(userAgent || ""));
