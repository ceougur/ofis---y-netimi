// 2.5.1 D3 TUR 3 — Kural Değişikliği Farkı ve devir: KULLANICI KARARLARI 27.11.2026 11:39 UTC (üç soru öneriyle yanıtlandı; metinler AYNEN görev metninde):
//   S-KD-1 = A: geriye YALNIZ düzeltme fişinin düzeltemediği alt defter farkı kaldıysa (aynı caride müşteri hesabı +4.000 / şüpheli hesabı −4.000; toplam 0) devir yine DURUR;
//              "Kilidi Aç → Yeniden Kilitle" ile fark temizlenince geçer.
//   S-KD-2 = A: Dönem Kilidi tam kesim gününe (31.12) dayanmışken çıkan kural farkının düzeltme fişi kilit yüzünden 01.01'e düşüyorsa devir DURUR; kilit geri alınır, fiş eski yılın
//              içinde yazılır, eski yılın kârı 3.000 azalır (fark ait olduğu yılda).
// Kural değişikliği YALNIZ test kancasıyla benzetilir (__testLedgerRule; test/c6h-bilanco-uc deseni): kancanın açık / kapalı olduğu anda dondurulan defter "eski kural", canlı türetme
// "yeni kural". Çareler GERÇEK API yoluyla (PUT period-lock, Kural Farkı Düzeltme Fişi, Ters Kaydet). Ön izleme kancalı ledger ile AYNI işlevden (runPreview; iş parçacığı kancayı bilmez).
// Beklenen sayılar ELLE: satış 10.000,00 TL (KDV 0) → dönem sonucu 10.000,00 TL; kancanın 659 / 198 farkı 3.000,00 TL → fiş eski yılda yazılınca 7.000,00 TL. K = 31.12.2026.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";

const iletiModule = await import("../server/lib/devir/iletiler.mjs").catch(() => null);
const worker = await import("../server/lib/devir/plan-worker.mjs").catch(() => null);
const K = "2026-12-31";
const TODAY = "2027-02-10";
let seq = 0;
const rid = () => `d3t3-kural-${process.pid}-${String(++seq).padStart(6, "0")}`;
const CORRECTION = "/api/admin/ledger/rule-diff-correction";

