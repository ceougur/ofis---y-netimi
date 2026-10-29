// Mobil kapıcı protokolü (2.4.7 M3; docs/mobil/M3-TASARIM.md): program (ofis sunucusu), kapıcı (Cloudflare Worker, bulut/kapi/kapi.mjs) ve testlerin
// ORTAK, saf parçası. Yalnız WebCrypto (globalThis.crypto.subtle), TextEncoder ve atob/btoa kullanır: Node 22+, Cloudflare Workers ve tarayıcıda aynı çalışır
// (node: modülü YOK — Worker paketine bu dosya olduğu gibi girer). Telefon tarafı (client/mobil/app.js) aynı metinleri kendisi kurar; uyum uçtan uca
// testlerde (test/e2e/senaryo-mobil-ozet-247.mjs) ve kaynak tarayan testte (test/mobil-ozet-247.test.mjs) denetlenir.
//
// İmzalı metinler (her biri "DestekOfis-kapi-…" önekiyle ayrı alan; bir türün imzası başka türde geçmez):
//   cihaz → kapıcı (özet okuma): ECDSA P-256 + SHA-256 (cihazın M2 eşleme anahtarı, dışa aktarılamaz) — mesaj.cihaz
//   program → kapıcı (kayıt, özet yükleme/silme): ECDSA P-256 + SHA-256 (ofis imza anahtarı)        — mesaj.ofis
//   kapıcı → program (canlı bağlantı işareti x-do-kapi): HMAC-SHA-256 (ofis başına kapıcı sırrı)      — mesaj.vekil
//   özet (telefonun doğruladığı): ofis imza anahtarıyla gövde metninin imzası                            — mesaj.ozet

export const PROTOKOL = 1;
export const KAPI_KURALLARI = Object.freeze({
  // P9 (kullanıcı kararı 29.10.2026): kapıcı lisans bilgisini en çok 1 saat eski kabul eder; sonra erişim kapanır (fail-closed).
  lisansTazeMs: 60 * 60_000,
  // Kapıcı, elindeki en yeni lisans belirteci bu süreden eskiyse lisans servisinden yeniler (P9 penceresinin yarısı; ofis başına ≤ 2 istek/saat).
  lisansYenileMs: 30 * 60_000,
  // İmzalı isteğin zaman damgası payı (cihaz saati / sunucu saati farkı). Dışındaysa kapıcı kendi saatini döner, telefon bir kez düzeltip yineler.
  zamanPayiMs: 5 * 60_000,
  // Kapıcı → program işareti (x-do-kapi) payı: işaret yalnız o istekte kullanılır. 2.4.7 B2b: 2 → 5 dk (ofis saati birkaç dakika kayınca canlı bağlantı
  // tümden kapanıyordu); program ayrıca kapıcı yanıtının Date başlığıyla saat farkını ölçüp düzeltir (lib/mobile-sync.mjs).
  vekilPayiMs: 5 * 60_000,
  // Özet nesnesi en çok (bayt). Program 6 MB'ı aşarsa ayrıntıları kırpar (lib/mobile-sync.mjs).
  ozetAzamiBayt: 8 * 1024 * 1024,
  // Kayıt gövdesi en çok (bayt).
  kayitAzamiBayt: 64 * 1024,
  // Ofis başına günde en çok özet yüklemesi (kapıcının güvenlik sınırı; programın kendi veri yükleme sınırı günde 20 — Eylül planı).
  gunlukYukleme: 200,
  // Aynı ofisin dakikadaki en çok yüklemesi (hatalı döngüye karşı; günlük sınırla birlikte).
  dakikadaYukleme: 30,
  // Hız sınırı (dakikada; cihaz ya da adres başına): canlı bağlantı ve özet okuma.
  dakikadaVekil: 300,
  dakikadaOzet: 30,
});

// Ofis kimliği: "o" + 16 küçük harf base32 (80 bit rastgele). DNS etiketi olarak geçerlidir: ofisin telefon adresi <kimlik>.<ofis alanı>.
export const OFIS_KIMLIGI = /^o[a-z2-7]{16}$/;
export const CIHAZ_KIMLIGI = /^dev-[0-9a-f-]{36}$/;

