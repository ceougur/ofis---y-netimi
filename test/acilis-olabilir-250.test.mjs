// 2.5.0 Ç5-A tur 2c İş 3 — "Açılış Olabilir Kayıtlar" uçlarının ekran için eklenenleri (docs/erp/C5-ACILIS-TASARIM.md §2.4, §17.10; KULLANICI S47 = A, S51 = A; BAŞ MİMAR B16;
// tur 1e dar kontrolü DÜŞÜK-3 "sayfalama ve toplu karar yok").
// KURAL (karar metinlerinden): onay → açılış (519), ret → sıradan Borç / Alacak Yaz (602 / 770), onay BEKLERKEN de 519 (S47 = A); karar satırın tutarını / tarihini / yönünü / açılış
// işaretini DEĞİŞTİRMEZ; kilitli dönemdeki satıra karar verilir, donmuş dönem değişmez, fark Kural Farkı Düzeltme fişiyle (§3.3); Kural Farkı fişi kilitli dönemde onay bekleyen aday
// varken yazılmaz ve neden aday ekranını söyler (B16). Tur 2c'nin ekledikleri: sayfalama + toplam, zil sayısı (kilitli dönemdeki aday ayrıca), toplu karar (aynı işlemde; listede olmayan
// kimlik varsa HİÇBİRİ yazılmaz), kararı geri al (satır yeniden onay bekler).
// Veri: v2.4.9'un GERÇEK koduyla API'den (aynı adlı iki cari, kilitli dönemde aday; ders 17, 23) → güncel kod açılır, göç 48 adayları kurar. Sahte saat (ders 13); iki TZ'de koşulur;
// lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { lockDigestOf, LOCK_SQL_VERSION } from "../server/lib/integrity.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const LOCK = "2026-10-05";
const URL = "/api/workspace/opening-review";
const SKIP = !tagsAvailable(["v2.4.9"]) ? "v2.4.9 etiketi yok" : false;
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const stateOf = (app, id) => app.store.get("SELECT opening_review AS review, opening_review_gate AS gate, amount, date, kind, is_opening AS o FROM account_entries WHERE id = ?", id);
/** Satırın defter maddesinin karşı hesabı (120 / 320 dışı). */
const counterOf = (app, id) => (app.ledger.build().find(entry => entry.id === `account:${id}`)?.lines || []).map(line => line.account).filter(code => !["120", "320", "336"].includes(code)).join(",");

