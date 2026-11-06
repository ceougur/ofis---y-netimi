// CI #864 (24.10.2026) ve CI #1056 (06.11.2026) senaryo-banka-210 adım 15 "İşlem No ile arama" kırmızısının ZORLA üretimi ve düzeltmenin kanıtı
// (ders 20, 38). CI #1056 iletisi: zaman aşımı anında süzgeç çubuğunda arama kutusu (q) BOŞ, liste süzülmemiş.
// Ön koşul: Hareketler sekmesinde arama kutusuna yazılır; yazının süzgece uygulanmasından (300 ms bekleme) ÖNCE pencerenin arka plan yenilemesi
// (canlı yenileme: başka bilgisayardaki / aynı işlemin geciken banka olayı → reload({ quiet: true }) → render()) süzgeç çubuğunu yeniden çizer.
// Betik bu sırayı zorla kurar: (1) canlı olay yayılır (HOF.emit live:workspace.changed kind bank), (2) yenilemenin /bank/movements isteği
// tarayıcıda tutulur, (3) arama kutusuna İşlem No yazılır (Playwright fill), (4) tutulan istek hemen bırakılır → yenileme yazıdan sonraki
// ~300 ms içinde çizer. Sayfadaki gözlemci süzgeç çubuğunun yeniden çizildiği anda arama isteği (q=…) henüz gitmemişse "[arama-zorla] ON-KOSUL"
// yazar; deneme YALNIZ bu satır görüldüyse sayılır (ön koşul oluşmayan deneme "sayılmadı" diye yazılır).
// Beklenen (ürün kuralı: kullanıcının yazdığı arama metni hiçbir yeniden çizimde kaybolmaz): 5 sn içinde liste yalnız aranan İşlem No, kutu
// yazılanı taşır ve odak kutuda kalır. Eski kodda (7a2b6efd) kutu boşalır, liste süzülmez (CI #1056 imzası).
// Özet satırı "N denetim geçti, M başarısız" (tools/kanit.mjs okur); başarısız ya da hiç sayılan deneme yoksa çıkış 1.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/banka-210-arama-yaris.mjs --deneme 20
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const { values: opts } = parseArgs({ options: { kip: { type: "string", default: "fill" }, deneme: { type: "string", default: "20" }, bekle: { type: "string", default: "5000" } } });
// Kipler: fill — İşlem No tek seferde yazılır (Playwright fill; senaryo-banka-210 adım 15 gibi), yenileme yazıdan hemen sonra çizer;
//         yazarken — insan hızında (tuş başına 40 ms) yazılırken yenileme çizer: ilk yarı yazılır, yenileme bırakılır, yeniden çizim beklenir,
//         kalan yarı yazılır (CI #1056 imzası: kutu boş, liste süzülmemiş).
const MODE = opts.kip;
if (!["fill", "yazarken"].includes(MODE)) throw new Error(`bilinmeyen kip: ${MODE}`);
const TRIALS = Number(opts.deneme);
const WAIT = Number(opts.bekle);
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const bankWin = ".hof-bank-modal";
const Q = `${bankWin} [data-mv="q"]`;
const ROWS = `${bankWin} .hof-bank-moves tbody tr[data-event]`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

