// 2.4.4 ekran gezintisi — dört yeni ekran öğesi GERÇEK arayüzden (ürün koduna dokunmaz): node gezinti.mjs <worktree> <çıktı klasörü>
//  Ö1 Çok sekmeli tablo notu (Tablodaki Kişiler / Vadeler / Nakit Akışı + Tahsilat Takvimi şeridi); not olmaması gereken durum (tek sekmede tekrar eden Dosya No).
//  Ö2 Tablodaki Nakit Akışı: Kasa yetkisi (cash.view) olmayan kullanıcıda Kasa sütunları yok + not; yetkilide Kasa sütunları = Kasa Hareketleri; Sekme süzgeci;
//     Kişi / Durum / En Az Tutar gizli.
//  Ö3 Silinenler'den fatura geri yükleme 409 iletileri: sıra-tarih, dönem kilidi, numara başkasında; ret sırası numara → kilit → sıra-tarih; başarılı geri
//     yükleme; yedek geri yüklemesinden sonra Fatura'daki tek seferlik numara uyarısı.
//  Ö4 A3: Durum Sorgula eşzamanlı başka sorgu / yeni gönderimle çakışınca ileti (sahte EDM + önünde bekleten vekil; ağa çıkılmaz).
// Sahte saat (config.now + page.clock; ders 13), lisans servisi ölü yerel adres (ders 30), veri programın API'si ve arayüzünden (elle sqlite yok).
// Soru/onay pencereleri kendiliğinden yanıtlanmaz (ders 34): görünen her pencere sonuca yazılır.
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WT = path.resolve(process.argv[2] || "");
const OUT = path.resolve(process.argv[3] || "");
if (!WT || !OUT) throw new Error("kullanım: node gezinti.mjs <worktree> <çıktı>");
mkdirSync(OUT, { recursive: true });
process.env.TZ = "Europe/Istanbul";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const mod = rel => import(pathToFileURL(path.join(WT, rel)).href);
const require = createRequire(path.join(WT, "package.json"));
const { chromium } = require("playwright");
const { createApp } = await mod("server/app.mjs");
const { createClock } = await mod("server/lib/clock.mjs");
const { buildXlsx } = await mod("server/lib/xlsx-write.mjs");
const { titleCase } = await mod("server/lib/text-case.mjs");
const { resetEdmCaches } = await mod("server/lib/einvoice/edm.mjs");
const { createClient } = await mod("test/helpers.mjs");
const { OUR_VKN, startMockEdm, vkn } = await mod("test/einvoice-mock.mjs");

