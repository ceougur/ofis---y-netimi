// Banka → Hareketler: "Daha Fazla Göster" ile arka plan yenilemesinin (quiet reload) yarışı — ZORLA üretim (ders 20).
// Ürün kodu DEĞİŞMEZ. Yanıtlar Playwright route ile tutulur (sunucu yükünün etkisi: yanıt sırası değişir).
//   Kip A (geri alma): arka plan yenilemesinin /movements isteği tutulur; o sırada Daha Fazla tıklanır (imleçli istek hemen döner, liste 100);
//          sonra tutulan yanıt bırakılır. Beklenen (doğru): liste ≥ 100 kalır. Hata: 50'ye döner.
//   Kip B (atlama): Daha Fazla'nın imleçli isteği tutulur; o sırada başka oturum masraf yazar → arka plan yenilemesi (hızlı) listeyi taze 50 ile
//          değiştirir; sonra imleçli yanıt bırakılır → eski listenin 51.+ satırları eklenir. Ekrandaki İşlem No dizisi sunucunun ilk N satırıyla
//          karşılaştırılır. Hata: bir hareket listede YOK (atlanır) ya da iki kez.
//   Kontrol: aynı adımlar, tutma YOK.
// Kullanım: node daha-fazla-yaris.mjs [--tur 10] [--json çıktı]
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.DEPO || "/home/user/ofis---y-netimi";
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const ROUNDS = Number(opt("tur", 10)) || 10;
const OUTPUT = opt("json", "");
const { chromium } = await import(pathToFileURL(path.join(ROOT, "node_modules", "playwright", "index.mjs")).href);
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const PASS = "Yaris-Admin-2026!";
const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString();
const TODAY = local.slice(0, 10);
const root = mkdtempSync(path.join(tmpdir(), "destekofis-dahafazla-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f77" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return res.data?.data ?? res.data;
};
const writer = createClient(BASE);
await must("giriş", writer.login("admin", PASS));
const BANK = "/api/workspace/bank";
const a = await must("hesap A", writer.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: `${TODAY.slice(0, 8)}01`, amount: "100.000", confirmed: true } }));
const b = await must("hesap B", writer.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: `${TODAY.slice(0, 8)}01`, amount: "100.000", confirmed: true } }));
for (let i = 0; i < 160; i += 1) await must(`masraf ${i}`, writer.post(`${BANK}/vouchers`, { type: "fee", accountId: i % 2 ? a.id : b.id, date: TODAY, amount: `${10 + i}`, feeType: "eft", tax: "bsmv_incl", description: `Hazırlık ${i}`, similarOk: true, requestId: randomUUID() }));
let writes = 0;
const writeOther = () => must("başka oturumun masrafı", writer.post(`${BANK}/vouchers`, { type: "fee", accountId: a.id, date: TODAY, amount: "1", feeType: "eft", tax: "bsmv_incl", description: `Arka plan ${(writes += 1)}`, similarOk: true, requestId: randomUUID() }));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
const page = await context.newPage();
page.on("dialog", dialog => dialog.accept());
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(String(error.message || error)));
// Tutma düzeneği: hold = { kind: "plain" | "cursor" } → o türdeki SIRADAKİ /movements isteği bırakılana dek tutulur.
let hold = null;
let held = null;
const seen = [];
await page.route("**/api/workspace/bank/movements?*", async route => {
  const url = new URL(route.request().url());
  const kind = url.searchParams.has("cursor") ? "cursor" : "plain";
  seen.push({ at: Date.now(), kind, limit: url.searchParams.get("limit") || "" });
  if (hold && hold.kind === kind) {
    const mine = hold;
    hold = null;
    const response = await route.fetch();
    await new Promise(resolve => {
      held = { kind, release: resolve };
      mine.arrived();
    });
    return route.fulfill({ response });
  }
  return route.continue();
});
const armHold = kind =>
  new Promise(resolve => {
    hold = { kind, arrived: resolve };
  });
const releaseHeld = () => {
  const h = held;
  held = null;
  h?.release();
};
await page.goto(BASE);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await page.click('#hof-auth button[type="submit"]');
await page.waitForSelector('#hof-sidecard [data-action="bank"]', { timeout: 60000 });
const WIN = ".hof-bank-modal";
const ROWS = `${WIN} .hof-bank-moves tbody tr[data-event]`;
await page.click('#hof-sidecard [data-action="bank"]');
await page.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 60000 });
await page.click(`${WIN} .hof-bank-tabs [data-tab="movements"]`);
await page.waitForSelector(ROWS, { timeout: 60000 });
const count = () => page.$$eval(ROWS, list => list.length);
const shownNos = () => page.$$eval(ROWS, list => list.map(row => row.dataset.no));
// Gözlemci: tıklamadan sonra görülen en çok satır sayısı.
await page.evaluate(rowsSel => {
  window.__max = 0;
  new MutationObserver(() => {
    window.__max = Math.max(window.__max, document.querySelectorAll(rowsSel).length);
  }).observe(document.body, { childList: true, subtree: true });
}, ROWS);
const resetList = async () => {
  // Liste başa: Süzgeç değiştir (Hesap A → Tüm) — 50 satır.
  await page.selectOption(`${WIN} [data-mv="account"]`, a.id);
  await page.waitForFunction(id => document.querySelector(".hof-bank-modal [data-moves]")?.dataset.account === id, a.id, { timeout: 15000 });
  await page.selectOption(`${WIN} [data-mv="account"]`, "");
  await page.waitForFunction(rowsSel => document.querySelector(".hof-bank-modal [data-moves]")?.dataset.account === "" && document.querySelectorAll(rowsSel).length === 50, ROWS, { timeout: 15000 });
  await page.waitForTimeout(2500); // önceki yenilemeler bitsin
};
const serverFirst = async n => (await must("sunucu listesi", writer.get(`${BANK}/movements?limit=${n}`))).rows.map(row => row.no);
const compare = (shown, truth) => {
  const missing = truth.filter(no => !shown.includes(no));
  const dup = shown.filter((no, i) => shown.indexOf(no) !== i);
  const extra = shown.filter(no => !truth.includes(no));
  return { missing, dup, extra };
};

