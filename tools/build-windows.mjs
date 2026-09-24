// DestekOfis Windows kurulum dosyasını üretir: node tools/build-windows.mjs [--skip-installer] [--skip-launcher]
//
// 1) build/windows/stage altında kurulum düzenini hazırlar:
//      app/<sürüm>/ (sunucu + istemci) · app/current.json · bootstrap.mjs · bin/*.cmd
//      runtime/node.exe (Node.js LTS, imza/özet doğrulamalı) · runtime/nssm.exe (resmi 2.24-101, özet doğrulamalı)
//      launcher/DestekOfis.exe (Go ile derlenen istemci başlatıcı, simge ve sürüm bilgisiyle)
// 2) Inno Setup ile dist/DestekOfis-Kurulum-<sürüm>.exe üretir (Windows'ta ISCC, Linux'ta Wine + ISCC).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureNodeRuntime } from "./lib/node-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const args = new Set(process.argv.slice(2));
const packaging = path.join(root, "packaging", "windows");
const stage = path.join(root, "build", "windows", "stage");
const dist = path.join(root, "dist");
const NSSM_SHA256 = "eee9c44c29c2be011f1f1e43bb8c3fca888cb81053022ec5a0060035de16d848";

const sha256 = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const step = message => console.log(`• ${message}`);
const toCrlf = text => text.replace(/\r?\n/g, "\r\n");

function copyApp(target) {
  for (const item of ["server", "client", "docs", "package.json", "CHANGELOG.md", "README.md"]) {
    cpSync(path.join(root, item), path.join(target, item), { recursive: true, filter: source => !/(\.DS_Store|Thumbs\.db)$/.test(source) });
  }
  mkdirSync(path.join(target, "tools"), { recursive: true });
  cpSync(path.join(root, "tools", "backup.mjs"), path.join(target, "tools", "backup.mjs"));
}

function buildLauncher(outputDir) {
  const launcher = path.join(root, "launcher");
  const [major, minor, patch] = version.split(".").map(Number);
  const rc = `#pragma code_page(65001)
1 ICON "${path.join(packaging, "branding", "destekofis.ico").replace(/\\/g, "/")}"
1 24 "winres/destekofis.manifest"
1 VERSIONINFO
FILEVERSION ${major},${minor},${patch},0
PRODUCTVERSION ${major},${minor},${patch},0
FILEOS 0x40004
FILETYPE 0x1
BEGIN
  BLOCK "StringFileInfo"
  BEGIN
    BLOCK "041F04B0"
    BEGIN
      VALUE "CompanyName", "DestekOfis"
      VALUE "FileDescription", "DestekOfis İstemci"
      VALUE "FileVersion", "${version}"
      VALUE "InternalName", "DestekOfis"
      VALUE "LegalCopyright", "© 2026 DestekOfis"
      VALUE "OriginalFilename", "DestekOfis.exe"
      VALUE "ProductName", "DestekOfis"
      VALUE "ProductVersion", "${version}"
    END
  END
  BLOCK "VarFileInfo"
  BEGIN
    VALUE "Translation", 0x041F, 1200
  END
END
`;
  const manifest = readFileSync(path.join(launcher, "winres", "destekofis.manifest.template"), "utf8").replace(/__VERSION__/g, `${major}.${minor}.${patch}.0`);
  writeFileSync(path.join(launcher, "winres", "destekofis.manifest"), manifest);
  writeFileSync(path.join(launcher, "winres", "destekofis.rc"), rc);
  const syso = path.join(launcher, "rsrc_windows_amd64.syso");
  const windres = process.platform === "win32" ? "windres" : "x86_64-w64-mingw32-windres";
  try {
    const preprocessor = process.platform === "win32" ? [] : [`--preprocessor=${path.join(root, "tools", "lib", "rc-preprocessor.sh")}`];
    execFileSync(windres, [...preprocessor, "-c", "65001", "-O", "coff", "-i", "winres/destekofis.rc", "-o", syso], { cwd: launcher, stdio: "inherit" });
  } catch (error) {
    console.warn(`  ! Simge/sürüm kaynağı eklenemedi (${windres} yok?): başlatıcı simgesiz derlenecek.`);
    rmSync(syso, { force: true });
  }
  try {
    execFileSync("go", ["build", "-trimpath", "-ldflags", `-H=windowsgui -s -w -X main.version=${version}`, "-o", path.join(outputDir, "DestekOfis.exe"), "."], {
      cwd: launcher,
      stdio: "inherit",
      env: { ...process.env, GOOS: "windows", GOARCH: "amd64", CGO_ENABLED: "0", GOFLAGS: "-mod=mod", GOTOOLCHAIN: "local" },
    });
  } finally {
    rmSync(syso, { force: true });
  }
}

