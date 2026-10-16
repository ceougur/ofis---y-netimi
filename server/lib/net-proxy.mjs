// Vekil sunucu (proxy) desteği (kullanıcı kararı 16.10.2026: "yap"). Programın dışarı çıkan BÜTÜN istekleri (otomatik güncelleme, lisans,
// Google E-Tablolar, e-Belge entegratörü) bu modülün fetch'inden geçer. Neden kendi modülümüz: program Windows'ta "NT SERVICE\DestekOfis"
// hizmet hesabıyla çalışır, kullanıcının tarayıcı vekil ayarını görmez; Node'un yerleşik vekil özelliği (NODE_USE_ENV_PROXY) süreç başlarken
// açılmak zorundadır ve ayar değişince yeniden başlatma ister. Bu modül ayarı her istekte (önbellekli) okur — değişiklik hemen geçerli olur.
//
// Ayarın sırası (ilk bulunan):
//   1. Program ayarı (ağ ayarı dosyası, Entegratör Ayarları → Vekil Sunucu): "none" = doğrudan; "manual" = yazılan adres.
//   2. Ortam değişkeni: HTTPS_PROXY / HTTP_PROXY (+ NO_PROXY).
//   3. Windows makine geneli vekil ayarı (WinHTTP; "netsh winhttp set proxy" ya da Grup İlkesi) — hizmetlerin okuduğu ayar.
//   4. Yoksa doğrudan.
// Yerel adresler (localhost, 127.x, ::1, ofis içi tek parça adlar <local> kuralında) her zaman doğrudan gider.
// Sınır: otomatik yapılandırma betiği (PAC / WPAD) desteklenmez; o ağlarda adres elle yazılır.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import tls from "node:tls";

const ALWAYS_DIRECT = ["localhost", "127.0.0.1", "::1"];
export const NETWORK_MODES = Object.freeze({ auto: "Otomatik (Windows ayarı)", manual: "Elle", none: "Vekil Sunucu Kullanma" });

/** "vekil:8080", "http://kullanici:parola@vekil:8080", WinHTTP "http=a:1;https=b:2" → { http, https } tam adres (http://…). */
export function normalizeProxy(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const withScheme = value => {
    const v = value.trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, "");
    if (/^socks/i.test(v)) return "";
    return `http://${v.replace(/\/+$/, "")}`;
  };
  if (raw.includes("=")) {
    const parts = Object.fromEntries(
      raw
        .split(/[;\s]+/)
        .filter(item => item.includes("="))
        .map(item => {
          const [key, ...rest] = item.split("=");
          return [key.trim().toLowerCase(), withScheme(rest.join("="))];
        }),
    );
    const any = parts.https || parts.http || "";
    return any ? { http: parts.http || any, https: parts.https || any } : null;
  }
  const one = withScheme(raw.split(/[;\s]+/)[0]);
  if (!one) return null;
  try {
    const url = new URL(one);
    if (!url.hostname) return null;
  } catch {
    return null;
  }
  return { http: one, https: one };
}

