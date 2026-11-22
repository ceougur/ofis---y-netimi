// 2.5.0 S223 = A + S228 = A — kabul G (EKRAN): Excel'de BÜYÜK HARFLE yazılan kişi var olan carisine bağlanır (yeni cari / çift kart / çift borç yok). Gerçek
// tıklama, klavye (Tab + Enter ile gönder), insan hızı (slowMo; ders 12); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı / API
// okunarak (ders 3). Tarihler koşu gününe göre (ders 13); lisans servisi yok (ders 30). BEKLENENLER ELLE (ders 5; eski kodda parantez içinde):
//   1) Cariler → Excel: Hasan Işık 0532 300 00 01, Şükrü Özçelik 0532 300 00 02, Ahu Öztürk 0532 300 00 03 → "3 cari açıldı".
//   2) Cariler → Excel: HASAN IŞIK 0532 300 00 01, ŞÜKRÜ ÖZÇELİK 0532 300 00 02, HASAN IŞIK 0532 300 00 99 → "1 cari açıldı. 2 satır atlandı (Bu cari zaten var)";
//      cari sayısı 4 (eski kod: "3 cari açıldı", cari 6 — çift cari).
//   3) Taksitler → Excel: HASAN IŞIK 0532 300 00 01 3.000 (3 taksit) → "1 kart oluşturuldu"; kart Hasan Işık'ta, bakiyesi 3.000, cari sayısı 4, 120 +3.000
//      (eski kod: yeni cari, Hasan Işık bakiyesi 0).
//   4) Taksitler → Excel: Hasan Işık + HASAN IŞIK (aynı telefon, aynı tutar) → "0 kart oluşturuldu … 2 satır atlandı (Aynı adla açık kart var)"; 120 değişmez
//      (eski kod: büyük harfli satır yeni cari + ikinci kart, 120 +3.000).
//   5) Çek / Senet → Excel: AHU ÖZTÜRK 1.000, Yeni Keşideci 500 → "2 evrak portföye alındı, 1 cariye bağlandı"; çek Ahu Öztürk'e bağlı (eski kod: 0 bağlandı).
//   Sonda Mutabakat Testi tutarlı, sayfada JavaScript hatası yok. (Tablodan Aktar ürün varsayılanında kapalı — 2.4.5; ekranda yolu yok, API testi ayrı.)
// Çalıştırma: node test/e2e/senaryo-s223-250.mjs   (eski kod: DEPO=<eski kök> node <bu dosya>)
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-s223-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-s223-"));
const xlsx = (file, name, columns, rows) => {
  const target = path.join(root, file);
  writeFileSync(target, buildXlsx([{ name, columns, rows }], { title: name }));
  return target;
};
const pad = n => String(n).padStart(2, "0");
const day = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const PLAN_COLS = ["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"];
const startXlsx = xlsx("baslangic.xlsx", "Kayıtlar", ["Ad Soyad", "Telefon"], [{ "Ad Soyad": "Örnek Kişi", Telefon: "0532 000 00 09" }]);
const firstAccounts = xlsx("cariler.xlsx", "Cariler", ["Ad Soyad", "Telefon"], [
  { "Ad Soyad": "Hasan Işık", Telefon: "0532 300 00 01" },
  { "Ad Soyad": "Şükrü Özçelik", Telefon: "0532 300 00 02" },
  { "Ad Soyad": "Ahu Öztürk", Telefon: "0532 300 00 03" },
]);
const upperAccounts = xlsx("cariler-buyuk.xlsx", "Cariler", ["Ad Soyad", "Telefon"], [
  { "Ad Soyad": "HASAN IŞIK", Telefon: "0532 300 00 01" },
  { "Ad Soyad": "ŞÜKRÜ ÖZÇELİK", Telefon: "0532 300 00 02" },
  { "Ad Soyad": "HASAN IŞIK", Telefon: "0532 300 00 99" },
]);
const upperPlan = xlsx("taksit-buyuk.xlsx", "Taksit", PLAN_COLS, [{ "Ad Soyad": "HASAN IŞIK", Telefon: "0532 300 00 01", "Toplam Tutar": "3.000", "Taksit Sayısı": "3", "İlk Vade": day(10) }]);
const againPlan = xlsx("taksit-yine.xlsx", "Taksit", PLAN_COLS, [
  { "Ad Soyad": "Hasan Işık", Telefon: "0532 300 00 01", "Toplam Tutar": "3.000", "Taksit Sayısı": "3", "İlk Vade": day(10) },
  { "Ad Soyad": "HASAN IŞIK", Telefon: "0532 300 00 01", "Toplam Tutar": "3.000", "Taksit Sayısı": "3", "İlk Vade": day(10) },
]);
const cheques = xlsx("cek.xlsx", "Çekler", ["Çek No", "Banka", "Keşideci", "Tutar", "Vade Tarihi"], [
  { "Çek No": "E2E-S223-1", Banka: "Ziraat", "Keşideci": "AHU ÖZTÜRK", Tutar: "1.000", "Vade Tarihi": day(40) },
  { "Çek No": "E2E-S223-2", Banka: "Ziraat", "Keşideci": "Yeni Keşideci", Tutar: "500", "Vade Tarihi": day(40) },
]);

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
const call = url => page.evaluate(async url => (await (await fetch(url)).json()).data, url);
const dbCount = (sql, ...args) => app.store.get(sql, ...args).n;
const liveAccounts = () => dbCount("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const gl120 = async () => Number((await call("/api/workspace/ledger")).trial.accounts.find(row => row.code === "120")?.balance || 0);
const idOf = name => app.store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND name = ? ORDER BY rowid LIMIT 1", name)?.id || "";
const cardsOf = id => app.store.all("SELECT total FROM plans WHERE deleted_at IS NULL AND account_id = ? ORDER BY rowid", id).map(row => row.total);
const balanceOf = async id => Number((await call(`/api/workspace/accounts/${id}`)).totals.balance);

async function openImport(action, file) {
  await closeAll();
  await page.click(`#hof-sidecard [data-action="${action}"]`);
  await page.waitForSelector(`${TOP} [data-act="import"]`, { timeout: 15000 });
  await page.click(`${TOP} [data-act="import"]`);
  await page.waitForSelector(`${TOP} [data-src="excel"]`);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click(`${TOP} [data-src="excel"]`)]);
  await chooser.setFiles(file);
  const opened = await page.waitForSelector(`${TOP} .hof-import-form`, { timeout: 15000 }).then(() => true, () => false);
  ok(opened, `${action}: eşleme penceresi açıldı (${path.basename(file)})`);
  return opened;
}
// Klavye: formun ilk alanından Tab ile gönder düğmesine gelinir, Enter. Bildirim metni döner.
async function submitByKeyboard(pattern) {
  for (const button of await page.$$(".hof-toast .hof-toast-close")) await button.click().catch(() => null);
  await page.waitForTimeout(600); // doğrulama kapısı (satır raporu) yerleşsin
  await page.focus(`${TOP} .hof-import-form select, ${TOP} .hof-import-form input`);
  let reached = false;
  for (let i = 0; i < 80 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(sel => document.activeElement === document.querySelector(`${sel} .hof-import-form button[type="submit"]`), TOP);
  }
  ok(reached, "Tab ile gönder düğmesine gelindi");
  if (!reached) await page.click(`${TOP} .hof-import-form button[type="submit"]`);
  else await page.keyboard.press("Enter");
  const toast = await page
    .waitForFunction(re => [...document.querySelectorAll(".hof-toast .hof-toast-text")].map(node => node.textContent.trim()).find(text => new RegExp(re).test(text)) || "", pattern.source, { timeout: 30000 })
    .then(handle => handle.jsonValue(), () => "");
  return toast || (await page.evaluate(() => [...document.querySelectorAll(".hof-toast .hof-toast-text")].map(node => node.textContent.trim()).join(" | ")));
}

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

  console.log("\n■ 1. Cariler → Excel: üç cari (Türkçe harfli adlar)");
  if (await openImport("accounts", firstAccounts)) {
    const toast = await submitByKeyboard(/cari açıldı/);
    ok(/^3 cari açıldı/.test(toast), `bildirim: "${toast}" (beklenen "3 cari açıldı")`);
  }
  const hasan = idOf("Hasan Işık");
  const ahu = idOf("Ahu Öztürk");
  ok(hasan && ahu && liveAccounts() === 3, `cari sayısı ${liveAccounts()} (beklenen 3)`);

  console.log("\n■ 2. Cariler → Excel: aynı kişiler BÜYÜK HARFLE + telefonu farklı HASAN IŞIK");
  if (await openImport("accounts", upperAccounts)) {
    const toast = await submitByKeyboard(/cari açıldı/);
    await shot("cari-buyuk-harf-sonuc");
    ok(/^1 cari açıldı\. 2 satır atlandı \(Bu cari zaten var\)\.$/.test(toast), `bildirim: "${toast}" (beklenen "1 cari açıldı. 2 satır atlandı (Bu cari zaten var).")`);
  }
  ok(liveAccounts() === 4, `cari sayısı ${liveAccounts()} (beklenen 4; yalnız telefonu farklı kişi yeni cari)`);
  const base120 = await gl120();

  console.log("\n■ 3. Taksitler → Excel: HASAN IŞIK (büyük harf) → kart var olan Hasan Işık'a");
  if (await openImport("plans", upperPlan)) {
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    await shot("taksit-buyuk-harf-sonuc");
    ok(/^1 kart oluşturuldu/.test(toast) && !/atlandı/.test(toast), `bildirim: "${toast}" (beklenen "1 kart oluşturuldu", atlanan yok)`);
  }
  ok(JSON.stringify(cardsOf(hasan)) === "[3000]", `Hasan Işık'ın kartları ${JSON.stringify(cardsOf(hasan))} (beklenen [3000])`);
  ok(liveAccounts() === 4, `cari sayısı ${liveAccounts()} (beklenen 4; yeni cari açılmadı)`);
  const b = await balanceOf(hasan);
  ok(b === 3000, `Hasan Işık bakiyesi ${b} (beklenen 3.000)`);
  const after3 = await gl120();
  ok(Math.round((after3 - base120) * 100) === 300000, `defter 120 +${after3 - base120} (beklenen +3.000)`);

  console.log("\n■ 4. Taksitler → Excel: Hasan Işık + HASAN IŞIK ikinci kez → çift kart / borç yok");
  const plans4 = dbCount("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL");
  if (await openImport("plans", againPlan)) {
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    await shot("taksit-ikinci-kez");
    ok(/^0 kart oluşturuldu/.test(toast) && /2 satır atlandı \(Aynı adla açık kart var\)/.test(toast), `bildirim: "${toast}" (beklenen 0 kart, 2 satır atlandı — Aynı adla açık kart var)`);
  }
  ok(dbCount("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL") === plans4 && liveAccounts() === 4, "kart ve cari sayısı değişmedi");
  ok((await gl120()) === after3, "defter 120 değişmedi");

  console.log("\n■ 5. Çek / Senet → Excel: AHU ÖZTÜRK (büyük harf) → Ahu Öztürk'e bağlanır");
  if (await openImport("cheques", cheques)) {
    const toast = await submitByKeyboard(/evrak portföye alındı/);
    await shot("cek-buyuk-harf-sonuc");
    ok(/^2 evrak portföye alındı, 1 cariye bağlandı\.$/.test(toast), `bildirim: "${toast}" (beklenen "2 evrak portföye alındı, 1 cariye bağlandı.")`);
  }
  const chequeOwner = app.store.get("SELECT account_id AS a FROM cheques WHERE deleted_at IS NULL AND serial_no = 'E2E-S223-1'")?.a;
  ok(chequeOwner === ahu, `E2E-S223-1 çekinin carisi ${chequeOwner === ahu ? "Ahu Öztürk" : JSON.stringify(chequeOwner)} (beklenen Ahu Öztürk)`);
  await closeAll();

  // Cariler listesinde Hasan Işık tek (telefonu farklı HASAN IŞIK ayrı kişi) — ekran.
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForTimeout(800);
  await shot("cariler-listesi");
  const integrity = await call("/api/workspace/ledger/integrity");
  ok(integrity?.ok === true, `Mutabakat Testi tutarlı${integrity?.ok ? "" : `: ${JSON.stringify(integrity?.failures).slice(0, 300)}`}`);
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
console.log(`\nSenaryo S223 (Türkçe harf katlamalı kişi adı): ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
