// 2.5.0 Ç5-B KAPANIŞ DÜZELTME TURU — ORTA-2: "kalemler toplamı = cari bakiyesi" HER girdide (kullanıcının koşulu — iş listesi D, S101 kaydı: "değişmez her durumda tutar,
// tutmazsa hata"; kapanış dar kontrolü ORTA-2). S101'in ön ödeme ölçümü sabit 12 geçişte yakınsamadan bitebiliyordu (geriye tarihli Alacak + kart tahsilatı): kart tahsilatı
// var olmayan taksiti kapatmış kalıyor, kalemler toplamı bakiyeyi 20 TL aşıyor, Gecikmiş Borç bakiyeden büyük çıkıyordu. Düzeltme: ölçüm yakınsayana kadar sürer (sınır
// carinin büyüklüğüne bağlı — iş bütçesi), sınırda da yakınsamazsa son ölçüm GÜVENLİ KAPANIŞLA uygulanır (lib/obligation-queue.mjs runQueue / settleExcess).
// Beklenen = Σ satır (borç − alacak): kuyruktan BAĞIMSIZ, girdiden hesaplanır (ders 5). Saf kuyruk; gerçek program (API) denemesi test/tyk-kapanis-250.test.mjs'te.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as queue from "../server/lib/obligation-queue.mjs";

const { buildObligations } = queue;
// Tanı alanı (yeni): eski kodda yok — değişmez ÖNCE denetlenir ki eski kod beklenen nedenle (Σ kalem ≠ bakiye) kırmızı olsun (ders 38).
const passesOf = r => r.prepaidPasses || { count: NaN, stable: undefined };

const balanceMinor = lines => Math.round(lines.reduce((sum, l) => sum + l.debit - l.credit, 0) * 100);
const sigmaMinor = r => Math.round(r.items.reduce((sum, item) => sum + (item.side === "receivable" ? item.remaining : -item.remaining), 0) * 100);
const assertInvariant = (r, lines, label, today) => {
  const balance = balanceMinor(lines);
  assert.equal(sigmaMinor(r), balance, `${label}: Σ kalem ${sigmaMinor(r) / 100} ≠ bakiye ${balance / 100}`);
  const late = Math.round(r.overdue(today).amount * 100);
  assert.ok(late >= 0 && late <= Math.max(0, balance), `${label}: gecikmiş ${late / 100} bakiyeyi (${balance / 100}) aşıyor`);
  for (const item of r.items) assert.ok(item.remaining > 0 && item.remaining <= item.amount + 0.005, `${label}: kalem ${item.key} kalan ${item.remaining} / tutar ${item.amount}`);
};
// Dar kontrolün en küçük örneği (gerçek programda aynı kayıt sırası): stoktan satış 810 → Mevcut Borç kartı 810 (Kayıt Tarihi eski; 405 + 405) → GERİYE tarihli Alacak 250 →
// GERİYE tarihli kart tahsilatı 490 → fatura 960 → Borç 360 → tahsilat p. p = 450: bakiye 940; ölçüm geçiş başına 20 TL ilerler (24 geçiş). p = 430,01: geçiş başına 1 KURUŞ.
export const orta2 = (p = 450) => {
  const fixed = (id, origin, kind, date, minute, debit, credit, extra = {}) => ({ id, origin, kind, date, at: `2026-12-01T00:${String(minute).padStart(2, "0")}:00.000Z`, debit, credit, ...extra });
  const lines = [
    fixed("S", "stock", "debt", "2026-09-07", 1, 810, 0, { sourceId: "m-S", stockReason: "" }),
    fixed("plan:C", "plan", "plan", "2025-06-01", 2, 0, 0, { planId: "C", covers: true, coverTotal: 810, coverGross: 810 }),
    fixed("Y", "account", "credit", "2026-03-04", 3, 0, 250),
    fixed("plan-entry:E", "plan", "plan-in", "2026-03-17", 5, 0, 490, { planId: "C", itemId: "" }),
    fixed("l-F", "invoice", "debt", "2026-10-22", 7, 960, 0, { sourceId: "F" }),
    fixed("B", "account", "debt", "2026-08-08", 8, 360, 0),
    fixed("P", "account", "in", "2026-08-12", 9, 0, p),
  ];
  const invoices = [{ id: "F", kind: "sale", status: "issued", payable: 960, dueDate: "", planId: "", issuedAt: "2026-12-01T00:07:00.000Z" }];
  const schedules = new Map([["C", [{ id: "C-1", seq: 1, dueDate: "2026-09-07", amount: 405 }, { id: "C-2", seq: 2, dueDate: "2026-08-14", amount: 405 }]]]);
  return { lines, invoices, schedules };
};
const TODAY = "2026-11-17";

