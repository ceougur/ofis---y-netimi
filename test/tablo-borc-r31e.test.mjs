// 2.4.4 31e (bağımsız dar kontrol) bulguları — kullanıcı adına 5 dk yetkisiyle verilen kararlar (23.10.2026 03:12 UTC):
// T4  AYNI sekmede aynı Dosya No'lu birden çok satır (taksit / dönem satırı) ayrı borç ve ayrı takvim kalemidir (2.4.3 gibi); kayıt borcu satırların toplamı.
// (a) → A1 (DEĞİŞTİ, 23.10.2026 04:09 UTC): FARKLI sekmelerde aynı Dosya No ayrı borç ve ayrı vade kalemidir (2.4.3 gibi); rapor ve Tahsilat Takvimi bunu
//     görünür not olarak söyler; Sekme süzgeci seçilince her sekme kendi borcunu gösterir.
// T1  Kalan / Borç başlığı yoksa ve ödenen + toplam sütunu varsa satır borcu = toplam − ödenen (negatifse 0 + not); ödenen tutar borç sayılmaz.
// Y1  Tablodaki Nakit Akışı'nda Kasa sütunları yalnız Kasa'yı görme yetkisi (cash.view) olana; Tablo Raporları yetkisi tek başına Kasa'yı açmaz.
// Beklenen sayılar tablo hücrelerinden ve girilen tutarlardan (ders 5); kâhin değil, kodu yazan elin testi.
// "Nasıl bozulur?" (not defteri r31e-nasil-bozulur.md R1–R10): R1 aynı sekmede satırlar tek borca katlanır (2.4.4 aday 11: Ali 1.500, Ayşe 700) · R2 takvim
// kalemleri birleşir · R3 Sekme süzgeci bir kez sayılan sekmeyi seçince öbür sekmenin borcu kaybolur · R4 not yalnız ekranda (PDF/Excel'de yok) · R5 ödenen
// tutar borç sayılır (2.4.3: Satışlar 10.000 + 8.000 + 6.000) ya da hiç borç yok (aday 11: "Tutar" + "Tahsil Edilen" tablosu Kişiler'de yok) · R6 ödenen > toplam
// eksi borç · R7 Kalan varken net hesaplanır · R8 Kasa yetkisi olmayan Kasa toplamlarını görür (2.4.3'te de) · R9 yetkili kişide Kasa sütunu kaybolur ·
// R10 Tablodan Aktar ile Tablodaki Kişiler aynı dosyada farklı kalan gösterir.
import "./fixtures/saat-dilimi-istanbul.mjs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";

const NOW = "2026-10-23T10:00:00+03:00";
const pad = value => String(value).padStart(2, "0");
const d = days => {
  const date = new Date(2026, 9, 23 + days, 12);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};
const iso = days => {
  const date = new Date(2026, 9, 23 + days, 12);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const RANGE = "from=2000-01-01&to=2099-12-31";

const setup = sheets => {
  const ctx = {};
  before(async () => {
    ctx.server = await startTestServer({ now: NOW });
    ctx.admin = await loginAdmin(ctx.server);
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data.data;
    };
    ctx.must = must;
    await must("kurulum geç", ctx.admin.post("/api/workspace/bank/setup/dismiss", {}));
    if (sheets) {
      const staged = await must("tablo", ctx.admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "r31e.xlsx", sheets }));
      await must("tablo kaydet", ctx.admin.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    }
    ctx.report = async (kind, query = "", client = ctx.admin) => must(`${kind} ${query}`, client.get(`/api/workspace/reports/${kind}?${RANGE}${query ? `&${query}` : ""}`));
    ctx.exportOf = async (kind, format, filters = {}, client = ctx.admin) => {
      const res = await client.raw("POST", `/api/workspace/reports/${kind}/export`, { body: JSON.stringify({ format, filters }), headers: { "content-type": "application/json" } });
      assert.equal(res.status, 200, `${kind} ${format}: ${res.status}`);
      return res.buffer;
    };
  });
  after(async () => {
    await ctx.server?.close();
  });
  return ctx;
};
const debitBy = report => Object.fromEntries(report.groups.map(group => [group.cari, group.debit]));
const flat = text => text.replace(/\s+/g, " ");
const xlsxText = buffer => Object.values(xlsxSheets(buffer)).flat(2).join(" ");

