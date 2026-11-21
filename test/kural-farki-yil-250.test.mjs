// 2.5.0 Ç5-A tur 2e — Kural Farkı Düzeltme Fişi'nin YIL KURALI (dar kontrol c5a2 ORTA-1; KARAR 14.11 05:40 S174 = A — 5 dk yetkisiyle, kullanıcı değiştirebilir; docs/erp/C5-ACILIS-TASARIM.md
// §3.3, §17.13; KG-15 A; EK-1 M7).
// KARAR METNİ (AYNEN, iş listesi D): "yazılmış Kural Farkı Düzeltme Fişi KENDİ yılında düzeltilmiş sayılır; kilit yıl sonunu aşınca yeni fiş ÖNERİLMEZ; ön izleme ile Yönetim satırı aynı
// yıl kuralını kullanır." EK-1 M7: farkı doğuran kilitli hareket fişle aynı mali yıldaysa eski kuralın sonuç hesabının tersi; önceki mali yıldaysa gelir yönlü 671, gider yönlü 681.
// BEKLENEN SAYILAR karar metninden + kural kitabından + girilen tutarlardan (700 / 300 / 50; ders 5) — programın kodundan DEĞİL. Saf plan vakaları elle kurulmuş fark girdisiyle (yalnız
// işlevin kendi kuralı); program vakası v2.4.9'un GERÇEK koduyla API'den (ders 17, 23). Sahte saat (ders 13, öğle saati — iki TZ'de aynı gün); lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
// Ad alanıyla (eski kodda yeni işlev yoksa dosya yüklenir, vakalar kendi nedeniyle düşer — ders 38).
import * as opening from "../server/lib/ledger-opening.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const URL = "/api/admin/ledger/rule-diff-correction";
const REVIEW = "/api/workspace/opening-review";
const RULE_DIFF = "ledger:rule-diff";
const lineText = lines => lines.map(line => `${line.debit ? "B" : "A"} ${line.sub || line.account} ${(line.debit || line.credit) / 100}`).sort();
const entry = (id, deltas) => ({ id, date: "2026-10-01", source: "", text: id, deltas });
const d = (account, minor, { year = 2026, sub = "", party = "" } = {}) => ({ year, account, sub, party, minor });
const ruleDiffCorrectionPlan = args => opening.ruleDiffCorrectionPlan(args);
const ruleDiffCorrectionYear = args => opening.ruleDiffCorrectionYear(args);
const byYear = obj => new Map(Object.entries(obj).map(([year, lines]) => [Number(year), new Map(Object.entries(lines))]));

