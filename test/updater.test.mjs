// Güncelleyici birim testleri: sürüm karşılaştırma, imza zinciri, GitHub yayın listesi, indirme ve paket açma.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pruneVersions, readCurrent, writeCurrent } from "../server/lib/app-layout.mjs";
import { compareVersions, normalizeVersion } from "../server/lib/semver.mjs";
import { assessManifest, signManifest, verifyEnvelope } from "../server/lib/update-envelope.mjs";
import { TRUSTED_UPDATE_KEYS } from "../server/lib/update-keys.mjs";
import { createUpdater } from "../server/lib/updater.mjs";
import { createZip } from "../server/lib/zip.mjs";
import { plainNotes, releaseNotes } from "../tools/lib/update-package.mjs";
import { buildRelease, makeKeys, makeVersion, releaseFiles, startMockGithub } from "./update-helpers.mjs";

const baseManifest = (overrides = {}) => ({
  schema: 1,
  product: "DestekOfis",
  version: "1.4.0",
  channel: "stable",
  notes: "Yenilikler",
  package: { name: "destekofis-guncelleme-1.4.0.zip", size: 1234, sha256: "a".repeat(64) },
  requires: { node: "22.13.0", bootstrap: 2 },
  ...overrides,
});

describe("sürüm karşılaştırma", () => {
  it("anlamsal sürüm kurallarına uyar", () => {
    assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
    assert.ok(compareVersions("v1.3.0", "1.3.0") === 0);
    assert.ok(compareVersions("1.4.0-beta.2", "1.4.0-beta.10") < 0);
    assert.ok(compareVersions("1.4.0-beta.1", "1.4.0") < 0);
    assert.ok(compareVersions("2.0.0", "1.99.99") > 0);
    assert.ok(compareVersions("bozuk", "0.0.1") < 0);
    assert.equal(normalizeVersion("v2.1.3"), "2.1.3");
    assert.equal(normalizeVersion("2.1"), null);
  });
});

