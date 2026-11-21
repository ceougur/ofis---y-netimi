// 2.5.0 İzleyen tur 2 (görev metni docs/devir/2.5.0-DEVAM/izt2-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §20).
// KARARLAR (görev metninden AYNEN):
//   S241 = A — "fazlası carinin avansı — iadeyle AYNI (karar (4) 2B-S3 = A); Düzenle kesintisi iade kesintisi gibi kayda geçer, iki görünüm aynı sayıyı verir (kart 600 / Tahsil Edilen 600 /
//              Kalan 0; avans 300)". S242 = A — "bugünkü gibi kalsın — artış kartı büyütmez, faturanın vadesiyle ayrı açık durur".
//   S110 = A ("kart KENDİ borcunu taşır (stoktan satışta o satışı; elle kartta taksitlendirilen borcu)"), S120 = A ("kart yalnız ELLE borçları, eskiden yeniye içine alır; faturalar kendi
//              vadesiyle ayrı kalır"); BAŞ MİMAR KARARI 21.11 18:28 (2): "kapama defterinin kapsam SEÇİMİ kuyruğunkiyle TEK yardımcıya getirilir (iade, iptal, Düzenle bu seçimi okur)".
//   S238 = A — "geri gelen tutar küçülmenin TERSİYLE, iadenin küçülttüğü AYNI taksite döner (iade hiç olmamış gibi)"; D 18:28 (4): iade Düzenle'si bunun komşu yolu.
// Beklenenler kararların sözünden ve önceki turun bağımsız beklentisinden (P-2 = d55 B2: kart 600 / Tahsil Edilen 600 / Kalan 0, avans 300); bakiyeler tabanla (288b91dc) aynı.
//  K1a / K1k: kart 900 (05.10 / 05.11 / 05.12), kart tahsilatı 600, Düzenle 900 → 300 → kart penceresi, cari kartı özeti, Taksitler listesi ve kartın kendi hesabı AYNI: 600 / 600 / 0;
//             bakiye −300 (avans); gecikmiş 0 (açık / Borçta Kalsın kapalı kart).
//  K1o: kendi kartı (taksitli fatura) tahsilatlıysa Düzenle 409 (bugünkü — §16.4; S241 bu yolda doğmaz; bekçi).
//  K2: S242 = A bekçi (fatura 300 → kart 300 → Düzenle 300 → 900: kart 300; artan 600 faturanın vadesiyle — 10.09 gecikmiş 600). K2b: K1a'dan sonra Düzenle 300 → 900 → kart 600 / 600 / 0
//      değişmez, faturanın 300'ü kendi vadesiyle açık, bakiye 300.
//  A1–A4 (kapsam seçimi): A 600 (01.09) + B 600 (02.09), elle kart 600 → kart A'yı alır (kuyruk ve kapama defteri); B'nin İptal Et'i kartı DEĞİŞTİRMEZ; A'nın İptal Et'i kartı kapatır (S211);
//      iade A'nın kartını küçültür, B'ye iade kartı değiştirmez. A5 (S110-elle): elle borç 600 + daha yeni fatura 900, kart 600 → kart elle borcu alır, faturanın İptal Et'i kartı değiştirmez.
//      A6 (S120): X 500 + Y 700 (elle) + daha yeni F 600, kart 900 → kart X 500 + Y 400; F'nin İptal Et'i kartı değiştirmez.
//  R1 (İş 4): taksitli fatura 900, tahsilat 300, iade 600 (05.11 + 05.12 kesilir), iade Düzenle 2 → 1 → kendi kart 05.10 300 + 05.12 300 (iade 300 yalnız 05.11'i keser — iade hiç olmamış
//      gibi, sonra yeni iade); 20.11 gecikmiş 0. R2: kapsayan Mevcut Borç kartında aynı (bekçi — restoreCuts önceden de kayda göre).
// NASIL BOZARIM (mutantlar, raporda): withEditCuts kaldırılır → K1a / K1k kırmızı; kapama defterinde newestFirst geri gelir → A2 / A3 / A5 / A6 kırmızı; undoReturnCuts Düzenle'de çağrılmaz → R1 kırmızı.
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
    acc: async () => (await must("cari", api.post(`${W}/accounts`, { name: "İzt2 Müşteri", type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, payment = { rest: "account" }) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id),
    debt: async (accountId, date, amount) => (tick(), (await must("borç", api.post(`${W}/accounts/${accountId}/entries`, { kind: "debt", amount: String(amount), date, note: "elle" }))).id),
    cover: async (accountId, total, firstDue, registeredOn, count = 3) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `M ${minute}`, total: String(total), registeredOn, mode: "auto", count, firstDue, coversBalance: true }))).id),
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
    editReturn: async (returnId, qty) => {
      tick();
      const d = await must("iade", api.get(`${W}/invoices/${returnId}`));
      const r = await api.post(`${W}/invoices/${returnId}/edit`, { kind: "sale_return", accountId: d.accountId, originalId: d.originalId, issueDate: d.issueDate, lines: [{ originLineId: d.lines[0].originLineId, qty }], payment: { cash: [] }, force: true });
      assert.equal(r.status, 200, `iade Düzenle ${r.status} ${JSON.stringify(r.body)}`);
    },
    cancel: id => (tick(), must("iptal", api.post(`${W}/invoices/${id}/cancel`, { reason: "x" }))),
    edit: async (id, qty, payment = { rest: "account" }) => {
      tick();
      const d = await must("fatura", api.get(`${W}/invoices/${id}`));
      return api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment, force: true });
    },
    ownPlan: async f => (await must("fatura", api.get(`${W}/invoices/${f}`))).planId,
    card: async id => {
      const v = await must("kart", api.get(`${W}/plans/${id}`));
      return { status: v.status, total: v.total, paid: v.totals.paid, left: v.totals.remaining };
    },
    // Kartın KENDİ hesabı (tutar − net tahsilat) — kuyruktan bağımsız.
    own: planId => {
      const total = Number(ctx.store.get("SELECT total FROM plans WHERE id = ?", planId).total);
      const paid = Number(ctx.store.get("SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) AS n FROM plan_entries WHERE plan_id = ?", planId).n);
      return { total, paid, left: Math.round((total - paid) * 100) / 100 };
    },
    summary: async (A, planId) => {
      const p = (await must("cari", api.get(`${W}/accounts/${A}`))).plans.find(x => x.id === planId);
      return { paid: p.totals.paid, left: p.totals.remaining };
    },
    listed: async planId => {
      const p = (await must("Taksitler", api.get(`${W}/plans?status=all`))).plans.find(x => x.id === planId);
      return { paid: p.totals.paid, left: p.totals.remaining };
    },
    rows: planId => ctx.store.all("SELECT due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", planId).map(row => `${row.dueDate}:${row.amount}`),
    account: async A => (await must("cari", api.get(`${W}/accounts/${A}`))).totals,
    ok: async () => (await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`))).ok,
    invoice: async id => (await must("faturalar", api.get(`${W}/invoices?tab=all`))).invoices.find(x => x.id === id),
    covered: id => {
      const row = ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", id);
      return ctx.app.context.invoices.cardLedgerState(row).coveredBy || {};
    },
  };
  try {
    return await fn(h);
  } finally {
    ctx.server.close();
  }
}

describe("İzleyen tur 2 — S241 = A (Düzenle ile kartın açık kalanından fazla azaltma: fazlası avans, iadeyle aynı)", () => {
  for (const closed of [false, true]) {
    it(`${closed ? "K1k — Borçta Kalsın ile kapatılmış" : "K1a — açık"} Mevcut Borç kartı: tahsilat 600 + Düzenle 900 → 300 → dört görünümde kart 600 · Tahsil Edilen 600 · Kalan 0; bakiye −300`, () =>
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
        h.at("2026-09-10");
        assert.equal((await h.edit(f, 1)).status, 200, "Düzenle");
        const want = { total: 600, paid: 600, left: 0 };
        assert.deepEqual(h.own(k), want, "kartın kendi hesabı (karar (4): küçülme kalanla sınırlı)");
        const card = await h.card(k);
        assert.deepEqual({ total: card.total, paid: card.paid, left: card.left }, want, "kart penceresi (kuyruk görünümü) kendi hesapla AYNI");
        assert.deepEqual(await h.summary(A, k), { paid: 600, left: 0 }, "cari kartı özeti");
        assert.deepEqual(await h.listed(k), { paid: 600, left: 0 }, "Taksitler listesi");
        assert.equal((await h.invoice(f)).open, 0, "faturanın açığı");
        const t = await h.account(A);
        assert.equal(t.balance, -300, "bakiye (tabanla aynı): fazlası carinin avansı");
        assert.equal(t.overdueDebt, 0, "gecikmiş");
        h.at("2026-12-20");
        assert.equal((await h.account(A)).overdueDebt, 0, "kartın taksitleri ödenmiş — ileride de gecikmiş yok");
        assert.equal(await h.ok(), true, "Mutabakat Testi");
      }));
  }
  it("K1o — kendi kartı (taksitli fatura) tahsilatlı: Düzenle 409 (bugünkü — §16.4; bekçi)", () =>
    world("2026-09-01", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3, own3);
      const k = await h.ownPlan(f);
      h.at("2026-09-03");
      await h.pay(k, 600);
      const r = await h.edit(f, 1, own3);
      assert.equal(r.status, 409, "tahsilatlı kendi kartın faturası Düzenle'de reddedilir");
      assert.deepEqual(h.own(k), { total: 900, paid: 600, left: 300 });
      assert.equal((await h.account(A)).balance, 300);
    }));
});

describe("İzleyen tur 2 — S242 = A (artış kartı büyütmez — bekçi)", () => {
  it("K2: fatura 300 → kart 300 → Düzenle 300 → 900 → kart 300; artan 600 faturanın vadesiyle (10.09 gecikmiş 600)", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 1);
      const k = await h.cover(A, 300, "2026-10-05", "2026-09-02");
      h.at("2026-09-05");
      assert.equal((await h.edit(f, 3)).status, 200);
      assert.deepEqual(h.own(k), { total: 300, paid: 0, left: 300 });
      assert.equal((await h.card(k)).left, 300, "kart penceresi");
      h.at("2026-09-10");
      const t = await h.account(A);
      assert.equal(t.balance, 900);
      assert.equal(t.overdueDebt, 600, "artan 600 faturanın kendi vadesiyle (01.09) gecikmiş");
      assert.equal(await h.ok(), true);
    }));
  it("K2b: K1a'dan sonra Düzenle 300 → 900 → kart 600 · Tahsil Edilen 600 · Kalan 0 değişmez; faturanın 300'ü kendi vadesiyle açık; bakiye 300", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3);
      const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
      h.at("2026-09-03");
      await h.pay(k, 600);
      h.at("2026-09-10");
      assert.equal((await h.edit(f, 1)).status, 200);
      h.at("2026-09-12");
      assert.equal((await h.edit(f, 3)).status, 200);
      assert.deepEqual(h.own(k), { total: 600, paid: 600, left: 0 });
      const card = await h.card(k);
      assert.deepEqual({ paid: card.paid, left: card.left }, { paid: 600, left: 0 });
      assert.equal((await h.invoice(f)).open, 300, "artan kısım faturanın kendi açığı");
      const t = await h.account(A);
      assert.equal(t.balance, 300);
      assert.equal(t.overdueDebt, 300, "faturanın vadesi 01.09 — artan kısım gecikmiş");
      assert.equal(await h.ok(), true);
    }));
});

describe("İzleyen tur 2 — kapsam seçimi tek yardımcıda (S110 = A, S120 = A; D 18:28 (2))", () => {
  const two = async h => {
    const acc = await h.acc();
    const A = await h.goods(acc, "2026-09-01", 2);
    const B = await h.goods(acc, "2026-09-02", 2);
    const k = await h.cover(acc, 600, "2026-10-05", "2026-09-03", 2);
    return { acc, A, B, k };
  };
  it("A1: kuyruk ve kapama defteri kartı AYNI faturaya (A — s2 sırası; S123 = C) bağlar", () =>
    world("2026-09-03", async h => {
      const { A, B, k } = await two(h);
      assert.equal((await h.invoice(A)).payState, "installment", "A 'Taksitte'");
      assert.equal((await h.invoice(B)).payState, "overdue", "B 'Gecikti'");
      assert.deepEqual(h.covered(A), { [k]: 600 }, "kapama defteri: kart A'yı kapsar");
      assert.deepEqual(h.covered(B), {}, "kapama defteri: B kartın dışında");
    }));
  it("A2: B'nin İptal Et'i kartı DEĞİŞTİRMEZ; bakiye 600, A 'Taksitte'", () =>
    world("2026-09-03", async h => {
      const { acc, A, B, k } = await two(h);
      await h.cancel(B);
      assert.deepEqual(await h.card(k), { status: "active", total: 600, paid: 0, left: 600 });
      assert.equal((await h.account(acc)).balance, 600);
      assert.equal((await h.invoice(A)).payState, "installment");
      assert.equal(await h.ok(), true);
    }));
  it("A3: A'nın İptal Et'i kartı kapatır (S211 — tahsilatsız kart 0'a iner); B kendi vadesiyle açık", () =>
    world("2026-09-03", async h => {
      const { acc, A, B, k } = await two(h);
      await h.cancel(A);
      const card = await h.card(k);
      assert.deepEqual({ status: card.status, total: card.total }, { status: "closed", total: 0 });
      const t = await h.account(acc);
      assert.equal(t.balance, 600);
      assert.equal(t.overdueDebt, 600, "B (02.09) gecikmiş");
      assert.equal((await h.invoice(B)).payState, "overdue");
      assert.equal(await h.ok(), true);
    }));
  it("A4: iade A'nın kartını küçültür (300); B'ye iade kartı değiştirmez", () =>
    world("2026-09-03", async h => {
      const { acc, A, B, k } = await two(h);
      await h.giveBack(A, acc, 1);
      assert.equal(h.own(k).total, 300, "A'ya iade → kart 300");
      await h.giveBack(B, acc, 1);
      assert.equal(h.own(k).total, 300, "B'ye iade → kart değişmez");
      assert.equal((await h.account(acc)).balance, 600);
      assert.equal(await h.ok(), true);
    }));
  it("A5 (S110-elle): elle borç 600 + daha yeni fatura 900, kart 600 → kart elle borcu alır; faturanın İptal Et'i kartı değiştirmez", () =>
    world("2026-09-03", async h => {
      const acc = await h.acc();
      await h.debt(acc, "2026-08-20", 600);
      const F = await h.goods(acc, "2026-09-01", 3);
      const k = await h.cover(acc, 600, "2026-10-05", "2026-09-03", 2);
      assert.deepEqual(h.covered(F), {}, "fatura kartın dışında (kapama defteri = kuyruk)");
      await h.cancel(F);
      assert.deepEqual(await h.card(k), { status: "active", total: 600, paid: 0, left: 600 });
      assert.equal((await h.account(acc)).balance, 600);
      assert.equal(await h.ok(), true);
    }));
  it("A6 (S120): elle X 500 + elle Y 700 + daha yeni fatura F 600, kart 900 → kart X + Y'nin 400'ü; F'nin İptal Et'i kartı değiştirmez", () =>
    world("2026-09-03", async h => {
      const acc = await h.acc();
      await h.debt(acc, "2026-08-25", 500);
      await h.debt(acc, "2026-08-28", 700);
      const F = await h.goods(acc, "2026-08-30", 2);
      const k = await h.cover(acc, 900, "2026-10-05", "2026-09-03");
      assert.deepEqual(h.covered(F), {}, "F kartın dışında");
      assert.equal((await h.invoice(F)).payState, "overdue", "kuyruk: F kendi vadesiyle");
      await h.cancel(F);
      assert.deepEqual(await h.card(k), { status: "active", total: 900, paid: 0, left: 900 });
      const t = await h.account(acc);
      assert.equal(t.balance, 1200);
      assert.equal(await h.ok(), true);
    }));
});

describe("İzleyen tur 2 — İş 4 (iade Düzenle'si iptalle aynı yardımcıdan: aynı taksitlere geri büyüme)", () => {
  it("R1: kendi kartı — tahsilat 300, iade 600 (05.11 + 05.12 kesilir), iade Düzenle 2 → 1 → 05.10 300 + 05.12 300; 20.11 gecikmiş 0", () =>
    world("2026-09-01", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3, own3);
      const k = await h.ownPlan(f);
      h.at("2026-09-03");
      await h.pay(k, 300);
      h.at("2026-11-10");
      const r = await h.giveBack(f, A, 2);
      assert.deepEqual(h.rows(k), ["2026-10-05:300"], "iade 600 — 05.11 ve 05.12 kesildi (karar (4))");
      h.at("2026-11-12");
      await h.editReturn(r, 1);
      assert.deepEqual(h.rows(k), ["2026-10-05:300", "2026-12-05:300"], "iade 300 hiç 600 olmamış gibi: yalnız 05.11 kesik");
      assert.deepEqual(h.own(k), { total: 600, paid: 300, left: 300 });
      h.at("2026-11-20");
      const t = await h.account(A);
      assert.equal(t.balance, 300);
      assert.equal(t.overdueDebt, 0, "05.10 ödendi, 05.11 kesik, 05.12 vadesi gelmedi");
      assert.equal(await h.ok(), true);
    }));
  it("R2: kapsayan Mevcut Borç kartı — aynı (bekçi)", () =>
    world("2026-09-02", async h => {
      const A = await h.acc();
      const f = await h.goods(A, "2026-09-01", 3);
      const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
      h.at("2026-09-03");
      await h.pay(k, 300);
      h.at("2026-11-10");
      const r = await h.giveBack(f, A, 2);
      assert.deepEqual(h.rows(k), ["2026-10-05:300"]);
      h.at("2026-11-12");
      await h.editReturn(r, 1);
      assert.deepEqual(h.rows(k), ["2026-10-05:300", "2026-12-05:300"]);
      h.at("2026-11-20");
      const t = await h.account(A);
      assert.equal(t.balance, 300);
      assert.equal(t.overdueDebt, 0);
      assert.equal(await h.ok(), true);
    }));
});