describe("Ç5-A tur 2e — Kural Farkı Düzeltme Fişi: yıl kuralı (saf plan)", () => {
  it("[y1] eşleme yılı tek tanım: ilk açık günün (kilit + 1) yılı; 30.12 / 31.12 sınırı; kilit yoksa donmuş dönem, o da yoksa bugün", () => {
    assert.equal(ruleDiffCorrectionYear({ lock: "2026-12-30", cover: "2026-12-30", today: "2027-01-05" }), 2026, "kilit 30.12 → fiş 31.12.2026");
    assert.equal(ruleDiffCorrectionYear({ lock: "2026-12-31", cover: "2026-12-31", today: "2027-01-05" }), 2027, "kilit 31.12 → fiş 01.01.2027");
    assert.equal(ruleDiffCorrectionYear({ lock: "2026-10-05", cover: "2026-10-05", today: "2027-01-05" }), 2026, "bugünün yılı ≠ kilit + 1'in yılı: fişin yılı");
    assert.equal(ruleDiffCorrectionYear({ lock: "", cover: "2026-12-31", today: "2027-03-01" }), 2027, "kilit yok, donmuş dönem var");
    assert.equal(ruleDiffCorrectionYear({ lock: "", cover: "", today: "2027-03-01" }), 2027, "ikisi de yok: bugün");
  });

  it("[y2] S174 = A: 2026'da yazılmış fiş (B 500 / A 602) kilit 31.12.2026'yı aşınca kendi yılında düzeltilmiş sayılır — 2027'de fiş önerilmez", () => {
    const diff = { entries: [entry("account:r1", [d("500", 70_000), d("602", -70_000)])] };
    const posted = byYear({ 2026: { "500|": 70_000, "602|": -70_000 } });
    assert.deepEqual(ruleDiffCorrectionPlan({ diff, year: 2027, postedByYear: posted }).lines, [], "2027: satır yok (2027 mizanı 602 = 0, 671 = 0)");
    assert.deepEqual(ruleDiffCorrectionPlan({ diff, year: 2026, postedByYear: posted }).lines, [], "2026 içinde de satır yok (bugünkü gibi)");
    // Fişsiz: 2027'de aynı fark önceki yılın geliri → 671 (EK-1 M7 — DEĞİŞMEZ).
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff, year: 2027, postedByYear: new Map() }).lines), ["A 671 700", "B 500 700"]);
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff, year: 2026, postedByYear: new Map() }).lines), ["A 602 700", "B 500 700"]);
  });

  it("[y3] eski yıldan DÜZELTİLMEMİŞ fark + aynı yıl düzeltilmiş fark birlikte: yeni fiş yalnız düzeltilmemiş kısmı, 671'e", () => {
    const diff = { entries: [entry("account:r1", [d("500", 70_000), d("602", -70_000)]), entry("account:r2", [d("519", 30_000), d("602", -30_000)])] };
    const posted = byYear({ 2026: { "500|": 70_000, "602|": -70_000 } });
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff, year: 2027, postedByYear: posted }).lines), ["A 671 300", "B 519 300"]);
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff, year: 2026, postedByYear: posted }).lines), ["A 602 300", "B 519 300"], "aynı yıl: 602");
    // İki fiş (2026'da bir, 2027'de yeni fark için bir): ikisi birlikte farkı kapatır.
    const both = byYear({ 2026: { "500|": 70_000, "602|": -70_000 }, 2027: { "519|": 30_000, "671|": -30_000 } });
    assert.deepEqual(ruleDiffCorrectionPlan({ diff, year: 2027, postedByYear: both }).lines, []);
    // İki yıl sonu: 2027'nin fişindeki 671 satırı (2026 farkının karşılığı) 2028'de de eşlenmiş toplamdan düşülür — yeni fiş önerilmez (ham farka sayılırsa B 681 / A 671 hayalet fişi çıkar).
    assert.deepEqual(ruleDiffCorrectionPlan({ diff, year: 2028, postedByYear: both }).lines, [], "2028: iki fiş farkı kapatmış kalır");
    // EK-1 M7'nin iki örneği (önceki yıl): eski kural açılış çekini 770'e gider yazmışsa B 519 / A 671; 602'ye gelir yazmışsa B 681 / A 519.
    const expense = { entries: [entry("cheque:c1", [d("770", -20_000), d("519", 20_000)])] };
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff: expense, year: 2027, postedByYear: new Map() }).lines), ["A 671 200", "B 519 200"]);
    const income = { entries: [entry("cheque:c2", [d("602", 20_000), d("519", -20_000)])] };
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff: income, year: 2027, postedByYear: new Map() }).lines), ["A 519 200", "B 681 200"]);
  });

  it("[y4] eski biçim (yıl ayrımsız toplam) ve tek yıl fişi: sonuç expected − posted (bugünkü hesap AYNEN)", () => {
    const diff = { entries: [entry("account:r1", [d("500", 70_000), d("602", -70_000)]), entry("account:r2", [d("519", 30_000), d("602", -30_000)])] };
    const posted = new Map([["500|", 70_000], ["602|", -70_000]]);
    const legacy = ruleDiffCorrectionPlan({ diff, year: 2026, posted });
    const fresh = ruleDiffCorrectionPlan({ diff, year: 2026, postedByYear: new Map([[2026, posted]]) });
    assert.deepEqual(fresh.lines, legacy.lines);
    assert.deepEqual(lineText(fresh.lines), ["A 602 300", "B 519 300"]);
  });

  it("[y5] fazla düzeltme yıl sonundan sonra: tutar doğru (700); fişin yılı eşleme yılından SONRA ise (kilit geri alındı) satırlar fişin tersi", () => {
    const empty = { entries: [] };
    const posted = byYear({ 2026: { "500|": 70_000, "602|": -70_000 } });
    const over = ruleDiffCorrectionPlan({ diff: empty, year: 2027, postedByYear: posted });
    assert.equal(over.lines.reduce((sum, line) => sum + line.debit, 0), 70_000, "fazla tutar 700");
    // 2026'nın fazla geliri 2027'de önceki yıla ait (M7: borç yönlü düzeltme 681).
    assert.deepEqual(lineText(over.lines), ["A 500 700", "B 681 700"]);
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff: empty, year: 2026, postedByYear: posted }).lines), ["A 500 700", "B 602 700"], "aynı yıl: fişin tersi (bugünkü gibi)");
    // Tur 2f (S185 = A; beklenti DEĞİŞTİ — tur 2e'de "fişin tersi" B 671 700 / A 500 700 idi): fişin yılı > eşleme yılı (kilit fişin yılından geriye alındı) — fiş KENDİ yılında
    // düzeltilmiş sayılır; fark kalmadığında fiş fazladır ama fazlası 2027'nindir: 2026'ya (kilitli döneme) satır ÖNERİLMEZ, fazla fişin kendi yılında (ters kayıtla).
    const later = byYear({ 2027: { "500|": 70_000, "671|": -70_000 } });
    const back = ruleDiffCorrectionPlan({ diff: empty, year: 2026, postedByYear: later });
    assert.deepEqual(back.lines, [], "fişin yılı > eşleme yılı: 2026'ya fiş önerilmez");
    assert.deepEqual(back.ownYearOver, [{ year: 2027, minor: 70_000 }], "fazla 700, fişin kendi yılı 2027");
    assert.deepEqual(over.ownYearOver, [], "fişin yılı < eşleme yılı: fazla eşleme yılının ön izlemesinde (fişin kendi yılı kilitli)");
  });

  it("[y8] S185 = A iki yönde: fişin yılı > eşleme yılı — 2027 fişi 2026'nın farkını KENDİ yılında (671) düzeltmiş sayılır; yalnız düzeltilmemiş fark 2026'ya (602), fazla fiş kendi yılında", () => {
    const r1 = entry("account:r1", [d("500", 70_000), d("602", -70_000)]);
    const r2 = entry("account:r2", [d("519", 30_000), d("602", -30_000)]);
    const f27 = byYear({ 2027: { "500|": 70_000, "671|": -70_000 } });
    const run = (entries, year, postedByYear) => ruleDiffCorrectionPlan({ diff: { entries }, year, postedByYear });
    // Kilit doğrudan 30.11.2026'ya geri (fark duruyor): 2026'ya fiş yok, fazla yok (tur 2e: B 671 700 / A 602 700 öneriyordu).
    const kept = run([r1], 2026, f27);
    assert.deepEqual(lineText(kept.lines), [], "fark 2027 fişiyle kendi yılında kapanmış: 2026'ya fiş önerilmez (2026 mizanı 671 = 0)");
    assert.deepEqual(kept.ownYearOver, [], "fazla yok");
    // Aynı fiş, eşleme yılı fişin yılı (kilit yeniden 31.12.2026): yine satır yok (S174 = A'nın tek yıl hâli, bugünkü gibi).
    assert.deepEqual(run([r1], 2027, f27).lines, []);
    // Kilit 2026'dayken 2026'da yeni fark (R2 300 reddi): yalnız düzeltilmemiş 300 eşleme yılına, aynı yıl → 602 (EK-1 M7); 2027 fişinin 700'ü yeniden önerilmez.
    assert.deepEqual(lineText(run([r1, r2], 2026, f27).lines), ["A 602 300", "B 519 300"]);
    // R2'nin fişi 2026'ya da yazılınca iki fiş birlikte farkı kapatır.
    assert.deepEqual(run([r1, r2], 2026, byYear({ 2026: { "519|": 30_000, "602|": -30_000 }, 2027: { "500|": 70_000, "671|": -70_000 } })).lines, []);
    // Fark kalmadı (kilit önce kaldırılıp geri — dönem güncel kuralla yeniden dondu): fiş tümüyle fazla, 2026'ya satır yok (tur 2e: B 671 700 / A 500 700).
    const gone = run([], 2026, f27);
    assert.deepEqual(gone.lines, []);
    assert.deepEqual(gone.ownYearOver, [{ year: 2027, minor: 70_000 }]);
    // Fark kısmen kaldı (R1'in 400'ü artık açılış — 519): fişin 671 satırı farkı 400 aşıyor → fiş fazla; 2026'ya satır yok (ters kayıttan sonra kalan fark önerilir).
    const part = run([entry("account:r1", [d("500", 70_000), d("602", -30_000), d("519", -40_000)])], 2026, f27);
    assert.deepEqual(part.lines, []);
    assert.deepEqual(part.ownYearOver, [{ year: 2027, minor: 40_000 }], "fazla = fişin 700'ü − kalan fark 300");
    assert.deepEqual(lineText(run([entry("account:r1", [d("500", 70_000), d("602", -30_000), d("519", -40_000)])], 2026, new Map()).lines), ["A 519 400", "A 602 300", "B 500 700"], "ters kayıttan sonra: kalan fark 2026'ya");
    // BUGÜNKÜ DAVRANIŞ (KODLANMADI — tur 2f raporunda KULLANICIYA SORULMALI): 2027 fişinin 671 satırı 2026'nın 602 farkını ve 2025'in farkını (2026'da 671) KISMEN karşılıyor —
    // kalanı hangi hesaba (602 mi, 671 mi) böleceğini karar söylemiyor; fiş tur 2e'nin kuralıyla (eşlenmiş toplamdan) düşülür. Karar gelince beklenti değişir.
    const split = run([entry("account:r1", [d("500", 75_000), d("602", -70_000), d("602", -5_000, { year: 2025 })])], 2026, byYear({ 2027: { "500|": 50_000, "671|": -50_000 } }));
    assert.deepEqual(lineText(split.lines), ["A 602 700", "B 500 250", "B 671 450"]);
    assert.deepEqual(split.ownYearOver, []);
  });

  it("[y9] DÜŞÜK-3 (P3): önceki yılın fazla düzeltmesinde 671 / 681 yönü KALAN farkın yönünden (EK-1 M7) — ham farkın yönünden değil", () => {
    // 2026'da R1 700 + R2 300 reddi → 2026 fişi B 519 1.000 / A 602 1.000; sonra R1 açılış sayıldı → 2026'nın 602 farkı yalnız 300. Eşleme yılı 2027: 602 700 FAZLA düzeltilmiş
    // (gelir azaltan, borç yönlü) → 681 borç 700 (ham fark alacak yönlü olduğu için 671 OLMAZ).
    const diff = { entries: [entry("account:r2", [d("519", 30_000), d("602", -30_000)]), entry("account:r1", [d("500", 70_000), d("519", -70_000)])] };
    const posted = byYear({ 2026: { "519|": 100_000, "602|": -100_000 } });
    const plan = ruleDiffCorrectionPlan({ diff, year: 2027, postedByYear: posted });
    assert.ok(lineText(plan.lines).includes("B 681 700"), `681 borç 700: ${lineText(plan.lines)}`);
    assert.ok(!plan.lines.some(line => line.account === "671"), `671 yok: ${lineText(plan.lines)}`);
    assert.deepEqual(lineText(plan.lines), ["A 519 1400", "B 500 700", "B 681 700"]);
    // Aynı yıl (2026) içinde fazla eski hesabın tersi: 602 borç 700.
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff, year: 2026, postedByYear: posted }).lines), ["A 519 1400", "B 500 700", "B 602 700"]);
  });

  it("[y6] N1: alt defter dışlaması kararlı noktaya kadar yinelenir — birinci maddenin dışlanması ikinci maddenin alt defter hesabını sıfırdan çıkarır", () => {
    const subledger = new Set(["120", "320"]);
    // E1: 120 (cari A) +100 → dışlanır; E1'in 320 (cari B) +50'si gidince E2'nin 320 (cari B) −50'si tek başına kalır → E2 de dışlanmalı.
    const diff = { entries: [entry("account:e1", [d("120", 10_000, { party: "A" }), d("320", 5_000, { party: "B" }), d("500", -15_000)]), entry("account:e2", [d("320", -5_000, { party: "B" }), d("519", 5_000)])] };
    const plan = ruleDiffCorrectionPlan({ diff, subledger, year: 2026, postedByYear: new Map() });
    assert.deepEqual([...plan.excludedEntries].sort(), ["account:e1", "account:e2"], "iki madde de dışarıda");
    assert.deepEqual(plan.lines, [], "fişe alt defter hesabı (320) girmez; fiş yok");
    assert.deepEqual(plan.excluded.map(row => `${row.account} ${row.party} ${row.minor}`), ["120 A 10000", "500  -15000", "519  5000"]);
  });
});

