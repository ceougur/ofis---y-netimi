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
//   A4b (T2 dar kontrol D3) Bildirim Yolu satırı: uzaktan adres yokken "Kayıtlı Değil"; Bağlantıyı Sına → "Çalışıyor"; Çakışma'da (başka bilgisayar, zorla) neden
//       yazısı + Bağlantıyı Sına Meta'daki adresi bu bilgisayara geri alır.
//   A4c (2.4.9 UI tur B, ORTA-3) Meta abonelik kaydını reddedince (100 "must be subscribed"): Bağlantıyı Sına / Kaydet ve Sına UYARI bildirimi; neden düğmelerin altında
//       Türkçe, hücrede yalnız "Kaydedilemedi · <tarih>", Meta'nın ham iletisi ayrı satırda; düzelince yeşil bildirim aynen. (A2: App ID yardımı Ekstre şablonunu söyler — D8.)
//   A4d (2.5.0 BS-1) Meta yalnız hata kodu döndürünce (ileti yok) kod neden satırında "(Meta hata kodu 100)"; Meta iletisi satırı yok.
//   A4e (2.5.0 WE) Webhook Bilgileri: Callback URL + Verify Token pencerede, Kopyala; değerler sunucununkiyle aynı; pencere kapanınca sayfada yok. A6: Personel 403.
//   A5 Bağlantıyı Kaldır (onay penceresi) → "Bağlı Değil"; ayar satırı silindi.
//   A5b (2.5.0 W-2) Meta abonelik silmeyi reddederse bağlantı yine kaldırılır; uyarı "Meta tarafında kaldırılamadı" + Veri Silme Adımları düğmesi.
//   A5c (2.5.0 W-1(a)) Yol 2 bağlantısı 53. gün: uyarı satırı, Bağlantı Süresi, Yeniden Bağla; ana ekranda günde bir bildirim; 60. gün Süresi Doldu, Kendime Deneme Gönder
//       pasif + neden, Yeniden Bağla ve Bağlantıyı Sına etkin. A7'de gerçek kapıcıyla bağlanınca "60 gün kaldı".
//   A6 yetkisiz (Personel): Yönetim açılmaz; API 403.
//   2.4.8 W7 TAŞINAMAZ BAĞLANTI (bağımsız gözden geçirme ORTA; ikinci program + YEREL kapıcı https://kapi.destekofis.test + sahte Facebook SDK / Meta penceresi —
//   Playwright yönlendirmesi, gerçek Meta'ya istek YOK; dış istek sayılır ve 0 beklenir):
//   A7 WhatsApp'ı Bağla → pencere → program sırrı postMessage ile verir → sayfa "Bağlanacak Program: <firma>" (HTML yorumlanmaz) → Facebook ile Devam Et →
//      kapıcı kodu değiştirir → program "Bağlı" (WhatsApp'ı Bağla yolu); sır hiçbir adreste yok; Yönetim sayfası COOP same-origin-allow-popups; kapıcı sayfası çerçeveye
//      alınamaz (frame-ancestors 'none', X-Frame-Options DENY). App ID kapıcıdan gelir: Ekstre şablonunun örnek PDF'i /<App ID>/uploads ile yüklenir.
//   A8 TAŞINAN BAĞLANTI (pencereyi açan yok — bağlantı e-postayla gelmiş): "Bu bağlantı yalnız DestekOfis programından açılır…"; SDK yüklenmez, kapıcıya istek gitmez.
//   A9 SALDIRGANIN SAYFASI (genel köken) pencereyi açar ve DOĞRU sırrı postMessage ile verir: yok sayılır; aynı ileti; SDK yok, kapıcıya istek yok.
//   A10 program yerel olmayan adla açılmış (uzak.ofis.example): WhatsApp'ı Bağla pasif + "ofisteki bilgisayardan yapılır" yazısı; Elle Bağla etkin; API 409.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-whatsapp-ayar-248).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, createClient, startTestServer } from "../helpers.mjs";
import { lisansAnahtari } from "../kapi-ortak.mjs";
import { startKapi } from "../kapi-yerel.mjs";
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
// 2.4.9 UI tur B (ORTA-3): bildirimler "<sınıf>|<metin>" olarak okunur; tıklamadan önce kap boşaltılır (aynı metinli eski bildirim ×2 sayılmasın).
const clearToasts = () => page.evaluate(() => document.getElementById("hof-toasts")?.replaceChildren());
const toastsNow = () => page.evaluate(() => [...document.querySelectorAll("#hof-toasts .hof-toast")].map(node => `${node.className}|${node.querySelector(".hof-toast-text")?.textContent.trim() || ""}`));
const firstToast = async () => {
  await page.waitForSelector("#hof-toasts .hof-toast", { timeout: 15000 });
  return toastsNow();
};

// ---------- 2.4.8 W7 ortamı: ikinci program (lisanslı) + yerel kapıcı (https, kendinden imzalı) + kapıcının sahte Meta'sı (kod → belirteç) ----------
const W7 = {
  app: "1505264761663625",
  config: "990011223344556",
  token: "SAHTE-W7-isletme_Belirteci.248-AsDfGh0123456789",
  firma: `Kurban <img src=x onerror="window.__xss=1"> & "Ltd" <script>window.__xss=2</script>`,
  kod: "AQD-e2e-kodu-0001",
  yalniz: "Bu bağlantı yalnız DestekOfis programından açılır. Bağlantıyı size başkası gönderdiyse pencereyi kapatın.",
  yerel: "WhatsApp'ı Bağla işlemi ofisteki bilgisayardan yapılır: programı ofis ağındaki bir bilgisayarda açıp yeniden deneyin.",
};
const lisans = lisansAnahtari();
const W7_MACHINE = "a7".repeat(16);
const w7Token = () => lisans.belirtec({ at: Date.now(), machine: W7_MACHINE, licenseId: "LIS-E2E-W7" });
const metaExchanges = [];
const kapi = await startKapi({
  tls: true,
  trustedKeys: lisans.trusted,
  lisansFetch: async () => ({ json: async () => ({ ok: true, token: w7Token() }) }),
  ekEnv: { WA_UYGULAMA_KIMLIGI: W7.app, WA_KURULUM_KIMLIGI: W7.config, WA_UYGULAMA_SIRRI: "E2E-META-APP-SECRET-0123456789", WA_GRAPH_URL: "https://meta.kapi.test" },
  waFetch: async url => {
    metaExchanges.push(new URL(url).searchParams.get("code"));
    return new Response(JSON.stringify({ access_token: W7.token, token_type: "bearer" }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
const fake2 = await startFakeGraph({ token: W7.token, phoneNumberId: PNID, wabaId: WABA, verifiedName: "Kurban Ticaret Ltd" });
const server2 = await startTestServer({
  mobileKapiUrl: kapi.base,
  whatsappGraphUrl: fake2.url,
  whatsappTimeoutMs: 3000,
  license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.e2e.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: w7Token() }) }), machineId: W7_MACHINE, firstCheckDelayMs: 3_600_000, autoTrial: false },
});
await server2.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
const admin2 = createClient(server2.base);
await admin2.login("admin", ADMIN_PASSWORD);
if ((await admin2.put("/api/admin/office", { name: W7.firma })).status !== 200) throw new Error("ikinci programın ofis adı yazılamadı");
const port2 = new URL(server2.base).port;
const kapiIstekleri = yol => kapi.gunluk.filter(item => item.adres.startsWith(`kapi.destekofis.test${yol}`)).length;

