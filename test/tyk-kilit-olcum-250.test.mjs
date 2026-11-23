// 2.5.0 SON ADAY — Uzun Doğrulama #2092 kırmızısı (mutabakat 5.000 işlem; tohum 2, 3, 7 aday kodunun verisinden yeniden üretildi): "kalemler toplamı = cari bakiyesi" (kullanıcının Ç5-B koşulu, "HER durumda
// tutar") DÖNEM KİLİDİ İZİ olan caride bozuluyordu. Karar (3)'ün sınırlı geçişi (lib/obligation-queue.mjs runQueue) bağın kilitli dönemde bağsız kapanmış hedefine yazılan kısmını
// BAĞSIZ para yapar; bu para bir Mevcut Borç kartının taşıdığı borcu kart açılmadan kapatabilir. S101'in ön ödeme ölçümü yalnız SINIRSIZ geçişlerde yapılıyordu: sınırlı son geçişte
// kart hiçbir şey tüketmiyor, taksiti kendi tahsilatıyla kapanmış kalıyor, kalemler bakiyeyi kart tutarı kadar aşıyordu (tohum 3: 207,05; tohum 2: 250,97). Düzeltme: ölçüm
// sınırlı geçişlerle de yakınsayana dek yinelenir (aynı S101 kuralı). Beklenen = Σ satır (borç − alacak): kuyruktan BAĞIMSIZ, girdiden hesaplanır (ders 5).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildObligations, lockAtOf } from "../server/lib/obligation-queue.mjs";

const balanceMinor = lines => Math.round(lines.reduce((sum, l) => sum + l.debit - l.credit, 0) * 100);
const sigmaMinor = r => Math.round(r.items.reduce((sum, item) => sum + (item.side === "receivable" ? item.remaining : -item.remaining), 0) * 100);

// Mutabakat tohum 3'ün en küçük örneği — gerçek programın (API) yazdığı 94 satırlık carinin kuyruk girdisinden satır grubu atılarak küçültüldü (kimlikler kısaltıldı, tutar / gün /
// kayıt anı AYNEN): 16.08 taksitli satış F1 5.944,84 (kendi kartı C1, 6 taksit) · 24.08 Alacak 32.083,69 (C1'in taksitlerini kapatır) · 06:05 dönem kilidi 30.08 · 02.09 satış F2
// 250.811,27 · 21.09 stoktan satış 393,67 → C1'e Taksit Tahsilatı 4.817,64 (taksitleri kilitli dönemde kapanmış → bağın o kısmı bağsız) → Mevcut Borç kartı C2 207,05 · 25.09 C2'ye
// Taksit Tahsilatı 8.528,77 (fazlası avans) · 06:11 kilit kaldırıldı. Bakiye 211.719,68.
export const tohum3 = ({ lock = true } = {}) => {
  const at = m => `2026-11-23T06:${m}.000Z`;
  const lines = [
    { id: "F1", origin: "invoice", kind: "debt", date: "2026-08-16", at: at("01:51.144"), sourceId: "F1", debit: 5944.84, credit: 0 },
    { id: "plan:C1", origin: "plan", kind: "plan", planId: "C1", covers: true, coverTotal: 5944.84, coverGross: 5944.84, date: "2026-08-16", at: at("01:51.144"), debit: 0, credit: 0 },
    { id: "A", origin: "account", kind: "credit", date: "2026-08-24", at: at("02:58.402"), debit: 0, credit: 32083.69 },
    { id: "F2", origin: "invoice", kind: "debt", date: "2026-09-02", at: at("04:41.730"), sourceId: "F2", debit: 250811.27, credit: 0 },
    { id: "S", origin: "stock", kind: "debt", date: "2026-09-21", at: at("09:53.822"), sourceId: "m-S", stockReason: "", debit: 393.67, credit: 0 },
    { id: "plan-entry:P1", origin: "plan", kind: "plan-in", planId: "C1", itemId: "", date: "2026-09-21", at: at("10:03.942"), debit: 0, credit: 4817.64 },
    { id: "plan:C2", origin: "plan", kind: "plan", planId: "C2", covers: true, coverTotal: 207.05, coverGross: 207.05, date: "2026-09-21", at: at("10:05.981"), debit: 0, credit: 0 },
    { id: "plan-entry:P2", origin: "plan", kind: "plan-in", planId: "C2", itemId: "", date: "2026-09-25", at: at("11:09.574"), debit: 0, credit: 8528.77 },
  ];
  const own = ["2026-09-02", "2026-10-02", "2026-11-02", "2026-12-02", "2027-01-02", "2027-02-02"].map((dueDate, i) => ({ id: `C1-${i + 1}`, seq: i + 1, dueDate, amount: i === 5 ? 990.84 : 990.8 }));
  const invoices = [
    { id: "F1", kind: "sale", status: "issued", payable: 5944.84, dueDate: "2027-02-02", planId: "C1", issuedAt: at("01:51.143"), planTotal: 5944.84, schedule: own.map(row => ({ dueDate: row.dueDate, amount: row.amount })) },
    { id: "F2", kind: "sale", status: "issued", payable: 250811.27, dueDate: "2026-09-29", planId: "", issuedAt: at("04:41.729") },
  ];
  const schedules = new Map([["C1", own], ["C2", [{ id: "C2-1", seq: 1, dueDate: "2026-10-12", amount: 207.05 }]]]);
  const extra = lock ? { lockAt: lockAtOf([{ at: at("05:32.969"), value: "2026-08-30" }, { at: at("11:50.490"), value: "" }]) } : {};
  return { lines, invoices, schedules, today: "2026-11-23", ...extra };
};

