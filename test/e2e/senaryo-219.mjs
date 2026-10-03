// Senaryo 2.0.19 — müşteri bildirimi (03.10.2026): "Cari → Excel / Sheets’ten Yükle diyince çekmiyor".
// Kök neden: 2.0.18'de "Tablodan Al" kalkarken eşleme penceresinde tanımsız `caseKeys` kaldı → pencere açılmadan
// JavaScript hatası (ReferenceError), toplu cari yükleme hiç çalışmıyordu. Bu senaryo dört toplu yüklemeyi (Cari, Stok,
// Taksit, Çek / Senet) arayüzden, sıfırdan, Excel dosyası VE Google Sheets bağlantısıyla yürütür; sayıları denetler.
// Çalıştırma: npm run test:senaryo-219
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-219");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-219-"));
const xlsx = (file, name, columns, rows) => {
  const target = path.join(root, file);
  writeFileSync(target, buildXlsx([{ name, columns, rows }], { title: name }));
  return target;
};
const iso = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const tr = value => value.split("-").reverse().join(".");

// ---------- Veri ----------
// Cari Excel: aynı adlı iki kişi (telefonları farklı → iki ayrı cari), açılış bakiyeli ve bakiyesiz, ek alan (Veli).
const ACCOUNTS = [
  { "Ad Soyad": "Ayşe Kaya", Telefon: "0532 111 22 33", Grup: "Merkez", "Açılış Bakiyesi": "1.250,50", Veli: "Hasan Kaya" },
  { "Ad Soyad": "Ayşe Kaya", Telefon: "0533 444 55 66", Grup: "Şube", "Açılış Bakiyesi": "", Veli: "Mehmet Kaya" },
  { "Ad Soyad": "Can Öztürk", Telefon: "0535 777 88 99", Grup: "Merkez", "Açılış Bakiyesi": "3.000", Veli: "" },
  { "Ad Soyad": "Deniz Ak", Telefon: "", Grup: "", "Açılış Bakiyesi": "", Veli: "Selin Ak" },
];
const accountsXlsx = xlsx("cariler.xlsx", "Cariler", ["Ad Soyad", "Telefon", "Grup", "Açılış Bakiyesi", "Veli"], ACCOUNTS);
// Google Sheets (sahte sunucu): üç yeni cari.
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Sahte219Cariler/edit#gid=0";
const SHEET_CSV = "Ad Soyad,Telefon,Açılış Bakiyesi\nEmre Yıldız,0536 100 20 30,500\nFatma Şahin,0537 200 30 40,\nGökhan Demir,0538 300 40 50,750\n";
const stockXlsx = xlsx("stok.xlsx", "Stok", ["Stok Kodu", "Ürün Adı", "Birim", "Miktar", "Alış Fiyatı", "Satış Fiyatı"], [
  { "Stok Kodu": "U-1", "Ürün Adı": "Çelik Raf", Birim: "Adet", Miktar: "10", "Alış Fiyatı": "400", "Satış Fiyatı": "650" },
  { "Stok Kodu": "U-2", "Ürün Adı": "Ahşap Masa", Birim: "Adet", Miktar: "4", "Alış Fiyatı": "1.200", "Satış Fiyatı": "1.900" },
]);
const plansXlsx = xlsx("taksit.xlsx", "Taksit", ["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], [
  { "Ad Soyad": "Hakan Çelik", Telefon: "0539 111 00 11", "Toplam Tutar": "6.000", "Taksit Sayısı": "6", "İlk Vade": tr(iso(10)) },
  { "Ad Soyad": "İpek Arslan", Telefon: "0539 222 00 22", "Toplam Tutar": "2.400", "Taksit Sayısı": "3", "İlk Vade": tr(iso(20)) },
]);
const chequesXlsx = xlsx("cek.xlsx", "Çekler", ["Çek No", "Keşideci", "Banka", "Tutar", "Vade Tarihi"], [
  { "Çek No": "A-1001", Keşideci: "Can Öztürk", Banka: "Ziraat", Tutar: "2.500", "Vade Tarihi": tr(iso(30)) },
  { "Çek No": "A-1002", Keşideci: "Yabancı Firma", Banka: "Akbank", Tutar: "4.000", "Vade Tarihi": tr(iso(45)) },
]);
const startXlsx = xlsx("baslangic.xlsx", "Kayıtlar", ["Ad Soyad", "Telefon"], [{ "Ad Soyad": "Örnek Kişi", Telefon: "0532 000 00 01" }]);

