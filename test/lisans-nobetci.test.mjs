// Lisans nöbetçisi (tools/lisans-nobetci.mjs; 2.4.4 E9, ders 30): Windows kurulum işinde (.github/workflows/windows.yml) gerçek kurulu programın
// lisans servisine ULAŞMADIĞINI kanıtlayan denetim. Burada aracın kendisi sınanır: hosts satırları, çözümleme hükmü, lisans özeti hükmü,
// günlük taraması ve GERÇEK programa karşı uçtan uca (servis ölü adreste → TAMAM; servise ulaşılınca → BAŞARISIZ, nöbetçinin dişi).
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { DEFAULT_LICENSE_SERVICES } from "../server/lib/license.mjs";
import { createReferenceLicenseService } from "../tools/lib/license-service.mjs";
import { checkInstalledProgram, hostsLines, judgeLicenseSummary, licenseHostnames, MARKER, scanLogs, verifyBlocked, writeHostsBlock } from "../tools/lisans-nobetci.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const work = mkdtempSync(path.join(tmpdir(), "lisans-nobetci-"));
after(() => rmSync(work, { recursive: true, force: true }));

describe("lisans nöbetçisi — engel", () => {
  it("adlar programın varsayılan servis listesinden türetilir (elle liste kaymaz)", () => {
    assert.deepEqual(licenseHostnames(), DEFAULT_LICENSE_SERVICES.map(url => new URL(url).hostname));
    assert.ok(licenseHostnames().length >= 1);
    assert.deepEqual(licenseHostnames(["https://a.example/x", "https://a.example/y", "https://b.example"]), ["a.example", "b.example"]);
  });

  it("hosts dosyasına IPv4 + IPv6 yerel satırları bir kez eklenir; sonu satırsız dosya bozulmaz", () => {
    const file = path.join(work, "hosts");
    writeFileSync(file, "# özgün\r\n10.0.0.1 baska.example");
    const names = ["lisans.example"];
    assert.deepEqual(writeHostsBlock(file, names), hostsLines(names));
    assert.deepEqual(writeHostsBlock(file, names), [], "ikinci kez eklenmez");
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    assert.deepEqual(lines, ["# özgün", "10.0.0.1 baska.example", MARKER, "127.0.0.1 lisans.example", "::1 lisans.example", ""]);
  });

  it("çözümleme hükmü: yalnız yerel adres TAMAM; dış adres ya da çözülemeyen ad HATA", async () => {
    const fake = map => async name => {
      if (!map[name]) throw Object.assign(new Error("yok"), { code: "ENOTFOUND" });
      return map[name].map(address => ({ address }));
    };
    const ok = await verifyBlocked(["a"], fake({ a: ["127.0.0.1", "::1"] }));
    assert.equal(ok[0].ok, true);
    const leak = await verifyBlocked(["a"], fake({ a: ["127.0.0.1", "76.76.21.21"] }));
    assert.equal(leak[0].ok, false);
    assert.match(leak[0].reason, /76\.76\.21\.21/);
    const missing = await verifyBlocked(["a"], fake({}));
    assert.equal(missing[0].ok, false, "çözülemeyen ad engelin tuttuğunu kanıtlamaz");
  });
});

describe("lisans nöbetçisi — lisans özeti hükmü", () => {
  const base = { state: "none", enforced: true, licenseId: null, autoTrial: { attempts: 1, lastError: "Lisans servisine ulaşılamadı (ECONNREFUSED).", lastAt: "x" } };
  it("deneme yapıldı ve ağ hatasıyla düştü → TAMAM", () => {
    assert.equal(judgeLicenseSummary(base).verdict, "ok");
    for (const lastError of ["İnternet bağlantısı yok veya lisans servisinin adı çözülemedi.", "Lisans servisi zamanında yanıt vermedi.", "Güvenli bağlantı doğrulanamadı (antivirüs/güvenlik duvarı SSL denetimi yapıyor olabilir)."]) {
      assert.equal(judgeLicenseSummary({ ...base, autoTrial: { ...base.autoTrial, lastError } }).verdict, "ok", lastError);
    }
  });
  it("deneme henüz yapılmadı → BEKLE", () => {
    assert.equal(judgeLicenseSummary({ ...base, autoTrial: { attempts: 0, lastError: null } }).verdict, "pending");
  });
  it("servise ulaşıldı (deneme/lisans, beklenmeyen yanıt, belirteç) ya da uygulama kapalı → BAŞARISIZ", () => {
    for (const data of [
      { ...base, state: "trial", autoTrial: null },
      { ...base, state: "licensed", licenseId: "LIS-1", autoTrial: null },
      { ...base, autoTrial: null },
      { ...base, licenseId: "LIS-1" },
      { ...base, enforced: false },
      { ...base, autoTrial: { attempts: 1, lastError: "Lisans servisi beklenmeyen bir yanıt verdi." } },
      null,
    ]) assert.equal(judgeLicenseSummary(data).verdict, "fail", JSON.stringify(data));
  });
});

