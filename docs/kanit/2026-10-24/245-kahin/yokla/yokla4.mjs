// Kara kutu yoklaması 4 (ORTAM): yedekten geri yükleme yanıtı ve etkisi (aynı oturum / yeni giriş / yeniden başlatma).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const KOK = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(KOK, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kahin245-yokla4-"));
const un = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
let server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-06-15T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
let c = server.client();
const api = async (m, u, b) => { const r = m === "GET" ? await c.get(u) : m === "DELETE" ? await c.del(u) : await c[m.toLowerCase()](u, b); return { s: r.status, d: un(r) }; };
try {
  await c.login("admin", ADMIN_PASSWORD);
  const A = (await api("POST", "/api/workspace/accounts", { name: "Ali", type: "customer", registeredOn: "2026-06-01" })).d;
  await api("POST", `/api/workspace/accounts/${A.id}/entries`, { kind: "debt", amount: "300,00", date: "2026-06-05", note: "b1" });
  const bk = (await api("POST", "/api/admin/backups", {})).d;
  const acc = (await api("GET", `/api/workspace/accounts/${A.id}`)).d;
  await api("DELETE", `/api/workspace/accounts/${A.id}/entries/${acc.entries[0].id}`);
  const rs = await api("POST", "/api/admin/backups/restore", { name: bk.name, company: bk.company.id, confirm: bk.company.code, password: ADMIN_PASSWORD });
  console.log("restore", rs.s, JSON.stringify(rs.d).slice(0, 600));
  console.log("aynı oturum", JSON.stringify((await api("GET", `/api/workspace/accounts/${A.id}`)).d?.entries?.map(e => e.note)));
  for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 400)); console.log("bekleme", i, JSON.stringify((await api("GET", `/api/workspace/accounts/${A.id}`)).d?.entries?.map(e => e.note))); }
  c = server.client(); console.log("giriş", (await c.login("admin", ADMIN_PASSWORD)).status, JSON.stringify((await api("GET", `/api/workspace/accounts/${A.id}`)).d?.entries?.map(e => e.note)));
} finally { await server.app.close(); }
