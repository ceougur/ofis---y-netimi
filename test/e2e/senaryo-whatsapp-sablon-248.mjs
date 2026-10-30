// 2.4.8 W5 + W6 EKRANDAN — Yönetim → WhatsApp: Bilgilendirme Şablonları kartı (Şablonları Denetle ve Oluştur; Elle Bağla'dan sonra kendiliğinden) ve
// Aydınlatma Metni Hazırla (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §5, §6 W5, W6). Meta yerine YEREL sahte Graph sunucusu (test/whatsapp-sahte-graph.mjs;
// ders 30); sunucu saati sahte (ders 13). Gerçek tıklama + insan hızında yazım + Tab + Enter (ders 12); "veri bozulmaz" iddiası sahte Meta'nın kaydından
// ve veri tabanından okunur. Pencere seçicisi en üstteki pencere (ders 39). Beklenen metinler PLANDAN (programın sabitinden değil; ders 5).
//   B0 bağlantı yokken kart: düğme pasif, nedeni görünür yazı.
//   B1 bağlantı (App ID'siz) → Şablonları Denetle ve Oluştur: Ödeme Hatırlatma açılır (Onay Bekliyor), Ekstre açılmaz — neden Uygulama Kimliği.
//   B2 Bilgileri Değiştir: App ID Tab ile → Kaydet ve Sına → Ekstre kendiliğinden açılır (örnek PDF yüklendi, KVKK alt satırı, UTILITY).
//   B3 Meta Ekstre'yi Pazarlama'ya aldı, Hatırlatma onaylandı → klavyeyle Denetle: Hatırlatma "Onaylandı / Evet"; Ekstre "Hayır" + açık uyarı.
//   B4 yetkisiz (Personel): şablon ve aydınlatma metni API'si 403.
//   B5 Aydınlatma Metni Hazırla (klavyeyle açılır): firma bilgileri metinde, eksik e-posta adıyla söylenir; Kopyala → panodaki metin = API metni;
//      Aydınlatma Metni - PDF → %PDF, dosya adı firma adıyla, istek şirket parametreli; Esc ile kapanır (soru yok).
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-whatsapp-sablon-248).
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";
import { startFakeGraph } from "../whatsapp-sahte-graph.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-whatsapp-sablon-248-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-whatsapp-sablon-248");
mkdirSync(shots, { recursive: true });
const TOKEN = "SAHTE-W5-ekran_Belirteci.248-AsDfGh9876543210";
const PNID = "106540352242922";
const WABA = "102290129340398";
const APP = "1505264761663625";
const STAFF = { username: "wa5-personel", password: "Personel-Wa5-2026!" };
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
// PLANDAN (§1, §6 W5)
const KVKK_FOOTER = "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.";
const EKSTRE_BODY = "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Güncel bakiye: {{4}}.";

const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP, verifiedName: "Deneme Ticaret Ltd" });
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, whatsappGraphUrl: fake.url, now: "2026-11-03T09:00:00+03:00" });
const adminApi = createClient(server.base);
await adminApi.login("admin", ADMIN_PASSWORD);
const staffCreated = await adminApi.post("/api/admin/users", { ...STAFF, name: "WhatsApp Personel", role: "personel", mustChangePassword: false });
if (staffCreated.status !== 200) throw new Error(`personel açılamadı: ${JSON.stringify(staffCreated.data)}`);

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
const shot = name => page?.screenshot({ path: path.join(shots, `wa5-248-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 2).trim()}`);
  }
};
const typeSlow = async value => {
  for (const ch of value) await page.keyboard.type(ch, { delay: 35 });
};
const text = async selector => ((await page.textContent(selector)) || "").trim();
const cell = (name, key) => text(`[data-wa-tpl="${name}"] [data-wa-tpl-${key}]`);
const waitCell = async (name, key, expected) => {
  await page.waitForFunction(([n, k, e]) => document.querySelector(`[data-wa-tpl="${n}"] [data-wa-tpl-${k}]`)?.textContent.trim() === e, [name, key, expected], { timeout: 15000 });
  return cell(name, key);
};
const topModal = async () => {
  await page.waitForSelector(`${TOP} .hof-modal-title, ${TOP} form`, { state: "visible" });
  return TOP;
};
const templatePosts = () => fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/message_templates"));
const noToken = async label => {
  const html = await page.content();
  ok(!html.includes(TOKEN) && !html.includes(TOKEN.slice(-12)), `${label}: sayfada belirteç yok`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: server.base });
page = await context.newPage();
page.on("pageerror", error => pageErrors.push(error.message));
page.on("response", async response => {
  if (!response.url().includes("/api/") || response.url().endsWith(".pdf")) return;
  try {
    apiBodies.push(await response.text());
  } catch {
    // gövdesiz yanıt
  }
});
page.setDefaultTimeout(15000);

