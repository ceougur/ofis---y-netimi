// 2.5.1 M2 tur 2 — Değersiz Alacak'tan sonra fatura iptali reddi ve öbür şüpheli kaydın silinmesi reddi EKRANDAN (S-DKM2-2 = A, S-DKM2-3 = C; sunucu kuralı
// test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs). Sahte saat 15.10.2026 (ders 13); gerçek tıklama + klavye (ders 12); sayılar VERİ TABANINDAN (ders 3).
//   1 Taban T (Fatura 2.900 · Borç 3.400 · 17.09 bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000) + Değersiz 3.000 @17.09 → fatura kartında İptal Et → iptal nedeni (klavye) → İptal Et:
//     pencere AÇIK kalır, ileti "Fatura iptal edilemez: … 2.476,45 TL alacaklı … en çok 123,55 TL … Ne yapmalı: önce Değersiz Alacak satırını silin (cari kartı → Şüpheli Alacaklar →
//     Değersiz Alacaklar → Sil)"; fatura "issued", bakiye 423,55 (veri tabanı).
//   2 S2 1.000 (13.09) + S1 3.000 (15.09) + 01.10 bağsız 1.000 + Değersiz S1 3.000 @20.09 → cari kartında S2'nin × düğmesi → Evet: bildirim "Şüpheli alacak kaydı silinemez: bu kayıt silinirse
//     carinin bağsız tahsilatı Değersiz Alacak yazılan kayda düşer …" (eski anlatım "yazıldığı andaki sınırı aşardı" YOK); S2 yerinde, bakiye 2.300.
//   3 (tur 3 — S-M2T2-1 = A) T + 05.10 avans 3.000 (bakiye −2.576,45) → fatura İptal Et: ret, ileti "… iptalden sonra cari 5.476,45 TL alacaklı … Değersiz Alacak satırı olmasaydı da
//     cari 2.476,45 TL alacaklı olurdu …"; fatura "issued", bakiye −2.576,45.
//   4 (tur 3 — S-M2T2-2 = A) T → fatura Düzenle → Birim Fiyat 2.900 → 100 (klavye) → Değişiklikleri Kaydet → "Değişiklikler Kaydedilsin mi?" Evet: ret, ileti "Fatura düzenlenemez: … düzenlemeden sonra cari 2.376,45 TL alacaklı …";
//     fatura 2.900, bakiye 423,55.
//   5 Mutabakat Testi tamam; sayfa hatası yok.
// Çıkış: "N geçti, M kaldı" (kalan > 0 → çıkış 1). Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const NOW = "2026-10-15T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "senaryo-m2t2-251-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: NOW, logLevel: "warn", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const admin = await server.login();
const BASE = server.base;
const db = () => server.app.store;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const WHERE = "cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi";

