// Kullanıcının kendi sektörü (v2.0.2): oluşturma, seçme, arayüz dili, analiz önerisi, düzenleme ve silme.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { pluralOf } from "../server/lib/custom-sectors.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("kendi sektörünü oluşturma", () => {
  let server;
  let admin;
  let staff;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    const matrix = [["Tekne adı", "Kaptan", "Liman", "Kiralama başlangıç", "Günlük ücret"], ["Mavi Rüya", "Ali Veli", "Bodrum", "01.07.2026", "12.000 TL"], ["Deniz Yıldızı", "Can Er", "Göcek", "05.07.2026", "9.500 TL"], ["Rüzgar", "Ece Ak", "Fethiye", "10.07.2026", "11.000 TL"]];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tekneler.xlsx", sheets: [{ name: "Tekneler", matrix }] });
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
  });
  after(() => server.close());

  it("Türkçe çoğul önerisi ünlü uyumuna uyar", () => {
    assert.equal(pluralOf("tekne"), "tekneler");
    assert.equal(pluralOf("kayık"), "kayıklar");
    assert.equal(pluralOf("öğrenci"), "öğrenciler");
    assert.equal(pluralOf("koltuk"), "koltuklar");
  });

  it("yalnızca yönetici oluşturur; ad zorunlu ve listede olmamalı", async () => {
    assert.equal((await staff.post("/api/workspace/sectors/custom", { name: "Tekne kiralama", record: "tekne" })).status, 403);
    assert.equal((await admin.post("/api/workspace/sectors/custom", { name: "a", record: "tekne" })).status, 400);
    const dup = await admin.post("/api/workspace/sectors/custom", { name: "Klinik ve poliklinik", record: "hasta" });
    assert.equal(dup.status, 409);
    assert.match(dup.data.error, /zaten var/);
  });

  it("oluşturulan sektör listenin başında; seçilince arayüzün dili onun olur", async () => {
    const created = await admin.post("/api/workspace/sectors/custom", { name: "Tekne kiralama", record: "Tekne", expert: "Kaptan", modules: { tahsilat: true, haciz: false }, headers: "Tekne adı, Liman, Kaptan" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const sector = created.data.data.sector;
    assert.equal(sector.id, "ozel-tekne-kiralama");
    assert.deepEqual(sector.vocab, { record: "tekne", records: "tekneler", Record: "Tekne", Records: "Tekneler", expert: "Kaptan", subtitle: "Tekne kiralama yönetimi" });
    const catalog = (await staff.get("/api/workspace/sectors")).data.data;
    assert.equal(catalog.groups[0].name, "Kendi sektörleriniz");
    assert.equal(catalog.groups[0].sectors[0].name, "Tekne kiralama");
    const applied = await admin.post("/api/workspace/insight/sector", { sectorId: sector.id, source: "manual" });
    assert.equal(applied.status, 200, JSON.stringify(applied.data));
    const profile = (await staff.get("/api/workspace/profile")).data.data;
    assert.equal(profile.sector.name, "Tekne kiralama");
    assert.equal(profile.sector.custom, true);
    assert.equal(profile.vocab.Records, "Tekneler");
    assert.equal(profile.tagline, "Tekne kiralama yönetimi");
  });

  it("tanıtıcı kolon başlıkları analizde bu sektörü önerir", async () => {
    const insight = (await admin.get("/api/workspace/insight")).data.data.analysis;
    assert.equal(insight.sector.suggestion, "ozel-tekne-kiralama", JSON.stringify(insight.sector));
    assert.equal(insight.sector.suggestionSector.name, "Tekne kiralama");
  });

  it("düzenlenir; silinince o sektörü kullanan görünüm Genel'e döner", async () => {
    const updated = await admin.put("/api/workspace/sectors/custom/ozel-tekne-kiralama", { name: "Tekne ve yat kiralama", record: "tekne", records: "tekneler", expert: "Kaptan" });
    assert.equal(updated.status, 200, JSON.stringify(updated.data));
    assert.equal(updated.data.data.profile.sector.name, "Tekne ve yat kiralama");
    const removed = await admin.del("/api/workspace/sectors/custom/ozel-tekne-kiralama");
    assert.equal(removed.status, 200);
    assert.equal(removed.data.data.profile.sector.id, "genel");
    const catalog = (await admin.get("/api/workspace/sectors")).data.data;
    assert.notEqual(catalog.groups[0].name, "Kendi sektörleriniz");
    const events = server.app.store.all("SELECT type FROM audit_events WHERE type LIKE 'profile.sector.custom.%' ORDER BY created_at").map(row => row.type);
    assert.deepEqual(events, ["profile.sector.custom.created", "profile.sector.custom.updated", "profile.sector.custom.deleted"]);
  });
});
