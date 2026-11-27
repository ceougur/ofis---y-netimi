// 2.5.0 birleşik tur 6 — süzgeç / parametre çubuğunda yarım yazılmış tarihin arka plan yenilemesinde bozulmasının ZORLA üretimi (ders 12, 20, 38, 39).
// Dar kontrol DK-D2T3 DÜŞÜK-4 (Banka → Hareketler, Başlangıç: yarım tarih yeniden çizimde "0026-10-20" / boş; KAYIT 11.11 02:21) ve banka-210 incelemesinin ek bulgusu
// (KAYIT 10.11 13:19: data-pos-filter, data-param, data-inbox-from / -to odak anahtarlarında yok). Bu bir test değildir; yarışın ön koşulunu betikle kurar ve ürün
// kuralını denetler: ARKA PLAN YENİLEMESİ KULLANICININ ÇALIŞTIĞI ÇUBUKTAKİ ODAĞI VE YAZILANI (yarım tarih dahil) KAYBETTİRMEZ.
//
// Kök neden (iki katman): (1) yeniden çizim çubuğu yeni düğümlerle kurar; HOF.keepFocus odağı ve değeri ancak alanı yeni çizimde bulabilirse geri verir — POS, Rapor
// Merkezi ve Gelen e-Faturalar alanlarının niteliği anahtar listesinde (FOCUS_KEYS) yoktu (Rapor Merkezi keepFocus'u hiç kullanmıyordu: main.innerHTML); (2) bulsa da
// yarım tarihi geri veremez: tarih kutusunun yazılmış bölümleri değerde görünmez (value ""), imleç yeni kutunun İLK bölümüne düşer → kullanıcının sonraki tuşları yanlış
// bölüme gider. Düzeltme: arka plan yenilemesi çalışılan çubuğu yeniden KURMAZ (HOF.swapKeeping; client/assets/hof-core.js).
// Ön koşul (her denemede betikle kurulur, oluştuğu sayfada ölçülür; oluşmayan deneme SAYILMAZ, hiç oluşmadıysa sonuç geçersiz):
//   1. başka oturum (API) bir kayıt yapar → sunucunun gerçek canlı olayı → açık ekran arka plan yenilemesini başlatır;
//   2. yenilemenin liste isteği tarayıcıda TUTULUR;
//   3. kullanıcı tarih kutusuna tıklar, GÜNÜ yazar ("07") — tarih yarım;
//   4. tutulan istek bırakılır → ekran, odak kutudayken ve tarih yarımken yeniden çizilir (sayfadaki gözlemci: çubuğun DIŞINDAKİ bir düğüm yenilendi);
//   5. kullanıcı ay ve yılı yazar ("102026"), Enter.
// Beklenen: kutu 2026-10-07, odak kutuda; Banka / POS'ta süzgeç uygulanır (from=2026-10-07 isteği). Eski kodda odak kaybolur ya da tarih bozulur.
// Kipler (--kip): banka-tarih (Banka → Hareketler, Başlangıç), pos-tarih (Banka → POS, Başlangıç), rapor-tarih (Raporlar → Kasa Hareketleri, Başlangıç),
//   gelen-tarih (Faturalar → Gelen e-Faturalar, Başlangıç). --kontrol: yeniden çizim yazmaya başlamadan biter (yarış yok) — aynı tuşlar doğru tarihi üretmeli.
// Birleşik tur 7 (DK-B6 DÜŞÜK-4 + kullanıcı notu 12.11 12:54 "bu fatura süzgecinde de olabilir"; liste istemci taramasıyla — her süzgeç tarih kutusu): cek-tarih
//   (Çek / Senet listesi, Vade Başı), fatura-tarih (Fatura listesi, Başlangıç), kasa-tarih (Kasa → Tarih Aralığı, Başlangıç), rapor-mizan / rapor-vade / rapor-akis /
//   rapor-cek (Raporlar → Cari Mizanı ve Ekstresi / Vade Takip / Nakit Akış / Çek / Senet, Başlangıç). Çek / Senet ve Fatura listesinde YARIŞ OLMADAN da (kontrol
//   kipi) bozuluyordu: yazarken her geçerli ara değerde (yıl 0002, 0020 …) liste yeniden yükleniyor, çubuk yeniden kuruluyordu ("0002-06-07" / boş).
// --kip yazim (npm run test:suzgec-tarih-yazim): bütün kipler hem yarışla hem kontrol kipinde, ayrı süreçlerde; tek özet satırı.
// Çalıştırma:  node --disable-warning=ExperimentalWarning test/e2e/suzgec-cubugu-yaris.mjs --kip banka-tarih --deneme 10
// Eski kod:    DEPO=<eski kopya> ile sunucu ve istemci o kopyadan yüklenir (betik yeni ağaçtan koşar; ders 23, 51).
// Özet satırı "N denetim geçti, M başarısız" (tools/kanit.mjs okur). Başarısız deneme ya da hiç sayılan deneme yoksa çıkış 1.
import { randomUUID } from "node:crypto";
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const { values: opts } = parseArgs({ options: { kip: { type: "string", default: "banka-tarih" }, deneme: { type: "string", default: "10" }, bekle: { type: "string", default: "4000" }, kontrol: { type: "boolean", default: false } } });
const MODE = opts.kip;
const CONTROL = opts.kontrol;
// --kip hepsi (CI ve npm run test:suzgec-cubugu-yaris): dört kip ayrı süreçlerde sırayla (her biri kendi sunucusu ve tarayıcısı); tek özet satırı.
const KIP_ADLARI = ["banka-tarih", "pos-tarih", "rapor-tarih", "gelen-tarih", "cek-tarih", "fatura-tarih", "kasa-tarih", "rapor-mizan", "rapor-vade", "rapor-akis", "rapor-cek"];
if (MODE === "hepsi" || MODE === "yazim") {
  const { spawnSync } = await import("node:child_process");
  let ok = 0;
  let bad = 0;
  // Kasa penceresinde arka plan yenilemesi yok → yalnız kontrol (yazım) kipi.
  const runs = MODE === "hepsi" ? ["banka-tarih", "pos-tarih", "rapor-tarih", "gelen-tarih"].map(kip => [kip, CONTROL]) : KIP_ADLARI.flatMap(kip => (kip === "kasa-tarih" ? [[kip, true]] : [[kip, false], [kip, true]]));
  for (const [kip, control] of runs) {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", fileURLToPath(import.meta.url), "--kip", kip, "--deneme", opts.deneme, "--bekle", opts.bekle, ...(control ? ["--kontrol"] : [])], { encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(run.stdout || "");
    process.stderr.write(run.stderr || "");
    const summary = /(\d+) denetim geçti, (\d+) başarısız/.exec(run.stdout || "");
    if (run.status === 0 && summary) ok += Number(summary[1]);
    else bad += summary ? Math.max(1, Number(summary[2])) : 1;
  }
  console.log(`\n${bad ? "BAŞARISIZ" : "TAMAM"}: ${ok} denetim geçti, ${bad} başarısız. (${MODE === "hepsi" ? "dört kip: banka-tarih, pos-tarih, rapor-tarih, gelen-tarih" : `${KIP_ADLARI.length} kip × yarış ve kontrol`})`);
  process.exit(bad ? 1 : 0);
}
const TRIALS = Number(opts.deneme);
const WAIT = Number(opts.bekle);
const PASS = "SuzgecYaris-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TARGET = "2026-10-07";
const BANK = "/api/workspace/bank";
const bankWin = ".hof-bank-modal";
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`; // ders 39
const KIPLER = {
  "banka-tarih": { field: `${bankWin} [data-mv="from"]`, sentinel: `${bankWin} .hof-bank-tabs`, hold: /\/api\/workspace\/bank\/movements\?/, applied: /\/bank\/movements\?.*from=2026-10-07/ },
  "pos-tarih": { field: `${bankWin} [data-pos-filter="from"]`, sentinel: `${bankWin} .hof-bank-tabs`, hold: /\/api\/workspace\/bank\/pos\/sales\?/, applied: /\/bank\/pos\/sales\?.*from=2026-10-07/ },
  "rapor-tarih": { field: `${TOP} [data-rc-main] [data-param="from"]`, sentinel: `${TOP} [data-rc-main] [data-rc-result]`, hold: /\/api\/workspace\/report-center\/kasa-hareketleri\?/, applied: null },
  "gelen-tarih": { field: `${TOP} [data-inbox-from]`, sentinel: `${TOP} .hof-inv-tabs`, hold: /\/api\/workspace\/invoices\/inbox(\?|$)/, applied: null },
  // Birleşik tur 7: liste süzgeçleri — tarih yazılınca liste kendiliğinden süzülür (applied); rapor sekmeleri "Raporu Getir" ile (yalnız kutu).
  "cek-tarih": { field: `${TOP} [data-filter="from"]`, sentinel: `${TOP} .hof-plan-head`, hold: /\/api\/workspace\/cheques\?/, applied: /\/api\/workspace\/cheques\?.*from=2026-10-07/ },
  "fatura-tarih": { field: `${TOP} .hof-inv-filters [data-filter="from"]`, sentinel: `${TOP} .hof-inv-tabs`, hold: /\/api\/workspace\/invoices\?/, applied: /\/api\/workspace\/invoices\?.*from=2026-10-07/ },
  "kasa-tarih": { field: `${TOP} [data-from]`, sentinel: `${TOP} [data-list] > *`, hold: /\/api\/workspace\/cash\?from=/, applied: /\/api\/workspace\/cash\?from=2026-10-07/, background: false },
  "rapor-mizan": { field: `${TOP} [data-range="from"]`, sentinel: `${TOP} .hof-rep-top`, hold: /\/api\/workspace\/overview\/mizan\?/, applied: null, tab: "mizan" },
  "rapor-vade": { field: `${TOP} [data-range="from"]`, sentinel: `${TOP} .hof-rep-top`, hold: /\/api\/workspace\/overview\/vade-takip\?/, applied: null, tab: "vade" },
  "rapor-akis": { field: `${TOP} [data-range="from"]`, sentinel: `${TOP} .hof-rep-top`, hold: /\/api\/workspace\/overview\/nakit-akisi\?/, applied: null, tab: "flow" },
  "rapor-cek": { field: `${TOP} [data-range="from"]`, sentinel: `${TOP} .hof-rep-top`, hold: /\/api\/workspace\/cheques\?/, applied: null, tab: "cheques" },
};
const K = KIPLER[MODE];
if (!K) throw new Error(`bilinmeyen kip: ${MODE} (${Object.keys(KIPLER).join(" | ")})`);
if (K.background === false && !CONTROL) throw new Error(`${MODE}: bu ekranda arka plan yenilemesi yok — yalnız --kontrol (yazım) kipi`);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

let passed = 0;
let failed = 0;
let counted = 0;
let skipped = 0;
const errors = [];
const root = mkdtempSync(path.join(tmpdir(), "destekofis-suzgec-cubugu-yaris-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, edocEnabled: true, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f44" } });
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
  if (MODE === "pos-tarih") await must("POS Kullan", api.put(`${BANK}/accounts/${ziraat.id}`, { usePos: true }));
  if (MODE === "pos-tarih") await must("POS", api.post(`${BANK}/pos`, { name: "Ziraat Fiziki POS", bankAccountId: ziraat.id, rates: [{ installments: 1, rate: "2,5" }] }));
  await must("Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: "2026-10-05", description: "Hazırlık", method: "cash" }));
  let inboxId = "";
  if (MODE === "gelen-tarih") {
    // Ön koşul kurulumu (ürün yolu değil): gelen kutusunda bir belge — entegratörden çekilmiş gibi (einvoice_inbox; para tablosu değil). Sonraki her adım ürün yolundan.
    inboxId = `inbox-yaris-${randomUUID()}`;
    app.store.run("INSERT INTO einvoice_inbox (id, uuid, number, sender_vkn, sender_name, issue_date, payable, profile, type_code, state, fetched_at) VALUES (?, ?, 'GEL2026000000001', '1234567890', 'Toptan Kırtasiye', '2026-10-06', 360, 'TEMELFATURA', 'SATIS', 'new', ?)", inboxId, randomUUID(), new Date().toISOString());
  }
  // Gelen kutusu olayı işlemi yapana gitmez (publish … except): tetikleyen BAŞKA kullanıcı.
  const other = MODE === "gelen-tarih" ? createClient(BASE) : api;
  if (MODE === "gelen-tarih") {
    await must("ikinci kullanıcı", api.post("/api/admin/users", { username: "gelen2", name: "Gelen Kutusu Personeli", role: "muhasebe", password: PASS, mustChangePassword: false }));
    await other.login("gelen2", PASS);
  }
  let writes = 0;
  const trigger = () => {
    writes += 1;
    if (MODE === "gelen-tarih") return must("gelen kutusu durumu", other.post(`/api/workspace/invoices/inbox/${encodeURIComponent(inboxId)}/state`, { state: writes % 2 ? "ignored" : "new" }));
    if (MODE === "rapor-tarih" || MODE === "kasa-tarih" || (K.tab && K.tab !== "cheques")) return must("Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: String(writes), date: "2026-10-06", description: `Başka oturum ${writes}`, method: "cash" }));
    if (MODE === "cek-tarih" || MODE === "fatura-tarih" || K.tab === "cheques") return must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: String(100 + writes), issueDate: "2026-10-06", dueDate: "2026-12-31", drawer: "Keşideci", serialNo: `YR-${writes}-${randomUUID().slice(0, 6)}` }));
    return must("masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: ziraat.id, date: "2026-10-07", amount: String(1 + (writes % 7)), feeType: "eft", tax: "bsmv_incl", description: `Başka oturum ${writes}`, similarOk: true, requestId: randomUUID() }));
  };
  console.log(`kip ${MODE}${CONTROL ? " (kontrol)" : ""}; kod ${process.env.DEPO ? `DEPO=${ROOT}` : "bu ağaç"}; tarayıcı ${browser.version()}`);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
    document.addEventListener("focusin", event => {
      const state = window.__suzgecZorla;
      if (state && event.target === state.node) state.focused = true;
    }, true);
    // Yeniden çizim: çubuğun DIŞINDAKİ gözcü düğüm yenilendi. Ön koşul: o an odak kutuda ve gün yazılmış (tarih yarım).
    new MutationObserver(() => {
      const state = window.__suzgecZorla;
      if (!state || state.seen) return;
      const sentinel = document.querySelector(state.sentinelSel);
      if (!sentinel || sentinel === state.sentinel) return;
      state.seen = true;
      const box = document.querySelector(state.fieldSel);
      state.replaced = box !== state.node;
      state.precondition = state.control || (state.typed && document.activeElement === state.node) || (state.typed && state.focused && state.replaced);
      console.log(`[suzgec-zorla] ${state.precondition ? "ON-KOSUL" : "on-kosul-yok"}: ekran ${state.typed ? "gün yazılmışken" : "yazıdan önce"} yeniden çizildi; kutu ${state.replaced ? "YENİ düğüm" : "aynı düğüm"}, odak ${document.activeElement === box ? "kutuda" : document.activeElement?.tagName || "yok"}`);
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.text().startsWith("[suzgec-zorla]")) console.log(`    ${message.text()}`);
  });
  const requests = [];
  page.on("request", request => requests.push(request.url()));
  await installPageClock(page, app.config.now);
  let armed = false;
  let held = null;
  let heldSeen = null;
  await page.route(url => K.hold.test(url.href), route => {
    if (armed && !/[?&]from=2026-10-07/.test(route.request().url())) {
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
  if (MODE === "banka-tarih" || MODE === "pos-tarih") {
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 30000 });
    await page.click(`${bankWin} .hof-bank-tabs [data-tab="${MODE === "pos-tarih" ? "pos" : "movements"}"]`);
  } else if (MODE === "rapor-tarih") {
    await page.click("#hof-sidecard [data-action=analytics]");
    await page.waitForSelector(`${TOP} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
    await page.click(`${TOP} .hof-rep-tab[data-tab="all"]`);
    await page.waitForSelector(`${TOP} [data-rc-list] [data-report="kasa-hareketleri"]`, { timeout: 15000 });
    await page.click(`${TOP} [data-rc-list] [data-report="kasa-hareketleri"]`);
    await page.waitForSelector(`${TOP} [data-rc-main] .hof-rc-table`, { timeout: 15000 });
  } else if (MODE === "cek-tarih") {
    await page.click("#hof-sidecard [data-action=cheques]");
    await page.waitForSelector(`${TOP} .hof-plan-head`, { timeout: 15000 });
  } else if (MODE === "fatura-tarih") {
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${TOP} .hof-inv-tabs`, { timeout: 15000 });
  } else if (MODE === "kasa-tarih") {
    await page.click("#hof-sidecard [data-action=cash]");
    await page.waitForSelector(`${TOP} [data-period="range"]`, { timeout: 15000 });
    await page.click(`${TOP} [data-period="range"]`);
    await page.waitForSelector(`${TOP} [data-list] > *`, { timeout: 15000 });
  } else if (K.tab) {
    await page.click("#hof-sidecard [data-action=analytics]");
    await page.waitForSelector(`${TOP} .hof-rep-tab[data-tab="${K.tab}"]`, { timeout: 15000 });
    await page.click(`${TOP} .hof-rep-tab[data-tab="${K.tab}"]`);
    await page.waitForSelector(`${TOP} .hof-rep-tab[data-tab="${K.tab}"].is-on`, { timeout: 15000 });
  } else {
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${TOP} .hof-inv-tabs [data-tab="inbox"]`, { timeout: 15000 });
    await page.click(`${TOP} .hof-inv-tabs [data-tab="inbox"]`);
  }
  await page.waitForSelector(K.field, { timeout: 15000 });
  await page.waitForTimeout(600);
  // Tarih kutusunun bölüm sırası tarayıcının arayüz diline bağlı (tr: gg.aa.yyyy; bu koşucunun başsız Chromium'u aa/gg/yyyy) — ürünün olayları dışında, pencereye
  // (açık pencerenin üstüne; arka plan tıklamayı keser) eklenen boş bir tarih kutusunda bir kez sınanır (ürünün kendi kutusu sınanacak davranışın kendisidir).
  await page.evaluate(sel => {
    const probe = Object.assign(document.createElement("input"), { type: "date", id: "suzgec-zorla-sinama" });
    probe.addEventListener("change", event => event.stopPropagation());
    probe.addEventListener("input", event => event.stopPropagation());
    document.querySelector(sel).closest(".hof-modal, [role=dialog], .hof-bank-modal")?.prepend(probe);
  }, K.field);
  await page.click("#suzgec-zorla-sinama", { position: { x: 8, y: 8 } });
  await page.keyboard.type("01022026", { delay: 30 });
  const probe = await page.$eval("#suzgec-zorla-sinama", node => {
    const value = node.value;
    node.remove();
    return value;
  });
  const dayFirst = probe === "2026-02-01";
  if (!dayFirst && probe !== "2026-01-02") throw new Error(`tarih kutusunun bölüm sırası anlaşılamadı (01 02 2026 → "${probe}")`);
  const [FIRST, REST] = dayFirst ? ["07", "102026"] : ["10", "072026"];
  console.log(`tarih kutusu ${dayFirst ? "gg.aa.yyyy" : "aa/gg/yyyy"}: ilk bölüm "${FIRST}", kalan "${REST}"`);
  await page.fill(K.field, "");
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(600);

  for (let no = 1; no <= TRIALS; no += 1) {
    try {
      // Başlangıç: kutu boş (Banka / POS'ta süzgeç kalkar, liste yeniden yüklenir), odak kutuda değil.
      await page.fill(K.field, "");
      await page.waitForTimeout(500);
      await page.evaluate(() => document.activeElement?.blur?.());
      // Arka plan yenilemesi olmayan ekranda (Kasa penceresi: başka oturumun kaydında liste yenilenmez — koşarak: istek 15 sn içinde gelmedi) yalnız yazım denenir.
      if (K.background !== false) {
        const holding = new Promise(resolve => {
          heldSeen = resolve;
        });
        armed = true;
        await trigger();
        await Promise.race([holding, new Promise((_, reject) => setTimeout(() => reject(new Error("arka plan yenilemesinin isteği 15 sn içinde gelmedi")), 15000))]);
      }
      await page.evaluate(([fieldSel, sentinelSel, control, quietOnly]) => {
        window.__suzgecZorla = { fieldSel, sentinelSel, control, node: document.querySelector(fieldSel), sentinel: document.querySelector(sentinelSel), focused: false, typed: false, seen: quietOnly, replaced: false, precondition: quietOnly };
      }, [K.field, K.sentinel, CONTROL, K.background === false]);
      const route = held;
      held = null;
      const redrawn = () => page.waitForFunction(() => window.__suzgecZorla?.seen, null, { timeout: 5000 }).catch(() => null);
      const before = requests.length;
      if (CONTROL) {
        // KONTROL: yeniden çizim yazmaya başlamadan biter.
        await route?.continue().catch(() => null);
        await redrawn();
        await page.click(K.field, { position: { x: 8, y: 8 } });
        await page.keyboard.type(FIRST, { delay: 40 });
      } else {
        // tr-TR tarih kutusu gg.aa.yyyy: gün yazılır (tarih yarım), yeniden çizim gelir, kullanıcı ay ve yılı yazmayı sürdürür.
        await page.click(K.field, { position: { x: 8, y: 8 } });
        await page.keyboard.type(FIRST, { delay: 40 });
        await page.evaluate(() => {
          if (window.__suzgecZorla) window.__suzgecZorla.typed = true;
        });
        await route.continue().catch(() => null);
        await redrawn();
      }
      await page.keyboard.type(REST, { delay: 40 });
      await page.keyboard.press("Enter");
      const done = await page.waitForFunction(([sel, value]) => document.querySelector(sel)?.value === value && document.activeElement === document.querySelector(sel), [K.field, TARGET], { timeout: WAIT }).then(() => true).catch(() => false);
      // Banka / POS / Çek / Senet / Fatura / Kasa: süzgeç uygulandı (from=2026-10-07 isteği). Rapor ve Gelen Kutusu'nda tarih "Ön İzle" / "Gelen Kutusunu Yenile" /
      // "Raporu Getir" ile uygulanır — yalnız kutu.
      let applied = !K.applied;
      for (const until = Date.now() + WAIT; !applied && Date.now() < until; ) {
        applied = requests.slice(before).some(url => K.applied.test(url));
        if (!applied) await page.waitForTimeout(100);
      }
      const state = await page.evaluate(sel => {
        const box = document.querySelector(sel);
        const out = { ...window.__suzgecZorla, node: undefined, sentinel: undefined, value: box?.value ?? null, focus: document.activeElement === box, active: document.activeElement?.tagName || "" };
        window.__suzgecZorla = null;
        return out;
      }, K.field);
      if (!state.seen || !state.precondition) {
        skipped += 1;
        console.log(`· deneme ${no}: ön koşul OLUŞMADI (${state.seen ? "yeniden çizim oldu ama odak / yarım tarih yoktu" : "yeniden çizim görülmedi"}) — sayılmadı`);
        continue;
      }
      counted += 1;
      const good = done && applied;
      if (good) passed += 1;
      else failed += 1;
      console.log(`${good ? "✓" : "✗"} deneme ${no}: yazılan ${TARGET}; kutu "${state.value}", odak ${state.focus ? "kutuda" : `kayboldu (${state.active})`}, kutu ${state.replaced ? "yeniden kuruldu" : "korundu"}${K.applied ? `, süzgeç ${applied ? "uygulandı" : "UYGULANMADI"}` : ""}`);
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
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız. (kip ${MODE}${CONTROL ? " kontrol" : ""}; ön koşul ${counted}/${TRIALS} denemede oluştu; ${skipped} sayılmadı)`);
process.exitCode = failed ? 1 : 0;
