// Senaryo 2.0.20 — kullanıcı istekleri (CLAUDE.md "2.0.20 YAPILACAKLAR"), arayüzden, sıfırdan:
//   kullanıcının durumu: 10 müşteri × 10.000 TL, 10 taksit, ilk taksit ödenmiş — Taksit Excel'i "Ödenen" kolonuyla arayüzden
//   1. raporların altında TOPLAM satırı (Rapor Merkezi + Raporlar → Cari Ekstre/Mizan), kaydırınca sabit
//   2. Cari Listesi: Toplam Borç (Anlaşılan) 100.000 · Toplam Alacak (Ödenen) 10.000 · Kalan 90.000
//   3. dönemli raporlar Bu Yıl ile açılır, son seçilen dönem hatırlanır
//   4. boş dönemde "Bu dönemde kayıt yok" + Tüm Zamanları Göster
//   7. sol üstte şirket sayısı rozeti yok (2 şirketle)
//   8. Cari Bazında Tahsilat: Excel'de ödenmiş (açılış) Önceden Ödenen kolonunda ve Toplam'da
// Çalıştırma: npm run test:senaryo-220
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-220");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-220-"));
const xlsx = (file, name, columns, rows) => {
  const target = path.join(root, file);
  writeFileSync(target, buildXlsx([{ name, columns, rows }], { title: name }));
  return target;
};
const iso = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const tr = value => value.split("-").reverse().join(".");


const startXlsx = xlsx("baslangic.xlsx", "Kayıtlar", ["Ad Soyad", "Telefon"], [{ "Ad Soyad": "Örnek Kişi", Telefon: "0532 000 00 01" }]);
const people = Array.from({ length: 10 }, (_, i) => ({ "Ad Soyad": `Müşteri ${String(i + 1).padStart(2, "0")}`, Telefon: `0532 100 00 ${String(i + 1).padStart(2, "0")}`, "Toplam Tutar": "10.000", "Taksit Sayısı": "10", "İlk Vade": tr(iso(-20)), Ödenen: "1.000" }));
const plansXlsx = xlsx("taksit-odenen.xlsx", "Taksit", ["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Ödenen"], people);

