// 2.5.0 Ç5-B — Tek Yükümlülük Kuyruğu (lib/obligation-queue.mjs) saf işlev testleri. Her karar için ELLE hesaplanmış beklenen (karar metninden; programın çıktısından DEĞİL —
// ders 5, 40) + mutasyon (tools/ yok; test/tyk-mutasyon-250.mjs her kararın karşı seçeneğini enjekte eder, bu dosya kırmızı olmalı). Tasarım: docs/erp/C5B-TYK-TASARIM.md.
// Kararlar (docs/2.5.0-IS-LISTESI.md D, AYNEN): S1, S2, S68, karar (1)(2)(3)(5), S8, S11, S18, S19, S50, M1a, M1e, M1f, K8-3, M13, S67, S69, Y3-1.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildObligations, calendarState, lockAtOf, lockHistory } from "../server/lib/obligation-queue.mjs";
import { allocate } from "../server/lib/plans.mjs";

let seq = 0;
const at = (date, n = 0) => `${date}T09:${String(10 + (n % 50)).padStart(2, "0")}:00.000Z`;
// Satır kurucuları (lib/accounts.mjs accountLedger satır biçimi).
const sale = (id, date, amount, dueDate = "", extra = {}) => ({ inv: { id, kind: "sale", status: "issued", payable: amount, dueDate, planId: "", ...extra }, line: { id: `l-${id}`, origin: "invoice", kind: "debt", sourceId: id, date, at: at(date, seq++), debit: amount, credit: 0 } });
const purchase = (id, date, amount, dueDate = "") => ({ inv: { id, kind: "purchase", status: "issued", payable: amount, dueDate, planId: "" }, line: { id: `l-${id}`, origin: "invoice", kind: "credit", sourceId: id, date, at: at(date, seq++), debit: 0, credit: amount } });
const tahsilat = (id, date, amount, extra = {}) => ({ id, origin: "account", kind: "in", date, at: at(date, seq++), debit: 0, credit: amount, label: "Tahsilat", ...extra });
const odeme = (id, date, amount, extra = {}) => ({ id, origin: "account", kind: "out", date, at: at(date, seq++), debit: amount, credit: 0, label: "Ödeme", ...extra });
const borc = (id, date, amount) => ({ id, origin: "account", kind: "debt", date, at: at(date, seq++), debit: amount, credit: 0, label: "Borç" });
const alacak = (id, date, amount) => ({ id, origin: "account", kind: "credit", date, at: at(date, seq++), debit: 0, credit: amount, label: "Alacak" });
const build = ({ docs = [], lines = [], today, ...rest }) => buildObligations({ lines: [...docs.map(d => d.line), ...lines], invoices: docs.map(d => d.inv), today, ...rest });
const open = (result, id) => result.invoices.get(id).open;
const state = (result, id) => result.invoices.get(id).state;
const gecikmis = (result, day) => result.overdue(day).amount;

describe("TYK — vade ve gecikmiş (S1, M1f)", () => {
  it("S1: vadesiz kalemin vadesi belge günü — o gün gecikmiş DEĞİL, ertesi gün gecikmiş; M1f: vade günü gecikmiş değil", () => {
    const f = sale("F1", "2026-03-10", 1000);
    const g = sale("F2", "2026-03-01", 500, "2026-03-20");
    const r = build({ docs: [f, g], today: "2026-03-10" });
    assert.equal(gecikmis(r, "2026-03-10"), 0, "belge günü gecikmiş değil");
    assert.equal(gecikmis(r, "2026-03-11"), 1000, "vadesiz fatura ertesi gün gecikmiş");
    assert.equal(gecikmis(r, "2026-03-20"), 1000, "vade günü (20.03) F2 gecikmiş değil");
    assert.equal(gecikmis(r, "2026-03-21"), 1500, "vadenin ertesi günü F2 de gecikmiş");
    assert.equal(state(r, "F1"), "open", "fatura durumu belge günü Açık");
    const next = build({ docs: [f, g], today: "2026-03-11" });
    assert.equal(state(next, "F1"), "overdue", "ertesi gün Vadesi Geçti (vadesiz = belge günü)");
  });
  // EK-1 §1 (BAŞ MİMAR M1a; madde 1 "müşteriye para iadesi (T-09)" borç kalemi; madde 5 gecikmiş = Σ açık borç kalemi): netleşmemiş borç yönlü bağsız ödeme de açık borç
  // kalemidir, vadesi kendi günü (S1). Örnek (cari kâhini c13 S1): satış 500 (01.05) · 01.06 aynı gün elle Alacak 300, faturasız stok iadesi 300, müşteriye Ödeme 300 →
  // bakiye 200; Alacak satışla netleşir (karar (5)), iade kalan 200'ü ve 100 avans, Ödeme avansı kapatır ve 200 açık borç kalemi kalır → 02.06'dan itibaren gecikmiş 200.
  // (Yalnız yükümlülük rolü sayılsaydı gecikmiş 0 olurdu — bakiye 200, vadesi geçmiş satış.) Rapor: KULLANICIYA SORULMALI (tedarikçiye avans da sayılır).
  it("gecikmiş: netleşmemiş bağsız ödeme de açık borç kalemidir (EK-1 §1 T-09) — vadesi geçmiş satış gecikmişten kaybolmaz", () => {
    const stokIade = (id, date, amount) => ({ id, origin: "stock", stockReason: "return", kind: "in", date, at: at(date, seq++), debit: 0, credit: amount, label: "Stok İadesi" });
    const r = build({ docs: [sale("F1", "2026-05-01", 500)], lines: [alacak("A1", "2026-06-01", 300), stokIade("I1", "2026-06-01", 300), odeme("O1", "2026-06-01", 300)], dueDates: new Map([["A1", "2026-06-18"]]), today: "2026-06-10" });
    assert.equal(r.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0), 200, "Σ kalem = bakiye 200");
    assert.equal(gecikmis(r, "2026-06-01"), 0, "ödeme günü gecikmiş değil (M1f)");
    assert.equal(gecikmis(r, "2026-06-10"), 200, "vadesi geçmiş 200 gecikmişte");
    const av = build({ lines: [odeme("AV", "2026-03-01", 1000), borc("B", "2026-03-02", 200)], today: "2026-03-10" });
    assert.equal(gecikmis(av, "2026-03-10"), 1200, "tedarikçiye avans da açık borç kalemi (EK-1 §1; KULLANICIYA SORULMALI)");
  });
  it("elle Borç Yaz: Vade Tarihi yoksa belge günü (S1), varsa Vade Tarihi", () => {
    const r = build({ lines: [borc("B1", "2026-01-05", 300), borc("B2", "2026-01-05", 200)], dueDates: new Map([["B2", "2026-02-01"]]), today: "2026-01-20" });
    assert.equal(gecikmis(r, "2026-01-20"), 300);
    assert.equal(gecikmis(r, "2026-02-02"), 500);
  });
});

describe("TYK — bağsız ödemenin sırası (S2, karar (1), S68)", () => {
  it("S2: bağsız tahsilat vadesi önce gelen borcu kapatır (belge tarihi değil)", () => {
    // F1 01.01 vade 01.03 · F2 05.01 vade 20.01 · tahsilat 25.01 1.000 → F2 kapanır (vade 20.01 < 01.03); F1 1.000 açık.
    const r = build({ docs: [sale("F1", "2026-01-01", 1000, "2026-03-01"), sale("F2", "2026-01-05", 1000, "2026-01-20")], lines: [tahsilat("P", "2026-01-25", 1000)], today: "2026-02-10" });
    assert.deepEqual([open(r, "F1"), open(r, "F2")], [1000, 0]);
    assert.equal(gecikmis(r, "2026-02-10"), 0, "vadesi geçmiş F2 kapandı, F1'in vadesi gelmedi");
  });
  it("S2 eşitlikte: aynı vade → belge tarihi → kayıt anı → yazım sırası (giriş sırası ters verilse de aynı — ders 31)", () => {
    const a = sale("A", "2026-01-02", 100, "2026-02-01");
    const b = sale("B", "2026-01-01", 100, "2026-02-01");
    const pay = tahsilat("P", "2026-01-10", 100);
    const r1 = build({ docs: [a, b], lines: [pay], today: "2026-03-01" });
    const r2 = build({ docs: [b, a], lines: [pay], today: "2026-03-01" });
    assert.deepEqual([open(r1, "A"), open(r1, "B")], [100, 0], "aynı vade: belge tarihi eski olan (B) önce");
    assert.deepEqual([open(r2, "A"), open(r2, "B")], [100, 0], "girdi sırası ters: sonuç aynı");
    // Aynı vade + aynı belge günü → kayıt anı.
    const c = { inv: { id: "C", kind: "sale", status: "issued", payable: 100, dueDate: "2026-02-01", planId: "" }, line: { id: "l-C", origin: "invoice", kind: "debt", sourceId: "C", date: "2026-01-03", at: "2026-01-03T15:00:00.000Z", debit: 100, credit: 0 } };
    const d = { inv: { id: "D", kind: "sale", status: "issued", payable: 100, dueDate: "2026-02-01", planId: "" }, line: { id: "l-D", origin: "invoice", kind: "debt", sourceId: "D", date: "2026-01-03", at: "2026-01-03T08:00:00.000Z", debit: 100, credit: 0 } };
    const r3 = build({ docs: [c, d], lines: [tahsilat("Q", "2026-01-10", 100)], today: "2026-03-01" });
    assert.deepEqual([open(r3, "C"), open(r3, "D")], [100, 0], "kayıt anı önce olan (D 08:00)");
  });
  it("karar (1): ödeme KENDİ tarihinde açık borçlara — sonradan doğan erken vadeli borca kaymaz, kapanmış kalem yeniden açılmaz", () => {
    // F1 01.01 vade 30.06; ödeme 10.01 1.000 (o gün yalnız F1 var) → F1 kapanır. F2 15.01 vade 20.01 sonradan doğar → açık (havuz okumasında F2 kapanırdı).
    const r = build({ docs: [sale("F1", "2026-01-01", 1000, "2026-06-30"), sale("F2", "2026-01-15", 1000, "2026-01-20")], lines: [tahsilat("P", "2026-01-10", 1000)], today: "2026-02-01" });
    assert.deepEqual([open(r, "F1"), open(r, "F2")], [0, 1000]);
    assert.equal(gecikmis(r, "2026-02-01"), 1000);
  });
  it("karar (1): artan ödeme avanstır, sonra doğan borca doğduğu gün uygulanır", () => {
    const r = build({ docs: [sale("F1", "2026-01-01", 300), sale("F2", "2026-01-20", 1000)], lines: [tahsilat("P", "2026-01-10", 800)], today: "2026-02-01" });
    assert.deepEqual([open(r, "F1"), open(r, "F2")], [0, 500], "300 F1, avans 500 F2'ye");
  });
  it("karar (1): aynı gün önce borç kalemleri — aynı gün kesilen fatura aynı günkü bağsız tahsilatla kapanır (kayıt anı sonra olsa da)", () => {
    const f = { inv: { id: "F", kind: "sale", status: "issued", payable: 400, dueDate: "", planId: "" }, line: { id: "l-F", origin: "invoice", kind: "debt", sourceId: "F", date: "2026-04-01", at: "2026-04-01T17:00:00.000Z", debit: 400, credit: 0 } };
    const pay = { id: "P", origin: "account", kind: "in", date: "2026-04-01", at: "2026-04-01T08:00:00.000Z", debit: 0, credit: 400 };
    const r = build({ docs: [sale("E", "2026-03-01", 400, "2026-05-01"), f], lines: [pay], today: "2026-04-10" });
    assert.deepEqual([open(r, "F"), open(r, "E")], [0, 400], "aynı gün F (vade 01.04) önce — E'nin vadesi 01.05");
  });
  it("S68: bizim bağlamadan yaptığımız ödeme vadesi en önce gelen alacak kalemini kapatır (iki yön)", () => {
    const r = build({ docs: [purchase("A1", "2026-01-01", 500, "2026-03-01"), purchase("A2", "2026-01-05", 500, "2026-01-25")], lines: [odeme("O", "2026-01-20", 500)], today: "2026-02-10" });
    assert.deepEqual([open(r, "A1"), open(r, "A2")], [500, 0]);
  });
});

