// Canlı kanalın dayanıklılığı: kaldığı yerden devam (Last-Event-ID), planlı bağlantı yenileme ve kapanışı iletmeyen
// bir vekil (1.3.x servis yöneticisi) arkasında soket birikmemesi.
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Ham SSE okuyucu: çerçeveleri (id, event, data) ve ham metni toplar.
function stream(base, client, headers = {}) {
  const controller = new AbortController();
  const frames = [];
  let raw = "";
  let closed = false;
  let response = null;
  const ready = fetch(`${base}/api/events`, { headers: { cookie: client.cookie, ...headers }, signal: controller.signal }).then(async result => {
    response = result;
    if (result.status !== 200) {
      closed = true;
      return result.status;
    }
    const reader = result.body.getReader();
    const decoder = new TextDecoder();
    (async () => {
      let buffer = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          raw += text;
          buffer += text;
          let cut;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const type = /^event: (.+)$/m.exec(frame)?.[1];
            if (!type) continue;
            const data = /^data: (.+)$/m.exec(frame)?.[1];
            frames.push({ type, id: /^id: (.+)$/m.exec(frame)?.[1] || null, data: data ? JSON.parse(data) : null });
          }
        }
      } catch {
        // kapatıldı
      }
      closed = true;
    })();
    return 200;
  });
  const waitFor = async (predicate, timeoutMs = 3000) => {
    const started = Date.now();
    for (;;) {
      const found = frames.find(predicate);
      if (found) return found;
      if (Date.now() - started > timeoutMs) throw new Error("beklenen olay gelmedi");
      await sleep(20);
    }
  };
  return {
    ready,
    frames,
    waitFor,
    get raw() {
      return raw;
    },
    get closed() {
      return closed;
    },
    get response() {
      return response;
    },
    close: () => controller.abort(),
  };
}

const officeMessage = (client, body) => client.post("/api/chat/conversations/conversation-office/messages", { body });

describe("canlı kanal: kaldığı yerden devam ve bağlantı yenileme", () => {
  let server;
  let admin;
  let ali;
  const open = [];

  before(async () => {
    server = await startTestServer({ env: { HUKUK_EVENTS_PING_MS: "60000", HUKUK_EVENTS_MAX_AGE_MS: "400" } });
    admin = await loginAdmin(server);
    ali = await createUser(server, admin, { username: "ali", name: "Ali Kaya", role: "personel" });
  });
  after(async () => {
    for (const item of open) item.close();
    await server.close();
  });

  it("kopan sekme Last-Event-ID ile bağlanınca arada kaçan olaylar gelir (eşitlemeye gerek kalmaz)", async () => {
    const first = stream(server.base, ali);
    open.push(first);
    assert.equal(await first.ready, 200);
    assert.equal((await first.waitFor(frame => frame.type === "hello")).data.resumed, false, "ilk bağlantı devam değildir");
    await officeMessage(admin, "Birinci duyuru");
    const seen = await first.waitFor(frame => frame.type === "chat.message");
    assert.match(seen.id, /^[0-9a-f]+\.\d+$/);
    first.close();
    await sleep(50);
    await officeMessage(admin, "Kopukken gelen duyuru");
    const second = stream(server.base, ali, { "last-event-id": seen.id });
    open.push(second);
    assert.equal(await second.ready, 200);
    assert.equal((await second.waitFor(frame => frame.type === "hello")).data.resumed, true);
    const missed = await second.waitFor(frame => frame.type === "chat.message");
    assert.equal(missed.data.message.body, "Kopukken gelen duyuru");
    assert.equal(second.frames.filter(frame => frame.type === "chat.message").length, 1, "zaten alınan olay tekrar gönderilmez");
    second.close();
    // Sayfanın kendi açtığı yeni bağlantı aynı bilgiyi "last" parametresiyle verir.
    const response = await fetch(`${server.base}/api/events?last=${encodeURIComponent(missed.id)}`, { headers: { cookie: ali.cookie } });
    const reader = response.body.getReader();
    const text = new TextDecoder().decode((await reader.read()).value) + new TextDecoder().decode((await reader.read()).value);
    await reader.cancel();
    assert.match(text, /"resumed":true/);
  });

  it("başka bir sunucu oturumunun (ör. güncelleme öncesi) kimliğiyle gelen sekme eşitleme yapar", async () => {
    const item = stream(server.base, ali, { "last-event-id": "deadbeef.3" });
    open.push(item);
    assert.equal((await item.waitFor(frame => frame.type === "hello")).data.resumed, false);
    item.close();
  });

  it("süresi dolan akış kısa bekleme süresi bildirip kapanır; yanıt Connection: close taşır", async () => {
    const item = stream(server.base, ali);
    open.push(item);
    assert.equal(await item.ready, 200);
    assert.equal(item.response.headers.get("connection"), "close");
    for (let attempt = 0; attempt < 60 && !item.closed; attempt += 1) await sleep(25);
    assert.equal(item.closed, true, "akış ömrü dolunca kapanır");
    assert.match(item.raw, /retry: 4000\n\n[\s\S]*retry: 500\n\n$/);
  });
});

