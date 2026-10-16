// Vekil sunucu (proxy) desteği (kullanıcı kararı 16.10.2026: "yap"; server/lib/net-proxy.mjs). Sahte vekil sunucu (HTTP + CONNECT tüneli,
// kimlik doğrulama) ve bellekte üretilen TLS sertifikasıyla (test/tls-sertifika.mjs) Linux ve Windows'ta aynı koşar; gerçek ağa çıkılmaz.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import tls from "node:tls";
import { after, before, describe, test } from "node:test";
import { cachedResolver, createProxyFetch, isBypassed, normalizeProxy, parseWinHttpSettings, readWindowsProxy, resolveProxy, writeNetworkSettings } from "../server/lib/net-proxy.mjs";
import { selfSignedCert } from "./tls-sertifika.mjs";

// WinHttpSettings ikili düzeni: sürüm, sayaç, bayrak (3 = vekil), uzunluk + adres, uzunluk + bypass.
function winHttpHex(proxy, bypass, flags = 3) {
  const parts = [Buffer.alloc(12), Buffer.alloc(4), Buffer.from(proxy, "latin1"), Buffer.alloc(4), Buffer.from(bypass, "latin1")];
  parts[0].writeUInt32LE(0x28, 0);
  parts[0].writeUInt32LE(7, 4);
  parts[0].writeUInt32LE(flags, 8);
  parts[1].writeUInt32LE(proxy.length, 0);
  parts[3].writeUInt32LE(bypass.length, 0);
  return Buffer.concat(parts).toString("hex").toUpperCase();
}

