// Ç7b aday düzeltme turu — kabul E (DEĞİŞMEZLER): aynı istek dizisi eski ve yeni kodda; kapanışın cari / defter etkisi veri tabanından ve API'den okunur, kimlikler sıraya göre
// adlandırılarak karşılaştırılır. Kullanım: node degismez.mjs <kod kökü> <own|shown> <çıktı.json>
// Dizi: S1 eski istemci (closeRemaining yok — iki kodda AYNI istek); S2 cari kartından 500 + Kartı Kapat closeRemaining = kodun kabul ettiği sayı (own: taban, shown: yeni — yalnız bu
// değer farklı); S3 Taksit Tahsilatı 1.000 + Kartı Kapat closeRemaining = pencere (iki kodda aynı sayı); S2'nin kartı Yeniden Aç → yine Kartı Kapat; Mevcut Borç kartı + cari 500.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, mode, out] = process.argv.slice(2);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00" });
const client = await loginAdmin(server);
const W = "/api/workspace";
const data = r => (r.data && r.data.ok === true ? r.data.data : r.data);
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return data(r);
};
const log = [];
const acc = async name => (await must("cari", client.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-09-01" }))).id;
const card = async (accountId, name, extra = {}) => {
  const made = await must("kart", client.post(`${W}/plans`, { accountId, name, total: "3000", registeredOn: "2026-09-01", mode: "auto", count: 3, firstDue: "2026-09-08", ...extra }));
  return made.id || made.plan?.id;
};
const close = async (id, label, withValue = true) => {
  const t = (await must("kart", client.get(`${W}/plans/${id}`))).totals;
  const value = mode === "own" ? Number(t.ownRemaining ?? t.remaining) : Number(t.remaining);
  const r = await client.put(`${W}/plans/${id}`, withValue ? { status: "closed", closeRemaining: value } : { status: "closed" });
  log.push({ label, status: r.status, shown: t.remaining, own: t.ownRemaining });
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
};
const A = await acc("Değişmez A");
const pA = await card(A, "Kart A");
await must("cari tahsilat A", client.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: "500", date: "2026-09-10", method: "cash" }));
await close(pA, "S1 eski istemci", false);
const B = await acc("Değişmez B");
const pB = await card(B, "Kart B");
await must("cari tahsilat B", client.post(`${W}/accounts/${B}/entries`, { kind: "in", amount: "500", date: "2026-09-10", method: "cash" }));
await close(pB, "S2 closeRemaining (kodun kabul ettiği)");
const C = await acc("Değişmez C");
const pC = await card(C, "Kart C");
await must("kart tahsilatı C", client.post(`${W}/plans/${pC}/entries`, { kind: "in", amount: "1000", date: "2026-09-10", method: "cash" }));
await close(pC, "S3 kart tahsilatı");
await must("Yeniden Aç B", client.put(`${W}/plans/${pB}`, { status: "active" }));
await close(pB, "S2 yeniden kapanış");
const D = await acc("Değişmez D");
await must("Borç Yaz D", client.post(`${W}/accounts/${D}/entries`, { kind: "debt", amount: "3000", date: "2026-09-01", note: "Önceki borç" }));
const pD = await card(D, "Kart D", { coversBalance: true });
await must("cari tahsilat D", client.post(`${W}/accounts/${D}/entries`, { kind: "in", amount: "500", date: "2026-09-10", method: "cash" }));
await close(pD, "S4 Mevcut Borç");
const store = server.app.store;
const ids = new Map();
const nameOf = id => {
  if (!id) return id;
  if (!ids.has(id)) ids.set(id, `#${ids.size + 1}`);
  return ids.get(id);
};
const norm = x => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === "string" && /^[a-z]+-[0-9a-f]{8}-/.test(v) ? nameOf(v) : ["createdAt", "updatedAt", "deletedAt", "at", "ms"].includes(k) ? undefined : v)));
const result = {
  log,
  plans: norm(store.all("SELECT id, account_id, name, total, status, closed_at, close_rule FROM plans ORDER BY name")),
  planEntries: norm(store.all("SELECT plan_id, kind, amount, date, method FROM plan_entries ORDER BY rowid")),
  accountEntries: norm(store.all("SELECT account_id, kind, amount, date, note FROM account_entries ORDER BY rowid")),
  accounts: {},
  trial: (await must("mizan", client.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]),
  integrity: (await must("Mutabakat Testi", client.get(`${W}/ledger/integrity`))).ok,
  defter: await must("Defter Mutabakatı", client.get(`${W}/report-center/defter-mutabakati`)).then(d => norm(d), e => `HATA ${e.message}`),
};
for (const [n, id] of [["A", A], ["B", B], ["C", C], ["D", D]]) {
  const d = await must("cari", client.get(`${W}/accounts/${id}`));
  result.accounts[n] = { balance: d.totals.balance, overdue: d.totals.overdue, lines: norm((d.ledger || []).map(l => ({ date: l.date, kind: l.kind, debit: l.debit, credit: l.credit, balance: l.balance, label: l.label || l.text || "" }))) };
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`yazıldı ${out} · kayıt ${JSON.stringify(log)} · Mutabakat ${result.integrity}`);
await server.close();
