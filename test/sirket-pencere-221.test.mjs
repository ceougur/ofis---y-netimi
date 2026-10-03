// 2.0.21 madde 8: aynı hesap iki pencerede (ya da iki bilgisayarda; küçük ofislerde "admin" hesabı paylaşılır) açıkken
// birinde şirket değişince öbür pencerenin kaydı yanlış şirkete yazılmamalı. Şirket seçimi sunucuda kullanıcı başınadır;
// istemci her isteğe sayfanın şirketini ekler (?hofCompany=) ve sunucu isteği o şirkete yönlendirir.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const data = response => (response.data && typeof response.data === "object" && "ok" in response.data ? response.data.data : response.data);
const names = async (client, company) => {
  const response = await client.get(`/api/workspace/accounts${company ? `?hofCompany=${company}` : ""}`);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return data(response).accounts.map(item => item.name).sort();
};

describe("2.0.21 · aynı hesap iki pencerede: kayıt sayfanın şirketine yazılır", () => {
  let server;
  let windowA; // önce açılan pencere (001'i gösteriyor)
  let windowB; // ikinci bilgisayar, aynı hesap
  let second;
  before(async () => {
    server = await startTestServer();
    windowA = await loginAdmin(server);
    windowB = server.client();
    assert.equal((await windowB.login("admin", ADMIN_PASSWORD)).status, 200);
    second = data(await windowA.post("/api/companies", { name: "İkinci Şirket" })).company;
  });
  after(() => server.close());

  test("hata yeniden üretilir (şirketsiz istek = eski istemci): B 002'ye geçince A'nın kaydı 002'ye düşer", async () => {
    // A 001'i gösteriyor; B (aynı hesap) 002'ye geçer.
    assert.equal((await windowB.post("/api/companies/select", { id: second.id })).status, 200);
    assert.equal((await windowA.post("/api/workspace/accounts", { name: "Eski Yol Kaydı", type: "customer" })).status, 200);
    assert.deepEqual(await names(windowA, second.id), ["Eski Yol Kaydı"], "şirket belirtilmeyen istek seçili şirkete (002) gider — 2.0.20'ye kadar her istek böyleydi");
  });

  test("düzeltme: A'nın isteği sayfasının şirketini (001) taşır; B'nin seçimi etkilemez", async () => {
    assert.equal((await windowA.post("/api/workspace/accounts?hofCompany=sirket-001", { name: "Bir Carisi", type: "customer" })).status, 200);
    assert.equal((await windowB.post(`/api/workspace/accounts?hofCompany=${second.id}`, { name: "İki Carisi", type: "customer" })).status, 200);
    assert.deepEqual(await names(windowA, "sirket-001"), ["Bir Carisi"]);
    assert.deepEqual(await names(windowB, second.id), ["Eski Yol Kaydı", "İki Carisi"]);
    // Kasa ve okuma da aynı: A 001'in Kasa'sına yazar.
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await windowA.post("/api/workspace/cash?hofCompany=sirket-001", { kind: "in", amount: 100, date: today, description: "001 nakit" })).status, 200);
    assert.equal(data(await windowA.get("/api/workspace/cash?hofCompany=sirket-001")).totals.balance, 100);
    assert.equal(data(await windowB.get(`/api/workspace/cash?hofCompany=${second.id}`)).totals.balance, 0);
  });

  test("yetkisiz şirket istenirse 403; silinmiş şirket istenirse 409 (kayıt başka şirkete düşmez)", async () => {
    const staff = await createUser(server, windowA, { username: "personel1" });
    const forbidden = await staff.post(`/api/workspace/accounts?hofCompany=${second.id}`, { name: "Yetkisiz", type: "customer" });
    assert.equal(forbidden.status, 403);
    const third = data(await windowA.post("/api/companies", { name: "Üçüncü" })).company;
    assert.equal((await windowA.raw("DELETE", `/api/companies/${third.id}`, { body: JSON.stringify({ confirm: third.code, password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } })).status, 200);
    const gone = await windowA.post(`/api/workspace/accounts?hofCompany=${third.id}`, { name: "Kayıp", type: "customer" });
    assert.equal(gone.status, 409);
    assert.equal(gone.data.code, "company-missing");
    assert.deepEqual(await names(windowA, "sirket-001"), ["Bir Carisi"]);
    assert.deepEqual(await names(windowA, second.id), ["Eski Yol Kaydı", "İki Carisi"]);
  });
});
