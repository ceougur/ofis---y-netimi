// Entegratör Ayarları kartı EKRANDAN (kullanıcı taslağı + onaylanan 4 düzeltme, 16.10.2026; docs/2.4.0-IS-LISTESI.md İz 2). Sahte EDM
// (test/einvoice-mock.mjs) — gerçek EDM'ye ve canlı adrese hiçbir istek gitmez.
//   1 Fatura → "Entegratör Ayarları" düğmesi → "e-Dönüşüm ve Entegrasyon Ayarları"; üç sekme; Canlı Ortam pasif + nedeni yazılı; Durum "Bağlantı Yok".
//   2 Kullanıcı adı ve parola insan hızında + Tab ile; Göster yalnız yazılan parolayı gösterir; Kaydet → Durum "Bağlantı denenmedi"; parola veri
//     tabanında açık metin değil.
//   3 Bağlantıyı Test Et → Durum "Bağlantı kuruldu"; Etiketleri Getir → GB ve PK listeleri; seçilip kaydedilir (veri tabanından okunur).
//   4 Sekme değişince yazılanlar kaybolmaz; Firma sekmesinde firma özeti (tek kaynak) ve "Fatura Ayarları'nda Düzenle"; Otomatik Seriler kaydedilir.
//   5 Fatura Ayarları'nda e-Belge alanları yok, karta yönlendiren düğme var. Avukat (fatura keser, Fatura Ayarları yetkisi yok): düğme yok.
//   7 Görünüm sekmesi (16.10.2026 İz 6): dört seçenek açık; Önizle → şablon TARAYICININ XSLT 1.0 işlemcisiyle (libxslt) çizilir, örnek belgenin
//     sayıları ve logo görünür; Banka Hesaplarını Göster kapatılıp kaydedilir (veri tabanından okunur), önizlemede IBAN yok.
//   8 Gönderilen faturada "Resmî Görüntü" (sahte EDM PDF'i); gönderilmemişte yok.
//   6 Yönetim → Sistem → Ağ Bağlantısı (vekil sunucu, 16.10.2026): Otomatik seçili; Elle Yazılan Adres insan hızında + Tab; Kaydet → dosyada,
//     parola ekrana dönmez; Bağlantıyı Dene → istek sahte vekile gider (CONNECT), ret iletisi Türkçe; Entegratör kartında yol satırı.
// Çıkış: "N geçti, M kaldı". Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { BUYER_VKN, MULTI_VKN, OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const PASS = "Personel-2026!";
const LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const root = mkdtempSync(path.join(tmpdir(), "senaryo-entegrator-240-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const edm = await startMockEdm();
// Sahte vekil sunucu (bölüm 6): CONNECT isteklerini kaydeder ve reddeder (403) — dışarıya hiçbir istek çıkmaz.
const proxyLog = [];
const fakeProxy = http.createServer((req, res) => res.writeHead(403).end());
fakeProxy.on("connect", (req, socket) => {
  proxyLog.push(req.url);
  socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
});
await new Promise(resolve => fakeProxy.listen(0, "127.0.0.1", resolve));
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "" };
const networkFile = path.join(root, "ag-ayari.json");
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", edocEnabled: true, env: { ...NO_ENV_PROXY, HUKUK_NETWORK_FILE: networkFile }, networkTestUrl: "https://guncelleme.test/" });
const admin = await server.login();
const BASE = server.base;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("avukat", admin.post("/api/admin/users", { username: "avukat", name: "Avukat", role: "avukat", password: PASS, mustChangePassword: false }));
await must("firma", admin.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" } }));
const stored = () => JSON.parse(server.app.store.setting("invoice.settings", "{}"));

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const browser = await chromium.launch();
const errors = [];
const modal = ".hof-modal-backdrop.is-visible";
const card = `${modal} [data-integ-root]`;
async function login(username, password) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(`${username}: ${error.message}`));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
  return page;
}
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const status = page => textOf(page, `${card} [data-integ-status]`);
const openInvoices = async page => {
  await page.evaluate(() => window.HOF.invoices.open());
  await page.waitForSelector(`${modal} .hof-invoices-modal`, { timeout: 15000 });
  await page.waitForTimeout(400);
};

