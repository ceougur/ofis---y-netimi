// senaryo-banka-210 adım 41'in ara sıra kırmızısının yeniden üretimi (10.10.2026: "console [adım 41.] TypeError: notes.notes is not iterable").
// Kök neden: açılış yükleyicisi (client/assets/hof-boot.js loadClientState) sayfa açılırken kendi isteğini (kullanıcı değil, ARKA PLAN —
// açılışın merkezi notları) gönderir. Test o sırada sayfayı yeniden yüklerse (adım 41: Excel "Değiştir" ile gelen yeniden yükleme hemen ardından
// admin.goto("/")) yanıtın başlığı gelmiş ama gövdesi henüz okunmamış olabilir; tarayıcı gezinmede gövde okumayı keser, HOF.api gövdeyi
// okuyamayınca `{}` döner (hof-core.js sendApi: response.json().catch(() => ({}))), yükleyici `{}.notes`'u dolaşırken TypeError atar ve
// açılışın catch'i bunu console.error ile yazar (ekranda "Sunucuya bağlanılamadı"). Aynı açık client-state yanıtında da var
// (applySettings(undefined) → "Cannot read properties of undefined").
// Ders 20: ön koşul ZORLA kurulur — uygulamanın önüne konan küçük vekil sunucu hedef isteğin (ilk açılıştaki GET case-notes ya da
// client-state) başlığını hemen gönderir, gövdesini --bekle ms tutar; gövde tutulurken sayfa yeniden yüklenir. Ön koşul ancak tarayıcı
// tutulan gövdeyi beklerken bağlantıyı kestiyse (gövde hiç gönderilemediyse) OLUŞTU sayılır; yeşil yalnız o denemelerden sayılır.
// --kontrol n (testin DİŞİ; her hedefte n deneme, varsayılan 1): gezinme YOK; vekil tutulan gövdenin bağlantısını kendisi keser (ağ koptu). Bu gerçek bir arızadır ve SAKLANMAMALI:
//   açılış "Sunucuya bağlanılamadı" ekranını anlamlı nedenle ("yanıtı yarıda kesildi") gösterir ve konsol hatası toplayıcıya düşer (beklenen ≥ 1).
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/acilis-yanit-yaris.mjs --deneme 5 --hedef case-notes,client-state
import fs, { mkdtempSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { installPageClock } from "../helpers.mjs";
import { fetchCutWatch } from "./tarayici-kesme.mjs";

const { values: opts } = parseArgs({ options: { deneme: { type: "string", default: "5" }, bekle: { type: "string", default: "2500" }, hedef: { type: "string", default: "case-notes,client-state" }, kontrol: { type: "string", default: "1" } } });
const CONTROLS = Number(opts.kontrol);
const TRIALS = Number(opts.deneme);
const HOLD = Number(opts.bekle);
const TARGETS = { "case-notes": "/api/workspace/case-notes", "client-state": "/api/workspace/client-state" };
const targets = opts.hedef.split(",").map(item => item.trim()).filter(Boolean);
for (const name of targets) if (!TARGETS[name]) throw new Error(`bilinmeyen hedef: ${name}`);
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";

const browser = await chromium.launch();
let passed = 0;
let failed = 0;
let formed = 0;

async function trial(no, target, CONTROL = false) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-acilis-yaris-"));
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f42" } });
  const { port: appPort } = await app.listen(0, "127.0.0.1");
  // Vekil: her isteği uygulamaya iletir; "arm" açıkken hedef yoldaki İLK GET isteğinin (since'siz — açılış) gövdesini tutar.
  const held = { armed: false, hit: null };
  let releaseHeld = () => {};
  const proxy = http.createServer((req, res) => {
    const upstream = http.request({ host: "127.0.0.1", port: appPort, method: req.method, path: req.url, headers: req.headers }, answer => {
      const url = new URL(req.url, "http://x");
      const hold = held.armed && !held.hit && req.method === "GET" && url.pathname === TARGETS[target] && !url.searchParams.get("since");
      if (!hold) {
        res.writeHead(answer.statusCode, answer.headers);
        answer.pipe(res);
        return;
      }
      held.armed = false;
      const chunks = [];
      answer.on("data", chunk => chunks.push(chunk));
      answer.on("end", () => {
        const hit = { path: url.pathname, query: url.search, status: answer.statusCode, at: Date.now(), headersSent: true, bodyDelivered: false, clientClosedWhileHeld: false, origin: req.headers["sec-fetch-mode"] === "navigate" ? "gezinme" : "sayfa betiği (fetch)" };
        held.hit = hit;
        res.writeHead(answer.statusCode, answer.headers);
        res.flushHeaders();
        const timer = setTimeout(() => {
          if (res.destroyed) return;
          if (CONTROL) {
            res.destroy();
            return;
          }
          hit.bodyDelivered = true;
          res.end(Buffer.concat(chunks));
        }, HOLD);
        res.on("close", () => {
          if (!hit.bodyDelivered) hit.clientClosedWhileHeld = true;
          clearTimeout(timer);
        });
        releaseHeld = () => clearTimeout(timer);
      });
    });
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
  const BASE = `http://127.0.0.1:${proxy.address().port}`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const errors = [];
  try {
    await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const page = await context.newPage();
    const watch = fetchCutWatch(page);
    // ACILIS_TANI=1: gövde okuması kesildiğinde sayfanın hangi ayrılma olaylarını gördüğü (hata ayıklama satırı; denetim değil).
    if (process.env.ACILIS_TANI === "1") {
      await context.addInitScript(() => {
        const seen = [];
        for (const type of ["beforeunload", "pagehide"]) addEventListener(type, () => seen.push(type));
        const json = Response.prototype.json;
        Response.prototype.json = function patched() {
          return json.call(this).catch(error => {
            console.log(`TANI gövde okunamadı (${error.name}); görülen ayrılma olayları: ${seen.join(",") || "yok"}`);
            throw error;
          });
        };
      });
      page.on("console", message => /^TANI/.test(message.text()) && console.log(`  · ${message.text()}`));
    }
    // senaryo-banka-210'un hata toplayıcısıyla aynı süzgeç.
    page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
    page.on("console", message => {
      if (message.type() === "error" && !/status of 40[0139]|api\/auth\/me|Failed to load resource/.test(`${message.text()} ${message.location().url}`) && !watch.defer(`console ${message.text()}`)) errors.push(`console ${message.text()}`);
    });
    await installPageClock(page, app.config.now);
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.waitForTimeout(500);
    const before = errors.length;
    // Adım 41'in sırası: sayfa yeniden yüklenir (açılış başlar) ve açılış daha bitmeden ikinci kez "/" açılır.
    held.armed = true;
    if (CONTROL) {
      await page.goto(`${BASE}/`, { waitUntil: "load" });
      const fatal = await page.waitForSelector(".hof-auth .hof-auth-help", { timeout: HOLD + 10000 }).then(node => node.textContent()).catch(() => "");
      await page.waitForTimeout(500);
      const counted = errors.slice(before);
      const pre = Boolean(held.hit && !held.hit.bodyDelivered);
      if (pre) formed += 1;
      const good = pre && /yarıda kesildi/.test(fatal) && counted.length >= 1;
      if (good) passed += 1;
      else failed += 1;
      console.log(`${good ? "✓" : "✗"} kontrol ${no} (hedef ${target}, gezinme yok, gövde bağlantısı vekilce kesildi): ön koşul ${pre ? "OLUŞTU" : "OLUŞMADI"}; ekrandaki neden “${fatal.trim()}”; toplayıcının saydığı hata ${counted.length} (beklenen ≥ 1)${counted.length ? `: ${counted.map(item => item.split("\n")[0]).join(" | ")}` : ""}`);
      return;
    }
    await page.goto(`${BASE}/`, { waitUntil: "commit" });
    const deadline = Date.now() + 15000;
    while (!held.hit && Date.now() < deadline) await page.waitForTimeout(20);
    if (held.hit) await page.waitForTimeout(150);
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await page.waitForTimeout(1500);
    releaseHeld();
    errors.push(...watch.unexplained());
    const counted = errors.slice(before);
    const hit = held.hit;
    const pre = Boolean(hit?.clientClosedWhileHeld);
    if (pre) formed += 1;
    const good = pre && counted.length === 0;
    if (good) passed += 1;
    else failed += 1;
    console.log(`${good ? "✓" : "✗"} deneme ${no} (hedef ${target}, gövde +${HOLD} ms): düşen istek ${hit ? `GET ${hit.path}${hit.query} ${hit.status} — ${hit.origin}, açılış yükleyicisinin isteği (kullanıcı eylemi değil)` : "YOK"}; ön koşul (başlık geldi, gövde tutulurken tarayıcı kesti) ${pre ? "OLUŞTU" : "OLUŞMADI — deneme sayılmaz"}; toplayıcının saydığı hata ${counted.length}${counted.length ? `: ${counted.map(item => item.split("\n")[0]).join(" | ")}` : ""}`);
  } catch (error) {
    failed += 1;
    console.log(`✗ deneme ${no} (hedef ${target}): beklenmeyen hata ${error.message.split("\n")[0]}`);
  } finally {
    releaseHeld();
    await context.close().catch(() => null);
    const closed = new Promise(resolve => proxy.close(resolve));
    proxy.closeAllConnections?.();
    await closed;
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

try {
  for (const target of targets) {
    for (let no = 1; no <= TRIALS; no += 1) await trial(no, target);
    for (let no = 1; no <= CONTROLS; no += 1) await trial(no, target, true);
  }
} finally {
  await browser.close();
}
console.log(`\nön koşul oluşan deneme: ${formed}/${(TRIALS + CONTROLS) * targets.length} (gezinme ${TRIALS * targets.length}, kontrol ${CONTROLS * targets.length})`);
console.log(`${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
process.exitCode = failed ? 1 : 0;
