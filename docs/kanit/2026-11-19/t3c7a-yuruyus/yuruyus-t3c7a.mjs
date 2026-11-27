// TEK ADAY (sinama-t3c7a) EKRAN YÜRÜYÜŞÜ — Ç7a (kart faizi, hesapsız hareket → 'Açılışta Sayıldı' / 519 dökümü, POS komisyonu satış günü), Ç5-A tur 3 (S168 örneği, etiketin
// üç hâli, Alacak Yaşlandırma), Ç5-A tur 2f (kilit ileri → Kural Farkı Düzeltme fişi → kilit geri; S185 = A), tek aday hız düzeltmesi (kalabalık caride cari kartı + Cari Listesi;
// taban ↔ aday satır satır). Kullanıcı gözüyle, arayüzden; ön koşullar API'den (nedeni yazılır). Sahte saat (ders 13). Her bölümde BEKLENEN önce (girdilerden elle / karar
// metninden), sonra EKRAN ve DEFTER / VERİ TABANI. Pencere seçicisi TOP (ders 39). Ürün kodu değişmez.
// Kullanım: ROOT=<kod kökü> OUT=<klasör> HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=<…> node yuruyus-t3c7a.mjs
// Aynı betik tabanda (ana dal) da koşar: yeni ekranı olmayan adım 'TABANDA YOK' yazar, düşmez.
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const OUT = process.env.OUT;
if (!ROOT || !OUT) throw new Error("ROOT ve OUT gerekli");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { chromium } = await import(pathToFileURL(path.join(ROOT, "node_modules/playwright/index.mjs")).href);
const { installPageClock, ADMIN_PASSWORD } = await imp("test/helpers.mjs");
const { CURRENT, bootVersion } = await imp("test/guvenilirlik/surumler.mjs");
const { escClose } = await imp("test/e2e/esc-kapat.mjs");
fs.mkdirSync(OUT, { recursive: true });
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`; // ders 39
const bankWin = ".hof-bank-modal";
const accWin = ".hof-accounts-modal";
const note = (...a) => console.log(...a);
const UCLU = []; // [bölüm, ne, beklenen, ekran, defter/vt]
const uclu = (bolum, ne, beklenen, ekran, vt) => {
  UCLU.push([bolum, ne, String(beklenen), String(ekran), String(vt)]);
  note(`  ▶ ÜÇLÜ [${bolum}] ${ne}: BEKLENEN ${beklenen} · EKRAN ${ekran} · DEFTER/VT ${vt}`);
};
const YARIDA = [];
const YAZIM = new Set();
const D_OZET = [];
const browser = await chromium.launch();
const roots = [];
let page = null;
let n = 0;
let bolum = "";
const shot = async name => {
  n += 1;
  const f = path.join(OUT, `${String(n).padStart(2, "0")}-${bolum}-${name}.png`);
  await page?.screenshot({ path: f, fullPage: false }).catch(() => null);
  note(`  [görüntü ${path.basename(f)}]`);
  return f;
};
const closeAll = async () => {
  for (let i = 0; i < 6 && page && (await page.$(MODAL)); i += 1) {
    await escClose(page).catch(() => null);
    await page.waitForTimeout(250);
  }
};
const step = async (title, fn) => {
  note(`\n■ [${bolum}] ${title}`);
  try {
    await fn();
  } catch (e) {
    const msg = String(e?.message || e).split("\n")[0];
    note(`  ✗ ADIM YARIDA: ${msg}`);
    YARIDA.push(`[${bolum}] ${title}: ${msg}`);
    await shot("hata");
    await closeAll().catch(() => null);
  }
};
const flat = s => String(s || "").replace(/[ \t ]+/g, " ").replace(/\n+/g, " ¦ ").trim();
const metin = async (sel, lim = 900) => flat(await page.locator(sel).first().innerText({ timeout: 3000 }).catch(() => "(yok)")).slice(0, lim);
const var_ = async sel => Boolean(await page.$(sel));
const tl = text => {
  const m = /(−|-)?₺?\s?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/.exec(String(text || ""));
  return m ? Number(m[2].replace(/\./g, "").replace(",", ".")) * (m[1] ? -1 : 1) : null;
};
const fmt = v => (v === null || v === undefined ? "?" : Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
// Yazım düzeni (CLAUDE.md): ekrandaki başlık / düğme / kolon adlarında küçük harfle başlayan sözcük (bağlaç dışı) — aday olarak yazılır, elle bakılır.
const BAGLAC = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki", "ta", "te", "mi", "için", "gün", "satır", "cari", "kalem"]);
const yazimTara = async yer => {
  const items = await page.$$eval(`${MODAL} th, ${MODAL} button, ${MODAL} h2, ${MODAL} h3, ${MODAL} h4, ${MODAL} .hof-field > span, .adm-card h2, .adm-card button`, ns => ns.map(x => (x.childNodes[0]?.textContent || x.textContent || "").replace(/\s+/g, " ").trim()).filter(t => t && t.length < 60 && !/[?.!:]$/.test(t))).catch(() => []);
  for (const t of items) {
    const bad = t.replace(/\([^)]*\)/g, "").split(/[\s/·–-]+/).filter(w => /^[a-zçğıöşü]/.test(w) && w.length > 1 && !BAGLAC.has(w) && !/^\d/.test(w));
    if (bad.length) YAZIM.add(`${yer}: "${t}" (küçük harfli: ${bad.join(", ")})`);
  }
};

// ---------- bölüm açılışı ----------
async function bolumAc(ad, now, { dataDir = null, version = CURRENT } = {}) {
  bolum = ad;
  const root = fs.mkdtempSync(path.join(tmpdir(), `t3yy-${ad}-`));
  roots.push(root);
  const server = await bootVersion(version, { dataDir: dataDir || path.join(root, "data"), backupDir: path.join(root, "backups"), now });
  const app = server.app;
  const api = await server.login();
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", e => note(`  ! sayfa hatası: ${String(e.message).split("\n")[0]}`));
  await installPageClock(page, app.config.now);
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { server, app, api, base: server.base, context, root };
}
async function bolumKapat(S) {
  await S.context.close().catch(() => null);
  await S.server.close().catch(() => null);
}
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
};
const saatAl = async (S, iso) => {
  S.app.config.now.set(iso);
  await page.clock.setFixedTime(S.app.config.now.ms()).catch(() => null);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForTimeout(1200);
};
// Defter (veri tabanı tarafı): programın canlı türetmesi (ledger.build) — satırlar kuruş.
const defter = S => {
  try {
    return S.app.ledger.build();
  } catch {
    return S.app.ledger.book({});
  }
};
const satir = l => `${l.account}${l.sub ? `/${l.sub}` : ""} ${l.debit ? `B ${fmt(l.debit / 100)}` : `A ${fmt(l.credit / 100)}`}`;
const maddeler = (S, filt) => defter(S).filter(filt).map(e => `${e.date} ${e.id.split(":")[0]} [${e.lines.map(satir).join(" · ")}]`);
const hesapBakiye = (S, code, { sub = null, to = null, from = null } = {}) => {
  let d = 0;
  for (const e of defter(S)) {
    if ((to && e.date > to) || (from && e.date < from)) continue;
    for (const l of e.lines) if (String(l.account) === code && (!sub || l.sub === sub)) d += (l.debit || 0) - (l.credit || 0);
  }
  return Math.round(d) / 100;
};
const mizan = async (S, from = "", to = "") => {
  const d = await must("mizan", S.api.get(`/api/workspace/ledger?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`));
  return Object.fromEntries(d.trial.accounts.map(r => [r.code, r.balance]));
};
const mutabakat = async S => {
  const r = await S.api.get("/api/workspace/ledger/integrity");
  const d = r.data;
  const bad = (d?.failures || []).map(f => `${f.code}${f.notice ? "(uyarı)" : ""}`);
  return `${r.status} ok=${d?.ok} ${bad.length ? `bulgu: ${bad.join(", ")}` : "bulgusuz"}`;
};
const anaEkran = async S => {
  await closeAll();
  await page.goto(`${S.base}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForTimeout(1200);
};
const openReport = async (S, match) => {
  await anaEkran(S);
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${MODAL} [data-rc-list] [data-report]`, { timeout: 15000 });
  const id = await page.$$eval(`${MODAL} [data-rc-list] [data-report]`, (ns, m) => ns.find(x => x.textContent.replace(/\s+/g, " ").trim().startsWith(m))?.getAttribute("data-report") || null, match);
  if (!id) throw new Error(`rapor listede yok: ${match}`);
  await page.click(`${MODAL} [data-rc-list] [data-report="${id}"]`);
  await page.waitForFunction(sel => { const main = document.querySelector(`${sel} [data-rc-main]`); return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table, .hof-rc-summary, .hof-empty") && !/Rapor hazırlanıyor/.test(main.innerText); }, MODAL, { timeout: 60000 });
  await page.waitForTimeout(500);
  return id;
};
const raporSatir = () => page.$$eval(`${MODAL} [data-rc-main] tr`, rows => rows.map(tr => [...tr.querySelectorAll("th,td")].map(td => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")));
const raporApi = async (S, id, q = {}) => must(`rapor ${id}`, S.api.get(`/api/workspace/report-center/${id}?${new URLSearchParams(q)}`));
const sistem = async S => {
  await closeAll();
  await page.goto(`${S.base}/admin.html#system`, { waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]').catch(() => null);
  await page.waitForFunction(() => (document.querySelector("#adm-integrity-status")?.textContent || "").length > 10, null, { timeout: 90000 });
  await page.waitForTimeout(700);
  const kilit = await metin("#adm-period-status", 300);
  const mut = await metin("#adm-integrity-status", 700);
  note(`  Yönetim › Sistem · Dönem Kilidi: ${kilit}`);
  note(`  Yönetim › Sistem · Mutabakat satırı: ${mut}`);
  return { kilit, mut };
};
const kilitBekle = async (S, label) => {
  for (let i = 0; i < 240; i += 1) {
    const r = await S.api.get("/api/workspace/ledger/lock");
    const f = r.data?.freeze;
    if (!f?.active && !f?.pending && !f?.cleanup?.running) return note(`  dondurma bitti (${label}; ${i / 2} sn) · kilit ${r.data?.lockedUntil || "yok"} · donmuş ${r.data?.frozenThrough || "—"}`);
    await new Promise(res => setTimeout(res, 500));
  }
  note(`  ! dondurma 120 sn'de bitmedi (${label})`);
};
const kilitEkrandan = async (S, value) => {
  await sistem(S);
  if (value) {
    await page.fill("#adm-period-date", value);
    await page.click("#adm-period-save");
  } else {
    await page.click("#adm-period-clear");
    await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 8000 });
    note(`  SORU (kilidi kaldır): ${await metin(TOP, 300)}`);
    await page.click(`${TOP} [data-answer="yes"]`);
  }
  await page.waitForTimeout(1500);
  await kilitBekle(S, `kilit ${value || "kaldırıldı"}`);
  const r = await S.api.get("/api/workspace/ledger/lock");
  note(`  kilit (veri tabanı / API): ${r.data?.lockedUntil || "yok"}`);
};
// Formdaki soruyu (Benzer kayıt vb.) yanıtlayan yardımcı: her soru nedeniyle yazılır (ders 34).
const soruYanitla = async (etiket, beklenen = "soru beklenmiyor") => {
  let sayi = 0;
  for (let i = 0; i < 3; i += 1) {
    const s = await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 2500 }).catch(() => null);
    if (!s) break;
    sayi += 1;
    note(`  SORU (${etiket}; ${beklenen}): ${await metin(TOP, 400)} → Evet`);
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForTimeout(900);
  }
  if (!sayi) note(`  soru yok (${etiket}; ${beklenen})`);
};
const cariKart = async (S, id) => {
  await anaEkran(S);
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`${accWin} tr[data-account="${id}"]`, { timeout: 20000 });
  await page.click(`${accWin} tr[data-account="${id}"]`);
  await page.waitForSelector(`${accWin} .hof-plan-head`, { timeout: 15000 });
  await page.waitForTimeout(700);
};
// Cari kartından tahsilat: klavye (Tab) + insan hızı (ders 12).
const tahsilatFormu = async ({ tutar, yol = null, tarih = null, fatura = null, pos = null }) => {
  await page.click(`${accWin} [data-entry="in"]`);
  await page.waitForSelector(`${TOP} .hof-form input[name="amount"]`);
  await page.click(`${TOP} input[name="amount"]`);
  await page.keyboard.type(tutar, { delay: 110 });
  await page.keyboard.press("Tab");
  note(`  Tab sonrası odak: ${await page.evaluate(() => document.activeElement?.getAttribute("name") || document.activeElement?.tagName)}`);
  if (yol) {
    await page.selectOption(`${TOP} select[name="method"]`, yol);
    await page.waitForTimeout(400);
  }
  if (pos) {
    // Tek POS varsa form onu kendiliğinden seçer (seçici çıkmaz; yardım metni "… POS'una yazılır"); birden çoksa seçilir.
    const sec = await page.waitForSelector(`${TOP} select[name="posId"]`, { timeout: 2500 }).catch(() => null);
    if (sec) await page.selectOption(`${TOP} select[name="posId"]`, pos);
    else note("  POS seçicisi yok: tek POS kendiliğinden seçili");
    await page.waitForTimeout(800);
  }
  if (tarih) {
    await page.fill(`${TOP} input[name="date"]`, tarih);
    await page.keyboard.press("Tab");
  }
  if (fatura) {
    await page.selectOption(`${TOP} select[name="invoiceId"]`, fatura);
    await page.focus(`${TOP} select[name="invoiceId"]`);
    await page.keyboard.press("Tab");
  }
  await page.waitForTimeout(400);
};
const formGonder = async etiket => {
  await page.click(`${TOP} .hof-form button[type="submit"]`);
  await page.waitForTimeout(1200);
  await soruYanitla(etiket);
  const acik = await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible .hof-form input[name="amount"]'), null, { timeout: 8000 }).then(() => false).catch(() => true);
  if (acik) {
    const msg = await metin(TOP, 600);
    note(`  FORM KAPANMADI (kayıt REDDEDİLDİ ya da hata): ${msg}`);
    return { ok: false, msg };
  }
  return { ok: true };
};
const NOW_A = { time: "2026-10-08T12:00:00+03:00", fixed: true }; // Perşembe
const gun = (base, off) => {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + off);
  return d.toISOString().slice(0, 10);
};

