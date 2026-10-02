// Çoklu şirket 2.0.17 (CLAUDE.md madde 2, 3, 6, 13): her şirket ayrı veri tabanı; ortak katman lisans/kullanıcı/şirket listesi.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async (url, body) => unwrap(await client.raw("DELETE", url, { body: body ? JSON.stringify(body) : undefined, headers: body ? { "content-type": "application/json" } : {} })),
});
const today = new Date().toISOString().slice(0, 10);

describe("Çoklu şirket: ayrı veri, ortak lisans/kullanıcı; göç, yetki, sıfırlama, birleşik rapor, silme", () => {
  let server;
  let admin;
  let api;
  let second; // 002
  let staffApi;
  let aliRoot; // 001'deki Ali Veli

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    api = apiOf(admin);
    // Mevcut veri (göç provası): 001'de cari + Kasa açılışı + tahsilat.
    aliRoot = (await api.post("/api/workspace/accounts", { name: "Ali Veli", type: "customer" })).data.id;
    assert.equal((await api.post("/api/workspace/cash", { kind: "in", amount: 1000, date: today, description: "Açılış" })).status, 200);
    assert.equal((await api.post(`/api/workspace/accounts/${aliRoot}/entries`, { kind: "debt", amount: 500, date: today, description: "Borç" })).status, 200);
  });
  after(() => server.close());

  test("göç: mevcut veri 001 kodlu ilk şirkettir, sayılar aynı; /api/auth/me şirketi söyler", async () => {
    const list = (await api.get("/api/companies")).data;
    assert.equal(list.companies.length, 1);
    assert.deepEqual([list.companies[0].code, list.companies[0].root, list.companies[0].current], ["001", true, true]);
    assert.equal(list.canManage, true);
    assert.equal(list.nextCode, "002");
    assert.ok(existsSync(path.join(server.dataDir, "sirketler.json")), "kayıt defteri yazıldı");
    const me = (await api.get("/api/auth/me")).data;
    assert.equal(me.company?.code, "001");
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 1000);
  });

  test("yeni şirket 002: sıfırdan; aynı adlı cari iki şirkette; birinde tahsilat öbürünü değiştirmez", async () => {
    const created = await api.post("/api/companies", { name: "İkinci Şirket", select: true });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    second = created.data.company;
    assert.deepEqual([second.code, second.current], ["002", true]);
    assert.ok(existsSync(path.join(server.dataDir, "sirketler", "002")), "002'nin veri klasörü açıldı");
    // 002'de hiçbir şey yok.
    assert.equal((await api.get("/api/workspace/accounts")).data.accounts.length, 0);
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 0);
    // Aynı adlı cari 002'de açılır (çift cari koruması şirket içinde çalışır, şirketler arası değil).
    const ali2 = (await api.post("/api/workspace/accounts", { name: "Ali Veli", type: "customer" })).data;
    assert.ok(ali2.id && ali2.id !== aliRoot);
    assert.equal((await api.post("/api/workspace/cash", { kind: "in", amount: 250, date: today, description: "002 tahsilat" })).status, 200);
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 250);
    // 001'e dön: Kasa 1.000, Ali Veli'nin bakiyesi 500 — 002'deki hareket karışmadı.
    assert.equal((await api.post("/api/companies/select", { id: "sirket-001" })).status, 200);
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 1000);
    const ali = (await api.get(`/api/workspace/accounts/${aliRoot}`)).data;
    assert.equal(ali.totals.balance, 500);
    assert.equal((await api.get("/api/workspace/accounts")).data.accounts.length, 1);
  });

  test("sayfalar şirkete aittir: 001'de sayfa adı değişir, 002'de görünmez", async () => {
    assert.equal((await api.post("/api/workspace/sessions/rename", { key: "dataset://ofis", name: "Birinci Sayfa" })).status, 200);
    assert.equal((await api.get("/api/workspace/sessions")).data.sessions[0].name, "Birinci Sayfa");
    await api.post("/api/companies/select", { id: second.id });
    assert.notEqual((await api.get("/api/workspace/sessions")).data.sessions[0].name, "Birinci Sayfa");
    await api.post("/api/companies/select", { id: "sirket-001" });
  });

  test("yetki: personel yetkisiz şirketi göremez/seçemez (403); yönetici yetki verince seçer; yönetici daraltılamaz", async () => {
    // Personel: Kasa görme yetkisi eklenir (veri yalıtımı Kasa toplamıyla kanıtlanır).
    const created = await admin.post("/api/admin/users", { username: "personel1", name: "Personel Bir", role: "personel", password: "Personel-2026!", mustChangePassword: false, grants: { add: ["cash.view"], remove: [] } });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const staff = server.client();
    assert.equal((await staff.login("personel1", "Personel-2026!")).status, 200);
    staffApi = apiOf(staff);
    const seen = (await staffApi.get("/api/companies")).data;
    assert.deepEqual(seen.companies.map(item => item.code), ["001"]);
    assert.equal(seen.canManage, false);
    assert.equal((await staffApi.post("/api/companies/select", { id: second.id })).status, 403);
    const staffId = (await staffApi.get("/api/auth/me")).data.id;
    assert.equal((await api.put(`/api/companies/access/${staffId}`, { companies: ["sirket-001", second.id] })).status, 200);
    assert.deepEqual((await staffApi.get("/api/companies")).data.companies.map(item => item.code), ["001", "002"]);
    assert.equal((await staffApi.post("/api/companies/select", { id: second.id })).status, 200);
    // Personel 002'de: Kasa 250 (002'nin), 001'in 1.000'i değil.
    assert.equal((await staffApi.get("/api/workspace/cash")).data.totals.balance, 250);
    // Yöneticinin yetkisi daraltılamaz.
    const adminId = (await api.get("/api/auth/me")).data.id;
    assert.equal((await api.put(`/api/companies/access/${adminId}`, { companies: ["sirket-001"] })).status, 409);
    // Yetki geri alınınca personel ilk şirkete döner.
    assert.equal((await api.put(`/api/companies/access/${staffId}`, { companies: ["sirket-001"] })).status, 200);
    assert.equal((await staffApi.get("/api/auth/me")).data.company.code, "001");
    assert.equal((await staffApi.get("/api/workspace/cash")).data.totals.balance, 1000);
  });

  test("şirket kodu/adı değişir; kod tekil ve üç hane; 001 silinemez", async () => {
    assert.equal((await api.put(`/api/companies/${second.id}`, { code: "001" })).status, 409);
    assert.equal((await api.put(`/api/companies/${second.id}`, { code: "7" })).status, 400);
    const renamed = await api.put(`/api/companies/${second.id}`, { code: "005", name: "Gayri Resmi" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.data.company.label, "005 · Gayri Resmi");
    // Kod değişse de veri aynı şirkette (002 klasörü yerinde, Kasa 250).
    await api.post("/api/companies/select", { id: second.id });
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 250);
    await api.post("/api/companies/select", { id: "sirket-001" });
    assert.equal((await api.del("/api/companies/sirket-001", { confirm: "001", password: ADMIN_PASSWORD })).status, 409);
  });

  test("birleşik rapor: seçilen şirketler yan yana + toplam; PDF ve Excel iner; yetkisiz şirket rapora girmez", async () => {
    const report = (await api.get("/api/companies/report")).data;
    assert.equal(report.rows.length, 2);
    const byCode = Object.fromEntries(report.rows.map(row => [row.code, row]));
    assert.equal(byCode["001"].cash, 1000);
    assert.equal(byCode["005"].cash, 250);
    assert.equal(byCode["001"].receivable, 500);
    assert.equal(report.totals[1], 1250);
    assert.equal(report.table[0][0], "001 · Şirket 1");
    const pdf = await admin.raw("GET", `/api/companies/report.pdf?ids=${second.id}`);
    assert.equal(pdf.status, 200);
    assert.ok(pdf.buffer.subarray(0, 4).toString() === "%PDF");
    const xlsx = await admin.raw("GET", "/api/companies/report.xlsx");
    assert.equal(xlsx.status, 200);
    assert.ok(xlsx.buffer.length > 1000);
    // Personel yalnız yetkili olduğu şirketi görür.
    const staffReport = (await staffApi.get(`/api/companies/report?ids=${second.id},sirket-001`)).data;
    assert.deepEqual(staffReport.rows.map(row => row.code), ["001"]);
  });

  test("şirket verisini sıfırla: zorunlu yedek, onay (kod + parola); hareketler silinir, kartlar kalır; lisans ve öbür şirket aynı; kullanıcı girer", async () => {
    assert.equal((await api.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: "yanlış", password: ADMIN_PASSWORD })).status, 400);
    assert.equal((await api.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: "005", password: "yanlış" })).status, 403);
    const licenseBefore = (await api.get("/api/license")).data;
    const reset = await api.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: "005", password: ADMIN_PASSWORD });
    assert.equal(reset.status, 200, JSON.stringify(reset.data));
    assert.match(reset.data.backup, /sifirlama-oncesi-005/);
    assert.ok(existsSync(path.join(server.backupDir, "sirket-002", reset.data.backup)), "yedek şirketin kendi klasöründe");
    await api.post("/api/companies/select", { id: second.id });
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 0);
    assert.equal((await api.get("/api/workspace/accounts")).data.accounts.length, 1, "cari kartı kalır, bakiyesi sıfır");
    assert.equal((await api.get("/api/workspace/accounts")).data.accounts[0].totals?.balance ?? 0, 0);
    await api.post("/api/companies/select", { id: "sirket-001" });
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 1000, "001 etkilenmedi");
    assert.deepEqual((await api.get("/api/license")).data.status, licenseBefore.status, "lisans aynı");
    const again = server.client();
    assert.equal((await again.login("personel1", "Personel-2026!")).status, 200, "kullanıcılar giriş yapar");
    // Tümünü sıfırla: kartlar da gider; şirket adı/kodu kalır.
    const all = await api.post(`/api/companies/${second.id}/reset`, { mode: "all", confirm: "Gayri Resmi", password: ADMIN_PASSWORD });
    assert.equal(all.status, 200);
    await api.post("/api/companies/select", { id: second.id });
    assert.equal((await api.get("/api/workspace/accounts")).data.accounts.length, 0);
    assert.equal((await api.get("/api/companies")).data.companies.find(item => item.id === second.id).label, "005 · Gayri Resmi");
    await api.post("/api/companies/select", { id: "sirket-001" });
  });

  test("şirket silme: onay + parola, önce yedek, klasör silinen-sirketler altına; seçmiş kullanıcılar 001'e döner", async () => {
    await api.post("/api/companies/select", { id: second.id });
    assert.equal((await api.del(`/api/companies/${second.id}`, { confirm: "005", password: "yanlış" })).status, 403);
    const removed = await api.del(`/api/companies/${second.id}`, { confirm: "005", password: ADMIN_PASSWORD });
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    assert.ok(removed.data.backup);
    const archive = path.join(server.dataDir, "silinen-sirketler");
    assert.ok(existsSync(archive) && readdirSync(archive).some(name => name.startsWith("005-")), "klasör arşive taşındı");
    assert.ok(!existsSync(path.join(server.dataDir, "sirketler", "002")));
    const list = (await api.get("/api/companies")).data;
    assert.deepEqual(list.companies.map(item => item.code), ["001"]);
    assert.equal(list.current, "sirket-001");
    assert.equal((await api.get("/api/workspace/cash")).data.totals.balance, 1000);
  });
});

