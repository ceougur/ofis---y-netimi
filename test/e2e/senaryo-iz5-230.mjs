// Senaryo İz 5.5 + 5.6 (2.3.0 iş listesi; müşteri talepleri 5 ve 6), arayüzden, gerçek tıklama ve klavyeyle:
//   HIZLI ARAMA (Ctrl+K): yönetici Ctrl+K'ya basar → menü üstündeki kutu odaklanır; "alış f" yazar → Alış Faturaları, Yeni Alış Faturası,
//   Alış Faturaları raporu listelenir; Enter → Fatura penceresi Alınan sekmesinde açılır. "cari h" → Tüm Cari Hareketleri raporu (Rapor
//   grubu); "çek" → her sonuç "çek" ile başlayan bir sözcük taşır, Çek / Senet sayfası ve raporları gelir. Esc kapatır. Personel
//   (rapor yetkisi yok) aynı sorguda Rapor grubu GÖRMEZ, Yeni Alış Faturası GÖRMEZ (fatura yetkisi yok).
//   İŞLEM GEÇMİŞİ: kayıt seçilir; 3 not + 1 telefon eklenir → yalnız 3 satır + "Daha Fazla Göster (1)"; tıklanınca 4 satır. Not düzeltilir
//   (✎ → metin değişir, "düzeltildi" yazar), not silinir (× → onay) → listeden düşer; Yönetim → Silinenler'de "Not" satırı → Geri Yükle →
//   kayıt kartında not yeniden görünür. Taksit hareketi/görev satırında "Kayda Git" (görev eklenir, düğme görünür, tıklanınca Görevler açılır).
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-iz5-230.mjs
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { escClose } from "./esc-kapat.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-iz5-230");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const STAFF_PASS = "Personel-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-iz5-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f27" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const watch = (page, name) => {
  page.on("pageerror", error => errors.push(`${name} pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${name} ${message.text()} @ ${message.location().url}`);
  });
};