// Program vakası: v2.4.9'un GERÇEK koduyla API'den üç "Açılış…" Borç Yaz (göç 48 aday yapar) — R1 02.10.2026 700 (v2.4.9 kilidi 05.10.2026 içinde), R2 10.11.2026 300, R3 30.12.2026 50.
const SKIP = !tagsAvailable(["v2.4.9"]) ? "v2.4.9 etiketi yok" : false;
describe("Ç5-A tur 2e — Kural Farkı Düzeltme Fişi: yıl kuralı (program, v2.4.9 verisi)", { skip: SKIP }, () => {
  it("[y7] S174 = A uçtan uca: fiş 2026 → kilit 30.12 (602) → kilit 31.12 (671) → aday onayı → 'Fişle düzeltilebilen fark kalmadı' + Düzeltildi; ikinci fiş; ters kayıt; kilit kaldır / yeniden kilitle", { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "kfy-250-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    let seq = 0;
    const rid = () => `kfy-${process.pid}-${String(++seq).padStart(8, "0")}`;
    const ids = {};
    let server = null;
    try {
      const old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-12-30T12:00:00+03:00", fixed: true } });
      try {
        const o = await old.login();
        await o.post("/api/workspace/bank/setup/dismiss", {});
        const party = await must("cari", o.post("/api/workspace/accounts", { name: "Yıl Ayrımı Müşteri", type: "customer", registeredOn: "2026-09-01" }));
        const add = async (note, amount, date) => {
          await must(note, o.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "debt", amount, date, note }));
          return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ? AND date = ?", party.id, note, date).id;
        };
        Object.assign(ids, { r1: await add("Açılış bakiyesi", "700", "2026-10-02"), r2: await add("Açılış devri", "300", "2026-11-10"), r3: await add("Açılış farkı", "50", "2026-12-30") });
        await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: "2026-10-05" }));
      } finally {
        await old.close();
      }
      server = await bootVersion(CURRENT, { ...dirs, now: { time: "2027-01-05T12:00:00+03:00", fixed: true }, integrityScan: false });
      const { app } = server;
      await app.ledger.snapshots.runPending();
      const api = await server.login();
      const review = id => app.store.get("SELECT opening_review AS r FROM account_entries WHERE id = ?", id).r;
      for (const key of ["r1", "r2", "r3"]) assert.equal(review(ids[key]), "candidate", `ön koşul: göç 48 ${key} satırını aday yaptı`);
      const view = async () => must("ön izleme", api.get(URL));
      const item = async () => ((await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).checks || []).find(check => check.code === RULE_DIFF) || null;
      const lock = async until => {
        await must(`kilit ${until || "yok"}`, api.put("/api/admin/period-lock", { lockedUntil: until }));
        await app.ledger.snapshots.runPending();
      };
      const decide = (id, decision) => must(`karar ${decision}`, api.post(`${REVIEW}/${id}`, { decision }));
      const vouchers = () => app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n;
      const sums = (from, to, accounts) => {
        const book = app.ledger.book({ from, to });
        return Object.fromEntries(accounts.map(code => [code, book.reduce((sum, e) => sum + e.lines.filter(line => line.account === code).reduce((t, line) => t + line.debit - line.credit, 0), 0) / 100]));
      };
      /** Ön izleme ile Yönetim satırı aynı kuralı kullanır: düzeltilmemiş kalan iki yerde aynı tutar. */
      const same = (v, i, label) => assert.equal(i?.correction?.remainderMinor ?? 0, v.totalMinor, `${label}: Yönetim satırının kalanı = ön izlemenin toplamı`);

      // 1) Kilit 05.10.2026, bugün 05.01.2027 (bugünün yılı ≠ kilit + 1'in yılı — N11): R1 reddi → fiş 06.10.2026'nın yılı 2026 → 602 (671 değil).
      assert.equal((await view()).code, "rule-diff-candidates", "ön koşul: kilitli dönemde R1 onay bekliyor (B16)");
      await decide(ids.r1, "reject");
      const v1 = await view();
      assert.equal(v1.disabled, false, v1.reason);
      assert.equal(v1.date, "2026-10-06");
      // 2.5.0 Ç7b — BEKLENTİ BİLEREK DEĞİŞTİ (C-01, KG-4 = A): reddedilen (işaretsiz) Borç Yaz'ın karşılığı 602.90 "Sınıflandırılmamış" (ana hesap 602 aynı).
      assert.deepEqual(lineText(v1.lines), ["A 602.90 700", "B 500 700"], "fişin yılı 2026: aynı hesap (602; alt hesap 602.90)");
      const p1 = await must("fiş 1", api.post(URL, { requestId: rid(), digest: v1.digest, confirm: true }));
      assert.equal(p1.voucher.noText, "Fiş 2026-000001");
      assert.ok((await item())?.corrected, "fiş 1 sonrası Düzeltildi");

      // 2) Kilit 30.12.2026 (fiş 31.12.2026, yıl 2026): kilit günündeki R3 de kilitli dönemde sayılır (N9 zil, N10 B16).
      await lock("2026-12-30");
      const blocked = await view();
      assert.equal(blocked.code, "rule-diff-candidates");
      assert.match(blocked.reason, /onay bekleyen 2 kayıt var/, "R2 + kilit günündeki R3");
      assert.equal((await must("zil", api.get(`${REVIEW}?counts=1`))).counts.lockedCandidate, 2, "zil: kilit günündeki aday kilitli dönemde");
      const i2 = await item();
      assert.ok(i2?.corrected, `adaylar (519) donmuş = canlı; fiş 1 hâlâ düzeltiyor: ${JSON.stringify(i2)}`);
      await decide(ids.r2, "reject");
      const blocked2 = await view();
      assert.equal(blocked2.code, "rule-diff-candidates", "yalnız kilit günündeki R3 kaldı — fiş yine yazılmaz");
      assert.match(blocked2.reason, /onay bekleyen 1 kayıt var/);
      assert.equal((await api.post(URL, { requestId: rid(), digest: blocked2.digest, confirm: true })).status, 409, "B16 sunucuda da");
      await decide(ids.r3, "confirm");
      const v3 = await view();
      assert.equal(v3.disabled, false, v3.reason);
      assert.equal(v3.date, "2026-12-31");
      assert.deepEqual(lineText(v3.lines), ["A 602.90 300", "B 519 300"], "R2 reddi aynı yıl (2026): 602 (602.90; Ç7b C-01); fiş 1'in 602'si yeniden önerilmez");
      same(v3, await item(), "kilit 30.12");

      // 3) Kilit 31.12.2026 (fiş 01.01.2027, yıl 2027): R2'nin 2026 farkı önceki yıl → 671; fiş 1 kendi yılında düzeltilmiş (S174 = A).
      await lock("2026-12-31");
      const v4 = await view();
      assert.equal(v4.date, "2027-01-01");
      assert.deepEqual(lineText(v4.lines), ["A 671 300", "B 519 300"], "yalnız düzeltilmemiş 300, önceki yıl 671 (EK-1 M7); fiş 1'in 700'ü yeniden önerilmez");
      same(v4, await item(), "kilit 31.12");
      // ORTA-1'in kendisi: R2 onaylanınca fark kalmaz → ön izleme pasif, Yönetim satırı Düzeltildi, 2027'ye yanlış fiş yazılmaz.
      await decide(ids.r2, "undo");
      await decide(ids.r2, "confirm");
      const v5 = await view();
      assert.equal(v5.disabled, true);
      assert.equal(v5.code, "rule-diff-nothing");
      assert.equal(v5.reason, "Fişle düzeltilebilen fark kalmadı.");
      assert.deepEqual(v5.lines, []);
      const i5 = await item();
      assert.ok(i5?.ok === true && i5.corrected, `Düzeltildi: ${JSON.stringify(i5)}`);
      assert.match(i5.name, /— Düzeltildi \(Fiş 2026-000001\)$/);
      same(v5, i5, "kilit 31.12, fark yok");
      const refused = await api.post(URL, { requestId: rid(), digest: v5.digest, confirm: true });
      assert.equal(refused.status, 409);
      assert.equal(vouchers(), 1, "2027'ye fiş yazılmadı");
      assert.deepEqual(sums("2027-01-01", "2027-12-31", ["602", "671", "681"]), { 602: 0, 671: 0, 681: 0 }, "2027 mizanı: 602 = 0, 671 = 0");
      assert.equal(sums("2026-01-01", "2026-12-31", ["602"])["602"], -700, "2026 defteri: fiş 1'in A 602 700'ü (değişmez)");

      // 4) R2 yeniden reddedilir → ikinci fiş (2027) yalnız 300'ü 671'e; iki fiş birlikte Düzeltildi.
      await decide(ids.r2, "reject");
      const v6 = await view();
      assert.deepEqual(lineText(v6.lines), ["A 671 300", "B 519 300"]);
      const p2 = await must("fiş 2", api.post(URL, { requestId: rid(), digest: v6.digest, confirm: true }));
      assert.equal(p2.voucher.noText, "Fiş 2027-000001");
      const i6 = await item();
      assert.deepEqual(i6?.corrected?.vouchers, ["Fiş 2026-000001", "Fiş 2027-000001"]);
      assert.equal((await view()).code, "rule-diff-nothing");
      assert.deepEqual(sums("2027-01-01", "2027-12-31", ["602", "671"]), { 602: 0, 671: -300 }, "2027: yalnız 671 alacak 300");

      // 5) Ters kayıt (aynı yıl): ters kaydedilmiş fiş sayılmaz — kalan 300, aynı satırlar; etkin listede ve ipucunda yalnız fiş 1 (N3).
      await must("ters kayıt", api.post(`/api/admin/ledger/vouchers/${p2.voucher.id}/reverse`, { requestId: rid() }));
      const i7 = await item();
      assert.ok(i7 && i7.ok === false && !i7.corrected, "ters kayıttan sonra uyarı");
      assert.deepEqual(i7.correction?.vouchers, ["Fiş 2026-000001"], "ters kaydedilmiş fiş listede yok");
      assert.match(i7.hint, /Kural Farkı Düzeltme Fişi \(Fiş 2026-000001\) farkın bir kısmını düzeltti/);
      const v7 = await view();
      assert.deepEqual(lineText(v7.lines), ["A 671 300", "B 519 300"]);
      assert.deepEqual(v7.vouchers.map(voucher => voucher.noText), ["Fiş 2026-000001"]);
      same(v7, i7, "ters kayıt sonrası");

      // 6) Kilit kaldır → fiş 1 fazla (700); yeniden kilitle (dönem güncel kuralla donar) → yine fazla 700; ön izleme ile Yönetim satırı aynı tutar.
      await lock("");
      const i8 = await item();
      assert.ok(i8?.correction?.over === true && i8.correction.remainderMinor === 70_000, `kilit kalkınca fazla 700: ${JSON.stringify(i8)}`);
      await lock("2026-12-31");
      const i9 = await item();
      assert.ok(i9?.correction?.over === true && i9.correction.remainderMinor === 70_000, `yeniden kilit: fazla 700: ${JSON.stringify(i9)}`);
      // Tur 2f DÜŞÜK-1 (beklenti DEĞİŞTİ — tur 2e: "… artık fazla — … ters kaydedin."): fiş 1'in tarihi (06.10.2026) kilitli dönemde; ekrandaki Ters Kaydet fişin kendi tarihiyle yazar
      // ve 409 alır — ipucu ekranda yapılabilen yolu (ön izlemedeki fiş, ilk açık güne) söyler.
      assert.match(i9.hint, /\(Fiş 2026-000001\) artık fazla\. Fişin tarihi kilitli dönemde olduğu için ters kaydı yazılamaz — Yönetim › Sistem › Kural Farkı Düzeltme'de ön izlemedeki fişi kaydedin; fazla ilk açık güne alınır\.$/);
      assert.doesNotMatch(i9.hint, /ters kaydedin/, "ekrandan yapılamayan ters kayıt önerilmez");
      const screenReverse = await api.post(`/api/admin/ledger/vouchers/${p1.voucher.id}/reverse`, { requestId: rid() });
      assert.equal(screenReverse.status, 409, "ekranın tarihsiz ters kaydı (fişin kendi tarihi, kilitli) yazılmaz");
      assert.equal(screenReverse.data?.code, "period-locked");
      const v9 = await view();
      same(v9, i9, "yeniden kilit");
      assert.deepEqual(lineText(v9.lines), ["A 500 700", "B 681 700"], "2026'nın fazla düzeltmesi 2027'de önceki yıla ait (M7: borç yönlü 681)");
      // Tek aday düzeltme turu (dar kontrol t3c7a DÜŞÜK — N11): kilit TAM fişin günündeyse (kilit = 06.10.2026 = fiş 1'in tarihi) fiş de kilitli dönemdedir (kilit günü dahil
      // kapalı) — ipucu yine ekranda yapılabilen yolu söyler, ters kaydı önermez. Sonra kilit 31.12'ye döner (adım 7 değişmez).
      await lock("2026-10-06");
      const iSame = await item();
      assert.ok(iSame?.correction?.over === true, `kilit = fiş günü: fazla: ${JSON.stringify(iSame)}`);
      assert.match(iSame.hint, /Fişin tarihi kilitli dönemde olduğu için ters kaydı yazılamaz/, "kilit günü = fiş günü: fiş kilitli sayılır");
      assert.doesNotMatch(iSame.hint, /ters kaydedin/);
      const sameDayReverse = await api.post(`/api/admin/ledger/vouchers/${p1.voucher.id}/reverse`, { requestId: rid() });
      assert.equal(sameDayReverse.status, 409, "kilit günündeki fişin tarihsiz ters kaydı yazılmaz (ipucu doğru yolu söylüyor)");
      assert.equal(sameDayReverse.data?.code, "period-locked");
      await lock("2026-12-31");

      // 7) BUGÜNKÜ DAVRANIŞ (KODLANMADI — tur 2e raporunda KULLANICIYA SORULMALI): 2026'nın fişi 2027'de TERS kaydedilirse ters kaydın satırları ASIL fişin yılına sayılır ("ters
      // kaydedilmiş fiş sayılmaz" — taban ile aynı); fiş ve tersi birbirini götürür, kural farkı öğesi kalmaz. Defterde ters kayıt 2027'nin 602'sine yazılır. Karar değişirse bu beklenti değişir.
      await must("2026 fişini 2027'de ters kaydet", api.post(`/api/admin/ledger/vouchers/${p1.voucher.id}/reverse`, { requestId: rid(), date: "2027-01-05" }));
      assert.equal(await item(), null, "fiş + tersi: kural farkı öğesi yok (fazla da yok)");
      const v10 = await view();
      assert.equal(v10.code, "rule-diff-nothing");
      assert.equal(v10.reason, "Düzeltilecek kural farkı yok.");
      assert.deepEqual(sums("2027-01-01", "2027-12-31", ["602", "681"]), { 602: 700, 681: 0 }, "ters kayıt 2027'nin 602'sine borç 700");
    } finally {
      await server?.close().catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Tur 2f — S185 = A (KARAR 14.11 11:28, kullanıcı kuralıyla öneri; AYNEN iş listesi C): "sonraki yılın fişi de KENDİ yılında düzeltilmiş sayılır (S174 = A'nın 'kendi yılında' kuralı iki
  // yönde) — kilit geri alınınca kilitli döneme yeni fiş ÖNERİLMEZ; fark kapanmışsa satır 'Düzeltildi', fiş fazla kalmışsa ipucu 'Fiş 2027-… kendi yılında ters kaydedin' der; 2026 mizanında
  // 671 = 0." Dar kontrol c5a2e'nin vaka A'sı, iki kol: (b) kilit doğrudan 30.11.2026'ya; (a) kilit önce kaldırılıp 30.11.2026'ya (dönem güncel kuralla yeniden donar).
  it("[y10] S185 = A uçtan uca: 2027 fişi → kilit 30.11.2026'ya geri — (b) doğrudan: Düzeltildi, 2026'ya fiş yok, yeni 2026 farkı 602'ye; (a) önce kaldır: fiş fazla, ipucu kendi yılında ters kayıt, ters kayıtla temiz", { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "kfy10-250-"));
    const seed = path.join(root, "seed");
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    let seq = 0;
    const rid = () => `kfy10-${process.pid}-${String(++seq).padStart(8, "0")}`;
    const ids = {};
    const servers = [];
    try {
      const old = await bootVersion("v2.4.9", { dataDir: path.join(seed, "data"), backupDir: path.join(seed, "backups"), now: { time: "2026-12-30T12:00:00+03:00", fixed: true } });
      try {
        const o = await old.login();
        await o.post("/api/workspace/bank/setup/dismiss", {});
        const party = await must("cari", o.post("/api/workspace/accounts", { name: "Kilit Geri Müşteri", type: "customer", registeredOn: "2026-09-01" }));
        const add = async (note, amount, date) => {
          await must(note, o.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "debt", amount, date, note }));
          return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ? AND date = ?", party.id, note, date).id;
        };
        Object.assign(ids, { r1: await add("Açılış bakiyesi", "700", "2026-10-02"), r2: await add("Açılış devri", "300", "2026-11-10"), r3: await add("Açılış farkı", "50", "2026-12-30") });
        await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: "2026-10-05" }));
      } finally {
        await old.close();
      }
      /** Bir kol: v2.4.9 verisinin kendi kopyası, bugün 10.01.2027; R2 + R3 onay, R1 ret, kilit 31.12.2026 → Fiş 2027-000001. */
      const start = async name => {
        const dir = path.join(root, name);
        cpSync(seed, dir, { recursive: true });
        const server = await bootVersion(CURRENT, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2027-01-10T12:00:00+03:00", fixed: true }, integrityScan: false });
        servers.push(server);
        const { app } = server;
        await app.ledger.snapshots.runPending();
        const api = await server.login();
        const lock = async until => {
          await must(`kilit ${until || "yok"}`, api.put("/api/admin/period-lock", { lockedUntil: until }));
          await app.ledger.snapshots.runPending();
        };
        const view = async () => must("ön izleme", api.get(URL));
        const item = async () => ((await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).checks || []).find(check => check.code === RULE_DIFF) || null;
        /** Yıl × hesap (kilitli dönem donmuş defterden; maddeler tarihle süzülür). */
        const year = (y, accounts) => {
          const book = app.ledger.book({}).filter(e => e.date.startsWith(String(y)));
          return Object.fromEntries(accounts.map(code => [code, book.reduce((sum, e) => sum + e.lines.filter(line => line.account === code).reduce((t, line) => t + line.debit - line.credit, 0), 0) / 100]));
        };
        const vouchers = () => app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n;
        const same = (v, i, label) => assert.equal(i?.correction?.remainderMinor ?? 0, v.totalMinor, `${label}: Yönetim satırının kalanı = ön izlemenin toplamı`);
        await must("r2 onay", api.post(`${REVIEW}/${ids.r2}`, { decision: "confirm" }));
        await must("r3 onay", api.post(`${REVIEW}/${ids.r3}`, { decision: "confirm" }));
        await must("r1 ret", api.post(`${REVIEW}/${ids.r1}`, { decision: "reject" }));
        await lock("2026-12-31");
        const v1 = await view();
        assert.equal(v1.date, "2027-01-01");
        assert.deepEqual(lineText(v1.lines), ["A 671 700", "B 500 700"], "2026'nın farkı 2027'de önceki yılın geliri (EK-1 M7)");
        const p1 = await must("fiş 2027", api.post(URL, { requestId: rid(), digest: v1.digest, confirm: true }));
        assert.equal(p1.voucher.noText, "Fiş 2027-000001");
        assert.ok((await item())?.corrected, "kilit 31.12.2026: Düzeltildi");
        return { app, api, lock, view, item, year, vouchers, same, p1 };
      };

      // (b) Kilit DOĞRUDAN 30.11.2026'ya (donmuş defter kısalır, fark durur).
      {
        const c = await start("dogrudan");
        await c.lock("2026-11-30");
        const v = await c.view();
        assert.equal(v.date, "2026-12-01");
        assert.deepEqual(v.lines, [], `2026'ya ikinci fiş önerilmez (tur 2e: B 671 700 / A 602 700): ${JSON.stringify(v.lines)}`);
        assert.equal(v.code, "rule-diff-nothing");
        assert.equal(v.reason, "Fişle düzeltilebilen fark kalmadı.");
        const i = await c.item();
        assert.ok(i?.ok === true && i.corrected, `Düzeltildi (tur 2e: kalan 700): ${JSON.stringify(i)}`);
        assert.match(i.name, /— Düzeltildi \(Fiş 2027-000001\)$/);
        assert.equal(i.correction.over, false);
        c.same(v, i, "kilit geri (doğrudan)");
        assert.equal((await c.api.post(URL, { requestId: rid(), digest: v.digest, confirm: true })).status, 409, "sunucu da 2026'ya fiş yazmaz");
        assert.equal(c.vouchers(), 1);
        assert.deepEqual(c.year(2026, ["671", "681"]), { 671: 0, 681: 0 }, "2026 mizanı: 671 = 0");
        assert.deepEqual(c.year(2027, ["500", "671"]), { 500: 700, 671: -700 }, "2027: fişin kendisi (fark 2027'de önceki yılın geliri)");
        // Kilit 2026'dayken 2026'da yeni fark: R2 (10.11.2026, kilitli dönemde) Geri Al → ret → yalnız 300, aynı yıl → 602; 2027 fişinin 700'ü yeniden önerilmez.
        await must("r2 geri al", c.api.post(`${REVIEW}/${ids.r2}`, { decision: "undo" }));
        await must("r2 ret", c.api.post(`${REVIEW}/${ids.r2}`, { decision: "reject" }));
        const v2 = await c.view();
        assert.deepEqual(lineText(v2.lines), ["A 602.90 300", "B 519 300"], "Ç7b C-01: reddedilen Borç Yaz 602.90");
        const i2 = await c.item();
        c.same(v2, i2, "yeni 2026 farkı");
        const p2 = await must("fiş 2026", c.api.post(URL, { requestId: rid(), digest: v2.digest, confirm: true }));
        assert.equal(p2.voucher.noText, "Fiş 2026-000001");
        assert.equal(p2.voucher.date, "2026-12-01");
        assert.deepEqual((await c.item())?.corrected?.vouchers, ["Fiş 2026-000001", "Fiş 2027-000001"], "iki fiş birlikte Düzeltildi");
        assert.equal((await c.view()).code, "rule-diff-nothing");
        assert.deepEqual(c.year(2026, ["500", "602", "671", "681"]), { 500: -700, 602: -300, 671: 0, 681: 0 }, "2026: R1 donmuş defterde eski kuralla (500), R2'nin 300'ü fişle 602; 671 = 0");
        // Kilit yeniden 31.12.2026: iki fiş kendi yıllarında; yeni fiş yok.
        await c.lock("2026-12-31");
        assert.equal((await c.view()).code, "rule-diff-nothing");
        assert.ok((await c.item())?.corrected);
      }

      // (a) Kilit önce KALDIRILIP 30.11.2026'ya (dönem güncel kuralla yeniden donar → fark yok): fiş tümüyle fazla, fazlası 2027'nin.
      {
        const c = await start("once-kaldir");
        await c.lock("");
        await c.lock("2026-11-30");
        const v = await c.view();
        assert.deepEqual(v.lines, [], `2026'ya fiş önerilmez (tur 2e: B 671 700 / A 500 700): ${JSON.stringify(v.lines)}`);
        assert.equal(v.code, "rule-diff-own-year");
        assert.match(v.reason, /^Kural Farkı Düzeltme Fişi \(Fiş 2027-000001\) kilitli dönemin farkından fazla .*kendi yılında ters kaydedin/);
        const i = await c.item();
        assert.ok(i && i.ok === false && !i.corrected, `uyarı: ${JSON.stringify(i)}`);
        assert.equal(i.correction.over, true);
        assert.equal(i.correction.remainderMinor, 0, "eşleme yılına (2026) önerilecek kalan yok (tur 2e: 700)");
        assert.deepEqual(i.correction.ownYear, ["Fiş 2027-000001"]);
        assert.equal(i.correction.ownYearMinor, 70_000);
        assert.equal(i.hint, "Kural Farkı Düzeltme Fişi (Fiş 2027-000001) kilitli dönemin farkından fazla (kilit, fişin yılından geriye alındı) — fişi kendi yılında, Yönetim › Sistem › Kural Farkı Düzeltme'den ters kaydedin; kalan fark varsa sonra ön izlemede görünür.");
        c.same(v, i, "kilit geri (önce kaldır)");
        assert.equal((await c.api.post(URL, { requestId: rid(), digest: v.digest, confirm: true })).status, 409);
        assert.equal(c.vouchers(), 1);
        // Ekranın Ters Kaydet'i (tarihsiz — fişin kendi tarihi 01.01.2027, açık dönem) yazılır: kendi yılında ters kayıt → temiz.
        const rv = await must("ters kayıt (ekran gövdesi)", c.api.post(`/api/admin/ledger/vouchers/${c.p1.voucher.id}/reverse`, { requestId: rid() }));
        assert.equal(rv.voucher.date, "2027-01-01", "ters kayıt fişin kendi yılında");
        assert.equal(await c.item(), null, "kural farkı öğesi yok");
        const after = await c.view();
        assert.equal(after.code, "rule-diff-nothing");
        assert.equal(after.reason, "Düzeltilecek kural farkı yok.");
        assert.deepEqual(c.year(2026, ["500", "602", "671", "681"]), { 500: 0, 602: -700, 671: 0, 681: 0 }, "2026: R1 güncel kuralla gelir (602), 671 = 0");
        assert.deepEqual(c.year(2027, ["500", "602", "671", "681"]), { 500: 0, 602: 0, 671: 0, 681: 0 }, "2027: fiş + tersi");
      }
    } finally {
      for (const server of servers) await server.close().catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });
});
