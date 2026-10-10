// GERÇEK Windows kurulumunda (C:\DestekOfis, nssm servisi "DestekOfis", sanal servis hesabı) otomatik güncelleme sınaması.
// Yalnız GitHub Windows koşucusunda, .github/workflows/windows.yml install-test işinden çağrılır (kurulum + servis adımlarından sonra).
//
// Kurulu program yalnız gerçek imza anahtarıyla imzalanmış bildirgeyi kabul eder; gerçek anahtar burada YOK ve kullanılmaz. Bu
// yüzden sınama süresince KURULU kopyanın server\lib\update-keys.mjs dosyasına bir TEST açık anahtarı eklenir (yalnız bu CI
// makinesinde; sonunda eski hâline döner) ve config\guncelleme.json güncelleme kaynağı olarak yereldeki sahte bildirge adresini
// gösterir (ağ dışarı çıkmaz). Gerisi gerçektir: Windows servisi, bootstrap.mjs, servis yöneticisi, gerçek açılış, gerçek indirme,
// paket açma, veritabanı yedeği, yeni sürümün deneme açılışı.
//  W1 kendiliğinden kur KAPALI → servis yeniden başlar → açılışta kaynak sorgulanır, yeni sürüm "hazır" görünür, KURULMAZ.
//  W2 kendiliğinden kur AÇIK → servis yeniden başlar → açılışta bulunur, kimse kullanmıyor → kurulur; yedek alınır; veri korunur.
// Sonunda kurulum eski hâline döndürülür (etkin sürüm, anahtar dosyası, ayar), servis eski sürümle açılır.
// Çıktı: "N denetim geçti, M başarısız" (kanıt aracının tanıdığı özet).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildRelease, makeKeys, makeVersion } from "../update-helpers.mjs";

const ROOT = process.argv[2] || "C:\\DestekOfis";
const ADMIN = { username: "admin", password: process.argv[3] || "Windows-Testi-2026" };
const STAFF = { username: "kalici", password: "Kalici-Parola-2026" };
const BASE = "http://127.0.0.1:5123";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const work = mkdtempSync(path.join(tmpdir(), "destekofis-win-gunc-"));

// Kurulum klasörü servis kurulumunda kilitlenir (icacls). Okuma/yazma önce doğrudan, olmazsa yedekleme kipinde (robocopy /B).
function robocopy(from, to, name) {
  try {
    execFileSync("robocopy", [from, to, name, "/B", "/R:0", "/W:0", "/NFL", "/NDL", "/NJH", "/NJS"], { stdio: "ignore" });
  } catch (error) {
    if (!(error.status < 8)) throw new Error(`robocopy ${from}\\${name} → ${to}: çıkış ${error.status}`);
  }
}
function readFile(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    const dir = mkdtempSync(path.join(work, "oku-"));
    robocopy(path.dirname(file), dir, path.basename(file));
    return readFileSync(path.join(dir, path.basename(file)), "utf8");
  }
}
function writeFile(file, text) {
  try {
    writeFileSync(file, text);
  } catch {
    const dir = mkdtempSync(path.join(work, "yaz-"));
    writeFileSync(path.join(dir, path.basename(file)), text);
    robocopy(dir, path.dirname(file), path.basename(file));
  }
}
function listDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    const copy = mkdtempSync(path.join(work, "liste-"));
    try {
      execFileSync("robocopy", [dir, copy, "/B", "/L", "/R:0", "/W:0", "/NJH", "/NJS", "/NDL", "/NC", "/NS"], { encoding: "utf8" });
    } catch (error) {
      if (error.status < 8) return String(error.stdout || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      throw error;
    }
    return [];
  }
}
const powershell = command => execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8" });
async function health() {
  try {
    const response = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return response.status === 200 ? (await response.json()).data : null;
  } catch {
    return null;
  }
}
async function waitHealth(check, timeoutMs, what) {
  const until = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < until) {
    last = await health();
    if (last && check(last)) return last;
    await sleep(1000);
  }
  throw new Error(`${what}: son sağlık ${JSON.stringify(last)}`);
}
async function login({ username, password }) {
  const response = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0] || "", body: await response.json().catch(() => ({})) };
}
async function adminStatus() {
  const admin = await login(ADMIN);
  if (admin.status !== 200) throw new Error(`yönetici girişi ${admin.status} ${JSON.stringify(admin.body)}`);
  const response = await fetch(`${BASE}/api/admin/update`, { headers: { cookie: admin.cookie } });
  return (await response.json()).data;
}
const restartService = () => powershell("Restart-Service DestekOfis -Force");