describe("Ç5-B kapanış — ORTA-2: ön ödeme ölçümü yakınsayana kadar sürer; yakınsamazsa güvenli kapanış — kalemler toplamı = bakiye", () => {
  it("dar kontrolün örneği (ölçüm geçiş başına 20 TL ilerler; 12 geçiş yetmiyordu): Σ kalem = bakiye 940, Gecikmiş Borç 940 (960 DEĞİL), fatura açığı 940, kart Bitti", () => {
    const { lines, invoices, schedules } = orta2();
    const r = buildObligations({ lines, invoices, schedules, today: TODAY });
    assertInvariant(r, lines, "örnek", TODAY);
    assert.ok(passesOf(r).count > 12 && passesOf(r).stable, `ön koşul: ölçüm 12 geçişten SONRA yakınsıyor (${JSON.stringify(r.prepaidPasses)})`);
    assert.equal(r.overdue(TODAY).amount, 940);
    assert.equal(r.invoiceNet.get("F").remaining, 940, "tek açık kalem: fatura 940");
    assert.deepEqual([...r.installments.get("C").values()].map(row => row.remaining), [0, 0], "kart Bitti");
  });
  it("güvenli kapanış — ölçüm geçiş başına 1 KURUŞ ilerliyor (sınırda yakınsamaz): kart tahsilatının var olmayan taksite yazdığı pay avans olur; Σ kalem = bakiye, gecikmiş ≤ bakiye", () => {
    const { lines, invoices, schedules } = orta2(430.01);
    const r = buildObligations({ lines, invoices, schedules, today: TODAY });
    assert.equal(balanceMinor(lines), 95999);
    assertInvariant(r, lines, "1 kuruş adım", TODAY);
    assert.equal(passesOf(r).stable, false, `ön koşul: ölçüm sınırda (${passesOf(r).count} geçiş) yakınsamadı — güvenli kapanış devrede`);
    assert.equal(passesOf(r).count, 400, "küçük caride sınır 400 geçiş");
    assert.equal(r.invoiceNet.get("F").remaining, 959.99, "tek açık kalem: fatura (bakiye kadar)");
    assert.deepEqual([...r.installments.get("C").values()].map(row => row.remaining), [0, 0]);
    // Kartın taksitleri = taşıdığı borcun PARAYLA karşılanan kısmı: 810 − Alacak'ın kapattığı 250 (para dışı — EK-2B 32, son taksitten kırpılır) = 560; güvenli kapanışın geri
    // aldığı pay da en SON taksitten (vadesi 07.09) düşer: 405 − 250 − 0,01.
    const rows = r.installments.get("C");
    assert.deepEqual([rows.get("C-2").amount, rows.get("C-1").amount], [405, 154.99], "kırpma ve geri alma en son taksitten");
    assert.deepEqual([rows.get("C-2").paid, rows.get("C-1").paid], [405, 154.99], "taksitlerin ödeneni = tutarı (kalan 0)");
  });
  it("güvenli kapanış kilit ölçümlü yolda da (karar (3): kilitli dönemde bağlı ödeme varken son geçiş ayrı kurulur)", () => {
    const base = orta2(430.01);
    const lines = [...base.lines, { id: "l-K", origin: "invoice", kind: "debt", sourceId: "K", date: "2026-01-10", at: "2026-12-01T00:00:30.000Z", debit: 100, credit: 0 }, { id: "PK", origin: "account", kind: "in", date: "2026-02-10", at: "2026-12-01T00:10:00.000Z", debit: 0, credit: 100 }];
    const invoices = [...base.invoices, { id: "K", kind: "sale", status: "issued", payable: 100, dueDate: "2026-01-10", planId: "", issuedAt: "2026-12-01T00:00:30.000Z" }];
    const r = buildObligations({ lines, invoices, schedules: base.schedules, links: new Map([["PK", "K"]]), lockAt: Object.assign(() => "2026-01-31", { active: true }), today: TODAY });
    assertInvariant(r, lines, "kilitli yol", TODAY);
    assert.equal(passesOf(r).stable, false, "ön koşul: yakınsamadı");
    assert.equal(r.invoices.get("K").open, 0, "kilitli dönemdeki fatura bağlı ödemesiyle kapalı");
  });
  it("geçiş sınırı carinin büyüklüğüne bağlı: iş bütçesi (geçiş × satır) sabit — küçük caride 400, çok satırlı caride en az 12", () => {
    assert.deepEqual([0, 7, 50, 51, 200, 1000, 1666, 1667, 5000].map(count => queue.prepaidPassLimit(count)), [400, 400, 400, 392, 100, 20, 12, 12, 12]);
  });
  it("çok satırlı caride (sınır 12) yakınsamayan ölçüm: güvenli kapanış — Σ kalem = bakiye", () => {
    const { lines, invoices, schedules } = orta2();
    const extra = [];
    for (let i = 0; i < 1700; i += 1) extra.push({ id: `Z${i}`, origin: "account", kind: i % 2 ? "in" : "debt", date: "2027-01-05", at: `2026-12-02T00:00:00.${String(i % 1000).padStart(3, "0")}Z`, debit: i % 2 ? 0 : 1, credit: i % 2 ? 1 : 0 });
    const all = [...lines, ...extra];
    const r = buildObligations({ lines: all, invoices, schedules, today: TODAY });
    assertInvariant(r, all, "çok satırlı", TODAY);
    assert.deepEqual([passesOf(r).count, passesOf(r).stable], [12, false], "ön koşul: sınır 12, yakınsamadı (24 geçiş gerekir)");
  });
  it("yakınsayan caride güvenli kapanış ÇALIŞMAZ: S101 karar örneği (1.000 avans → 600 veresiye satış 2 taksit → Taksit Tahsilatı 300 → Borç 500) ⇒ takvim boş, müşteri 200 alacaklı", () => {
    const at = minute => `2026-12-01T00:${String(minute).padStart(2, "0")}:00.000Z`;
    const lines = [
      { id: "A", origin: "account", kind: "in", date: "2026-03-01", at: at(1), debit: 0, credit: 1000 },
      { id: "S", origin: "stock", kind: "debt", sourceId: "m-S", stockReason: "", date: "2026-03-05", at: at(2), debit: 600, credit: 0 },
      { id: "plan:C", origin: "plan", kind: "plan", planId: "C", covers: true, coverTotal: 600, coverGross: 600, coverSale: "m-S", date: "2025-06-01", at: at(3), debit: 0, credit: 0 },
      { id: "plan-entry:E", origin: "plan", kind: "plan-in", planId: "C", itemId: "", date: "2026-03-20", at: at(4), debit: 0, credit: 300 },
      { id: "B", origin: "account", kind: "debt", date: "2026-03-25", at: at(5), debit: 500, credit: 0 },
    ];
    const schedules = new Map([["C", [{ id: "C-1", seq: 1, dueDate: "2026-04-05", amount: 300 }, { id: "C-2", seq: 2, dueDate: "2026-05-05", amount: 300 }]]]);
    const r = buildObligations({ lines, schedules, today: TODAY });
    assert.deepEqual(r.items.filter(item => item.side === "receivable"), [], "takvim / zil boş");
    assert.equal(sigmaMinor(r), -20000, "müşteri 200 alacaklı; kalemler toplamı = bakiye");
    assert.equal(r.overdue(TODAY).amount, 0);
    assert.equal(passesOf(r).stable, true);
    assert.ok(passesOf(r).count <= 3, `geçiş ${passesOf(r).count}`);
    assert.ok(!r.items.some(item => item.key.startsWith("card-settle:")), "güvenli kapanış kalemi yok");
  });
});