describe("TYK — bağlar (karar (2), (3))", () => {
  it("karar (2): bağ hedefini her durumda kapatır; hedefi önceden kapatmış bağsız ödeme serbest kalır ve kendi tarihinde yeniden dağılır", () => {
    // P1 25.01 bağsız → F2 (vade 20.01) kapanırdı; P2 26.01 F2'ye bağlı → F2 bağla kapanır, P1 serbest kalır ve 25.01'de açık olan F1'i kapatır.
    const r = build({ docs: [sale("F1", "2026-01-01", 1000, "2026-03-01"), sale("F2", "2026-01-05", 1000, "2026-01-20")], lines: [tahsilat("P1", "2026-01-25", 1000), tahsilat("P2", "2026-01-26", 1000)], links: new Map([["P2", "F2"]]), today: "2026-04-01" });
    assert.deepEqual([open(r, "F1"), open(r, "F2")], [0, 0]);
    assert.deepEqual(r.invoices.get("F2").closers.map(c => [c.id, c.mode]), [["P2", "linked"]]);
    assert.deepEqual(r.invoices.get("F1").closers.map(c => [c.id, c.mode]), [["P1", "auto"]]);
  });
  it("karar (3): kilitli dönemde bağsız kapanmış kalem kilitten sonraki bağla yeniden açılmaz; bağ bağsız gibi dağılır (kapatanlarda 'locked')", () => {
    // Kilit 31.01 (01.02'de konuldu). P1 25.01 bağsız → F2'yi kapattı (kilitli dönem). P2 05.02 F2'ye bağlandı (kilitten SONRA yazıldı) → F2 açılmaz; P2 F1'i kapatır.
    const history = lockHistory([{ type: "ledger.period.locked", at: "2026-02-01T10:00:00.000Z", payload: { lockedUntil: "2026-01-31" } }]);
    const docs = [sale("F1", "2026-01-01", 1000, "2026-03-01"), sale("F2", "2026-01-05", 1000, "2026-01-20")];
    const p1 = tahsilat("P1", "2026-01-25", 1000);
    p1.at = "2026-01-25T09:00:00.000Z";
    const p2 = tahsilat("P2", "2026-02-05", 1000);
    p2.at = "2026-02-05T09:00:00.000Z";
    const r = build({ docs, lines: [p1, p2], links: new Map([["P2", "F2"]]), lockAt: lockAtOf(history), today: "2026-04-01" });
    assert.deepEqual([open(r, "F1"), open(r, "F2")], [0, 0], "ikisi de kapalı");
    assert.deepEqual(r.invoices.get("F2").closers.map(c => [c.id, c.mode]), [["P1", "auto"]], "F2 kilitli dönemdeki bağsız ödemeyle kapalı kalır");
    assert.deepEqual(r.invoices.get("F1").closers.map(c => [c.id, c.mode]), [["P2", "locked"]], "bağ bağsız gibi dağıldı (kayıtta yazılır)");
    // Karşı durum: kilit yoksa karar (2) — F2 bağla, F1 P1 ile.
    const free = build({ docs, lines: [p1, p2], links: new Map([["P2", "F2"]]), today: "2026-04-01" });
    assert.deepEqual(free.invoices.get("F2").closers.map(c => [c.id, c.mode]), [["P2", "linked"]]);
  });
  it("lockAtOf: yazım anındaki kilit; kilit sonradan ilerlese de eski kaydın kilidi değişmez (S19)", () => {
    const at = lockAtOf(lockHistory([
      { type: "ledger.period.locked", at: "2026-02-01T10:00:00Z", payload: { lockedUntil: "2026-01-31" } },
      { type: "ledger.period.locked", at: "2026-05-01T10:00:00Z", payload: JSON.stringify({ lockedUntil: "2026-04-30" }) },
      { type: "ledger.period.unlocked", at: "2026-06-01T10:00:00Z", payload: {} },
    ]));
    assert.deepEqual([at("2026-01-15T00:00:00Z"), at("2026-03-01T00:00:00Z"), at("2026-05-02T00:00:00Z"), at("2026-07-01T00:00:00Z")], ["", "2026-01-31", "2026-04-30", ""]);
  });
});

describe("TYK — karşılıksız (S8, S11, S18, S19)", () => {
  const cheque = (id, date, amount, kind) => ({ id, origin: "cheque", kind: kind === "bounce" ? "debt" : "in", date, at: at(date, seq++), debit: kind === "bounce" ? amount : 0, credit: kind === "bounce" ? 0 : amount, label: "Çek / Senet" });
  it("S8: evrakın kapattığı fatura karşılıksızla yeniden açılır, KENDİ vadesine kadar gecikmez", () => {
    const f = sale("F", "2026-03-01", 2000, "2026-06-30");
    const rc = cheque("C1", "2026-03-05", 2000, "receive");
    const bc = cheque("C2", "2026-05-02", 2000, "bounce");
    const r = build({ docs: [f], lines: [rc, bc], chequeEvents: new Map([["C1", "receive"], ["C2", "bounce"]]), reversals: new Map([["C2", "C1"]]), today: "2026-05-10" });
    assert.equal(open(r, "F"), 2000, "fatura yeniden açık");
    assert.equal(gecikmis(r, "2026-05-10"), 0, "30.06'ya kadar gecikmiş değil");
    assert.equal(gecikmis(r, "2026-07-01"), 2000);
  });
  it("S11 / S19: evrak kilitli dönemde alındı, karşılıksız kilitten sonra yazıldı → kapanış değişmez, karşılıksız ayrı borç (vade = karşılıksız günü)", () => {
    const history = lockHistory([{ type: "ledger.period.locked", at: "2026-04-01T10:00:00.000Z", payload: { lockedUntil: "2026-03-31" } }]);
    const f = sale("F", "2026-03-01", 2000, "2026-06-30");
    const rc = cheque("C1", "2026-03-05", 2000, "receive");
    const bc = { ...cheque("C2", "2026-05-02", 2000, "bounce"), at: "2026-05-02T09:00:00.000Z" };
    const r = build({ docs: [f], lines: [rc, bc], chequeEvents: new Map([["C1", "receive"], ["C2", "bounce"]]), reversals: new Map([["C2", "C1"]]), lockAt: lockAtOf(history), today: "2026-05-10" });
    assert.equal(open(r, "F"), 0, "kilitli dönemdeki kapanış değişmez");
    assert.equal(gecikmis(r, "2026-05-02"), 0, "karşılıksız günü gecikmiş değil (vade = karşılıksız günü)");
    assert.equal(gecikmis(r, "2026-05-03"), 2000, "ertesi gün karşılıksız borç gecikmiş");
    const bounceItem = r.items.find(item => item.lineId === "C2");
    assert.deepEqual([bounceItem.kind, bounceItem.vade, bounceItem.remaining], ["bounce", "2026-05-02", 2000]);
  });
  it("S18: kilitli dönemde alınıp dağılmamış (avans) evrak karşılıksız dönerse evrakın TAMAMI ayrı borç", () => {
    const history = lockHistory([{ type: "ledger.period.locked", at: "2026-04-01T10:00:00.000Z", payload: { lockedUntil: "2026-03-31" } }]);
    const f = sale("F", "2026-03-01", 500, "2026-03-10");
    const rc = cheque("C1", "2026-03-05", 2000, "receive");
    const bc = { ...cheque("C2", "2026-05-02", 2000, "bounce"), at: "2026-05-02T09:00:00.000Z" };
    const r = build({ docs: [f], lines: [rc, bc], chequeEvents: new Map([["C1", "receive"], ["C2", "bounce"]]), reversals: new Map([["C2", "C1"]]), lockAt: lockAtOf(history), today: "2026-05-10" });
    assert.equal(open(r, "F"), 0);
    // CH = 500 − 2.000 + 2.000 = 500; açık: karşılıksız 2.000 borç − avans 1.500 = net 500 (net görünümde avans karşılıksıza uygulanır).
    assert.equal(r.items.filter(i => i.side === "receivable").reduce((s, i) => s + i.remaining, 0), 500);
    assert.equal(r.items.find(i => i.lineId === "C2").amount, 2000, "karşılıksız kalemi evrakın tamamı");
  });
  it("S19: kilit karşılıksızdan SONRA ilerlerse karar değişmez (karşılıksız yazıldığında kilit yoktu → UX18 netleşmesi)", () => {
    const history = lockHistory([{ type: "ledger.period.locked", at: "2026-06-01T10:00:00.000Z", payload: { lockedUntil: "2026-05-31" } }]);
    const f = sale("F", "2026-03-01", 2000, "2026-06-30");
    const rc = cheque("C1", "2026-03-05", 2000, "receive");
    const bc = { ...cheque("C2", "2026-05-02", 2000, "bounce"), at: "2026-05-02T09:00:00.000Z" };
    const r = build({ docs: [f], lines: [rc, bc], chequeEvents: new Map([["C1", "receive"], ["C2", "bounce"]]), reversals: new Map([["C2", "C1"]]), lockAt: lockAtOf(history), today: "2026-06-10" });
    assert.equal(open(r, "F"), 2000, "fatura yeniden açık (S8), sonraki kilit değiştirmez");
  });
});

