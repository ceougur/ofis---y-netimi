// 2.4.6 paket kanıtı: eski sürümlerin GERÇEK güncelleyicisi (git worktree kopyası) yerel sahte yayın sunucusuna karşı.
// Kullanım: node guncelleyici-denetle.mjs <yayin-klasoru> <kod-koku>=<surum> [...]
// Sunucu iki yolu verir: GitHub API (/repos/<o>/<r>/releases) ve API'siz yedek yol (/<o>/<r>/releases/latest/download/<dosya>).
// "api403" kipinde API 403 döner (istek sınırı benzetimi) → güncelleyici yedek yola düşmeli.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [dir, ...targets] = process.argv.slice(2);
const OWNER = "ceougur", REPO = "ofis---y-netimi";
let mode = "api";
const files = fs.readdirSync(dir).filter(n => /^destekofis-guncelleme/.test(n));
const manifestVersion = JSON.parse(Buffer.from(JSON.parse(fs.readFileSync(path.join(dir, "destekofis-guncelleme.json"), "utf8")).payload, "base64").toString()).version;
const served = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  served.push(`${mode} ${req.method} ${url.pathname}`);
  const base = `http://127.0.0.1:${server.address().port}`;
  if (url.pathname === `/api/repos/${OWNER}/${REPO}/releases`) {
    if (mode === "api403") { res.writeHead(403, { "content-type": "application/json", "x-ratelimit-remaining": "0" }); return res.end('{"message":"API rate limit exceeded"}'); }
    const assets = files.map(name => ({ name, size: fs.statSync(path.join(dir, name)).size, browser_download_url: `${base}/dl/${name}` }));
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify([{ tag_name: `v${manifestVersion}`, draft: false, prerelease: false, html_url: `${base}/rel`, assets }]));
  }
  const m = /^\/(?:dl|web\/[^/]+\/[^/]+\/releases\/latest\/download)\/(.+)$/.exec(url.pathname);
  if (m && files.includes(decodeURIComponent(m[1]))) {
    const p = path.join(dir, decodeURIComponent(m[1]));
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": fs.statSync(p).size });
    return fs.createReadStream(p).pipe(res);
  }
  res.writeHead(404); res.end("yok");
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let bad = 0;
for (const t of targets) {
  const [root, version] = t.split("=");
  const { createUpdater } = await import(pathToFileURL(path.join(root, "server/lib/updater.mjs")).href);
  for (const m of ["api", "api403"]) {
    mode = m;
    const work = fs.mkdtempSync(path.join(path.dirname(new URL(import.meta.url).pathname), `calisma-${version}-${m}-`));
    const u = createUpdater({ appsDir: work, configDir: work, currentVersion: version, bootstrapVersion: 2, nodeVersion: "24.21.0", githubApi: `${base}/api`, githubWeb: `${base}/web` });
    const r = await u.check();
    let dl = "";
    if (r.status === "available") {
      try { const zp = await u.download(r); dl = ` · indirildi + özet doğrulandı (${fs.statSync(zp).size} B)`; } catch (e) { dl = ` · İNDİRME HATASI ${e.code || ""} ${e.message}`; bad++; }
    }
    const expected = process.env.BEKLENEN || (version === manifestVersion ? "up-to-date" : "available");
    if (r.status !== expected) bad++;
    console.log(`[${m}] kurulu ${version} (kod ${path.basename(root)}) → ${r.status}${r.version ? " " + r.version : ""}${r.latestVersion ? " (en yeni " + r.latestVersion + ")" : ""}${r.viaFallback ? " (yedek yol)" : ""}${r.keyId ? " anahtar " + r.keyId : ""}${r.reason ? " · " + r.reason : ""}${dl} · beklenen ${expected} ${r.status === expected ? "TAMAM" : "UYUŞMADI"}`);
  }
}
console.log("sunucuya gelen istekler:\n  " + served.join("\n  "));
server.close();
console.log(bad ? `SONUÇ: ${bad} uyuşmazlık` : "SONUÇ: hepsi beklendiği gibi");
process.exit(bad ? 1 : 0);