describe("31e T4: aynı sekmede aynı dosya no'lu satırlar ayrı borç ve ayrı takvim kalemi (2.4.3 gibi)", () => {
  const ctx = setup([
    { name: "Taksitler", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Vade Tarihi"], ["100", "Ali Veli", "1.000", d(-2)], ["100", "Ali Veli", "1.500", d(3)], ["200", "Ayşe Kaya", "700", d(-1)], ["200", "Ayşe Kaya", "700", d(4)]] },
    { name: "Taksit Tutarı", matrix: [["Dosya No", "Ad Soyad", "Taksit Tutarı", "Vade Tarihi"], ["300", "Can Yıldız", "400", d(-3)], ["300", "Can Yıldız", "600", d(5)]] },
  ]);

  test("Tablodaki Kişiler: Ali Veli 1.000 + 1.500 = 2.500, Ayşe Kaya 700 + 700 = 1.400, Can Yıldız 400 + 600 = 1.000; toplam 4.900; birleştirme notu yok", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ali Veli": 2500, "Ayşe Kaya": 1400, "Can Yıldız": 1000 }, "aynı sekmedeki satırlar toplanır (R1)");
    assert.equal(report.totals.debit, 4900);
    assert.deepEqual(report.notes || [], [], "aynı sekmede birleştirme yok, not da yok");
  });

  test("Tahsilat Takvimi: 6 kalem, tutarları satır satır (1.000, 1.500, 700, 700, 400, 600); söz / zil ön dolumunun Kalan Borç'u dosyanın Kalan toplamı", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.person).map(item => [item.person, item.amount, item.debt]).sort((a, b) => a[0].localeCompare(b[0], "tr") || a[1] - b[1]);
    assert.deepEqual(items, [["Ali Veli", 1000, 2500], ["Ali Veli", 1500, 2500], ["Ayşe Kaya", 700, 1400], ["Ayşe Kaya", 700, 1400], ["Can Yıldız", 400, null], ["Can Yıldız", 600, null]], "kalemler birleşmez (R2); Kalan Borç dosya toplamı (5b Açılış Bakiyesi)");
    // Can Yıldız: tek tutar sütunu kalem tutarı ("Taksit Tutarı") — kaydın Kalan Borç'u sayılmaz, Açılış Bakiyesi boş gelir (8871ccf; 2.4.3'te de boştu).
  });

  test("Vadeler ve Nakit Akışı: 6 kalem, 4.900; Gecikmiş 1.000 + 700 + 400 = 2.100", async () => {
    const vade = (await ctx.report("vade-takip")).report.totals;
    assert.deepEqual([vade.count, vade.amount, vade.overdue, vade.overdueAmount], [6, 4900, 3, 2100]);
    const nakit = (await ctx.report("nakit-akis")).report.totals;
    assert.equal(nakit.expected, 4900);
  });
});

describe("31e T1: Kalan / Borç başlığı yoksa borç = toplam − ödenen; ödenen > toplam ise 0 ve not", () => {
  const ctx = setup([
    { name: "Satışlar", matrix: [["Ad Soyad", "Dosya No", "Tutar", "Tahsil Edilen", "Son Ödeme Tarihi"], ["Ali Veli", "S-1", "10.000", "4.000", d(10)], ["Ayşe Kaya", "S-2", "8.000", "8.000", d(-5)], ["Can Yıldız", "S-3", "6.000", "1.000", d(-2)], ["Deniz Ak", "S-4", "1.000", "1.200", d(-3)]] },
    { name: "Senetler", matrix: [["Borçlu", "Senet No", "Ödenecek Tutar", "Ödenen Tutar", "Vade"], ["Mehmet Demir", "N-1", "5.000", "2.000", d(7)], ["Zeynep Şahin", "N-2", "3.000", "0", d(-1)]] },
    { name: "Gecikme", matrix: [["Müşteri", "Dosya No", "Borç Tutarı", "Gecikme Günü", "Son Ödeme"], ["Fatma Ak", "G-1", "2.500", "12", d(-12)]] },
    { name: "Hesaplı", matrix: [["Ad Soyad", "Dosya No", "Toplam Tutar", "Ödenen", "Kalan Borç", "Vade"], ["Okan Er", "H-1", "9.000", "1.000", "5.000", d(2)]] },
  ]);
  const expected = { "Ali Veli": 6000, "Ayşe Kaya": 0, "Can Yıldız": 5000, "Deniz Ak": 0, "Mehmet Demir": 3000, "Zeynep Şahin": 3000, "Fatma Ak": 2500, "Okan Er": 5000 };
  const OVERPAID = "1 satırda ödenen tutar toplam tutarı aşıyor; o satırların borcu 0 sayıldı.";

  test("Tablodaki Kişiler: 10.000 − 4.000, 8.000 − 8.000, 6.000 − 1.000, 1.000 − 1.200 → 0; senet 5.000 − 2.000, 3.000 − 0; gün sütunu tutar değil; Kalan varsa Kalan (5.000) — toplam 24.500", async () => {
    const { report } = await ctx.report("cari-ekstre");
    for (const [cari, debit] of Object.entries(expected)) assert.equal(debitBy(report)[cari], debit, `${cari} borcu (R5/R6/R7)`);
    assert.equal(report.totals.debit, 24500);
    assert.ok((report.notes || []).includes(OVERPAID), `ödenen > toplam notu: ${JSON.stringify(report.notes)}`);
  });

  test("Vadeler ve Nakit Akışı Beklenen aynı kuraldan: 24.500; not aynı", async () => {
    const vade = await ctx.report("vade-takip");
    assert.equal(vade.report.totals.amount, 24500, "Vadeler toplamı Tablodaki Kişiler ile aynı");
    assert.ok(vade.report.notes.includes(OVERPAID));
    const nakit = await ctx.report("nakit-akis");
    assert.equal(nakit.report.totals.expected, 24500);
    assert.ok(nakit.report.notes.includes(OVERPAID));
  });
});

