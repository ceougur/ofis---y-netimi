// 2.4.3 EKRANDAN — keşif testi A (Cari / Kasa / Kayıt) bulgularının düzeltmeleri (docs/kanit/2026-10-17/ux-kesif/RAPOR-A.md, RAPOR-C.md):
//   A1  Aynı adlı cari açılırken tablodaki aynı adlı kayıt KENDİLİĞİNDEN bağlanmaz (öneri + "Bu Kayda Bağla"); kayıttan girilen tahsilat yeni, boş
//       cariye düşmez (para etkisi veri tabanından: yeni carinin hareketi 0, kaydın tahsilatı payments'ta, No 1 değişmez).
//   A3  Aynı adlı cari varken (telefonu farklı) kayıt onaysız geçmez; soruda No + telefon; Vazgeç formu açık bırakır.
//   A2  Kayda bağlı carinin kayıt kartından girilen tahsilatı İşlem Geçmişi'nde ve Toplam Tahsilat'ta; "Kayıt Kartından Tahsilatlar" raporunda.
//   A5  Silinemeyen caride (taksit kartı) Sil pasif ve nedeni yazılı.
//   A7  Banka hesabı yokken "Kasadan Bankaya Yatır" kaydedilmez; "Banka Hesabı Tanımla" yolu (Kasa değişmez).
//   A8  "Taksitten Kalan (bakiyeye dahil)" — kart ve liste.   C13 Müşteri tahsilatında "Kredi Kartına İade" yok (tedarikçide var).
//   C2  Tanımlı POS seçiliyken açıklama "seçilen POS'a … valör" der, "Hesabı Atanmamış" demez.   A22 Cari ekstre PDF'inde alt TOPLAM satırı.
//   A12 Cari listesi süzgeç satırında PDF düğmesi tek satır.   A13 "Toplam Borç" kesilmez.   A20 Personel ana sayfasında üst boşluk yok.
//   A14 Sayfalar şeridi geç gelse de tablo itilmez (yer tutucu; istek zorla geciktirilir — ders 20).   A17 "Tabloya Atla" + takvim tek Tab durağı.
//   A18 1366'da kayıt tablosu yana kaymaz; tutar "25.000,00" (ham değer title'da, arama ham değeri bulur).   A19 Personele olmayan yol gösterilmez.
//   A18 (2.4.5 6b) "Borçlu Telefon" / "Borçlu TC Kimlik No" kolonu ham kalır (para biçimine çevrilmez), seçili satırın telefon hücresinden WhatsApp açılır; "Alacak Tutarı" 25.000,00.
//   A21 Aynı adlı iki carinin taksiti takvimde Cari No ile ayrılır.   A9 Bildirim turu 1 + özet (dönmez), dizüstünde küçük.   A15 yazım düzeni.
// Çıkış: "N geçti, M kaldı" (kaldıysa çıkış kodu 1).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { pdfText } from "../banka-210-ortak.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-cari-243-"));
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
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
const api = await server.login();
const BASE = server.base;
const db = server.app.store;
const one = (sql, ...args) => db.get(sql, ...args);
const BANK = "/api/workspace/bank";

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
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
let mainPage = null;