describe("TYK — taksit kartları (S50, M1a, M1e, K8-3)", () => {
  const planLine = (planId, date, total, extra = {}) => ({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: false, coverTotal: 0, date, at: at(date, seq++), debit: total, credit: 0, ...extra });
  const planIn = (id, planId, date, amount) => ({ id: `plan-entry:${id}`, origin: "plan", planId, kind: "plan-in", date, at: at(date, seq++), debit: 0, credit: amount });
  it("S50 + K8-3: kart seçilmeden alınan tahsilat ayrı kartın taksitlerini de S2 sırasıyla kapatır (vadesi gelmemiş taksit dahil)", () => {
    // Yeni Borç kartı 900: taksitler 10.02 / 10.03 / 10.04 (300). Fatura F vade 01.03 400. Tahsilat 15.02 700 → S2: taksit 10.02 (300), F 01.03 (400).
    const schedules = new Map([["K", [{ id: "t1", seq: 1, dueDate: "2026-02-10", amount: 300 }, { id: "t2", seq: 2, dueDate: "2026-03-10", amount: 300 }, { id: "t3", seq: 3, dueDate: "2026-04-10", amount: 300 }]]]);
    const r = build({ docs: [sale("F", "2026-01-20", 400, "2026-03-01")], lines: [planLine("K", "2026-01-15", 900), tahsilat("P", "2026-02-15", 700)], schedules, today: "2026-03-15" });
    const inst = r.installments.get("K");
    assert.deepEqual([inst.get("t1").remaining, inst.get("t2").remaining, inst.get("t3").remaining, open(r, "F")], [0, 300, 300, 0]);
    assert.equal(inst.get("t1").byAccount, 300, "cari tahsilatıyla kapanan pay");
    assert.equal(gecikmis(r, "2026-03-15"), 300, "yalnız 10.03 taksiti gecikmiş");
    // K8-3: vadesi gelmemiş taksit de sıraya girer — tahsilat 1.300 ise 10.04 taksiti de kapanır (S2 vade sırası, "vadesi gelmiş" koşulu yok).
    const all = build({ docs: [sale("F", "2026-01-20", 400, "2026-03-01")], lines: [planLine("K", "2026-01-15", 900), tahsilat("P", "2026-02-15", 1300)], schedules, today: "2026-02-20" });
    assert.deepEqual([...all.installments.get("K").values()].map(i => i.remaining), [0, 0, 0]);
  });
  it("M1e: kart tahsilatı kartın vadesi ilk gelen açık taksitini kapatır; kart ile alttaki borç birlikte sayılmaz (Σ kalem = bakiye)", () => {
    const schedules = new Map([["K", [{ id: "t1", seq: 1, dueDate: "2026-02-10", amount: 500 }, { id: "t2", seq: 2, dueDate: "2026-03-10", amount: 500 }]]]);
    const r = build({ lines: [planLine("K", "2026-01-15", 1000), planIn("e1", "K", "2026-02-01", 600)], schedules, today: "2026-03-20" });
    assert.deepEqual([...r.installments.get("K").values()].map(i => i.remaining), [0, 400]);
    assert.equal(r.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0), 400, "Σ açık = bakiye 1.000 − 600");
  });
  it("M1e + K8-3: Mevcut Borç kartı açıldığı an açık borçları S2 sırasıyla tüketir (en yeniden değil)", () => {
    // F1 01.01 vade 01.06 1.000 · F2 05.01 vade 20.01 1.000 · kart 10.01 kapsam 1.000 → S2: F2 tüketilir (eski kural en yeni borç: yine F2 — ayırt etmek için F3).
    // F3 08.01 vade 01.09 500 (en yeni) → eski kural F3 500 + F2 500; yeni kural F2 1.000.
    const schedules = new Map([["M", [{ id: "m1", seq: 1, dueDate: "2026-02-15", amount: 500 }, { id: "m2", seq: 2, dueDate: "2026-03-15", amount: 500 }]]]);
    const docs = [sale("F1", "2026-01-01", 1000, "2026-06-01"), sale("F2", "2026-01-05", 1000, "2026-01-20"), sale("F3", "2026-01-08", 500, "2026-09-01")];
    const r = build({ docs, lines: [planLine("M", "2026-01-10", 0, { covers: true, coverTotal: 1000 })], schedules, today: "2026-01-25" });
    assert.deepEqual([r.invoices.get("F2").covered, r.invoices.get("F3").covered, r.invoices.get("F1").covered], [1000, 0, 0], "F2'nin tamamı kartça kapsandı");
    assert.equal(r.invoiceNet.get("F2").remaining, 0, "birleşik listede F2 yok (kartın taksitleri gösterir)");
    assert.equal(gecikmis(r, "2026-01-25"), 0, "F2 kartta; taksitlerin vadesi gelmedi");
    assert.equal(r.items.reduce((s, i) => s + i.remaining, 0), 2500, "Σ kalem = bakiye (çift sayım yok)");
  });
  // v2.0.23 kuralı AYNEN (karar metinleri yalnız tüketim SIRASINI değiştirdi): kart AÇILDIĞI ANA KADAR KAYDEDİLMİŞ satırlarla açık olan borcu tüketir.
  const cheque = (id, date, amount, kind, when) => ({ id, origin: "cheque", kind: kind === "bounce" ? "debt" : "in", date, at: when || at(date, seq++), debit: kind === "bounce" ? amount : 0, credit: kind === "bounce" ? 0 : amount, label: "Çek / Senet" });
  it("M1e kapsamı: karttan SONRA kaydedilen borç (aynı gün) kartın içinde değildir; aynı gün karttan ÖNCE kaydedilen ödeme önce kapatır", () => {
    // 29.07: S 1.000 (08:00) · tahsilat 1.000 (08:10) · cariye ödeme 500 (08:20) · Mevcut Borç kartı 500 (08:30) · Y 800 (08:40). Kart o anda açık olan 500'ü (ödeme) tüketir.
    const schedules = new Map([["M", [{ id: "m1", seq: 1, dueDate: "2026-09-01", amount: 500 }]]]);
    const s = { inv: { id: "S", kind: "sale", status: "issued", payable: 1000, dueDate: "", planId: "", issuedAt: "2026-07-29T08:00:00.000Z" }, line: { id: "l-S", origin: "invoice", kind: "debt", sourceId: "S", date: "2026-07-29", at: "2026-07-29T08:00:00.000Z", debit: 1000, credit: 0 } };
    const y = { inv: { id: "Y", kind: "sale", status: "issued", payable: 800, dueDate: "", planId: "", issuedAt: "2026-07-29T08:40:00.000Z" }, line: { id: "l-Y", origin: "invoice", kind: "debt", sourceId: "Y", date: "2026-07-29", at: "2026-07-29T08:40:00.000Z", debit: 800, credit: 0 } };
    const lines = [{ id: "P", origin: "account", kind: "in", date: "2026-07-29", at: "2026-07-29T08:10:00.000Z", debit: 0, credit: 1000 }, { id: "O", origin: "account", kind: "out", date: "2026-07-29", at: "2026-07-29T08:20:00.000Z", debit: 500, credit: 0 }, { ...planLine("M", "2026-07-29", 0, { covers: true, coverTotal: 500 }), at: "2026-07-29T08:30:00.000Z" }];
    const r = build({ docs: [s, y], lines, schedules, today: "2026-08-10" });
    assert.equal(open(r, "Y"), 800, "Y kartın kapsamında değil — fatura durumu 800 açık");
    assert.equal(r.invoices.get("Y").covered, 0);
    assert.equal(r.invoiceNet.get("Y").remaining, 800, "net görünümde Y 800 (takvim / zil)");
    assert.equal(r.installments.get("M").get("m1").remaining, 500, "kartın taksiti 500");
  });
  it("M1e kapsamı: kart açıldığında portföyde olan evrak sonradan karşılıksız dönerse kartın kapsamı DEĞİŞMEZ; yeniden açılan fatura kartın dışında (UX18 T17 (i))", () => {
    // X 1.000 (01.03) · Y 1.000 (02.03) · çek 1.000 (03.03, bağsız → S2: X kapanır) · Mevcut Borç kartı 1.000 (04.03 — o an açık Y) · karşılıksız (05.03) · nakit 1.000 (06.03).
    const schedules = new Map([["M", [{ id: "m1", seq: 1, dueDate: "2026-04-04", amount: 500 }, { id: "m2", seq: 2, dueDate: "2026-05-04", amount: 500 }]]]);
    const docs = [sale("X", "2026-03-01", 1000), sale("Y", "2026-03-02", 1000)];
    const lines = [cheque("C1", "2026-03-03", 1000, "receive"), planLine("M", "2026-03-04", 0, { covers: true, coverTotal: 1000 }), cheque("C2", "2026-03-05", 1000, "bounce")];
    const events = { chequeEvents: new Map([["C1", "receive"], ["C2", "bounce"]]), reversals: new Map([["C2", "C1"]]) };
    const r = build({ docs, lines, schedules, ...events, today: "2026-03-05" });
    assert.deepEqual([r.invoices.get("X").covered, r.invoices.get("Y").covered], [0, 1000], "kart Y'yi kapsar (kartın anında X evrakla kapalıydı)");
    assert.deepEqual([open(r, "X"), r.invoiceNet.get("X").remaining], [1000, 1000], "karşılıksız X'i KENDİ vadesiyle açar — kartın dışında");
    const paid = build({ docs, lines: [...lines, tahsilat("N", "2026-03-06", 1000)], schedules, ...events, today: "2026-03-06" });
    assert.deepEqual([open(paid, "X"), [...paid.installments.get("M").values()].map(i => i.remaining)], [0, [500, 500]], "bağsız nakit vadesi en önce gelen X'i kapatır; kartın taksitleri açık");
  });
  it("M1a / S50: taksitli faturanın kendi kartının taksitleri de tek kuyrukta — bağsız tahsilat vadesi gelmiş taksiti kapatır", () => {
    const f = sale("F", "2026-01-01", 1200, "", { planId: "K", planTotal: 1200 });
    const schedules = new Map([["K", [{ id: "t1", seq: 1, dueDate: "2026-02-01", amount: 600 }, { id: "t2", seq: 2, dueDate: "2026-03-01", amount: 600 }]]]);
    const r = build({ docs: [f, sale("G", "2026-01-10", 300, "2026-02-15")], lines: [tahsilat("P", "2026-02-20", 600)], schedules, today: "2026-02-25" });
    assert.deepEqual([r.installments.get("K").get("t1").remaining, r.installments.get("K").get("t2").remaining, open(r, "G")], [0, 600, 300], "S2: taksit (01.02) önce, G (15.02) açık");
    // G3 (tur 2b-2, S99 = A — KULLANICI KARARI 10.11 13:27): fatura durumu (G2) da tek kuyruktan — bağsız tahsilatın kapattığı 1. taksit faturanın açığından da düşer
    // (önceki beklenti 1.200 = kartın kendi kalanı, v2.0.24 kuralıydı; karar "bu kuralı DEĞİŞTİ" diyor). Açık = taksit kalanı 600.
    assert.equal(open(r, "F"), 600, "S99: taksitli faturanın açığı = kartının KUYRUK kalanı");
    assert.equal(gecikmis(r, "2026-02-25"), 300, "net: 1. taksit cari tahsilatıyla kapandı, G (15.02) 300 gecikmiş");
  });
  // Ç5-B birleşim düzeltmesi (Ç5-B ana dalla birleşince 30e12c20'de mutabakat yıl dönümü tohum 39 + ek tohum 7 / 11 / 13 / 17 kırmızı): fatura durumunda (G2) taksitli faturanın kendi kartı yalnız BAĞLI ödemeyle kapanır
  // (v2.0.23 Bulgu 2, v2.0.24 "taksitli faturanın açığı = kartın kalanı") — G2'de bağsız kapanışı yoktur, karar (3)'ün kilit ölçümü onu "kilitli dönemde bağsız kapanmış" sayamaz.
  // Net görünümde (G1; S50, M1a) karar (3) aynen: kilitten önce bağsız avansın kapattığı taksit kilitten sonraki kart tahsilatıyla yeniden açılmaz, tahsilat bağsız dağılır.
  // Elle hesap: avans 1.500 (01.01) · F 1.200 (05.01; kendi kartı, taksit 01.02 / 01.03 × 600) · kilit 15.01'e (20.01'de konuldu) · kart tahsilatı 1.200 (25.01).
  //   G2: kart tahsilatı faturaya bağlı ödemedir → F açık 0, kapatanlar kart tahsilatı 600 + 600 (Bağlı). Tahsilattan ÖNCE F açık 1.200 (kart tahsilatı yok — v2.0.24).
  //   G1: taksitler avansla kapalı (cari tahsilatıyla 600 + 600); kart tahsilatı serbest → açık alacak kalemleri avans 300 + kart artanı 1.200 → Σ kalem = bakiye −1.500.
  it("karar (3) × v2.0.24: kilitten önceki bağsız avans varken kilitten sonraki kart tahsilatı taksitli faturayı KAPATIR (fatura durumu); net görünümde karar (3) aynen", () => {
    const history = lockHistory([{ type: "ledger.period.locked", at: "2026-01-20T10:00:00.000Z", payload: { lockedUntil: "2026-01-15" } }]);
    const f = sale("F", "2026-01-05", 1200, "", { planId: "K", planTotal: 1200 });
    const schedules = new Map([["K", [{ id: "t1", seq: 1, dueDate: "2026-02-01", amount: 600 }, { id: "t2", seq: 2, dueDate: "2026-03-01", amount: 600 }]]]);
    const avans = { ...tahsilat("P", "2026-01-01", 1500), at: "2026-01-01T09:00:00.000Z" };
    const kart = { ...planIn("e1", "K", "2026-01-25", 1200), at: "2026-01-25T09:00:00.000Z" };
    const once = build({ docs: [f], lines: [avans], schedules, lockAt: lockAtOf(history), today: "2026-01-21" });
    // G3 (tur 2b-2, S99 = A): kart tahsilatından önce bağsız avans 1.500 taksitli faturanın taksitlerini vade sırasıyla kapatmıştır → fatura Ödendi (önceki beklenti 1.200 /
    // Taksitli — v2.0.24 'bağsız para taksitli faturanın kartına harcanmaz' kuralı; S99 bu kuralı değiştirdi).
    assert.deepEqual([open(once, "F"), state(once, "F")], [0, "paid"], "S99: kart tahsilatından önce avans taksitleri kapattı — fatura Ödendi");
    const r = build({ docs: [f], lines: [avans, kart], schedules, lockAt: lockAtOf(history), today: "2026-01-26" });
    assert.deepEqual([open(r, "F"), state(r, "F")], [0, "paid"], "kart tahsilatı taksitli faturayı kapatır: açık = kartın kalanı 0");
    // G3 (tur 2b-2, S99 = A + karar (3)): taksitler kilitten ÖNCE avansla kapandı; kilitten sonraki kart tahsilatının bağı onları yeniden açmaz (karar (3)), tahsilat bağsız
    // dağılır → kapatanlar avans (Otomatik), kart tahsilatı değil (önceki beklenti: kart tahsilatı Bağlı — G2'de bağsız kapanış sayılmıyordu).
    assert.deepEqual(r.invoices.get("F").closers.map(c => [c.id, c.mode, c.amount]), [["P", "auto", 600], ["P", "auto", 600]], "kapatanlar: avans (Otomatik; karar (3) — kilitli dönemde kapanmış)");
    const inst = r.installments.get("K");
    assert.deepEqual([inst.get("t1").remaining, inst.get("t2").remaining, inst.get("t1").byAccount, inst.get("t2").byAccount], [0, 0, 600, 600], "net: taksitler kilitten önce avansla kapandı (karar (3) — yeniden açılmaz)");
    assert.equal(r.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0), -1500, "net: Σ kalem = bakiye (1.200 − 1.500 − 1.200)");
    assert.deepEqual(r.items.filter(i => i.side === "payable").map(i => [i.lineId, i.remaining]).sort(), [["P", 300], ["plan-excess:K", 1200]], "net: avans artanı 300 + kart tahsilatı bağsız 1.200");
  });
});

