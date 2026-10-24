// 2.4.4 31e (bağımsız dar kontrol) bulguları — kullanıcı adına 5 dk yetkisiyle verilen kararlar (23.10.2026 03:12 UTC):
// T4  AYNI sekmede aynı Dosya No'lu birden çok satır (taksit / dönem satırı) ayrı borç ve ayrı takvim kalemidir (2.4.3 gibi); kayıt borcu satırların toplamı.
// (a) → A1 (DEĞİŞTİ, 23.10.2026 04:09 UTC): FARKLI sekmelerde aynı Dosya No ayrı borç ve ayrı vade kalemidir (2.4.3 gibi); rapor ve Tahsilat Takvimi bunu
//     görünür not olarak söyler; Sekme süzgeci seçilince her sekme kendi borcunu gösterir.
// T1  Kalan / Borç başlığı yoksa ve ödenen + toplam sütunu varsa satır borcu = toplam − ödenen (negatifse 0 + not); ödenen tutar borç sayılmaz.
// Y1  Tablodaki Nakit Akışı'nda Kasa sütunları yalnız Kasa'yı görme yetkisi (cash.view) olana; Tablo Raporları yetkisi tek başına Kasa'yı açmaz. (2.4.5 madde 5: Kasa sütunları
//     bu rapordan bütünüyle kalktı.)
// Beklenen sayılar tablo hücrelerinden ve girilen tutarlardan (ders 5); kâhin değil, kodu yazan elin testi.
// "Nasıl bozulur?" (not defteri r31e-nasil-bozulur.md R1–R10): R1 aynı sekmede satırlar tek borca katlanır (2.4.4 aday 11: Ali 1.500, Ayşe 700) · R2 takvim
// kalemleri birleşir · R3 Sekme süzgeci bir kez sayılan sekmeyi seçince öbür sekmenin borcu kaybolur · R4 not yalnız ekranda (PDF/Excel'de yok) · R5 ödenen
// tutar borç sayılır (2.4.3: Satışlar 10.000 + 8.000 + 6.000) ya da hiç borç yok (aday 11: "Tutar" + "Tahsil Edilen" tablosu Kişiler'de yok) · R6 ödenen > toplam
// eksi borç · R7 Kalan varken net hesaplanır · R8 Kasa yetkisi olmayan Kasa toplamlarını görür (2.4.3'te de) · R9 yetkili kişide Kasa sütunu kaybolur ·
// R10 Tablodan Aktar ile Tablodaki Kişiler aynı dosyada farklı kalan gösterir.
// 2.4.5 madde 4 (uyarı kapısı): bu dosya tablo takvim motorunu zil / Tahsilat Takvimi / Vade Takip / Projeksiyon uçlarından sınar → 2.4.4 davranışı (legacyTableDues, yalnız testler).
import "./fixtures/saat-dilimi-istanbul.mjs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { amountCandidates } from "../server/lib/insight/debt-column.mjs";

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
    ctx.server = await startTestServer({ now: NOW, legacyTableDues: true });
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
    assert.deepEqual(items, [["Ali Veli", 1000, 2500], ["Ali Veli", 1500, 2500], ["Ayşe Kaya", 700, 1400], ["Ayşe Kaya", 700, 1400], ["Can Yıldız", 400, 1000], ["Can Yıldız", 600, 1000]], "kalemler birleşmez (R2); Kalan Borç dosya toplamı (5b Açılış Bakiyesi)");
    // Can Yıldız: tek tutar sütunu kalem tutarı ("Taksit Tutarı"). 31e tur 8 kararı (Y1/5b, 23.10.2026): Açılış Bakiyesi raporların borcudur — Tablodaki Kişiler
    // 1.000 → Kalan Borç 1.000 (8871ccf'deki "kalem tutarı Kalan Borç sayılmaz, Açılış Bakiyesi boş" kuralı bu kararla kalktı).
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
    // 2.4.5 madde 5: özet adı tablodaki tutarın muhasebe kaydı olmadığını söyler.
    assert.ok(data.summary.some(([label, value]) => label === "Tablodaki Toplam Borç (Muhasebe Kaydı Değil)" && value === "1.000,30 TL"), JSON.stringify(data.summary));
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
    { name: "Senetler", matrix: [["Ad Soyad", "TC Kimlik No", "Kalan", "Vade"], ["Ali Veli", "10000000146", "700", d(-2)], ["Ali Veli", "12345678950", "900", d(-6)], ["Ayşe Kaya", "33333333333", "300", d(-1)], ["A. Can Er", "44444444444", "400", d(-3)], ["Can Er", "44444444444", "250", d(-4)]] },
    { name: "Kiracılar", matrix: [["Kiracı", "Daire No", "Cep Tel", "Kira Bedeli", "Ödeme Günü"], ["Ali Veli", "K-1", "0555 999 99 99", "5.000", "5"], ["Ayşe Kaya", "K-3", "0532 222 22 22", "3.000", "6"]] },
  ]);

  test("Ali Veli üç kişi: TC 10000000146 700, TC 12345678950 900, kimliksiz Kiracılar 5.000 (iki kimliğe uyuyor, tahmin edilmez); Ayşe tek kimlik → 300 + 3.000 (B10/B11)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    const groups = debitBy(report);
    assert.equal(groups["Ali Veli (TC 10000000146)"], 700, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
    assert.equal(groups["Ali Veli (TC 12345678950)"], 900);
    assert.equal(groups["Ali Veli"], 5000);
    assert.equal(groups["Ayşe Kaya"], 3300, "aynı ad, biri kimliksiz: bugünkü kural (tek kimlik → aynı kişi)");
  });

  // D1 (aday 15 dar kontrolü, 23.10.2026): kimlik yalnız AYNI adlı grupları ayırır; farklı adlar kimlik yüzünden birleşmez (v2.4.3 gibi ayrı) — önceki "tek kişi 650"
  // beklentisi bilerek değişti (yer tutucu kimlikte — 11111111111 — farklı kişiler birleşiyordu).
  test("aynı kimlik, farklı ad yazımı ('A. Can Er' / 'Can Er'): iki ayrı kişi 400 / 250 (D1, v2.4.3 gibi)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    const can = report.groups.filter(group => /Can Er/.test(group.cari)).map(group => [group.cari, group.debit]).sort((x, y) => x[1] - y[1]);
    assert.deepEqual(can, [["Can Er", 250], ["A. Can Er", 400]], JSON.stringify(can));
  });

  test("Vadeler: iki Ali Veli kalemi kimlik ekiyle, Tablodaki Kişiler ile aynı ad (B14)", async () => {
    const rows = (await ctx.report("vade-takip")).report.table.rows.filter(row => /Ali Veli/.test(row.cari)).map(row => [row.cari, row.amount]).sort((a, b) => a[1] - b[1]);
    assert.deepEqual(rows.filter(([, amount]) => amount === 700 || amount === 900), [["Ali Veli (TC 10000000146)", 700], ["Ali Veli (TC 12345678950)", 900]], JSON.stringify(rows));
  });
});

// 31e D1 (aday 15 dar kontrolü): yer tutucu kimlik (TC 11111111111, VKN 0000000000) taşıyan FARKLI adlı kişiler tek grupta toplanıyor, öbür adlar Tablodaki Kişiler'den
// düşüyordu (17cc5f4 C3'ün gerilemesi). Kural: kimlik yalnız aynı adlı grupları ayırır. "Nasıl bozulur?" not defteri d-nasil-bozulur.md B1–B7.
describe("31e D1: aynı kimlik farklı ad — ayrı kişiler (v2.4.3 gibi); aynı ad aynı kimlik tek kişi", () => {
  const H = ["Dosya No", "Ad Soyad", "TC Kimlik No", "Kalan Borç", "Son Ödeme"];
  const ctx = setup([
    { name: "Satışlar", matrix: [H, ["P-1", "Ali Veli", "11111111111", "100", d(-2)], ["P-2", "Ayşe Kaya", "11111111111", "200", d(-3)], ["P-3", "Can Er", "11111111111", "300", d(-4)], ["P-4", "Deniz Ak", "12345678950", "400", d(-5)], ["P-5", "Ece Su", "0000000000", "500", d(-6)], ["P-6", "Fırat Er", "0000000000", "600", d(-7)], ["P-7", "Gül Ay", "22222222222", "50", d(-8)], ["P-8", "Gül Ay", "22222222222", "70", d(-9)]] },
  ]);

  test("Tablodaki Kişiler: 7 kişi, her biri kendi adıyla (Ali 100, Ayşe 200, Can 300, Deniz 400, Ece 500, Fırat 600, Gül Ay iki satır tek kişi 120); kimlik eki yok (B1/B3/B7)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ali Veli": 100, "Ayşe Kaya": 200, "Can Er": 300, "Deniz Ak": 400, "Ece Su": 500, "Fırat Er": 600, "Gül Ay": 120 }, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
  });

  test("Vadeler aynı adlar (8 kalem)", async () => {
    const rows = (await ctx.report("vade-takip")).report.table.rows.map(row => row.cari);
    assert.deepEqual([...new Set(rows)].sort((x, y) => x.localeCompare(y, "tr")), ["Ali Veli", "Ayşe Kaya", "Can Er", "Deniz Ak", "Ece Su", "Fırat Er", "Gül Ay"], JSON.stringify(rows));
    assert.equal(rows.length, 8);
  });
});