function findIscc() {
  if (process.env.ISCC && existsSync(process.env.ISCC)) return { command: process.env.ISCC, wine: false };
  if (process.platform === "win32") {
    for (const candidate of [
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Inno Setup 6", "ISCC.exe"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Inno Setup 6", "ISCC.exe"),
      path.join(root, "node_modules", "innosetup", "bin", "ISCC.exe"),
    ]) {
      if (existsSync(candidate)) return { command: candidate, wine: false };
    }
    return null;
  }
  const bundled = path.join(root, "node_modules", "innosetup", "bin", "ISCC.exe");
  const wine = ["/usr/lib/wine/wine", "/usr/bin/wine"].find(existsSync);
  return existsSync(bundled) && wine ? { command: bundled, wine } : null;
}

const winPath = value => (process.platform === "win32" ? value : `Z:${value.replace(/\//g, "\\")}`);

function compileInstaller() {
  const iscc = findIscc();
  if (!iscc) throw new Error("Inno Setup derleyicisi (ISCC) bulunamadı. Windows'ta Inno Setup 6 kurun; Linux'ta 'npm install' ve Wine gerekir.");
  // Inno Setup, Türkçe karakterler için UTF-8 BOM'lu betik bekler.
  const script = path.join(stage, "..", "setup.iss");
  cpSync(path.join(packaging, "branding"), path.join(stage, "..", "branding"), { recursive: true });
  writeFileSync(script, `\ufeff${toCrlf(readFileSync(path.join(packaging, "setup.iss"), "utf8").replace(/^\ufeff/, ""))}`);
  mkdirSync(dist, { recursive: true });
  const isccArgs = [`/DAppVersion=${version}`, `/DStageDir=${winPath(stage)}`, `/O${winPath(dist)}`, "/Q", winPath(script)];
  if (iscc.wine) execFileSync(iscc.wine, [iscc.command, ...isccArgs], { stdio: "inherit", env: { ...process.env, WINEDEBUG: "-all", WINEPREFIX: process.env.WINEPREFIX || path.join(process.env.HOME || "/root", ".wine-iscc"), WINEARCH: "win32" } });
  else execFileSync(iscc.command, isccArgs, { stdio: "inherit" });
  const output = path.join(dist, `DestekOfis-Kurulum-${version}.exe`);
  if (!existsSync(output)) throw new Error("Kurulum dosyası üretilmedi.");
  writeFileSync(`${output}.sha256`, `${sha256(output)}  ${path.basename(output)}\n`);
  return output;
}

const sizeOf = file => `${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`;

