// Sürücüyü (test/bagimsiz/whatsapp-248/surucu.mjs) koşar; sürücü özetini (# skipped N) yazdıktan sonra açık kalan tutamaçlar yüzünden çıkmıyor (06.11'den beri gözlem —
// karşılaştırma dosyası özetten ÖNCE yazılır). Özet görülünce 3 sn sonra YALNIZ kendi çocuğunu (pid) durdurur; çıkış kodu = fail > 0 ? 1 : 0. Kullanım: node surucu-sar.mjs <argümanlar…>
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["test/bagimsiz/whatsapp-248/surucu.mjs", ...process.argv.slice(2)], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "inherit"] });
let buf = "";
let fail = null;
let done = false;
child.stdout.on("data", chunk => {
  process.stdout.write(chunk);
  buf += chunk.toString("utf8");
  const f = /^# fail (\d+)$/m.exec(buf);
  if (f) fail = Number(f[1]);
  if (!done && /^# skipped \d+$/m.test(buf)) {
    done = true;
    setTimeout(() => child.kill("SIGTERM"), 3000);
  }
});
child.on("exit", code => {
  process.exitCode = done ? (fail ? 1 : 0) : code ?? 2;
});
