// 2.5.0 Ç7b tur 2d EKRANDAN — KG-7 "KDV İndirim Dönemi" (docs/erp/C7B-FATURA-TASARIM.md §14.5, §14.8 (12)). Gerçek tıklama + klavye (Tab, ok tuşu) + insan hızı (ders 12); sahte saat
// (sunucu ve sayfa, 15.01.2027 — ders 13); lisans servisi yok (ders 30). Kayıttan sonra veri tabanı okunur. Pencere seçicisi en üstteki görünür pencere (ders 39).
//   A) Alış formu: "KDV İndirim Dönemi" açılır listesi görünür; Tedarikçinin Fatura No'dan Tab ile ona gelinir; tarih 31.12.2026 → seçenekler Aralık 2026 (Fatura Ayı) … Aralık 2027 (13 ay);
//      ok tuşuyla "Ocak 2027" seçilir, kaydedilir → veri tabanında vat_period = 2027-01; belge kartında "KDV İndirim Dönemi: Ocak 2027"; Ocak KDV mahsubu ön izlemesinde İ = 400 (elle).
//   B) Tarih değişince: dönem Aralık 2027 seçiliyken tarih 15.12.2025 → seçenekler Aralık 2025 … Aralık 2026; seçili dönem aralık dışı → fatura ayına döner ve görünür yazı söyler.
//   C) Satış formunda alan YOK.
//   D) (tur 2e, B-11) KDV Özeti: A'nın faturası (dönem Şubat 2027) Bu Yıl'da "Şubat 2027 · Alış" satırında; Aralık 2026 satırı yok; TOPLAM = satırlar.
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2027-01-15T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kdv-donemi-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f47" }, startLicenseTimers: false });
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
await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı Kırtasiye", type: "supplier", registeredOn: "2026-12-01" }));
await must("müşteri", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", registeredOn: "2026-12-01" }));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
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
const MODAL = ".hof-modal-backdrop.is-visible";
const pageInv = `${MODAL} .hof-invoices-modal`;
const top = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const count = () => app.store.get("SELECT COUNT(*) AS n FROM invoices WHERE status = 'issued'").n;
let calcs = 0;
page.on("requestfinished", request => {
  if (request.url().includes("/api/workspace/invoices/calc")) calcs += 1;
});
async function settle() {
  let seen = -1;
  for (let round = 0; round < 20 && seen !== calcs; round += 1) {
    seen = calcs;
    await page.waitForTimeout(700);
  }
}
// Ders 34: test her soruyu kendisi yanıtlar ve nedenini yazar.
const answer = async (yes, why) => {
  await page.waitForSelector(`${top} [data-answer="yes"]`);
  const title = ((await page.textContent(`${top} .hof-modal-title, ${top} h2`).catch(() => "")) || "").trim();
  console.log(`    [soru] "${title}" → ${yes ? "Evet" : "Vazgeç"} (${why})`);
  await page.click(`${top} [data-answer="${yes ? "yes" : "no"}"]`);
};
const closeAll = async () => {
  for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (await page.$(`${top} [data-answer="yes"]`)) await answer(true, "adım bitti; kaydedilmemiş deneme formu kapatılıyor (meşru soru)");
  }
};
async function openForm(scenario, who) {
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-scenario="${scenario}"]`);
  await page.waitForSelector(`${pageInv} [data-lines]`);
  await page.click(`${pageInv} [data-acc-query]`);
  await page.keyboard.type(who, { delay: 70 });
  await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
  await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
  await page.waitForTimeout(300);
}
const SELECT = `${pageInv} select[data-f="vatPeriod"]`;
const options = () => page.$$eval(`${SELECT} option`, nodes => nodes.map(node => node.textContent.trim()));
const selected = () => page.$eval(SELECT, node => node.value);
const setDate = async iso => {
  await page.fill(`${pageInv} input[data-f="issueDate"]`, iso);
  await page.dispatchEvent(`${pageInv} input[data-f="issueDate"]`, "change");
  await settle();
};

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.open);

  console.log("A) Alış formu: KDV İndirim Dönemi (Tab, ok tuşu, kayıt, veri tabanı, belge kartı, mahsup ön izlemesi)");
  await openForm("expense_purchase", "Toptancı");
  ok(Boolean(await page.$(SELECT)), "alış formunda 'KDV İndirim Dönemi' açılır listesi var");
  ok((await textOf(`${pageInv} [data-vat-period-field] > span`)) === "KDV İndirim Dönemi", `etiket yazım düzeninde (${await textOf(`${pageInv} [data-vat-period-field] > span`)})`);
  await setDate("2026-12-31");
  const list = await options();
  ok(list.length === 13 && list[0] === "Aralık 2026 (Fatura Ayı)" && list[1] === "Ocak 2027" && list[12] === "Aralık 2027", `seçenekler fatura ayı … izleyen yılın Aralık'ı (${list.length}: ${list[0]} … ${list.at(-1)})`);
  ok((await selected()) === "", "varsayılan: fatura ayı");
  // Tedarikçinin Fatura No → Tab → KDV İndirim Dönemi (DOM sırası); ok tuşuyla bir sonraki ay.
  await page.click(`${pageInv} input[data-f="number"]`);
  await page.keyboard.type("TDR-2026-991", { delay: 70 });
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.dataset?.f || document.activeElement?.tagName);
  ok(focused === "vatPeriod", `Tab ile KDV İndirim Dönemi'ne gelindi (odak: ${focused})`);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  ok((await selected()) === "2027-01", `ok tuşuyla Ocak 2027 seçildi (${await selected()})`);
  await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Kırtasiye", { delay: 50 });
  await page.keyboard.press("Tab");
  await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
  await page.keyboard.type("2000", { delay: 70 });
  await page.keyboard.press("Tab");
  await settle();
  const before = count();
  await page.click(`${pageInv} [data-act="issue"]`);
  if (await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 4000 }).then(() => true).catch(() => false)) await answer(true, "kayıt onayı (belge kaydedilsin) — beklenen soru");
  for (let i = 0; i < 30 && count() === before; i += 1) await page.waitForTimeout(300);
  // Kayıt yanıtı işlenip belge kartı açılana dek (Esc yanıttan önce basılırsa form hâlâ açık — program sorar; insan kartı görünce kapatır).
  await page.waitForFunction(() => !document.querySelector(".hof-modal [data-lines]"));
  const row = app.store.get("SELECT id, issue_date AS d, vat_period AS v, try_vat AS vat FROM invoices WHERE status = 'issued' ORDER BY rowid DESC LIMIT 1");
  ok(count() === before + 1 && row?.d === "2026-12-31" && row?.v === "2027-01" && Number(row?.vat) === 400, `kaydedildi; veri tabanı: tarih ${row?.d}, dönem ${row?.v}, KDV ${row?.vat}`);
  await closeAll();
  // Belge kartı.
  await page.evaluate(id => window.HOF.invoices.open({ id }), row.id);
  await page.waitForTimeout(1200);
  const card = await textOf(`${pageInv}`);
  ok(card.includes("KDV İndirim Dönemi") && card.includes("Ocak 2027"), "belge kartında 'KDV İndirim Dönemi Ocak 2027'");
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "kdv-donemi-kart.png") }).catch(() => null);
  const janBefore = (await must("Ocak ön izleme", api.get("/api/workspace/tax/vat-offset?month=2027-01"))).preview.inMinor;
  const decBefore = (await must("Aralık ön izleme", api.get("/api/workspace/tax/vat-offset?month=2026-12"))).preview.inMinor;
  ok(janBefore === 40000 && decBefore === 0, `mahsup ön izlemesi İ: Aralık ${decBefore / 100}, Ocak ${janBefore / 100} (elle 0 / 400)`);
  // Düzenle: form dönemle dolu açılır; Şubat 2027'ye alınıp kaydedilir (veri tabanı okunur).
  await page.click(`${pageInv} [data-act="modify"]`);
  await page.waitForSelector(SELECT);
  ok((await selected()) === "2027-01", `Düzenle formu dönemle dolu (${await selected()})`);
  await page.focus(SELECT);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  ok((await selected()) === "2027-02", `Şubat 2027 seçildi (${await selected()})`);
  await settle();
  await page.click(`${pageInv} [data-act="issue"]`);
  if (await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 4000 }).then(() => true).catch(() => false)) await answer(true, "düzenleme kayıt onayı — beklenen soru");
  for (let i = 0; i < 30 && app.store.get("SELECT vat_period AS v FROM invoices WHERE id = ?", row.id).v !== "2027-02"; i += 1) await page.waitForTimeout(300);
  // Kayıt yanıtı işlenip belge kartı açılana dek (Esc yanıttan önce basılırsa form hâlâ açık — program sorar; insan kartı görünce kapatır).
  await page.waitForFunction(() => !document.querySelector(".hof-modal [data-lines]"));
  ok(app.store.get("SELECT vat_period AS v FROM invoices WHERE id = ?", row.id).v === "2027-02", "Düzenle kaydedildi: veri tabanında dönem 2027-02");
  await closeAll();
  const inOf = async month => (await must(`ön izleme ${month}`, api.get(`/api/workspace/tax/vat-offset?month=${month}`))).preview.inMinor;
  const [dec, jan, feb] = [await inOf("2026-12"), await inOf("2027-01"), await inOf("2027-02")];
  ok(dec === 0 && jan === 0 && feb === 40000, `mahsup ön izlemesi İ: Aralık ${dec / 100}, Ocak ${jan / 100}, Şubat ${feb / 100} (elle 0 / 0 / 400)`);

  console.log("B) Tarih değişince seçenekler yeniden kurulur; aralık dışı dönem fatura ayına döner (görünür yazı)");
  await openForm("expense_purchase", "Toptancı");
  await setDate("2026-12-31");
  await page.selectOption(SELECT, "2027-12");
  await page.waitForTimeout(300);
  ok((await selected()) === "2027-12", "Aralık 2027 seçildi");
  await setDate("2025-12-15");
  const list2 = await options();
  ok(list2[0] === "Aralık 2025 (Fatura Ayı)" && list2.at(-1) === "Aralık 2026" && list2.length === 13, `yeni aralık (${list2[0]} … ${list2.at(-1)})`);
  ok((await selected()) === "", "seçili dönem fatura ayına döndü");
  const note = await textOf(`${pageInv} [data-vat-period-note]`);
  ok(/aralığında değil; KDV İndirim Dönemi fatura ayına alındı/.test(note) && note.includes("Aralık 2027"), `görünür yazı: ${note}`);
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "kdv-donemi-tarih.png") }).catch(() => null);
  await closeAll();

  console.log("C) Satış formunda alan yok");
  await openForm("service_sale", "Ayşe");
  ok(!(await page.$(SELECT)), "satış formunda KDV İndirim Dönemi YOK");
  await closeAll();

  // 2.5.0 Ç7b tur 2e (B-11 = A; C7B-FATURA-TASARIM §15.1): KDV Özeti (Beyanname Hazırlığı) alış KDV'sini KDV İndirim Dönemi'nin ayında gösterir. A'nın faturası (31.12.2026, dönem Şubat
  // 2027 — Düzenle'den sonra) ilk açılışta (Bu Yıl = 2027) "Şubat 2027 · Alış" satırında; Aralık 2026 satırı yok (elle: KDV 400, matrah 2.000).
  console.log("D) KDV Özeti: dönemi ileri alınan alış faturası dönem ayında (ekranda)");
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`, { timeout: 15000 });
  await page.click(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`);
  await page.waitForFunction(sel => {
    const main = document.querySelector(`${sel} [data-rc-main]`);
    return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table, .hof-rc-summary, .hof-empty") && !/Rapor hazırlanıyor/.test(main.innerText);
  }, MODAL, { timeout: 15000 });
  const cells = selector => page.$$eval(selector, rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent.trim())));
  const body = await cells(`${MODAL} [data-rc-main] .hof-rc-table tbody tr`);
  const foot = await cells(`${MODAL} [data-rc-main] .hof-rc-table tfoot tr`);
  const digits = text => String(text || "").replace(/[^\d,]/g, "");
  ok(body.length === 1 && body[0][0] === "Şubat 2027" && body[0][1] === "Alış" && digits(body[0][4]) === "2000,00" && digits(body[0][5]) === "400,00", `KDV Özeti satırı Şubat 2027 · Alış · 2.000 / 400 (${JSON.stringify(body)})`);
  ok(!body.some(row => row[0] === "Aralık 2026"), "Aralık 2026 satırı yok (belge ayı değil, dönem ayı)");
  ok(foot.length === 1 && digits(foot[0][5]) === "400,00", `TOPLAM satırı = satırlar (${JSON.stringify(foot)})`);
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "kdv-ozeti-donem.png") }).catch(() => null);
  await closeAll();
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "kdv-donemi-hata.png"), fullPage: true }).catch(() => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-kdv-donemi-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
