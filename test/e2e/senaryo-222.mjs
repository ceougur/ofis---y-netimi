// Senaryo 2.0.22 — Excel denetimi bulguları (04.10.2026), arayüzden, sıfırdan:
//  madde 5: fatura isteğinin yanıtı kaybolunca (sunucu kaydetti, ekran öğrenemedi) yeniden "Faturayı Kaydet" → TEK fatura;
//  madde 1/2: başka personel saniyede bir parasal kayıt girerken açık pencereler yenilemeleri birleştirir (istek sayısı),
//            veri yine güncel kalır; Cari aramasında yazılan metin ve sonuç doğru;
//  madde 1/2 (S2): başka personelin cari notu düzeltmesi ANLIK DURUM'u yeniden yükletmez, parasal kayıt yükletir.
// Çalıştırma: npm run test:senaryo-222
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-222");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const STAFF = "Prova-Personel-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-222-"));
const pad = v => String(v).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f22" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const admin = await context.newPage();
const errors = [];
admin.on("pageerror", error => errors.push(`pageerror ${error.message}`));
admin.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me|Failed to load resource|net::ERR_FAILED/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
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
  await admin.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
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
const modal = ".hof-modal-backdrop.is-visible";
const inv = `${modal} .hof-invoices-modal`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const get = async url => unwrap(await api.get(url));
const closeAll = async () => {
  for (let i = 0; i < 6 && (await admin.$(modal)); i += 1) {
    await admin.keyboard.press("Escape");
    await admin.waitForTimeout(250);
  }
};
const confirmYes = async () => {
  await admin.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 8000 });
  await admin.click(`${modal} [data-answer="yes"]`);
};
// Sayfanın API isteklerini uç başına sayar (yalnız GET; arka plan yenilemeleri).
const counter = page => {
  const counts = {};
  const listener = request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/") || request.method() !== "GET") return;
    counts[url.pathname] = (counts[url.pathname] || 0) + 1;
  };
  page.on("request", listener);
  return { counts, stop: () => page.off("request", listener) };
};

