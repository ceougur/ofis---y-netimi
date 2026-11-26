import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const Y = path.dirname(new URL(import.meta.url).pathname); let bad = 0;
for (const v of ["2.4.8", "2.4.7"]) {
  const { createUpdater } = await import(pathToFileURL(path.join(Y, `kod-${v}`, "server/lib/updater.mjs")).href);
  const work = fs.mkdtempSync(path.join(Y, `calisma-${v}-`));
  const u = createUpdater({ appsDir: work, configDir: work, currentVersion: v, bootstrapVersion: 2, nodeVersion: "24.21.0" });
  const r = await u.check(); let dl = "";
  if (r.status === "available") { const zp = await u.download(r); const { createHash } = await import("node:crypto"); dl = ` indirildi ${fs.statSync(zp).size} B sha ${createHash("sha256").update(fs.readFileSync(zp)).digest("hex").slice(0,16)}`; }
  if (!(r.status === "available" && r.version === "2.4.9")) bad++;
  console.log(`kurulu ${v} (gerçek v${v} kodu, varsayılan GitHub adresleri) → ${r.status} ${r.version || ""}${r.viaFallback ? " (yedek yol)" : ""}${r.keyId ? " anahtar " + r.keyId : ""}${dl}`);
}
console.log(bad ? `SONUÇ: ${bad} uyuşmazlık` : "SONUÇ: hepsi beklendiği gibi"); process.exit(bad ? 1 : 0);
