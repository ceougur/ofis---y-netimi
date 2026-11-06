// 2.5.0 BİRLEŞİK TUR 2 (dar kontrol probe4 "tam form"; sakınca süzgeci: sessiz veri kaybı) — EKRANDAN, iki kullanıcı:
//   A (yönetici, tarayıcı) bir hareketin düzeltme formunu açar → B (muhasebe, ikinci oturum; yeni istemci gibi kendi açtığı sürümle) AYNI hareketin
//   tutarını düzeltir → A formda yalnız açıklamayı insan hızında değiştirip (Tab) Kaydet'e basar. Beklenen (sunucu lib/row-version.mjs + istemci formu):
//   409 "<…> siz açtıktan sonra başka biri tarafından değiştirildi; düzeltmeniz kaydedilmedi. …" formda görünür, form açık kalır ve kendiliğinden yeniden
//   göndermez; veri tabanında B'nin değeri durur (A'nın açıklaması yazılmadı); arkadaki kart / liste kendiliğinden B'nin değerine yenilenir. Önceden (79d25d6a)
//   form sürüm göndermiyordu: kayıt 200, formdaki ESKİ tutar B'nin düzeltmesini sessizce geri yazıyordu.
//   Dört form + transfer: Cari hareketi (hof-accounts editEntry), Stok hareketi (hof-stock editMove), Taksit hareketi (hof-plans editEntry), Kasa hareketi ve
//   Kasa ↔ Banka transferi (hof-workspace editCashEntry; B transferi ÖBÜR bacaktan — banka tarafından — düzeltir). Ayrıca: silinmiş hareket (404 + kart yenilenir),
//   GERİLEME: yarışsız düzeltme aynen kaydedilir ve hemen ardından ikinci düzeltme de (kendi kaydı formu bayatlatmaz).
//   Kapatma sorusu (ders 34): hata sonrası form Esc ile kapatılırken "Kaydedilmemiş Değişiklik" BEKLENİR (açıklamaya yazıldı) — escClose expect "soru-var".
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-duzeltme-kilidi-250.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";
import { trIban } from "../banka-210-hesap-ortak.mjs";
import { createClock } from "../../server/lib/clock.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-duzeltme-kilidi-250-"));
const shots = process.env.EKRAN_DIR || root;
const TODAY = "2026-10-20";
const clock = createClock({ time: `${TODAY}T12:00:00+03:00`, fixed: true });
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false });
const api = await server.login();
const db = server.app.store;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const shot = name => page?.screenshot({ path: path.join(shots, `duzeltme-kilidi-250-${name}.png`) }).catch(() => null);
const MODAL = ".hof-modal-backdrop.is-visible";
// En üstteki pencere konuma değil sıraya göre (ders 39).
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    await shot(`hata-${title.slice(0, 3)}`);
    await closeAll().catch(() => null);
  }
};
// Pencere açılınca okuma is-visible beklemesinden sonra (ders 39).
const waitForm = async name => {
  await page.waitForSelector(`${TOP} form [name="${name}"]`);
  await page.waitForTimeout(200);
};
// İnsan hızında yazım (ders 12): alana tıklanır, eski metin silinir, harf harf yazılır, Tab ile çıkılır.
const typeHuman = async (name, text) => {
  await page.click(`${TOP} form [name="${name}"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  for (const ch of text) await page.keyboard.type(ch, { delay: 40 });
  await page.keyboard.press("Tab");
};
const formError = () => page.$eval(`${TOP} .hof-form-error`, node => node.textContent.trim()).catch(() => "");
const rowText = selector => page.$eval(selector, node => (node.closest("tr") || node).innerText.replace(/\s+/g, " ").trim()).catch(() => "(satır yok)");
const waitRow = (selector, pattern) =>
  page
    .waitForFunction(([sel, source]) => new RegExp(source).test((document.querySelector(sel)?.closest("tr")?.innerText || "").replace(/\s+/g, " ")), [selector, pattern.source], { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
// Kaydet'e basılır ve sunucunun yanıtı beklenir (sonuç kodu okunur: reddedilen istek başarı değildir — ders 3).
const submitAndRead = async urlPart => {
  const clickAt = Date.now();
  const [response] = await Promise.all([page.waitForResponse(res => res.url().includes(urlPart) && res.request().method() === "PUT", { timeout: 15000 }), page.click(`${TOP} form button[type="submit"]`)]);
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  await page.waitForTimeout(600);
  return { status: response.status(), code: body?.code || body?.error?.code || "", body, clickAt };
};
// Kartı / listeyi okuyan GET istekleri (zamanıyla): 409'dan SONRA formun kendi yenilemesi var mı (canlı değişiklik bildiriminden bağımsız).
const reads = [];
const readAfter = async (pattern, since, timeout = 6000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (reads.some(item => item.at > since && pattern.test(item.url))) return true;
    await sleep(100);
  }
  return false;
};
// Kartın / listenin canlı yenilemeleri duruldu mu: `quiet` ms boyunca o adrese yeni GET yok (en çok `timeout`). Kaç ms beklendiği döner (-1: durulmadı).
const settle = async (pattern, quiet = 2500, timeout = 15000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const last = reads.filter(item => pattern.test(item.url)).at(-1)?.at || 0;
    if (Date.now() - Math.max(last, start) >= quiet) return Date.now() - start;
    await sleep(100);
  }
  return -1;
};
const STALE = /siz açtıktan sonra başka biri tarafından değiştirildi; düzeltmeniz kaydedilmedi\./;

// ---------- Veri (programın kendi uçları) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
await must("muhasebe kullanıcısı", api.post("/api/admin/users", { username: "muhasebe2", name: "Muhasebe İki", role: "muhasebe", password: "Muhasebe-Iki-2026!", mustChangePassword: false }));
const other = await server.login("muhasebe2", "Muhasebe-Iki-2026!");
const bankAcc = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: trIban(10, 2501234), opening: { date: day(-30), amount: "100.000", confirmed: true } }));
await must("Kasa nakdi", api.post("/api/workspace/cash", { kind: "in", amount: "5.000", date: day(-10), description: "Gün başı nakit" }));
const customer = await must("cari", api.post("/api/workspace/accounts", { name: "Kilit Müşteri", phone: "0532 250 00 01", type: "customer", registeredOn: day(-60) }));
const cariEntry = await must("cari tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "100", date: day(-2), method: "cash", note: "ilk not" }));
const cariGone = await must("silinecek cari tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "70", date: day(-2), method: "cash", note: "silinecek" }));
const item = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "KL-1", name: "Kilit Ürün", unit: "Adet", unitPrice: "10", salePrice: "100", openingQty: "20" }));
const move = await must("stok çıkışı", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "100", pay: "cash", method: "cash", date: day(-2), note: "ilk not" }));
const plan = await must("taksit kartı", api.post("/api/workspace/plans", { accountId: customer.id, name: "Kilit Kartı", total: "5000", mode: "auto", count: 2, firstDue: day(10), registeredOn: day(-5) }));
const planEntry = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", date: day(-2), method: "cash", note: "ilk not" }));
const kasa = await must("Kasa ödemesi", api.post("/api/workspace/cash", { kind: "out", amount: "100", date: day(-2), description: "Kırtasiye" }));
const transfer = await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "300", date: day(-2), description: "ATM'den çekildi", bankAccountId: bankAcc.id || bankAcc.account?.id }));
const ids = { cari: cariEntry.entryId, cariGone: cariGone.entryId, stok: move.moveId, taksit: planEntry.entryId, kasa: kasa.id, transferCash: transfer.id, transferBank: transfer.bankId };
const rowOf = (table, id) => db.get(`SELECT * FROM ${table} WHERE id = ?`, id);
const userId = name => db.get("SELECT id FROM users WHERE username = ?", name)?.id;
const B = userId("muhasebe2");

const browser = await chromium.launch();
const errors = [];
try {
  ok(Object.values(ids).every(Boolean), `ön koşul: hareketler açıldı ${JSON.stringify(ids)}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.method() === "GET" && request.url().includes("/api/workspace/")) reads.push({ url: new URL(request.url()).pathname + new URL(request.url()).search, at: Date.now() });
  });
  await installPageClock(page, clock);
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.accounts?.open && window.HOF?.stock?.open && window.HOF?.plans?.open), null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });
  await page.waitForTimeout(600);

  const ACC = `${MODAL} .hof-accounts-modal`;
  const STK = `${MODAL} .hof-stock-modal`;
  const PLN = `${MODAL} .hof-plans-modal:not(.hof-accounts-modal):not(.hof-stock-modal)`;
  const CASH = `${MODAL}:has(.hof-cash-list)`;
  const openAccount = async () => {
    await page.evaluate(id => window.HOF.accounts.open(id), customer.id);
    await page.waitForSelector(`${ACC} [data-edit-entry="${ids.cari}"]`);
    await page.waitForTimeout(300);
  };
  const openStock = async () => {
    await page.evaluate(id => window.HOF.stock.open(id), item.id);
    await page.waitForSelector(`${STK} [data-edit-move="${ids.stok}"]`);
    await page.waitForTimeout(300);
  };
  const openPlan = async () => {
    await page.evaluate(id => window.HOF.plans.open(id), plan.id);
    await page.waitForSelector(`${PLN} [data-edit-entry="${ids.taksit}"]`);
    await page.waitForTimeout(300);
  };
  const openCash = async () => {
    await page.click('#hof-sidecard [data-action="cash"]');
    await page.waitForSelector(`${CASH} [data-list] table, ${CASH} [data-list] .hof-empty`, { timeout: 15000 });
    await Promise.all([page.waitForResponse(res => res.url().includes("/api/workspace/cash?")), page.click(`${CASH} [data-period="all"]`)]);
    await page.waitForFunction(sel => document.querySelector(sel)?.getAttribute("aria-pressed") === "true", `${CASH} [data-period="all"]`);
    await page.waitForTimeout(500);
  };
  // B: yeni istemci gibi — hareketi okur, okuduğu sürümle (updatedAt) düzeltir.
  const versionOf = (table, id) => rowOf(table, id)?.updated_at || "";

  // Ortak akış: A formu açar → B düzeltir → A yalnız açıklamayı değiştirir → 409 formda, veri B'de, kart yenilenir → Esc (soru beklenir) → gerileme: yeniden aç,
  // düzelt, kaydet (200) → hemen ikinci düzeltme (200).
  const race = async ({ label, open, editSel, rowSel, table, id, noteField, urlPart, cardRead, bWrite, bCheck, bRow, aNote, freshCheck }) => {
    await open();
    await page.click(editSel);
    await waitForm(noteField);
    const before = rowOf(table, id);
    const bAt = Date.now();
    const bRes = await bWrite(versionOf(table, id));
    ok(bRes.status === 200, `${label}: B (muhasebe2, öbür oturum) aynı hareketi düzeltti → ${bRes.status} ${bRes.data?.error || ""}`);
    ok(bCheck(rowOf(table, id)), `${label}: B'nin düzeltmesi veri tabanında (${JSON.stringify(pick(rowOf(table, id)))})`);
    // Ön koşul (ders 20): canlı değişiklik bildiriminin kart / liste yenilemesi (varsa) A Kaydet'e basmadan biter; 409'dan sonraki okuma formun kendi yenilemesidir.
    const live = await readAfter(cardRead, bAt, 5000);
    const calm = await settle(cardRead);
    console.log(`    (ön koşul: B'nin düzeltmesinden sonra canlı yenileme ${live ? "geldi" : "gelmedi"}; kart okumaları ${calm >= 0 ? `${calm} ms'de duruldu` : "DURULMADI"})`);
    await typeHuman(noteField, aNote);
    const res = await submitAndRead(urlPart);
    const message = await formError();
    ok(res.status === 409 && /-stale$/.test(res.code), `${label}: A'nın eskimiş formu 409 aldı (${res.status} ${res.code})`);
    ok(STALE.test(message), `${label}: ileti formda: “${message}”`);
    ok(Boolean(await page.$(`${TOP} form [name="${noteField}"]`)), `${label}: form açık kaldı (kendiliğinden yeniden göndermedi; yazılan açıklama formda)`);
    const now = rowOf(table, id);
    ok(bCheck(now) && now.updated_by === B && (now.note ?? now.description) === (before.note ?? before.description), `${label}: veri tabanında B'nin değeri duruyor, A'nın açıklaması yazılmadı (${JSON.stringify(pick(now))})`);
    const selfRead = await readAfter(cardRead, res.clickAt);
    if (!selfRead) console.log(`    (409'dan sonraki okumalar: ${JSON.stringify(reads.filter(item => item.at > res.clickAt).map(item => item.url).slice(0, 12))})`);
    ok(selfRead, `${label}: 409'dan sonra form ${table === "cash_entries" ? "Kasa listesini" : "kartı"} kendisi yeniden okudu (${cardRead.source})`);
    ok(await waitRow(rowSel, bRow), `${label}: arkadaki ${table === "cash_entries" ? "Kasa listesi" : "kart"} B'nin değerine yenilendi: “${(await rowText(rowSel)).slice(0, 140)}”`);
    await shot(`${label.slice(0, 12).replace(/[^\w]+/g, "-")}-409`);
    // Ders 34: açıklamaya yazıldı → kapatma sorusu BEKLENİR; escClose yanıtı (Kaydetmeden Kapat) nedeniyle günlüğe yazar.
    await escClose(page, { expect: "soru-var", step: `${label} 409 sonrası form kapatılıyor (açıklama yazıldı)` });
    await page.waitForTimeout(300);
    // Gerileme: liste yenilendikten sonra açılan form güncel sürümle gider; yarışsız düzeltme aynen kaydedilir.
    await page.click(editSel);
    await waitForm(noteField);
    ok(await freshCheck(), `${label}: yeniden açılan form B'nin değeriyle dolu`);
    await typeHuman(noteField, `${aNote} (yeniden)`);
    const again = await submitAndRead(urlPart);
    ok(again.status === 200, `${label}: yarışsız düzeltme kaydedildi (${again.status} ${again.code})`);
    await page.waitForSelector(`${TOP} form [name="${noteField}"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    const saved = rowOf(table, id);
    ok(bCheck(saved) && (saved.note ?? saved.description) === `${aNote} (yeniden)`, `${label}: veri tabanı — açıklama A'nın, tutar B'nin (${JSON.stringify(pick(saved))})`);
    // Kendi kaydı formu bayatlatmaz: hemen ikinci düzeltme de 200.
    await page.waitForTimeout(500);
    await page.click(editSel);
    await waitForm(noteField);
    await typeHuman(noteField, `${aNote} (ikinci)`);
    const third = await submitAndRead(urlPart);
    ok(third.status === 200, `${label}: ardışık ikinci düzeltme de kaydedildi (${third.status} ${third.code})`);
    await page.waitForSelector(`${TOP} form [name="${noteField}"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    ok((rowOf(table, id).note ?? rowOf(table, id).description) === `${aNote} (ikinci)`, `${label}: veri tabanında ikinci düzeltme`);
    await closeAll();
  };
  const pick = row => (row ? { amount: row.amount, qty: row.qty, unit_price: row.unit_price, note: row.note, description: row.description, updated_by: row.updated_by === B ? "B" : row.updated_by ? "A" : "" } : null);
  const amountInput = () => page.$eval(`${TOP} form input[name="amount"]`, node => node.value).catch(() => "");

  await step("D1 Cari hareketi düzelt (hof-accounts editEntry)", async () => {
    await race({
      label: "Cari",
      open: openAccount,
      editSel: `${ACC} [data-edit-entry="${ids.cari}"]`,
      rowSel: `${ACC} [data-edit-entry="${ids.cari}"]`,
      table: "account_entries",
      id: ids.cari,
      noteField: "note",
      urlPart: `/entries/${ids.cari}`,
      cardRead: new RegExp(`^/api/workspace/accounts/${customer.id}(\\?|$)`),
      bWrite: version => other.put(`/api/workspace/accounts/${customer.id}/entries/${ids.cari}`, { amount: "10", updatedAt: version }),
      bCheck: row => row?.amount === 10,
      bRow: /10,00/,
      aNote: "A'nın notu",
      freshCheck: async () => /^10(,00)?$/.test(await amountInput()),
    });
  });

  await step("D2 Stok hareketi düzelt (hof-stock editMove)", async () => {
    await race({
      label: "Stok",
      open: openStock,
      editSel: `${STK} [data-edit-move="${ids.stok}"]`,
      rowSel: `${STK} [data-edit-move="${ids.stok}"]`,
      table: "stock_moves",
      id: ids.stok,
      noteField: "note",
      urlPart: `/moves/${ids.stok}`,
      cardRead: new RegExp(`^/api/workspace/stock/${item.id}(\\?|$)`),
      bWrite: version => other.put(`/api/workspace/stock/${item.id}/moves/${ids.stok}`, { unitPrice: "10", updatedAt: version }),
      bCheck: row => row?.unit_price === 10 && row?.amount === 10,
      bRow: /10,00/,
      aNote: "A'nın notu",
      freshCheck: async () => /^10(,00)?$/.test(await page.$eval(`${TOP} form input[name="unitPrice"]`, node => node.value).catch(() => "")),
    });
  });

  await step("D3 Taksit hareketi düzelt (hof-plans editEntry)", async () => {
    await race({
      label: "Taksit",
      open: openPlan,
      editSel: `${PLN} [data-edit-entry="${ids.taksit}"]`,
      rowSel: `${PLN} [data-edit-entry="${ids.taksit}"]`,
      table: "plan_entries",
      id: ids.taksit,
      noteField: "note",
      urlPart: `/entries/${ids.taksit}`,
      cardRead: new RegExp(`^/api/workspace/plans/${plan.id}(\\?|$)`),
      bWrite: version => other.put(`/api/workspace/plans/${plan.id}/entries/${ids.taksit}`, { amount: "10", updatedAt: version }),
      bCheck: row => row?.amount === 10,
      bRow: /10,00/,
      aNote: "A'nın notu",
      freshCheck: async () => /^10(,00)?$/.test(await amountInput()),
    });
  });

  await step("D4 Kasa hareketi düzelt (hof-workspace editCashEntry)", async () => {
    await race({
      label: "Kasa",
      open: openCash,
      editSel: `${CASH} button[data-edit="${ids.kasa}"]`,
      rowSel: `${CASH} button[data-edit="${ids.kasa}"]`,
      table: "cash_entries",
      id: ids.kasa,
      noteField: "description",
      urlPart: `/api/workspace/cash/${ids.kasa}`,
      cardRead: /^\/api\/workspace\/cash\?from=/,
      bWrite: version => other.put(`/api/workspace/cash/${ids.kasa}`, { kind: "out", amount: "10", date: day(-2), description: "Kırtasiye", updatedAt: version }),
      bCheck: row => row?.amount === 10,
      bRow: /10,00/,
      aNote: "A'nın açıklaması",
      freshCheck: async () => /^10(,00)?$/.test(await amountInput()),
    });
  });

  await step("D5 Kasa ↔ Banka transferi düzelt — B ÖBÜR bacaktan (banka tarafı) düzeltir", async () => {
    const bankLeg = rowOf("cash_entries", ids.transferBank);
    await race({
      label: "Transfer",
      open: openCash,
      editSel: `${CASH} button[data-edit="${ids.transferCash}"]`,
      rowSel: `${CASH} button[data-edit="${ids.transferCash}"]`,
      table: "cash_entries",
      id: ids.transferCash,
      noteField: "description",
      urlPart: `/api/workspace/cash/${ids.transferCash}`,
      cardRead: /^\/api\/workspace\/cash\?from=/,
      // Yeni istemci gibi: B banka bacağını kendi açtığı sürümle düzeltir (iki bacak birlikte güncellenir).
      bWrite: () => other.put(`/api/workspace/cash/${ids.transferBank}`, { kind: bankLeg.kind, amount: "400", date: day(-2), description: "ATM'den çekildi", updatedAt: versionOf("cash_entries", ids.transferBank) }),
      bCheck: row => row?.amount === 400 && rowOf("cash_entries", ids.transferBank)?.amount === 400,
      bRow: /400,00/,
      aNote: "A'nın transfer açıklaması",
      freshCheck: async () => /^400(,00)?$/.test(await amountInput()),
    });
  });

  await step("D6 Silinmiş cari hareketi: 404 iletisi formda, kart yenilenir (satır gider), hiçbir şey yazılmaz", async () => {
    await openAccount();
    await page.click(`${ACC} [data-edit-entry="${ids.cariGone}"]`);
    await waitForm("note");
    const delAt = Date.now();
    const del = await other.del(`/api/workspace/accounts/${customer.id}/entries/${ids.cariGone}`);
    ok(del.status === 200, `B hareketi sildi → ${del.status}`);
    const cardRead = new RegExp(`^/api/workspace/accounts/${customer.id}(\\?|$)`);
    const live = await readAfter(cardRead, delAt, 5000);
    const calm = await settle(cardRead);
    console.log(`    (ön koşul: silmeden sonra canlı yenileme ${live ? "geldi" : "gelmedi"}; kart okumaları ${calm >= 0 ? `${calm} ms'de duruldu` : "DURULMADI"})`);
    await typeHuman("note", "A'nın notu");
    const res = await submitAndRead(`/entries/${ids.cariGone}`);
    const message = await formError();
    ok(res.status === 404 && /Başka biri silmiş olabilir/.test(message), `404 ve ileti formda: ${res.status} “${message}”`);
    ok(await readAfter(cardRead, res.clickAt), "404'ten sonra form kartı kendisi yeniden okudu");
    ok(!rowOf("account_entries", ids.cariGone), "veri tabanında hareket yok (yeniden yazılmadı)");
    const gone = await page
      .waitForFunction(sel => !document.querySelector(sel), `${ACC} [data-edit-entry="${ids.cariGone}"]`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    ok(gone, "arkadaki kart yenilendi: silinen satır listede yok");
    await escClose(page, { expect: "soru-var", step: "D6 404 sonrası form kapatılıyor (açıklama yazıldı)" });
    await closeAll();
  });

  await step("D7 Mutabakat Testi ve Kasa", async () => {
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, `Mutabakat Testi ok (${JSON.stringify((integrity.failures || []).slice(0, 3))})`);
    const cash = await must("Kasa", api.get("/api/workspace/cash?method=cash"));
    // 5.000 + cari 10 + stok 10 + taksit 10 − Kasa 10 + transfer 400 (silinen 70 düştü).
    ok(Math.abs(cash.totals.balance - 5420) < 0.005, `Nakit Kasa 5.420,00 (${cash.totals.balance})`);
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
