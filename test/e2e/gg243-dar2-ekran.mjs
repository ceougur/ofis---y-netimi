// Dar kontrol 2 (2.4.3) — ekrandan, GERÇEK tarayıcıda (sahte EDM, ağa çıkmaz):
//   A. B1: Gönderilecekler'in başında EDM'nin reddettiği 20 belge (numaralı, "Hata") + 30 yeni belge. Tümünü Gönder bir basışta 30 yeni belgeyi gönderir
//      (tur imleçle ilerler; her belge turda bir kez denenir); bitiş bildirimi gönderilen ve gönderilemeyen sayısını NEDENİYLE söyler. Eski kodda (276f94e)
//      ilk istek 20 reddedileni yeniden dener, 0 gönderip durur ("0 belge gönderildi").
//   B. MM1: kâğıt alış faturası (No "A 004512") → İade formu AÇILIRKEN "İade Edilen Belge No (e-Belge Referansı)" alanı önerilen değerle (A000000000004512)
//      ve uyarısıyla görünür; değer 16 karakter değilken Kaydet düğmeleri pasif ve nedeni yazılı; insan hızında düzeltilince etkin; Kaydet ve Gönder →
//      belge EDM'ye gider, BillingReference/ID önerilen değer, asıl kayıt değişmez.
// DEPO=<eski kopya> ile eski kodda koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { OUR_VKN, startMockEdm, vkn } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);
const { resetEdmCaches } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "edm.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-06-17T09:00:00+03:00";
const BAD = "11223344550";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fault = (code, message) => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>${message}</faultstring><detail><RequestFault xmlns="urn:edm:test"><ERROR_CODE>${code}</ERROR_CODE><ERROR_SHORT_DES>${message}</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`;
resetEdmCaches();
const edm = await startMockEdm();
let badSends = 0;
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  const raw = String(init?.body || "");
  if (/SendInvoiceRequest/.test(raw)) {
    const xml = Buffer.from((/<(?:\w+:)?CONTENT>([^<]*)</.exec(raw) || [])[1] || "", "base64").toString("utf8");
    if (xml.includes(BAD)) {
      badSends += 1;
      return new Response(fault(10012, "Alici bilgisi GIB dogrulamasindan gecmedi"), { status: 500, headers: { "content-type": "text/xml" } });
    }
  }
  return globalThis.fetch(input, init);
};
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-dar2-ekran-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, fetchImpl, edocEnabled: true, testSeriesStart: () => 1, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f45" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
await must("entegratör", api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
const today = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
const day = offset => {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ")[1], taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const bad = (await must("cari", api.post("/api/workspace/accounts", person("Zeynep Şahin", BAD)))).id;
const good = [(await must("cari", api.post("/api/workspace/accounts", person("Ayşe Kaya", "10000000146")))).id, (await must("cari", api.post("/api/workspace/accounts", person("Mehmet Demir", "12345678950")))).id];
const LINE = [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }];
const badDocs = [];
for (let i = 0; i < 20; i += 1) badDocs.push(await must("reddedilecek", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: bad, issueDate: day(-10), lines: LINE, payment: { rest: "open" }, eSend: "later" })));
// İlk tur (API): kötü belgeler numara alır ve "Hata"ya düşer (kuyruğun başında kalır).
for (let i = 0; i < 3; i += 1) await must("ilk tur", api.post("/api/workspace/invoices/send-pending", { all: true }));
const goodDocs = [];
for (let i = 0; i < 30; i += 1) goodDocs.push(await must("bekleyen", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: good[i % 2], issueDate: day(-9 + Math.floor(i / 5)), lines: LINE, payment: { rest: "open" }, eSend: "later" })));
const row = id => app.store.get("SELECT number, issue_date AS issueDate, e_status AS eStatus, ettn FROM invoices WHERE id = ?", id);
// Eski kodda (DEPO) kolon yok: B bölümü return_ref okumayı kolon varsa yapar (kırmızı kanıt A bölümünden okunur).
const hasReturnRef = app.store.all("PRAGMA table_info(invoices)").some(column => column.name === "return_ref");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const modal = ".hof-modal-backdrop.is-visible";
const pageInv = `${modal} .hof-invoices-modal`;
const dialog = ".hof-modal-backdrop.is-visible:last-of-type";
const toasts = () => page.$$eval(".hof-toast", nodes => nodes.map(node => `${node.className}|${node.querySelector(".hof-toast-text")?.textContent || ""}`)).catch(() => []);
const button = `${pageInv} [data-act="send-pending"]`;

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.open);

  console.log("A) B1 — kuyruğun başında 20 reddedilen belge + 30 yeni: Tümünü Gönder bir basışta 30'u gönderir");
  ok(badDocs.every(doc => row(doc.id).eStatus === "error" && /^TEA/.test(row(doc.id).number)), "ön koşul: 20 belge numaralı ve Hata'da");
  const badBefore = badSends;
  await page.evaluate(() => window.HOF.invoices.open({ tab: "pending" }));
  await page.waitForSelector(button);
  ok(/Tümünü Gönder \(50\)/.test(await page.textContent(button)), `düğme 50 belge (${await page.textContent(button)})`);
  await page.click(button);
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  await page.click(`${dialog} [data-answer="yes"]`);
  const finalToast = await page
    .waitForFunction(() => [...document.querySelectorAll(".hof-toast")].map(node => `${node.className}|${node.querySelector(".hof-toast-text")?.textContent || ""}`).find(text => /belge gönderildi/.test(text)) || null, null, { timeout: 60000 })
    .then(handle => handle.jsonValue())
    .catch(() => "");
  ok(/\|30 belge gönderildi; 20 belge gönderilemedi: EDM isteği reddetti: Alici bilgisi GIB dogrulamasindan gecmedi \(EDM hata kodu 10012\)/.test(finalToast), `bitiş bildirimi gönderilen + gönderilemeyen (nedeniyle): ${finalToast}`);
  ok(goodDocs.every(doc => row(doc.id).eStatus === "sent"), "30 yeni belgenin hepsi gönderildi");
  ok(badSends - badBefore === 20, `reddedilen her belge turda bir kez denendi (${badSends - badBefore})`);
  const numbered = goodDocs.map(doc => row(doc.id)).sort((x, y) => Number(x.number.slice(7)) - Number(y.number.slice(7)));
  ok(numbered.every((item, index) => index === 0 || item.issueDate >= numbered[index - 1].issueDate), "numara sırası = tarih sırası");
  ok(goodDocs.every(doc => edm.state.calls.filter(call => call.op === "SendInvoice" && call.raw.includes(row(doc.id).ettn)).length === 1), "her yeni belge EDM'ye bir kez");
  await page.keyboard.press("Escape").catch(() => null);

  console.log("B) MM1 — kâğıt alış faturasının iadesi: e-Belge referansı form açılırken önerilir, onaylanınca iade gönderilir");
  const supplier = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Kâğıtçı Toptan Ltd.", type: "supplier", taxNo: vkn(444555666), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir" }))).id;
  const purchase = await must("kâğıt alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier, issueDate: day(-20), number: "A 004512", profile: "KAGIT", lines: [{ name: "Toner", qty: 4, unitPrice: 500, vatRate: 20, goods: true }], payment: { rest: "open" } }));
  await page.evaluate(id => window.HOF.invoices.open({ originalId: id }), purchase.id);
  const input = `${pageInv} [data-return-ref-input]`;
  await page.waitForSelector(input, { timeout: 15000 });
  ok((await page.inputValue(input)) === "A000000000004512", `alan önerilen değerle açıldı (${await page.inputValue(input)})`);
  const note = await page.textContent(`${pageInv} [data-return-ref-note]`);
  ok(/Asıl faturanın numarası \(A 004512\) 16 karakter değil/.test(note), `uyarı form açılırken görünür (${note})`);
  ok(!/numarasını düzeltin/.test(await page.textContent(pageInv)), "'asıl faturanın numarasını düzeltin' yazmıyor");
  const sendNow = `${pageInv} [data-act="issue-now"]`;
  await page.waitForSelector(sendNow);
  ok(!(await page.$eval(sendNow, node => node.disabled)), "geçerli öneriyle Kaydet ve Gönder etkin");
  // İnsan hızında: alan silinip kısa değer yazılır → pasif + nedeni; sonra doğru değer → etkin (ders 12).
  await page.click(input, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(input, "A0004512", { delay: 40 });
  ok(await page.$eval(sendNow, node => node.disabled), "16 karakter değilken Kaydet ve Gönder pasif");
  ok(await page.$eval(`${pageInv} [data-act="issue-later"]`, node => node.disabled), "Kaydet, Sonra Gönder de pasif");
  const reason = await page.textContent(`${pageInv} [data-return-ref-block]`).catch(() => "");
  ok(/İade Edilen Belge No \(e-Belge Referansı\) 16 karakter olmalı \(şu an 8\); kaydetmek için düzeltin\./.test(reason), `pasif düğmenin nedeni yazılı (${reason})`);
  await page.click(input, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(input, "A000000000004512", { delay: 40 });
  ok(!(await page.$eval(sendNow, node => node.disabled)), "düzeltilince Kaydet ve Gönder etkin");
  ok(await page.$eval(`${pageInv} [data-return-ref-block]`, node => node.hidden).catch(() => true), "neden yazısı kalktı");
  await page.click(sendNow);
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  await page.click(`${dialog} [data-answer="yes"]`);
  const lastReturn = () => app.store.get(`SELECT id, number, ${hasReturnRef ? "return_ref" : "''"} AS returnRef, e_status AS eStatus, profile FROM invoices WHERE kind = 'purchase_return' ORDER BY rowid DESC LIMIT 1`);
  const t0 = Date.now(); // saat: gerçek (bekleme sınırı)
  while (Date.now() - t0 < 20000 && !(lastReturn() && lastReturn().eStatus !== "none")) await sleep(200); // saat: gerçek (bekleme sınırı)
  const saved = Boolean(lastReturn());
  ok(saved, "iade kaydedildi");
  const back = lastReturn();
  ok(back && back.returnRef === "A000000000004512" && back.profile === "EARSIVFATURA" && back.eStatus === "sent" && /^TEA/.test(back.number), `veri tabanı: ${JSON.stringify(back)}`);
  const sent = edm.state.sent.at(-1);
  ok(sent && /<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>A000000000004512<\/cbc:ID>/.test(sent.xml) && /İade edilen fatura: A 004512/.test(sent.xml), "EDM'ye giden UBL: referans + gerçek numara açıklamada");
  ok(row(purchase.id).number === "A 004512", "asıl kayıt değişmedi");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg243-dar2-ekran-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-dar2-ekran: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
