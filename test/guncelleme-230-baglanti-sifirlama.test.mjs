// Güncelleme denetimi — boşta kapanan keep-alive bağlantısı (15.10.2026; CI 60ed59d ve 037fcc7 Windows Node 22 test/updater.test.mjs:151 ikinci denetim
// "NETWORK — Güncelleme sunucusuna bağlanılamadı", aynı kodla sonraki koşu yeşil). Kök neden: ilk istekten sonra sunucu boşta kalan keep-alive
// bağlantısını kapatır; istemci (fetch) aynı bağlantıyı yeniden kullanınca ECONNRESET / "other side closed" alır. Zorla üretme (ders 20): mock
// GitHub yeniden kullanılan bağlantıdaki ikinci isteği yanıt vermeden koparır (Linux'ta boşta kopma istemcice önceden fark ediliyor; yarışın kendisi bu). Beklenen: denetim yeni bağlantıyla bir kez kendiliğinden
// yinelenir ve "up-to-date" döner; eski kodda "error" (NETWORK).
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createUpdater } from "../server/lib/updater.mjs";
import { buildRelease, makeKeys, makeVersion, releaseFiles, startMockGithub } from "./update-helpers.mjs";

const quiet = { info() {}, warn() {}, error() {}, debug() {} };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("güncelleme denetimi: sunucu boşta keep-alive bağlantısını kapatınca ikinci denetim düşmez", () => {
  let work, github, keys;
  before(async () => {
    work = mkdtempSync(path.join(tmpdir(), "destekofis-baglanti-"));
    keys = makeKeys();
    const release = buildRelease(makeVersion(path.join(work, "src"), "9.0.1"), path.join(work, "rel"), keys);
    github = await startMockGithub([{ tag: "v9.0.1", files: releaseFiles(release) }], { resetOnReuse: true });
  });
  after(async () => {
    await github?.close();
    rmSync(work, { recursive: true, force: true });
  });

  it("ön koşul gerçekleşir (sunucu bağlantıyı koparır) ve denetim yine sonuç verir", async () => {
    const appsDir = path.join(work, "kurulum", "app");
    mkdirSync(appsDir, { recursive: true });
    const updater = createUpdater({ appsDir, configDir: path.join(work, "kurulum", "config"), currentVersion: "9.0.1", trustedKeys: keys.trusted, githubApi: github.url, defaultFeed: "github:test/repo", bootstrapVersion: 2, log: quiet });
    const first = await updater.check();
    assert.equal(first.status, "up-to-date", JSON.stringify(first));
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      await sleep(20);
      const again = await updater.check();
      results.push({ status: again.status, code: again.code, reason: again.reason });
    }
    assert.ok(github.hits.resets > 0, `ön koşul oluşmadı: sunucu boşta bağlantıyı hiç koparmadı (resets=${github.hits.resets})`);
    assert.deepEqual(results.map(r => r.status), Array(6).fill("up-to-date"), `kopan bağlantıdan sonra denetim: ${JSON.stringify(results)} (resets=${github.hits.resets})`);
  });
});
