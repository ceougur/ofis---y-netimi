// dar kontrol D3 tur 6 — ROOT sürümünün GERÇEK koduyla (kendi API'si, süreç saati) taksit kartı verisi: kapanış K öncesi / K günü / gece yarısı / K sonrası,
// kapandıktan sonra düzenlenen, kapanıp yeniden açılan, tamamı ödenmiş kapalı, carisiz olacak kapalı, açık.
// ROOT=<eski kök> OUT=<boş klasör> SAAT=<yeni depo test/fixtures/surec-saati.mjs> HUKUK_LICENSE_URL=http://127.0.0.1:9 node uret-genel.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const { ROOT, OUT, SAAT } = process.env;
const { installProcessClock } = await import(pathToFileURL(SAAT).href);
const at = iso => installProcessClock(new Date(iso).getTime());
at("2026-05-01T10:00:00+03:00");
const helpers = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const dataDir = path.join(OUT, "data");
mkdirSync(dataDir, { recursive: true });
const srv = await helpers.startTestServer({ dataDir, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = srv.client ? srv.client() : null;
let api = c;
const login = async () => {
  if (c) { const lg = await c.login("admin", helpers.ADMIN_PASSWORD); if (lg.status !== 200) throw new Error(`login ${lg.status}`); }
  else api = await helpers.loginAdmin(srv);
};
const step = async iso => { at(iso); await login(); };
await login();
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`); return r.data.data; };
const ADLAR = {
  haziran: "Kapali Kart Haziran", acik: "Acik Kart", kGunu: "Kapali Kart K Gunu", kSonrasi: "Kapali Kart K Sonrasi", carisiz: "Kapali Kart Carisiz Olacak",
  gece: "Kapali Kart Gece Yarisi", geceOnce: "Kapali Kart Gece Once", duzen: "Kapali Kart Sonra Duzenlendi", yeniden: "Kart Kapandi Yeniden Acildi",
  yenidenSonra: "Kart Kapandi K Sonrasi Yeniden Acildi", tam: "Kart Tam Odendi Kapali",
};
const cards = {};
for (const [key, name] of Object.entries(ADLAR)) {
  let r = await api.post("/api/workspace/plans", { name, total: 1000, count: 2, firstDue: "2026-06-15", registeredOn: "2026-05-01", mode: "auto" });
  if (r.status !== 200) {
    const acc = await must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type: "customer" }));
    r = await api.post("/api/workspace/plans", { name, total: 1000, count: 2, firstDue: "2026-06-15", registeredOn: "2026-05-01", accountId: acc.id, mode: "auto" });
  }
  if (r.status !== 200) throw new Error(`kart ${name}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  cards[key] = r.data.data;
}
await step("2026-06-20T10:00:00+03:00");
for (const [key, card] of Object.entries(cards)) await must("tahsilat", api.post(`/api/workspace/plans/${card.id}/entries`, { kind: "in", amount: key === "tam" ? 1000 : 300, date: "2026-06-20" }));
const put = async (key, iso, body) => {
  await step(iso);
  const cur = (await api.get(`/api/workspace/plans/${cards[key].id}`)).data?.data;
  const full = cur && cur.name ? { name: cur.name, total: cur.total, accountId: cur.accountId, registeredOn: cur.registeredOn, note: cur.note || "", phone: cur.phone || "", status: cur.status, ...body } : body;
  let r = await api.put(`/api/workspace/plans/${cards[key].id}`, body);
  if (r.status !== 200) r = await api.put(`/api/workspace/plans/${cards[key].id}`, full);
  if (r.status !== 200) throw new Error(`put ${key}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data.data;
};
const log = [];
for (const [key, iso, body] of [
  ["haziran", "2026-06-25T12:00:00+03:00", { status: "closed" }],
  ["carisiz", "2026-06-25T12:00:00+03:00", { status: "closed" }],
  ["duzen", "2026-06-25T12:00:00+03:00", { status: "closed" }],
  ["yeniden", "2026-06-25T12:00:00+03:00", { status: "closed" }],
  ["yenidenSonra", "2026-06-25T12:00:00+03:00", { status: "closed" }],
  ["tam", "2026-06-25T12:00:00+03:00", { status: "closed" }],
  ["yeniden", "2026-07-10T12:00:00+03:00", { status: "active" }],
  ["kGunu", "2026-12-31T12:00:00+03:00", { status: "closed" }],
  ["geceOnce", "2026-12-31T23:30:00+03:00", { status: "closed" }],
  ["gece", "2027-01-01T01:00:00+03:00", { status: "closed" }],
  ["duzen", "2027-01-02T12:00:00+03:00", { note: "sonradan not" }],
  ["kSonrasi", "2027-01-03T12:00:00+03:00", { status: "closed" }],
  ["yenidenSonra", "2027-01-04T12:00:00+03:00", { status: "active" }],
]) {
  try { await put(key, iso, body); log.push([key, iso, "ok"]); } catch (e) { log.push([key, iso, String(e.message).slice(0, 200)]); }
}
const cols = srv.app.store.all("PRAGMA table_info(plans)").map(r => r.name);
const pick = ["id", "name", "status", "account_id", "registered_on", "created_at", "updated_at", ...(cols.includes("closed_at") ? ["closed_at"] : []), ...(cols.includes("close_rule") ? ["close_rule"] : []), "note"];
const rows = srv.app.store.all(`SELECT ${pick.join(", ")} FROM plans ORDER BY name`);
const version = srv.app.store.get("SELECT value FROM settings WHERE key = 'license.initialized'")?.value;
const out = { kod: version, kartlar: Object.fromEntries(Object.entries(cards).map(([k, v]) => [k, { id: v.id, accountId: v.accountId, ad: ADLAR[k] }])), satirlar: rows, log };
await (srv.app.close ? srv.app.close() : srv.close());
writeFileSync(path.join(OUT, "kartlar.json"), `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify(log));
console.log(JSON.stringify(rows.map(r => [r.name, r.status, r.updated_at, r.closed_at, r.close_rule, r.note])));
