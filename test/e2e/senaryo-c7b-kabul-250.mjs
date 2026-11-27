// 2.5.0 Ç7b tur 2f EKRANDAN — kabul G (docs/devir/2.5.0-DEVAM/c7b2-istem.txt 'Kabul koşulları' G; docs/erp/C7B-FATURA-TASARIM.md §2.1, §2.2, §11, §13, §15.1). Gerçek tıklama + klavye (Tab,
// Boşluk) + insan hızı (ders 12); sahte saat (sunucu ve sayfa, 10.12.2026 — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39). Veri v2.4.9'un GERÇEK
// koduyla API'den (ders 17), sonra güncel kod aynı klasörde açılır (güncelleme). BEKLENENLER ELLE (ders 5):
//   Eylül (v2.4.9'da kilitlenir, 30.09.2026): Kasa + 300 · Kasa − 200 · Borç Yaz 500 · veresiye stok satışı 4 × 300 = 1.200 · taksit Yeni Borç 6.000 · ihracat E1 5.000 (%0, 301) · satış S1 10.000 +
//     2.000 · alış P1 1.000 + 200. Ekim (açık): Kasa + 400 · S2 3.000 + 600 · P2 1.000 + 200. Kasım: S3 2.000 + 400 · P3 500 + 100.
//   A) Kural Farkı Düzeltme penceresi: 6 kayıt (Kasa ±, Borç Yaz, veresiye satış, Yeni Borç, ihracat); fiş satırları B 649 300 · A 649.90 300 · A 770 200 · B 770.90 200 · B 602 6.500 ·
//      A 602.90 500 · B 600 6.200 · A 600.90 7.200 · A 601 5.000 + Toplam 13.200 / 13.200; onay kutusu Tab + Boşluk; Fişi Kaydet → Mutabakat satırında "Düzeltildi".
//   B) Yevmiye Defteri, Hesap Planı Mizanı, KDV Özeti — HER süzgeç seçeneğinde (Bu Ay, Geçen Ay, Son 30 Gün, Bu Yıl, Tüm Zamanlar) TOPLAM = satırlar; Yevmiye'de .90 alt hesapları (649.90,
//      770.90, 602.90, 600.90) ve 601 görünür; Hesap Planı Mizanı'nda 601 Yurt Dışı Satışlar 5.000 Alacak; KDV Özeti KDV sütunu Bu Yıl 3.000 + 500 = 3.500, Geçen Ay 400 + 100 = 500,
//      Bu Ay ve Son 30 Gün boş (ipucu).
//   C) Banka → Alt Hesap Mizanı: banka / evrak alt hesapları; .90 alt hesapları YOK (BAŞ MİMAR KARARI B-10 = B).
//   D) Telefon genişliği (390 px): KDV Özeti açılır, sayfa yatay kaymaz, TOPLAM görünür.
//   E) Kartı Kapat (YB-1): kart 900 (3 × 300). E0: kart penceresi açıkken ikinci oturum 100 TL tahsilat girer → pencere canlı olayla KENDİNİ yeniler (Kalan ₺800,00; v2.0.22'den beri
//      — eskimiş onay bu yüzden "pencere açıkken" kurgusuyla OLUŞMAYABİLİR, Ç7b aday düzeltme turu). E: ön koşul ZORLA (ders 20): "Kalan ₺800,00" sorusu EKRANDAYKEN ikinci oturum 300
//      TL tahsilat girer (veri tabanında okunur) → onay sunucuda reddedilir (409 plan-close-stale; yanıt ağdan okunur), pencere "Kalan ₺500,00" ile yeniden sorar, kart kapanır.
// Çıkış: "N geçti, M kaldı"; GÖZLEM satırları (sayılmaz) ayrıca yazılır.
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { installPageClock, ADMIN_PASSWORD } = await imp("test/helpers.mjs");
const { CURRENT, bootVersion, tagsAvailable } = await imp("test/guvenilirlik/surumler.mjs");

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-c7b-kabul-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
if (!tagsAvailable(["v2.4.9"])) {
  console.log("✗ senaryo-c7b-kabul-250: v2.4.9 etiketi yok (git fetch --tags) — 0 geçti, 1 kaldı");
  process.exit(1);
}
const NOW = { time: "2026-12-10T12:00:00+03:00", fixed: true };
const LOCK = "2026-09-30";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-c7b-kabul-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