// Son kullanıcı kılavuzu: .md dosyaları Windows'ta varsayılan olarak açılamadığı için markalı, yazdırılabilir HTML üretilir.
async function renderGuide(targetDir) {
  const { marked } = await import("marked");
  const source = readFileSync(path.join(root, "docs", "KURULUM-VE-KULLANIM.md"), "utf8");
  const title = (source.match(/^#\s+(.+)$/m) || [null, "DestekOfis Kılavuzu"])[1];
  const mark = `data:image/svg+xml;base64,${readFileSync(path.join(root, "client", "assets", "brand", "destekofis-mark.svg")).toString("base64")}`;
  const body = marked.parse(source.replace(/^#\s+.+$/m, ""), { gfm: true });
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><link rel="icon" href="${mark}">
<style>
:root{--ink:#142b25;--muted:#5f7169;--line:#d9e6de;--soft:#f4f9f5;--accent:#1f6a50}
*{box-sizing:border-box}body{margin:0;background:#f7f5f0;color:var(--ink);font:16px/1.65 "Segoe UI",system-ui,-apple-system,sans-serif}
header{display:flex;gap:14px;align-items:center;padding:28px max(24px,calc((100vw - 880px)/2)) 22px;background:linear-gradient(135deg,#1f6a50,#15473a);color:#fff}
header img{width:52px;height:52px;border-radius:14px;box-shadow:0 10px 24px rgba(0,0,0,.25)}header h1{margin:0;font-size:24px;letter-spacing:-.02em}header p{margin:2px 0 0;color:#d5ebe1;font-size:14px}
main{max-width:880px;margin:0 auto;padding:12px 24px 60px}
h2{margin:40px 0 12px;padding-top:12px;border-top:1px solid var(--line);font-size:21px;letter-spacing:-.01em}h2:first-child{border-top:0}
h3{margin:26px 0 8px;font-size:17px}p,li{color:#243a33}a{color:var(--accent)}
table{width:100%;margin:14px 0;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:14.5px}
th,td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:var(--soft);font-weight:700}tr:last-child td{border-bottom:0}
code{padding:2px 6px;border-radius:6px;background:#eaf2ec;font:13.5px Consolas,"Cascadia Mono",monospace}pre{padding:14px 16px;border-radius:12px;background:#10251f;color:#e6f2ec;overflow:auto}pre code{padding:0;background:none;color:inherit}
blockquote{margin:14px 0;padding:10px 16px;border-left:4px solid #cf9f4b;background:#fbf6ea;border-radius:0 10px 10px 0}
footer{max-width:880px;margin:0 auto;padding:0 24px 40px;color:var(--muted);font-size:13px}
@media print{header{background:none;color:var(--ink);padding:0 0 12px}body{background:#fff}h2{break-after:avoid}table,pre{break-inside:avoid}}
</style></head>
<body><header><img src="${mark}" alt=""><div><h1>${title}</h1><p>DestekOfis ${version} · Destek: 0532 605 05 87 · bilgi.ugurcetin@gmail.com</p></div></header>
<main>${body}</main><footer>© 2026 DestekOfis</footer></body></html>
`;
  writeFileSync(path.join(targetDir, "KURULUM-VE-KULLANIM.html"), html);
}

async function main() {
  console.log(`DestekOfis ${version} — Windows paketi`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  step("Uygulama dosyaları hazırlanıyor");
  copyApp(path.join(stage, "app", version));
  writeFileSync(path.join(stage, "app", "current.json"), `${JSON.stringify({ version, selectedAt: new Date().toISOString() }, null, 2)}\n`);
  cpSync(path.join(packaging, "bootstrap.mjs"), path.join(stage, "bootstrap.mjs"));
  mkdirSync(path.join(stage, "bin"), { recursive: true });
  for (const name of readdirSync(path.join(packaging, "bin"))) writeFileSync(path.join(stage, "bin", name), toCrlf(readFileSync(path.join(packaging, "bin", name), "utf8")));
  mkdirSync(path.join(stage, "docs"), { recursive: true });
  cpSync(path.join(root, "docs", "KURULUM-VE-KULLANIM.md"), path.join(stage, "docs", "KURULUM-VE-KULLANIM.md"));
  await renderGuide(path.join(stage, "docs"));

  step("Çalışma zamanı: Node.js ve nssm");
  mkdirSync(path.join(stage, "runtime"), { recursive: true });
  const runtime = await ensureNodeRuntime({ cacheDir: path.join(root, "build", "cache") });
  cpSync(runtime.nodeExe, path.join(stage, "runtime", "node.exe"));
  console.log(`  node.exe ${runtime.version} (${runtime.source}, sha256 ${runtime.sha256.slice(0, 16)}…)`);
  const nssm = path.join(root, "vendor", "nssm", "nssm.exe");
  if (sha256(nssm) !== NSSM_SHA256) throw new Error("nssm.exe özeti beklenen resmi sürümle eşleşmiyor.");
  cpSync(nssm, path.join(stage, "runtime", "nssm.exe"));

  if (!args.has("--skip-launcher")) {
    step("İstemci başlatıcısı derleniyor (Go, windows/amd64)");
    mkdirSync(path.join(stage, "launcher"), { recursive: true });
    buildLauncher(path.join(stage, "launcher"));
    console.log(`  DestekOfis.exe ${sizeOf(path.join(stage, "launcher", "DestekOfis.exe"))}`);
  }

  if (!args.has("--skip-installer")) {
    step("Kurulum dosyası derleniyor (Inno Setup)");
    const output = compileInstaller();
    console.log(`\n✓ ${path.relative(root, output)} · ${sizeOf(output)} · sha256 ${sha256(output)}`);
  } else console.log(`\n✓ Hazırlık klasörü: ${path.relative(root, stage)}`);
}

main().catch(error => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
