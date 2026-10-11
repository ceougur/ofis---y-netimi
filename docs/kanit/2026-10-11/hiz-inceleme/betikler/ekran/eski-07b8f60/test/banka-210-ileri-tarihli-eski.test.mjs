// 2.1.0 temel sürüm — eski sürümden kalan İLERİ TARİHLİ hesapsız havale (plan A13 ve karar 42: "Eski ileri tarihli satırlar açılışta taban
// kümesine alınır; yaşlandıkça işlem ENGELLENMEZ; yeni ileri tarih yine engellenir").
//
// Bulgu (T4 ajanı, 10.10.2026; docs/kanit/2026-10-10/t4-nakit-akis/ileri-tarihli-eski-havale-v2023.*): v2.0.23'e kadar çek/senet bankaya İLERİ
// TARİHLE tahsil edilebiliyordu (verilen çek ileri tarihle bankadan ödenebiliyordu). Yükseltmeden sonra Hesabı Atanmamış listesi bu satırı
// "atanabilir" gösteriyordu; "Bu Hesaba Ata" ve Kurulum Sihirbazı ("tümü") 409 ledger-integrity ("İleri tarihli hareket … yöneticinize bildirin")
// ile geri alınıyor, sihirbaz geçmiş tarihli satırları da aktaramıyordu (bağlanan satıra açılan yeni işlem başlığı ileri tarihli ve taban
// kümesinde değil → kapı haklı olarak reddeder). Hesabı Atanmamış toplamı da ileri tarihli satırı bugünkü bakiyeye katıyordu.
//
// Beklenen (kapının ileri tarih kuralı GEVŞEMEZ): ileri tarihli eski satır bugün atanamaz ama hiçbir işlemi kilitlemez — liste "Tarihi Gelince
// Atanabilir" der (atanamaz, nedeni yazılı); Bu Hesaba Ata kendi koduyla 409 bank-legacy-future; sihirbaz "tümü" geçmiş/bugün tarihlileri aktarır,
// ileri tarihlileri atlar ve söyler; Hesabı Atanmamış toplamı (Banka Genel Bakış, Hesaplar, ANLIK DURUM, Nakit Akış, Birleşik Rapor) bugüne kadarki
// satırlardır, ileri tarihliler ayrı bilgi; tarih gelince (sahte saat) atanır, 200 + mutabakat temiz.
//
// TEST VERİSİ: GERÇEK v2.0.23 kodu (git etiketi) API'sinden girilir (CLAUDE.md test kuralı); güncel kod aynı klasörü açar (gerçek güncelleme gibi).
// Tarihler göreli (D0 = bugün), güncel kodda sahte saat D0 öğlen → D0+5 → D0+11 (ders 13). Gerçek kurulum koşulu (ders 14): para yazımı denetimi ve
// kapı eşdeğerlik denetimi test kipinde DEĞİL (üretim gibi); ayrıca aynı veri test kipinde (moneyStrict + gateVerify) de koşulur.
//
// NASIL BOZARIM (önce yazıldı; testler bu listeden):
//   B1 ileri tarihli + geçmiş tarihli karışık; sihirbaz "tümü" → geçmiş aktarılır, ileri tarihliler atlanır ve sayısı/tutarı/ilk tarihi söylenir.
//   B2 yalnız ileri tarihli satır kaldı → sihirbaz 409 bank-setup-empty (ledger-integrity DEĞİL), mesaj ileri tarihliyi söyler; ön izleme 200.
//   B3 Bu Hesaba Ata ileri tarihli satır → 409 bank-legacy-future, mesajda gün (gg.aa.yyyy); ledger-integrity değil.
//   B4 Bu Hesaba Ata [geçmiş + ileri] tek istekte → 409 bank-legacy-future; geçmiş satır da BAĞLANMAZ (tek işlem).
//   B5 sihirbaz seçili satır listesiyle ileri tarihli satır → 409 bank-legacy-future.
//   B6 toplamlar: Banka Genel Bakış, Hesaplar, Hesabı Atanmamış listesi, ANLIK DURUM, Nakit Akış, Birleşik Rapor bugüne kadar (tek formül);
//      ileri tarihliler ayrı (sayı, tutar, ilk tarih).
//   B7 yeni ileri tarihli havale yine 400 date-future (kapı ve dönem kuralı gevşemedi).
//   B8 gün ilerler (D0+5): ileri tarihli satırın günü BUGÜN olunca atanabilir; başka para işlemleri (havale tahsilat) 200 kalır (A13).
//   B9 gün ilerler (D0+11): son ileri tarihli satır geçmişe düştü; dönem kilidi o güne denk → atanamaz (kilitli), 409 period-locked;
//      kilit kalkınca 200; mutabakat temiz (ileri tarihli satır kalmadı).
//   B10 iki şirket: 002'nin ileri tarihli satırı 001'de görünmez; 002'de sihirbaz yalnız 002'nin geçmiş satırını aktarır; tarih gelince atanır.
//   B11 istek kimliğiyle yinelenen sihirbaz tek çalışma; Geri Al ileri tarihli satıra dokunmaz.
//   B12 aynı veri test kipinde (moneyStrict + gateVerify): Bu Hesaba Ata ileri tarihli 409 bank-legacy-future, sihirbaz 200, tarih gelince 200.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.0.23";
const BANK = "/api/workspace/bank";
const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const dmy = iso => iso.split("-").reverse().join(".");
const body = res => (res.data && typeof res.data === "object" && "ok" in res.data ? res.data : null);
const codeOf = res => body(res)?.code || res.data?.code || "";
const textOf = res => body(res)?.error || res.data?.error || "";
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};
const expect = (res, status, code, label) => {
  assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  if (code) assert.equal(codeOf(res), code, `${label}: kod ${codeOf(res)} (${textOf(res)})`);
};
const nonWarnings = result => result.failures.filter(item => item.severity !== "warning");

