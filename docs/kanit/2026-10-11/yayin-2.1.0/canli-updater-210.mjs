// Gerçek güncelleyici (createUpdater), CANLI GitHub'a karşı: kurulu eski sürümler gibi.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
const { createUpdater } = await import(process.env.UPDATER || "/home/user/ofis---y-netimi/server/lib/updater.mjs");
const want = crypto.createHash("sha256").update(readFileSync("/home/user/ofis---y-netimi/dist/teslim-2.1.0/GitHub-v2.1.0/destekofis-guncelleme-2.1.0.zip")).digest("hex");
const real = globalThis.fetch;
const apiOff = async (url, o) => String(url).startsWith("https://api.github.com/") ? new Response("blocked", { status: 403 }) : real(url, o);
let bad = 0;
for (const apiDown of [false, true]) for (const v of ["2.0.26","2.0.25","2.0.24","2.0.23","2.0.22","2.0.21","2.0.20","2.0.19","2.0.18","2.0.17","2.0.4","1.7.0","2.1.0"]) {
  const root = mkdtempSync(path.join(tmpdir(), "upd-"));
  try {
    const up = createUpdater({ appsDir: path.join(root, "apps"), configDir: path.join(root, "cfg"), currentVersion: v, fetchImpl: apiDown ? apiOff : real, nodeVersion: "24.21.0", bootstrapVersion: 2, checkRetryDelaysMs: [] });
    const found = await up.check();
    let dl = "";
    if (found.status === "available") {
      const got = await up.download(found);
      const file = typeof got === "string" ? got : got?.path || got?.file || got?.zipPath;
      dl = file ? `indirildi, sha256 ${crypto.createHash("sha256").update(readFileSync(file)).digest("hex") === want ? "EŞLEŞTİ" : "EŞLEŞMEDİ"}` : `indirme: ${JSON.stringify(got).slice(0, 120)}`;
    }
    const good = v === "2.1.0" ? found.status === "up-to-date" : (found.status === "available" && found.version === "2.1.0" && found.keyId === "destekofis-2026-1" && /EŞLEŞTİ/.test(dl));
    if (!good) bad += 1;
    console.log(`${good ? "✓" : "✗"} kurulu ${v.padEnd(6)} ${apiDown ? "(API kapalı → yedek yol)" : "(GitHub API)"}: ${found.status} ${found.version || found.reason || ""} ${found.keyId ? "anahtar " + found.keyId : ""} ${dl}`);
  } catch (e) { bad += 1; console.log(`✗ kurulu ${v} ${apiDown ? "(yedek yol)" : "(API)"}: HATA ${e.message}`); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
process.exit(bad ? 1 : 0);
