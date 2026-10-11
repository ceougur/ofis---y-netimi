const ROOT = "/home/user/ofis---y-netimi";
const dbPath = process.argv[2];
const { createReportRunner } = await import(ROOT + "/server/lib/report-runner.mjs");
const user = { id: "u1", username: "admin", display_name: "Yönetici", role: "admin", role_key: "admin", roleKey: "admin" };
for (const delay of [300, 1000, 2000]) {
  const r = createReportRunner();
  const t0 = Date.now();
  const p = r.run({ dbPath, time: "2026-10-11T09:00:00.000Z", id: "banka-hareket", query: { preset: "all" }, user, limit: 200 }).then(d => "ok " + d.total, e => `${e.constructor.name} ${e.status ?? "-"} ${e.message}`);
  await new Promise(res => setTimeout(res, delay));
  const tc = Date.now();
  await r.close();
  console.log(`rapor ${delay} ms sonra close(): close süresi ${Date.now() - tc} ms; rapor sonucu: ${await p} (toplam ${Date.now() - t0} ms)`);
}
