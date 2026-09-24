// Ad çakışması koruması, adla kişi bulma ve görevlerin kişiye kimliğiyle bağlanması.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { foldName } from "../server/lib/names.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("ad karşılaştırma", () => {
  it("Türkçe büyük/küçük harf, boşluk ve Unicode yazım farklarını yok sayar", () => {
    assert.equal(foldName("  AYŞE   NUR "), "ayşe nur");
    assert.equal(foldName("İPEK"), foldName("ipek"));
    assert.equal(foldName("İsim"), foldName("İsim".normalize("NFD")));
    assert.equal(foldName(null), "");
  });
});

describe("ad çakışması ve görev sahipliği", () => {
  let server;
  let admin;
  let avukat;
  let deniz;
  let ece;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    avukat = await createUser(server, admin, { username: "avukat1", name: "Av. Selin Ak", role: "avukat" });
    deniz = await createUser(server, admin, { username: "deniz", name: "Deniz Yılmaz", role: "personel" });
    ece = await createUser(server, admin, { username: "ece", name: "Ece Kara", role: "personel" });
  });
  after(() => server.close());

  it("personel adını başka bir kullanıcının adı veya kullanıcı adıyla değiştiremez", async () => {
    for (const name of ["Ofis yöneticisi", "OFİS YÖNETİCİSİ", "  deniz   yılmaz ", "admin", "Avukat1"]) {
      const result = await ece.post("/api/workspace/profile", { name });
      assert.equal(result.status, 409, name);
      assert.match(result.data.error, /başka bir kullanıcıda kayıtlı/);
    }
    assert.equal((await ece.post("/api/workspace/profile", { name: "Ece  KARA" })).status, 200, "kendi adını düzeltebilir");
    assert.equal((await ece.post("/api/workspace/profile", { name: "Ece Kara" })).status, 200);
  });

  it("yönetici aynı adla ikinci hesap açamaz, adı çakışacak şekilde değiştiremez", async () => {
    const same = await admin.post("/api/admin/users", { username: "deniz2", name: "deniz YILMAZ", role: "personel", password: "Personel-2026!" });
    assert.equal(same.status, 409);
    const usernameLikeName = await admin.post("/api/admin/users", { username: "Ece.Kara", name: "Ece K.", role: "personel", password: "Personel-2026!" });
    assert.equal(usernameLikeName.status, 200, "farklı yazım serbest");
    const clash = await admin.post("/api/admin/users", { username: "selin", name: "Selin", role: "personel", password: "Personel-2026!" });
    assert.equal(clash.status, 200);
    const users = Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(user => [user.username, user.id]));
    assert.equal((await admin.patch(`/api/admin/users/${users.selin}`, { name: "Av. Selin Ak" })).status, 409);
    assert.equal((await admin.patch(`/api/admin/users/${users.selin}`, { name: "Selin Ö." })).status, 200);
    assert.equal((await admin.post("/api/admin/users", { username: "mehmet.k", name: "Mehmet", role: "personel", password: "Personel-2026!" })).status, 200);
    const nameAsUsername = await admin.post("/api/admin/users", { username: "MEHMET", name: "Mehmet Öz", role: "personel", password: "Personel-2026!" });
    assert.equal(nameAsUsername.status, 409, "kullanıcı adı başka birinin görünen adıyla aynı olamaz");
    assert.match(nameAsUsername.data.error, /görünen adıyla aynı/);
  });

  it("görev kişiye kimliğiyle bağlanır: ad değişse de kişide kalır, adı alan başkası göremez", async () => {
    const created = await avukat.post("/api/workspace/tasks", { title: "Tebligatı takip et", assignee: "deniz" });
    assert.equal(created.status, 200);
    const task = server.app.store.get("SELECT assignee, assignee_id FROM tasks WHERE id = ?", created.data.data.id);
    assert.equal(task.assignee, "Deniz Yılmaz", "kullanıcı adıyla yazılsa da kişinin adı saklanır");
    assert.match(task.assignee_id, /^user-/);
    const titles = async client => (await client.get("/api/workspace/tasks?status=open")).data.data.map(item => item.title);
    assert.ok((await titles(deniz)).includes("Tebligatı takip et"));
    // Deniz adını değiştirir: görev yine onda, liste güncel adı gösterir.
    assert.equal((await deniz.post("/api/workspace/profile", { name: "Deniz Y. Kaya" })).status, 200);
    const mine = (await deniz.get("/api/workspace/tasks?mine=1")).data.data;
    assert.deepEqual(mine.map(item => [item.title, item.assignee]), [["Tebligatı takip et", "Deniz Y. Kaya"]]);
    // Ece boşalan eski adı alır: görevi göremez, tamamlayamaz.
    assert.equal((await ece.post("/api/workspace/profile", { name: "Deniz Yılmaz" })).status, 200);
    assert.ok(!(await titles(ece)).includes("Tebligatı takip et"));
    assert.equal((await ece.post(`/api/workspace/tasks/${created.data.data.id}/complete`)).status, 404);
    await ece.post("/api/workspace/profile", { name: "Ece Kara" });
  });

  it("kişiye bağlanamayan serbest adlı görev ad eşleşmesiyle görünür", async () => {
    const created = await avukat.post("/api/workspace/tasks", { title: "Stajyer için dosya taraması", assignee: "Stajyer Mert" });
    assert.equal(server.app.store.get("SELECT assignee_id FROM tasks WHERE id = ?", created.data.data.id).assignee_id, null);
    const mert = await createUser(server, admin, { username: "mert", name: "Stajyer Mert", role: "personel" });
    const titles = (await mert.get("/api/workspace/tasks?status=open")).data.data.map(item => item.title);
    assert.ok(titles.includes("Stajyer için dosya taraması"));
  });
});

