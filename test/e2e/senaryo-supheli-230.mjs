// 2.3.0 İz 1.6/1.7 — Şüpheli Ticari Alacaklar EKRANDAN (docs/BANKA-MODULU-PLAN.md §3.11b; kabul docs/2.3.0-SUPHELI-KABUL.md §2 adım 0–4; sunucu
// kuralı test/banka-230-supheli.test.mjs, ekran verisi test/banka-230-supheli-ekran.test.mjs). Sahte saat bugün; bütün hareketler BUGÜN (ders 13:
// ay/yıl sınırına bağlı değil; aynı gün sırası K3: al → karşılık → tahsilat).
//   1 Cari kartı (yönetici): Borç Yaz 10.000 → Şüpheli Alacağa Al 4.000 (Dava) → Karşılık Ayır 2.500 → + Tahsilat 3.000 → Değersiz Alacak Yaz 1.000
//     (onay; Vazgeç formda "Kaydedilmedi"). Her adımda kartın Şüpheli Alacak bilgisi, rozet ve bakiye; sonunda mizan 128 = 0, 129 = 0, 644 = −1.500,
//     654 = 2.500, 120 = 6.000, Kasa 3.000. Sınır: 7.000 (> 6.000) → form kapanmadan "aşıyor".
//   2 Liste rozeti, ANLIK DURUM "Şüpheli Alacak" satırı, Vade Takip kutusu, Rapor Merkezi → Şüpheli Alacaklar (Durum ve Neden her seçenek, TOPLAM),
//     Alacak Yaşlandırma kolonu, Hesap Planı Mizanı 128/129.
//   3 Karşılıksız çek kartından "Şüpheli Alacağa Al" (neden ve tutar evraktan).
//   4 Kaydı sil → Silinenler'den geri yükle (sayılar döner).
//   5 Personel: düğme yok, bilgi görünür. Avukat (Cari Yönetimi var, Şüpheli Alacak İşlemleri yok): Borç Yaz var, şüpheli düğmeleri yok; çek kartında kısayol yok.
// Çıkış: "N geçti, M kaldı". Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";

