// 2.0.17 madde 8 (müşteri: "çek ciro edeceğinde cariyi bulmuyor"): ciro seçicisi bütün carileri arar; tedarikçiler üstte.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const TODAY = iso(new Date());
const shift = days => iso(new Date(Date.now() + days * 86_400_000));

describe("Çek ciro: cari seçici tür kısıtsız (prefer=supplier üstte), müşteriye ciro çalışır", () => {
  let server;
  let admin;
  const ids = {};
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    // Yalnız "Müşteri" türünde cariler (kayıttan/faturadan açılanlar gibi) + aynı adlı bir tedarikçi.
    ids.ali = (await admin.post("/api/workspace/accounts", { name: "Ali Toptan", type: "customer" })).data.data.id;
    ids.veli = (await admin.post("/api/workspace/accounts", { name: "Veli Market", type: "customer" })).data.data.id;
    ids.aliSupplier = (await admin.post("/api/workspace/accounts", { name: "Ali Toptan", type: "supplier" })).data.data.id;
  });
  after(() => server.close());

  test("search: tür kısıtı olmadan bütün cariler gelir; prefer=supplier tedarikçiyi üste alır; type=supplier eski davranış", async () => {
    const all = (await admin.get("/api/workspace/accounts/search?q=ali&prefer=supplier")).data.data;
    assert.deepEqual(all.map(item => [item.id, item.type]), [[ids.aliSupplier, "supplier"], [ids.ali, "customer"]]);
    const onlyCustomers = (await admin.get("/api/workspace/accounts/search?q=veli&prefer=supplier")).data.data;
    assert.deepEqual(onlyCustomers.map(item => item.id), [ids.veli], "tedarikçisi olmayan veride müşteri yine bulunur");
    const restricted = (await admin.get("/api/workspace/accounts/search?q=veli&type=supplier")).data.data;
    assert.deepEqual(restricted, [], "eski kısıt yalnız açıkça type verilince");
  });

  test("müşteri türündeki cariye ciro: çek 'Ciro Edildi', ciro edilen cari borçlanır, Kasa değişmez", async () => {
    const cash0 = (await admin.get("/api/workspace/cash?method=all")).data.data.totals.balance;
    const cheque = (await admin.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: ids.ali, drawer: "Ali Toptan", amount: 3000, issueDate: TODAY, dueDate: shift(30), serialNo: "CK-217-1", bank: "Ziraat" })).data.data;
    assert.equal(cheque.status, "portfolio");
    const response = await admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "endorse", date: TODAY, status: "portfolio", accountId: ids.veli, note: "borç ödemesi" });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(response.data.data.status, "endorsed");
    assert.equal(response.data.data.endorseAccountId, ids.veli);
    const veli = (await admin.get(`/api/workspace/accounts/${ids.veli}`)).data.data;
    assert.equal(veli.totals.balance, 3000, "ciro edilen cari (müşteri) bize 3.000 borçlanır — borç ödemesi olarak düşer");
    assert.equal((await admin.get("/api/workspace/cash?method=all")).data.data.totals.balance, cash0, "Kasa değişmez");
  });
});
