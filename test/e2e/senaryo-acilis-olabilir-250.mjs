// 2.5.0 Ç5-A tur 2c — Açılış Olabilir Kayıtlar ekranı + zil (İş 3; docs/erp/C5-ACILIS-TASARIM.md §2.4, §17.10; KULLANICI S47 = A, S51 = A; BAŞ MİMAR B16). Kullanıcı gözüyle, gerçek
// tıklama + Tab + Boşluk + insan hızında (ders 12): zil → Yönetim › Sistem › pencere; Kural Farkı penceresinin aday nedeninden pencereye geçiş; tek karar + bildirimde Geri Al; Tab ile
// seçip toplu ret; "Tümü" süzgeci + satırda Geri Al; boş liste; iki kişi aynı anda; Muhasebe rolü Yönetim'e giremez. Veri: v2.4.9'un GERÇEK koduyla API'den (aynı adlı iki cari,
// kilitli dönemde aday; ders 17) → güncel kod açılır, göç 48 adayları kurar. Saat sahte ve sabit (ders 13); lisans servisi yok (ders 30); pencere seçicisi son görünen pencere (ders 39).
// DEPO=<kopya> ile başka kod kopyasına karşı koşulur (eski kod: ekran yok → kırmızı).
// Çalıştırma: node test/e2e/senaryo-acilis-olabilir-250.mjs
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { installPageClock, ADMIN_PASSWORD } = await imp("test/helpers.mjs");
const { CURRENT, bootVersion } = await imp("test/guvenilirlik/surumler.mjs");

const OUT = path.join(HERE, "artifacts", "senaryo-acilis-olabilir-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const LOCK = "2026-10-05";
const root = fs.mkdtempSync(path.join(tmpdir(), "c5a2c-e2e-acilis-"));
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
const ids = {};
{
  const old = await bootVersion("v2.4.9", { dataDir, backupDir, now: NOW });
  try {
    const o = await old.login();
    await o.post("/api/workspace/bank/setup/dismiss", {});
    const a1 = (await o.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", type: "customer", registeredOn: "2026-09-01" })).data;
    const a2 = (await o.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", type: "customer", registeredOn: "2026-09-01" })).data;
    const add = async (account, note, kind, amount, date) => {
      await o.post(`/api/workspace/accounts/${account}/entries`, { kind, amount, date, note });
      return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ? AND date = ?", account, note, date)?.id;
    };
    Object.assign(ids, {
      locked: await add(a1.id, "Açılış bakiyesi", "debt", "70", "2026-10-02"),
      first: await add(a1.id, "Açılış devri", "debt", "300", "2026-10-12"),
      second: await add(a2.id, "Açılış devri", "debt", "200", "2026-10-12"),
      credit: await add(a2.id, "AÇILIŞ", "credit", "100", "2026-10-13"),
    });
    await o.put("/api/admin/period-lock", { lockedUntil: LOCK });
  } finally {
    await old.close();
  }
}
const server = await bootVersion(CURRENT, { dataDir, backupDir, now: NOW });
const app = server.app;
const BASE = server.base;
const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
let shotNo = 0;
const shot = async (name, target = page) => {
  shotNo += 1;
  await target.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true });
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
  }
};
const MODAL = ".hof-modal-backdrop.is-visible";
const top = (p = page) => p.locator(`${MODAL}:nth-last-child(1 of ${MODAL})`);
const human = (p = page) => p.waitForTimeout(250);
const review = id => app.store.get("SELECT opening_review AS review FROM account_entries WHERE id = ?", id)?.review;
async function login(context, username, password) {
  const p = await context.newPage();
  await installPageClock(p, app.config.now);
  p.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await p.goto(`${BASE}/`);
  await p.fill("#hof-auth input[name=username]", username);
  await p.fill("#hof-auth input[name=password]", password);
  await Promise.all([p.waitForEvent("load"), p.click('#hof-auth button[type="submit"]')]);
  await p.waitForSelector("#hof-sidecard", { timeout: 60000 });
  return p;
}
async function openSystem(p = page) {
  await p.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
  await p.click('.adm-tabs [data-tab="system"]');
  await p.waitForSelector("#adm-opening-review-open", { state: "visible", timeout: 60000 });
}
async function openWindow(p = page) {
  await openSystem(p);
  await p.click("#adm-opening-review-open");
  await p.waitForSelector(`${MODAL} [data-review-summary]`, { timeout: 60000 });
  await human(p);
  return top(p);
}
const rowOf = (dialog, id) => dialog.locator(`[data-review-row="${id}"]`);

