// İnternetsiz etkinleştirme kodu üretir (operatör aracı). Müşteri kodu Yönetim → Lisans → "Etkinleştirme kodu"
// kutusuna yapıştırır; kod yalnızca kurulum kodu verilen bilgisayarda çalışır.
//
//   node tools/lisans-kodu.mjs --anahtar gizli.pem --kurulum 7F3A-91C2-.... --musteri "Çetin Hukuk" --bitis 2027-09-25
//   node tools/lisans-kodu.mjs --anahtar gizli.pem --kurulum ... --musteri "..." --suresiz
//   node tools/lisans-kodu.mjs --anahtar gizli.pem --kurulum ... --deneme [--gun 30]          (internetsiz deneme)
// Seçenekler: --cevrimici  kodu internetli lisans yapar (7 günde bir lisans servisinden doğrulanır);
//             varsayılan internetsizdir (doğrulama gerekmez, uzaktan engellenemez).
//             --cikti dosya.txt  kodu dosyaya da yazar.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { TRUSTED_LICENSE_KEYS } from "../server/lib/license-keys.mjs";
import { PRODUCT, encodeCode, formatInstallCode, normalizeMachineId, signToken } from "../server/lib/license-token.mjs";
import { keyIdForLicense } from "./lib/license-service.mjs";

const { values } = parseArgs({
  options: {
    anahtar: { type: "string" },
    kurulum: { type: "string" },
    musteri: { type: "string", default: "" },
    bitis: { type: "string" },
    suresiz: { type: "boolean", default: false },
    deneme: { type: "boolean", default: false },
    gun: { type: "string", default: "30" },
    cevrimici: { type: "boolean", default: false },
    no: { type: "string" },
    cikti: { type: "string" },
  },
});
const fail = message => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const pem = values.anahtar ? readFileSync(values.anahtar, "utf8") : process.env.DESTEKOFIS_LICENSE_KEY || "";
if (!pem.includes("PRIVATE KEY")) fail("Gizli lisans anahtarı gerekli: --anahtar <dosya.pem>");
const keyId = keyIdForLicense(pem, TRUSTED_LICENSE_KEYS);
if (!keyId) fail("Bu anahtar programın güvendiği lisans anahtarları arasında yok (server/lib/license-keys.mjs); üretilen kod reddedilir.");
const machine = normalizeMachineId(values.kurulum);
if (!machine) fail("Kurulum kodu 32 karakter olmalı (Yönetim → Lisans ekranındaki \"Kurulum kodu\").");
const now = Date.now();
let expiresAt = null;
if (values.deneme) {
  const days = Number(values.gun);
  if (!Number.isInteger(days) || days < 1 || days > 365) fail("--gun 1 ile 365 arasında olmalı.");
  expiresAt = new Date(now + days * 86_400_000).toISOString();
} else if (values.suresiz) {
  if (values.bitis) fail("--bitis ile --suresiz birlikte verilemez.");
} else {
  if (!values.bitis) fail("Bitiş tarihi gerekli: --bitis 2027-09-25 (süresiz lisans için --suresiz).");
  const time = Date.parse(values.bitis.length === 10 ? `${values.bitis}T23:59:59+03:00` : values.bitis);
  if (!Number.isFinite(time) || time <= now) fail(`Bitiş tarihi geçersiz veya geçmişte: ${values.bitis}`);
  expiresAt = new Date(time).toISOString();
}
const licenseId = values.no || `${values.deneme ? "DEN" : "LIS"}-${new Date(now).toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
const envelope = signToken(
  { schema: 1, product: PRODUCT, type: "license-token", kind: values.deneme ? "trial" : "license", status: "active", licenseId, customer: values.musteri, machine, issuedAt: new Date(now).toISOString(), startsAt: new Date(now).toISOString(), expiresAt, offline: !values.cevrimici, message: "" },
  pem,
  keyId,
);
const code = encodeCode(envelope);
if (values.cikti) writeFileSync(values.cikti, `${code}\n`);
console.log(`✓ Etkinleştirme kodu (${values.deneme ? "deneme" : "lisans"}, ${values.cevrimici ? "internetli" : "internetsiz"})`);
console.log(`  Kurulum : ${formatInstallCode(machine)}\n  No      : ${licenseId}\n  Müşteri : ${values.musteri || "-"}\n  Bitiş   : ${expiresAt || "süresiz"}\n`);
console.log(code);