export const mesaj = Object.freeze({
  cihaz: (yontem, yol, cihaz, ms) => `DestekOfis-kapi-cihaz\n${yontem}\n${yol}\n${cihaz}\n${ms}`,
  ofis: (yontem, yol, ms, govdeOzeti) => `DestekOfis-kapi-ofis\n${yontem}\n${yol}\n${ms}\n${govdeOzeti}`,
  vekil: (yontem, yolSorgu, cihaz, ms) => `DestekOfis-kapi-vekil\n${yontem}\n${yolSorgu}\n${cihaz}\n${ms}`,
  // Sarma ve şifrelemenin bağlam metinleri (HKDF tuzu/bilgisi, AES-GCM ek verisi): özet başka ofise, başka sıraya, başka cihaza taşınamaz.
  tuz: (ofis, sira) => `DestekOfis-ozet-v1|${ofis}|${sira}`,
  sarmaBilgi: cihaz => `sarma|${cihaz}`,
  sarmaEk: (ofis, sira, cihaz, kullanici) => `sarma|${ofis}|${sira}|${cihaz}|${kullanici}`,
  veriEk: (ofis, sira, kullanici) => `veri|${ofis}|${sira}|${kullanici}`,
});

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
export const utf8 = text => enc.encode(String(text));
export const metin = bytes => new TextDecoder().decode(bytes);

