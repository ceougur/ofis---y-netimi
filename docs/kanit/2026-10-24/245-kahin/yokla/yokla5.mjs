// Kara kutu yoklaması 5 (ORTAM, KS7): şüpheli alacak / değersiz / faturasız stok satış iadesi / alış iadesi uç yanıtları ve cari hareket biçimi. Kural TÜRETİLMEZ.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const KOK = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(KOK, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kahin245-yokla5-"));
const un = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-06-15T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client();
const api = async (m, u, b) => { const r = m === "GET" ? await c.get(u) : m === "DELETE" ? await c.del(u) : await c[m.toLowerCase()](u, b); return { s: r.status, d: un(r) }; };
const kisa = o => JSON.stringify(o, (k, v) => (typeof v === "string" && v.length > 60 ? v.slice(0, 60) + "…" : v)).slice(0, 700);
const hareketler = async id => (await api("GET", `/api/workspace/accounts/${id}`)).d?.entries?.map(e => ({ kind: e.kind, amount: e.amount, source: e.source, note: e.note, date: e.date }));
try {
  await c.login("admin", ADMIN_PASSWORD);
  await api("POST", "/api/workspace/bank/setup/dismiss", {});
  const mal = await api("POST", "/api/workspace/stock", { kind: "goods", code: "KH-MAL", name: "Kâhin Malı", unit: "Adet", openingQty: "1000", salePrice: "100" });
  console.log("mal", mal.s, kisa(Object.keys(mal.d || {})));
  const A = (await api("POST", "/api/workspace/accounts", { name: "Ali Alıcı", type: "customer", registeredOn: "2026-05-01", openingBalance: "1000,00", openingSide: "auto" })).d;
  const iade = await api("POST", `/api/workspace/stock/${mal.d.id}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "200,00", pay: "account", accountId: A.id, date: "2026-06-10" });
  console.log("satış iadesi", iade.s, kisa(iade.d && Object.keys(iade.d)));
  console.log(" A hareketler", kisa(await hareketler(A.id)));
  const sp = await api("POST", `/api/workspace/accounts/${A.id}/doubtful`, { amount: "300,00", date: "2026-06-11", reason: "other" });
  console.log("şüpheli", sp.s, kisa(sp.d));
  const did = sp.d?.id ?? sp.d?.record?.id;
  const wo = await api("POST", `/api/workspace/accounts/${A.id}/doubtful/${did}/write-off`, { amount: "100,00", date: "2026-06-12" });
  console.log("değersiz", wo.s, kisa(wo.d));
  console.log(" A hareketler", kisa(await hareketler(A.id)));
  console.log(" A bakiye", (await api("GET", `/api/workspace/accounts/${A.id}`)).d?.totals?.balance);
  const T = (await api("POST", "/api/workspace/accounts", { name: "Tuna Tedarik", type: "supplier", registeredOn: "2026-05-01" })).d;
  const al = await api("POST", `/api/workspace/stock/${mal.d.id}/moves`, { kind: "in", qty: "2", unitPrice: "50,00", pay: "account", accountId: T.id, date: "2026-06-05" });
  console.log("alış (hesaba)", al.s);
  const ai = await api("POST", `/api/workspace/stock/${mal.d.id}/moves`, { kind: "out", reason: "return", qty: "1", unitPrice: "50,00", pay: "account", accountId: T.id, date: "2026-06-10" });
  console.log("alış iadesi (out+return)", ai.s, kisa(ai.d && (ai.d.error ? ai.d : Object.keys(ai.d))));
  console.log(" T hareketler", kisa(await hareketler(T.id)));
} finally {
  await server.app.close();
  rmSync(veri, { recursive: true, force: true });
}
