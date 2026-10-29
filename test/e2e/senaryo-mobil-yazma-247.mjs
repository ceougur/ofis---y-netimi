// 2.4.7 M5 EKRANDAN — mobilden yazma: tahsilat, ödeme, taksit kartına tahsilat, stok girişi (client/mobil/yazma.js; server/lib/mobile-write.mjs; kullanıcı
// kararları S1–S8 docs/2.4.7-IS-LISTESI.md "KARARLAR — M5"). Telefon (390×844, dokunmatik, iPhone imzası) programın UZAK dinleyicisine bağlanır (M2: karekod
// bağlantısıyla eşleme + imzalı giriş); gerçek tıklama, Tab ve insan hızında yazım (ders 12). Her kayıttan sonra sonuç EKRANDA ve VERİ TABANINDA okunur (ders 3).
// Saat sahte ve sabit: sunucu ve tarayıcı aynı an (ders 13, 22); ay sonu gece yarısı ve 24 saat kuralı saat ilerletilerek.
//   Y1 eşleme + giriş (bağlantı) → Genel Bakış.
//   Y2 Tahsilat Gir (nakit 1.200): fatura seçilmez → en eski fatura kapanır (F1 0, F2 300); bakiye 300; Kasa +1.200; kayıt tarihi sunucunun günü.
//   Y3 Ödeme Gir (Kasa yetmez): soru "Kasa eksiye düşer" → Yine de Kaydet → TEK kayıt (aynı istek kimliği).
//   Y4 taksit kartına tahsilat: Tahsilat Yeri = kart; 100 → kalan 200; 250 → soru → Fazlasını Avans Yaz → kalan 0, fazla 50; cari −50.
//   Y5 Stok Girişi 5 → miktar 15; parasız (Kasa değişmez).
//   Y6 bağlantı kopması: (a) istek sunucuya ulaşmadan kopar → Sonucu Belirsiz → Yeniden Gönder → bir kayıt; (b) sunucu yazar, yanıt kaybolur → Yeniden Gönder →
//      "zaten kaydedilmişti", yine bir kayıt.
//   Y7 gece yarısı: 23:58'de ulaşmayan istek 00:01'de yeniden gönderilir → kayıt yeni günün (01.11) tarihiyle.
//   Y8 24 saat: belirsiz istek 25 saat sonra yeniden gönderilmez (düğme yok, neden yazılı); Listeden Kaldır.
//   Y9 personel telefonu: yalnız Tahsilat Gir (Ödeme Gir yok); kayıt personelin adına.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-mobil-yazma-247).
process.env.TZ = "Europe/Istanbul";

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClock } from "../../server/lib/clock.mjs";
import { ADMIN_PASSWORD, createUser, installPageClock, loginAdmin, moveClock, startTestServer } from "../helpers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-mobil-yazma-247-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-mobil-yazma-247");
mkdirSync(shots, { recursive: true });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const STAFF = { username: "mobil-tahsildar", password: "Tahsildar-Mobil-2026!" };
const T0 = "2026-10-31T23:50:00+03:00"; // ay sonu; Y7 gece yarısını geçer (adımlar arası < 15 dk: uzak oturum boşta süresi)
const tl = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};