export function b64url(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlCoz(text) {
  const clean = String(text ?? "");
  if (!/^[A-Za-z0-9_-]*$/.test(clean)) throw new Error("base64url değil");
  const padded = clean.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((clean.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
export function b64Coz(text) {
  const binary = atob(String(text ?? ""));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
export async function sha256Hex(data) {
  const digest = new Uint8Array(await subtle().digest("SHA-256", typeof data === "string" ? utf8(data) : data));
  return [...digest].map(b => b.toString(16).padStart(2, "0")).join("");
}
// Sabit süreli metin karşılaştırması (imza/işaret karşılaştırmasında zamanlama sızıntısı olmasın).
export function esitMi(a, b) {
  const x = utf8(a);
  const y = utf8(b);
  let fark = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) fark |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return fark === 0;
}

// ECDSA P-256 açık anahtarı (JWK). Gizli bileşen (d) taşıyan, eğrisi farklı ya da biçimi bozuk anahtar reddedilir.
export function acikAnahtar(jwk) {
  if (!jwk || typeof jwk !== "object" || jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk) return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(jwk.x || "")) || !/^[A-Za-z0-9_-]{43}$/.test(String(jwk.y || ""))) return null;
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
}
export const ayniAnahtar = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.crv === b.crv);

export async function ecdsaDogrula(jwk, mesajMetni, imzaB64url) {
  const temiz = acikAnahtar(jwk);
  if (!temiz) return false;
  let imza;
  try {
    imza = b64urlCoz(imzaB64url);
  } catch {
    return false;
  }
  if (imza.length !== 64) return false;
  try {
    const key = await subtle().importKey("jwk", temiz, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await subtle().verify({ name: "ECDSA", hash: "SHA-256" }, key, imza, typeof mesajMetni === "string" ? utf8(mesajMetni) : mesajMetni);
  } catch {
    return false;
  }
}
export async function ecdsaImzala(gizliAnahtar, mesajMetni) {
  return b64url(await subtle().sign({ name: "ECDSA", hash: "SHA-256" }, gizliAnahtar, typeof mesajMetni === "string" ? utf8(mesajMetni) : mesajMetni));
}
export async function hmac(sirB64url, mesajMetni) {
  const key = await subtle().importKey("raw", b64urlCoz(sirB64url), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await subtle().sign("HMAC", key, utf8(mesajMetni)));
}

/**
 * Lisans belirteci zarfı (lib/license-token.mjs biçimi: { schema: 1, payload: base64(JSON iddialar), signatures: [{ keyId, sig }] }; Ed25519) — WebCrypto ile
 * doğrulanır. Dönüş: iddialar ya da null. guvenilen: { keyId: SPKI base64 } (lib/license-keys.mjs TRUSTED_LICENSE_KEYS ile aynı biçim).
 */
export async function lisansDogrula(zarf, guvenilen) {
  if (!zarf || typeof zarf !== "object" || zarf.schema !== 1 || typeof zarf.payload !== "string" || !Array.isArray(zarf.signatures)) return null;
  let govde;
  try {
    govde = b64Coz(zarf.payload);
  } catch {
    return null;
  }
  if (!govde.length || govde.length > 16 * 1024) return null;
  let gecerli = false;
  for (const item of zarf.signatures.slice(0, 8)) {
    const spki = item && typeof item.keyId === "string" && Object.hasOwn(guvenilen || {}, item.keyId) ? guvenilen[item.keyId] : null;
    if (typeof spki !== "string" || typeof item.sig !== "string") continue;
    try {
      const imza = b64Coz(item.sig);
      if (imza.length !== 64) continue;
      const key = await subtle().importKey("spki", b64Coz(spki), { name: "Ed25519" }, false, ["verify"]);
      if (await subtle().verify({ name: "Ed25519" }, key, imza, govde)) {
        gecerli = true;
        break;
      }
    } catch {
      // bu imza geçmedi; sıradaki
    }
  }
  if (!gecerli) return null;
  let c;
  try {
    c = JSON.parse(metin(govde));
  } catch {
    return null;
  }
  const zaman = value => (typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null);
  if (!c || c.schema !== 1 || c.product !== "DestekOfis" || c.type !== "license-token" || !["trial", "license"].includes(c.kind)) return null;
  if (typeof c.licenseId !== "string" || !/^[a-f0-9]{32}$/.test(String(c.machine || "").replace(/[\s-]/g, "").toLowerCase())) return null;
  const issuedAt = zaman(c.issuedAt);
  if (issuedAt === null) return null;
  const expiresAt = c.expiresAt === null || c.expiresAt === undefined ? null : zaman(c.expiresAt);
  if (c.expiresAt && expiresAt === null) return null;
  return {
    kind: c.kind,
    status: c.status === "blocked" ? "blocked" : "active",
    licenseId: c.licenseId,
    machine: String(c.machine).replace(/[\s-]/g, "").toLowerCase(),
    issuedAt,
    expiresAt,
    mobileDevices: Number.isInteger(c.mobileDevices) && c.mobileDevices >= 0 && c.mobileDevices <= 100 ? c.mobileDevices : 3,
  };
}
// Lisans iddialarının t anındaki geçerliliği (kâhin K14: engel ve bitiş anı; bitiş anı geçersizdir).
export const lisansGecerli = (iddia, t) => Boolean(iddia && iddia.status === "active" && (iddia.expiresAt === null || t < iddia.expiresAt));

/**
 * Uzak isteğin yolu (M2 lib/mobile-remote.mjs ile TEK kaynak; kapıcı da aynı kuralla süzer): yalnız /mobil/ ve /api/mobil/ önekleri; "." / ".." bölümü
 * (kodlanmışı dahil), ters bölü, çift bölü, denetim karakteri ve ikinci kat kodlama reddedilir. Dönüş: null (izinli) ya da neden.
 */
export function yolSorunu(rawUrl) {
  const raw = String(rawUrl ?? "");
  if (!raw.startsWith("/")) return "not-absolute";
  const pathPart = raw.split("?")[0].split("#")[0];
  let decoded;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return "bad-encoding";
  }
  if (decoded.includes("%")) {
    try {
      if (decodeURIComponent(decoded) !== decoded) return "double-encoding";
    } catch {
      return "double-encoding";
    }
  }
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.includes("//")) return "separator";
  if (decoded.split("/").slice(1).some(segment => segment === "." || segment === "..")) return "dot-segment";
  if (!(decoded.startsWith("/mobil/") || decoded.startsWith("/api/mobil/"))) return "prefix";
  return null;
}

// İstanbul (UTC+3, yaz saati yok) günü — kapıcının günlük yükleme sayacı ve programın günlük veri yüklemesi sınırı aynı günü sayar.
export const trGunu = ms => new Date(ms + 3 * 3_600_000).toISOString().slice(0, 10);
