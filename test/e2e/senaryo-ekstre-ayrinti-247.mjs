// 2.4.7 müşteri istekleri (kullanıcı 28.10.2026) — Ayrıntılı Cari Ekstre EKRANDAN, gerçek tıklamayla: cari kartı → "Ayrıntılı Ekstre".
//   (5)  alt başlık yalnız "Cari No … · tarih aralığı"; İşlem "Satış"; açıklama "Satış FIS…" (fatura kesilmemiş Müşteri Fişi).
//   (6b) "Kalem Açıklaması" kolonunda fatura satırının açıklaması; stok kartı notu yok.
//   (6a) "Sütunlar" açılır listesinden işaret kaldırılınca kolon ekranda, ekrandaki PDF ve Excel bağlantılarından inen dosyalarda yok; liste açık kalır;
//        son kolonun işareti kaldırılamaz ("En az bir sütun görünür kalmalı."); sayfa yeniden açılınca seçim kalır; başka kullanıcının ekranı etkilenmez.
// Eski kodda kırmızıdır (Sütunlar yok, Kalem Açıklaması yok, metinler eski): DEPO=<eski kopya> ile koşulur. SHOTS=<klasör> ekran görüntüleri.
// Çıkış: "N geçti, M kaldı".
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { escClose } from "./esc-kapat.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
// Dosya okuyucu her zaman bu çalışma ağacından (ürün kodu değildir).
const { pdfText, xlsxRows } = await import(pathToFileURL(path.join(HERE, "..", "fixtures", "rapor-dosya-oku.mjs")).href);
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : path.join(HERE, "artifacts", "senaryo-ekstre-ayrinti-247");
mkdirSync(SHOTS, { recursive: true });

