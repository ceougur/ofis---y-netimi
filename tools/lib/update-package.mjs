// Güncelleme paketi (zip) ve imzalı bildirge (destekofis-guncelleme.json) üretimi.
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { signManifest, verifyEnvelope } from "../../server/lib/update-envelope.mjs";
import { MANIFEST_ASSET } from "../../server/lib/updater.mjs";
import { createZip, readZip } from "../../server/lib/zip.mjs";
import { collectAppFiles } from "./app-files.mjs";

export const packageFileName = version => `destekofis-guncelleme-${version}.zip`;

// CHANGELOG.md içinden "## <sürüm>" bölümünü (başlık hariç) döndürür.
export function releaseNotes(changelog, version) {
  const lines = String(changelog || "").split(/\r?\n/);
  const start = lines.findIndex(line => new RegExp(`^##\\s+${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(line));
  if (start < 0) return "";
  const heading = lines[start].replace(/^##\s+/, "").trim();
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  const body = lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
  return `${heading}\n\n${body}`.trim();
}

// Bildirgedeki notlar yönetim panelinde düz metin olarak gösterilir (eski sürümler de dahil):
// Markdown işaretleri (**kalın**, `kod`, "- " maddeler) okunur düz metne çevrilir.
export function plainNotes(markdown) {
  return String(markdown || "")
    .split(/\r?\n/)
    .map(line => line.replace(/^(\s*)[-*]\s+/, "$1• ").replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/`([^`]+)`/g, "$1"))
    .join("\n");
}

// Gizli anahtarın açık kısmını güvenilen anahtar listesinde arar; eşleşen anahtar kimliğini döndürür.
export function keyIdFor(privateKeyPem, trustedKeys) {
  const spki = createPublicKey(createPrivateKey(privateKeyPem)).export({ format: "der", type: "spki" }).toString("base64");
  return Object.entries(trustedKeys).find(([, value]) => value === spki)?.[0] || null;
}

export function buildUpdatePackage({ root, outDir, privateKeyPem, keyId, trustedKeys, channel = "stable", minVersion = null, bootstrap = 2, releasedAt = new Date().toISOString() }) {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const version = pkg.version;
  const files = collectAppFiles(root);
  const zip = createZip(files.map(file => ({ name: file.relative, data: readFileSync(file.full), date: file.mtime })));
  readZip(zip); // üretilen paketi hemen doğrula
  mkdirSync(outDir, { recursive: true });
  const zipName = packageFileName(version);
  writeFileSync(path.join(outDir, zipName), zip);
  const sha256 = createHash("sha256").update(zip).digest("hex");
  let changelog = "";
  try {
    changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  } catch {
    // Sürüm notları isteğe bağlıdır.
  }
  const node = /(\d+\.\d+\.\d+)/.exec(pkg.engines?.node || "")?.[1] || null;
  const manifest = {
    schema: 1,
    product: "DestekOfis",
    version,
    channel,
    releasedAt,
    notes: plainNotes(releaseNotes(changelog, version)),
    package: { name: zipName, size: zip.length, sha256 },
    requires: { ...(minVersion ? { minVersion } : {}), ...(node ? { node } : {}), bootstrap },
  };
  const envelope = signManifest(manifest, privateKeyPem, keyId);
  if (trustedKeys) verifyEnvelope(envelope, trustedKeys); // uygulamanın doğrulayamayacağı bir sürüm yayımlanmasın
  writeFileSync(path.join(outDir, MANIFEST_ASSET), `${JSON.stringify(envelope, null, 2)}\n`);
  // GitHub yayın açıklaması Markdown'ı işler; orada biçimli sürüm kullanılır.
  writeFileSync(path.join(outDir, "SURUM-NOTLARI.md"), `${releaseNotes(changelog, version) || `DestekOfis ${version}`}\n`);
  const manifestSha = createHash("sha256").update(readFileSync(path.join(outDir, MANIFEST_ASSET))).digest("hex");
  writeFileSync(path.join(outDir, "SHA256SUMS"), `${sha256}  ${zipName}\n${manifestSha}  ${MANIFEST_ASSET}\n`);
  return { version, manifest, zipPath: path.join(outDir, zipName), manifestPath: path.join(outDir, MANIFEST_ASSET), sha256, size: zip.length, files: files.length };
}