// 31e V1 (cari kâhini İNCELE, 23.10.2026): "Vergi No" başlıklı sütun (sağlaması tutmayan 10 hane) tutar sanılıyordu → tabloda iki tutar sütunu, borç yok, Tablodaki Kişiler
// boş (2.4.3'te de). Kural: kimlik / numara başlıklı sütun tutar sayılmaz; sağlaması tutmayan numara kişi gruplamasında kimlik sayılmaz. V2: iki kimlikli adın kimliksiz satırı
// (kimlik sütunu olmayan sekme) AYNI dosya no'lu kimlikli satırın kişisine katılır. "Nasıl bozulur?" not defteri v-nasil-bozulur.md B1–B7.
describe("31e V1: 'Vergi No' sütunu tutar değil; Tablodaki Kişiler borcu Tutar'dan; sağlaması tutmayan numara kişiyi bölmez", () => {
  const ctx = setup([
    { name: "Firmalar", matrix: [["Dosya No", "Unvan", "Vergi No", "Tutar", "Vade"], ["F-1", "Alfa Ltd", "1234567890", "1.000", d(-2)], ["F-2", "Beta AŞ", "2345678901", "2.000", d(-3)], ["F-3", "Gama Ltd", "3456789012", "3.000", d(-4)], ["F-4", "Gama Ltd", "4567890123", "500", d(-5)]] },
  ]);

  test("Kişiler: Alfa 1.000, Beta 2.000, Gama 3.000 + 500 (geçersiz iki numara kişiyi bölmez) — toplam 6.500 (B1/B4)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Alfa Ltd": 1000, "Beta AŞ": 2000, "Gama Ltd": 3500 }, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
    assert.equal(report.totals.debit, 6500);
  });

  test("Vadeler 4 kalem, 6.500", async () => {
    const vade = (await ctx.report("vade-takip")).report.totals;
    assert.deepEqual([vade.count, vade.amount], [4, 6500]);
  });
});

describe("31e V2: iki kimlikli adın kimliksiz satırı aynı dosya no'nun kişisine katılır", () => {
  const ctx = setup([
    { name: "Üyeler", matrix: [["Dosya No", "Ad Soyad", "TC Kimlik No", "Kalan Borç", "Vade"], ["K-1", "Ayşe Yıldız", "10000000146", "100", d(-2)], ["K-2", "Ayşe Yıldız", "12345678950", "200", d(-3)]] },
    { name: "2026 Aidat", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Vade"], ["K-1", "Ayşe Yıldız", "50", d(4)], ["K-3", "Ayşe Yıldız", "70", d(5)]] },
  ]);

  test("TC 10000000146: K-1 100 + K-1 (Aidat) 50 = 150; TC 12345678950: 200; dosya no eşleşmeyen K-3 adın kimliksiz grubu 70 (B6/B7)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ayşe Yıldız (TC 10000000146)": 150, "Ayşe Yıldız (TC 12345678950)": 200, "Ayşe Yıldız": 70 }, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
  });
});

// 2.4.5 madde 5 (bilerek değişti): Tablodaki Nakit Akışı'nda Kasa sütunları HİÇ KİMSEDE yok (yetkili yönetici dahil; Kasa, Kasa raporlarında). Y1'in yetkisiz
// kişi kuralı kendiliğinden sağlanır (R8); yetkili kişide sütunun "kaybolması" (R9) artık beklenen davranıştır. Yetki notu da gereksizdir (yazılmaz).
describe("31e Y1 → 2.4.5 madde 5: Tablodaki Nakit Akışı'nda Kasa sütunu kimsede yok (yetkili ve yetkisiz)", () => {
  const ctx = setup(null);
  let staff;
  const NOTE = "Kasa sütunları Kasa yetkisi gerektirir; bu raporda Kasa giriş, çıkış ve bakiye gösterilmiyor.";
  const CASH = ["cashIn", "cashOut", "net", "cumulative", "projected"];
  before(async () => {
    const account = await ctx.must("cari", ctx.admin.post("/api/workspace/accounts", { name: "Y1 Cari", type: "customer", phone: "0500 031 00 11" }));
    await ctx.must("borç", ctx.admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "debt", amount: 2000, date: iso(-3), note: "borç" }));
    await ctx.must("nakit tahsilat", ctx.admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: 1000, date: iso(-2), method: "cash", cashForce: true }));
    await ctx.must("elle kasa", ctx.admin.post("/api/workspace/cash", { kind: "in", amount: 500, date: iso(-1), description: "elle giriş", method: "cash" }));
    await ctx.must("kullanıcı", ctx.admin.post("/api/admin/users", { username: "rapor1", name: "Rapor Kişisi", role: "personel", password: "Rapor-Parola-1234", mustChangePassword: false, grants: { add: ["reports.view"], remove: [] } }));
    staff = ctx.server.client();
    assert.equal((await staff.login("rapor1", "Rapor-Parola-1234")).status, 200);
  });

  for (const [who, client] of [["yetkili (yönetici)", () => null], ["Kasa yetkisi olmayan (yalnız Tablo Raporları)", () => staff]]) {
    test(`${who}: Nakit Akışı'nda Kasa sütunu, toplamı, özeti ve Kasa notu yok — ekran, PDF, Excel (R8; R9 artık beklenen)`, async () => {
      if (client()) assert.equal((await client().get("/api/workspace/cash")).status, 403, "Kasa ekranı yetkisiz");
      const data = await ctx.report("nakit-akis", "", client() || undefined);
      for (const key of CASH) assert.ok(!(key in data.report.totals), `toplamda ${key} yok`);
      assert.deepEqual(data.report.table.columns.filter(column => CASH.includes(column.key)), [], "Kasa sütunu yok");
      assert.ok(data.report.table.rows.every(row => CASH.every(key => !(key in row))), "satırlarda Kasa yok");
      assert.ok(!data.summary.some(([label]) => /Kasa|Net/.test(label)), `özet: ${JSON.stringify(data.summary)}`);
      assert.ok(!(data.report.notes || []).includes(NOTE), "yetki notu yok");
      const pdf = flat(pdfText(await ctx.exportOf("nakit-akis", "pdf", {}, client() || undefined)));
      assert.ok(!pdf.includes("Kasa sütunları Kasa yetkisi gerektirir") && !pdf.includes("Kasa Giriş"), "PDF'te Kasa Giriş ve not yok");
      const xlsx = xlsxText(await ctx.exportOf("nakit-akis", "xlsx", {}, client() || undefined));
      assert.ok(!xlsx.includes("Kasa sütunları Kasa yetkisi gerektirir") && !xlsx.includes("Kasa Giriş") && !xlsx.includes("1500"), "Excel'de Kasa Giriş, 1.500 ve not yok");
    });
  }
});