describe("31e T1: Tablodan Aktar ile Tablodaki Kişiler aynı dosyada aynı kalan (toplam − ödenen)", () => {
  const ctx = setup([{ name: "Taksitler", matrix: [["Dosya No", "Ad Soyad", "Toplam Tutar", "Ödenen", "Taksit Sayısı", "İlk Vade"], ["T-1", "Elif Aydın", "6.000", "1.500", "3", d(5)]] }]);

  test("Elif Aydın: Kişiler borcu 4.500; Tablodan Aktar ön izlemesinde kalan 4.500 (R10)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.equal(debitBy(report)["Elif Aydın"], 4500);
    const preview = await ctx.must("ön izleme", ctx.admin.get("/api/workspace/plans/from-table"));
    const record = preview.records.find(item => item.name === "Elif Aydın");
    assert.ok(record, `ön izlemede kayıt yok: ${JSON.stringify(preview.records.map(item => item.name))}`);
    assert.equal(record.remaining, 4500, `Tablodan Aktar kalanı: ${JSON.stringify({ total: record.total, paid: record.paid, remaining: record.remaining, excel: record.excel })}`);
  });
});

// 31e kontrol turu 2 A1 kararı (kullanıcı adına 5 dk yetkisiyle, 23.10.2026 04:09 UTC; (a) DEĞİŞTİ): farklı sekmede aynı Dosya No AYRI borç ve AYRI vade
// kalemidir (2.4.3 gibi); görünür not raporlarda (ekran / PDF / Excel) ve Tahsilat Takvimi'nde. Aday 12'de dönem sekmesinin (2026) kalemleri takvimden düşüyordu.
// "Nasıl bozulur?" (not defteri a1-nasil-bozulur.md B1–B12) — B1 dönem kalemi düşer · B2 öbür sekmenin borcu sayılmaz · B3 kopya sekme bir kez, notsuz · B4 söz
// sekmesi boşuna not · B5 not takvimde / PDF / Excel'de yok · B6 söz kaleminin Kalan Borç'u boş · B7 kalemin Kalan Borç'u öbür sekmeden · B10 Sekme süzgeci.
const SPLIT_NOTE = tabs => `dosya no birden çok sekmede; ayrı sayıldı (${tabs}). Aynı borçsa kopya sekmeyi kaldırın ya da Sekme süzgeciyle bakın.`;