// ---------- Veri (API; programın kendi uçları) ----------
await must("kurulum geç", api.post(`${BANK}/setup/dismiss`, {}));
const no1 = await must("Ahmet 1", api.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", phone: "0533 111 11 11", type: "customer", registeredOn: day(-90) }));
const no2 = await must("Ahmet 2", api.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", phone: "0533 222 22 22", type: "customer", registeredOn: day(-90) }));
await must("borç", api.post(`/api/workspace/accounts/${no1.id}/entries`, { kind: "debt", amount: "5.000", date: day(-30) }));
await must("tahsilat", api.post(`/api/workspace/accounts/${no1.id}/entries`, { kind: "in", amount: "1.000", date: day(-20), method: "cash" }));
// A21: iki aynı adlı carinin ikisinde de geciken taksit; taksitli cari (A5).
await must("plan 1", api.post("/api/workspace/plans", { accountId: no1.id, name: "Ahmet Yılmaz", total: "3.000", mode: "auto", count: 3, firstDue: day(-25), registeredOn: day(-60) }));
await must("plan 2", api.post("/api/workspace/plans", { accountId: no2.id, name: "Ahmet Yılmaz", total: "1.200", mode: "auto", count: 2, firstDue: day(-15), registeredOn: day(-60) }));
const tedarikci = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Kırtasiye Tedarik", type: "supplier", registeredOn: day(-90) }));
for (let index = 0; index < 12; index += 1) {
  await must(`kayıt ${index}`, api.post("/api/workspace/records", { values: { "DOSYA NO": `2026/${100 + index}`, BORÇLU: index === 0 ? "Ahmet Yılmaz" : index === 1 ? "Mehmet Demir" : `Kişi ${index}`, ALACAKLI: "Deneme Ltd.", TELEFON: `0533 000 00 ${pad(index)}`, TUTAR: `${(index + 1) * 25000},00` }, caseKey: `2026/${100 + index}` }));
}
await must("personel", api.post("/api/admin/users", { username: "personel1", name: "Personel Bir", role: "personel", password: "Personel-2026!", mustChangePassword: false }));

const accountCount = () => one("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n;
const entriesOf = id => one("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE 0 END), 0) AS paid FROM account_entries WHERE account_id = ?", id);
const cashBalance = () => one(`SELECT
  COALESCE((SELECT SUM(CASE kind WHEN 'in' THEN amount ELSE -amount END) FROM cash_entries WHERE method = 'cash'), 0)
  + COALESCE((SELECT SUM(CASE kind WHEN 'in' THEN amount WHEN 'out' THEN -amount ELSE 0 END) FROM account_entries WHERE kind IN ('in', 'out') AND method = 'cash'), 0)
  + COALESCE((SELECT SUM(amount) FROM payments WHERE method = 'cash'), 0) AS k`).k;

const browser = await chromium.launch();
const errors = [];
const modal = ".hof-modal-backdrop.is-visible";
const top = ".hof-modal-backdrop.is-visible:last-of-type";
const accWin = `${modal} .hof-accounts-modal`;
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `cari-243-${name}.png`) }).catch(() => null);
const typeSlow = async (page, text) => {
  for (const ch of text) await page.keyboard.type(ch, { delay: 45 });
};
const closeAll = async page => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) await yes.click();
  }
};
async function openPage({ width = 1366, height = 768, user = "admin", password = ADMIN_PASSWORD, init = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, locale: "tr-TR" });
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
    window.__shifts = [];
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shifts.push({ value: entry.value, at: Math.round(entry.startTime), sources: (entry.sources || []).map(source => String(source.node?.id || source.node?.className || source.node?.nodeName || "")).slice(0, 4) });
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // gözlemci yok
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  if (init) await init(page);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", user);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.accounts?.open && window.HOF?.workspace), null, { timeout: 20000 });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  await page.waitForTimeout(800);
  return { context, page };
}
const selectRecord = async (page, key) => {
  await page.click(`.dynamic-table tbody tr[data-hof-key="${key}"]`);
  await page.waitForFunction(k => window.HOF.selectedCase()?.key === k, key, { timeout: 10000 });
  await page.waitForTimeout(400);
};

