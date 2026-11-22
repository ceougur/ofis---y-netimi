// 2.5.0 İzleyen tur 4 (görev metni docs/devir/2.5.0-DEVAM/izt4-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §22).
// KARAR (görev metninden AYNEN): S255 = A — "bağlı tahsilat önce faturanın GÖSTERİLEN açığını (kartın almadığı kısım — örnekte 300) kapatır; fazlası S230 = A'nın sözüyle 'carinin vadesi en önce
//   gelen açık borcuna' (tek kuyruk — örnekte kartın 05.10 taksitinden başlayarak) gider: 600 → fatura kapanır, kart Tahsil 300 · Kalan 300 (05.10 ödenmiş, 05.11'den 100), bakiye 300, gecikmiş 0;
//   900 → kart Kalan 0, bakiye 0; 1.200 → kart Kalan 0, avans 300. Girilebilecek tutarın sınırı değişmez (S230)." Bağsız 900'de kart doğru (Tahsil 600 · Kalan 0) — değişmez.
// Beklenenler kararın sözünden ELLE (kod koşulmadan): F 900 (01.09; 3 × 250 + %20), elle Mevcut Borç kartı 600 (02.09; 3 × 200, 05.10 / 05.11 / 05.12) F'nin 600'ünü alır; 20.10'da F'ye bağlı tahsilat.
//  B1 bağlı 300 / 600 / 900 / 1.200 + bağsız 900: kart penceresi = cari kartı özeti = Taksitler listesi (Tahsil Edilen / Kalan), satırların kalanı, bakiye, gecikmiş (yeni ve eski anlam), fatura durumu,
//     kapama defterinin kart payı (kart F'nin 600'ünü almış kalır — bağsız 900'deki gibi), Mutabakat Testi.
//  B2 faturanın tamamı kartta (F 600, kart 600 — gösterilen açık 0): bağlı 600 → tamamı kuyruğa: kart 600 / 600 / 0, fatura Ödendi, bakiye 0.
//  B3 iki kart aynı faturada (F 900; K1 300 05.10'dan 3 × 100, K2 300 05.11'den 3 × 100): bağlı 600 → 300 gösterilen açık + 300 kuyrukta vadesi en önce gelen taksitlerden: K1 05.10 100, 05.11'de
//     K1 ve K2 (aynı vade → kartın günü: K1 önce) → K1 200 ödenmiş / 100 kalan, K2 100 ödenmiş / 200 kalan; bakiye 300; gecikmiş 0.
//  B4 sıra: (a) iade 300 (S239: kart dışındaki 300 kapanır, kart 600 kalır) → bağlı 600: gösterilen açık 0 → tamamı kuyruğa: kart 600 / 600 / 0, bakiye 0. (b) bağlı 600 → iade 300: kart küçülür
//     (karar (4)) 300'e, kalanı 0; bakiye 0. (c) (b)'nin iadesi iptal: kart aynı taksitlere geri büyür (S238), B1 600 ile aynı: Tahsil 300 · Kalan 300, bakiye 300. (d) Düzenle 900 → 600 (S241: iadeyle
//     aynı — kart dışındaki 300 düşer) → bağlı 600 → kart 600 / 600 / 0, bakiye 0.
//  B5 bağlı 600'ün silinmesi → kart 0 / 600 (bağsız ödeme yok), bakiye 900; Silinenler'den geri yükleme → yeniden B1 600.
//  B6 kilitli dönem (30.09'a kadar): hedef fatura kilitli dönemde, bağlı ödeme kilitten sonra → karar (3) (bağsız kapanmış kısım yok) → B1 600 ile aynı; Mutabakat Testi temiz.
//  B7 Vade Takip / zil (takvim) / Alacak Yaşlandırma / Nakit Akışı: B1 600'de carinin açık kalemleri = kartın kalan taksitleri (05.11 100, 05.12 200) — fatura satırı yok, gecikmiş yok; toplam 300 = bakiye.
//  B8 çek / senet 'Kapatılacak Fatura' ile (alınan evrak 600, F'ye bağlı) → B1 600 ile aynı kart / bakiye.
//  B9 bağlı ödeme karttan ÖNCE yazılmış (F 900 → bağlı 600 → kart 300 açık kalanı alır): DEĞİŞMEZ — kart 0 / 300, bakiye 300 (bekçi).
//  B10 yedek → geri yükleme: B1 600'ün sayıları geri yüklemeden sonra aynı.
// NASIL BOZARIM (mutantlar, raporda): kuyrukta sıra 3'ün tutulan kısmı kaldırılır → B1 600 / 900 / 1.200, B2, B3, B4 (a)(c)(d), B5 geri yükleme, B6, B7, B8, B10 kırmızı; defterde bağlı ödeme kapsanan
//   kısmı da kapatırsa → B1'in kart payı (coveredBy) kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const W = "/api/workspace";

