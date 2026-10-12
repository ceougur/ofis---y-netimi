// 2.2.0 — Bankaya Tahsile Ver: bağımsız doğrulama TUR 2 bulgularının düzeltme testleri (docs/kanit/2026-10-12/tahsile-ver/dogrulayici-tur2,
// dogrulayici-2, gerileme-tur2). Plan: docs/BANKA-MODULU-PLAN.md §3.14, §5.5, §8.9, §8.10, §10.6 h, §3.11 madde 5. Her test önce düzeltme
// öncesi kodun (4d8003a) ayrı kopyasında kırmızı görüldü (kanıt: docs/kanit/2026-10-12/tahsile-ver/duzeltme-tur2/).
//
// Bağımsız beklenen: plan §3.14 yevmiyesi ve yaygın muhasebe kuralı — karşılıksız dönen evrakta müşteri KARŞILIKSIZ GÜNÜ yeniden borçlanır
// (B 120 / A 101.0x); alış maddesi (B 101.01 / A 120) ve o günün kesiti değişmez; taksitli satışın geliri (602) tek kez, gider (770) yok.
// Sayılar testin kendi hesabıdır; programın fonksiyonu çağrılmaz (G1'de Ana Defter, Alt Hesap Mizanı'nın bağımsız yoludur).
//
// ÇALIŞIYOR MU
//   T11  Taksite sayılmış çek (bankada tahsilde ya da portföyde, ciro edilmiş) karşılıksız dönünce alış günü maddesi değişmez; karşılıksız günü
//        B 120 / A 101.02 (tahsildeyse) ya da A 101.01; taksit kartı yeniden açık, alış günündeki tahsilat kartta kalır; Geri Al eski hâle.
//        Dönem kilidinden sonra karşılıksız kaydedilir (200), kilitli kesit değişmez.
//   T12  Çek / Senet Hareketleri tahsile verme / geri alma satırı yevmiyedeki tutarla (verilme başlığı) aynı — evrakın tutarı sonradan düzelse de.
//   T13  Banka Ayarları → Yarım Gün "İş Günü Sayılmaz": zil/takvim tahsildeki evrakı Vade Takip ile aynı günde bekler (önbellek yenilenir).
//   B1   Banka hesabının adı değişince zil/takvim tahsildeki evrakı yeni banka adıyla gösterir.
//   ozet Çek / Senet penceresinin özeti: "Portföyde (alınan)" tahsildekini içermez (rapor ile aynı), "Bankada Tahsilde" ayrı; PDF de.
//   G1   Alt Hesap Mizanı 101.01 / 101.02 her dönemde Ana Defter'le kuruşu kuruşuna aynı (bütün evrak akışları) ve Ana Defter KURULMADAN.
// NASIL BOZARIM
//   proto  Eylem adı Object.prototype anahtarı (hasOwnProperty, __proto__, toString, constructor, valueOf) → tanınmayan işlem; tahsildeki evrak
//          bankada kalır, portföydeki portföyde; işlem başlığı ve işlem geçmişi yazılmaz.
//   A22    Karşılıksız dönmüş evrakın banka hesabı silinemez (karşılıksız Geri Al evrakı o hesapta yeniden tahsilde yapar); Geri Al sonra
//          Bankadan Geri Al'ınmış evrakın hesabı silinir.
//   E1–E6  GERÇEK v2.1.0 koduna dönüp: tahsili Geri Al (E5), karşılıksızı Geri Al (E6), hesabın açılışını veriliş gününden sonraya alma (E1),
//          hesabı silme / pasife alma / türünü Vadeli yapma (E2–E4) → bu dalda açılış onarımı (h): kayıt yeniden "Bankada Tahsilde", veriliş günü
//          açılış günü; uygun olmayan hesapta "Onarım Bekliyor" ve Tahsil Edildi'de "Bankadan Geri Al" yolu; Mutabakat Testi tamam, yazım sürer.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { subTrial } from "../server/lib/general-ledger.mjs";
import { apiOf, integrityOf, integrityOk, pdfText } from "./banka-210-ortak.mjs";
import { BANK, bootBank, lockPeriod, must, TAHSILE_FLAGS, openAcceptanceAccounts, openAccount } from "./banka-210-hesap-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const cents = value => Math.round(Number(value || 0) * 100);
const parseTl = text => (text === "" || text === undefined || text === null ? 0 : Math.round(Number(String(text).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) * 100));
const sorted = list => [...list].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const report = (api, id, query = "") => must(`rapor ${id}`, api.get(`/api/workspace/report-center/${id}${query}`));
/** Yevmiye (gün): [hesap, borç kuruş, alacak kuruş], sıralı. */
const journalOf = async (api, day) => sorted((await report(api, "yevmiye", `?from=${day}&to=${day}`)).rows.map(row => [row[3], parseTl(row[4]), parseTl(row[5])]));
/** Hesap planı mizanı (kesit): kod → kuruş. */
const trialOf = async (api, query = "") => Object.fromEntries((await must("mizan", api.get(`/api/workspace/ledger${query}`))).trial.accounts.map(row => [row.code, cents(row.balance)]));
const pick = (trial, codes) => Object.fromEntries(codes.map(code => [code, trial[code] || 0]));
const customer = (api, name) => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-09-01" }));
const card = (api, accountId, name, total) => must(`kart ${name}`, api.post("/api/workspace/plans", { name, accountId, total, mode: "auto", count: 1, firstDue: "2026-11-30", registeredOn: "2026-10-01" }));
const planOf = async (api, id) => must("kart", api.get(`/api/workspace/plans/${id}`));

