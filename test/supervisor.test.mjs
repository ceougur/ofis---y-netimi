import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { discover } from "../server/lib/discovery.mjs";
import { maintenanceHtml, pruneRotatedLogs, startSupervisor } from "../server/supervisor.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const silent = { info() {}, warn() {}, error() {}, debug() {} };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const alive = pid => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function waitFor(check, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return true;
    await sleep(100);
  }
  throw new Error("Beklenen durum oluşmadı");
}

describe("servis yöneticisi (supervisor)", () => {
  let supervisor;
  let installRoot;
  let base;
  const health = async () => (await fetch(`${base}/__supervisor/health`)).json();

  before(async () => {
    installRoot = mkdtempSync(path.join(tmpdir(), "destekofis-sup-"));
    supervisor = await startSupervisor({ installRoot, appDir: root, port: 0, host: "127.0.0.1", discoveryPort: 0, log: silent, env: { HUKUK_ADMIN_PASSWORD: "Test-Admin-2026!", HUKUK_LOG_LEVEL: "silent" } });
    base = `http://127.0.0.1:${supervisor.port}`;
    await waitFor(async () => (await health()).phase === "ready");
  });
  after(async () => {
    await supervisor?.stop();
    rmSync(installRoot, { recursive: true, force: true });
  });

  it("bakım sayfası markalı, otomatik yenilenen bir HTML üretir", () => {
    const html = maintenanceHtml("updating");
    assert.match(html, /Sistem güncelleniyor, lütfen 1 dakika sonra tekrar deneyin/);
    assert.match(html, /http-equiv="refresh"/);
  });

  it("istekleri uygulamaya iletir; oturum çerezi ve istemci IP'si korunur", async () => {
    const healthResponse = await fetch(`${base}/api/health`);
    assert.equal(healthResponse.status, 200);
    const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "Test-Admin-2026!" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
    assert.equal((await me.json()).data.username, "admin");
    const html = await fetch(`${base}/`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /hof-boot\.js/);
    assert.equal(supervisor.state.info.version, JSON.parse((await import("node:fs")).readFileSync(path.join(root, "package.json"), "utf8")).version);
  });

  it("canlı olay akışını (SSE) kapıdan geçirir; tarayıcı kapanınca uygulama tarafı da kapanır", async () => {
    const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "Test-Admin-2026!" }) });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const controller = new AbortController();
    const response = await fetch(`${base}/api/events`, { headers: { cookie, accept: "text/event-stream" }, signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    const reader = response.body.getReader();
    let text = "";
    while (!text.includes("event: hello")) text += new TextDecoder().decode((await reader.read()).value);
    assert.match(text, /"version":/);
    // Olay akışı ortak havuzu tüketmemeli: akış açıkken sıradan istekler hemen yanıtlanır.
    const started = Date.now();
    for (let index = 0; index < 5; index += 1) assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.ok(Date.now() - started < 2000);
    controller.abort();
    await reader.cancel().catch(() => {});
  });

  it("UDP keşif sinyaline sunucu adresiyle yanıt verir", async () => {
    const replies = await discover({ port: supervisor.discoveryPort, targets: ["127.0.0.1"], timeoutMs: 800 });
    assert.equal(replies.length, 1);
    assert.equal(replies[0].port, supervisor.port);
    assert.equal(replies[0].url, `http://127.0.0.1:${supervisor.port}`);
    assert.equal(replies[0].service, "DestekOfis");
    assert.ok(replies[0].instanceId);
  });

  it("uygulama çökerse bakım yanıtı verir ve kendini yeniden başlatır", async () => {
    const before = await health();
    process.kill(before.childPid, "SIGKILL");
    await waitFor(async () => (await health()).phase !== "ready", 5000);
    const during = await fetch(`${base}/api/health`);
    assert.equal(during.status, 503);
    assert.equal((await during.json()).code, "MAINTENANCE");
    await waitFor(async () => (await health()).phase === "ready");
    const after = await health();
    assert.notEqual(after.childPid, before.childPid);
    assert.ok(after.restarts >= 1);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  });

  it("güncelleme kipinde kullanıcıya 'Sistem güncelleniyor' sayfası gösterir", async () => {
    await supervisor.restartApp({ phase: "updating", detail: "1.2.0 → 1.3.0" });
    const response = await fetch(`${base}/`, { headers: { accept: "text/html" } });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "5");
    assert.match(await response.text(), /Sistem güncelleniyor/);
    await waitFor(async () => (await health()).phase === "ready");
  });
});

