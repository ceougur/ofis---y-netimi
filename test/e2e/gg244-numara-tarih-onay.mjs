// 2.4.4 — UX15 (uzman UX bulgusu 18.10.2026): numara / tarih çakışması onaydan ÖNCE söylenir. GERÇEK tarayıcıda, ekrandan; sahte EDM (ağa çıkmaz),
// sahte saat (ders 13; 17.06.2026). Tarih bir adımda klavyeyle insan hızında yazılır (ders 12).
// KURAL: seride daha yeni tarihli numaralı belge varken eski tarih, elle yazılan numaranın aynı caride kayıtlı olması ve dönem kilidi formun Toplamlar
// kutusunda (ön hesap) görünür; Kaydet / Kaydet ve Gönder / Kes, Sonra Gönder numaralı onayı AÇMAZ, neden form satırında yazar; belge yazılmaz, EDM'ye
// istek gitmez. Seride daha eski tarihli gönderilmemiş belge varken onay numara göstermez, belgenin numarasız Gönderilecekler'e gireceğini söyler.
//   A. Geriye tarih (e-Arşiv TEA): uyarı + sıradaki numara gizli; Kaydet ve Gönder ve Kes, Sonra Gönder onay açmaz; odak Tarih alanında (31f U7a).
//   B. Tarih düzeltilince uyarı kalkar; onay "TEA…002 numarasıyla" der; kaydedilen numara o.
//   C. Daha eski bekleyen varken (O1): onay numara göstermez, "numarasız Gönderilecekler'e eklenecek" der; belge numarasız kaydedilir.
//   D. İki kullanıcı: form açıkken (uyarı yok) başka kullanıcı daha yeni tarihli e-Fatura kaydeder; Kaydet ve Gönder onaydan önce söyler.
//   E. Düzenle: numarasız bekleyenin tarihi serinin son numaralısından eskiye alınınca uyarı; "Değişiklikleri Kaydet" onay açmaz. Alışın Düzenle'sinde
//      belgenin kendi numarası çakışma sayılmaz.
//   F. Alış: aynı tedarikçide kayıtlı numara ve dönem kilidi; düzeltilince onay açılır (Vazgeç).
// Eski kodda (163dd5d) uyarı yok, onay açılır → A, C, D, E, F kırmızı; DEPO=<eski kopya> ile koşulur. Her soru/onay yanıtı nedeniyle yazılır (ders 34).
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { BUYER_VKN, OUR_VKN, startMockEdm } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);
const { resetEdmCaches } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "edm.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-06-17T09:00:00+03:00";
resetEdmCaches();
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  return globalThis.fetch(input, init);
};
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg244-numara-tarih-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, fetchImpl, edocEnabled: true, testSeriesStart: () => 1, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f47" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
await must("entegratör", api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
// İkinci kullanıcı (muhasebe): D adımında başka oturumdan kaydeder.
await must("kullanıcı", api.post("/api/admin/users", { username: "muhasebe1", name: "Muhasebe Bir", role: "muhasebe", password: "Muhasebe-2026!", mustChangePassword: false }));
const other = createClient(BASE);
await other.login("muhasebe1", "Muhasebe-2026!");
const today = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
const day = offset => {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const dayText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" "), taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const ayse = await must("cari", api.post("/api/workspace/accounts", person("Ayşe Kaya", "10000000146")));
const mehmet = await must("cari", api.post("/api/workspace/accounts", person("Mehmet Demir", "12345678950")));
const firm = await must("cari", api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }));
const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı Kırtasiye", type: "supplier", taxNo: "1234567890", taxOffice: "Merkez", address: "A", district: "B", city: "Ankara" }));
const LINES = [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }];
const first = await must("TEA 1", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ayse.id, issueDate: day(-5), lines: LINES, payment: { rest: "open" }, eSend: "now" }));
const waiting = await must("bekleyen", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: mehmet.id, issueDate: day(-3), lines: LINES, payment: { rest: "open" }, eSend: "later" }));
const bought = await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: supplier.id, issueDate: day(-2), number: "ABC-1", lines: LINES, payment: { rest: "open" } }));
const count = () => app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
const sends = () => edm.state.calls.filter(call => call.op === "SendInvoice").length;
const lastRow = () => app.store.get("SELECT id, number, e_status AS eStatus, issue_date AS issueDate FROM invoices ORDER BY rowid DESC LIMIT 1");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const modal = ".hof-modal-backdrop.is-visible";
const pageInv = `${modal} .hof-invoices-modal`;
const dialog = ".hof-modal-backdrop.is-visible:last-of-type";
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const totals = () => textOf(`${pageInv} [data-totals]`);
const nextNo = () => textOf(`${pageInv} [data-next]`);
const formError = () => textOf(`${pageInv} [data-form-error]`);
const confirmOpen = () => page.waitForSelector(`${dialog} [data-answer="yes"]`, { timeout: 2500 }).then(() => true).catch(() => false);
// Ders 34: test her soruyu/onayı kendisi yanıtlar ve nedenini yazar.
const answer = async (yes, why) => {
  const title = ((await page.textContent(`${dialog} .hof-modal-title, ${dialog} h2`).catch(() => "")) || "").trim();
  const text = ((await page.textContent(`${dialog} .hof-modal-text`).catch(() => "")) || "").replace(/\s+/g, " ").trim();
  console.log(`    [soru] "${title}" → ${yes ? "Evet" : "Vazgeç"} (${why})`);
  await page.click(`${dialog} [data-answer="${yes ? "yes" : "no"}"]`);
  return { title, text };
};
// Açık formu ve pencereyi kapatır; "Form Kapatılsın mı?" sorusu (girilen bilgi kaydedilmedi) meşrudur — nedeniyle yazılır.
const closeAll = async () => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    if (await page.$(`${dialog} [data-answer="yes"]`)) await answer(true, "adım bitti; kaydedilmemiş deneme formu kapatılıyor (meşru soru)");
  }
};
// Satış formu: yeni → senaryo → cari (yazarak) → kalem; ön hesap bitene dek beklenir.
async function newForm(scenario, who, { line = "Hizmet", price = "100", number = "" } = {}) {
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-scenario="${scenario}"]`);
  await page.waitForSelector(`${pageInv} [data-lines]`);
  await page.click(`${pageInv} [data-acc-query]`);
  await page.keyboard.type(who, { delay: 60 });
  await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
  await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
  await page.waitForTimeout(300);
  if (number) {
    await page.click(`${pageInv} input[data-f="number"]`);
    await page.keyboard.type(number, { delay: 60 });
  }
  await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type(line, { delay: 40 });
  await page.keyboard.press("Tab");
  await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
  await page.keyboard.type(price, { delay: 60 });
  await page.keyboard.press("Tab");
  await settle();
}
// Ön hesap (calc) bitti mi: istek sayacı durulana dek.
let calcs = 0;
page.on("requestfinished", request => {
  if (request.url().includes("/api/workspace/invoices/calc")) calcs += 1;
});
async function settle() {
  let seen = -1;
  for (let round = 0; round < 20 && seen !== calcs; round += 1) {
    seen = calcs;
    await page.waitForTimeout(700);
  }
}
async function setDate(iso, { keyboard = false } = {}) {
  const field = `${pageInv} input[data-f="issueDate"]`;
  if (keyboard) {
    // Tarih kutusunun ilk bölümüne tıklanır, rakamlar insan hızında yazılır. Bölüm sırası tarayıcının dil ayarına bağlıdır (gün.ay.yıl ya da
    // ay/gün/yıl): önce gün.ay.yıl, tutmazsa ay/gün/yıl denenir — denenen kullanıcının yazışı, Chromium'un biçimi değil.
    const box = await page.$(field);
    const rect = await box.boundingBox();
    let value = "";
    let order = "";
    for (const [name, digits] of [["gün.ay.yıl", `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`], ["ay/gün/yıl", `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(0, 4)}`]]) {
      await page.mouse.click(rect.x + 12, rect.y + rect.height / 2);
      await page.keyboard.type(digits, { delay: 90 });
      await page.keyboard.press("Tab");
      value = await page.$eval(field, node => node.value);
      order = name;
      if (value === iso) break;
    }
    if (!ok(value === iso, `tarih klavyeyle yazıldı (${order}: ${value})`)) await page.fill(field, iso);
  } else {
    await page.fill(field, iso);
  }
  await settle();
}

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.open);

  console.log(`A) Geriye tarih: TEA serisinde son belge ${first.number} (${dayText(day(-5))}); form ${dayText(day(-6))}`);
  const expectA = `TEA serisinde son belge ${first.number} ${dayText(day(-5))} tarihli; yeni belge daha eski tarihli kaydedilemez (numara ve tarih sırası uyuşmalı). Belge tarihini ${dayText(day(-5))} ya da sonrası yapın.`;
  await newForm("service_sale", "Ayşe");
  await setDate(day(-6), { keyboard: true });
  ok((await totals()).includes(expectA), `Toplamlar kutusunda uyarı (${(await totals()).slice(-260)})`);
  ok(!/TEA2026/.test(await nextNo()), `"Kaydedilince Verilecek No" gösterilmez (${await nextNo()})`);
  const nA = count();
  const sA = sends();
  for (const [act, label] of [["issue-now", "Kaydet ve Gönder"], ["issue-later", "Kes, Sonra Gönder"]]) {
    await page.click(`${pageInv} [data-act="${act}"]`);
    const shown = await confirmOpen();
    ok(!shown, `${label}: numaralı onay açılmadı`);
    if (shown) await answer(false, "eski kod: onay çakışmayı söylemeden açıldı — kaydetme");
    ok((await formError()).includes(`Fatura kaydedilemez: ${expectA}`), `${label}: neden form satırında (${(await formError()).slice(0, 200)})`);
    // 31f U7a: odak çakışmanın alanında (Tarih); önceden pasifleşen düğmeden BODY'ye düşüyordu.
    await page.waitForTimeout(300);
    const where = await page.evaluate(() => (document.activeElement === document.body ? "BODY" : document.activeElement?.dataset?.f || document.activeElement?.tagName || "yok"));
    ok(where === "issueDate", `${label}: odak Tarih alanında (${where})`);
  }
  ok(count() === nA && sends() === sA, `belge yazılmadı, EDM'ye istek yok (${count() - nA}, ${sends() - sA})`);

  console.log(`\nB) Tarih ${dayText(day(-5))} (son belgeyle aynı gün): uyarı kalkar; onay numarayı söyler`);
  await setDate(day(-5));
  ok(!(await totals()).includes("serisinde son belge"), "uyarı kalktı");
  ok((await nextNo()).includes("TEA2026000000002"), `sıradaki numara görünür (${await nextNo()})`);
  await page.click(`${pageInv} [data-act="issue-now"]`);
  if (ok(await confirmOpen(), "onay açıldı")) {
    const { text } = await answer(true, "çakışmasız geçerli belge: kaydedilip gönderilmeli");
    ok(text.includes("TEA2026000000002 numarasıyla"), `onay numarayı söyler (${text.slice(0, 160)})`);
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /kaydedildi/.test(node.textContent)), null, { timeout: 15000 }).catch(() => null);
    const saved = lastRow();
    ok(saved.number === "TEA2026000000002" && saved.issueDate === day(-5), `kaydedilen numara onaydaki (${saved.number} ${saved.issueDate})`);
  }
  await closeAll();

  console.log(`\nC) Daha eski bekleyen (${dayText(day(-3))}, numarasız) varken bugünün belgesi: onay numara göstermez`);
  await newForm("service_sale", "Ayşe", { line: "Bakım", price: "250" });
  const holdText = "Bu seride daha eski tarihli gönderilmemiş 1 belge var; GİB sıra kuralı gereği önce onlar gönderilmeli. Belge numarasız Gönderilecekler'e eklenecek — Tümünü Gönder ile eskiden yeniye gönderin.";
  ok((await totals()).includes(holdText), `Toplamlar kutusunda bilgi (${(await totals()).slice(-240)})`);
  ok(!/TEA2026/.test(await nextNo()), `sıradaki numara gösterilmez (${await nextNo()})`);
  await page.click(`${pageInv} [data-act="issue-now"]`);
  if (ok(await confirmOpen(), "onay açıldı (kayıt yapılabilir; numara sonra)")) {
    const { text } = await answer(true, "belge numarasız Gönderilecekler'e girmeli — onayın dediği gerçekleşiyor mu");
    ok(!/numarasıyla/.test(text) && text.includes(holdText) && !/kaydedilir kaydedilmez entegratöre/.test(text), `onay numara göstermez, nedeni söyler (${text.slice(0, 260)})`);
    await page.waitForTimeout(2500);
    const held = lastRow();
    ok(held.number === "" && held.eStatus === "waiting", `belge numarasız Gönderilecekler'de (${held.number || "numarasız"} ${held.eStatus})`);
  }
  await closeAll();

  console.log(`\nD) İki kullanıcı: e-Fatura formu ${dayText(day(-1))} açıkken muhasebe1 bugünün e-Faturasını kaydeder`);
  await newForm("service_sale", "Alıcı Ticaret");
  await setDate(day(-1));
  ok(!(await totals()).includes("serisinde son belge") && (await nextNo()).includes("TEF2026000000001"), `form açıkken çakışma yok (${await nextNo()})`);
  const otherSaved = unwrap(await other.post("/api/workspace/invoices", { scenario: "service_sale", accountId: firm.id, issueDate: day(0), lines: LINES, payment: { rest: "open" }, eSend: "now" }));
  ok(otherSaved.number === "TEF2026000000001", `muhasebe1 kaydetti (${otherSaved.number})`);
  const nD = count();
  await page.click(`${pageInv} [data-act="issue-now"]`);
  const shownD = await confirmOpen();
  ok(!shownD, "Kaydet ve Gönder: onay açılmadı (Kaydet öncesi yeniden hesap çakışmayı gördü)");
  if (shownD) await answer(false, "eski kod: onay eski numarayla açıldı — kaydetme");
  ok((await formError()).includes(`TEF serisinde son belge TEF2026000000001 ${dayText(day(0))} tarihli`), `neden form satırında (${(await formError()).slice(0, 200)})`);
  ok((await totals()).includes("TEF serisinde son belge TEF2026000000001"), "uyarı Toplamlar kutusunda da");
  ok(count() === nD, "belge yazılmadı");
  await closeAll();

  console.log(`\nE) Düzenle: numarasız bekleyenin (${dayText(day(-3))}) tarihi serinin son numaralısından (${dayText(day(-5))}) eskiye`);
  await page.evaluate(id => window.HOF.invoices.open({ id }), waiting.id);
  await page.waitForSelector(`${pageInv} [data-act="modify"]`);
  await page.click(`${pageInv} [data-act="modify"]`);
  await page.waitForSelector(`${pageInv} input[data-f="issueDate"]`);
  await settle();
  ok(!(await totals()).includes("serisinde son"), "tarih değişmeden uyarı yok");
  await setDate(day(-6));
  const expectE = `TEA serisinde son gönderilen belge TEA2026000000002 ${dayText(day(-5))} tarihli; numarası gönderimde verilecek bu belge ondan eski tarihli olamaz (numara ve tarih sırası).`;
  ok((await totals()).includes(expectE), `Düzenle kuralıyla uyarı (${(await totals()).slice(-220)})`);
  await page.click(`${pageInv} [data-act="issue"]`);
  const shownE = await confirmOpen();
  ok(!shownE, "Değişiklikleri Kaydet: onay açılmadı");
  if (shownE) await answer(false, "eski kod: onay çakışmayı söylemeden açıldı — kaydetme");
  ok(app.store.get("SELECT issue_date AS d FROM invoices WHERE id = ?", waiting.id).d === day(-3), "belgenin tarihi değişmedi");
  await closeAll();
  await page.evaluate(id => window.HOF.invoices.open({ id }), bought.id);
  await page.waitForSelector(`${pageInv} [data-act="modify"]`);
  await page.click(`${pageInv} [data-act="modify"]`);
  await page.waitForSelector(`${pageInv} input[data-f="number"]`);
  await settle();
  ok(!(await totals()).includes("zaten kayıtlı"), "alışın Düzenle'sinde kendi numarası çakışma sayılmaz");
  await closeAll();

  console.log("\nF) Alış: aynı tedarikçide kayıtlı numara, dönem kilidi; düzeltilince onay açılır");
  await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: day(-10) }));
  await newForm("expense_purchase", "Toptancı", { number: "ABC-1", line: "Kırtasiye", price: "40" });
  const dupText = `ABC-1 numaralı alış faturası bu caride ${dayText(day(-2))} tarihiyle zaten kayıtlı.`;
  ok((await totals()).includes(dupText), `çift numara uyarısı (${(await totals()).slice(-200)})`);
  const nF = count();
  await page.click(`${pageInv} [data-act="issue"]`);
  const shownF = await confirmOpen();
  ok(!shownF, "Kaydet: onay açılmadı (çift numara)");
  if (shownF) await answer(false, "eski kod: onay çift numarayı söylemeden açıldı — kaydetme");
  await page.click(`${pageInv} input[data-f="number"]`, { clickCount: 3 });
  await page.keyboard.type("ABC-2", { delay: 60 });
  await page.keyboard.press("Tab");
  await settle();
  ok(!(await totals()).includes("zaten kayıtlı"), "numara düzelince uyarı kalktı");
  await setDate(day(-12));
  const lockText = `Fatura ${dayText(day(-12))} tarihli; ${dayText(day(-10))} ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı.`;
  ok((await totals()).includes(lockText), `dönem kilidi uyarısı (${(await totals()).slice(-200)})`);
  await page.click(`${pageInv} [data-act="issue"]`);
  const shownL = await confirmOpen();
  ok(!shownL, "Kaydet: onay açılmadı (kilitli dönem)");
  if (shownL) await answer(false, "eski kod: onay kilidi söylemeden açıldı — kaydetme");
  await setDate(day(-9));
  ok(!(await totals()).includes("kilitli"), "kilidin ertesi günü uyarı yok");
  await page.click(`${pageInv} [data-act="issue"]`);
  if (ok(await confirmOpen(), "çakışmasız alışta onay açıldı")) await answer(false, "yalnız onayın açıldığı denetleniyor; kaydetmeye gerek yok");
  ok(count() === nF, "F adımında belge yazılmadı");
  await closeAll();
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg244-numara-tarih-onay-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg244-numara-tarih-onay: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
