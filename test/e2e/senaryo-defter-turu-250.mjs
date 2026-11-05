// 2.5.0 Ç4 — Defter Türü (Fatura Ayarları → Firma Bilgisi) arayüz senaryosu. Plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §5; beklenen görev metninden:
// varsayılan "Seçilmedi", dört seçenek yazım düzeninde, altında tek cümlelik açıklama; seçim + kaydet + SAYFA YENİLE → değer korunur (veri tabanından da okunur);
// muhasebe rolü görür ve değiştirir, avukat (Fatura görür, ayar yetkisi yok) Fatura Ayarları düğmesini görmez; değiştirilmiş ama kaydedilmemiş seçim Esc'te
// sorulur (soru beklenir, yanıt günlüğe yazılır — ders 34), kaydedilmiş form sorusuz kapanır.
// Gerçek tıklama + Tab + klavye (ok tuşları) + insan hızında yazım (ders 12). Pencere seçicisi konuma bağlı değil (ders 39). Lisans servisine ulaşmaz (ders 30).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-defter-turu-250-"));
const shots = process.env.EKRAN_DIR || root;
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const BASE = server.base;
const admin = await server.login();
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("muhasebe", admin.post("/api/admin/users", { username: "muhasebe1", name: "Muhasebe Bir", role: "muhasebe", password: "Muhasebe-2026!", mustChangePassword: false }));
await must("avukat", admin.post("/api/admin/users", { username: "avukat1", name: "Avukat Bir", role: "avukat", password: "Avukat-2026!", mustChangePassword: false }));

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`; // ders 39
const SELECT = `${TOP} [data-s="bookType"]`;
const errors = [];
const browser = await chromium.launch();

async function session(username, password) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => errors.push(`${username}: ${error.message}`));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  return { context, page };
}
async function openInvoices(page) {
  await page.waitForFunction(() => window.HOF?.invoices?.open);
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${TOP} .hof-modal`);
}
async function openSettings(page) {
  await openInvoices(page);
  await page.click(`${TOP} [data-act="settings"]`);
  await page.waitForSelector(SELECT);
}
// Soru penceresi: beklenen soru BEKLENİR (if-varsa ile atlanmaz) ve yanıtı nedeniyle günlüğe yazılır (ders 34).
const askedUnsaved = page => page.locator(`${TOP} .hof-modal-title`, { hasText: "Kaydedilmemiş Değişiklik" }).waitFor({ timeout: 3000 }).then(() => true, () => false);
async function answer(page, yes, reason) {
  console.log(`  · soru yanıtlandı: ${yes ? "Kaydetmeden Kapat" : "Forma Dön"} (${reason})`);
  await page.locator(`${TOP} [data-answer="${yes ? "yes" : "no"}"]`).click();
  await sleep(300);
}
const selected = page => page.locator(SELECT).evaluate(el => ({ value: el.value, label: el.options[el.selectedIndex]?.textContent || "" }));

// 1) Yönetici: varsayılan, seçenekler, açıklama.
console.log("1) Yönetici — varsayılan ve seçenekler");
const a = await session("admin", ADMIN_PASSWORD);
await openSettings(a.page);
ok((await selected(a.page)).value === "unset" && (await selected(a.page)).label === "Seçilmedi", `varsayılan Seçilmedi: ${JSON.stringify(await selected(a.page))}`);
const options = await a.page.locator(`${SELECT} option`).allTextContents();
ok(JSON.stringify(options) === JSON.stringify(["Seçilmedi", "Bilanço Esası", "İşletme Hesabı Esası", "Serbest Meslek Kazanç Defteri"]), `seçenekler: ${options.join(" | ")}`);
const field = a.page.locator(`${TOP} label.hof-field`, { has: a.page.locator('[data-s="bookType"]') });
ok((await field.locator("span").first().textContent()) === "Defter Türü", "alan adı Defter Türü");
const help = ((await field.locator("small").textContent()) || "").trim();
ok(/^[A-ZÇĞİÖŞÜ][^.]*\.$/.test(help) && help.split(/\.\s/).length === 1, `altında tek cümlelik açıklama: "${help}"`);
// Firma bilgisinin yanında (aynı kart).
ok((await a.page.locator(`${TOP} .hof-inv-settings`).first().locator('[data-s="bookType"]').count()) === 1 && (await a.page.locator(`${TOP} .hof-inv-settings`).first().locator("h4").textContent()) === "Firma Bilgisi", "Firma Bilgisi kartında");

