// 2.1.0 — Aşama 2, Dilim 2: göç zinciri 2.0.16 → … → 2.0.26 → v20 (docs/BANKA-MODULU-PLAN.md §10.5 kabul ölçütü, K11).
//
// Veri UYDURMA DEĞİL: her fikstür o sürümün GERÇEK koduyla (git etiketi) kendi API'sinden girilerek üretildi
// (tools/surum-verisi.mjs --fikstur; 2.0.21–2.0.26 kesitleri --devam v2.0.20 ile aynı kurulumun devamı: 4 şirket, her modülde
// havale/EFT ve POS/kredi kartı satırı, Kasa ↔ Banka, silinip geri yüklenen tahsilat, iade ve iptal, dönem kilidi, 2.0.25'in kabul
// ettiği ileri tarihli çek, yalnız Borç Yaz satırlı cari, özel rol ve kişiye özel yetkiler). "Önce" ölçüsü GERÇEK v2.0.26 koduyla
// alındı (--oncesi): göçten hemen önceki sürümün aynı veride gösterdiği. surum-2.0.26-turler (gözden geçirme B5): zincirde olmayan
// para türleri aynı kurulumun devamında gerçek 2.0.26 koduyla — verilen çek/senet ödemesi, ciro, taksit iadesi, Excel'den taksit
// açılışı (devir), taksit kartına bağlı çek, nakit/havale peşin stok alış ve satışı.
//
// ÇALIŞIYOR MU (her fikstürde, her şirkette; güncel kod göç 20'yi uygular):
//  - kapı imzası (Mutabakat Testi sapmaları: kod, fark, sayı, kapının saydığı, eski satır) birebir aynı; 2.0.26'da tamam olan her
//    denetim yine tamam, yeni denetimler tamam;
//  - mizan (her hesap, kuruş) ve defter mutabakatı aynı; Kasa penceresi satırları ve toplamları, tüm yollar, ANLIK DURUM, cari
//    bakiyeleri, faturaların ödeme durumu ve beş rapor (Kasa Hareketleri, Banka ve POS Hareketleri, Hesap Planı Mizanı, Cari
//    Listesi, Açık Faturalar) aynı;
//  - kilit izi (kilit tarihinde ve bütün tarihler için) aynı; mutabakat günlüğüne 2.0.26'nın yazdığından fazla taban kaydı
//    yazılmaz, geri alınan işlem yok; her şirket dosyası v20'de.
// NASIL BOZARIM: göç bir satıra dokunursa (ör. eski satıra varsayılan hesap atamak, 649'un tutarını değiştirmek), yeni bir denetim
// eski veride sapma bulursa ya da kilitli dönemin bir satırı kayarsa bu test kırılır. (SIGKILL ve satır satır karşılaştırma:
// banka-210-goc.test.mjs.)
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fileFacts, ledgerFacts } from "./guvenilirlik/defter-olgulari.mjs";
import { verifyUpgrade } from "./guvenilirlik/dogrula.mjs";
import { fixtureExists, readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { companyDbFile, readRegistry } from "./guvenilirlik/uretici.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = ["2.0.16", "2.0.17", "2.0.18", "2.0.19", "2.0.20", "2.0.21", "2.0.22", "2.0.23", "2.0.24", "2.0.25", "2.0.26"].map(version => `surum-${version}-zincir`).concat(["surum-2.0.19-cakisma", "surum-2.0.19-eski", "surum-2.0.26-turler"]);

describe("göç zinciri → v20: para defteri 2.0.26'nın gösterdiğiyle birebir (K11)", () => {
  for (const name of FIXTURES) {
    it(name, async () => {
      assert.ok(fixtureExists(name), `${name} fikstürü yok`);
      const before = readFixture(name).oncesi;
      assert.ok(before?.companies, `${name}: v2.0.26 ölçüsü (oncesi) yok — tools/surum-verisi.mjs --oncesi`);
      const fixture = unpackFixture(name);
      try {
        // Güncel kod, ölçünün alındığı günde (sahte saat): "bugün"e bağlı denetimler (ileri tarih) ve raporlar aynı günü görür.
        const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${before.today}T12:00:00+03:00` });
        const after = {};
        try {
          assert.equal(server.app.store.get("PRAGMA user_version").user_version, 20, "güncel kod v20 göçünü uygulamalı");
          const api = await server.login();
          for (const [id, expected] of Object.entries(before.companies)) {
            assert.equal((await api.post("/api/companies/select", { id })).status, 200, `${expected.code} seçilemedi`);
            after[id] = await ledgerFacts(api);
          }
          await api.post("/api/companies/select", { id: "sirket-001" });
        } finally {
          await server.close();
        }
        const { lockDigestOf } = await import(pathToFileURL(path.join(ROOT, "server/lib/integrity.mjs")).href);
        assert.equal(typeof lockDigestOf, "function", "integrity.lockDigestOf yok");
        const registry = readRegistry(fixture.dataDir) || [{ id: "sirket-001", dir: "" }];
        for (const [id, expected] of Object.entries(before.companies)) {
          const got = after[id];
          const label = `${name} ${expected.code} · ${expected.name}`;
          assert.deepEqual(got.integrity, expected.integrity, `${label}: kapı imzası (Mutabakat Testi sapmaları) farklı`);
          assert.deepEqual(expected.checksOk.filter(code => !got.checksOk.includes(code)), [], `${label}: 2.0.26'da tamam olan denetim artık tamam değil`);
          assert.deepEqual(got.trial, expected.trial, `${label}: mizan farklı`);
          assert.deepEqual(got.trialTotals, expected.trialTotals, `${label}: mizan toplamı farklı`);
          assert.deepEqual(got.reconciliation, expected.reconciliation, `${label}: defter mutabakatı farklı`);
          assert.equal(got.lockedUntil, expected.lockedUntil, `${label}: dönem kilidi`);
          assert.deepEqual(got.cash, expected.cash, `${label}: Kasa (pencere / tüm yollar) farklı`);
          assert.deepEqual(got.overviewCash, expected.overviewCash, `${label}: ANLIK DURUM Kasa/Banka kutusu farklı`);
          // Aşama 14 (K10, plan §10.5 kabul): göçten sonra Banka kutusu Gerçek Banka'dır (eski veride hesap yok: "—", 0); Gerçek Banka + Hesabı
          // Atanmamış Eski Hareketler = 2.0.26'daki "Banka / POS" (tüm hareketler).
          assert.ok(got.bankK10, `${label}: ANLIK DURUM'da K10 alanları yok`);
          assert.equal(got.bankK10.defined, false, `${label}: eski veride banka hesabı tanımlı değil`);
          assert.equal(got.bankK10.realBank + got.bankK10.unassigned, Math.round(Number(expected.overviewCash.bank.allEntries || 0) * 100), `${label}: Gerçek Banka + Hesabı Atanmamış = eski Banka / POS`);
          assert.equal(got.overview, expected.overview, `${label}: ANLIK DURUM farklı`);
          assert.deepEqual(got.accounts, expected.accounts, `${label}: cari bakiyeleri farklı`);
          assert.equal(got.invoiceCount, expected.invoiceCount, `${label}: fatura sayısı`);
          assert.equal(got.invoices, expected.invoices, `${label}: faturaların ödeme durumu farklı`);
          assert.deepEqual(got.reports, expected.reports, `${label}: raporlar farklı`);
          const dbFile = companyDbFile(fixture.dataDir, registry.find(entry => entry.id === id) || { id, dir: "" });
          const file = fileFacts(dbFile, lockDigestOf);
          assert.equal(file.version, 20, `${label}: veri dosyası v20'de değil`);
          assert.equal(file.lockAll, expected.file.lockAll, `${label}: kilit izi (bütün tarihler) değişti`);
          assert.equal(file.lockAt, expected.file.lockAt, `${label}: kilit izi (kilit tarihi) değişti`);
          assert.equal(file.baselines, expected.file.baselines, `${label}: mutabakat günlüğüne yeni taban kaydı yazıldı`);
          assert.equal(file.rolledBack, expected.file.rolledBack, `${label}: açılışta geri alınan işlem`);
        }
      } finally {
        fixture.cleanup();
      }
    });
  }
});

describe("2.0.21–2.0.26 kesitleri v20 koduyla: hiçbir kayıt ve yedek kaybolmaz, eski yedekler kendi şirketine geri yüklenir", () => {
  // guvenilirlik-221-goc ile aynı denetim (dogrula.mjs): şirket listesi, veri tabanı olguları, ekrandaki cari listesi, her eski yedek
  // kendi şirketinin altında ve geri yüklenince (göçü v20'ye kadar çalışarak) yedek anındaki veri; başka şirkete 409; sonra çalışma.
  for (const name of ["surum-2.0.21-zincir", "surum-2.0.26-zincir", "surum-2.0.26-turler"]) {
    it(name, async () => {
      const fixture = unpackFixture(name);
      try {
        const report = await verifyUpgrade({ dataDir: fixture.dataDir, backupDir: fixture.backupDir, manifest: fixture.fixture, files: fixture.fixture.files });
        assert.deepEqual(report.failures, [], report.failures.join("\n"));
        assert.ok(report.checks > 40, `denetim sayısı ${report.checks}`);
      } finally {
        fixture.cleanup();
      }
    });
  }
});