const clock = createClock({ time: Date.parse(T0), fixed: true });
const server = await startTestServer({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: clock, remoteNow: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const remote = await server.app.listenRemote(0, "127.0.0.1");
const remoteBase = `http://127.0.0.1:${remote.port}`;
server.app.mobileRemote.setPublicUrl(remoteBase);
const api = await loginAdmin(server);
const store = () => server.app.store;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const shot = (name, target = page) => target?.screenshot({ path: path.join(shots, `mobil-yazma-247-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3).trim()}`);
  }
};
const typeSlow = async (value, target = page) => {
  for (const ch of value) await target.keyboard.type(ch, { delay: 45 });
};
const text = async (selector, target = page) => ((await target.textContent(selector)) || "").trim();
const tapNav = async (name, target = page) => {
  await target.click(`.bottom-nav [data-nav="${name}"]`);
  await target.waitForSelector("#content .spinning", { state: "detached", timeout: 15000 }).catch(() => null);
  await target.waitForTimeout(250);
};
const noOverflow = async (label, target = page) => {
  const size = await target.evaluate(() => ({ scroll: document.documentElement.scrollWidth, screen: window.screen.width }));
  ok(size.scroll <= size.screen, `${label}: yatay taşma yok (${size.scroll} ≤ ${size.screen})`);
};
const openDetail = async (kind, id, target = page) => {
  await tapNav(kind, target);
  await target.click(`#content [data-detail="${kind}:${id}"]`);
  await target.waitForSelector("[data-detail-balance]");
  await target.waitForSelector("[data-yazma]", { timeout: 8000 });
};
// Form: düğmeye dokun → sayfa açılır; tutarı insan hızında yaz; Tab ile sonraki alana.
const openForm = async (label, target = page) => {
  await target.click(`[data-yazma="${label}"]`);
  await target.waitForSelector(".yz-sheet", { state: "visible" });
};
const fill = async (name, value, target = page) => {
  await target.click(`.yz-sheet [name="${name}"]`);
  await typeSlow(value, target);
  await target.keyboard.press("Tab");
};
const submit = async (target = page) => target.click('.yz-sheet [data-yz="submit"]');
const toastText = async (target = page) => {
  await target.waitForSelector(".toast", { timeout: 8000 });
  return (await target.$$eval(".toast", items => items.map(item => item.textContent.trim()))).join(" | ");
};
const clearToasts = (target = page) => target.evaluate(() => document.querySelectorAll(".toast").forEach(item => item.remove()));
const entries = accountId => store().all("SELECT kind, amount, date, method, invoice_id AS invoiceId, created_by AS createdBy FROM account_entries WHERE account_id = ? AND kind IN ('in', 'out') ORDER BY rowid", accountId).map(row => ({ ...row }));
const detailBalance = async (target = page) => text("[data-detail-balance]", target);

// ---------- Veri: masaüstünün yolu (programın kendi API'si) ----------
const hizmet = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Danışmanlık", unit: "Adet", salePrice: "100" }));
const ayse = await must("cari", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", registeredOn: "2026-10-01" }));
const invoice = (accountId, amount, day) => must("fatura", api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId, issueDate: day, lines: [{ itemId: hizmet.id, qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open" } }));
const f1 = await invoice(ayse.id, "1000", "2026-10-01");
const f2 = await invoice(ayse.id, "500", "2026-10-05");
await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "200", date: "2026-10-01" }));
const tedarik = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarik Anonim", type: "supplier", registeredOn: "2026-10-01" }));
const mehmet = await must("taksitli cari", api.post("/api/workspace/accounts", { name: "Mehmet Taksit", type: "customer", registeredOn: "2026-10-01", openingBalance: "300", openingSide: "auto" }));
const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "Mehmet Taksit", registeredOn: "2026-10-01", total: "300", accountId: mehmet.id, mode: "auto", count: "3", firstDue: "2026-11-15", coversBalance: true }));
const kalem = await must("ürün", api.post("/api/workspace/stock", { kind: "product", code: "KLM", name: "Kurşun Kalem", unit: "Adet", openingQty: "10" }));
const veli = await must("cari (kesinti)", api.post("/api/workspace/accounts", { name: "Veli Kesinti", type: "customer", registeredOn: "2026-10-01" }));
const users = Object.fromEntries(unwrap(await api.get("/api/admin/users")).map(u => [u.username, u.id]));
await createUser(server, api, { username: STAFF.username, role: "personel", password: STAFF.password, name: "Saha Tahsildarı" });
const staffId = Object.fromEntries(unwrap(await api.get("/api/admin/users")).map(u => [u.username, u.id]))[STAFF.username];
for (const id of [users.admin, staffId]) await must("uzak izin", api.put(`/api/admin/mobile/access/${id}`, { remote: true }));
const cashNow = async () => unwrap(await api.get("/api/workspace/cash")).totals.balance;

