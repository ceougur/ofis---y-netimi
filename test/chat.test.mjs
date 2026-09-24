// Ofis içi sohbet ve canlı olay kanalı: gizlilik, okunmamış sayıları, okundu bilgisi ve anlık iletim.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

// Sunucu olay akışını (SSE) okur; beklenen olay gelene kadar bekler.
function openEvents(server, client) {
  const controller = new AbortController();
  const queue = [];
  const waiters = [];
  let buffer = "";
  let closed = false;
  const ready = fetch(`${server.base}/api/events`, { headers: { cookie: client.cookie }, signal: controller.signal }).then(async response => {
    if (response.status !== 200) {
      closed = true;
      return response.status;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const type = /^event: (.+)$/m.exec(frame)?.[1];
            const data = /^data: (.+)$/m.exec(frame)?.[1];
            if (!type) continue;
            queue.push({ type, data: data ? JSON.parse(data) : null });
            for (const waiter of [...waiters]) waiter();
          }
        }
      } catch {
        // bağlantı kapatıldı
      }
      closed = true;
      for (const waiter of [...waiters]) waiter();
    })();
    return 200;
  });
  return {
    ready,
    get closed() {
      return closed;
    },
    events: queue,
    next(type, timeoutMs = 3000, predicate = () => true) {
      return new Promise((resolve, reject) => {
        const check = () => {
          const index = queue.findIndex(item => item.type === type && predicate(item.data));
          if (index >= 0) {
            waiters.splice(waiters.indexOf(check), 1);
            clearTimeout(timer);
            resolve(queue.splice(index, 1)[0].data);
          } else if (closed) {
            waiters.splice(waiters.indexOf(check), 1);
            clearTimeout(timer);
            reject(new Error(`Akış kapandı; "${type}" gelmedi`));
          }
        };
        const timer = setTimeout(() => {
          waiters.splice(waiters.indexOf(check), 1);
          reject(new Error(`"${type}" olayı ${timeoutMs} ms içinde gelmedi`));
        }, timeoutMs);
        waiters.push(check);
        check();
      });
    },
    close: () => controller.abort(),
  };
}

