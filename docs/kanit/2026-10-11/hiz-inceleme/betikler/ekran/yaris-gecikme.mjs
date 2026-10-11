// Yük testindeki ekran hatasının kaynağı (11.10.2026; docs/kanit/2026-10-11/olcek-sonra/olcek-210-sonuc.json → ekran.hatalar):
//   "banka süzgeç: page.waitForFunction: Timeout 30000ms exceeded · {secici: true, secenek 4, satir 50, hesap: …}"
// Banka → Hareketler'de hesap süzgeci seçildikten sonra liste 30 sn içinde o hesaba geçmedi (1 kişide 28 turda 2, 10'da 24'te 1, 20'de 21'de 1).
// Soru: ürün mü (açık pencerenin arka plan yenilemesi kullanıcının süzgeç seçimini eziyor), ölçüm aracı mı?
// Ders 20 (ara sıra kırmızı zorla üretilir): ön koşul ZORLA kurulur — başka bir oturum sürekli banka kaydı girer (açık pencere en sık 1,5 sn'de
// bir arka planda yeniden yüklenir ve baştan çizilir); sayfa ölçek aracının Banka penceresi turunu AYNI sırayla yürür (hesap süzgeci → Daha
// Fazla → Tüm Hesaplar → tek turda ekrandan + Masraf, çift turda başka oturumun masrafı). Her süzgeç seçiminde: /bank/movements isteği gerçekten
// gönderildi mi (hangi account değeriyle), seçici ve listeler (data-account) son durumda ne gösteriyor. Karşılaştırma: aynı tur arka plan
// yazımı OLMADAN. Ürün kodu DEĞİŞMEZ.
// Kullanım: node docs/kanit/2026-10-11/hiz-duzeltme/ekran-suzgec-yaris.mjs [--tur 60] [--json <çıktı>]
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = "/home/user/ofis---y-netimi";
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const ROUNDS = Number(opt("tur", 60)) || 60;
const OUTPUT = opt("json", "");
const { chromium } = await import("/home/user/ofis---y-netimi/node_modules/playwright/index.mjs");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const PASS = "Yaris-Admin-2026!";
// Gerçek saat: tarayıcının formu bugünü kendi saatinden önerir; sunucu sahte saatle başka bir günde olursa form kaydı "ileri tarih" ile düşer.
const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString();
const TODAY = local.slice(0, 10);
const NOW = undefined;
const root = mkdtempSync(path.join(tmpdir(), "destekofis-suzgec-yaris-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f42" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return res.data?.data ?? res.data;
};
const writer = createClient(BASE);
await must("giriş", writer.login("admin", PASS));
const BANK = "/api/workspace/bank";
const a = await must("hesap A", writer.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: `${TODAY.slice(0, 8)}01`, amount: "100.000", confirmed: true } }));
const b = await must("hesap B", writer.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: `${TODAY.slice(0, 8)}01`, amount: "100.000", confirmed: true } }));
// 60'tan çok satır: Daha Fazla Göster düğmesi çıksın (sayfa 50).
for (let i = 0; i < 130; i += 1) await must(`masraf ${i}`, writer.post(`${BANK}/vouchers`, { type: "fee", accountId: i % 2 ? a.id : b.id, date: TODAY, amount: `${10 + i}`, feeType: "eft", tax: "bsmv_incl", description: `Hazırlık ${i}`, similarOk: true, requestId: randomUUID() }));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
const page = await context.newPage();
page.on("dialog", dialog => dialog.accept());
const requests = [];
const DELAY = Number(opt("gecikme", 2500));
let seedR = Number(opt("tohum", 7));
const rnd = () => { seedR = (seedR * 1103515245 + 12345) % 2147483648; return seedR / 2147483648; };
const log = [];
await page.route("**/api/workspace/bank/**", async route => {
  const req = route.request();
  if (req.method() !== "GET") return route.continue();
  const wait = Math.floor(rnd() * DELAY);
  const u = new URL(req.url());
  const t0 = Date.now();
  const resp = await route.fetch().catch(() => null);
  if (!resp) return route.abort().catch(() => {});
  await new Promise(r => setTimeout(r, wait));
  log.push({ at: t0, done: Date.now(), path: u.pathname.replace("/api/workspace/bank", ""), account: u.searchParams.get("account"), wait });
  await route.fulfill({ response: resp }).catch(() => {});
});
page.on("request", request => {
  const url = request.url();
  if (url.includes("/api/workspace/bank/movements")) requests.push({ at: Date.now(), account: new URL(url).searchParams.get("account") || "" });
});
await page.goto(BASE);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await page.click('#hof-auth button[type="submit"]');
await page.waitForSelector('#hof-sidecard [data-action="bank"]', { timeout: 60000 });
const WIN = ".hof-bank-modal";
await page.click('#hof-sidecard [data-action="bank"]');
await page.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 60000 });
await page.click(`${WIN} .hof-bank-tabs [data-tab="movements"]`);
await page.waitForSelector(`${WIN} .hof-bank-moves tbody tr[data-event]`, { timeout: 60000 });

