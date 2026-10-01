// Taksit kartı ↔ tablodaki kayıt bağı (v2.0.6): kart bir kayda bağlanır; kişinin kartında taksitler görünür, karttan
// girilen tahsilat taksitten düşer, Kasa'ya tek kayıt olarak iner ve kişinin işlem geçmişinde görünür.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("taksit kartı tablodaki kayda bağlanır (v2.0.6)", () => {
  let server;
  let admin;
  let staff;
  let rows;
  let plan;
  const view = async client => (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    const matrix = [["Dosya No", "Borçlu", "Telefon", "Tutar"], ["2026/1", "Ali Veli", "0532 111 11 11", "9.000"], ["2026/2", "Ayşe Kaya", "0532 222 22 22", "4.500"]];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "dosyalar.xlsx", sheets: [{ name: "Aktif", matrix }] });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);
    rows = (await view(admin)).rows;
  });
  after(() => server.close());

  it("kart kayda bağlanarak açılır; kaydın kartları uçtan okunur; liste kayda göre süzülür", async () => {
    const ali = rows.find(row => row["Dosya No"] === "2026/1");
    const created = await admin.post("/api/workspace/plans", { registeredOn: "2026-01-01", name: "Ali Veli", total: "9.000", caseKey: ali.__hofKey, caseTitle: "2026/1 · Ali Veli", mode: "auto", count: 3, firstDue: "2026-01-05" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    plan = created.data.data;
    assert.equal(plan.caseKey, ali.__hofKey);
    assert.equal(plan.caseTitle, "2026/1 · Ali Veli");
    assert.equal(plan.caseSource, "dataset://ofis", "veri oturumu sunucuda doldurulur");
    const linked = (await staff.get(`/api/workspace/cases/${encodeURIComponent(ali.__hofKey)}/plans`)).data.data;
    assert.equal(linked.plans.length, 1);
    assert.equal(linked.plans[0].id, plan.id);
    assert.equal(linked.plans[0].items.length, 3, "kişinin kartı için taksitler de gelir");
    assert.equal(linked.canCollect, true);
    assert.equal((await admin.get(`/api/workspace/cases/${encodeURIComponent(rows[1].__hofKey)}/plans`)).data.data.plans.length, 0, "başka kayda bağlı değil");
    const list = (await admin.get(`/api/workspace/plans?status=all&caseKey=${encodeURIComponent(ali.__hofKey)}`)).data.data;
    assert.deepEqual(list.plans.map(item => item.id), [plan.id]);
    assert.equal(list.plans[0].caseTitle, "2026/1 · Ali Veli");
  });

  it("taksite girilen tahsilat taksitten düşer, Kasa'ya tek kayıt olarak iner, kişinin işlem geçmişinde görünür", async () => {
    const ali = rows.find(row => row["Dosya No"] === "2026/1");
    const second = plan.items[1];
    const paid = await staff.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "3.000", date: "2026-02-03", itemId: second.id, note: "Elden" });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    assert.equal(paid.data.data.items.find(item => item.id === second.id).remaining, 0, "2. taksit kapandı");
    assert.equal(paid.data.data.totals.remaining, 6000);
    const activity = (await admin.get(`/api/workspace/cases/${encodeURIComponent(ali.__hofKey)}/activity`)).data.data;
    const entry = activity.items.find(item => item.type === "plan-entry");
    assert.ok(entry, JSON.stringify(activity.items));
    assert.equal(entry.amount, 3000);
    assert.equal(entry.itemSeq, 2);
    assert.equal(entry.planName, "Ali Veli");
    assert.equal(entry.actorName, "Selin Kaya");
    assert.ok(entry.receiptNo >= 1, "makbuz numarası");
    assert.equal(activity.paidTotal, 3000, "toplam tahsilat kart hareketini içerir");
    assert.equal(activity.planPaid, 3000);
    const cash = (await admin.get("/api/workspace/cash?period=all")).data.data;
    const forAli = cash.entries.filter(item => item.amount === 3000);
    assert.equal(forAli.length, 1, "Kasa'da tek kayıt (çift kayıt yok)");
    assert.equal(forAli[0].source, "plan");
    // Kaydın kendi tahsilat tablosuna (payments) yazılmadı.
    assert.equal(server.app.store.get("SELECT COUNT(*) AS count FROM payments").count, 0);
  });

  it("vadesi geçen taksit uyarısı kaydın kimliğini taşır (bildirimden Kayda git)", async () => {
    const ali = rows.find(row => row["Dosya No"] === "2026/1");
    const dues = (await admin.get("/api/workspace/dues")).data.data;
    const item = dues.items.find(entry => entry.source === "plan" && entry.planId === plan.id);
    assert.ok(item, "geciken taksit takvimde");
    assert.equal(item.caseKey, ali.__hofKey);
    assert.equal(item.caseTitle, "2026/1 · Ali Veli");
  });

  it("bağ düzenlemeyle kaldırılır ve başka kayda taşınır; bağsız kartlar eskisi gibi", async () => {
    const ayse = rows.find(row => row["Dosya No"] === "2026/2");
    const moved = await admin.put(`/api/workspace/plans/${plan.id}`, { caseKey: ayse.__hofKey, caseTitle: "2026/2 · Ayşe Kaya" });
    assert.equal(moved.status, 200, JSON.stringify(moved.data));
    assert.equal(moved.data.data.caseKey, ayse.__hofKey);
    assert.equal((await admin.get(`/api/workspace/cases/${encodeURIComponent(ayse.__hofKey)}/plans`)).data.data.plans.length, 1);
    const unlinked = await admin.put(`/api/workspace/plans/${plan.id}`, { caseKey: "" });
    assert.equal(unlinked.data.data.caseKey, "");
    assert.equal(unlinked.data.data.caseTitle, "");
    assert.equal((await admin.get(`/api/workspace/cases/${encodeURIComponent(ayse.__hofKey)}/plans`)).data.data.plans.length, 0);
    const activity = (await admin.get(`/api/workspace/cases/${encodeURIComponent(ayse.__hofKey)}/activity`)).data.data;
    assert.ok(!activity.items.some(item => item.type === "plan-entry"), "bağ kalkınca hareketler geçmişte görünmez");
    assert.equal((await admin.put(`/api/workspace/plans/${plan.id}`, { name: "Ali Veli", total: "9.000" })).data.data.caseKey, "", "bağsız güncelleme bağ eklemez");
  });

  it("bağ yalnız açık veri oturumunda var olan kayda kurulur; kayıt yoksa 400 (yanlış anahtar başka kişiye gitmez)", async () => {
    const wrong = await admin.post("/api/workspace/plans", { name: "Hayalet", total: "1.000", caseKey: "2026/999", caseTitle: "Yok" });
    assert.equal(wrong.status, 400, JSON.stringify(wrong.data));
    assert.match(JSON.stringify(wrong.data), /bulunamadı/);
    assert.equal((await admin.put(`/api/workspace/plans/${plan.id}`, { caseKey: "satir:yok" })).status, 400);
    assert.equal((await admin.get(`/api/workspace/plans/${plan.id}`)).data.data.caseKey, "", "başarısız bağ denemesi kartı değiştirmez");
  });

  it("yetki: kayıt bağını yalnız kart yöneten kurar; personel kaydın kartlarını görür ve tahsilat girer", async () => {
    const ali = rows.find(row => row["Dosya No"] === "2026/1");
    assert.equal((await staff.put(`/api/workspace/plans/${plan.id}`, { caseKey: ali.__hofKey })).status, 403);
    assert.equal((await admin.put(`/api/workspace/plans/${plan.id}`, { caseKey: ali.__hofKey, caseTitle: "2026/1 · Ali Veli" })).status, 200);
    const linked = (await staff.get(`/api/workspace/cases/${encodeURIComponent(ali.__hofKey)}/plans`)).data.data;
    assert.equal(linked.plans.length, 1);
    assert.equal(linked.canManage, false);
    assert.equal((await staff.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", date: "2026-03-01" })).status, 200);
  });

  // v2.0.7: kişi bir kez girilir — kayıt ↔ cari ↔ taksit bütünlüğü.
  it("yeni kayıt için cari: kayda bağlı cari yoksa açılır; aynı ad + telefonlu bağsız cari varsa bağlanır; ikinci istek aynı cariyi döner", async () => {
    const ayse = rows.find(row => row["Dosya No"] === "2026/2");
    const url = `/api/workspace/cases/${encodeURIComponent(ayse.__hofKey)}/account`;
    // Önce bağsız bir cari açılmış olsun (kullanıcının yaptığı gibi): aynı ad + aynı telefon.
    const loose = (await admin.post("/api/workspace/accounts", { name: "Ayşe Kaya", phone: "0532 222 22 22" })).data.data;
    const linked = await admin.post(url, { name: "Ayşe Kaya", phone: "0532 222 22 22", caseTitle: "2026/2 · Ayşe Kaya" });
    assert.equal(linked.status, 200, JSON.stringify(linked.data));
    assert.equal(linked.data.data.outcome, "linked");
    assert.equal(linked.data.data.id, loose.id, "yeni cari açılmaz, mevcut cari kayda bağlanır");
    assert.equal(linked.data.data.caseKey, ayse.__hofKey);
    const again = (await admin.post(url, { name: "Ayşe Kaya", phone: "" })).data.data;
    assert.equal(again.outcome, "existing");
    assert.equal(again.id, loose.id);
    // Adı olmayan istek reddedilir; personel açamaz.
    assert.equal((await admin.post(url, { name: "" })).status, 400);
    assert.equal((await staff.post(url, { name: "Ayşe Kaya" })).status, 403);
    // Bağsız cari yoksa yeni cari kayda bağlı açılır.
    const fresh = (await admin.post(`/api/workspace/cases/${encodeURIComponent(rows[0].__hofKey)}/account`, { name: "Ali Veli", phone: "0532 111 11 11", caseTitle: "2026/1 · Ali Veli" })).data.data;
    assert.ok(["created", "existing"].includes(fresh.outcome));
    assert.equal(fresh.caseKey, rows[0].__hofKey);
    assert.equal((await admin.get(`/api/workspace/cases/${encodeURIComponent(rows[0].__hofKey)}/account`)).data.data.account.id, fresh.id);
  });

  it("bir kayda ikinci cari bağlanmaz (409); taksit kartı carisiz açılınca aynı ad + telefonlu cari bulunur, boşa cari açılmaz", async () => {
    const ayse = rows.find(row => row["Dosya No"] === "2026/2");
    const other = await admin.post("/api/workspace/accounts", { name: "Başka Kişi", caseKey: ayse.__hofKey, caseTitle: "2026/2" });
    assert.equal(other.status, 409, JSON.stringify(other.data));
    assert.match(other.data.error, /zaten .* carisi bağlı/);
    const before = (await admin.get("/api/workspace/accounts?status=all")).data.data.accounts.length;
    const linkedAccount = (await admin.get(`/api/workspace/cases/${encodeURIComponent(ayse.__hofKey)}/account`)).data.data.account;
    const plan2 = (await admin.post("/api/workspace/plans", { name: "Ayşe Kaya", phone: "0532 222 22 22", total: "4.500" })).data.data;
    assert.equal(plan2.accountId, linkedAccount.id, "cari seçilmese de aynı ad + telefonlu cari kullanılır");
    assert.equal((await admin.get("/api/workspace/accounts?status=all")).data.data.accounts.length, before, "yeni cari açılmadı");
    // Telefonu farklı aynı ad: başka kişi olabilir; yeni cari açılır (yanlış deftere yazılmaz).
    const plan3 = (await admin.post("/api/workspace/plans", { name: "Ayşe Kaya", phone: "0555 999 99 99", total: "100" })).data.data;
    assert.notEqual(plan3.accountId, linkedAccount.id);
  });
});
