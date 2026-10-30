// Mobilden yazma — tahsilat, ödeme, taksit kartına tahsilat, stok girişi (2.4.7 M5; CLAUDE.md Açık iş MOBİL kararları; docs/2.4.7-IS-LISTESI.md
// "KARARLAR — M5 mobil yazma" S1–S8; bağımsız kâhin test/bagimsiz/mobil-yazma/).
//
// YENİ PARA MANTIĞI YOK. Her mobil yazma ucu programın masaüstünün kullandığı MEVCUT ucuna çevrilir (yöntem + yol + İZİNLİ alanlar) ve o uçtan olağan yoldan
// geçer: oturum (yerelde hof_session, uzakta cihaza bağlı uzak oturum — lib/mobile-remote.mjs kapısı ÖNCE), istek kaynağı, lisans (salt okunurda yazma yok),
// şirket erişimi (hofCompany → app.mjs dispatchApp: olmayan 409, yetkisiz 403), rol yetkisi, istek kimliği (bank.post; şirketin veri dosyasında request_keys),
// Kasa / banka eksi bakiye (Uyar / Engelle, "Yine de Kaydet" = cashForce), Benzer İşlem (similarOk), taksit kartı K8 (plan-paid / plan-overpay; "Fazlasını
// Avans Yaz" = overpay, yalnız plans.manage), dönem kilidi, ileri tarih, FIFO kapama. Böylece aynı iş masaüstünden ve telefondan girilince defter, Kasa, banka,
// fatura kapama ve taksit kartı aynıdır (eşdeğerlik — kâhin K1).
//
// Bu katmanın kendi işi yalnız BEYAZ LİSTE ve kullanıcı kararlarının telefona özgü kısıtları:
//   S1  Kapatılacak Fatura mobilde yok: tahsilat / ödeme bağsız girer, programın FIFO'su en eski açık borcu kapatır. Fatura (ya da iade) alanı taşıyan istek
//       REDDEDİLİR (400 mobile-field) — sessizce FIFO'ya çevrilmez.
//   S2  Çek / senet mobilde yok (yol yalnız Nakit, Havale / EFT, POS ya da Kredi Kartı; evrak ucu beyaz listede yok).
//   S3  Taksit kartına tahsilat var (programın taksit ucu; K8 aynen). Taksit seçimi yok: tahsilat kartın en eski açık taksidinden yazılır (masaüstünün
//       önerilen varsayılanı).
//   S4  "Yine de Kaydet" / Benzer İşlem onayı / "Fazlasını Avans Yaz" masaüstüyle AYNI soru ve yetki: telefon soruyu gösterir, kullanıcı onaylarsa aynı istek
//       kimliğiyle bayrakla yeniden gönderir (bayraklar istek kimliğinin içeriğine girmez — lib/idempotency.mjs VOLATILE).
//   S5  Eksi stok masaüstü gibi sorar (stok ucu; mobilde yalnız giriş olduğu için soru doğmaz).
//   S6  Tarih SUNUCUNUN TR günü: telefon tarih göndermez; tarih alanlı istek reddedilir (programın ucu tarih yoksa bugünü yazar — lib/period.mjs).
//   S7  24 saatten eski sonucu belirsiz istek telefondan yeniden gönderilmez (telefon kuralı: client/mobil/yazma-bekleyen.js; sunucu kimliği 30 gün hatırlar).
//   S8  Mobil stok hareketi yalnız GİRİŞ (parasız miktar girişi; çıkış / para yazan hareket alanı reddedilir).
// İstek kimliği (x-hof-request) mobil yazmada ZORUNLU: kopan bağlantıda telefon aynı kimlikle yeniden dener, ikinci kayıt açılmaz.
// Sunucu kapalıyken yazma yok: telefon isteği gönderemez (kuyruk yok; M3 şifreli özet sayfasında yazma ekranı kapalı — writesEnabled yalnız canlı oturumda).
import { Readable } from "node:stream";
import { HttpError, readJson, send } from "./http.mjs";

const ID = /^[\w-]{1,120}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{16,100}$/;
const FLAGS = new Set(["similarOk", "cashForce", "overpay"]);

