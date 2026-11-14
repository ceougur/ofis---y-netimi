// 2.5.0 Ç5-A tur 2e — Kural Farkı Düzeltme Fişi'nin YIL KURALI (dar kontrol c5a2 ORTA-1; KARAR 14.11 05:40 S174 = A — 5 dk yetkisiyle, kullanıcı değiştirebilir; docs/erp/C5-ACILIS-TASARIM.md
// §3.3, §17.13; KG-15 A; EK-1 M7).
// KARAR METNİ (AYNEN, iş listesi D): "yazılmış Kural Farkı Düzeltme Fişi KENDİ yılında düzeltilmiş sayılır; kilit yıl sonunu aşınca yeni fiş ÖNERİLMEZ; ön izleme ile Yönetim satırı aynı
// yıl kuralını kullanır." EK-1 M7: farkı doğuran kilitli hareket fişle aynı mali yıldaysa eski kuralın sonuç hesabının tersi; önceki mali yıldaysa gelir yönlü 671, gider yönlü 681.
// BEKLENEN SAYILAR karar metninden + kural kitabından + girilen tutarlardan (700 / 300 / 50; ders 5) — programın kodundan DEĞİL. Saf plan vakaları elle kurulmuş fark girdisiyle (yalnız
// işlevin kendi kuralı); program vakası v2.4.9'un GERÇEK koduyla API'den (ders 17, 23). Sahte saat (ders 13, öğle saati — iki TZ'de aynı gün); lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
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
    const later = byYear({ 2027: { "500|": 70_000, "671|": -70_000 } });
    assert.deepEqual(lineText(ruleDiffCorrectionPlan({ diff: empty, year: 2026, postedByYear: later }).lines), ["A 500 700", "B 671 700"], "fişin yılı > eşleme yılı: fişin tersi");
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
      assert.deepEqual(lineText(v1.lines), ["A 602 700", "B 500 700"], "fişin yılı 2026: aynı hesap (602)");
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
      assert.deepEqual(lineText(v3.lines), ["A 602 300", "B 519 300"], "R2 reddi aynı yıl (2026): 602; fiş 1'in 602'si yeniden önerilmez");
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
      const v9 = await view();
      same(v9, i9, "yeniden kilit");
      assert.deepEqual(lineText(v9.lines), ["A 500 700", "B 681 700"], "2026'nın fazla düzeltmesi 2027'de önceki yıla ait (M7: borç yönlü 681)");

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
});
