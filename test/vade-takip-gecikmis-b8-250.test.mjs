// 2.5.0 BİRLEŞİK TUR 8 — İş 4: Vade Takip'in 'Gecikmiş' hazır aralığı durumu Gecikmiş olan HER kalemi gösterir (S150 = A).
// KARAR (iş listesi D, KULLANICI KARARI 13.11 06:12, AYNEN): "S150 = A — Vade Takip'in 'Gecikmiş' hazır aralığı durumu Gecikmiş olan HER kalemi gösterir (sözü bugün ya da ileride
// olan gecikmiş borç dahil; 'Gecikmiş Tahsilat' göstergesi her aralıkta aynı sayı)". S148 = A (Nakit Akışı: sözü ileride gecikmiş borç söz gününde tek kez) ve S149 = C (vadesi
// gelmemiş, sözü geçmiş borç) DEĞİŞMEZ; elle girilen tarih aralığı ve öbür hazır aralıklar değişmez.
// Kurgu: dokuz hücre (vade −10 / 0 / +10 × söz +15 / 0 / −5; birleşik tur 7 sondasıyla aynı) + tedarikçi yönü (sözlü gecikmiş 70: vade −10, söz +15; sözsüz gecikmiş 30: vade −3).
// Beklenen (S52 / S67 / S69 = A — kalem söz gününde durur, durumu vadeden): durumu Gecikmiş olan tahsil kalemleri v−10 (p15, p0, p−5) + p−5 (v0, v10; S149 = C) = 5 × 100;
// ödeme kalemleri 70 + 30.
// Birleşik tur 8b: 'Bugün' / '7 Gün' / '30 Gün' / '90 Gün' hazır aralıkları da durumu Gecikmiş olan her kalemi gösterir (S150 = A'nın eksik kolu; bu kurguda önce Bugün / 7 Gün
// 400 / 4 tahsilat, 30 / 1 ödeme; sözü 30 / 90 günden ileride olan kalem kurgusu test/vade-takip-gecikmis-b8b-250.test.mjs'te).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