await step("B0 bağlantı yokken: şablon kartı görünür, düğme pasif ve nedeni yazılı", async () => {
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.goto(`${server.base}/admin.html#whatsapp`);
  await page.waitForSelector('[data-wa-tpl="destekofis_ekstre"]');
  ok((await text("#adm-wa-templates h2")) === "Bilgilendirme Şablonları", "kart başlığı");
  ok(await page.isDisabled('[data-wa-tpl-action-button="ensure"]'), "Şablonları Denetle ve Oluştur pasif");
  ok(/Önce yukarıdaki Elle Bağla/.test(await text("[data-wa-tpl-why]")), `neden: ${await text("[data-wa-tpl-why]")}`);
  ok((await cell("destekofis_odeme_hatirlatma", "status")) === "Denetlenmedi", "durum Denetlenmedi");
  ok(fake.requests.length === 0, "Meta'ya istek yok");
  await shot("01-bagli-degil");
});

await step("B1 App ID'siz bağlantı → Denetle: Ödeme Hatırlatma açılır, Ekstre için Uygulama Kimliği istenir", async () => {
  const put = await adminApi.put("/api/workspace/whatsapp/connection", { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
  ok(put.status === 200, `bağlantı kaydedildi (${put.status})`);
  await page.reload();
  await page.waitForSelector('[data-wa-tpl-action-button="ensure"]:not([disabled])');
  await page.click('[data-wa-tpl-action-button="ensure"]');
  ok((await waitCell("destekofis_odeme_hatirlatma", "status", "Onay Bekliyor")) === "Onay Bekliyor", "Ödeme Hatırlatma: Onay Bekliyor");
  ok((await cell("destekofis_ekstre", "status")) === "Henüz Açılmadı", "Ekstre: Henüz Açılmadı");
  ok(/Uygulama Kimliği \(App ID\)/.test(await text('[data-wa-tpl-action="destekofis_ekstre"]')), "Ekstre için App ID nedeni görünür");
  const posts = templatePosts();
  ok(posts.length === 1 && posts[0].body.name === "destekofis_odeme_hatirlatma" && posts[0].body.category === "UTILITY", "Meta'ya yalnız Ödeme Hatırlatma, UTILITY");
  await shot("02-hatirlatma-acildi");
});

await step("B2 Bilgileri Değiştir: App ID Tab ile → Kaydet ve Sına → Ekstre kendiliğinden açılır (örnek PDF, KVKK alt satırı)", async () => {
  fake.requests.length = 0;
  await page.click('[data-wa-action="connect"]');
  const modal = await topModal();
  await page.click(`${modal} [name="wabaId"]`);
  await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.activeElement?.getAttribute("name") === "appId"), "Tab: WABA ID → App ID");
  await typeSlow(APP);
  await page.keyboard.press("Tab");
  await page.click(`${modal} button[type="submit"]`);
  await page.waitForFunction(() => document.querySelector("[data-wa-state]")?.textContent.trim() === "Bağlı");
  ok((await waitCell("destekofis_ekstre", "status", "Onay Bekliyor")) === "Onay Bekliyor", "Ekstre: Onay Bekliyor (kendiliğinden açıldı)");
  const upload = fake.requests.find(item => item.method === "POST" && item.path.startsWith("/upload:"));
  ok(upload && upload.bytes.subarray(0, 5).toString("latin1") === "%PDF-", "örnek PDF Meta'ya yüklendi");
  const post = templatePosts().find(item => item.body.name === "destekofis_ekstre");
  const parts = Object.fromEntries((post?.body.components || []).map(item => [String(item.type).toUpperCase(), item]));
  ok(post?.body.category === "UTILITY" && post?.body.language === "tr", "Ekstre UTILITY, tr");
  ok(parts.HEADER?.format === "DOCUMENT" && fake.state.handles.has(parts.HEADER?.example?.header_handle?.[0]), "BELGE başlığı + yükleme tanıtıcısı");
  ok(parts.BODY?.text === EKSTRE_BODY, "gövde plandaki metin");
  ok(parts.FOOTER?.text === KVKK_FOOTER, "KVKK alt satırı");
  ok(templatePosts().length === 1, "Ödeme Hatırlatma yeniden açılmadı");
  const row = JSON.parse(server.app.store.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'").value);
  ok(row.appId === APP, "veri tabanında App ID yazılan");
  await noToken("kendiliğinden açmadan sonra");
  await shot("03-ekstre-acildi");
});

await step("B3 Meta Ekstre'yi Pazarlama'ya aldı, Hatırlatma onaylandı → klavyeyle Denetle: açık uyarı, Ekstre gönderime hazır değil", async () => {
  const set = (name, patch) => Object.assign(fake.state.templates.find(item => item.name === name && item.language === "tr"), patch);
  set("destekofis_ekstre", { status: "APPROVED", category: "MARKETING" });
  set("destekofis_odeme_hatirlatma", { status: "APPROVED", category: "UTILITY", quality_score: { score: "GREEN", date: 1 } });
  fake.requests.length = 0;
  await page.focus('[data-wa-tpl-action-button="ensure"]');
  await page.keyboard.press("Enter");
  ok((await waitCell("destekofis_ekstre", "category", "Pazarlama (Marketing)")) === "Pazarlama (Marketing)", "Ekstre kategorisi Pazarlama");
  ok((await cell("destekofis_ekstre", "usable")) === "Hayır", "Ekstre gönderime hazır: Hayır");
  ok((await cell("destekofis_odeme_hatirlatma", "status")) === "Onaylandı" && (await cell("destekofis_odeme_hatirlatma", "usable")) === "Evet", "Hatırlatma Onaylandı / Evet");
  const warning = await text('[data-wa-tpl-notes="destekofis_ekstre"]');
  ok(/Pazarlama/.test(warning) && /gönderim YAPMAZ/.test(warning) && /yeniden inceleme/.test(warning), `uyarı görünür: ${warning.slice(0, 80)}`);
  ok(await page.isVisible('[data-wa-tpl-notes="destekofis_ekstre"] [data-wa-tpl-warning]'), "uyarı ekranda görünür");
  ok(templatePosts().length === 0, "yeniden şablon açılmadı");
  await shot("04-pazarlama-uyarisi");
});

await step("B4 yetkisiz (Personel): şablon API'si 403", async () => {
  const staff = createClient(server.base);
  await staff.login(STAFF.username, STAFF.password);
  ok((await staff.get("/api/workspace/whatsapp/templates")).status === 403, "GET 403");
  ok((await staff.post("/api/workspace/whatsapp/templates/ensure", {})).status === 403, "POST 403");
  ok((await staff.get("/api/workspace/whatsapp/aydinlatma-metni")).status === 403, "aydınlatma metni 403");
  ok((await staff.get("/api/workspace/whatsapp/aydinlatma-metni.pdf")).status === 403, "aydınlatma PDF 403");
});

await step("B5 Aydınlatma Metni Hazırla: firma bilgileri, eksik e-posta, Kopyala = API metni, PDF, Esc", async () => {
  const seller = { name: "Mavi Muhasebe Ltd. Şti.", taxNo: "4840847211", taxOffice: "Kadıköy", address: "Caferağa Mah. Moda Cad. No: 12", district: "Kadıköy", city: "İstanbul", phone: "0216 555 01 02" };
  ok((await adminApi.put("/api/workspace/invoices/settings", { seller })).status === 200, "firma bilgisi kaydedildi (e-posta yok)");
  ok((await text("#adm-wa-notice h2")) === "KVKK Aydınlatma Metni", "kart başlığı");
  await page.focus("[data-wa-notice-open]");
  await page.keyboard.press("Enter");
  const modal = await topModal();
  ok((await text(`${modal} .hof-modal-title`)) === "Aydınlatma Metni", "pencere başlığı Aydınlatma Metni");
  const shown = await text(`${modal} [data-wa-notice-text]`);
  ok(shown.includes(seller.name) && shown.includes(seller.taxNo) && shown.includes(seller.address), "metinde unvan, VKN, adres");
  ok(/Meta Platforms/.test(shown) && /9\. maddesinde/.test(shown) && /veri işleyen/.test(shown), "metinde Meta, md. 9, veri işleyen");
  ok(/\[Firma e-posta adresi\]/.test(shown), "eksik e-posta yer tutucusu");
  ok(/Eksik firma bilgisi: E-posta/.test(await text(`${modal} [data-wa-notice-missing]`)), "eksik bilgi adıyla söylendi");
  await shot("05-aydinlatma");
  const api = (await adminApi.get("/api/workspace/whatsapp/aydinlatma-metni")).data.data;
  await page.click(`${modal} [data-wa-notice="copy"]`);
  await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast, [role=status]")].some(node => /panoya kopyalandı/.test(node.textContent)));
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  ok(copied === api.text, `panodaki metin API metniyle aynı (${copied.length} karakter)`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click(`${modal} [data-wa-notice="pdf"]`)]);
  const file = path.join(root, "aydinlatma.pdf");
  await download.saveAs(file);
  ok(readFileSync(file).subarray(0, 5).toString("latin1") === "%PDF-", "inen dosya PDF");
  // Dosya adı yanıt başlığından okunur: bu Chromium (Playwright) Türkçe karakterli filename* adında suggestedFilename olarak "download" verir
  // (ASCII adlarda doğru; programın ortak contentDisposition'ı — 2.4.8 g6 gözlemi, scratchpad g6-248 cd.mjs).
  const disposition = await page.evaluate(async url => (await fetch(url)).headers.get("content-disposition"), download.url());
  ok(/KVKK Aydınlatma Metni \(WhatsApp\) Mavi Muhasebe Ltd\. Şti\.\.pdf/.test(decodeURIComponent(disposition || "")), `dosya adı (başlık): ${decodeURIComponent(disposition || "")}`);
  ok(/[?&]hofCompany=/.test(download.url()), `PDF isteği şirket parametreli: ${download.url().replace(server.base, "")}`);
  ok((await text(`${modal} [data-wa-notice="pdf"]`)) === "Aydınlatma Metni - PDF", "düğme adı Aydınlatma Metni - PDF");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"));
  ok((await page.locator(MODAL).count()) === 0, "Esc ile kapandı, soru sorulmadı");
});

ok(!apiBodies.some(body => body.includes(TOKEN) || body.includes(TOKEN.slice(-12))), `API yanıtlarında belirteç yok (${apiBodies.length} yanıt)`);
ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
await fake.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