// 31e tur 7 N4 (karar): vergi başlıklı kolon YALNIZ sekmede başka bir tutar kolonu varken borç adayından çıkar; tek tutar kolonu vergi başlıklıysa borç odur.
// Bütün tablo raporları ve Tahsilat Takvimi aynı borç planını kullanır; notsuz düşme hiçbir yolda yok (aday 17: Kişiler 900 / Vadeler 19.500).
describe("31e tur 7 N4: tek tutar kolonu vergi başlıklı sekme Tablodaki Kişiler'de borç; Kişiler = Vadeler; Tutar + KDV'de borç Tutar", () => {
  const ctx = setup([
    { name: "Vergiler", matrix: [["Mükellef", "Vergi Türü", "Vergi Tutarı", "Son Ödeme"], ["Ali Veli", "KDV", "1.500", d(-2)], ["Ayşe Kaya", "Muhtasar", "2.500", d(-3)], ["Can Er", "Gelir Vergisi", "3.500", d(-4)]] },
    { name: "Emlak", matrix: [["Ad Soyad", "Emlak Vergisi", "Son Ödeme"], ["Deniz Ak", "4.000", d(-2)], ["Ece Su", "5.000", d(-3)]] },
    { name: "KdvListe", matrix: [["Firma", "KDV", "Vade"], ["Fırat Er", "600", d(-2)], ["Gül Taş", "700", d(-3)]] },
    { name: "Stopaj", matrix: [["Ad Soyad", "Stopaj Tutarı", "Son Ödeme"], ["Hale Ak", "800", d(-2)]] },
    { name: "KdvBorcu", matrix: [["Ad Soyad", "KDV Borcu", "Son Ödeme"], ["İlker Su", "900", d(-2)]] },
    { name: "Faturalar", matrix: [["Ad Soyad", "Tutar", "KDV", "Son Ödeme"], ["Jale Er", "1.000", "180", d(-2)]] },
  ]);

  test("Kişiler: her sekmenin tek tutar kolonu borç (19.500) + Faturalar'da Tutar 1.000 (KDV 180 borç değil) = 20.500; not yok", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ali Veli": 1500, "Ayşe Kaya": 2500, "Can Er": 3500, "Deniz Ak": 4000, "Ece Su": 5000, "Fırat Er": 600, "Gül Taş": 700, "Hale Ak": 800, "İlker Su": 900, "Jale Er": 1000 }, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
    assert.equal(report.totals.debit, 20500);
    assert.deepEqual(report.notes, []);
  });

  test("Vadeler 10 kalem 20.500 = Kişiler; Takvim'de Jale Er borcu 1.000", async () => {
    const vade = (await ctx.report("vade-takip")).report.totals;
    assert.deepEqual([vade.count, vade.amount], [10, 20500]);
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    assert.deepEqual(dues.items.filter(item => item.person === "Jale Er").map(item => [item.amount, item.debt]), [[1000, 1000]]);
  });
});

// Söz sekmesi borç değildir ve not açmaz (31f U2; A1 B4 "söz sekmesi boşuna not"); seyrek "Kalan Borç" kolonunu Tahsilat Takvimi ile Tablodaki Kişiler aynı
// kuralla bulur (aday 17: Takvim'de 500, Kişiler'de notsuz yok).
describe("31e tur 7 N4: seyrek 'Kalan Borç' (çoğu yazı) sayı olan satırda borç — Kişiler ile Takvim aynı; yalnız Söz Tutarı olan sekme borç değil, not açmaz", () => {
  const ctx = setup([
    { name: "Sozler", matrix: [["Ad Soyad", "Söz Tutarı", "Söz Tarihi"], ["Ali Söz", "1000", d(2)], ["Ayşe Söz", "1100", d(3)]] },
    { name: "Seyrek", matrix: [["Ad Soyad", "Kalan Borç", "Son Ödeme", "Açıklama"], ["Ali Seyrek", "500", d(-2), "a"], ["Ayşe Seyrek", "görüşülecek", d(-3), "b"], ["Can Seyrek", "belirsiz", d(-4), "c"], ["Deniz Seyrek", "sorulacak", d(-5), "d"], ["Ece Seyrek", "yok", d(-6), "e"]] },
  ]);

  test("Kişiler: Ali Seyrek 500 (aday 17'de düşüyordu); söz satırları borç değil; not yok", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ali Seyrek": 500 }, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
    assert.deepEqual(report.notes, []);
  });

  test("Takvim: Ali Seyrek borç 500 (Kalan Borç), sözler söz tutarıyla", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const pick = name => dues.items.filter(item => item.person === name).map(item => [item.amount, item.debt]);
    assert.deepEqual(pick("Ali Seyrek"), [[500, 500]]);
    assert.deepEqual(pick("Ali Söz"), [[1000, null]]);
  });
});

// 31e tur 8 Y1 (karar): borç kolonu yalnız tutar kolonudur — telefon, TCKN/VKN/kimlik, tarih, kişi rollü kolon ve "Borçlu …" gibi kişi özniteliği başlığı hiçbir
// zaman borç değildir; bütün yollar (Kişiler, Takvim / zil / Ödeme Sözü / "Önce cari açın" Açılış Bakiyesi, Vade Takip, Nakit Akışı) aynı yardımcıdan. Borç kolonu
// seçilemeyen Tutar + Masraf sekmesi görünür notla (aday 17 gibi). Aday 18: Kişiler'de Ali Veli 5.321.112.233 TL, Deniz Ak 10.000.000.146 TL; Takvim / Vade / Nakit'te
// v2.4.3'ten beri aynı numaralar tutar.
describe("31e tur 8 Y1: 'Borçlu Telefon' / 'Borçlu TC' kolonu borç değil — Kişiler, Takvim, Vadeler, Nakit Akışı; Tutar + Masraf sekmesi notla", () => {
  const ctx = setup([
    { name: "BorcluTel", matrix: [["Dosya No", "Borçlu", "Borçlu Telefon", "Son Ödeme"], ["2026/1", "Ali Veli", "05321112233", d(-2)], ["2026/2", "Ayşe Kaya", "05321112244", d(-3)], ["2026/3", "Can Er", "05321112255", d(-4)]] },
    { name: "BorcluTC", matrix: [["Dosya No", "Borçlu", "Borçlu TC", "Tutar", "Masraf", "Son Ödeme"], ["2026/11", "Deniz Ak", "10000000146", "1.000", "50", d(-2)], ["2026/12", "Ece Su", "12345678950", "2.000", "60", d(-3)], ["2026/13", "Fırat Er", "10000000078", "3.000", "70", d(-4)]] },
    { name: "AlacakliAdi", matrix: [["Müşteri", "Alacaklı", "Tutar", "KDV", "Vade"], ["Pınar Su", "ABC Ltd", "1.000", "200", d(-2)], ["Rıza Ak", "XYZ AŞ", "2.000", "400", d(-3)]] },
    // Kolon analizi 6 haneli sicil numarasına tutar rolü veriyor; "Borçlu …" başlığı yine borç değildir.
    { name: "BorcluSicil", matrix: [["Dosya No", "Borçlu", "Borçlu Sicil", "Son Ödeme"], ["2026/21", "Gül Taş", "125478", d(-2)], ["2026/22", "Hale Ak", "225479", d(-3)]] },
    // Başlık "Borç …" (borç başlığı), kolon analizi telefon rolü veriyor: rol tek başına borcu dışlar.
    { name: "BorcluTCHatali", matrix: [["Dosya No", "Borçlu", "Borçlu TC", "Son Ödeme"], ["2026/41", "Rana Ak", "12345678901", d(-2)], ["2026/42", "Sena Ak", "22345678902", d(-3)]] },
    { name: "BorcIletisim", matrix: [["Dosya No", "Ad Soyad", "Borç İletişim", "Son Ödeme"], ["2026/31", "Jale Er", "05321112266", d(-2)], ["2026/32", "Kemal Su", "05321112277", d(-3)]] },
  ]);

  test("başlık kuralı: 'Borçlu', 'Borçlu Sicil', 'Alacaklı' tutar değil; 'Borçlu Tutarı', 'Bakiye Borçlu' tutardır", () => {
    const of = columns => amountCandidates(columns.map(column => ({ column, role: "money" })));
    assert.deepEqual(of(["Borçlu", "Borçlu Sicil", "Alacaklı", "Borçlu Tutarı", "Bakiye Borçlu", "Tutar"]), ["Borçlu Tutarı", "Bakiye Borçlu", "Tutar"]);
  });
  const NOTE = "“BorcluTC” sekmesinde borç sütunu seçilemedi (Tutar, Masraf): bu satırlar borç olarak sayılmadı. Borç sütununun başlığını “Kalan Borç”, “Toplam Borç” ya da “Genel Toplam” yapın.";
  // 31e tur 15: Y1 kararının "borç kolonu yoksa … görünür not" kısmı — tutar kolonu olmayan dört sekme (yalnız telefon / TC / sicil) de sekmeyi adlandıran notla
  // (tur 8'de bu beklenti yalnız BorcluTC notunu yazıyordu; kararın bu kısmı uygulanmamıştı, kâhin b3n yakaladı).
  const MISSING = tab => `“${tab}” sekmesinde borç sütunu yok: bu satırlar borç olarak sayılmadı. Borç için “Kalan Borç”, “Toplam Borç” ya da “Tutar” başlıklı bir sütun ekleyin.`;

  test("Kişiler: yalnız Pınar Su 1.000 ve Rıza Ak 2.000 (toplam 3.000); telefon / TC numarası borç değil; BorcluTC için not, tutar kolonu olmayan sekmeler için not", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Pınar Su": 1000, "Rıza Ak": 2000 }, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
    assert.equal(report.totals.debit, 3000);
    assert.deepEqual(report.notes, [NOTE, MISSING("BorcluTel"), MISSING("BorcluSicil"), MISSING("BorcluTCHatali"), MISSING("BorcIletisim")]);
  });

  test("Takvim: BorcluTel / BorcluTC kalemlerinde tutar ve borç yok (Açılış Bakiyesi ön dolumu boş); hiçbir kalemin borç kolonu kimlik / telefon değil", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const of = tab => dues.items.filter(item => item.tab === tab).map(item => [item.person, item.amount ?? null, item.debt ?? null]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(of("BorcluTel"), [["Ali Veli", null, null], ["Ayşe Kaya", null, null], ["Can Er", null, null]]);
    assert.deepEqual(of("BorcluTC"), [["Deniz Ak", null, null], ["Ece Su", null, null], ["Fırat Er", null, null]]);
    assert.deepEqual(of("BorcluSicil"), [["Gül Taş", null, null], ["Hale Ak", null, null]]);
    assert.deepEqual(of("BorcIletisim"), [["Jale Er", null, null], ["Kemal Su", null, null]]);
    assert.deepEqual(of("BorcluTCHatali"), [["Rana Ak", null, null], ["Sena Ak", null, null]], "sağlaması tutmayan TC (sayı rolü) de borç değil: 'Borçlu TC' başlığı");
    assert.ok(dues.items.every(item => !/Borçlu|TC|Telefon/.test(item.debtColumn || "")), JSON.stringify(dues.items.map(item => item.debtColumn)));
  });

  test("Vadeler ve Nakit Akışı Beklenen 3.000 (aday 18: 48.309.027.906)", async () => {
    const vade = (await ctx.report("vade-takip")).report.totals;
    assert.equal(vade.amount, 3000);
    const nakit = (await ctx.report("nakit-akis")).report.totals;
    assert.equal(nakit.expected, 3000);
  });
});

