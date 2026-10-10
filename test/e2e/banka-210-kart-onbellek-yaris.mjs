// İkinci küçük bulgular, madde 1 (10.10.2026; ders 20): kurumsal kart / banka hesabı seçicisinin önbelleği (client/assets/hof-bank.js choicesCache)
// yalnız canlı olay gelince boşalıyordu. Başka oturum ikinci kurumsal kartı (ya da ikinci banka hesabını) açtıktan sonra olay gelmeden açılan ödeme
// formu tek-kart görünümünde kalıyor, gizli alan BİRİNCİ kartın kimliğini gönderiyor; sunucu verilen kimliği kabul ettiği için ödeme sessizce
// birinci karta yazılıyordu (senaryo-banka-210b adım 16 bir koşuda bu yüzden düştü). Yeniden deneme ya da bekleme uzatma YOK: ön koşul ZORLA kurulur.
//
// Ön koşul: sayfanın canlı olay bağlantısı (/api/events) baştan kesilir — başka oturumun değişikliği bu sayfaya HİÇ ulaşmaz (olayın gecikmesinin en
// uç hâli). Sayfa önce seçici önbelleğini tek kartla/tek hesapla doldurur, sonra başka oturum (ayrı API istemcisi) ikinci kartı/hesabı etkinleştirir.
// Her denemede ön koşulun GERÇEKTEN oluştuğu ölçülür: sayfanın önbelleği tek kart/hesap derken sunucuda iki tane (oluşmadıysa deneme sayılmaz).
//
// Varyantlar (her biri 3 deneme; her denemede sayfa yeniden yüklenir, önbellek tek kartla dolar):
//   A kart, önbellek bayat İKEN form açılır  → beklenen: seçicide iki kart (form açılışında taze liste); seçimsiz kayıt yazılmaz; K2 seçilince yalnız K2.
//   B kart, form AÇIKKEN ikinci kart açılır   → beklenen: kayıt K1'e YAZILMAZ (sunucu tek kartı yalnız gerçekten tek kart varsa kendisi seçer),
//                                              hata "Kurumsal Kart seçin", seçici yenilenip iki kartı gösterir; K2 seçilince yalnız K2.
//   C havale tahsilatı, A'nın banka hesabı karşılığı; D havale, B'nin karşılığı.
//   E alış faturası Düzenle: peşin satır Kredi Kartı; form açıkken ikinci kart açılır → kayıt reddedilir ve hücre iki kartlı seçiciye döner.
// Çıkış: "N geçti, M kaldı" (kanıt aracının senaryo biçimi); ön koşulu oluşmayan deneme ayrıca sayılır ve kırmızı sayılır (kanıt yok).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ROUNDS = Number(process.env.TUR || 3);
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kart-onbellek-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f43" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE); // "başka oturum"
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const Z = await must("Ziraat", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
const G = await must("Garanti", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "İkinci TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
const K1 = await must("Kart 1", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Kurumsal Kart", kind: "card", creditLimit: "100.000", opening: { date: "2026-10-01", amount: "0" } }));
const K2 = await must("Kart 2", api.post("/api/workspace/bank/accounts", { bankName: "Yapı Kredi", name: "Kurumsal Kart 2", kind: "card", creditLimit: "100.000", opening: { date: "2026-10-01", amount: "0" } }));
const status = (acc, value) => must(`${acc.name} ${value}`, api.post(`/api/workspace/bank/accounts/${acc.id}/status`, { status: value }));
await status(G, "passive");
await status(K2, "passive");
const party = await must("cari", api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
const balance = async acc => ((await must("hesap", api.get(`/api/workspace/bank/accounts/${acc.id}`))).balanceMinor || 0) / 100;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
// ÖN KOŞUL: canlı olay bağlantısı hiç kurulmaz (başka oturumun değişikliği bu sayfaya ulaşmaz).
let liveBlocked = 0;
await context.route(/\/api\/events/, route => {
  liveBlocked += 1;
  return route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await installPageClock(page, app.config.now);
await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

let passed = 0;
let failed = 0;
let noPrecondition = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const pause = ms => page.waitForTimeout(ms);
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const closeAll = async () => {
  for (let index = 0; index < 8 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await pause(250);
  }
};
const yesToAll = async (rounds = 6) => {
  for (let i = 0; i < rounds; i += 1) {
    await pause(400);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (!yes) return;
    await yes.click();
  }
};
// Sayfa yeniden yüklenir, seçici önbelleği sunucunun O ANKİ hâliyle dolar (tek kart, tek havale hesabı).
const freshPage = async () => {
  await page.reload();
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.evaluate(() => window.HOF.bank.choices());
};
// Sayfanın önbelleğindeki kart/hesap sayısı (sunucuya sormadan; ön koşul ölçümü).
const cached = () => page.evaluate(async () => {
  const data = await window.HOF.bank.choices();
  return { card: data.forms.card.ids.length, bank: data.forms.bank.ids.length };
});
const openEntry = async kind => {
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`.hof-accounts-modal tr[data-account="${party.id}"]`, { timeout: 10000 });
  await page.click(`.hof-accounts-modal tr[data-account="${party.id}"]`);
  await page.waitForSelector(`.hof-accounts-modal [data-entry="${kind}"]`, { timeout: 10000 });
  await page.click(`.hof-accounts-modal [data-entry="${kind}"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`, { timeout: 8000 });
  await pause(600); // seçici yerleşsin
  return `${top} .hof-form`;
};
const entriesOf = async () => (await must("cari", api.get(`/api/workspace/accounts/${party.id}`))).entries;
const formGone = () => page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible .hof-form input[name="amount"]'), null, { timeout: 10000 });

// Kart (A/B) ve havale (C/D) varyantları: aynı akış, aile farklı.
async function cariVariant({ id, family, early, round }) {
  const card = family === "card";
  const first = card ? K1 : Z;
  const second = card ? K2 : G;
  const field = card ? "cardAccountId" : "bankAccountId";
  const pick = card ? '[data-bank-pick="card"]' : '[data-bank-pick]:not([data-bank-pick="card"])';
  const amount = String((card ? 700 : 300) + round * 10 + (early ? 1 : 2));
  console.log(`\n■ ${id}${round} — ${card ? "kurumsal kart ödemesi" : "havale tahsilatı"}, ikinci ${card ? "kart" : "hesap"} ${early ? "form açılmadan ÖNCE" : "form AÇIKKEN"} (canlı olay yok)`);
  await freshPage();
  const startCache = await cached();
  if (early) await status(second, "active");
  let form = await openEntry(card ? "out" : "in");
  await page.click(`${form} input[name="amount"]`);
  await page.keyboard.type(amount, { delay: 40 });
  await page.selectOption(`${form} select[name="method"]`, card ? "card" : "bank");
  await pause(300);
  if (!early) await status(second, "active");
  // Ön koşul: sayfa tek kart/hesap biliyordu, sunucuda artık iki tane ve olay gelmedi.
  const precondition = (card ? startCache.card : startCache.bank) === 1 && (card ? (await must("seçenekler", api.get("/api/workspace/bank/choices"))).forms.card.ids.length : (await must("seçenekler", api.get("/api/workspace/bank/choices"))).forms.bank.ids.length) === 2 && liveBlocked > 0;
  if (!precondition) {
    noPrecondition += 1;
    console.log(`  ! ön koşul oluşmadı (önbellek ${JSON.stringify(startCache)}); deneme sayılmaz`);
    await closeAll();
    await status(second, "passive");
    return;
  }
  const before = { first: await balance(first), second: await balance(second), entries: (await entriesOf()).length };
  if (early) {
    const options = await page.$$eval(`${form} ${pick} select[name="${field}"] option`, nodes => nodes.map(node => node.value)).catch(() => []);
    ok(options.includes(first.id) && options.includes(second.id), `form açılışında seçicide iki ${card ? "kart" : "hesap"} (${options.filter(Boolean).length} seçenek)`);
    if (card) {
      // Kartta ön seçim yoktur: seçimsiz kayıt yazılmamalı.
      await page.click(`${form} button[type="submit"]`);
      await pause(700);
      ok((await entriesOf()).length === before.entries && (await balance(first)) === before.first, `seçimsiz kaydedilmedi (${await textOf(`${form} .hof-form-error`)})`);
    }
    if (!options.includes(second.id)) {
      await closeAll();
      await status(second, "passive");
      return;
    }
  } else {
    await page.click(`${form} button[type="submit"]`);
    await yesToAll(3);
    await pause(900);
    const wrote = (await entriesOf()).length !== before.entries;
    ok(!wrote && (await balance(first)) === before.first, `ikinci ${card ? "kart" : "hesap"} varken birinci ${card ? "karta" : "hesaba"} (${first.name}) SESSİZCE yazılmadı (yazılan kayıt ${wrote ? "VAR" : "yok"}, bakiyesi ${await balance(first)})`);
    if (wrote) {
      // Eski kod: kayıt yazıldı, form kapandı; denemenin geri kalanı anlamsız (her deneme kendi "önce"sini okur).
      await closeAll();
      await status(second, "passive");
      return;
    }
    const error = await textOf(`${form} .hof-form-error`);
    ok(new RegExp(card ? "Kurumsal Kart" : "Banka Hesabı").test(error), `hata seçimi istiyor: “${error}”`);
    await page.waitForSelector(`${form} ${pick} select[name="${field}"]`, { timeout: 5000 }).catch(() => null);
    const options = await page.$$eval(`${form} ${pick} select[name="${field}"] option`, nodes => nodes.map(node => node.value)).catch(() => []);
    ok(options.includes(first.id) && options.includes(second.id), `hatadan sonra seçici yenilendi: iki ${card ? "kart" : "hesap"} (${options.filter(Boolean).length})`);
    if (!options.includes(second.id)) {
      await closeAll();
      await status(second, "passive");
      return;
    }
  }
  form = `${top} .hof-form`;
  await page.selectOption(`${form} ${pick} select[name="${field}"]`, second.id);
  await page.click(`${form} button[type="submit"]`);
  await yesToAll(3);
  await formGone().catch(() => null);
  await pause(700);
  const sign = card ? -1 : 1;
  const delta = Number(amount);
  ok((await balance(second)) === before.second + sign * delta && (await balance(first)) === before.first, `yalnız ${second.name} ${sign > 0 ? "+" : "−"}${delta} (${second.name} ${await balance(second)}, ${first.name} ${await balance(first)})`);
  await closeAll();
  await status(second, "passive");
}

// E: alış faturası Düzenle, peşin satır Kredi Kartı; form açıkken ikinci kart açılır.
async function invoiceVariant(round) {
  console.log(`\n■ E${round} — alış faturası Düzenle, peşin Kredi Kartı; ikinci kart form AÇIKKEN (canlı olay yok)`);
  const doc = await must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: party.id, number: `AL-ONB-${round}`, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 400 + round, discountRate: 0, vatRate: 0, expenseCode: "office" }], payment: { cash: [{ amount: String(400 + round), method: "bank", bankAccountId: Z.id, lineKey: `onb-${round}` }], cheques: [], endorse: [], rest: "open" }, force: true }));
  await freshPage();
  const startCache = await cached();
  const inv = `${modal} .hof-invoices-modal`;
  await page.evaluate(id => window.HOF.invoices.openDoc(id), doc.id);
  await page.waitForSelector(`${inv} [data-act="modify"]:not([disabled])`, { timeout: 10000 });
  await page.click(`${inv} [data-act="modify"]`);
  const cell = `${inv} [data-bank-cell="0"]`;
  await page.waitForSelector(`${cell}[data-bank-kind="bank"]`, { timeout: 10000 });
  await page.selectOption(`${inv} select[data-pay="cash"][data-i="0"][data-f="method"]`, "card");
  await page.waitForSelector(`${cell}[data-bank-kind="card"]`, { timeout: 8000 });
  const singleNote = await textOf(cell);
  await status(K2, "active");
  const precondition = startCache.card === 1 && (await must("seçenekler", api.get("/api/workspace/bank/choices"))).forms.card.ids.length === 2 && /kurumsal kartına yazılır/.test(singleNote);
  if (!precondition) {
    noPrecondition += 1;
    console.log(`  ! ön koşul oluşmadı (önbellek ${JSON.stringify(startCache)}, hücre “${singleNote}”); deneme sayılmaz`);
    await closeAll();
    await status(K2, "passive");
    return;
  }
  const before = { k1: await balance(K1), k2: await balance(K2) };
  await page.click(`${inv} [data-act="issue"]`);
  await yesToAll(4);
  await pause(1000);
  const saved = await must("fatura", api.get(`/api/workspace/invoices/${doc.id}`));
  ok(saved.payments?.[0]?.finRef === Z.id && (await balance(K1)) === before.k1, `kayıt reddedildi, satır Ziraat'te kaldı (${saved.payments?.[0]?.finRef === Z.id ? "Ziraat" : saved.payments?.[0]?.finRef})`);
  await page.waitForSelector(`${cell}[data-bank-kind="card"] select`, { timeout: 5000 }).catch(() => null);
  const options = await page.$$eval(`${cell} select option`, nodes => nodes.map(node => node.value)).catch(() => []);
  ok(options.includes(K1.id) && options.includes(K2.id), `hatadan sonra hücre iki kartlı seçiciye döndü (${options.filter(Boolean).length} kart)`);
  if (options.includes(K2.id)) {
    await page.selectOption(`${cell} select`, K2.id);
    await pause(400);
    await page.click(`${inv} [data-act="issue"]`);
    await yesToAll(4);
    await pause(1000);
    const after = await must("fatura", api.get(`/api/workspace/invoices/${doc.id}`));
    ok(after.payments?.[0]?.finRef === K2.id && (await balance(K2)) === before.k2 - (400 + round) && (await balance(K1)) === before.k1, `peşin satır Kurumsal Kart 2'de (K2 ${await balance(K2)}, K1 ${await balance(K1)})`);
  }
  await closeAll();
  await status(K2, "passive");
}