/** Kancalı sunucu: müşteri(ler) + satışlar (KDV 0, açık); kanca entries → entries (rule.on ile). */
async function scenario({ sales = [["A", "2026-03-10", 10000]], hook }) {
  const rule = { on: false, ids: {} };
  rule.fn = entries => (rule.on ? hook(entries, rule) : entries);
  const ctx = await boot({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, __testLedgerRule: rule });
  const parties = {};
  for (const [name] of sales) parties[name] ||= (await must(`cari ${name}`, ctx.api.post("/api/workspace/accounts", { name: `Kural Müşterisi ${name}`, type: "customer" }))).id;
  if (hook.second) parties.B ||= (await must("cari B", ctx.api.post("/api/workspace/accounts", { name: "Kural Müşterisi B", type: "customer" }))).id;
  const invoices = [];
  for (const [name, date, price] of sales) invoices.push((await must(`satış ${date}`, ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: parties[name], issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }))).id);
  rule.ids = { parties, invoices };
  const lock = async value => {
    await must(`kilit ${value || "(aç)"}`, ctx.api.put("/api/admin/period-lock", { lockedUntil: value }));
    await ctx.app.ledger.snapshots.runPending();
  };
  // ESKİ KURALLA donmuş dönem (eski sürümün dondurduğu veri): kancalı türetmeyle, aynı işlevin eşzamanlı kipiyle (freezeSync — vouchers.postAll lockThrough'un yolu). PUT period-lock'un
  // dondurması iş parçacığındadır ve test kancasını görmez; ÇARE adımları (Kilidi Aç, Yeniden Kilitle) GERÇEK API'dir — onların dondurması GÜNCEL kuralla (kancasız) yapılır.
  const oldRuleFreeze = through => {
    rule.on = true;
    try {
      ctx.store.tx(() => {
        ctx.app.context.period.setLock(through);
        ctx.app.ledger.snapshots.freezeSync({ through, reason: "test" });
      });
    } finally {
      rule.on = false;
    }
  };
  const preview = () => worker.runPreview({ store: ctx.app.store, ledger: ctx.app.context.ledger, job: { K, today: TODAY, option: "borc-alacak", company: null, isRoot: true } });
  const correct = async () => {
    const view = await must("Kural Farkı ön izleme", ctx.api.get(CORRECTION));
    assert.equal(view.disabled, false, view.reason);
    const posted = await must("Kural Farkı Düzeltme Fişi", ctx.api.post(CORRECTION, { requestId: rid(), digest: view.digest, confirm: true }));
    return { view, voucher: posted.voucher };
  };
  return { ctx, rule, parties, invoices, lock, oldRuleFreeze, preview, correct, close: () => ctx.server.close() };
}
const codes = out => out.onDenetim.durdurur.map(row => row.kod);
const kural = out => out.onDenetim.durdurur.filter(row => row.kod.startsWith("kural-farki"));
const cleanFields = (row, label) => {
  assert.deepEqual(iletiModule.iletiDenetimi(row), [], `${label}: yasak kalıp / boş alan`);
  assert.ok(row.neOldu && row.neden && row.neYapmali.length && row.nereye?.ekran, `${label}: dört alan`);
};
// Kancalar. "Alt defter" kancaları ESKİ kuraldır (oldRuleFreeze ile donar; canlı = alt defter, Defter Mutabakatı temiz). "Fiş" kancası YENİ kuraldır (dondurmadan SONRA açılır;
// fazladan gider: 659 / 198 — alt defter dışı, fişle düzeltilir).
const forInvoice = (entries, id, change) => entries.map(entry => (entry.id.includes(id) ? change(entry) : entry));
const line120 = entry => entry.lines.find(line => line.account === "120");
const HOOKS = {
  // S-KD-1 örneği: aynı cari, 120 +4.000 / 128 −4.000 (eski kuralda) → fark 120 −4.000 / 128 +4.000; carinin toplamı 0.
  sameParty: (entries, rule) => forInvoice(entries, rule.ids.invoices[0], entry => ({ ...entry, lines: [...entry.lines.map(line => (line.account === "120" ? { ...line, debit: line.debit + 400000 } : line)), { ...line120(entry), account: "128", debit: 0, credit: 400000 }] })),
  // İki AYRI cari: 120|A +4.000 / 120|B −4.000 (hesap toplamı 0).
  twoParties: Object.assign((entries, rule) => forInvoice(entries, rule.ids.invoices[0], entry => ({ ...entry, lines: [...entry.lines.map(line => (line.account === "120" ? { ...line, debit: line.debit + 400000 } : line)), { ...line120(entry), party: rule.ids.parties.B, debit: 0, credit: 400000 }] })), { second: true }),
  // Aynı cari, aynı hesap, AYNI yılın iki maddesinde +4.000 / −4.000 (600 karşılığıyla): kilit günündeki birikim 0 → fark yok sayılır.
  sameYear: (entries, rule) =>
    forInvoice(
      forInvoice(entries, rule.ids.invoices[0], entry => ({ ...entry, lines: entry.lines.map(line => (line.account === "120" ? { ...line, debit: line.debit + 400000 } : line.account === "600" ? { ...line, credit: line.credit + 400000 } : line)) })),
      rule.ids.invoices[1],
      entry => ({ ...entry, lines: [...entry.lines, { ...line120(entry), debit: 0, credit: 400000 }, { ...entry.lines.find(line => line.account === "600"), debit: 400000, credit: 0 }] }),
    ),
  // S-KD-2 örneği: yeni kural satışın maddesine B 659 / A 198 3.000,00 TL ekler (alt defter dışı; Kural Farkı Düzeltme Fişi yazabilir).
  expense: (entries, rule) => forInvoice(entries, rule.ids.invoices.at(-1), entry => {
    const base = entry.lines.find(line => line.account === "600");
    return { ...entry, lines: [...entry.lines, { ...base, account: "659", sub: "", party: "", debit: 300000, credit: 0 }, { ...base, account: "198", sub: "", party: "", debit: 0, credit: 300000 }] };
  }),
};

