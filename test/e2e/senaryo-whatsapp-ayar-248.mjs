// 2.4.8 W1 EKRANDAN — Yönetim → WhatsApp: Elle Bağla, Bağlantıyı Sına, Kendime Deneme Gönder, Bilgileri Değiştir, Bağlantıyı Kaldır
// (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W1; lib/whatsapp/connection.mjs). Meta yerine YEREL sahte Graph sunucusu (test/whatsapp-sahte-graph.mjs; ders 30);
// sunucu saati sahte (ders 13). Gerçek tıklama + insan hızında yazım + Tab (ders 12); "veri bozulmaz" iddiası sahte Meta'ya giden başlıktan ve veri
// tabanından okunur. Pencere seçicisi en üstteki pencere (ders 39).
//   A1 sekme "WhatsApp"; bağlantı yok: "Bağlı Değil", Elle Bağla.
//   A2 Elle Bağla: üç kimlik + belirteç Tab ile → Kaydet ve Sına → "Bağlı"; görünen ad, kalite, sınır; Meta'ya giden belirteç = yazılan; veri tabanında
//      kimlikler yazılan, belirteç mühürlü; sayfada ve API yanıtlarında belirteç YOK.
//   A3 Kendime Deneme Gönder: numara yazılır, Enter → bildirim; Meta'ya "+905…" ve hello_world; kartta Son Deneme.
//   A4 Bilgileri Değiştir: kimlikler dolu, belirteç alanı boş (kayıtlı belirteç korunur); yanlış belirteç → "Sınama Başarısız" + Türkçe neden;
//      doğru belirteçle yeniden "Bağlı".
//   A5 Bağlantıyı Kaldır (onay penceresi) → "Bağlı Değil"; ayar satırı silindi.
//   A6 yetkisiz (Personel): Yönetim açılmaz; API 403.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-whatsapp-ayar-248).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";
import { startFakeGraph } from "../whatsapp-sahte-graph.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-whatsapp-ayar-248-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-whatsapp-ayar-248");
mkdirSync(shots, { recursive: true });
const TOKEN = "SAHTE-W1-ekran_Belirteci.248-QwErTy0123456789";
const PNID = "106540352242922";
const WABA = "102290129340398";
const APP = "1505264761663625";
const STAFF = { username: "wa-personel", password: "Personel-Wa-2026!" };
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;

