// Basit, bağımlılıksız günlükleyici. Windows servisinde stdout/stderr dosyaya yönlendirilir.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger(level = "info") {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const write = (name, stream) => (message, meta) => {
    if (LEVELS[name] < threshold) return;
    const line = `${new Date().toISOString()} [${name.toUpperCase()}] ${message}`;
    const suffix = meta === undefined ? "" : ` ${meta instanceof Error ? meta.stack || meta.message : JSON.stringify(meta)}`;
    stream.write(`${line}${suffix}\n`);
  };
  return {
    debug: write("debug", process.stdout),
    info: write("info", process.stdout),
    warn: write("warn", process.stderr),
    error: write("error", process.stderr),
  };
}