// 31e tur 8 Y3 (karar, 30a ailesi; bağımsız kâhin b3o ile aynı okuma): Kalan doluysa borç Kalan; Kalan hücresi boşsa satırın ana tutarı (borç başlıklı / Genel Toplam /
// TEK tutar kolonu); ana tutar belirlenemiyorsa (iki aday: Aidat + Gecikme Faizi, Tutar + Masraf) borç yok + görünür not. K4: Tablodaki Kişiler, Takvim, Vade Takip ve
// Nakit Akışı AYNI satır borcunu kullanır (aday 18: Takvim / Vade / Nakit Kalan'ı dolu satırda da Aidat'ı alıyor, iki adaylı satırı Aidat sayıyordu; Kişiler'de
// Kalan'ı boş satırlar notsuz düşüyordu).
describe("31e tur 8 Y3: seyrek 'Kalan Borç' — Kalan önce, boşsa tek ana tutar, iki adayda not; dört rapor aynı satır borcu (K4)", () => {
  const ctx = setup([
    { name: "SeyrekKalan", matrix: [["Ad Soyad", "Aidat", "Gecikme Faizi", "Kalan Borç", "Son Ödeme"], ["Gül Taş", "500", "20", "", d(-2)], ["Hale Ak", "500", "30", "530", d(-3)], ["İlker Su", "500", "40", "", d(-4)]] },
    { name: "IkiAday", matrix: [["Ad Soyad", "Tutar", "Masraf", "Kalan Borç", "Son Ödeme"], ["Jale Er", "1.000", "50", "", d(-2)], ["Kemal Su", "2.000", "60", "1.500", d(-3)]] },
    // Kalan Borç çoğu yazı (seyrek, metin rolü) + tek tutar Aidat: Kalan önce, boş / yazı ise Aidat. Aday 18: Kalan yok sayılıyordu (Oğuz 500).
    { name: "SeyrekYazi", matrix: [["Ad Soyad", "Aidat", "Kalan Borç", "Son Ödeme"], ["Mehmet Ay", "500", "", d(-2)], ["Nalan Ay", "500", "görüşülecek", d(-3)], ["Oğuz Ay", "500", "250", d(-4)], ["Pelin Ay", "500", "sorulacak", d(-5)]] },
  ]);
  const NOTES = [
    "“SeyrekKalan” sekmesinde “Kalan Borç” boş olan satırların borç sütunu seçilemedi (Aidat, Gecikme Faizi): bu satırlar borç olarak sayılmadı. “Kalan Borç” hücresini doldurun ya da tutar sütununun başlığını “Toplam Borç” ya da “Genel Toplam” yapın.",
    "“IkiAday” sekmesinde “Kalan Borç” boş olan satırların borç sütunu seçilemedi (Tutar, Masraf): bu satırlar borç olarak sayılmadı. “Kalan Borç” hücresini doldurun ya da tutar sütununun başlığını “Toplam Borç” ya da “Genel Toplam” yapın.",
  ];

  test("Kişiler: Hale 530, Kemal 1.500, Mehmet 500, Nalan 500, Oğuz 250, Pelin 500 (toplam 3.780); Gül, İlker, Jale notla", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Hale Ak": 530, "Kemal Su": 1500, "Mehmet Ay": 500, "Nalan Ay": 500, "Oğuz Ay": 250, "Pelin Ay": 500 }, JSON.stringify(report.groups.map(group => [group.cari, group.debit])));
    assert.equal(report.totals.debit, 3780);
    assert.deepEqual(report.notes, NOTES);
  });

  test("Takvim: Kalan Borç (Açılış Bakiyesi ön dolumu) = satır borcu; kalem = min(dönem tutarı, Kalan), Kalan boşsa dönem tutarı (tur 9 Z1: Hale 500 / Kalan 530; Gül ve İlker Aidat 500, borç yok + not); dönem kolonu yoksa kalem satır borcu (Jale tutarsız); not Takvim'de de", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const of = tab => dues.items.filter(item => item.tab === tab).map(item => [item.person, item.amount ?? null, item.debt ?? null]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(of("SeyrekKalan"), [["Gül Taş", 500, null], ["Hale Ak", 500, 530], ["İlker Su", 500, null]]);
    assert.deepEqual(of("IkiAday"), [["Jale Er", null, null], ["Kemal Su", 1500, 1500]]);
    assert.deepEqual(of("SeyrekYazi"), [["Mehmet Ay", 500, 500], ["Nalan Ay", 500, 500], ["Oğuz Ay", 250, 250], ["Pelin Ay", 500, 500]]);
    assert.deepEqual(dues.notes, NOTES);
  });

  test("Z1: Vade Takip ve Nakit Akışı Beklenen 4.750 = kalemler (SeyrekKalan 1.500 + IkiAday 1.500 + SeyrekYazi 1.750); Tablodaki Kişiler 3.780 (satır borcu)", async () => {
    const vade = await ctx.report("vade-takip");
    assert.equal(vade.report.totals.amount, 4750);
    assert.deepEqual(vade.report.notes, NOTES);
    const nakit = await ctx.report("nakit-akis");
    assert.equal(nakit.report.totals.expected, 4750);
  });
});

// 31e tur 8 (Y1 / 5b, bağımsız kâhin b3b): "Önce cari açın" Açılış Bakiyesi (takvim kaleminin Kalan Borç'u) raporların satır borcudur — tek kalem tutarlı sekmede de
// (Aylık Ücret 4.000; "Kalan Gün" gün sayısıdır). Aday 18: raporlar 4.000, Açılış Bakiyesi boş.
describe("31e tur 8 5b: tek kalem tutarlı sekmede Açılış Bakiyesi ön dolumu = raporların borcu", () => {
  const ctx = setup([
    { name: "Kira", matrix: [["Dosya No", "Ad Soyad", "Aylık Ücret", "Kalan Gün", "Son Ödeme"], ["2026/207", "Sevgi Ak", "4.000", "12", d(-2)]] },
  ]);

  test("Kişiler 4.000; Takvim kalemi tutar 4.000, Kalan Borç 4.000 (borç kolonu Aylık Ücret)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Sevgi Ak": 4000 });
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    assert.deepEqual(dues.items.filter(item => item.tab === "Kira").map(item => [item.person, item.amount, item.debt, item.debtColumn]), [["Sevgi Ak", 4000, 4000, "Aylık Ücret"]]);
  });
});