const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f94" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
page.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
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
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const call = (url, body) => page.evaluate(async ([url, body]) => (await (await fetch(url, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json()).data, [url, body]);
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(modal)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
};
const lastModal = fn => page.evaluate(fn => new Function("box", `return (${fn})(box)`)([...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1)), fn.toString());
const money = text => Number(String(text || "").replace(/[^\d,-]/g, "").replace(",", "."));
async function openCenterReport(id) {
  await closeAll();
  await page.click("#hof-sidecard [data-action=analytics]");
  await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${modal} [data-rc-list] [data-report="${id}"]`, { timeout: 15000 });
  await page.click(`${modal} [data-rc-list] [data-report="${id}"]`);
  await page.waitForSelector(`${modal} [data-rc-main] .hof-rc-summary`, { timeout: 15000 });
  await page.waitForTimeout(500);
}
const centerState = () =>
  lastModal(box => {
    const main = box.querySelector("[data-rc-main]");
    const heads = [...main.querySelectorAll("thead th")].map(th => th.textContent.trim());
    const foot = [...main.querySelectorAll("tfoot td")].map(td => td.textContent.trim());
    return {
      preset: main.querySelector(".hof-rep-chip.is-on")?.dataset.preset || "",
      cards: Object.fromEntries([...main.querySelectorAll(".hof-rc-summary span")].map(span => [span.querySelector("small").textContent.trim(), span.querySelector("b").textContent.trim()])),
      foot: Object.fromEntries(heads.map((head, index) => [head, foot[index] ?? ""])),
      footLabel: foot.find(cell => cell === "TOPLAM") || "",
      empty: main.querySelector("tbody .hof-empty")?.textContent.trim() || "",
      rows: main.querySelectorAll("tbody tr:not(:has(.hof-empty))").length,
    };
  });

try {
  console.log("\n■ Kurulum: yönetici girer, başlangıç tablosu; 10 müşterinin taksitleri Excel'den (Ödenen kolonuyla) arayüzden");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-start .hof-drop");
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(startXlsx);
  await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => page.keyboard.press("Escape"));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForSelector(`${top} [data-act="import"]`, { timeout: 15000 });
  await page.click(`${top} [data-act="import"]`);
  await page.waitForSelector(`${top} [data-src="excel"]`);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click(`${top} [data-src="excel"]`)]);
  await chooser.setFiles(plansXlsx);
  await page.waitForSelector(`${top} .hof-import-form`, { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.click(`${top} .hof-import-form button[type="submit"]`);
  await page.waitForFunction(() => /10 kart oluşturuldu/.test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), null, { timeout: 30000 });
  // İkinci ayın ilk taksiti de programda tahsil edilir (programdaki tahsilat + Excel'deki açılış birlikte toplanacak).
  const plans = (await call("/api/workspace/plans?status=all")).plans;
  for (const plan of plans) await call(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "500", date: iso(0) });
  const totals = (await call("/api/workspace/plans?status=all")).totals;
  ok(plans.length === 10 && totals.total === 100000 && totals.paid === 15000, `10 kart · toplam ${totals.total} · ödenen ${totals.paid} (Excel'de 10.000 + programda 5.000)`);

  console.log("\n■ Raporlar penceresi: ilk sekme (Cari Ekstre / Mizan) Bu Yıl ile açılır, altta TOPLAM");
  await closeAll();
  await page.click("#hof-sidecard [data-action=analytics]");
  await page.waitForSelector(`${modal} .hof-rep-mizan tbody tr`, { timeout: 15000 });
  await page.waitForTimeout(500);
  const mizan = await lastModal(box => ({ preset: box.querySelector(".hof-rep-chip.is-on")?.dataset.preset, foot: [...box.querySelectorAll(".hof-rep-mizan tfoot td")].map(td => td.textContent.trim()) }));
  ok(mizan.preset === "thisYear", `Mizan dönemi: ${mizan.preset} (Bu Yıl)`);
  ok(mizan.foot[1]?.startsWith("TOPLAM") && money(mizan.foot[4]) === 100000 && money(mizan.foot[5]) === 15000 && money(mizan.foot[6]) === 85000 && mizan.foot[7] === "Borçlu", `Mizan TOPLAM: ${mizan.foot.filter(Boolean).join(" · ")}`);
  await shot("mizan-toplam");

  console.log("\n■ Cari Listesi ve Bakiyeler: anlaşılan / ödenen / kalan kartları ve TOPLAM satırı");
  await openCenterReport("cari-listesi");
  let state = await centerState();
  ok(money(state.cards["Toplam Borç (Anlaşılan)"]) === 100000, `Toplam Borç (Anlaşılan) ${state.cards["Toplam Borç (Anlaşılan)"]}`);
  ok(money(state.cards["Toplam Alacak (Ödenen)"]) === 15000, `Toplam Alacak (Ödenen) ${state.cards["Toplam Alacak (Ödenen)"]}`);
  ok(money(state.cards["Kalan (Borçlu)"]) === 85000, `Kalan (Borçlu) ${state.cards["Kalan (Borçlu)"]}`);
  ok(state.footLabel === "TOPLAM" && money(state.foot["Borç"]) === 100000 && money(state.foot["Alacak"]) === 15000 && money(state.foot["Bakiye"]) === 85000 && state.foot["Durum"] === "Borçlu", `TOPLAM satırı: Borç ${state.foot["Borç"]} · Alacak ${state.foot["Alacak"]} · Bakiye ${state.foot["Bakiye"]} ${state.foot["Durum"]}`);
  await shot("cari-listesi-toplam");

  console.log("\n■ Cari Bazında Tahsilat (kullanıcının 'çalışmıyor' dediği rapor): Excel'de ödenmiş + programda alınan");
  await openCenterReport("cari-tahsilat");
  state = await centerState();
  ok(state.preset === "thisYear", `açılış dönemi ${state.preset} (Bu Yıl)`);
  ok(money(state.cards["Önceden Ödenen (Açılış)"]) === 10000 && money(state.cards["Taksit Tahsilatı"]) === 5000 && money(state.cards.Toplam) === 15000, `kartlar: Önceden Ödenen ${state.cards["Önceden Ödenen (Açılış)"]} · Taksit ${state.cards["Taksit Tahsilatı"]} · Toplam ${state.cards.Toplam}`);
  ok(state.rows === 10 && money(state.foot.Toplam) === 15000 && money(state.foot["Önceden Ödenen (Açılış)"]) === 10000, `10 satır; TOPLAM satırı ${state.foot.Toplam}`);
  await shot("cari-tahsilat");

  console.log("\n■ Boş dönem ipucu ve dönem hafızası (Satış Faturaları)");
  await openCenterReport("fatura-satis");
  state = await centerState();
  ok(state.preset === "thisYear", `Satış Faturaları ilk açılış: ${state.preset}`);
  await page.click(`${top} [data-rc-main] [data-preset="lastMonth"]`);
  await page.waitForTimeout(900);
  state = await centerState();
  ok(/Bu dönemde kayıt yok/.test(state.empty) && Boolean(await page.$(`${top} [data-rc-main] tbody .hof-empty [data-preset="all"]`)), `boş dönem: "${state.empty}"`);
  await shot("bos-donem-ipucu");
  await page.click(`${top} [data-rc-main] tbody .hof-empty [data-preset="all"]`);
  await page.waitForTimeout(900);
  state = await centerState();
  ok(state.preset === "all", "Tüm Zamanları Göster → Tüm Zamanlar seçildi");
  await openCenterReport("fatura-satis");
  state = await centerState();
  ok(state.preset === "all", `yeniden açınca son seçilen dönem hatırlandı: ${state.preset}`);

  console.log("\n■ TOPLAM satırı kaydırınca tablonun altında sabit (uzun liste)");
  await openCenterReport("taksit-kartlari");
  const sticky = await lastModal(box => {
    const pane = box.querySelector("[data-rc-main] .hof-rc-table");
    const foot = pane.querySelector("tfoot td");
    pane.scrollTop = 0;
    const paneBox = pane.getBoundingClientRect();
    const footBox = foot.getBoundingClientRect();
    return { visible: footBox.bottom <= paneBox.bottom + 1 && footBox.top >= paneBox.top, position: getComputedStyle(foot).position, text: [...pane.querySelectorAll("tfoot td")].map(td => td.textContent.trim()).join(" | ") };
  });
  ok(sticky.position === "sticky" && sticky.visible, `TOPLAM görünür ve sabit (${sticky.text})`);
  await shot("taksit-kartlari-toplam");

  console.log("\n■ Sol üstte şirket sayısı rozeti yok (2 şirket)");
  await closeAll();
  await call("/api/companies", { code: "002", name: "Şirket 2" });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-company .hof-session-current", { timeout: 20000 });
  const company = await page.$eval("#hof-company", node => ({ text: node.querySelector(".hof-session-current").innerText.replace(/\s+/g, " ").trim(), badge: Boolean(node.querySelector(".hof-session-count")) }));
  ok(!company.badge && !/\b2\b/.test(company.text.replace("001", "").replace("Şirket 1", "")), `şirket kutusu: "${company.text}" (sayı rozeti yok)`);
  await page.screenshot({ path: path.join(OUT, `${String((shotNo += 1)).padStart(2, "0")}-sirket-kutusu.png`), clip: { x: 0, y: 0, width: 330, height: 260 } });

  ok(!errors.length, `sayfada JavaScript hatası yok${errors.length ? `: ${errors.join(" ; ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata").catch(() => null);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\nSenaryo 2.0.20: ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
