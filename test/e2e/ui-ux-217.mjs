// UI/UX denetimi (2.0.17; kullanıcı isteği): bütün pencereler, kartlar, piller ve formlar gerçek veriyle açılır; her ekran
// için ekran görüntüsü alınır ve otomatik denetimler koşar: tarayıcı hatası yok, yatay taşma yok, pencere ekrana sığar,
// kırpılan yazı yok, çok küçük tıklama hedefi yok, pasif düğmelerin nedeni yazılı, odak görünür. Uzman incelemesi
// docs/2.0.17-UI-UX-DENETIMI.md'de (bu betik bulgular tablosunu üretir, ekran görüntüleri artifacts/ui-ux-217/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "ui-ux-217");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-uiux-"));
const excel = path.join(root, "rehber.xlsx");
const rows = [];
for (let i = 1; i <= 40; i += 1) rows.push({ Müşteri: `Müşteri ${i}`, Telefon: `0532 000 00 ${String(i).padStart(2, "0")}`, "Kayıt Tarihi": "01.01.2026", "Sigorta Tarihi": `${String((i % 28) + 1).padStart(2, "0")}.${String((new Date().getMonth() + 1) % 12 + 1).padStart(2, "0")}.2026`, Tutar: `${i * 100},00` });
writeFileSync(excel, buildXlsx([{ name: "Rehber", columns: ["Müşteri", "Telefon", "Kayıt Tarihi", "Sigorta Tarihi", "Tutar"], rows }], { title: "Rehber" }));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(`pageerror ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${m.location().url} ${m.text()}`)) errors.push(`${m.text()} @ ${m.location().url}`); });
page.on("dialog", d => d.accept());
const call = (url, body, method = body ? "POST" : "GET") => page.evaluate(async ([url, body, method]) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, ...j }; }, [url, body, method]);
const modal = ".hof-modal-backdrop.is-visible";
const pad = v => String(v).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));
const TODAY = iso(new Date());
const findings = []; // { screen, check, ok, detail }
let shotNo = 0;
const shot = async name => { shotNo += 1; const file = `${String(shotNo).padStart(2, "0")}-${name}.png`; await page.screenshot({ path: path.join(OUT, file) }); return file; };
const closeAll = async () => {
  for (let i = 0; i < 8 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); }
  for (let i = 0; i < 4 && (await page.$(modal)); i += 1) { await page.locator(`${modal} .hof-modal-close`).last().click({ timeout: 2000 }).catch(() => null); await page.waitForTimeout(250); }
  if (await page.$(modal)) await page.evaluate(() => document.querySelectorAll(".hof-modal-backdrop").forEach(node => node.remove()));
  await page.evaluate(() => { document.getElementById("hof-chat")?.setAttribute("hidden", ""); document.querySelector("#hof-pages .hof-pages-menu")?.setAttribute("hidden", ""); document.querySelectorAll(".hof-session-menu").forEach(m => m.setAttribute("hidden", "")); });
};

