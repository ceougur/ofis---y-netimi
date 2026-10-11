const ROOT = "/home/user/ofis---y-netimi";
const { createReportRunner } = await import(ROOT + "/server/lib/report-runner.mjs");
const { HttpError } = await import(ROOT + "/server/lib/http.mjs");
const user = { id: "u1", username: "admin", role: "admin", role_key: "admin", roleKey: "admin" };
const r = createReportRunner();
for (const [ad, data] of [["olmayan dosya", { dbPath: "/yok/yok.sqlite" }], ["bozuk saat", { dbPath: process.argv[2], time: "bozuk" }], ["bilinmeyen rapor id", { dbPath: process.argv[2], id: "yok-rapor" }]]) {
  const out = await r.run({ time: "2026-10-11T09:00:00.000Z", id: "banka-hareket", query: {}, user, limit: 1, ...data }).then(d => "ok " + d.total, e => `${e.constructor.name} HttpError=${e instanceof HttpError} status=${e.status} mesaj="${e.message}"`);
  console.log(ad + ":", out);
}
await r.close();
