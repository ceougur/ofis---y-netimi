// 2.4.5 madde 6 EKRANDAN — cari borç vadesi (docs/2.4.5-IS-LISTESI.md BAŞ MİMAR KARARLARI S1, K6.1–K6.3):
//   V1 cari kartında Borç Yaz: tutar insan hızında + Tab, Vade Tarihi → veri tabanında due_date; Hareketler'de "Vade … · Kalan …".
//   V2 Tahsilat Takvimi şeridinde ve zilde kalem ("Tahsil Edilecek Borç", tutar = Kalan).
//   V3 Düzelt (✎) → Beklenen Ödeme Tarihi → kalem o güne kayar, "(Ödeme Sözü)".
//   V4 + Tahsilat (kısmi, insan hızında) → kalem tutarı küçülür; Hareketler'de Kalan.
//   V5 yalnız Vade Tarihi yazılmış Borç Yaz formu Esc'te "Kaydedilmemiş Değişiklik" sorar (ders 34: soru BEKLENİR); hiçbir şey yazılmaz.
//   V6 Vade Tarihi kaydın tarihinden önce → form açık kalır, ileti görünür, hiçbir şey yazılmaz.
//   V7 Yeni Cari: Açılış Bakiyesi + Vade Tarihi → açılış satırında due_date; şeritte kalem. Düzenle'de açılış tarihleri dolu gelir.
// Pil kartının düğmeleri (Cariyi Aç / Tahsilat Gir) 6a'nın (pil-karti) senaryosundadır; burada pile tıklanmaz.
// Sahte durağan saat (ders 13): sunucu ve tarayıcı 20.10.2026'da durur. Pencere seçicisi ders 39.
// Çıkış: "N geçti, M kaldı" (kaldıysa çıkış kodu 1).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";
import { createClock } from "../../server/lib/clock.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-cari-vade-245-"));
const shots = process.env.EKRAN_DIR || root;
const TODAY = "2026-10-20";
const clock = createClock({ time: `${TODAY}T12:00:00+03:00`, fixed: true });
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const dmy = iso => iso.split("-").reverse().join(".");
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
// K1.2 (aday 1): 2.4.5 davranışını sınayan senaryo — kayıt tahsilatı ve Tablodan Aktar üretim varsayılanında (kapalı); bootVersion güncel kodda ikisini açar.
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false });
const api = await server.login();
const db = server.app.store;
const one = (sql, ...args) => db.get(sql, ...args);

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const shot = name => page?.screenshot({ path: path.join(shots, `cari-vade-245-${name}.png`) }).catch(() => null);
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const ACC = `${MODAL} .hof-accounts-modal`;
const closeAll = async () => {
  for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 2)}`);
    await closeAll().catch(() => null);
  }
};
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const typeSlow = async text => {
  for (const ch of text) await page.keyboard.type(ch, { delay: 45 });
};
const typeAmount = async text => {
  await page.click(`${TOP} input[name="amount"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await typeSlow(text);
  await page.keyboard.press("Tab");
};
// Pencere açılınca okuma is-visible beklemesinden sonra (ders 39).
const waitForm = async name => {
  await page.waitForSelector(`${TOP} input[name="${name}"]`);
  await page.waitForTimeout(150);
};
const pills = name => page.evaluate(person => [...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].filter(node => node.querySelector("b")?.textContent.startsWith(person)).map(node => node.innerText.replace(/\s+/g, " ")), name);
const waitPill = (name, pattern) =>
  page
    .waitForFunction(([person, source]) => [...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].some(node => node.querySelector("b")?.textContent.startsWith(person) && new RegExp(source).test(node.innerText.replace(/\s+/g, " "))), [name, pattern.source], { timeout: 12000 })
    .then(() => true)
    .catch(() => false);
// Tarih kutusuna gerçek klavyeyle yazım: başsız Chromium'un tarih kutusu (sayfa dili tr-TR olsa da) ay/gün/yıl sırası bekler (denendi: gün.ay.yıl
// sırası "102026-02-05" yazar). Boş kutuya odaklanıp harf harf yazılır; sonuç okunup adımda denetlenir.
const typeDate = async (selector, iso) => {
  const [y, m, d] = iso.split("-");
  await page.focus(selector);
  await typeSlow(`${m}${d}${y}`);
  return page.$eval(selector, node => node.value);
};
const dueNote = entryId => textOf(`${ACC} [data-entry-due="${entryId}"]`);