describe("TYK — netleşme (karar (5)) ve fatura durumu", () => {
  it("karar (5) A (EK-2 S9 örneği): 10.000 vadesi geçmiş + 5.000 vadesi gelmemiş satış, 6.000 alış → gecikmiş 4.000; fatura durumu Açık kalır", () => {
    const r = build({ docs: [sale("S1", "2026-01-01", 10000, "2026-02-01"), sale("S2", "2026-02-01", 5000, "2026-06-01"), purchase("A1", "2026-02-10", 6000, "2026-03-01")], today: "2026-03-15" });
    assert.equal(gecikmis(r, "2026-03-15"), 4000);
    assert.deepEqual([open(r, "S1"), open(r, "S2"), open(r, "A1")], [10000, 5000, 6000], "karşı yönlü faturalar yalnız Mahsup Et ile kapanır");
    assert.deepEqual([state(r, "S1"), state(r, "A1")], ["overdue", "overdue"]);
  });
  it("bize alacaklı kişi (alış > satış): gecikmiş 0", () => {
    const r = build({ docs: [sale("S", "2026-01-01", 1000, "2026-01-10"), purchase("A", "2026-01-05", 3000, "2026-01-15")], today: "2026-02-01" });
    assert.equal(gecikmis(r, "2026-02-01"), 0);
  });
  it("Mahsup Et iki faturayı birlikte kapatır (fatura durumu)", () => {
    const r = build({ docs: [sale("S", "2026-01-01", 1000), purchase("A", "2026-01-05", 400)], offsets: [{ id: "o1", invoiceId: "S", counterType: "invoice", counterId: "A", amount: 400, date: "2026-01-06", createdAt: "2026-01-06T10:00:00Z" }], today: "2026-02-01" });
    assert.deepEqual([open(r, "S"), open(r, "A")], [600, 0]);
  });
  it("elle Alacak Yaz satış borcuna net görünümde kendi tarihinde uygulanır (Kalan net); fatura durumu değişmez", () => {
    const r = build({ docs: [sale("S", "2026-01-01", 1000, "2026-01-20")], lines: [alacak("AY", "2026-01-10", 300)], today: "2026-02-01" });
    assert.equal(open(r, "S"), 1000, "fatura durumu: Alacak Yaz ödeme değildir");
    assert.equal(r.invoiceNet.get("S").remaining, 700, "net kalan");
    assert.equal(gecikmis(r, "2026-02-01"), 700);
  });
});