describe("T11 — taksite sayılmış çek karşılıksız: alış günü maddesi değişmez, karşılıksız günü B 120 / A 101.0x (sahte saat 27.10.2026)", () => {
  let ctx, api, acc;
  const c = {};
  before(async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api, TAHSILE_FLAGS);
    const a = await customer(api, "Alfa Taksit");
    const b = await customer(api, "Beta Taksit");
    const e = await customer(api, "Epsilon Taksit");
    c.supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Ciro Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
    c.planA = await card(api, a.id, "Alfa Kart", "2.400");
    c.planB = await card(api, b.id, "Beta Kart", "1.500");
    c.planE = await card(api, e.id, "Epsilon Kart", "800");
    // A: tahsile verilen (Ziraat, 12.10); B: portföyde; E: ciro edilen (15.10).
    c.A = await must("A al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "TA-1", accountId: a.id, planId: c.planA.id, amount: "2.400", issueDate: "2026-10-10", dueDate: "2026-10-22" }));
    c.B = await must("B al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "TB-1", accountId: b.id, planId: c.planB.id, amount: "1.500", issueDate: "2026-10-11", dueDate: "2026-10-22" }));
    c.E = await must("E al", api.post(CHEQUES, { direction: "in", instrument: "note", serialNo: "TE-1", accountId: e.id, planId: c.planE.id, amount: "800", issueDate: "2026-10-14", dueDate: "2026-10-22" }));
    await must("A tahsile", act(api, c.A.id, { action: "bank-deposit", date: "2026-10-12", bankAccountId: acc.ziraat.id }));
    await must("E ciro", act(api, c.E.id, { action: "endorse", date: "2026-10-15", accountId: c.supplier.id }));
    c.slice = await trialOf(api, "?to=2026-10-20");
    c.journal = { a: await journalOf(api, "2026-10-10"), b: await journalOf(api, "2026-10-11"), e: await journalOf(api, "2026-10-14") };
  });
  after(() => ctx?.server.close());

  it("alış günü maddeleri karşılıksızdan önce plan §3.14 gibi (B 101.01 / A 120)", () => {
    assert.deepEqual(c.journal.a, [["101.01", 240000, 0], ["120", 0, 240000]]);
    assert.deepEqual(c.journal.b, [["101.01", 150000, 0], ["120", 0, 150000]]);
    assert.deepEqual(c.journal.e, [["101.01", 80000, 0], ["120", 0, 80000]]);
  });

  it("karşılıksız (A tahsilde 23.10, B portföyde 24.10, E cirolu 26.10): 200; karşılıksız günü maddeleri; alış günü ve 20.10 kesiti değişmez", async () => {
    await must("A karşılıksız", act(api, c.A.id, { action: "bounce", date: "2026-10-23" }));
    await must("B karşılıksız", act(api, c.B.id, { action: "bounce", date: "2026-10-24" }));
    await must("E karşılıksız", act(api, c.E.id, { action: "bounce", date: "2026-10-26" }));
    assert.deepEqual(await journalOf(api, "2026-10-23"), [["101.02", 0, 240000], ["120", 240000, 0]], "A: B 120 / A 101.02");
    assert.deepEqual(await journalOf(api, "2026-10-24"), [["101.01", 0, 150000], ["120", 150000, 0]], "B: B 120 / A 101.01");
    assert.deepEqual(await journalOf(api, "2026-10-26"), [["101.01", 0, 80000], ["101.01", 80000, 0], ["120", 80000, 0], ["320", 0, 80000]], "E: müşteri borçlanır, ciro edilen tedarikçinin alacağı geri gelir");
    assert.deepEqual(await journalOf(api, "2026-10-10"), c.journal.a, "A alış günü değişmez");
    assert.deepEqual(await journalOf(api, "2026-10-11"), c.journal.b, "B alış günü değişmez");
    assert.deepEqual(await journalOf(api, "2026-10-14"), c.journal.e, "E alış günü değişmez");
    assert.deepEqual(await trialOf(api, "?to=2026-10-20"), c.slice, "20.10 kesiti karşılıksızdan önce ve sonra aynı");
  });

  it("son mizan: 602 yalnız taksitli satışlar (−4.700), 770 hareketsiz, 120 +4.700, 101 ve 101.01/101.02 sıfır; Mutabakat tamam", async () => {
    const trial = await trialOf(api);
    assert.deepEqual(pick(trial, ["101", "120", "320", "602", "770"]), { 101: 0, 120: 470000, 320: 0, 602: -470000, 770: 0 });
    const subs = Object.fromEntries((await must("alt", api.get(`${BANK}/sub-trial`))).rows.map(row => [row.sub, cents(row.balance)]));
    assert.deepEqual([subs["101.01"] || 0, subs["101.02"] || 0], [0, 0]);
    await integrityOk(api, "T11 karşılıksız sonrası");
  });

  it("taksit kartı yeniden açık: alış günündeki tahsilat kartta kalır, karşılıksız günü evraktan ters kayıt (düzenlenemez); kalan tutar", async () => {
    const plan = await planOf(api, c.planA.id);
    assert.deepEqual([plan.totals.paid, plan.totals.remaining], [0, 2400]);
    const linked = plan.entries.filter(entry => entry.chequeId === c.A.id).map(entry => [entry.kind, entry.date, entry.amount, entry.editable]);
    assert.deepEqual(sorted(linked), [["in", "2026-10-10", 2400, false], ["out", "2026-10-23", 2400, false]]);
  });

  it("karşılıksızı Geri Al: ters kayıt kalkar, kart ödenmiş, evrak yeniden Bankada Tahsilde; Mutabakat tamam", async () => {
    await must("A Geri Al", api.post(`${CHEQUES}/${c.A.id}/undo`, {}));
    assert.deepEqual(await journalOf(api, "2026-10-23"), []);
    const plan = await planOf(api, c.planA.id);
    assert.deepEqual([plan.totals.paid, plan.totals.remaining], [2400, 0]);
    assert.equal(ctx.store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", c.A.id).status, "pending");
    await must("B Geri Al", api.post(`${CHEQUES}/${c.B.id}/undo`, {}));
    assert.deepEqual(await journalOf(api, "2026-10-24"), []);
    await integrityOk(api, "T11 Geri Al sonrası");
  });
});

describe("T11 — dönem kilidinden (20.10) sonra taksite sayılmış, tahsildeki çek karşılıksız: 200; kilitli kesit değişmez", () => {
  let ctx, api;
  after(() => ctx?.server.close());
  it("karşılıksız 27.10 → 200; 20.10 kesiti ve 10.10 maddesi aynı; Geri Al da", async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    const acc = await openAcceptanceAccounts(api, TAHSILE_FLAGS);
    const m = await customer(api, "Teta Ltd");
    const plan = await card(api, m.id, "Teta Kart", "2.400");
    const cheque = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "TM-1", accountId: m.id, planId: plan.id, amount: "2.400", issueDate: "2026-10-10", dueDate: "2026-10-26" }));
    await must("tahsile", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-12", bankAccountId: acc.ziraat.id }));
    await lockPeriod(api, "2026-10-20");
    const slice = await trialOf(api, "?to=2026-10-20");
    const day = await journalOf(api, "2026-10-10");
    await must("karşılıksız (kilitten sonra)", act(api, cheque.id, { action: "bounce", date: "2026-10-27" }));
    assert.deepEqual(await trialOf(api, "?to=2026-10-20"), slice);
    assert.deepEqual(await journalOf(api, "2026-10-10"), day);
    assert.deepEqual(await journalOf(api, "2026-10-27"), [["101.02", 0, 240000], ["120", 240000, 0]]);
    await integrityOk(api, "kilit sonrası karşılıksız");
    await must("Geri Al", api.post(`${CHEQUES}/${cheque.id}/undo`, {}));
    assert.deepEqual(await trialOf(api, "?to=2026-10-20"), slice);
    await integrityOk(api, "kilit sonrası Geri Al");
  });
});

