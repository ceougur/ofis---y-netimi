// Senaryo 2.4.4 madde 18 (E7, müşteri isteği 2; karar kullanıcı 21.10.2026 (3)) — Fatura üst satırında "e-Fatura Portalı". EKRANDAN, gerçek tıklama:
//  1. Bağlantı kayıtlı değil: düğme Liste - Excel'in yanında, PASİF, nedeni görünür yazı (Entegratör Ayarları) ve aria-describedby ile bağlı.
//  2. Entegratör Ayarları EKRANDAN (insan hızında yazım + Tab) kaydedilir → arkadaki listedeki düğme yeniden açılmadan ETKİN olur.
//  3. Tıkla → window.open("", "hof-edm-portal", "popup=yes,left=0,top=0,width=<screen.availWidth>,height=<screen.availHeight>"); açılan pencere
//     TEST portalına (https://test.edmbilisim.com.tr/EFaturaUI21ea/) gider; opener bağı kesik (window.opener === null); isteğe Referer gitmez;
//     canlı portala istek yok. EDM'ye gerçek istek GİTMEZ: portal adresleri sahte sayfayla karşılanır (context.route), dış ağ kapalı.
//  4. İkinci tıklama ilk portal penceresini yeniden yüklemez; COOP same-origin yüzünden yeni portal penceresi açar (BİLİNEN SINIR).
//  5. Çalışma Ortamı Canlı → düğme CANLI portalı açar (https://portal4.edmbilisim.com.tr/EFaturaUI/).
//  6. Açılır pencere engellenince: "e-Fatura Portalı Açılamadı" penceresi + ortamın adresine bağlantı (yeni sekme, noopener noreferrer).
//  7. Yetki: Fatura Kesme ve İptal yetkili avukat → etkin; yalnız Faturaları Görme yetkili personel → pasif + "Fatura Kesme ve İptal yetkisi" nedeni.
//  8. Yazım düzeni (düğme adı ve pencere başlığı titleCase'ten geçer); sayfa ve meta'da parola/kullanıcı adı yok.
// Kırmızı kanıt: DEPO=<eski kopya> ile aynı senaryo eski kodda koşulur (ürün DEPO'dan yüklenir).
// Çalıştırma: npm run test:senaryo-portal-244 (ekran görüntüleri test/e2e/artifacts/senaryo-portal-244/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { titleCase } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "text-case.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(HERE, "..", "helpers.mjs")).href);
const { OUR_VKN, startMockEdm } = await import(pathToFileURL(path.join(HERE, "..", "einvoice-mock.mjs")).href);

const OUT = path.join(HERE, "artifacts", "senaryo-portal-244");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Portal-244-Admin!";
const STAFF_PASS = "Portal-244-Kisi!";
const EDM_USER = "edmportalkullanici";
const EDM_PASSWORD = "Gizli-Portal-Parola-9";
const TEST_PORTAL = "https://test.edmbilisim.com.tr/EFaturaUI21ea/";
const LIVE_PORTAL = "https://portal4.edmbilisim.com.tr/EFaturaUI/";
const edm = await startMockEdm();
const root = mkdtempSync(path.join(tmpdir(), "destekofis-portal-244-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, edocEnabled: true, edocLive: true, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f62" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const stored = () => JSON.parse(app.store.setting("invoice.settings", "{}") || "{}");
const MODAL = ".hof-modal-backdrop.is-visible";
const INV = `${MODAL} .hof-invoices-modal`;
const BTN = `${INV} .hof-plan-actions [data-act="portal"]`;
const CARD = `${MODAL} [data-integ-root]`;
let shotNo = 0;
const shot = async (target, name) => {
  shotNo += 1;
  await target.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) }).catch(() => null);
};
const step = async (title, target, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    if (target) await shot(target, "hata");
  }
};

