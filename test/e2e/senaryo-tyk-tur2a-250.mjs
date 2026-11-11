// 2.5.0 Ç5-B tur 2a EKRANDAN (dar kontrol DK-C5B Y-1, O-2, O-3; docs/erp/C5B-TYK-TASARIM.md §10): stoktan veresiye satış → taksitlendir → taksit kartı; Taksitler listesi
// sekmeleri; cari kartı Gecikmiş Borç; zil; karttan taksit tahsilatı (gerçek tıklama, insan hızında yazım — ders 12) sonrası kartın gösterdiği = yeniden açıldığında gösterdiği
// (O-2); taksitsiz kartın kalanı zilde ve gecikmişte (O-3). Kurulum programın kendi API'siyle (stok hareketi + taksitlendir yolu); bakış ve tahsilat EKRANDAN.
// Beklenen (ELLE — v2.4.9'un gerçek kodu ve karar metinleri; programdan bağımsız):
//   • satış 1.000 (−20), 2 taksit (−10, +20), kartın Kayıt Tarihi carinin Kayıt Tarihi (−400) → kart Gecikti, taksitler 500 / 500; "Geciken" sekmesinde; cari kartı Gecikmiş
//     Borç 500 (1 kalem); zilde "1. taksit" (önceden kart 'Bitti' / 0 / 0, Gecikmiş Borç 1.000, zilde "Tahsil Edilecek Borç 1.000");
//   • karttan Taksit Tahsilatı 200 (bugün) → 1. taksit 300 kalır: kart penceresi 300 / 500 gösterir, pencere kapatılıp yeniden açılınca da 300 / 500; veri tabanında 200;
//   • taksitsiz Yeni Borç kartı 1.000 (−20) → zilde "Taksitlendirilmemiş Kalan" 1.000 gecikmiş; cari kartı Gecikmiş Borç 1.000.
// Sahte saat (ders 13); lisans servisi ölü adres (ders 30); pencere seçicisi ders 39. Çalıştırma: npm run test:senaryo-tyk-tur2a-250 — çıkış "N geçti, M kaldı".
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-tyk-tur2a-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};

