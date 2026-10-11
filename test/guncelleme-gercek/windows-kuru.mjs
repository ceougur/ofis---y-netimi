// windows-kurulum.mjs'in LINUX KURU KOŞUSU (gerçek Windows DEĞİLDİR; ders 18: Windows'un kanıtı yalnız GitHub Windows koşucusu).
// Amaç: CI'ye girmeden önce betiğin mantığını (W1, W2, W3 adımları, eski hâline döndürme) gerçek bootstrap.mjs + gerçek servis
// yöneticisi + gerçek uygulama süreciyle denemek. Windows'a özgü parçalar taklit edilir:
//  - "powershell" komutu: yalnız Stop-/Start-/Restart-Service DestekOfis'i anlayan sahte servis denetimi (bu betik yazar; PATH'in
//    başına konur). Servis = kurulum kökündeki bootstrap.mjs, çıktısı logs/servis.log'a (nssm gibi), port 5123.
//  - W3'ün "mesai içi" zorlaması: Linux'ta saat dilimi/saat değiştirilmez; sahte denetim servisi kökteki .kuru-saat-kaydir (ms)
//    kadar ileri kaydırılmış saatle başlatır (yalnız servis süreci; node --import saat-kaydir).
// Kullanım: node test/guncelleme-gercek/windows-kuru.mjs   (çıktı: windows-kurulum.mjs'in "N denetim geçti, M başarısız" özeti)
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ADMIN_PASSWORD, HERE, prepareInstall } from "./ortak.mjs";

const ROOT_DIR = path.resolve(HERE, "..", "..");
const version = JSON.parse((await import("node:fs")).readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")).version;
const work = mkdtempSync(path.join(tmpdir(), "destekofis-win-kuru-"));
const root = path.join(work, "DestekOfis");
const bin = path.join(work, "bin");
mkdirSync(bin, { recursive: true });
await prepareInstall(root, { version });
copyFileSync(path.join(ROOT_DIR, "packaging", "windows", "bootstrap.mjs"), path.join(root, "bootstrap.mjs"));
mkdirSync(path.join(root, "logs"), { recursive: true });

// Saat kaydırma (yalnız kuru koşu; servis süreci ve onun açtığı süreçler değil — karar servis yöneticisinde).
const shiftModule = path.join(work, "saat-kaydir.mjs");
writeFileSync(
  shiftModule,
  `const shift = Number(process.env.SAAT_KAYDIR_MS || 0);
if (shift) {
  const Real = Date;
  class Shifted extends Real {
    constructor(...args) {
      if (args.length) super(...args);
      else super(Real.now() + shift);
    }
    static now() {
      return Real.now() + shift;
    }
  }
  globalThis.Date = Shifted;
}
`,
);
const pidFile = path.join(work, "servis.pid");
const shim = `#!/bin/bash
# Sahte servis denetimi (yalnız Linux kuru koşusu).
ROOT='${root}'
PID='${pidFile}'
stop_service() {
  if [ -f "$PID" ]; then
    p=$(cat "$PID")
    kill "$p" 2>/dev/null
    for i in $(seq 1 60); do kill -0 "$p" 2>/dev/null || break; sleep 0.5; done
    kill -9 "$p" 2>/dev/null
    rm -f "$PID"
  fi
}
start_service() {
  SHIFT=0
  [ -f "$ROOT/.kuru-saat-kaydir" ] && SHIFT=$(cat "$ROOT/.kuru-saat-kaydir")
  cd "$ROOT"
  SAAT_KAYDIR_MS="$SHIFT" HUKUK_ADMIN_PASSWORD='${ADMIN_PASSWORD}' HUKUK_LOG_LEVEL=info HUKUK_DATASET_AUTOSYNC=0 HUKUK_LICENSE_URL=http://127.0.0.1:9 \\
    setsid node --disable-warning=ExperimentalWarning --import '${shiftModule}' bootstrap.mjs servis >> "$ROOT/logs/servis.log" 2>&1 < /dev/null &
  echo $! > "$PID"
}
case "$*" in
  *"Restart-Service DestekOfis"*) stop_service; start_service ;;
  *"Stop-Service DestekOfis"*) stop_service ;;
  *"Start-Service DestekOfis"*) start_service ;;
  *) echo "kuru koşu: desteklenmeyen powershell komutu: $*" >&2; exit 3 ;;
esac
`;
writeFileSync(path.join(bin, "powershell"), shim);
chmodSync(path.join(bin, "powershell"), 0o755);

const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(HERE, "windows-kurulum.mjs"), root, ADMIN_PASSWORD], { stdio: "inherit", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
spawnSync(path.join(bin, "powershell"), ["Stop-Service DestekOfis -Force"], { stdio: "inherit" });
rmSync(work, { recursive: true, force: true });
process.exitCode = run.status ?? 1;