const browser = await chromium.launch();
const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE, locale: "tr-TR" });
page = await phoneContext.newPage();
await installPageClock(page, clock);
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(String(error?.message || error)));

const pairAndLogin = async (target, userId, username, password, deviceName) => {
  const code = await must("karekod", api.post("/api/admin/mobile/codes", { userId }));
  await target.goto(code.url);
  await target.waitForSelector("#pair-form", { state: "visible" });
  await target.click("#device-name", { clickCount: 3 });
  await typeSlow(deviceName, target);
  await target.click("#pair-submit");
  await target.waitForSelector("#login-form", { state: "visible", timeout: 15000 });
  await loginAs(target, username, password);
};
const loginAs = async (target, username, password) => {
  await target.waitForSelector("#login-form", { state: "visible" });
  await target.click("#username", { clickCount: 3 });
  await target.keyboard.press("Backspace");
  await typeSlow(username, target);
  await target.keyboard.press("Tab");
  await typeSlow(password, target);
  await target.click("#login-submit");
  await target.waitForSelector("#app:not(.hidden)", { timeout: 15000 });
  await target.waitForSelector("#content .summary-grid", { timeout: 15000 });
};

await step("Y1 karekod bağlantısıyla eşleme + giriş (uzak dinleyici) → Genel Bakış; kayıt girişi açık", async () => {
  await pairAndLogin(page, users.admin, "admin", ADMIN_PASSWORD, "Yönetici Telefonu");
  ok(new URL(page.url()).origin === remoteBase, `telefon uzak adreste (${new URL(page.url()).origin})`);
  const notice = await page.$$eval("#content .notice", items => items.map(item => item.textContent.trim()).join(" "));
  ok(/kayıt ofis sunucusuna yazılır/.test(notice), "Genel Bakış: kayıt girişi açık notu");
  await shot("01-genel-bakis");
});

await step("Y2 Tahsilat Gir (nakit 1.200): en eski fatura kapanır, bakiye 300, Kasa +1.200; tarih sunucunun günü", async () => {
  const cash0 = await cashNow();
  await openDetail("accounts", ayse.id);
  ok((await detailBalance()) === tl(1500), `başlangıç bakiyesi ${await detailBalance()}`);
  await openForm("Tahsilat Gir");
  const note = await text(".yz-sheet [data-yz-note]");
  ok(/en eski açık borcunu kapatır; fatura seçilmez/.test(note), "bilgi notu: fatura seçilmez (FIFO)");
  ok(!(await page.$('.yz-sheet [name="invoiceId"], .yz-sheet [name="date"], .yz-sheet [type="date"]')), "formda fatura ve tarih alanı yok (S1, S6)");
  const methods = await page.$$eval('.yz-sheet [name="method"] option', items => items.map(item => item.textContent.trim()));
  ok(methods.join(",") === "Nakit,Havale / EFT,POS", `ödeme yolları ${methods.join(", ")} (çek / senet yok — S2)`);
  await fill("amount", "1.200");
  await noOverflow("Tahsilat formu");
  await shot("02-tahsilat-formu");
  await submit();
  const toast = await toastText();
  ok(/Tahsilat kaydedildi/.test(toast), `bildirim: ${toast}`);
  await page.waitForSelector(".yz-sheet", { state: "detached" });
  await page.waitForFunction(expected => document.querySelector("[data-detail-balance]")?.textContent.trim() === expected, tl(300), { timeout: 8000 }).catch(() => null);
  ok((await detailBalance()) === tl(300), `ekranda bakiye ${await detailBalance()}`);
  const rows = entries(ayse.id);
  ok(rows.length === 1 && rows[0].amount === 1200 && rows[0].kind === "in" && rows[0].method === "cash" && rows[0].invoiceId === "" && rows[0].date === "2026-10-31", `veri tabanı: ${JSON.stringify(rows)}`);
  const open1 = unwrap(await api.get(`/api/workspace/invoices/${f1.id}`)).open;
  const open2 = unwrap(await api.get(`/api/workspace/invoices/${f2.id}`)).open;
  ok(open1 === 0 && open2 === 300, `FIFO: F1 açık ${open1}, F2 açık ${open2}`);
  ok((await cashNow()) === cash0 + 1200, `Kasa ${cash0} → ${await cashNow()}`);
  await shot("03-tahsilat-sonrasi");
  await clearToasts();
});

