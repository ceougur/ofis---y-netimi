// 2.4.2 EKRANDAN (kullanıcı denemesi 17.10.2026, gerçek EDM test ortamında yaşanan akış; burada sahte EDM — gerçek EDM'ye istek gitmez):
//   1 e-Fatura / e-Arşiv işaretleri kapalıyken satış faturası kâğıt belgedir: formda "Kaydet ve Gönder" YOK, "Kaydet" var; onayda "entegratöre" yazmaz
//     (2.4.1'de düğmeler form açılırken çiziliyor, belge türü hesaplanınca yenilenmiyordu → FIS numaralı belge "gönderilir" diye kaydedildi).
//   2 İşaretler açılınca aynı form e-Arşiv: "Kaydet ve Gönder" görünür; numara TEA ve 1'den başlamaz (EDM test hesabı ortak).
//   3 Numara EDM'de başkasınca kullanılmışsa (11048) kartta yol gösteren ileti; İptal Et belgeyi iptal eder (EDM'de yok, 11017).
//   4 Entegratör Ayarları → Otomatik Seriler'de "Test Ortamında Sıradaki No" ileri alınır, kaydedilir.
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-ebelge-242-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const edm = await startMockEdm();
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "" };
// Üretimdeki gibi (server/server.mjs): e-Belge açık; test serisi başlangıcı verilmez (rastgele büyük).
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", edocEnabled: true, edocLive: true, env: NO_ENV_PROXY });
const admin = await server.login();
const BASE = server.base;
const year = new Date().getFullYear();
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("firma (işaretler kapalı)", admin.put("/api/workspace/invoices/settings", {
  seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
  integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
}));
await must("cari", admin.post("/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka" }));
const row = id => server.app.store.get("SELECT number, status, e_status AS eStatus, e_message AS eMessage, profile FROM invoices WHERE id = ?", id);
const seqOf = number => Number(String(number).slice(7));

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

