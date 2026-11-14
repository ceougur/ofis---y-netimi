// Ç5-A tur 2d İş 3 sondası (karma): v2.4.9 GERÇEK koduyla kilitli veri (cari açılışı → gerçek kural farkı 500 ↔ 519; şüpheli cari + kilitli tahsilat + açık dönem faturası),
// güncel kodla açılış; ön izleme → kilitli tahsilatın fatura bağı AYRI bağlantıyla yazılır → ön izleme + kayıt. ROOT=<kod> node prob-s164b.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const { CURRENT, bootVersion } = await import(pathToFileURL(path.join(ROOT, "test/guvenilirlik/surumler.mjs")).href);
const URL = "/api/admin/ledger/rule-diff-correction";
const LOCK = "2026-10-10";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "c5a2d-s164b-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const out = {};
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data; };
const lineText = lines => lines.map(line => `${line.debit ? "B" : "A"} ${line.sub || line.account} ${(line.debit || line.credit) / 100}`).sort();
try {
  const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
  try {
    const api = await old.login();
    const K = await must("cari", api.post("/api/workspace/accounts", { name: "S164 İkinci Örnek", type: "customer", registeredOn: "2026-08-01", openingBalance: "800" }));
    await must("borç", api.post(`/api/workspace/accounts/${K.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
    await must("şüpheli", api.post(`/api/workspace/accounts/${K.id}/doubtful`, { amount: 600, date: "2026-09-20", reason: "lawsuit", note: "S164" }));
    out.fatura = (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: K.id, issueDate: "2026-10-15", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }))).id;
    await must("tahsilat", api.post(`/api/workspace/accounts/${K.id}/entries`, { kind: "in", amount: "100", date: "2026-10-09", method: "cash", cashForce: true, similarOk: true }));
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    out.K = K.id;
    out.tahsilat = old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", K.id).id;
  } finally { await old.close(); }
  const cur = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
  try {
    await cur.app.ledger.snapshots.runPending();
    const api = await cur.login();
    const v0 = (await api.get(URL)).data;
    out.once = { code: v0.code, disabled: v0.disabled, lines: lineText(v0.lines), sources: v0.sources.map(s => ({ id: s.id, excluded: s.excluded, deltas: s.deltas.map(d => `${d.account} ${d.minor}`) })), excluded: v0.excluded.map(e => `${e.account} ${e.minor} ${e.subledger}`) };
    if (process.argv[2] === "once-kaydet") { const p0 = await api.post(URL, { requestId: `kfd-${process.pid}-00000000`, digest: v0.digest, confirm: true }); out.onceKaydet = { status: p0.status, data: JSON.stringify(p0.data).slice(0, 300) }; }
    const other = new DatabaseSync(cur.app.store.get("PRAGMA database_list").file);
    try { other.exec("PRAGMA busy_timeout = 5000"); out.yazim = other.prepare("UPDATE account_entries SET invoice_id = ? WHERE id = ?").run(out.fatura, out.tahsilat).changes; } finally { other.close(); }
    const v1 = (await api.get(URL)).data;
    out.sonra = { code: v1.code, disabled: v1.disabled, lines: lineText(v1.lines), sources: v1.sources.map(s => ({ id: s.id, excluded: s.excluded, deltas: s.deltas.map(d => `${d.account} ${d.party === out.K ? "K" : d.party} ${d.minor}`) })), excluded: v1.excluded.map(e => `${e.account} ${e.party === out.K ? "K" : e.party} ${e.minor} ${e.subledger}`) };
    const post = await api.post(URL, { requestId: `kfd-${process.pid}-00000001`, digest: v1.digest, confirm: true });
    out.kaydet = { status: post.status, data: JSON.stringify(post.data).slice(0, 500) };
    out.fis = cur.app.store.all("SELECT l.account, l.sub, l.debit_minor AS b, l.credit_minor AS a FROM ledger_vouchers v JOIN ledger_voucher_lines l ON l.voucher_id = v.id ORDER BY l.seq");
    const integ = (await api.get("/api/workspace/ledger/integrity")).data;
    out.mutabakat = (integ.checks || []).find(c => c.code === "ledger:rule-diff") || null;
  } finally { await cur.close(); }
} catch (e) { out.HATA = String(e.stack || e).slice(0, 800); }
rmSync(root, { recursive: true, force: true });
console.log(JSON.stringify(out, null, 1));
