// 2.4.4 madde 5 EKRANDAN (E8; kullanıcı kararı 21.10.2026: "orta tablodaki Excel'deki kayıttan taksit olmasın, cariye kaydedip oradan yapsın; kasa hareketlerini,
// fatura, rapor gibi kısımları bozar" + zil / Ödeme Sözü şeridi için "önerilerin uygun"). Tahsilat Takvimi şeridi ve zildeki "Tahsilat Gir" CARİ'ye gider:
//   2.4.5 madde 3 (ürün sahibi: "tablo verisinden hiçbir para kaydı, borç tutarı, açılış bakiyesi doğmaz"): tablodan açılan tahsilat formunda TUTAR BOŞ, "önce cari
//   açın" formunda AÇILIŞ BAKİYESİ BOŞ (kişi ve açıklama dolu); kullanıcı tutarı kendisi yazar (S1, S2, S4, S9 beklentileri buna göre güncellendi).
//   S1 kayda bağlı carisi olan söz → carinin tahsilat formu (Cari No + ad başlıkta, açıklama hazır, tutar boş); insan hızında yazım + Tab; para carinin
//      defterine, Kasa'ya bir kez; kayıt tahsilatı (payments) YOK; pil kalkar.
//   S2 carisi olmayan kayıt → "önce cari açın" + ad ve telefonu kayıttan dolu Yeni Cari (kayda bağlı) → kaydedince tahsilat formu → para yeni cariye; pil kalkar.
//   S3 kartlı kişinin sözü → cari "+ Tahsilat" ile aynı seçim (Taksite Yaz / Taksit Dışı) → Taksite Yaz → taksit kartına; söz kalkar.
//   S4 zil → aynı yol (kısmi tahsilat: söz kalanla bekler).
//   S5 kayıttan taksit yok: "Tahsilat İşle" penceresi ve "Taksit planı oluşturun" kısa yolu hiçbir yoldan açılmaz; dolu Yeni Cari formu Esc ile SORUSUZ kapanır.
//   S6 kayda bağlı kartı olup carisi kayda bağlı olmayan kayıt → taksit seçimi; "Plansız Tahsilat Kaydet" (Kasa'ya doğrudan) yok.
//   S7 personel (cari açma yetkisi yok): carisi olmayan kayıtta yol söylenir, form açılmaz, hiçbir şey yazılmaz.
//   S8 elle kâhin: Kasa = girilen tutarların toplamı; payments 0.
//   S9 (2.4.5 madde 3; 2.4.4 5b'nin yerine) carisi olmayan kayıtta "Kalan" kolonu olsa da Yeni Cari'nin Açılış Bakiyesi BOŞ; kullanıcı borcu yazınca cari borçla
//      açılır, tahsilat (tutarı kullanıcı yazar) borçtan düşer (veri tabanından: açılış borcu + tahsilat).
// Çıkış: "N geçti, M kaldı" (kaldıysa çıkış kodu 1).
// 2.4.5 madde 4 (uyarı kapısı): bu senaryo tablonun ödeme kalemlerini (şerit / zil / takvim) kullanan 2.4.4 yolunu sınar — üründe kapalı; sunucu
// legacyTableDues (yalnız testler) ile 2.4.4 davranışında açılır. Ürünün kapısı test/e2e/run.mjs "2.4.5 uyarı kapısı" ve test/kapi-uyari-245.test.mjs.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { tahsilatWorkbook } from "../fixtures/tahsilat-ornek.mjs";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-kayit-tahsilat-244-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), legacyTableDues: true });
const api = await server.login();
const BASE = server.base;
const db = server.app.store;
const one = (sql, ...args) => db.get(sql, ...args);

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let mainPage = null;
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    if (mainPage) await shot(mainPage, `hata-${title.slice(0, 3).replace(/[^A-Za-z0-9]/g, "")}`);
    if (mainPage) await closeAll(mainPage).catch(() => null);
  }
};