// ---------- Veri (programın kendi uçları) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
for (let index = 0; index < 3; index += 1) await must(`kayıt ${index}`, api.post("/api/workspace/records", { values: { "DOSYA NO": `2026/${500 + index}`, BORÇLU: `Kişi ${index}`, TELEFON: `0533 000 05 0${index}` }, caseKey: `2026/${500 + index}` }));
const customer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Vade Müşteri", phone: "0532 245 00 01", type: "customer", registeredOn: day(-60) }));
const entriesOf = id => db.all("SELECT id, kind, amount, date, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE account_id = ? ORDER BY rowid", id);
const dues = async () => (await must("takvim", api.get("/api/workspace/dues"))).items.filter(item => item.source === "account");

const browser = await chromium.launch();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, clock);
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.accounts?.open && window.HOF?.dues), null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });
  await page.waitForTimeout(600);
  const openCard = async () => {
    await page.evaluate(id => window.HOF.accounts.open(id), customer.id);
    await page.waitForSelector(`${ACC} [data-entry="debt"]`);
    await page.waitForTimeout(300);
  };
  let debtId = "";

  await step("V1 Borç Yaz: tutar insan hızında + Tab, Vade Tarihi → due_date; Hareketler'de Vade ve Kalan", async () => {
    await openCard();
    await page.click(`${ACC} [data-entry="debt"]`);
    await waitForm("amount");
    ok(Boolean(await page.$(`${TOP} input[name="dueDate"]`)) && Boolean(await page.$(`${TOP} input[name="expectedDate"]`)), "Borç Yaz formunda Vade Tarihi ve Beklenen Ödeme Tarihi alanları");
    const labels = await page.$$eval(`${TOP} label, ${TOP} .hof-field > span, ${TOP} .hof-field-label`, nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    ok(labels.some(text => text.startsWith("Vade Tarihi")) && labels.some(text => text.startsWith("Beklenen Ödeme Tarihi")), `alan adları yazım düzeninde: ${labels.filter(text => /Tarih/.test(text)).join(" | ").slice(0, 160)}`);
    await typeAmount("1250");
    ok((await typeDate(`${TOP} input[name="dueDate"]`, day(3))) === day(3), "Vade Tarihi klavyeyle yazıldı");
    await page.fill(`${TOP} input[name="note"]`, "Ekim hizmet bedeli");
    await shot("v1-form");
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(800);
    const rows = entriesOf(customer.id);
    const debt = rows.find(row => row.kind === "debt");
    debtId = debt?.id || "";
    ok(rows.length === 1 && debt?.amount === 1250 && debt?.dueDate === day(3) && debt?.expectedDate === "" && debt?.date === TODAY, `veri tabanı: ${JSON.stringify(rows.map(row => ({ ...row, id: undefined })))}`);
    const note = await dueNote(debtId);
    ok(note === `Vade ${dmy(day(3))} · Kalan ₺1.250,00`, `Hareketler'de: “${note}”`);
    await shot("v1-kart");
  });

  await step("V2 Tahsilat Takvimi şeridinde ve zilde kalem (Tahsil Edilecek Borç, Kalan)", async () => {
    await closeAll();
    ok(await waitPill("Vade Müşteri", /Tahsil Edilecek Borç · 23\.10\.2026 · ₺?1\.250,00/), `şeritte: ${JSON.stringify(await pills("Vade Müşteri"))}`);
    const item = (await dues()).find(row => row.entryId === debtId);
    ok(item?.id === `account|${debtId}` && item?.amount === 1250 && item?.state === "upcoming" && item?.days === 3, `takvim kalemi: ${JSON.stringify(item && { id: item.id, amount: item.amount, state: item.state, days: item.days })}`);
    await page.click(".topbar .top-actions > .icon-button");
    await page.waitForSelector(".hof-alert-list");
    const bell = await page.evaluate(() => [...document.querySelectorAll(".hof-alert-list li")].map(node => node.textContent.replace(/\s+/g, " ")));
    ok(bell.some(text => text.includes("Vade Müşteri") && text.includes("Tahsil Edilecek Borç")), `zilde: ${JSON.stringify(bell.filter(text => text.includes("Vade")).slice(0, 2))}`);
    await shot("v2-zil");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  await step("V3 Düzelt → Beklenen Ödeme Tarihi: kalem o güne kayar, \"(Ödeme Sözü)\"", async () => {
    await openCard();
    await page.click(`${ACC} [data-edit-entry="${debtId}"]`);
    await waitForm("expectedDate");
    ok((await page.$eval(`${TOP} input[name="dueDate"]`, node => node.value)) === day(3), "düzeltme formunda Vade Tarihi dolu");
    ok((await typeDate(`${TOP} input[name="expectedDate"]`, day(1))) === day(1), "Beklenen Ödeme Tarihi klavyeyle yazıldı");
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForSelector(`${TOP} input[name="expectedDate"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(800);
    const debt = entriesOf(customer.id).find(row => row.id === debtId);
    ok(debt?.dueDate === day(3) && debt?.expectedDate === day(1) && debt?.amount === 1250, `veri tabanı: vade ${debt?.dueDate}, beklenen ${debt?.expectedDate}, tutar ${debt?.amount}`);
    ok((await dueNote(debtId)) === `Vade ${dmy(day(3))} · Beklenen Ödeme ${dmy(day(1))} · Kalan ₺1.250,00`, `Hareketler'de: “${await dueNote(debtId)}”`);
    await closeAll();
    ok(await waitPill("Vade Müşteri", /Tahsil Edilecek Borç \(Ödeme Sözü\) · 21\.10\.2026 · ₺?1\.250,00/), `şeritte o güne kaydı: ${JSON.stringify(await pills("Vade Müşteri"))}`);
  });

  await step("V4 + Tahsilat (kısmi): kalem tutarı küçülür; Hareketler'de Kalan", async () => {
    await openCard();
    await page.click(`${ACC} [data-entry="in"]`);
    await waitForm("amount");
    // "+ Tahsilat" önce Taksite Yaz / Taksit Dışı sorabilir (kartı yok: doğrudan form); form başlığı Tahsilat.
    await typeAmount("500");
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(800);
    const paid = entriesOf(customer.id).filter(row => row.kind === "in");
    ok(paid.length === 1 && paid[0].amount === 500 && paid[0].dueDate === "" && paid[0].expectedDate === "", `tahsilat 500, tarih alanı yok: ${JSON.stringify(paid.map(row => ({ amount: row.amount, dueDate: row.dueDate })))}`);
    ok((await dueNote(debtId)).endsWith("Kalan ₺750,00"), `Hareketler'de: “${await dueNote(debtId)}”`);
    await closeAll();
    ok(await waitPill("Vade Müşteri", /\(Ödeme Sözü\) · 21\.10\.2026 · ₺?750,00/), `şeritte 750,00: ${JSON.stringify(await pills("Vade Müşteri"))}`);
    const item = (await dues()).find(row => row.entryId === debtId);
    ok(item?.amount === 750 && item?.partial === true, `takvim kalemi 750 (kısmen): ${JSON.stringify(item && { amount: item.amount, partial: item.partial })}`);
  });

  await step("V5 yalnız Vade Tarihi yazılmış Borç Yaz formu Esc'te sorar; hiçbir şey yazılmaz", async () => {
    const before = entriesOf(customer.id).length;
    await openCard();
    await page.click(`${ACC} [data-entry="debt"]`);
    await waitForm("dueDate");
    // Gerçek klavye (ders 12; programın "dokunulmuş alan" izi yalnız kullanıcı olayıyla).
    const typed = await typeDate(`${TOP} input[name="dueDate"]`, day(5));
    ok(typed === day(5), `Vade Tarihi klavyeyle yazıldı: ${typed}`);
    let asked = true;
    try {
      await escClose(page, { expect: "soru-var", step: "V5" });
    } catch {
      asked = false;
    }
    ok(asked, "Kaydedilmemiş Değişiklik soruldu (Kaydetmeden Kapat ile kapandı)");
    await page.waitForTimeout(400);
    ok(entriesOf(customer.id).length === before, `hiçbir satır yazılmadı (${before} → ${entriesOf(customer.id).length})`);
    await closeAll();
  });

  await step("V6 Vade Tarihi kaydın tarihinden önce: form açık kalır, ileti görünür, hiçbir şey yazılmaz", async () => {
    const before = entriesOf(customer.id).length;
    await openCard();
    await page.click(`${ACC} [data-entry="debt"]`);
    await waitForm("amount");
    await typeAmount("300");
    ok((await typeDate(`${TOP} input[name="dueDate"]`, day(-2))) === day(-2), "kaydın tarihinden önceki gün klavyeyle yazıldı");
    // Tarayıcının kendi min denetimi atlanır (sunucu kuralı sınanır): form novalidate değilse min kaldırılır.
    await page.$eval(`${TOP} input[name="dueDate"]`, node => node.removeAttribute("min"));
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForTimeout(1200);
    const stillOpen = Boolean(await page.$(`${TOP} input[name="dueDate"]`));
    const message = await textOf(`${TOP} .hof-form-error, ${TOP} [role="alert"], ${TOP} .hof-modal-error`);
    const toast = await page.evaluate(() => [...document.querySelectorAll(".hof-toast, #hof-toasts > *")].map(node => node.textContent.replace(/\s+/g, " ")).join(" | "));
    ok(stillOpen, "form açık kaldı");
    ok(/Vade Tarihi .*önce olamaz/.test(`${message} ${toast}`), `ileti: “${(message || toast).slice(0, 160)}”`);
    ok(entriesOf(customer.id).length === before, `hiçbir satır yazılmadı (${before} → ${entriesOf(customer.id).length})`);
    await shot("v6-hata");
    await closeAll();
  });

  await step("V7 Yeni Cari: Açılış Bakiyesi + Vade Tarihi → açılış satırında due_date; şeritte kalem; Düzenle'de dolu", async () => {
    await page.evaluate(() => window.HOF.accounts.open());
    await page.waitForSelector(`${ACC} [data-act="new"]`);
    await page.click(`${ACC} [data-act="new"]`);
    await waitForm("name");
    await page.click(`${TOP} input[name="name"]`);
    await typeSlow("Vade Açılış Firması");
    await page.keyboard.press("Tab");
    await page.click(`${TOP} input[name="openingBalance"]`);
    await typeSlow("4000");
    await page.keyboard.press("Tab");
    ok(Boolean(await page.$(`${TOP} input[name="openingDueDate"]`)) && Boolean(await page.$(`${TOP} input[name="openingExpectedDate"]`)), "Yeni Cari'de açılışın Vade Tarihi ve Beklenen Ödeme Tarihi");
    ok((await typeDate(`${TOP} input[name="openingDueDate"]`, day(2))) === day(2), "açılışın Vade Tarihi klavyeyle yazıldı");
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForTimeout(1500);
    const created = one("SELECT id FROM accounts WHERE name = 'Vade Açılış Firması' AND deleted_at IS NULL");
    const opening = created ? entriesOf(created.id) : [];
    ok(opening.length === 1 && opening[0].kind === "debt" && opening[0].amount === 4000 && opening[0].dueDate === day(2), `açılış satırı: ${JSON.stringify(opening.map(row => ({ kind: row.kind, amount: row.amount, dueDate: row.dueDate })))}`);
    await closeAll();
    ok(await waitPill("Vade Açılış Firması", /Tahsil Edilecek Borç · 22\.10\.2026 · ₺?4\.000,00/), `şeritte: ${JSON.stringify(await pills("Vade Açılış Firması"))}`);
    await page.evaluate(id => window.HOF.accounts.open(id), created.id);
    await page.waitForSelector(`${ACC} [data-act="edit"]`);
    await page.click(`${ACC} [data-act="edit"]`);
    await waitForm("name");
    const filled = await page.$eval(`${TOP} input[name="openingDueDate"]`, node => node.value).catch(() => "yok");
    ok(filled === day(2), `Düzenle'de Açılış Bakiyesi Vade Tarihi dolu: ${filled}`);
    await escClose(page, { expect: "soru-yok", step: "V7 Düzenle" }).catch(error => ok(false, `Düzenle sorusuz kapanmalı: ${error.message}`));
    await closeAll();
  });
} catch (error) {
  ok(false, `senaryo yarıda kaldı: ${String(error?.stack || error).split("\n").slice(0, 3).join(" ")}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