const PASS = "Personel-2026!";
const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const root = mkdtempSync(path.join(tmpdir(), "senaryo-supheli-230-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: `${D0}T12:00:00+03:00` }, logLevel: "warn" });
const admin = await server.login();
const BASE = server.base;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("personel", admin.post("/api/admin/users", { username: "personel", name: "Personel", role: "personel", password: PASS, mustChangePassword: false }));
// Avukat: Cari Yönetimi ve Çek/Senet görme VAR, Şüpheli Alacak İşlemleri YOK → kartta Borç Yaz var, şüpheli düğmeleri yok; çek kartında kısayol yok.
await must("avukat", admin.post("/api/admin/users", { username: "avukat", name: "Avukat", role: "avukat", password: PASS, mustChangePassword: false }));
const abc = await must("ABC", admin.post("/api/workspace/accounts", { name: "Şüpheli Ekran Müşterisi", type: "customer", registeredOn: D0 }));

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
const top = `${modal}:last-of-type`;
const card = ".hof-accounts-modal";
const CHQ = ".hof-cheques-modal";
async function login(username, password) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(`${username}: ${error.message}`));
  await installPageClock(page, server.app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  return page;
}
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const num = text => Number(String(text || "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
const kurus = value => Math.round(Number(value) * 100);
const closeAll = async page => {
  for (let index = 0; index < 8 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
};
const shot = async (page, name, focus = "") => {
  // Pencere içi kaydırma: Şüpheli Alacak bölümü kartın altındadır; görüntüde görünsün.
  if (focus) await page.$eval(focus, node => node.scrollIntoView({ block: "center" })).catch(() => null);
  await page.waitForTimeout(250);
  return page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }).catch(() => null);
};
const openCard = async (page, id) => {
  await closeAll(page);
  await page.evaluate(accountId => window.HOF.accounts.open(accountId), id);
  await page.waitForSelector(`${card} .hof-plan-head`, { timeout: 10000 });
  await page.waitForTimeout(400);
};
const submit = async page => {
  await page.click(`${top} .hof-form button[type="submit"]`);
  await page.waitForTimeout(700);
};
const formClosed = page => page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible .hof-form"), null, { timeout: 10000 });
/** Kartın Şüpheli Alacak bilgisi (TL): { taken, provision, collected, writtenOff, released, open } — yoksa null. */
const facts = async page => {
  if (!(await page.$(`${card} [data-doubtful-facts]`))) return null;
  return page.$eval(`${card} [data-doubtful-facts]`, node => Object.fromEntries([...node.querySelectorAll("[data-dbt]")].map(dd => [dd.dataset.dbt, dd.textContent.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")])));
};
const factsEqual = async (page, expected, label) => {
  const got = await facts(page);
  const same = got && Object.entries(expected).every(([key, value]) => kurus(got[key]) === kurus(value));
  return ok(same, `${label}: Şüpheli Alacak bilgisi ${JSON.stringify(got)} (beklenen ${JSON.stringify(expected)})`);
};
const waitFacts = (page, key, value) => page.waitForFunction(([k, v]) => {
  const dd = document.querySelector(`.hof-accounts-modal [data-doubtful-facts] [data-dbt="${k}"]`);
  if (!dd) return false;
  const n = Number(dd.textContent.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Math.round(n * 100) === Math.round(v * 100);
}, [key, value], { timeout: 10000 });
const balanceOnScreen = page => textOf(page, `${card} .hof-plans-kpis .hof-cash-balance strong`).then(num);
const trial = async () => {
  const ledger = await must("mizan", admin.get("/api/workspace/ledger"));
  const map = Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance]));
  return code => map[String(code)] ?? 0;
};
const summaryOf = async id => (await must("özet", admin.get(`/api/workspace/accounts/${id}/doubtful`))).summary;

// Rapor Merkezi ön izlemesi (senaryo-tahsile-ver-220 kalıbı).
const rcPreview = page =>
  page.evaluate(selector => {
    const main = document.querySelector(`${selector} [data-rc-main]`);
    const text = node => node.textContent.replace(/\s+/g, " ").trim();
    return {
      busy: main?.getAttribute("aria-busy") === "true",
      heads: [...(main?.querySelectorAll("thead th") || [])].map(text),
      rows: [...(main?.querySelectorAll("tbody tr") || [])].map(row => [...row.querySelectorAll("td")].map(text)).filter(cells => cells.length > 1),
      footer: main?.querySelector("tfoot tr") ? [...main.querySelectorAll("tfoot td")].map(text) : null,
      text: main ? text(main) : "",
    };
  }, modal);
const waitRc = async (page, check, ms = 8000) => {
  const deadline = Date.now() + ms;
  let last = await rcPreview(page);
  while ((last.busy || !check(last)) && Date.now() < deadline) {
    await page.waitForTimeout(250);
    last = await rcPreview(page);
  }
  return last;
};
const openReports = async page => {
  await closeAll(page);
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${modal} [data-rc-list] [data-report="supheli-alacaklar"]`, { timeout: 15000 });
};
const ensureThisYear = async page => {
  if (!(await page.$(`${modal} [data-rc-main] .hof-rep-chip[data-preset="thisYear"].is-on`))) {
    await page.click(`${modal} [data-rc-main] .hof-rep-chip[data-preset="thisYear"]`).catch(() => null);
    await page.waitForTimeout(600);
  }
};
const setParam = async (page, name, value) => {
  await page.selectOption(`${modal} [data-rc-main] select[data-param="${name}"]`, value);
  await page.waitForTimeout(700);
};

try {
  const page = await login("admin", ADMIN_PASSWORD);
  console.log("\n■ 1 Cari kartı: Borç Yaz 10.000 → Şüpheli Alacağa Al 4.000 → Karşılık 2.500 → Tahsilat 3.000 → Değersiz 1.000 (kabul §2 adım 0–4)");
  await openCard(page, abc.id);
  ok(await page.$(`${card} [data-doubtful-empty]`), "boş kartta “Şüpheli alacak yok” yazısı");
  ok(await page.$(`${card} [data-act="doubtfulTake"]`), "yöneticide “Şüpheli Alacağa Al” düğmesi");
  await page.click(`${card} [data-entry="debt"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  await page.fill(`${top} input[name="amount"]`, "10000");
  await submit(page);
  await formClosed(page);
  await page.waitForTimeout(500);
  ok(kurus(await balanceOnScreen(page)) === 1000000, `adım 0: bakiye 10.000 (${await balanceOnScreen(page)})`);

  await page.click(`${card} [data-act="doubtfulTake"]`);
  await page.waitForSelector(`${top} .hof-form select[name="reason"]`);
  const takeTitle = await textOf(page, `${top} .hof-modal-title`);
  const suggested = await page.inputValue(`${top} input[name="amount"]`);
  ok(takeTitle === "Şüpheli Alacağa Al" && num(suggested) === 10000, `form: “${takeTitle}”, önerilen tutar borç bakiyesi (${suggested})`);
  const reasons = await page.$$eval(`${top} select[name="reason"] option`, list => list.map(o => o.textContent.trim()));
  ok(reasons.join("|") === "Karşılıksız Çek|Protestolu Senet|Dava|İcra|Diğer", `neden listesi: ${reasons.join(", ")}`);
  await page.fill(`${top} input[name="amount"]`, "4000");
  await page.selectOption(`${top} select[name="reason"]`, "lawsuit");
  await page.fill(`${top} input[name="note"]`, "Dava açıldı");
  await submit(page);
  await formClosed(page);
  await waitFacts(page, "open", 4000);
  await factsEqual(page, { taken: 4000, provision: 0, collected: 0, writtenOff: 0, open: 4000 }, "adım 1");
  ok(kurus(await balanceOnScreen(page)) === 1000000, "adım 1: cari bakiyesi DEĞİŞMEZ (10.000)");
  ok(await page.$(`${card} h3 [data-doubtful-badge]`), "kart başlığında “Şüpheli” rozeti");
  const recordRow = await textOf(page, `${card} [data-doubtful-record]`);
  ok(/Dava/.test(recordRow) && /Şüpheli Alacakta/.test(recordRow) && /Dava açıldı/.test(recordRow), `kayıt satırı: ${recordRow.slice(0, 120)}`);
  await shot(page, "iz16-ekran-1-cari-karti-supheli", `${card} [data-acc-doubtful]`);

  await page.click(`${card} [data-dbt-act="provision"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  ok((await textOf(page, `${top} .hof-modal-title`)) === "Karşılık Ayır", "Karşılık Ayır formu");
  await page.fill(`${top} input[name="amount"]`, "2500");
  await submit(page);
  await formClosed(page);
  await waitFacts(page, "provision", 2500);
  await factsEqual(page, { taken: 4000, provision: 2500, collected: 0, open: 4000 }, "adım 2");
  const gl2 = await trial();
  ok(gl2(654) === 2500 && gl2(129) === -2500 && gl2(128) === 4000, `adım 2 mizan: 654 ${gl2(654)}, 129 ${gl2(129)}, 128 ${gl2(128)}`);

  await page.click(`${card} [data-entry="in"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  await page.fill(`${top} input[name="amount"]`, "3000");
  await submit(page);
  await formClosed(page);
  await waitFacts(page, "collected", 3000);
  await factsEqual(page, { taken: 4000, provision: 1000, collected: 3000, writtenOff: 0, open: 1000 }, "adım 3 (tahsilat önce şüpheliden; karşılık kalana iner, 644 kuralı)");
  ok(kurus(await balanceOnScreen(page)) === 700000, `adım 3: bakiye 7.000 (${await balanceOnScreen(page)})`);
  const gl3 = await trial();
  ok(gl3(128) === 1000 && gl3(129) === -1000 && gl3(644) === -1500 && gl3(100) === 3000 && gl3(120) === 6000, `adım 3 mizan: 128 ${gl3(128)}, 129 ${gl3(129)}, 644 ${gl3(644)}, 100 ${gl3(100)}, 120 ${gl3(120)}`);

  await page.click(`${card} [data-dbt-act="writeoff"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  const woSuggested = await page.inputValue(`${top} input[name="amount"]`);
  ok((await textOf(page, `${top} .hof-modal-title`)) === "Değersiz Alacak Yaz" && num(woSuggested) === 1000, `Değersiz Alacak Yaz formu; önerilen kalan (${woSuggested})`);
  await submit(page);
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
  const confirmText = await textOf(page, `${top} .hof-modal-text`);
  ok(/bakiyesi o tutar kadar kapanır/.test(confirmText) && /1\.000,00/.test(confirmText), `onay metni: "${confirmText.slice(0, 120)}"`);
  await page.click(`${top} [data-answer="no"]`);
  await page.waitForTimeout(500);
  const woError = await textOf(page, `${modal} .hof-form-error`);
  ok(/Kaydedilmedi/.test(woError), `Vazgeç → formda: "${woError}"`);
  await factsEqual(page, { writtenOff: 0, open: 1000 }, "Vazgeç: değişmedi");
  await submit(page);
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
  await page.click(`${top} [data-answer="yes"]`);
  await formClosed(page);
  await waitFacts(page, "writtenOff", 1000);
  await factsEqual(page, { taken: 4000, provision: 0, collected: 3000, writtenOff: 1000, open: 0 }, "adım 4");
  ok(kurus(await balanceOnScreen(page)) === 600000, `adım 4: bakiye 6.000 (${await balanceOnScreen(page)})`);
  const status4 = await textOf(page, `${card} [data-doubtful-record] .hof-plan-badge`);
  ok(status4 === "Değersiz Yazıldı", `kayıt durumu: ${status4}`);
  const ledgerText = await textOf(page, `${card} .hof-plans-entries`);
  ok(/Değersiz Alacak/.test(ledgerText), "Hareketler'de “Değersiz Alacak” alacak satırı");
  const gl4 = await trial();
  ok(gl4(128) === 0 && gl4(129) === 0 && gl4(644) === -1500 && gl4(654) === 2500 && gl4(659) === 0 && gl4(120) === 6000 && gl4(100) === 3000, `adım 4 mizan: 128 ${gl4(128)}, 129 ${gl4(129)}, 644 ${gl4(644)}, 654 ${gl4(654)}, 659 ${gl4(659)}, 120 ${gl4(120)}, Kasa ${gl4(100)}`);
  ok(!(await page.$(`${card} h3 [data-doubtful-badge]`)), "kapanınca başlık rozeti kalkar");
  await shot(page, "iz16-ekran-2-cari-karti-degersiz", `${card} [data-acc-doubtful]`);
  const integrity = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
  ok(integrity.ok === true, "Mutabakat Testi tamam");

  await page.click(`${card} [data-act="doubtfulTake"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  await page.fill(`${top} input[name="amount"]`, "7000");
  await submit(page);
  const overError = await textOf(page, `${top} .hof-form-error`);
  ok(/aşıyor/.test(overError) && (await page.$(`${top} .hof-form input[name="amount"]`)), `7.000 > 6.000: form kapanmadan hata: "${overError.slice(0, 100)}"`);
  await closeAll(page);

  console.log("\n■ 2 Liste rozeti, ANLIK DURUM, Vade Takip, Rapor Merkezi (Şüpheli Alacaklar, Alacak Yaşlandırma, Hesap Planı Mizanı)");
  const second = await must("ikinci cari", admin.post("/api/workspace/accounts", { name: "İcralık Müşteri", type: "customer", registeredOn: D0 }));
  await must("borç", admin.post(`/api/workspace/accounts/${second.id}/entries`, { kind: "debt", amount: 2000, date: D0, note: "Satış" }));
  const secondRecord = (await must("al", admin.post(`/api/workspace/accounts/${second.id}/doubtful`, { amount: 2000, date: D0, reason: "enforcement", note: "İcra dosyası" }))).record;
  await page.evaluate(() => window.HOF.accounts.open());
  await page.waitForSelector(`${card} tr[data-account]`, { timeout: 10000 });
  await page.waitForFunction(id => Boolean(document.querySelector(`.hof-accounts-modal tr[data-account="${id}"] [data-doubtful-badge]`)), second.id, { timeout: 10000 }).catch(() => null);
  const rowBadge = await textOf(page, `${card} tr[data-account="${second.id}"] [data-doubtful-badge]`);
  ok(rowBadge === "Şüpheli", `listede rozet: “${rowBadge}”`);
  ok(!(await page.$(`${card} tr[data-account="${abc.id}"] [data-doubtful-badge]`)), "kapanan kayıtlı caride rozet yok");
  await closeAll(page);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#hof-pulse [data-overview-doubtful]", { state: "attached", timeout: 20000 });
  const pulse = await textOf(page, "#hof-pulse [data-overview-doubtful]");
  ok(/Şüpheli Alacak/.test(pulse) && /2\.000/.test(pulse), `ANLIK DURUM: “${pulse}”`);
  await shot(page, "iz16-ekran-3-anlik-durum");
  await openReports(page);
  await page.click(`${modal} .hof-rep-tab[data-tab="vade"]`);
  await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-stat span")].some(node => node.textContent.trim() === "Şüpheli Alacak"), null, { timeout: 15000 });
  const vadeTile = await page.$$eval(`${modal} .hof-rep-stat`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()).find(text => text.startsWith("Şüpheli Alacak")));
  ok(/2\.000,00/.test(vadeTile) && /1 cari/.test(vadeTile) && /vade takibinin dışında/.test(vadeTile), `Vade Takip kutusu: “${vadeTile}”`);

  await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${modal} [data-rc-list] [data-report="supheli-alacaklar"]`, { timeout: 15000 });
  await page.click(`${modal} [data-rc-list] [data-report="supheli-alacaklar"]`);
  let rc = await waitRc(page, view => /Şüpheli Alacaklar/.test(view.text) && view.rows.length > 0);
  await ensureThisYear(page);
  rc = await waitRc(page, view => view.rows.length > 0);
  const statusDefault = await page.inputValue(`${modal} [data-rc-main] select[data-param="doubtfulStatus"]`);
  ok(statusDefault === "open" && rc.rows.length === 1 && rc.rows[0][1] === "İcralık Müşteri" && rc.rows[0][2] === "İcra", `ilk açılış Açık: 1 satır (${rc.rows.map(r => r[1]).join(", ")})`);
  ok(rc.heads.join("|") === "Cari No|Cari|Neden|Tarih|Tutar|Karşılık|Tahsil Edilen|Değersiz|Kalan|Durum", `kolonlar: ${rc.heads.join(", ")}`);
  ok(rc.footer && kurus(num(rc.footer[8])) === 200000, `TOPLAM Kalan 2.000 (${rc.footer?.[8]})`);
  await setParam(page, "doubtfulStatus", "all");
  rc = await waitRc(page, view => view.rows.length === 2);
  const sumKalan = rc.rows.reduce((t, r) => t + num(r[8]), 0);
  const sumTutar = rc.rows.reduce((t, r) => t + num(r[4]), 0);
  ok(rc.rows.length === 2 && kurus(num(rc.footer[8])) === kurus(sumKalan) && kurus(num(rc.footer[4])) === kurus(sumTutar) && kurus(sumTutar) === 600000, `Tümü: 2 satır, TOPLAM = satırlar (Tutar ${rc.footer[4]}, Kalan ${rc.footer[8]})`);
  await shot(page, "iz16-ekran-4-rapor-supheli-alacaklar");
  await setParam(page, "doubtfulStatus", "closed");
  rc = await waitRc(page, view => view.rows.length === 1);
  ok(rc.rows.length === 1 && rc.rows[0][1] === "Şüpheli Ekran Müşterisi" && rc.rows[0][9] === "Değersiz Yazıldı", `Kapanan: ${rc.rows[0]?.[1]} · ${rc.rows[0]?.[9]}`);
  await setParam(page, "doubtfulStatus", "all");
  await setParam(page, "doubtfulReason", "enforcement");
  rc = await waitRc(page, view => view.rows.length === 1);
  ok(rc.rows.length === 1 && rc.rows[0][2] === "İcra", "Neden: İcra → 1 satır");
  await setParam(page, "doubtfulReason", "lawsuit");
  rc = await waitRc(page, view => view.rows.length === 1 && view.rows[0][2] === "Dava");
  ok(rc.rows.length === 1 && rc.rows[0][2] === "Dava", "Neden: Dava → 1 satır");
  await setParam(page, "doubtfulReason", "cheque");
  rc = await waitRc(page, view => view.rows.length === 0 && /kayıt yok/.test(view.text));
  ok(rc.rows.length === 0 && /Bu dönemde kayıt yok|Bu süzgeçte kayıt yok/.test(rc.text), "Neden: Karşılıksız Çek → boş, ipucu yazısı");
  await setParam(page, "doubtfulReason", "");
  await page.click(`${modal} [data-rc-main] .hof-rep-chip[data-preset="lastMonth"]`).catch(() => null);
  rc = await waitRc(page, view => /Bu dönemde kayıt yok/.test(view.text), 8000);
  ok(rc.rows.length === 0 && /Bu dönemde kayıt yok/.test(rc.text) && (await page.$(`${modal} [data-rc-main] .hof-empty [data-preset="all"]`)), "Geçen Ay: boş dönemde ipucu + “Tüm Zamanları Göster”");

  await page.click(`${modal} [data-rc-list] [data-report="alacak-yaslandirma"]`);
  // Karar 15.10.2026: "Vade Gecikme (Gün)" kolonu ve "Şüpheli Alacak (dilimlere dahil)" başlığı.
  rc = await waitRc(page, view => /Alacak Yaşlandırma/.test(view.text) && view.heads.includes("Şüpheli Alacak (dilimlere dahil)") && view.heads.includes("Vade Gecikme (Gün)"));
  const agingRow = rc.rows.find(cells => cells[0] === "İcralık Müşteri");
  ok(agingRow && kurus(num(agingRow[rc.heads.indexOf("Şüpheli Alacak (dilimlere dahil)")])) === 200000 && kurus(num(agingRow[rc.heads.indexOf("Toplam")])) === 0 && agingRow[rc.heads.indexOf("Vade Gecikme (Gün)")] === "", `Alacak Yaşlandırma: Şüpheli Alacak (dilimlere dahil) 2.000, Toplam 0, Vade Gecikme boş (${agingRow?.join(" | ")})`);

  await page.click(`${modal} [data-rc-list] [data-report="hesap-mizani"]`);
  rc = await waitRc(page, view => /Hesap Planı Mizanı/.test(view.text) && view.rows.some(cells => cells[0] === "128"));
  await ensureThisYear(page);
  rc = await waitRc(page, view => view.rows.some(cells => cells[0] === "128"));
  const r128 = rc.rows.find(cells => cells[0] === "128");
  const r129 = rc.rows.find(cells => cells[0] === "129");
  const r654 = rc.rows.find(cells => cells[0] === "654");
  ok(r128 && /Şüpheli/.test(r128[1]) && kurus(num(r128[5])) === 200000 && r128[6] === "Borç", `Hesap Planı Mizanı 128: ${r128?.join(" | ")}`);
  ok(r129 && /Karşılı/.test(r129[1]) && r654 && kurus(num(r654[5])) === 250000, `129 satırı (${r129?.[1]}) ve 654 ${r654?.[5]}`);
  await shot(page, "iz16-ekran-5-hesap-mizani");
  await closeAll(page);

  console.log("\n■ 3 Karşılıksız çek kartından kısayol: neden ve tutar evraktan");
  const third = await must("çekli cari", admin.post("/api/workspace/accounts", { name: "Çekli Müşteri", type: "customer", registeredOn: D0 }));
  await must("borç", admin.post(`/api/workspace/accounts/${third.id}/entries`, { kind: "debt", amount: 1500, date: day(-2), note: "Satış" }));
  // Evrak iki gün önce alınmış (K3: aynı gün alınan evrakın alacak satırı o günkü şüpheli kaydından düşerdi), bugün karşılıksız döndü.
  const cheque = await must("çek al", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1500, issueDate: day(-2), dueDate: day(-1), serialNo: "EK-1", accountId: third.id, bank: "Akbank" }));
  await must("karşılıksız", admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: D0 }));
  await page.evaluate(id => window.HOF.cheques.open({ id }), cheque.id);
  await page.waitForSelector(`${CHQ} [data-act="doubtful"]`, { timeout: 10000 });
  ok(true, "karşılıksız çek kartında “Şüpheli Alacağa Al” düğmesi");
  await page.click(`${CHQ} [data-act="doubtful"]`);
  await page.waitForSelector(`${top} .hof-form select[name="reason"]`, { timeout: 10000 });
  const chequeReason = await page.inputValue(`${top} select[name="reason"]`);
  const chequeAmount = await page.inputValue(`${top} input[name="amount"]`);
  const chequeIntro = await textOf(page, `${top} .hof-modal-text`);
  ok(chequeReason === "cheque" && num(chequeAmount) === 1500 && /Evrak No EK-1/.test(chequeIntro), `form evraktan: neden ${chequeReason}, tutar ${chequeAmount}`);
  await submit(page);
  await formClosed(page);
  await page.waitForTimeout(500);
  const thirdSummary = await summaryOf(third.id);
  const thirdList = await must("kayıt", admin.get(`/api/workspace/accounts/${third.id}/doubtful`));
  ok(thirdSummary.openMinor === 150000 && thirdList.records[0]?.reasonLabel === "Karşılıksız Çek" && thirdList.records[0]?.chequeSerialNo === "EK-1", `şüpheliye alındı: ${thirdSummary.openMinor} kuruş, ${thirdList.records[0]?.reasonLabel}, evrak ${thirdList.records[0]?.chequeSerialNo}`);
  await closeAll(page);

  console.log("\n■ 4 Kaydı sil → Silinenler'den geri yükle");
  await openCard(page, second.id);
  await page.click(`${card} [data-dbt-act="delete"][data-dbt-id="${secondRecord.id}"]`);
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForSelector(`${card} [data-doubtful-empty]`, { timeout: 10000 });
  ok((await summaryOf(second.id)).count === 0 && kurus(await balanceOnScreen(page)) === 200000, "silindi: kayıt yok, bakiye 2.000 değişmedi");
  const gl5 = await trial();
  ok(gl5(128) === 1500, `silince 128 yalnız çekli cari: ${gl5(128)}`);
  await closeAll(page);
  await page.goto(`${BASE}/admin.html#trash`, { waitUntil: "load" });
  await page.waitForSelector("#adm-trash tr[data-id]", { timeout: 15000 });
  const trashRow = `#adm-trash tr[data-id]:has-text("İcralık Müşteri")`;
  await page.waitForSelector(`${trashRow} [data-restore]`, { timeout: 8000 });
  const trashKind = await textOf(page, `${trashRow} .adm-kind`);
  ok(trashKind === "Şüpheli Alacak", `Silinenler türü: ${trashKind}`);
  await page.click(`${trashRow} [data-restore]`);
  await page.waitForFunction(() => ![...document.querySelectorAll("#adm-trash tr[data-id]")].some(row => row.textContent.includes("İcralık Müşteri") && row.querySelector("[data-restore]:not([disabled])")), null, { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(1200);
  const restored = await summaryOf(second.id);
  const gl6 = await trial();
  ok(restored.openMinor === 200000 && restored.count === 1 && gl6(128) === 3500, `geri yüklendi: şüphelide 2.000, 128 = ${gl6(128)}`);

  console.log("\n■ 5 Personel: düğme yok, bilgi görünür; çek kartında kısayol yok");
  const staff = await login("personel", PASS);
  const perms = await staff.evaluate(() => ({ manage: window.HOF.can("accounts.manage"), doubtful: window.HOF.can("accounts.doubtful") }));
  ok(!perms.manage && !perms.doubtful, `ön koşul: accounts.manage ${perms.manage}, accounts.doubtful ${perms.doubtful}`);
  await openCard(staff, second.id);
  ok(await staff.$(`${card} [data-doubtful-facts]`), "personelde Şüpheli Alacak bilgisi görünür");
  ok(!(await staff.$(`${card} [data-act="doubtfulTake"]`)) && !(await staff.$(`${card} [data-dbt-act]`)), "personelde Şüpheli Alacağa Al / Karşılık Ayır / Değersiz / Çıkar / Sil düğmeleri YOK");
  await shot(staff, "iz16-ekran-6-personel-dugme-yok");
  const lawyer = await login("avukat", PASS);
  const lawyerPerms = await lawyer.evaluate(() => ({ manage: window.HOF.can("accounts.manage"), doubtful: window.HOF.can("accounts.doubtful"), cheques: window.HOF.can("cheques.view") }));
  ok(lawyerPerms.manage && !lawyerPerms.doubtful && lawyerPerms.cheques, `avukat ön koşul: accounts.manage ${lawyerPerms.manage}, accounts.doubtful ${lawyerPerms.doubtful}, cheques.view ${lawyerPerms.cheques}`);
  await openCard(lawyer, second.id);
  ok((await lawyer.$(`${card} [data-entry="debt"]`)) && !(await lawyer.$(`${card} [data-act="doubtfulTake"]`)) && !(await lawyer.$(`${card} [data-dbt-act]`)) && (await lawyer.$(`${card} [data-doubtful-facts]`)), "avukat: Borç Yaz var, şüpheli düğmeleri yok, bilgi görünür");
  await closeAll(lawyer);
  await lawyer.evaluate(id => window.HOF.cheques.open({ id }), cheque.id);
  await lawyer.waitForSelector(`${CHQ} .hof-chq-actions`, { timeout: 10000 });
  ok(!(await lawyer.$(`${CHQ} [data-act="doubtful"]`)), "avukat: karşılıksız çek kartında “Şüpheli Alacağa Al” yok");

  console.log("\n■ 6 Tahsilatta seçim (karar 15.10.2026): varsayılan şüpheliden düşer; “Normal Cari Hesaba İşle” kutusu → satır 120'de kalır");
  await must("ek borç", admin.post(`/api/workspace/accounts/${second.id}/entries`, { kind: "debt", amount: 500, date: D0, note: "Yeni satış" }));
  // Bölüm 4 yönetici sayfasını Yönetim → Silinenler'e götürmüştü; ana ekrana dön.
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.HOF?.accounts?.open), null, { timeout: 20000 });
  await openCard(page, second.id);
  await page.click(`${card} [data-entry="in"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  ok(await page.$(`${top} .hof-form input[name="doubtfulSkip"]`), "açık şüpheli kaydı olan müşteride “Normal Cari Hesaba İşle” kutusu var");
  await page.fill(`${top} input[name="amount"]`, "300");
  await page.check(`${top} input[name="doubtfulSkip"]`);
  await submit(page);
  await formClosed(page);
  await page.waitForSelector(`${card} .hof-plans-entries [data-doubtful-normal]`, { timeout: 10000 });
  const normalTag = await textOf(page, `${card} .hof-plans-entries [data-doubtful-normal]`);
  ok(normalTag === "Normal Cariye İşlendi", `Hareketler'de etiket: “${normalTag}”`);
  const afterNormal = await summaryOf(second.id);
  const gl7 = await trial();
  ok(afterNormal.openMinor === 200000 && afterNormal.collectedMinor === 0 && gl7(128) === 3500 && kurus(await balanceOnScreen(page)) === 220000, `normal cariye: şüphelide 2.000 kaldı, 128 = ${gl7(128)}, bakiye ${await balanceOnScreen(page)} (2.500 − 300)`);
  await shot(page, "iz16-ekran-7-normal-cari-hesaba-isle", `${card} .hof-plans-entries`);
  await page.click(`${card} [data-entry="in"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  await page.fill(`${top} input[name="amount"]`, "100");
  await submit(page);
  await formClosed(page);
  await waitFacts(page, "collected", 100);
  const afterDefault = await summaryOf(second.id);
  const gl8 = await trial();
  ok(afterDefault.openMinor === 190000 && afterDefault.collectedMinor === 10000 && gl8(128) === 3400, `kutusuz tahsilat 100 şüpheliden düştü: şüphelide 1.900, 128 = ${gl8(128)}`);
  const integrity6 = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
  ok(integrity6.ok === true, "Mutabakat Testi tamam (iki yükleyici aynı kuralı okur)");
  await closeAll(page);
  await openCard(page, abc.id);
  await page.click(`${card} [data-entry="in"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  ok(!(await page.$(`${top} .hof-form input[name="doubtfulSkip"]`)), "açık şüpheli kaydı olmayan (kapanmış) caride kutu yok");
  await closeAll(page);

  console.log("\n■ 7 K4 (16.10.2026): şüpheli caride faturaya bağlı tahsilat — İptal penceresi önceden söyler, iptalden sonra bildirim; tahsilat şüpheliden düşer");
  const k4Sale = await must("K4 satış", admin.post("/api/workspace/invoices", { kind: "sale", accountId: second.id, issueDate: D0, issueTime: "10:00", currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 1, unitPrice: 250, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: D0 }, force: true, cashForce: true }));
  await must("K4 bağlı tahsilat", admin.post(`/api/workspace/accounts/${second.id}/entries`, { kind: "in", method: "cash", note: "Fatura tahsilatı", amount: "250", date: D0, invoiceId: k4Sale.id }));
  const beforeK4 = await summaryOf(second.id);
  const invModal = `${modal} .hof-invoices-modal`;
  await page.evaluate(id => window.HOF.invoices.openDoc(id), k4Sale.id);
  await page.waitForSelector(`${invModal} [data-act="cancel"]:not([disabled])`);
  await page.click(`${invModal} [data-act="cancel"]`);
  await page.waitForSelector(`${top} form [name="reason"]`);
  const k4Intro = await textOf(page, `${top} .hof-modal-text`);
  ok(/250,00 TL tahsilat şu an normal cari hesaba işli/.test(k4Intro) && /şüpheli alacaktan düşer/.test(k4Intro) && /Normal Cari Hesaba İşle/.test(k4Intro), `İptal penceresi önceden söyler: “${k4Intro.slice(-230)}”`);
  await shot(page, "k4-iptal-penceresi");
  await page.fill(`${top} form [name="reason"]`, "Müşteri vazgeçti");
  await page.click(`${top} form button[type="submit"]`);
  const k4Toast = await page
    .waitForFunction(() => [...document.querySelectorAll("#hof-toasts .hof-toast")].find(node => node.textContent.includes("artık şüpheli alacaktan düşüyor"))?.textContent || "", null, { timeout: 10000 })
    .then(handle => handle.jsonValue())
    .catch(() => "");
  ok(/250,00 TL tahsilat artık şüpheli alacaktan düşüyor/.test(k4Toast), `iptalden sonra bildirim: “${k4Toast.slice(0, 200)}”`);
  await shot(page, "k4-iptal-bildirimi");
  const afterK4 = await summaryOf(second.id);
  ok(afterK4.openMinor === beforeK4.openMinor - 25000, `şüphelide kalan ${beforeK4.openMinor / 100} → ${afterK4.openMinor / 100} (bağı kalkan 250 şüpheliden düştü)`);
  const integrity7 = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
  ok(integrity7.ok === true, "Mutabakat Testi tamam (K4 iptalinden sonra)");
  await closeAll(page);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-supheli-230: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
