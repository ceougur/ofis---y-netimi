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

// ---------- 2.4.8 W7: "WhatsApp'ı Bağla" belirtecinin kapıcıdan programa taşınması ----------
// Kapıcı Meta'nın Embedded Signup kodunu belirteçle değiştirir ve belirteci programın oturum başında verdiği GEÇİCİ açık anahtarla (ECDH P-256) şifreler:
// ECDH-ES (kapıcının tek kullanımlık anahtarı) → HKDF-SHA-256 (tuz = bağlam) → AES-256-GCM (ek veri = bağlam). Kapıcı belirteci düz saklamaz; gizli anahtar
// yalnız programın belleğinde. Bağlam "wa|<ofis>|<oturum>": şifreli belirteç başka ofise / oturuma taşınamaz.
export const waBaglam = (ofis, oturum) => `wa|${ofis}|${oturum}`;
const WA_BILGI = "DestekOfis-wa-belirtec-v1";
async function waAnahtari(ortakBitler, baglam, kullanim) {
  const hk = await subtle().importKey("raw", ortakBitler, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt: utf8(baglam), info: utf8(WA_BILGI) }, hk, { name: "AES-GCM", length: 256 }, false, [kullanim]);
}
export async function waSifrele(aliciJwk, duzMetin, baglam) {
  const temiz = acikAnahtar(aliciJwk);
  if (!temiz) throw new Error("alıcı anahtarı geçersiz");
  const alici = await subtle().importKey("jwk", temiz, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const gecici = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const anahtar = await waAnahtari(await subtle().deriveBits({ name: "ECDH", public: alici }, gecici.privateKey, 256), baglam, "encrypt");
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: utf8(baglam) }, anahtar, utf8(duzMetin));
  const epk = await subtle().exportKey("jwk", gecici.publicKey);
  return { v: 1, epk: { kty: "EC", crv: "P-256", x: epk.x, y: epk.y }, iv: b64url(iv), ct: b64url(ct) };
}
/** gizliAnahtar: programın oturum anahtarının gizli kısmı (CryptoKey, ECDH, deriveBits). Bağlam tutmazsa / zarf bozuksa hata atar. */
export async function waCoz(gizliAnahtar, zarf, baglam) {
  const epk = acikAnahtar(zarf?.epk);
  if (!epk || zarf.v !== 1) throw new Error("şifreli belirteç okunamadı");
  const gonderen = await subtle().importKey("jwk", epk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const anahtar = await waAnahtari(await subtle().deriveBits({ name: "ECDH", public: gonderen }, gizliAnahtar, 256), baglam, "decrypt");
  return metin(await subtle().decrypt({ name: "AES-GCM", iv: b64urlCoz(zarf.iv), additionalData: utf8(baglam) }, anahtar, b64urlCoz(zarf.ct)));
}

// ---------- 2.4.8 L1: MOBİL KULLANIM HAKKI (ürün sahibi kararı "KARAR L1", 30.10.2026; docs/2.4.8-IS-LISTESI.md) ----------
// TEK KURAL: program (lib/license.mjs mobileRightOf → uzak dinleyici, tünel, Yönetim → Mobil Cihazlar, telefon), kapıcı (canlı kapı, son özet, tünel başvurusu,
// kayıt) ve kapıcının zamanlanmış temizliği (bulut/kapi/temizlik.mjs) bu işlevleri çağırır.
//   * Deneme (kind "trial") biter → mobil HEMEN kapanır.
//   * Ücretli lisans (kind "license", status "active") biter → mobil 30 GÜN salt okunur sürer (canlı + son özet; yazma programın salt okunur kuralıyla
//     kapalı, yeni cihaz eşlenmez); bitişten 30 gün sonra (30. günün sonunda) kapanır.
//   * Engellenen lisans (status "blocked") → mobil hemen kapanır.
//   * Kapıcıdaki mobil kayıt (ofis kaydı, eşli cihazlar, R2 özeti, tünel, DNS): deneme ve ücretli lisansta bitişten 30 gün sonra, engellenende engelin
//     kapıcıca İLK görüldüğü andan 30 gün sonra kendiliğinden silinir (mobilSilmeAni). Silinmiş kayıt geri gelmez: lisans sonradan alınırsa telefon
//     karekodla yeniden eşlenir.
export const GUN_MS = 86_400_000;
export const MOBIL_HAK = Object.freeze({ hosgoruMs: 30 * GUN_MS, silmeMs: 30 * GUN_MS, uyariGun: 7 });

/**
 * t anındaki mobil kullanım hakkı. iddia: { kind: "trial"|"license", status: "active"|"blocked", expiresAt: ms|null } (lisansDogrula biçimi).
 * Dönüş { durum, acik, tur, kalanGun, sonMs, uyari }: durum "gecerli" (lisans sürüyor) | "hosgoru" (ücretli lisans bitti, 30 gün salt okunur) | "deneme-bitti" |
 * "bitti" (hoşgörü de bitti) | "engelli" | "yok". kalanGun: gecerli'de bitişe, hosgoru'da hakkın sonuna kalan gün (yukarı yuvarlanır; son gün 1).
 */
export function mobilHakki(iddia, t) {
  if (!iddia) return { durum: "yok", acik: false, tur: null, kalanGun: null, sonMs: null, uyari: false };
  const tur = iddia.kind === "trial" ? "trial" : "license";
  if (iddia.status === "blocked") return { durum: "engelli", acik: false, tur, kalanGun: null, sonMs: null, uyari: false };
  const bitis = Number.isFinite(iddia.expiresAt) ? iddia.expiresAt : null;
  if (bitis === null || t < bitis) {
    const kalanGun = bitis === null ? null : Math.max(1, Math.ceil((bitis - t) / GUN_MS));
    return { durum: "gecerli", acik: true, tur, kalanGun, sonMs: bitis, uyari: kalanGun !== null && kalanGun <= MOBIL_HAK.uyariGun };
  }
  if (tur === "license" && t < bitis + MOBIL_HAK.hosgoruMs) {
    const sonMs = bitis + MOBIL_HAK.hosgoruMs;
    return { durum: "hosgoru", acik: true, tur, kalanGun: Math.max(1, Math.ceil((sonMs - t) / GUN_MS)), sonMs, uyari: true };
  }
  return { durum: tur === "trial" ? "deneme-bitti" : "bitti", acik: false, tur, kalanGun: null, sonMs: null, uyari: true };
}

/** Kullanıcıya görünen ileti (cümle düzeni; telefon, Yönetim → Mobil Cihazlar ve ret yanıtları aynı metni kullanır). Uyarı yoksa "". */
export function mobilHakIletisi(hak) {
  switch (hak?.durum) {
    case "gecerli":
      if (!hak.uyari) return "";
      return hak.tur === "trial" ? `Deneme süreniz ${hak.kalanGun} gün sonra bitiyor.` : `Lisansınız ${hak.kalanGun} gün sonra bitiyor.`;
    case "hosgoru":
      return `Lisansınız bitti; mobil kullanım hakkınız ${hak.kalanGun} gün sonra sona erecek.`;
    case "bitti":
      return "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin.";
    case "deneme-bitti":
      return "Deneme süreniz bitti; mobil kullanım kapalı. Lisans alınca yeniden açılır.";
    case "engelli":
      return "Lisansınız engellendi; mobil kullanım kapalı.";
    default:
      return "";
  }
}

/**
 * Kapıcıdaki mobil kaydın silinme anı (ms) ya da null (silinmez / henüz bilinmiyor). engelMs: kapıcının engeli İLK gördüğü an (engelli lisansta; yoksa null →
 * önce kaydedilir). Bitişi olan lisansta bitiş + 30 gün; engelde engel + 30 gün; ikisi de varsa erken olanı. Silme yalnız hak KAPALIYKEN yapılır (temizlik.mjs).
 */
export function mobilSilmeAni(iddia, { engelMs = null } = {}) {
  if (!iddia) return null;
  const adaylar = [];
  if (Number.isFinite(iddia.expiresAt)) adaylar.push(iddia.expiresAt + MOBIL_HAK.silmeMs);
  if (iddia.status === "blocked" && Number.isFinite(engelMs)) adaylar.push(engelMs + MOBIL_HAK.silmeMs);
  return adaylar.length ? Math.min(...adaylar) : null;
}

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
