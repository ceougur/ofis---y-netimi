// Veri oturumları (v2.0.1): farklı konudaki dosya yeni oturumda açılır, veriler karışmaz, herkes kendi oturumunu seçer.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const emlak = [
  ["İlan No", "İlçe", "Fiyat", "Danışman"],
  ["EM-1", "Kadıköy", "4.000.000 TL", "Ayşe"],
  ["EM-2", "Beşiktaş", "6.500.000 TL", "Mehmet"],
  ["EM-3", "Çankaya", "3.200.000 TL", "Ayşe"],
];
const taksit = [
  ["Müşteri No", "Müşteri", "Tutar", "Taksit 1", "Kalan"],
  ["M-1", "Ali Veli", "20.000,00 ₺", "5.000,00 ₺", "15.000,00 ₺"],
  ["M-2", "Ayşe Kara", "12.000,00 ₺", "4.000,00 ₺", "8.000,00 ₺"],
  ["M-3", "Can Er", "9.000,00 ₺", "", "9.000,00 ₺"],
];

describe("veri oturumları", () => {
  let server;
  let admin;
  let staff;
  const rowsOf = async client => {
    const response = await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`);
    return (response.data.result?.data?.json ?? response.data.result?.data).rows;
  };
  const stage = (fileName, matrix) => admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName, sheets: [{ name: "Sayfa1", matrix }] });

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "deniz", name: "Deniz Ak", role: "personel" });
    const first = await stage("portfoy.xlsx", emlak);
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: first.data.data.stageId, mode: "replace" })).status, 200);
  });
  after(() => server.close());

  it("farklı konudaki dosya için yeni oturum önerilir; aynı konudaki için önerilmez", async () => {
    const other = await stage("taksitler.xlsx", taksit);
    assert.equal(other.data.data.differentTopic, true);
    assert.equal(other.data.data.hasData, true);
    const same = await stage("portfoy-ekim.xlsx", emlak);
    assert.equal(same.data.data.differentTopic, false);
  });

  it("yeni oturum kullanıcının verdiği adla açılır; açan kişi yeni oturuma geçer, diğerlerinin ekranı değişmez", async () => {
    const staged = await stage("taksitler.xlsx", taksit);
    const opened = await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "session", name: "Taksit takibi" });
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
    assert.equal(opened.data.data.mode, "session");
    assert.equal(opened.data.data.session.name, "Taksit takibi");

    const adminRows = await rowsOf(admin);
    assert.deepEqual(adminRows.map(row => row["Müşteri"]), ["Ali Veli", "Ayşe Kara", "Can Er"], "yönetici yalnızca yeni oturumu görür");
    assert.ok(adminRows.every(row => !("İlçe" in row)), "eski oturumun kolonları karışmaz");
    const staffRows = await rowsOf(staff);
    assert.deepEqual(staffRows.map(row => row["İlan No"]), ["EM-1", "EM-2", "EM-3"], "personel kendi oturumunda kalır");

    const list = (await staff.get("/api/workspace/sessions")).data.data;
    assert.deepEqual(list.sessions.map(item => item.name), ["portfoy.xlsx", "Taksit takibi"]);
    assert.equal(list.sessions.find(item => item.current).name, "portfoy.xlsx");
    assert.equal(list.canManage, false);
  });

  it("oturumların düzeltmeleri, yeni kayıtları ve sektörü birbirinden ayrıdır", async () => {
    const [ali] = await rowsOf(admin);
    assert.equal((await admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: ali.__hofKey, field: "Kalan", value: "1.000,00 ₺" })).status, 200);
    assert.equal((await admin.post("/api/workspace/records", { sourceName: "dataset://ofis", values: { "Müşteri No": "M-9", "Müşteri": "Yeni Müşteri" } })).status, 200);
    assert.equal((await admin.post("/api/workspace/insight/sector", { sectorId: "finans-tahsilat" })).status, 200);

    const adminRows = await rowsOf(admin);
    assert.equal(adminRows.find(row => row["Müşteri"] === "Ali Veli").Kalan, "1.000,00 ₺");
    assert.ok(adminRows.some(row => row["Müşteri"] === "Yeni Müşteri"));
    const staffRows = await rowsOf(staff);
    assert.equal(staffRows.length, 3, "ilk oturuma yeni kayıt eklenmez");
    const adminProfile = (await admin.get("/api/workspace/profile")).data.data;
    const staffProfile = (await staff.get("/api/workspace/profile")).data.data;
    assert.equal(adminProfile.sector.id, "finans-tahsilat");
    assert.notEqual(staffProfile.sector.id, "finans-tahsilat", "sektör oturuma özeldir");
  });

  it("kullanıcı oturumlar arasında geçer", async () => {
    const list = (await staff.get("/api/workspace/sessions")).data.data.sessions;
    const target = list.find(item => item.name === "Taksit takibi");
    assert.equal((await staff.post("/api/workspace/sessions/select", { key: target.key })).status, 200);
    assert.ok((await rowsOf(staff)).some(row => row["Müşteri"] === "Ali Veli"));
    const back = list.find(item => item.name === "portfoy.xlsx");
    await staff.post("/api/workspace/sessions/select", { key: back.key });
    assert.ok((await rowsOf(staff)).some(row => row["İlan No"] === "EM-1"));
    assert.equal((await staff.post("/api/workspace/sessions/select", { key: "dataset://oturum-yok" })).status, 404);
  });

  it("oturum adı değiştirilir (yalnızca veri yöneticisi); oturum silinince seçili olanlar ilk oturuma döner", async () => {
    const list = (await admin.get("/api/workspace/sessions")).data.data.sessions;
    const target = list.find(item => item.name === "Taksit takibi");
    assert.equal((await staff.post("/api/workspace/sessions/rename", { key: target.key, name: "X" })).status, 403);
    assert.equal((await admin.post("/api/workspace/sessions/rename", { key: target.key, name: "Taksitler 2026" })).status, 200);
    assert.equal((await admin.post("/api/workspace/sessions/rename", { key: target.key, name: "  " })).status, 400);
    assert.ok((await admin.get("/api/workspace/sessions")).data.data.sessions.some(item => item.name === "Taksitler 2026"));

    await staff.post("/api/workspace/sessions/select", { key: target.key });
    const removed = await admin.post("/api/workspace/sessions/delete", { key: target.key });
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    assert.ok(removed.data.data.backupName, "silmeden önce yedek");
    assert.deepEqual((await rowsOf(staff)).map(row => row["İlan No"]), ["EM-1", "EM-2", "EM-3"], "silinen oturumdaki kullanıcı ilk oturuma döner");
    assert.deepEqual((await admin.get("/api/workspace/sessions")).data.data.sessions.map(item => item.name), ["portfoy.xlsx"]);
    const leftovers = server.app.store.get("SELECT (SELECT COUNT(*) FROM dataset_rows WHERE dataset_key = ?) + (SELECT COUNT(*) FROM records WHERE source_name = ?) + (SELECT COUNT(*) FROM overrides WHERE source_name = ?) AS count", target.key, target.key, target.key).count;
    assert.equal(leftovers, 0);
    assert.equal((await admin.post("/api/workspace/sessions/delete", { key: "dataset://ofis" })).status, 400, "ilk oturum silinmez");
  });

  it("kullanıcılar, personel, görevler ve yönetim ayarları oturumdan bağımsızdır; oturum silinince de kalır", async () => {
    const users = async () => (await admin.get("/api/admin/users")).data.data.map(item => `${item.username}:${item.role}:${item.active}`);
    const tasks = async client => (await client.get("/api/workspace/tasks?status=open&mine=1")).data.data.map(item => item.title);
    assert.equal((await admin.put("/api/admin/office", { name: "Deneme Ofisi" })).status, 200);
    assert.equal((await admin.post("/api/workspace/tasks", { title: "Oturumdan bağımsız görev", assignee: "Deniz Ak" })).status, 200);
    const before = { users: await users(), tasks: await tasks(staff), office: (await admin.get("/api/admin/office")).data.data.name };
    assert.ok(before.users.some(item => item.startsWith("deniz:personel")));

    const staged = await stage("personel-denemesi.xlsx", taksit);
    const opened = await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "session", name: "Personel denemesi" });
    assert.equal(opened.status, 200);
    await staff.post("/api/workspace/sessions/select", { key: opened.data.data.session.key });
    assert.deepEqual(await users(), before.users, "kullanıcı listesi oturumla değişmez");
    assert.deepEqual(await tasks(staff), before.tasks, "görevler oturumla değişmez");
    assert.equal((await admin.get("/api/admin/office")).data.data.name, before.office);
    const later = await createUser(server, admin, { username: "ece", name: "Ece Su", role: "personel" });
    assert.equal((await later.get("/api/workspace/sessions")).status, 200, "yeni oturumdayken eklenen personel giriş yapar");

    assert.equal((await admin.post("/api/workspace/sessions/delete", { key: opened.data.data.session.key })).status, 200);
    assert.deepEqual((await users()).filter(item => !item.startsWith("ece:")), before.users, "oturum silinince kullanıcılar silinmez");
    assert.ok((await users()).some(item => item.startsWith("ece:personel")));
    assert.deepEqual(await tasks(staff), before.tasks, "oturum silinince görevler silinmez");
    assert.equal((await staff.get("/api/auth/me")).status, 200, "personelin oturumu açık kalır");
  });

  it("kasa tüm oturumlarda ortaktır; oturum değişince ya da silinince sıfırlanmaz", async () => {
    const cash = async () => (await admin.get("/api/workspace/cash?from=2026-01-01&to=2026-12-31")).data.data;
    const staged = await stage("kasa-oturumu.xlsx", taksit);
    const opened = await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "session", name: "Kasa denemesi" });
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
    const [first] = await rowsOf(admin);
    assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(first.__hofKey)}/payments`, { amount: "2.500", date: "2026-09-10", note: "Havale", caseTitle: first["Müşteri"] })).status, 200);
    assert.equal((await admin.post("/api/workspace/cash", { kind: "out", amount: "400", date: "2026-09-11", description: "Kırtasiye" })).status, 200);
    const inSession = await cash();
    assert.equal(inSession.totals.in, 2500);
    assert.equal(inSession.totals.out, 400);

    await admin.post("/api/workspace/sessions/select", { key: "dataset://ofis" });
    assert.ok((await rowsOf(admin)).some(row => row["İlan No"] === "EM-1"), "başka oturuma geçildi");
    assert.deepEqual((await cash()).totals, inSession.totals, "oturum değişince kasa aynı kalır");

    assert.equal((await admin.post("/api/workspace/sessions/delete", { key: opened.data.data.session.key })).status, 200);
    assert.deepEqual((await cash()).totals, inSession.totals, "oturum silinince kasa hareketleri silinmez");
  });
});