// Tohumlu rastgele — GERİYE TARİHLİ üretici: her caride satışla açılan kart (Kayıt Tarihi eski) + satıştan ÖNCE tarihli Alacak ve kart tahsilatı + rastgele borç / tahsilat /
// fatura / Ödeme (tarihler yazım sırasından bağımsız). Dar kontrolün bulduğu sınıf (ölçüm 12 geçişte yakınsamıyor) burada her tohumda defalarca üretilir; kuruşlu tutarlar
// sınırda yakınsamayan (güvenli kapanış) sınıfını da üretir. Sınıfların SAYISI çıktıda; hiç üretilmediyse test kırmızı (dişsiz kalmasın).
describe("Ç5-B kapanış — ORTA-2 değişmez: geriye tarihli üretici, 80 tohum × 250 cari (20.000 cari)", () => {
  const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const dayOf = n => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  const total = { cari: 0, derin: 0, guvenli: 0, enCok: 0 };
  const generate = (r, seed, a) => {
    const lines = [];
    const invoices = [];
    const schedules = new Map();
    let n = 0;
    const at = () => `2026-12-01T${String(Math.floor(n / 60)).padStart(2, "0")}:${String((n += 1) % 60).padStart(2, "0")}:00.000Z`;
    const kurus = r() < 0.3;
    const amount = (min, max) => (kurus ? Math.round((min + r() * (max - min)) * 100) / 100 : 10 * Math.round((min + r() * (max - min)) / 10));
    const push = (id, origin, kind, date, debit, credit, extra = {}) => lines.push({ id: `${id}${seed}-${a}-${lines.length}`, origin, kind, date, at: at(), debit, credit, ...extra });
    const saleDay = 150 + Math.floor(r() * 120);
    const sale = amount(300, 1500);
    push("S", "stock", "debt", dayOf(saleDay), sale, 0, { sourceId: `m-${seed}-${a}`, stockReason: "" });
    const planId = `C${seed}-${a}`;
    lines.push({ id: `plan:${planId}`, origin: "plan", planId, kind: "plan", covers: true, coverTotal: sale, coverGross: sale, coverSale: r() < 0.5 ? `m-${seed}-${a}` : "", date: "2025-06-01", at: at(), debit: 0, credit: 0 });
    const first = Math.round(sale * 50) / 100;
    schedules.set(planId, [{ id: `${planId}-1`, seq: 1, dueDate: dayOf(saleDay + Math.floor(r() * 60) - 30), amount: first }, { id: `${planId}-2`, seq: 2, dueDate: dayOf(saleDay + Math.floor(r() * 90)), amount: Math.round((sale - first) * 100) / 100 }]);
    const extras = 3 + Math.floor(r() * 7);
    for (let i = 0; i < extras; i += 1) {
      const p = r();
      const before = dayOf(Math.floor(r() * saleDay));
      const any = dayOf(Math.floor(r() * 320));
      if (p < 0.22) push("Y", "account", "credit", before, 0, amount(50, 500));
      else if (p < 0.5) lines.push({ id: `plan-entry:E${seed}-${a}-${i}`, origin: "plan", planId, kind: r() < 0.1 ? "plan-out" : "plan-in", itemId: "", date: r() < 0.7 ? before : any, at: at(), debit: 0, credit: 0 });
      else if (p < 0.66) push("B", "account", "debt", any, amount(50, 800), 0);
      else if (p < 0.84) push("P", "account", "in", any, 0, amount(50, 800));
      else if (p < 0.9) push("O", "account", "out", any, amount(20, 300), 0);
      else {
        const id = `F${seed}-${a}-${i}`;
        const value = amount(100, 1200);
        const when = at();
        lines.push({ id: `l-${id}`, origin: "invoice", kind: "debt", sourceId: id, date: any, at: when, debit: value, credit: 0 });
        invoices.push({ id, kind: "sale", status: "issued", payable: value, dueDate: r() < 0.5 ? dayOf(Math.floor(r() * 330)) : "", planId: "", issuedAt: when });
      }
    }
    // Kart tahsilatı / iadesi tutarları: iade o ana kadarki kart tahsilatını aşmaz (program da reddeder).
    let paid = 0;
    for (const line of lines) {
      if (line.kind === "plan-in") {
        line.credit = amount(40, Math.max(60, sale * 0.9));
        paid = Math.round((paid + line.credit) * 100) / 100;
      } else if (line.kind === "plan-out") {
        line.debit = Math.min(paid, amount(10, 200));
        paid = Math.round((paid - line.debit) * 100) / 100;
      }
    }
    return { lines: lines.filter(line => line.debit > 0 || line.credit > 0 || line.kind === "plan"), invoices, schedules };
  };
  for (let block = 0; block < 8; block += 1) {
    it(`tohum ${5000 + block * 10}–${5009 + block * 10}: 10 × 250 cari — Σ kalem = bakiye, 0 ≤ gecikmiş ≤ bakiye, kalem kalanı ≤ tutarı`, () => {
      for (let seed = 5000 + block * 10; seed < 5010 + block * 10; seed += 1) {
        const r = rng(seed);
        for (let a = 0; a < 250; a += 1) {
          const { lines, invoices, schedules } = generate(r, seed, a);
          const res = buildObligations({ lines, invoices, schedules, today: dayOf(320) });
          assertInvariant(res, lines, `tohum ${seed} cari ${a}`, dayOf(320));
          total.cari += 1;
          if (passesOf(res).count > 12) total.derin += 1;
          if (passesOf(res).stable === false) total.guvenli += 1;
          if (passesOf(res).count > total.enCok) total.enCok = passesOf(res).count;
        }
      }
    });
  }
  it("üretici sınıfı gördü: 12 geçişten sonra yakınsayan ve sınırda yakınsamayan (güvenli kapanış) cariler üretildi", () => {
    console.log(`# ORTA-2 değişmezi: ${JSON.stringify(total)} (derin = 12 geçişi aşan; guvenli = güvenli kapanış uygulanan)`);
    assert.equal(total.cari, 20000);
    assert.ok(total.derin >= 100, `12 geçişi aşan cari sayısı ${total.derin}`);
    assert.ok(total.guvenli >= 1, `güvenli kapanış uygulanan cari sayısı ${total.guvenli}`);
  });
});