const ids = { customers: [] };
try {
  await step("Kurulum: yönetici girer; 12 müşteri, ürün, Kasa açılışı; ikinci personel (Muhasebe)", async () => {
    await api.login("admin", PASS);
    for (let i = 1; i <= 12; i += 1) ids.customers.push(unwrap(await api.post("/api/workspace/accounts", { name: `Müşteri ${pad(i)}`, type: "customer", phone: `0532 100 00 ${pad(i)}` })).id);
    ids.item = unwrap(await api.post("/api/workspace/stock", { name: "Deneme Kalemi", code: "DK-1", unit: "Adet", unitPrice: 50, salePrice: 100, openingQty: 100 })).id;
    await api.post("/api/workspace/cash", { kind: "in", amount: 10000, date: TODAY, description: "Açılış" });
    const created = await api.post("/api/admin/users", { username: "muhasebe2", name: "Muhasebe İki", role: "muhasebe", password: STAFF, mustChangePassword: false });
    ok(created.status === 200, "ikinci personel açıldı");
    await admin.goto(`${BASE}/`);
    await admin.fill("#hof-auth input[name=username]", "admin");
    await admin.fill("#hof-auth input[name=password]", PASS);
    await admin.click('#hof-auth button[type="submit"]');
    await admin.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 60000 });
    await admin.waitForTimeout(2500);
    ok(ids.customers.length === 12 && Boolean(ids.item), "veri hazır");
  });

  await step("Madde 5: yanıt kaybolur (sunucu kaydetti), kullanıcı yeniden Faturayı Kaydet'e basar → tek fatura", async () => {
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-scenario="goods_sale"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    await admin.fill(`${inv} [data-acc-query]`, "Müşteri 01");
    await admin.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
    await (await admin.$(`${inv} .hof-acc-picker li[data-id]`)).dispatchEvent("mousedown");
    await admin.click(`${inv} [data-l="0"][data-f="name"]`);
    await admin.keyboard.type("Deneme");
    await admin.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
    await admin.click(`${inv} [data-hits="0"] li[data-item]`);
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "2");
    await admin.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, "100");
    await admin.waitForTimeout(1000);
    const headers = [];
    let dropped = false;
    // İlk "kaydet" isteği sunucuya gider ve işlenir; yanıtı tarayıcıya ulaşmaz (ağ koptu / zaman aşımı gibi).
    await admin.route(url => new URL(url).pathname === "/api/workspace/invoices", async route => {
      if (route.request().method() !== "POST") return route.continue();
      headers.push(route.request().headers()["x-hof-request"] || "");
      if (!dropped) {
        dropped = true;
        await route.fetch();
        return route.abort("failed");
      }
      return route.continue();
    });
    await admin.click(`${inv} [data-act="issue"]`);
    await confirmYes();
    const failedShown = await admin.waitForFunction(() => /Sunucuya ulaşılamadı|zamanında yanıt vermedi/.test(document.body.innerText), null, { timeout: 15000 }).then(() => true, () => false);
    ok(failedShown, "ekran yanıtı alamadığını söyledi (form açık kaldı)");
    const afterFirst = (await get(`/api/workspace/invoices?tab=sale&limit=50`)).invoices.filter(doc => doc.status === "issued");
    ok(afterFirst.length === 1, `sunucu ilk isteği zaten kaydetmişti (${afterFirst.length} fatura)`);
    await shot("yanit-kayboldu");
    await admin.click(`${inv} [data-act="issue"]`);
    await confirmYes();
    const opened = await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 }).then(() => true, () => false);
    ok(opened, "ikinci basışta fatura kartı açıldı");
    const toast = await admin.evaluate(() => [...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" | "));
    ok(/zaten kaydedilmişti/.test(toast), `bildirim: ${toast.split(" | ").filter(Boolean).at(-1) || "yok"}`);
    ok(headers.length === 2 && headers[0] && headers[0] === headers[1], `iki gönderim aynı istek kimliğiyle (${headers.map(h => h.slice(0, 8)).join(" = ")})`);
    const docs = (await get(`/api/workspace/invoices?tab=sale&limit=50`)).invoices.filter(doc => doc.status === "issued");
    ok(docs.length === 1, `tek fatura (${docs.length})`);
    const customer = await get(`/api/workspace/accounts/${ids.customers[0]}`);
    ok(customer.totals.balance === 240, `müşteri borcu bir kez: ${customer.totals.balance} (2 × 100 + %20 KDV = 240)`);
    ok((await get(`/api/workspace/stock/${ids.item}`)).qty === 98, "stoktan bir kez düştü (100 → 98)");
    await shot("tek-fatura");
    await admin.unroute(url => new URL(url).pathname === "/api/workspace/invoices");
    // Yeni form yeni kimlik: gerçekten ikinci satış serbest.
    await closeAll();
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-scenario="goods_sale"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    await admin.fill(`${inv} [data-acc-query]`, "Müşteri 01");
    await admin.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
    await (await admin.$(`${inv} .hof-acc-picker li[data-id]`)).dispatchEvent("mousedown");
    await admin.click(`${inv} [data-l="0"][data-f="name"]`);
    await admin.keyboard.type("Deneme");
    await admin.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
    await admin.click(`${inv} [data-hits="0"] li[data-item]`);
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "2");
    await admin.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, "100");
    await admin.waitForTimeout(1000);
    await admin.click(`${inv} [data-act="issue"]`);
    await confirmYes();
    await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 });
    ok((await get(`/api/workspace/invoices?tab=sale&limit=50`)).invoices.filter(doc => doc.status === "issued").length === 2, "aynı içerikli ikinci satış (yeni form) ayrı fatura olarak kaydedildi");
    await closeAll();
  });

  await step("Madde 1/2: başka personel 10 parasal kayıt girerken açık Cari penceresi ve ana ekran yenilemeleri birleştirir", async () => {
    const colleague = createClient(BASE);
    ok((await colleague.login("muhasebe2", STAFF)).status === 200, "ikinci personel girdi (ayrı oturum)");
    await admin.click("#hof-sidecard [data-action=accounts]");
    await admin.waitForSelector(`${modal} tr[data-account]`);
    await admin.waitForTimeout(2500);
    const log = counter(admin);
    for (let i = 0; i < 10; i += 1) {
      const r = await colleague.post(`/api/workspace/accounts/${ids.customers[1]}/entries`, { kind: "in", amount: 10, date: TODAY, method: "cash", note: `eşzamanlı ${i}` });
      if (r.status !== 200) ok(false, `personel kaydı ${i}: ${r.status}`);
      await admin.waitForTimeout(1000);
    }
    await admin.waitForTimeout(5000);
    log.stop();
    const c = log.counts;
    const total = Object.values(c).reduce((s, n) => s + n, 0);
    console.log(`    istekler: ${JSON.stringify(c)}`);
    ok((c["/api/workspace/accounts"] || 0) >= 1 && (c["/api/workspace/accounts"] || 0) <= 12, `Cari listesi ${c["/api/workspace/accounts"] || 0} kez yenilendi (10 kayıt; 2.0.21'de 20–30 kez)`);
    ok((c["/api/workspace/dues"] || 0) <= 6, `vade takvimi ${c["/api/workspace/dues"] || 0} kez (2.0.21'de 11–20 kez, her biri büyük)`);
    ok((c["/api/workspace/invoices"] || 0) <= 7 && (c["/api/workspace/plans"] || 0) <= 7, `rozetler: fatura ${c["/api/workspace/invoices"] || 0}, taksit ${c["/api/workspace/plans"] || 0} kez (2.0.21'de 10'ar)`);
    ok(total <= 50, `toplam ${total} istek (2.0.21'de aynı koşulda ~100)`);
    // Veri güncel: Müşteri 02'nin bakiyesi listede −100 (10 × 10 TL tahsilat, borcu yoktu → alacaklı 100).
    const row = await admin.$eval(`${modal} tr[data-account="${ids.customers[1]}"]`, node => node.innerText.replace(/\s+/g, " ")).catch(() => "");
    ok(/100,00/.test(row), `listede Müşteri 02 güncel: ${row.slice(0, 120)}`);
    await shot("cari-listesi-guncel");
  });

  await step("Madde 1/2: başka personel kayıt girerken Cari aramasında yazılan metin ve sonuç doğru", async () => {
    const colleague = createClient(BASE);
    await colleague.login("muhasebe2", STAFF);
    let alive = true;
    const noise = (async () => {
      let i = 0;
      while (alive) {
        await colleague.post(`/api/workspace/accounts/${ids.customers[2 + (i % 8)]}/entries`, { kind: "in", amount: 5, date: TODAY, method: "cash", note: `arama sırasında ${i}` });
        i += 1;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    })();
    const box = await admin.$(`${modal} input[data-filter=q]`);
    await box.click();
    await admin.keyboard.type("Müşteri 07", { delay: 120 });
    const shown = await admin.waitForFunction(sel => {
      const rows = [...document.querySelectorAll(`${sel} tr[data-account]`)];
      return rows.length === 1 && rows[0].innerText.includes("Müşteri 07");
    }, modal, { timeout: 15000 }).then(() => true, () => false);
    alive = false;
    await noise;
    ok((await admin.$eval(`${modal} input[data-filter=q]`, node => node.value)) === "Müşteri 07", "kutudaki metin eksiksiz (harf kaybolmadı)");
    ok(shown, "listede yalnız Müşteri 07 kaldı (arama sonucu arka plan yenilemesinde kaybolmadı)");
    await shot("arama-yuk-altinda");
    await admin.fill(`${modal} input[data-filter=q]`, "");
    await closeAll();
  });

  await step("Madde 1/2 (denetim 5.2): başka personel saniyede 2 kayıt girerken Faturalar → Yeni → Satış formu açılır ve kaydedilir", async () => {
    const colleague = createClient(BASE);
    await colleague.login("muhasebe2", STAFF);
    let alive = true;
    let written = 0;
    const noise = (async () => {
      while (alive) {
        const r = await colleague.post(`/api/workspace/accounts/${ids.customers[4 + (written % 6)]}/entries`, { kind: "in", amount: 3, date: TODAY, method: "cash", note: `form sırasında ${written}` });
        if (r.status === 200) written += 1;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    })();
    const started = Date.now();
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`, { timeout: 20000 });
    await admin.click(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-scenario="goods_sale"]`);
    const opened = await admin.waitForSelector(`${inv} [data-lines]`, { timeout: 20000 }).then(() => true, () => false);
    const openMs = Date.now() - started;
    ok(opened && openMs < 8000, `satış formu ${openMs} ms'de açıldı (yük altında)`);
    await admin.fill(`${inv} [data-acc-query]`, "Müşteri 12");
    await admin.waitForSelector(`${inv} .hof-acc-picker li[data-id]`, { timeout: 15000 });
    await (await admin.$(`${inv} .hof-acc-picker li[data-id]`)).dispatchEvent("mousedown");
    await admin.click(`${inv} [data-l="0"][data-f="name"]`);
    await admin.keyboard.type("Deneme");
    await admin.waitForSelector(`${inv} [data-hits="0"] li[data-item]`, { timeout: 15000 });
    await admin.click(`${inv} [data-hits="0"] li[data-item]`);
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "1");
    await admin.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, "100");
    await admin.waitForTimeout(1000);
    await admin.click(`${inv} [data-act="issue"]`);
    await confirmYes();
    const saved = await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 20000 }).then(() => true, () => false);
    alive = false;
    await noise;
    ok(saved && written >= 4, `fatura kaydedildi; bu sırada öbür personel ${written} kayıt girdi`);
    const balance = (await get(`/api/workspace/accounts/${ids.customers[11]}`)).totals.balance;
    ok(balance === 120, `Müşteri 12 borcu ${balance} (100 + %20 KDV)`);
    await shot("yuk-altinda-fatura");
    await closeAll();
  });

  await step("Pencere bozulmaz: arka plan yenilemesi başarısız olunca liste, arama kutusu ve açık kart yerinde kalır; silinen cari bildirilir", async () => {
    // v2.0.21'de liste yenilenemeyince (yük altında 30 sn'yi aşan istek) pencere gövdesi hata yazısıyla değişiyor, arama
    // kutusu kayboluyordu; açık kartın yenilemesi hata alınca kullanıcı listeye atılıyordu (yük ölçümünde görüldü).
    const colleague = createClient(BASE);
    await colleague.login("muhasebe2", STAFF);
    const lonely = unwrap(await api.post("/api/workspace/accounts", { name: "Silinecek Cari", type: "customer" })).id;
    await admin.click("#hof-sidecard [data-action=accounts]");
    await admin.waitForSelector(`${modal} tr[data-account]`);
    await admin.fill(`${modal} input[data-filter=q]`, "Müşteri 0");
    await admin.waitForFunction(sel => [...document.querySelectorAll(`${sel} tr[data-account]`)].length === 9, modal, { timeout: 10000 });
    const isList = url => new URL(url).pathname === "/api/workspace/accounts";
    let failedCalls = 0;
    await admin.route(isList, route => {
      if (route.request().method() !== "GET") return route.continue();
      failedCalls += 1;
      return route.abort("failed");
    });
    await colleague.post(`/api/workspace/accounts/${ids.customers[5]}/entries`, { kind: "in", amount: 7, date: TODAY, method: "cash", note: "yenileme hatası denemesi" });
    await admin.waitForTimeout(3500);
    const state = await admin.evaluate(sel => ({
      input: document.querySelector(`${sel} input[data-filter=q]`)?.value ?? null,
      rows: document.querySelectorAll(`${sel} tr[data-account]`).length,
      error: document.querySelector(`${sel} .hof-empty`)?.textContent || "",
    }), modal);
    ok(failedCalls >= 1, `arka plan yenilemesi denendi ve başarısız oldu (${failedCalls} kez)`);
    ok(state.input === "Müşteri 0" && state.rows === 9 && !state.error, `liste ve arama kutusu yerinde (kutuda "${state.input}", ${state.rows} satır${state.error ? `, hata yazısı: ${state.error}` : ""})`);
    await shot("yenileme-hatasinda-liste-yerinde");
    // Bağlantı düzelince başka bir değişiklik gelmeden de liste güncellenir (başarısız yenileme yeniden denenir).
    await admin.unroute(isList);
    const want = Math.abs((await get(`/api/workspace/accounts/${ids.customers[5]}`)).totals.balance);
    const wantText = want.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const refreshed = await admin.waitForFunction(([sel, id, text]) => (document.querySelector(`${sel} tr[data-account="${id}"]`)?.innerText || "").includes(text), [modal, ids.customers[5], wantText], { timeout: 15000 }).then(() => true, () => false);
    ok(refreshed, `bağlantı düzelince liste kendiliğinden güncellendi (Müşteri 06: ${wantText})`);
    // Açık kart: yenilemesi başarısız olunca kullanıcı kartta kalır.
    await admin.click(`${modal} tr[data-account="${ids.customers[5]}"]`);
    await admin.waitForSelector(`${modal} [data-act="back"]`, { timeout: 10000 });
    const isCard = url => new URL(url).pathname === `/api/workspace/accounts/${ids.customers[5]}`;
    await admin.route(isCard, route => (route.request().method() === "GET" ? route.abort("failed") : route.continue()));
    await colleague.post(`/api/workspace/accounts/${ids.customers[5]}/entries`, { kind: "in", amount: 8, date: TODAY, method: "cash", note: "kart yenileme hatası" });
    await admin.waitForTimeout(3500);
    const stillCard = await admin.evaluate(sel => Boolean(document.querySelector(`${sel} [data-act="back"]`)) && !document.querySelector(`${sel} input[data-filter=q]`) && Boolean(document.querySelector(sel)?.innerText.includes("Müşteri 06")), modal);
    ok(stillCard, "açık kartın yenilemesi başarısız oldu, kullanıcı kartta kaldı (listeye atılmadı)");
    await admin.unroute(isCard);
    await closeAll();
    // Başka bilgisayarda silinen cari: kart açıkken silinince bildirilir, liste açılır.
    await admin.click("#hof-sidecard [data-action=accounts]");
    await admin.waitForSelector(`${modal} input[data-filter=q]`);
    await admin.fill(`${modal} input[data-filter=q]`, "Silinecek");
    await admin.waitForSelector(`${modal} tr[data-account="${lonely}"]`, { timeout: 10000 });
    await admin.click(`${modal} tr[data-account="${lonely}"]`);
    await admin.waitForSelector(`${modal} [data-act="back"]`, { timeout: 10000 });
    const removed = await api.del(`/api/workspace/accounts/${lonely}`);
    ok(removed.status === 200, `cari başka oturumda silindi (${removed.status})`);
    const back = await admin.waitForFunction(sel => Boolean(document.querySelector(`${sel} input[data-filter=q]`)) && /bulunamadı|Silinmiş/i.test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), modal, { timeout: 10000 }).then(() => true, () => false);
    ok(back, "silinen carinin kartı bildirimle kapandı, liste açıldı");
    await closeAll();
  });

  await step("S2: başka personelin cari notu düzeltmesi ANLIK DURUM'u yeniden yükletmez; parasal kayıt yükletir", async () => {
    const colleague = createClient(BASE);
    await colleague.login("muhasebe2", STAFF);
    // Boş veriyle ana ekran başlangıç görünümündedir; ANLIK DURUM kartı çizilmese de verisi yüklenir ve olayla yenilenir.
    await admin.waitForFunction(() => Boolean(window.HOF?.overview?.data?.()), null, { timeout: 15000 });
    await admin.waitForTimeout(2500);
    const target = await get(`/api/workspace/accounts/${ids.customers[3]}`);
    const log = counter(admin);
    for (let i = 0; i < 5; i += 1) {
      const r = await colleague.put(`/api/workspace/accounts/${ids.customers[3]}`, { name: target.name, type: target.type, phone: target.phone, note: `not ${i}` });
      if (r.status !== 200) ok(false, `not düzeltme ${i}: ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
      await admin.waitForTimeout(600);
    }
    await admin.waitForTimeout(2500);
    ok(!(log.counts["/api/workspace/overview"] || 0), `5 not düzeltmesinde ANLIK DURUM ${log.counts["/api/workspace/overview"] || 0} kez yüklendi (beklenen 0)`);
    await colleague.post(`/api/workspace/accounts/${ids.customers[3]}/entries`, { kind: "in", amount: 25, date: TODAY, method: "cash", note: "parasal" });
    await admin.waitForTimeout(3000);
    log.stop();
    ok((log.counts["/api/workspace/overview"] || 0) >= 1, `parasal kayıttan sonra ANLIK DURUM yenilendi (${log.counts["/api/workspace/overview"] || 0} kez)`);
    const note = (await get(`/api/workspace/accounts/${ids.customers[3]}`)).note;
    ok(note === "not 4", `not kaydedildi (${note})`);
  });

  await step("Mutabakat ve sayfa hataları", async () => {
    const integrity = await get("/api/workspace/ledger/integrity");
    ok(integrity.ok === true, `mutabakat ${integrity.checks?.filter(c => c.ok).length}/${integrity.checks?.length}`);
    ok(!errors.length, `sayfada JavaScript hatası yok${errors.length ? `: ${errors.join(" ; ")}` : ""}`);
  });
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\nSenaryo 2.0.22: ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
