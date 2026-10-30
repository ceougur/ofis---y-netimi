// Mobil şifreli özet — program tarafının kripto ve kapıcı istemcisi (2.4.7 M3; docs/mobil/M3-TASARIM.md §3–§4; protokol lib/kapi-protokol.mjs).
//
// ŞİFRELEME (zarf şifreleme; OWASP ASVS 4.0.3 V6.2 onaylı algoritmalar, MASVS-CRYPTO-1/2):
//   - Her yüklemede, her KULLANICI için yeni 256 bit veri anahtarı (AES-256-GCM, 96 bit rastgele IV, ek veri = ofis|sıra|kullanıcı). Kullanıcının özeti
//     yalnız ONUN yetkisiyle hazırlanır (lib/mobile-sync.mjs); başka kullanıcının özeti o cihazda açılamaz.
//   - Veri anahtarı her eşli cihaza ayrıca sarılır: yüklemeye özgü geçici ECDH P-256 anahtarı × cihazın ŞİFRELEME anahtarı (eşlemede telefonda üretilen,
//     dışa aktarılamaz ECDH P-256; M2 imza anahtarından AYRI) → HKDF-SHA-256 (tuz ofis|sıra, bilgi cihaz) → AES-256-GCM ile sarma.
//   - Gövde metni ofisin ECDSA P-256 imza anahtarıyla imzalanır; telefon eşlemede aldığı ofis anahtarıyla doğrular (kapıcı da, yeniden oynatma için sıra).
//   - Cihaz silinince/izin kalkınca bir sonraki yüklemede o cihaza sarılmış anahtar YOKTUR ve her yükleme yeni veri anahtarı kullanır: silinen cihaz yeni
//     özeti açamaz (Eylül planı "cihaz silinince veri anahtarı yenilenir").
// İÇERİK sıkıştırılır (gzip) ve şifrelenir; kapıcı (Cloudflare) ve biz içeriği okuyamayız.
import { createHmac, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { KAPI_KURALLARI, OFIS_KIMLIGI, acikAnahtar, b64url, b64urlCoz, ecdsaDogrula, ecdsaImzala, esitMi, mesaj, metin, sha256Hex, utf8 } from "./kapi-protokol.mjs";

const subtle = () => globalThis.crypto.subtle;
const OFIS_AYARI = "meta.mobile.office"; // geri yüklemede canlıdan kalır (company-backups.mjs COMMON_SETTINGS: meta.%)
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

function base32(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/**
 * Ofisin kalıcı kimliği ve anahtarları (ortak katman ayarı; ilk kullanımda üretilir). Kimlik telefon adresinin ilk etiketidir (<kimlik>.<alan>).
 * Dönüş: { id, acik (imza açık anahtarı JWK), imzaAnahtari (CryptoKey), sir (kapıcı işaret sırrı, base64url) }.
 */
export async function ofisKaydi(store) {
  let kayit = gecerliOfisKaydi(store);
  if (!kayit) {
    const cift = await subtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const acik = acikAnahtar(await subtle().exportKey("jwk", cift.publicKey));
    const yeni = { v: 1, id: `o${base32(randomBytes(10))}`, acik, gizli: b64url(await subtle().exportKey("pkcs8", cift.privateKey)), sir: randomBytes(32).toString("base64url"), sira: 0 };
    // Son await'ten sonra yeniden okunur: eşzamanlı başka çağrı (özet eşitlemesi ↔ tünel başvurusu) kaydı yazdıysa o kullanılır; okuma ile yazma
    // arasında await yok, tek kimlik kalır (yoksa bellekte biri, ayarda öbürü kalır, yeniden açılışta telefon adresi değişir).
    kayit = gecerliOfisKaydi(store);
    if (!kayit) {
      kayit = yeni;
      store.setSetting(OFIS_AYARI, JSON.stringify(kayit));
    }
  }
  const imzaAnahtari = await subtle().importKey("pkcs8", b64urlCoz(kayit.gizli), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { id: kayit.id, acik: kayit.acik, imzaAnahtari, sir: kayit.sir };
}
function gecerliOfisKaydi(store) {
  let kayit = null;
  try {
    kayit = JSON.parse(store.setting(OFIS_AYARI, "") || "null");
  } catch {
    return null;
  }
  if (!kayit || !OFIS_KIMLIGI.test(kayit.id || "") || !kayit.gizli || !acikAnahtar(kayit.acik) || !/^[A-Za-z0-9_-]{43}$/.test(kayit.sir || "")) return null;
  return kayit;
}
/** Bir sonraki özet sırası (kalıcı, kesin artan; yeniden oynatma koruması kapıcıda bu sıraya bakar). */
export function sonrakiSira(store, enAz = 0) {
  const kayit = JSON.parse(store.setting(OFIS_AYARI, "{}"));
  kayit.sira = Math.max(Number(kayit.sira || 0), Number(enAz) || 0) + 1;
  store.setSetting(OFIS_AYARI, JSON.stringify(kayit));
  return kayit.sira;
}

/**
 * Özeti şifreleyip imzalar. kullanicilar: [{ anahtar: "u1", veri: nesne, cihazlar: [{ id, sifre: ECDH P-256 açık JWK }] }]. Dönüş: zarfın metni.
 */
export async function ozetPaketle({ ofis, sira, uretim, kullanicilar, imzaAnahtari }) {
  const gecici = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const epk = acikAnahtar(await subtle().exportKey("jwk", gecici.publicKey));
  const tuz = utf8(mesaj.tuz(ofis, sira));
  const govde = { v: 1, ofis, sira, uretim, epk, kullanicilar: {}, cihazlar: {} };
  for (const k of kullanicilar) {
    const ham = randomBytes(32);
    const veriAnahtari = await subtle().importKey("raw", ham, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = randomBytes(12);
    const sifreli = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: utf8(mesaj.veriEk(ofis, sira, k.anahtar)) }, veriAnahtari, gzipSync(Buffer.from(JSON.stringify(k.veri), "utf8")));
    govde.kullanicilar[k.anahtar] = { iv: b64url(iv), veri: b64url(sifreli), sik: "gzip" };
    for (const c of k.cihazlar) {
      const sifre = acikAnahtar(c.sifre);
      if (!sifre) continue;
      const cihazAnahtari = await subtle().importKey("jwk", sifre, { name: "ECDH", namedCurve: "P-256" }, false, []);
      const ortak = await subtle().deriveBits({ name: "ECDH", public: cihazAnahtari }, gecici.privateKey, 256);
      const hkdf = await subtle().importKey("raw", ortak, "HKDF", false, ["deriveKey"]);
      const sarma = await subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt: tuz, info: utf8(mesaj.sarmaBilgi(c.id)) }, hkdf, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
      const civ = randomBytes(12);
      const sarili = await subtle().encrypt({ name: "AES-GCM", iv: civ, additionalData: utf8(mesaj.sarmaEk(ofis, sira, c.id, k.anahtar)) }, sarma, ham);
      govde.cihazlar[c.id] = { u: k.anahtar, iv: b64url(civ), anahtar: b64url(sarili) };
    }
    ham.fill(0);
  }
  const govdeMetni = JSON.stringify(govde);
  return JSON.stringify({ v: 1, alg: "ES256", govde: govdeMetni, imza: await ecdsaImzala(imzaAnahtari, govdeMetni) });
}

/**
 * Özeti telefonun yaptığı gibi açar (testler ve sürücü; telefon aynı adımları client/mobil/app.js'te WebCrypto ile yapar). Ofis imzası doğrulanmadan HİÇBİR
 * alan kullanılmaz. Dönüş: { govde (şifresiz üst bilgi), veri (bu cihazın kullanıcısının özeti) } — bu cihaza sarılmış anahtar yoksa veri null.
 */
export async function ozetCoz(zarfMetni, { ofisAnahtari, cihaz, sifreGizli }) {
  const zarf = JSON.parse(zarfMetni);
  if (zarf?.v !== 1 || typeof zarf.govde !== "string" || !(await ecdsaDogrula(ofisAnahtari, zarf.govde, zarf.imza || ""))) throw new Error("özet imzası doğrulanamadı");
  const govde = JSON.parse(zarf.govde);
  const giris = govde.cihazlar?.[cihaz];
  if (!giris) return { govde, veri: null };
  const epk = await subtle().importKey("jwk", acikAnahtar(govde.epk), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ortak = await subtle().deriveBits({ name: "ECDH", public: epk }, sifreGizli, 256);
  const hkdf = await subtle().importKey("raw", ortak, "HKDF", false, ["deriveKey"]);
  const sarma = await subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt: utf8(mesaj.tuz(govde.ofis, govde.sira)), info: utf8(mesaj.sarmaBilgi(cihaz)) }, hkdf, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const ham = await subtle().decrypt({ name: "AES-GCM", iv: b64urlCoz(giris.iv), additionalData: utf8(mesaj.sarmaEk(govde.ofis, govde.sira, cihaz, giris.u)) }, sarma, b64urlCoz(giris.anahtar));
  const k = govde.kullanicilar[giris.u];
  const veriAnahtari = await subtle().importKey("raw", ham, { name: "AES-GCM" }, false, ["decrypt"]);
  const acik = await subtle().decrypt({ name: "AES-GCM", iv: b64urlCoz(k.iv), additionalData: utf8(mesaj.veriEk(govde.ofis, govde.sira, giris.u)) }, veriAnahtari, b64urlCoz(k.veri));
  return { govde, veri: JSON.parse(metin(gunzipSync(Buffer.from(acik)))) };
}

/** Kapıcının programa eklediği canlı bağlantı işareti (x-do-kapi = "<ms>.<cihaz|->.<hmac>"). Dönüş: { ok, cihaz, neden }. */
export function isaretDogrula(baslik, { yontem, yolSorgu, sir, simdi }) {
  const parcalar = String(baslik || "").split(".");
  if (parcalar.length !== 3) return { ok: false, neden: "yok" };
  const [msMetni, cihaz, mac] = parcalar;
  const ms = Number(msMetni);
  if (!Number.isSafeInteger(ms) || Math.abs(simdi - ms) > KAPI_KURALLARI.vekilPayiMs) return { ok: false, neden: "zaman" };
  const beklenen = createHmac("sha256", Buffer.from(sir, "base64url")).update(mesaj.vekil(yontem, yolSorgu, cihaz, ms)).digest("base64url");
  if (!esitMi(beklenen, mac)) return { ok: false, neden: "imza" };
  return { ok: true, cihaz };
}

/**
 * Kayıt zamanı kesin artar (kapıcı eşit ya da eski zamanlı kaydı yeniden oynatma sayar): aynı milisaniyedeki ikinci kayıt bir sonrakine kayar. SAF — yazmaz
 * (2.4.7 B2): kalıcı değer (sonKayitMs) yalnız kapıcı kaydı KABUL edince kayitKabul ile yazılır; reddedilen kaydın zamanı saklanmaz. Saklı ya da bellekteki
 * (enAz) değer şimdiki zaman + kapıcı payından (KAPI_KURALLARI.zamanPayiMs) ilerideyse — saat bir ara ileri kaymış, eski sürüm reddedilen zamanı yazmış — yok
 * sayılır (şimdiye kırpılır): saat düzelince kilit kalkar. Kapıcının kabul ettiği her zaman en çok pay kadar ileridedir, kırpma onu geri almaz.
 */
export function kayitZamani(store, simdi, enAz = 0) {
  const kirp = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) && n <= simdi + KAPI_KURALLARI.zamanPayiMs ? n : 0;
  };
  const kayit = JSON.parse(store.setting(OFIS_AYARI, "{}"));
  return Math.max(simdi, kirp(kayit.sonKayitMs) + 1, kirp(enAz) + 1);
}
/** Kapıcı ms zamanlı kaydı kabul etti (onun son kaydı artık ms): kalıcı yazılır. Saklı değer ms + paydan ilerideyse (kırpılmış eski değer) ms ile değişir. */
export function kayitKabul(store, ms) {
  const kayit = JSON.parse(store.setting(OFIS_AYARI, "{}"));
  const once = Number(kayit.sonKayitMs || 0);
  if (Number.isFinite(once) && once >= ms && once <= ms + KAPI_KURALLARI.zamanPayiMs) return;
  kayit.sonKayitMs = ms;
  store.setSetting(OFIS_AYARI, JSON.stringify(kayit));
}