// Dış ağ: yalnız yerel program; EDM portalları sahte sayfayla karşılanır, geri kalan dış istekler kesilir ve kaydedilir.
const portalHits = [];
const blockedHits = [];
async function newContext() {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR" });
  await context.route(
    url => !/^http:\/\/127\.0\.0\.1:/.test(url.href) && !/^(about|data|blob):/.test(url.href),
    async route => {
      const url = route.request().url();
      if (url.startsWith(TEST_PORTAL) || url.startsWith(LIVE_PORTAL)) {
        portalHits.push({ url, referer: route.request().headers().referer || "" });
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Sahte EDM Portalı</title><p data-sahte-portal>sahte portal</p>" });
      }
      blockedHits.push(url);
      return route.abort();
    },
  );
  // window.open çağrılarını kaydet (program açılışta window.open'ı sarar; kayıt ondan önce kurulur ve gerçek açılışı sürdürür).
  await context.addInitScript(() => {
    window.__portalOpens = [];
    const native = window.open;
    window.open = function (...args) {
      window.__portalOpens.push(args.map(value => String(value)));
      return native.apply(window, args);
    };
  });
  return context;
}
const login = async (target, username = "admin", password = PASS) => {
  target.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await target.goto(`${BASE}/`);
  await target.fill("#hof-auth input[name=username]", username);
  await target.fill("#hof-auth input[name=password]", password);
  await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
  await target.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await target.waitForTimeout(600);
};
const openInvoices = async target => {
  await target.click('#hof-sidecard [data-action="invoices"]');
  await target.waitForSelector(`${INV} .hof-plan-actions`, { timeout: 20000 });
  await target.waitForTimeout(300);
};
const button = target =>
  target.$eval(BTN, node => {
    const why = node.getAttribute("aria-describedby") ? document.getElementById(node.getAttribute("aria-describedby")) : null;
    const prev = node.previousElementSibling;
    return { text: node.textContent.trim(), disabled: node.disabled, why: why ? why.textContent.trim() : "", whyVisible: Boolean(why && why.offsetParent !== null), afterExport: Boolean(prev && prev.classList.contains("hof-rep-export") && prev.querySelector('[data-out="xlsx"]')) };
  }).catch(() => null);