const PASS = "Prova-Admin-2026!";
const AV_PASS = "Avukat-Ekran-2026!";
const TODAY = "2026-06-17"; // sahte saatin günü (Çarşamba, ayın ortası)
const clock = createClock({ time: Date.parse(`${TODAY}T10:00:00+03:00`) });
const pad = value => String(value).padStart(2, "0");
const iso = days => {
  const [y, m, d] = TODAY.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
};
const tr = days => iso(days).split("-").reverse().join(".");
const money = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ₺`;
const flat = text => String(text || "").replace(/\s+/g, " ").trim();

// ---------- sonuç ----------
const results = [];
const check = (oge, denetim, beklenen, okunan, gecti) => {
  const item = { oge, denetim, beklenen, okunan, gecti: Boolean(gecti) };
  results.push(item);
  console.log(`${item.gecti ? "✓" : "✗"} [${oge}] ${denetim} — beklenen: ${JSON.stringify(beklenen)} · okunan: ${JSON.stringify(okunan)}`);
  return item.gecti;
};
const eq = (oge, denetim, beklenen, okunan) => check(oge, denetim, beklenen, okunan, JSON.stringify(beklenen) === JSON.stringify(okunan));
const shots = [];

// ---------- sahte EDM + vekil (test/ebelge-244-gonderim-izi.test.mjs startProxy ile aynı kalıp) ----------
const opOf = body => (/<(?:\w+:)?(\w+)Request[\s>]/.exec(String(body || "").replace(/<(?:\w+:)?(Envelope|Header|Body)[\s>]/g, "")) || [])[1] || "";
async function startProxy(target) {
  const origin = new URL(target).origin;
  const holds = [];
  const seen = new Map();
  const hanging = new Set();
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
      const body = Buffer.concat(chunks);
      const op = req.method === "GET" ? "" : opOf(body.toString("utf8"));
      seen.set(op, (seen.get(op) || 0) + 1);
      const at = holds.findIndex(item => item.op === op && item.nth === seen.get(op));
      const hold = at >= 0 ? holds.splice(at, 1)[0] : null;
      if (hold?.phase === "before") {
        hanging.add(res);
        hold.res = res;
        hold.resolve();
        return;
      }
      try {
        const reply = await fetch(origin + req.url, { method: req.method, headers: Object.fromEntries(Object.entries(req.headers).filter(([key]) => !["host", "content-length", "connection"].includes(key))), body: req.method === "GET" ? undefined : body });
        const text = Buffer.from(await reply.arrayBuffer()).toString("utf8");
        const send = () => {
          if (!res.writableEnded && !res.destroyed) res.writeHead(reply.status, { "content-type": reply.headers.get("content-type") || "text/xml" }).end(text);
        };
        if (hold) {
          hanging.add(res);
          hold.res = res;
          hold.send = send;
          hold.resolve();
          return;
        }
        send();
      } catch (error) {
        if (!res.writableEnded) res.writeHead(502).end(String(error?.message || error));
      }
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}${new URL(target).pathname}`,
    seen: op => seen.get(op) || 0,
    hold(op, { phase = "after", nth = (seen.get(op) || 0) + 1 } = {}) {
      const item = { op, phase, nth };
      item.reached = new Promise(resolve => (item.resolve = resolve));
      item.release = () => (item.send ? item.send() : item.res?.socket?.destroy());
      holds.push(item);
      return item;
    },
    close: () => {
      for (const res of hanging) res.socket?.destroy();
      server.closeAllConnections?.();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

// ---------- program ----------
const root = mkdtempSync(path.join(tmpdir(), "ekran-g-"));
resetEdmCaches();
const edm = await startMockEdm();
const proxy = await startProxy(edm.url);
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz: ${url}`);
  return globalThis.fetch(input, init);
};
const app = createApp({
  dataDir: path.join(root, "data"),
  backupDir: path.join(root, "backups"),
  logLevel: "warn",
  scheduleBackups: false,
  now: clock,
  fetchImpl,
  edocEnabled: true,
  esmmEnabled: true,
  testSeriesStart: () => 1,
  edocStatusPollMs: [5, 5],
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  license: { enforce: false, machineId: "e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6" },
  startLicenseTimers: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data && typeof res.data === "object" && "ok" in res.data ? res.data.data : res.data;
};
await must("giriş", api.login("admin", PASS));
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));

const browser = await chromium.launch();
const consoleLog = [];
const dialogsSeen = [];
async function newPage(label) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  // Lisans çubuğu ekran görüntüsünü kaplamasın (e2e'lerle aynı).
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.clock.install({ time: clock.ms() });
  page.on("pageerror", error => consoleLog.push({ page: label, type: "pageerror", text: error.message }));
  page.on("console", message => {
    if (message.type() === "error") consoleLog.push({ page: label, type: "console.error", text: message.text(), url: message.location().url || "" });
  });
  page.on("dialog", async dialog => {
    dialogsSeen.push({ page: label, type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });
  return page;
}
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
};
const pageApi = (page, url, body, method = body ? "POST" : "GET") =>
  page.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ...json };
    },
    [url, body, method],
  );
// Görünen pencere başlıkları (ders 34: hiçbiri betikçe yanıtlanmaz; beklenmeyen pencere sonuca yazılır).
const openDialogs = page => page.$$eval(".hof-modal-backdrop.is-visible .hof-modal-title, .hof-modal-backdrop.is-visible h2", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()).filter(Boolean));
// Metin kesiliyor / taşıyor mu: öğenin içeriği kutusundan taşar (scroll > client) ya da öğe pencerenin dışına çıkar.
const fitOf = (page, selector) =>
  page.evaluate(sel => {
    const nodes = [...document.querySelectorAll(sel)].filter(node => node.getClientRects().length);
    return nodes.map(node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const clipsX = node.scrollWidth > node.clientWidth + 1 && style.overflowX !== "visible";
      const clipsY = node.scrollHeight > node.clientHeight + 1 && style.overflowY !== "visible";
      const ellipsis = style.textOverflow === "ellipsis" && node.scrollWidth > node.clientWidth + 1;
      return { clipped: clipsX || clipsY || ellipsis, outside: rect.left < -1 || rect.right > innerWidth + 1, width: Math.round(rect.width), height: Math.round(rect.height), whiteSpace: style.whiteSpace };
    });
  }, selector);
async function shotBoth(page, name, selector, oge) {
  for (const [w, h] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    if (selector) await page.$eval(selector, node => node.scrollIntoView({ block: "center" })).catch(() => null);
    const file = path.join(OUT, `${String(shots.length + 1).padStart(2, "0")}-${name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    shots.push(file);
    if (selector) {
      const fit = await fitOf(page, selector);
      check(oge, `${name} ${w}×${h}: metin kesilmiyor / taşmıyor (${selector})`, "kesilme yok, pencere içinde", fit, fit.length > 0 && fit.every(item => !item.clipped && !item.outside));
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}
const isTitle = label => titleCase(label) === label;
const sentenceCase = text => /^[0-9A-ZÇĞİÖŞÜ]/.test(text) && text.split(/\s+/).filter(word => /^[a-zçğıöşü]/i.test(word)).some(word => /^[a-zçğıöşü]/.test(word));

// ---------- tablo raporları (Raporlar → Tablo Raporları) ----------
const MODAL = ".hof-modal-backdrop.is-visible";
async function openTableReports(page) {
  await page.click('.hof-side-item[data-action="analytics"]');
  await page.waitForSelector(`${MODAL} .hof-rep .hof-rep-tabs`);
  await page.click(`${MODAL} .hof-rep [data-tab="table"]`);
  await page.waitForSelector(`${MODAL} [data-table-pane] .hof-report-kinds`);
}
async function reportLoaded(page, kind, previous) {
  await page.waitForFunction(
    ([kind, previous]) => {
      const pane = document.querySelector(".hof-modal-backdrop.is-visible [data-table-pane]");
      const body = pane?.querySelector("[data-report-body]");
      if (!body || /hazırlanıyor/.test(body.textContent)) return false;
      if (!pane.querySelector(`[data-kind="${kind}"][aria-selected="true"]`)) return false;
      return body.innerHTML !== previous;
    },
    [kind, previous],
    { timeout: 30000 },
  );
}
async function pickKind(page, kind) {
  const previous = await page.$eval(`${MODAL} [data-report-body]`, node => node.innerHTML).catch(() => "");
  const already = await page.$(`${MODAL} [data-table-pane] [data-kind="${kind}"][aria-selected="true"]`);
  if (already && !/hazırlanıyor/.test(previous)) return;
  await page.click(`${MODAL} [data-table-pane] [data-kind="${kind}"]`);
  await reportLoaded(page, kind, already ? "" : previous);
}
async function submitFilters(page, kind) {
  const previous = await page.$eval(`${MODAL} [data-report-body]`, node => node.innerHTML);
  const wait = page.waitForResponse(response => response.url().includes(`/api/workspace/reports/${kind}?`), { timeout: 30000 });
  wait.catch(() => null);
  await page.click(`${MODAL} [data-table-pane] [data-filters] [type="submit"]`);
  const response = await wait;
  await reportLoaded(page, kind, previous).catch(() => null);
  return response.json().catch(() => null);
}
// Ekrandaki rapor: kolonlar, TOPLAM satırı, notlar, özet kartları, gizli süzgeçler.
const readReport = page =>
  page.evaluate(() => {
    const pane = document.querySelector(".hof-modal-backdrop.is-visible [data-table-pane]");
    const head = [...pane.querySelectorAll(".hof-report-table thead th")].map(node => node.textContent.trim());
    const foot = [...pane.querySelectorAll(".hof-report-table tfoot td")].map(node => node.textContent.replace(/\s+/g, " ").trim());
    const rows = [...pane.querySelectorAll(".hof-report-table tbody tr")].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, " ").trim()));
    const notes = [...pane.querySelectorAll("[data-report-notes] .hof-report-note")].map(node => node.textContent.replace(/\s+/g, " ").trim());
    const cards = [...pane.querySelectorAll(".hof-report-card")].map(node => [node.querySelector("small")?.textContent.trim(), node.querySelector("b")?.textContent.trim()]);
    const filters = [...pane.querySelectorAll("[data-filters] label")].map(label => ({ label: label.querySelector("span")?.textContent.trim(), hidden: label.hidden || !label.getClientRects().length }));
    const tabOptions = [...pane.querySelectorAll('[data-filter="tabs"] option')].map(option => option.textContent.trim());
    return { head, foot, rows, notes, cards, filters, tabOptions, meta: pane.querySelector("[data-report-meta]")?.textContent.trim() || "" };
  });
