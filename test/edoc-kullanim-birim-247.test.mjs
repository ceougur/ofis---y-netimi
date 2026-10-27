// 2.4.7 E4/E5 birim: e-Belge kullanım sayacının saf kuralı (lib/einvoice/kullanim.mjs), v37 göçü (append-only tablo) ve lisans gövdesindeki usage süzgeci
// (lib/license.mjs). Uçtan uca yol: test/edoc-kullanim-247.test.mjs.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { attemptAtOf, firstMonth, recordUsage, summarizeUsage, usageFromTransitions, usageKindOf, usageRowsOf, usageTransition } from "../server/lib/einvoice/kullanim.mjs";
import { createLicenseService } from "../server/lib/license.mjs";
import { LATEST_VERSION, runMigrations } from "../server/lib/migrations.mjs";

test("tür eşlemesi: e-Arşiv / e-SMM / öbür e-Fatura profilleri; kâğıt ve boş sayılmaz", () => {
  assert.equal(usageKindOf("EARSIVFATURA"), "earsiv");
  assert.equal(usageKindOf("ESMM"), "esmm");
  for (const profile of ["TEMELFATURA", "TICARIFATURA", "IHRACAT", "KAMU"]) assert.equal(usageKindOf(profile), "efatura");
  assert.equal(usageKindOf("KAGIT"), "");
  assert.equal(usageKindOf(""), "");
});

test("geçiş kuralı: gönderim kabulü sayılır; belirsizin kesinleşmesi sayılır; durum yinelemesi, portal taslağının sonucu, ret ve taslak sayılmaz", () => {
  const uncertain = { eStatus: "none", eAdapter: "edm" };
  assert.equal(usageTransition({ action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent" }), "sent");
  assert.equal(usageTransition({ action: "invoice.e.sent", previous: { eStatus: "draft", eAdapter: "edm" }, status: "sent" }), "sent", "taslağın programdan gönderimi");
  assert.equal(usageTransition({ action: "invoice.e.sent", previous: uncertain, status: "processing" }), "sent");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: uncertain, status: "accepted" }), "confirmed");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: uncertain, status: "rejected" }), "confirmed", "alıcı reddi: EDM belgeyi almıştı");
  assert.equal(usageTransition({ action: "invoice.e.duplicate", previous: uncertain, status: "sent" }), "confirmed");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "sent", eAdapter: "edm" }, status: "accepted" }), "", "durum yinelemesi");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "draft", eAdapter: "edm" }, status: "sent" }), "", "portaldan gönderilen taslak");
  assert.equal(usageTransition({ action: "invoice.e.status", previous: { eStatus: "none", eAdapter: "" }, status: "sent" }), "", "izsiz belge (belirsiz değil)");
  assert.equal(usageTransition({ action: "invoice.e.send-failed", previous: uncertain, status: "error" }), "");
  assert.equal(usageTransition({ action: "invoice.e.draft", previous: { eStatus: "waiting" }, status: "draft" }), "");
  assert.equal(usageTransition({ action: "invoice.e.duplicate", previous: uncertain, status: "none" }), "", "11048 doğrulanamadı");
  // Mutasyon M6 (Hata / Taslak kabul sayılsın) uçtan uca testlerde yakalanmadı (o yollarda eylem zaten sayılmaz); burada doğrudan denetlenir.
  for (const status of ["error", "draft", "none", "waiting", "withdrawn"]) {
    for (const action of ["invoice.e.status", "invoice.e.duplicate", "invoice.e.sent"]) assert.equal(usageTransition({ action, previous: uncertain, status }), "", `${action} → ${status} sayılmaz`);
  }
});

test("saf uçtan uca işlev (kâhin karşılaştırması): yazımlar → sayılar; aynı ETTN + ortam ilk yazım; belirsizin ayı gönderim izinden", () => {
  const uncertain = { eStatus: "none", eAdapter: "edm" };
  const history = [{ type: "invoice.e.sending", at: "2026-06-30T20:59:00.000Z" }, { type: "invoice.e.send-failed", at: "2026-06-30T20:59:01.000Z", payload: { status: "none", code: "integrator-uncertain" } }];
  const rows = usageFromTransitions([
    { ettn: "E1", env: "test", profile: "EARSIVFATURA", action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent", at: "2026-06-15T09:00:00.000Z" },
    { ettn: "e1", env: "test", profile: "EARSIVFATURA", action: "invoice.e.status", previous: uncertain, status: "sent", at: "2026-07-02T09:00:00.000Z", history },
    { ettn: "E1", env: "live", profile: "EARSIVFATURA", action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent", at: "2026-07-02T09:00:00.000Z" },
    { ettn: "E2", env: "test", profile: "TEMELFATURA", action: "invoice.e.status", previous: uncertain, status: "accepted", at: "2026-07-01T09:00:00.000Z", history },
    { ettn: "E3", env: "test", profile: "ESMM", action: "invoice.e.status", previous: { eStatus: "draft", eAdapter: "edm" }, status: "sent", at: "2026-07-01T09:00:00.000Z" },
    { ettn: "E4", env: "test", profile: "ESMM", action: "invoice.e.sent", previous: { eStatus: "waiting" }, status: "sent", at: "2026-07-01T09:00:00.000Z" },
  ]);
  assert.deepEqual(rows, [
    { month: "2026-06", env: "test", efatura: 1, earsiv: 1, esmm: 0 },
    { month: "2026-07", env: "live", efatura: 0, earsiv: 1, esmm: 0 },
    { month: "2026-07", env: "test", efatura: 0, earsiv: 0, esmm: 1 },
  ]);
});

test("gönderim anı: 'EDM'de değil' bilgisinden sonraki İLK gönderim izi", () => {
  const ev = (type, at, payload = {}) => ({ type, at, payload });
  assert.equal(attemptAtOf([]), "");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "none", code: "integrator-uncertain" })]), "A");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "none" }), ev("invoice.e.sending", "B")]), "A", "belirsizden sonra yeniden deneme: ilk iz");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "error", code: "integrator-rejected" }), ev("invoice.e.sending", "B")]), "B", "ret izi kapatır");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.status", "A2", { status: "none", missing: true }), ev("invoice.e.sending", "B")]), "B", "bulunamadı izi kapatır");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.e.send-failed", "A2", { status: "waiting", code: "integrator-credentials" }), ev("invoice.e.sending", "B")]), "B", "hiç gitmeyen istek");
  assert.equal(attemptAtOf([ev("invoice.e.sending", "A"), ev("invoice.unnumbered", "A2"), ev("invoice.e.sending", "B")]), "B");
});

