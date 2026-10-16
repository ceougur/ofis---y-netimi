// EDM TEST ORTAMI — İKİ ŞİRKET, ON KULLANICI, FARKLI MÜŞTERİ / SEKTÖR / KALEM + YEDEK TATBİKATI (kullanıcı, 16.10.2026: "hazır elimizde edm test
// imkanı varken çok kullanıcılı yüklü testler yap, müşteriler farklı olsun, kesen kullanıcı şirket farklı olsun, kalemler, sektörler farklı olsun";
// "sunucunun testler sonrası doğru yedeklemeyi aldığını da kontrol et").
//  Şirket 001 DESTEK OFİS (yazılım ve danışmanlık; Hizmet Satışı) · Şirket 002 ATLAS YAPI MALZEMELERİ LTD. ŞTİ. (inşaat malzemesi; Stoktan Satış).
//  Her şirkette 5 kullanıcı ayrı tarayıcı oturumunda, AYNI ANDA, ekrandan 6'şar belge (15 e-Fatura Temel/Ticari/Tevkifatlı/İstisnalı + 15 e-Arşiv
//  kişi ve firmaya; iskonto, %1/%10/%20, birimler). Sonra: iki kullanıcı AYNI belgeyi aynı anda gönderir; iki kullanıcı AYNI belgeyi aynı anda iptal
//  eder; farklı belgeler aynı anda iptal edilir. Denetim: numaralar şirket başına benzersiz/boşluksuz, tek gönderim, EDM son durumu, bakiyeler,
//  stok, defter bütünlüğü. YEDEK: sunucu kendi zamanlayıcısıyla yeniden açılır → otomatik yedek (iki şirket) → içerik canlı veriyle aynı mı;
//  elle Yedek Al → aynı; geri yükleme tatbikatı (002 anında, 001 yeniden açılışta) → sayılar yedekle aynı, sonrası değişiklik geri alındı, EDM
//  Durum Sorgula geri yüklemeden sonra da çalışıyor.
//  KİPLER: KURU=1 → sahte EDM (test/einvoice-mock.mjs; betik hatası ayıklama, belge harcamaz). Yoksa gerçek EDM test ortamı. Kimlik bilgisi yalnız
//  yüklenen dosyadan; çıktıda maskelenir. Canlı kilitli (edocLive yok). HUKUK_LICENSE_URL ölü adres (ders 30).
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const R = "/home/user/ofis---y-netimi";
const { chromium } = await import(`${R}/node_modules/playwright/index.mjs`);
const { createClient, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { createApp } = await import(`${R}/server/app.mjs`);
const { resolveDbPath } = await import(`${R}/server/lib/db-path.mjs`);
const { vkn: mockVkn, startMockEdm, OUR_VKN, BUYER_VKN } = await import(`${R}/test/einvoice-mock.mjs`);
const DRY = process.env.KURU === "1";
const credText = DRY ? "" : readFileSync(process.argv[2], "utf8");
const username = DRY ? "edmkullanici" : (credText.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = DRY ? "Gizli-Parola-1" : (credText.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3];
const WORK = process.argv[4];
rmSync(WORK, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const dataDir = path.join(WORK, "data");
const backupDir = path.join(WORK, "backups");
const mask = value => String(typeof value === "string" ? value : JSON.stringify(value ?? "")).split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value = "") => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === "" ? "" : `: ${mask(value).slice(0, 700)}`}`);
let pass = 0, fail = 0;
const check = (cond, what) => { cond ? (pass += 1) : (fail += 1); console.log(`  ${cond ? "✓" : "✗"} ${mask(what)}`); return Boolean(cond); };
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

const mock = DRY ? await startMockEdm() : null;
const SELLER_VKN = DRY ? OUR_VKN : "3230512384";
const EF_VKN = DRY ? BUYER_VKN : "3230512384";
const GB = DRY ? "urn:mail:defaultgb@deneme.com.tr" : "urn:mail:defaultgb@edmbilisim.com.tr";
const PK = DRY ? "urn:mail:defaultpk@alici.com.tr" : "urn:mail:defaultpk@edmbilisim.com.tr";

// ---------- Sunucu: sabit veri ve yedek klasörüyle (yeniden açılış + geri yükleme tatbikatı için) ----------
let app = null, base = "";
const boot = async ({ schedule = false } = {}) => {
  app = createApp({
    dataDir, backupDir, logLevel: "silent", scheduleBackups: schedule, backupOnStartDelayMs: 1500,
    env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9", HUKUK_BACKUP_INTERVAL_HOURS: "6" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, edocEnabled: true, moneyStrict: true, gateVerify: true, reportWorker: false,
  });
  const address = await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${address.port}`;
  const api = createClient(base);
  await api.login("admin", ADMIN_PASSWORD);
  return api;
};
let api = await boot();
const post = async (u, b) => unwrap(await api.post(u, b));
const put = async (u, b) => unwrap(await api.put(u, b));
const get = async u => unwrap(await api.get(u));
const selectCompany = async id => { const r = await post("/api/companies/select", { id }); if (r.status !== 200) throw new Error(`şirket seçilemedi ${JSON.stringify(r.data)}`); };
const dbFileOf = company => resolveDbPath(app.companies.dirsOf(company).dataDir);
const openRo = file => new DatabaseSync(file, { readOnly: true });
const tckn = seed => { const d = [1 + (seed % 9), ...String(seed * 7919 + 12345678).padStart(8, "0").slice(-8).split("").map(Number)]; const odd = d[0] + d[2] + d[4] + d[6] + d[8]; const even = d[1] + d[3] + d[5] + d[7]; d.push((((odd * 7 - even) % 10) + 10) % 10); d.push(d.reduce((a, b) => a + b, 0) % 10); return d.join(""); };