let writing = false;
let writes = 0;
const backgroundWriter = async () => {
  while (writing) {
    const res = await writer.post(`${BANK}/vouchers`, { type: "fee", accountId: writes % 2 ? a.id : b.id, date: TODAY, amount: "1", feeType: "eft", tax: "bsmv_incl", description: `Arka plan ${writes}`, similarOk: true, requestId: randomUUID() });
    if (res.status === 200) writes += 1;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
};
const MODAL = ".hof-modal-backdrop.is-visible";
const answerConfirms = async () => {
  for (let i = 0; i < 3; i += 1) {
    const yes = await page.waitForSelector(`${MODAL}:last-of-type [data-answer="yes"]`, { timeout: 1200 }).catch(() => null);
    if (!yes) return;
    await yes.click().catch(() => null);
  }
};
const named = value => (value === a.id ? "A" : value === b.id ? "B" : value === "" ? "Tüm" : value);

async function rounds(label, withWriter) {
  writing = withWriter;
  const loop = withWriter ? backgroundWriter() : null;
  const failures = [];
  const moreFails = [];
  for (let n = 1; n <= ROUNDS; n += 1) {
    const target = n % 3 === 0 ? "" : n % 2 ? a.id : b.id;
    await page.waitForFunction(({ win, id }) => [...(document.querySelector(`${win} [data-mv="account"]`)?.options || [])].some(option => option.value === id), { win: WIN, id: target }, { timeout: 30000 });
    const sentFrom = requests.length;
    const at = Date.now();
    await page.selectOption(`${WIN} [data-mv="account"]`, target);
    const reached = await page.waitForFunction(({ win, id }) => {
      const rows = document.querySelectorAll(`${win} .hof-bank-moves tbody tr[data-event]`);
      return rows.length > 0 && (document.querySelector(`${win} [data-moves]`)?.dataset.account || "") === id;
    }, { win: WIN, id: target }, { timeout: 20000 }).then(() => true).catch(() => false);
    if (!reached) {
      const after = await page.evaluate(win => ({ select: document.querySelector(`${win} [data-mv="account"]`)?.value ?? null, lists: [...document.querySelectorAll(`${win} [data-moves]`)].map(node => `${node.dataset.moves}:${node.dataset.account ?? "(yok)"}`), rows: document.querySelectorAll(`${win} .hof-bank-moves tbody tr[data-event]`).length, forms: document.querySelectorAll("form.hof-bank-voucher").length }), WIN);
      const sent = requests.slice(sentFrom).map(item => `${item.at - at} ms → ${named(item.account)}`);
      failures.push({ log: log.filter(x => x.done >= at - 3000).map(x => `${x.at - at}->${x.done - at} ${x.path} ${x.account === null ? "" : named(x.account)}`), n, hedef: named(target), secici: named(after.select), listeler: after.lists.map(item => item.replace(a.id, "A").replace(b.id, "B")), satir: after.rows, acikForm: after.forms, istekler: sent });
    }
    const more = await page.$(`${WIN} [data-act="mv-more"]`);
    if (more) {
      const before = await page.$$eval(`${WIN} .hof-bank-moves tbody tr[data-event]`, list => list.length);
      await more.click().catch(() => null);
      const grewMore = await page.waitForFunction(count => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length > count, before, { timeout: 20000 }).then(() => true).catch(() => false);
      if (!grewMore) { moreFails.push(n); console.log(`  tur ${n}: DAHA FAZLA büyütmedi (önce ${before})`); }
    }
    await page.selectOption(`${WIN} [data-mv="account"]`, "");
    await page.waitForTimeout(400);
    const mark = `YARIS-${withWriter ? "V" : "Y"}-${n}`;
    if (n % 2 === 1) {
      await page.click(`${WIN} [data-act="v-fee"]`);
      await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 15000 });
      await page.selectOption('form.hof-bank-voucher [name="accountId"]', b.id).catch(() => null);
      await page.selectOption('form.hof-bank-voucher [name="feeType"]', "eft").catch(() => null);
      await page.fill('form.hof-bank-voucher [name="amount"]', "12,34");
      await page.fill('form.hof-bank-voucher [name="description"]', mark);
      await page.click('form.hof-bank-voucher button[type="submit"]');
      await answerConfirms();
    } else {
      await must("başka oturumun masrafı", writer.post(`${BANK}/vouchers`, { type: "fee", accountId: a.id, date: TODAY, amount: "5", feeType: "eft", tax: "bsmv_incl", description: mark, similarOk: true, requestId: randomUUID() }));
    }
    const listed = await page.waitForFunction(needle => [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")].some(row => new RegExp(`${needle}(?![0-9])`).test(row.textContent)), mark, { timeout: 10000 }).then(() => true).catch(() => false);
    const formOpen = await page.waitForSelector("form.hof-bank-voucher", { state: "detached", timeout: 5000 }).then(() => false).catch(() => true);
    if (formOpen && (await page.$("form.hof-bank-voucher"))) await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    console.log(`[${withWriter ? "yazımlı" : "kontrol"}] tur ${n}: ${Date.now() - at} ms · süzgeç ${reached ? "tamam" : "GEÇMEDİ"} · kayıt listede ${listed ? "evet" : "hayır"}${formOpen ? " · form açık kaldı" : ""}`);
  }
  writing = false;
  await loop;
  const row = { durum: label, tur: ROUNDS, basarisiz: failures.length, dahaFazlaBasarisiz: moreFails, arkaPlanYazimi: withWriter ? writes : 0, ornekler: failures.slice(0, 10) };
  console.log(`${label}: ${ROUNDS} turun ${failures.length}'inde liste seçilen hesaba 8 sn içinde geçmedi${withWriter ? ` (arka plan yazımı ${writes})` : ""}`);
  for (const item of row.ornekler) console.log(`  tur ${item.n}: hedef ${item.hedef} · seçici ${item.secici} · listeler ${item.listeler.join(", ")} · satır ${item.satir} · açık form ${item.acikForm} · seçimden sonraki /movements istekleri [${item.istekler.join("; ")}]\n    günlük: ${item.log.join(" | ")}`);
  return row;
}
const result = { tarih: new Date().toISOString(), sonuc: [] };
if (opt("kontrol", "0") === "1") result.sonuc.push(await rounds("arka plan yazımı YOK (kontrol)", false));
result.sonuc.push(await rounds("arka plan yazımı VAR (başka oturum 250 ms'de bir masraf)", true));
if (OUTPUT) writeFileSync(OUTPUT, JSON.stringify(result, null, 1));
await browser.close();
await app.close();
rmSync(root, { recursive: true, force: true });
