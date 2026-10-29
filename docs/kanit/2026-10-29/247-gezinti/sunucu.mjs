// 2.4.7 SON ADAY — kullanıcı gözüyle gezinti (masaüstü + MOBİL). Örnek düzen: docs/kanit/2026-10-24/245-gezinti/sunucu.mjs.
// Programı ÜRÜN varsayılanlarıyla açar (server/server.mjs: edocEnabled, edocLive, esmmEnabled, mobileKapi; legacy anahtarları KAPALI, mobil özet zamanlayıcısı AÇIK),
// İŞ SAATİ sahte ve akar (config.now, GEZINTI_GUN 10:00 TR'den; masaüstü tarayıcı saati de aynı), uzaktan erişim saati (config.remoteNow) gerçek andan başlayıp akan
// DENETLENEBİLİR saat (bilgisayar saati kayması adımı için), lisans servisi ve kapıcı YEREL ve sahte (test/kapi-yerel.mjs startKapi, https kendinden imzalı; Cloudflare'e,
// gerçek lisans servisine istek YOK — ders 30), tünel = programın kendi tünel yöneticisi + sahte cloudflared (test/fixtures/sahte-cloudflared.mjs; programın yazdığı
// yapılandırmayla uzak dinleyiciye ters vekil açar) → kapıcının canlı istekleri o vekile gider (üretimdeki yol: kapıcı → tünel → uzak dinleyici).
// Telefonun adresi üretimdeki gibi ofisin alt adı (https://<ofis>.destekofis.test; --host-resolver-rules kapıcıya yönlendirir).
// Adımlar CDP yerine bu sürecin DENETİM ucuna (POST /adim) gönderilir: aynı Playwright nesneleri (gerçek tıklama, klavye) + program/kapıcı/saat denetimi tek yerde.
// Kullanım: flock <kilit> node sunucu.mjs <depo> <veri-klasörü>   (adım: node adim.mjs <veri-klasörü> <ekran-adı> [--hedef desk|<telefon>] [--tam] < kod.js)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repo, root] = process.argv.slice(2).map(p => path.resolve(p));
if (!repo || !root) throw new Error("kullanım: node sunucu.mjs <depo> <veri-klasörü>");
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
process.env.TZ = "Europe/Istanbul";
mkdirSync(root, { recursive: true });
const imp = rel => import(pathToFileURL(path.join(repo, rel)).href);
const { createApp } = await imp("server/app.mjs");
const { createClock } = await imp("server/lib/clock.mjs");
const { startMockEdm } = await imp("test/einvoice-mock.mjs");
const { startKapi } = await imp("test/kapi-yerel.mjs");
const { lisansAnahtari } = await imp("test/kapi-ortak.mjs");
const { createClient } = await imp("test/helpers.mjs");
const { chromium } = await import(pathToFileURL(path.join(repo, "node_modules", "playwright", "index.mjs")).href);
const { DatabaseSync } = await import("node:sqlite");

const GUN = process.env.GEZINTI_GUN || "2026-10-21";
const clock = createClock({ time: `${GUN}T10:00:00+03:00` }); // iş saati (akar)
const remoteNow = createClock({ time: Date.now() }); // bilgisayarın saati (uzaktan erişim + lisans); kayma adımında ileri/geri alınır
const PASS = "Gezinti-Yonetici-2026!";
const MACHINE = "c7".repeat(16);
const FAKE_CF = path.join(repo, "test", "fixtures", "sahte-cloudflared.mjs");
const CF_LOG = path.join(root, "cf.log");
const lisans = lisansAnahtari("gezinti-247");
const world = { kind: "license", expiresAt: null, online: true, gateCalls: 0, licenseCalls: 0 };
const token = machine => lisans.belirtec({ at: Date.now(), machine, kind: world.kind, expiresAt: world.expiresAt, licenseId: world.kind === "trial" ? "DEN-GEZ-247" : "LIS-GEZ-247" });
const log = [];
const yazLog = line => { log.push(line); appendFileSync(path.join(root, "olaylar.log"), `${new Date().toISOString()} ${line}\n`); };
// Adım kodunda asılı kalan bekleme sözü (ör. tıklama düşünce waitForResponse) süreci düşürmesin; günlüğe yazılır (07 ilk denemesi süreci düşürdü).
process.on("unhandledRejection", error => yazLog(`asılı söz: ${String(error?.message || error).split("\n")[0]}`));

