// 2.5.0 W-3 EKRANDAN — WhatsApp gönderim kayıtlarının KVKK silme talebi (docs/erp/W3-SAKLAMA-TASARIM.md). İŞ AKIŞI (test kuralı): sıfırdan, arayüzden, uçtan uca; sayılar
// programın veri tabanından ve API'sinden okunur (ders 3). Meta yerine YEREL sahte Graph (ders 30); sahte saat (ders 13); işçi elle (ders 20); gerçek tıklama + klavye (ders 12);
// en üstteki pencere seçicisi (ders 39); soru pencereleri bekleyerek yanıtlanır (ders 34). Beklenen sayılar karar metninden ve girilen veriden (ders 5).
//   K1 Cari kartı → WhatsApp: yönetici "Gönderim Kayıtlarını Sil (KVKK)" düğmesini görür → Sil sorusu (neden cümlesiyle) → Vazgeç: hiçbir şey silinmez.
//   K2 Sil → bildirim "Gönderim kayıtları silindi: 2 kayıt, 1 bekleyen gönderim atlandı." → veri tabanında A'nın iki işi içeriksiz (telefon, değişkenler, PDF adı boş), bekleyen
//      iş Atlandı (Silme Talebi); B'ninki durur. Kartın "Son Gönderimler" satırında "İçerik Silindi".
//   K3 Gönderimler → toplu iş ayrıntısı: A'nın satırında neden "İçerik ve telefon numarası KVKK silme talebiyle silindi.", telefon sütunu "—".
//   K4 Yönetim → WhatsApp → "Gönderim Kayıtları ve KVKK": kartında telefonu olmayan cari (kartta WhatsApp düğmesi yok) aranır (Enter) → Sil → veri tabanında silindi.
//   K5 Personel: kartın WhatsApp penceresinde KVKK düğmesi yok; uç 403.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-whatsapp-kvkk-250).
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ADMIN_PASSWORD, createUser } from "../helpers.mjs";
import { URLS, startWa } from "../whatsapp-248-ortak.mjs";

const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-whatsapp-kvkk-250");
mkdirSync(shots, { recursive: true });
const answersLog = path.join(shots, "soru-yanitlari.log");
writeFileSync(answersLog, "");
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const STAFF = { username: "kvkk-personel", password: "Personel-Kvkk-2026!" };
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};