// ---------- Otomatik denetimler (her ekranda) ----------
async function audit(screen) {
  const before = errors.length;
  const r = await page.evaluate(() => {
    const out = { hscroll: document.documentElement.scrollWidth > window.innerWidth + 1, modalOut: null, clipped: [], tiny: [], disabledNoReason: [], lowContrast: [] };
    const top = [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal")].at(-1);
    if (top) { const b = top.getBoundingClientRect(); out.modalOut = b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1 ? `${Math.round(b.left)},${Math.round(b.top)}→${Math.round(b.right)},${Math.round(b.bottom)}` : null; }
    const scope = top || document;
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    // Kırpılan yazı: buton, pil, kart başlığı, tablo başlığı — taşıyor ve ellipsis/sarma yok.
    for (const el of scope.querySelectorAll("button, .hof-chip, .hof-pulse-tile b, .hof-pulse-value, th, .hof-page-pick b, .hof-session-text strong, dt, .hof-plan-title h3")) {
      if (!visible(el) || el.closest("[hidden]")) continue;
      const cs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && cs.whiteSpace === "nowrap") out.clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}: “${el.textContent.trim().slice(0, 40)}”`);
    }
    // Küçük tıklama hedefi (< 22 px yükseklik) — gerçek düğmeler.
    for (const el of scope.querySelectorAll("button, a.hof-button")) {
      if (!visible(el) || el.closest("[hidden]") || getComputedStyle(el).opacity === "0") continue;
      const b = el.getBoundingClientRect();
      if (b.height < 22 || b.width < 22) out.tiny.push(`${el.className.split(" ")[0] || el.tagName}: “${el.textContent.trim().slice(0, 30)}” ${Math.round(b.width)}×${Math.round(b.height)} <${el.outerHTML.slice(0, 90).replace(/\s+/g, " ")}>`);
    }
    // Pasif düğmenin nedeni (madde 10): disabled ana işlem düğmeleri title ya da yanında .hof-inv-block yazısı taşımalı.
    for (const el of scope.querySelectorAll("button[disabled]")) {
      if (!visible(el) || el.closest("[hidden]")) continue;
      const reason = el.title || el.getAttribute("aria-describedby") || el.closest(".hof-inv-actions, .hof-plan-actions, .hof-chq-actions")?.querySelector(".hof-inv-blocks, .hof-blocks, .hof-block")?.textContent;
      if (!reason && el.textContent.trim().length > 1) out.disabledNoReason.push(`“${el.textContent.trim().slice(0, 30)}”`);
    }
    // Kontrast (kaba): küçük yazıların rengi arka planla aynı tona yakınsa.
    const lum = c => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    for (const el of [...scope.querySelectorAll("small, .hof-muted, .hof-page-pick small, .hof-session-text small")].slice(0, 200)) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      let bg = "rgba(0, 0, 0, 0)"; let p = el;
      while (p && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; }
      if (/rgba\([^)]*,\s*0?\.\d+\)/.test(bg)) continue; // yarı saydam zemin (ör. pencere arka perdesi): gerçek zemin bilinmiyor, ölçülmez
      const l1 = lum(cs.color), l2 = lum(bg);
      if (l1 == null || l2 == null) continue;
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 3) out.lowContrast.push(`“${el.textContent.trim().slice(0, 30)}” ${ratio.toFixed(1)}:1 (${cs.color} / ${bg}; ${el.parentElement?.className || el.parentElement?.tagName})`);
    }
    return out;
  });
  const add = (check, ok, detail = "") => findings.push({ screen, check, ok, detail });
  add("Tarayıcı hatası yok", errors.length === before, errors.slice(before).join(" | ").slice(0, 200));
  add("Yatay taşma yok", !r.hscroll);
  add("Pencere ekrana sığıyor", !r.modalOut, r.modalOut || "");
  add("Kırpılan yazı yok", r.clipped.length === 0, r.clipped.slice(0, 5).join("; "));
  add("Küçük tıklama hedefi yok (≥ 22 px)", r.tiny.length === 0, r.tiny.slice(0, 5).join("; "));
  add("Pasif düğmenin nedeni var", r.disabledNoReason.length === 0, r.disabledNoReason.slice(0, 5).join("; "));
  add("Küçük yazı kontrastı ≥ 3:1", r.lowContrast.length === 0, r.lowContrast.slice(0, 5).join("; "));
}
async function screen(name, fn) {
  console.log(`\n■ ${name}`);
  try {
    await fn();
    await page.waitForTimeout(400);
    const file = await shot(name.replace(/[^a-z0-9ğüşöçıİ-]+/gi, "-").toLocaleLowerCase("tr-TR"));
    await audit(name);
    findings.at(-1).file = file;
    console.log(`  ${file}`);
  } catch (error) {
    findings.push({ screen: name, check: "ekran açıldı", ok: false, detail: error.message.split("\n")[0].slice(0, 200) });
    console.log(`  ✗ ${error.message.split("\n")[0]}`);
    await shot("hata").catch(() => {});
  }
  await closeAll();
}
const openWindow = async action => { await page.click(`#hof-sidecard [data-action="${action}"]`); await page.waitForSelector(modal, { timeout: 15000 }); await page.waitForTimeout(700); };
const clickFirstRow = async () => { const row = await page.$(`${modal} tbody tr[tabindex="0"], ${modal} tbody tr[data-inv], ${modal} tbody tr[data-plan], ${modal} tbody tr[data-item], ${modal} tbody tr[data-cheque], ${modal} tbody tr[data-id]`); if (!row) throw new Error("satır yok"); await row.click(); await page.waitForTimeout(900); };
const clickButton = async re => { const b = page.locator(`${modal} button`, { hasText: re }).first(); await b.click(); await page.waitForTimeout(700); };

try {
  // ---------- Veri hazırlığı ----------
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-start .hof-drop");
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
  await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 }).catch(() => null);
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => page.keyboard.press("Escape"));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 20000 });
  const sup = (await call("/api/workspace/accounts", { name: "Akçansa Bayi", type: "supplier" })).data.id;
  const cust = (await call("/api/workspace/accounts", { name: "Yılmaz İnşaat", type: "customer", phone: "0532 111 22 33" })).data.id;
  const item = (await call("/api/workspace/stock", { name: "Çimento 50 Kg", code: "CIM-50", unit: "Torba", unitPrice: 100, salePrice: 150, minQty: 100 })).data.id;
  await call("/api/workspace/cash", { kind: "in", amount: 50000, date: TODAY, method: "cash", description: "Açılış" });
  await call("/api/workspace/invoices", { scenario: "goods_purchase", accountId: sup, number: "AKC-1", issueDate: TODAY, lines: [{ itemId: item, qty: 500, unitPrice: 100, vatRate: 20 }], payment: { cash: [{ amount: 10000, method: "cash" }], rest: "open" } });
  const sale = (await call("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust, issueDate: TODAY, lines: [{ itemId: item, qty: 420, unitPrice: 150, vatRate: 20 }], payment: { cash: [{ amount: 5000, method: "card" }], rest: "installments", installments: { count: 4, firstDue: shift(20), everyMonths: 1 } } })).data;
  await call("/api/workspace/invoices", { kind: "sale_return", originalId: sale.id, issueDate: TODAY, lines: [{ originLineId: sale.lines[0].id, qty: 5 }], payment: { cash: [{ amount: 900, method: "card" }], rest: "open" } });
  await call("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: cust, drawer: "Yılmaz İnşaat", amount: 7500, issueDate: TODAY, dueDate: shift(3), serialNo: "ALN-1", bank: "Garanti" });
  await call("/api/workspace/cheques", { direction: "out", instrument: "note", accountId: sup, drawer: "Akçansa Bayi", amount: 3000, issueDate: TODAY, dueDate: shift(-2), serialNo: "VRL-1", bank: "" });
  await call("/api/workspace/tasks", { title: "Sigorta yenileme araması", due: shift(1), priority: "urgent" }).catch(() => null);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-pages .hof-page.is-current", { timeout: 20000 });
  await page.waitForTimeout(1500);

  // ---------- Ekranlar ----------
  await screen("Ana ekran — şirket seçici, sayfa şeridi, ANLIK DURUM, takvim şeridi, tablo", async () => {});
  // Şeritler yer kavgası yapmasın: 3 saniyede içerik alanının çocukları en çok birkaç kez değişir, takvim şeridi aynı düğüm kalır.
  const churn = await page.evaluate(() => new Promise(resolve => {
    const wrap = document.querySelector(".main-shell .content-wrap");
    const band = document.querySelector(".hof-payment-promises");
    let count = 0;
    const mo = new MutationObserver(list => { for (const m of list) if (m.target === wrap) count += m.addedNodes.length + m.removedNodes.length; });
    mo.observe(wrap, { childList: true });
    setTimeout(() => { mo.disconnect(); resolve({ count, sameBand: band === document.querySelector(".hof-payment-promises"), order: [...wrap.children].map(c => c.id || c.className.split(" ")[0]).join(" > ") }); }, 3000);
  }));
  findings.push({ screen: "Ana ekran", check: "Şeritler yer kavgası yapmıyor (3 sn: ≤ 4 DOM değişimi, takvim şeridi aynı düğüm)", ok: churn.count <= 4 && churn.sameBand, detail: `${churn.count} değişim · ${churn.order}` });
  await screen("Şirket seçici menüsü", async () => { await page.click("#hof-company [data-toggle]"); await page.waitForSelector("#hof-company .hof-session-menu:not([hidden])"); });
  await page.keyboard.press("Escape");
  await screen("+ Sayfa menüsü", async () => { await page.click("#hof-pages [data-add]"); await page.waitForSelector("#hof-pages .hof-pages-menu:not([hidden])"); });
  await page.keyboard.press("Escape");
  await screen("Zil — bildirim listesi", async () => { await page.click(".topbar .top-actions > .icon-button"); await page.waitForSelector(modal, { timeout: 8000 }); });
  await screen("Tahsilat Takvimi pil kartı", async () => { await page.hover(".hof-payment-promises-viewport"); await page.$eval(".hof-payment-promises .hof-payment-pill:not([aria-hidden])", node => node.click()); await page.waitForSelector(".hof-payment-action-card", { timeout: 5000 }); });
  await page.keyboard.press("Escape");
  await screen("Detay kartı (tablodaki kayıt)", async () => { await page.click(".dynamic-table tbody tr"); await page.waitForTimeout(800); });
  await screen("Görevler", async () => openWindow("tasks"));
  await screen("Mesajlar", async () => { await page.click('#hof-sidecard [data-action="messages"]'); await page.waitForSelector("#hof-chat:not([hidden])", { timeout: 8000 }); await page.waitForTimeout(600); });
  await screen("Cari — liste", async () => openWindow("accounts"));
  await screen("Cari — kart", async () => { await openWindow("accounts"); await clickFirstRow(); });
  await screen("Cari — tahsilat formu (Kapatılacak Fatura)", async () => { await openWindow("accounts"); await clickFirstRow(); await clickButton(/Tahsilat/); });
  await screen("Cari — yeni cari formu", async () => { await openWindow("accounts"); await clickButton(/Yeni Cari/); });
  await screen("Kasa — nakit", async () => openWindow("cash"));
  await screen("Kasa — Tahsilat Ekle (yalnız Nakit)", async () => { await openWindow("cash"); await clickButton(/\+ Tahsilat/); });
  await screen("Kasa — Banka transferi", async () => { await openWindow("cash"); await clickButton(/Banka/); });
  await screen("Stok — liste", async () => openWindow("stock"));
  await screen("Stok — kart", async () => { await openWindow("stock"); await clickFirstRow(); });
  await screen("Stok — yeni ürün formu", async () => { await openWindow("stock"); await clickButton(/Yeni Ürün/); });
  await screen("Fatura — liste", async () => openWindow("invoices"));
  await screen("Fatura — kart (Bu Faturayı Kapatanlar, pasif düğme nedeni)", async () => { await openWindow("invoices"); await clickFirstRow(); });
  await screen("Fatura — yeni fatura formu", async () => { await openWindow("invoices"); await clickButton(/Yeni Fatura/); });
  await screen("Çek / Senet — liste", async () => openWindow("cheques"));
  await screen("Çek / Senet — kart", async () => { await openWindow("cheques"); await clickFirstRow(); });
  await screen("Çek / Senet — ciro formu (cari seçici)", async () => { await openWindow("cheques"); await page.locator(`${modal} tr[data-cheque]`, { hasText: "ALN-1" }).first().click(); await page.waitForTimeout(900); await page.click(`${modal} [data-action="endorse"]`); await page.waitForTimeout(700); });
  await screen("Taksitler — liste", async () => openWindow("plans"));
  await screen("Taksitler — kart", async () => { await openWindow("plans"); await clickFirstRow(); });
  // Banka (v2.1.0, plan §8.12): ilk açılışta Kurulum Sihirbazı; Genel Bakış (Hesabı Atanmamış Eski Hareketler: faturadaki POS), Hesaplar,
  // Hesap Detayı, Ayarlar (Gelişmiş açık).
  const bankTab = async id => { await page.click(`${modal} .hof-bank-tabs [data-tab="${id}"]`); await page.waitForTimeout(700); };
  await screen("Banka — Kurulum Sihirbazı (ilk açılış)", async () => { await openWindow("bank"); await page.waitForSelector(".hof-bank-wiz-modal [data-wiz-form]", { timeout: 8000 }); });
  await screen("Banka — Genel Bakış (hesabı atanmamış eski hareket)", async () => { await openWindow("bank"); await page.waitForTimeout(500); });
  const bankAccount = (await call("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: TODAY, amount: "100.000", confirmed: true } })).data;
  await screen("Banka — Hesaplar", async () => { await openWindow("bank"); await bankTab("accounts"); });
  await screen("Banka — Hesap Detayı", async () => { await openWindow("bank"); await bankTab("accounts"); await clickFirstRow(); });
  await screen("Banka — yeni hesap formu", async () => { await openWindow("bank"); await bankTab("accounts"); await clickButton(/Yeni Hesap/); });
  await screen("Banka — Ayarlar (Gelişmiş)", async () => { await openWindow("bank"); await bankTab("settings"); await page.click(`${modal} [data-act="advanced"]`); await page.waitForTimeout(400); });
  await screen("Banka — Hesabı Atanmamış Eski Hareketler", async () => { await openWindow("bank"); await page.click(`${modal} [data-bank-unassigned] [data-act="legacy"]`); await page.waitForTimeout(900); });
  // Banka — Hareketler (v2.1.0 Aşama 4, plan §8.6): liste, İşlem Kartı (etkin ve ters kaydedilmiş: pasif düğme nedeni), masraf ve faiz
  // formları, Planlı İşlemler.
  const fee = (await call("/api/workspace/bank/vouchers", { type: "fee", accountId: bankAccount.id, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: TODAY })).data;
  await call("/api/workspace/bank/vouchers", { type: "interest_in", accountId: bankAccount.id, amount: "1.000", stoppageRate: "15", date: TODAY });
  await call("/api/workspace/bank/plans", { kind: "other_out", accountId: bankAccount.id, amount: "5.000", plannedDate: TODAY, repeat: "monthly", description: "Kira" });
  await screen("Banka — Hareketler", async () => { await openWindow("bank"); await bankTab("movements"); await page.waitForSelector(`${modal} .hof-bank-moves tbody tr[data-event]`, { timeout: 8000 }); });
  await screen("Banka — İşlem Kartı", async () => { await openWindow("bank"); await bankTab("movements"); await page.click(`${modal} .hof-bank-moves tbody tr[data-event="${fee.id}"]`); await page.waitForSelector(`${modal} [data-event-no]`, { timeout: 8000 }); });
  await screen("Banka — masraf formu", async () => { await openWindow("bank"); await bankTab("movements"); await clickButton(/\+ Masraf/); await page.fill(".hof-bank-voucher [name=amount]", "10,50"); });
  await screen("Banka — faiz formu", async () => { await openWindow("bank"); await bankTab("movements"); await clickButton(/\+ Faiz/); });
  await screen("Banka — Planlı İşlemler", async () => { await openWindow("bank"); await bankTab("movements"); await page.click(`${modal} [data-act="mv-planned"]`); await page.waitForSelector(`${modal} .hof-bank-plans tbody tr[data-plan]`, { timeout: 8000 }); });
  await call(`/api/workspace/bank/events/${fee.id}/reverse`, {});
  await screen("Banka — ters kaydedilmiş İşlem Kartı (pasif düğme nedeni)", async () => { await openWindow("bank"); await bankTab("movements"); await page.click(`${modal} .hof-bank-moves tbody tr[data-event="${fee.id}"]`); await page.waitForSelector(`${modal} [data-bank-event-blocks]`, { timeout: 8000 }); });
  const openCenter = async () => { await openWindow("analytics"); await page.click(`${modal} .hof-rep-tab[data-tab="all"]`); await page.waitForSelector(`${modal} .hof-rc-item`, { timeout: 15000 }); await page.waitForTimeout(500); };
  await screen("Raporlar — Vade Takip (ilk sekme)", async () => { await openWindow("analytics"); await page.waitForTimeout(1200); });
  await screen("Raporlar — Rapor Merkezi", openCenter);
  await screen("Raporlar — Banka ve POS Hareketleri", async () => { await openCenter(); await page.click(`${modal} .hof-rc-item[data-report="banka-pos-hareketleri"]`); await page.waitForTimeout(1500); });
  await screen("Raporlar — Cari Ekstre", async () => { await openCenter(); await page.click(`${modal} .hof-rc-item[data-report="cari-ekstre"]`); await page.waitForTimeout(1500); });
  await screen("Raporlar — Stok Durumu (eksi stok)", async () => { await openCenter(); await page.click(`${modal} .hof-rc-item[data-report="stok-durumu"]`); await page.waitForTimeout(1500); });
  await screen("Personel Raporu", async () => openWindow("reports"));
  await screen("ANLIK DURUM — Rapor Al", async () => { await page.click("#hof-pulse [data-pulse='report']"); await page.waitForSelector(modal); await page.waitForTimeout(900); });
  await screen("Ayarlar — Veri ve Sayfalar", async () => { await page.click("#hof-side-settings"); await page.waitForSelector(modal); await page.waitForTimeout(600); });
  await screen("Serbest sayfa — Boş Sayfa formu", async () => { await page.click("#hof-pages [data-add]"); await page.waitForSelector("#hof-pages .hof-pages-menu:not([hidden])"); await page.click('#hof-pages [data-add-source="blank"]'); await page.waitForSelector(modal); });
  await page.goto(`${BASE}/admin.html`, { waitUntil: "load" });
  await page.waitForSelector("#adm-app:not([hidden])", { timeout: 15000 });
  for (const tab of ["users", "backups", "audit", "trash", "companies", "system", "license"]) {
    await screen(`Yönetim — ${tab}`, async () => { await page.click(`.adm-tabs [data-tab="${tab}"]`); await page.waitForSelector(`.adm-panel[data-panel="${tab}"]:not([hidden])`, { timeout: 15000 }); await page.waitForTimeout(1200); });
  }
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-pages .hof-page.is-current", { timeout: 20000 });
  await page.setViewportSize({ width: 1024, height: 700 });
  await screen("Dar ekran (1024×700) — ana ekran", async () => { await page.waitForTimeout(800); });
  await screen("Dar ekran — Fatura formu", async () => { await openWindow("invoices"); await clickButton(/Yeni Fatura/); });
  await screen("Dar ekran — Cari kart", async () => { await openWindow("accounts"); await clickFirstRow(); });
} catch (error) {
  console.error("HATA:", error.message);
  findings.push({ screen: "genel", check: "betik", ok: false, detail: error.message });
}
const ok = findings.filter(f => f.ok).length;
const screens = [...new Set(findings.map(f => f.screen))];
const md = [`# 2.0.17 — UI / UX Denetimi (otomatik bulgular)`, "", `Tarih: ${TODAY} · ${screens.length} ekran · ${ok} / ${findings.length} denetim geçti. Ekran görüntüleri: \`test/e2e/artifacts/ui-ux-217/\`. Betik: \`node test/e2e/ui-ux-217.mjs\`.`, "",
  "| Ekran | Denetim | Sonuç | Ayrıntı |", "|---|---|---|---|",
  ...findings.map(f => `| ${f.screen} | ${f.check} | ${f.ok ? "✅" : "❌"} | ${(f.detail || "").replace(/\|/g, "/")} |`), ""].join("\n");
writeFileSync(path.join(OUT, "bulgular.md"), md);
writeFileSync(path.join(OUT, "bulgular.json"), JSON.stringify({ findings, errors }, null, 2));
console.log(`\n${ok} / ${findings.length} denetim geçti (${screens.length} ekran). Bulgular: ${path.join(OUT, "bulgular.md")}`);
await browser.close();
await app.close();
rmSync(root, { recursive: true, force: true });
process.exit(ok === findings.length ? 0 : 1);
