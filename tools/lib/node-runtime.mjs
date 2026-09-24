// Kurulum paketine gömülecek Node.js (Windows x64) çalışma zamanını sağlar.
// Sıra: NODE_WIN_EXE ortam değişkeni → önbellek → nodejs.org (SHASUMS256 doğrulamalı) → npm "node-win-x64"
// paketi (OpenJS Foundation Authenticode imzasının özeti doğrulanır).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readZip } from "../../server/lib/zip.mjs";

export const NODE_RUNTIME_VERSION = "24.21.0";
const sha256 = buffer => createHash("sha256").update(buffer).digest("hex");

async function fromNodejsOrg(version) {
  const base = `https://nodejs.org/dist/v${version}`;
  const name = `node-v${version}-win-x64.zip`;
  const sums = await fetch(`${base}/SHASUMS256.txt`, { signal: AbortSignal.timeout(20_000) });
  if (!sums.ok) throw new Error(`SHASUMS256 indirilemedi (${sums.status})`);
  const expected = (await sums.text()).split("\n").find(line => line.trim().endsWith(name))?.split(/\s+/)[0];
  if (!expected) throw new Error("SHASUMS256 içinde paket bulunamadı");
  const response = await fetch(`${base}/${name}`, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`Node.js paketi indirilemedi (${response.status})`);
  const zip = Buffer.from(await response.arrayBuffer());
  if (sha256(zip) !== expected) throw new Error("Node.js paketinin SHA-256 özeti eşleşmedi");
  const entry = readZip(zip).find(item => item.name.endsWith("/node.exe") && item.name.split("/").length === 2);
  if (!entry) throw new Error("Paket içinde node.exe bulunamadı");
  return { data: entry.data, source: "nodejs.org (SHA-256 doğrulandı)" };
}

function fromNpm(version) {
  const work = mkdtempSync(path.join(tmpdir(), "node-win-"));
  try {
    const tarball = execFileSync("npm", ["pack", `node-win-x64@${version}`, "--silent"], { cwd: work, encoding: "utf8" }).trim().split("\n").pop();
    execFileSync("tar", ["xzf", tarball], { cwd: work });
    const exe = path.join(work, "package", "bin", "node.exe");
    if (!existsSync(exe)) throw new Error("npm paketinde node.exe yok");
    verifyAuthenticode(exe);
    return { data: readFileSync(exe), source: "npm node-win-x64 (Authenticode özeti doğrulandı)" };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// OpenJS Foundation imzası: imzalanan özet ile dosyanın hesaplanan özeti aynı olmalı.
function verifyAuthenticode(file) {
  let output = "";
  try {
    output = execFileSync("osslsigncode", ["verify", "-in", file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    output = `${error.stdout || ""}${error.stderr || ""}`;
    if (!output) throw new Error("osslsigncode bulunamadı; imza doğrulanamadı");
  }
  const current = output.match(/Current message digest\s*:\s*([0-9A-F]+)/i)?.[1];
  const calculated = output.match(/Calculated message digest\s*:\s*([0-9A-F]+)/i)?.[1];
  if (!current || current !== calculated) throw new Error("node.exe imza özeti doğrulanamadı");
  if (!/OpenJS Foundation/.test(output)) throw new Error("node.exe OpenJS Foundation tarafından imzalanmamış");
}

export async function ensureNodeRuntime({ cacheDir, version = NODE_RUNTIME_VERSION }) {
  if (process.env.NODE_WIN_EXE && existsSync(process.env.NODE_WIN_EXE)) {
    const data = readFileSync(process.env.NODE_WIN_EXE);
    return { nodeExe: process.env.NODE_WIN_EXE, version, source: "NODE_WIN_EXE", sha256: sha256(data) };
  }
  const target = path.join(cacheDir, `node-v${version}-win-x64`, "node.exe");
  if (!existsSync(target)) {
    let result;
    try {
      result = await fromNodejsOrg(version);
    } catch (error) {
      console.warn(`  ! nodejs.org kullanılamadı (${error.message}); npm paketine geçiliyor.`);
      result = fromNpm(version);
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, result.data);
    writeFileSync(`${target}.source`, `${result.source}\n`);
  }
  const data = readFileSync(target);
  const source = existsSync(`${target}.source`) ? readFileSync(`${target}.source`, "utf8").trim() : "önbellek";
  return { nodeExe: target, version, source, sha256: sha256(data) };
}
