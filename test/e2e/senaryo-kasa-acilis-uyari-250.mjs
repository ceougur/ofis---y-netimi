// 2.5.0 Ç5-K tur 2 — "Kasa Açılışından Önce Tarihli Hareket" uyarısı EKRANDA (dar kontrol 10.11 ORTA-1; emsal senaryo-226 İ8; docs/erp/C5K-KASA-TASARIM.md §10).
// Karar (S20 = A "Mutabakat Testi uyarı verir"; BAŞ MİMAR 10.11): bu denetim SAPMA DEĞİL UYARIDIR.
//   1. Temiz veri (açılış var, öncesinde satır yok): Yönetim › Sistem "Mutabakat: N denetim tamam", renksiz; Defter Mutabakatı Sonuç Tutarlı, Uyarı satırı yok.
//   2. Silinenler'den geri alınan açılış öncesi Kasa hareketi (Z9; veri programın API'sinden): Yönetim › Sistem SARI (kırmızı değil), "N denetim tamam" AYNEN (aynı N),
//      ardından "Uyarı (yeni işlemleri engellemez): … — 1 hareket." ve sunucunun hint'i (Açılış Bakiyesi'nin tarihini öne alır); "sapma var" yok.
//      Raporlar › Defter Mutabakatı: satırın durumu "Uyarı", Sonuç "Tutarlı", "Fark Var" / "yöneticiye bildirin" yok, alt başlık uyarıyı söyler.
//   3. Uyarı gerçeği gizlemez: kapının görmediği gerçek sapma (tanınmayan ödeme yolu) eklenince Yönetim › Sistem KIRMIZI "sapma var" + uyarı cümlesi yine yazılı; rapor Sonuç
//      "Fark Var", uyarı satırı yine "Uyarı".
// Önceden (78855096): 2'de kırmızı "1 denetimde sapma var (Kasa Açılışından Önce Tarihli Hareket)", raporda "Fark Var" + "yöneticiye bildirin".
// Saat sahte ve sabit (ders 13); lisans servisi yok (ders 30); pencere seçicisi son görünen pencere (ders 39). DEPO=<kopya> ile başka kod kopyasına karşı koşulur (eski kod).
// Çalıştırma: npm run test:senaryo-kasa-acilis-uyari-250
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(HERE, "..", "helpers.mjs")).href);

