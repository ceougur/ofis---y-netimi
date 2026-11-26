// UD tur 2 — mutabakat tohum 8 'şüpheli aynı gün sırası' farkının en küçük örneği programın GERÇEK HTTP uçlarıyla.
// Aynı gün (26.09): eski şüpheli kayıt Şüpheliden Çıkar → yeni şüpheli kayıt (bakiyenin tamamı) → tahsilat. Kullanım: ROOT=<kök> node surucu8.mjs [--ertesi-gun]
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const server = await startTestServer({ now: "2026-11-23T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = await loginAdmin(server);
const unwrap = r => r.data?.data ?? r.data;
const api = async (method, url, body, etiket) => {
  const r = method === "GET" ? await c.get(url) : await c[method.toLowerCase()](url, body);
  if (etiket) console.log(`${etiket}: ${r.status}${r.status === 200 ? "" : " " + JSON.stringify(r.data).slice(0, 500)}`);
  return { status: r.status, data: unwrap(r) };
};
const gun = process.argv.includes("--ertesi-gun") ? "2026-09-27" : "2026-09-26";
try {
  const acc = (await api("POST", "/api/workspace/accounts", { name: "Supheli Musteri", type: "customer", registeredOn: "2026-07-01" }, "cari")).data;
  const id = acc?.id ?? acc?.account?.id;
  await api("POST", `/api/workspace/accounts/${id}/entries`, { kind: "debt", amount: "33847.62", date: "2026-09-01", note: "Borç" }, "Borç 33.847,62 (01.09)");
  const eski = (await api("POST", `/api/workspace/accounts/${id}/doubtful`, { amount: "924.56", date: "2026-09-20", reason: "other", note: "Eski" }, "Şüpheliye Al 924,56 (20.09)")).data;
  const eskiId = eski?.id ?? eski?.record?.id;
  await api("POST", `/api/workspace/accounts/${id}/doubtful/${eskiId}/release`, { date: "2026-09-26", note: "Çıkar" }, "Şüpheliden Çıkar (26.09)");
  await api("POST", `/api/workspace/accounts/${id}/doubtful`, { amount: "33847.62", date: "2026-09-26", reason: "lawsuit", note: "Yeni" }, "Şüpheliye Al 33.847,62 (26.09)");
  await api("POST", `/api/workspace/accounts/${id}/entries`, { kind: "in", amount: "23236.09", method: "cash", note: "Şüpheli tahsilat", date: gun, cashForce: true, similarOk: true }, `Tahsilat 23.236,09 (${gun})`);
  const list = (await api("GET", `/api/workspace/accounts/${id}/doubtful`)).data;
  for (const r of list?.records || []) console.log("  kayıt", r.note, r.date, "durum", r.statusLabel, "kalan", (r.remainingMinor ?? 0) / 100, "tahsil", (r.collectedMinor ?? 0) / 100);
} finally {
  await server.close?.();
}
process.exit(0);
