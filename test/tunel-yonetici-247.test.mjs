// 2.4.7 M4 — tünel yöneticisi GERÇEK programla (server/lib/tunnel/manager.mjs + attach.mjs + routes/mobile-tunnel.mjs; docs/mobil/M4-TASARIM.md).
// Sahte kapıcı (bellekte) + sahte cloudflared (test/fixtures/sahte-cloudflared.mjs: programın yazdığı yapılandırmayı okuyup TEK kuralın hizmetine ters
// vekil açar — tünelin yerel ucu). Gerçek Cloudflare'e, gerçek kapıcıya, gerçek lisans servisine (ders 30) çağrı yok.
// "Nasıl bozulur": eşli cihaz yokken internete kapı açılır; tünel ofis ağının ana portuna bağlanır (yetkisiz her uç dışarı açılır); Host yerel kalır →
// çerez Secure almaz; cihaz silinince/lisans bitince tünel açık kalır; program kapanınca bağlayıcı yetim kalır; özeti tutmayan dosya çalıştırılır;
// test kurulumu gerçek kapıcıya gider; durum ucu yetkisiz kullanıcıya açık.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";
import { createPhone, rawRequest } from "./mobil-uzak-ortak.mjs";

// Süreç yaşıyor mu (programın modülünden bağımsız; eski kodda da yüklenir — kırmızı kanıtın nedeni okunur, ders 38).
const isAlive = pid => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};
const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sahte-cloudflared.mjs");
const HOST = "ofis-0123456789abcdef.destekofis.net";
const TUNNEL_ID = "12345678-1234-4234-8234-123456789abc";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, ms = 15_000, what = "koşul") {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await wait(40);
  }
  throw new Error(`${what} ${ms} ms içinde sağlanmadı`);
}
const lines = file => (existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : []);
const fakeGate = () => {
  const gate = { calls: 0, provision: async () => {
    gate.calls += 1;
    return { tunnelId: TUNNEL_ID, hostname: HOST, publicUrl: `https://${HOST}`, token: "calistirma-belirteci-sahte" };
  } };
  return gate;
};
const quiet = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };

describe("M4 tünel yöneticisi — gerçek program, sahte kapıcı ve sahte cloudflared", () => {
  const root = mkdtempSync(path.join(tmpdir(), "m4-yonetici-"));
  const log = path.join(root, "cf.log");
  const gate = fakeGate();
  let server;
  let admin;
  let userId;
  const status = async () => {
    const res = await admin.get("/api/admin/mobile/tunnel");
    assert.equal(res.status, 200, `tünel durum ucu yanıtı (HTTP ${res.status}) — tünel yöneticisi yok mu?`);
    return res.data.data;
  };

  before(async () => {
    server = await bootVersion(CURRENT, {
      dataDir: path.join(root, "data"),
      backupDir: path.join(root, "backups"),
      env: quiet,
      tunnel: { gate, runner: { command: process.execPath, argsPrefix: [FAKE, "--sahte-log", log, "--sahte-mod", "bagli"], identity: FAKE }, tickMs: 50, firstTickMs: 10, stopGraceMs: 0, root: path.join(root, "bilesen") },
    });
    admin = createClient(server.base);
    assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
    const created = await admin.post("/api/admin/users", { username: "uzak-ali", name: "Ali Uzak", role: "personel", password: "Ali-Uzak-2026!", mustChangePassword: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    userId = (await admin.get("/api/admin/users")).data.data.find(item => item.username === "uzak-ali").id;
  });
  after(async () => {
    await server?.close();
    // Kapanışta bağlayıcı kalmışsa (hata ya da gerileme) test süreci asılı kalmasın: kalan süreç(ler) burada öldürülür; test 9 zaten kırmızıdır.
    for (const rec of lines(log)) {
      for (const pid of [rec.pid, rec.torun]) {
        if (!isAlive(pid)) continue;
        try {
          process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
        } catch {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // kapanmış
          }
        }
      }
    }
    rmSync(root, { recursive: true, force: true });
  });

  test("1. kimse uzaktan bağlanamazken: tünel Kapalı (Eşli cihaz yok), kapıcıya başvurulmaz, süreç yok", async () => {
    await wait(400);
    const s = await status();
    assert.equal(s.state, "off");
    assert.equal(s.label, "Kapalı");
    assert.match(s.reason, /Eşli cihaz yok/);
    assert.equal(gate.calls, 0, "kapıcıya başvurulmadı");
    assert.equal(lines(log).length, 0, "cloudflared başlamadı");
  });

  test("2. Uzaktan Bağlanabilir işaretlenince adres önceden hazırlanır (kapıcıya bir başvuru), süreç YİNE başlamaz", async () => {
    assert.equal((await admin.put(`/api/admin/mobile/access/${userId}`, { remote: true })).status, 200);
    await until(() => gate.calls >= 1, 10_000, "kapıcı başvurusu");
    const view = (await admin.get("/api/admin/mobile/devices")).data.data;
    assert.equal(view.remoteUrl, `https://${HOST}`, "karekod adresi tünel adresi");
    await wait(300);
    assert.equal(lines(log).length, 0, "eşli cihaz / karekod yokken süreç yok");
    assert.equal((await status()).publicUrl, `https://${HOST}`);
  });

  let code;
  let rec;
  test("3. karekod oluşturulunca tünel kendiliğinden açılır → Bağlı; yapılandırma YALNIZ uzak dinleyiciye bağlı, ana port asla", async () => {
    const created = await admin.post("/api/admin/mobile/codes", { userId });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    code = created.data.data.code;
    assert.ok(created.data.data.url.startsWith(`https://${HOST}/mobil/#eslesme=`), created.data.data.url);
    await until(async () => (await status()).state === "connected", 15_000, "Bağlı");
    const s = await status();
    assert.equal(s.label, "Bağlı");
    rec = lines(log).at(-1);
    const remotePort = server.app.context.tunnel.remotePort();
    const mainPort = Number(new URL(server.base).port);
    assert.ok(Number.isInteger(remotePort));
    assert.notEqual(remotePort, mainPort);
    assert.equal(rec.service, `http://127.0.0.1:${remotePort}`, "tek kural uzak dinleyici");
    assert.equal(rec.rules, 2, "tek kural + 404");
    assert.equal(rec.hostHeader, HOST);
    assert.equal(rec.tokenPresent, true);
    assert.ok(!rec.args.join(" ").includes("calistirma-belirteci"), "belirteç komut satırında yok");
    const yml = readFileSync(server.app.context.tunnel.configFile(), "utf8");
    assert.ok(!yml.includes(`:${mainPort}`), "yapılandırma dosyasında ana port yok");
    assert.ok(!yml.includes("calistirma-belirteci"), "belirteç dosyada yok");
  });

  test("4. tünelden giren istek uzak kapıdan geçer: /mobil/ açık, programın öbür uçları 404 (remote-path); eşleme çerezi Secure", async () => {
    const via = `http://127.0.0.1:${rec.port}`;
    const page = await rawRequest(via, "GET", "/mobil/");
    assert.equal(page.status, 200, "telefon sayfası");
    const companies = await rawRequest(via, "GET", "/api/companies", { headers: { cookie: "hof_device=x" } });
    assert.equal(companies.status, 401, `tünelden ana uç: ${companies.status} ${companies.text.slice(0, 120)}`);
    const phone = createPhone(via);
    const paired = await phone.pair(code);
    assert.equal(paired.status, 200, JSON.stringify(paired.data));
    const cookies = [].concat(paired.headers["set-cookie"] || []);
    assert.ok(cookies.length && cookies.every(line => /;\s*Secure/i.test(line)), `çerezler Secure: ${cookies}`);
    const forbidden = await phone.get("/api/companies");
    assert.equal(forbidden.status, 404, "eşli cihazla bile masaüstü ucu kapalı");
    assert.equal(forbidden.code, "remote-path");
    const login = await phone.login("uzak-ali", "Ali-Uzak-2026!");
    assert.equal(login.status, 200, `tünelden uzak giriş: ${login.status} ${login.text.slice(0, 160)}`);
  });

  test("5. cihaz silinince (bekleyen karekod da yok) tünel kapanır, süreç gider; yeni karekodla yeniden açılır", async () => {
    const pid = server.app.context.tunnel.pid();
    assert.ok(isAlive(pid));
    const view = (await admin.get("/api/admin/mobile/devices")).data.data;
    assert.equal(view.devices.length, 1);
    assert.equal((await admin.del(`/api/admin/mobile/devices/${view.devices[0].id}`)).status, 200);
    await until(async () => (await status()).state === "off", 10_000, "Kapalı");
    await until(() => !isAlive(pid), 10_000, "süreç kapandı");
    assert.match((await status()).reason, /Eşli cihaz yok/);
    assert.equal(server.app.context.tunnel.pid(), null);
    assert.equal(existsSync(server.app.context.tunnel.pidFile()), false);
    await admin.post("/api/admin/mobile/codes", { userId });
    await until(async () => (await status()).state === "connected", 15_000, "yeniden Bağlı");
  });

  test("6. lisans salt okunur olunca tünel kapanır (neden: lisans); lisans dönünce yeniden açılır", async () => {
    const pid = server.app.context.tunnel.pid();
    const original = server.app.license.status;
    server.app.license.status = () => ({ ...original(), writable: false });
    try {
      await until(async () => (await status()).state === "off", 10_000, "Kapalı (lisans)");
      assert.match((await status()).reason, /Lisans geçerli değil/);
      await until(() => !isAlive(pid), 10_000, "süreç kapandı");
    } finally {
      server.app.license.status = original;
    }
    await until(async () => (await status()).state === "connected", 15_000, "yeniden Bağlı");
  });

  test("7. bağlayıcı çökerse yeniden başlatılır (Bağlanıyor → Bağlı)", async () => {
    const pid = server.app.context.tunnel.pid();
    process.kill(pid, "SIGKILL");
    await until(async () => server.app.context.tunnel.pid() && server.app.context.tunnel.pid() !== pid, 15_000, "yeni süreç");
    await until(async () => (await status()).state === "connected", 15_000, "yeniden Bağlı");
  });

  test("8. durum ucu yalnız yöneticiye açık; belirteç / yerel port dönmez", async () => {
    await admin.post("/api/admin/users", { username: "personel-m4", name: "Personel M4", role: "personel", password: "Personel-M4-2026!", mustChangePassword: false });
    const staff = createClient(server.base);
    await staff.login("personel-m4", "Personel-M4-2026!");
    assert.equal((await staff.get("/api/admin/mobile/tunnel")).status, 403);
    const text = JSON.stringify(await status());
    assert.ok(!text.includes("calistirma-belirteci"));
    assert.ok(!text.includes("127.0.0.1") && !/port/i.test(Object.keys(await status()).join(",")), `yerel adres/port dönmüyor: ${text}`);
    assert.deepEqual(Object.keys(await status()).sort(), ["connections", "label", "publicUrl", "reason", "retryInSeconds", "since", "state", "version"]);
  });

  test("9. program kapanınca bağlayıcı yetim kalmaz (süreç ve kimlik dosyası gider)", async () => {
    const pid = server.app.context.tunnel.pid();
    const pidFile = server.app.context.tunnel.pidFile();
    assert.ok(isAlive(pid));
    await server.app.close();
    assert.equal(isAlive(pid), false, "cloudflared kapandı");
    assert.equal(existsSync(pidFile), false);
    server = { close: async () => {} };
  });
});

describe("M4 tünel yöneticisi — doğrulanamayan dosya ve test kurulumu", () => {
  test("indirilen dosyanın özeti tutmazsa süreç HİÇ başlamaz, kapıcıya başvurulmaz; durum Kapalı + neden", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "m4-ozet-"));
    const bytes = Buffer.from("sahte ikili, özet tutmayacak");
    const files = http.createServer((req, res) => res.writeHead(200, { "content-length": bytes.length }).end(bytes));
    await new Promise(resolve => files.listen(0, "127.0.0.1", resolve));
    const gate = fakeGate();
    const server = await bootVersion(CURRENT, {
      dataDir: path.join(root, "data"),
      backupDir: path.join(root, "backups"),
      env: quiet,
      fetchImpl: fetch,
      tunnel: { gate, asset: { file: "cloudflared", url: `http://127.0.0.1:${files.address().port}/c`, sha256: createHash("sha256").update("başka").digest("hex"), maxBytes: 1_000_000, version: "2099.1.1" }, tickMs: 50, firstTickMs: 10, root: path.join(root, "bilesen") },
    });
    try {
      const admin = createClient(server.base);
      await admin.login("admin", ADMIN_PASSWORD);
      const user = await admin.post("/api/admin/users", { username: "ozet-ali", name: "Özet Ali", role: "personel", password: "Ozet-Ali-2026!", mustChangePassword: false });
      const id = user.data.data?.id || (await admin.get("/api/admin/users")).data.data.find(item => item.username === "ozet-ali").id;
      await admin.put(`/api/admin/mobile/access/${id}`, { remote: true });
      await admin.post("/api/admin/mobile/codes", { userId: id });
      const s = await until(async () => {
        const value = (await admin.get("/api/admin/mobile/tunnel")).data.data;
        return /özeti/.test(value.reason) ? value : null;
      }, 10_000, "özet nedeni");
      assert.equal(s.state, "off");
      assert.match(s.reason, /özeti beklenenle aynı değil/);
      assert.equal(server.app.context.tunnel.pid(), null, "süreç başlamadı");
      assert.equal(existsSync(path.join(root, "bilesen", "2099.1.1", "cloudflared")), false, "dosya silindi");
      assert.ok(s.retryInSeconds >= 60, "hemen yeniden indirmez");
    } finally {
      await server.close();
      files.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("test kurulumu (lisans adresi yerel döngü, kapıcı adresi verilmemiş) gerçek kapıcıya ASLA gitmez (ders 30): tünel 'bu kurulumda kapalı'", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "m4-test-kurulum-"));
    const outbound = [];
    const spyFetch = async (url, init) => {
      outbound.push(String(url));
      throw new TypeError("ağ yok (test)");
    };
    const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: quiet, fetchImpl: spyFetch, tunnel: { tickMs: 50, firstTickMs: 10 } });
    try {
      const admin = createClient(server.base);
      await admin.login("admin", ADMIN_PASSWORD);
      const user = await admin.post("/api/admin/users", { username: "test-ali", name: "Test Ali", role: "personel", password: "Test-Ali-2026!", mustChangePassword: false });
      const id = user.data.data?.id || (await admin.get("/api/admin/users")).data.data.find(item => item.username === "test-ali").id;
      await admin.put(`/api/admin/mobile/access/${id}`, { remote: true });
      await admin.post("/api/admin/mobile/codes", { userId: id });
      await wait(500);
      const s = (await admin.get("/api/admin/mobile/tunnel")).data.data;
      assert.equal(s.state, "off");
      assert.match(s.reason, /bu kurulumda kapalı/);
      assert.deepEqual(outbound.filter(url => /kapi|cloudflare|github/.test(url)), [], `dışarı çağrı: ${outbound}`);
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
