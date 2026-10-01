// Gerçek kullanıcı senaryosu (v2.0.13): WhatsApp ile tek/toplu ekstre ve toplu mesaj (müşteri talebi), ödeme yolu
// (Nakit / Havale-EFT / Kredi Kartı / Çek-Senet / Açık Hesap), Kasa ve Banka, müşteri iadesi, satışta taksitlendirme,
// mevcut borcu taksitlendirme (çift borç yok), çift cari uyarısı, Ana Defter mutabakatı. Arayüzden, sıfırdan.
// Çalıştırma: npm run test:senaryo-213 (artifacts/senaryo-213/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-213");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-213-"));
const excel = path.join(root, "ogrenciler.xlsx");
const COLS = ["Öğrenci", "Veli Telefon", "Kayıt Tarihi", "Aylık Ücret", "Servis Plaka"];
const ROWS = [["Mert Çelik", "0537 410 60 60", "14.01.2026", "4.500,00 ₺", "34 SRV 303"], ["Ada Yılmaz", "0532 410 10 10", "02.02.2026", "3.500,00 ₺", "34 SRV 101"], ["Efe Kaya", "0532 410 20 20", "12.04.2026", "3.500,00 ₺", "34 SRV 101"]];
writeFileSync(excel, buildXlsx([{ name: "Öğrenciler", columns: COLS, rows: ROWS.map(row => Object.fromEntries(COLS.map((col, i) => [col, row[i]]))) }], { title: "Öğrenciler" }));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f93" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  return page;
};
const results = [];
let shotNo = 0;
const shot = async (page, name, options = {}) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), ...options });
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const call = (page, url, body, method = body ? "POST" : "GET") =>
  page.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ...json };
    },
    [url, body, method],
  );
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const pad = value => String(value).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const tl = value => `₺${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const closeTop = async page => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
};


const admin = await newPage();
// WhatsApp'ın açılması yerine adresi kaydet (gerçek kullanıcıda WhatsApp sekmesi açılır).
await admin.context().addInitScript(() => {
  window.__wa = [];
  window.open = url => {
    window.__wa.push(String(url));
    return null;
  };
});
let exitCode = 0;
const closeAll = async () => { for (let i = 0; i < 5 && (await admin.$(modal)); i += 1) await closeTop(admin); };
const openAccounts = async () => {
  await closeAll();
  await admin.click('#hof-sidecard [data-action="accounts"]');
  await admin.waitForSelector(`${top} [data-selbar]`);
  await admin.waitForTimeout(400);
};
const waSent = () => admin.evaluate(() => window.__wa.slice());
const topText = () => admin.$eval(top, node => node.innerText.replace(/\s+/g, " "));
const ids = {};
try {
  await step("Kurulum: yönetici girer, Excel yüklenir; cariler açılır (biri sabit hatlı, biri numarasız)", async () => {
    await login(admin, "admin", PASS);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => admin.keyboard.press("Escape"));
    await admin.waitForTimeout(1200);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    for (const [key, name, phone, openingBalance, type] of [
      ["tulay", "Tülay Arıkan", "0537 454 65 76", "1.250", "customer"],
      ["kemal", "Kemal Bakkal", "0532 777 66 55", "4.800", "customer"],
      ["sabit", "Sabit Hatlı Büfe", "0212 555 44 33", "300", "customer"],
      ["bos", "Numarasız Müşteri", "", "150", "customer"],
      ["kapali", "Hesabı Kapalı Ayşe", "0544 111 22 33", "", "customer"],
      ["tedarik", "Anadolu Gıda", "0533 999 88 77", "9.000", "supplier"],
    ]) {
      const created = await call(admin, "/api/workspace/accounts", { name, phone, openingBalance, type });
      ok(created.status === 200, `cari: ${name}`);
      ids[key] = created.data.id;
    }
  });

  await step("1. Cari → üç cari seçilir → WhatsApp Ekstre: alıcılar, geçersiz numara nedeni, kişiye özel ekstre ön izlemesi", async () => {
    await openAccounts();
    const idle = await admin.$eval(`${top} [data-selbar]`, node => node.innerText);
    ok(/Tümüne WhatsApp Ekstre/.test(idle) && /Tümüne WhatsApp Mesaj/.test(idle), "seçim yokken: süzgeçteki hepsine gönderim düğmeleri");
    for (const key of ["tulay", "kemal", "sabit"]) await admin.check(`${top} input[data-select="${ids[key]}"]`);
    const bar = await admin.$eval(`${top} [data-selbar]`, node => node.innerText);
    ok(/3 cari seçildi/.test(bar) && /WhatsApp Ekstre/.test(bar) && /WhatsApp Mesaj/.test(bar), `seçim çubuğu: ${bar.replace(/\s+/g, " ")}`);
    await shot(admin, "cari-secim-whatsapp");
    await admin.click(`${top} [data-act="waStatement"]`);
    await admin.waitForSelector(`${top} .hof-wa-head`);
    const head = await admin.$eval(`${top} .hof-wa-head`, node => node.innerText.replace(/\s+/g, " "));
    ok(/3 Cari/.test(head) && /2 Geçerli Numara/.test(head) && /1 Numarası Yok \/ Hatalı/.test(head) && /2 Gönderilecek/.test(head), `özet: ${head}`);
    const text = await topText();
    ok(/Sabit hat/.test(text), "sabit hat nedeniyle ayrıldı");
    const bubble = await admin.$eval(`${top} .hof-wa-bubble`, node => node.innerText);
    ok(/Sayın Tülay Arıkan/.test(bubble) || /Sayın Kemal Bakkal/.test(bubble), "ön izleme kişiye özel");
    ok(/Güncel bakiye/.test(bubble), `ekstre metni bakiyeyi içerir: ${bubble.slice(0, 140)}`);
    await admin.selectOption(`${top} select[data-preset]`, "all");
    await admin.waitForSelector(`${top} .hof-wa-bubble`);
    await admin.click(`${top} tr[data-preview="${ids.kemal}"] td:nth-child(2)`);
    const kemal = await admin.$eval(`${top} .hof-wa-bubble`, node => node.innerText);
    ok(/Sayın Kemal Bakkal/.test(kemal) && /4\.800,00 TL \(borcunuz\)/.test(kemal), "satıra tıklayınca o kişinin ekstresi (Tüm Hareketler)");
    await shot(admin, "whatsapp-ekstre-hazirlik");
  });

  await step("2. Gönderime Başla → sıra: 1 / 2, WhatsApp'ta Aç ve Sıradakine Geç; her gönderim cari kartına yazılır", async () => {
    await admin.click(`${top} [data-start]`);
    await admin.click(`${top} [data-answer="yes"]`);
    await admin.waitForSelector(`${top} [data-send]`);
    ok(/1 \/ 2/.test(await topText()), "ilerleme 1 / 2");
    ok(await admin.$(`${top} a[href$="/ekstre.pdf"]`), "Ekstre PDF bağlantısı");
    ok(await admin.$eval(`${top} input[data-pdf]`, node => node.checked), "v2.0.14: 'Ekstre PDF'ini kendiliğinden indir' varsayılan açık");
    await shot(admin, "whatsapp-sira-1");
    const firstName = await admin.$eval(`${top} .hof-wa-person strong`, node => node.textContent.trim());
    const download = admin.waitForEvent("download", { timeout: 8000 });
    await admin.click(`${top} [data-send]`);
    const file = await download;
    // Başsız Chromium indirme adını "download" diye bildirir; ad sunucunun Content-Disposition başlığından doğrulanır.
    const disposition = await admin.evaluate(async url => (await fetch(url)).headers.get("content-disposition") || "", file.url());
    ok(/ekstre\.pdf\?download=1$/.test(file.url()) && disposition.includes(encodeURIComponent(`Cari-ekstre ${firstName}.pdf`)), `ekstre PDF'i kişinin adıyla kendiliğinden indi: ${decodeURIComponent(disposition.split("''")[1] || disposition)}`);
    await admin.waitForSelector(`${top} [data-prev]:not([disabled])`);
    ok(/2 \/ 2/.test(await topText()), "ilerleme 2 / 2");
    await admin.click(`${top} [data-send]`);
    await admin.waitForSelector(`${top} .hof-wa-done`);
    ok(/2 kişiye gönderildi/.test(await topText()), "tamamlandı: 2 kişiye gönderildi");
    await shot(admin, "whatsapp-tamam");
    const urls = await waSent();
    ok(urls.length === 2 && urls.every(url => /^https:\/\/wa\.me\/905\d{9}\?text=/.test(url)), `wa.me adresleri: ${urls.map(url => url.slice(0, 40)).join(" | ")}`);
    ok(decodeURIComponent(urls[0].split("text=")[1]).includes("Güncel bakiye"), "mesaj metni ekstre");
    const history = await call(admin, `/api/workspace/whatsapp/history?accountId=${ids.tulay}`);
    ok(history.data.length === 1 && history.data[0].kind === "statement", "Tülay'ın kartına ekstre gönderimi yazıldı");
    const none = await call(admin, `/api/workspace/whatsapp/history?accountId=${ids.sabit}`);
    ok(none.data.length === 0, "sabit hatlıya gönderilmedi");
  });

  await step("3. Seçim yok → Tümüne WhatsApp Mesaj: şablon, değişken, yalnız borçlular; biri atlanır", async () => {
    await openAccounts();
    await admin.click(`${top} [data-act="waMessage"]`);
    await admin.waitForSelector(`${top} textarea[data-body]`);
    const head = await admin.$eval(`${top} .hof-wa-head`, node => node.innerText.replace(/\s+/g, " "));
    ok(/6 Cari/.test(head) && /4 Geçerli Numara/.test(head), `hepsi: ${head}`);
    await admin.check(`${top} input[data-debtors]`);
    const debtors = await admin.$eval(`${top} .hof-wa-head`, node => node.innerText.replace(/\s+/g, " "));
    ok(/2 Gönderilecek/.test(debtors), `yalnız borçlular (tedarikçi ve kapalı hesap çıkar): ${debtors}`);
    await admin.fill(`${top} textarea[data-body]`, "Merhaba ");
    await admin.focus(`${top} textarea[data-body]`);
    await admin.keyboard.press("End");
    await admin.click(`${top} [data-var="{Ad}"]`);
    ok(await admin.evaluate(() => document.activeElement?.matches(".hof-modal-backdrop.is-visible:last-of-type textarea[data-body]") && document.activeElement.selectionStart === document.activeElement.value.length), "v2.0.14: değişken pili eklenince odak metin kutusunda, imleç eklenenin sonunda");
    await admin.fill(`${top} textarea[data-body]`, (await admin.$eval(`${top} textarea[data-body]`, node => node.value)) + ", güncel bakiyeniz {Bakiye}. Hafta sonu indirimimiz başladı.");
    const bubble = await admin.$eval(`${top} .hof-wa-bubble`, node => node.innerText);
    ok(/Merhaba (Tülay Arıkan|Kemal Bakkal), güncel bakiyeniz ₺?[\d.]+,\d\d/.test(bubble), `değişkenler doldu: ${bubble}`);
    await shot(admin, "whatsapp-mesaj-hazirlik");
    await admin.click(`${top} [data-start]`);
    await admin.click(`${top} [data-answer="yes"]`);
    await admin.waitForSelector(`${top} [data-skip]`);
    await admin.click(`${top} [data-skip]`);
    await admin.waitForSelector(`${top} [data-send]`);
    await admin.fill(`${top} textarea[data-current]`, "Kişiye özel düzeltilmiş mesaj");
    await admin.click(`${top} [data-send]`);
    await admin.waitForSelector(`${top} .hof-wa-done`);
    ok(/1 kişiye gönderildi, 1 kişi atlandı/.test(await topText()), "özet: 1 gönderildi, 1 atlandı");
    const urls = await waSent();
    ok(decodeURIComponent(urls.at(-1).split("text=")[1]) === "Kişiye özel düzeltilmiş mesaj", "kişiye özel düzeltme gönderildi");
  });

  await step("4. Cari kartı → WhatsApp: Ekstre Gönder / Mesaj Gönder / Sohbeti Aç ve Son Gönderimler", async () => {
    await openAccounts();
    await admin.click(`${top} tr[data-account="${ids.tulay}"] td:nth-child(3)`);
    await admin.waitForSelector(`${top} [data-act="whatsapp"]`);
    await admin.click(`${top} [data-act="whatsapp"]`);
    await admin.waitForSelector(`${top} [data-kind="statement"]`);
    await admin.waitForSelector(`${top} [data-history] li`);
    const text = await topText();
    ok(/Ekstre Gönder/.test(text) && /Mesaj Gönder/.test(text) && /Sohbeti Aç/.test(text), "üç seçenek");
    ok(/Son Gönderimler/.test(text) && /Ekstre/.test(text), "kartta gönderim geçmişi");
    await shot(admin, "cari-kart-whatsapp");
    await admin.click(`${top} [data-kind="statement"]`);
    await admin.waitForSelector(`${top} [data-start]`);
    await admin.click(`${top} [data-start]`);
    await admin.waitForSelector(`${top} [data-send]`);
    ok(/1 \/ 1/.test(await topText()), "tek cari: onay sorulmadan sıraya geçer");
    await admin.click(`${top} [data-send]`);
    await admin.waitForSelector(`${top} .hof-wa-done`);
    const history = await call(admin, `/api/workspace/whatsapp/history?accountId=${ids.tulay}`);
    ok(history.data.filter(row => row.status === "sent" && row.kind === "statement").length === 2, "Tülay: toplu ve tek ekstre, ikisi de kartında");
  });

  const balanceOf = async key => (await call(admin, `/api/workspace/accounts/${ids[key]}`)).data.totals.balance;
  const openCari = async key => {
    await openAccounts();
    await admin.click(`${top} tr[data-account="${ids[key]}"] td:nth-child(3)`);
    await admin.waitForSelector(`${top} [data-entry="in"]`);
    await admin.waitForTimeout(300);
  };
  const cashSummary = async () => (await call(admin, "/api/workspace/cash")).data;

  await step("5. Cari kartı → + Tahsilat → Tahsilat Yolu Kredi Kartı: Kasa ve Banka'da Kredi Kartı sekmesine düşer, nakde değil", async () => {
    await openCari("kemal");
    await admin.click(`${top} [data-entry="in"]`);
    await admin.waitForSelector(`${top} select[name="method"]`);
    const options = await admin.$$eval(`${top} select[name="method"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(["Nakit", "Havale / EFT", "Kredi Kartı"].every(label => options.includes(label)) && options.some(label => /Çek \/ Senet/.test(label)), `tahsilat yolları: ${options.join(", ")}`);
    await admin.fill(`${top} input[name="amount"]`, "1.000");
    await admin.selectOption(`${top} select[name="method"]`, "card");
    await shot(admin, "tahsilat-yolu-kredi-karti");
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForTimeout(800);
    ok((await balanceOf("kemal")) === 3800, "Kemal bakiyesi 4.800 − 1.000 = 3.800");
    const summary = await cashSummary();
    ok(summary.byMethod?.card === 1000 && (summary.byMethod?.cash || 0) === 0, `Kasa ve Banka: kart ${summary.byMethod?.card}, nakit ${summary.byMethod?.cash}`);
    await closeAll();
    await admin.click('#hof-sidecard [data-action="cash"]');
    await admin.waitForSelector(`${top} [data-methods]`);
    await admin.click(`${top} [data-methods] [data-method="card"]`);
    await admin.waitForTimeout(600);
    const text = await topText();
    ok(/Kemal Bakkal/.test(text) && /1\.000,00/.test(text), "Kredi Kartı sekmesinde Kemal'in tahsilatı");
    await shot(admin, "kasa-ve-banka-kredi-karti");
    await admin.click(`${top} [data-methods] [data-method="cash"]`);
    await admin.waitForTimeout(600);
    ok(!/Kemal Bakkal/.test(await topText()), "Nakit Kasa sekmesinde yok");
    await closeAll();
  });

  let item;
  const openItem = async () => {
    await closeAll();
    await admin.click('#hof-sidecard [data-action="stock"]');
    await admin.waitForSelector(`${top} tr[data-item="${item.id}"]`);
    await admin.click(`${top} tr[data-item="${item.id}"] td:nth-child(2)`);
    await admin.waitForSelector(`${top} [data-move="out"]`);
  };
  const saveMove = async () => {
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForTimeout(900);
  };

  await step("6. Stok: satış fiyatı hazır gelir; Kredi Kartı ile satış; nakit iadede Kasa eksiye düşecekse sorulur", async () => {
    const created = await call(admin, "/api/workspace/stock", { name: "Bebek Bezi", unit: "Paket", unitPrice: "300", salePrice: "400", openingQty: "50" });
    ok(created.status === 200, "ürün: alış 300, satış 400");
    item = created.data;
    await openItem();
    await admin.click(`${top} [data-move="out"]`);
    await admin.waitForSelector(`${top} select[name="pay"]`);
    ok((await admin.$eval(`${top} input[name="unitPrice"]`, node => node.value)) === "400,00", "satış birim fiyatı 400,00 hazır");
    await admin.fill(`${top} input[name="qty"]`, "2");
    await admin.selectOption(`${top} select[name="pay"]`, "card");
    await saveMove();
    ok((await cashSummary()).byMethod.card === 1800, "kart tahsilatı 1.000 + 800");
    await admin.click(`${top} [data-move="return"]`);
    await admin.waitForSelector(`${top} select[name="pay"]`);
    await admin.fill(`${top} input[name="qty"]`, "1");
    await admin.selectOption(`${top} select[name="pay"]`, "cash");
    await shot(admin, "musteri-iadesi");
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    ok(/Kasa Eksiye Düşecek/.test(await topText()), "nakit kasada para yok: onay soruldu");
    await shot(admin, "kasa-eksiye-uyari");
    await admin.click(`${top} [data-answer="no"]`);
    await admin.waitForTimeout(500);
    ok(((await cashSummary()).byMethod.cash || 0) === 0, "vazgeçince iade yazılmadı");
    await admin.selectOption(`${top} select[name="pay"]`, "account");
    await admin.fill(`${top} [data-acc-query]`, "Tülay");
    await admin.locator(`${top} .hof-case-picker-list li[data-id]`, { hasText: "Tülay Arıkan" }).first().click();
    await saveMove();
    ok((await balanceOf("tulay")) === 850, "açık hesaba iade: Tülay 1.250 − 400 = 850");
    const stock = (await call(admin, "/api/workspace/stock")).data.items.find(entry => entry.id === item.id);
    ok(stock.qty === 49, `stok 50 − 2 + 1 = ${stock.qty}`);
  });

  await step("7. Veresiye satışı taksitlendir: borç cariye bir kez yazılır (çift borç yok)", async () => {
    await openItem();
    await admin.click(`${top} [data-move="out"]`);
    await admin.waitForSelector(`${top} select[name="pay"]`);
    await admin.fill(`${top} input[name="qty"]`, "3");
    await admin.selectOption(`${top} select[name="pay"]`, "account");
    await admin.fill(`${top} [data-acc-query]`, "Kemal");
    await admin.locator(`${top} .hof-case-picker-list li[data-id]`, { hasText: "Kemal Bakkal" }).first().click();
    await admin.check(`${top} input[name="planIt"]`);
    await admin.fill(`${top} input[name="planCount"]`, "3");
    await admin.fill(`${top} input[name="planFirstDue"]`, "2026-10-15");
    await shot(admin, "satisi-taksitlendir");
    await saveMove();
    const kemal = (await call(admin, `/api/workspace/accounts/${ids.kemal}`)).data;
    ok(kemal.totals.balance === 5000, `Kemal: 3.800 + 1.200 = ${kemal.totals.balance} (6.200 değil)`);
    const plan = kemal.plans.find(entry => entry.coversBalance);
    ok(plan && plan.total === 1200, "taksit kartı mevcut borcu taksitlendiriyor (1.200)");
  });

  await step("8. Cari kartı → + Taksit Planı: Borcun Kaynağı carinin mevcut borcu; bakiye değişmez", async () => {
    await openCari("tulay");
    await admin.click(`${top} [data-act="newPlan"]`);
    await admin.waitForSelector(`${top} select[name="source"]`);
    ok((await admin.$eval(`${top} select[name="source"]`, node => node.value)) === "balance", "Borcun Kaynağı: Carinin Mevcut Borcu");
    ok((await admin.$eval(`${top} input[name="total"]`, node => node.value)) === "850,00", "tutar bakiyeden: 850,00");
    await admin.fill(`${top} input[name="count"]`, "2");
    await admin.fill(`${top} input[name="firstDue"]`, "2026-10-20");
    await shot(admin, "mevcut-borcu-taksitlendir");
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForTimeout(1200);
    ok((await balanceOf("tulay")) === 850, "Tülay bakiyesi 850 (ikinci kez borç yazılmadı)");
    await closeAll();
  });

  await step("9. Aynı adla ikinci cari: yazarken uyarı", async () => {
    await openAccounts();
    await admin.click(`${top} [data-act="new"]`);
    await admin.waitForSelector(`${top} input[name="name"]`);
    await admin.fill(`${top} input[name="name"]`, "Tülay Arıkan");
    await admin.waitForSelector(`${top} .hof-dup-hint:not([hidden])`, { timeout: 5000 });
    const hint = await admin.$eval(`${top} .hof-dup-hint`, node => node.innerText);
    ok(/1 cari aynı adla kayıtlı/.test(hint), `uyarı: ${hint.replace(/\s+/g, " ").slice(0, 100)}`);
    await shot(admin, "ayni-adli-cari");
    await closeAll();
  });

  await step("10. Raporlar → Ana Defter → Defter Mutabakatı: her hesap tutarlı; Hesap Planı Mizanı dengede", async () => {
    await closeAll();
    await admin.click('#hof-sidecard [data-action="analytics"]');
    await admin.waitForSelector(`${top} [data-tab="all"]`);
    await admin.click(`${top} [data-tab="all"]`);
    await admin.waitForSelector(`${top} [data-report="defter-mutabakati"]`, { timeout: 15000 });
    await admin.click(`${top} [data-report="defter-mutabakati"]`);
    await admin.waitForFunction(() => /Tutarlı|Fark Var/.test(document.querySelector(".hof-modal-backdrop.is-visible:last-of-type .hof-rc-table")?.innerText || ""), null, { timeout: 10000 });
    const table = await admin.$eval(`${top} .hof-rc-table`, node => node.innerText);
    ok(/Tutarlı/.test(table) && !/Fark Var/.test(table), "Defter Mutabakatı: fark yok");
    await shot(admin, "defter-mutabakati");
    const ledger = (await call(admin, "/api/workspace/ledger")).data;
    ok(ledger.reconciliation.ok && ledger.trial.balanced, `mizan dengede (borç ${ledger.trial.totals.debit} = alacak ${ledger.trial.totals.credit})`);
    await admin.click(`${top} [data-report="hesap-mizani"]`);
    await admin.waitForTimeout(1200);
    await shot(admin, "hesap-plani-mizani");
  });

  await step("11. Dönem Kilidi: Yönetim → Sistem'de kilitle; kapalı güne hareket reddedilir; formlarda ileri tarih seçilemez; kilit kaldırılır", async () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    await openCari("kemal");
    // (Kemal'in açık taksit kartı var; + Tahsilat önce "taksite mi?" diye sorar. Tarih alanı Borç Yaz formunda denetlenir.)
    await admin.click(`${top} [data-entry="debt"]`);
    await admin.waitForSelector(`${modal} form input[name="date"][max]`);
    const maxDay = await admin.$$eval(`${modal} form input[name="date"]`, nodes => nodes.at(-1).max);
    ok(maxDay === today(), `cari hareket formunda tarih seçici bugünden ileriyi göstermez (max = ${maxDay})`);
    await closeAll();
    await admin.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
    await admin.click('.adm-tabs [data-tab="system"]');
    await admin.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 8000 });
    await admin.waitForFunction(() => /Mutabakat:/.test(document.querySelector("#adm-integrity-status")?.textContent || ""), null, { timeout: 8000 });
    const health = await admin.textContent("#adm-integrity-status");
    ok(/kuruşu kuruşuna tutarlı/.test(health), `kartta mutabakat durumu: ${health.slice(0, 90)}`);
    ok((await admin.$eval("#adm-period-date", node => node.max)) === today(), "kilit tarihi bugünden ileri seçilemez");
    await admin.fill("#adm-period-date", yesterday);
    await admin.click("#adm-period-save");
    await admin.waitForFunction(() => /ve öncesi kilitli/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 8000 });
    ok(true, `kilitlendi: ${await admin.textContent("#adm-period-status")}`);
    await shot(admin, "donem-kilidi");
    const locked = await admin.evaluate(async day => {
      const response = await fetch("/api/workspace/cash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "in", amount: "10", date: day, description: "Kapalı güne" }) });
      return { status: response.status, ...(await response.json()) };
    }, yesterday);
    ok(locked.status === 409 && locked.code === "period-locked" && /kilitli/.test(locked.error || ""), `kapalı güne Kasa hareketi reddedildi: ${locked.error}`);
    await admin.click("#adm-period-clear");
    await admin.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    await admin.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    await admin.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 8000 });
    ok(true, "kilit kaldırıldı");
    // Eksi Bakiye Denetimi: varsayılan üç hesapta Uyar; Kredi Kartı Engelle yapılır, kaydedilir, geri alınır.
    await admin.waitForFunction(() => document.querySelector("#adm-negative-card")?.value === "warn", null, { timeout: 8000 });
    const defaults = await admin.$$eval("#adm-negative select", nodes => nodes.map(node => node.value));
    ok(defaults.join() === "warn,warn,warn", `Eksi Bakiye Denetimi varsayılanı: ${defaults.join(", ")}`);
    await admin.selectOption("#adm-negative-card", "block");
    await admin.click("#adm-negative-save");
    await admin.waitForFunction(() => /Eksi bakiye denetimi kaydedildi/.test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), null, { timeout: 8000 });
    const saved = await admin.evaluate(() => fetch("/api/admin/negative-policy").then(response => response.json()));
    ok(saved.data.card === "block" && saved.data.cash === "warn", `kaydedildi: ${JSON.stringify(saved.data)}`);
    await shot(admin, "eksi-bakiye-denetimi");
    await admin.selectOption("#adm-negative-card", "warn");
    await admin.click("#adm-negative-save");
    await admin.waitForTimeout(600);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
  });

  await step("Tarayıcı hataları", async () => {
    ok(errors.length === 0, errors.length ? `tarayıcı hataları: ${errors.join(" | ")}` : "hiçbir ekranda tarayıcı hatası yok");
  });

  console.log(`\n${results.filter(item => item.ok).length} / ${results.length} kontrol geçti.`);
} catch (error) {
  exitCode = 1;
  console.error(error);
  await shot(admin, "hata").catch(() => {});
} finally {
  if (errors.length) {
    console.error("Tarayıcı hataları:", errors);
    exitCode = 1;
  }
  fs.writeFileSync(path.join(OUT, "sonuc.json"), JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exit(exitCode);
}
