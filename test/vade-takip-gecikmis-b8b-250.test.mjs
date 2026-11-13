// 2.5.0 BİRLEŞİK TUR 8b — S150 = A'nın ileriye bakan hazır aralıklar kolu: 'Bugün', '7 Gün', '30 Gün', '90 Gün' (Vade Takip göstergesi; para kuralı DEĞİL, görünüm).
// KARAR (iş listesi D, KULLANICI KARARI 13.11 06:12, AYNEN): "S150 = A — Vade Takip'in 'Gecikmiş' hazır aralığı durumu Gecikmiş olan HER kalemi gösterir (sözü bugün ya da ileride
// olan gecikmiş borç dahil; 'Gecikmiş Tahsilat' göstergesi her aralıkta aynı sayı)". BAŞ MİMAR YORUMU (D): gösterge ile satırlar ayrışmaz (toplam = satırlar — ders 11) → 'Bugün',
// '7 Gün', '30 Gün' ve '90 Gün' hazır aralıklarında durumu Gecikmiş olan HER kalem satır olarak da listelenir; ekran = PDF = Excel; iki yön; yön süzgeci; her kaynak. Ana oturum
// 13.11: '30 / 90 Gün değişmez' satırı görev metninin hatasıydı (S-a = A) — dört aralık aynı kurala bağlı.
// DEĞİŞMEZ: elle girilen tarih aralığı; 'Gecikmiş' / 'Tüm Açık'; 'Gecikmişleri de göster' kapalıyken (late=0) davranış; 'Gecikmiş' sayılma kuralı (S149 = C); aralıkların Bugün /
// Yaklaşan kümeleri. Önceden (taban birlesik8b-taban): 'Bugün' / '7 Gün' vadesi 10 gün önce geçmiş, sözü 15 gün SONRA olan borcu göstermiyordu (gösterge 510 / 6 tahsilat, 30 / 1
// ödeme); '30 Gün' / '90 Gün' sözü 30 / 90 günden ileride olan gecikmiş borcu göstermiyordu (ikinci kurgu).
// Kurgu: dokuz hücre (vade −10 / 0 / +10 × söz +15 / 0 / −5; her biri 100 TL; birleşik tur 7 / 8 ile aynı) + tedarikçi (sözlü gecikmiş 70: vade −10, söz +15; sözsüz gecikmiş 30:
// vade −3) + öbür kaynaklar: vadeli fatura (gecikmiş 60: vade −6; yaklaşan 20: vade +2), carisiz alınan çek (gecikmiş 50: vade −4; yaklaşan 40: vade +3).
// Beklenen sayılar programdan DEĞİL girdilerden ve karar metninden: durumu Gecikmiş tahsil kalemleri = v−10 (p15, p0, p−5) + p−5 (v0, v10; S149 = C) + fatura 60 + çek 50
// = 500 + 110 = 610 / 7; ödeme 70 + 30 = 100 / 2. Sahte saat (ders 13); iki TZ (ders 22 / 13); lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const PRESETS = ["late", "today", "next7", "next30", "next90", "open"];
const NEAR = { today: { from: day(0), to: day(0) }, next7: { from: day(0), to: day(7) }, next30: { from: day(0), to: day(30) }, next90: { from: day(0), to: day(90) } };
const key = row => `${row.source}|${row.party}|${row.date}|${row.direction}|${row.amount}`;
const gauge = data => [data.totals.in.overdue.amount, data.totals.in.overdue.count, data.totals.out.overdue.amount, data.totals.out.overdue.count];
const buckets = data => ({ inToday: [data.totals.in.today.amount, data.totals.in.today.count], inUpcoming: [data.totals.in.upcoming.amount, data.totals.in.upcoming.count], outToday: [data.totals.out.today.amount, data.totals.out.today.count], outUpcoming: [data.totals.out.upcoming.amount, data.totals.out.upcoming.count] });
const sum = rows => Math.round(rows.reduce((total, row) => total + (row.amount || 0), 0) * 100) / 100;

