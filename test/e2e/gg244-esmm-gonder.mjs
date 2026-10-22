// 2.4.4 iş listesi 22 (E1) — e-SMM EKRANDAN (e-SMM açık kurulum: config.esmmEnabled; madde 24'ten beri üretim girişi de açar). GERÇEK tarayıcı, sahte EDM
// (test/einvoice-mock.mjs + …/ESmmEDM.svc yolu test/esmm-mock.mjs; ağa çıkmaz), ders 30 lisans adresi.
//   0 (madde 24, açma) e-SMM KULLANICISI OLMAYAN firmada makbuz formu eskisi gibi kâğıt: tür notu yok, gönderim düğmesi yok; kayıt SMM serisi, KAGIT,
//     Gönderilecekler'e düşmez. Sonra firma "e-SMM kullanıcısıyım" olur (API) ve 1–3 koşar.
//   1 "e-SMM kullanıcısıyım" firmada serbest meslek makbuzu formu: tür notu "e-SMM kesilir", "Kaydet, Sonra Gönder" + "Kaydet ve Gönder" var; portala taslak
//     ayarı AÇIKKEN de düğme "Kaydet ve Gönder" (e-SMM portala taslak olarak yüklenmez).
//   2 Kaydet ve Gönder (insan hızında yazım + Tab): makbuz TES numarasıyla e-SMM servisine gider (e-Fatura servisine gönderim yok); kartta Durum Sorgula ve
//     Resmî Görüntü var, Portala Taslak Yükle yok.
//   3 İptal Et: pencere "e-SMM önce entegratörde (EDM) iptal edilir" der; onaylanınca EDM'de (CancelSMM) ve programda iptal.
//   4 (madde 22 ek, kâhin bulgusu) Gönderilecekler'deki e-SMM kartında "Kâğıt Makbuz Olarak Bırak" (Müşteri Fişi değil); onay penceresi kâğıt makbuz der;
//     makbuz kâğıt makbuz serisinden (SMM) numara alır, FIS'ten değil; kartta Belge Türü "Kâğıt Makbuz (e-SMM olarak gönderilmedi)".
//   5 Fatura Ayarları Kaşe / İmza açıklaması e-SMM cümlesi. 6–7 ve 0/1/2 ek denetimleri (madde 30c gezinti bulguları): G1 kâğıda düşen belgenin nedeni formda
//     (makbuz: e-SMM işareti; satış: e-Fatura / e-Arşiv işareti; Alış'ta, e-Arşiv'de, entegratörsüz firmada not yok); G2 Fatura Ayarları açıkken Entegratör
//     Ayarları'nda e-SMM işareti değişince açıklama yenilenir, kaydedilmemiş alan durur; G3 makbuzun Kaydet ve Gönder onayı iade demez.
// Her soru/onay yanıtı nedeniyle yazılır (ders 34). Eski kodda (7c36f87) form kâğıt makbuz gibi yalnız "Kaydet" gösterir → 1 kırmızı; DEPO=<eski kopya>.
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { OUR_VKN, startMockEdm, vkn } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);
const { resetEdmCaches } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "edm.mjs")).href);
const { escClose } = await import(pathToFileURL(path.join(ROOT, "test", "e2e", "esc-kapat.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-06-17T09:00:00+03:00";
resetEdmCaches();
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  return globalThis.fetch(input, init);
};
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg244-esmm-"));
const shots = process.env.EKRAN_DIR || root;
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, fetchImpl, edocEnabled: true, esmmEnabled: true, testSeriesStart: () => 1, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f47" }, startLicenseTimers: false });
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
await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true, esmm: false }));
await must("entegratör", api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
await must("cari", api.post("/api/workspace/accounts", { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" }));
const count = () => app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
const lastRow = () => app.store.get("SELECT id, kind, status, profile, number, ettn, e_status AS eStatus, e_message AS eMessage FROM invoices ORDER BY rowid DESC LIMIT 1");
globalThis.__escKapatEk = () => ({ fatura: count() });

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
const dialog = ".hof-modal-backdrop.is-visible:not(:has(~ .hof-modal-backdrop.is-visible))";
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const closeAll = async page => {
  for (let index = 0; index < 5 && page && (await page.$(modal)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) {
      // Ders 34: kapatırken çıkan soru (kaydedilmemiş form) nedeniyle yazılır.
      console.log(`  · kapatırken soru yanıtlandı: ${(await textOf(page, `${dialog} .hof-modal-text`)).slice(0, 80)}`);
      await yes.click();
    }
  }
};
async function newSmm(page, scenario = "smm") {
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-scenario="${scenario}"]`);
  await page.waitForSelector(`${pageInv} [data-lines]`);
  await page.click(`${pageInv} [data-acc-query]`);
  await page.keyboard.type("Müvekkil", { delay: 60 });
  await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
  await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
  await page.waitForTimeout(300);
  await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Avukatlık Ücreti", { delay: 40 });
  await page.keyboard.press("Tab");
  await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
  await page.keyboard.type("1000", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1500);
}
// 2.4.4 madde 30c G1: kâğıda düşen belgenin nedeni (formun [data-paper-note] satırı).
const paperNote = page => page.$eval(`${pageInv} [data-paper-note]`, node => ({ hidden: node.hidden, text: node.textContent.replace(/\s+/g, " ").trim() })).catch(() => ({ hidden: true, text: "(satır yok)" }));
const reloadPage = async page => {
  await page.reload();
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
};
const errors = [];
const browser = await chromium.launch();
let page = null;
async function step(title, fn) {
  console.log(title);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ adım tamamlanamadı: ${String(error?.message || error).split("\n")[0]}`);
  }
  await closeAll(page).catch(() => null);
}

try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });

  await step("■ 0 e-SMM açık kurulum, e-SMM kullanıcısı OLMAYAN firma: makbuz formu kâğıt (tür notu ve gönderim düğmesi yok); kayıt SMM serisi, Gönderilecekler'e düşmez", async () => {
    await newSmm(page);
    const note = await textOf(page, `${pageInv} [data-profile-note]`);
    ok(!/e-SMM/.test(note), `tür notu e-SMM demiyor ("${note}")`);
    ok(!(await page.$(`${pageInv} [data-act="issue-later"]`)) && !(await page.$(`${pageInv} [data-act="issue-now"]`)), "Kaydet, Sonra Gönder ve Kaydet ve Gönder yok");
    const issue = await textOf(page, `${pageInv} [data-act="issue"]`);
    ok(Boolean(issue), `kayıt düğmesi: "${issue}"`);
    // G1: entegratör kayıtlı, firma e-SMM kullanıcısı değil → formda kâğıt makbuzun nedeni yazar.
    const paper = await paperNote(page);
    ok(!paper.hidden && paper.text === "Kâğıt makbuz: firma e-SMM kullanıcısı olarak işaretli değil (Entegratör Ayarları → Firma / Etiket Tanımları).", `G1 kâğıt makbuzun nedeni formda: "${paper.text}" (gizli: ${paper.hidden})`);
    await shot(page, "esmm-244-0-kagit-form");
    const before = count();
    await page.click(`${pageInv} [data-act="issue"]`);
    // Ders 34: kayıt onayı BEKLENEN sorudur (her belge kaydında numara ve tutarla sorulur); metni kâğıt makbuz olmalı — e-SMM ya da gönderim demez.
    await page.waitForSelector(`${dialog} [data-answer="yes"]`);
    const question = await textOf(page, `${dialog} .hof-modal-text`);
    console.log(`  · onay yanıtlandı (Makbuzu Kaydet, beklenen soru): ${question.slice(0, 140)}`);
    ok(/SMM2026\d{9} numarasıyla serbest meslek makbuzu kaydedilecek/.test(question) && !/e-SMM|gönder/i.test(question), "kayıt onayı kâğıt makbuz numarasını söyler, e-SMM / gönderim demez");
    await page.click(`${dialog} [data-answer="yes"]`);
    for (let index = 0; index < 40 && count() === before; index += 1) await page.waitForTimeout(250);
    const paperRow = lastRow();
    ok(count() === before + 1 && paperRow.kind === "smm" && paperRow.status === "issued", "makbuz kaydedildi (veri tabanı)");
    ok(paperRow.profile === "KAGIT" && /^SMM2026\d{9}$/.test(paperRow.number || "") && paperRow.eStatus === "none", `kâğıt makbuz: ${paperRow.profile} ${paperRow.number} (e-Belge durumu ${paperRow.eStatus})`);
    const pending = unwrap(await api.get("/api/workspace/invoices?tab=pending"))?.invoices?.map(item => item.id) || [];
    ok(!pending.includes(paperRow.id), "Gönderilecekler'de yok");
    ok(edm.state.smm.calls.length === 0 && !edm.state.calls.some(call => ["SendInvoice", "LoadInvoice"].includes(call.op)), "EDM'ye hiçbir gönderim yok");
    await closeAll(page);
    await must("e-SMM kullanıcısı", api.put("/api/workspace/invoices/settings", { esmm: true }));
    await page.reload();
    await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
  });

  await step("■ 1 e-SMM kullanıcısı firmada makbuz formu: tür notu ve gönderim düğmeleri; taslak ayarı açıkken de \"Kaydet ve Gönder\"", async () => {
    await newSmm(page);
    const note = await textOf(page, `${pageInv} [data-profile-note]`);
    ok(/e-SMM kesilir/.test(note), `tür notu: "${note}"`);
    const paper = await paperNote(page);
    ok(paper.hidden, `G1 e-SMM formunda kâğıt nedeni satırı yok (gizli: ${paper.hidden}, "${paper.text}")`);
    ok(Boolean(await page.$(`${pageInv} [data-act="issue-later"]`)), "Kaydet, Sonra Gönder var");
    const now = await textOf(page, `${pageInv} [data-act="issue-now"]`);
    ok(now === "Kaydet ve Gönder", `Kaydet ve Gönder var (${now || "yok"})`);
    await shot(page, "esmm-244-1-form");
    await closeAll(page);
    await must("taslak ayarı aç", api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: true } }));
    await page.reload();
    await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
    await newSmm(page);
    const label = await textOf(page, `${pageInv} [data-act="issue-now"]`);
    ok(label === "Kaydet ve Gönder", `taslak ayarı açıkken e-SMM düğmesi "Kaydet ve Gönder" (${label})`);
    await closeAll(page);
    await must("taslak ayarı kapat", api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: false } }));
    await page.reload();
    await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
  });

  let saved = null;
  await step("■ 2 Kaydet ve Gönder: TES numarası, e-SMM servisine gider; kartta Durum Sorgula ve Resmî Görüntü, taslak düğmesi yok", async () => {
    await newSmm(page);
    const before = count();
    const faturaSends = edm.state.calls.filter(call => call.op === "SendInvoice").length;
    await page.click(`${pageInv} [data-act="issue-now"]`);
    await page.waitForSelector(`${dialog} [data-answer="yes"]`);
    const question = await textOf(page, `${dialog} .hof-modal-text`);
    console.log(`  · onay yanıtlandı (Kaydet ve Gönder, beklenen soru): ${question.slice(0, 120)}`);
    // G3: makbuzda iade belgesi olmaz — onay yalnız iptali söyler (kartta "İade kapalı … yanlışsa iptal edin").
    ok(/Gönderildikten sonra düzenlenemez; yanlışsa iptal gerekir/.test(question) && !/iade gerekir/.test(question), `G3 onay makbuzda iade demiyor: …${question.slice(question.indexOf("Gönderildikten"), question.indexOf("Gönderildikten") + 110)}`);
    await page.click(`${dialog} [data-answer="yes"]`);
    for (let index = 0; index < 60 && !(lastRow()?.eStatus === "sent"); index += 1) await page.waitForTimeout(250);
    await page.waitForSelector(`${pageInv} .hof-plan-title h3`, { timeout: 15000 });
    await page.waitForTimeout(600);
    saved = lastRow();
    ok(count() === before + 1 && saved.kind === "smm" && saved.status === "issued", "makbuz kaydedildi (veri tabanı)");
    ok(saved.profile === "ESMM" && /^TES2026\d{9}$/.test(saved.number), `ESMM + TES numarası (${saved.profile} ${saved.number})`);
    ok(saved.eStatus === "sent", `gönderildi (${saved.eStatus}; ${saved.eMessage})`);
    ok(edm.state.smm.sent.length === 1 && edm.state.smm.sent[0].id === saved.number, "EDM e-SMM servisinde aynı numara");
    ok(edm.state.calls.filter(call => call.op === "SendInvoice").length === faturaSends, "e-Fatura servisine gönderim yok");
    ok(edm.state.smm.violations.length === 0, `e-SMM sözleşmesine uygun (${edm.state.smm.violations.join("; ")})`);
    ok(Boolean(await page.$(`${pageInv} [data-act="e-refresh"]`)), "kartta Durum Sorgula var");
    ok(Boolean(await page.$(`${pageInv} [data-act="e-official"]`)), "kartta Resmî Görüntü var");
    ok(!(await page.$(`${pageInv} [data-act="e-draft"]`)), "Portala Taslak Yükle yok");
    await shot(page, "esmm-244-2-kart");
    await page.click(`${pageInv} [data-act="e-refresh"]`);
    await page.waitForTimeout(1200);
    ok(edm.state.smm.calls.some(call => call.op === "GetSMMStatus"), "Durum Sorgula e-SMM servisine (GetSMMStatus)");
  });

  await step("■ 3 İptal Et: pencere e-SMM'nin önce entegratörde iptal edileceğini söyler; EDM'de ve programda iptal", async () => {
    if (!saved) throw new Error("2. adımın makbuzu yok");
    await closeAll(page);
    await page.evaluate(id => window.HOF.invoices.openDoc(id), saved.id);
    await page.waitForSelector(`${modal} [data-act="cancel"]:not([disabled])`);
    await page.click(`${modal} [data-act="cancel"]`);
    await page.waitForSelector(`${dialog} input[name="reason"]`);
    const intro = await textOf(page, `${dialog} .hof-modal-text`);
    ok(/e-SMM önce entegratörde \(EDM\) iptal edilir/.test(intro), `iptal penceresi: …${intro.slice(-90)}`);
    await page.click(`${dialog} input[name="reason"]`);
    await page.keyboard.type("Müvekkil vazgeçti", { delay: 40 });
    await shot(page, "esmm-244-3-iptal");
    console.log("  · iptal penceresi onaylandı (İptal Et, beklenen pencere)");
    await page.click(`${dialog} button[type="submit"]`);
    for (let index = 0; index < 40 && app.store.get("SELECT status FROM invoices WHERE id = ?", saved.id).status !== "cancelled"; index += 1) await page.waitForTimeout(250);
    const row = app.store.get("SELECT status, e_status AS eStatus FROM invoices WHERE id = ?", saved.id);
    ok(row.status === "cancelled" && row.eStatus === "cancelled", `programda ve EDM'de iptal (${row.status} / ${row.eStatus})`);
    ok(edm.state.smm.cancelled.length === 1 && edm.state.smm.cancelled[0] === saved.ettn.toLowerCase(), "EDM'ye CancelSMM bir kez");
    ok(!edm.state.calls.some(call => call.op === "CancelInvoice"), "e-Fatura servisine iptal yok");
  });
  await step("■ 4 Gönderilecekler'deki e-SMM: \"Kâğıt Makbuz Olarak Bırak\" — kâğıt makbuz serisinden (SMM) numara, Müşteri Fişi (FIS) değil", async () => {
    await closeAll(page);
    const waiting = await must("bekleyen e-SMM", api.post("/api/workspace/invoices", { scenario: "smm", accountId: app.store.get("SELECT id FROM accounts ORDER BY rowid DESC LIMIT 1").id, lines: [{ name: "Danışmanlık Ücreti", qty: 1, unitPrice: 750, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    ok(waiting.profile === "ESMM" && waiting.eStatus === "waiting", `ön koşul: numarasız bekleyen e-SMM (${waiting.profile} ${waiting.eStatus})`);
    await page.evaluate(id => window.HOF.invoices.openDoc(id), waiting.id);
    await page.waitForSelector(`${modal} [data-act="e-withdraw"]`);
    const label = await textOf(page, `${modal} [data-act="e-withdraw"]`);
    ok(label === "Kâğıt Makbuz Olarak Bırak", `düğme: "${label}"`);
    await page.click(`${modal} [data-act="e-withdraw"]`);
    await page.waitForSelector(`${dialog} [data-answer="yes"]`);
    const title = await textOf(page, `${dialog} .hof-modal-title, ${dialog} h2`);
    const message = await textOf(page, `${dialog} .hof-modal-text`);
    console.log(`  · onay yanıtlandı (Kâğıt Makbuz Olarak Bırak, beklenen soru): "${title}" — ${message.slice(0, 100)}`);
    ok(/Kâğıt Makbuz Olarak Bırakılsın mı\?/.test(title) && /kâğıt makbuz/.test(message) && !/Müşteri Fişi/.test(`${title} ${message}`), "onay penceresi kâğıt makbuz der (Müşteri Fişi değil)");
    await page.click(`${dialog} [data-answer="yes"]`);
    for (let index = 0; index < 40 && app.store.get("SELECT e_status AS s FROM invoices WHERE id = ?", waiting.id).s !== "withdrawn"; index += 1) await page.waitForTimeout(250);
    const row = app.store.get("SELECT profile, number, e_status AS eStatus FROM invoices WHERE id = ?", waiting.id);
    ok(row.eStatus === "withdrawn" && row.profile === "KAGIT" && /^SMM2026\d{9}$/.test(row.number || ""), `kâğıt makbuz serisinden numara: ${row.number} (${row.profile} / ${row.eStatus})`);
    ok(app.store.get("SELECT COUNT(*) AS n FROM invoices WHERE series = 'FIS'").n === 0, "Müşteri Fişi (FIS) serisine numara verilmedi");
    await page.waitForTimeout(600);
    const card = await textOf(page, modal);
    ok(card.includes("Kâğıt Makbuz (e-SMM olarak gönderilmedi)") && !card.includes("Müşteri Fişi (e-Belge olarak gönderilmedi)"), "kartta Belge Türü kâğıt makbuz");
    await shot(page, "esmm-244-4-kagit-makbuz");
  });
  // Kullanıcı kararı (22.10.2026, "ekle"): e-SMM'de logo ve kaşe yalnız programın PDF'ine basılır (EDM e-SMM'ye görünüm şablonu kabul etmiyor); Ayarlar söyler.
  await step("■ 5 Fatura Ayarları: e-SMM kullanıcısında Kaşe / İmza açıklaması logo ve kaşenin e-SMM'de yalnız programın PDF'ine basıldığını söyler", async () => {
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${pageInv} [data-act="settings"]`);
    await page.click(`${pageInv} [data-act="settings"]`);
    await page.waitForSelector(`${modal} [data-stamp-field] .hof-inv-logo-tools small`);
    const help = await textOf(page, `${modal} [data-stamp-field] .hof-inv-logo-tools small`);
    ok(help.endsWith("Logo ve kaşe e-SMM'de yalnız programın PDF'ine basılır; resmî görüntüyü EDM çizer."), `Kaşe / İmza açıklaması: …${help.slice(-120)}`);
    await page.$eval(`${modal} [data-stamp-field]`, node => node.scrollIntoView({ block: "center" })).catch(() => null);
    await shot(page, "esmm-244-5-kase-aciklama");
  });
  // G2: Fatura Ayarları açıkken Entegratör Ayarları'nda e-SMM işareti değişince işarete bağlı açıklama yenilenir; kaydedilmemiş alan kaybolmaz.
  await step("■ 6 Fatura Ayarları açıkken Entegratör Ayarları'nda e-SMM işareti değişir: Kaşe / İmza açıklaması yenilenir, yazılan alan durur", async () => {
    const stampHelp = () => textOf(page, `${pageInv} [data-stamp-field] .hof-inv-logo-tools small`);
    const ESMM_SENTENCE = "Logo ve kaşe e-SMM'de yalnız programın PDF'ine basılır; resmî görüntüyü EDM çizer.";
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${pageInv} [data-act="settings"]`);
    await page.click(`${pageInv} [data-act="settings"]`);
    await page.waitForSelector(`${pageInv} [data-stamp-field] .hof-inv-logo-tools small`);
    ok((await stampHelp()).includes(ESMM_SENTENCE), "ön koşul: e-SMM kullanıcısında açıklama e-SMM cümlesini taşır");
    await page.click(`${pageInv} [data-s="seller.phone"]`, { clickCount: 3 });
    await page.keyboard.type("0312 555 00 00", { delay: 40 });
    const toggle = async checked => {
      await page.click(`${pageInv} [data-act="integrator"]`);
      await page.waitForSelector(`${dialog} [data-integ-tab="firm"]`);
      await page.click(`${dialog} [data-integ-tab="firm"]`);
      await page.waitForSelector(`${dialog} [data-i="esmm"]`);
      if ((await page.isChecked(`${dialog} [data-i="esmm"]`)) !== checked) await page.click(`${dialog} [data-i="esmm"]`);
      await page.click(`${dialog} [data-integ-act="save"]`);
      for (let index = 0; index < 40 && (unwrap(await api.get("/api/workspace/invoices/settings"))?.esmm === true) !== checked; index += 1) await page.waitForTimeout(250);
      await page.waitForTimeout(500);
      await page.click(`${dialog} [data-integ-act="close"]`);
      await page.waitForTimeout(400);
    };
    await toggle(false);
    ok(unwrap(await api.get("/api/workspace/invoices/settings"))?.esmm === false, "e-SMM işareti kaldırıldı (sunucu)");
    const off = await stampHelp();
    ok(!off.includes("e-SMM"), `işaret kalkınca açıklamada e-SMM cümlesi yok (pencere kapatılmadan): …${off.slice(-90)}`);
    const phone = await page.inputValue(`${pageInv} [data-s="seller.phone"]`).catch(() => "");
    ok(phone === "0312 555 00 00", `kaydedilmemiş Telefon alanı durdu ("${phone}")`);
    await toggle(true);
    const on = await stampHelp();
    ok(on.endsWith(ESMM_SENTENCE), `işaret yeniden konunca açıklama e-SMM cümlesini taşır: …${on.slice(-90)}`);
    ok((await page.inputValue(`${pageInv} [data-s="seller.phone"]`).catch(() => "")) === "0312 555 00 00", "Telefon alanı ikinci kayıttan sonra da durdu");
    await shot(page, "esmm-244-6-ayarlar-yenilendi");
  });
  // G1: entegratör kayıtlıyken satış faturası kâğıda düşerse nedeni formda; alış faturasında ve entegratörü kayıtlı olmayan firmada not yok.
  await step("■ 7 Satış faturası kâğıda düşünce nedeni formda (firma işareti); Alış'ta, e-Arşiv'de ve entegratörsüz firmada not yok", async () => {
    await must("işaretler kapalı", api.put("/api/workspace/invoices/settings", { efatura: false, earsiv: false }));
    await reloadPage(page);
    await newSmm(page, "service_sale");
    let paper = await paperNote(page);
    ok(!paper.hidden && paper.text === "Kâğıt belge: firma e-Fatura / e-Arşiv kullanıcısı olarak işaretli değil (Entegratör Ayarları → Firma / Etiket Tanımları).", `satış, işaretler kapalı: "${paper.text}" (gizli: ${paper.hidden})`);
    await shot(page, "esmm-244-7-satis-kagit-nedeni");
    await closeAll(page);
    await newSmm(page, "expense_purchase");
    paper = await paperNote(page);
    const purchaseCalc = await page.$eval(`${pageInv} [data-profile-field]`, node => !node.hidden).catch(() => false);
    ok(purchaseCalc && paper.hidden, `Alış faturasında not yok (hesap yapıldı: ${purchaseCalc}; gizli: ${paper.hidden}, "${paper.text}")`);
    await closeAll(page);
    await must("yalnız e-Fatura", api.put("/api/workspace/invoices/settings", { efatura: true, earsiv: false }));
    await reloadPage(page);
    await newSmm(page, "service_sale");
    paper = await paperNote(page);
    ok(!paper.hidden && paper.text === "Kâğıt belge: alıcı e-Fatura mükellefi değil ve firma e-Arşiv kullanıcısı olarak işaretli değil (Entegratör Ayarları → Firma / Etiket Tanımları).", `satış, e-Fatura var e-Arşiv yok, alıcı mükellef değil: "${paper.text}"`);
    await closeAll(page);
    await must("e-Fatura + e-Arşiv", api.put("/api/workspace/invoices/settings", { efatura: true, earsiv: true }));
    await reloadPage(page);
    await newSmm(page, "service_sale");
    paper = await paperNote(page);
    const note = await textOf(page, `${pageInv} [data-profile-note]`);
    ok(paper.hidden && /e-Arşiv kesilir/.test(note), `e-Arşiv'de not yok (gizli: ${paper.hidden}; tür notu "${note}")`);
    await closeAll(page);
    await must("işaretler kapalı, entegratör kullanıcısı yok", api.put("/api/workspace/invoices/settings", { efatura: false, earsiv: false, integrator: { username: "" } }));
    await reloadPage(page);
    await newSmm(page, "service_sale");
    paper = await paperNote(page);
    const next = await textOf(page, `${pageInv} [data-next]`);
    ok(/FIS2026/.test(next) && paper.hidden, `entegratör kayıtlı değilken kâğıt belgede not yok (${next}; gizli: ${paper.hidden}, "${paper.text}")`);
  });
  ok(errors.length === 0, `sayfa hatası yok (${errors.join(" | ").slice(0, 200)})`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ ${String(error?.stack || error).split("\n").slice(0, 3).join(" / ")}`);
} finally {
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
