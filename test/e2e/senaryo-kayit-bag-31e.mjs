// 2.4.4 31e B1–B3 ekranda: Excel "Yerine Koy" / "Devamı Olarak Ekle" önizlemesi kayda bağlı veriyi (tahsilat, not, "Ödendi Say") sessizce koparmaz.
// Arayüzden: Ayarlar → Veri → dosya seç → karar penceresi → onay penceresi; sonuç sunucudan sayılarla (anahtar, Takvim tutarı, satır sayısı) okunur.
// A) Ali'nin tutarı değişir + Ayşe silinir: Yerine Koy kartında "1 kaydın tahsilatı / notu aynı kişinin yeni satırına taşınır" ve "1 kaydın “Ödendi Say”
//    işareti bu yüklemeyle eşleşmedi: Ayşe Kaya."; onay metni kalkan kaydı ve eşleşmeyeni söyler (B2: "Notları ve geçmişi silinmez" yanıltıcı cümlesi yok).
// B) Devamı Olarak Ekle, Can'ın satırında başka kişi: "mevcut kaydın yerine geçmez; yeni kayıt" — Can durur.
// C) Devamı Olarak Ekle, Dosya No eklenmiş aynı dosya: "… satır mevcut kayıtlarla aynı görünüyor" + onay; Vazgeç → veri değişmez.
// Tur 7 N5 (kayıt kaldıran her yol bağları adıyla söyler, onay ister): D) Veriyi Kaldır — ikinci soru "1 kaydın tahsilatı / notu kaldırılacak satırlarda:
//    Ali Veli."; Vazgeç → veri durur; onay → kalkar, tahsilat ve not silinmez. E) Google Sheets: Sheet'te olmayan satır listede "Bağlı: not"; Seçilenleri
//    Kaldır adıyla sorar. F) Sayfayı Sil: yalnız o sayfada olan kaydın notu adıyla söylenir.
// Çalıştırma: npm run test:senaryo-kayit-bag-31e (ekran görüntüleri test/e2e/artifacts/kayit-bag-31e/).
// 2.4.5 madde 4 (uyarı kapısı): bu senaryo tablonun ödeme kalemlerini (şerit / zil / takvim) kullanan 2.4.4 yolunu sınar — üründe kapalı; sunucu
// legacyTableDues (yalnız testler) ile 2.4.4 davranışında açılır. Ürünün kapısı test/e2e/run.mjs "2.4.5 uyarı kapısı" ve test/kapi-uyari-245.test.mjs.
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
// E adımı: bağlı Google Sheets yerine sahte yanıt (ağ yok); CSV adım içinde değişir.
const sheet = { csv: "" };
const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<script>"gid":"0","name":"Müşteriler"</script>') : new Response(sheet.csv, { headers: { "content-type": "text/csv" } }));
// 2.4.5 madde 1: kayıt tahsilatı programda kapalı (410); bu senaryo eski sürümden gelen kayıt tahsilatını API'den üretir → anahtar açık (üretimde yok).
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, fetchImpl, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f90" }, legacyCasePayments: true, legacyTableDues: true });
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

  await step("D) Veriyi Kaldır: Ali'nin tahsilatı ve notu var — ikinci soru adıyla söyler; Vazgeç veriyi bırakır, onay kaldırır, bağlar silinmez", async () => {
    const count = rows().length;
    const [ali] = keyOf("Ali Veli");
    const openRemove = async () => {
      await closeModals();
      await page.click("#hof-side-settings");
      await page.waitForSelector(`${MODAL} [data-remove]`);
      await page.click(`${MODAL} [data-remove]`);
      await page.waitForSelector(`${TOP} [data-answer="yes"]`);
      ok(/kayıt tüm bilgisayarlarda tablodan kalkacak/.test(await text(`${TOP} .hof-modal-text`)), "ilk soru (genel)");
      await page.click(`${TOP} [data-answer="yes"]`);
      await page.waitForFunction(() => /kaldırılacak satırlarda/.test([...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-text")].map(node => node.textContent).join(" ")), null, { timeout: 15000 });
      await page.waitForSelector(`${TOP} [data-answer="no"]`);
    };
    await openRemove();
    const question = await text(`${TOP} .hof-modal-text`);
    ok(question === "1 kaydın tahsilatı / notu kaldırılacak satırlarda: Ali Veli. Bu bağlar silinmez, eski kayıtta kalır ama tabloda ve raporlarda bu kayıtlarla görünmez. İşlemden önce yedek alınır. Devam edilsin mi?", `ikinci soru: ${question}`);
    await shot("veriyi-kaldir-bag-sorusu");
    await page.click(`${TOP} [data-answer="no"]`);
    await page.waitForTimeout(600);
    ok(rows().length === count, `Vazgeç: satır sayısı ${count} kaldı`);
    await openRemove();
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${TOP} [data-answer="yes"]`)]);
    ok(rows().length === 0, "onayla veri kaldırıldı");
    ok(app.store.get("SELECT case_key AS k FROM payments").k === ali && app.store.get("SELECT case_key AS k FROM notes").k === ali, "tahsilat ve not silinmedi (eski anahtarda)");
    ok(Boolean(app.store.get("SELECT 1 AS x FROM audit_events WHERE type = 'dataset.bonds.unmatched' AND payload_json LIKE '%dataset-remove%'")), "onaylanan kopma işlem geçmişinde");
  });

  await step("E) Google Sheets: Sheet'te olmayan satır listede “Bağlı: not”; Seçilenleri Kaldır adıyla sorar, onayla kaldırır", async () => {
    const head = "Ad Soyad,Tutar,Son Ödeme";
    sheet.csv = [head, `Kemal Er,100,${day(-3)}`, `Lale Ak,200,${day(-3)}`, `Mert Su,300,${day(-3)}`].join("\n");
    const staged = await api("/api/workspace/dataset/stage", { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/E2E31E/edit" });
    ok(staged.status === 200, `Sheet önizlemesi: ${staged.status}`);
    ok((await api("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace", link: true })).status === 200, "Sheet bağlandı");
    const [lale] = keyOf("Lale Ak");
    ok((await api(`/api/workspace/cases/${encodeURIComponent(lale)}/notes`, { note: "Lale arandı" })).status === 200, "Lale'ye not");
    sheet.csv = [head, `Kemal Er,100,${day(-3)}`].join("\n");
    const synced = await api("/api/workspace/dataset/sync", {});
    ok(synced.status === 200 && synced.data.counts?.missing === 2, `eşitleme: Lale ve Mert Sheet'te yok (${JSON.stringify(synced.data?.counts)})`);
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await settle();
    await page.click("#hof-side-settings");
    await page.waitForSelector(`${MODAL} [data-missing]`);
    await page.click(`${MODAL} [data-missing]`);
    await page.waitForSelector(`${TOP} .hof-missing-list`);
    const bonds = await page.$$eval(`${TOP} [data-missing-bonds]`, nodes => nodes.map(node => node.closest("li").innerText.replace(/\s+/g, " ").trim()));
    ok(bonds.length === 1 && /Lale Ak/.test(bonds[0]) && /Bağlı: not$/.test(bonds[0]), `listede yalnız Lale "Bağlı: not": ${JSON.stringify(bonds)}`);
    await shot("sheette-yok-bagli");
    await page.click(`${TOP} [data-action="remove"]`);
    await page.waitForFunction(() => /kaldırılacak satırlarda/.test([...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-text")].map(node => node.textContent).join(" ")), null, { timeout: 15000 });
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    const question = await text(`${TOP} .hof-modal-text`);
    ok(question === "1 kaydın notu kaldırılacak satırlarda: Lale Ak. Bu bağlar silinmez, eski kayıtta kalır ama tabloda ve raporlarda bu kayıtlarla görünmez. İşlemden önce yedek alınır. Devam edilsin mi?", `soru: ${question}`);
    await shot("sheette-yok-kaldir-sorusu");
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForFunction(() => !document.querySelector(".hof-missing-list"), null, { timeout: 15000 });
    ok(rows().length === 1 && keyOf("Kemal Er").length === 1, `onayla Lale ve Mert kalktı: ${rows().map(row => row["Ad Soyad"]).join(", ")}`);
    ok(app.store.get("SELECT case_key AS k FROM notes WHERE note = 'Lale arandı'").k === lale, "Lale'nin notu silinmedi");
  });

  await step("F) Sayfayı Sil: yalnız o sayfada olan kaydın notu adıyla söylenir; onayla sayfa silinir, not kalır", async () => {
    const staged = await api("/api/workspace/dataset/stage", { kind: "excel", fileName: "ikinci.xlsx", sheets: [{ name: "Liste", matrix: [["Ad Soyad", "Tutar", "Son Ödeme"], ["Gizem Ak", "700", day(-3)]] }] });
    ok(staged.status === 200, "ikinci sayfa önizlemesi");
    const opened = await api("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "session", name: "İkinci Sayfa" });
    ok(opened.status === 200, `ikinci sayfa açıldı: ${opened.status}`);
    const second = opened.data.session.key;
    const gizem = app.store.get("SELECT case_key AS k FROM dataset_rows WHERE dataset_key = ?", second).k;
    // Pencere hâlâ ilk sayfayı gösteriyor (istekler pencerenin sayfasıyla gider); yeniden açılınca yeni sayfa açılır, not o sayfanın kaydına yazılır.
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await settle();
    const noted = await api(`/api/workspace/cases/${encodeURIComponent(gizem)}/notes`, { note: "Gizem notu" });
    ok(noted.status === 200, `Gizem'e not (yeni sayfanın penceresinden): ${noted.status}`);
    await page.waitForSelector("#hof-pages .hof-page.is-current [data-remove-page]");
    await page.click("#hof-pages .hof-page.is-current [data-remove-page]");
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    ok(/İkinci Sayfa/.test(await text(`${TOP} .hof-modal-text`)), "ilk soru sayfa adını söyler");
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForFunction(() => /kaldırılacak satırlarda/.test([...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-text")].map(node => node.textContent).join(" ")), null, { timeout: 15000 });
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    const question = await text(`${TOP} .hof-modal-text`);
    ok(question === "1 kaydın notu kaldırılacak satırlarda: Gizem Ak. Bu bağlar silinmez, eski kayıtta kalır ama tabloda ve raporlarda bu kayıtlarla görünmez. Devam edilsin mi?", `ikinci soru: ${question}`);
    await shot("sayfayi-sil-bag-sorusu");
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${TOP} [data-answer="yes"]`)]);
    ok(app.store.get("SELECT COUNT(*) AS n FROM dataset_rows WHERE dataset_key = ?", second).n === 0, "sayfa silindi");
    ok(app.store.get("SELECT case_key AS k FROM notes WHERE note = 'Gizem notu'").k === gizem, "Gizem'in notu silinmedi");
  });

  await step("Tarayıcı konsolu", async () => {
    // D/E/F: kayıt kaldıran isteğin 409 bonds-unmatched yanıtı beklenen sorudur (ekran adlarıyla sorar, onayla yeniden gönderir; Kasa eksiye düşecek
    // sorusu gibi — run.mjs). Yalnız bu üç adresin 409'u ve tam beklenen sayıda (Veriyi Kaldır 2, Seçilenleri Kaldır 1, Sayfayı Sil 1) hata sayılmaz.
    const EXPECTED = /status of 409 \(Conflict\) @ \S+\/api\/workspace\/(dataset|dataset\/missing|sessions\/delete)\?/;
    const expected = consoleErrors.filter(item => EXPECTED.test(item));
    const other = consoleErrors.filter(item => !EXPECTED.test(item));
    ok(expected.length === 4, `beklenen 4 soru yanıtı (409): ${expected.length}`);
    ok(other.length === 0, other.length ? `konsol: ${other.join(" | ")}` : "konsolda başka hata yok");
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
