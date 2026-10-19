// 2.4.3 H5 (fatura modülü yükte hız testi, docs/kanit/2026-10-17/hiz-fatura): yükte fatura listesinde "Daha Fazla Göster" tıklanıyor, satır
// gelmiyordu (30 sn bekleme aşımı; D2'de 4, D3'te 1). Ders 20: yeniden deneme / bekleme uzatma YOK, yarışın ön koşulu ZORLA kurulur.
//
// Ön koşul: başka personel sürekli fatura kaydediyor (her ~0,7 sn; ayrı kullanıcı, canlı olay bu ekrana gelir) → açık listenin arka plan
// yenilemesi (HOF.refresher, en sık 1,5 sn'de bir) sürekli çalışıyor; sunucu yanıtları yükteki gibi geç geliyor (Playwright route: ilk sayfa
// istekleri 0,8 sn, "Daha Fazla" istekleri 2,5 sn bekletilir). Daha Fazla sürerken bir arka plan yenilemesinin yazılması (ön koşul) her denemede
// ölçülür: istek zaman çizelgesinden (oluşmadıysa deneme kanıt sayılmaz, kırmızı).
// Beklenen: tıklama boşa gitmez — en çok 20 sn içinde liste 200'den uzun (ilk 400 satır) ve satırlar sunucunun sırasıyla aynı (eksik/çift yok).
// Eski kodda (4d546e9): liste kapısı (HOF.listGate) Daha Fazla'nın yanıtını eskimiş sayıp üç kez yineliyor, her seferinde araya yenileme girdiği
// için bırakıyordu → tıklama sessizce kayboluyordu. DEPO=<eski kopya> ile sunucu ve istemci o kopyadan yüklenir (kırmızı kanıt).
// Çıkış: "N geçti, M kaldı" (kanıt aracının senaryo biçimi). TUR: deneme sayısı (varsayılan 4).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "DahaFazla243-Admin!";
const STAFF = "DahaFazla243-Muhasebe!";
const NOW = "2026-10-08T12:00:00+03:00";
const ROUNDS = Number(process.env.TUR || 4);
const root = mkdtempSync(path.join(tmpdir(), "destekofis-fatura-daha-fazla-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f72" }, startLicenseTimers: false, gateVerify: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const admin = createClient(BASE);
await admin.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("personel", admin.post("/api/admin/users", { username: "muhasebe2", name: "Başka Personel", role: "muhasebe", password: STAFF, mustChangePassword: false }));
const other = createClient(BASE); // başka personel (canlı olay ekrandaki yöneticiye gelir)
await must("personel giriş", other.login("muhasebe2", STAFF));
await must("personel kurulum", other.post("/api/workspace/bank/setup/dismiss", {}));
const customer = await must("cari", admin.post("/api/workspace/accounts", { name: "Liste Müşterisi", type: "customer", registeredOn: "2026-01-01" }));
const sale = (client, date) => must("satış", client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, force: true }));
// 450 satış (Satış Faturaları sekmesi: 200 + Daha Fazla 200 + 50), tarihler ileri akar.
const dayOf = i => new Date(Date.UTC(2026, 0, 1 + Math.floor((i * 270) / 450))).toISOString().slice(0, 10);
for (let i = 0; i < 450; i += 1) await sale(admin, dayOf(i));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
// Yükteki gibi geç yanıt + zaman çizelgesi: liste istekleri (ilk sayfa / yenileme 0,8 sn, Daha Fazla 2,5 sn).
let slow = false;
const timeline = [];
await context.route(/\/api\/workspace\/invoices\?/, async route => {
  const url = new URL(route.request().url());
  const more = Number(url.searchParams.get("offset") || 0) > 0;
  const entry = { more, start: Date.now(), end: 0 };
  timeline.push(entry);
  const response = await route.fetch();
  if (slow) await new Promise(resolve => setTimeout(resolve, more ? 2500 : 800));
  entry.end = Date.now();
  await route.fulfill({ response });
});
await installPageClock(page, app.config.now);
await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
const inv = ".hof-modal-backdrop.is-visible .hof-invoices-modal";

