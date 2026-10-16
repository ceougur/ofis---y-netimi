// EDM TEST ORTAMI — ARAYÜZDEN KESME + İPTAL MATRİSİ (kullanıcı, 16.10.2026: "fatura, e-arşiv, kesme ve iptal etme durumlarını gerçek kullanıcı gibi
// test edelim, hataya yer bırakma"). Tarayıcı programın ekranında; her adımda ekran iletisi (toast), veri tabanı ve cari bakiyesi okunur.
// Kimlik bilgisi yalnız yüklenen dosyadan; çıktıda maskelenir. Canlı kilitli. Firma bilgisi/logo API'den (Fatura Ayarları ekranı e2e'de sınanıyor).
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
const log = (label, value = "") => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === "" ? "" : `: ${mask(value).slice(0, 600)}`}`);
let pass = 0, fail = 0;
const check = (cond, what) => { cond ? (pass += 1) : (fail += 1); console.log(`  ${cond ? "✓" : "✗"} ${mask(what)}`); return Boolean(cond); };
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = server.client();
await api.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await api.post(u, b));
const put = async (u, b) => unwrap(await api.put(u, b));
const get = async u => unwrap(await api.get(u));
await post("/api/workspace/bank/setup/dismiss", {});
const jpeg = file => `data:image/jpeg;base64,${readFileSync(`${R}/docs/pazarlama/${file}`).toString("base64")}`;
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const year = new Date().getFullYear();
await put("/api/workspace/invoices/settings", {
  seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr", logo: jpeg("DestekOfis-Logo-Fatura-Yatay.jpg"), stamp: jpeg("DestekOfis-Logo-Fatura-Kare.jpg"), banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
  efatura: true, earsiv: true, start: { [`TEF${year}`]: seq, [`TEA${year}`]: seq },
  defaults: { footer: "DestekOfis 2.4.0 — arayüzden kesme/iptal denemesi." },
});
const db = sql => (...args) => server.app.store.get(sql, ...args);
const invRow = id => db("SELECT id, number, ettn, profile, status, e_status AS eStatus, e_message AS eMessage, try_payable AS payable FROM invoices WHERE id = ?")(id);
const lastInv = () => db("SELECT id FROM invoices ORDER BY created_at DESC, rowid DESC LIMIT 1")().id;
const balance = async accountId => { const r = await get(`/api/workspace/accounts/${accountId}`); return Number(r.data?.totals?.balance ?? NaN); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => {
  window.__toasts = [];
  document.addEventListener("DOMContentLoaded", () => {
    document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }));
    new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".hof-toast") || n.querySelector?.(".hof-toast"))) window.__toasts.push((n.matches(".hof-toast") ? n : n.querySelector(".hof-toast")).textContent.replace(/\s+/g, " ").trim()); }).observe(document.body, { childList: true, subtree: true });
  });
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const modal = ".hof-modal-backdrop.is-visible";
const last = `${modal}:last-of-type`;
const card = `${modal} [data-integ-root]`;
const inv = `${modal} .hof-invoices-modal`;
let shotNo = 0;
const shot = async name => { shotNo += 1; await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) }); };
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const pause = ms => page.waitForTimeout(ms);
const toasts = async () => { const list = await page.evaluate(() => window.__toasts.splice(0)); return list; };
const closeAll = async () => { for (let i = 0; i < 5 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(250); } };
const yesIfAsked = async (tries = 12) => { for (let i = 0; i < tries; i += 1) { await pause(400); const yes = await page.$(`${modal} [data-answer="yes"]`); if (yes) { await yes.click(); return true; } } return false; };
const openDoc = async id => { await closeAll(); await page.evaluate(docId => window.HOF.invoices.openDoc(docId), id); await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 20000 }); await pause(400); };
const clickAct = async act => { await page.waitForSelector(`${inv} [data-act="${act}"]`, { timeout: 20000 }); await page.click(`${inv} [data-act="${act}"]`); };
// Durum Sorgula (ekran) — son duruma gelene kadar.
const settle = async (id, label, rounds = 14) => {
  let row = invRow(id);
  for (let round = 1; round <= rounds; round += 1) {
    await openDoc(id);
    if (!(await page.$(`${inv} [data-act="e-refresh"]`))) break;
    await clickAct("e-refresh");
    await pause(3000);
    row = invRow(id);
    log(`  ${label} Durum Sorgula ${round}`, { eStatus: row.eStatus, ileti: (row.eMessage || "").slice(0, 120) });
    if (row.eStatus !== "processing") break;
    await pause(35000);
  }
  return row;
};
const newSale = async (accountId, query, lines, { profile = "" } = {}) => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="service_sale"]`);
  await page.waitForSelector(`${inv} [data-lines]`);
  await page.click(`${inv} [data-acc-query]`);
  await page.keyboard.type(query, { delay: 40 });
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${accountId}"]`, { timeout: 15000 });
  await (await page.$(`${inv} .hof-acc-picker li[data-id="${accountId}"]`)).dispatchEvent("mousedown");
  await pause(700);
  for (const [index, line] of lines.entries()) {
    if (index > 0) { await page.click(`${inv} [data-act="add-line"]`); await pause(300); }
    await page.click(`${inv} [data-l="${index}"][data-f="name"]`);
    await page.keyboard.type(line.name, { delay: 35 });
    await page.keyboard.press("Tab");
    for (const [field, value] of [["qty", line.qty], ["unitPrice", line.unitPrice]]) {
      const sel = `${inv} [data-l="${index}"][data-f="${field}"]`;
      await page.click(sel, { clickCount: 3 });
      await page.keyboard.type(String(value), { delay: 35 });
      await page.keyboard.press("Tab");
    }
    if (line.vatRate !== undefined) await page.selectOption(`${inv} [data-l="${index}"][data-f="vatRate"]`, String(line.vatRate));
  }
  await pause(500);
  // Belge Türü kutusu tutar hesaplanınca ve birden çok seçenek varsa görünür (e-Fatura mükellefinde Temel / Ticari).
  if (profile) {
    await page.waitForSelector(`${inv} [data-profile-field]:not([hidden]) select`, { timeout: 15000 });
    await page.selectOption(`${inv} [data-f="profile"]`, profile);
    await pause(500);
  }
};
// Kaydet: "issue-now" (Kaydet ve Gönder) ya da "issue-later" (Kaydet, Sonra Gönder).
const save = async how => { await toasts(); await page.click(`${inv} [data-act="${how}"]`); await yesIfAsked(); await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 30000 }); await pause(1500); return lastInv(); };
const cancelUi = async (id, { confirmExternal = null, reason = "Deneme iptali" } = {}) => {
  await openDoc(id);
  await toasts();
  await clickAct("cancel");
  await page.waitForSelector(`${last} input[name="reason"]`);
  await page.click(`${last} input[name="reason"]`);
  await page.keyboard.type(reason, { delay: 30 });
  if (confirmExternal === true) await page.check(`${last} input[name="confirmExternal"]`);
  await page.click(`${last} button[type="submit"]`);
  await pause(4000);
  const formError = await textOf(`${last} .hof-form-error`);
  return { formError, toasts: await toasts(), row: invRow(id) };
};

