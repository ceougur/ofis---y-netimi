// 2.4.7 M3 EKRANDAN — şifreli özet, kapıcı ve sunucu kapalıyken telefonda son hâl (docs/mobil/M3-TASARIM.md). Gerçek program (createApp) → YEREL kapıcı
// (bulut/kapi/kapi.mjs — sahte R2; test/kapi-yerel.mjs, https kendinden imzalı) → Chromium telefon (390×844, iPhone imzası). Telefonun adresi üretimdeki gibi
// ofis başına alt ad (https://<ofis>.destekofis.test; --host-resolver-rules kapıcıya yönlendirir); canlı istekler kapıcıdan "tünele" (programın uzak
// dinleyicisi) gider. Lisans servisi sahte ve yerel (ders 30). Gerçek tıklama ve insan hızında yazım (ders 12).
//   Z1 Yönetim → Mobil Cihazlar'da "Bulut Özeti" satırı; telefon karekod adresini (ofisin alt adı) açar → Eşleştir → giriş → Genel Bakış (canlı).
//   Z2 iki kullanıcı daha eşlenir: saha (yalnız 001, yalnız Cari) ve veli; veli'nin cihazı silinir (güvenlik yüklemesi).
//   Z3 masaüstünde yeni cari girilir, program KAPANIR (son hâl yüklenir); telefonda dokunuş → kendiliğinden son özet: şerit "Son güncelleme", yeni cari listede,
//      Raporlar kapalı iletisi, kayıt yok.
//   Z4 sunucu kapalıyken sayfa yeniden açılır → giriş ekranında "Son Özeti Göster" → özet (service worker kabuğu).
//   Z5 saha: çevrimdışında yalnız 001 ve yalnız Cari; Kasa "Yetki Yok" (yetkisiz veri özette yok).
//   Z6 silinen cihaz (veli): ↻ → "Cihaz Eşli Değil" (kapıcı reddetti; yeni özeti açamaz).
//   Z7 başka ofisin özeti: tarayıcıdaki cihaz anahtarıyla imzalanmış istek B ofisinin adresinde reddedilir.
//   Z8 P9: lisans servisine 1 saattir ulaşılamıyor → ↻ → "Lisans bir saattir doğrulanamadı".
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-mobil-ozet-247).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { permissionsFor, isGrantable } from "../../server/lib/permissions.mjs";
import { ADMIN_PASSWORD, createClient, startTestServer } from "../helpers.mjs";
import { lisansAnahtari } from "../kapi-ortak.mjs";
import { startKapi } from "../kapi-yerel.mjs";
import { rawRequest } from "../mobil-uzak-ortak.mjs";

const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-mobil-ozet-247");
mkdirSync(shots, { recursive: true });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const USERS = [
  { username: "mobil-ali", name: "Ali Mobil", password: "Ali-Mobil-2026!" },
  { username: "mobil-saha", name: "Saha Mobil", password: "Saha-Mobil-2026!" },
  { username: "mobil-veli", name: "Veli Mobil", password: "Veli-Mobil-2026!" },
];

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const pageErrors = [];
const shot = (name, target) => target?.screenshot({ path: path.join(shots, `ozet-247-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn, target) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3).trim()}`, target);
  }
};
const typeSlow = async (target, text) => {
  for (const ch of text) await target.keyboard.type(ch, { delay: 35 });
};