describe("31e A1: dönem sekmeleri (2025 / 2026 Aidat) aynı dosya no — her sekme ayrı borç (2.4.3 gibi), not; Sekme süzgeciyle her sekme kendi borcu", () => {
  const ctx = setup([
    { name: "2025 Aidat", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["D-5", "Ali Veli", "1.200", d(-40)], ["D-7", "Ayşe Kaya", "600", d(-35)]] },
    { name: "2026 Aidat", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["D-5", "Ali Veli", "800", d(10)], ["D-7", "Ayşe Kaya", "600", d(12)]] },
  ]);
  const NOTE = `2 ${SPLIT_NOTE("2025 Aidat, 2026 Aidat")} Dosya No: D-5 (Ali Veli), D-7 (Ayşe Kaya).`;

  test("süzgeçsiz: Ali Veli 1.200 + 800 = 2.000, Ayşe Kaya 600 + 600 = 1.200, toplam 3.200 (2.4.3 ile aynı); not üç raporda (B2)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ali Veli": 2000, "Ayşe Kaya": 1200 });
    assert.equal(report.totals.debit, 3200);
    assert.deepEqual(report.notes, [NOTE]);
    for (const kind of ["vade-takip", "nakit-akis"]) assert.deepEqual((await ctx.report(kind)).report.notes, [NOTE], `${kind} notu`);
    assert.equal((await ctx.report("vade-takip")).report.totals.amount, 3200);
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 3200);
  });

  test("Sekme süzgeci: 2026 Aidat → Ali Veli 800, Ayşe Kaya 600 (1.400), not yok; 2025 Aidat → 1.800; seçenekler iki sekme (B10)", async () => {
    const only2026 = await ctx.report("cari-ekstre", "tabs=2026 Aidat");
    assert.deepEqual(debitBy(only2026.report), { "Ali Veli": 800, "Ayşe Kaya": 600 });
    assert.deepEqual(only2026.report.notes, [], "tek sekmede not yok");
    assert.deepEqual(only2026.tabs, ["2025 Aidat", "2026 Aidat"], "Sekme seçenekleri bütün sekmelerden");
    assert.equal((await ctx.report("vade-takip", "tabs=2026 Aidat")).report.totals.amount, 1400);
    assert.equal((await ctx.report("nakit-akis", "tabs=2026 Aidat")).report.totals.expected, 1400);
    assert.equal((await ctx.report("cari-ekstre", "tabs=2025 Aidat")).report.totals.debit, 1800);
    assert.equal((await ctx.report("vade-takip", "tabs=2025 Aidat")).report.totals.amount, 1800);
  });

  test("PDF ve Excel aynı notu taşır (B5)", async () => {
    for (const kind of ["cari-ekstre", "vade-takip", "nakit-akis"]) {
      assert.ok(flat(pdfText(await ctx.exportOf(kind, "pdf"))).includes("ayrı sayıldı (2025 Aidat, 2026 Aidat)"), `${kind} PDF notu`);
      assert.ok(flat(xlsxText(await ctx.exportOf(kind, "xlsx"))).includes(NOTE), `${kind} Excel notu`);
    }
  });
});

describe("31e A1: Tahsilat Takvimi — dönem sekmesinin kalemleri düşmez (aday 12: 2 kalem; 2.4.3: 4), not takvim yanıtında (B1/B5/B7)", () => {
  const ctx = setup([
    { name: "2025 Aidat", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["D-5", "Ali Veli", "1.200", d(-2)], ["D-7", "Ayşe Kaya", "600", d(-1)]] },
    { name: "2026 Aidat", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["D-5", "Ali Veli", "800", d(3)], ["D-7", "Ayşe Kaya", "600", d(4)]] },
  ]);

  test("4 kalem: 2025 Ali 1.200 / Ayşe 600, 2026 Ali 800 / Ayşe 600; her kalemin Kalan Borç'u kendi sekmesinden; not", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.person).map(item => [item.tab, item.person, item.amount, item.debt]).sort((a, b) => a[0].localeCompare(b[0], "tr") || a[1].localeCompare(b[1], "tr"));
    assert.deepEqual(items, [["2025 Aidat", "Ali Veli", 1200, 1200], ["2025 Aidat", "Ayşe Kaya", 600, 600], ["2026 Aidat", "Ali Veli", 800, 800], ["2026 Aidat", "Ayşe Kaya", 600, 600]]);
    assert.deepEqual(dues.notes, [`2 ${SPLIT_NOTE("2025 Aidat, 2026 Aidat")} Dosya No: D-5 (Ali Veli), D-7 (Ayşe Kaya).`]);
  });
});

describe("31e A1: kopya sekme iki kez sayılır + not; söz sekmesi (borç değil) not açmaz, söz kaleminin Kalan Borç'u borç sekmesinden (B3/B4/B6)", () => {
  const ctx = setup([
    { name: "Liste", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Vade"], ["K-1", "Can Yıldız", "500", d(2)], ["K-2", "Ece Ak", "900", d(5)]] },
    { name: "Liste Kopya", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Vade"], ["K-1", "Can Yıldız", "500", d(2)]] },
    { name: "Sözler", matrix: [["Dosya No", "Ad Soyad", "Söz Tarihi", "Söz Tutarı"], ["K-2", "Ece Ak", d(3), "300"]] },
  ]);
  const NOTE = `1 ${SPLIT_NOTE("Liste, Liste Kopya")} Dosya No: K-1 (Can Yıldız).`;

  test("Tablodaki Kişiler: Can Yıldız 500 + 500 = 1.000 (kopya iki kez), Ece Ak 900 (söz borç değil); yalnız K-1 notu", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Can Yıldız": 1000, "Ece Ak": 900 });
    assert.deepEqual(report.notes, [NOTE]);
  });

  test("Tahsilat Takvimi: Can iki kalem (500, 500), Ece Liste 900 + söz 300 (Kalan Borç 900, Liste'den); not", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.person).map(item => [item.person, item.tab, item.amount, item.debt]).sort((a, b) => a[0].localeCompare(b[0], "tr") || a[1].localeCompare(b[1], "tr"));
    assert.deepEqual(items, [["Can Yıldız", "Liste", 500, 500], ["Can Yıldız", "Liste Kopya", 500, 500], ["Ece Ak", "Liste", 900, 900], ["Ece Ak", "Sözler", 300, 900]]);
    assert.deepEqual(dues.notes, [NOTE]);
  });
});

