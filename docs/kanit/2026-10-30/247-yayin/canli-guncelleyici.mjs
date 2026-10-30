// 2.4.7 yayın sonrası: eski sürümlerin GERÇEK güncelleyicisi, GERÇEK GitHub yayınına karşı (varsayılan adresler). Lisans servisine istek yok (yalnız updater).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
let bad = 0;
for (const t of process.argv.slice(2)) {
  const [root, version] = t.split("=");
  const { createUpdater } = await import(pathToFileURL(path.join(root, "server/lib/updater.mjs")).href);
  const work = fs.mkdtempSync(path.join(path.dirname(new URL(import.meta.url).pathname), `calisma-${version}-`));
  const u = createUpdater({ appsDir: work, configDir: work, currentVersion: version, bootstrapVersion: 2, nodeVersion: "24.21.0" });
  const r = await u.check();
  let dl = "";
  if (r.status === "available") {
    try { const zp = await u.download(r); dl = ` · indirildi + özet doğrulandı (${fs.statSync(zp).size} B)`; } catch (e) { dl = ` · İNDİRME HATASI ${e.code || ""} ${e.message}`; bad++; }
  }
  const ok = r.status === "available" && r.version === "2.4.7";
  if (!ok) bad++;
  console.log(`kurulu ${version} → ${r.status}${r.version ? " " + r.version : ""}${r.viaFallback ? " (yedek yol)" : ""}${r.keyId ? " anahtar " + r.keyId : ""}${r.reason ? " · " + r.reason : ""}${dl} · ${ok ? "TAMAM" : "UYUŞMADI"}`);
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(bad ? `SONUÇ: ${bad} uyuşmazlık` : "SONUÇ: hepsi available 2.4.7");
process.exit(bad ? 1 : 0);
