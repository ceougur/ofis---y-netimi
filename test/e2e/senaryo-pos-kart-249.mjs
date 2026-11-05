// 2.4.9 P1 — müşteri carisinde POS tahsilatı: kredi kartı seçicisi tahsilat formuna yalnız "Kredi Kartına İade" kutusuyla gelir (tasarım notu
// docs/2.4.9-tasarim/P1-pos-tahsilat-kart.md §6, T1–T10). 2.4.3 C13 müşteride kutuyu kaldırmıştı; kart seçicisi kalınca kutusuz form "ödeme formu"
// sayılıyordu: şirkette 2+ kredi kartı varken müşteriden POS tahsilatı ekrandan girilemiyor, düzeltilemiyordu ("Kredi Kartı" zorunlu; seçilirse
// sunucu 400). 0/1 kartta formda yanlış metin ("Kredi Kartı Tanımla" / "… kredi kartına yazılır", kart bakiye önizlemesi).
// Şirkette 0, 1 ve 2 kredi kartı (her biri ayrı veri klasörü), bir vadesiz hesap (Ziraat), bir POS. Her kart sayısında EKRANDAN (gerçek tıklama,
// insan hızında yazım; T9 klavye ile Tab + ok tuşları — ders 12):
//   T3/T4 müşteri + Tahsilat, yol POS: kart seçici yok, "Kredi Kartı Tanımla" / "kredi kartına yazılır" yok, POS alanı var.
//   T1    müşteri POS tahsilatı 500 → yanıt 200, satır POS'a (fin_ref = POS), pos_sales satışı 50000, POS Bekleyen +500, kartlar ve Kasa değişmez.
//   T9    yol sırası Nakit → POS → Havale / EFT → POS (klavye): gönderilen gövdede bankAccountId / cardAccountId / cardRefund yok, POS alanları var.
//   T2    müşteri POS tahsilatının düzeltmesi ✎ 700 → 650 → satır 650 POS'ta, POS satışı 65000, POS Bekleyen −50.
//   T8    tedarikçi − Ödeme Kredi Kartı 300 → 0 kart: hesapsız; 1: kart 1; 2: seçilen kart 2 (kart borcu +300).
//   T6    tedarikçi + Tahsilat "Kredi Kartına İade" 100 → 0 kart: 400 (kart gerekir), satır yok; 1/2: seçilen kart, POS satışı yok, kart borcu −100.
//   T7    tedarikçi + Tahsilat, kutu işaretsiz 50 → POS.
//   T5    (1 ve 2 kart; gerileme koruması) müşteride eski "Kredi Kartına İade" satırı ✎ 120 → 110: kutu işaretli, kart seçici görünür (2 kartta satırın
//         kartı seçili), gönderilen gövdede cardRefund true (2 kartta seçilen kart; dar kontrol DÜŞÜK-2), kayıt aynı karta, kart etkisi 110/120. Satır API ile
//         kartla ödeme varken girilir, ödeme sonra silinir (2.4.9 P1-b: yeni iade yalnız kartla ödemeli müşteride) — kutu satırdan ötürü kalır; yeni Tahsilat'ta yok.
//   T12   (P1 tur 1, DÜŞÜK-1) aynı satır ✎ kutu kaldırılır → PUT 200, gövde cardRefund false + POS alanları; satır POS'a, etkin POS satışı 110, kart etkisi geri,
//         POS Bekleyen +110, cari bakiyesi aynı, bildirim "Hareket düzeltildi"; yeniden açılınca kutu yok.
//   T11   (P1-b, kullanıcı kararı 03.11.2026) aynı adlı ikinci müşteri "ABC Ltd." (ayrı Cari No): − Ödeme Kredi Kartı 400 → + Tahsilat'ta kutu görünür (1/2 kart; 0 kartta
//         ödeme hesapsızdır, kutu yok); işaretlenince kart seçicisi (2 kartta zorunlu, Bonus seçilir), açıklama "Müşteri parayı kredi kartımıza iade etti";
//         150 → 200, satır seçilen karta, POS satışı yok, kart borcu −150, POS Bekleyen ve Kasa aynı. Birinci "ABC Ltd."de aynı anda kutu yok.
//   T13   (DÜŞÜK-1) T11 satırı ✎ kutu kaldırılır + yol Nakit → satır nakit, Kasa +150, kart etkisi geri.
//   T10   Banka → POS → POS İşlemleri → İade 100 (T1 satışı) → 200, iade 10000, POS Bekleyen −100.
//   T14   (2 kart; DÜŞÜK-1, 2 POS) ikinci POS eklenir; kartla ödemeli müşterinin iade satırı ✎ kutu kaldırılır, POS2 seçilir → PUT 200, satır POS2'de (önceden
//         400 "POS yalnız tahsilatta ve POS iadesinde kullanılır…").
//   T16   (0 kart; P1 tur 2 DÜŞÜK-1) tedarikçinin T7 POS satırı ✎ "Kredi Kartına İade" işaretlenir → PUT 400 "Kredi Kartına İade için etkin bir kredi kartı hesabı
//         gerekir", form açık kalır, satır POS'ta, POS satışı ve POS Bekleyen aynı (önceden 200: satır sessizce hesapsıza — 108 — yazılıyordu).
//   T15   (P1 tur 2 TEST-1) üçüncü müşteri "Deniz Ltd.": POS tahsilatı 200 + cari POS İadesi 50 (POS'a bağlı çıkış) → hasCardPayment false, + Tahsilat'ta kutu yok,
//         API'den Kredi Kartına İade 400 card-refund-no-payment.
//   UI-A1 (2.4.9 UI tur A, ORTA-1; 1/2 kart) cari kartının Hareketler listesinde "Kredi Kartına İade" satırının yol etiketi "Kredi Kartına İade" (önceden
//         "POS"), POS tahsilatı "POS", kartla ödeme "Kredi Kartı" — tedarikçide (T6) ve kartla ödemeli müşteride (P1-b); bakiye değişmez.
//   UI-A2 (2.4.9 UI tur A, ORTA-2; 0 kart) T6 ve T16: "Kredi Kartına İade" işaretliyken kart yoksa seçicide "Kredi Kartına İade için önce bir kredi kartı
//         tanımlayın." + Kredi Kartı Tanımla; "Tanımlamadan kaydederseniz … Hesabı Atanmamış …" YOK; kaydet düğmesi pasif, nedeni düğmenin üstünde yazılı;
//         tıklama / Enter istek göndermez, satır değişmez (önceden istek gidip 400 dönüyordu); kutu kaldırılınca düğme etkin. Sunucu API'de yine 400.
//         T8 (kartla ÖDEME, 0 kart): "Tanımlamadan kaydederseniz …" notu ve hesapsız yazım AYNEN (değişmez).
// Her adımda yanıt kodu + gövde, veri tabanındaki satır (hangi hesap), bakiyeler (cari, kartlar, POS Bekleyen, Kasa) ve Mutabakat Testi (ders 3).
// Pencere seçicisi en üstteki görünür pencere (ders 39); pencere kapatma escClose ile, soru beklentisiyle (ders 34). Sahte saat 08.10.2026 (ders 13);
// lisans servisi ölü adres (ders 30). Çalıştırma: npm run test:senaryo-pos-kart-249 — çıkış: "N geçti, M kaldı" (kaldıysa 1).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-pos-kart-249");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const BANK = "/api/workspace/bank";
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:nth-last-child(1 of ${modal})`;
const form = `${top} .hof-form`;
const accWin = `${modal} .hof-accounts-modal`;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const browser = await chromium.launch();
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};

async function phase(CARDS) {
  console.log(`\n══════ Şirkette ${CARDS} kredi kartı ══════`);
  const root = mkdtempSync(path.join(tmpdir(), `destekofis-pos-kart-249-${CARDS}-`));
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, maxCompanies: 2, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f42" } });
  const { port } = await app.listen(0, "127.0.0.1");
  const BASE = `http://127.0.0.1:${port}`;
  const api = createClient(BASE);
  const ctx = {};
  let page = null;
  let shotNo = 0;
  const pause = ms => page.waitForTimeout(ms);
  const shot = async name => {
    shotNo += 1;
    await page.screenshot({ path: path.join(OUT, `kart${CARDS}-${String(shotNo).padStart(2, "0")}-${name}.png`) }).catch(() => null);
  };
  const textOf = sel => page.$eval(sel, n => n.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
  const typeInto = async (sel, value) => {
    await page.click(sel);
    await page.fill(sel, "");
    await page.type(sel, value, { delay: 60 });
  };
  // Pencereleri kapatır: kaydedilmiş/görüntüleme penceresinde soru beklenmez (soru-yok); temizlikte (adım yarıda) beklenti yok, soru günlüğe yazılır.
  const closeAll = async (expect = "soru-yok", step = "") => {
    for (let i = 0; i < 8 && (await page.$(modal)); i += 1) {
      await escClose(page, { expect, step });
      await pause(300);
    }
  };
  const entries = accountId => app.store.all("SELECT id, kind, amount, method, fin_ref AS finRef FROM account_entries WHERE account_id = ? ORDER BY rowid", accountId);
  const entryRow = id => app.store.get("SELECT id, kind, amount, method, fin_ref AS finRef FROM account_entries WHERE id = ?", id);
  const posRows = () => app.store.all("SELECT id, event_id AS eventId, pos_id AS posId, kind, gross_minor AS gross, auth_code AS authCode, status FROM pos_sales ORDER BY rowid");
  const refName = id => (!id ? "(hesapsız)" : id === ctx.pos?.id ? "POS" : id === ctx.pos2?.id ? "POS2" : id === ctx.kk1?.id ? "KART1" : id === ctx.kk2?.id ? "KART2" : id === ctx.ziraat?.id ? "ZIRAAT" : id);
  const eventOf = id => app.store.get("SELECT event_id AS eventId FROM account_entries WHERE id = ?", id)?.eventId || "";
  const activeSalesOf = id => posRows().filter(p => p.eventId && p.eventId === eventOf(id) && p.status === "active");
  const balanceOf = async id => (id ? (await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor : null);
  const balances = async () => {
    const summary = await must("banka özeti", api.get(`${BANK}/summary`));
    const cash = await must("Kasa", api.get("/api/workspace/cash"));
    return {
      musteri: (await must("müşteri", api.get(`/api/workspace/accounts/${ctx.abc.id}`))).totals.balance,
      musteri2: (await must("müşteri 2", api.get(`/api/workspace/accounts/${ctx.abc2.id}`))).totals.balance,
      tedarikci: (await must("tedarikçi", api.get(`/api/workspace/accounts/${ctx.sup.id}`))).totals.balance,
      kart1: await balanceOf(ctx.kk1?.id),
      kart2: await balanceOf(ctx.kk2?.id),
      posBekleyen: summary.posPending?.grossMinor ?? 0,
      kasa: cash.byMethod?.cash ?? null,
    };
  };
  const integrity = async label => {
    const r = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    const bad = (r.checks || []).filter(c => !c.ok).map(c => c.code);
    ok(r.ok !== false && bad.length === 0, `${label}: Mutabakat Testi tamam${bad.length ? ` — ${bad.join(", ")}` : ""}`);
  };
  const posts = [];
  const step = async (title, fn) => {
    console.log(`\n■ [${CARDS} kart] ${title}`);
    try {
      await fn();
    } catch (error) {
      failed += 1;
      console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
      await shot("hata");
      await closeAll("", `temizlik: ${title}`).catch(() => null);
    }
  };
  const openEntry = async (accountId, which) => {
    await page.evaluate(id => HOF.accounts.open(id), accountId);
    await page.waitForSelector(`${accWin} [data-entry="${which}"]`, { timeout: 15000 });
    await pause(400);
    await page.click(`${accWin} [data-entry="${which}"]`);
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 10000 });
    await pause(700);
  };
  const openEdit = async (accountId, entryId) => {
    await page.evaluate(id => HOF.accounts.open(id), accountId);
    await page.waitForSelector(`${accWin} [data-edit-entry="${entryId}"]`, { timeout: 15000 });
    await pause(400);
    await page.click(`${accWin} [data-edit-entry="${entryId}"]`);
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 10000 });
    await pause(900);
  };
  const chooseMethod = async value => {
    await page.click(`${form} select[name="method"]`);
    await page.selectOption(`${form} select[name="method"]`, value);
    await pause(800);
  };
  // Kaydedilmeyen form (yalnız bakılan): klavyeyle yazılan tutar kullanıcı girdisidir → "Kaydedilmemiş Değişiklik" sorusu beklenir, "Kaydetmeden Kapat" (ders 34).
  // Esc'ten önce tutar alanına tıklanır: açık kalan yol listesini (select) kapatan Esc pencereyi kapatmayı boşa düşürmesin.
  const dropDraft = async label => {
    await page.click(`${form} input[name="amount"]`);
    await pause(200);
    await escClose(page, { expect: "soru-var", step: label });
    await pause(300);
    await closeAll("soru-yok", `${label} sonrası`);
  };
  // Formun kart / POS alanlarının durumu (görünür = ekranda ve gizli bir atanın içinde değil).
  const formState = () =>
    page.evaluate(f => {
      const root = document.querySelector(f);
      const vis = n => Boolean(n && n.getClientRects().length) && !n.closest("[hidden]");
      const cardBox = root?.querySelector('[data-bank-pick="card"]');
      const cardSel = cardBox?.querySelector("select");
      const pos = root?.querySelector("[data-pos-pick]");
      const refund = root?.querySelector('input[name="cardRefund"]');
      const all = (root?.innerText || "").replace(/\s+/g, " ");
      return {
        refundBox: refund ? (vis(refund) ? "görünür" : "gizli") : "yok",
        refundChecked: refund ? refund.checked : null,
        cardPicker: cardBox ? (vis(cardBox) ? "görünür" : "gizli") : "yok",
        cardText: cardBox ? cardBox.innerText.replace(/\s+/g, " ").trim().slice(0, 200) : "",
        cardValue: cardSel ? cardSel.value : null,
        cardRequired: cardSel ? cardSel.required : null,
        pos: pos ? (vis(pos) ? "görünür" : "gizli") : "yok",
        posText: pos ? pos.innerText.replace(/\s+/g, " ").trim().slice(0, 160) : "",
        defineCard: /Kredi Kartı Tanımla/.test(all),
        writesToCard: /kredi kartına yazılır/.test(all),
        help: (root?.closest(".hof-modal")?.querySelector(".hof-modal-text")?.innerText || "").replace(/\s+/g, " ").trim(),
      };
    }, form);
  // Gönder: yanıtı (yoksa formdaki hata yazısını) bekler; kaydedilince form kapanır.
  const submit = async label => {
    const mark = posts.length;
    await page.click(`${form} button[type="submit"]`);
    for (let i = 0; i < 30 && posts.length === mark; i += 1) {
      await pause(150);
      if (await textOf(`${form} .hof-form-error`)) break;
    }
    await pause(posts.length > mark ? 900 : 300);
    const res = posts[posts.length - 1] && posts.length > mark ? posts[posts.length - 1] : null;
    const formError = await textOf(`${form} .hof-form-error`);
    let sent = {};
    try {
      sent = JSON.parse(res?.sent || "{}");
    } catch {}
    console.log(`  · ${label}: ${res ? `${res.method} ${res.status} gövde ${res.sent.slice(0, 220)} → ${res.body.slice(0, 160)}` : "İSTEK YOK"}${formError ? ` · form hatası “${formError}”` : ""}`);
    return { res, status: res?.status ?? 0, sent, formError, open: Boolean(await page.$(form)) };
  };
  const why = r => (r.res ? `${r.status} ${r.res.body.slice(0, 160)}` : `istek yok, form hatası “${r.formError}”`);
  // 2.4.9 UI tur A (ORTA-2): kaydet düğmesinin durumu ve pasif nedeni (düğmenin üstündeki yazı).
  const blockState = () =>
    page.evaluate(f => {
      const root = document.querySelector(f);
      const button = root?.querySelector('button[type="submit"]');
      const note = root?.querySelector("[data-card-refund-block]");
      return { disabled: Boolean(button?.disabled), label: (button?.textContent || "").trim(), note: note && note.getClientRects().length ? note.textContent.replace(/\s+/g, " ").trim() : "", described: button?.getAttribute("aria-describedby") || "" };
    }, form);
  // 2.4.9 UI tur A (ORTA-1): cari kartının Hareketler listesindeki yol etiketleri (satır türü, açıklama, etiket, iade işareti).
  const ledgerTags = async accountId => {
    await page.evaluate(id => HOF.accounts.open(id), accountId);
    await page.waitForSelector(`${accWin} .hof-method-tag`, { timeout: 15000 });
    await pause(400);
    return page.$$eval(`${accWin} tr`, rows =>
      rows
        .map(row => ({ note: (row.querySelector("td small")?.textContent || "").trim(), label: (row.querySelector("td b")?.childNodes[0]?.textContent || "").trim(), tag: (row.querySelector(".hof-method-tag")?.textContent || "").trim(), refund: Boolean(row.querySelector(".hof-method-tag[data-card-refund]")) }))
        .filter(row => row.tag),
    );
  };
  // 2.4.9 P1 tur 1: son bildirim (kaydedince "… kaydedildi" / "Hareket düzeltildi. Bakiye …").
  // Önceki bildirimlerin metni saklanır; kaydetten sonra yalnız YENİ ya da yinelenen (aynı metin, "×2" sayacı artan — HOF.toast ikiz bildirimi yeniden
  // açmaz, sayacını artırır) bildirim okunur. Değişmeyen eski bildirim sayılmaz.
  const markToasts = () => page.$$eval("#hof-toasts .hof-toast", nodes => nodes.forEach(node => (node.dataset.eski = node.textContent))).catch(() => null);
  const newToast = () => page.$$eval("#hof-toasts .hof-toast", nodes => (nodes.filter(node => node.dataset.eski !== node.textContent).at(-1)?.textContent || "").replace(/\s+/g, " ").trim()).catch(() => "");
  const eyebrow = () => textOf(`${top} .hof-eyebrow`);
  const moneyText = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));

  try {
    await api.login("admin", PASS);
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    ctx.abc = await must("müşteri", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    ctx.sup = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
    // 2.4.9 P1-b: aynı adlı ikinci müşteri (kartla ödeme yalnız buna yapılır; kutu cari bazında).
    ctx.abc2 = await must("müşteri 2", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    ctx.ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", usePos: true, useCard: true, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    ctx.pos = (await must("POS", api.post(`${BANK}/pos`, { name: "Ziraat Fiziki POS", bankAccountId: ctx.ziraat.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }] }))).pos;
    if (CARDS >= 1) ctx.kk1 = await must("kart 1", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "World", kind: "card", parentId: ctx.ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
    if (CARDS >= 2) ctx.kk2 = await must("kart 2", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Bonus", kind: "card", parentId: ctx.ziraat.id, creditLimit: "30.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
    const cardOf = CARDS === 2 ? ctx.kk2 : CARDS === 1 ? ctx.kk1 : null;
    const cardKey = CARDS === 2 ? "kart2" : "kart1";

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    page = await context.newPage();
    page.on("pageerror", e => {
      failed += 1;
      console.log(`  ✗ sayfa hatası: ${e.message}`);
    });
    page.on("response", async res => {
      const req = res.request();
      if (req.method() === "GET" || !/\/api\/workspace\/(accounts\/[^/?]+\/entries|bank\/pos\/sales\/[^/?]+\/refund)/.test(res.url())) return;
      let body = "";
      try {
        body = await res.text();
      } catch {}
      posts.push({ method: req.method(), status: res.status(), sent: req.postData() || "", body });
    });
    await installPageClock(page, app.config.now);
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await pause(800);

    let t1Sale = null;
    await step("T1 + T3/T4 müşteri + Tahsilat 500, yol POS", async () => {
      await openEntry(ctx.abc.id, "in");
      await typeInto(`${form} input[name="amount"]`, "500");
      await chooseMethod("card");
      const f = await formState();
      ok(f.refundBox === "yok", `müşteride "Kredi Kartına İade" kutusu yok (${f.refundBox})`);
      ok(f.cardPicker === "yok", `müşteri POS tahsilatında kredi kartı seçicisi yok (${f.cardPicker}${f.cardText ? `: “${f.cardText}”` : ""})`);
      ok(!f.defineCard, `"Kredi Kartı Tanımla" yazmıyor (T4)${f.defineCard ? `: “${f.cardText}”` : ""}`);
      ok(!f.writesToCard, `"… kredi kartına yazılır" yazmıyor (T3)${f.writesToCard ? `: “${f.cardText}”` : ""}`);
      ok(f.pos === "görünür" && /Ziraat Fiziki POS POS'una yazılır/.test(f.posText), `POS alanı görünür: “${f.posText.slice(0, 60)}”`);
      ok(/seçilen POS'a yazılır/.test(f.help), `açıklama POS'a göre: “${f.help.slice(0, 70)}”`);
      await typeInto(`${form} input[name="authCode"]`, `T1K${CARDS}`);
      await shot("t1-form");
      const before = { n: entries(ctx.abc.id).length, pos: posRows().length, bal: await balances() };
      const r = await submit("T1 kaydet");
      ok(r.status === 200 && !r.open, `T1 kaydedildi (yanıt 200, form kapandı): ${why(r)}`);
      ok(!("bankAccountId" in r.sent) && !("cardAccountId" in r.sent) && !("cardRefund" in r.sent), `gövdede hesap / kart / kutu alanı yok: ${JSON.stringify(r.sent)}`);
      const fresh = entries(ctx.abc.id).slice(before.n);
      ok(fresh.length === 1 && fresh[0].kind === "in" && fresh[0].method === "card" && Math.abs(fresh[0].amount - 500) < 0.001 && fresh[0].finRef === ctx.pos.id, `veri tabanında 1 satır: ${JSON.stringify(fresh.map(e => ({ ...e, hesap: refName(e.finRef) })))}`);
      const sales = posRows().slice(before.pos);
      t1Sale = sales[0] || null;
      ok(sales.length === 1 && sales[0].kind === "sale" && sales[0].gross === 50000 && sales[0].posId === ctx.pos.id && sales[0].authCode === `T1K${CARDS}`, `POS satışı 50000 kuruş: ${JSON.stringify(sales)}`);
      const after = await balances();
      ok(after.posBekleyen - before.bal.posBekleyen === 50000, `POS Bekleyen +500 (${before.bal.posBekleyen} → ${after.posBekleyen})`);
      ok(Math.abs(after.musteri - (before.bal.musteri - 500)) < 0.001, `müşteri bakiyesi −500 (${before.bal.musteri} → ${after.musteri})`);
      ok(after.kart1 === before.bal.kart1 && after.kart2 === before.bal.kart2, `kartlar değişmedi (kart1 ${before.bal.kart1} → ${after.kart1}, kart2 ${before.bal.kart2} → ${after.kart2})`);
      ok(after.kasa === before.bal.kasa, `Kasa değişmedi (${before.bal.kasa} → ${after.kasa})`);
      await integrity("T1");
      await shot("t1-sonra");
      await closeAll(r.open ? "" : "soru-yok", "T1 sonrası");
    });

    await step("T9 müşteri + Tahsilat 250, yol klavyeyle Nakit → POS → Havale / EFT → POS", async () => {
      await openEntry(ctx.abc.id, "in");
      for (const ch of "250") await page.keyboard.type(ch, { delay: 60 });
      await page.keyboard.press("Tab");
      await pause(200);
      ok((await page.evaluate(() => document.activeElement?.name)) === "method", "Tab ile Tahsilat Yolu alanına geçildi");
      const methodNow = () => page.$eval(`${form} select[name="method"]`, n => n.value);
      const seen = [await methodNow()];
      const press = async key => {
        await page.keyboard.press(key);
        await pause(500);
        seen.push(await methodNow());
      };
      await press("ArrowDown");
      await press("ArrowDown");
      const firstPos = await formState();
      await press("ArrowUp");
      const onBank = await formState();
      await press("ArrowDown");
      const f = await formState();
      ok(seen.join(">") === "cash>bank>card>bank>card", `yol sırası klavyeyle: ${seen.join(" > ")}`);
      ok(firstPos.cardPicker === "yok" && f.cardPicker === "yok", `ilk ve son POS'ta kart seçicisi yok (${firstPos.cardPicker} / ${f.cardPicker})`);
      ok(onBank.pos !== "görünür" && onBank.cardPicker === "yok", `Havale / EFT'de POS alanı gizli (${onBank.pos}), kart seçicisi yok (${onBank.cardPicker})`);
      ok(f.pos === "görünür", `son POS'ta POS alanı görünür (${f.pos})`);
      await page.click(`${form} input[name="authCode"]`);
      for (const ch of `T9K${CARDS}`) await page.keyboard.type(ch, { delay: 60 });
      const before = { n: entries(ctx.abc.id).length, pos: posRows().length };
      const r = await submit("T9 kaydet");
      ok(r.status === 200 && !r.open, `T9 kaydedildi: ${why(r)}`);
      ok(!("bankAccountId" in r.sent) && !("cardAccountId" in r.sent) && r.sent.method === "card" && r.sent.posInstallments === "1" && r.sent.authCode === `T9K${CARDS}`, `gövde: hesap alanı yok, POS alanları var — ${JSON.stringify(r.sent)}`);
      const fresh = entries(ctx.abc.id).slice(before.n);
      ok(fresh.length === 1 && fresh[0].finRef === ctx.pos.id && Math.abs(fresh[0].amount - 250) < 0.001, `satır POS'a 250: ${JSON.stringify(fresh.map(e => ({ ...e, hesap: refName(e.finRef) })))}`);
      ok(posRows().length - before.pos === 1, `POS satışı +1 (${before.pos} → ${posRows().length})`);
      await integrity("T9");
      await closeAll(r.open ? "" : "soru-yok", "T9 sonrası");
    });

    await step("T2 müşteri POS tahsilatının düzeltmesi ✎ 700 → 650", async () => {
      const created = await api.post(`/api/workspace/accounts/${ctx.abc.id}/entries`, { kind: "in", method: "card", amount: "700", date: TODAY, posId: ctx.pos.id, authCode: `T2K${CARDS}` });
      ok(created.status === 200, `API ile 700 POS tahsilatı: ${created.status}`);
      const row = entries(ctx.abc.id).find(e => Math.abs(e.amount - 700) < 0.001);
      ok(row && row.finRef === ctx.pos.id, `satır POS'ta: ${JSON.stringify(row)}`);
      const sale = posRows().find(p => p.authCode === `T2K${CARDS}`);
      const before = await balances();
      await openEdit(ctx.abc.id, row.id);
      const f = await formState();
      ok(f.cardPicker === "yok" && f.refundBox === "yok" && !f.defineCard && !f.writesToCard, `düzeltme formunda kart seçicisi / kutu / kart metni yok (${f.cardPicker}, ${f.refundBox}${f.cardText ? `: “${f.cardText}”` : ""})`);
      ok(f.pos === "görünür", `POS alanı görünür (${f.pos})`);
      await typeInto(`${form} input[name="amount"]`, "650");
      const r = await submit("T2 kaydet");
      ok(r.status === 200 && !r.open && r.res?.method === "PUT", `T2 düzeltildi: ${r.res?.method || ""} ${why(r)}`);
      const now = entryRow(row.id);
      ok(Math.abs(now.amount - 650) < 0.001 && now.finRef === ctx.pos.id && now.method === "card", `satır 650 POS'ta: ${JSON.stringify({ ...now, hesap: refName(now.finRef) })}`);
      // Düzeltme eski POS satışını geçersiz (void) sayar, yeni tutarla etkin satış yazar.
      const active = posRows().filter(p => p.authCode === `T2K${CARDS}` && p.kind === "sale" && p.status === "active");
      ok(active.length === 1 && active[0].gross === 65000 && posRows().find(p => p.id === sale?.id)?.status === "void", `etkin POS satışı 65000, eski 70000 geçersiz: ${JSON.stringify(posRows().filter(p => p.authCode === `T2K${CARDS}`))}`);
      const after = await balances();
      ok(after.posBekleyen - before.posBekleyen === -5000, `POS Bekleyen −50 (${before.posBekleyen} → ${after.posBekleyen})`);
      ok(Math.abs(after.musteri - (before.musteri + 50)) < 0.001, `müşteri bakiyesi +50 (${before.musteri} → ${after.musteri})`);
      ok(after.kart1 === before.kart1 && after.kart2 === before.kart2 && after.kasa === before.kasa, "kartlar ve Kasa değişmedi");
      await integrity("T2");
      await closeAll(r.open ? "" : "soru-yok", "T2 sonrası");
    });

    await step("T8 tedarikçi − Ödeme 300, Kredi Kartı", async () => {
      await openEntry(ctx.sup.id, "out");
      await typeInto(`${form} input[name="amount"]`, "300");
      await chooseMethod("card");
      const f = await formState();
      if (CARDS === 0) {
        ok(f.cardPicker === "görünür" && f.defineCard, `0 kart: "Kredi Kartı Tanımla" görünür (${f.cardPicker}: “${f.cardText}”)`);
        // UI-A2: kartla ÖDEME formu değişmez — not aynen, düğme etkin (kayıt hesapsız yazılır).
        const blk = await blockState();
        ok(/Tanımlamadan kaydederseniz hareket Hesabı Atanmamış Eski Hareketler'de kalır\./.test(f.cardText) && !blk.disabled && !blk.note, `ödeme formunda not aynen (“${f.cardText}”), düğme etkin (${!blk.disabled})`);
      }
      if (CARDS === 1) ok(f.cardPicker === "görünür" && /World kredi kartına yazılır|World/.test(f.cardText) && f.cardValue === null, `1 kart: bilgi satırı (“${f.cardText.slice(0, 60)}”)`);
      if (CARDS === 2) {
        ok(f.cardPicker === "görünür" && f.cardRequired === true, `2 kart: zorunlu kart seçicisi görünür (${f.cardPicker}, zorunlu ${f.cardRequired})`);
        await page.selectOption(`${form} select[name="cardAccountId"]`, ctx.kk2.id);
        await pause(400);
      }
      const before = { n: entries(ctx.sup.id).length, bal: await balances() };
      const r = await submit("T8 kaydet");
      ok(r.status === 200 && !r.open, `T8 kaydedildi: ${why(r)}`);
      const fresh = entries(ctx.sup.id).slice(before.n);
      const want = CARDS === 0 ? "" : cardOf.id;
      ok(fresh.length === 1 && fresh[0].kind === "out" && fresh[0].method === "card" && (fresh[0].finRef || "") === want, `satır ${refName(want)}: ${JSON.stringify(fresh.map(e => ({ ...e, hesap: refName(e.finRef) })))}`);
      const after = await balances();
      if (CARDS > 0) ok(Math.abs(after[cardKey] - before.bal[cardKey]) === 30000, `${cardKey} 300 değişti (${before.bal[cardKey]} → ${after[cardKey]})`);
      if (CARDS === 2) ok(after.kart1 === before.bal.kart1, `kart1 değişmedi (${after.kart1})`);
      ok(after.posBekleyen === before.bal.posBekleyen && after.kasa === before.bal.kasa, "POS Bekleyen ve Kasa değişmedi");
      ctx.payEffect = CARDS > 0 ? after[cardKey] - before.bal[cardKey] : 0;
      await integrity("T8");
      await closeAll(r.open ? "" : "soru-yok", "T8 sonrası");
    });

    await step("T6 tedarikçi + Tahsilat 100, Kredi Kartına İade işaretli", async () => {
      await openEntry(ctx.sup.id, "in");
      await typeInto(`${form} input[name="amount"]`, "100");
      await chooseMethod("card");
      const f0 = await formState();
      ok(f0.refundBox === "görünür" && f0.refundChecked === false && f0.cardPicker !== "görünür" && f0.pos === "görünür", `tedarikçide kutu görünür, işaretsiz; kart seçicisi gizli, POS alanı görünür (${f0.refundBox}, ${f0.cardPicker}, ${f0.pos})`);
      await page.click(`${form} input[name="cardRefund"]`);
      await pause(500);
      const f = await formState();
      ok(f.cardPicker === "görünür" && f.pos !== "görünür", `işaretli: kart seçicisi görünür, POS alanı gizli (${f.cardPicker}, ${f.pos})`);
      if (CARDS === 2) {
        ok(f.cardRequired === true, "2 kart: kart seçimi zorunlu");
        await page.selectOption(`${form} select[name="cardAccountId"]`, ctx.kk2.id);
        await pause(400);
      }
      const before = { n: entries(ctx.sup.id).length, pos: posRows().length, bal: await balances() };
      if (CARDS === 0) {
        // UI-A2 (2.4.9 UI tur A, ORTA-2): kart yokken iade kaydedilemez — ekran bunu söyler, düğme pasif; istek gitmez (sunucu yine 400 verir).
        ok(f.defineCard && /Kredi Kartına İade için önce bir kredi kartı tanımlayın\./.test(f.cardText), `0 kart: seçicide “Kredi Kartı Tanımla” + “Kredi Kartına İade için önce bir kredi kartı tanımlayın.” (“${f.cardText}”)`);
        ok(!/Tanımlamadan kaydederseniz|Hesabı Atanmamış/.test(f.cardText), `“Tanımlamadan kaydederseniz … Hesabı Atanmamış …” yazmıyor (“${f.cardText}”)`);
        ok(/önce bir kredi kartı tanımlayın/.test(f.help) && !/Hesabı Atanmamış/.test(f.help), `açıklama: “${f.help}”`);
        const blk = await blockState();
        ok(blk.disabled && /^Kaydedilemez: Kredi Kartına İade için önce bir kredi kartı tanımlayın/.test(blk.note) && Boolean(blk.described), `“${blk.label}” düğmesi pasif, nedeni görünür: “${blk.note}” (aria-describedby ${blk.described || "yok"})`);
        await shot("ui-a2-t6-0kart-pasif");
        const mark = posts.length;
        await page.click(`${form} button[type="submit"]`, { force: true, timeout: 3000 }).catch(() => null);
        await page.click(`${form} input[name="amount"]`);
        await page.keyboard.press("Enter");
        await pause(900);
        ok(posts.length === mark && entries(ctx.sup.id).length === before.n && Boolean(await page.$(form)), `tıklama ve Enter istek göndermedi (${posts.length - mark}), satır yok, form açık`);
        ok((await balances()).tedarikci === before.bal.tedarikci, "tedarikçi bakiyesi değişmedi");
        await page.click(`${form} input[name="cardRefund"]`);
        await pause(500);
        const off = await blockState();
        const fOff = await formState();
        ok(!off.disabled && !off.note && fOff.pos === "görünür", `kutu kaldırılınca düğme etkin, not yok, POS alanı görünür (${off.disabled}, “${off.note}”, ${fOff.pos})`);
        await page.click(`${form} input[name="cardRefund"]`);
        await pause(500);
        ok((await blockState()).disabled, "yeniden işaretlenince yine pasif");
        // Sunucu değişmedi: API'den doğrudan gönderim yine 400 (kart gerekir; 108'e sessiz yazım yok).
        const viaApi = await api.post(`/api/workspace/accounts/${ctx.sup.id}/entries`, { kind: "in", method: "card", amount: "100", date: TODAY, cardRefund: true });
        ok(viaApi.status === 400 && /Kredi Kartına İade için etkin bir kredi kartı hesabı gerekir/.test(JSON.stringify(viaApi.data)) && entries(ctx.sup.id).length === before.n, `API: 400, satır yok (${viaApi.status})`);
        await integrity("T6");
        await dropDraft("T6 0 kart (kaydedilemedi)");
        return;
      }
      const r = await submit("T6 kaydet");
      const fresh = entries(ctx.sup.id).slice(before.n);
      const after = await balances();
      {
        ok(r.status === 200 && !r.open, `T6 kaydedildi: ${why(r)}`);
        ok(r.sent.cardRefund === true && !("posInstallments" in r.sent), `gövde cardRefund, POS alanı yok: ${JSON.stringify(r.sent)}`);
        ok(fresh.length === 1 && fresh[0].finRef === cardOf.id, `satır ${refName(cardOf.id)}: ${JSON.stringify(fresh.map(e => ({ ...e, hesap: refName(e.finRef) })))}`);
        ok(posRows().length === before.pos, "POS satışı oluşmadı");
        const effect = after[cardKey] - before.bal[cardKey];
        ok(Math.abs(effect) === 10000 && Math.sign(effect) === -Math.sign(ctx.payEffect), `${cardKey} borcu 100 azaldı (${before.bal[cardKey]} → ${after[cardKey]}; ödeme etkisi ${ctx.payEffect})`);
        ok(after.posBekleyen === before.bal.posBekleyen && after.kasa === before.bal.kasa, "POS Bekleyen ve Kasa değişmedi");
      }
      await integrity("T6");
      await closeAll(r.open ? "" : "soru-yok", "T6 sonrası");
    });

    await step("T7 tedarikçi + Tahsilat 50, kutu işaretsiz (POS)", async () => {
      await openEntry(ctx.sup.id, "in");
      await typeInto(`${form} input[name="amount"]`, "50");
      await chooseMethod("card");
      const f = await formState();
      ok(f.refundBox === "görünür" && f.cardPicker !== "görünür" && f.pos === "görünür", `kutu görünür, kart seçicisi gizli, POS alanı görünür (${f.refundBox}, ${f.cardPicker}, ${f.pos})`);
      await typeInto(`${form} input[name="authCode"]`, `T7K${CARDS}`);
      const before = { n: entries(ctx.sup.id).length, pos: posRows().length, bal: await balances() };
      const r = await submit("T7 kaydet");
      ok(r.status === 200 && !r.open, `T7 kaydedildi: ${why(r)}`);
      const fresh = entries(ctx.sup.id).slice(before.n);
      ok(fresh.length === 1 && fresh[0].finRef === ctx.pos.id, `satır POS'a: ${JSON.stringify(fresh.map(e => ({ ...e, hesap: refName(e.finRef) })))}`);
      const after = await balances();
      ok(posRows().length - before.pos === 1 && after.posBekleyen - before.bal.posBekleyen === 5000, `POS satışı +1, POS Bekleyen +50 (${before.bal.posBekleyen} → ${after.posBekleyen})`);
      ok(after.kart1 === before.bal.kart1 && after.kart2 === before.bal.kart2, "kartlar değişmedi");
      await integrity("T7");
      await closeAll(r.open ? "" : "soru-yok", "T7 sonrası");
    });

    if (CARDS === 0)
      await step("T16 (P1 tur 2 DÜŞÜK-1) 0 kart: tedarikçinin POS satırı ✎ Kredi Kartına İade işaretlenir → 400, satır POS'ta", async () => {
        const row = entries(ctx.sup.id).find(e => e.kind === "in" && e.method === "card" && e.finRef === ctx.pos.id && Math.abs(e.amount - 50) < 0.001);
        ok(Boolean(row), `düzeltilecek T7 satırı: ${JSON.stringify(row && { ...row, hesap: refName(row.finRef) })}`);
        if (!row) return;
        const salesBefore = activeSalesOf(row.id);
        const before = await balances();
        await openEdit(ctx.sup.id, row.id);
        const f0 = await formState();
        ok(f0.refundBox === "görünür" && f0.refundChecked === false && f0.pos === "görünür", `kutu görünür, işaretsiz; POS alanı görünür (${f0.refundBox}, ${f0.refundChecked}, ${f0.pos})`);
        await page.click(`${form} input[name="cardRefund"]`);
        await pause(500);
        const f = await formState();
        ok(f.refundChecked === true && f.cardPicker === "görünür" && f.defineCard, `işaretli: kart seçicisi "Kredi Kartı Tanımla" (${f.cardPicker}: “${f.cardText.slice(0, 60)}”)`);
        // UI-A2 (2.4.9 UI tur A, ORTA-2): düzeltmede de kaydet pasif, nedeni görünür; istek gitmez (önceden PUT gidip 400 dönüyordu — P1 tur 2).
        ok(/Kredi Kartına İade için önce bir kredi kartı tanımlayın\./.test(f.cardText) && !/Tanımlamadan kaydederseniz/.test(f.cardText), `seçici notu: “${f.cardText}”`);
        const blk = await blockState();
        ok(blk.disabled && /^Kaydedilemez: Kredi Kartına İade için önce bir kredi kartı tanımlayın/.test(blk.note), `“${blk.label}” pasif, neden: “${blk.note}”`);
        await shot("ui-a2-t16-duzeltme-pasif");
        const mark = posts.length;
        await page.click(`${form} input[name="amount"]`);
        await page.keyboard.press("Enter");
        await pause(900);
        const r = { open: Boolean(await page.$(form)) };
        ok(posts.length === mark && r.open, `Enter istek göndermedi (${posts.length - mark}), form açık`);
        // Sunucu değişmedi: PUT yine 400 bank-account-invalid (P1 tur 2).
        const viaApi = await api.put(`/api/workspace/accounts/${ctx.sup.id}/entries/${row.id}`, { kind: "in", method: "card", amount: "50", date: TODAY, cardRefund: true });
        ok(viaApi.status === 400 && /bank-account-invalid/.test(JSON.stringify(viaApi.data)), `API PUT: 400 bank-account-invalid (${viaApi.status})`);
        const now = entryRow(row.id);
        ok(now.method === "card" && Math.abs(now.amount - 50) < 0.001 && now.finRef === ctx.pos.id, `satır POS'ta kaldı (hesapsıza yazılmadı): ${JSON.stringify({ ...now, hesap: refName(now.finRef) })}`);
        const salesAfter = activeSalesOf(row.id);
        ok(salesAfter.length === 1 && salesAfter[0].gross === 5000 && salesAfter[0].id === salesBefore[0]?.id, `POS satışı aynı (5000): ${JSON.stringify(salesAfter)}`);
        const after = await balances();
        ok(after.posBekleyen === before.posBekleyen && Math.abs(after.tedarikci - before.tedarikci) < 0.001 && after.kasa === before.kasa, `POS Bekleyen (${after.posBekleyen}), tedarikçi bakiyesi (${after.tedarikci}) ve Kasa aynı`);
        await integrity("T16");
        if (r.open) await dropDraft("T16 (reddedildi, kaydedilmedi)");
        else await closeAll("", "T16 sonrası (beklenmeyen kayıt)");
      });

    let legacyRow = null;
    if (CARDS > 0)
      await step("T5 müşteride eski \"Kredi Kartına İade\" satırının düzeltmesi ✎ 120 → 110 (gerileme koruması)", async () => {
        const b0 = await balances();
        // 2.4.9 P1-b: yeni iade yalnız kartla ödemeli müşteride → önce kartla Ödeme 50, iade 120, sonra ödeme silinir (satır "eski" kalır: kutu satırdan ötürü).
        const paid = await must("kartla Ödeme 50", api.post(`/api/workspace/accounts/${ctx.abc.id}/entries`, { kind: "out", method: "card", amount: "50", date: TODAY, ...(CARDS === 2 ? { bankAccountId: ctx.kk2.id } : {}) }));
        const created = await api.post(`/api/workspace/accounts/${ctx.abc.id}/entries`, { kind: "in", method: "card", amount: "120", date: TODAY, cardRefund: true, ...(CARDS === 2 ? { bankAccountId: ctx.kk2.id } : {}) });
        ok(created.status === 200, `API ile müşteriye Kredi Kartına İade 120: ${created.status} ${JSON.stringify(created.data).slice(0, 120)}`);
        const del = await api.del(`/api/workspace/accounts/${ctx.abc.id}/entries/${paid.entryId}`);
        ok(del.status === 200, `kartla ödeme silindi: ${del.status}`);
        ok((await must("müşteri", api.get(`/api/workspace/accounts/${ctx.abc.id}`))).hasCardPayment === false, "ödeme silinince hasCardPayment false");
        const row = entries(ctx.abc.id).find(e => Math.abs(e.amount - 120) < 0.001);
        legacyRow = row || null;
        ok(row && row.finRef === cardOf.id, `satır ${refName(cardOf.id)}: ${JSON.stringify(row && { ...row, hesap: refName(row.finRef) })}`);
        const b1 = await balances();
        const effect120 = b1[cardKey] - b0[cardKey];
        ok(effect120 === 12000, `${cardKey} 120 değişti (ödeme silindi; ${b0[cardKey]} → ${b1[cardKey]})`);
        ctx.refundEffect = effect120;
        // Yeni Tahsilat: kartla ödeme yok → kutu yok (eski iade satırı kutuyu yalnız kendi düzeltmesinde getirir).
        await openEntry(ctx.abc.id, "in");
        await typeInto(`${form} input[name="amount"]`, "10");
        await chooseMethod("card");
        const fNew = await formState();
        ok(fNew.refundBox === "yok" && fNew.cardPicker === "yok" && fNew.pos === "görünür", `yeni Tahsilat'ta kutu ve kart seçicisi yok, POS alanı var (${fNew.refundBox}, ${fNew.cardPicker}, ${fNew.pos})`);
        await dropDraft("T5 yeni Tahsilat (kaydedilmedi)");
        await openEdit(ctx.abc.id, row.id);
        const f = await formState();
        ok(f.refundBox === "görünür" && f.refundChecked === true, `kutu görünür ve işaretli (${f.refundBox}, ${f.refundChecked})`);
        ok(f.cardPicker === "görünür" && f.pos !== "görünür", `kart seçicisi görünür, POS alanı gizli (${f.cardPicker}: “${f.cardText.slice(0, 70)}”, POS ${f.pos})`);
        if (CARDS === 2) ok(f.cardValue === ctx.kk2.id, `satırın kartı seçili (${refName(f.cardValue)})`);
        await typeInto(`${form} input[name="amount"]`, "110");
        const r = await submit("T5 kaydet");
        ok(r.status === 200 && !r.open, `T5 düzeltildi: ${why(r)}`);
        // Dar kontrol DÜŞÜK-2: gönderilen gövde de okunur — kutu işaretli, 2 kartta seçilen kart, POS alanı yok.
        ok(r.sent.cardRefund === true && !("posInstallments" in r.sent) && !("posId" in r.sent), `gövde cardRefund true, POS alanı yok: ${JSON.stringify(r.sent)}`);
        if (CARDS === 2) ok(r.sent.bankAccountId === ctx.kk2.id, `gövdede seçilen kart (${refName(r.sent.bankAccountId)})`);
        else ok(!("bankAccountId" in r.sent), `tek kartta gövdede kart kimliği yok (satırın bağı sürer): ${JSON.stringify(r.sent)}`);
        const now = entryRow(row.id);
        ok(Math.abs(now.amount - 110) < 0.001 && now.finRef === cardOf.id, `satır 110, ${refName(cardOf.id)}: ${JSON.stringify({ ...now, hesap: refName(now.finRef) })}`);
        const b2 = await balances();
        ok(b2[cardKey] - b0[cardKey] === Math.round((effect120 * 110) / 120), `${cardKey} etkisi 110 (${b0[cardKey]} → ${b2[cardKey]})`);
        ok(b2.posBekleyen === b1.posBekleyen, "POS Bekleyen değişmedi");
        ctx.cardBeforeLegacy = b0[cardKey];
        await integrity("T5");
        await closeAll(r.open ? "" : "soru-yok", "T5 sonrası");
      });

    if (CARDS > 0)
      await step("T12 (DÜŞÜK-1) eski Kredi Kartına İade satırı ✎ kutu kaldırılır → POS tahsilatı", async () => {
        ok(Boolean(legacyRow), `düzeltilecek satır: ${legacyRow?.id || "yok"}`);
        if (!legacyRow) return;
        const before = { bal: await balances(), pos: posRows().length };
        await openEdit(ctx.abc.id, legacyRow.id);
        const f0 = await formState();
        ok(f0.refundBox === "görünür" && f0.refundChecked === true, `kutu görünür ve işaretli (${f0.refundBox}, ${f0.refundChecked})`);
        await page.click(`${form} input[name="cardRefund"]`);
        await pause(600);
        const f = await formState();
        ok(f.refundChecked === false && f.cardPicker !== "görünür" && f.pos === "görünür" && /Ziraat Fiziki POS POS'una yazılır/.test(f.posText), `kutu kaldırıldı: kart seçicisi gizli, POS alanı görünür (${f.cardPicker}, ${f.pos}: “${f.posText.slice(0, 50)}”)`);
        ok(/seçilen POS'a yazılır/.test(f.help), `açıklama POS'a göre: “${f.help.slice(0, 70)}”`);
        await shot("t12-form");
        await markToasts();
        const r = await submit("T12 kaydet");
        ok(r.status === 200 && !r.open && r.res?.method === "PUT", `T12 düzeltildi: ${r.res?.method || ""} ${why(r)}`);
        ok(r.sent.cardRefund === false && r.sent.posInstallments === "1" && !("bankAccountId" in r.sent) && !("cardAccountId" in r.sent), `gövde cardRefund false, POS alanları var, kart kimliği yok: ${JSON.stringify(r.sent)}`);
        const now = entryRow(legacyRow.id);
        ok(now.method === "card" && Math.abs(now.amount - 110) < 0.001 && now.finRef === ctx.pos.id, `satır 110 POS'ta: ${JSON.stringify({ ...now, hesap: refName(now.finRef) })}`);
        const sales = activeSalesOf(legacyRow.id);
        ok(sales.length === 1 && sales[0].kind === "sale" && sales[0].gross === 11000 && sales[0].posId === ctx.pos.id, `etkin POS satışı 11000: ${JSON.stringify(sales)}`);
        const after = await balances();
        ok(after[cardKey] === ctx.cardBeforeLegacy, `${cardKey} iade etkisi geri alındı (${before.bal[cardKey]} → ${after[cardKey]}; iadeden önce ${ctx.cardBeforeLegacy})`);
        ok(after.posBekleyen - before.bal.posBekleyen === 11000, `POS Bekleyen +110 (${before.bal.posBekleyen} → ${after.posBekleyen})`);
        ok(Math.abs(after.musteri - before.bal.musteri) < 0.001, `müşteri bakiyesi aynı (${before.bal.musteri} → ${after.musteri})`);
        ok(after.kasa === before.bal.kasa, `Kasa değişmedi (${after.kasa})`);
        const toast = await newToast();
        ok(/Hareket düzeltildi/.test(toast) && toast.includes(moneyText(after.musteri)), `bildirim: “${toast}”`);
        await integrity("T12");
        await closeAll(r.open ? "" : "soru-yok", "T12 sonrası");
        await openEdit(ctx.abc.id, legacyRow.id);
        const f2 = await formState();
        ok(f2.refundBox === "yok" && f2.cardPicker === "yok" && f2.pos === "görünür", `yeniden açılınca kutu yok, POS alanı var (${f2.refundBox}, ${f2.cardPicker}, ${f2.pos})`);
        await closeAll("soru-yok", "T12 yeniden açılış");
      });

    let p1bRow = null;
    await step("T11 (P1-b) aynı adlı ikinci müşteriye − Ödeme Kredi Kartı 400, sonra + Tahsilat Kredi Kartına İade 150", async () => {
      await openEntry(ctx.abc2.id, "out");
      ok((await eyebrow()).includes(`No ${ctx.abc2.refNo}`), `pencere başlığında ikinci müşterinin Cari No'su: “${await eyebrow()}”`);
      await typeInto(`${form} input[name="amount"]`, "400");
      await chooseMethod("card");
      if (CARDS === 2) {
        await page.selectOption(`${form} select[name="cardAccountId"]`, ctx.kk1.id);
        await pause(400);
      }
      const b0 = await balances();
      const rp = await submit("T11 ödeme kaydet");
      ok(rp.status === 200 && !rp.open, `kartla Ödeme kaydedildi: ${why(rp)}`);
      const paidRow = entries(ctx.abc2.id).find(e => e.kind === "out");
      const payCard = CARDS > 0 ? ctx.kk1 : null;
      ok(paidRow && paidRow.method === "card" && (paidRow.finRef || "") === (payCard?.id || ""), `ödeme satırı ${refName(payCard?.id || "")}: ${JSON.stringify(paidRow && { ...paidRow, hesap: refName(paidRow.finRef) })}`);
      const flag = (await must("müşteri 2", api.get(`/api/workspace/accounts/${ctx.abc2.id}`))).hasCardPayment;
      ok(flag === CARDS > 0, `hasCardPayment ${flag} (${CARDS === 0 ? "0 kartta ödeme hesapsız: sayılmaz" : "kartla ödeme var"})`);
      await closeAll(rp.open ? "" : "soru-yok", "T11 ödeme sonrası");
      await openEntry(ctx.abc2.id, "in");
      await typeInto(`${form} input[name="amount"]`, "150");
      await chooseMethod("card");
      const f0 = await formState();
      if (CARDS === 0) {
        ok(f0.refundBox === "yok" && f0.cardPicker === "yok" && f0.pos === "görünür", `0 kart: kutu yok (hesapsız ödeme sayılmaz), POS alanı var (${f0.refundBox}, ${f0.cardPicker}, ${f0.pos})`);
        await dropDraft("T11 0 kart (kaydedilmedi)");
        return;
      }
      ok(f0.refundBox === "görünür" && f0.refundChecked === false && f0.cardPicker !== "görünür" && f0.pos === "görünür", `kartla ödemeli müşteride kutu görünür, işaretsiz; kart seçicisi gizli, POS alanı görünür (${f0.refundBox}, ${f0.refundChecked}, ${f0.cardPicker}, ${f0.pos})`);
      const label = await page.$eval(`${form} input[name="cardRefund"]`, n => (n.closest("label")?.innerText || "").replace(/\s+/g, " ").trim()).catch(() => "");
      ok(/Kredi Kartına İade/.test(label) && /müşteri parayı/.test(label) && !/tedarikçi/.test(label), `kutu etiketi müşteriye göre: “${label}”`);
      await page.click(`${form} input[name="cardRefund"]`);
      await pause(600);
      const f = await formState();
      ok(f.cardPicker === "görünür" && f.pos !== "görünür", `işaretli: kart seçicisi görünür, POS alanı gizli (${f.cardPicker}, ${f.pos})`);
      ok(/Müşteri parayı kredi kartımıza iade etti/.test(f.help), `açıklama: “${f.help.slice(0, 80)}”`);
      if (CARDS === 2) {
        ok(f.cardRequired === true, "2 kart: kart seçimi zorunlu");
        await page.selectOption(`${form} select[name="cardAccountId"]`, ctx.kk2.id);
        await pause(400);
      }
      await shot("t11-form");
      const before = { pos: posRows().length, bal: await balances() };
      const r = await submit("T11 iade kaydet");
      ok(r.status === 200 && !r.open, `T11 kaydedildi: ${why(r)}`);
      ok(r.sent.cardRefund === true && !("posInstallments" in r.sent) && !("posId" in r.sent), `gövde cardRefund true, POS alanı yok: ${JSON.stringify(r.sent)}`);
      if (CARDS === 2) ok(r.sent.bankAccountId === ctx.kk2.id, `gövdede seçilen kart (${refName(r.sent.bankAccountId)})`);
      const fresh = entries(ctx.abc2.id).filter(e => e.kind === "in");
      p1bRow = fresh[0] || null;
      ok(fresh.length === 1 && fresh[0].method === "card" && Math.abs(fresh[0].amount - 150) < 0.001 && fresh[0].finRef === cardOf.id, `satır ${refName(cardOf.id)}: ${JSON.stringify(fresh.map(e => ({ ...e, hesap: refName(e.finRef) })))}`);
      ok(posRows().length === before.pos, `POS satışı oluşmadı (${before.pos} → ${posRows().length})`);
      const after = await balances();
      ok(after[cardKey] - before.bal[cardKey] === 15000, `${cardKey} borcu 150 azaldı (${before.bal[cardKey]} → ${after[cardKey]})`);
      ok(CARDS === 1 || after.kart1 === before.bal.kart1, `kart1 (ödemenin kartı) değişmedi (${before.bal.kart1} → ${after.kart1})`);
      ok(Math.abs(after.musteri2 - (before.bal.musteri2 - 150)) < 0.001, `ikinci müşterinin bakiyesi −150 (${before.bal.musteri2} → ${after.musteri2})`);
      ok(after.posBekleyen === before.bal.posBekleyen && after.kasa === before.bal.kasa, "POS Bekleyen ve Kasa değişmedi");
      ok(Math.abs(after.musteri - b0.musteri) < 0.001, `birinci müşterinin bakiyesi değişmedi (${b0.musteri} → ${after.musteri})`);
      await integrity("T11");
      await closeAll(r.open ? "" : "soru-yok", "T11 sonrası");
      // Birinci "ABC Ltd." (kartla ödemesi yok): kutu yok.
      await openEntry(ctx.abc.id, "in");
      ok((await eyebrow()).includes(`No ${ctx.abc.refNo}`), `birinci müşteri: “${await eyebrow()}”`);
      await typeInto(`${form} input[name="amount"]`, "10");
      await chooseMethod("card");
      const fFirst = await formState();
      ok(fFirst.refundBox === "yok" && fFirst.cardPicker === "yok", `birinci müşteride kutu ve kart seçicisi yok (${fFirst.refundBox}, ${fFirst.cardPicker})`);
      await dropDraft("T11 birinci müşteri (kaydedilmedi)");
    });

    if (CARDS > 0)
      await step("T13 (DÜŞÜK-1) T11 iadesi ✎ kutu kaldırılır, yol Nakit → nakit tahsilat", async () => {
        ok(Boolean(p1bRow), `düzeltilecek satır: ${p1bRow?.id || "yok"}`);
        if (!p1bRow) return;
        const before = await balances();
        await openEdit(ctx.abc2.id, p1bRow.id);
        const f0 = await formState();
        ok(f0.refundBox === "görünür" && f0.refundChecked === true, `kutu görünür ve işaretli (${f0.refundBox}, ${f0.refundChecked})`);
        await page.click(`${form} input[name="cardRefund"]`);
        await pause(400);
        await chooseMethod("cash");
        const f = await formState();
        ok(f.refundBox === "gizli" && f.cardPicker !== "görünür" && f.pos !== "görünür", `Nakit: kutu, kart seçicisi ve POS alanı gizli (${f.refundBox}, ${f.cardPicker}, ${f.pos})`);
        await markToasts();
        const r = await submit("T13 kaydet");
        ok(r.status === 200 && !r.open && r.res?.method === "PUT", `T13 düzeltildi: ${r.res?.method || ""} ${why(r)}`);
        ok(r.sent.method === "cash" && r.sent.cardRefund === false && !("bankAccountId" in r.sent) && !("posInstallments" in r.sent), `gövde: Nakit, cardRefund false, hesap / POS alanı yok — ${JSON.stringify(r.sent)}`);
        const now = entryRow(p1bRow.id);
        ok(now.method === "cash" && !now.finRef && Math.abs(now.amount - 150) < 0.001, `satır nakit 150: ${JSON.stringify({ ...now, hesap: refName(now.finRef) })}`);
        const after = await balances();
        ok(Math.abs(after.kasa - before.kasa - 150) < 0.001, `Kasa +150 (${before.kasa} → ${after.kasa})`);
        ok(after[cardKey] - before[cardKey] === -15000, `${cardKey} iade etkisi geri alındı (${before[cardKey]} → ${after[cardKey]})`);
        ok(Math.abs(after.musteri2 - before.musteri2) < 0.001 && after.posBekleyen === before.posBekleyen, `ikinci müşterinin bakiyesi (${after.musteri2}) ve POS Bekleyen aynı`);
        const toast = await newToast();
        ok(/Hareket düzeltildi/.test(toast), `bildirim: “${toast}”`);
        await integrity("T13");
        await closeAll(r.open ? "" : "soru-yok", "T13 sonrası");
      });

    if (CARDS > 0)
      await step("UI-A1 (ORTA-1) cari kartı Hareketler: Kredi Kartına İade satırının yol etiketi", async () => {
        const before = await balances();
        const sup = await ledgerTags(ctx.sup.id);
        console.log(`  · tedarikçi satırları: ${JSON.stringify(sup)}`);
        // Tedarikçinin iki Tahsilat satırı: T6 Kredi Kartına İade (karta) ve T7 POS tahsilatı — etiketler satır işaretinden bağımsız okunur.
        const supIn = sup.filter(row => row.label === "Tahsilat").map(row => row.tag).sort();
        ok(JSON.stringify(supIn) === JSON.stringify(["Kredi Kartına İade", "POS"]), `tedarikçi Tahsilat etiketleri: ${JSON.stringify(supIn)} (beklenen Kredi Kartına İade + POS)`);
        ok(sup.filter(row => row.refund).length === 1 && sup.find(row => row.refund)?.tag === "Kredi Kartına İade", "iade satırı işaretli (data-card-refund) ve etiketi “Kredi Kartına İade”");
        ok(sup.some(row => !row.refund && row.label === "Tahsilat" && row.tag === "POS"), "tedarikçi: POS tahsilatı (T7) etiketi “POS”");
        ok(sup.some(row => row.label === "Ödeme" && row.tag === "Kredi Kartı"), "tedarikçi: kartla ödeme (T8) etiketi “Kredi Kartı”");
        await page.$eval(`${accWin} .hof-method-tag[data-card-refund]`, node => node.scrollIntoView({ block: "center" })).catch(() => null);
        await pause(300);
        await shot("ui-a1-tedarikci-hareketler");
        await closeAll("soru-yok", "UI-A1 tedarikçi kartı");
        // T11'in müşteri iadesi T13'te nakde çevrildi; kartla ödemeli ikinci müşteriye API ile yeni iade (P1-b) — satır müşteride de aynı etiketle.
        const extra = await api.post(`/api/workspace/accounts/${ctx.abc2.id}/entries`, { kind: "in", method: "card", amount: "20", date: TODAY, cardRefund: true, note: "UI-A1 iade", ...(CARDS === 2 ? { bankAccountId: ctx.kk1.id } : {}) });
        ok(extra.status === 200, `müşteriye Kredi Kartına İade 20 (API): ${extra.status} ${JSON.stringify(extra.data).slice(0, 120)}`);
        const cus = await ledgerTags(ctx.abc2.id);
        console.log(`  · müşteri satırları: ${JSON.stringify(cus)}`);
        const cusRefund = cus.find(row => row.note.startsWith("UI-A1 iade"));
        ok(cusRefund?.label === "Tahsilat" && cusRefund?.tag === "Kredi Kartına İade", `müşteri: iade satırı “Tahsilat” + “${cusRefund?.tag || "?"}” (beklenen Kredi Kartına İade)`);
        ok(cus.some(row => row.label === "Ödeme" && row.tag === "Kredi Kartı"), "müşteri: kartla ödeme “Kredi Kartı”");
        await page.$eval(`${accWin} .hof-method-tag[data-card-refund]`, node => node.scrollIntoView({ block: "center" })).catch(() => null);
        await pause(300);
        await shot("ui-a1-musteri-hareketler");
        await closeAll("soru-yok", "UI-A1 müşteri kartı");
        const after = await balances();
        ok(Math.abs(after.tedarikci - before.tedarikci) < 0.001 && Math.abs(after.musteri2 - (before.musteri2 - 20)) < 0.001, `bakiyeler: tedarikçi aynı (${after.tedarikci}), müşteri 2 yalnız yeni iade kadar −20 (${before.musteri2} → ${after.musteri2})`);
        await integrity("UI-A1");
      });

    await step("T10 Banka → POS → POS İşlemleri → İade 100 (T1 satışı)", async () => {
      if (!t1Sale) t1Sale = posRows().find(p => p.kind === "sale" && p.status === "active" && p.authCode === `T2K${CARDS}`);
      ok(Boolean(t1Sale), `iade edilecek satış: ${t1Sale?.authCode || "yok"}`);
      if (!t1Sale) return;
      await page.click('#hof-sidecard [data-action="bank"]');
      await page.waitForSelector(".hof-bank-modal [data-bank] .hof-bank-tabs", { timeout: 15000 });
      await pause(600);
      await page.click('.hof-bank-modal .hof-bank-tabs [data-tab="pos"]');
      await pause(900);
      await page.click('.hof-bank-modal [data-pos-sub="sales"]');
      await page.waitForSelector(`.hof-bank-modal tr[data-pos-sale="${t1Sale.id}"] [data-pos-act="refund"]`, { timeout: 10000 });
      await pause(400);
      await page.click(`.hof-bank-modal tr[data-pos-sale="${t1Sale.id}"] [data-pos-act="refund"]`);
      await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 10000 });
      await typeInto(`${form} input[name="amount"]`, "100");
      const before = { pos: posRows().length, bal: await balances() };
      const r = await submit("T10 kaydet");
      ok(r.status === 200 && !r.open, `T10 iade kaydedildi: ${why(r)}`);
      const fresh = posRows().slice(before.pos);
      ok(fresh.length === 1 && fresh[0].kind === "refund" && fresh[0].gross === 10000, `POS iadesi 10000: ${JSON.stringify(fresh)}`);
      const after = await balances();
      ok(after.posBekleyen - before.bal.posBekleyen === -10000, `POS Bekleyen −100 (${before.bal.posBekleyen} → ${after.posBekleyen})`);
      ok(after.kart1 === before.bal.kart1 && after.kart2 === before.bal.kart2 && after.kasa === before.bal.kasa, "kartlar ve Kasa değişmedi");
      await integrity("T10");
      await closeAll(r.open ? "" : "soru-yok", "T10 sonrası");
    });

    await step("T15 (P1 tur 2 TEST-1) yalnız POS İadesi olan müşteri: + Tahsilat'ta Kredi Kartına İade kutusu yok, API'den 400", async () => {
      ctx.deniz = await must("müşteri 3", api.post("/api/workspace/accounts", { name: "Deniz Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      await must("POS tahsilatı 200", api.post(`/api/workspace/accounts/${ctx.deniz.id}/entries`, { kind: "in", method: "card", amount: "200", date: TODAY, posId: ctx.pos.id, authCode: `T15K${CARDS}` }));
      const sale = posRows().find(p => p.authCode === `T15K${CARDS}` && p.kind === "sale" && p.status === "active");
      ok(Boolean(sale), `POS satışı: ${JSON.stringify(sale)}`);
      if (!sale) return;
      await must("cari POS İadesi 50", api.post(`/api/workspace/accounts/${ctx.deniz.id}/entries`, { kind: "out", method: "card", amount: "50", date: TODAY, posRefund: true, posRefundOf: sale.id }));
      const outs = entries(ctx.deniz.id).filter(e => e.kind === "out");
      ok(outs.length === 1 && outs[0].method === "card" && outs[0].finRef === ctx.pos.id, `POS İadesi POS'a bağlı çıkış: ${JSON.stringify(outs.map(e => ({ ...e, hesap: refName(e.finRef) })))}`);
      const flag = (await must("müşteri 3", api.get(`/api/workspace/accounts/${ctx.deniz.id}`))).hasCardPayment;
      ok(flag === false, `yalnız POS İadesi → hasCardPayment false (${flag})`);
      await openEntry(ctx.deniz.id, "in");
      await typeInto(`${form} input[name="amount"]`, "40");
      await chooseMethod("card");
      const f = await formState();
      ok(f.refundBox === "yok" && f.cardPicker === "yok" && f.pos === "görünür", `kutu ve kart seçicisi yok, POS alanı var (${f.refundBox}, ${f.cardPicker}, ${f.pos})`);
      await shot("t15-form");
      await dropDraft("T15 (kaydedilmedi)");
      const n = entries(ctx.deniz.id).length;
      const res = await api.post(`/api/workspace/accounts/${ctx.deniz.id}/entries`, { kind: "in", method: "card", amount: "40", date: TODAY, cardRefund: true, ...(ctx.kk1 ? { bankAccountId: ctx.kk1.id } : {}) });
      ok(res.status === 400 && JSON.stringify(res.data).includes("card-refund-no-payment") && entries(ctx.deniz.id).length === n, `API'den Kredi Kartına İade 400 card-refund-no-payment, satır yok: ${res.status} ${JSON.stringify(res.data).slice(0, 160)}`);
      await integrity("T15");
    });

    if (CARDS === 2)
      await step("T14 (DÜŞÜK-1, 2 POS) kartla ödemeli müşterinin Kredi Kartına İade satırı ✎ kutu kaldırılır, POS2 seçilir", async () => {
        ctx.pos2 = (await must("POS 2", api.post(`${BANK}/pos`, { name: "Ziraat Sanal POS", bankAccountId: ctx.ziraat.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T002", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }] }))).pos;
        const created = await must("iade 90", api.post(`/api/workspace/accounts/${ctx.abc2.id}/entries`, { kind: "in", method: "card", amount: "90", date: TODAY, cardRefund: true, bankAccountId: ctx.kk2.id }));
        const row = entryRow(created.entryId);
        ok(row?.finRef === ctx.kk2.id, `satır KART2: ${JSON.stringify(row && { ...row, hesap: refName(row.finRef) })}`);
        const before = await balances();
        await openEdit(ctx.abc2.id, created.entryId);
        await page.click(`${form} input[name="cardRefund"]`);
        await pause(600);
        const f = await formState();
        ok(f.pos === "görünür" && (await page.$(`${form} select[name="posId"]`)) !== null, `kutu kaldırıldı: POS seçici görünür (${f.pos}: “${f.posText.slice(0, 60)}”)`);
        await page.selectOption(`${form} select[name="posId"]`, ctx.pos2.id);
        await pause(500);
        const r = await submit("T14 kaydet");
        ok(r.status === 200 && !r.open && r.res?.method === "PUT", `T14 düzeltildi: ${r.res?.method || ""} ${why(r)}`);
        ok(r.sent.cardRefund === false && r.sent.posId === ctx.pos2.id && !("bankAccountId" in r.sent), `gövde cardRefund false, posId POS2: ${JSON.stringify(r.sent)}`);
        const now = entryRow(created.entryId);
        ok(now.finRef === ctx.pos2.id && Math.abs(now.amount - 90) < 0.001, `satır POS2'de: ${JSON.stringify({ ...now, hesap: refName(now.finRef) })}`);
        const sales = activeSalesOf(created.entryId);
        ok(sales.length === 1 && sales[0].posId === ctx.pos2.id && sales[0].gross === 9000, `POS2'de etkin satış 9000: ${JSON.stringify(sales)}`);
        const after = await balances();
        ok(after.kart2 - before.kart2 === -9000, `kart2 iade etkisi geri alındı (${before.kart2} → ${after.kart2})`);
        ok(after.posBekleyen - before.posBekleyen === 9000, `POS Bekleyen +90 (${before.posBekleyen} → ${after.posBekleyen})`);
        await integrity("T14");
        await closeAll(r.open ? "" : "soru-yok", "T14 sonrası");
      });

    const final = await balances();
    console.log(`\n  · [${CARDS} kart] son bakiyeler: ${JSON.stringify(final)}`);
    console.log(`  · [${CARDS} kart] müşteri satırları: ${JSON.stringify(entries(ctx.abc.id).map(e => [e.kind, e.amount, e.method, refName(e.finRef)]))}`);
    console.log(`  · [${CARDS} kart] tedarikçi satırları: ${JSON.stringify(entries(ctx.sup.id).map(e => [e.kind, e.amount, e.method, refName(e.finRef)]))}`);
    console.log(`  · [${CARDS} kart] ikinci müşteri satırları: ${JSON.stringify(entries(ctx.abc2.id).map(e => [e.kind, e.amount, e.method, refName(e.finRef)]))}`);
    // POS / kart Kasa'ya girmez; yalnız T13'ün Nakit'e çevrilen 150'si (1/2 kart).
    const kasaWant = CARDS > 0 ? 150 : 0;
    ok(Math.abs(final.kasa - kasaWant) < 0.001, `Kasa ${kasaWant} (POS / kart Kasa'ya girmez; T13 Nakit 150): ${final.kasa}`);
    await context.close();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ kurulum / genel hata: ${error.stack || error.message}`);
  } finally {
    await Promise.resolve()
      .then(() => app.close())
      .catch(() => null);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

try {
  for (const cards of [0, 1, 2]) await phase(cards);
} finally {
  await browser.close().catch(() => null);
}
console.log(`\n${failed ? "✗" : "✓"} senaryo-pos-kart-249: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
process.exit(failed ? 1 : 0);
