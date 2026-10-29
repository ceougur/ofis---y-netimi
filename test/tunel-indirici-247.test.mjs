// 2.4.7 M4 — cloudflared indirici/doğrulayıcı (server/lib/tunnel/download.mjs, release.mjs; docs/mobil/M4-TASARIM.md §3).
// Gerçek ikili İNDİRİLMEZ: yerel sahte yayın sunucusu bayt dizisi verir; özet testte hesaplanır (kâhin: node:crypto, programdan bağımsız sha256).
// "Nasıl bozulur": yanlış özet (ele geçmiş adres / vekil), yarım indirme (bağlantı koptu), ağ yok, diskte değiştirilmiş dosya, aşırı büyük yanıt,
// özet sabitlenmemiş sürüm, desteklenmeyen platform. Her durumda: yarım/yanlış dosya ÇALIŞTIRILABİLİR yerde kalmaz.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { ensureBinary } from "../server/lib/tunnel/download.mjs";
import { CLOUDFLARED_ASSETS, CLOUDFLARED_VERSION, assetFor } from "../server/lib/tunnel/release.mjs";

const BYTES = Buffer.from(Array.from({ length: 300_000 }, (_, i) => (i * 7 + 3) % 251));
const GOOD = createHash("sha256").update(BYTES).digest("hex");
const root = mkdtempSync(path.join(tmpdir(), "m4-indirici-"));
let server;
let base;
let hits = 0;
const mode = { value: "ok" };

before(async () => {
  server = http.createServer((req, res) => {
    hits += 1;
    if (mode.value === "half") {
      res.writeHead(200, { "content-length": BYTES.length });
      res.write(BYTES.subarray(0, BYTES.length / 2));
      setTimeout(() => res.socket.destroy(), 20);
      return;
    }
    if (mode.value === "500") return res.writeHead(500).end();
    res.writeHead(200, { "content-length": BYTES.length });
    res.end(BYTES);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
});

const asset = (over = {}) => ({ file: "cloudflared-sahte", url: `${base}/cloudflared`, sha256: GOOD, maxBytes: 10 * 1024 * 1024, version: "2099.1.1", ...over });
const fresh = name => {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};
const listAll = dir => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String) : []);