async function world(start, fn) {
  const ctx = await bootBank({ now: { time: `${start}T12:00:00+03:00`, fixed: true } });
  try {
    return await fn(helpers(ctx.api, ctx.store, iso => ctx.server.clock.set(iso), () => ctx.app.context.invoices, start));
  } finally {
    ctx.server.close();
  }
}

function helpers(api, store, setClock, invoicesOf, start) {
  let minute = 0;
  let day = start;
  const at = d => {
    day = d;
    minute = 0;
    setClock(`${d}T12:00:00+03:00`);
  };
  const tick = () => setClock(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api,
    store,
    at,
    acc: async (name = "İzt4 Müşteri") => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" } }))).id),
    cover: async (accountId, total, firstDue, registeredOn, count = 3) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `İzt4 ${day} ${minute}`, total: String(total), registeredOn, mode: "auto", count, firstDue, coversBalance: true }))).id),
    // Faturaya BAĞLI tahsilat: faturanın Tahsilat Ekle'si ve cari kartının 'Kapatılacak Fatura'sı aynı uç (invoiceId).
    linked: async (accountId, invoiceId, amount, date = day) => (tick(), (await must("bağlı tahsilat", api.post(`${W}/accounts/${accountId}/entries`, { kind: "in", amount: String(amount), date, method: "cash", invoiceId, note: "fatura tahsilatı" }))).entryId),
    free: async (accountId, amount, date = day) => (tick(), (await must("bağsız tahsilat", api.post(`${W}/accounts/${accountId}/entries`, { kind: "in", amount: String(amount), date, method: "cash", note: "bağsız" }))).entryId),
    giveBack: async (invoiceId, accountId, qty) => {
      tick();
      const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
      return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: day, lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }))).id;
    },
    cancel: id => (tick(), must("iptal", api.post(`${W}/invoices/${id}/cancel`, { reason: "x" }))),
    edit: async (id, qty) => {
      tick();
      const d = await must("fatura", api.get(`${W}/invoices/${id}`));
      return api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" }, force: true });
    },
    // Kart: pencere (GET), cari kartı özeti, Taksitler listesi; satırların kalanı (pencere).
    views: async (accountId, planId) => {
      const v = await must("kart", api.get(`${W}/plans/${planId}`));
      const s = (await must("cari", api.get(`${W}/accounts/${accountId}`))).plans.find(x => x.id === planId);
      const l = (await must("Taksitler", api.get(`${W}/plans?status=all`))).plans.find(x => x.id === planId);
      return {
        window: { total: v.total, paid: v.totals.paid, left: v.totals.remaining },
        summary: { paid: s.totals.paid, left: s.totals.remaining },
        list: { paid: l.totals.paid, left: l.totals.remaining },
        items: v.items.map(i => `${i.dueDate.slice(5)}:${i.remaining}`),
      };
    },
    totals: async accountId => (await must("cari", api.get(`${W}/accounts/${accountId}`))).totals,
    doc: id => must("fatura kartı", api.get(`${W}/invoices/${id}`)),
    own: planId => {
      const total = Number(store.get("SELECT total FROM plans WHERE id = ?", planId).total);
      const paid = Number(store.get("SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) AS n FROM plan_entries WHERE plan_id = ?", planId).n);
      return { total, paid };
    },
    // Kapama defteri (lib/invoice-settle.mjs — iade / İptal Et / Düzenle / iptal penceresinin okuduğu): faturanın kart payı ve 'fazla'sı.
    ledger: id => {
      const row = store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", id);
      return invoicesOf().cardLedgerState(row);
    },
    covered: id => h.ledger(id).coveredBy || {},
    ok: async () => (await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`))).ok,
  };
  return h;
}

// Kurulum: F 900 (01.09), elle Mevcut Borç kartı 600 (02.09), 20.10.
async function base(h, name) {
  const A = await h.acc(name);
  const f = await h.goods(A, "2026-09-01", 3);
  h.at("2026-09-02");
  const k = await h.cover(A, 600, "2026-10-05", "2026-09-02");
  h.at("2026-10-20");
  return { A, f, k };
}
const same = (views, want, label) => {
  assert.deepEqual(views.window, want.window, `${label}: kart penceresi`);
  assert.deepEqual(views.summary, { paid: want.window.paid, left: want.window.left }, `${label}: cari kartı özeti = pencere`);
  assert.deepEqual(views.list, { paid: want.window.paid, left: want.window.left }, `${label}: Taksitler listesi = pencere`);
  if (want.items) assert.deepEqual(views.items, want.items, `${label}: taksit satırlarının kalanı`);
};

describe("İzleyen tur 4 — S255 = A: kartın içine aldığı faturaya BAĞLI tahsilat önce gösterilen açığı kapatır, fazlası tek kuyrukta", () => {
  const CASES = [
    { amount: 300, linked: true, window: { total: 600, paid: 0, left: 600 }, items: ["10-05:200", "11-05:200", "12-05:200"], balance: 600, overdue: 200, state: "installment", open: 0 },
    { amount: 600, linked: true, window: { total: 600, paid: 300, left: 300 }, items: ["10-05:0", "11-05:100", "12-05:200"], balance: 300, overdue: 0, state: "installment", open: 0 },
    { amount: 900, linked: true, window: { total: 600, paid: 600, left: 0 }, items: ["10-05:0", "11-05:0", "12-05:0"], balance: 0, overdue: 0, state: "paid", open: 0 },
    { amount: 1200, linked: true, window: { total: 600, paid: 600, left: 0 }, items: ["10-05:0", "11-05:0", "12-05:0"], balance: -300, overdue: 0, state: "paid", open: 0, excess: 300 },
    { amount: 900, linked: false, window: { total: 600, paid: 600, left: 0 }, items: ["10-05:0", "11-05:0", "12-05:0"], balance: 0, overdue: 0, state: "paid", open: 0 },
  ];
  for (const c of CASES) {
    it(`B1 — ${c.linked ? "F'ye bağlı" : "bağsız"} ${c.amount}: kart ${c.window.paid} / ${c.window.left}, bakiye ${c.balance}, gecikmiş ${c.overdue}`, () =>
      world("2026-09-01", async h => {
        const { A, f, k } = await base(h, `B1 ${c.amount} ${c.linked}`);
        if (c.linked) await h.linked(A, f, c.amount);
        else await h.free(A, c.amount);
        same(await h.views(A, k), c, `${c.amount}`);
        const t = await h.totals(A);
        assert.equal(t.balance, c.balance, "bakiye");
        assert.equal(t.overdueDebt, c.overdue, "Gecikmiş Borç (kuyruk)");
        // Eski anlamdaki taksit gecikmişi (overdueInstallments — Ödeme Hatırlatma okur) kartın KENDİ hesabından (kart tahsilatı yok → 05.10'un 200'ü): bu kural DEĞİŞTİRMEZ — bağsız
        // ödemede de 200 (Ç5-C — 2.5.1, kullanıcı 22.11 06:32: "Ödeme Hatırlatma eski gecikmiş anlamında kalır"; BİLİNEN SINIR). Bekçi: bağlı ödeme bağsızla AYNI sayıyı verir.
        assert.equal(t.overdueInstallments, 200, "eski anlamdaki taksit gecikmişi (Ç5-C BİLİNEN SINIRI — bağlı = bağsız)");
        assert.equal(t.planRemaining, c.window.left, "cari özeti planRemaining = kartın kalanı");
        const doc = await h.doc(f);
        assert.deepEqual([doc.payState, doc.open], [c.state, c.open], "fatura kartı durumu / gösterilen açık");
        assert.equal(h.ledger(f).excess, c.excess || 0, "kapama defteri: faturanın KENDİ açığını aşan kısım 'fazla' (kartın aldığı kısım yüzünden kapatılamayan pay fazla DEĞİL)");
        assert.deepEqual(h.own(k), { total: 600, paid: 0 }, "kartın kendi hesabı değişmez (kart tahsilatı yok)");
        assert.deepEqual(h.covered(f), { [k]: 600 }, "kapama defteri: kart faturanın 600'ünü almış kalır (bağsız ödemedeki gibi)");
        assert.equal(await h.ok(), true, "Mutabakat Testi");
      }));
  }
  it("B2 — faturanın tamamı kartta (F 600, kart 600): bağlı 600 → tamamı kuyruğa: kart 600 / 600 / 0, fatura Ödendi, bakiye 0", () =>
    world("2026-09-01", async h => {
      const A = await h.acc("B2");
      const f = await h.goods(A, "2026-09-01", 2);
      h.at("2026-09-02");
      const k = await h.cover(A, 600, "2026-10-05", "2026-09-02");
      h.at("2026-10-20");
      assert.equal((await h.doc(f)).open, 0, "gösterilen açık 0 (Taksitte)");
      await h.linked(A, f, 600);
      same(await h.views(A, k), { window: { total: 600, paid: 600, left: 0 }, items: ["10-05:0", "11-05:0", "12-05:0"] }, "B2");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [0, 0]);
      assert.equal((await h.doc(f)).payState, "paid");
      assert.equal(await h.ok(), true);
    }));
  it("B3 — iki kart aynı faturada (K1 300, K2 300): bağlı 600 → 300 gösterilen açık + 300 vadesi en önce gelen taksitlerden", () =>
    world("2026-09-01", async h => {
      const A = await h.acc("B3");
      const f = await h.goods(A, "2026-09-01", 3);
      h.at("2026-09-02");
      const k1 = await h.cover(A, 300, "2026-10-05", "2026-09-02");
      h.at("2026-09-03");
      const k2 = await h.cover(A, 300, "2026-11-05", "2026-09-03");
      h.at("2026-10-20");
      assert.equal((await h.doc(f)).open, 300, "gösterilen açık 300");
      await h.linked(A, f, 600);
      same(await h.views(A, k1), { window: { total: 300, paid: 200, left: 100 }, items: ["10-05:0", "11-05:0", "12-05:100"] }, "K1");
      same(await h.views(A, k2), { window: { total: 300, paid: 100, left: 200 }, items: ["11-05:0", "12-05:100", "01-05:100"] }, "K2");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [300, 0]);
      assert.equal(await h.ok(), true);
    }));
});

describe("İzleyen tur 4 — S255 = A: iade / iade iptali / Düzenle / silme / Silinenler / kilit / raporlar / çek / önceden yazılmış bağ", () => {
  it("B4a — iade 300 (kart dışındaki kısım) → bağlı 600: gösterilen açık 0 → tamamı kuyruğa: kart 600 / 600 / 0, bakiye 0", () =>
    world("2026-09-01", async h => {
      const { A, f, k } = await base(h, "B4a");
      await h.giveBack(f, A, 1);
      same(await h.views(A, k), { window: { total: 600, paid: 0, left: 600 } }, "iade sonrası (S239: kart değişmez)");
      h.at("2026-10-21");
      await h.linked(A, f, 600);
      same(await h.views(A, k), { window: { total: 600, paid: 600, left: 0 } }, "B4a");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [0, 0]);
      assert.equal(await h.ok(), true);
    }));
  // B4b'nin beklenen kartı: aynı kurulumda BAĞSIZ 600 → iade 300'ün sonucu (karar: "fazlası … bağsız ödeme gibi tek kuyrukta"; bağsız 600 de önce faturanın 01.09 vadeli kart dışı 300'ünü,
  // sonra kartın 05.10'unu kapatır — S255 A'nın 600 satırıyla aynı ara durum). Bağsız yolun iadedeki davranışı bu turda değişmez (kart iadede carinin kalan borcuna kırpılır — rapor).
  it("B4b / B4c — bağlı 600 → iade 300: kart ve bakiye BAĞSIZ 600 → iade 300 ile AYNI; iade iptali → aynı taksitlere geri: Tahsil 300 · Kalan 300, bakiye 300", async () => {
    const twin = await world("2026-09-01", async h => {
      const { A, f, k } = await base(h, "B4b bağsız");
      await h.free(A, 600);
      h.at("2026-10-21");
      await h.giveBack(f, A, 1);
      const t = await h.totals(A);
      return { views: await h.views(A, k), balance: t.balance, overdueDebt: t.overdueDebt };
    });
    await world("2026-09-01", async h => {
      const { A, f, k } = await base(h, "B4b");
      await h.linked(A, f, 600);
      h.at("2026-10-21");
      const r = await h.giveBack(f, A, 1);
      const shrunk = await h.views(A, k);
      assert.deepEqual(shrunk, twin.views, "kart (pencere / özet / liste / satırlar) bağsız ikiziyle AYNI");
      let t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [twin.balance, twin.overdueDebt]);
      assert.deepEqual([t.balance, t.overdueDebt], [0, 0]);
      assert.equal(await h.ok(), true);
      h.at("2026-10-22");
      await h.cancel(r);
      same(await h.views(A, k), { window: { total: 600, paid: 300, left: 300 }, items: ["10-05:0", "11-05:100", "12-05:200"] }, "B4c iade iptali");
      t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [300, 0]);
      assert.equal(await h.ok(), true);
    });
  });
  it("B4d — Düzenle 900 → 600 (kart dışındaki 300 düşer) → bağlı 600: kart 600 / 600 / 0, bakiye 0", () =>
    world("2026-09-01", async h => {
      const { A, f, k } = await base(h, "B4d");
      assert.equal((await h.edit(f, 2)).status, 200, "Düzenle");
      same(await h.views(A, k), { window: { total: 600, paid: 0, left: 600 } }, "Düzenle sonrası");
      h.at("2026-10-21");
      await h.linked(A, f, 600);
      same(await h.views(A, k), { window: { total: 600, paid: 600, left: 0 } }, "B4d");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [0, 0]);
      assert.equal(await h.ok(), true);
    }));
  it("B5 — bağlı 600'ün silinmesi → kart 0 / 600, bakiye 900; Silinenler'den geri yükleme → Tahsil 300 · Kalan 300, bakiye 300", () =>
    world("2026-09-01", async h => {
      const { A, f, k } = await base(h, "B5");
      const e = await h.linked(A, f, 600);
      h.at("2026-10-21");
      assert.equal((await h.api.del(`${W}/accounts/${A}/entries/${e}`)).status, 200, "tahsilatı sil");
      same(await h.views(A, k), { window: { total: 600, paid: 0, left: 600 } }, "silindi");
      assert.equal((await h.totals(A)).balance, 900);
      const row = (await must("Silinenler", h.api.get("/api/admin/trash"))).find(x => x.ref === e);
      assert.ok(row, "Silinenler'de");
      assert.equal((await h.api.post("/api/admin/trash/restore", { id: row.id })).status, 200, "geri yükle");
      same(await h.views(A, k), { window: { total: 600, paid: 300, left: 300 }, items: ["10-05:0", "11-05:100", "12-05:200"] }, "geri yüklendi");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [300, 0]);
      assert.equal(await h.ok(), true);
    }));
  it("B6 — kilitli dönem (30.09'a kadar; fatura kilitli dönemde, bağlı ödeme sonra): B1 600 ile aynı; Mutabakat Testi temiz", () =>
    world("2026-09-01", async h => {
      const { A, f, k } = await base(h, "B6");
      await must("kilit", h.api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
      await h.linked(A, f, 600);
      same(await h.views(A, k), { window: { total: 600, paid: 300, left: 300 }, items: ["10-05:0", "11-05:100", "12-05:200"] }, "B6");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [300, 0]);
      assert.equal(await h.ok(), true);
    }));
  it("B7 — Vade Takip / zil / Alacak Yaşlandırma / Nakit Akışı: carinin açık kalemleri kartın kalan taksitleri (100 + 200), fatura satırı yok, gecikmiş yok", () =>
    world("2026-09-01", async h => {
      const name = "B7 Rapor Carisi";
      const { A, f } = await base(h, name);
      await h.linked(A, f, 600);
      const vade = await must("Vade Takip", h.api.get(`${W}/overview/vade-takip?from=2026-01-01&to=2027-06-30`));
      const rows = vade.rows.filter(row => row.accountId === A);
      assert.deepEqual(rows.map(row => [row.source, row.date, row.amount]).sort(), [["plan", "2026-11-05", 100], ["plan", "2026-12-05", 200]], "Vade Takip: kartın kalan taksitleri");
      const dues = await must("takvim", h.api.get(`${W}/dues`));
      assert.deepEqual(dues.items.filter(row => row.accountId === A || row.person === name).map(row => [row.source, row.amount, row.state]), [], "zil: gecikmiş / yakın kalem yok (05.11 ufuk dışında)");
      const aging = await must("Alacak Yaşlandırma", h.api.get(`${W}/report-center/alacak-yaslandirma`));
      const at = aging.headers.indexOf("Toplam");
      const line = aging.rows.find(row => row[0] === name);
      assert.ok(line, "yaşlandırmada cari");
      assert.match(String(line[at]), /^300,00/, "yaşlandırma toplamı 300 (aynı borç bir kez)");
      const flow = await must("Nakit Akışı", h.api.get(`${W}/overview/nakit-akisi?from=2026-10-20&to=2027-06-30`));
      const mine = flow.rows.filter(row => row.accountId === A);
      assert.deepEqual(mine.map(row => [row.source, row.direction, row.date, row.amount]), [["plan", "in", "2026-11-05", 100], ["plan", "in", "2026-12-05", 200]], "nakit akışı: kartın kalan taksitleri (300)");
      assert.equal((flow.overdue || []).filter(row => row.accountId === A).length, 0, "nakit akışında gecikmiş kalem yok");
      assert.equal((await h.totals(A)).overdueDebt, 0);
    }));
  it("B8 — çek 'Kapatılacak Fatura' ile (alınan evrak 600, F'ye bağlı): B1 600 ile aynı", () =>
    world("2026-09-01", async h => {
      const { A, f, k } = await base(h, "B8");
      await must("evrak", h.api.post(`${W}/cheques`, { instrument: "cheque", direction: "in", accountId: A, amount: "600", issueDate: "2026-10-20", dueDate: "2026-12-20", serialNo: "IZT4-B8", bank: "Ziraat", invoiceId: f }));
      same(await h.views(A, k), { window: { total: 600, paid: 300, left: 300 }, items: ["10-05:0", "11-05:100", "12-05:200"] }, "B8");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [300, 0]);
      assert.equal(await h.ok(), true);
    }));
  it("B9 — bağlı ödeme karttan ÖNCE (F 900 → bağlı 600 → kart 300 açık kalanı alır): DEĞİŞMEZ (bekçi) — kart 0 / 300, bakiye 300", () =>
    world("2026-09-01", async h => {
      const A = await h.acc("B9");
      const f = await h.goods(A, "2026-09-01", 3);
      h.at("2026-09-02");
      await h.linked(A, f, 600);
      h.at("2026-09-03");
      const k = await h.cover(A, 300, "2026-10-05", "2026-09-03");
      h.at("2026-10-20");
      same(await h.views(A, k), { window: { total: 300, paid: 0, left: 300 } }, "B9");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [300, 100]);
      assert.deepEqual(h.covered(f), { [k]: 300 });
      assert.equal(await h.ok(), true);
    }));
});

describe("İzleyen tur 4 — S255 = A: yedek → geri yükleme", () => {
  it("B10 — B1 600'ün sayıları yedek → (bozucu silme) → geri yüklemeden sonra aynı", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "izt4-yedek-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let server = null;
    try {
      server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-09-01T12:00:00+03:00", fixed: true } });
      let api = await server.login();
      let h = helpers(api, server.app.store, iso => server.app.config.now.set(iso), () => server.app.context.invoices, "2026-09-01");
      const { A, f, k } = await base(h, "B10");
      const e = await h.linked(A, f, 600);
      const backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      assert.equal((await api.del(`${W}/accounts/${A}/entries/${e}`)).status, 200, "yedekten sonra bozucu silme");
      await must("geri yükle", api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
      await server.close();
      server = null;
      server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-10-20T12:30:00+03:00", fixed: true } });
      api = await server.login();
      assert.equal(server.app.stagedRestore?.ok, true, JSON.stringify(server.app.stagedRestore));
      h = helpers(api, server.app.store, iso => server.app.config.now.set(iso), () => server.app.context.invoices, "2026-10-20");
      same(await h.views(A, k), { window: { total: 600, paid: 300, left: 300 }, items: ["10-05:0", "11-05:100", "12-05:200"] }, "geri yüklendi");
      const t = await h.totals(A);
      assert.deepEqual([t.balance, t.overdueDebt], [300, 0]);
      assert.equal(await h.ok(), true);
    } finally {
      await server?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
