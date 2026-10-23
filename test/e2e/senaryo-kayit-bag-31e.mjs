// 2.4.4 31e B1–B3 ekranda: Excel "Yerine Koy" / "Devamı Olarak Ekle" önizlemesi kayda bağlı veriyi (tahsilat, not, "Ödendi Say") sessizce koparmaz.
// Arayüzden: Ayarlar → Veri → dosya seç → karar penceresi → onay penceresi; sonuç sunucudan sayılarla (anahtar, Takvim tutarı, satır sayısı) okunur.
// A) Ali'nin tutarı değişir + Ayşe silinir: Yerine Koy kartında "1 kaydın tahsilatı / notu aynı kişinin yeni satırına taşınır" ve "1 kaydın “Ödendi Say”
//    işareti bu yüklemeyle eşleşmedi: Ayşe Kaya."; onay metni kalkan kaydı ve eşleşmeyeni söyler (B2: "Notları ve geçmişi silinmez" yanıltıcı cümlesi yok).
// B) Devamı Olarak Ekle, Can'ın satırında başka kişi: "mevcut kaydın yerine geçmez; yeni kayıt" — Can durur.
// C) Devamı Olarak Ekle, Dosya No eklenmiş aynı dosya: "… satır mevcut kayıtlarla aynı görünüyor" + onay; Vazgeç → veri değişmez.
// Çalıştırma: npm run test:senaryo-kayit-bag-31e (ekran görüntüleri test/e2e/artifacts/kayit-bag-31e/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";
import { escClose } from "./esc-kapat.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "kayit-bag-31e");
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kayit-bag-31e-"));
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};
const iso = offset => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const PEOPLE = [["Ali Veli", 1000], ["Ayşe Kaya", 2000], ["Can Er", 3000], ["Deniz Ak", 4000]];
const file = (name, people, { dosya = false } = {}) => {
  const target = path.join(root, name);
  const columns = [...(dosya ? ["Dosya No"] : []), "Ad Soyad", "Tutar", "Son Ödeme"];
  const rows = people.map(([ad, tutar], index) => ({ ...(dosya ? { "Dosya No": `2026/${101 + index}` } : {}), "Ad Soyad": ad, Tutar: String(tutar), "Son Ödeme": day(-3) }));
  writeFileSync(target, buildXlsx([{ name: "Müşteriler", columns, rows }]));
  return target;
};
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f90" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" })).newPage();
const consoleErrors = [];
page.on("pageerror", error => consoleErrors.push(`pageerror ${error.message}`));
page.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me/.test(message.location().url || "")) consoleErrors.push(`${message.text()} @ ${message.location().url}`);
});
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`; // ders 39
const results = [];
let shots = 0;
const shot = async name => {
  shots += 1;
  await page.screenshot({ path: path.join(OUT, `${pad(shots)}-${name}.png`) });
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const api = (url, body, method = body ? "POST" : "GET") =>
  page.evaluate(async ([target, payload, verb]) => {
    const response = await fetch(target, { method: verb, headers: { "content-type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
    return { status: response.status, data: (await response.json().catch(() => ({}))).data };
  }, [url, body, method]);
const text = selector => page.$eval(selector, node => node.innerText.replace(/\s+/g, " ").trim());
const store = app.store || null;
const rows = () => app.store.all("SELECT case_key AS k, values_json AS v FROM dataset_rows ORDER BY position").map(row => ({ k: row.k, ...JSON.parse(row.v) }));
const keyOf = name => rows().filter(row => row["Ad Soyad"] === name).map(row => row.k);
// Yükleme sonrası "Akıllı Analiz — Veriniz hazır" penceresi insan gibi kapatılır (Tamam / Mevcut Görünümü Koru / Genel ile Devam Et), başka pencere Esc ile.
const closeModals = async () => {
  await page.waitForSelector(MODAL, { timeout: 6000 }).catch(() => {});
  for (let i = 0; i < 5 && (await page.$(MODAL)); i += 1) {
    const button = (await page.$(`${MODAL} [data-done]`)) || (await page.$(`${MODAL} [data-keep]`)) || (await page.$(`${MODAL} [data-general]`));
    if (button) await button.click();
    else await escClose(page, { step: "kayit-bag-31e yükleme sonrası" });
    await page.waitForTimeout(500);
  }
};
const settle = async () => {
  await page.waitForSelector(".sidebar #hof-sidecard", { timeout: 20000 });
  await closeModals();
  await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast").forEach(node => node.remove()));
};
const openDecision = async target => {
  await closeModals();
  await page.click("#hof-side-settings");
  await page.waitForSelector(`${MODAL} .hof-data-summary`);
  await (await page.$(".hof-modal .hof-drop input[type=file]")).setInputFiles(target);
  await page.waitForSelector(`${MODAL} .hof-choice-grid`, { timeout: 30000 });
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};

try {
  await step("Giriş, ilk Excel (4 kişi), kayda bağlı veri: Ali'ye 400 TL tahsilat + not, Ayşe'nin vadesine Ödendi Say", async () => {
    ok(Boolean(store), "sunucu veritabanı okunabilir");
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-start .hof-drop");
    await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(file("ilk.xlsx", PEOPLE));
    await page.waitForSelector(`${MODAL} .hof-mapping`, { timeout: 30000 });
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${MODAL} [data-mode="replace"]`)]);
    await settle();
    await api("/api/workspace/bank/setup/dismiss", {});
    const [ali] = keyOf("Ali Veli");
    ok((await api(`/api/workspace/cases/${encodeURIComponent(ali)}/payments`, { amount: 400, date: iso(-1), method: "cash", cashForce: true, caseTitle: "Ali Veli" })).status === 200, "Ali'ye kayıt tahsilatı (eski sürüm verisi gibi)");
    ok((await api(`/api/workspace/cases/${encodeURIComponent(ali)}/notes`, { note: "Ali arandı" })).status === 200, "Ali'ye not");
    const dues = (await api("/api/workspace/dues")).data.items;
    const ayse = dues.find(item => item.person === "Ayşe Kaya");
    ok(ayse && (await api("/api/workspace/dues/settle", { id: ayse.id })).status === 200, "Ayşe'nin kalemi Ödendi Say");
  });

  await step("A) Yerine Koy: Ali'nin tutarı 1.000 → 1.200, Ayşe dosyada yok — önizleme taşınanı ve eşleşmeyeni adıyla söyler", async () => {
    const before = keyOf("Ali Veli")[0];
    await openDecision(file("degisen.xlsx", PEOPLE.filter(([ad]) => ad !== "Ayşe Kaya").map(([ad, tutar]) => [ad, ad === "Ali Veli" ? 1200 : tutar])));
    const moved = await text(`${MODAL} [data-bond-moved="replace"]`);
    ok(moved === "1 kaydın tahsilatı / notu aynı kişinin yeni satırına taşınır.", `taşınan: ${moved}`);
    const unmatched = await text(`${MODAL} [data-bond-unmatched="replace"]`);
    ok(unmatched === "1 kaydın “Ödendi Say” işareti bu yüklemeyle eşleşmedi: Ayşe Kaya. Silinmez, eski kayıtta kalır ama yeni satırlarda görünmez.", `eşleşmeyen: ${unmatched}`);
    const card = await text(`${MODAL} .hof-choice:has([data-mode="replace"])`);
    ok(!/aynı dosya numarası tekrar gelirse yeniden bağlanır/.test(card), "eski yanıltıcı kart cümlesi yok");
    await shot("yerine-koy-onizleme");
    await page.click(`${MODAL} [data-mode="replace"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    const question = await text(`${TOP} .hof-modal-text`);
    ok(question === "Yeni dosyada olmayan 1 kayıt tablodan kalkacak. 1 kaydın “Ödendi Say” işareti bu yüklemeyle eşleşmedi: Ayşe Kaya. Bu bağlar silinmez, eski kayıtta kalır ama yeni satırlarda görünmez (ödemiş kişi Takvim'de ve raporlarda ödememiş görünür). İşlemden önce yedek alınır. Devam edilsin mi?", `onay metni: ${question}`);
    ok(!/Notları ve geçmişi silinmez/.test(question), "B2: yanıltıcı cümle yok");
    await shot("yerine-koy-onay");
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${TOP} [data-answer="yes"]`)]);
    await settle();
    const [ali] = keyOf("Ali Veli");
    ok(ali !== before, "ön koşul: Ali'nin anahtarı değişti");
    ok(app.store.get("SELECT case_key AS k FROM payments").k === ali, "tahsilat Ali'nin yeni satırında");
    ok(app.store.get("SELECT case_key AS k FROM notes").k === ali, "not Ali'nin yeni satırında");
    const takvim = (await api("/api/workspace/dues")).data.items.filter(item => item.person === "Ali Veli").map(item => item.amount);
    ok(JSON.stringify(takvim) === "[800]", `Takvim Ali 800 (1.200 − 400): ${JSON.stringify(takvim)}`);
  });

  await step("B) Devamı Olarak Ekle: Can'ın satırında başka kişi — mevcut kaydın yerine geçmez", async () => {
    await openDecision(file("farkli-kisi.xlsx", [["Ali Veli", 1200], ["Yeni Kişi", 5000], ["Deniz Ak", 4000]]));
    const note = await text(`${MODAL} [data-bond-different]`);
    ok(note === "Aynı satırda kişisi değişen 1 satır mevcut kaydın yerine geçmez; yeni kayıt olarak eklenir.", `not: ${note}`);
    const card = await text(`${MODAL} .hof-choice:has([data-mode="merge"])`);
    ok(/1 yeni kayıt eklenir/.test(card) && /Yeni dosyada olmayan 1 kayıt silinmez/.test(card), `kart: ${card}`);
    await shot("devami-farkli-kisi");
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${MODAL} [data-mode="merge"]`)]);
    await settle();
    ok(keyOf("Can Er").length === 1 && keyOf("Yeni Kişi").length === 1, `Can durur, Yeni Kişi eklenir: ${rows().map(row => row["Ad Soyad"]).join(", ")}`);
  });

  await step("C) Devamı Olarak Ekle: Dosya No eklenmiş aynı dosya — aynı görünen satırlar söylenir, onay ister; Vazgeç veriyi değiştirmez", async () => {
    const count = rows().length;
    await openDecision(file("dosyano.xlsx", [["Ali Veli", 1200], ["Can Er", 3000], ["Deniz Ak", 4000], ["Yeni Kişi", 5000]], { dosya: true }));
    const warning = await text(`${MODAL} [data-bond-duplicates]`);
    ok(/^4 satır mevcut kayıtlarla aynı görünüyor \(Ali Veli, Can Er, Deniz Ak, Yeni Kişi\); aynı dosyanın yenisiyse Yerine Koy kullanın\.$/.test(warning), `uyarı: ${warning}`);
    await shot("devami-ayni-gorunen");
    await page.click(`${MODAL} [data-mode="merge"]`);
    await page.waitForSelector(`${TOP} [data-answer="no"]`);
    const question = await text(`${TOP} .hof-modal-text`);
    ok(/Devamı Olarak Ekle bunları ikinci kez ekler\. İşlemden önce yedek alınır\. Devam edilsin mi\?$/.test(question), `onay metni: ${question}`);
    await shot("devami-onay");
    await page.click(`${TOP} [data-answer="no"]`);
    await page.waitForTimeout(500);
    ok(rows().length === count, `Vazgeç: satır sayısı ${count} kaldı`);
  });

  await step("Tarayıcı konsolu", async () => {
    ok(consoleErrors.length === 0, consoleErrors.length ? `konsol: ${consoleErrors.join(" | ")}` : "konsolda hata yok");
  });
} catch (error) {
  console.log(`\n${error.stack || error}`);
  await page.screenshot({ path: path.join(OUT, "HATA.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${results.filter(r => r.ok).length}/${results.length} denetim geçti`);
if (results.some(r => !r.ok)) process.exitCode = 1;
