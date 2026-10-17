// 2.4.3 EKRANDAN (kullanıcının EDM test denemesi 17.10.2026 — TESTER, şahıs TCKN 12345678950, cari kartında elle "e-Fatura mükellefi"; burada sahte EDM):
//   1 Posta kutusu seçilmemiş e-Fatura carisinde form uyarır; "Kaydet ve Gönder" numara harcamadan durur, belge yazılmaz (2.4.2: TEF numarası verilip
//     gönderimde düşüyordu).
//   2 Cari kartında "e-Fatura mükellefi" elle işaretlenmez (yalnız Mükellef Sorgula); tıklayınca işaret değişmez, yol gösteren ileti çıkar.
//   3 Mükellef Sorgula "mükellef değil" der → işaret kalkar → aynı fatura e-Arşiv (TEA) olarak kaydedilip gönderilir.
//   4 Numara almış e-Fatura Düzenle'de e-Arşive çevrilemez (2.4.2: TEF numaralı e-Arşiv oluyordu).
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-ebelge-243-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const edm = await startMockEdm();
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "" };
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", edocEnabled: true, edocLive: true, env: NO_ENV_PROXY });
const admin = await server.login();
const BASE = server.base;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("firma", admin.put("/api/workspace/invoices/settings", {
  seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
  efatura: true,
  earsiv: true,
  integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
}));
// 2.4.2'de elle işaretlenmiş hâli (API ile; 2.4.3 ekranı artık elle işaretletmez).
const TESTER = { name: "TESTER", type: "customer", partyKind: "person", firstName: "Testler", familyName: "Testlerle", taxNo: "12345678950", taxOffice: "TESTER", address: "test sok. no:36", district: "Kemalpaşa", city: "Samsun", eInvoice: true, eAlias: "" };
const tester = await must("cari", admin.post("/api/workspace/accounts", TESTER));
const row = id => server.app.store.get("SELECT number, status, e_status AS eStatus, profile FROM invoices WHERE id = ?", id);
const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
const lastId = () => server.app.store.get("SELECT id FROM invoices ORDER BY rowid DESC LIMIT 1")?.id;
const flagOf = () => Number(server.app.store.get("SELECT e_invoice AS f FROM accounts WHERE id = ?", tester.id)?.f);

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
const pageInv = `${modal} .hof-invoices-modal`;
const dialog = ".hof-modal-backdrop.is-visible:last-of-type";
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const toasts = page => page.$$eval(".hof-toast-text", nodes => nodes.map(node => node.textContent)).catch(() => []);

