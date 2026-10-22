// 2.4.4 — E6 (müşteri isteği 19.10.2026): Fatura → Gönderilecekler seçim çubuğunda "Seçilenleri Gönder (N)". GERÇEK tarayıcıda, ekrandan; sahte EDM (ağa
// çıkmaz; her gönderim 900 ms), sahte saat (ders 13).
// KURAL: e-Belge numarası seri + yıl içinde tarih sırasıyla verilir; seçilmemiş daha eski tarihli bekleyen varken seçilen yenisi numara alamaz → düğme bunu
// gönderimden ÖNCE sorar ("Önce Daha Eski Tarihli Belgeler Gönderilmeli": Onları da Ekle ve Gönder / Vazgeç); sessiz atlama ya da yarım tur yok.
//   A. 2 eski seçilmemiş + 3 yeni seçili: düğme (3); basınca soru; Vazgeç → EDM'ye 0 gönderim, numara yok, bilgi bildirimi; yeniden bas → Ekle → 5 belge
//      gider, numara = tarih sırası, her biri bir kez; gönderim sürerken Tümünü Gönder de basılamaz, ilerleme Seçilenleri Gönder'de.
//   B. Eski belge yokken soru yok: "N Belge Gönderilsin mi?" → yalnız seçilenler gider; seçilmeyen bekler.
//   C. Sayı yalnız gönderilebilirleri sayar: Tüm sekmesinde gönderilmiş, iptal edilmiş ve kalıcı engelli bekleyen seçilse de (1); onayda kalıcı engelli
//      "gönderilmez" diye söylenir, yalnız bekleyen gider; kalan seçim yalnız kalıcı engelliyse düğme pasif (0) ve nedeni yanında yazılı.
//   D. Onay penceresi açıkken başka oturum daha eski tarihli belge kaydeder (e-Fatura serisi): sunucu gönderimden önce yine sorar (409) — Vazgeç → 0
//      gönderim; yeniden → Ekle → TEF sırası = tarih sırası.
// Eski kodda (163dd5d) düğme yoktur → A kırmızı; DEPO=<eski kopya> ile koşulur. Her soru/onay yanıtı nedeniyle yazılır (ders 34). Çıkış: "N geçti, M kaldı".
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
const SEND_MS = 900;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
resetEdmCaches();
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  if (/SendInvoiceRequest/.test(String(init?.body || ""))) await sleep(SEND_MS);
  return globalThis.fetch(input, init);
};
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg244-secilenleri-gonder-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, fetchImpl, edocEnabled: true, testSeriesStart: () => 1, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f46" }, startLicenseTimers: false });
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
const today = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
const day = offset => {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const buyers = [];
for (let i = 0; i < 3; i += 1) buyers.push((await must("cari", api.post("/api/workspace/accounts", { name: `Perakende ${i + 1}`, type: "customer", partyKind: "person", firstName: "Perakende", familyName: `${i + 1}`, taxNo: "11111111111", address: "Kordon 1", district: "Konak", city: "İzmir" }))).id);
const sale = (i, offset) => must("bekleyen", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyers[i % 3], issueDate: day(offset), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100 + i, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
const row = id => app.store.get("SELECT number, issue_date AS issueDate, e_status AS eStatus, ettn FROM invoices WHERE id = ?", id);
const sends = () => edm.state.calls.filter(call => call.op === "SendInvoice").length;
const sentOnce = id => edm.state.calls.filter(call => call.op === "SendInvoice" && call.raw.includes(row(id).ettn)).length === 1;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let requests = 0;
page.on("request", request => {
  if (request.url().includes("/api/workspace/invoices/send-pending")) requests += 1;
});
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
const toasts = () => page.$$eval(".hof-toast", nodes => nodes.map(node => `${node.className}|${node.querySelector(".hof-toast-text")?.textContent || ""}`)).catch(() => []);
const clearToasts = () => page.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
const selButton = `${pageInv} [data-act="send-selected"]`;
const allButton = `${pageInv} [data-act="send-pending"]`;
// Ders 34: test her soruyu/onayı kendisi yanıtlar ve nedenini yazar; beklenen soru gelmezse kırmızı.
const answer = async (expectTitle, yes, why) => {
  const handle = await page.waitForSelector(`${dialog} [data-answer="yes"]`, { timeout: 8000 }).catch(() => null);
  if (!handle) return ok(false, `beklenen soru çıkmadı: "${expectTitle}"`) && null;
  const title = (await page.textContent(`${dialog} .hof-modal-title, ${dialog} h2`).catch(() => "")) || "";
  const text = (await page.textContent(`${dialog} .hof-modal-text`).catch(() => "")) || "";
  console.log(`    [soru] "${title.trim()}" → ${yes ? "Evet" : "Vazgeç"} (${why})`);
  ok(new RegExp(expectTitle).test(title), `soru başlığı "${expectTitle}" (${title.trim()})`);
  await page.click(`${dialog} [data-answer="${yes ? "yes" : "no"}"]`);
  return text;
};
const check = async id => {
  await page.check(`${pageInv} input[data-sel="${id}"]`);
};
const openTab = async tab => {
  await page.evaluate(t => window.HOF.invoices.open({ tab: t }), tab);
  await page.waitForSelector(`${pageInv} .hof-inv-table`);
};

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.open);

  console.log("A) 2 eski seçilmemiş + 3 yeni seçili — soru gönderimden ÖNCE; Vazgeç → hiçbir şey; Ekle → 5 belge sırayla");
  const older = [await sale(0, -5), await sale(1, -4)];
  const fresh = [await sale(2, -2), await sale(0, -1), await sale(1, 0)];
  await openTab("pending");
  ok(!(await page.$(selButton)), "seçim yokken Seçilenleri Gönder görünmez");
  for (const doc of fresh) await check(doc.id);
  await page.waitForSelector(selButton);
  ok(/^Seçilenleri Gönder \(3\)$/.test((await page.textContent(selButton)).trim()), `düğme seçilen 3 belge (${(await page.textContent(selButton)).trim()})`);
  let before = sends();
  let reqBefore = requests;
  await page.click(selButton);
  const asked = await answer("Önce Daha Eski Tarihli Belgeler Gönderilmeli", false, "kullanıcı vazgeçer: hiçbir belge gitmemeli");
  ok(asked && /daha eski tarihli 2 belge Gönderilecekler'de bekliyor/.test(asked), `soru eski belge sayısını söyler (${String(asked).slice(0, 200)})`);
  ok(asked && /Perakende 1 12\.06\.2026, Perakende 2 13\.06\.2026/.test(asked), `soru eski belgelerin carisini ve tarihini söyler (${String(asked).slice(0, 260)})`);
  await sleep(500);
  ok(sends() === before, `Vazgeç: EDM'ye gönderim yok (${sends() - before})`);
  ok(requests - reqBefore === 1, `Vazgeç: yalnız ön denetim isteği (${requests - reqBefore})`);
  ok([...older, ...fresh].every(doc => row(doc.id).eStatus === "waiting" && !row(doc.id).number), "Vazgeç: hiçbir belge numara almadı");
  ok((await toasts()).some(item => /hof-toast-info[^|]*\|Gönderilmedi: seçilmemiş daha eski tarihli 2 belge önce gönderilmeli/.test(item)), `Vazgeç bildirimi (${(await toasts()).join(" ‖ ").slice(0, 300)})`);
  ok(/^Seçilenleri Gönder \(3\)$/.test((await page.textContent(selButton)).trim()), "seçim korunur");
  await clearToasts();
  before = sends();
  await page.click(selButton);
  await answer("Önce Daha Eski Tarihli Belgeler Gönderilmeli", true, "kullanıcı eskileri de ekler");
  let progressSeen = false;
  let allDisabled = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const state = await page.$eval(selButton, node => ({ text: node.textContent.trim(), disabled: node.disabled })).catch(() => null);
    if (state && /^Gönderiliyor: \d+ \/ 5$/.test(state.text) && state.disabled) progressSeen = true;
    const other = await page.$eval(allButton, node => node.disabled).catch(() => null);
    if (state && /^Gönderiliyor/.test(state.text) && other === true) allDisabled = true;
    if ((await toasts()).some(item => /belge gönderildi/.test(item))) break;
    await sleep(200);
  }
  const done = await toasts();
  ok(done.some(item => /hof-toast-success[^|]*\|5 belge gönderildi\.$/.test(item)), `bitiş "5 belge gönderildi." (${done.join(" ‖ ").slice(0, 300)})`);
  ok(progressSeen, "ilerleme Seçilenleri Gönder düğmesinde (Gönderiliyor: X / 5), basılamaz");
  ok(allDisabled, "gönderim sürerken Tümünü Gönder basılamaz");
  ok(sends() - before === 5, `EDM'ye 5 gönderim (${sends() - before})`);
  const rows = [...older, ...fresh].map(doc => row(doc.id));
  ok(rows.every(item => /^TEA2026/.test(item.number) && item.eStatus !== "waiting"), "beşi de numaralı ve gönderilmiş");
  ok(rows.map(item => Number(item.number.slice(7))).join(",") === "1,2,3,4,5", `numara sırası = tarih sırası (${rows.map(item => item.number).join(", ")})`);
  ok([...older, ...fresh].every(doc => sentOnce(doc.id)), "her belge EDM'ye bir kez");
  await page.waitForFunction(sel => !document.querySelector(sel), selButton, { timeout: 10000 }).catch(() => null);
  ok(!(await page.$(selButton)), "gidenler seçimden düştü (düğme kalktı)");

  console.log("B) eski bekleyen yokken soru yok — yalnız seçilenler gider");
  await clearToasts();
  const next = [await sale(0, 0), await sale(1, 0), await sale(2, 0)];
  await openTab("pending");
  await check(next[0].id);
  await check(next[1].id);
  await page.waitForSelector(selButton);
  ok(/^Seçilenleri Gönder \(2\)$/.test((await page.textContent(selButton)).trim()), "düğme (2)");
  before = sends();
  await page.click(selButton);
  const plain = await answer("^2 Belge Gönderilsin mi\\?$", true, "eski bekleyen yok: düz onay beklenir");
  ok(plain && /Seçilen 2 belge tarih sırasıyla/.test(plain), `onay metni (${String(plain).slice(0, 160)})`);
  await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /belge gönderildi/.test(node.textContent)), null, { timeout: 20000 }).catch(() => null);
  ok((await toasts()).some(item => /hof-toast-success[^|]*\|2 belge gönderildi\.$/.test(item)), `bitiş "2 belge gönderildi." (${(await toasts()).join(" ‖ ").slice(0, 300)})`);
  ok(sends() - before === 2, `EDM'ye 2 gönderim (${sends() - before})`);
  ok(row(next[2].id).eStatus === "waiting" && !row(next[2].id).number, "seçilmeyen belge Gönderilecekler'de bekliyor");

  console.log("C) sayı yalnız gönderilebilirleri sayar (gönderilmiş, iptal, kalıcı engelli sayılmaz); kalıcı engelli onayda söylenir; yalnız engelli kalınca düğme pasif + neden");
  await clearToasts();
  const cancelled = await sale(0, 0);
  await must("iptal", api.post(`/api/workspace/invoices/${cancelled.id}/cancel`, { reason: "Deneme" }));
  const blocked = await sale(1, 0);
  app.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", day(-6), blocked.id);
  await openTab("all");
  for (const id of [fresh[2].id, cancelled.id, blocked.id, next[2].id]) await check(id);
  await page.waitForSelector(selButton);
  ok(/^Seçilenleri Gönder \(1\)$/.test((await page.textContent(selButton)).trim()), `4 seçili (gönderilmiş, iptal, kalıcı engelli, bekleyen) → gönderilebilir 1 (${(await page.textContent(selButton)).trim()})`);
  before = sends();
  await page.click(selButton);
  const permanentText = await answer("^1 Belge Gönderilsin mi\\?$", true, "kalıcı engelli seçili belge gönderilmez, onayda söylenir");
  ok(permanentText && /1 seçili belge kalıcı engelli olduğu için gönderilmez/.test(permanentText), `onay kalıcı engelliyi söyler (${String(permanentText).slice(0, 220)})`);
  await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /belge gönderildi/.test(node.textContent)), null, { timeout: 20000 }).catch(() => null);
  ok(sends() - before === 1, `EDM'ye 1 gönderim (${sends() - before})`);
  ok(row(blocked.id).eStatus === "waiting" && !row(blocked.id).number, "kalıcı engelli belge numara almadı");
  ok(/^TEA2026/.test(row(next[2].id).number), "bekleyen belge gönderildi");
  const summary = (await toasts()).find(item => /belge gönderildi/.test(item)) || "";
  ok(/hof-toast-success[^|]*\|1 belge gönderildi\.$/.test(summary), `özet "1 belge gönderildi." — kalıcı engelli gönderime girmedi (${summary.slice(0, 260)})`);
  await page.waitForFunction(sel => document.querySelector(sel)?.disabled === true, selButton, { timeout: 10000 }).catch(() => null);
  const idle = await page.$eval(selButton, node => ({ text: node.textContent.trim(), disabled: node.disabled, why: node.parentElement.querySelector("[data-send-selected-why]")?.textContent || "" })).catch(() => null);
  ok(idle && idle.disabled && /^Seçilenleri Gönder \(0\)$/.test(idle.text), `yalnız kalıcı engelli seçili kaldı: düğme pasif (0) (${JSON.stringify(idle)})`);
  ok(idle && /kalıcı engelli; e-Belge olarak gönderilemez/.test(idle.why), `pasif düğmenin nedeni görünür yazı (${idle?.why})`);

  console.log("D) onay penceresi açıkken başka oturum daha eski belge kaydeder → gönderim yine ÖNCE sorulur (409); Vazgeç → hiçbir şey; yeniden → Ekle");
  await clearToasts();
  const firm = await must("e-Fatura carisi", api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }));
  const efNew = await must("e-Fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: firm.id, issueDate: day(0), lines: [{ name: "Hizmet", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
  ok(efNew.profile === "TEMELFATURA", `ön koşul: e-Fatura (TEF) serisi (${efNew.profile})`);
  await openTab("pending");
  // C'de gönderilemeyen (kalıcı engelli) belge seçili kaldı (toplu işlemlerin kuralı); bu adım yalnız yeni e-Fatura'yı seçer.
  if (await page.$(`${pageInv} [data-act="clear-sel"]`)) await page.click(`${pageInv} [data-act="clear-sel"]`);
  await check(efNew.id);
  await page.waitForSelector(selButton);
  before = sends();
  await page.click(selButton);
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  // Onay penceresi açıkken (ön denetim geçti) başka kullanıcı aynı seride daha eski tarihli belge kaydeder.
  const efOld = await must("e-Fatura eski", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: firm.id, issueDate: day(-2), lines: [{ name: "Hizmet", qty: 1, unitPrice: 400, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
  await answer("^1 Belge Gönderilsin mi\\?$", true, "ön denetim geçmişti; bu arada eski belge kaydedildi");
  const raced = await answer("Önce Daha Eski Tarihli Belgeler Gönderilmeli", false, "sunucu gönderimden önce yeniden sordu; kullanıcı vazgeçer");
  ok(raced && /daha eski tarihli 1 belge/.test(raced), `yarışta soru yeniden çıktı (${String(raced).slice(0, 160)})`);
  await sleep(500);
  ok(sends() === before, `yarışta EDM'ye gönderim yok (${sends() - before})`);
  ok(!row(efNew.id).number && !row(efOld.id).number, "yarışta hiçbir belge numara almadı");
  await clearToasts();
  await page.click(selButton);
  await answer("Önce Daha Eski Tarihli Belgeler Gönderilmeli", true, "kullanıcı eskiyi de ekler");
  await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /belge gönderildi/.test(node.textContent)), null, { timeout: 30000 }).catch(() => null);
  ok((await toasts()).some(item => /hof-toast-success[^|]*\|2 belge gönderildi\.$/.test(item)), `bitiş "2 belge gönderildi." (${(await toasts()).join(" ‖ ").slice(0, 300)})`);
  ok(row(efOld.id).number === "TEF2026000000001" && row(efNew.id).number === "TEF2026000000002", `TEF sırası = tarih sırası (${row(efOld.id).number}, ${row(efNew.id).number})`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg244-secilenleri-gonder-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg244-secilenleri-gonder: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