const colOf = (report, label) => report.head.indexOf(label);
const footAt = (report, label) => (colOf(report, label) >= 0 ? report.foot[colOf(report, label)] : null);
const sumCol = (report, label) => {
  const index = colOf(report, label);
  if (index < 0) return null;
  return Math.round(report.rows.reduce((sum, row) => sum + (Number(String(row[index] || "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0), 0) * 100) / 100;
};

// ---------- Excel yükleme (başlangıç ekranındaki bırakma alanı → Ön İzleme ve Eşleme → Değiştir) ----------
async function uploadExcel(page, file, oge) {
  await page.waitForSelector("#hof-start .hof-drop input[type=file]", { state: "attached" });
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(file);
  await page.waitForSelector(`${MODAL} .hof-mapping`, { timeout: 30000 });
  const titles = await openDialogs(page);
  check(oge, "Excel yüklenince açılan pencere (eşleme) — kendiliğinden yanıtlanmadı", "Ön izleme/eşleme penceresi", titles, titles.length >= 1);
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${MODAL} [data-mode="replace"]`)]);
  await page.waitForTimeout(800);
  const analysis = await page.$(".hof-analysis-result:not([hidden])");
  // Analiz öneri kutusu (varsa) UYGULANMAZ: rapor kuralı tablodaki başlıklardan okunmalı; varlığı yazılır.
  return { analysisShown: Boolean(analysis) };
}
const sheetXlsx = sheets => buildXlsx(sheets.map(sheet => ({ name: sheet.name, columns: sheet.columns, rows: sheet.rows.map(row => Object.fromEntries(sheet.columns.map((column, index) => [column, row[index]]))) })), { title: "Ekran Gezintisi" });

const steps = [];
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
    steps.push({ title, ok: true });
  } catch (error) {
    steps.push({ title, ok: false, error: String(error?.stack || error).slice(0, 1500) });
    check(title.slice(0, 2), `ADIM YARIDA KALDI: ${title}`, "adım tamamlanır", String(error?.message || error).slice(0, 400), false);
  }
};

const admin = await newPage("admin");
await login(admin, "admin", PASS);
await admin.waitForSelector("#hof-start .hof-drop");

// =====================================================================================================================
// Ö1 — ÇOK SEKMELİ TABLO NOTU (001: üç sekme, iki sekmede aynı Dosya No)
const MULTI = path.join(root, "aidat-cok-sekme.xlsx");
const COLS = ["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"];
writeFileSync(
  MULTI,
  sheetXlsx([
    { name: "2025 Aidat", columns: COLS, rows: [["D-5", "Ali Veli", "1.200", tr(-2)], ["D-7", "Ayşe Kaya", "600", tr(-1)]] },
    { name: "2026 Aidat", columns: COLS, rows: [["D-5", "Ali Veli", "800", tr(3)], ["D-7", "Ayşe Kaya", "600", tr(4)]] },
    // Aynı sekmede tekrar eden Dosya No (taksit satırları): not açmaz, iki ayrı kalem.
    { name: "Taksitler", columns: COLS, rows: [["T-100", "Can Yıldız", "400", tr(-3)], ["T-100", "Can Yıldız", "600", tr(5)]] },
  ]),
);
const NOTE_MULTI = "2 dosya no birden çok sekmede; ayrı sayıldı (2025 Aidat, 2026 Aidat). Aynı borçsa kopya sekmeyi kaldırın ya da Sekme süzgeciyle bakın. Dosya No: D-5 (Ali Veli), D-7 (Ayşe Kaya).";
// Elle hesap (hücrelerden): Ali 1.200 + 800 = 2.000; Ayşe 600 + 600 = 1.200; Can 400 + 600 = 1.000 → 4.200. Takvim 6 kalem.
const EXPECT_MULTI = { "Ali Veli": 2000, "Ayşe Kaya": 1200, "Can Yıldız": 1000 };
const TOTAL_MULTI = 4200;

await step("Ö1a. Excel (3 sekme) arayüzden yüklenir; Tablodaki Kişiler / Vadeler / Nakit Akışı notu ve TOPLAM", async () => {
  const up = await uploadExcel(admin, MULTI, "Ö1");
  check("Ö1", "analiz öneri kutusu (bilgi; uygulanmadı)", "bilgi", up, true);
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await openTableReports(admin);
  await pickKind(admin, "cari-ekstre");
  let r = await readReport(admin);
  const apiCari = await must("api kişiler", api.get("/api/workspace/reports/cari-ekstre?from=2000-01-01&to=2099-12-31"));
  eq("Ö1", "API Tablodaki Kişiler: kişi başına borç (hücrelerden elle hesap)", EXPECT_MULTI, Object.fromEntries(apiCari.report.groups.map(group => [group.cari, group.debit])));
  eq("Ö1", "API Tablodaki Kişiler: toplam borç", TOTAL_MULTI, apiCari.report.totals.debit);
  eq("Ö1", "Tablodaki Kişiler ekranda not (tam metin)", [NOTE_MULTI], r.notes);
  check("Ö1", "Tablodaki Kişiler TOPLAM satırı (Borç) = 4.200,00 ₺", money(TOTAL_MULTI), r.foot, r.foot.some(cell => cell === money(TOTAL_MULTI)));
  check("Ö1", "özet kartı Toplam Borç = 4.200,00 ₺", money(TOTAL_MULTI), r.cards, r.cards.some(([label, value]) => label === "Toplam Borç" && value === money(TOTAL_MULTI)));
  check("Ö1", "Tablodaki Kişiler kolon başlıkları başlık düzeninde (Yazım düzeni)", "her biri titleCase", r.head, r.head.length > 0 && r.head.every(isTitle));
  check("Ö1", "not cümle düzeninde (her sözcük büyük değil)", "cümle düzeni", r.notes[0] || "", sentenceCase(r.notes[0] || ""));
  await shotBoth(admin, "o1-tablodaki-kisiler-not", `${MODAL} [data-report-notes]`, "Ö1");
  await admin.$eval(`${MODAL} .hof-report-table tfoot`, node => node.scrollIntoView({ block: "end" })).catch(() => null);
  await admin.screenshot({ path: path.join(OUT, `${String(shots.length + 1).padStart(2, "0")}-o1-tablodaki-kisiler-toplam-1366x768.png`) });
  shots.push(path.join(OUT, `${String(shots.length).padStart(2, "0")}-o1-tablodaki-kisiler-toplam-1366x768.png`));

  await pickKind(admin, "vade-takip");
  r = await readReport(admin);
  eq("Ö1", "Tablodaki Vadeler ekranda not", [NOTE_MULTI], r.notes);
  eq("Ö1", "Tablodaki Vadeler satır sayısı (6 ayrı kalem: aynı sekmedeki T-100 iki kalem, D-5 / D-7 her sekmede ayrı)", 6, r.rows.length);
  const amountLabel = r.head.find(label => /^Tutar$|Tutar/.test(label)) || "";
  check("Ö1", `Tablodaki Vadeler TOPLAM (${amountLabel}) = 4.200,00 ₺ ve satırların toplamı`, money(TOTAL_MULTI), { foot: footAt(r, amountLabel), satirToplami: sumCol(r, amountLabel) }, footAt(r, amountLabel) === money(TOTAL_MULTI) && sumCol(r, amountLabel) === TOTAL_MULTI);
  await shotBoth(admin, "o1-tablodaki-vadeler-not", `${MODAL} [data-report-notes]`, "Ö1");

  await pickKind(admin, "nakit-akis");
  r = await readReport(admin);
  eq("Ö1", "Tablodaki Nakit Akışı ekranda not (yönetici: yalnız sekme notu)", [NOTE_MULTI], r.notes);
  check("Ö1", "Tablodaki Nakit Akışı TOPLAM Beklenen Tahsilat = 4.200,00 ₺", money(TOTAL_MULTI), footAt(r, "Beklenen Tahsilat"), footAt(r, "Beklenen Tahsilat") === money(TOTAL_MULTI));
  await shotBoth(admin, "o1-tablodaki-nakit-akisi-not", `${MODAL} [data-report-notes]`, "Ö1");

  // Sekme süzgeci 2026 Aidat → not yok, 800 + 600 = 1.400
  await pickKind(admin, "cari-ekstre");
  await admin.selectOption(`${MODAL} [data-table-pane] [data-filter="tabs"]`, "2026 Aidat");
  await submitFilters(admin, "cari-ekstre");
  r = await readReport(admin);
  eq("Ö1", "Sekme süzgeci 2026 Aidat: not yok", [], r.notes);
  check("Ö1", "Sekme süzgeci 2026 Aidat: TOPLAM Borç 1.400,00 ₺ (800 + 600)", money(1400), r.foot, r.foot.includes(money(1400)));
  eq("Ö1", "Sekme seçenekleri bütün sekmelerden", ["Tüm Sekmeler", "2025 Aidat", "2026 Aidat", "Taksitler"], r.tabOptions);
  await shotBoth(admin, "o1-sekme-suzgeci-2026-not-yok", `${MODAL} .hof-report-table`, "Ö1");
});

await step("Ö1b. Tahsilat Takvimi şeridi (ana sayfa): not, 6 kalem", async () => {
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await admin.waitForSelector(".hof-payment-promises", { timeout: 20000 });
  const dues = await must("takvim", api.get("/api/workspace/dues"));
  const items = dues.items.filter(item => item.person).map(item => [item.tab, item.person, item.amount]).sort((a, b) => a[0].localeCompare(b[0], "tr") || a[1].localeCompare(b[1], "tr") || a[2] - b[2]);
  eq("Ö1", "API takvim: 6 ayrı kalem (sekme, kişi, tutar)", [["2025 Aidat", "Ali Veli", 1200], ["2025 Aidat", "Ayşe Kaya", 600], ["2026 Aidat", "Ali Veli", 800], ["2026 Aidat", "Ayşe Kaya", 600], ["Taksitler", "Can Yıldız", 400], ["Taksitler", "Can Yıldız", 600]], items);
  eq("Ö1", "API takvim notu", [NOTE_MULTI], dues.notes);
  const strip = await admin.evaluate(() => {
    const band = document.querySelector(".hof-payment-promises");
    return { note: band?.querySelector("[data-dues-notes]")?.textContent.replace(/\s+/g, " ").trim() || "", pills: band?.querySelectorAll('.hof-payment-pill:not([aria-hidden="true"])').length || 0, heading: band?.querySelector(".hof-payment-promises-heading")?.textContent.replace(/\s+/g, " ").trim() || "", pillText: [...(band?.querySelectorAll(".hof-payment-pill-text") || [])].map(node => node.textContent.replace(/\s+/g, " ").trim()) };
  });
  eq("Ö1", "Tahsilat Takvimi şeridi notu (tam metin)", NOTE_MULTI, strip.note);
  eq("Ö1", "şeritte 6 pil (her kalem ayrı)", 6, strip.pills);
  check("Ö1", "şerit başlığı", "Tahsilat Takvimi …", strip.heading, /^Tahsilat Takvimi/.test(strip.heading));
  check("Ö1", "pil metinleri (bilgi)", "bilgi", strip.pillText, true);
  await shotBoth(admin, "o1-tahsilat-takvimi-serit-not", ".hof-payment-promises [data-dues-notes]", "Ö1");
});

// =====================================================================================================================
// Ö2 — NAKİT AKIŞI KASA NOTU (001)
await step("Ö2. Nakit Akışı: Kasa yetkisi olmayan avukat (cash.view kaldırıldı) ve yönetici; Kasa Hareketleri ile karşılaştırma", async () => {
  await must("kasa giriş", api.post("/api/workspace/cash", { kind: "in", amount: "5000", date: iso(-2), description: "Danışmanlık nakit", method: "cash" }));
  await must("kasa çıkış", api.post("/api/workspace/cash", { kind: "out", amount: "1250", date: iso(-1), description: "Kırtasiye", method: "cash" }));
  const kasaCari = await must("cari", api.post("/api/workspace/accounts", { name: "Nakit Müşteri", type: "customer", registeredOn: "2026-01-01" }));
  await must("cari nakit tahsilat", api.post(`/api/workspace/accounts/${kasaCari.id}/entries`, { kind: "in", amount: "750", date: iso(0), note: "Nakit tahsilat", method: "cash" }));
  await must("avukat", api.post("/api/admin/users", { username: "avukat1", name: "Avukat Bir", role: "avukat", password: AV_PASS, mustChangePassword: false, grants: { add: [], remove: ["cash.view"] } }));
  const kasa = await must("Kasa Hareketleri", api.get("/api/workspace/report-center/kasa-hareketleri"));
  const summary = Object.fromEntries((kasa.summary || []).map(([label, value]) => [label, value]));
  check("Ö2", "Kasa Hareketleri (Rapor Merkezi) özeti — bilgi", "bilgi", summary, true);

  // Yönetici
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await openTableReports(admin);
  await pickKind(admin, "nakit-akis");
  await admin.selectOption(`${MODAL} [data-table-pane] [data-filter="tabs"]`, "");
  await submitFilters(admin, "nakit-akis");
  let r = await readReport(admin);
  const cashHeads = ["Kasa Giriş", "Kasa Çıkış", "Net", "Birikimli", "Beklenenle Birlikte"];
  check("Ö2", "yönetici: Kasa sütunları var", cashHeads, r.head, cashHeads.every(label => r.head.includes(label)));
  const tl = value => String(value || "").replace(/ TL$/, " ₺");
  eq("Ö2", "yönetici: TOPLAM Kasa Giriş = Kasa Hareketleri Dönem Giriş (5.000 + 750)", [money(5750), tl(summary["Dönem Giriş"])], [footAt(r, "Kasa Giriş"), money(5750)]);
  eq("Ö2", "yönetici: TOPLAM Kasa Çıkış = Kasa Hareketleri Dönem Çıkış (1.250)", [money(1250), tl(summary["Dönem Çıkış"])], [footAt(r, "Kasa Çıkış"), money(1250)]);
  eq("Ö2", "yönetici: özet kartları", ["Beklenen Tahsilat", "Gerçekleşen Tahsilat", "Kasa Giriş", "Kasa Çıkış", "Net"], r.cards.map(([label]) => label));
  eq("Ö2", "yönetici: Kasa notu yok (yalnız sekme notu)", [NOTE_MULTI], r.notes);
  const hiddenOf = report => Object.fromEntries(report.filters.map(item => [item.label, item.hidden]));
  const hid = hiddenOf(r);
  eq("Ö2", "Nakit Akışı süzgeçleri: Kişi / Kimlik, Durum, En Az Tutar gizli; Sekme ve Dönem görünür", { "Kişi / Kimlik": true, Durum: true, "En Az Tutar": true, Sekme: false, Dönem: false }, { "Kişi / Kimlik": hid["Kişi / Kimlik"], Durum: hid.Durum, "En Az Tutar": hid["En Az Tutar"], Sekme: hid.Sekme, Dönem: hid.Dönem });
  check("Ö2", "süzgeç ve kolon adları başlık düzeninde", "titleCase", [...r.filters.map(item => item.label), ...r.head], [...r.filters.map(item => item.label), ...r.head].every(isTitle));
  await shotBoth(admin, "o2-nakit-akisi-yonetici-kasa-sutunlari", `${MODAL} .hof-report-table`, "Ö2");

  // Kasa Hareketleri raporu ekranda (Raporlar → Tüm Raporlar → Kasa Hareketleri)
  await admin.click(`${MODAL} .hof-rep [data-tab="all"]`).catch(() => null);
  await admin.waitForTimeout(800);
  const kasaLink = admin.locator(`${MODAL} [data-all-pane] >> text=Kasa Hareketleri`).first();
  if (await kasaLink.count()) {
    await kasaLink.click();
    await admin.waitForTimeout(1500);
    const kasaScreen = flat(await admin.$eval(`${MODAL} [data-all-pane]`, node => node.innerText).catch(() => ""));
    check("Ö2", "Kasa Hareketleri ekranda Dönem Giriş 5.750 / Dönem Çıkış 1.250", "5.750,00 ve 1.250,00", kasaScreen.slice(0, 600), /5\.750,00/.test(kasaScreen) && /1\.250,00/.test(kasaScreen));
    await shotBoth(admin, "o2-kasa-hareketleri-raporu", null, "Ö2");
  } else check("Ö2", "Tüm Raporlar'da Kasa Hareketleri bağlantısı", "var", "bulunamadı", false);

  // Avukat (Kasa yetkisi yok)
  const av = await newPage("avukat1");
  await login(av, "avukat1", AV_PASS);
  await av.waitForSelector('.hof-side-item[data-action="analytics"]');
  await openTableReports(av);
  await pickKind(av, "nakit-akis");
  r = await readReport(av);
  const apiAv = await pageApi(av, "/api/workspace/reports/nakit-akis?from=2000-01-01&to=2099-12-31");
  check("Ö2", "avukat API: cashHidden ve Kasa kolonu yok", { cashHidden: true, kolon: [] }, { cashHidden: apiAv.data?.report?.cashHidden, kolon: (apiAv.data?.report?.table?.columns || []).map(column => column.key).filter(key => ["cashIn", "cashOut", "net", "cumulative", "projected"].includes(key)) }, apiAv.status === 200 && apiAv.data?.report?.cashHidden === true);
  check("Ö2", "avukat ekran: Kasa sütunları yok", "Kasa Giriş/Çıkış/Net/Birikimli/Beklenenle Birlikte yok", r.head, cashHeads.every(label => !r.head.includes(label)));
  const KASA_NOTE = "Kasa sütunları Kasa yetkisi gerektirir; bu raporda Kasa giriş, çıkış ve bakiye gösterilmiyor.";
  eq("Ö2", "avukat ekran notları (sekme notu + Kasa notu)", [NOTE_MULTI, KASA_NOTE], r.notes);
  eq("Ö2", "avukat özet kartları (Kasa yok)", ["Beklenen Tahsilat", "Gerçekleşen Tahsilat"], r.cards.map(([label]) => label));
  const avText = flat(await av.$eval(`${MODAL} [data-table-pane] [data-report-body]`, node => node.innerText));
  check("Ö2", "avukat ekranında Kasa tutarı (5.750 / 1.250) görünmüyor", "yok", avText.slice(0, 300), !/5\.750,00|1\.250,00/.test(avText));
  check("Ö2", "Kasa notu cümle düzeninde", "cümle düzeni", KASA_NOTE, sentenceCase(r.notes[1] || ""));
  await shotBoth(av, "o2-nakit-akisi-avukat-kasa-notu", `${MODAL} [data-report-notes]`, "Ö2");
  // Sekme süzgeci uygulanır (avukat): 2026 Aidat → Beklenen 1.400, sekme notu kalkar, Kasa notu kalır.
  await av.selectOption(`${MODAL} [data-table-pane] [data-filter="tabs"]`, "2026 Aidat");
  await submitFilters(av, "nakit-akis");
  r = await readReport(av);
  check("Ö2", "avukat Sekme süzgeci 2026 Aidat: Beklenen Tahsilat TOPLAM 1.400,00 ₺", money(1400), footAt(r, "Beklenen Tahsilat"), footAt(r, "Beklenen Tahsilat") === money(1400));
  eq("Ö2", "avukat Sekme süzgeci: yalnız Kasa notu", [KASA_NOTE], r.notes);
  await shotBoth(av, "o2-nakit-akisi-avukat-sekme-2026", `${MODAL} [data-report-notes]`, "Ö2");
  // PDF / Excel dışa aktarım (avukat) Kasa satırı taşımaz — API ile (indirme)
  const pdf = await av.evaluate(async () => {
    const response = await fetch("/api/workspace/reports/nakit-akis/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "xlsx", filters: {} }) });
    return { status: response.status, size: (await response.arrayBuffer()).byteLength };
  });
  check("Ö2", "avukat Excel dışa aktarımı açılır (200)", 200, pdf, pdf.status === 200);
  await av.context().close();
});

// =====================================================================================================================
// Ö3 — SİLİNENLER'DEN GERİ YÜKLEME 409 İLETİLERİ (001; e-Belge ayarı kapalı → Fiş ve Kâğıt Belge serisi)
await step("Ö3. Silinenler'den fatura geri yükleme: sıra-tarih → kilit → numara iletileri, ret sırası, başarılı geri yükleme", async () => {
  const cari = await must("cari", api.post("/api/workspace/accounts", { name: "Geri Yükleme Cari", type: "customer", registeredOn: "2026-01-01" }));
  const LINE = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
  const sale = (date, extra = {}) => must(`satış ${date}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: cari.id, issueDate: date, lines: LINE, payment: { rest: "open" }, ...extra }));
  const a = await sale(iso(-5));
  const x = await sale(iso(-1));
  await must("X sil", api.del(`/api/workspace/invoices/${x.id}?reason=${encodeURIComponent("yanlış tarih")}`));
  const c = await sale(iso(-3));
  check("Ö3", "kurulum numaraları (bilgi)", "FIS…1, FIS…2 (silindi), FIS…3", { a: a.number, x: x.number, c: c.number }, /^FIS/.test(a.number) && /^FIS/.test(x.number) && /^FIS/.test(c.number));
  const invCount = () => app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
  const inTrash = () => Boolean(app.store.get("SELECT 1 AS f FROM trash WHERE kind = 'invoice' AND ref = ? AND restored_at IS NULL", x.id));
  const openTrash = async () => {
    // Aynı adrese hash ile goto sayfayı yenilemez (liste eski kalır): önce başka adres.
    await admin.goto(`${BASE}/admin.html#users`, { waitUntil: "load" });
    await admin.goto(`${BASE}/admin.html#trash`, { waitUntil: "load" });
    await admin.reload({ waitUntil: "load" });
    await admin.waitForSelector("#adm-trash tr[data-id]");
  };
  const clickRestore = async (number, label) => {
    await openTrash();
    await admin.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
    const row = admin.locator("#adm-trash tr[data-id]", { hasText: number }).first();
    if (!(await row.count())) throw new Error(`Silinenler'de satır yok: ${number} — satırlar: ${JSON.stringify(await admin.$$eval("#adm-trash tr", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ").trim())))}`);
    if (!(await row.locator("[data-restore]").count())) throw new Error(`Geri Yükle düğmesi yok: ${flat(await row.innerText())}`);
    const wait = admin.waitForResponse(response => response.url().includes("/api/admin/trash/restore"));
    wait.catch(() => null);
    await row.locator("[data-restore]").click();
    const response = await wait;
    const body = await response.json().catch(() => ({}));
    await admin.waitForSelector(".hof-toast .hof-toast-text", { timeout: 10000 });
    const toast = await admin.$$eval(".hof-toast", nodes => nodes.map(node => ({ cls: node.className, text: node.querySelector(".hof-toast-text")?.textContent.trim(), buttons: [...node.querySelectorAll("button")].map(button => button.textContent.trim()) })));
    const dialogs = await openDialogs(admin);
    return { status: response.status(), code: body.code || "", error: body.error || "", message: body.data?.message || "", toast, dialogs, label };
  };
  const BELGE = `Satış Faturası ${x.number}`;
  // (c) yalnız sıra-tarih
  const before = invCount();
  let res = await clickRestore(x.number, "sira-tarih");
  const chronoText = `${BELGE} (${tr(-1)}) geri yüklenmez: geri yüklenirse numara ve tarih sırası bozulur — `;
  check("Ö3", "(c) sıra-tarih: 409 invoice-restore-chronology", { status: 409, code: "invoice-restore-chronology" }, { status: res.status, code: res.code }, res.status === 409 && res.code === "invoice-restore-chronology");
  check("Ö3", "(c) ekrandaki ileti = sunucunun iletisi (tam metin)", res.error, res.toast.map(item => item.text), res.toast.some(item => item.text === res.error && item.cls.includes("hof-toast-error")));
  check("Ö3", "(c) ileti içeriği: belge, tarih, sonraki numara daha eski tarih, Silinenler'de kalır", `${chronoText}… ${tr(-3)} tarihli (sonraki numara, daha eski tarih). Belge Silinenler'de kalır.`, res.error, res.error.startsWith(chronoText) && res.error.includes(`${c.number}`) && res.error.endsWith(`${tr(-3)} tarihli (sonraki numara, daha eski tarih). Belge Silinenler'de kalır.`));
  check("Ö3", "(c) Kopyala düğmesi ve pencere yok (ders 34)", { buttons: ["Kopyala"], dialogs: [] }, { buttons: res.toast.flatMap(item => item.buttons), dialogs: res.dialogs }, res.toast.some(item => item.buttons.includes("Kopyala")) && res.dialogs.length === 0);
  eq("Ö3", "(c) belge Silinenler'de kaldı, Fatura'ya dönmedi", { trash: true, invoices: before }, { trash: inTrash(), invoices: invCount() });
  await shotBoth(admin, "o3c-sira-tarih-iletisi", ".hof-toast-error .hof-toast-text", "Ö3");

  // (b) kilit + sıra-tarih → kilit iletisi
  await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: iso(-1) }));
  res = await clickRestore(x.number, "kilit");
  check("Ö3", "(b) kilit + sıra-tarih: 409 period-locked (sıra-tarihten ÖNCE)", { status: 409, code: "period-locked" }, { status: res.status, code: res.code }, res.status === 409 && res.code === "period-locked");
  check("Ö3", "(b) ekrandaki ileti = sunucunun iletisi", res.error, res.toast.map(item => item.text), res.toast.some(item => item.text === res.error));
  check("Ö3", "(b) ileti metni (kilit)", `Bu satış faturası ${tr(-1)} tarihli; ${tr(-1)} ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı.`, res.error, res.error === `Bu satış faturası ${tr(-1)} tarihli; ${tr(-1)} ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı.`);
  eq("Ö3", "(b) belge Silinenler'de kaldı", { trash: true, invoices: before }, { trash: inTrash(), invoices: invCount() });
  await shotBoth(admin, "o3b-donem-kilidi-iletisi", ".hof-toast-error .hof-toast-text", "Ö3");

  // (a) numara başkasında + kilit + sıra-tarih → numara iletisi
  const holder = await sale(iso(0), { paperNo: x.number });
  check("Ö3", "numarayı alan belge (bilgi)", x.number, { number: holder.number, paperNo: holder.paperNo }, true);
  res = await clickRestore(x.number, "numara");
  check("Ö3", "(a) numara + kilit + sıra-tarih: 409 invoice-number-taken (ilk ret)", { status: 409, code: "invoice-number-taken" }, { status: res.status, code: res.code }, res.status === 409 && res.code === "invoice-number-taken");
  check("Ö3", "(a) ekrandaki ileti = sunucunun iletisi", res.error, res.toast.map(item => item.text), res.toast.some(item => item.text === res.error));
  check("Ö3", "(a) ileti metni (numara)", `${BELGE} geri yüklenmez: bu numara belge silindikten sonra başka bir belgeye verildi (… ${tr(0)} tarihli, Geri Yükleme Cari). Aynı numara iki belgede olamaz; belge Silinenler'de kalır.`, res.error, res.error.startsWith(`${BELGE} geri yüklenmez: bu numara belge silindikten sonra başka bir belgeye verildi (`) && res.error.includes(`${tr(0)} tarihli, Geri Yükleme Cari)`) && res.error.endsWith("Aynı numara iki belgede olamaz; belge Silinenler'de kalır."));
  await shotBoth(admin, "o3a-numara-baskasinda-iletisi", ".hof-toast-error .hof-toast-text", "Ö3");

  // Başarılı geri yükleme (kilit açıkta kalan günde, sıra uyuyor)
  const y = await sale(iso(0));
  await must("Y sil", api.del(`/api/workspace/invoices/${y.id}?reason=${encodeURIComponent("deneme")}`));
  res = await clickRestore(y.number, "basarili");
  check("Ö3", "başarılı geri yükleme: 200, ileti", `Satış Faturası ${y.number} geri geldi (iptal edilmiş, etkisiz).`, { status: res.status, message: res.message, toast: res.toast.map(item => item.text) }, res.status === 200 && res.toast.some(item => item.text === `Satış Faturası ${y.number} geri geldi (iptal edilmiş, etkisiz).` && item.cls.includes("success")));
  const back = app.store.get("SELECT number, status FROM invoices WHERE id = ?", y.id);
  eq("Ö3", "geri yüklenen belge kendi numarasıyla, İptal Edildi", { number: y.number, status: "cancelled" }, back ? { number: back.number, status: back.status } : null);
  await shotBoth(admin, "o3-basarili-geri-yukleme", ".hof-toast .hof-toast-text", "Ö3");
  await must("kilit kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  // Silinenler'den geri yüklemeden sonra Fatura'da yedek uyarısı OLMAMALI (uyarı yalnız yedek geri yüklemesinde — madde 30b).
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await admin.evaluate(() => window.HOF.invoices.open());
  await admin.waitForSelector("[data-invoices] .hof-rep-note");
  const banner = await admin.evaluate(() => document.querySelector("[data-invoices] [data-restore-notice]")?.innerText || "");
  eq("Ö3", "Silinenler'den geri yüklemeden sonra Fatura'da yedek uyarısı yok (uyarı yedek geri yüklemesine ait)", "", banner);
  await shotBoth(admin, "o3-fatura-listesi-silinenler-sonrasi", "[data-invoices] .hof-rep-note", "Ö3");
});