describe("Sayfalar (madde 13): öbür sayfanın tarih uyarıları zile/takvime girer; Ödendi Say o sayfaya yazılır", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer();
    api = apiOf(await loginAdmin(server));
  });
  after(() => server.close());

  test("ikinci sayfadaki yarın vadeli kalem, ilk sayfa açıkken /api/workspace/dues içinde sayfa adıyla (foreign) gelir", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const due = `${String(tomorrow.getDate()).padStart(2, "0")}.${String(tomorrow.getMonth() + 1).padStart(2, "0")}.${tomorrow.getFullYear()}`;
    // İlk sayfaya vadesiz bir tablo (boş ilk sayfa listede görünmez); ikinci sayfaya yarın vadeli kalem.
    const first0 = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "ilk.xlsx", sheets: [{ name: "Rehber", matrix: [["Müşteri", "Telefon"], ["Ali Veli", "0532 000 00 00"]] }] });
    assert.equal(first0.status, 200, JSON.stringify(first0.data));
    assert.equal((await api.post("/api/workspace/dataset/commit", { stageId: first0.data.stageId, mode: "replace" })).status, 200);
    const matrix = [["Müşteri", "Telefon", "Vade", "Tutar"], ["Ayşe Kaya", "0532 000 00 01", due, "1.250,00"]];
    const staged = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "ikinci.xlsx", sheets: [{ name: "Taksitler", matrix }] });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    const committed = await api.post("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "session", name: "İkinci Sayfa" });
    assert.equal(committed.status, 200, JSON.stringify(committed.data));
    assert.equal(committed.data.mode, "session");
    const pages = (await api.get("/api/workspace/sessions")).data;
    assert.equal(pages.sessions.length, 2);
    // Açık sayfa: yeni açılan (İkinci Sayfa). Kalem kendi sayfasında doğrudan görünür.
    const own = (await api.get("/api/workspace/dues")).data;
    assert.ok(own.items.some(item => item.person === "Ayşe Kaya" && !item.foreign), "kendi sayfasında kalem var");
    // İlk sayfaya geç: kalem artık "foreign" ve sayfa adıyla gelir.
    assert.equal((await api.post("/api/workspace/sessions/select", { key: "dataset://ofis" })).status, 200);
    const first = (await api.get("/api/workspace/dues")).data;
    const foreign = first.items.find(item => item.person === "Ayşe Kaya");
    assert.ok(foreign, "öbür sayfanın kalemi ilk sayfada da listelenir");
    assert.equal(foreign.foreign, true);
    assert.equal(foreign.pageName, "İkinci Sayfa");
    assert.ok(foreign.session && foreign.session !== "dataset://ofis");
    // Ödendi Say: ilk sayfadayken öbür sayfanın kalemini kapatır; kalem iki sayfadan da düşer; geri alınır.
    assert.equal((await api.post("/api/workspace/dues/settle", { id: foreign.id, reason: "paid", session: foreign.session })).status, 200);
    assert.ok(!(await api.get("/api/workspace/dues")).data.items.some(item => item.person === "Ayşe Kaya"), "kapatılan kalem ilk sayfada düştü");
    await api.post("/api/workspace/sessions/select", { key: foreign.session });
    assert.ok(!(await api.get("/api/workspace/dues")).data.items.some(item => item.person === "Ayşe Kaya"), "kendi sayfasında da düştü");
    assert.equal((await api.post("/api/workspace/dues/settle", { id: foreign.id, undo: true })).status, 200);
    assert.ok((await api.get("/api/workspace/dues")).data.items.some(item => item.person === "Ayşe Kaya"), "geri alınınca döner");
  });
});
