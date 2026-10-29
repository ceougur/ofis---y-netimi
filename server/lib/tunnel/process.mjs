// 2.4.7 M4 — cloudflared süreç denetçisi (docs/mobil/M4-TASARIM.md §5).
//
//  - Başlat; çökerse geri çekilmeli yeniden başlat (1 sn → 2 → 4 … en çok 5 dk; 60 sn ayakta kalırsa sayaç sıfırlanır).
//  - Durdur: süreç AĞACI kapanır — Windows'ta `taskkill /PID <pid> /T /F`, Linux/macOS'ta ayrı süreç grubu (detached) ve gruba SIGTERM, 5 sn sonra SIGKILL.
//  - Yetim süreç kalmaz: başlatılan sürecin kimliği kimlik dosyasına (pid + ikili yolu) yazılır. Program sert biçimde öldürülürse (taskkill /F, elektrik)
//    bir sonraki açılışta reapOrphan() o pid hâlâ AYNI ikiliyi çalıştırıyorsa (Linux /proc/<pid>/cmdline, Windows Win32_Process.CommandLine) onu kapatır;
//    başka bir program o pid'i almışsa dokunulmaz. Böylece güncelleme / servis yeniden başlatması iki bağlayıcıyı aynı anda bırakmaz.
//  - Çıktı satırları onLine'a gider (durum: "Registered tunnel connection" → bağlı).
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const BACKOFF = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 120_000, 300_000];
const STABLE_MS = 60_000;

const run = (file, args, timeoutMs = 15_000) =>
  new Promise(resolve => {
    execFile(file, args, { windowsHide: true, timeout: timeoutMs }, (error, stdout) => resolve({ error, stdout: String(stdout || "") }));
  });

