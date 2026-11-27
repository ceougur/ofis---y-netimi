// 2.5.1 M1 küçük tur EKRANDAN — Raporlar → Tüm Raporlar → KDV Özeti: S-DKM1-1 = A (mahsup fişi kesilmiş ayın İndirilecek KDV'si sonradan AZALIRSA ayın sonucu kesilmiş fişten,
// azalma sonraki mahsupta düşülür; o aya not), not kartları (tutar olmayan özet satırı tam genişlikte, normal yazıyla) ve dar pencerede tablo altının BÜTÜN satırları görünür
// (baş mimarın ekran yürüyüşü: satırlar üst üste biniyordu). Gerçek tıklama + klavye (ders 12); sahte saat (sunucu ve sayfa, 15.04.2026 — ders 13); lisans servisi yok
// (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39). Veri programın API'sinden. Ekran görüntüleri deviceScaleFactor 1.
//   KÂHİN (elle; kararın örneği): Ocak satış KDV 1.000, alış KDV 500 → Ocak mahsubu 500; Ocak alışı İptal Et; Şubat satış KDV 200 → Şubat mahsubu 700; Mart satış KDV 400 →
//   Mart mahsubu 400. Ocak–Mart: Önceki 0 · Ödenecek 1.600 · Sonraki 0; ay satırları Ocak 500 / Şubat 700 / Mart 400 (taban: Ocak 1.000, toplam 2.100); "Mahsuptan Sonra
//   Değişen Ay: Ocak 2026 (bu ayın kayıtları fişten sonra değişti; …)".
// Çıkış: "N geçti, M kaldı". Ekran görüntüleri EKRAN_DIR'e.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-04-15T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kdv-mahsup-sonrasi-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f53" } });
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
const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı Kırtasiye", type: "supplier", registeredOn: "2026-01-01" }))).id;
const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", registeredOn: "2026-01-01" }))).id;
const sale = (date, net) => must(`satış ${date}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }));
await sale("2026-01-05", 5000);
const janBuy = (await must("Ocak alış", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: "2026-01-10", number: "TK-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 2500, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id;
await must("Ocak mahsubu", api.post("/api/workspace/tax/vat-offset", { month: "2026-01" }));
await must("Ocak alışı İptal Et", api.post(`/api/workspace/invoices/${janBuy}/cancel`, { reason: "Hatalı fatura", force: true }));
await sale("2026-02-10", 1000);
await must("Şubat mahsubu", api.post("/api/workspace/tax/vat-offset", { month: "2026-02" }));
await sale("2026-03-10", 2000);
await must("Mart mahsubu", api.post("/api/workspace/tax/vat-offset", { month: "2026-03" }));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, locale: "tr-TR" });
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
const shot = name => page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, `${name}.png`) }).catch(() => null);
const digits = text => String(text || "").replace(/[^\d,]/g, "");
const RESULTS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const ready = () =>
  page.waitForFunction(
    sel => {
      const main = document.querySelector(`${sel} [data-rc-main]`);
      return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table, .hof-rc-summary, .hof-empty") && !/Rapor hazırlanıyor|Güncelleniyor…/.test(main.querySelector("[data-rc-busy]:not([hidden])")?.textContent || "") && !/Rapor hazırlanıyor/.test(main.innerText);
    },
    MODAL,
    { timeout: 15000 },
  );
const summaryOf = () => page.evaluate(sel => Object.fromEntries([...document.querySelectorAll(`${sel} [data-rc-main] .hof-rc-summary span`)].map(span => [span.querySelector("small").textContent.trim(), span.querySelector("b").textContent.trim()])), MODAL);
const cells = selector => page.$$eval(selector, rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent.trim())));
const table = async () => ({ body: await cells(`${MODAL} [data-rc-main] .hof-rc-table tbody tr`), foot: await cells(`${MODAL} [data-rc-main] .hof-rc-table tfoot tr`) });
const results = (summary, foot) => ({ summary: RESULTS.map(label => digits(summary[label])), foot: RESULTS.map(label => digits(foot.find(row => row[1] === label)?.[5])) });
async function range(from, to) {
  await page.fill(`${MODAL} [data-rc-main] [data-param="from"]`, from);
  await page.fill(`${MODAL} [data-rc-main] [data-param="to"]`, to);
  await page.focus(`${MODAL} [data-rc-main] [data-rc-run]`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await ready();
}
/** Tablo altı: her satır kutunun görünen alanında mı, satırlar üst üste biniyor mu (kutu en üste kaydırılmışken — kullanıcının ilk gördüğü). */
const footLayout = () =>
  page.evaluate(sel => {
    const box = document.querySelector(`${sel} [data-rc-main] .hof-rc-table`);
    box.scrollTop = 0;
    box.scrollIntoView({ block: "end" });
    const frame = box.getBoundingClientRect();
    // Hücrenin kutusu (satırın değil): eski düzende hücreler tek tek yapışkandı — satır yerinde dururken hücreler üst üste biniyordu.
    const rows = [...box.querySelectorAll("tfoot tr")].map(row => {
      const r = row.querySelector("td:nth-child(2)").getBoundingClientRect();
      return { text: row.querySelector("td:nth-child(2)")?.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    });
    const overlap = rows.slice(1).filter((row, index) => row.top < rows[index].bottom - 1).map(row => row.text);
    const hidden = rows.filter(row => row.top < frame.top - 1 || row.bottom > frame.bottom + 1).map(row => row.text);
    return { rows: rows.length, overlap, hidden, boxHeight: Math.round(frame.height), footHeight: Math.round(box.querySelector("tfoot")?.getBoundingClientRect().height || 0), overflow: box.scrollHeight > box.clientHeight + 1, free: box.classList.contains("is-foot-free") };
  }, MODAL);

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  console.log("A) Raporlar → Tüm Raporlar → KDV Özeti → 01.01.2026 – 31.03.2026 (Ocak'ın alışı mahsuptan sonra iptal)");
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`);
  await page.click(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`);
  await ready();
  await range("2026-01-01", "2026-03-31");
  let summary = await summaryOf();
  let t = await table();
  let r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["0,00", "1600,00", "0,00"]), `Ocak–Mart özet kartları 0 / 1.600 / 0 (taban 2.100) (${JSON.stringify(summary)})`);
  ok(JSON.stringify(r.foot) === JSON.stringify(r.summary), `tablo altı = özet (${JSON.stringify(t.foot)})`);
  const monthLines = t.body.filter(item => RESULTS.includes(item[1])).map(item => [item[0], item[1], digits(item[5])]);
  ok(JSON.stringify(monthLines) === JSON.stringify([["Ocak 2026", "Ödenecek KDV", "500,00"], ["Şubat 2026", "Ödenecek KDV", "700,00"], ["Mart 2026", "Ödenecek KDV", "400,00"]]), `ay satırları Ocak 500 / Şubat 700 / Mart 400 (${JSON.stringify(monthLines)})`);
  ok(/^Ocak 2026 \(bu ayın kayıtları fişten sonra değişti; ayın sonucu kesilmiş mahsup fişinden, İndirilecek KDV'deki azalma sonraki mahsupta düşülür\)$/.test(summary["Mahsuptan Sonra Değişen Ay"] || ""), `Ocak notu: ${summary["Mahsuptan Sonra Değişen Ay"]}`);
  // Not kartı: tam genişlik, normal ağırlıkta okunur yazı (tutar kartı kalın kalır).
  const cardsLook = await page.evaluate(sel => {
    const box = document.querySelector(`${sel} [data-rc-main] .hof-rc-result`);
    const spans = [...box.querySelectorAll(".hof-rc-summary span")];
    const look = span => {
      const b = span.querySelector("b");
      const style = getComputedStyle(b);
      return { label: span.querySelector("small").textContent.trim(), note: span.classList.contains("is-note"), weight: Number(style.fontWeight), size: parseFloat(style.fontSize), width: Math.round(span.getBoundingClientRect().width) };
    };
    return { width: Math.round(box.getBoundingClientRect().width), cards: spans.map(look) };
  }, MODAL);
  const note = cardsLook.cards.find(card => card.label === "Mahsuptan Sonra Değişen Ay");
  const money = cardsLook.cards.find(card => card.label === "Ödenecek KDV");
  ok(note && note.note && note.weight <= 500 && note.size >= 12 && note.size <= 14 && note.width >= cardsLook.width - 2, `not kartı tam genişlik, normal yazı (${JSON.stringify(note)} · kutu ${cardsLook.width})`);
  ok(money && !money.note && money.weight >= 700, `tutar kartı kalın kalır (${JSON.stringify(money)})`);
  await shot("m1k-kdv-ozeti-ocak-mart-genis");

  console.log("B) Dar pencere (1280 × 620): tablo altının bütün satırları görünür, üst üste binmez");
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.waitForTimeout(600);
  let layout = await footLayout();
  ok(layout.rows >= 4 && layout.overlap.length === 0, `tablo altı satırları üst üste binmiyor (${JSON.stringify(layout)})`);
  ok(layout.hidden.length === 0 || layout.free, `tablo altı ya kutunun görünen alanında ya da (kutunun yarısından yüksekse) tablonun sonunda (${JSON.stringify(layout)})`);
  await shot("m1k-kdv-ozeti-ocak-mart-dar");
  await range("2026-01-01", "2026-01-31");
  summary = await summaryOf();
  t = await table();
  r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["0,00", "500,00", "0,00"]) && JSON.stringify(r.foot) === JSON.stringify(r.summary), `Ocak 0 / 500 / 0 (fişten; taban 1.000) (${JSON.stringify(r)})`);
  layout = await footLayout();
  ok(layout.overlap.length === 0 && (layout.hidden.length === 0 || layout.free), `Ocak (dar): tablo altı okunur (${JSON.stringify(layout)})`);
  await shot("m1k-kdv-ozeti-ocak-dar");
  await page.setViewportSize({ width: 1024, height: 560 });
  await page.waitForTimeout(600);
  await page.click(`${MODAL} [data-rc-main] .hof-rc-range [data-preset="thisYear"]`);
  await page.waitForTimeout(400);
  await ready();
  summary = await summaryOf();
  t = await table();
  r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["0,00", "1600,00", "0,00"]) && JSON.stringify(r.foot) === JSON.stringify(r.summary), `Bu Yıl (1024 × 560) 0 / 1.600 / 0 (${JSON.stringify(r)})`);
  layout = await footLayout();
  ok(layout.overlap.length === 0 && (layout.hidden.length === 0 || layout.free), `Bu Yıl (1024 × 560): TOPLAM ve Önceki Dönemden Devreden dahil bütün satırlar okunur (${JSON.stringify(layout)})`);
  await shot("m1k-kdv-ozeti-bu-yil-dar");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "m1k-kdv-mahsup-sonrasi-hata.png"), fullPage: true }).catch(() => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-kdv-mahsup-sonrasi-251: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