note(`KOD KÖKÜ: ${ROOT}`);
note(`ÇIKTI: ${OUT}`);

// =====================================================================================================================================================
// A — Ç7a: hesapsız hareket → hesap açılınca 'Açılışta Sayıldı' + 519 dökümü; + Kart Faizi; POS komisyonu satış günü
// =====================================================================================================================================================
{
  const S = await bolumAc("A", NOW_A);
  const ids = {};
  try {
    note("\nBEKLENEN (A; girdilerden elle; sahte saat 08.10.2026 Perşembe; S179 = A, D-07, KG-6 = A):");
    note("  Hesap yokken ABC Ltd.'ye havale: 20.09 giriş 5.000 (EKRANDAN), 25.09 çıkış 1.000, 01.10 giriş 700, 03.10 giriş 2.000 (API) → kova 6.700.");
    note("  Ziraat (açılış 01.10, 100.000) ve Şirket Kartı (açılış 01.10, borç 5.000) açılınca: 20.09 ve 25.09 açılıştan önce → 'Açılışta Sayıldı', defterde 519 (20.09 B 519 5.000 / A 120; 25.09 B 120 / A 519 1.000);");
    note("  01.10 (açılış günü, 'küçüktür') ve 03.10 102.00'da kalır → Hesabı Atanmamış kovası 2.700 (Havale), liste 4 satır, toplam 2.700; 102.00 = 2.700.");
    note("  Açılış Eşleştirme 519 dökümünde 'Hesapsız Hareketler (Açılıştan Önce)' = 5.000 − 1.000 = 4.000 (borç).");
    note("  + Kart Faizi 200 + BSMV / KKDF 10 → önizleme 'Kart Borcuna Eklenen ₺210,00'; kart borcu 5.000 → 5.210; fiş B 780 200 · B 780 10 / A 309 210; Ziraat değişmez; 780 = 210.");
    note("  POS (Ziraat Fiziki POS, Tek Çekim %2,5, valör 2 iş günü → 12.10) 08.10 tahsilat 10.000 → 08.10 B 108.01 10.000 / A 120 + 08.10 B 653 250 / A 108.01 250 (satış günü);");
    note("  08.10'da 653 = 250, 108 = 9.750; POS Komisyon Raporu komisyonu 250 (08.10 satışı). 12.10 Şimdi Aktar → B 102.01 9.750 / A 108.01 9.750 (653 satırı yok); 653 = 250 (08.10'da), Ziraat 109.750.");
    await must("banka sihirbazını kapat", S.api.post("/api/workspace/bank/setup/dismiss", {}));
    const abc = await must("ABC (ön koşul API: cari açma bu paketin konusu değil)", S.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    ids.abc = abc.id;

    await step("A1 Hesap yokken cari kartından + Tahsilat: 5.000, Tab, Havale / EFT, tarih 20.09 (klavye, insan hızı)", async () => {
      await cariKart(S, abc.id);
      await tahsilatFormu({ tutar: "5000", yol: "bank", tarih: "2026-09-20" });
      await shot("hesapsiz-havale-formu");
      await yazimTara("A1 tahsilat formu");
      const g = await formGonder("hesapsız havale");
      const row = S.app.store.get("SELECT amount, method, date, note FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", abc.id);
      uclu("A", "A1 hesapsız havale kaydı", "kabul, 20.09 havale 5.000, hesapsız", g.ok ? "form kapandı" : `RED: ${g.msg}`, JSON.stringify(row));
      await shot("hesapsiz-havale-sonra");
    });
    await step("A2 Diğer hesapsız hareketler (API: aynı form A1'de ekrandan sınandı; geçmiş tarihli seri)", async () => {
      const add = (label, body) => must(label, S.api.post(`/api/workspace/accounts/${abc.id}/entries`, { similarOk: true, ...body }));
      await add("25.09 havale ödeme 1.000", { kind: "out", amount: "1.000", method: "bank", date: "2026-09-25" });
      await add("01.10 havale 700", { kind: "in", amount: "700", method: "bank", date: "2026-10-01" });
      await add("03.10 havale 2.000", { kind: "in", amount: "2.000", method: "bank", date: "2026-10-03" });
      const sum = await must("özet", S.api.get("/api/workspace/bank/summary"));
      uclu("A", "A2 hesap yokken kova (102.00)", "6.700", "—", fmt(sum.unassigned?.bankMinor / 100));
    });
    await step("A3 Ziraat + Şirket Kartı açılır (ön koşul API: hesap açma formu bu paketin konusu değil)", async () => {
      const z = await must("Ziraat", S.api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
      const k = await must("kart", S.api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } }));
      ids.ziraat = z.id;
      ids.kart = k.id;
      ids.kartSub = k.glSub;
      note(`  Ziraat ${z.id} · kart ${k.id} (alt hesap ${k.glSub})`);
    });
    await step("A4 Banka › Genel Bakış: Hesabı Atanmamış kovası; Eski Hareketler listesi ('Açılışta Sayıldı' rozeti)", async () => {
      await anaEkran(S);
      await page.click('#hof-sidecard [data-action="bank"]');
      await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 20000 });
      await page.waitForTimeout(900);
      const kova = await metin(`${bankWin} [data-bank-unassigned]`, 400);
      await shot("genel-bakis");
      await yazimTara("A4 Banka Genel Bakış");
      const sum = await must("özet", S.api.get("/api/workspace/bank/summary"));
      uclu("A", "A4 Hesabı Atanmamış kovası (Havale 102.00)", "2.700", kova, `${fmt(sum.unassigned?.bankMinor / 100)} · defter 102.00 = ${fmt(hesapBakiye(S, "102", { sub: "102.00" }))}`);
      await page.click(`${bankWin} [data-act="legacy"]`);
      await page.waitForSelector(`${bankWin} .hof-bank-legacy`, { timeout: 15000 });
      await page.waitForTimeout(700);
      const rows = await page.$$eval(`${bankWin} .hof-bank-legacy tbody tr`, rs => rs.map(r => r.textContent.replace(/\s+/g, " ").trim()));
      const counted = await page.$$eval(`${bankWin} .hof-bank-legacy tbody tr`, rs => rs.filter(r => r.querySelector("[data-legacy-counted]")).map(r => r.textContent.replace(/\s+/g, " ").trim().slice(0, 60)));
      note(`  Eski Hareketler satırları (${rows.length}):`);
      for (const r of rows) note(`    ${r.slice(0, 220)}`);
      const stats = await metin(`${bankWin} .hof-bank-stats`, 300);
      uclu("A", "A4 Eski Hareketler: satır / rozetli / toplam", "4 satır · rozet 2 (20.09, 25.09) · Havale toplamı 2.700", `${rows.length} satır · rozet ${counted.length} [${counted.map(x => x.slice(0, 12)).join(" ; ")}] · ${stats}`, "—");
      await page.$eval(`${bankWin} .hof-bank-legacy`, x => x.scrollIntoView({ block: "center" })).catch(() => null);
      await shot("eski-hareketler");
      await yazimTara("A4 Eski Hareketler");
      const m519 = maddeler(S, e => e.date < "2026-10-01" && e.lines.some(l => String(l.account) === "519"));
      note(`  DEFTER (açılıştan önceki 519 maddeleri): ${m519.join(" || ") || "YOK"}`);
      uclu("A", "A4 defter: 30.09'a kadar 519 bakiyesi", "4.000 (B 5.000 − A 1.000)", "—", fmt(hesapBakiye(S, "519", { to: "2026-09-30" })));
    });
    await step("A5 Yönetim › Sistem › Açılış Eşleştirme: 519 dökümü", async () => {
      await sistem(S);
      if (!(await var_("#adm-opening-match-open"))) return note("  TABANDA YOK: Açılış Eşleştirme düğmesi");
      await page.click("#adm-opening-match-open");
      await page.waitForSelector(`${TOP} [data-match-balance], ${TOP} [data-match-parts]`, { timeout: 60000 });
      await page.waitForTimeout(700);
      const parts = await page.$$eval(`${TOP} [data-match-parts] tbody tr`, rs => rs.map(r => r.textContent.replace(/\s+/g, " ").trim())).catch(() => []);
      note(`  519 dökümü: ${parts.join(" ; ") || "(tablo yok)"} · ${await metin(`${TOP} [data-match-balance]`, 200)}`);
      const hes = parts.find(p => /Hesapsız Hareketler/.test(p));
      uclu("A", "A5 519 dökümü 'Hesapsız Hareketler (Açılıştan Önce)'", "4.000", hes || "SATIR YOK", fmt(hesapBakiye(S, "519", { to: "2026-09-30" })));
      await shot("acilis-eslestirme-519");
      await yazimTara("A5 Açılış Eşleştirme");
      await closeAll();
    });
    await step("A6 Banka › Hesaplar › Şirket Kartı › + Kart Faizi: 200, Tab, 10 (klavye) → önizleme → Kaydet", async () => {
      await anaEkran(S);
      await page.click('#hof-sidecard [data-action="bank"]');
      await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 20000 });
      await page.click(`${bankWin} .hof-bank-tabs [data-tab="accounts"]`);
      await page.waitForSelector(`${bankWin} .hof-bank-accounts tbody tr[data-account="${ids.kart}"]`, { timeout: 15000 });
      await page.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${ids.kart}"]`);
      await page.waitForSelector(`${bankWin} [data-bank-balance]`, { timeout: 15000 });
      await page.waitForTimeout(500);
      await shot("kart-hesap-detayi");
      const before = (await must("Ziraat", S.api.get(`/api/workspace/bank/accounts/${ids.ziraat}`))).balanceMinor;
      if (!(await var_(`${bankWin} [data-act="v-card-interest"]`))) {
        uclu("A", "A6 + Kart Faizi düğmesi", "var", "TABANDA YOK", "—");
        return;
      }
      await page.click(`${bankWin} [data-act="v-card-interest"]`);
      const form = "form.hof-bank-voucher";
      await page.waitForSelector(`${form} [name="amount"]`, { timeout: 8000 });
      const alan = await page.$eval(`${form} [name="accountId"]`, x => (x.closest(".hof-field")?.querySelector(":scope > span")?.firstChild?.textContent || "").trim()).catch(() => "?");
      note(`  form: İşlem Türü ${await page.$eval(`${form} [name="type"]`, x => x.options[x.selectedIndex]?.textContent)} · alan adı "${alan}"`);
      await page.click(`${form} [name="amount"]`);
      await page.keyboard.type("200", { delay: 110 });
      await page.keyboard.press("Tab");
      const odak = await page.evaluate(() => document.activeElement?.getAttribute("name"));
      await page.keyboard.type("10", { delay: 110 });
      await page.keyboard.press("Tab");
      await page.waitForTimeout(400);
      const on = await metin(`${form} [data-voucher-preview]`, 300);
      uclu("A", "A6 Kart Faizi formu: Tab sonrası alan · alan adı · önizleme", "taxAmount · Kredi Kartı · Kart Borcuna Eklenen ₺210,00", `${odak} · ${alan} · ${on}`, "—");
      await shot("kart-faizi-formu");
      await yazimTara("A6 Kart Faizi formu");
      await page.click(`${form} button[type="submit"]`);
      await page.waitForSelector(form, { state: "detached", timeout: 10000 });
      await page.waitForTimeout(900);
      const head = await metin(`${bankWin} [data-bank-balance]`, 200);
      const kart = (await must("kart", S.api.get(`/api/workspace/bank/accounts/${ids.kart}`))).balanceMinor;
      const after = (await must("Ziraat", S.api.get(`/api/workspace/bank/accounts/${ids.ziraat}`))).balanceMinor;
      const ev = defter(S).filter(e => e.lines.some(l => String(l.account) === "780")).map(e => `${e.date} [${e.lines.map(satir).join(" · ")}]`);
      const mz = await mizan(S);
      uclu("A", "A6 kart borcu", "5.210 (borç)", head, fmt(kart / 100));
      uclu("A", "A6 kart faizi fişi", "B 780 200 · B 780 10 / A 309 210 (08.10)", "—", ev.join(" || ") || "YOK");
      uclu("A", "A6 Ziraat değişmez · mizan 780", `${fmt(before / 100)} · 210`, "—", `${fmt(after / 100)} · ${mz["780"]}`);
      await shot("kart-faizi-sonra");
    });
    await step("A7 POS tanımı (API: POS kurulum formu bu paketin konusu değil) + cari kartından POS tahsilatı 10.000 (ekrandan)", async () => {
      const acc = await must("hesap", S.api.get(`/api/workspace/bank/accounts/${ids.ziraat}`));
      if (!acc.usePos) await must("POS Kullan", S.api.put(`/api/workspace/bank/accounts/${ids.ziraat}`, { usePos: true }));
      const pos = (await must("POS aç", S.api.post("/api/workspace/bank/pos", { name: "Ziraat Fiziki POS", bankAccountId: ids.ziraat, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }] }))).pos;
      ids.pos = pos.id;
      await cariKart(S, abc.id);
      await tahsilatFormu({ tutar: "10000", yol: "card", pos: pos.id });
      note(`  POS önizleme / form: ${await metin(`${TOP} .hof-form`, 600)}`);
      await shot("pos-tahsilat-formu");
      await yazimTara("A7 POS tahsilat formu");
      const g = await formGonder("POS tahsilatı");
      const m = maddeler(S, e => e.date === "2026-10-08" && e.lines.some(l => ["653", "108"].includes(String(l.account))));
      uclu("A", "A7 08.10 defter maddeleri", "B 108.01 10.000 / A 120 10.000 · B 653 250 / A 108.01 250 (pos-commission)", g.ok ? "form kapandı" : `RED: ${g.msg}`, m.join(" || ") || "YOK");
      const mz = await mizan(S);
      uclu("A", "A7 08.10 mizan 653 · 108", "250 · 9.750", "—", `${mz["653"] ?? 0} · ${mz["108"] ?? 0}`);
      await shot("pos-tahsilat-sonra");
    });
    await step("A8 POS Komisyon Raporu (ekran + API) ↔ defter 653 (aynı gün, aynı tutar)", async () => {
      const id = await openReport(S, "POS Komisyon Raporu");
      const rows = await raporSatir();
      note(`  POS Komisyon Raporu (${rows.length} satır):`);
      for (const r of rows.slice(0, 15)) note(`    ${r}`);
      await shot("pos-komisyon-raporu");
      await yazimTara("A8 POS Komisyon Raporu");
      const d = await raporApi(S, id);
      const m653 = maddeler(S, e => e.lines.some(l => String(l.account) === "653"));
      uclu("A", "A8 POS Komisyon Raporu ↔ defter 653", "rapor komisyon 250 (08.10 satışı) · defter 653 08.10'da 250", `${rows.filter(r => /250,00/.test(r)).length} satırda 250,00 · özet ${JSON.stringify(d.summary || []).slice(0, 200)}`, m653.join(" || "));
    });
    await step("A9 Saat 12.10 Pazartesi → Banka › POS › Şimdi Aktar (ekrandan) → gün fişi net", async () => {
      await saatAl(S, "2026-10-12T10:00:00+03:00");
      await page.click('#hof-sidecard [data-action="bank"]');
      await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 20000 });
      let yol = "ekran";
      if (await var_(`${bankWin} .hof-bank-tabs [data-tab="pos"]`)) {
        await page.click(`${bankWin} .hof-bank-tabs [data-tab="pos"]`);
        await page.waitForTimeout(900);
      }
      const btn = await page.$(`${bankWin} [data-pos-act="settle"]:not([disabled])`);
      if (btn) {
        await btn.click();
        await soruYanitla("Şimdi Aktar", "onay sorusu olabilir");
        await page.waitForTimeout(1500);
      } else {
        yol = "API (Şimdi Aktar düğmesi bulunamadı ya da pasif)";
        await must("Şimdi Aktar", S.api.post("/api/workspace/bank/settle", {}));
      }
      await shot("pos-simdi-aktar");
      const ids2 = new Set(S.app.store.all("SELECT id FROM fin_events WHERE type = 'pos_settlement' AND status = 'active'").map(r => `bank:${r.id}`));
      const gf = defter(S).filter(e => ids2.has(e.id)).map(e => `${e.date} [${e.lines.map(satir).join(" · ")}]`);
      const z = (await must("Ziraat", S.api.get(`/api/workspace/bank/accounts/${ids.ziraat}`))).balanceMinor;
      uclu("A", `A9 gün fişi (${yol})`, "12.10 B 102.01 9.750 / A 108.01 9.750 (653 yok)", "—", gf.join(" || ") || "YOK");
      uclu("A", "A9 653 (tarih) · 108 · Ziraat", "250 (08.10) · 0 · 109.750", "—", `${maddeler(S, e => e.lines.some(l => String(l.account) === "653")).map(x => x.slice(0, 10)).join(",")} ${fmt(hesapBakiye(S, "653"))} · ${fmt(hesapBakiye(S, "108"))} · ${fmt(z / 100)}`);
    });
    await step("A10 Yevmiye Defteri (ekran) 653 / 519 / 780 satırları + Mutabakat Testi", async () => {
      await openReport(S, "Yevmiye Defteri");
      const rows = await raporSatir();
      note(`  Yevmiye Defteri (${rows.length} satır; 653 / 519 / 780 / 108 geçenler):`);
      for (const r of rows.filter(x => /\b(653|519|780|108)\b/.test(x)).slice(0, 30)) note(`    ${r}`);
      await shot("yevmiye");
      uclu("A", "A10 Mutabakat Testi", "bulgusuz", "—", await mutabakat(S));
    });
  } catch (e) {
    note(`HATA (A): ${e.stack || e}`);
    YARIDA.push(`[A] bölüm: ${String(e.message).split("\n")[0]}`);
  } finally {
    await bolumKapat(S);
  }
}