describe("T12 / T13 / B1 — rapor tutarı, zil önbelleği (Banka Ayarları, hesap adı) (sahte saat 27.10.2026)", () => {
  let ctx, api, acc, m;
  before(async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api, TAHSILE_FLAGS);
    m = await customer(api, "M3 Ticaret");
  });
  after(() => ctx?.server.close());

  it("T12: geri alınmış evrakın tutarı 1.000 → 1.250 düzelince Çek / Senet Hareketleri tahsile verme ve geri alma satırları 1.000 (yevmiye ile aynı)", async () => {
    const x = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "X1", accountId: m.id, amount: "1.000", issueDate: "2026-10-14", dueDate: "2026-11-05" }));
    await must("ver", act(api, x.id, { action: "bank-deposit", date: "2026-10-15", bankAccountId: acc.ziraat.id }));
    await must("geri al", act(api, x.id, { action: "bank-withdraw", date: "2026-10-16" }));
    await must("tutar", api.put(`${CHEQUES}/${x.id}`, { amount: "1.250" }));
    assert.deepEqual(await journalOf(api, "2026-10-15"), [["101.01", 0, 100000], ["101.02", 100000, 0]]);
    const rows = (await report(api, "cek-hareketleri", "?from=2026-10-14&to=2026-10-16")).rows.filter(row => /Bankaya|Bankadan/.test(row[4])).map(row => [row[0], row[4], parseTl(row[6])]);
    assert.deepEqual(rows, [["15.10.2026", "Bankaya Tahsile Verildi", 100000], ["16.10.2026", "Bankadan Geri Alındı", 100000]]);
  });

  const zil = async label => (await must("dues", api.get("/api/workspace/dues"))).items.find(item => item.label.includes(label));
  it("T13: Yarım Gün 'İş Günü Sayılmaz' seçilince zil beklenen günü 28.10 → 30.10 (Vade Takip ile aynı); geri alınınca 28.10", async () => {
    const w = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "W1", accountId: m.id, amount: "700", issueDate: "2026-10-20", dueDate: "2026-10-28" }));
    await must("ver", act(api, w.id, { action: "bank-deposit", date: "2026-10-21", bankAccountId: acc.ziraat.id }));
    const vade = async () => (await must("vade", api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque"))).rows.find(row => /No W1/.test(row.label))?.date;
    assert.deepEqual([(await zil("No W1")).dueDate, await vade()], ["2026-10-28", "2026-10-28"]);
    await must("ayar", api.put(`${BANK}/settings`, { values: { holidayAdvanced: { halfDay: "holiday" } } }));
    assert.deepEqual([(await zil("No W1")).dueDate, await vade()], ["2026-10-30", "2026-10-30"], "arife iş günü sayılmaz: 28.10 → 30.10 (29.10 tatil)");
    await must("ayar geri", api.put(`${BANK}/settings`, { values: { holidayAdvanced: { halfDay: "business" } } }));
    assert.equal((await zil("No W1")).dueDate, "2026-10-28");
  });

  it("B1: banka hesabının adı değişince zil tahsildeki evrakı yeni adla (çek kartı ile aynı)", async () => {
    const z = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "Z1", accountId: m.id, amount: "500", issueDate: "2026-10-20", dueDate: "2026-10-29" }));
    await must("ver", act(api, z.id, { action: "bank-deposit", date: "2026-10-21", bankAccountId: acc.garanti.id }));
    assert.match((await zil("No Z1")).label, /Garanti BBVA/);
    await must("ad", api.put(`${BANK}/accounts/${acc.garanti.id}`, { bankName: "Yapı Kredi" }));
    assert.match((await must("kart", api.get(`${CHEQUES}/${z.id}`))).statusLabel, /Yapı Kredi/);
    assert.match((await zil("No Z1")).label, /Yapı Kredi/);
  });
});

