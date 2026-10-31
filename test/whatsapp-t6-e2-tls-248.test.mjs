// 2.4.8 T2 dar kontrol 2 ORTA-B (test dişsizdi, ders 7): T6-E2'nin "TLS kuruldu → Sonucu Belirsiz" yönünü hiçbir test korumuyordu — net-proxy'deki secureConnect
// dinleyicisini bozan mutasyon 141/141 testte yakalanmadı ve gövdesi Meta'ya GİTMİŞ istekleri "gönderilmedi" (NOT_CONNECTED) saydı → otomatik yeniden gönderim = ÇİFT
// İLETİ. Var olan test "bağlantı kurulduktan sonra" durumunu http ile koşuyordu (TLS işareti hiç sınanmıyordu).
// Bu test bağımsız dar kontrol sondasının (probe-e2) 9 durumunu GERÇEK TLS ile kurar: doğrudan ve vekil (CONNECT) üzerinden. Programın güvenli yolu korunur — TLS
// doğrulaması KAPATILMAZ; test kendi kendinden imzalı sertifikasını (bellekte üretilir, depoya yazılmaz) güvenilen kök olarak verir (tlsOptions.ca).
// Kâhin programın sınıflaması DEĞİL: her durumda sunucunun GERÇEKTEN aldığı bayt sayılır — gövde sunucuya ulaştıysa "belirsiz" (neverReachedMeta false), hiç ulaşmadıysa
// "gönderilmedi" (true) beklenir.
import assert from "node:assert/strict";
import net from "node:net";
import tls from "node:tls";
import { after, before, describe, it } from "node:test";
import { createProxyFetch } from "../server/lib/net-proxy.mjs";
import { MetaGraphError, createMetaGraph, neverReachedMeta } from "../server/lib/whatsapp/meta-graph.mjs";
import { selfSignedCert } from "./tls-sertifika.mjs";

const HOST = "meta.test";
const TOKEN = "SAHTE-T2DK2-belirtec-0123456789-abcdef";
let pem = null;
// meta.test → 127.0.0.1 (yalnız doğrudan yolda; vekil yolunda adı vekil çözer). net.connect autoSelectFamily'de { all: true } ile çağırır.
const lookup = (host, options, callback) => {
  const done = typeof options === "function" ? options : callback;
  if (typeof options === "object" && options?.all) return done(null, [{ address: "127.0.0.1", family: 4 }]);
  return done(null, "127.0.0.1", 4);
};
const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

