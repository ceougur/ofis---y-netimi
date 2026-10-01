// Gerçek kullanıcı senaryosu (v2.0.14): odak. Müşteri şikâyeti: arama kutusuna yazarken liste her gelişte kutu yeniden
// kuruluyor, odak düşüyor ("fı" yazınca kutuya yeniden tıklamak gerekiyor) — Cari, Taksitler ve Stok'ta görüldü.
// Burada programdaki HER arama/süzgeç kutusuna harf harf (her harften sonra liste yenilenecek kadar bekleyerek) yazılır;
// odak, imleç ve yazılan sözcük korunmalı. Yazarken arka planda başka kullanıcı veri değiştirir (canlı yenileme) — yine
// korunmalı. Ayrıca: detay panelindeki "Cari Kartı" düğmesi (müşteri: tepki vermiyor), pencere açılış/kapanış odağı,
// Tab kapanı, bildirimlerin odağı çalmaması. Çalıştırma: npm run test:senaryo-214 (artifacts/senaryo-214/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-214");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-214-"));
const excel = path.join(root, "ogrenciler.xlsx");
const COLS = ["Öğrenci", "Veli Telefon", "Kayıt Tarihi", "Aylık Ücret", "Servis Plaka"];
const ROWS = [["Mert Çelik", "0537 410 60 60", "14.01.2026", "4.500,00 ₺", "34 SRV 303"], ["Ada Yılmaz", "0532 410 10 10", "02.02.2026", "3.500,00 ₺", "34 SRV 101"], ["Efe Kaya", "0532 410 20 20", "20.03.2026", "3.000,00 ₺", "34 SRV 202"]];
writeFileSync(excel, buildXlsx([{ name: "Öğrenciler", columns: COLS, rows: ROWS.map(row => Object.fromEntries(COLS.map((col, i) => [col, row[i]]))) }], { title: "Öğrenciler" }));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f93" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-bar{display:none !important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  return page;
};
const results = [];
let shotNo = 0;
const shot = async (page, name) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const call = (page, url, body, method = body ? "POST" : "GET") =>
  page.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ...json };
    },
    [url, body, method],
  );
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));
const closeTop = async page => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
};
const admin = await newPage();
let exitCode = 0;
const closeAll = async () => { for (let i = 0; i < 6 && (await admin.$(modal)); i += 1) await closeTop(admin); };
const openModule = async action => {
  await closeAll();
  await admin.click(`#hof-sidecard [data-action="${action}"]`);
  await admin.waitForSelector(`${top} input[data-filter="q"]`);
  await admin.waitForTimeout(500);
};
// Odak denetimi: kutuya tıklanır, sözcük harf harf yazılır; her harften sonra liste yenilenecek kadar beklenir
// (süzgeçler 250 ms gecikmeyle yüklenir) ve odak ile değer denetlenir. Arada "between" çağrılırsa (ör. başka kullanıcı
// veri değiştirir) o da harfler arasında çalışır.
const focusState = (page, selector) =>
  page.evaluate(sel => {
    const input = document.querySelector(sel);
    const active = document.activeElement;
    return { exists: Boolean(input), focused: Boolean(input) && active === input, value: input?.value ?? null, caret: input?.selectionStart ?? null };
  }, selector);