describe("M4 indirici: yalnız özeti kodda sabit dosya çalıştırılabilir yerde durur", () => {
  test("doğru özet → indirilir, bayt bayt aynı; ikinci çağrı indirmez (özet yeniden denetlenir)", async () => {
    mode.value = "ok";
    const dir = fresh("dogru");
    hits = 0;
    const first = await ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } });
    assert.equal(first.downloaded, true);
    assert.ok(readFileSync(first.path).equals(BYTES), "indirilen dosya yayındakiyle aynı");
    assert.equal(path.basename(first.path), "cloudflared-sahte");
    const second = await ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } });
    assert.equal(second.downloaded, false);
    assert.equal(hits, 1, "ikinci çağrıda ağ kullanılmadı");
    assert.ok(!listAll(dir).some(name => name.endsWith(".part")), ".part kalmadı");
  });

  test("yanlış özet → dosya silinir, TunnelError(hash), çalıştırılabilir dosya YOK", async () => {
    mode.value = "ok";
    const dir = fresh("yanlis");
    await assert.rejects(ensureBinary({ root: dir, asset: asset({ sha256: "0".repeat(64) }), fetchImpl: fetch, log: { warn() {} } }), error => {
      assert.equal(error.code, "hash", `beklenen hash, gelen ${error.code}: ${error.message}`);
      return true;
    });
    assert.deepEqual(listAll(dir).filter(name => !name.match(/^2099\.1\.1$/)), [], `klasörde dosya kalmadı: ${listAll(dir)}`);
  });

  test("yarım indirme (bağlantı koptu) → TunnelError(network), .part silinir; sonraki deneme baştan, başarılı", async () => {
    const dir = fresh("yarim");
    mode.value = "half";
    await assert.rejects(ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } }), error => {
      assert.equal(error.code, "network", `beklenen network, gelen ${error.code}: ${error.message}`);
      return true;
    });
    assert.equal(existsSync(path.join(dir, "2099.1.1", "cloudflared-sahte")), false, "yarım dosya hedef adla durmuyor");
    assert.equal(existsSync(path.join(dir, "2099.1.1", "cloudflared-sahte.part")), false, ".part silindi");
    mode.value = "ok";
    const done = await ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } });
    assert.ok(readFileSync(done.path).equals(BYTES));
  });

  test("ağ yok / HTTP 500 → TunnelError(network); dosya yok", async () => {
    const dir = fresh("ag");
    await assert.rejects(ensureBinary({ root: dir, asset: asset(), fetchImpl: () => Promise.reject(new TypeError("fetch failed")), log: { warn() {} } }), { code: "network" });
    mode.value = "500";
    await assert.rejects(ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } }), { code: "network" });
    mode.value = "ok";
    assert.equal(existsSync(path.join(dir, "2099.1.1", "cloudflared-sahte")), false);
  });

  test("diskte değiştirilmiş dosya çalıştırılmaz: özet tutmaz → silinir, yeniden indirilir", async () => {
    mode.value = "ok";
    const dir = fresh("degismis");
    const first = await ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } });
    writeFileSync(first.path, "kotu niyetli icerik");
    hits = 0;
    const again = await ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } });
    assert.equal(again.downloaded, true);
    assert.equal(hits, 1);
    assert.ok(readFileSync(again.path).equals(BYTES));
  });

  test("boyut sınırı: beklenenden büyük yanıt indirilmez (TunnelError size)", async () => {
    mode.value = "ok";
    const dir = fresh("buyuk");
    await assert.rejects(ensureBinary({ root: dir, asset: asset({ maxBytes: 1000 }), fetchImpl: fetch, log: { warn() {} } }), { code: "size" });
    assert.equal(existsSync(path.join(dir, "2099.1.1", "cloudflared-sahte")), false);
  });

  test("eski sürüm klasörü (yalnız yıl.ay.yama adlı) temizlenir; başka dosyaya dokunulmaz", async () => {
    mode.value = "ok";
    const dir = fresh("eski");
    mkdirSync(path.join(dir, "2024.1.0"), { recursive: true });
    writeFileSync(path.join(dir, "2024.1.0", "cloudflared-sahte"), "eski");
    writeFileSync(path.join(dir, "tunel.yml"), "{}");
    await ensureBinary({ root: dir, asset: asset(), fetchImpl: fetch, log: { warn() {} } });
    assert.equal(existsSync(path.join(dir, "2024.1.0")), false);
    assert.equal(existsSync(path.join(dir, "tunel.yml")), true);
  });

  test("özet sabitlenmemiş tanım indirilmez bile (TunnelError unpinned; ağ kullanılmaz)", async () => {
    hits = 0;
    await assert.rejects(ensureBinary({ root: fresh("bos"), asset: asset({ sha256: "" }), fetchImpl: fetch, log: { warn() {} } }), { code: "unpinned" });
    assert.equal(hits, 0);
  });
});

describe("M4 sabit sürüm tanımı (release.mjs)", () => {
  test("Windows amd64 ve Linux amd64 tanımlı; adres Cloudflare'in kendi yayını ve sürüm sabit; özet ya boş ya 64 onaltılık", () => {
    assert.match(CLOUDFLARED_VERSION, /^\d{4}\.\d{1,2}\.\d{1,3}$/);
    for (const key of ["win32-x64", "linux-x64"]) {
      const item = CLOUDFLARED_ASSETS[key];
      assert.ok(item, key);
      assert.ok(item.url.startsWith(`https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/`), item.url);
      assert.ok(item.sha256 === "" || /^[0-9a-f]{64}$/.test(item.sha256), `${key} özeti biçimi`);
    }
    assert.equal(CLOUDFLARED_ASSETS["win32-x64"].file, "cloudflared.exe");
  });
  test("assetFor: desteklenmeyen platform → platform; özetsiz → unpinned; özetli → tanım", () => {
    assert.equal(assetFor({ platform: "darwin", arch: "arm64" }).reason, "platform");
    const assets = { "linux-x64": { file: "c", url: "x", sha256: "", maxBytes: 1 } };
    assert.equal(assetFor({ platform: "linux", arch: "x64", assets }).reason, "unpinned");
    const pinned = { "linux-x64": { file: "c", url: "x", sha256: GOOD, maxBytes: 1 } };
    assert.equal(assetFor({ platform: "linux", arch: "x64", assets: pinned, version: "2099.1.1" }).asset.version, "2099.1.1");
  });
});
