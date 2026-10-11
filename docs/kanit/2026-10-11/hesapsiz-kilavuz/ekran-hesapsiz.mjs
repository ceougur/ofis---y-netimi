// Kılavuz 8. Banka'ya eklenen iki hap bilginin ekran adlarını GERÇEK ekrandan okur (metin-denetle.mjs girdisi). 10.10 ekran metinlerine
// (docs/kanit/2026-10-10/kilavuz/ekran-banka-metinleri.json) bu turda eklenen ekranlar katılır: cari Tahsilat → Havale / EFT → Banka Hesabı
// seçenekleri ("Hesapsız (Açılıştan Önce)") ve Hesaplar → Eski Hareketler → Kurulum Geçmişi (Geri Al, Kart Borcuna Aktar).
// Kullanım: node docs/kanit/2026-10-11/hesapsiz-kilavuz/ekran-hesapsiz.mjs <çıktı.json>
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const { chromium } = createRequire(`${R}/`)("playwright");
const { createApp } = await import(`${R}/server/app.mjs`);
const { createClient, installPageClock } = await import(`${R}/test/helpers.mjs`);
const out = process.argv[2];
if (!out) throw new Error("çıktı dosyası verilmedi");
const PASS = "Kilavuz-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "kilavuz-hesapsiz-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "b"), logLevel: "warn", scheduleBackups: false, now: "2026-10-08T12:00:00+03:00", env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "7f3a91c24be05d6e8a1b2c3d4e5f6074" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const texts = JSON.parse(readFileSync(path.join(R, "docs/kanit/2026-10-10/kilavuz/ekran-banka-metinleri.json"), "utf8"));
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
try {
  const api = createClient(BASE);
  await api.login("admin", PASS);
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const abc = unwrap(await api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
  await api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "bank", date: "2026-09-10", amount: "1.000" });
  await api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "out", method: "card", date: "2026-09-12", amount: "400" });
  const ziraat = unwrap(await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
  await api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  await api.post("/api/workspace/bank/setup", { accountId: ziraat.id, carryClose: true, assign: "all" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" })).newPage();
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  const top = ".hof-modal-backdrop.is-visible:last-of-type";
  const grab = async () => page.$eval(top, node => [node.innerText, ...[...node.querySelectorAll("option")].map(option => option.textContent)].join("\n"));
  // Cari → ABC → + Tahsilat → Havale / EFT → Hesapsız (Açılıştan Önce)
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.click(`.hof-accounts-modal tr[data-account="${abc.id}"]`);
  await page.click('.hof-accounts-modal [data-entry="in"]');
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  await page.selectOption(`${top} select[name="method"]`, "bank");
  await page.waitForSelector(`${top} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`);
  await page.selectOption(`${top} select[name="bankAccountId"]`, "none");
  await page.waitForTimeout(300);
  texts["cari-tahsilat-hesapsiz"] = await grab();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press("Escape").then(() => page.waitForTimeout(250));
  // Banka → Hesaplar → Eski Hareketler (Kurulum Geçmişi, Geri Al, Kart Borcuna Aktar)
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.click('.hof-bank-tabs [data-tab="accounts"]');
  await page.click('[data-act="legacy"]');
  await page.waitForSelector("text=Kurulum Geçmişi", { timeout: 10000 });
  texts["eski-hareketler-kurulum-gecmisi"] = await grab();
  writeFileSync(out, JSON.stringify(texts, null, 1));
  console.log(`yazıldı: ${out}; yeni ekranlar: cari-tahsilat-hesapsiz, eski-hareketler-kurulum-gecmisi`);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