let passed = 0;
let failed = 0;
let noPrecondition = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const rows = () => page.$$eval(`${inv} tr[data-inv]`, nodes => nodes.map(node => node.dataset.inv)).catch(() => []);

try {
  await page.evaluate(() => window.HOF.invoices.open());
  await page.waitForFunction(sel => document.querySelectorAll(`${sel} tr[data-inv]`).length >= 200, inv, { timeout: 30000 });
  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`Tur ${round}`);
    // Listeyi ilk 200 satıra döndür (sekme yeniden açılır).
    await page.click(`${inv} [data-tab="sale"]`);
    await page.waitForFunction(sel => document.querySelectorAll(`${sel} tr[data-inv]`).length === 200, inv, { timeout: 30000 });
    // Başka personel sürekli kayıt girer; yanıtlar gecikir.
    slow = true;
    let writing = true;
    const writer = (async () => {
      while (writing) {
        await sale(other, "2026-10-08").catch(() => null);
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    })();
    await page.waitForTimeout(2500); // yenilemeler akmaya başlasın
    // Ön koşulu zorla: tıklama bir arka plan yenilemesi SÜRERKEN yapılır (yanıtı Daha Fazla'nın ilk denemesini eskitir).
    const inFlight = await (async () => {
      const until = Date.now() + 15000;
      while (Date.now() < until) {
        if (timeline.some(entry => !entry.more && !entry.end && Date.now() - entry.start < 300)) return true;
        await page.waitForTimeout(20);
      }
      return false;
    })();
    const clickAt = Date.now();
    await page.click(`${inv} [data-act="more"]`);
    const grown = await page.waitForFunction(sel => document.querySelectorAll(`${sel} tr[data-inv]`).length > 200, inv, { timeout: 20000 }).then(() => Date.now() - clickAt, () => null);
    writing = false;
    await writer;
    slow = false;
    // Ön koşul: Daha Fazla isteği sürerken bir yenileme yanıtı yazıldı (ilk denemenin yanıtı eskidi).
    const mores = timeline.filter(entry => entry.more && entry.start >= clickAt);
    const landed = timeline.filter(q => !q.more && mores.some(m => q.end > m.start && q.end < (m.end || Date.now())));
    const overlap = inFlight && landed.length > 0;
    if (!overlap) noPrecondition += 1;
    console.log(`    ön koşul: ${overlap ? "oluştu" : "OLUŞMADI"} (Daha Fazla isteği ${mores.length}, Daha Fazla sürerken yazılan yenileme ${landed.length})`);
    ok(grown !== null, `Daha Fazla satır getirdi (${grown === null ? "20 sn'de gelmedi" : `${grown} ms`}; ${(await rows()).length} satır)`);
    // Ekrandaki sıra = sunucunun sırası (yeni kayıtlar dahil; eksik/çift yok).
    let shown = [];
    let server = [];
    const until = Date.now() + 10000;
    while (Date.now() < until) {
      shown = await rows();
      server = (await must("liste", admin.get(`/api/workspace/invoices?tab=sale&limit=${Math.max(1, shown.length)}`))).invoices.map(item => item.id);
      if (shown.length > 200 && shown.join() === server.join()) break;
      await page.waitForTimeout(500);
    }
    ok(shown.length > 200 && new Set(shown).size === shown.length && shown.join() === server.join(), `liste = sunucunun ilk ${shown.length} satırı (çift ${shown.length - new Set(shown).size})`);
  }
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  if (noPrecondition) failed += noPrecondition;
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\nön koşulu oluşmayan deneme: ${noPrecondition}`);
  console.log(`\n${failed ? "✗" : "✓"} fatura-243-daha-fazla-yaris: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