/**
 * Kapıcı istemcisi (program → kapi.<alan>): her istek ofis anahtarıyla imzalı (yöntem, yol, zaman, gövde özeti).
 * kayitKabul(ms): kapıcı kaydı kabul edince (B2). saatOlc(tarihMs): her yanıtın HTTP Date başlığı (B2b; başlık yoksa çağrılmaz).
 */
export function kapiIstemcisi({ url, fetchImpl, simdi, kayitSimdi = simdi, kayitKabul = () => {}, saatOlc = () => {} }) {
  const taban = String(url || "").replace(/\/+$/, "");
  async function istek(ofis, yontem, yol, govdeMetni = "", ms = simdi()) {
    const imza = await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis(yontem, yol, ms, await sha256Hex(govdeMetni)));
    let yanit;
    try {
      yanit = await fetchImpl(`${taban}${yol}`, {
        method: yontem,
        headers: { "content-type": "application/json", accept: "application/json", "x-do-zaman": String(ms), "x-do-imza": imza },
        ...(govdeMetni ? { body: govdeMetni } : {}),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      return { ok: false, code: "kapi-ag", error: `Kapıcıya ulaşılamadı (${error?.cause?.code || error?.name || "ağ"}).` };
    }
    const tarih = Date.parse(yanit.headers?.get?.("date") || "");
    if (Number.isFinite(tarih)) saatOlc(tarih);
    let veri = null;
    try {
      veri = await yanit.json();
    } catch {
      veri = null;
    }
    if (yanit.ok && veri?.ok) return { ok: true, data: veri.data, status: yanit.status };
    return { ok: false, status: yanit.status, code: veri?.code || `kapi-http-${yanit.status}`, error: veri?.error || `Kapıcı yanıtı ${yanit.status}`, ...(veri?.zaman ? { zaman: veri.zaman } : {}) };
  }
  return {
    // Kayıtta zaman gövdede de (imzalı) ve imzanınkiyle AYNI; kapıcı daha eski kaydı yeniden oynatma sayar (silinmiş cihaz geri gelmez).
    kayit: async (ofis, { lisans, cihazlar }) => {
      const ms = kayitSimdi();
      const sonuc = await istek(ofis, "POST", `/v1/ofis/${ofis.id}/kayit`, JSON.stringify({ v: 1, ofis: ofis.id, anahtar: ofis.acik, lisans, cihazlar, sir: ofis.sir, zaman: ms }), ms);
      if (sonuc.ok) kayitKabul(ms);
      return sonuc;
    },
    ozetYukle: (ofis, zarfMetni) => istek(ofis, "PUT", `/v1/ofis/${ofis.id}/ozet`, zarfMetni),
    ozetSil: (ofis, sira) => istek(ofis, "DELETE", `/v1/ofis/${ofis.id}/ozet?sira=${sira}`),
  };
}
