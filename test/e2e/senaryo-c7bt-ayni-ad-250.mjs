// 2.5.0 Ç7b TAKSİT KÜÇÜK TURU — kabul G (EKRAN): P7 (S219 = A, kullanıcı 20.11 11:29). Excel'den taksit kartı yüklemesinde aynı adlı İKİ KİŞİ — gerçek tıklama, klavye
// (Tab + Enter ile "Kartları Oluştur"), insan hızı (slowMo; ders 12); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı / API okunarak (ders 3).
// Tarihler koşu gününe göre (ders 13); lisans servisi yok (ders 30). BEKLENENLER ELLE (ders 5):
//   1) Cari → Excel: Ahmet Yılmaz 0532 100 00 01 (C1) ve Ahmet Yılmaz 0532 100 00 02 (C2) → 2 cari.
//   2) Taksitler → Excel: C1 3.000 (3 taksit) + C2 2.000 (2 taksit) → "2 kart oluşturuldu", atlanan YOK; C1 bakiye 3.000, C2 bakiye 2.000; defter 120 +5.000
//      (eski kod: "1 kart oluşturuldu … 1 satır atlandı (Aynı adla açık kart var)", C2 bakiye 0).
//   3) Taksitler → Excel: telefonsuz "Ahmet Yılmaz" 4.000 + "Elif Su" 0536 000 00 01 1.000 → "1 kart oluşturuldu … 1 satır atlandı (Aynı adlı birden çok kişi var;
//      telefonunu ekleyip yeniden yükleyin)"; Ahmet Yılmaz adlı cari sayısı 2 kalır, 120 yalnız +1.000.
//   4) Aynı Excel (2) ikinci kez → "0 kart oluşturuldu … 2 satır atlandı (Aynı adla açık kart var)"; kart / cari sayısı ve 120 değişmez.
//   Sonda Mutabakat Testi tutarlı, sayfada JavaScript hatası yok.
// Çalıştırma: node test/e2e/senaryo-c7bt-ayni-ad-250.mjs   (eski kod: DEPO=<eski kök> node <bu dosya>)
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-c7bt-ayni-ad-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-c7bt-"));
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
const accountsXlsx = xlsx("cariler.xlsx", "Cariler", ["Ad Soyad", "Telefon"], [
  { "Ad Soyad": "Ahmet Yılmaz", Telefon: "0532 100 00 01" },
  { "Ad Soyad": "Ahmet Yılmaz", Telefon: "0532 100 00 02" },
]);
const twoXlsx = xlsx("taksit-iki-kisi.xlsx", "Taksit", PLAN_COLS, [
  { "Ad Soyad": "Ahmet Yılmaz", Telefon: "0532 100 00 01", "Toplam Tutar": "3.000", "Taksit Sayısı": "3", "İlk Vade": day(10) },
  { "Ad Soyad": "Ahmet Yılmaz", Telefon: "0532 100 00 02", "Toplam Tutar": "2.000", "Taksit Sayısı": "2", "İlk Vade": day(10) },
]);
const phonelessXlsx = xlsx("taksit-telefonsuz.xlsx", "Taksit", PLAN_COLS, [
  { "Ad Soyad": "Ahmet Yılmaz", Telefon: "", "Toplam Tutar": "4.000", "Taksit Sayısı": "4", "İlk Vade": day(10) },
  { "Ad Soyad": "Elif Su", Telefon: "0536 000 00 01", "Toplam Tutar": "1.000", "Taksit Sayısı": "2", "İlk Vade": day(10) },
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
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const gl120 = async () => Number((await call("/api/workspace/ledger")).trial.accounts.find(row => row.code === "120")?.balance || 0);
const ahmet = () => app.store.all("SELECT id, phone FROM accounts WHERE deleted_at IS NULL AND name = 'Ahmet Yılmaz' ORDER BY phone");
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
// Klavye: formun ilk alanından Tab ile "Kartları Oluştur"a gelinir, Enter. Bildirim metni döner.
async function submitByKeyboard(pattern) {
  for (const button of await page.$$(".hof-toast .hof-toast-close")) await button.click().catch(() => null);
  await page.waitForTimeout(600); // doğrulama kapısı (satır raporu) yerleşsin
  await page.focus(`${TOP} .hof-import-form select, ${TOP} .hof-import-form input`);
  let reached = false;
  for (let i = 0; i < 60 && !reached; i += 1) {
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

  console.log("\n■ 1. Cari → Excel: aynı adlı iki kişi (telefonları farklı)");
  if (await openImport("accounts", accountsXlsx)) {
    await page.waitForTimeout(600);
    await page.click(`${TOP} .hof-import-form button[type="submit"]`);
    await page.waitForFunction(() => /2 cari açıldı/.test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), null, { timeout: 30000 }).catch(() => null);
  }
  const people = ahmet();
  ok(people.length === 2 && people[0].phone !== people[1].phone, `iki ayrı cari: ${people.map(row => row.phone).join(" · ")}`);
  const [c1, c2] = people.map(row => row.id);
  const base120 = await gl120();

  console.log("\n■ 2. Taksitler → Excel: iki Ahmet Yılmaz, telefonları farklı → iki kart, iki borç");
  if (await openImport("plans", twoXlsx)) {
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    await shot("iki-kisi-sonuc");
    ok(/^2 kart oluşturuldu/.test(toast) && !/atlandı/.test(toast), `bildirim: "${toast}" (beklenen "2 kart oluşturuldu", atlanan yok)`);
  }
  ok(JSON.stringify(cardsOf(c1)) === "[3000]" && JSON.stringify(cardsOf(c2)) === "[2000]", `kartlar: C1 ${JSON.stringify(cardsOf(c1))}, C2 ${JSON.stringify(cardsOf(c2))} (beklenen [3000], [2000])`);
  const b1 = await balanceOf(c1);
  const b2 = await balanceOf(c2);
  ok(b1 === 3000 && b2 === 2000, `cari bakiyeleri C1 ${b1}, C2 ${b2} (beklenen 3.000, 2.000)`);
  const after2 = await gl120();
  ok(Math.round((after2 - base120) * 100) === 500000, `defter 120 +${after2 - base120} (beklenen +5.000)`);

  console.log("\n■ 3. Taksitler → Excel: telefonsuz Ahmet Yılmaz (kişi seçilemez) + Elif Su");
  if (await openImport("plans", phonelessXlsx)) {
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    await shot("telefonsuz-atlandi");
    ok(/^1 kart oluşturuldu/.test(toast) && /1 satır atlandı \(Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin\)/.test(toast), `bildirim: "${toast}" (beklenen 1 kart + 1 satır atlandı, nedeni kişiyi söyler)`);
  }
  ok(ahmet().length === 2, `Ahmet Yılmaz adlı cari sayısı ${ahmet().length} (beklenen 2; yeni cari açılmadı)`);
  const after3 = await gl120();
  ok(Math.round((after3 - after2) * 100) === 100000, `defter 120 +${after3 - after2} (beklenen +1.000, yalnız Elif Su)`);

  console.log("\n■ 4. Aynı Excel (2) ikinci kez → çift kart / borç yok");
  const plans4 = dbCount("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL");
  const accounts4 = dbCount("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
  if (await openImport("plans", twoXlsx)) {
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    await shot("ikinci-kez");
    ok(/^0 kart oluşturuldu/.test(toast) && /2 satır atlandı \(Aynı adla açık kart var\)/.test(toast), `bildirim: "${toast}" (beklenen 0 kart, 2 satır atlandı — Aynı adla açık kart var)`);
  }
  ok(dbCount("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL") === plans4 && dbCount("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL") === accounts4, "kart ve cari sayısı değişmedi");
  ok((await gl120()) === after3, "defter 120 değişmedi");
  await closeAll();
  // Taksitler listesinde iki Ahmet Yılmaz kartı (ekran).
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForSelector(`${TOP} tr[data-plan], ${TOP} [data-plan]`, { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(500);
  const shown = await page.evaluate(sel => [...document.querySelectorAll(`${sel} [data-plan]`)].filter(node => /Ahmet Yılmaz/.test(node.textContent)).length, TOP);
  ok(shown >= 2, `Taksitler penceresinde ${shown} Ahmet Yılmaz kartı görünüyor (beklenen 2)`);
  await shot("taksitler-listesi");

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
console.log(`\nSenaryo Ç7b taksit küçük turu (P7): ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
