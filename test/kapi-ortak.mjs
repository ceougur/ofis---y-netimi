// 2.4.7 M3 test yardımcısı: sahte lisans anahtarı (Ed25519) ve belirteç, ofis ve cihaz anahtarları (WebCrypto ECDSA P-256), imzalı cihaz isteği. Gerçek
// lisans servisine ya da Cloudflare'e istek yok (ders 30). Anahtarlar her koşuda bellekte üretilir, depoya yazılmaz.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { signToken } from "../server/lib/license-token.mjs";
import { b64url, ecdsaImzala, mesaj } from "../server/lib/kapi-protokol.mjs";

const subtle = globalThis.crypto.subtle;

export function lisansAnahtari(keyId = "kapi-test-1") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  return {
    keyId,
    trusted: { [keyId]: publicKey.export({ format: "der", type: "spki" }).toString("base64") },
    /** Lisans belirteci zarfı (programın lisans servisinden aldığıyla aynı biçim). */
    belirtec: ({ at, status = "active", kind = "license", licenseId = "LIS-KAPI-1", machine = "ab".repeat(16), expiresAt = null, mobileDevices } = {}) =>
      signToken(
        { schema: 1, product: "DestekOfis", type: "license-token", kind, status, licenseId, customer: "Kapı Test", machine, issuedAt: new Date(at).toISOString(), startsAt: new Date(at).toISOString(), expiresAt: kind === "trial" && !expiresAt ? new Date(at + 14 * 86_400_000).toISOString() : expiresAt, offline: false, message: "", ...(Number.isInteger(mobileDevices) ? { mobileDevices } : {}) },
        pem,
        keyId,
      ),
  };
}

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
export const rastgeleOfis = () => `o${[...randomBytes(16)].map(b => BASE32[b & 31]).join("")}`;

export async function ofisAnahtari(id = rastgeleOfis()) {
  const cift = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const jwk = await subtle.exportKey("jwk", cift.publicKey);
  return { id, imzaAnahtari: cift.privateKey, acik: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, sir: randomBytes(32).toString("base64url") };
}

export async function cihaz(id = `dev-${globalThis.crypto.randomUUID()}`) {
  const cift = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const jwk = await subtle.exportKey("jwk", cift.publicKey);
  return {
    id,
    anahtar: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
    /** Kapıcıya imzalı özet isteğinin başlıkları. */
    async basliklar(yontem, ms, yol = "/kapi/ozet", { kimlik = id } = {}) {
      return { "x-do-cihaz": kimlik, "x-do-zaman": String(ms), "x-do-imza": await ecdsaImzala(cift.privateKey, mesaj.cihaz(yontem, yol, kimlik, ms)) };
    },
  };
}

export const rastgeleImza = () => b64url(randomBytes(64));
