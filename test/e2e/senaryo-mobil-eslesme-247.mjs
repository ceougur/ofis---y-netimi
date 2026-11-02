// 2.4.7 M2 EKRANDAN — Yönetim → Mobil Cihazlar ve telefonda karekodla eşleme (docs/mobil/M2-TASARIM.md; lib/mobile-remote.mjs; kullanıcı kararları P1–P13).
// Masaüstünde yönetici, telefonda (390×844, dokunmatik, iPhone imzası) kullanıcı; gerçek tıklama ve insan hızında yazım (ders 12). Telefon programın UZAK
// dinleyicisine bağlanır (app.listenRemote; M4'te tünel buraya bağlanır). Karekod ekrandaki SVG'den çizilip jsQR ile okunur (kamera yerine; çözücü programdan
// bağımsız).
//   E1 Mobil Cihazlar sekmesi: kullanıcılar, Uzaktan Bağlanabilir kutusu, işaretsiz kişide "Karekod Oluştur" pasif + nedeni yazılı.
//   E2 kutuyu işaretle (tıklama) → izin kaydedilir; Karekod Oluştur → pencerede karekod; karekodun içeriği uzak adres + #eslesme=<kod>.
//   E3 telefon karekodun adresini açar → "Cihazı Eşleştir" (ad önerili) → Eşleştir → giriş ekranı; kullanıcı adı + Tab + parola → Genel Bakış.
//      Adres çubuğunda kod kalmaz. Masaüstünde cihaz satırı (ad, kullanıcı, eşleme tarihi, son erişim) ve 1 / 3.
//   E3b P14 Eşleme Bağlantısı: karekodun altındaki bağlantı = karekodun içeriği; Kopyala panoya yazar; bağlantı uzak bilgisayarın (geniş ekran) tarayıcısında
//      açılır → eşleşir → giriş → Genel Bakış; masaüstünde "Uzak Tarayıcı" satırı, 2 / 3.
//   E4 sınır: 3/3 olunca bütün "Karekod Oluştur" düğmeleri pasif, "Cihaz sınırı dolu." ve uyarı yazısı görünür.
//   E5 Sil (onay penceresi) → satır gider, 2 / 3; telefonda sonraki dokunuş "Cihaz Eşli Değil" (oturum hemen düştü). Telefondan yasak yol (/api/companies) 404.
//   E6 izni kaldır (onaylı) → kişinin cihazları düşer.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-mobil-eslesme-247).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsQR from "jsqr";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";
import { createPhone, iosSimge } from "../mobil-uzak-ortak.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-mobil-eslesme-247-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-mobil-eslesme-247");
mkdirSync(shots, { recursive: true });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const USERS = [
  { username: "mobil-ali", name: "Ali Mobil", password: "Ali-Mobil-2026!" },
  { username: "mobil-veli", name: "Veli Mobil", password: "Veli-Mobil-2026!" },
  { username: "mobil-ayse", name: "Ayşe Mobil", password: "Ayse-Mobil-2026!" },
];

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const remote = await server.app.listenRemote(0, "127.0.0.1");
const remoteBase = `http://127.0.0.1:${remote.port}`;
// M4'te tünel adresi; burada uzak dinleyicinin kendisi (karekod bu adresi taşır).
server.app.mobileRemote.setPublicUrl(remoteBase);
const adminApi = createClient(server.base);
await adminApi.login("admin", ADMIN_PASSWORD);
for (const user of USERS) {
  const created = await adminApi.post("/api/admin/users", { username: user.username, name: user.name, role: "personel", password: user.password, mustChangePassword: false });
  if (created.status !== 200) throw new Error(`kullanıcı açılamadı: ${JSON.stringify(created.data)}`);
}
const ids = Object.fromEntries((await adminApi.get("/api/admin/users")).data.data.map(user => [user.username, user.id]));
const view = async () => (await adminApi.get("/api/admin/mobile/devices")).data.data;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const pageErrors = [];
let desk = null;
let phone = null;
const shot = (name, target) => target?.screenshot({ path: path.join(shots, `eslesme-247-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3).trim()}-masaustu`, desk);
    await shot(`hata-${title.slice(0, 3).trim()}-telefon`, phone);
  }
};
const typeSlow = async (target, text) => {
  for (const ch of text) await target.keyboard.type(ch, { delay: 40 });
};
const row = username => `[data-mobile-user="${ids[username]}"]`;
const reloadCard = async () => {
  await desk.click('.adm-tabs [data-tab="users"]');
  await desk.click('.adm-tabs [data-tab="mobile"]');
  await desk.waitForSelector("#adm-mobile-users [data-mobile-user]");
  await desk.waitForTimeout(250);
};
// Ekrandaki karekod SVG'si tarayıcıda tuvale çizilir; pikseller jsQR ile okunur (telefon kamerasının yerine).
const readQr = async () => {
  const image = await desk.evaluate(async () => {
    const svg = document.querySelector("[data-mobile-qr] svg");
    const markup = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: data.width, height: data.height, data: Array.from(data.data) };
  });
  return jsQR(Uint8ClampedArray.from(image.data), image.width, image.height)?.data || "";
};