// K4 kuralının sınırı: ödeme sözü kalemi söz tutarıdır (31f U2) — sekmede Kalan Borç olsa da kalem Kalan'ı almaz; kaydın borcu (Kalan Borç) ayrı alanda.
describe("31e tur 8 K4 sınırı: Söz Tutarı + Kalan Borç sekmesinde söz kalemi söz tutarıyla", () => {
  const ctx = setup([
    { name: "SozKalan", matrix: [["Ad Soyad", "Söz Tarihi", "Söz Tutarı", "Kalan Borç"], ["Tuna Ak", d(3), "300", "900"], ["Ufuk Er", d(4), "1.200", "900"]] },
  ]);

  test("Takvim: söz kalemi söz tutarı (300; Kalan'ı aşan 1.200 sözü de sınırlanmaz — Z1 yalnız dönem / taksit tutarı), Kalan Borç 900; Kişiler 900 + 900", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    assert.deepEqual(dues.items.filter(item => item.tab === "SozKalan").map(item => [item.person, item.amount, item.debt]).sort((a, b) => a[0].localeCompare(b[0], "tr")), [["Tuna Ak", 300, 900], ["Ufuk Er", 1200, 900]]);
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Tuna Ak": 900, "Ufuk Er": 900 });
  });
});

// 31e tur 9 Z1 (baş mimar kararı, 23.10.2026): takvim kalemi vadesi gelen tutardır ve kalan borçtan büyük olamaz — kalemin kendi dönem / taksit tutarı varsa kalem =
// min(kalem tutarı, satırın Kalan'ı), yoksa satırın borcu. Tablodaki Kişiler ve Açılış Bakiyesi satır borcunda (Kalan) kalır. v2.4.3 ve aday 18 ile aynı; aday 19
// (975217f) taksit tablosunda kalemi bütün Kalan yapıyordu (Kaan Uz 1.000 → 9.000 "gecikmiş", Nakit Beklenen 3.500 → 13.500).
describe("31e tur 9 Z1: tek vadeli taksit tablosu — kalem taksit tutarı (Kalan'dan büyük değil), borç Kalan", () => {
  const ctx = setup([
    { name: "TaksitKalan", matrix: [["Ad Soyad", "Taksit Tutarı", "Kalan Borç", "Sonraki Taksit Tarihi"], ["Kaan Uz", "1.000", "9.000", d(-2)], ["Lale Gün", "2.000", "4.000", d(3)], ["Mert Can", "500", "", d(-5)], ["Nur Ay", "1.500", "600", d(-1)]] },
  ]);

  test("Takvim: Kaan 1.000 (Kalan 9.000), Lale 2.000 (Kalan 4.000), Mert 500 (Kalan boş → taksit), Nur 600 (taksit 1.500 > Kalan 600)", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.tab === "TaksitKalan").map(item => [item.person, item.amount, item.debt]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items, [["Kaan Uz", 1000, 9000], ["Lale Gün", 2000, 4000], ["Mert Can", 500, 500], ["Nur Ay", 600, 600]]);
  });

  test("Vadeler ve Nakit Akışı Beklenen 4.100 (kalemler); Tablodaki Kişiler 14.100 (Kalan)", async () => {
    assert.equal((await ctx.report("vade-takip")).report.totals.amount, 4100);
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 4100);
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Kaan Uz": 9000, "Lale Gün": 4000, "Mert Can": 500, "Nur Ay": 600 });
  });
});

// Z1 eki: dönem kolonu birden çoksa (Aidat + Kira) kalem satırın borcudur — Kalan doluysa Kalan; Kalan boşsa ana tutar belirlenemez (not), kalem tutarsız.
describe("31e tur 9 Z1 eki: iki dönem kolonu (Aidat + Kira) — kalem satırın borcu", () => {
  const ctx = setup([
    { name: "IkiDonem", matrix: [["Ad Soyad", "Aidat", "Kira", "Kalan Borç", "Son Ödeme"], ["Ozan Er", "300", "2.000", "1.800", d(-2)], ["Pınar Ak", "300", "2.000", "", d(-3)]] },
  ]);

  test("Takvim: Ozan 1.800 (Kalan), Pınar tutarsız (borç belirlenemiyor) + not", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    assert.deepEqual(dues.items.filter(item => item.tab === "IkiDonem").map(item => [item.person, item.amount ?? null, item.debt ?? null]).sort((a, b) => a[0].localeCompare(b[0], "tr")), [["Ozan Er", 1800, 1800], ["Pınar Ak", null, null]]);
    assert.ok(dues.notes.some(note => note.startsWith("“IkiDonem” sekmesinde “Kalan Borç” boş olan satırların")), JSON.stringify(dues.notes));
  });
});

// 31e tur 10 (dar kontrol aday 20; ikisi v2.4.3'te de, ORTA): Z2 — Kalan hücresi sayı ve 0 ya da EKSİ (fazla ödeme) olan satırdan tahsilat beklenmez, kalem çıkmaz
// (min(dönem, Kalan) ≤ 0; Kalan 0 zaten atlanıyordu). Tablodaki Kişiler satır borcunu olduğu gibi gösterir (Ali Veli −100; değişmedi). Z3 — ödeme sözü kalemi SÖZ
// TUTARIdır: söz tutarı kolonu önce gelir (Taksit Tutarı kolonu olan sekmede söz kalemi taksit tutarını alıyordu); söz tutarı hücresi boşsa önceki kural.
describe("31e tur 10 Z2/Z3: fazla ödemeli satırda kalem yok; söz kalemi söz tutarı", () => {
  const ctx = setup([
    { name: "FazlaOdeme", matrix: [["Ad Soyad", "Aidat", "Kalan Borç", "Son Ödeme"], ["Ali Veli", "1.000", "-100", d(-2)], ["Ayşe Kaya", "1.000", "1.500", d(-3)], ["Can Er", "1.000", "", d(-4)]] },
    { name: "SozKalan", matrix: [["Ad Soyad", "Taksit Tutarı", "Kalan Borç", "Söz Tarihi", "Söz Tutarı"], ["Kaan Uz", "1.000", "9.000", d(1), "3.000"], ["Lale Gün", "2.000", "4.000", d(2), ""], ["Mehmet Ay", "5.000", "3.000", d(2), ""]] },
    // Kâhin b3r: dönem kolonu OLMAYAN sekmede de Kalan ≤ 0 satırın kalemi yok (aday 20: Dilek Su tutarsız kalem).
    { name: "Borclar", matrix: [["Ad Soyad", "Kalan Borç", "Son Ödeme"], ["Dilek Su", "-250", d(1)], ["Ege Tan", "800", d(1)]] },
  ]);

  test("Z2 Takvim: Ali Veli (Kalan −100) kalemi yok; Ayşe 1.000 (Kalan 1.500), Can 1.000 (Kalan boş); Kişiler Ali −100, Ayşe 1.500, Can 1.000", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.tab === "FazlaOdeme").map(item => [item.person, item.amount, item.debt ?? null]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items, [["Ayşe Kaya", 1000, 1500], ["Can Er", 1000, 1000]]);
    const { report } = await ctx.report("cari-ekstre", `tabs=${encodeURIComponent("FazlaOdeme")}`);
    assert.deepEqual(debitBy(report), { "Ali Veli": -100, "Ayşe Kaya": 1500, "Can Er": 1000 });
  });

  test("Z2 Vadeler ve Nakit Akışı (Sekme: FazlaOdeme) Beklenen 2.000 (aday 20: 3.000)", async () => {
    const query = `tabs=${encodeURIComponent("FazlaOdeme")}`;
    assert.equal((await ctx.report("vade-takip", query)).report.totals.amount, 2000);
    assert.equal((await ctx.report("nakit-akis", query)).report.totals.expected, 2000);
  });

  test("Z3 Takvim: Kaan'ın söz kalemi 3.000 (söz tutarı; Kalan 9.000); söz tutarı boşsa önceki kural min(Taksit, Kalan): Lale 2.000, Mehmet 3.000 (5.000 > Kalan 3.000)", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.tab === "SozKalan").map(item => [item.person, item.amount, item.debt ?? null, Boolean(item.promise)]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items, [["Kaan Uz", 3000, 9000, true], ["Lale Gün", 2000, 4000, true], ["Mehmet Ay", 3000, 3000, true]]);
  });

  test("Z2 dönem kolonu olmayan sekme: Dilek Su (Kalan −250) kalemi yok, Ege Tan 800", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    assert.deepEqual(dues.items.filter(item => item.tab === "Borclar").map(item => [item.person, item.amount]), [["Ege Tan", 800]]);
  });
});