const ctx = await startWa({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: { time: "2026-11-03T10:00:00+03:00", fixed: true } });
const browser = await chromium.launch();
try {
  const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
  const b = await ctx.account("Bora Demir", "0532 444 55 66", 300);
  const c = await ctx.account("Cem Telefonsuz", "0532 777 88 99", 200);
  const first = await ctx.batch({ kind: "statement", ids: [a.id, b.id, c.id], preset: "thisMonth" });
  if (first.status !== 200) throw new Error(`toplu iş: ${first.status} ${JSON.stringify(first.data)}`);
  await ctx.drain();
  for (const job of await ctx.jobs(first.data.data.batch.id)) ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905" }]);
  const held = await ctx.batch({ kind: "statement", ids: [a.id], preset: "lastMonth" });
  await ctx.api.post(`${URLS.batches}/${held.data.data.batch.id}/pause`, {});
  // C'nin kart telefonu silinir (kartta WhatsApp düğmesi kalmaz) — silme talebi Yönetim → WhatsApp'tan.
  const card = (await ctx.api.get(`/api/workspace/accounts/${c.id}`)).data.data;
  await ctx.api.put(`/api/workspace/accounts/${c.id}`, { ...card, phone: "" });
  const contentOf = id => ctx.store.all("SELECT state, skip_reason AS reason, phone_e164 AS phone, account_name AS name, params_json AS params, pdf_name AS pdf FROM wa_jobs WHERE account_id = ? ORDER BY rowid", id);
  const erasedRow = row => row.phone === "" && row.name === "" && row.pdf === "" && row.params.startsWith("{");

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const page = await context.newPage();
  const answer = async (choice, label) => {
    await page.waitForSelector(`${TOP} [data-answer="${choice}"]`, { state: "visible" });
    appendFileSync(answersLog, `${label}: ${choice} — ${(await page.textContent(`${TOP}`)).replace(/\s+/g, " ").trim().slice(0, 300)}\n`);
    await page.click(`${TOP} [data-answer="${choice}"]`);
    await page.waitForFunction(sel => !document.querySelector(`${sel} [data-answer]`), TOP);
  };
  const closeAll = async () => {
    for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
  };
  const login = async (username, password) => {
    await page.goto(`${ctx.server.base}/`);
    await page.fill("#hof-auth input[name=username]", username);
    await page.fill("#hof-auth input[name=password]", password);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  };
  const openChooser = async id => {
    await closeAll();
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`${TOP} tr[data-account="${id}"]`);
    await page.click(`${TOP} tr[data-account="${id}"]`);
    await page.waitForSelector(`${TOP} [data-act="whatsapp"]`);
    await page.click(`${TOP} [data-act="whatsapp"]`);
    await page.waitForSelector(`${TOP} [data-kind="statement"]`);
  };

  await login("admin", ADMIN_PASSWORD);
  console.log("K1 Cari kartı → WhatsApp: KVKK düğmesi, Vazgeç");
  await openChooser(a.id);
  ok(await page.isVisible(`${TOP} [data-wa-kvkk]`), "yönetici KVKK düğmesini görür");
  ok((await page.textContent(`${TOP} [data-wa-kvkk]`)).trim() === "Gönderim Kayıtlarını Sil (KVKK)", "düğme adı");
  await page.click(`${TOP} [data-wa-kvkk]`);
  await page.waitForSelector(`${TOP} [data-answer]`, { state: "visible" });
  const question = (await page.textContent(TOP)).replace(/\s+/g, " ");
  ok(/Gönderim Kayıtları Silinsin mi\?/.test(question) && /Ayşe Yılmaz için WhatsApp gönderim kayıtlarındaki ileti içeriği, ekstre PDF'i ve telefon numarası silinecek/.test(question), "soru başlığı ve nedeni");
  await page.screenshot({ path: path.join(shots, "k1-soru.png") });
  await page.keyboard.press("Escape");
  await page.waitForFunction(sel => !document.querySelector(`${sel} [data-answer]`), TOP);
  appendFileSync(answersLog, "K1 sorusu: Esc (Vazgeç)\n");
  ok(contentOf(a.id).every(row => !erasedRow(row)), "Vazgeç: hiçbir kayıt silinmedi");

  console.log("K2 Sil → bildirim ve veri tabanı");
  await openChooser(a.id);
  await page.click(`${TOP} [data-wa-kvkk]`);
  await answer("yes", "K2 sorusu");
  await page.waitForSelector(".hof-toast", { state: "visible" });
  const toast = (await page.textContent(".hof-toast")).replace(/\s+/g, " ");
  ok(/Gönderim kayıtları silindi: 2 kayıt, 1 bekleyen gönderim atlandı\./.test(toast), `bildirim (${toast.trim()})`);
  const rowsA = contentOf(a.id);
  ok(rowsA.length === 2 && rowsA.every(erasedRow), "A'nın iki işi içeriksiz");
  ok(rowsA.some(row => row.state === "skipped" && row.reason === "Silme Talebi"), "bekleyen iş Atlandı — Silme Talebi");
  ok(contentOf(b.id).every(row => !erasedRow(row) && row.phone === "+905324445566"), "B'nin işi durur");
  await openChooser(a.id);
  await page.waitForSelector(`${TOP} [data-history] li`);
  ok(/İçerik Silindi/.test(await page.textContent(`${TOP} [data-history]`)), "Son Gönderimler satırında İçerik Silindi");
  await page.screenshot({ path: path.join(shots, "k2-son-gonderimler.png") });

  console.log("K3 Gönderimler → ayrıntı");
  await closeAll();
  const detail = await ctx.detail(first.data.data.batch.id);
  const aJob = detail.jobs.find(job => job.accountId === a.id);
  ok(aJob.contentErased?.text === "İçerik ve telefon numarası KVKK silme talebiyle silindi.", "ayrıntıda neden metni");
  ok(aJob.phone === "" && aJob.accountName === "Ayşe Yılmaz", "telefon boş, ad karttan");

  console.log("K4 Yönetim → WhatsApp → Gönderim Kayıtları ve KVKK (telefonsuz cari)");
  await page.goto(`${ctx.server.base}/admin.html#whatsapp`);
  await page.waitForSelector("#adm-wa-kvkk [data-wa-kvkk-q]");
  ok((await page.textContent("#adm-wa-kvkk h2")).trim() === "Gönderim Kayıtları ve KVKK", "kart başlığı");
  await page.click("#adm-wa-kvkk [data-wa-kvkk-q]");
  await page.keyboard.type("Telefonsuz", { delay: 40 });
  await page.keyboard.press("Enter");
  await page.waitForSelector(`#adm-wa-kvkk [data-wa-kvkk-erase="${c.id}"]`);
  await page.screenshot({ path: path.join(shots, "k4-arama.png") });
  await page.click(`#adm-wa-kvkk [data-wa-kvkk-erase="${c.id}"]`);
  await answer("yes", "K4 sorusu");
  await page.waitForSelector(".hof-toast", { state: "visible" });
  ok(contentOf(c.id).every(erasedRow), "C'nin işi silindi (kartta WhatsApp düğmesi olmadan)");

  console.log("K5 Personel: düğme yok, uç 403");
  const staff = await createUser(ctx.server, ctx.api, { username: STAFF.username, password: STAFF.password });
  ok((await staff.post("/api/workspace/whatsapp/kvkk-erase", { accountId: b.id, confirm: true })).status === 403, "personel uca erişemez (403)");
  await context.clearCookies();
  await login(STAFF.username, STAFF.password);
  await openChooser(b.id);
  ok(!(await page.$(`${TOP} [data-wa-kvkk]`)), "personelde KVKK düğmesi yok");
  ok(contentOf(b.id).every(row => !erasedRow(row)), "B'nin işi hâlâ durur");
  await context.close();
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await ctx.close();
}
console.log(`${passed} geçti, ${failed} kaldı`);
process.exitCode = failed ? 1 : 0;
