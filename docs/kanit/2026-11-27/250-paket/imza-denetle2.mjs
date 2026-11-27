import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const root = process.argv[2];
const { verifyEnvelope } = await import(root + "/server/lib/update-envelope.mjs");
const { TRUSTED_UPDATE_KEYS } = await import(root + "/server/lib/update-keys.mjs");
const env = JSON.parse(readFileSync(root + "/dist/guncelleme/destekofis-guncelleme.json", "utf8"));
const { manifest, keyId } = verifyEnvelope(env, TRUSTED_UPDATE_KEYS);
const ham = Buffer.from(env.payload, "base64").toString("utf8");
const zipSha = createHash("sha256").update(readFileSync(root + "/dist/guncelleme/destekofis-guncelleme-2.5.0.zip")).digest("hex");
console.log("GEÇERLİ imza, anahtar:", keyId, "sürüm:", manifest.version, "kanal:", manifest.channel);
console.log("zip sha256 bildirgede:", ham.includes(zipSha));
const p = JSON.parse(ham); p.version = "2.5.9";
const bozuk = { ...env, payload: Buffer.from(JSON.stringify(p)).toString("base64") };
try { verifyEnvelope(bozuk, TRUSTED_UPDATE_KEYS); console.log("BOZULMUŞ KABUL EDİLDİ — HATA"); } catch (e) { console.log("bozulmuş bildirge:", e.code); }
