// 2.5.0 Ç5-A tur 1e — İş 2 (dar kontrol G-2, GERİLEME; KULLANICI KARARI S51 = A'nın bağlanmamış parçası; BAŞ MİMAR B8): Silinenler'den geri alınan cari satırının KG-16 durumu.
// S51 = A (06.11.2026, AYNEN iş listesi D): "Silinenler'den geri alınan açılış (cari başka açılışla) 'Açılış Olabilir' listesine girer." B8: Silinenler'den dönen 2.4.x yükü (işaretsiz
// "Açılış…") ADAY olur — silinmeden önceki hâliyle döner, göçte aday olacaktı.
// Önceden (c5a1e-taban): silme yükü opening_review'u taşımıyor, geri alma yazmıyordu → onaylı "Açılış Olabilir" satırı (defterde 519) silinip geri alınınca durum '' oluyor, satır
// gelire düşüyordu (120 B 300 / 602 A 300); Mutabakat Testi temiz. Yazılmış yardımcı (lib/ledger-opening.mjs restoredOpeningReview) hiçbir yerden çağrılmıyordu.
// NASIL BOZULUR: onaylı / reddedilen / aday × sil → geri al (durum ve karşı hesap aynen); S51'in kendi örneği (açılış silinir, cari başka açılış alır, eskisi geri alınır → aday) hem
// 2.4.5'te silinmiş (yükte işaret yok, açıklamadan) hem 2.5.0'da silinmiş (yükte işaret var) yükte; 2.4.x'te silinmiş "Açılış…" satırı (B8 → aday); kilitli dönem (silme / geri alma
// 409, durum değişmez); kapının kopyası (opening_review_gate) aynı işlemde — geri almadan sonra "opening:review" sapması yok.
// Veri: v2.4.5 ve v2.4.9'un GERÇEK koduyla API'den (test/guvenilirlik/surumler.mjs; ders 17, 23). Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const SKIP = !tagsAvailable(["v2.4.5", "v2.4.9"]) ? "v2.4.5 / v2.4.9 etiketi yok" : false;
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const dirsOf = prefix => {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
};
/** Satırın defter maddesi: karşı hesaplar (120 dışı) ve satırları. */
const linesOf = (app, id) => (app.ledger.build().find(entry => entry.id === `account:${id}`)?.lines || []).map(line => `${line.account}:${line.debit}/${line.credit}`).sort().join(" ");
// Durum (is_opening + KG-16) ve kapının kopyası AYRI okunur: kopya sütunu (göç 50) eski kodda yoktur — eski kodun kırmızısı durumdan / karşı hesaptan okunsun (ders 38).
const stateOf = (app, id) => {
  const row = app.store.get("SELECT is_opening AS isOpening, opening_review AS review FROM account_entries WHERE id = ?", id);
  return row ? { ...row } : null;
};
const gateOf = (app, id) => {
  const has = app.store.all("PRAGMA table_info(account_entries)").some(column => column.name === "opening_review_gate");
  return has ? app.store.get("SELECT opening_review_gate AS g FROM account_entries WHERE id = ?", id)?.g : "(sütun yok)";
};
const assertState = (app, id, want, label) => {
  assert.deepEqual(stateOf(app, id), { isOpening: want.isOpening, review: want.review }, label);
  // Güncel kodda sütun her zaman var (göç 50; kural-farki-kapi-disi [6]); eski kodda yok → yalnız durum denetlenir (kırmızının nedeni durumdan okunur).
  const gate = gateOf(app, id);
  if (gate !== "(sütun yok)") assert.equal(gate, want.review, `${label} — kapının kopyası aynı işlemde`);
};
/** Silinenler satırının yükü (veri tabanından; liste ucu yükü döndürmez). */
const payloadOf = (app, item) => {
  const row = app.store.get("SELECT payload_json AS p FROM trash WHERE id = ?", String(item.id).replace(/^[^:]*:/, ""));
  assert.ok(row, `Silinenler satırı veri tabanında: ${item.id}`);
  return JSON.parse(row.p || "{}");
};
const trashItem = async (api, ref) => (await must("Silinenler", api.get("/api/admin/trash"))).find(item => item.kind === "account-entry" && item.ref === ref);
async function deleteAndRestore(api, accountId, id) {
  await must("sil", api.del(`/api/workspace/accounts/${accountId}/entries/${id}`));
  const item = await trashItem(api, id);
  assert.ok(item, `Silinenler'de ${id} var`);
  return api.post("/api/admin/trash/restore", { id: item.id });
}
const noReviewDrift = app => {
  const result = app.integrity.scan().result;
  assert.ok(!result.failures.some(item => item.code === "opening:review"), `geri almadan sonra "opening:review" sapması yok: ${JSON.stringify(result.failures.map(item => item.code))}`);
};

