// 2.4.4 iş listesi 28: vekil sunucu parolası ağ ayarı dosyasında (ag-ayari.json) AÇIK METİN saklanmaz. Entegratör parolasıyla aynı yöntem
// (server/lib/secret-box.mjs, AES-256-GCM; anahtar dosyanın yanında ag-ayari.key). Eski (2.4.3) biçimli açık metin dosya aynen okunur ve ilk
// kayıtta / servis yöneticisinin açılışında mühürlenir; ayarın anlamı (Elle, adres, kullanıcı, hariç tutulanlar) bozulmaz.
// Eski kodda (163dd5d) kırmızı: dosyada parola açık metin, migrateNetworkSettings yok.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import * as netProxy from "../server/lib/net-proxy.mjs";

const { cachedResolver, createProxyFetch, describeNetwork, prepareNetworkSettings, readNetworkSettings, resolveProxy, writeNetworkSettings } = netProxy;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "Gizli@Vekil:9/%x";
const tempDir = () => mkdtempSync(path.join(tmpdir(), "vekil-parola-"));
// 2.4.3'ün yazdığı biçim (writeNetworkSettings 163dd5d): parola adresin içinde, açık metin.
const legacyFile = (dir, proxy) => {
  const file = path.join(dir, "ag-ayari.json");
  writeFileSync(file, `${JSON.stringify({ mode: "manual", proxy, bypass: "*.firma.local" }, null, 2)}\n`);
  return file;
};
const composed = port => prepareNetworkSettings({ mode: "manual", address: `127.0.0.1:${port}`, username: "ofis", password: PASSWORD, bypass: "*.firma.local" }).value.proxy;