describe("TYK — şüpheli kuyruğu (M13, S3)", () => {
  it("açık şüpheli kaydın kalanı gecikmişe girmez; kalem listede görünür (şüpheli tutarı ayrı alan)", () => {
    const r = build({ docs: [sale("F1", "2026-01-01", 1000, "2026-01-10"), sale("F2", "2026-02-01", 600, "2026-02-10")], doubtfulRecords: [{ date: "2026-01-20", remainingMinor: 100000 }], today: "2026-03-01" });
    assert.equal(gecikmis(r, "2026-03-01"), 600, "F1 şüpheli kuyruğunda (kayıt günü doğmuş, S2 ilk), F2 gecikmiş");
    assert.equal(r.doubtful.amount, 1000);
    assert.equal(r.items.find(i => i.invoiceId === "F1").doubtful, 1000);
  });
});

describe("TYK — takvim kalemi (S67, S69, Y3-1, K6.3)", () => {
  it("S67 / S69: vadesi geçmiş borç + ileri tarihli söz → kalem söz gününde, Gecikmiş, gün sayısı vadeden", () => {
    assert.deepEqual(calendarState({ vade: "2026-06-05", promise: "2026-06-15", day: "2026-06-10" }), { date: "2026-06-15", days: -5, state: "overdue" });
    assert.deepEqual(calendarState({ vade: "2026-06-05", promise: "2026-06-15", day: "2026-06-15" }), { date: "2026-06-15", days: -10, state: "overdue" }, "S69: söz günü 10");
    assert.deepEqual(calendarState({ vade: "2026-06-05", promise: "2026-06-15", day: "2026-06-16" }), { date: "2026-06-15", days: -11, state: "overdue" }, "S69: söz geçince 11");
  });
  it("Y3-1: söz VADEDEN ÖNCE ve ikisi de geçmişse gün sayısı sözden; vade geçmemişse K6.3 (söz günü)", () => {
    assert.deepEqual(calendarState({ vade: "2026-06-20", promise: "2026-06-10", day: "2026-06-25" }), { date: "2026-06-10", days: -15, state: "overdue" });
    assert.deepEqual(calendarState({ vade: "2026-06-20", promise: "2026-06-18", day: "2026-06-12" }), { date: "2026-06-18", days: 6, state: "upcoming" });
    assert.deepEqual(calendarState({ vade: "2026-06-20", promise: "", day: "2026-06-20" }), { date: "2026-06-20", days: 0, state: "today" });
  });
});

