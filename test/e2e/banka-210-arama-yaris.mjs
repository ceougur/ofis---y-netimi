// CI #864 (24.10.2026) ve CI #1056 (06.11.2026): senaryo-banka-210 adım 15 "İşlem No ile arama" ara sıra kırmızısının ZORLA üretimi (ders 20, 38).
// CI #1056 iletisi: zaman aşımı anında Hareketler süzgecinde arama kutusu (q) BOŞ, liste süzülmemiş. Bu bir test değildir; yarışın ön koşulunu
// betikle kurar ve ürün kuralını denetler: YENİDEN ÇİZİM ODAKTAKİ SÜZGEÇ ALANININ ODAĞINI VE KULLANICININ YAZDIĞI METNİ KAYBETTİRMEZ.
//
// Kök neden: Banka penceresinin arka plan yenilemesi (para kaydı → sunucunun herkese, kaydı yapana da giden "overview.changed" olayı →
// reload({ quiet: true }) → render()) pencerenin TAMAMINI, süzgeç çubuğuyla birlikte yeniden çizer. HOF.keepFocus odaktaki alanı (odak, yazılan
// metin, imleç) ancak alanı yeni çizimde yeniden bulabilirse geri verir; süzgeç alanlarının niteliği (data-mv) anahtar listesinde (FOCUS_KEYS) yoktu,
// arama kutusunda name / id / aria-label da yok → yeniden çizimde odak BODY'ye düşer, kutu süzgecin eski değeriyle (boş) çizilir.
// Senaryodaki imza: Playwright fill iki adımdır (playwright-core lib/server/dom.js _fill): (1) sayfada odak + seçim, (2) ayrı bir CDP çağrısıyla
// Input.insertText — metin O ANDA odakta olan öğeye girer. Yeniden çizim iki adımın arasına düşerse metin hiçbir yere yazılmaz: kutu boş, liste
// süzülmemiş, fill hata vermez. senaryo-banka-210'da adım 14'teki faiz kaydının canlı olayı pencereyi adım 15'in aramasından ~90 ms önce yeniden
// çiziyor (yerel ölçüm: docs/kanit/2026-11-10/b210-tani-zaman-cizgisi.txt); yavaş koşucuda bu çizim fill'in içine kayar.
//
// Ön koşul (her denemede betikle kurulur, oluştuğu sayfada ölçülür; oluşmayan deneme SAYILMAZ, hiç oluşmadıysa sonuç geçersiz):
//   1. başka oturum (API) bir masraf kaydeder → sunucu gerçek canlı olayı yayar → açık pencere arka plan yenilemesini başlatır;
//   2. yenilemenin /bank/movements isteği tarayıcıda TUTULUR (yenileme "yolda");
//   3. kullanıcı süzgeç alanına odaklanır / yazar (kipe göre);
//   4. tutulan istek bırakılır → pencere, odak alandayken ve yazılan metin süzgece girmeden yeniden çizilir (sayfadaki gözlemci
//      "[arama-zorla] ON-KOSUL" yazar).
// Kipler (--kip):
//   odak      CI İMZASI: fill'in iki adımı ayrı koşulur — odak (page.focus), yeniden çizim, metin (keyboard.insertText). Kullanıcı için: kutuya
//             tıkladı, tam yazmaya başlarken pencere yenilendi.
//   fill      İşlem No tek seferde yazılır (Playwright fill); yeniden çizim yazıdan < 300 ms sonra (metin süzgece girmeden).
//   yazarken  insan hızında (tuş başına 40 ms; ders 12): ilk yarı yazılır, yeniden çizim gelir, kalan yarı yazılır.
//   tutar     En Az Tutar alanına "10" yazılır (Enter'a basılmadan yeniden çizim gelir), sonra Enter.
// Beklenen: kutu yazılanı taşır, odak kutuda kalır, liste yazılana göre süzülür (odak / fill / yazarken: yalnız aranan İşlem No; tutar: sunucunun
// min=10 listesi), "Süzgeçleri Temizle" görünür. Eski kodda odak kaybolur, kutu boşalır; "odak" ve "yazarken" kiplerinde liste de süzülmez (CI #1056
// imzası: q boş, bütün satırlar). Not: bu Chromium odaktaki değişmiş alan DOM'dan kalkarken "change" olayı verir; "fill" ve "tutar" kiplerinde eski
// kod bu yüzden listeyi süzer ama kutuyu BOŞ çizer (süzgeç görünmeden uygulanmış kalır) — yine kural dışı.
//
// Çalıştırma:  node --disable-warning=ExperimentalWarning test/e2e/banka-210-arama-yaris.mjs --kip odak --deneme 20
// Eski kod:    DEPO=<eski kopya> ile sunucu ve istemci o kopyadan yüklenir (betik yeni ağaçtan koşar; ders 23, 51).
// Özet satırı "N denetim geçti, M başarısız" (tools/kanit.mjs okur). Başarısız deneme ya da hiç sayılan deneme yoksa çıkış 1.
import { randomUUID } from "node:crypto";
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const { values: opts } = parseArgs({ options: { kip: { type: "string", default: "odak" }, deneme: { type: "string", default: "20" }, bekle: { type: "string", default: "4000" } } });
const MODE = opts.kip;
if (!["odak", "fill", "yazarken", "tutar"].includes(MODE)) throw new Error(`bilinmeyen kip: ${MODE} (odak | fill | yazarken | tutar)`);
const TRIALS = Number(opts.deneme);
const WAIT = Number(opts.bekle);
const PASS = "AramaYaris-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank";
const bankWin = ".hof-bank-modal";
const Q = `${bankWin} [data-mv="q"]`;
const MIN = `${bankWin} [data-mv="min"]`;
const FIELD = MODE === "tutar" ? "min" : "q";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