describe("Ç5-A tur 1e — Silinenler'den dönen satırın KG-16 durumu (S51 = A, B8)", { skip: SKIP }, () => {
  // ---------- v2.4.9 verisi: dar kontrolün örneği + sınıf tablosu + B8 + kilitli satır ----------
  const v249 = { dirs: null, ids: {} };
  let server = null;
  let api = null;
  before(async () => {
    v249.dirs = dirsOf("c5a1e-kg16-249-");
    const old = await bootVersion("v2.4.9", { dataDir: v249.dirs.dataDir, backupDir: v249.dirs.backupDir, now: NOW });
    try {
      const o = await old.login();
      await o.post("/api/workspace/bank/setup/dismiss", {});
      const k = await must("K", o.post("/api/workspace/accounts", { name: "Geri Alma K", type: "customer", registeredOn: "2026-10-01", openingBalance: "800" }));
      const add = async (note, kind, amount, date) => {
        await must(note, o.post(`/api/workspace/accounts/${k.id}/entries`, { kind, amount, date, note }));
        return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ?", k.id, note).id;
      };
      Object.assign(v249.ids, {
        k: k.id,
        confirmed: await add("Açılış devri (ikinci)", "debt", "300", "2026-10-12"),
        rejected: await add("Açılış farkı", "debt", "200", "2026-10-12"),
        candidate: await add("AÇILIŞ", "credit", "100", "2026-10-13"),
        lockedRow: await add("Açılış eski", "debt", "70", "2026-10-03"),
        laterLocked: await add("Açılış ara", "debt", "60", "2026-10-08"),
        b8: await add("Açılış ek", "debt", "50", "2026-10-14"),
      });
      // B8: 2.4.9'da silinen "Açılış…" satırı (yükünde openingReview yok).
      assert.equal((await o.del(`/api/workspace/accounts/${k.id}/entries/${v249.ids.b8}`)).status, 200);
      await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: "2026-10-05" }));
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { dataDir: v249.dirs.dataDir, backupDir: v249.dirs.backupDir, now: NOW, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
    api = await server.login();
    for (const key of ["confirmed", "rejected", "candidate", "lockedRow", "laterLocked"]) assert.equal(stateOf(server.app, v249.ids[key]).review, "candidate", `ön koşul: göç 48 ${key} satırını aday yaptı`);
    await must("onay", api.post(`/api/workspace/opening-review/${v249.ids.confirmed}`, { decision: "confirm" }));
    await must("ret", api.post(`/api/workspace/opening-review/${v249.ids.rejected}`, { decision: "reject" }));
  }, { timeout: 180_000 });
  after(async () => {
    await server?.close().catch(() => {});
    v249.dirs?.cleanup();
  });

  it("dar kontrolün örneği: v2.4.9'da girilmiş 'Açılış devri (ikinci)' → aday → onay (120 / 519) → sil → geri al: ONAYLI ve 519'da kalır", async () => {
    const id = v249.ids.confirmed;
    assert.equal(linesOf(server.app, id), "120:30000/0 519:0/30000", "ön koşul: onaylı satır 519'da");
    assert.equal((await deleteAndRestore(api, v249.ids.k, id)).status, 200);
    assertState(server.app, id, { isOpening: 0, review: "confirmed" }, "onay bilgisi korunur (kapının kopyasıyla)");
    assert.equal(linesOf(server.app, id), "120:30000/0 519:0/30000", "geri alınan onaylı satır gelire (602) düşmez");
    noReviewDrift(server.app);
  });

  it("sınıf tablosu: reddedilen → reddedilen (602 / 770), aday → aday (519); kapının kopyası aynı", async () => {
    for (const [key, want, lines] of [["rejected", "rejected", "120:20000/0 602:0/20000"], ["candidate", "candidate", "120:0/10000 519:10000/0"]]) {
      const id = v249.ids[key];
      assert.equal(linesOf(server.app, id), lines, `ön koşul (${key})`);
      assert.equal((await deleteAndRestore(api, v249.ids.k, id)).status, 200);
      assertState(server.app, id, { isOpening: 0, review: want }, `${key}: silinmeden önceki durum`);
      assert.equal(linesOf(server.app, id), lines, `${key}: karşı hesap aynı`);
    }
    noReviewDrift(server.app);
  });

  it("B8: v2.4.9'da silinmiş 'Açılış…' satırı (yükünde durum yok) güncel kodda geri alınınca ADAY (519)", async () => {
    const item = await trashItem(api, v249.ids.b8);
    assert.ok(item && !Object.hasOwn(payloadOf(server.app, item), "openingReview"), "ön koşul: 2.4.9 yükünde openingReview yok");
    await must("geri al", api.post("/api/admin/trash/restore", { id: item.id }));
    assertState(server.app, v249.ids.b8, { isOpening: 0, review: "candidate" }, "B8: aday");
    assert.equal(linesOf(server.app, v249.ids.b8), "120:5000/0 519:0/5000");
    noReviewDrift(server.app);
  });

  it("kilitli dönem: kilitli aday silinmez (409); kilitten önce silinip sonra kilitlenen satır geri alınmaz (409) — durum değişmez", async () => {
    const locked = await api.del(`/api/workspace/accounts/${v249.ids.k}/entries/${v249.ids.lockedRow}`);
    assert.equal(locked.status, 409, `kilitli satır silinmez: ${JSON.stringify(locked.data).slice(0, 200)}`);
    assertState(server.app, v249.ids.lockedRow, { isOpening: 0, review: "candidate" }, "kilitli aday değişmedi");
    await must("sil (kilitten önce)", api.del(`/api/workspace/accounts/${v249.ids.k}/entries/${v249.ids.laterLocked}`));
    await must("kilidi ilerlet", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-09" }));
    await server.app.ledger.snapshots.runPending();
    const item = await trashItem(api, v249.ids.laterLocked);
    assert.equal(payloadOf(server.app, item).openingReview, "candidate", "yük durumu taşır");
    const refused = await api.post("/api/admin/trash/restore", { id: item.id });
    assert.equal(refused.status, 409, `kilitli tarihe geri alma reddedilir: ${JSON.stringify(refused.data).slice(0, 200)}`);
    assert.equal(stateOf(server.app, v249.ids.laterLocked), null, "satır dönmedi");
    noReviewDrift(server.app);
  });

  // ---------- S51'in kendi örneği: v2.4.5 verisi (açılış silinmiş, cari başka "Açılış bakiyesi" almış) ----------
  it("S51 = A: açılış silinir, cari başka açılış alır, eskisi geri alınır → 'Açılış Olabilir' (aday, 519) — 2.4.5'te silinmiş yük (açıklamadan) ve 2.5.0'da silinmiş yük (işaretten)", { timeout: 180_000 }, async () => {
    const dirs = dirsOf("c5a1e-kg16-245-");
    let current = null;
    try {
      const old = await bootVersion("v2.4.5", { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW });
      let ids;
      try {
        const o = await old.login();
        await o.post("/api/workspace/bank/setup/dismiss", {});
        const s = await must("S", o.post("/api/workspace/accounts", { name: "S51 Müşteri", type: "customer", registeredOn: "2026-10-01", openingBalance: "800" }));
        const first = s.openingEntryId || old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = 'Açılış bakiyesi'", s.id).id;
        assert.equal((await o.del(`/api/workspace/accounts/${s.id}/entries/${first}`)).status, 200, "v2.4.5: ilk açılış silindi");
        await must("ikinci açılış (v2.4.5: açıklamadan açılış)", o.post(`/api/workspace/accounts/${s.id}/entries`, { kind: "debt", amount: "500", date: "2026-10-01", note: "Açılış bakiyesi" }));
        ids = { s: s.id, first, second: old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = 'Açılış bakiyesi'", s.id).id };
      } finally {
        await old.close();
      }
      current = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW, integrityScan: false });
      const c = await current.login();
      assert.equal(stateOf(current.app, ids.second).isOpening, 1, "ön koşul: göç 35 ikinci açılışı işaretledi (cari başına bir)");
      // 2.5.0'da silinen yük işareti taşır; önce 2.4.5'te silinmiş ilk açılış geri alınır (başka açılış yok → açılış olarak döner).
      await must("2.5.0'da ikinci açılışı sil", c.del(`/api/workspace/accounts/${ids.s}/entries/${ids.second}`));
      await must("2.4.5 yükünü geri al", c.post("/api/admin/trash/restore", { id: (await trashItem(c, ids.first)).id }));
      assertState(current.app, ids.first, { isOpening: 1, review: "" }, "başka açılış yokken açılış olarak döner (2.4.6 kuralı)");
      // Şimdi cari başka açılışla (ilki geri geldi): 2.5.0'da silinmiş ikinci açılış geri alınır → S51 = A: aday.
      const item = await trashItem(c, ids.second);
      assert.equal(payloadOf(current.app, item).isOpening, 1, "ön koşul: 2.5.0 yükü işareti taşır");
      assert.equal(payloadOf(current.app, item).openingReview, "", "ön koşul: 2.5.0 yükü durumu taşır ('')");
      await must("2.5.0 yükünü geri al", c.post("/api/admin/trash/restore", { id: item.id }));
      assertState(current.app, ids.second, { isOpening: 0, review: "candidate" }, "S51 = A: cari başka açılışla → Açılış Olabilir (aday)");
      assert.equal(linesOf(current.app, ids.second), "120:50000/0 519:0/50000", "aday onaya kadar 519 (S47)");
      const list = await must("Açılış Olabilir", c.get("/api/workspace/opening-review"));
      assert.ok(list.items.some(row => row.id === ids.second), "satır Açılış Olabilir listesinde");
      noReviewDrift(current.app);
    } finally {
      await current?.close().catch(() => {});
      dirs.cleanup();
    }
  });

  it("2.4.5'te silinmiş açılış yükü (işaret alanı yok, açıklama 'Açılış bakiyesi'), cari başka işaretli açılışla → aday", { timeout: 180_000 }, async () => {
    const dirs = dirsOf("c5a1e-kg16-245b-");
    let current = null;
    try {
      const old = await bootVersion("v2.4.5", { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW });
      let ids;
      try {
        const o = await old.login();
        await o.post("/api/workspace/bank/setup/dismiss", {});
        const s = await must("T", o.post("/api/workspace/accounts", { name: "S51 Üçüncü", type: "customer", registeredOn: "2026-10-01", openingBalance: "900" }));
        const first = s.openingEntryId || old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = 'Açılış bakiyesi'", s.id).id;
        assert.equal((await o.del(`/api/workspace/accounts/${s.id}/entries/${first}`)).status, 200);
        await must("ikinci açılış", o.post(`/api/workspace/accounts/${s.id}/entries`, { kind: "debt", amount: "400", date: "2026-10-01", note: "Açılış bakiyesi" }));
        ids = { s: s.id, first };
      } finally {
        await old.close();
      }
      current = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW, integrityScan: false });
      const c = await current.login();
      const item = await trashItem(c, ids.first);
      const payload = payloadOf(current.app, item);
      assert.ok(!Object.hasOwn(payload, "isOpening") && !Object.hasOwn(payload, "openingReview"), `ön koşul: 2.4.5 yükünde işaret / durum yok: ${JSON.stringify(Object.keys(payload))}`);
      await must("geri al", c.post("/api/admin/trash/restore", { id: item.id }));
      assertState(current.app, ids.first, { isOpening: 0, review: "candidate" }, "S51 = A (2.4.5 yükü): aday");
      assert.equal(linesOf(current.app, ids.first), "120:90000/0 519:0/90000");
      noReviewDrift(current.app);
    } finally {
      await current?.close().catch(() => {});
      dirs.cleanup();
    }
  });
});
