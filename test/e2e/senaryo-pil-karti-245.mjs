// 2.4.5 madde 6a EKRANDAN (kullanıcı bulgusu 24.10.2026: Tahsilat Takvimi'nde fatura pilinin kartında "Kayda Git" → "Kayıt tabloda bulunamadı", "Ödendi Say" → 400,
// "Tahsilat Gir" → SEÇİLİ tablo kaydının carisine fatura tutarıyla dolu form; kullanıcı: "pili tıklayıp kayda git dediğimde gelseydi daha kolay olacaktı"):
//   S0 tabloda başka bir kayıt (Ali Veli, carisi No 1) SEÇİLİ — eski kodda "Tahsilat Gir" bu kaydın carisine düşüyordu; faturanın carisi de "Ali Veli" (No 2, aynı ad).
//   S1 satış faturası pili: kartta Tahsilat Gir + "Fatura Kartını Aç →", Ödendi Say YOK.
//   S2 Fatura Kartını Aç → o faturanın kartı açılır ("bulunamadı" iletisi yok, seçili kayıt yerinde).
//   S3 Tahsilat Gir → faturanın KENDİ "Tahsilat Ekle" formu (belge no başlıkta, açık tutar) → insan hızında yazım + Tab → veri tabanında tahsilat faturanın carisine
//      (No 2), bu faturaya bağlı (invoice_id); seçili kaydın carisine (No 1) hiçbir şey yazılmaz; fatura kapanır, pil kalkar.
//   S4 alış faturası pili: Ödeme Gir → "Ödeme Yap" formu → ödeme (out) tedarikçiye, faturaya bağlı.
//   S5 planlı banka pili: tahsilat ve Ödendi Say yok; "Planlı İşlemleri Aç →" → Banka → Hareketler → Planlı İşlemler (plan listede).
//   S6 zil listesi: fatura satırında Tahsilat Gir + Fatura Kartını Aç (Kayda Git / Gerçekleştirildi yok); planlı banka satırında Planlı İşlemleri Aç (Tahsilat Gir yok);
//      zilden Fatura Kartını Aç ve Tahsilat Gir aynı yoldan (veri tabanında doğru cari + fatura).
//   S7 sağ alt bildirim: fatura bildiriminde Tahsilat Gir + Fatura Kartını Aç (Kayda Git yok) → kart açılır.
//   S8 Anlık Durum → Vade Takip: fatura satırı tıklanınca Fatura Kartı, planlı banka satırı tıklanınca Planlı İşlemler.
//   S9 madde 3: tablo kaleminin Tahsilat Gir'i kaydın carisinin formunu TUTARSIZ açar (kişi ve not dolu); Ödendi Say yalnız due| kaleminde, sunucu fatura kalemine 400.
// Çıkış: "N geçti, M kaldı" (kaldıysa çıkış kodu 1).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { tahsilatWorkbook } from "../fixtures/tahsilat-ornek.mjs";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-pil-karti-245-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = await server.login();
const BASE = server.base;
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
let mainPage = null;
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    if (mainPage) await shot(mainPage, `hata-${title.slice(0, 3).replace(/[^A-Za-z0-9]/g, "")}`);
    if (mainPage) await closeAll(mainPage).catch(() => null);
  }
};

