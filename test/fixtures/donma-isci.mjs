// 2.5.0 Ç3 — donmuş defter yaşam testinin (test/donmus-defter-yasam-250.test.mjs) AYRI SÜREÇ işçisi: programı (startTestServer) verilen veri klasöründe açar, dönem kilidini
// HTTP ucundan koyar; dondurma iş parçacığı İLK parçayı yazınca (YALNIZ TEST kancası __testFreezeHook "batch") işaret dosyasını yazar ve sonsuza dek bekler — ana süreç
// SIGKILL ile öldürür (yarım koşu: kilit konmuş, satırların bir kısmı yazılmış, koşu "pending"). Lisans servisine istek yok (HUKUK_LICENSE_URL; ders 30).
//   node test/fixtures/donma-isci.mjs <veri klasörü> <yedek klasörü> <işaret dosyası> <kilit günü>
import { writeFileSync } from "node:fs";
import { loginAdmin, startTestServer } from "../helpers.mjs";

const [dataDir, backupDir, marker, day] = process.argv.slice(2);
const hook = {
  fn: async phase => {
    if (phase !== "batch") return;
    writeFileSync(marker, "ilk parça yazıldı, koşu açık");
    await new Promise(() => {}); // ana süreç öldürür
  },
};
const server = await startTestServer({ dataDir, backupDir, now: { time: "2027-01-10T10:00:00+03:00", fixed: true }, freezeBatchLines: 3, __testFreezeHook: hook });
const admin = await loginAdmin(server);
await admin.put("/api/admin/period-lock", { lockedUntil: day });