// Kapalı alanların nedeni (kullanıcıya görünen ileti; alan adı yanıtta `field`).
const CLOSED = Object.freeze({
  invoiceId: "Mobilde Kapatılacak Fatura seçilmez: tahsilat ve ödeme carinin en eski açık borcunu kapatır. Belirli bir faturayı kapatmak için masaüstünden girin.",
  refundOf: "Mobilde iade geri ödemesi bağlanmaz; masaüstünden girin.",
  date: "Mobil işlemin tarihi ofis sunucusunun bugünüdür; telefondan tarih gönderilmez. Geçmiş tarihli kayıt masaüstünden girilir.",
  itemId: "Mobilde taksit seçilmez: tahsilat kartın en eski açık taksidine yazılır.",
  kind: "Mobil kayıt türü adresinden belirlenir; tür alanı gönderilmez.",
  pay: "Mobilde yalnız parasız stok girişi yapılır.",
  reason: "Mobilde yalnız stok girişi yapılır; iade ve çıkış masaüstünden girilir.",
  chequeId: "Mobilde çek / senet tahsilatı yok; evrak masaüstünden girilir.",
});
const fieldError = (field, message) => new HttpError(400, message || `Bu alan mobil kayıtta kullanılmaz (${String(field).slice(0, 40)}).`, { code: "mobile-field", field });

// Sözleşme: mobil yazma yolu → programın ucu. fields: izinli alanlar (gövdede başka alan 400). fixed: programın ucuna eklenen sabit alanlar.
// methods: izinli ödeme yolları (cash = Nakit, bank = Havale / EFT, card = tahsilatta POS / ödemede Kredi Kartı — kayıtlı değer card).
const ROUTES = Object.freeze([
  {
    name: "tahsilat",
    path: /^\/api\/mobil\/accounts\/([^/]+)\/tahsilat$/,
    target: id => `/api/workspace/accounts/${id}/entries`,
    fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk"],
    fixed: { kind: "in" },
    methods: ["cash", "bank", "card"],
    view: "account",
  },
  {
    name: "odeme",
    path: /^\/api\/mobil\/accounts\/([^/]+)\/odeme$/,
    target: id => `/api/workspace/accounts/${id}/entries`,
    fields: ["amount", "method", "bankAccountId", "note", "similarOk", "cashForce"],
    fixed: { kind: "out" },
    methods: ["cash", "bank", "card"],
    view: "account",
  },
  {
    name: "taksit",
    path: /^\/api\/mobil\/plans\/([^/]+)\/tahsilat$/,
    target: id => `/api/workspace/plans/${id}/entries`,
    fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk", "overpay"],
    fixed: { kind: "in" },
    methods: ["cash", "bank", "card"],
    view: "plan",
  },
  {
    name: "stok",
    path: /^\/api\/mobil\/stock\/([^/]+)\/giris$/,
    target: id => `/api/workspace/stock/${id}/moves`,
    fields: ["qty", "note"],
    fixed: { kind: "in", pay: "none" },
    methods: null,
    view: "stock",
  },
]);
// Yazma formlarının salt okunur seçicisi (lib/mobile.mjs beyaz listesine eklenir): banka hesabı / kredi kartı / POS seçenekleri — masaüstü formlarının
// kullandığı uç (seçici izinleri ve bakiye görünürlüğü o uçta).
export const MOBILE_WRITE_READ_ROUTES = Object.freeze([{ method: "GET", path: /^\/api\/mobil\/bank\/choices$/, target: () => "/api/workspace/bank/choices" }]);
export const MOBILE_WRITE_CONTRACT =Object.freeze(ROUTES.map(route => ({ name: route.name, method: "POST", path: route.path.source, fields: [...route.fields] })));

const pathOf = rawUrl => String(rawUrl || "").split("?")[0];
/** İstek bir mobil yazma ucuna mı (POST + yol beyaz listede)? Uymayan her yazma lib/mobile.mjs'te 405 (salt okunur) kalır. */
export function matchMobileWrite(method, rawUrl) {
  if (method !== "POST") return null;
  const path = pathOf(rawUrl);
  for (const route of ROUTES) {
    const found = route.path.exec(path);
    if (found) return { route, id: found[1] };
  }
  return null;
}