async function newSale(page) {
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-scenario="service_sale"]`);
  await page.waitForSelector(`${pageInv} [data-lines]`);
  await page.click(`${pageInv} [data-acc-query]`);
  await page.keyboard.type("TESTER", { delay: 60 });
  await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
  await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
  await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Hizmet Satışı", { delay: 40 });
  await page.keyboard.press("Tab");
  await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
  await page.keyboard.type("869", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1500);
}
const closeAll = async page => {
  for (let index = 0; index < 5 && (await page.$(modal)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) await yes.click();
  }
};

try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });

  console.log("■ 1 Posta kutusu seçilmemiş e-Fatura carisi: form uyarır, Kaydet ve Gönder numara harcamaz");
  await newSale(page);
  const warn = await textOf(page, `${pageInv} .hof-inv-problems`);
  ok(/posta kutusu \(PK\) seçilmemiş/.test(warn) && /Mükellef Sorgula/.test(warn), `formda uyarı: ${warn.slice(0, 120)}…`);
  await shot(page, "ebelge-243-1-uyari");
  const before = count();
  await page.click(`${pageInv} [data-act="issue-now"]`);
  const confirm = await page.waitForSelector(`${dialog} [data-answer="yes"]`, { timeout: 4000 }).then(() => true).catch(() => false);
  if (confirm) await page.click(`${dialog} [data-answer="yes"]`);
  await page.waitForTimeout(1500);
  const said = (await toasts(page)).join(" | ");
  ok(count() === before, `belge yazılmadı (${before} → ${count()})`);
  ok(/numara harcanmadı/.test(said), `ileti: ${said.slice(0, 160)}`);
  ok(!edm.state.sent.length, "EDM'ye bir şey gitmedi");
  await closeAll(page);

  console.log("\n■ 2 Cari kartında e-Fatura işareti elle değişmez");
  await page.evaluate(() => window.HOF.accounts.newFor({}));
  await page.waitForSelector(`${dialog} input[name="eInvoice"]`);
  const label = await page.$eval(`${dialog} input[name="eInvoice"]`, node => node.closest("label")?.textContent.replace(/\s+/g, " ").trim() || "");
  ok(/Mükellef Sorgula belirler/.test(label) && /e-Arşiv/.test(label), `kutu metni: ${label}`);
  await page.click(`${dialog} input[name="eInvoice"]`);
  await page.waitForTimeout(300);
  const ticked = await page.$eval(`${dialog} input[name="eInvoice"]`, node => node.checked);
  ok(!ticked, "tıklayınca işaretlenmedi");
  ok((await toasts(page)).some(text => /elle işaretlenmez/.test(text)), "yol gösteren ileti çıktı");
  await page.focus(`${dialog} input[name="eInvoice"]`);
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  ok(!(await page.$eval(`${dialog} input[name="eInvoice"]`, node => node.checked)), "boşluk tuşuyla da işaretlenmedi");
  // Gözden geçirme B6: işareti KALDIRMAK serbest (EDM'ye ulaşılamazken yanlış işaret kilitli kalmasın).
  await page.evaluate(selector => { document.querySelector(selector).checked = true; }, `${dialog} input[name="eInvoice"]`);
  await page.click(`${dialog} input[name="eInvoice"]`);
  ok(!(await page.$eval(`${dialog} input[name="eInvoice"]`, node => node.checked)), "işaretli kutu elle kaldırılabilir");
  await shot(page, "ebelge-243-2-kutu");
  await closeAll(page);

  console.log("\n■ 3 Mükellef Sorgula işareti kaldırır → aynı fatura e-Arşiv (TEA)");
  // Kartta Mükellef Sorgula düğmesinin yolu senaryo-entegrator-240'ta ekrandan koşulur; burada sorgunun sonucu ve işaretin etkisi.
  const check = await must("mükellef sorgusu", admin.post("/api/workspace/invoices/check-user", { taxNo: TESTER.taxNo }));
  ok(check.registered === false, `sahte EDM: ${TESTER.taxNo} mükellef değil`);
  await must("işaret kalkar", admin.put(`/api/workspace/accounts/${tester.id}`, { ...TESTER, eInvoice: false, eAlias: "" }));
  ok(flagOf() === 0, "cari kartında işaret kalktı");
  await newSale(page);
  ok(!/posta kutusu/.test(await textOf(page, `${pageInv} .hof-inv-problems`)), "uyarı kalktı");
  await page.click(`${pageInv} [data-act="issue-now"]`);
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  const message = await textOf(page, dialog);
  await page.click(`${dialog} [data-answer="yes"]`);
  for (let index = 0; index < 40 && !edm.state.sent.length; index += 1) await page.waitForTimeout(250);
  const archive = row(lastId());
  ok(/TEA\d{13}/.test(message) && archive.profile === "EARSIVFATURA" && /^TEA/.test(archive.number), `e-Arşiv kaydedildi (${archive.number})`);
  ok(edm.state.sent.at(-1)?.id === archive.number, `EDM'ye gitti (${edm.state.sent.at(-1)?.id})`);
  await closeAll(page);

  console.log("\n■ 4 Numara almış e-Fatura Düzenle'de e-Arşive çevrilemez");
  const firm = await must("mükellef cari", admin.post("/api/workspace/accounts", { name: "Sonradan Değişen A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Kavaklıdere", address: "Cinnah 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@degisen.com.tr" }));
  const efatura = await must("e-Fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: firm.id, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
  const issued = await must("numara", admin.post(`/api/workspace/invoices/${efatura.id}/send`, {}));
  ok(/^TEF/.test(row(efatura.id).number), `e-Fatura numarası ${row(efatura.id).number} (${issued.status || issued.eStatus || ""})`);
  // Gönderilmiş belge zaten düzenlenmez; numarası olup gönderilmemiş belge için düz Kaydet (gönderim yok) yolu:
  const plain = await must("e-Fatura (düz kaydet)", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: firm.id, lines: [{ name: "Hizmet", qty: 1, unitPrice: 200, vatRate: 20 }], payment: { rest: "open" } }));
  await must("işaret kalkar", admin.put(`/api/workspace/accounts/${firm.id}`, { name: "Sonradan Değişen A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Kavaklıdere", address: "Cinnah 10", district: "Çankaya", city: "Ankara", eInvoice: false, eAlias: "" }));
  const full = await must("kart", admin.get(`/api/workspace/invoices/${plain.id}`));
  const edit = await admin.post(`/api/workspace/invoices/${plain.id}/edit`, { kind: full.kind, scenario: full.scenario, accountId: firm.id, issueDate: full.issueDate, profile: "EARSIVFATURA", lines: [{ name: "Hizmet", qty: 1, unitPrice: 200, vatRate: 20 }], payment: { rest: "open" } });
  const editBody = edit.data?.ok === false ? edit.data : edit.data;
  ok(edit.status === 409 && /İptal Et/.test(JSON.stringify(editBody)), `Düzenle reddedildi (${edit.status}): ${JSON.stringify(editBody).slice(0, 160)}`);
  ok(row(plain.id).profile === "TEMELFATURA" && /^TEF/.test(row(plain.id).number), `belge değişmedi (${row(plain.id).number} ${row(plain.id).profile})`);
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error}`);
} finally {
  await browser.close();
  await server.close();
  await edm.close();
  console.log(`\n${passed} geçti, ${failed} kaldı`);
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
