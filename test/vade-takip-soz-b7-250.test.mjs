// 2.5.0 birleşik tur 7 — İş 3: Vade Takip, ileri tarihli Ödeme Sözü olan GECİKMİŞ borcu gecikmiş sayar (S52, S67, S69 = A) + S130 = A × Nakit Akışı.
// Kullanıcı kararları (docs/2.5.0-IS-LISTESI.md D, AYNEN): S52 = A — vadesi geçmiş borca ileri tarihli Ödeme Sözü → borç gecikmiş sayılır; S67 = A — takvim kalemi
// söz gününde durur, durumu "Gecikmiş", gün sayısı vadeden; S69 = A — söz günü gelince ve söz geçip ödeme gelmeyince de "Gecikmiş", gün sayısı VADEDEN. Baş mimar yorumu
// (12.11 20:14): "takvim kalemi" Vade Takip satırını ve toplamlarını da kapsar. Vadesi geçmemiş borçta söz: 2.4.5 K6.3 (tarih = söz, gün sayısı ondan) aynen.
// Önceden (taban 3c81cf5c): Vade Takip kalemin durumunu kendi tarihinden (söz günü) yeniden türetiyordu — vadesi geçmiş, sözü ileride borç "Yaklaşan", toplamda yok;
// sözü bugün olan "Bugün"; gün sayısı sözden. Takvim / zil doğruydu (ortak yardımcı calendarState).
// S130 = A (Şüpheliye alınan tutar 'Tahsil Edilecek' kalemlerinden — takvim / Vade Takip / NAKİT TAHMİNİ — en eskiden düşer, bakiye değişmez) + S136 = A, S139 = A:
// Nakit Akışı fatura kalemini yerinde bırakıp bakiyeyi tutturan 'Faturasız Cari Alacağı' dengeleme satırı ekliyordu (şüpheli para nakit tahmininde beklenen tahsilat).
// Beklenen sayılar programdan DEĞİL girdilerden ve karar metninden (aşağıdaki tablolar). Sahte saat (ders 13); iki TZ; lisans servisi yok (ders 30).
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
async function world() {
  const server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true } });
  const client = await loginAdmin(server);
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return unwrap(res);
  };
  await client.post("/api/workspace/bank/setup/dismiss", {});
  let n = 0;
  const account = (name, type = "customer") => must(`cari ${name}`, client.post("/api/workspace/accounts", { name, type, registeredOn: day(-400), phone: `0500 778 ${String(10 + n).padStart(2, "0")} ${String((n += 1)).padStart(2, "0")}`, similarOk: true, force: true }));
  const entry = (acc, body) => must(`hareket ${acc.name}`, client.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
  const service = await must("hizmet", client.post("/api/workspace/stock", { kind: "service", code: `HZM-B7-${Date.now() % 100000}`, name: "Hizmet", unit: "Adet", salePrice: "1000" }));
  const sale = async (acc, date, amount, dueDate) => (await must("fatura", client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: service.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate }, cashForce: true }))).id;
  return { server, client, must, account, entry, sale };
}

// ---------- 9 hücre: söz (ileride / bugün / geçmiş) × vade (geçmiş / bugün / ileride); elle borç 100 TL, kayıt −30 gün ----------
// Beklenen (karar metninden): vade geçmiş → her zaman "Gecikmiş", gün sayısı VADEDEN (S52 / S67 / S69 = A), kalem söz gününde; vade bugün / ileride → 2.4.5 K6.3:
// tarih = söz, durum ve gün sayısı sözden.
const CELLS = [
  { v: -10, p: 15, date: day(15), state: "overdue", days: -10, text: "10 gün gecikti" },
  { v: -10, p: 0, date: day(0), state: "overdue", days: -10, text: "10 gün gecikti" },
  { v: -10, p: -5, date: day(-5), state: "overdue", days: -10, text: "10 gün gecikti" },
  { v: 0, p: 15, date: day(15), state: "upcoming", days: 15, text: "15 gün kaldı" },
  { v: 0, p: 0, date: day(0), state: "today", days: 0, text: "Bugün" },
  { v: 0, p: -5, date: day(-5), state: "overdue", days: -5, text: "5 gün gecikti" },
  { v: 10, p: 15, date: day(15), state: "upcoming", days: 15, text: "15 gün kaldı" },
  { v: 10, p: 0, date: day(0), state: "today", days: 0, text: "Bugün" },
  { v: 10, p: -5, date: day(-5), state: "overdue", days: -5, text: "5 gün gecikti" },
].map(cell => ({ ...cell, name: `Söz Hücresi v${cell.v} p${cell.p}` }));
const STATE_TEXT = { overdue: "Gecikmiş", today: "Bugün", upcoming: "Yaklaşan" };