describe("Ç5-A tur 2c İş 3 — Açılış Olabilir Kayıtlar: sayfalama, zil sayısı, toplu karar, geri al, kilitli satır, yetki", { skip: SKIP }, () => {
  let dirs = null;
  let server = null;
  let api = null;
  const ids = {};
  before(async () => {
    const root = mkdtempSync(path.join(tmpdir(), "c5a2c-acilis-olabilir-"));
    dirs = { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion("v2.4.9", { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW });
    try {
      const o = await old.login();
      await o.post("/api/workspace/bank/setup/dismiss", {});
      // Aynı adlı iki cari (anayasa: "aynı adlı iki kişi").
      const a1 = await must("A1", o.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", type: "customer", registeredOn: "2026-09-01" }));
      const a2 = await must("A2", o.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", type: "customer", registeredOn: "2026-09-01" }));
      const add = async (account, note, kind, amount, date) => {
        await must(note, o.post(`/api/workspace/accounts/${account}/entries`, { kind, amount, date, note }));
        return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ? AND date = ?", account, note, date).id;
      };
      Object.assign(ids, {
        a1: a1.id,
        a2: a2.id,
        locked: await add(a1.id, "Açılış bakiyesi", "debt", "70", "2026-10-02"),
        first: await add(a1.id, "Açılış devri", "debt", "300", "2026-10-12"),
        second: await add(a2.id, "Açılış devri", "debt", "200", "2026-10-12"),
        credit: await add(a2.id, "AÇILIŞ", "credit", "100", "2026-10-13"),
        fifth: await add(a2.id, "Açilış farkı", "debt", "40", "2026-10-14"),
        plain: await add(a2.id, "Devir bakiyesi", "debt", "10", "2026-10-14"),
      });
      await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
    api = await server.login();
    for (const key of ["locked", "first", "second", "credit", "fifth"]) assert.equal(stateOf(server.app, ids[key]).review, "candidate", `ön koşul: göç 48 ${key} satırını aday yaptı`);
    assert.equal(stateOf(server.app, ids.plain).review, "", "ön koşul: 'Devir…' aday değil");
  });
  after(async () => {
    await server?.close?.().catch(() => {});
    if (dirs) rmSync(dirs.root, { recursive: true, force: true });
  });

  it("sayfalama + toplam; sayfasız çağrı tur 1 çıktısı (kilit alanı yok); zil sayısı kilitli dönemdeki adayı ayrıca verir; geçersiz sayfa 400", async () => {
    const plain = await must("sayfasız", api.get(URL));
    assert.equal(plain.items.length, 5);
    assert.equal(Object.hasOwn(plain, "total"), false, "sayfasız çağrıda toplam yok (tur 1 çıktısı)");
    assert.equal(plain.items.some(item => Object.hasOwn(item, "locked")), false);
    assert.deepEqual(plain.counts, { candidate: 5, confirmed: 0, rejected: 0 });
    const page1 = await must("sayfa 1", api.get(`${URL}?limit=2&offset=0`));
    const page2 = await must("sayfa 2", api.get(`${URL}?limit=2&offset=2`));
    const page3 = await must("sayfa 3", api.get(`${URL}?limit=2&offset=4`));
    assert.deepEqual([...page1.items, ...page2.items, ...page3.items].map(item => item.id), plain.items.map(item => item.id), "sayfalar sıralı listeyi eksiksiz, tekrarsız böler");
    assert.deepEqual([page1.items.length, page2.items.length, page3.items.length], [2, 2, 1]);
    assert.deepEqual([page1.total, page2.total, page3.total], [5, 5, 5]);
    assert.equal(page1.items[0].id, ids.locked);
    assert.equal(page1.items[0].locked, true, "kilitli dönemdeki satır işaretli");
    assert.equal(page1.items[1].locked, false);
    assert.deepEqual(page1.counts, { candidate: 5, confirmed: 0, rejected: 0, lockedCandidate: 1 });
    assert.deepEqual((await must("zil", api.get(`${URL}?counts=1`))).counts, { candidate: 5, confirmed: 0, rejected: 0, lockedCandidate: 1 });
    for (const query of ["limit=0", "limit=501", "limit=2&offset=-1", "limit=abc", "limit=2&offset=1.5"]) assert.equal((await api.get(`${URL}?${query}`)).status, 400, query);
  });

  it("toplu karar (aynı adlı iki cari): ikisi de onaylanır, 519; listede olmayan kimlik varsa HİÇBİRİ yazılmaz (404); karar tutar / tarih / yön / işaret değiştirmez", async () => {
    const before = [stateOf(server.app, ids.first), stateOf(server.app, ids.second)];
    const missing = await api.post(URL, { ids: [ids.first, ids.plain], decision: "reject" });
    assert.equal(missing.status, 404, JSON.stringify(missing.data));
    assert.deepEqual([stateOf(server.app, ids.first).review, stateOf(server.app, ids.first).gate], ["candidate", "candidate"], "listede olmayan kimlik: ilk kimliğin kararı da geri alındı");
    const bulk = await must("toplu onay", api.post(URL, { ids: [ids.first, ids.second, ids.first], decision: "confirm" }));
    assert.equal(bulk.changed, 2, "yinelenen kimlik bir kez");
    assert.deepEqual(bulk.items.map(item => [item.id, item.review, item.previous]), [[ids.first, "confirmed", "candidate"], [ids.second, "confirmed", "candidate"]]);
    for (const [index, key] of ["first", "second"].entries()) {
      const now = stateOf(server.app, ids[key]);
      assert.deepEqual([now.review, now.gate], ["confirmed", "confirmed"], `${key}: kapının kopyası aynı işlemde`);
      assert.deepEqual([now.amount, now.date, now.kind, now.o], [before[index].amount, before[index].date, before[index].kind, before[index].o], `${key}: para alanı değişmez`);
      assert.equal(counterOf(server.app, ids[key]), "519");
    }
    assert.equal((await must("tekrar", api.post(URL, { ids: [ids.first, ids.second], decision: "confirm" }))).changed, 0, "aynı karar tekrarı yazmaz");
    for (const body of [{ ids: [], decision: "confirm" }, { ids: [ids.first], decision: "x" }, { decision: "confirm" }, { ids: Array.from({ length: 1001 }, (_, i) => `x${i}`), decision: "confirm" }]) {
      assert.equal((await api.post(URL, body)).status, 400, JSON.stringify(body).slice(0, 80));
    }
  });

  it("geri al: kararlı satır yeniden onay bekler (S47: defterde yine 519); ret → geri al → onay; listede olmayan satırda 404; adayda değişiklik yok", async () => {
    const undo = await must("geri al", api.post(`${URL}/${ids.first}`, { decision: "undo" }));
    assert.deepEqual([undo.item.review, undo.item.previous, undo.changed], ["candidate", "confirmed", true]);
    assert.deepEqual([stateOf(server.app, ids.first).review, stateOf(server.app, ids.first).gate], ["candidate", "candidate"]);
    assert.equal(counterOf(server.app, ids.first), "519", "onay bekleyen satır defterde açılış (S47 = A)");
    assert.equal((await must("adayda geri al", api.post(`${URL}/${ids.first}`, { decision: "undo" }))).changed, false);
    await must("ret", api.post(`${URL}/${ids.credit}`, { decision: "reject" }));
    assert.equal(counterOf(server.app, ids.credit), "770", "ret: sıradan Alacak Yaz (C-02 — 2.4.9 kuralı; .90 Ç7b)");
    const back = await must("ret → geri al", api.post(`${URL}/${ids.credit}`, { decision: "undo" }));
    assert.deepEqual([back.item.review, back.item.previous], ["candidate", "rejected"]);
    assert.equal(counterOf(server.app, ids.credit), "519");
    await must("onay", api.post(`${URL}/${ids.credit}`, { decision: "confirm" }));
    assert.equal((await api.post(`${URL}/${ids.plain}`, { decision: "undo" })).status, 404, "listede olmayan satır geri alınamaz");
    const audit = server.app.store.all("SELECT type, COUNT(*) AS n FROM audit_events WHERE type LIKE 'account.opening.%' GROUP BY type ORDER BY type").map(row => `${row.type}:${row.n}`);
    assert.deepEqual(audit, ["account.opening.confirmed:3", "account.opening.rejected:1", "account.opening.reopened:2"], "her değişen karar bir iz; değişmeyen iz yazmaz");
  });

  it("kilitli satır: karar verilir, kilit izi ve donmuş defter değişmez; Kural Farkı fişi aday varken pasif, neden aday ekranını söyler (B16); karar verilince pasiflik kalkar", async () => {
    const digest = lockDigestOf(server.app.store, LOCK, { version: LOCK_SQL_VERSION });
    const frozen = () => JSON.stringify(server.app.store.all("SELECT * FROM ledger_snapshots ORDER BY date, entry_id, rule_version"));
    const frozenBefore = frozen();
    const blocked = await must("Kural Farkı ön izleme", api.get("/api/admin/ledger/rule-diff-correction"));
    assert.equal(blocked.code, "rule-diff-candidates");
    assert.match(blocked.reason, /onay bekleyen 1 kayıt var \(Yönetim › Sistem › Açılış Olabilir Kayıtlar\)\.$/);
    await must("kilitli satıra ret", api.post(`${URL}/${ids.locked}`, { decision: "reject" }));
    assert.equal(lockDigestOf(server.app.store, LOCK, { version: LOCK_SQL_VERSION }), digest, "karar kilit izine girmez");
    assert.equal(frozen(), frozenBefore, "donmuş defter değişmez");
    assert.equal((await must("zil", api.get(`${URL}?counts=1`))).counts.lockedCandidate, 0);
    const open = await must("Kural Farkı ön izleme (karardan sonra)", api.get("/api/admin/ledger/rule-diff-correction"));
    assert.notEqual(open.code, "rule-diff-candidates", JSON.stringify(open).slice(0, 300));
    assert.ok(open.sources.some(item => item.id === `account:${ids.locked}`), "kilitli satırın kararı Kural Farkı'nda kaynağıyla görünür");
    const result = server.app.integrity.scan().result;
    assert.ok(!result.failures.some(item => item.code === "opening:review"), "kapının kopyası aynı işlemde: opening:review sapması yok");
  });

  it("yetki: personel 403 (liste, zil, tek, toplu, geri al); Muhasebe uçları kullanır (tur 1 yetkisi accounts.manage); iki kişi aynı anda — son karar geçerli, kopya aynı", async () => {
    for (const [username, role] of [["personel2c", "personel"], ["muhasebe2c", "muhasebe"]]) {
      await must(`${username} oluştur`, api.post("/api/admin/users", { username, name: username, role, password: "Personel-2026!", mustChangePassword: false }));
    }
    const staff = await server.login("personel2c", "Personel-2026!");
    for (const [label, call] of [["liste", staff.get(`${URL}?limit=10`)], ["zil", staff.get(`${URL}?counts=1`)], ["tek", staff.post(`${URL}/${ids.fifth}`, { decision: "confirm" })], ["toplu", staff.post(URL, { ids: [ids.fifth], decision: "confirm" })], ["geri al", staff.post(`${URL}/${ids.first}`, { decision: "undo" })]]) {
      assert.equal((await call).status, 403, label);
    }
    assert.equal(stateOf(server.app, ids.fifth).review, "candidate");
    const acc = await server.login("muhasebe2c", "Personel-2026!");
    const other = await server.login();
    const [one, two] = await Promise.all([acc.post(`${URL}/${ids.fifth}`, { decision: "confirm" }), other.post(`${URL}/${ids.fifth}`, { decision: "reject" })]);
    assert.deepEqual([one.status, two.status], [200, 200]);
    const final = stateOf(server.app, ids.fifth);
    assert.ok(["confirmed", "rejected"].includes(final.review));
    assert.equal(final.gate, final.review, "iki kişi aynı anda: kapının kopyası son kararla aynı");
  });
});
