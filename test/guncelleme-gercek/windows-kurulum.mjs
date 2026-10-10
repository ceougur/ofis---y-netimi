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
//  W3 (2.1.0, "arka planda indir, sonraki açılışta kur") servis internetsiz açılır, personel çalışıyor; internet gelince (60 sn'lik
//     üretim yeniden denemesi) daha yeni sürüm bulunur → KURULMAZ, paket arka planda indirilip doğrulanır ve app\.hazir\'a alınır
//     (uygulama süreci aynı kalır); servis internetsiz yeniden başlatılır → uygulama eski sürümle açılmadan hazır sürüm kurulur,
//     paket yeniden indirilmez. Mesai dışı kuralı (hafta içi 20:00–07:00, hafta sonu) koşunun saatine bağlı kalmasın diye W3
//     süresince makine "mesai içi"ne alınır: önce şu an hafta içi 08–17 olan bir saat dilimi seçilir (Set-TimeZone); hiçbiri yoksa
//     (hafta sonu penceresi) saat eşitleme servisleri durdurulup saat bir sonraki hafta içi 10:00'a alınır (Set-Date). Sonunda
//     saat dilimi / saat ve eşitleme servisleri eski hâline döner. (Linux kuru koşusunda saat, sahte servis denetiminin
//     başlatıcısında kaydırılır — bkz. gercek/windows-kuru.)
// Sonunda kurulum eski hâline döndürülür (etkin sürüm, anahtar dosyası, ayar, hazır paket), servis eski sürümle açılır.
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
const next2 = `${major}.${minor}.${patch + 2}`;
const keysFile = path.join(appsDir, installed, "server", "lib", "update-keys.mjs");
const configFile = path.join(ROOT, "config", "guncelleme.json");
const keysBefore = readFile(keysFile);
const configBefore = existsSync(configFile) ? readFile(configFile) : null;
console.log(`Kurulu sürüm ${installed}; sınama sürümü ${next}; kurulum kökü ${ROOT}`);

