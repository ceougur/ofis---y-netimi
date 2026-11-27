// K-m: v2.4.9'un GERÇEK koduyla 5.000 "Açılış…" Borç / Alacak Yaz satırı (200 cari; yarısı kilitli dönemde) → veri kökü <hedef>
import { S, must } from "./ortak.mjs";
const target = process.argv[2];
const dataDir = `${target}/data`;
const backupDir = `${target}/backups`;
const old = await S.bootVersion("v2.4.9", { dataDir, backupDir, now: { time: "2026-10-20T12:00:00+03:00", fixed: true } });
try {
  const o = await old.login();
  await o.post("/api/workspace/bank/setup/dismiss", {});
  const notes = ["Açılış bakiyesi", "Açılış devri", "AÇILIŞ", "Açilış farkı"];
  const t0 = Date.now();
  let n = 0;
  for (let c = 0; c < 200; c += 1) {
    const a = await must("cari", o.post("/api/workspace/accounts", { name: `Aday Cari ${c % 150}`, type: c % 5 ? "customer" : "supplier", registeredOn: "2026-01-01" }));
    for (let k = 0; k < 25; k += 1) {
      const day = String(1 + ((c * 25 + k) % 28)).padStart(2, "0");
      const month = k < 12 ? "09" : "10";
      await must("satır", o.post(`/api/workspace/accounts/${a.id}/entries`, { kind: k % 3 ? "debt" : "credit", amount: String(10 + k), date: `2026-${month}-${month === "10" && Number(day) > 19 ? "19" : day}`, note: notes[k % 4] }));
      n += 1;
    }
  }
  await must("kilit", o.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
  console.log(`v2.4.9: ${n} satır, ${Math.round((Date.now() - t0) / 1000)} sn`);
} finally {
  await old.close();
}
