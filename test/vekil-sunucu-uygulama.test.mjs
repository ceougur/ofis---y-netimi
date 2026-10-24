// Vekil sunucu — program düzeyi (kullanıcı kararı 16.10.2026: "yap"). Programın kendi fetch'i (config.fetchImpl; testlerde ÜZERİNE
// YAZILMAZ) ile: Yönetim → Sistem → Ağ Bağlantısı uçları, e-Belge entegratörü (EDM) trafiğinin sahte vekil sunucudan geçmesi, Bağlantıyı Dene,
// ikinci şirketin aynı ayarı görmesi, servis yöneticisinin (güncelleyici) ve uygulamanın aynı dosyaya bağlı olması.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import tls from "node:tls";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";
import { selfSignedCert } from "./tls-sertifika.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
// Ortamdaki vekil değişkenleri (geliştirme makinesi / CI) "Otomatik"i etkilemesin: testin kendi değerleri verilir.
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "" };

describe("Vekil sunucu: program uçları ve EDM trafiği", () => {
  let edm;
  let server;
  let api;
  let proxy;
  let proxyPort;
  let target;
  let root;
  let edmTls;
  let cert;
  const seen = [];
  const sockets = new Set();
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const edmPort = new URL(edm.url).port;
    // Bağlantıyı Dene hedefi (güncelleme sunucusu yerine yerel sahte sunucu).
    target = http.createServer((req, res) => res.end("{}"));
    await new Promise(resolve => target.listen(0, "127.0.0.1", resolve));
    // Sahte vekil sunucu: tam adresli isteği alır; edm.test → sahte EDM, guncelleme.test → sahte güncelleme sunucusu, gerisi 502.
    proxy = http.createServer((req, res) => {
      seen.push(req.url);
      const url = new URL(req.url);
      const port = url.hostname === "edm.test" ? edmPort : url.hostname === "guncelleme.test" ? target.address().port : null;
      if (!port) {
        res.writeHead(502);
        return res.end();
      }
      const forward = http.request({ host: "127.0.0.1", port, method: req.method, path: `${url.pathname}${url.search}`, headers: { ...req.headers, host: `127.0.0.1:${port}` } }, upstream => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      });
      forward.on("error", () => res.destroy());
      req.pipe(forward);
    });
    // EDM gerçekte https: vekil CONNECT tünelini edm.test:443 için TLS sonlandırıcıya açar; o da çözülmüş isteği sahte EDM'ye aktarır.
    const pair = selfSignedCert("edm.test");
    cert = pair.cert;
    edmTls = tls.createServer({ cert: pair.cert, key: pair.key }, socket => {
      const upstream = net.connect(Number(edmPort), "127.0.0.1");
      socket.pipe(upstream).pipe(socket);
      upstream.on("error", () => socket.destroy());
      socket.on("error", () => upstream.destroy());
    });
    edmTls.on("connection", socket => sockets.add(socket));
    await new Promise(resolve => edmTls.listen(0, "127.0.0.1", resolve));
    proxy.on("connect", (req, client) => {
      seen.push(`CONNECT ${req.url}`);
      if (req.url !== "edm.test:443") return client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      const upstream = net.connect(edmTls.address().port, "127.0.0.1", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        upstream.pipe(client).pipe(upstream);
      });
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
    });
    proxy.on("connection", socket => sockets.add(socket));
    await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
    proxyPort = proxy.address().port;
    root = mkdtempSync(path.join(tmpdir(), "vekil-uygulama-"));
    // Servis adresi yerel olmayan bir ad (edm.test, vekil sunucunun arkasında): canlı kilidi test dışı adresi reddettiği için (2.4.0 bitiş turu Y1/E1)
    // bu sınama canlı açık kurulumla yapılır. 2.4.1 (gözden geçirme G3): Servis Adresi Çalışma Ortamı'yla uyumlu olmalı — Test Ortamı yalnız test adresini
    // kabul eder; test dışı ad (edm.test) bu yüzden Canlı Ortam'la sınanır (sınanan şey vekil yolu, ortam değil).
    server = await startTestServer({ edocEnabled: true, edocLive: true, outboundTls: { ca: cert }, env: { ...NO_ENV_PROXY, HUKUK_NETWORK_FILE: path.join(root, "ag-ayari.json") } });
    const client = server.client();
    api = { login: (...args) => client.login(...args), get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
  });
  after(async () => {
    await server?.close();
    await edm?.close();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => proxy.close(resolve));
    await new Promise(resolve => target.close(resolve));
    await new Promise(resolve => edmTls.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  test("Ağ Bağlantısı ayarı: varsayılan Otomatik; elle adres kaydedilir; parola ekrana ve işlem kaydına çıkmaz, boş bırakılınca korunur", async () => {
    const first = await api.get("/api/admin/network");
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.mode, "auto");
    assert.ok(["direct", "windows"].includes(first.data.effective.source), first.data.effective.source);
    const saved = await api.put("/api/admin/network", { mode: "manual", address: `127.0.0.1:${proxyPort}`, username: "ofis", password: "Vekil-Parola-9", bypass: "*.firma.local" });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.deepEqual(saved.data.manual, { address: `http://127.0.0.1:${proxyPort}`, username: "ofis", hasPassword: true, bypass: "*.firma.local" });
    assert.deepEqual(saved.data.effective, { source: "manual", address: `http://127.0.0.1:${proxyPort}` });
    assert.ok(!JSON.stringify(saved.data).includes("Vekil-Parola-9"), "parola yanıtta yok");
    const again = await api.put("/api/admin/network", { mode: "manual", address: `127.0.0.1:${proxyPort}`, username: "ofis", password: "", bypass: "" });
    assert.equal(again.data.manual.hasPassword, true, "boş parola kayıtlı parolayı korur");
    // 2.4.4 (iş listesi 28): parola dosyada açık metin değil, mühürlü; kayıtlı parola korunur (hasPassword yukarıda).
    const onDisk = readFileSync(path.join(root, "ag-ayari.json"), "utf8");
    assert.doesNotMatch(onDisk, /Vekil-Parola-9/, "dosyada açık metin parola yok");
    assert.match(JSON.parse(onDisk).passwordSealed, /^sb1:/, "parola mühürlü saklanır");
    const auditRows = server.app.store.all("SELECT payload_json AS payload FROM audit_events WHERE type = 'system.network_settings'");
    assert.equal(auditRows.length, 2);
    assert.ok(auditRows.every(row => !String(row.payload).includes("Vekil-Parola-9")), "işlem kaydında parola yok");
    assert.match(auditRows[0].payload, /"mode":"manual"/);
    const bad = await api.put("/api/admin/network", { mode: "manual", address: "vekil:8080/yol" });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /Vekil sunucu adresi geçersiz/);
    assert.equal((await api.put("/api/admin/network", { mode: "baska" })).status, 400);
    // Kimlik doğrulaması bu testin sahte vekilinde istenmiyor; kimliksiz elle ayara dönülür.
    assert.equal((await api.put("/api/admin/network", { mode: "manual", address: `127.0.0.1:${proxyPort}`, username: "" })).data.manual.hasPassword, false);
  });

  test("Yetkisiz kullanıcı ağ ayarını göremez ve değiştiremez", async () => {
    const admin = server.client();
    assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
    const staff = await createUser(server, admin, { username: "vekilpersonel", role: "personel" });
    assert.equal((await staff.get("/api/admin/network")).status, 403);
    assert.equal((await staff.put("/api/admin/network", { mode: "none" })).status, 403);
  });

  test("EDM: Bağlantıyı Test Et istekleri vekil sunucudan geçer; vekil kapatılınca aynı adrese ulaşılamaz", async () => {
    const baseUrl = "https://edm.test/EFaturaEDM21ea/EFaturaEDM.svc";
    const saved = await api.put("/api/workspace/invoices/settings", {
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "live", baseUrl, username: "edmkullanici", password: "Gizli-Parola-1" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.deepEqual(saved.data.integrator.network, { source: "manual", address: `http://127.0.0.1:${proxyPort}` }, "Entegratör kartı yolu gösterir");
    const before = seen.length;
    const tested = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(tested.status, 200, JSON.stringify(tested.data));
    const hops = seen.slice(before);
    // Her istek ayrı tünelle gider (WSDL + giriş + işlem): vekil yalnız "edm.test:443" görür, içerik TLS ile şifreli.
    assert.ok(hops.length >= 2, `vekilden geçen istek sayısı ${hops.length}`);
    assert.ok(hops.every(url => url === "CONNECT edm.test:443"), hops.join(" | "));
    // Vekil kapalı (doğrudan): edm.test ad çözümlemesi yok → bağlantı kurulamaz; istek vekile gitmez.
    assert.equal((await api.put("/api/admin/network", { mode: "none" })).status, 200);
    resetEdmCaches();
    const direct = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.notEqual(direct.status, 200, "vekilsiz ulaşılamaz");
    assert.equal(seen.length, before + hops.length, "vekile yeni istek gitmedi");
    // Vekil adresi ölü porta: anlaşılır Türkçe ileti.
    const dead = net.createServer();
    await new Promise(resolve => dead.listen(0, "127.0.0.1", resolve));
    const deadPort = dead.address().port;
    await new Promise(resolve => dead.close(resolve));
    await api.put("/api/admin/network", { mode: "manual", address: `127.0.0.1:${deadPort}` });
    resetEdmCaches();
    const unreachable = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.notEqual(unreachable.status, 200);
    assert.match(JSON.stringify(unreachable.data), /Vekil sunucuya bağlanılamadı/);
    // 2.4.3 (uzman UX14): kullanıcı iletisinde teknik kod yok (kod detail'de).
    assert.doesNotMatch(String(unreachable.data.error || ""), /ECONN|UND_ERR|EPIPE/, unreachable.data.error);
    await api.put("/api/admin/network", { mode: "manual", address: `127.0.0.1:${proxyPort}` });
  });

  test("Bağlantıyı Dene: kaydedilmiş ayarla güncelleme sunucusuna gidilir, yol ve süre yazılır", async () => {
    // Yapılandırma dondurulmuştur; deneme adresi (güncelleme sunucusu yerine sahte sunucu) aynı ayar dosyasını okuyan ikinci bir sunucuya verilir.
    const probe = await startTestServer({ env: { ...NO_ENV_PROXY, HUKUK_NETWORK_FILE: path.join(root, "ag-ayari.json") }, networkTestUrl: "http://guncelleme.test/repos" });
    try {
      const client = probe.client();
      assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
      const before = seen.length;
      const outcome = unwrap(await client.post("/api/admin/network/test", {}));
      assert.equal(outcome.status, 200, JSON.stringify(outcome.data));
      assert.equal(outcome.data.ok, true, JSON.stringify(outcome.data));
      assert.deepEqual(outcome.data.via, { source: "manual", address: `http://127.0.0.1:${proxyPort}` });
      assert.deepEqual(seen.slice(before), ["http://guncelleme.test/repos"]);
    } finally {
      await probe.close();
    }
  });

  test("İkinci şirket aynı (makine geneli) ayarı görür", async () => {
    const created = await api.post("/api/companies", { name: "Vekil İkinci Şirket", select: true });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const seenBy002 = await api.get("/api/admin/network");
    assert.equal(seenBy002.data.mode, "manual");
    assert.equal(seenBy002.data.effective.address, `http://127.0.0.1:${proxyPort}`);
    await api.post("/api/companies/select", { id: "sirket-001" });
  });
});

