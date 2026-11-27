// 2.5.0 Ç5-A tur 1c — HIZ DEĞİŞİKLİĞİNİN EŞDEĞERLİK testi (ders 47; docs/erp/C5-ACILIS-TASARIM.md §13). Bu bir EŞDEĞERLİK testidir: eski kodda (tur 1b ucu) da YEŞİL beklenir
// (davranış değişmedi); dişi mutantlarla gösterilir (kanıt docs/kanit/2026-11-12/c5a1c-*). Büyük veride (100 bin) ve bütün eski sürüm fikstürlerinde taban ↔ tur 1c çıktılarının
// birebir aynılığı ayrı betikle (kanıt); burada küçük ve gerçek (eski sürümlerin GERÇEK koduyla üretilmiş) veride:
//   H1 — cari satırının açılış işareti (is_opening / opening_review) ana sorgudan değil ayrı küçük sorgudan: karşı hesap veri tabanının KOLONLARINDAN bağımsız hesaplanan beklenenle
//        aynı (519 / 602 / 770; aday, onaylı, reddedilen, işaretli, sıradan); süzgeçli türetme (kapının yolu) süzgeçsizle madde madde aynı.
//   H2 — yüklenen kartın alanları ayrı sorgudan: KG-5 tek madde tutarı = T − P (veri tabanından), açılış satırı maddesiz; S127'ye bağlı kart eski yapıda; süzgeçli türetme (kart,
//        taksit satırı) süzgeçsizle aynı — taksit satırının kartı süzgeçte olmasa da.
//   H3 — journalSort ≡ sort(journalOrder): gerçek maddeler (karıştırılmış girdi) ve eşit anahtarlar.
// Sahte saat (fikstürün günü; ders 13); iki TZ'de koşulur.
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { journalOrder, journalSort } from "../server/lib/general-ledger.mjs";
import { oldRulePinnedPlans } from "../server/lib/ledger-opening.mjs";

const cents = value => Math.round((Number(value) || 0) * 100);
const servers = [];
after(async () => {
  for (const item of servers) {
    await item.server.close().catch(() => {});
    item.fixture.cleanup();
  }
});
async function open(name) {
  const fixture = unpackFixture(name);
  const manifest = readFixture(name);
  const today = manifest.oncesi?.today || String(manifest.now || "").slice(0, 10);
  const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, integrityScan: false });
  servers.push({ server, fixture });
  await server.app.ledger.snapshots.runPending();
  assert.equal(server.app.ledger.snapshots.state().pending, null, `${name}: açılıştaki dondurma bitmeli`);
  return server;
}
// Süzgeçli türetmenin her maddesi süzgeçsiz türetmedeki AYNI kimlikli maddeyle birebir (kapının yolu ↔ tam türetme).
function assertSubset(label, filtered, byId, { expectIds = [], absentIds = [] } = {}) {
  assert.ok(filtered.length > 0 || expectIds.length === 0, `${label}: süzgeçli türetme boş`);
  for (const entry of filtered) assert.deepEqual(entry, byId.get(entry.id), `${label}: ${entry.id} süzgeçli ↔ süzgeçsiz`);
  const ids = new Set(filtered.map(entry => entry.id));
  for (const id of expectIds) assert.ok(ids.has(id), `${label}: ${id} süzgeçli türetmede olmalı`);
  for (const id of absentIds) assert.ok(!ids.has(id), `${label}: ${id} süzgeçli türetmede olmamalı`);
}