try {
  // ---------- Hazırlık (ekran) ----------
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 30000 });
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="integrator"]`);
  await page.click(`${inv} [data-act="integrator"]`);
  await page.waitForSelector(`${card} input[data-i="username"]`);
  await page.click(`${card} input[data-i="username"]`);
  await page.keyboard.type(username, { delay: 30 });
  await page.keyboard.press("Tab");
  await page.keyboard.type(password, { delay: 30 });
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(sel => /Bağlantı denenmedi|Bağlantı kuruldu/.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`);
  await page.click(`${card} [data-integ-act="test"]`);
  await page.waitForFunction(sel => /Bağlantı kuruldu|başarısız|hata/i.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 90000 });
  check(/Bağlantı kuruldu/.test(await textOf(`${card} [data-integ-status]`)), `Bağlantıyı Test Et: ${await textOf(`${card} [data-integ-status]`)}`);
  await page.click(`${card} [data-integ-act="aliases"]`);
  await page.waitForFunction(sel => (document.querySelector(sel)?.options || []).length > 1, `${card} select[data-i="senderAlias"]`, { timeout: 90000 });
  await page.selectOption(`${card} select[data-i="senderAlias"]`, "urn:mail:defaultgb@edmbilisim.com.tr");
  await page.selectOption(`${card} select[data-i="mailboxAlias"]`, "urn:mail:defaultpk@edmbilisim.com.tr");
  if (!(await page.$eval(`${card} input[data-i="autoCheckUser"]`, node => node.checked))) await page.click(`${card} input[data-i="autoCheckUser"]`);
  await page.click(`${card} [data-integ-act="save"]`);
  await pause(1200);
  await closeAll();
  // Cariler (ekran): firma (VKN → mükellef sorgusu → posta kutusu) ve kişi (TCKN).
  const newAccount = async ({ name, taxNo, partyKind = "", firstName = "", familyName = "", pk = "" }) => {
    await closeAll();
    await page.evaluate(() => window.HOF.accounts.newFor({}));
    await page.waitForSelector(`${modal} input[name="taxNo"]`);
    await page.click(`${modal} input[name="name"]`);
    await page.keyboard.type(name, { delay: 30 });
    if (partyKind) await page.selectOption(`${modal} select[name="partyKind"]`, partyKind);
    await page.click(`${modal} input[name="taxNo"]`);
    await page.keyboard.type(taxNo, { delay: 30 });
    await page.keyboard.press("Tab");
    if (pk) {
      await page.waitForSelector(`${last} select[name="alias"]`, { timeout: 60000 });
      await page.selectOption(`${last} select[name="alias"]`, pk);
      await page.click(`${last} .hof-form button[type="submit"]`);
      await page.waitForFunction(value => document.querySelector('input[name="eAlias"]')?.value === value, pk, { timeout: 15000 });
    } else await pause(3000);
    for (const [field, value] of [["firstName", firstName], ["familyName", familyName], ["taxOffice", "Kadıköy"], ["address", "Test Cd. 1"], ["district", "Kadıköy"], ["city", "İstanbul"], ["email", partyKind === "person" ? "alici@example.com" : ""]]) {
      const sel = `${modal} [name="${field}"]`;
      if (value && (await page.$(sel))) { await page.click(sel); await page.fill(sel, ""); await page.keyboard.type(value, { delay: 20 }); }
    }
    await page.click(`${modal} .hof-form button[type="submit"]`);
    await pause(2500);
    const row = db("SELECT id, e_invoice AS eInvoice, e_alias AS eAlias FROM accounts WHERE name = ?")(name);
    log(`CARİ (ekrandan) ${name}`, row);
    return row;
  };
  const firm = await newAccount({ name: "ETA Bilgisayar Test", taxNo: "3230512384", pk: "urn:mail:defaultpk@edmbilisim.com.tr" });
  check(firm?.eInvoice === 1 && firm.eAlias === "urn:mail:defaultpk@edmbilisim.com.tr", "firma carisi ekrandan: mükellef, posta kutusu seçildi");
  const person = await newAccount({ name: "Ayşe Kaya", taxNo: "10000000146", partyKind: "person", firstName: "Ayşe", familyName: "Kaya" });
  check(person && person.eInvoice === 0, "kişi carisi ekrandan: mükellef değil (e-Arşiv)");
  const firm0 = await balance(firm.id);
  const person0 = await balance(person.id);
  log("BAŞLANGIÇ BAKİYELERİ", { firma: firm0, kisi: person0 });

  // ---------- KESME ----------
  console.log("\n■ K1 e-Fatura Temel — Kaydet ve Gönder");
  await newSale(firm.id, "ETA Bil", [{ name: "Yazılım Destek Hizmeti", qty: 2, unitPrice: 750, vatRate: 20 }, { name: "Eğitim", qty: 1, unitPrice: 400, vatRate: 10 }]);
  await shot("K1-form");
  const k1 = await save("issue-now");
  let r = invRow(k1);
  log("K1", { no: r.number, profil: r.profile, eStatus: r.eStatus, toasts: await toasts() });
  check(r.profile === "TEMELFATURA" && /^TEF/.test(r.number) && ["sent", "processing"].includes(r.eStatus), `K1 e-Fatura gönderildi (${r.number}, ${r.eStatus})`);
  await shot("K1-kart");

  console.log("\n■ K2 e-Fatura Ticari — Kaydet, Sonra Gönder → kartta e-Belge Gönder");
  await newSale(firm.id, "ETA Bil", [{ name: "Yıllık Bakım Sözleşmesi", qty: 1, unitPrice: 1000, vatRate: 20 }], { profile: "TICARIFATURA" });
  const k2 = await save("issue-later");
  r = invRow(k2);
  check(r.eStatus === "waiting" && r.number === "", `K2 Gönderilecekler'de, numarasız (${r.eStatus})`);
  await shot("K2-gonderilecek");
  await toasts();
  await clickAct("e-send");
  await yesIfAsked(6);
  await pause(5000);
  r = invRow(k2);
  log("K2", { no: r.number, profil: r.profile, eStatus: r.eStatus, toasts: await toasts() });
  check(r.profile === "TICARIFATURA" && /^TEF/.test(r.number) && ["sent", "processing"].includes(r.eStatus), `K2 Ticari gönderildi (${r.number})`);

  console.log("\n■ K3 e-Arşiv (kişi) — Kaydet ve Gönder");
  await newSale(person.id, "Ayşe", [{ name: "Danışmanlık", qty: 3, unitPrice: 300, vatRate: 20 }]);
  const k3 = await save("issue-now");
  r = invRow(k3);
  log("K3", { no: r.number, profil: r.profile, eStatus: r.eStatus, toasts: await toasts() });
  check(r.profile === "EARSIVFATURA" && /^TEA/.test(r.number) && ["sent", "processing"].includes(r.eStatus), `K3 e-Arşiv gönderildi (${r.number})`);
  await shot("K3-kart");

  console.log("\n■ K4 e-Arşiv (kişi) — Kaydet, Sonra Gönder → e-Belge Gönder");
  await newSale(person.id, "Ayşe", [{ name: "Kurulum", qty: 1, unitPrice: 500, vatRate: 20 }]);
  const k4 = await save("issue-later");
  await toasts();
  await clickAct("e-send");
  await yesIfAsked(6);
  await pause(5000);
  r = invRow(k4);
  log("K4", { no: r.number, eStatus: r.eStatus, toasts: await toasts() });
  check(/^TEA/.test(r.number) && ["sent", "processing"].includes(r.eStatus), `K4 e-Arşiv gönderildi (${r.number})`);

  console.log("\n■ K5 Gönderilecekler'den Listeden Sil (gönderilmeden vazgeçme)");
  await newSale(person.id, "Ayşe", [{ name: "Vazgeçilen Hizmet", qty: 1, unitPrice: 200, vatRate: 20 }]);
  const k5 = await save("issue-later");
  await toasts();
  await clickAct("e-withdraw");
  await yesIfAsked(6);
  await pause(2500);
  r = invRow(k5);
  log("K5", { no: r.number, profil: r.profile, eStatus: r.eStatus, toasts: await toasts() });
  check(r.profile === "KAGIT" && r.eStatus === "withdrawn" && !/^TE[AF]/.test(r.number), `K5 Müşteri Fişi olarak kaldı (${r.number}); e-Belge numarası harcanmadı`);

  // ---------- SON DURUMLAR ----------
  console.log("\n■ Durum Sorgula (ekran) — dört gönderilen belge");
  const finals = {};
  for (const [label, id] of [["K1", k1], ["K2", k2], ["K3", k3], ["K4", k4]]) finals[label] = await settle(id, label);
  for (const [label, row] of Object.entries(finals)) check(["sent", "accepted"].includes(row.eStatus), `${label} son durum: ${row.eStatus} — ${(row.eMessage || "").slice(0, 80)}`);
  for (const [label, id] of [["K1", k1], ["K3", k3]]) {
    const pdf = await api.raw("GET", `/api/workspace/invoices/${id}/resmi.pdf`);
    if (pdf.status === 200) writeFileSync(path.join(OUT, `${invRow(id).number}-resmi.pdf`), pdf.buffer);
    check(pdf.status === 200 && pdf.buffer.subarray(0, 5).toString("latin1") === "%PDF-", `${label} Resmî Görüntü alındı`);
  }
  const firmAfterSales = await balance(firm.id);
  const personAfterSales = await balance(person.id);
  log("SATIŞLARDAN SONRA BAKİYE", { firma: firmAfterSales, kisi: personAfterSales });

  // ---------- İPTAL ----------
  console.log("\n■ İ1 e-Arşiv iptali (K3) — İptal Et → EDM'de de iptal");
  const k3pay = invRow(k3).payable;
  let c = await cancelUi(k3);
  log("İ1", { formHata: c.formError, toasts: c.toasts, status: c.row.status, eStatus: c.row.eStatus });
  check(c.row.status === "cancelled" && c.row.eStatus === "cancelled", "İ1 belge programda ve EDM'de iptal");
  await shot("I1-earsiv-iptal");
  const afterI1 = await balance(person.id);
  check(Math.abs(afterI1 - (personAfterSales - k3pay)) < 0.01, `İ1 kişi bakiyesi iptal tutarı kadar düştü (${personAfterSales} → ${afterI1}, fatura ${k3pay})`);
  const s1 = await settle(k3, "İ1", 2);
  check(s1.eStatus === "cancelled", `İ1 Durum Sorgula: ${s1.eStatus}`);

  console.log("\n■ İ2 e-Fatura iptali (K1) — onay kutusu olmadan reddedilir, onayla programda iptal (GİB tarafı ayrı)");
  c = await cancelUi(k1);
  log("İ2a onaysız", { formHata: c.formError, status: c.row.status });
  check(c.row.status === "issued" && /GİB|iptal edilmeli|kutuyu/.test(c.formError), `İ2a onaysız iptal edilmedi: “${c.formError.slice(0, 120)}”`);
  await shot("I2a-efatura-onaysiz");
  await closeAll();
  const k1pay = invRow(k1).payable;
  c = await cancelUi(k1, { confirmExternal: true });
  log("İ2b onaylı", { formHata: c.formError, toasts: c.toasts, status: c.row.status, eStatus: c.row.eStatus });
  check(c.row.status === "cancelled", "İ2b onayla programda iptal");
  const afterI2 = await balance(firm.id);
  check(Math.abs(afterI2 - (firmAfterSales - k1pay)) < 0.01, `İ2 firma bakiyesi düştü (${firmAfterSales} → ${afterI2}, fatura ${k1pay})`);

  console.log("\n■ İ3 İşlenirken iptal: yeni e-Arşiv kesilip hemen iptal");
  await newSale(person.id, "Ayşe", [{ name: "Hemen İptal", qty: 1, unitPrice: 150, vatRate: 20 }]);
  const k6 = await save("issue-now");
  c = await cancelUi(k6);
  log("İ3", { formHata: c.formError, toasts: c.toasts, status: c.row.status, eStatus: c.row.eStatus });
  check(c.row.status === "cancelled" || /işleniyor|birkaç dakika/i.test(`${c.formError} ${c.toasts.join(" ")}`), `İ3 ya iptal edildi ya da "işleniyor" denip beklendi (${c.row.status}/${c.row.eStatus})`);
  if (c.row.status !== "cancelled") {
    await closeAll();
    await settle(k6, "İ3", 6);
    c = await cancelUi(k6);
    log("İ3 yeniden", { formHata: c.formError, status: c.row.status, eStatus: c.row.eStatus });
    check(c.row.status === "cancelled" && c.row.eStatus === "cancelled", "İ3 işlem bitince iptal edildi");
  }

  console.log("\n■ İ4 Müşteri Fişine dönmüş belge (K5) iptali");
  c = await cancelUi(k5);
  check(c.row.status === "cancelled", `İ4 fiş iptal (${c.row.status})`);

  const firmEnd = await balance(firm.id);
  const personEnd = await balance(person.id);
  log("SON BAKİYELER", { firma: firmEnd, kisi: personEnd, beklenenFirma: firmAfterSales - k1pay, beklenenKisi: personAfterSales - k3pay - invRow(k5).payable });
  check(Math.abs(personEnd - (personAfterSales - k3pay - invRow(k5).payable)) < 0.01 && Math.abs(firmEnd - (firmAfterSales - k1pay)) < 0.01, "son bakiyeler iptallerle tutarlı");
  const gate = await get("/api/workspace/ledger/integrity");
  log("DEFTER BÜTÜNLÜĞÜ", { status: gate.status, veri: JSON.stringify(gate.data).slice(0, 300) });
  check(gate.status === 200 && gate.data?.ok !== false && !(gate.data?.problems || []).length, "defter bütünlüğü (ledger/integrity) temiz");
  console.log("ÖZET", JSON.stringify(Object.fromEntries([["K1", k1], ["K2", k2], ["K3", k3], ["K4", k4], ["K5", k5], ["K6", k6]].map(([k, id]) => { const x = invRow(id); return [k, { no: x.number, ettn: x.ettn, profil: x.profile, durum: x.status, eDurum: x.eStatus, tutar: x.payable }]; }))));
} catch (error) {
  await shot("hata").catch(() => {});
  log("HATA", String(error?.stack || error).slice(0, 900));
  fail += 1;
} finally {
  log("SAYFA HATALARI", errors.length ? errors : "yok");
  console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
  process.exitCode = fail ? 1 : 0;
  await browser.close();
  await server.close();
}
