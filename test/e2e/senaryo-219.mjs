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
import { escClose } from "./esc-kapat.mjs";

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
// 2.0.22 madde 3 (Excel denetimi bulgusu): Tür kolonunda iki türü birden yazan ("Müşteri/Tedarikçi") ve tanınmayan değer.
const TYPED = [
  { "Ad Soyad": "Tür Müşteri", Telefon: "0541 000 00 01", Tür: "Müşteri", "Açılış Bakiyesi": "100" },
  { "Ad Soyad": "Tür Tedarikçi", Telefon: "0541 000 00 02", Tür: "Tedarikçi", "Açılış Bakiyesi": "100" },
  { "Ad Soyad": "Tür İkisi", Telefon: "0541 000 00 03", Tür: "Müşteri/Tedarikçi", "Açılış Bakiyesi": "100" },
  { "Ad Soyad": "Tür Garip", Telefon: "0541 000 00 04", Tür: "xyz", "Açılış Bakiyesi": "100" },
];
const typedXlsx = xlsx("cari-tur.xlsx", "Cariler", ["Ad Soyad", "Telefon", "Tür", "Açılış Bakiyesi"], TYPED);
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
// 2.4.8 I1 (yanıt kaybı + yeniden bas): Cari No'suz ve telefonsuz cariler (eşleşme kuralı tanıyamaz), no'suz çekler (ikisi tek "Can Öztürk" carisine bağlanır).
const idAccountsXlsx = xlsx("cari-kimlik.xlsx", "Cariler", ["Ad Soyad", "Açılış Bakiyesi"], [
  { "Ad Soyad": "Kimlik Bir", "Açılış Bakiyesi": "1.000" },
  { "Ad Soyad": "Kimlik İki", "Açılış Bakiyesi": "2.500,50" },
  { "Ad Soyad": "Kimlik Üç", "Açılış Bakiyesi": "" },
]);
const idChequesXlsx = xlsx("cek-kimlik.xlsx", "Çekler", ["Keşideci", "Banka", "Tutar", "Vade Tarihi"], [
  { Keşideci: "Can Öztürk", Banka: "Ziraat", Tutar: "700", "Vade Tarihi": tr(iso(40)) },
  { Keşideci: "Can Öztürk", Banka: "Akbank", Tutar: "200", "Vade Tarihi": tr(iso(50)) },
  { Keşideci: "Kimlik Yabancı Firma", Banka: "", Tutar: "250", "Vade Tarihi": tr(iso(60)) },
]);
const idStockXlsx = xlsx("stok-kimlik.xlsx", "Stok", ["Ürün Adı", "Birim", "Miktar"], [
  { "Ürün Adı": "Kimlik Dolap", Birim: "Adet", Miktar: "3" },
  { "Ürün Adı": "Kimlik Sandalye", Birim: "Adet", Miktar: "12" },
]);
// 2.4.8 I1 dar kontrol ORTA-1: yanıt kaybından sonra seçenek değiştirilip yeniden basılan cari yüklemesi (409 iletisi).
const optionAccountsXlsx = xlsx("cari-secenek.xlsx", "Cariler", ["Ad Soyad", "Açılış Bakiyesi"], [
  { "Ad Soyad": "Seçenek Bir", "Açılış Bakiyesi": "1.000" },
  { "Ad Soyad": "Seçenek İki", "Açılış Bakiyesi": "2.500,50" },
  { "Ad Soyad": "Seçenek Üç", "Açılış Bakiyesi": "" },
]);
const idPlansXlsx = xlsx("taksit-kimlik.xlsx", "Taksit", ["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], [
  { "Ad Soyad": "Kimlik Kerem", Telefon: "0539 333 00 33", "Toplam Tutar": "3.000", "Taksit Sayısı": "3", "İlk Vade": tr(iso(15)) },
  { "Ad Soyad": "Kimlik Leyla", Telefon: "0539 444 00 44", "Toplam Tutar": "1.200", "Taksit Sayısı": "2", "İlk Vade": tr(iso(25)) },
]);

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
    await escClose(page);
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
// 2.4.8 I1: "Yükle"ye basılır; ilk istek sunucuya ulaşır ve YAZILIR, yanıtı tarayıcıya ulaşmaz (ağ kopması, senaryo-224 2c düzeni). Pencere açık kalır,
// kullanıcı yeniden basar. Dönüş: iki gönderimin istek kimlikleri, ilk hatanın ekrandaki metni, ilk gönderimden hemen sonraki sayı, son bildirim.
const MODAL_TOP = `${modal}:nth-last-child(1 of ${modal})`;
async function lostResponseRetry(pathName, countNow) {
  const isImport = url => new URL(url).pathname === pathName;
  const headers = [];
  let dropped = false;
  await page.route(isImport, async route => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    headers.push(request.headers()["x-hof-request"] || "");
    if (dropped) return route.continue();
    dropped = true;
    await route.fetch(); // istek sunucuya ulaşır ve yazılır; yanıt tarayıcıya ulaşmaz
    return route.abort("connectionreset");
  });
  try {
    for (const button of await page.$$(".hof-toast .hof-toast-close")) await button.click().catch(() => null);
    await page.waitForTimeout(500); // doğrulama kapısı (satır raporu) yerleşsin
    await page.click(`${MODAL_TOP} .hof-import-form button[type="submit"]`);
    let firstError = "";
    for (let i = 0; i < 40 && !firstError; i += 1) {
      await page.waitForTimeout(250);
      firstError = await page.$eval(`${MODAL_TOP} .hof-import-form .hof-form-error`, node => node.textContent.trim()).catch(() => "");
    }
    const afterFirst = await countNow();
    await shot("i1-yanit-kayboldu");
    await page.click(`${MODAL_TOP} .hof-import-form button[type="submit"]`);
    const toast = await page
      .waitForFunction(() => [...document.querySelectorAll(".hof-toast .hof-toast-text")].map(node => node.textContent.trim()).find(text => /açıldı|alındı|oluşturuldu|kaydedildi/.test(text)) || "", null, { timeout: 30000 })
      .then(handle => handle.jsonValue(), () => "");
    await page.waitForTimeout(400);
    return { headers, firstError, afterFirst, toast };
  } finally {
    await page.unroute(isImport);
  }
}
const sameRequest = headers => headers.length === 2 && /^[0-9a-f]{32}$/.test(headers[0]) && headers[0] === headers[1];
const ledgerNow = async () => {
  const ledger = await call("/api/workspace/ledger");
  return { tb: Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance])), debit: ledger.trial.totals.debit, entries: ledger.entryCount };
};
const round2 = value => Math.round(value * 100) / 100;
const dbCount = (sql, ...args) => app.store.get(sql, ...args).n;

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
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => escClose(page));
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

  console.log("\n■ 3b. (2.0.22) Tür kolonunda “Müşteri/Tedarikçi” ve tanınmayan değer → Tür Değerleri'nden seçim");
  if (await openImport("accounts", { file: typedXlsx })) {
    const box = `${top} .hof-import-form .hof-type-values`;
    const shown = await page.waitForSelector(`${box}:not([hidden]) select[data-type-key]`, { timeout: 10000 }).then(() => true, () => false);
    const rows = shown ? await page.$$eval(`${box} tbody tr`, nodes => nodes.map(node => ({ text: node.cells[0].innerText.replace(/\s+/g, " ").trim(), warn: node.classList.contains("is-warning"), value: node.querySelector("select").value }))) : [];
    const by = Object.fromEntries(rows.map(row => [row.text.replace(/ (İki Tür Birden|Tanınmadı)$/, ""), row]));
    ok(shown && rows.length === 4, `Tür Değerleri tablosu: ${rows.map(row => `${row.text} → ${row.value || "Varsayılan"}`).join(" · ") || "yok"}`);
    ok(by["Müşteri"]?.value === "customer" && by["Tedarikçi"]?.value === "supplier" && !by["Müşteri"]?.warn, "tek türü açık yazan değerler kendi türüyle, uyarısız");
    ok(/İki Tür Birden/.test(by["Müşteri/Tedarikçi"]?.text || "") && by["Müşteri/Tedarikçi"]?.warn && by["Müşteri/Tedarikçi"]?.value === "", "“Müşteri/Tedarikçi” işaretli (İki Tür Birden), türü seçilmemiş — sessizce Tedarikçi değil");
    ok(/Tanınmadı/.test(by.xyz?.text || "") && by.xyz?.warn, "“xyz” işaretli (Tanınmadı)");
    const gateText = await page.$eval(`${top} .hof-import-form .hof-gate`, node => node.innerText).catch(() => "");
    ok(/2 uyarı/.test(gateText), `satır raporunda 2 tür uyarısı (${gateText.split("\n")[0]})`);
    await shot("cari-tur-degerleri");
    await page.selectOption(`${box} select[data-type-key="musteri tedarikci"]`, "supplier");
    const refreshed = await page.waitForFunction(sel => /1 uyarı/.test(document.querySelector(sel)?.innerText || ""), `${top} .hof-import-form .hof-gate`, { timeout: 10000 }).then(() => true, () => false);
    ok(refreshed, "seçim yapılınca o değerin uyarısı kalktı (1 uyarı kaldı: xyz)");
    // Gözden geçirme bulgusu 7 (2.0.22): tanınan değer için "Varsayılan Tür" seçimi etkisizdi (Tedarikçi olarak açılıyordu).
    await page.selectOption(`${box} select[data-type-key="tedarikci"]`, "");
    await page.waitForTimeout(800);
    await shot("cari-tur-secildi");
    await submitImport(/4 cari açıldı.*türü belirsizdi, Müşteri olarak açıldı \(satır 5\)/);
    const list = await call("/api/workspace/accounts?status=all&limit=50&q=T%C3%BCr");
    const type = name => list.accounts.find(item => item.name === name);
    ok(type("Tür İkisi")?.type === "supplier" && type("Tür İkisi")?.balance === -100, `Tür İkisi: ${type("Tür İkisi")?.type}, bakiye ${type("Tür İkisi")?.balance} (seçilen Tedarikçi; açılış alacak)`);
    ok(type("Tür Garip")?.type === "customer" && type("Tür Garip")?.balance === 100, `Tür Garip: ${type("Tür Garip")?.type} (varsayılan Müşteri, raporlandı)`);
    ok(type("Tür Müşteri")?.type === "customer", "açık yazılan tür aynen (Müşteri)");
    ok(type("Tür Tedarikçi")?.type === "customer", `“Tedarikçi” değeri için Varsayılan Tür seçildi → ${type("Tür Tedarikçi")?.type} (Tür kolonu yoksa: Müşteri)`);
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

  // ---------- 2.4.8 I1: içe aktarma istek kimliği (yanıt kaybolur, kullanıcı yeniden basar) ----------
  // Bağımsız beklenen (dosyadan elle): cari 3 kişi, açılış 1.000 + 2.500,50 = 3.500,50 (120 Alıcılar); çek 3 evrak 700 + 200 + 250 = 1.150 (101), "Cariye işle"
  // ile Can Öztürk'ün borcu 3.000 − 900 = 2.100; stok 2 ürün (3 + 12 Adet); taksit 2 kart. Önceden ikinci basış cari / evrakı ve bakiyeyi ikinci kez yazıyordu.
  const notice = "Bu yükleme zaten kaydedildi; ikinci kez yazılmadı. İlk yükleme: ";
  // Dar kontrol I1 ORTA-1: yanıt gelmeyince pencere kullanıcıyı "kapatmadan yeniden bas"a yönlendirir (yeni pencere yeni kimlik → ikinci yükleme).
  const LOST = "Sunucuya ulaşılamadı. Ağ bağlantısını kontrol edin. Yükleme sunucuda kaydedilmiş olabilir; pencereyi kapatmadan yeniden basın, ikinci kez yazılmaz.";
  console.log("\n■ 7. (2.4.8 I1) Cari Excel: yanıt kaybolur, yeniden “Carileri Oluştur” → tek yükleme, açılış bakiyesi bir kez");
  if (await openImport("accounts", { file: idAccountsXlsx })) {
    const count = () => dbCount("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name LIKE 'Kimlik %'");
    const l0 = await ledgerNow();
    const run = await lostResponseRetry("/api/workspace/accounts/import", count);
    ok(run.afterFirst === 3 && run.firstError === LOST, `ilk basış sunucuda yazıldı (${run.afterFirst} cari), yanıt kayboldu; pencere açık, yeniden basmaya yönlendirir: "${run.firstError}"`);
    ok(sameRequest(run.headers), `iki gönderim aynı istek kimliğiyle: ${run.headers.map(h => h || "(kimlik yok)").join(" · ")}`);
    ok(count() === 3, `cari sayısı ${count()} (beklenen 3; ikinci basış yeni cari açmamalı)`);
    ok(dbCount("SELECT COUNT(*) AS n FROM account_entries e JOIN accounts a ON a.id = e.account_id WHERE a.name LIKE 'Kimlik %' AND e.is_opening = 1") === 2, "açılış bakiyesi 2 satır (bir kez)");
    const list = await call("/api/workspace/accounts?status=all&limit=50&q=Kimlik");
    const sum = round2(list.accounts.filter(item => item.name.startsWith("Kimlik ")).reduce((total, item) => total + item.balance, 0));
    ok(sum === 3500.5, `Kimlik carilerinin bakiyesi ${sum} (beklenen 3.500,50 Borçlu)`);
    const l1 = await ledgerNow();
    ok(round2((l1.tb["120"] ?? 0) - (l0.tb["120"] ?? 0)) === 3500.5, `120 Alıcılar +${round2((l1.tb["120"] ?? 0) - (l0.tb["120"] ?? 0))} (beklenen +3.500,50, bir kez)`);
    ok(run.toast === `${notice}3 cari açıldı, 2 açılış bakiyesi yazıldı.`, `ekran bildirimi: "${run.toast}"`);
    await shot("i1-cari-yeniden");
  }
  console.log("\n■ 8. (2.4.8 I1) Çek / Senet Excel + “Cariye işle”: yanıt kaybolur, yeniden “Portföye Al” → tek yükleme, cari bir kez");
  if (await openImport("cheques", { file: idChequesXlsx })) {
    await page.check(`${MODAL_TOP} .hof-import-form input[name="post"]`);
    const count = () => dbCount("SELECT COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL AND (drawer = 'Can Öztürk' AND serial_no = '' OR drawer = 'Kimlik Yabancı Firma')");
    const can = async () => (await call("/api/workspace/accounts?status=all&limit=50&q=Can%20%C3%96zt%C3%BCrk")).accounts.find(item => item.name === "Can Öztürk");
    const before_ = await can();
    const l0 = await ledgerNow();
    const run = await lostResponseRetry("/api/workspace/cheques/import", count);
    ok(run.afterFirst === 3 && run.firstError === LOST, `ilk basış sunucuda yazıldı (${run.afterFirst} evrak), yanıt kayboldu; pencere açık, yeniden basmaya yönlendirir: "${run.firstError}"`);
    ok(sameRequest(run.headers), `iki gönderim aynı istek kimliğiyle: ${run.headers.map(h => h || "(kimlik yok)").join(" · ")}`);
    ok(count() === 3, `evrak sayısı ${count()} (beklenen 3; ikinci basış yeni evrak açmamalı)`);
    const after_ = await can();
    ok(before_?.balance === 3000 && after_?.balance === 2100, `Can Öztürk bakiyesi ${before_?.balance} → ${after_?.balance} (beklenen 3.000 → 2.100; evrak cariye bir kez)`);
    const l1 = await ledgerNow();
    ok(round2((l1.tb["101"] ?? 0) - (l0.tb["101"] ?? 0)) === 1150, `101 Alınan Çekler +${round2((l1.tb["101"] ?? 0) - (l0.tb["101"] ?? 0))} (beklenen +1.150, bir kez)`);
    ok(run.toast === `${notice}3 evrak portföye alındı, 2 cariye bağlandı, 2 cari hareketi yazıldı.`, `ekran bildirimi: "${run.toast}"`);
    await shot("i1-cek-yeniden");
  }
  console.log("\n■ 9. (2.4.8 I1) Stok Excel: yanıt kaybolur, yeniden “Ürünleri Oluştur” → ilk yüklemenin bildirimi (önceden “0 ürün açıldı”)");
  if (await openImport("stock", { file: idStockXlsx })) {
    const count = () => dbCount("SELECT COUNT(*) AS n FROM stock_items WHERE deleted_at IS NULL AND name LIKE 'Kimlik %'");
    const run = await lostResponseRetry("/api/workspace/stock/import", count);
    ok(run.afterFirst === 2 && run.firstError === LOST, `ilk basış sunucuda yazıldı (${run.afterFirst} ürün), yanıt kayboldu; pencere açık, yeniden basmaya yönlendirir: "${run.firstError}"`);
    ok(sameRequest(run.headers), `iki gönderim aynı istek kimliğiyle: ${run.headers.map(h => h || "(kimlik yok)").join(" · ")}`);
    ok(count() === 2 && dbCount("SELECT COUNT(*) AS n FROM stock_moves m JOIN stock_items i ON i.id = m.item_id WHERE i.name LIKE 'Kimlik %' AND m.is_opening = 1") === 2, `2 ürün, açılış stoku bir kez (${count()} ürün)`);
    ok(run.toast === `${notice}2 ürün açıldı, 2 ürüne açılış stoku yazıldı.`, `ekran bildirimi: "${run.toast}"`);
  }
  console.log("\n■ 10. (2.4.8 I1) Taksit Excel: yanıt kaybolur, yeniden “Kartları Oluştur” → ilk yüklemenin bildirimi, tek aktarım");
  if (await openImport("plans", { file: idPlansXlsx })) {
    const count = () => dbCount("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND name LIKE 'Kimlik %'");
    const imports0 = dbCount("SELECT COUNT(*) AS n FROM plan_imports");
    const run = await lostResponseRetry("/api/workspace/plans/import", count);
    ok(run.afterFirst === 2 && run.firstError === LOST, `ilk basış sunucuda yazıldı (${run.afterFirst} kart), yanıt kayboldu; pencere açık, yeniden basmaya yönlendirir: "${run.firstError}"`);
    ok(sameRequest(run.headers), `iki gönderim aynı istek kimliğiyle: ${run.headers.map(h => h || "(kimlik yok)").join(" · ")}`);
    ok(count() === 2 && dbCount("SELECT COUNT(*) AS n FROM plan_imports") === imports0 + 1, `2 kart, tek aktarım kaydı (${count()} kart)`);
    ok(run.toast === `${notice}2 kart oluşturuldu. Yanlışsa Son Aktarımlar’dan geri alınır.`, `ekran bildirimi: "${run.toast}"`);
  }
  console.log("\n■ 11. (2.4.8 I1, dar kontrol ORTA-1) Cari Excel: yanıt kaybolur, “Tür kolonu yoksa” değiştirilip yeniden basılır → 409; ileti ilk yüklemeyi söyler, dosyayı yeniden yüklemeye yönlendirmez");
  if (await openImport("accounts", { file: optionAccountsXlsx })) {
    const count = () => dbCount("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name LIKE 'Seçenek %'");
    const openings = () => dbCount("SELECT COUNT(*) AS n FROM account_entries e JOIN accounts a ON a.id = e.account_id WHERE a.name LIKE 'Seçenek %' AND e.is_opening = 1");
    const isImport = url => new URL(url).pathname === "/api/workspace/accounts/import";
    const headers = [];
    let dropped = false;
    await page.route(isImport, async route => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();
      headers.push(request.headers()["x-hof-request"] || "");
      if (dropped) return route.continue();
      dropped = true;
      await route.fetch(); // yazılır; yanıt tarayıcıya ulaşmaz
      return route.abort("connectionreset");
    });
    const formError = () => page.$eval(`${MODAL_TOP} .hof-import-form .hof-form-error`, node => node.textContent.trim()).catch(() => "");
    try {
      await page.waitForTimeout(500);
      await page.click(`${MODAL_TOP} .hof-import-form button[type="submit"]`);
      let lost = "";
      for (let i = 0; i < 40 && !lost; i += 1) {
        await page.waitForTimeout(250);
        lost = await formError();
      }
      ok(count() === 3 && openings() === 2 && lost === LOST, `ilk basış yazıldı (${count()} cari, ${openings()} açılış), yanıt kayboldu: "${lost}"`);
      await page.selectOption(`${MODAL_TOP} .hof-import-form select[name="type"]`, "supplier");
      await page.waitForTimeout(400);
      await page.click(`${MODAL_TOP} .hof-import-form button[type="submit"]`);
      let conflict = "";
      for (let i = 0; i < 40 && (!conflict || conflict === lost); i += 1) {
        await page.waitForTimeout(250);
        conflict = await formError();
      }
      await shot("i1-409-secenek-degisti");
      ok(sameRequest(headers), `iki gönderim aynı istek kimliğiyle: ${headers.map(h => h || "(kimlik yok)").join(" · ")}`);
      ok(count() === 3 && openings() === 2, `seçenek değişince yazım yok (${count()} cari, ${openings()} açılış; beklenen 3 / 2)`);
      ok(
        conflict === "İlk yükleme (önceki seçeneklerle) kaydedildi: 3 cari açıldı, 2 açılış bakiyesi yazıldı; ikinci kez yazılmadı. Cari listesini kontrol edin. Dosyayı yeniden yüklerseniz Cari No'suz ya da telefonsuz satırlar ikinci kez açılır; değişikliği cari kartlarında yapın.",
        `409 iletisi ilk yüklemeyi söyler, dosyayı yeniden yüklemeye yönlendirmez: "${conflict}"`,
      );
    } finally {
      await page.unroute(isImport);
    }
    await closeAll();
    const list = await call("/api/workspace/accounts?status=all&limit=50&q=Se%C3%A7enek");
    const types = list.accounts.filter(item => item.name.startsWith("Seçenek ")).map(item => item.type);
    ok(types.length === 3 && types.every(type => type === "customer"), `ilk yükleme önceki seçenekle (Müşteri) kayıtlı: ${types.join(", ")}`);
  }

  const integrity = await call("/api/workspace/ledger/integrity");
  ok(integrity?.ok === true, `mutabakat (ana defter ↔ Kasa/Cari/Stok/Taksit/Çek) tutarlı${integrity?.ok ? "" : `: ${JSON.stringify(integrity?.failures).slice(0, 300)}`}`);

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