// =====================================================================================================================
// Ö4 — A3 İLETİSİ (002: e-SMM, sahte EDM + vekil)
let second = null;
const q2 = () => `?hofCompany=${encodeURIComponent(second.id)}`;
await step("Ö4. A3: Durum Sorgula ↔ başka sorgu (status-updated) ve ↔ yeni gönderim (send-started) — arayüzden", async () => {
  second = (await must("002", api.post("/api/companies", { name: "İkinci Büro", select: false }))).company;
  await must("002 kurulum geç", api.post(`/api/workspace/bank/setup/dismiss${q2()}`, {}));
  await must("002 ayar", api.put(`/api/workspace/invoices/settings${q2()}`, { seller: { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: proxy.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
  const client = await must("müvekkil", api.post(`/api/workspace/accounts${q2()}`, { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" }));
  const smm = extra => ({ scenario: "smm", accountId: client.id || client.account?.id, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, ...extra });
  const b = createClient(BASE);
  await must("B giriş", b.login("admin", PASS));

  await pageApi(admin, "/api/companies/select", { id: second.id });
  const openCard = async id => {
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForFunction(() => Boolean(window.HOF?.invoices?.open));
    await admin.evaluate(docId => window.HOF.invoices.open({ id: docId }), id);
    await admin.waitForSelector('[data-invoices] [data-act="e-refresh"]');
    await admin.waitForTimeout(1500); // kartın kendi yenilemeleri dursun
    await admin.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
  };

  // R5 kalıbı: gönderilmiş makbuz; ekrandaki Durum Sorgula'nın EDM yanıtı yolda tutulur, B'nin sorgusu geçer → ekranda 409 status-updated.
  const doc = await must("makbuz (gönder)", api.post(`/api/workspace/invoices${q2()}`, smm({ eSend: "now" })));
  check("Ö4", "kurulum: makbuz gönderildi (bilgi)", "sent/processing", { number: doc.number, eStatus: doc.eStatus }, ["sent", "processing"].includes(doc.eStatus));
  await openCard(doc.id);
  let held = proxy.hold("GetSMMStatus", { phase: "after" });
  let waitUi = admin.waitForResponse(response => response.url().includes(`/invoices/${doc.id}/e-refresh`), { timeout: 30000 });
  waitUi.catch(() => null);
  await admin.click('[data-invoices] [data-act="e-refresh"]');
  await held.reached;
  const bRes = await b.post(`/api/workspace/invoices/${doc.id}/e-refresh${q2()}`, {});
  held.release();
  let ui = await waitUi;
  let body = await ui.json().catch(() => ({}));
  await admin.waitForSelector(".hof-toast-error .hof-toast-text", { timeout: 10000 });
  let toast = await admin.$$eval(".hof-toast", nodes => nodes.map(node => ({ cls: node.className, text: node.querySelector(".hof-toast-text")?.textContent.trim(), buttons: [...node.querySelectorAll("button")].map(button => button.textContent.trim()) })));
  const REFRESHED = "Belgenin durumu bu sırada başka bir sorguyla güncellendi; kartı yenileyip gerekirse yeniden sorgulayın.";
  check("Ö4", "B'nin Durum Sorgula'sı 200 (bilgi)", 200, bRes.status, bRes.status === 200);
  eq("Ö4", "ekrandaki Durum Sorgula: 409 einvoice-status-stale, reason status-updated", { status: 409, code: "einvoice-status-stale", reason: "status-updated" }, { status: ui.status(), code: body.code, reason: body.reason });
  check("Ö4", "ekrandaki ileti (tam metin)", REFRESHED, toast.map(item => item.text), toast.some(item => item.text === REFRESHED && item.cls.includes("hof-toast-error")));
  check("Ö4", "ileti 'gönderim' demiyor; Kopyala var; pencere yok", { gonderim: false, kopyala: true, pencere: [] }, { toast: toast.map(item => item.text), pencere: await openDialogs(admin) }, toast.every(item => !/gönderim/.test(item.text || "")) && toast.some(item => item.buttons.includes("Kopyala")));
  await shotBoth(admin, "o4-a3-baska-sorgu-iletisi", ".hof-toast-error .hof-toast-text", "Ö4");

  // R1 kalıbı: Sonucu Belirsiz makbuz; ekrandaki Durum Sorgula ("bulunamadı") yolda; B Gönder'e basar (SendSMM EDM'de, yanıtı yolda) → ekranda 409 send-started.
  const doc2 = await must("makbuz (sonra gönder)", api.post(`/api/workspace/invoices${q2()}`, smm({ eSend: "later" })));
  const cut = proxy.hold("SendSMM", { phase: "before" });
  const first = api.post(`/api/workspace/invoices/${doc2.id}/send${q2()}`, {});
  await cut.reached;
  cut.release();
  await first;
  const card2 = await must("kart", api.get(`/api/workspace/invoices/${doc2.id}${q2()}`));
  check("Ö4", "kurulum: makbuz Sonucu Belirsiz", "Sonucu Belirsiz", card2.eStatusLabel, card2.eStatusLabel === "Sonucu Belirsiz");
  await openCard(doc2.id);
  const uncertainShot = path.join(OUT, `${String(shots.length + 1).padStart(2, "0")}-o4-sonucu-belirsiz-kart-1366x768.png`);
  await admin.screenshot({ path: uncertainShot });
  shots.push(uncertainShot);
  held = proxy.hold("GetSMMStatus", { phase: "after" });
  waitUi = admin.waitForResponse(response => response.url().includes(`/invoices/${doc2.id}/e-refresh`), { timeout: 30000 });
  waitUi.catch(() => null);
  await admin.click('[data-invoices] [data-act="e-refresh"]');
  await held.reached;
  const sendHold = proxy.hold("SendSMM", { phase: "after" });
  const sending = b.post(`/api/workspace/invoices/${doc2.id}/send${q2()}`, {});
  await sendHold.reached;
  held.release();
  ui = await waitUi;
  body = await ui.json().catch(() => ({}));
  await admin.waitForSelector(".hof-toast-error .hof-toast-text", { timeout: 10000 });
  toast = await admin.$$eval(".hof-toast", nodes => nodes.map(node => ({ cls: node.className, text: node.querySelector(".hof-toast-text")?.textContent.trim(), buttons: [...node.querySelectorAll("button")].map(button => button.textContent.trim()) })));
  const STALE = "Durum sorgulanırken belgenin e-Belge durumu başka bir oturumda değişti (ör. yeniden gönderim başladı); sorgunun sonucu yazılmadı. Birkaç saniye sonra kartı yenileyin, gerekirse yeniden Durum Sorgula'ya basın.";
  eq("Ö4", "ekrandaki Durum Sorgula: 409 einvoice-status-stale, reason send-started", { status: 409, code: "einvoice-status-stale", reason: "send-started" }, { status: ui.status(), code: body.code, reason: body.reason });
  check("Ö4", "ekrandaki ileti (tam metin)", STALE, toast.map(item => item.text), toast.some(item => item.text === STALE && item.cls.includes("hof-toast-error")));
  const during = await must("kart (gönderim yolda)", api.get(`/api/workspace/invoices/${doc2.id}${q2()}`));
  check("Ö4", "geç 'bulunamadı' izi silmedi (gönderim yolda: kart Sonucu Belirsiz)", "Sonucu Belirsiz", during.eStatusLabel, during.eStatusLabel === "Sonucu Belirsiz");
  await shotBoth(admin, "o4-a3-yeni-gonderim-iletisi", ".hof-toast-error .hof-toast-text", "Ö4");
  sendHold.release();
  const sent = await sending;
  check("Ö4", "B'nin gönderimi bitti (200)", 200, sent.status, sent.status === 200);
  await admin.waitForTimeout(800);
  await openCard(doc2.id);
  const end = await must("son kart", api.get(`/api/workspace/invoices/${doc2.id}${q2()}`));
  check("Ö4", "son durum gönderildi / işleniyor; kart yenilenince ekranda", "sent | processing", { eStatus: end.eStatus, label: end.eStatusLabel }, ["sent", "processing"].includes(end.eStatus));
  await shotBoth(admin, "o4-son-kart", '[data-invoices] [data-act="e-refresh"]', "Ö4");
});

// =====================================================================================================================
// Ö3 (devam) — yedek geri yüklemesinden sonra Fatura'da tek seferlik numara uyarısı (002; kullanıcı kararı madde 30b)
await step("Ö3d. Yedek geri yüklemesi (002) → Fatura'da tek seferlik uyarı; yeniden açılışta durur, Uyarıyı Kapat'tan sonra çıkmaz", async () => {
  const backup = await must("002 yedek", api.post("/api/admin/backups", { scope: "one", companyId: second.id }));
  const restored = await must("002 geri yükle", api.post("/api/admin/backups/restore", { name: backup.name, company: second.id, confirm: "002", password: PASS }));
  check("Ö3", "002 yedekten geri yüklendi (bilgi)", "200", restored, true);
  const openList = async () => {
    await pageApi(admin, "/api/companies/select", { id: second.id });
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForFunction(() => Boolean(window.HOF?.invoices?.open));
    await admin.evaluate(() => window.HOF.invoices.open());
    await admin.waitForSelector("[data-invoices] .hof-rep-note");
    return admin.evaluate(() => document.querySelector("[data-invoices] [data-restore-notice]")?.innerText.replace(/\s+/g, " ").trim() || "");
  };
  let notice = await openList();
  check("Ö3", "geri yüklemeden sonra Fatura'da uyarı (e-Belge kullanan şirket: EDM cümlesi)", "Yedek geri yüklendi (yedek tarihi: …). Yedekten sonra EDM'ye gönderilmiş e-Belge'ler …", notice, /^Yedek geri yüklendi \(yedek tarihi: \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}\)\. Yedekten sonra EDM'ye gönderilmiş e-Belge'ler/.test(notice));
  const buttons = await admin.$$eval("[data-invoices] [data-restore-notice] button", nodes => nodes.map(node => node.textContent.trim()));
  check("Ö3", "uyarı düğmeleri başlık düzeninde", ["Fatura Ayarları", "Uyarıyı Kapat"], buttons, buttons.join("|") === "Fatura Ayarları|Uyarıyı Kapat" && buttons.every(isTitle));
  await shotBoth(admin, "o3d-yedek-geri-yukleme-uyarisi", "[data-invoices] [data-restore-notice]", "Ö3");
  notice = await openList();
  check("Ö3", "ikinci açılışta (kapatılmadan) uyarı DURUR — tasarım: 'kapatılınca bir daha çıkmaz'", "uyarı var", notice.slice(0, 60), notice.startsWith("Yedek geri yüklendi"));
  await admin.click("[data-invoices] [data-restore-notice] [data-act=restore-notice-dismiss]");
  await admin.waitForFunction(() => !document.querySelector("[data-invoices] [data-restore-notice]"), null, { timeout: 15000 }).catch(() => null);
  notice = await openList();
  eq("Ö3", "Uyarıyı Kapat'tan sonra yeniden açılışta uyarı yok", "", notice);
  await shotBoth(admin, "o3d-uyari-kapatildi-yeniden-acilis", "[data-invoices] .hof-rep-note", "Ö3");
});

// =====================================================================================================================
// Ö1 (devam) — not olmaması gereken durum: tek sekmede tekrar eden Dosya No (yeni şirket 003 yok — en fazla 2 şirket; 002'nin tablosu)
await step("Ö1c. Tek sekmede tekrar eden Dosya No (002'ye yüklenir): not yok, ayrı kalemler, TOPLAM", async () => {
  const SINGLE = path.join(root, "taksit-tek-sekme.xlsx");
  writeFileSync(SINGLE, sheetXlsx([{ name: "Taksitler", columns: COLS, rows: [["T-100", "Ali Veli", "1.000", tr(-2)], ["T-100", "Ali Veli", "1.500", tr(3)], ["T-200", "Ayşe Kaya", "700", tr(-1)]] }]));
  await pageApi(admin, "/api/companies/select", { id: second.id });
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  const up = await uploadExcel(admin, SINGLE, "Ö1");
  check("Ö1", "002 analiz öneri kutusu (bilgi)", "bilgi", up, true);
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await admin.waitForSelector(".hof-payment-promises", { timeout: 20000 });
  const strip = await admin.evaluate(() => ({ note: document.querySelector(".hof-payment-promises [data-dues-notes]")?.textContent || "", hasNote: document.querySelector(".hof-payment-promises")?.classList.contains("has-note"), pills: [...document.querySelectorAll('.hof-payment-promises .hof-payment-pill:not([aria-hidden="true"]) .hof-payment-pill-text')].map(node => node.textContent.replace(/\s+/g, " ").trim()) }));
  const tablePills = strip.pills.filter(text => /^(Ali Veli|Ayşe Kaya)/.test(text));
  eq("Ö1", "002 Tahsilat Takvimi: not yok; tablo kalemleri 3 (T-100 iki ayrı kalem: Ali Veli 2, Ayşe Kaya 1)", { note: "", hasNote: false, tabloPil: 3 }, { note: strip.note, hasNote: strip.hasNote, tabloPil: tablePills.length });
  check("Ö1", "002 şeridindeki bütün piller (bilgi; e-SMM makbuzlarının vadesi de şeritte)", "bilgi", strip.pills, true);
  const dues2 = await must("002 takvim", api.get(`/api/workspace/dues${q2()}`));
  eq("Ö1", "002 API takvim: tablo kalemleri ayrı, not yok", { items: [["Ali Veli", 1000], ["Ali Veli", 1500], ["Ayşe Kaya", 700]], notes: [] }, { items: dues2.items.filter(item => item.person && item.tab === "Taksitler").map(item => [item.person, item.amount]).sort((a, b) => a[0].localeCompare(b[0], "tr") || a[1] - b[1]), notes: dues2.notes || [] });
  await shotBoth(admin, "o1c-tek-sekme-serit-not-yok", ".hof-payment-promises", "Ö1");
  await openTableReports(admin);
  await pickKind(admin, "cari-ekstre");
  let r = await readReport(admin);
  eq("Ö1", "002 Tablodaki Kişiler: not yok", [], r.notes);
  check("Ö1", "002 Tablodaki Kişiler TOPLAM Borç 3.200,00 ₺ (1.000 + 1.500 + 700)", money(3200), r.foot, r.foot.includes(money(3200)));
  await shotBoth(admin, "o1c-tek-sekme-kisiler-not-yok", `${MODAL} .hof-report-table`, "Ö1");
  await pickKind(admin, "vade-takip");
  r = await readReport(admin);
  eq("Ö1", "002 Tablodaki Vadeler: not yok, 3 satır", { notes: [], rows: 3 }, { notes: r.notes, rows: r.rows.length });
});

// ---------- bitiş ----------
// Beklenen: 409 yanıtları (betiğin ürettiği retler) ve giriş ekranındaki /api/auth/me 401'i (oturum yokken; e2e'ler de dışarıda bırakır).
const unexpectedConsole = consoleLog.filter(item => !(item.type === "console.error" && (/status of 409/.test(item.text) || (/status of 401/.test(item.text) && /\/api\/auth\/me/.test(item.url)))));
check("genel", "konsol hatası yok (beklenen 409 retleri ve girişteki /api/auth/me 401 hariç)", [], unexpectedConsole, unexpectedConsole.length === 0);
eq("genel", "tarayıcı yerel pencere (alert/confirm) açılmadı", [], dialogsSeen);
const failed = results.filter(item => !item.gecti);
writeFileSync(path.join(OUT, "sonuc.json"), JSON.stringify({ worktree: WT, today: TODAY, passed: results.length - failed.length, failed: failed.length, steps, results, console: consoleLog, dialogs: dialogsSeen, shots }, null, 2));
console.log(`\nSONUÇ: ${results.length - failed.length} geçti, ${failed.length} kaldı; adımlar ${steps.filter(item => item.ok).length}/${steps.length}`);
await browser.close();
await app.close?.();
await proxy.close();
await edm.close();
rmSync(root, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