const seq = 100_000_000 + Math.floor(Math.random() * 700_000_000);
const year = new Date().getFullYear();
const jpeg = file => `data:image/jpeg;base64,${readFileSync(`${R}/docs/pazarlama/${file}`).toString("base64")}`;
const COMPANIES = [
  { code: "001", name: "DESTEK OFİS", sector: "Yazılım ve Danışmanlık", scenario: "service_sale", start: seq,
    seller: { name: "DESTEK OFİS", taxNo: SELLER_VKN, taxOffice: "Kadıköy", address: "Caferağa Mh. Moda Cd. 12", district: "Kadıköy", city: "İstanbul", postalCode: "34710", email: "bilgi@destekofis.com.tr", logo: jpeg("DestekOfis-Logo-Fatura-Yatay.jpg"), banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
    footer: "DESTEK OFİS — yazılım, kurulum ve danışmanlık hizmetleri.",
    efatura: [
      { name: "Yıldız Hukuk Bürosu", sector: "Hukuk", city: "İstanbul" },
      { name: "Kuzey Emlak Danışmanlık Ltd. Şti.", sector: "Emlak", city: "Bursa" },
      { name: "Marmara Gıda San. ve Tic. A.Ş.", sector: "Gıda", city: "Kocaeli" },
    ],
    earsiv: [
      { name: "Mehmet Demir", person: ["Mehmet", "Demir"], sector: "Bireysel (Serbest Meslek)", city: "İzmir" },
      { name: "Güneş Kafe Gıda Ltd. Şti.", firm: true, sector: "Kafe / Restoran", city: "Antalya" },
      { name: "Zeynep Arslan", person: ["Zeynep", "Arslan"], sector: "Bireysel", city: "Ankara" },
    ],
  },
  { code: "002", name: "ATLAS YAPI MALZEMELERİ LTD. ŞTİ.", sector: "İnşaat Malzemesi Ticareti", scenario: "goods_sale", start: seq + 500_000,
    seller: { name: "ATLAS YAPI MALZEMELERİ LTD. ŞTİ.", taxNo: SELLER_VKN, taxOffice: "Ostim", address: "Ostim OSB 1234. Cd. No: 8", district: "Yenimahalle", city: "Ankara", postalCode: "06374", email: "satis@atlasyapi.com.tr", stamp: jpeg("DestekOfis-Logo-Fatura-Kare.jpg"), banks: [{ name: "Örnek Katılım Bankası A.Ş.", iban: "TR040020500009000012345678" }] },
    footer: "ATLAS YAPI — teslimde irsaliye ile kontrol ediniz.",
    efatura: [
      { name: "Başkent İnşaat Taahhüt A.Ş.", sector: "İnşaat Taahhüt", city: "Ankara" },
      { name: "Ege Tekstil Konfeksiyon Ltd. Şti.", sector: "Tekstil", city: "Denizli" },
      { name: "Akdeniz Otelcilik ve Turizm A.Ş.", sector: "Turizm", city: "Muğla" },
    ],
    earsiv: [
      { name: "Can Öztürk", person: ["Can", "Öztürk"], sector: "Bireysel (Ev Tadilatı)", city: "Eskişehir" },
      { name: "Deniz Oto Servis Ltd. Şti.", firm: true, sector: "Otomotiv Servisi", city: "Konya" },
      { name: "Elif Şahin", person: ["Elif", "Şahin"], sector: "Bireysel", city: "Kayseri" },
    ],
    stock: [
      { name: "Portland Çimento 50 Kg", unit: "Çuval", salePrice: 285, unitPrice: 210 },
      { name: "İnşaat Demiri Q12", unit: "Kg", salePrice: 28.5, unitPrice: 22 },
      { name: "İç Cephe Boyası 15 Lt", unit: "Teneke", salePrice: 1450, unitPrice: 1100 },
      { name: "Seramik Yer Karosu 60x60", unit: "M²", salePrice: 425, unitPrice: 300 },
      { name: "Kırmızı Tuğla 13,5", unit: "Adet", salePrice: 6.75, unitPrice: 4.5 },
    ],
  },
];
const OPENING_QTY = 100000;
// Belge kalıpları: k = kalıp sırası; ui = kullanıcı sırası (miktar çarpanı). c = cari indeksi.
const TEMPLATES = {
  "001": [
    { kind: "eF-Temel", to: ["efatura", 0], how: "issue-now", lines: m => [{ name: "Muhasebe Yazılımı Lisansı", unit: "Adet", qty: m, price: 2500, vat: 20 }, { name: "Kurulum ve Eğitim", unit: "Saat", qty: 4, price: 750, vat: 20, disc: 10 }] },
    { kind: "eA", to: ["earsiv", 0], how: "issue-now", lines: m => [{ name: "Bireysel Lisans", unit: "Adet", qty: 1, price: 1200, vat: 20 }, { name: "Online Eğitim", unit: "Kişi", qty: m, price: 450, vat: 10 }] },
    { kind: "eF-Ticari", to: ["efatura", 1], how: "issue-later", profile: "TICARIFATURA", lines: m => [{ name: "Emlak Portföy Yazılımı Aboneliği", unit: "Ay", qty: 2 + m, price: 900, vat: 20 }] },
    { kind: "eA", to: ["earsiv", 1], how: "issue-later", lines: m => [{ name: "Adisyon Yazılımı Kurulumu", unit: "Adet", qty: 1, price: 3000, vat: 20, disc: 5 }, { name: "El Terminali Kılıfı", unit: "Adet", qty: m, price: 150, vat: 1 }] },
    { kind: "eF-Tevkifat", to: ["efatura", 2], how: "issue-now", lines: m => [{ name: "Yazılım Danışmanlığı", unit: "Saat", qty: 5 * m, price: 1000, vat: 20, wh: "602" }] },
    { kind: "eA", to: ["earsiv", 2], how: "issue-now", lines: m => [{ name: "Teknik Destek Paketi", unit: "Ay", qty: m, price: 600, vat: 20 }] },
  ],
  "002": [
    { kind: "eF-Temel", to: ["efatura", 0], how: "issue-now", lines: m => [{ stock: 0, qty: 100 * m }, { stock: 1, qty: 1000 * m }] },
    { kind: "eA", to: ["earsiv", 0], how: "issue-now", lines: m => [{ stock: 3, qty: 20 * m }, { stock: 2, qty: 2 }] },
    { kind: "eF-Ticari", to: ["efatura", 1], how: "issue-later", profile: "TICARIFATURA", lines: m => [{ stock: 2, qty: 5 * m, disc: 8 }] },
    { kind: "eA", to: ["earsiv", 1], how: "issue-later", lines: m => [{ stock: 4, qty: 1000 * m }] },
    { kind: "eF-İstisna", to: ["efatura", 2], how: "issue-now", lines: m => [{ stock: 3, qty: 50 * m, vat: 0, ex: "301" }, { stock: 1, qty: 200, disc: 2 }] },
    { kind: "eA", to: ["earsiv", 2], how: "issue-now", lines: m => [{ stock: 2, qty: 1 }, { stock: 4, qty: 200 * m }] },
  ],
};

const browser = await chromium.launch();
const modal = ".hof-modal-backdrop.is-visible";
const last = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;
const errors = [];
const session = async (tag, login, pass_, companyId) => {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener("DOMContentLoaded", () => {
      document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }));
      new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".hof-toast") || n.querySelector?.(".hof-toast"))) window.__toasts.push((n.matches(".hof-toast") ? n : n.querySelector(".hof-toast")).textContent.replace(/\s+/g, " ").trim()); }).observe(document.body, { childList: true, subtree: true });
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => errors.push(`${tag}: ${error.message}`));
  const pause = ms => page.waitForTimeout(ms);
  const ui = {
    tag, page, pause,
    textOf: selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => ""),
    toasts: () => page.evaluate(() => window.__toasts.splice(0)),
    shot: name => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) }),
    closeAll: async () => { for (let i = 0; i < 5 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(250); } },
    yesIfAsked: async (tries = 12) => { for (let i = 0; i < tries; i += 1) { await pause(400); const yes = await page.$(`${modal} [data-answer="yes"]`); if (yes) { await yes.click().catch(() => {}); return true; } } return false; },
    clickAct: async act => { await page.waitForSelector(`${inv} [data-act="${act}"]`, { timeout: 30000 }); await page.click(`${inv} [data-act="${act}"]`); },
    openDoc: async id => { await ui.closeAll(); await page.evaluate(docId => window.HOF.invoices.openDoc(docId), id); await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 30000 }); await pause(400); },
  };
  await page.goto(`${base}/`);
  await page.fill("#hof-auth input[name=username]", login);
  await page.fill("#hof-auth input[name=password]", pass_);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  // Kullanıcının şirketi (yetkisi yalnız bu şirkette): seçili değilse seçilir, sayfa yenilenir (şirket değişince istemci yenilenir).
  const current = await page.evaluate(async () => (await (await fetch("/api/companies")).json()));
  const now = current?.data?.current || current?.current;
  if (now !== companyId) {
    await page.evaluate(async id => fetch("/api/companies/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }), companyId);
    await page.reload();
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  }
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 30000 });
  return ui;
};
const newSale = async (ui, company, account, lines, { profile = "" } = {}) => {
  const { page, pause } = ui;
  await ui.closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="${company.scenario}"]`);
  await page.waitForSelector(`${inv} [data-lines]`);
  await page.click(`${inv} [data-acc-query]`);
  await page.keyboard.type(account.name.split(" ")[0], { delay: 25 });
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${account.id}"]`, { timeout: 20000 });
  await (await page.$(`${inv} .hof-acc-picker li[data-id="${account.id}"]`)).dispatchEvent("mousedown");
  await pause(700);
  for (const [index, line] of lines.entries()) {
    if (index > 0) { await page.click(`${inv} [data-act="add-line"]`); await pause(300); }
    const f = field => `${inv} [data-l="${index}"][data-f="${field}"]`;
    await page.click(f("name"));
    if (line.item) {
      await page.keyboard.type(line.item.name, { delay: 20 });
      const hit = `${inv} li[data-item="${line.item.id}"]`;
      await page.waitForSelector(hit, { timeout: 20000 });
      await page.click(hit);
      await pause(500);
    } else {
      await page.keyboard.type(line.name, { delay: 20 });
      await page.keyboard.press("Tab");
      if (line.unit) { await page.click(f("unit"), { clickCount: 3 }); await page.keyboard.type(line.unit, { delay: 20 }); await page.keyboard.press("Tab"); }
    }
    for (const [field, value] of [["qty", line.qty], ["unitPrice", line.item ? null : line.price]]) {
      if (value === null || value === undefined) continue;
      await page.click(f(field), { clickCount: 3 });
      await page.keyboard.type(String(value).replace(".", ","), { delay: 20 });
      await page.keyboard.press("Tab");
    }
    if (line.vat !== undefined) { await page.selectOption(f("vatRate"), String(line.vat)); await pause(300); }
    if (line.disc) { await page.click(f("discountRate"), { clickCount: 3 }); await page.keyboard.type(String(line.disc), { delay: 20 }); await page.keyboard.press("Tab"); }
    if (line.wh || line.ex) {
      const hidden = await page.$eval(`${inv} tr[data-line="${index}"] + tr .hof-inv-line-more, ${inv} tr[data-line="${index}"] .hof-inv-line-more`, node => node.hidden).catch(() => true);
      if (hidden) { await page.click(`${inv} [data-act="line-more"][data-l="${index}"]`); await pause(300); }
      if (line.wh) await page.selectOption(f("withholdingCode"), line.wh);
      if (line.ex) await page.selectOption(f("exemptionCode"), line.ex);
      await pause(300);
    }
  }
  await pause(500);
  if (profile) {
    await page.waitForSelector(`${inv} [data-profile-field]:not([hidden]) select`, { timeout: 20000 });
    await page.selectOption(`${inv} [data-f="profile"]`, profile);
    await pause(400);
  }
};
const cancelForm = async (ui, id, reason) => {
  await ui.openDoc(id);
  await ui.toasts();
  await ui.clickAct("cancel");
  await ui.page.waitForSelector(`${last} input[name="reason"]`);
  await ui.page.click(`${last} input[name="reason"]`);
  await ui.page.keyboard.type(reason, { delay: 20 });
};