const PASS = "Prova-Admin-2026!";
const NOW = "2026-11-27T12:00:00+03:00";
const ACIKLAMA = "Banyo kapısı 80x190, şeffaf temperli cam, krom profil, sağdan açılım";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-ekstre-ayrinti-247-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f48" }, startLicenseTimers: false });
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
const cari = await must("cari", api.post("/api/workspace/accounts", { name: "Cam Kabin Yapı", type: "customer", registeredOn: "2026-01-01" }));
const urun = await must("ürün", api.post("/api/workspace/stock", { name: "Köşe Kabin 90", code: "KK-90", unit: "Adet", unitPrice: "1000", salePrice: "2500", vatRate: "20", note: "STOKNOTU247 müşteriye gösterilmez", openingQty: "10", openingDate: "2026-01-02" }));
const fis = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: cari.id, issueDate: "2026-11-10", lines: [{ itemId: urun.id, goods: true, name: "Köşe Kabin 90", code: "KK-90", qty: 2, unitPrice: 2500, vatRate: 20, description: ACIKLAMA }, { name: "Montaj", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { cash: [{ amount: 600, method: "cash" }], rest: "open" } }));
await must("tahsilat", api.post(`/api/workspace/accounts/${cari.id}/entries`, { kind: "in", amount: "1000", method: "cash", date: "2026-11-20", note: "Elden" }));
// 2.4.7 gezinti D1 (docs/kanit/2026-10-29/247-gezinti/NOT.md adım 22): 1366 × 768'de 16 kolon — faturalı satış + "Taksit Planı (mevcut borç)" + taksit
// tahsilatları (gezintinin verisi, 13.200) ve aynı düzende milyonluk tutar. Eski kodda tablo 956 / 985 px, kutu 953 px (Bakiye'nin "B"si kesik).
const genis = [];
for (const [ad, fiyat] of [["Ayşe Demir", 5000], ["Milyon Yapı", 500000]]) {
  const kisi = await must(`cari ${ad}`, api.post("/api/workspace/accounts", { name: ad, type: "customer", registeredOn: "2026-01-01" }));
  await must(`fatura ${ad}`, api.post("/api/workspace/invoices", { kind: "sale", accountId: kisi.id, issueDate: "2026-11-10", dueDate: "2026-12-10", lines: [{ itemId: urun.id, goods: true, name: "Köşe Kabin 90", code: "KK-90", qty: 2, unitPrice: fiyat, vatRate: 20, description: "Banyo kapısı 90x190, şeffaf temperli cam, krom profil" }, { name: "Montaj", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
  const kart = await must(`taksit ${ad}`, api.post("/api/workspace/plans", { name: ad, registeredOn: "2026-11-10", total: String(fiyat * 2.4 + 1200), accountId: kisi.id, mode: "auto", count: "3", firstDue: "2026-12-10", coversBalance: true }));
  await must(`taksit tahsilatı ${ad}`, api.post(`/api/workspace/plans/${kart.id}/entries`, { kind: "in", amount: "2000", method: "cash", date: "2026-11-12" }));
  await must(`taksit tahsilatı 2 ${ad}`, api.post(`/api/workspace/plans/${kart.id}/entries`, { kind: "in", amount: "1500", method: "cash", date: "2026-11-13" }));
  await must(`tahsilat ${ad}`, api.post(`/api/workspace/accounts/${kisi.id}/entries`, { kind: "in", amount: "500", method: "cash", date: "2026-11-14" }));
  genis.push({ ad, id: kisi.id });
}
await must("muhasebe", api.post("/api/admin/users", { username: "muhasebe247", name: "Muhasebe Kişisi", role: "muhasebe", password: "Muhasebe-2026!", mustChangePassword: false }));

const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const MAIN = `${TOP} [data-rc-main]`;
const kurus = text => {
  const match = /^(-?)([\d.]+),(\d{2})/.exec(String(text ?? "").replace(/−/g, "-").replace("₺", "").trim());
  return match ? Number(`${match[2].replace(/\./g, "")}${match[3]}`) * (match[1] ? -1 : 1) : null;
};
async function login(context, username, password) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.accounts?.open && window.HOF?.reportCenter?.open);
  return page;
}
const style = { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" };
const newContext = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(css => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), css))), style);
  return context;
};
// Cari kartı → "Ayrıntılı Ekstre" (gerçek tıklama); tablo hazır olana kadar bekler.
async function openDetail(page, accountId = cari.id) {
  await page.evaluate(id => window.HOF.accounts.open(id), accountId);
  await page.waitForSelector(`${TOP} [data-act="detailStatement"]`, { state: "visible" });
  await page.click(`${TOP} [data-act="detailStatement"]`);
  await page.waitForSelector(`${MAIN}[aria-busy="false"] .hof-rc-table tbody tr.is-item`, { timeout: 20000 });
}
const read = page =>
  page.evaluate(sel => {
    const node = document.querySelector(sel);
    const heads = [...node.querySelectorAll(".hof-rc-table thead th")].map(th => th.textContent.trim());
    const rows = [...node.querySelectorAll(".hof-rc-table tbody tr")].map(tr => ({ cls: tr.className, cells: [...tr.children].map(td => td.textContent.trim()) }));
    const totals = [...node.querySelectorAll(".hof-rc-table tfoot tr")].map(tr => [...tr.children].map(td => td.textContent.trim()));
    const boxes = [...node.querySelectorAll("[data-rc-cols] input[data-col]")].map(input => ({ name: input.dataset.col, checked: input.checked }));
    return { scope: node.querySelector(".hof-rc-scope")?.textContent.trim() || "", heads, rows, totals, boxes, open: node.querySelector("[data-rc-cols]")?.open === true, summary: node.querySelector("[data-rc-cols] > summary")?.textContent.trim() || "", pdf: node.querySelector(".hof-rep-out.is-pdf")?.getAttribute("href") || "", xlsx: node.querySelector(".hof-rep-out.is-xlsx")?.getAttribute("href") || "" };
  }, MAIN);
// Bir kolonun işaretini gerçek tıklamayla değiştirir; yeni sonuç gelene kadar bekler (sunucuya kayıt + ön izleme).
async function toggleColumn(page, name) {
  const before = await page.$$eval(`${MAIN} .hof-rc-table thead th`, ths => ths.length);
  const response = page.waitForResponse(res => res.url().includes("/report-center/cari-ekstre/columns") && res.request().method() === "PUT", { timeout: 15000 });
  await page.click(`${MAIN} [data-rc-cols] input[data-col="${name}"]`);
  const res = await response;
  await page.waitForFunction(({ sel, count }) => document.querySelector(sel)?.getAttribute("aria-busy") === "false" && document.querySelectorAll(`${sel} .hof-rc-table thead th`).length !== count, { sel: MAIN, count: before }, { timeout: 15000 }).catch(() => null);
  return res.status();
}
const sumMoves = (view, name) => {
  const at = view.heads.indexOf(name);
  return view.rows.filter(row => !row.cls.includes("is-item")).reduce((total, row) => total + (kurus(row.cells[at]) || 0), 0);
};