/** Telefonun gövdesi → programın ucunun gövdesi. Kapalı ya da bilinmeyen alan 400 (sessizce düşürülmez — kâhin V4). */
export function mobileWriteBody(route, input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = { ...route.fixed };
  for (const [key, value] of Object.entries(body)) {
    if (!route.fields.includes(key)) throw fieldError(key, CLOSED[key]);
    if (FLAGS.has(key)) {
      if (value === true) out[key] = true;
      else if (value !== false && value !== undefined && value !== null) throw fieldError(key, "Onay alanı yalnız evet / hayır olabilir.");
      continue;
    }
    if (value !== undefined && value !== null && typeof value !== "string" && typeof value !== "number") throw fieldError(key, "Alan değeri geçersiz.");
    if (value !== undefined && value !== null) out[key] = value;
  }
  if (route.methods) {
    const method = out.method === undefined || out.method === "" ? "cash" : String(out.method);
    if (!route.methods.includes(method)) throw fieldError("method", "Mobilde ödeme yolu Nakit, Havale / EFT ya da POS / Kredi Kartı olabilir; çek / senet masaüstünden girilir.");
    out.method = method;
    out.amount = mobileAmount(out.amount);
  }
  return out;
}

// Tutar (banka planı §9.2/9 "en çok 2 ondalık"): telefon tutarı tek biçimde gönderir — "1234,56" (virgül, en çok 2 ondalık, binlik ayırıcısız) ya da en çok 2
// ondalıklı sayı. Biçim dışı tutar YUVARLANMAZ, sessizce yorumlanmaz ("12,345" → 12,35; "1.234" → 1234 olmasın): 400. Sıfır / eksi / üst sınır programın ucunda.
const AMOUNT = /^\d{1,13}(,\d{1,2})?$/;
function mobileAmount(value) {
  if (typeof value === "number" && Number.isFinite(value) && /^-?\d{1,13}(\.\d{1,2})?$/.test(String(value))) return String(value).replace(".", ",");
  if (typeof value === "string" && AMOUNT.test(value.trim())) return value.trim();
  throw new HttpError(400, "Tutarı en çok iki ondalıkla, binlik ayırıcısız yazın (ör. 1250,50).", { code: "mobile-amount", field: "amount" });
}

// Programın ucunun yanıtı → telefonun kısa yanıtı (kayıt kimliği, yineleme, makbuz, güncel bakiye). Para hesabı burada YAPILMAZ: değerler ucun kendi yanıtından.
function compact(view, data) {
  if (view === "account") {
    const entry = (Array.isArray(data?.entries) ? data.entries : []).find(item => item.id === data?.entryId) || null;
    return {
      entryId: data?.entryId || "",
      replayed: data?.replayed === true,
      receiptNo: entry?.receiptNo ?? null,
      date: entry?.date || "",
      account: { id: data?.id || "", name: data?.name || "", balance: data?.totals?.balance ?? null },
    };
  }
  if (view === "plan") {
    const entry = (Array.isArray(data?.entries) ? data.entries : []).find(item => item.id === data?.entryId) || null;
    return {
      entryId: data?.entryId || "",
      replayed: data?.replayed === true,
      receiptNo: entry?.receiptNo ?? null,
      date: entry?.date || "",
      plan: { id: data?.id || "", name: data?.name || "", accountId: data?.accountId || "", total: data?.totals?.total ?? null, paid: data?.totals?.paid ?? null, remaining: data?.totals?.remaining ?? null, extra: data?.totals?.extra ?? null },
    };
  }
  const move = (Array.isArray(data?.moves) ? data.moves : []).find(item => item.id === data?.moveId) || null;
  return { moveId: data?.moveId || "", replayed: data?.replayed === true, date: move?.date || "", item: { id: data?.id || "", name: data?.name || "", qty: data?.qty ?? null, unit: data?.unit || "" } };
}