try {
  // Bir denemenin beklenmeyen hatası (eski kodda seçici yokken seçim gibi) öbür denemeleri durdurmaz; deneme kırmızı sayılır, durum temizlenir.
  const guarded = async (label, fn) => {
    try {
      await fn();
    } catch (error) {
      failed += 1;
      console.log(`  ✗ ${label}: beklenmeyen hata: ${String(error.message || error).split("\n")[0]}`);
      await closeAll().catch(() => null);
      await status(K2, "passive").catch(() => null);
      await status(G, "passive").catch(() => null);
    }
  };
  for (let round = 1; round <= ROUNDS; round += 1) {
    await guarded(`A${round}`, () => cariVariant({ id: "A", family: "card", early: true, round }));
    await guarded(`B${round}`, () => cariVariant({ id: "B", family: "card", early: false, round }));
    await guarded(`C${round}`, () => cariVariant({ id: "C", family: "bank", early: true, round }));
    await guarded(`D${round}`, () => cariVariant({ id: "D", family: "bank", early: false, round }));
    await guarded(`E${round}`, () => invoiceVariant(round));
  }
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  if (noPrecondition) failed += noPrecondition;
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\nön koşulu oluşmayan deneme: ${noPrecondition}; canlı olay isteği kesildi: ${liveBlocked}`);
  console.log(`\n${failed ? "✗" : "✓"} banka-210-kart-onbellek-yaris: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
