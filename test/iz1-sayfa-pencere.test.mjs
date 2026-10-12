// İz 1.2 (2.2.0 iş listesi; 11.10.2026 ek bulgu): aynı kullanıcının iki penceresi açıkken birinde "+ Sayfa" ile yeni sayfa açılınca öbür
// pencere "Çalıştığınız sayfa veri yöneticisi tarafından silindi" deyip yeniden yükleniyordu.
// KÖK NEDEN: sayfa seçimi KULLANICI başına sunucuda (dataset.session.user.<id>); yeni sayfa açan kişi o sayfaya geçer (openSession). Öbür
// pencerenin istekleri de kullanıcının seçimine gidiyordu: sayfa listesi "current = yeni sayfa" döndü, istemci (hof-sessions.js) bunu
// "benim sayfam silindi" sandı. Yeniden yüklenmeseydi o pencerenin okuma ve yazmaları da yeni sayfaya gidecekti (şirketteki 2.0.21 #8 hatasının
// sayfa karşılığı). DÜZELTME: her istek pencerenin sayfasını taşır (?hofPage=, HOF.apiUrl); sunucu sayfa varsa onu kullanır, yoksa (silinmiş,
// uydurma) kullanıcının seçimine düşer. Seçim yalnız yeni açılan pencerenin sayfasını belirler.
//
// NASIL BOZARIM:
//   1. B penceresi X'teyken A yeni sayfa Y açar → B'nin sayfa listesi "current = Y" döner (istemci "silindi" der).
//   2. B'nin tablosu (satırlar) Y'nin satırlarını getirir.
//   3. B'de girilen yeni kayıt Y'ye yazılır.
//   4. B'nin istemci durumu (client-state) Y'yi söyler (60 sn'lik eşitleme pencerenin sayfasını değiştirir).
//   5. Gerçekten silinen sayfayı gösteren pencere silindiğini anlamaz (current hâlâ o sayfa).
//   6. Uydurma / başka şirketin sayfa anahtarı hata verir ya da başka bir yere yazar.
//   7. Parametresiz istek (yeni açılan pencere, eski istemci) kullanıcının seçimini kullanmaz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const emlak = [["İlan No", "İlçe", "Fiyat"], ["EM-1", "Kadıköy", "4.000.000 TL"], ["EM-2", "Beşiktaş", "6.500.000 TL"]];
const taksit = [["Müşteri No", "Müşteri", "Tutar"], ["M-1", "Ali Veli", "20.000,00 ₺"], ["M-2", "Ayşe Kara", "12.000,00 ₺"], ["M-3", "Can Er", "9.000,00 ₺"]];
const data = response => (response.data && typeof response.data === "object" && "ok" in response.data ? response.data.data : response.data);
const inPage = (url, key) => (key ? `${url}${url.includes("?") ? "&" : "?"}hofPage=${encodeURIComponent(key)}` : url);