describe("Vekil parolası şifreli saklanır", () => {
  test("kaydedilen dosyada parola açık metin yok; mühürlü alan var; okununca parolalı adres geri gelir", () => {
    const dir = tempDir();
    try {
      const file = path.join(dir, "ag-ayari.json");
      const proxy = composed(3128);
      writeNetworkSettings(file, { mode: "manual", proxy, bypass: "*.firma.local" });
      const text = readFileSync(file, "utf8");
      assert.ok(!text.includes(encodeURIComponent(PASSWORD)) && !text.includes(PASSWORD) && !text.includes("Gizli"), `dosyada açık metin parola: ${text}`);
      const raw = JSON.parse(text);
      assert.equal(raw.proxy, "http://ofis@127.0.0.1:3128", "dosyadaki adres parolasız");
      assert.match(raw.passwordSealed || "", /^sb1:/);
      assert.ok(existsSync(path.join(dir, "ag-ayari.key")), "anahtar dosyanın yanında");
      assert.deepEqual(readNetworkSettings(file), { mode: "manual", proxy, bypass: "*.firma.local" });
      const resolved = resolveProxy({ file, env: {}, windows: () => null });
      assert.equal(resolved.source, "manual");
      const url = new URL(resolved.proxy.https);
      assert.equal(decodeURIComponent(url.password), PASSWORD, "özel karakterli parola aynen döner");
      // Ekrana giden özet parolasız (hasPassword yalnız işaret).
      const shown = describeNetwork({ file, env: {}, windows: () => null });
      assert.equal(shown.manual.hasPassword, true);
      assert.ok(!JSON.stringify(shown).includes("Gizli"), JSON.stringify(shown));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("Vekil Sunucu Kullanma / Otomatik seçilse de saklanan adresin parolası açık metin yazılmaz", () => {
    const dir = tempDir();
    try {
      const file = path.join(dir, "ag-ayari.json");
      const previous = { mode: "manual", proxy: composed(8080), bypass: "" };
      for (const mode of ["none", "auto"]) {
        writeNetworkSettings(file, prepareNetworkSettings({ mode, bypass: "" }, previous).value);
        assert.ok(!readFileSync(file, "utf8").includes("Gizli"), mode);
        assert.equal(readNetworkSettings(file).proxy, previous.proxy, `${mode}: parola korunur`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("göç: 2.4.3 biçimli açık metin dosya aynen okunur; ilk kayıtta mühürlenir, ayar bozulmaz", () => {
    const dir = tempDir();
    try {
      const proxy = composed(3128);
      const file = legacyFile(dir, proxy);
      const read = readNetworkSettings(file);
      assert.deepEqual(read, { mode: "manual", proxy, bypass: "*.firma.local" }, "eski dosya okunur");
      assert.equal(resolveProxy({ file, env: {}, windows: () => null }).proxy.https, proxy, "eski dosyayla vekil çalışır");
      // Ekrandan parola boş bırakılarak kaydedilir (kayıtlı parola korunur) → mühürlü biçime geçer.
      const prepared = prepareNetworkSettings({ mode: "manual", address: "127.0.0.1:3128", username: "ofis", password: "", bypass: "*.firma.local" }, read);
      writeNetworkSettings(file, prepared.value);
      assert.ok(!readFileSync(file, "utf8").includes("Gizli"), "ilk kayıttan sonra açık metin yok");
      assert.deepEqual(readNetworkSettings(file), read, "ayarın anlamı aynı");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("göç: migrateNetworkSettings eski dosyayı mühürler (servis yöneticisinin açılışı); parolasız ya da zaten mühürlü dosyaya dokunmaz", () => {
    assert.equal(typeof netProxy.migrateNetworkSettings, "function", "migrateNetworkSettings yok");
    const dir = tempDir();
    try {
      const proxy = composed(3128);
      const file = legacyFile(dir, proxy);
      assert.equal(netProxy.migrateNetworkSettings(file), true);
      assert.ok(!readFileSync(file, "utf8").includes("Gizli"));
      assert.deepEqual(readNetworkSettings(file), { mode: "manual", proxy, bypass: "*.firma.local" });
      const sealed = readFileSync(file, "utf8");
      assert.equal(netProxy.migrateNetworkSettings(file), false, "ikinci kez çevrilmez");
      assert.equal(readFileSync(file, "utf8"), sealed);
      const plainDir = tempDir();
      try {
        const plain = legacyFile(plainDir, "http://ofis@127.0.0.1:3128");
        assert.equal(netProxy.migrateNetworkSettings(plain), false);
        assert.equal(netProxy.migrateNetworkSettings(path.join(plainDir, "yok.json")), false, "dosya yoksa bir şey yapılmaz");
        assert.ok(!existsSync(path.join(plainDir, "ag-ayari.key")), "parolasız dosya için anahtar üretilmez");
      } finally {
        rmSync(plainDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("anahtar kaybolursa (dosya başka bilgisayara taşınmış) Elle ayarı ve adres bozulmaz, yalnız parola yeniden girilir; okuma anahtar üretmez", () => {
    const dir = tempDir();
    try {
      const file = path.join(dir, "ag-ayari.json");
      writeNetworkSettings(file, { mode: "manual", proxy: composed(3128), bypass: "" });
      const moved = tempDir();
      try {
        const copy = path.join(moved, "ag-ayari.json");
        writeFileSync(copy, readFileSync(file));
        const read = readNetworkSettings(copy);
        assert.equal(read.mode, "manual");
        assert.equal(read.proxy, "http://ofis@127.0.0.1:3128");
        assert.equal(describeNetwork({ file: copy, env: {}, windows: () => null }).manual.hasPassword, false);
        assert.ok(!existsSync(path.join(moved, "ag-ayari.key")), "okuma yeni anahtar üretmedi");
      } finally {
        rmSync(moved, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("servis yöneticisi açılışta eski dosyayı mühürler (kaynak denetimi)", () => {
    const source = readFileSync(path.join(ROOT, "server/supervisor.mjs"), "utf8");
    assert.match(source, /migrateNetworkSettings\(networkFile\)/);
  });
});

describe("Mühürlü parola vekil kimlik doğrulamasında kullanılır", () => {
  let fakeProxy;
  let target;
  const auths = [];
  before(async () => {
    target = http.createServer((req, res) => res.end("hedef"));
    await new Promise(resolve => target.listen(0, "127.0.0.1", resolve));
    const expected = `Basic ${Buffer.from(`ofis:${PASSWORD}`).toString("base64")}`;
    fakeProxy = http.createServer((req, res) => {
      auths.push(req.headers["proxy-authorization"] || "");
      if (req.headers["proxy-authorization"] !== expected) {
        res.writeHead(407, { "proxy-authenticate": "Basic" });
        return res.end();
      }
      const url = new URL(req.url);
      const forward = http.request({ host: "127.0.0.1", port: target.address().port, method: req.method, path: url.pathname, headers: req.headers }, upstream => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      });
      req.pipe(forward);
    });
    await new Promise(resolve => fakeProxy.listen(0, "127.0.0.1", resolve));
  });
  after(async () => {
    await new Promise(resolve => fakeProxy.close(resolve));
    await new Promise(resolve => target.close(resolve));
  });
  test("mühürlü dosyayla (ve eski açık metin dosyayla) istek vekilden kimlikli geçer", async () => {
    for (const kind of ["mühürlü", "eski"]) {
      const dir = tempDir();
      try {
        const proxy = composed(fakeProxy.address().port);
        const file = kind === "eski" ? legacyFile(dir, proxy) : path.join(dir, "ag-ayari.json");
        if (kind === "mühürlü") writeNetworkSettings(file, { mode: "manual", proxy, bypass: "" });
        const proxyFetch = createProxyFetch({ resolve: cachedResolver({ file, env: {} }) });
        const response = await proxyFetch("http://guncelleme.test/repos");
        assert.equal(response.status, 200, kind);
        assert.equal(await response.text(), "hedef");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    assert.equal(auths.length, 2);
  });
});