const T = await must("cari T", admin.post(ACC, { name: "M2T2 Ekran İptal Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
const invT = await must("fatura", admin.post(INV, { scenario: "service_sale", accountId: T.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
await must("borç", admin.post(`${ACC}/${T.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
await must("bağlı tahsilat", admin.post(`${ACC}/${T.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: invT.id }));
const sT = (await must("şüpheliye al", admin.post(`${ACC}/${T.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
await must("Değersiz 3.000", admin.post(`${ACC}/${T.id}/doubtful/${sT}/write-off`, { amount: "3000", date: "2026-09-17" }));

const F = await must("cari F", admin.post(ACC, { name: "M2T2 Ekran Silme Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
await must("fatura F", admin.post(INV, { scenario: "service_sale", accountId: F.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
await must("borç F", admin.post(`${ACC}/${F.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
const s2 = (await must("S2", admin.post(`${ACC}/${F.id}/doubtful`, { amount: "1000", date: "2026-09-13", reason: "lawsuit" }))).record.id;
const s1 = (await must("S1", admin.post(`${ACC}/${F.id}/doubtful`, { amount: "3000", date: "2026-09-15", reason: "lawsuit" }))).record.id;
await must("bağsız 1.000", admin.post(`${ACC}/${F.id}/entries`, { kind: "in", amount: "1000", date: "2026-10-01", method: "cash", cashForce: true, similarOk: true, note: "Bağsız" }));
await must("Değersiz S1", admin.post(`${ACC}/${F.id}/doubtful/${s1}/write-off`, { amount: "3000", date: "2026-09-20" }));
// Tur 3: aynı taban T iki cari daha — A avanslı (S-M2T2-1), D Düzenle (S-M2T2-2).
const baseT = async name => {
  const c = await must(`cari ${name}`, admin.post(ACC, { name, type: "customer", registeredOn: "2026-09-01" }));
  const invoice = await must(`fatura ${name}`, admin.post(INV, { scenario: "service_sale", accountId: c.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
  await must(`borç ${name}`, admin.post(`${ACC}/${c.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  await must(`bağlı ${name}`, admin.post(`${ACC}/${c.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: invoice.id }));
  const record = (await must(`şüpheli ${name}`, admin.post(`${ACC}/${c.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  await must(`Değersiz ${name}`, admin.post(`${ACC}/${c.id}/doubtful/${record}/write-off`, { amount: "3000", date: "2026-09-17" }));
  return { c, invoice };
};
const A = await baseT("M2T3 Ekran Avanslı Müşteri");
await must("avans", admin.post(`${ACC}/${A.c.id}/entries`, { kind: "in", amount: "3000", date: "2026-10-05", method: "cash", cashForce: true, similarOk: true, note: "Avans" }));
const D = await baseT("M2T3 Ekran Düzenle Müşterisi");

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const top = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const inv = `${MODAL} .hof-invoices-modal`;
const card = ".hof-accounts-modal";
const errors = [];
const browser = await chromium.launch();
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const balance = async id => (await must("kart", admin.get(`${ACC}/${id}`))).totals.balance;
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }).catch(() => null);
const closeAll = async page => {
  for (let index = 0; index < 8 && (await page.$(MODAL)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const lastToast = page => page.$$eval(".hof-toast .hof-toast-text", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()).at(-1) || "").catch(() => "");

try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, server.app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  console.log("\n■ 1 Değersiz'den sonra fatura İptal Et → ret, pencere açık, dört parçalı ileti");
  await page.evaluate(id => window.HOF.invoices.openDoc(id), invT.id);
  await page.waitForSelector(`${inv} [data-act="cancel"]:not([disabled])`);
  await page.click(`${inv} [data-act="cancel"]`);
  await page.waitForSelector(`${top} form [name="reason"]`);
  await page.click(`${top} form [name="reason"]`);
  await page.keyboard.type("Hatalı tutar", { delay: 70 });
  await page.keyboard.press("Tab");
  await page.click(`${top} form button[type="submit"]`);
  await page.waitForSelector(`${top} .hof-form-error`, { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(500);
  const error1 = await textOf(page, `${top} .hof-form-error`);
  ok(/^Fatura iptal edilemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var/.test(error1), `ileti ne oldu: "${error1.slice(0, 120)}"`);
  ok(error1.includes("iptalden sonra cari 2.476,45 TL alacaklı (eksi bakiye) olurdu"), "ileti neden (−2.476,45)");
  ok(error1.includes("en çok 123,55 TL Değersiz Alacak yazılabilirdi"), "ileti sınır (123,55)");
  ok(error1.includes(`Ne yapmalı: önce Değersiz Alacak satırını silin (${WHERE})`), "ileti ne yapmalı + nereye");
  ok(Boolean(await page.$(`${top} form [name="reason"]`)), "pencere açık kalır");
  ok(db().get("SELECT status FROM invoices WHERE id = ?", invT.id).status === "issued", "veri tabanı: fatura iptal edilmedi");
  ok((await balance(T.id)) === 423.55, `bakiye ${await balance(T.id)} (423,55)`);
  await shot(page, "m2t2-1-iptal-reddi");
  await closeAll(page);

  console.log("\n■ 2 Öbür şüpheli kaydın silinmesi reddi KALIR; ileti doğru anlatır (S-DKM2-3 = C)");
  await page.evaluate(accountId => window.HOF.accounts.open(accountId), F.id);
  await page.waitForSelector(`${card} [data-doubtful-record]`, { timeout: 10000 });
  await page.click(`${card} [data-dbt-act="delete"][data-dbt-id="${s2}"]`);
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForTimeout(1200);
  const toast2 = await lastToast(page);
  ok(/Şüpheli alacak kaydı silinemez: bu kayıt silinirse carinin bağsız tahsilatı Değersiz Alacak yazılan kayda düşer ve o kaydın 20\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı/.test(toast2), `bildirim: "${toast2.slice(0, 200)}"`);
  ok(toast2.includes(`Ne yapmalı: önce o Değersiz Alacak satırını silin (${WHERE})`), "bildirim ne yapmalı + nereye");
  ok(!toast2.includes("yazıldığı andaki sınırı aşardı"), "eski (yanlış) anlatım yok");
  ok(db().get("SELECT status FROM doubtful_receivables WHERE id = ?", s2).status === "open", "veri tabanı: S2 silinmedi");
  ok((await balance(F.id)) === 2300, `bakiye ${await balance(F.id)} (2.300)`);
  await shot(page, "m2t2-2-silme-reddi");
  await closeAll(page);

  console.log("\n■ 3 (tur 3) Değersiz olmadan da eksi kalacak iptal de reddedilir (S-M2T2-1 = A)");
  await page.evaluate(id => window.HOF.invoices.openDoc(id), A.invoice.id);
  await page.waitForSelector(`${inv} [data-act="cancel"]:not([disabled])`);
  await page.click(`${inv} [data-act="cancel"]`);
  await page.waitForSelector(`${top} form [name="reason"]`);
  await page.click(`${top} form [name="reason"]`);
  await page.keyboard.type("Hatalı fatura", { delay: 70 });
  await page.keyboard.press("Tab");
  await page.click(`${top} form button[type="submit"]`);
  await page.waitForSelector(`${top} .hof-form-error`, { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(500);
  const error3 = await textOf(page, `${top} .hof-form-error`);
  ok(/^Fatura iptal edilemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; iptalden sonra cari 5\.476,45 TL alacaklı \(eksi bakiye\) olurdu/.test(error3), `ileti ne oldu: "${error3.slice(0, 160)}"`);
  ok(error3.includes("Değersiz Alacak satırı olmasaydı da cari 2.476,45 TL alacaklı olurdu"), "ileti neden (Değersiz olmadan da eksi)");
  ok(error3.includes(`Ne yapmalı: önce Değersiz Alacak satırını silin (${WHERE}), sonra faturayı iptal edin`), "ileti ne yapmalı + nereye");
  ok(db().get("SELECT status FROM invoices WHERE id = ?", A.invoice.id).status === "issued", "veri tabanı: fatura iptal edilmedi");
  ok((await balance(A.c.id)) === -2576.45, `bakiye ${await balance(A.c.id)} (−2.576,45)`);
  await shot(page, "m2t3-3-avansli-iptal-reddi");
  await closeAll(page);

  console.log("\n■ 4 (tur 3) Değersiz'den sonra fatura tutarının Düzenle ile düşürülmesi reddedilir (S-M2T2-2 = A)");
  await page.evaluate(id => window.HOF.invoices.openDoc(id), D.invoice.id);
  await page.waitForSelector(`${inv} [data-act="modify"]:not([disabled]), ${inv} [data-act="edit"]:not([disabled])`, { timeout: 10000 });
  await page.click(`${inv} [data-act="modify"], ${inv} [data-act="edit"]`);
  const price = `${inv} [data-l="0"][data-f="unitPrice"]`;
  await page.waitForSelector(price, { timeout: 10000 });
  await page.click(price, { clickCount: 3 });
  await page.keyboard.press("Control+A");
  await page.keyboard.type("100", { delay: 90 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  await page.click(`${inv} [data-act="issue"]`);
  // Beklenen soru: VAR — ürünün Düzenle onayı "Değişiklikler Kaydedilsin mi?" (yeni tutar ₺100,00); kullanıcı gibi Evet denir, çünkü denenen sunucunun ret kararıdır (ders 34).
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 }).catch(() => null);
  const question = await textOf(page, top);
  ok(question.includes("Değişiklikler Kaydedilsin mi?") && question.includes("₺100,00"), `beklenen onay sorusu: "${question.slice(0, 160)}"`);
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForTimeout(1500);
  ok(!(await page.$(`${top} [data-answer="yes"]`)), "başka soru çıkmadı");
  const error4 = await textOf(page, `${inv} [data-form-error]`);
  ok(/^Fatura düzenlenemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; düzenlemeden sonra cari 2\.376,45 TL alacaklı \(eksi bakiye\) olurdu/.test(error4), `ileti ne oldu: "${error4.slice(0, 160)}"`);
  ok(error4.includes(`Ne yapmalı: önce Değersiz Alacak satırını silin (${WHERE}), sonra faturayı düzenleyin`), "ileti ne yapmalı + nereye");
  ok(Boolean(await page.$(price)), "form açık kalır");
  ok(Number(db().get("SELECT payable_total AS p FROM invoices WHERE id = ?", D.invoice.id).p) === 2900, "veri tabanı: fatura 2.900 kaldı");
  ok((await balance(D.c.id)) === 423.55, `bakiye ${await balance(D.c.id)} (423,55)`);
  await shot(page, "m2t3-4-duzenle-reddi");
  await closeAll(page);

  console.log("\n■ 5 Mutabakat Testi ve sayfa hataları");
  const integrity = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
  ok(integrity.ok === true, "Mutabakat Testi tamam");
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ senaryo kesildi: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await server.close();
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