// Google'a gitmeden Sheets: düzenleme sayfası yok (500) → program sekme 0'ın CSV'sini indirir.
const fetchImpl = async (url, options) => {
  const target = String(url);
  if (target.startsWith("https://docs.google.com/")) {
    if (/\/edit/.test(target)) return new Response("", { status: 500 });
    return new Response(SHEET_CSV, { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
  }
  return globalThis.fetch(url, options);
};

const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, fetchImpl, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f94" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
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
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const call = url => page.evaluate(async url => (await (await fetch(url)).json()).data, url);
const toasts = () => page.evaluate(() => [...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" | "));
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(modal)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
};
const newErrors = (() => {
  let seen = 0;
  return () => {
    const fresh = errors.slice(seen);
    seen = errors.length;
    return fresh;
  };
})();

// Modülü aç → "Excel / Sheets’ten Yükle" → kaynak seç → eşleme penceresi (.hof-import-form) açılmalı.
async function openImport(action, source) {
  await closeAll();
  await page.click(`#hof-sidecard [data-action="${action}"]`);
  await page.waitForSelector(`${top} [data-act="import"]`, { timeout: 15000 });
  await page.click(`${top} [data-act="import"]`);
  await page.waitForSelector(`${top} [data-src="excel"]`);
  if (source.file) {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click(`${top} [data-src="excel"]`)]);
    await chooser.setFiles(source.file);
  } else {
    await page.fill(`${top} [data-src-form] input[name="url"]`, source.url);
    await page.click(`${top} [data-src-form] button[type="submit"]`);
  }
  const opened = await page.waitForSelector(`${top} .hof-import-form`, { timeout: 15000 }).then(() => true, () => false);
  const fresh = newErrors();
  ok(opened && !fresh.length, `${action}: eşleme penceresi açıldı${fresh.length ? ` — HATA: ${fresh.join(" ; ")}` : opened ? "" : ` — açılmadı (${await toasts()})`}`);
  return opened;
}
async function submitImport(pattern) {
  await page.waitForTimeout(500); // doğrulama kapısı (satır raporu) yerleşsin
  await page.click(`${top} .hof-import-form button[type="submit"]`);
  const done = await page.waitForFunction(re => new RegExp(re).test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), pattern.source, { timeout: 30000 }).then(() => true, () => false);
  const text = await toasts();
  ok(done, `sonuç bildirimi: ${text.split(" | ").filter(Boolean).at(-1) || "yok"}`);
}