describe("Birleşik tur 8b — Vade Takip 'Bugün' / '7 Gün' / '30 Gün' / '90 Gün': 'Gecikmiş' göstergesi ve satırları öbür hazır aralıklarla aynı (S150 = A)", () => {
  let server;
  let c;
  const get = async url => {
    const res = await c.get(url);
    assert.equal(res.status, 200, `${url}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return unwrap(res);
  };
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return unwrap(res);
  };
  before(async () => {
    server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    c = await loginAdmin(server);
    await c.post("/api/workspace/bank/setup/dismiss", {});
    let n = 0;
    const account = (name, type = "customer") => must(`cari ${name}`, c.post("/api/workspace/accounts", { name, type, registeredOn: day(-400), phone: `0500 781 ${String(10 + n).padStart(2, "0")} ${String((n += 1)).padStart(2, "0")}`, similarOk: true, force: true }));
    const entry = (a, body) => must(`hareket ${a.name}`, c.post(`/api/workspace/accounts/${a.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
    for (const v of [-10, 0, 10]) for (const p of [15, 0, -5]) await entry(await account(`Gecikmiş Hücre v${v} p${p}`), { kind: "debt", amount: "100", date: day(-30), dueDate: day(v), expectedDate: day(p) });
    await entry(await account("Gecikmiş Tedarikçi Sözlü", "supplier"), { kind: "credit", amount: "70", date: day(-30), dueDate: day(-10), expectedDate: day(15) });
    await entry(await account("Gecikmiş Tedarikçi Vadeli", "supplier"), { kind: "credit", amount: "30", date: day(-30), dueDate: day(-3) });
    const service = await must("hizmet", c.post("/api/workspace/stock", { kind: "service", code: "HZM-B8B-1", name: "Hizmet", unit: "Adet", salePrice: "100" }));
    const sale = async (a, amount, dueDate) => must("fatura", c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: day(-30), lines: [{ itemId: service.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate }, cashForce: true }));
    await sale(await account("Kaynak Fatura Gecikmiş"), 60, day(-6));
    await sale(await account("Kaynak Fatura Yaklaşan"), 20, day(2));
    await must("çek 1", c.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "B8B-1", bank: "Akbank", amount: "50", issueDate: day(-40), dueDate: day(-4) }));
    await must("çek 2", c.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "B8B-2", bank: "Akbank", amount: "40", issueDate: day(-40), dueDate: day(3) }));
  });
  after(async () => server?.close());

  it("ön koşul (girdilerden): 'Tüm Açık'ta durumu Gecikmiş tahsil 610 / 7, ödeme 100 / 2; sözü aralığın bitişinden SONRA olan gecikmiş borç var (v−10 p15, tedarikçi sözlü)", async () => {
    const open = await get("/api/workspace/overview/vade-takip?preset=open");
    assert.deepEqual(gauge(open), [610, 7, 100, 2]);
    const lateBeyond = open.rows.filter(row => row.state === "overdue" && row.date > day(7)).map(row => `${row.party}|${row.date}`).sort();
    assert.deepEqual(lateBeyond, [`Gecikmiş Hücre v-10 p15|${day(15)}`, `Gecikmiş Tedarikçi Sözlü|${day(15)}`]);
    assert.deepEqual([...new Set(open.rows.filter(row => row.state === "overdue").map(row => row.source))].sort(), ["account", "cheque", "invoice"], "gecikmiş kalemler üç kaynaktan");
  });

  it("ALTI hazır aralığın HEPSİNDE 'Gecikmiş Tahsilat' / 'Gecikmiş Ödeme' göstergesi aynı: 610 / 7 ve 100 / 2", async () => {
    const seen = {};
    for (const preset of PRESETS) seen[preset] = gauge(await get(`/api/workspace/overview/vade-takip?preset=${preset}`));
    assert.deepEqual(seen, Object.fromEntries(PRESETS.map(preset => [preset, [610, 7, 100, 2]])));
  });

  it("'Bugün' / '7 Gün' / '30 Gün' / '90 Gün' satır kümesi = aralığın kendi satırları ∪ durumu Gecikmiş olan her satır ('Tüm Açık'tan); toplam = satırlar; gösterge = gecikmiş satırların toplamı", async () => {
    const open = await get("/api/workspace/overview/vade-takip?preset=open");
    for (const [preset, range] of Object.entries(NEAR)) {
      const data = await get(`/api/workspace/overview/vade-takip?preset=${preset}`);
      const expected = open.rows.filter(row => (row.date >= range.from && row.date <= range.to) || row.state === "overdue" || row.date < day(0)).map(key).sort();
      assert.deepEqual(data.rows.map(key).sort(), expected, `${preset}: satır kümesi`);
      assert.ok(data.rows.some(row => row.party === "Gecikmiş Hücre v-10 p15" && row.state === "overdue"), `${preset}: v−10 p15 satırı`);
      assert.ok(data.rows.some(row => row.party === "Gecikmiş Tedarikçi Sözlü" && row.state === "overdue"), `${preset}: tedarikçi sözlü satırı`);
      assert.ok(!data.rows.some(row => row.date > range.to && row.state !== "overdue"), `${preset}: aralık dışından gecikmiş olmayan satır yok`);
      const lateIn = data.rows.filter(row => row.direction === "in" && row.state === "overdue");
      const lateOut = data.rows.filter(row => row.direction === "out" && row.state === "overdue");
      assert.deepEqual(gauge(data), [sum(lateIn), lateIn.length, sum(lateOut), lateOut.length], `${preset}: gösterge = gecikmiş satırlar`);
      assert.deepEqual([data.totals.count, data.totals.in.total.amount, data.totals.out.total.amount], [data.rows.length, sum(data.rows.filter(row => row.direction === "in")), sum(data.rows.filter(row => row.direction === "out"))], `${preset}: toplam = satırlar`);
      assert.deepEqual([data.from, data.to], [range.from, range.to], `${preset}: başlıktaki aralık bugünkü gibi`);
    }
  });

  it("aralıkların Bugün / Yaklaşan kümeleri DEĞİŞMEDİ (eklenen kalem yalnız 'Gecikmiş' kümesine girer)", async () => {
    // Girdilerden: bugün = v0 p0 + v10 p0 (200 / 2); 7 Gün yaklaşan = fatura +2 (20) + çek +3 (40); 30 / 90 Gün yaklaşan = + v0 p15, v10 p15 (200) = 260 / 4; ödeme yönünde
    // bugün / yaklaşan yok.
    const seen = {};
    for (const preset of Object.keys(NEAR)) seen[preset] = buckets(await get(`/api/workspace/overview/vade-takip?preset=${preset}`));
    assert.deepEqual(seen, {
      today: { inToday: [200, 2], inUpcoming: [0, 0], outToday: [0, 0], outUpcoming: [0, 0] },
      next7: { inToday: [200, 2], inUpcoming: [60, 2], outToday: [0, 0], outUpcoming: [0, 0] },
      next30: { inToday: [200, 2], inUpcoming: [260, 4], outToday: [0, 0], outUpcoming: [0, 0] },
      next90: { inToday: [200, 2], inUpcoming: [260, 4], outToday: [0, 0], outUpcoming: [0, 0] },
    });
  });

  it("yön süzgeci: Yalnız Tahsil Edilecek / Yalnız Ödenecek — dört ileriye bakan aralıkta gösterge ve satırlar 'Gecikmiş' aralığıyla aynı gecikmişleri taşır", async () => {
    for (const preset of Object.keys(NEAR)) {
      const inData = await get(`/api/workspace/overview/vade-takip?preset=${preset}&direction=in`);
      const outData = await get(`/api/workspace/overview/vade-takip?preset=${preset}&direction=out`);
      const lateIn = await get("/api/workspace/overview/vade-takip?preset=late&direction=in");
      const lateOut = await get("/api/workspace/overview/vade-takip?preset=late&direction=out");
      assert.deepEqual([inData.totals.in.overdue.amount, inData.totals.in.overdue.count, inData.totals.out.total.count], [610, 7, 0], `${preset} tahsilat`);
      assert.deepEqual([outData.totals.out.overdue.amount, outData.totals.out.overdue.count, outData.totals.in.total.count], [100, 2, 0], `${preset} ödeme`);
      assert.deepEqual(inData.rows.filter(row => row.state === "overdue").map(key).sort(), lateIn.rows.map(key).sort(), `${preset}: tahsilat gecikmişleri = 'Gecikmiş' aralığı`);
      assert.deepEqual(outData.rows.filter(row => row.state === "overdue").map(key).sort(), lateOut.rows.map(key).sort(), `${preset}: ödeme gecikmişleri = 'Gecikmiş' aralığı`);
    }
  });

  it("ELLE girilen aralık DEĞİŞMEDİ: bugün … bugün ve bugün … +7 (hazır aralıkla aynı tarihler) sözü ileride olan gecikmiş kalemi göstermez — 510 / 6 tahsilat, 30 / 1 ödeme", async () => {
    for (const range of [NEAR.today, NEAR.next7]) {
      const data = await get(`/api/workspace/overview/vade-takip?from=${range.from}&to=${range.to}`);
      assert.deepEqual(gauge(data), [510, 6, 30, 1], `${range.from}–${range.to}`);
      assert.ok(data.rows.every(row => row.date <= range.to), "satırlar aralıkta (ya da öncesinde)");
    }
  });

  it("'Gecikmişleri de göster' kapalıyken (late=0) dört ileriye bakan aralık dışından kalem eklemez (bugünkü gibi)", async () => {
    for (const [preset, range] of Object.entries(NEAR)) {
      const data = await get(`/api/workspace/overview/vade-takip?preset=${preset}&late=0`);
      assert.ok(data.rows.every(row => row.date >= range.from && row.date <= range.to), preset);
    }
  });

  it("PDF ve Excel ekranla aynı ('Bugün', '7 Gün', '30 Gün', '90 Gün'): satırlar ve 'Gecikmiş Tahsilat' / 'Gecikmiş Ödeme' özeti", async () => {
    for (const preset of Object.keys(NEAR)) {
      const screen = await get(`/api/workspace/overview/vade-takip?preset=${preset}`);
      const names = screen.rows.map(row => row.party).filter(Boolean);
      const pdf = await c.raw("GET", `/api/workspace/overview/vade-takip.pdf?preset=${preset}`);
      assert.equal(pdf.status, 200);
      const text = pdfText(pdf.buffer);
      // PDF'te uzun ad sütunda iki satıra bölünebilir → satırlar 'Durum' metninden (her satırda bir kez) ve hücre / tedarikçi adlarının önekinden sayılır.
      const lines = text.split(/\r?\n/).map(line => line.trim());
      const count = re => lines.filter(line => re.test(line)).length;
      const byState = state => screen.rows.filter(row => row.state === state).length;
      assert.deepEqual(
        [count(/^(\d+ gün )?gecikti$/), count(/^(\d+ gün )?kaldı$/), count(/^Bugün$/), count(/^Gecikmiş Hücre v/), count(/^Gecikmiş Tedarikçi/)],
        [byState("overdue"), byState("upcoming"), byState("today"), names.filter(name => name.startsWith("Gecikmiş Hücre v")).length, names.filter(name => name.startsWith("Gecikmiş Tedarikçi")).length],
        `${preset} PDF satırları (gecikmiş, yaklaşan, bugün, hücre, tedarikçi)`,
      );
      assert.ok(lines.some((line, i) => line === "Gecikmiş Hücre v-10 p15" || (line === "Gecikmiş Hücre v-10" && lines[i + 1] === "p15")), `${preset} PDF: v−10 p15`);
      assert.match(text, /Gecikmiş Tahsilat[\s\S]{0,40}610,00[\s\S]{0,10}\(7\)/, `${preset} PDF özeti tahsilat`);
      assert.match(text, /Gecikmiş Ödeme[\s\S]{0,40}100,00[\s\S]{0,10}\(2\)/, `${preset} PDF özeti ödeme`);
      const x = await c.raw("GET", `/api/workspace/overview/vade-takip.xlsx?preset=${preset}`);
      assert.equal(x.status, 200);
      const sheets = xlsxSheets(x.buffer);
      // Excel'de Vade hücresi tarih sayısı (seri gün); başlık satırı metin.
      const rows = sheets["Vade Takip"].filter(r => typeof r[0] === "number");
      assert.deepEqual(rows.map(r => `${r[3]}|${r[2]}|${r[1]}`).sort(), screen.rows.map(row => `${row.party || ""}|${{ overdue: "Gecikmiş", today: "Bugün", upcoming: "Yaklaşan", month: "Bu Ay" }[row.state]}|${row.days}`).sort(), `${preset} Excel satırları (ad, durum, gün)`);
      assert.ok(rows.some(r => r.includes("Gecikmiş Hücre v-10 p15")), `${preset} Excel: v−10 p15`);
      const summary = Object.fromEntries(sheets["Özet"].map(r => [String(r[0]), String(r[1])]));
      assert.match(summary["Gecikmiş Tahsilat"], /610,00.*\(7\)/, `${preset} Excel özeti tahsilat`);
      assert.match(summary["Gecikmiş Ödeme"], /100,00.*\(2\)/, `${preset} Excel özeti ödeme`);
    }
  });
});