describe("imzalı güncelleme bildirgesi", () => {
  const keys = makeKeys();
  const other = makeKeys("baska-1");

  it("güvenilen anahtarla imzalı bildirgeyi kabul eder", () => {
    const { manifest, keyId } = verifyEnvelope(signManifest(baseManifest(), keys.privateKeyPem, keys.keyId), keys.trusted);
    assert.equal(keyId, "test-1");
    assert.equal(manifest.version, "1.4.0");
    assert.equal(manifest.requires.bootstrap, 2);
  });

  it("değiştirilmiş içerik, bilinmeyen anahtar ve sahte kimlik reddedilir", () => {
    const envelope = signManifest(baseManifest(), keys.privateKeyPem, keys.keyId);
    const tampered = { ...envelope, payload: Buffer.from(JSON.stringify(baseManifest({ version: "9.9.9" }))).toString("base64") };
    assert.throws(() => verifyEnvelope(tampered, keys.trusted), error => error.code === "SIGNATURE_INVALID");
    assert.throws(() => verifyEnvelope(signManifest(baseManifest(), other.privateKeyPem, other.keyId), keys.trusted), error => error.code === "SIGNATURE_INVALID");
    // Başka anahtarla imzalayıp güvenilen anahtarın kimliğini yazmak işe yaramaz.
    assert.throws(() => verifyEnvelope(signManifest(baseManifest(), other.privateKeyPem, keys.keyId), keys.trusted), error => error.code === "SIGNATURE_INVALID");
    assert.throws(() => verifyEnvelope({ schema: 2 }, keys.trusted), error => error.code === "ENVELOPE_INVALID");
  });

  it("geçersiz bildirge alanları reddedilir", () => {
    for (const bad of [{ product: "Baska" }, { version: "1.4" }, { channel: "gece" }, { package: { name: "../x.zip", size: 1, sha256: "a".repeat(64) } }, { package: { name: "p.zip", size: 0, sha256: "a".repeat(64) } }]) {
      assert.throws(() => verifyEnvelope(signManifest(baseManifest(bad), keys.privateKeyPem, keys.keyId), keys.trusted), error => error.code === "MANIFEST_INVALID", JSON.stringify(bad));
    }
  });

  it("uyumluluk: eski sürüm, kanal, en düşük sürüm, çalışma zamanı ve başlatıcı", () => {
    const manifest = verifyEnvelope(signManifest(baseManifest({ requires: { minVersion: "1.3.0", node: "24.0.0", bootstrap: 3 } }), keys.privateKeyPem, keys.keyId), keys.trusted).manifest;
    assert.equal(assessManifest(manifest, { currentVersion: "1.4.0" }).code, "NOT_NEWER");
    assert.equal(assessManifest(manifest, { currentVersion: "1.2.0", nodeVersion: "24.1.0", bootstrapVersion: 3 }).code, "MIN_VERSION");
    assert.equal(assessManifest(manifest, { currentVersion: "1.3.0", nodeVersion: "22.20.0", bootstrapVersion: 3 }).code, "NODE");
    assert.equal(assessManifest(manifest, { currentVersion: "1.3.0", nodeVersion: "24.1.0", bootstrapVersion: 2 }).code, "BOOTSTRAP");
    assert.ok(assessManifest(manifest, { currentVersion: "1.3.0", nodeVersion: "24.1.0", bootstrapVersion: 3 }).ok);
    const beta = verifyEnvelope(signManifest(baseManifest({ channel: "beta" }), keys.privateKeyPem, keys.keyId), keys.trusted).manifest;
    assert.equal(assessManifest(beta, { currentVersion: "1.3.0", bootstrapVersion: 2 }).code, "CHANNEL");
    assert.ok(assessManifest(beta, { currentVersion: "1.3.0", channel: "beta", bootstrapVersion: 2 }).ok);
  });

  it("ürüne gömülü anahtar geçerli bir Ed25519 açık anahtarıdır", () => {
    const [keyId] = Object.keys(TRUSTED_UPDATE_KEYS);
    assert.ok(keyId);
    assert.throws(() => verifyEnvelope(signManifest(baseManifest(), keys.privateKeyPem, keyId), TRUSTED_UPDATE_KEYS), error => error.code === "SIGNATURE_INVALID");
  });

  it("sürüm notları CHANGELOG'dan çıkarılır", () => {
    const text = "# Günlük\n\n## 1.4.0 — Yeni\n\n- a\n- b\n\n## 1.3.0 — Eski\n\n- c\n";
    assert.equal(releaseNotes(text, "1.4.0"), "1.4.0 — Yeni\n\n- a\n- b");
    assert.equal(releaseNotes(text, "1.3.0"), "1.3.0 — Eski\n\n- c");
    assert.equal(releaseNotes(text, "2.0.0"), "");
    assert.equal(plainNotes("1.3.3 — Başlık\n\n- **Kalın** metin ve `-kesfet-dosya`\n  - alt madde\n* yıldızlı"), "1.3.3 — Başlık\n\n• Kalın metin ve -kesfet-dosya\n  • alt madde\n• yıldızlı");
    assert.equal(plainNotes("- *Ofis geneli* kanalı, *✓ İletildi / ✓✓ Okundu* bilgisi; 3 * 4 = 12, dosya_adı"), "• Ofis geneli kanalı, ✓ İletildi / ✓✓ Okundu bilgisi; 3 * 4 = 12, dosya_adı");
  });
});