describe("D3 tur 3 — S-KD-1 = A: düzeltme fişinin düzeltemediği alt defter farkı (cari / alt hesap başına; toplamı 0 olsa da) devri DURDURUR; Kilidi Aç → Yeniden Kilitle ile geçer", () => {
  it("aynı caride 120 −4.000 / 128 +4.000 (toplam 0): DURDURUR, ileti iki satırı ve çareyi söyler; Kilidi Aç → Yeniden Kilitle (gerçek API) → GEÇER", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ hook: HOOKS.sameParty });
    try {
      s.oldRuleFreeze(K); // eski kuralla donmuş; canlı türetme (güncel kural) alt defterle aynı
      const out = s.preview();
      const items = kural(out);
      assert.deepEqual(items.map(row => row.kod), ["kural-farki-alt-defter"], codes(out).join(", "));
      assert.equal(codes(out).includes("defter-mutabakati"), false, "canlı türetme alt defterle aynı — Defter Mutabakatı temiz");
      const row = items[0];
      cleanFields(row, row.kod);
      assert.match(row.neOldu, /Kural Müşterisi A — 120 Alıcılar \(Müşteri Carileri\): alacak yönünde 4\.000,00 TL/);
      assert.match(row.neOldu, /Kural Müşterisi A — 128 [^:]+: borç yönünde 4\.000,00 TL/);
      assert.match(row.neOldu, /Carinin toplamı 0,00 TL görünse de hesaplar ayrı ayrı tutmuyor\./);
      assert.deepEqual(row.neYapmali, ["Yönetim › Sistem › Dönem Kilidi'nde Kilidi Aç'ı seçin.", "Kilidi yeniden 31.12.2026 gününe koyun (Yeniden Kilitle); kilitli dönem güncel kuralla yeniden donar.", "Dondurma bitince Ön İzleme'yi yeniden başlatın."]);
      assert.equal(row.nereye.ekran, "Yönetim › Sistem › Dönem Kilidi");
      assert.deepEqual(row.ayrinti.map(item => [item.hesap, item.cari, item.minor]).sort(), [["120", s.parties.A, -400000], ["128", s.parties.A, 400000]].sort(), "satırlar veriden (cari başına)");
      katalogaYaz("devir-d3-kural", "S-KD-1: aynı caride 120 −4.000 / 128 +4.000 (toplam 0), kilit 31.12.2026", row, "API + kural kancası");
      // Çare (gerçek API): Kilidi Aç → Yeniden Kilitle.
      await s.lock("");
      await s.lock(K);
      const after = s.preview();
      assert.deepEqual(kural(after), [], codes(after).join(", "));
      assert.equal(after.onDenetim.gecebilir, true, codes(after).join(", "));
    } finally {
      await s.close();
    }
  });

  it("iki AYRI caride +4.000 / −4.000 (hesap toplamı 0): DURDURUR (cari başına)", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ hook: HOOKS.twoParties });
    try {
      s.oldRuleFreeze(K);
      const items = kural(s.preview());
      assert.deepEqual(items.map(row => row.kod), ["kural-farki-alt-defter"]);
      assert.match(items[0].neOldu, /Kural Müşterisi A — 120 Alıcılar \(Müşteri Carileri\): alacak yönünde 4\.000,00 TL/);
      assert.match(items[0].neOldu, /Kural Müşterisi B — 120 Alıcılar \(Müşteri Carileri\): borç yönünde 4\.000,00 TL/);
      katalogaYaz("devir-d3-kural", "S-KD-1: iki ayrı caride 120 +4.000 / −4.000 (hesap toplamı 0)", items[0], "API + kural kancası");
    } finally {
      await s.close();
    }
  });

  it("aynı cari, aynı hesap, aynı yılın iki maddesinde +4.000 / −4.000 (kilit günündeki birikim 0): kural farkı DURDURMAZ (yanlış durdurma yok)", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ sales: [["A", "2026-03-10", 10000], ["A", "2026-06-10", 2000]], hook: HOOKS.sameYear });
    try {
      s.oldRuleFreeze(K);
      const out = s.preview();
      assert.deepEqual(kural(out), [], codes(out).join(", "));
    } finally {
      await s.close();
    }
  });

  it("fark hiç yokken (kilit 31.12.2026, kanca yok): kural farkı DURDURMAZ", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ hook: HOOKS.sameParty });
    try {
      await s.lock(K);
      const out = s.preview();
      assert.deepEqual(kural(out), []);
      assert.equal(out.onDenetim.gecebilir, true, codes(out).join(", "));
    } finally {
      await s.close();
    }
  });
});