// Sahte yayın: depodaki uygulama, sürüm numarası "next", TEST anahtarıyla imzalı.
const keys = makeKeys("ci-windows-test");
const built = buildRelease(makeVersion(path.join(work, "kaynak"), next), path.join(work, "yayin"), keys);
const built2 = buildRelease(makeVersion(path.join(work, "kaynak2"), next2), path.join(work, "yayin2"), keys);
const hits = [];
let feedDown = false;
let activeRelease = built;
const server = http.createServer((req, res) => {
  const name = decodeURIComponent((req.url || "/").split("?")[0].slice(1));
  hits.push({ at: new Date().toISOString(), name, down: feedDown });
  // İnternet yok: bağlantı yanıtsız kesilir (ağ hatası; servis yöneticisi açılışta 60 sn sonra yeniden dener).
  if (feedDown) {
    req.socket.destroy();
    return;
  }
  const file = name === "destekofis-guncelleme.json" ? activeRelease.manifestPath : [built, built2].map(item => item.zipPath).find(zip => path.basename(zip) === name) || null;
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
const zipHits = version => hits.filter(hit => !hit.down && hit.name.endsWith(".zip") && (!version || hit.name.includes(version))).length;
const supervisorHealth = async () => {
  try {
    const response = await fetch(`${BASE}/__supervisor/health`, { signal: AbortSignal.timeout(3000) });
    return response.status === 200 ? await response.json() : null;
  } catch {
    return null;
  }
};
const lastBoot = () => readFile(path.join(ROOT, "logs", "servis.log")).split("DestekOfis servis yöneticisi").at(-1);
const appStarts = text => [...text.matchAll(/Uygulama başlatılıyor \(([^,]+),/g)].map(match => match[1].replace(/\\/g, "/"));
// Mesai dışı mı? (servis yöneticisinin kuralı: hafta içi 20:00–07:00 ve hafta sonu, makinenin yerel saati)
const quietNow = (date = new Date()) => date.getDay() === 0 || date.getDay() === 6 || date.getHours() < 7 || date.getHours() >= 20;
// W3 süresince makineyi mesai içine alır; dönen işlev eski hâline getirir.
function forceWorkHours() {
  if (process.platform !== "win32") {
    // Linux kuru koşusu: sahte servis denetimi servisi ROOT\.kuru-saat-kaydir (ms) ile kaydırılmış saatle başlatır.
    const now = new Date();
    const target = new Date(now);
    do target.setDate(target.getDate() + 1);
    while (target.getDay() === 0 || target.getDay() === 6);
    target.setHours(10, 0, 0, 0);
    writeFileSync(path.join(ROOT, ".kuru-saat-kaydir"), String(target.getTime() - now.getTime()));
    return { how: `kuru koşu: servis saati ${target.toString()} olacak şekilde kaydırıldı`, restore: () => rmSync(path.join(ROOT, ".kuru-saat-kaydir"), { force: true }) };
  }
  const original = powershell("(Get-TimeZone).Id").trim();
  const zone = powershell("$now=[DateTime]::UtcNow; $z=[TimeZoneInfo]::GetSystemTimeZones() | Where-Object { $t=[TimeZoneInfo]::ConvertTimeFromUtc($now,$_); $t.DayOfWeek -ne 'Saturday' -and $t.DayOfWeek -ne 'Sunday' -and $t.Hour -ge 8 -and $t.Hour -lt 17 } | Select-Object -First 1; if ($z) { $z.Id }").trim();
  if (zone) {
    powershell(`Set-TimeZone -Id '${zone}'`);
    return { how: `saat dilimi ${original} → ${zone} (yerel saat ${powershell("(Get-Date).ToString('dddd HH:mm')").trim()})`, restore: () => powershell(`Set-TimeZone -Id '${original}'`) };
  }
  powershell("Stop-Service vmictimesync,w32time -Force -ErrorAction SilentlyContinue");
  const shift = powershell("$n=Get-Date; $t=$n.Date.AddDays(1); while ($t.DayOfWeek -eq 'Saturday' -or $t.DayOfWeek -eq 'Sunday') { $t=$t.AddDays(1) }; $t=$t.AddHours(10); Set-Date -Date $t | Out-Null; [long](($t-$n).TotalMilliseconds)").trim();
  return {
    how: `hiçbir saat diliminde mesai içi değil; saat ${Math.round(Number(shift) / 3_600_000)} sa ileri alındı (eşitleme servisleri durduruldu)`,
    restore: () => {
      powershell(`Set-Date -Date ((Get-Date).AddMilliseconds(-${Number(shift)})) | Out-Null`);
      powershell("Start-Service w32time,vmictimesync -ErrorAction SilentlyContinue");
    },
  };
}

let workHoursRestore = null;
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

  console.log(`\n■ W3 Arka planda indir, sonraki açılışta kur (${installed} çalışırken ${next2} yayımlanır)`);
  // W2'den önceki düzene dönülür (etkin ${installed}); böylece W3'teki kurulum ${installed} klasörünü "önceki sürüm" olarak korur.
  powershell("Stop-Service DestekOfis -Force");
  writeFile(path.join(appsDir, "current.json"), `${JSON.stringify({ version: installed, selectedAt: new Date().toISOString(), installedBy: "kurulum" }, null, 2)}\n`);
  const work3 = forceWorkHours();
  workHoursRestore = work3.restore;
  console.log(`  · mesai içi: ${work3.how}`);
  feedDown = true;
  activeRelease = built2;
  restartService();
  await waitHealth(data => data.version === installed, 120_000, "W3: servis açılmadı");
  // Personel çalışıyor: giriş + 2 sn'de bir ekran isteği.
  const staff3 = await login(STAFF);
  ok(staff3.status === 200, "W3: personel giriş yaptı");
  let working = true;
  const activity = (async () => {
    while (working) {
      await fetch(`${BASE}/api/workspace/client-state`, { headers: { cookie: staff3.cookie } }).catch(() => null);
      await sleep(2000);
    }
  })();
  const pidBefore = (await supervisorHealth())?.childPid;
  feedDown = false;
  let w3status = null;
  const until3 = Date.now() + 6 * 60_000;
  while (Date.now() < until3) {
    w3status = await adminStatus().catch(() => null);
    if (w3status?.prepared?.version === next2) break;
    await sleep(3000);
  }
  ok(w3status?.prepared?.version === next2, `W3: ${next2} arka planda indirildi ve doğrulandı ('hazır'; ${JSON.stringify(w3status?.prepared || w3status?.lastError || w3status?.lastCheck)})`);
  ok(w3status?.deferred?.version === next2, "W3: kullanıcı çalışırken kurulmadı (ertelendi)");
  ok((await health())?.version === installed, `W3: çalışan sürüm hâlâ ${installed}`);
  const pidAfter = (await supervisorHealth())?.childPid;
  ok(pidBefore && pidAfter === pidBefore, `W3: uygulama süreci değişmedi (${pidBefore} → ${pidAfter})`);
  ok(zipHits(next2) === 1, `W3: paket bir kez indirildi (${zipHits(next2)})`);
  ok(listDir(path.join(appsDir, ".hazir")).some(name => name === next2), `W3: app\\.hazir\\${next2} var (${listDir(path.join(appsDir, ".hazir")).join(", ") || "yok"})`);
  working = false;
  await activity;
  // Akşam kapatılır, sabah internetsiz açılır.
  feedDown = true;
  const restarted3 = Date.now();
  restartService();
  const after3 = await waitHealth(data => data.version === next2, 300_000, `W3: açılışta ${next2} kurulmadı`);
  ok(after3.version === next2, `W3: yeniden başlatmada hazır ${next2} kuruldu (${Math.round((Date.now() - restarted3) / 1000)} sn; internet yok)`);
  ok(zipHits(next2) === 1, "W3: açılışta paket yeniden indirilmedi");
  const boot3 = lastBoot();
  ok(appStarts(boot3).length >= 1 && appStarts(boot3)[0].includes(next2), `W3: bu açılışta uygulama yalnız yeni sürümle başlatıldı (${appStarts(boot3).join(", ")})`);
  ok(new RegExp(`Açılışta hazır güncelleme var \\(${next2.replace(/\./g, "\\.")}\\)`).test(boot3), "W3: servis günlüğü 'Açılışta hazır güncelleme var'");
  const w3after = await adminStatus();
  ok(w3after.lastResult?.outcome === "success" && w3after.lastResult?.version === next2 && !w3after.prepared, `W3: Yönetim → Sistem: ${next2} sürümüne güncellendi, hazır paket kalmadı`);
  ok(!listDir(path.join(appsDir, ".hazir")).includes(next2), "W3: hazır paket kurulduktan sonra silindi");
  const active3 = JSON.parse(readFile(path.join(appsDir, "current.json")));
  ok(active3.version === next2 && active3.previous === installed && listDir(appsDir).includes(installed), `W3: etkin ${active3.version}, önceki ${active3.previous}; ${installed} klasörü duruyor`);
} catch (error) {
  failed += 1;
  console.log(`✗ sınama durdu: ${error.stack || error.message}`);
} finally {
  // Kurulumu eski hâline döndür: sonraki iş adımları (aynı paketle yeniden kurulum, kaldırma…) sınama öncesi düzenle sürer.
  try {
    if (workHoursRestore) workHoursRestore();
  } catch (error) {
    failed += 1;
    console.log(`✗ saat / saat dilimi eski hâline döndürülemedi: ${error.message}`);
  }
  try {
    powershell("Stop-Service DestekOfis -Force");
    writeFile(path.join(appsDir, "current.json"), `${JSON.stringify({ version: installed, selectedAt: new Date().toISOString(), installedBy: "kurulum" }, null, 2)}\n`);
    writeFile(keysFile, keysBefore);
    if (configBefore === null) writeFile(configFile, "{}");
    else writeFile(configFile, configBefore);
    for (const dir of [next, next2, ".hazir", ".indirilen"]) {
      try {
        rmSync(path.join(appsDir, dir), { recursive: true, force: true, maxRetries: 3 });
      } catch (error) {
        // Kalan klasör zararsız: bootstrap app\current.json'daki sürümü açar; sonraki kurulum eski sürümleri temizler.
        console.log(`  · ${dir} klasörü silinemedi (${error.code || error.message}); etkin sürüm ${installed}`);
      }
    }
    // update-state.json'daki hazır paket kaydı (silinen klasörü gösterir) temizlenir.
    try {
      const statePath = path.join(appsDir, "update-state.json");
      const saved = JSON.parse(readFile(statePath));
      writeFile(statePath, JSON.stringify({ ...saved, prepared: null }));
    } catch {
      // Durum dosyası yoksa sorun değil.
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