const browser = await chromium.launch();
const deskContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await deskContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin: server.base });
const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await iosSimge(phoneContext); // 2.4.8 M4: iPhone eşlemesi ana ekran simgesinde (Safari sekmesi yönlendirir — senaryo-mobil-iphone-248)
desk = await deskContext.newPage();
phone = await phoneContext.newPage();
for (const [label, target] of [["masaüstü", desk], ["telefon", phone]]) target.on("pageerror", error => pageErrors.push(`${label}: ${error.message}`));
desk.setDefaultTimeout(15000);
phone.setDefaultTimeout(15000);
let qrUrl = "";

await step("E1 Mobil Cihazlar sekmesi: işaretsiz kişide karekod pasif, nedeni yazılı", async () => {
  await desk.goto(`${server.base}/`);
  await desk.fill("#hof-auth input[name=username]", "admin");
  await desk.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([desk.waitForEvent("load"), desk.click('#hof-auth button[type="submit"]')]);
  await desk.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await desk.goto(`${server.base}/admin.html#mobile`);
  await desk.waitForSelector("#adm-mobile-users [data-mobile-user]");
  ok((await desk.textContent('.adm-tabs [data-tab="mobile"]')).trim() === "Mobil Cihazlar", "sekme adı Mobil Cihazlar");
  ok(/0 \/ 3/.test(await desk.textContent("[data-mobile-count]")), `sayaç ${(await desk.textContent("[data-mobile-count]")).trim()}`);
  ok(await desk.isDisabled(`${row("mobil-ali")} [data-mobile-code]`), "işaretsiz kişide Karekod Oluştur pasif");
  ok(/Uzaktan Bağlanabilir işaretlenmeli/.test(await desk.textContent(`${row("mobil-ali")} [data-mobile-why]`)), "pasifliğin nedeni görünür");
  ok((await desk.textContent("[data-mobile-empty]")).includes("Eşli cihaz yok"), "eşli cihaz yok yazısı");
  await shot("01-kart", desk);
});

await step("E2 Uzaktan Bağlanabilir işaretlenir; Karekod Oluştur → karekod (uzak adres + #eslesme=)", async () => {
  await desk.click(`${row("mobil-ali")} [data-mobile-remote]`);
  await desk.waitForFunction(selector => !document.querySelector(selector)?.disabled, `${row("mobil-ali")} [data-mobile-code]`);
  ok((await view()).users.find(user => user.username === "mobil-ali").remote === true, "izin sunucuda kayıtlı");
  await desk.click(`${row("mobil-ali")} [data-mobile-code]`);
  await desk.waitForSelector(".hof-modal-backdrop.is-visible [data-mobile-qr] svg");
  ok((await desk.textContent(".hof-modal-backdrop.is-visible .hof-modal-title")).trim() === "Karekodu Telefonla Okutun", "pencere başlığı");
  ok(/5 dakika/.test(await desk.textContent(".hof-modal-backdrop.is-visible .hof-modal-body")), "geçerlilik süresi yazılı (5 dakika)");
  qrUrl = await readQr();
  ok(qrUrl.startsWith(`${remoteBase}/mobil/#eslesme=`), `karekod okundu: ${qrUrl.replace(/=.*/, "=…")}`);
  await shot("02-karekod", desk);
  await desk.keyboard.press("Escape");
});