test("toplayıcı: ay × ortam; sıfırlar düşer; geçersiz satır yok sayılır; dönem süzgeci; şirket satırları toplanır", () => {
  const rows = [
    { month: "2026-06", env: "test", kind: "earsiv", count: 2 },
    { month: "2026-06", env: "test", kind: "efatura", count: 1 },
    { month: "2026-07", env: "live", kind: "esmm", count: 3 },
    { month: "2026-07", env: "live", kind: "esmm", count: 4 },
    { month: "2026-04", env: "live", kind: "earsiv", count: 9 },
    { month: "2026-07", env: "prod", kind: "earsiv", count: 1 },
    { month: "2026-07", env: "live", kind: "xml", count: 1 },
    { month: "2026-7", env: "live", kind: "earsiv", count: 1 },
    { month: "2026-07", env: "live", kind: "earsiv", count: -1 },
  ];
  assert.deepEqual(summarizeUsage(rows, { from: "2026-05" }), [
    { month: "2026-06", env: "test", efatura: 1, earsiv: 2, esmm: 0 },
    { month: "2026-07", env: "live", efatura: 0, earsiv: 0, esmm: 7 },
  ]);
  assert.equal(firstMonth("2026-07-01", 3), "2026-05");
  assert.equal(firstMonth("2026-02-15", 3), "2025-12", "yıl dönümü");
  assert.equal(firstMonth("2026-01-31", 1), "2026-01");
});

test("v37 göçü: edoc_usage boş kurulur; aynı ETTN + ortam bir kez (ETTN büyük/küçük harf duyarsız); ortamlar ayrı; UPDATE / DELETE reddedilir", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "edoc-kullanim-"));
  const db = openDatabase(path.join(dir, "veri.sqlite"));
  try {
    const store = createStore(db);
    runMigrations(store, { backupDir: path.join(dir, "yedek") });
    assert.equal(store.get("PRAGMA user_version").user_version, LATEST_VERSION);
    assert.ok(LATEST_VERSION >= 37);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM edoc_usage").n, 0, "geriye dönük doldurma yok");
    const ettn = "AAAAAAAA-1111-4222-8333-444444444444";
    assert.equal(recordUsage(store, { ettn, env: "test", profile: "EARSIVFATURA", at: "2026-06-30T12:00:00.000Z" }), true);
    assert.equal(recordUsage(store, { ettn: ettn.toLowerCase(), env: "test", profile: "EARSIVFATURA", at: "2026-07-01T12:00:00.000Z" }), false, "aynı ETTN ikinci kez sayılmaz");
    assert.equal(recordUsage(store, { ettn, env: "live", profile: "EARSIVFATURA", at: "2026-07-01T12:00:00.000Z" }), true, "canlı ayrı");
    assert.equal(recordUsage(store, { ettn: "", env: "test", profile: "ESMM", at: "2026-07-01T12:00:00.000Z" }), false, "ETTN'siz satır yok");
    assert.equal(recordUsage(store, { ettn: "x", env: "prod", profile: "ESMM", at: "2026-07-01T12:00:00.000Z" }), false);
    assert.equal(recordUsage(store, { ettn: "y", env: "test", profile: "KAGIT", at: "2026-07-01T12:00:00.000Z" }), false);
    assert.deepEqual(summarizeUsage(usageRowsOf(store, { from: "2026-01" })), [
      { month: "2026-06", env: "test", efatura: 0, earsiv: 1, esmm: 0 },
      { month: "2026-07", env: "live", efatura: 0, earsiv: 1, esmm: 0 },
    ]);
    assert.throws(() => store.run("UPDATE edoc_usage SET month = '2026-01'"), /yalnız eklenir/);
    assert.throws(() => store.run("DELETE FROM edoc_usage"), /yalnız eklenir/);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM edoc_usage").n, 2);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lisans gövdesi: usage yalnız izin verilen alanlarla gider (ek alan, ETTN, VKN süzülür); sağlayıcı hata verirse alan eklenmez", () => {
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
        { month: "2026-05", env: "test", efatura: 0, earsiv: 7, esmm: 0 },
      ],
      extra: { secret: 1 },
    });
    const service = createLicenseService({ store, dataDir: dir, version: "2.4.7", enforce: false, services: ["http://127.0.0.1:9"], fetchImpl: async () => assert.fail("ağa çıkılmaz"), machineId: "0123456789abcdef0123456789abcdef", autoTrial: false, usage: () => provider() });
    assert.deepEqual(service.usageSummary(), { edoc: [{ month: "2026-07", env: "live", efatura: 3, earsiv: 2, esmm: 1 }, { month: "2026-05", env: "test", efatura: 0, earsiv: 7, esmm: 0 }] });
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
