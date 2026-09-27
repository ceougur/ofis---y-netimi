// Sohbet: gün gün yükleme ve 30 günden eski mesajların arşive taşınması (v2.0.2).
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createChatArchive } from "../server/lib/chat-archive.mjs";
import { OFFICE_CONVERSATION } from "../server/lib/chat.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const HOUR = 3_600_000;
const ago = ms => new Date(Date.now() - ms).toISOString();

describe("sohbet geçmişi: gün gün ve arşiv", () => {
  let server;
  let admin;
  let ali;
  let ayse;
  let selin;
  let direct;
  let archive;
  const insert = (conversation, sender, body, at) => server.app.store.run("INSERT INTO chat_messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)", `m-${Math.random().toString(36).slice(2)}`, conversation, sender, body, at);
  const page = (client, id, before = "") => client.get(`/api/chat/conversations/${encodeURIComponent(id)}/messages?window=day${before ? `&before=${encodeURIComponent(before)}` : ""}`);

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    ali = await createUser(server, admin, { username: "ali", name: "Ali Kaya", role: "personel" });
    ayse = await createUser(server, admin, { username: "ayse", name: "Ayşe Nur", role: "avukat" });
    selin = await createUser(server, admin, { username: "selin", name: "Selin Er", role: "personel" });
    const users = Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(user => [user.username, user.id]));
    direct = (await ali.post("/api/chat/direct", { userId: users.ayse })).data.data.id;
    // Özel yazışma: şimdi, 30 saat, 3 gün, 40 ve 45 gün önce.
    insert(direct, users.ali, "bugün", ago(2 * HOUR));
    insert(direct, users.ayse, "dün akşam", ago(30 * HOUR));
    insert(direct, users.ali, "dün sabah", ago(34 * HOUR));
    insert(direct, users.ayse, "üç gün önce", ago(72 * HOUR));
    insert(direct, users.ali, "kırk gün önce\nikinci satır", ago(40 * 24 * HOUR));
    insert(direct, users.ayse, "kırk beş gün önce", ago(45 * 24 * HOUR));
    insert(OFFICE_CONVERSATION, users.ali, "ofise eski duyuru", ago(50 * 24 * HOUR));
    archive = createChatArchive({ store: server.app.store, dir: path.join(server.dataDir, "mesaj-arsivi") });
  });
  after(() => server.close());

  it("açılışta son 24 saat; her tıklamada mesajı olan bir önceki gün", async () => {
    let result = (await page(ali, direct)).data.data;
    assert.deepEqual(result.messages.map(item => item.body), ["bugün"]);
    assert.equal(result.hasMore, true);
    result = (await page(ali, direct, result.from)).data.data;
    assert.deepEqual(result.messages.map(item => item.body), ["dün sabah", "dün akşam"], "30 ve 34 saat önceki mesajlar aynı günde");
    result = (await page(ali, direct, result.from)).data.data;
    assert.deepEqual(result.messages.map(item => item.body), ["üç gün önce"], "boş gün atlanır");
    result = (await page(ali, direct, result.from)).data.data;
    assert.deepEqual(result.messages.map(item => item.body), ["kırk gün önce\nikinci satır"]);
    result = (await page(ali, direct, result.from)).data.data;
    assert.deepEqual(result.messages.map(item => item.body), ["kırk beş gün önce"]);
    assert.equal(result.hasMore, false);
    // Üçüncü kişi özel yazışmayı sayfalayamaz.
    assert.equal((await page(selin, direct)).status, 404);
  });

  it("30 günden eskiler dosyaya yazılıp silinir; ikinci çalıştırma tekrar yazmaz", async () => {
    const first = archive.run();
    assert.equal(first.archived, 3);
    const remaining = server.app.store.all("SELECT body FROM chat_messages WHERE conversation_id = ? ORDER BY created_at", direct).map(row => row.body);
    assert.deepEqual(remaining, ["üç gün önce", "dün sabah", "dün akşam", "bugün"]);
    const root = path.join(server.dataDir, "mesaj-arsivi");
    const folders = readdirSync(root).sort();
    assert.ok(folders.includes("Ofis geneli"));
    const privateFolder = folders.find(name => /^Ali Kaya - Ayşe Nur \[[0-9a-f]{4}\]$/.test(name));
    assert.ok(privateFolder, folders.join(", "));
    const files = readdirSync(path.join(root, privateFolder));
    assert.ok(files.every(name => /^\d{4}-\d{2} \S+\.txt$/.test(name)), files.join(", "));
    const text = files.map(name => readFileSync(path.join(root, privateFolder, name), "utf8")).join("\n");
    assert.match(text, /^﻿DestekOfis mesaj arşivi · Ali Kaya - Ayşe Nur · /);
    assert.match(text, /\d{2}\.\d{2}\.\d{4} \d{2}:\d{2} · Ali Kaya: kırk gün önce\r\n    ikinci satır/);
    assert.match(text, /Ayşe Nur: kırk beş gün önce/);
    const before = files.map(name => readFileSync(path.join(root, privateFolder, name), "utf8")).join("");
    assert.equal(archive.run().archived, 0);
    assert.equal(files.map(name => readFileSync(path.join(root, privateFolder, name), "utf8")).join(""), before, "aynı mesaj iki kez yazılmaz");
  });

  it("yarıda kalan tur (dosya yazıldı, mesaj silinmedi) tekrarlanınca mesaj ikinci kez yazılmaz", () => {
    const users = Object.fromEntries(server.app.store.all("SELECT id, username FROM users").map(row => [row.username, row.id]));
    const at = ago(60 * 24 * HOUR);
    insert(direct, users.ali, "yarıda kalan", at);
    archive.run();
    // Aynı mesaj silinmemiş gibi geri eklenir: dosyanın ilk satırındaki "son" zamanı onu zaten kapsar.
    insert(direct, users.ali, "yarıda kalan", at);
    assert.equal(archive.run().archived, 1, "silinir");
    const root = path.join(server.dataDir, "mesaj-arsivi");
    const folder = readdirSync(root).find(name => name.startsWith("Ali Kaya"));
    const all = readdirSync(path.join(root, folder)).map(name => readFileSync(path.join(root, folder, name), "utf8")).join("");
    assert.equal(all.split("yarıda kalan").length - 1, 1);
  });

  it("kişi kendi yazışmasının arşivini indirir; başkası indiremez; arşiv ay sayısı görünür", async () => {
    const result = (await page(ayse, direct)).data.data;
    assert.ok(result.archivedMonths >= 1);
    const file = await ayse.raw("GET", `/api/chat/conversations/${encodeURIComponent(direct)}/archive`);
    assert.equal(file.status, 200);
    assert.match(file.headers.get("content-type"), /text\/plain/);
    assert.match(file.buffer.toString("utf8"), /kırk beş gün önce/);
    assert.equal((await selin.raw("GET", `/api/chat/conversations/${encodeURIComponent(direct)}/archive`)).status, 404);
    const office = await selin.raw("GET", `/api/chat/conversations/${OFFICE_CONVERSATION}/archive`);
    assert.equal(office.status, 200);
    assert.match(office.buffer.toString("utf8"), /ofise eski duyuru/);
    const info = (await admin.get("/api/admin/chat-archive")).data.data;
    assert.ok(info.dir.endsWith("mesaj-arsivi") && info.files >= 2 && info.conversations === 2, JSON.stringify(info));
    assert.equal((await ali.get("/api/admin/chat-archive")).status, 403);
    assert.ok(existsSync(info.dir));
  });
});