describe("2.5.0 UD — dönem kilidi izi olan caride Mevcut Borç kartı: kalemler toplamı = bakiye", () => {
  it("tohum 3'ün en küçük örneği: Σ kalem = bakiye 211.719,68; F2'nin açığı bakiye kadar; C2'nin taksiti Ödendi (taşıdığı borç bağsız parayla kapanmıştı — S101)", () => {
    const input = tohum3();
    const r = buildObligations(input);
    assert.equal(balanceMinor(input.lines), 21171968);
    // Değişmez ÖNCE (eski kod beklenen nedenle kırmızı: Σ kalem 211.926,73 — kart tutarı 207,05 fazla).
    assert.equal(sigmaMinor(r), balanceMinor(input.lines), `Σ kalem ${sigmaMinor(r) / 100} ≠ bakiye ${balanceMinor(input.lines) / 100}`);
    assert.deepEqual(r.items.map(item => [item.key, item.remaining]), [["inv:F2", 211719.68]]);
    assert.equal(r.invoiceNet.get("F2").remaining, 211719.68);
    const c2 = [...r.installments.get("C2").values()];
    assert.deepEqual(c2.map(row => [row.amount, row.remaining, row.paid]), [[207.05, 0, 207.05]], "C2: taksit 207,05, kalan 0");
    assert.ok([...r.installments.get("C1").values()].every(row => row.remaining === 0), "C1 Bitti");
    assert.equal(r.prepaidPasses.stable, true);
  });
  it("aynı satırlar kilit izi OLMADAN: sonuç kilitliyle aynı (Σ kalem = bakiye, F2 211.719,68, C2 Ödendi)", () => {
    const input = tohum3({ lock: false });
    const r = buildObligations(input);
    assert.equal(sigmaMinor(r), balanceMinor(input.lines));
    assert.deepEqual(r.items.map(item => [item.key, item.remaining]), [["inv:F2", 211719.68]]);
    assert.deepEqual([...r.installments.get("C2").values()].map(row => [row.amount, row.remaining]), [[207.05, 0]]);
  });
});