describe("İz 1.2 — her pencere kendi sayfasında: öbür pencerede açılan yeni sayfa 'silindi' sayılmaz", () => {
  let server;
  let admin;
  let staff;
  let x; // ilk sayfa (iki pencerenin de açık olduğu)
  let y; // A penceresinin açtığı yeni sayfa
  const rows = async (client, key) => {
    const response = await client.get(inPage(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`, key));
    return (response.data.result?.data?.json ?? response.data.result?.data).rows;
  };

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Ak", role: "personel" });
    const first = data(await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "portfoy.xlsx", sheets: [{ name: "Sayfa1", matrix: emlak }] }));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: first.stageId, mode: "replace" })).status, 200);
    x = data(await admin.get("/api/workspace/sessions")).current;
    assert.ok(x, "B penceresinin sayfası X");
    // A penceresi (aynı kullanıcı, X'te) "+ Sayfa → Excel'den Aktar → Yeni Sayfada Aç".
    const staged = data(await admin.post(inPage("/api/workspace/dataset/stage", x), { kind: "excel", fileName: "taksitler.xlsx", sheets: [{ name: "Sayfa1", matrix: taksit }] }));
    const opened = await admin.post(inPage("/api/workspace/dataset/commit", x), { stageId: staged.stageId, mode: "session", name: "Taksit Takibi" });
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
    y = data(opened).session.key;
    assert.ok(y && y !== x, "A yeni sayfa Y'yi açtı");
  });
  after(() => server?.close());

  it("1: B'nin (X) sayfa listesi: current X, yeni sayfa Y listede; A'nın (Y) listesi: current Y", async () => {
    const listB = data(await admin.get(inPage("/api/workspace/sessions", x)));
    assert.equal(listB.current, x, "B'nin sayfası X kalır (silindi sanılmaz)");
    assert.deepEqual(listB.sessions.map(item => item.name).sort(), ["Taksit Takibi", "portfoy.xlsx"].sort(), "şeritte iki sayfa");
    assert.equal(listB.sessions.find(item => item.current)?.key, x, "B'de X seçili görünür");
    const listA = data(await admin.get(inPage("/api/workspace/sessions", y)));
    assert.equal(listA.current, y);
  });

  it("2, 4: B'nin tablosu ve istemci durumu X'in; A'nınki Y'nin", async () => {
    assert.deepEqual((await rows(admin, x)).map(row => row["İlan No"]), ["EM-1", "EM-2"], "B: X'in satırları");
    assert.deepEqual((await rows(admin, y)).map(row => row["Müşteri"]), ["Ali Veli", "Ayşe Kara", "Can Er"], "A: Y'nin satırları");
    assert.equal(data(await admin.get(inPage("/api/workspace/client-state", x))).datasetKey, x, "B'nin eşitlemesi X'i söyler");
    assert.equal(data(await admin.get(inPage("/api/workspace/client-state", y))).datasetKey, y);
  });

  it("3: B'de girilen yeni kayıt X'e yazılır, Y'ye değil", async () => {
    const created = await admin.post(inPage("/api/workspace/records", x), { values: { "İlan No": "EM-9", "İlçe": "Üsküdar", Fiyat: "1.000.000 TL" }, caseKey: "EM-9" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal(data(created).sourceName, x, "kayıt X'e");
    assert.ok((await rows(admin, x)).some(row => row["İlan No"] === "EM-9"), "X'in tablosunda");
    assert.ok(!(await rows(admin, y)).some(row => row["İlan No"] === "EM-9"), "Y'nin tablosunda yok");
  });

  it("7: parametresiz istek (yeni açılan pencere) kullanıcının seçimini (Y) kullanır; personel kendi seçiminde (X)", async () => {
    assert.equal(data(await admin.get("/api/workspace/sessions")).current, y, "yönetici yeni sayfaya geçmişti");
    assert.equal(data(await staff.get("/api/workspace/sessions")).current, x, "personelin seçimi değişmedi");
    assert.equal(data(await staff.get(inPage("/api/workspace/sessions", y))).current, y, "personelin Y'yi gösteren penceresi");
  });

  it("6: uydurma sayfa anahtarı hata vermez, kullanıcının seçimine düşer", async () => {
    const list = await admin.get(inPage("/api/workspace/sessions", "dataset://boyle-bir-sayfa-yok"));
    assert.equal(list.status, 200);
    assert.equal(data(list).current, y);
  });

  it("5: Y silinince Y'yi gösteren pencerenin listesinde Y yok ve current başka (istemci 'silindi' der); X'teki B etkilenmez", async () => {
    const removed = await admin.post(inPage("/api/workspace/sessions/delete", x), { key: y });
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    const onY = data(await admin.get(inPage("/api/workspace/sessions", y)));
    assert.ok(!onY.sessions.some(item => item.key === y), "Y listede yok");
    assert.notEqual(onY.current, y, "Y'yi gösteren pencere için current başka sayfa");
    const onX = data(await admin.get(inPage("/api/workspace/sessions", x)));
    assert.equal(onX.current, x, "B yine X'te");
  });
});