// ---------- Ortam: sahte lisans servisi, kapıcı (http + https), iki ofis ----------
const lisans = lisansAnahtari();
const world = { online: true, offset: 0 };
const kayitlar = new Map(); // makine → lisans kaydı
const belirtec = machine => lisans.belirtec({ at: Date.now(), machine, licenseId: `LIS-E2E-${machine.slice(0, 4)}`, ...(kayitlar.get(machine) || {}) });
const kapi = await startKapi({
  now: () => Date.now() + world.offset,
  tls: true,
  trustedKeys: lisans.trusted,
  lisansFetch: async (url, init) => {
    if (!world.online) throw new TypeError("fetch failed");
    return { json: async () => ({ ok: true, token: belirtec(JSON.parse(init.body).machine) }) };
  },
});
async function ofisAc(machine) {
  const server = await startTestServer({
    mobileKapiUrl: kapi.base,
    mobileOfficeUrl: "https://{ofis}.destekofis.test",
    license: {
      enforce: true,
      trustedKeys: lisans.trusted,
      services: ["https://lisans.e2e.test/api/lisans"],
      fetchImpl: async () => {
        if (!world.online) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
        return { status: 200, json: async () => ({ ok: true, token: belirtec(machine) }) };
      },
      machineId: machine,
      firstCheckDelayMs: 3_600_000,
      autoTrial: false,
    },
  });
  await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
  const ofis = await server.app.mobileSync.ofis();
  await server.app.mobileSync.kayitGonder();
  const remote = await server.app.listenRemote(0, "127.0.0.1");
  kapi.tunel(ofis.id, `http://127.0.0.1:${remote.port}`);
  return { server, ofis, host: kapi.ofisHost(ofis.id) };
}
const A = await ofisAc("a1".repeat(16));
const B = await ofisAc("b2".repeat(16));
const adminApi = createClient(A.server.base);
await adminApi.login("admin", ADMIN_PASSWORD);
const codes = async () => Object.fromEntries((await adminApi.get("/api/companies")).data.data.companies.map(c => [c.code, c.id]));
if ((await adminApi.post("/api/companies", { code: "002", name: "İkinci Şirket" })).status !== 200) throw new Error("002 açılamadı");
const company = await codes();
await adminApi.post(`/api/workspace/accounts?hofCompany=${company["002"]}`, { name: "Gizli Cari Yüzİki", type: "customer" });
for (const user of USERS) {
  const created = await adminApi.post("/api/admin/users", { username: user.username, name: user.name, role: user.username === "mobil-ali" ? "admin" : "personel", password: user.password, mustChangePassword: false });
  if (created.status !== 200) throw new Error(`kullanıcı açılamadı: ${JSON.stringify(created.data)}`);
}
const ids = Object.fromEntries((await adminApi.get("/api/admin/users")).data.data.map(user => [user.username, user.id]));
// Saha: yalnız Cari Hesapları Görme; şirket kutusu işaretsiz → yalnız 001.
await adminApi.patch(`/api/admin/users/${ids["mobil-saha"]}`, { grants: { add: ["accounts.view"], remove: permissionsFor("personel").filter(p => p !== "accounts.view" && isGrantable(p)) } });
for (const user of USERS) await adminApi.put(`/api/admin/mobile/access/${ids[user.username]}`, { remote: true });

// Ofisin alt adı (*.destekofis.test) yerel kapıcıya; vekil sunucu ortam değişkenleri tarayıcıya geçmez (yerel ad vekilde çözülmez).
const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP *.destekofis.test 127.0.0.1:${kapi.tlsPort}`, "--ignore-certificate-errors", "--no-proxy-server"],
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/proxy/i.test(key))),
});
const newPhone = async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(`telefon: ${error.message}`));
  page.setDefaultTimeout(20000);
  return page;
};
async function pairAndLogin(page, user, deviceName) {
  const code = await adminApi.post("/api/admin/mobile/codes", { userId: ids[user.username] });
  const url = code.data.data.url;
  await page.goto(url);
  await page.waitForSelector("#pair-form:not(.hidden)");
  await page.click("#device-name", { clickCount: 3 });
  await typeSlow(page, deviceName);
  await page.click("#pair-submit");
  await page.waitForSelector("#login-form:not(.hidden)");
  await page.click("#username");
  await typeSlow(page, user.username);
  await page.keyboard.press("Tab");
  await typeSlow(page, user.password);
  await page.click("#login-submit");
  await page.waitForSelector("#app:not(.hidden) #content .summary-grid");
  await A.server.app.mobileSync.idle();
  return url;
}

const desk = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
desk.setDefaultTimeout(20000);
const ali = await newPhone();
const saha = await newPhone();
const veli = await newPhone();
let aliDevice = "";

await step("Z1 karekod ofisin alt adını taşır; eşleme + giriş kapıcıdan; masaüstünde Bulut Özeti satırı", async () => {
  const url = await pairAndLogin(ali, USERS[0], "Ali'nin iPhone'u");
  ok(url.startsWith(`https://${A.host}/mobil/#eslesme=`), `karekod adresi ofisin alt adı: ${url.replace(/=.*/, "=…")}`);
  ok(new URL(ali.url()).host === A.host, "telefon ofisin alt adında");
  ok((await ali.textContent("#top-server-status")).includes("Sunucu Bağlı"), "canlı: Sunucu Bağlı");
  aliDevice = (await adminApi.get("/api/admin/mobile/devices")).data.data.devices.find(d => d.username === "mobil-ali")?.id;
  ok(Boolean(A.server.app.store.get("SELECT enc_key FROM mobile_devices WHERE id = ?", aliDevice)?.enc_key), "tarayıcının şifreleme anahtarı (ECDH) programda kayıtlı");
  ok(kapi.meta(A.ofis.id)?.cihazlar.some(c => c.id === aliDevice), "kapıcı cihazı tanıyor (eşleme hemen bildirildi)");
  await shot("01-canli", ali);
  await desk.goto(`${A.server.base}/`);
  await desk.fill("#hof-auth input[name=username]", "admin");
  await desk.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([desk.waitForEvent("load"), desk.click('#hof-auth button[type="submit"]')]);
  await desk.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await desk.goto(`${A.server.base}/admin.html#mobile`);
  await desk.waitForSelector("[data-mobile-ozet]");
  ok(/Bulut Özeti: son yükleme/.test(await desk.textContent("[data-mobile-ozet]")), `Yönetim kartı: ${(await desk.textContent("[data-mobile-ozet]")).trim()}`);
  await shot("02-yonetim", desk);
}, ali);

