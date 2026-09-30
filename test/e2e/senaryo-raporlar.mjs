// Gerçek kullanıcı senaryosu (v2.0.9): Raporlar penceresi — cari, kasa, taksit, çek/senet ve tablodan gelen raporlar.
// Çalıştırma: npm run test:senaryo-rapor   (ekran görüntüleri test/e2e/artifacts/senaryo-rapor/ altına yazılır)
// Müşteri şikâyeti: "soldaki Raporlar cariye bağlı değil, boş geliyor". Senaryo sıfır kurulumdan başlar:
//   A. Boş veri: Raporlar sol menüden açılır; Cari ekstre boş durumda ne yapılacağını söyler (Cari'ye / Tablodan cari).
//   B. Excel yüklenir (okul servisi); arayüzden cariler, taksit kartı, alınan/verilen çek, ileri tarihli kira girilir;
//      aynı adlı iki cari açılır.
//   C. Raporlar: mizan = Cari listesi bakiyeleri; ekstre = Cari kartındaki defter; Vade takip = taksit + çek + Kasa +
//      tablo (takvimle aynı); Nakit akış = bugünkü kasa + beklenenler; Tablo raporları sekmesi taşmadan açılır.
//   D. Yetki: personel Raporlar'ı görmez (API 403); uzman (avukat) Vade takip, Tablo raporları ve (v2.0.10) Tüm raporlar'da yalnız İşlem geçmişi'ni görür.
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { okulServisiXlsx } from "../fixtures/okul-servisi-ornek.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-rapor");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const MACHINE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-prova-209-"));
const excel = path.join(root, "okul-servisi-ornek.xlsx");
writeFileSync(excel, okulServisiXlsx());
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: MACHINE } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
page.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me/.test(message.location().url || "")) errors.push(`${message.text()} @ ${message.location().url}`);
});
const results = [];
let n = 0;
const shot = async (name, target = page) => {
  n += 1;
  const file = path.join(OUT, `${String(n).padStart(2, "0")}-${name}.png`);
  await target.screenshot({ path: file });
  return file;
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const api = async (url, body, method = body ? "POST" : "GET", on = page) =>
  on.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ...json };
    },
    [url, body, method],
  );