const OUT = path.join(HERE, "artifacts", "senaryo-kasa-acilis-uyari-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Kasa-Uyari-250-Admin!";
const NOW = "2026-03-20T12:00:00+03:00";
const OPEN = "2026-03-10";
const EARLY = "2026-03-05";
const AFTER = "2026-03-11";
const NAME = "Kasa Açılışından Önce Tarihli Hareket";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kasa-uyari-250-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f50" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
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
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
let page = null;
let shotNo = 0;
const shot = async (name, target = page) => {
  shotNo += 1;
  await target.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true });
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
  }
};
const closeAll = async () => {
  for (let index = 0; index < 8 && (await page.$(MODAL)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
};
/** Yönetim › Sistem'in Mutabakat satırı: { text, warn, error }. */
async function systemLine(name) {
  const admin = await page.context().newPage();
  admin.on("pageerror", error => errors.push(`admin pageerror ${error.message}`));
  try {
    await installPageClock(admin, app.config.now);
    await admin.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
    await admin.click('.adm-tabs [data-tab="system"]');
    await admin.waitForFunction(() => /^Mutabakat/.test(document.querySelector("#adm-integrity-status")?.textContent || ""), null, { timeout: 20000 });
    const text = await admin.textContent("#adm-integrity-status");
    const classes = await admin.$eval("#adm-integrity-status", node => node.className);
    await admin.$eval("#adm-integrity-status", node => node.scrollIntoView({ block: "center" }));
    await shot(`yonetim-${name}`, admin);
    return { text, warn: /\badm-warn-text\b/.test(classes), error: /\badm-error-text\b/.test(classes) };
  } finally {
    await admin.close();
  }
}
/** Raporlar › Tüm Raporlar › Defter Mutabakatı: rapor bölümünün metni, uyarı satırı, Sonuç. */
async function ledgerReport(name) {
  await closeAll();
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${TOP} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${TOP} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${TOP} [data-rc-list] [data-report="defter-mutabakati"]`, { timeout: 15000 });
  await page.click(`${TOP} [data-rc-list] [data-report="defter-mutabakati"]`);
  await page.waitForFunction(sel => {
    const main = document.querySelector(`${sel} [data-rc-main]`);
    return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table") && /Sonuç/.test(main.innerText);
  }, TOP, { timeout: 20000 });
  const view = await page.evaluate(([sel, title]) => {
    const main = document.querySelector(`${sel} [data-rc-main]`);
    const row = [...main.querySelectorAll(".hof-rc-table tr")].find(tr => tr.innerText.includes(title));
    const summary = Object.fromEntries([...main.querySelectorAll(".hof-rc-summary span")].map(span => [span.querySelector("small")?.textContent.trim(), span.querySelector("b")?.textContent.trim()]));
    return { text: main.innerText, row: row ? [...row.querySelectorAll("td")].map(td => td.innerText.trim()) : null, summary };
  }, [TOP, NAME]);
  await shot(`defter-mutabakati-${name}`);
  await closeAll();
  return view;
}

try {
  // ---------- Veri (programın API'si) ----------
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  const early = (await must("Kasa Giriş 05.03 (açılış yokken)", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: EARLY, description: "eski giriş", method: "cash" }))).id;
  await must("sil", api.del(`/api/workspace/cash/${early}`));
  await must("Kasa açılışı 10.03", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
  await must("Kasa Giriş 11.03", api.post("/api/workspace/cash", { kind: "in", amount: "50", date: AFTER, description: "sonra", method: "cash" }));

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);

  let tamam = "";
  await step("1. Temiz veri: Yönetim › Sistem 'N denetim tamam' (renksiz); Defter Mutabakatı Tutarlı, Uyarı satırı yok", async () => {
    const line = await systemLine("1-temiz");
    tamam = /^Mutabakat: (\d+) denetim tamam/.exec(line.text)?.[1] || "";
    ok(Boolean(tamam) && !line.warn && !line.error, `"${line.text}" (sarı ${line.warn}, kırmızı ${line.error})`);
    ok(!/Uyarı/.test(line.text), "uyarı cümlesi yok");
    const view = await ledgerReport("1-temiz");
    ok(view.summary["Sonuç"] === "Tutarlı", `Sonuç: ${view.summary["Sonuç"]}`);
    ok(view.row === null && !/Fark Var|Uyarı/.test(view.text), "uyarı satırı / Fark Var yok");
  });

  await step("2. Silinenler'den geri alınan açılış öncesi hareket: Yönetim › Sistem SARI, 'N denetim tamam' aynen + uyarı ve ne yapılacağı; rapor satırı 'Uyarı', Sonuç 'Tutarlı'", async () => {
    const listed = await must("Silinenler", api.get("/api/admin/trash"));
    const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === early);
    await must("Silinenler'den geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    const line = await systemLine("2-uyari");
    ok(line.warn && !line.error, `sarı uyarı, kırmızı hata değil (sarı ${line.warn}, kırmızı ${line.error})`);
    ok(line.text.startsWith(`Mutabakat: ${tamam} denetim tamam — ana defter ile Kasa, Cari, Stok ve Taksit kuruşu kuruşuna tutarlı.`), `"N denetim tamam" aynen (N = ${tamam}): "${line.text.slice(0, 160)}"`);
    ok(line.text.includes(`Uyarı (yeni işlemleri engellemez): ${NAME} — 1 hareket.`), "uyarı cümlesi ve hareket sayısı");
    ok(/Kasa → Açılış Bakiyesi'nin tarihini öne alır; uyarı kalkar\./.test(line.text) && /Silinenler'den geri gelen kayıt/.test(line.text), "ne yapılacağı (sunucunun hint'i) yazılı");
    ok(!/sapma var|eski sürümden kalan/i.test(line.text), "'sapma var' / 'eski sürümden kalan' yok");
    const view = await ledgerReport("2-uyari");
    ok(view.row?.at(-1) === "Uyarı", `rapor satırı: ${JSON.stringify(view.row)}`);
    ok(view.summary["Sonuç"] === "Tutarlı", `Sonuç: ${view.summary["Sonuç"]}`);
    ok(!/Fark Var|yöneticiye bildirin/.test(view.text), "Fark Var / yöneticiye bildirin yok");
    ok(view.text.includes(`Uyarı (yeni işlemleri engellemez): ${NAME} — 1 hareket`), "alt başlık uyarıyı söyler");
  });

  await step("3. Uyarı gerçeği gizlemez: kapının görmediği gerçek sapma + uyarı → Yönetim KIRMIZI 'sapma var' + uyarı cümlesi; rapor Sonuç 'Fark Var', uyarı satırı yine 'Uyarı'", async () => {
    app.db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-e2e-yol', 'in', 10, ?, 'x', 'bitcoin', 'x', ?)").run(AFTER, new Date().toISOString());
    const line = await systemLine("3-sapma-ve-uyari");
    ok(line.error && !line.warn, `kırmızı (sarı ${line.warn}, kırmızı ${line.error})`);
    const listed = /denetimde sapma var \((.*)\)\. Raporlar › Defter Mutabakatı'nda ayrıntıyı görün\./.exec(line.text)?.[1] || "";
    ok(/Tanınmayan ödeme yolu/.test(listed) && !listed.includes(NAME), `sapma listesinde gerçek sapma var, uyarı yok: "${listed.slice(0, 220)}"`);
    ok(line.text.includes(`Uyarı (yeni işlemleri engellemez): ${NAME} — 1 hareket.`), "uyarı cümlesi yine yazılı");
    const view = await ledgerReport("3-sapma-ve-uyari");
    ok(view.summary["Sonuç"] === "Fark Var", `Sonuç: ${view.summary["Sonuç"]}`);
    ok(/yöneticiye bildirin/.test(view.text), "alt başlık: yöneticiye bildirin");
    ok(view.row?.at(-1) === "Uyarı", `uyarı satırı yine 'Uyarı': ${JSON.stringify(view.row)}`);
    app.db.prepare("DELETE FROM cash_entries WHERE id = 'cash-e2e-yol'").run();
  });
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
console.log(`\n# tests ${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
process.exitCode = failed ? 1 : 0;
