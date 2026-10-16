// Test yardımcısı: bellekte kendinden imzalı TLS sertifikası (EC P-256, ecdsa-with-SHA256; SAN dNSName). Ek paket ve openssl gerekmez;
// Linux ve Windows'ta aynı çalışır. Anahtar depoya YAZILMAZ — her koşuda yeniden üretilir (yalnız test sunucusu için).
import { generateKeyPairSync, sign } from "node:crypto";

const len = n => (n < 0x80 ? Buffer.from([n]) : n < 0x100 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 0xff]));
const tlv = (tag, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), len(body.length), body]);
};
const seq = (...parts) => tlv(0x30, ...parts);
const set = (...parts) => tlv(0x31, ...parts);
const oid = text => {
  const [a, b, ...rest] = text.split(".").map(Number);
  const bytes = [40 * a + b];
  for (const value of rest) {
    const chunk = [];
    let v = value;
    do {
      chunk.unshift((v & 0x7f) | (chunk.length ? 0x80 : 0));
      v >>>= 7;
    } while (v > 0);
    bytes.push(...chunk);
  }
  return tlv(0x06, Buffer.from(bytes));
};
const int = n => tlv(0x02, Buffer.from([n]));
const utf8 = text => tlv(0x0c, Buffer.from(text, "utf8"));
const time = date => tlv(0x17, Buffer.from(`${date.toISOString().replace(/[-:T]/g, "").slice(2, 14)}Z`));
const name = cn => seq(set(seq(oid("2.5.4.3"), utf8(cn))));

/** { cert, key } PEM — hostname için kendinden imzalı (CA:TRUE), bugünden 1 gün önce başlar, 2 yıl geçerli. */
export function selfSignedCert(hostname = "edm.test") {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const algorithm = seq(oid("1.2.840.10045.4.3.2"));
  const now = Date.now();
  const san = seq(oid("2.5.29.17"), tlv(0x04, seq(tlv(0x82, Buffer.from(hostname)))));
  const basic = seq(oid("2.5.29.19"), tlv(0x01, Buffer.from([0xff])), tlv(0x04, seq(tlv(0x01, Buffer.from([0xff])))));
  const tbs = seq(
    tlv(0xa0, int(2)),
    int(1),
    algorithm,
    name(hostname),
    seq(time(new Date(now - 86_400_000)), time(new Date(now + 2 * 365 * 86_400_000))),
    name(hostname),
    publicKey.export({ type: "spki", format: "der" }),
    tlv(0xa3, seq(san, basic)),
  );
  const signature = sign("sha256", tbs, privateKey);
  const der = seq(tbs, algorithm, tlv(0x03, Buffer.from([0]), signature));
  const cert = `-----BEGIN CERTIFICATE-----\n${der.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;
  return { cert, key: privateKey.export({ type: "pkcs8", format: "pem" }) };
}
