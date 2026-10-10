// Ölçüm (tek başına koşulur): gizli (arka plandaki / küçültülmüş) bir DestekOfis sekmesi sunucuya hangi istekleri, ne sıklıkla
// gönderiyor? Servis yöneticisinin "15 dakikadır istek yok = boşta" kuralı bu isteklerle bozuluyor mu?
// Gerçek: ayrı süreçte servis + uygulama, gerçek Chromium sekmesi, gerçek saat (süre kısaltması yok). Sekmenin gizli olduğu,
// tarayıcının bildirdiği görünürlük bilgisi sayfa içinden taklit edilerek sağlanır (bu ortamda gerçek pencere küçültme yok).
// Çalıştırma: node test/guncelleme-gercek/gizli-sekme-olcum.mjs [dakika=20] [çıktı.json]
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { prepareInstall, sleep, STAFF, startFeed, startService, writeJson } from "./ortak.mjs";

const minutes = Number(process.argv[2] || 20);
const out = process.argv[3] || null;
const work = mkdtempSync(path.join(tmpdir(), "destekofis-gizli-"));
const installRoot = path.join(work, "kurulum");
await prepareInstall(installRoot);
const feed = await startFeed({ releases: [] });
const service = await startService(installRoot, { feed: feed.url, retryDelays: [] });
const port = service.port;
const log = [];
const server = http.createServer((req, res) => {
  log.push({ at: Date.now(), method: req.method, path: (req.url || "/").split("?")[0], counts: !/^\/api\/(health|discovery)\b/.test(req.url || "") });
  const upstream = http.request({ host: "127.0.0.1", port, method: req.method, path: req.url, headers: req.headers, agent: false }, response => {
    res.writeHead(response.statusCode || 502, response.headers);
    res.flushHeaders?.();
    response.pipe(res);
  });
  upstream.on("error", () => (res.headersSent ? res.destroy() : (res.writeHead(502), res.end())));
  res.on("close", () => !res.writableFinished && upstream.destroy());
  req.pipe(upstream);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
let reloads = 0;
page.on("load", () => (reloads += 1));
await page.goto(`${base}/`);
await page.fill("#hof-auth input[name=username]", STAFF.username);
await page.fill("#hof-auth input[name=password]", STAFF.password);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60_000 });
await sleep(5000);
const loadsBeforeHide = reloads;
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
});
const hiddenAt = Date.now();
await sleep(minutes * 60_000);
const stillHidden = await page.evaluate(() => document.hidden).catch(() => null);
const after = log.filter(item => item.counts && item.at > hiddenAt).map(item => ({ dkSonra: Math.round(((item.at - hiddenAt) / 60_000) * 100) / 100, yol: `${item.method} ${item.path}` }));
const result = { dakika: minutes, gizlendi: new Date(hiddenAt).toISOString(), sayfaYenilenmesi: reloads - loadsBeforeHide, sonundaHalaGizli: stillHidden, gizliykenSayilanIstek: after.length, istekler: after };
console.log(JSON.stringify(result, null, 2));
if (out) writeJson(out, result);
// Beklenen (önerilen ürün davranışı): gizli sekme sunucuyu "meşgul" tutacak istek göndermez. Bugünkü kodda KIRMIZI (5 dk'da bir
// tablo eşitlemesi: GET /api/trpc/sheets.getRows + GET /api/workspace/dues).
const ok = result.sonundaHalaGizli === true && result.sayfaYenilenmesi === 0;
const quiet = after.length === 0;
console.log(`  ${ok ? "✓" : "✗"} sekme ölçüm boyunca gizli kaldı, sayfa yenilenmedi`);
console.log(`  ${quiet ? "✓" : "✗"} gizli sekme ${minutes} dk boyunca sayılan istek göndermedi (${after.length} istek)`);
console.log(`\n${ok && quiet ? "TAMAM" : "BAŞARISIZ"}: ${Number(ok) + Number(quiet)} denetim geçti, ${2 - Number(ok) - Number(quiet)} başarısız.`);
process.exitCode = ok && quiet ? 0 : 1;
await browser.close();
server.close();
await service.stop();
await feed.close();
rmSync(work, { recursive: true, force: true });
