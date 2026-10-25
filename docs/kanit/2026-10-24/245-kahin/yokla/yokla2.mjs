// Kara kutu yoklaması 2 (ORTAM): hareket silme / Silinenler kalemi / düzenleme yanıtı, kullanıcı yetkisi, dues/settle reddi. Kural TÜRETİLMEZ.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const KOK = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(KOK, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kahin245-yokla2-"));
const BUGUN = "2026-06-15";
const server = await startTestServer({ dataDir: path.join(veri, "data"), now: `${BUGUN}T09:00:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client();
const un = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = async (m, u, b, cl = c) => { const r = m === "GET" ? await cl.get(u) : m === "DELETE" ? await cl.del(u) : await cl[m.toLowerCase()](u, b); return { s: r.status, d: un(r) }; };
const kisa = o => JSON.stringify(o, (k, v) => (typeof v === "string" && v.length > 60 ? v.slice(0, 60) + "…" : v)).slice(0, 900);
try {
  await c.login("admin", ADMIN_PASSWORD);
  await api("POST", "/api/workspace/bank/setup/dismiss", {});
  const A = (await api("POST", "/api/workspace/accounts", { name: "Ali Alıcı", type: "customer", phone: "", registeredOn: "2026-06-01" })).d;
  const t1 = await api("POST", `/api/workspace/accounts/${A.id}/entries`, { kind: "in", amount: "100,00", date: "2026-06-10", method: "cash", cashForce: true, similarOk: true, note: "t1" });
  console.log("tahsilat yanıt anahtarları", t1.s, Object.keys(t1.d || {}).slice(0, 12).join(","));
  const b1 = await api("POST", `/api/workspace/accounts/${A.id}/entries`, { kind: "debt", amount: "300,00", date: "2026-06-05", note: "b1" });
  const acc = (await api("GET", `/api/workspace/accounts/${A.id}`)).d;
  const e = n => acc.entries.find(x => x.note === n);
  const pu = await api("PUT", `/api/workspace/accounts/${A.id}/entries/${e("b1").id}`, { kind: "debt", amount: "350,00", date: "2026-06-05", note: "b1" });
  console.log("borç PUT", pu.s, kisa(pu.d?.entries?.find(x => x.note === "b1") ?? pu.d));
  const pu2 = await api("PUT", `/api/workspace/accounts/${A.id}/entries/${e("b1").id}`, { amount: "360,00" });
  console.log("borç PUT kısmi", pu2.s, kisa((await api("GET", `/api/workspace/accounts/${A.id}`)).d.entries.find(x => x.id === e("b1").id)));
  const d1 = await api("DELETE", `/api/workspace/accounts/${A.id}/entries/${e("t1").id}`);
  console.log("tahsilat DEL", d1.s, kisa(d1.d));
  const d2 = await api("DELETE", `/api/workspace/accounts/${A.id}/entries/${e("b1").id}`);
  console.log("borç DEL", d2.s);
  const tr = await api("GET", "/api/admin/trash");
  const items = Array.isArray(tr.d) ? tr.d : tr.d?.items || [];
  console.log("trash", kisa(items.map(x => Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v !== "object")))));
  for (const it of items) { const r = await api("POST", "/api/admin/trash/restore", { id: it.id, cashForce: true }); console.log("restore", it.kind, r.s, kisa(r.d)); }
  const acc2 = (await api("GET", `/api/workspace/accounts/${A.id}`)).d;
  console.log("geri yüklenen", kisa(acc2.entries.map(x => ({ id: x.id, note: x.note, kind: x.kind, amount: x.amount }))), "eski idler", e("t1").id, e("b1").id);
  const st = await api("POST", "/api/workspace/dues/settle", { id: `account|${e("b1").id}` });
  console.log("settle account|", st.s, kisa(st.d));
  const u = await api("POST", "/api/admin/users", { username: "kahin-yetkisiz", name: "Y", role: "avukat", password: "Kahin-Yetkisiz-2026!", mustChangePassword: false });
  console.log("kullanıcı", u.s, kisa(u.d?.grants ?? u.d?.permissions ?? Object.keys(u.d || {})));
  const g = await api("PATCH", `/api/admin/users/${u.d?.id}`, { grants: { add: [], remove: ["accounts.view"] } });
  console.log("PATCH", g.s, kisa(g.d?.grants ?? g.d));
  const kc = server.client();
  console.log("giriş", (await kc.login("kahin-yetkisiz", "Kahin-Yetkisiz-2026!")).status);
  console.log("yetkisiz accounts", (await api("GET", "/api/workspace/accounts", null, kc)).s, "dues", (await api("GET", "/api/workspace/dues", null, kc)).s, "vade-takip", (await api("GET", "/api/workspace/overview/vade-takip?preset=open", null, kc)).s);
  const u2 = await api("POST", "/api/admin/users", { username: "kahin-avukat", name: "Z", role: "avukat", password: "Kahin-Yetkisiz-2026!", mustChangePassword: false });
  const kc2 = server.client();
  await kc2.login("kahin-avukat", "Kahin-Yetkisiz-2026!");
  console.log("avukat (kaldırmasız) accounts", (await api("GET", "/api/workspace/accounts", null, kc2)).s, "dues", (await api("GET", "/api/workspace/dues", null, kc2)).s);
  const v = await api("POST", `/api/workspace/accounts/${A.id}/entries`, { kind: "debt", amount: "10,00", date: "2026-13-01", note: "biçimsiz" });
  console.log("biçimsiz tarih", v.s, kisa(v.d));
} finally {
  await server.app.close();
}
