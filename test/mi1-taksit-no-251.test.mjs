// 2.5.1 Mİ-1 — Cari Listesi'nin Taksit sütununda geciken taksitin numarası: "15.10.2026 · 29 gün gecikti (2. taksit)".
// KULLANICI 27.11 (AYNEN): "müşterinin isteği var; geciken taksit gününü gösteriyor ya programımız; 20 gün gecikti vb diyorya onun yanına parantez içinde 2. taksit
// yazılabilirmi hangi taksit geciktiyse o yazılacak".
// BAŞ MİMAR KARARLARI (kullanıcıya gösterildi): (a) numara, gün sayısının AİT OLDUĞU taksitin kendi kartındaki sırası; birden çok kart / birden çok geciken varsa bugünkü
// kural AYNEN (satır hangi taksitten üretiliyorsa o); (b) liste çıktısında bu satır varsa orada da aynı; (c) listede yazan numara ile kartta görünen numara AYNI kaynaktan
// gelir ve BOŞLUKSUZDUR (2.5.0 BİLİNEN SINIR "silinen taksitten sonra sıra numarasında boşluk" düzelir).
// Beklenen numaralar ELLE (kartın vadeye göre sırasından): silinen / sonradan eklenen / vadesi değişen taksitte saklanan sıra (seq) ile görünen numara (no) ayrışır.
// Nasıl bozulur listesi: docs/devir/2.5.1-DEVAM/mi-rapor.md §0 Mİ-1 (maddeler 1, 2, 3, 4, 6, 7, 8, 10, 12, 13 burada).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const steppingClock = (start = NOW, step = 7) => {
  let at = Date.parse(start);
  return () => (at += step);
};

