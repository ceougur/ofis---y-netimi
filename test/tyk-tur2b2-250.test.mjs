// 2.5.0 Ç5-B tur 2b-2 — kullanıcı kararlarının KENDİ örnekleri (iş listesi C / D AYNEN; beklenenler karar metinlerinden ELLE — programın çıktısından DEĞİL, ders 5, 40):
// S95 / S97 / S102 / S103 (karşı yönlü kalemler, sonradan gelen bağsız ödeme), S98 / S104 / S105 (avans da kalemdir; sıra), S99 (fatura durumu tek kuyruktan), S101 (avansla
// kapanmış borca kart), S110 / S120 / S122 (kartın taşıdığı borç), S123–S125 = C (BİLİNEN SINIR — kural yok; değişmezler + bugünkü sayılar), S96 (çek / senetle verilen avans
// kalemi), S118 = B (taksit tahsilatı formunun önerisi kartın KENDİ kalanından), ekran yürüyüşü 1 Y2 (taksitlendirilmemiş kalanı gecikmiş kart 'Gecikti').
// Saf kuyruk (buildObligations) + gerçek program (API). Sahte saat (ders 13). Eski kodda (taban c5b-2b2-taban) kırmızı: S95, S102, S105, S99, S101, S110, S120, S122, S96, S118, Y2;
// S97 / S98 / S103 / S104 tabanda da kararın sayısını veriyordu (koruma testi — mutantlar test/tyk-mutasyon-250.mjs).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildObligations } from "../server/lib/obligation-queue.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

let seq = 0;
const at = date => `${date}T09:00:${String((seq += 1) % 60).padStart(2, "0")}.${String(seq).padStart(3, "0")}Z`;
const sale = (id, date, amount, dueDate = "", extra = {}) => {
  const when = at(date);
  return { inv: { id, kind: "sale", status: "issued", payable: amount, dueDate, planId: "", issuedAt: when, ...extra }, line: { id: `l-${id}`, origin: "invoice", kind: "debt", sourceId: id, date, at: when, debit: amount, credit: 0 } };
};
const purchase = (id, date, amount, dueDate = "") => {
  const when = at(date);
  return { inv: { id, kind: "purchase", status: "issued", payable: amount, dueDate, planId: "", issuedAt: when }, line: { id: `l-${id}`, origin: "invoice", kind: "credit", sourceId: id, date, at: when, debit: 0, credit: amount } };
};
const line = (id, origin, kind, date, debit, credit, extra = {}) => ({ id, origin, kind, date, at: at(date), debit, credit, ...extra });
const tahsilat = (id, date, amount) => line(id, "account", "in", date, 0, amount);
const odeme = (id, date, amount) => line(id, "account", "out", date, amount, 0);
const borc = (id, date, amount) => line(id, "account", "debt", date, amount, 0);
const alacak = (id, date, amount) => line(id, "account", "credit", date, 0, amount);
const stokSatis = (id, date, amount) => line(id, "stock", "debt", date, amount, 0, { stockReason: "", sourceId: `m-${id}` });
const alisIadesi = (id, date, amount) => line(id, "stock", "debt", date, amount, 0, { stockReason: "preturn", sourceId: `m-${id}` });
const kart = (planId, date, total, extra = {}) => line(`plan:${planId}`, "plan", "plan", date, 0, 0, { planId, covers: true, coverTotal: total, coverGross: total, ...extra });
const kartTahsilati = (id, planId, date, amount) => line(`plan-entry:${id}`, "plan", "plan-in", date, 0, amount, { planId });
const build = ({ docs = [], lines = [], ...rest }) => buildObligations({ lines: [...docs.map(d => d.line), ...lines], invoices: docs.map(d => d.inv), ...rest });
const r2 = value => Math.round(value * 100) / 100;
const sigma = r => r2(r.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0));
const balanceOf = (docs, lines) => r2([...docs.map(d => d.line), ...lines].reduce((s, l) => s + l.debit - l.credit, 0));
const left = (r, lineId) => r.items.find(i => i.lineId === lineId)?.remaining ?? 0;
const inst = (r, planId) => [...r.installments.get(planId).values()].map(row => row.remaining);

