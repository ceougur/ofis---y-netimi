// Gerçek kullanıcı senaryosu (v2.0.8; 2.4.5'te yeniden yazıldı): sıfır kurulum, arayüzden, uçtan uca. Sayılar (bakiye, Kasa, kart, takvim) karşılaştırılır.
// Çalıştırma: npm run test:senaryo   (ekran görüntüleri test/e2e/artifacts/senaryo/ altına yazılır)
// 2.4.5 madde 1–3 (ürün sahibi: "tablo verisinden hiçbir para kaydı, borç tutarı, açılış bakiyesi doğmaz"): Tablodan Aktar ve kayıttan tahsilat programda KAPALI.
// Senaryo A: okul servisi Excel'i yüklenir; ESKİ SÜRÜM VERİSİ (anahtar açık sunucu = 2.4.4 davranışı, API'den): bir kayıt tahsilatı + 6 kişinin Tablodan Aktar'ı.
//            Program üretim varsayılanıyla (anahtarsız) aynı veriyle yeniden açılır → Taksitler'de "Tablodan Aktar" yok, "Son Aktarımlar" var; uçlar 410; eski
//            aktarım Son Aktarımlar'dan Geri Al ile geri alınır (kartlar, cariler kalkar; tahsilat kayıt kartına döner; Kasa aynı); dönen eski kayıt tahsilatı
//            İşlem Geçmişi'nde düzeltilmez, silinir; şeritten "önce cari açın" formunda Açılış Bakiyesi boş; yükleme sonrası "aktarılsın mı?" sorusu yok.
// Senaryo B: Stok → Yeni ürün: "Kasa'ya yansıt" işaretsiz → Kasa değişmez; işaretli → miktar × birim fiyat "Stok ödemesi (alım)".
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { okulServisiXlsx } from "../fixtures/okul-servisi-ornek.mjs";
import { escClose } from "./esc-kapat.mjs";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo");
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const MACHINE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-prova-208-"));
const excel = path.join(root, "okul-servisi-ornek.xlsx");
writeFileSync(excel, okulServisiXlsx());
const common = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: MACHINE } };
// Eski sürüm verisi için önce anahtar AÇIK (2.4.4 davranışı) açılır; aynı veriyle üretim varsayılanına (anahtarsız) geçilir.
let app = createApp({ ...common, legacyCasePayments: true, legacyTableTransfer: true });
let BASE = `http://127.0.0.1:${(await app.listen(0, "127.0.0.1")).port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1020 }, locale: "tr-TR" });
const page = await context.newPage();
const console_ = [];
page.on("pageerror", e => console_.push("pageerror " + e.message));
// Giriş ekranı açılırken oturum yoklaması (401 /api/auth/me) beklenen bir yanıttır; hata sayılmaz. 2.4.5: senaryonun kapalı uçlara BİLEREK gönderdiği
// istekler (Tablodan Aktar, kayıt tahsilatı → 410) de beklenen yanıttır; başka her 410 hata sayılır.
const expected410 = (text, url) => /status of 410/.test(text) && /\/api\/workspace\/(plans\/from-table|cases\/[^/?]+\/payments)(\?|$)/.test(url);
page.on("console", m => { if (m.type() === "error" && !/api\/auth\/me/.test(m.location().url || "") && !expected410(m.text(), m.location().url || "")) console_.push(`${m.text()} @ ${m.location().url}`); });
const results = [];
let n = 0;
const shot = async (name, jpeg = false) => { n += 1; const file = path.join(OUT, `${String(n).padStart(2, "0")}-${name}.${jpeg ? "jpg" : "png"}`); await page.screenshot(jpeg ? { path: file, type: "jpeg", quality: 86 } : { path: file }); return file; };
const ok = (cond, msg) => { results.push({ ok: Boolean(cond), msg }); console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) throw new Error("BAŞARISIZ: " + msg); };
const api = async (url, body, method = body ? "POST" : "GET") => page.evaluate(async ([url, body, method]) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); return { status: r.status, ...j }; }, [url, body, method]);
const money = v => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const text = sel => page.$eval(sel, node => node.innerText.replace(/\s+/g, " ").trim());
const closeTop = async () => { await escClose(page); await page.waitForTimeout(300); };
const step = async (title, fn) => { console.log(`\n■ ${title}`); await fn(); };

const login = async () => {
  await page.goto(BASE + "/");
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
};

try {
  await step("Giriş ve Excel yükleme (sıfır kurulum)", async () => {
    await login();
    await page.waitForSelector("#hof-start .hof-drop");
    const input = await page.$("#hof-start .hof-drop input[type=file]");
    await input.setInputFiles(excel);
    await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 });
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click('.hof-modal-backdrop.is-visible [data-mode="replace"]')]);
    await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    ok((await text(".hof-analysis-result")).includes("Okul Servisi"), "sektör önerisi: Okul Servisi");
  });

  await step("Yükleme sonrası 'Taksitler'e aktarılsın mı?' sorusu yok (2.4.5 madde 2; eski kodda gelirdi)", async () => {
    await page.click(".hof-analysis-result [data-apply]");
    await page.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Okul Servisi Yönetimi", null, { timeout: 5000 });
    await page.waitForTimeout(6000);
    ok(!(await page.$$eval(".hof-toast", nodes => nodes.some(node => /Taksitler'e aktarılsın mı/.test(node.textContent)))), "analiz penceresi kapandıktan sonra da aktarma sorusu sorulmaz");
  });

  let pillAmount = 0;
  let pillName = "";
  let pillKey = "";
  let importId = "";
  await step("Eski sürüm verisi (anahtar açık sunucu, API'den): bir kayıt tahsilatı + 6 kişinin Tablodan Aktar'ı", async () => {
    await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 10000 });
    await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast").forEach(node => node.remove()));
    pillName = await page.$eval(".hof-payment-pill:not([aria-hidden])", node => node.querySelector("b").textContent);
    const item = await page.evaluate(name => (window.HOF.dues.data().items || []).find(entry => entry.person === name && entry.source !== "plan") || null, pillName);
    pillAmount = item?.amount || 0;
    pillKey = item?.caseKey || "";
    const paid = await api(`/api/workspace/cases/${encodeURIComponent(pillKey)}/payments`, { amount: money(pillAmount), date: await page.evaluate(() => window.HOF.localToday()), method: "cash", note: `${item.label} · ${item.dueText}`, caseTitle: pillName });
    ok(paid.status === 200 && pillAmount > 0, `kayıt tahsilatı (eski sürüm gibi, API): ${paid.status} · ${pillName} ${money(pillAmount)}`);
    const preview = (await api("/api/workspace/plans/from-table")).data;
    ok(preview.records.length === 6, `ön izlemede 6 öğrenci (${preview.records.length})`);
    const moved = await api("/api/workspace/plans/from-table", { keys: preview.records.filter(record => record.selectable).map(record => record.key), fingerprint: preview.fingerprint });
    ok(moved.status === 200 && moved.data.created === 6 && moved.data.paymentsMoved === 1, `Tablodan Aktar (eski sürüm gibi, API): ${JSON.stringify(moved.data || moved).slice(0, 200)}`);
    importId = moved.data.importId;
  });

  let cashBefore = 0;
  await step("Program üretim varsayılanıyla (anahtarsız) aynı veriyle yeniden açılır", async () => {
    await app.close();
    app = createApp({ ...common });
    BASE = `http://127.0.0.1:${(await app.listen(0, "127.0.0.1")).port}`;
    // Çerez bağlantı noktasına bağlı değil; aynı veri klasöründe oturum geçerli kalır. Yeni açılış gibi oturum çerezi temizlenip yeniden girilir.
    await context.clearCookies();
    await login();
    await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast").forEach(node => node.remove()));
    cashBefore = (await api("/api/workspace/cash?period=all")).data.totals.balance;
    ok(cashBefore === pillAmount, `Kasa ${money(cashBefore)} (eski tahsilat artık taksit tahsilatı)`);
    const summary = (await api("/api/workspace/plans/from-table/summary")).data;
    ok(summary.count === 0 && summary.ask === false, `yükleme sonrası özet sormaz: ${JSON.stringify(summary)}`);
  });

  await step("Taksitler: 'Tablodan Aktar' düğmesi yok, 'Son Aktarımlar' var; uçlar 410, veri değişmez", async () => {
    await page.click('#hof-sidecard [data-action="plans"]');
    await page.waitForSelector('.hof-plans [data-act="imports"]', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll(".hof-plans tr[data-plan]").length === 6, null, { timeout: 10000 });
    ok(!(await page.$('.hof-plans [data-act="transfer"]')), "Tablodan Aktar düğmesi yok");
    ok((await text('.hof-plans [data-act="imports"]')) === "Son Aktarımlar", "Son Aktarımlar düğmesi");
    await shot("taksitler-son-aktarimlar-dugmesi");
    const transfer = await api("/api/workspace/plans/from-table", { keys: [pillKey] });
    ok(transfer.status === 410 && transfer.code === "table-transfer-closed", `Tablodan Aktar ucu 410: ${JSON.stringify(transfer).slice(0, 160)}`);
    const pay = await api(`/api/workspace/cases/${encodeURIComponent(pillKey)}/payments`, { amount: "100", method: "cash", date: await page.evaluate(() => window.HOF.localToday()) });
    ok(pay.status === 410 && pay.code === "case-payments-closed" && pay.error === "Kayıt tahsilatı kapatıldı; tahsilat Cari'den girilir.", `kayıt tahsilatı ucu 410: ${JSON.stringify(pay).slice(0, 160)}`);
    const plans = (await api("/api/workspace/plans?status=all")).data;
    const cash = (await api("/api/workspace/cash?period=all")).data;
    ok(plans.plans.length === 6 && cash.totals.balance === cashBefore && !cash.entries.some(e => e.source === "payment"), "6 kart, Kasa aynı, yeni kayıt tahsilatı yok");
  });

  await step("Son Aktarımlar → Geri Al: kartlar ve cariler kalkar; tahsilat kayıt kartına döner; Kasa aynı", async () => {
    await page.click('.hof-plans [data-act="imports"]');
    await page.waitForSelector(`.hof-modal-backdrop.is-visible .hof-imports-modal [data-undo="${importId}"]`, { timeout: 10000 });
    const list = await text(".hof-imports-modal");
    ok(/6 kart/.test(list) && /1 tahsilat taşındı/.test(list), `listede eski aktarım: ${list.slice(0, 240)}`);
    await shot("son-aktarimlar-geri-al");
    await page.click(`.hof-imports-modal [data-undo="${importId}"]`);
    await page.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 8000 });
    await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /Aktarım geri alındı/i.test(node.textContent)), null, { timeout: 15000 });
    const undoToast = await page.evaluate(() => [...document.querySelectorAll(".hof-toast")].map(node => node.innerText.replace(/\s+/g, " ")).find(t => /Aktarım geri alındı/i.test(t)));
    ok(/6 kart kaldırıldı/.test(undoToast) && /1 tahsilat kayıt kartına döndü/.test(undoToast), `geri alma bildirimi: ${undoToast}`);
    await page.waitForFunction(() => /geri alındı/.test(document.querySelector(".hof-imports-modal")?.textContent || "") && !document.querySelector(".hof-imports-modal [data-undo]"), null, { timeout: 10000 });
    ok(true, "Son Aktarımlar listesi yenilendi: aktarım 'geri alındı', Geri Al düğmesi kalmadı");
    const plans = (await api("/api/workspace/plans?status=all")).data;
    ok(plans.plans.length === 0, "taksit kartı kalmadı");
    const accounts = (await api("/api/workspace/accounts")).data;
    ok((accounts.items || accounts.accounts || []).length === 0, "aktarımın açtığı cariler kaldırıldı");
    const cash = (await api("/api/workspace/cash?period=all")).data;
    ok(cash.totals.balance === pillAmount && cash.entries.some(e => e.source === "payment") && !cash.entries.some(e => e.source === "plan"), "tahsilat kayıt kartına döndü; Kasa bakiyesi aynı");
    await page.click(".hof-imports-modal [data-close]");
    await closeTop();
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 8000 });
  });

  await step("Şeritten Tahsilat Gir → önce cari açın: Açılış Bakiyesi boş (2.4.5 madde 3); Esc sorusuz kapanır", async () => {
    // Kayıt seçilmeden, sayfa başındayken (pil kartı sayfa kaydırılınca kapanır).
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 10000 });
    await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast").forEach(node => node.remove()));
    await page.$eval(".hof-payment-pill:not([aria-hidden])", node => node.click());
    await page.click('.hof-payment-action-card [data-act="pay"]');
    await page.waitForSelector('.hof-modal-backdrop.is-visible input[name="name"]', { timeout: 8000 });
    const form = await page.$eval(".hof-modal-backdrop.is-visible", node => ({ title: node.querySelector(".hof-modal-title")?.textContent.trim(), opening: node.querySelector('input[name="openingBalance"]')?.value ?? null, name: node.querySelector('input[name="name"]').value }));
    ok(form.title === "Yeni Cari" && form.name && form.opening === "", `önce cari açın, ad kayıttan, Açılış Bakiyesi boş: ${JSON.stringify(form)}`);
    await escClose(page, { expect: "soru-yok", step: "şerit tahsilatı → Yeni Cari" });
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 5000 });
  });

  await step("Kayıt kartı: Tahsilat düğmesi yok; dönen eski kayıt tahsilatı düzeltilmez (✎ yok), silinebilir (× var)", async () => {
    ok(await page.evaluate(key => window.HOF.revealRecord(key), pillKey), "kayıt tabloda açıldı");
    await page.waitForFunction(key => window.HOF.selectedCase()?.key === key, pillKey, { timeout: 8000 });
    await page.waitForSelector("#hof-activity li[data-type=payment]", { timeout: 10000 });
    ok(!(await page.$('.hof-case-actions [data-case-action="payment"]')) && Boolean(await page.$('.hof-case-actions [data-case-action="note"]')), "kayıt kartında Tahsilat düğmesi yok, Not var");
    ok(!(await page.$("#hof-activity li[data-type=payment] [data-edit]")) && Boolean(await page.$("#hof-activity li[data-type=payment] [data-delete]")), "İşlem Geçmişi'nde eski kayıt tahsilatı: düzelt yok, sil var");
    await shot("kayit-karti-eski-tahsilat");
  });

  await step("Stok → Yeni ürün: 'Kasa'ya yansıt' işaretsiz → Kasa değişmez", async () => {
    const before = (await api("/api/workspace/cash?period=all")).data.totals.balance;
    await page.click('#hof-sidecard [data-action="stock"]');
    await page.waitForSelector(".hof-stock-modal [data-act=new]", { timeout: 10000 });
    await page.click(".hof-stock-modal [data-act=new]");
    await page.waitForSelector('.hof-modal-backdrop.is-visible input[name="name"]', { timeout: 8000 });
    await page.fill('.hof-modal-backdrop.is-visible input[name="name"]', "Toner");
    const units = await page.$$eval('.hof-modal-backdrop.is-visible select[name="unit"] option', o => o.map(x => x.value));
    ok(units.length >= 20 && ["Adet", "Kg", "Lt", "Metre", "M²", "Paket", "Koli", "Saat"].every(u => units.includes(u)) && new Set(units.map(u => u.toLocaleLowerCase("tr-TR"))).size === units.length, `birim listesi ${units.length} seçenek, baş harfi büyük ve tekrarsız (v2.0.11)`);
    await page.selectOption('.hof-modal-backdrop.is-visible select[name="unit"]', "Adet");
    await page.fill('.hof-modal-backdrop.is-visible input[name="unitPrice"]', "850");
    await page.fill('.hof-modal-backdrop.is-visible input[name="openingQty"]', "2");
    const hint = await text(".hof-modal-backdrop.is-visible [data-opening-total]");
    ok(/1\.700,00/.test(hint) && /Kasa’ya yazılmaz/.test(hint), `işaretsiz: ${hint}`);
    await shot("stok-yeni-urun-kasasiz");
    await page.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await page.waitForFunction(() => /Toner/.test(document.querySelector(".hof-stock-modal")?.innerText || ""), null, { timeout: 10000 }).catch(async error => {
      console.log("STOK PENCERE:", await page.evaluate(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].map(n => n.innerText.replace(/\s+/g, " ").slice(0, 500))), "| konsol:", console_.join(" | "));
      throw error;
    });
    const after = (await api("/api/workspace/cash?period=all")).data;
    ok(after.totals.balance === before && !after.entries.some(e => e.source === "stock"), "Kasa değişmedi (stok gideri yazılmadı)");
    const stock = (await api("/api/workspace/stock")).data;
    ok(stock.items.find(i => i.name === "Toner")?.qty === 2, "Toner stoğa 2 adet girdi");
  });

  await step("Stok → Yeni ürün: 'Kasa'ya yansıt' işaretli → 10 × 120 = 1.200 'Stok ödemesi (alım)' gideri", async () => {
    const before = (await api("/api/workspace/cash?period=all")).data.totals.balance;
    // Ürün açılınca kartı açılır; listeye dönüp yeni ürün eklenir.
    if (await page.$('.hof-stock-modal [data-act="back"]')) await page.click('.hof-stock-modal [data-act="back"]');
    await page.waitForSelector(".hof-stock-modal [data-act=new]", { timeout: 8000 });
    await page.click(".hof-stock-modal [data-act=new]");
    await page.waitForSelector('.hof-modal-backdrop.is-visible input[name="name"]', { timeout: 8000 });
    await page.fill('.hof-modal-backdrop.is-visible input[name="name"]', "Fotokopi kağıdı");
    await page.selectOption('.hof-modal-backdrop.is-visible select[name="unit"]', "Paket");
    await page.fill('.hof-modal-backdrop.is-visible input[name="unitPrice"]', "120");
    await page.fill('.hof-modal-backdrop.is-visible input[name="openingQty"]', "10");
    await page.check('.hof-modal-backdrop.is-visible input[name="openingCash"]');
    const hint = await text(".hof-modal-backdrop.is-visible [data-opening-total]");
    ok(/1\.200,00/.test(hint) && /Stok ödemesi/.test(hint), `işaretli: ${hint}`);
    await shot("stok-yeni-urun-kasaya-yansit");
    await page.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await page.waitForFunction(() => /Fotokopi kağıdı/.test(document.querySelector(".hof-stock-modal")?.innerText || ""), null, { timeout: 10000 });
    const after = (await api("/api/workspace/cash?period=all")).data;
    const entry = after.entries.find(e => e.source === "stock");
    ok(entry && entry.kind === "out" && entry.amount === 1200 && /^Stok ödemesi \(alım\)/.test(entry.description), `Kasa gideri: ${entry?.description} ${entry?.amount}`);
    ok(after.totals.balance === before - 1200, `Kasa bakiyesi ${money(before)} → ${money(after.totals.balance)}`);
    await shot("stok-listesi");
    await page.click(".hof-stock-modal [data-close]");
  });

  await step("Tarayıcı konsolu", async () => {
    ok(console_.length === 0, console_.length ? `konsol: ${console_.join(" | ")}` : "konsolda hata yok");
  });
} catch (error) {
  console.log("\n" + (error.stack || error));
  await page.screenshot({ path: path.join(OUT, "HATA.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close().catch(() => {});
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${results.filter(r => r.ok).length}/${results.length} denetim geçti`);
if (results.some(r => !r.ok)) process.exitCode = 1;
