// Uyarı ufku bütün sayfalarda aynı (kullanıcı kararı "A", 11.10.2026). Müşteri ekranı: 1. sayfadayken 2. sayfadaki "Lisans Bitiş
// Tarihi 17.11.2026" kaydı sağ altta "SON GÜNE 42 GÜN" uyarısı verdi. Kök neden: /api/workspace/dues açık sayfanın son tarihlerini
// computeDeadlines'ın 7 günlük ufkuyla, ÖBÜR sayfalarınkini ise raporların bir yıllık takviminden (routes/reports.mjs AHEAD
// 366 gün) süzmeden alıyordu. Beklenen: her sayfada kayıt yalnız son 7 gün kala (ve geçmişse gecikmiş olarak) uyarır; Vade Takip
// raporu (ileriye bir yıl) değişmez.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = new Date("2026-10-06T09:00:00Z");
const dmy = days => {
  const date = new Date(NOW.getTime() + days * 86_400_000);
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
};
const firms = prefix => [
  ["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"],
  ["202092758", `${prefix} 42 Gün`, "05321112230", dmy(42)],
  ["202092759", `${prefix} 5 Gün`, "05321112231", dmy(5)],
  ["202092760", `${prefix} 7 Gün`, "05321112232", dmy(7)],
  ["202092761", `${prefix} 8 Gün`, "05321112233", dmy(8)],
  ["202092762", `${prefix} Geçmiş`, "05321112234", dmy(-3)],
];

describe("uyarı ufku: her sayfanın son tarihi yalnız 7 gün kala uyarır", () => {
  let server;
  let admin;
  let pages;
  const data = response => response.data?.data ?? response.data;
  const stage = (fileName, matrix) => admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName, sheets: [{ name: "Firmalar", matrix }] });
  const dues = async key => {
    assert.equal((await admin.post("/api/workspace/sessions/select", { key })).status, 200);
    const response = await admin.get("/api/workspace/dues");
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return data(response);
  };
  const names = list => list.map(item => item.person).sort((a, b) => a.localeCompare(b, "tr"));

  before(async () => {
    server = await startTestServer({ now: NOW });
    admin = await loginAdmin(server);
    const first = await stage("bu-sayfa.xlsx", firms("Açık"));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: data(first).stageId, mode: "replace" })).status, 200);
    const second = await stage("obur-sayfa.xlsx", firms("Öbür"));
    const opened = await admin.post("/api/workspace/dataset/commit", { stageId: data(second).stageId, mode: "session", name: "Öbür Sayfa" });
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
    pages = data(await admin.get("/api/workspace/sessions")).sessions;
    assert.equal(pages.length, 2, "ön koşul: iki sayfa");
  });
  after(() => server.close());

  it("çalışıyor mu: 1. sayfadayken açık ve öbür sayfanın son tarihleri aynı kuralla (5, 7 gün ve gecikmiş var; 8 ve 42 gün yok)", async () => {
    const p1 = pages.find(item => item.name !== "Öbür Sayfa");
    const result = await dues(p1.key);
    const own = result.deadlines.filter(item => !item.foreign);
    const foreign = result.deadlines.filter(item => item.foreign);
    assert.deepEqual(names(own), ["Açık 5 Gün", "Açık 7 Gün", "Açık Geçmiş"], "açık sayfa: 7 gün ufku");
    assert.deepEqual(names(foreign), ["Öbür 5 Gün", "Öbür 7 Gün", "Öbür Geçmiş"], "öbür sayfa: aynı 7 gün ufku (42 ve 8 gün uyarmaz)");
    const late = foreign.find(item => item.person === "Öbür Geçmiş");
    assert.equal(late.days, -3, "geçmiş kayıt gecikmiş olarak gelir");
    assert.equal(late.pageName, "Öbür Sayfa", "öbür sayfa kalemi sayfa adıyla");
  });

  it("nasıl bozarım: 2. sayfaya geçince bu kez 1. sayfanın 42 günlük kaydı uyarmaz (kural iki yönde)", async () => {
    const p2 = pages.find(item => item.name === "Öbür Sayfa");
    const result = await dues(p2.key);
    assert.deepEqual(names(result.deadlines.filter(item => !item.foreign)), ["Öbür 5 Gün", "Öbür 7 Gün", "Öbür Geçmiş"]);
    assert.deepEqual(names(result.deadlines.filter(item => item.foreign)), ["Açık 5 Gün", "Açık 7 Gün", "Açık Geçmiş"]);
    assert.ok(!result.deadlines.some(item => item.days > 7), "hiçbir son tarih 7 günden ileride değil");
  });

  it("nasıl bozarım: saat ilerleyince (35 gün sonra) 42 günlük kayıt 7 gün kala her iki sayfada uyarır", async () => {
    server.clock.set(new Date(NOW.getTime() + 35 * 86_400_000));
    try {
      const p1 = pages.find(item => item.name !== "Öbür Sayfa");
      const result = await dues(p1.key);
      const found = result.deadlines.filter(item => /42 Gün$/.test(item.person));
      assert.deepEqual(names(found), ["Açık 42 Gün", "Öbür 42 Gün"]);
      assert.ok(found.every(item => item.days === 7), "ikisi de SON GÜNE 7 GÜN");
    } finally {
      server.clock.set(NOW);
    }
  });

  it("değişmez: Vade Takip raporu öbür sayfanın 42 günlük kaydını yine gösterir (ileriye bir yıl)", async () => {
    const p1 = pages.find(item => item.name !== "Öbür Sayfa");
    assert.equal((await admin.post("/api/workspace/sessions/select", { key: p1.key })).status, 200);
    const response = await admin.get("/api/workspace/reports/vade-takip");
    assert.equal(response.status, 200, JSON.stringify(response.data));
    const text = JSON.stringify(data(response).report);
    assert.ok(text.includes("Öbür 42 Gün") && text.includes("Açık 42 Gün"), "Vade Takip ufku değişmedi");
  });
});
