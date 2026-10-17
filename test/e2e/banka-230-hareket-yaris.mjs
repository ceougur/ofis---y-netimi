// 2.2.0 BİLİNEN SINIR'ın kök neden kanıtı (docs/2.2.0-KANIT.md: ölçek 20 kullanıcı, "Banka → Hareketler penceresi ekrandan kaydedilen masrafı
// 30 sn içinde listede göstermedi") — ders 20: "ara sıra" kırmızı ZORLA üretilir, ön koşulun gerçekten oluştuğu her denemede ölçülür.
//
// Kayıttan okunan gerçek (docs/kanit/2026-10-12/son-aday-220/olcek-sonuc.json düzey 20 E19; olcek-20-tekrar.json E27): görünmeyen iki masrafın
// ikisi de VERİ TABANINDA YOKTU (veritabaninda 0) — liste gecikmesi değil, kayıt hiç yazılmadı. İlk koşuda E19'dan sonraki iki turun "Daha Fazla"
// ve "+ Masraf" tıklamaları 30'ar sn engellendi (aracın üç hatası): masraf formunun üstünde yanıtlanmamış bir soru kalmış, aracın tek Escape'i
// soruyu "Vazgeç"le kapatmış, form "Kaydedilmedi" hatasıyla açık kalmıştı. Ürünün sorusu Benzer İşlem (K8: aynı iş günü, hesap, tür, tutar, masraf
// türü — 20 kullanıcı aynı iki hesaba bugün tarihli rastgele tutarlı masraf yazarken tutar çakışması) ya da Eksi Bakiye'dir (K7). Ölçek aracı
// soruyu Kaydet'ten sonra yalnız 1,2 sn bekliyordu (answerConfirms); yük altında 409 yanıtı daha geç gelince (20 kullanıcıda yazım p95 1,3–1,6 sn,
// yedek sırasında 10 sn'ye kadar) soru kaçıyordu. Ürün hatası değil, ölçek aracının adım hatası; düzeltme tools/olcek-ekran.mjs.
//
// Varyantlar (her tur; ön koşulu oluşmayan deneme KIRMIZI sayılır):
//   A  Benzer İşlem sorusu GEÇ: başka oturum aynı hesaba bugün aynı tutarda EFT masrafı yazar; ekrandan aynı tutar kaydedilir; POST /vouchers yanıtı
//      Playwright route ile GECIKME_MS (1.600) tutulur → ön koşul: soru Kaydet'ten ≥ 1.200 ms sonra belirdi. Beklenen: soru yanıtlanır, kayıt
//      veri tabanına BİR kez yazılır, listede görünür, form kapanır, sonraki "+ Masraf" tıklanabilir (üstte açık pencere kalmaz).
//   B  Eksi Bakiye sorusu GEÇ: doğrulanmış 100 TL'lik hesaptan 150 TL masraf (409 cash-negative + accountId, K7); aynı tutma. Beklenen: aynı.
//   C  Benzer İşlem sorusu ERKEN: tutma yok → ön koşul: soru < 1.200 ms'de belirdi. Beklenen: aynı — eski adımın da yanıtladığı durum
//      (10 kullanıcıda ve çoğu kayıtta bulgunun görünmeme nedeni).
//   Ürün denetimi her varyantta: "Yine de Kaydet" AYNI istek kimliğiyle (x-hof-request) gider, sunucu 409 → 200 döner, kayıt bir kez (çift yok).
//
// Adım seçimi (kırmızı/yeşil): DEPO'da tools/olcek-ekran.mjs varsa YENİ adım (ekranKaydet); yoksa (eski kopya: DEPO=<git archive b24e0c2>) ESKİ
// adım — ölçek aracının b24e0c2 tools/olcek-210.mjs 599–605 (answerConfirms) ve 789–797 satırlarının birebir kopyası. Eski adımla A ve B kırmızı
// (kayıt kaybolur, form açık kalır, "+ Masraf" tıklanamaz), C yeşil. Ürün (sunucu + istemci) iki koşuda da DEPO'dan yüklenir ve aynıdır.
// Çıkış: "N geçti, M kaldı". TUR tur sayısı (varsayılan 2), GECIKME_MS tutma süresi (varsayılan 1600), BEKLEME_MS liste beklemesi (varsayılan 12000;
// ölçekte 30.000 — eski adımda yalnız boşa geçen süreyi kısaltır, sonucu değiştirmez).
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { escClose } from "./esc-kapat.mjs";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Hareket-Yaris-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ROUNDS = Number(process.env.TUR || 2);
const DELAY_MS = Number(process.env.GECIKME_MS || 1600);
const WAIT_MS = Number(process.env.BEKLEME_MS || 12000);
const MODAL = ".hof-modal-backdrop.is-visible";
const WIN = ".hof-bank-modal";
const ROWS = `${WIN} .hof-bank-moves tbody tr[data-event]`;
const FORM = "form.hof-bank-voucher";
const SUBMIT = `${FORM} button[type="submit"]`;

