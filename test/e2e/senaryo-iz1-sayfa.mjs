// Senaryo İz 1.2 (2.2.0 iş listesi; 11.10.2026 ek bulgu), arayüzden, gerçek tıklamayla:
//   Aynı kullanıcının iki penceresi aynı sayfada (X) açık. A penceresinde "+ Sayfa → Excel'den Aktar" ile dosya seçilir, karar penceresinde
//   sayfa adı yazılıp "Yeni Sayfada Aç"a basılır; A yeni sayfaya (Y) geçer.
//   Beklenen (B penceresi): yeniden YÜKLENMEZ, "sayfa silindi" DEMEZ, şeritte iki sayfa görünür ve kendi sayfası (X) seçili kalır; tablosu,
//   sayfa listesi, eşitlemesi ve B'de girilen yeni kayıt X'tedir (Y'ye gitmez). Önceden B "Çalıştığınız sayfa veri yöneticisi tarafından
//   silindi; … sayfasına geçildi" deyip Y'yi açıyordu.
//   Gerileme: sayfa GERÇEKTEN silinince (A'dan Sayfayı Sil) o sayfayı gösteren pencere yine "silindi" der ve kalan sayfaya geçer.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-iz1-sayfa.mjs
import fs, { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-iz1-sayfa");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-iz1-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f26" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
// Ekrandaki bildirimler (yeniden yüklemeden sonraki "hof-flash" dahil) her pencerede window.__toasts'a; her yükleme window.__loads'a (oturum
// deposunda sayılır: yeniden yükleme sayacı sıfırlanmaz).
await context.addInitScript(() => {
  window.__toasts = [];
  try {
    sessionStorage.setItem("__loads", String(Number(sessionStorage.getItem("__loads") || 0) + 1));
  } catch {
    // depolama kapalı
  }
  new MutationObserver(list => {
    for (const entry of list) for (const node of entry.addedNodes) if (node.nodeType === 1 && node.classList?.contains("hof-toast")) window.__toasts.push(node.textContent);
  }).observe(document, { childList: true, subtree: true });
});
const errors = [];
const watch = (page, name) => {
  page.on("pageerror", error => errors.push(`${name} pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${name} ${message.text()} @ ${message.location().url}`);
  });
};