// ---- v2.4.9'un gerçek koduyla eski veri ----
{
  const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
  try {
    const api = await old.login();
    const M1 = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", registeredOn: "2026-08-01" }))).id;
    const T1 = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı Kırtasiye", type: "supplier", registeredOn: "2026-08-01" }))).id;
    await must("Kasa +", api.post("/api/workspace/cash", { kind: "in", amount: "300", method: "cash", date: "2026-09-02", description: "Hurda satışı" }));
    await must("Kasa −", api.post("/api/workspace/cash", { kind: "out", amount: "200", method: "cash", date: "2026-09-02", description: "Çay ocağı" }));
    await must("Borç Yaz", api.post(`/api/workspace/accounts/${M1}/entries`, { kind: "debt", amount: "500", date: "2026-09-03", note: "Hizmet bedeli" }));
    const item = await must("ürün", api.post("/api/workspace/stock", { name: "Vida Kutusu", unit: "Adet", kind: "product", code: "VK-1", unitPrice: "100", vatRate: "20" }));
    const itemId = item.id || item.item?.id;
    await must("alım", api.post(`/api/workspace/stock/${itemId}/moves`, { date: "2026-09-04", kind: "in", qty: "10", unitPrice: "100", pay: "account", accountId: T1, note: "Açık hesap alım" }));
    await must("veresiye", api.post(`/api/workspace/stock/${itemId}/moves`, { date: "2026-09-04", kind: "out", qty: "4", unitPrice: "300", pay: "account", accountId: M1, note: "Veresiye satış" }));
    await must("Yeni Borç", api.post("/api/workspace/plans", { accountId: M1, name: "Ayşe Taksit", total: "6.000", registeredOn: "2026-09-05", mode: "auto", count: 3, firstDue: "2027-01-05" }));
    const sale = (date, price, extra = {}) => must(`satış ${date}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M1, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: price, vatRate: 20, ...extra }], payment: { rest: "open" } }));
    let n = 0;
    const buy = (date, price) => must(`alış ${date}`, api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T1, issueDate: date, number: `TK-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: price, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }));
    await sale("2026-09-10", 10000);
    await must("ihracat", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M1, issueDate: "2026-09-11", lines: [{ name: "Yurt Dışı Danışmanlık", qty: 1, unitPrice: 5000, vatRate: 0, exemptionCode: "301" }], payment: { rest: "open" } }));
    await buy("2026-09-13", 1000);
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    await must("Kasa + Ekim", api.post("/api/workspace/cash", { kind: "in", amount: "400", method: "cash", date: "2026-10-02", description: "Hurda satışı" }));
    await sale("2026-10-05", 3000);
    await buy("2026-10-06", 1000);
    await sale("2026-11-03", 2000);
    await buy("2026-11-04", 500);
  } finally {
    await old.close();
  }
}