let passed = 0;
let failed = 0;
let counted = 0;
let skipped = 0;
const errors = [];
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-arama-yaris-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f43" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE); // "başka oturum"
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return unwrap(res);
};
const browser = await chromium.launch();
try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
  const ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
  const garanti = await must("Garanti", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Ticari Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
  let writes = 0;
  // Başka oturumun masrafları 1–7 TL: "tutar" kipinin süzgeci (en az 10) onları listede göstermez; hazırlık satırları 10 TL'nin iki yanında.
  const fee = (account, amount, description) => must("masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: account.id, date: "2026-10-07", amount, feeType: "eft", tax: "bsmv_incl", description, similarOk: true, requestId: randomUUID() }));
  for (const [account, amount] of [[ziraat, "10,50"], [garanti, "25"], [ziraat, "7,25"]]) await fee(account, amount, "Hazırlık");
  const writeOther = () => fee(writes % 2 ? garanti : ziraat, `${1 + (writes % 7)}`, `Başka oturum ${(writes += 1)}`);
  const serverRows = async (query = "") => (await must("hareketler", api.get(`${BANK}/movements?limit=50${query}`))).rows;
  const first = await serverRows();
  const numbers = first.filter(row => row.type === "fee").map(row => row.no).filter(Boolean);
  if (first.length < 4 || numbers.length < 2) throw new Error(`hazırlık: beklenen hareketler yok (${first.length} satır, ${numbers.length} masraf no)`);
  if (first.length + TRIALS > 50) throw new Error(`deneme sayısı ilk sayfayı (50 satır) aşar: ${first.length} + ${TRIALS}`);
  console.log(`kip ${MODE}; kod ${process.env.DEPO ? `DEPO=${ROOT}` : "bu ağaç"}; tarayıcı ${browser.version()}; hazırlık: ${first.length} hareket; aranacak İşlem No'lar ${numbers.join(", ")}`);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
    // Gerçek saat: init betiği sayfa saatinden (page.clock) önce çalışır.
    const realNow = performance.now.bind(performance);
    // Süzgeç alanına odak ve son yazım anı.
    document.addEventListener(
      "focusin",
      event => {
        const state = window.__aramaZorla;
        if (state && event.target === state.node) state.focused = true;
      },
      true,
    );
    document.addEventListener(
      "input",
      event => {
        const state = window.__aramaZorla;
        if (state && event.target?.matches?.(`[data-mv="${state.field}"]`)) state.inputAt = realNow();
      },
      true,
    );
    // Süzgeç çubuğu yeniden çizildi mi (alan yeni düğüm)? ON-KOSUL: odak alandayken ve yazılan metin süzgece ürünün kendi yolundan girmeden önce —
    // odak kipi: odaktan sonra, hiç yazılmadan; arama: son tuştan sonra 300 ms dolmadan (onInput zamanlayıcısı); tutar: Enter'dan önce (betik
    // Enter'a yeniden çizimi gördükten sonra basar).
    new MutationObserver(() => {
      const state = window.__aramaZorla;
      if (!state || state.seen) return;
      const box = document.querySelector(`.hof-bank-modal [data-mv="${state.field}"]`);
      if (!box || box === state.node) return;
      state.seen = true;
      state.gap = state.inputAt === null ? null : Math.round(realNow() - state.inputAt);
      state.precondition = state.focused && (state.mode === "odak" ? state.gap === null : state.gap !== null && (state.field !== "q" || state.gap < 300));
      state.typedBefore = state.node.value;
      console.log(`[arama-zorla] ${state.precondition ? "ON-KOSUL" : "on-kosul-yok"}: süzgeç çubuğu ${state.focused ? "odak alandayken" : "odak alanda değilken"}, ${state.gap === null ? "yazıdan önce" : `son tuştan ${state.gap} ms sonra`} yeniden çizildi; eski kutuda "${state.node.value}", yeni kutuda "${box.value}", odak ${document.activeElement === box ? "kutuda" : document.activeElement?.tagName || "yok"}`);
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.text().startsWith("[arama-zorla]")) console.log(`    ${message.text()}`);
  });
  await installPageClock(page, app.config.now);
  // ARAMA_TANI=1: hareket isteklerinin ve süzgeç olaylarının zamanı (tanı satırı; denetim değil).
  if (process.env.ARAMA_TANI === "1") {
    const t0 = Date.now();
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/bank/movements")) console.log(`    · ${String(Date.now() - t0).padStart(6)} ms istek /movements?${[...url.searchParams].filter(([key]) => !key.startsWith("hof")).map(pair => pair.join("=")).join("&")}`);
    });
    page.on("console", message => {
      if (message.text().startsWith("[arama-tani]")) console.log(`    · ${String(Date.now() - t0).padStart(6)} ms ${message.text()}`);
    });
    await page.addInitScript(() => {
      for (const type of ["input", "change", "focusin", "focusout"]) document.addEventListener(type, event => event.target?.matches?.("[data-mv]") && console.log(`[arama-tani] ${type} ${event.target.dataset.mv}="${event.target.value}"`), true);
      let last = null;
      new MutationObserver(() => {
        const box = document.querySelector('.hof-bank-modal [data-mv="q"]');
        if (box === last) return;
        if (last && box) console.log(`[arama-tani] süzgeç çubuğu yeniden çizildi (q "${last.value}" → "${box.value}")`);
        last = box;
      }).observe(document, { childList: true, subtree: true });
    });
  }
  let armed = false;
  let held = null;
  let heldSeen = null;
  // Arka plan yenilemesinin hareket isteği (yazılan metni taşımayan ilk /movements isteği) tutulur.
  await page.route("**/api/workspace/bank/movements*", route => {
    if (armed && !/[?&](q|min)=/.test(route.request().url())) {
      armed = false;
      held = route;
      heldSeen?.();
      return null;
    }
    return route.continue().catch(() => null);
  });
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForTimeout(700);
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 30000 });
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="movements"]`);
  const rowCount = count => page.waitForFunction(n => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length === n, count, { timeout: 15000 });
  await rowCount(first.length);

  for (let no = 1; no <= TRIALS; no += 1) {
    const target = MODE === "tutar" ? "10" : numbers[no % numbers.length];
    try {
      // Başlangıç: süzgeç boş, liste süzülmemiş (önceki denemenin süzgeci temizlenir; ekrandaki değer süzgeçle aynıysa yeniden yüklenmez).
      await page.fill(Q, "");
      await page.fill(MIN, "");
      await page.press(MIN, "Enter");
      await rowCount((await serverRows()).length);
      // Odak süzgeç alanından çıkar (fill'in ilk adımı gibi, odak başka yerdeyken başlar).
      await page.focus(`${bankWin} .hof-bank-tabs [data-tab="movements"]`);
      const holding = new Promise(resolve => {
        heldSeen = resolve;
      });
      armed = true;
      await writeOther();
      await Promise.race([holding, new Promise((_, reject) => setTimeout(() => reject(new Error("arka plan yenilemesinin hareket isteği 15 sn içinde gelmedi")), 15000))]);
      await page.evaluate(
        ([field, mode]) => {
          window.__aramaZorla = { field, mode, focused: false, inputAt: null, gap: null, seen: false, precondition: false, typedBefore: null, node: document.querySelector(`.hof-bank-modal [data-mv="${field}"]`) };
        },
        [FIELD, MODE],
      );
      const route = held;
      held = null;
      const redrawn = () => page.waitForFunction(() => window.__aramaZorla?.seen, null, { timeout: 5000 }).catch(() => null);
      if (MODE === "odak") {
        // Playwright fill'in iki adımı (dom.js _fill): sayfada odak + seçim → (yeniden çizim) → Input.insertText.
        await page.focus(Q);
        await route.continue().catch(() => null);
        await redrawn();
        await page.keyboard.insertText(target);
      } else if (MODE === "fill") {
        await page.fill(Q, target);
        await route.continue().catch(() => null);
      } else if (MODE === "yazarken") {
        const half = Math.ceil(target.length / 2);
        await page.click(Q);
        await page.keyboard.type(target.slice(0, half), { delay: 40 });
        await route.continue().catch(() => null);
        await redrawn();
        await page.keyboard.type(target.slice(half), { delay: 40 });
      } else {
        await page.click(MIN);
        await page.keyboard.type(target, { delay: 40 });
        await route.continue().catch(() => null);
        await redrawn();
        await page.keyboard.press("Enter");
      }
      // Sonuç: kutu yazılanı taşıyor ve liste yazılana göre süzülmüş (ya da süre doldu).
      const wanted = MODE === "tutar" ? (await serverRows("&min=10")).map(row => row.no) : [target];
      const done = await page
        .waitForFunction(
          ([field, text, list]) => {
            const rows = [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")].map(node => node.dataset.no);
            return JSON.stringify(rows) === JSON.stringify(list) && document.querySelector(`.hof-bank-modal [data-mv="${field}"]`)?.value === text;
          },
          [FIELD, target, wanted],
          { timeout: WAIT },
        )
        .then(() => true)
        .catch(() => false);
      const state = await page.evaluate(field => {
        const box = document.querySelector(`.hof-bank-modal [data-mv="${field}"]`);
        const out = { ...window.__aramaZorla, node: undefined, value: box?.value ?? null, focus: document.activeElement === box, clear: Boolean(document.querySelector('.hof-bank-modal [data-act="mv-clear"]')), active: document.activeElement?.dataset?.mv || document.activeElement?.tagName || "", rows: [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")].map(node => node.dataset.no) };
        window.__aramaZorla = null;
        return out;
      }, FIELD);
      if (!state.precondition) {
        skipped += 1;
        console.log(`· deneme ${no}: ön koşul OLUŞMADI (${state.seen ? `yeniden çizim ${state.focused ? "" : "odak alanda değilken, "}${state.gap === null ? "yazıdan önce" : `son tuştan ${state.gap} ms sonra`}` : "yeniden çizim görülmedi"}) — sayılmadı`);
        continue;
      }
      counted += 1;
      const good = done && state.focus && state.clear;
      if (good) passed += 1;
      else failed += 1;
      console.log(`${good ? "✓" : "✗"} deneme ${no} (ön koşul: odak alandayken, ${state.gap === null ? "yazıdan önce" : `son tuştan ${state.gap} ms sonra`} yeniden çizim; o an kutuda "${state.typedBefore}"): yazılan "${target}"; kutu "${state.value}", odak ${state.focus ? "kutuda" : `kayboldu (${state.active})`}, liste ${state.rows.length} satır [${state.rows.slice(0, 3).join(", ")}${state.rows.length > 3 ? ", …" : ""}], beklenen ${wanted.length} satır, Süzgeçleri Temizle ${state.clear ? "var" : "YOK"}${good ? "" : !done ? " — yazılan metin kayboldu / liste süzülmedi" : !state.focus ? " — süzüldü ama odak kayboldu" : " — süzüldü ama Süzgeçleri Temizle düğmesi yok"}`);
    } catch (error) {
      failed += 1;
      console.log(`✗ deneme ${no}: beklenmeyen hata ${error.message.split("\n")[0]}`);
      if (held) await held.continue().catch(() => null);
      held = null;
      armed = false;
    }
  }
  await context.close().catch(() => null);
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
}
if (errors.length) {
  failed += 1;
  console.log(`✗ tarayıcı hataları: ${errors.join(" | ").slice(0, 400)}`);
}
if (!counted) {
  failed += 1;
  console.log("✗ ön koşul hiçbir denemede oluşmadı — sonuç geçersiz (ders 20)");
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız. (kip ${MODE}; ön koşul ${counted}/${TRIALS} denemede oluştu; ${skipped} sayılmadı)`);
process.exitCode = failed ? 1 : 0;
