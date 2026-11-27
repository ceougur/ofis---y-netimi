// 2.5.1 Mİ-1 — EKRAN: Cari Listesi'nin Taksit sütununda geciken taksitin numarası ve taksit kartı penceresinde boşluksuz numara.
// KULLANICI 27.11 (AYNEN): "geciken taksit gününü gösteriyor ya programımız; 20 gün gecikti vb diyorya onun yanına parantez içinde 2. taksit yazılabilirmi hangi
// taksit geciktiyse o yazılacak". BAŞ MİMAR KARARI (c): listede yazan numara = kartta görünen numara, boşluksuz.
// Gerçek tıklama + klavye (Enter ile satırdan kart açılır) + insan hızı (slowMo; ders 12); pencere seçicisi en üstteki görünür pencere (ders 39); tarihler koşu gününe
// göre (ders 13); lisans servisi yok (ders 30). BEKLENENLER ELLE (ders 5):
//   Ayşe: 3 taksit (ilk vade 75 gün önce, aylık), 1. taksit ödendi → satır "… · N gün gecikti (2. taksit)".
//   Burak: 3 taksit, 1. taksit SİLİNDİ (saklanan sıra 2, 3) → satır "(1. taksit)"; kart penceresinde satırlar "1." ve "2." (eski kod "2.", "3.").
//   Cem: ilk vade 5 gün sonra → satır "… · sıradaki taksit", parantez YOK.
// Çalıştırma: node test/e2e/senaryo-mi1-251.mjs   (eski kod: DEPO=<eski kök> node <bu dosya>)
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { createApp } = await imp("server/app.mjs");
const { buildXlsx } = await imp("server/lib/xlsx-write.mjs");
const { escClose } = await import(pathToFileURL(path.join(HERE, "esc-kapat.mjs")).href);

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-mi1-251");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-mi1-"));
const pad = n => String(n).padStart(2, "0");
const iso = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startXlsx = path.join(root, "baslangic.xlsx");
writeFileSync(startXlsx, buildXlsx([{ name: "Kayıtlar", columns: ["Ad Soyad", "Telefon"], rows: [{ "Ad Soyad": "Örnek Kişi", Telefon: "0532 000 00 09" }] }], { title: "Kayıtlar" }));

const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ slowMo: 40 });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
page.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
});
let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${pad(shotNo)}-${name}.png`) });
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const api = (method, url, body) =>
  page.evaluate(
    async ([method, url, body]) => {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => null);
      return { status: res.status, data: json && "ok" in json ? json.data ?? json : json };
    },
    [method, url, body],
  );
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const rowText = async name => page.evaluate(([sel, name]) => [...document.querySelectorAll(`${sel} tr[data-account]`)].find(row => row.textContent.includes(name))?.querySelector("td:last-child")?.textContent.replace(/\s+/g, " ").trim() || "", [TOP, name]);

try {
  console.log("\n■ Kurulum: yönetici girer, başlangıç tablosu yüklenir");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-start .hof-drop");
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(startXlsx);
  await page.waitForSelector(`${MODAL} .hof-mapping`, { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${MODAL} [data-mode="replace"]`)]);
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => escClose(page));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  await must("banka kurulumu geç", api("POST", "/api/workspace/bank/setup/dismiss", {}));

  console.log("\n■ Veri (programın kendi uçları): üç cari, üç taksit kartı");
  const cari = async name => must(`cari ${name}`, api("POST", "/api/workspace/accounts", { name, type: "customer", registeredOn: iso(-200), phone: `0532 251 00 ${pad(name.length)}` }));
  const kart = async (acc, firstDue) => must(`kart ${acc.name}`, api("POST", "/api/workspace/plans", { name: acc.name, registeredOn: iso(-120), total: "3000", accountId: acc.id, mode: "auto", count: "3", firstDue, everyMonths: "1" }));
  const ayse = await cari("Ayşe Mİ Deneme");
  const burak = await cari("Burak Mİ Deneme");
  const cem = await cari("Cem Mİ Deneme");
  const ka = await kart(ayse, iso(-75));
  const kb = await kart(burak, iso(-75));
  await kart(cem, iso(5));
  await must("Ayşe 1. taksit tahsilatı", api("POST", `/api/workspace/plans/${ka.id}/entries`, { kind: "in", amount: "1000", method: "cash", date: iso(0), cashForce: true, similarOk: true }));
  const burakItems = (await must("Burak kartı", api("GET", `/api/workspace/plans/${kb.id}`))).items;
  await must("Burak 1. taksit sil", api("DELETE", `/api/workspace/plans/${kb.id}/items/${burakItems[0].id}`));
  const seqs = app.store.all("SELECT seq FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", kb.id).map(row => row.seq);
  ok(JSON.stringify(seqs) === "[2,3]", `veri tabanı: Burak'ın kartında saklanan sıra ${JSON.stringify(seqs)} (beklenen [2,3] — boşluk ön koşulu)`);

  console.log("\n■ 1. Cari Listesi (yan menüden gerçek tıklama): Taksit sütunu");
  await closeAll();
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`${TOP} tr[data-account]`, { timeout: 15000 });
  await page.waitForTimeout(500);
  const a = await rowText("Ayşe Mİ Deneme");
  const b = await rowText("Burak Mİ Deneme");
  const c = await rowText("Cem Mİ Deneme");
  await shot("cari-listesi");
  ok(/\d+ gün gecikti \(2\. taksit\)$/.test(a), `Ayşe: "${a}" (beklenen "… gün gecikti (2. taksit)")`);
  ok(/\d+ gün gecikti \(1\. taksit\)$/.test(b), `Burak: "${b}" (beklenen "… gün gecikti (1. taksit)" — silinen taksitten sonra boşluk yok)`);
  ok(/sıradaki taksit$/.test(c) && !/\(/.test(c), `Cem: "${c}" (beklenen "… · sıradaki taksit", parantez yok)`);

  console.log("\n■ 2. Burak'ın cari kartı (satıra odaklan + Enter) → taksit kartı penceresi");
  await page.focus(`${TOP} tr[data-account="${burak.id}"]`);
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${TOP} [data-open-plan="${kb.id}"]`, { timeout: 15000 });
  await page.click(`${TOP} tr[data-open-plan="${kb.id}"]`);
  await page.waitForSelector(`${TOP} tr[data-item]`, { timeout: 15000 });
  await page.waitForTimeout(400);
  const numbers = await page.evaluate(sel => [...document.querySelectorAll(`${sel} tr[data-item]`)].map(row => row.querySelector("td")?.textContent.trim()), TOP);
  await shot("burak-taksit-karti");
  ok(JSON.stringify(numbers) === JSON.stringify(["1.", "2."]), `kart penceresinde numaralar ${JSON.stringify(numbers)} (beklenen ["1.","2."]; eski kod ["2.","3."])`);
  const firstLabel = await page.evaluate(sel => document.querySelector(`${sel} tr[data-item] [data-delete-item]`)?.getAttribute("aria-label") || "", TOP);
  ok(firstLabel === "1. taksiti sil", `ilk satırın sil düğmesi "${firstLabel}" (beklenen "1. taksiti sil")`);
  await closeAll();
  ok(!errors.length, `sayfada JavaScript hatası yok${errors.length ? `: ${errors.join(" ; ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata").catch(() => null);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\nSenaryo Mİ-1 (geciken taksitin numarası): ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
