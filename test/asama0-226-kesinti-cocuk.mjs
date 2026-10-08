// asama0-226-kesinti.test.mjs'in çocuk süreci: uygulamayı verilen veri klasöründe açar; Silinenler'e (trash) yazılacağı anda
// (silme işleminin ortası) süreci dondurur ve işaret dosyası bırakır. Ebeveyn bu anda SIGKILL gönderir (elektrik kesintisi).
import { writeFileSync } from "node:fs";
import { createApp } from "../server/app.mjs";

const [dataDir, backupDir, marker, password] = process.argv.slice(2);
const app = createApp({
  dataDir,
  backupDir,
  logLevel: "silent",
  scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: password, HUKUK_DATASET_AUTOSYNC: "0" },
  license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false,
});
const address = await app.listen(0, "127.0.0.1");
const freeze = new Int32Array(new SharedArrayBuffer(4));
app.db.function("hof_dur", () => {
  writeFileSync(marker, "donduruldu");
  Atomics.wait(freeze, 0, 0, 120_000);
  return 0;
});
app.db.exec("CREATE TEMP TRIGGER t226_dur BEFORE INSERT ON main.trash BEGIN SELECT hof_dur(); END;");
process.send({ port: address.port });