try {
  const { page } = await openPage();
  mainPage = page;
  await page.evaluate(() => window.HOF.alerts?.enqueue && (localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1"), document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove())));

  await step("A1 + A3 Yeni Cari \"Ahmet Yılmaz\": kayıt kendiliğinden bağlanmaz, aynı adlı cari varken onay sorulur", async () => {
    await page.evaluate(() => window.HOF.accounts.open());
    await page.waitForSelector(`${accWin} [data-act="new"]`);
    await page.click(`${accWin} [data-act="new"]`);
    await page.waitForSelector(`${top} input[name="name"]`);
    await page.click(`${top} input[name="name"]`);
    await typeSlow(page, "Ahmet Yılmaz");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(900);
    const key = await page.$eval(`${top} input[name="caseKey"]`, node => node.value).catch(() => "?");
    ok(key === "", `tablodaki aynı adlı kayıt kendiliğinden seçilmedi (caseKey “${key}”)`);
    const offer = await textOf(page, `${top} [data-case-suggest]`);
    ok(/2026\/100/.test(offer) && /Bu Kayda Bağla/.test(offer), `öneri gösterildi: “${offer.slice(0, 120)}”`);
    await shot(page, "a1-oneri");
    const before = accountCount();
    await page.click(`${top} button[type="submit"]`);
    const asked = await page.waitForSelector(`${top} [data-answer="no"]`, { timeout: 5000 }).then(() => true).catch(() => false);
    const question = asked ? await textOf(page, `${top} .hof-modal-text`) : "";
    ok(asked && /No 1 · 0533 111 11 11/.test(question) && /No 2 · 0533 222 22 22/.test(question), `onay soruldu, ayırt edici bilgiyle: “${question.slice(0, 160)}”`);
    if (asked) await page.click(`${top} [data-answer="no"]`);
    await page.waitForTimeout(500);
    ok(accountCount() === before && Boolean(await page.$(`${top} input[name="name"]`)), `Vazgeç: cari açılmadı (${before} → ${accountCount()}), form açık`);
    await page.click(`${top} button[type="submit"]`);
    const again = await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 5000 }).then(() => true).catch(() => false);
    if (again) await page.click(`${top} [data-answer="yes"]`);
    await page.waitForTimeout(1200);
    const created = one("SELECT id, ref_no AS refNo, case_key AS caseKey FROM accounts WHERE deleted_at IS NULL ORDER BY rowid DESC LIMIT 1");
    ok(accountCount() === before + 1 && created.caseKey === "", `"Yine de Aç": yeni cari No ${created.refNo}, kayda bağlı DEĞİL (case_key “${created.caseKey}”)`);
    await closeAll(page);
    // Kayıttan tahsilat: yeni (boş) cariye değil kaydın kendi defterine.
    const no1Before = entriesOf(no1.id).paid;
    await selectRecord(page, "2026/100");
    // 2.4.4 (E8): kayıt kartında Tahsilat düğmesi yok (CSS ile gizli; eski kodda görünür → kırmızı); kayıt tahsilatının sunucu yolu aynı → API'den.
    ok(!(await page.isVisible('.hof-case-actions [data-case-action="payment"]')), "kayıt kartında Tahsilat düğmesi görünmez (E8)");
    const recordPay = await page.evaluate(async () => {
      const response = await fetch(`/api/workspace/cases/${encodeURIComponent("2026/100")}/payments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: "321", method: "cash", date: window.HOF.localToday() }) });
      return { status: response.status, body: await response.json() };
    });
    ok(recordPay.status === 200 && recordPay.body.ok === true, `kayıt tahsilatı API'den: ${recordPay.status} ${JSON.stringify(recordPay.body).slice(0, 120)}`);
    await page.waitForTimeout(500);
    const toNew = entriesOf(created.id);
    const paidRecord = one("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE case_key = '2026/100'").s;
    ok(toNew.n === 0 && toNew.paid === 0, `yeni cariye para yazılmadı (hareket ${toNew.n}, tahsilat ${toNew.paid})`);
    ok(paidRecord === 321, `tahsilat kaydın defterinde: ${paidRecord}`);
    ok(entriesOf(no1.id).paid === no1Before, `No 1'in tahsilatı değişmedi (${no1Before} → ${entriesOf(no1.id).paid})`);
    await closeAll(page);
  });

  await step("A1 (bağla) + A2 \"Mehmet Demir\": öneriden bağlanır; kayıttan tahsilat cariye, İşlem Geçmişi'nde ve raporda görünür", async () => {
    await page.evaluate(() => window.HOF.accounts.open());
    await page.waitForSelector(`${accWin} [data-act="new"]`);
    await page.click(`${accWin} [data-act="new"]`);
    await page.waitForSelector(`${top} input[name="name"]`);
    await page.click(`${top} input[name="name"]`);
    await typeSlow(page, "Mehmet Demir");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(900);
    const link = await page.$(`${top} [data-case-suggest-link]`);
    if (link) await link.click();
    const key = await page.$eval(`${top} input[name="caseKey"]`, node => node.value).catch(() => "");
    ok(Boolean(link) && key === "2026/101", `"Bu Kayda Bağla" ile kayıt seçildi (caseKey “${key}”)`);
    await page.click(`${top} button[type="submit"]`);
    await page.waitForTimeout(1500);
    const mehmet = one("SELECT id, ref_no AS refNo, case_key AS caseKey FROM accounts WHERE name = 'Mehmet Demir' AND deleted_at IS NULL");
    ok(mehmet?.caseKey === "2026/101", `cari No ${mehmet?.refNo} kayda bağlı (${mehmet?.caseKey})`);
    await closeAll(page);
    await selectRecord(page, "2026/101");
    // 2.4.4 (E8): kayıt kartında Tahsilat düğmesi yok; kayda bağlı carinin tahsilatı Cari penceresinden (+ Tahsilat) girilir, kaydın İşlem Geçmişi'nde görünür.
    ok(!(await page.isVisible('.hof-case-actions [data-case-action="payment"]')), "kayıt kartında Tahsilat düğmesi görünmez (E8)");
    await page.evaluate(id => window.HOF.accounts.open(id), mehmet.id);
    await page.waitForSelector(`${accWin} [data-entry="in"]`);
    await page.click(`${accWin} [data-entry="in"]`);
    await page.waitForSelector(`${top} input[name="amount"]`);
    const eyebrow = await textOf(page, `${top} .hof-modal-eyebrow, ${top} .eyebrow`);
    const head = await page.$eval(top, node => node.innerText.slice(0, 200)).catch(() => "");
    ok(new RegExp(`No ${mehmet?.refNo}`).test(`${eyebrow} ${head}`), `tahsilat formu hangi cariye yazılacağını söylüyor: “${(eyebrow || head).replace(/\s+/g, " ").slice(0, 90)}”`);
    await page.click(`${top} input[name="amount"]`);
    await typeSlow(page, "500");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1800);
    ok(entriesOf(mehmet.id).paid === 500, `tahsilat carinin defterinde: ${entriesOf(mehmet.id).paid}`);
    await closeAll(page);
    await selectRecord(page, "2026/101");
    await page.evaluate(() => window.HOF.workspace.refreshActivity());
    await page.waitForFunction(() => /cari tahsilatı/.test(document.getElementById("hof-activity")?.textContent || ""), null, { timeout: 8000 }).catch(() => null);
    const history = await textOf(page, "#hof-activity");
    ok(/500,00 cari tahsilatı/.test(history) && /Toplam Tahsilat ₺500,00/.test(history), `İşlem Geçmişi: “${history.slice(0, 160)}”`);
    const report = await must("rapor", api.get(`/api/workspace/report-center/kayit-tahsilatlari?from=${day(-365)}&to=${day(0)}`));
    const rows = report.rows || report.data?.rows || [];
    ok(rows.some(row => /2026\/101/.test(row[1]) && /Cari No/.test(row[1]) && /500,00/.test(row[2])), `"Kayıt Kartından Tahsilatlar" raporunda: ${JSON.stringify(rows.map(row => row[1])).slice(0, 160)}`);
    await shot(page, "a2-gecmis");
  });

  await step("A5 Taksit kartı olan caride Sil pasif, nedeni yazılı; A8 \"bakiyeye dahil\"", async () => {
    await page.evaluate(id => window.HOF.accounts.open(id), no1.id);
    await page.waitForSelector(`${accWin} [data-act="delete"]`);
    const disabled = await page.$eval(`${accWin} [data-act="delete"]`, node => node.disabled);
    const why = await textOf(page, `${accWin} [data-delete-block]`);
    ok(disabled && /taksit kartı var/.test(why), `Sil pasif (${disabled}); neden: “${why}”`);
    const card = await textOf(page, `${accWin} .hof-plans-kpis`);
    ok(/Taksitten Kalan \(bakiyeye dahil\)/.test(card), `kart göstergesi: “${card.slice(0, 160)}”`);
    await shot(page, "a5-sil-pasif");
    await page.click(`${accWin} [data-act="back"]`);
    await page.waitForTimeout(800);
    const list = await textOf(page, `${accWin} .hof-plans-kpis`);
    ok(/Taksitlerden Kalan \(bakiyeye dahil\)/.test(list), `liste göstergesi: “${list.slice(0, 160)}”`);
    // A12: süzgeç satırındaki PDF düğmesi tek satır, seçicilerle aynı boy.
    const sizes = await page.evaluate(() => {
      const button = document.querySelector('.hof-accounts-modal [data-pdf="list"]');
      const select = document.querySelector('.hof-accounts-modal .hof-plans-filters select');
      return { button: Math.round(button?.getBoundingClientRect().height || 0), select: Math.round(select?.getBoundingClientRect().height || 0) };
    });
    ok(sizes.button > 0 && sizes.button <= sizes.select + 1, `Cari Listesi PDF düğmesi ${sizes.button} px, seçici ${sizes.select} px (tek satır)`);
    await shot(page, "a12-suzgec");
    await closeAll(page);
  });

  await step("A7 Banka hesabı yokken Kasadan Bankaya Yatır kaydedilmez", async () => {
    const before = cashBalance();
    const transfers = one("SELECT COUNT(*) AS n FROM cash_entries WHERE transfer_id IS NOT NULL AND transfer_id <> ''").n;
    await page.click('#hof-sidecard [data-action="cash"]');
    await page.waitForSelector(`${modal} [data-transfer="to-bank"]`);
    await page.click(`${modal} [data-transfer="to-bank"]`);
    await page.waitForSelector(`${top} input[name="amount"]`);
    await page.waitForTimeout(800);
    const define = await textOf(page, `${top} [data-bank-define-box]`);
    ok(/Banka Hesabı Tanımla/.test(define), `"Banka Hesabı Tanımla" yolu: “${define}”`);
    await page.click(`${top} input[name="amount"]`);
    await typeSlow(page, "1000");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForTimeout(1200);
    const error = await textOf(page, `${top} .hof-form-error`);
    ok(/Banka hesabı tanımlı değil/.test(error), `kaydedilmedi: “${error}”`);
    const after = one("SELECT COUNT(*) AS n FROM cash_entries WHERE transfer_id IS NOT NULL AND transfer_id <> ''").n;
    ok(after === transfers && cashBalance() === before, `Kasa değişmedi (${before} → ${cashBalance()}), transfer ${transfers} → ${after}`);
    await shot(page, "a7-yatir");
    await closeAll(page);
  });

  await step("C2 + C13 POS tahsilatı açıklaması; müşteride \"Kredi Kartına İade\" yok, tedarikçide var", async () => {
    const ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", usePos: true, opening: { date: day(-60), amount: "0", confirmed: true } }));
    await must("POS", api.post(`${BANK}/pos`, { name: "Ziraat Fiziki POS", bankAccountId: ziraat.id, rates: [{ installments: 1, rate: "2,5" }] }));
    await page.evaluate(() => window.HOF.bank?.reloadChoices?.());
    await page.evaluate(id => window.HOF.accounts.open(id), no2.id);
    await page.waitForSelector(`${accWin} [data-entry="in"]`);
    await page.click(`${accWin} [data-entry="in"]`);
    // Carinin açık taksit kartı var: önce "Taksite Yaz / Taksit Dışı Tahsilat" sorulur (başlıkta Cari No).
    await page.waitForSelector(`${top} [data-plain]`);
    const chooser = await textOf(page, top);
    ok(/No 2 · Ahmet Yılmaz · 0533 222 22 22/.test(chooser), `seçim penceresi hangi cari: “${chooser.slice(0, 60)}”`);
    await page.click(`${top} [data-plain]`);
    await page.waitForSelector(`${top} select[name="method"]`);
    await page.selectOption(`${top} select[name="method"]`, "card");
    await page.waitForTimeout(1200);
    const intro = await textOf(page, `${top} .hof-modal-text`);
    ok(/seçilen POS'a yazılır/.test(intro) && !/Hesabı Atanmamış/.test(intro), `POS açıklaması: “${intro}”`);
    ok(!(await page.$(`${top} input[name="cardRefund"]`)), "müşteri tahsilatında Kredi Kartına İade kutusu yok");
    await shot(page, "c2-pos");
    await closeAll(page);
    await page.evaluate(id => window.HOF.accounts.open(id), tedarikci.id);
    await page.waitForSelector(`${accWin} [data-entry="in"]`);
    await page.click(`${accWin} [data-entry="in"]`);
    await page.waitForSelector(`${top} select[name="method"]`);
    ok(Boolean(await page.$(`${top} input[name="cardRefund"]`)), "tedarikçi tahsilatında Kredi Kartına İade kutusu var");
    await closeAll(page);
  });

  await step("A22 Cari ekstre PDF'inde alt TOPLAM satırı; A15 Kasa satırında \"Cari Tahsilat\"", async () => {
    const pdf = await page.evaluate(async id => {
      const response = await fetch(`/api/workspace/accounts/${id}/ekstre.pdf`);
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    }, no1.id);
    const text = pdfText(Buffer.from(pdf));
    const lines = text.split("\n");
    const at = lines.findIndex(line => line.trim() === "TOPLAM");
    ok(at >= 0 && lines.slice(at, at + 6).some(line => /8\.000,00/.test(line)) && lines.slice(at, at + 6).some(line => /1\.000,00/.test(line)), `TOPLAM satırı: ${JSON.stringify(lines.slice(at, at + 6))}`);
    await page.click('#hof-sidecard [data-action="cash"]');
    await page.waitForSelector(`${modal} .hof-cash-table`);
    await page.waitForTimeout(600);
    const cash = await textOf(page, `${modal} .hof-cash-table`);
    ok(/Cari Tahsilat · Mehmet Demir/.test(cash) && !/Cari tahsilat/.test(cash), `Kasa satırı başlık yazımıyla (${(cash.match(/Cari [Tt]ahsilat · [A-Za-zÇĞİÖŞÜçğıöşü]+ [A-Za-zÇĞİÖŞÜçğıöşü]+/) || [""])[0]})`);
    await closeAll(page);
  });

  await step("A21 takvimde aynı adlı iki cari ayırt edilir; A9 bildirim turu 1 + özet, dizüstünde küçük", async () => {
    await page.evaluate(() => window.HOF.dues?.reload?.());
    await page.waitForTimeout(1500);
    const pills = await page.$$eval(".hof-payment-promises-track .hof-payment-pill:not([aria-hidden])", nodes => nodes.map(node => node.querySelector("b")?.textContent || ""));
    const ahmet = pills.filter(text => /Ahmet Yılmaz/.test(text));
    ok(ahmet.length >= 2 && ahmet.every(text => /Cari No \d+/.test(text)) && new Set(ahmet.map(text => text.match(/Cari No \d+/)[0])).size === 2, `pillerde Cari No: ${JSON.stringify(ahmet)}`);
    ok(pills.some(text => /^Kişi \d+$/.test(text)) || pills.every(text => !/^Kişi/.test(text)), "tek adlılara ek yazılmaz");
  });

  await step("A17 Tab: önce \"Tabloya Atla\", takvim tek durak; A18 tablo yana kaymaz, tutar biçimli", async () => {
    await page.reload();
    await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim() || "");
    ok(first === "Tabloya Atla", `ilk Tab durağı: “${first}”`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const where = await page.evaluate(() => Boolean(document.activeElement?.closest(".cases-panel")));
    ok(where, "Enter → odak kayıt tablosunun arama kutusunda");
    const stops = await page.$$eval(".hof-payment-promises-track .hof-payment-pill", nodes => nodes.filter(node => node.tabIndex >= 0).length);
    ok(stops === 1, `takvim şeridi Tab durağı: ${stops}`);
    const table = await page.evaluate(() => {
      const wrap = document.querySelector(".dynamic-table-wrap");
      const cell = [...document.querySelectorAll(".dynamic-table tbody tr")].find(row => row.dataset.hofKey === "2026/100")?.lastElementChild;
      return { scroll: wrap.scrollWidth, client: wrap.clientWidth, text: cell?.textContent.trim(), title: cell?.getAttribute("title") };
    });
    ok(table.scroll <= table.client + 2, `1366'da tablo yana kaymıyor (${table.scroll} / ${table.client})`);
    ok(table.text === "25.000,00" && table.title === "25000,00", `tutar biçimli “${table.text}”, ham değer title'da “${table.title}”`);
    await page.fill(".cases-panel .search-field input", "250000");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const picked = await page.evaluate(() => window.HOF.selectedCase()?.key || "");
    ok(picked === "2026/109", `ham tutarla arama kaydı buluyor (${picked})`);
    await page.fill(".cases-panel .search-field input", "");
    await shot(page, "a18-tablo");
  });

  await step("A13 \"Toplam Borç\" kutu başlığı 1280 ve 1366'da kesilmez", async () => {
    for (const width of [1280, 1366]) {
      const { context, page: view } = await openPage({ width, height: 768 });
      await view.waitForSelector('#hof-pulse [data-pulse-go="payable"]', { timeout: 15000 }).catch(() => null);
      const label = await view.$eval('#hof-pulse [data-pulse-go="payable"] .hof-pulse-label > span', node => ({ text: node.textContent, cut: node.scrollWidth > node.clientWidth + 1 })).catch(() => ({ text: "", cut: true }));
      ok(label.text === "Toplam Borç" && !label.cut, `${width}: “${label.text}” kesik ${label.cut}`);
      await context.close();
    }
  });

  await step("A20 personel ana sayfasında üst boşluk yok; A19 personele olmayan yol gösterilmez", async () => {
    const { context, page: staff } = await openPage({ user: "personel1", password: "Personel-2026!" });
    const gap = await staff.evaluate(() => {
      const wrap = document.querySelector(".main-shell .content-wrap");
      const first = [...wrap.children].find(node => node.getBoundingClientRect().height > 0);
      return Math.round(first.getBoundingClientRect().top - wrap.getBoundingClientRect().top);
    });
    ok(gap <= 40, `içerik alanının üstü ile ilk bölüm arası ${gap} px (önceden ~55)`);
    await shot(staff, "a20-personel");
    await staff.goto(`${BASE}/admin.html`);
    await staff.waitForSelector("#adm-denied:not([hidden])", { timeout: 15000 });
    const denied = await staff.$eval("#adm-denied", node => node.innerText.replace(/\s+/g, " "));
    ok(!/Raporlar →/.test(denied), `personel iletisi: “${denied.slice(0, 160)}”`);
    await context.close();
  });

  await step("A14 Sayfalar şeridi geç gelse de tablo itilmez (istek 1,5 sn geciktirilir)", async () => {
    const { context, page: slow } = await openPage();
    let delayed = 0;
    await slow.route("**/api/workspace/sessions*", async route => {
      delayed += 1;
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
    await slow.reload();
    await slow.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    await slow.waitForSelector("#hof-pages .hof-page", { timeout: 15000 });
    await slow.waitForTimeout(1200);
    const shifts = await slow.evaluate(() => window.__shifts);
    const total = shifts.reduce((sum, item) => sum + item.value, 0);
    const late = shifts.filter(item => item.at > 1500).reduce((sum, item) => sum + item.value, 0);
    ok(delayed > 0, `ön koşul: sayfa listesi isteği geciktirildi (${delayed})`);
    ok(late < 0.005, `şerit geldikten sonraki kayma ${late.toFixed(4)} (toplam ${total.toFixed(4)}; ${JSON.stringify(shifts.filter(item => item.at > 1500)).slice(0, 200)})`);
    await context.close();
  });

  await step("A9 bildirim: tur 1 + özet, dizüstünde küçük", async () => {
    const { context, page: fresh } = await openPage();
    await fresh.evaluate(() => {
      for (const key of Object.keys(localStorage)) if (key.startsWith("hof-notices")) localStorage.removeItem(key);
    });
    await fresh.reload();
    const notice = await fresh.waitForSelector("#hof-notices .hof-notice.is-visible", { timeout: 25000 }).catch(() => null);
    const info = notice ? await notice.evaluate(node => ({ count: node.querySelector(".hof-notice-count")?.textContent || "", width: Math.round(node.getBoundingClientRect().width), height: Math.round(node.getBoundingClientRect().height) })) : null;
    ok(info && info.count === "1/1", `ilk bildirimin sırası “${info?.count}” (önceden 1/5: beş bildirim dönüyordu)`);
    ok(info && info.width <= 320 && info.width * info.height < 372 * 128, `1366×768'de bildirim ${info?.width}×${info?.height} px, alan önceden 372×128'den küçük`);
    await shot(fresh, "a9-bildirim");
    await context.close();
    // Geniş ekranda (1440×900) eski düzen aynı: ilk birkaç bildirim tek tek (senaryo-225-uyari kuralı).
    const wide = await openPage({ width: 1440, height: 900 });
    await wide.page.evaluate(() => {
      for (const key of Object.keys(localStorage)) if (key.startsWith("hof-notices")) localStorage.removeItem(key);
    });
    await wide.page.reload();
    const wideNotice = await wide.page.waitForSelector("#hof-notices .hof-notice.is-visible", { timeout: 25000 }).catch(() => null);
    const wideCount = wideNotice ? await wideNotice.evaluate(node => node.querySelector(".hof-notice-count")?.textContent || "") : "";
    ok(/^1\/[2-5]$/.test(wideCount), `1440×900'de ilk bildirimin sırası “${wideCount}” (tek tek gelir; gerileme yok)`);
    await wide.context.close();
  });

  // 2.4.5 madde 6b (A18 gerilemesi): "borç" sözcüğü taşıyan kimlik / iletişim kolonu ("Borçlu Telefon", "Borçlu TC Kimlik No") para biçimine çevrilmez
  // (önceden 5367715055 → "5.367.715.055,00"; hücreden WhatsApp açılmıyordu); "Alacak Tutarı" para biçiminde kalır. Yeni kolonlar diğer adımları etkilemesin diye son adım.
  await step("A18 (6b) kimlik / iletişim kolonu ham kalır, hücreden WhatsApp açılır; Alacak Tutarı biçimli", async () => {
    await must("kimlik kolonlu kayıt", api.post("/api/workspace/records", { values: { "DOSYA NO": "2026/200", BORÇLU: "Telefonlu Kişi", "Borçlu Telefon": "5367715055", "Borçlu TC Kimlik No": "12345678950", "Alacak Tutarı": "25000,00" }, caseKey: "2026/200" }));
    await page.reload();
    await page.waitForSelector('.dynamic-table tbody tr[data-hof-key="2026/200"]', { timeout: 20000 });
    await page.waitForTimeout(800);
    const cells = await page.evaluate(() => {
      const table = document.querySelector(".dynamic-table");
      const heads = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
      const row = table.querySelector('tbody tr[data-hof-key="2026/200"]');
      const at = name => row.children[heads.findIndex(head => head.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))]?.textContent.trim();
      return { heads, phone: at("Borçlu Telefon"), tc: at("Borçlu TC Kimlik No"), amount: at("Alacak Tutarı") };
    });
    ok(cells.phone === "5367715055", `Borçlu Telefon hücresi ham “${cells.phone}” (önceden 5.367.715.055,00)`);
    ok(cells.tc === "12345678950", `Borçlu TC Kimlik No hücresi ham “${cells.tc}”`);
    ok(cells.amount === "25.000,00", `Alacak Tutarı biçimli “${cells.amount}”`);
    await page.evaluate(() => {
      window.__opened = [];
      window.open = url => (window.__opened.push(String(url)), null);
    });
    // Kullanıcının yolu: telefon hücresine ilk tıklama satırı seçer, ikincisi WhatsApp'ı açar (hof-workspace.js). Hücrenin sol kenarına tıklanır: üzerine gelinen
    // hücrenin sağında "Değeri Düzenle" (✎) düğmesi belirir ve ortadaki tıklamayı karşılar.
    const index = cells.heads.findIndex(head => head.toLocaleLowerCase("tr-TR") === "borçlu telefon");
    const phoneCell = `.dynamic-table tbody tr[data-hof-key="2026/200"] td:nth-child(${index + 1})`;
    // Yenilemeden sonra ilk satır kendiliğinden seçili olabilir: önce başka bir kayıt seçilir, böylece ilk tıklamanın yalnız seçtiği de denenir.
    await page.click('.dynamic-table tbody tr[data-hof-key="2026/100"] td:nth-child(2)', { position: { x: 6, y: 8 } }); // ilk hücrenin solunda "Kaydı Sil" (×) belirir
    await page.waitForFunction(() => window.HOF.selectedCase()?.key === "2026/100", null, { timeout: 10000 });
    await page.click(phoneCell, { position: { x: 6, y: 8 } });
    await page.waitForFunction(() => window.HOF.selectedCase()?.key === "2026/200", null, { timeout: 10000 });
    await page.waitForTimeout(400);
    const afterSelect = await page.evaluate(() => window.__opened.length);
    ok(afterSelect === 0, `ilk tıklama yalnız satırı seçer (açılan ${afterSelect})`);
    await page.click(phoneCell, { position: { x: 6, y: 8 } });
    await page.waitForFunction(() => window.__opened.length > 0, null, { timeout: 5000 }).catch(() => null);
    const opened = await page.evaluate(() => window.__opened);
    ok(opened.length === 1 && opened[0] === "https://wa.me/905367715055", `seçili satırın telefon hücresine tıklayınca WhatsApp: ${JSON.stringify(opened)}`);
    await shot(page, "a18-6b-kimlik-kolonu");
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