const edm = await startMockEdm();
const kapi = await startKapi({
  now: () => Date.now(), // Cloudflare'in saati = gerçek saat
  tls: true,
  trustedKeys: lisans.trusted,
  lisansFetch: async (_url, init) => {
    if (!world.online) throw new TypeError("fetch failed");
    return { json: async () => ({ ok: true, token: token(JSON.parse(init.body).machine) }) };
  },
});
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (gezinti): ${url}`);
  return globalThis.fetch(input, init);
};
let app = null;
let base = "";
let ofisId = "";
const gate = {
  provision: async () => {
    world.gateCalls += 1;
    const id = ofisId || (await app.mobileSync.ofis()).id;
    return { tunnelId: "12345678-1234-4234-8234-1234567890ab", hostname: `${id}.destekofis.test`, publicUrl: `https://${id}.destekofis.test`, token: "calistirma-belirteci-sahte" };
  },
};
async function startProgram() {
  app = createApp({
    dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, fetchImpl, now: clock, remoteNow,
    edocEnabled: true, edocLive: true, esmmEnabled: true,
    mobileKapiUrl: kapi.base, mobileOfficeUrl: "https://{ofis}.destekofis.test", mobileKapiFetch: (...a) => globalThis.fetch(...a),
    tunnel: { gate, runner: { command: process.execPath, argsPrefix: [FAKE_CF, "--sahte-log", CF_LOG, "--sahte-mod", "bagli"], identity: FAKE_CF }, root: path.join(root, "bilesen") },
    env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
    license: {
      enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.gezinti247.test/api/lisans"], machineId: MACHINE, now: () => remoteNow.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false,
      fetchImpl: async () => {
        world.licenseCalls += 1;
        if (!world.online) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
        return { status: 200, json: async () => ({ ok: true, token: token(MACHINE) }) };
      },
    },
    startLicenseTimers: false,
  });
  const { port } = await app.listen(Number(process.env.GEZINTI_PORT || 5247), "127.0.0.1");
  base = `http://127.0.0.1:${port}`;
  if (app.license.status().state !== "licensed" && world.kind === "license") await app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
  ofisId = (await app.mobileSync.ofis()).id;
  yazLog(`program açıldı ${base} ofis ${ofisId} lisans ${app.license.status().state}`);
}
async function stopProgram() {
  await app.close();
  kapi.tunel(ofisId, null);
  yazLog("program kapandı");
}
// Sahte cloudflared her açılışta günlüğe yerel vekil portunu yazar → kapıcının canlı yolu o vekile (tünel). Süreç kapanınca yol düşer.
let cfLast = "";
setInterval(() => {
  if (!existsSync(CF_LOG) || !ofisId) return;
  const lines = readFileSync(CF_LOG, "utf8").trim().split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return {}; } }).filter(l => l.port);
  const last = lines.at(-1);
  if (!last) return;
  let alive = true;
  try { process.kill(last.pid, 0); } catch { alive = false; }
  const key = `${last.pid}:${last.port}:${alive}`;
  if (key === cfLast) return;
  cfLast = key;
  kapi.tunel(ofisId, alive ? `http://127.0.0.1:${last.port}` : null);
  yazLog(`tünel ${alive ? "açık" : "kapalı"} pid ${last.pid} port ${last.port} → ${last.service}`);
}, 250).unref?.();

await startProgram();

const browser = await chromium.launch({
  headless: true,
  args: [`--host-resolver-rules=MAP *.destekofis.test 127.0.0.1:${kapi.tlsPort}`, "--ignore-certificate-errors", "--no-proxy-server", "--lang=tr-TR"],
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/proxy/i.test(key))),
});
const errors = [];
const deskContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR", timezoneId: "Europe/Istanbul", acceptDownloads: true });
await deskContext.clock.install({ time: clock.ms() });
const desk = await deskContext.newPage();
desk.on("console", msg => { if (msg.type() === "error") errors.push(`masaüstü: ${msg.text().slice(0, 300)}`); });
desk.on("pageerror", err => errors.push(`masaüstü pageerror: ${String(err.message || err).slice(0, 300)}`));
await desk.goto(`${base}/`);
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const phones = {};
async function newPhone(name, { width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, userAgent: IPHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2, ignoreHTTPSErrors: true, locale: "tr-TR", timezoneId: "Europe/Istanbul", acceptDownloads: true });
  const page = await context.newPage();
  page.on("console", msg => { if (msg.type() === "error") errors.push(`${name}: ${msg.text().slice(0, 300)}`); });
  page.on("pageerror", err => errors.push(`${name} pageerror: ${String(err.message || err).slice(0, 300)}`));
  page.setDefaultTimeout(20000);
  phones[name] = page;
  return page;
}
const napi = createClient(base);
const sqlFile = (file, q, ...args) => { const db = new DatabaseSync(file, { readOnly: true }); try { return db.prepare(q).all(...args); } finally { db.close(); } };
const vars = {};
const AsyncFunction = (async () => {}).constructor;