describe("Ç5-B tur 2b-2 — S95 / S97 / S102 / S103 (karşı yönlü kalemler, sonradan gelen bağsız ödeme)", () => {
  it("S95 = A: satış 10.000 (vade 31.03) · alış 6.000 (10.03) · biz alışı 6.000 bağlamadan öderiz (12.03) ⇒ alış Ödendi, satış 10.000 vade 31.03, 31.03'e kadar gecikmiş 0", () => {
    const docs = [sale("S", "2026-03-01", 10000, "2026-03-31"), purchase("A", "2026-03-10", 6000, "2026-03-10")];
    const lines = [odeme("O", "2026-03-12", 6000)];
    const r = build({ docs, lines, today: "2026-03-20" });
    assert.equal(r.invoiceNet.get("S").remaining, 10000, "net görünüm: satış 10.000 (netleşme geri alındı)");
    assert.equal(r.invoiceNet.get("A").remaining, 0, "alış kapandı");
    assert.equal(left(r, "O"), 0, "ödeme alışı kapattı (avans kalmadı)");
    assert.equal(r.overdue("2026-03-31").amount, 0, "vade günü gecikmiş değil");
    assert.equal(r.overdue("2026-04-01").amount, 10000, "vadeden sonra 10.000");
    assert.equal(r.invoices.get("A").state, "paid", "fatura durumu: alış Ödendi");
    assert.equal(sigma(r), balanceOf(docs, lines));
  });
  it("S97 = A: aynı gün Borç 1.000 + Alacak 300 + tahsilat 1.000 ⇒ Alacak 0 + müşterinin 300 avansı; ERTESİ gün tahsilat ⇒ Alacak 300 açık (S95; D 10.11 18:25 (1))", () => {
    for (const order of [["B", "Y", "P"], ["P", "Y", "B"]]) {
      const all = { B: borc("B", "2026-06-01", 1000), Y: alacak("Y", "2026-06-01", 300), P: tahsilat("P", "2026-06-01", 1000) };
      const r = build({ lines: order.map(k => all[k]), today: "2026-06-10" });
      assert.deepEqual([left(r, "B"), left(r, "Y"), left(r, "P")], [0, 0, 300], `aynı gün (yazım sırası ${order.join(" → ")})`);
    }
    const r = build({ lines: [borc("B", "2026-06-01", 1000), alacak("Y", "2026-06-01", 300), tahsilat("P", "2026-06-02", 1000)], today: "2026-06-10" });
    assert.deepEqual([left(r, "B"), left(r, "Y"), left(r, "P")], [0, 300, 0], "ertesi gün: Alacak 300 açık ('Ödenecek Borç'), avans yok");
  });
  it("S102 = A: 01.06 Borç 1.000 · 02.06 Alacak X 300 · 03.06 Alacak Y 300 + aynı gün tahsilat 1.000 ⇒ X 300 açık, Y 0, müşterinin avansı 300", () => {
    const lines = [borc("B", "2026-06-01", 1000), alacak("X", "2026-06-02", 300), alacak("Y", "2026-06-03", 300), tahsilat("P", "2026-06-03", 1000)];
    const r = build({ lines, today: "2026-06-10" });
    assert.deepEqual([left(r, "B"), left(r, "X"), left(r, "Y"), left(r, "P")], [0, 300, 0, 300]);
    assert.equal(sigma(r), balanceOf([], lines));
  });
  it("S102 iki önceki gün: en YENİ önceki gün netleşmesi önce geri alınır (01.06 B 1.000 · 02.06 X 300 · 03.06 Y 300 · 04.06 tahsilat 700 ⇒ Y 300 açık, X 0)", () => {
    // Tahsilat 700: önce açık 400, artan 300 ile en yeni netleşme (03.06 Y) geri alınır — X'in netleşmesi kalır (K2, kâhin Y6-1).
    const r = build({ lines: [borc("B", "2026-06-01", 1000), alacak("X", "2026-06-02", 300), alacak("Y", "2026-06-03", 300), tahsilat("P", "2026-06-04", 700)], today: "2026-06-10" });
    assert.deepEqual([left(r, "B"), left(r, "X"), left(r, "Y"), left(r, "P")], [0, 0, 300, 0]);
  });
  it("S103 = A: tedarikçi — 01.03 Ödeme 500 · 05.03 alış 300 · 10.03 tedarikçiden tahsilat 500 ⇒ alış Ödendi, tedarikçinin avansı 300 (kalem değil — Ödenecek Borç yok)", () => {
    const docs = [purchase("A", "2026-03-05", 300)];
    const lines = [odeme("O", "2026-03-01", 500), tahsilat("P", "2026-03-10", 500)];
    const r = build({ docs, lines, today: "2026-03-20" });
    assert.equal(r.invoices.get("A").state, "paid");
    assert.deepEqual(r.items.map(i => [i.kind, i.side, i.remaining, i.due]), [["payment", "payable", 300, false]], "yalnız tedarikçinin avansı (ödeme satırı, yükümlülük değil)");
    assert.equal(r.overdue("2026-03-20").amount, 0);
  });
});