const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, verifiedName: "Deneme Ticaret Ltd" });
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, whatsappGraphUrl: fake.url, now: "2026-11-03T09:00:00+03:00" });
const adminApi = createClient(server.base);
await adminApi.login("admin", ADMIN_PASSWORD);
const staffCreated = await adminApi.post("/api/admin/users", { ...STAFF, name: "WhatsApp Personel", role: "personel", mustChangePassword: false });
if (staffCreated.status !== 200) throw new Error(`personel açılamadı: ${JSON.stringify(staffCreated.data)}`);
const settingRow = () => server.app.store.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'")?.value ?? null;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const pageErrors = [];
const apiBodies = [];
const shot = name => page?.screenshot({ path: path.join(shots, `wa-248-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 2).trim()}`);
  }
};
const typeSlow = async text => {
  for (const ch of text) await page.keyboard.type(ch, { delay: 35 });
};
const text = async selector => ((await page.textContent(selector)) || "").trim();
const fact = key => text(`[data-wa-fact="${key}"] dd`);
const waitState = async label => {
  await page.waitForFunction(expected => document.querySelector("[data-wa-state]")?.textContent.trim() === expected, label, { timeout: 15000 });
  return text("[data-wa-state]");
};
// En üstteki pencere açılıp görünür olana dek bekler (ders 39: sınıf bir kare sonra gelir).
const topModal = async () => {
  await page.waitForSelector(`${TOP} .hof-modal-title, ${TOP} h2, ${TOP} form`, { state: "visible" });
  return TOP;
};
const noToken = async label => {
  const html = await page.content();
  ok(!html.includes(TOKEN) && !html.includes(TOKEN.slice(-12)), `${label}: sayfada belirteç yok`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
page = await context.newPage();
page.on("pageerror", error => pageErrors.push(error.message));
page.on("response", async response => {
  if (!response.url().includes("/api/")) return;
  try {
    apiBodies.push(await response.text());
  } catch {
    // gövdesiz (yönlendirme / olay akışı)
  }
});
page.setDefaultTimeout(15000);

await step("A1 sekme ve boş durum: \"Bağlı Değil\", Elle Bağla", async () => {
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.goto(`${server.base}/admin.html#whatsapp`);
  await page.waitForSelector("[data-wa-state]");
  ok((await text('.adm-tabs [data-tab="whatsapp"]')) === "WhatsApp", "sekme adı WhatsApp");
  ok((await page.getAttribute('.adm-tabs [data-tab="whatsapp"]', "aria-selected")) === "true", "sekme seçili");
  ok((await text("[data-wa-state]")) === "Bağlı Değil", "durum Bağlı Değil");
  ok(await page.isVisible('[data-wa-action="connect"]'), "Elle Bağla düğmesi görünür");
  ok(fake.requests.length === 0, "sekme açılınca Meta'ya istek yok");
  await shot("01-bos");
});

await step("A2 Elle Bağla: Tab ile insan hızında yazım → Kaydet ve Sına → Bağlı; belirteç ekranda ve yanıtlarda yok", async () => {
  await page.click('[data-wa-action="connect"]');
  const modal = await topModal();
  ok((await text(`${modal} .hof-modal-title, ${modal} h2`)).includes("Elle Bağla"), "pencere başlığı Elle Bağla");
  await page.click(`${modal} [name="phoneNumberId"]`);
  await typeSlow(PNID);
  await page.keyboard.press("Tab");
  await typeSlow(WABA);
  await page.keyboard.press("Tab");
  await typeSlow(APP);
  await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.activeElement?.getAttribute("name") === "token"), "Tab sırası: kimlikler → belirteç");
  await typeSlow(TOKEN);
  await shot("02-elle-bagla");
  await page.click(`${modal} button[type="submit"]`);
  ok((await waitState("Bağlı")) === "Bağlı", "sınama sonrası durum Bağlı");
  ok((await page.locator(MODAL).count()) === 0, "pencere kapandı");
  ok((await fact("verifiedName")) === "Deneme Ticaret Ltd", `görünen ad: ${await fact("verifiedName")}`);
  ok((await fact("quality")) === "Yüksek", `kalite: ${await fact("quality")}`);
  ok((await fact("tier")) === "24 saatte 250 farklı kişi", `sınır: ${await fact("tier")}`);
  ok((await fact("token")).startsWith("Kayıtlı"), `belirteç: ${await fact("token")}`);
  ok((await fact("testTemplate")).includes("hello_world: Onaylı"), `deneme şablonu: ${await fact("testTemplate")}`);
  // 2.4.8 W5: kayıttan sonra şablonlar kendiliğinden açılır; örnek PDF yüklemesinin ikinci adımı "OAuth" şemasıyla gider (meta-graph META_D0_W5).
  const auths = [...new Set(fake.requests.map(item => item.auth.replace(/^OAuth /, "Bearer ")))];
  ok(auths.length === 1 && auths[0] === `Bearer ${TOKEN}`, "Meta'ya giden belirteç yazılanla birebir (karakter kaybı yok)");
  const row = JSON.parse(settingRow() || "{}");
  ok(row.phoneNumberId === PNID && row.wabaId === WABA && row.appId === APP, "veri tabanında kimlikler yazılanla aynı");
  ok(String(row.tokenSealed || "").startsWith("sb1:") && !settingRow().includes(TOKEN), "veri tabanında belirteç mühürlü");
  await noToken("bağlandıktan sonra");
  ok(!apiBodies.some(body => body.includes(TOKEN) || body.includes(TOKEN.slice(-12))), `API yanıtlarında belirteç yok (${apiBodies.length} yanıt)`);
  await shot("03-bagli");
});

