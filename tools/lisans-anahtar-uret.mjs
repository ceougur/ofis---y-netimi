// Yeni lisans imza anahtarı üretir: node tools/lisans-anahtar-uret.mjs <anahtar-kimliği> [çıktı.pem]
// Gizli anahtar yalnızca size aittir: parola yöneticisinde/şifreli USB'de saklayın; Faz 4'te Vercel projesinde
// DESTEKOFIS_LICENSE_KEY ortam değişkenine içeriğini yapıştırın. Açık anahtarı server/lib/license-keys.mjs dosyasına
// ekleyin (anahtar değiştirme adımları orada). Bu anahtar güncelleme imza anahtarından ayrıdır.
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const keyId = process.argv[2];
if (!keyId || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(keyId)) {
  console.error("Kullanım: node tools/lisans-anahtar-uret.mjs destekofis-lisans-2027-1 [cikti.pem]");
  process.exit(1);
}
const output = process.argv[3] || `${keyId}-GIZLI.pem`;
if (existsSync(output)) {
  console.error(`${output} zaten var; üzerine yazılmadı.`);
  process.exit(1);
}
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
writeFileSync(output, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
const spki = publicKey.export({ format: "der", type: "spki" }).toString("base64");
console.log(`Gizli anahtar: ${output}  (kimseyle paylaşmayın, depoya eklemeyin)`);
console.log(`Açık anahtar (license-keys.mjs):\n  "${keyId}": "${spki}",`);
console.log(`Parmak izi: ${createHash("sha256").update(Buffer.from(spki, "base64")).digest("hex").slice(0, 16)}`);
