// Güncelleme paketi üretir ve imzalar:
//   DESTEKOFIS_RELEASE_KEY="<PEM>" node tools/release.mjs [--kanal stable|beta] [--en-dusuk 1.2.0] [--cikti dist/guncelleme]
//   node tools/release.mjs --anahtar C:\gizli\destekofis-2026-1.pem
// Çıktılar GitHub Release'e yüklenir: destekofis-guncelleme-<sürüm>.zip ve destekofis-guncelleme.json
// (isteğe bağlı: kurulum dosyası). Etiket "v<sürüm>" olmalıdır; ön sürüm (pre-release) yalnızca beta kanalına gider.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { TRUSTED_UPDATE_KEYS } from "../server/lib/update-keys.mjs";
import { buildUpdatePackage, keyIdFor } from "./lib/update-package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: {
    anahtar: { type: "string" },
    kanal: { type: "string", default: "stable" },
    "en-dusuk": { type: "string" },
    cikti: { type: "string", default: path.join(root, "dist", "guncelleme") },
  },
});

try {
  const pem = values.anahtar ? readFileSync(values.anahtar, "utf8") : process.env.DESTEKOFIS_RELEASE_KEY_FILE ? readFileSync(process.env.DESTEKOFIS_RELEASE_KEY_FILE, "utf8") : process.env.DESTEKOFIS_RELEASE_KEY;
  if (!pem || !pem.includes("PRIVATE KEY")) throw new Error("İmza anahtarı bulunamadı. --anahtar <dosya> verin veya DESTEKOFIS_RELEASE_KEY ortam değişkenini ayarlayın.");
  if (!["stable", "beta"].includes(values.kanal)) throw new Error("Kanal 'stable' veya 'beta' olmalı.");
  const keyId = keyIdFor(pem, TRUSTED_UPDATE_KEYS);
  if (!keyId) throw new Error("Bu anahtar uygulamanın güvendiği anahtarlar arasında yok (server/lib/update-keys.mjs). Bu imzayla yayımlanan güncelleme kurulumlarda reddedilir.");
  const result = buildUpdatePackage({ root, outDir: path.resolve(values.cikti), privateKeyPem: pem, keyId, trustedKeys: TRUSTED_UPDATE_KEYS, channel: values.kanal, minVersion: values["en-dusuk"] || null });
  console.log(`✓ DestekOfis ${result.version} güncelleme paketi (${values.kanal}, anahtar ${keyId})`);
  console.log(`  ${path.relative(root, result.zipPath)} · ${(result.size / 1024).toFixed(0)} KB · ${result.files} dosya · sha256 ${result.sha256}`);
  console.log(`  ${path.relative(root, result.manifestPath)}`);
  console.log(`\nGitHub'da "v${result.version}" etiketiyle bir yayın (release) oluşturup bu iki dosyayı ekleyin.`);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
