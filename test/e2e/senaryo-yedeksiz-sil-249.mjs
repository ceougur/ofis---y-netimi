// Senaryo 2.4.9 S1 — bozuk dosyalı şirketi onayla yedeksiz silme, arayüzden (kullanıcı kararı 03.11.2026; docs/2.4.9-IS-LISTESI.md
// "KULLANICI KARARI (03.11 ~19:45 UTC"). Gerçek tıklama + insan hızında yazım + Tab (ders 12); en üstteki pencere konuma bağlı seçilmez (ders 39);
// soru/onay pencereleri test yardımcısıyla sessizce yanıtlanmaz, her yanıt adımda bilerek verilir (ders 34).
//  A. 002'nin veri dosyası bozuk (users kök sayfası) → Yönetim → Şirketler → Sil → kod dolu, parola yazılır → Şirketi Sil → ikinci, açık onay
//     "Yedeksiz Sil · 002 · …": Türkçe nedeni ("veri dosyası bozuk") ve "Veri klasörü silinmez; silinen-sirketler klasöründe saklanır (destek ile geri
//     getirilebilir)." yazar (S1 tur 1); düğme "Yedeksiz Sil"
//     (tehlikeli eylem rengi), odak Vazgeç'te.
//  B. Vazgeç → ilk pencere açık, nedeni altta; şirket listede, klasör yerinde, audit yok.
//  C. Yeniden Şirketi Sil → Yedeksiz Sil → bildirim "yedek alınmadan silindi"; liste 1 şirket; klasör silinen-sirketler'de (dosya bayt bayt aynı);
//     audit withoutBackup: true.
//  D. Sağlam şirket: Şirketi Sil → ikinci onay ÇIKMAZ; yedek alınır (dosya diskte), bildirim "Yedek: …".
// Klasör taşıma dosyaya dokunur (ders 48); bu senaryo CI'de yalnız Linux e2e işinde koşar, Windows sonucu birim/API testinden
// (test/sirket-yedeksiz-sil-249.test.mjs) okunur.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-yedeksiz-sil-249.mjs
import fs, { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { resolveDbPath } from "../../server/lib/db-path.mjs";

const OUT = process.env.SENARYO_EKRAN_DIZINI ? path.resolve(process.env.SENARYO_EKRAN_DIZINI) : path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-yedeksiz-sil-249");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-s1-249-"));
const dataDir = path.join(root, "data");
const app = createApp({ dataDir, backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f49" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
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
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`; // ders 39
const sha = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const auditOf = id => app.store.all("SELECT payload_json AS p FROM audit_events WHERE type = 'company.deleted' AND entity_id = ?", id).map(row => JSON.parse(row.p));
const archived = code => {
  const dir = path.join(dataDir, "silinen-sirketler");
  return existsSync(dir) ? readdirSync(dir).filter(name => name.startsWith(`${code}-`)) : [];
};
const rows = () => page.$$eval("#adm-companies tr[data-company]", list => list.map(row => row.dataset.company));
const topInfo = () =>
  page.evaluate(top => {
    const node = document.querySelector(top);
    if (!node) return null;
    const yes = node.querySelector('[data-answer="yes"]');
    const no = node.querySelector('[data-answer="no"]');
    return { title: node.querySelector(".hof-modal-title")?.textContent.trim() || "", text: node.querySelector(".hof-modal-text")?.textContent.replace(/\s+/g, " ").trim() || "", yes: yes?.textContent.trim() || "", danger: Boolean(yes?.classList.contains("hof-button-danger")), focusNo: document.activeElement === no, formError: node.querySelector(".hof-form-error")?.textContent.trim() || "" };
  }, TOP);
function corrupt(file) {
  const c = new DatabaseSync(file);
  let pageSize;
  let rootpage;
  try {
    c.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    pageSize = c.prepare("PRAGMA page_size").get().page_size;
    rootpage = c.prepare("SELECT rootpage FROM sqlite_master WHERE type = 'table' AND name = 'users'").get().rootpage;
  } finally {
    c.close();
  }
  for (const suffix of ["-wal", "-shm"]) if (existsSync(file + suffix)) renameSync(file + suffix, `${file + suffix}.yok`);
  const fd = openSync(file, "r+");
  try {
    writeSync(fd, Buffer.alloc(pageSize, 0xa5), 0, pageSize, (rootpage - 1) * pageSize);
  } finally {
    closeSync(fd);
  }
}
// İkinci onay ("Yedeksiz Sil") ya da ilk pencerede hata metni — hangisi önce gelirse.
const waitConfirmOrError = () =>
  page.waitForFunction(
    top => {
      const node = document.querySelector(top);
      return /Yedeksiz Sil/.test(node?.querySelector(".hof-modal-title")?.textContent || "") || Boolean(node?.querySelector(".hof-form-error")?.textContent.trim());
    },
    TOP,
    { timeout: 15000 },
  );
// Sil penceresini açar, parolayı insan hızında yazar, Tab'la alandan çıkar, Şirketi Sil'e gerçekten tıklar.
async function openDeleteAndSubmit(id, code) {
  await page.click(`#adm-companies tr[data-company="${id}"] [data-c-delete]`);
  await page.waitForSelector(`${TOP} input[name="password"]`);
  const state = await page.evaluate(top => {
    const form = document.querySelector(top);
    return { confirm: form.querySelector('input[name="confirm"]').value, focused: document.activeElement === form.querySelector('input[name="password"]') };
  }, TOP);
  ok(state.confirm === code && state.focused, `Şirketi Sil · ${code}: kod kutusu “${state.confirm}”, parola odakta (${state.focused})`);
  await page.keyboard.type(PASS, { delay: 45 });
  await page.keyboard.press("Tab");
  await page.click(`${TOP} button[type="submit"]`);
}

try {
  console.log("\n■ Kurulum: 002 açılır, cari girilir, veri dosyasının users kök sayfası bozulur");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForTimeout(1200);
  const created = await api("/api/companies", { name: "Bozuk Dosyalı Şirket", select: false });
  ok(created.status === 200, `002 açıldı (${created.status})`);
  const bad = created.data.company;
  const cari = await api(`/api/workspace/accounts?hofCompany=${encodeURIComponent(bad.id)}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" });
  ok(cari.status === 200, `002'ye cari girildi (${cari.status})`);
  await app.context.closeCompany(bad.id);
  const badDir = path.join(dataDir, "sirketler", bad.code);
  const badFile = resolveDbPath(badDir);
  corrupt(badFile);
  const badSha = sha(badFile);
  const probe = await api(`/api/workspace/accounts?hofCompany=${encodeURIComponent(bad.id)}`);
  ok(probe.status !== 200, `ön koşul: bozuk şirket açılmıyor (durum ${probe.status})`);

  console.log("\n■ A. Şirketi Sil → yedek alınamadı → ikinci, açık onay");
  await page.goto(`${BASE}/admin.html#companies`, { waitUntil: "load" });
  await page.waitForSelector('.adm-panel[data-panel="companies"]:not([hidden]) #adm-companies tr[data-company]', { timeout: 20000 });
  ok((await rows()).length === 2, "listede iki şirket");
  await openDeleteAndSubmit(bad.id, bad.code);
  await waitConfirmOrError();
  const confirmInfo = await topInfo();
  // Ders 38: kırmızının nedeni iletide okunur — ikinci onay yerine ilk pencerede hata kaldıysa (eski davranış: 500) hata metni yazılır.
  if (!ok(confirmInfo.title === `Yedeksiz Sil · ${bad.code} · ${bad.name}`, `ikinci onay açıldı: başlık “${confirmInfo.title}”${confirmInfo.formError ? `; ilk pencerede hata “${confirmInfo.formError}”` : ""}`)) throw new Error("ikinci onay (Yedeksiz Sil) açılmadı");
  // S1 TUR 1: neden Türkçe ("veri dosyası bozuk"; ham SQLite iletisi pencerede yok) ve klasörün korunduğu açıkça yazar.
  ok(/^Yedek alınamadı \(veri dosyası bozuk\)\./.test(confirmInfo.text) && !/malformed|disk image/i.test(confirmInfo.text), `neden Türkçe: “${confirmInfo.text.slice(0, 90)}…”`);
  ok(confirmInfo.text.includes("Veri klasörü silinmez; silinen-sirketler klasöründe saklanır (destek ile geri getirilebilir)."), "“Veri klasörü silinmez; silinen-sirketler klasöründe saklanır (destek ile geri getirilebilir).” yazıyor");
  ok(!confirmInfo.text.includes("yine silinen-sirketler altına taşınır"), "eski metin yok");
  ok(confirmInfo.yes === "Yedeksiz Sil" && confirmInfo.danger, `düğme “${confirmInfo.yes}”, tehlikeli eylem rengi (${confirmInfo.danger})`);
  ok(confirmInfo.focusNo, "odak güvenli düğmede (Vazgeç)");
  ok((await page.$$(MODAL)).length === 2, "ilk pencere arkada açık (iki pencere)");
  await shot("a-yedeksiz-sil-onayi");

  console.log("\n■ B. Vazgeç → silinmez, ilk pencere nedenle açık kalır");
  await page.click(`${TOP} [data-answer="no"]`);
  await page.waitForFunction(modal => document.querySelectorAll(modal).length === 1, MODAL, { timeout: 10000 });
  const afterCancel = await topInfo();
  ok(/Silme öncesi yedek alınamadı; şirket silinmedi/.test(afterCancel.formError), `ilk pencerede neden: “${afterCancel.formError.slice(0, 80)}…”`);
  ok(existsSync(badFile) && sha(badFile) === badSha, "veri dosyası yerinde, dokunulmadı");
  ok(Boolean(app.companies.get(bad.id)) && !auditOf(bad.id).length && !archived(bad.code).length, "şirket kayıtta, audit yok, silinen-sirketler'de değil");
  await shot("b-vazgec-ilk-pencere");

  console.log("\n■ C. Yeniden Şirketi Sil → Yedeksiz Sil");
  // Parola alanı korunur; yeniden gönderim gerçek tıklamayla.
  // Form gönderimde kendi hata satırını siler (hof-core formModal); bekleme eski hatayı görmez.
  await page.click(`${TOP} button[type="submit"]`);
  await waitConfirmOrError();
  ok(/Yedeksiz Sil/.test((await topInfo()).title), "ikinci onay yeniden açıldı");
  await page.click(`${TOP} [data-answer="yes"]`);
  await page.waitForFunction(() => window.__toasts.some(text => /yedek alınmadan silindi/.test(text)), null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll("#adm-companies tr[data-company]").length === 1, null, { timeout: 15000 });
  const toastC = await page.evaluate(() => window.__toasts.find(text => /yedek alınmadan silindi/.test(text)) || "");
  ok(toastC.includes(`“${bad.code} · ${bad.name}” yedek alınmadan silindi; veri klasörü silinen-sirketler altında.`), `bildirim “${toastC.trim()}”`);
  ok(!(await page.$(MODAL)), "pencereler kapandı");
  ok((await rows()).length === 1, "listede tek şirket");
  const moved = archived(bad.code);
  ok(moved.length === 1 && !existsSync(badDir), `klasör silinen-sirketler/${moved[0] || "?"} altında, eski yerinde yok`);
  const movedFile = moved.length ? resolveDbPath(path.join(dataDir, "silinen-sirketler", moved[0])) : "";
  ok(Boolean(movedFile) && existsSync(movedFile) && sha(movedFile) === badSha, "taşınan veri dosyası bayt bayt aynı");
  const audits = auditOf(bad.id);
  ok(audits.length === 1 && audits[0].withoutBackup === true && audits[0].backup === "", `audit: ${JSON.stringify(audits[0] || {}).slice(0, 160)}`);
  await shot("c-yedeksiz-silindi");

  console.log("\n■ D. Sağlam şirket: ikinci onay çıkmaz, yedek alınır");
  const good = (await api("/api/companies", { name: "Sağlam Şirket", select: false })).data.company;
  await api(`/api/workspace/accounts?hofCompany=${encodeURIComponent(good.id)}`, { name: "Ayşe Demir", phone: "0532 111 22 33" });
  const goodFolder = app.backups.folderOf(app.companies.get(good.id));
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector(`#adm-companies tr[data-company="${good.id}"]`, { timeout: 20000 });
  await page.evaluate(() => {
    window.__toasts = [];
  });
  await openDeleteAndSubmit(good.id, good.code);
  await page.waitForFunction(() => window.__toasts.some(text => /silindi\. Yedek:/.test(text)), null, { timeout: 15000 });
  const toastD = await page.evaluate(() => window.__toasts.find(text => /silindi\. Yedek:/.test(text)) || "");
  const backupName = /Yedek: ([^\s×]+)/.exec(toastD)?.[1] || ""; // bildirimin kapatma düğmesi (×) metne eklenir
  ok(/silme-oncesi/.test(backupName) && existsSync(path.join(goodFolder, backupName)), `yedek alındı ve diskte: ${backupName}`);
  ok(!(await page.evaluate(() => [...document.querySelectorAll(".hof-modal-title")].some(node => /Yedeksiz Sil/.test(node.textContent)))), "“Yedeksiz Sil” onayı çıkmadı");
  const goodAudit = auditOf(good.id);
  ok(goodAudit.length === 1 && !("withoutBackup" in goodAudit[0]) && goodAudit[0].backup === backupName, `audit'te withoutBackup yok, yedek ${goodAudit[0]?.backup}`);
  await shot("d-saglam-yedekli-silindi");

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
console.log(`\nSenaryo 2.4.9 S1 (yedeksiz sil): ${passed} geçti, ${failed} kaldı. Ekranlar: ${OUT}`);
process.exit(failed ? 1 : 0);
