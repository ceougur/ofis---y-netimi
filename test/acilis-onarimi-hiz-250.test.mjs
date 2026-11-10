// 2.5.0 AH (ders 47; Ç3 ölçümü 06.11.2026: 100.000 satırlık veride şirket açılışı 101,7 sn, 1.000.000'da 22 dk'da bitmedi; olay döngüsü kilitli):
// açılış onarımı (routes/invoices.mjs repairOwnCards, Canlı Hata 2 — 2.1.0) aday kart başına carinin bütün defterini (accounts.detail) ve kapama
// girdisini (accountSettleInput: çek olayları tam tarama) okuyordu. Düzeltme yalnız okumayı değiştirir; DAVRANIŞ AYNEN.
//   1. Eşdeğerlik (kâhin = ESKİ kodun gerçek çıktısı, fark testi): GERÇEK v2.0.26 koduyla üretilmiş tohumlu veri (test/guvenilirlik/onarim-hiz-veri.mjs;
//      83 aday kart, 26'sı yanlış büyümüş, 3'ü kilitli dönemde) güncel kodla açılınca döküm (onarım sonucu sırasıyla, izler, kartlar, taksitler, bütün fatura
//      durumları, cari bakiyeleri, Kasa, aday kart görünümleri, Mutabakat Testi) taban kodun (f5b34f31) dökümüyle birebir aynı
//      (test/fixtures/onarim-hiz-250-beklenen.json; tools/acilis-onarimi-esdegerlik-250.mjs --yalniz-eski ile üretildi).
//   2. Eleme değişmezi: her adayın toplu kapama durumu (allPaymentStates) cari başına yolun (coverState → paymentStates([satır])) durumuyla aynı.
//   3. Öğe başına ağır okuma yok (dişli sayım): ikinci onarım koşusunda (yazım yok) carinin tam defteri (accounts.detail) yalnız onarım kararı çıkan adayda
//      okunur (onarılan + kilitli), veri tabanı deyimi sayısı aday sayısıyla en çok doğrusal ve küçük katsayılı. Eski kodda her aday için detail + ~25 deyim.
// "Nasıl bozulur?": aday atlanır; kapama sırası ters (onarım listesi sırası); iptal edilmiş iadenin geri ödemesi sayılır; fazla tahsilat (excess) yok sayılır;
// yazılan carinin bayat toplu durumu kullanılır; eleme yanlış negatif verir (onarılması gereken kart elenir). Sahte DURAĞAN saat (ders 13, 22).
// Platform (ders 48): dosya silmez / kilitlemez (fikstür geçici klasöre açılır, sonda silinir).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { ONARIM_FIXTURE } from "./guvenilirlik/onarim-hiz-veri.mjs";
import { CANDIDATE_SQL, dumpRepair, openWith } from "./guvenilirlik/onarim-dokum.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = readFixture(ONARIM_FIXTURE);
const expected = JSON.parse(readFileSync(path.join(REPO, "test", "fixtures", "onarim-hiz-250-beklenen.json"), "utf8")).dokum;