const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const round = value => Math.round(value * 100) / 100;
const text = (selector, on = page) => on.$eval(selector, node => node.innerText.replace(/\s+/g, " ").trim());
const modal = ".hof-modal-backdrop.is-visible";
const closeTop = async (on = page) => {
  await on.keyboard.press("Escape");
  await on.waitForTimeout(250);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const local = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const TODAY = local(0);
const openReports = async (on = page) => {
  await on.click('.hof-side-item[data-action="analytics"]');
  await on.waitForSelector(`${modal} .hof-rep .hof-rep-tabs`, { timeout: 10000 });
};
const tab = async (id, on = page) => {
  await on.click(`${modal} .hof-rep [data-tab="${id}"]`);
};
const login = async (on, username, password) => {
  await on.goto(`${BASE}/`);
  await on.fill("#hof-auth input[name=username]", username);
  await on.fill("#hof-auth input[name=password]", password);
  await Promise.all([on.waitForEvent("load"), on.click('#hof-auth button[type="submit"]')]);
};

try {
  await step("A. Boş veri: sol menüden Raporlar (cari yok)", async () => {
    await login(page, "admin", PASS);
    await page.waitForSelector("#hof-start .hof-drop");
    ok(await page.isVisible('.hof-side-item[data-action="analytics"]'), "sol menüde Raporlar görünür (yönetici)");
    await openReports();
    const tabs = await page.$$eval(`${modal} .hof-rep [data-tab]`, nodes => nodes.map(node => node.textContent.trim()));
    ok(tabs.join("|") === "Cari Ekstre|Vade Takip|Nakit Akış|Çek / Senet|Tüm Raporlar|Tablo Raporları", `sekmeler: ${tabs.join(", ")}`);
    await page.waitForSelector(`${modal} .hof-rep-help`, { timeout: 10000 });
    const help = await text(`${modal} .hof-rep-help`);
    ok(/Cari defterindeki hareketlerden/.test(help) && /Cari ekranını aç/i.test(help), "boş defterde yol gösterir: Cari ekranını aç");
    await shot("bos-veri-cari-ekstre");
    await tab("vade");
    await page.waitForSelector(`${modal} .hof-rep-vade`, { timeout: 10000 });
    ok(/açık kalem yok/.test(await text(`${modal} .hof-rep-vade tbody`)), "Vade takip boş: açıklayıcı satır");
    await closeTop();
  });

  await step("B1. Excel yüklenir (okul servisi, aylık ücret ve ödeme sözleri)", async () => {
    const input = await page.$("#hof-start .hof-drop input[type=file]");
    await input.setInputFiles(excel);
    await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
    await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await page.click(".hof-analysis-result [data-apply]");
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast").forEach(node => node.remove()));
    const dues = await api("/api/workspace/dues");
    ok(dues.data.items.length > 0, `tablo takvimi: ${dues.data.items.length} kalem`);
  });

  await step("B1b. Excel var, cari yok (müşterinin durumu): Cari ekstre tablodaki kişileri cari yapma yolunu gösterir", async () => {
    await page.reload();
    await page.waitForSelector('.hof-side-item[data-action="analytics"]');
    await openReports();
    await page.waitForSelector(`${modal} .hof-rep-help [data-go="fromTable"]`, { timeout: 10000 });
    ok(/Tablodaki kişileri cari yap/i.test(await text(`${modal} .hof-rep-help`)), "boş defter + dolu tablo: “Tablodaki kişileri cari yap” düğmesi");
    await shot("excel-var-cari-yok");
    await page.click(`${modal} .hof-rep-help [data-go="fromTable"]`);
    await page.waitForFunction(() => /Tablodan cari al/i.test([...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1)?.innerText || ""), null, { timeout: 15000 });
    ok(true, "düğme “Tablodan cari al: kolonları eşle” penceresini açar (her cari kaydına bağlanır)");
    await closeTop();
    ok((await api("/api/workspace/accounts?status=all")).data.accounts.length === 0, "pencere kapatılınca hiçbir cari açılmadı (kullanıcı onayı olmadan kayıt yok)");
  });

  let ahmet1;
  let ahmet2;
  let tedarik;
  let plan;
  await step("B2. Cari, taksit, çek/senet, ileri tarihli Kasa (aynı adlı iki cari)", async () => {
    const a1 = await api("/api/workspace/accounts", { name: "Ahmet Yılmaz", type: "customer", phone: "0532 111 22 33", openingBalance: "5000", registeredOn: local(-400) });
    const a2 = await api("/api/workspace/accounts", { name: "Ahmet Yılmaz", type: "customer", phone: "0544 999 88 77" });
    const t = await api("/api/workspace/accounts", { name: "Tedarik Ltd.", type: "supplier", phone: "0312 555 00 00" });
    ok(a1.status === 200 && a2.status === 200 && t.status === 200, "üç cari açıldı (ikisi aynı adla, farklı telefon)");
    ahmet1 = a1.data;
    ahmet2 = a2.data;
    tedarik = t.data;
    ok(ahmet1.refNo !== ahmet2.refNo, `aynı adlı iki cari ayrı numara aldı: ${ahmet1.refNo} / ${ahmet2.refNo}`);
    // Ahmet 1: açılış 5000 borç (400 gün önce); bugün 1500 tahsilat (Kasa'ya girer).
    ok((await api(`/api/workspace/accounts/${ahmet1.id}/entries`, { kind: "in", amount: "1500", date: TODAY, note: "Nakit tahsilat" })).status === 200, "Ahmet (1): 1.500 tahsilat");
    // Tedarikçi: 2000 alacak (fatura: biz borçluyuz); 500 ödeme (Kasa'dan çıkar).
    ok((await api(`/api/workspace/accounts/${tedarik.id}/entries`, { kind: "credit", amount: "2000", date: local(-10), note: "Fatura 2026/77" })).status === 200, "Tedarik: 2.000 fatura (alacak)");
    ok((await api(`/api/workspace/accounts/${tedarik.id}/entries`, { kind: "out", amount: "500", date: local(-5), note: "Kısmi ödeme" })).status === 200, "Tedarik: 500 ödeme");
    // Ahmet 2: 3 taksitli kart (ilk taksit 20 gün önce: gecikmiş).
    const p = await api("/api/workspace/plans", { name: "Ahmet Yılmaz", accountId: ahmet2.id, total: "3000", mode: "auto", count: 3, firstDue: local(-20), everyMonths: 1 });
    ok(p.status === 200, "Ahmet (2): 3.000 / 3 taksit kartı");
    plan = p.data;
    // Çekler: alınan (Ahmet 1, +10 gün), verilen (Tedarik, +20 gün); senet alınan (Ahmet 2, +45 gün).
    ok((await api("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1000", dueDate: local(10), accountId: ahmet1.id, serialNo: "A-1001", bank: "Ziraat" })).status === 200, "alınan çek 1.000 (+10 gün)");
    ok((await api("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "800", dueDate: local(20), accountId: tedarik.id, serialNo: "V-2001", bank: "Halkbank" })).status === 200, "verilen çek 800 (+20 gün)");
    ok((await api("/api/workspace/cheques", { direction: "in", instrument: "note", amount: "700", dueDate: local(45), accountId: ahmet2.id, serialNo: "S-3001" })).status === 200, "alınan senet 700 (+45 gün)");
    // Kasa: ileri tarihli kira (+15 gün) ve bugünkü elle giriş.
    ok((await api("/api/workspace/cash", { kind: "out", amount: "4000", date: local(15), description: "Ofis kirası" })).status === 200, "ileri tarihli kira 4.000 (+15 gün)");
    ok((await api("/api/workspace/cash", { kind: "in", amount: "250", date: TODAY, description: "Danışmanlık" })).status === 200, "bugün Kasa girişi 250");
  });

  await step("C1. Cari ekstre: mizan bakiyeleri = Cari listesi; ekstre = Cari kartı", async () => {
    await page.reload();
    await page.waitForSelector('.hof-side-item[data-action="analytics"]');
    await openReports();
    await page.click(`${modal} .hof-rep [data-preset="all"]`);
    await page.waitForSelector(`${modal} .hof-rep-mizan tbody tr[data-account-row]`, { timeout: 10000 });
    const rows = await page.$$eval(`${modal} .hof-rep-mizan tbody tr[data-account-row]`, nodes => nodes.map(node => ({ id: node.dataset.accountRow, text: node.innerText.replace(/\s+/g, " ") })));
    ok(rows.length === 3, `mizanda 3 cari (tüm zamanlar): ${rows.map(row => row.text.slice(0, 40)).join(" | ")}`);
    const list = (await api("/api/workspace/accounts?status=all&limit=50")).data;
    for (const account of list.accounts) {
      const row = rows.find(item => item.id === account.id);
      ok(row && row.text.includes(money(Math.abs(account.balance))), `mizan bakiyesi = Cari listesi: ${account.name} ${account.refNo} → ${money(account.balance)}`);
    }
    ok(rows.filter(row => /Ahmet Yılmaz/.test(row.text)).length === 2, "aynı adlı iki cari mizanda ayrı satır");
    await shot("cari-ekstre-mizan");
    // Ahmet (1): ekstre devir 0, açılış 5000 borç, alınan çek 1000 alacak, tahsilat 1500 → bakiye 2500 borçlu.
    await page.click(`${modal} tr[data-account-row="${ahmet1.id}"]`);
    await page.waitForSelector(`${modal} .hof-rep-crumb [data-open-account]`, { timeout: 10000 });
    const detail = (await api(`/api/workspace/accounts/${ahmet1.id}`)).data;
    const statement = await text(`${modal} .hof-rep-table tbody`);
    ok(/Açılış bakiyesi/i.test(statement) && /Nakit tahsilat/i.test(statement) && /Çek/.test(statement), "ekstre satırları: açılış, çek, tahsilat");
    ok(detail.totals.balance === 2500 && (await text(`${modal} .hof-rep-stats`)).includes(money(2500)), `ekstre dönem sonu = Cari kartı bakiyesi: ${money(detail.totals.balance)}`);
    await shot("cari-ekstre-ahmet");
    await page.click(`${modal} .hof-rep-crumb [data-open-account]`);
    await page.waitForFunction(() => /Ahmet Yılmaz/.test(document.querySelector(".hof-modal-backdrop.is-visible:last-of-type")?.innerText || ""), null, { timeout: 10000 });
    ok(true, "“Cari kartını aç” cari kartını açar");
    await closeTop();
    // Telefonla arama: aynı adlı ikinciyi bulur.
    await page.click(`${modal} [data-back]`);
    await page.waitForSelector(`${modal} [data-q]`);
    await page.fill(`${modal} [data-q]`, "0544 999");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-mizan tbody tr[data-account-row]").length === 1, null, { timeout: 10000 });
    ok((await page.$eval(`${modal} .hof-rep-mizan tbody tr[data-account-row]`, node => node.dataset.accountRow)) === ahmet2.id, "telefonla arama: 0544 999 → Ahmet Yılmaz (2)");
    await page.fill(`${modal} [data-q]`, "");
    await page.keyboard.press("Enter");
  });

  await step("C2. Vade takip: taksit + çek/senet + ileri tarihli Kasa + tablo; kaynağa git", async () => {
    await tab("vade");
    await page.waitForSelector(`${modal} .hof-rep-vade tbody tr[data-due-row]`, { timeout: 15000 });
    const data = (await api("/api/workspace/overview/vade-takip?preset=next30")).data;
    const sources = new Set(data.rows.map(row => row.source));
    ok(["plan", "cheque", "cash", "table"].every(source => sources.has(source)), `kaynaklar: ${[...sources].join(", ")}`);
    const overduePlan = data.rows.find(row => row.source === "plan" && row.state === "overdue");
    ok(overduePlan && overduePlan.amount === 1000, "gecikmiş taksit (20 gün önce) 1.000 başta");
    ok(!data.rows.some(row => row.source === "note"), "45 gün sonraki senet 30 günlük aralıkta yok");
    const inTotal = round(data.rows.filter(row => row.direction === "in" && row.amount !== null).reduce((sum, row) => sum + row.amount, 0));
    ok(data.totals.in.total.amount === inTotal, `tahsil edilecek toplamı satırların toplamı: ${money(inTotal)}`);
    ok(data.totals.out.total.amount === 4800, `ödenecek: kira 4.000 + verilen çek 800 = ${money(data.totals.out.total.amount)}`);
    // Tablo kalemleri takvimle aynı: takvimdeki her tablo kalemi (gecikmiş, bu ay, 7 gün) raporda aynı tarih, tutar ve
    // durumla var; "bu ay" kalemi gecikmiş sayılmaz.
    const calendar = (await api("/api/workspace/dues")).data.items.filter(item => !item.source && item.amount > 0);
    const open = (await api("/api/workspace/overview/vade-takip?preset=open")).data.rows.filter(row => row.source === "table" || row.source === "promise");
    ok(calendar.length > 0 && calendar.every(item => open.some(row => row.date === item.due && row.amount === item.amount && (item.state === "month" ? row.state === "month" : item.state === "overdue" ? row.state === "overdue" : true))), `takvimdeki ${calendar.length} tablo kalemi raporda aynı tarih/tutar/durumla (${open.length} tablo satırı)`);
    ok(open.length === calendar.length, `tablo kalem sayısı takvimle aynı: ${open.length}`);
    await shot("vade-takip");
    // Telefonla arama: carinin telefonu çek/senedi, tablodaki telefon tablo kalemini bulur.
    const visibleRows = () => page.$$eval(`${modal} .hof-rep-vade tbody tr[data-due-row]`, nodes => nodes.map(node => node.textContent));
    await page.fill(`${modal} [data-q]`, "0312 555");
    await page.press(`${modal} [data-q]`, "Enter");
    await page.waitForFunction(() => { const rows = [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade tbody tr[data-due-row]")]; return rows.length === 1 && /Tedarik/.test(rows[0].textContent); }, null, { timeout: 10000 });
    ok(true, "telefonla arama: 0312 555 → yalnız Tedarik Ltd.'nin verilen çeki");
    const tableRow = data.rows.find(row => (row.source === "table" || row.source === "promise") && row.phone);
    ok(Boolean(tableRow), `tablo kalemi telefonu taşır: ${tableRow?.party} ${tableRow?.phone}`);
    await page.fill(`${modal} [data-q]`, tableRow.phone);
    await page.press(`${modal} [data-q]`, "Enter");
    await page.waitForFunction(name => { const rows = [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade tbody tr[data-due-row]")]; return rows.length > 0 && rows.every(row => row.textContent.includes(name)); }, tableRow.party, { timeout: 10000 });
    ok((await visibleRows()).every(row => row.includes(tableRow.party)), `telefonla arama: ${tableRow.phone} → ${tableRow.party}`);
    await page.fill(`${modal} [data-q]`, "");
    await page.press(`${modal} [data-q]`, "Enter");
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade tbody tr[data-due-row]").length > 2, null, { timeout: 10000 });
    // Yalnız ödenecekler.
    await page.selectOption(`${modal} [data-field="direction"]`, "out");
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade tbody tr[data-due-row]")].length === 2, null, { timeout: 10000 });
    ok(true, "yalnız ödenecek: 2 satır (kira, verilen çek)");
    await page.selectOption(`${modal} [data-field="direction"]`, "");
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade tbody tr[data-due-row]").length > 2, null, { timeout: 10000 });
    // Tablo kaynağını kapat: tablo satırları gider.
    await page.click(`${modal} [data-source="table"]`);
    await page.waitForFunction(() => ![...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade .hof-rep-src")].some(node => node.classList.contains("is-table")), null, { timeout: 10000 });
    ok(true, "Tablo kaynağı kapatılınca tablo satırları listeden çıkar");
    await page.click(`${modal} [data-source="table"]`);
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade .hof-rep-src")].some(node => node.classList.contains("is-table")), null, { timeout: 10000 });
    // Gecikmiş: yalnız vadesi geçenler.
    await page.click(`${modal} .hof-rep [data-preset="late"]`);
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade tbody tr[data-due-row]")].every(row => row.classList.contains("is-overdue")), null, { timeout: 10000 });
    ok(true, "“Gecikmiş”: yalnız vadesi geçmiş kalemler");
    // 90 gün: senet görünür.
    await page.click(`${modal} .hof-rep [data-preset="next90"]`);
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-vade .hof-rep-src")].some(node => node.classList.contains("is-note")), null, { timeout: 10000 });
    ok(true, "90 gün: 45 gün sonraki senet listede");
    // Satıra tıkla: taksit kartı açılır.
    const index = await page.$$eval(`${modal} .hof-rep-vade tbody tr[data-due-row]`, nodes => nodes.findIndex(node => node.querySelector(".hof-rep-src.is-plan")));
    await page.click(`${modal} .hof-rep-vade tbody tr[data-due-row="${index}"]`);
    await page.waitForFunction(() => /3\.000|taksit/i.test([...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1)?.innerText || ""), null, { timeout: 10000 });
    ok(true, "taksit satırı taksit kartını açar");
    await closeTop();
  });

  await step("C3. Nakit akış: bugünkü kasa + beklenenler; tablo kaynağı; aylık toplamlar", async () => {
    await page.waitForSelector(`${modal} .hof-rep [data-tab="flow"]`);
    await tab("flow");
    await page.waitForSelector(`${modal} [data-chart] svg`, { timeout: 15000, state: "attached" });
    const flow = (await api(`/api/workspace/overview/nakit-akisi?from=${TODAY}&to=${local(30)}`)).data;
    const overview = (await api("/api/workspace/overview")).data;
    ok(flow.cashToday === overview.cash.balance, `başlangıç = ANLIK DURUM kasası: ${money(flow.cashToday)}`);
    ok(flow.cashToday === round(1500 - 500 + 250), `bugünkü kasa = 1.500 − 500 + 250 = ${money(flow.cashToday)}`);
    const isTable = row => row.source === "table" || row.source === "promise";
    ok([...flow.rows, ...flow.overdue].some(isTable), "tablodaki ödeme günleri beklenen girişte (bu ayınkiler bugünde, eskiler gecikmişte)");
    ok(!flow.overdue.some(row => isTable(row) && row.date.slice(0, 7) === TODAY.slice(0, 7) && row.month), "bu ayın tablo kalemi gecikmiş listesinde değil");
    const noTable = (await api(`/api/workspace/overview/nakit-akisi?from=${TODAY}&to=${local(30)}&table=0`)).data;
    ok(![...noTable.rows, ...noTable.overdue].some(isTable), "“Tablodaki ödeme günlerini ekle” kapalı: tablo kalemi yok");
    ok(round(flow.closing - noTable.closing) === round(flow.rows.filter(isTable).reduce((sum, row) => sum + row.amount, 0)), `tahmini kasa farkı = aralıktaki tablo kalemleri (${money(round(flow.closing - noTable.closing))}; çift sayım yok)`);
    await page.selectOption(`${modal} [data-field="group"]`, "month");
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-rep-table thead")].some(node => /Dönem sonu kasa/i.test(node.textContent)), null, { timeout: 10000 });
    const monthly = (await api(`/api/workspace/overview/nakit-akisi?from=${TODAY}&to=${local(30)}&group=month`)).data;
    ok(monthly.periods.at(-1).closing === monthly.closing, `aylık toplamlarda son dönem kasası = tahmini kasa ${money(monthly.closing)}`);
    await shot("nakit-akis-aylik");
  });

  await step("C4. Tüm raporlar: modül modül hazır raporlar; yeni raporların rakamları ekranlarla aynı", async () => {
    // Stok: 40 gün önce 10 adet (50 ₺), bugün 3 adet çıkış → bu ay: dönem başı 10, çıkış 3, dönem sonu 7, değer 350.
    const item = await api("/api/workspace/stock", { name: "A4 kağıt", unit: "paket", unitPrice: "50", minQty: "5", openingQty: "10", openingDate: local(-40) });
    ok(item.status === 200, "stok kalemi: A4 kağıt, açılış 10 paket × 50 ₺ (40 gün önce)");
    ok((await api(`/api/workspace/stock/${item.data.id}/moves`, { kind: "out", qty: "3", date: TODAY, note: "Ofis kullanımı" })).status === 200, "bugün 3 paket çıkış");
    await tab("all");
    await page.waitForSelector(`${modal} .hof-rc-embedded .hof-rc-group`, { timeout: 15000 });
    const groups = await page.$$eval(`${modal} .hof-rc-group > p`, nodes => nodes.map(node => node.textContent.trim()));
    ok(["Kasa", "Cari", "Taksit", "Çek / Senet", "Stok"].every(name => groups.some(group => group.endsWith(name))), `modüller: ${groups.join(", ")}`);
    const catalog = (await api("/api/workspace/report-center")).data.reports.map(report => report.id);
    ok(["kasa-aylik", "cari-tahsilat", "taksit-performans", "cek-vade-dagilimi", "stok-ozet"].every(id => catalog.includes(id)), `yeni raporlar katalogda (${catalog.length} rapor)`);
    const run = async (id, query) => (await api(`/api/workspace/report-center/${id}?${query}`)).data;
    const cell = (data, row, header) => data.rows[row][data.headers.indexOf(header)];
    const sumOf = (data, label) => data.summary.find(([name]) => name === label)?.[1];
    // Aylık kasa: bu yılın hareketleri (tohumdaki tarihlerle hesaplanır; yıl sonuna yakın koşulsa da doğru kalır).
    const year = TODAY.slice(0, 4);
    const seeds = [[TODAY, 1500], [local(-5), -500], [TODAY, 250], [local(15), -4000]].filter(([date]) => date.startsWith(year));
    const kasa = await run("kasa-aylik", `from=${year}-01-01&to=${year}-12-31`);
    const seedIn = seeds.filter(([, value]) => value > 0).reduce((total, [, value]) => total + value, 0);
    const seedOut = -seeds.filter(([, value]) => value < 0).reduce((total, [, value]) => total + value, 0);
    ok(String(sumOf(kasa, "Toplam Giriş")).includes(money(seedIn)) && String(sumOf(kasa, "Toplam Çıkış")).includes(money(seedOut)), `aylık kasa: giriş ${sumOf(kasa, "Toplam Giriş")}, çıkış ${sumOf(kasa, "Toplam Çıkış")}`);
    const monthRow = kasa.rows.findIndex(row => row[0].endsWith(year) && row[0].startsWith(["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][Number(TODAY.slice(5, 7)) - 1]));
    const monthEnd = round(seeds.filter(([date]) => date.slice(0, 7) <= TODAY.slice(0, 7)).reduce((a, [, v]) => a + v, 0));
    ok(monthRow >= 0 && String(cell(kasa, monthRow, "Ay Sonu Kasa")).includes(money(Math.abs(monthEnd))), `bu ayın ay sonu kasası ${money(monthEnd)} (Kasa hareketlerinden)`);
    // Cari bazında tahsilat: Ahmet (1) nakit 1.500 + alınan çek 1.000 = 2.500; Ahmet (2) alınan senet 700 (aynı adlı iki
    // cari ayrı satır, cari numarasıyla); tedarikçi tahsilatsız.
    const tahsilat = await run("cari-tahsilat", `from=${local(-3)}&to=${local(3)}`);
    const byRef = ref => tahsilat.rows.find(row => row[0] === ref);
    ok(tahsilat.rows.length === 2 && String(byRef(ahmet1.refNo)?.[5]).includes(money(2500)) && String(byRef(ahmet1.refNo)?.[2]).includes(money(1500)) && String(byRef(ahmet2.refNo)?.[4]).includes(money(700)), `cari bazında tahsilat: ${tahsilat.rows.map(row => row.join(" | ")).join(" / ")}`);
    // Taksit performansı: 3 taksit 3.000; ödenen 0; geciken 1.000.
    const perf = await run("taksit-performans", `from=${local(-400)}&to=${local(400)}`);
    ok(String(sumOf(perf, "Vadesi Gelen")).includes(money(3000)) && String(sumOf(perf, "Geciken")).includes(money(1000)), `taksit performansı: vadesi gelen ${sumOf(perf, "Vadesi Gelen")}, geciken ${sumOf(perf, "Geciken")}`);
    // Çek/senet vade dağılımı: tahsil edilecek 1.000 + 700; ödenecek 800.
    const cek = await run("cek-vade-dagilimi", "");
    ok(String(sumOf(cek, "Tahsil Edilecek")).includes(money(1700)) && String(sumOf(cek, "Ödenecek")).includes(money(800)), `çek/senet vade dağılımı: tahsil ${sumOf(cek, "Tahsil Edilecek")}, ödeme ${sumOf(cek, "Ödenecek")}`);
    // Stok özeti (bu ay) = Stok ekranı.
    const monthStart = `${TODAY.slice(0, 7)}-01`;
    const stok = await run("stok-ozet", `from=${monthStart}&to=${TODAY}`);
    const stockList = (await api("/api/workspace/stock")).data;
    const a4 = stockList.items.find(entry => entry.name === "A4 kağıt");
    const opening = local(-40) < monthStart ? "10" : "0";
    ok(stok.rows.length === 1 && cell(stok, 0, "Dönem Başı") === opening && cell(stok, 0, "Çıkış") === "3" && cell(stok, 0, "Dönem Sonu") === "7", `stok özeti: ${stok.rows[0]?.join(" | ")}`);
    ok(a4.qty === 7 && String(cell(stok, 0, "Dönem Sonu Değer")).includes(money(a4.value)), `dönem sonu = Stok ekranı (7 paket, ${money(a4.value)})`);
    // Ekrandan: rapor seçilir, ön izleme ve PDF/Excel bağlantıları hazır.
    await page.click(`${modal} [data-report="cari-tahsilat"]`);
    await page.waitForFunction(() => /Ahmet Yılmaz/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-rc-table")?.innerText || ""), null, { timeout: 10000 });
    const links = await page.$$eval(`${modal} .hof-rc-head .hof-rep-out`, nodes => nodes.map(node => node.getAttribute("href")));
    ok(links.length === 2 && links.every(href => href.includes("/report-center/cari-tahsilat/")), "ön izleme; PDF ve Excel bağlantıları");
    await shot("tum-raporlar-cari-tahsilat");
    await page.click(`${modal} [data-report="kasa-aylik"]`);
    await page.waitForFunction(() => /Ay sonu kasa/i.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-rc-table thead")?.textContent || ""), null, { timeout: 10000 });
    await shot("tum-raporlar-aylik-kasa");
  });

  await step("C5. Tablo raporları sekmesi pencere içinde, taşmadan", async () => {
    await tab("table");
    await page.waitForSelector(`${modal} .hof-rep-tablepane .hof-report-filters`, { timeout: 10000 });
    // "Rapor hazırlanıyor…" yer tutucusu sonuç değildir; özet kartları ve tablo gelene kadar beklenir.
    await page.waitForSelector(`${modal} .hof-rep-tablepane [data-report-body] .hof-report-summary`, { timeout: 15000 });
    await page.waitForSelector(`${modal} .hof-rep-tablepane .hof-report-scroll table`, { timeout: 15000 });
    // Taşma: sekmedeki her kutu (açıklama, süzgeç kartı, özet, tablo çerçevesi) Raporlar kutusunun sağ kenarı içinde.
    const overflow = await page.$eval(`${modal} .hof-rep`, rep => {
      const edge = rep.getBoundingClientRect().right;
      const pane = rep.querySelector(".hof-rep-tablepane");
      return Math.max(0, ...[pane, ...pane.children].map(node => Math.round(node.getBoundingClientRect().right - edge)));
    });
    ok(overflow <= 1, `sekmede yatay taşma yok (${overflow}px)`);
    const tableFits = await page.$eval(`${modal} .hof-rep .hof-report-scroll`, node => node.getBoundingClientRect().right <= node.closest(".hof-rep").getBoundingClientRect().right + 1);
    ok(tableFits, "geniş tablo kendi çerçevesinde kaydırılır (pencere dışına taşmaz)");
    const filters = await page.$eval(`${modal} .hof-report-filters`, form => {
      const box = form.getBoundingClientRect();
      return [...form.querySelectorAll("input, select")].every(field => field.getBoundingClientRect().right <= box.right + 1);
    });
    ok(filters, "süzgeç kutuları kartın içinde (Durum taşmıyor)");
    await shot("tablo-raporlari");
    await closeTop();
  });

  await step("D. Yetki: personel görmez; uzman Vade takip, Tablo raporları ve İşlem geçmişi", async () => {
    ok((await api("/api/admin/users", { username: "personel1", name: "Personel Bir", role: "personel", password: "Personel-2026!x", mustChangePassword: false })).status === 200, "personel hesabı");
    ok((await api("/api/admin/users", { username: "uzman1", name: "Uzman Bir", role: "avukat", password: "Uzman-2026!xx", mustChangePassword: false })).status === 200, "uzman (avukat) hesabı");
    const other = await context.browser().newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const staff = await other.newPage();
    await login(staff, "personel1", "Personel-2026!x");
    await staff.waitForSelector("#hof-sidecard");
    ok(!(await staff.isVisible('.hof-side-item[data-action="analytics"]')), "personel: sol menüde Raporlar yok");
    ok((await api("/api/workspace/overview/vade-takip", null, "GET", staff)).status === 403, "personel: Vade takip API 403");
    ok((await api("/api/workspace/overview/mizan?preset=thisMonth", null, "GET", staff)).status === 403, "personel: mizan API 403");
    await other.close();
    const other2 = await context.browser().newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const expert = await other2.newPage();
    await login(expert, "uzman1", "Uzman-2026!xx");
    await expert.waitForSelector('.hof-side-item[data-action="analytics"]');
    await openReports(expert);
    const tabs = await expert.$$eval(`${modal} .hof-rep [data-tab]`, nodes => nodes.map(node => node.textContent.trim()));
    ok(tabs.join("|") === "Vade Takip|Tüm Raporlar|Tablo Raporları", `uzman sekmeleri: ${tabs.join(", ")}`);
    await expert.waitForSelector(`${modal} .hof-rep-vade tbody tr[data-due-row]`, { timeout: 15000 });
    ok((await api("/api/workspace/overview/mizan?preset=thisMonth", null, "GET", expert)).status === 403, "uzman: mizan API 403 (finans raporları yetkisi yok)");
    await shot("uzman-vade-takip", expert);
    // v2.0.10: Yönetim paneli yalnız yöneticide; uzman işlem geçmişini Tüm raporlar'da görür, finans raporlarını görmez.
    await expert.click(`${modal} [data-tab="all"]`);
    await expert.waitForSelector(`${modal} [data-report]`, { timeout: 15000 });
    const listed = await expert.$$eval(`${modal} [data-report]`, nodes => nodes.map(node => node.dataset.report));
    ok(listed.join() === "islem-gecmisi", `uzman: Tüm raporlar'da yalnız İşlem geçmişi (${listed.join(", ")})`);
    await shot("uzman-islem-gecmisi", expert);
    await other2.close();
    // Personel + kişiye özel ANLIK DURUM yetkisi: defter raporları açılır; çek yetkisi ve rapor yetkisi olmadığı için
    // Çek / Senet ve Tablo raporları sekmesi hiç görünmez (görünüp hata veren boş sekme olmaz).
    const people = (await api("/api/admin/users")).data;
    const personel = (Array.isArray(people) ? people : people.users || []).find(user => user.username === "personel1");
    ok((await api(`/api/admin/users/${personel.id}`, { grants: ["overview.view"] }, "PATCH")).status === 200, "personel'e ANLIK DURUM yetkisi verildi");
    const other3 = await context.browser().newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const granted = await other3.newPage();
    const grantedErrors = [];
    granted.on("console", message => message.type() === "error" && !/api\/auth\/me/.test(message.location().url || "") && grantedErrors.push(message.text()));
    await login(granted, "personel1", "Personel-2026!x");
    await granted.waitForSelector('.hof-side-item[data-action="analytics"]', { timeout: 15000 });
    ok(await granted.isVisible('.hof-side-item[data-action="analytics"]'), "yetki verilen personel: sol menüde Raporlar görünür");
    await openReports(granted);
    const grantedTabs = await granted.$$eval(`${modal} .hof-rep [data-tab]`, nodes => nodes.map(node => node.dataset.tab));
    ok(grantedTabs.join("|") === "mizan|vade|flow|all", `yetki verilen personel sekmeleri: ${grantedTabs.join(", ")} (Çek / Senet ve Tablo raporları yok)`);
    for (const id of grantedTabs) {
      await granted.click(`${modal} .hof-rep [data-tab="${id}"]`);
      await granted.waitForTimeout(900);
      const toastError = await granted.$$eval(".hof-toast", nodes => nodes.filter(node => /hata|yetki/i.test(node.textContent)).map(node => node.textContent));
      ok(!toastError.length, `“${id}” sekmesi hatasız açılır${toastError.length ? `: ${toastError.join(" | ")}` : ""}`);
    }
    ok(!grantedErrors.length, `yetki verilen personelde tarayıcı hatası yok${grantedErrors.length ? `: ${grantedErrors.join(" | ")}` : ""}`);
    await other3.close();
  });

  ok(errors.length === 0, `tarayıcı hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
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
  // Denetim dışı bir hata (bekleme süresi, bulunamayan öğe) da senaryoyu başarısız sayar; özet bunu açıkça yazar.
  console.log(`\n${process.exitCode ? "SENARYO BAŞARISIZ — " : ""}${passed}/${results.length} denetim geçti. Ekran görüntüleri: ${OUT}`);
}