describe("Ç5-B tur 2b-2 — S98 / S104 / S105 (avans da kalemdir; sıra)", () => {
  it("S98 = A: 01.03 müşteriye Ödeme 200 · 05.03 Borç 100 (vade 30.04) · 10.03 tahsilat 150 ⇒ avans 50 + Borç 100 açık", () => {
    const r = build({ lines: [odeme("O", "2026-03-01", 200), borc("B", "2026-03-05", 100), tahsilat("P", "2026-03-10", 150)], dueDates: new Map([["B", "2026-04-30"]]), today: "2026-03-20" });
    assert.deepEqual([left(r, "O"), left(r, "B"), left(r, "P")], [50, 100, 0]);
    assert.equal(r.overdue("2026-03-20").amount, 50, "verilen avans ödeme gününden sonra gecikmiş");
  });
  it("S104 = A: 01.03 tahsilat 500 · 05.03 Alacak 200 (vade 30.04) · 10.03 Ödeme 300 ⇒ avans 200 kalır, Alacak 200 açık", () => {
    const r = build({ lines: [tahsilat("P", "2026-03-01", 500), alacak("Y", "2026-03-05", 200), odeme("O", "2026-03-10", 300)], dueDates: new Map([["Y", "2026-04-30"]]), today: "2026-03-20" });
    assert.deepEqual([left(r, "P"), left(r, "Y"), left(r, "O")], [200, 200, 0]);
  });
  it("S105 = A: tedarikçi — 01.03 Ödeme 300 · 05.03 faturasız Alış İadesi 200 · 10.03 alış 250 ⇒ iade alacağı 0, avans 250", () => {
    const docs = [purchase("A", "2026-03-10", 250)];
    const lines = [odeme("O", "2026-03-01", 300), alisIadesi("R", "2026-03-05", 200)];
    const r = build({ docs, lines, today: "2026-03-20" });
    assert.deepEqual([left(r, "R"), left(r, "O")], [0, 250]);
    assert.equal(r.overdue("2026-03-20").amount, 250, "gecikmiş = avans 250");
    assert.equal(sigma(r), balanceOf(docs, lines));
  });
});

describe("Ç5-B tur 2b-2 — S99 (fatura durumu tek kuyruktan)", () => {
  it("S99 = A: avans 500 → taksitli fatura B 300 (kendi kartı) → taksitsiz fatura A 500 ⇒ B Ödendi, A 300 açık; Σ fatura açığı = cari bakiyesi 300; kart taksitleri kapalı", () => {
    const schedules = new Map([["KB", [{ id: "b1", seq: 1, dueDate: "2026-04-01", amount: 150 }, { id: "b2", seq: 2, dueDate: "2026-05-01", amount: 150 }]]]);
    const docs = [sale("B", "2026-03-10", 300, "", { planId: "KB", planTotal: 300 }), sale("A", "2026-03-15", 500, "2026-03-15")];
    const lines = [tahsilat("P", "2026-03-01", 500)];
    const r = build({ docs, lines, schedules, today: "2026-06-01" });
    assert.deepEqual([r.invoices.get("B").state, r.invoices.get("B").open, r.invoices.get("A").state, r.invoices.get("A").open], ["paid", 0, "overdue", 300]);
    assert.equal(r.invoices.get("B").open + r.invoices.get("A").open, balanceOf(docs, lines), "Σ fatura açığı = bakiye");
    assert.deepEqual(inst(r, "KB"), [0, 0], "taksitler avansla kapandı (Vade Takip / zil ile aynı)");
    assert.equal(r.overdue("2026-06-01").amount, 300, "gecikmiş = A 300");
    assert.ok(r.invoices.get("B").closers.every(c => c.id === "P" && c.mode === "auto"), "B'nin kapatanı avans (Otomatik)");
  });
  // S98 = A × S99 = A ("fatura listesi, kart, Vade Takip, zil AYNI sayıyı gösterir"; kâhin d25 R3 / d27 P3): fatura durumunda da karşı tarafın netleşmemiş bağsız parası
  // (müşteriye verdiğimiz avans) gelen tahsilatın karşısında kendi günüyle kalemdir; belgeler arası netleşme yine yalnız Mahsup Et ile (karar (5)).
  it("S98 × S99: müşteriye Ödeme 200 (01.03) · satış 100 (05.03) · tahsilat 150 (10.03) ⇒ tahsilat önce avansı kapatır: fatura 100 açık (Vadesi Geçti), avans 50 — Vade Takip ile aynı", () => {
    const docs = [sale("F", "2026-03-05", 100, "2026-03-05")];
    const lines = [odeme("O", "2026-03-01", 200), tahsilat("T", "2026-03-10", 150)];
    const r = build({ docs, lines, today: "2026-03-15" });
    assert.deepEqual([r.invoices.get("F").open, r.invoices.get("F").state, r.invoiceNet.get("F").remaining, left(r, "O")], [100, "overdue", 100, 50]);
    assert.equal(r.invoices.get("F").open + left(r, "O"), balanceOf(docs, lines), "Σ fatura açığı + avans = bakiye 150");
  });
  it("S98 × S99 (ters yön): müşterinin avansı 500 (01.03) · müşteriye geri Ödeme 300 (05.03) · satış 500 (10.03) ⇒ fatura 300 açık (avansın 200'ü kaldı); ödeme müşterinin avansını kapatır", () => {
    const docs = [sale("F", "2026-03-10", 500, "2026-03-10")];
    const lines = [tahsilat("T", "2026-03-01", 500), odeme("O", "2026-03-05", 300)];
    const r = build({ docs, lines, today: "2026-03-15" });
    assert.deepEqual([r.invoices.get("F").open, r.invoiceNet.get("F").remaining], [300, 300], "fatura durumu = net görünüm");
    assert.equal(r.invoices.get("F").open, balanceOf(docs, lines), "Σ fatura açığı = bakiye 300");
  });
  it("S98 × S99 (taksitli, kâhin d27 P3): verilen avans 200 (01.05) · taksitli satış 600 (2 × 300, 01.06 / 01.07) · tahsilat 300 (10.05) ⇒ fatura 500 açık, 1. taksit 200", () => {
    const schedules = new Map([["KP", [{ id: "p1", seq: 1, dueDate: "2026-06-01", amount: 300 }, { id: "p2", seq: 2, dueDate: "2026-07-01", amount: 300 }]]]);
    const docs = [sale("P", "2026-05-05", 600, "", { planId: "KP", planTotal: 600 })];
    const lines = [odeme("O", "2026-05-01", 200), tahsilat("T", "2026-05-10", 300)];
    const r = build({ docs, lines, schedules, today: "2026-06-15" });
    assert.deepEqual([r.invoices.get("P").open, ...inst(r, "KP"), left(r, "O")], [500, 200, 300, 0]);
    assert.equal(r.overdue("2026-06-15").amount, 200, "gecikmiş = 1. taksitin kalanı 200");
  });
  it("karar (5) korunur: alış 300 (bizim borcumuz) + satış 500; müşteriden tahsilat 200 ⇒ fatura durumunda alış AÇIK kalır (belgeler arası netleşme yok), satış 300", () => {
    const docs = [purchase("A", "2026-03-01", 300, "2026-03-01"), sale("S", "2026-03-02", 500, "2026-03-02")];
    const lines = [tahsilat("T", "2026-03-05", 200)];
    const r = build({ docs, lines, today: "2026-03-15" });
    assert.deepEqual([r.invoices.get("A").open, r.invoices.get("S").open], [300, 300]);
  });
});