await step("E3 telefon karekodu açar → Eşleştir → giriş → Genel Bakış; masaüstünde cihaz satırı", async () => {
  await phone.goto(qrUrl);
  await phone.waitForSelector("#pair-form:not(.hidden)");
  ok((await phone.inputValue("#device-name")) === "iPhone", `cihaz adı önerisi: ${await phone.inputValue("#device-name")}`);
  ok(!phone.url().includes("eslesme"), "kod adres çubuğundan silindi");
  await shot("03-eslestir", phone);
  await phone.click("#device-name", { clickCount: 3 });
  await typeSlow(phone, "Ali'nin iPhone'u");
  await phone.click("#pair-submit");
  await phone.waitForSelector("#login-form:not(.hidden)");
  ok(await phone.isVisible("#login-form"), "eşlemeden sonra giriş ekranı");
  await phone.click("#username");
  await typeSlow(phone, "mobil-ali");
  await phone.keyboard.press("Tab");
  await typeSlow(phone, "Ali-Mobil-2026!");
  await phone.click("#login-submit");
  await phone.waitForSelector("#app:not(.hidden) #content .summary-grid");
  ok(await phone.isVisible("#app"), "Genel Bakış açıldı");
  await shot("04-genel-bakis", phone);
  const state = await view();
  ok(state.used === 1 && state.devices[0].name === "Ali'nin iPhone'u" && state.devices[0].username === "mobil-ali" && state.devices[0].kind === "telefon", `cihaz kaydı: ${JSON.stringify(state.devices[0] || {})}`);
  await reloadCard();
  const deviceRow = await desk.textContent(`[data-mobile-device="${state.devices[0].id}"]`);
  ok(deviceRow.includes("Ali'nin iPhone'u") && deviceRow.includes("Ali Mobil") && deviceRow.includes("Telefon"), `satır: ${deviceRow.replace(/\s+/g, " ").trim()}`);
  ok(/1 \/ 3/.test(await desk.textContent("[data-mobile-count]")), "sayaç 1 / 3");
  await shot("05-cihaz-listesi", desk);
});

await step("E3b P14 Eşleme Bağlantısı: Kopyala → uzak bilgisayarın tarayıcısında açılır → eşleşir", async () => {
  await desk.click(`${row("mobil-veli")} [data-mobile-remote]`);
  await desk.waitForFunction(selector => !document.querySelector(selector)?.disabled, `${row("mobil-veli")} [data-mobile-code]`);
  await desk.click(`${row("mobil-veli")} [data-mobile-code]`);
  await desk.waitForSelector(".hof-modal-backdrop.is-visible [data-mobile-link]");
  const link = await desk.inputValue(".hof-modal-backdrop.is-visible [data-mobile-link]");
  const fromQr = await readQr();
  ok(link === fromQr && link.startsWith(`${remoteBase}/mobil/#eslesme=`), "bağlantı karekodun içeriğiyle aynı (kod # kısmında)");
  ok((await desk.textContent(".hof-modal-backdrop.is-visible .adm-mobile-link")).includes("Eşleme Bağlantısı"), "alan adı Eşleme Bağlantısı");
  await desk.click(".hof-modal-backdrop.is-visible [data-mobile-copy]");
  await desk.waitForTimeout(300);
  const clip = await desk.evaluate(() => navigator.clipboard.readText());
  ok(clip === link, "Kopyala bağlantıyı panoya yazdı");
  await shot("05b-baglanti", desk);
  await desk.keyboard.press("Escape");
  // Uzak bilgisayar: ayrı tarayıcı (masaüstü imzası, geniş ekran), bağlantı adres çubuğuna yapıştırılmış gibi açılır.
  const pcContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pc = await pcContext.newPage();
  pc.on("pageerror", error => pageErrors.push(`uzak bilgisayar: ${error.message}`));
  pc.setDefaultTimeout(15000);
  await pc.goto(clip);
  await pc.waitForSelector("#pair-form:not(.hidden)");
  ok((await pc.inputValue("#device-name")) === "Uzak Tarayıcı", `cihaz adı önerisi: ${await pc.inputValue("#device-name")}`);
  await pc.click("#pair-submit");
  await pc.waitForSelector("#login-form:not(.hidden)");
  await pc.click("#username");
  await typeSlow(pc, "mobil-veli");
  await pc.keyboard.press("Tab");
  await typeSlow(pc, "Veli-Mobil-2026!");
  await pc.click("#login-submit");
  await pc.waitForSelector("#app:not(.hidden) #content .summary-grid");
  ok(await pc.isVisible("#app"), "uzak bilgisayarda Genel Bakış (geniş ekran)");
  await shot("05c-uzak-bilgisayar", pc);
  const state = await view();
  const device = state.devices.find(item => item.username === "mobil-veli");
  ok(state.used === 2 && device?.kind === "tarayici", `uzak tarayıcı eşlendi (${state.used} / ${state.limit}, ${device?.kindLabel})`);
  // Aynı bağlantı ikinci kez kullanılamaz (tek kullanım).
  const again = await createPhone(remoteBase).pair(new URL(clip).hash.slice("#eslesme=".length));
  ok(again.code === "remote-code", `bağlantı tek kullanımlık (${again.code})`);
  await pcContext.close();
});

