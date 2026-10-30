// 2.4.8 W3 EKRANDAN — WhatsApp penceresinin (Kendi WhatsApp'ımla, wa.me yolu) ekstre PDF'i SEÇİLEN DÖNEME uyar (plan §6 W3, S5; önceden bütün hareketleri
// basıyordu) + "WhatsApp Mesajı İstemiyor" (W2): cari formunda Tab + Boşluk ile işaretlenir, kartta rozet, WhatsApp penceresinde seçilemez.
// Sunucu saati sahte (03.11.2026; ders 13); veri programın kendi API'sinden. Gerçek tıklama + klavye (ders 12); en üstteki pencere seçicisi (ders 39).
// Meta'ya istek YOK (wa.me yolu; window.open kayda alınır). İddialar PDF'in METNİNDEN (test/banka-210-ortak.mjs pdfText) ve veri tabanından okunur.
//   D1 cari kartı → WhatsApp → Ekstre Gönder → "Geçen Ay": baloncuktaki "Güncel bakiye: 850,00 TL"; Gönderime Başla → "Cari Ekstre - PDF" bağlantısı dönemli;
//      PDF: Ekim hareketleri (ilk gün + son gün), Kasım hareketi YOK, devir 1.000, dönem sonu 850 = metin.
//   D2 "WhatsApp'ta Aç ve Sıradakine Geç" + kişinin adıyla PDF indir: indirilen dosyanın adı "Ekstre <Ad> 01.10.2026-31.10.2026.pdf", içeriği D1'le BAYT BAYT aynı.
//   D3 "Tüm Hareketler": PDF "Tüm Hareketler · 03.11.2026 tarihine kadar", bakiye metindekiyle aynı.
//   D4 Cariyi Düzenle → "WhatsApp Mesajı İstemiyor" Tab ile bulunur, Boşluk ile işaretlenir → Kaydet: veri tabanında 1; kartta "WhatsApp İstemiyor" rozeti;
//      WhatsApp → Ekstre penceresinde kişi seçilemez ("WhatsApp Mesajı İstemiyor"), Gönderilecek 0.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-whatsapp-donem-248).
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";
import { pdfText } from "../banka-210-ortak.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-whatsapp-donem-248-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-whatsapp-donem-248");
mkdirSync(shots, { recursive: true });
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const NAME = "Dönem Kişisi";

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: { time: "2026-11-03T09:00:00+03:00", fixed: true } });
const api = createClient(server.base);
await api.login("admin", ADMIN_PASSWORD);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};
const person = await must("cari", api.post("/api/workspace/accounts", { name: NAME, phone: "0532 777 88 99", openingBalance: "1000", registeredOn: "2026-09-01" }));
for (const body of [
  { kind: "debt", amount: "200", date: "2026-10-01", note: "Ekim ilk gün" },
  { kind: "in", amount: "350", date: "2026-10-31", note: "Ekim son gün" },
  { kind: "debt", amount: "40", date: "2026-11-01", note: "Kasım ilk gün" },
]) await must(body.note, api.post(`/api/workspace/accounts/${person.id}/entries`, body));

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
await context.addInitScript(() => {
  window.__wa = [];
  window.open = url => {
    window.__wa.push(String(url));
    return null;
  };
  // Programın indirme bağlantısına verdiği dosya adı (a.download) kaydedilir: bu ortamın başsız Chromium'u indirmeyi "download" adıyla bildirir
  // (eski kodda da aynı — denendi), adın kendisi bağlantıdan okunur; içerik indirilen dosyadan.
  window.__dl = [];
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function recorded() {
    if (this.download) window.__dl.push({ name: this.download, href: this.getAttribute("href") });
    return click.call(this);
  };
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.setDefaultTimeout(20000);
const shot = name => page.screenshot({ path: path.join(shots, `donem-248-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 2).trim()}`);
  }
};
const topModal = async () => {
  await page.waitForSelector(`${TOP} .hof-modal-title, ${TOP} h2, ${TOP} form, ${TOP} [data-wa]`, { state: "visible" });
  return TOP;
};
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const discard = await page.$(`${TOP} [data-answer="discard"], ${TOP} [data-answer="no"]`);
    if (discard) {
      console.log("    (soru penceresi: kaydetmeden kapat — bu adımda değişiklik yok, beklenmeyen soru)");
      await discard.click();
    }
  }
};
const openCard = async () => {
  await closeAll();
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`${TOP} tr[data-account="${person.id}"]`);
  await page.click(`${TOP} tr[data-account="${person.id}"]`);
  await page.waitForSelector(`${TOP} [data-act="edit"]`);
};
const openStatementDialog = async () => {
  await openCard();
  await page.click(`${TOP} [data-act="whatsapp"]`);
  await page.waitForSelector(`${TOP} [data-kind="statement"]`);
  await page.click(`${TOP} [data-kind="statement"]`);
  await page.waitForSelector(`${TOP} .hof-wa-head`);
};
const choosePreset = async value => {
  await page.selectOption(`${TOP} [data-preset]`, value);
  await page.waitForFunction(([sel, v]) => document.querySelector(sel)?.value === v && document.querySelector(`${sel.replace(" [data-preset]", "")} .hof-wa-bubble`), [`${TOP} [data-preset]`, value]);
  await page.waitForTimeout(300);
};
const bubble = () => page.$eval(`${TOP} .hof-wa-bubble`, node => node.innerText);
const fetchPdf = async href => {
  const response = await page.request.get(new URL(href, server.base).href);
  return { status: response.status(), buffer: Buffer.from(await response.body()), disposition: response.headers()["content-disposition"] || "" };
};

