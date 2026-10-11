// Hız düzeltmesinin bağımsız incelemesi (11.10.2026; docs/kanit/2026-10-11/hiz-inceleme) H4 ve H5 — "Daha Fazla Göster" ile arka plan
// yenilemesinin ve kayıttan sonraki pencere yenilemesinin yarışları, GERÇEK Chromium'da. Yeniden deneme ya da bekleme uzatma YOK (ders 20): yarışın
// ön koşulu Playwright route ile yanıt TUTULARAK kurulur; her denemede ön koşulun gerçekten oluştuğu ölçülür, oluşmayan deneme KIRMIZI sayılır.
//
// Varyantlar (her tur; Banka → Hareketler, sayfa 50 satır; Cari, sayfa 300 cari):
//   B (H4) Daha Fazla'nın imleçli yanıtı tutulur → başka oturum masraf girer → arka plan yenilemesi listeyi taze ilk sayfayla değiştirir → bırakılır.
//          Beklenen: liste = sunucunun ilk N satırı (önceden sayfa sınırındaki hareket hiç görünmüyordu), Daha Fazla bir sayfa ekledi.
//   A (H4 tersi) arka plan yenilemesinin yanıtı tutulur → Daha Fazla (100 satır) → bırakılır. Beklenen: 100 satır kalır VE yeni hareket görünür
//          (önceden yenileme düşüyordu: yeni hareket sıradaki olaya kadar görünmüyordu).
//   C (H5) + Masraf kaydedilir, pencere yenilemesinin /summary yanıtı tutulur, form kapatılır, Daha Fazla (100) → bırakılır. Beklenen: 100 satır kalır
//          (önceden 50'ye dönüyordu — ölçek aracının "banka süzgeç" 30 sn hatasının kaynağı).
//   D (H5) + Masraf kaydedilir, pencere yenilemesinin /movements yanıtı tutulur (yükleme sürüyor), Daha Fazla tıklanır → bırakılır. Beklenen:
//          tıklama yok sayılmaz, yükleme bitince çalışır (100 satır).
//   E (H4 komşusu, Cari) Daha Fazla'nın yanıtı (301–600) tutulur → başka oturum ilk sayfadaki bir cariyi siler → arka plan yenilemesi ilk 300'ü
//          taze yazar → bırakılır. Beklenen: liste = sunucunun ilk N carisi (önceden 301. cari iki kez görünüyordu).
// Çıkış: "N geçti, M kaldı" (kanıt aracının senaryo biçimi). TUR ortam değişkeni tur sayısı (varsayılan 3).
// Eski istemciyle (kırmızı kanıt): DEPO=<eski kopya> ile çalıştırılırsa sunucu ve istemci o kopyadan yüklenir.
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "DahaFazla-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ROUNDS = Number(process.env.TUR || 3);
const root = mkdtempSync(path.join(tmpdir(), "destekofis-daha-fazla-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f71" } });
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
const BANK = "/api/workspace/bank";
await must("kurulum geç", api.post(`${BANK}/setup/dismiss`, {}));
const A = await must("hesap A", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
const B = await must("hesap B", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
for (let i = 0; i < 170; i += 1) await must(`masraf ${i}`, api.post(`${BANK}/vouchers`, { type: "fee", accountId: i % 2 ? A.id : B.id, date: TODAY, amount: `${10 + i}`, feeType: "eft", tax: "bsmv_incl", description: `Hazırlık ${i}`, similarOk: true, requestId: randomUUID() }));
let writes = 0;
const writeOther = () => must("başka oturumun masrafı", api.post(`${BANK}/vouchers`, { type: "fee", accountId: A.id, date: TODAY, amount: `${1 + (writes % 7)}`, feeType: "eft", tax: "bsmv_incl", description: `Başka oturum ${(writes += 1)}`, similarOk: true, requestId: randomUUID() }));
// Cari (E): 330 cari (sayfa 300).
for (let i = 1; i <= 330; i += 1) await must(`cari ${i}`, api.post("/api/workspace/accounts", { name: `Daha Fazla Carisi ${String(i).padStart(3, "0")}`, type: "customer", registeredOn: "2026-09-01" }));
const CARI_QUERY = "q=&type=&group=&subgroup=&status=active&balance=all&sort=no";
const serverCari = async n => (await must("cari listesi", api.get(`/api/workspace/accounts?${CARI_QUERY}&limit=${n}&offset=0`))).accounts.map(item => item.id);
const serverMoves = async n => (await must("hareket listesi", api.get(`${BANK}/movements?limit=${n}`))).rows.map(row => row.no);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
if (process.env.DEBUG) page.on("console", message => message.text().startsWith("DBG") && console.log("   [sayfa]", message.text()));
await installPageClock(page, app.config.now);

// Tutma düzeneği: hold(tür) → o türdeki SIRADAKİ istek sunucuya gider, yanıtı alınır ama sayfaya bırakılana dek tutulur.
const holds = [];
const kindOf = url => {
  const u = new URL(url);
  if (u.pathname === `${BANK}/movements`) return u.searchParams.has("cursor") ? "mv-cursor" : "mv-plain";
  if (u.pathname === `${BANK}/summary`) return "summary";
  if (u.pathname === "/api/workspace/accounts") return Number(u.searchParams.get("offset") || 0) > 0 ? "cari-more" : "cari-plain";
  return "";
};
await page.route(/\/api\/workspace\/(bank\/(movements|summary)|accounts)(\?|$)/, async route => {
  const kind = kindOf(route.request().url());
  const hold = holds.find(item => item.kind === kind && !item.taken);
  if (!hold) return route.continue();
  hold.taken = true;
  const response = await route.fetch();
  hold.arrive();
  await hold.released;
  return route.fulfill({ response });
});
const hold = kind => {
  const item = { kind, taken: false };
  item.arrived = new Promise(resolve => (item.arrive = resolve));
  item.released = new Promise(resolve => (item.release = resolve));
  holds.push(item);
  return item;
};
const arrivedWithin = (item, ms = 10000) => Promise.race([item.arrived.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), ms))]);
const dropHold = item => {
  item.taken = true;
  item.release();
};