describe("H1 — cari satırının açılış işareti (ayrı sorgu) ↔ veri tabanının kolonları", () => {
  it("2.0.26 verisi (göç 48 adayları + Açılış Olabilir kararları): karşı hesap 519 / 602 / 770 kolonlardan beklenenle aynı; süzgeçli = süzgeçsiz", async () => {
    const server = await open("surum-2.0.26-zincir");
    const { app } = server;
    const api = await server.login();
    // 2.0.26 fikstürünün "Açılış…" satırları göç 35'te işaretlenir (is_opening = 1); göç 48 adayı yok. Aday durumu YALNIZ göç 48'den doğar (K8-1): göçün yazdığı durum
    // (opening_review = 'candidate') işaretsiz sıradan dört elle Borç / Alacak Yaz satırına göçün kendi ham yazımıyla konur (tutar / tarih / yön değişmez; para alanı değil), sonra
    // biri onaylanır, biri reddedilir (ürünün kendi ucu) → işaretli, aday, onaylı, reddedilen ve sıradan satırların hepsi bulunur.
    const plain = app.store.all(
      `SELECT e.id FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
       WHERE COALESCE(e.source, '') = '' AND e.kind IN ('debt', 'credit') AND e.is_opening = 0 AND e.opening_review = '' ORDER BY e.rowid LIMIT 4`,
    ).map(row => row.id);
    assert.equal(plain.length, 4, "fikstürde işaretsiz elle Borç / Alacak Yaz satırı olmalı");
    app.store.raw("test.opening-review", () => app.store.run("UPDATE account_entries SET opening_review = 'candidate' WHERE id IN (SELECT value FROM json_each(?))", JSON.stringify(plain)));
    const candidates = app.store.all("SELECT e.id FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE e.opening_review = 'candidate' ORDER BY e.rowid");
    assert.ok(candidates.length >= 3, `en az üç aday olmalı (${candidates.length})`);
    assert.equal((await api.post(`/api/workspace/opening-review/${candidates[0].id}`, { decision: "confirm" })).status, 200);
    assert.equal((await api.post(`/api/workspace/opening-review/${candidates[1].id}`, { decision: "reject" })).status, 200);
    const rows = app.store.all(
      `SELECT e.id, e.kind, e.account_id AS party, e.is_opening AS isOpening, e.opening_review AS review FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
       WHERE e.kind IN ('debt', 'credit') AND COALESCE(e.source, '') = '' ORDER BY e.rowid`,
    );
    const full = app.ledger.build();
    const byId = new Map(full.map(entry => [entry.id, entry]));
    const seen = { marked: 0, candidate: 0, confirmed: 0, rejected: 0, plain: 0 };
    for (const row of rows) {
      const opening = Number(row.isOpening) === 1 || ["candidate", "confirmed"].includes(String(row.review || ""));
      const expected = opening ? "519" : row.kind === "debt" ? "602" : "770";
      const entry = byId.get(`account:${row.id}`);
      assert.ok(entry, `account:${row.id} defterde olmalı`);
      const counters = entry.lines.filter(line => ["519", "602", "770", "500"].includes(line.account)).map(line => line.account);
      assert.deepEqual(counters, [expected], `account:${row.id} (işaret ${row.isOpening}, durum '${row.review}'): karşı hesap`);
      seen[Number(row.isOpening) === 1 ? "marked" : row.review || "plain"] += 1;
    }
    for (const kind of ["candidate", "confirmed", "rejected", "plain"]) assert.ok(seen[kind] > 0, `sınıf bulunmalı: ${kind} (${JSON.stringify(seen)})`);
    // Süzgeçli yol: işaretli / aday / onaylı / reddedilen satırların carileri tek tek ve satır kimliğiyle (para süzgeci).
    const decided = app.store.all("SELECT e.id, e.account_id AS party FROM account_entries e WHERE e.opening_review IN ('candidate', 'confirmed', 'rejected') OR e.is_opening = 1 ORDER BY e.rowid LIMIT 12");
    for (const row of decided) {
      assertSubset(`cari ${row.party}`, app.ledger.build({ parties: [row.party] }), byId, { expectIds: [`account:${row.id}`] });
      assertSubset(`satır ${row.id}`, app.ledger.build({ money: { account_entries: [row.id] } }), byId, { expectIds: [`account:${row.id}`] });
    }
  });
});