describe("Ç5-B tur 2b-2 — S101 (avansla kapanmış borca açılan kart; genel mekanizma)", () => {
  // Karar örneği: 1.000 avans → stoktan 600 veresiye + 2 taksit (300 + 300) → Taksit Tahsilatı 300 → Borç Yaz 500 ⇒ kart Bitti, takvim / zil boş, gecikmiş 0, müşteri 200 alacaklı.
  const schedules = new Map([["K", [{ id: "k1", seq: 1, dueDate: "2026-02-10", amount: 300 }, { id: "k2", seq: 2, dueDate: "2026-03-10", amount: 300 }]]]);
  it("S101 = A, karar örneği (kart Kayıt Tarihi carinin Kayıt Tarihi — satıştan önce)", () => {
    const lines = [tahsilat("P", "2026-01-01", 1000), stokSatis("S", "2026-01-10", 600)];
    lines.push({ ...kart("K", "2025-06-01", 600), at: lines[1].at }); // satışla aynı işlemde yazılır (Kayıt Tarihi carinin Kayıt Tarihi)
    const once = build({ lines, schedules, today: "2026-04-01" });
    assert.deepEqual(inst(once, "K"), [0, 0], "kart açılınca taksitler avansla ödenmiş (Bitti)");
    lines.push(kartTahsilati("e1", "K", "2026-02-01", 300), borc("B", "2026-02-15", 500));
    const r = build({ lines, schedules, today: "2026-04-01" });
    assert.deepEqual(inst(r, "K"), [0, 0]);
    assert.equal(left(r, "B"), 0, "sonraki borç avanstan kapandı");
    assert.equal(r.overdue("2026-04-01").amount, 0, "gecikmiş 0");
    assert.deepEqual([sigma(r), balanceOf([], lines)], [-200, -200], "Σ kalem = bakiye −200 (müşteri alacaklı)");
    assert.ok(r.items.every(i => i.side === "payable"), "takvim / zil kalemi yok (yalnız müşterinin avansı)");
  });
  it("karar (e) 11.11 03:15 'kısmen avansla kapanmış borçta kartın o kadarı ödenmiş sayılır': avans 400 → satış 600 + kart 600 (2 × 300) ⇒ 1. taksit 0, 2. taksit 200; kart kalanı 200 = bakiye", () => {
    const lines = [tahsilat("P", "2026-01-01", 400), stokSatis("S", "2026-01-10", 600)];
    lines.push({ ...kart("K", "2025-06-01", 600), at: lines[1].at });
    const r = build({ lines, schedules, today: "2026-04-01" });
    assert.deepEqual(inst(r, "K"), [0, 200]);
    assert.equal(sigma(r), 200);
  });
  it("S101'in yüzü (DK-C5BT2A (6) b): kart açıldıktan SONRA kaydedilen geriye tarihli ödeme + kart tahsilatı ⇒ Σ kalem = bakiye, kart fazlası avans", () => {
    const sched = new Map([["K", [{ id: "k1", seq: 1, dueDate: "2026-02-01", amount: 500 }, { id: "k2", seq: 2, dueDate: "2026-03-01", amount: 500 }]]]);
    const b = { ...borc("B", "2026-01-10", 1000), at: "2026-01-10T09:00:00.000Z" };
    const k = { ...kart("K", "2026-01-10", 1000), at: "2026-01-10T10:00:00.000Z" };
    const p = { ...tahsilat("P", "2026-01-09", 400), at: "2026-01-11T09:00:00.000Z" };
    const e = { ...kartTahsilati("e1", "K", "2026-03-20", 800), at: "2026-03-20T09:00:00.000Z" };
    const r = build({ lines: [b, k, p, e], schedules: sched, today: "2026-04-01" });
    assert.deepEqual(inst(r, "K"), [0, 0]);
    assert.deepEqual([sigma(r), balanceOf([], [b, k, p, e])], [-200, -200], "kart tahsilatının artanı 200 avans");
  });
});

