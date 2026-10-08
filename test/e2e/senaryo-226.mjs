// Senaryo 2.0.26 — Aşama 0 bağımsız gözden geçirme bulguları, arayüzden (kullanıcı gibi tıklayarak; sonuç API ile doğrulanır):
//  G3. Kilitli dönemde alınmış kuruşlu çek (1.234,50) → kartta Düzenle: form tutar/alış tarihi alanlarını açmaz, giriş metni nedeni
//      söyler; vade değiştirilip kaydedilir (önceden form "1234,5" gönderiyor, 409 "kilitli dönem" alıyordu). Tutar aynı.
//  G7. Cari kartında nakit tahsilat silinirken Kasa eksiye düşecekse soru nedenini söyler ("Bu tahsilat silinince Nakit Kasa'dan …
//      düşer"), "yolu değiştirin" önerisi yok, "Yine de silinsin mi?"; onaylanınca silinir, Kasa sayısı doğru.
//  G1. Kilitli günde kapatılmış taksit kartında Yeniden Aç → ekranda nedenli ret ("… kapatıldı … Kart yeniden açılamaz."); kart Kapalı.
// Çalıştırma: npm run test:senaryo-226
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-226");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-226-"));
const pad = v => String(v).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = iso(new Date());
const LOCK = "2025-06-30";
const LOCKED_DAY = "2025-03-10";
const OPEN_DAY = "2025-09-10";
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f26" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-US" });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
// Yalnız beklenen retler (Kasa eksiye düşecek sorusu, kilitli kart: 409) ve girişten önceki oturum yoklaması (401) hata sayılmaz.
page.on("console", message => {
  if (message.type() === "error" && !/status of 40[19]/.test(message.text())) errors.push(`console ${message.text()}`);
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
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const closeAll = async () => {
  for (let i = 0; i < 8 && (await page.$(modal)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) await yes.click();
  }
};
const lastToast = async pattern => {
  for (let i = 0; i < 20; i += 1) {
    const texts = await page.$$eval(".hof-toast .hof-toast-text", nodes => nodes.map(n => n.textContent.trim()));
    const hit = texts.find(t => pattern.test(t));
    if (hit) return hit;
    await page.waitForTimeout(250);
  }
  return (await page.$$eval(".hof-toast .hof-toast-text", nodes => nodes.map(n => n.textContent.trim()))).join(" | ");
};
const cashApi = async () => (await must("kasa", api.get("/api/workspace/cash?method=cash"))).totals.balance;

try {
  await api.login("admin", PASS);
  // ---------- Kurulum (API; denenen işlemler aşağıda ekrandan) ----------
  const chequeAcc = await must("cari", api.post("/api/workspace/accounts", { name: "Çek Müşteri", type: "customer", registeredOn: "2025-01-01" }));
  const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.234,50", issueDate: LOCKED_DAY, dueDate: "2026-12-31", serialNo: "CK-226", bank: "Ziraat Meram", accountId: chequeAcc.id }));
  const cashAcc = await must("cari", api.post("/api/workspace/accounts", { name: "Kasa Müşteri", type: "customer", registeredOn: "2025-01-01" }));
  const paid = await must("tahsilat", api.post(`/api/workspace/accounts/${cashAcc.id}/entries`, { kind: "in", amount: "1000", date: OPEN_DAY, method: "cash" }));
  const balance = await cashApi();
  await must("kira", api.post("/api/workspace/cash", { kind: "out", amount: String(balance - 200), date: TODAY, description: "Kira" }));
  const planAcc = await must("cari", api.post("/api/workspace/accounts", { name: "Kart Müşteri", type: "customer", registeredOn: TODAY }));
  const plan = await must("kart", api.post("/api/workspace/plans", { accountId: planAcc.id, name: "Kart Müşteri", total: "500", registeredOn: TODAY, mode: "auto", count: 1, firstDue: TODAY }));
  await must("kart kapat", api.put(`/api/workspace/plans/${plan.id}`, { status: "closed" }));
  await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));

  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard [data-action=cheques]", { timeout: 60000 });
  await page.waitForTimeout(1200);

  await step("G3. Kilitli dönemdeki kuruşlu çekte Düzenle: tutar alanı yok, neden yazıyor; vade kaydedilir", async () => {
    await closeAll();
    await page.click("#hof-sidecard [data-action=cheques]");
    await page.waitForSelector(`${modal} [data-act="new-in"]`, { timeout: 15000 });
    await page.selectOption(`${modal} select[data-filter="status"]`, "");
    await page.waitForSelector(`${modal} tr[data-cheque="${cheque.id}"]`, { timeout: 15000 });
    await page.click(`${modal} tr[data-cheque="${cheque.id}"]`);
    await page.waitForSelector(`${modal} .hof-chq-actions [data-act="edit"]`, { timeout: 15000 });
    await page.click(`${modal} .hof-chq-actions [data-act="edit"]`);
    await page.waitForSelector(`${top} form input[name="dueDate"]`, { timeout: 10000 });
    const amountField = await page.$(`${top} form input[name="amount"]`);
    const issueField = await page.$(`${top} form input[name="issueDate"]`);
    ok(!amountField && !issueField, "formda Tutar ve Alış Tarihi alanı yok (kilitli dönem)");
    const intro = await page.$eval(`${top} .hof-modal-text`, n => n.textContent.trim()).catch(() => "");
    ok(/kapatılmış \(kilitli\) dönemde alındı/.test(intro) && /yalnız vade/.test(intro), `giriş metni nedeni söylüyor: "${intro}"`);
    await shot("g3-cek-duzenle-kilitli");
    await page.fill(`${top} form input[name="dueDate"]`, "2027-01-15");
    await page.click(`${top} form button[type="submit"]`);
    let closed = false;
    for (let i = 0; i < 20 && !closed; i += 1) {
      await page.waitForTimeout(300);
      closed = !(await page.$(`${top} form input[name="dueDate"]`));
    }
    const error = closed ? "" : await page.$eval(`${top} form .hof-form-error`, n => n.textContent.trim()).catch(() => "");
    ok(closed, `kaydedildi${error ? ` (hata: ${error})` : ""}`);
    const after = await must("çek oku", api.get(`/api/workspace/cheques/${cheque.id}`));
    ok(after.dueDate === "2027-01-15" && after.amount === 1234.5, `API: vade ${after.dueDate}, tutar ${after.amount} (aynı)`);
    await shot("g3-cek-vade-kaydedildi");
  });

  await step("G7. Cari kartında nakit tahsilat silinirken Kasa eksiye düşecek: soru nedeni söyler; onayla silinir", async () => {
    await closeAll();
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`${top} tr[data-account="${cashAcc.id}"]`, { timeout: 15000 });
    await page.click(`${top} tr[data-account="${cashAcc.id}"] td:nth-child(3)`);
    await page.waitForSelector(`${top} [data-delete-entry="${paid.entryId}"]`, { timeout: 15000 });
    await page.click(`${top} [data-delete-entry="${paid.entryId}"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`);
    await page.click(`${top} [data-answer="yes"]`); // "Hareketi Sil" onayı
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].some(m => /Kasa Eksiye Düşecek/.test(m.textContent)), null, { timeout: 10000 });
    const text = await page.$eval(top, n => n.innerText.replace(/\s+/g, " "));
    ok(/Bu tahsilat silinince Nakit Kasa'dan 1\.000,00 TL düşer/.test(text), "soru nedeni söylüyor (silinince Nakit Kasa'dan 1.000,00 TL düşer)");
    ok(/200,00 TL iken [−-]800,00 TL olur/.test(text), "önce/sonra bakiye yazıyor (200,00 → −800,00)");
    ok(/Yine de silinsin mi\?/.test(text) && !/yolu değiştirin/.test(text) && !/çıkış/.test(text), "silmeye uygun soru (yol önerisi ve 'çıkış' yok)");
    await shot("g7-silme-sorusu");
    await page.click(`${top} [data-answer="yes"]`);
    let cash = await cashApi();
    for (let i = 0; i < 20 && cash !== -800; i += 1) {
      await page.waitForTimeout(250);
      cash = await cashApi();
    }
    ok(cash === -800, `onaylanınca silindi; Nakit Kasa ${cash}`);
  });

  await step("G1. Kilitli günde kapatılmış kartta Yeniden Aç: ekranda nedenli ret, kart Kapalı kalır", async () => {
    await must("kilit bugün", api.put("/api/admin/period-lock", { lockedUntil: TODAY }));
    await closeAll();
    await page.click("#hof-sidecard [data-action=plans]");
    await page.waitForSelector(`${top} input[data-filter="q"]`, { timeout: 15000 });
    await page.click(`${top} .hof-tabs [data-status="all"]`);
    await page.waitForTimeout(400);
    await page.fill(`${top} input[data-filter="q"]`, "Kart Müşteri");
    await page.waitForSelector(`${top} tr[data-plan="${plan.id}"]`, { timeout: 15000 });
    await page.click(`${top} tr[data-plan="${plan.id}"]`);
    await page.waitForSelector(`${top} [data-act="reopen"]`, { timeout: 15000 });
    await page.click(`${top} [data-act="reopen"]`);
    const toast = await lastToast(/kapatıldı|yeniden açıldı/);
    await shot("g1-kart-yeniden-ac-ret");
    ok(/kapatıldı/.test(toast) && /Kart yeniden açılamaz/.test(toast), `ekranda ret nedeni: "${toast}"`);
    const after = await must("kart oku", api.get(`/api/workspace/plans/${plan.id}`));
    ok(after.status === "closed", `API: kart ${after.status}`);
  });

  await step("Mutabakat", async () => {
    const result = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
    ok(result.ok, `ana defter ↔ Kasa/Cari/Taksit/Çek tutarlı${result.ok ? "" : `: ${JSON.stringify(result.failures).slice(0, 300)}`}`);
  });
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await app.close();
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
process.exitCode = failed ? 1 : 0;
