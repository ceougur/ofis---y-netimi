// Ekran kanıtı (2.4.4 madde 23): gönderilmiş e-Arşiv fatura kartı — süre içinde "Son İptal Günü", süre dolunca "İptal Et kapalı: <neden>" ve pasif düğme.
// Sahte EDM + sahte saat (kesim 0. gün, gönderim 3. gün; görüntüler 5. ve 12. gün). Kullanım (depo kökünden):
//   flock <kilit> node docs/kanit/2026-10-22/244-iptal/betikler/ekran.mjs docs/kanit/2026-10-22/244-iptal/ekran
// Çıkış: "N geçti, M kaldı" + # tests/pass/fail; görüntüler verilen klasöre.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createClock } from "../../../../../server/lib/clock.mjs";
import { CURRENT, bootVersion } from "../../../../../test/guvenilirlik/surumler.mjs";
import { OUR_VKN, startMockEdm } from "../../../../../test/einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../../../../../test/helpers.mjs";

const shots = path.resolve(process.argv[2] || ".");
const root = mkdtempSync(path.join(tmpdir(), "iptal-ekran-"));
const D = new Date(2026, 5, 17);
const at = days => new Date(D.getFullYear(), D.getMonth(), D.getDate() + days, 10, 0, 0).getTime();
const clock = createClock({ time: at(0), fixed: true });
const edm = await startMockEdm();
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "", HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", edocEnabled: true, edocStatusPollMs: [10, 10], env: NO_ENV_PROXY, now: clock });
const admin = await server.login();
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
};
const browser = await chromium.launch();
try {
  await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
  await must("firma", admin.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
  const person = await must("cari", admin.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", taxNo: "10000000146", city: "İzmir", email: "ayse@example.com" }));
  const doc = await must("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person.id || person.account?.id, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
  clock.set(at(3));
  await must("gönder", admin.post(`/api/workspace/invoices/${doc.id}/send`, {}));
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
  const card = ".hof-modal-backdrop.is-visible .hof-invoices-modal";
  const openCard = async () => {
    await page.evaluate(id => window.HOF.invoices.open({ id }), doc.id);
    await page.waitForSelector(`${card} [data-act="cancel"]`);
    await page.waitForTimeout(400);
  };
  const factText = () => page.$$eval(`${card} .hof-chq-facts > div`, nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()).find(text => text.startsWith("Son İptal Günü")) || "");

  console.log("■ 5. gün: süre içinde");
  clock.set(at(5));
  await openCard();
  const inside = await factText();
  ok(inside === "Son İptal Günü28.06.2026 (alıcıya iletildiği 20.06.2026 gününden sonraki 8 gün)", `kartta: ${inside}`);
  ok(await page.$eval(`${card} [data-act="cancel"]`, node => !node.disabled), "İptal Et açık");
  await page.screenshot({ path: path.join(shots, "1-sure-icinde-son-iptal-gunu.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  console.log("■ 12. gün: süre doldu");
  clock.set(at(12));
  await openCard();
  const late = await factText();
  ok(/^Son İptal GünüSüre Doldu \(en geç 28\.06\.2026\)$/.test(late), `kartta: ${late}`);
  ok(await page.$eval(`${card} [data-act="cancel"]`, node => node.disabled), "İptal Et pasif");
  const why = await page.$eval(`${card} .hof-inv-blocks`, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
  ok(why.includes("İptal Et kapalı: e-Arşiv faturanın iptal süresi doldu: alıcıya iletildiği 20.06.2026 gününden sonraki 8 gün içinde (en geç 28.06.2026) iptal edilebilirdi."), `neden: ${why.slice(0, 200)}`);
  const title = await page.$eval(`${card} [data-act="cancel"]`, node => node.title);
  ok(/iptal süresi doldu/.test(title), "düğme ipucunda da neden");
  await page.screenshot({ path: path.join(shots, "2-sure-doldu-iptal-kapali.png") });
  ok(!errors.length, `sayfa hatası yok ${errors.join(" | ")}`);
} finally {
  await browser.close();
  await server.close();
  await edm.close();
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
console.log(`# tests ${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
process.exitCode = failed ? 1 : 0;
