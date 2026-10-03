// GÖÇ testi (2.0.21 güvenilirlik, CLAUDE.md 2.0.21 madde 4). Veri UYDURMA DEĞİL: 2.0.16 → 2.0.17 → 2.0.18 → 2.0.19 → 2.0.20
// zincirinin her sürümü kendi GERÇEK koduyla (git etiketi) çalıştırılıp kendi API'sinden veri girilerek üretildi
// (tools/surum-verisi.mjs --fikstur; tohum 7). Her kesitte GÜNCEL sürüm açılır:
//   - şirket listesi, her şirketin kayıt sayıları/tutarları ve ekrandaki cari listesi eski sürümün gösterdiğiyle bire bir;
//   - hiçbir yedek dosyası silinmez, her eski yedek Yedekler'de yalnız kendi şirketinin altında görünür;
//   - eski sürümün aldığı her yedek kendi şirketine geri yüklenir ve veri yedek anındaki gibi olur; başka şirkete 409;
//   - sonra çalışmaya devam edilir (yeni cari yalnız kendi şirketinde; Tüm Şirketler yedeği kimlikli).
// Ayrıca gerçek v2.0.19'da yaşanan hata (002 → 005, sonra yeni 002: iki şirket aynı veri dosyası) güncel sürümde bulunur
// ve Ayır ile kayıpsız ayrılır.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { readBackupIdentity } from "../server/lib/backup.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { verifyUpgrade } from "./guvenilirlik/dogrula.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { apiFacts, dbFacts, expectedFacts, knownFacts } from "./guvenilirlik/olgular.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { companyDbFile, readRegistry } from "./guvenilirlik/uretici.mjs";

