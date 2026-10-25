// 2.4.6 madde 11 — NAKİT AKIŞ PROJEKSİYONU'NA CARİ VADELİ BORÇ KALEMLERİ (docs/2.4.6-IS-LISTESI.md madde 11). docs/2.4.5-IS-LISTESI.md K6.3'teki
// "Nakit Akış Projeksiyonu bu sürümde cari vadesini KATMAZ (BİLİNEN SINIR)" kapanır. Sözleşme (önceden yazılmış kararlardan; kodun çıktısından değil):
//   - S1 FIFO + K6.3: carideki açık borç kaydının (elle Borç / Alacak, Açılış Bakiyesi) Kalan'ı, Beklenen Ödeme Tarihi girilmişse o gün, yoksa Vade Tarihi'nde
//     projeksiyonun kalemidir; yön (carinin borcu → giriş, carinin alacağı → çıkış), etiket ve tutar zil / Tahsilat Takvimi / Vade Takip'teki "account|<entryId>"
//     kalemiyle AYNI (ortak yardımcı: routes/accounts.mjs openDueItems — takvim, zil ve Vade Takip de onu okur).
//   - K6.5 (1): "Carinin Mevcut Borcu" kartının kapsadığı kısım kartın taksitleriyle BİR kez (cari kalemi Kalan − kapsam).
//   - KS2: müşterideki elle Alacak müşterinin borcuna mahsup edilmez → vadeliyse çıkış kalemidir; bakiyede ikinci kez düşülmez.
//   - Çift sayım yok: "Faturasız Cari Alacağı" (MM5: bakiye − kalemler, hareket tarihiyle) vadeli kaydın kalanını artık taşımaz; kalan kendi vadesindedir.
//   - Toplam = kalemler; her süzgeç (7/30/60/90 gün, aralık, başlangıca kadar beklenen, gecikmişleri başlangıca ekle, gün/hafta/ay); PDF ve Excel aynı satırlar;
//     yetki aynı (Finans Raporları = overview.view; yoksa 403).
// "Nasıl bozulur?" (iş başında yazıldı): (1) vadeli borç hem faturasız alacak (kayıt günü) hem cari kalemi (vade günü) olarak iki kez; (2) kartın kapsadığı borç
// hem taksit hem cari kalemi; (3) tedarikçideki elle Alacak giriş sayılır; (4) müşterideki vadeli elle Alacak çıkış olur VE bakiyeden de düşer (iki kez); (5) Beklenen
// Ödeme Tarihi yerine Vade Tarihi; (6) kısmi tahsilat kalanı yerine kayıt tutarı; tahsilat silinince kalem geri gelmez; (7) vadesiz kalan, yeni vadeli kaydın gününe
// düşer (faturasız alacağın tarihi yanlış); (8) aralık / başlangıca kadar / gecikmiş / dönem toplamları kalemlerle tutmaz; (9) ay sonu, yıl dönümü, gün değişimi
// (sahte saat); (10) silinmiş cari, 002 şirketi, boş veri; (11) yetkisiz kullanıcı; (12) takvim / Vade Takip ile ayrı hesap (ortak yardımcı dışı).
// Sahte DURAĞAN saat (ders 13; aynı tarihli kayıtların sırası yazım sırası, ders 31).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
  patch: async (url, body) => unwrap(await client.patch(url, body)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const cents = value => Math.round((Number(value) || 0) * 100);
const sum = (rows, direction) => rows.filter(row => row.direction === direction).reduce((total, row) => total + cents(row.amount), 0) / 100;
const net = rows => Math.round((sum(rows, "in") - sum(rows, "out")) * 100) / 100;
const show = rows => JSON.stringify(rows.map(row => ({ source: row.source, date: row.date, direction: row.direction, amount: row.amount, label: row.label })));

function harness(NOW) {
  const TODAY = NOW.slice(0, 10);
  const day = offset => {
    const at = new Date(`${TODAY}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + offset);
    return at.toISOString().slice(0, 10);
  };
  const ctx = { TODAY, day, n: 0 };
  ctx.start = async () => {
    ctx.server = await startTestServer({ now: { time: NOW, fixed: true }, legacyCasePayments: false, legacyTableTransfer: false }); // K1.2: 2.4.5+ davranışı
    ctx.api = apiOf(await loginAdmin(ctx.server));
    await ctx.api.post("/api/workspace/bank/setup/dismiss", {});
    ctx.item = (await ctx.api.post("/api/workspace/stock", { kind: "service", code: `HZM-246-${TODAY}`, name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
  };
  ctx.account = async (label, extra = {}) => must(`cari ${label}`, ctx.api.post("/api/workspace/accounts", { name: `Projeksiyon ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 246 11 ${String((ctx.n += 1)).padStart(2, "0")}`, ...extra }));
  ctx.entry = async (acc, body) => {
    const before_ = new Set((await must("kart", ctx.api.get(`/api/workspace/accounts/${acc.id}`))).entries.map(row => row.id));
    const result = await must(`hareket ${body.kind}`, ctx.api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", ...body }));
    const created = result.entries.filter(row => !before_.has(row.id));
    assert.equal(created.length, 1, "bir satır yazıldı");
    return created[0];
  };
  ctx.card = async acc => must("kart", ctx.api.get(`/api/workspace/accounts/${acc.id}`));
  ctx.flow = async (query = "preset=next30", client = ctx.api) => must(`nakit akış ${query}`, client.get(`/api/workspace/overview/nakit-akisi?${query}`));
  // Bir carinin projeksiyon satırları (aralıktakiler + gecikmişler + başlangıca kadar beklenenler ayrı tutulur): cari kalemi ve faturasız alacak (ref cari),
  // ayrıca carinin fatura ve taksit kartı kimlikleri verilirse onların satırları.
  ctx.mine = (data, acc, refIds = []) => [...data.rows, ...data.overdue].filter(row => (row.ref?.type === "account" && row.ref.id === acc.id) || refIds.includes(row.ref?.id));
  ctx.sale = async (acc, date, amount, dueDate = date) => {
    const doc = await must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: ctx.item.id, qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open", dueDate } }));
    return must("fatura oku", ctx.api.get(`/api/workspace/invoices/${doc.id}`));
  };
  return ctx;
}

describe("2.4.6 madde 11: Nakit Akış Projeksiyonu'na cari vadeli borç kalemleri", () => {
  const t = harness("2026-10-20T12:00:00+03:00");
  const { day, TODAY } = t;
  before(t.start);
  after(async () => t.server?.close());

  it("vadeli elle Borç: Vade Tarihi'nde giriş kalemi (Cari (vadeli), Tahsil Edilecek Borç); faturasız cari alacağı olarak ikinci kez yok; carinin Σ = bakiye", async () => {
    const acc = await t.account("Temel");
    const debt = await t.entry(acc, { kind: "debt", amount: "1.000", date: day(-10), dueDate: day(12), note: "vadeli borç" });
    const data = await t.flow("preset=next30");
    const mine = t.mine(data, acc);
    const vade = mine.filter(row => row.source === "account");
    assert.deepEqual(vade.map(row => [row.date, row.direction, row.amount, row.label, row.party, row.ref?.entryId]), [[day(12), "in", 1000, "Tahsil Edilecek Borç", acc.name, debt.id]], `projeksiyonda carinin vadeli borcu kendi vadesinde yok; bu carinin satırları: ${show(mine)}`);
    assert.deepEqual(mine.filter(row => row.source === "unbilled"), [], `aynı borç "Faturasız Cari Alacağı" olarak ikinci kez sayılmamalı: ${show(mine)}`);
    assert.equal(net(mine), (await t.card(acc)).totals.balance, "carinin projeksiyondaki net tutarı = cari bakiyesi");
    assert.equal(data.bySource["account:in"] >= 1000, true, "bySource cari kalemini sayar");
  });

  it("Beklenen Ödeme Tarihi girilmişse kalem o gündedir (Ödeme Sözü), Vade Tarihi'nde değil; Beklenen Ödeme Vade'den önce de olabilir (K6.5 (4))", async () => {
    const acc = await t.account("Soz");
    await t.entry(acc, { kind: "debt", amount: "750", date: day(-3), dueDate: day(20), expectedDate: day(5) });
    const mine = t.mine(await t.flow("preset=next30"), acc);
    assert.deepEqual(mine.map(row => [row.source, row.date, row.amount, row.label]), [["account", day(5), 750, "Tahsil Edilecek Borç (Ödeme Sözü)"]], `söz günü: ${show(mine)}`);
  });

  it("FIFO kalanı: kısmi tahsilat kalemi küçültür; tahsilat silinince kalem büyür ve vadesiz borcun kalanı KENDİ gününde faturasız alacak olur; tam tahsilatta kalem yok", async () => {
    const acc = await t.account("FIFO");
    await t.entry(acc, { kind: "debt", amount: "300", date: day(-30), note: "vadesiz eski borç" });
    const dated = await t.entry(acc, { kind: "debt", amount: "1.000", date: TODAY, dueDate: day(15) });
    const paid = await t.entry(acc, { kind: "in", amount: "500", date: day(-5) });
    let mine = t.mine(await t.flow("preset=next30"), acc);
    assert.deepEqual(mine.map(row => [row.source, row.date, row.amount]), [["account", day(15), 800]], `500 tahsilat önce eski 300'ü, sonra 200 vadeliyi kapatır (FIFO): ${show(mine)}`);
    await must("tahsilatı sil", t.api.del(`/api/workspace/accounts/${acc.id}/entries/${paid.id}`));
    mine = t.mine(await t.flow("preset=next30"), acc);
    const sorted = list => [...list].sort((a, b) => a.join("|").localeCompare(b.join("|")));
    assert.deepEqual(sorted(mine.map(row => [row.source, row.date, row.amount])), sorted([["account", day(15), 1000], ["unbilled", day(-30), 300]]), `vadesiz 300 kendi kayıt gününde (vadeli kaydın günü ${TODAY} değil): ${show(mine)}`);
    assert.equal(net(mine), (await t.card(acc)).totals.balance);
    await t.entry(acc, { kind: "in", amount: "1.300", date: day(-1) });
    mine = t.mine(await t.flow("preset=next30"), acc);
    assert.deepEqual(mine, [], `bakiye 0: kalem yok: ${show(mine)}`);
    assert.equal((await t.card(acc)).entries.find(row => row.id === dated.id).remaining, 0);
  });

  it("tedarikçideki elle Alacak ve alacak yönlü Açılış Bakiyesi: vadesinde ÇIKIŞ (Ödenecek Borç); ödeme kalemi küçültür", async () => {
    // Kasa eksiye düşmesin (ödeme nakit): ayrı caride eski tarihli tahsilat (alacaklı cari; projeksiyon satırı doğurmaz).
    await t.entry(await t.account("Kasa Besleme"), { kind: "in", amount: "5.000", date: day(-60) });
    const supplier = await t.account("Tedarikci", { type: "supplier" });
    const owed = await t.entry(supplier, { kind: "credit", amount: "900", date: day(-20), dueDate: day(4) });
    let mine = t.mine(await t.flow("preset=next30"), supplier);
    assert.deepEqual(mine.map(row => [row.source, row.date, row.direction, row.amount, row.label, row.ref?.entryId]), [["account", day(4), "out", 900, "Ödenecek Borç", owed.id]], `tedarikçiye borç vadesinde çıkış: ${show(mine)}`);
    await t.entry(supplier, { kind: "out", amount: "400", date: day(-2) });
    mine = t.mine(await t.flow("preset=next30"), supplier);
    assert.deepEqual(mine.map(row => [row.source, row.direction, row.amount]), [["account", "out", 500]]);
    const opening = await must("açılışlı tedarikçi", t.api.post("/api/workspace/accounts", { name: "Projeksiyon Acilis Tedarikci", type: "supplier", registeredOn: day(-30), openingBalance: "800", openingDueDate: day(2), openingExpectedDate: day(9) }));
    mine = t.mine(await t.flow("preset=next30"), opening);
    assert.deepEqual(mine.map(row => [row.source, row.date, row.direction, row.amount, row.label]), [["account", day(9), "out", 800, "Ödenecek Borç (Ödeme Sözü)"]]);
    assert.equal(net(mine), (await t.card(opening)).totals.balance, "tedarikçinin net tutarı = bakiyesi (eksi)");
  });

  it("KS2: müşterideki vadeli elle Alacak çıkış kalemidir, müşterinin borcundan düşülmez; bakiyede ikinci kez düşülmez (carinin net = bakiye)", async () => {
    const acc = await t.account("KS2");
    await t.entry(acc, { kind: "debt", amount: "1.000", date: day(-15) });
    const credit = await t.entry(acc, { kind: "credit", amount: "300", date: day(-10), dueDate: day(6) });
    let mine = t.mine(await t.flow("preset=next30"), acc);
    assert.deepEqual(mine.filter(row => row.source === "account").map(row => [row.date, row.direction, row.amount, row.ref?.entryId]), [[day(6), "out", 300, credit.id]], `vadeli elle Alacak çıkış kalemi: ${show(mine)}`);
    assert.deepEqual(mine.filter(row => row.source === "unbilled").map(row => [row.date, row.amount]), [[day(-15), 1000]], `müşterinin vadesiz borcu (1.000) kayıt gününde, 300 düşülmeden: ${show(mine)}`);
    assert.equal(net(mine), 700, "net = bakiye 700 (300 iki kez düşülmez)");
    const both = await t.account("KS2 Iki Vade");
    await t.entry(both, { kind: "debt", amount: "1.000", date: day(-15), dueDate: day(9) });
    await t.entry(both, { kind: "credit", amount: "300", date: day(-10), dueDate: day(6) });
    mine = t.mine(await t.flow("preset=next30"), both);
    assert.deepEqual(mine.map(row => [row.source, row.date, row.direction, row.amount]).sort(), [["account", day(6), "out", 300], ["account", day(9), "in", 1000]].sort(), show(mine));
    assert.equal(net(mine), (await t.card(both)).totals.balance);
  });

  it("K6.5 (1): Mevcut Borç kartının kapsadığı kısım kartın taksitleriyle BİR kez; kapsanmayan kalan cari kalemidir", async () => {
    const full = await t.account("Kart Tam");
    const coveredDebt = await t.entry(full, { kind: "debt", amount: "900", date: day(-30), dueDate: day(1) });
    const cover = await must("mevcut borç kartı", t.api.post("/api/workspace/plans", { name: full.name, registeredOn: day(-20), total: "900", accountId: full.id, mode: "auto", count: "3", firstDue: day(5), coversBalance: true }));
    let mine = t.mine(await t.flow("preset=next90"), full, [cover.id]);
    assert.equal(mine.some(row => row.source === "account" || row.source === "unbilled"), false, `kapsanan borç cari kalemi / faturasız alacak değil: ${show(mine)}`);
    assert.deepEqual(mine.filter(row => row.source === "plan").map(row => row.amount), [300, 300, 300], "kartın üç taksiti");
    assert.equal(net(mine), 900);
    assert.equal((await t.card(full)).entries.find(row => row.id === coveredDebt.id).remaining, 900, "borç ödenmedi (Kalan kapsananı içerir)");
    const part = await t.account("Kart Kismi");
    await t.entry(part, { kind: "debt", amount: "1.000", date: day(-30), dueDate: day(2) });
    const partial = await must("kısmi kart", t.api.post("/api/workspace/plans", { name: part.name, registeredOn: day(-20), total: "600", accountId: part.id, mode: "auto", count: "2", firstDue: day(10), coversBalance: true }));
    mine = t.mine(await t.flow("preset=next90"), part, [partial.id]);
    assert.deepEqual(mine.filter(row => row.source === "account").map(row => [row.date, row.amount]), [[day(2), 400]], `kapsanmayan 400 vadesinde: ${show(mine)}`);
    assert.deepEqual(mine.filter(row => row.source === "unbilled"), [], show(mine));
    assert.equal(net(mine), 1000, "kart 600 + cari kalemi 400 = borç (bir kez)");
  });

  it("karışık kuyruk: vadeli borç + vadeli satış faturası + tahsilat → fatura açığı ve borç kalanı kendi vadelerinde; Σ = bakiye, faturasız alacak yok", async () => {
    const acc = await t.account("Karisik");
    await t.entry(acc, { kind: "debt", amount: "1.000", date: day(-30), dueDate: day(-20) });
    const invoice = await t.sale(acc, day(-20), 2000, day(25));
    const late = await t.entry(acc, { kind: "debt", amount: "500", date: day(-10), dueDate: day(3) });
    await t.entry(acc, { kind: "in", amount: "1.500", date: day(-5) });
    const mine = t.mine(await t.flow("preset=next30"), acc, [invoice.id]);
    assert.deepEqual(mine.map(row => [row.source, row.date, row.amount]).sort(), [["account", day(3), 500], ["invoice", day(25), 1500]].sort(), `${show(mine)} (late ${late.id})`);
    assert.equal(net(mine), (await t.card(acc)).totals.balance);
  });

  it("toplam = kalemler, her süzgeç: 7/30/60/90 gün, aralık + başlangıca kadar beklenen, gecikmişleri başlangıca ekle, gün / hafta / ay toplamları", async () => {
    const acc = await t.account("Suzgec");
    const near = await t.entry(acc, { kind: "debt", amount: "111", date: day(-1), dueDate: day(3) });
    const mid = await t.entry(acc, { kind: "debt", amount: "222", date: day(-1), dueDate: day(15) });
    const far = await t.entry(acc, { kind: "debt", amount: "333", date: day(-1), dueDate: day(45) });
    const late = await t.entry(acc, { kind: "debt", amount: "444", date: day(-9), dueDate: day(-3) });
    const ids = data => [...data.rows.filter(row => row.source === "account" && row.ref?.id === acc.id)].map(row => row.ref.entryId).sort();
    const check = (data, label) => {
      assert.equal(data.totals.in, sum(data.rows, "in"), `${label}: Beklenen Giriş = satırlar`);
      assert.equal(data.totals.out, sum(data.rows, "out"), `${label}: Beklenen Çıkış = satırlar`);
      assert.equal(data.closing, Math.round((data.opening + data.totals.in - data.totals.out) * 100) / 100, `${label}: dönem sonu = başlangıç + giriş − çıkış`);
      assert.equal(data.overdueTotals.in, sum(data.overdue, "in"), `${label}: gecikmiş toplam = gecikmiş satırlar`);
      for (const row of data.rows) assert.ok(row.date >= data.from && (!data.to || row.date <= data.to), `${label}: aralık dışı satır ${row.date}`);
    };
    const expect = { next7: [near.id], next30: [near.id, mid.id], next60: [near.id, mid.id, far.id], next90: [near.id, mid.id, far.id] };
    for (const [preset, wanted] of Object.entries(expect)) {
      const data = await t.flow(`preset=${preset}`);
      check(data, preset);
      assert.deepEqual(ids(data), [...wanted].sort(), `${preset}: aralıktaki cari kalemleri`);
      assert.ok(data.overdue.some(row => row.source === "account" && row.ref?.entryId === late.id && row.amount === 444), `${preset}: vadesi geçmiş kalem gecikmişlerde`);
    }
    // Aralık bugünden sonra başlar: öncesindeki kalem "başlangıca kadar beklenen"e girer.
    const later = await t.flow(`from=${day(10)}&to=${day(20)}`);
    check(later, "aralık");
    assert.deepEqual(ids(later), [mid.id], "10–20 gün aralığında yalnız 15. gün");
    const plain = await t.flow(`from=${TODAY}&to=${day(20)}`);
    const before10 = plain.rows.filter(row => row.date < day(10));
    assert.equal(later.carried.in, sum(before10, "in"), "başlangıca kadar beklenen giriş = bugün–9. gün satırları (cari kalemi dahil)");
    assert.equal(later.opening, Math.round((later.cashToday + later.carried.in - later.carried.out) * 100) / 100);
    const withOverdue = await t.flow("preset=next30&overdue=1");
    check(withOverdue, "gecikmişler dahil");
    assert.equal(withOverdue.opening, Math.round((withOverdue.cashToday + withOverdue.overdueTotals.in - withOverdue.overdueTotals.out) * 100) / 100, "gecikmişler (cari kalemi 444 dahil) başlangıca eklendi");
    const base = await t.flow("preset=next90");
    for (const group of ["day", "week", "month"]) {
      const data = await t.flow(`preset=next90&group=${group}`);
      check(data, group);
      assert.equal(data.periods.reduce((total, period) => total + cents(period.in), 0) / 100, data.totals.in, `${group}: dönem girişleri = Beklenen Giriş`);
      assert.equal(data.periods.reduce((total, period) => total + cents(period.out), 0) / 100, data.totals.out, `${group}: dönem çıkışları = Beklenen Çıkış`);
      assert.equal(data.periods.at(-1).closing, data.closing, `${group}: son dönem = dönem sonu`);
      assert.deepEqual([data.totals, data.closing], [base.totals, base.closing], `${group}: görünüm toplamı değiştirmez`);
    }
  });

  it("PDF ve Excel aynı satırları yazar: 'Cari (vadeli)' kaynaklı kalem Nakit Akışı ve Gecikmiş sayfalarında, tutarıyla", async () => {
    const acc = await t.account("Cikti");
    await t.entry(acc, { kind: "debt", amount: "1.357,24", date: day(-2), dueDate: day(8) });
    await t.entry(acc, { kind: "debt", amount: "246,80", date: day(-9), dueDate: day(-4) });
    const xlsx = await t.api.client.raw("GET", "/api/workspace/overview/nakit-akisi.xlsx?preset=next30");
    assert.equal(xlsx.status, 200);
    const sheets = xlsxSheets(xlsx.buffer);
    const flowSheet = sheets["Nakit Akışı"].map(row => row.join("|"));
    // Excel tutarı sayı hücresi olarak yazar (1357.24).
    const has = (row, amount) => row.split("|").some(cell => Number(cell) === amount);
    assert.ok(flowSheet.some(row => row.includes("Cari (vadeli)") && row.includes("Tahsil Edilecek Borç") && row.includes(acc.name) && has(row, 1357.24)), `Excel Nakit Akışı sayfasında cari kalemi yok: ${flowSheet.filter(row => row.includes(acc.name)).join(" / ")}`);
    const lateSheet = sheets["Gecikmiş"].map(row => row.join("|"));
    assert.ok(lateSheet.some(row => row.includes("Cari (vadeli)") && row.includes(acc.name) && has(row, 246.8)), `Excel Gecikmiş sayfasında cari kalemi yok: ${lateSheet.filter(row => row.includes(acc.name)).join(" / ")}`);
    const pdf = await t.api.client.raw("GET", "/api/workspace/overview/nakit-akisi.pdf?preset=next30");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer);
    assert.ok(text.includes("Cari (vadeli)") && text.includes("1.357,24"), "PDF'te cari kalemi (kaynak adı ve tutar)");
  });

  it("ortak yardımcı: projeksiyonun cari kalemleri = Vade Takip'in cari kalemleri (aynı aralık) = zil / takvim kalemleri (7 gün); kimlik, gün, yön, etiket, tutar", async () => {
    const acc = await t.account("Ortak");
    await t.entry(acc, { kind: "debt", amount: "640", date: day(-6), dueDate: day(2), expectedDate: day(1) });
    await t.entry(acc, { kind: "debt", amount: "520", date: day(-6), dueDate: day(19) });
    await t.entry(acc, { kind: "credit", amount: "130", date: day(-6), dueDate: day(-2) });
    await t.entry(acc, { kind: "in", amount: "40", date: day(-1) });
    const key = row => [row.id, row.date ?? row.dueDate, row.direction, row.label, row.amount].join("|");
    const flow = await t.flow("preset=next30");
    const fromFlow = [...flow.rows, ...flow.overdue].filter(row => row.source === "account").map(key).sort();
    const vade = await must("vade takip", t.api.get("/api/workspace/overview/vade-takip?preset=next30&sources=account"));
    assert.deepEqual(fromFlow, vade.rows.filter(row => row.source === "account").map(key).sort(), "projeksiyon ↔ Vade Takip (aynı aralık: gecikmişler + 30 gün)");
    const dues = await must("takvim", t.api.get("/api/workspace/dues"));
    const week = [...flow.rows, ...flow.overdue].filter(row => row.source === "account" && row.date <= day(7)).map(key).sort();
    assert.deepEqual(week, dues.items.filter(row => row.source === "account").map(key).sort(), "projeksiyon (7 güne kadar) ↔ zil / takvim");
    assert.ok(fromFlow.some(row => row.includes("Tahsil Edilecek Borç (Ödeme Sözü)") && row.includes(day(1))), "testin dişi: söz kalemi listede");
  });

  it("yetki: Finans Raporları (overview.view) yoksa 403 (ekran, PDF, Excel); cari kalemi yalnız Cari görüntüleme (accounts.view) yetkisi olana — yoksa aynı borç bir kez, faturasız alacakta", async () => {
    const acc = await t.account("Yetki");
    await t.entry(acc, { kind: "debt", amount: "100", date: day(-2), dueDate: day(1) });
    const personel = await createUser(t.server, t.api.client, { username: "projeksiyon-personel", role: "personel" });
    for (const url of ["/api/workspace/overview/nakit-akisi?preset=next30", "/api/workspace/overview/nakit-akisi.pdf?preset=next30", "/api/workspace/overview/nakit-akisi.xlsx?preset=next30"]) {
      assert.equal((await personel.get(url)).status, 403, `${url}: Finans Raporları yetkisi olmayan kişiye 403`);
    }
    const muhasebe = apiOf(await createUser(t.server, t.api.client, { username: "projeksiyon-muhasebe", role: "muhasebe" }));
    const withRight = await t.flow("preset=next30&overdue=1", muhasebe);
    assert.deepEqual(t.mine(withRight, acc).map(row => [row.source, row.date, row.amount]), [["account", day(1), 100]], "muhasebe (Finans Raporları + Cari görüntüleme) cari kalemini görür");
    // Ana oturum kararı (25.10.2026): projeksiyondaki cari kalemi zil / takvim / Vade Takip gibi yalnız Cari görüntüleme yetkisiyle. Yetkisi olmayanın projeksiyonu 2.4.5'teki
    // gibidir: carinin vadeli borcu BİR kez, faturasız cari alacağında (kayıt gününde) — vade ve söz tarihi (cari kartının bilgisi) görünmez; carinin vadeli alacağı
    // (tedarikçiye elle borç) 2.4.5'te olduğu gibi projeksiyonda yoktur.
    const users = await must("kullanıcılar", t.api.get("/api/admin/users"));
    await must("yetki kaldır", t.api.patch(`/api/admin/users/${users.find(user => user.username === "projeksiyon-muhasebe").id}`, { grants: { add: [], remove: ["accounts.view"] } }));
    const without = await t.flow("preset=next30&overdue=1", muhasebe);
    assert.equal([...without.rows, ...without.overdue].some(row => row.source === "account"), false, "Cari görüntüleme yok: projeksiyonda cari kalemi yok (hiçbir caride)");
    assert.deepEqual(t.mine(without, acc).map(row => [row.source, row.date, row.amount]), [["unbilled", day(-2), 100]], "aynı borç bir kez, faturasız cari alacağında");
    assert.equal(net(t.mine(without, acc)), net(t.mine(withRight, acc)), "bu carinin projeksiyondaki tutarı aynı (yalnız yeri: kayıt günü ↔ vade)");
    const xlsx = await muhasebe.client.raw("GET", "/api/workspace/overview/nakit-akisi.xlsx?preset=next30");
    assert.equal(xlsx.status, 200);
    assert.equal(Object.values(xlsxSheets(xlsx.buffer)).flat().some(row => row.includes("Cari (vadeli)")), false, "Excel'de de cari kalemi yok");
  });

  it("bir kez: Σ (cari kalemi + faturasız cari alacağı + kartın taksitleri) = carilerin açık bakiyesi; vadeli borç faturasız alacakta YOK, vadesiz borç orada", async () => {
    const accounts = [];
    const vadeli = [];
    const a = await t.account("Bir Kez A");
    vadeli.push(await t.entry(a, { kind: "debt", amount: "1.000", date: day(-40), dueDate: day(10) }));
    await t.entry(a, { kind: "debt", amount: "250", date: day(-35), note: "vadesiz" });
    await t.entry(a, { kind: "in", amount: "600", date: day(-5) });
    accounts.push(a);
    const b = await t.account("Bir Kez B");
    vadeli.push(await t.entry(b, { kind: "debt", amount: "2.000", date: day(-30), dueDate: day(-6) }));
    vadeli.push(await t.entry(b, { kind: "debt", amount: "700", date: day(-20), dueDate: day(40), expectedDate: day(14) }));
    accounts.push(b);
    const c = await t.account("Bir Kez C");
    vadeli.push(await t.entry(c, { kind: "debt", amount: "1.200", date: day(-30), dueDate: day(3) }));
    const card = await must("kart", t.api.post("/api/workspace/plans", { name: c.name, registeredOn: day(-25), total: "500", accountId: c.id, mode: "auto", count: "1", firstDue: day(20), coversBalance: true }));
    // Kart "açıldığı anda açık" borcu kapsar (kayıt anı); durağan sahte saatte sonraki satır aynı anı alırdı (ders 14: gerçekte sonra yazılır) → bir dakika ilerle.
    t.server.clock.advance({ minutes: 1 });
    await t.entry(c, { kind: "debt", amount: "90", date: day(-2), note: "karttan sonra vadesiz" });
    accounts.push(c);
    const data = await t.flow(`from=${TODAY}&to=${day(3650)}`);
    const rows = accounts.flatMap(acc => t.mine(data, acc, acc === c ? [card.id] : []));
    const balances = (await Promise.all(accounts.map(acc => t.card(acc)))).reduce((sum, acc) => sum + cents(acc.totals.balance), 0) / 100;
    const unbilled = rows.filter(row => row.source === "unbilled");
    assert.equal(net(rows), balances, `Σ projeksiyon = Σ cari açık (${balances}) — bir kez; satırlar ${show(rows)} (faturasız alacak toplamı ${sum(unbilled, "in")})`);
    for (const entry of vadeli) assert.equal(rows.filter(row => row.ref?.entryId === entry.id).length <= 1, true, "her vadeli kayıt en çok bir satır");
    assert.deepEqual(unbilled.map(row => [row.party, row.date, row.amount]).sort(), [[a.name, day(-35), 250], [c.name, day(-2), 90]].sort(), `faturasız alacakta yalnız vadesiz borçlar, kendi günleriyle: ${show(unbilled)}`);
    assert.deepEqual(rows.filter(row => row.source === "account").map(row => [row.party, row.date, row.amount]).sort(), [[a.name, day(10), 400], [b.name, day(-6), 2000], [b.name, day(14), 700], [c.name, day(3), 700]].sort(), "vadeli kalemler (A: 600 tahsilat en eski 1.000'i kapatır → 400; C'de kartın kapsadığı 500 düşülmüş)");
    assert.deepEqual(rows.filter(row => row.source === "plan").map(row => [row.date, row.amount]), [[day(20), 500]], "kartın kapsadığı kısım kartın taksidiyle bir kez");
  });

  it("bir kez (açık alış faturası; 2.4.3 MM5'ten kalan çift sayım): alış faturası kendi vadesinde çıkış, faturasız alacakta ikinci kez düşülmez; tedarikçinin vadesiz borcu kaybolmaz", async () => {
    const purchase = async (acc, number, amount, date, dueDate) => must(`alış ${number}`, t.api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: acc.id, number, issueDate: date, lines: [{ name: "Danışmanlık", expenseCode: "advisory", qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open", dueDate } }));
    const rowsOf = list => list.map(row => [row.source, row.date, row.direction, row.amount]).sort((a, b) => a.join("|").localeCompare(b.join("|")));
    const sorted = list => [...list].sort((a, b) => a.join("|").localeCompare(b.join("|")));
    // Müşteri: vadesiz Borç 1.000 + açık vadeli alış faturası 300 → bakiye 700; projeksiyon: faturasız alacak 1.000 (300 düşülmeden) + alış çıkışı 300 = net 700.
    const customer = await t.account("Karma Musteri");
    await t.entry(customer, { kind: "debt", amount: "1.000", date: day(-19) });
    const p1 = await purchase(customer, "AL-246-1", 300, day(-15), day(16));
    let mine = t.mine(await t.flow("preset=next30"), customer, [p1.id]);
    assert.equal(net(mine), (await t.card(customer)).totals.balance, `müşteri carisinde net = bakiye (alış faturası bir kez): ${show(mine)}`);
    assert.deepEqual(rowsOf(mine), sorted([["invoice", day(16), "out", 300], ["unbilled", day(-19), "in", 1000]]), show(mine));
    // Tedarikçi: açık vadeli alış 1.000 + vadesiz elle Borç 200 (tedarikçinin bize borcu) → bakiye −800; faturasız alacak 200 artık kaybolmaz.
    const supplier = await t.account("Karma Tedarikci", { type: "supplier" });
    const p2 = await purchase(supplier, "AL-246-2", 1000, day(-12), day(20));
    await t.entry(supplier, { kind: "debt", amount: "200", date: day(-5) });
    mine = t.mine(await t.flow("preset=next30"), supplier, [p2.id]);
    assert.equal(net(mine), (await t.card(supplier)).totals.balance, `tedarikçide net = bakiye: ${show(mine)}`);
    assert.deepEqual(rowsOf(mine), sorted([["invoice", day(20), "out", 1000], ["unbilled", day(-5), "in", 200]]), show(mine));
    // İkisi birlikte: vadesiz Borç 500 + açık alış 100 + vadeli elle Alacak 50 → bakiye 350; çıkışlar 100 + 50, faturasız alacak 500.
    const both = await t.account("Karma Iki Cikis");
    await t.entry(both, { kind: "debt", amount: "500", date: day(-10) });
    const p3 = await purchase(both, "AL-246-3", 100, day(-9), day(10));
    await t.entry(both, { kind: "credit", amount: "50", date: day(-8), dueDate: day(5) });
    mine = t.mine(await t.flow("preset=next30"), both, [p3.id]);
    assert.equal(net(mine), (await t.card(both)).totals.balance, `alış + vadeli elle Alacak birlikte: net = bakiye: ${show(mine)}`);
    assert.deepEqual(rowsOf(mine), sorted([["account", day(5), "out", 50], ["invoice", day(10), "out", 100], ["unbilled", day(-10), "in", 500]]), show(mine));
  });

  it("gecikmiş vadeli kalem takvimdeki gibi görünür: 'Vadesi geçmiş, kapanmamış' listesinde (gün, tutar, kimlik takvimle aynı); 'başlangıca ekle' ile başlangıca girer", async () => {
    const acc = await t.account("Gecikmis");
    const late = await t.entry(acc, { kind: "debt", amount: "815", date: day(-30), dueDate: day(-12) });
    const promised = await t.entry(acc, { kind: "debt", amount: "185", date: day(-30), dueDate: day(9), expectedDate: day(-1) });
    const dues = (await must("takvim", t.api.get("/api/workspace/dues"))).items.filter(row => row.accountId === acc.id);
    assert.deepEqual(dues.map(row => [row.entryId, row.state]).sort(), [[late.id, "overdue"], [promised.id, "overdue"]].sort(), "takvimde ikisi de gecikmiş");
    const plain = await t.flow("preset=next7");
    const overdue = plain.overdue.filter(row => row.ref?.id === acc.id);
    assert.deepEqual(overdue.map(row => [row.id, row.source, row.date, row.amount]).sort(), dues.map(row => [row.id, "account", row.dueDate, row.amount]).sort(), `gecikmişlerde takvimle aynı kalemler: ${show(overdue)}`);
    assert.equal(plain.rows.some(row => row.ref?.id === acc.id), false, "aralıkta değil (vadesi geçti)");
    const added = await t.flow("preset=next7&overdue=1");
    assert.equal(Math.round((added.opening - plain.opening) * 100) / 100, Math.round((plain.overdueTotals.in - plain.overdueTotals.out) * 100) / 100, "başlangıca ekle: gecikmişler (bu carinin 1.000'i dahil) başlangıca girer");
    assert.ok(plain.overdueTotals.in >= 1000);
  });

  it("pencere iki ucu kapalı (K-P1): son gündeki kalem dahil, ertesi gün değil; aralığın ilk günündeki kalem dahil", async () => {
    const acc = await t.account("Pencere");
    const last = await t.entry(acc, { kind: "debt", amount: "30", date: day(-1), dueDate: day(30) });
    const next = await t.entry(acc, { kind: "debt", amount: "31", date: day(-1), dueDate: day(31) });
    const first = await t.entry(acc, { kind: "debt", amount: "12", date: day(-1), dueDate: day(12) });
    const today = await t.entry(acc, { kind: "credit", amount: "5", date: day(-1), expectedDate: TODAY });
    const at = (data, entry) => (data.rows.some(row => row.ref?.entryId === entry.id) ? "aralık" : data.overdue.some(row => row.ref?.entryId === entry.id) ? "gecikmiş" : data.carried.in || data.carried.out ? "dışarıda/başlangıca kadar" : "yok");
    const next30 = await t.flow("preset=next30");
    assert.equal(next30.to, day(30));
    assert.deepEqual([last, next, first, today].map(entry => at(next30, entry)), ["aralık", "yok", "aralık", "aralık"], "30 gün: 30. gün dahil, 31. gün yok; bugünkü kalem aralıkta");
    const custom = await t.flow(`from=${day(12)}&to=${day(30)}`);
    assert.deepEqual([last, first].map(entry => at(custom, entry)), ["aralık", "aralık"], "özel aralık: ilk gün (12) ve son gün (30) dahil");
    assert.equal(custom.rows.some(row => row.ref?.entryId === today.id), false, "bugünkü kalem aralığın başından önce: başlangıca kadar beklenenlerde");
    const narrow = await t.flow(`from=${day(13)}&to=${day(29)}`);
    assert.deepEqual([last, first].map(entry => at(narrow, entry)).map(value => value === "aralık"), [false, false], "13–29: iki uçtaki kalem dışarıda");
  });

  it("cari silinince kalemi de faturasız alacağı da yok; geri yüklenince döner", async () => {
    const acc = await t.account("Silinen");
    await t.entry(acc, { kind: "debt", amount: "55", date: day(-2), dueDate: day(1) });
    assert.equal(t.mine(await t.flow(), acc).length, 1);
    const removed = await t.api.del(`/api/workspace/accounts/${acc.id}`);
    assert.equal(removed.status, 200, `cari silinemedi: ${JSON.stringify(removed.data).slice(0, 200)}`);
    assert.deepEqual(t.mine(await t.flow(), acc), [], "silinmiş carinin projeksiyon satırı yok");
    const trash = await must("Silinenler", t.api.get("/api/admin/trash"));
    await must("geri yükle", t.api.post("/api/admin/trash/restore", { id: trash.find(row => row.kind === "account" && row.title === acc.name).id }));
    assert.deepEqual(t.mine(await t.flow(), acc).map(row => [row.source, row.amount]), [["account", 55]]);
  });

  it("002 şirketi: boş veri (satır yok, toplamlar 0); kalemler şirkete ayrı", async () => {
    const acc = await t.account("Sirket001");
    await t.entry(acc, { kind: "debt", amount: "80", date: day(-2), dueDate: day(1) });
    const companies = await must("şirketler", t.api.get("/api/companies"));
    const first = (companies.companies || companies).find(row => row.current) || (companies.companies || companies)[0];
    const second = await must("002", t.api.post("/api/companies", { name: "Projeksiyon İkinci Şirket", select: false }));
    await must("002 seç", t.api.post("/api/companies/select", { id: second.id || second.company?.id }));
    try {
      await t.api.post("/api/workspace/bank/setup/dismiss", {});
      const empty = await t.flow("preset=next30&overdue=1");
      assert.deepEqual([empty.rows.length, empty.overdue.length, empty.totals.in, empty.totals.out, empty.closing], [0, 0, 0, 0, 0], "boş şirket: satır yok, toplam 0");
      const other = await must("002 cari", t.api.post("/api/workspace/accounts", { name: "Projeksiyon 002", type: "customer", registeredOn: day(-30), openingBalance: "90", openingDueDate: day(2) }));
      const data = await t.flow("preset=next30&overdue=1");
      assert.deepEqual([...data.rows, ...data.overdue].map(row => [row.source, row.ref?.id, row.amount, row.date]), [["account", other.id, 90, day(2)]], "002'de yalnız kendi kalemi (açılış bakiyesinin vadesi)");
    } finally {
      await must("001 seç", t.api.post("/api/companies/select", { id: first.id }));
    }
    assert.ok(t.mine(await t.flow(), acc).some(row => row.source === "account" && row.amount === 80), "001'e dönünce kendi kalemi");
  });
});

describe("2.4.6 madde 11: ay sonu, yıl dönümü ve gün değişimi (sahte saat)", () => {
  const t = harness("2026-12-31T10:00:00+03:00");
  before(t.start);
  after(async () => t.server?.close());

  it("bugün vadeli kalem aralıktadır (gecikmiş değil); yarın (yeni yıl) aralıkta; ay sonu (31 Ocak) 30 günlükte değil 60 günlükte; gün değişince bugünkü kalem gecikmişe geçer", async () => {
    const acc = await t.account("Ay Sonu");
    const today = await t.entry(acc, { kind: "debt", amount: "100", date: "2026-12-01", dueDate: "2026-12-31" });
    const tomorrow = await t.entry(acc, { kind: "debt", amount: "200", date: "2026-12-01", dueDate: "2027-01-01" });
    const monthEnd = await t.entry(acc, { kind: "debt", amount: "300", date: "2026-12-01", dueDate: "2027-02-28", expectedDate: "2027-01-31" });
    const lastMonth = await t.entry(acc, { kind: "debt", amount: "400", date: "2026-11-01", dueDate: "2026-11-30" });
    const at = (data, entry) => (data.rows.some(row => row.ref?.entryId === entry.id) ? "aralık" : data.overdue.some(row => row.ref?.entryId === entry.id) ? "gecikmiş" : "yok");
    const next30 = await t.flow("preset=next30");
    assert.equal(next30.to, "2027-01-30", "30 gün: 30 Ocak'a kadar");
    assert.deepEqual([today, tomorrow, monthEnd, lastMonth].map(entry => at(next30, entry)), ["aralık", "aralık", "yok", "gecikmiş"]);
    const next60 = await t.flow("preset=next60&group=month");
    assert.deepEqual([today, tomorrow, monthEnd, lastMonth].map(entry => at(next60, entry)), ["aralık", "aralık", "aralık", "gecikmiş"]);
    const own = row => row.source === "account" && row.ref?.id === acc.id;
    const december = next60.rows.filter(row => own(row) && row.date.startsWith("2026-12"));
    const january = next60.rows.filter(row => own(row) && row.date.startsWith("2027-01"));
    assert.deepEqual([sum(december, "in"), sum(january, "in")], [100, 500], "Aralık 100; Ocak 200 + 300 (31 Ocak ay sonu)");
    assert.equal(next60.periods.length >= 2, true, "Aralık ve Ocak dönemleri");
    t.server.clock.set("2027-01-01T09:00:00+03:00");
    const moved = await t.flow("preset=next30");
    assert.equal(moved.today, "2027-01-01");
    assert.deepEqual([today, tomorrow, monthEnd, lastMonth].map(entry => at(moved, entry)), ["gecikmiş", "aralık", "aralık", "gecikmiş"], "yeni günde: dünkü kalem gecikmiş, 31 Ocak 30 günlüğe girdi");
  });
});