await step("E4 sınır 3/3: karekod düğmeleri pasif, neden ve uyarı görünür", async () => {
  // 2.4.7 gezinti D6: üçüncü cihaz TABLET ekrandan eşlenir — gezintideki gibi telefon imzalı tarayıcı (iPhone UA) ama 820 × 1180 dokunmatik ekran.
  // Yönetim → Mobil Cihazlar'da tür "Tablet" görünmeli (eski kod UA'ya bakıp "Telefon" yazıyordu).
  await adminApi.put(`/api/admin/mobile/access/${ids["mobil-ayse"]}`, { remote: true });
  const code = await adminApi.post("/api/admin/mobile/codes", { userId: ids["mobil-ayse"] });
  const tabletContext = await browser.newContext({ viewport: { width: 820, height: 1180 }, userAgent: IPHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await iosSimge(tabletContext); // 2.4.8 M4
  const tablet = await tabletContext.newPage();
  tablet.on("pageerror", error => pageErrors.push(`tablet: ${error.message}`));
  tablet.setDefaultTimeout(15000);
  await tablet.goto(code.data.data.url);
  await tablet.waitForSelector("#pair-form:not(.hidden)");
  ok((await tablet.inputValue("#device-name")) === "Tablet", `D6 tablet cihaz adı önerisi: ${await tablet.inputValue("#device-name")}`);
  await tablet.click("#pair-submit");
  await tablet.waitForSelector("#login-form:not(.hidden)");
  await tabletContext.close();
  {
    const state = await view();
    const device = state.devices.find(item => item.username === "mobil-ayse");
    ok(device?.kind === "tablet" && device?.kindLabel === "Tablet", `D6 tablet kaydı: ${device?.kind} / ${device?.kindLabel}`);
    await reloadCard();
    const deviceRow = device ? await desk.textContent(`[data-mobile-device="${device.id}"]`) : "";
    ok(/Tablet/.test(deviceRow) && !/Telefon/.test(deviceRow), `D6 Yönetim satırı: ${deviceRow.replace(/\s+/g, " ").trim()}`);
  }
  await reloadCard();
  ok(/3 \/ 3/.test(await desk.textContent("[data-mobile-count]")), "sayaç 3 / 3");
  ok(await desk.isVisible("[data-mobile-full-note]"), `uyarı: ${(await desk.textContent("[data-mobile-full-note]")).trim()}`);
  const buttons = await desk.$$eval("[data-mobile-code]", items => items.map(item => item.disabled));
  ok(buttons.length >= 3 && buttons.every(Boolean), "bütün Karekod Oluştur düğmeleri pasif");
  ok(/Cihaz sınırı dolu/.test(await desk.textContent(`${row("mobil-ali")} [data-mobile-why]`)), "neden: Cihaz sınırı dolu.");
  await shot("06-sinir-dolu", desk);
});

await step("E5 Sil (onaylı) → yer açılır; telefondaki oturum hemen düşer; yasak yol 404", async () => {
  const before = await view();
  const ali = before.devices.find(device => device.username === "mobil-ali");
  await desk.click(`[data-mobile-device="${ali.id}"] [data-mobile-delete]`);
  await desk.waitForSelector(".hof-modal-backdrop.is-visible");
  ok(/açık oturum hemen kapanır/.test(await desk.textContent(".hof-modal-backdrop.is-visible")), "onay penceresi sonucu söylüyor");
  await desk.click(".hof-modal-backdrop.is-visible .hof-button-danger");
  await desk.waitForSelector(`[data-mobile-device="${ali.id}"]`, { state: "detached" });
  ok(/2 \/ 3/.test(await desk.textContent("[data-mobile-count]")), "sayaç 2 / 3");
  ok(!(await desk.isDisabled(`${row("mobil-ali")} [data-mobile-code]`)), "yer açılınca karekod düğmesi etkin");
  await shot("07-silindi", desk);
  await phone.click('.bottom-nav [data-nav="accounts"]');
  await phone.waitForSelector("#unpaired:not(.hidden)");
  ok(await phone.isVisible("#unpaired"), `telefonda "Cihaz Eşli Değil": ${(await phone.textContent("#unpaired-text")).trim().slice(0, 70)}`);
  const forbidden = await phone.evaluate(async () => (await fetch("/api/companies")).status);
  ok(forbidden === 401 || forbidden === 404, `uzaktan /api/companies kapalı (${forbidden})`);
  await shot("08-telefon-eslesme-yok", phone);
});

await step("E6 izni kaldır (onaylı) → kişinin cihazları düşer", async () => {
  await desk.click(`${row("mobil-veli")} [data-mobile-remote]`);
  await desk.waitForSelector(".hof-modal-backdrop.is-visible");
  await desk.click(".hof-modal-backdrop.is-visible .hof-button-danger");
  await desk.waitForFunction(() => /1 \/ 3/.test(document.querySelector("[data-mobile-count]")?.textContent || ""));
  const state = await view();
  ok(state.used === 1 && !state.devices.some(device => device.username === "mobil-veli"), "veli'nin cihazı düştü, 1 / 3");
  ok(state.users.find(user => user.username === "mobil-veli").remote === false, "izin kaldırıldı");
  await shot("09-izin-kaldirildi", desk);
});

ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