// ---------- Adım: yeni (tools/olcek-ekran.mjs) ya da eski (b24e0c2 olcek-210.mjs birebir) ----------
const stepFile = path.join(ROOT, "tools", "olcek-ekran.mjs");
let step;
let stepName;
if (existsSync(stepFile)) {
  ({ ekranKaydet: step } = await import(pathToFileURL(stepFile).href));
  stepName = "YENİ (tools/olcek-ekran.mjs ekranKaydet)";
} else {
  // b24e0c2 tools/olcek-210.mjs satır 599–605 ve 789–792 AYNEN (yalnız 30 sn → BEKLEME_MS; dönüş biçimi yeni adımla aynı).
  const answerConfirms = async page => {
    for (let i = 0; i < 3; i += 1) {
      const yes = await page.waitForSelector(`${MODAL}:last-of-type [data-answer="yes"]`, { timeout: 1200 }).catch(() => null);
      if (!yes) return;
      await yes.click().catch(() => null);
    }
  };
  step = async (page, { submit, rows, needle, timeoutMs }) => {
    const t = performance.now();
    await page.click(submit);
    await answerConfirms(page);
    const seen = await page.waitForFunction(({ rows, needle }) => [...document.querySelectorAll(rows)].some(row => new RegExp(`${needle}(?![0-9])`).test(row.textContent)), { rows, needle }, { timeout: timeoutMs }).then(() => true).catch(() => false);
    return { listedeMs: seen ? Math.round(performance.now() - t) : -1, onaylar: [], durumlar: [], hata: "" };
  };
  stepName = "ESKİ (b24e0c2 tools/olcek-210.mjs 599–605 + 789–792 birebir)";
}
console.log(`adım: ${stepName}\ndepo: ${ROOT}\ntur: ${ROUNDS} · tutma: ${DELAY_MS} ms · liste beklemesi: ${WAIT_MS} ms`);

