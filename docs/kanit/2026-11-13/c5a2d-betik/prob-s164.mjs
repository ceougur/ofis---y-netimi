// Ç5-A tur 2d İş 3 sondası — S164 = C ikinci örneği: kilitli tahsilatın fatura bağı ayrı bağlantıyla değişince Kural Farkı Düzeltme ön izlemesi ne gösteriyor?
// ROOT=<kod> node prob-s164.mjs [bagla|coz]
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const MODE = process.argv[2] || "bagla";
const { boot, must } = await import(pathToFileURL(path.join(ROOT, "test/banka-210-ortak.mjs")).href);
const URL = "/api/admin/ledger/rule-diff-correction";
const LOCK = "2026-10-10";
const ctx = await boot({ now: { time: "2026-10-20T12:00:00+03:00", fixed: true } });
const { app, api } = ctx;
const out = { mod: MODE };
const lockedLines = () => {
  const m = new Map();
  for (const e of app.ledger.build()) if (String(e.date) <= LOCK) for (const l of e.lines || []) { const k = `${e.date}|${l.account}|${l.party ? "cari" : ""}|B${l.debit || 0}|A${l.credit || 0}`; m.set(k, (m.get(k) || 0) + 1); }
  return m;
};
const diff = (a, b) => { const d = []; for (const k of new Set([...a.keys(), ...b.keys()])) { const n = (b.get(k) || 0) - (a.get(k) || 0); if (n) d.push(`${n > 0 ? "+" : "-"}${k}`); } return d.sort(); };
const view = async () => { const r = await api.get(URL); return { status: r.status, disabled: r.data.disabled, code: r.data.code, reason: r.data.reason, lines: r.data.lines, sources: r.data.sources, excluded: r.data.excluded, digest: r.data.digest, keys: Object.keys(r.data || {}) }; };
try {
  const party = await must("cari", api.post("/api/workspace/accounts", { name: "S164 İkinci", type: "customer", registeredOn: "2026-08-01" }));
  await must("borç", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
  await must("şüpheli", api.post(`/api/workspace/accounts/${party.id}/doubtful`, { amount: 600, date: "2026-09-20", reason: "lawsuit", note: "S164" }));
  const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: "2026-10-15", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }));
  const body = { kind: "in", amount: "100", date: "2026-10-09", method: "cash", cashForce: true, similarOk: true, ...(MODE === "coz" ? { invoiceId: inv.id } : {}) };
  await must("tahsilat", api.post(`/api/workspace/accounts/${party.id}/entries`, body));
  const entry = app.store.get("SELECT id, invoice_id AS inv FROM account_entries WHERE account_id = ? AND kind = 'in'", party.id);
  out.tahsilatBagi = entry.inv;
  out.kilit = (await api.put("/api/admin/period-lock", { lockedUntil: LOCK })).status;
  await app.ledger.snapshots.runPending();
  out.dondurma = app.ledger.snapshots.state();
  out.once = await view();
  const l0 = lockedLines();
  const other = new DatabaseSync(app.store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    out.yazim = other.prepare("UPDATE account_entries SET invoice_id = ? WHERE id = ?").run(MODE === "coz" ? "" : inv.id, entry.id).changes;
  } finally { other.close(); }
  out.kilitliDefterFarki = diff(l0, lockedLines());
  out.sonra = await view();
  out.entryId = entry.id; out.party = party.id;
  const integ = (await api.get("/api/workspace/ledger/integrity")).data;
  out.mutabakat = { ok: integ.ok, failures: (integ.failures || []).map(f => f.code), kural: (integ.checks || []).find(c => c.code === "ledger:rule-diff") || null };
  out.tarama = app.integrity.scan().findings.map(f => f.code);
  if (!out.sonra.disabled && out.sonra.digest) {
    const post = await api.post(URL, { requestId: "s164-prob-1", digest: out.sonra.digest, confirm: true });
    out.kaydet = { status: post.status, data: JSON.stringify(post.data).slice(0, 400) };
    out.fisler = app.store.all("SELECT v.id, v.type, l.account, l.sub, l.party, l.debit_minor AS b, l.credit_minor AS a FROM ledger_vouchers v JOIN ledger_voucher_lines l ON l.voucher_id = v.id ORDER BY l.seq");
  }
} catch (e) { out.HATA = String(e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 1));
await ctx.server.close();