await step("Y3 Ödeme Gir: Kasa yetmez → soru → Yine de Kaydet → tek kayıt (aynı istek kimliği)", async () => {
  const cash0 = await cashNow();
  await openDetail("accounts", tedarik.id);
  await openForm("Ödeme Gir");
  const methods = await page.$$eval('.yz-sheet [name="method"] option', items => items.map(item => item.textContent.trim()));
  ok(methods.join(",") === "Nakit,Havale / EFT,Kredi Kartı", `ödeme yolları ${methods.join(", ")}`);
  await fill("amount", "5000");
  await submit();
  await page.waitForSelector("[data-yz-confirm]", { timeout: 8000 });
  const question = await text(".yz-sheet [data-yz-message]");
  ok(/eksiye düşürür/.test(question), `soru: ${question.slice(0, 90)}`);
  ok(entries(tedarik.id).length === 0, "soru sırasında kayıt yok");
  await shot("04-kasa-sorusu");
  const keysBefore = store().get("SELECT COUNT(*) AS n FROM request_keys").n;
  await page.click("[data-yz-confirm]");
  ok(/Ödeme kaydedildi/.test(await toastText()), "Yine de Kaydet → kaydedildi");
  const rows = entries(tedarik.id);
  ok(rows.length === 1 && rows[0].kind === "out" && rows[0].amount === 5000, `veri tabanı: ${JSON.stringify(rows)}`);
  ok(store().get("SELECT COUNT(*) AS n FROM request_keys").n === keysBefore + 1, "tek istek kimliği (soru + onay aynı istek)");
  ok((await cashNow()) === cash0 - 5000, `Kasa ${cash0} → ${await cashNow()}`);
  await clearToasts();
});

await step("Y4 taksit kartına tahsilat: 100 → kalan 200; 250 → soru → Fazlasını Avans Yaz → kalan 0, fazla 50; cari −50", async () => {
  await openDetail("accounts", mehmet.id);
  await openForm("Tahsilat Gir");
  const targets = await page.$$eval('.yz-sheet [name="target"] option', items => items.map(item => item.textContent.trim()));
  ok(targets.length === 2 && /Taksit Kartı/.test(targets[1]), `Tahsilat Yeri: ${targets.join(" | ")}`);
  await page.selectOption('.yz-sheet [name="target"]', plan.id);
  await fill("amount", "100");
  await submit();
  ok(/Tahsilat kaydedildi/.test(await toastText()), "kart tahsilatı kaydedildi");
  await clearToasts();
  const p1 = unwrap(await api.get(`/api/workspace/plans/${plan.id}`)).totals;
  ok(p1.remaining === 200 && p1.paid === 100, `kart: ödenen ${p1.paid}, kalan ${p1.remaining}`);
  await page.waitForSelector("[data-yazma]", { timeout: 8000 });
  await openForm("Tahsilat Gir");
  await page.selectOption('.yz-sheet [name="target"]', plan.id);
  await fill("amount", "250");
  await submit();
  await page.waitForSelector("[data-yz-confirm]", { timeout: 8000 });
  ok((await text("[data-yz-confirm]")) === "Fazlasını Avans Yaz", "soru: Fazlasını Avans Yaz");
  await page.click("[data-yz-confirm]");
  ok(/Tahsilat kaydedildi/.test(await toastText()), "avansla kaydedildi");
  const p2 = unwrap(await api.get(`/api/workspace/plans/${plan.id}`)).totals;
  ok(p2.remaining === 0 && p2.extra === 50, `kart: kalan ${p2.remaining}, fazla ${p2.extra}`);
  const balance = unwrap(await api.get(`/api/workspace/accounts/${mehmet.id}`)).totals.balance;
  ok(balance === -50, `cari bakiye ${balance} (fazlası avans)`);
  await clearToasts();
});

