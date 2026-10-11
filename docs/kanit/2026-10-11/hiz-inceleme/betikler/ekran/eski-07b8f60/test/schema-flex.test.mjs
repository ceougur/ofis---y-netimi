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

describe("ekip çakışma önleme (v2.0.2)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const staged = await admin.post("/api/workspace/dataset/stage", excel("Dosyalar.xlsx", [["DOSYA NO", "MÜVEKKİL", "TUTAR"], ["2026/1", "Ali Veli", "1.500"], ["2026/2", "Ayşe Kaya", "2.000"]]));
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
  });
  after(async () => {
    await server.close();
  });

  it("aynı hücreyi iki kişi düzenlerse ikincisi 409 alır; 'force' ile üzerine yazabilir", async () => {
    const first = await admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: "2026/1", field: "MÜVEKKİL", value: "Ali Veli (A)", previous: "Ali Veli" });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const stale = await admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: "2026/1", field: "MÜVEKKİL", value: "Ali Veli (B)", previous: "Ali Veli" });
    assert.equal(stale.status, 409, JSON.stringify(stale.data));
    assert.equal(stale.data.code, "CONFLICT");
    assert.equal(stale.data.currentValue, "Ali Veli (A)");
    const forced = await admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: "2026/1", field: "MÜVEKKİL", value: "Ali Veli (B)", previous: "Ali Veli", force: true });
    assert.equal(forced.status, 200, JSON.stringify(forced.data));
    const rows = rowsOf(await admin.get(viewUrl));
    assert.equal(rows.find(row => row.__hofKey === "2026/1").MÜVEKKİL, "Ali Veli (B)");
    // Kaynak değeri değişmemiş hücrede "previous" doğruysa kabul edilir.
    const fresh = await admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: "2026/2", field: "TUTAR", value: "2.100", previous: "2.000" });
    assert.equal(fresh.status, 200, JSON.stringify(fresh.data));
  });

  it("önizleme hazırlanırken veri değişirse kaydetme 409 ile reddedilir", async () => {
    const stagedA = await admin.post("/api/workspace/dataset/stage", excel("Ekim.xlsx", [["DOSYA NO", "MÜVEKKİL", "TUTAR"], ["2026/3", "Can Er", "750"]]));
    const stagedB = await admin.post("/api/workspace/dataset/stage", excel("Kasım.xlsx", [["DOSYA NO", "MÜVEKKİL", "TUTAR"], ["2026/4", "Deniz Ay", "900"]]));
    const okA = await admin.post("/api/workspace/dataset/commit", { stageId: stagedA.data.data.stageId, mode: "merge" });
    assert.equal(okA.status, 200, JSON.stringify(okA.data));
    const staleB = await admin.post("/api/workspace/dataset/commit", { stageId: stagedB.data.data.stageId, mode: "merge" });
    assert.equal(staleB.status, 409, JSON.stringify(staleB.data));
    assert.equal(staleB.data.code, "STALE_STAGE");
  });
});

describe("hata toleransı: işaretlenen hatalar (v2.0.2)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server.close();
  });

  it("kaymış satır işaretlenir, takvime girmez, 'Sorun yok' ile olağan akışa döner", async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000);
    const day = `${String(soon.getDate()).padStart(2, "0")}.${String(soon.getMonth() + 1).padStart(2, "0")}.${soon.getFullYear()}`;
    const staged = await admin.post("/api/workspace/dataset/stage", excel("Dosyalar.xlsx", [
      ["DOSYA NO", "MÜVEKKİL", "TELEFON", "VADE", "TUTAR"],
      ["2026/1", "Ali Veli", "0532 111 11 11", day, "1.500,00 TL"],
      ["2026/2", "Ayşe Kaya", "0533 222 22 22", day, "2.000,00 TL"],
      ["2026/3", "Can Er", "0534 333 33 33", day, "750,00 TL"],
      ["2026/4", "Deniz Ay", day, "900,00 TL", ""], // bir hücre eksik: telefon boş, değerler sola kaymış
      ["2026/5", "Ece Ak", "0536 555 55 55", day, "1.100,00 TL"],
    ]));
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal(staged.data.data.reading.flagged, 1, JSON.stringify(staged.data.data.reading));
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
    let rows = rowsOf(await admin.get(viewUrl));
    const broken = rows.find(row => row.__hofKey === "2026/4");
    assert.match(broken.__hofFlag, /kaymış/);
    assert.ok(!rows.find(row => row.__hofKey === "2026/1").__hofFlag);
    let dues = (await admin.get("/api/workspace/dues")).data.data;
    assert.ok(!dues.items.some(item => item.caseKey === "2026/4"), "işaretli kayıt takvime girmez");
    assert.equal(dues.items.filter(item => item.state === "upcoming").length, 4);
    const insight = (await admin.get("/api/workspace/insight")).data.data.analysis;
    assert.equal(insight.rowCount, 5, "işaretli kayıt veride kalır (silinmez)");
    const unflag = await admin.post("/api/workspace/records/2026%2F4/unflag", {});
    assert.equal(unflag.status, 200, JSON.stringify(unflag.data));
    rows = rowsOf(await admin.get(viewUrl));
    assert.ok(!rows.find(row => row.__hofKey === "2026/4").__hofFlag, "işaret kalktı");
    dues = (await admin.get("/api/workspace/dues")).data.data;
    assert.equal(dues.items.filter(item => item.state === "upcoming").length, 4, "kaymış satırın vadesi tutar kolonunda olduğundan yine takvime giremez; ama kayıt olağan akıştadır");
  });
});

describe("ön izleme ve eşleme (v2.0.2)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server.close();
  });

  it("aşama kolon rollerini, örnek satırları ve şüpheli hücreleri verir; kaydetmede seçilen roller analize ve takvime uygulanır", async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000);
    const day = `${String(soon.getDate()).padStart(2, "0")}.${String(soon.getMonth() + 1).padStart(2, "0")}.${soon.getFullYear()}`;
    const staged = await admin.post("/api/workspace/dataset/stage", excel("Liste.xlsx", [
      ["Kolon A", "Kolon B", "Tarih 2", "Tutar"],
      ["2026/1", "Ali Veli", day, "1.500,00 TL"],
      ["2026/2", "Ayşe Kaya", day, "2.000,00 TL"],
      ["2026/3", "Can Er", "yarın", "750,00 TL"],
    ]));
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    const mapping = staged.data.data.mapping;
    assert.deepEqual(mapping.columns.map(item => item.name), ["Kolon A", "Kolon B", "Tarih 2", "Tutar"]);
    assert.equal(mapping.rows.length, 3);
    assert.ok(mapping.suspicious.some(item => item.row === 2 && item.column === "Tarih 2"), JSON.stringify(mapping.suspicious));
    const commit = await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace", roles: { "Tarih 2": "deadline", "Kolon B": "person" } });
    assert.equal(commit.status, 200, JSON.stringify(commit.data));
    assert.equal(commit.data.data.roles.changed, 2);
    const analysis = (await admin.get("/api/workspace/insight")).data.data.analysis;
    const date = analysis.columns.find(item => item.column === "Tarih 2");
    assert.deepEqual([date.kind, date.forced, date.certainty], ["deadline", "deadline", "kesin"]);
    assert.equal(analysis.primary.person, "Kolon B");
    const dues = (await admin.get("/api/workspace/dues")).data.data;
    assert.equal(dues.items.filter(item => item.label === "Tarih 2").length, 2, JSON.stringify(dues.items.map(item => [item.person, item.label, item.state])));
  });
});