describe("D3 tur 3 — S-KD-2 = A: kilit K'de / K'yi aşıyorken ≤K farkının fişi yeni yıla düşer → DURDURUR; kilit geri alınır, fiş eski yılda, eski yılın kârı fiş kadar değişir", () => {
  const profit = out => out.plan.archive.donemSonucuMinor;
  it("kilit = 31.12.2026: DURDURUR (fiş 01.01.2027'ye düşüyor); ileti fiş tutarını (3.000,00 TL) ve kâr etkisini söyler; çare (kilit 30.12 → fiş 31.12 → kilit 31.12) → GEÇER, kâr 10.000 → 7.000", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ hook: HOOKS.expense });
    try {
      await s.lock(K);
      s.rule.on = true;
      const out = s.preview();
      assert.equal(profit(out), 1000000, "donmuş defterle dönem sonucu 10.000,00 TL");
      const items = kural(out);
      assert.deepEqual(items.map(row => row.kod), ["kural-farki-kilit"], codes(out).join(", "));
      const row = items[0];
      cleanFields(row, row.kod);
      assert.match(row.neOldu, /^Dönem Kilidi 31\.12\.2026 gününde; kilitli dönemde \(31\.12\.2026 ve öncesi\) 1 kayıtta Kural Değişikliği Farkı var ve Kural Farkı Düzeltme Fişi kilit yüzünden 01\.01\.2027 tarihine, yani yeni yıla düşüyor/);
      assert.match(row.neden, /Fiş 2026 içinde yazılınca 2026 yılının dönem sonucu 3\.000,00 TL azalır\.$/);
      assert.deepEqual(row.neYapmali, [
        "Yönetim › Sistem › Dönem Kilidi'nde kilidi 30.12.2026 gününe alın.",
        "Yönetim › Sistem › Kural Farkı Düzeltme Fişi'nde ön izlemedeki fişi kaydedin (tarihi 31.12.2026, tutarı 3.000,00 TL).",
        "Dönem Kilidi'ni yeniden 31.12.2026 gününe alın.",
        "Dondurma bitince Ön İzleme'yi yeniden başlatın.",
      ]);
      katalogaYaz("devir-d3-kural", "S-KD-2: kilit 31.12.2026, yeni kural 659 / 198 3.000,00 TL (fiş 01.01.2027'ye düşecekti)", row, "API + kural kancası");
      // Çare — gerçek API: kilit 30.12.2026 → Kural Farkı Düzeltme Fişi (31.12.2026) → kilit 31.12.2026.
      await s.lock("2026-12-30");
      const { view, voucher } = await s.correct();
      assert.equal(view.date, "2026-12-31");
      assert.equal(view.totalMinor, 300000, "ilette yazan fiş tutarı = Kural Farkı Düzeltme ön izlemesinin tutarı");
      assert.equal(voucher.date, "2026-12-31");
      await s.lock(K);
      const after = s.preview();
      assert.deepEqual(kural(after), [], codes(after).join(", "));
      assert.equal(after.onDenetim.gecebilir, true, codes(after).join(", "));
      assert.equal(profit(after), 700000, "eski yılın kârı fiş kadar azaldı (10.000,00 − 3.000,00)");
    } finally {
      await s.close();
    }
  });

  it("kilit = 31.12.2026 iken fiş YENİ YILA yazılmış (01.01.2027): DURDURUR; Ters Kaydet → kilit 30.12 → fiş 31.12 → kilit 31.12 → GEÇER, kâr 7.000", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ hook: HOOKS.expense });
    try {
      await s.lock(K);
      s.rule.on = true;
      const { voucher } = await s.correct();
      assert.equal(voucher.date, "2027-01-01", "kilit K'deyken fiş K+1'e düşer");
      const out = s.preview();
      assert.equal(profit(out), 1000000, "fiş yeni yılda — eski yılın kârı düzelmedi");
      const items = kural(out);
      assert.deepEqual(items.map(row => row.kod), ["kural-farki-fis-yeni-yilda"], codes(out).join(", "));
      const row = items[0];
      cleanFields(row, row.kod);
      const no = s.ctx.app.store.get("SELECT year, no FROM ledger_vouchers WHERE id = ?", voucher.id);
      assert.match(row.neOldu, new RegExp(`^Kural Farkı Düzeltme Fişi Fiş ${no.year}-${String(no.no).padStart(6, "0")} \\(01\\.01\\.2027, 3\\.000,00 TL\\) yeni yılın içinde yazılmış`));
      assert.equal(row.neYapmali[0], "Yönetim › Sistem › Kural Farkı Düzeltme'de bu fişi Ters Kaydet ile geri alın.");
      assert.match(row.neden, /2026 yılının dönem sonucu 3\.000,00 TL azalır/);
      katalogaYaz("devir-d3-kural", "S-KD-2: kilit 31.12.2026 iken düzeltme fişi 01.01.2027'ye yazılmış", row, "API + kural kancası");
      await must("Ters Kaydet", s.ctx.api.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: rid() }));
      await s.lock("2026-12-30");
      await s.correct();
      await s.lock(K);
      const after = s.preview();
      assert.deepEqual(kural(after), [], codes(after).join(", "));
      assert.equal(profit(after), 700000);
    } finally {
      await s.close();
    }
  });

  it("kilit K'den ÖNCE (30.06.2026): S-3 iletisi (fiş 01.07.2026, eski yılda) — S-KD-2 değil; fiş yazılınca GEÇER, kâr 7.000", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ hook: HOOKS.expense });
    try {
      await s.lock("2026-06-30");
      s.rule.on = true;
      const items = kural(s.preview());
      assert.deepEqual(items.map(row => row.kod), ["kural-farki"]);
      cleanFields(items[0], "kural-farki");
      assert.match(items[0].neOldu, /düzeltilmemiş Kural Değişikliği Farkı var; Kural Farkı Düzeltme Fişi'nin yazacağı tutar 3\.000,00 TL \(198 Diğer Çeşitli Dönen Varlıklar alacak 3\.000,00 TL ve 659 Diğer Olağan Gider ve Zararlar borç 3\.000,00 TL\)\.$/);
      assert.equal(items[0].neYapmali[1], "Ön izlemedeki fişi kaydedin (tarihi 01.07.2026).");
      katalogaYaz("devir-d3-kural", "S-3: kilit 30.06.2026, fiş 01.07.2026 (eski yılda)", items[0], "API + kural kancası");
      const { voucher } = await s.correct();
      assert.equal(voucher.date, "2026-07-01");
      const after = s.preview();
      assert.deepEqual(kural(after), []);
      assert.equal(profit(after), 700000);
    } finally {
      await s.close();
    }
  });

  it("kilit hiç yok: kural farkı tanımsız — DURDURMAZ; kâr canlı türetmeden 7.000", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const s = await scenario({ hook: HOOKS.expense });
    try {
      s.rule.on = true;
      const out = s.preview();
      assert.deepEqual(kural(out), []);
      assert.equal(profit(out), 700000);
    } finally {
      await s.close();
    }
  });

  it("kilit K'yi AŞIYOR (15.01.2027), fark ≤K maddede: DURDURUR (fiş 16.01.2027); fark YALNIZ K'den sonraki maddedeyse S-3 genel iletisi", { timeout: 120_000 }, async () => {
    assert.ok(iletiModule && worker, "D3 tur 3 yok (eski kod)");
    const a = await scenario({ hook: HOOKS.expense });
    try {
      await a.lock("2027-01-15");
      a.rule.on = true;
      const items = kural(a.preview());
      assert.deepEqual(items.map(row => row.kod), ["kural-farki-kilit"]);
      assert.match(items[0].neOldu, /Dönem Kilidi 15\.01\.2027 gününde; .* kilit yüzünden 16\.01\.2027 tarihine/);
      assert.equal(items[0].neYapmali.at(-2), "Dönem Kilidi'ni yeniden 15.01.2027 gününe alın.");
      katalogaYaz("devir-d3-kural", "S-KD-2: kilit 15.01.2027 (K'yi aşıyor), fark 10.03.2026 maddesinde", items[0], "API + kural kancası");
    } finally {
      await a.close();
    }
    const b = await scenario({ sales: [["A", "2026-03-10", 10000], ["A", "2027-01-05", 5000]], hook: HOOKS.expense });
    try {
      await b.lock("2027-01-15");
      b.rule.on = true;
      const items = kural(b.preview());
      assert.deepEqual(items.map(row => row.kod), ["kural-farki"], "fark yeni yılın maddesinde — fiş 16.01.2027 doğru yılda");
    } finally {
      await b.close();
    }
  });
});

