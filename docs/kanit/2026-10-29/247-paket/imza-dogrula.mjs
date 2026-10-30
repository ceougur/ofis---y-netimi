import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const R = "/home/user/ofis---y-netimi";
const { verifyEnvelope, assessManifest } = await import(`${R}/server/lib/update-envelope.mjs`);
const { TRUSTED_UPDATE_KEYS } = await import(`${R}/server/lib/update-keys.mjs`);
const env = JSON.parse(readFileSync(process.argv[2], "utf8"));
const zip = readFileSync(process.argv[3]);
const res = verifyEnvelope(env, TRUSTED_UPDATE_KEYS);
const m = res.manifest || res;
console.log("verify:", JSON.stringify({ ok: res.ok ?? true, keyId: res.keyId, version: m.version }));
const sha = createHash("sha256").update(zip).digest("hex");
console.log("zip sha esit:", sha === m.package.sha256, "boyut esit:", zip.length === m.package.size);
for (const cur of ["2.4.6", "2.4.5", "2.4.4", "2.1.0", "2.4.7"]) console.log("assess", cur, JSON.stringify(assessManifest(m, { currentVersion: cur, nodeVersion: "22.13.0", bootstrapVersion: 2 })));
// tahrif: bir bayt değiştir → reddedilmeli
const bad = { ...env, payload: Buffer.from(Buffer.from(env.payload, "base64").toString().replace("2.4.7", "2.4.8")).toString("base64") };
try { const r = verifyEnvelope(bad, TRUSTED_UPDATE_KEYS); console.log("TAHRIF KABUL EDILDI?!", JSON.stringify(r).slice(0, 100)); } catch (e) { console.log("tahrif reddedildi:", e.message); }
// zip'te bir bayt değiştir → özet tutmamalı
const z2 = Buffer.from(zip); z2[1000] ^= 1;
console.log("tahrifli zip sha esit:", createHash("sha256").update(z2).digest("hex") === m.package.sha256);
// imza baytı değiştir → reddedilmeli
const sigBad = JSON.parse(JSON.stringify(env)); const s0 = sigBad.signatures[0]; const k = Object.keys(s0).find(x => /sig/i.test(x) && x !== "keyId");
const sb = Buffer.from(s0[k], "base64"); sb[5] ^= 1; s0[k] = sb.toString("base64");
try { verifyEnvelope(sigBad, TRUSTED_UPDATE_KEYS); console.log("BOZUK IMZA KABUL?!"); } catch (e) { console.log("bozuk imza reddedildi:", e.message); }
console.log("imza keyId:", env.signatures.map(s => s.keyId).join(","));