describe("gerçek eski sürüm verisinden güncel sürüme göç", () => {
  for (const version of ["2.0.16", "2.0.17", "2.0.18", "2.0.19", "2.0.20"]) {
    test(`v${version} ile üretilmiş veri (zincir kesiti): hiçbir kayıt ve yedek kaybolmaz, eski yedekler geri yüklenir`, async () => {
      const fixture = unpackFixture(`surum-${version}-zincir`);
      try {
        const report = await verifyUpgrade({ dataDir: fixture.dataDir, backupDir: fixture.backupDir, manifest: fixture.fixture, files: fixture.fixture.files });
        assert.deepEqual(report.failures, [], report.failures.join("\n"));
        assert.ok(report.checks > 20, `denetim sayısı ${report.checks}`);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

describe("çok eski kurulum: v1.3.1 → v2.0.16 → v2.0.19 (eski adlı veri dosyası hukuk-ofisi.sqlite)", () => {
  test("veri dosyası yeniden adlandırılmadan açılır; v1.3.1'in kendi aracıyla aldığı yedek dahil her yedek kendi şirketinde ve geri yüklenir", async () => {
    const fixture = unpackFixture("surum-2.0.19-eski");
    try {
      assert.ok(fixture.fixture.files.some(item => item.path === "veri/hukuk-ofisi.sqlite"), "fikstürde eski adlı veri dosyası");
      assert.ok(fixture.fixture.backups.some(item => item.version === "v1.3.1" && /^hukuk-ofisi-/.test(item.file)), "v1.3.1'in yedeği");
      const report = await verifyUpgrade({ dataDir: fixture.dataDir, backupDir: fixture.backupDir, manifest: fixture.fixture, files: fixture.fixture.files });
      assert.deepEqual(report.failures, [], report.failures.join("\n"));
      assert.ok(existsSync(path.join(fixture.dataDir, "hukuk-ofisi.sqlite")) && !existsSync(path.join(fixture.dataDir, "destekofis.sqlite")), "eski adlı dosya yerinde, yenisi açılmadı");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("gerçek v2.0.19 hatası: kodu değişen şirketin eski koduyla açılan yeni şirket aynı veri dosyasında", () => {
  test("güncel sürüm çakışmayı bildirir; Ayır kayıpsız ayırır; sonra veriler karışmaz", async () => {
    const fixture = unpackFixture("surum-2.0.19-cakisma");
    const manifest = fixture.fixture;
    const resmi = manifest.final.find(item => item.code === "005");
    const gayri = manifest.final.find(item => item.code === "002");
    assert.equal(resmi.dir, gayri.dir, "fikstür gerçekten çakışmalı (eski kod aynı klasörü verdi)");
    let server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir });
    try {
      let api = await server.login();
      const listed = (await api.get("/api/companies")).data;
      assert.equal(listed.conflicts.length, 1, JSON.stringify(listed.conflicts));
      assert.deepEqual(listed.conflicts[0].companies.map(item => item.code).sort(), ["002", "005"]);
      assert.equal(listed.conflicts[0].keeper, resmi.id, "dosyayı ilk açılan (005 · Resmi Şirket) korur");
      // Ayırmadan önce iki şirket de ortak dosyayı gösterir (eski sürümdeki gibi; hiçbir kayıt kaybolmamış).
      for (const company of [resmi, gayri]) {
        await api.post("/api/companies/select", { id: company.id });
        assert.deepEqual(await apiFacts(api), company.api, `${company.code}: ekrandaki veri eski sürümdekiyle aynı`);
      }
      const wrongConfirm = await api.post(`/api/companies/${gayri.id}/separate`, { confirm: "999", password: ADMIN_PASSWORD });
      assert.equal(wrongConfirm.status, 400);
      const separated = await api.post(`/api/companies/${gayri.id}/separate`, { confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(separated.status, 200, JSON.stringify(separated.data));
      assert.deepEqual(separated.data.conflicts, []);
      const safety = path.join(server.app.backups.folderOf(server.app.companies.get(gayri.id)), separated.data.backup);
      assert.equal(readBackupIdentity(safety)?.id, gayri.id, "ayırma öncesi yedek ayrılan şirketin klasöründe, kimliğiyle");
      // Yeniden açılış: çakışma yok, iki şirketin de bütün kayıtları yerinde (ayırma anındaki ortak kayıtlar ikisinde).
      await server.close();
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir });
      api = await server.login();
      assert.deepEqual((await api.get("/api/companies")).data.conflicts, []);
      const registry = readRegistry(fixture.dataDir);
      const fileOf = id => companyDbFile(fixture.dataDir, registry.find(item => item.id === id));
      assert.notEqual(fileOf(resmi.id), fileOf(gayri.id), "artık ayrı veri dosyaları");
      for (const company of [resmi, gayri]) {
        assert.deepEqual(knownFacts(dbFacts(fileOf(company.id)), company.facts), expectedFacts(company.facts), `${company.code}: veri tabanı olguları ayırmadan önceki gibi`);
        await api.post("/api/companies/select", { id: company.id });
        assert.deepEqual(await apiFacts(api), company.api, `${company.code}: ekrandaki cari listesi ayırmadan önceki gibi`);
        assert.equal((await api.post("/api/workspace/accounts", { name: `Ayırma Sonrası ${company.code}`, type: "customer" })).status, 200);
      }
      for (const company of [resmi, gayri]) {
        await api.post("/api/companies/select", { id: company.id });
        const names = (await api.get(`/api/workspace/accounts?status=all&limit=5000&q=${encodeURIComponent("Ayırma Sonrası")}`)).data.accounts.map(item => item.name);
        assert.deepEqual(names, [`Ayırma Sonrası ${company.code}`], `${company.code}: yalnız kendi yeni carisi`);
      }
      // Eski (v2.0.19) yedekler kaybolmadı ve listede yalnız bu iki şirketin altında.
      const listing = (await api.get("/api/admin/backups")).data;
      for (const record of manifest.backups.filter(item => item.companyId !== "sirket-001")) {
        const where = listing.filter(item => item.name === record.file).map(item => item.companyId);
        assert.ok(where.length >= 1 && where.every(id => id === resmi.id || id === gayri.id), `${record.file}: ${JSON.stringify(where)}`);
      }
      await api.post("/api/companies/select", { id: "sirket-001" });
    } finally {
      await server.close();
      fixture.cleanup();
    }
  });
});
