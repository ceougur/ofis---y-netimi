// 2.5.0 Ç5-A tur 2e — Açılış Olabilir Kayıtlar: KİLİTLİ dönemdeki adayın kararı yalnız yöneticide (dar kontrol c5a2 DÜŞÜK-4; BAŞ MİMAR KARARI 14.11 05:31 (c), AYNEN: "KİLİTLİ dönemdeki
// adayın kararı ve geri alınması yalnız yöneticinin yetkisiyle (dönem kilidi ve ekran zaten yalnız yöneticide; kilitli dönemin farkını değiştiren karar da öyle olmalı); açık dönemdeki
// adayın kararı bugünkü yetkide kalır."; görev metni: toplu kararda seçimde yetkisiz kilitli kayıt varsa işlem BÜTÜN reddedilir, ileti hangi kayıtların yöneticiye kaldığını söyler; liste
// / sayı uçlarının okuma yetkisi değişmez). Tablo: rol × uç × (kilitli / açık); kilit günü sınırı; kilit SONRADAN ilerleyip kararı kapsarsa geri alma kimde.
// Önceden (c5a2e-taban): Muhasebe / Avukat kilitli adaya API'den karar veriyordu (200). Veri: v2.4.9'un GERÇEK koduyla API'den → göç 48 adayları kurar (ders 17, 23). Sahte saat (ders 13);
// iki TZ'de koşulur; lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const LOCK = "2026-10-05";
const URL = "/api/workspace/opening-review";
const SKIP = !tagsAvailable(["v2.4.9"]) ? "v2.4.9 etiketi yok" : false;
const PASSWORD = "Yetki-2026-Deneme!";
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const codeOf = res => res.data?.code ?? res.data?.error?.code;
const messageOf = res => (typeof res.data?.error === "string" ? res.data.error : res.data?.error?.message ?? res.data?.message ?? "");

