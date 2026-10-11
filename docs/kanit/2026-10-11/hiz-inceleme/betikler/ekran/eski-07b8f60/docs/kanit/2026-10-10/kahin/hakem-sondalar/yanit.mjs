import path from "node:path"; import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const s = await startTestServer(); const a = await loginAdmin(s);
const p = await a.post("/api/workspace/stock", { name: "Ü1", unit: "Adet", kind: "product" });
console.log("stock", p.status, JSON.stringify(p.data).slice(0, 300));
const c = await a.post("/api/workspace/accounts", { name: "C1", type: "customer" });
console.log("account", c.status, JSON.stringify(c.data).slice(0, 300));
await s.close();