// Tohumlu rastgele — mutabakat motorunun düzeni (çizelge geçmişten bugüne, dönem kilidi koşu ortasında konup kaldırılır; kilitliyken kilit gününe ya da öncesine yazım yok): taksitli
// satış, Mevcut Borç kartı, kart tahsilatı (kalanı aşan — avans), Alacak, Borç, tahsilat, stoktan satış. Sınıfı (kilit sınırlı geçişin ölçümü değiştirdiği cari) SAYILIR; hiç
// üretilmediyse test kırmızı (dişsiz kalmasın).
describe("2.5.0 UD — değişmez: kilit izli rastgele üretici, 40 tohum × 250 cari (10.000 cari)", () => {
  const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const dayOf = n => new Date(Date.UTC(2026, 6, 1 + n)).toISOString().slice(0, 10);
  const total = { cari: 0, kilitli: 0, olcum: 0 };
  const generate = (r, seed, a) => {
    const lines = [];
    const invoices = [];
    const schedules = new Map();
    let n = 0;
    const at = () => `2026-11-23T${String(6 + Math.floor(n / 3600)).padStart(2, "0")}:${String(Math.floor((n % 3600) / 60)).padStart(2, "0")}:${String((n += 1) % 60).padStart(2, "0")}.000Z`;
    const amount = (min, max) => Math.round((min + r() * (max - min)) * 100) / 100;
    const history = [];
    let lock = "";
    let day = 0;
    let balance = 0;
    const cards = [];
    const id = () => `${seed}-${a}-${lines.length}`;
    const write = (line) => {
      if (lock && line.date <= lock) return false; // program kilitli döneme yazmaz
      lines.push(line);
      balance += line.debit - line.credit;
      return true;
    };
    const invoice = own => {
      const value = amount(200, 6000);
      const key = id();
      const when = at();
      const date = dayOf(day);
      if (lock && date <= lock) return;
      const planId = own ? `O${key}` : "";
      write({ id: `l-${key}`, origin: "invoice", kind: "debt", sourceId: `F${key}`, date, at: when, debit: value, credit: 0 });
      if (own) {
        const count = 1 + Math.floor(r() * 6);
        const part = Math.round((value / count) * 100) / 100;
        schedules.set(planId, Array.from({ length: count }, (_, k) => ({ id: `${planId}-${k + 1}`, seq: k + 1, dueDate: dayOf(day + 15 + k * 30), amount: k === count - 1 ? Math.round((value - part * (count - 1)) * 100) / 100 : part })));
        lines.push({ id: `plan:${planId}`, origin: "plan", kind: "plan", planId, covers: true, coverTotal: value, coverGross: value, date, at: when, debit: 0, credit: 0 });
        cards.push(planId);
      }
      invoices.push({ id: `F${key}`, kind: "sale", status: "issued", payable: value, dueDate: r() < 0.5 ? dayOf(day + Math.floor(r() * 40)) : "", planId, issuedAt: when, ...(own ? { planTotal: value, schedule: schedules.get(planId).map(row => ({ dueDate: row.dueDate, amount: row.amount })) } : {}) });
    };
    const cover = () => {
      if (!(balance > 1)) return;
      const value = Math.min(Math.round(balance * 100) / 100, amount(20, 1500));
      const planId = `M${id()}`;
      if (lock && dayOf(day) <= lock) return;
      schedules.set(planId, [{ id: `${planId}-1`, seq: 1, dueDate: dayOf(day + 20), amount: value }]);
      lines.push({ id: `plan:${planId}`, origin: "plan", kind: "plan", planId, covers: true, coverTotal: value, coverGross: value, date: dayOf(day), at: at(), debit: 0, credit: 0 });
      cards.push(planId);
    };
    const cardPay = planId => planId && write({ id: `plan-entry:${id()}`, origin: "plan", kind: "plan-in", planId, itemId: "", date: dayOf(day), at: at(), debit: 0, credit: amount(50, 9000) });
    const noise = () => {
      const p = r();
      if (p < 0.25) write({ id: `Y${id()}`, origin: "account", kind: "credit", date: dayOf(day), at: at(), debit: 0, credit: amount(50, 3000) });
      else if (p < 0.5) write({ id: `B${id()}`, origin: "account", kind: "debt", date: dayOf(day), at: at(), debit: amount(50, 3000), credit: 0 });
      else if (p < 0.7) write({ id: `P${id()}`, origin: "account", kind: "in", date: dayOf(day), at: at(), debit: 0, credit: amount(50, 3000) });
      else if (p < 0.85) invoice(r() < 0.5);
      else if (cards.length) cardPay(cards[Math.floor(r() * cards.length)]);
    };
    const step = (gap = 3) => {
      day += Math.floor(r() * gap);
      for (let k = Math.floor(r() * 2.2); k > 0; k -= 1) noise();
    };
    // Tohum 3'ün iskeleti (her adım olasılıkla, araya rastgele satırlar): taksitli satış → Alacak (taksitleri kapatır) → dönem kilidi → satış → stoktan satış + aynı gün
    // taksitli satışın kartına tahsilat + Mevcut Borç kartı → o karta tahsilat → kilit kalkar.
    step();
    invoice(true);
    const own = cards.at(-1);
    step();
    write({ id: `Y${id()}`, origin: "account", kind: "credit", date: dayOf(day), at: at(), debit: 0, credit: amount(500, 9000) });
    step();
    lock = dayOf(Math.max(0, day - Math.floor(r() * 3)));
    history.push({ at: at(), value: lock });
    day += 1 + Math.floor(r() * 4);
    if (r() < 0.85) invoice(false);
    step(2);
    if (r() < 0.85) write({ id: `S${id()}`, origin: "stock", kind: "debt", date: dayOf(day), at: at(), sourceId: `m-${id()}`, stockReason: "", debit: amount(20, 800), credit: 0 });
    if (r() < 0.9) cardPay(own);
    if (r() < 0.9) cover();
    const second = cards.at(-1);
    step(5);
    if (r() < 0.9) cardPay(second);
    step();
    if (r() < 0.8) {
      history.push({ at: at(), value: "" });
      lock = "";
    }
    step();
    return { lines, invoices, schedules, lockAt: lockAtOf(history), today: dayOf(day + 5) };
  };
  for (let block = 0; block < 4; block += 1) {
    it(`tohum ${7000 + block * 10}–${7009 + block * 10}: 10 × 250 cari — Σ kalem = bakiye`, () => {
      for (let seed = 7000 + block * 10; seed < 7010 + block * 10; seed += 1) {
        const r = rng(seed);
        for (let a = 0; a < 250; a += 1) {
          const input = generate(r, seed, a);
          const res = buildObligations(input);
          assert.equal(sigmaMinor(res), balanceMinor(input.lines), `tohum ${seed} cari ${a}: Σ kalem ${sigmaMinor(res) / 100} ≠ bakiye ${balanceMinor(input.lines) / 100}`);
          total.cari += 1;
          const free = buildObligations({ ...input, lockAt: undefined });
          if (sigmaMinor(free) === balanceMinor(input.lines) && JSON.stringify(free.items.map(i => [i.key, i.remaining])) !== JSON.stringify(res.items.map(i => [i.key, i.remaining]))) total.kilitli += 1;
          if ((res.prepaidPasses?.count || 0) > 0) total.olcum += 1;
        }
      }
    });
  }
  it("üretici sınıfı gördü: kilidin kalemleri değiştirdiği ve ön ödeme ölçümü yapılan cariler üretildi", () => {
    console.log(`# kilit izli değişmez: ${JSON.stringify(total)} (kilitli = kilit izinin kalemleri değiştirdiği cari; olcum = ön ödeme ölçümlü cari)`);
    assert.equal(total.cari, 10000);
    assert.ok(total.kilitli >= 50, `kilidin kalemleri değiştirdiği cari ${total.kilitli}`);
    assert.ok(total.olcum >= 50, `ön ödeme ölçümlü cari ${total.olcum}`);
  });
});