/** NO_PROXY / WinHTTP bypass listesi ("<local>;*.firma.local;10.*", virgül ya da noktalı virgül) → kurallar. */
export function parseBypass(text) {
  return String(text || "")
    .split(/[;,\s]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

/** Bu ana bilgisayar vekil sunucudan geçmeden mi gidecek? */
export function isBypassed(hostname, rules = []) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (ALWAYS_DIRECT.includes(host) || /^127\./.test(host)) return true;
  for (const rule of rules) {
    if (rule === "*") return true;
    if (rule === "<local>" && !host.includes(".") && !host.includes(":")) return true;
    if (rule.startsWith("*.") && (host.endsWith(rule.slice(1)) || host === rule.slice(2))) return true;
    if (rule.startsWith(".") && (host.endsWith(rule) || host === rule.slice(1))) return true;
    if (rule.endsWith("*") && host.startsWith(rule.slice(0, -1))) return true;
    if (host === rule) return true;
  }
  return false;
}

/**
 * Windows WinHTTP vekil ayarı (HKLM\…\Internet Settings\Connections, REG_BINARY "WinHttpSettings"). Düzen: DWORD sürüm, DWORD sayaç,
 * DWORD bayrak (1 doğrudan, 3 vekil), DWORD uzunluk + vekil adresi (ASCII), DWORD uzunluk + bypass listesi.
 */
export function parseWinHttpSettings(hex) {
  const buffer = Buffer.from(String(hex || "").replace(/[^0-9a-f]/gi, ""), "hex");
  if (buffer.length < 16) return null;
  const flags = buffer.readUInt32LE(8);
  const proxyLength = buffer.readUInt32LE(12);
  if (!(flags & 2) || !proxyLength || 16 + proxyLength > buffer.length) return null;
  const proxy = buffer.subarray(16, 16 + proxyLength).toString("latin1");
  const bypassAt = 16 + proxyLength;
  const bypassLength = buffer.length >= bypassAt + 4 ? buffer.readUInt32LE(bypassAt) : 0;
  const bypass = bypassLength ? buffer.subarray(bypassAt + 4, bypassAt + 4 + bypassLength).toString("latin1") : "";
  return { proxy, bypass };
}

export function readWindowsProxy({ platform = process.platform, run = execFileSync } = {}) {
  if (platform !== "win32") return null;
  try {
    const out = run("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\\Connections", "/v", "WinHttpSettings"], { encoding: "utf8", timeout: 4000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const match = String(out).match(/WinHttpSettings\s+REG_BINARY\s+([0-9A-F]+)/i);
    return match ? parseWinHttpSettings(match[1]) : null;
  } catch {
    return null;
  }
}

export const DEFAULT_NETWORK = Object.freeze({ mode: "auto", proxy: "", bypass: "" });
export function readNetworkSettings(file) {
  if (!file || !existsSync(file)) return { ...DEFAULT_NETWORK };
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return { mode: NETWORK_MODES[raw.mode] ? raw.mode : "auto", proxy: String(raw.proxy || ""), bypass: String(raw.bypass || "") };
  } catch {
    return { ...DEFAULT_NETWORK };
  }
}
export function writeNetworkSettings(file, settings) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ mode: settings.mode, proxy: settings.proxy || "", bypass: settings.bypass || "" }, null, 2)}\n`);
  renameSync(temp, file);
}

/**
 * Etkin vekil: { proxy: { http, https } | null, bypass: [kurallar], source: 'manual'|'env'|'windows'|'none'|'direct' }.
 * @param {{ file?: string, env?: object, platform?: string, windows?: () => ({proxy, bypass}|null) }} options
 */
export function resolveProxy({ file = "", env = process.env, platform = process.platform, windows = () => readWindowsProxy({ platform }) } = {}) {
  const settings = readNetworkSettings(file);
  const extra = parseBypass(settings.bypass);
  if (settings.mode === "none") return { proxy: null, bypass: [], source: "none" };
  if (settings.mode === "manual") {
    const proxy = normalizeProxy(settings.proxy);
    return proxy ? { proxy, bypass: extra, source: "manual" } : { proxy: null, bypass: [], source: "direct" };
  }
  const envProxy = normalizeProxy(env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || "");
  if (envProxy) return { proxy: envProxy, bypass: [...extra, ...parseBypass(env.NO_PROXY || env.no_proxy || "")], source: "env" };
  const win = windows();
  const winProxy = win ? normalizeProxy(win.proxy) : null;
  if (winProxy) return { proxy: winProxy, bypass: [...extra, ...parseBypass(win.bypass)], source: "windows" };
  return { proxy: null, bypass: [], source: "direct" };
}

export class ProxyError extends Error {
  constructor(message, { code = "proxy-error", status = 502 } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const headerObject = headers => {
  if (!headers) return {};
  if (typeof headers.entries === "function") return Object.fromEntries(headers.entries());
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
};
const bodyBuffer = body => {
  if (body === undefined || body === null) return null;
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  throw new TypeError("Vekil sunucu üzerinden bu tür istek gövdesi gönderilemez.");
};
const proxyAuth = proxyUrl => (proxyUrl.username ? `Basic ${Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString("base64")}` : null);
const abortError = signal => signal?.reason instanceof Error ? signal.reason : Object.assign(new Error("İstek iptal edildi."), { name: "AbortError" });

function tunnel(proxyUrl, target, signal) {
  return new Promise((resolve, reject) => {
    const auth = proxyAuth(proxyUrl);
    const request = http.request({
      host: proxyUrl.hostname,
      port: Number(proxyUrl.port) || 80,
      method: "CONNECT",
      path: `${target.hostname}:${Number(target.port) || 443}`,
      headers: { host: `${target.hostname}:${Number(target.port) || 443}`, ...(auth ? { "proxy-authorization": auth } : {}) },
      agent: false,
    });
    const onAbort = () => request.destroy(abortError(signal));
    signal?.addEventListener("abort", onAbort, { once: true });
    request.once("connect", (response, socket) => {
      signal?.removeEventListener("abort", onAbort);
      if (response.statusCode === 200) return resolve(socket);
      socket.destroy();
      reject(response.statusCode === 407 ? new ProxyError("Vekil sunucu kimlik doğrulaması istiyor (407). Vekil Sunucu adresine kullanıcı adı ve parolayı yazın (http://kullanici:parola@sunucu:port).", { code: "proxy-auth", status: 502 }) : new ProxyError(`Vekil sunucu bağlantıyı reddetti (${response.statusCode}).`, { code: "proxy-refused", status: 502 }));
    });
    request.once("error", error => {
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.aborted ? abortError(signal) : new ProxyError(`Vekil sunucuya bağlanılamadı (${proxyUrl.host}): ${error.code || error.message}`, { code: "proxy-unreachable", status: 502 }));
    });
    request.end();
  });
}

async function viaProxy(target, init, proxyText, { tlsOptions = {} } = {}) {
  const proxyUrl = new URL(proxyText);
  const method = String(init.method || "GET").toUpperCase();
  const headers = headerObject(init.headers);
  const body = bodyBuffer(init.body);
  if (body && headers["content-length"] === undefined) headers["content-length"] = String(body.length);
  const signal = init.signal;
  if (signal?.aborted) throw abortError(signal);
  let request;
  if (target.protocol === "http:") {
    const auth = proxyAuth(proxyUrl);
    request = http.request({ host: proxyUrl.hostname, port: Number(proxyUrl.port) || 80, method, path: target.href, headers: { host: target.host, ...headers, ...(auth ? { "proxy-authorization": auth } : {}) }, agent: false });
  } else {
    const socket = await tunnel(proxyUrl, target, signal);
    request = https.request({
      host: target.hostname,
      port: Number(target.port) || 443,
      method,
      path: `${target.pathname}${target.search}`,
      headers: { host: target.host, ...headers },
      // agent verilmez: agent:false olunca Node yeni bir Agent açar ve createConnection'ı yok sayıp hedefi DNS'te arar (ENOTFOUND).
      createConnection: () => tls.connect({ socket, servername: target.hostname, ...tlsOptions }),
    });
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => request.destroy(abortError(signal));
    signal?.addEventListener("abort", onAbort, { once: true });
    request.once("response", response => {
      // İptal sinyali gövde bitene dek geçerli kalır (güncelleme paketi indirmesindeki süre sınırı gövdeyi de keser).
      response.once("close", () => signal?.removeEventListener("abort", onAbort));
      if (target.protocol === "http:" && response.statusCode === 407) {
        response.resume();
        return reject(new ProxyError("Vekil sunucu kimlik doğrulaması istiyor (407). Vekil Sunucu adresine kullanıcı adı ve parolayı yazın (http://kullanici:parola@sunucu:port).", { code: "proxy-auth" }));
      }
      const out = new Headers();
      for (const [key, value] of Object.entries(response.headers)) for (const item of [].concat(value)) out.append(key, String(item));
      const empty = method === "HEAD" || [204, 304].includes(response.statusCode);
      if (empty) response.resume();
      resolve(new Response(empty ? null : Readable.toWeb(response), { status: response.statusCode, statusText: response.statusMessage || "", headers: out }));
    });
    request.once("error", error => {
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.aborted ? abortError(signal) : error instanceof ProxyError ? error : new ProxyError(`Vekil sunucu üzerinden istek kurulamadı: ${error.code || error.message}`, { code: "proxy-request" }));
    });
    if (body) request.write(body);
    request.end();
  });
}

/**
 * fetch ile aynı imza. resolve(): resolveProxy sonucu (her istekte; önbelleği çağıran tutar). Vekil yoksa ya da adres yerelse baseFetch.
 * Yönlendirme (redirect: "follow", varsayılan) vekil üzerinden en çok 10 kez izlenir; 303'te GET.
 */
export function createProxyFetch({ resolve = () => resolveProxy(), baseFetch = (...args) => globalThis.fetch(...args), tlsOptions = {} } = {}) {
  return async function proxyFetch(input, init = {}) {
    const first = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
    const state = resolve();
    if (!state?.proxy || isBypassed(first.hostname, state.bypass) || !/^https?:$/.test(first.protocol)) return baseFetch(input, init);
    let target = first;
    let options = { ...init };
    for (let hop = 0; hop <= 10; hop += 1) {
      const proxyText = target.protocol === "https:" ? state.proxy.https : state.proxy.http;
      const response = await viaProxy(target, options, proxyText, { tlsOptions });
      const location = response.headers.get("location");
      if (options.redirect === "manual" || !location || ![301, 302, 303, 307, 308].includes(response.status)) return response;
      await response.body?.cancel().catch(() => {});
      target = new URL(location, target);
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && String(options.method || "GET").toUpperCase() === "POST")) options = { ...options, method: "GET", body: undefined };
      if (isBypassed(target.hostname, state.bypass)) return baseFetch(target.href, options);
    }
    throw new ProxyError("Vekil sunucu üzerinden çok fazla yönlendirme.", { code: "proxy-redirects" });
  };
}

/** Önbellekli çözücü: Windows kayıt defteri en çok dakikada bir okunur; ayar dosyası her istekte (küçük, ucuz). */
export function cachedResolver({ file = "", env = process.env, platform = process.platform, windowsTtlMs = 60_000, now = () => Date.now(), readWindows = () => readWindowsProxy({ platform }) } = {}) {
  let windowsValue = null;
  let windowsAt = -Infinity;
  const windows = () => {
    if (now() - windowsAt > windowsTtlMs) {
      windowsValue = readWindows();
      windowsAt = now();
    }
    return windowsValue;
  };
  return () => resolveProxy({ file, env, platform, windows });
}

/** Elle ayar için adres + kullanıcı + parola → vekil adresi (http://kullanici:parola@sunucu:port). Geçersizse null. */
export function composeProxy({ address = "", username = "", password = "" } = {}) {
  const base = normalizeProxy(String(address).trim().replace(/^https?:\/\/[^@/]*@/i, match => match.replace(/[^/]*@$/, "")));
  if (!base || base.http !== base.https) return null;
  const url = new URL(base.http);
  if (url.pathname !== "/" || url.search) return null;
  url.username = username ? encodeURIComponent(username) : "";
  url.password = username && password ? encodeURIComponent(password) : "";
  return url.href.replace(/\/$/, "");
}

/** Vekil adresini parçalar: { address: "http://sunucu:port", username, hasPassword } — parola hiçbir zaman dışarı verilmez. */
export function splitProxy(text) {
  const base = normalizeProxy(text);
  if (!base) return { address: String(text || ""), username: "", hasPassword: false };
  const url = new URL(base.https);
  const out = { address: `${url.protocol}//${url.host}`, username: decodeURIComponent(url.username), hasPassword: Boolean(url.password) };
  return out;
}
const passwordOf = text => {
  const base = normalizeProxy(text);
  return base ? decodeURIComponent(new URL(base.https).password) : "";
};