describe("Vekil sunucu ayarının çözümü", () => {
  test("Windows WinHTTP ikili ayarı okunur; doğrudan bağlantı bayrağında vekil yok", () => {
    assert.deepEqual(parseWinHttpSettings(winHttpHex("vekil.firma.local:8080", "<local>;*.firma.local")), { proxy: "vekil.firma.local:8080", bypass: "<local>;*.firma.local" });
    assert.equal(parseWinHttpSettings(winHttpHex("", "", 1)), null);
    assert.equal(parseWinHttpSettings("00"), null);
  });
  test("adres biçimleri: düz, şemalı, kimlikli, WinHTTP protokol listesi; SOCKS ve bozuk adres yok sayılır", () => {
    assert.deepEqual(normalizeProxy("vekil:8080"), { http: "http://vekil:8080", https: "http://vekil:8080" });
    assert.deepEqual(normalizeProxy("http://ali:gizli@vekil:3128/"), { http: "http://ali:gizli@vekil:3128", https: "http://ali:gizli@vekil:3128" });
    assert.deepEqual(normalizeProxy("http=a.local:80;https=b.local:443"), { http: "http://a.local:80", https: "http://b.local:443" });
    assert.equal(normalizeProxy("socks=s:1080"), null);
    assert.equal(normalizeProxy(""), null);
  });
  test("yerel adresler her zaman doğrudan; <local>, *.alan, önek ve tam ad kuralları", () => {
    for (const host of ["localhost", "127.0.0.1", "127.5.5.5", "::1", "[::1]"]) assert.equal(isBypassed(host, []), true, host);
    assert.equal(isBypassed("sunucu", ["<local>"]), true);
    assert.equal(isBypassed("api.github.com", ["<local>"]), false);
    assert.equal(isBypassed("muhasebe.firma.local", ["*.firma.local"]), true);
    assert.equal(isBypassed("10.0.0.5", ["10.*"]), true);
    assert.equal(isBypassed("edm.test", ["edm.test"]), true);
  });
  test("sıra: program ayarı (elle / kullanma) > ortam değişkeni > Windows > doğrudan", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vekil-ayar-"));
    const file = path.join(root, "ag-ayari.json");
    const windows = () => ({ proxy: "win.vekil:8080", bypass: "<local>" });
    try {
      assert.equal(resolveProxy({ file, env: {}, windows: () => null }).source, "direct");
      assert.equal(resolveProxy({ file, env: {}, windows }).source, "windows");
      assert.deepEqual(resolveProxy({ file, env: {}, windows }).proxy, { http: "http://win.vekil:8080", https: "http://win.vekil:8080" });
      assert.equal(resolveProxy({ file, env: { HTTPS_PROXY: "http://env.vekil:3128", NO_PROXY: "ic.firma" }, windows }).source, "env");
      writeNetworkSettings(file, { mode: "manual", proxy: "elle.vekil:9000", bypass: "*.firma.local" });
      const manual = resolveProxy({ file, env: { HTTPS_PROXY: "http://env.vekil:3128" }, windows });
      assert.equal(manual.source, "manual");
      assert.equal(manual.proxy.https, "http://elle.vekil:9000");
      assert.deepEqual(manual.bypass, ["*.firma.local"]);
      writeNetworkSettings(file, { mode: "none" });
      assert.equal(resolveProxy({ file, env: { HTTPS_PROXY: "http://env.vekil:3128" }, windows }).proxy, null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  // Gerçek platform (ders 18): GitHub'ın Windows koşucusunda (CI, yönetici) makine geneli WinHTTP ayarı netsh ile kurulur, program kayıt
  // defterinden okur, sonra ayar sıfırlanır. Geliştirici bilgisayarında (CI yok) makinenin ayarına dokunulmaz, yalnız okuma denenir. Linux'ta okuma yok.
  test("Windows: netsh winhttp ile kurulan makine geneli vekil kayıt defterinden okunur", () => {
    if (process.platform !== "win32") {
      assert.equal(readWindowsProxy(), null);
      assert.equal(readWindowsProxy({ platform: "linux" }), null);
      return;
    }
    if (!process.env.CI) {
      const value = readWindowsProxy();
      assert.ok(value === null || typeof value.proxy === "string");
      return;
    }
    const netsh = args => execFileSync("netsh", ["winhttp", ...args], { encoding: "utf8", windowsHide: true });
    try {
      netsh(["set", "proxy", "proxy-server=vekil-deneme.invalid:8080", "bypass-list=<local>;*.firma.local"]);
      assert.deepEqual(readWindowsProxy(), { proxy: "vekil-deneme.invalid:8080", bypass: "<local>;*.firma.local" });
      const resolved = resolveProxy({ env: {} });
      assert.equal(resolved.source, "windows");
      assert.equal(resolved.proxy.https, "http://vekil-deneme.invalid:8080");
      assert.equal(isBypassed("sunucu", resolved.bypass), true);
      assert.equal(isBypassed("muhasebe.firma.local", resolved.bypass), true);
      assert.equal(isBypassed("api.github.com", resolved.bypass), false);
    } finally {
      netsh(["reset", "proxy"]);
    }
    assert.equal(readWindowsProxy(), null, "sıfırlanınca vekil yok");
  });
  test("Windows kayıt defteri dakikada bir okunur (her istekte değil)", () => {
    let reads = 0;
    let clock = 0;
    const resolve = cachedResolver({ env: {}, platform: "win32", windowsTtlMs: 60_000, now: () => clock, readWindows: () => (reads += 1, { proxy: "w:1", bypass: "" }) });
    resolve();
    resolve();
    clock = 59_000;
    resolve();
    assert.equal(reads, 1);
    clock = 61_000;
    resolve();
    assert.equal(reads, 2);
  });
});

describe("Vekil sunucu üzerinden istek (sahte vekil + TLS tüneli)", () => {
  let fakeProxy;
  let proxyPort;
  let targetTls;
  let targetHttp;
  let directServer;
  let cert;
  const seen = [];
  const sockets = new Set();
  const AUTH = `Basic ${Buffer.from("ali:gizli").toString("base64")}`;
  before(async () => {
    const pair = selfSignedCert("edm.test");
    cert = pair.cert;
    // Hedef: TLS sunucu (edm.test) — gelen isteğin yöntemini, yolunu ve gövdesini yanıtlar; /yonlen 302 verir.
    targetTls = tls.createServer({ cert: pair.cert, key: pair.key }, socket => {
      const inner = http.createServer((req, res) => {
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", () => {
          if (req.url === "/yonlen") {
            res.writeHead(302, { location: "/varis" });
            return res.end();
          }
          res.writeHead(200, { "content-type": "text/plain", "set-cookie": ["a=1", "b=2"] });
          res.end(`TLS ${req.method} ${req.url} ${body}`);
        });
      });
      inner.emit("connection", socket);
    });
    await new Promise(resolve => targetTls.listen(0, "127.0.0.1", resolve));
    targetHttp = http.createServer((req, res) => res.end(`HTTP ${req.method} ${req.url}`));
    await new Promise(resolve => targetHttp.listen(0, "127.0.0.1", resolve));
    directServer = http.createServer((req, res) => res.end("dogrudan"));
    await new Promise(resolve => directServer.listen(0, "127.0.0.1", resolve));
    fakeProxy = http.createServer((req, res) => {
      seen.push({ kind: "http", url: req.url, auth: req.headers["proxy-authorization"] || "" });
      if (req.headers["proxy-authorization"] !== AUTH) {
        res.writeHead(407, { "proxy-authenticate": "Basic" });
        return res.end();
      }
      const target = new URL(req.url);
      const forward = http.request({ host: "127.0.0.1", port: targetHttp.address().port, method: req.method, path: `${target.pathname}${target.search}`, headers: req.headers }, upstream => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      });
      req.pipe(forward);
    });
    fakeProxy.on("connect", (req, client) => {
      seen.push({ kind: "connect", url: req.url, auth: req.headers["proxy-authorization"] || "" });
      if (req.headers["proxy-authorization"] !== AUTH) {
        client.end("HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic\r\n\r\n");
        return;
      }
      if (req.url !== "edm.test:443") {
        client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
        return;
      }
      const upstream = net.connect(targetTls.address().port, "127.0.0.1", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on("error", () => client.destroy());
    });
    for (const server of [fakeProxy, targetTls, targetHttp, directServer]) server.on(server === targetTls ? "secureConnection" : "connection", socket => sockets.add(socket));
    targetTls.on("connection", socket => sockets.add(socket));
    await new Promise(resolve => fakeProxy.listen(0, "127.0.0.1", resolve));
    proxyPort = fakeProxy.address().port;
  });
  after(async () => {
    // Tünel soketleri ve keep-alive bağlantıları açık kalırsa close() beklemede kalır; hepsi yok edilir.
    for (const socket of sockets) socket.destroy();
    for (const server of [fakeProxy, targetTls, targetHttp, directServer]) await new Promise(resolve => server.close(resolve));
  });
  const fetchVia = (proxyText, bypass = []) => createProxyFetch({ resolve: () => ({ proxy: normalizeProxy(proxyText), bypass, source: "manual" }), tlsOptions: { ca: cert } });

  test("HTTPS: CONNECT tüneli + TLS; yöntem, yol, gövde ve çoklu başlık geçer; vekil yalnız ana bilgisayar:port görür", async () => {
    const proxyFetch = fetchVia(`http://ali:gizli@127.0.0.1:${proxyPort}`);
    const before = seen.length;
    const response = await proxyFetch("https://edm.test/EFaturaEDM.svc?x=1", { method: "POST", headers: { "content-type": "text/xml" }, body: "<zarf/>" });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "TLS POST /EFaturaEDM.svc?x=1 <zarf/>");
    assert.equal(response.headers.get("set-cookie"), "a=1, b=2");
    const hop = seen.slice(before);
    assert.deepEqual(hop.map(item => [item.kind, item.url, item.auth === AUTH]), [["connect", "edm.test:443", true]]);
  });
  test("HTTPS yönlendirme vekil üzerinden izlenir", async () => {
    const response = await fetchVia(`http://ali:gizli@127.0.0.1:${proxyPort}`)("https://edm.test/yonlen");
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "TLS GET /varis ");
  });
  test("HTTP: istek tam adresle vekile gider", async () => {
    const before = seen.length;
    const response = await fetchVia(`http://ali:gizli@127.0.0.1:${proxyPort}`)("http://guncelleme.test/paket?s=2");
    assert.equal(await response.text(), "HTTP GET /paket?s=2");
    assert.equal(seen.slice(before)[0].url, "http://guncelleme.test/paket?s=2");
  });
  test("kimliksiz vekil 407 → açık Türkçe ileti (HTTPS ve HTTP)", async () => {
    const proxyFetch = fetchVia(`http://127.0.0.1:${proxyPort}`);
    await assert.rejects(proxyFetch("https://edm.test/"), error => error.code === "proxy-auth" && /kimlik doğrulaması istiyor/.test(error.message));
    await assert.rejects(proxyFetch("http://guncelleme.test/"), error => error.code === "proxy-auth");
  });
  test("vekil reddederse (403) ve vekile ulaşılamazsa açık ileti", async () => {
    await assert.rejects(fetchVia(`http://ali:gizli@127.0.0.1:${proxyPort}`)("https://yasak.test/"), error => error.code === "proxy-refused" && /403/.test(error.message));
    const closed = net.createServer();
    await new Promise(resolve => closed.listen(0, "127.0.0.1", resolve));
    const deadPort = closed.address().port;
    await new Promise(resolve => closed.close(resolve));
    await assert.rejects(fetchVia(`http://127.0.0.1:${deadPort}`)("https://edm.test/"), error => error.code === "proxy-unreachable" && /Vekil sunucuya bağlanılamadı/.test(error.message));
  });
  test("yerel adres ve bypass listesindeki ad vekile hiç gitmez", async () => {
    const before = seen.length;
    const proxyFetch = fetchVia(`http://ali:gizli@127.0.0.1:${proxyPort}`, ["edm.test"]);
    assert.equal(await (await proxyFetch(`http://127.0.0.1:${directServer.address().port}/`)).text(), "dogrudan");
    await assert.rejects(proxyFetch("https://edm.test/"));
    assert.equal(seen.length, before, "vekile istek gitmedi");
  });
  test("vekil ayarı yoksa istek doğrudan gider (davranış değişmez)", async () => {
    const before = seen.length;
    const proxyFetch = createProxyFetch({ resolve: () => ({ proxy: null, bypass: [], source: "direct" }) });
    assert.equal(await (await proxyFetch(`http://127.0.0.1:${directServer.address().port}/`)).text(), "dogrudan");
    assert.equal(seen.length, before);
  });
  test("iptal sinyali: tünel kurulurken iptal edilen istek AbortError ile düşer", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(fetchVia(`http://ali:gizli@127.0.0.1:${proxyPort}`)("https://edm.test/", { signal: controller.signal }), error => error.name === "AbortError" || /iptal/.test(error.message));
  });
});