describe("ozet / proto / A22 — pencere özeti, tanınmayan eylem, karşılıksızlı hesabın silinmesi (sahte saat 08.10.2026)", () => {
  let ctx, api, acc, buyer;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    acc = await openAcceptanceAccounts(api, TAHSILE_FLAGS);
    buyer = await customer(api, "ABC Ltd.");
  });
  after(() => ctx?.server.close());

  it("ozet: iki 1.000'lik alınan çek, biri tahsilde → pencere ve PDF 'Portföyde (alınan)' 1.000, 'Bankada Tahsilde' 1.000 (rapor ile aynı)", async () => {
    const a = await must("al 1", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "P1", accountId: buyer.id, amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31" }));
    await must("al 2", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "P2", accountId: buyer.id, amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31" }));
    await must("ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    const list = await must("liste", api.get(CHEQUES));
    assert.deepEqual([list.summary.in.open, list.summary.deposited], [{ count: 1, amount: 1000 }, { count: 1, amount: 1000 }]);
    const summary = Object.fromEntries((await report(api, "cek-portfoy")).summary);
    assert.deepEqual([parseTl(summary["Portföyde (alınan)"]), parseTl(summary["Bankada Tahsilde"])], [100000, 100000]);
    const text = pdfText((await api.raw("GET", `${CHEQUES}/liste.pdf`)).buffer).replace(/\s+/g, " ");
    assert.match(text, /Portföyde \(alınan\) 1 · 1\.000,00/);
    assert.match(text, /Bankada Tahsilde 1 · 1\.000,00/);
  });

  it("proto: eylem adı hasOwnProperty / __proto__ / toString / constructor / valueOf → 409 tanınmayan işlem; evrak bankada ve portföyde kalır", async () => {
    const dep = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "PR1", accountId: buyer.id, amount: "300", issueDate: "2026-10-05", dueDate: "2026-10-31" }));
    const port = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "PR2", accountId: buyer.id, amount: "300", issueDate: "2026-10-05", dueDate: "2026-10-31" }));
    await must("ver", act(api, dep.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    const heads = () => ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE cheque_id IN (?, ?)", dep.id, port.id).n;
    const before0 = heads();
    for (const action of ["hasOwnProperty", "__proto__", "toString", "constructor", "valueOf"]) {
      for (const cheque of [dep, port]) {
        const res = await act(api, cheque.id, { action, date: "2026-10-07" });
        assert.equal(res.status, 409, `${action}: ${res.status} ${res.error}`);
        assert.match(res.error, /tanınmadı/);
      }
    }
    assert.equal(ctx.store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", dep.id).status, "pending");
    assert.equal(ctx.store.get("SELECT status FROM cheques WHERE id = ?", port.id).status, "portfolio");
    assert.equal(heads(), before0, "işlem başlığı yazılmadı");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type IN ('cheque.hasOwnProperty', 'cheque.__proto__', 'cheque.toString', 'cheque.constructor', 'cheque.valueOf', 'cheque.bank-withdraw')").n, 0, "işlem geçmişine yazılmadı");
    await integrityOk(api, "proto");
  });

  it("A22: karşılıksız dönmüş evrakın hesabı silinmez (409); Geri Al çalışır; Bankadan Geri Al'ınca hesap silinir", async () => {
    const isb = await openAccount(api, { bankName: "İş Bankası", name: "Çek Hesabı", kind: "demand", currency: "TRY", ...TAHSILE_FLAGS, opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const cheque = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "A22", accountId: buyer.id, amount: "600", issueDate: "2026-10-05", dueDate: "2026-10-31" }));
    await must("ver", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: isb.id }));
    await must("karşılıksız", act(api, cheque.id, { action: "bounce", date: "2026-10-07" }));
    const del = await api.del(`${BANK}/accounts/${isb.id}`);
    assert.equal(del.status, 409, `sil: ${del.status} ${del.error}`);
    assert.equal(del.code, "bank-cheques-returned");
    assert.match(del.error, /Pasife Al/);
    assert.equal(ctx.store.get("SELECT deleted_at FROM bank_accounts WHERE id = ?", isb.id).deleted_at, null);
    await must("Geri Al", api.post(`${CHEQUES}/${cheque.id}/undo`, {}));
    assert.equal(ctx.store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", cheque.id).status, "pending");
    await must("Bankadan Geri Al", act(api, cheque.id, { action: "bank-withdraw", date: "2026-10-08" }));
    await must("sil (geri alınmış kayıt)", api.del(`${BANK}/accounts/${isb.id}`));
    await integrityOk(api, "A22");
  });
});