let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async (page, name) => {
  shotNo += 1;
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
// Sayfanın kendi fetch'iyle (HOF.apiUrl: ?hofCompany= ve ?hofPage= eklenir) — pencerenin gerçek isteği.
const api = (page, url, body, method) =>
  page.evaluate(
    async ({ url, body, method }) => {
      const response = await fetch(url, { method: method || (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, data: json.ok ? json.data : json };
    },
    { url, body, method },
  );
const rowsOf = page => page.evaluate(async () => {
  const response = await fetch(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`);
  const json = await response.json();
  return (json.result?.data?.json ?? json.result?.data).rows;
});
const modal = ".hof-modal-backdrop.is-visible";
const currentPill = page => page.$eval("#hof-pages .hof-page.is-current .hof-page-pick", node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const pillCount = page => page.$$eval("#hof-pages .hof-page", nodes => nodes.length).catch(() => 0);
const loads = page => page.evaluate(() => Number(sessionStorage.getItem("__loads") || 0));
// Yeni sayfadan sonra açılan "Akıllı Analiz — Veriniz hazır" penceresi (sessionStorage "hof-analyze") insan gibi kapatılır: Tamam / Mevcut
// Görünümü Koru / Genel ile Devam Et (sektör uygulanmaz); başka pencere Escape ile.
const closeModals = async page => {
  await page.waitForSelector(modal, { timeout: 6000 }).catch(() => {});
  for (let i = 0; i < 5 && (await page.$(modal)); i += 1) {
    const button = (await page.$(`${modal} [data-done]`)) || (await page.$(`${modal} [data-keep]`)) || (await page.$(`${modal} [data-general]`));
    if (button) await button.click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
};
const ready = async page => {
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
  await page.waitForTimeout(800);
};

try {
  console.log("\n■ Kurulum: yönetici girer; ilk sayfa “Rehber.xlsx” (5 kayıt); aynı hesapla iki pencere (A ve B) aynı sayfada");
  const b = await context.newPage();
  watch(b, "B");
  await b.goto(`${BASE}/`);
  await b.fill("#hof-auth input[name=username]", "admin");
  await b.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([b.waitForEvent("load"), b.click('#hof-auth button[type="submit"]')]);
  await b.waitForTimeout(1500);
  const rehber = [["Öğrenci No", "Adı", "Soyadı", "Telefonu"]];
  for (let i = 0; i < 5; i += 1) rehber.push([String(22821911000 + i), ["Mehmet", "İrem", "Cihat", "Rahman", "Ayla"][i], ["Türkoğlu", "Eroğlu", "Şenyurt", "Koyuncu", "Demir"][i], `0532${String(1000000 + i)}`]);
  const first = await api(b, "/api/workspace/dataset/stage", { kind: "excel", fileName: "Rehber.xlsx", sheets: [{ name: "REHBER", matrix: rehber }] });
  ok((await api(b, "/api/workspace/dataset/commit", { stageId: first.data.stageId, mode: "replace" })).status === 200, "ilk sayfa yüklendi");
  await b.waitForTimeout(1500);
  await b.goto(`${BASE}/`, { waitUntil: "load" });
  await ready(b);
  const a = await context.newPage();
  watch(a, "A");
  await a.goto(`${BASE}/`, { waitUntil: "load" });
  await ready(a);
  const x = await b.evaluate(() => window.HOF.datasetKey);
  ok(Boolean(x) && x === (await a.evaluate(() => window.HOF.datasetKey)), `iki pencere aynı sayfada (${x})`);
  ok(/Rehber/.test(await currentPill(b)) && (await pillCount(b)) === 1, `B'nin şeridi: ${await currentPill(b)} (1 sayfa)`);
  const bLoads = await loads(b);
  await b.evaluate(() => {
    window.__toasts = [];
  });

  console.log("\n■ A penceresinde + Sayfa → Excel'den Aktar → dosya → sayfa adı → Yeni Sayfada Aç (gerçek tıklama)");
  const taksit = [["Müşteri No", "Müşteri", "Tutar", "Son Ödeme"], ["M-1", "Ali Veli", "20.000,00", "15.11.2026"], ["M-2", "Ayşe Kara", "12.000,00", "20.11.2026"], ["M-3", "Can Er", "9.000,00", "25.11.2026"]];
  const file = path.join(root, "Taksitler.xlsx");
  writeFileSync(file, buildXlsx([{ name: "Taksitler", columns: taksit[0], rows: taksit.slice(1).map(row => Object.fromEntries(taksit[0].map((head, i) => [head, row[i]]))) }]));
  await a.bringToFront();
  await a.click("#hof-pages [data-add]");
  await a.waitForSelector("#hof-pages .hof-pages-menu:not([hidden])");
  await a.click('#hof-pages [data-add-source="excel"]');
  await a.waitForSelector(`${modal} .hof-drop input[type=file]`, { state: "attached" });
  await shot(a, "a-excelden-yeni-sayfa");
  await a.setInputFiles(`${modal} .hof-drop input[type=file]`, file);
  await a.waitForSelector(`${modal} [data-mode="session"]`, { timeout: 30000 });
  await a.fill(`${modal} [data-session-name]`, "Taksit Takibi");
  await shot(a, "a-karar-penceresi");
  await Promise.all([a.waitForEvent("load", { timeout: 30000 }), a.click(`${modal} [data-mode="session"]`)]);
  await ready(a);
  const y = await a.evaluate(() => window.HOF.datasetKey);
  ok(Boolean(y) && y !== x && /Taksit Takibi/.test(await currentPill(a)), `A yeni sayfada: ${await currentPill(a)}`);
  await shot(a, "a-yeni-sayfada");

  console.log("\n■ B penceresi: yeniden yüklenmez, 'silindi' demez, yeni sayfayı şeride ekler, kendi sayfasında kalır");
  await b.bringToFront();
  await b.waitForFunction(() => document.querySelectorAll("#hof-pages .hof-page").length === 2, null, { timeout: 15000 }).catch(() => {});
  await b.waitForTimeout(2500);
  const toasts = await b.evaluate(() => window.__toasts.join(" | "));
  ok((await loads(b)) === bLoads, `B yeniden yüklenmedi (yükleme sayısı ${bLoads} → ${await loads(b)})`);
  ok(!/silindi/i.test(toasts), `B'de 'silindi' bildirimi yok (“${toasts}”)`);
  ok((await pillCount(b)) === 2, `B'nin şeridinde iki sayfa (${await pillCount(b)})`);
  ok(/Rehber/.test(await currentPill(b)), `B'de seçili sayfa yine Rehber (“${await currentPill(b)}”)`);
  ok((await b.evaluate(() => window.HOF.datasetKey)) === x, "B'nin sayfa anahtarı X");
  const pills = await b.$$eval("#hof-pages .hof-page-pick b", nodes => nodes.map(node => node.textContent.trim()));
  ok(pills.includes("Taksit Takibi"), `yeni sayfa B'nin şeridinde: ${pills.join(" · ")}`);
  await shot(b, "b-iki-sayfa-kendi-sayfasinda");
  const bRows = await rowsOf(b);
  ok(bRows.length === 5 && bRows.every(row => "Öğrenci No" in row), `B'nin tablosu X'in satırları (${bRows.length})`);
  const tableText = await b.$eval(".dynamic-table tbody", node => node.textContent).catch(() => "");
  ok(/Türkoğlu/.test(tableText) && !/Ali Veli/.test(tableText), "B'nin ekrandaki tablosu Rehber'in kayıtları");
  ok((await api(b, "/api/workspace/sessions")).data.current === x, "B'nin sayfa listesi isteği: current X");
  ok((await api(b, "/api/workspace/client-state")).data.datasetKey === x, "B'nin eşitlemesi (istemci durumu) X");
  const created = await api(b, "/api/workspace/records", { values: { "Öğrenci No": "22821919999", Adı: "Deniz", Soyadı: "Yeni", Telefonu: "05320000000" }, caseKey: "22821919999" });
  ok(created.status === 200 && created.data.sourceName === x, `B'de girilen yeni kayıt X'e yazıldı (${created.data.sourceName})`);
  const aRows = await rowsOf(a);
  ok(aRows.length === 3 && !aRows.some(row => row["Öğrenci No"] === "22821919999"), `A'nın tablosu Y'nin satırları; B'nin kaydı orada yok (${aRows.length})`);

  console.log("\n■ Gerileme: A, Y'yi şeritten siler → A kendi silmesini söyler; Y'yi gösteren başka pencere (C) 'silindi' der ve X'e geçer; B etkilenmez");
  const c = await context.newPage();
  watch(c, "C");
  await c.goto(`${BASE}/`, { waitUntil: "load" });
  await ready(c);
  ok((await c.evaluate(() => window.HOF.datasetKey)) === y, "yeni açılan pencere (C) kullanıcının son seçimi Y'de");
  const bLoads2 = await loads(b);
  await a.bringToFront();
  await closeModals(a);
  await a.click("#hof-pages .hof-page.is-current [data-remove-page]");
  await a.waitForSelector(`${modal} [data-answer="yes"]`);
  await Promise.all([a.waitForEvent("load", { timeout: 30000 }), c.waitForEvent("load", { timeout: 30000 }).catch(() => {}), a.click(`${modal} [data-answer="yes"]`)]);
  await c.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 }).catch(() => {});
  await c.waitForTimeout(1500);
  const cToasts = await c.evaluate(() => window.__toasts.join(" | ")).catch(() => "");
  ok(/silindi; “Rehber\.xlsx” sayfasına geçildi/.test(cToasts) || /silindi; “REHBER” sayfasına geçildi/.test(cToasts) || /silindi; “.*” sayfasına geçildi/.test(cToasts), `C: silinen sayfa için bildirim (“${cToasts}”)`);
  ok((await c.evaluate(() => window.HOF.datasetKey)) === x, "C kalan sayfaya (X) geçti");
  await b.waitForTimeout(1500);
  ok((await loads(b)) === bLoads2 && (await b.evaluate(() => window.HOF.datasetKey)) === x && (await pillCount(b)) <= 1, `B yerinde, şerit tek sayfa (${await pillCount(b)})`);
  await shot(b, "b-silme-sonrasi");
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
