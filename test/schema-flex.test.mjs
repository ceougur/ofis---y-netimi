// Şemaya esnek uyum ve Veri Sağlık Kontrolü, tam yığın (v2.0.2): kolon adı değişen dosya eşlenir, düzeltme ve saklı
// satırlar yeni ada taşınır; toplu düzeltme uygulanır ve geri alınır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const excel = (fileName, matrix) => ({ kind: "excel", fileName, sheets: [{ name: "Dosyalar", matrix }] });
const viewUrl = `/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`;
const rowsOf = response => response.data.result.data.json.rows;

describe("şemaya esnek uyum ve toplu düzeltme (tam yığın)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server.close();
  });

  it("yeniden adlandırılan kolon eşlenir; düzeltme ve saklı satırlar yeni ada taşınır; okuma raporu ve şema önizlemede", async () => {
    const first = await admin.post("/api/workspace/dataset/stage", excel("Dosyalar.xlsx", [
      ["DOSYA NO", "MÜVEKKİL", "TEL", "TUTAR"],
      ["2026/1", "Ali Veli", "5321112233", "1.500,00 TL"],
      ["2026/2", "Ayşe Kaya", "0533 222 22 22", "2.000,00 TL"],
      ["2026/3", "Can Er", "+90 534 333 33 33", "750,00 TL"],
    ]));
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.data.reading.coverage, 1);
    assert.equal(first.data.data.schema, null, "ilk yüklemede eşlenecek eski kolon yok");
    await admin.post("/api/workspace/dataset/commit", { stageId: first.data.data.stageId, mode: "replace" });
    // Bir düzeltme: müvekkil adı.
    const fixed = await admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: "2026/1", field: "MÜVEKKİL", value: "Ali Veli (düzeltildi)" });
    assert.equal(fixed.status, 200, JSON.stringify(fixed.data));

    // Yeni ay dosyası: iki kolon yeniden adlandırılmış, biri yeni, biri yok; bir kayıt yeni.
    const second = await admin.post("/api/workspace/dataset/stage", excel("Dosyalar-Ekim.xlsx", [
      ["DOSYA NO", "MÜVEKKİL ADI", "TELEFON", "TUTAR", "E-POSTA"],
      ["2026/1", "Ali Veli", "5321112233", "1.500,00 TL", "ali@ornek.com"],
      ["2026/2", "Ayşe Kaya", "0533 222 22 22", "2.000,00 TL", "ayse@ornek.com"],
      ["2026/4", "Deniz Ay", "0535 444 44 44", "900,00 TL", "deniz@ornek.com"],
    ]));
    assert.equal(second.status, 200, JSON.stringify(second.data));
    const schema = second.data.data.schema;
    assert.deepEqual(schema.renamed.map(item => [item.from, item.to]), [["MÜVEKKİL", "MÜVEKKİL ADI"], ["TEL", "TELEFON"]], JSON.stringify(schema));
    assert.deepEqual(schema.added, ["E-POSTA"]);
    assert.deepEqual(schema.removed, []);
    assert.equal(second.data.data.differentTopic, false, "eşlenen kolonlar ortak sayılır; farklı konu uyarısı çıkmaz");
    await admin.post("/api/workspace/dataset/commit", { stageId: second.data.data.stageId, mode: "merge" });

    const rows = rowsOf(await admin.get(viewUrl));
    const columns = [...new Set(rows.flatMap(row => Object.keys(row).filter(key => !key.startsWith("__"))))];
    assert.ok(!columns.includes("MÜVEKKİL") && !columns.includes("TEL"), `eski adlar kalmamalı: ${columns.join(", ")}`);
    const kept = rows.find(row => row.__hofKey === "2026/3");
    assert.equal(kept["MÜVEKKİL ADI"], "Can Er", "dosyada olmayan eski kayıt yeni kolon adına taşındı");
    assert.equal(kept.TELEFON, "+90 534 333 33 33");
    const corrected = rows.find(row => row.__hofKey === "2026/1");
    assert.equal(corrected["MÜVEKKİL ADI"], "Ali Veli (düzeltildi)", "düzeltme yeni kolon adında yaşamaya devam eder");
  });

  it("toplu düzeltme: telefon yazımı tek tıkla uygulanır ve geri alınır", async () => {
    const proposals = await admin.get("/api/workspace/insight/fixes");
    assert.equal(proposals.status, 200, JSON.stringify(proposals.data));
    const phone = proposals.data.data.fixes.find(fix => fix.id === "phone:TELEFON");
    assert.ok(phone, JSON.stringify(proposals.data.data.fixes));
    assert.equal(phone.count, 2, "5321112233 ve +90 534 … tek yazıma çevrilir");
    assert.ok(!("changes" in phone), "değişiklik listesi sunucuda kalır");
    const applied = await admin.post("/api/workspace/insight/fixes/apply", { id: "phone:TELEFON" });
    assert.equal(applied.status, 200, JSON.stringify(applied.data));
    assert.equal(applied.data.data.count, 2);
    let rows = rowsOf(await admin.get(viewUrl));
    assert.equal(rows.find(row => row.__hofKey === "2026/1").TELEFON, "0532 111 22 33");
    assert.equal(rows.find(row => row.__hofKey === "2026/3").TELEFON, "0534 333 33 33");
    const again = await admin.get("/api/workspace/insight/fixes");
    assert.ok(!again.data.data.fixes.some(fix => fix.id === "phone:TELEFON"), "uygulanan öneri yeniden çıkmaz");
    const undone = await admin.post("/api/workspace/insight/fixes/undo", { batchId: applied.data.data.batchId });
    assert.equal(undone.status, 200, JSON.stringify(undone.data));
    rows = rowsOf(await admin.get(viewUrl));
    assert.equal(rows.find(row => row.__hofKey === "2026/1").TELEFON, "5321112233");
    const gone = await admin.post("/api/workspace/insight/fixes/undo", { batchId: applied.data.data.batchId });
    assert.equal(gone.status, 410);
  });
});