try {
  const context = await newContext();
  const page = await login(context, "admin", PASS);

  console.log("1) Cari kartı → Ayrıntılı Ekstre: alt başlık, İşlem, açıklama, Kalem Açıklaması (5, 6b)");
  await openDetail(page);
  let view = await read(page);
  await page.screenshot({ path: path.join(SHOTS, "01-ayrintili-ekstre-247.png") });
  ok(/^Cari No \d+ · 01\.01\.2026 – 31\.12\.2026$/.test(view.scope), `alt başlık yalnız Cari No + aralık: “${view.scope}”`);
  const at = name => view.heads.indexOf(name);
  const invoiceRow = view.rows.find(row => row.cls.includes("is-invoice"));
  ok(invoiceRow?.cells[at("İşlem")] === "Satış", `İşlem: ${invoiceRow?.cells[at("İşlem")]}`);
  ok(invoiceRow?.cells[at("Açıklama / Ürün - Hizmet")] === `Satış ${fis.number}` && /^FIS/.test(fis.number), `açıklama: ${invoiceRow?.cells[at("Açıklama / Ürün - Hizmet")]}`);
  ok(!view.rows.some(row => row.cells.some(cell => /Faturası/.test(cell))), "ekranda 'Faturası' yok");
  ok(at("Kalem Açıklaması") === at("Açıklama / Ürün - Hizmet") + 1, `Kalem Açıklaması kolonu (${view.heads.join(" | ")})`);
  const kabin = view.rows.find(row => row.cls.includes("is-item") && row.cells[at("Açıklama / Ürün - Hizmet")].startsWith("› Köşe Kabin 90"));
  const montaj = view.rows.find(row => row.cls.includes("is-item") && row.cells[at("Açıklama / Ürün - Hizmet")] === "› Montaj");
  ok(kabin?.cells[at("Kalem Açıklaması")] === ACIKLAMA && montaj?.cells[at("Kalem Açıklaması")] === "", "açıklamalı kalemde metin, açıklamasızda boş");
  ok(!view.rows.some(row => row.cells.some(cell => cell.includes("STOKNOTU247"))), "stok kartı notu ekranda yok");
  const indent = await page.$eval(`${MAIN} .hof-rc-table tbody tr.is-item td.is-indent`, td => ({ pad: parseFloat(getComputedStyle(td).paddingLeft), text: td.textContent.trim() })).catch(() => null);
  ok(indent && indent.pad >= 18 && indent.text.startsWith("›"), `kalem adı girintili (${indent?.pad}px, ${indent?.text})`);
  ok(view.summary === "Sütunlar" && view.boxes.length === 16 && view.boxes.every(box => box.checked), `Sütunlar: ${view.summary}, ${view.boxes.length} kolon hepsi işaretli`);

  console.log("1b) 1366 × 768: 16 kolon (Kalem Açıklaması dahil) yatay kaydırmasız");
  {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(300);
    const fit = await page.evaluate(sel => {
      const box = document.querySelector(`${sel} .hof-rc-table`);
      return { scroll: box.scrollWidth, client: box.clientWidth };
    }, MAIN);
    await page.screenshot({ path: path.join(SHOTS, "01b-1366-16-kolon.png") });
    ok(fit.scroll <= fit.client + 1, `1366 px: yatay kaydırma yok (tablo ${fit.scroll} px, kutu ${fit.client} px)`);
    for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) await escClose(page, { step: "1366 kapat" });
    for (const kisi of genis) {
      await openDetail(page, kisi.id);
      await page.waitForTimeout(300);
      const wide = await page.evaluate(sel => {
        const box = document.querySelector(`${sel} .hof-rc-table`);
        const heads = [...box.querySelectorAll("thead th")].map(th => th.textContent.trim());
        const rows = [...box.querySelectorAll("tbody tr")].map(tr => [...tr.children].map(td => td.textContent.trim()));
        const last = [...box.querySelectorAll("tbody tr:not(.is-item) td:last-child")].at(-1);
        const edge = last ? Math.round(last.getBoundingClientRect().right - box.getBoundingClientRect().right) : null;
        return { scroll: box.scrollWidth, client: box.clientWidth, heads, rows, edge };
      }, MAIN);
      await page.screenshot({ path: path.join(SHOTS, `01c-1366-${kisi.ad.replace(/\s+/g, "-")}.png`) });
      const at = name => wide.heads.indexOf(name);
      ok(wide.heads.length === 16 && wide.rows.some(row => row[at("İşlem")] === "Taksit Planı (mevcut borç)") && wide.rows.filter(row => row[at("İşlem")] === "Taksit Tahsilatı").length === 2, `${kisi.ad}: gezinti verisi (16 kolon, taksit planı + 2 taksit tahsilatı)`);
      ok(wide.scroll <= wide.client + 1 && wide.edge !== null && wide.edge <= 1, `${kisi.ad} 1366 px: yatay taşma yok, son Bakiye hücresi kutuda (tablo ${wide.scroll} px, kutu ${wide.client} px, sağ kenar farkı ${wide.edge} px)`);
      ok(wide.rows.some(row => /^FIS\d{13}$/.test(row[at("Belge No")])) && wide.rows.some(row => /^Satış FIS\d{13}$/.test(row[at("Açıklama / Ürün - Hizmet")])), `${kisi.ad}: Belge No ve açıklama metni değişmedi (bölme yalnız görünümde)`);
      for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) await escClose(page, { step: "1366 kapat" });
    }
    await openDetail(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);
  }

  console.log("2) Sütunlar → Yol ve Kalem Açıklaması işaretini kaldır (gerçek tıklama); liste açık kalır");
  await page.click(`${MAIN} [data-rc-cols] > summary`);
  await page.waitForSelector(`${MAIN} [data-rc-cols][open] input[data-col="Yol"]`, { state: "visible" });
  await page.screenshot({ path: path.join(SHOTS, "02-sutunlar-acik.png") });
  ok((await toggleColumn(page, "Yol")) === 200, "Yol gizlendi (PUT 200)");
  view = await read(page);
  ok(view.open, "Sütunlar listesi yenilenen ön izlemede açık kaldı");
  ok((await toggleColumn(page, "Kalem Açıklaması")) === 200, "Kalem Açıklaması gizlendi (PUT 200)");
  view = await read(page);
  await page.screenshot({ path: path.join(SHOTS, "03-iki-kolon-gizli.png") });
  ok(!view.heads.includes("Yol") && !view.heads.includes("Kalem Açıklaması") && view.heads.length === 14, `ekran kolonları: ${view.heads.join(" | ")}`);
  ok(view.summary === "Sütunlar (14/16)", `düğme: ${view.summary}`);
  const labelAt = view.heads.indexOf("Açıklama / Ürün - Hizmet");
  const grand = view.totals.find(row => row[labelAt] === "GENEL TOPLAM");
  ok(grand && kurus(grand[view.heads.indexOf("Borç")]) === sumMoves(view, "Borç") && kurus(grand[view.heads.indexOf("Alacak")]) === sumMoves(view, "Alacak"), "Genel Toplam = satırlar (Borç, Alacak)");
  const indent2 = await page.$eval(`${MAIN} .hof-rc-table tbody tr.is-item td.is-indent`, td => td.textContent.trim()).catch(() => "");
  ok(indent2.startsWith("›"), "kolon gizliyken de girinti kalem adında");

  console.log("3) Ekrandaki PDF ve Excel bağlantıları: gizli kolonlar dosyalarda da yok");
  const xlsx = await api.raw("GET", view.xlsx);
  const sheet = xlsxRows(xlsx.buffer);
  const headerAt = sheet.findIndex(row => row[0] === "Tarih");
  ok(xlsx.status === 200 && JSON.stringify(sheet[headerAt]) === JSON.stringify(view.heads), `Excel başlıkları = ekran (${(sheet[headerAt] || []).length})`);
  ok(sheet.slice(headerAt + 1).length === view.rows.length + view.totals.length, "Excel satırı = ekran + TOPLAM");
  ok(!sheet.flat().some(cell => String(cell).includes("temperli")), "Excel'de gizli Kalem Açıklaması yok");
  const pdf = await api.raw("GET", view.pdf);
  const lines = pdfText(pdf.buffer).split("\n");
  ok(pdf.status === 200 && !lines.includes("Yol") && !lines.includes("Nakit") && !lines.some(line => line.includes("temperli")), "PDF'te Yol / Nakit / kalem açıklaması yok");
  ok(lines.includes(`Satış ${fis.number}`) || lines.join(" ").includes(`Satış ${fis.number}`), "PDF'te açıklama 'Satış FIS…'");

  console.log("4) Son kolonun işareti kaldırılamaz");
  let lastStatus = 0;
  for (const name of view.boxes.filter(box => box.checked && box.name !== "Bakiye").map(box => box.name)) lastStatus = await toggleColumn(page, name);
  view = await read(page);
  ok(lastStatus === 200 && JSON.stringify(view.heads) === JSON.stringify(["Bakiye"]), `yalnız Bakiye kaldı (${view.heads.join(" | ")})`);
  const puts = [];
  const watch = request => request.url().includes("/report-center/cari-ekstre/columns") && puts.push(request.method());
  page.on("request", watch);
  await page.click(`${MAIN} [data-rc-cols] input[data-col="Bakiye"]`);
  const toast = await page.waitForSelector(".hof-toasts", { state: "attached", timeout: 5000 }).then(() => page.waitForFunction(() => /En az bir sütun görünür kalmalı/.test(document.querySelector(".hof-toasts")?.textContent || ""), null, { timeout: 5000 }).then(() => true)).catch(() => false);
  await page.waitForTimeout(300);
  page.off("request", watch);
  const stillChecked = await page.$eval(`${MAIN} [data-rc-cols] input[data-col="Bakiye"]`, input => input.checked);
  ok(toast && stillChecked && puts.length === 0, `uyarı çıktı (${toast}), Bakiye işaretli kaldı (${stillChecked}), sunucuya istek gitmedi (${puts.length})`);
  await page.screenshot({ path: path.join(SHOTS, "04-son-kolon.png") });
  // Geri: yalnız Tarih, Belge No, İşlem, Açıklama, Borç, Alacak, Bakiye açılır (sonraki adımın seçimi).
  for (const name of ["Tarih", "İşlem", "Açıklama / Ürün - Hizmet", "Borç", "Alacak"]) await toggleColumn(page, name);
  view = await read(page);
  ok(JSON.stringify(view.heads) === JSON.stringify(["Tarih", "İşlem", "Açıklama / Ürün - Hizmet", "Borç", "Alacak", "Bakiye"]), `seçim: ${view.heads.join(" | ")}`);
  for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) await escClose(page, { step: "kapat" });

  console.log("5) Sayfa yeniden açılınca seçim kalır (sunucuda, kişi başına)");
  await page.reload();
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.accounts?.open && window.HOF?.reportCenter?.open);
  await openDetail(page);
  view = await read(page);
  ok(JSON.stringify(view.heads) === JSON.stringify(["Tarih", "İşlem", "Açıklama / Ürün - Hizmet", "Borç", "Alacak", "Bakiye"]) && view.summary === "Sütunlar (6/16)", `yeniden açılışta: ${view.heads.join(" | ")} · ${view.summary}`);
  await page.screenshot({ path: path.join(SHOTS, "05-yeniden-acilis.png") });
  await page.close();
  await context.close();

  console.log("6) Başka kullanıcı (muhasebe): bütün kolonlar");
  const other = await newContext();
  const mu = await login(other, "muhasebe247", "Muhasebe-2026!");
  await openDetail(mu);
  const theirs = await read(mu);
  ok(theirs.heads.length === 16 && theirs.boxes.every(box => box.checked), `muhasebenin ekranı ${theirs.heads.length} kolon`);
  await other.close();
} catch (error) {
  failed += 1;
  console.log(`  ✗ HATA: ${error.message}`);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" / ")}` : ""}`);
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exitCode = failed ? 1 : 0;