describe("ofis içi sohbet", () => {
  let server;
  let admin;
  let ali;
  let ayse;
  let ids;
  const streams = [];

  before(async () => {
    server = await startTestServer({ env: { HUKUK_EVENTS_PING_MS: "150" } });
    admin = await loginAdmin(server);
    ali = await createUser(server, admin, { username: "ali", name: "Ali Kaya", role: "personel" });
    ayse = await createUser(server, admin, { username: "ayse", name: "Ayşe Nur", role: "avukat" });
    const users = (await admin.get("/api/admin/users")).data.data;
    ids = Object.fromEntries(users.map(user => [user.username, user.id]));
  });
  after(async () => {
    for (const stream of streams) stream.close();
    await server.close();
  });

  it("özet: ofis kanalı ve kişiler listesi (kendisi hariç)", async () => {
    const summary = (await ali.get("/api/chat")).data.data;
    assert.equal(summary.conversations[0].kind, "office");
    assert.equal(summary.conversations[0].title, "Ofis geneli");
    assert.deepEqual(summary.users.map(user => user.name).sort(), ["Ayşe Nur", "Ofis yöneticisi"]);
    assert.equal(summary.unreadTotal, 0);
  });

  it("özel yazışmayı yalnızca iki taraf görür; üçüncü kişi ve yönetici göremez", async () => {
    const conversation = (await ali.post("/api/chat/direct", { userId: ids.ayse })).data.data;
    assert.equal(conversation.kind, "direct");
    assert.equal(conversation.title, "Ayşe Nur");
    const sent = await ali.post(`/api/chat/conversations/${conversation.id}/messages`, { body: "2024/11710 dosyası için borçlu aradı." });
    assert.equal(sent.status, 200);
    assert.equal(sent.data.data.caseKey, "2024/11710", "mesajdaki dosya numarası bağlanır");
    const forAyse = (await ayse.get("/api/chat")).data.data;
    const direct = forAyse.conversations.find(item => item.id === conversation.id);
    assert.equal(direct.unread, 1);
    assert.equal(direct.title, "Ali Kaya");
    assert.equal(forAyse.unreadTotal, 1);
    for (const outsider of [admin]) {
      assert.equal((await outsider.get(`/api/chat/conversations/${conversation.id}/messages`)).status, 404);
      assert.equal((await outsider.post(`/api/chat/conversations/${conversation.id}/messages`, { body: "araya girme" })).status, 404);
      const summary = (await outsider.get("/api/chat")).data.data;
      assert.ok(!summary.conversations.some(item => item.id === conversation.id));
    }
  });

  it("okundu bilgisi: okununca sayaç sıfırlanır, karşı taraf okunma zamanını görür", async () => {
    const conversation = (await ayse.post("/api/chat/direct", { userId: ids.ali })).data.data;
    const thread = (await ayse.get(`/api/chat/conversations/${conversation.id}/messages`)).data.data;
    assert.equal(thread.messages.length, 1);
    assert.equal(thread.messages[0].senderName, "Ali Kaya");
    const read = (await ayse.post(`/api/chat/conversations/${conversation.id}/read`, {})).data.data;
    assert.equal(read.unread, 0);
    const forAli = (await ali.get(`/api/chat/conversations/${conversation.id}/messages`)).data.data;
    assert.ok(forAli.conversation.peerLastReadAt >= thread.messages[0].createdAt);
  });

  it("ofis kanalını herkes görür; her kişinin okunmamış sayısı ayrıdır", async () => {
    await admin.post("/api/chat/conversations/conversation-office/messages", { body: "Yarın 09.00'da toplantı." });
    const forAli = (await ali.get("/api/chat")).data.data.conversations[0];
    const forAdmin = (await admin.get("/api/chat")).data.data.conversations[0];
    assert.equal(forAli.unread, 1);
    assert.equal(forAdmin.unread, 0, "gönderenin kendi mesajı okunmamış sayılmaz");
    assert.equal(forAli.lastMessage.body, "Yarın 09.00'da toplantı.");
  });

  it("geçersiz istekleri reddeder", async () => {
    assert.equal((await ali.post("/api/chat/conversations/conversation-office/messages", { body: "   " })).status, 400);
    assert.equal((await ali.post("/api/chat/conversations/conversation-office/messages", { body: "x".repeat(2001) })).status, 400);
    assert.equal((await ali.post("/api/chat/direct", { userId: ids.ali })).status, 400);
    assert.equal((await ali.post("/api/chat/direct", { userId: "user-yok" })).status, 404);
    assert.equal((await ali.get("/api/chat/conversations/conversation-yok/messages")).status, 404);
    assert.equal((await server.client().get("/api/chat")).status, 401);
  });

  it("eski Mesajlar uçları sohbete yazar ve yalnızca kişinin yazışmalarını döndürür", async () => {
    const legacy = await ayse.post("/api/workspace/messages", { to: "ali kaya", message: "Eski ekrandan mesaj" });
    assert.equal(legacy.status, 200);
    const forAli = (await ali.get("/api/workspace/messages")).data.data;
    assert.ok(forAli.some(item => item.message === "Eski ekrandan mesaj" && item.toMe));
    const forAdmin = (await admin.get("/api/workspace/messages")).data.data;
    assert.ok(!forAdmin.some(item => item.message === "Eski ekrandan mesaj"), "yönetici başkalarının özel mesajını göremez");
    await ayse.post("/api/workspace/messages", { to: "Tanımsız Kişi", message: "herkese" });
    const office = (await admin.get("/api/chat/conversations/conversation-office/messages")).data.data.messages;
    assert.ok(office.some(item => item.body === "→ Tanımsız Kişi: herkese"));
  });

  it("canlı kanal: mesaj, okundu ve çalışma alanı değişikliği anında iletilir", async () => {
    const aliEvents = openEvents(server, ali);
    const ayseEvents = openEvents(server, ayse);
    streams.push(aliEvents, ayseEvents);
    assert.equal(await aliEvents.ready, 200);
    assert.equal(await ayseEvents.ready, 200);
    const hello = await aliEvents.next("hello");
    assert.equal(hello.userId, ids.ali);
    assert.equal(hello.version, server.app.config.version);
    await aliEvents.next("presence", 3000, data => data.online.includes(ids.ayse));

    const conversation = (await ayse.post("/api/chat/direct", { userId: ids.ali })).data.data;
    await ayse.post(`/api/chat/conversations/${conversation.id}/messages`, { body: "Canlı mesaj" });
    const incoming = await aliEvents.next("chat.message");
    assert.equal(incoming.message.body, "Canlı mesaj");
    assert.equal(incoming.message.senderName, "Ayşe Nur");

    await ali.post(`/api/chat/conversations/${conversation.id}/read`, {});
    const read = await ayseEvents.next("chat.read");
    assert.equal(read.userId, ids.ali);

    await ayse.post(`/api/workspace/cases/${encodeURIComponent("2026/77")}/notes`, { note: "Borçlu arandı" });
    const change = await aliEvents.next("workspace.changed");
    assert.deepEqual([change.kind, change.caseKey, change.actorName], ["activity", "2026/77", "Ayşe Nur"]);
    await assert.rejects(ayseEvents.next("workspace.changed", 400), "işlemi yapana kendi değişikliği gönderilmez");
  });

  it("görev olayı yalnızca görevi görebilenlere gider (atanan ve tüm görevleri görenler)", async () => {
    const aliEvents = openEvents(server, ali);
    const ayseEvents = openEvents(server, ayse);
    streams.push(aliEvents, ayseEvents);
    await aliEvents.next("hello");
    await ayseEvents.next("hello");
    await admin.post("/api/workspace/tasks", { title: "Avukatın duruşma hazırlığı", assignee: "Ayşe Nur", caseKey: "2026/90" });
    const forAyse = await ayseEvents.next("workspace.changed", 3000, data => data.kind === "task");
    assert.equal(forAyse.title, "Avukatın duruşma hazırlığı");
    await assert.rejects(aliEvents.next("workspace.changed", 400, data => data.kind === "task"), "personel başkasının görevini canlı kanaldan da öğrenemez");
    await admin.post("/api/workspace/tasks", { title: "Tebligatı takip et", assignee: "Ali Kaya" });
    const forAli = await aliEvents.next("workspace.changed", 3000, data => data.kind === "task");
    assert.deepEqual([forAli.title, forAli.assignee, forAli.actorName], ["Tebligatı takip et", "Ali Kaya", "Ofis yöneticisi"]);
    assert.equal((await ayseEvents.next("workspace.changed", 3000, data => data.kind === "task")).title, "Tebligatı takip et", "avukat tüm görevleri görür");
  });

  it("oturum kapanınca canlı bağlantı da kapanır", async () => {
    const temp = await createUser(server, admin, { username: "gecici", name: "Geçici", role: "personel" });
    const stream = openEvents(server, temp);
    streams.push(stream);
    assert.equal(await stream.ready, 200);
    await stream.next("hello");
    await temp.post("/api/auth/logout");
    for (let attempt = 0; attempt < 40 && !stream.closed; attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(stream.closed, true);
    assert.equal(await openEvents(server, temp).ready, 401);
  });
});

describe("canlı kanal oturum güvenliği", () => {
  let server;
  let admin;
  const streams = [];

  before(async () => {
    // Ping çok seyrek: kapanmanın ping turunu beklemeden, anında olduğunu doğrular.
    server = await startTestServer({ env: { HUKUK_EVENTS_PING_MS: "600000" } });
    admin = await loginAdmin(server);
  });
  after(async () => {
    for (const stream of streams) stream.close();
    await server.close();
  });

  const waitClosed = async stream => {
    for (let attempt = 0; attempt < 20 && !stream.closed; attempt += 1) await new Promise(resolve => setTimeout(resolve, 25));
    return stream.closed;
  };
  const users = async () => Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(user => [user.username, user.id]));

  it("çıkış yapınca yalnızca o oturumun bağlantısı anında kapanır", async () => {
    const first = await createUser(server, admin, { username: "cikis", name: "Çıkış Deneme", role: "personel" });
    const second = server.client();
    assert.equal((await second.login("cikis", "Personel-2026!")).status, 200);
    const a = openEvents(server, first);
    const b = openEvents(server, second);
    streams.push(a, b);
    await a.next("hello");
    await b.next("hello");
    await first.post("/api/auth/logout");
    assert.equal(await waitClosed(a), true, "çıkış yapılan oturumun akışı kapanır");
    assert.equal(b.closed, false, "aynı kişinin diğer bilgisayardaki oturumu açık kalır");
  });

  it("yönetici oturumları kapatınca veya hesabı pasifleştirince bağlantılar anında kapanır", async () => {
    const one = await createUser(server, admin, { username: "hepsi", name: "Hepsi Kapat", role: "personel" });
    const two = await createUser(server, admin, { username: "pasif", name: "Pasif Olacak", role: "personel" });
    const ids = await users();
    const s1 = openEvents(server, one);
    const s2 = openEvents(server, two);
    streams.push(s1, s2);
    await s1.next("hello");
    await s2.next("hello");
    assert.equal((await admin.post(`/api/admin/users/${ids.hepsi}/logout-all`)).status, 200);
    assert.equal(await waitClosed(s1), true);
    assert.equal(s2.closed, false);
    assert.equal((await admin.patch(`/api/admin/users/${ids.pasif}`, { active: false })).status, 200);
    assert.equal(await waitClosed(s2), true);
  });
});