/** Etkin vekil ayarı, ekranda gösterilecek biçimde (kimlik bilgisi yok): kaynak, adres, hariç tutulanlar. */
export function describeNetwork({ file = "", env = process.env, platform = process.platform, windows = () => readWindowsProxy({ platform }) } = {}) {
  const settings = readNetworkSettings(file);
  const win = windows();
  const effective = resolveProxy({ file, env, platform, windows: () => win });
  const show = proxy => (proxy ? splitProxy(proxy.https).address : "");
  return {
    mode: settings.mode,
    manual: { ...splitProxy(settings.proxy), bypass: settings.bypass },
    windows: win && normalizeProxy(win.proxy) ? { address: show(normalizeProxy(win.proxy)), bypass: win.bypass || "" } : null,
    effective: { source: effective.source, address: show(effective.proxy) },
  };
}

/**
 * Ekrandan gelen ayarı doğrular ve yazılacak biçime çevirir. Parola boş gelirse kayıtlı parola korunur (ekrana hiç dönmez).
 * Hatalıysa { error } döner.
 */
export function prepareNetworkSettings(body = {}, previous = DEFAULT_NETWORK) {
  const mode = NETWORK_MODES[body.mode] ? body.mode : null;
  if (!mode) return { error: "Vekil sunucu seçeneği geçersiz." };
  const bypass = String(body.bypass ?? "").trim().slice(0, 1000);
  if (mode !== "manual") return { value: { mode, proxy: previous.proxy || "", bypass } };
  const username = String(body.username ?? "").trim();
  const keep = body.password === undefined || body.password === "";
  const old = splitProxy(previous.proxy);
  const password = keep && old.username === username ? passwordOf(previous.proxy) : String(body.password ?? "");
  // 2.4.0 bitiş turu (eleştirmen E6): adresteki fazlalık (ör. "vekil.firma.local 8080" — iki nokta yerine boşluk) sessizce kesilip kaydedilmez.
  if (/\s/.test(String(body.address ?? "").trim())) return { error: "Vekil sunucu adresinde boşluk olamaz. Örnek: vekil.firma.local:8080 ya da http://10.0.0.5:3128" };
  const proxy = composeProxy({ address: body.address, username, password });
  if (!proxy) return { error: "Vekil sunucu adresi geçersiz. Örnek: vekil.firma.local:8080 ya da http://10.0.0.5:3128" };
  return { value: { mode, proxy, bypass } };
}