// ---------- Veri (programın kendi uçları; tarihler koşu gününe göre) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const book = tahsilatWorkbook(new Date());
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
let serial = 0;
const invoice = async (account, amount, kind, issueOffset) => {
  const lines = kind === "purchase" ? [{ name: "Pil Gider", qty: 1, unitPrice: amount, vatRate: 0, expenseCode: "general" }] : [{ name: "Pil Hizmet", qty: 1, unitPrice: amount, vatRate: 0 }];
  const doc = await must("fatura", api.post("/api/workspace/invoices", { kind, scenario: kind === "purchase" ? "expense_purchase" : "service_sale", accountId: account.id, issueDate: day(issueOffset), lines, payment: { rest: "open" }, ...(kind === "purchase" ? { number: `PIL-A${(serial += 1)}` } : {}) }));
  return must("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`));
};
const twin = await must("Ali Veli No 2", api.post("/api/workspace/accounts", { name: "Ali Veli", phone: "0533 999 99 99", type: "customer" }));
const bellCustomer = await must("Zil Müşteri", api.post("/api/workspace/accounts", { name: "Zil Müşteri", phone: "0533 888 88 88", type: "customer" }));
const noticeCustomer = await must("Bildirim Müşteri", api.post("/api/workspace/accounts", { name: "Bildirim Müşteri", phone: "0533 777 77 77", type: "customer" }));
const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Pil Tedarikçi", phone: "0533 666 66 66", type: "supplier" }));
const sale = await invoice(twin, 1200, "sale", -5);
const bellSale = await invoice(bellCustomer, 800, "sale", -3);
const noticeSale = await invoice(noticeCustomer, 500, "sale", -2);
const purchase = await invoice(supplier, 600, "purchase", -4);
const bank = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Pil Hesabı", kind: "demand", opening: { date: day(-30), amount: "50.000", confirmed: true } }));
const bankPlan = await must("planlı işlem", api.post("/api/workspace/bank/plans", { kind: "other_out", accountId: bank.id, amount: "100", plannedDate: day(2), description: "Pil Kira" }));

// Carinin para hareketleri (tahsilat / ödeme); faturanın kendi borç / alacak satırı sayılmaz.
const entriesOf = id => db.all("SELECT kind, amount, invoice_id AS invoiceId FROM account_entries WHERE account_id = ? AND kind IN ('in', 'out') ORDER BY rowid", id);
const amountOf = text => Number(String(text).replace(/\./g, "").replace(",", "."));
const openOf = async id => (await must("fatura", api.get(`/api/workspace/invoices/${id}`))).open;

const browser = await chromium.launch();
const errors = [];
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`; // ders 39
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `pil-karti-245-${name}.png`) }).catch(() => null);
const typeSlow = async (page, text) => {
  for (const ch of text) await page.keyboard.type(ch, { delay: 45 });
};
const closeAll = async page => {
  for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) {
    await escClose(page, { step: "kapat" });
    await page.waitForTimeout(250);
  }
};
const toasts = page => page.evaluate(() => [...document.querySelectorAll(".hof-toast")].map(node => node.textContent.replace(/\s+/g, " ").trim()).join(" | "));
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.accounts?.open && window.HOF?.invoices?.openDoc && window.HOF?.dues?.data), null, { timeout: 20000 });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  // Sağ alt bildirimler şeridi kapatmasın (S7'de ayrıca açılır).
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "true");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });
  await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 20000 });
  await page.waitForTimeout(600);
  return { context, page };
}
const findPill = (page, text) => page.evaluate(needle => [...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].some(node => node.textContent.includes(needle)), text);
const openPill = async (page, text) => {
  await page.evaluate(needle => {
    const pill = [...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].find(node => node.textContent.includes(needle));
    if (!pill) throw new Error(`pil yok: ${needle}`);
    pill.click();
  }, text);
  await page.waitForSelector(".hof-payment-action-card", { timeout: 5000 });
  return page.evaluate(() => {
    const card = document.querySelector(".hof-payment-action-card");
    return { buttons: [...card.querySelectorAll(".hof-payment-action-buttons button")].map(node => node.textContent.trim()), go: card.querySelector(".hof-payment-go")?.textContent.trim() || "", paid: Boolean(card.querySelector('[data-act="paid"]')) };
  });
};
const waitPillGone = (page, text) =>
  page
    .waitForFunction(needle => ![...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].some(node => node.textContent.includes(needle)), text, { timeout: 12000 })
    .then(() => true)
    .catch(() => false);
/** Fatura penceresinde bu belgenin kartı açıldı mı (başlıkta belge no). */
const invoiceCardOpen = (page, displayNo) =>
  page
    .waitForFunction(no => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-invoices-modal .hof-plan-title h3")].some(node => node.textContent.includes(no)), displayNo, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
const plannedOpen = (page, planId) =>
  page
    .waitForFunction(id => Boolean(document.querySelector('.hof-bank-modal [data-act="mv-planned"][aria-pressed="true"]')) && Boolean(document.querySelector(`.hof-bank-modal [data-plan="${id}"]`)), planId, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
/** Açılan ödeme formu: başlık, üst yazı, tutar. */
const formInfo = async page => {
  await page.waitForSelector(`${TOP} input[name="amount"]`, { timeout: 10000 });
  await page.waitForTimeout(150);
  return page.evaluate(sel => {
    const box = document.querySelector(sel);
    return { title: box.querySelector(".hof-modal-title")?.textContent.trim() || "", eyebrow: box.querySelector(".hof-eyebrow")?.textContent.replace(/\s+/g, " ").trim() || "", amount: box.querySelector('input[name="amount"]')?.value || "", note: box.querySelector('[name="note"]')?.value || "" };
  }, TOP);
};
const typeAmount = async (page, text) => {
  await page.click(`${TOP} input[name="amount"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await typeSlow(page, text);
  await page.keyboard.press("Tab");
};
const selectAli = async (page, key) => {
  await page.evaluate(caseKey => window.HOF.revealRecord(caseKey), key);
  await page.waitForFunction(caseKey => window.HOF.selectedCase?.()?.key === caseKey, key, { timeout: 8000 });
  // Kaydı gösterirken sayfa (yumuşak) kayar; pil kartı kaymada kapanır (ürün davranışı) — kayma bitmeden pil açılmaz.
  await page.waitForFunction(() => {
    const now = `${window.scrollX},${window.scrollY}`;
    const same = window.__pilScroll === now;
    window.__pilScroll = now;
    return same;
  }, null, { polling: 400, timeout: 8000 });
};

try {
  const { page } = await openPage();
  mainPage = page;
  const aliKey = await page.evaluate(() => (window.HOF.data?.rows || []).find(row => Object.values(row).includes("Ali Veli") && Object.values(row).some(value => String(value).includes("2026/1101")))?.__hofKey || "");
  if (!aliKey) throw new Error("tabloda Ali Veli kaydı yok");
  const ali = await must("Ali Veli No 1", api.post("/api/workspace/accounts", { name: "Ali Veli", phone: "0532 111 11 11", type: "customer", caseKey: aliKey, caseTitle: "2026/1101 · Ali Veli" }));
  const aliBefore = entriesOf(ali.id).length;

  await step("S0 tabloda başka bir kayıt seçili (Ali Veli, carisi No 1)", async () => {
    await selectAli(page, aliKey);
    ok((await page.evaluate(() => window.HOF.selectedCase()?.key)) === aliKey, `seçili kayıt ${aliKey}`);
    ok(await findPill(page, `Fatura ${sale.displayNo}`), `şeritte satış faturası pili (${sale.displayNo})`);
  });

  await step("S1 satış faturası pili: Tahsilat Gir + Fatura Kartını Aç; Ödendi Say yok", async () => {
    const card = await openPill(page, `Fatura ${sale.displayNo}`);
    await shot(page, "s1-fatura-pili");
    ok(card.buttons.join(",") === "Tahsilat Gir", `kart düğmeleri: [${card.buttons.join(", ")}]`);
    ok(!card.paid, "Ödendi Say yok (fatura para kaydıyla kapanır)");
    ok(card.go === "Fatura Kartını Aç →", `kartın alt düğmesi: “${card.go}” (beklenen “Fatura Kartını Aç →”, “Kayda Git” değil)`);
  });

  await step("S2 Fatura Kartını Aç → o faturanın kartı; \"bulunamadı\" yok, seçili kayıt yerinde", async () => {
    if (!(await page.$(".hof-payment-action-card"))) await openPill(page, `Fatura ${sale.displayNo}`);
    await page.$eval(".hof-payment-action-card .hof-payment-go", node => node.click());
    ok(await invoiceCardOpen(page, sale.displayNo), `fatura kartı açıldı: ${sale.displayNo}`);
    await page.waitForTimeout(500);
    const said = await toasts(page);
    ok(!/bulunamadı/.test(said), `"Kayıt tabloda bulunamadı" yok (“${said.slice(0, 120)}”)`);
    ok((await page.evaluate(() => window.HOF.selectedCase()?.key)) === aliKey, "seçili kayıt değişmedi");
    await shot(page, "s2-fatura-karti");
    await closeAll(page);
  });

  await step("S3 Tahsilat Gir → faturanın kendi formu; para faturanın carisine (No 2), faturaya bağlı; seçili kaydın carisine (No 1) yazılmaz", async () => {
    await selectAli(page, aliKey);
    await openPill(page, `Fatura ${sale.displayNo}`);
    await page.click('.hof-payment-action-card [data-act="pay"]');
    const form = await formInfo(page);
    await shot(page, "s3-tahsilat-formu");
    const right = ok(form.title === "Tahsilat Ekle" && form.eyebrow.includes(sale.displayNo), `faturanın formu: “${form.title}” · “${form.eyebrow}” (seçili kaydın carisinin formu değil)`);
    ok(amountOf(form.amount) === 1200, `açık tutar hazır: ${form.amount}`);
    if (!right) {
      await closeAll(page);
      throw new Error("yanlış form açıldı; kaydedilmedi");
    }
    await typeAmount(page, "1200");
    await page.click(`${TOP} button[type="submit"]`);
    ok(await waitPillGone(page, `Fatura ${sale.displayNo}`), "pil kalktı (fatura kapandı)");
    const rows = entriesOf(twin.id);
    ok(rows.length === 1 && rows[0].kind === "in" && rows[0].amount === 1200 && rows[0].invoiceId === sale.id, `faturanın carisi (No ${twin.refNo}): ${JSON.stringify(rows)}`);
    ok(entriesOf(ali.id).length === aliBefore, `seçili kaydın carisine (No ${ali.refNo}) hiçbir şey yazılmadı (${aliBefore} → ${entriesOf(ali.id).length})`);
    ok((await openOf(sale.id)) === 0, "fatura kapandı (açık 0)");
    await closeAll(page);
  });

  await step("S4 alış faturası pili: Ödeme Gir → Ödeme Yap formu; ödeme tedarikçiye, faturaya bağlı", async () => {
    const card = await openPill(page, `Fatura ${purchase.displayNo}`);
    ok(card.buttons.join(",") === "Ödeme Gir" && !card.paid && card.go === "Fatura Kartını Aç →", `kart: [${card.buttons.join(", ")}] · “${card.go}”`);
    await page.click('.hof-payment-action-card [data-act="pay"]');
    const form = await formInfo(page);
    const right = ok(form.title === "Ödeme Yap" && form.eyebrow.includes(purchase.displayNo) && amountOf(form.amount) === 600, `alış faturasının formu: “${form.title}” · “${form.eyebrow}” · ${form.amount}`);
    if (!right) {
      await closeAll(page);
      throw new Error("yanlış form açıldı; kaydedilmedi");
    }
    await page.click(`${TOP} button[type="submit"]`);
    ok(await waitPillGone(page, `Fatura ${purchase.displayNo}`), "pil kalktı");
    const rows = entriesOf(supplier.id);
    ok(rows.length === 1 && rows[0].kind === "out" && rows[0].amount === 600 && rows[0].invoiceId === purchase.id, `tedarikçiye ödeme (out), faturaya bağlı: ${JSON.stringify(rows)}`);
    await closeAll(page);
  });

  await step("S5 planlı banka pili: tahsilat / Ödendi Say yok; Planlı İşlemleri Aç → Planlı İşlemler", async () => {
    const card = await openPill(page, "Pil Kira");
    await shot(page, "s5-banka-pili");
    ok(card.buttons.length === 0 && !card.paid, `kartta tahsilat / Ödendi Say yok: [${card.buttons.join(", ")}]`);
    ok(card.go === "Planlı İşlemleri Aç →", `alt düğme: “${card.go}”`);
    if (card.go) await page.$eval(".hof-payment-action-card .hof-payment-go", node => node.click());
    ok(await plannedOpen(page, bankPlan.id), "Banka → Hareketler → Planlı İşlemler açıldı, plan listede");
    await shot(page, "s5-planli-islemler");
    await closeAll(page);
  });

  const panelRow = (page, needle) =>
    page.evaluate(text => {
      const li = [...document.querySelectorAll(".hof-alert-list li")].find(node => node.textContent.includes(text));
      return li ? [...li.querySelectorAll(".hof-alert-buttons button")].filter(node => !node.classList.contains("hof-alert-dismiss")).map(node => node.textContent.trim()) : null;
    }, needle);
  const openBell = async page => {
    await page.click(".topbar .top-actions > .icon-button");
    await page.waitForSelector(`${MODAL} .hof-alert-list`);
  };
  const clickInRow = (page, needle, label) =>
    page.evaluate(
      ([text, name]) => {
        const li = [...document.querySelectorAll(".hof-alert-list li")].find(node => node.textContent.includes(text));
        const button = li && [...li.querySelectorAll("button")].find(node => node.textContent.trim() === name);
        if (!button) throw new Error(`zilde düğme yok: ${text} · ${name}`);
        button.click();
      },
      [needle, label],
    );

  await step("S6 zil: fatura satırı Tahsilat Gir + Fatura Kartını Aç; planlı banka satırı Planlı İşlemleri Aç; aynı yoldan kayıt", async () => {
    await selectAli(page, aliKey);
    await openBell(page);
    const invoiceButtons = await panelRow(page, `Fatura ${bellSale.displayNo}`);
    const bankButtons = await panelRow(page, "Pil Kira");
    await shot(page, "s6-zil");
    ok(invoiceButtons?.join(",") === "Tahsilat Gir,Fatura Kartını Aç", `zilde fatura satırı: [${invoiceButtons?.join(", ")}] (Kayda Git / Gerçekleştirildi yok)`);
    ok(bankButtons?.join(",") === "Planlı İşlemleri Aç", `zilde planlı banka satırı: [${bankButtons?.join(", ")}] (Tahsilat Gir yok)`);
    if (invoiceButtons?.includes("Fatura Kartını Aç")) {
      await clickInRow(page, `Fatura ${bellSale.displayNo}`, "Fatura Kartını Aç");
      ok(await invoiceCardOpen(page, bellSale.displayNo), `zilden fatura kartı: ${bellSale.displayNo}`);
    } else ok(false, "zilde Fatura Kartını Aç yok");
    await closeAll(page);
    await selectAli(page, aliKey);
    await openBell(page);
    await clickInRow(page, `Fatura ${bellSale.displayNo}`, "Tahsilat Gir");
    const form = await formInfo(page);
    const right = ok(form.title === "Tahsilat Ekle" && form.eyebrow.includes(bellSale.displayNo) && amountOf(form.amount) === 800, `zilden faturanın formu: “${form.title}” · “${form.eyebrow}” · ${form.amount}`);
    if (!right) {
      await closeAll(page);
      throw new Error("yanlış form açıldı; kaydedilmedi");
    }
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForTimeout(1500);
    const rows = entriesOf(bellCustomer.id);
    ok(rows.length === 1 && rows[0].kind === "in" && rows[0].amount === 800 && rows[0].invoiceId === bellSale.id, `Zil Müşteri'ye tahsilat, faturaya bağlı: ${JSON.stringify(rows)}`);
    ok(entriesOf(ali.id).length === aliBefore, "seçili kaydın carisine yazılmadı");
    await closeAll(page);
  });

  await step("S7 sağ alt bildirim: fatura bildiriminde Tahsilat Gir + Fatura Kartını Aç (Kayda Git yok)", async () => {
    await closeAll(page);
    // Yalnız bu faturanın bildirimi gösterilsin: öbürleri "son 3 saatte gösterildi" sayılır.
    const target = await page.evaluate(no => {
      const list = window.HOF.alerts.list();
      const item = list.find(alert => alert.text?.includes(no) || alert.due?.label?.includes(no));
      const now = Date.now();
      const shown = Object.fromEntries(list.filter(alert => alert !== item).map(alert => [alert.id, now]));
      localStorage.setItem(`hof-notices:${window.HOF.user.id}`, JSON.stringify({ shown }));
      localStorage.removeItem(`hof-notices-off:${window.HOF.user.id}`);
      window.HOF.alerts.enqueue();
      return item?.id || "";
    }, noticeSale.displayNo);
    ok(Boolean(target), "bildirim listesinde fatura kalemi");
    const node = await page.waitForSelector(`#hof-notices .hof-notice.is-visible:has-text("${noticeSale.displayNo}")`, { timeout: 30000 }).catch(() => null);
    ok(Boolean(node), "fatura bildirimi sağ altta");
    const buttons = node ? await node.$$eval(".hof-notice-actions button", nodes => nodes.map(item => item.textContent.trim())) : [];
    await shot(page, "s7-bildirim");
    ok(buttons.join(",") === "Tahsilat Gir,Fatura Kartını Aç", `bildirim düğmeleri: [${buttons.join(", ")}]`);
    if (node && buttons.includes("Fatura Kartını Aç")) {
      await node.$eval('.hof-notice-actions [data-act="open"]', item => item.click());
      ok(await invoiceCardOpen(page, noticeSale.displayNo), `bildirimden fatura kartı: ${noticeSale.displayNo}`);
    }
    await page.evaluate(() => {
      localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "true");
      document.querySelectorAll("#hof-notices .hof-notice").forEach(item => item.remove());
    });
    await closeAll(page);
  });

  await step("S8 Anlık Durum → Vade Takip: fatura satırı Fatura Kartını, planlı banka satırı Planlı İşlemler'i açar", async () => {
    await page.click('.hof-side-item[data-action="analytics"]');
    await page.waitForSelector(`${MODAL} .hof-rep .hof-rep-tabs`, { timeout: 10000 });
    await page.click(`${MODAL} .hof-rep [data-tab="vade"]`);
    await page.waitForSelector(`${MODAL} .hof-rep-vade tbody tr[data-due-row]`, { timeout: 15000 });
    await page.waitForTimeout(500);
    const clickRow = needle =>
      page.evaluate(text => {
        const row = [...document.querySelectorAll(".hof-rep-vade tbody tr[data-due-row]")].find(node => node.textContent.includes(text));
        if (!row) return false;
        row.click();
        return true;
      }, needle);
    ok(await clickRow(noticeSale.displayNo), `Vade Takip'te fatura satırı (${noticeSale.displayNo})`);
    ok(await invoiceCardOpen(page, noticeSale.displayNo), "satır tıklanınca fatura kartı açıldı");
    await shot(page, "s8-vade-fatura");
    await escClose(page, { step: "S8 fatura" });
    await page.waitForTimeout(400);
    ok(await clickRow("Pil Kira"), "Vade Takip'te planlı banka satırı");
    ok(await plannedOpen(page, bankPlan.id), "satır tıklanınca Planlı İşlemler açıldı");
    await closeAll(page);
  });

  await step("S9 madde 3: tablo kaleminin Tahsilat Gir'i tutarsız (kişi ve not dolu); Ödendi Say yalnız due| kaleminde", async () => {
    const tableItem = { id: `due|İcra Takip|${aliKey}|Söz Tarihi|${day(-6)}`, caseKey: aliKey, tab: "", person: "Ali Veli", phone: "0532 111 11 11", label: "Ödeme sözü", dueText: "01.01.2026", amount: 5000, debt: 36000, debtColumn: "Kalan", promise: true };
    const acts = await page.evaluate(item => {
      const result = window.HOF.dues.actions(item);
      return { pay: result.pay?.label || "", settle: result.settle, cancel: result.cancel, invoiceSettle: window.HOF.dues.actions((window.HOF.dues.data().items || []).find(due => due.source === "invoice") || { source: "invoice", id: "invoice|x" }).settle };
    }, tableItem);
    ok(acts.pay === "Tahsilat Gir" && acts.settle && acts.cancel, `tablo kalemi: ${JSON.stringify(acts)}`);
    ok(acts.invoiceSettle === false, "fatura kaleminde Ödendi Say yok");
    await page.evaluate(item => window.HOF.dues.actions(item).pay.run(), tableItem);
    const form = await formInfo(page);
    await shot(page, "s9-tablo-tahsilat");
    ok(form.title === "Tahsilat" && form.eyebrow.includes("Ali Veli") && form.eyebrow.includes(`No ${ali.refNo}`), `kaydın carisinin formu: “${form.title}” · “${form.eyebrow}”`);
    ok(form.amount === "", `tutar BOŞ (tablodaki tutar muhasebe kaydı değil): “${form.amount}”`);
    ok(form.note === "Ödeme sözü · 01.01.2026", `not dolu: “${form.note}”`);
    await escClose(page, { step: "S9", expect: "soru-yok" });
    await page.waitForTimeout(300);
    const settle = await page.evaluate(id => fetch("/api/workspace/dues/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reason: "paid" }) }).then(response => response.status), `invoice|${noticeSale.id}`);
    ok(settle === 400, `sunucu fatura kalemine Ödendi Say'ı reddeder (${settle})`);
    ok(entriesOf(ali.id).length === aliBefore, "hiçbir şey yazılmadı");
    await closeAll(page);
  });
} catch (error) {
  ok(false, `senaryo yarıda kaldı: ${error.message}`);
} finally {
  ok(!errors.length, `sayfa hatası yok (${errors.slice(0, 3).join(" | ")})`);
  await browser.close();
  await server.close();
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // temizlik hatası sonucu ezmez
  }
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
