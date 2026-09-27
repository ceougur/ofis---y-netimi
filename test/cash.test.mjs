import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parseAmount } from "../server/lib/money.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("tahsilat düzeltme/silme ve kasa (v2.0.1)", () => {
  let server;
  let admin;
  let personel;
  let muhasebe;
  let other;
  const key = encodeURIComponent("2026/901");

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    personel = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    other = await createUser(server, admin, { username: "mert", name: "Mert Er", role: "personel" });
    muhasebe = await createUser(server, admin, { username: "muh", name: "Muhasebe Hesabı", role: "muhasebe" });
  });
  after(() => server.close());

  it("Türkçe tutarları doğru okur (binlik nokta)", () => {
    assert.equal(parseAmount("1.250"), 1250);
    assert.equal(parseAmount("1.250,75"), 1250.75);
    assert.equal(parseAmount("12.500.000 TL"), 12_500_000);
    assert.equal(parseAmount("1250.5"), 1250.5);
    assert.ok(Number.isNaN(parseAmount("on bin")));
  });

  it("işlem geçmişi eskiden yeniye sıralanır; yeni eklenen en altta", async () => {
    await personel.post(`/api/workspace/cases/${key}/notes`, { note: "İlk not" });
    await new Promise(resolve => setTimeout(resolve, 5));
    await personel.post(`/api/workspace/cases/${key}/notes`, { note: "İkinci not" });
    const activity = await personel.get(`/api/workspace/cases/${key}/activity`);
    const notes = activity.data.data.items.filter(item => item.type === "note").map(item => item.text);
    assert.deepEqual(notes, ["İlk not", "İkinci not"]);
  });

  it("kişi kendi tahsilatını düzeltip silebilir, başkasınınkini değiştiremez; kasa yetkisi herkesinkini değiştirir", async () => {
    const created = await personel.post(`/api/workspace/cases/${key}/payments`, { amount: "1.500", date: "2026-09-10", note: "Elden", caseTitle: "Ali Veli" });
    assert.equal(created.status, 200);
    const id = created.data.data.id;
    const activity = await personel.get(`/api/workspace/cases/${key}/activity`);
    const payment = activity.data.data.items.find(item => item.id === id);
    assert.equal(payment.amount, 1500, "1.500 bin beş yüz olarak okunmalı");

    assert.equal((await other.put(`/api/workspace/payments/${id}`, { amount: "1", date: "2026-09-10" })).status, 403);
    assert.equal((await other.del(`/api/workspace/payments/${id}`)).status, 403);

    const fixed = await personel.put(`/api/workspace/payments/${id}`, { amount: "1.750,00", date: "2026-09-11", note: "Havale" });
    assert.equal(fixed.status, 200);
    const after = (await personel.get(`/api/workspace/cases/${key}/activity`)).data.data;
    const updated = after.items.find(item => item.id === id);
    assert.equal(updated.amount, 1750);
    assert.equal(updated.date, "2026-09-11");
    assert.equal(updated.updatedByName, "Selin Kaya");
    assert.equal(after.paidTotal, 1750);

    assert.equal((await muhasebe.put(`/api/workspace/payments/${id}`, { amount: "2000", date: "2026-09-11", note: "Havale" })).status, 200);
    const audit = await admin.get("/api/admin/audit?type=case.payment.updated");
    assert.equal(audit.data.data.length, 2, "düzeltmeler denetim kaydında");
    assert.equal(audit.data.data.at(-1).payload.previous.amount, 1500);

    assert.equal((await personel.del(`/api/workspace/payments/${id}`)).status, 200);
    assert.equal((await personel.del(`/api/workspace/payments/${id}`)).status, 404);
    assert.equal((await personel.get(`/api/workspace/cases/${key}/activity`)).data.data.paidTotal, 0);
  });

  it("kasa: detay kartı tahsilatları + elle tahsilat/ödeme, bakiye ve dönem", async () => {
    assert.equal((await personel.get("/api/workspace/cash")).status, 403, "personel kasayı göremez");
    assert.equal((await personel.post("/api/workspace/cash", { kind: "out", amount: "10", description: "x" })).status, 403);

    await personel.post(`/api/workspace/cases/${key}/payments`, { amount: "5.000", date: "2026-08-20", caseTitle: "Ali Veli" });
    await personel.post(`/api/workspace/cases/${key}/payments`, { amount: "3.000", date: "2026-09-05", caseTitle: "Ali Veli" });
    assert.equal((await muhasebe.post("/api/workspace/cash", { kind: "out", amount: "1.200,50", date: "2026-09-06", description: "Kira" })).status, 200);
    assert.equal((await muhasebe.post("/api/workspace/cash", { kind: "in", amount: "750", date: "2026-09-07", description: "Danışmanlık ücreti" })).status, 200);
    assert.equal((await muhasebe.post("/api/workspace/cash", { kind: "out", amount: "0", description: "Boş" })).status, 400);
    assert.equal((await muhasebe.post("/api/workspace/cash", { kind: "out", amount: "10", description: "" })).status, 400);

    const all = (await muhasebe.get("/api/workspace/cash")).data.data;
    assert.deepEqual(all.entries.map(entry => entry.date), ["2026-08-20", "2026-09-05", "2026-09-06", "2026-09-07"], "eskiden yeniye");
    assert.deepEqual(all.entries.map(entry => entry.balance), [5000, 8000, 6799.5, 7549.5], "her satırda o ana kadarki kasa");
    assert.equal(all.totals.balance, 7549.5);
    assert.equal(all.entries[0].source, "payment");
    assert.equal(all.entries[0].caseTitle, "Ali Veli");

    const september = (await muhasebe.get("/api/workspace/cash?from=2026-09-01&to=2026-09-30")).data.data;
    assert.equal(september.opening, 5000, "devreden kasa");
    assert.equal(september.entries.length, 3);
    assert.deepEqual(september.period, { in: 3750, out: 1200.5, net: 2549.5 });
    assert.equal(september.totals.balance, 7549.5, "güncel kasa dönemden bağımsız");

    const rent = all.entries.find(entry => entry.description === "Kira");
    assert.equal((await muhasebe.put(`/api/workspace/cash/${rent.id}`, { kind: "out", amount: "1.300", date: "2026-09-06", description: "Kira (Eylül)" })).status, 200);
    assert.equal((await muhasebe.del(`/api/workspace/cash/${rent.id}`)).status, 200);
    const final = (await admin.get("/api/workspace/cash")).data.data;
    assert.equal(final.totals.balance, 8750);
    assert.ok(final.entries.every(entry => entry.editable), "yönetici tüm hareketleri düzeltebilir");
  });
});
