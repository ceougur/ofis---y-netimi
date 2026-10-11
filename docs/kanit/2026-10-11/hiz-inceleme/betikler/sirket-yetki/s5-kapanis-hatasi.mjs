import { createReportRunner } from "/home/user/ofis---y-netimi/server/lib/report-runner.mjs";
import { readdirSync } from "node:fs";
const file = process.argv[2];
const r = createReportRunner();
const p = r.run({ dbPath: file, time: new Date().toISOString(), id: "banka-hareket", query: { preset: "all" }, user: { id: "x", perms: new Set(["bank.reports"]) }, limit: 1 }).then(() => "bitti", e => ({ name: e.constructor.name, status: e.status ?? null, message: e.message }));
await new Promise(res => setTimeout(res, 400));
await r.close();
console.log(JSON.stringify(await p));
