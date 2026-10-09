// 2.1.0 — Aşama 2, bağımsız gözden geçirme D4: eski sürüme dönüşte "Tüm Hareketleri Sil" + yeni yazım (docs/2.1.0-KANIT.md "Aşama 2 —
// Bağımsız Gözden Geçirme").
//
// Kök neden: eski sürümün (2.0.25/2.0.26) yazdığı olaysız para satırı yalnız rowid işaretiyle (v20'den sonraki ilk açılışta her tablonun en
// büyük rowid'i) ayrılıyordu. Eski sürüm tabloyu boşaltıp yeniden yazınca rowid baştan başlar: yeni satırlar işaretin ALTINDA kalır ve
// "Hesabı Belirsiz Yeni Hareketler" / Mutabakat Testi'nde görünmezdi. Düzeltme: işaretin zamanı da tutulur (eski satırların en yenisinin
// oluşturulma anı); olaysız para satırı işaretin üstündeyse YA DA bu zamandan sonra oluşturulmuşsa eski sürümün yazdığıdır.
//
// NASIL BOZARIM (gerçek 2.0.26 koduyla): güncel kod 002'ye 3 olaylı Kasa girişi yazar → 2.0.26 aynı dosyada 002'yi "Tüm Hareketleri Sil"
// ile boşaltır ve 2 Kasa girişi yazar → güncel kod açılınca açılış onarımı 2 "Hesabı Belirsiz Yeni Hareket" bulur, Mutabakat Testi'nde
// uyarı olarak görünür; eski (güncelleme öncesi) satırlar yeni sayılmaz.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";

const SECOND = "sirket-0cf39851-d4f7-421d-8c52-ce6e72a12e2b";

describe("D4 — eski sürüm boşaltıp yeniden yazınca olaysız satırlar görünür", { skip: !tagsAvailable(["v2.0.26"]) && "v2.0.26 etiketi yok (git fetch --tags)" }, () => {
  it("2.0.26 'Tüm Hareketleri Sil' + 2 Kasa girişi → açılış onarımı 2 satır bulur; eski satırlar sayılmaz", async () => {
    const fixture = unpackFixture("surum-2.0.26-zincir");
    let server = null;
    try {
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, moneyStrict: false, gateVerify: false });
      let api = await server.login();
      assert.equal((await api.post("/api/companies/select", { id: SECOND })).status, 200);
      for (let i = 0; i < 3; i += 1) assert.equal((await api.post("/api/workspace/cash", { kind: "in", amount: "10", description: `güncel ${i}` })).status, 200);
      await server.close();
      server = null;

      server = await bootVersion("v2.0.26", { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10 });
      api = await server.login();
      assert.equal((await api.post("/api/companies/select", { id: SECOND })).status, 200);
      assert.equal((await api.post(`/api/companies/${SECOND}/reset`, { mode: "movements", confirm: "002", password: ADMIN_PASSWORD })).status, 200);
      for (let i = 0; i < 2; i += 1) assert.equal((await api.post("/api/workspace/cash", { kind: "in", amount: "7", description: `eski sürüm ${i}` })).status, 200);
      await server.close();
      server = null;

      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, moneyStrict: false, gateVerify: false });
      api = await server.login();
      assert.equal((await api.post("/api/companies/select", { id: SECOND })).status, 200);
      const integrity = (await api.get("/api/workspace/ledger/integrity")).data;
      const eventless = integrity.failures.find(item => item.code === "money:event");
      assert.ok(eventless, `money:event görünmeli: ${JSON.stringify(integrity.failures)}`);
      assert.equal(eventless.count, 2, JSON.stringify(eventless));
      assert.equal(eventless.severity, "warning", "eski sürümün satırları uyarı (iş durmaz)");
      const db = new DatabaseSync(path.join(fixture.dataDir, "sirketler", "002", "destekofis.sqlite"), { readOnly: true });
      try {
        const repair = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'meta.bank.repair'").get()?.value || "{}");
        assert.equal(repair.unassigned, 2, `Hesabı Belirsiz Yeni Hareketler: ${JSON.stringify(repair.unassignedSample)}`);
      } finally {
        db.close();
      }
      // 001'de (dokunulmadı) güncelleme öncesi satırlar "yeni" sayılmaz.
      assert.equal((await api.post("/api/companies/select", { id: "sirket-001" })).status, 200);
      const root = (await api.get("/api/workspace/ledger/integrity")).data;
      assert.ok(!root.failures.some(item => item.code === "money:event"), JSON.stringify(root.failures));
    } finally {
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });
});
