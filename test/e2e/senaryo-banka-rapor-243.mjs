// Senaryo 2.4.3 — Banka ve Rapor Merkezi keşif bulguları (docs/2.4.3-IS-LISTESI.md 26–29, 49, 50, 52, 53, 55, 56; docs/kanit/2026-10-17/ux-kesif/RAPOR-C.md
// C3–C7, C9, C11, C12, C14, C15). Gerçek kullanıcı gibi ekrandan; veri programın kendi API'siyle girilir, her kayıttan sonra sunucudan okunur.
//  C3  Masraf ve Transfer formunda seçilen hesabın "Bakiye (gün) · İşlemden Sonra" satırı (Transfer'de gönderen ve alıcı); Engelle kurallı hesapta
//      eksiye düşerken kırmızı + kural; bakiye görme yetkisi olmayana (sunucu bakiye göndermez) satır yok.
//  C4  Rapor Merkezi'nde süzgeç / dönem değişirken tablo kalkmaz (aria-busy + "Güncelleniyor…"), yükseklik çökmez; geç gelen eski yanıt yeni
//      sonucu ezmez; rapor değişince yer tutucu önceki yüksekliği korur.
//  C5  1366×768'de Banka Hareket Raporu'nun ilk satırı ve TOPLAM'ı ilk bakışta (kaydırmadan) görünür.
//  C6  1920×1080'de banka raporlarında yatay kaydırma yok; Bakiye kolonu görünür; Hesap hücresi en çok iki satır.
//  C7  Hareketler'de Başlangıç'a klavyeyle tarih yazılırken ara değerlerle istek gitmez (400 yok); geçerli tarih gelince tek istek.
//  C9  Rapor Merkezi ekranındaki tutarlar programın öbür pencereleriyle aynı biçimde ("₺320.890,12"); Banka → Hesaplar'daki bakiyeyle aynı metin.
//  C11 Banka penceresi kapatılıp açılınca son sekme ve Hareketler süzgeci (oturum içinde) hatırlanır.
//  C12 Uzun hesap adı seçicide kesilmez (alan genişler) ya da tam adı ipucunda; 1280'de Hesaplar'ın Kod ve Tür hücresi tek satır.
//  C14 "Banka ve POS Hareketleri" raporu Banka grubunda.
//  C15 Banka Nakit Akış Raporu ileriye dönük dönem düğmeleri sunar (Geçen Ay / Son 30 Gün yok).
// Kırmızı kanıt: DEPO=<eski kopya> ile aynı senaryo eski kodda koşulur (ürün DEPO'dan yüklenir).
// Çalıştırma: npm run test:senaryo-banka-rapor-243 (ekran görüntüleri artifacts/senaryo-banka-rapor-243/). OLCU=1 ölçümleri de yazar.
import fs, { mkdtempSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(HERE, "..", "helpers.mjs")).href);