try {
  await api.login("admin", PASS);
  await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
  const context = await newContext();
  const page = await context.newPage();
  await login(page);

  await step("1 Bağlantı kayıtlı değil: düğme pasif, nedeni görünür", page, async () => {
    await openInvoices(page);
    const b = await button(page);
    ok(b, `“e-Fatura Portalı” düğmesi Fatura üst satırında (${JSON.stringify(b)})`);
    if (!b) return;
    ok(b.text === "e-Fatura Portalı" && titleCase(b.text) === b.text, `ad yazım düzeninde: “${b.text}”`);
    // UI11 (madde 8): "Liste - Excel" artık dışa aktarım grubunda tek ad "Excel" (PDF'in yanında); düğme o grubun hemen yanında.
    ok(b.afterExport, "dışa aktarım grubunun (PDF / Excel) hemen yanında");
    ok(b.disabled === true, "pasif");
    ok(b.whyVisible && /Entegratör Ayarları'nda web servis kullanıcı adını ve parolasını kaydedin/.test(b.why), `nedeni görünür yazı: “${b.why}”`);
    await shot(page, "pasif-ayar-yok");
  });

  await step("2 Entegratör Ayarları ekrandan kaydedilir → düğme yerinde etkinleşir", page, async () => {
    await page.click(`${INV} [data-act="integrator"]`);
    await page.waitForSelector(`${CARD} [data-integ-tab]`);
    await page.click(`${CARD} input[data-i="username"]`);
    await page.keyboard.type(EDM_USER, { delay: 30 });
    await page.keyboard.press("Tab");
    await page.keyboard.type(EDM_PASSWORD, { delay: 30 });
    await page.fill(`${CARD} input[data-i="baseUrl"]`, edm.url);
    await page.click(`${CARD} [data-integ-act="save"]`);
    await page.waitForFunction(selector => /Bağlantı denenmedi/.test(document.querySelector(selector)?.textContent || ""), `${CARD} [data-integ-status]`, { timeout: 10000 });
    ok(stored().integrator?.username === EDM_USER && Boolean(stored().integrator?.passwordSealed) && stored().integrator?.env === "test", `veri tabanında: kullanıcı ${stored().integrator?.username}, ortam ${stored().integrator?.env}, parola mühürlü`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const b = await button(page);
    ok(b && b.disabled === false && !b.why, `liste yeniden açılmadan etkin (${JSON.stringify(b)})`);
    const html = await page.content();
    ok(!html.includes(EDM_PASSWORD), "sayfada parola yok");
    const meta = await page.evaluate(() => fetch("/api/workspace/invoices/meta").then(r => r.text()));
    ok(!meta.includes(EDM_PASSWORD) && !meta.includes(EDM_USER), "Fatura meta'sında kullanıcı adı ve parola yok");
    await shot(page, "etkin-test");
  });

  let portal = null;
  await step("3 Tıkla → ekran boyunda ayrı pencere, TEST portalı, opener kesik, Referer yok", page, async () => {
    const screen = await page.evaluate(() => ({ w: window.screen.availWidth, h: window.screen.availHeight }));
    const [popup] = await Promise.all([context.waitForEvent("page", { timeout: 10000 }), page.click(BTN)]);
    portal = popup;
    await popup.waitForURL(url => url.href.startsWith("https://"), { timeout: 10000 });
    await popup.waitForSelector("[data-sahte-portal]", { timeout: 10000 });
    ok(popup.url() === TEST_PORTAL, `açılan adres test portalı: ${popup.url()}`);
    const opens = await page.evaluate(() => window.__portalOpens);
    const last = opens[opens.length - 1] || [];
    ok(opens.length === 1, `tek window.open çağrısı (${opens.length})`);
    ok(last[1] === "hof-edm-portal", `pencere adı: ${last[1]}`);
    ok(last[2] === `popup=yes,left=0,top=0,width=${screen.w},height=${screen.h}`, `pencere özellikleri ekran boyunda: “${last[2]}” (ekran ${screen.w}×${screen.h})`);
    ok((await popup.evaluate(() => window.opener)) === null, "portal penceresinde window.opener === null");
    const hit = portalHits.find(item => item.url === TEST_PORTAL);
    ok(hit && !hit.referer, `portala Referer gitmedi (“${hit?.referer || ""}”)`);
    ok(!portalHits.some(item => item.url.startsWith(LIVE_PORTAL)), "canlı portala istek yok");
    await shot(popup, "test-portali");
  });

  await step("4 İkinci tıklama: program COOP same-origin ile sunulur, tarayıcı açık portal penceresini bulamaz → yeni portal penceresi (BİLİNEN SINIR)", page, async () => {
    const [again] = await Promise.all([context.waitForEvent("page", { timeout: 10000 }), page.click(BTN)]);
    await again.waitForSelector("[data-sahte-portal]", { timeout: 10000 });
    ok(again.url() === TEST_PORTAL && (await again.evaluate(() => window.opener)) === null, `ikinci pencere de test portalı, opener kesik: ${again.url()}`);
    ok(!portal.isClosed() && portal.url() === TEST_PORTAL, "ilk portal penceresi yerinde (yeniden yüklenmedi, kapanmadı)");
    await again.close();
    await portal.close();
  });

  await step("5 Çalışma Ortamı Canlı → CANLI portal", page, async () => {
    await must("canlı ortam", api.put("/api/workspace/invoices/settings", { integrator: { env: "live", baseUrl: edm.url, username: "canlikullanici", password: EDM_PASSWORD } }));
    ok(stored().integrator.env === "live", "veri tabanında ortam canlı");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await openInvoices(page);
    const [popup] = await Promise.all([context.waitForEvent("page", { timeout: 10000 }), page.click(BTN)]);
    await popup.waitForSelector("[data-sahte-portal]", { timeout: 10000 });
    ok(popup.url() === LIVE_PORTAL, `açılan adres canlı portal: ${popup.url()}`);
    ok((await popup.evaluate(() => window.opener)) === null, "opener kesik");
    await shot(popup, "canli-portal");
    await popup.close();
  });

  await step("6 Açılır pencere engellenince ileti + bağlantı", page, async () => {
    await page.evaluate(() => {
      window.open = () => null;
    });
    await page.click(BTN);
    await page.waitForSelector(`${MODAL} [data-portal-link]`, { timeout: 5000 });
    const info = await page.evaluate(() => {
      const link = document.querySelector(".hof-modal-backdrop.is-visible [data-portal-link]");
      const dialog = link.closest(".hof-modal");
      return { title: dialog.querySelector(".hof-modal-title").textContent.trim(), href: link.getAttribute("href"), target: link.getAttribute("target"), rel: link.getAttribute("rel"), text: link.textContent.trim(), body: dialog.textContent };
    });
    ok(info.title === "e-Fatura Portalı Açılamadı" && titleCase(info.title) === info.title, `pencere başlığı: “${info.title}”`);
    ok(/açılır pencereyi engelledi/.test(info.body), "neden yazılı");
    ok(info.href === LIVE_PORTAL && info.target === "_blank" && /noopener/.test(info.rel) && /noreferrer/.test(info.rel), `bağlantı ortamın adresi, yeni sekme: ${JSON.stringify(info)}`);
    await shot(page, "engellendi");
    const [tab] = await Promise.all([context.waitForEvent("page", { timeout: 10000 }), page.click(`${MODAL} [data-portal-link]`)]);
    await tab.waitForSelector("[data-sahte-portal]", { timeout: 10000 });
    ok(tab.url() === LIVE_PORTAL, `bağlantı portalı açtı: ${tab.url()}`);
    await page.waitForTimeout(300);
    ok(!(await page.$(`${MODAL} [data-portal-link]`)), "bağlantıya basınca pencere kapandı");
    await tab.close();
  });
  await context.close();

  await step("7 Yetki: avukat etkin; yalnız Faturaları Görme yetkili personel pasif + neden", null, async () => {
    await must("avukat", api.post("/api/admin/users", { username: "portal-avukat", name: "Portal Avukat", role: "avukat", password: STAFF_PASS, mustChangePassword: false }));
    const viewer = await must("personel", api.post("/api/admin/users", { username: "portal-goren", name: "Portal Gören", role: "personel", password: STAFF_PASS, mustChangePassword: false }));
    const viewerId = viewer?.user?.id || viewer?.id || ((await must("kullanıcılar", api.get("/api/admin/users"))).users || []).find(user => user.username === "portal-goren")?.id;
    await must("yalnız görme yetkisi", api.patch(`/api/admin/users/${viewerId}`, { grants: { add: ["invoices.view"], remove: [] } }));
    for (const [username, enabled] of [["portal-avukat", true], ["portal-goren", false]]) {
      const ctx = await newContext();
      const target = await ctx.newPage();
      await login(target, username, STAFF_PASS);
      await openInvoices(target);
      const b = await button(target);
      if (enabled) ok(b && b.disabled === false, `${username}: etkin (${JSON.stringify(b)})`);
      else ok(b && b.disabled === true && b.whyVisible && /Fatura Kesme ve İptal yetkisi ister/.test(b.why), `${username}: pasif, neden “${b?.why}”`);
      if (!enabled) {
        await target.click(BTN, { force: true, timeout: 2000 }).catch(() => null);
        await target.waitForTimeout(500);
        const opens = await target.evaluate(() => window.__portalOpens.length);
        ok(opens === 0 && ctx.pages().length === 1, `pasif düğme pencere açmaz (window.open ${opens})`);
        const meta = await target.evaluate(() => fetch("/api/workspace/invoices/meta").then(r => r.text()));
        ok(!meta.includes("EFaturaUI"), "yetkisize portal adresi gitmez");
        await shot(target, "yetkisiz");
      }
      await ctx.close();
    }
  });

  ok(blockedHits.filter(url => !/fonts\.(googleapis|gstatic)\.com/.test(url)).length === 0, `beklenmeyen dış istek yok (${blockedHits.join(", ") || "—"})`);
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ senaryo durdu: ${error.stack || error.message}`);
} finally {
  await browser.close().catch(() => null);
  await app.close?.().catch(() => null);
  await edm.close().catch(() => null);
  fs.rmSync(root, { recursive: true, force: true });
  console.log(`\n${failed ? "✗" : "✓"} senaryo-portal-244: ${passed} geçti, ${failed} kaldı · depo ${ROOT} · ekran görüntüleri ${OUT}`);
  process.exit(failed ? 1 : 0);
}