/** TLS sunucusu: "drop-after-body" isteği okur, yanıt vermeden bağlantıyı keser; "mute" okur, hiç yanıt vermez. got: sunucuya ulaşan bayt / POST satırı. */
async function tlsServer(mode) {
  const got = { bytes: 0, post: false };
  const sockets = new Set();
  const server = tls.createServer({ key: pem.key, cert: pem.cert }, socket => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("data", data => {
      got.bytes += data.length;
      if (/^POST /.test(String(data))) got.post = true;
      if (mode === "drop-after-body" && String(data).includes("messaging_product")) socket.destroy();
    });
  });
  server.on("tlsClientError", () => {});
  const port = await listen(server);
  return {
    port,
    got,
    close: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

/** CONNECT vekili: "ok" hedefe tüneller; "refuse" 502 döner; "drop-before-tls" 200 der, ilk TLS baytında keser. */
async function proxyServer(targetPort, mode) {
  const sockets = new Set();
  const server = net.createServer(client => {
    sockets.add(client);
    client.on("error", () => {});
    client.once("data", () => {
      if (mode === "refuse") return client.end("HTTP/1.1 502 Bad Gateway\r\ncontent-length: 0\r\n\r\n");
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (mode === "drop-before-tls") return client.once("data", () => client.destroy());
      const upstream = net.connect(targetPort, "127.0.0.1");
      sockets.add(upstream);
      upstream.on("error", () => {});
      client.pipe(upstream);
      upstream.pipe(client);
      client.on("close", () => upstream.destroy());
      upstream.on("close", () => client.destroy());
    });
  });
  const port = await listen(server);
  return {
    port,
    close: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

const direct = ({ trust = true } = {}) => createProxyFetch({ resolve: () => ({ proxy: null, bypass: [] }), tlsOptions: { lookup, ...(trust ? { ca: pem.cert } : {}) } });
const viaProxy = (port, { trust = true } = {}) => {
  const address = `http://127.0.0.1:${port}`;
  return createProxyFetch({ resolve: () => ({ proxy: { http: address, https: address }, bypass: [] }), tlsOptions: trust ? { ca: pem.cert } : {} });
};
async function send(port, fetchImpl, timeoutMs = 800) {
  const graph = createMetaGraph({ baseUrl: `https://${HOST}:${port}`, fetchImpl, openToken: () => TOKEN, timeoutMs });
  const error = await graph.sendTemplate("123456", { to: "+905321112233", name: "destekofis_ekstre", language: "tr", components: [] }).then(
    () => null,
    caught => caught,
  );
  assert.ok(error instanceof MetaGraphError, `ileti isteği hata vermeliydi (${error})`);
  return error;
}
const verdict = error => `${error.reason}: ${error.title} / ${error.details || ""}`;

describe("2.4.8 T2 dar kontrol 2 ORTA-B — ileti isteğinin sınıflaması GERÇEK TLS ile: gövde gittiyse belirsiz, gitmediyse gönderilmedi", () => {
  before(() => {
    pem = selfSignedCert(HOST);
  });
  after(() => {
    pem = null;
  });

  // ---------- Gövde sunucuya ULAŞTI → Sonucu Belirsiz (otomatik yeniden gönderilmez; §7a 10) ----------
  for (const [label, mode] of [
    ["TLS kuruldu, gövde gitti, yanıt vermeden kopma", "drop-after-body"],
    ["TLS kuruldu, gövde gitti, yanıt yok (zaman aşımı)", "mute"],
  ]) {
    it(`doğrudan: ${label} → belirsiz`, async () => {
      const server = await tlsServer(mode);
      try {
        const error = await send(server.port, direct());
        assert.ok(server.got.post, "ön koşul: gövde sunucuya ulaştı (TLS kuruldu)");
        assert.equal(neverReachedMeta(error), false, `gövdesi Meta'ya gitmiş istek "gönderilmedi" sayılmamalı (çift ileti) — ${verdict(error)}`);
      } finally {
        await server.close();
      }
    });
    it(`vekil üzerinden: ${label} → belirsiz`, async () => {
      const server = await tlsServer(mode);
      const proxy = await proxyServer(server.port, "ok");
      try {
        const error = await send(server.port, viaProxy(proxy.port));
        assert.ok(server.got.post, "ön koşul: gövde vekilden geçip sunucuya ulaştı (TLS kuruldu)");
        assert.equal(neverReachedMeta(error), false, `gövdesi Meta'ya gitmiş istek "gönderilmedi" sayılmamalı (çift ileti) — ${verdict(error)}`);
      } finally {
        await proxy.close();
        await server.close();
      }
    });
  }

  // ---------- Gövde sunucuya HİÇ ULAŞMADI → gönderilmedi (R1 Bağlantı Bekleniyor) ----------
  it("doğrudan: TCP kabul edildi, TLS hiç kurulmadı (zaman aşımı) → gönderilmedi", async () => {
    const sockets = new Set();
    const silent = net.createServer(socket => {
      sockets.add(socket);
      socket.on("error", () => {});
    });
    const port = await listen(silent);
    try {
      const error = await send(port, direct(), 500);
      assert.equal(neverReachedMeta(error), true, `TLS kurulmadan düşen istek "gönderilmedi" sayılmalı — ${verdict(error)}`);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => silent.close(resolve));
    }
  });
  it("doğrudan: sertifika doğrulanamadı → gönderilmedi, sunucuya gövde gitmedi", async () => {
    const server = await tlsServer("mute");
    try {
      const error = await send(server.port, direct({ trust: false }));
      assert.equal(server.got.post, false, "ön koşul: gövde sunucuya ulaşmadı");
      assert.equal(neverReachedMeta(error), true, verdict(error));
    } finally {
      await server.close();
    }
  });
  for (const [label, mode] of [
    ["CONNECT 200, hedefle TLS kurulmadan kopma", "drop-before-tls"],
    ["CONNECT reddedildi (502)", "refuse"],
  ]) {
    it(`vekil: ${label} → gönderilmedi, sunucuya gövde gitmedi`, async () => {
      const server = await tlsServer("mute");
      const proxy = await proxyServer(server.port, mode);
      try {
        const error = await send(server.port, viaProxy(proxy.port));
        assert.equal(server.got.bytes, 0, "ön koşul: hedefe hiç bayt ulaşmadı");
        assert.equal(neverReachedMeta(error), true, `gövdesi hiç gitmeyen istek "gönderilmedi" sayılmalı — ${verdict(error)}`);
      } finally {
        await proxy.close();
        await server.close();
      }
    });
  }
  it("vekil: sertifika doğrulanamadı (vekil TLS denetimi / yanlış kök) → gönderilmedi, sunucuya gövde gitmedi", async () => {
    const server = await tlsServer("mute");
    const proxy = await proxyServer(server.port, "ok");
    try {
      const error = await send(server.port, viaProxy(proxy.port, { trust: false }));
      assert.equal(server.got.post, false, "ön koşul: gövde sunucuya ulaşmadı");
      assert.equal(neverReachedMeta(error), true, verdict(error));
    } finally {
      await proxy.close();
      await server.close();
    }
  });
});