// =====================================================================================================================================================
// B — Ç5-A tur 3: S168 örneği; etiketin üç hâli; Alacak Yaşlandırma
// =====================================================================================================================================================
{
  const T = "2026-10-08";
  const S = await bolumAc("B", NOW_A);
  try {
    note("\nBEKLENEN (B; S168 = B karar örneği, girdilerden elle; bugün 08.10.2026):");
    note(`  Cari 'S168 Müşteri': F1 1.000 (${gun(T, -60)}) → Şüpheliye Al 1.000 (${gun(T, -40)}) → F2 500 (${gun(T, -30)}, kayıttan sonra) → Normal Cari Hesaba İşle 400 (${gun(T, -20)}) ⇒ 120 = 100, 128 = 1.000.`);
    note(`  EKRANDAN F2'ye bağlı nakit 300 (${gun(T, -10)}): faturanın şüpheli payından → A 128 300 ⇒ 128 = 700, 120 = 100; etiket YOK.`);
    note("  EKRANDAN F2'ye bağlı nakit 200 (bugün): F2'nin kalan şüpheli payı 100 → 100'ü 128, 100'ü 120 ⇒ 128 = 600, 120 = 0; etiket 'Kısmen Normal Cariye İşlendi (₺100,00)'. İşaretli 400 'Normal Cariye İşlendi'.");
    note(`  Cari 'Pay Sıfır Müşteri': F1 1.000 → Şüpheliye Al 1.000 → F2 500 (kayıttan sonra) → EKRANDAN F2'ye bağlı 200 (bugün): F2'nin şüpheli payı 0 → A 120 200 ⇒ 120 = 300, 128 = 1.000; etiket 'Normal Cariye İşlendi'.`);
    note("  Alacak Yaşlandırma: S168 Müşteri — kalan F1 600 (60 gün) → '31–60 Gün' 600, Şüpheli 600, Toplam 600; Pay Sıfır — F1 1.000 (31–60) + F2 300 (30 gün, 1–30), Şüpheli 1.000, Toplam 1.300.");
    note("  TABANDA (S168 = B öncesi): bağlı 300 ve bağlı 200 409 ile REDDEDİLİR (bağlı tahsilat her zaman 120; şüpheli dışı borç 100).");
    await must("banka sihirbazını kapat", S.api.post("/api/workspace/bank/setup/dismiss", {}));
    // Fatura serisi tarih sırası ister (FIS serisinde daha eski tarihli belge kaydedilemez): iki carinin adımları tarih sırasıyla iç içe.
    const kur = async list => {
      const out = [];
      for (const ad of list) out.push({ ad, id: (await must(`cari ${ad}`, S.api.post("/api/workspace/accounts", { name: ad, type: "customer", registeredOn: gun(T, -400) }))).id });
      const sale = async (acc, date, amount) => (await must("fatura", S.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open" } }))).id;
      for (const c of out) await sale(c.id, gun(T, -60), 1000);
      for (const c of out) await must("şüpheliye al", S.api.post(`/api/workspace/accounts/${c.id}/doubtful`, { amount: "1000", date: gun(T, -40), reason: "lawsuit", note: "dava" }));
      for (const c of out) c.f2 = await sale(c.id, gun(T, -30), 500);
      await must("Normal Cari Hesaba İşle 400", S.api.post(`/api/workspace/accounts/${out[0].id}/entries`, { kind: "in", amount: "400", date: gun(T, -20), method: "cash", cashForce: true, similarOk: true, doubtfulSkip: true }));
      return out;
    };
    const gl = id => {
      const b = { 120: 0, 128: 0 };
      for (const e of defter(S)) for (const l of e.lines || []) if ((l.account === "120" || l.account === "128") && l.party === id) b[l.account] += l.debit - l.credit;
      return `120 = ${fmt(b[120] / 100)}, 128 = ${fmt(b[128] / 100)}`;
    };
    const etiketler = async () => ({
      tam: await page.$$eval(`${accWin} .hof-plans-entries [data-doubtful-normal]`, ns => ns.map(x => x.closest("tr")?.textContent.replace(/\s+/g, " ").trim().slice(0, 80))).catch(() => []),
      kismi: await page.$$eval(`${accWin} .hof-plans-entries [data-doubtful-normal-part]`, ns => ns.map(x => `${x.textContent.replace(/\s+/g, " ").trim()} @ ${x.closest("tr")?.textContent.replace(/\s+/g, " ").trim().slice(0, 50)}`)).catch(() => []),
    });
    let A1;
    let C1;
    await step("B0 Kurulum (API: fatura / şüpheliye alma / işaretli tahsilat — bu paketin konusu bağlı tahsilat)", async () => {
      [A1, C1] = await kur(["S168 Müşteri", "Pay Sıfır Müşteri"]);
      uclu("B", "B0 kurulum S168 Müşteri", "120 = 100, 128 = 1.000", "—", gl(A1.id));
      uclu("B", "B0 kurulum Pay Sıfır", "120 = 500, 128 = 1.000", "—", gl(C1.id));
    });
    await step("B1 S168 Müşteri kartı → + Tahsilat 300, Tab, tarih −10, Kapatılacak Fatura = F2 (klavye, insan hızı)", async () => {
      await cariKart(S, A1.id);
      await shot("s168-kart-once");
      await tahsilatFormu({ tutar: "300", tarih: gun(T, -10), fatura: A1.f2 });
      await shot("s168-bagli-300-formu");
      await yazimTara("B1 tahsilat formu");
      const g = await formGonder("F2'ye bağlı 300");
      if (!g.ok) await closeAll();
      const row = S.app.store.get("SELECT amount, date, invoice_id = ? AS f2, doubtful_skip AS skip FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", A1.f2, A1.id);
      uclu("B", "B1 F2'ye bağlı 300", "kabul · 120 = 100, 128 = 700", g.ok ? "form kapandı" : `RED: ${g.msg.slice(0, 200)}`, `${gl(A1.id)} · son satır ${JSON.stringify(row)}`);
    });
    await step("B2 Aynı kartta + Tahsilat 200 (bugün), Kapatılacak Fatura = F2", async () => {
      await cariKart(S, A1.id);
      await tahsilatFormu({ tutar: "200", fatura: A1.f2 });
      const g = await formGonder("F2'ye bağlı 200");
      if (!g.ok) await closeAll();
      uclu("B", "B2 F2'ye bağlı 200", "kabul · 120 = 0, 128 = 600", g.ok ? "form kapandı" : `RED: ${g.msg.slice(0, 200)}`, gl(A1.id));
      await cariKart(S, A1.id);
      const t = await etiketler();
      uclu("B", "B2 etiketler (S168 Müşteri)", "tam: [işaretli 400] · kısmi: ['Kısmen Normal Cariye İşlendi (₺100,00)' @ 200'lük satır] · 300'lük satır etiketsiz", "—", JSON.stringify(t));
      note(`  kart KPI: ${await metin(`${accWin} .hof-plans-kpis`, 400)}`);
      note(`  şüpheli bölümü: ${await metin(`${accWin} [data-doubtful-list]`, 400)}`);
      await page.$eval(`${accWin} .hof-plans-entries`, x => x.scrollIntoView({ block: "center" })).catch(() => null);
      await shot("s168-kart-etiketler");
      await page.locator(`${accWin} .hof-plans-entries`).first().screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-B-s168-hareketler.png`) }).catch(() => null);
      note(`  [görüntü ${String(n).padStart(2, "0")}-B-s168-hareketler.png]`);
      await yazimTara("B2 cari kartı");
    });
    await step("B3 Pay Sıfır Müşteri kartı → + Tahsilat 200, Kapatılacak Fatura = F2 (payı 0)", async () => {
      await cariKart(S, C1.id);
      await tahsilatFormu({ tutar: "200", fatura: C1.f2 });
      const g = await formGonder("Pay Sıfır F2'ye bağlı 200");
      if (!g.ok) await closeAll();
      uclu("B", "B3 Pay Sıfır F2'ye bağlı 200", "kabul · 120 = 300, 128 = 1.000", g.ok ? "form kapandı" : `RED: ${g.msg.slice(0, 200)}`, gl(C1.id));
      await cariKart(S, C1.id);
      const t = await etiketler();
      uclu("B", "B3 etiketler (Pay Sıfır)", "tam: [200'lük satır] · kısmi: []", "—", JSON.stringify(t));
      await page.$eval(`${accWin} .hof-plans-entries`, x => x.scrollIntoView({ block: "center" })).catch(() => null);
      await shot("payi-sifir-kart");
    });
    await step("B4 Alacak Yaşlandırma (ekran + API)", async () => {
      const id = await openReport(S, "Alacak Yaşlandırma");
      const rows = await raporSatir();
      for (const r of rows.slice(0, 8)) note(`    ${r}`);
      await shot("alacak-yaslandirma");
      await yazimTara("B4 Alacak Yaşlandırma");
      const d = await raporApi(S, id);
      const api = ad => JSON.stringify((d.rows || []).find(r => r[0] === ad) || null);
      uclu("B", "B4 S168 Müşteri satırı", "31–60 Gün 600 · Şüpheli 600 · Toplam 600", rows.find(r => r.startsWith("S168 Müşteri")) || "SATIR YOK", api("S168 Müşteri"));
      uclu("B", "B4 Pay Sıfır satırı", "31–60 Gün 1.000 · 1–30 Gün 300 · Şüpheli 1.000 · Toplam 1.300", rows.find(r => r.startsWith("Pay Sıfır")) || "SATIR YOK", api("Pay Sıfır Müşteri"));
    });
    await step("B5 Hesap Planı Mizanı (ekran) 120 / 128 + Mutabakat Testi", async () => {
      await openReport(S, "Hesap Planı Mizanı");
      const rows = await raporSatir();
      for (const r of rows.filter(x => /^(120|128|129|100|600|654)\b/.test(x))) note(`    ${r}`);
      await shot("mizan");
      const mz = await mizan(S);
      uclu("B", "B5 mizan 120 · 128 (iki cari toplamı)", "120 = 0 + 300 = 300 · 128 = 600 + 1.000 = 1.600", rows.filter(x => /^(120|128)\b/.test(x)).join(" ; "), `${mz["120"]} · ${mz["128"]}`);
      uclu("B", "B5 Mutabakat Testi", "bulgusuz", "—", await mutabakat(S));
    });
  } catch (e) {
    note(`HATA (B): ${e.stack || e}`);
    YARIDA.push(`[B] bölüm: ${String(e.message).split("\n")[0]}`);
  } finally {
    await bolumKapat(S);
  }
}

// =====================================================================================================================================================
// C — Ç5-A tur 2f (S185 = A): v2.4.9'da kilitli dönemde 'Açılış bakiyesi' 700 → güncel kod 10.01.2027 → ret → kilit 31.12.2026 → Kural Farkı fişi (2027) → kilit geri 30.11.2026
// =====================================================================================================================================================
{
  bolum = "C";
  const croot = fs.mkdtempSync(path.join(tmpdir(), "t3yy-C-kaynak-"));
  roots.push(croot);
  const src = path.join(croot, "data");
  let e700 = null;
  note("\nBEKLENEN (C; girdiler + S174 = A ve S185 = A karar metni 'sonraki yılın fişi de KENDİ yılında düzeltilmiş sayılır'):");
  note("  v2.4.9 (20.10.2026): cari 'Yürüyüş Müşteri A' 02.10 'Açılış bakiyesi' 700 Borç Yaz; kilit 05.10.2026 (donmuş defter eski kuralla: B 120 700 / A 500 700).");
  note("  Güncel kod 10.01.2027: Açılış Olabilir'de 700 REDDEDİLİR (açılış değil → 2.5.0 kuralında karşılık 602) → kilitli dönemde kural farkı 500 ↔ 602.");
  note("  Kilit 31.12.2026 → Kural Farkı penceresi: fiş 01.01.2027 B 500 700 / A 671 700 (önceki yılın geliri 671) → Fişi Kaydet → 'Düzeltildi (Fiş 2027-000001)'.");
  note("  (b) kilit DOĞRUDAN 30.11.2026: fiş kendi yılında düzeltilmiş sayılır → pencere PASİF 'Fişle düzeltilebilen fark kalmadı.', satır 'Düzeltildi (Fiş 2027-000001)'; 2026'ya ikinci fiş YOK:");
  note("      2026 mizanı 602 = 0, 671 = 0 (500 donmuş eski kuralla alacak 700); 2027 hareketi B 500 700 / A 671 700 → 2027 devirli bakiye 500 = 0 (devir −700 + 700), 671 = −700.");
  note("  (a) kilit önce KALDIRILIR, sonra 30.11.2026 (dönem yeni kuralla yeniden dondurulur): fiş FAZLA → pencere PASİF, neden fiş numarasıyla 'kendi yılında ters kaydedin', satırda kendi yılı ipucu;");
  note("      ekrandan Ters Kaydet → Fiş 2027-000002 (01.01.2027) → pencere 'Düzeltilecek kural farkı yok.'; 2026: 602 alacak 700, 500 = 0, 671 = 0; 2027 net 0.");
  note("  TABANDA (tur 2e): (b) ön izleme 01.12.2026 B 671 700 / A 602 700 önerir; (a) ön izleme B 671 700 / A 500 700 önerir (S185 = A öncesi).");
  try {
    const old = await bootVersion("v2.4.9", { dataDir: src, backupDir: path.join(croot, "backups"), now: { time: "2026-10-20T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      await o.post("/api/workspace/bank/setup/dismiss", {});
      const a = await must("v2.4.9 cari", o.post("/api/workspace/accounts", { name: "Yürüyüş Müşteri A", type: "customer", registeredOn: "2026-09-01" }));
      await must("v2.4.9 700", o.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "700", date: "2026-10-02", note: "Açılış bakiyesi" }));
      await must("v2.4.9 kilit", o.put("/api/admin/period-lock", { lockedUntil: "2026-10-05" }));
      e700 = old.app.store.get("SELECT id FROM account_entries WHERE amount = 700")?.id;
      note(`  v2.4.9 verisi hazır (${old.commit?.slice(0, 10)}); 700 kaydı ${e700}`);
    } finally {
      await old.close();
    }
  } catch (e) {
    note(`HATA (C v2.4.9): ${e.stack || e}`);
    YARIDA.push(`[C] v2.4.9 verisi: ${String(e.message).split("\n")[0]}`);
  }
  for (const kol of ["b", "a"]) {
    if (!e700) break;
    const dst = path.join(croot, `data-${kol}`);
    fs.cpSync(src, dst, { recursive: true });
    const S = await bolumAc(`C${kol}`, { time: "2027-01-10T12:00:00+03:00", fixed: true }, { dataDir: dst });
    try {
      await Promise.race([S.app.ledger.snapshots?.runPending?.(), new Promise(r => setTimeout(r, 120000).unref())]).catch(() => null);
      const yil = async etiket => {
        const m26 = await mizan(S, "2026-01-01", "2026-12-31");
        const m27 = await mizan(S, "2027-01-01", "2027-12-31");
        const k = m => ["120", "500", "519", "602", "671", "681"].map(c => `${c} = ${m[c] ?? 0}`).join(", ");
        note(`  MİZAN (${etiket}) 2026: ${k(m26)} || 2027: ${k(m27)}`);
        note(`  DEFTER hareketi (canlı türetme) 2027: ${maddeler(S, e => e.date >= "2027-01-01").join(" || ") || "yok"}`);
        return { m26, m27 };
      };
      const pencere = async etiket => {
        await sistem(S);
        await page.click("#adm-rule-diff-open");
        await page.waitForSelector(`${TOP} [data-rule-diff-save]`, { timeout: 90000 });
        await page.waitForTimeout(700);
        const neden = await metin(`${TOP} [data-rule-diff-reason]`, 400);
        const sat = await metin(`${TOP} [data-rule-diff-lines]`, 500);
        const pasif = await page.locator(`${TOP} [data-rule-diff-save]`).isDisabled();
        const why = await metin(`${TOP} [data-rule-diff-save-why]`, 300);
        const fisler = await metin(`${TOP} [data-rule-diff-vouchers]`, 300);
        note(`  Kural Farkı penceresi (${etiket}): satırlar ${sat} · neden ${neden} · Fişi Kaydet pasif ${pasif} (${why}) · yazılmış fişler ${fisler}`);
        return { neden, sat, pasif, why, fisler };
      };
      await step(`C${kol}0 Güncel kod 10.01.2027: Yönetim › Sistem (karar öncesi)`, async () => {
        await sistem(S);
        await shot("sistem-once");
        await yazimTara("C Yönetim › Sistem");
      });
      await step(`C${kol}1 Açılış Olabilir Kayıtlar: 700 REDDET (ekrandan)`, async () => {
        await page.click("#adm-opening-review-open");
        await page.waitForSelector(`${TOP} [data-review-summary]`, { timeout: 60000 });
        await page.waitForTimeout(600);
        note(`  tablo: ${await metin(`${TOP} [data-review-table]`, 500)}`);
        await page.locator(`${TOP} [data-review-row="${e700}"] [data-review-decision="reject"]`).click();
        await page.waitForTimeout(900);
        await soruYanitla("ret", "onay sorusu olabilir");
        await shot("olabilir-ret");
        await closeAll();
        note(`  aday durumu (veri tabanı): ${JSON.stringify(S.app.store.all("SELECT amount, opening_review AS durum FROM account_entries"))}`);
      });
      await step(`C${kol}2 Dönem Kilidi 31.12.2026 (ekrandan) → Kural Farkı penceresi → Tab + Boşluk → Fişi Kaydet`, async () => {
        await kilitEkrandan(S, "2026-12-31");
        const p = await pencere("kilit 31.12.2026");
        uclu("C", `C${kol}2 ön izleme (kilit 31.12.2026)`, "01.01.2027 B 500 700 / A 671 700, etkin", `${p.sat} · pasif ${p.pasif}`, "—");
        await shot("kural-farki-31-12");
        await yazimTara("C Kural Farkı penceresi");
        await page.focus(`${TOP} [data-rule-diff-lines]`).catch(() => null);
        let ulasti = false;
        for (let i = 0; i < 80 && !ulasti; i += 1) {
          await page.keyboard.press("Tab");
          ulasti = await page.evaluate(() => document.activeElement?.matches?.("[data-rule-diff-confirm]") || false);
        }
        note(`  Tab ile onay kutusuna ulaşıldı: ${ulasti}`);
        if (ulasti) await page.keyboard.press("Space");
        else await page.check(`${TOP} [data-rule-diff-confirm]`);
        await page.waitForTimeout(400);
        await page.locator(`${TOP} [data-rule-diff-save]`).click();
        await page.waitForTimeout(2000);
        await soruYanitla("Fişi Kaydet", "soru beklenmiyor");
        await closeAll();
        const s = await sistem(S);
        await shot("sistem-fisten-sonra");
        const v = S.app.store.all("SELECT type, year, no, date, reversal_of AS tersOf FROM ledger_vouchers");
        uclu("C", `C${kol}2 fiş + Mutabakat satırı`, "Fiş 2027-000001 01.01.2027 · 'Düzeltildi (Fiş 2027-000001)'", s.mut.slice(0, 200), JSON.stringify(v));
        await yil("fişten sonra");
      });
      if (kol === "b") {
        await step("Cb3 (b) Dönem Kilidi DOĞRUDAN 30.11.2026 (ekrandan) → pencere + satır + mizan", async () => {
          await kilitEkrandan(S, "2026-11-30");
          const s = await sistem(S);
          await shot("sistem-kilit-30-11");
          const p = await pencere("kilit 30.11.2026 (b)");
          await shot("kural-farki-30-11-b");
          await closeAll();
          const { m26, m27 } = await yil("kilit 30.11 (b)");
          const g = await S.api.get("/api/admin/ledger/rule-diff-correction");
          uclu("C", "Cb3 pencere", "PASİF · 'Fişle düzeltilebilen fark kalmadı.' · satır yok", `pasif ${p.pasif} · ${p.why} · satırlar ${p.sat}`, `ön izleme ucu ${g.status} kod ${g.data?.code || g.data?.data?.code || "?"} satır ${JSON.stringify(g.data?.lines ?? g.data?.data?.lines ?? "?").slice(0, 120)}`);
          uclu("C", "Cb3 Mutabakat satırı", "'Düzeltildi (Fiş 2027-000001)'", s.mut.slice(0, 220), await mutabakat(S));
          uclu("C", "Cb3 mizan 2026: 602 · 671 / 2027 (devirli bakiye): 500 · 671", "0 · 0 / 0 · −700", "—", `${m26["602"] ?? 0} · ${m26["671"] ?? 0} / ${m27["500"] ?? 0} · ${m27["671"] ?? 0}`);
          note(`  fişler (veri tabanı): ${JSON.stringify(S.app.store.all("SELECT type, year, no, date, reversal_of AS tersOf FROM ledger_vouchers"))}`);
        });
      } else {
        await step("Ca3 (a) Kilidi KALDIR (ekrandan) → Kilit 30.11.2026 (ekrandan) → pencere + satır", async () => {
          await kilitEkrandan(S, "");
          await kilitEkrandan(S, "2026-11-30");
          const s = await sistem(S);
          await shot("sistem-kaldir-30-11");
          const p = await pencere("kaldır → 30.11.2026 (a)");
          await shot("kural-farki-30-11-a");
          const g = await S.api.get("/api/admin/ledger/rule-diff-correction");
          uclu("C", "Ca3 pencere", "PASİF · neden fiş numarasıyla '… kendi yılında ters kaydedin' · satır yok", `pasif ${p.pasif} · ${p.neden || p.why} · satırlar ${p.sat}`, `ön izleme ucu ${g.status} kod ${g.data?.code || g.data?.data?.code || "?"}`);
          uclu("C", "Ca3 Mutabakat satırı", "kendi yılı ipucu (Fiş 2027-000001 … kendi yılında … ters kaydedin)", s.mut.slice(0, 260), await mutabakat(S));
          await sistem(S);
          await page.click("#adm-rule-diff-open");
          await page.waitForSelector(`${TOP} [data-rule-diff-save]`, { timeout: 90000 });
          await page.waitForTimeout(600);
          const rv = await page.$(`${TOP} [data-rule-diff-reverse]`);
          if (!rv) throw new Error("Ters Kaydet düğmesi yok");
          await rv.click();
          await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 8000 });
          note(`  SORU (Ters Kaydet; beklenen soru var): ${await metin(TOP, 300)}`);
          await shot("ters-kaydet-sorusu");
          await page.click(`${TOP} [data-answer="yes"]`);
          await page.waitForTimeout(2000);
          await closeAll();
          note(`  fişler (veri tabanı): ${JSON.stringify(S.app.store.all("SELECT type, year, no, date, reversal_of AS tersOf FROM ledger_vouchers"))}`);
          const s2 = await sistem(S);
          const p2 = await pencere("ters kayıttan sonra (a)");
          await shot("kural-farki-ters-sonra");
          await closeAll();
          const { m26, m27 } = await yil("ters kayıttan sonra (a)");
          uclu("C", "Ca4 ters kayıt → pencere · satır", "Fiş 2027-000002 01.01.2027 · 'Düzeltilecek kural farkı yok.' · satır kalkar", `${p2.neden || p2.why} · ${p2.sat}`, s2.mut.slice(0, 200));
          uclu("C", "Ca4 mizan 2026: 602 · 500 · 671 / 2027 (devirli bakiye): 500 · 671 · 602", "−700 · 0 · 0 / 0 · 0 · −700 (devir)", "—", `${m26["602"] ?? 0} · ${m26["500"] ?? 0} · ${m26["671"] ?? 0} / ${m27["500"] ?? 0} · ${m27["671"] ?? 0} · ${m27["602"] ?? 0}`);
        });
      }
      await step(`C${kol}9 Hesap Planı Mizanı (Bu Yıl = 2027, ekran)`, async () => {
        await openReport(S, "Hesap Planı Mizanı");
        const rows = await raporSatir();
        for (const r of rows.slice(0, 20)) note(`    ${r}`);
        await shot("mizan-2027");
      });
    } catch (e) {
      note(`HATA (C${kol}): ${e.stack || e}`);
      YARIDA.push(`[C${kol}] bölüm: ${String(e.message).split("\n")[0]}`);
    } finally {
      await bolumKapat(S);
    }
  }
}

// =====================================================================================================================================================
// D — hız düzeltmesi: kalabalık carilerde cari kartı + Cari Listesi + Alacak Yaşlandırma değerleri (taban ↔ aday satır satır aynı olmalı)
// =====================================================================================================================================================
{
  const T = "2026-10-08";
  const S = await bolumAc("D", NOW_A);
  const dz = (...a) => D_OZET.push(a.join(" | "));
  try {
    note("\nBEKLENEN (D): taban ile aday AYNI (davranış eşdeğer hız düzeltmesi). Şüpheli caride bağlı tahsilat YOK (tur 3c kuralı tabanla bilerek farklı; burada yalnız bağsız).");
    await must("banka sihirbazını kapat", S.api.post("/api/workspace/bank/setup/dismiss", {}));
    const K = {};
    await step("D0 Kurulum (API; hacim için): K1 120 fatura + 60 tahsilat (30'u faturaya bağlı) + 10 Borç Yaz; K2 40 fatura + şüpheliye al 20.000 + 15 bağsız tahsilat; K3 sade", async () => {
      const t0 = Date.now();
      const mk = async (ad, typ = "customer") => (await must(`cari ${ad}`, S.api.post("/api/workspace/accounts", { name: ad, type: typ, registeredOn: gun(T, -420) }))).id;
      K.k1 = await mk("Kalabalık Müşteri");
      K.k2 = await mk("Kalabalık Şüpheli Müşteri");
      K.k3 = await mk("Sade Tedarikçi", "supplier");
      // Belge serileri tarih sırası ister: bütün işlemler önce listelenir, tarih sırasıyla (aynı günde fatura önce) yazılır.
      const ops = [];
      const inv1 = [];
      for (let i = 0; i < 120; i += 1) ops.push({ d: gun(T, -400 + i * 3), o: 0, run: async () => inv1.push((await must("fatura K1", S.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: K.k1, issueDate: gun(T, -400 + i * 3), lines: [{ name: "Hizmet", qty: 1, unitPrice: String(500 + ((i * 37) % 900)), vatRate: 20 }], payment: { rest: "open" } }))).id) });
      for (let i = 0; i < 40; i += 1) ops.push({ d: gun(T, -380 + i * 4), o: 0, run: () => must("fatura K2", S.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: K.k2, issueDate: gun(T, -380 + i * 4), lines: [{ name: "Hizmet", qty: 1, unitPrice: String(800 + ((i * 41) % 600)), vatRate: 20 }], payment: { rest: "open" } })) });
      // K1 tahsilatlarının yarısı faturaya bağlı: tahsilattan önce kesilmiş son K1 faturalarından biri.
      for (let i = 0; i < 60; i += 1) ops.push({ d: gun(T, -390 + i * 6), o: 1, run: () => must("tahsilat K1", S.api.post(`/api/workspace/accounts/${K.k1}/entries`, { kind: "in", amount: String(300 + ((i * 53) % 700)), date: gun(T, -390 + i * 6), method: i % 3 === 0 ? "bank" : "cash", cashForce: true, similarOk: true, ...(i % 2 === 0 && inv1.length ? { invoiceId: inv1[Math.max(0, inv1.length - 1 - (i % 4))] } : {}) })) });
      for (let i = 0; i < 10; i += 1) ops.push({ d: gun(T, -300 + i * 25), o: 1, run: () => must("borç yaz", S.api.post(`/api/workspace/accounts/${K.k1}/entries`, { kind: "debt", amount: String(150 + i * 10), date: gun(T, -300 + i * 25), note: `Borç ${i + 1}`, similarOk: true })) });
      ops.push({ d: gun(T, -200), o: 2, run: () => must("şüpheliye al", S.api.post(`/api/workspace/accounts/${K.k2}/doubtful`, { amount: "20000", date: gun(T, -200), reason: "lawsuit", note: "dava" })) });
      for (let i = 0; i < 15; i += 1) ops.push({ d: gun(T, -190 + i * 12), o: 1, run: () => must("tahsilat K2", S.api.post(`/api/workspace/accounts/${K.k2}/entries`, { kind: "in", amount: String(400 + i * 20), date: gun(T, -190 + i * 12), method: "cash", cashForce: true, similarOk: true })) });
      for (let i = 0; i < 8; i += 1) ops.push({ d: gun(T, -100 + i * 10), o: 1, run: () => must("alış", S.api.post(`/api/workspace/accounts/${K.k3}/entries`, { kind: "credit", amount: String(1000 + i * 100), date: gun(T, -100 + i * 10), note: `Alış ${i + 1}`, similarOk: true })) });
      ops.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : x.o - y.o));
      for (const op of ops) await op.run();
      note(`  kurulum ${Math.round((Date.now() - t0) / 1000)} sn · satır sayısı ${S.app.store.get("SELECT COUNT(*) AS n FROM account_entries").n}`);
    });
    await step("D1 Cari Listesi (ekran): bütün satırlar ve KPI", async () => {
      await anaEkran(S);
      const t0 = Date.now();
      await page.click('#hof-sidecard [data-action="accounts"]');
      await page.waitForSelector(`${accWin} .hof-acc-table tbody tr[data-account]`, { timeout: 30000 });
      await page.waitForTimeout(800);
      note(`  Cari Listesi açılış ~${Date.now() - t0} ms (bilgi; ölçüm değil)`);
      const kpi = await metin(`${accWin} .hof-plans-kpis`, 500);
      dz("CARİ LİSTESİ KPI", kpi);
      const rows = await page.$$eval(`${accWin} .hof-acc-table tbody tr[data-account]`, rs => rs.map(r => [...r.querySelectorAll("td")].map(td => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")));
      for (const r of rows) dz("CARİ LİSTESİ", r);
      note(`  KPI: ${kpi}`);
      for (const r of rows) note(`    ${r}`);
      await shot("cari-listesi");
      await yazimTara("D1 Cari Listesi");
    });
    for (const [k, ad] of [["k1", "Kalabalık Müşteri"], ["k2", "Kalabalık Şüpheli Müşteri"], ["k3", "Sade Tedarikçi"]]) {
      await step(`D2 Cari kartı: ${ad} (KPI, şüpheli bölümü, hareketlerin hepsi)`, async () => {
        const t0 = Date.now();
        await cariKart(S, K[k]);
        note(`  kart açılış ~${Date.now() - t0} ms (bilgi)`);
        await page.waitForFunction(() => !/Yükleniyor/.test(document.querySelector(".hof-accounts-modal [data-acc-invoices]")?.textContent || ""), null, { timeout: 30000 }).catch(() => null);
        await page.waitForTimeout(600);
        dz(`KART ${ad} KPI`, await metin(`${accWin} .hof-plans-kpis`, 600));
        dz(`KART ${ad} ŞÜPHELİ`, await metin(`${accWin} [data-doubtful-list]`, 600));
        const rows = await page.$$eval(`${accWin} .hof-plans-entries tr`, rs => rs.map(r => [...r.querySelectorAll("th,td")].map(td => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")));
        for (const r of rows) dz(`KART ${ad} HAREKET`, r);
        const inv = await page.$$eval(`${accWin} [data-acc-invoices] tr`, rs => rs.map(r => r.textContent.replace(/\s+/g, " ").trim())).catch(() => []);
        for (const r of inv) dz(`KART ${ad} FATURA`, r);
        const det = await must("cari", S.api.get(`/api/workspace/accounts/${K[k]}`));
        dz(`API ${ad}`, JSON.stringify(det.totals ?? det.summary ?? det.balance ?? null), JSON.stringify(det.doubtful ?? null).slice(0, 300));
        note(`  KPI: ${await metin(`${accWin} .hof-plans-kpis`, 400)} · hareket satırı ${rows.length} · fatura satırı ${inv.length}`);
        await shot(`kart-${k}`);
      });
    }
    await step("D3 Cari Listesi ve Bakiyeler + Alacak Yaşlandırma (rapor; ekran + API)", async () => {
      for (const ad of ["Cari Listesi ve Bakiyeler", "Alacak Yaşlandırma"]) {
        const id = await openReport(S, ad);
        const rows = await raporSatir();
        for (const r of rows) dz(`RAPOR ${ad}`, r);
        const d = await raporApi(S, id);
        dz(`RAPOR-API ${ad} özet`, JSON.stringify(d.summary || []));
        for (const r of rows) note(`    ${r.slice(0, 230)}`);
        await shot(`rapor-${id}`);
      }
      dz("MUTABAKAT", await mutabakat(S));
    });
  } catch (e) {
    note(`HATA (D): ${e.stack || e}`);
    YARIDA.push(`[D] bölüm: ${String(e.message).split("\n")[0]}`);
  } finally {
    await bolumKapat(S);
  }
}

await browser.close();
for (const r of roots) if (r.startsWith(tmpdir())) fs.rmSync(r, { recursive: true, force: true });
fs.writeFileSync(path.join(OUT, "d-ozet.txt"), `${D_OZET.join("\n")}\n`);
fs.writeFileSync(path.join(OUT, "uclu.tsv"), `${UCLU.map(r => r.join("\t")).join("\n")}\n`);
note("\n==================== ÖZET ====================");
note(`ÜÇLÜ satırı: ${UCLU.length} (uclu.tsv) · D özeti: ${D_OZET.length} satır (d-ozet.txt)`);
note(`ADIM YARIDA (${YARIDA.length}):`);
for (const y of YARIDA) note(`  - ${y}`);
note(`YAZIM DÜZENİ ADAYLARI (${YAZIM.size}; elle bakılır):`);
for (const y of YAZIM) note(`  - ${y}`);
process.exitCode = YARIDA.length ? 2 : 0;