describe("G1 — Alt Hesap Mizanı 101.01 / 101.02: Ana Defter kurulmadan, Ana Defter'le aynı (bütün evrak akışları, beş dönem)", () => {
  let ctx, api, acc;
  before(async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api, TAHSILE_FLAGS);
    const buyer = await customer(api, "Gama Müşteri");
    const seller = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Gama Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
    const plan = await card(api, buyer.id, "Gama Kart", "5.000");
    let n = 0;
    const take = (body = {}) => must(`al ${n}`, api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: `G-${++n}`, accountId: buyer.id, amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body }));
    const run = async (cheque, steps) => {
      for (const [action, date, extra = {}] of steps) await must(`${cheque.serialNo} ${action}`, action === "undo" ? api.post(`${CHEQUES}/${cheque.id}/undo`, {}) : act(api, cheque.id, { action, date, ...extra }));
    };
    const z = acc.ziraat.id;
    const g = acc.garanti.id;
    await run(await take(), [["collect", "2026-10-08", { method: "bank", bankAccountId: z }]]);
    await run(await take({ amount: "1.250,50" }), [["bank-deposit", "2026-10-09", { bankAccountId: z }], ["collect", "2026-10-21"]]);
    await run(await take(), [["bank-deposit", "2026-10-09", { bankAccountId: z }], ["bank-withdraw", "2026-10-12"], ["endorse", "2026-10-13", { accountId: seller.id }]]);
    await run(await take(), [["endorse", "2026-10-07", { accountId: seller.id }], ["bounce", "2026-10-22"]]);
    await run(await take({ amount: "730" }), [["bank-deposit", "2026-10-10", { bankAccountId: g }], ["bounce", "2026-10-23"]]);
    await run(await take({ planId: plan.id, amount: "900" }), [["bank-deposit", "2026-10-10", { bankAccountId: g }], ["bounce", "2026-10-24"]]);
    await run(await take({ planId: plan.id, amount: "600" }), [["bounce", "2026-10-24"]]);
    await run(await take({ planId: plan.id, amount: "400" }), [["bank-deposit", "2026-10-11", { bankAccountId: z }]]);
    await run(await take({ accountId: "", drawer: "Carisiz Keşideci", amount: "350" }), [["bounce", "2026-10-20"]]);
    await run(await take({ accountId: "", drawer: "Carisiz Keşideci", amount: "450" }), [["bank-deposit", "2026-10-12", { bankAccountId: z }], ["bounce", "2026-10-25"]]);
    await run(await take({ accountId: "", drawer: "Carisiz Keşideci", amount: "275" }), [["bank-deposit", "2026-10-12", { bankAccountId: g }]]);
    await run(await take({ instrument: "note", amount: "820" }), [["bank-deposit", "2026-10-14", { bankAccountId: z }], ["bank-withdraw", "2026-10-15"], ["bank-deposit", "2026-10-16", { bankAccountId: g }]]);
    await run(await take({ amount: "640" }), [["bank-deposit", "2026-10-14", { bankAccountId: z }], ["bounce", "2026-10-18"], ["undo"], ["collect", "2026-10-26"]]);
    await take({ amount: "510", issueDate: "2026-10-19" });
    const gone = await take({ amount: "999" });
    await must("sil", api.del(`${CHEQUES}/${gone.id}`));
    await integrityOk(api, "G1 verisi");
  });
  after(() => ctx?.server.close());

  const reference = (from, to) =>
    subTrial(ctx.app.context.ledger.build(), { from, to })
      .filter(row => row.account === "101")
      .map(row => ({ sub: row.sub, opening: cents(row.opening), debit: cents(row.debit), credit: cents(row.credit), balance: cents(row.balance) }));
  for (const [from, to] of [["", ""], ["2026-10-01", "2026-10-15"], ["2026-10-16", "2026-10-31"], ["2026-10-20", ""], ["", "2026-10-12"]]) {
    it(`dönem ${from || "…"} – ${to || "…"}: 101.01 / 101.02 Ana Defter ile aynı`, async () => {
      const query = new URLSearchParams(Object.entries({ from, to }).filter(([, value]) => value)).toString();
      const data = await must("alt hesap", api.get(`${BANK}/sub-trial${query ? `?${query}` : ""}`));
      const got = data.rows.filter(row => row.account === "101").map(row => ({ sub: row.sub, opening: cents(row.opening), debit: cents(row.debit), credit: cents(row.credit), balance: cents(row.balance) }));
      assert.deepEqual(got, reference(from, to));
      assert.ok(got.some(row => row.sub === "101.02" && (row.debit || row.credit || row.opening)), "101.02 hareketli");
      const main = data.mains.find(item => item.account === "101");
      if (main) assert.equal(main.ok, true);
    });
  }

  it("saklanan toplam yazımdan sonra yenilenir: tahsile verme ve tahsil sonrası 101.01 / 101.02 Ana Defter ile aynı (eski değer dönmez)", async () => {
    const read = async () => (await must("alt hesap", api.get(`${BANK}/sub-trial`))).rows.filter(row => row.account === "101").map(row => ({ sub: row.sub, opening: cents(row.opening), debit: cents(row.debit), credit: cents(row.credit), balance: cents(row.balance) }));
    const first = await read();
    assert.deepEqual(await read(), first, "veri değişmeden aynı");
    const buyer = await customer(api, "Saklama Müşteri");
    const cheque = await must("al", api.post(CHEQUES, { direction: "in", instrument: "cheque", serialNo: "G-SAK", accountId: buyer.id, amount: "777", issueDate: "2026-10-26", dueDate: "2026-11-30" }));
    const afterReceive = await read();
    assert.notDeepEqual(afterReceive, first);
    assert.deepEqual(afterReceive, reference("", ""));
    await must("ver", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-27", bankAccountId: acc.ziraat.id }));
    assert.deepEqual(await read(), reference("", ""));
    await must("tahsil", act(api, cheque.id, { action: "collect", date: "2026-10-27" }));
    assert.deepEqual(await read(), reference("", ""));
  });

  it("Alt Hesap Mizanı (ekran ve rapor) Ana Defter'i kurmaz (her açılışta bütün evrak için yevmiye kurulmaz)", async () => {
    const service = ctx.app.context.ledger;
    const original = service.build;
    let calls = 0;
    service.build = (...args) => {
      calls += 1;
      return original(...args);
    };
    try {
      await must("alt hesap", api.get(`${BANK}/sub-trial`));
      await must("alt hesap dönem", api.get(`${BANK}/sub-trial?from=2026-10-10&to=2026-10-20`));
      await report(api, "alt-hesap-mizani", "?preset=all");
    } finally {
      service.build = original;
    }
    assert.equal(calls, 0, "Ana Defter kuruldu");
  });
});