describe("1.3.x servis yöneticisi kapısı arkasında", () => {
  let server;
  let admin;
  let gateway;
  let agent;
  let base;

  before(async () => {
    server = await startTestServer({ env: { HUKUK_EVENTS_PING_MS: "60000", HUKUK_EVENTS_MAX_AGE_MS: "300" } });
    admin = await loginAdmin(server);
    const childPort = new URL(server.base).port;
    // v1.3.1–v1.3.3 server/supervisor.mjs içindeki proxy() birebir: istemci kapanışını uygulamaya iletmez.
    agent = new http.Agent({ keepAlive: true, maxSockets: 128 });
    gateway = http.createServer((req, res) => {
      const headers = { ...req.headers, "x-forwarded-for": req.socket.remoteAddress || "", "x-forwarded-host": req.headers.host || "", "x-forwarded-proto": "http" };
      const upstream = http.request({ host: "127.0.0.1", port: childPort, method: req.method, path: req.url, headers, agent }, upstreamResponse => {
        res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(res);
        upstreamResponse.on("error", () => res.destroy());
      });
      upstream.on("error", () => (res.headersSent ? res.destroy() : res.writeHead(503).end()));
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
    });
    gateway.keepAliveTimeout = 65_000;
    await new Promise(resolve => gateway.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${gateway.address().port}`;
  });
  after(async () => {
    agent.destroy();
    gateway.close();
    await server.close();
  });

  it("kapanan sekmelerin bağlantıları kapının soket havuzunda birikmez", async () => {
    const users = [admin];
    for (const name of ["bir", "iki", "uc"]) users.push(await createUser(server, admin, { username: `kisi${name}`, name: `Kişi ${name}`, role: "personel" }));
    const busy = () => Object.values(agent.sockets).reduce((total, list) => total + list.length, 0);
    const streams = [];
    for (const user of users) for (let index = 0; index < 5; index += 1) streams.push(stream(base, user));
    assert.deepEqual([...new Set(await Promise.all(streams.map(item => item.ready)))], [200]);
    await Promise.all(streams.map(item => item.waitFor(frame => frame.type === "hello")));
    assert.equal(busy(), 20);
    for (const item of streams) item.close(); // sekmeler kapandı; eski kapı bunu uygulamaya iletmez
    await sleep(100);
    assert.ok(busy() > 0, "eski kapı kapanışı iletmediği için soketler hâlâ meşgul (sorunun kendisi)");
    for (let attempt = 0; attempt < 80 && busy() > 0; attempt += 1) await sleep(25);
    assert.equal(busy(), 0, "bağlantı ömrü dolunca soketler kapanır, havuz boşalır");
    assert.equal(server.app.events.size(), 0);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  });
});