const server = await bootVersion(CURRENT, { ...dirs, now: NOW });
const app = server.app;
const BASE = server.base;
const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const notes = [];
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const note = (cond, what) => {
  if (!cond) notes.push(what);
  console.log(`  ${cond ? "·" : "!"} GÖZLEM ${cond ? "(sorun yok)" : "(ürün davranışı — raporda)"}: ${what}`);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const topSel = `${MODAL}:nth-last-child(1 of ${MODAL})`;
let page = null;
let shotNo = 0;
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true }).catch(() => null);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata");
  }
};
const human = () => page.waitForTimeout(250);
const tl = text => {
  const clean = String(text || "").replace(/[^\d,−-]/g, "").replace(",", ".");
  return clean ? Number(clean.replace("−", "-")) : 0;
};
async function login(context) {
  const p = await context.newPage();
  p.setDefaultTimeout(20000);
  p.on("pageerror", error => errors.push(error.message));
  await installPageClock(p, app.config.now);
  await p.goto(`${BASE}/`);
  await p.fill("#hof-auth input[name=username]", "admin");
  await p.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([p.waitForEvent("load"), p.click('#hof-auth button[type="submit"]')]);
  await p.waitForSelector("#hof-sidecard", { timeout: 60000 });
  return p;
}
async function systemLine() {
  await page.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]');
  await page.waitForFunction(() => /^Mutabakat/.test(document.querySelector("#adm-integrity-status")?.textContent || ""), null, { timeout: 60000 });
  await page.$eval("#adm-integrity-status", node => node.scrollIntoView({ block: "center" }));
  await human();
  return (await page.textContent("#adm-integrity-status")).replace(/\s+/g, " ").trim();
}
async function openReport(id, { phone = false } = {}) {
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  // Telefonda yan menü görünür alanın dışında (bugünkü düzen; senaryo-banka-210 da pencereyi programın kendi açıcısıyla açar) — düğmenin kendi tıklaması.
  if (phone) await page.$eval('#hof-sidecard [data-action="analytics"]', node => node.click());
  else await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${MODAL} [data-rc-list] [data-report="${id}"]`);
  await human();
  await page.click(`${MODAL} [data-rc-list] [data-report="${id}"]`);
  await ready();
}
async function ready() {
  await page.waitForFunction(sel => {
    const main = document.querySelector(`${sel} [data-rc-main]`);
    return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table, .hof-rc-summary, .hof-empty") && !/Rapor hazırlanıyor/.test(main.innerText);
  }, MODAL, { timeout: 30000 });
  await human();
}
const table = async () => {
  const cells = selector => page.$$eval(selector, rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent.trim())));
  const body = await cells(`${MODAL} [data-rc-main] .hof-rc-table tbody tr`);
  // Boş dönem: tabloda tek hücreli ipucu satırı ("Bu dönemde kayıt yok …") ya da .hof-empty.
  const hint = body.length === 1 && body[0].length === 1;
  return { body: hint ? [] : body, foot: await cells(`${MODAL} [data-rc-main] .hof-rc-table tfoot tr`), empty: hint || Boolean(await page.$(`${MODAL} [data-rc-main] .hof-empty`)) };
};
/** KDV Özeti: belge yönü başına TOPLAM satırı (UX24) — "TOPLAM Satış" KDV = o türdeki satırların KDV'si. 2.5.1 M1: altta Önceki Dönemden Devreden / Ödenecek / Sonraki Döneme
 * Devreden KDV (senaryoda KDV mahsup fişi yok → devreden 0; her ayın sonucu ayın net KDV'si: satış − satıştan iade − alış + alıştan iade); tek ayda Ödenecek − Sonraki = net. */
const KDV_RESULTS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
function kdvFooterMatch(t, single = false) {
  const sumOf = (kinds, rows = t.body) => rows.filter(row => kinds.includes(row[1])).reduce((sum, row) => sum + tl(row[5]), 0);
  const kinds = { "TOPLAM Satış": ["Satış", "Serbest Meslek Makbuzu"], "TOPLAM Satıştan İade": ["Satıştan İade"], "TOPLAM Alış": ["Alış"], "TOPLAM Alıştan İade": ["Alıştan İade"] };
  const checks = [];
  for (const row of t.foot) {
    const label = row.find(cell => /^TOPLAM |^Net KDV/.test(cell)) || "";
    if (kinds[label]) checks.push([label, Math.abs(sumOf(kinds[label]) - tl(row[5])) < 0.005, `${label} ${tl(row[5])} ↔ satırlar ${sumOf(kinds[label])}`]);
  }
  const netOf = rows => sumOf(kinds["TOPLAM Satış"], rows) - sumOf(kinds["TOPLAM Satıştan İade"], rows) - sumOf(kinds["TOPLAM Alış"], rows) + sumOf(kinds["TOPLAM Alıştan İade"], rows);
  const result = Object.fromEntries(t.foot.filter(row => KDV_RESULTS.includes(row[1])).map(row => [row[1], tl(row[5])]));
  checks.push(["sonuç satırları", KDV_RESULTS.every(label => label in result) && result["Önceki Dönemden Devreden KDV"] === 0, `sonuç ${JSON.stringify(result)} (mahsup yok → önceki 0)`]);
  if (single) checks.push(["tek ay", Math.abs(result["Ödenecek KDV"] - result["Sonraki Döneme Devreden KDV"] - netOf(t.body)) < 0.005, `Ödenecek − Sonraki ${result["Ödenecek KDV"] - result["Sonraki Döneme Devreden KDV"]} ↔ satırlardan ${netOf(t.body)}`]);
  // Ayın sonuç satırı (çok aylı aralıkta, tam aylarda) = ayın net KDV'si (devreden 0).
  for (const row of t.body.filter(item => KDV_RESULTS.includes(item[1]))) {
    const net = netOf(t.body.filter(item => item[0] === row[0]));
    const want = row[1] === "Ödenecek KDV" ? Math.max(0, net) : row[1] === "Sonraki Döneme Devreden KDV" ? Math.max(0, -net) : 0;
    checks.push([`${row[0]} ${row[1]}`, Math.abs(tl(row[5]) - want) < 0.005, `${row[0]} ${row[1]} ${tl(row[5])} ↔ ayın net KDV'si ${net}`]);
  }
  return { ok: checks.length >= 2 && checks.every(item => item[1]), text: checks.map(item => item[2]).join(" · ") || JSON.stringify(t.foot) };
}
/** TOPLAM = satırlar: verilen sütunlarda alt satır = satırların toplamı (kuruşa yuvarlı). */
const totalsMatch = (t, columns) => columns.every(index => Math.abs(t.body.reduce((sum, row) => sum + tl(row[index]), 0) - tl(t.foot[0]?.[index])) < 0.005);
const PRESETS = [["thisMonth", "Bu Ay"], ["lastMonth", "Geçen Ay"], ["last30", "Son 30 Gün"], ["thisYear", "Bu Yıl"], ["all", "Tüm Zamanlar"]];
async function eachPreset(fn) {
  for (const [id, label] of PRESETS) {
    await page.click(`${MODAL} [data-rc-main] .hof-rc-range [data-preset="${id}"]`);
    await ready();
    await fn(id, label, await table());
  }
}