describe("Vekil sunucu: bağlantılar (kaynak denetimi)", () => {
  const read = file => readFileSync(path.join(ROOT, file), "utf8");
  test("servis yöneticisi güncelleyiciye vekil fetch'i verir ve uygulamaya aynı ayar dosyasını geçirir", () => {
    const source = read("server/supervisor.mjs");
    assert.match(source, /const outboundFetch = options\.fetchImpl \|\| createProxyFetch\(\{ resolve: cachedResolver\(\{ file: networkFile, env \}\) \}\)/);
    assert.match(source, /fetchImpl: outboundFetch,\r?\n\s+trustedKeys/);
    assert.match(source, /HUKUK_NETWORK_FILE: networkFile/);
  });
  test("lisans, E-Tablolar ve entegratör programın (vekil) fetch'ini kullanır", () => {
    const app = read("server/app.mjs");
    assert.match(app, /createSheetsReader\(\{ fetchImpl: config\.fetchImpl/);
    assert.match(app, /services: config\.licenseServices,\r?\n\s+fetchImpl: config\.fetchImpl/);
    assert.match(read("server/routes/invoices.mjs"), /connect\(\{ integrator: \{ \.\.\.cfg, password \}, seller: sellerParty\(s\), fetchImpl: config\.fetchImpl \}\)/);
    assert.match(read("server/routes/accounts.mjs"), /readSheetMatrices\(url, \{ fetchImpl: config\.fetchImpl/);
    assert.match(read("server/lib/config.mjs"), /fetchImpl: overrides\.fetchImpl \|\| createProxyFetch\(/);
  });
});