const control = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (req.url === "/kapat") { res.end("{}"); await shutdown(); return; }
  const notes = [];
  const yaz = (...a) => notes.push(a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  const target = () => (body.hedef && body.hedef !== "desk" ? phones[body.hedef] : desk);
  const errStart = errors.length;
  const api = (url, method = "GET", data, page = desk) => page.evaluate(async ({ url, method, data }) => {
    const r = await fetch(url, { method, credentials: "same-origin", headers: data ? { "content-type": "application/json" } : {}, body: data ? JSON.stringify(data) : undefined });
    const text = await r.text();
    let d = text; try { d = JSON.parse(text); } catch {}
    return { status: r.status, data: d };
  }, { url, method, data });
  const g = {
    desk, phones, newPhone, browser, kapi, world, clock, remoteNow, edm, napi, vars, root, repo, yaz, api,
    app: () => app, base: () => base, ofisId: () => ofisId, startProgram, stopProgram, cfLog: () => (existsSync(CF_LOG) ? readFileSync(CF_LOG, "utf8") : ""),
    bekle: ms => new Promise(r => setTimeout(r, ms)),
    typeSlow: async (page, text, delay = 40) => { for (const ch of String(text)) await page.keyboard.type(ch, { delay }); },
    hub: (q, ...a) => app.store.all(q, ...a).map(r => ({ ...r })),
    sql: (q, ...a) => sqlFile(app.config.dbPath, q, ...a),
    sqlFile,
    indir: async (page, action, ad) => {
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), action()]);
      const dir = path.join(root, "indirilen");
      mkdirSync(dir, { recursive: true });
      const file = path.join(dir, ad || dl.suggestedFilename());
      await dl.saveAs(file);
      return { file, suggested: dl.suggestedFilename() };
    },
  };
  let failure = null;
  try {
    await new AsyncFunction("g", ...Object.keys(g), body.code)(g, ...Object.values(g));
  } catch (error) {
    failure = String(error?.message || error).split("\n").slice(0, 3).join(" | ");
  }
  const page = target();
  await new Promise(r => setTimeout(r, 350));
  const seen = page ? await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const texts = sel => { const all = [...document.querySelectorAll(sel)].filter(vis); return all.filter(el => !all.some(o => o !== el && o.contains(el))).map(el => el.textContent.replace(/\s+/g, " ").trim()).filter(Boolean); };
    return {
      pencere: texts(".hof-modal h2, .hof-modal-title, [role=dialog] h2, dialog[open] h2, .yz-sheet h2").slice(-4),
      bildirim: texts(".hof-toast, .hof-notice, [role=alert], [role=status], .toast").map(t => t.slice(0, 220)).slice(-5),
    };
  }).catch(e => ({ okunamadi: String(e.message || e).slice(0, 200) })) : { sayfa: "yok" };
  let ekran = null;
  if (page && body.ad) {
    const dir = path.join(root, "ekran");
    mkdirSync(dir, { recursive: true });
    ekran = path.join(dir, `${body.ad}.png`);
    await page.screenshot({ path: ekran, fullPage: Boolean(body.tam) }).catch(e => notes.push(`ekran alınamadı: ${e.message}`));
  }
  const out = { adim: body.ad, hedef: body.hedef || "desk", hata: failure, url: page ? page.url() : "", ...seen, not: notes, konsolHatasi: errors.slice(errStart, errStart + 8), ekran };
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(out, null, 1));
});
await new Promise(r => control.listen(0, "127.0.0.1", r));
const state = { pid: process.pid, control: `http://127.0.0.1:${control.address().port}`, base, ofis: ofisId, kapi: kapi.base, kapiTls: kapi.tlsPort, edm: edm.url, adminPass: PASS, gun: GUN, root, dbPath: app.config.dbPath, legacyCasePayments: app.config.legacyCasePayments, legacyTableTransfer: app.config.legacyTableTransfer, mobileSyncAuto: app.config.mobileSyncAuto, lisans: app.license.status().state };
writeFileSync(path.join(root, "durum.json"), JSON.stringify(state, null, 2));
console.log(JSON.stringify(state));
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await browser.close().catch(() => null);
  await app.close().catch(() => null);
  await kapi.close().catch(() => null);
  await edm.close?.().catch?.(() => null);
  control.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