describe("Ç5-B tur 2b-2 — S110 / S120 / S122 (kartın taşıdığı borç) ve S123–S125 (BİLİNEN SINIR)", () => {
  const three = (planId, first) => new Map([[planId, [1, 2, 3].map(n => ({ id: `${planId}${n}`, seq: n, dueDate: `2026-0${3 + n}-${first}`, amount: 300 }))]]);
  it("S110 = A (elle): elle borç 900 + fatura F 600, kart 900 (3 × 300) ⇒ takvimde 3 × 300 taksit + F 600 ayrı açık; gecikmiş 900 (bugün 1. taksit + F)", () => {
    // F elle borçtan ESKİ (vade sırası S110 B'de F'yi kartın içine alırdı — iki okuma ayrışsın).
    const docs = [sale("F", "2026-02-25", 600, "2026-02-25")];
    const lines = [borc("X", "2026-03-01", 900), kart("M", "2026-03-10", 900)];
    const r = build({ docs, lines, schedules: three("M", "05"), today: "2026-04-10" });
    assert.deepEqual(inst(r, "M"), [300, 300, 300]);
    assert.equal(r.invoiceNet.get("F").remaining, 600, "F kartın dışında");
    assert.equal(r.entries.get("X").covered, 900, "elle borç kartın içinde");
    assert.equal(r.overdue("2026-04-10").amount, 900);
    assert.equal(r.coverage.get("M").rule, "S110-elle");
  });
  it("S110 = A (stoktan satış): Borç 500 + stoktan satış 1.000 + 2 taksit ⇒ [500, 500] + Borç 500 ayrı (kartın Kayıt Tarihi carinin Kayıt Tarihi)", () => {
    const sched = new Map([["C", [{ id: "c1", seq: 1, dueDate: "2026-04-10", amount: 500 }, { id: "c2", seq: 2, dueDate: "2026-05-10", amount: 500 }]]]);
    const lines = [borc("B", "2026-03-01", 500), stokSatis("S", "2026-03-10", 1000)];
    lines.push({ ...kart("C", "2025-06-01", 1000), at: lines[1].at });
    const r = build({ lines, schedules: sched, today: "2026-04-20" });
    assert.deepEqual(inst(r, "C"), [500, 500]);
    assert.deepEqual([left(r, "B"), left(r, "S")], [500, 0]);
    assert.equal(r.overdue("2026-04-20").amount, 1000);
    assert.equal(r.coverage.get("C").rule, "S110-satis");
  });
  it("S110 tetiği: açık borç = kart tutarı ⇒ eski kural; 1 kuruş fazla ⇒ S110 (tutarı eşit elle borç kartta, 0,01 ayrı)", () => {
    const esit = build({ lines: [borc("X", "2026-03-01", 900), kart("M", "2026-03-10", 900)], schedules: three("M", "05"), today: "2026-04-10" });
    const lines = [borc("K", "2026-02-01", 0.01), borc("X", "2026-03-01", 900), kart("M", "2026-03-10", 900)];
    const r = build({ lines, schedules: three("M", "05"), today: "2026-04-10" });
    assert.deepEqual([left(r, "K"), left(r, "X")], [0.01, 0], "eski (s2) okuma 0,01'i kartın içine alıp 900'ün 0,01'ini dışarıda bırakırdı");
    assert.deepEqual([esit.coverage.get("M").rule, r.coverage.get("M").rule], ["s2", "S110-elle"]);
  });
  it("S120 = A, karar örneği: F 600 (en eski) + elle X 500 + elle Y 700, kart 900 ⇒ kartta X 500 + Y 400; ayrı açık F 600 + Y 300", () => {
    const docs = [sale("F", "2026-02-20", 600, "2026-02-20")];
    const lines = [borc("X", "2026-03-01", 500), borc("Y", "2026-03-03", 700), kart("M", "2026-03-10", 900)];
    const r = build({ docs, lines, schedules: three("M", "05"), today: "2026-04-10" });
    assert.deepEqual([left(r, "X"), left(r, "Y"), r.invoiceNet.get("F").remaining], [0, 300, 600]);
    assert.equal(r.coverage.get("M").rule, "S120");
    assert.deepEqual([r.entries.get("X").remaining, r.entries.get("Y").remaining], [500, 700], "Kalan (defter): X 500, Y 700 (kartın ödeneni 0)");
    assert.equal(sigma(r), 1800);
  });
  it("S122 = A: S120 örneği + karta 300 ödeme ⇒ X Kalan 200, Y Kalan 700 (bakiye, kart kalanı, gecikmiş ve takvim değişmez)", () => {
    const docs = [sale("F", "2026-02-20", 600, "2026-02-20")];
    const base = [borc("X", "2026-03-01", 500), borc("Y", "2026-03-03", 700), kart("M", "2026-03-10", 900)];
    const once = build({ docs, lines: base, schedules: three("M", "05"), today: "2026-04-10" });
    const r = build({ docs, lines: [...base, kartTahsilati("e1", "M", "2026-04-08", 300)], schedules: three("M", "05"), today: "2026-04-10" });
    assert.deepEqual([r.entries.get("X").remaining, r.entries.get("Y").remaining], [200, 700]);
    assert.deepEqual(inst(r, "M"), [0, 300, 300], "kart kalanı 600");
    assert.equal(r.overdue("2026-04-10").amount, once.overdue("2026-04-10").amount - 300, "gecikmiş yalnız ödenen taksit kadar düşer");
  });
  it("S120 öbür örnekler: elle 900 + F 600, kart 600 ⇒ elle 600 kartta, açık elle 300 + F 600; kart 500 ⇒ elle 500 kartta, açık elle 400 + F 600", () => {
    for (const [total, rest] of [[600, 300], [500, 400]]) {
      const docs = [sale("F", "2026-03-05", 600, "2026-03-05")];
      const sched = new Map([["M", [{ id: "m1", seq: 1, dueDate: "2026-04-05", amount: total / 2 }, { id: "m2", seq: 2, dueDate: "2026-05-05", amount: total / 2 }]]]);
      const r = build({ docs, lines: [borc("X", "2026-03-01", 900), kart("M", "2026-03-10", total)], schedules: sched, today: "2026-04-10" });
      assert.deepEqual([left(r, "X"), r.invoiceNet.get("F").remaining], [rest, 600], `kart ${total}`);
    }
  });
  it("Tablodan Aktar / Excel kartı (coverSource 'transfer') S110 / S120'ye GİRMEZ — eski kural (vade sırası): F 600 kartın içinde, elle borcun 300'ü", () => {
    const docs = [sale("F", "2026-02-20", 600, "2026-02-20")];
    const r = build({ docs, lines: [borc("X", "2026-03-01", 900), kart("M", "2026-03-10", 900, { coverSource: "transfer" })], schedules: three("M", "05"), today: "2026-04-10" });
    assert.deepEqual([r.invoiceNet.get("F").remaining, left(r, "X"), r.coverage.get("M").rule], [0, 600, "s2"]);
  });
  // BİLİNEN SINIR (S123 = S124 = S125 = C, kullanıcı 11.11 07:33): kural yok — kodun doğal davranışı (sayılar tur 2b-2 raporunda); burada yalnız değişmezler.
  for (const [name, docs, lines, total] of [
    ["S123 (elle borçlar kart tutarından az: F 600 + X 300, kart 500)", [sale("F", "2026-02-20", 600, "2026-02-20")], [borc("X", "2026-03-01", 300)], 500],
    ["S124 (karta eşit birden çok elle borç + daha eski elle borç: Z 300 + X 900 + Y 900, kart 900)", [sale("F", "2026-02-15", 600, "2026-02-15")], [borc("Z", "2026-02-20", 300), borc("X", "2026-02-22", 900), borc("Y", "2026-02-25", 900)], 900],
    ["S125 (belge sırası ↔ vade sırası ters: X 02.03 vade 30.03, Y 05.03 vade 10.03)", [sale("F", "2026-03-04", 600, "2026-03-04")], [borc("X", "2026-03-02", 500), borc("Y", "2026-03-05", 700)], 900],
  ]) {
    it(`BİLİNEN SINIR ${name}: Σ kalem = bakiye, gecikmiş ≥ 0 ve ≤ açık borç, çökme yok`, () => {
      const sched = new Map([["M", [{ id: "m1", seq: 1, dueDate: "2026-04-05", amount: total / 2 }, { id: "m2", seq: 2, dueDate: "2026-05-05", amount: total / 2 }]]]);
      const all = [...lines, kart("M", "2026-03-10", total)];
      const r = build({ docs, lines: all, schedules: sched, dueDates: name.startsWith("S125") ? new Map([["X", "2026-03-30"], ["Y", "2026-03-10"]]) : new Map(), today: "2026-04-10" });
      assert.equal(sigma(r), balanceOf(docs, all));
      const late = r.overdue("2026-04-10").amount;
      assert.ok(late >= 0 && late <= sigma(r) + 0.005, `gecikmiş ${late}`);
    });
  }
});