try {
  await app.ledger.snapshots.runPending();
  await app.integrity.scanInBackground().catch(() => null);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await login(context);

  await step("A) Kural Farkı Düzeltme: Ç7b satırları (fiş satırları elle), farkı doğuran 6 kayıt, onay Tab + Boşluk, Fişi Kaydet → Düzeltildi", async () => {
    const line = await systemLine();
    ok(/Kural Değişikliği Farkı/.test(line), `Mutabakat satırında kural farkı uyarısı (${line.slice(0, 160)})`);
    await page.click("#adm-rule-diff-open");
    await page.waitForSelector(`${MODAL} [data-rule-diff-lines]`, { timeout: 60000 });
    await human();
    const dialog = page.locator(topSel);
    const rows = (await dialog.locator("[data-rule-diff-lines] tbody tr").allTextContents()).map(row => row.replace(/\s+/g, " ").trim());
    console.log(`  satırlar: ${rows.join(" | ")}`);
    // Hücre hücre: [Hesap, Hesap Adı, Borç, Alacak] → "B|A hesap tutar".
    const cellRows = await page.$$eval(`${topSel} [data-rule-diff-lines] tbody tr:not(.hof-total)`, trs => trs.map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim())));
    const got = cellRows.map(([code, , debit, credit]) => (debit ? `B ${code} ${tl(debit)}` : `A ${code} ${tl(credit)}`)).sort();
    ok(JSON.stringify(got) === JSON.stringify(["B 649 300", "A 649.90 300", "A 770 200", "B 770.90 200", "B 602 6500", "A 602.90 500", "B 600 6200", "A 600.90 7200", "A 601 5000"].sort()), `fiş satırları elle (${got.join(", ")})`);
    const total = rows.find(row => /Toplam/.test(row)) || "";
    ok((total.match(/[\d.]+,\d{2}/g) || []).map(tl).join("/") === "13200/13200", `Toplam 13.200 / 13.200 (${total})`);
    const sources = (await dialog.locator("[data-rule-diff-sources] tbody tr").allTextContents()).map(row => row.replace(/\s+/g, " ").trim());
    console.log(`  kaynaklar: ${sources.join(" | ")}`);
    ok(sources.length === 6, `farkı doğuran kayıt 6 (${sources.length})`);
    const kasa = sources.find(row => /Hurda satışı/.test(row)) || "";
    note(/649\.90/.test(kasa), `'Farkı Doğuran Kayıtlar'ın 'Hesap Farkı' sütunu alt hesabı göstermiyor — Kasa + satırı: "${kasa}" (ana hesap 649 iki kez, biri −, biri +; hangisinin 649.90 olduğu okunmuyor)`);
    await shot("kural-farki-c7b");
    const save = dialog.locator("[data-rule-diff-save]");
    ok(await save.isDisabled(), "onaysız Fişi Kaydet pasif");
    ok(/onay kutusunu işaretleyin/.test(await dialog.locator("[data-rule-diff-save-why]").textContent()), "pasifliğin nedeni görünür yazı");
    const box = dialog.locator("[data-rule-diff-confirm]");
    let reached = false;
    for (let i = 0; i < 400 && !reached; i += 1) {
      await page.keyboard.press("Tab");
      reached = await box.evaluate(node => document.activeElement === node);
    }
    ok(reached, "onay kutusuna Tab ile ulaşıldı");
    await page.keyboard.press("Space");
    await human();
    ok(!(await save.isDisabled()), "onaydan sonra Fişi Kaydet etkin");
    await save.click();
    await page.waitForFunction(() => /Düzeltildi \(Fiş 2026-\d{6}\)/.test(document.querySelector("#adm-integrity-status")?.textContent || ""), null, { timeout: 60000 });
    ok(app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n === 1, "fiş yazıldı (veri tabanı)");
    await shot("kural-farki-duzeltildi");
  });

  await step("B1) Yevmiye Defteri — her süzgeç: Borç TOPLAM = Alacak TOPLAM = satırlar; .90 alt hesapları ve 601 görünür", async () => {
    await openReport("yevmiye");
    await eachPreset(async (id, label, t) => {
      if (id === "thisMonth" || id === "last30") return ok(t.empty && t.body.length === 0, `${label}: boş dönem (ipucu; elle — 10.11–10.12 arasında kayıt yok)`);
      ok(t.body.length > 0 && totalsMatch(t, [4, 5]) && tl(t.foot[0]?.[4]) === tl(t.foot[0]?.[5]), `${label}: ${t.body.length} satır, TOPLAM Borç ${t.foot[0]?.[4]} = Alacak ${t.foot[0]?.[5]} = satırlar`);
      if (id === "thisYear") {
        const accounts = new Set(t.body.map(row => row[3]));
        ok(["649.90", "770.90", "602.90", "600.90", "601"].every(code => accounts.has(code)), `Bu Yıl: Hesap sütununda 649.90, 770.90, 602.90, 600.90, 601 (${[...accounts].filter(code => /\.90$|^601$/.test(code)).join(", ")})`);
        await shot("yevmiye-bu-yil");
      }
    });
  });

  await step("B2) Hesap Planı Mizanı — her süzgeç: TOPLAM = satırlar; 601 Yurt Dışı Satışlar 5.000 Alacak", async () => {
    await openReport("hesap-mizani");
    await eachPreset(async (id, label, t) => {
      if (id === "thisMonth") return ok(t.empty || totalsMatch(t, [3, 4]), `${label}: TOPLAM = satırlar (boş ay — yalnız devir)`);
      ok(totalsMatch(t, [3, 4]), `${label}: ${t.body.length} hesap, TOPLAM Borç ${t.foot[0]?.[3]} / Alacak ${t.foot[0]?.[4]} = satırlar`);
      if (id === "thisYear") {
        const row = t.body.find(r => r[0] === "601") || [];
        ok(row[1] === "Yurt Dışı Satışlar" && tl(row[5]) === 5000 && row[6] === "Alacak", `601 satırı: ${JSON.stringify(row)}`);
        await shot("hesap-mizani-bu-yil");
      }
    });
  });

  await step("B3) KDV Özeti — her süzgeç: TOPLAM = satırlar; KDV elle (Bu Yıl 3.500, Geçen Ay 500, Bu Ay / Son 30 Gün boş)", async () => {
    await openReport("kdv-ozeti");
    const expectKdv = { thisMonth: 0, lastMonth: 500, last30: 0, thisYear: 3500, all: 3500 };
    await eachPreset(async (id, label, t) => {
      const kdv = t.body.filter(row => !KDV_RESULTS.includes(row[1])).reduce((sum, row) => sum + tl(row[5]), 0);
      if (!expectKdv[id]) return ok(t.empty && t.body.length === 0, `${label}: boş dönem (ipucu)`);
      const foot = kdvFooterMatch(t, id === "thisMonth" || id === "lastMonth");
      ok(foot.ok && Math.abs(kdv - expectKdv[id]) < 0.005, `${label}: ${t.body.length} satır, KDV Σ ${kdv} (elle ${expectKdv[id]}); ${foot.text}`);
    });
    await shot("kdv-ozeti-tum");
  });

  await step("C) Banka → Alt Hesap Mizanı: .90 alt hesapları yok (B-10 = B), TOPLAM satırı", async () => {
    await openReport("alt-hesap-mizani");
    const t = await table();
    const subs = t.body.map(row => row[0]);
    ok(!subs.some(code => /\.90$/.test(code)), `banka Alt Hesap Mizanı'nda .90 alt hesabı yok (${subs.join(", ") || "boş"})`);
  });

  // Ç7b aday düzeltme turu (ders 20, 38): tur 2f'de 34 / 34 olan adım taban kodda 30 / 2 kaldı — ilk soru ZATEN güncel kalanı (600) gösterdi. Neden: kart penceresi
  // "live:workspace.changed" olayıyla kendini yeniler (hof-plans.js refreshOpen; v2.0.22) — ikinci oturumun tahsilatı tıklamadan önce pencereye ulaşırsa eskimiş onay oluşmaz (yarış;
  // ürün davranışı doğru). Ön koşul artık zorla kurulur: tahsilat SORU EKRANDAYKEN girilir (closePlan kalanı sorudan önce okumuştur); 409'un geldiği ağdan okunur — yeşil yalnız
  // ön koşulun GERÇEKTEN oluştuğu koşuda sayılır.
  await step("E) Kartı Kapat — eskimiş 'Kalan' onayı (YB-1): pencere kendini yeniler (E0); soru ekrandayken tahsilat girilir → onay reddedilir, GÜNCEL kalanla yeniden sorulur, kart kapanır", async () => {
    const api = await server.login();
    const accountId = app.store.get("SELECT id FROM accounts WHERE name = 'Ayşe Kaya'").id;
    const created = await must("kart", api.post("/api/workspace/plans", { accountId, name: "Ayşe Kapanış Kartı", total: "900", registeredOn: "2026-11-01", mode: "auto", count: 3, firstDue: "2026-12-01" }));
    const planId = created.id || created.plan?.id;
    const entries = () => app.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", planId).n;
    const kpi = async () => ((await page.textContent(".hof-plans .hof-plans-kpis .hof-cash-balance strong").catch(() => "")) || "").replace(/\s+/g, " ");
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.click('#hof-sidecard [data-action="plans"]');
    await page.waitForSelector(`.hof-plans-table tbody tr[data-plan="${planId}"]`, { timeout: 15000 });
    await human();
    await page.click(`.hof-plans-table tbody tr[data-plan="${planId}"]`);
    await page.waitForSelector('.hof-plans [data-act="close"]', { timeout: 15000 });
    ok(/₺900,00/.test(await kpi()), `kart penceresi Kalan ₺900,00: ${await kpi()}`);
    // E0 — pencere açıkken ikinci oturum 100 TL tahsilat girer: pencere canlı olayla kendini yeniler (iyi davranış).
    await must("tahsilat 100 (ikinci oturum)", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "100", date: "2026-12-10", method: "cash" }));
    const refreshed = await page.waitForFunction(() => /₺800,00/.test(document.querySelector(".hof-plans .hof-plans-kpis .hof-cash-balance strong")?.textContent || ""), null, { timeout: 15000 }).then(() => true, () => false);
    ok(refreshed, `E0: pencere ikinci oturumun tahsilatından sonra kendini yeniler (Kalan ₺800,00): ${await kpi()}`);
    await human();
    const puts = [];
    const onResponse = res => {
      if (res.request().method() === "PUT" && res.url().includes(`/api/workspace/plans/${encodeURIComponent(planId)}`)) puts.push(res.status());
    };
    page.on("response", onResponse);
    try {
      await page.click('.hof-plans [data-act="close"]');
      await page.waitForSelector(`${topSel} [data-answer="yes"]`, { timeout: 10000 });
      const first = ((await page.textContent(topSel)) || "").replace(/\s+/g, " ");
      ok(/Kalan ₺800,00/.test(first), `ilk soru penceredeki kalanla: ${first.slice(0, 140)}`);
      // Ön koşul ZORLA: soru ekrandayken ikinci oturum 300 TL tahsilat girer — sorunun kalanı (800) eskir. Veri tabanında okunur (ders 3).
      const n0 = entries();
      await must("tahsilat 300 (ikinci oturum, soru ekrandayken)", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "300", date: "2026-12-10", method: "cash" }));
      ok(entries() === n0 + 1, "ön koşul: tahsilat soru ekrandayken yazıldı (veri tabanı)");
      await human();
      console.log("    [soru] \"Kartı Kapat\" → Kartı Kapat (eskimiş kalanla — sunucu reddetmeli; ders 34)");
      await page.click(`${topSel} [data-answer="yes"]`);
      await page.waitForFunction(sel => /Kalan ₺500,00/.test(document.querySelector(sel)?.textContent || ""), topSel, { timeout: 15000 });
      const second = ((await page.textContent(topSel)) || "").replace(/\s+/g, " ");
      ok(/Kalan ₺500,00/.test(second), `yeniden soru GÜNCEL kalanla: ${second.slice(0, 140)}`);
      ok(puts.length === 1 && puts[0] === 409, `ilk onay sunucuda reddedildi (409; gelen ${JSON.stringify(puts)}) — ön koşul oluştu`);
      ok(app.store.get("SELECT status FROM plans WHERE id = ?", planId).status === "active", "reddedilen ilk onay kartı kapatmadı (veri tabanı)");
      await shot("kart-kapat-yeniden-soru");
      console.log("    [soru] \"Kartı Kapat\" → Kartı Kapat (güncel kalan 500 — beklenen soru)");
      await page.click(`${topSel} [data-answer="yes"]`);
      await page.waitForSelector('.hof-plans [data-act="reopen"]', { timeout: 15000 });
      ok(app.store.get("SELECT status FROM plans WHERE id = ?", planId).status === "closed", "kart kapandı (veri tabanı)");
      ok(puts.length === 2 && puts[1] === 200, `ikinci onay 200 (gelen ${JSON.stringify(puts)})`);
    } finally {
      page.off("response", onResponse);
    }
    await page.keyboard.press("Escape");
  });

  await step("D) Telefon genişliği (390 px): KDV Özeti açılır, sayfa yatay kaymaz, TOPLAM görünür", async () => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "tr-TR", isMobile: true, hasTouch: true });
    await phone.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const desk = page;
    page = await login(phone);
    try {
      await openReport("kdv-ozeti", { phone: true });
      await page.click(`${MODAL} [data-rc-main] .hof-rc-range [data-preset="thisYear"]`);
      await ready();
      const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      ok(width.scroll <= width.inner + 1, `sayfa yatay kaymıyor (scrollWidth ${width.scroll} ≤ ${width.inner})`);
      const foot = page.locator(`${MODAL} [data-rc-main] .hof-rc-table tfoot tr`).first();
      ok(await foot.isVisible(), "TOPLAM satırı görünür");
      await shot("kdv-ozeti-telefon");
    } finally {
      await page.close();
      await phone.close();
      page = desk;
    }
  });
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata");
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  if (notes.length) console.log(`\nGÖZLEM (${notes.length}): ${notes.join(" || ")}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-c7b-kabul-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