try {
  const page = await login("admin", ADMIN_PASSWORD);
  console.log("■ 1 Düğme, kart, sekmeler, canlı ortam kilidi");
  await openInvoices(page);
  ok(await page.$(`${modal} [data-act="integrator"]`), "Fatura sayfasında “Entegratör Ayarları” düğmesi");
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.waitForSelector(`${card} [data-integ-tab]`);
  const title = await textOf(page, `${modal}:last-of-type .hof-modal-title`);
  ok(title === "e-Dönüşüm ve Entegrasyon Ayarları", `başlık: “${title}”`);
  const tabs = await page.$$eval(`${card} [data-integ-tab]`, nodes => nodes.map(node => node.textContent.trim()));
  ok(tabs.join(" | ") === "Entegrasyon Bilgileri | Firma / Etiket Tanımları | Otomatik Seriler | Görünüm | Ek Seçenekler", `sekmeler: ${tabs.join(" | ")}`);
  const live = await page.$eval(`${card} input[data-i="env"][value="live"]`, input => ({ disabled: input.disabled, checked: input.checked }));
  const test = await page.$eval(`${card} input[data-i="env"][value="test"]`, input => input.checked);
  ok(live.disabled && !live.checked && test, "Canlı Ortam pasif, Test Ortamı seçili");
  ok(/Canlı ortam, test ortamındaki kabulden sonra açılır/.test(await textOf(page, `${card} [data-integ-live-note]`)), "pasif seçeneğin nedeni yazılı");
  ok(/Bağlantı Yok/.test(await status(page)), `Durum: “${await status(page)}”`);
  const labels = await page.$$eval(`${card} .hof-field > span:first-child`, nodes => nodes.map(node => node.textContent.trim()));
  ok(labels.includes("Gönderici Birim (GB)") && labels.includes("Posta Kutusu (PK)"), `GB ve PK doğru adlarla: ${labels.filter(label => /\((GB|PK)\)/.test(label)).join(", ")}`);
  const autoSend = await page.$eval(`${card} input[data-i="autoSend"]`, input => input.checked);
  ok(!autoSend, "otomatik gönderim varsayılan kapalı");
  await shot(page, "entegrator-1-acilis");

  console.log("\n■ 2 Kullanıcı adı / parola insan hızında, Göster, Kaydet");
  await page.click(`${card} input[data-i="username"]`);
  await page.keyboard.type("edmkullanici", { delay: 35 });
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.dataset?.i || "");
  ok(focused === "password", `Tab parolaya geçer (odak: ${focused})`);
  await page.keyboard.type("Gizli-Parola-1", { delay: 35 });
  await page.click(`${card} [data-integ-eye]`);
  const shown = await page.$eval(`${card} input[data-i="password"]`, input => ({ type: input.type, value: input.value }));
  ok(shown.type === "text" && shown.value === "Gizli-Parola-1", "Göster: yazılan parola görünür");
  await page.click(`${card} [data-integ-eye]`);
  await page.fill(`${card} input[data-i="baseUrl"]`, edm.url);
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(selector => /Bağlantı denenmedi/.test(document.querySelector(selector)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 10000 });
  ok(true, `kaydedildi; Durum: “${await status(page)}”`);
  const raw = server.app.store.setting("invoice.settings", "");
  ok(!raw.includes("Gizli-Parola-1") && stored().integrator.username === "edmkullanici", "parola veri tabanında açık metin değil; kullanıcı adı kayıtlı");
  const placeholder = await page.$eval(`${card} input[data-i="password"]`, input => ({ value: input.value, placeholder: input.placeholder }));
  ok(placeholder.value === "" && placeholder.placeholder === "Kayıtlı", "kayıttan sonra parola alanı boş, “Kayıtlı” yazıyor");

  console.log("\n■ 3 Bağlantıyı Test Et, Etiketleri Getir, GB/PK seç ve kaydet");
  await page.click(`${card} [data-integ-act="test"]`);
  await page.waitForFunction(selector => /Bağlantı kuruldu/.test(document.querySelector(selector)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 15000 });
  ok(true, `Durum: “${await status(page)}”`);
  await page.click(`${card} [data-integ-act="aliases"]`);
  await page.waitForFunction(selector => [...(document.querySelector(selector)?.options || [])].some(option => option.value.includes("defaultgb")), `${card} select[data-i="senderAlias"]`, { timeout: 15000 });
  await page.selectOption(`${card} select[data-i="senderAlias"]`, "urn:mail:defaultgb@deneme.com.tr");
  await page.selectOption(`${card} select[data-i="mailboxAlias"]`, "urn:mail:defaultpk@deneme.com.tr");
  await shot(page, "entegrator-2-etiketler");
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForTimeout(800);
  const afterAliases = stored().integrator;
  ok(afterAliases.senderAlias === "urn:mail:defaultgb@deneme.com.tr" && afterAliases.mailboxAlias === "urn:mail:defaultpk@deneme.com.tr", `veri tabanında GB ${afterAliases.senderAlias} · PK ${afterAliases.mailboxAlias}`);
  ok(afterAliases.lastTest?.ok === true, "tercih kaydı bağlantı durumunu silmedi");

  console.log("\n■ 4 Sekmeler: yazılanlar kaybolmaz; firma özeti; seriler");
  await page.click(`${card} input[data-i="autoCheckUser"]`);
  await page.click(`${card} [data-integ-tab="firm"]`);
  await page.waitForSelector(`${card} [data-integ-firm]`);
  const firm = await textOf(page, `${card} [data-integ-firm]`);
  ok(firm.includes(OUR_VKN) && firm.includes("Deneme Ofis Ltd."), `firma özeti Fatura Ayarları'ndan: ${firm.slice(0, 80)}`);
  ok(await page.$(`${card} [data-integ-act="firm"]`), "“Fatura Ayarları'nda Düzenle” düğmesi");
  await page.check(`${card} input[data-i="efatura"]`);
  await page.click(`${card} [data-integ-tab="series"]`);
  await page.fill(`${card} input[data-i-series="efatura"]`, "efx");
  await page.click(`${card} [data-integ-tab="connection"]`);
  ok(await page.$eval(`${card} input[data-i="autoCheckUser"]`, input => input.checked), "sekme dönüşünde işaretlenen kutu korunur");
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForTimeout(800);
  const all = stored();
  ok(all.integrator.autoCheckUser === true && all.efatura === true && all.series?.efatura === "EFX", `kaydedildi: kendiliğinden sorgu ${all.integrator.autoCheckUser}, e-Fatura ${all.efatura}, seri ${all.series?.efatura}`);
  await page.click(`${card} [data-integ-tab="series"]`);
  await shot(page, "entegrator-3-seriler");

  console.log("\n■ 4b Cari formu: VKN yazılıp alandan çıkınca mükellefiyet kendiliğinden sorgulanır; iki posta kutusu varsa kullanıcı seçer");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.HOF.accounts.newFor({}));
  const formOpen = await page.waitForSelector(`${modal} input[name="taxNo"]`, { timeout: 8000 }).then(() => true).catch(() => false);
  if (ok(formOpen, "Yeni Cari formu açıldı")) {
    await page.fill(`${modal} input[name="name"]`, "Çoklu A.Ş.");
    await page.click(`${modal} input[name="taxNo"]`);
    await page.keyboard.type(MULTI_VKN, { delay: 30 });
    await page.keyboard.press("Tab");
    await page.waitForSelector(`${modal}:last-of-type select[name="alias"]`, { timeout: 10000 });
    const options = await page.$$eval(`${modal}:last-of-type select[name="alias"] option`, nodes => nodes.map(node => node.value));
    const preselected = await page.$eval(`${modal}:last-of-type select[name="alias"]`, node => node.value);
    ok(options.length === 2 && preselected === "urn:mail:defaultpk@coklu.com.tr", `iki PK seçenek, varsayılan defaultpk: ${options.join(", ")} (seçili ${preselected})`);
    await shot(page, "entegrator-4-pk-secimi");
    await page.selectOption(`${modal}:last-of-type select[name="alias"]`, "urn:mail:muhasebepk@coklu.com.tr");
    await page.click(`${modal}:last-of-type .hof-form button[type="submit"]`);
    await page.waitForFunction(() => document.querySelector('input[name="eAlias"]')?.value === "urn:mail:muhasebepk@coklu.com.tr", null, { timeout: 8000 });
    const eInvoice = await page.$eval('input[name="eInvoice"]', node => node.checked);
    ok(eInvoice, "seçilen PK forma yazıldı, e-Fatura mükellefi işaretli");
  }
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 5 Fatura Ayarları yönlendirmesi; ayar yetkisi olmayan kullanıcı");
  await openInvoices(page);
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.waitForSelector(`${card} [data-integ-tab]`);
  await page.click(`${card} [data-integ-tab="firm"]`);
  await page.click(`${card} [data-integ-act="firm"]`);
  await page.waitForSelector(`${modal} .hof-inv-settings`, { timeout: 10000 });
  const settingsText = await textOf(page, `${modal} .hof-invoices-modal`);
  ok(!(await page.$(`${modal} [data-s="integrator.username"]`)) && /Entegratör Ayarları penceresindedir/.test(settingsText), "Fatura Ayarları'nda e-Belge alanları yok, yönlendirme var");
  const staff = await login("avukat", PASS);
  await openInvoices(staff);
  ok(!(await staff.$(`${modal} [data-act="integrator"]`)) && Boolean(await staff.$(`${modal} [data-act="new"]`)), "avukatta (fatura keser, ayar yetkisi yok) “Entegratör Ayarları” düğmesi yok");

  console.log("\n■ 7 Görünüm sekmesi ve tarayıcı önizlemesi");
  await must("logo ve banka", admin.put("/api/workspace/invoices/settings", { seller: { logo: LOGO, banks: [{ name: "Örnek Bankası", iban: "TR330006100519786457841326" }] }, defaults: { footer: "Görünüm alt notu" } }));
  await openInvoices(page);
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.click(`${card} [data-integ-tab="view"]`);
  const viewChecks = await page.$$eval(`${card} [data-i^="view."]`, nodes => nodes.map(node => `${node.dataset.i}:${node.checked}`));
  ok(viewChecks.join(",") === "view.enabled:true,view.logo:true,view.banks:true,view.footer:true,view.stamp:true,view.stampEfatura:false", `Görünüm seçenekleri varsayılan (kaşe e-Arşivde açık, e-Faturada kapalı): ${viewChecks.join(", ")}`);
  await page.click(`${card} [data-integ-act="preview"]`);
  const frameHandle = await page.waitForSelector("iframe.hof-integ-preview", { timeout: 10000 });
  const frame = await frameHandle.contentFrame();
  await frame.waitForSelector("table.kalem", { timeout: 10000 });
  const previewText = (await frame.$eval("body", body => body.innerText)).replace(/\s+/g, " ");
  ok(["e-FATURA", "Örnek Müşteri A.Ş.", "Deneme Ofis Ltd.", "Ödenecek Tutar 1.475,00 TL", "Hesaplanan KDV (%20) 200,00 TL", "TR33 0006 1005", "Görünüm alt notu"].every(part => previewText.includes(part)), `tarayıcının XSLT işlemcisi şablonu çizdi: ${previewText.slice(0, 160)}…`);
  ok(Boolean(await frame.$('img[src^="data:image/jpeg"]')), "önizlemede logo var");
  // İz 9: karekod (GİB standardı, sağ üst) ve GİB logosu; ortada alt alta firma logosu → GİB logosu → başlık.
  const centre = await frame.$$eval("td.baslik img", nodes => nodes.map(node => node.getAttribute("alt")));
  ok(Boolean(await frame.$('.karekod img[alt="Karekod"][src^="data:image/svg+xml"]')) && centre.join(",") === ",GİB", `önizlemede karekod sağ üstte; ortada firma logosu ve GİB logosu alt alta (${centre.join(" | ")})`);
  ok((await frameHandle.getAttribute("sandbox")) === "", "önizleme betiksiz çerçevede (sandbox)");
  await page.waitForTimeout(400);
  const onTop = await page.evaluate(() => {
    const frameNode = document.querySelector("iframe.hof-integ-preview");
    const box = frameNode.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === frameNode;
  });
  ok(onTop, "önizleme penceresi Entegratör kartının üstünde (görünür, kartın arkasında kalmıyor)");
  await shot(page, "entegrator-7-gorunum-onizleme");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.click(`${card} [data-i="view.banks"]`);
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(() => document.querySelector(".hof-toast")?.textContent?.includes("kaydedildi"), null, { timeout: 8000 }).catch(() => null);
  ok(stored().eView?.banks === false && stored().eView?.logo === true, `Banka Hesaplarını Göster kapatılıp kaydedildi (veri tabanı: ${JSON.stringify(stored().eView)})`);
  await page.click(`${card} [data-integ-tab="view"]`);
  await page.click(`${card} [data-integ-act="preview"]`);
  const frame2 = await (await page.waitForSelector(".hof-modal-backdrop.is-visible:last-of-type iframe.hof-integ-preview")).contentFrame();
  await frame2.waitForSelector("table.kalem");
  ok(!(await frame2.$eval("body", body => body.innerText)).includes("TR33 0006"), "banka kapalıyken önizlemede IBAN yok");
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 8 Resmî Görüntü (gönderilen e-Belge)");
  const buyer = await must("alıcı", admin.post("/api/workspace/accounts", { name: "Resmî Görüntü Alıcı A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }));
  const issuedDoc = await must("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer.id || buyer.account?.id, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
  await page.evaluate(id => window.HOF.invoices.openDoc(id), issuedDoc.id);
  await page.waitForSelector(`${modal} [data-act="e-send"]`, { timeout: 10000 });
  ok(!(await page.$(`${modal} [data-act="e-official"]`)), "gönderilmemiş faturada Resmî Görüntü yok");
  await page.click(`${modal} [data-act="e-send"]`);
  await page.waitForSelector(`${modal} [data-act="e-official"]`, { timeout: 15000 });
  const officialHref = await page.$eval(`${modal} [data-act="e-official"]`, node => node.getAttribute("href"));
  const officialPdf = await page.request.get(`${BASE}${officialHref}`);
  const officialBody = await officialPdf.body();
  ok(officialPdf.status() === 200 && officialBody.subarray(0, 5).toString("latin1") === "%PDF-" && officialBody.toString("latin1").includes(issuedDoc.number), `Resmî Görüntü EDM'nin PDF'ini açar (${officialPdf.status()}, ${officialBody.length} bayt)`);
  await shot(page, "entegrator-8-resmi-goruntu");
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 9 Ek Seçenekler (Wolvox kalan maddeleri; isteğe bağlı) — portala taslak, ödeme şekli, Seri No / Lot No");
  await openInvoices(page);
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.click(`${card} [data-integ-tab="extras"]`);
  const extraChecks = await page.$$eval(`${card} [data-i^="opt."]`, nodes => nodes.map(node => `${node.dataset.i}:${node.checked}`));
  ok(extraChecks.join(",") === "opt.balanceNote:false,opt.paymentMeans:false,opt.draftUpload:false", `Ek Seçenekler varsayılan kapalı: ${extraChecks.join(", ")}`);
  await page.click(`${card} [data-i="opt.draftUpload"]`);
  await page.click(`${card} [data-i="opt.paymentMeans"]`);
  await page.click(`${card} [data-integ-tab="view"]`);
  await page.click(`${card} [data-integ-tab="extras"]`);
  ok(await page.$eval(`${card} [data-i="opt.draftUpload"]`, node => node.checked), "sekme dönüşünde işaret korunur");
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(() => document.querySelector(".hof-toast")?.textContent?.includes("kaydedildi"), null, { timeout: 8000 }).catch(() => null);
  ok(stored().eOptions?.draftUpload === true && stored().eOptions?.paymentMeans === true && stored().eOptions?.balanceNote === false, `kaydedildi (veri tabanı: ${JSON.stringify(stored().eOptions)})`);
  await shot(page, "entegrator-9-ek-secenekler");
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
  await must("seri / lot alanları", admin.put("/api/workspace/invoices/settings", { defaults: { itemTracking: true } }));
  const tracked = await must("seri numaralı fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer.id || buyer.account?.id, lines: [{ name: "Kombi Bakımı", qty: 1, unitPrice: 500, vatRate: 20, serialNo: "SN-100" }], payment: { rest: "open" } }));
  await page.evaluate(id => window.HOF.invoices.openDoc(id), tracked.id);
  await page.waitForSelector(`${modal} [data-act="e-draft"]`, { timeout: 10000 });
  const docText = await textOf(page, `${modal} .hof-invoices-modal`);
  ok(/Seri No: SN-100/.test(docText), "belge ayrıntısında Seri No görünür");
  ok(!(await page.$(`${modal} [data-act="e-send"]`)) && /Portala Taslak Yükle/.test(await textOf(page, `${modal} [data-act="e-draft"]`)), "ayar açıkken “e-Belge Gönder” yerine “Portala Taslak Yükle”");
  // Düzenle: seri numarası alanı dolu açılır; insan hızında lot numarası yazılır (Tab ile çıkılır).
  await page.click(`${modal} [data-act="modify"]`);
  await page.waitForSelector(`${modal} input[data-f="serialNo"]`, { timeout: 10000 });
  ok((await page.$eval(`${modal} input[data-f="serialNo"]`, node => node.value)) === "SN-100", "Düzenle formunda Seri No dolu");
  await page.click(`${modal} input[data-f="lotNo"]`);
  await page.keyboard.type("LOT-5", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.click(`${modal} [data-act="issue"]`);
  await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 8000 });
  await page.click(`${modal} [data-answer="yes"]`);
  await page.waitForSelector(`${modal} [data-act="e-draft"]`, { timeout: 15000 });
  const editedLine = server.app.store.get("SELECT serial_no AS serialNo, lot_no AS lotNo FROM invoice_lines WHERE invoice_id = ?", tracked.id);
  ok(editedLine?.serialNo === "SN-100" && editedLine?.lotNo === "LOT-5", `veri tabanında kalem: ${JSON.stringify(editedLine)}`);
  await page.click(`${modal} [data-act="e-draft"]`);
  await page.waitForSelector(`${modal} [data-act="e-send"]`, { timeout: 15000 });
  const draftText = await textOf(page, `${modal} .hof-invoices-modal`);
  ok(/Portalda Taslak/.test(draftText) && /Taslağı Gönder/.test(draftText) && /Taslağı Yenile/.test(draftText), "taslak yüklendi: “Portalda Taslak”, “Taslağı Gönder”, “Taslağı Yenile”");
  const ettn = server.app.store.get("SELECT ettn FROM invoices WHERE id = ?", tracked.id).ettn;
  ok(edm.state.drafts.has(ettn) && /<cbc:SerialID>SN-100<\/cbc:SerialID>/.test(edm.state.drafts.get(ettn).xml) && /<cbc:LotNumberID>LOT-5<\/cbc:LotNumberID>/.test(edm.state.drafts.get(ettn).xml), "EDM'deki taslakta Seri No ve Lot No");
  await shot(page, "entegrator-9-portalda-taslak");
  await page.click(`${modal} [data-act="e-send"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible [data-act="e-draft"]'), null, { timeout: 15000 });
  const sentDraft = edm.state.sent.find(item => item.uuid === ettn);
  ok(Boolean(sentDraft?.fromDraft) && server.app.store.get("SELECT e_status AS s FROM invoices WHERE id = ?", tracked.id).s === "sent", "Taslağı Gönder: EDM'deki taslak gönderildi, durum Gönderildi");
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 10 Yalnız test ortamı: test hesabı notu, test serisi, “Test” rozeti (kullanıcı kararı 16.10.2026)");
  await openInvoices(page);
  const testPills = await page.$$eval(`${modal} .hof-inv-pill.is-e-test`, nodes => nodes.map(node => node.textContent.trim()));
  ok(testPills.length > 0 && testPills.every(text => text === "Test"), `listede test ortamına giden belgelerde “Test” rozeti (${testPills.length})`);
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.waitForSelector(`${card} [data-integ-test-note]`, { timeout: 8000 });
  const testNote = await textOf(page, `${card} [data-integ-test-note]`);
  ok(/EDM Bilişim'den test hesabı/.test(testNote) && /TEF, TEA, TES/.test(testNote) && /ikinci bir şirkette/.test(testNote), `Test Ortamı notu: ${testNote}`);
  await page.click(`${card} [data-integ-tab="series"]`);
  const seriesText = await textOf(page, `${card} [data-integ-panel="series"]`);
  ok(!seriesText.includes("[object Object]") && /Sıradaki: EFX\d{13}/.test(seriesText) && /Test ortamında: TEF\d{13}/.test(seriesText), `Otomatik Seriler: sıradaki numara ve test serisi doğru yazılır (${seriesText.slice(0, 160)}…)`);
  await shot(page, "entegrator-10-test-seri");
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 11 Kaşe / İmza (Fatura Ayarları, Logo'nun altında; e-Arşivde basılır)");
  await openInvoices(page);
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.click(`${card} [data-integ-tab="firm"]`);
  await page.click(`${card} [data-integ-act="firm"]`);
  await page.waitForSelector(`${modal} [data-stamp-field]`, { timeout: 10000 });
  const stampLabel = await textOf(page, `${modal} [data-stamp-field] > span`);
  ok(stampLabel === "Kaşe / İmza (e-Arşiv Faturasına Basılır)", `Fatura Ayarları'nda Kaşe / İmza alanı: ${stampLabel}`);
  await page.setInputFiles(`${modal} input[data-stamp-file]`, path.join(process.cwd(), "docs/pazarlama/DestekOfis-Logo-Fatura-Kare.jpg"));
  await page.waitForSelector(`${modal} [data-stamp-preview] img`, { timeout: 10000 });
  await page.click(`${modal} [data-act="save-settings"]`);
  await page.waitForFunction(() => document.querySelector(".hof-toast")?.textContent?.includes("Fatura ayarları kaydedildi"), null, { timeout: 10000 }).catch(() => null);
  const storedStamp = stored().seller?.stamp || "";
  ok(/^data:image\/jpeg;base64,\/9j\//.test(storedStamp) && storedStamp.length < 220 * 1024, `kaşe / imza JPEG olarak kaydedildi (${Math.round(storedStamp.length / 1024)} KB metin)`);
  await page.$eval(`${modal} [data-stamp-field]`, node => node.scrollIntoView({ block: "center" })).catch(() => null);
  await shot(page, "entegrator-11-kase-imza");
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 12 Çıkış yolu: entegratöre ulaşılamıyorsa sonucu belirsiz belge yalnız programda iptal edilir (kullanıcı kararı 16.10.2026)");
  const stuck = await must("belirsiz belge", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer.id || buyer.account?.id, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } }));
  // Gönderimin yanıtı kaybolmuş belge (numaralı, durum yok, entegratör yazılı) veri tabanında kurulur; bağlantı yolu sunucu testinde (ebelge-240-bitis-turu).
  server.app.store.run("UPDATE invoices SET e_adapter = 'edm', e_status = 'none' WHERE id = ?", stuck.id);
  await page.evaluate(id => window.HOF.invoices.openDoc(id), stuck.id);
  await page.waitForSelector(`${modal} [data-act="local-cancel"]`, { timeout: 10000 });
  ok(await page.$eval(`${modal} [data-act="cancel"]`, node => node.disabled), "sonucu belirsiz belgede “İptal Et” kapalı, “Yalnız Programda İptal Et” görünür");
  await page.click(`${modal} [data-act="local-cancel"]`);
  const dialog = ".hof-modal-backdrop.is-visible:last-of-type";
  await page.waitForSelector(`${dialog} input[name="confirmLocal"]`, { timeout: 8000 });
  await page.click(`${dialog} input[name="reason"]`);
  await page.keyboard.type("EDM test hesabı kapandı", { delay: 40 });
  await page.click(`${dialog} button[type="submit"]`);
  await page.waitForFunction(selector => /Onay kutusunu/.test(document.querySelector(`${selector} .hof-form-error`)?.textContent || ""), dialog, { timeout: 8000 });
  ok(server.app.store.get("SELECT status FROM invoices WHERE id = ?", stuck.id).status === "issued", "onay kutusu işaretlenmeden iptal edilmez");
  await page.check(`${dialog} input[name="confirmLocal"]`);
  await page.click(`${dialog} button[type="submit"]`);
  for (let index = 0; index < 40 && server.app.store.get("SELECT status FROM invoices WHERE id = ?", stuck.id).status !== "cancelled"; index += 1) await page.waitForTimeout(250);
  const localRow = server.app.store.get("SELECT status, e_message AS eMessage FROM invoices WHERE id = ?", stuck.id);
  const localAudit = server.app.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'invoice.e.local-cancel' AND entity_id = ?", stuck.id).n;
  ok(localRow.status === "cancelled" && /Yalnız programda iptal/.test(localRow.eMessage) && localAudit === 1, `yalnız programda iptal edildi, işlem kaydında (${localRow.status}, kayıt ${localAudit})`);
  await shot(page, "entegrator-12-yalniz-programda-iptal");
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 6 Yönetim → Sistem → Ağ Bağlantısı (vekil sunucu)");
  await page.goto(`${BASE}/admin.html#system`);
  await page.waitForFunction(() => !/Yükleniyor/.test(document.querySelector("#adm-network-summary")?.textContent || "Yükleniyor"), null, { timeout: 15000 });
  const autoChecked = await page.$eval('#adm-network input[name="mode"][value="auto"]', node => node.checked);
  ok(autoChecked && (await page.$eval("#adm-network-manual", node => node.hidden)), "varsayılan Otomatik (Windows Ayarı); elle alanları gizli");
  await page.click('#adm-network input[name="mode"][value="manual"]');
  ok(!(await page.$eval("#adm-network-manual", node => node.hidden)), "Elle Yazılan Adres seçilince adres alanları açılır");
  await page.click("#adm-network-address");
  await page.keyboard.type(`127.0.0.1:${fakeProxy.address().port}`, { delay: 40 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("ofis", { delay: 40 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("Vekil-Parola-9", { delay: 40 });
  await page.click("#adm-network-save");
  await page.waitForFunction(() => /elle yazılan vekil sunucu/.test(document.querySelector("#adm-network-summary")?.textContent || ""), null, { timeout: 10000 });
  const savedFile = JSON.parse(readFileSync(networkFile, "utf8"));
  ok(savedFile.mode === "manual" && savedFile.proxy === `http://ofis:Vekil-Parola-9@127.0.0.1:${fakeProxy.address().port}`, `ayar dosyaya yazıldı (mode ${savedFile.mode})`);
  const passwordShown = await page.$eval("#adm-network-password", node => ({ value: node.value, hint: node.placeholder }));
  const pageHtml = await page.content();
  ok(passwordShown.value === "" && /Kayıtlı parola korunur/.test(passwordShown.hint) && !pageHtml.includes("Vekil-Parola-9"), "parola ekrana dönmez; “Kayıtlı parola korunur”");
  await page.click("#adm-network-test");
  await page.waitForFunction(() => /ulaşılamadı|ulaşıldı/.test(document.querySelector("#adm-network-result")?.textContent || ""), null, { timeout: 30000 });
  const tried = await textOf(page, "#adm-network-result");
  ok(/Vekil sunucu bağlantıyı reddetti \(403\)/.test(tried) && proxyLog.includes("guncelleme.test:443"), `Bağlantıyı Dene vekilden geçti, ret iletisi: ${tried}`);
  await shot(page, "entegrator-6-ag-baglantisi");
  await page.goto(`${BASE}/`);
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
  await openInvoices(page);
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.waitForSelector(`${card} [data-integ-network]`);
  const networkText = await textOf(page, `${card} [data-integ-network]`);
  ok(/elle yazılan vekil sunucu \(http:\/\/127\.0\.0\.1:\d+\)/.test(networkText) && /Yönetim → Sistem → Ağ Bağlantısı/.test(networkText) && !networkText.includes("ofis:"), `Entegratör kartında yol satırı: ${networkText}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  ok(edm.state.violations.length === 0, `sahte EDM sözleşme ihlali yok${edm.state.violations.length ? `: ${edm.state.violations.join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-entegrator-240: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  await edm.close();
  await new Promise(resolve => fakeProxy.close(resolve));
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