// Değişmezler (EK-1 §4; C5 §2.10 madde 9) — tohumlu rastgele olaylar, her tohumda girdi sırası ters çevrilerek de (ders 31).
describe("TYK — değişmezler (tohumlu rastgele, 500 olay × 4 tohum)", () => {
  const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const day = n => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  for (const seed of [1, 2, 3, 4]) {
    it(`tohum ${seed}: 0 ≤ gecikmiş ≤ max(0, CH); Σ açık borç − Σ açık alacak = CH; iki taraf birden açık değil; girdi sırası sonucu değiştirmez`, () => {
      const r = rng(seed);
      const docs = [];
      const lines = [];
      const dueDates = new Map();
      let balance = 0;
      for (let i = 0; i < 500; i += 1) {
        const d = day(Math.floor(r() * 300));
        const amount = 1 + Math.floor(r() * 5000);
        const pick = r();
        if (pick < 0.3) docs.push(sale(`S${seed}-${i}`, d, amount, r() < 0.5 ? day(Math.floor(r() * 330)) : ""));
        else if (pick < 0.4) docs.push(purchase(`A${seed}-${i}`, d, amount, r() < 0.5 ? day(Math.floor(r() * 330)) : ""));
        else if (pick < 0.7) lines.push(tahsilat(`P${seed}-${i}`, d, amount));
        else if (pick < 0.8) lines.push(odeme(`O${seed}-${i}`, d, amount));
        else if (pick < 0.9) {
          const id = `B${seed}-${i}`;
          lines.push(borc(id, d, amount));
          if (r() < 0.5) dueDates.set(id, day(Math.floor(r() * 330)));
        } else lines.push(alacak(`Y${seed}-${i}`, d, amount));
      }
      for (const d of docs) balance += d.inv.kind === "sale" ? d.inv.payable : -d.inv.payable;
      for (const l of lines) balance += l.debit - l.credit;
      const today = day(320);
      const res = build({ docs, lines, dueDates, today });
      const rev = buildObligations({ lines: [...lines, ...docs.map(d => d.line)].reverse(), invoices: [...docs.map(d => d.inv)].reverse(), dueDates, today });
      const openDebit = res.items.filter(i => i.side === "receivable").reduce((s, i) => s + i.remaining, 0);
      const openCredit = res.items.filter(i => i.side === "payable").reduce((s, i) => s + i.remaining, 0);
      assert.equal(Math.round((openDebit - openCredit) * 100), Math.round(balance * 100), "Σ açık borç − Σ açık alacak = CH");
      assert.ok(!(openDebit > 0.005 && openCredit > 0.005), "iki taraf birden açık değil");
      for (const t of [day(10), day(100), day(200), today]) {
        const g = res.overdue(t).amount;
        assert.ok(g >= 0 && g <= Math.max(0, openDebit) + 0.005, `0 ≤ gecikmiş(${t}) ≤ max(0, CH)`);
      }
      // G3 (tur 2b-2; ders 31): yardımcının kayıt anı (09:10 + n % 50) aynı gün çakışabiliyor — tarih VE kayıt anı eşit iki kalemin listedeki yeri yazım sırasıdır (ters
      // girdide ters); kalemler ve kalanlar aynı. S95 geri alması bu eşitlikte iki kalemi birden açık bırakınca (tohum 2: Y2-176 / Y2-226) sıra farkı görünür oldu → küme karşılaştırması.
      assert.deepEqual(res.items.map(i => [i.key, i.remaining]).sort(), rev.items.map(i => [i.key, i.remaining]).sort(), "girdi sırası ters: aynı kalemler");
      assert.deepEqual([...res.invoices].sort().map(([k, v]) => [k, v.open]), [...rev.invoices].sort().map(([k, v]) => [k, v.open]), "fatura durumu aynı");
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
// 2.5.0 Ç5-B tur 2a (dar kontrol DK-C5B; beklenenler ELLE — v2.4.9'un gerçek kodu ve karar metinlerinden, programın çıktısından DEĞİL; ders 5, 40). Mutantlar:
// test/tyk-mutasyon-250.mjs (Y1-*, O1-*, T-*, B-*, N02, N06).
describe("TYK tur 2a — Y-1: Kayıt Tarihi borçtan ÖNCE olan Mevcut Borç kartı borcu tüketir (v2.4.9; M1e)", () => {
  const T = n => `2026-10-20T09:${String(10 + n).padStart(2, "0")}:00.000Z`;
  const cover = (planId, date, total, n) => ({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: true, coverTotal: total, date, at: T(n), debit: 0, credit: 0 });
  const stock = (id, date, amount, n) => ({ id, origin: "stock", kind: "debt", sourceId: `m-${id}`, stockReason: "", date, at: T(n), debit: amount, credit: 0 });
  const sched = (planId, rows) => new Map([[planId, rows.map(([dueDate, amount], i) => ({ id: `${planId}-${i + 1}`, seq: i + 1, dueDate, amount }))]]);
  const inst = (r, planId) => [...r.installments.get(planId).entries()].filter(([k]) => k !== "rest" && k !== "back").map(([, v]) => v.remaining);
  const sigma = r => Math.round(r.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0) * 100) / 100;
  // ELLE (dar kontrol betiği stok-kart; v2.4.9 çıktısı): stoktan veresiye satış 1.000 (30.09), kart Kayıt Tarihi carinin Kayıt Tarihi 15.09.2025, 2 × 500 (10.10, 10.11).
  // Kart satışı tüketir → taksitler 500 / 500, satış kalemi yok; bugün 20.10: 1. taksit gecikmiş → gecikmiş 500 (1 kalem); Σ kalem = bakiye 1.000.
  it("stoktan veresiye satış → taksitlendir (kartın Kayıt Tarihi carinin Kayıt Tarihi): taksitler 500 / 500, gecikmiş 500 (önceden kart 'Bitti', gecikmiş 1.000)", () => {
    const r = buildObligations({ lines: [stock("S", "2026-09-30", 1000, 1), cover("K", "2025-09-15", 1000, 2)], invoices: [], schedules: sched("K", [["2026-10-10", 500], ["2026-11-10", 500]]), today: "2026-10-20" });
    assert.deepEqual(inst(r, "K"), [500, 500]);
    assert.deepEqual([r.overdue("2026-10-20").amount, r.overdue("2026-10-20").count], [500, 1]);
    assert.equal(r.items.some(i => i.lineId === "S"), false, "satış kartın içinde (aynı borç bir kez)");
    assert.equal(sigma(r), 1000, "Σ kalem = bakiye");
  });
  it("elle geriye tarihli kart (Kayıt Tarihi Borç Yaz'dan önce) aynı; Kayıt Tarihi borçtan SONRA olan kart (kontrol) aynı sonuç", () => {
    const debt = { id: "B", origin: "account", kind: "debt", date: "2026-09-30", at: T(1), debit: 1000, credit: 0 };
    const s = sched("K", [["2026-10-10", 500], ["2026-11-10", 500]]);
    for (const date of ["2026-09-20", "2026-10-01"]) {
      const r = buildObligations({ lines: [debt, cover("K", date, 1000, 2)], invoices: [], schedules: s, today: "2026-10-20" });
      assert.deepEqual([inst(r, "K"), r.overdue("2026-10-20").amount, r.entries.get("B").remaining, r.entries.get("B").covered], [[500, 500], 500, 1000, 1000], `kart ${date}`);
    }
  });
  // ELLE: karttan SONRA yazılan tahsilat 300 (05.10) kartın açılışından (30.09 — tükettiği satışın günü) sonradır → S50 + M1e: vadesi ilk gelen taksit (10.10) 300 → [200, 500].
  it("karttan sonra yazılan tahsilat taksiti kapatır (kartın açılış günü tükettiği borcun günü): [200, 500], gecikmiş 200", () => {
    const pay = { id: "P", origin: "account", kind: "in", date: "2026-10-05", at: T(3), debit: 0, credit: 300 };
    const r = buildObligations({ lines: [stock("S", "2026-09-30", 1000, 1), cover("K", "2025-09-15", 1000, 2), pay], invoices: [], schedules: sched("K", [["2026-10-10", 500], ["2026-11-10", 500]]), today: "2026-10-20" });
    assert.deepEqual([inst(r, "K"), r.overdue("2026-10-20").amount, sigma(r)], [[200, 500], 200, 700]);
  });
  // ELLE: kartın anında bilinen avans 200 (25.09) satışın (30.09) bir kısmını kapatmış; kart açılan an açık 800'ü tüketir (v2.4.9 kapsamı: bilinen satırların son durumu) →
  // taksitler 400 / 400 tam; satış avans + kartla kapalı; gecikmiş 400 (10.10). Önceden kart Kayıt Tarihi'nde (2025) borç bulamıyor, satışın 800'ü gecikmiş kalıyordu.
  it("kartın anında bilinen avans: kart açıldığı an açık kalanı (800) tüketir → taksitler 400 / 400, gecikmiş 400", () => {
    const avans = { id: "A", origin: "account", kind: "in", date: "2026-09-25", at: T(0), debit: 0, credit: 200 };
    const r = buildObligations({ lines: [avans, stock("S", "2026-09-30", 1000, 1), cover("K", "2025-09-15", 800, 2)], invoices: [], schedules: sched("K", [["2026-10-10", 400], ["2026-11-10", 400]]), today: "2026-10-20" });
    assert.deepEqual([inst(r, "K"), r.overdue("2026-10-20").amount, sigma(r)], [[400, 400], 400, 800]);
  });
});

describe("TYK tur 2a — O-1: karar (3) bağın KURULDUĞU andaki kilitle (düzeltmeyle kurulan bağ = yeni kayıtla kurulan)", () => {
  // ELLE (dar kontrol betiği k3-duzelt): F1 300 (01.08) · P1 300 bağsız (05.08; F1'i kapatır) · F2 300 (10.08, vade 01.12) · F3 300 (15.08, vade 15.08) · P2 300 (10.10)
  // F1'e bağlı. Kilit 20.08'e 15.09'da konuldu. Bağ kilitten SONRA kuruldu (P2 kilitten önce yazıldı, 20.09'da düzeltilip F1'e bağlandı) → karar (3): F1 kilitli dönemde
  // bağsız kapanmış, açılmaz; P2 bağsız gibi dağılır → S2: F3 (vade 15.08) kapanır ("kilitli dönemde kapanmıştı"), F2 açık (vadesi gelmedi) → gecikmiş 0.
  // Bağ kilitten ÖNCE kurulduysa (düzeltme yok) bağ geçerli: F1 P2'yle, P1 serbest → F2'yi kapatır → F3 300 gecikmiş.
  const history = lockHistory([{ type: "ledger.period.locked", at: "2026-09-15T10:00:00.000Z", payload: { lockedUntil: "2026-08-20" } }]);
  const mk = (id, date, amount, dueDate) => ({ inv: { id, kind: "sale", status: "issued", payable: amount, dueDate, planId: "" }, line: { id: `l-${id}`, origin: "invoice", kind: "debt", sourceId: id, date, at: `${date}T09:00:00.000Z`, debit: amount, credit: 0 } });
  const docs = [mk("F1", "2026-08-01", 300, "2026-08-01"), mk("F2", "2026-08-10", 300, "2026-12-01"), mk("F3", "2026-08-15", 300, "2026-08-15")];
  const lines = [...docs.map(d => d.line), { id: "P1", origin: "account", kind: "in", date: "2026-08-05", at: "2026-08-05T09:00:00.000Z", debit: 0, credit: 300 }, { id: "P2", origin: "account", kind: "in", date: "2026-10-10", at: "2026-09-01T10:00:00.000Z", debit: 0, credit: 300 }];
  const run = linkTimes => buildObligations({ lines, invoices: docs.map(d => d.inv), links: new Map([["P2", "F1"]]), lockAt: lockAtOf(history), linkTimes, today: "2026-10-20" });
  it("bağ kilitten sonra düzeltmeyle kuruldu → kilit uygulanır: gecikmiş 0, F3 'kilitli dönemde kapanmıştı'", () => {
    const r = run(new Map([["P2", "2026-09-20T10:00:00.000Z"]]));
    assert.equal(r.overdue("2026-10-20").amount, 0);
    assert.deepEqual(r.invoices.get("F3").closers.map(c => [c.id, c.mode, c.amount]), [["P2", "locked", 300]]);
    assert.deepEqual(r.invoices.get("F1").closers.map(c => [c.id, c.mode]), [["P1", "auto"]], "F1 kilitli dönemdeki bağsız kapanışıyla kalır");
  });
  it("bağ kilitten önce kuruldu (düzeltme yok) → bağ geçerli: F3 300 gecikmiş", () => {
    const r = run(new Map());
    assert.equal(r.overdue("2026-10-20").amount, 300);
    assert.deepEqual(r.invoices.get("F1").closers.map(c => [c.id, c.mode]), [["P2", "linked"]]);
  });
  it("lockAtOf: kilitle AYNI anda yazılan kayıt kilidi görür (B12; durağan saat — yaşayan mutant N02)", () => {
    const at = lockAtOf(lockHistory([{ type: "ledger.period.locked", at: "2026-09-15T10:00:00.000Z", payload: { lockedUntil: "2026-08-20" } }]));
    assert.deepEqual([at("2026-09-15T09:59:59.999Z"), at("2026-09-15T10:00:00.000Z"), at("2026-09-15T10:00:00.001Z")], ["", "2026-08-20", "2026-08-20"]);
  });
});

describe("TYK tur 2a — 'Hangi Taksite' bağı (karar (2)) ve O-3 kart kalemleri", () => {
  const card = (planId, date, total) => ({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: false, coverTotal: 0, date, at: `${date}T08:00:00.000Z`, debit: total, credit: 0 });
  const pin = (id, planId, date, amount, itemId = "", at = `${date}T09:00:00.000Z`) => ({ id: `plan-entry:${id}`, origin: "plan", planId, kind: "plan-in", itemId, date, at, debit: 0, credit: amount });
  const pout = (id, planId, date, amount) => ({ id: `plan-entry:${id}`, origin: "plan", planId, kind: "plan-out", date, at: `${date}T09:00:00.000Z`, debit: amount, credit: 0 });
  const schedules = new Map([["K", [{ id: "t1", seq: 1, dueDate: "2026-01-20", amount: 300 }, { id: "t2", seq: 2, dueDate: "2026-02-20", amount: 300 }]]]);
  const rem = r => [r.installments.get("K").get("t1"), r.installments.get("K").get("t2")].map(v => [v.remaining, v.byAccount]);
  // ELLE: kart 600 (10.01; 20.01 / 20.02 × 300) · 2. taksite bağlı tahsilat 300 (25.01) → 2. taksit kapanır, 1. açık (lib/plans.mjs allocate ile aynı).
  it("bağlı tahsilat önce KENDİ taksitini kapatır; taksitini aşan kısmı vade sırasıyla (kartın kendi hesabıyla aynı)", () => {
    const r = buildObligations({ lines: [card("K", "2026-01-10", 600), pin("e1", "K", "2026-01-25", 300, "t2")], invoices: [], schedules, today: "2026-02-25" });
    assert.deepEqual(rem(r), [[300, 0], [0, 0]]);
    assert.equal(r.overdue("2026-02-25").amount, 300);
    const over = buildObligations({ lines: [card("K", "2026-01-10", 600), pin("e1", "K", "2026-01-25", 400, "t2")], invoices: [], schedules, today: "2026-02-25" });
    assert.deepEqual(rem(over), [[200, 0], [0, 0]], "artan 100 vade sırasıyla 1. taksite");
  });
  // ELLE (karar (3)): bağsız avans 300 (15.01) 1. taksiti (vade 20.01) kilitli dönemde kapattı; kilit 31.01'e 01.02'de; kilitten SONRA 1. taksite bağlı tahsilat 300 (05.02) →
  // 1. taksit açılmaz (avansla kalır), tahsilat bağsız gibi → 2. taksit. Bağın anı düzeltmeyle değiştiyse (kilitten önce yazılmış, sonra 1. taksite çevrilmiş) aynı.
  it("karar (3): kilitten sonra kurulan / düzeltilen 'Hangi Taksite' bağı kilitli dönemde bağsız kapanmış taksiti yeniden açmaz", () => {
    const history = lockHistory([{ type: "ledger.period.locked", at: "2026-02-01T10:00:00.000Z", payload: { lockedUntil: "2026-01-31" } }]);
    const avans = { id: "P", origin: "account", kind: "in", date: "2026-01-15", at: "2026-01-15T09:00:00.000Z", debit: 0, credit: 300 };
    const fresh = buildObligations({ lines: [card("K", "2026-01-10", 600), avans, pin("e3", "K", "2026-02-05", 300, "t1", "2026-02-05T09:00:00.000Z")], invoices: [], schedules, lockAt: lockAtOf(history), today: "2026-02-25" });
    assert.deepEqual(rem(fresh), [[0, 300], [0, 0]], "1. taksit avansla, 2. taksit kart tahsilatıyla");
    const edited = buildObligations({ lines: [card("K", "2026-01-10", 600), avans, pin("e3", "K", "2026-02-05", 300, "t1", "2026-01-25T09:00:00.000Z")], invoices: [], schedules, lockAt: lockAtOf(history), linkTimes: new Map([["plan-entry:e3", "2026-02-05T09:00:00.000Z"]]), today: "2026-02-25" });
    assert.deepEqual(rem(edited), [[0, 300], [0, 0]], "düzeltmeyle kurulan bağ = yeni kayıt");
  });
  // ELLE (O-3, S91 = A): taksitsiz Yeni Borç kartı 1.000 (20.09) → kalan tek kalem, vade kart günü; 2 × 300 taksitli 1.000'lik kartta kalan 400. Taksit İadesi: kart tahsilatı 100,
  // iade 300 → kartın borcu 200 (vade iade günü). Hepsi kuyruğun kart kalemi (installments haritasında "rest" / "back") — takvim / zil / Vade Takip / nakit akışı bunları okur.
  it("O-3: taksitlere bölünmemiş kalan ('rest') ve Taksit İadesi ('back') kart kalemi olarak — vade ve kalanla", () => {
    const bare = buildObligations({ lines: [card("K", "2026-09-20", 1000)], invoices: [], schedules: new Map(), today: "2026-10-20" });
    assert.deepEqual([bare.installments.get("K").get("rest").remaining, bare.installments.get("K").get("rest").vade, bare.overdue("2026-10-20").amount], [1000, "2026-09-20", 1000]);
    const part = buildObligations({ lines: [card("K", "2026-09-20", 1000)], invoices: [], schedules: new Map([["K", [{ id: "t1", seq: 1, dueDate: "2026-10-10", amount: 300 }, { id: "t2", seq: 2, dueDate: "2026-11-09", amount: 300 }]]]), today: "2026-10-20" });
    assert.deepEqual([part.installments.get("K").get("rest").remaining, part.overdue("2026-10-20").amount], [400, 700]);
    const back = buildObligations({ lines: [card("K", "2026-09-20", 600), pin("e1", "K", "2026-09-25", 100), pout("e2", "K", "2026-09-28", 300)], invoices: [], schedules: new Map([["K", [{ id: "t1", seq: 1, dueDate: "2026-11-10", amount: 600 }]]]), today: "2026-10-20" });
    assert.deepEqual([back.installments.get("K").get("back")?.remaining, back.installments.get("K").get("back")?.vade, back.overdue("2026-10-20").amount], [200, "2026-09-28", 200]);
  });
  // ELLE (M13, yaşayan mutant N06): şüpheli kayıt 15.01 1.000 — kayıt gününe kadar DOĞMUŞ kalem F1 (01.01, vade 01.06) önce; sonra doğan F2 (01.02, vade 10.02) ilk geçişte
  // alınmaz → F2 600 gecikmiş (01.03).
  it("M13: şüpheli kuyruğu önce kayıt gününe kadar doğmuş kalemlerden — sonra doğan erken vadeli kalem ilk geçişte alınmaz (N06)", () => {
    const r = build({ docs: [sale("N6-F1", "2026-01-01", 1000, "2026-06-01"), sale("N6-F2", "2026-02-01", 600, "2026-02-10")], doubtfulRecords: [{ date: "2026-01-15", remainingMinor: 100000 }], today: "2026-03-01" });
    assert.deepEqual([gecikmis(r, "2026-03-01"), r.items.find(i => i.invoiceId === "N6-F2").doubtful, r.items.find(i => i.invoiceId === "N6-F1").doubtful], [600, 0, 1000]);
  });
  // ELLE (komşu cheques-overview "karşılıksız çek taksiti yeniden açar"; lib/plans.mjs allocate kural 3): kart 600 (20.01 / 20.02 × 300) · 1. taksite bağlı tahsilat 300 (25.01,
  // ör. çek) · ters kaydı 300 (05.02, karşılıksız / iade) → kartın havuzu −300 → bağlı pay geri alınır: 1. taksit yeniden açık, Taksit İadesi kalemi YOK, 25.02'de gecikmiş 600.
  // İki bağlı tahsilat (1. ve 2. taksite × 300) + iade 300 → EN YENİ taksitten geriye: 2. taksit açılır, 1. kapalı kalır.
  it("bağlı tahsilattan çok iade / karşılıksız ters kaydı bağlı payı EN YENİ taksitten geriye geri alır (Taksit İadesi kalemi değil)", () => {
    const r = buildObligations({ lines: [card("K", "2026-01-10", 600), pin("e1", "K", "2026-01-25", 300, "t1"), pout("e2", "K", "2026-02-05", 300)], invoices: [], schedules, today: "2026-02-25" });
    assert.deepEqual(rem(r), [[300, 0], [300, 0]]);
    assert.equal(r.installments.get("K").get("back"), undefined, "Taksit İadesi kalemi yok");
    assert.equal(r.overdue("2026-02-25").amount, 600);
    const two = buildObligations({ lines: [card("K", "2026-01-10", 600), pin("e1", "K", "2026-01-25", 300, "t1"), pin("e2", "K", "2026-01-26", 300, "t2"), pout("e3", "K", "2026-02-05", 300)], invoices: [], schedules, today: "2026-02-25" });
    assert.deepEqual(rem(two), [[0, 0], [300, 0]], "en yeni taksit önce açılır");
    const more = buildObligations({ lines: [card("K", "2026-01-10", 600), pin("e1", "K", "2026-01-25", 300, "t2"), pout("e2", "K", "2026-02-05", 500)], invoices: [], schedules, today: "2026-02-25" });
    assert.deepEqual([...rem(more), more.installments.get("K").get("back")?.remaining], [[300, 0], [300, 0], 200], "bağlı paydan artan iade Taksit İadesi kalemi");
  });
  // Kartın kendi hesabı (lib/plans.mjs allocate; kart ekranı, yazım yanıtı) ile kuyruk aynı taksiti açık / kapalı görmeli (O-2): yalnız kart hareketli rastgele kartlar —
  // bağlı / bağsız tahsilat, iade, aynı taksite iki bağ, taksitini aşan bağ; taksit kalanları kuruşu kuruşuna eşit.
  it("rastgele kartlar (tohum 21–23 × 150): kuyruğun taksit kalanları = kartın kendi hesabı (allocate)", () => {
    for (const seed of [21, 22, 23]) {
      const r = (s => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648))(seed);
      for (let n = 0; n < 150; n += 1) {
        const count = 1 + Math.floor(r() * 4);
        const items = Array.from({ length: count }, (_, i) => ({ id: `t${i + 1}`, seq: i + 1, dueDate: `2026-0${i + 2}-15`, amount: 100 * (1 + Math.floor(r() * 5)) }));
        const total = items.reduce((s, i) => s + i.amount, 0);
        const entries = [];
        const moves = Math.floor(r() * 6);
        for (let m = 0; m < moves; m += 1) {
          const date = `2026-0${2 + Math.floor(m / 3)}-${String(10 + m).padStart(2, "0")}`;
          const amount = 50 * (1 + Math.floor(r() * 8));
          const out = r() < 0.3;
          const itemId = !out && r() < 0.6 ? items[Math.floor(r() * count)].id : "";
          entries.push({ id: `e${m}`, itemId, kind: out ? "out" : "in", amount, date });
        }
        const lines = [card("K", "2026-01-10", total), ...entries.map(e => (e.kind === "out" ? pout(e.id, "K", e.date, e.amount) : pin(e.id, "K", e.date, e.amount, e.itemId)))];
        const queue = buildObligations({ lines, invoices: [], schedules: new Map([["K", items]]), today: "2026-08-01" });
        const own = allocate({ total }, items, entries, { today: "2026-08-01" });
        const got = items.map(i => queue.installments.get("K").get(i.id).remaining);
        const want = own.items.sort((a, b) => a.seq - b.seq).map(i => i.remaining);
        assert.deepEqual(got, want, `tohum ${seed} kart ${n}: ${JSON.stringify(entries)}`);
      }
    }
  });
});

// Değişmez (C5 §2.10 madde 9, EK-1 §4): Σ açık borç kalemi − Σ açık alacak kalemi = cari bakiyesi — KARTLI rastgele carilerde (DK-C5B kararı (4): mutabakat motoru TYK'yi ölçmüyordu).
// Üretici şu sınıfları da üretir: kartın Kayıt Tarihi borçtan önce, stoktan taksitlendir (stok borcu + Mevcut Borç kartı), taksitsiz kart, eksik taksitli kart, "Hangi Taksite"
// bağlı tahsilat, Taksit İadesi, taksitli fatura, Kapatılacak Fatura. DIŞARIDA BIRAKILAN SINIFLAR (sessizce değil — adı, nedeni ve sayısı çıktıda):
//   (tur 2b-2: S101 / S110 / S120 kodlandı — dışarıda bırakılan sınıf KALMADI; sınıflar yalnız sayılır. S99: karşı yönlü kalemi olmayan caride fatura durumu (G2) = net
//   kuyruk (G1) — faturanın açığı = net kalanı + kapsanan + kendi kartının taksit kalanı.)
describe("TYK tur 2a — değişmez: kalemler toplamı = cari bakiyesi (kartlı, tohumlu rastgele)", () => {
  const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const day = n => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  for (const seed of [11, 12, 13]) {
    it(`tohum ${seed}: 200 cari × 22 olay — Σ kalem = bakiye (S99 / S101 / S110 / S120 içeride); karşı yönsüz caride fatura açığı = net kuyruk`, () => {
      const r = rng(seed);
      const counts = { checked: 0, S110: 0, S120: 0, S101: 0, S101kirpma: 0, S99denetlendi: 0, S99fatura: 0, coverBefore: 0, stockCover: 0, bare: 0, partial: 0, targeted: 0, back: 0, own: 0 };
      for (let a = 0; a < 200; a += 1) {
        const lines = [];
        const invoices = [];
        const schedules = new Map();
        const links = new Map();
        const cards = [];
        const flags = { avans: false, own: false, plainSale: false, counter: false };
        let n = 0;
        const at = () => `2026-12-01T${String(Math.floor(n / 60)).padStart(2, "0")}:${String((n += 1) % 60).padStart(2, "0")}:00.000Z`;
        const two = (planId, total, first) => schedules.set(planId, [{ id: `${planId}-1`, seq: 1, dueDate: first, amount: Math.floor(total / 2) }, { id: `${planId}-2`, seq: 2, dueDate: day(Math.floor(r() * 330)), amount: total - Math.floor(total / 2) }]);
        for (let i = 0; i < 22; i += 1) {
          const d = day(Math.floor(r() * 300));
          const amount = 10 * (1 + Math.floor(r() * 100));
          const p = r();
          const id = `${seed}-${a}-${i}`;
          if (p < 0.16) {
            const own = r() < 0.12;
            const line = { id: `l-F${id}`, origin: "invoice", kind: "debt", sourceId: `F${id}`, date: d, at: at(), debit: amount, credit: 0 };
            const inv = { id: `F${id}`, kind: "sale", status: "issued", payable: amount, dueDate: r() < 0.5 ? day(Math.floor(r() * 330)) : "", planId: own ? `O${id}` : "", issuedAt: line.at };
            if (own) {
              inv.planTotal = amount;
              two(inv.planId, amount, day(Math.floor(r() * 330)));
              cards.push({ planId: inv.planId, own: true });
              flags.own = true;
              counts.own += 1;
            } else flags.plainSale = true;
            invoices.push(inv);
            lines.push(line);
          } else if (p < 0.24) {
            lines.push({ id: `S${id}`, origin: "stock", kind: "debt", sourceId: `m${id}`, stockReason: "", date: d, at: at(), debit: amount, credit: 0 });
            if (r() < 0.6) {
              const planId = `C${id}`; // stoktan taksitlendir: kartın Kayıt Tarihi carinin Kayıt Tarihi (borçtan önce), tutar satış
              lines.push({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: true, coverTotal: amount, date: "2025-06-01", at: at(), debit: 0, credit: 0 });
              two(planId, amount, d);
              cards.push({ planId, cover: true });
              counts.stockCover += 1;
            }
          } else if (p < 0.4) {
            lines.push({ id: `P${id}`, origin: "account", kind: "in", date: d, at: at(), debit: 0, credit: amount });
            flags.avans = true;
          } else if (p < 0.46) {
            lines.push({ id: `O${id}x`, origin: "account", kind: "out", date: d, at: at(), debit: amount, credit: 0 });
            flags.counter = true;
          }
          else if (p < 0.56) lines.push({ id: `B${id}`, origin: "account", kind: "debt", date: d, at: at(), debit: amount, credit: 0 });
          else if (p < 0.62) {
            lines.push({ id: `Y${id}`, origin: "account", kind: "credit", date: d, at: at(), debit: 0, credit: amount });
            flags.counter = true;
          }
          else if (p < 0.7) {
            const bal = lines.reduce((s, l) => s + l.debit - l.credit, 0);
            if (bal > 20) {
              const planId = `M${id}`; // Mevcut Borç kartı: Kayıt Tarihi borçtan önce ya da sonra; tutar ≤ o anki bakiye
              const before = r() < 0.5;
              const total = Math.floor(bal * (0.3 + r() * 0.7));
              lines.push({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: true, coverTotal: total, date: before ? "2025-06-01" : d, at: at(), debit: 0, credit: 0 });
              two(planId, total, d);
              cards.push({ planId, cover: true });
              if (before) counts.coverBefore += 1;
            }
          } else if (p < 0.78) {
            const planId = `N${id}`; // Yeni Borç kartı: tam / eksik / taksitsiz
            const shape = r();
            lines.push({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: false, coverTotal: 0, date: d, at: at(), debit: amount, credit: 0 });
            if (shape < 0.25) counts.bare += 1;
            else if (shape < 0.5) {
              schedules.set(planId, [{ id: `${planId}-1`, seq: 1, dueDate: d, amount: Math.floor(amount / 3) }]);
              counts.partial += 1;
            } else two(planId, amount, d);
            cards.push({ planId });
          } else if (p < 0.92 && cards.length) {
            const c = cards[Math.floor(r() * cards.length)];
            const items = schedules.get(c.planId) || [];
            const out = r() < 0.15;
            const target = !out && items.length && r() < 0.35 ? items[Math.floor(r() * items.length)].id : "";
            if (target) counts.targeted += 1;
            if (out) counts.back += 1;
            lines.push({ id: `plan-entry:E${id}`, origin: "plan", planId: c.planId, kind: out ? "plan-out" : "plan-in", itemId: target, date: d, at: at(), debit: out ? amount : 0, credit: out ? 0 : amount });
            c.paid = true;
          } else {
            const inv = invoices.find(x => !x.planId);
            if (inv) {
              links.set(`P${id}`, inv.id); // Kapatılacak Fatura
              lines.push({ id: `P${id}`, origin: "account", kind: "in", date: d, at: at(), debit: 0, credit: amount });
            }
          }
        }
        const res = buildObligations({ lines, invoices, links, schedules, today: day(320) });
        const balance = Math.round(lines.reduce((s, l) => s + l.debit - l.credit, 0) * 100);
        const sum = Math.round(res.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0) * 100);
        // Tur 2b-2 (S101 / S110 / S120 = A'nın kodu): tur 2b-1'in DIŞARIDA bıraktığı sınıflar (S110: coverage.ambiguous; S101: tükettiği borçtan büyük kart + kart tahsilatı)
        // artık İÇERİDE — her caride Σ kalem = bakiye; sınıflar yalnız sayılır (coverage.rule / advance / kırpma).
        const covers = [...res.coverage.values()];
        if (covers.some(c => c.rule === "S110-satis" || c.rule === "S110-elle")) counts.S110 += 1;
        if (covers.some(c => c.rule === "S120")) counts.S120 += 1;
        if (covers.some(c => c.advance > 0)) counts.S101 += 1;
        if (covers.some(c => c.paid && c.consumed + c.advance < c.capacity - 0.005)) counts.S101kirpma += 1;
        if (flags.avans && flags.own && flags.plainSale) counts.S99denetlendi += 1;
        counts.checked += 1;
        assert.equal(sum, balance, `tohum ${seed} cari ${a}: Σ kalem ${sum / 100} ≠ bakiye ${balance / 100}`);
        // S99 = A: karşı yönlü kalemi (elle Alacak, müşteriye Ödeme) olmayan caride fatura durumu (G2) net kuyruğun (G1) aynısıdır — fatura listesi = Vade Takip / zil.
        if (!flags.counter) {
          for (const inv of invoices) {
            const net = res.invoiceNet.get(inv.id);
            // Kartın "Taksit İadesi" kalemi (back; iadeler kart tahsilatını aşınca) faturanın değil kartın borcudur — faturanın açığına girmez (açık ≤ ödenecek).
            const inst = inv.planId ? [...(res.installments.get(inv.planId) || [])].filter(([key]) => key !== "back").reduce((s, [, row]) => s + row.remaining, 0) : 0;
            assert.equal(Math.round(res.invoices.get(inv.id).open * 100), Math.round(Math.min(inv.payable, net.remaining + net.covered + inst) * 100), `tohum ${seed} cari ${a} fatura ${inv.id}: fatura açığı ${res.invoices.get(inv.id).open} ≠ net ${net.remaining} + kapsanan ${net.covered} + taksit ${inst}`);
            counts.S99fatura += 1;
          }
        }
      }
      console.log(`# tohum ${seed}: ${JSON.stringify(counts)} — dışarıda bırakılan sınıf YOK (S110 ${counts.S110}, S120 ${counts.S120}, S101 ön ödemeli ${counts.S101}, kırpılan + tahsilatlı ${counts.S101kirpma} içeride); denetlenen ${counts.checked} (S99 sınıfı ${counts.S99denetlendi}, fatura açığı = net kuyruk ${counts.S99fatura} fatura)`);
      assert.ok(counts.checked >= 60 && counts.coverBefore > 0 && counts.stockCover > 0 && counts.bare > 0 && counts.targeted > 0 && counts.back > 0, `sınıflar üretildi: ${JSON.stringify(counts)}`);
    });
  }
});