await step("Y5 Stok Girişi 5 → miktar 15; parasız (Kasa değişmez)", async () => {
  const cash0 = await cashNow();
  await openDetail("stock", kalem.id);
  await openForm("Stok Girişi");
  ok(/yalnız stok girişi/.test(await text(".yz-sheet [data-yz-note]")), "not: yalnız giriş (S8)");
  await fill("qty", "5");
  await submit();
  ok(/Stok girişi kaydedildi/.test(await toastText()), "stok girişi kaydedildi");
  await page.waitForFunction(() => /15/.test(document.querySelector("[data-detail-balance]")?.textContent || ""), null, { timeout: 8000 }).catch(() => null);
  ok(/^15\b/.test(await detailBalance()), `ekranda miktar ${await detailBalance()}`);
  const move = { ...store().get("SELECT kind, qty, pay, amount FROM stock_moves WHERE item_id = ? ORDER BY rowid DESC LIMIT 1", kalem.id) };
  ok(move.kind === "in" && move.qty === 5 && move.pay === "none", `veri tabanı: ${JSON.stringify(move)}`);
  ok((await cashNow()) === cash0, "Kasa değişmedi");
  await clearToasts();
});

const writeUrl = "**/api/mobil/accounts/*/tahsilat**";
await step("Y6a bağlantı sunucuya ulaşmadan kopar → Sonucu Belirsiz → Yeniden Gönder → tek kayıt", async () => {
  await openDetail("accounts", veli.id);
  await openForm("Tahsilat Gir");
  await fill("amount", "40");
  await page.route(writeUrl, route => route.abort("connectionreset"));
  await submit();
  await page.waitForSelector(".yz-message.warn", { timeout: 8000 });
  ok(/Bağlantı koptu/.test(await text(".yz-sheet [data-yz-message]")), "formda: bağlantı koptu");
  ok(entries(veli.id).length === 0, "istek ulaşmadı: kayıt yok");
  ok(await page.isVisible("#yz-pending [data-yz-resend]"), "Sonucu Belirsiz İşlemler'de Yeniden Gönder");
  await shot("05-belirsiz");
  await page.unroute(writeUrl);
  await page.click('.yz-sheet [data-yz="close"]');
  await page.click("#yz-pending [data-yz-resend]");
  ok(/Tahsilat kaydedildi/.test(await toastText()), "yeniden gönderim kaydedildi");
  ok(entries(veli.id).length === 1, `tek kayıt (${entries(veli.id).length})`);
  ok(!(await page.$("#yz-pending")), "belirsiz liste boşaldı");
  await clearToasts();
});

await step("Y6b sunucu yazar, yanıt kaybolur → Yeniden Gönder → 'zaten kaydedilmişti'; yine tek kayıt", async () => {
  await openDetail("accounts", veli.id);
  await openForm("Tahsilat Gir");
  await fill("amount", "60");
  await page.route(writeUrl, async route => {
    await route.fetch(); // istek sunucuya gider ve yazılır
    await route.abort("connectionreset"); // yanıt telefona ulaşmaz
  });
  await submit();
  await page.waitForSelector(".yz-message.warn", { timeout: 8000 });
  await page.unroute(writeUrl);
  ok(entries(veli.id).length === 2, "sunucu yazdı (2. kayıt)");
  await page.click('.yz-sheet [data-yz="close"]');
  await page.click("#yz-pending [data-yz-resend]");
  ok(/zaten kaydedilmişti/.test(await toastText()), "yeniden gönderim: zaten kaydedilmişti");
  ok(entries(veli.id).length === 2, `ikinci kayıt açılmadı (${entries(veli.id).length})`);
  await clearToasts();
});