try {
  await app.ledger.snapshots.runPending();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  page = await login(context, "admin", ADMIN_PASSWORD);
  ok(["locked", "first", "second", "credit"].every(key => review(ids[key]) === "candidate"), "ön koşul: göç 48 dört satırı aday yaptı (v2.4.9 verisi)");

  await step("Zil: 'Açılış Olabilir Kayıtlar — 4 kayıt onay bekliyor'; Yönetim → Sistem bağlantısı pencereyi açar", async () => {
    await page.waitForTimeout(3500);
    await page.click(".topbar .top-actions > .icon-button");
    const item = page.locator(".hof-alert-list li", { hasText: "kayıt onay bekliyor" });
    await item.first().waitFor({ timeout: 30000 });
    const text = (await item.first().textContent()).replace(/\s+/g, " ");
    console.log(`  zil: ${text}`);
    ok(/4 kayıt onay bekliyor/.test(text), "zilde onay bekleyen sayı");
    await shot("zil");
    await Promise.all([page.waitForEvent("load"), item.first().locator("a", { hasText: "Yönetim → Sistem" }).click()]);
    await page.waitForSelector(`${MODAL} [data-review-summary]`, { timeout: 60000 });
    const dialog = top();
    ok((await dialog.locator(".hof-modal-title").textContent()).trim() === "Açılış Olabilir Kayıtlar", "bağlantı pencereyi açtı (başlık)");
    await page.keyboard.press("Escape");
  });

  await step("Kural Farkı penceresi aday varken pasif; neden aday ekranının yerini söyler; 'Açılış Olabilir Kayıtları Aç' pencereye geçirir (B16)", async () => {
    await openSystem();
    await page.click("#adm-rule-diff-open");
    await page.waitForSelector(`${MODAL} [data-rule-diff-reason]`, { timeout: 60000 });
    await human();
    const reason = (await top().locator("[data-rule-diff-reason]").textContent()).replace(/\s+/g, " ");
    ok(/kilitli dönemde onay bekleyen 1 kayıt var \(Yönetim › Sistem › Açılış Olabilir Kayıtlar\)/.test(reason), `neden yeri söylüyor: "${reason.trim()}"`);
    ok(await top().locator("[data-rule-diff-save]").isDisabled(), "Fişi Kaydet pasif");
    await shot("kural-farki-aday-nedeni");
    await top().locator("[data-opening-review-open]").click();
    await page.waitForSelector(`${MODAL} [data-review-summary]`, { timeout: 60000 });
    await human();
    ok((await top().locator(".hof-modal-title").textContent()).trim() === "Açılış Olabilir Kayıtlar", "geçiş: Açılış Olabilir penceresi açıldı");
    ok((await page.locator(MODAL).count()) === 1, "Kural Farkı penceresi kapandı (tek pencere)");
    await page.keyboard.press("Escape");
  });

  await step("Pencere: dört satır, aynı adlı iki cari, kilitli satır 'Kilitli'; toplu düğmeler pasif ve nedeni görünür", async () => {
    const dialog = await openWindow();
    const summary = (await dialog.locator("[data-review-summary]").textContent()).trim();
    ok(summary === "Onay bekleyen 4 kayıt (kilitli dönemde 1) · Açılış 0 · Açılış Değil 0", `özet: "${summary}"`);
    ok((await dialog.locator("[data-review-table] tbody tr").count()) === 4, "dört satır");
    ok((await dialog.locator("[data-review-table] tbody tr", { hasText: "Ahmet Yılmaz" }).count()) === 4, "aynı adlı iki carinin satırları");
    const refOf = async id => ((await rowOf(dialog, id).locator("[data-review-ref]").textContent().catch(() => "")) || "").trim();
    const [ref1, ref2] = [await refOf(ids.first), await refOf(ids.second)];
    ok(ref1 && ref2 && ref1 !== ref2, `aynı adlı iki cari cari numarasıyla ayrılır ("${ref1}" ↔ "${ref2}")`);
    ok(/Kilitli/.test(await rowOf(dialog, ids.locked).textContent()) && /Açık/.test(await rowOf(dialog, ids.first).textContent()), "kilitli dönem satırı 'Kilitli', öbürü 'Açık'");
    ok((await dialog.locator("[data-review-bulk]").evaluateAll(nodes => nodes.every(node => node.disabled))), "toplu düğmeler pasif");
    ok((await dialog.locator("[data-review-bulk-why]").textContent()).trim() === "Toplu karar için kayıt seçin.", "pasifliğin nedeni görünür yazı");
    const heads = (await dialog.locator("[data-review-table] thead th").allTextContents()).map(text => text.trim()).filter(Boolean);
    ok(heads.join("|") === "Tarih|Cari|Tür|Tutar|Açıklama|Durum|Dönem|İşlem", `kolon başlıkları: ${heads.join(", ")}`);
    await shot("pencere");
  });

  await step("Tek karar: kilitli satır 'Açılış (Onayla)' → onaylandı; bildirimde Geri Al → yeniden onay bekliyor", async () => {
    const dialog = top();
    await rowOf(dialog, ids.locked).locator('[data-review-decision="confirm"]').click();
    await page.locator(".hof-toast", { hasText: "1 kayıt açılış sayıldı." }).last().waitFor({ timeout: 30000 });
    ok(review(ids.locked) === "confirmed", "veri tabanı: onaylandı");
    ok((await top().locator("[data-review-table] tbody tr").count()) === 3, "liste yenilendi: onay bekleyen 3");
    await shot("tek-karar");
    await page.locator(".hof-toast", { hasText: "1 kayıt açılış sayıldı." }).last().locator(".hof-toast-action").click();
    await page.locator(".hof-toast", { hasText: "1 kayıt yeniden onay bekliyor." }).last().waitFor({ timeout: 30000 });
    ok(review(ids.locked) === "candidate", "Geri Al: veri tabanında yeniden onay bekliyor");
    ok((await top().locator("[data-review-table] tbody tr").count()) === 4, "liste: yeniden 4");
  });

  await step("Toplu karar klavyeyle: Tab ile iki satırın kutusuna gelip Boşluk; 'Seçilenleri Reddet' → ikisi reddedildi", async () => {
    const dialog = top();
    await rowOf(dialog, ids.first).locator("[data-review-pick]").focus();
    await page.keyboard.press("Space");
    await human();
    ok((await top().locator("[data-review-bulk-why]").textContent()).trim() === "1 kayıt seçili.", "seçim sayısı");
    // Bir sonraki satırın kutusuna Tab ile (arada satır düğmeleri): kutuya gelene kadar Tab.
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      if (await page.evaluate(id => document.activeElement?.dataset?.reviewPick === id, ids.second)) break;
    }
    ok(await page.evaluate(id => document.activeElement?.dataset?.reviewPick === id, ids.second), "Tab ile ikinci satırın kutusu");
    await page.keyboard.press("Space");
    await human();
    ok((await top().locator("[data-review-bulk-why]").textContent()).trim() === "2 kayıt seçili.", "iki kayıt seçili");
    ok(!(await top().locator('[data-review-bulk="reject"]').isDisabled()), "toplu ret etkin");
    await top().locator('[data-review-bulk="reject"]').click();
    await page.locator(".hof-toast", { hasText: "2 kayıt açılış sayılmadı." }).last().waitFor({ timeout: 30000 });
    ok(review(ids.first) === "rejected" && review(ids.second) === "rejected", "veri tabanı: ikisi reddedildi");
    await shot("toplu-ret");
  });

  await step("'Tümü' süzgeci: kararlı satırlarda Geri Al; geri alınan satır yeniden onay bekler", async () => {
    await top().locator("[data-review-filter]").selectOption("all");
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible [data-review-table] tbody tr").length === 4, null, { timeout: 30000 });
    const row = rowOf(top(), ids.first);
    ok(/Açılış Değil/.test(await row.locator("[data-review-status]").textContent()), "reddedilen satırın durumu 'Açılış Değil'");
    await row.locator('[data-review-decision="undo"]').click();
    await page.locator(".hof-toast", { hasText: "1 kayıt yeniden onay bekliyor." }).last().waitFor({ timeout: 30000 });
    ok(review(ids.first) === "candidate", "veri tabanı: geri alındı");
    await shot("tumu-geri-al");
  });

  await step("İki kişi aynı anda: ikinci yönetici aynı satırı onaylar, ilk ekranın eski görünümünden ret — son karar geçerli, liste güncel", async () => {
    const otherContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
    const other = await login(otherContext, "admin", ADMIN_PASSWORD);
    const dialog2 = await openWindow(other);
    await rowOf(dialog2, ids.credit).locator('[data-review-decision="confirm"]').click();
    await other.locator(".hof-toast", { hasText: "1 kayıt açılış sayıldı." }).last().waitFor({ timeout: 30000 });
    ok(review(ids.credit) === "confirmed", "ikinci kişi onayladı");
    await rowOf(top(), ids.credit).locator('[data-review-decision="reject"]').click();
    await page.locator(".hof-toast", { hasText: "1 kayıt açılış sayılmadı." }).last().waitFor({ timeout: 30000 });
    ok(review(ids.credit) === "rejected", "son karar (ilk kişinin reddi) geçerli");
    ok(/Açılış Değil/.test(await rowOf(top(), ids.credit).locator("[data-review-status]").textContent()), "ilk ekran güncel durumu gösteriyor");
    await otherContext.close();
  });

  await step("Bütün adaylara karar → boş liste; Kural Farkı penceresi artık aday nedeniyle pasif değil; zil sayısı 0", async () => {
    await top().locator("[data-review-filter]").selectOption("candidate");
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible [data-review-table] tbody tr").length === 2, null, { timeout: 30000 });
    await top().locator("[data-review-all]").check();
    await human();
    await top().locator('[data-review-bulk="confirm"]').click();
    await page.locator(".hof-toast", { hasText: "2 kayıt açılış sayıldı." }).last().waitFor({ timeout: 30000 });
    await top().locator("[data-review-empty]").waitFor({ timeout: 30000 });
    ok((await top().locator("[data-review-empty]").textContent()).trim() === "Onay bekleyen kayıt yok.", "boş liste iletisi");
    await shot("bos-liste");
    await page.keyboard.press("Escape");
    await page.click("#adm-rule-diff-open");
    await page.waitForSelector(`${MODAL} [data-rule-diff-save-why]`, { timeout: 60000 });
    const why = (await top().locator("[data-rule-diff-save-why]").textContent()).trim();
    ok(!/Açılış Olabilir/.test(why), `Kural Farkı nedeni artık aday değil: "${why}"`);
    await page.keyboard.press("Escape");
    const counts = await page.evaluate(async () => (await window.HOF.api("/api/workspace/opening-review?counts=1")).counts);
    ok(counts.candidate === 0 && counts.lockedCandidate === 0, "zil sayısı 0");
  });

  await step("Muhasebe rolü: Yönetim paneline giremez (pencere yönetimde); personel uçlarda 403", async () => {
    const api = await server.login();
    await api.post("/api/admin/users", { username: "muhasebe2ce", name: "Muhasebe", role: "muhasebe", password: "Personel-2026!", mustChangePassword: false });
    const accContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
    const acc = await login(accContext, "muhasebe2ce", "Personel-2026!");
    await acc.goto(`${BASE}/admin.html#system/acilis-olabilir`, { waitUntil: "load" });
    await acc.waitForSelector("#adm-denied", { state: "visible", timeout: 60000 });
    ok((await acc.locator(MODAL).count()) === 0, "Muhasebe: Yönetim'e giremez, pencere açılmaz");
    await shot("muhasebe-yonetim", acc);
    await accContext.close();
  });
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  await browser.close().catch(() => null);
  await server.close().catch(() => null);
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
console.log(`\n# tests ${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
process.exitCode = failed ? 1 : 0;