const results = { tarih: new Date().toISOString(), A: [], B: [], kontrol: [] };
for (let n = 1; n <= ROUNDS; n += 1) {
  // ---- Kip A ----
  await resetList();
  await page.evaluate(() => (window.__max = 0));
  let arrived = armHold("plain");
  await writeOther(); // canlı olay → arka plan yenilemesi → /movements (tutulur)
  const gotQuiet = await Promise.race([arrived.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]);
  if (!gotQuiet) hold = null;
  const before = await count();
  await page.click(`${WIN} [data-act="mv-more"]`);
  const grew = await page.waitForFunction(c => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length > c, before, { timeout: 8000 }).then(() => true).catch(() => false);
  const afterMore = await count();
  releaseHeld();
  const timeline = [];
  for (let k = 0; k < 10; k += 1) { timeline.push(await count()); await page.waitForTimeout(100); }
  console.log("   zaman çizgisi (bırakmadan sonra 100 ms):", timeline.join(","));
  const finalA = await count();
  const maxA = await page.evaluate(() => window.__max);
  const truthA = await serverFirst(finalA);
  const shownA = await shownNos();
  console.log("   istekler:", JSON.stringify(seen.splice(0).map(x => x.kind + (x.limit ? ":" + x.limit : ""))));
  results.A.push({ n, arkaPlanTutuldu: gotQuiet, once: before, dahaFazlaSonrasi: afterMore, buyudu: grew, enCok: maxA, son: finalA, geriAlindi: grew && finalA < afterMore, ...compare(shownA, truthA) });
  console.log(`[A] tur ${n}: tutuldu ${gotQuiet} · önce ${before} · Daha Fazla sonrası ${afterMore} · en çok ${maxA} · son ${finalA}${grew && finalA < afterMore ? " · GERİ ALINDI" : ""}`);

  // ---- Kip B ----
  await resetList();
  arrived = armHold("cursor");
  await page.click(`${WIN} [data-act="mv-more"]`);
  const gotMore = await Promise.race([arrived.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]);
  if (!gotMore) hold = null;
  const firstNo = (await shownNos())[0];
  await writeOther();
  // arka plan yenilemesi listeyi taze 50 ile değiştirene dek bekle (ilk satır değişir)
  const refreshed = await page.waitForFunction(first => document.querySelector(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")?.dataset.no !== first, firstNo, { timeout: 10000 }).then(() => true).catch(() => false);
  releaseHeld();
  await page.waitForTimeout(2500);
  const shownB = await shownNos();
  const truthB = await serverFirst(shownB.length);
  const cmpB = compare(shownB, truthB);
  results.B.push({ n, imlecTutuldu: gotMore, yenilendi: refreshed, satir: shownB.length, ...cmpB });
  console.log(`[B] tur ${n}: imleç tutuldu ${gotMore} · arka plan yeniledi ${refreshed} · satır ${shownB.length} · eksik ${JSON.stringify(cmpB.missing)} · çift ${JSON.stringify(cmpB.dup)} · fazla ${JSON.stringify(cmpB.extra)}`);

  // ---- Kontrol (tutma yok, arka plan yazımı yok) ----
  await resetList();
  const c0 = await count();
  await page.click(`${WIN} [data-act="mv-more"]`);
  await page.waitForFunction(c => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length > c, c0, { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(1500);
  const shownC = await shownNos();
  const cmpC = compare(shownC, await serverFirst(shownC.length));
  results.kontrol.push({ n, satir: shownC.length, ...cmpC });
  console.log(`[K] tur ${n}: satır ${shownC.length} · eksik ${cmpC.missing.length} · çift ${cmpC.dup.length}`);
}
const sum = {
  A_geriAlinan: results.A.filter(item => item.geriAlindi).length,
  A_tutulan: results.A.filter(item => item.arkaPlanTutuldu).length,
  B_eksikli: results.B.filter(item => item.missing.length).length,
  B_ciftli: results.B.filter(item => item.dup.length).length,
  B_tutulan: results.B.filter(item => item.imlecTutuldu && item.yenilendi).length,
  K_hatali: results.kontrol.filter(item => item.missing.length || item.dup.length || item.satir <= 50).length,
  tur: ROUNDS,
  sayfaHatalari: pageErrors,
};
results.ozet = sum;
console.log("ÖZET", JSON.stringify(sum));
if (OUTPUT) writeFileSync(OUTPUT, JSON.stringify(results, null, 1));
await page.screenshot({ path: path.join(path.dirname(new URL(import.meta.url).pathname), "daha-fazla-son.png") }).catch(() => null);
await browser.close();
await app.close();
rmSync(root, { recursive: true, force: true });