await step("Z2 saha ve veli eşlenir; veli'nin cihazı silinir (güvenlik yüklemesi)", async () => {
  await pairAndLogin(saha, USERS[1], "Saha Telefonu");
  await pairAndLogin(veli, USERS[2], "Veli Telefonu");
  const devices = (await adminApi.get("/api/admin/mobile/devices")).data.data.devices;
  ok(devices.length === 3, `3 / 3 eşli (${devices.length})`);
  const veliDevice = devices.find(d => d.username === "mobil-veli").id;
  ok((await adminApi.del(`/api/admin/mobile/devices/${veliDevice}`)).status === 200, "veli'nin cihazı silindi");
  await A.server.app.mobileSync.idle();
  ok(!kapi.meta(A.ofis.id).cihazlar.some(c => c.id === veliDevice), "kapıcıdan da düştü");
}, saha);

await step("Z3 yeni cari → program KAPANIR → telefonda dokunuş: son özet (şerit, yeni cari, Raporlar kapalı)", async () => {
  ok((await adminApi.post(`/api/workspace/accounts?hofCompany=${company["001"]}`, { name: "Kapalıda Görünen Cari", type: "customer" })).status === 200, "masaüstünde cari girildi");
  // M5 birleşimi: canlıdayken cari kartında yazma düğmesi var, çevrimdışı özette yok (ön koşul + diş).
  await ali.click('.bottom-nav [data-nav="accounts"]');
  await ali.waitForSelector('#content .list-item:has-text("Kapalıda Görünen Cari")');
  await ali.click('#content .list-item:has-text("Kapalıda Görünen Cari")');
  await ali.waitForSelector("[data-detail-balance]");
  await ali.waitForSelector("#content [data-yazma]", { timeout: 10_000 }).catch(() => {});
  ok((await ali.$$("#content [data-yazma]")).length > 0, "canlıda cari kartında yazma düğmesi var (ön koşul)");
  await A.server.close();
  ok(A.server.app.mobileSync.status().son?.neden === "kapanis", "kapanışta son hâl yüklendi");
  await ali.click('.bottom-nav [data-nav="accounts"]');
  await ali.waitForSelector("#offline-banner:not(.hidden)");
  const banner = (await ali.textContent("#offline-banner")).trim();
  ok(/Ofis sunucusuna ulaşılamıyor\. Son güncelleme: /.test(banner), `şerit: ${banner}`);
  ok(/Son Güncelleme/.test(await ali.textContent("#top-server-status")), "üst çubukta Son Güncelleme");
  await ali.waitForSelector("#content .list-item");
  ok((await ali.textContent("#content")).includes("Kapalıda Görünen Cari"), "kapanmadan önce girilen cari özette görünür");
  await ali.click('#content .list-item:has-text("Kapalıda Görünen Cari")');
  await ali.waitForSelector("[data-detail-balance]");
  ok((await ali.$$("#content [data-yazma]")).length === 0, "çevrimdışı özette cari kartında yazma düğmesi YOK (sunucu kapalıyken kayıt girilmez)");
  await ali.click('.bottom-nav [data-nav="accounts"]');
  await ali.waitForSelector("#content .list-item");
  await shot("03-cevrimdisi-cari", ali);
  await ali.click('.bottom-nav [data-nav="reports"]');
  await ali.waitForSelector("#content .error-box");
  ok(/Raporlar ofis sunucusu açıkken alınır/.test(await ali.textContent("#content")), "Raporlar çevrimdışı kapalı (gerekçeli ileti)");
  await ali.click('.bottom-nav [data-nav="home"]');
  await ali.waitForSelector("#content .summary-grid");
  ok(/şifreli son özet görünür/.test(await ali.textContent("#content")), "Genel Bakış notu sunucu kapalıyken son özeti anlatır");
  // 2.4.7 gezinti D4: M5 sonrası not — kayıt girişi masaüstüne gönderilmez; sunucu açıkken telefondan yapılır, kapalıyken salt okunur.
  const homeNote = (await ali.$$eval("#content .notice", items => items.map(item => item.textContent.trim()).join(" "))).trim();
  ok(/Sunucu kapalıyken bilgiler salt okunurdur/.test(homeNote) && /sunucusu açıkken cari ve stok kartından yapılır/.test(homeNote) && !/masaüstü programdan girilir/.test(homeNote), `D4 çevrimdışı Genel Bakış notu: ${homeNote || "(yok)"}`);
  await shot("04-cevrimdisi-genel", ali);
}, ali);