describe("H2 — yüklenen kartın alanları (ayrı sorgu) ↔ veri tabanı", () => {
  for (const name of ["surum-2.4.9-s127-kilitsiz", "surum-2.4.9-s127"]) {
    it(`${name}: KG-5 tek madde T − P / A 519, açılış satırı maddesiz (S127'ye bağlı kart eski yapıda); süzgeçli (kart, taksit satırı) = süzgeçsiz`, async () => {
      const server = await open(name);
      const { app } = server;
      const cards = app.store.all(
        `SELECT p.id, p.total, p.covers_balance AS covers, p.account_id AS party FROM plans p WHERE p.deleted_at IS NULL AND p.import_id <> '' ORDER BY p.rowid`,
      );
      assert.ok(cards.length >= 3, `${name}: yüklenen kart olmalı (${cards.length})`);
      const pinned = oldRulePinnedPlans(app.store);
      if (name === "surum-2.4.9-s127") assert.ok(pinned.size > 0, "kilitli fikstürde S127'ye bağlı kart olmalı");
      else assert.equal(pinned.size, 0, "kilitsiz fikstürde bağlı kart yok");
      const full = app.ledger.build();
      const byId = new Map(full.map(entry => [entry.id, entry]));
      let checked = 0;
      for (const card of cards) {
        const openings = app.store.all("SELECT id, amount FROM plan_entries WHERE plan_id = ? AND kind = 'in' AND opening = 1 ORDER BY rowid", card.id);
        const T = cents(card.total);
        const P = openings.reduce((sum, row) => sum + cents(row.amount), 0);
        const entry = byId.get(`plan:${card.id}`);
        if (Number(card.covers)) {
          assert.equal(entry, undefined, `kapsayan kart ${card.id} yeni alacak getirmez`);
          continue;
        }
        const credit519 = entry ? entry.lines.filter(line => line.account === "519").reduce((sum, line) => sum + line.credit - line.debit, 0) : 0;
        if (pinned.has(card.id)) {
          assert.equal(credit519, T, `S127'ye bağlı kart ${card.id}: kart maddesi T`);
          for (const row of openings) assert.ok(byId.has(`plan-entry:${row.id}`), `bağlı kartın açılış satırı ${row.id} ayrı madde`);
        } else {
          if (T - P > 0) assert.equal(credit519, T - P, `kart ${card.id}: tek madde T − P`);
          // KG-5 B5: maddenin günü yüklemenin (plan_imports.created_at) YEREL günü — veri tabanından, sürecin saat dilimiyle.
          const stamp = app.store.get("SELECT x.created_at AS at FROM plans p JOIN plan_imports x ON x.id = p.import_id WHERE p.id = ?", card.id)?.at;
          if (T - P > 0 && stamp) {
            const day = new Date(stamp);
            assert.equal(entry.date, `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`, `kart ${card.id}: madde yükleme gününde`);
          }
          for (const row of openings) assert.ok(!byId.has(`plan-entry:${row.id}`), `kart ${card.id}: açılış satırı ${row.id} maddesiz`);
        }
        assertSubset(`kart ${card.id}`, app.ledger.build({ plans: [card.id] }), byId);
        if (card.party) assertSubset(`kartın carisi ${card.party}`, app.ledger.build({ parties: [card.party] }), byId);
        // Taksit satırı süzgeci: kart süzgeçte DEĞİL — satırın "kart yüklenmiş" bilgisi yine doğru olmalı (bağlı değilse madde yok, bağlıysa madde var).
        for (const row of openings) {
          const filtered = app.ledger.build({ money: { plan_entries: [row.id] } });
          assertSubset(`taksit satırı ${row.id}`, filtered, byId, pinned.has(card.id) ? { expectIds: [`plan-entry:${row.id}`] } : { absentIds: [`plan-entry:${row.id}`] });
        }
        checked += 1;
      }
      assert.ok(checked >= 3, `${name}: sınanan kart sayısı ${checked}`);
    });
  }
});

describe("H3 — journalSort ≡ sort(journalOrder)", () => {
  // Tohumlu karıştırma (ders 13 / tekrarlanabilirlik).
  const shuffled = (list, seed) => {
    let state = seed >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const same = (label, input) => {
    const expected = input.slice().sort(journalOrder);
    const actual = journalSort(input.slice());
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < expected.length; index += 1) assert.equal(actual[index], expected[index], `${label}: ${index}. madde (${expected[index].id} beklenirdi, ${actual[index].id})`);
  };
  it("gerçek maddeler (2.4.9 S127 kilitli fikstürü + 2.0.26) karıştırılmış girdiyle; eşit anahtarlar, yazım sırası olmayan, açılış sınıflı ve bilinmeyen önekli maddeler", async () => {
    for (const name of ["surum-2.4.9-s127", "surum-2.0.26-zincir"]) {
      const server = servers.find(item => item.fixture.fixture.name === name)?.server || (await open(name));
      const entries = server.app.ledger.build();
      assert.ok(entries.length > 10, `${name}: madde sayısı ${entries.length}`);
      assert.ok(entries.some(entry => Number.isFinite(entry.cls)), `${name}: açılış sınıflı madde olmalı`);
      same(`${name} (türetme sırası)`, entries);
      for (const seed of [1, 2, 3]) same(`${name} (karıştırma ${seed})`, shuffled(entries, seed));
    }
    // Eşit anahtarlar (kararlılık), yazım sırası olmayan madde (Infinity), açılış sınıfı (cls) ile önek sınıfı, bilinmeyen önek (90).
    const synthetic = [];
    for (let i = 0; i < 40; i += 1) {
      const prefix = ["cash", "account", "plan", "stock-open", "bank", "bilinmeyen", "voucher-open", "vat-offset"][i % 8];
      synthetic.push({ id: `${prefix}:${i % 5}`, date: `2026-01-0${1 + (i % 3)}`, ...(i % 4 ? { seq: i % 7 } : {}), ...(i % 6 === 0 ? { cls: 2 } : {}), lines: [], tag: i });
    }
    same("yapay (eşit anahtarlar)", synthetic);
    for (const seed of [7, 8, 9]) same(`yapay (karıştırma ${seed})`, shuffled(synthetic, seed));
  });
});