export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** Sürecin komut satırı (bulunamazsa ""). */
export async function commandLineOf(pid, { platform = process.platform } = {}) {
  if (platform === "win32") {
    const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`]);
    return stdout.trim();
  }
  try {
    return readFileSync(`/proc/${Number(pid)}/cmdline`, "utf8").replace(/\0/g, " ").trim();
  } catch {
    const { stdout } = await run("ps", ["-o", "command=", "-p", String(Number(pid))]);
    return stdout.trim();
  }
}

/** Süreç ağacını kapatır; kapanınca true. */
export async function killTree(pid, { platform = process.platform, graceMs = 5_000 } = {}) {
  if (!isAlive(pid)) return true;
  if (platform === "win32") {
    await run("taskkill", ["/PID", String(pid), "/T", "/F"]);
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // zaten kapanmış
      }
    }
    const until = Date.now() + graceMs;
    while (isAlive(pid) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
    if (isAlive(pid)) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // kapanmış
        }
      }
    }
  }
  const until = Date.now() + 5_000;
  while (isAlive(pid) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  return !isAlive(pid);
}

const sameBinary = (commandLine, binary, platform) => {
  const a = String(commandLine || "");
  const b = String(binary || "");
  if (!a || !b) return false;
  return platform === "win32" ? a.toLowerCase().includes(b.toLowerCase()) : a.includes(b);
};

/** Önceki çalışmadan kalan bağlayıcıyı kapatır (yalnız aynı ikiliyi çalıştırıyorsa). { reaped, pid } */
export async function reapOrphan(pidFile, { platform = process.platform, log = console } = {}) {
  if (!pidFile || !existsSync(pidFile)) return { reaped: false, pid: null };
  let record = null;
  try {
    record = JSON.parse(readFileSync(pidFile, "utf8"));
  } catch {
    record = null;
  }
  const pid = Number(record?.pid);
  let reaped = false;
  if (Number.isInteger(pid) && pid > 0 && isAlive(pid) && sameBinary(await commandLineOf(pid, { platform }), record.binary, platform)) {
    log.warn?.(`Önceki çalışmadan kalan bağlantı bileşeni (pid ${pid}) kapatılıyor.`);
    reaped = await killTree(pid, { platform });
  }
  rmSync(pidFile, { force: true });
  return { reaped, pid: Number.isInteger(pid) ? pid : null };
}

/**
 * @param {object} o
 * @param {string} o.binary çalıştırılacak dosya (doğrulanmış cloudflared ya da testte node)
 * @param {Function} o.args () => string[] (her başlatmada yeniden; port değişebilir)
 * @param {Function} o.env  () => object (TUNNEL_TOKEN burada; dosyaya yazılmaz)
 * @param {string} o.pidFile kimlik dosyası
 * @param {string} [o.identity] kimlik dosyasına yazılan "ikili" (yetim denetiminde komut satırında aranır; varsayılan binary)
 * @param {Function} o.onLine (satır) => void
 * @param {Function} o.onState ({ running, pid, restarts, nextRetryMs, lastExit }) => void
 */
export function createProcessSupervisor({ binary, args, env = () => ({}), pidFile, identity = binary, onLine = () => {}, onState = () => {}, backoff = BACKOFF, stableMs = STABLE_MS, platform = process.platform, spawnImpl = spawn, log = console }) {
  let child = null;
  let wanted = false;
  let attempt = 0;
  let retryTimer = null;
  let stableTimer = null;
  let restarts = 0;
  let lastExit = null;
  let exiting = null;

  const report = (extra = {}) => onState({ running: Boolean(child), pid: child?.pid ?? null, restarts, lastExit, ...extra });

  function launch() {
    retryTimer = null;
    if (!wanted || child) return;
    const proc = spawnImpl(binary, args(), {
      env: { ...process.env, ...env() },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      // POSIX: ayrı süreç grubu → gruba sinyal (ağaç). Windows'ta ağaç taskkill /T ile.
      detached: platform !== "win32",
    });
    child = proc;
    exiting = new Promise(resolve => proc.once("exit", resolve));
    if (proc.pid) {
      try {
        writeFileSync(pidFile, JSON.stringify({ pid: proc.pid, binary: identity, startedAt: new Date().toISOString() }));
      } catch (error) {
        log.warn?.(`Bağlantı bileşeninin kimlik dosyası yazılamadı: ${error.message}`);
      }
    }
    let buffer = "";
    const feed = chunk => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) if (line.trim()) onLine(line);
    };
    proc.stdout?.on("data", feed);
    proc.stderr?.on("data", feed);
    proc.once("error", error => {
      log.warn?.(`Bağlantı bileşeni başlatılamadı: ${error.message}`);
    });
    proc.once("exit", (code, signal) => {
      if (buffer.trim()) onLine(buffer);
      buffer = "";
      clearTimeout(stableTimer);
      if (child === proc) child = null;
      lastExit = { code, signal, at: new Date().toISOString() };
      if (!wanted) {
        rmSync(pidFile, { force: true });
        report();
        return;
      }
      restarts += 1;
      const delay = backoff[Math.min(attempt, backoff.length - 1)];
      attempt += 1;
      report({ nextRetryMs: delay });
      retryTimer = setTimeout(launch, delay);
      retryTimer.unref?.();
    });
    stableTimer = setTimeout(() => {
      attempt = 0;
    }, stableMs);
    stableTimer.unref?.();
    report();
  }

  return {
    start() {
      wanted = true;
      if (!child && !retryTimer) launch();
    },
    async stop() {
      wanted = false;
      clearTimeout(retryTimer);
      retryTimer = null;
      clearTimeout(stableTimer);
      const proc = child;
      if (proc?.pid) {
        await killTree(proc.pid, { platform });
        await Promise.race([exiting, new Promise(resolve => setTimeout(resolve, 5_000))]);
      }
      child = null;
      rmSync(pidFile, { force: true });
      attempt = 0;
      report();
    },
    pid: () => child?.pid ?? null,
    running: () => Boolean(child),
    stats: () => ({ restarts, lastExit, attempt }),
  };
}