// İkinci kurgu — sözü 30 / 90 günden de ileride olan gecikmiş borç (S-a = A, ana oturum 13.11: görev metnindeki '30 / 90 Gün değişmez' satırı hataydı; S150 = A "her aralıkta aynı
// sayı"). Kurgu: vade −10 × söz +45 (100), vade −10 × söz +100 (100), sözsüz vade −2 (100) — tahsilat; tedarikçi vade −10 × söz +45 (70) — ödeme. Girdilerden: altı hazır aralığın
// HEPSİNDE gecikmiş tahsilat 300 / 3, gecikmiş ödeme 70 / 1; dört kalem de durumu Gecikmiş olduğundan dört ileriye bakan aralıkta satır 4, Tahsil Edilecek 300, Ödenecek 70.
// Önceden (taban): Bugün / 7 Gün / 30 Gün 100 / 1 ve 0 / 0 (satır 1); 90 Gün 200 / 2 ve 70 / 1 (satır 3). Elle aralık bugünkü gibi: bugün … +30 → 100 / 1, 0 / 0; bugün … +90 →
// 200 / 2, 70 / 1.
describe("Birleşik tur 8b — sözü 30 / 90 günden de ileride olan gecikmiş borç: altı hazır aralıkta aynı gösterge ve satırlar (S150 = A)", () => {
  let server;
  let c;
  const get = async url => {
    const res = await c.get(url);
    assert.equal(res.status, 200, `${url}: ${res.status}`);
    return unwrap(res);
  };
  const FAR = [
    ["Uzak Söz p45", "customer", "debt", "100", { dueDate: day(-10), expectedDate: day(45) }],
    ["Uzak Söz p100", "customer", "debt", "100", { dueDate: day(-10), expectedDate: day(100) }],
    ["Uzak Sözsüz", "customer", "debt", "100", { dueDate: day(-2) }],
    ["Uzak Tedarikçi p45", "supplier", "credit", "70", { dueDate: day(-10), expectedDate: day(45) }],
  ];
  before(async () => {
    server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    c = await loginAdmin(server);
    await c.post("/api/workspace/bank/setup/dismiss", {});
    let n = 0;
    for (const [name, type, kind, amount, body] of FAR) {
      const res = await c.post("/api/workspace/accounts", { name, type, registeredOn: day(-400), phone: `0500 782 ${String(10 + n).padStart(2, "0")} ${String((n += 1)).padStart(2, "0")}`, similarOk: true, force: true });
      assert.equal(res.status, 200, `cari ${name}`);
      const a = unwrap(res);
      assert.equal((await c.post(`/api/workspace/accounts/${a.id}/entries`, { method: "cash", cashForce: true, similarOk: true, kind, amount, date: day(-30), ...body })).status, 200, `hareket ${name}`);
    }
  });
  after(async () => server?.close());

  it("gösterge: altı hazır aralığın hepsinde gecikmiş tahsilat 300 / 3, gecikmiş ödeme 70 / 1", async () => {
    const seen = {};
    for (const preset of PRESETS) seen[preset] = gauge(await get(`/api/workspace/overview/vade-takip?preset=${preset}`));
    assert.deepEqual(seen, Object.fromEntries(PRESETS.map(preset => [preset, [300, 3, 70, 1]])));
  });

  it("dört ileriye bakan aralıkta satır kümesi = 'Tüm Açık' satırları (hepsi Gecikmiş); satır 4, Tahsil Edilecek 300, Ödenecek 70; toplam = satırlar; başlık aralığı bugünkü gibi", async () => {
    const open = await get("/api/workspace/overview/vade-takip?preset=open");
    assert.ok(open.rows.every(row => row.state === "overdue"), "ön koşul: dört kalem de Gecikmiş");
    for (const [preset, range] of Object.entries(NEAR)) {
      const data = await get(`/api/workspace/overview/vade-takip?preset=${preset}`);
      assert.deepEqual(data.rows.map(key).sort(), open.rows.map(key).sort(), `${preset}: satır kümesi`);
      assert.deepEqual([data.rows.length, data.totals.count, data.totals.in.total.amount, data.totals.out.total.amount], [4, 4, 300, 70], `${preset}: satır ve toplamlar`);
      assert.deepEqual([data.from, data.to], [range.from, range.to], `${preset}: başlıktaki aralık`);
    }
  });

  it("yön süzgeci: tahsilat 300 / 3 (3 satır), ödeme 70 / 1 (1 satır) — dört ileriye bakan aralıkta", async () => {
    for (const preset of Object.keys(NEAR)) {
      const inData = await get(`/api/workspace/overview/vade-takip?preset=${preset}&direction=in`);
      const outData = await get(`/api/workspace/overview/vade-takip?preset=${preset}&direction=out`);
      assert.deepEqual([inData.rows.length, inData.totals.in.overdue.amount, inData.totals.in.overdue.count, outData.rows.length, outData.totals.out.overdue.amount, outData.totals.out.overdue.count], [3, 300, 3, 1, 70, 1], preset);
    }
  });

  it("ELLE aralık ve late=0 DEĞİŞMEDİ: bugün … +30 → 100 / 1 ve 0 / 0; bugün … +90 → 200 / 2 ve 70 / 1; late=0 iken aralık dışından kalem yok", async () => {
    assert.deepEqual(gauge(await get(`/api/workspace/overview/vade-takip?from=${day(0)}&to=${day(30)}`)), [100, 1, 0, 0]);
    assert.deepEqual(gauge(await get(`/api/workspace/overview/vade-takip?from=${day(0)}&to=${day(90)}`)), [200, 2, 70, 1]);
    for (const [preset, range] of Object.entries(NEAR)) {
      const data = await get(`/api/workspace/overview/vade-takip?preset=${preset}&late=0`);
      assert.ok(data.rows.every(row => row.date >= range.from && row.date <= range.to), `${preset} late=0`);
    }
  });

  it("PDF ve Excel ekranla aynı (dört ileriye bakan aralık): dört satır ve 'Gecikmiş Tahsilat' 300 (3) / 'Gecikmiş Ödeme' 70 (1) özeti", async () => {
    for (const preset of Object.keys(NEAR)) {
      const pdf = await c.raw("GET", `/api/workspace/overview/vade-takip.pdf?preset=${preset}`);
      assert.equal(pdf.status, 200);
      const text = pdfText(pdf.buffer);
      const lines = text.split(/\r?\n/).map(line => line.trim());
      assert.deepEqual([lines.filter(line => /^(\d+ gün )?gecikti$/.test(line)).length, lines.filter(line => /^Uzak /.test(line)).length], [4, 4], `${preset} PDF satırları`);
      assert.match(text, /Gecikmiş Tahsilat[\s\S]{0,40}300,00[\s\S]{0,10}\(3\)/, `${preset} PDF özeti tahsilat`);
      assert.match(text, /Gecikmiş Ödeme[\s\S]{0,40}70,00[\s\S]{0,10}\(1\)/, `${preset} PDF özeti ödeme`);
      const x = await c.raw("GET", `/api/workspace/overview/vade-takip.xlsx?preset=${preset}`);
      assert.equal(x.status, 200);
      const sheets = xlsxSheets(x.buffer);
      const rows = sheets["Vade Takip"].filter(r => typeof r[0] === "number");
      assert.deepEqual(rows.map(r => `${r[3]}|${r[2]}`).sort(), FAR.map(([name]) => `${name}|Gecikmiş`).sort(), `${preset} Excel satırları`);
      const summary = Object.fromEntries(sheets["Özet"].map(r => [String(r[0]), String(r[1])]));
      assert.match(summary["Gecikmiş Tahsilat"], /300,00.*\(3\)/, `${preset} Excel özeti tahsilat`);
      assert.match(summary["Gecikmiş Ödeme"], /70,00.*\(1\)/, `${preset} Excel özeti ödeme`);
    }
  });
});