try {
  console.log("\n■ Kurulum: yönetici girer, başlangıç tablosu yüklenir");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-start .hof-drop");
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(startXlsx);
  await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => page.keyboard.press("Escape"));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  newErrors();
  ok((await call("/api/workspace/accounts?status=all&limit=50")).total === 0, "başlangıçta cari yok (boş veri)");

  console.log("\n■ 1. Cari → Excel / Sheets’ten Yükle → Excel dosyası (müşterinin şikâyeti)");
  if (await openImport("accounts", { file: accountsXlsx })) {
    const roles = await page.$$eval(`${top} .hof-import-form select[name^="c"]`, nodes => nodes.map(node => node.value));
    ok(JSON.stringify(roles) === JSON.stringify(["name", "phone", "group", "balance", "extra"]), `kolonlar tanındı: ${roles.join(", ")}`);
    const intro = await page.$eval(`${top} .hof-import-form`, node => node.innerText);
    ok(/4 satır bulundu/.test(intro) && !/tablodaki kaydına/.test(intro), "pencere: 4 satır bulundu; kayda bağlama yazısı yok");
    await shot("cari-excel-esleme");
    await submitImport(/4 cari açıldı/);
    const list = await call("/api/workspace/accounts?status=all&limit=50");
    ok(list.total === 4, `cari listesinde ${list.total} cari (beklenen 4)`);
    const ayse = list.accounts.filter(item => item.name === "Ayşe Kaya");
    ok(ayse.length === 2 && new Set(ayse.map(item => item.phone)).size === 2, `aynı adlı iki kişi iki ayrı cari (${ayse.map(item => item.phone).join(" · ")})`);
    const first = ayse.find(item => /111/.test(item.phone));
    ok(first && Math.abs(first.balance - 1250.5) < 0.005, `Ayşe Kaya (0532…) açılış bakiyesi ${first?.balance} (beklenen 1.250,50)`);
    const can = list.accounts.find(item => item.name === "Can Öztürk");
    ok(can && Math.abs(can.balance - 3000) < 0.005, `Can Öztürk açılış bakiyesi ${can?.balance} (beklenen 3.000)`);
    const deniz = list.accounts.find(item => item.name === "Deniz Ak");
    ok(deniz && deniz.balance === 0, `Deniz Ak (telefonsuz, bakiyesiz) açıldı, bakiye ${deniz?.balance}`);
    const extra = (first?.extra || []).map(item => `${item.label}=${item.value}`).join(", ");
    ok(/Veli=Hasan Kaya/.test(extra), `ek alan kartta: ${extra || "yok"}`);
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].some(node => node.querySelector("tr[data-account]")), null, { timeout: 10000 }).catch(() => null);
    const rows = await page.evaluate(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].reduce((sum, node) => sum + node.querySelectorAll("tr[data-account]").length, 0));
    ok(rows === 4, `Cari penceresinde ${rows} satır görünüyor`);
    await shot("cari-excel-sonuc");
  }

  // Kural (eşleme penceresindeki açıklama): aynı cari = aynı Cari No + ad ya da aynı ad + aynı telefon; emin olunamayan
  // (telefonsuz, Cari No'suz) satır yeni cari açar → Deniz Ak yeniden açılır, telefonlu üç kişi atlanır.
  console.log("\n■ 2. Aynı Excel ikinci kez (Aynı cari zaten varsa: Atla) → telefonlu kişiler çift açılmaz");
  if (await openImport("accounts", { file: accountsXlsx })) {
    await submitImport(/1 cari açıldı.*3 satır atlandı/);
    const list = await call("/api/workspace/accounts?status=all&limit=50");
    const names = list.accounts.map(item => item.name);
    ok(list.total === 5 && names.filter(name => name === "Ayşe Kaya").length === 2 && names.filter(name => name === "Can Öztürk").length === 1, `ikinci yüklemeden sonra ${list.total} cari; Ayşe Kaya 2, Can Öztürk 1 (çift yok)`);
    ok(names.filter(name => name === "Deniz Ak").length === 2, "telefonsuz Deniz Ak kurala göre yeniden açıldı (emin olunamayan satır)");
  }

  console.log("\n■ 3. Cari → Excel / Sheets’ten Yükle → Google Sheets bağlantısı");
  if (await openImport("accounts", { url: SHEET_URL })) {
    await shot("cari-sheets-esleme");
    await submitImport(/3 cari açıldı/);
    const list = await call("/api/workspace/accounts?status=all&limit=50");
    ok(list.total === 8, `cari listesinde ${list.total} cari (beklenen 8)`);
    const emre = list.accounts.find(item => item.name === "Emre Yıldız");
    ok(emre && Math.abs(emre.balance - 500) < 0.005 && /100 20 30/.test(emre.phone), `Emre Yıldız: bakiye ${emre?.balance}, telefon ${emre?.phone}`);
  }

  console.log("\n■ 4. Stok → Excel / Sheets’ten Yükle");
  if (await openImport("stock", { file: stockXlsx })) {
    await submitImport(/2 ürün|2 kalem|2 stok/);
    const stock = await call("/api/workspace/stock?limit=50");
    const raf = (stock.items || []).find(item => item.name === "Çelik Raf");
    ok((stock.items || []).length === 2 && raf?.qty === 10, `stokta ${(stock.items || []).length} ürün; Çelik Raf ${raf?.qty} Adet`);
  }

  console.log("\n■ 5. Taksitler → Excel / Sheets’ten Yükle");
  if (await openImport("plans", { file: plansXlsx })) {
    await submitImport(/2 (taksit )?kart/);
    const plans = await call("/api/workspace/plans?status=all&limit=50");
    const list = plans.plans || [];
    const hakan = list.find(item => item.name === "Hakan Çelik");
    ok(list.length === 2 && hakan && Math.abs(hakan.totals.total - 6000) < 0.005 && hakan.itemCount === 6, `${list.length} taksit kartı; Hakan Çelik toplam ${hakan?.totals.total}, ${hakan?.itemCount} taksit`);
  }

  console.log("\n■ 6. Çek / Senet → Excel / Sheets’ten Yükle");
  if (await openImport("cheques", { file: chequesXlsx })) {
    await submitImport(/2 evrak portföye alındı/);
    const cheques = await call("/api/workspace/cheques?status=all&limit=50");
    const list = cheques.cheques || cheques.items || [];
    ok(list.length === 2, `portföyde ${list.length} evrak`);
  }

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
console.log(`\nSenaryo 2.0.19: ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
