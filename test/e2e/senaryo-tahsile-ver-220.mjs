// Senaryo Bankaya Tahsile Ver 2.2.0 — EKRANDAN (docs/2.2.0-IS-LISTESI.md İz 4.1 ekranı ve İz 2.6; plan §3.14, §8.10 "Tahsildeki Çekler").
// Kullanıcı (12.10.2026): "Bankaya Tahsile Ver bu sürümde"; "Senet Kullan işaretli hesaplar … Bankaya Tahsile Ver seçiminde". Gerçek kullanıcı gibi
// tıklanır, Tab ile ilerlenir, insan hızında yazılır (ders 12); her adımdan sonra sayılar sunucudan (API) ve ekrandaki raporlardan okunur.
// 2.2.0 İz 4.2 (plan §3.11a, bilerek güncellendi — birleşmede senet hesabı değişti): alınan SENET 121.01 / 121.02, ÇEK 101.01 / 101.02;
// aşağıdaki 101 satırları senet için 121 okunur (S5–S7 senet B 2.000 → 121).
// Beklenen sayılar planın yevmiye kuralından ELLE (program kodundan türetilmez): Tahsile Ver B 101.02 / A 101.01; Bankadan Geri Al B 101.01 /
// A 101.02; tahsildeki evrakın tahsili B 102.x / A 101.02; tahsildeki carili senet karşılıksız B 120 / A 101.02 (plan §3.14, doğrulama T2).
//  Ön koşul (API): Ziraat Bankası · Çek Tahsil (Vadesiz, "Çek Kullan" işaretli, açılış 01.10.2026 10.000, Bakiye Doğrulandı); ABC Ltd. borcu 10.000;
//  çek C 1.500 (alış 05.10, vade 12.10) portföyde kalır.
//  S0  Çek A 5.000 ekrandan alınır (alış 05.10, vade 31.10)       → 101.01 6.500 · 101.02 0 · Tahsildeki 0 · ABC 3.500
//  S1  A → Bankaya Tahsile Ver (tek uygun hesap: Ziraat, bilgi satırı + bakiye) → listede "Bankada Tahsilde · Ziraat Bankası · 08.10.2026";
//      Ciro Et ve Sil pasif, nedeni düğmelerin yanında yazılı; Düzenle'de tutar/vade yok → 101.01 1.500 · 101.02 5.000 · Tahsildeki 5.000 (1)
//  S2  Bankadan Geri Al                                            → 101.01 6.500 · 101.02 0 · Tahsildeki 0
//  S3  yeniden Bankaya Tahsile Ver                                 → 101.01 1.500 · 101.02 5.000 · Tahsildeki 5.000
//  S4  Tahsil Et: yol Havale / EFT ve hesap Ziraat sabit (salt okunur, nedeni yazılı; nakit yok) → Ziraat 15.000 · 101.01 1.500 · 101.02 0
//  S5  Senet B 2.000 (API; alış 06.10, vade 06.11)                 → 101.01 3.500 · ABC 1.500; Senet Kullan hesabı yok:
//      yetkisiz (avukat) "Banka hesabı tanımlı değil, yöneticinize başvurun." (düğme yok)
//  S6  yönetici: "Banka Hesabı Tanımla" (form kapanmadan; yazılan açıklama kaybolmaz) → "+ Yeni Banka Hesabı" → Senet Kullan işaretli gelir →
//      Garanti BBVA · Senet Tahsil açılır, formda seçili → tahsile ver → 101.01 1.500 · 101.02 2.000 · Tahsildeki 2.000; Garanti bakiyesi 0.
//      Liste süzgeçleri (ders 11): her Durum seçeneğinin satırları ve toplamı; özet kutusu "Bankada Tahsilde" 2.000, "Portföyde (alınan)" 1.500.
//  S7  B Karşılıksız / İade (bankadan döndü)                        → 101.01 1.500 · 101.02 0 · Tahsildeki 0 · ABC 3.500 (cari borcu geri)
//  S8  C: Garanti'ye de "Çek Kullan" → seçimde iki hesap (bakiyeleriyle, ön seçim yok); Senet Kullan'lı ama Çek Kullan'sız hesap çekte yok.
//  Alt Hesap Mizanı (Bu Yıl) son: 101.01 B 13.500 / A 12.000 (bakiye 1.500), 101.02 B 12.000 / A 12.000; dönem düğmeleri (Bu Ay, Son 30 Gün,
//  Tüm Zamanlar aynı; Geçen Ay 101 satırı yok). Tahsildeki Çek ve Senetler TOPLAM = satırlar = 101.02 bakiyesi her adımda.
// Çalıştırma: npm run test:senaryo-tahsile-ver-220 (ekran görüntüleri artifacts/senaryo-tahsile-ver-220/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-tahsile-ver-220");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank";
const CHEQUES = "/api/workspace/cheques";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-tahsile-ver-220-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, maxCompanies: 2, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f43" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];