// Programın ucuna giden istek: aynı bağlantı (adres, uzak işaretleri, çerez, istek kaynağı başlıkları), yeni yol ve izinli gövde.
function forwarded(req, url, body) {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  const stream = Readable.from([payload]);
  stream.method = "POST";
  stream.url = url;
  stream.headers = { ...req.headers, "content-type": "application/json", "content-length": String(payload.length) };
  stream.httpVersion = req.httpVersion;
  stream.socket = req.socket;
  stream.connection = req.socket;
  // Uzak isteğin işaretleri (lib/http.mjs REMOTE_REQUEST / REMOTE_SESSION) aynen taşınır: uç oturumu uzak oturumdan çözer, istek "yerel" sayılmaz.
  for (const symbol of Object.getOwnPropertySymbols(req)) {
    if (String(symbol.description || "").startsWith("destekofis.")) stream[symbol] = req[symbol];
  }
  return stream;
}

// Telefonun oturum özetindeki yazma hakları (yalnız ekran: düğmeleri gösterir; asıl denetim programın ucunda). Lisans salt okunurken yetki listesi zaten
// yazma yetkisi taşımaz (lib/license.mjs) → yazma kapalı görünür.
export function mobileWriteRights(permissions) {
  const has = new Set(Array.isArray(permissions) ? permissions : []);
  const writes = { tahsilat: has.has("accounts.collect"), odeme: has.has("accounts.manage"), taksit: has.has("plans.collect"), avans: has.has("plans.manage"), stok: has.has("stock.move") };
  return { writesEnabled: Object.values(writes).some(Boolean), writes };
}

/**
 * Mobil yazma isteğini programın ucuna çevirir ve sonucunu telefonun biçiminde yazar. dispatchApp: app.mjs'in olağan dağıtıcısı (şirket seçimi hofCompany ile).
 * Telefon her yazma isteğinde şirketi (company=) ve istek kimliğini (x-hof-request) gönderir; ikisi de zorunlu.
 */
export async function dispatchMobileWrite(req, res, dispatchApp, matched = matchMobileWrite(req.method, req.url)) {
  try {
    if (!matched) throw new HttpError(404, "Bu işlem mobil görünümde yok.", { code: "mobile-unknown" });
    const { route, id } = matched;
    if (!ID.test(id)) throw new HttpError(400, "Geçersiz kayıt kimliği.", { code: "mobile-param" });
    const query = new URL(req.url || "/", "http://x").searchParams;
    const company = query.get("company") || "";
    if (!ID.test(company)) throw new HttpError(400, "Kaydın yazılacağı şirket seçilmeli; sayfayı yenileyin.", { code: "mobile-company" });
    const requestId = String(req.headers["x-hof-request"] || "");
    if (!REQUEST_ID.test(requestId)) throw new HttpError(400, "İstek kimliği eksik ya da geçersiz; sayfayı yenileyip yeniden deneyin.", { code: "mobile-request-id" });
    const body = mobileWriteBody(route, await readJson(req, { limit: 16_384 }));
    const fwd = forwarded(req, `${route.target(id)}?hofCompany=${encodeURIComponent(company)}`, body);
    const captured = captureJson();
    await dispatchApp(fwd, captured.res);
    const payload = captured.json();
    const passHeaders = Object.fromEntries(Object.entries(captured.headers).filter(([name]) => !["content-length", "content-type", "content-encoding"].includes(name)));
    if (!payload) return send(res, captured.res.statusCode === 200 ? 502 : captured.res.statusCode, { ok: false, error: "Sunucu yanıtı okunamadı." }, passHeaders);
    if (captured.res.statusCode !== 200 || payload.ok !== true) return send(res, captured.res.statusCode, payload, passHeaders);
    return send(res, 200, { ok: true, data: { kind: route.name, ...compact(route.view, payload.data) } }, passHeaders);
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { ok: false, error: error.message, ...error.extra });
    throw error;
  }
}

// Programın ucunun JSON yanıtını yakalayan küçük yanıt nesnesi (lib/mobile.mjs captureResponse'un eşi; lib/mobile.mjs bu dosyayı içe aktardığı için döngüsel
// içe aktarma kurulmaz).
function captureJson() {
  const headers = {};
  const chunks = [];
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader: (name, value) => void (headers[String(name).toLowerCase()] = value),
    getHeader: name => headers[String(name).toLowerCase()],
    removeHeader: name => void delete headers[String(name).toLowerCase()],
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
  const json = () => {
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return null;
    }
  };
  return { res, headers, json };
}