const appsDir = path.join(ROOT, "app");
const current = JSON.parse(readFile(path.join(appsDir, "current.json")));
const installed = current.version;
const [major, minor, patch] = installed.split("-")[0].split(".").map(Number);
const next = `${major}.${minor}.${patch + 1}`;
const keysFile = path.join(appsDir, installed, "server", "lib", "update-keys.mjs");
const configFile = path.join(ROOT, "config", "guncelleme.json");
const keysBefore = readFile(keysFile);
const configBefore = existsSync(configFile) ? readFile(configFile) : null;
console.log(`Kurulu sürüm ${installed}; sınama sürümü ${next}; kurulum kökü ${ROOT}`);

// Sahte yayın: depodaki uygulama, sürüm numarası "next", TEST anahtarıyla imzalı.
const keys = makeKeys("ci-windows-test");
const built = buildRelease(makeVersion(path.join(work, "kaynak"), next), path.join(work, "yayin"), keys);
const hits = [];
const server = http.createServer((req, res) => {
  const name = decodeURIComponent((req.url || "/").split("?")[0].slice(1));
  hits.push({ at: new Date().toISOString(), name });
  const file = name === "destekofis-guncelleme.json" ? built.manifestPath : name === path.basename(built.zipPath) ? built.zipPath : null;
  if (!file) {
    res.writeHead(404);
    res.end();
    return;
  }
  const data = readFileSync(file);
  res.writeHead(200, { "content-type": "application/octet-stream", "content-length": data.length });
  res.end(data);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const feed = `http://127.0.0.1:${server.address().port}/destekofis-guncelleme.json`;
const manifestHits = () => hits.filter(hit => hit.name === "destekofis-guncelleme.json").length;
const zipHits = () => hits.filter(hit => hit.name.endsWith(".zip")).length;

try {
  writeFile(keysFile, keysBefore.replace(/export const TRUSTED_UPDATE_KEYS = Object\.freeze\(\{/, `export const TRUSTED_UPDATE_KEYS = Object.freeze({\n  "ci-windows-test": "${keys.publicB64}",`));
  ok(readFile(keysFile).includes("ci-windows-test"), "kurulu kopyaya test anahtarı eklendi (yalnız bu CI makinesinde)");
  mkdirSync(path.dirname(configFile), { recursive: true });

  console.log("\n■ W1 Kendiliğinden kur KAPALI: servis yeniden başlar → açılışta denetler, 'hazır' gösterir, kurmaz");
  writeFile(configFile, JSON.stringify({ enabled: false, channel: "stable", feed }));
  restartService();
  await waitHealth(data => data.version === installed, 120_000, "servis açılmadı");
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && !manifestHits()) await sleep(500);
  ok(manifestHits() >= 1, `açılışta güncelleme kaynağı sorgulandı (${manifestHits()} istek)`);
  await sleep(15_000);
  const w1 = await adminStatus();
  ok(w1.autoUpdate === false, "ayar: kendiliğinden kur kapalı");
  ok(w1.available?.version === next, `Yönetim → Sistem: yeni sürüm hazır (${w1.available?.version || w1.lastError || JSON.stringify(w1.lastCheck)})`);
  ok(zipHits() === 0, "paket indirilmedi");
  ok((await health())?.version === installed, `kurulmadı (çalışan ${installed})`);

  console.log("\n■ W2 Kendiliğinden kur AÇIK: servis yeniden başlar → açılışta bulunur, kimse kullanmıyor → kurulur");
  writeFile(configFile, JSON.stringify({ enabled: true, channel: "stable", feed }));
  const restartedAt = Date.now();
  restartService();
  const after = await waitHealth(data => data.version === next, 240_000, `${next} sürümüne geçilmedi`);
  ok(after.version === next, `servis kendiliğinden ${next} sürümüne geçti (${Math.round((Date.now() - restartedAt) / 1000)} sn)`);
  ok(zipHits() === 1, `paket bir kez indirildi (${zipHits()})`);
  const active = JSON.parse(readFile(path.join(appsDir, "current.json")));
  ok(active.version === next && active.previous === installed && !active.pending, `app\\current.json etkin ${active.version}, önceki ${active.previous}, onaylı`);
  const backupDirs = listDir(path.join(ROOT, "backups"));
  const companyDir = backupDirs.find(name => /^001 - /.test(name));
  const backups = companyDir ? listDir(path.join(ROOT, "backups", companyDir)) : [];
  ok(backups.some(name => name.includes(`guncelleme-oncesi-${installed.replace(/\./g, "-")}`)), `güncelleme öncesi yedek (${companyDir || "klasör yok"}: ${backups.filter(name => /guncelleme/.test(name)).join(", ") || "yok"})`);
  const staff = await login(STAFF);
  ok(staff.status === 200 && staff.body?.data?.username === "kalici", "güncelleme öncesi kullanıcı giriş yapıyor (veri korundu)");
  const w2 = await adminStatus();
  ok(w2.lastResult?.outcome === "success" && w2.lastResult?.version === next, `Yönetim → Sistem: ${next} sürümüne güncellendi`);
  const log = readFile(path.join(ROOT, "logs", "servis.log"));
  ok(new RegExp(`Yeni sürüm bulundu: ${next.replace(/\./g, "\\.")}`).test(log), "servis günlüğü: yeni sürüm bulundu");
  ok(new RegExp(`DestekOfis ${next.replace(/\./g, "\\.")} sürümüne güncellendi`).test(log), "servis günlüğü: güncellendi");
  console.log(log.split(/\r?\n/).filter(line => /güncelle|sürüm|Güncelleme/i.test(line) && !line.startsWith("[uygulama]")).slice(-15).join("\n"));
} catch (error) {
  failed += 1;
  console.log(`✗ sınama durdu: ${error.stack || error.message}`);
} finally {
  // Kurulumu eski hâline döndür: sonraki iş adımları (aynı paketle yeniden kurulum, kaldırma…) sınama öncesi düzenle sürer.
  try {
    powershell("Stop-Service DestekOfis -Force");
    writeFile(path.join(appsDir, "current.json"), `${JSON.stringify({ version: installed, selectedAt: new Date().toISOString(), installedBy: "kurulum" }, null, 2)}\n`);
    writeFile(keysFile, keysBefore);
    if (configBefore === null) writeFile(configFile, "{}");
    else writeFile(configFile, configBefore);
    try {
      rmSync(path.join(appsDir, next), { recursive: true, force: true, maxRetries: 3 });
    } catch (error) {
      // Kalan klasör zararsız: bootstrap app\current.json'daki sürümü açar; sonraki kurulum eski sürümleri temizler.
      console.log(`  · ${next} klasörü silinemedi (${error.code || error.message}); etkin sürüm ${installed}`);
    }
    powershell("Start-Service DestekOfis");
    const restored = await waitHealth(data => data.version === installed, 120_000, "eski hâline dönen servis açılmadı");
    ok(restored.version === installed, `kurulum eski hâline döndü (servis ${installed})`);
  } catch (error) {
    failed += 1;
    console.log(`✗ eski hâline döndürülemedi: ${error.message}`);
  }
  server.close();
  rmSync(work, { recursive: true, force: true });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
process.exitCode = failed ? 1 : 0;