// Kapıcının adı ve "uzak" ad yerel portlara; vekil sunucu ortam değişkenleri tarayıcıya geçmez (yerel ad vekilde çözülmez).
const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP kapi.destekofis.test 127.0.0.1:${kapi.tlsPort}, MAP uzak.ofis.example 127.0.0.1`, "--ignore-certificate-errors", "--no-proxy-server"],
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/proxy/i.test(key))),
});
// Sahte Facebook: SDK (FB.init / FB.login) ve Meta penceresi (WA_EMBEDDED_SIGNUP + kod). Yerel olmayan her istek kaydedilir ve kesilir (gerçek Meta'ya istek YOK).
const SAHTE_SDK = `window.__fbYuklendi=(window.__fbYuklendi||0)+1;window.FB={init:o=>{window.__fbInit=o},login:(cb,secenek)=>{window.__fbLogin=secenek;window.addEventListener("message",function bitti(e){if(e.origin==="https://www.facebook.com"&&e.data==="sahte-es-bitti"){window.removeEventListener("message",bitti);cb({authResponse:{code:${JSON.stringify(W7.kod)}}})}});const f=document.createElement("iframe");f.style.display="none";f.src="https://www.facebook.com/destekofis-sahte-es";document.body.appendChild(f)}};setTimeout(()=>window.fbAsyncInit&&window.fbAsyncInit(),0);`;
const SAHTE_ES = `<!doctype html><script>parent.postMessage(JSON.stringify({type:"WA_EMBEDDED_SIGNUP",event:"FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",data:{waba_id:${JSON.stringify(WABA)},phone_number_id:${JSON.stringify(PNID)}}}),"*");parent.postMessage("sahte-es-bitti","*");</script>`;
// Saldırganın sayfası (genel köken): bağlama penceresini açar, "hazır" iletisine DOĞRU sırla yanıt verir (oturumu kendisi açmıştır).
const SALDIRGAN = `<!doctype html><title>DestekOfis Destek</title><script>window.__hazir=0;window.saldir=(url,oturum,sir)=>{const w=window.open(url,"kurban","popup,width=600,height=700");window.addEventListener("message",e=>{if(e.data&&e.data.tur==="destekofis-wa-hazir"){window.__hazir+=1;w.postMessage({tur:"destekofis-wa-sir",oturum,sir},"*")}});return Boolean(w)};</script>`;
const sdkLoads = [];
const externalRequests = [];
const requestUrls = [];
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "kapi.destekofis.test", "uzak.ofis.example"]);
async function routeW7(context, label) {
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    requestUrls.push(url.href);
    if (LOCAL_HOSTS.has(url.hostname)) return route.continue();
    if (url.hostname === "connect.facebook.net") {
      sdkLoads.push(label);
      return route.fulfill({ status: 200, contentType: "application/javascript", body: SAHTE_SDK });
    }
    if (url.hostname === "www.facebook.com" && url.pathname === "/destekofis-sahte-es") return route.fulfill({ status: 200, contentType: "text/html", body: SAHTE_ES });
    if (url.hostname === "saldirgan.example") return route.fulfill({ status: 200, contentType: "text/html", body: SALDIRGAN });
    externalRequests.push(url.href);
    return route.abort();
  });
}
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

// 2.4.8 W7 (ürün sahibi kararı: düğme DÜZ AÇIK — gizli bayrak / "yakında" yok): bu kurulumda kapıcı yok → tıklayınca açık Türkçe ileti; açılan boş pencere kapanır.
await step("A1b WhatsApp'ı Bağla: düğme görünür ve etkin; kapıcısız kurulumda açık ileti, pencere kapanır, Meta'ya istek yok", async () => {
  const button = '[data-wa-action="embedded"]';
  ok(await page.isVisible(button), "WhatsApp'ı Bağla düğmesi görünür");
  ok((await text(button)) === "WhatsApp'ı Bağla", "düğme adı");
  ok(!(await page.isDisabled(button)), "düğme etkin (düz açık)");
  const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
  await page.click(button);
  const popup = await popupPromise;
  await page.waitForFunction(() => (document.getElementById("hof-toasts")?.textContent || "").includes("WhatsApp'ı Bağla bu kurulumda kullanılamıyor"), null, { timeout: 15000 });
  if (popup) await popup.waitForEvent("close", { timeout: 5000 }).catch(() => null);
  ok(!popup || popup.isClosed(), "boş bağlama penceresi kapandı");
  ok(fake.requests.length === 0, "Meta'ya istek yok");
  await shot("01b-bagla-ileti");
});

await step("A2 Elle Bağla: Tab ile insan hızında yazım → Kaydet ve Sına → Bağlı; belirteç ekranda ve yanıtlarda yok", async () => {
  await page.click('[data-wa-action="connect"]');
  const modal = await topModal();
  ok((await text(`${modal} .hof-modal-title, ${modal} h2`)).includes("Elle Bağla"), "pencere başlığı Elle Bağla");
  // 2.4.9 UI tur B (D8 — K-1 kılavuzuyla çelişki): App ID isteğe bağlı ama program Ekstre şablonunu Meta'da açarken gerekir (örnek PDF /<App ID>/uploads ile yüklenir;
  // lib/whatsapp/templates.mjs). Yardım yazısı bunu söyler.
  const appHelp = await text(`${modal} label:has([name="appId"]) small`).catch(() => "");
  ok(/^İsteğe bağlı; Ekstre şablonunu Meta'da açmak için gerekir/.test(appHelp), `App ID yardımı Ekstre şablonunu söylüyor: ${appHelp}`);
  // 2.5.0 W-1(a) düzeltme turu 1 (dar kontrol, metin): System User belirtecinde süre "Never" seçilmeli (60 günlük belirtecin bitişi programa gelmez).
  const tokenHelp = await text(`${modal} label:has([name="token"]) small`).catch(() => "");
  ok(/Token expiration\) olarak Never seçin/.test(tokenHelp), `belirteç yardımı süre için Never diyor: ${tokenHelp}`);
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
  // 2.4.9 UI tur B (ORTA-3): Bildirim Yolu sorunu yokken (uzaktan adres henüz yok — Kayıtlı Değil) Kaydet ve Sına bildirimi AYNEN yeşil.
  const savedToasts = await toastsNow();
  ok(savedToasts.some(item => /hof-toast-success[^|]*\|Kaydedildi; bağlantı çalışıyor\.$/.test(item)) && !savedToasts.some(item => /hof-toast-warn/.test(item)), `Kaydet ve Sına bildirimi yeşil: ${savedToasts.join(" ‖ ")}`);
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

// T2 dar kontrol D3: durum bildirimi yolu kartta görünür (Kayıtlı Değil → Çalışıyor; Çakışma'da ne yapılacağı yazılı, Bağlantıyı Sına bu bilgisayarı seçer).
await step("A4b Bildirim Yolu: uzaktan adres yokken Kayıtlı Değil → Bağlantıyı Sına ile Çalışıyor; Çakışma'da neden yazısı, Bağlantıyı Sına düzeltir", async () => {
  if (!ok((await page.locator('[data-wa-fact="hook"]').count()) === 1, "kartta Bildirim Yolu satırı var")) return;
  ok((await fact("hook")).startsWith("Kayıtlı Değil"), `uzaktan adres yokken: ${await fact("hook")}`);
  server.app.mobileRemote.setPublicUrl("http://ofisx.destekofis.test");
  await clearToasts();
  await page.click('[data-wa-action="test"]');
  await page.waitForFunction(() => /^Çalışıyor/.test(document.querySelector('[data-wa-fact="hook"] dd')?.textContent.trim() || ""), null, { timeout: 15000 });
  ok(/^Çalışıyor · .+ tarihinde kaydedildi$/.test(await fact("hook")), `Bağlantıyı Sına sonrası: ${await fact("hook")}`);
  // 2.4.9 UI tur B (ORTA-3): Bildirim Yolu kaydedilince bildirim AYNEN yeşil "Bağlantı çalışıyor." (uyarı yok).
  const done = await firstToast();
  ok(done.some(item => /hof-toast-success[^|]*\|Bağlantı çalışıyor\.$/.test(item)) && !done.some(item => /hof-toast-warn|Bildirim Yolu/.test(item)), `başarılı yolda yeşil bildirim aynen: ${done.join(" ‖ ")}`);
  ok((await page.locator("[data-wa-hook-meta]").count()) === 0, "çalışırken Meta iletisi satırı yok");
  const ours = fake.state.override;
  ok(/^http:\/\/ofisx\.destekofis\.test\/wa\/kanca\//.test(String(ours)), "Meta'ya bu ofisin adresi kaydedildi");
  ok((await page.locator("[data-wa-hook-why]").count()) === 0, "çalışırken neden yazısı yok");
  // Ön koşul (zorla): aynı WhatsApp hesabı başka bir bilgisayarda bağlandı — Meta'daki adres onunki; program iki kez farklı görünce "Çakışma" yazar
  // (algılama test/whatsapp-t2-3-248.test.mjs'te; burada yalnız ekranın gösterdiği ve Bağlantıyı Sına'nın düzelttiği denetlenir).
  fake.state.override = "https://baska-ofis.destekofis.net/wa/kanca/baskasinin-yolu";
  const ledger = server.app.whatsapp.ledger;
  const hook = ledger.hookOf(WABA);
  ledger.hookEvent({ ...hook, state: "conflict", error: "Meta'daki durum bildirimi adresi bu bilgisayarınkinden farklı.", at: new Date().toISOString() });
  await page.reload();
  await page.waitForSelector('[data-wa-fact="hook"]');
  ok((await fact("hook")).startsWith("Çakışma"), `çakışmada: ${await fact("hook")}`);
  const why = (await page.textContent("[data-wa-hook-why]").catch(() => "")) || "";
  ok(/başka bir bilgisayarda da bağlı/.test(why) && /Bağlantıyı Sına'ya basın/.test(why), `ne yapılacağı yazılı: ${why.slice(0, 120)}`);
  ok(await page.isEnabled('[data-wa-action="test"]'), "Bağlantıyı Sına etkin");
  await shot("05b-bildirim-cakisma");
  await page.click('[data-wa-action="test"]');
  await page.waitForFunction(() => /^Çalışıyor/.test(document.querySelector('[data-wa-fact="hook"] dd')?.textContent.trim() || ""), null, { timeout: 15000 });
  // Yeniden kayıt yeni gizli yolla yapılır (eski yol öbür bilgisayarın eline geçmiş olabilir): adres bu ofisin, yol yeni.
  ok(/^http:\/\/ofisx\.destekofis\.test\/wa\/kanca\//.test(String(fake.state.override)) && fake.state.override !== ours, `Bağlantıyı Sına Meta'daki adresi bu bilgisayara geri aldı (yeni gizli yol)`);
  ok((await page.locator("[data-wa-hook-why]").count()) === 0, "çakışma yazısı kalktı");
  server.app.mobileRemote.setPublicUrl("");
});