describe("servis günlükleri", () => {
  it("nssm'in kenara ayırdığı eski günlüklerden yalnızca en yeni 10 tanesi kalır", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "destekofis-log-"));
    try {
      const rotated = Array.from({ length: 14 }, (_, index) => `servis-202609${String(index + 10).padStart(2, "0")}T101500.${String(index).padStart(3, "0")}.log`);
      for (const name of [...rotated, "servis.log", "kurulum.log", "servis-notlar.log"]) writeFileSync(path.join(dir, name), "x");
      mkdirSync(path.join(dir, "alt"));
      const removed = pruneRotatedLogs(dir, 10);
      assert.deepEqual(removed.sort(), rotated.slice(0, 4).sort(), "en eski 4 günlük silinmeli");
      const left = readdirSync(dir);
      for (const name of ["servis.log", "kurulum.log", "servis-notlar.log", "alt", ...rotated.slice(4)]) assert.ok(left.includes(name), `${name} korunmalı`);
      assert.deepEqual(pruneRotatedLogs(path.join(dir, "yok")), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("öksüz süreç koruması", () => {
  // CI 514 (Windows Node 22, 10.10.2026): test 15,3 sn sonra yalnız "EBUSY: … unlink destekofis.sqlite" ile düştü — finally'deki rmSync
  // hâlâ açık uygulama sürecinin kilitlediği veri tabanını silemedi ve try'daki ASIL hatayı (15 sn'lik bir bekleme mi doldu?) gizledi.
  // Artık her bekleme adımı adıyla düşer ve hata metninde servis yöneticisinin çıktısının sonu bulunur; temizlik önce uygulama sürecini
  // kapatıp bekler, silmeyi Windows kilidi için yeniden dener ve kendi hatasıyla asıl hatayı ezmez.
  it("servis yöneticisi zorla kapatılınca uygulama da kapanır", async () => {
    const installRoot = mkdtempSync(path.join(tmpdir(), "destekofis-orphan-"));
    const processHandle = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(root, "server", "supervisor.mjs")], {
      env: { ...process.env, HUKUK_INSTALL_ROOT: installRoot, PORT: "0", HOST: "127.0.0.1", HUKUK_DISCOVERY_PORT: "0", HUKUK_LOG_LEVEL: "info", HUKUK_ADMIN_PASSWORD: "Test-Admin-2026!" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    processHandle.stdout.on("data", chunk => (output += chunk));
    processHandle.stderr.on("data", chunk => (output += chunk));
    const started = Date.now();
    const step = async (name, check, timeoutMs) => {
      try {
        await waitFor(check, timeoutMs);
      } catch (error) {
        throw new Error(`${name}: ${error.message} (${Date.now() - started} ms; servis yöneticisi çıktısının sonu: ${JSON.stringify(output.slice(-1500))})`);
      }
    };
    let childPid = null;
    let failure = null;
    try {
      await step("servis yöneticisi adresini yazmadı", () => /servis yöneticisi http:\/\/127\.0\.0\.1:(\d+)/.test(output));
      const port = output.match(/servis yöneticisi http:\/\/127\.0\.0\.1:(\d+)/)[1];
      await step("uygulama hazır olmadı", async () => {
        const state = await (await fetch(`http://127.0.0.1:${port}/__supervisor/health`)).json();
        childPid = state.childPid;
        return state.phase === "ready";
      });
      processHandle.kill("SIGKILL");
      await step("servis yöneticisi kapandıktan sonra uygulama kapanmadı (öksüz süreç)", () => !alive(childPid), 10000);
    } catch (error) {
      failure = error;
    } finally {
      processHandle.kill("SIGKILL");
      // Test düştüyse uygulama süreci kalmış olabilir: kapatılır ve kapanması beklenir; veri tabanı kilidi ancak o zaman kalkar.
      if (childPid && alive(childPid)) {
        try {
          process.kill(childPid, "SIGKILL");
        } catch {}
        await waitFor(() => !alive(childPid), 10000).catch(() => {});
      }
      try {
        rmSync(installRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      } catch (cleanup) {
        if (!failure) failure = cleanup;
        else console.error(`temizlik de başarısız: ${cleanup.message}`);
      }
    }
    if (failure) throw failure;
  });
});
