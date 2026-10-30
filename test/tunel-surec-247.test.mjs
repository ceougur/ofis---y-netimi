// 2.4.7 M4 — cloudflared süreç denetçisi (server/lib/tunnel/process.mjs; docs/mobil/M4-TASARIM.md §5). Sahte cloudflared (test/fixtures/sahte-cloudflared.mjs).
// "Nasıl bozulur": bağlayıcı çöker → kendiliğinden geri gelmeli (artan beklemeyle, sonsuz hızlı döngü yok); durdurmada torun süreç kalır; program sert
// öldürülür (taskkill /F, elektrik) → yetim bağlayıcı kalır ve sonraki açılışta ikinci bağlayıcı yanına eklenir; yetim temizliği başka programın
// sürecini öldürür (pid yeniden kullanıldı). Windows'ta ağaç taskkill /T ile kapanır (CI Windows işinde aynı test).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import { createProcessSupervisor, isAlive, killTree, reapOrphan } from "../server/lib/tunnel/process.mjs";

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sahte-cloudflared.mjs");
const root = mkdtempSync(path.join(tmpdir(), "m4-surec-"));
const quiet = { warn() {}, error() {} };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, ms = 10_000, what = "koşul") {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await wait(25);
  }
  throw new Error(`${what} ${ms} ms içinde sağlanmadı`);
}
const lines = file => (existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : []);
const strays = [];
after(async () => {
  for (const pid of strays) await killTree(pid).catch(() => {});
  rmSync(root, { recursive: true, force: true });
});

function supervisor(name, mode, extra = {}) {
  const log = path.join(root, `${name}.log`);
  const pidFile = path.join(root, `${name}.pid`);
  const seen = [];
  const sup = createProcessSupervisor({
    binary: process.execPath,
    args: () => [FAKE, "--sahte-log", log, "--sahte-mod", mode, "tunnel", "--no-autoupdate", "run"],
    env: () => ({ TUNNEL_TOKEN: "gizli-belirtec" }),
    pidFile,
    identity: FAKE,
    onLine: line => seen.push(line),
    log: quiet,
    ...extra,
  });
  return { sup, log, pidFile, seen };
}

describe("M4 süreç denetçisi", () => {
  test("başlat → çıktı satırı okunur, belirteç ortam değişkeniyle gider (komut satırında yok); durdur → süreç ve kimlik dosyası gider", async () => {
    const { sup, log, pidFile, seen } = supervisor("bagli", "bagli");
    sup.start();
    await until(() => seen.some(line => /Registered tunnel connection/.test(line)), 10_000, "bağlandı satırı");
    const pid = sup.pid();
    assert.ok(isAlive(pid));
    const first = lines(log)[0];
    assert.equal(first.tokenPresent, true, "TUNNEL_TOKEN ortam değişkeni geldi");
    assert.ok(!first.args.join(" ").includes("gizli-belirtec"), "belirteç komut satırında değil");
    assert.deepEqual(JSON.parse(readFileSync(pidFile, "utf8")).pid, pid);
    await sup.stop();
    assert.equal(isAlive(pid), false, "süreç kapandı");
    assert.equal(existsSync(pidFile), false, "kimlik dosyası silindi");
    await wait(300);
    assert.equal(lines(log).length, 1, "durdurulan süreç yeniden başlatılmadı");
  });

  test("çöken bağlayıcı artan beklemeyle yeniden başlatılır (sabit hızlı döngü yok); durdurunca döngü biter", async () => {
    const states = [];
    const { sup, log } = supervisor("coker", "coker", { backoff: [100, 200, 400, 800], onState: s => states.push({ ...s, t: Date.now() }) });
    const started = Date.now();
    sup.start();
    await until(() => lines(log).length >= 4, 15_000, "4 başlatma");
    const delays = states.filter(s => s.nextRetryMs).map(s => s.nextRetryMs);
    assert.deepEqual(delays.slice(0, 3), [100, 200, 400], `bekleme artıyor: ${delays}`);
    assert.ok(Date.now() - started >= 100 + 200 + 400, "beklemeler gerçekten uygulandı");
    await sup.stop();
    const count = lines(log).length;
    await wait(1200);
    assert.equal(lines(log).length, count, "durdurulduktan sonra yeni başlatma yok");
  });

  test("durdurma süreç AĞACINI kapatır (torun süreç kalmaz)", async () => {
    const { sup, log } = supervisor("torun", "torun");
    sup.start();
    const rec = await until(() => lines(log).find(item => item.torun), 10_000, "torun süreç");
    strays.push(rec.torun);
    assert.ok(isAlive(rec.pid) && isAlive(rec.torun));
    await sup.stop();
    await until(() => !isAlive(rec.torun), 10_000, "torun kapandı");
    assert.equal(isAlive(rec.pid), false);
    assert.equal(isAlive(rec.torun), false, "torun süreç yetim kalmadı");
  });

  test("yetim temizliği: program sert öldürüldü (stop çağrılmadı) → sonraki açılış eski bağlayıcıyı kapatır", async () => {
    const log = path.join(root, "yetim.log");
    const pidFile = path.join(root, "yetim.pid");
    // Önceki çalışmanın bıraktığı bağlayıcı: denetçisi yok (program öldü), kimlik dosyası diskte.
    const orphan = spawn(process.execPath, [FAKE, "--sahte-log", log, "--sahte-mod", "bagli"], { stdio: "ignore", detached: process.platform !== "win32" });
    orphan.unref();
    strays.push(orphan.pid);
    writeFileSync(pidFile, JSON.stringify({ pid: orphan.pid, binary: FAKE }));
    await until(() => lines(log).length >= 1, 10_000, "yetim açıldı");
    const result = await reapOrphan(pidFile, { log: quiet });
    assert.equal(result.reaped, true);
    await until(() => !isAlive(orphan.pid), 10_000, "yetim kapandı");
    assert.equal(existsSync(pidFile), false);
  });

  test("yetim temizliği başka programın sürecine dokunmaz (pid yeniden kullanılmış: komut satırı bizim ikili değil)", async () => {
    const pidFile = path.join(root, "baska.pid");
    const other = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    strays.push(other.pid);
    await wait(200);
    writeFileSync(pidFile, JSON.stringify({ pid: other.pid, binary: FAKE }));
    const result = await reapOrphan(pidFile, { log: quiet });
    assert.equal(result.reaped, false);
    assert.equal(isAlive(other.pid), true, "başka süreç yaşıyor");
    assert.equal(existsSync(pidFile), false, "eskimiş kimlik dosyası silindi");
    await killTree(other.pid);
  });
});