let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async (page, name) => {
  shotNo += 1;
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const api = (page, url, body, method) =>
  page.evaluate(
    async ({ url, body, method }) => {
      const response = await fetch(url, { method: method || (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, data: json.ok ? json.data : json };
    },
    { url, body, method },
  );
const modal = ".hof-modal-backdrop.is-visible";
const closeModals = async page => {
  await page.waitForSelector(modal, { timeout: 4000 }).catch(() => {});
  for (let i = 0; i < 6 && (await page.$(modal)); i += 1) {
    const button = (await page.$(`${modal} [data-done]`)) || (await page.$(`${modal} [data-keep]`)) || (await page.$(`${modal} [data-general]`));
    if (button) await button.click();
    else await escClose(page);
    await page.waitForTimeout(400);
  }
};
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
  await page.waitForTimeout(800);
};
// Palet sonuçları: [{ group, label }] (ekrandaki liste, DOM'dan).
const results = page => page.$$eval("#hof-search-panel", panels => {
  const panel = panels[0];
  if (!panel || panel.hidden) return [];
  const out = [];
  let group = "";
  for (const node of panel.children) {
    if (node.classList.contains("hof-search-group")) group = node.textContent.trim();
    else for (const button of node.querySelectorAll(".hof-search-item")) out.push({ group, label: [...button.childNodes].filter(child => !(child.nodeType === 1 && child.classList.contains("hof-search-path"))).map(child => child.textContent).join("").replace(/\s+/g, " ").trim() });
  }
  return out;
});
const typeQuery = async (page, text) => {
  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.activeElement === document.querySelector("#hof-search input"), null, { timeout: 5000 });
  await page.fill("#hof-search input", "");
  await page.keyboard.type(text, { delay: 60 });
  await page.waitForFunction(() => !document.querySelector("#hof-search-panel")?.hidden, null, { timeout: 8000 });
  await page.waitForTimeout(400);
  return results(page);
};
const fold = value => String(value).replace(/[ıiİIşŞğĞüÜöÖçÇ]/g, c => ({ ı: "i", i: "i", İ: "i", I: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c" })[c]).toLowerCase();
const activityRows = page => page.$$eval("#hof-activity li", rows => rows.map(row => ({ type: row.dataset.type, text: row.textContent.replace(/\s+/g, " ").trim() })));

try {
  console.log("\n■ Kurulum: yönetici girer; 5 kayıtlık Rehber.xlsx; personel hesabı açılır");
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const admin = await context.newPage();
  watch(admin, "A");
  await login(admin, "admin", PASS);
  const rehber = [["Öğrenci No", "Adı", "Soyadı", "Telefonu"]];
  for (let i = 0; i < 5; i += 1) rehber.push([String(22821911000 + i), ["Mehmet", "İrem", "Cihat", "Rahman", "Ayla"][i], ["Türkoğlu", "Eroğlu", "Şenyurt", "Koyuncu", "Demir"][i], `0532${String(1000000 + i)}`]);
  const staged = await api(admin, "/api/workspace/dataset/stage", { kind: "excel", fileName: "Rehber.xlsx", sheets: [{ name: "REHBER", matrix: rehber }] });
  ok((await api(admin, "/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace" })).status === 200, "sayfa yüklendi");
  ok((await api(admin, "/api/admin/users", { username: "personel1", name: "Personel Bir", role: "personel", password: STAFF_PASS, mustChangePassword: false })).status === 200, "personel hesabı açıldı");
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
  await closeModals(admin);
  await admin.waitForTimeout(600);

  console.log("\n■ 5.5 Hızlı Arama: kutu menünün üstünde; Ctrl+K odaklar; “alış f” → Enter → Alınan (Alış Faturaları) sekmesi");
  const placed = await admin.evaluate(() => {
    const box = document.getElementById("hof-search");
    const card = document.getElementById("hof-sidecard");
    return box && card && box.nextElementSibling === card && box.closest(".sidebar") === card.closest(".sidebar");
  });
  ok(placed, "Ara kutusu Operasyon Merkezi kartının hemen üstünde, kenar çubuğunda");
  let list = await typeQuery(admin, "alış f");
  const labels = list.map(item => item.label);
  ok(labels.some(label => /^Alış Faturaları/.test(label)), `“alış f” → Alış Faturaları sekmesi (${labels.join(" | ")})`);
  ok(labels.includes("Yeni Alış Faturası"), "“alış f” → Yeni Alış Faturası işlemi");
  ok(list.some(item => item.group === "Rapor" && /^Alış Faturaları/.test(item.label)), "“alış f” → Alış Faturaları raporu (Rapor grubu)");
  ok(list.every(item => /\balis/.test(fold(item.label)) || /\bf/.test(fold(item.label)) || true) && list.every(item => fold(`${item.label}`).split(/\W+/).some(word => word.startsWith("alis"))), "her sonuç “alış” ile başlayan sözcük taşır (sözcük başı eşleşme)");
  ok(list[0]?.group === "Sayfa", `ilk sonuç Sayfa grubunda (${list[0]?.group}: ${list[0]?.label})`);
  await shot(admin, "arama-alis-f");
  await admin.keyboard.press("Enter");
  await admin.waitForSelector(`${modal} .hof-invoices`, { timeout: 10000 });
  await admin.waitForTimeout(800);
  const tab = await admin.$eval(`${modal} .hof-invoices`, node => node.querySelector('[data-tab].is-on, [role="tab"][aria-selected="true"], .hof-rep-chip.is-on')?.textContent.trim() || "");
  ok(/Alınan/.test(tab), `Enter → Fatura penceresi “Alınan” (Alış Faturaları) sekmesinde (${tab})`);
  ok((await admin.$eval("#hof-search input", node => node.value)) === "", "açıldıktan sonra kutu temizlendi");
  await shot(admin, "fatura-alinan-sekmesi");
  await escClose(admin);
  await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 5000 });

  console.log("\n■ 5.5: “cari h” → Tüm Cari Hareketleri raporu; “çek” → çekle ilgili her şey; ok tuşu + Enter; Esc kapatır");
  list = await typeQuery(admin, "cari h");
  ok(list.some(item => item.group === "Rapor" && item.label === "Tüm Cari Hareketleri"), `“cari h” → Tüm Cari Hareketleri (Rapor) (${list.map(i => i.label).join(" | ")})`);
  list = await typeQuery(admin, "çek");
  ok(list.length >= 4, `“çek” → ${list.length} sonuç`);
  ok(list.every(item => fold(item.label).split(/[^a-z0-9]+/).some(word => word.startsWith("cek"))), "her sonuçta “çek” ile başlayan sözcük var");
  ok(list.some(item => item.group === "Sayfa" && item.label === "Çek / Senet"), "Çek / Senet sayfası listede");
  ok(list.some(item => item.group === "Rapor"), "çek raporları listede");
  list = await typeQuery(admin, "CEK");
  ok(list.some(item => item.label === "Çek / Senet"), "Türkçe harf duyarsız: “CEK” de Çek / Senet'i bulur");
  // Ok tuşuyla ikinci sonuca inip Enter: ikinci satırın etkin (is-active) olması ve açılması.
  await admin.keyboard.press("ArrowDown");
  const activeLabel = await admin.$eval("#hof-search-panel .hof-search-item.is-active", node => [...node.childNodes].filter(child => !(child.nodeType === 1 && child.classList.contains("hof-search-path"))).map(child => child.textContent).join("").trim());
  ok(activeLabel === list[1]?.label, `ArrowDown → ikinci sonuç etkin (${activeLabel})`);
  await escClose(admin);
  ok(await admin.$eval("#hof-search-panel", node => node.hidden) && (await admin.$eval("#hof-search input", node => node.value)) === "", "Esc listeyi kapatır ve kutuyu temizler");
  list = await typeQuery(admin, "xqzv");
  ok(list.length === 0 && /sonuç yok/.test(await admin.$eval("#hof-search-panel", node => node.textContent)), "eşleşme yoksa “sonuç yok” yazar");
  await escClose(admin);
  // Cari/kayıt adı bu kutuya girmez: tablodaki kişi adı ("Mehmet") sonuç vermez.
  list = await typeQuery(admin, "mehmet");
  ok(list.length === 0, "tablodaki kişi adı (Mehmet) Hızlı Arama'ya girmez");
  await escClose(admin);

  console.log("\n■ 5.5 Personel: rapor yetkisi yok → Rapor grubu gelmez; fatura yetkisi yok → Yeni Alış Faturası gelmez");
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const staff = await staffContext.newPage();
  watch(staff, "P");
  await login(staff, "personel1", STAFF_PASS);
  await closeModals(staff);
  list = await typeQuery(staff, "cari h");
  ok(!list.some(item => item.group === "Rapor"), `personelde “cari h” Rapor grubu yok (${list.map(i => `${i.group}:${i.label}`).join(" | ") || "boş"})`);
  list = await typeQuery(staff, "alış f");
  ok(!list.some(item => item.label === "Yeni Alış Faturası") && !list.some(item => /^Alış Faturaları/.test(item.label)), `personelde fatura sonuçları yok (${list.map(i => i.label).join(" | ") || "boş"})`);
  list = await typeQuery(staff, "cari");
  ok(list.some(item => item.label === "Cari" || /^Cari Listesi/.test(item.label)), "personel Cari sayfasını bulur (yetkisi var)");
  await escClose(staff);
  await staffContext.close();

  console.log("\n■ 5.6 İşlem geçmişi: 3 not + 1 telefon → 3 satır + Daha Fazla Göster (1) → tamamı");
  await admin.locator(".dynamic-table tbody tr").first().locator("td").first().click({ position: { x: 12, y: 10 } });
  await admin.waitForSelector('.hof-case-actions [data-case-action="note"]', { timeout: 10000 });
  await admin.waitForTimeout(500);
  const addNote = async text => {
    await admin.click('.hof-case-actions [data-case-action="note"]');
    await admin.waitForSelector(`${modal} textarea[name="note"]`);
    await admin.fill(`${modal} textarea[name="note"]`, text);
    await admin.click(`${modal} button[type="submit"]`);
    await admin.waitForFunction(needle => document.querySelector("#hof-activity")?.textContent.includes(needle), text, { timeout: 10000 });
  };
  await addNote("Birinci görüşme yapıldı");
  await addNote("İkinci görüşme yapıldı");
  await admin.click('.hof-case-actions [data-case-action="phone"]');
  await admin.waitForSelector(`${modal} input[name="phone"]`);
  await admin.fill(`${modal} input[name="phone"]`, "0533 444 55 66");
  await admin.fill(`${modal} input[name="label"]`, "İş");
  await admin.click(`${modal} button[type="submit"]`);
  await admin.waitForFunction(() => document.querySelector("#hof-activity")?.textContent.includes("05334445566"), null, { timeout: 10000 });
  await addNote("Üçüncü görüşme yapıldı");
  await admin.waitForTimeout(500);
  let rows = await activityRows(admin);
  const moreText = await admin.$eval("#hof-activity", node => node.querySelector("[data-more]")?.textContent.trim() || "");
  ok(rows.length === 3, `4 işlemden yalnız 3 satır görünür (${rows.length})`);
  ok(moreText === "Daha Fazla Göster (1)", `düğme: “${moreText}”`);
  ok(rows.at(-1).text.includes("Üçüncü görüşme") && !rows.some(row => row.text.includes("Birinci görüşme")), "görünen üçü en yeniler; en eski gizli");
  await shot(admin, "gecmis-uc-satir");
  await admin.click("#hof-activity [data-more]");
  await admin.waitForFunction(() => document.querySelectorAll("#hof-activity li").length === 4, null, { timeout: 10000 });
  rows = await activityRows(admin);
  ok(rows.length === 4 && !(await admin.$("#hof-activity [data-more]")), "Daha Fazla Göster → 4 satır, düğme kalktı");
  ok(rows.every(row => row.type !== "note" || true) && (await admin.$$eval('#hof-activity li[data-type="note"] [data-edit]', nodes => nodes.length)) === 3, "her not satırında Düzelt (✎)");
  ok((await admin.$$eval('#hof-activity li[data-type="phone"] [data-delete]', nodes => nodes.length)) === 1, "telefon satırında Sil (×)");

  console.log("\n■ 5.6: notu düzelt (✎) → metin değişir, “düzeltildi” yazar; sil (×) → onay → listeden düşer");
  await admin.click('#hof-activity li[data-type="note"]:nth-of-type(1) [data-edit]');
  await admin.waitForSelector(`${modal} textarea[name="note"]`);
  ok((await admin.$eval(`${modal} textarea[name="note"]`, node => node.value)) === "Birinci görüşme yapıldı", "düzeltme penceresi mevcut metinle açılır");
  ok((await admin.$eval(`${modal} .hof-modal-title, ${modal} h2`, node => node.textContent.trim())) === "Not Düzelt", "pencere başlığı Not Düzelt");
  await admin.fill(`${modal} textarea[name="note"]`, "Birinci görüşme yapıldı; evrak istendi");
  await admin.click(`${modal} button[type="submit"]`);
  await admin.waitForFunction(() => document.querySelector("#hof-activity")?.textContent.includes("evrak istendi"), null, { timeout: 10000 });
  await admin.waitForTimeout(300);
  rows = await activityRows(admin);
  const edited = rows.find(row => row.text.includes("evrak istendi"));
  ok(edited && /düzeltildi/.test(edited.text) && rows.length === 4, `düzeltilen not: “${edited?.text.slice(0, 90)}”`);
  const activity = await api(admin, `/api/workspace/cases/${encodeURIComponent((await admin.$eval("#hof-activity", node => node.dataset.hofKey)))}/activity`);
  const noteRow = activity.data.items.find(item => item.type === "note" && item.text === "Birinci görüşme yapıldı; evrak istendi");
  ok(Boolean(noteRow && noteRow.updatedAt), "sunucuda not metni ve düzeltme izi (veri tabanından okundu)");
  ok((await admin.$eval("#hof-activity", node => node.querySelector("[data-more]")) ) === null && rows.length === 4, "düzeltmeden sonra açık liste korunur (Daha Fazla tercihi kart açıkken kalır)");
  await shot(admin, "not-duzeltildi");
  await admin.click('#hof-activity li[data-type="note"]:nth-of-type(1) [data-delete]');
  await admin.waitForSelector(`${modal} [data-answer="yes"]`);
  const confirmText = await admin.$eval(modal, node => node.textContent.replace(/\s+/g, " "));
  ok(/Not Sil/.test(confirmText) && /Silinenler/.test(confirmText), "silme onayı: Not Sil + Silinenler'den geri yüklenebilir");
  await admin.click(`${modal} [data-answer="yes"]`);
  await admin.waitForFunction(() => !document.querySelector("#hof-activity")?.textContent.includes("evrak istendi"), null, { timeout: 10000 });
  rows = await activityRows(admin);
  ok(rows.length === 3 && !rows.some(row => row.text.includes("evrak istendi")), `silinen not listeden düştü (${rows.length} satır)`);
  const afterDelete = await api(admin, `/api/workspace/cases/${encodeURIComponent(await admin.$eval("#hof-activity", node => node.dataset.hofKey))}/activity`);
  ok(afterDelete.data.items.filter(item => item.type === "note").length === 2, "sunucuda 2 not kaldı");

  console.log("\n■ 5.6: Yönetim → Silinenler → Not satırı → Geri Yükle → kartta yeniden görünür");
  await admin.goto(`${BASE}/admin.html#trash`, { waitUntil: "load" });
  await admin.waitForSelector("#adm-trash tr[data-id]", { timeout: 15000 });
  const trashRow = await admin.$eval("#adm-trash", body => {
    const row = [...body.querySelectorAll("tr[data-id]")].find(tr => tr.querySelector(".adm-kind")?.textContent.trim() === "Not");
    return row ? { id: row.dataset.id, text: row.textContent.replace(/\s+/g, " ").trim(), restorable: Boolean(row.querySelector("[data-restore]")) } : null;
  });
  ok(trashRow && trashRow.restorable && /evrak istendi/.test(trashRow.text), `Silinenler'de Not satırı: ${trashRow?.text.slice(0, 100)}`);
  await admin.selectOption("#adm-trash-kind", "history");
  await admin.waitForTimeout(300);
  ok((await admin.$$eval("#adm-trash tr[data-id]", rows => rows.length)) === 1, "İşlem Geçmişi süzgeci yalnız not satırını gösterir");
  await shot(admin, "silinenler-not");
  await admin.click("#adm-trash tr[data-id] [data-restore]");
  await admin.waitForFunction(() => !document.querySelector("#adm-trash tr[data-id] [data-restore]"), null, { timeout: 10000 });
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
  await closeModals(admin);
  await admin.locator(".dynamic-table tbody tr").first().locator("td").first().click({ position: { x: 12, y: 10 } });
  await admin.waitForFunction(() => document.querySelectorAll("#hof-activity li").length >= 3, null, { timeout: 10000 });
  await admin.waitForTimeout(400);
  rows = await activityRows(admin);
  const more2 = await admin.$eval("#hof-activity", node => node.querySelector("[data-more]")?.textContent.trim() || "");
  ok(rows.length === 3 && more2 === "Daha Fazla Göster (1)", `kart yeniden açılınca tercih sıfır: 3 satır + “${more2}”`);
  await admin.click("#hof-activity [data-more]");
  await admin.waitForFunction(() => document.querySelectorAll("#hof-activity li").length === 4, null, { timeout: 10000 });
  rows = await activityRows(admin);
  ok(rows.some(row => row.text.includes("evrak istendi")), "geri yüklenen not kartta yeniden görünür");

  console.log("\n■ 5.6: görev satırında Kayda Git → Görevler penceresi");
  await admin.click('.hof-case-actions [data-case-action="task"]');
  await admin.waitForSelector(`${modal} input[name="title"]`);
  await admin.fill(`${modal} input[name="title"]`, "Evrakları kontrol et");
  await admin.click(`${modal} button[type="submit"]`);
  await admin.waitForFunction(() => document.querySelector("#hof-activity")?.textContent.includes("Evrakları kontrol et"), null, { timeout: 10000 });
  const goto = await admin.$('#hof-activity li[data-type="task"] [data-goto]');
  ok(Boolean(goto) && !(await admin.$('#hof-activity li[data-type="task"] [data-edit]')), "görev satırında Kayda Git var, Düzelt/Sil yok");
  await goto.click();
  await admin.waitForSelector(modal, { timeout: 10000 });
  const taskTitle = await admin.$eval(`${modal} .hof-modal-title, ${modal} h2`, node => node.textContent.trim());
  ok(taskTitle === "Görevler", `Kayda Git → “${taskTitle}” penceresi`);
  await escClose(admin);
  await context.close();
} catch (error) {
  failed += 1;
  console.error("HATA:", error);
} finally {
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log(`\nSONUÇ: ${passed} geçti, ${failed} kaldı`);
  process.exit(failed ? 1 : 0);
}
