// Gerçek kullanıcı senaryosu (v2.0.8): sıfır kurulum, arayüzden, uçtan uca. Sayılar (bakiye, Kasa, kart, takvim) karşılaştırılır.
// Çalıştırma: npm run test:senaryo   (ekran görüntüleri test/e2e/artifacts/senaryo/ altına yazılır)
// Senaryo A: okul servisi Excel'i → yükleme sonrası soru → "Ön izle ve aktar" → Aktar → Taksitler / cari / Kasa / takvim / zil
//            → yeniden "Tablodan aktar" (çift kart açılmaz) → Geri al (kartlar, cariler, tahsilat geri) → yeniden aktar.
// Senaryo B: Stok → Yeni ürün: "Kasa'ya yansıt" işaretsiz → Kasa değişmez; işaretli → miktar × birim fiyat "Stok ödemesi (alım)".
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { okulServisiXlsx } from "../fixtures/okul-servisi-ornek.mjs";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo");
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const MACHINE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-prova-208-"));
const excel = path.join(root, "okul-servisi-ornek.xlsx");
writeFileSync(excel, okulServisiXlsx());
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: MACHINE } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1020 }, locale: "tr-TR" });
const page = await context.newPage();
const console_ = [];
page.on("pageerror", e => console_.push("pageerror " + e.message));
// Giriş ekranı açılırken oturum yoklaması (401 /api/auth/me) beklenen bir yanıttır; hata sayılmaz.
page.on("console", m => { if (m.type() === "error" && !/api\/auth\/me/.test(m.location().url || "")) console_.push(`${m.text()} @ ${m.location().url}`); });
const results = [];
let n = 0;
const shot = async (name, jpeg = false) => { n += 1; const file = path.join(OUT, `${String(n).padStart(2, "0")}-${name}.${jpeg ? "jpg" : "png"}`); await page.screenshot(jpeg ? { path: file, type: "jpeg", quality: 86 } : { path: file }); return file; };
const ok = (cond, msg) => { results.push({ ok: Boolean(cond), msg }); console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) throw new Error("BAŞARISIZ: " + msg); };
const api = async (url, body, method = body ? "POST" : "GET") => page.evaluate(async ([url, body, method]) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); return { status: r.status, ...j }; }, [url, body, method]);
const money = v => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const text = sel => page.$eval(sel, node => node.innerText.replace(/\s+/g, " ").trim());
const closeTop = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(300); };
const step = async (title, fn) => { console.log(`\n■ ${title}`); await fn(); };