// 31e tur 11 Z4 (YÜKSEK, 007eb2e gerilemesi): söz başlığı tam sözcüktür — "Sözleşme Tutarı" / "Sözleşme Son Ödeme" söz DEĞİLDİR (`soz\w*` "sözleşme"yi
// yakalıyordu: söz kalemi bütün sözleşme bedeli, Nakit 12.800 → 153.300; vade kolonu "Ödeme sözü" etiketi alıyordu). Söz tutarı kolonu söz sözcüğü + tutar
// sözcüğü ister ("Söz Tutarı", "Ödeme Sözü Tutarı", "Taahhüt Tutarı"); sütun yoksa ya da hücre boşsa önceki kural — dönem tutarı (Kalan ile sınırlı), dönem kolonu
// yoksa satırın borcu (kâhin b3t). Ek karar: "Sözleşme Tarihi" / "Sözleşme Başlangıç" vade / söz tarihi değildir, kalem açmaz (aday 21'de de açmıyordu — koruma).
describe("31e tur 11 Z4: 'Sözleşme Tutarı' söz tutarı değil; 'Sözleşme Son Ödeme' söz değil; 'Sözleşme Tarihi' / 'Başlangıç' vade değil", () => {
  const ctx = setup([
    { name: "SozlesmeOnce", matrix: [["Ad Soyad", "Sözleşme Tutarı", "Kalan Borç", "Söz Tarihi", "Söz Tutarı"], ["Ali Veli", "50.000", "9.000", d(2), "3.000"], ["Ayşe Kaya", "40.000", "2.000", d(3), ""]] },
    { name: "SozlesmeYalniz", matrix: [["Ad Soyad", "Sözleşme Tutarı", "Kalan Borç", "Söz Tarihi"], ["Can Er", "60.000", "5.000", d(2)]] },
    { name: "SozlesmeVade", matrix: [["Ad Soyad", "Kira Bedeli", "Sözleşme Son Ödeme"], ["Jale Er", "4.000", d(5)]] },
    { name: "SozlesmeTarih", matrix: [["Ad Soyad", "Kira Bedeli", "Sözleşme Tarihi", "Sözleşme Başlangıç"], ["Kemal Su", "3.000", d(5), d(-5)], ["Lale Ak", "2.000", d(-3), d(3)]] },
  ]);

  test("Takvim: Ali söz 3.000, Ayşe söz hücresi boş → Kalan 2.000, Can söz 5.000 (Kalan; söz sütunu yok); Jale'nin kalemi söz değil, 4.000; Sözleşme Tarihi / Başlangıç kalem açmaz", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.tab.startsWith("Sozlesme")).map(item => [item.person, item.amount ?? null, Boolean(item.promise), item.label]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items.map(item => item.slice(0, 3)), [["Ali Veli", 3000, true], ["Ayşe Kaya", 2000, true], ["Can Er", 5000, true], ["Jale Er", 4000, false]]);
    assert.notEqual(items.find(item => item[0] === "Jale Er")[3], "Ödeme sözü", "vade kolonu 'Ödeme sözü' etiketi almaz");
  });

  test("Vadeler ve Nakit Akışı Beklenen 14.000 (aday 21: 154.000); Sözleşme Tarihi sekmesinden vade satırı yok", async () => {
    const vade = (await ctx.report("vade-takip")).report;
    assert.equal(vade.totals.amount, 14000);
    assert.ok(!vade.table.rows.some(row => /Kemal Su|Lale Ak/.test(row.cari || "")), JSON.stringify(vade.table.rows.map(row => row.cari)));
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 14000);
  });
});

// 31e tur 11 Z4 (mutasyon M49'un dişi): söz tutarı sütunu söz sözcüğü + TUTAR sözcüğü ister. "Söz Öncesi Ödenen" söz sözcüğü taşır ama söz tutarı değildir →
// söz kalemi önceki kuralla satırın borcu (Kalan 6.000), 1.500 DEĞİL. "Taahhüt Tutarı" ve "Ödeme Sözü Tutarı" söz tutarıdır (kâhin b3u ile aynı başlıklar).
describe("31e tur 11 Z4: söz tutarı yalnız 'söz/sözü/taahhüt' + 'tutar' başlığıdır", () => {
  const ctx = setup([
    { name: "SozOncesi", matrix: [["Ad Soyad", "Kalan Borç", "Söz Tarihi", "Söz Öncesi Ödenen"], ["Mert Can", "6.000", d(4), "1.500"]] },
    { name: "TaahhutTutari", matrix: [["Ad Soyad", "Kalan Borç", "Taahhüt Tarihi", "Taahhüt Tutarı"], ["Nil Er", "7.000", d(6), "2.500"]] },
    { name: "OdemeSozuTutari", matrix: [["Ad Soyad", "Kalan Borç", "Ödeme Sözü", "Ödeme Sözü Tutarı"], ["Oya Su", "8.000", d(7), "1.000"]] },
  ]);

  test("Takvim: Mert 6.000 (Kalan; 'Söz Öncesi Ödenen' söz tutarı değil), Nil 2.500 (Taahhüt Tutarı), Oya 1.000 (Ödeme Sözü Tutarı); üçü de söz kalemi", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.map(item => [item.person, item.amount ?? null, Boolean(item.promise)]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items, [["Mert Can", 6000, true], ["Nil Er", 2500, true], ["Oya Su", 1000, true]]);
  });

  test("Vadeler ve Nakit Akışı Beklenen 9.500", async () => {
    assert.equal((await ctx.report("vade-takip")).report.totals.amount, 9500);
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 9500);
  });
});

// 31e tur 12 Z5 (DÜŞÜK, 26e6573 gerilemesi) / Z6 (DÜŞÜK, v2.4.3'te de): taahhüt ailesi ÖNEK olarak söz (taahhüt, taahhütname, taahhütlü, taahhüdü); söz ailesi tam sözcük
// (söz, sözü) — dışarıda kalan yalnız "sözleşme…". Söz tutarı sütununda "tutar" ya da "miktar" sözcüğü yeter. "Taahhütlü Ücret" söz tutarı değil, dönem tutarıdır.
// Aday 22: Gül 2.500 / Işıl 4.500 (söz değil, satır borcu), Fırat 3.000 / Hakan 3.500 (söz miktarı okunmuyor), Kemal kalemi yok.
describe("31e tur 12 Z5/Z6: taahhüt öneki söz; söz tutarı 'tutar' ya da 'miktar'; 'Taahhütlü Ücret' dönem tutarı", () => {
  const ctx = setup([
    { name: "Taahhutname", matrix: [["Ad Soyad", "Kalan Borç", "Taahhütname Tarihi", "Taahhüt Tutarı"], ["Gül Taş", "2.500", d(4), "500"]] },
    { name: "Taahhutlu", matrix: [["Ad Soyad", "Kalan Borç", "Taahhütlü Ödeme Tarihi", "Taahhüt Tutarı"], ["Işıl Ay", "4.500", d(5), "800"]] },
    { name: "TaahhuduTarihi", matrix: [["Ad Soyad", "Kalan Borç", "Taahhüdü Tarihi", "Taahhüdü Tutarı"], ["Kemal Su", "2.000", d(7), "300"]] },
    { name: "OdemeTaahhudu", matrix: [["Ad Soyad", "Kalan Borç", "Ödeme Taahhüdü", "Taahhüdü Tutarı"], ["Jale Er", "5.500", d(6), "1.100"]] },
    { name: "SozMiktari", matrix: [["Ad Soyad", "Kalan Borç", "Söz Tarihi", "Söz Miktarı"], ["Fırat Er", "3.000", d(2), "600"]] },
    { name: "TaahhutMiktari", matrix: [["Ad Soyad", "Kalan Borç", "Taahhüt Tarihi", "Taahhüt Miktarı"], ["Hakan Öz", "3.500", d(3), "700"]] },
    { name: "TelekomVade", matrix: [["Ad Soyad", "Taahhütlü Ücret", "Kalan Borç", "Son Ödeme"], ["Mina Er", "450", "1.350", d(5)]] },
  ]);

  test("Takvim: söz kalemleri söz tutarı / miktarı (Gül 500, Işıl 800, Kemal 300, Jale 1.100, Fırat 600, Hakan 700); Mina 450 (Taahhütlü Ücret dönem tutarı, söz değil)", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.map(item => [item.person, item.amount ?? null, Boolean(item.promise), item.label]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items.map(item => item.slice(0, 3)), [["Fırat Er", 600, true], ["Gül Taş", 500, true], ["Hakan Öz", 700, true], ["Işıl Ay", 800, true], ["Jale Er", 1100, true], ["Kemal Su", 300, true], ["Mina Er", 450, false]]);
    assert.deepEqual([...new Set(items.filter(item => item[2]).map(item => item[3]))], ["Ödeme sözü"]);
  });

  test("Vadeler ve Nakit Akışı Beklenen 4.450 (aday 22: 15.050)", async () => {
    assert.equal((await ctx.report("vade-takip")).report.totals.amount, 4450);
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 4450);
  });
});