/**
 * Eski veri (GERÇEK v2.0.23 kodu, gerçek saat): 001 — alınan çek 1.000 bankaya D+10'da tahsil (ileri), verilen çek 400 bankadan D+5'te ödendi
 * (ileri), geçmiş havale tahsilat 250 (D−2). 002 — alınan çek 700 bankaya D+3'te tahsil (ileri), geçmiş havale tahsilat 50 (D−1).
 */
async function seed(dirs) {
  const old = await bootVersion(OLD, dirs);
  const out = {};
  try {
    const api = await old.login();
    const customer = await must("v2.0.23 müşteri", api.post("/api/workspace/accounts", { name: "Çekli Müşteri", type: "customer" }));
    const supplier = await must("v2.0.23 tedarikçi", api.post("/api/workspace/accounts", { name: "Verilen Çek Tedarikçisi", type: "supplier" }));
    const inCheque = await must("v2.0.23 alınan çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1000, issueDate: day(-3), dueDate: day(10), serialNo: "ILR-1", accountId: customer.id }));
    await must("v2.0.23 çek bankaya İLERİ TARİHLE tahsil", api.post(`/api/workspace/cheques/${inCheque.id}/actions`, { action: "collect", date: day(10), method: "bank", status: "portfolio" }));
    const outCheque = await must("v2.0.23 verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: 400, issueDate: day(-1), dueDate: day(5), serialNo: "ILR-2", accountId: supplier.id }));
    await must("v2.0.23 verilen çek bankadan İLERİ TARİHLE ödendi", api.post(`/api/workspace/cheques/${outCheque.id}/actions`, { action: "pay", date: day(5), method: "bank", status: "pending" }));
    await must("v2.0.23 geçmiş havale tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: 250, date: day(-2), method: "bank" }));
    const second = await must("v2.0.23 002 şirketi", api.post("/api/companies", { code: "002", name: "İkinci Şirket", select: true }));
    out.second = second.company.id;
    const party2 = await must("v2.0.23 002 müşteri", api.post("/api/workspace/accounts", { name: "İkinci Şirket Müşterisi", type: "customer" }));
    const cheque2 = await must("v2.0.23 002 çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 700, issueDate: day(-2), dueDate: day(3), serialNo: "ILR-3", accountId: party2.id }));
    await must("v2.0.23 002 çek bankaya İLERİ TARİHLE tahsil", api.post(`/api/workspace/cheques/${cheque2.id}/actions`, { action: "collect", date: day(3), method: "bank", status: "portfolio" }));
    await must("v2.0.23 002 geçmiş havale", api.post(`/api/workspace/accounts/${party2.id}/entries`, { kind: "in", amount: 50, date: day(-1), method: "bank" }));
    await must("v2.0.23 001'e dön", api.post("/api/companies/select", { id: "sirket-001" }));
  } finally {
    await old.close();
  }
  return out;
}

const skip = !tagsAvailable([OLD]) && `${OLD} etiketi bu depoda yok (git fetch --tags)`;

describe("İleri tarihli eski hesapsız havale (gerçek v2.0.23 verisi; gerçek kurulum koşulu)", { skip }, () => {
  let root;
  let server;
  let api;
  let ziraat;
  let second;
  let pristine;
  const legacy = () => must("Hesabı Atanmamış", api.get(`${BANK}/legacy`));
  const rowOf = async (date, kind) => (await legacy()).rows.find(row => row.date === date && row.kind === kind);
  const select = id => must("şirket seç", api.post("/api/companies/select", { id }));
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "ileri-eski-havale-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    ({ second } = await seed(dirs));
    // B12 için güncellemeden önceki veri kopyası (aynı v2.0.23 verisi test kipinde ayrıca açılır).
    pristine = path.join(root, "kopya");
    cpSync(dirs.dataDir, path.join(pristine, "data"), { recursive: true });
    cpSync(dirs.backupDir, path.join(pristine, "backups"), { recursive: true });
    server = await bootVersion(CURRENT, { ...dirs, now: { time: D0 }, moneyStrict: false, gateVerify: false, maxCompanies: 2 });
    api = await server.login();
    ziraat = await must("Ziraat hesabı", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } }));
  });
  after(async () => {
    await server?.close().catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("B6 liste: ileri tarihli iki satır ayrı işaretli, atanamaz, nedeni ve günü yazılı; geçmiş satır atanabilir", async () => {
    const data = await legacy();
    const rows = data.rows.map(row => `${row.date} ${row.kind} ${row.amountMinor / 100} ${row.assignable}`).sort();
    assert.deepEqual(rows, [`${day(-2)} in 250 true`, `${day(10)} in 1000 false`, `${day(5)} out 400 false`].sort(), JSON.stringify(data.rows));
    for (const row of data.rows.filter(item => item.date > D0)) {
      assert.equal(row.future, true, `${row.date} ileri tarihli işaretli`);
      assert.match(row.reason, new RegExp(`Tarihi gelmedi \\(${dmy(row.date).replace(/\./g, "\\.")}\\)`), `neden: ${row.reason}`);
    }
    assert.equal(data.rows.find(row => row.date === day(-2)).future, false);
    assert.equal(data.totals.bankMinor, 25_000, "Hesabı Atanmamış (bugüne kadar) yalnız geçmiş satır: 250");
    assert.deepEqual([data.future?.count, data.future?.bankMinor, data.future?.firstDate], [2, 60_000, day(5)], `ileri tarihli ayrı: ${JSON.stringify(data.future)}`);
  });

  it("B6 toplamlar tek formülden: Banka Genel Bakış, Hesaplar, ANLIK DURUM, Nakit Akış, Birleşik Rapor = 250 (bugüne kadar); ileri tarihli ayrı", async () => {
    const summary = await must("Banka Genel Bakış", api.get(`${BANK}/summary`));
    assert.equal(summary.unassigned.totalMinor, 25_000, `Banka Genel Bakış ${summary.unassigned.totalMinor}`);
    assert.equal(summary.unassigned.bankMinor, 25_000);
    assert.deepEqual([summary.unassigned.future?.count, summary.unassigned.future?.totalMinor, summary.unassigned.future?.firstDate], [2, 60_000, day(5)]);
    const list = await must("Hesaplar", api.get(`${BANK}/accounts?status=all`));
    assert.equal(list.totals.unassignedBankMinor, 25_000, "Hesaplar toplamı");
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    assert.equal(overview.cash.bank.unassigned.total, 250, `ANLIK DURUM ${JSON.stringify(overview.cash.bank.unassigned)}`);
    assert.equal(overview.cash.bank.unassigned.future?.total, 600, "ANLIK DURUM ileri tarihli ayrı");
    const flow = await must("Nakit Akış", api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
    assert.equal(flow.start.unassigned, 250, `Nakit Akış Hesabı Atanmamış ${flow.start.unassigned}`);
    assert.equal(flow.cashToday, 10_000, "başlangıç = Nakit 0 + Gerçek Banka 10.000 (Hesabı Atanmamış girmez)");
    const report = await must("Birleşik Rapor", api.get("/api/companies/report"));
    const byCode = Object.fromEntries(report.rows.map(row => [row.code, row]));
    assert.equal(byCode["001"].bankUnassigned, 250, `Birleşik Rapor 001 ${JSON.stringify(byCode["001"])}`);
    assert.equal(byCode["002"].bankUnassigned, 50, `Birleşik Rapor 002 (ileri tarihli 700 girmez) ${JSON.stringify(byCode["002"])}`);
  });

  it("B3 Bu Hesaba Ata ileri tarihli → 409 bank-legacy-future (ledger-integrity değil), mesajda gün", async () => {
    const ahead = await rowOf(day(10), "in");
    const res = await api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: ahead.table, id: ahead.id }] });
    expect(res, 409, "bank-legacy-future", "ileri tarihli ata");
    assert.match(textOf(res), new RegExp(`${dmy(day(10)).replace(/\./g, "\\.")}`), textOf(res));
    assert.doesNotMatch(textOf(res), /yöneticinize bildirin/, "kapı reddi değil");
  });

  it("B4 Bu Hesaba Ata [geçmiş + ileri] tek istekte → 409; geçmiş satır da bağlanmaz", async () => {
    const past = await rowOf(day(-2), "in");
    const ahead = await rowOf(day(5), "out");
    expect(await api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: past.table, id: past.id }, { table: ahead.table, id: ahead.id }] }), 409, "bank-legacy-future", "karışık ata");
    const still = await rowOf(day(-2), "in");
    assert.ok(still, "geçmiş satır hâlâ Hesabı Atanmamış'ta");
    assert.equal((await must("Banka Genel Bakış", api.get(`${BANK}/summary`))).realBank.minor, 1_000_000, "Gerçek Banka değişmedi");
  });

  it("B5 sihirbaz seçili satır listesiyle ileri tarihli satır → 409 bank-legacy-future", async () => {
    const ahead = await rowOf(day(10), "in");
    expect(await api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: [{ table: ahead.table, id: ahead.id }] }), 409, "bank-legacy-future", "sihirbaz seçili ileri tarihli");
  });

  it("B1 sihirbaz ön izleme: 1 satır bağlanacak (250), ileri tarihli 2 atlanacak (net 600, ilk D+5)", async () => {
    const preview = await must("ön izleme", api.post(`${BANK}/setup?dryRun=1`, { accountId: ziraat.id, carryClose: true, assign: "all" }));
    assert.deepEqual([preview.assign.count, preview.assign.amountMinor], [1, 25_000], JSON.stringify(preview.assign));
    assert.deepEqual([preview.skipped.future, preview.skipped.futureMinor, preview.skipped.futureFirst], [2, 60_000, day(5)], JSON.stringify(preview.skipped));
    assert.equal(preview.after.unassignedBankMinor, 0, "aktarımdan sonra bugüne kadarki Hesabı Atanmamış 0");
    assert.equal(preview.after.accountMinor, 1_025_000);
  });

  it("B1 + B11 sihirbaz 'tümü' → 200: geçmiş bağlandı, ileri tarihliler atlandı (yanıtta); aynı istek kimliğiyle tek çalışma", async () => {
    const request = { accountId: ziraat.id, carryClose: true, assign: "all", requestId: "ileri-eski-sihirbaz-1" };
    const result = await must("sihirbaz tümü", api.post(`${BANK}/setup`, request));
    assert.equal(result.assigned, 1, JSON.stringify(result));
    assert.deepEqual([result.skipped?.future, result.skipped?.futureFirst], [2, day(5)], `atlanan ileri tarihliler yanıtta: ${JSON.stringify(result)}`);
    const again = await must("yinelenen istek (aynı istek kimliği)", api.post(`${BANK}/setup`, request));
    assert.equal(again.replayed, true, JSON.stringify(again));
    const runs = (await must("kurulumlar", api.get(`${BANK}/setup`))).runs;
    assert.equal(runs.filter(run => run.status === "active").length, 1, "tek çalışma");
    const summary = await must("Banka Genel Bakış", api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.minor, 1_025_000, "Gerçek Banka 10.000 + 250");
    assert.equal(summary.unassigned.totalMinor, 0, "bugüne kadarki Hesabı Atanmamış 0");
    assert.equal(summary.unassigned.future.count, 2, "ileri tarihliler bağsız kaldı");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.deepEqual(nonWarnings(integrity), [], `yalnız eski satır uyarıları kalabilir: ${JSON.stringify(integrity.failures).slice(0, 600)}`);
  });

  it("B2 yalnız ileri tarihli kaldı → sihirbaz 409 bank-setup-empty (mesaj ileri tarihliyi söyler); ön izleme 200", async () => {
    const preview = await must("ön izleme", api.post(`${BANK}/setup?dryRun=1`, { accountId: ziraat.id, carryClose: true, assign: "all" }));
    assert.deepEqual([preview.assign.count, preview.skipped.future], [0, 2]);
    const res = await api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all" });
    expect(res, 409, "bank-setup-empty", "yalnız ileri tarihli");
    assert.match(textOf(res), /Tarihi gelmemiş 2 havale/, textOf(res));
    assert.match(textOf(res), new RegExp(dmy(day(5)).replace(/\./g, "\\.")), textOf(res));
  });

  it("B7 yeni ileri tarihli havale yine 400 date-future (kapı ve dönem kuralı gevşemedi)", async () => {
    const party = (await must("cariler", api.get("/api/workspace/accounts"))).accounts.find(item => item.name === "Çekli Müşteri");
    expect(await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10", date: day(1), method: "bank" }), 400, "date-future", "yeni ileri tarihli havale");
  });

  it("B10 iki şirket: 002'nin ileri tarihli satırı 001'de yok; 002'de sihirbaz yalnız geçmiş 50'yi aktarır", async () => {
    const own = await legacy();
    assert.ok(!own.rows.some(row => row.amountMinor === 70_000 || row.amountMinor === 5_000), "002'nin satırları 001'de görünmez");
    await select(second);
    try {
      const data = await legacy();
      assert.deepEqual(data.rows.map(row => `${row.date} ${row.amountMinor / 100} ${row.assignable}`).sort(), [`${day(-1)} 50 true`, `${day(3)} 700 false`].sort());
      const halk = await must("002 hesabı", api.post(`${BANK}/accounts`, { bankName: "Halkbank", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "1.000", confirmed: true } }));
      const result = await must("002 sihirbaz", api.post(`${BANK}/setup`, { accountId: halk.id, carryClose: true, assign: "all" }));
      assert.deepEqual([result.assigned, result.skipped?.future], [1, 1], JSON.stringify(result));
      assert.equal((await must("002 özet", api.get(`${BANK}/summary`))).realBank.minor, 105_000);
    } finally {
      await select("sirket-001");
    }
  });

  it("B8 gün D+5: verilen çek ödemesi (bugün) atanabilir → Bu Hesaba Ata 200; havale tahsilat 200 (A13); D+10 satırı hâlâ ileri", async () => {
    server.app.config.now.advance({ days: 5 });
    const today = await rowOf(day(5), "out");
    assert.equal(today.assignable, true, `bugün tarihli satır atanabilir: ${JSON.stringify(today)}`);
    assert.equal(today.future, false);
    const ahead = await rowOf(day(10), "in");
    assert.deepEqual([ahead.assignable, ahead.future], [false, true]);
    const party = (await must("cariler", api.get("/api/workspace/accounts"))).accounts.find(item => item.name === "Çekli Müşteri");
    await must("bugün havale tahsilat (gün ilerledi)", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10", method: "bank", bankAccountId: ziraat.id }));
    await must("Bu Hesaba Ata (bugün)", api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: today.table, id: today.id }] }));
    const summary = await must("Banka Genel Bakış", api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.minor, 1_025_000 + 1_000 - 40_000, "Gerçek Banka 10.250 + 10 − 400");
    assert.deepEqual([summary.unassigned.totalMinor, summary.unassigned.future.count, summary.unassigned.future.totalMinor], [0, 1, 100_000]);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.deepEqual(nonWarnings(integrity), [], JSON.stringify(integrity.failures).slice(0, 600));
    // 002: çek tahsili (D+3) geçmişe düştü → atanır.
    await select(second);
    try {
      const row = (await legacy()).rows.find(item => item.amountMinor === 70_000);
      assert.equal(row.assignable, true);
      const halk = (await must("002 hesaplar", api.get(`${BANK}/accounts?status=all`))).accounts[0];
      await must("002 Bu Hesaba Ata", api.post(`${BANK}/legacy/assign`, { accountId: halk.id, rows: [{ table: row.table, id: row.id }] }));
      assert.equal((await must("002 özet", api.get(`${BANK}/summary`))).realBank.minor, 175_000);
      const integrity2 = await must("002 Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      assert.equal(integrity2.ok, true, JSON.stringify(integrity2.failures).slice(0, 600));
    } finally {
      await select("sirket-001");
    }
  });

  it("B9 gün D+11: kilitli döneme denk gelen satır atanamaz (409 period-locked), kilit kalkınca 200; mutabakat temiz", async () => {
    server.app.config.now.advance({ days: 6 });
    await must("dönem kilidi D+10", api.put("/api/admin/period-lock", { lockedUntil: day(10) }));
    const locked = await rowOf(day(10), "in");
    assert.deepEqual([locked.future, locked.locked, locked.assignable], [false, true, false], JSON.stringify(locked));
    expect(await api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: locked.table, id: locked.id }] }), 409, "period-locked", "kilitli");
    await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
    await must("Bu Hesaba Ata (tarihi geldi)", api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: locked.table, id: locked.id }] }));
    const summary = await must("Banka Genel Bakış", api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.minor, 986_000 + 100_000, "Gerçek Banka 9.860 + 1.000");
    assert.deepEqual([summary.unassigned.totalMinor, summary.unassigned.future?.count || 0], [0, 0]);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, `mutabakat temiz (ileri tarihli satır kalmadı): ${JSON.stringify(integrity.failures).slice(0, 600)}`);
  });

  it("B11 Geri Al: sihirbazın bağladığı geçmiş satır geri döner; sonradan atanan satırlara dokunulmaz", async () => {
    const run = (await must("kurulumlar", api.get(`${BANK}/setup`))).runs.find(item => item.status === "active" && item.accountId === ziraat.id);
    const undo = await must("Geri Al", api.post(`${BANK}/setup/${run.id}/undo`, {}));
    assert.equal(undo.unassigned, 1, JSON.stringify(undo));
    const data = await legacy();
    assert.deepEqual(data.rows.map(row => `${row.date} ${row.amountMinor / 100}`), [`${day(-2)} 250`], "yalnız sihirbazın bağladığı satır geri döndü");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 600));
  });

  it("B12 aynı v2.0.23 verisi test kipinde (moneyStrict + gateVerify): ileri tarihli 409 bank-legacy-future, sihirbaz 200, tarih gelince 200", async () => {
    const strict = await bootVersion(CURRENT, { dataDir: path.join(pristine, "data"), backupDir: path.join(pristine, "backups"), now: { time: D0 }, maxCompanies: 2 });
    try {
      const api2 = await strict.login();
      const account = await must("hesap", api2.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } }));
      const rows = (await must("eski", api2.get(`${BANK}/legacy`))).rows;
      const ahead = rows.find(row => row.date === day(10));
      expect(await api2.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: [{ table: ahead.table, id: ahead.id }] }), 409, "bank-legacy-future", "test kipi ileri tarihli");
      const result = await must("test kipi sihirbaz", api2.post(`${BANK}/setup`, { accountId: account.id, carryClose: true, assign: "all" }));
      assert.deepEqual([result.assigned, result.skipped?.future], [1, 2]);
      strict.app.config.now.advance({ days: 11 });
      const left = (await must("eski", api2.get(`${BANK}/legacy`))).rows;
      assert.ok(left.every(row => row.assignable), JSON.stringify(left));
      await must("test kipi Bu Hesaba Ata", api2.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: left.map(row => ({ table: row.table, id: row.id })) }));
      assert.equal((await must("özet", api2.get(`${BANK}/summary`))).realBank.minor, 1_000_000 + 25_000 + 100_000 - 40_000);
      const integrity = await must("Mutabakat Testi", api2.get("/api/workspace/ledger/integrity"));
      assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 600));
    } finally {
      await strict.close();
    }
  });
});
