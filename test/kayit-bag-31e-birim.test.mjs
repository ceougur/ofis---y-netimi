// 2.4.4 31e B1–B3 birim: Devamı olarak ekle / eşitlemede gelen satırın mevcut satırla eşlenmesi (resolveIncoming), güvenli eşleşme kuralı (planRebind:
// körlemesine row_id taşıması yok, tek hedef, aynı adlı iki kişi, başka veri sayfası) ve taşımanın kendisi (createBondStore: hedefte çakışan düzeltme /
// kayıt notu üzerine yazılmaz, ayarlardaki "Ödendi Say" işareti taşınır). API düzeyi: test/kayit-bag-31e.test.mjs.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { createBondStore, createPeople, planRebind, resolveIncoming } from "../server/lib/dataset-bonds.mjs";
import { rowIdentities } from "../server/lib/dataset-identity.mjs";
import { runMigrations } from "../server/lib/migrations.mjs";

describe("31e birim: eşleme ve taşıma kuralları", () => {
  const rows = (list, tab = "S") => list.map(values => ({ __sheet: tab, ...values }));
  const stored = list => {
    const r = rows(list);
    return rowIdentities(r).map((id, index) => ({ rowId: id.id, caseKey: id.caseKey, tab: id.tab, values: r[index] }));
  };
  const entriesOf = list => {
    const r = rows(list);
    return rowIdentities(r).map((id, index) => ({ ...id, values: r[index] }));
  };
  const P = (ad, tutar, extra = {}) => ({ "Ad Soyad": ad, Tutar: tutar, ...extra });

  it("resolveIncoming: aynı içerik konum kaysa da eşlenir; aynı konumda farklı kişi yerine geçmez; kişiyle eşleme yalnız eşitlemede", () => {
    const old = stored([P("Ali Veli", "1"), P("Ayşe Kaya", "2"), P("Can Er", "3")]);
    const next = entriesOf([P("Zeki Öz", "9"), P("Ali Veli", "1"), P("Ayşe Kaya", "5"), P("Can Er", "3")]);
    const ids = options => {
      const { entries } = resolveIncoming(next, old, createPeople(old, next), options);
      assert.equal(new Set(entries.map(e => e.id)).size, entries.length, "kimlikler tekil");
      return Object.fromEntries(entries.map(e => [e.values["Ad Soyad"], e.id]));
    };
    const merge = ids();
    assert.equal(merge["Ali Veli"], old[0].rowId, "Ali içerikle eşlendi (konumu kaydı)");
    assert.equal(merge["Can Er"], old[2].rowId, "Can içerikle eşlendi");
    assert.ok(!old.some(r => r.rowId === merge["Zeki Öz"]), "Zeki yeni kimlik");
    assert.ok(!old.some(r => r.rowId === merge["Ayşe Kaya"]), "Devamı'nda değişmiş + kaymış Ayşe kendiliğinden birleştirilmez (onay ister)");
    const sync = ids({ byPerson: true });
    assert.equal(sync["Ayşe Kaya"], old[1].rowId, "eşitlemede tek adlı Ayşe kendi satırının güncellemesi");
    assert.ok(!old.some(r => r.rowId === sync["Zeki Öz"]));
    // Eşitlemede satır dosyanın sonuna kayıp değişince de (konumunda mevcut satır yok) tek adlı kişi kendi satırına eşlenir.
    const tail = entriesOf([P("Zeki Öz", "9"), P("Ali Veli", "1"), P("Can Er", "3"), P("Ayşe Kaya", "5")]);
    const tailIds = Object.fromEntries(resolveIncoming(tail, old, createPeople(old, tail), { byPerson: true }).entries.map(e => [e.values["Ad Soyad"], e.id]));
    assert.equal(tailIds["Ayşe Kaya"], old[1].rowId, "sona kayan Ayşe kendi satırının güncellemesi");
    assert.equal(new Set(Object.values(tailIds)).size, 4);
    // Aynı konumda farklı kişi: yerine geçmez, sayılır.
    const swapped = entriesOf([P("Ali Veli", "1"), P("Yeni Kişi", "7"), P("Can Er", "3")]);
    const result = resolveIncoming(swapped, old, createPeople(old, swapped));
    assert.equal(result.differentPerson, 1);
    assert.ok(!old.some(r => r.rowId === result.entries[1].id), "Yeni Kişi Ayşe'nin satırını almaz");
  });

  it("planRebind: körlemesine row_id taşıması yok (satır silinince kayan konumdaki farklı kişiye gitmez); tek hedef; başka sayfadaki anahtar taşınmaz", () => {
    const old = stored([P("Ali Veli", "1"), P("Ayşe Kaya", "2"), P("Can Er", "3")]);
    const next = entriesOf([P("Ayşe Kaya", "2"), P("Can Er", "4")]);
    const people = createPeople(old, next);
    const bonded = keys => new Map(keys.map(key => [key, { note: 1 }]));
    const plan = planRebind({ storedRows: old, entries: next, mode: "replace", people, bonded });
    assert.deepEqual(plan.unmatched.map(item => item.name), ["Ali Veli"], "Ali silindi: eşleşmez (row_id p#0 artık Ayşe'nin)");
    assert.deepEqual(plan.moves.map(item => [item.name, item.to]), [["Can Er", next[1].caseKey]], "Can kendi yeni satırına");
    const blocked = planRebind({ storedRows: old, entries: next, mode: "replace", people, bonded, elsewhere: keys => new Set(keys) });
    assert.equal(blocked.moves.length, 0, "başka sayfada da olan anahtar taşınmaz");
    // Aynı adlı iki satır: ad tek değil → aynı row_id + aynı sayı yoksa eşleşmez.
    const twins = stored([P("Ali Veli", "1"), P("Ali Veli", "2")]);
    const twinNext = entriesOf([P("Ali Veli", "3")]);
    const twinPlan = planRebind({ storedRows: twins, entries: twinNext, mode: "replace", people: createPeople(twins, twinNext), bonded });
    assert.equal(twinPlan.moves.length, 0, "iki Ali'den biri kalınca hiçbir bağ körlemesine taşınmaz");
    assert.equal(twinPlan.unmatched.length, 2);
    // Tek hedef: Dosya No eklenince borçlu ve kefil aynı dosya numarasını alır; ikisinin bağı aynı anahtara toplanmaz (hangisinin olduğu belli değil).
    const pair = stored([P("Ali Veli", "1"), P("Mehmet Kefil", "1")]);
    const pairNext = entriesOf([P("Ali Veli", "1", { "Dosya No": "2026/101" }), P("Mehmet Kefil", "1", { "Dosya No": "2026/101" })]);
    const pairPlan = planRebind({ storedRows: pair, entries: pairNext, mode: "replace", people: createPeople(pair, pairNext), bonded });
    assert.equal(pairNext[0].caseKey, "2026/101", "ön koşul: iki satır aynı anahtar");
    assert.equal(pairPlan.moves.length, 0, "iki eski anahtar aynı yeni anahtara taşınmaz");
    assert.deepEqual(pairPlan.unmatched.map(item => item.name).sort(), ["Ali Veli", "Mehmet Kefil"]);
    const single = planRebind({ storedRows: pair, entries: pairNext, mode: "replace", people: createPeople(pair, pairNext), bonded: keys => new Map(keys.filter(key => key === pair[0].caseKey).map(key => [key, { note: 1 }])) });
    assert.deepEqual(single.moves.map(item => [item.name, item.to]), [["Ali Veli", "2026/101"]], "yalnız birinin bağı varsa dosyaya taşınır");
  });

  it("taşıma hedefte aynı alanda düzeltme / kayıt notu varsa üzerine yazmaz; eskisi yerinde kalır (N17); ayarlardaki işaretler taşınır", () => {
    const store = createStore(openDatabase(":memory:"));
    runMigrations(store);
    const now = "2026-10-23T10:00:00.000Z";
    store.run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES ('o1', 'dataset://ofis', 'A', 'Tutar', 'eski', 1, 'u', ?)", now);
    store.run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES ('o2', 'dataset://ofis', 'B', 'Tutar', 'hedef', 1, 'u', ?)", now);
    store.run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES ('o3', 'dataset://ofis', 'A', 'Not', 'taşınır', 1, 'u', ?)", now);
    store.run("INSERT INTO case_notes (case_key, note, version, updated_by, updated_at) VALUES ('A', 'a', 1, 'u', ?), ('B', 'b', 1, 'u', ?)", now, now);
    store.run("INSERT INTO notes (id, case_key, note, created_by, created_at) VALUES ('n1', 'A', 'not', 'u', ?)", now);
    store.setSetting("dues.settled", JSON.stringify({ "due|S|A|Son Ödeme|2026-10-20": { reason: "paid" } }), null);
    const bonds = createBondStore({ store, datasetKey: "dataset://ofis", setting: name => name });
    assert.deepEqual([...bonds.counts(["A"]).get("A") ? Object.keys(bonds.counts(["A"]).get("A")) : []].sort(), ["note", "override", "settled"]);
    const result = bonds.move([{ from: "A", to: "B" }]);
    assert.equal(store.get("SELECT case_key AS k FROM overrides WHERE id = 'o1'").k, "A", "çakışan düzeltme yerinde");
    assert.equal(store.get("SELECT value AS v FROM overrides WHERE id = 'o2'").v, "hedef", "hedefin düzeltmesi korunur");
    assert.equal(store.get("SELECT case_key AS k FROM overrides WHERE id = 'o3'").k, "B");
    assert.equal(store.get("SELECT note FROM case_notes WHERE case_key = 'B'").note, "b");
    assert.equal(store.get("SELECT case_key AS k FROM notes WHERE id = 'n1'").k, "B");
    assert.deepEqual(Object.keys(JSON.parse(store.setting("dues.settled", "{}"))), ["due|S|B|Son Ödeme|2026-10-20"]);
    assert.equal(result.kept.overrides, 1);
    assert.equal(result.kept.case_notes, 1);
  });
});