// Aday 13 cari kâhini (rastgele-ux18-2): dönem sekmesinde aynı kişinin birden çok satırı ("2025 Aidat": ad tekrarlanır) sekmenin kendi analizinde "Borçlu"yu
// kişi kolonu yapmıyordu (31a F4 sekme başına analiz) → satırlar adsız, dosya no ile ayrı grup ("T2/001" 3.686,48 + "Tablo Kişi 2-1" 79). 2.4.3 aynı kişide
// topluyordu. Kural: sekme analizi kişi / kimlik / telefon kolonunu bulamazsa ve sekmede oturumun seçtiği kolon varsa o kullanılır. A1 (ayrı borç) aynen.
describe("31e aday 13: dönem sekmesinde tekrarlanan ad — kişi adı oturumun kişi kolonundan, aynı kişinin sekmelerdeki borcu tek grupta", () => {
  // Kâhinin ürettiği tablonun iki aidat sekmesi aynen (2025 Aidat'ta 10 satırda 4 ad: tekillik 0,4 < 0,5 → sekme analizi "Borçlu"yu kişi saymıyordu). Söz sekmesi
  // gerekmez; tetikleyici adların tekrar oranı. Beklenen tutarlar hücrelerin toplamı (v2.4.3 de aynı grupları verir).
  const H = ["Dosya No", "Borçlu", "Telefon", "Tutar"];
  const ctx = setup([
    { name: "2026 Aidat", matrix: [H, ["T2/005", "Tablo Kişi 2-5", "", "2.024,39 ₺"], ["T2/006", "Tablo Kişi 2-6", "", "29,00 ₺"], ["T2/007", "Tablo Kişi 2-7", "", "98,00 ₺"], ["T2/007", "Tablo Kişi 2-7", "", "2.973,32 ₺"], ["T2/001", "Tablo Kişi 2-1", "", "79,00 ₺"], ["T2/002", "Tablo Kişi 2-2", "", "69,00 ₺"], ["T2/002", "Tablo Kişi 2-2", "", "4.787,25 ₺"]] },
    { name: "2025 Aidat", matrix: [H, ["T2/003", "Tablo Kişi 2-3", "", "9,00 ₺"], ["T2/003", "Tablo Kişi 2-3", "", "87,00 ₺"], ["T2/003", "Tablo Kişi 2-3", "", "5.017,14 ₺"], ["T2/004", "Tablo Kişi 2-4", "", "78,00 ₺"], ["T2/004", "Tablo Kişi 2-4", "", "4.166,62 ₺"], ["T2/004", "Tablo Kişi 2-4", "", "17,00 ₺"], ["T2/001", "Tablo Kişi 2-1", "", "3.686,48 ₺"], ["T2/002", "Tablo Kişi 2-2", "", "2.324,10 ₺"], ["T2/002", "Tablo Kişi 2-2", "", "60,00 ₺"], ["T2/002", "Tablo Kişi 2-2", "", "36,00 ₺"]] },
  ]);

  test("Tablodaki Kişiler: Kişi 2-1 79 + 3.686,48 = 3.765,48 tek grup; Kişi 2-2 69 + 4.787,25 + 2.324,10 + 60 + 36 = 7.276,35; dosya no adlı grup yok", async () => {
    const { report } = await ctx.report("cari-ekstre");
    const groups = debitBy(report);
    assert.deepEqual(groups, { "Tablo Kişi 2-1": 3765.48, "Tablo Kişi 2-2": 7276.35, "Tablo Kişi 2-3": 5113.14, "Tablo Kişi 2-4": 4261.62, "Tablo Kişi 2-5": 2024.39, "Tablo Kişi 2-6": 29, "Tablo Kişi 2-7": 3071.32 }, `gruplar: ${JSON.stringify(report.groups.map(group => [group.cari, group.debit]))}`);
    // Para toplamları kuruş üzerinden (yan bulgu: önceden 25541.300000000003 gibi kalıntı API'ye çıkıyordu).
    assert.equal(report.totals.debit, 25541.3);
  });
});