await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector('#hof-sidecard [data-action="bank"]', { timeout: 60000 });

let passed = 0;
let failed = 0;
let noPrecondition = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const precondition = (cond, what) => {
  if (!cond) {
    noPrecondition += 1;
    console.log(`  ✗ ÖN KOŞUL OLUŞMADI: ${what} (deneme sayılmaz, kırmızı)`);
  } else console.log(`  · ön koşul: ${what}`);
  return Boolean(cond);
};
const pause = ms => page.waitForTimeout(ms);
const MODAL = ".hof-modal-backdrop.is-visible";
const WIN = ".hof-bank-modal";
const ROWS = `${WIN} .hof-bank-moves tbody tr[data-event]`;
const count = () => page.$$eval(ROWS, list => list.length);
const shownNos = () => page.$$eval(ROWS, list => list.map(row => row.dataset.no));
const compare = (shown, truth) => ({ missing: truth.filter(no => !shown.includes(no)), dup: shown.filter((no, i) => shown.indexOf(no) !== i), extra: shown.filter(no => !truth.includes(no)) });
const sameAsServer = async (label, { min }) => {
  const shown = await shownNos();
  const diff = compare(shown, await serverMoves(shown.length));
  ok(shown.length >= min, `${label}: listede ${shown.length} hareket (en az ${min})`);
  ok(!diff.missing.length && !diff.dup.length && !diff.extra.length, `${label}: liste = sunucunun ilk ${shown.length} hareketi (eksik ${JSON.stringify(diff.missing)}, çift ${JSON.stringify(diff.dup)}, fazla ${JSON.stringify(diff.extra)})`);
};
// Bütün tutulanlar bırakılır, ekran yatışır (yeni istek kalmaz).
const settle = async () => {
  for (const item of holds) if (!item.taken) dropHold(item);
  holds.length = 0;
  await pause(1500);
};
const openBank = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await pause(200);
  }
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 60000 });
  await page.click(`${WIN} .hof-bank-tabs [data-tab="movements"]`);
  await page.waitForSelector(ROWS, { timeout: 60000 });
};
// Liste başa (50): süzgeç Hesap A → Tüm (süzgeç değişince liste ilk sayfadan açılır).
const resetMoves = async () => {
  if (!(await page.$(`${WIN} [data-bank] .hof-bank-tabs`))) await openBank();
  await page.selectOption(`${WIN} [data-mv="account"]`, A.id);
  await page.waitForFunction(id => document.querySelector(".hof-bank-modal [data-moves]")?.dataset.account === id, A.id);
  await page.selectOption(`${WIN} [data-mv="account"]`, "");
  await page.waitForFunction(sel => document.querySelector(".hof-bank-modal [data-moves]")?.dataset.account === "" && document.querySelectorAll(sel).length === 50, ROWS);
  await pause(800);
};
const clickMore = () => page.click(`${WIN} [data-act="mv-more"]`);
const grows = (from, ms = 8000) => page.waitForFunction(([sel, c]) => document.querySelectorAll(sel).length > c, [ROWS, from], { timeout: ms }).then(() => true).catch(() => false);
// Her kayıt ayrı tutarla (aynı tutar "Benzer İşlem" sorusu açar; soru gelirse "Yine de Kaydet").
let fees = 0;
const saveFee = async (mark, held) => {
  fees += 1;
  await page.click(`${WIN} [data-act="v-fee"]`);
  await page.waitForSelector('form.hof-bank-voucher [name="amount"]');
  await page.selectOption('form.hof-bank-voucher [name="accountId"]', B.id).catch(() => null);
  await page.selectOption('form.hof-bank-voucher [name="feeType"]', "eft").catch(() => null);
  await page.fill('form.hof-bank-voucher [name="amount"]', `${300 + fees},${String(fees % 100).padStart(2, "0")}`);
  await page.fill('form.hof-bank-voucher [name="description"]', mark);
  await page.click('form.hof-bank-voucher button[type="submit"]');
  const similar = await Promise.race([held.arrived.then(() => null), page.waitForSelector(`${MODAL}:last-of-type [data-answer="yes"]`, { timeout: 3000 }).catch(() => null)]);
  if (similar) await similar.click();
};
// Kayıttan sonra açık kalan form/onay (yenileme tutuluyor) kapatılır — kullanıcı (ve ölçek aracı) formu Escape ile kapatır.
const closeForm = async () => {
  const yes = await page.waitForSelector(`${MODAL}:last-of-type [data-answer="yes"]`, { timeout: 800 }).catch(() => null);
  if (yes) await yes.click();
  if (await page.$("form.hof-bank-voucher")) await page.keyboard.press("Escape");
  await page.waitForSelector("form.hof-bank-voucher", { state: "detached", timeout: 5000 }).catch(() => null);
  return !(await page.$("form.hof-bank-voucher"));
};