const result = { mode: DRY ? "KURU (sahte EDM)" : "GERÇEK EDM TEST", companies: [], docs: [], races: {}, backup: {} };
const companyState = {};
try {
  // ---------- Şirketler ----------
  const listed = await get("/api/companies");
  const c1 = listed.data.current;
  await put(`/api/companies/${c1}`, { name: COMPANIES[0].name });
  const created = await post("/api/companies", { code: "002", name: COMPANIES[1].name, select: false });
  check(created.status === 200, `şirket 002 açıldı (${created.status} ${created.status === 200 ? "" : JSON.stringify(created.data).slice(0, 160)})`);
  const c2 = created.data.company.id;
  COMPANIES[0].id = c1;
  COMPANIES[1].id = c2;
  for (const company of COMPANIES) {
    await selectCompany(company.id);
    await post("/api/workspace/bank/setup/dismiss", {});
    const s = await put("/api/workspace/invoices/settings", {
      seller: company.seller, efatura: true, earsiv: true, start: { [`TEF${year}`]: company.start, [`TEA${year}`]: company.start },
      defaults: { footer: company.footer }, eView: { enabled: true, logo: true, banks: true, footer: true, stamp: true, stampEfatura: false },
      integrator: { env: "test", baseUrl: DRY ? mock.url : "", username, password, senderAlias: GB, mailboxAlias: PK, autoCheckUser: true },
    });
    check(s.status === 200, `${company.code} Fatura Ayarları + entegratör (${s.status} ${s.status === 200 ? "" : JSON.stringify(s.data).slice(0, 200)})`);
    const test = await post("/api/workspace/invoices/integrator/test", {});
    check(test.status === 200, `${company.code} Bağlantıyı Test Et (${test.status})`);
    // Cariler: e-Fatura alıcıları (EDM test hesabında kayıtlı tek VKN; adlar ve sektörler farklı) ve e-Arşiv alıcıları (kişi TCKN / firma VKN —
    // mükellef OLMADIĞI sorgulanmış). Kimlik numaraları sağlama haneli üretilir.
    const accounts = { efatura: [], earsiv: [] };
    for (const [i, buyer] of company.efatura.entries()) {
      const r = await post("/api/workspace/accounts", { name: buyer.name, type: "customer", taxNo: EF_VKN, taxOffice: "Merkez", address: `${buyer.sector} Sk. ${i + 1}`, district: "Merkez", city: buyer.city, eInvoice: true, eAlias: PK, note: `Sektör: ${buyer.sector}` });
      if (r.status !== 200) throw new Error(`cari ${buyer.name}: ${JSON.stringify(r.data)}`);
      accounts.efatura.push({ ...buyer, id: r.data.id || r.data.account?.id });
    }
    let probe = company.code === "001" ? 11 : 51;
    for (const [i, buyer] of company.earsiv.entries()) {
      let taxNo = "";
      for (let tries = 0; tries < 8 && !taxNo; tries += 1, probe += 1) {
        const candidate = buyer.firm ? mockVkn(300000000 + probe * 7777 + (company.code === "001" ? 0 : 99)) : tckn(probe * 104729);
        const q = await post("/api/workspace/invoices/check-user", { taxNo: candidate });
        if (q.status === 200 && q.data?.registered === false) taxNo = candidate;
      }
      if (!taxNo) throw new Error(`${buyer.name}: mükellef olmayan kimlik bulunamadı`);
      const r = await post("/api/workspace/accounts", { name: buyer.name, type: "customer", partyKind: buyer.person ? "person" : "", firstName: buyer.person?.[0] || "", familyName: buyer.person?.[1] || "", taxNo, taxOffice: "Merkez", address: `${buyer.sector} Sk. ${i + 10}`, district: "Merkez", city: buyer.city, email: "alici@example.com", note: `Sektör: ${buyer.sector}` });
      if (r.status !== 200) throw new Error(`cari ${buyer.name}: ${JSON.stringify(r.data)}`);
      accounts.earsiv.push({ ...buyer, id: r.data.id || r.data.account?.id, taxNo });
    }
    const items = [];
    for (const item of company.stock || []) {
      const r = await post("/api/workspace/stock", { name: item.name, unit: item.unit, kind: "goods", salePrice: item.salePrice, unitPrice: item.unitPrice, openingQty: OPENING_QTY, openingPay: "none" });
      if (r.status !== 200) throw new Error(`stok ${item.name}: ${JSON.stringify(r.data)}`);
      items.push({ ...item, id: r.data.id || r.data.item?.id });
    }
    // İade için: e-Fatura mükellefi tedarikçi + ondan alınmış (numarası 16 haneli) alış faturası.
    const supplier = await post("/api/workspace/accounts", { name: company.code === "001" ? "Anadolu Bilişim Dağıtım A.Ş." : "Orta Anadolu Çimento Pazarlama A.Ş.", type: "supplier", taxNo: EF_VKN, taxOffice: "Merkez", address: "Sanayi Cd. 5", district: "Merkez", city: "Ankara", eInvoice: true, eAlias: PK });
    if (supplier.status !== 200) throw new Error(`tedarikçi: ${JSON.stringify(supplier.data)}`);
    let goods = items[0];
    if (!goods) {
      const r = await post("/api/workspace/stock", { name: "Barkod Okuyucu", unit: "Adet", kind: "goods", salePrice: 2400, unitPrice: 1500, openingQty: 0, openingPay: "none" });
      if (r.status !== 200) throw new Error(`stok: ${JSON.stringify(r.data)}`);
      goods = { name: "Barkod Okuyucu", unit: "Adet", id: r.data.id || r.data.item?.id };
    }
    const purchase = await post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: supplier.data.id || supplier.data.account?.id, number: `${company.code === "001" ? "ANB" : "OAC"}${year}000000${company.code === "001" ? "417" : "582"}`, lines: [{ itemId: goods.id, name: goods.name, qty: 10, unitPrice: company.code === "001" ? 1500 : 210, vatRate: 20 }], payment: { rest: "open" } });
    if (purchase.status !== 200) throw new Error(`alış faturası: ${JSON.stringify(purchase.data)}`);
    const supplierAccount = { name: supplier.data.name || (company.code === "001" ? "Anadolu Bilişim Dağıtım A.Ş." : "Orta Anadolu Çimento Pazarlama A.Ş."), sector: "Tedarikçi", id: supplier.data.id || supplier.data.account?.id };
    log(`${company.code} ALIŞ FATURASI (iade için)`, { no: purchase.data.number, tedarikci: supplierAccount.name, tutar: purchase.data.tryPayable });
    companyState[company.code] = { company, accounts, items, purchase: purchase.data.id, supplier: supplierAccount };
    log(`${company.code} CARİLER`, { efatura: accounts.efatura.map(a => a.name), earsiv: accounts.earsiv.map(a => `${a.name} (${a.taxNo.length === 11 ? "TCKN" : "VKN"})`), stok: items.map(i => i.name) });
  }
  // ---------- Kullanıcılar: her şirkete 5 (yalnız kendi şirketini görür) ----------
  const ROLES = ["muhasebe", "muhasebe", "avukat", "muhasebe", "avukat"];
  const users = [];
  for (const company of COMPANIES) {
    for (const [i, role] of ROLES.entries()) {
      const login = `${company.code === "001" ? "destek" : "atlas"}${i + 1}`;
      const pw = `Yuk!2026-${login}x`;
      const r = await post("/api/admin/users", { username: login, name: `${company.code === "001" ? "Destek" : "Atlas"} Kullanıcı ${i + 1}`, role, password: pw, mustChangePassword: false });
      if (r.status !== 200) throw new Error(`kullanıcı ${login}: ${JSON.stringify(r.data)}`);
      const id = app.store.get("SELECT id FROM users WHERE username = ?", login).id;
      const a = await put(`/api/companies/access/${id}`, { companies: [company.id] });
      if (a.status !== 200) throw new Error(`yetki ${login}: ${JSON.stringify(a.data)}`);
      users.push({ login, pw, role, id, company: company.code, ui: i });
    }
  }
  check(users.length === 10, "10 kullanıcı açıldı, her biri yalnız kendi şirketinde yetkili");
  const sessions = await Promise.all(users.map(u => session(u.login, u.login, u.pw, COMPANIES.find(c => c.code === u.company).id)));
  log("OTURUMLAR", sessions.map(s => s.tag));
  const dbs = Object.fromEntries(COMPANIES.map(c => [c.code, openRo(dbFileOf(app.companies.get(c.id)))]));
  const rowOf = (code, id) => dbs[code].prepare("SELECT id, number, ettn, profile, type_code AS typeCode, status, e_status AS eStatus, e_message AS eMessage, try_payable AS payable, account_id AS accountId FROM invoices WHERE id = ?").get(id);
  const lastCreatedBy = (code, actorId) => dbs[code].prepare("SELECT entity_id AS id FROM audit_events WHERE type = 'invoice.created' AND actor_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(actorId)?.id || "";

  // ---------- Plan ----------
  const plan = users.map(user => {
    const st = companyState[user.company];
    const list = TEMPLATES[user.company].map((_, k) => {
      const t = TEMPLATES[user.company][(k + user.ui) % 6];
      const m = 1 + ((k + user.ui) % 3);
      const account = st.accounts[t.to[0]][t.to[1]];
      const lines = t.lines(m).map(line => (line.stock !== undefined ? { ...line, item: st.items[line.stock], name: st.items[line.stock].name, unit: st.items[line.stock].unit, price: st.items[line.stock].salePrice, vat: line.vat ?? 20 } : line));
      return { company: user.company, kind: t.kind, how: t.how, profile: t.profile || "", account, lines };
    });
    // Yarış belgesi (şirketin 1. kullanıcısı): kaydedilir, gönderilmez; sonra iki kullanıcı aynı anda "e-Belge Gönder" der.
    if (user.ui === 0) list.push({ company: user.company, kind: "eF-Temel (yarış)", how: "hold", profile: "", account: companyState[user.company].accounts.efatura[0], lines: user.company === "001" ? [{ name: "Yarış Deneme Hizmeti", unit: "Adet", qty: 1, price: 100, vat: 20 }] : [{ item: companyState["002"].items[4], name: companyState["002"].items[4].name, unit: "Adet", qty: 10, price: 6.75, vat: 20 }] });
    // Alıştan İade e-Faturası (2. kullanıcı, kesimin ortasında): GİB fatura türü TEMEL / IADE.
    if (user.ui === 1) list.splice(3, 0, { company: user.company, kind: "eF-İade", how: "return", profile: "", account: companyState[user.company].supplier, original: companyState[user.company].purchase, qty: 2, lines: [] });
    return list;
  });

  // ---------- Eşzamanlı kesim ----------
  const started = Date.now();
  const worker = async (ui, user, list) => {
    const done = [];
    for (const [n, p] of list.entries()) {
      const t0 = Date.now();
      try {
        if (p.how === "return") {
          // Alıştan İade: alış faturası kartı → İade → kısmi miktar → Kaydet ve Gönder (TEMELFATURA / IADE, asıl faturaya bağlı).
          await ui.openDoc(p.original);
          await ui.clickAct("return");
          await ui.page.waitForSelector(`${inv} [data-l="0"][data-f="qty"]`, { timeout: 30000 });
          await ui.pause(800);
          await ui.page.click(`${inv} [data-l="0"][data-f="qty"]`, { clickCount: 3 });
          await ui.page.keyboard.type(String(p.qty), { delay: 20 });
          await ui.page.keyboard.press("Tab");
          await ui.pause(600);
          await ui.toasts();
          await ui.page.click(`${inv} [data-act="issue-now"]`);
          await ui.yesIfAsked();
          await ui.page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 60000 });
          await ui.pause(1500);
          const id = lastCreatedBy(user.company, user.id);
          const row = rowOf(user.company, id);
          const toasts = await ui.toasts();
          done.push({ ...p, user: user.login, role: user.role, id, ms: Date.now() - t0, toasts, number: row.number, eStatus: row.eStatus });
          log(`${ui.tag} #${n + 1} ${p.kind} → ${p.account.name}`, { no: row.number, profil: row.profile, tip: row.typeCode, eStatus: row.eStatus, tutar: row.payable, ileti: toasts.slice(-1)[0] || "" });
          continue;
        }
        await newSale(ui, companyState[user.company].company, p.account, p.lines, { profile: p.profile });
        await ui.toasts();
        await ui.page.click(`${inv} [data-act="${p.how === "issue-now" ? "issue-now" : "issue-later"}"]`);
        await ui.yesIfAsked();
        await ui.page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 60000 });
        await ui.pause(1200);
        const id = lastCreatedBy(user.company, user.id);
        if (p.how === "issue-later") {
          const before = rowOf(user.company, id);
          if (!(before.eStatus === "waiting" && before.number === "")) log(`${ui.tag} #${n + 1} BEKLENMEYEN (Sonra Gönder)`, before);
          await ui.clickAct("e-send");
          await ui.yesIfAsked(6);
          for (let i = 0; i < 40 && ["waiting", "none"].includes(rowOf(user.company, id).eStatus); i += 1) await ui.pause(500);
        }
        const row = rowOf(user.company, id);
        const toasts = await ui.toasts();
        done.push({ ...p, user: user.login, role: user.role, id, ms: Date.now() - t0, toasts, number: row.number, eStatus: row.eStatus });
        log(`${ui.tag} #${n + 1} ${p.kind} ${p.how} → ${p.account.name}`, { no: row.number || "(numarasız)", profil: row.profile, tip: row.typeCode, eStatus: row.eStatus, tutar: row.payable, sn: Math.round((Date.now() - t0) / 1000), ileti: toasts.slice(-1)[0] || "" });
      } catch (error) {
        await ui.shot(`hata-${n + 1}`).catch(() => {});
        log(`${ui.tag} #${n + 1} HATA`, String(error?.message || error).slice(0, 400));
        done.push({ ...p, user: user.login, error: String(error?.message || error).slice(0, 300) });
      }
    }
    await ui.shot("son");
    return done;
  };
  console.log("\n■ 10 kullanıcı (2 şirket) aynı anda başlıyor");
  const kesilen = (await Promise.all(sessions.map((ui, i) => worker(ui, users[i], plan[i])))).flat();
  let all = kesilen.filter(d => !d.error);
  log("KESİM SÜRESİ (sn)", Math.round((Date.now() - started) / 1000));
  check(kesilen.every(d => !d.error), `64 belge ekrandan kesildi (hatalı ${kesilen.filter(d => d.error).length})`);

  // ---------- Yarış 1: iki kullanıcı AYNI belgeyi aynı anda gönderir ----------
  console.log("\n■ Yarış 1 — iki kullanıcı aynı belgeye aynı anda e-Belge Gönder");
  for (const company of COMPANIES) {
    const holder = all.find(d => d.company === company.code && d.how === "hold");
    const [a, b] = sessions.filter((s, i) => users[i].company === company.code).slice(0, 2);
    await Promise.all([a.openDoc(holder.id), b.openDoc(holder.id)]);
    await Promise.all([a.toasts(), b.toasts()]);
    await Promise.all([a.page.click(`${inv} [data-act="e-send"]`), b.page.click(`${inv} [data-act="e-send"]`)]);
    await Promise.all([a.yesIfAsked(6), b.yesIfAsked(6)]);
    await sleep(6000);
    const row = rowOf(company.code, holder.id);
    const sends = dbs[company.code].prepare("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'invoice.e.sent' AND entity_id = ?").get(holder.id).n;
    const msgs = { [a.tag]: await a.toasts(), [b.tag]: await b.toasts() };
    log(`${company.code} YARIŞ 1`, { no: row.number, eStatus: row.eStatus, gonderim: sends, iletiler: msgs });
    check(sends === 1 && /^TEF/.test(row.number), `${company.code} aynı belgeye iki gönderim → EDM'ye BİR kez gitti (${row.number}), öbür kullanıcıya ileti verildi`);
    holder.number = row.number;
    holder.eStatus = row.eStatus;
    result.races[`gonder-${company.code}`] = { no: row.number, gonderim: sends, iletiler: msgs };
  }

  // ---------- Kesim sonrası denetim ----------
  console.log("\n■ Kesim sonrası denetim (şirket başına)");
  for (const company of COMPANIES) {
    const docs = all.filter(d => d.company === company.code && !d.error);
    for (const d of docs) Object.assign(d, rowOf(company.code, d.id));
    const tef = docs.filter(d => d.kind.startsWith("eF")).map(d => d.number).sort();
    const tea = docs.filter(d => d.kind === "eA").map(d => d.number).sort();
    const consecutive = list => list.every((no, i) => Number(no.slice(7)) === company.start + i);
    check(docs.length === 32 && new Set(docs.map(d => d.id)).size === 32, `${company.code} 32 ayrı belge (${docs.length})`);
    check(tef.length === 17 && new Set(tef).size === 17 && consecutive(tef), `${company.code} e-Fatura TEF benzersiz + boşluksuz ${tef[0]} … ${tef.at(-1)}`);
    check(tea.length === 15 && new Set(tea).size === 15 && consecutive(tea), `${company.code} e-Arşiv TEA benzersiz + boşluksuz ${tea[0]} … ${tea.at(-1)}`);
    const wantType = { "eF-Tevkifat": "TEVKIFAT", "eF-İstisna": "ISTISNA", "eF-İade": "IADE" };
    check(docs.every(d => (d.kind === "eA") === (d.profile === "EARSIVFATURA") && (d.kind !== "eF-Ticari" || d.profile === "TICARIFATURA") && (!wantType[d.kind] || d.typeCode === wantType[d.kind])), `${company.code} belge türleri plana uygun (Temel/Ticari/e-Arşiv; TEVKIFAT/ISTISNA tipi)`);
    const sends = new Map(dbs[company.code].prepare("SELECT entity_id AS id, COUNT(*) AS n, MAX(actor_id) AS actor FROM audit_events WHERE type = 'invoice.e.sent' GROUP BY entity_id").all().map(r => [r.id, r]));
    check(docs.every(d => sends.get(d.id)?.n === 1), `${company.code} her belge EDM'ye BİR kez gönderildi`);
    check(docs.filter(d => d.how !== "hold").every(d => sends.get(d.id)?.actor === users.find(u => u.login === d.user).id), `${company.code} her belge kesen kullanıcının adıyla gönderildi`);
  }
  // Öbür şirketin kaydı görünmüyor (yetki): Destek kullanıcısı Atlas belgesini açamaz.
  const crossDoc = all.find(d => d.company === "002");
  const cross = await sessions[0].page.evaluate(async id => (await fetch(`/api/workspace/invoices/${id}`)).status, crossDoc.id);
  check(cross === 404 || cross === 403, `001 kullanıcısı 002'nin belgesini göremiyor (${cross})`);

  // ---------- EDM son durum ----------
  const settle = async (rounds = 22) => {
    for (let round = 1; round <= rounds; round += 1) {
      let open = 0;
      const counts = {};
      for (const company of COMPANIES) {
        await selectCompany(company.id);
        for (const d of all.filter(x => x.company === company.code)) {
          // İlk turda bütün belgeler sorgulanır (ekrandaki Durum Sorgula); sonra yalnız işlenmekte olanlar. Sahte EDM ilk sorguda "işleniyor" der.
          const pending = rowOf(company.code, d.id).eStatus === "processing";
          if (round === 1 || pending) for (let k = 0; k < (DRY && round === 1 ? 2 : 1); k += 1) await post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
          const s = rowOf(company.code, d.id).eStatus;
          counts[`${company.code}:${s}`] = (counts[`${company.code}:${s}`] || 0) + 1;
          if (s === "processing") open += 1;
        }
      }
      log(`DURUM TURU ${round}`, counts);
      if (!open) return;
      await sleep(DRY ? 300 : 40_000);
    }
  };
  console.log("\n■ Durum Sorgula — 64 belge, son duruma kadar");
  await settle();
  for (const company of COMPANIES) for (const d of all.filter(x => x.company === company.code)) Object.assign(d, rowOf(company.code, d.id));
  check(all.every(d => d.eStatus === "sent"), `64 belgenin son durumu Gönderildi (${all.filter(d => d.eStatus !== "sent").map(d => `${d.number}:${d.eStatus} ${d.eMessage || ""}`).join(" | ") || "hepsi"})`);

  // ---------- Yarış 2: iki kullanıcı AYNI e-Arşivi aynı anda iptal eder; Yarış 3: farklı belgeler aynı anda iptal ----------
  console.log("\n■ Yarış 2 — iki kullanıcı aynı e-Arşivi aynı anda iptal; Yarış 3 — dört farklı e-Arşiv aynı anda iptal");
  const cancelled = [];
  for (const company of COMPANIES) {
    const own = sessions.filter((s, i) => users[i].company === company.code);
    const target = all.find(d => d.company === company.code && d.kind === "eA" && d.user === users.find(u => u.company === company.code && u.ui === 4).login);
    const [a, b] = [own[2], own[3]];
    await Promise.all([cancelForm(a, target.id, "Yarış iptali A"), cancelForm(b, target.id, "Yarış iptali B")]);
    await Promise.all([a.page.click(`${last} button[type="submit"]`), b.page.click(`${last} button[type="submit"]`)]);
    await sleep(6000);
    const row = rowOf(company.code, target.id);
    const n = type => dbs[company.code].prepare("SELECT COUNT(*) AS n FROM audit_events WHERE type = ? AND entity_id = ?").get(type, target.id).n;
    const msgs = { [a.tag]: [...(await a.toasts()), await a.textOf(`${last} .hof-form-error`)].filter(Boolean), [b.tag]: [...(await b.toasts()), await b.textOf(`${last} .hof-form-error`)].filter(Boolean) };
    log(`${company.code} YARIŞ 2`, { no: row.number, status: row.status, eStatus: row.eStatus, iptal: n("invoice.cancelled"), eIptal: n("invoice.e.cancelled"), iletiler: msgs });
    check(row.status === "cancelled" && n("invoice.cancelled") === 1 && n("invoice.e.cancelled") <= 1, `${company.code} aynı belgeye iki iptal → BİR kez iptal edildi (${row.number}; ${row.eStatus})`);
    result.races[`iptal-${company.code}`] = { no: row.number, iptal: n("invoice.cancelled"), eIptal: n("invoice.e.cancelled"), iletiler: msgs };
    cancelled.push(target.id);
    await Promise.all([a.closeAll(), b.closeAll()]);
  }
  const parallelTargets = COMPANIES.flatMap(company => all.filter(d => d.company === company.code && d.kind === "eA" && !cancelled.includes(d.id)).slice(0, 2).map((d, i) => ({ d, ui: sessions.filter((s, j) => users[j].company === company.code)[i] })));
  await Promise.all(parallelTargets.map(({ d, ui }) => cancelForm(ui, d.id, "Toplu yarış iptali")));
  await Promise.all(parallelTargets.map(({ ui }) => ui.page.click(`${last} button[type="submit"]`)));
  await sleep(8000);
  for (const { d, ui } of parallelTargets) {
    const row = rowOf(d.company, d.id);
    if (row.status !== "cancelled") log(`  YARIŞ 3 ${row.number} iptal olmadı`, { eStatus: row.eStatus, hata: await ui.textOf(`${last} .hof-form-error`), ileti: await ui.toasts() });
    cancelled.push(d.id);
  }
  check(parallelTargets.every(({ d }) => rowOf(d.company, d.id).status === "cancelled"), `dört farklı e-Arşiv aynı anda iptal edildi (${parallelTargets.map(({ d }) => d.number).join(", ")})`);
  await settle(6);
  for (const company of COMPANIES) for (const d of all.filter(x => x.company === company.code)) Object.assign(d, rowOf(company.code, d.id));
  check(all.filter(d => cancelled.includes(d.id)).every(d => d.status === "cancelled" && d.eStatus === "cancelled"), "iptal edilen 6 e-Arşiv EDM'de de iptal");

  // ---------- Bakiye, stok, defter (program API'si) ----------
  console.log("\n■ Bakiyeler, stok ve defter");
  const snapshot = {};
  for (const company of COMPANIES) {
    await selectCompany(company.id);
    const st = companyState[company.code];
    const balances = {};
    for (const account of [...st.accounts.efatura, ...st.accounts.earsiv]) {
      const r = await get(`/api/workspace/accounts/${account.id}`);
      balances[account.name] = Number(r.data?.totals?.balance ?? NaN);
      const expected = all.filter(d => d.company === company.code && d.accountId === account.id && d.status !== "cancelled").reduce((s, d) => s + d.payable, 0);
      check(near(balances[account.name], expected), `${company.code} ${account.name} bakiyesi = kesilen (iptal hariç) ${expected.toFixed(2)} (${balances[account.name]})`);
    }
    const stock = {};
    for (const item of st.items) {
      const r = await get(`/api/workspace/stock/${item.id}`);
      stock[item.name] = Number(r.data?.item?.qty ?? r.data?.qty ?? r.data?.available ?? NaN);
    }
    const gate = await get("/api/workspace/ledger/integrity");
    check(gate.status === 200 && gate.data?.ok !== false && !(gate.data?.problems || []).length, `${company.code} defter bütünlüğü temiz`);
    snapshot[company.code] = { balances, stock };
  }
  result.snapshot = snapshot;

  // ---------- YEDEK ----------
  const invoiceDump = db => db.prepare("SELECT id, number, ettn, status, e_status, try_payable FROM invoices ORDER BY id").all().map(r => JSON.stringify(r)).join("\n");
  const countsOf = db => Object.fromEntries(["invoices", "invoice_lines", "accounts", "stock_items", "audit_events"].map(t => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));
  const live = Object.fromEntries(COMPANIES.map(c => [c.code, { dump: invoiceDump(dbs[c.code]), counts: countsOf(dbs[c.code]) }]));
  const compareBackup = (label, code, file) => {
    const db = openRo(file);
    try {
      const same = invoiceDump(db) === live[code].dump;
      const counts = countsOf(db);
      const integrity = db.prepare("PRAGMA integrity_check").get();
      const okCounts = ["invoices", "invoice_lines", "accounts", "stock_items"].every(t => counts[t] === live[code].counts[t]);
      check(same && okCounts && Object.values(integrity)[0] === "ok", `${label} ${code}: ${path.basename(file)} — ${counts.invoices} fatura (numara/ETTN/durum/tutar birebir), cari/stok sayıları aynı, bütünlük ok`);
      return { file: path.basename(file), counts, same, integrity: Object.values(integrity)[0] };
    } finally { db.close(); }
  };
  const backupsOf = code => { const dir = readdirSync(backupDir).find(d => d.startsWith(`${code} -`)); return dir ? readdirSync(path.join(backupDir, dir)).filter(f => f.endsWith(".sqlite")).map(f => path.join(backupDir, dir, f)) : []; };
  console.log("\n■ Yedek 1 — sunucu yeniden açılır, otomatik yedek zamanlayıcısı");
  for (const s of sessions) await s.page.context().close().catch(() => {});
  for (const db of Object.values(dbs)) db.close();
  await app.close();
  api = await boot({ schedule: true });
  for (let i = 0; i < 60 && COMPANIES.some(c => !backupsOf(c.code).length); i += 1) await sleep(1000);
  for (const company of COMPANIES) {
    const files = backupsOf(company.code);
    check(files.length === 1, `${company.code} otomatik yedek alındı (${files.map(f => path.basename(f)).join(", ") || "yok"})`);
    if (files[0]) result.backup[`oto-${company.code}`] = compareBackup("Otomatik yedek", company.code, files[0]);
  }
  console.log("\n■ Yedek 2 — Yedek Al (Tüm Şirketler)");
  const manual = await post("/api/admin/backups", { scope: "all" });
  check(manual.status === 200 && manual.data.backups?.length === 2, `Yedek Al: ${manual.status} ${JSON.stringify(manual.data?.backups?.map(b => b.name) || manual.data).slice(0, 200)}`);
  const manualOf = {};
  for (const b of manual.data.backups || []) { manualOf[b.code] = b.name; result.backup[`elle-${b.code}`] = compareBackup("Elle yedek", b.code, path.join(b.folder, b.name)); }
  const audit = await get("/api/admin/backups/audit");
  log("Yedekleri Denetle", JSON.stringify(audit.data).slice(0, 300));

  console.log("\n■ Geri yükleme tatbikatı");
  const afterChange = async company => { await selectCompany(company.id); const r = await post("/api/workspace/accounts", { name: `Yedekten Sonra Açılan Cari ${company.code}`, type: "customer" }); return r.data?.id || r.data?.account?.id; };
  const verifyRestored = async (company, extraId) => {
    await selectCompany(company.id);
    const db = openRo(dbFileOf(app.companies.get(company.id)));
    try {
      check(invoiceDump(db) === live[company.code].dump, `${company.code} geri yüklemeden sonra faturalar yedekle birebir`);
      check(!db.prepare("SELECT 1 FROM accounts WHERE id = ?").get(extraId), `${company.code} yedekten sonra açılan cari geri yüklemeyle kalktı`);
    } finally { db.close(); }
    const st = companyState[company.code];
    for (const account of [...st.accounts.efatura, ...st.accounts.earsiv]) {
      const r = await get(`/api/workspace/accounts/${account.id}`);
      if (!near(r.data?.totals?.balance, snapshot[company.code].balances[account.name])) check(false, `${company.code} ${account.name} bakiyesi geri yüklemeden sonra ${r.data?.totals?.balance} (beklenen ${snapshot[company.code].balances[account.name]})`);
    }
    check(true, `${company.code} bakiyeler geri yüklemeden sonra aynı`);
    const gate = await get("/api/workspace/ledger/integrity");
    check(gate.status === 200 && gate.data?.ok !== false, `${company.code} defter bütünlüğü geri yüklemeden sonra temiz`);
    const one = all.find(d => d.company === company.code && d.status !== "cancelled" && d.eStatus === "sent");
    const r = await post(`/api/workspace/invoices/${one.id}/e-refresh`, {});
    check(r.status === 200 && r.data?.eStatus === "sent", `${company.code} geri yüklemeden sonra Durum Sorgula çalışıyor (${one.number}: ${r.status} ${r.data?.eStatus})`);
  };
  // 002: anında geri yüklenir.
  const extra2 = await afterChange(COMPANIES[1]);
  const restore2 = await post("/api/admin/backups/restore", { name: manualOf["002"], company: COMPANIES[1].id, confirm: "002", password: ADMIN_PASSWORD });
  check(restore2.status === 200 && restore2.data?.restored, `002 geri yükleme (${restore2.status} ${JSON.stringify(restore2.data).slice(0, 160)})`);
  await verifyRestored(COMPANIES[1], extra2);
  // 001: sunucu yeniden açılırken uygulanır.
  const extra1 = await afterChange(COMPANIES[0]);
  const restore1 = await post("/api/admin/backups/restore", { name: manualOf["001"], company: COMPANIES[0].id, confirm: "001", password: ADMIN_PASSWORD });
  check(restore1.status === 200 && restore1.data?.staged, `001 geri yükleme sıraya alındı (${restore1.status} ${JSON.stringify(restore1.data).slice(0, 160)})`);
  await app.close();
  api = await boot();
  await verifyRestored(COMPANIES[0], extra1);

  result.companies = COMPANIES.map(c => ({ code: c.code, name: c.name, sector: c.sector, tef: all.filter(d => d.company === c.code && d.kind.startsWith("eF")).map(d => d.number).sort(), tea: all.filter(d => d.company === c.code && d.kind === "eA").map(d => d.number).sort() }));
  result.docs = all.map(d => ({ sirket: d.company, kullanici: d.user, rol: d.role, cari: d.account.name, sektor: d.account.sector, tur: d.kind, kaydet: d.how, no: d.number, ettn: d.ettn, profil: d.profile, tip: d.typeCode, durum: d.status, eDurum: d.eStatus, tutar: d.payable, kalemler: d.lines.map(l => ({ ad: l.name, birim: l.unit, miktar: l.qty, fiyat: l.price, kdv: l.vat ?? 20, iskonto: l.disc || 0, tevkifat: l.wh || "", istisna: l.ex || "" })) }));
  console.log("\nÖZET TABLO");
  for (const d of [...result.docs].sort((a, b) => (a.sirket + a.no).localeCompare(b.sirket + b.no))) console.log(`  ${d.sirket} ${d.no}  ${d.ettn}  ${d.tur.padEnd(16)} ${d.kullanici.padEnd(8)} ${d.cari.padEnd(36)} ${String(d.tutar).padStart(10)}  ${d.durum}/${d.eDurum}`);
} catch (error) {
  log("HATA", String(error?.stack || error).slice(0, 1200));
  fail += 1;
} finally {
  log("SAYFA HATALARI", errors.length ? errors : "yok");
  check(!errors.length, "10 kullanıcının sayfasında hata yok");
  writeFileSync(path.join(OUT, "sonuc.json"), mask(JSON.stringify(result, null, 1)));
  console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
  process.exitCode = fail ? 1 : 0;
  await browser.close().catch(() => {});
  await app?.close().catch(() => {});
  await mock?.close();
}