// 31e tur 13 (ORTA, sakınca süzgeci: borç tutarı yanlış, Kişiler ↔ Takvim tutarsız): söz tutarı sütunu TEK tanım (debt-column.mjs isPromiseAmountHeader) —
// söz ailesi tam sözcük YA DA taahhüt öneki, ve "tutar" ya da "miktar". Söz tutarı BORÇ DEĞİLDİR (A1), hiçbir yolda: borç düzeni (Tablodaki Kişiler, Açılış
// Bakiyesi ön dolumu) aynı yardımcıyla söz tutarını borç adayı saymaz. Aday 22: "Taahhütname Tutarı" / "Taahhütlü Tutar" Kişiler'de borç (700 / 800; Kalan'ı
// boş satırda 400), "Tutar" + söz tutarı sekmesinde borç yok (Pelin notsuz düşüyor, Rıza "seçilemedi" notu). "Taahhütlü Ücret" borç kalır (5b).
describe("31e tur 13: söz tutarı tek tanım, hiçbir yolda borç değil; 'Taahhütlü Ücret' borç kalır", () => {
  const ctx = setup([
    { name: "TaahhutnameYalniz", matrix: [["Ad Soyad", "Taahhütname Tarihi", "Taahhütname Tutarı"], ["Lale Ak", d(3), "700"]] },
    { name: "TaahhutluTutar", matrix: [["Ad Soyad", "Taahhütlü Ödeme Tarihi", "Taahhütlü Tutar"], ["Mert Su", d(4), "800"]] },
    { name: "SozMiktariYalniz", matrix: [["Ad Soyad", "Söz Tarihi", "Söz Miktarı"], ["Nur Ak", d(3), "900"]] },
    { name: "TelekomTek", matrix: [["Ad Soyad", "Taahhütlü Ücret", "Ödeme Günü"], ["Oya Er", "450", "15"]] },
    { name: "TutarVeSoz", matrix: [["Ad Soyad", "Tutar", "Söz Tarihi", "Söz Tutarı"], ["Pelin Su", "5.000", d(2), "1.000"]] },
    { name: "TutarVeTaahhutname", matrix: [["Ad Soyad", "Tutar", "Taahhütname Tarihi", "Taahhütname Tutarı"], ["Rıza Ak", "6.000", d(2), "1.200"]] },
    { name: "KalanBosTaahhutname", matrix: [["Ad Soyad", "Kalan Borç", "Taahhütname Tarihi", "Taahhütname Tutarı"], ["Selin Ay", "", d(5), "400"], ["Tarık Er", "2.000", d(6), "300"]] },
  ]);

  test("Tablodaki Kişiler: söz tutarı borç değil (Lale, Mert, Nur, Selin yok); Tutar borç (Pelin 5.000, Rıza 6.000); Taahhütlü Ücret borç (Oya 450); not yok", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Oya Er": 450, "Pelin Su": 5000, "Rıza Ak": 6000, "Tarık Er": 2000 });
    assert.deepEqual(report.notes || [], []);
  });

  test("Takvim: söz kalemi söz tutarı, kalemin borcu (Açılış Bakiyesi ön dolumu) raporun satır borcu — söz tutarı değil", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.filter(item => item.tab !== "TelekomTek").map(item => [item.person, item.amount ?? null, item.debt ?? null, Boolean(item.promise)]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items, [["Lale Ak", 700, null, true], ["Mert Su", 800, null, true], ["Nur Ak", 900, null, true], ["Pelin Su", 1000, 5000, true], ["Rıza Ak", 1200, 6000, true], ["Selin Ay", 400, null, true], ["Tarık Er", 300, 2000, true]]);
  });
});

// 31e tur 14 (ORTA, f8e9ae4 gerilemesi + para): YALIN söz / taahhüt kolonu ("Ödeme Sözü", "Söz", "Taahhüt"; tutar / miktar / dönem sözcüğü yok) PARA KOLONU
// SAYILMAZ — borç adayı değildir, söz kalemi tutarı da olmaz (A1 "Ödeme Sözü tutarı borç değil"; tek tanım debt-column.mjs isBarePromiseHeader). Dönem sözcüğü
// taşıyan ("Taahhütlü Ücret", "Taahhütlü Kira") normal sınıflanır (5b). f8e9ae4: "Ödeme Sözü" 1.500 Kişiler'de borç (aday 22'de değildi); "Tutar" + "Ödeme Sözü"
// sekmesinde "seçilemedi" notu. Aday 22: Ali'nin söz kalemi "Ödeme Sözü" kolonundan 1.500; Deniz borçsuz, notsuz.
describe("31e tur 14: yalın 'Ödeme Sözü' / 'Söz' / 'Taahhüt' kolonu para kolonu değil; 'Taahhütlü Ücret' / 'Taahhütlü Kira' normal", () => {
  const ctx = setup([
    { name: "OdemeSozuYalin", matrix: [["Ad Soyad", "Ödeme Sözü Tarihi", "Ödeme Sözü"], ["Ali Can", d(3), "1.500"]] },
    { name: "SozYalin", matrix: [["Ad Soyad", "Söz Tarihi", "Söz"], ["Banu Ay", d(4), "2.000"]] },
    { name: "TaahhutYalin", matrix: [["Ad Soyad", "Taahhüt Tarihi", "Taahhüt"], ["Cem Er", d(5), "2.500"]] },
    { name: "TutarVeOdemeSozu", matrix: [["Ad Soyad", "Tutar", "Ödeme Sözü Tarihi", "Ödeme Sözü"], ["Deniz Su", "4.000", d(2), "1.000"]] },
    { name: "BorcVeSoz", matrix: [["Ad Soyad", "Borç", "Ödeme Sözü Tarihi", "Ödeme Sözü"], ["Ece Ak", "3.000", d(4), "500"]] },
    { name: "TaahhutluUcret", matrix: [["Ad Soyad", "Taahhütlü Ücret", "Son Ödeme"], ["Fikret Öz", "450", d(5)]] },
    { name: "TaahhutluKira", matrix: [["Ad Soyad", "Taahhütlü Kira", "Son Ödeme"], ["Gaye Su", "3.000", d(6)]] },
    { name: "KalanVeSoz", matrix: [["Ad Soyad", "Kalan Borç", "Söz Tarihi", "Söz"], ["Hakan Su", "", d(3), "700"], ["Irmak Ay", "1.800", d(4), "600"]] },
  ]);

  test("Tablodaki Kişiler: yalın söz kolonu borç değil (Ali, Banu, Cem, Hakan yok); Deniz 4.000 (Tutar tek tutar); Taahhütlü Ücret / Kira borç; not yok", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Deniz Su": 4000, "Ece Ak": 3000, "Fikret Öz": 450, "Gaye Su": 3000, "Irmak Ay": 1800 });
    assert.deepEqual(report.notes || [], []);
  });

  test("Takvim: yalın söz kolonu söz kalemi tutarı olmaz (Ali boş); Deniz söz kalemi satır borcu 4.000; dönem kolonları kalem tutarı", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.map(item => [item.person, item.amount ?? null, item.debt ?? null, Boolean(item.promise)]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items, [["Ali Can", null, null, true], ["Banu Ay", null, null, true], ["Cem Er", null, null, true], ["Deniz Su", 4000, 4000, true], ["Ece Ak", 3000, 3000, true], ["Fikret Öz", 450, 450, false], ["Gaye Su", 3000, 3000, false], ["Hakan Su", null, null, true], ["Irmak Ay", 1800, 1800, true]]);
  });

  test("Vadeler ve Nakit Akışı Beklenen 12.250 (aday 22 ve f8e9ae4: 9.750)", async () => {
    assert.equal((await ctx.report("vade-takip")).report.totals.amount, 12250);
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 12250);
  });
});

