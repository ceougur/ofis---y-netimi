// Fatura modülü QA denetimi (arayüz, Playwright): bölüm 4 (UX) + icra dosyası bağı (E5) + performans.
// Sonuç: qa/sonuc-ui.json, ekran görüntüleri qa/ui/
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../../node_modules/playwright/index.mjs";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "artifacts", "ui");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const R = [];
async function T(id, section, name, steps, expected, fn, { severity = "Medium" } = {}) {
  let out;
  try {
    out = await fn();
  } catch (error) {
    out = { ok: false, actual: `HATA: ${error.message.split("\n")[0]}`, severity: "High" };
  }
  const status = out.status || (out.ok ? "PASS" : "FAIL");
  R.push({ id, section, name, steps, expected, actual: out.actual || "", status, severity: status === "PASS" ? "" : out.severity || severity, bug: out.bug || "" });
  console.log(`${status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "◐"} ${id} ${name} — ${status} · ${String(out.actual || "").slice(0, 170)}`);
}
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "qa-fatura-ui-"));
const excel = path.join(root, "icra-dosyalari.xlsx");
const COLS = ["Dosya No", "Borçlu", "Alacaklı", "İcra Dairesi", "Telefon", "Kayıt Tarihi", "Borç Tutarı"];
const ROWS = [
  ["2026/1234", "Ayşe Kaya", "Selçuklu Yapı Market Ltd. Şti.", "Konya 6. İcra Dairesi", "0532 601 10 10", "15.01.2026", "48.500,00"],
  ["2026/1310", "Hasan Öztürk", "Meram Ofis Kırtasiye", "Konya 2. İcra Dairesi", "0533 100 00 01", "03.02.2026", "12.750,00"],
];
writeFileSync(excel, buildXlsx([{ name: "İcra Dosyaları", columns: COLS, rows: ROWS.map(r => Object.fromEntries(COLS.map((c, i) => [c, r[i]]))) }], { title: "İcra Dosyaları" }));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f95" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-bar{display:none !important}" }))));
const page = await context.newPage();
page.on("pageerror", e => errors.push(`pageerror ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${m.location().url} ${m.text()}`)) errors.push(m.text()); });
page.on("dialog", d => d.accept());
const modal = ".hof-modal-backdrop.is-visible";
const inv = `${modal} .hof-invoices-modal`;
let shotNo = 0;
const shot = async name => page.screenshot({ path: path.join(OUT, `${String(++shotNo).padStart(2, "0")}-${name}.png`) });
const call = (url, body, method = body ? "POST" : "GET") => page.evaluate(async ([url, body, method]) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, ...j }; }, [url, body, method]);
const closeAll = async () => { for (let i = 0; i < 8 && (await page.$(modal)); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); } };
const pad = v => String(v).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = iso(new Date());
const overflow = sel => page.$eval(sel, el => ({ sw: el.scrollWidth, cw: el.clientWidth, body: document.documentElement.scrollWidth, win: window.innerWidth }));
const ids = {};
try {
  // Giriş + Excel (icra dosyaları)
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
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  const rowKey = await page.$eval(".dynamic-table tbody tr", tr => tr.dataset.hofKey || "");
  // Veri (API)
  await call("/api/workspace/invoices/settings", { seller: { name: "Av. Mehmet Demir Hukuk Bürosu", taxOffice: "Selçuklu", address: "Nalçacı Cd. No: 12/3", city: "Konya" } }, "PUT");
  await call("/api/workspace/cash", { kind: "in", amount: "20000", method: "cash", description: "Açılış", date: TODAY });
  const ayse = await call("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", taxNo: "10000000146", address: "Yazır Mh. 1234 Sk. No: 7", city: "Konya", phone: "0532 601 10 10", caseKey: rowKey, caseTitle: "Konya 6. İcra 2026/1234 — Ayşe Kaya" });
  ids.ayse = ayse.data?.id;
  // Cari formu kaydedince istemci "accounts-changed" yayar (sunucu olayı kendi kullanıcısına gitmez: except=user.id); aynı akış.
  await page.evaluate(() => window.HOF.emit("accounts-changed"));
  ids.kagit = (await call("/api/workspace/stock", { name: "A4 Fotokopi Kağıdı", code: "KRT-A4", unit: "Paket", unitPrice: 120, salePrice: 185, minQty: 20 })).data?.id;
  ids.supplier = (await call("/api/workspace/accounts", { name: "Selçuklu Yapı Market Ltd. Şti.", type: "supplier", city: "Konya" })).data?.id;
  await call("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.supplier, number: "SYM-1", lines: [{ itemId: ids.kagit, qty: 200, unitPrice: 120, vatRate: 20 }], payment: { rest: "open" } });

  await T("U7", "2 Entegrasyon", "Fatura → İcra dosyası (arayüz): dosya kaydı → cari → fatura → dosya detayından cari kartı ve faturalar", "Excel'deki 2026/1234 kaydına bağlı cari aç; fatura kes; kaydı tıkla; detay panelinden Cari Kartı; Faturalar bölümü", "Bağlı cari dosya kaydıyla açılır; detay panelinde Cari Kartı; kartta fatura listelenir", async () => {
    if (!ids.ayse) return { ok: false, severity: "High", actual: `Cari dosyaya bağlanamadı: ${ayse.error} (anahtar "${rowKey}")` };
    const sale = await call("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.ayse, lines: [{ itemId: ids.kagit, qty: 10, unitPrice: 185, vatRate: 20 }], payment: { cash: [{ amount: 1000, method: "cash" }], rest: "installments", installments: { count: 3, firstDue: TODAY } }, note: "Konya 6. İcra 2026/1234" });
    ids.sale = sale.data?.id;
    await page.click(".dynamic-table tbody tr");
    let btn = await page.waitForSelector('.hof-case-account [data-open-account]', { timeout: 5000 }).catch(() => null);
    let staleNote = "";
    if (!btn) {
      // Kayıt sayfa açılırken zaten seçiliyse: başka kayda geçip geri dön (kullanıcı akışı).
      await page.click(".dynamic-table tbody tr:nth-child(2)");
      await page.waitForTimeout(600);
      await page.click(".dynamic-table tbody tr:nth-child(1)");
      btn = await page.waitForSelector('.hof-case-account [data-open-account]', { timeout: 8000 }).catch(() => null);
      staleNote = btn ? " BULGU: kayıt seçiliyken cari ona bağlanınca detay paneli kendiliğinden yenilenmedi; başka kayda geçip dönünce çıktı (canlı yenileme eksik)." : "";
    }
    if (!btn) {
      const acc = await call(`/api/workspace/accounts/${ids.ayse}`);
      const sel = await page.evaluate(() => window.HOF.selectedCase?.());
      const direct = await call(`/api/workspace/cases/${encodeURIComponent(sel?.key || "")}/account`);
      const box = await page.evaluate(() => { const b = document.querySelector("[data-case-key], #hof-case-plan, .hof-case-plan"); return b ? { hidden: b.hidden, html: b.innerHTML.slice(0, 200), cls: b.className, id: b.id } : null; });
      console.log("TANI uç:", JSON.stringify(direct).slice(0, 300), "\nTANI kutu:", JSON.stringify(box));
      await shot("dosya-detay-cari-yok");
      return { ok: false, severity: "High", actual: `Detay panelinde Cari Kartı düğmesi çıkmadı. Cari caseKey="${acc.data?.caseKey}" caseSource="${acc.data?.caseSource}"; seçili kayıt key="${sel?.key}" source="${sel?.source || sel?.datasetKey || ""}"` };
    }
    await btn.click();
    await page.waitForSelector(`${modal} [data-acc-invoices] table`, { timeout: 10000 });
    const rows = await page.$$(`${modal} [data-acc-invoices] tr[data-open-invoice]`);
    const facts = await page.textContent(`${modal} .hof-modal`);
    await shot("dosya-cari-karti-faturalar");
    await closeAll();
    return { ok: false, status: rows.length >= 1 && /2026\/1234|Konya 6/.test(facts) ? "PARTIAL" : "FAIL", severity: "Medium", actual: `Kayıt → Cari Kartı açıldı; kartta ${rows.length} fatura ve dosya bilgisi görünüyor=${/2026\/1234|Konya 6/.test(facts)}.${staleNote} Dosya detay panelinde fatura listesi/tutarı yok; faturada dosya alanı yok; dosyadan doğrudan fatura kesme yok (cari kartından)` };
  });

  await T("U1", "4 UX", "Duyarlı tasarım: 390×844 (telefon), 820×1180 (tablet), 1440×900", "Fatura listesi ve formu her genişlikte aç; yatay taşma", "Yatay kaydırma yok; düğmeler erişilebilir", async () => {
    const out = [];
    for (const [w, h] of [[390, 844], [820, 1180], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
      await page.waitForSelector(`${inv} .hof-inv-tabs`);
      await page.waitForTimeout(500);
      const list = await overflow(`${inv}`);
      await shot(`liste-${w}`);
      await page.click(`${inv} [data-act="new"]`);
      await page.click(`${inv} [data-scenario="goods_sale"]`);
      await page.waitForSelector(`${inv} [data-lines]`);
      await page.waitForTimeout(400);
      const form = await overflow(`${inv}`);
      await shot(`form-${w}`);
      out.push({ w, list: list.sw - list.cw, form: form.sw - form.cw, body: list.body - list.win });
      await closeAll();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const bad = out.filter(o => o.list > 4 || o.form > 4 || o.body > 4);
    return { ok: bad.length === 0, status: bad.length ? (bad.every(o => o.w === 390) ? "PARTIAL" : "FAIL") : "PASS", severity: "Medium", actual: out.map(o => `${o.w}px: liste taşma ${o.list}px, form taşma ${o.form}px, sayfa ${o.body}px`).join(" | ") };
  });

  await T("U2", "4 UX", "Klavye: ürün adı yazınca öneri listesi; Enter ile seçim; birim fiyatta Enter → yeni satır; Esc listeyi kapatır", "Formda kalem adına 'A4' yaz → öneri; Enter; miktar; birim fiyatta Enter", "Öneri listesi açılır; Enter seçer; Enter ile sonraki satır açılır ve odaklanır", async () => {
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-scenario="goods_sale"]`);
    await page.waitForSelector(`${inv} [data-lines]`);
    await page.click(`${inv} [data-l="0"][data-f="name"]`);
    await page.keyboard.type("A4");
    await page.waitForSelector(`${inv} [data-hits="0"] li[data-item]`, { timeout: 5000 });
    const hits = await page.$$(`${inv} [data-hits="0"] li[data-item]`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const name = await page.inputValue(`${inv} [data-l="0"][data-f="name"]`);
    const price = await page.inputValue(`${inv} [data-l="0"][data-f="unitPrice"]`);
    await page.click(`${inv} [data-l="0"][data-f="unitPrice"]`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const second = await page.$(`${inv} [data-l="1"][data-f="name"]`);
    const focused = await page.evaluate(() => document.activeElement?.dataset?.l + "/" + document.activeElement?.dataset?.f);
    await page.click(`${inv} [data-l="1"][data-f="name"]`);
    await page.keyboard.type("Kağ");
    await page.waitForSelector(`${inv} [data-hits="1"] li[data-item]`, { timeout: 5000 }).catch(() => null);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const listOpen = await page.$eval(`${inv} [data-hits="1"]`, el => !el.hidden && el.children.length > 0).catch(() => false);
    await shot("klavye-form");
    return { ok: hits.length >= 1 && name.includes("A4") && Number(price) === 185 && Boolean(second) && focused === "1/name" && !listOpen, status: hits.length >= 1 && name.includes("A4") && second ? (focused === "1/name" && !listOpen ? "PASS" : "PARTIAL") : "FAIL", severity: "Low", actual: `öneri ${hits.length}; Enter → "${name}" fiyat ${price}; birim fiyatta Enter → 2. satır var=${Boolean(second)} odak=${focused}; Esc sonrası liste açık=${listOpen}. Genel kısayol (Ctrl+N, Ctrl+S gibi) yok` };
  });

  await T("U3", "4 UX", "Hata mesajları: anlaşılır ve Türkçe; zorunlu alanlar", "Cari seçmeden kes; kalem olmadan kes; ileri tarih; sunucu hatası ekranda", "Türkçe, ne yapılacağını söyleyen mesaj; alan odaklanır", async () => {
    await closeAll();
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-scenario="service_sale"]`);
    await page.waitForSelector(`${inv} [data-lines]`);
    await page.click(`${inv} [data-act="issue"]`);
    await page.waitForTimeout(300);
    const noAccount = (await page.textContent(`${inv} [data-form-error]`)).trim();
    await page.fill(`${inv} [data-acc-query]`, "Ayşe");
    await page.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
    await page.dispatchEvent(`${inv} .hof-acc-picker li[data-id]`, "mousedown");
    await page.click(`${inv} [data-act="issue"]`);
    await page.waitForTimeout(300);
    const noLines = (await page.textContent(`${inv} [data-form-error]`)).trim();
    await page.fill(`${inv} [data-l="0"][data-f="name"]`, "Dilekçe");
    await page.fill(`${inv} [data-l="0"][data-f="qty"]`, "1");
    await page.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, "500");
    const future = iso(new Date(Date.now() + 3 * 86_400_000));
    await page.fill(`${inv} [data-f="issueDate"]`, future);
    await page.waitForTimeout(900);
    await page.click(`${inv} [data-act="issue"]`);
    await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 5000 }).catch(() => null);
    if (await page.$(`${modal} [data-answer="yes"]`)) await page.click(`${modal} [data-answer="yes"]`);
    await page.waitForTimeout(900);
    const serverError = (await page.textContent(`${inv} [data-form-error]`)).trim();
    await shot("hata-mesajlari");
    const tr = t => /[çğışöüÇĞİŞÖÜ]/.test(t) && t.length > 10;
    return { ok: tr(noAccount) && tr(noLines) && /İleri tarihli|ileri/i.test(serverError), actual: `cari yok: "${noAccount}" · kalem yok: "${noLines}" · ileri tarih: "${serverError.slice(0, 90)}"` };
  });

  await T("U5", "4 UX", "Onay diyalogları: kesme, iptal, taslak silme, büyük tutar", "Faturayı Kes → onay; İptal Et → neden formu; Taslağı Sil → onay", "Her biri onay ister; kesme onayında tutar ve numara yazar", async () => {
    await page.fill(`${inv} [data-f="issueDate"]`, TODAY);
    await page.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, "250000");
    await page.waitForTimeout(900);
    await page.click(`${inv} [data-act="issue"]`);
    await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 5000 });
    const confirmText = (await page.textContent(`${modal} .hof-modal:has([data-answer="yes"])`)).replace(/\s+/g, " ");
    await shot("onay-kesme");
    await page.click(`${modal} [data-answer="yes"]`);
    await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 10000 });
    await page.click(`${inv} [data-act="cancel"]`);
    await page.waitForSelector(`${modal} form [name="reason"]`, { timeout: 5000 });
    const cancelIntro = (await page.textContent(`${modal} .hof-modal:has([name="reason"])`)).replace(/\s+/g, " ");
    await shot("onay-iptal");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const draft = await call("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.ayse, status: "draft", lines: [{ name: "Taslak", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
    await page.evaluate(id => window.HOF.invoices.openDoc(id), draft.data.id);
    await page.waitForSelector(`${inv} [data-act="delete"]`, { timeout: 10000 });
    await page.click(`${inv} [data-act="delete"]`);
    const delConfirm = await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 5000 }).catch(() => null);
    await shot("onay-taslak-sil");
    if (delConfirm) await page.click(`${modal} [data-answer="no"], ${modal} [data-answer="cancel"]`).catch(() => page.keyboard.press("Escape"));
    const bigAmountWarn = /300\.000|büyük tutar/i.test(confirmText);
    return { ok: /FIS2026\d{9}/.test(confirmText) && /300\.000,00/.test(confirmText) && /geri alınır|iptal/i.test(cancelIntro) && Boolean(delConfirm), status: /FIS2026\d{9}/.test(confirmText) && Boolean(delConfirm) ? (bigAmountWarn ? "PASS" : "PARTIAL") : "FAIL", severity: "Low", actual: `kesme onayı: "${confirmText.slice(0, 140)}"; iptal: neden formu (${/geri alınır/.test(cancelIntro) ? "etkiler geri alınır uyarısı var" : "uyarı yok"}); taslak sil onayı=${Boolean(delConfirm)}; büyük tutara özel ek uyarı yok (tutar onay metninde yazıyor)` };
  });

  await T("U6", "4 UX", "Performans: 1.000+ belge listesi ve 60 kalemli fatura", "API ile 1.050 fatura kes; liste API ve ekran süresi; 60 kalemli kartı aç", "Liste < 2 sn (API) ve < 3 sn (ekran); 60 kalem kart < 1,5 sn", async () => {
    await closeAll();
    const t0 = performance.now();
    const made = await page.evaluate(async ({ accountId, n }) => {
      let okCount = 0;
      for (let b = 0; b < n; b += 50) {
        const batch = Array.from({ length: Math.min(50, n - b) }, (_, i) => fetch("/api/workspace/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario: "service_sale", accountId, lines: [{ name: `Hizmet ${b + i}`, qty: 1, unitPrice: 100 + ((b + i) % 400), vatRate: 20 }], payment: { rest: "open" } }) }).then(r => r.status));
        okCount += (await Promise.all(batch)).filter(s => s === 200).length;
      }
      return okCount;
    }, { accountId: ids.ayse, n: 1050 });
    const tMade = performance.now() - t0;
    const big = await call("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.ayse, lines: Array.from({ length: 60 }, (_, i) => ({ name: `Kalem ${i + 1}`, qty: 1, unitPrice: 10 + i, vatRate: 20 })), payment: { rest: "open" } });
    const a0 = performance.now();
    const list = await call("/api/workspace/invoices?tab=all&limit=200");
    const tApi = performance.now() - a0;
    const u0 = performance.now();
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} tr[data-inv]`, { timeout: 20000 });
    const tUi = performance.now() - u0;
    await shot("liste-1000");
    const c0 = performance.now();
    await page.evaluate(id => window.HOF.invoices.openDoc(id), big.data.id);
    await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 20000 });
    await page.waitForFunction(sel => document.querySelectorAll(`${sel} tbody tr`).length >= 60, inv, { timeout: 20000 });
    const tCard = performance.now() - c0;
    await shot("kart-60-kalem");
    await closeAll();
    return { ok: made >= 1000 && tApi < 2000 && tUi < 3000 && tCard < 1500, actual: `${made} belge ${(tMade / 1000).toFixed(1)} sn'de kesildi (${(tMade / made).toFixed(0)} ms/belge); liste API ${tApi.toFixed(0)} ms (toplam ${list.data?.total}); ekran ${tUi.toFixed(0)} ms; 60 kalemli kart ${tCard.toFixed(0)} ms` };
  });
} catch (error) {
  console.error("HATA:", error.message);
  await shot("hata").catch(() => {});
}
if (errors.length) console.log("Tarayıcı hataları:", errors);
R.push({ id: "U9", section: "4 UX", name: "Tarayıcı konsol/çalışma hatası", steps: "Tüm adımlar boyunca", expected: "Hata yok", actual: errors.length ? errors.join(" | ").slice(0, 300) : "Hiç hata yok", status: errors.length ? "FAIL" : "PASS", severity: errors.length ? "High" : "", bug: "" });
fs.writeFileSync(path.join(HERE, "artifacts", "sonuc-ui.json"), JSON.stringify({ results: R }, null, 2));
await browser.close();
await app.close();
rmSync(root, { recursive: true, force: true });