describe("31e aday 13 yan bulgu: tablo raporlarında para toplamları kuruşta (kayan nokta kalıntısı yok)", () => {
  const ctx = setup([{ name: "Taksitler", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Vade"], ["K-1", "Ali Veli", "0,10", d(1)], ["K-1", "Ali Veli", "0,20", d(2)]] }]);

  test("Tablodaki Kişiler: Ali Veli 0,10 + 0,20 = 0,30 (borç, bakiye, satır bakiyesi), toplam 0,30 — tam eşitlik", async () => {
    const { report } = await ctx.report("cari-ekstre");
    const ali = report.groups.find(group => group.cari === "Ali Veli");
    assert.deepEqual([ali.debit, ali.balance, ali.lines.at(-1).bakiye], [0.3, 0.3, 0.3], `Ali Veli: ${JSON.stringify([ali.debit, ali.balance, ali.lines.map(line => line.bakiye)])}`);
    assert.deepEqual([report.totals.debit, report.totals.balance], [0.3, 0.3], `toplam: ${JSON.stringify(report.totals)}`);
  });

  test("Vadeler toplamı 0,10 + 0,20 = 0,30 — tam eşitlik", async () => {
    const vade = (await ctx.report("vade-takip")).report.totals;
    assert.equal(vade.amount, 0.3, `Vadeler: ${vade.amount}`);
  });

  test("Nakit Akışı Beklenen 0,30 ve her kova kuruşta — tam eşitlik", async () => {
    const nakit = (await ctx.report("nakit-akis")).report;
    assert.equal(nakit.totals.expected, 0.3, `Nakit Akışı: ${nakit.totals.expected}`);
    assert.ok(nakit.rows.every(row => row.expected === Math.round(row.expected * 100) / 100), `kova: ${JSON.stringify(nakit.rows.map(row => row.expected))}`);
  });
});

// 31e kontrol turu 3 (aday 14): C1 Sekme süzgeçli Vadeler / Nakit Akışı'nda öbür sekmenin tahsilatı bu sekmenin kalemini kapatıyordu (takvim yalnız seçili sekmeden kurulduğu
// için; 9c44652) — takvim bütün sekmelerden, kalemler sonra süzülür (2.4.3 yolu). C2 kuruş altı hücrede TOPLAM satırı ile özet 1 kuruş ayrışıyordu — satır kuruşa, toplam
// kuruştan. C3 aynı adlı iki kişi farklı T.C. Kimlik No ile tek grupta — kimlik önce. "Nasıl bozulur?" not defteri c-nasil-bozulur.md B1–B14.
describe("31e C1: Sekme süzgeçli Vadeler / Nakit Akışı — öbür sekmenin tahsilatı bu sekmenin kalemini kapatmaz (2.4.3 gibi)", () => {
  const H = ["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"];
  const ctx = setup([
    { name: "2025 Aidat", matrix: [H, ["D-5", "Ali Veli", "1.200", d(-2)], ["D-7", "Ayşe Kaya", "600", d(-1)], ["D-9", "Can Er", "0", d(-3)]] },
    { name: "2026 Aidat", matrix: [H, ["D-5", "Ali Veli", "800", d(3)], ["D-7", "Ayşe Kaya", "600", d(4)], ["D-9", "Can Er", "500", d(5)]] },
  ]);
  before(async () => {
    await ctx.must("2025 tahsilatı", ctx.admin.post(`/api/workspace/cases/${encodeURIComponent("D-7")}/payments`, { amount: 600, date: iso(-1), method: "cash", cashForce: true, note: "2025" }));
  });

  test("süzgeçsiz: 2025 Ayşe kalemi kapanır, 2026 açık — 4 kalem (1.200 + 800 + 600 + 500 = 3.100)", async () => {
    const vade = (await ctx.report("vade-takip")).report.totals;
    assert.deepEqual([vade.count, vade.amount], [4, 3100]);
  });

  test("Sekme 2026 Aidat: 3 kalem / 1.900 (Ali 800, Ayşe 600, Can 500); Nakit Akışı Beklenen 1.900; not yok (B1/B3)", async () => {
    const vade = (await ctx.report("vade-takip", "tabs=2026 Aidat")).report;
    assert.deepEqual([vade.totals.count, vade.totals.amount], [3, 1900], `kalemler: ${JSON.stringify(vade.table.rows.map(row => [row.cari, row.tab, row.amount]))}`);
    assert.deepEqual(vade.notes, []);
    const nakit = (await ctx.report("nakit-akis", "tabs=2026 Aidat")).report;
    assert.equal(nakit.totals.expected, 1900);
  });

  test("Sekme 2025 Aidat: 1 kalem (Ali 1.200; Ayşe ödendi, Can 0); öbür sekmenin kalemi sızmaz (B2); seçenekler iki sekme (B5)", async () => {
    const data = await ctx.report("vade-takip", "tabs=2025 Aidat");
    assert.deepEqual([data.report.totals.count, data.report.totals.amount], [1, 1200], `kalemler: ${JSON.stringify(data.report.table.rows.map(row => [row.cari, row.tab, row.amount]))}`);
    assert.deepEqual(data.tabs, ["2025 Aidat", "2026 Aidat"]);
  });
});

describe("31e C2: kuruş altı hücre — TOPLAM satırı = özet (ekran, Excel)", () => {
  const ctx = setup([{ name: "Borçlar", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["B-1", "Ali Veli", 333.3333333, d(-2)], ["B-2", "Ali Veli", 333.3333333, d(-3)], ["B-3", "Ali Veli", 333.3333333, d(-4)], ["B-5", "Can Er", "0,01", d(-5)], ["B-6", "Can Er", "0,1", d(-6)], ["B-7", "Can Er", "0,2", d(-7)]] }]);

  test("Tablodaki Kişiler: satırlar 333,33 × 3 + 0,01 + 0,10 + 0,20 = 1.000,30; TOPLAM satırı, toplam ve özet aynı (B7)", async () => {
    const data = await ctx.report("cari-ekstre");
    assert.equal(data.report.totals.debit, 1000.3);
    assert.equal(data.report.table.footer.borc, 1000.3, `TOPLAM satırı: ${JSON.stringify(data.report.table.footer)}`);
    assert.ok(data.summary.some(([label, value]) => label === "Toplam Borç" && value === "1.000,30 TL"), JSON.stringify(data.summary));
  });

  test("Vadeler TOPLAM satırı = özet (1.000,30)", async () => {
    const data = await ctx.report("vade-takip");
    assert.equal(data.report.table.footer.amount, 1000.3, `TOPLAM satırı: ${JSON.stringify(data.report.table.footer)}`);
    assert.equal(data.report.totals.amount, 1000.3);
  });

  test("Excel: TOPLAM satırının borç hücresi 1000.3, özet 1.000,30; 1000.31 yok", async () => {
    const sheets = xlsxSheets(await ctx.exportOf("cari-ekstre", "xlsx"));
    const table = Object.entries(sheets).find(([name]) => name !== "Özet")[1];
    const total = table.find(row => row[0] === "TOPLAM");
    assert.ok(total, `TOPLAM satırı yok: ${JSON.stringify(table.slice(-2))}`);
    const cells = total.map(cell => (typeof cell === "number" ? Math.round(cell * 100) / 100 : cell));
    assert.ok(cells.includes(1000.3) || cells.includes("1.000,30"), `TOPLAM: ${JSON.stringify(total)}`);
    assert.ok(!xlsxText(await ctx.exportOf("cari-ekstre", "xlsx")).includes("1000.31"), "1000.31 hücresi yok");
  });
});

describe("31e C3: aynı adlı iki kişi — farklı T.C. Kimlik No ayrı, aynı kimlik tek kişi; Vadeler aynı adı yazar", () => {
  const ctx = setup([
    { name: "Senetler", matrix: [["Ad Soyad", "TC Kimlik No", "Kalan", "Vade"], ["Ali Veli", "10000000146", "700", d(-2)], ["Ali Veli", "22222222222", "900", d(-6)], ["Ayşe Kaya", "33333333333", "300", d(-1)], ["A. Can Er", "44444444444", "400", d(-3)], ["Can Er", "44444444444", "250", d(-4)]] },
    { name: "Kiracılar", matrix: [["Kiracı", "Daire No", "Cep Tel", "Kira Bedeli", "Ödeme Günü"], ["Ali Veli", "K-1", "0555 999 99 99", "5.000", "5"], ["Ayşe Kaya", "K-3", "0532 222 22 22", "3.000", "6"]] },
  ]);

  test("Ali Veli üç kişi: TC 10000000146 700, TC 22222222222 900, kimliksiz Kiracılar 5.000 (iki kimliğe uyuyor, tahmin edilmez); Ayşe tek kimlik → 300 + 3.000 (B10/B11)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    const groups = debitBy(report);
    assert.equal(groups["Ali Veli (TC 10000000146)"], 700, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
    assert.equal(groups["Ali Veli (TC 22222222222)"], 900);
    assert.equal(groups["Ali Veli"], 5000);
    assert.equal(groups["Ayşe Kaya"], 3300, "aynı ad, biri kimliksiz: bugünkü kural (tek kimlik → aynı kişi)");
  });

  test("aynı kimlik, farklı ad yazımı ('A. Can Er' / 'Can Er'): tek kişi 650 (B12)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    const can = report.groups.filter(group => /Can Er/.test(group.cari));
    assert.deepEqual(can.map(group => group.debit), [650], JSON.stringify(can.map(group => [group.cari, group.debit])));
  });

  test("Vadeler: iki Ali Veli kalemi kimlik ekiyle, Tablodaki Kişiler ile aynı ad (B14)", async () => {
    const rows = (await ctx.report("vade-takip")).report.table.rows.filter(row => /Ali Veli/.test(row.cari)).map(row => [row.cari, row.amount]).sort((a, b) => a[1] - b[1]);
    assert.deepEqual(rows.filter(([, amount]) => amount === 700 || amount === 900), [["Ali Veli (TC 10000000146)", 700], ["Ali Veli (TC 22222222222)", 900]], JSON.stringify(rows));
  });
});

describe("31e Y1: Tablodaki Nakit Akışı'nda Kasa sütunları yalnız Kasa yetkisiyle", () => {
  const ctx = setup(null);
  let staff;
  const NOTE = "Kasa sütunları Kasa yetkisi gerektirir; bu raporda Kasa giriş, çıkış ve bakiye gösterilmiyor.";
  before(async () => {
    const account = await ctx.must("cari", ctx.admin.post("/api/workspace/accounts", { name: "Y1 Cari", type: "customer", phone: "0500 031 00 11" }));
    await ctx.must("borç", ctx.admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "debt", amount: 2000, date: iso(-3), note: "borç" }));
    await ctx.must("nakit tahsilat", ctx.admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: 1000, date: iso(-2), method: "cash", cashForce: true }));
    await ctx.must("elle kasa", ctx.admin.post("/api/workspace/cash", { kind: "in", amount: 500, date: iso(-1), description: "elle giriş", method: "cash" }));
    await ctx.must("kullanıcı", ctx.admin.post("/api/admin/users", { username: "rapor1", name: "Rapor Kişisi", role: "personel", password: "Rapor-Parola-1234", mustChangePassword: false, grants: { add: ["reports.view"], remove: [] } }));
    staff = ctx.server.client();
    assert.equal((await staff.login("rapor1", "Rapor-Parola-1234")).status, 200);
  });

  test("yetkili (yönetici): Kasa Giriş 1.000 (cari nakit) + 500 (elle) = 1.500; Kasa sütunları ve özeti var, not yok (R9)", async () => {
    const data = await ctx.report("nakit-akis");
    assert.equal(data.report.totals.cashIn, 1500);
    assert.ok(data.report.table.columns.some(column => column.key === "cashIn"));
    assert.ok(data.summary.some(([label]) => label === "Kasa Giriş"));
    assert.ok(!(data.report.notes || []).includes(NOTE));
  });

  test("Kasa yetkisi olmayan (yalnız Tablo Raporları): Kasa'ya 403; Nakit Akışı'nda Kasa sütunu, toplamı, özeti yok; not var — ekran, PDF, Excel (R8)", async () => {
    assert.equal((await staff.get("/api/workspace/cash")).status, 403, "Kasa ekranı yetkisiz");
    const data = await ctx.report("nakit-akis", "", staff);
    for (const key of ["cashIn", "cashOut", "net"]) assert.ok(!(key in data.report.totals), `toplamda ${key} yok`);
    assert.deepEqual(data.report.table.columns.filter(column => ["cashIn", "cashOut", "net", "cumulative", "projected"].includes(column.key)), [], "Kasa sütunu yok");
    assert.ok(data.report.table.rows.every(row => !("cashIn" in row) && !("cashOut" in row)), "satırlarda Kasa yok");
    assert.ok(!data.summary.some(([label]) => /Kasa|Net/.test(label)), `özet: ${JSON.stringify(data.summary)}`);
    assert.ok(data.report.notes.includes(NOTE));
    const pdf = flat(pdfText(await ctx.exportOf("nakit-akis", "pdf", {}, staff)));
    assert.ok(pdf.includes("Kasa sütunları Kasa yetkisi gerektirir"), "PDF notu");
    assert.ok(!pdf.includes("Kasa Giriş"), "PDF'te Kasa Giriş yok");
    const xlsx = xlsxText(await ctx.exportOf("nakit-akis", "xlsx", {}, staff));
    assert.ok(xlsx.includes("Kasa sütunları Kasa yetkisi gerektirir"), "Excel notu");
    assert.ok(!xlsx.includes("Kasa Giriş") && !xlsx.includes("1500"), "Excel'de Kasa Giriş ve 1.500 yok");
  });
});