// 2.4.9 UI tur B (ORTA-3, UI/UX gezintisi 04.11): Meta abonelik kaydını reddederken (100 "must be subscribed" — ELLE KABUL BULGUSU 3) Bağlantıyı Sına ve Kaydet ve Sına
// YEŞİL "Bağlantı çalışıyor." diyordu; hata yalnız dar Bildirim Yolu hücresinde İngilizce Meta iletisi ve iç içe parantezle (hücreler kayıyordu). İstenen: UYARI bildirimi,
// neden düğmelerin altında ayrı Türkçe satırda, hücrede yalnız "Kaydedilemedi · <tarih>", Meta'nın ham iletisi ayrı küçük satırda "Meta iletisi: …".
await step("A4c Bildirim Yolu kaydedilemedi (Meta 100 abonelik): uyarı bildirimi, neden düğmelerin altında Türkçe, hücrede yalnız Kaydedilemedi + tarih; düzelince yeşil", async () => {
  const UYARI = "Bağlantı çalışıyor; ancak Bildirim Yolu kaydedilemedi — nedeni aşağıda.";
  const META = "(#100) Before override the current callback uri, your app must be subscribed to receive messages for WhatsApp Business Account";
  server.app.mobileRemote.setPublicUrl("http://ofisx.destekofis.test");
  // Ön koşul (zorla): Meta'daki adres kalkmış (uygulamanın aboneliği kaldırılmış) → Bağlantıyı Sına yeniden kaydetmeyi dener; Meta abonelik kaydını 100 ile reddeder.
  // A4b'den kalan "Çalışıyor" kaydı Meta'daki adresle eşleşirse program yalnız doğrular, kayıt istemez (ön koşul oluşmaz) — aşağıda istek sayısıyla denetlenir.
  fake.state.override = null;
  fake.set({ failNext: { match: /^POST \/\d+\/subscribed_apps$/, sticky: true, status: 400, body: { error: { message: META, type: "OAuthException", code: 100, fbtrace_id: "AbCdEfGh" } } } });
  const subscribePosts = () => fake.requests.filter(item => item.method === "POST" && /\/subscribed_apps$/.test(item.path)).length;
  const hookFacts = async () => {
    await page.waitForFunction(() => /^Kaydedilemedi/.test(document.querySelector('[data-wa-fact="hook"] dd')?.textContent.trim() || ""), null, { timeout: 15000 });
    const cell = await fact("hook");
    ok(/^Kaydedilemedi · \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(cell), `hücrede yalnız Kaydedilemedi + tarih: ${cell}`);
    const why = (await page.textContent("[data-wa-hook-why]").catch(() => "")) || "";
    ok(/^Bildirim Yolu kaydedilemedi — Meta bildirim adresini kaydetmedi: uygulamanızın bu WhatsApp Business hesabına aboneliği/.test(why.trim()) && /Elle Bağla ön koşullarını/.test(why), `neden Türkçe satırda: ${why.slice(0, 160)}`);
    ok(!/must be subscribed|Before override|\(#100\)/.test(why), "neden satırında İngilizce Meta iletisi yok");
    const meta = ((await page.textContent("[data-wa-hook-meta]").catch(() => "")) || "").trim();
    ok(meta === `Meta iletisi: ${META}`, `Meta iletisi ayrı satırda: ${meta.slice(0, 120)}`);
    // Neden ve Meta iletisi düğmelerin ALTINDA (çakışma uyarısındaki adm-wa-why düzeni); bilgi kutusunun içinde değil.
    const order = await page.evaluate(() => {
      const actions = document.querySelector(".adm-wa-actions");
      const why = document.querySelector("[data-wa-hook-why]");
      const meta = document.querySelector("[data-wa-hook-meta]");
      const facts = document.querySelector("[data-wa-facts]");
      const after = (a, b) => Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { whyAfterActions: after(actions, why), metaAfterWhy: after(why, meta), outsideFacts: !facts?.contains(why) && !facts?.contains(meta) };
    });
    ok(order.whyAfterActions && order.metaAfterWhy && order.outsideFacts, `neden düğmelerin altında, Meta iletisi onun altında, bilgi kutusunun dışında: ${JSON.stringify(order)}`);
    // Hücre kaymaz: Bildirim Yolu hücresi komşu hücre (Son Sınama) kadar kısa kalır.
    const heights = await page.evaluate(() => ["hook", "lastTest"].map(key => Math.round(document.querySelector(`[data-wa-fact="${key}"] dd`)?.getBoundingClientRect().height || 0)));
    ok(heights[0] > 0 && heights[0] <= Math.max(heights[1], 24) * 1.5, `Bildirim Yolu hücresi kısa (yükseklik ${heights[0]} px, Son Sınama ${heights[1]} px)`);
  };

  await clearToasts();
  const postsBefore = subscribePosts();
  await page.click('[data-wa-action="test"]');
  const warned = await firstToast();
  ok(subscribePosts() === postsBefore + 1, `ön koşul oluştu: Meta'ya abonelik kaydı istendi ve reddedildi (${subscribePosts() - postsBefore} istek)`);
  ok(warned.some(item => /hof-toast-warn[^|]*\|/.test(item) && item.endsWith(`|${UYARI}`)), `Bağlantıyı Sına: uyarı bildirimi: ${warned.join(" ‖ ")}`);
  ok(!warned.some(item => /hof-toast-success/.test(item)), "yeşil 'Bağlantı çalışıyor.' bildirimi yok");
  await hookFacts();
  ok((await text("[data-wa-state]")) === "Bağlı", "bağlantı (ileti gönderimi) çalışıyor: durum Bağlı");
  await shot("05c-bildirim-yolu-kaydedilemedi");
  // Sayfa yeniden açılınca da neden aynı yerde (bildirim kaçırılsa bile).
  await page.reload();
  await page.waitForSelector('[data-wa-fact="hook"]');
  await hookFacts();

  // Kaydet ve Sına (Bilgileri Değiştir → kayıtlı belirteç korunur): aynı uyarı, başında "Kaydedildi."
  await page.click('[data-wa-action="connect"]');
  const modal = await topModal();
  await clearToasts();
  await page.click(`${modal} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 15000 });
  const saved = await firstToast();
  ok(saved.some(item => /hof-toast-warn[^|]*\|/.test(item) && item.endsWith(`|Kaydedildi. ${UYARI}`)), `Kaydet ve Sına: uyarı bildirimi: ${saved.join(" ‖ ")}`);
  ok(!saved.some(item => /hof-toast-success[^|]*\|Kaydedildi; bağlantı çalışıyor\.$/.test(item)), "yeşil 'Kaydedildi; bağlantı çalışıyor.' yok");
  await hookFacts();

  // Meta'da ön koşul tamamlandı → Bağlantıyı Sına: yeşil bildirim aynen, neden ve Meta iletisi satırları kalkar.
  fake.set({ failNext: null });
  await clearToasts();
  await page.click('[data-wa-action="test"]');
  await page.waitForFunction(() => /^Çalışıyor/.test(document.querySelector('[data-wa-fact="hook"] dd')?.textContent.trim() || ""), null, { timeout: 15000 });
  const fixed = await firstToast();
  ok(fixed.some(item => /hof-toast-success[^|]*\|Bağlantı çalışıyor\.$/.test(item)) && !fixed.some(item => /hof-toast-warn/.test(item)), `düzelince yeşil bildirim: ${fixed.join(" ‖ ")}`);
  ok((await page.locator("[data-wa-hook-why]").count()) === 0 && (await page.locator("[data-wa-hook-meta]").count()) === 0, "neden ve Meta iletisi satırları kalktı");
  await shot("05d-bildirim-yolu-duzeldi");
  server.app.mobileRemote.setPublicUrl("");
});

// 2.5.0 BS-1 (2.4.9 birleşik son dar kontrol DÜŞÜK-3, gerileme): Meta YALNIZ hata kodu döndürüp ileti göndermezse kod ekrandan düşüyordu (UI tur B'den önce hücrede görünürdü).
await step("A4d Bildirim Yolu kaydedilemedi, Meta yalnız hata kodu döndürdü (ileti yok): neden satırında '(Meta hata kodu 100)', Meta iletisi satırı yok; düzelince satır kalkar", async () => {
  server.app.mobileRemote.setPublicUrl("http://ofisx.destekofis.test");
  fake.state.override = null; // ön koşul (zorla): Meta'daki adres kalkmış → Bağlantıyı Sına yeniden kaydetmeyi dener
  fake.set({ failNext: { match: /^POST \/\d+\/subscribed_apps$/, sticky: true, status: 400, body: { error: { code: 100, type: "OAuthException", fbtrace_id: "AbCdEfGh" } } } });
  const subscribePosts = () => fake.requests.filter(item => item.method === "POST" && /\/subscribed_apps$/.test(item.path)).length;
  const before = subscribePosts();
  await clearToasts();
  await page.click('[data-wa-action="test"]');
  await page.waitForFunction(() => /^Kaydedilemedi/.test(document.querySelector('[data-wa-fact="hook"] dd')?.textContent.trim() || ""), null, { timeout: 15000 });
  ok(subscribePosts() === before + 1, `ön koşul oluştu: abonelik kaydı istendi ve reddedildi (${subscribePosts() - before} istek)`);
  const why = ((await page.textContent("[data-wa-hook-why]").catch(() => "")) || "").trim();
  ok(/^Bildirim Yolu kaydedilemedi — .+ \(Meta hata kodu 100\)\. Kaydedilene dek teslim ve okundu bilgisi/.test(why), `neden satırında Meta hata kodu: ${why.slice(0, 200)}`);
  ok((await page.locator("[data-wa-hook-meta]").count()) === 0, "Meta iletisi satırı yok (Meta ileti göndermedi)");
  await shot("05e-bildirim-yolu-yalniz-kod");
  fake.set({ failNext: null });
  await clearToasts();
  await page.click('[data-wa-action="test"]');
  await page.waitForFunction(() => /^Çalışıyor/.test(document.querySelector('[data-wa-fact="hook"] dd')?.textContent.trim() || ""), null, { timeout: 15000 });
  ok((await page.locator("[data-wa-hook-why]").count()) === 0, "düzelince neden satırı kalktı");
  server.app.mobileRemote.setPublicUrl("");
});

// 2.5.0 WE: Elle Bağla'nın uygulama düzeyi webhook bilgileri programda (kılavuzdaki "destekten alın" kalktı). Değerler yalnız pencerede; belirteç gizli.
await step("A4e Webhook Bilgileri: pencerede Callback URL (ofisin adresi + /wa/kanca/…) ve Verify Token; Belirteci Kopyala bildirimi; değerler sunucununkiyle aynı; pencere kapanınca sayfada yok", async () => {
  server.app.mobileRemote.setPublicUrl("http://ofisx.destekofis.test");
  await page.click('[data-wa-action="webhook"]');
  const modal = await topModal();
  ok((await text(`${modal} .hof-modal-title, ${modal} h2`)).includes("Webhook Bilgileri"), "pencere başlığı Webhook Bilgileri");
  const callback = await text(`${modal} [data-wa-webhook-value="callback"]`);
  const verify = await text(`${modal} [data-wa-webhook-value="verify"]`);
  ok(/^http:\/\/ofisx\.destekofis\.test\/wa\/kanca\/[A-Za-z0-9_-]{43}$/.test(callback), `Callback URL: ${callback}`);
  ok(/^[A-Za-z0-9_-]{43}$/.test(verify), "Verify Token 43 karakter");
  const labels = await page.$$eval(`${modal} [data-wa-webhook] dt`, nodes => nodes.map(node => node.textContent.trim()));
  ok(JSON.stringify(labels) === JSON.stringify(["Callback URL (Bildirim Adresi)", "Verify Token (Doğrulama Belirteci)"]), `etiketler: ${labels.join(" | ")}`);
  const buttons = await page.$$eval(`${modal} [data-wa-webhook-copy]`, nodes => nodes.map(node => node.textContent.trim()));
  ok(JSON.stringify(buttons) === JSON.stringify(["Adresi Kopyala", "Belirteci Kopyala"]), `düğmeler: ${buttons.join(" | ")}`);
  const api = await page.evaluate(async () => (await (await fetch("/api/workspace/whatsapp/app-webhook")).json()).data);
  ok(api.callbackUrl === callback && api.verifyToken === verify, "ekrandaki değerler sunucununkiyle aynı");
  await clearToasts();
  await page.click(`${modal} [data-wa-webhook-copy="verify"]`);
  const copied = await firstToast();
  ok(copied.some(item => /hof-toast-success[^|]*\|Doğrulama belirteci panoya kopyalandı\.$/.test(item)), `Belirteci Kopyala bildirimi: ${copied.join(" ‖ ")}`);
  await shot("05f-webhook-bilgileri");
  await page.keyboard.press("Escape");
  // Pencere kapanınca düğüm kısa geçişten (160 ms) sonra sayfadan kalkar — okuma ondan sonra (ders 39).
  await page.waitForFunction(() => !document.querySelector("[data-wa-webhook-value]"), null, { timeout: 15000 });
  ok(!(await page.content()).includes(verify), "pencere kapanınca sayfada belirteç yok");
  server.app.mobileRemote.setPublicUrl("");
});

const unsubscribes = () => fake.requests.filter(item => item.method === "DELETE" && /\/subscribed_apps$/.test(item.path)).length;
await step("A5 Bağlantıyı Kaldır (onaylı) → Bağlı Değil; ayar satırı silindi; 2.5.0 W-2: Meta'daki abonelik de silindi, yeşil bildirim", async () => {
  await clearToasts();
  await page.click('[data-wa-action="remove"]');
  const modal = await topModal();
  ok(/kaldırılsın mı/.test(await text(modal)), "onay sorusu soruldu");
  // 2.5.0 W-2 düzeltme turu 1 (metin): Elle Bağla'da abonelik müşterinin kendi Meta uygulamasınındır ("DestekOfis'in" değil).
  const sure = await text(modal);
  ok(/Meta uygulamanızın bu WhatsApp hesabındaki bildirim aboneliği de kaldırılır/.test(sure) && !/DestekOfis'in/.test(sure) && /bekleyen otomatik gönderimler durdurulur/.test(sure), `onay metni (Elle Bağla) kendi uygulamanın aboneliğini ve bekleyen gönderimleri söylüyor: ${sure.slice(0, 220)}`);
  await page.click(`${modal} .hof-button-danger`);
  ok((await waitState("Bağlı Değil")) === "Bağlı Değil", "durum Bağlı Değil");
  ok(settingRow() === null, "veri tabanında bağlantı yok");
  ok(unsubscribes() === 1, `Meta'ya bir abonelik silme isteği (${unsubscribes()})`);
  const toasts = await firstToast();
  ok(toasts.some(item => /hof-toast-success[^|]*\|WhatsApp bağlantısı kaldırıldı; Meta'daki abonelik de silindi\./.test(item)), `yeşil bildirim: ${toasts.join(" ‖ ")}`);
  await shot("06-kaldirildi");
});

// 2.5.0 W-2 (plan §1 W-2): Meta tarafı düşerse yerel kaldırma YİNE yapılır; uyarı + destekofis.net/veri-silme düğmesi.
await step("A5b Meta abonelik silmeyi reddederse: bağlantı yine kaldırılır, uyarı bildirimi 'Meta tarafında kaldırılamadı' + Veri Silme Adımları düğmesi", async () => {
  ok((await adminApi.put("/api/workspace/whatsapp/connection", { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status === 200, "ön koşul: yeniden bağlandı");
  await page.reload();
  await page.waitForSelector('[data-wa-action="remove"]');
  fake.set({ failNext: { match: /^DELETE \/\d+\/subscribed_apps$/, status: 400, body: { error: { message: "(#100) Invalid parameter", type: "OAuthException", code: 100, fbtrace_id: "AbCd" } } } });
  await clearToasts();
  await page.click('[data-wa-action="remove"]');
  const modal = await topModal();
  await page.click(`${modal} .hof-button-danger`);
  ok((await waitState("Bağlı Değil")) === "Bağlı Değil", "durum Bağlı Değil (yerel kaldırma yapıldı)");
  ok(settingRow() === null, "veri tabanında bağlantı yok");
  const toasts = await firstToast();
  ok(toasts.some(item => /hof-toast-warn[^|]*\|.*Meta tarafında kaldırılamadı.*destekofis\.net\/veri-silme/.test(item)), `uyarı bildirimi: ${toasts.join(" ‖ ")}`);
  ok((await page.locator("#hof-toasts .hof-toast-action").allTextContents()).includes("Veri Silme Adımları"), "Veri Silme Adımları düğmesi");
  await shot("06b-meta-kaldirilamadi");
});

// 2.5.0 W-1(a) (plan §1 W-1 (a)): Yol 2 bağlantısı bağlanma + 60 gün; bitişe 7 gün kala satır + günde bir bildirim; bitişte Süresi Doldu, deneme pasif + neden, Yeniden Bağla açık.
await step("A5c belirteç süresi: 53. gün uyarı satırı + Yeniden Bağla; ana ekranda günde bir bildirim; 60. gün Süresi Doldu, Kendime Deneme Gönder pasif + neden, Yeniden Bağla ve Bağlantıyı Sına açık", async () => {
  const clock = server.app.config.now;
  const t0 = clock.ms();
  try {
    const admin = server.app.store.get("SELECT * FROM users WHERE username = 'admin'");
    server.app.context.whatsapp.connection.saveEmbedded(admin, { token: TOKEN, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH", appId: APP });
    clock.set(t0 + 53 * 86_400_000);
    // Sayfa zaten Yönetim → WhatsApp'ta (aynı adrese goto yenilemez): yeniden yüklenir.
    await page.reload();
    await page.waitForSelector("[data-wa-token-why]");
    const why = await text("[data-wa-token-why]");
    ok(why.startsWith("WhatsApp bağlantınızın süresi doluyor — yeniden bağlayın") && /7 gün kaldı/.test(why), `uyarı satırı: ${why}`);
    ok(/tarihine kadar · 7 gün kaldı$/.test(await fact("tokenExpiry")), `Bağlantı Süresi: ${await fact("tokenExpiry")}`);
    ok(await page.isVisible('[data-wa-action="reconnect"]') && !(await page.isDisabled('[data-wa-action="reconnect"]')), "Yeniden Bağla görünür ve etkin");
    await shot("06c-suresi-doluyor");
    // Ana ekran: yöneticiye bildirim (günde en çok bir kez).
    const notices = () => page.evaluate(() => [...document.querySelectorAll("#hof-toasts .hof-toast")].filter(node => /süresi doluyor/.test(node.textContent)).length);
    await page.goto(`${server.base}/`);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    const shown = await page.waitForFunction(() => /süresi doluyor — yeniden bağlayın/.test(document.getElementById("hof-toasts")?.textContent || ""), null, { timeout: 15000 }).then(() => true, () => false);
    ok(shown, "ana ekranda bildirim çıktı");
    ok((await page.locator("#hof-toasts .hof-toast-action").allTextContents()).includes("Yeniden Bağla"), "bildirimde Yeniden Bağla düğmesi");
    await page.reload();
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.waitForTimeout(4000);
    ok((await notices()) === 0, "aynı gün yeniden açılınca bildirim yok (günde en çok bir kez)");
    // Bitiş: Süresi Doldu.
    clock.set(t0 + 60 * 86_400_000 + 60_000);
    await page.goto(`${server.base}/admin.html#whatsapp`);
    ok((await waitState("Süresi Doldu")) === "Süresi Doldu", "durum Süresi Doldu");
    ok(/süresi doldu/.test(await text("[data-wa-token-why]")), `neden satırı: ${await text("[data-wa-token-why]")}`);
    ok(await page.isDisabled('[data-wa-action="self-test"]'), "Kendime Deneme Gönder pasif");
    ok(/deneme iletisi gönderilemez/.test(await text("[data-wa-why-self]").catch(() => "")), `pasif düğmenin nedeni görünür: ${await text("[data-wa-why-self]").catch(() => "(yok)")}`);
    ok(!(await page.isDisabled('[data-wa-action="reconnect"]')) && !(await page.isDisabled('[data-wa-action="test"]')), "Yeniden Bağla ve Bağlantıyı Sına etkin");
    await shot("06d-suresi-doldu");
    // Yeniden Bağla (WhatsApp'ı Bağla yolu): bu kurulumda kapıcı yok → açık ileti (düğme çalışır, kilitlenmez).
    await clearToasts();
    const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
    await page.click('[data-wa-action="reconnect"]');
    const popup = await popupPromise;
    ok(await page.waitForFunction(() => (document.getElementById("hof-toasts")?.textContent || "").includes("WhatsApp'ı Bağla bu kurulumda kullanılamıyor"), null, { timeout: 15000 }).then(() => true, () => false), "Yeniden Bağla WhatsApp'ı Bağla yolunu açtı (kapıcısız kurulumda açık ileti)");
    if (popup) await popup.waitForEvent("close", { timeout: 5000 }).catch(() => null);
  } finally {
    clock.set(t0);
    await adminApi.del("/api/workspace/whatsapp/connection").catch(() => null);
  }
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
  // 2.5.0 WE: Elle Bağla webhook bilgileri (gizli belirteç) yalnız yöneticiye.
  const webhook = await staffPage.evaluate(async () => (await fetch("/api/workspace/whatsapp/app-webhook")).status);
  ok(webhook === 403, `Webhook bilgileri API 403 (${webhook})`);
  await staff.close();
});

// ---------- 2.4.8 W7: taşınamaz bağlantı (A7–A10) ----------
const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true });
await routeW7(ctx2, "program");
const page2 = await ctx2.newPage();
page2.setDefaultTimeout(20000);
page2.on("pageerror", error => pageErrors.push(`program 2: ${error.message}`));
const secrets = [];
page2.on("response", async response => {
  if (!/\/api\/workspace\/whatsapp\/connection\/embedded$/.test(new URL(response.url()).pathname)) return;
  try {
    const body = JSON.parse(await response.text());
    if (body?.data?.secret) secrets.push(body.data.secret);
  } catch {
    // gövdesiz
  }
});
const login = async (target, base) => {
  await target.goto(`${base}/`);
  await target.fill("#hof-auth input[name=username]", "admin");
  await target.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
  await target.waitForSelector("#hof-sidecard", { timeout: 60000 });
};
const statusOf = target => target.evaluate(() => document.getElementById("wa-durum")?.textContent.trim() || "");
const waitStatus = (target, expected, timeout = 20000) => target.waitForFunction(text => document.getElementById("wa-durum")?.textContent.trim() === text, expected, { timeout });

await step("A7 WhatsApp'ı Bağla uçtan uca: pencere → sır postMessage ile → Bağlanacak Program → Facebook ile Devam Et → Bağlı; sır adreslerde yok", async () => {
  await login(page2, server2.base);
  const adminResponse = await page2.goto(`${server2.base}/admin.html#whatsapp`);
  ok(adminResponse?.headers()["cross-origin-opener-policy"] === "same-origin-allow-popups", `Yönetim sayfası COOP same-origin-allow-popups (${adminResponse?.headers()["cross-origin-opener-policy"]})`);
  await page2.waitForSelector("[data-wa-state]");
  ok(!(await page2.isDisabled('[data-wa-action="embedded"]')), "WhatsApp'ı Bağla etkin (yerel adres)");
  const popupPromise = page2.waitForEvent("popup");
  const pageResponsePromise = ctx2.waitForEvent("response", { predicate: response => new URL(response.url()).pathname === "/wa/bagla" && response.request().resourceType() === "document", timeout: 20000 });
  await page2.click('[data-wa-action="embedded"]');
  const popup = await popupPromise;
  popup.on("pageerror", error => pageErrors.push(`bağlama penceresi: ${error.message}`));
  const pageResponse = await pageResponsePromise;
  const headers = pageResponse.headers();
  ok(/frame-ancestors 'none'/.test(headers["content-security-policy"] || "") && headers["x-frame-options"] === "DENY", "kapıcı sayfası çerçeveye alınamaz (frame-ancestors 'none' + DENY)");
  ok(!headers["cross-origin-opener-policy"], "kapıcı sayfası COOP koymaz");
  await popup.waitForSelector("#wa-hedef:not([hidden])", { timeout: 20000 });
  ok((await popup.textContent("#wa-firma")) === W7.firma, `Bağlanacak Program: firma adı aynen (${(await popup.textContent("#wa-firma"))?.slice(0, 40)}…)`);
  ok((await popup.evaluate(() => [window.__xss, document.querySelectorAll("img, #wa-firma script").length])).join() === ",0", "firma adındaki HTML yorumlanmadı (betik / resim yok)");
  await waitStatus(popup, "Facebook ile Devam Et'e basın.");
  ok(await popup.evaluate(() => window.opener === null), "sayfa sırrı alınca pencereyi açanla bağı kesti (Facebook betiği programa erişemez)");
  ok(sdkLoads.filter(item => item === "program").length === 1, `Facebook SDK sır doğrulanınca bir kez yüklendi (${sdkLoads.length})`);
  ok(secrets.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(secrets[0]), "program ekranı tek kullanımlık sırrı aldı");
  await popup.screenshot({ path: path.join(shots, "wa-248-07-bagla-penceresi.png"), fullPage: true }).catch(() => null);
  await popup.click("#wa-bagla");
  await waitStatus(popup, "Bağlantı tamamlandı. Bu pencereyi kapatıp DestekOfis'e dönün.");
  ok(metaExchanges.length === 1 && metaExchanges[0] === W7.kod, `kapıcı Meta'da kodu bir kez değiştirdi (${metaExchanges.join(",")})`);
  await page2.bringToFront();
  ok((await page2.waitForFunction(() => document.querySelector("[data-wa-state]")?.textContent.trim() === "Bağlı", null, { timeout: 30000 }).then(() => true)), "program Bağlı");
  ok((await page2.textContent('[data-wa-fact="mode"] dd'))?.trim() === "WhatsApp'ı Bağla", "Bağlantı Yolu: WhatsApp'ı Bağla");
  // 2.5.0 W-1(a): gerçek kapıcı Meta'nın süresini aktarmaz → bağlanma + 60 gün (yapılandırmanın süresi).
  ok(/tarihine kadar · 60 gün kaldı$/.test((await page2.textContent('[data-wa-fact="tokenExpiry"] dd').catch(() => ""))?.trim() || ""), `Bağlantı Süresi: ${(await page2.textContent('[data-wa-fact="tokenExpiry"] dd').catch(() => ""))?.trim()}`);
  // App ID kapıcıdan gelir (bulgu ORTA: embedded kipte boştu → Ekstre şablonu açılamıyor, ileti olmayan "Bilgileri Değiştir"e gönderiyordu). Program bağlanınca
  // şablonları kendisi açar: örnek PDF /<App ID>/uploads ile yüklenir, Ekstre Meta'ya gönderilir.
  ok((await page2.textContent('[data-wa-fact="appId"] dd').catch(() => ""))?.trim() === W7.app, "Uygulama Kimliği kapıcıdan geldi");
  const ekstreSent = () => fake2.requests.some(item => item.method === "POST" && item.path.endsWith("/message_templates") && item.body?.name === "destekofis_ekstre");
  for (let i = 0; i < 60 && !ekstreSent(); i += 1) await page2.waitForTimeout(250);
  ok(fake2.requests.some(item => item.method === "POST" && item.path === `/${W7.app}/uploads`) && fake2.state.uploads.length === 1, `örnek PDF App ID ile yüklendi (${fake2.state.uploads.length})`);
  ok(ekstreSent(), "Ekstre şablonu Meta'ya gönderildi");
  await page2.waitForFunction(() => !/şablonları denetleniyor/i.test(document.body.textContent), null, { timeout: 15000 }).catch(() => null);
  ok(!(await page2.content()).includes("Bilgileri Değiştir ile Meta uygulama"), "Şablonlar kartı olmayan düğmeye yönlendirmiyor");
  const secret = secrets[0] || "-";
  ok(!requestUrls.some(item => item.includes(secret)) && !kapi.gunluk.some(item => item.adres.includes(secret)), `sır hiçbir istek adresinde yok (${requestUrls.length} istek)`);
  await page2.screenshot({ path: path.join(shots, "wa-248-08-bagla-bagli.png"), fullPage: true }).catch(() => null);
  if (!popup.isClosed()) await popup.close();
});

await step("A8 TAŞINAN BAĞLANTI (pencereyi açan yok): ileti, düğme pasif, SDK yüklenmez, kapıcıya istek yok", async () => {
  const opened = await admin2.post("/api/workspace/whatsapp/connection/embedded", {});
  ok(opened.status === 200 && opened.data.data.url, `ön koşul: saldırganın oturumu (${opened.status})`);
  const victim = await browser.newContext({ viewport: { width: 640, height: 760 }, ignoreHTTPSErrors: true });
  await routeW7(victim, "tasinan");
  const before = [kapiIstekleri("/wa/bagla/dogrula"), kapiIstekleri("/wa/bagla/kod")];
  const tab = await victim.newPage();
  tab.on("pageerror", error => pageErrors.push(`taşınan bağlantı: ${error.message}`));
  await tab.goto(opened.data.data.url);
  await waitStatus(tab, W7.yalniz, 5000).catch(() => null);
  ok((await statusOf(tab)) === W7.yalniz, `ileti: ${await statusOf(tab)}`);
  await tab.waitForTimeout(1500);
  ok(await tab.isDisabled("#wa-bagla"), "Facebook ile Devam Et pasif");
  // T3 UI/UX ORTA-3: pasif düğme pasif GÖRÜNÜR (soluk + yasak imleç); CSP gevşetilmeden (sayfanın nonce'lu stili).
  const gorunus = await tab.$eval("#wa-bagla", node => ({ opacity: Number(getComputedStyle(node).opacity), cursor: getComputedStyle(node).cursor }));
  ok(gorunus.opacity <= 0.6 && gorunus.cursor === "not-allowed", `pasif görünüm: opaklık ${gorunus.opacity}, imleç ${gorunus.cursor}`);
  ok(await tab.isHidden("#wa-hedef"), "firma adı gösterilmedi");
  ok(!sdkLoads.includes("tasinan"), "Facebook SDK yüklenmedi (Meta akışı başlamadı)");
  ok(kapiIstekleri("/wa/bagla/dogrula") === before[0] && kapiIstekleri("/wa/bagla/kod") === before[1], "kapıcıya doğrulama / kod isteği gitmedi");
  await tab.screenshot({ path: path.join(shots, "wa-248-09-tasinan-baglanti.png"), fullPage: true }).catch(() => null);
  await victim.close();
});

await step("A9 SALDIRGANIN SAYFASI pencereyi açıp DOĞRU sırrı verir: genel kökenden ileti yok sayılır; SDK yok, kapıcıya istek yok", async () => {
  const opened = await admin2.post("/api/workspace/whatsapp/connection/embedded", {});
  const { url, session, secret } = opened.data.data || {};
  ok(opened.status === 200 && url, `ön koşul: saldırganın oturumu ve sırrı (${opened.status}, sır ${secret ? "var" : "yok"})`);
  const victim = await browser.newContext({ viewport: { width: 900, height: 760 }, ignoreHTTPSErrors: true });
  await routeW7(victim, "saldirgan");
  const before = [kapiIstekleri("/wa/bagla/dogrula"), kapiIstekleri("/wa/bagla/kod")];
  const evil = await victim.newPage();
  await evil.goto("https://saldirgan.example/");
  const popupPromise = evil.waitForEvent("popup");
  ok(await evil.evaluate(([u, o, s]) => window.saldir(u, o, s), [url, session, secret || ""]), "saldırganın sayfası bağlama penceresini açtı");
  const popup = await popupPromise;
  popup.on("pageerror", error => pageErrors.push(`saldırgan penceresi: ${error.message}`));
  await waitStatus(popup, W7.yalniz, 25000).catch(() => null);
  ok((await evil.evaluate(() => window.__hazir)) >= 1, `ön koşul: sayfa "hazır" dedi, saldırgan sırrı gönderdi (${await evil.evaluate(() => window.__hazir)} kez)`);
  ok((await statusOf(popup)) === W7.yalniz, `ileti: ${await statusOf(popup)}`);
  ok(await popup.isDisabled("#wa-bagla"), "Facebook ile Devam Et pasif");
  ok(!sdkLoads.includes("saldirgan"), "Facebook SDK yüklenmedi");
  ok(kapiIstekleri("/wa/bagla/dogrula") === before[0] && kapiIstekleri("/wa/bagla/kod") === before[1], "kapıcıya doğrulama / kod isteği gitmedi");
  await popup.screenshot({ path: path.join(shots, "wa-248-10-saldirgan-penceresi.png"), fullPage: true }).catch(() => null);
  await victim.close();
});

await step("A10 program yerel olmayan adla açık (uzak.ofis.example): WhatsApp'ı Bağla pasif + neden yazısı; öbür düğmeler etkin; API 409", async () => {
  const remote = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await routeW7(remote, "uzak");
  const tab = await remote.newPage();
  tab.on("pageerror", error => pageErrors.push(`uzak ad: ${error.message}`));
  tab.setDefaultTimeout(20000);
  const base = `http://uzak.ofis.example:${port2}`;
  await login(tab, base);
  await tab.goto(`${base}/admin.html#whatsapp`);
  await tab.waitForSelector("[data-wa-action]");
  const button = (await tab.$('[data-wa-action="embedded"]')) ? '[data-wa-action="embedded"]' : null;
  ok(button && (await tab.isDisabled(button)), "WhatsApp'ı Bağla / Yeniden Bağla pasif");
  const others = await tab.$$eval('[data-wa-action]:not([data-wa-action="embedded"])', items => items.map(item => [item.dataset.waAction, item.disabled]));
  ok(others.length > 0 && others.every(([, disabled]) => !disabled), `öbür düğmeler etkin (${others.map(([name]) => name).join(", ")})`);
  ok((await tab.textContent("[data-wa-why-embedded]").catch(() => ""))?.trim() === W7.yerel, `neden görünür yazıyla: ${await tab.textContent("[data-wa-why-embedded]").catch(() => "(yok)")}`);
  const api = await tab.evaluate(async () => {
    const response = await fetch("/api/workspace/whatsapp/connection/embedded", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  });
  ok(api.status === 409 && api.body.code === "whatsapp-embedded-local", `API 409 whatsapp-embedded-local (${api.status} ${api.body.code || ""})`);
  await tab.screenshot({ path: path.join(shots, "wa-248-11-uzak-ad.png"), fullPage: true }).catch(() => null);
  await remote.close();
});

ok(externalRequests.length === 0, `yerel olmayan istek yok (${externalRequests.slice(0, 3).join(" | ") || "—"})`);
ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
await fake.close();
await server2.close().catch(() => {});
await kapi.close();
await fake2.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