describe("Birleşik tur 7 İş 3 — Vade Takip: sözlü borcun durumu ve gün sayısı (9 hücre; ekran, Excel, PDF; zil ile aynı)", () => {
  let w;
  const ids = new Map();
  before(async () => {
    w = await world();
    for (const cell of CELLS) {
      const acc = await w.account(cell.name);
      ids.set(cell.name, acc.id);
      await w.entry(acc, { kind: "debt", amount: "100", date: day(-30), dueDate: day(cell.v), expectedDate: day(cell.p), note: "sözlü" });
    }
  });
  after(() => w?.server.close());

  it("ekran (API) satırı: tarih söz günü, durum ve gün sayısı karar tablosundaki gibi; zil / takvim kalemi aynı (ufuktakiler)", async () => {
    const vade = await w.must("Vade Takip", w.client.get(`/api/workspace/overview/vade-takip?from=${day(-800)}&to=${day(800)}`));
    const dues = await w.must("zil", w.client.get("/api/workspace/dues"));
    const seen = CELLS.map(cell => {
      const rows = vade.rows.filter(row => row.party === cell.name).map(row => ({ date: row.date, state: row.state, days: row.days }));
      const bell = (dues.items || []).filter(row => row.accountId === ids.get(cell.name)).map(row => ({ date: row.dueDate, state: row.state, days: row.days }));
      return { hucre: cell.name, vade: rows, zilAyni: bell.length === 0 || JSON.stringify(bell) === JSON.stringify(rows) };
    });
    assert.deepEqual(seen, CELLS.map(cell => ({ hucre: cell.name, vade: [{ date: cell.date, state: cell.state, days: cell.days }], zilAyni: true })));
  });

  it("Excel (Gün, Durum) ve PDF (Durum metni) ekranla aynı", async () => {
    const xlsx = await w.client.raw("GET", `/api/workspace/overview/vade-takip.xlsx?from=${day(-800)}&to=${day(800)}`);
    assert.equal(xlsx.status, 200);
    const sheet = xlsxSheets(xlsx.buffer)["Vade Takip"];
    const head = sheet.findIndex(row => row.includes("Durum") && row.includes("Gün"));
    const cols = sheet[head];
    const excel = CELLS.map(cell => {
      const row = sheet.slice(head + 1).find(item => item.includes(cell.name)) || [];
      return { hucre: cell.name, gun: Number(row[cols.indexOf("Gün")]), durum: row[cols.indexOf("Durum")] };
    });
    assert.deepEqual(excel, CELLS.map(cell => ({ hucre: cell.name, gun: cell.days, durum: STATE_TEXT[cell.state] })));
    const pdf = await w.client.raw("GET", `/api/workspace/overview/vade-takip.pdf?from=${day(-800)}&to=${day(800)}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    const count = needle => text.split(needle).length - 1;
    assert.deepEqual({ on: count("10 gün gecikti"), bes: count("5 gün gecikti") - count("15 gün gecikti"), kalan: count("15 gün kaldı") }, { on: 3, bes: 2, kalan: 2 });
  });
});

// ---------- Toplamlar her süzgeçte (ders 11): satırlardan = toplam alanı = girdilerden beklenen; cari düzeyindeki gecikmişle kapsam farkı AÇIKÇA ----------
describe("Birleşik tur 7 İş 3 — Vade Takip 'Gecikmiş Tahsilat / Gecikmiş Ödeme' her aralık / kaynak / yön seçeneğinde", () => {
  let w;
  const expected = []; // { party, source, direction, amount, date, state }
  const parties = {};
  before(async () => {
    w = await world();
    for (const cell of CELLS) {
      await w.entry(await w.account(cell.name), { kind: "debt", amount: "100", date: day(-30), dueDate: day(cell.v), expectedDate: day(cell.p) });
      expected.push({ party: cell.name, source: "account", direction: "in", amount: 100, date: cell.date, state: cell.state, cariGecikmis: cell.v < 0 });
    }
    // Vadeli satış faturası (gecikmiş, sözsüz) — fatura kalemi.
    parties.fatura = await w.account("Fatura Carisi");
    await w.sale(parties.fatura, day(-40), 300, day(-20));
    expected.push({ party: "Fatura Carisi", source: "invoice", direction: "in", amount: 300, date: day(-20), state: "overdue", cariGecikmis: true });
    // Taksit kartı: 600 TL, 2 taksit, ilk vade −10 gün (aylık) — taksit kalemleri.
    parties.kart = await w.account("Kart Carisi");
    await w.must("taksit kartı", w.client.post("/api/workspace/plans", { accountId: parties.kart.id, name: "Kart Carisi", total: "600", registeredOn: day(-40), mode: "auto", count: 2, firstDue: day(-10) }));
    expected.push({ party: "Kart Carisi", source: "plan", direction: "in", amount: 300, date: day(-10), state: "overdue", cariGecikmis: true });
    expected.push({ party: "Kart Carisi", source: "plan", direction: "in", amount: 300, date: "2026-11-10", state: "upcoming", cariGecikmis: false });
    // Tedarikçi yönü (bizim borcumuz, "Ödenecek Borç"): sözlü gecikmiş 700 (vade −10, söz +15) ve sözsüz gecikmiş 250 (vade −5) — S67 Ödenecek Borç'a da (C14.2 notu).
    parties.tedarikci = await w.account("Tedarikçi Carisi", "supplier");
    await w.entry(parties.tedarikci, { kind: "credit", amount: "700", date: day(-30), dueDate: day(-10), expectedDate: day(15) });
    await w.entry(parties.tedarikci, { kind: "credit", amount: "250", date: day(-20), dueDate: day(-5) });
    expected.push({ party: "Tedarikçi Carisi", source: "account", direction: "out", amount: 700, date: day(15), state: "overdue" });
    expected.push({ party: "Tedarikçi Carisi", source: "account", direction: "out", amount: 250, date: day(-5), state: "overdue" });
  });
  after(() => w?.server.close());

  // dueList'in aralık kuralı (finance-report.mjs başlığı; ekran metni): başlangıç ≤ tarih ≤ bitiş; "gecikmişler dahil" açıkken başlangıçtan önce tarihli GEÇMİŞ kalem de.
  // Aralığın kendisi (preset → başlangıç / bitiş) yanıttan okunur; para / durum kuralı girdilerden.
  // Birleşik tur 8 (S150 = A — KULLANICI KARARI 13.11 06:12 AYNEN: "Vade Takip'in 'Gecikmiş' hazır aralığı durumu Gecikmiş olan HER kalemi gösterir (sözü bugün ya da ileride
  // olan gecikmiş borç dahil; 'Gecikmiş Tahsilat' göstergesi her aralıkta aynı sayı)"): 'Gecikmiş' hazır aralığında tarih üst sınırı yerine durum — bugünden önceki her kalem +
  // durumu Gecikmiş olan kalem.
  // Birleşik tur 8b (S150 = A "her aralıkta aynı sayı"; baş mimar yorumu — gösterge ile satırlar ayrışmaz): ileriye bakan dört hazır aralıkta ('Bugün', '7 Gün', '30 Gün',
  // '90 Gün') aralığın kendi kalemleri + durumu Gecikmiş olan her kalem (sözü aralığın bitişinden sonra olan gecikmiş borç dahil).
  const ranged = (item, data) => !(data.to && item.date > data.to) && !(data.from && item.date < data.from && !(data.late && item.date < TODAY));
  const inRange = (item, data, option = {}) => (option.lateOnly ? item.date < TODAY || item.state === "overdue" : option.nearLate ? ranged(item, data) || item.state === "overdue" : ranged(item, data));
  const sum = (items, direction) => Math.round(items.filter(item => item.direction === direction && item.state === "overdue").reduce((s, item) => s + item.amount, 0) * 100) / 100;
  const OPTIONS = [
    ...["late", "today", "next7", "next30", "next90", "open"].map(preset => ({ ad: `aralık ${preset}`, q: `preset=${preset}`, lateOnly: preset === "late", nearLate: ["today", "next7", "next30", "next90"].includes(preset) })),
    { ad: "geniş özel aralık", q: `from=${day(-800)}&to=${day(800)}` },
    { ad: "gecikmişler hariç (late=0)", q: `from=${day(0)}&to=${day(60)}&late=0` },
    ...["account", "invoice", "plan"].map(source => ({ ad: `kaynak ${source}`, q: `preset=open&sources=${source}`, source })),
    ...["in", "out"].map(direction => ({ ad: `yön ${direction}`, q: `preset=open&direction=${direction}`, direction })),
  ];

  it("her seçenekte: toplam alanı = satırlardan = girdilerden beklenen (gecikmiş tahsilat ve ödeme)", async () => {
    const seen = [];
    const want = [];
    for (const option of OPTIONS) {
      const data = await w.must(option.ad, w.client.get(`/api/workspace/overview/vade-takip?${option.q}`));
      const rows = data.rows.filter(row => row.amount !== null);
      const scope = expected.filter(item => inRange(item, data, option) && (!option.source || item.source === option.source) && (!option.direction || item.direction === option.direction));
      seen.push({ ad: option.ad, alanIn: data.totals.in.overdue.amount, satirIn: sum(rows, "in"), alanOut: data.totals.out.overdue.amount, satirOut: sum(rows, "out") });
      want.push({ ad: option.ad, alanIn: sum(scope, "in"), satirIn: sum(scope, "in"), alanOut: sum(scope, "out"), satirOut: sum(scope, "out") });
    }
    assert.deepEqual(seen, want);
  });

  it("cari düzeyi (Cari Listesi 'Gecikmiş', Anlık Durum): 'Tüm Açık' Gecikmiş Tahsilat − kapsam farkı = Σ cari gecikmiş; kapsam farkları açıkça", async () => {
    const open = await w.must("Tüm Açık", w.client.get("/api/workspace/overview/vade-takip?preset=open"));
    const late = await w.must("Gecikmiş", w.client.get("/api/workspace/overview/vade-takip?preset=late"));
    const list = await w.must("Cari Listesi", w.client.get("/api/workspace/accounts?status=all&limit=5000"));
    const customers = list.accounts.filter(row => row.type !== "supplier");
    const cariGecikmis = Math.round(customers.reduce((s, row) => s + (Number(row.overdue) || 0), 0) * 100) / 100;
    // KAPSAM FARKI 1 (2.4.5 K6.3 — kararların bugünkü hâli; KULLANICIYA SORULMALI raporda): vadesi gelmemiş borçta söz günü geçti → takvim / zil / Vade Takip "Gecikmiş",
    // cari kartı / Cari Listesi gecikmiş saymaz (vade gelmedi). Hücreler v0 p−5 ve v10 p−5: 200.
    const k63 = expected.filter(item => item.direction === "in" && item.state === "overdue" && !item.cariGecikmis).reduce((s, item) => s + item.amount, 0);
    // KAPSAM FARKI 2 KALKTI (birleşik tur 8, S150 = A): "Gecikmiş" aralığı sözü BUGÜN ya da ileride olan gecikmiş borcu da içerir — hücreler v−10 p15 ve v−10 p0: 200
    // (önceden bitiş = dün olduğu için dışarıda kalıyordu; S67 = A "kalem söz gününde durur" aynen).
    const sozIleride = expected.filter(item => item.direction === "in" && item.state === "overdue" && item.date >= TODAY).reduce((s, item) => s + item.amount, 0);
    assert.deepEqual(
      { tumAcik: open.totals.in.overdue.amount, cariGecikmis, gecikmisAraligi: late.totals.in.overdue.amount },
      { tumAcik: cariGecikmis + k63, cariGecikmis: 100 * 3 + 300 + 300, gecikmisAraligi: cariGecikmis + k63 },
    );
    assert.deepEqual({ k63, sozIleride }, { k63: 200, sozIleride: 200 });
  });
});

// ---------- S130 = A × Nakit Akışı: şüpheli tutar Vade Takip'le AYNI kalemlerden düşer; dengeleme satırı geri eklemez ----------
// Kurgu (ana oturumun SK29 okuması): fatura 200 (vade −150) + Borç 1.000 (vade −140) + Borç 500 (vade −130), bakiye 1.700. Şüpheli Alacağa Al: kalemler en eskiden düşer
// (S130 = A; S136 = A tür ayrımı yok). Her adımda: Nakit Akışı (gecikenler dahil; her gruplamada; Excel) cari toplamı = Vade Takip cari toplamı = bakiye − açık şüpheli;
// kalemler iki ekranda AYNI (S139 = A); 'Faturasız Cari Alacağı' dengeleme satırı yok. S137 / S138 = C (BİLİNEN SINIR) — kurguya girmez.
describe("Birleşik tur 7 İş 3 — S130 = A × Nakit Akışı: şüpheliye alınan tutar nakit tahmininde beklenen tahsilat değildir", () => {
  let w;
  after(() => w?.server.close());
  it("adım adım: şüpheli 900 (üç kaleme yayılır); kısmen tahsil 300; kısmen Değersiz 200; ikinci şüpheli kaydı 300; ilk kaydın kalanı Değersiz — her adımda eşitlik", async t => {
    w = await world();
    const acc = await w.account("Şüpheli Carisi");
    await w.sale(acc, day(-150), 200, day(-150));
    await w.entry(acc, { kind: "debt", amount: "1000", date: day(-145), dueDate: day(-140), note: "B1000" });
    await w.entry(acc, { kind: "debt", amount: "500", date: day(-135), dueDate: day(-130), note: "B500" });
    const round = value => Math.round(value * 100) / 100;
    const signed = rows => round(rows.reduce((s, row) => s + (row.direction === "in" ? row.amount : -row.amount), 0));
    const kalem = rows => rows.map(row => `${row.source}:${row.amount}`).sort();
    const records = async () => (await w.must("şüpheli", w.client.get(`/api/workspace/accounts/${acc.id}/doubtful`))).records || [];
    const steps = [];
    const read = async label => {
      const balance = (await w.must("cari kartı", w.client.get(`/api/workspace/accounts/${acc.id}`))).totals?.balance;
      const open = round((await records()).reduce((s, record) => s + (Number(record.remainingMinor) || 0), 0) / 100);
      const flows = {};
      for (const group of ["", "day", "week", "month"]) {
        const flow = await w.must("Nakit Akışı", w.client.get(`/api/workspace/overview/nakit-akisi?from=${day(0)}&to=${day(30)}&overdue=1${group ? `&group=${group}` : ""}`));
        flows[group || "yok"] = [...(flow.rows || []), ...(flow.overdue || [])].filter(row => row.party === acc.name);
      }
      const vade = await w.must("Vade Takip", w.client.get("/api/workspace/overview/vade-takip?preset=open"));
      const vadeRows = vade.rows.filter(row => row.party === acc.name);
      const xlsx = await w.client.raw("GET", `/api/workspace/overview/nakit-akisi.xlsx?from=${day(0)}&to=${day(30)}&overdue=1`);
      const sheets = xlsxSheets(xlsx.buffer);
      steps.push({
        adim: label,
        bakiyeEksiSupheli: round(balance - open),
        nakit: Object.fromEntries(Object.entries(flows).map(([group, rows]) => [group, signed(rows)])),
        vade: signed(vadeRows),
        faturasiz: flows.yok.filter(row => row.source === "unbilled").map(row => row.amount),
        ayniKalem: JSON.stringify(kalem(flows.yok)) === JSON.stringify(kalem(vadeRows)),
        excelSatir: [...(sheets["Nakit Akışı"] || []), ...(sheets["Gecikmiş"] || [])].filter(row => row.includes(acc.name)).length,
        ekranSatir: flows.yok.length,
      });
    };
    await read("başlangıç");
    await w.must("şüpheliye al 900", w.client.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "900", date: day(-30), reason: "lawsuit", note: "dava" }));
    await read("şüpheli 900");
    await w.entry(acc, { kind: "in", amount: "300", date: day(0), note: "kısmi tahsilat" });
    await read("tahsilat 300");
    const [first] = await records();
    await w.must("Değersiz 200", w.client.post(`/api/workspace/accounts/${acc.id}/doubtful/${first.id}/write-off`, { amount: "200", date: day(0), note: "kısmen" }));
    await read("Değersiz 200");
    await w.must("ikinci şüpheli 300", w.client.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "300", date: day(-1), reason: "lawsuit", note: "ikinci" }));
    await read("ikinci şüpheli 300");
    const rest = (await records()).find(record => record.id === first.id);
    await w.must("kalanı Değersiz", w.client.post(`/api/workspace/accounts/${acc.id}/doubtful/${first.id}/write-off`, { amount: (rest.remainingMinor / 100).toFixed(2).replace(".", ","), date: day(0), note: "tamamı" }));
    await read("ilk kaydın kalanı Değersiz");
    t.diagnostic(steps.map(step => `${step.adim}: bakiye − açık şüpheli ${step.bakiyeEksiSupheli}, nakit ${step.nakit.yok}, vade ${step.vade}, faturasız ${step.faturasiz.length}`).join(" | "));
    // Her adımda: nakit (her gruplama) = vade = bakiye − açık şüpheli; dengeleme satırı yok; kalemler aynı; Excel ekranla aynı satır sayısı.
    assert.deepEqual(
      steps,
      steps.map(step => ({ ...step, nakit: { yok: step.bakiyeEksiSupheli, day: step.bakiyeEksiSupheli, week: step.bakiyeEksiSupheli, month: step.bakiyeEksiSupheli }, vade: step.bakiyeEksiSupheli, faturasiz: [], ayniKalem: true, excelSatir: step.ekranSatir })),
    );
    // Girdilerden: 1.700; şüpheli 900 en eskiden → 800; Değersiz yazımı görünümü değiştirmez (bakiye ve açık şüpheli birlikte azalır).
    assert.deepEqual(steps.slice(0, 2).map(step => step.bakiyeEksiSupheli), [1700, 800]);
    assert.equal(steps[3].bakiyeEksiSupheli, steps[2].bakiyeEksiSupheli, "kısmen Değersiz: görünüm aynı");
    assert.equal(steps[5].bakiyeEksiSupheli, steps[4].bakiyeEksiSupheli, "kalanın tamamı Değersiz: görünüm aynı");
  });
});

// S136 = A: şüpheliye alınan tutar türüne bakmadan kuyruk sırasıyla düşer — TAKSİT kalemlerinden de (Vade Takip bugün böyle; Nakit Akışı aynı kalemleri gösterir).
describe("Birleşik tur 7 İş 3 — S130 × S136 = A: taksit kartlı caride şüpheli tutar taksit kalemlerinden düşer (Nakit Akışı = Vade Takip)", () => {
  let w;
  after(() => w?.server.close());
  it("kart 600 (2 taksit, ilki gecikmiş) + elle Borç 200; şüpheli 500 → iki ekranda kalan 300, aynı kalemler; faturasız dengeleme satırı yok", async () => {
    w = await world();
    const acc = await w.account("Kartlı Şüpheli");
    await w.must("taksit kartı", w.client.post("/api/workspace/plans", { accountId: acc.id, name: "Kartlı Şüpheli", total: "600", registeredOn: day(-60), mode: "auto", count: 2, firstDue: day(-30) }));
    await w.entry(acc, { kind: "debt", amount: "200", date: day(-10), dueDate: day(-5), note: "B200" });
    await w.must("şüpheliye al 500", w.client.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "500", date: day(-2), reason: "lawsuit", note: "dava" }));
    const flow = await w.must("Nakit Akışı", w.client.get(`/api/workspace/overview/nakit-akisi?from=${day(0)}&to=${day(60)}&overdue=1`));
    const flowRows = [...(flow.rows || []), ...(flow.overdue || [])].filter(row => row.party === acc.name);
    const vade = await w.must("Vade Takip", w.client.get("/api/workspace/overview/vade-takip?preset=open"));
    const vadeRows = vade.rows.filter(row => row.party === acc.name);
    const kalem = rows => rows.map(row => `${row.source}:${row.amount}`).sort();
    const total = rows => Math.round(rows.reduce((s, row) => s + row.amount, 0) * 100) / 100;
    assert.deepEqual(
      { nakit: total(flowRows), vade: total(vadeRows), ayni: JSON.stringify(kalem(flowRows)) === JSON.stringify(kalem(vadeRows)), faturasiz: flowRows.filter(row => row.source === "unbilled").length, nakitKalem: kalem(flowRows) },
      { nakit: 300, vade: 300, ayni: true, faturasiz: 0, nakitKalem: kalem(vadeRows) },
    );
  });
});
