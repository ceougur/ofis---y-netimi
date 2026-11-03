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
//   T5    (1 ve 2 kart; gerileme koruması) müşteride eski "Kredi Kartına İade" satırı (2.3.0–2.4.2'de girilebiliyordu; API ile) ✎ 120 → 110: kutu işaretli,
//         kart seçici görünür (2 kartta satırın kartı seçili), kayıt aynı karta, kart etkisi 110/120.
//   T10   Banka → POS → POS İşlemleri → İade 100 (T1 satışı) → 200, iade 10000, POS Bekleyen −100.
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
  const refName = id => (!id ? "(hesapsız)" : id === ctx.pos?.id ? "POS" : id === ctx.kk1?.id ? "KART1" : id === ctx.kk2?.id ? "KART2" : id === ctx.ziraat?.id ? "ZIRAAT" : id);
  const balanceOf = async id => (id ? (await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor : null);
  const balances = async () => {
    const summary = await must("banka özeti", api.get(`${BANK}/summary`));
    const cash = await must("Kasa", api.get("/api/workspace/cash"));
    return {
      musteri: (await must("müşteri", api.get(`/api/workspace/accounts/${ctx.abc.id}`))).totals.balance,
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

  try {
    await api.login("admin", PASS);
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    ctx.abc = await must("müşteri", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    ctx.sup = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
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
      if (CARDS === 0) ok(f.cardPicker === "görünür" && f.defineCard, `0 kart: "Kredi Kartı Tanımla" görünür (${f.cardPicker}: “${f.cardText}”)`);
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
      const r = await submit("T6 kaydet");
      const fresh = entries(ctx.sup.id).slice(before.n);
      const after = await balances();
      if (CARDS === 0) {
        ok(r.status === 400 && /Kredi Kartına İade için etkin bir kredi kartı hesabı gerekir/.test(r.res?.body || "") && fresh.length === 0, `0 kart: 400, satır yok: ${why(r)}`);
        ok(after.tedarikci === before.bal.tedarikci, `tedarikçi bakiyesi değişmedi (${after.tedarikci})`);
      } else {
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

    if (CARDS > 0)
      await step("T5 müşteride eski \"Kredi Kartına İade\" satırının düzeltmesi ✎ 120 → 110 (gerileme koruması)", async () => {
        const b0 = await balances();
        const created = await api.post(`/api/workspace/accounts/${ctx.abc.id}/entries`, { kind: "in", method: "card", amount: "120", date: TODAY, cardRefund: true, ...(CARDS === 2 ? { bankAccountId: ctx.kk2.id } : {}) });
        ok(created.status === 200, `API ile müşteriye Kredi Kartına İade 120: ${created.status} ${JSON.stringify(created.data).slice(0, 120)}`);
        const row = entries(ctx.abc.id).find(e => Math.abs(e.amount - 120) < 0.001);
        ok(row && row.finRef === cardOf.id, `satır ${refName(cardOf.id)}: ${JSON.stringify(row && { ...row, hesap: refName(row.finRef) })}`);
        const b1 = await balances();
        const effect120 = b1[cardKey] - b0[cardKey];
        ok(Math.abs(effect120) === 12000, `${cardKey} 120 değişti (${b0[cardKey]} → ${b1[cardKey]})`);
        await openEdit(ctx.abc.id, row.id);
        const f = await formState();
        ok(f.refundBox === "görünür" && f.refundChecked === true, `kutu görünür ve işaretli (${f.refundBox}, ${f.refundChecked})`);
        ok(f.cardPicker === "görünür" && f.pos !== "görünür", `kart seçicisi görünür, POS alanı gizli (${f.cardPicker}: “${f.cardText.slice(0, 70)}”, POS ${f.pos})`);
        if (CARDS === 2) ok(f.cardValue === ctx.kk2.id, `satırın kartı seçili (${refName(f.cardValue)})`);
        await typeInto(`${form} input[name="amount"]`, "110");
        const r = await submit("T5 kaydet");
        ok(r.status === 200 && !r.open, `T5 düzeltildi: ${why(r)}`);
        const now = entryRow(row.id);
        ok(Math.abs(now.amount - 110) < 0.001 && now.finRef === cardOf.id, `satır 110, ${refName(cardOf.id)}: ${JSON.stringify({ ...now, hesap: refName(now.finRef) })}`);
        const b2 = await balances();
        ok(b2[cardKey] - b0[cardKey] === Math.round((effect120 * 110) / 120), `${cardKey} etkisi 110 (${b0[cardKey]} → ${b2[cardKey]})`);
        ok(b2.posBekleyen === b1.posBekleyen, "POS Bekleyen değişmedi");
        await integrity("T5");
        await closeAll(r.open ? "" : "soru-yok", "T5 sonrası");
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

    const final = await balances();
    console.log(`\n  · [${CARDS} kart] son bakiyeler: ${JSON.stringify(final)}`);
    console.log(`  · [${CARDS} kart] müşteri satırları: ${JSON.stringify(entries(ctx.abc.id).map(e => [e.kind, e.amount, e.method, refName(e.finRef)]))}`);
    console.log(`  · [${CARDS} kart] tedarikçi satırları: ${JSON.stringify(entries(ctx.sup.id).map(e => [e.kind, e.amount, e.method, refName(e.finRef)]))}`);
    ok(final.kasa === 0, `Kasa 0 (POS / kart Kasa'ya girmez): ${final.kasa}`);
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