describe("1.4.0 göçü: belirsiz adlar ve görev bağlama", () => {
  let server;
  before(async () => {
    server = await startTestServer({
      prepare: ({ dataDir }) => {
        // 1.3.x şemasında (sürüm 2) aynı görünen adlı iki hesap ve bunlara yazılmış eski mesaj/görevler.
        mkdirSync(dataDir, { recursive: true });
        const db = openDatabase(path.join(dataDir, "hukuk-ofisi.sqlite"));
        const store = createStore(db);
        for (const migration of MIGRATIONS.filter(item => item.version <= 2)) {
          migration.up(store);
          store.exec(`PRAGMA user_version = ${migration.version}`);
        }
        const at = "2026-09-01T09:00:00.000Z";
        const user = (id, username, name, active = 1) => store.run("INSERT INTO users (id, username, display_name, role, password_hash, active, created_at, updated_at) VALUES (?, ?, ?, 'personel', 'x', ?, ?, ?)", id, username, name, active, at, at);
        user("user-a", "ali1", "Ali Kaya");
        user("user-b", "ali2", "ALİ KAYA");
        user("user-c", "ipek", "İpek Su");
        user("user-d", "eski", "Eski Personel", 0);
        user("user-e", "yeni", "Eski Personel");
        const message = (id, from, to, text) => store.run("INSERT INTO messages (id, recipient, message, case_key, created_by, created_at) VALUES (?, ?, ?, '', ?, ?)", id, to, text, from, at);
        message("m1", "user-c", "ali kaya", "Belirsiz alıcı");
        message("m2", "user-a", "İPEK SU", "İpek'e özel");
        message("m3", "user-a", "ali1", "Kendine not");
        message("m4", "user-c", "Eski Personel", "Aktif olana gider");
        const task = (id, assignee) => store.run("INSERT INTO tasks (id, title, case_key, assignee, due_date, priority, status, created_by, created_at) VALUES (?, ?, '', ?, '', 'normal', 'open', 'user-c', ?)", id, `Görev ${id}`, assignee, at);
        task("t1", "Ali Kaya");
        task("t2", "ipek su");
        task("t3", "Kimsenin adı");
        task("t4", "eski personel");
        db.close();
      },
    });
  });
  after(() => server.close());

  it("göç hatasız biter; belirsiz alıcı ofis kanalına, tek eşleşme özel yazışmaya gider", () => {
    const { store } = server.app;
    assert.deepEqual(server.app.migration.applied, [3, 4]);
    const where = id => ({ ...store.get("SELECT c.kind, m.body FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id WHERE m.id = ?", `chat-${id}`) });
    assert.deepEqual(where("m1"), { kind: "office", body: "→ ali kaya: Belirsiz alıcı" });
    assert.equal(where("m2").kind, "direct");
    const members = store.all("SELECT user_id FROM chat_members m JOIN chat_messages x ON x.conversation_id = m.conversation_id WHERE x.id = 'chat-m2' ORDER BY user_id").map(row => row.user_id);
    assert.deepEqual(members, ["user-a", "user-c"]);
    assert.equal(where("m3").kind, "office", "kendine yazılan mesaj ofis kanalında kalır");
    const m4 = store.all("SELECT user_id FROM chat_members m JOIN chat_messages x ON x.conversation_id = m.conversation_id WHERE x.id = 'chat-m4' ORDER BY user_id").map(row => row.user_id);
    assert.deepEqual(m4, ["user-c", "user-e"], "aynı adlı pasif ve aktif hesaptan aktif olan seçilir");
  });

  it("görevler tek eşleşen kişiye bağlanır; belirsiz ve serbest adlar bağlanmaz", () => {
    const ids = Object.fromEntries(server.app.store.all("SELECT id, assignee_id FROM tasks").map(row => [row.id, row.assignee_id]));
    assert.deepEqual(ids, { t1: null, t2: "user-c", t3: null, t4: "user-e" });
  });
});