describe("Ç5-A tur 2e DÜŞÜK-4 — kilitli dönemdeki adayın kararı yalnız yöneticide", { skip: SKIP }, () => {
  let dirs = null;
  let server = null;
  const ids = {};
  const users = {};
  const review = id => server.app.store.get("SELECT opening_review AS r FROM account_entries WHERE id = ?", id).r;
  before(async () => {
    const root = mkdtempSync(path.join(tmpdir(), "c5a2e-yetki-"));
    dirs = { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion("v2.4.9", { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW });
    try {
      const o = await old.login();
      await o.post("/api/workspace/bank/setup/dismiss", {});
      const party = await must("cari", o.post("/api/workspace/accounts", { name: "Yetki Müşteri", type: "customer", registeredOn: "2026-09-01" }));
      const add = async (note, amount, date) => {
        await must(note, o.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "debt", amount, date, note }));
        return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ? AND date = ?", party.id, note, date).id;
      };
      Object.assign(ids, {
        locked: await add("Açılış bakiyesi", "700", "2026-10-02"),
        lockDay: await add("Açılış devri", "50", LOCK),
        open1: await add("Açılış farkı", "300", "2026-10-12"),
        open2: await add("Açılış eki", "200", "2026-10-13"),
        open3: await add("Açılış kalanı", "100", "2026-10-14"),
      });
      await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
    users.admin = await server.login();
    for (const role of ["avukat", "muhasebe", "personel"]) {
      await must(`${role} oluştur`, users.admin.post("/api/admin/users", { username: `y-${role}`, name: `Y ${role}`, role, password: PASSWORD, mustChangePassword: false }));
      users[role] = await server.login(`y-${role}`, PASSWORD);
    }
    for (const key of Object.keys(ids)) assert.equal(review(ids[key]), "candidate", `ön koşul: göç 48 ${key} satırını aday yaptı`);
  });
  after(async () => {
    await server?.close?.().catch(() => {});
    if (dirs) rmSync(dirs.root, { recursive: true, force: true });
  });

  it("rol × uç × kilitli / açık: Avukat ve Muhasebe kilitli adaya (kilit günü dahil) tek karar ve geri alma 403, açık adaya 200; personel her uçta 403; okuma uçları değişmez", async () => {
    for (const role of ["avukat", "muhasebe"]) {
      const api = users[role];
      assert.equal((await api.get(`${URL}?limit=10`)).status, 200, `${role}: liste`);
      assert.equal((await api.get(`${URL}?counts=1`)).status, 200, `${role}: sayı`);
      assert.equal((await api.get(URL)).status, 200, `${role}: sayfasız liste`);
      for (const [key, label] of [["locked", "kilitli (02.10)"], ["lockDay", "kilit günü (05.10)"]]) {
        for (const decision of ["confirm", "reject", "undo"]) {
          const res = await api.post(`${URL}/${ids[key]}`, { decision });
          assert.equal(res.status, 403, `${role} ${label} ${decision}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
          assert.equal(codeOf(res), "opening-review-locked");
          assert.equal(messageOf(res), "Bu kayıt kilitli dönemde (05.10.2026 ve öncesi); kararı yalnız yönetici verebilir ya da geri alabilir.");
          assert.equal(review(ids[key]), "candidate", `${role} ${label} ${decision}: satır değişmedi`);
        }
      }
    }
    const staff = users.personel;
    for (const [label, call] of [["liste", staff.get(`${URL}?limit=10`)], ["sayı", staff.get(`${URL}?counts=1`)], ["tek kilitli", staff.post(`${URL}/${ids.locked}`, { decision: "confirm" })], ["tek açık", staff.post(`${URL}/${ids.open1}`, { decision: "confirm" })], ["toplu", staff.post(URL, { ids: [ids.open1], decision: "confirm" })]]) {
      assert.equal((await call).status, 403, `personel ${label}`);
    }
    // Açık dönemdeki aday bugünkü yetkide (accounts.manage): Muhasebe onaylar, Avukat geri alır.
    assert.equal((await must("muhasebe açık onay", users.muhasebe.post(`${URL}/${ids.open1}`, { decision: "confirm" }))).item.review, "confirmed");
    assert.equal((await must("avukat açık geri al", users.avukat.post(`${URL}/${ids.open1}`, { decision: "undo" }))).item.review, "candidate");
  });

  it("toplu: seçimde kilitli kayıt varsa İŞLEM BÜTÜN reddedilir (açık kayıt da yazılmaz), ileti yöneticiye kalan kayıtları sayar; yalnız açık kayıtlar 200; yönetici kilitliyi toplu karara alır", async () => {
    const mixed = await users.muhasebe.post(URL, { ids: [ids.open2, ids.locked, ids.open3, ids.lockDay], decision: "reject" });
    assert.equal(mixed.status, 403, JSON.stringify(mixed.data).slice(0, 300));
    assert.equal(codeOf(mixed), "opening-review-locked");
    const text = messageOf(mixed);
    assert.match(text, /^Seçilen kayıtlardan 2 tanesi kilitli dönemde \(05\.10\.2026 ve öncesi\);/);
    assert.match(text, /Hiçbir karar kaydedilmedi\./);
    assert.match(text, /Yöneticiye kalan kayıtlar: 02\.10\.2026 Yetki Müşteri 700,00 TL; 05\.10\.2026 Yetki Müşteri 50,00 TL\.$/);
    assert.deepEqual([ids.open2, ids.locked, ids.open3, ids.lockDay].map(review), ["candidate", "candidate", "candidate", "candidate"], "yarım karar yok");
    const opened = await must("muhasebe toplu açık", users.muhasebe.post(URL, { ids: [ids.open2, ids.open3], decision: "reject" }));
    assert.equal(opened.changed, 2);
    const admin = await must("yönetici toplu (kilitli + açık)", users.admin.post(URL, { ids: [ids.locked, ids.lockDay, ids.open2], decision: "confirm" }));
    assert.equal(admin.changed, 3);
    assert.deepEqual([ids.locked, ids.lockDay, ids.open2].map(review), ["confirmed", "confirmed", "confirmed"]);
    // Yöneticinin kilitli kararını Muhasebe geri alamaz (Mutabakat'taki 'Düzeltildi' durumu onun elinde değil).
    const undo = await users.muhasebe.post(`${URL}/${ids.locked}`, { decision: "undo" });
    assert.equal(undo.status, 403);
    assert.equal(review(ids.locked), "confirmed");
    const audit = server.app.store.all("SELECT actor_name AS who, COUNT(*) AS n FROM audit_events WHERE type LIKE 'account.opening.%' AND entity_id IN (?, ?) GROUP BY actor_name ORDER BY actor_name", ids.locked, ids.lockDay);
    assert.equal(audit.length, 1, `kilitli satırların izinde yalnız yönetici: ${JSON.stringify(audit)}`);
  });

  it("kilit SONRADAN ilerleyip kararı kapsarsa geri alma yöneticide; kilit kaldırılınca bugünkü yetki geri gelir", async () => {
    await must("muhasebe açık onay", users.muhasebe.post(`${URL}/${ids.open1}`, { decision: "confirm" }));
    await must("kilit 15.10", users.admin.put("/api/admin/period-lock", { lockedUntil: "2026-10-15" }));
    await server.app.ledger.snapshots.runPending();
    const late = await users.muhasebe.post(`${URL}/${ids.open1}`, { decision: "undo" });
    assert.equal(late.status, 403, "karar artık kilitli dönemde");
    assert.match(messageOf(late), /15\.10\.2026 ve öncesi/);
    assert.equal(review(ids.open1), "confirmed");
    assert.equal((await must("yönetici geri al", users.admin.post(`${URL}/${ids.open1}`, { decision: "undo" }))).item.review, "candidate");
    await must("kilit yok", users.admin.put("/api/admin/period-lock", { lockedUntil: "" }));
    await server.app.ledger.snapshots.runPending();
    assert.equal((await must("muhasebe (kilitsiz)", users.muhasebe.post(`${URL}/${ids.locked}`, { decision: "undo" }))).item.review, "candidate", "kilit yokken bugünkü yetki");
  });
});
