// 2.0.25 (müşteri, 06.10.2026): "ikinci sayfanın altındaki sekmeyi komple sildim, yukarıda hâlâ 109 kayıt diyor".
// "Sekmeyi Sil" sekmeyi ekrandan kaldırır (veri durur, Silinenler'den geri gelir); sayfa şeridindeki sayı ekranda görünen
// kayıtları saymalı: gizli sekmenin satırları sayılmaz, sekme geri gelince sayı geri gelir.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const emlak = [
  ["İlan No", "İlçe", "Fiyat"],
  ["EM-1", "Kadıköy", "4.000.000 TL"],
  ["EM-2", "Beşiktaş", "6.500.000 TL"],
];
const musteri = [
  ["Müşteri No", "Müşteri", "Telefon"],
  ["M-1", "Ali Veli", "05321112233"],
  ["M-2", "Ayşe Kara", "05321112234"],
  ["M-3", "Can Er", "05321112235"],
];
const arsiv = [
  ["Müşteri No", "Müşteri", "Telefon"],
  ["A-1", "Deniz Ak", "05321112236"],
];

describe("sayfa şeridindeki kayıt sayısı gizlenen sekmeyi saymaz", () => {
  let server;
  let admin;
  const data = response => response.data?.data ?? response.data;
  const pages = async () => data(await admin.get("/api/workspace/sessions")).sessions;
  const stage = (fileName, sheets) => admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName, sheets });

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const first = await stage("portfoy.xlsx", [{ name: "Portföy", matrix: emlak }]);
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: data(first).stageId, mode: "replace" })).status, 200);
    const second = await stage("musteriler.xlsx", [
      { name: "Müşteriler", matrix: musteri },
      { name: "Arşiv", matrix: arsiv },
    ]);
    const opened = await admin.post("/api/workspace/dataset/commit", { stageId: data(second).stageId, mode: "session", name: "Müşteriler Yeni" });
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
  });
  after(() => server.close());

  it("çalışıyor mu: iki sekmeli sayfa 4 kayıt; bir sekme silinince 1, ikisi de silinince 0; geri alınınca 4", async () => {
    const count = async () => (await pages()).find(item => item.name === "Müşteriler Yeni").rowCount;
    assert.equal(await count(), 4);
    const hidden = await admin.post("/api/workspace/tabs/hide", { tab: "Müşteriler" });
    assert.equal(hidden.status, 200, JSON.stringify(hidden.data));
    assert.equal(await count(), 1, "silinen sekmenin 3 kaydı sayılmaz");
    assert.equal((await admin.post("/api/workspace/tabs/hide", { tab: "Arşiv" })).status, 200);
    assert.equal(await count(), 0, "bütün sekmeleri silinen sayfa 0 kayıt");
    assert.equal((await admin.post("/api/workspace/tabs/unhide", { original: "Müşteriler" })).status, 200);
    assert.equal((await admin.post("/api/workspace/tabs/unhide", { original: "Arşiv" })).status, 200);
    assert.equal(await count(), 4, "geri alınınca sayı geri gelir");
  });

  it("nasıl bozarım: öbür sayfanın sayısı etkilenmez; ilk sayfa listede kalır", async () => {
    assert.equal((await admin.post("/api/workspace/tabs/hide", { tab: "Müşteriler" })).status, 200);
    const list = await pages();
    assert.equal(list.find(item => item.name === "portfoy.xlsx")?.rowCount, 2, "öbür sayfa 2 kayıt");
    assert.equal(list.find(item => item.name === "Müşteriler Yeni")?.rowCount, 1);
    assert.equal((await admin.post("/api/workspace/tabs/unhide", { original: "Müşteriler" })).status, 200);
  });
});
