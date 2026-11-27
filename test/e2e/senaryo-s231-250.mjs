// 2.5.0 S231 = A — kabul G (EKRAN): Taksitler → Excel'den Yükle'de grup adı BÜYÜK HARFLE ('IŞIK SERVİSİ') yazılınca var olan 'Işık Servisi' grubu bulunur;
// telefonsuz kişi o gruptaki carisiyle eşleşir (yeni grup / çift cari / çift borç yok). Çek / Senet eşleme penceresinin yeni metni. Gerçek tıklama, klavye
// (Tab + Enter ile gönder), insan hızı (slowMo; ders 12); pencere seçicisi en üstteki görünür pencere (ders 39); sayılar veri tabanından / API'den (ders 3).
// Tarihler koşu gününe göre (ders 13); lisans servisi yok (ders 30). BEKLENENLER ELLE (ders 5; eski kodda parantez içinde):
//   1) Taksitler → Excel: Elif Su (telefonsuz), Grup 'Işık Servisi', 1.000 → "1 kart oluşturuldu"; 1 grup, 1 cari.
//   2) Taksitler → Excel: ELİF SU (telefonsuz), Grup 'IŞIK SERVİSİ', 1.000 → "0 kart oluşturuldu … 1 satır atlandı (Aynı adla açık kart var)"; grup 1, cari 1,
//      120 değişmez (eski kod: "1 kart oluşturuldu", 2 grup, 2 cari, 120 +1.000 — çift borç).
//   3) Taksitler → Excel: Can Er / 'ışık servisi' 500 ve Nur Ak / 'IŞIK  SERVİSİ' 300 → "2 kart oluşturuldu"; iki kart da 'Işık Servisi' grubunda, grup sayısı 1
//      (eski kod: iki yeni grup).
//   4) Çek / Senet → Excel: eşleme penceresinde "Keşideci adı aynı olan (büyük / küçük harf ve boşluk farkı sayılmaz) tek cari varsa evrak o cariye bağlanır."
//      (eski kod: "birebir aynı olan tek cari").
//   Sonda Mutabakat Testi tutarlı, sayfada JavaScript hatası yok.
// Çalıştırma: node test/e2e/senaryo-s231-250.mjs   (eski kod: DEPO=<eski kök> node <bu dosya>)
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-s231-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-s231-"));
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
const PLAN_COLS = ["Ad Soyad", "Telefon", "Grup", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"];
const planRow = (name, group, total) => ({ "Ad Soyad": name, Telefon: "", Grup: group, "Toplam Tutar": total, "Taksit Sayısı": "2", "İlk Vade": day(10) });
const startXlsx = xlsx("baslangic.xlsx", "Kayıtlar", ["Ad Soyad", "Telefon"], [{ "Ad Soyad": "Örnek Kişi", Telefon: "0532 000 00 09" }]);
const firstPlan = xlsx("taksit-ilk.xlsx", "Taksit", PLAN_COLS, [planRow("Elif Su", "Işık Servisi", "1.000")]);
const upperPlan = xlsx("taksit-buyuk.xlsx", "Taksit", PLAN_COLS, [planRow("ELİF SU", "IŞIK SERVİSİ", "1.000")]);
const variantPlan = xlsx("taksit-yazimlar.xlsx", "Taksit", PLAN_COLS, [planRow("Can Er", "ışık servisi", "500"), planRow("Nur Ak", "IŞIK  SERVİSİ", "300")]);
const cheques = xlsx("cek.xlsx", "Çekler", ["Çek No", "Banka", "Keşideci", "Tutar", "Vade Tarihi"], [{ "Çek No": "E2E-S231-1", Banka: "Ziraat", "Keşideci": "ELİF SU", Tutar: "750", "Vade Tarihi": day(40) }]);
const NEW_TEXT = "Keşideci adı aynı olan (büyük / küçük harf ve boşluk farkı sayılmaz) tek cari varsa evrak o cariye bağlanır.";

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
const groupCount = () => dbCount("SELECT COUNT(*) AS n FROM plan_groups");
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const gl120 = async () => Number((await call("/api/workspace/ledger")).trial.accounts.find(row => row.code === "120")?.balance || 0);
const groupOfCard = name => app.store.get("SELECT g.name AS n FROM plans p LEFT JOIN plan_groups g ON g.id = p.group_id WHERE p.deleted_at IS NULL AND p.name = ? ORDER BY p.rowid DESC", name)?.n ?? null;

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

  console.log("\n■ 1. Taksitler → Excel: Elif Su (telefonsuz), Grup 'Işık Servisi'");
  if (await openImport("plans", firstPlan)) {
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    ok(/^1 kart oluşturuldu/.test(toast), `bildirim: "${toast}" (beklenen "1 kart oluşturuldu")`);
  }
  ok(groupCount() === 1 && liveAccounts() === 1, `grup ${groupCount()}, cari ${liveAccounts()} (beklenen 1 / 1)`);
  const base120 = await gl120();

  console.log("\n■ 2. Taksitler → Excel: ELİF SU (telefonsuz), Grup 'IŞIK SERVİSİ' → aynı grup, aynı kişi; çift kart / borç yok");
  if (await openImport("plans", upperPlan)) {
    await shot("taksit-buyuk-grup-onizleme");
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    await shot("taksit-buyuk-grup-sonuc");
    ok(/^0 kart oluşturuldu/.test(toast) && /1 satır atlandı \(Aynı adla açık kart var\)/.test(toast), `bildirim: "${toast}" (beklenen 0 kart, 1 satır atlandı — Aynı adla açık kart var)`);
  }
  ok(groupCount() === 1, `grup sayısı ${groupCount()} (beklenen 1; 'IŞIK SERVİSİ' yeni grup açmadı)`);
  ok(liveAccounts() === 1, `cari sayısı ${liveAccounts()} (beklenen 1; çift cari yok)`);
  ok((await gl120()) === base120, "defter 120 değişmedi (borç bir kez)");

  console.log("\n■ 3. Taksitler → Excel: 'ışık servisi' ve 'IŞIK  SERVİSİ' yazımlarıyla iki yeni kişi → kartlar 'Işık Servisi' grubunda");
  if (await openImport("plans", variantPlan)) {
    const toast = await submitByKeyboard(/kart oluşturuldu/);
    ok(/^2 kart oluşturuldu/.test(toast), `bildirim: "${toast}" (beklenen "2 kart oluşturuldu")`);
  }
  ok(groupCount() === 1, `grup sayısı ${groupCount()} (beklenen 1)`);
  ok(groupOfCard("Can Er") === "Işık Servisi" && groupOfCard("Nur Ak") === "Işık Servisi", `kartların grubu: Can Er ${groupOfCard("Can Er")}, Nur Ak ${groupOfCard("Nur Ak")} (beklenen Işık Servisi)`);
  await closeAll();
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForTimeout(900);
  await shot("taksitler-gruplar");

  console.log("\n■ 4. Çek / Senet → Excel: eşleme penceresinin metni");
  if (await openImport("cheques", cheques)) {
    const intro = await page.evaluate(sel => document.querySelector(sel)?.textContent || "", TOP);
    await shot("cek-esleme-penceresi");
    ok(intro.includes(NEW_TEXT), `pencere metni yeni cümleyi içeriyor${intro.includes(NEW_TEXT) ? "" : `: "${intro.replace(/\s+/g, " ").slice(0, 400)}"`}`);
    ok(!intro.includes("birebir aynı olan tek cari"), "eski metin ('birebir aynı olan tek cari') yok");
    const toast = await submitByKeyboard(/evrak portföye alındı/);
    ok(/^1 evrak portföye alındı, 1 cariye bağlandı\.$/.test(toast), `bildirim: "${toast}" (beklenen "1 evrak portföye alındı, 1 cariye bağlandı.")`);
  }
  await closeAll();
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
console.log(`\nSenaryo S231 (grup adı Türkçe harf katlamalı; çek penceresi metni): ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
