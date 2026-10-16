// EDM TEST ORTAMI — ARAYÜZDEN (16.10.2026, kullanıcı: "kapat" — "arayüzden tıklanarak gerçek EDM'ye gönderim denenmedi" boşluğu).
// Tarayıcı (Playwright/Chromium) programın kendi ekranında gerçek kullanıcı gibi: Entegratör Ayarları (insan hızında kullanıcı adı/parola, Test Ortamı,
// Kaydet, Bağlantıyı Test Et, Etiketleri Getir) → Yeni Satış Faturası (cari seç, kalem yaz) → "Kaydet ve Gönder" (e-Fatura) ve "Kaydet, Sonra
// Gönder" + kartta "e-Belge Gönder" (e-Arşiv) → kartta "Durum Sorgula". Firma bilgisi, logo/kaşe ve cariler API'den (ekranları e2e'de sınanıyor).
// Kimlik bilgisi yalnız yüklenen dosyadan; ekran görüntüsünde parola alanı gizli; çıktıda maskelenir. Canlı kilitli (edocLive yok).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const R = "/home/user/ofis---y-netimi";
const { chromium } = await import(`${R}/node_modules/playwright/index.mjs`);
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const mask = value => String(typeof value === "string" ? value : JSON.stringify(value ?? "")).split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value = "") => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === "" ? "" : `: ${mask(value).slice(0, 500)}`}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = server.client();
await api.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await api.post(u, b));
const put = async (u, b) => unwrap(await api.put(u, b));
await post("/api/workspace/bank/setup/dismiss", {});
const jpeg = file => `data:image/jpeg;base64,${readFileSync(`${R}/docs/pazarlama/${file}`).toString("base64")}`;
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const year = new Date().getFullYear();
const firm = await put("/api/workspace/invoices/settings", {
  seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr", logo: jpeg("DestekOfis-Logo-Fatura-Yatay.jpg"), stamp: jpeg("DestekOfis-Logo-Fatura-Kare.jpg"), banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
  efatura: true, earsiv: true, start: { [`TEF${year}`]: seq, [`TEA${year}`]: seq },
  defaults: { footer: "DestekOfis 2.4.0 — arayüzden kesilen deneme belgesi." },
});
log("FİRMA (API)", { status: firm.status, err: firm.data?.error });
const acc = async body => { const r = await post("/api/workspace/accounts", body); if (r.status !== 200) throw new Error(mask(r.data)); return r.data.id || r.data.account?.id; };
// Excel'den gelmiş gibi (mükellefiyeti sorgulanmamış) cari — koruma denemesi için.
const firmAcc = await acc({ name: "ETA BILGISAYAR TEST 3 (Sorgulanmamış)", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul" });
const personAcc = await acc({ name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Deneme Sk. 5", district: "Kadıköy", email: "alici@example.com" });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const modal = ".hof-modal-backdrop.is-visible";
const card = `${modal} [data-integ-root]`;
const inv = `${modal} .hof-invoices-modal`;
let shotNo = 0;
const shot = async name => { shotNo += 1; await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) }); };
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const pause = ms => page.waitForTimeout(ms);
try {
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 30000 });
  log("GİRİŞ (ekran)", "tamam");

  // 1) Entegratör Ayarları — ekrandan.
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="integrator"]`);
  await page.click(`${inv} [data-act="integrator"]`);
  await page.waitForSelector(`${card} input[data-i="username"]`);
  await page.click(`${card} input[data-i="username"]`);
  await page.keyboard.type(username, { delay: 35 });
  await page.keyboard.press("Tab");
  await page.keyboard.type(password, { delay: 35 });
  await shot("entegrator-bilgiler-girildi");
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(sel => /Bağlantı denenmedi|Bağlantı kuruldu/.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`);
  await page.click(`${card} [data-integ-act="test"]`);
  await page.waitForFunction(sel => /Bağlantı kuruldu|başarısız|hata/i.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 90000 });
  log("BAĞLANTIYI TEST ET (ekran)", await textOf(`${card} [data-integ-status]`));
  await page.click(`${card} [data-integ-act="aliases"]`);
  await page.waitForFunction(sel => (document.querySelector(sel)?.options || []).length > 1, `${card} select[data-i="senderAlias"]`, { timeout: 90000 });
  const gb = await page.$$eval(`${card} select[data-i="senderAlias"] option`, nodes => nodes.map(node => node.value).filter(Boolean));
  const pk = await page.$$eval(`${card} select[data-i="mailboxAlias"] option`, nodes => nodes.map(node => node.value).filter(Boolean));
  log("ETİKETLER (ekran)", { gb: gb.slice(0, 3), pk: pk.slice(0, 3) });
  if (gb.includes("urn:mail:defaultgb@edmbilisim.com.tr")) await page.selectOption(`${card} select[data-i="senderAlias"]`, "urn:mail:defaultgb@edmbilisim.com.tr");
  if (pk.includes("urn:mail:defaultpk@edmbilisim.com.tr")) await page.selectOption(`${card} select[data-i="mailboxAlias"]`, "urn:mail:defaultpk@edmbilisim.com.tr");
  // "VKN yazılınca mükellefiyeti sorgula" (cari formunda) — ekrandan açılır.
  if (!(await page.$eval(`${card} input[data-i="autoCheckUser"]`, node => node.checked))) await page.click(`${card} input[data-i="autoCheckUser"]`);
  await shot("entegrator-baglanti-ve-etiketler");
  await page.click(`${card} [data-integ-act="save"]`);
  await pause(1200);
  const saved = JSON.parse(server.app.store.setting("invoice.settings", "{}")).integrator;
  log("ENTEGRATÖR AYARI (veri tabanı)", { env: saved.env, baseUrl: saved.baseUrl || "(boş = test adresi)", gb: saved.senderAlias, pk: saved.mailboxAlias, parolaSifreli: Boolean(saved.passwordSealed) && !JSON.stringify(saved).includes(password), sonTest: saved.lastTest?.ok });
  for (let i = 0; i < 4 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(300); }

  // 2) Fatura formu — ekrandan.
  const newSale = async (accountId, query, lines) => {
    for (let i = 0; i < 4 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(300); }
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-scenario="service_sale"]`);
    await page.waitForSelector(`${inv} [data-lines]`);
    await page.click(`${inv} [data-acc-query]`);
    await page.keyboard.type(query, { delay: 40 });
    await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${accountId}"]`, { timeout: 15000 });
    await (await page.$(`${inv} .hof-acc-picker li[data-id="${accountId}"]`)).dispatchEvent("mousedown");
    await pause(600);
    for (const [index, line] of lines.entries()) {
      if (index > 0) { await page.click(`${inv} [data-act="add-line"]`); await pause(300); }
      await page.click(`${inv} [data-l="${index}"][data-f="name"]`);
      await page.keyboard.type(line.name, { delay: 40 });
      await page.keyboard.press("Tab");
      for (const [field, value] of [["qty", line.qty], ["unitPrice", line.unitPrice]]) {
        const sel = `${inv} [data-l="${index}"][data-f="${field}"]`;
        await page.click(sel, { clickCount: 3 });
        await page.keyboard.type(String(value), { delay: 40 });
        await page.keyboard.press("Tab");
      }
      if (line.vatRate !== undefined) await page.selectOption(`${inv} [data-l="${index}"][data-f="vatRate"]`, String(line.vatRate));
    }
    await pause(500);
  };
  const confirmYes = async () => {
    for (let i = 0; i < 25; i += 1) {
      await pause(400);
      const yes = await page.$(`${modal} [data-answer="yes"]`);
      if (yes) { await yes.click(); continue; }
      if (await page.$(`${inv} .hof-inv-pills`)) return true;
    }
    return false;
  };
  const cardInfo = async () => ({ baslik: await textOf(`${inv} .hof-inv-pills`), eDurum: await textOf(`${inv} .hof-inv-estatus, ${inv} [data-estatus]`) });
  const results = [];

  // 2-0) Mükellefiyeti sorgulanmamış firma: program e-Arşiv sayar; gönderimden önce EDM'ye mükellefiyet sorulur, gönderim durur, cari işaretlenir.
  await newSale(firmAcc, "ETA", [{ name: "Deneme Kalemi", qty: 1, unitPrice: 100, vatRate: 20 }]);
  await page.click(`${inv} [data-act="issue-later"]`);
  log("Sorgulanmamış firma kart açıldı", await confirmYes());
  await page.waitForSelector(`${inv} [data-act="e-send"]`, { timeout: 20000 });
  const guarded = server.app.store.get("SELECT id, number, profile, e_status AS eStatus FROM invoices ORDER BY created_at DESC LIMIT 1");
  await page.click(`${inv} [data-act="e-send"]`);
  for (let i = 0; i < 10; i += 1) { await pause(500); const yes = await page.$(`${modal} [data-answer="yes"]`); if (yes) { await yes.click(); break; } }
  await pause(5000);
  await shot("korumasi-efatura-mukellefine-earsiv");
  const toast = await page.$$eval(".hof-toast", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()).join(" | ")).catch(() => "");
  log("KORUMA (ekran iletisi)", toast);
  log("KORUMA (veri tabanı)", { belge: server.app.store.get("SELECT number, profile, e_status AS eStatus FROM invoices WHERE id = ?", guarded.id), cariMukellef: server.app.store.get("SELECT e_invoice AS eInvoice, e_alias AS eAlias FROM accounts WHERE id = ?", firmAcc) });
  // Koruma belgesi programda iptal edilir (numara almadı; e-Belge değil).
  log("koruma belgesi iptal", (await post(`/api/workspace/invoices/${guarded.id}/withdraw`, {})).status);

  // 2-1) Yeni Cari — ekrandan: VKN yazılınca EDM'ye mükellefiyet sorulur, posta kutusu listeden seçilir.
  for (let i = 0; i < 4 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(300); }
  await page.evaluate(() => window.HOF.accounts.newFor({}));
  await page.waitForSelector(`${modal} input[name="taxNo"]`);
  await page.click(`${modal} input[name="name"]`);
  await page.keyboard.type("ETA Bilgisayar Test", { delay: 35 });
  await page.click(`${modal} input[name="taxNo"]`);
  await page.keyboard.type("3230512384", { delay: 35 });
  await page.keyboard.press("Tab");
  await page.waitForSelector(`${modal}:last-of-type select[name="alias"]`, { timeout: 60000 });
  const pkOptions = await page.$$eval(`${modal}:last-of-type select[name="alias"] option`, nodes => nodes.map(node => node.value));
  log("CARİ FORMU MÜKELLEF SORGUSU (ekran) posta kutuları", pkOptions);
  await page.selectOption(`${modal}:last-of-type select[name="alias"]`, "urn:mail:defaultpk@edmbilisim.com.tr");
  await shot("cari-posta-kutusu-secimi");
  await page.click(`${modal}:last-of-type .hof-form button[type="submit"]`);
  await page.waitForFunction(() => document.querySelector('input[name="eAlias"]')?.value === "urn:mail:defaultpk@edmbilisim.com.tr", null, { timeout: 15000 });
  for (const [field, value] of [["taxOffice", "Kadıköy"], ["address", "Test Cd. 1"], ["district", "Kadıköy"], ["city", "İstanbul"]]) {
    const sel = `${modal} [name="${field}"]`;
    if (await page.$(sel)) { await page.click(sel); await page.fill(sel, ""); await page.keyboard.type(value, { delay: 25 }); }
  }
  await shot("cari-formu-dolu");
  await page.click(`${modal} .hof-form button[type="submit"]`);
  await pause(2500);
  const uiFirm = server.app.store.get("SELECT id, e_invoice AS eInvoice, e_alias AS eAlias, tax_no AS taxNo FROM accounts WHERE name = ?", "ETA Bilgisayar Test");
  log("YENİ CARİ (ekrandan, veri tabanı)", uiFirm);

  // 2a) e-Fatura: "Kaydet ve Gönder" (ekrandan açılan, mükellef sorgulanmış cari → program e-Fatura seçer).
  await newSale(uiFirm.id, "ETA Bilgisayar", [{ name: "Yazılım Destek Hizmeti", qty: 2, unitPrice: 750, vatRate: 20 }, { name: "Eğitim", qty: 1, unitPrice: 400, vatRate: 10 }]);
  await shot("efatura-form-dolu");
  await page.click(`${inv} [data-act="issue-now"]`);
  log("e-Fatura kart açıldı", await confirmYes());
  await pause(1500);
  await shot("efatura-kaydedildi-gonderildi");
  const efatura = server.app.store.get("SELECT id, number, ettn, profile, e_status AS eStatus, e_message AS eMessage, try_payable AS payable FROM invoices ORDER BY created_at DESC LIMIT 1");
  log("e-Fatura (veri tabanı)", efatura);
  results.push(efatura);

  // 2b) e-Arşiv: "Kaydet, Sonra Gönder" → kartta "e-Belge Gönder".
  await newSale(personAcc, "Ayşe", [{ name: "Danışmanlık", qty: 3, unitPrice: 300, vatRate: 20 }]);
  await shot("earsiv-form-dolu");
  await page.click(`${inv} [data-act="issue-later"]`);
  log("e-Arşiv kart açıldı", await confirmYes());
  await pause(1200);
  await shot("earsiv-gonderilecek");
  await page.waitForSelector(`${inv} [data-act="e-send"]`, { timeout: 20000 });
  await page.click(`${inv} [data-act="e-send"]`);
  for (let i = 0; i < 10; i += 1) { await pause(500); const yes = await page.$(`${modal} [data-answer="yes"]`); if (yes) { await yes.click(); break; } }
  await pause(4000);
  await shot("earsiv-gonderildi");
  const earsiv = server.app.store.get("SELECT id, number, ettn, profile, e_status AS eStatus, e_message AS eMessage, try_payable AS payable FROM invoices ORDER BY created_at DESC LIMIT 1");
  log("e-Arşiv (veri tabanı)", earsiv);
  results.push(earsiv);

  // 3) Kartta "Durum Sorgula" — ekrandan, belge son durumuna gelene kadar.
  for (const doc of results) {
    for (let round = 1; round <= 16; round += 1) {
      for (let i = 0; i < 4 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(250); }
      await page.evaluate(id => window.HOF.invoices.openDoc(id), doc.id);
      await page.waitForSelector(`${inv} [data-act="e-refresh"]`, { timeout: 20000 });
      await page.click(`${inv} [data-act="e-refresh"]`);
      await pause(3000);
      const row = server.app.store.get("SELECT e_status AS eStatus, e_message AS eMessage FROM invoices WHERE id = ?", doc.id);
      log(`${doc.number} DURUM SORGULA ${round} (ekran)`, row);
      if (row.eStatus !== "processing") { doc.final = row; break; }
      await pause(40000);
    }
    await shot(`${doc.profile === "EARSIVFATURA" ? "earsiv" : "efatura"}-durum-son`);
    const r = await api.raw("GET", `/api/workspace/invoices/${doc.id}/resmi.pdf`);
    if (r.status === 200) writeFileSync(path.join(OUT, `${doc.number}-resmi.pdf`), r.buffer);
    log(`${doc.number} RESMÎ GÖRÜNTÜ`, { status: r.status, bayt: r.buffer.length });
  }
  console.log("ÖZET", JSON.stringify(results.map(d => ({ no: d.number, ettn: d.ettn, profil: d.profile, tutar: d.payable, son: d.final?.eStatus, ileti: d.final?.eMessage }))));
  log("SAYFA HATALARI", errors.length ? errors : "yok");
} catch (error) {
  await shot("hata").catch(() => {});
  log("HATA", String(error?.stack || error).slice(0, 800));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