await step("A3 Kendime Deneme Gönder: numara + Enter → Meta'ya +90 ile hello_world; kartta Son Deneme", async () => {
  fake.requests.length = 0;
  await page.click('[data-wa-action="self-test"]');
  const modal = await topModal();
  ok((await text(`${modal} .hof-modal-title, ${modal} h2`)).includes("Kendime Deneme Gönder"), "pencere başlığı");
  await page.click(`${modal} [name="to"]`);
  await typeSlow("0532 111 22 33");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /Meta kabul etti/.test(document.querySelector('[data-wa-fact="lastSelfTest"] dd')?.textContent || ""), null, { timeout: 15000 });
  const post = fake.requests.find(item => item.method === "POST");
  ok(post?.body?.to === "+905321112233", `alıcı +905321112233 (${post?.body?.to})`);
  ok(post?.body?.template?.name === "hello_world" && post?.body?.template?.language?.code === "en_US", "şablon hello_world, dil listeden (en_US)");
  ok((await fact("lastSelfTest")).includes("…2233"), `Son Deneme: ${await fact("lastSelfTest")}`);
  await shot("04-deneme");
  // İkinci deneme hemen: sunucu 15 sn bekletir (çift ileti yok); pencerede neden yazılır.
  await page.click('[data-wa-action="self-test"]');
  const again = await topModal();
  await page.click(`${again} [name="to"]`);
  await typeSlow("05321112233");
  await page.click(`${again} button[type="submit"]`);
  await page.waitForFunction(selector => /saniye sonra/.test(document.querySelector(`${selector} .hof-form-error`)?.textContent || ""), again);
  ok(fake.state.sent === 1, `Meta'ya tek deneme iletisi (${fake.state.sent})`);
  await page.click(`${again} [data-cancel]`);
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"));
});

await step("A4 Bilgileri Değiştir: kimlikler dolu, belirteç boş; yanlış belirteç → Sınama Başarısız; doğru belirteç → Bağlı", async () => {
  await page.click('[data-wa-action="connect"]');
  let modal = await topModal();
  ok((await page.inputValue(`${modal} [name="phoneNumberId"]`)) === PNID && (await page.inputValue(`${modal} [name="wabaId"]`)) === WABA, "kimlikler dolu geldi");
  ok((await page.inputValue(`${modal} [name="token"]`)) === "", "belirteç alanı boş (ekrana geri gelmez)");
  ok(/Kayıtlı belirteç korunur/.test(await text(`${modal} label:has([name="token"]) small`)), "belirteç yardım yazısı");
  await page.click(`${modal} [name="token"]`);
  await typeSlow("YANLIS-BELIRTEC-248");
  await page.click(`${modal} button[type="submit"]`);
  ok((await waitState("Sınama Başarısız")) === "Sınama Başarısız", "yanlış belirteçte Sınama Başarısız");
  ok(/süresi dolmuş/.test(await fact("lastTest")), `neden Türkçe: ${(await fact("lastTest")).slice(0, 90)}`);
  await shot("05-yanlis-belirtec");
  await page.click('[data-wa-action="connect"]');
  modal = await topModal();
  await page.click(`${modal} [name="token"]`);
  await typeSlow(TOKEN);
  await page.click(`${modal} button[type="submit"]`);
  ok((await waitState("Bağlı")) === "Bağlı", "doğru belirteçle yeniden Bağlı");
  await noToken("yeniden bağlandıktan sonra");
});

await step("A5 Bağlantıyı Kaldır (onaylı) → Bağlı Değil; ayar satırı silindi", async () => {
  await page.click('[data-wa-action="remove"]');
  const modal = await topModal();
  ok(/kaldırılsın mı/.test(await text(modal)), "onay sorusu soruldu");
  await page.click(`${modal} .hof-button-danger`);
  ok((await waitState("Bağlı Değil")) === "Bağlı Değil", "durum Bağlı Değil");
  ok(settingRow() === null, "veri tabanında bağlantı yok");
  await shot("06-kaldirildi");
});

await step("A6 yetkisiz (Personel): Yönetim açılmaz, WhatsApp bağlantı API'si 403", async () => {
  const staff = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const staffPage = await staff.newPage();
  staffPage.on("pageerror", error => pageErrors.push(`personel: ${error.message}`));
  await staffPage.goto(`${server.base}/`);
  await staffPage.fill("#hof-auth input[name=username]", STAFF.username);
  await staffPage.fill("#hof-auth input[name=password]", STAFF.password);
  await Promise.all([staffPage.waitForEvent("load"), staffPage.click('#hof-auth button[type="submit"]')]);
  await staffPage.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await staffPage.goto(`${server.base}/admin.html#whatsapp`);
  await staffPage.waitForSelector("#adm-denied", { state: "visible" });
  ok(await staffPage.isHidden("#adm-app"), "Yönetim paneli personelde kapalı");
  const status = await staffPage.evaluate(async () => (await fetch("/api/workspace/whatsapp/connection")).status);
  ok(status === 403, `API 403 (${status})`);
  await staff.close();
});

ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
await fake.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