// ---------- Sunucu, veri ----------
const root = mkdtempSync(path.join(tmpdir(), "destekofis-hareket-yaris-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f72" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const BANK = "/api/workspace/bank";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE); // "başka oturum" (API'den yazan personel)
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
await must("kurulum geç", api.post(`${BANK}/setup/dismiss`, {}));
const A = await must("hesap A", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
const B = await must("hesap B", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
// K7: açılışı doğrulanmış küçük bakiyeli hesap (Eksi Bakiye sorusu yalnız doğrulanmış hesapta sorulur).
const C = await must("hesap C", api.post(`${BANK}/accounts`, { bankName: "Akbank", name: "Küçük Hesap", kind: "demand", opening: { date: "2026-10-01", amount: "100", confirmed: true } }));
for (let i = 0; i < 60; i += 1) await must(`hazırlık ${i}`, api.post(`${BANK}/vouchers`, { type: "fee", accountId: i % 2 ? A.id : B.id, date: TODAY, amount: `${10 + i},${String(i % 100).padStart(2, "0")}`, feeType: "eft", tax: "bsmv_incl", description: `Hazırlık ${i}`, similarOk: true, requestId: randomUUID() }));
let others = 0;
const amountText = cents => `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
// Açıklama ekranın izini İÇERMEZ (veri tabanı sayımı yalnız ekranın kaydını bulsun).
const writeOther = (accountId, cents) => must("başka oturumun masrafı", api.post(`${BANK}/vouchers`, { type: "fee", accountId, date: TODAY, amount: amountText(cents), feeType: "eft", tax: "bsmv_incl", description: `Diğer personel ${(others += 1)}`, similarOk: true, requestId: randomUUID() }));
const exact = mark => new RegExp(`${mark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![0-9])`);
const inDb = async mark => {
  const found = await must("hareket arama", api.get(`${BANK}/movements?status=all&limit=50&q=${encodeURIComponent(mark)}`));
  return (found.rows || []).filter(row => exact(mark).test(JSON.stringify(row)));
};

// ---------- Tarayıcı ----------
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await installPageClock(page, app.config.now);
// Tutma düzeneği: delay > 0 iken POST /vouchers yanıtı sunucudan alınır, delay ms tutulur, sonra sayfaya bırakılır (soru geç gelir).
let delay = 0;
await page.route(/\/api\/workspace\/bank\/vouchers(\?|$)/, async route => {
  if (route.request().method() !== "POST" || !delay) return route.continue();
  const response = await route.fetch();
  await new Promise(resolve => setTimeout(resolve, delay));
  return route.fulfill({ response });
});
// Bağımsız kayıt: her tur POST /vouchers isteklerinin istek kimliği (x-hof-request) ve yanıt durumu.
const posts = [];
page.on("request", request => {
  if (request.method() === "POST" && request.url().includes(`${BANK}/vouchers`)) posts.push({ id: request.headers()["x-hof-request"] || "", at: performance.now(), status: null });
});
page.on("response", response => {
  if (response.request().method() !== "POST" || !response.url().includes(`${BANK}/vouchers`)) return;
  const item = [...posts].reverse().find(entry => entry.status === null);
  if (item) item.status = response.status();
});

await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector('#hof-sidecard [data-action="bank"]', { timeout: 60000 });
// Sorunun belirme anı (bağımsız ölçüm): bir "Yine de Kaydet" düğmesi belgeye eklendiğinde performance.now().
await page.evaluate(() => {
  window.__soruAt = 0;
  new MutationObserver(list => {
    if (window.__soruAt) return;
    for (const mutation of list) for (const node of mutation.addedNodes) if (node.nodeType === 1 && (node.matches?.('[data-answer="yes"]') || node.querySelector?.('[data-answer="yes"]'))) window.__soruAt = performance.now();
  }).observe(document.body, { childList: true, subtree: true });
});

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
const closeAll = async () => {
  for (let i = 0; i < 8 && (await page.$(MODAL)); i += 1) {
    await escClose(page);
    await pause(250);
  }
};
const openBank = async () => {
  await closeAll();
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 60000 });
  await page.click(`${WIN} .hof-bank-tabs [data-tab="movements"]`);
  await page.waitForSelector(ROWS, { timeout: 60000 });
  await pause(600);
};
// Ölçek aracının formu doldurma adımı (b24e0c2 olcek-210.mjs 781–788 ile aynı sıra).
const openFee = async (accountId, cents, mark) => {
  await page.click(`${WIN} [data-act="v-fee"]`);
  await page.waitForSelector(`${FORM} [name="amount"]`, { timeout: 15000 });
  await page.selectOption(`${FORM} [name="accountId"]`, accountId).catch(() => null);
  await page.selectOption(`${FORM} [name="feeType"]`, "eft").catch(() => null);
  await page.fill(`${FORM} [name="amount"]`, amountText(cents));
  await page.fill(`${FORM} [name="description"]`, mark);
};
// Ölçek aracının kayıttan sonraki adımı (b24e0c2 olcek-210.mjs 795–797 AYNEN): form 5 sn'de kapanmadıysa Escape.
const afterStep = async () => {
  const formOpen = await page.waitForSelector(FORM, { state: "detached", timeout: 5000 }).then(() => false).catch(() => true);
  if (formOpen && (await page.$(FORM))) {
    await escClose(page);
    await pause(300);
  }
};
let round = 0;
async function variant(kind, n) {
  round += 1;
  const mark = `YARIS-${kind}${n}-${round}`;
  const late = kind !== "C";
  const cents = 500 + ((round * 937) % 2500);
  const account = kind === "B" ? C.id : B.id;
  // B: her turda ayrı tutar (aynı tutar önce Benzer İşlem sorusunu açar: 409 similar → 409 negative → 200; yeni adım onu da yanıtlar).
  const amount = kind === "B" ? 15000 + round * 7 : cents;
  const title = kind === "A" ? "Benzer İşlem sorusu GEÇ (yanıt tutulur)" : kind === "B" ? "Eksi Bakiye sorusu GEÇ (yanıt tutulur)" : "Benzer İşlem sorusu ERKEN (tutma yok)";
  console.log(`\n■ ${kind}${n} — ${title}: ${amountText(amount)} ₺, iz ${mark}`);
  if (!(await page.$(`${WIN} [data-bank] .hof-bank-tabs`))) await openBank();
  if (kind !== "B") await writeOther(account, cents);
  delay = late ? DELAY_MS : 0;
  const before = posts.length;
  await openFee(account, amount, mark);
  await page.evaluate(() => {
    window.__tik = performance.now();
    window.__soruAt = 0;
  });
  const result = await step(page, { submit: SUBMIT, rows: ROWS, needle: mark, timeoutMs: WAIT_MS });
  await afterStep();
  delay = 0;
  const soruMs = await page.evaluate(() => (window.__soruAt ? Math.round(window.__soruAt - window.__tik) : -1));
  const formError = await page.$eval(`${FORM} .hof-form-error`, node => node.textContent.trim()).catch(() => "");
  const openTitles = await page.$$eval(`${MODAL} .hof-modal-title`, nodes => nodes.map(node => node.textContent.trim()));
  console.log(`  · soru Kaydet'ten ${soruMs} ms sonra belirdi; adım: listede ${result.listedeMs} ms, yanıtlanan ${JSON.stringify(result.onaylar)}, durumlar ${JSON.stringify(result.durumlar)}, hata “${result.hata}”`);
  console.log(`  · adımdan sonra açık pencereler: ${JSON.stringify(openTitles)}; formdaki hata: “${formError}”`);
  const met = late ? soruMs >= 1200 : soruMs > 0 && soruMs < 1200;
  if (!precondition(met, late ? `soru Kaydet'ten en az 1.200 ms sonra belirdi (${soruMs} ms)` : `soru 1.200 ms içinde belirdi (${soruMs} ms)`)) {
    await openBank();
    return;
  }
  const rows = await inDb(mark);
  ok(rows.length === 1, `${kind}${n}: kayıt veri tabanında bir kez (${rows.length})`);
  ok(result.listedeMs >= 0, `${kind}${n}: kayıt listede göründü (${result.listedeMs} ms)`);
  ok(!(await page.$(FORM)), `${kind}${n}: masraf formu kapandı`);
  // Sonraki turun "+ Masraf" tıklaması (ölçek imzası: üstte açık pencere kalırsa 30 sn engellenir).
  const clickable = await page.click(`${WIN} [data-act="v-fee"]`, { timeout: 3000 }).then(() => true).catch(() => false);
  ok(clickable, `${kind}${n}: sonraki "+ Masraf" tıklanabilir (üstte açık pencere yok)`);
  if (clickable) await page.waitForSelector(`${FORM} [name="amount"]`, { timeout: 15000 }).catch(() => null);
  // Ürün denetimi: soru "Yine de Kaydet" ile aynı istek kimliğiyle yeniden gönderildi, sunucu 409 → 200.
  const mine = posts.slice(before);
  const ids = new Set(mine.map(item => item.id).filter(Boolean));
  ok(mine.length === 2 && ids.size === 1 && mine[0].status === 409 && mine[1].status === 200, `${kind}${n}: ürün — iki gönderim aynı istek kimliğiyle, 409 → 200 (${mine.map(item => item.status).join(", ")}; kimlik ${ids.size})`);
  if (rows.length === 1) ok(rows[0].accountLabel?.includes(kind === "B" ? "Akbank" : "Garanti") && Math.abs(Number(rows[0].signedMinor)) === amount, `${kind}${n}: ürün — kayıt doğru hesapta ve tutarda (${rows[0].accountLabel}, ${rows[0].signedMinor})`);
  await openBank();
}

try {
  await openBank();
  for (let n = 1; n <= ROUNDS; n += 1) {
    await variant("A", n);
    await variant("B", n);
    await variant("C", n);
  }
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  if (noPrecondition) failed += noPrecondition;
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\nön koşulu oluşmayan deneme: ${noPrecondition}; başka oturumun masrafı: ${others}; adım: ${stepName}`);
  console.log(`\n${failed ? "✗" : "✓"} banka-230-hareket-yaris: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