describe("güncelleyici (sahte GitHub ile)", () => {
  const keys = makeKeys();
  let work;
  let github;
  let good;
  let beta;
  const updaterFor = (overrides = {}) => {
    const appsDir = path.join(work, "kurulum", "app");
    mkdirSync(appsDir, { recursive: true });
    return createUpdater({ appsDir, configDir: path.join(work, "kurulum", "config"), currentVersion: "9.0.0", trustedKeys: keys.trusted, githubApi: github.url, defaultFeed: "github:test/repo", bootstrapVersion: 2, ...overrides });
  };

  before(async () => {
    work = mkdtempSync(path.join(tmpdir(), "destekofis-guncelleyici-"));
    good = buildRelease(makeVersion(path.join(work, "src-9.0.1"), "9.0.1"), path.join(work, "rel-9.0.1"), keys);
    beta = buildRelease(makeVersion(path.join(work, "src-9.1.0-beta.1"), "9.1.0-beta.1"), path.join(work, "rel-beta"), keys, { channel: "beta" });
    github = await startMockGithub([
      { tag: "v9.1.0-beta.1", prerelease: true, files: releaseFiles(beta) },
      { tag: "v9.0.1", files: releaseFiles(good) },
      { tag: "v9.0.0", files: {} },
    ]);
  });
  after(async () => {
    await github?.close();
    rmSync(work, { recursive: true, force: true });
  });

  it("kararlı kanalda en yeni kararlı sürümü bulur; ön sürümü yalnızca beta kanalı görür", async () => {
    const updater = updaterFor();
    const found = await updater.check();
    assert.equal(found.status, "available");
    assert.equal(found.version, "9.0.1");
    assert.match(found.manifest.notes, /Test sürümü/);
    assert.equal(updater.state().lastCheck.status, "available");
    updater.saveConfig({ channel: "beta" });
    assert.equal((await updater.check()).version, "9.1.0-beta.1");
    updater.saveConfig({ channel: "stable" });
    assert.throws(() => updater.saveConfig({ channel: "gece" }), /Geçersiz/);
  });

  it("indirir, özeti doğrular ve paketi app\\<sürüm> olarak açar", async () => {
    const updater = updaterFor();
    const found = await updater.check();
    const progress = [];
    const zip = await updater.download(found, { onProgress: item => progress.push(item) });
    assert.equal(progress.at(-1).received, found.manifest.package.size);
    const dir = updater.stage(found, zip);
    assert.equal(path.basename(dir), "9.0.1");
    assert.equal(JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version, "9.0.1");
    assert.equal(JSON.parse(readFileSync(path.join(dir, ".paket.json"), "utf8")).sha256, found.manifest.package.sha256);
    assert.ok(existsSync(path.join(dir, "server", "supervisor.mjs")));
    assert.ok(!existsSync(updater.paths.downloadDir), "indirme klasörü temizlenmeli");
    assert.ok(!readdirSync(path.dirname(dir)).some(name => name.endsWith(".tmp")));
  });

  it("paket özeti tutmazsa hiçbir şey kurulmaz", async () => {
    const updater = updaterFor({ appsDir: path.join(work, "k2", "app") });
    mkdirSync(path.join(work, "k2", "app"), { recursive: true });
    const found = await updater.check();
    const corrupt = Buffer.from(readFileSync(good.zipPath));
    corrupt[corrupt.length - 30] ^= 0xff;
    github.setReleases([{ tag: "v9.0.1", files: { [path.basename(good.zipPath)]: corrupt, "destekofis-guncelleme.json": good.manifestPath } }]);
    try {
      await assert.rejects(updater.download(found), error => error.code === "HASH_MISMATCH");
      assert.ok(!existsSync(path.join(work, "k2", "app", "9.0.1")));
    } finally {
      github.setReleases([{ tag: "v9.0.1", files: releaseFiles(good) }]);
    }
  });

  it("yayın etiketi ile bildirge sürümü uyuşmazsa veya imza geçersizse kurulmaz", async () => {
    github.setReleases([{ tag: "v9.0.5", files: releaseFiles(good) }]);
    let result = await updaterFor().check();
    assert.equal(result.status, "error");
    assert.match(result.reason, /uyuşmuyor/);
    const stranger = makeKeys("test-1");
    const forged = buildRelease(makeVersion(path.join(work, "src-sahte"), "9.0.2"), path.join(work, "rel-sahte"), stranger, { trustedKeys: stranger.trusted });
    github.setReleases([{ tag: "v9.0.2", files: releaseFiles(forged) }]);
    result = await updaterFor().check();
    assert.equal(result.status, "error");
    assert.match(result.reason, /imza/);
    github.setReleases([{ tag: "v9.0.1", files: releaseFiles(good) }]);
  });

  it("daha önce başarısız olan sürüm atlanır; kurulum dosyası gerektiren sürüm bildirilir", async () => {
    const updater = updaterFor();
    updater.recordFailure("9.0.1", "deneme");
    const skipped = await updater.check();
    assert.equal(skipped.status, "up-to-date");
    assert.deepEqual(skipped.skipped, ["9.0.1"]);
    updater.clearFailure("9.0.1");
    assert.equal((await updater.check()).status, "available");
    const strict = updaterFor({ appsDir: path.join(work, "k3", "app"), bootstrapVersion: 1 });
    const result = await strict.check();
    assert.equal(result.status, "incompatible");
    assert.match(result.reason, /kurulum dosyası/);
  });

  it("ağ hatası yeniden denenebilir, olmayan depo denenemez olarak bildirilir", async () => {
    const offline = updaterFor({ githubApi: "http://127.0.0.1:9" });
    const result = await offline.check();
    assert.equal(result.status, "error");
    assert.equal(result.retryable, true);
    const missing = updaterFor({ defaultFeed: "github:test/yok" });
    const notFound = await missing.check();
    assert.equal(notFound.status, "error");
    assert.equal(notFound.retryable, false);
  });

  it("imzalı bildirge adresi (GitHub dışı kaynak) da desteklenir", async () => {
    const updater = updaterFor({ appsDir: path.join(work, "k4", "app"), defaultFeed: `${github.url}/download/v9.0.1/destekofis-guncelleme.json` });
    mkdirSync(path.join(work, "k4", "app"), { recursive: true });
    const found = await updater.check();
    assert.equal(found.status, "available");
    assert.equal(found.packageUrl, `${github.url}/download/v9.0.1/${path.basename(good.zipPath)}`);
    const dir = updater.stage(found, await updater.download(found));
    assert.ok(existsSync(path.join(dir, "client", "index.html")));
  });

  it("paket içindeki sürüm bildirgeyle aynı değilse veya dosya eksikse açılmaz", async () => {
    const appsDir = path.join(work, "k5", "app");
    mkdirSync(appsDir, { recursive: true });
    const updater = updaterFor({ appsDir });
    const zip = createZip([{ name: "package.json", data: Buffer.from('{"version":"9.0.1"}') }]);
    const zipPath = path.join(work, "eksik.zip");
    writeFileSync(zipPath, zip);
    const { createHash } = await import("node:crypto");
    const found = { version: "9.0.1", manifest: { version: "9.0.1", package: { sha256: createHash("sha256").update(zip).digest("hex") } } };
    assert.throws(() => updater.stage(found, zipPath), error => error.code === "PACKAGE_INVALID" && /eksik/.test(error.message));
    assert.deepEqual(readdirSync(appsDir), []);
  });
});

describe("kurulum düzeni yardımcıları", () => {
  it("current.json atomik yazılır; eski sürümler ve yarım klasörler temizlenir", () => {
    const appsDir = mkdtempSync(path.join(tmpdir(), "destekofis-duzen-"));
    try {
      for (const version of ["1.0.0", "1.1.0", "1.2.0", "1.3.0"]) mkdirSync(path.join(appsDir, version, "server"), { recursive: true });
      mkdirSync(path.join(appsDir, ".1.4.0-abcd.tmp"));
      writeCurrent(appsDir, { version: "1.3.0", previous: "1.2.0", pending: undefined });
      assert.deepEqual(readCurrent(appsDir), { version: "1.3.0", previous: "1.2.0" });
      const removed = pruneVersions(appsDir, ["1.3.0", "1.2.0"]);
      assert.deepEqual(removed.sort(), [".1.4.0-abcd.tmp", "1.0.0", "1.1.0"]);
      assert.deepEqual(readdirSync(appsDir).sort(), ["1.2.0", "1.3.0", "current.json"]);
    } finally {
      rmSync(appsDir, { recursive: true, force: true });
    }
  });
});
