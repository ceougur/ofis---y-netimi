// dar kontrol D3 tur 6 — v2.0.12 GERÇEK koduyla (kendi API'si) veri üretir: fikstürün 5 kartı (yeniden üretim / karşılaştırma) + gün sınırı + sonradan düzenleme + yeniden açma.
// ROOT=<v2.0.12> OUT=<boş klasör> SAAT=<yeni depo test/fixtures/surec-saati.mjs> HUKUK_LICENSE_URL=http://127.0.0.1:9 node uret2012.mjs
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
const c = srv.client();
const login = async () => { const lg = await c.login("admin", helpers.ADMIN_PASSWORD); if (lg.status !== 200) throw new Error(`login ${lg.status}`); };
const step = async iso => { at(iso); await login(); };
await login();
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data.data; };
const ADLAR = {
  haziran: "Kapali Kart Haziran", acik: "Acik Kart", kGunu: "Kapali Kart K Gunu", kSonrasi: "Kapali Kart K Sonrasi", carisiz: "Kapali Kart Carisiz Olacak",
  gece: "Kapali Kart Gece Yarisi", // 01.01.2027 01:00 İstanbul = 31.12.2026 22:00 UTC
  geceOnce: "Kapali Kart Gece Once", // 31.12.2026 23:30 İstanbul = 20:30 UTC (iki tanım da K)
  duzen: "Kapali Kart Sonra Duzenlendi", // 25.06 kapandı, 02.01.2027 notu değişti (v2.0.12'de)
  yeniden: "Kart Kapandi Yeniden Acildi", // 25.06 kapandı, 10.07 yeniden açıldı
  tam: "Kart Tam Odendi Kapali", // tamamı ödendi, 25.06 kapandı
};
const cards = {};
for (const [key, name] of Object.entries(ADLAR)) cards[key] = await must(`kart ${name}`, c.post("/api/workspace/plans", { name, total: 1000, count: 2, firstDue: "2026-06-15", registeredOn: "2026-05-01" }));
await step("2026-06-20T10:00:00+03:00");
for (const [key, card] of Object.entries(cards)) await must("tahsilat", c.post(`/api/workspace/plans/${card.id}/entries`, { kind: "in", amount: key === "tam" ? 1000 : 300, date: "2026-06-20" }));
const put = async (key, iso, body) => { await step(iso); return must(`put ${key}`, c.put(`/api/workspace/plans/${cards[key].id}`, body)); };
await put("haziran", "2026-06-25T12:00:00+03:00", { status: "closed" });
await put("carisiz", "2026-06-25T12:00:00+03:00", { status: "closed" });
await put("duzen", "2026-06-25T12:00:00+03:00", { status: "closed" });
await put("yeniden", "2026-06-25T12:00:00+03:00", { status: "closed" });
await put("tam", "2026-06-25T12:00:00+03:00", { status: "closed" });
await put("yeniden", "2026-07-10T12:00:00+03:00", { status: "active" });
await put("kGunu", "2026-12-31T12:00:00+03:00", { status: "closed" });
await put("geceOnce", "2026-12-31T23:30:00+03:00", { status: "closed" });
await put("gece", "2027-01-01T01:00:00+03:00", { status: "closed" });
await put("duzen", "2027-01-02T12:00:00+03:00", { note: "sonradan not" });
await put("kSonrasi", "2027-01-03T12:00:00+03:00", { status: "closed" });
const rows = srv.app.store.all("SELECT id, name, status, total, note, account_id AS accountId, registered_on AS registeredOn, created_at AS createdAt, updated_at AS updatedAt FROM plans ORDER BY name");
const out = { kod: "v2.0.12", kartlar: Object.fromEntries(Object.entries(cards).map(([k, v]) => [k, { id: v.id, accountId: v.accountId, ad: ADLAR[k] }])), satirlar: rows };
await srv.app.close();
writeFileSync(path.join(OUT, "v2012.json"), `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify(rows.map(r => [r.name, r.status, r.updatedAt, r.note])));