describe("2.5.0 AH — açılış onarımı: öğe başına ağır okuma yok, çıktı eski kodla birebir", () => {
  let unpacked;
  let app;
  before(async () => {
    process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9"; // ders 30
    unpacked = unpackFixture(ONARIM_FIXTURE);
    ({ app } = await openWith(REPO, { dataDir: unpacked.dataDir, backupDir: unpacked.backupDir, today: fixture.today }));
  });
  after(async () => {
    await app?.close();
    unpacked?.cleanup();
  });

  it("öğe başına ağır okuma yok: ikinci onarım koşusunda carinin tam defteri yalnız onarım kararı çıkan adayda okunur, deyim sayısı küçük", t => {
    const store = app.store;
    const candidates = store.all(CANDIDATE_SQL);
    assert.equal(candidates.length, 83, "fikstür: 83 aday kart");
    // Soğuk: zararsız bir ayar yazımı toplu kapama önbelleğini (settleKey: total_changes) bayatlatır — açılıştaki onarımın işi sayılır.
    store.setSetting("ah.test.soguk", "1");
    const counts = { statements: 0, detail: 0 };
    const all = store.all;
    const get = store.get;
    const accounts = app.context.accounts;
    const detail = accounts.detail;
    store.all = (...args) => {
      counts.statements += 1;
      return all(...args);
    };
    store.get = (...args) => {
      counts.statements += 1;
      return get(...args);
    };
    accounts.detail = (...args) => {
      counts.detail += 1;
      return detail(...args);
    };
    let result;
    try {
      result = app.context.invoices.repairOwnCards({});
    } finally {
      store.all = all;
      store.get = get;
      accounts.detail = detail;
    }
    const problems = [];
    // İlk açılış 26 kartı onardı; ikinci koşu yazmaz, 3 kilitli kart yine listede (idempotent; test/iade-210-onarim ile aynı kural).
    if (result.fixed.length !== 0 || result.locked.length !== 3) problems.push(`ikinci koşu: onarılan ${result.fixed.length} (beklenen 0), kilitli ${result.locked.length} (beklenen 3)`);
    const decisions = result.fixed.length + result.locked.length;
    if (counts.detail > decisions) problems.push(`carinin tam defteri (accounts.detail) ${counts.detail} kez okundu; en çok onarım kararı sayısı (${decisions}) kadar olmalı — aday başına ağır okuma (ders 47)`);
    const budget = 4 * candidates.length + 200;
    if (counts.statements > budget) problems.push(`veri tabanı deyimi ${counts.statements}; bütçe 4 × ${candidates.length} aday + 200 = ${budget}`);
    t.diagnostic(`sayım: ${JSON.stringify(counts)} · aday ${candidates.length} · onarım kararı ${decisions}`);
    assert.deepEqual(problems, [], `${problems.join("\n")}\n(sayım: ${JSON.stringify(counts)})`);
  });

  it("eşdeğerlik: döküm taban kodun (eski) gerçek dökümüyle bölüm bölüm aynı; eleme değişmezi (toplu durum = cari başına durum) her adayda", async () => {
    const dump = await dumpRepair(app, { screen: true });
    const problems = [];
    for (const key of Object.keys(expected)) if (JSON.stringify(dump[key]) !== JSON.stringify(expected[key])) problems.push(`${key}: yeni ${JSON.stringify(dump[key]).slice(0, 300)} ↔ eski ${JSON.stringify(expected[key]).slice(0, 300)}`);
    for (const key of Object.keys(dump)) if (key !== "eleme" && !(key in expected)) problems.push(`${key}: beklenen dökümde yok`);
    if (dump.eleme?.farkli !== 0) problems.push(`eleme: ${dump.eleme?.farkli} adayda toplu durum ≠ cari başına durum ${JSON.stringify(dump.eleme?.ornek)}`);
    // Fikstürün kapsamı (boş fikstürle yeşil olmasın): onarılan, kilitli ve dokunulmayan aday var; aynı caride birden çok onarım var.
    if (expected.repair.fixed.length !== 26 || expected.repair.locked.length !== 3) problems.push(`beklenen döküm: onarılan ${expected.repair.fixed.length}, kilitli ${expected.repair.locked.length}`);
    const owners = new Map();
    for (const item of expected.repair.fixed) {
      const accountId = app.store.get("SELECT account_id AS accountId FROM invoices WHERE id = ?", item.invoiceId)?.accountId;
      owners.set(accountId, (owners.get(accountId) || 0) + 1);
    }
    if (![...owners.values()].some(n => n > 1)) problems.push("fikstürde aynı caride iki onarım yok (yazılan carinin sonraki adayı yolu denenmiyor)");
    if (!expected.mutabakat.ok) problems.push("beklenen dökümde Mutabakat Testi tutarsız");
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("parça parça eleme: carileri 7'şerli parçalarla okuyan eleme, tek parçalık elemeyle ve cari başına yolla her adayda aynı (parça sınırında cari düşmez)", () => {
    const invoices = app.context.invoices;
    const ids = app.store.all(CANDIDATE_SQL).map(row => row.id);
    const accounts = new Set(app.store.all(CANDIDATE_SQL).map(row => row.accountId));
    assert.ok(accounts.size > 14, `en az üç parça için 14'ten çok cari gerekir (${accounts.size})`);
    const whole = invoices.repairScreen(ids);
    const parts = invoices.repairScreen(ids, { chunk: 7 });
    const problems = [];
    if (whole.size !== ids.length || parts.size !== ids.length) problems.push(`durum sayısı: tek parça ${whole.size}, 7'şerli ${parts.size}, aday ${ids.length}`);
    for (const row of app.store.all(CANDIDATE_SQL)) {
      // 2.5.0 Ç5-B: cari başına yol = onarımın kendi okuması (coverState → cardLedgerState; kart / bağ defteri), TYK görünümü değil.
      const exact = invoices.cardLedgerState ? invoices.cardLedgerState(row) : invoices.paymentStates([row]).get(row.id);
      for (const [label, map] of [["tek parça", whole], ["7'şerli", parts]]) {
        const got = map.get(row.id);
        if (Number(got?.open) !== Number(exact?.open) || Number(got?.excess || 0) !== Number(exact?.excess || 0)) problems.push(`${label} ${row.id}: ${JSON.stringify({ open: got?.open, excess: got?.excess })} ↔ cari başına ${JSON.stringify({ open: exact?.open, excess: exact?.excess })}`);
      }
    }
    assert.deepEqual(problems, [], problems.slice(0, 10).join("\n"));
  });
});
