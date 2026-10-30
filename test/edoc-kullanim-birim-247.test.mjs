// 2.4.7 E4/E5 birim: e-Belge kullanım sayacının saf kuralı (lib/einvoice/kullanim.mjs; kullanıcı kararları S1–S5), v37 göçü (şirket izi), kurulum düzeyindeki
// kullanım defteri (lib/einvoice/kullanim-defteri.mjs; S4) ve lisans gövdesindeki usage süzgeci (lib/license.mjs). Uçtan uca: test/edoc-kullanim-247.test.mjs.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { attemptAtOf, usageSinceOf, firstMonth, journalRowsOf, recordUsage, summarizeUsage, usageDecision, usageFromTransitions, usageKindOf, usageTransition, windowMonths } from "../server/lib/einvoice/kullanim.mjs";
import { openUsageLedger } from "../server/lib/einvoice/kullanim-defteri.mjs";
import { createLicenseService } from "../server/lib/license.mjs";
import { LATEST_VERSION, runMigrations } from "../server/lib/migrations.mjs";

const uncertain = { eStatus: "none", eAdapter: "edm" };
const ev = (type, at, payload = {}) => ({ type, at, payload });

test("tür eşlemesi: e-Arşiv / e-SMM / öbür e-Fatura profilleri; kâğıt ve boş sayılmaz", () => {
  assert.equal(usageKindOf("EARSIVFATURA"), "earsiv");
  assert.equal(usageKindOf("ESMM"), "esmm");
  for (const profile of ["TEMELFATURA", "TICARIFATURA", "IHRACAT", "KAMU"]) assert.equal(usageKindOf(profile), "efatura");
  assert.equal(usageKindOf("KAGIT"), "");
  assert.equal(usageKindOf(""), "");
});

test("geçiş sınıfı: gönderim kabulü; belirsizin kesinleşmesi; durum yinelemesi, portal taslağının sonucu, ret ve taslak sayılmaz", () => {
  assert.equal(usageTransition({ action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent" }), "sent");
  assert.equal(usageTransition({ action: "invoice.e.sent", previous: { eStatus: "draft", eAdapter: "edm" }, status: "sent" }), "sent", "taslağın programdan gönderimi");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: uncertain, status: "accepted" }), "confirmed");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: uncertain, status: "rejected" }), "confirmed", "alıcı reddi: EDM belgeyi almıştı");
  assert.equal(usageTransition({ action: "invoice.e.duplicate", previous: uncertain, status: "sent" }), "confirmed");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "sent", eAdapter: "edm" }, status: "accepted" }), "", "durum yinelemesi");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "draft", eAdapter: "edm" }, status: "sent" }), "", "portaldan gönderilen taslak");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "none", eAdapter: "" }, status: "sent" }), "", "izsiz belge (belirsiz değil)");
  // Mutasyon M6 (Hata / Taslak kabul sayılsın) uçtan uca testlerde yakalanmıyordu (o yollarda eylem zaten sayılmaz); burada doğrudan denetlenir.
  for (const status of ["error", "draft", "none", "waiting", "withdrawn"]) {
    for (const action of ["invoice.e.status", "invoice.e.duplicate", "invoice.e.sent"]) {
      if (action === "invoice.e.status" && status === "error") continue; // Y2 / S6 aşağıda
      assert.equal(usageTransition({ action, previous: uncertain, status }), "", `${action} → ${status} sayılmaz`);
    }
  }
  // Y2 / S6 (U13): belirsiz → Durum Sorgula "EDM aldı, reddetti" (Hata) sayılır, ay gönderim izinin ayı; Hata'dan Hata ve izsiz belge sayılmaz.
  assert.equal(usageTransition({ action: "invoice.e.status", previous: uncertain, status: "error" }), "confirmed", "Y2: EDM aldı, reddetti");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "error", eAdapter: "edm" }, status: "error" }), "");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "none", eAdapter: "" }, status: "error" }), "");
  const u13 = [{ type: "invoice.e.sending", at: "2026-10-31T20:00:00.000Z", payload: {} }, { type: "invoice.e.send-failed", at: "2026-10-31T20:00:01.000Z", payload: { status: "none" } }];
  assert.deepEqual(usageDecision({ action: "invoice.e.status", previous: uncertain, status: "error", at: "2026-11-01T09:00:00.000Z", history: u13 }), { count: true, at: "2026-10-31T20:00:00.000Z", reason: "confirmed" });
});