// E1–E6 — gerçek v2.1.0 koduna dönüş (git etiketi; sığ klonda atlanır). Bu dalda: Ziraat · Çek Tahsil (açılış 01.10, 0), alış 03.10, tahsile verme
// 06.10; isteğe bağlı bu dalda bir ön adım; v2.1.0'da bir adım; bu dal yeniden açılınca açılış onarımı (h).
const OLD = "v2.1.0";
async function oldVersion(name, oldStep, newStep = null) {
  const root = mkdtempSync(path.join(tmpdir(), `tahsile-tur2-${name}-`));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  try {
    let ids;
    {
      const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
      try {
        const api = apiOf((await server.login()).client);
        const account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Çek Tahsil", kind: "demand", currency: "TRY", ...TAHSILE_FLAGS, opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
        const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
        const cheque = await must("çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "800", issueDate: "2026-10-03", dueDate: "2026-11-05", accountId: buyer.id, serialNo: `ES-${name}` }));
        await must("tahsile", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: account.id }));
        ids = { cheque: cheque.id, account: account.id, buyer: buyer.id };
        if (newStep) await must(`${name} ön adım`, newStep(api, ids));
      } finally {
        await server.close();
      }
    }
    {
      const old = await bootVersion(OLD, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
      try {
        const res = await oldStep(apiOf((await old.login()).client), ids);
        assert.equal(res.status, 200, `${name} eski sürüm adımı: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      } finally {
        await old.close();
      }
    }
    const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
    try {
      const api = apiOf((await server.login()).client);
      const store = server.app.store;
      const record = store.get("SELECT status, given_date AS given, closed_date AS closed, close_event_id AS closeId FROM cheque_collections WHERE cheque_id = ?", ids.cheque);
      const repair = JSON.parse(store.setting("meta.bank.repair", "") || "{}");
      const log = store.get("SELECT summary FROM integrity_log WHERE action = 'repair' ORDER BY at DESC LIMIT 1")?.summary || "";
      const integrity = await integrityOf(api);
      const detail = await must("çek kartı", api.get(`${CHEQUES}/${ids.cheque}`));
      return { api, store, ids, record, repair, log, integrity, detail, close: () => server.close() };
    } catch (error) {
      await server.close();
      throw error;
    }
  } finally {
    // Klasör testin sonunda silinir (sunucu kapandıktan sonra; Windows'ta açık dosya silinmez).
    process.once("beforeExit", () => rmSync(root, { recursive: true, force: true }));
  }
}
const failuresOf = result => JSON.stringify(result.checks.filter(item => !item.ok).map(item => [item.code, item.sample]));
/** Kullanıcı çalışmayı sürdürür: evrakı tahsil eder (bankadan) ya da Bankadan Geri Al'ır; yeni çek; Mutabakat tamam. */
async function carryOn(t, { collect = true } = {}) {
  if (collect) await must("Tahsil Edildi", act(t.api, t.ids.cheque, { action: "collect", date: "2026-10-09" }));
  await must("yeni çek", t.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "300", issueDate: "2026-10-09", dueDate: "2026-11-09", accountId: t.ids.buyer, serialNo: `YENI-${t.ids.cheque.slice(-6)}` }));
  await integrityOk(t.api, "sonra yazım");
}

describe(`E1–E6 — ${OLD}'a dönüp tahsil kaydına dokunma; bu dalda açılış onarımı (h)`, { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok` }, () => {
  it("E5 bu dalda tahsil (07.10) → v2.1.0'da tahsili Geri Al: kayıt yeniden Bankada Tahsilde; Mutabakat tamam; Tahsil Edildi çalışır", { timeout: 300_000 }, async () => {
    const t = await oldVersion("tahsil-geri", (api, ids) => api.post(`${CHEQUES}/${ids.cheque}/undo`, {}), (api, ids) => act(api, ids.cheque, { action: "collect", date: "2026-10-07" }));
    try {
      assert.deepEqual([t.record.status, t.record.closed, t.record.closeId], ["pending", "", ""]);
      assert.equal(t.integrity.ok, true, failuresOf(t.integrity));
      assert.match(t.detail.statusLabel, /Bankada Tahsilde/);
      assert.match(t.log, /yeniden açılan tahsil kaydı 1/);
      await carryOn(t);
    } finally {
      await t.close();
    }
  });
  it("E6 bu dalda karşılıksız (07.10) → v2.1.0'da karşılıksızı Geri Al: kayıt yeniden Bankada Tahsilde, kapanış başlığı iptal; Mutabakat tamam", { timeout: 300_000 }, async () => {
    const t = await oldVersion("karsiliksiz-geri", (api, ids) => api.post(`${CHEQUES}/${ids.cheque}/undo`, {}), (api, ids) => act(api, ids.cheque, { action: "bounce", date: "2026-10-07" }));
    try {
      assert.deepEqual([t.record.status, t.record.closed], ["pending", ""]);
      assert.equal(t.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE cheque_id = ? AND type = 'cheque_withdraw' AND status = 'active'", t.ids.cheque).n, 0, "kapanış başlığı iptal");
      assert.equal(t.integrity.ok, true, failuresOf(t.integrity));
      assert.match(t.detail.statusLabel, /Bankada Tahsilde/);
      await carryOn(t);
    } finally {
      await t.close();
    }
  });
  it("E1 v2.1.0'da Açılışı Düzelt 07.10 (veriliş 06.10'dan sonra): veriliş günü açılış gününe; Mutabakat tamam; Tahsil Edildi çalışır", { timeout: 300_000 }, async () => {
    const t = await oldVersion("acilis", (api, ids) => api.post(`${BANK}/accounts/${ids.account}/opening`, { date: "2026-10-07" }));
    try {
      assert.deepEqual([t.record.status, t.record.given], ["pending", "2026-10-07"]);
      assert.equal(t.store.get("SELECT date FROM fin_events WHERE cheque_id = ? AND type = 'cheque_deposit'", t.ids.cheque).date, "2026-10-07");
      assert.equal(t.integrity.ok, true, failuresOf(t.integrity));
      await carryOn(t);
    } finally {
      await t.close();
    }
  });
  it("E7 (T11 komşusu) v2.1.0'da taksite sayılmış çek karşılıksız (tahsilat SİLİNDİ, eski biçim) → bu dalda Geri Al tahsilatı geri getirir, yeniden karşılıksız ters kayıt yazar; Mutabakat tamam", { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "tahsile-tur2-E7-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    let ids;
    try {
      {
        const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
        try {
          const api = apiOf((await server.login()).client);
          const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Eski Taksitli", type: "customer", registeredOn: "2026-09-01" }));
          const plan = await must("kart", api.post("/api/workspace/plans", { name: "Eski Kart", accountId: buyer.id, total: "1.200", mode: "auto", count: 1, firstDue: "2026-11-30", registeredOn: "2026-10-01" }));
          const cheque = await must("çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.200", issueDate: "2026-10-03", dueDate: "2026-11-05", accountId: buyer.id, planId: plan.id, serialNo: "E7-1" }));
          ids = { cheque: cheque.id, plan: plan.id };
        } finally {
          await server.close();
        }
      }
      {
        const old = await bootVersion(OLD, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
        try {
          await must("v2.1.0 karşılıksız", act(apiOf((await old.login()).client), ids.cheque, { action: "bounce", date: "2026-10-09" }));
        } finally {
          await old.close();
        }
      }
      const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-10T12:00:00+03:00" });
      try {
        const api = apiOf((await server.login()).client);
        const linked = () => server.app.store.all("SELECT kind, date FROM plan_entries WHERE cheque_id = ? ORDER BY kind", ids.cheque).map(row => [row.kind, row.date]);
        assert.deepEqual(linked(), [], "eski biçim: tahsilat silinmiş");
        await integrityOk(api, "E7 açılış");
        await must("Geri Al (eski biçim)", api.post(`${CHEQUES}/${ids.cheque}/undo`, {}));
        assert.deepEqual(linked(), [["in", "2026-10-03"]]);
        assert.deepEqual((await must("kart", api.get(`/api/workspace/plans/${ids.plan}`))).totals.paid, 1200);
        await must("yeniden karşılıksız", act(api, ids.cheque, { action: "bounce", date: "2026-10-10" }));
        assert.deepEqual(linked(), [["in", "2026-10-03"], ["out", "2026-10-10"]]);
        assert.deepEqual(await journalOf(api, "2026-10-10"), [["101.01", 0, 120000], ["120", 120000, 0]]);
        await integrityOk(api, "E7 yeniden karşılıksız");
      } finally {
        await server.close();
      }
    } finally {
      process.once("beforeExit", () => rmSync(root, { recursive: true, force: true }));
    }
  });
  for (const [name, step, pattern] of [
    ["E2 hesabı sil", (api, ids) => api.del(`${BANK}/accounts/${ids.account}`), /silin/],
    ["E3 hesabı pasife al", (api, ids) => api.post(`${BANK}/accounts/${ids.account}/status`, { status: "passive" }), /pasif/],
    ["E4 hesap türü Vadeli", (api, ids) => api.put(`${BANK}/accounts/${ids.account}`, { kind: "time" }), /Vadesiz, Ticari ya da Diğer/],
  ]) {
    it(`${name} (v2.1.0): Onarım Bekliyor uyarısı; Tahsil Edildi nedenli ret ve Bankadan Geri Al yolu; Geri Al sonra tamam`, { timeout: 300_000 }, async () => {
      const t = await oldVersion(name.split(" ")[0], step);
      try {
        assert.equal(t.record.status, "pending");
        const warning = (t.repair.pending || []).find(item => item.kind === "h");
        assert.ok(warning, `onarım bekliyor: ${JSON.stringify(t.repair.pending)}`);
        assert.match(warning.reason, pattern);
        assert.match(warning.reason, /Bankadan Geri Al/);
        assert.match(t.log, /Onarım Bekliyor/);
        const collect = await act(t.api, t.ids.cheque, { action: "collect", date: "2026-10-09" });
        assert.notEqual(collect.status, 200);
        assert.match(collect.error, /Bankadan Geri Al/);
        await must("Bankadan Geri Al", act(t.api, t.ids.cheque, { action: "bank-withdraw", date: "2026-10-09" }));
        await carryOn(t, { collect: false });
      } finally {
        await t.close();
      }
    });
  }
});
