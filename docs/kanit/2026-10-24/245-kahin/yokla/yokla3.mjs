// Kara kutu yoklaması 3 (ORTAM): yedek al / geri yükle yanıt biçimi; yeniden başlatmada veri klasörü.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const KOK = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(KOK, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kahin245-yokla3-"));
const un = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const kisa = o => JSON.stringify(o).slice(0, 700);
let server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-06-15T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
let c = server.client();
const api = async (m, u, b) => { const r = m === "GET" ? await c.get(u) : m === "DELETE" ? await c.del(u) : await c[m.toLowerCase()](u, b); return { s: r.status, d: un(r) }; };
try {
  await c.login("admin", ADMIN_PASSWORD);
  const A = (await api("POST", "/api/workspace/accounts", { name: "Ali", type: "customer", registeredOn: "2026-06-01" })).d;
  await api("POST", `/api/workspace/accounts/${A.id}/entries`, { kind: "debt", amount: "300,00", date: "2026-06-05", note: "b1" });
  const comp = await api("GET", "/api/admin/companies");
  console.log("companies", comp.s, kisa(comp.d));
  const bk = await api("POST", "/api/admin/backups", {});
  console.log("backup", bk.s, kisa(bk.d));
  const ls = await api("GET", "/api/admin/backups");
  console.log("list", ls.s, kisa(ls.d));
  const acc = (await api("GET", `/api/workspace/accounts/${A.id}`)).d;
  await api("DELETE", `/api/workspace/accounts/${A.id}/entries/${acc.entries[0].id}`);
  const name = bk.d?.name || bk.d?.backups?.[0]?.name || (Array.isArray(ls.d) ? ls.d[0]?.name : ls.d?.backups?.[0]?.name);
  const cid = Array.isArray(comp.d) ? comp.d[0]?.id : comp.d?.companies?.[0]?.id;
  const code = Array.isArray(comp.d) ? comp.d[0]?.code : comp.d?.companies?.[0]?.code;
  const rs = await api("POST", "/api/admin/backups/restore", { name, company: cid, confirm: code, password: ADMIN_PASSWORD });
  console.log("restore", rs.s, kisa(rs.d), name, cid, code);
  const r2 = await c.get(`/api/workspace/accounts/${A.id}`);
  console.log("after restore same session", r2.status, kisa(un(r2)?.entries?.map(e => e.note)));
  // yeniden başlatma: aynı veri klasörü
  await server.app.close();
  server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-06-15T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  c = server.client();
  await c.login("admin", ADMIN_PASSWORD);
  const r3 = await api("GET", `/api/workspace/accounts/${A.id}`);
  console.log("after restart", r3.s, kisa(r3.d?.entries?.map(e => e.note)));
} finally {
  await server.app.close();
}