test("gönderim anı (S1): 'EDM'de değil' bilgisinden sonraki İLK gönderim izi; 11048'de yeniden gönderimin kendi izi sayılmaz, 'bulunamadı' kapatmaz", () => {
  assert.equal(attemptAtOf([]), "");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "none", code: "integrator-uncertain" })]), "A");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "none" }), ev("invoice.e.sending", "B")]), "A", "belirsizden sonra yeniden deneme: ilk iz");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "error", code: "integrator-rejected" }), ev("invoice.e.sending", "B")]), "B", "ret izi kapatır");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.status", "A2", { status: "none", missing: true }), ev("invoice.e.sending", "B")]), "B", "bulunamadı izi kapatır");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "waiting", code: "integrator-credentials" }), ev("invoice.e.sending", "B")]), "B", "hiç gitmeyen istek");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.unnumbered", "A2"), ev("invoice.e.sending", "B")]), "B");
  // 11048 (S3): A belirsiz → "bulunamadı" (gecikmeli EDM kaydı) → B yeniden gönderim 11048 → EDM belgeyi A'da almıştı.
  const dup = [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "none" }), ev("invoice.e.status", "A3", { status: "none", missing: true }), ev("invoice.e.sending", "B")];
  assert.equal(attemptAtOf(dup, { duplicate: true }), "A");
  // Y3 (F1): açık "bulunamadı" A'yı kapatır; yalnız 11048'den hemen önceki örtük sorgu yok sayılır → B'nin ayı.
  const y3 = [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A1", { status: "none" }), ev("invoice.e.status", "A2", { status: "none", missing: true }), ev("invoice.e.sending", "B"), ev("invoice.e.send-failed", "B1", { status: "none" }), ev("invoice.e.status", "B2", { status: "none", missing: true }), ev("invoice.e.sending", "C")];
  assert.equal(attemptAtOf(y3, { duplicate: true }), "B", "Y3: açık bulunamadı ilk izi kapatır");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "B")], { duplicate: true }), "", "öncesinde belirsiz yok: yetim 11048");
});