let periodPdf = null;
await step("Giriş", async () => {
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  ok(true, "yönetici girdi");
});

await step("D1 Geçen Ay: metin ve 'Cari Ekstre - PDF' aynı dönem, aynı bakiye", async () => {
  await openStatementDialog();
  await choosePreset("lastMonth");
  const text = await bubble();
  ok(/Güncel bakiye: 850,00 TL \(borcunuz\)/.test(text), `baloncuk: güncel bakiye 850,00 TL (${text.split("\n").find(line => /Güncel bakiye/.test(line)) || "—"})`);
  ok(/01\.10\.2026 – 31\.10\.2026/.test(text), "baloncukta dönem 01.10.2026 – 31.10.2026");
  await shot("01-gecen-ay-hazirlik");
  await page.click(`${TOP} [data-start]`);
  await page.waitForSelector(`${TOP} [data-send]`);
  const href = await page.$eval(`${TOP} a[href*="ekstre.pdf"]`, node => node.getAttribute("href"));
  ok(/donem=1/.test(href) && /from=2026-10-01/.test(href) && /to=2026-10-31/.test(href), `PDF bağlantısı dönemli (${href})`);
  const pdf = await fetchPdf(href);
  ok(pdf.status === 200, "PDF indi");
  const content = pdfText(pdf.buffer);
  ok(/01\.10\.2026 – 31\.10\.2026/.test(content), "PDF dönemi 01.10.2026 – 31.10.2026");
  ok(/Ekim ilk gün/.test(content) && /Ekim son gün/.test(content), "dönem uçlarındaki hareketler PDF'te");
  ok(!/Kasım ilk gün/.test(content), "dönem dışı (Kasım) hareket PDF'te YOK");
  ok(/850,00 TL Borçlu/.test(content), "PDF dönem sonu bakiyesi 850,00 TL (metinle aynı)");
  ok(/1\.000,00 TL B/.test(content), "devir 1.000,00 TL");
  periodPdf = pdf.buffer;
  await shot("02-gonderim-sirasi");
});

await step("D2 WhatsApp'ta Aç: kişinin adıyla inen PDF dönemli ve D1'le aynı", async () => {
  const auto = await page.$(`${TOP} [data-pdf]`);
  if (auto && !(await auto.isChecked())) await auto.check();
  const [download] = await Promise.all([page.waitForEvent("download"), page.click(`${TOP} [data-send]`)]);
  const recorded = await page.evaluate(() => window.__dl.slice());
  const name = recorded.at(-1)?.name || "";
  ok(name === `Ekstre ${NAME} 01.10.2026-31.10.2026.pdf`, `indirme bağlantısının dosya adı: ${name}`);
  ok(/donem=1&from=2026-10-01&to=2026-10-31&download=1/.test(recorded.at(-1)?.href || ""), "indirme bağlantısı dönemli");
  const file = path.join(root, "indirilen.pdf");
  await download.saveAs(file);
  const buffer = readFileSync(file);
  ok(periodPdf && Buffer.compare(buffer, periodPdf) === 0, "indirilen PDF bağlantıdaki dönemli PDF'le BAYT BAYT aynı");
  const wa = await page.evaluate(() => window.__wa.slice());
  ok(wa.length === 1 && /^https:\/\/wa\.me\/905327778899\?text=/.test(wa[0]), "WhatsApp sohbeti kişinin numarasıyla açıldı");
  await page.waitForSelector(`${TOP} .hof-wa-done`);
  await shot("03-tamam");
});

