import assert from "node:assert/strict";
import dgram from "node:dgram";
import { after, before, describe, it } from "node:test";
import { DISCOVERY_REQUEST, discover, pickAddressFor, startDiscoveryResponder } from "../server/lib/discovery.mjs";

describe("UDP sunucu keşfi", () => {
  let responder;
  let port;
  before(async () => {
    responder = startDiscoveryResponder({ port: 0, httpPort: 5123, host: "127.0.0.1", getInfo: () => ({ instanceId: "kurulum-1", version: "1.2.0", officeName: "Deneme Hukuk" }), maxPerSecond: 3 });
    port = (await responder.ready).port;
  });
  after(() => responder.close());

  it("istemcinin alt ağındaki yerel adresi seçer", () => {
    const addresses = [{ address: "10.8.0.2", netmask: "255.255.255.0" }, { address: "192.168.1.50", netmask: "255.255.255.0" }];
    assert.equal(pickAddressFor("192.168.1.77", addresses), "192.168.1.50");
    assert.equal(pickAddressFor("::ffff:10.8.0.9", addresses), "10.8.0.2");
    assert.equal(pickAddressFor("172.16.0.5", addresses), "10.8.0.2");
  });

  it("doğru sinyale ofis bilgisiyle yanıt verir", async () => {
    const replies = await discover({ port, targets: ["127.0.0.1"], timeoutMs: 600 });
    assert.equal(replies.length, 1);
    assert.equal(replies[0].name, "Deneme Hukuk");
    assert.equal(replies[0].port, 5123);
    assert.equal(replies[0].magic, "HukukOfisiServerBurada");
  });

  it("tanımadığı veya çok büyük paketlere yanıt vermez; gönderici başına hız sınırlar", async () => {
    const socket = dgram.createSocket("udp4");
    const received = [];
    socket.on("message", message => received.push(message.toString()));
    await new Promise(resolve => socket.bind(0, "127.0.0.1", resolve));
    const send = payload => new Promise(resolve => socket.send(Buffer.from(payload), port, "127.0.0.1", resolve));
    await send("merhaba");
    await send(`${DISCOVERY_REQUEST}${"x".repeat(600)}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(received.length, 0);
    for (let index = 0; index < 10; index += 1) await send(DISCOVERY_REQUEST);
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.ok(received.length <= 3, `yanıt sayısı ${received.length}`);
    assert.ok(received.length >= 1);
    socket.close();
  });
});
