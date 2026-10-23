// 2.4.4 31e (bağımsız dar kontrol) bulguları — kullanıcı adına 5 dk yetkisiyle verilen kararlar (23.10.2026 03:12 UTC):
// T4  AYNI sekmede aynı Dosya No'lu birden çok satır (taksit / dönem satırı) ayrı borç ve ayrı takvim kalemidir (2.4.3 gibi); kayıt borcu satırların toplamı.
// (a) FARKLI sekmelerde aynı Dosya No tek kayıttır (bir kez sayılır, 31b MM5) ama rapor bunu görünür not olarak söyler (ekran, PDF, Excel); Sekme süzgeci
//     seçilince her sekme kendi borcunu gösterir (dönem sekmesi tutan tablo).
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

describe("31e (a): farklı sekmelerde aynı dosya no bir kez sayılır, rapor bunu söyler; Sekme süzgeciyle her sekme kendi borcu", () => {
  const ctx = setup([
    { name: "2025 Aidat", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["D-5", "Ali Veli", "1.200", d(-40)], ["D-7", "Ayşe Kaya", "600", d(-35)]] },
    { name: "2026 Aidat", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["D-5", "Ali Veli", "800", d(10)], ["D-7", "Ayşe Kaya", "600", d(12)]] },
  ]);
  const MERGED = "2 dosya no birden çok sekmede; bir kez sayıldı (2025 Aidat, 2026 Aidat). Dönem sekmesiyse Sekme süzgeciyle ayrı bakın.";
  const CONFLICT = "Aynı dosya numarası farklı sekmelerde farklı kalan borç taşıyor: D-5: 2025 Aidat";

  test("süzgeçsiz: bir kez (ilk sekme) — Ali Veli 1.200, Ayşe Kaya 600, toplam 1.800; not hangi kaydın sayıldığını ve uyuşmazlığı söyler (üç raporda)", async () => {
    const { report } = await ctx.report("cari-ekstre");
    assert.deepEqual(debitBy(report), { "Ali Veli": 1200, "Ayşe Kaya": 600 });
    assert.equal(report.totals.debit, 1800);
    const notes = report.notes.join(" | ");
    assert.ok(notes.includes(MERGED), `birleştirme notu: ${notes}`);
    assert.ok(notes.includes("Sayılan: D-5 (Ali Veli): 2025 Aidat"), `sayılan kayıt: ${notes}`);
    assert.ok(notes.includes(CONFLICT), `uyuşmazlık notu: ${notes}`);
    for (const kind of ["vade-takip", "nakit-akis"]) {
      const other = (await ctx.report(kind)).report;
      assert.ok(other.notes.join(" | ").includes(MERGED), `${kind} birleştirme notu: ${JSON.stringify(other.notes)}`);
    }
    assert.equal((await ctx.report("vade-takip")).report.totals.amount, 1800);
    assert.equal((await ctx.report("nakit-akis")).report.totals.expected, 1800);
  });

  test("Sekme süzgeci: 2026 Aidat → Ali Veli 800, Ayşe Kaya 600 (1.400); 2025 Aidat → 1.800; seçili sekmede öbür sekme listeden düşmez (R3)", async () => {
    const only2026 = await ctx.report("cari-ekstre", "tabs=2026 Aidat");
    assert.deepEqual(debitBy(only2026.report), { "Ali Veli": 800, "Ayşe Kaya": 600 });
    assert.equal(only2026.report.totals.debit, 1400);
    assert.deepEqual(only2026.report.notes, [], "tek sekmede birleştirme notu yok");
    assert.deepEqual(only2026.tabs, ["2025 Aidat", "2026 Aidat"], "Sekme seçenekleri bütün sekmelerden");
    assert.equal((await ctx.report("vade-takip", "tabs=2026 Aidat")).report.totals.amount, 1400);
    assert.equal((await ctx.report("nakit-akis", "tabs=2026 Aidat")).report.totals.expected, 1400);
    assert.equal((await ctx.report("cari-ekstre", "tabs=2025 Aidat")).report.totals.debit, 1800);
    assert.equal((await ctx.report("vade-takip", "tabs=2025 Aidat")).report.totals.amount, 1800);
  });

  test("PDF ve Excel aynı notu taşır (R4)", async () => {
    for (const kind of ["cari-ekstre", "vade-takip", "nakit-akis"]) {
      assert.ok(flat(pdfText(await ctx.exportOf(kind, "pdf"))).includes("bir kez sayıldı (2025 Aidat, 2026 Aidat)"), `${kind} PDF notu`);
      assert.ok(flat(xlsxText(await ctx.exportOf(kind, "xlsx"))).includes(MERGED), `${kind} Excel notu`);
    }
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