await step("D3 Tüm Hareketler: PDF bugüne kadar, bakiye metindekiyle aynı", async () => {
  await openStatementDialog();
  await choosePreset("all");
  const text = await bubble();
  ok(/Güncel bakiye: 890,00 TL \(borcunuz\)/.test(text), "baloncuk: 890,00 TL");
  await page.click(`${TOP} [data-start]`);
  await page.waitForSelector(`${TOP} [data-send]`);
  const href = await page.$eval(`${TOP} a[href*="ekstre.pdf"]`, node => node.getAttribute("href"));
  const content = pdfText((await fetchPdf(href)).buffer);
  ok(/Tüm Hareketler · 03\.11\.2026 tarihine kadar/.test(content), "PDF: Tüm Hareketler · 03.11.2026 tarihine kadar");
  ok(/Kasım ilk gün/.test(content) && /Ekim ilk gün/.test(content), "bütün hareketler");
  ok(/890,00 TL Borçlu/.test(content), "PDF bakiyesi 890,00 TL (metinle aynı)");
  await closeAll();
});

await step("D4 WhatsApp Mesajı İstemiyor: formda Tab + Boşluk, kartta rozet, pencerede seçilemez", async () => {
  await openCard();
  await page.click(`${TOP} [data-act="edit"]`);
  await page.waitForSelector(`${TOP} form input[name="waOptOut"]`);
  const box = `${TOP} form input[name="waOptOut"]`;
  ok(!(await page.isChecked(box)), "başlangıçta işaretsiz");
  const label = await page.$eval(box, node => node.closest("label")?.innerText.trim() || "");
  ok(label === "WhatsApp Mesajı İstemiyor", `alan adı: ${label}`);
  // Klavye: önceki odaklanabilir alandan Tab ile kutuya gelinir, Boşluk ile işaretlenir.
  await page.focus(box);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  ok(await page.evaluate(sel => document.activeElement === document.querySelector(sel), box), "Tab ile kutuya gelindi");
  await page.keyboard.press("Space");
  ok(await page.isChecked(box), "Boşluk ile işaretlendi");
  await page.click(`${TOP} form [type="submit"]`);
  await page.waitForFunction(() => document.querySelector("[data-wa-optout]"), null, { timeout: 15000 });
  const flag = server.app.store.get("SELECT wa_opt_out AS v FROM accounts WHERE id = ?", person.id).v;
  ok(flag === 1, `veri tabanında işaret ${flag}`);
  ok((await page.textContent("[data-wa-optout]")).trim() === "WhatsApp İstemiyor", "kartta rozet");
  await shot("04-rozet");
  await page.click(`${TOP} [data-act="whatsapp"]`);
  await page.waitForSelector(`${TOP} [data-kind="statement"]`);
  await page.click(`${TOP} [data-kind="statement"]`);
  await page.waitForSelector(`${TOP} .hof-wa-head`);
  const head = await page.$eval(`${TOP} .hof-wa-head`, node => node.innerText.replace(/\s+/g, " "));
  ok(/0 Gönderilecek/.test(head), `özet: ${head}`);
  const row = await page.$eval(`${TOP} tr[data-preview="${person.id}"]`, node => node.innerText.replace(/\s+/g, " "));
  ok(/WhatsApp Mesajı İstemiyor/.test(row), "satırda neden yazılı");
  ok(await page.isDisabled(`${TOP} [data-pick="${person.id}"]`), "kişi seçilemez");
  ok(await page.isDisabled(`${TOP} [data-start]`), "Gönderime Başla pasif");
  await shot("05-istemiyor");
  await closeAll();
});

ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
