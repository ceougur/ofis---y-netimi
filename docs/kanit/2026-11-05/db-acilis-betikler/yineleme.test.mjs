// Yineleme koşusu (node:test özetiyle; tools/kanit.mjs kos ile kaydedilir). Ortam:
//   YIN_KIP=n5       YIN_DEPO=<depo> YIN_N=<sayı>   → <depo>/test/fis-defteri-yasam-250.test.mjs "N11|N5" hücreleri N kez (CI #1007 sırası: N11a SIGKILL → N11b → N5)
//   YIN_KIP=kurtarma YIN_LIB=<db.mjs> YIN_N=<sayı>  → betik/kurtarma.mjs (yazar SIGKILL + iki süreç aynı anda openDatabase) N yineleme
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const n = Number(process.env.YIN_N || 1);
const mode = process.env.YIN_KIP;

if (mode === "n5") {
  it(`fis-defteri-yasam-250 N11+N5 × ${n} (${process.env.YIN_DEPO})`, () => {
    const failures = [];
    for (let i = 0; i < n; i++) {
      // NODE_TEST_CONTEXT çıkarılır: yoksa içteki node --test özetini dış koşucuya v8 biçiminde yollar ve TAP satırları gelmez.
      const env = { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
      delete env.NODE_TEST_CONTEXT;
      const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=tap", "--test-name-pattern=N11|N5", "test/fis-defteri-yasam-250.test.mjs"], { cwd: process.env.YIN_DEPO, encoding: "utf8", env });
      const pass = Number((r.stdout.match(/^# pass (\d+)/m) || [])[1]);
      const tests = Number((r.stdout.match(/^# tests (\d+)/m) || [])[1]);
      if (r.status !== 0 || tests !== 3 || pass !== 3) failures.push({ i, status: r.status, tests, pass, why: (r.stdout.match(/işçi \d+: [^\n]{0,160}|database is locked[^\n]{0,80}/) || [""])[0] });
    }
    console.log(JSON.stringify({ n, failed: failures.length, failures: failures.slice(0, 10) }));
    assert.equal(failures.length, 0, `${failures.length} / ${n} koşu kırmızı`);
  });
} else if (mode === "kurtarma") {
  it(`kurtarma (SIGKILL + iki süreç aynı anda openDatabase) × ${n} (${process.env.YIN_LIB})`, () => {
    const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(here, "kurtarma.mjs"), process.env.YIN_LIB, String(n), "kill", "20000"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const tally = JSON.parse(r.stdout.trim());
    console.log(JSON.stringify(tally));
    assert.equal(tally.openFailures, 0, `${tally.openFailures} açılış düştü / ${n * 2} (yineleme ${tally.iterationsWithFailure} / ${n}; errcode ${JSON.stringify(tally.errcodes)})`);
  });
} else throw new Error(`YIN_KIP: n5 | kurtarma (${mode})`);