const root = mkdtempSync(path.join(tmpdir(), "destekofis-tyk-tur2a-250-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f51" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
const browser = await chromium.launch();
const errors = [];
let page = null;
const shot = name => page?.screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => null);
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
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
const planRows = () => page.$$eval(`${TOP} tr[data-item]`, rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent.replace(/\s+/g, " ").trim())));
const openCard = async planId => {
  await page.evaluate(id => window.HOF.plans.open(id), planId);
  await page.waitForSelector(`${TOP} tr[data-item]`, { timeout: 15000 });
  await page.waitForTimeout(400);
};
const bell = async () => {
  await page.click(".topbar .top-actions > .icon-button");
  await page.waitForSelector(".hof-alert-list");
  await page.waitForTimeout(300);
  const items = await page.evaluate(() => [...document.querySelectorAll(".hof-alert-list li")].map(node => node.textContent.replace(/\s+/g, " ").trim()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return items;
};

try {
  console.log("\n■ Kurulum (programın API'si): ürün + alım; stoktan veresiye satış + taksitlendir; taksitsiz Yeni Borç kartı");
  await api.login("admin", PASS);
  await must("banka kurulumu", api.post("/api/workspace/bank/setup/dismiss", {}));
  const goods = await must("ürün", api.post("/api/workspace/stock", { name: "Ekran Ürün", code: "EKR-T2A", unit: "Adet", unitPrice: "10", salePrice: "100" }));
  await must("alım", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", unitPrice: "10", pay: "none", date: day(-100) }));
  const a = await must("cari A", api.post("/api/workspace/accounts", { name: "Ekran Stok Müşteri", type: "customer", registeredOn: day(-400), phone: "0500 253 10 01" }));
  await must("satış + taksitlendir", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "10", unitPrice: "100", pay: "account", method: "cash", accountId: a.id, date: day(-20), installments: { count: 2, firstDue: day(-10) } }));
  const planA = (await must("cari A kartı", api.get(`/api/workspace/accounts/${a.id}`))).plans[0].id;
  const b = await must("cari B", api.post("/api/workspace/accounts", { name: "Ekran Taksitsiz Müşteri", type: "customer", registeredOn: day(-400), phone: "0500 253 10 02" }));
  const planB = (await must("taksitsiz kart", api.post("/api/workspace/plans", { name: b.name, registeredOn: day(-20), total: "1000", accountId: b.id }))).id;
  ok(app.store.get("SELECT registered_on AS r FROM plans WHERE id = ?", planA)?.r === day(-400), "stoktan açılan kartın Kayıt Tarihi carinin Kayıt Tarihi (borçtan önce — Y-1 koşulu)");

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  page = await context.newPage();
  await installPageClock(page, app.config.now);
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForFunction(() => Boolean(window.HOF?.plans?.open && window.HOF?.accounts?.open && window.HOF?.dues), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await closeAll();

  await step("E1 Taksitler: stoktan açılan kart 'Geciken' sekmesinde (Y-1; önceden 'Biten')", async () => {
    await page.evaluate(() => window.HOF.plans.open());
    await page.waitForSelector(`${TOP} [data-status="overdue"]`, { timeout: 15000 });
    await page.click(`${TOP} [data-status="overdue"]`);
    await page.waitForTimeout(800);
    const late = await page.$$eval(`${TOP} tr[data-plan]`, rows => rows.map(row => row.getAttribute("data-plan")));
    ok(late.includes(planA), `Geciken sekmesinde stok kartı (${late.length} kart)`);
    await page.click(`${TOP} [data-status="done"]`);
    await page.waitForTimeout(800);
    const done = await page.$$eval(`${TOP} tr[data-plan]`, rows => rows.map(row => row.getAttribute("data-plan")));
    ok(!done.includes(planA), "Biten sekmesinde değil");
    await shot("e1-taksitler-geciken");
    await closeAll();
  });

  await step("E2 Kart penceresi: taksitler 500 / 500, 1. taksit Gecikti (Y-1)", async () => {
    await openCard(planA);
    const rows = await planRows();
    ok(rows.length === 2, `iki taksit satırı (${rows.length})`);
    ok(rows[0]?.[4]?.includes("500,00") && rows[1]?.[4]?.includes("500,00"), `kalanlar 500 / 500: ${JSON.stringify(rows.map(r => r[4]))}`);
    ok(rows[0]?.[5]?.includes("Gecikti"), `1. taksit Gecikti: “${rows[0]?.[5]}”`);
    await shot("e2-kart");
  });

  await step("E3 Karttan Taksit Tahsilatı 200 (gerçek tıklama, insan hızı) → kart 300 / 500; kapatılıp yeniden açılınca aynı (O-2); veri tabanında 200", async () => {
    await page.click(`${TOP} [data-act="pay"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`, { timeout: 10000 });
    await page.click(`${TOP} input[name="amount"]`);
    await page.keyboard.press("Control+A");
    for (const ch of "200") await page.keyboard.type(ch, { delay: 60 });
    await page.keyboard.press("Tab");
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`, { state: "detached", timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(900);
    const after = await planRows();
    ok(after[0]?.[4]?.includes("300,00") && after[1]?.[4]?.includes("500,00"), `tahsilattan hemen sonra kart: ${JSON.stringify(after.map(r => r[4]))}`);
    const entry = app.store.get("SELECT amount, date FROM plan_entries WHERE plan_id = ? AND kind = 'in'", planA);
    ok(Number(entry?.amount) === 200 && entry?.date === TODAY, `veri tabanı: tahsilat ${JSON.stringify(entry)}`);
    await shot("e3-tahsilat-sonrasi");
    await closeAll();
    await openCard(planA);
    const again = await planRows();
    ok(JSON.stringify(again.map(r => [r[4], r[5]])) === JSON.stringify(after.map(r => [r[4], r[5]])), `yeniden açılınca aynı: ${JSON.stringify(again.map(r => [r[4], r[5]]))}`);
    await closeAll();
  });

  await step("E4 Cari kartı Gecikmiş Borç (Y-1: 300 — 1. taksitin kalanı; önceden satışın tamamı)", async () => {
    await page.evaluate(id => window.HOF.accounts.open(id), a.id);
    await page.waitForSelector(`${MODAL} [data-acc-overdue]`, { timeout: 15000 });
    const kpi = await page.$eval(`${MODAL} [data-acc-overdue]`, node => node.textContent.replace(/\s+/g, " ").trim());
    ok(/300,00/.test(kpi) && kpi.includes("1 kalem"), `ekranda: “${kpi}”`);
    await shot("e4-cari-karti");
    await closeAll();
  });

  await step("E5 Zil: stok kartının 1. taksiti; taksitsiz kartın 'Taksitlendirilmemiş Kalan' 1.000 (O-3)", async () => {
    const items = await bell();
    const mineA = items.filter(text => text.includes("Ekran Stok Müşteri"));
    const mineB = items.filter(text => text.includes("Ekran Taksitsiz Müşteri"));
    ok(mineA.some(text => text.includes("1. taksit") && text.includes("300,00")), `zilde stok kartı: ${JSON.stringify(mineA)}`);
    ok(mineB.some(text => text.includes("Taksitlendirilmemiş Kalan") && text.includes("1.000,00")), `zilde taksitsiz kart: ${JSON.stringify(mineB)}`);
    const card = await must("cari B kartı", api.get(`/api/workspace/accounts/${b.id}`));
    ok(card.totals.overdueDebt === 1000, `cari B Gecikmiş Borç 1.000 (${card.totals.overdueDebt})`);
    const vade = await must("Vade Takip", api.get("/api/workspace/overview/vade-takip?preset=late"));
    const sumB = vade.rows.filter(r => r.party === b.name).reduce((s, r) => s + r.amount, 0);
    ok(sumB === 1000, `Vade Takip (gecikmiş) taksitsiz kart 1.000 (${sumB})`);
    await shot("e5-zil");
  });

  // Ç5-B tur 2b-1 (DK-C5BT2A G-2, ORTA-2). ELLE (v2.4.9'un gerçek kodu; S91 / S93 / S96): taksitsiz 'Carinin Mevcut Borcunu Taksitlendir' kartı (Borç Yaz 1.000 −20) açılır
  // açılmaz Aktif ('Aktif' sekmesinde, 'Biten'de değil); "+ Taksit" ile 500 (−10) + 500 (+20) girilince kart Gecikti, taksitler 500 / 500, cari kartı Gecikmiş Borç 500 (1 kalem).
  // Tedarikçiye stoktan Alış İadesi 300 (−20) → Vade Takip ve zilde "Tahsil Edilecek Borç 300" (gecikmiş).
  await step("E6 Taksitsiz Mevcut Borç kartı 'Aktif' sekmesinde → + Taksit ile iki taksit (gerçek tıklama, insan hızı) → kart Gecikti 500 / 500; Gecikmiş Borç 500 (G-2)", async () => {
    const c = await must("cari C", api.post("/api/workspace/accounts", { name: "Ekran Mevcut Borç Müşteri", type: "customer", registeredOn: day(-400), phone: "0500 253 10 03" }));
    await must("Borç Yaz", api.post(`/api/workspace/accounts/${c.id}/entries`, { kind: "debt", amount: "1000", date: day(-20), method: "cash", cashForce: true }));
    const planC = (await must("taksitsiz Mevcut Borç kartı", api.post("/api/workspace/plans", { name: c.name, registeredOn: day(-20), total: "1000", accountId: c.id, coversBalance: true }))).id;
    await page.evaluate(() => window.HOF.plans.open());
    await page.waitForSelector(`${TOP} [data-status="active"]`, { timeout: 15000 });
    await page.click(`${TOP} [data-status="active"]`);
    await page.waitForTimeout(800);
    const active = await page.$$eval(`${TOP} tr[data-plan]`, rows => rows.map(row => row.getAttribute("data-plan")));
    ok(active.includes(planC), `Aktif sekmesinde taksitsiz Mevcut Borç kartı (${active.length} kart)`);
    await page.click(`${TOP} [data-status="done"]`);
    await page.waitForTimeout(800);
    const done = await page.$$eval(`${TOP} tr[data-plan]`, rows => rows.map(row => row.getAttribute("data-plan")));
    ok(!done.includes(planC), "Biten sekmesinde değil (önceden açılır açılmaz 'Bitti')");
    await closeAll();
    await page.evaluate(id => window.HOF.plans.open(id), planC);
    await page.waitForSelector(`${TOP} [data-act="addItem"]`, { timeout: 15000 });
    await shot("e6-taksitsiz-kart");
    for (const [due, amount] of [[day(-10), "500"], [day(20), "500"]]) {
      await page.click(`${TOP} [data-act="addItem"]`);
      await page.waitForSelector(`${TOP} input[name="dueDate"]`, { timeout: 10000 });
      await page.fill(`${TOP} input[name="dueDate"]`, due);
      await page.click(`${TOP} input[name="amount"]`);
      await page.keyboard.press("Control+A");
      for (const ch of amount) await page.keyboard.type(ch, { delay: 60 });
      await page.keyboard.press("Tab");
      await page.click(`${TOP} button[type="submit"]`);
      await page.waitForSelector(`${TOP} input[name="dueDate"]`, { state: "detached", timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(800);
    }
    const rows = await planRows();
    ok(rows.length === 2 && rows[0]?.[4]?.includes("500,00") && rows[1]?.[4]?.includes("500,00"), `taksitler 500 / 500: ${JSON.stringify(rows.map(r => r[4]))}`);
    ok(rows[0]?.[5]?.includes("Gecikti"), `1. taksit Gecikti: “${rows[0]?.[5]}”`);
    const items = app.store.all("SELECT due_date AS d, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date", planC);
    ok(JSON.stringify(items.map(i => [i.d, Number(i.amount)])) === JSON.stringify([[day(-10), 500], [day(20), 500]]), `veri tabanı: ${JSON.stringify(items)}`);
    await shot("e6-taksit-girildi");
    await closeAll();
    await page.evaluate(id => window.HOF.accounts.open(id), c.id);
    await page.waitForSelector(`${MODAL} [data-acc-overdue]`, { timeout: 15000 });
    const kpi = await page.$eval(`${MODAL} [data-acc-overdue]`, node => node.textContent.replace(/\s+/g, " ").trim());
    ok(/500,00/.test(kpi) && kpi.includes("1 kalem"), `cari kartı Gecikmiş Borç: “${kpi}”`);
    await closeAll();
  });

  await step("E7 Tedarikçiye stoktan Alış İadesi 300 → Vade Takip ve zilde 'Tahsil Edilecek Borç 300' (ORTA-2)", async () => {
    const d = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Ekran İade Tedarikçi", type: "supplier", registeredOn: day(-400), phone: "0500 253 10 04" }));
    await must("alış iadesi", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "3", unitPrice: "100", pay: "account", method: "cash", accountId: d.id, date: day(-20) }));
    const card = await must("tedarikçi kartı", api.get(`/api/workspace/accounts/${d.id}`));
    ok(card.totals.overdueDebt === 300, `Gecikmiş Borç 300 (${card.totals.overdueDebt})`);
    await page.evaluate(() => window.HOF.overview.openReports("vade"));
    await page.waitForSelector(`${TOP} [data-q]`, { timeout: 15000 });
    await page.click(`${TOP} [data-q]`);
    for (const ch of "İade Tedarikçi") await page.keyboard.type(ch, { delay: 40 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    const lines = await page.$$eval(`${TOP} tr`, rows => rows.map(row => row.textContent.replace(/\s+/g, " ").trim()).filter(text => text.includes("Ekran İade Tedarikçi")));
    ok(lines.some(text => text.includes("Tahsil Edilecek Borç") && text.includes("300,00")), `Vade Takip: ${JSON.stringify(lines)}`);
    await shot("e7-vade-takip");
    await closeAll();
    const bellItems = (await bell()).filter(text => text.includes("Ekran İade Tedarikçi"));
    ok(bellItems.some(text => text.includes("Tahsil Edilecek Borç") && text.includes("300,00")), `zilde: ${JSON.stringify(bellItems)}`);
  });
  await context.close();
} catch (error) {
  failed += 1;
  console.error("HATA:", error);
} finally {
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log(`\nSONUÇ: ${passed} geçti, ${failed} kaldı`);
  process.exit(failed ? 1 : 0);
}
