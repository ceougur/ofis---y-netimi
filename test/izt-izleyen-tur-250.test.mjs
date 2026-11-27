// 2.5.0 İzleyen küçük tur (görev metni docs/devir/2.5.0-DEVAM/izt-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §19).
// KARARLAR (görev metninden AYNEN): karar (4) 2B-S3 = A ("kart küçülmesi … vadesi en önce gelen açık taksitten başlar; küçülme kartın açık kalanını aşarsa fazlası carinin avansı; parası geri verilen
// iadede kart değişmez"); S234 = A; S238 = A ("geri gelen tutar küçülmenin TERSİYLE, iadenin küçülttüğü AYNI taksite döner (iade hiç olmamış gibi)"); S239 = A ("iade önce faturanın kart DIŞINDAKİ
// açık kısmını kapatır (kart değişmez; dışarıdaki 300 kapanır)"); S240 = A ("S126'daki dağılım sırası AYNEN kalır"). Beklenenler kararların sözünden ve kâhinin elle tablolarından (d55 B1 / B2 —
// test/bagimsiz/cari/senaryolar/d55-…; yalnız okundu) ve tabanın (izt-taban 44a1762d) değişmeyen bakiyelerinden.
//  P2a / P2k (P-2, d55 B2): kart 900 (05.10 / 05.11 / 05.12), kart tahsilatı 600, iade 600 → kart 600, Tahsil Edilen 600, Kalan 0; iadenin açığı 300 (avans); bakiye −300 (açık / kapalı kart).
//  P2o: kendi kartı (taksitli fatura) — aynı sayılar (tabanda da doğru; bekçi).
//  P1a / P1k / P1o (P-1, d55 B1): kart 900, tahsilat 300, 10.11 iade 300, 20.11 iade iptali → taksitler iade öncesiyle AYNI; 20.11 gecikmiş 300 (açık / kendi kart) — kapalı kartta 600 (S205).
//  P1e: kesim kaydı olmayan (eski) iade → büyüme bugünkü gibi SON taksite.
//  B1a / B1k (BULGU-1): iki Mevcut Borç kartı aynı caride, ilk faturaya iade 300 → gecikmiş açık 0 / 0; kapalı ilk kart 08.10 0, 09.10 600; bakiye 900, Mutabakat Testi temiz.
//  C1a / C1k (S234-c): fatura 900 → kart 900 → Düzenle 900 → 300 → kart 300 (kesim 05.10 / 05.11'den; 05.12 kalır); bakiye 300.
//  S239 / S240: kart değişmez / kart 900 · Tahsil Edilen 300 · Kalan 600 (bekçi).
//  E2 (BULGU-2 sunucu): kaydedilmiş taksitli fatura → aynı ödeme planıyla Düzenle → kart kimliği, kart no, taksitler AYNEN; taksit sayısı değişince yeni kart (bugünkü).
//  H6 (İş 6 eşdeğerlik): fatura kartı GET'inin önbellekli okumaları (kapama defteri, kuyruk) işlem içinde baştan kurulanla AYNI — her yazım türünden sonra.
// NASIL BOZARIM (mutantlar, raporda): kuyrukta tutma (holds) kaldırılır → P2a / P2k kırmızı; ön geçiş kapasitesi (extraCap) kaldırılır → B1a / B1k kırmızı; growForInvoice kayıtları yok sayar → P1a / P1o
// kırmızı; Düzenle küçültmesi kaldırılır → C1a / C1k kırmızı; korunan kart her zaman kaldırılır → E2 kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";

const W = "/api/workspace";
const own3 = { rest: "installments", installments: { count: 3, firstDue: "2026-10-05" } };