test("karar: doğrudan kabul anında; kesinleşme gönderim izinin anında; izsiz (yetim) ve sayaçtan önceki iz sayılmaz", () => {
  const history = [ev("invoice.e.sending", "2026-06-30T20:59:00.000Z"), ev("invoice.e.send-failed", "2026-06-30T20:59:01.000Z", { status: "none" })];
  assert.deepEqual(usageDecision({ action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent", at: "T" }), { count: true, at: "T", reason: "sent" });
  assert.deepEqual(usageDecision({ action: "invoice.e.status", previous: uncertain, status: "sent", at: "2026-07-01T09:00:00.000Z", history }), { count: true, at: "2026-06-30T20:59:00.000Z", reason: "confirmed" });
  assert.equal(usageDecision({ action: "invoice.e.status", previous: uncertain, status: "sent", at: "x", history: [] }).reason, "orphan");
  assert.equal(usageDecision({ action: "invoice.e.status", previous: uncertain, status: "sent", at: "x", history, since: "2026-07-01T00:00:00.000Z" }).reason, "before-since", "2.4.6'da belirsiz kalmış gönderim");
  assert.equal(usageDecision({ action: "invoice.e.duplicate", previous: uncertain, status: "sent", at: "x", history: [ev("invoice.e.sending", "B")] }).reason, "orphan");
});

test("F2 (kullanıcı kararı): 'Hata'daki belgede sonradan görülen kabul sayılır; ay 'bulunamadı' ile kapanmamış ilk iz; F1 değişmez", () => {
  const error = { eStatus: "error", eAdapter: "edm" };
  // K15 (kullanıcı kararı "a", U40): belirsiz A → "bulunamadı" → ilk yeniden gönderim B reddedildi (Hata) → kabul: "bulunamadı" geçici → A (ilk gönderim).
  const f2 = [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A1", { status: "none", code: "integrator-uncertain" }), ev("invoice.e.status", "A2", { status: "none", missing: true }), ev("invoice.e.sending", "B"), ev("invoice.e.send-failed", "B1", { status: "error", code: "integrator-rejected" })];
  assert.deepEqual(usageDecision({ action: "invoice.e.status", previous: error, status: "sent", at: "C", history: f2 }), { count: true, at: "A", reason: "confirmed-error" });
  // K15 (U43): aynı dizi + yeniden belirsiz C → kabul (belirsizden): ret ve geçici "bulunamadı" kapatmaz → A.
  const u43 = [...f2, ev("invoice.e.sending", "C"), ev("invoice.e.send-failed", "C1", { status: "none", code: "integrator-uncertain" })];
  assert.equal(usageDecision({ action: "invoice.e.status", previous: uncertain, status: "sent", at: "D", history: u43 }).at, "A", "K15: bulunamadı sonrası ret → ilk gönderim");
  // "bulunamadı" sonrası ilk yeniden gönderim belirsizse (ret değil) "bulunamadı" geçerli kalır (F1).
  const f1b = [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A1", { status: "none" }), ev("invoice.e.status", "A2", { status: "none", missing: true }), ev("invoice.e.sending", "B"), ev("invoice.e.send-failed", "B1", { status: "none" }), ev("invoice.e.sending", "C"), ev("invoice.e.send-failed", "C1", { status: "error", code: "integrator-rejected" })];
  assert.equal(usageDecision({ action: "invoice.e.status", previous: error, status: "sent", at: "D", history: f1b }).at, "B");
  // Doğrudan ret → sonradan kabul: ilk iz.
  assert.deepEqual(usageDecision({ action: "invoice.e.status", previous: error, status: "accepted", at: "C", history: [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A1", { status: "error" })] }), { count: true, at: "A", reason: "confirmed-error" });
  // İki ret: ilk açık iz (ret kapatmaz).
  assert.equal(usageDecision({ action: "invoice.e.status", previous: error, status: "sent", at: "C", history: [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A1", { status: "error" }), ev("invoice.e.sending", "B"), ev("invoice.e.send-failed", "B1", { status: "error" })] }).at, "A");
  // Hiç gitmeyen istek izi kapatır; izsiz Hata (yetim) ve sayaçtan önceki iz sayılmaz; Hata'dan Hata sayılmaz.
  assert.equal(usageDecision({ action: "invoice.e.status", previous: error, status: "sent", at: "C", history: [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A1", { status: "error", code: "integrator-credentials" })] }).reason, "orphan");
  assert.equal(usageDecision({ action: "invoice.e.status", previous: error, status: "sent", at: "C", history: [] }).reason, "orphan");
  assert.equal(usageDecision({ action: "invoice.e.status", previous: error, status: "sent", at: "C", history: [ev("invoice.e.sending", "A")], since: "B" }).reason, "before-since");
  assert.equal(usageDecision({ action: "invoice.e.status", previous: error, status: "error", at: "C", history: [ev("invoice.e.sending", "A")] }).count, false);
  // F1: belirsiz A → "bulunamadı" → belirsiz B → kabul: B (ikinci gönderimin ayı).
  const f1 = [ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A1", { status: "none" }), ev("invoice.e.status", "A2", { status: "none", missing: true }), ev("invoice.e.sending", "B"), ev("invoice.e.send-failed", "B1", { status: "none" })];
  assert.equal(usageDecision({ action: "invoice.e.status", previous: uncertain, status: "sent", at: "C", history: f1 }).at, "B");
});

test("pencere (S5): içinde bulunulan ay + önceki 2; yıl dönümü; toplayıcı ay × ortam satırı sıfırlarla", () => {
  assert.deepEqual(windowMonths("2026-07-01"), ["2026-05", "2026-06", "2026-07"]);
  assert.deepEqual(windowMonths("2026-02-15"), ["2025-12", "2026-01", "2026-02"]);
  assert.equal(firstMonth("2026-01-31", 1), "2026-01");
  const rows = [
    { month: "2026-06", env: "test", kind: "earsiv", count: 2 },
    { month: "2026-07", env: "live", kind: "esmm", count: 3 },
    { month: "2026-07", env: "live", kind: "esmm", count: 4 },
    { month: "2026-04", env: "live", kind: "earsiv", count: 9 },
    { month: "2026-07", env: "prod", kind: "earsiv", count: 1 },
    { month: "2026-07", env: "live", kind: "xml", count: 1 },
    { month: "2026-07", env: "live", kind: "earsiv", count: -1 },
  ];
  const filled = summarizeUsage(rows, { months: windowMonths("2026-07-10") });
  assert.equal(filled.length, 6);
  assert.deepEqual(filled.find(row => row.month === "2026-07" && row.env === "live"), { month: "2026-07", env: "live", efatura: 0, earsiv: 0, esmm: 7 });
  assert.deepEqual(filled.find(row => row.month === "2026-06" && row.env === "test"), { month: "2026-06", env: "test", efatura: 0, earsiv: 2, esmm: 0 });
  assert.ok(!filled.some(row => row.month === "2026-04"), "pencere dışı");
  assert.deepEqual(summarizeUsage(rows, { from: "2026-05" }).length, 2, "pencere verilmezse sıfırsız");
});

test("saf uçtan uca işlev (kâhin karşılaştırması): S2 şirket + ETTN + ortam ayrı; ilk yazım kazanır; belirsizin ayı gönderim izinden", () => {
  const history = [ev("invoice.e.sending", "2026-06-30T20:59:00.000Z"), ev("invoice.e.send-failed", "2026-06-30T20:59:01.000Z", { status: "none", code: "integrator-uncertain" })];
  const rows = usageFromTransitions([
    { company: "001", ettn: "E1", env: "test", profile: "EARSIVFATURA", action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent", at: "2026-06-15T09:00:00.000Z" },
    { company: "001", ettn: "e1", env: "test", profile: "EARSIVFATURA", action: "invoice.e.status", previous: uncertain, status: "sent", at: "2026-07-02T09:00:00.000Z", history },
    { company: "002", ettn: "E1", env: "test", profile: "EARSIVFATURA", action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent", at: "2026-07-02T09:00:00.000Z" },
    { company: "001", ettn: "E1", env: "live", profile: "EARSIVFATURA", action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent", at: "2026-07-02T09:00:00.000Z" },
    { company: "001", ettn: "E2", env: "test", profile: "TEMELFATURA", action: "invoice.e.status", previous: uncertain, status: "accepted", at: "2026-07-01T09:00:00.000Z", history },
    { company: "001", ettn: "E3", env: "test", profile: "ESMM", action: "invoice.e.status", previous: { eStatus: "draft", eAdapter: "edm" }, status: "sent", at: "2026-07-01T09:00:00.000Z" },
  ]);
  assert.equal(rows.length, 4);
  assert.deepEqual(summarizeUsage(rows), [
    { month: "2026-06", env: "test", efatura: 1, earsiv: 1, esmm: 0 },
    { month: "2026-07", env: "live", efatura: 0, earsiv: 1, esmm: 0 },
    { month: "2026-07", env: "test", efatura: 0, earsiv: 1, esmm: 0 },
  ]);
});

test("v37 göçü: şirket izi boş kurulur, sayaç başlangıcı yazılır; aynı ETTN + ortam bir kez; UPDATE / DELETE reddedilir", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "edoc-kullanim-"));
  const db = openDatabase(path.join(dir, "veri.sqlite"));
  try {
    const store = createStore(db);
    runMigrations(store, { backupDir: path.join(dir, "yedek"), now: () => new Date("2026-10-27T06:00:00.000Z") });
    assert.equal(store.get("PRAGMA user_version").user_version, LATEST_VERSION);
    assert.ok(LATEST_VERSION >= 37);
    assert.equal(usageSinceOf(store), "2026-10-27T06:00:00.000Z");
    assert.equal(store.setting("edoc.usage.since", ""), "", "ayarlara yazılmaz (eski verinin göçü ayarları değiştirmez)");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM edoc_usage").n, 0, "geriye dönük doldurma yok");
    const ettn = "AAAAAAAA-1111-4222-8333-444444444444";
    assert.ok(recordUsage(store, { ettn, env: "test", profile: "EARSIVFATURA", at: "2026-06-30T12:00:00.000Z" }));
    assert.equal(recordUsage(store, { ettn: ettn.toLowerCase(), env: "test", profile: "EARSIVFATURA", at: "2026-07-01T12:00:00.000Z" }), null, "aynı ETTN ikinci kez");
    assert.ok(recordUsage(store, { ettn, env: "live", profile: "EARSIVFATURA", at: "2026-07-01T12:00:00.000Z" }), "canlı ayrı");
    assert.equal(recordUsage(store, { ettn: "", env: "test", profile: "ESMM", at: "2026-07-01T12:00:00.000Z" }), null);
    assert.equal(recordUsage(store, { ettn: "x", env: "prod", profile: "ESMM", at: "2026-07-01T12:00:00.000Z" }), null);
    assert.equal(recordUsage(store, { ettn: "y", env: "test", profile: "KAGIT", at: "2026-07-01T12:00:00.000Z" }), null);
    assert.equal(journalRowsOf(store).length, 2);
    assert.throws(() => store.run("UPDATE edoc_usage SET month = '2026-01'"), /yalnız eklenir/);
    assert.throws(() => store.run("DELETE FROM edoc_usage"), /yalnız eklenir/);
    // Sayaç başlangıcı ikinci koşuda (geri yüklenen yedekte yeniden göç) değişmez.
    store.run("PRAGMA user_version = 36");
    runMigrations(store, { backupDir: path.join(dir, "yedek"), now: () => new Date("2027-01-01T00:00:00.000Z") });
    assert.equal(usageSinceOf(store), "2026-10-27T06:00:00.000Z");
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("kullanım defteri (S4): şirket + ETTN + ortam bir kez; aktarma yinelense de çift sayım yok; kesinti satırı düşürür, sonraki aktarma tamamlar; yalnız eklenir", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "edoc-defter-"));
  const fault = { on: false };
  const ledger = openUsageLedger({ dir, log: { warn() {} }, fault: () => fault.on });
  try {
    const row = { ettn: "e1", env: "test", kind: "earsiv", month: "2026-07", invoice_id: "i1", source: "invoice.e.sent", created_at: "2026-07-01T00:00:00.000Z" };
    fault.on = true;
    assert.equal(ledger.add("sirket-001", "001", row), false, "kesinti: eklenemedi, hata fırlatmaz");
    fault.on = false;
    assert.equal(ledger.syncFrom("sirket-001", "001", [row]), 1, "aktarma tamamlar");
    assert.equal(ledger.syncFrom("sirket-001", "001", [row, row]), 0, "yineleme eklemez");
    assert.equal(ledger.add("sirket-001", "001", row), false);
    assert.equal(ledger.add("sirket-002", "002", row), true, "S2: başka şirket ayrı");
    assert.equal(ledger.add("sirket-001", "001", { ...row, env: "live" }), true);
    assert.deepEqual(summarizeUsage(ledger.counts({ from: "2026-07" })), [{ month: "2026-07", env: "live", efatura: 0, earsiv: 1, esmm: 0 }, { month: "2026-07", env: "test", efatura: 0, earsiv: 2, esmm: 0 }]);
    assert.deepEqual(summarizeUsage(ledger.counts({ from: "2026-07", companyId: "sirket-002" })), [{ month: "2026-07", env: "test", efatura: 0, earsiv: 1, esmm: 0 }]);
    const raw = openDatabase(ledger.file);
    try {
      assert.throws(() => raw.exec("DELETE FROM usage"), /yalnız eklenir/);
      assert.throws(() => raw.exec("UPDATE usage SET month = '2026-01'"), /yalnız eklenir/);
    } finally {
      raw.close();
    }
  } finally {
    ledger.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lisans gövdesi: usage yalnız izin verilen alanlarla, ay × ortam satırı sıfırlar dahil (S5); ek alan / ETTN / VKN süzülür; sağlayıcı hata verirse alan eklenmez", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "edoc-lisans-"));
  const db = openDatabase(path.join(dir, "veri.sqlite"));
  try {
    const store = createStore(db);
    runMigrations(store, { backupDir: path.join(dir, "yedek") });
    let provider = () => ({
      edoc: [
        { month: "2026-07", env: "live", efatura: 3, earsiv: 2, esmm: 1, ettn: "AAAAAAAA-1111-4222-8333-444444444444", vkn: "1234567890", alici: "Ayşe" },
        { month: "2026-13", env: "live", efatura: 1 },
        { month: "2026-06", env: "x", efatura: 1 },
        { month: "2026-06", env: "test", efatura: -2, earsiv: 1.5, esmm: "4" },
      ],
      extra: { secret: 1 },
    });
    const service = createLicenseService({ store, dataDir: dir, version: "2.4.7", enforce: false, services: ["http://127.0.0.1:9"], fetchImpl: async () => assert.fail("ağa çıkılmaz"), machineId: "0123456789abcdef0123456789abcdef", autoTrial: false, usage: () => provider() });
    assert.deepEqual(service.usageSummary(), { edoc: [{ month: "2026-07", env: "live", efatura: 3, earsiv: 2, esmm: 1 }, { month: "2026-06", env: "test", efatura: 0, earsiv: 0, esmm: 0 }] });
    provider = () => {
      throw new Error("okunamadı");
    };
    assert.equal(service.usageSummary(), null, "sağlayıcı hatası alanı düşürür");
    provider = () => ({ edoc: [] });
    assert.equal(service.usageSummary(), null, "boş özet gönderilmez");
    provider = () => null;
    assert.equal(service.usageSummary(), null);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