const typeSlowly = async (page, selector, word, { delay = 450, between = null, label = selector } = {}) => {
  await page.waitForSelector(selector);
  await page.click(selector);
  await page.waitForTimeout(150);
  const problems = [];
  for (let i = 0; i < word.length; i += 1) {
    await page.keyboard.type(word[i]);
    if (between && i === Math.floor(word.length / 2) - 1) await between();
    await page.waitForTimeout(delay);
    const state = await focusState(page, selector);
    const want = word.slice(0, i + 1);
    if (!state.focused || state.value !== want || (state.caret !== null && state.caret !== want.length)) problems.push(`${i + 1}. harfte odak=${state.focused} değer="${state.value}" imleç=${state.caret}`);
  }
  ok(!problems.length, `${label}: "${word}" kesintisiz yazıldı (odak, değer ve imleç her harfte yerinde)${problems.length ? ` — ${problems.join("; ")}` : ""}`);
};
const rowsOf = (page, selector) => page.$$eval(selector, nodes => nodes.length);
const activeDesc = page => page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ""}${a.className ? `.${String(a.className).split(" ").join(".")}` : ""}${a.dataset?.filter ? `[data-filter=${a.dataset.filter}]` : ""}` : "yok"; });
// "Başka kullanıcı" veri değiştirir: ikinci sayfa (aynı yönetici hesabı) API ile cari açar → canlı yenileme (SSE) yayılır.
const other = await newPage();
let changeNo = 0;
const otherChange = async () => {
  changeNo += 1;
  const created = await call(other, "/api/workspace/accounts", { name: `Canlı Değişiklik ${changeNo}`, type: "customer", phone: `0530 000 00 ${pad(changeNo)}` });
  if (created.status !== 200) throw new Error(`canlı değişiklik açılamadı: ${created.error}`);
  await admin.waitForTimeout(700); // SSE + 250 ms süzgeç gecikmesi + yeniden kurulum
};
const ids = {};
try {
  await step("Kurulum: yönetici girer, Excel yüklenir; cariler, taksit kartları, ürünler ve evrak açılır", async () => {
    await login(admin, "admin", PASS);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => admin.keyboard.press("Escape"));
    await admin.waitForTimeout(1200);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    await login(other, "admin", PASS);
    await admin.waitForTimeout(500);
    for (const [name, phone] of [["Fırat Otomotiv İnşaat", "0507 623 80 43"], ["Fırat Otomotiv Gıda", "0553 286 68 77"], ["Fırat Otomotiv Ticaret", "0507 873 28 35"], ["Cumhur Bozkaya", "0538 925 35 14"]]) {
      const created = await call(admin, "/api/workspace/accounts", { name, type: "customer", phone });
      ok(created.status === 200, `cari: ${name}`);
      ids[name] = created.data.id;
    }
    for (const name of ["Fırat Otomotiv İnşaat", "Fırat Otomotiv Gıda", "Cumhur Bozkaya"]) {
      const plan = await call(admin, "/api/workspace/plans", { accountId: ids[name], name, total: "1.200", mode: "auto", count: 2, firstDue: shift(40) });
      ok(plan.status === 200, `taksit kartı: ${name}`);
    }
    for (const name of ["Fırça", "Fırın Eldiveni", "Zımba Teli"]) {
      const item = await call(admin, "/api/workspace/stock", { name, unit: "Adet", minQty: "", unitPrice: "", openingQty: "", openingCash: false, openingDate: "" });
      ok(item.status === 200, `ürün: ${name}`);
    }
    for (const [drawer, amount] of [["Fırat Otomotiv İnşaat", "1.000"], ["Cumhur Bozkaya", "500"]]) {
      const cheque = await call(admin, "/api/workspace/cheques", { direction: "in", instrument: "cheque", drawer, amount, issueDate: shift(0), dueDate: shift(30), bank: "Ziraat", serialNo: `CK-${amount}` });
      ok(cheque.status === 200, `çek: ${drawer}`);
    }
    // Tablodaki "Ada Yılmaz" kaydına bağlı cari (detay panelinde CARİ pili için).
    await admin.locator(".dynamic-table tbody tr", { hasText: "Ada Yılmaz" }).first().click();
    await admin.waitForFunction(() => window.HOF.selectedCase()?.key);
    const key = await admin.evaluate(() => window.HOF.selectedCase().key);
    const linked = await call(admin, "/api/workspace/accounts", { name: "Ada Yılmaz", type: "customer", phone: "0532 410 10 10", caseKey: key, caseTitle: "Ada Yılmaz" });
    ok(linked.status === 200, "kayda bağlı cari: Ada Yılmaz");
    ids["Ada Yılmaz"] = linked.data.id;
  });

  await step("1. Cari arama kutusu: harf harf yazarken odak düşmez; yazarken başka kullanıcı cari açsa da düşmez", async () => {
    await openModule("accounts");
    await typeSlowly(admin, `${top} input[data-filter="q"]`, "fırat", { label: "Cari → Ara" });
    ok((await rowsOf(admin, `${top} tr[data-account]`)) === 3, "liste süzüldü: 3 Fırat");
    await shot(admin, "cari-arama");
    await admin.fill(`${top} input[data-filter="q"]`, "");
    await admin.waitForTimeout(500);
    await typeSlowly(admin, `${top} input[data-filter="q"]`, "fırat", { between: otherChange, label: "Cari → Ara (canlı yenileme sırasında)" });
    ok((await rowsOf(admin, `${top} tr[data-account]`)) === 3, "canlı yenilemeden sonra da 3 Fırat");
    // Yazdıktan sonra gelen canlı yenileme kutuyu silmez, odağı almaz.
    await otherChange();
    const after = await focusState(admin, `${top} input[data-filter="q"]`);
    ok(after.focused && after.value === "fırat", `yazdıktan sonra gelen canlı yenileme: odak ve "fırat" yerinde (odak=${after.focused}, değer="${after.value}")`);
  });

  await step("2. Taksitler ve Stok arama kutuları", async () => {
    await openModule("plans");
    await typeSlowly(admin, `${top} input[data-filter="q"]`, "fırat", { between: otherChange, label: "Taksitler → Ara" });
    ok((await rowsOf(admin, `${top} tr[data-plan]`)) === 2, "2 Fırat kartı listelendi");
    await shot(admin, "taksit-arama");
    await openModule("stock");
    await typeSlowly(admin, `${top} input[data-filter="q"]`, "fır", { between: otherChange, label: "Stok → Ara" });
    ok((await rowsOf(admin, `${top} tr[data-item]`)) === 2, "2 ürün (Fırça, Fırın Eldiveni)");
    await shot(admin, "stok-arama");
  });

  await step("3. Çek / Senet: yazıp Enter ile süzünce odak kutuda kalır", async () => {
    await closeAll();
    await admin.evaluate(() => window.HOF.cheques.open());
    await admin.waitForSelector(`${top} input[data-filter="q"]`);
    await admin.waitForTimeout(500);
    await typeSlowly(admin, `${top} input[data-filter="q"]`, "cumhur", { label: "Çek / Senet → Ara" });
    await admin.keyboard.press("Enter");
    await admin.waitForTimeout(800);
    const state = await focusState(admin, `${top} input[data-filter="q"]`);
    ok(state.focused && state.value === "cumhur", `Enter'dan sonra odak kutuda, değer "cumhur" (odak=${state.focused})`);
    ok((await rowsOf(admin, `${top} tr[data-cheque]`)) === 1, "1 evrak süzüldü");
    await otherChange();
    const live = await focusState(admin, `${top} input[data-filter="q"]`);
    ok(live.focused && live.value === "cumhur", "canlı yenileme Çek / Senet aramasını bozmadı");
  });

  await step("4. Raporlar: Cari Ekstre araması (Enter) ve Tüm Raporlar araması", async () => {
    await closeAll();
    await admin.evaluate(() => window.HOF.overview.openReports("mizan"));
    await admin.waitForSelector(`${top} [data-q]`);
    await admin.waitForTimeout(600);
    await typeSlowly(admin, `${top} [data-q]`, "fırat", { label: "Raporlar → Cari Ekstre → Cari Ara" });
    await admin.keyboard.press("Enter");
    await admin.waitForTimeout(900);
    const state = await focusState(admin, `${top} [data-q]`);
    ok(state.focused && state.value === "fırat", `Enter ile rapor yenilendi; odak arama kutusunda (odak=${state.focused}, değer="${state.value}")`);
    const mizanRows = await admin.$$eval(`${top} [data-account-row]`, nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    ok(mizanRows.length === 2 && mizanRows.every(text => /Fırat/.test(text)), `mizan süzüldü: ${mizanRows.length} Fırat satırı (hareketsiz üçüncü cari gizli)`);
    await shot(admin, "rapor-arama");
    await admin.click(`${top} [role="tab"][data-tab="all"]`);
    await admin.waitForSelector(`${top} [data-rc-search]`);
    await admin.waitForTimeout(400);
    await typeSlowly(admin, `${top} [data-rc-search]`, "kasa", { delay: 250, label: "Raporlar → Tüm Raporlar → Rapor Ara" });
    ok((await rowsOf(admin, `${top} .hof-rc-item`)) > 0, "rapor listesi süzüldü");
  });

  await step("5. Sohbet kişi arama ve toplu taksitlendirme cari seçici", async () => {
    await closeAll();
    await admin.evaluate(() => window.HOF.chat.open());
    await admin.waitForSelector(".hof-chat-search input");
    await admin.waitForTimeout(400);
    await typeSlowly(admin, ".hof-chat-search input", "ofis", { delay: 250, label: "Sohbet → Kişi Ara" });
    await admin.evaluate(() => window.HOF.chat.close());
    await openModule("plans");
    await admin.click(`${top} [data-act="bulk"]`);
    await admin.waitForSelector(`${top} input[data-pick="q"]`);
    await admin.waitForTimeout(500);
    await typeSlowly(admin, `${top} input[data-pick="q"]`, "fırat", { label: "Taksitler → Cari Seç → Ara" });
    ok((await rowsOf(admin, `${top} [data-pick-list] tr`)) >= 1, "seçici listesi süzüldü");
    await shot(admin, "cari-secici");
  });

  await step("6. Ana tablo arama kutusu", async () => {
    await closeAll();
    await typeSlowly(admin, ".search-field input", "ada", { delay: 300, label: "Ana tablo → Ara" });
    await admin.waitForTimeout(400);
    ok((await rowsOf(admin, ".dynamic-table tbody tr")) === 1, "tablo 1 kayda süzüldü (Ada Yılmaz)");
    await admin.fill(".search-field input", "");
    await admin.waitForTimeout(400);
  });

  await step("7. Detay panelindeki CARİ pili → Cari Kartı: açılır; kapanınca odak düğmeye döner; canlı yenilemeden sonra yine açılır", async () => {
    await admin.locator(".dynamic-table tbody tr", { hasText: "Mert Çelik" }).first().click();
    await admin.waitForTimeout(500);
    await admin.locator(".dynamic-table tbody tr", { hasText: "Ada Yılmaz" }).first().click();
    await admin.waitForSelector("#hof-case-plan:not([hidden]) [data-open-account]", { timeout: 10000 });
    await shot(admin, "detay-cari-pili");
    await admin.click("#hof-case-plan [data-open-account]");
    await admin.waitForSelector(`${top}.hof-modal-backdrop .hof-accounts-modal, ${top} .hof-accounts-modal`, { timeout: 8000 }).catch(() => null);
    await admin.waitForFunction(() => document.querySelector(".hof-modal-backdrop.is-visible .hof-accounts [data-acc-card], .hof-modal-backdrop.is-visible .hof-accounts .hof-plan-head"), null, { timeout: 8000 });
    const title = await admin.$eval(`${top} .hof-plan-head`, node => node.innerText.replace(/\s+/g, " "));
    ok(/Ada Yılmaz/.test(title), `Cari Kartı açıldı: ${title.slice(0, 60)}`);
    const inside = await admin.evaluate(() => Boolean(document.activeElement?.closest(".hof-modal-backdrop.is-visible")));
    ok(inside, "pencere açılınca odak pencerenin içinde");
    await shot(admin, "cari-karti-acildi");
    await closeTop(admin);
    const back = await admin.evaluate(() => document.activeElement?.matches("#hof-case-plan [data-open-account]"));
    ok(back, `kapanınca odak Cari Kartı düğmesine döndü (odak: ${await activeDesc(admin)})`);
    await otherChange();
    await admin.waitForSelector("#hof-case-plan:not([hidden]) [data-open-account]", { timeout: 10000 });
    await admin.click("#hof-case-plan [data-open-account]");
    await admin.waitForFunction(() => document.querySelector(".hof-modal-backdrop.is-visible .hof-accounts .hof-plan-head"), null, { timeout: 8000 });
    ok(/Ada Yılmaz/.test(await admin.$eval(`${top} .hof-plan-head`, node => node.innerText)), "canlı yenilemeden sonra Cari Kartı yine açıldı");
    await closeTop(admin);
    // Taksit Kartını Aç (aynı kalıp): Mert'e kart açıp panelden açılır.
    const plan = await call(admin, "/api/workspace/plans", { accountId: ids["Ada Yılmaz"], name: "Ada Yılmaz", total: "600", mode: "auto", count: 2, firstDue: shift(40) });
    ok(plan.status === 200, "Ada'ya taksit kartı açıldı");
    await admin.locator(".dynamic-table tbody tr", { hasText: "Mert Çelik" }).first().click();
    await admin.waitForTimeout(500);
    await admin.locator(".dynamic-table tbody tr", { hasText: "Ada Yılmaz" }).first().click();
    await admin.waitForSelector("#hof-case-plan:not([hidden]) [data-open-plan]", { timeout: 10000 });
    await admin.click("#hof-case-plan [data-open-plan]");
    await admin.waitForFunction(() => document.querySelector(".hof-modal-backdrop.is-visible .hof-plans .hof-plan-head"), null, { timeout: 8000 });
    ok(/Ada Yılmaz/.test(await admin.$eval(`${top} .hof-plan-head`, node => node.innerText)), "Taksit Kartını Aç da çalışıyor");
    await closeTop(admin);
  });

  await step("8. Pencere odağı: ilk alana odak, Tab kapanı, bildirim odağı çalmaz, kapanınca odak açan düğmeye döner", async () => {
    await closeAll();
    await admin.focus('#hof-sidecard [data-action="accounts"]');
    await admin.keyboard.press("Enter");
    await admin.waitForSelector(`${top} input[data-filter="q"]`);
    await admin.waitForTimeout(500);
    ok(await admin.evaluate(() => document.activeElement?.matches('.hof-modal-backdrop.is-visible input[data-filter="q"]')), "Cari penceresi açılınca odak arama kutusunda");
    await admin.evaluate(() => window.HOF.toast("Bilgi: odak denemesi"));
    await admin.waitForTimeout(300);
    ok(await admin.evaluate(() => document.activeElement?.matches('.hof-modal-backdrop.is-visible input[data-filter="q"]')), "bildirim (toast) odağı çalmadı");
    await admin.keyboard.press("Shift+Tab");
    ok(await admin.evaluate(() => Boolean(document.activeElement?.closest(".hof-modal-backdrop.is-visible"))), "Shift+Tab pencere içinde kalır (Tab kapanı)");
    await closeTop(admin);
    ok(await admin.evaluate(() => document.activeElement?.matches('#hof-sidecard [data-action="accounts"]')), `kapanınca odak sol menüdeki Cari düğmesine döndü (odak: ${await activeDesc(admin)})`);
    // Kart formu: yazarken canlı yenileme formu bozmaz.
    await openModule("accounts");
    await admin.click(`${top} [data-act="new"]`);
    await admin.waitForSelector(`${top} input[name="name"]`);
    await typeSlowly(admin, `${top} input[name="name"]`, "deneme", { delay: 200, between: otherChange, label: "Yeni Cari formu → Ad Soyad (canlı yenileme sırasında)" });
    await closeTop(admin);
  });
  await step("9. Sohbet yazma kutusu: yazarken başka kullanıcıdan mesaj gelse de odak ve metin korunur", async () => {
    await closeAll();
    const summary = await call(other, "/api/chat");
    const office = (summary.conversations || summary.data?.conversations || []).find(item => item.kind === "office");
    ok(office, "Ofis Geneli sohbeti var");
    await admin.evaluate(id => window.HOF.chat.open(id), office.id);
    await admin.waitForSelector("[data-composer]");
    await admin.waitForTimeout(400);
    await typeSlowly(admin, "[data-composer]", "merhaba", {
      delay: 250,
      label: "Sohbet → mesaj yazma (gelen mesaj sırasında)",
      between: async () => {
        const sent = await call(other, `/api/chat/conversations/${office.id}/messages`, { body: "Arada gelen mesaj", caseKey: "" });
        if (sent.status !== 200) throw new Error(`mesaj gönderilemedi: ${sent.error}`);
        await admin.waitForTimeout(700);
      },
    });
    ok(await admin.evaluate(() => (document.querySelector("[data-messages]")?.innerText || "").includes("Arada gelen mesaj")), "gelen mesaj iş parçacığına düştü (yazma kutusu bozulmadan)");
    await shot(admin, "sohbet-yazarken-mesaj");
    await admin.evaluate(() => window.HOF.chat.close());
  });
} catch (error) {
  console.error("\nHATA:", error.message);
  exitCode = 1;
  await shot(admin, "hata").catch(() => {});
}
if (errors.length) {
  console.log("\nSayfa hataları:", errors);
  exitCode = 1;
}
const passed = results.filter(item => item.ok).length;
console.log(`\n${passed} / ${results.length} kontrol geçti.`);
fs.writeFileSync(path.join(OUT, "sonuc.json"), JSON.stringify({ passed, total: results.length, results, errors }, null, 2));
await browser.close();
await app.close?.();
rmSync(root, { recursive: true, force: true });
process.exit(exitCode);
