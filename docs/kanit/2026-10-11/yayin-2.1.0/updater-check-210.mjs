// İmzalı 2.1.0 paketini gerçek güncelleyiciyle (createUpdater) eski sürümler gibi denetler; GitHub sahte fetch ile.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
const { createUpdater } = await import(process.env.UPDATER || "/home/user/ofis---y-netimi/server/lib/updater.mjs");
const dir = "/home/user/ofis---y-netimi/dist/guncelleme";
const manifestBuf = readFileSync(path.join(dir, "destekofis-guncelleme.json"));
const zipBuf = readFileSync(path.join(dir, "destekofis-guncelleme-2.1.0.zip"));
const envelope = JSON.parse(manifestBuf);
const manifest = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
const releases = [{ tag_name: "v2.1.0", prerelease: false, draft: false, html_url: "https://github.com/ceougur/ofis---y-netimi/releases/tag/v2.1.0", assets: [
  { name: "destekofis-guncelleme.json", browser_download_url: "https://dl.test/destekofis-guncelleme.json", size: manifestBuf.length },
  { name: "destekofis-guncelleme-2.1.0.zip", browser_download_url: "https://dl.test/destekofis-guncelleme-2.1.0.zip", size: zipBuf.length },
] }];
const make = apiDown => async url => {
  const u = String(url);
  if (u.startsWith("https://api.github.com/")) return apiDown ? new Response("rate limit", { status: 403 }) : new Response(JSON.stringify(releases), { status: 200, headers: { "content-type": "application/json" } });
  if (u.endsWith("destekofis-guncelleme.json")) return new Response(manifestBuf, { status: 200, headers: { "content-type": "application/json" } });
  if (u.endsWith("destekofis-guncelleme-2.1.0.zip")) return new Response(zipBuf, { status: 200, headers: { "content-type": "application/zip", "content-length": String(zipBuf.length) } });
  return new Response("", { status: 404 });
};
const sha = crypto.createHash("sha256").update(zipBuf).digest("hex");
console.log(`bildirge: sürüm ${manifest.version}, paket ${manifest.package?.name}, sha256 ${String(manifest.package?.sha256).slice(0, 12)}… (dosya ${sha.slice(0, 12)}…)`);
let bad = 0;
for (const apiDown of [false, true]) for (const v of ["2.0.26", "2.0.25", "2.0.24", "2.0.23", "2.0.22", "2.0.21", "2.0.20", "2.0.4", "1.7.0"]) {
  const root = mkdtempSync(path.join(tmpdir(), "upd-"));
  try {
    const up = createUpdater({ appsDir: path.join(root, "apps"), configDir: path.join(root, "cfg"), currentVersion: v, fetchImpl: make(apiDown), nodeVersion: "24.21.0", bootstrapVersion: 2, checkRetryDelaysMs: [] });
    const found = await up.check();
    let dl = "";
    if (found.status === "available") {
      const got = await up.download(found);
      const file = typeof got === "string" ? got : got?.path || got?.file || got?.zipPath;
      dl = file ? `indirildi, sha256 ${crypto.createHash("sha256").update(readFileSync(file)).digest("hex") === sha ? "EŞLEŞTİ" : "EŞLEŞMEDİ"}` : `indirme: ${JSON.stringify(got).slice(0, 120)}`;
    }
    const good = found.status === "available" && found.version === "2.1.0" && found.keyId === "destekofis-2026-1" && /EŞLEŞTİ/.test(dl);
    if (!good) bad += 1;
    console.log(`${good ? "✓" : "✗"} kurulu ${v.padEnd(6)} ${apiDown ? "(API kapalı → yedek yol)" : "(GitHub API)"}: ${found.status} ${found.version || found.reason || ""} anahtar ${found.keyId || "-"} · ${dl}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
// Kurcalanmış bildirge reddedilmeli.
const forged = { ...manifest, version: "2.0.99" };
const tampered = Buffer.from(JSON.stringify({ ...envelope, payload: Buffer.from(JSON.stringify(forged)).toString("base64") }));
const root = mkdtempSync(path.join(tmpdir(), "upd-"));
const up = createUpdater({ appsDir: path.join(root, "apps"), configDir: path.join(root, "cfg"), currentVersion: "2.0.22", fetchImpl: async url => String(url).endsWith(".json") ? new Response(tampered, { status: 200 }) : make(false)(url), nodeVersion: "24.21.0", bootstrapVersion: 2, checkRetryDelaysMs: [] });
const t = await up.check();
console.log(`${t.status !== "available" ? "✓" : "✗"} kurcalanmış bildirge reddedildi: ${t.status} — ${t.reason || ""}`);
if (t.status === "available") bad += 1;
rmSync(root, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