try {
  await step("Giriş ve Excel yükleme (sıfır kurulum)", async () => {
    await page.goto(BASE + "/");
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-start .hof-drop");
    const input = await page.$("#hof-start .hof-drop input[type=file]");
    await input.setInputFiles(excel);
    await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 });
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click('.hof-modal-backdrop.is-visible [data-mode="replace"]')]);
    await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    ok((await text(".hof-analysis-result")).includes("Okul Servisi"), "sektör önerisi: Okul Servisi");
  });

  await step("Yükleme sonrası soru (engellemeyen bildirim) → 'Ön izle ve aktar'", async () => {
    await page.waitForTimeout(4000);
    ok(!(await page.$$eval(".hof-toast", nodes => nodes.some(node => /Taksitler'e aktarılsın mı/.test(node.textContent)))), "analiz penceresi açıkken soru sorulmaz (pencerenin altında kalıp sönmez)");
    // Kullanıcı sektör önerisini uygular; pencere kapanınca soru gelir.
    await page.click(".hof-analysis-result [data-apply]");
    await page.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Okul Servisi Yönetimi", null, { timeout: 5000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /Taksitler'e aktarılsın mı/.test(node.textContent)), null, { timeout: 20000 });
    const toast = await page.$$eval(".hof-toast", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")).join(" | "));
    ok(/6 kişinin ödeme planı/.test(toast), `bildirim metni: ${toast}`);
    await page.evaluate(() => document.querySelectorAll(".hof-notice").forEach(node => node.remove()));
    await shot("yukleme-sonrasi-soru");
    const action = '.hof-toast:has-text("Taksitler\'e aktarılsın mı") .hof-toast-action';
    ok(await page.$(action), "bildirimde 'Ön izle ve aktar' düğmesi var");
    await page.click(action);
    await page.waitForSelector(".hof-transfer-modal .hof-transfer-table", { timeout: 30000 });
  });

  let pillAmount = 0;
  let pillName = "";
  await step("Ön izleme kapatılır; önce şeritten bir tahsilat alınır (kayıt tahsilatı)", async () => {
    await page.click(".hof-transfer-modal [data-close]");
    await page.waitForFunction(() => !document.querySelector(".hof-transfer-modal"), null, { timeout: 5000 });
    await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 10000 });
    await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast").forEach(node => node.remove()));
    const heading = await text(".hof-payment-promises-heading");
    ok(/2 gecikmiş/.test(heading) && /4 bugün\/bu ay/.test(heading), `şerit (aktarımdan önce, tablodan): ${heading}`);
    pillName = await page.$eval(".hof-payment-pill:not([aria-hidden])", node => node.querySelector("b").textContent);
    await page.$eval(".hof-payment-pill:not([aria-hidden])", node => node.click());
    await page.click('.hof-payment-action-card [data-act="pay"]');
    await page.waitForSelector('.hof-modal-backdrop.is-visible input[name="amount"]');
    const amount = await page.inputValue('.hof-modal input[name="amount"]');
    pillAmount = Number(amount.replace(/\./g, "").replace(",", "."));
    await page.click('.hof-modal button[type="submit"]');
    await page.waitForFunction(() => document.querySelectorAll(".hof-payment-pill:not([aria-hidden])").length === 5, null, { timeout: 10000 });
    ok(pillAmount > 0, `${pillName} için ${money(pillAmount)} ₺ kayıt tahsilatı girildi; pil kayboldu`);
  });

  const cashBefore = (await api("/api/workspace/cash?period=all")).data.totals.balance;
  await step("Taksitler → Tablodan aktar: ön izleme (kılavuz görseli)", async () => {
    await page.click('#hof-sidecard [data-action="plans"]');
    await page.waitForSelector('.hof-plans [data-act="transfer"]', { timeout: 10000 });
    await page.click('.hof-plans [data-act="transfer"]');
    await page.waitForSelector(".hof-transfer-modal .hof-transfer-table", { timeout: 30000 });
    const rows = await page.$$eval(".hof-transfer-table tbody tr[data-key]", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    ok(rows.length === 6, "6 öğrenci listelendi");
    const can = rows.find(r => /Can Öztürk/.test(r));
    ok(/4 taksit/.test(can) && /15\.200,00/.test(can) && /9\.500,00/.test(can) && /5\.700,00/.test(can), `Can Öztürk: 4 taksit, toplam 15.200, ödenen 9.500, kalan 5.700 → ${can}`);
    const sum = await text(".hof-transfer-sum");
    ok(new RegExp(money(pillAmount).replace(/\./g, "\\.")).test(sum) && /kayıt tahsilatı/.test(sum), `özet satırı kayıt tahsilatını sayıyor: ${sum}`);
    await page.click(`.hof-transfer-table tbody tr[data-key]:has-text("Can Öztürk") [data-expand]`);
    await page.waitForSelector(".hof-transfer-detail .hof-transfer-items", { timeout: 5000 });
    const detail = await text(".hof-transfer-detail");
    ok(/1\.900,00/.test(detail), `taksit ayrıntısı bu ayın kısmi ödemesini gösteriyor: ${detail.slice(0, 200)}`);
    await page.click(`.hof-transfer-table tbody tr[data-key]:has-text("Can Öztürk") [data-expand]`);
    await page.click(`.hof-transfer-table tbody tr[data-key]:has-text("Ada Yılmaz") [data-expand]`);
    await page.waitForSelector(".hof-transfer-detail .hof-transfer-items", { timeout: 5000 });
    await shot("tablodan-aktar-on-izleme", true);
  });

  await step("Aktar → sonuç", async () => {
    ok(/6 kişiyi aktar/.test(await text(".hof-transfer-modal [data-commit]")), "düğme: 6 kişiyi aktar");
    await page.click(".hof-transfer-modal [data-commit]");
    await page.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 8000 });
    await shot("aktar-onay");
    await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-title")].some(node => node.textContent === "Aktarım tamamlandı"), null, { timeout: 60000 });
    const result = await text(".hof-transfer-result");
    ok(/6 taksit kartı açıldı/.test(result) && /6 cari açıldı/.test(result) && /1 tahsilat/.test(result) && /Kasa toplamı değişmedi/.test(result), `sonuç: ${result}`);
    await shot("aktarim-sonucu");
    await page.click(".hof-modal-backdrop.is-visible [data-result-close]");
    await page.waitForFunction(() => ![...document.querySelectorAll(".hof-modal-title")].some(node => node.textContent === "Aktarım tamamlandı"), null, { timeout: 8000 });
    await page.waitForFunction(() => !document.querySelector(".hof-transfer-modal"), null, { timeout: 8000 });
    ok(true, "'Tamam' aktarım penceresini de kapattı; Taksitler listesine dönüldü");
  });

  await step("Taksitler listesi ve Can Öztürk kartı (açılış/devir Kasa dışı, makbuzsuz)", async () => {
    await page.waitForFunction(() => document.querySelectorAll(".hof-plans tr[data-plan]").length === 6, null, { timeout: 10000 });
    await shot("taksitler-listesi");
    await page.click('.hof-plans tr[data-plan]:has-text("Can Öztürk")');
    await page.waitForSelector(".hof-plans-entries", { timeout: 10000 });
    const card = await text(".hof-modal-backdrop.is-visible:last-of-type .hof-modal, .hof-plans-modal");
    const entries = await page.$$eval(".hof-plans-entries tr[data-entry]", nodes => nodes.map(node => ({ opening: node.hasAttribute("data-opening"), text: node.innerText.replace(/\s+/g, " "), makbuz: Boolean(node.querySelector('a[href*="makbuz"]')) })));
    const openings = entries.filter(e => e.opening);
    ok(openings.length === 3 && openings.every(e => /Açılış \(devir\)/.test(e.text) && /Kasa dışı/i.test(e.text) && !e.makbuz), `3 açılış (devir) hareketi: Kasa dışı rozetli, makbuz bağlantısı yok`);
    ok(entries.filter(e => !e.opening).length === 0, "Can Öztürk'te program tahsilatı yok (şeritten alınan Mert Çelik'indi)");
    ok(/5\.700,00/.test(card), "kartta kalan 5.700,00");
    await shot("taksit-karti-can-ozturk");
    await page.click('.hof-plans [data-act="back"]');
    // Şeritten tahsilat alınan kişinin kartı: taşınan tahsilat makbuzlu, açılışlar makbuzsuz.
    await page.waitForFunction(() => document.querySelectorAll(".hof-plans tr[data-plan]").length === 6, null, { timeout: 10000 });
    await page.click(`.hof-plans tr[data-plan]:has-text("${pillName}")`);
    await page.waitForSelector(".hof-plans-entries tr[data-entry]", { timeout: 10000 });
    const mertEntries = await page.$$eval(".hof-plans-entries tr[data-entry]", nodes => nodes.map(node => ({ opening: node.hasAttribute("data-opening"), text: node.innerText.replace(/\s+/g, " "), makbuz: Boolean(node.querySelector('a[href*="makbuz"]')) })));
    const moved = mertEntries.filter(e => !e.opening);
    ok(moved.length === 1 && moved[0].makbuz && new RegExp(money(pillAmount).replace(/\./g, "\\.")).test(moved[0].text), `${pillName}: taşınan kayıt tahsilatı kartta, makbuzlu: ${moved[0]?.text}`);
    ok(mertEntries.filter(e => e.opening).every(e => !e.makbuz), "açılış (devir) satırlarında makbuz yok");
    await shot("taksit-karti-tahsilat-tasinan");
    await closeTop();
  });

  await step("Cari kartı: bakiye ve 'Açılış (devir)' satırları", async () => {
    await page.waitForFunction(() => !document.querySelector(".hof-plans-modal"), null, { timeout: 8000 }).catch(() => {});
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(".hof-accounts-modal tr[data-account]", { timeout: 10000 });
    const accRows = await page.$$eval(".hof-accounts-modal tr[data-account]", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    ok(accRows.length === 6 && accRows.every(r => /tabloda kayıtlı/.test(r)), "6 cari, hepsi tablodaki kayda bağlı (çift cari yok)");
    await page.click('.hof-accounts-modal tr[data-account]:has-text("Can Öztürk") b');
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-accounts-modal")].some(node => /Açılış \(devir\)/.test(node.innerText)), null, { timeout: 10000 }).catch(async error => {
      const all = await page.$$eval(".hof-accounts-modal", nodes => nodes.map(node => [node.innerText.length, node.innerText.indexOf("Hareketler"), node.innerText.replace(/\s+/g, " ").slice(-300)]));
      console.log("CARİ PENCERE:", JSON.stringify(all));
      throw error;
    });
    const ledger = await page.$$eval(".hof-accounts-modal", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")).join(" "));
    ok(/Açılış \(devir\)/.test(ledger) && /5\.700,00/.test(ledger), "cari ekstresinde açılış (devir) satırları ve 5.700,00 bakiye");
    await shot("cari-can-ozturk");
    await page.click(".hof-accounts-modal [data-close]");
    await page.waitForFunction(() => !document.querySelector(".hof-accounts-modal"), null, { timeout: 5000 });
  });

  await step("Kasa: aktarım Kasa'yı değiştirmedi; tek tahsilat artık taksit tahsilatı", async () => {
    const cash = (await api("/api/workspace/cash?period=all")).data;
    ok(cash.totals.balance === cashBefore && cashBefore === pillAmount, `Kasa bakiyesi ${money(cash.totals.balance)} (aktarımdan önce ${money(cashBefore)})`);
    ok(cash.entries.filter(e => e.source === "plan").length === 1 && !cash.entries.some(e => e.source === "payment") && !cash.entries.some(e => /Açılış/.test(e.description || "")), "Kasa'da tek kayıt (taksit tahsilatı); açılış/devir Kasa'ya yazılmadı");
    await page.evaluate(() => HOF.workspace.openCash());
    await page.waitForSelector(".hof-cash-table", { timeout: 10000 });
    await shot("kasa");
    await closeTop();
  });

  await step("Takvim ve zil: tablodan ikinci kez gelmez (çift sayım yok)", async () => {
    const dues = (await api("/api/workspace/dues")).data;
    ok(!dues.items.some(i => i.source !== "plan" && i.tab === "Öğrenciler"), "takvimde tablodan gelen öğrenci kalemi yok");
    ok(dues.items.filter(i => i.source === "plan").length >= 4, `takvim kart taksitlerini gösteriyor (${dues.items.filter(i => i.source === "plan").length} kalem)`);
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 8000 });
    await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 10000 });
    const heading = await text(".hof-payment-promises-heading");
    const pills = await page.$$eval(".hof-payment-pill:not([aria-hidden])", nodes => nodes.map(n => n.innerText.replace(/\s+/g, " ")));
    // Kartlar her açık taksiti ayrı gösterir; aynı kişi+ay iki kez yok. Sayılar ayın gününe bağlıdır (ayın 1'inde bu ayın
    // taksiti "bugün", sonraki ayınki henüz 7 günlük pencerede değil), bu yüzden beklenen şerit takvimin kendisinden okunur.
    console.log("piller:", JSON.stringify(pills));
    const keys = pills.map(p => p.replace(/₺[\d.,]+/g, "").replace(/\s+/g, " ").trim());
    const planDues = dues.items.filter(i => i.source === "plan");
    const overdue = planDues.filter(i => i.state === "overdue").length;
    const upcoming = planDues.filter(i => i.state === "upcoming").length;
    ok(pills.length === planDues.length && (!overdue || new RegExp(`${overdue} gecikmiş`).test(heading)) && (!upcoming || new RegExp(`${upcoming} yaklaşan`).test(heading)) && new Set(keys).size === keys.length, `şerit (aktarımdan sonra, kartlardan): ${heading} — ${pills.length} pil = takvimdeki ${planDues.length} kart kalemi, çift yok`);
    // Fikstür: Zeynep geçen ayı ödemedi (gecikmiş); Efe, Zeynep, Can (kısmi) ve Mert bu ayı ödemedi. Ada ve Deniz hiç görünmez.
    const who = name => pills.filter(p => p.includes(name)).length;
    ok(who("Zeynep Demir") >= 2 && who("Efe Kaya") >= 1 && who("Can Öztürk") >= 1 && who("Ada Yılmaz") === 0 && who("Deniz Arslan") === 0, "şeritte doğru kişiler: Zeynep (geçen ay + bu ay), Efe, Can; tamamını ödeyen Ada ve Deniz yok");
    ok(!pills.some(p => new RegExp(pillName).test(p) && /Ağustos/.test(p)), `${pillName} için ödenen Ağustos taksiti şeritte değil`);
    await shot("serit-kartlardan");
    await page.click(".topbar .top-actions > .icon-button");
    await page.waitForSelector(".hof-alert-list");
    const bellItems = await page.$$eval(".hof-alert-list li, .hof-alert-list .hof-alert-item, .hof-alert-list [data-alert]", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ").trim()).filter(Boolean));
    const canItems = bellItems.filter(item => /Can Öztürk/.test(item));
    console.log("zil (Can Öztürk):", JSON.stringify(canItems));
    // Aynı kişi + aynı vade iki kez görünmez (tablodan ve karttan çift kalem yok); farklı taksitler ayrı satırdır.
    const canKeys = canItems.map(item => (item.match(/\d{2}\.\d{2}\.\d{4}|Eylül|Ekim|Ağustos|Temmuz/g) || []).join("|"));
    ok(canItems.length >= 1 && new Set(canKeys).size === canKeys.length && !/Öğrenciler/.test(canItems.join(" ")), `zil listesinde Can Öztürk ${canItems.length} satır, hepsi farklı vade, tablodan gelen yok`);
    await closeTop();
  });

  let importId = "";
  await step("Yeniden 'Tablodan aktar': herkes 'kartı var', aktarılacak kimse yok (çift kart açılmaz)", async () => {
    await page.click('#hof-sidecard [data-action="plans"]');
    await page.waitForSelector('.hof-plans [data-act="transfer"]', { timeout: 10000 });
    await page.click('.hof-plans [data-act="transfer"]');
    await page.waitForSelector(".hof-transfer-modal", { timeout: 30000 });
    await page.waitForFunction(() => /Son aktarımlar \(1\)/i.test(document.querySelector(".hof-transfer-modal")?.innerText || ""), null, { timeout: 10000 });
    const modal = await text(".hof-transfer-modal");
    const commit = await page.$(".hof-transfer-modal [data-commit]");
    const commitDisabled = commit ? await commit.evaluate(n => n.disabled || /0 kişi/.test(n.textContent)) : true;
    ok(/Kartı var 6|6 kartı var|Kartı var/i.test(modal) && commitDisabled, `ikinci açılışta aktarılacak kimse yok: ${modal.slice(0, 260)}`);
    await shot("ikinci-acilis-karti-var");
    importId = await page.$eval(".hof-transfer-modal [data-undo]", n => n.dataset.undo);
    ok(importId, "Son aktarımlar listesinde Geri al düğmesi var");
  });

  await step("Geri al: kartlar, cariler kaldırılır; tahsilat kayıt kartına döner; takvim tabloya döner", async () => {
    await page.click(".hof-transfer-modal .hof-transfer-imports summary");
    await page.waitForSelector(".hof-transfer-modal [data-undo]:visible", { timeout: 5000 });
    await shot("son-aktarimlar-geri-al");
    await page.click(".hof-transfer-modal [data-undo]");
    await page.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 8000 });
    await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /Aktarım geri alındı/i.test(node.textContent)), null, { timeout: 15000 });
    const undoToast = await page.evaluate(() => [...document.querySelectorAll(".hof-toast")].map(node => node.innerText.replace(/\s+/g, " ")).find(t => /Aktarım geri alındı/i.test(t)));
    ok(/6 kart kaldırıldı/.test(undoToast) && /1 tahsilat kayıt kartına döndü/.test(undoToast), `geri alma bildirimi: ${undoToast}`);
    await page.waitForTimeout(1200);
    const plans = (await api("/api/workspace/plans?status=all")).data;
    ok(plans.plans.length === 0, "taksit kartı kalmadı");
    const accounts = (await api("/api/workspace/accounts")).data;
    ok((accounts.items || accounts.accounts || []).length === 0, "aktarımın açtığı cariler kaldırıldı");
    const cash = (await api("/api/workspace/cash?period=all")).data;
    ok(cash.totals.balance === pillAmount && cash.entries.some(e => e.source === "payment") && !cash.entries.some(e => e.source === "plan"), "tahsilat kayıt kartına döndü; Kasa bakiyesi aynı");
    const dues = (await api("/api/workspace/dues")).data;
    ok(dues.items.some(i => i.source !== "plan" && i.tab === "Öğrenciler") && !dues.items.some(i => i.source === "plan"), "takvim yeniden tablodan besleniyor");
    await shot("geri-alindi");
  });

  await step("Yeniden aktar (Tablodan aktar düğmesiyle): aynı sonuç", async () => {
    await page.waitForSelector('.hof-plans [data-act="transfer"]', { timeout: 10000 });
    await page.click('.hof-plans [data-act="transfer"]').catch(() => {});
    await page.waitForSelector(".hof-transfer-modal .hof-transfer-table tbody tr[data-key]", { timeout: 30000 });
    await page.click(".hof-transfer-modal [data-commit]");
    await page.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 8000 });
    await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-title")].some(node => node.textContent === "Aktarım tamamlandı"), null, { timeout: 60000 });
    const result = await text(".hof-transfer-result");
    ok(/6 taksit kartı açıldı/.test(result) && /1 tahsilat/.test(result), `ikinci aktarım sonucu: ${result}`);
    await page.click(".hof-modal-backdrop.is-visible [data-result-close]");
    await page.waitForFunction(() => !document.querySelector(".hof-transfer-modal"), null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelectorAll(".hof-plans tr[data-plan]").length === 6, null, { timeout: 10000 });
    await closeTop();
    await page.waitForFunction(() => !document.querySelector(".hof-plans-modal"), null, { timeout: 8000 }).catch(() => {});
    const cash = (await api("/api/workspace/cash?period=all")).data;
    ok(cash.totals.balance === pillAmount, "Kasa yine değişmedi");
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
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${results.filter(r => r.ok).length}/${results.length} denetim geçti`);
if (results.some(r => !r.ok)) process.exitCode = 1;