describe("D3 tur 3 — S-KD-2 GERÇEK eski sürüm verisiyle (ders 17): v2.4.9'un GERÇEK kodunun ürettiği fikstür (surum-2.4.9-s127; kilit 31.12.2025, Excel kartları) — K = 31.12.2025", () => {
  const NAME = "surum-2.4.9-s127";
  const K25 = "2025-12-31";
  let fixture;
  let server;
  let api;
  before(async () => {
    process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
    const meta = readFixture(NAME);
    fixture = unpackFixture(NAME);
    server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: meta.now, fixed: true }, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
    api = await server.login();
  });
  after(async () => {
    await server?.close().catch(() => {});
    fixture?.cleanup();
  });
  const previewOf = async () => {
    const started = await api.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K25 });
    assert.equal(started.status, 200, JSON.stringify(started.data));
    for (let i = 0; i < 1200; i += 1) {
      const job = (await api.get(`/api/admin/devir/preview/${started.data.id}`)).data;
      if (job.state !== "running") return job;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("ön izleme bitmedi");
  };

  it("kilit K'de (31.12.2025), kural farkı ≤K maddelerde: DURDURUR 'Kural Farkı Eski Yılda Düzeltilmeli'; ilette yazan fiş tutarı = kilit 30.12.2025'e alınınca Kural Farkı Düzeltme ön izlemesinin tutarı; çare → GEÇER", { timeout: 240_000 }, async () => {
    assert.ok(iletiModule, "D3 tur 3 yok (eski kod)");
    const job = await previewOf();
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const items = job.result.onDenetim.durdurur.filter(row => row.kod.startsWith("kural-farki"));
    assert.ok(items.some(row => row.kod === "kural-farki-kilit"), job.result.onDenetim.durdurur.map(row => row.kod).join(", "));
    const row = items.find(item => item.kod === "kural-farki-kilit");
    cleanFields(row, row.kod);
    assert.match(row.neOldu, /^Dönem Kilidi 31\.12\.2025 gününde; .*01\.01\.2026 tarihine, yani yeni yıla düşüyor/);
    katalogaYaz("devir-d3-kural", "S-KD-2 GERÇEK veri: v2.4.9 fikstürü (kilit 31.12.2025, Excel kartları; 2.4.9 → 2.5.0 kural değişikliği)", row, "eski sürümün GERÇEK verisi (fikstür)");
    const amount = row.ayrinti.eskiYil.tutarMinor;
    assert.ok(amount > 0, "eski yılın fişi tutarı");
    const back = await api.put("/api/admin/period-lock", { lockedUntil: "2025-12-30" });
    assert.equal(back.status, 200, JSON.stringify(back.data));
    await server.app.ledger.snapshots.runPending();
    const view = (await api.get(CORRECTION)).data;
    assert.equal(view.disabled, false, view.reason);
    assert.equal(view.date, "2025-12-31");
    assert.equal(view.totalMinor, amount, "ilette yazan tutar = Kural Farkı Düzeltme ön izlemesi");
    const posted = await api.post(CORRECTION, { requestId: rid(), digest: view.digest, confirm: true });
    assert.equal(posted.status, 200, JSON.stringify(posted.data));
    const again = await api.put("/api/admin/period-lock", { lockedUntil: K25 });
    assert.equal(again.status, 200, JSON.stringify(again.data));
    await server.app.ledger.snapshots.runPending();
    const after = await previewOf();
    assert.deepEqual(after.result.onDenetim.durdurur.filter(item => item.kod.startsWith("kural-farki")).map(item => item.kod), [], after.result.onDenetim.durdurur.map(item => `${item.kod}: ${item.neOldu}`).join(" | "));
    assert.equal(after.result.plan.archive.donemSonucuMinor, job.result.plan.archive.donemSonucuMinor + row.ayrinti.eskiYil.karEtkisiMinor, "eski yılın dönem sonucu fişin kâr etkisi kadar değişti");
  });
});