// 2) Klavye ile seç (Tab ile odak + ok tuşu), Tabela Adı insan hızında, kaydedilmemiş Esc sorulur.
console.log("2) Seçim (klavye), kaydedilmemiş Esc, kaydet");
await a.page.locator(`${TOP} [data-s="reportHeader.signName"]`).click();
await a.page.keyboard.type("Defter Market", { delay: 40 });
await a.page.keyboard.press("Tab"); // → Rapor ve Ekstre Başlığı
await a.page.keyboard.press("Tab"); // → Defter Türü
ok(await a.page.locator(SELECT).evaluate(el => document.activeElement === el), "Tab sırası: Tabela Adı → Rapor ve Ekstre Başlığı → Defter Türü");
await a.page.keyboard.press("ArrowDown");
await sleep(150);
ok((await selected(a.page)).value === "balance", `ok tuşuyla Bilanço Esası: ${JSON.stringify(await selected(a.page))}`);
await a.page.keyboard.press("Escape");
const askedDirty = await askedUnsaved(a.page);
ok(askedDirty, "kaydedilmemiş seçim Esc'te soruldu (beklenen soru)");
if (askedDirty) await answer(a.page, false, "beklenen soru: kaydedilmemiş Defter Türü");
ok((await selected(a.page)).value === "balance", "Forma Dön sonrası seçim yerinde");
// Başka değere geç (odak + ok tuşu): İşletme Hesabı Esası, sonra kaydet düğmesine gerçek tıklama.
await a.page.locator(SELECT).focus();
await a.page.keyboard.press("ArrowDown");
await a.page.keyboard.press("Tab");
ok((await selected(a.page)).value === "operating", `İşletme Hesabı Esası seçildi: ${JSON.stringify(await selected(a.page))}`);
await a.page.click(`${TOP} [data-act="save-settings"]`);
await a.page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /Fatura ayarları kaydedildi/.test(node.textContent)), null, { timeout: 8000 }).then(() => ok(true, "kaydedildi bildirimi"), () => ok(false, "kaydedildi bildirimi"));
const api1 = await must("ayar", admin.get("/api/workspace/invoices/settings"));
ok(api1.bookType === "operating" && api1.reportHeader?.signName === "Defter Market", `sunucuda kayıtlı: ${api1.bookType} / ${api1.reportHeader?.signName}`);
await a.page.keyboard.press("Escape");
const askedClean = await askedUnsaved(a.page);
ok(!askedClean, "kaydedilmiş form Esc'te sorusuz kapanır");
if (askedClean) await answer(a.page, true, "YANLIŞ SORU: kaydedilmiş formda soru çıktı");
await a.page.screenshot({ path: path.join(shots, "defter-turu-250-kaydedildi.png") }).catch(() => {});

// 3) Sayfayı yenile → yeniden aç: değer korunur.
console.log("3) Sayfa yenile");
await a.page.reload();
await a.page.waitForLoadState("load");
await openSettings(a.page);
ok((await selected(a.page)).value === "operating" && (await selected(a.page)).label === "İşletme Hesabı Esası", `yenileyince korunur: ${JSON.stringify(await selected(a.page))}`);
await a.page.locator(`${TOP} .hof-inv-settings`).first().screenshot({ path: path.join(shots, "defter-turu-250-firma.png") }).catch(() => {});
await a.page.keyboard.press("Escape");
const askedReopen = await askedUnsaved(a.page);
ok(!askedReopen, "değişmemiş ayarlar Esc ile sorusuz kapanır");
if (askedReopen) await answer(a.page, true, "YANLIŞ SORU: değişmemiş formda soru çıktı");

// 4) Muhasebe görür ve değiştirir; avukat düğmeyi görmez.
console.log("4) Roller");
const m = await session("muhasebe1", "Muhasebe-2026!");
await openSettings(m.page);
ok((await selected(m.page)).value === "operating", "muhasebe kayıtlı değeri görür");
await m.page.locator(SELECT).focus();
await m.page.keyboard.press("ArrowDown");
ok((await selected(m.page)).value === "professional", "muhasebe ok tuşuyla Serbest Meslek Kazanç Defteri");
await m.page.click(`${TOP} [data-act="save-settings"]`);
await sleep(1500);
ok((await must("ayar", admin.get("/api/workspace/invoices/settings"))).bookType === "professional", "muhasebe Serbest Meslek Kazanç Defteri kaydetti");
const v = await session("avukat1", "Avukat-2026!");
await openInvoices(v.page);
ok((await v.page.locator(`${TOP} [data-act="settings"]`).count()) === 0, "avukat Fatura Ayarları düğmesini görmez");

await m.context.close();
await v.context.close();
await a.context.close();
await browser.close();
await server.close();
ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
console.log(`${passed} geçti, ${failed} kaldı`);
process.exitCode = failed ? 1 : 0;