await step("Z4 sunucu kapalıyken sayfa yeniden açılır → Son Özeti Göster", async () => {
  await ali.reload();
  await ali.waitForSelector("#login-form:not(.hidden)");
  await ali.waitForSelector("#offline-note:not(.hidden)", { timeout: 15000 });
  ok(await ali.isVisible("#offline-open"), "giriş ekranında Son Özeti Göster (kabuk önbellekten açıldı)");
  await shot("05-son-ozeti-goster", ali);
  await ali.click("#offline-open");
  await ali.waitForSelector("#app:not(.hidden) #content .summary-grid");
  ok(await ali.isVisible("#offline-banner"), "özet açıldı, şerit görünür");
  const options = await ali.$$eval("#company option", els => els.map(e => e.textContent));
  ok(options.length === 2, `yönetici iki şirketi görür (${options.join(", ")})`);
}, ali);

await step("Z5 saha: çevrimdışında yalnız 001 ve yalnız Cari; Kasa 'Yetki Yok'", async () => {
  await saha.click('.bottom-nav [data-nav="home"]');
  await saha.waitForSelector("#offline-banner:not(.hidden)");
  await saha.waitForSelector("#content .summary-grid");
  const options = await saha.$$eval("#company option", els => els.map(e => e.value));
  ok(options.length === 1 && options[0] === company["001"], `saha yalnız 001 (${options.join(",")})`);
  ok((await saha.textContent('[data-stat="cash"] .metric-value')).trim() === "Yetki Yok", "Kasa bölümü özette yok → Yetki Yok");
  await saha.click('.bottom-nav [data-nav="accounts"]');
  await saha.waitForSelector("#content .list-item");
  const text = await saha.textContent("#content");
  ok(text.includes("Kapalıda Görünen Cari") && !text.includes("Gizli Cari"), "001 carisi görünür, 002'ninki yok");
  await shot("06-saha", saha);
}, saha);

await step("Z6 silinen cihaz (veli): ↻ → Cihaz Eşli Değil", async () => {
  await veli.click('[data-action="refresh"]');
  await veli.waitForSelector("#unpaired:not(.hidden)", { timeout: 15000 });
  ok(/eşli değil|kaldırıldı/i.test(await veli.textContent("#unpaired")), `ileti: ${(await veli.textContent("#unpaired-text")).trim()}`);
  await shot("07-silinen", veli);
}, veli);