describe("lisans nöbetçisi — günlük", () => {
  const dir = name => {
    const full = path.join(work, name);
    mkdirSync(full, { recursive: true });
    return full;
  };
  it("engellenen deneme satırı var, ulaşan yok → TAMAM (alt klasör ve döndürülmüş dosya dahil)", () => {
    const logs = dir("gunluk-tamam");
    mkdirSync(path.join(logs, "eski"), { recursive: true });
    writeFileSync(path.join(logs, "servis.log"), "2026-10-22T00:00:00.000Z [INFO] [uygulama] Sunucu hazır\n");
    writeFileSync(path.join(logs, "eski", "servis-20261022T000000.log"), "2026-10-22T00:00:03.000Z [WARN] [uygulama] Ücretsiz deneme başlatılamadı: Lisans servisine ulaşılamadı (ECONNREFUSED).\r\n");
    const result = scanLogs([logs]);
    assert.equal(result.verdict, "ok", result.reason);
    assert.equal(result.blocked.length, 1);
  });
  it("servise ulaşan satır (deneme başladı / durum → trial) → BAŞARISIZ; Türkçe harfi bozulmuş satır da yakalanır", () => {
    for (const line of [
      "2026-10-22T00:00:03.000Z [INFO] [uygulama] Ücretsiz deneme kendiliğinden başladı.",
      "2026-10-22T00:00:03.000Z [INFO] [uygulama] Lisans durumu: none → trial",
      "2026-10-22T00:00:03.000Z [INFO] [uygulama] Lisans durumu: none â†’ licensed",
      "2026-10-22T00:00:03.000Z [INFO] [uygulama] Ãœcretsiz deneme kendiliÄŸinden baÅŸladÄ±.",
    ]) {
      const logs = dir(`gunluk-ulasti-${Math.random().toString(36).slice(2)}`);
      writeFileSync(path.join(logs, "servis.log"), `x [WARN] Ücretsiz deneme başlatılamadı: Lisans servisine ulaşılamadı (ECONNREFUSED).\n${line}\n`);
      assert.equal(scanLogs([logs]).verdict, "fail", line);
    }
  });
  it("günlük okunamazsa ya da engellenen deneme satırı yoksa sonuç bilinmiyor → BAŞARISIZ (ders 4)", () => {
    assert.equal(scanLogs([]).verdict, "fail");
    assert.equal(scanLogs([path.join(work, "olmayan-klasor")]).verdict, "fail");
    const empty = dir("gunluk-bos");
    assert.equal(scanLogs([empty]).verdict, "fail");
    writeFileSync(path.join(empty, "servis.log"), "x [INFO] Sunucu hazır\n");
    assert.equal(scanLogs([empty]).verdict, "fail");
  });
});

describe("lisans nöbetçisi — gerçek programa karşı (aynı süreç, lisans uygulaması AÇIK, kendiliğinden deneme AÇIK)", () => {
  const MACHINE = "9a8b7c6d5e4f30211203f4e5d6c7b8a9";
  it("lisans servisi ölü adreste: deneme ağ hatasıyla düşer → nöbetçi TAMAM", async () => {
    const server = await startTestServer({ startLicenseTimers: true, license: { enforce: true, services: ["http://127.0.0.1:9/api/lisans"], machineId: MACHINE, autoTrialDelaysMs: [20], retryMs: 3_600_000, firstCheckDelayMs: 3_600_000 } });
    try {
      const result = await checkInstalledProgram({ base: server.base, username: "admin", password: ADMIN_PASSWORD, timeoutMs: 10_000, intervalMs: 50 });
      assert.equal(result.verdict, "ok", result.reason);
      assert.equal(result.summary.state, "none");
      assert.match(result.summary.autoTrial.lastError, /Lisans servisine ulaşılamadı/);
    } finally {
      await server.close();
    }
  });

  it("DİŞ: program lisans servisine ulaşırsa (deneme başlar) → nöbetçi BAŞARISIZ", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const reference = createReferenceLicenseService({ privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }), keyId: "nobetci-test" });
    const trustedKeys = { "nobetci-test": publicKey.export({ format: "der", type: "spki" }).toString("base64") };
    let reached = 0;
    const fetchImpl = (...args) => {
      reached++;
      return reference.fetch(...args);
    };
    const server = await startTestServer({ startLicenseTimers: true, license: { enforce: true, trustedKeys, services: ["https://lisans.test/api/lisans"], fetchImpl, machineId: MACHINE, autoTrialDelaysMs: [20], retryMs: 3_600_000, firstCheckDelayMs: 3_600_000 } });
    try {
      const result = await checkInstalledProgram({ base: server.base, username: "admin", password: ADMIN_PASSWORD, timeoutMs: 10_000, intervalMs: 50 });
      assert.ok(reached >= 1, "sahte servise istek gitmeliydi");
      assert.equal(result.verdict, "fail", result.reason);
      assert.match(result.reason, /ULAŞTI/);
      assert.equal(result.summary.state, "trial");
    } finally {
      await server.close();
    }
  });

  it("yönetici girişi reddedilirse sonuç başarı sayılmaz (ders 3)", async () => {
    const server = await startTestServer({ license: { enforce: true, services: ["http://127.0.0.1:9/api/lisans"], machineId: MACHINE } });
    try {
      const result = await checkInstalledProgram({ base: server.base, username: "admin", password: "yanlis-parola", timeoutMs: 1_000, intervalMs: 50 });
      assert.equal(result.verdict, "fail");
      assert.match(result.reason, /yönetici girişi/);
    } finally {
      await server.close();
    }
  });
});
