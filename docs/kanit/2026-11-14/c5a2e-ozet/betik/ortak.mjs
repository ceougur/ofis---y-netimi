// dar kontrol c5a2 — ortak yardımcılar (kod değiştirmez)
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
const ROOT = process.env.KOD || "/home/user/ofis---y-netimi/.claude/worktrees/agent-a4e9171764c235c13";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
export const S = await import(path.join(ROOT, "test/guvenilirlik/surumler.mjs"));
export const F = await import(path.join(ROOT, "test/guvenilirlik/fikstur.mjs"));
export const NB = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3/dk";
export function dirs(tag) {
  const root = mkdtempSync(path.join(NB, `veri-${tag}-`));
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
export const at = day => ({ time: `${day}T12:00:00+03:00`, fixed: true });
export async function cur(d, day, extra = {}) {
  const server = await S.bootVersion(S.CURRENT, { dataDir: d.dataDir, backupDir: d.backupDir, now: at(day), integrityScan: false, ...extra });
  await server.app.ledger.snapshots.runPending();
  const api = await server.login();
  return { server, app: server.app, api };
}
export const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data;
};
let n = 0;
export const rid = () => `dkc5a2-${process.pid}-${String(++n).padStart(8, "0")}`;
export const lt = lines => (lines || []).map(l => `${l.debit ? "B" : "A"} ${l.sub || l.account} ${(l.debit || l.credit) / 100}`).sort().join(" | ");
export async function integ(api) {
  const r = await api.get("/api/workspace/ledger/integrity");
  const item = (r.data.checks || []).find(i => i.code === "ledger:rule-diff") || null;
  return { status: r.status, ok: r.data.ok, failures: (r.data.failures || []).map(i => i.code), item, checks: r.data.checks || [] };
}
export const short = item => item && { ok: item.ok, count: item.count, name: item.name, corrected: item.corrected, correction: item.correction, hint: (item.hint || "").slice(0, 220) };
export function sums(app, from, to, accounts) {
  const book = app.ledger.book({ from, to });
  const out = {};
  for (const acc of accounts) out[acc] = book.reduce((s, e) => s + e.lines.filter(l => l.account === acc).reduce((t, l) => t + l.debit - l.credit, 0), 0) / 100;
  return out;
}