describe("Birleşik tur 8 — İş 4: Vade Takip 'Gecikmiş' hazır aralığı = durumu Gecikmiş olan kalemler (S150 = A)", () => {
  let server;
  let c;
  let pdfText;
  let xlsxRows;
  const get = async url => {
    const res = await c.get(url);
    assert.equal(res.status, 200, `${url}: ${res.status}`);
    return unwrap(res);
  };
  before(async () => {
    ({ pdfText, xlsxRows } = await import("./fixtures/rapor-dosya-oku.mjs"));
    server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    c = await loginAdmin(server);
    await c.post("/api/workspace/bank/setup/dismiss", {});
    let n = 0;
    const account = async (name, type = "customer") => unwrap(await c.post("/api/workspace/accounts", { name, type, registeredOn: day(-400), phone: `0500 779 ${String(10 + n).padStart(2, "0")} ${String((n += 1)).padStart(2, "0")}` }));
    const entry = async (a, body) => assert.equal((await c.post(`/api/workspace/accounts/${a.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body })).status, 200);
    for (const v of [-10, 0, 10]) for (const p of [15, 0, -5]) await entry(await account(`Gecikmiş Hücre v${v} p${p}`), { kind: "debt", amount: "100", date: day(-30), dueDate: day(v), expectedDate: day(p) });
    await entry(await account("Gecikmiş Tedarikçi Sözlü", "supplier"), { kind: "credit", amount: "70", date: day(-30), dueDate: day(-10), expectedDate: day(15) });
    await entry(await account("Gecikmiş Tedarikçi Vadeli", "supplier"), { kind: "credit", amount: "30", date: day(-30), dueDate: day(-3) });
  });
  after(async () => server?.close());

  const key = row => `${row.party}|${row.date}|${row.direction}|${row.amount}`;
  it("'Gecikmiş' aralığı: satırlar = 'Tüm Açık'ın durumu Gecikmiş olan satırları (sözü bugün / ileride olanlar dahil); gösterge 500 / 5 tahsilat, 100 / 2 ödeme", async () => {
    const late = await get("/api/workspace/overview/vade-takip?preset=late");
    const open = await get("/api/workspace/overview/vade-takip?preset=open");
    assert.deepEqual(late.rows.map(key).sort(), open.rows.filter(row => row.state === "overdue" || row.date < TODAY).map(key).sort(), "satır kümesi");
    assert.ok(late.rows.every(row => row.state === "overdue"), "her satırın durumu Gecikmiş");
    assert.ok(late.rows.some(row => row.date >= TODAY), "ön koşul: sözü bugün / ileride olan gecikmiş kalem satırlarda");
    assert.deepEqual([late.totals.in.overdue.amount, late.totals.in.overdue.count, late.totals.out.overdue.amount, late.totals.out.overdue.count], [500, 5, 100, 2]);
    assert.equal(late.to, day(-1), "başlıktaki aralık metni bugünkü gibi (… – dün)");
  });
  it("'Gecikmiş Tahsilat / Ödeme' göstergesi: Gecikmiş = Bugün = 7 Gün = 30 Gün = 90 Gün = Tüm Açık (birleşik tur 8b); yön süzgeci (tahsilat / ödeme) ayrı ayrı", async () => {
    const seen = {};
    for (const preset of ["late", "today", "next7", "next30", "next90", "open"]) {
      const data = await get(`/api/workspace/overview/vade-takip?preset=${preset}`);
      seen[preset] = [data.totals.in.overdue.amount, data.totals.out.overdue.amount];
    }
    assert.deepEqual(seen, { late: [500, 100], today: [500, 100], next7: [500, 100], next30: [500, 100], next90: [500, 100], open: [500, 100] });
    const lateIn = await get("/api/workspace/overview/vade-takip?preset=late&direction=in");
    const lateOut = await get("/api/workspace/overview/vade-takip?preset=late&direction=out");
    assert.deepEqual([lateIn.rows.length, lateIn.totals.in.total.amount, lateOut.rows.length, lateOut.totals.out.total.amount], [5, 500, 2, 100]);
  });
  it("Bugün / 7 Gün sözü aralığın bitişinden ileride olan gecikmiş kalemi de gösterir (birleşik tur 8b — S150 = A'nın eksik kolu; ayrıntı test/vade-takip-gecikmis-b8b-250.test.mjs)", async () => {
    for (const preset of ["today", "next7"]) {
      const data = await get(`/api/workspace/overview/vade-takip?preset=${preset}`);
      assert.deepEqual([data.totals.in.overdue.amount, data.totals.in.overdue.count, data.totals.out.overdue.amount, data.totals.out.overdue.count], [500, 5, 100, 2], preset);
      assert.deepEqual(data.rows.filter(row => row.date > data.to).map(row => [row.party, row.state]).sort(), [["Gecikmiş Hücre v-10 p15", "overdue"], ["Gecikmiş Tedarikçi Sözlü", "overdue"]], preset);
    }
  });
  it("ELLE girilen aralık değişmez: 60 gün önce … dün ⇒ yalnız tarihi aralıkta olan 4 satır (sözü ileride olan kalem YOK)", async () => {
    const data = await get(`/api/workspace/overview/vade-takip?from=${day(-60)}&to=${day(-1)}`);
    assert.deepEqual([data.rows.length, data.totals.in.overdue.amount], [4, 300]);
    assert.ok(data.rows.every(row => row.date < TODAY));
  });
  it("PDF ve Excel ekranla aynı satırlar ('Gecikmiş' aralığı)", async () => {
    const pdf = await c.raw("GET", "/api/workspace/overview/vade-takip.pdf?preset=late");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer);
    assert.deepEqual([(text.match(/Gecikmiş Hücre v/g) || []).length, (text.match(/Gecikmiş Tedarikçi/g) || []).length], [5, 2]);
    const x = await c.raw("GET", "/api/workspace/overview/vade-takip.xlsx?preset=late");
    assert.equal(x.status, 200);
    assert.equal(xlsxRows(x.buffer).filter(r => r.some(cell => String(cell).startsWith("Gecikmiş Hücre v") || String(cell).startsWith("Gecikmiş Tedarikçi"))).length, 7);
  });
});