describe("Mİ-1 — geciken taksitin numarası: listede yazan = kartta görünen, boşluksuz", () => {
  let h;
  before(async () => {
    const server = await startTestServer({ now: steppingClock(), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), del: async url => unwrap(await client.del(url)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    let n = 0;
    h = { server, client, api, must };
    h.account = label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Mİ1 ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 251 ${String(10 + (n += 1)).padStart(2, "0")} 00` }));
    h.card = (acc, total, count, firstDue) => must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-120), total: String(total), accountId: acc.id, mode: "auto", count: String(count), firstDue, everyMonths: "1" }));
    h.cardPay = (planId, amount, extra = {}) => must("kart tahsilatı", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: String(amount), method: "cash", date: day(-2), cashForce: true, similarOk: true, ...extra }));
    h.cardOut = (planId, amount) => must("kart iadesi", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "out", amount: String(amount), method: "cash", date: day(-1), cashForce: true, similarOk: true }));
    h.win = planId => must("kart penceresi", api.get(`/api/workspace/plans/${planId}`));
    h.row = async acc => {
      const list = await must("Cari Listesi", api.get(`/api/workspace/accounts?q=${encodeURIComponent(acc.name)}&status=all`));
      const row = list.accounts.find(item => item.id === acc.id);
      assert.ok(row, `${acc.name} listede`);
      return row;
    };
    // Listedeki satırın numarası kartın penceresinde AYNI taksitte görünen numara mı (tek kaynak).
    h.sameAsCard = async (acc, label) => {
      const row = await h.row(acc);
      assert.ok(row.next, `${label}: satırda sıradaki taksit var`);
      assert.equal(typeof row.next.no, "number", `${label}: satırın taksitinin görünen numarası (no) var`);
      const win = await h.win(row.next.planId);
      const shown = win.items.find(item => item.id === row.next.id);
      assert.ok(shown, `${label}: satırın taksiti kartta var`);
      assert.equal(row.next.no, shown.no, `${label}: listede yazan numara (${row.next.no}) = kartta görünen numara (${shown.no})`);
      assert.deepEqual(win.items.map(item => item.no), win.items.map((_, index) => index + 1), `${label}: kartta numaralar boşluksuz 1..n`);
      const detail = await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
      const summary = detail.plans.find(plan => plan.id === row.next.planId);
      if (summary?.next?.id === row.next.id) assert.equal(summary.next.no, row.next.no, `${label}: cari kartındaki taksit kartı özeti aynı numara`);
      return { row, win };
    };
  });
  after(async () => h?.server.close());

  it("ödenmemiş kart: en eski geciken 1. taksit; 1. taksit ödenince satır 2. taksitten (… gün gecikti (2. taksit))", async () => {
    const acc = await h.account("Düz");
    const plan = await h.card(acc, 3000, 3, "2026-08-06");
    let { row } = await h.sameAsCard(acc, "düz");
    assert.deepEqual([row.next.no, row.next.dueDate, row.next.days < 0], [1, "2026-08-06", true]);
    await h.cardPay(plan.id, 1000);
    ({ row } = await h.sameAsCard(acc, "düz, 1. ödendi"));
    assert.deepEqual([row.next.no, row.next.dueDate, row.next.days], [2, "2026-09-06", -44]);
  });

  it("SİLİNMİŞ taksit: saklanan sıra 2, 3 kalır — kart ve liste 1, 2 der (boşluk yok)", async () => {
    const acc = await h.account("Silinmiş");
    const plan = await h.card(acc, 3000, 3, "2026-08-06");
    const first = (await h.win(plan.id)).items[0];
    await h.must("taksit sil", h.api.del(`/api/workspace/plans/${plan.id}/items/${first.id}`));
    const { row, win } = await h.sameAsCard(acc, "silinmiş");
    assert.deepEqual(win.items.map(item => [item.seq, item.no]), [[2, 1], [3, 2]], "saklanan sıra 2, 3; görünen 1, 2");
    assert.deepEqual([row.next.seq, row.next.no, row.next.dueDate], [2, 1, "2026-09-06"], "satır: 1. taksit (saklanan 2 değil)");
    // Kart penceresinin tahsilat formu "Hangi Taksite"de "1. taksit" gösterir; ödenmiş taksite yeniden tahsilatın 409 iletisi de aynı numarayı söyler.
    await h.cardPay(plan.id, 1000, { itemId: win.items[0].id });
    const again = await h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", method: "cash", date: day(-1), cashForce: true, similarOk: true, itemId: win.items[0].id });
    assert.equal(again.status, 409, JSON.stringify(again.data).slice(0, 200));
    assert.match(String(again.data?.error || again.data?.message || JSON.stringify(again.data)), /Seçilen 1\. taksit ödendi/, "409 iletisi görünen numarayı söyler (saklanan 2 değil)");
  });

  it("sonradan EKLENEN, vadesi öncekilerden önce taksit: saklanan sıra 4 — görünen 1; eskiler 2, 3, 4", async () => {
    const acc = await h.account("Eklenen");
    const plan = await h.card(acc, 3000, 3, "2026-08-06");
    await h.must("kart tutarı", h.api.put(`/api/workspace/plans/${plan.id}`, { ...(await h.win(plan.id)), total: "3500" }));
    await h.must("taksit ekle", h.api.post(`/api/workspace/plans/${plan.id}/items`, { dueDate: "2026-07-15", amount: "500" }));
    const { row, win } = await h.sameAsCard(acc, "eklenen");
    assert.deepEqual(win.items.map(item => [item.seq, item.no, item.dueDate]), [[4, 1, "2026-07-15"], [1, 2, "2026-08-06"], [2, 3, "2026-09-06"], [3, 4, "2026-10-06"]]);
    assert.deepEqual([row.next.seq, row.next.no, row.next.days], [4, 1, -97]);
  });

  it("VADESİ DEĞİŞEN taksit: 3. taksitin vadesi öne alınınca kart sırası ve numara vadeden", async () => {
    const acc = await h.account("Vadesi Değişen");
    const plan = await h.card(acc, 3000, 3, "2026-08-06");
    const third = (await h.win(plan.id)).items[2];
    await h.must("taksit düzelt", h.api.put(`/api/workspace/plans/${plan.id}/items/${third.id}`, { dueDate: "2026-07-01", amount: "1000" }));
    const { row, win } = await h.sameAsCard(acc, "vadesi değişen");
    assert.deepEqual(win.items.map(item => [item.seq, item.no]), [[3, 1], [1, 2], [2, 3]]);
    assert.deepEqual([row.next.id, row.next.no], [third.id, 1], "satır: vadesi öne alınan taksit, numarası 1");
  });

  it("bağsız cari tahsilatı 1. taksiti kapatır (kuyruk): liste ve kart 2. taksit der", async () => {
    const acc = await h.account("Bağsız");
    await h.card(acc, 3000, 3, "2026-08-06");
    await h.must("cari tahsilatı", h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "1000", date: day(-2), method: "cash", cashForce: true, similarOk: true }));
    const { row, win } = await h.sameAsCard(acc, "bağsız");
    assert.deepEqual([row.next.no, win.next.no], [2, 2], "kart penceresinin sıradaki taksiti de 2.");
  });

  it("iade: 2000 tahsil, 1000 iade → iade en yeni taksitten düşer; satır 2. taksit", async () => {
    const acc = await h.account("İade");
    const plan = await h.card(acc, 3000, 3, "2026-08-06");
    await h.cardPay(plan.id, 2000);
    await h.cardOut(plan.id, 1000);
    const { row } = await h.sameAsCard(acc, "iade");
    assert.equal(row.next.no, 2);
  });

  it("birden çok kart: satır vadesi en erken geciken taksitten — numara O KARTTAKİ sırası", async () => {
    const acc = await h.account("İki Kart");
    const x = await h.card(acc, 3000, 3, "2026-08-31");
    const y = await h.card(acc, 3000, 3, "2026-08-01");
    let { row } = await h.sameAsCard(acc, "iki kart");
    assert.deepEqual([row.next.planId, row.next.no], [y.id, 1]);
    await h.cardPay(y.id, 1000);
    await h.cardPay(x.id, 1000);
    ({ row } = await h.sameAsCard(acc, "iki kart, ikisinin 1.'si ödendi"));
    assert.deepEqual([row.next.planId, row.next.no, row.next.dueDate], [y.id, 2, "2026-09-01"], "Y'nin 2. taksiti (01.09) X'in 2.'sinden (30.09) önce");
  });

  it("geciken yokken: sıradaki taksit ileride (gün ≥ 0) — numara alanı var, gecikme eki yalnız days < 0'da (istemci)", async () => {
    const acc = await h.account("Gecikmesiz");
    await h.card(acc, 2000, 2, day(5));
    const { row } = await h.sameAsCard(acc, "gecikmesiz");
    assert.ok(row.next.days >= 0, `gün ${row.next.days}`);
    assert.equal(row.next.no, 1);
  });
});
