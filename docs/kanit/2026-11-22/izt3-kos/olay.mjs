// Prob: stok iadesi düzelt / sil / geri yükle sonrası öbür ekrana giden canlı olaylar. Kullanım: node olay.mjs <kod kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const ROOT = path.resolve(process.argv[2]);
const { createUser, loginAdmin, startTestServer } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const server = await startTestServer({ now: { time: "2026-11-10T12:00:00+03:00", fixed: true } });
const admin = await loginAdmin(server);
const watcher = await createUser(server, admin, { username: "izleyici1", role: "personel" });
const d = r => (r.data && "ok" in r.data ? r.data.data : r.data);
const W = "/api/workspace";
const A = d(await admin.post(`${W}/accounts`, { name: "Prob", type: "customer", registeredOn: "2026-08-01" })).id;
const mal = d(await admin.post(`${W}/stock`, { kind: "goods", code: "PRB", name: "Prob Malı", unit: "Adet", openingQty: "100", salePrice: "300" })).id;
await admin.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "900", date: "2026-09-01", note: "elle" });
const k = d(await admin.post(`${W}/plans`, { accountId: A, name: "K", total: "900", registeredOn: "2026-09-02", mode: "auto", count: 3, firstDue: "2026-10-05", coversBalance: true })).id;
const controller = new AbortController();
const response = await fetch(`${server.base}/api/events`, { headers: { cookie: watcher.cookie, accept: "text/event-stream" }, signal: controller.signal });
const reader = response.body.getReader();
let stream = "";
(async () => {
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      stream += new TextDecoder().decode(value);
    }
  } catch {}
})();
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(800);
const take = () => {
  const out = [...stream.matchAll(/event: ([\w.]+)\ndata: (.*)\n/g)].map(([, n, j]) => ({ n, ...JSON.parse(j) })).filter(e => e.n === "workspace.changed").map(e => `${e.kind}${e.planId ? ":" + (e.planId === k ? "K" : e.planId) : ""}${e.accountId ? "@" + (e.accountId === A ? "A" : e.accountId) : ""}`);
  stream = "";
  return out;
};
const total = () => server.app.store.get("SELECT total FROM plans WHERE id = ?", k).total;
take();
const mv = d(await admin.post(`${W}/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "300", pay: "account", accountId: A, date: "2026-11-10" }));
await wait(900);
console.log("yeni iade      kart", total(), take().join(" "));
let r = await admin.put(`${W}/stock/${mal}/moves/${mv.moveId}`, { qty: "2", unitPrice: "300" });
await wait(900);
console.log("düzelt 1→2", r.status, "kart", total(), take().join(" "));
r = await admin.del(`${W}/stock/${mal}/moves/${mv.moveId}`);
await wait(900);
console.log("sil", r.status, "kart", total(), take().join(" "));
const trash = d(await admin.get("/api/admin/trash"));
const row = trash.find(x => x.kind === "stock-move" && x.ref === mv.moveId);
r = await admin.post("/api/admin/trash/restore", { id: row.id });
await wait(900);
console.log("geri yükle", r.status, "kart", total(), take().join(" "));
controller.abort();
await server.close();
process.exit(0);