let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const shot = async name => {
  if (name !== "hata") await auditLabels(name);
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const CHQ = ".hof-cheques-modal";
const FORM = `${top} .hof-form`;
const pause = ms => page.waitForTimeout(ms);
const closeAll = async () => {
  for (let index = 0; index < 8 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await pause(300);
    const leave = await page.$(`${top} [data-answer="yes"]`);
    if (leave && /Kaydetmeden|Çık/.test((await leave.textContent()) || "")) await leave.click();
  }
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
    await closeAll().catch(() => null);
  }
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const textOf = (selector, on = page) => on.$eval(selector, node => node.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const visible = (selector, on = page) => on.$eval(selector, node => Boolean(node.offsetParent)).catch(() => false);
/** İnsan hızında yazım (ders 12): alanı tıkla, temizle, harf harf yaz. */
const typeInto = async (selector, value) => {
  await page.click(selector);
  await page.fill(selector, "");
  await page.type(selector, value, { delay: 35 });
};
const kurus = value => Math.round(Number(value) * 100);
const num = text => Number(String(text || "").replace(/[^\d,-]/g, "").replace(",", "."));
const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const balanceOf = async id => Number((await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor);
const partyBalance = async id => (await must("cari", api.get(`/api/workspace/accounts/${id}`))).totals.balance;
const chequeOf = id => must("evrak", api.get(`${CHEQUES}/${id}`));
const integrity = async label => {
  const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  const bad = (result.checks || []).filter(item => !item.ok);
  ok(result.ok !== false && bad.length === 0, `${label}: Mutabakat Testi tamam${bad.length ? ` — ${bad.map(item => item.code).join(", ")}` : ""}`);
};
/** Alt Hesap Mizanı (API, Bu Yıl): çek 101.01 / 101.02 ve senet 121.01 / 121.02 bakiyesi (TL; satır yoksa 0). */
const subOf = async () => {
  const rows = (await must("alt hesap", api.get(`${BANK}/sub-trial?from=2026-01-01&to=2026-12-31`))).rows;
  const row = sub => rows.find(item => item.sub === sub) || { balance: 0, debit: 0, credit: 0 };
  return { portfolio: row("101.01"), bank: row("101.02"), notePortfolio: row("121.01"), noteBank: row("121.02") };
};

// ---------- Ekran yardımcıları ----------
const openCheques = async (status = "") => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=cheques]");
  await page.waitForSelector(`${CHQ} [data-act="new-in"]`, { timeout: 15000 });
  await page.selectOption(`${CHQ} select[data-filter="status"]`, status);
  await pause(900);
};
const openCard = async id => {
  await openCheques("");
  await page.waitForSelector(`${CHQ} tr[data-cheque="${id}"]`, { timeout: 15000 });
  await page.click(`${CHQ} tr[data-cheque="${id}"]`);
  await page.waitForSelector(`${CHQ} .hof-chq-actions`, { timeout: 15000 });
  await pause(400);
};
const cardTitle = () => textOf(`${CHQ} .hof-plan-title h3`);
/** Formu kaydeder; soru gelirse "Evet" der. Dönüş: formdaki hata metni ("" = kaydedildi, form kapandı). */
const submitForm = async () => {
  await page.click(`${FORM} button[type="submit"]`);
  for (let i = 0; i < 30; i += 1) {
    await pause(300);
    const yes = await page.$(`${top} [data-answer="yes"]`);
    if (yes) {
      await yes.click();
      continue;
    }
    const error = await page.$eval(`${FORM} .hof-form-error`, node => node.textContent.trim()).catch(() => "");
    if (error) return error;
    if (!(await page.$(`${FORM} input[name="date"]`))) return "";
  }
  return "form kapanmadı";
};
/** Kartta Bankaya Tahsile Ver formunu açar. */
const openDeposit = async () => {
  await page.click(`${CHQ} .hof-chq-actions [data-bank-action="bank-deposit"]`);
  await page.waitForSelector(`${FORM} [data-deposit-pick]`, { timeout: 10000 });
  await pause(400);
};

// Yazım düzeni ekranda (senaryo-211'in denetçisiyle aynı kural): programın ürettiği adlar her sözcüğün ilk harfi büyük.
const SMALL = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki"]);
const labelProblems = new Map();
async function auditLabels(where) {
  const texts = await page.evaluate(() => {
    const visibleNode = node => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
    };
    const own = node => [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.nodeValue).join(" ").replace(/\s+/g, " ").trim();
    const sentence = node => Boolean(node.closest("[data-sentence]") || node.closest("label")?.querySelector('input[type="checkbox"], input[type="radio"]'));
    const out = [];
    const take = (selector, read = own) => document.querySelectorAll(selector).forEach(node => visibleNode(node) && !sentence(node) && out.push(read(node)));
    take(".hof-modal-title, .hof-modal button:not(tbody button):not([data-open]), .hof-modal a.hof-button");
    take(".hof-modal thead th, .hof-modal .hof-field > span, .hof-modal label > span, .hof-modal legend, .hof-rep-stat > span, .hof-modal dt");
    take(".hof-modal select option", node => node.textContent.trim());
    return out;
  });
  for (const raw of texts) {
    const text = String(raw || "").split(" · ")[0].replace(/\([^)]*\)/g, "").replace(/[“”"][^“”"]*[“”"]/g, "").trim();
    if (!text || text.length > 60 || /[.!?]\s|[.!?]$/.test(text) || /\d{2}\.\d{2}\.\d{4}/.test(text) || /₺/.test(text)) continue;
    const words = text.split(/\s+/).filter(word => /\p{L}/u.test(word));
    if (words.length < 2) continue;
    const bad = words.slice(1).filter(word => /^[a-zçğıöşü]/.test(word) && !SMALL.has(word.replace(/[^\p{L}]/gu, "")));
    if (bad.length) labelProblems.set(raw.trim(), where);
  }
}

// ---------- Raporlar ekrandan (Rapor Merkezi) ----------
const rcPreview = () =>
  page.evaluate(selector => {
    const main = document.querySelector(`${selector} [data-rc-main]`);
    const text = node => node.textContent.replace(/\s+/g, " ").trim();
    return {
      heads: [...(main?.querySelectorAll("thead th") || [])].map(text),
      rows: [...(main?.querySelectorAll("tbody tr") || [])].map(row => [...row.querySelectorAll("td")].map(text)).filter(cells => cells.length > 1),
      footer: main?.querySelector("tfoot tr") ? [...main.querySelectorAll("tfoot td")].map(text) : null,
      text: main ? text(main) : "",
    };
  }, modal);
const waitRc = async (check, ms = 8000) => {
  const deadline = Date.now() + ms;
  let last = await rcPreview();
  while (!check(last) && Date.now() < deadline) {
    await pause(250);
    last = await rcPreview();
  }
  return last;
};
const openReports = async () => {
  await closeAll();
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${modal} [data-rc-list] [data-report="alt-hesap-mizani"]`, { timeout: 15000 });
};
/** Alt Hesap Mizanı satırı (ekran): { balance, debit, credit, side } — satır yoksa sıfır. */
const subRowOnScreen = (data, sub) => {
  const col = header => data.heads.indexOf(header);
  const row = data.rows.find(cells => cells[0] === sub);
  if (!row) return { found: false, balance: 0, debit: 0, credit: 0, side: "" };
  return { found: true, balance: num(row[col("Bakiye")]), debit: num(row[col("Borç")]), credit: num(row[col("Alacak")]), side: row[col("Yön")] };
};
/**
 * Her adımın rapor denetimi: API (Alt Hesap Mizanı) ve EKRAN — Rapor Merkezi → Alt Hesap Mizanı (Bu Yıl) 101.01 / 101.02 ve Tahsildeki Çek ve
 * Senetler (satır sayısı, TOPLAM = satırlar). expected: { portfolio, bank, notePortfolio, noteBank (senet 121; yoksa 0), held: [satır sayısı, TL] } (TL).
 * Tahsildeki TOPLAM = 101.02 + 121.02.
 */
async function checkReports(label, expected) {
  const noteP = expected.notePortfolio || 0;
  const noteB = expected.noteBank || 0;
  const subs = await subOf();
  ok(kurus(subs.notePortfolio.balance) === kurus(noteP) && kurus(subs.noteBank.balance) === kurus(noteB), `${label} · API Alt Hesap Mizanı: 121.01 ${subs.notePortfolio.balance} (beklenen ${noteP}), 121.02 ${subs.noteBank.balance} (beklenen ${noteB})`);
  ok(kurus(subs.portfolio.balance) === kurus(expected.portfolio) && kurus(subs.bank.balance) === kurus(expected.bank), `${label} · API Alt Hesap Mizanı: 101.01 ${subs.portfolio.balance} (beklenen ${expected.portfolio}), 101.02 ${subs.bank.balance} (beklenen ${expected.bank})`);
  await openReports();
  await page.click(`${modal} [data-rc-list] [data-report="alt-hesap-mizani"]`);
  let data = await waitRc(view => /Alt Hesap Mizanı/.test(view.text) && view.rows.some(cells => cells[0] === "101.01"));
  // Rapor Merkezi son dönemi hatırlar: Bu Yıl seçili değilse seçilir ve yeni dönem çizilene kadar beklenir.
  if (!(await page.$(`${modal} [data-rc-main] .hof-rep-chip[data-preset="thisYear"].is-on`))) {
    await page.click(`${modal} [data-rc-main] .hof-rep-chip[data-preset="thisYear"]`).catch(() => null);
    await page.waitForSelector(`${modal} [data-rc-main] .hof-rep-chip[data-preset="thisYear"].is-on`, { timeout: 8000 }).catch(() => null);
    await pause(500);
    data = await waitRc(view => view.rows.some(cells => cells[0] === "101.01"));
  }
  const p = subRowOnScreen(data, "101.01");
  const b = subRowOnScreen(data, "101.02");
  ok(kurus(p.balance) === kurus(expected.portfolio) && kurus(b.balance) === kurus(expected.bank), `${label} · EKRAN Alt Hesap Mizanı: 101.01 ${p.balance} ${p.side}, 101.02 ${b.balance} ${b.side}`);
  const np = subRowOnScreen(data, "121.01");
  const nb = subRowOnScreen(data, "121.02");
  ok(kurus(np.balance || 0) === kurus(noteP) && kurus(nb.balance || 0) === kurus(noteB), `${label} · EKRAN Alt Hesap Mizanı: 121.01 ${np.found ? np.balance : "yok"}, 121.02 ${nb.found ? nb.balance : "yok"} (beklenen ${noteP} / ${noteB})`);
  await page.click(`${modal} [data-rc-list] [data-report="tahsildeki-cekler"]`);
  const [count, total] = expected.held;
  data = await waitRc(view => /Tahsildeki Çek ve Senetler/.test(view.text) && view.rows.length === count);
  const col = header => data.heads.indexOf(header);
  const rowsSum = data.rows.reduce((sum, cells) => sum + kurus(num(cells[col("Tutar")])), 0);
  const footer = data.footer ? kurus(num(data.footer[col("Tutar")])) : 0;
  ok(data.rows.length === count && rowsSum === kurus(total) && footer === kurus(total) && kurus(total) === kurus(expected.bank + noteB), `${label} · EKRAN Tahsildeki Çek ve Senetler: ${data.rows.length} satır, TOPLAM ${footer / 100} = satırlar ${rowsSum / 100} = 101.02 ${expected.bank} + 121.02 ${noteB}`);
  await closeAll();
}

const ctx = {};
try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await pause(800);

  await step("Ön koşul (API): Ziraat · Çek Tahsil (Çek Kullan, 10.000), ABC borcu 10.000, çek C 1.500 portföyde", async () => {
    ctx.ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Çek Tahsil", kind: "demand", currency: "TRY", useCheque: true, opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));
    ctx.abc = await must("ABC", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await must("ABC borcu", api.post(`/api/workspace/accounts/${ctx.abc.id}/entries`, { kind: "debt", amount: "10.000", date: "2026-10-01", note: "Açılış borcu" }));
    ctx.c = await must("çek C", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.500", issueDate: "2026-10-05", dueDate: "2026-10-12", accountId: ctx.abc.id, serialNo: "TV-003", bank: "Halkbank Meram" }));
    ok((await balanceOf(ctx.ziraat.id)) === kurus(10000), "Ziraat 10.000");
    ok(kurus(await partyBalance(ctx.abc.id)) === kurus(8500), `ABC borcu 8.500 (10.000 − C 1.500): ${await partyBalance(ctx.abc.id)}`);
  });

  await step("S0 çek A 5.000 ekrandan alınır (cari ABC; tutar, no, banka insan hızında; Tab) → kartta Bankaya Tahsile Ver; 101.01 6.500", async () => {
    await openCheques("open");
    await page.click(`${CHQ} [data-act="new-in"]`);
    await page.waitForSelector(`${FORM} input[name="amount"]`, { timeout: 8000 });
    await page.click(`${FORM} [data-acc-query]`);
    await page.keyboard.type("ABC", { delay: 40 });
    await page.waitForSelector(`${top} li[data-id="${ctx.abc.id}"]`, { timeout: 10000 });
    await (await page.$(`${top} li[data-id="${ctx.abc.id}"]`)).dispatchEvent("mousedown");
    await typeInto(`${FORM} input[name="amount"]`, "5.000");
    await page.keyboard.press("Tab");
    await page.fill(`${FORM} input[name="dueDate"]`, "2026-10-31");
    await page.fill(`${FORM} input[name="issueDate"]`, "2026-10-05");
    await typeInto(`${FORM} input[name="serialNo"]`, "TV-001");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Akbank Kadıköy", { delay: 35 });
    ok((await page.$eval(`${FORM} input[name="bank"]`, node => node.value)) === "Akbank Kadıköy", "Tab ile Banka / Şube'ye geçildi, yazıldı");
    await page.click(`${FORM} button[type="submit"]`);
    await page.waitForSelector(`${CHQ} .hof-chq-actions`, { timeout: 10000 });
    await pause(500);
    ctx.a = (await must("liste", api.get(`${CHEQUES}?limit=50`))).cheques.find(item => item.serialNo === "TV-001");
    ok(ctx.a && ctx.a.amount === 5000 && ctx.a.accountId === ctx.abc.id && ctx.a.status === "portfolio", `sunucu: A 5.000, ABC, Portföyde (${ctx.a?.statusLabel})`);
    ok(await page.$(`${CHQ} .hof-chq-actions [data-bank-action="bank-deposit"]`), "kartta Bankaya Tahsile Ver düğmesi");
    ok(await page.$(`${CHQ} .hof-chq-actions [data-action="endorse"]:not([disabled])`), "portföydeki çekte Ciro Et açık");
    ok(kurus(await partyBalance(ctx.abc.id)) === kurus(3500), `ABC 3.500: ${await partyBalance(ctx.abc.id)}`);
    await shot("cek-a-portfoyde");
    await integrity("S0");
    await checkReports("S0", { portfolio: 6500, bank: 0, held: [0, 0] });
  });

  await step("S1 A → Bankaya Tahsile Ver: tek uygun hesap (Ziraat) bilgi satırı + bakiye; açıklama yazılır → Bankada Tahsilde; Ciro Et / Sil pasif ve nedeni yazılı", async () => {
    await openCard(ctx.a.id);
    await openDeposit();
    const pick = await textOf(`${FORM} [data-deposit-pick]`);
    ok(/Ziraat Bankası · Çek Tahsil hesabına tahsile verilir\./.test(pick) && !(await page.$(`${FORM} [data-deposit-pick] select`)), `tek hesap bilgi satırı (seçim yok): ${pick}`);
    ok(/Bakiye \(08\.10\.2026\): ₺?10\.000,00/.test(pick), `bakiye satırı: ${pick}`);
    ok((await page.$eval(`${FORM} input[name="date"]`, node => node.value)) === "2026-10-08", "İşlem Tarihi bugün");
    await typeInto(`${FORM} input[name="note"]`, "Tahsil bordrosu 1");
    await page.keyboard.press("Tab");
    await shot("tahsile-ver-formu");
    const error = await submitForm();
    ok(error === "", `kaydedildi${error ? `: ${error}` : ""}`);
    await pause(600);
    const a = await chequeOf(ctx.a.id);
    ok(a.deposited === true && a.collection?.bankAccountId === ctx.ziraat.id && a.status === "portfolio", `sunucu: Bankada Tahsilde, Ziraat (durum ${a.status})`);
    ok(/Bankada Tahsilde · Ziraat Bankası · 08\.10\.2026/.test(await cardTitle()), `kart: ${await cardTitle()}`);
    const why = await textOf(`${CHQ} [data-chq-why]`);
    ok((await page.$(`${CHQ} .hof-chq-actions [data-off="Ciro Et"][disabled]`)) && !(await page.$(`${CHQ} .hof-chq-actions [data-action="endorse"]`)), "Ciro Et pasif");
    ok(await page.$(`${CHQ} .hof-chq-actions [data-off="Sil"][disabled]`), "Sil pasif");
    ok((await visible(`${CHQ} [data-chq-why]`)) && /Ciro Et ve Sil kapalı/.test(why) && /Bankadan Geri Al/.test(why) && /Ziraat Bankası · Çek Tahsil/.test(why), `neden düğmelerin yanında görünür yazı: ${why}`);
    ok(await page.$(`${CHQ} .hof-chq-actions [data-bank-action="bank-withdraw"]`), "Bankadan Geri Al düğmesi");
    ok((await page.$(`${CHQ} .hof-chq-actions [data-action="collect"]`)) && (await page.$(`${CHQ} .hof-chq-actions [data-action="bounce"]`)), "Tahsil Et ve Karşılıksız / İade açık");
    const facts = await page.$eval(`${CHQ} .hof-chq-facts`, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
    ok(/Bankada Tahsilde\s*Ziraat Bankası · Çek Tahsil · 08\.10\.2026 · BNK-2026-\d{6}/.test(facts), `kartta tahsil bilgisi: ${facts.slice(0, 200)}`);
    ok(/Bankaya Tahsile Verildi/.test(await textOf(`${CHQ} [data-chq-collections]`)), "Banka Tahsil Kayıtları");
    await shot("bankada-tahsilde-kart");
    // Düzenle: yalnız no, banka, açıklama (tutar, vade, alış tarihi yok).
    await page.click(`${CHQ} .hof-chq-actions [data-act="edit"]`);
    await page.waitForSelector(`${FORM} input[name="serialNo"]`, { timeout: 8000 });
    ok(!(await page.$(`${FORM} input[name="amount"]`)) && !(await page.$(`${FORM} input[name="dueDate"]`)) && !(await page.$(`${FORM} input[name="issueDate"]`)), "Düzenle'de tutar, vade, alış tarihi yok");
    await page.click(`${top} [data-cancel]`);
    await pause(400);
    // Sunucu da: ciro 409 cheque-deposited (ekranın pasif düğmesi tek güvenlik değil).
    const endorse = await api.post(`${CHEQUES}/${ctx.a.id}/actions`, { action: "endorse", date: "2026-10-08", accountId: ctx.abc.id });
    ok(endorse.status === 409 && unwrap(endorse)?.code === "cheque-deposited", `API ciro: ${endorse.status} ${unwrap(endorse)?.code}`);
    // Liste: durum metni ve "Bankada Tahsilde" süzgeci.
    await openCheques("deposited");
    const rows = await page.$$eval(`${CHQ} tr[data-cheque]`, nodes => nodes.map(node => [node.dataset.cheque, node.querySelector(".hof-chq-status")?.textContent.trim()]));
    ok(rows.length === 1 && rows[0][0] === ctx.a.id && rows[0][1] === "Bankada Tahsilde · Ziraat Bankası · 08.10.2026", `Bankada Tahsilde süzgeci: ${JSON.stringify(rows)}`);
    ok((await balanceOf(ctx.ziraat.id)) === kurus(10000), "Ziraat değişmedi (10.000)");
    await shot("liste-bankada-tahsilde");
    await integrity("S1");
    await checkReports("S1", { portfolio: 1500, bank: 5000, held: [1, 5000] });
  });

  await step("S2 Bankadan Geri Al → Portföyde; 101.01 6.500, 101.02 0", async () => {
    await openCard(ctx.a.id);
    await page.click(`${CHQ} .hof-chq-actions [data-bank-action="bank-withdraw"]`);
    await page.waitForSelector(`${FORM} input[name="note"]`, { timeout: 8000 });
    ok(/Ziraat Bankası · Çek Tahsil hesabından geri alınır/.test(await textOf(`${top} .hof-modal-text`)), "açıklama hesabı söyler");
    await typeInto(`${FORM} input[name="note"]`, "Banka iade etti");
    await page.keyboard.press("Tab");
    const error = await submitForm();
    ok(error === "", `kaydedildi${error ? `: ${error}` : ""}`);
    await pause(600);
    const a = await chequeOf(ctx.a.id);
    ok(a.deposited === false && a.statusLabel === "Portföyde", `sunucu: ${a.statusLabel}`);
    ok(/Portföyde/.test(await cardTitle()) && (await page.$(`${CHQ} .hof-chq-actions [data-action="endorse"]:not([disabled])`)) && !(await page.$(`${CHQ} [data-chq-why]`)), "kart Portföyde, Ciro Et yeniden açık, neden yazısı yok");
    ok(/Bankadan Geri Alındı/.test(await textOf(`${CHQ} [data-chq-collections]`)), "tahsil kaydı geçmişinde Bankadan Geri Alındı");
    await integrity("S2");
    await checkReports("S2", { portfolio: 6500, bank: 0, held: [0, 0] });
  });

  await step("S3 yeniden Bankaya Tahsile Ver → 101.01 1.500, 101.02 5.000", async () => {
    await openCard(ctx.a.id);
    await openDeposit();
    const error = await submitForm();
    ok(error === "", `kaydedildi${error ? `: ${error}` : ""}`);
    await pause(600);
    ok((await chequeOf(ctx.a.id)).deposited === true, "sunucu: yeniden Bankada Tahsilde");
    await integrity("S3");
    await checkReports("S3", { portfolio: 1500, bank: 5000, held: [1, 5000] });
  });

  await step("S4 Tahsil Et: yol Havale / EFT ve hesap Ziraat sabit (salt okunur, nedeni yazılı; nakit yok); İşlemden Sonra 15.000 → Ziraat 15.000", async () => {
    await openCard(ctx.a.id);
    await page.click(`${CHQ} .hof-chq-actions [data-action="collect"]`);
    await page.waitForSelector(`${FORM} input[name="heldAccount"]`, { timeout: 8000 });
    await pause(600);
    const method = await page.$eval(`${FORM} input[name="heldMethod"]`, node => [node.value, node.readOnly]);
    const account = await page.$eval(`${FORM} input[name="heldAccount"]`, node => [node.value, node.readOnly]);
    ok(method[0] === "Havale / EFT" && method[1] === true, `Tahsil Yolu: ${method.join(" · salt okunur ")}`);
    ok(account[0] === "Ziraat Bankası · Çek Tahsil" && account[1] === true, `Tahsil Edilen Hesap: ${account.join(" · salt okunur ")}`);
    ok(!(await page.$(`${FORM} select[name="method"]`)) && !(await page.$(`${FORM} select[name="bankAccountId"]`)) && !/Nakit Kasa/.test(await textOf(FORM)), "yol ve hesap seçimi yok, nakit seçeneği yok");
    const field = await textOf(`${FORM} label:has(input[name="heldAccount"])`);
    ok(/Evrak bu hesapta tahsilde; tahsil bu hesaba yazılır/.test(field) && /Bankadan Geri Al/.test(field), `neden yazılı: ${field}`);
    ok(/İşlemden Sonra: ₺?15\.000,00/.test(field), `bakiye satırı: ${field}`);
    await shot("tahsil-et-sabit-hesap");
    await typeInto(`${FORM} input[name="note"]`, "Bankadan tahsil");
    await page.keyboard.press("Tab");
    const error = await submitForm();
    ok(error === "", `kaydedildi${error ? `: ${error}` : ""}`);
    await pause(600);
    const a = await chequeOf(ctx.a.id);
    ok(a.status === "collected" && a.deposited === false, `sunucu: ${a.statusLabel}`);
    ok((await balanceOf(ctx.ziraat.id)) === kurus(15000), `Ziraat 15.000: ${(await balanceOf(ctx.ziraat.id)) / 100}`);
    await integrity("S4");
    await checkReports("S4", { portfolio: 1500, bank: 0, held: [0, 0] });
  });

  await step("S5 senet B 2.000 (API); Senet Kullan hesabı yok → yetkisiz (avukat) \"Banka hesabı tanımlı değil, yöneticinize başvurun.\" (düğme yok)", async () => {
    ctx.b = await must("senet B", api.post(CHEQUES, { direction: "in", instrument: "note", amount: "2.000", issueDate: "2026-10-06", dueDate: "2026-11-06", accountId: ctx.abc.id, serialNo: "TV-002" }));
    ok(kurus(await partyBalance(ctx.abc.id)) === kurus(1500), `ABC 1.500: ${await partyBalance(ctx.abc.id)}`);
    ok((await chequeOf(ctx.b.id)).depositAccounts.length === 0, "senet için uygun hesap yok (Ziraat yalnız Çek Kullan)");
    await must("avukat", api.post("/api/admin/users", { username: "avukat-tv", name: "Avukat TV", role: "avukat", password: "Avukat-2026!", mustChangePassword: false }));
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const other = await context2.newPage();
    other.on("pageerror", error => errors.push(`pageerror (avukat) ${error.message}`));
    await installPageClock(other, app.config.now);
    await other.goto(`${BASE}/`);
    await other.fill("#hof-auth input[name=username]", "avukat-tv");
    await other.fill("#hof-auth input[name=password]", "Avukat-2026!");
    await Promise.all([other.waitForEvent("load"), other.click('#hof-auth button[type="submit"]')]);
    await other.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await other.waitForTimeout(800);
    await other.click("#hof-sidecard [data-action=cheques]");
    await other.waitForSelector(`${CHQ} tr[data-cheque="${ctx.b.id}"]`, { timeout: 15000 });
    await other.click(`${CHQ} tr[data-cheque="${ctx.b.id}"]`);
    await other.waitForSelector(`${CHQ} [data-bank-action="bank-deposit"]`, { timeout: 10000 });
    await other.click(`${CHQ} [data-bank-action="bank-deposit"]`);
    await other.waitForSelector(`${FORM} [data-bank-define-missing="deposit-note"]`, { timeout: 10000 });
    ok((await other.$eval(`${FORM} [data-bank-define-missing="deposit-note"]`, node => node.textContent.trim())) === "Banka hesabı tanımlı değil, yöneticinize başvurun.", "yetkisiz yazısı");
    ok(!(await other.$(`${FORM} [data-bank-define="deposit-note"]`)), "Banka Hesabı Tanımla düğmesi yok");
    // Kaydet: sunucu hesap yok der (metin işareti söyler), hiçbir şey yazılmaz.
    await other.click(`${FORM} button[type="submit"]`);
    await other.waitForTimeout(1200);
    const error = await other.$eval(`${FORM} .hof-form-error`, node => node.textContent.trim()).catch(() => "");
    ok(/“Senet Kullan” işaretli/.test(error), `kaydet: ${error}`);
    ok((await chequeOf(ctx.b.id)).deposited === false, "senet portföyde kaldı");
    await other.screenshot({ path: path.join(OUT, "00-avukat-banka-hesabi-tanimli-degil.png") });
    await context2.close();
    await integrity("S5");
    await checkReports("S5", { portfolio: 1500, bank: 0, notePortfolio: 2000, held: [0, 0] });
  });

  await step("S6 yönetici: \"Banka Hesabı Tanımla\" (Vazgeç: form aynen) → \"+ Yeni Banka Hesabı\" Senet Kullan işaretli gelir → Garanti açılır, seçili gelir → tahsile ver", async () => {
    await openCard(ctx.b.id);
    await openDeposit();
    await typeInto(`${FORM} input[name="note"]`, "Senet bordrosu");
    await page.keyboard.press("Tab");
    ok(await page.$(`${FORM} [data-bank-define="deposit-note"]`), "Banka Hesabı Tanımla düğmesi");
    await shot("senet-hesap-yok-tanimla");
    await page.click(`${FORM} [data-bank-define="deposit-note"]`);
    await page.waitForSelector(`${top} .hof-form select[name="accountId"]`, { timeout: 8000 });
    ok(/Banka Hesabı Tanımla/.test(await textOf(`${top} .hof-modal-title`)), "üstte Banka Hesabı Tanımla penceresi");
    const options = await page.$$eval(`${top} .hof-form select[name="accountId"] option`, nodes => nodes.map(node => [node.value, node.textContent.trim()]));
    ok(options.some(([value]) => value === ctx.ziraat.id) && options.some(([value]) => value === "new"), `seçenekler: işaretsiz Ziraat ve + Yeni Banka Hesabı (${options.map(item => item[1]).join(" | ")})`);
    await page.click(`${top} [data-cancel]`);
    await pause(500);
    ok((await page.$eval(`${FORM} input[name="note"]`, node => node.value)) === "Senet bordrosu" && (await page.$(`${FORM} [data-bank-define="deposit-note"]`)), "Vazgeç: tahsile verme formu aynen (açıklama duruyor)");
    await page.click(`${FORM} [data-bank-define="deposit-note"]`);
    await page.waitForSelector(`${top} .hof-form select[name="accountId"]`, { timeout: 8000 });
    await page.selectOption(`${top} .hof-form select[name="accountId"]`, "new");
    await page.click(`${top} .hof-form button[type="submit"]`);
    await page.waitForSelector(`${top} .hof-form input[name="bankName"]`, { timeout: 8000 });
    const flags = await page.$eval(`${top} .hof-form`, form => ({ note: form.querySelector('[name="useNote"]').checked, cheque: form.querySelector('[name="useCheque"]').checked }));
    ok(flags.note === true && flags.cheque === false, `hesap formunda Senet Kullan işaretli, Çek Kullan değil: ${JSON.stringify(flags)}`);
    await shot("tanimla-senet-kullan-isaretli");
    await typeInto(`${top} .hof-form input[name="bankName"]`, "Garanti BBVA");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Senet Tahsil", { delay: 35 });
    await page.click(`${top} .hof-form button[type="submit"]`);
    await page.waitForSelector(`${FORM} [data-deposit-pick] [data-bank-single]`, { timeout: 12000 });
    await pause(500);
    ctx.garanti = (await must("hesaplar", api.get(`${BANK}/accounts`))).accounts.find(item => item.bankName === "Garanti BBVA");
    ok(ctx.garanti && ctx.garanti.useNote === true && ctx.garanti.useCheque === false, `sunucu: Garanti · Senet Tahsil, Senet Kullan (${JSON.stringify({ useNote: ctx.garanti?.useNote, useCheque: ctx.garanti?.useCheque })})`);
    const pick = await textOf(`${FORM} [data-deposit-pick]`);
    ok(/Garanti BBVA · Senet Tahsil hesabına tahsile verilir\./.test(pick), `yeni hesap formda seçili (tek hesap): ${pick}`);
    ok((await page.$eval(`${FORM} input[name="note"]`, node => node.value)) === "Senet bordrosu", "tahsile verme formu kapanmadı, açıklama kaybolmadı");
    const error = await submitForm();
    ok(error === "", `kaydedildi${error ? `: ${error}` : ""}`);
    await pause(600);
    const b = await chequeOf(ctx.b.id);
    ok(b.deposited === true && b.collection?.bankAccountId === ctx.garanti.id, `sunucu: senet Garanti'de tahsilde (${b.statusLabel})`);
    ok((await balanceOf(ctx.garanti.id)) === 0, "Garanti bakiyesi 0 (tahsile verme para hareketi değil)");
    await integrity("S6");
    await checkReports("S6", { portfolio: 1500, bank: 0, noteBank: 2000, held: [1, 2000] });
  });

  await step("S6 liste süzgeçleri (ders 11): her Durum seçeneğinin satırları ve toplamı; özet kutuları (Portföyde 1.500, Bankada Tahsilde 2.000)", async () => {
    const expected = [
      ["open", [ctx.b.id, ctx.c.id], 3500],
      ["overdue", [], 0],
      ["soon", [ctx.c.id], 1500],
      ["portfolio", [ctx.c.id], 1500],
      ["deposited", [ctx.b.id], 2000],
      ["", [ctx.a.id, ctx.b.id, ctx.c.id], 8500],
      ["collected", [ctx.a.id], 5000],
      ["endorsed", [], 0],
      ["bounced", [], 0],
      ["paid", [], 0],
    ];
    await openCheques("open");
    const values = await page.$$eval(`${CHQ} select[data-filter="status"] option`, nodes => nodes.map(node => node.value));
    ok(values.join(",") === expected.map(([value]) => value).join(","), `Durum seçenekleri: ${values.join(", ")}`);
    const labels = await page.$$eval(`${CHQ} select[data-filter="status"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(labels.includes("Portföyde") && labels.includes("Bankada Tahsilde"), `"Portföyde" ve "Bankada Tahsilde" ayrı: ${labels.join(" | ")}`);
    for (const [value, ids, total] of expected) {
      await page.selectOption(`${CHQ} select[data-filter="status"]`, value);
      await pause(900);
      const rows = await page.$$eval(`${CHQ} tr[data-cheque]`, nodes => nodes.map(node => [node.dataset.cheque, node.querySelector("td.num")?.textContent || ""]));
      const sum = rows.reduce((acc, [, amount]) => acc + kurus(num(amount)), 0);
      const note = await textOf(`${CHQ} .hof-rep-note`);
      const noteTotal = kurus(num(note.split("·")[1] || ""));
      ok(rows.map(([id]) => id).sort().join(",") === [...ids].sort().join(",") && sum === kurus(total) && noteTotal === kurus(total), `Durum “${labels[values.indexOf(value)]}”: ${rows.length} satır, satırlar ${sum / 100}, alt toplam ${noteTotal / 100} (beklenen ${ids.length} satır, ${total})`);
    }
    await page.selectOption(`${CHQ} select[data-filter="status"]`, "open");
    await pause(900);
    const tiles = await page.$$eval(`${CHQ} .hof-rep-stat`, nodes => nodes.map(node => [node.querySelector("span")?.textContent.trim(), node.querySelector("strong")?.textContent.trim(), node.querySelector("small")?.textContent.trim()]));
    const tile = label => tiles.find(item => item[0] === label) || [];
    ok(kurus(num(tile("Portföyde (alınan)")[1])) === kurus(1500) && /^1 evrak/.test(tile("Portföyde (alınan)")[2] || ""), `Portföyde (alınan): ${tile("Portföyde (alınan)").join(" · ")}`);
    ok(kurus(num(tile("Bankada Tahsilde")[1])) === kurus(2000) && /^1 evrak/.test(tile("Bankada Tahsilde")[2] || ""), `Bankada Tahsilde: ${tile("Bankada Tahsilde").join(" · ")}`);
    await shot("liste-ozet-kutulari");
  });

  await step("S7 senet B Karşılıksız / İade (bankadan döndü) → tahsil kaydı kapanır; ABC borcu 3.500 (cari borcu geri); 101.02 0", async () => {
    await openCard(ctx.b.id);
    await page.click(`${CHQ} .hof-chq-actions [data-action="bounce"]`);
    await page.waitForSelector(`${FORM} input[name="note"]`, { timeout: 8000 });
    ok(/bankadan karşılıksız döndü/.test(await textOf(`${top} .hof-modal-text`)), "açıklama: bankadan karşılıksız döndü");
    await typeInto(`${FORM} input[name="note"]`, "Bankadan döndü");
    await page.keyboard.press("Tab");
    const error = await submitForm();
    ok(error === "", `kaydedildi${error ? `: ${error}` : ""}`);
    await pause(600);
    const b = await chequeOf(ctx.b.id);
    ok(b.status === "bounced" && b.deposited === false && b.collections?.at(-1)?.status === "returned", `sunucu: ${b.statusLabel}, tahsil kaydı ${b.collections?.at(-1)?.statusLabel}`);
    ok(kurus(await partyBalance(ctx.abc.id)) === kurus(3500), `ABC borcu 3.500: ${await partyBalance(ctx.abc.id)}`);
    ok(/Karşılıksız Döndü/.test(await textOf(`${CHQ} [data-chq-collections]`)), "Banka Tahsil Kayıtları: Karşılıksız Döndü");
    ok((await balanceOf(ctx.garanti.id)) === 0, "Garanti bakiyesi 0");
    await openCheques("bounced");
    const rows = await page.$$eval(`${CHQ} tr[data-cheque]`, nodes => nodes.map(node => node.dataset.cheque));
    ok(rows.join(",") === ctx.b.id, `Karşılıksız / İade süzgeci: ${rows.length} satır`);
    await integrity("S7");
    await checkReports("S7", { portfolio: 1500, bank: 0, held: [0, 0] });
  });

  await step("S8 çek C: Garanti'ye de Çek Kullan → seçimde iki hesap bakiyeleriyle (ön seçim yok, zorunlu); senet hesabı yalnız Senet Kullan'da", async () => {
    await must("Garanti Çek Kullan", api.put(`${BANK}/accounts/${ctx.garanti.id}`, { useCheque: true }));
    await openCard(ctx.c.id);
    await openDeposit();
    const select = `${FORM} [data-deposit-pick] select[name="bankAccountId"]`;
    await page.waitForSelector(select, { timeout: 8000 });
    const options = await page.$$eval(`${select} option`, nodes => nodes.map(node => [node.value, node.textContent.trim()]));
    ok(options.length === 3 && options[0][0] === "" && /Ziraat Bankası · Çek Tahsil .* — ₺?15\.000,00/.test(options[1][1]) && /Garanti BBVA · Senet Tahsil .* — ₺?0,00/.test(options[2][1]), `seçenekler bakiyeleriyle: ${options.map(item => item[1]).join(" | ")}`);
    ok((await page.$eval(select, node => [node.value, node.required])).join() === ",true", "ön seçim yok, seçim zorunlu");
    await page.selectOption(select, ctx.garanti.id);
    await pause(300);
    ok(/Bakiye \(08\.10\.2026\): ₺?0,00/.test(await textOf(`${FORM} [data-deposit-pick]`)), "seçilen hesabın bakiye satırı");
    await shot("cek-iki-hesap-secim");
    // Bakiye SEÇİLEN TARİHTE (İz 2.7): 07.10'da Ziraat 10.000 (A'nın tahsili 08.10'da); seçim korunur.
    await page.fill(`${FORM} input[name="date"]`, "2026-10-07");
    await pause(1200);
    const dated = await page.$$eval(`${select} option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(/Ziraat Bankası · Çek Tahsil .* — ₺?10\.000,00/.test(dated[1] || "") && (await page.$eval(select, node => node.value)) === ctx.garanti.id, `tarih 07.10: ${dated.join(" | ")}; seçim Garanti'de kaldı`);
    await page.click(`${top} [data-cancel]`);
    await pause(400);
    ok((await chequeOf(ctx.c.id)).deposited === false, "Vazgeç: C portföyde");
    // Senet Kullan'sız ama Çek Kullan'lı hesap (Ziraat) senette seçilmez: yeni senet D'nin seçicisi yalnız Garanti.
    const d = await must("senet D", api.post(CHEQUES, { direction: "in", instrument: "note", amount: "300", issueDate: "2026-10-07", dueDate: "2026-12-07", accountId: ctx.abc.id, serialNo: "TV-004" }));
    ok((await chequeOf(d.id)).depositAccounts.map(item => item.id).join() === ctx.garanti.id, "senet seçicisi: yalnız Senet Kullan (Garanti)");
    await must("senet D sil", api.del(`${CHEQUES}/${d.id}`));
    await closeAll();
  });

  await step("Son: Alt Hesap Mizanı dönem düğmeleri (ekran) — Bu Yıl / Bu Ay / Son 30 Gün / Tüm Zamanlar: çek 101.01 B 11.500 A 10.000, 101.02 B 10.000 A 10.000; senet 121.01 B 2.000 A 2.000, 121.02 B 2.000 A 2.000; Geçen Ay 101/121 satırı yok", async () => {
    await openReports();
    await page.click(`${modal} [data-rc-list] [data-report="alt-hesap-mizani"]`);
    await waitRc(view => /Alt Hesap Mizanı/.test(view.text));
    for (const [preset, present] of [["thisYear", true], ["thisMonth", true], ["last30", true], ["all", true], ["lastMonth", false]]) {
      const chip = `${modal} [data-rc-main] .hof-rep-chip[data-preset="${preset}"]`;
      if (!(await page.$(chip))) {
        ok(false, `dönem düğmesi ${preset} yok`);
        continue;
      }
      await page.click(chip);
      // Seçilen düğme işaretlenene (yeni dönem çizilene) kadar bekle; önceki dönemin tablosu okunmasın.
      await page.waitForSelector(`${chip}.is-on`, { timeout: 8000 }).catch(() => null);
      await pause(500);
      const data = await waitRc(view => (present ? view.rows.some(cells => cells[0] === "101.01") : !view.rows.some(cells => cells[0] === "101.01")));
      const p = subRowOnScreen(data, "101.01");
      const b = subRowOnScreen(data, "101.02");
      const np = subRowOnScreen(data, "121.01");
      const nb = subRowOnScreen(data, "121.02");
      if (present) ok(kurus(p.debit) === kurus(11500) && kurus(p.credit) === kurus(10000) && kurus(p.balance) === kurus(1500) && kurus(b.debit) === kurus(10000) && kurus(b.credit) === kurus(10000) && kurus(b.balance) === 0 && kurus(np.debit) === kurus(2000) && kurus(np.credit) === kurus(2000) && kurus(nb.debit) === kurus(2000) && kurus(nb.credit) === kurus(2000), `${preset}: 101.01 B ${p.debit} A ${p.credit} = ${p.balance} ${p.side}; 101.02 B ${b.debit} A ${b.credit} = ${b.balance}; 121.01 B ${np.debit} A ${np.credit}; 121.02 B ${nb.debit} A ${nb.credit}`);
      else ok(!p.found && !b.found && !np.found && !nb.found, `${preset}: 101 / 121 satırı yok`);
    }
    await page.click(`${modal} [data-rc-main] .hof-rep-chip[data-preset="thisYear"]`);
    await pause(600);
    await shot("alt-hesap-mizani-son");
    const sub = await subOf();
    ok(kurus(sub.portfolio.debit) === kurus(11500) && kurus(sub.portfolio.credit) === kurus(10000) && kurus(sub.bank.debit) === kurus(10000) && kurus(sub.bank.credit) === kurus(10000) && kurus(sub.notePortfolio.debit) === kurus(2000) && kurus(sub.notePortfolio.credit) === kurus(2000) && kurus(sub.noteBank.debit) === kurus(2000) && kurus(sub.noteBank.credit) === kurus(2000), `API Alt Hesap Mizanı: 101.01 B ${sub.portfolio.debit} A ${sub.portfolio.credit}; 101.02 B ${sub.bank.debit} A ${sub.bank.credit}; 121.01 B ${sub.notePortfolio.debit} A ${sub.notePortfolio.credit}; 121.02 B ${sub.noteBank.debit} A ${sub.noteBank.credit}`);
    await closeAll();
    await integrity("son");
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(labelProblems.size === 0, `Bankaya Tahsile Ver ekranlarında yazım düzeni (her sözcüğün ilk harfi büyük)${labelProblems.size ? `: ${[...labelProblems].slice(0, 8).map(([label, where]) => `“${label}” (${where})`).join(", ")}` : ""}`);
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-tahsile-ver-220: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