await step("Y7 gece yarısı: 23:5x'te ulaşmayan istek 00:01'de yeniden gönderilir → kayıt 01.11.2026 tarihli (sunucunun günü)", async () => {
  await moveClock(clock, page, Date.parse("2026-10-31T23:58:00+03:00"));
  await openDetail("accounts", veli.id);
  await openForm("Tahsilat Gir");
  await fill("amount", "25");
  await page.route(writeUrl, route => route.abort("connectionreset"));
  await submit();
  await page.waitForSelector(".yz-message.warn", { timeout: 8000 });
  await page.unroute(writeUrl);
  await page.click('.yz-sheet [data-yz="close"]');
  await moveClock(clock, page, Date.parse("2026-11-01T00:01:00+03:00"));
  await page.click("#yz-pending [data-yz-resend]");
  ok(/Tahsilat kaydedildi/.test(await toastText()), "kaydedildi");
  const last = entries(veli.id).at(-1);
  ok(last.amount === 25 && last.date === "2026-11-01", `kayıt ${JSON.stringify(last)}`);
  await clearToasts();
});

await step("Y8 24 saat: belirsiz istek 25 saat sonra yeniden gönderilmez; Listeden Kaldır", async () => {
  await openDetail("accounts", veli.id);
  await openForm("Tahsilat Gir");
  await fill("amount", "15");
  await page.route(writeUrl, route => route.abort("connectionreset"));
  await submit();
  await page.waitForSelector(".yz-message.warn", { timeout: 8000 });
  await page.unroute(writeUrl);
  await page.click('.yz-sheet [data-yz="close"]');
  const before = entries(veli.id).length;
  await moveClock(clock, page, Date.parse("2026-11-02T01:30:00+03:00"));
  await page.reload();
  await page.waitForSelector("#login-form, #app:not(.hidden)", { timeout: 15000 });
  if (await page.isVisible("#login-form")) await loginAs(page, "admin", ADMIN_PASSWORD);
  await page.waitForSelector("#yz-pending", { timeout: 8000 });
  ok(!(await page.$("#yz-pending [data-yz-resend]")), "Yeniden Gönder düğmesi yok");
  ok(/24 saati geçti; yeniden gönderilmez/.test(await text("#yz-pending")), `neden yazılı: ${(await text("#yz-pending")).slice(0, 120)}`);
  await shot("06-24-saat");
  await page.click("#yz-pending [data-yz-drop]");
  ok(!(await page.$("#yz-pending")), "listeden kaldırıldı");
  ok(entries(veli.id).length === before, "kayıt açılmadı");
});

await step("Y9 personel telefonu: yalnız Tahsilat Gir (Ödeme Gir yok); kayıt personelin adına", async () => {
  const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE, locale: "tr-TR" });
  const staffPage = await staffContext.newPage();
  await installPageClock(staffPage, clock);
  staffPage.on("pageerror", error => pageErrors.push(String(error?.message || error)));
  await pairAndLogin(staffPage, staffId, STAFF.username, STAFF.password, "Tahsildar Telefonu");
  await openDetail("accounts", ayse.id, staffPage);
  const buttons = await staffPage.$$eval("[data-yazma]", items => items.map(item => item.textContent.trim()));
  ok(buttons.join(",") === "Tahsilat Gir", `personel düğmeleri: ${buttons.join(", ")}`);
  await openForm("Tahsilat Gir", staffPage);
  await fill("amount", "50", staffPage);
  await submit(staffPage);
  ok(/Tahsilat kaydedildi/.test(await toastText(staffPage)), "personel tahsilatı kaydedildi");
  const last = entries(ayse.id).at(-1);
  ok(last.amount === 50 && last.createdBy === staffId, `kaydı giren personel (${last.createdBy === staffId})`);
  await noOverflow("Personel cari kartı", staffPage);
  await shot("07-personel", staffPage);
  await staffContext.close();
});

ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