async function newSale(page) {
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-scenario="service_sale"]`);
  await page.waitForSelector(`${pageInv} [data-lines]`);
  await page.click(`${pageInv} [data-acc-query]`);
  await page.keyboard.type("Ayşe", { delay: 60 });
  await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
  await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
  await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Danışmanlık", { delay: 40 });
  await page.keyboard.press("Tab");
  await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
  await page.keyboard.type("935", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1500);
}
async function confirmSave(page) {
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  const message = await textOf(page, dialog);
  const label = await textOf(page, `${dialog} [data-answer="yes"]`);
  await page.click(`${dialog} [data-answer="yes"]`);
  return { message, label };
}
const closeAll = async page => {
  for (let index = 0; index < 5 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) await yes.click();
  }
};
const lastId = () => server.app.store.get("SELECT id FROM invoices ORDER BY rowid DESC LIMIT 1")?.id;

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

  console.log("■ 1 İşaretler kapalı: kâğıt belge, “Kaydet ve Gönder” yok");
  await newSale(page);
  ok(!(await page.$(`${pageInv} [data-act="issue-now"]`)) && !(await page.$(`${pageInv} [data-act="issue-later"]`)), "kâğıt belgede “Kaydet ve Gönder” / “Kaydet, Sonra Gönder” yok");
  ok(Boolean(await page.$(`${pageInv} [data-act="issue"]`)), "“Kaydet” düğmesi var");
  await shot(page, "ebelge-242-1-kagit-form");
  await page.click(`${pageInv} [data-act="issue"]`);
  const paper = await confirmSave(page);
  ok(/FIS\d{13}/.test(paper.message) && !/entegratör/i.test(paper.message) && !/Gönder/.test(paper.label), `onay: “${paper.label}” · ${paper.message.slice(0, 90)}…`);
  await page.waitForTimeout(800);
  const paperDoc = row(lastId());
  ok(paperDoc.profile === "KAGIT" && /^FIS/.test(paperDoc.number) && !edm.state.sent.length, `kâğıt belge kaydedildi, EDM'ye gitmedi (${paperDoc.number})`);
  await closeAll(page);

  console.log("\n■ 2 İşaretler açık: e-Arşiv, test numarası 1'den başlamaz");
  await must("işaretler", admin.put("/api/workspace/invoices/settings", { efatura: true, earsiv: true }));
  await page.reload();
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
  await newSale(page);
  ok(Boolean(await page.$(`${pageInv} [data-act="issue-now"]`)), "e-Arşivde “Kaydet ve Gönder” görünür");
  await page.click(`${pageInv} [data-act="issue-now"]`);
  const sent = await confirmSave(page);
  const number = (/TEA\d{13}/.exec(sent.message) || [""])[0];
  ok(number && seqOf(number) > 100_000_000, `onaydaki numara ${number} (1'den değil)`);
  for (let index = 0; index < 40 && !edm.state.sent.length; index += 1) await page.waitForTimeout(250);
  ok(edm.state.sent.at(-1)?.id === number, `EDM'ye bu numarayla gitti (${edm.state.sent.at(-1)?.id})`);
  await closeAll(page);

  console.log("\n■ 2b Fiyatı değiştirip HEMEN düğmeye basmak (gözden geçirme 2.4.2: düğmeler her hesaplamada yeniden çizilip tıklama kayboluyordu)");
  for (let trial = 1; trial <= 3; trial += 1) {
    await newSale(page);
    await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
    await page.keyboard.type(String(940 + trial), { delay: 60 });
    await page.click(`${pageInv} [data-act="issue-now"]`, { delay: 120 });
    const opened = await page.waitForSelector(`${dialog} [data-answer="yes"]`, { timeout: 2500 }).then(() => true).catch(() => false);
    ok(opened, `deneme ${trial}: onay penceresi açıldı (tıklama kaybolmadı)`);
    await closeAll(page);
  }
  await newSale(page);
  await page.focus(`${pageInv} [data-act="issue-now"]`);
  await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
  await page.keyboard.type("950", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.focus(`${pageInv} [data-act="issue-now"]`);
  await page.waitForTimeout(1200);
  const focused = await page.evaluate(() => document.activeElement?.dataset?.act || document.activeElement?.tagName);
  ok(focused === "issue-now", `hesaplamadan sonra klavye odağı düğmede kalır (${focused})`);
  await closeAll(page);

  console.log("\n■ 3 Numara EDM'de başkasınca kullanılmış (11048): ileti + İptal Et");
  const next = (await must("ayarlar", admin.get("/api/workspace/invoices/settings"))).testNumbers.earsiv.number;
  edm.state.usedIds.add(next);
  await newSale(page);
  await page.click(`${pageInv} [data-act="issue-now"]`);
  await confirmSave(page);
  await page.waitForTimeout(1500);
  const clashId = lastId();
  const clash = row(clashId);
  ok(clash.number === next && clash.eStatus === "error" && /11048/.test(clash.eMessage) && /ortak/.test(clash.eMessage), `Hata + ileti: ${String(clash.eMessage).slice(-150)}`);
  await closeAll(page);
  await page.evaluate(id => window.HOF.invoices.openDoc(id), clashId);
  await page.waitForSelector(`${modal} [data-act="cancel"]`);
  await shot(page, "ebelge-242-3-hata-kart");
  await page.click(`${modal} [data-act="cancel"]`);
  await page.waitForSelector(`${dialog} input[name="reason"]`);
  await page.click(`${dialog} input[name="reason"]`);
  await page.keyboard.type("Numara çakıştı", { delay: 40 });
  await page.click(`${dialog} button[type="submit"]`);
  for (let index = 0; index < 40 && row(clashId).status !== "cancelled"; index += 1) await page.waitForTimeout(250);
  const after = row(clashId);
  ok(after.status === "cancelled" && /yalnız programda iptal/.test(after.eMessage), `İptal Et çalıştı (${after.status}; ${after.eMessage})`);
  await shot(page, "ebelge-242-3-iptal");
  await closeAll(page);

  console.log("\n■ 5 Test belgeleri kesildikten sonra Fatura Ayarları kaydedilir (kontrol turu K1: tam başlangıç haritası 400 alıyordu)");
  const before5 = (await must("ayarlar", admin.get("/api/workspace/invoices/settings"))).testNumbers.earsiv.number;
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="settings"]`);
  await page.click(`${pageInv} [data-act="settings"]`);
  await page.waitForSelector(`${pageInv} [data-s="defaults.dueDays"]`);
  await page.click(`${pageInv} [data-s="defaults.dueDays"]`, { clickCount: 3 });
  await page.keyboard.type("15", { delay: 50 });
  await page.keyboard.press("Tab");
  await page.click(`${pageInv} [data-act="save-settings"]`);
  await page.waitForTimeout(1500);
  const after5 = (await must("ayarlar", admin.get("/api/workspace/invoices/settings")));
  ok(Number(after5.defaults.dueDays) === 15, `Fatura Ayarları kaydedildi (Vade Günü ${after5.defaults.dueDays})`);
  ok(after5.testNumbers.earsiv.number === before5, `test başlangıcı değişmedi (${after5.testNumbers.earsiv.number})`);
  console.log("\n■ 4 Otomatik Seriler: Test Ortamında Sıradaki No");
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="integrator"]`);
  await page.click(`${pageInv} [data-act="integrator"]`);
  await page.click(`${modal} [data-integ-tab="series"]`);
  const field = `${modal} [data-i-test-start="TEA${year}"]`;
  await page.waitForSelector(field);
  const current = Number(await page.$eval(field, node => node.value));
  ok(current > 100_000_000, `alan sıradaki test numarasını gösterir (${current})`);
  await page.click(field, { clickCount: 3 });
  await page.keyboard.type(String(current + 500), { delay: 40 });
  await page.keyboard.press("Tab");
  await page.click(`${modal} [data-integ-act="save"]`);
  await page.waitForTimeout(1200);
  const saved = (await must("ayarlar", admin.get("/api/workspace/invoices/settings"))).testNumbers;
  ok(seqOf(saved.earsiv.number) === current + 500, `kaydedildi: ${saved.earsiv.number}`);
  ok(seqOf(saved.efatura.number) > 100_000_000, `öbür test serisi korunur: ${saved.efatura.number}`);
  await shot(page, "ebelge-242-4-seriler");
  await closeAll(page);

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
