// Kabul D: v2.4.9 verisinin KOPYASINI verilen kodla açar (göç koşar), carilerin 120 / 128'ini (canlı türetme), kural farkı ön izlemesini (alt defter dışarıda + kaynağı),
// Mutabakat Testi bulgularını ve kural farkı öğesini okur; sonra açık dönemde bağlı tahsilat yazar. Kullanım: ROOT=<kod> DIR=<veri kopyası> GEN=<v249-uret.json> node v249-oku.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const DIR = process.env.DIR;
const gen = JSON.parse(readFileSync(process.env.GEN, "utf8"));
const helpers = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const TODAY = "2026-10-20";
const day = o => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await helpers.startTestServer({ dataDir: path.join(DIR, "data"), backupDir: path.join(DIR, "backups"), now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const client = await helpers.loginAdmin(server);
const api = { get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)) };
const app = server.app;
// Dondurmanın bitmesini ürünün durumundan bekle (açılışta bekleyen dondurma — tur 1d kalıbı yerine burada yalnız tek yoklama sınırıyla).
await app.context.ledger.snapshots.runPending();
const snap = app.context.ledger.snapshots.state();
const balances = () => {
  const b = {};
  for (const e of app.ledger.build()) for (const l of e.lines || []) if ((l.account === "120" || l.account === "128") && l.party) { b[l.party] ||= { 120: 0, 128: 0 }; b[l.party][l.account] += l.debit - l.credit; }
  const out = {};
  for (const [label, c] of Object.entries(gen.cariler)) out[label] = { b120: (b[c.id]?.[120] || 0) / 100, b128: (b[c.id]?.[128] || 0) / 100, v249: c.defter249 };
  return out;
};
const res = { kod: ROOT, dondurma: { coverage: snap.coverage, lock: snap.lock, pending: snap.pending }, canliOnce: balances() };
const scan = app.integrity.scan();
res.mutabakatBulgu = (scan.findings || []).map(f => `${f.code}${f.severity ? `(${f.severity})` : ""}`);
const checks = scan.checks || app.integrity.checks?.() || [];
const rd = (Array.isArray(checks) ? checks : []).find(c => c.code === "ledger:rule-diff");
res.kuralFarki = rd ? { ok: rd.ok, name: rd.name, count: rd.count, breakdown: rd.breakdown, correction: rd.correction || null } : "öğe yok";
res.scanKeys = Object.keys(scan);
const full = app.integrity.run ? null : null;
const pv = await api.get("/api/admin/ledger/rule-diff-correction");
res.onizlemeTam = pv.data;
const it = await api.get("/api/workspace/ledger/integrity");
res.integrityApi = { status: it.status, keys: it.data ? Object.keys(it.data) : [], kuralFarki: (it.data?.checks || []).filter(c => String(c.code).startsWith('ledger:rule')) };
res.onizleme = { status: pv.status, disabled: pv.data?.disabled, reason: pv.data?.reason, lines: pv.data?.lines, excluded: pv.data?.excluded, sources: (pv.data?.sources || pv.data?.excludedSources || []).slice?.(0, 20), keys: pv.data ? Object.keys(pv.data) : [] };
// Açık dönemde: "Kilitli F1 Bağlı Nakit" carisinde Fatura 1'e bağlı 100 nakit (−40).
const a = gen.cariler["Kilitli F1 Bağlı Nakit"];
const w = await api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "100", date: day(-40), method: "cash", cashForce: true, similarOk: true, invoiceId: a.f1 });
res.acikDonemYazim = `${w.status} ${w.status >= 400 ? String(w.data?.error?.message || w.data?.error || "").slice(0, 200) : ""}`;
res.canliSonra = balances()["Kilitli F1 Bağlı Nakit"];
res.mutabakatSonra = (app.integrity.scan().findings || []).map(f => `${f.code}${f.severity ? `(${f.severity})` : ""}`);
console.log(JSON.stringify(res, null, 1));
await server.close();
