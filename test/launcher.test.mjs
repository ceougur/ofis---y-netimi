// İstemci başlatıcısı (Go) ile sunucunun UDP keşif protokolünün birlikte çalıştığını sınar.
// Go kurulu değilse atlanır; Windows'a özgü parçalar (tarayıcı, ileti kutusu) Windows CI'da derlenir.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { after, before, describe, it } from "node:test";
import { startDiscoveryResponder } from "../server/lib/discovery.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);
const hasGo = (() => {
  try {
    execFileSync("go", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("istemci başlatıcısı (Go)", { skip: !hasGo && "Go kurulu değil" }, () => {
  let work;
  let binary;
  let server;
  let responder;
  let port;
  let udpPort;

  before(async () => {
    work = mkdtempSync(path.join(tmpdir(), "destekofis-launcher-"));
    binary = path.join(work, process.platform === "win32" ? "launcher.exe" : "launcher");
    execFileSync("go", ["test", "./..."], { cwd: path.join(root, "launcher"), stdio: "pipe", env: { ...process.env, GOTOOLCHAIN: "local" } });
    execFileSync("go", ["build", "-o", binary, "."], { cwd: path.join(root, "launcher"), stdio: "pipe", env: { ...process.env, GOTOOLCHAIN: "local" } });
    // Portlar (10.10.2026): HTTP sunucusu TCP'den, keşif yanıtlayıcısı UDP'den işletim sisteminin KENDİ boş portunu alır (ikisi de 0).
    // Önceden TCP'nin verdiği numara UDP'de de kullanılıyordu; Windows TCP portlarını SIRAYLA dağıtır ve o numaralar UDP için
    // dışlanmış bir bloğa (Hyper-V/WinNAT) denk gelince bağlama "EACCES" verir — yeniden denemek de aynı blokta dolaşır
    // (CI koşu 448 / 6fad463 ve 488 / 622249b, Windows Node 24: 5 test iptal). Keşif yanıtı HTTP portunu kendisi taşır
    // (Reply.Port → ServerURL), bu yüzden iki numaranın aynı olması gerekmez; aynı numarada (yerel kısa yol) bulma ayrı testte.
    server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, data: { service: "destekofis-merkezi", status: "ok" } }));
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
    responder = startDiscoveryResponder({ port: 0, httpPort: port, host: "127.0.0.1", getInfo: () => ({ instanceId: "kurulum-abc", version: "1.2.0", officeName: "Deneme Hukuk" }) });
    udpPort = (await responder.ready).port;
  });
  after(async () => {
    await responder?.close();
    server?.close();
    rmSync(work, { recursive: true, force: true });
  });

  const env = () => ({ ...process.env, DESTEKOFIS_CONFIG_DIR: path.join(work, "ayar") });

  it("'-kesfet' ağdaki sunucuyu ofis adı ve kurulum kimliğiyle bulur", async () => {
    const { stdout } = await run(binary, ["-kesfet", "-port", String(udpPort), "-hedef", "127.0.0.1"], { env: env() });
    const replies = JSON.parse(stdout);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].name, "Deneme Hukuk");
    assert.equal(replies[0].instanceId, "kurulum-abc");
    assert.equal(replies[0].port, port);
  });

  it("'-kesfet-dosya' sonucu kurulum sihirbazının okuyacağı dosyaya yazar", async () => {
    const file = path.join(work, "kesif.json");
    await run(binary, ["-kesfet-dosya", file, "-port", String(udpPort), "-hedef", "127.0.0.1"], { env: env() });
    const text = readFileSync(file, "utf8");
    // Kurulum sihirbazı (Inno Setup) alanları '"host": "' ve '"from": "' kalıplarıyla arar.
    assert.match(text, /"host": "[^"]*"/);
    assert.match(text, /"from": "127\.0\.0\.1"/);
    assert.equal(JSON.parse(text)[0].instanceId, "kurulum-abc");
    const none = path.join(work, "kesif-bos.json");
    await run(binary, ["-kesfet-dosya", none, "-port", "9", "-hedef", "127.0.0.1"], { env: env() });
    assert.deepEqual(JSON.parse(readFileSync(none, "utf8")), [], "sunucu yoksa boş liste yazılır");
  });

  it("aynı bilgisayardaki sunucuyu (HTTP portu = -port) keşifsiz bulur", async () => {
    const local = JSON.parse((await run(binary, ["-sifirla", "-acma", "-port", String(port), "-hedef", "127.0.0.1"], { env: { ...env(), DESTEKOFIS_CONFIG_DIR: path.join(work, "yerel") } })).stdout);
    assert.equal(local.url, `http://127.0.0.1:${port}`);
  });

  it("bulunan sunucuyu kaydeder ve sonraki açılışta doğrudan kullanır", async () => {
    // -port keşif (UDP) portu; sunucu HTTP'de başka portta → adres keşif yanıtındaki porttan kurulur.
    const first = JSON.parse((await run(binary, ["-sifirla", "-acma", "-port", String(udpPort), "-hedef", "127.0.0.1"], { env: env() })).stdout);
    assert.equal(first.url, `http://127.0.0.1:${port}`);
    const saved = JSON.parse(readFileSync(path.join(work, "ayar", "istemci.json"), "utf8"));
    assert.equal(saved.server, `http://127.0.0.1:${port}`);
    const second = JSON.parse((await run(binary, ["-acma", "-port", "1", "-hedef", "127.0.0.1"], { env: env() })).stdout);
    assert.equal(second.url, `http://127.0.0.1:${port}`, "kayıtlı adres port parametresinden bağımsız kullanılmalı");
  });

  it("sunucu yoksa anlaşılır biçimde başarısız olur", async () => {
    await assert.rejects(run(binary, ["-sifirla", "-acma", "-port", "9", "-hedef", "127.0.0.1"], { env: { ...env(), DESTEKOFIS_CONFIG_DIR: path.join(work, "bos") } }), error => error.code === 2 && /bulunamadı/.test(error.stderr));
  });

  it("Windows için derlenir (GUI alt sistemi)", async () => {
    const output = path.join(work, "DestekOfis.exe");
    execFileSync("go", ["build", "-ldflags", "-H=windowsgui -s -w", "-o", output, "."], { cwd: path.join(root, "launcher"), env: { ...process.env, GOOS: "windows", GOARCH: "amd64", CGO_ENABLED: "0", GOTOOLCHAIN: "local" } });
    const header = readFileSync(output).subarray(0, 2).toString();
    assert.equal(header, "MZ");
  });
});