let passed = 0;
let failed = 0;
let counted = 0;
let skipped = 0;
const errors = [];
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-arama-yaris-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f40" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return unwrap(res);
};
const browser = await chromium.launch();
try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  const ziraat = await must("Ziraat", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
  const garanti = await must("Garanti", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ticari Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
  for (const [account, amount] of [[ziraat, "10,50"], [garanti, "25"], [ziraat, "7,25"]]) await must("masraf", api.post("/api/workspace/bank/vouchers", { type: "fee", accountId: account.id, date: "2026-10-07", amount, feeType: "eft", tax: "bsmv_incl" }));
  const all = (await must("hareketler", api.get("/api/workspace/bank/movements?limit=50"))).rows;
  const numbers = all.filter(row => row.type === "fee").map(row => row.no).filter(Boolean);
  if (all.length < 4 || numbers.length < 2) throw new Error(`hazırlık: beklenen hareketler yok (${all.length} satır, ${numbers.length} masraf no)`);
  console.log(`kip ${MODE}; hazırlık: ${all.length} hareket; aranacak İşlem No'lar ${numbers.join(", ")}`);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
    // Gerçek saat: init betiği sayfa saatinden (page.clock) önce çalışır.
    const realNow = performance.now.bind(performance);
    // Arama kutusuna son yazım anı (kullanıcının yazdığı metin; süzgece ürünün 300 ms'lik zamanlayıcısıyla girer).
    document.addEventListener(
      "input",
      event => {
        const state = window.__aramaZorla;
        if (state?.typed && event.target?.matches?.('[data-mv="q"]')) state.inputAt = realNow();
      },
      true,
    );
    // Süzgeç çubuğu yeniden çizildi mi (arama kutusu yeni düğüm). ON-KOSUL: yazım sürerken (yazı henüz kutuya girmeden) ya da yazıdan sonra
    // süzgeç zamanlayıcısı (300 ms) dolmadan — yani yazılan metin süzgece ürünün kendi yolundan uygulanmadan önce.
    new MutationObserver(() => {
      const state = window.__aramaZorla;
      if (!state?.typed || state.seen) return;
      const box = document.querySelector('.hof-bank-modal [data-mv="q"]');
      if (!box || box === state.node) return;
      state.seen = true;
      state.gap = state.inputAt === null ? null : Math.round(realNow() - state.inputAt);
      state.precondition = state.gap === null || state.gap < 300;
      console.log(`[arama-zorla] ${state.precondition ? "ON-KOSUL" : "on-kosul-yok"}: süzgeç çubuğu ${state.gap === null ? "yazım sürerken (yazı kutuya girmeden)" : `yazıdan ${state.gap} ms sonra`} yeniden çizildi; yeni kutuda "${box.value}", odak ${document.activeElement === box ? "kutuda" : document.activeElement?.tagName || "yok"}`);
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.text().startsWith("[arama-zorla]")) console.log(`    ${message.text()}`);
  });
  await installPageClock(page, app.config.now);
  // ARAMA_TANI=1: banka isteklerinin ve yanıtlarının zamanı (tanı satırı; denetim değil).
  const t0 = Date.now();
  if (process.env.ARAMA_TANI === "1") {
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/workspace/bank/")) console.log(`    · ${String(Date.now() - t0).padStart(6)} ms istek ${url.pathname.replace("/api/workspace/bank", "")}${url.search}`);
    });
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/workspace/bank/")) console.log(`    · ${String(Date.now() - t0).padStart(6)} ms yanıt ${url.pathname.replace("/api/workspace/bank", "")}${url.search} ${response.status()}`);
    });
  }
  let armed = false;
  let held = null;
  let heldSeen = null;
  await page.route("**/api/workspace/bank/movements*", route => {
    if (armed && !/[?&]q=/.test(route.request().url())) {
      armed = false;
      held = route;
      heldSeen?.();
      return;
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
  await page.waitForFunction(count => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length === count, all.length, { timeout: 15000 });

  for (let no = 1; no <= TRIALS; no += 1) {
    const target = numbers[no % numbers.length];
    try {
      // Başlangıç: kutu boş, liste süzülmemiş; yenileyicinin en kısa aralığı (1,5 sn) dolsun.
      // Önceki denemede kutu boşalıp liste süzülü kaldıysa (eski kod) "" yazmak değişiklik sayılmaz: önce başka bir değer.
      await page.fill(Q, "x");
      await page.press(Q, "Enter");
      await page.fill(Q, "");
      await page.press(Q, "Enter");
      await page.waitForFunction(count => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length === count, all.length, { timeout: 10000 });
      await page.waitForTimeout(1700);
      const holding = new Promise(resolve => {
        heldSeen = resolve;
      });
      armed = true;
      await page.evaluate(() => window.HOF.emit("live:workspace.changed", { kind: "bank" }));
      await Promise.race([holding, new Promise((_, reject) => setTimeout(() => reject(new Error("arka plan yenilemesinin hareket isteği 10 sn içinde gelmedi")), 10000))]);
      await page.evaluate(() => {
        window.__aramaZorla = { typed: true, inputAt: null, gap: null, seen: false, precondition: false, node: document.querySelector('.hof-bank-modal [data-mv="q"]') };
      });
      const route = held;
      held = null;
      if (MODE === "fill") {
        await page.fill(Q, target);
        await route.continue().catch(() => null);
      } else {
        const half = Math.ceil(target.length / 2);
        await page.focus(Q);
        await page.keyboard.type(target.slice(0, half), { delay: 40 });
        await route.continue().catch(() => null);
        await page.waitForFunction(() => window.__aramaZorla?.seen, null, { timeout: 5000 }).catch(() => null);
        await page.keyboard.type(target.slice(half), { delay: 40 });
      }
      // Sonuç: liste yalnız aranan İşlem No ve kutu yazılanı taşıyor (ya da süre doldu).
      const done = await page
        .waitForFunction(no => {
          const list = [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")];
          return list.length === 1 && list[0].dataset.no === no && document.querySelector('.hof-bank-modal [data-mv="q"]')?.value === no;
        }, target, { timeout: WAIT })
        .then(() => true)
        .catch(() => false);
      const state = await page.evaluate(() => {
        const box = document.querySelector('.hof-bank-modal [data-mv="q"]');
        return { ...window.__aramaZorla, node: undefined, q: box?.value ?? null, focus: document.activeElement === box, rows: [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")].map(node => node.dataset.no) };
      });
      await page.evaluate(() => {
        window.__aramaZorla = null;
      });
      if (!state.precondition) {
        skipped += 1;
        console.log(`· deneme ${no}: ön koşul OLUŞMADI (${state.seen ? `yeniden çizim yazıdan ${state.gap} ms sonra` : "yeniden çizim görülmedi"}) — sayılmadı`);
        continue;
      }
      counted += 1;
      const good = done && state.focus;
      if (good) passed += 1;
      else failed += 1;
      console.log(`${good ? "✓" : "✗"} deneme ${no} (ön koşul oluştu, ${state.gap === null ? "yazım sürerken" : `yazıdan ${state.gap} ms sonra`}): aranan ${target}; kutu "${state.q}", odak ${state.focus ? "kutuda" : "kayboldu"}, liste ${state.rows.length} satır [${state.rows.slice(0, 3).join(", ")}${state.rows.length > 3 ? ", …" : ""}]${good ? "" : done ? " — süzüldü ama odak kayboldu" : " — arama metni kayboldu / liste süzülmedi"}`);
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
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız. (ön koşul ${counted}/${TRIALS} denemede oluştu; ${skipped} sayılmadı)`);
process.exitCode = failed ? 1 : 0;