// ---------------- Gerçek program (API) ----------------
const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
describe("Ç5-B tur 2b-2 — gerçek program: S96 (çekle verilen avans kalemi), Y2 (taksitsiz kart Gecikti), S118 (formun önerisi kartın kendi kalanından)", () => {
  let server;
  let api;
  let n = 0;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const account = (label, type = "customer") => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Tur2b2 ${label}`, type, registeredOn: day(-400), phone: `0500 255 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: false }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => server?.close());
  it("S96 = A: tedarikçiye verilen çek (karşılığı gelmemiş avans) Vade Takip / zil / nakit akışında 'Tahsil Edilecek Borç', ödeme gününde vadeli; gecikmiş her ekranda aynı", async () => {
    const t = await account("S96 Çek Tedarikçi", "supplier");
    await must("verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "700", issueDate: day(-10), dueDate: day(30), accountId: t.id, serialNo: "T2B2-1" }));
    const card = await must("cari kartı", api.get(`/api/workspace/accounts/${t.id}`));
    assert.equal(card.totals.overdueDebt, 700, "cari kartı gecikmiş 700");
    const vade = (await must("Vade Takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-100)}&to=${day(100)}`))).rows.filter(r => r.accountId === t.id || r.party === t.name);
    // Çekin kendi çıkışı (vadesinde 'Verilen çek') Vade Takip'te AYRICA durur (portföy); avans kalemi carinin bize borcudur — giriş yönü.
    assert.deepEqual(vade.filter(r => r.direction === "in").map(r => [r.label, r.amount, r.date]), [["Tahsil Edilecek Borç", 700, day(-10)]], "Vade Takip kalemi (ödeme günü)");
    assert.deepEqual(vade.filter(r => r.direction === "out").map(r => [r.amount, r.date]), [[700, day(30)]], "çekin kendi vadesi aynen");
    const dues = (await must("zil", api.get("/api/workspace/dues"))).items.filter(r => r.accountId === t.id);
    assert.deepEqual(dues.map(r => [r.label, r.amount, r.state]), [["Tahsil Edilecek Borç", 700, "overdue"]], "zil kalemi");
    const flow = await must("nakit akışı", api.get(`/api/workspace/overview/nakit-akisi?from=${day(-60)}&to=${day(60)}&overdue=1&table=0`));
    const rows = [...(flow.rows || []), ...(flow.overdue || [])].filter(r => (r.party === t.name || r.ref?.id === t.id) && r.direction === "in");
    assert.deepEqual(rows.map(r => [r.source, r.label, r.amount]), [["account", "Tahsil Edilecek Borç", 700]], "nakit akışı: cari kalemi (Faturasız Cari Alacağı değil, çift sayım yok)");
  });
  it("Y2: taksitsiz ayrı kart (Kayıt −20, 800) ödenmemiş ⇒ 'Gecikti' (Geciken sekmesi), Geciken 800 = taksitlendirilmemiş kalan; zil ile aynı sayı; bugün açılan kart Aktif", async () => {
    const acc = await account("Y2 Taksitsiz");
    const plan = await must("kart", api.post("/api/workspace/plans", { name: acc.name, accountId: acc.id, registeredOn: day(-20), total: "800" }));
    const p = await must("kart oku", api.get(`/api/workspace/plans/${plan.id}`));
    assert.deepEqual([p.state, p.totals.overdue, p.totals.overdueCount, p.totals.overdueRest, p.totals.overdueExtras.map(x => x.label)], ["overdue", 800, 0, 800, ["Taksitlendirilmemiş Kalan"]]);
    const late = await must("Geciken", api.get("/api/workspace/plans?status=overdue&limit=500"));
    assert.ok(late.plans.some(x => x.id === plan.id), "Geciken sekmesinde");
    const zil = (await must("zil", api.get("/api/workspace/dues"))).items.filter(r => r.accountId === acc.id);
    assert.equal(zil.reduce((s, r) => s + r.amount, 0), p.totals.overdue, "zil = kartın Geciken'i");
    const fresh = await account("Y2 Bugün");
    const today = await must("bugünkü kart", api.post("/api/workspace/plans", { name: fresh.name, accountId: fresh.id, registeredOn: TODAY, total: "800" }));
    assert.equal((await must("bugünkü kart oku", api.get(`/api/workspace/plans/${today.id}`))).state, "active", "kalemin günü bugün — Gecikti değil");
  });
  it("S118 = B: başka karttan 100 avansı olan carinin kartında (1.000, 300 tahsil) formun önerisi kartın KENDİ kalanı 700 (ownNext); kuyruk kalanı 600 ayrı alan", async () => {
    const acc = await account("S118");
    const paid = await must("ödenmiş kart", api.post("/api/workspace/plans", { accountId: acc.id, name: "S118 Ödenmiş", total: "1000", mode: "auto", count: 1, firstDue: day(10), registeredOn: day(-30) }));
    await must("1.000", api.post(`/api/workspace/plans/${paid.id}/entries`, { kind: "in", amount: "1000", method: "cash", date: day(-20) }));
    await must("avans 100", api.post(`/api/workspace/plans/${paid.id}/entries`, { kind: "in", amount: "100", method: "cash", date: day(-19), overpay: true }));
    const open = await must("açık kart", api.post("/api/workspace/plans", { accountId: acc.id, name: "S118 Açık", total: "1000", mode: "auto", count: 1, firstDue: day(10), registeredOn: day(-15) }));
    await must("300", api.post(`/api/workspace/plans/${open.id}/entries`, { kind: "in", amount: "300", method: "cash", date: day(-10) }));
    const p = await must("kart oku", api.get(`/api/workspace/plans/${open.id}`));
    assert.deepEqual([p.totals.remaining, p.totals.queueRemaining, p.ownNext.remaining, p.next.remaining, p.items[0].ownRemaining, p.items[0].remaining], [700, 600, 700, 600, 700, 600]);
    // Sunucu sınırı kartın kendi kalanından (S118 = B — DEĞİŞMEDİ): 700'ü aşan 800 'Kalanı Aşan Tutar'.
    const over = await api.post(`/api/workspace/plans/${open.id}/entries`, { kind: "in", amount: "800", method: "cash", date: day(-1) });
    assert.equal(over.status, 409);
    assert.equal(over.data?.code, "plan-overpay");
  });
  it("takvim / zil ufku söz gününe göre (K6.3; S67 = A 'söz ufkun dışında → kalem yok'): vadesi geçmiş borcun sözü +15 ⇒ zilde YOK, Vade Takip'te var; söz +5 ⇒ zilde 'overdue' (gün vadeden)", async () => {
    const acc = await account("Söz Ufku");
    const entries = `/api/workspace/accounts/${acc.id}/entries`;
    await must("uzak sözlü borç", api.post(entries, { kind: "debt", amount: "150", date: day(-40), dueDate: day(-30), expectedDate: day(15) }));
    await must("vadesiz uzak sözlü borç (S91)", api.post(entries, { kind: "debt", amount: "70", date: day(-12), expectedDate: day(20) }));
    const zil = async () => (await must("zil", api.get("/api/workspace/dues"))).items.filter(r => r.accountId === acc.id).map(r => [r.amount, r.dueDate, r.days, r.state]);
    assert.deepEqual(await zil(), [], "söz günü ufkun (bugün + 7) dışında: zilde / takvimde kalem yok");
    const vade = (await must("Vade Takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-100)}&to=${day(100)}`))).rows.filter(r => r.accountId === acc.id || r.party === acc.name);
    assert.deepEqual(vade.map(r => [r.amount, r.date]).sort(), [[150, day(15)], [70, day(20)]].sort(), "Vade Takip ufuksuz: söz gününde");
    await must("yakın sözlü borç", api.post(entries, { kind: "debt", amount: "40", date: day(-40), dueDate: day(-30), expectedDate: day(5) }));
    assert.deepEqual(await zil(), [[40, day(5), -30, "overdue"]], "söz +5 ufukta: kalem söz gününde, gün sayısı vadeden, Gecikmiş");
  });
});
