// Gerçek kullanıcı senaryosu (v2.0.9): Exceli olmayan ofis — açılış ekranından sektöre uygun taslak Excel.
// Çalıştırma: npm run test:senaryo-taslak   (ekran görüntüleri test/e2e/artifacts/senaryo-taslak/ altına yazılır)
// Müşteri isteği: "açılışta Exceli yükle var ya, oraya 'Exceliniz yoksa sektörünüze uygun taslak Exceli indirin' yap".
//   A. Sıfır kurulum: açılış ekranında "Exceliniz yok mu?" kartı.
//   B. Taslak indirilir: sektör seçici açılır, "okul servisi" aranır, seçilir; dosya adı ve içi (başlıklar, açılır liste,
//      ay kolonları, sabit başlık satırı) denetlenir.
//   C. Kullanıcı taslağı doldurur (Excel'de yazar gibi: indirilen dosyanın kendisine satır eklenir; biçimler ve açılır
//      listeler korunur) ve aynı ekrandan yükler.
//   D. Program sektörü, kişiyi, telefonu, tutarı kendiliğinden tanır; ödenmemiş ay tahsilat takvimine ve Vade takibe
//      girer; ödenmiş ay ve ayrılmış öğrenci girmez.
//   E. Veri varken de taslak "Veri ve eşitleme" penceresinden indirilebilir.
import fs, { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { sectorTemplate } from "../../server/lib/insight/templates.mjs";
import { createZip, readZip } from "../../server/lib/zip.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-taslak");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const MACHINE = "a1b2c3d4e5f60718293a4b5c6d7e8f91";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-taslak-209-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: MACHINE } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
page.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me/.test(message.location().url || "")) errors.push(`${message.text()} @ ${message.location().url}`);
});
const results = [];
let n = 0;
const shot = async name => {
  n += 1;
  const file = path.join(OUT, `${String(n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const api = async url =>
  page.evaluate(async url => {
    const response = await fetch(url);
    const json = await response.json().catch(() => ({}));
    return { status: response.status, ...json };
  }, url);
const modal = ".hof-modal-backdrop.is-visible";
const topModal = () => page.evaluate(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1)?.innerText || "");
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const xmlText = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colName = index => {
  let name = "";
  for (let i = index + 1; i > 0; i = Math.floor((i - 1) / 26)) name = String.fromCharCode(65 + ((i - 1) % 26)) + name;
  return name;
};
// Excel'de satır yazmak gibi: indirilen dosyanın sayfasına satırlar eklenir, geri kalan her şey (biçimler, açılır
// listeler, sabit başlık) olduğu gibi kalır.
function fillWorkbook(buffer, headers, rows) {
  const entries = readZip(buffer);
  const sheet = entries.find(entry => entry.name === "xl/worksheets/sheet1.xml");
  const xml = sheet.data.toString("utf8");
  const body = rows
    .map((row, index) => {
      const r = index + 2;
      const cells = headers
        .map((header, column) => (row[header] === undefined || row[header] === "" ? "" : `<c r="${colName(column)}${r}" t="inlineStr"><is><t>${xmlText(row[header])}</t></is></c>`))
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  const filled = xml.replace("</sheetData>", `${body}</sheetData>`);
  return createZip(entries.map(entry => (entry === sheet ? { name: entry.name, data: Buffer.from(filled, "utf8") } : { name: entry.name, data: entry.data })));
}

try {
  await step("A. Sıfır kurulum: açılış ekranında taslak Excel kartı", async () => {
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-start .hof-start-template [data-template]", { timeout: 15000 });
    const card = await page.$eval("#hof-start .hof-start-template", node => node.innerText.replace(/\s+/g, " "));
    ok(/Exceliniz yok mu\?/.test(card) && /Sektörünüze uygun taslak Excel/i.test(card), "kart: “Exceliniz yok mu? Sektörünüze uygun taslak Excel'i indirin…”");
    ok(await page.isVisible("#hof-start .hof-drop"), "Excel yükleme alanı kartın üstünde (önce yükle, yoksa taslak)");
    const guide = await page.$eval("#hof-start .hof-start-guide", node => node.textContent.replace(/\s+/g, " "));
    ok(/Teknik Destek ve Satın Alımlar İçin: 0536 771 50 55/.test(guide), "açılışta destek hattı: Teknik Destek ve Satın Alımlar İçin: 0536 771 50 55");
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-license-text")].some(node => /0536 771 50 55/.test(node.textContent)), null, { timeout: 10000 });
    ok(!/0532 605 05 87/.test(await page.evaluate(() => document.body.textContent)), "lisans bildiriminde yeni hat; eski numara (0532) programda görünmez");
    await page.locator("#hof-start .hof-start-template").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200); // açılış animasyonu bitsin
    await shot("acilis-taslak-karti");
  });

  let downloaded;
  const template = sectorTemplate("okul-servisi");
  await step("B. Taslak indirilir: sektör seçilir, dosya adı ve içi doğru", async () => {
    await page.click("#hof-start .hof-start-template [data-template]");
    await page.waitForSelector(`${modal} .hof-picker input`, { timeout: 10000 });
    ok(/Taslak Excel: sektörünüzü seçin/.test(await topModal()), "sektör seçici açıldı (başlık: Taslak Excel)");
    await page.fill(`${modal} .hof-picker input`, "okul servis");
    await page.waitForSelector(`${modal} .hof-picker-option[data-id="okul-servisi"]`);
    await shot("taslak-sektor-secimi");
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click(`${modal} .hof-picker-option[data-id="okul-servisi"]`)]);
    ok(download.suggestedFilename() === "DestekOfis Taslak - Okul Servisi.xlsx", `dosya adı: ${download.suggestedFilename()}`);
    const file = path.join(root, download.suggestedFilename());
    await download.saveAs(file);
    downloaded = readFileSync(file);
    await page.waitForSelector(".hof-toast", { timeout: 5000 });
    ok(/Taslak Excel indirildi/.test(await page.$eval(".hof-toast", node => node.innerText)), "bildirim: “Taslak Excel indirildi. Satırları doldurup…”");
    const files = new Map(readZip(downloaded).map(entry => [entry.name, entry.data.toString("utf8")]));
    const sheet = files.get("xl/worksheets/sheet1.xml");
    const headerCells = [...sheet.matchAll(/<c r="([A-Z]+)1"[^>]*><is><t[^>]*>([^<]*)<\/t>/g)].map(match => match[2]);
    ok(headerCells.join("|") === template.columns.map(column => column.label).join("|"), `başlıklar: ${headerCells.slice(0, 9).join(", ")} …`);
    ok(/<sheet [^>]*name="Öğrenciler"/.test(files.get("xl/workbook.xml")), "sayfa adı: Öğrenciler");
    ok(/state="frozen"/.test(sheet), "başlık satırı sabit (aşağı kaydırınca görünür)");
    ok(/<formula1>"Aktif,Ayrıldı"<\/formula1>/.test(sheet), "Durum kolonu açılır liste: Aktif / Ayrıldı");
    ok(/promptTitle="Aylık Ücret"/.test(sheet), "başlığa tıklayınca ne yazılacağı görünür (Aylık Ücret notu)");
    ok(headerCells.includes(template.columns.find(column => column.kind === "month").label), `ay kolonları eğitim yılıyla: ${template.columns.filter(column => column.kind === "month").map(column => column.label).slice(0, 3).join(", ")} …`);
    ok(!/<row r="2"/.test(sheet), "veri satırı yok (örnek kişi yazılmaz; kullanıcının verisine karışmaz)");
  });

  const firstMonth = template.columns.find(column => column.kind === "month").label;
  const students = [
    { Öğrenci: "Ayşe Yılmaz", "Veli Adı": "Kemal Yılmaz", "Veli Telefon": "0532 410 10 10", Okul: "Atatürk İlkokulu", Sınıf: "3-A", Güzergâh: "Merkez", "Servis Plaka": "34 ABC 101", "Aylık Ücret": "2.500,00", [firstMonth]: "Ödendi", Durum: "Aktif" },
    { Öğrenci: "Mehmet Demir", "Veli Adı": "Selin Demir", "Veli Telefon": "0533 420 20 20", Okul: "Atatürk İlkokulu", Sınıf: "4-B", Güzergâh: "Merkez", "Servis Plaka": "34 ABC 101", "Aylık Ücret": "2.500,00", Durum: "Aktif" },
    { Öğrenci: "Zeynep Kaya", "Veli Adı": "Burak Kaya", "Veli Telefon": "0534 430 30 30", Okul: "Cumhuriyet Ortaokulu", Sınıf: "6-A", Güzergâh: "Sahil", "Servis Plaka": "34 XYZ 202", "Aylık Ücret": "3.000,00", [firstMonth]: "Ödendi", Durum: "Aktif" },
    { Öğrenci: "Ali Çelik", "Veli Adı": "Derya Çelik", "Veli Telefon": "0535 440 40 40", Okul: "Cumhuriyet Ortaokulu", Sınıf: "7-C", Güzergâh: "Sahil", "Servis Plaka": "34 XYZ 202", "Aylık Ücret": "3.000,00", Durum: "Aktif" },
    { Öğrenci: "Elif Şahin", "Veli Adı": "Murat Şahin", "Veli Telefon": "0536 450 50 50", Okul: "Atatürk İlkokulu", Sınıf: "2-A", Güzergâh: "Merkez", "Servis Plaka": "34 ABC 101", "Aylık Ücret": "2.500,00", Durum: "Ayrıldı", Not: "Ekim'de taşındı" },
  ];

  await step("C. Taslak doldurulur ve açılış ekranından yüklenir", async () => {
    const filled = fillWorkbook(downloaded, template.columns.map(column => column.label), students);
    const file = path.join(root, "Okul servisi (dolduruldu).xlsx");
    writeFileSync(file, filled);
    const input = await page.$("#hof-start .hof-drop input[type=file]");
    await input.setInputFiles(file);
    await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    const mapping = await topModal();
    ok(/Öğrenci/.test(mapping) && /Veli Telefon/.test(mapping) && /Aylık Ücret/.test(mapping), "ön izleme: taslağın kolonları okundu");
    await shot("taslak-yukleme-onizleme");
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
    await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    const result = await page.$eval(".hof-analysis-result", node => node.textContent.replace(/\s+/g, " "));
    ok(/Önerilen sektör/.test(result) && /Okul servisi/i.test(result), "program sektörü kendiliğinden önerir: Okul servisi");
    await shot("taslak-sektor-onerisi");
    await page.click(".hof-analysis-result [data-apply]");
    await page.waitForTimeout(1500);
    const profile = (await api("/api/workspace/profile")).data;
    ok(profile.sector?.id === "okul-servisi", `sektör uygulandı: ${profile.sector?.name}`);
  });

  await step("D. Kişi, telefon, tutar tanındı; ödenmeyen ay takvimde ve Vade takipte", async () => {
    const insight = (await api("/api/workspace/insight")).data.analysis;
    const role = label => insight.columns.find(column => column.column === label)?.role;
    ok(insight.rowCount === students.length, `${insight.rowCount} öğrenci okundu (boş şablon satırı sayılmadı)`);
    ok(role("Öğrenci") === "person" && role("Veli Telefon") === "phone" && role("Aylık Ücret") === "money", "Öğrenci = kişi, Veli Telefon = telefon, Aylık Ücret = tutar");
    const dues = (await api("/api/workspace/dues")).data.items;
    const first = dues.filter(item => item.label === firstMonth || item.column === firstMonth);
    const people = first.map(item => item.person).sort((a, b) => a.localeCompare(b, "tr"));
    ok(people.join(", ") === "Ali Çelik, Mehmet Demir", `${firstMonth}: yalnız ödemeyen aktif öğrenciler takvimde (${people.join(", ")})`);
    ok(first.every(item => item.amount === (item.person === "Ali Çelik" ? 3000 : 2500)), "tutar Aylık Ücret kolonundan (3.000 / 2.500)");
    ok(!dues.some(item => item.person === "Elif Şahin"), "ayrılan öğrenci (Durum: Ayrıldı) takvime girmez");
    ok(!first.some(item => item.person === "Ayşe Yılmaz" || item.person === "Zeynep Kaya"), `“Ödendi” yazılan ${firstMonth} takvime girmez`);
    const vade = (await api("/api/workspace/overview/vade-takip?preset=open&sources=table")).data;
    const vadeFirst = vade.rows.filter(row => row.label.startsWith(`${firstMonth.split(" ")[0]} ödemesi`) && row.state === "month");
    ok(vadeFirst.length === 2 && vadeFirst.reduce((sum, row) => sum + row.amount, 0) === 5500, `Vade takip (tablo): “${firstMonth.split(" ")[0]} ödemesi” 2 kalem, 5.500,00, durum “bu ay” (gecikmiş değil)`);
    ok(vade.rows.find(row => row.party === "Mehmet Demir")?.phone === "0533 420 20 20", "Vade takipte veli telefonu (telefonla aranabilir)");
    await page.click('.hof-side-item[data-action="analytics"]');
    await page.waitForSelector(`${modal} .hof-rep .hof-rep-tabs`, { timeout: 10000 });
    await page.click(`${modal} .hof-rep [data-tab="vade"]`);
    await page.waitForSelector(`${modal} .hof-rep-vade tbody tr[data-due-row]`, { timeout: 15000 });
    const table = await page.$eval(`${modal} .hof-rep-vade tbody`, node => node.innerText);
    ok(/Mehmet Demir/.test(table) && /Ali Çelik/.test(table) && !/Elif Şahin/.test(table), "Raporlar › Vade takip ekranında ödemeyenler var, ayrılan yok");
    await shot("taslak-vade-takip");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  await step("E. Veri varken: Veri ve eşitleme penceresinden de taslak indirilir", async () => {
    await page.evaluate(() => HOF.sources.openDataSettings());
    await page.waitForSelector(`${modal} .hof-start-template [data-template]`, { timeout: 10000 });
    await page.click(`${modal} .hof-start-template [data-template]`);
    await page.waitForSelector(`${modal} .hof-picker input`, { timeout: 10000 });
    const suggested = await page.$eval(`${modal} .hof-picker-option.is-suggested`, node => node.textContent.replace(/\s+/g, " "));
    ok(/Okul servisi/i.test(suggested) && /Önerilen/.test(suggested), "seçicide mevcut sektör (Okul servisi) “Önerilen” olarak başta");
    await shot("veri-ayarlari-taslak-secici");
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click(`${modal} .hof-picker-option.is-suggested`)]);
    ok(download.suggestedFilename() === "DestekOfis Taslak - Okul Servisi.xlsx", "önerilen sektörün taslağı indi");
    ok((await api("/api/workspace/insight")).data.analysis.rowCount === students.length, "taslak indirmek mevcut veriye dokunmaz");
    ok(errors.length === 0, `tarayıcı hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  });
} catch (error) {
  console.error(error);
  await shot("hata").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  const passed = results.filter(item => item.ok).length;
  if (results.some(item => !item.ok)) process.exitCode = 1;
  console.log(`\n${process.exitCode ? "SENARYO BAŞARISIZ — " : ""}${passed}/${results.length} denetim geçti. Ekran görüntüleri: ${OUT}`);
}