async function world(start, fn) {
  const ctx = await bootBank({ now: { time: `${start}T12:00:00+03:00`, fixed: true } });
  const api = ctx.api;
  let minute = 0;
  let day = start;
  const at = d => {
    day = d;
    minute = 0;
    ctx.server.clock.set(`${d}T12:00:00+03:00`);
  };
  const tick = () => ctx.server.clock.set(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api,
    ctx,
    at,
    acc: async () => (await must("cari", api.post(`${W}/accounts`, { name: "İzt Müşteri", type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, payment = { rest: "account" }) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id),
    debt: async (accountId, date, amount) => (tick(), (await must("borç", api.post(`${W}/accounts/${accountId}/entries`, { kind: "debt", amount: String(amount), date, note: "elle" }))).id),
    cover: async (accountId, total, firstDue, registeredOn) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `M ${minute}`, total: String(total), registeredOn, mode: "auto", count: 3, firstDue, coversBalance: true }))).id),
    pay: (planId, amount) => (tick(), must("tahsilat", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: day, method: "cash" }))),
    close: async id => {
      tick();
      const v = await must("kart", api.get(`${W}/plans/${id}`));
      const r = await api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining });
      assert.equal(r.status, 200, `Kartı Kapat ${r.status}`);
    },
    giveBack: async (invoiceId, accountId, qty) => {
      tick();
      const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
      return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: day, lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }))).id;
    },
    cancel: id => (tick(), must("iptal", api.post(`${W}/invoices/${id}/cancel`, { reason: "x" }))),
    edit: async (id, qty, payment = { rest: "account" }) => {
      tick();
      const d = await must("fatura", api.get(`${W}/invoices/${id}`));
      const r = await api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment, force: true });
      assert.equal(r.status, 200, `Düzenle ${r.status} ${JSON.stringify(r.body)}`);
    },
    ownPlan: async f => (await must("fatura", api.get(`${W}/invoices/${f}`))).planId,
    card: async id => {
      const v = await must("kart", api.get(`${W}/plans/${id}`));
      return { status: v.status, total: v.total, paid: v.totals.paid, left: v.totals.remaining, items: v.items.map(i => `${i.dueDate}:${i.amount}`) };
    },
    rows: planId => ctx.store.all("SELECT id, seq, due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", planId),
    account: async A => (await must("cari", api.get(`${W}/accounts/${A}`))).totals,
    ok: async () => (await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`))).ok,
    invoice: async id => (await must("faturalar", api.get(`${W}/invoices?tab=all`))).invoices.find(x => x.id === id),
  };
  try {
    return await fn(h);
  } finally {
    ctx.server.close();
  }
}

describe("İzleyen küçük tur — P-2 (karar (4): fazlası carinin avansı)", () => {
  for (const closed of [false, true]) {
    it(`${closed ? "P2k — Borçta Kalsın ile kapatılmış" : "P2a — açık"} Mevcut Borç kartı: tahsilat 600 + iade 600 → kart 600 · Tahsil Edilen 600 · Kalan 0; iadenin açığı 300`, () =>
      world("2026-09-02", async h => {
        const A = await h.acc();
        const f = await h.goods(A, "2026-09-01", 3);
        const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
        h.at("2026-09-03");
        await h.pay(k, 600);
        if (closed) {
          h.at("2026-09-04");
          await h.close(k);
        }
        h.at("2026-11-10");
        const r = await h.giveBack(f, A, 2);
        h.at("2026-11-20");
        const card = await h.card(k);
        assert.deepEqual({ total: card.total, paid: card.paid, left: card.left }, { total: 600, paid: 600, left: 0 }, "kart (karar (4): küçülme kalanla sınırlı, fazlası avans)");
        assert.equal((await h.invoice(r)).open, 300, "iade belgesinin açığı = carinin avansı");
        assert.equal((await h.invoice(f)).open, 0, "faturanın gösterilen açığı");
        const t = await h.account(A);
        assert.equal(t.balance, -300, "bakiye (tabanla aynı)");
        assert.equal(t.overdueDebt, 0, "gecikmiş");
        assert.equal(await h.ok(), true, "Mutabakat Testi");
      }));
  }
  it("P2o — kendi kartı (taksitli fatura): tahsilat 600 + iade 600 → kart 600 · Tahsil Edilen 600 · Kalan 0 (bekçi)", () =>
    world("2026-09-01", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3, own3);
      const k = await h.ownPlan(f);
      h.at("2026-09-03");
      await h.pay(k, 600);
      h.at("2026-11-10");
      const r = await h.giveBack(f, A, 2);
      h.at("2026-11-20");
      const card = await h.card(k);
      assert.deepEqual({ total: card.total, paid: card.paid, left: card.left }, { total: 600, paid: 600, left: 0 });
      assert.equal((await h.invoice(r)).open, 300);
      assert.equal((await h.account(A)).balance, -300);
    }));
});

describe("İzleyen küçük tur — P-1 / S238 = A (iade iptali aynı taksite)", () => {
  const cases = [
    { name: "P1a — açık Mevcut Borç kartı", own: false, closed: false, overdue: 300 },
    { name: "P1k — Borçta Kalsın ile kapatılmış Mevcut Borç kartı (S205: kalemler kapanış ertesinden gecikmiş)", own: false, closed: true, overdue: 600 },
    { name: "P1o — kendi kartı (taksitli fatura)", own: true, closed: false, overdue: 300 },
  ];
  for (const c of cases) {
    it(`${c.name}: tahsilat 300 → 10.11 iade 300 → 20.11 iptal → taksitler iade öncesiyle AYNI; 20.11 gecikmiş ${c.overdue}`, () =>
      world(c.own ? "2026-09-01" : "2026-09-02", async h => {
        const A = await h.acc();
        const f = await h.goods(A, "2026-09-01", 3, c.own ? own3 : undefined);
        const k = c.own ? await h.ownPlan(f) : await h.cover(A, 900, "2026-10-05", "2026-09-02");
        h.at("2026-09-03");
        await h.pay(k, 300);
        if (c.closed) {
          h.at("2026-09-04");
          await h.close(k);
        }
        h.at("2026-11-10");
        const before = h.rows(k);
        const r = await h.giveBack(f, A, 1);
        assert.equal((await h.card(k)).total, 600, "iade kartı küçültür");
        assert.equal(h.rows(k).some(row => row.dueDate === "2026-11-05"), false, "kesim vadesi en önce gelen AÇIK taksitten (05.11)");
        h.at("2026-11-20");
        await h.cancel(r);
        assert.deepEqual(h.rows(k).map(row => [row.id, row.seq, row.dueDate, row.amount]), before.map(row => [row.id, row.seq, row.dueDate, row.amount]), "taksitler iade öncesiyle aynı (kimlik, sıra, vade, tutar)");
        const card = await h.card(k);
        assert.deepEqual({ total: card.total, paid: card.paid, left: card.left }, { total: 900, paid: 300, left: 600 });
        const t = await h.account(A);
        assert.equal(t.balance, 600, "bakiye (tabanla aynı)");
        assert.equal(t.overdueDebt, c.overdue, "20.11 gecikmiş (05.11 taksiti geri geldi)");
        assert.equal(await h.ok(), true, "Mutabakat Testi");
      }));
  }
  it("P1e — kesim kaydı olmayan (eski sürümün) iadesi: iptalde büyüme bugünkü gibi SON taksite", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3);
      const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
      h.at("2026-09-03");
      await h.pay(k, 300);
      h.at("2026-11-10");
      const r = await h.giveBack(f, A, 1);
      const payment = JSON.parse(h.ctx.store.get("SELECT payment_json AS j FROM invoices WHERE id = ?", r).j);
      assert.ok(payment.coverCutItems, "yeni iade kesilen taksitleri kaydeder");
      delete payment.coverCutItems;
      h.ctx.store.run("UPDATE invoices SET payment_json = ? WHERE id = ?", JSON.stringify(payment), r);
      h.at("2026-11-20");
      await h.cancel(r);
      assert.deepEqual((await h.card(k)).items, ["2026-10-05:300", "2026-12-05:600"], "kayıtsız iade: son taksite (bugünkü)");
      assert.equal((await h.account(A)).balance, 600);
    }));
});

describe("İzleyen küçük tur — BULGU-1 (kuyruk kapama defteriyle aynı kapsam okuması)", () => {
  for (const closed of [false, true]) {
    it(`${closed ? "B1k — ilk kart Borçta Kalsın ile kapatılmış" : "B1a — iki açık kart"}: ilk faturaya iade 300 → gecikmiş 08.10 0 / 09.10 ${closed ? 600 : 0}; bakiye 900`, () =>
      world("2026-10-08", async h => {
        const A = await h.acc();
        const g = await h.goods(A, "2026-10-05", 3);
        const q = await h.cover(A, 900, "2026-10-10", "2026-10-05");
        const g2 = await h.goods(A, "2026-10-06", 1);
        const r = await h.cover(A, 300, "2026-10-20", "2026-10-06");
        if (closed) await h.close(q);
        await h.giveBack(g, A, 1);
        let t = await h.account(A);
        assert.equal(t.balance, 900, "bakiye (tabanla aynı)");
        assert.equal(t.overdueDebt, 0, "08.10 gecikmiş");
        assert.equal((await h.invoice(g2)).payState, "installment", "ikinci fatura yeni kartın içinde (kapama defteriyle aynı)");
        const second = await h.card(r);
        assert.deepEqual({ total: second.total, left: second.left }, { total: 300, left: 300 }, "yeni kartın taksitleri açık");
        h.at("2026-10-09");
        t = await h.account(A);
        assert.equal(t.overdueDebt, closed ? 600 : 0, "09.10 gecikmiş (kapalı kart: S205 — kapanış ertesinden)");
        assert.equal(await h.ok(), true, "Mutabakat Testi");
      }));
  }
});

describe("İzleyen küçük tur — S234-c (Düzenle ile azaltma iade gibi)", () => {
  for (const closed of [false, true]) {
    it(`${closed ? "C1k — Borçta Kalsın kapalı" : "C1a — açık"} Mevcut Borç kartı: Düzenle 900 → 300 → kart 300 (05.12 kalır)`, () =>
      world("2026-09-02", async h => {
        const A = await h.acc();
        const f = await h.goods(A, "2026-09-01", 3);
        const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
        if (closed) {
          h.at("2026-09-04");
          await h.close(k);
        }
        h.at("2026-09-10");
        await h.edit(f, 1);
        const card = await h.card(k);
        assert.deepEqual({ status: card.status, total: card.total, left: card.left }, { status: closed ? "closed" : "active", total: 300, left: 300 });
        assert.deepEqual(h.rows(k).map(row => `${row.dueDate}:${row.amount}`), ["2026-12-05:300"], "kesim vadesi en önce gelen açık taksitten (karar (4))");
        assert.equal((await h.account(A)).balance, 300, "bakiye (tabanla aynı)");
        assert.equal(await h.ok(), true, "Mutabakat Testi");
      }));
  }
});

describe("İzleyen küçük tur — S234-c sınırı (Düzenle'de eklenen peşin ödeme kartı küçültmez — ödemedir, iade değil)", () => {
  it("C2: fatura 900 → kart 900 → Düzenle aynı tutar + 300 peşin → kart 900 kalır; bakiye 600", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3);
      const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
      h.at("2026-09-10");
      await h.edit(f, 3, { cash: [{ amount: "300", method: "cash" }], rest: "account" });
      assert.equal((await h.card(k)).total, 900, "kart küçülmez (tutar azalmadı)");
      assert.equal((await h.account(A)).balance, 600);
      assert.equal(await h.ok(), true, "Mutabakat Testi");
    }));
});

describe("İzleyen küçük tur — S239 = A ve S240 = A (bugünkü davranış kararla aynı — bekçi)", () => {
  it("S239: fatura 900, kart 600 (faturanın 600'ü kartta), iade 300 → kart DEĞİŞMEZ (dışarıdaki 300 kapanır); 06.10 gecikmiş = ilk taksit 200", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3);
      const k = await h.cover(A, 600, "2026-10-05", "2026-09-02");
      h.at("2026-09-10");
      await h.giveBack(f, A, 1);
      const card = await h.card(k);
      assert.deepEqual({ total: card.total, left: card.left, items: card.items }, { total: 600, left: 600, items: ["2026-10-05:200", "2026-11-05:200", "2026-12-05:200"] });
      assert.equal((await h.account(A)).balance, 600);
      h.at("2026-10-06");
      assert.equal((await h.account(A)).overdueDebt, 200, "yalnız kartın ilk taksiti gecikmiş (faturanın dışarıdaki kısmı iadeyle kapandı)");
    }));
  it("S240: elle borç 300 + fatura 900 → kart 1200, tahsilat 300, iade 300 → kart 900 · Tahsil Edilen 300 · Kalan 600; fatura 600'ü kartta", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      await h.debt(A, "2026-08-20", 300);
      const f = await h.goods(A, "2026-09-01", 3);
      const k = await h.cover(A, 1200, "2026-10-05", "2026-09-02");
      h.at("2026-09-03");
      await h.pay(k, 300);
      h.at("2026-09-10");
      await h.giveBack(f, A, 1);
      const card = await h.card(k);
      assert.deepEqual({ total: card.total, paid: card.paid, left: card.left }, { total: 900, paid: 300, left: 600 });
      const inv = await h.invoice(f);
      assert.equal(inv.inPlan, 600, "ödeme eski kaleme (elle borç), iade yalnız kendi kalemini küçültür");
      assert.equal((await h.account(A)).balance, 600);
    }));
});

describe("İzleyen küçük tur — BULGU-2 (Düzenle değiştirmeden Kaydet kartı aynen bırakır)", () => {
  it("E2: aynı ödeme planıyla Düzenle → kart kimliği, kart no, taksitler aynı; taksit sayısı değişince yeni kart", () =>
    world("2026-09-01", async h => {
      const A = await h.acc();
      const plan = { rest: "installments", installments: { count: 4, firstDue: "2026-10-07", everyMonths: 2 } };
      const f = await h.goods(A, "2026-09-01", 3, { cash: [{ amount: "100", method: "cash" }], ...plan });
      const k = await h.ownPlan(f);
      const head = () => h.ctx.store.get("SELECT id, ref_no AS refNo, total, status, deleted_at AS deletedAt FROM plans WHERE id = ?", k);
      const before = { head: head(), rows: h.rows(k) };
      await h.edit(f, 3, { cash: [{ amount: "100", method: "cash", lineKey: "i0" }], ...plan });
      assert.equal(await h.ownPlan(f), k, "kart aynı");
      assert.deepEqual({ head: head(), rows: h.rows(k) }, before, "kart ve taksitleri aynen");
      assert.equal((await h.account(A)).balance, 800);
      await h.edit(f, 3, { cash: [{ amount: "100", method: "cash", lineKey: "i0" }], rest: "installments", installments: { count: 3, firstDue: "2026-10-07", everyMonths: 2 } });
      const next = await h.ownPlan(f);
      assert.notEqual(next, k, "taksit sayısı değişti → yeni kart (bugünkü)");
      assert.ok(head().deletedAt, "eski kart kaldırıldı");
      assert.equal(h.rows(next).length, 3);
      assert.equal((await h.account(A)).balance, 800);
      assert.equal(await h.ok(), true, "Mutabakat Testi");
    }));
});

describe("İzleyen küçük tur — İş 6 eşdeğerlik (fatura kartı GET önbelleği = baştan kurulan)", () => {
  it("H6: kapama defteri ve kuyruk okumaları her yazım türünden sonra işlem içinde baştan kurulanla aynı", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      const inv = h.ctx.app.context.invoices;
      const f = await h.goods(A, "2026-09-01", 3);
      const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
      const g = await h.goods(A, "2026-09-02", 2);
      const rowOf = id => h.ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", id);
      const same = async label => {
        for (const id of [f, g]) {
          const row = rowOf(id);
          const cached = [inv.cardLedgerState(row), inv.cardLedgerState(row), inv.paymentStates([row]).get(id)];
          const fresh = h.ctx.store.tx(() => [inv.cardLedgerState(row), inv.paymentStates([row]).get(id)]);
          assert.deepEqual(cached[0], fresh[0], `${label}: kapama defteri ${id}`);
          assert.deepEqual(cached[1], fresh[0], `${label}: kapama defteri (ikinci okuma) ${id}`);
          assert.deepEqual(JSON.parse(JSON.stringify(cached[2])), JSON.parse(JSON.stringify(fresh[1])), `${label}: kuyruk ${id}`);
          const got = await must("fatura kartı", h.api.get(`${W}/invoices/${id}`));
          assert.equal(got.cancelNotice, (await must("fatura kartı", h.api.get(`${W}/invoices/${id}`))).cancelNotice, `${label}: iptal notu`);
        }
      };
      await same("başta");
      h.at("2026-09-03");
      await h.pay(k, 300);
      await same("kart tahsilatı");
      const r = await h.giveBack(f, A, 1);
      await same("iade");
      await h.cancel(r);
      await same("iade iptali");
      await h.edit(g, 1);
      await same("Düzenle");
      await h.close(k);
      await same("Kartı Kapat");
      h.at("2026-11-20");
      await same("gün dönümü");
    }));
});
