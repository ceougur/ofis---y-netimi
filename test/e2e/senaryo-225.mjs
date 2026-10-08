// Senaryo 2.0.25 — müşteri istekleri (06.10.2026) ve şirket sınırı, arayüzden:
//  C. Birinci sayfadayken ikinci sayfadaki kaydın tarih uyarısında "Kayda Git" → ikinci sayfa açılır VE o kayıt seçilir,
//     görünür yere kaydırılır, detay kartında açılır (sağ alttaki bildirim ve zil listesi). Başka sayfanın uyarısında
//     "Gerçekleştirildi" yok (işaret açık sayfaya yazılırdı).
//  D. Sekme silinince sayfa şeridindeki kayıt sayısı düşer; sayfa şeridinden "Sayfayı Sil" (ilk sayfada yok); silinen
//     sayfanın uyarıları kalkar.
//  E. Şirket Verisini Sıfırla / Şirketi Sil onayında kutu şirket koduyla dolu, parola boş ve odakta; tarayıcının kayıtlı
//     kullanıcı adı için ayrı görünmeyen alan.
//  A. 2 şirket varken "+ Yeni Şirket" hiç görünmez (sol üst seçici ve Yönetim → Şirketler); biri silinince geri gelir.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-225.mjs
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-225");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-225-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f25" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
// Ekrandaki bildirimler (yeniden yüklemeden sonraki "hof-flash" dahil) her pencerede window.__toasts'a yazılır.
await context.addInitScript(() => {
  window.__toasts = [];
  new MutationObserver(list => {
    for (const entry of list) for (const node of entry.addedNodes) if (node.nodeType === 1 && node.classList?.contains("hof-toast")) window.__toasts.push(node.textContent);
  }).observe(document, { childList: true, subtree: true });
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
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const api = (url, body, method) =>
  page.evaluate(
    async ({ url, body, method }) => {
      const response = await fetch(url, { method: method || (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, data: json.ok ? json.data : json };
    },
    { url, body, method },
  );
const modal = ".hof-modal-backdrop.is-visible";
const dmy = days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
};
const ready = async () => {
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
  await page.waitForTimeout(800);
};
const currentPill = () => page.$eval("#hof-pages .hof-page.is-current .hof-page-pick", node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const selectedRowText = () => page.$eval(".dynamic-table tbody tr.selected", node => node.textContent).catch(() => "");

const TARGET = "Envar Turizm Taşımacılık";
const TARGET_NO = "202092758";

try {
  console.log("\n■ Kurulum: iki sayfa (TÜM REHBER 30 kayıt; Müşteriler Yeni: Müşteriler 60 + Arşiv 5), hedef kayıt listenin derininde");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForTimeout(1500);
  const rehber = [["Öğrenci No", "Adı", "Soyadı", "Telefonu"]];
  for (let i = 0; i < 30; i += 1) rehber.push([String(22821911000 + i), ["Mehmet", "İrem", "Cihat", "Rahman"][i % 4], ["Türkoğlu", "Eroğlu", "Şenyurt", "Koyuncu"][i % 4], `0532${String(1000000 + i)}`]);
  const musteri = [["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"]];
  for (let i = 0; i < 60; i += 1) musteri.push(i === 44 ? [TARGET_NO, TARGET, "05321234567", dmy(10)] : [String(300000000 + i), `Firma ${i + 1} Ltd.`, `0533${String(2000000 + i)}`, dmy(200 + i)]);
  const arsiv = [["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"]];
  for (let i = 0; i < 5; i += 1) arsiv.push([String(400000000 + i), `Arşiv Firma ${i + 1}`, `0534${String(3000000 + i)}`, dmy(300 + i)]);
  const first = await api("/api/workspace/dataset/stage", { kind: "excel", fileName: "TÜM REHBER.xlsx", sheets: [{ name: "REHBER", matrix: rehber }] });
  ok((await api("/api/workspace/dataset/commit", { stageId: first.data.stageId, mode: "replace" })).status === 200, "1. sayfa yüklendi");
  // Veri yüklenince program kendini yeniler; ekran baştan açılır (sonraki istekler yarıda kalmasın).
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  const second = await api("/api/workspace/dataset/stage", { kind: "excel", fileName: "Müşteriler Yeni.xlsx", sheets: [{ name: "Müşteriler", matrix: musteri }, { name: "Arşiv", matrix: arsiv }] });
  ok((await api("/api/workspace/dataset/commit", { stageId: second.data.stageId, mode: "session", name: "Müşteriler Yeni" })).status === 200, "2. sayfa (Müşteriler Yeni) yeni sayfa olarak açıldı");
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  const pages = (await api("/api/workspace/sessions")).data.sessions;
  const p1 = pages.find(item => item.name !== "Müşteriler Yeni");
  const p2 = pages.find(item => item.name === "Müşteriler Yeni");
  ok(p2?.rowCount === 65, `2. sayfa 65 kayıt (${p2?.rowCount})`);
  await api("/api/workspace/sessions/select", { key: p1.key });
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await ready();
  ok(/TÜM REHBER/.test(await currentPill()), `1. sayfadayız (${await currentPill()})`);

  console.log("\n■ C. 1. sayfadayken 2. sayfanın uyarısında Kayda Git (sağ alt bildirim)");
  const notice = await page.waitForSelector(`#hof-notices .hof-notice:has-text("${TARGET}")`, { timeout: 30000 }).catch(() => null);
  ok(Boolean(notice), "2. sayfadaki kaydın uyarısı 1. sayfada sağ altta göründü");
  if (notice) {
    await shot("c-bildirim-1-sayfada");
    ok(!(await notice.$('[data-act="done"]')), "başka sayfanın uyarısında “Gerçekleştirildi” yok (yanlış sayfaya yazılırdı)");
    await Promise.all([page.waitForEvent("load", { timeout: 20000 }), notice.$('[data-act="go"]').then(button => button.click())]);
    await ready();
    await page.waitForFunction(name => (document.querySelector(".dynamic-table tbody tr.selected")?.textContent || "").includes(name), TARGET, { timeout: 25000 }).catch(() => {});
    ok(/Müşteriler Yeni/.test(await currentPill()), "Kayda Git → 2. sayfa açıldı");
    ok((await selectedRowText()).includes(TARGET), "Kayda Git → kayıt listede seçili");
    const inView = await page.$eval(".dynamic-table tbody tr.selected", node => {
      const box = node.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight + 2;
    }).catch(() => false);
    ok(inView, "seçili kayıt görünür yere kaydırıldı (listenin 45. satırı)");
    const card = await page.evaluate(name => [...document.querySelectorAll("h1, h2, h3")].some(node => !node.closest(".dynamic-table") && node.textContent.includes(name)), TARGET);
    ok(card, "kayıt sağdaki detay kartında açık (başlıkta firma adı)");
    await shot("c-kayda-gidildi");
  }

  console.log("\n■ C. Zil listesinden Kayda Git (1. sayfaya dönüp)");
  await api("/api/workspace/sessions/select", { key: p1.key });
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await ready();
  await page.click(".topbar .top-actions > .icon-button");
  const item = await page.waitForSelector(`${modal} li:has-text("${TARGET}")`, { timeout: 15000 }).catch(() => null);
  ok(Boolean(item), "zil listesinde 2. sayfanın uyarısı");
  if (item) {
    ok(!(await item.$("[data-done]")), "zil listesinde de başka sayfanın uyarısında “Gerçekleştirildi” yok");
    await Promise.all([page.waitForEvent("load", { timeout: 20000 }), item.$("[data-go]").then(button => button.click())]);
    await ready();
    await page.waitForFunction(name => (document.querySelector(".dynamic-table tbody tr.selected")?.textContent || "").includes(name), TARGET, { timeout: 25000 }).catch(() => {});
    ok(/Müşteriler Yeni/.test(await currentPill()) && (await selectedRowText()).includes(TARGET), "zilden Kayda Git → 2. sayfa ve kayıt seçili");
  }

  console.log("\n■ D. 2. sayfada “Arşiv” sekmesi silinince sayfa şeridindeki sayı 65 → 60 (aynı kullanıcının ikinci penceresinde de)");
  ok(/65 kayıt/.test(await currentPill()), `önce: ${await currentPill()}`);
  const peer = await context.newPage();
  await peer.goto(`${BASE}/`, { waitUntil: "load" });
  await peer.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
  await peer.waitForTimeout(800);
  const peerPill = () => peer.$eval("#hof-pages .hof-page.is-current .hof-page-pick", node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
  await page.evaluate(() => window.HOF.selectTab?.("Arşiv"));
  await page.waitForSelector("#hof-tab-edit", { timeout: 10000 });
  await page.click("#hof-tab-edit");
  await page.click(`${modal} [data-remove]`);
  await page.click(`${modal} [data-answer="yes"]`);
  await page.waitForFunction(() => /60 kayıt/.test(document.querySelector("#hof-pages .hof-page.is-current .hof-page-pick")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
  ok(/60 kayıt/.test(await currentPill()), `sekme silinince şerit: ${await currentPill()}`);
  await peer.waitForFunction(() => /60 kayıt/.test(document.querySelector("#hof-pages .hof-page.is-current .hof-page-pick")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
  ok(/60 kayıt/.test(await peerPill()), `ikinci pencerede şerit: ${await peerPill()}`);
  await shot("d-sekme-silindi-60");

  console.log("\n■ D. Sayfa şeridinden Sayfayı Sil");
  const del = await page.$("#hof-pages .hof-page.is-current [data-remove-page]");
  if (ok(Boolean(del), "açık sayfanın pilinde “Sayfayı Sil” düğmesi")) {
    await del.click();
    await page.waitForSelector(`${modal} [data-answer="yes"]`);
    const confirmText = await page.$eval(modal, node => node.textContent);
    ok(/Müşteriler Yeni/.test(confirmText) && /65 kayıt/.test(confirmText), "onayda sayfa adı ve (gizli sekme dahil) 65 kayıt");
    await shot("d-sayfayi-sil-onay");
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), peer.waitForEvent("load", { timeout: 30000 }).catch(() => {}), page.click(`${modal} [data-answer="yes"]`)]);
    await page.waitForTimeout(1500);
    const own = await page.evaluate(() => window.__toasts.join(" | "));
    ok(/Müşteriler Yeni” sayfası silindi/.test(own) && /Yedek: destekofis/.test(own) && /Açılan sayfa: “TÜM REHBER/.test(own) && !/veri yöneticisi/.test(own), `silen pencerenin bildirimi kendi silmesini ve yedeği söyler: “${own}”`);
    await peer.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 }).catch(() => {});
    await peer.waitForTimeout(1500);
    const other = await peer.evaluate(() => window.__toasts.join(" | ")).catch(() => "");
    ok(/silindi; “TÜM REHBER\.xlsx” sayfasına geçildi/.test(other), `öbür pencere açılan sayfanın adını söyler: “${other}”`);
  } else {
    // Düğme yoksa (eski kod) sayfa Ayarlar'daki yoldan silinir; sonraki adımlar yine koşar.
    await api("/api/workspace/sessions/delete", { key: p2.key });
    await page.waitForTimeout(2500);
    await page.goto(`${BASE}/`, { waitUntil: "load" }).catch(() => page.goto(`${BASE}/`, { waitUntil: "load" }));
  }
  await ready();
  const after = (await api("/api/workspace/sessions")).data.sessions;
  ok(after.length === 1 && !after.some(item => item.name === "Müşteriler Yeni"), "sayfa silindi; tek sayfa kaldı");
  ok(!(await page.$("#hof-pages .hof-page.is-current [data-remove-page]")), "ilk sayfada “Sayfayı Sil” yok");
  const dues = (await api("/api/workspace/dues")).data;
  ok(![...(dues.items || []), ...(dues.deadlines || [])].some(entry => String(entry.person || entry.title || "").includes(TARGET) || entry.caseNo === TARGET_NO), "silinen sayfanın uyarısı zil/takvimden kalktı");
  await shot("d-sayfa-silindi");
  await peer.close();
  // Silinmiş sayfanın (eski) uyarısından Kayda Git: kayıt açık sayfada aranmaz, "sayfa silinmiş" denir.
  await page.evaluate(() => {
    window.__toasts = [];
    return window.HOF.sessions.select("silinmis-sayfa", { reveal: { caseKey: "yok-boyle-bir-kayit" } });
  });
  await page.waitForTimeout(800);
  const gone = await page.evaluate(() => window.__toasts.join(" | "));
  ok(/sayfası silinmiş/.test(gone) && !/tabloda bulunamadı/.test(gone), `silinmiş sayfanın uyarısında Kayda Git: “${gone}”`);

  console.log("\n■ E. Şirket Verisini Sıfırla / Şirketi Sil onayı");
  const created = await api("/api/companies", { name: "İkinci Şirket" });
  ok(created.status === 200, "002 açıldı");
  await page.goto(`${BASE}/admin.html#companies`, { waitUntil: "load" });
  await page.waitForSelector('.adm-panel[data-panel="companies"]:not([hidden]) #adm-companies tr[data-company]', { timeout: 20000 });
  for (const [label, selector, code] of [
    ["Verisini Sıfırla · 001", '#adm-companies tr[data-company]:nth-child(1) [data-c-reset]', "001"],
    ["Verisini Sıfırla · 002", '#adm-companies tr[data-company]:nth-child(2) [data-c-reset]', "002"],
    ["Şirketi Sil · 002", '#adm-companies tr[data-company]:nth-child(2) [data-c-delete]', "002"],
  ]) {
    await page.click(selector);
    await page.waitForSelector(`${modal} input[name="confirm"]`);
    const state = await page.evaluate(() => {
      const form = document.querySelector(".hof-modal-backdrop.is-visible form");
      const confirm = form.querySelector('input[name="confirm"]');
      const password = form.querySelector('input[name="password"]');
      const trap = form.querySelector('input.hof-autofill-trap[autocomplete="username"]');
      const fields = [...form.querySelectorAll("input")];
      return { confirm: confirm.value, password: password.value, focused: document.activeElement === password, trap: Boolean(trap), trapBeforePassword: trap ? fields.indexOf(trap) === fields.indexOf(password) - 1 : false, trapVisible: trap ? trap.getBoundingClientRect().width > 2 : true, trapValue: trap?.value ?? null, passwordAutocomplete: password.getAttribute("autocomplete") };
    });
    // Kod kutusu dolu geldiği için parola tek korumadır: parola yöneticisi doldurmasın, görünmeyen alan kullanıcı adı taşımasın.
    ok(state.passwordAutocomplete === "one-time-code" && state.trapValue === "", `${label}: parola alanı kayıtlı parolayla doldurulmaz (autocomplete=${state.passwordAutocomplete}, gizli alan “${state.trapValue}”)`);
    ok(state.confirm === code, `${label}: onay kutusu “${state.confirm}” (beklenen ${code})`);
    ok(state.password === "" && state.focused, `${label}: parola boş ve odakta`);
    ok(state.trap && state.trapBeforePassword && !state.trapVisible, `${label}: parolanın hemen önünde görünmeyen kullanıcı adı alanı`);
    if (code === "001" && label.startsWith("Verisini")) await shot("e-sifirla-onay");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  console.log("\n■ A. 2 şirketle “+ Yeni Şirket” hiç görünmez; biri silinince geri gelir");
  const admHidden = await page.$eval("#adm-company-new", node => node.hidden || getComputedStyle(node).display === "none");
  ok(admHidden, "Yönetim → Şirketler: “+ Yeni Şirket” görünmüyor");
  const admLimit = await page.$eval("#adm-company-limit", node => (node.hidden ? "" : node.textContent)).catch(() => "");
  ok(/En fazla 2 şirket kurulabilir/.test(admLimit), `Yönetim'de kısa bilgi: “${admLimit}”`);
  await shot("a-yonetim-sinirda");
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await ready();
  await page.click("#hof-company [data-toggle]");
  await page.waitForSelector("#hof-company .hof-session-menu:not([hidden])");
  ok(!(await page.$("#hof-company [data-new]")), "sol üst seçicide “+ Yeni Şirket” yok");
  ok(!/\+ Yeni Şirket/.test(await page.$eval("#hof-company .hof-session-menu", node => node.textContent)), "menüde “+ Yeni Şirket” yazısı da yok");
  await shot("a-secici-sinirda");
  await page.keyboard.press("Escape");
  const two = (await api("/api/companies")).data.companies.find(entry => entry.code === "002");
  ok((await api(`/api/companies/${two.id}`, { confirm: "002", password: PASS }, "DELETE")).status === 200, "002 silindi");
  await page.goto(`${BASE}/admin.html#companies`, { waitUntil: "load" });
  await page.waitForSelector('.adm-panel[data-panel="companies"]:not([hidden]) #adm-companies tr[data-company]', { timeout: 20000 });
  const admBack = await page.$eval("#adm-company-new", node => !node.hidden && getComputedStyle(node).display !== "none");
  ok(admBack, "tek şirketle Yönetim'de “+ Yeni Şirket” geri geldi");
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await ready();
  await page.click("#hof-company [data-toggle]");
  await page.waitForSelector("#hof-company .hof-session-menu:not([hidden])");
  ok(Boolean(await page.$("#hof-company [data-new]")), "tek şirketle seçicide “+ Yeni Şirket” geri geldi");

  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata").catch(() => {});
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\nSenaryo 2.0.25: ${passed} geçti, ${failed} kaldı. Ekranlar: test/e2e/artifacts/senaryo-225`);
process.exit(failed ? 1 : 0);