// ---------- Veri (programın kendi uçları) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const book = tahsilatWorkbook(new Date());
// 2.4.4 (5b): "Alacak Tutarı" + "Kalan" + "Son Ödeme" sekmesi (Kalan Borç kalan kolonundan; Açılış Bakiyesi bundan dolar).
const inDays = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};
book.push({ name: "Alacaklar", columns: ["Dosya No", "Borçlu", "Telefon", "Alacak Tutarı", "Kalan", "Son Ödeme"], rows: [["2026/901", "Hasan Er", "0544 900 01 01", "20.000,00", "12.000,00", inDays(3)], ["2026/902", "Ece Ak", "0544 900 02 02", "21.000,00", "13.000,00", inDays(4)], ["2026/903", "Can Tan", "0544 900 03 03", "22.000,00", "14.000,00", inDays(5)]].map(([no, who, tel, all, left, due]) => ({ "Dosya No": no, Borçlu: who, Telefon: tel, "Alacak Tutarı": all, Kalan: left, "Son Ödeme": due })) });
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
const dues = async () => (await must("takvim", api.get("/api/workspace/dues"))).items;
const first = await dues();
const keyOf = (person, label) => first.find(item => item.person === person && (!label || item.label === label))?.caseKey;
const keys = { ali: keyOf("Ali Veli", "Ödeme sözü"), ayse: keyOf("Ayşe Kaya", "Ödeme sözü"), zeynep: keyOf("Zeynep Şahin", "Ödeme sözü"), selin: keyOf("Selin Arslan"), burak: keyOf("Burak Koç"), hakan: keyOf("Hakan Kurt"), deniz: keyOf("Deniz Öztürk") };
if (Object.values(keys).some(value => !value)) throw new Error(`örnek tablonun kalemleri takvimde yok: ${JSON.stringify(keys)}`);
const ali = await must("Ali cari", api.post("/api/workspace/accounts", { name: "Ali Veli", phone: "0532 111 11 11", type: "customer", caseKey: keys.ali, caseTitle: "2026/1101 · Ali Veli" }));
const zeynep = await must("Zeynep cari", api.post("/api/workspace/accounts", { name: "Zeynep Şahin", phone: "0535 444 44 44", type: "customer", caseKey: keys.zeynep, caseTitle: "2026/1104 · Zeynep Şahin" }));
const ayse = await must("Ayşe cari", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", phone: "0532 222 22 22", type: "customer", caseKey: keys.ayse, caseTitle: "2026/1102 · Ayşe Kaya" }));
const aysePlan = await must("Ayşe kart", api.post("/api/workspace/plans", { accountId: ayse.id, name: "Ayşe Kaya", total: "6.000", registeredOn: day(-20), mode: "auto", count: 2, firstDue: day(10) }));
// Hakan: carisi kayda bağlı DEĞİL, ama Taksitler'de kayda bağlanmış kartı var (eski veride olabilen durum).
const hakan = await must("Hakan cari", api.post("/api/workspace/accounts", { name: "Hakan Kurt", phone: "0542 700 22 22", type: "customer" }));
await must("Hakan kart", api.post("/api/workspace/plans", { accountId: hakan.id, caseKey: keys.hakan, caseTitle: "A-2 · Hakan Kurt", name: "Hakan Kurt", total: "12.000", registeredOn: day(-20), mode: "auto", count: 2, firstDue: day(10) }));
await must("personel", api.post("/api/admin/users", { username: "personel1", name: "Personel Bir", role: "personel", password: "Personel-2026!", mustChangePassword: false }));

const cash = async () => (await must("kasa", api.get("/api/workspace/cash"))).totals.balance;
const payments = () => one("SELECT COUNT(*) AS n FROM payments").n;
const entriesOf = id => one("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE 0 END), 0) AS paid FROM account_entries WHERE account_id = ?", id);
const planIn = id => one("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS paid FROM plan_entries WHERE plan_id = ? AND kind = 'in'", id);
const accountCount = () => one("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n;
const cash0 = await cash();
const entered = [];

const browser = await chromium.launch();
const errors = [];
const modal = ".hof-modal-backdrop.is-visible";
const top = ".hof-modal-backdrop.is-visible:last-of-type";
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `kayit-tahsilat-244-${name}.png`) }).catch(() => null);
const typeSlow = async (page, text) => {
  for (const ch of text) await page.keyboard.type(ch, { delay: 45 });
};
const closeAll = async page => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
async function openPage({ user = "admin", password = ADMIN_PASSWORD } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", user);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.accounts?.open && window.HOF?.workspace?.payment), null, { timeout: 20000 });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  // Sağ alt bildirimler şeridi kapatmasın (zil ve şerit ayrıca sınanır).
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });
  await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 20000 });
  await page.waitForTimeout(600);
  return { context, page };
}
const pills = (page, name) => page.evaluate(person => [...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].filter(node => node.querySelector("b")?.textContent.startsWith(person)).map(node => node.innerText.replace(/\s+/g, " ")), name);
const openPill = async (page, name, label = "") => {
  await page.evaluate(
    ([person, text]) => {
      const pill = [...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].find(node => node.querySelector("b")?.textContent.startsWith(person) && (!text || node.textContent.includes(text)));
      if (!pill) throw new Error(`pil yok: ${person} ${text}`);
      pill.click();
    },
    [name, label],
  );
  await page.waitForSelector(".hof-payment-action-card", { timeout: 5000 });
};
const amountValue = page => page.$eval(`${top} input[name="amount"]`, node => node.value);
const typeAmount = async (page, text) => {
  await page.click(`${top} input[name="amount"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await typeSlow(page, text);
  await page.keyboard.press("Tab");
};
const waitGone = (page, person, label) =>
  page
    .waitForFunction(([name, text]) => ![...document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])")].some(node => node.querySelector("b")?.textContent.startsWith(name) && node.textContent.includes(text)), [person, label], { timeout: 12000 })
    .then(() => true)
    .catch(() => false);

try {
  const { page } = await openPage();
  mainPage = page;

  await step("S1 kayda bağlı carisi olan söz: şeritten Tahsilat Gir → carinin tahsilat formu; para cariye, Kasa'ya bir kez", async () => {
    const before = { cash: await cash(), payments: payments(), ali: entriesOf(ali.id) };
    ok((await pills(page, "Ali Veli")).some(text => /Ödeme sözü/.test(text) && /5\.000,00/.test(text)), "şeritte Ali Veli · Ödeme sözü · 5.000,00");
    await openPill(page, "Ali Veli", "Ödeme sözü");
    await page.click('.hof-payment-action-card [data-act="pay"]');
    await page.waitForSelector(`${top} input[name="amount"]`);
    const title = await textOf(page, `${top} .hof-modal-title`);
    const eyebrow = await textOf(page, `${top} .hof-eyebrow`);
    ok(title === "Tahsilat" && new RegExp(`No ${ali.refNo}`).test(eyebrow) && /Ali Veli/.test(eyebrow), `carinin tahsilat formu: “${title}” · “${eyebrow}”`);
    ok(!(await page.$(`${top} [data-new-plan]`)) && !/Tahsilat İşle/.test(title), "kayıt tahsilatı penceresi ve Taksit planı kısa yolu yok");
    ok((await amountValue(page)) === "", `tutar boş (2.4.5 madde 3; şeritte 5.000,00): “${await amountValue(page)}”`);
    const note = await page.$eval(`${top} [name="note"]`, node => node.value);
    ok(/^Ödeme sözü · \d{2}\.\d{2}\.\d{4}$/.test(note), `açıklama takvim kaleminden: “${note}”`);
    await shot(page, "s1-cari-tahsilat");
    await typeAmount(page, "5000");
    await page.click(`${top} button[type="submit"]`);
    ok(await waitGone(page, "Ali Veli", "Ödeme sözü"), "pil kalktı (söz carinin tahsilatıyla kapandı)");
    entered.push(5000);
    const after = { cash: await cash(), payments: payments(), ali: entriesOf(ali.id) };
    ok(after.ali.n === before.ali.n + 1 && after.ali.paid === before.ali.paid + 5000, `carinin defterine 1 tahsilat, 5.000 (${before.ali.paid} → ${after.ali.paid})`);
    ok(after.payments === before.payments, `kayıt tahsilatı yazılmadı (payments ${before.payments} → ${after.payments})`);
    ok(Math.round((after.cash - before.cash) * 100) === 500000, `Kasa 5.000 arttı (${money(before.cash)} → ${money(after.cash)})`);
  });

  let selinAccount = null;
  await step("S2 carisi olmayan kayıt: önce cari açın (ad, telefon kayıttan; kayda bağlı) → kaydedince tahsilat formu → para yeni cariye", async () => {
    const pill = (await pills(page, "Selin Arslan"))[0] || "";
    const label = /1\. taksit/.test(pill) ? "1. taksit" : "2. taksit";
    const expected = Number((/([\d.]+,\d{2})/.exec(pill)?.[1] || "0").replace(/\./g, "").replace(",", "."));
    const before = { cash: await cash(), payments: payments(), accounts: accountCount() };
    await openPill(page, "Selin Arslan", label);
    await page.click('.hof-payment-action-card [data-act="pay"]');
    await page.waitForSelector(`${top} input[name="name"]`);
    const form = await page.evaluate(sel => {
      const box = document.querySelector(sel);
      return { title: box.querySelector(".hof-modal-title")?.textContent.trim(), intro: box.querySelector(".hof-modal-text")?.textContent || "", name: box.querySelector('input[name="name"]').value, phone: box.querySelector('input[name="phone"]').value, caseKey: box.querySelector('input[name="caseKey"]')?.value || "", opening: box.querySelector('input[name="openingBalance"]')?.value ?? null };
    }, top);
    ok(form.title === "Yeni Cari" && /Önce cari açın/.test(form.intro), `“${form.title}” + “önce cari açın” iletisi`);
    ok(form.opening === "", `Açılış Bakiyesi boş (2.4.5 madde 3): “${form.opening}”`);
    ok(form.name === "Selin Arslan" && form.phone === "0532 600 30 30" && form.caseKey === keys.selin, `ad, telefon ve kayıt bağı kayıttan: ${JSON.stringify({ name: form.name, phone: form.phone, caseKey: form.caseKey })}`);
    ok(!(await page.$(`${top} [data-new-plan]`)), "Taksit planı kısa yolu yok");
    await shot(page, "s2-once-cari");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForFunction(sel => document.querySelector(`${sel} .hof-modal-title`)?.textContent.trim() === "Tahsilat", top, { timeout: 10000 });
    selinAccount = one("SELECT id, ref_no AS refNo, case_key AS caseKey, phone FROM accounts WHERE name = 'Selin Arslan' AND deleted_at IS NULL");
    ok(accountCount() === before.accounts + 1 && selinAccount?.caseKey === keys.selin, `yeni cari No ${selinAccount?.refNo} kayda bağlı (${selinAccount?.caseKey})`);
    ok(expected > 0 && (await amountValue(page)) === "", `tahsilat formunda tutar boş (2.4.5 madde 3; pil ${money(expected)}): “${await amountValue(page)}”`);
    await typeAmount(page, String(expected).replace(".", ","));
    await shot(page, "s2-tahsilat");
    await page.click(`${top} button[type="submit"]`);
    ok(await waitGone(page, "Selin Arslan", label), `pil kalktı (${label})`);
    entered.push(expected);
    const got = entriesOf(selinAccount.id);
    ok(got.n === 1 && got.paid === expected, `para yeni carinin defterinde: ${got.n} hareket, ${got.paid}`);
    ok(payments() === before.payments, "kayıt tahsilatı yazılmadı");
    ok(Math.round(((await cash()) - before.cash) * 100) === Math.round(expected * 100), "Kasa tahsilat kadar arttı");
  });

  await step("S3 kartlı kişinin sözü: Taksite Yaz / Taksit Dışı seçimi → Taksite Yaz → taksit kartına; söz kalkar", async () => {
    const before = { cash: await cash(), payments: payments(), plan: planIn(aysePlan.id), ayse: entriesOf(ayse.id) };
    await openPill(page, "Ayşe Kaya", "Ödeme sözü");
    await page.click('.hof-payment-action-card [data-act="pay"]');
    await page.waitForSelector(`${top} .hof-acc-choices [data-plan]`);
    const choices = await textOf(page, `${top} .hof-acc-choices`);
    ok(/Taksite Yaz/.test(choices) && /Taksit Dışı Tahsilat/.test(choices), `cari + Tahsilat ile aynı seçim: “${choices.slice(0, 120)}”`);
    await page.click(`${top} .hof-acc-choices [data-plan]`);
    await page.waitForSelector(`${top} input[name="amount"]`);
    await typeAmount(page, "3000");
    await shot(page, "s3-taksite-yaz");
    await page.click(`${top} button[type="submit"]`);
    ok(await waitGone(page, "Ayşe Kaya", "Ödeme sözü"), "söz pili kalktı (taksit tahsilatıyla)");
    entered.push(3000);
    const plan = planIn(aysePlan.id);
    ok(plan.n === before.plan.n + 1 && plan.paid === before.plan.paid + 3000, `taksit kartına 3.000 (${before.plan.paid} → ${plan.paid})`);
    ok(entriesOf(ayse.id).paid === before.ayse.paid && payments() === before.payments, "taksit dışı cari tahsilatı ve kayıt tahsilatı yazılmadı");
    await closeAll(page);
  });

  await step("S4 zil: Tahsilat Gir → aynı cari yolu; kısmi tahsilatta söz kalanla bekler", async () => {
    const before = { cash: await cash(), zeynep: entriesOf(zeynep.id) };
    await page.click(".topbar .top-actions > .icon-button");
    await page.waitForSelector(".hof-alert-list");
    const index = await page.evaluate(() => [...document.querySelectorAll(".hof-alert-list li")].findIndex(node => node.textContent.includes("Zeynep Şahin") && node.querySelector("[data-pay]")));
    ok(index >= 0, "zilde Zeynep Şahin'in sözü “Tahsilat Gir” ile");
    await page.evaluate(i => [...document.querySelectorAll(".hof-alert-list li")][i].querySelector("[data-pay]").click(), index);
    await page.waitForSelector(`${top} input[name="amount"]`);
    const eyebrow = await textOf(page, `${top} .hof-eyebrow`);
    ok(new RegExp(`No ${zeynep.refNo}`).test(eyebrow) && /Zeynep Şahin/.test(eyebrow), `carinin tahsilat formu: “${eyebrow}”`);
    ok((await amountValue(page)) === "", `tutar boş (2.4.5 madde 3; söz 7.500,00): “${await amountValue(page)}”`);
    await typeAmount(page, "2500");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForTimeout(1500);
    entered.push(2500);
    const got = entriesOf(zeynep.id);
    ok(got.paid === before.zeynep.paid + 2500, `carinin defterine 2.500 (${before.zeynep.paid} → ${got.paid})`);
    const left = (await dues()).find(item => item.person === "Zeynep Şahin" && item.promise);
    ok(left?.amount === 5000 && left?.partial === true, `söz 5.000 kalanla bekler (kısmen ödendi): ${JSON.stringify({ amount: left?.amount, partial: left?.partial })}`);
    await closeAll(page);
  });

  await step("S5 kayıttan taksit yok: tutarsız kalemde de \"Tahsilat İşle\" / \"Taksit planı oluşturun\" açılmaz; dolu Yeni Cari Esc ile sorusuz kapanır", async () => {
    const before = { accounts: accountCount(), payments: payments() };
    await page.evaluate(key => window.HOF.workspace.payment({ key, title: "Burak Koç" }), keys.burak);
    await page.waitForSelector(`${top} input[name="name"]`);
    const title = await textOf(page, `${top} .hof-modal-title`);
    ok(title === "Yeni Cari", `carisi olmayan kayıtta Yeni Cari açıldı (“${title}”)`);
    ok(!(await page.$(`${modal} [data-new-plan]`)) && !(await page.evaluate(() => [...document.querySelectorAll(".hof-modal-title")].some(node => /Tahsilat İşle/.test(node.textContent)))), "kayıt tahsilatı penceresi / Taksit planı kısa yolu yok");
    await escClose(page, { expect: "soru-yok", step: "S5" });
    await page.waitForTimeout(400);
    ok(!(await page.$(modal)), "kayıttan gelen dolu form Esc ile sorusuz kapandı");
    ok(accountCount() === before.accounts && payments() === before.payments, "hiçbir şey yazılmadı");
  });

  await step("S6 kayda bağlı kartı olup carisi kayda bağlı olmayan kayıt: taksit seçimi, \"Plansız Tahsilat Kaydet\" yok", async () => {
    await page.evaluate(key => window.HOF.workspace.payment({ key, title: "Hakan Kurt" }), keys.hakan);
    await page.waitForSelector(`${top}.hof-plan-collect-modal, ${top} .hof-plan-collect-modal, .hof-plan-collect-modal`, { timeout: 10000 });
    const body = await textOf(page, ".hof-plan-collect-modal");
    ok(/Hakan Kurt/.test(body) && /Tahsil Et/.test(body), "kayda bağlı kartın taksitleri");
    ok(!(await page.$(".hof-plan-collect-modal [data-plain]")) && !/Plansız Tahsilat/.test(body), "“Plansız Tahsilat Kaydet” (Kasa'ya doğrudan) yok");
    await shot(page, "s6-kart-secimi");
    await closeAll(page);
  });

  await step("S7 personel: carisi olmayan kayıtta yol söylenir; form açılmaz, hiçbir şey yazılmaz", async () => {
    const staff = await openPage({ user: "personel1", password: "Personel-2026!" });
    const before = { accounts: accountCount(), payments: payments(), cash: await cash() };
    await openPill(staff.page, "Deniz Öztürk", "Kira");
    const canPay = Boolean(await staff.page.$('.hof-payment-action-card [data-act="pay"]'));
    ok(canPay, "personelde Tahsilat Gir görünür (Cariden Tahsilat Girme yetkisi var)");
    if (canPay) await staff.page.click('.hof-payment-action-card [data-act="pay"]');
    await staff.page.waitForTimeout(1200);
    const toast = await staff.page.evaluate(() => [...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" | "));
    ok(/carisi yok/.test(toast) && /Cari açmak yönetici/.test(toast), `yol söylendi: “${toast.slice(0, 160)}”`);
    ok(!(await staff.page.$(modal)), "form açılmadı");
    ok(accountCount() === before.accounts && payments() === before.payments && (await cash()) === before.cash, "hiçbir şey yazılmadı");
    await shot(staff.page, "s7-personel");
    await staff.context.close();
  });

  await step("S9 (2.4.5 madde 3) Açılış Bakiyesi boş (tablo borcu yazılmaz); kullanıcı borcu yazınca cari borçla açılır, tahsilat borçtan düşer", async () => {
    await openPill(page, "Hasan Er");
    await page.click('.hof-payment-action-card [data-act="pay"]');
    await page.waitForSelector(`${top} input[name="openingBalance"]`);
    const form = await page.evaluate(sel => {
      const box = document.querySelector(sel);
      const field = box.querySelector('input[name="openingBalance"]');
      return { value: field.value, help: field.closest(".hof-field")?.querySelector("small")?.textContent || "", name: box.querySelector('input[name="name"]').value };
    }, top);
    ok(form.name === "Hasan Er" && form.value === "", `Açılış Bakiyesi boş (kayıttaki Kalan Borç 12.000 yazılmaz): “${form.value}”`);
    ok(!/kolonundan/.test(form.help), `tablo kaynağı yazılmaz: “${form.help}”`);
    await shot(page, "s9-acilis-bakiyesi");
    // Kullanıcı borcu kendisi yazar (insan hızında + Tab).
    await page.click(`${top} input[name="openingBalance"]`);
    await typeSlow(page, "12000");
    await page.keyboard.press("Tab");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForFunction(sel => document.querySelector(`${sel} .hof-modal-title`)?.textContent.trim() === "Tahsilat", top, { timeout: 10000 });
    ok((await amountValue(page)) === "", `tahsilat formunda tutar boş: “${await amountValue(page)}”`);
    await typeAmount(page, "2000");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForTimeout(1500);
    entered.push(2000);
    const hasan = one("SELECT id FROM accounts WHERE name = 'Hasan Er' AND deleted_at IS NULL");
    const rows = db.all("SELECT kind, amount FROM account_entries WHERE account_id = ? ORDER BY rowid", hasan.id).map(row => `${row.kind}:${row.amount}`);
    ok(rows.join(",") === "debt:12000,in:2000", `carinin defteri: ${rows.join(", ")}`);
    const balance = (await must("cari", api.get(`/api/workspace/accounts/${hasan.id}`))).totals.balance;
    ok(balance === 10000, `cari bakiyesi 12.000 − 2.000 = ${balance}`);
    const left = (await dues()).find(item => item.person === "Hasan Er");
    ok(left?.amount === 10000 && left?.partial === true, `takvim kalemi 10.000 kalanla bekler: ${JSON.stringify({ amount: left?.amount, partial: left?.partial })}`);
    await closeAll(page);
  });

  await step("S8 elle kâhin: Kasa = girilen tahsilatların toplamı; kayıt tahsilatı hiç yazılmadı", async () => {
    const sum = entered.reduce((total, value) => total + value, 0);
    const now = await cash();
    ok(Math.round((now - cash0) * 100) === Math.round(sum * 100), `Kasa ${money(cash0)} + ${money(sum)} = ${money(now)}`);
    ok(payments() === 0, `payments ${payments()}`);
  });
} catch (error) {
  ok(false, `senaryo yarıda kaldı: ${error.message}`);
} finally {
  ok(!errors.length, `sayfa hatası yok (${errors.slice(0, 3).join(" | ")})`);
  await browser.close();
  await server.close();
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // temizlik hatası sonucu ezmez
  }
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
