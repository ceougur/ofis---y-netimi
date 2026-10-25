// 2.4.5 ekran gezintisi bulgusu B1 (ORTA): Tahsilat Takvimi şeridi tarih sırasızdı. Sunucu kalemleri kaynak sırasıyla birleştirir (tablo, taksit, çek,
// fatura, banka, cari vade, öbür sayfa); şerit ilk 40 pili gösterir → 40'tan çok kalemli firmada sona eklenen cari vade (account|) pili hiç görünmüyordu,
// şerit 27.10 → 26.10 → 23.10 gibi karışık akıyordu. Beklenen (zildeki kural, hof-alerts.js): önce alınmayanlar (gecikmiş / bugün), sonra yaklaşanlar; gün sırası.
//   S1 45 fatura kalemi (1–7 gün sonra vadeli, 45 ayrı cari) + bir gecikmiş fatura (20 gün) + EN SONDA bugün vadeli cari borcu (elle Borç, Vade Tarihi).
//   S2 şeritte ilk pil en gecikmiş ("Şerit Geciken"), ikinci pil bugünkü cari vade ("Şerit Vadeli Cari"); başlıkta "ilk 40".
//   S3 bütün pillerin gün değeri soldan sağa azalmaz (gecikmiş < bugün < yaklaşan).
//   S4 aynı gün içinde ad sırası (zil ile aynı; kimlikle değil).
// Çıkış: "N geçti, M kaldı" (kaldıysa çıkış kodu 1).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-serit-sira-245-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false });
const api = await server.login();
const BASE = server.base;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};

// ---------- Veri (programın kendi uçları; tarihler koşu gününe göre) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
// Şeridin yeri tablo özeti; tutarsız küçük tablo (ad + telefon) kalem üretmez.
const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "rehber.xlsx", sheets: [{ name: "Rehber", matrix: [["Ad Soyad", "Telefon"], ["Rehber Kişi", "0533 400 00 00"]] }] }));
await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
const sale = async (account, issueOffset, dueOffset, amount) =>
  must("fatura", api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: account.id, issueDate: day(issueOffset), lines: [{ name: "Şerit Hizmet", qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open", dueDate: day(dueOffset) } }));
// Adlar oluşturma sırasına TERS yazılır (ad sırası ile kaynak sırası ayrışsın); vade günleri karışık (1–7).
// Fatura serisi tarih sırası ister (kronoloji): geciken fatura önce kesilir.
const late = await must("geciken cari", api.post("/api/workspace/accounts", { name: "Şerit Geciken", phone: "0533 100 00 00", type: "customer" }));
await sale(late, -20, -20, 300);
for (let index = 0; index < 45; index += 1) {
  const ahead = 1 + ((index * 3) % 7);
  const account = await must("cari", api.post("/api/workspace/accounts", { name: `Şerit Müşteri ${pad(45 - index)}`, phone: `0533 2${pad(index)} 00 00`, type: "customer" }));
  await sale(account, 0, ahead, 100 + index);
}
const vadeli = await must("vadeli cari", api.post("/api/workspace/accounts", { name: "Şerit Vadeli Cari", phone: "0533 300 00 00", type: "customer" }));
await must("Borç Yaz (bugün vadeli)", api.post(`/api/workspace/accounts/${vadeli.id}/entries`, { kind: "debt", amount: "750", date: day(-2), dueDate: day(0), note: "Şerit vadeli borç" }));
const dues = await must("takvim", api.get("/api/workspace/dues"));
const lastSource = (dues.items || []).at(-1);
ok((dues.items || []).length >= 47 && lastSource?.source === "account", `sunucu ${dues.items?.length} kalem; cari vade kalemi listenin SONUNDA (ön koşul): ${lastSource?.source}`);

const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.dues?.data), null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "true");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });
  await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 30000 });
  await page.waitForTimeout(600);
  const strip = await page.evaluate(() => ({
    heading: document.querySelector(".hof-payment-promises-heading small")?.textContent || "",
    pills: [...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].map(node => ({ who: node.querySelector("b")?.textContent.trim() || "", state: node.querySelector(".hof-payment-pill-state")?.textContent.trim() || "" })),
  }));
  await page.screenshot({ path: path.join(shots, "serit-sira-245.png") }).catch(() => null);
  const dayOf = state => (/gün gecikti/.test(state) ? -Number(state.match(/\d+/)[0]) : state === "Bugün" ? 0 : state === "Yarın" ? 1 : /gün kaldı/.test(state) ? Number(state.match(/\d+/)[0]) : NaN);
  console.log("\n■ S2 ilk piller ve görünürlük");
  ok(strip.pills.length === 40 && /ilk 40/.test(strip.heading), `şeritte 40 pil, başlıkta "ilk 40": ${strip.pills.length} · ${strip.heading}`);
  ok(strip.pills[0]?.who === "Şerit Geciken" && strip.pills[0]?.state === "20 gün gecikti", `ilk pil en gecikmiş: ${JSON.stringify(strip.pills[0])}`);
  ok(strip.pills[1]?.who === "Şerit Vadeli Cari" && strip.pills[1]?.state === "Bugün", `ikinci pil bugün vadeli cari borcu (listenin sonundaki kalem görünüyor): ${JSON.stringify(strip.pills[1])}`);
  console.log("\n■ S3 gün sırası");
  const days = strip.pills.map(pill => dayOf(pill.state));
  const broken = days.findIndex((value, index) => index > 0 && !(value >= days[index - 1]));
  ok(days.every(Number.isFinite) && broken === -1, `pillerin günü soldan sağa azalmıyor${broken >= 0 ? ` — ${broken}. pilde kırıldı: ${days[broken - 1]} → ${days[broken]}` : ""} (${days.join(",")})`);
  console.log("\n■ S4 aynı günde ad sırası");
  const sameDayBad = strip.pills.findIndex((pill, index) => index > 0 && days[index] === days[index - 1] && strip.pills[index - 1].who.localeCompare(pill.who, "tr") > 0);
  ok(sameDayBad === -1, `aynı gün içinde ad sırası${sameDayBad >= 0 ? ` — ${strip.pills[sameDayBad - 1].who} > ${strip.pills[sameDayBad].who}` : ""}`);
  ok(!errors.length, `sayfa hatası yok: ${errors.join(" | ")}`);
} catch (error) {
  ok(false, `senaryo yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
} finally {
  await browser.close().catch(() => null);
  await server.close().catch(() => null);
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
if (!process.env.EKRAN_DIR) {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // temizlik hatası sonucu ezmez
  }
}
process.exit(failed ? 1 : 0);
