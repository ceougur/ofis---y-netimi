// Bu bilgisayarın kimliği (lisansın bağlandığı "kurulum kodu").
//
// Windows'ta işletim sisteminin kurulumda ürettiği MachineGuid kullanılır (HKLM\SOFTWARE\Microsoft\Cryptography);
// yeniden başlatma, güncelleme ve DestekOfis'i kaldırıp kurma ile değişmez, Windows yeniden kurulursa değişir.
// Kısıtlı servis hesabı (NT SERVICE\DestekOfis) bu değeri okuyabilir. Linux'ta /etc/machine-id kullanılır.
// Ham değer dışarı verilmez: ürün adıyla birlikte SHA-256 özeti alınır ve ilk 32 karakteri kimlik olur.
// Hiçbiri okunamazsa veri klasörüne bir kez yazılan rastgele kimlik kullanılır (source: "file").
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeMachineId } from "./license-token.mjs";

const digest = raw => createHash("sha256").update(`DestekOfis|makine|1|${raw}`).digest("hex").slice(0, 32);

function windowsMachineGuid() {
  const output = execFileSync("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"], { encoding: "utf8", timeout: 5000, windowsHide: true });
  const match = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{36})/.exec(output);
  return match ? match[1].toLowerCase() : null;
}

function linuxMachineId() {
  for (const file of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      const value = readFileSync(file, "utf8").trim();
      if (/^[0-9a-f]{32}$/i.test(value)) return value.toLowerCase();
    } catch {
      // sonraki dosya
    }
  }
  return null;
}

export function resolveMachineId({ dataDir, override = null, platform = process.platform, log } = {}) {
  const forced = normalizeMachineId(override);
  if (forced) return { id: forced, source: "override" };
  try {
    const raw = platform === "win32" ? windowsMachineGuid() : platform === "linux" ? linuxMachineId() : null;
    if (raw) return { id: digest(raw), source: platform === "win32" ? "windows" : "linux" };
  } catch (error) {
    log?.warn?.("Bilgisayar kimliği okunamadı; veri klasöründeki kimlik kullanılacak", error);
  }
  const file = path.join(dataDir, ".makine-kimligi");
  try {
    const stored = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
    if (/^[a-f0-9]{64}$/.test(stored)) return { id: digest(`file:${stored}`), source: "file" };
    const value = randomBytes(32).toString("hex");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(file, value, { mode: 0o600 });
    return { id: digest(`file:${value}`), source: "file" };
  } catch (error) {
    log?.error?.("Bilgisayar kimliği oluşturulamadı", error);
    return { id: digest(`fallback:${dataDir}`), source: "fallback" };
  }
}
