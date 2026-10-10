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

  // Soket her durumda kapatılır: ölçüm düşerse açık kalan UDP soketi test sürecini bitirmiyor ve bütün npm test takılıyordu
  // (CI 542, Windows Node 22: 2,5 saat çıktısız, iptal edildi).
  const withSocket = async work => {
    const socket = dgram.createSocket("udp4");
    const received = [];
    socket.on("message", message => received.push(message.toString()));
    try {
      await new Promise(resolve => socket.bind(0, "127.0.0.1", resolve));
      const send = payload => new Promise(resolve => socket.send(Buffer.from(payload), port, "127.0.0.1", resolve));
      return await work({ send, received });
    } finally {
      socket.close();
    }
  };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  it("tanımadığı veya çok büyük paketlere yanıt vermez; gönderici başına hız sınırlar", () =>
    withSocket(async ({ send, received }) => {
      await send("merhaba");
      await send(`${DISCOVERY_REQUEST}${"x".repeat(600)}`);
      await pause(200);
      assert.equal(received.length, 0);
      for (let index = 0; index < 10; index += 1) await send(DISCOVERY_REQUEST);
      await pause(300);
      assert.ok(received.length <= 3, `yanıt sayısı ${received.length}`);
      assert.ok(received.length >= 1);
    }));

  // CI 542'de Windows'ta 4 yanıt geldi: sınırlayıcı saat saniyesine göre sabit pencerede sayıyordu, 10 istek saniye sınırının iki
  // yanına düşünce 3 + 3 yanıt gidiyordu. Ön koşul zorla kurulur (ders 20): istekler saniye sınırından hemen önce başlar, sınırı aşar.
  it("hız sınırı saniye sınırını aşan istek dizisinde de herhangi bir 1 sn içinde en çok sınır kadar yanıt verir", async () => {
    await pause(1100); // önceki testin yanıt hakkı dolsun
    await withSocket(async ({ send, received }) => {
      while (Date.now() % 1000 < 900) await pause(5);
      const start = Date.now();
      for (let index = 0; index < 10; index += 1) {
        await send(DISCOVERY_REQUEST);
        await pause(20);
      }
      const spanned = Math.floor(Date.now() / 1000) !== Math.floor(start / 1000);
      await pause(300);
      assert.ok(spanned, "ön koşul oluşmadı: istekler saniye sınırını aşmadı");
      assert.ok(Date.now() - start < 1000, "istek dizisi 1 sn'den uzun sürdü; ölçüm geçersiz");
      assert.ok(received.length <= 3, `1 sn içindeki 10 isteğe ${received.length} yanıt (sınır 3)`);
      assert.ok(received.length >= 1);
    });
  });
});
