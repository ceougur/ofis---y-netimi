// Yeni güncelleme imza anahtarı üretir: node tools/release-keygen.mjs <anahtar-kimliği> [çıktı.pem]
// Gizli anahtar dosyası yalnızca size aittir: parola yöneticisinde/USB'de saklayın ve GitHub deposunda
// Settings → Secrets and variables → Actions → "DESTEKOFIS_RELEASE_KEY" gizli değişkenine içeriğini yapıştırın.
// Açık anahtarı server/lib/update-keys.mjs dosyasına ekleyin (anahtar değiştirme adımları orada anlatılıyor).
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const keyId = process.argv[2];
if (!keyId || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(keyId)) {
  console.error("Kullanım: node tools/release-keygen.mjs destekofis-2027-1 [cikti.pem]");
  process.exit(1);
}
const output = process.argv[3] || `${keyId}.pem`;
if (existsSync(output)) {
  console.error(`${output} zaten var; üzerine yazılmadı.`);
  process.exit(1);
}
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
writeFileSync(output, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
const spki = publicKey.export({ format: "der", type: "spki" }).toString("base64");
console.log(`Gizli anahtar: ${output}  (kimseyle paylaşmayın, depoya eklemeyin)`);
console.log(`Açık anahtar (update-keys.mjs):\n  "${keyId}": "${spki}",`);
console.log(`Parmak izi: ${createHash("sha256").update(Buffer.from(spki, "base64")).digest("hex").slice(0, 16)}`);