const OUT = path.join(HERE, "artifacts", "senaryo-banka-rapor-243");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Banka-Rapor-243-Admin!";
const NOW = "2026-10-14T12:00:00+03:00";
const TODAY = "2026-10-14";
const MEASURE = process.env.OLCU === "1";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-rapor-243-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f43" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const BANK = "/api/workspace/bank";
const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const measures = {};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:last-of-type`;
const WIN = ".hof-bank-modal";
const FORM = "form.hof-bank-voucher";
let page = null;
let shotNo = 0;
const shot = async (name, target = page) => {
  shotNo += 1;
  await target.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
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
const closeAll = async (target = page) => {
  for (let index = 0; index < 8 && (await target.$(MODAL)); index += 1) {
    await target.keyboard.press("Escape");
    await target.waitForTimeout(250);
    // Kapanma onayı (ortak çekirdek; dolu formda sorulur) bu senaryonun konusu değil: varsa kaydetmeden çıkılır.
    const leave = await target.$(`${TOP} [data-answer="yes"]`);
    if (leave && /Kaydetmeden|Çık/.test((await leave.innerText().catch(() => "")) || "")) await leave.click().catch(() => null);
  }
};
const textOf = (selector, target = page) => target.$eval(selector, node => node.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const money = minor => `₺${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(minor) / 100)}`;

// ---------- Veri (API; programın kendi uçları) ----------
await api.login("admin", PASS);
await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
const acc = {};
// Geçerli TR IBAN (mod 97): Hesaplar listesinde IBAN kolonu dolu (1280'de Kod ve Tür kolonlarını daraltan gerçek görünüm).
const iban = (bank, account) => {
  const body = `${bank}0${account.padStart(16, "0")}`;
  const check = 98 - Number(BigInt(`${body}292700`) % 97n);
  return `TR${String(check).padStart(2, "0")}${body}`;
};
acc.Z = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", iban: iban("00010", "1234567"), branchName: "Kızılay Şubesi", opening: { date: "2026-01-02", amount: "300.000", confirmed: true } }));
acc.G = await must("Garanti", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", iban: iban("00062", "7654321"), opening: { date: "2026-01-02", amount: "400.000", confirmed: true } }));
acc.V = await must("Vakıf", api.post(`${BANK}/accounts`, { bankName: "Türkiye Vakıflar Bankası T.A.O.", name: "Kurumsal Ticari Mevduat Hesabı", kind: "demand", iban: iban("00015", "1111222"), opening: { date: "2026-01-02", amount: "250.000" } }));
acc.A = await must("Akbank", api.post(`${BANK}/accounts`, { bankName: "Akbank", name: "Küçük Hesap", kind: "demand", opening: { date: "2026-01-02", amount: "100", confirmed: true } }));
await must("Engelle", api.put(`${BANK}/accounts/${acc.A.id}`, { negativePolicy: "block" }));
acc.K = await must("Kart", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-01-02", amount: "0", confirmed: true } }));
const day = index => {
  const month = 1 + (index % 9);
  return `2026-${String(month).padStart(2, "0")}-${String(3 + (index % 25)).padStart(2, "0")}`;
};
for (let index = 0; index < 90; index += 1) {
  const account = [acc.Z, acc.G, acc.V][index % 3];
  await must(`masraf ${index}`, api.post(`${BANK}/vouchers`, { type: "fee", accountId: account.id, date: day(index), amount: `${15 + (index % 40)},${String(index % 100).padStart(2, "0")}`, feeType: "eft", tax: "bsmv_incl", description: `EFT masrafı ${index}`, similarOk: true, requestId: randomUUID() }));
}
for (let index = 0; index < 30; index += 1) await must(`transfer ${index}`, api.post(`${BANK}/transfers`, { accountId: index % 2 ? acc.Z.id : acc.G.id, toAccountId: index % 2 ? acc.G.id : acc.V.id, amount: `${1000 + index * 37},50`, date: day(index + 3), channel: "virman", requestId: randomUUID() }));
const customer = await must("cari", api.post("/api/workspace/accounts", { name: "Akın Ticaret Limited Şirketi İnşaat Taahhüt ve Pazarlama", type: "customer", registeredOn: "2026-01-02" }));
for (let index = 0; index < 12; index += 1) await must(`tahsilat ${index}`, api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", method: "bank", bankAccountId: acc.V.id, date: day(index + 7), amount: `${2500 + index * 113},25` }));
// Hesabın bugünkü bakiyesi (kuruş; Banka → Hesaplar listesiyle aynı kaynak). Veride ileri tarihli hareket yok.
const balanceOf = async id => Number((await must("hesaplar", api.get(`${BANK}/accounts?status=all`))).accounts.find(account => account.id === id)?.balanceMinor);

const openBank = async (target = page) => {
  await closeAll(target);
  await target.click('#hof-sidecard [data-action="bank"]');
  await target.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
};
const openReports = async (id, target = page) => {
  await closeAll(target);
  await target.click('#hof-sidecard [data-action="analytics"]');
  await target.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await target.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await target.waitForSelector(`${MODAL} [data-rc-list] [data-report="${id}"]`, { timeout: 15000 });
  await target.click(`${MODAL} [data-rc-list] [data-report="${id}"]`);
  await waitReport(target);
};
// Sonuç: meşgul değil (aria-busy yok ya da "false") ve özet ya da tablo var.
const waitReport = (target = page) =>
  target.waitForFunction(sel => {
    const main = document.querySelector(`${sel} [data-rc-main]`);
    return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table, .hof-rc-summary") && !/Rapor hazırlanıyor/.test(main.innerText);
  }, MODAL, { timeout: 15000 });
const reportView = (target = page) =>
  target.evaluate(sel => {
    const main = document.querySelector(`${sel} [data-rc-main]`);
    const text = node => node.textContent.replace(/\s+/g, " ").trim();
    return {
      busy: main?.getAttribute("aria-busy") === "true",
      title: main?.querySelector("h3") ? text(main.querySelector("h3")) : "",
      scope: main?.querySelector(".hof-rc-scope") ? text(main.querySelector(".hof-rc-scope")) : "",
      heads: [...(main?.querySelectorAll("thead th") || [])].map(text),
      rows: [...(main?.querySelectorAll("tbody tr") || [])].map(row => [...row.querySelectorAll("td")].map(text)).filter(cells => cells.length > 1),
      footer: main?.querySelector("tfoot tr") ? [...main.querySelectorAll("tfoot td")].map(text) : null,
      summary: Object.fromEntries([...(main?.querySelectorAll(".hof-rc-summary span") || [])].map(span => [text(span.querySelector("small")), text(span.querySelector("b"))])),
      presets: [...(main?.querySelectorAll(".hof-rc-range [data-preset]") || [])].map(text),
    };
  }, MODAL);

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const login = async target => {
    target.on("pageerror", error => errors.push(`pageerror ${error.message}`));
    await installPageClock(target, app.config.now);
    await target.goto(`${BASE}/`);
    await target.fill("#hof-auth input[name=username]", "admin");
    await target.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
    await target.waitForSelector('#hof-sidecard [data-action="bank"]', { timeout: 60000 });
    await target.waitForTimeout(600);
  };
  page = await context.newPage();
  await login(page);

  await step("C3. Masraf formu: seçilen hesabın bakiyesi ve İşlemden Sonra; Engelle hesabında eksiye düşerken kırmızı + kural", async () => {
    await openBank();
    await page.click(`${WIN} [data-tab="movements"]`);
    await page.waitForSelector(`${WIN} [data-act="v-fee"]`, { timeout: 10000 });
    await page.click(`${WIN} [data-act="v-fee"]`);
    await page.waitForSelector(`${FORM} select[name="accountId"]`, { timeout: 10000 });
    await page.selectOption(`${FORM} select[name="accountId"]`, acc.V.id);
    await page.fill(`${FORM} input[name="amount"]`, "17,50");
    await page.waitForTimeout(700);
    const balance = await balanceOf(acc.V.id);
    const line = await textOf(`${FORM} [data-bank-balance="${acc.V.id}"]`);
    await shot("c3-masraf-bakiye");
    const at = balance;
    ok(new RegExp(`Bakiye \\(14\\.10\\.2026\\): ${money(at).replace(/[.$]/g, "\\$&")}`).test(line) && line.includes(`İşlemden Sonra: ${money(at - 1750)}`), `Masraf (Vakıf) satırı: “${line}” (beklenen bakiye ${money(at)}, sonra ${money(at - 1750)})`);
    measures.c3Masraf = line;
    await page.selectOption(`${FORM} select[name="accountId"]`, acc.A.id);
    await page.fill(`${FORM} input[name="amount"]`, "150");
    await page.waitForTimeout(500);
    const negative = await page.$eval(`${FORM} [data-bank-balance="${acc.A.id}"]`, node => ({ text: node.innerText.replace(/\s+/g, " ").trim(), red: node.classList.contains("is-negative"), policy: node.dataset.negative || "" })).catch(() => ({ text: "", red: false, policy: "" }));
    ok(negative.red && negative.policy === "block" && /eksiye düşüyor.*Engelle/.test(negative.text), `Engelle hesabı (100 TL, masraf 150): kırmızı ${negative.red}, “${negative.text}”`);
    await shot("c3-masraf-eksi");
    await closeAll();
  });

  await step("C3. Transfer formu: gönderen ve alıcı hesabın bakiyesi ve İşlemden Sonra (ücretli transferde gönderenden tutar + ücret çıkar)", async () => {
    await openBank();
    await page.click(`${WIN} [data-tab="movements"]`);
    await page.waitForSelector(`${WIN} [data-act="v-transfer"]`, { timeout: 10000 });
    await page.click(`${WIN} [data-act="v-transfer"]`);
    await page.waitForSelector(`${FORM} select[name="accountId"]`, { timeout: 10000 });
    await page.selectOption(`${FORM} select[name="accountId"]`, acc.Z.id);
    await page.selectOption(`${FORM} select[name="toAccountId"]`, acc.G.id);
    await page.fill(`${FORM} input[name="amount"]`, "1.234,56");
    await page.fill(`${FORM} input[name="feeAmount"]`, "10,50");
    await page.waitForTimeout(700);
    const [z, g] = [await balanceOf(acc.Z.id), await balanceOf(acc.G.id)];
    const from = await textOf(`${FORM} [data-bank-balance="${acc.Z.id}"]`);
    const to = await textOf(`${FORM} [data-bank-balance="${acc.G.id}"]`);
    await shot("c3-transfer-bakiye");
    const zAt = z;
    const gAt = g;
    ok(from.includes(`Bakiye (14.10.2026): ${money(zAt)}`) && from.includes(`İşlemden Sonra: ${money(zAt - 123456 - 1050)}`), `Gönderen (Ziraat): “${from}” (beklenen sonra ${money(zAt - 124506)})`);
    ok(to.includes(`Bakiye (14.10.2026): ${money(gAt)}`) && to.includes(`İşlemden Sonra: ${money(gAt + 123456)}`), `Alıcı (Garanti): “${to}” (beklenen sonra ${money(gAt + 123456)})`);
    // Kaydet: sunucunun bakiyesi ekrandaki "İşlemden Sonra" ile aynı.
    await page.click(`${FORM} button[type="submit"]`);
    await page.waitForFunction(sel => !document.querySelector(sel), FORM, { timeout: 15000 });
    const [z2, g2] = [await balanceOf(acc.Z.id), await balanceOf(acc.G.id)];
    ok(z2 === zAt - 124506 && g2 === gAt + 123456, `kaydedildi: Ziraat ${z2 / 100}, Garanti ${g2 / 100} (sunucu = ekrandaki İşlemden Sonra)`);
    await closeAll();
  });

  await step("C3. Bakiye görme yetkisi yokken (sunucu bakiye göndermez) Masraf formunda bakiye satırı yok", async () => {
    const strip = async route => {
      const response = await route.fetch();
      const body = await response.json();
      if (body?.data) {
        delete body.data.balances;
        delete body.data.cash;
      }
      await route.fulfill({ response, json: body });
    };
    await page.route("**/api/workspace/bank/choices*", strip);
    try {
      await openBank();
      await page.click(`${WIN} [data-tab="movements"]`);
      await page.waitForSelector(`${WIN} [data-act="v-fee"]`, { timeout: 10000 });
      await page.click(`${WIN} [data-act="v-fee"]`);
      await page.waitForSelector(`${FORM} select[name="accountId"]`, { timeout: 10000 });
      await page.fill(`${FORM} input[name="amount"]`, "17,50");
      await page.waitForTimeout(700);
      ok(!(await page.$(`${FORM} [data-bank-balance]`)), "bakiyesiz yanıtta satır yok");
    } finally {
      await page.unroute("**/api/workspace/bank/choices*", strip);
      await closeAll();
    }
  });

  await step("C7. Hareketler → Başlangıç'a klavyeyle tarih: ara değerlerle istek yok, 400 yok; geçerli tarihte tek istek ve doğru liste", async () => {
    await openBank();
    await page.click(`${WIN} [data-tab="movements"]`);
    await page.waitForSelector(`${WIN} [data-mv="account"]`, { timeout: 10000 });
    await page.selectOption(`${WIN} [data-mv="account"]`, acc.Z.id);
    await page.waitForTimeout(800);
    const seen = [];
    const onResponse = response => {
      const url = response.url();
      if (url.includes(`${BANK}/movements`) && /[?&]from=/.test(url)) seen.push({ from: new URL(url).searchParams.get("from"), status: response.status() });
    };
    page.on("response", onResponse);
    await page.click(`${WIN} [data-mv="from"]`);
    // Tarih alanının parçalarına insan hızında yazılır (gün ve ay aynı: "09" — alanın gün/ay sırası yerele göre değişse de 09.09.2026).
    for (const part of ["09", "09", "2026"]) await page.keyboard.type(part, { delay: 120 });
    await page.waitForTimeout(1600);
    page.off("response", onResponse);
    const value = await page.$eval(`${WIN} [data-mv="from"]`, node => node.value);
    const bad = seen.filter(item => item.status >= 400);
    measures.c7 = { seen, value };
    ok(value === "2026-09-09", `alan değeri ${value}`);
    ok(bad.length === 0 && seen.length === 1 && seen[0].from === "2026-09-09", `istekler: ${seen.map(item => `${item.from} → ${item.status}`).join(", ") || "yok"}`);
    const rows = await page.$$eval(`${WIN} .hof-bank-moves tbody tr[data-event]`, nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    const firstDay = row => {
      const match = /\b(\d{2})\.(\d{2})\.(\d{4})\b/.exec(row);
      return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    };
    ok(rows.length > 0 && rows.every(row => firstDay(row) >= "2026-09-09"), `liste yalnız 09.09.2026 ve sonrası (${rows.length} satır; en eski ${rows.map(firstDay).sort()[0] || "—"})`);
    await shot("c7-tarih");
  });

  await step("C11. Banka penceresi kapatılıp açılınca son sekme (Hareketler) ve süzgeç (Ziraat, 09.09.2026) hatırlanır", async () => {
    await closeAll();
    await page.waitForTimeout(300);
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
    await page.waitForTimeout(900);
    const tab = await page.$eval(`${WIN} .hof-bank-tabs [aria-selected="true"]`, node => node.dataset.tab).catch(() => "");
    const account = await page.$eval(`${WIN} [data-mv="account"]`, node => node.value).catch(() => "");
    const from = await page.$eval(`${WIN} [data-mv="from"]`, node => node.value).catch(() => "");
    ok(tab === "movements" && account === acc.Z.id && from === "2026-09-09", `yeniden açılış: sekme ${tab || "?"}, Hesap ${account === acc.Z.id ? "Ziraat" : `“${account}”`}, Başlangıç ${from || "boş"}`);
    ok(Boolean(await page.$(`${WIN} [data-act="mv-clear"]`)), "Süzgeçleri Temizle görünür (süzgecin açık olduğu belli)");
    await shot("c11-yeniden-acilis");
    await page.click(`${WIN} [data-act="mv-clear"]`);
    await page.waitForTimeout(600);
    await closeAll();
  });

  await step("C12. Uzun hesap adı Masraf ve Transfer seçicisinde kesilmez ya da tam adı ipucunda", async () => {
    await openBank();
    await page.click(`${WIN} [data-tab="movements"]`);
    await page.waitForSelector(`${WIN} [data-act="v-fee"]`, { timeout: 10000 });
    await page.click(`${WIN} [data-act="v-fee"]`);
    await page.waitForSelector(`${FORM} select[name="accountId"]`, { timeout: 10000 });
    await page.selectOption(`${FORM} select[name="accountId"]`, acc.V.id);
    await page.waitForTimeout(300);
    const fit = await page.$eval(`${FORM} select[name="accountId"]`, select => {
      const text = select.selectedOptions[0]?.textContent || "";
      const style = getComputedStyle(select);
      const canvas = document.createElement("canvas").getContext("2d");
      canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const room = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return { text, width: Math.ceil(canvas.measureText(text).width), room: Math.floor(room), title: select.title || "" };
    });
    measures.c12 = fit;
    await shot("c12-uzun-ad");
    ok(fit.width <= fit.room || fit.title === fit.text, `Vakıf seçici: metin ${fit.width} px, alan ${fit.room} px, ipucu “${fit.title}”`);
    ok(fit.width <= fit.room, `tam ad alana sığıyor (${fit.width} ≤ ${fit.room})`);
    await closeAll();
  });

  await step("C14 / C15. Rapor Merkezi: Banka ve POS Hareketleri Banka grubunda; Banka Nakit Akış'ta ileriye dönük dönemler", async () => {
    await openReports("banka-nakit-akis");
    const groups = await page.$$eval(`${MODAL} [data-rc-list] .hof-rc-group`, nodes => nodes.map(node => ({ name: [...(node.querySelector("p")?.childNodes || [])].filter(child => child.nodeType === 3).map(child => child.textContent).join("").trim(), ids: [...node.querySelectorAll("[data-report]")].map(item => item.dataset.report) })));
    const home = groups.find(group => group.ids.includes("banka-pos-hareketleri"))?.name || "";
    ok(home === "Banka", `Banka ve POS Hareketleri grubu: ${home}`);
    const view = await reportView();
    ok(view.presets.join("|") === "Önümüzdeki 7 Gün|Önümüzdeki 30 Gün|Önümüzdeki 90 Gün|Bu Ay|Tüm Beklenenler", `Nakit Akış dönemleri: ${view.presets.join(", ")}`);
    await page.click(`${MODAL} [data-rc-main] [data-preset="next30"]`);
    await waitReport();
    const next = await reportView();
    ok(/14\.10\.2026 itibarıyla · 14\.10\.2026 – 13\.11\.2026/.test(next.scope), `Önümüzdeki 30 Gün kapsamı: ${next.scope}`);
    await shot("c15-nakit-akis");
  });

  await step("C9. Rapor Merkezi ekranında tutar ₺ önde (Banka → Hesaplar ile aynı metin); PDF/Excel bağları değişmez", async () => {
    await openReports("banka-bakiye");
    const view = await reportView();
    const col = name => view.heads.indexOf(name);
    const row = view.rows.find(cells => cells.some(cell => cell.includes("Ziraat Bankası")));
    const end = row ? row[col("Dönem Sonu")] : "";
    const z = await balanceOf(acc.Z.id);
    ok(end === money(z), `Banka Bakiye Raporu Ziraat Dönem Sonu “${end}” = ${money(z)}`);
    const cells = [...view.rows.flat(), ...(view.footer || []), ...Object.values(view.summary)];
    ok(!cells.some(cell => /\d,\d{2} TL\b/.test(cell)), `ekranda “… TL” biçimi yok (${cells.filter(cell => /\d,\d{2} TL\b/.test(cell)).slice(0, 3).join(" | ") || "—"})`);
    await openBank();
    await page.click(`${WIN} [data-tab="accounts"]`);
    await page.waitForSelector(`${WIN} tr[data-account="${acc.Z.id}"]`, { timeout: 10000 });
    const listed = await textOf(`${WIN} tr[data-account="${acc.Z.id}"]`);
    ok(listed.includes(end), `Banka → Hesaplar satırında aynı metin (“${end}”): ${listed.slice(0, 160)}`);
    await closeAll();
  });

  await step("C4. Süzgeç değişirken tablo kalkmaz (aria-busy), yükseklik çökmez; geç gelen eski yanıt yeni sonucu ezmez", async () => {
    await openReports("banka-hareket");
    const before = await page.$eval(`${MODAL} [data-rc-main]`, node => node.getBoundingClientRect().height);
    // Hesap süzgecinin yanıtı geciktirilir: Ziraat 2.500 ms, Garanti 300 ms. Ziraat'ten hemen sonra Garanti seçilir; son görünen Garanti olmalı.
    const slow = async route => {
      const url = new URL(route.request().url());
      const wait = url.searchParams.get("bankAccount") === acc.Z.id ? 2500 : url.searchParams.get("bankAccount") === acc.G.id ? 300 : 0;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      await route.continue().catch(() => null);
    };
    await page.route("**/api/workspace/report-center/banka-hareket?*", slow);
    try {
      const samples = [];
      await page.selectOption(`${MODAL} [data-param="bankAccount"]`, acc.Z.id);
      for (let index = 0; index < 4; index += 1) {
        await page.waitForTimeout(60);
        samples.push(await page.$eval(`${MODAL} [data-rc-main]`, node => ({ height: node.getBoundingClientRect().height, table: Boolean(node.querySelector(".hof-rc-table tbody tr")), busy: node.getAttribute("aria-busy") })));
      }
      measures.c4 = { before, samples };
      ok(samples.every(sample => sample.table), `yüklenirken tablo yerinde (${samples.map(sample => (sample.table ? "tablo" : "boş")).join(", ")})`);
      ok(samples.every(sample => sample.height >= before - 2), `yükseklik çökmedi (önce ${Math.round(before)}, yüklenirken en az ${Math.round(Math.min(...samples.map(sample => sample.height)))})`);
      ok(samples.every(sample => sample.busy === "true"), `yüklenirken aria-busy (${samples.map(sample => sample.busy).join(", ")})`);
      const badge = await page.$eval(`${MODAL} [data-rc-busy]`, node => !node.hidden && node.innerText.trim()).catch(() => "");
      ok(badge === "Güncelleniyor…", `gösterge: “${badge}”`);
      await shot("c4-yukleniyor");
      await page.selectOption(`${MODAL} [data-param="bankAccount"]`, acc.G.id);
      await page.waitForTimeout(3200);
      const view = await reportView();
      const col = view.heads.indexOf("Hesap");
      const accounts = [...new Set(view.rows.filter(cells => cells[col]).map(cells => cells[col]))];
      ok(!view.busy && accounts.length === 1 && /Garanti/.test(accounts[0]), `son seçim (Garanti) ekranda; geç gelen Ziraat yanıtı ezmedi: ${accounts.join(", ")}`);
    } finally {
      await page.unroute("**/api/workspace/report-center/banka-hareket?*", slow);
    }
    // Rapor değişince yer tutucu önceki yükseklikte (pencere çöküp açılmaz).
    const slowAll = async route => {
      await new Promise(resolve => setTimeout(resolve, 800));
      await route.continue().catch(() => null);
    };
    await page.route("**/api/workspace/report-center/banka-masraf?*", slowAll);
    try {
      const height = await page.$eval(`${MODAL} [data-rc-main]`, node => node.getBoundingClientRect().height);
      await page.click(`${MODAL} [data-rc-list] [data-report="banka-masraf"]`);
      await page.waitForTimeout(150);
      const during = await page.$eval(`${MODAL} [data-rc-main]`, node => ({ height: node.getBoundingClientRect().height, busy: node.getAttribute("aria-busy") }));
      ok(during.busy === "true" && during.height >= height - 80, `rapor değişince yer tutucu: yükseklik ${Math.round(height)} → ${Math.round(during.height)}, aria-busy ${during.busy}`);
      await waitReport();
    } finally {
      await page.unroute("**/api/workspace/report-center/banka-masraf?*", slowAll);
    }
    // Boş dönem: tarih aralığı kayıtsız → ipucu (eski tablo kalmaz).
    await page.fill(`${MODAL} [data-param="from"]`, "2019-01-01");
    await page.fill(`${MODAL} [data-param="to"]`, "2019-01-31");
    await page.click(`${MODAL} [data-rc-run]`);
    await waitReport();
    const empty = await textOf(`${MODAL} [data-rc-main] tbody .hof-empty`);
    ok(/Bu dönemde kayıt yok/.test(empty), `boş dönem: “${empty}”`);
  });

  await step("C5. 1366×768: Banka Hareket Raporu'nun ilk satırı ve TOPLAM'ı ilk bakışta (kaydırmadan) görünür", async () => {
    await openReports("banka-hareket");
    const fit = await page.evaluate(sel => {
      const main = document.querySelector(`${sel} [data-rc-main]`);
      const row = main.querySelector(".hof-rc-table tbody tr");
      // TOPLAM hücreleri kutunun altına yapışıktır (sticky): satırın değil hücrenin yeri ölçülür.
      const total = main.querySelector(".hof-rc-table tfoot td");
      const frame = main.closest(".hof-modal");
      const bottom = Math.min(window.innerHeight, frame.getBoundingClientRect().bottom);
      return { row: row ? Math.round(row.getBoundingClientRect().bottom) : -1, total: total ? Math.round(total.getBoundingClientRect().bottom) : -1, bottom: Math.round(bottom), scrollTop: frame.scrollTop };
    }, MODAL);
    measures.c5 = fit;
    await shot("c5-1366");
    ok(fit.scrollTop === 0 && fit.row > 0 && fit.row <= fit.bottom && fit.total > 0 && fit.total <= fit.bottom, `ilk satır alt kenarı ${fit.row}, TOPLAM ${fit.total}, görünen alan ${fit.bottom} (kaydırma ${fit.scrollTop})`);
    await closeAll();
  });

  await step("C6 / C12. 1920×1080 banka raporlarında yatay kaydırma yok, Bakiye görünür, Hesap en çok iki satır; 1280'de Hesaplar'ın Kod ve Tür hücresi tek satır", async () => {
    const wide = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "tr-TR" });
    await wide.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const big = await wide.newPage();
    await login(big);
    const results = [];
    for (const id of ["banka-hareket", "banka-bakiye", "banka-masraf", "banka-gunluk", "banka-aylik", "cari-banka-hareketleri", "banka-pos-hareketleri", "kasa-banka-transfer", "bankalar-arasi-transfer"]) {
      await openReports(id, big);
      const fit = await big.evaluate(sel => {
        const box = document.querySelector(`${sel} [data-rc-main] .hof-rc-table`);
        const heads = [...box.querySelectorAll("thead th")];
        const lines = cell => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
        };
        const accountIndex = heads.findIndex(th => th.textContent.trim() === "Hesap");
        const rows = [...box.querySelectorAll("tbody tr")].slice(0, 20);
        const maxLines = accountIndex < 0 ? 0 : Math.max(0, ...rows.map(row => (row.children[accountIndex] ? lines(row.children[accountIndex]) : 0)));
        const last = heads[heads.length - 1];
        return { scroll: box.scrollWidth, client: box.clientWidth, lastRight: Math.round(last.getBoundingClientRect().right), boxRight: Math.round(box.getBoundingClientRect().right), lastHead: last.textContent.trim(), maxLines };
      }, MODAL);
      results.push({ id, ...fit });
    }
    measures.c6 = results;
    await shot("c6-1920", big);
    for (const item of results) ok(item.scroll <= item.client + 1 && item.lastRight <= item.boxRight + 1 && item.maxLines <= 2, `${item.id}: kaydırma ${item.scroll}/${item.client}, son kolon “${item.lastHead}” ${item.lastRight} ≤ ${item.boxRight}, Hesap ${item.maxLines} satır`);
    await wide.close();
    const narrow = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "tr-TR" });
    await narrow.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const small = await narrow.newPage();
    await login(small);
    await openBank(small);
    await small.click(`${WIN} [data-tab="accounts"]`);
    await small.waitForSelector(`${WIN} tr[data-account="${acc.K.id}"]`, { timeout: 10000 });
    const wraps = await small.evaluate(sel => {
      const lines = cell => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
      };
      return [...document.querySelectorAll(`${sel} tr[data-account]`)].map(row => ({ code: lines(row.querySelector('[data-label="Kod"]') || row.children[0]), kind: lines(row.querySelector('[data-label="Tür"]') || row.children[1]), text: row.innerText.replace(/\s+/g, " ").slice(0, 60) }));
    }, WIN);
    measures.c12Hesaplar = wraps;
    await shot("c12-1280-hesaplar", small);
    ok(wraps.length >= 5 && wraps.every(item => item.code <= 1 && item.kind <= 1), `1280 Hesaplar Kod/Tür tek satır: ${wraps.map(item => `${item.code}/${item.kind}`).join(" ")}`);
    await narrow.close();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  if (MEASURE) console.log(`\nÖLÇÜM ${JSON.stringify(measures, null, 1)}`);
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-banka-rapor-243: ${passed} geçti, ${failed} kaldı · depo ${ROOT} · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