// 31e tur 15 (ORTA; Y1 kararı eksik uygulanmıştı): "Borç kolonu yoksa (yalnız kişi / tarih kolonları; söz de yok) … borç YOK (bütün raporlarda 0) ve satır görünür
// ya da raporda görünür not." Aday 22: "Takip" (Dosya No, Borçlu, Borçlu Telefon, Son Ödeme) kişileri Tablodaki Kişiler'den NOTSUZ düşüyordu (görünen tek not
// "Masrafli"yi adlandırıyordu). Şimdi Kişiler, Vadeler ve Nakit Akışı sekmeyi adlandıran not yazar (Y1 notunun biçimi); söz sekmesi (A1) not açmaz.
describe("31e tur 15: tutar kolonu olmayan sekme notsuz düşmez; söz sekmesi not açmaz", () => {
  const MISSING = tab => `“${tab}” sekmesinde borç sütunu yok: bu satırlar borç olarak sayılmadı. Borç için “Kalan Borç”, “Toplam Borç” ya da “Tutar” başlıklı bir sütun ekleyin.`;
  const UNRESOLVED = "“Masrafli” sekmesinde borç sütunu seçilemedi (Tutar, Masraf): bu satırlar borç olarak sayılmadı. Borç sütununun başlığını “Kalan Borç”, “Toplam Borç” ya da “Genel Toplam” yapın.";
  const ctx = setup([
    { name: "Takip", matrix: [["Dosya No", "Borçlu", "Borçlu Telefon", "Son Ödeme"], ["2026/701", "Can Er", "0532 111 22 33", d(3)], ["2026/702", "Ece Su", "0533 444 55 66", d(4)]] },
    { name: "Masrafli", matrix: [["Dosya No", "Borçlu", "Tutar", "Masraf"], ["2026/703", "Deniz Ak", "1.000", "150"]] },
    { name: "Aidat", matrix: [["Ad Soyad", "Borçlu Telefon", "Tutar"], ["Hale İn", "0535 777 88 99", "1.000"]] },
    { name: "SozTarihYalniz", matrix: [["Ad Soyad", "Söz Tarihi"], ["Kaan Ay", d(2)]] },
    { name: "Rehber", matrix: [["Ad Soyad", "Telefon"], ["Lale Su", "0536 123 45 67"]] },
  ]);

  test("Tablodaki Kişiler: borç yalnız Hale 1.000; Takip ve Rehber sekmeyi adlandıran notla, Masrafli 'seçilemedi' notuyla; söz sekmesi notsuz", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Hale İn": 1000 });
    assert.deepEqual(report.notes, [UNRESOLVED, MISSING("Takip"), MISSING("Rehber")]);
  });

  test("Vadeler ve Nakit Akışı aynı notlar; Takip kalemleri görünür, tutarsız (borç 0); Sekme süzgecinde yalnız seçili sekmenin notu", async () => {
    const vade = (await ctx.report("vade-takip")).report;
    assert.deepEqual(vade.notes, [UNRESOLVED, MISSING("Takip"), MISSING("Rehber")]);
    assert.equal(vade.totals.amount, 0);
    const nakit = (await ctx.report("nakit-akis")).report;
    assert.deepEqual(nakit.notes, [UNRESOLVED, MISSING("Takip"), MISSING("Rehber")]);
    assert.equal(nakit.totals.expected, 0);
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    assert.deepEqual(dues.items.filter(item => item.tab === "Takip").map(item => [item.person, item.amount ?? null, item.debt ?? null]).sort((a, b) => a[0].localeCompare(b[0], "tr")), [["Can Er", null, null], ["Ece Su", null, null]]);
    assert.deepEqual((await ctx.report("cari-ekstre", "tabs=Takip")).report.notes, [MISSING("Takip")]);
  });
});

// 31e tur 16 (aday 23 gerilemeleri, tur 13–14 farkından). R1 ORTA: yalın söz kuralı borç / alacak / kalan / bakiye / toplam ailesi sözcüklü taahhüt sütununu da para
// dışı sayıyordu ("Taahhüt Alacağı" kalemi 3.300 → boş; "Aylık Ücret" + "Taahhüt Bakiyesi" Kişiler / Açılış 300). Karar: bu başlıklar yalın söz DEĞİL (aday 22 gibi
// para kolonu; ekli biçimler yalnız bu muafiyette). R2 DÜŞÜK: söz tutarı adayı "Taahhüt Miktarı (Ay)" gibi gün / ay / % başlığı olamaz (söz kalemi 5.000 → 12).
describe("31e tur 16: borç ailesi sözcüklü taahhüt sütunu para kolonu; 'Taahhüt Miktarı (Ay)' söz tutarı değil", () => {
  const SECILEMEDI = "“TaahhutBakiye” sekmesinde borç sütunu seçilemedi (Aylık Ücret, Taahhüt Bakiyesi): bu satırlar borç olarak sayılmadı. Borç sütununun başlığını “Kalan Borç”, “Toplam Borç” ya da “Genel Toplam” yapın.";
  const ctx = setup([
    { name: "TaahhutluBorc", matrix: [["Ad Soyad", "Taahhütlü Borç", "Son Ödeme"], ["Ali Veli", "4.000", d(-2)], ["Ayşe Kaya", "5.000", d(-3)]] },
    { name: "TaahhutBakiye", matrix: [["Ad Soyad", "Aylık Ücret", "Taahhüt Bakiyesi", "Son Ödeme"], ["Can Er", "300", "2.100", d(-2)], ["Deniz Ak", "300", "", d(-3)]] },
    { name: "KalanTaahhut", matrix: [["Ad Soyad", "Kalan Taahhüt", "Son Ödeme"], ["Ece Su", "1.800", d(-2)], ["Fırat Er", "2.400", d(-3)]] },
    { name: "TaahhutAlacagi", matrix: [["Müşteri", "Taahhüt Alacağı", "Vade"], ["Gül Taş", "3.300", d(-2)], ["Hale Ak", "3.600", d(-3)]] },
    { name: "TaahhutTutariBorc", matrix: [["Abone", "Taahhüt Tutarı", "Son Ödeme"], ["İlker Su", "2.500", d(-2)], ["Kaan Uz", "2.700", d(-3)]] },
    { name: "TaahhutMiktariAy", matrix: [["Ad Soyad", "Kalan Borç", "Taahhüt Tarihi", "Taahhüt Miktarı (Ay)"], ["Nur Ak", "5.000", d(3), "12"]] },
  ]);

  test("Takvim: kalem tutarları aday 22 ile aynı (Gül 3.300, Hale 3.600, Can / Deniz 300, Nur 5.000); Can / Deniz borcu yok (Açılış Bakiyesi boş)", async () => {
    const dues = await ctx.must("takvim", ctx.admin.get("/api/workspace/dues"));
    const items = dues.items.map(item => [item.person, item.amount ?? null, item.debt ?? null, Boolean(item.promise)]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    assert.deepEqual(items, [["Ali Veli", 4000, 4000, false], ["Ayşe Kaya", 5000, 5000, false], ["Can Er", 300, null, false], ["Deniz Ak", 300, null, false], ["Ece Su", 1800, 1800, false], ["Fırat Er", 2400, 2400, false], ["Gül Taş", 3300, 3300, false], ["Hale Ak", 3600, 3600, false], ["İlker Su", 2500, null, false], ["Kaan Uz", 2700, null, false], ["Nur Ak", 5000, 5000, true]]);
  });

  test("Tablodaki Kişiler: Taahhüt Alacağı tek tutar sütunu borç; Aylık Ücret + Taahhüt Bakiyesi seçilemedi notuyla (300 borç sayılmaz); Vade / Nakit 30.900", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ali Veli": 4000, "Ayşe Kaya": 5000, "Ece Su": 1800, "Fırat Er": 2400, "Gül Taş": 3300, "Hale Ak": 3600, "Nur Ak": 5000 });
    assert.deepEqual(report.notes, [SECILEMEDI]);
    assert.equal((await ctx.report("vade-takip")).report.totals.amount, 30900);
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 30900);
  });
});