await step("Z7 tarayıcıdaki cihaz anahtarıyla imzalı istek başka ofisin (B) adresinde reddedilir", async () => {
  const ms = Date.now();
  const signed = await ali.evaluate(async ({ ms: t }) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("destekofis-mobil", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const get = key => new Promise(resolve => {
      const q = db.transaction("cihaz").objectStore("cihaz").get(key);
      q.onsuccess = () => resolve(q.result);
    });
    const [cihaz, anahtar] = [await get("cihaz"), await get("anahtar")];
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, anahtar.privateKey, new TextEncoder().encode(`DestekOfis-kapi-cihaz\nGET\n/kapi/ozet\n${cihaz}\n${t}`));
    return { cihaz, imza: btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") };
  }, { ms });
  const headers = { "x-do-cihaz": signed.cihaz, "x-do-zaman": String(ms), "x-do-imza": signed.imza };
  const own = await rawRequest(kapi.base, "GET", "/kapi/ozet", { headers: { ...headers, host: A.host } });
  ok(own.status === 200, `kendi ofisinde kabul (${own.status})`);
  const other = await rawRequest(kapi.base, "GET", "/kapi/ozet", { headers: { ...headers, host: B.host } });
  ok(other.code === "kapi-cihaz", `B ofisinde reddedildi (${other.status} ${other.code})`);
  ok(!own.text.includes("Kapalıda Görünen Cari"), "kapıcıdaki nesne şifreli (düz metin yok)");
}, ali);

await step("Z8 P9: lisans servisine 1 saattir ulaşılamıyor → ↻ → Lisans doğrulanamadı", async () => {
  world.online = false;
  world.offset = 61 * 60_000;
  await ali.click('[data-action="refresh"]');
  await ali.waitForSelector("#login-error:not(.hidden), #content .error-box", { timeout: 15000 }).catch(() => null);
  const shown = `${await ali.textContent("#login-error").catch(() => "")} ${await ali.textContent("#content").catch(() => "")}`;
  ok(/Lisans bir saattir doğrulanamadı/.test(shown), `ekran: ${shown.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  const direct = await rawRequest(kapi.base, "GET", "/api/mobil/session", { headers: { host: A.host } });
  ok(direct.status !== 200, "canlı kapı da kapalı");
  await shot("08-p9", ali);
}, ali);

await step("Z9 (gezinti D9) lisans kapısı kapalıyken sayfa yeniden açılır → giriş ekranında lisans iletisi (boş giriş ekranı değil)", async () => {
  // Ön koşul telefonun kendi çerezleriyle (eşli cihaz) okunur: kapıcı cihazdan sonra lisansı denetler.
  const pre = await ali.evaluate(() => fetch("/api/mobil/session", { credentials: "same-origin", headers: { "x-requested-with": "DestekOfisMobile" }, cache: "no-store" }).then(async r => ({ status: r.status, code: (await r.json().catch(() => ({}))).code || "" })));
  ok(pre.code === "kapi-lisans-dogrulanamadi", `ön koşul: kapıcı lisans kapısı kapalı (${pre.status} ${pre.code})`);
  await ali.reload();
  await ali.waitForSelector("#login-form:not(.hidden)", { timeout: 15000 });
  await ali.waitForSelector("#login-error:not(.hidden)", { timeout: 8000 }).catch(() => null);
  const shown = ((await ali.textContent("#login-error").catch(() => "")) || "").trim();
  const visible = await ali.isVisible("#login-error");
  ok(visible && /Lisans bir saattir doğrulanamadı/.test(shown), `giriş ekranında lisans iletisi: ${visible ? shown : "(gizli)"}`);
  await shot("09-lisans-yeniden-acilis", ali);
}, ali);

ok(pageErrors.length === 0, `sayfa hatası yok${pageErrors.length ? `: ${pageErrors.join(" | ")}` : ""}`);
await browser.close();
await B.server.close().catch(() => {});
await kapi.close();
console.log(`\n${passed} geçti, ${failed} kaldı`);
console.log(`# tests ${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