async function variantB(round) {
  console.log(`\n■ B${round} — Daha Fazla tutulurken başka oturum yazar, arka plan yenilemesi listeyi değiştirir (H4)`);
  await resetMoves();
  const more = hold("mv-cursor");
  await clickMore();
  const got = await arrivedWithin(more);
  const firstNo = (await shownNos())[0];
  await writeOther();
  const refreshed = await page.waitForFunction(([sel, first]) => document.querySelector(sel)?.dataset.no !== first, [ROWS, firstNo], { timeout: 10000 }).then(() => true).catch(() => false);
  if (!precondition(got && refreshed, `Daha Fazla yanıtı tutuldu (${got}) ve arka plan yenilemesi listeyi taze yazdı (${refreshed})`)) return settle();
  more.release();
  await grows(50);
  await settle();
  await sameAsServer(`B${round}`, { min: 100 });
}
async function variantA(round) {
  console.log(`\n■ A${round} — arka plan yenilemesi tutulurken Daha Fazla (H4 tersi)`);
  await resetMoves();
  const quiet = hold("mv-plain");
  await writeOther();
  const got = await arrivedWithin(quiet);
  const before = await count();
  await clickMore();
  const grew = await grows(before);
  if (!precondition(got && grew, `arka plan yenilemesi tutuldu (${got}) ve Daha Fazla bu sırada yazıldı (${grew})`)) return settle();
  quiet.release();
  await settle();
  await sameAsServer(`A${round}`, { min: 100 });
}
async function variantC(round) {
  console.log(`\n■ C${round} — + Masraf kaydının pencere yenilemesi (/summary) tutulurken Daha Fazla (H5)`);
  await resetMoves();
  const summary = hold("summary");
  await saveFee(`C-${round}`, summary);
  const got = await arrivedWithin(summary);
  const closed = await closeForm();
  const before = await count();
  await clickMore();
  const grew = await grows(before);
  if (!precondition(got && closed && grew, `yenileme tutuldu (${got}), form kapandı (${closed}), Daha Fazla yazıldı (${grew})`)) return settle();
  summary.release();
  await settle();
  await sameAsServer(`C${round} (Daha Fazla geri alınmadı)`, { min: 100 });
}
async function variantD(round) {
  console.log(`\n■ D${round} — + Masraf kaydının pencere yenilemesi (/movements) sürerken Daha Fazla tıklanır (H5)`);
  await resetMoves();
  const moves = hold("mv-plain");
  await saveFee(`D-${round}`, moves);
  const got = await arrivedWithin(moves);
  const closed = await closeForm();
  const before = await count();
  await clickMore();
  const grewEarly = await grows(before, 1500);
  if (!precondition(got && closed && !grewEarly, `liste yüklemesi tutuldu (${got}), form kapandı (${closed}), tıklama yükleme sürerken (liste büyümedi: ${!grewEarly})`)) return settle();
  moves.release();
  await grows(50, 8000);
  await settle();
  await sameAsServer(`D${round} (yükleme sırasındaki tıklama yok sayılmadı)`, { min: 100 });
}
const CARI = ".hof-accounts-modal";
const CARI_ROWS = `${CARI} tr[data-account]`;
const shownCari = () => page.$$eval(CARI_ROWS, list => list.map(row => row.dataset.account));
async function variantE(round) {
  console.log(`\n■ E${round} — Cari: Daha Fazla tutulurken başka oturum ilk sayfadan bir cariyi siler (H4 komşusu)`);
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await pause(200);
  }
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForFunction(sel => document.querySelectorAll(sel).length === 300, CARI_ROWS, { timeout: 60000 });
  await pause(800);
  const more = hold("cari-more");
  await page.click(`${CARI} [data-act="more"]`);
  const got = await arrivedWithin(more);
  const victim = (await shownCari())[10 + round];
  await must("başka oturum cariyi siler", api.del(`/api/workspace/accounts/${victim}`));
  const refreshed = await page.waitForFunction(([sel, id]) => !document.querySelector(`${sel}[data-account="${id}"]`), [CARI_ROWS, victim], { timeout: 10000 }).then(() => true).catch(() => false);
  if (!precondition(got && refreshed, `Daha Fazla yanıtı tutuldu (${got}) ve arka plan yenilemesi silineni listeden çıkardı (${refreshed})`)) return settle();
  more.release();
  await page.waitForFunction(sel => document.querySelectorAll(sel).length > 300, CARI_ROWS, { timeout: 8000 }).catch(() => null);
  await settle();
  const shown = await shownCari();
  const truth = await serverCari(shown.length);
  const dup = shown.filter((id, i) => shown.indexOf(id) !== i);
  ok(shown.length > 300, `E${round}: Daha Fazla bir sayfa ekledi (${shown.length} cari)`);
  ok(!dup.length && JSON.stringify(shown) === JSON.stringify(truth), `E${round}: liste = sunucunun ilk ${shown.length} carisi (çift ${dup.length}, eksik ${truth.filter(id => !shown.includes(id)).length})`);
}

try {
  await openBank();
  const guarded = async (label, fn) => {
    try {
      await fn();
    } catch (error) {
      failed += 1;
      console.log(`  ✗ ${label}: beklenmeyen hata: ${String(error.message || error).split("\n")[0]}`);
      await settle().catch(() => null);
    }
  };
  // VARYANT=BD gibi: yalnız o varyantlar (yerel inceleme için; CI hepsini koşar).
  const only = String(process.env.VARYANT || "ABCDE").toUpperCase();
  const variants = [["B", variantB], ["A", variantA], ["C", variantC], ["D", variantD]].filter(([id]) => only.includes(id));
  for (let round = 1; round <= ROUNDS; round += 1) for (const [id, fn] of variants) await guarded(`${id}${round}`, () => fn(round));
  if (only.includes("E")) for (let round = 1; round <= ROUNDS; round += 1) await guarded(`E${round}`, () => variantE(round));
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  if (noPrecondition) failed += noPrecondition;
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\nön koşulu oluşmayan deneme: ${noPrecondition}; başka oturumun masrafı: ${writes}`);
  console.log(`\n${failed ? "✗" : "✓"} banka-210-daha-fazla-yaris: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
