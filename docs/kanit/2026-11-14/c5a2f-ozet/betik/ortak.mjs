// dar kontrol c5a2e — ortak yardımcılar (kod değiştirmez). KOD = sınanan kod kökü (yeni: worktree; eski: /dev/shm/dkc5a2e-q/eski)
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
export const WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a46c87e85c8b28c2f";
export const ROOT = process.env.KOD || WT;
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
export const SV = await import(path.join(WT, "test/guvenilirlik/surumler.mjs")); // eski etiketler (git)
export const S = await import(path.join(ROOT, "test/guvenilirlik/surumler.mjs")); // CURRENT = KOD
export const NB = "/dev/shm/c5a2f-k1/veri";
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
export async function old249(d, day, fn) {
  const old = await SV.bootVersion("v2.4.9", { dataDir: d.dataDir, backupDir: d.backupDir, now: at(day) });
  try {
    const o = await old.login();
    await o.post("/api/workspace/bank/setup/dismiss", {});
    return await fn(o, old.app);
  } finally {
    await old.close();
  }
}
export const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data;
};
let n = 0;
export const rid = () => `c5a2f-${process.pid}-${String(++n).padStart(8, "0")}`;
export const lt = lines => (lines || []).map(l => `${l.debit ? "B" : "A"} ${l.sub || l.account} ${(l.debit || l.credit) / 100}`).sort().join(" | ") || "(satır yok)";
export async function integ(api) {
  const r = await api.get("/api/workspace/ledger/integrity");
  const item = (r.data.checks || []).find(i => i.code === "ledger:rule-diff") || null;
  return { status: r.status, ok: r.data.ok, failures: (r.data.failures || []).map(i => i.code), item, checks: r.data.checks || [] };
}
export const short = item => item && { ok: item.ok, count: item.count, name: item.name, corrected: item.corrected, correction: item.correction, hint: (item.hint || "").slice(0, 260) };
export function sums(app, from, to, accounts) {
  const book = app.ledger.book({ from, to });
  const out = {};
  for (const acc of accounts) out[acc] = book.reduce((s, e) => s + e.lines.filter(l => l.account === acc).reduce((t, l) => t + l.debit - l.credit, 0), 0) / 100;
  return out;
}
export const URL = "/api/admin/ledger/rule-diff-correction";
export const OR = "/api/workspace/opening-review";
export const view = async api => (await api.get(URL)).data;
export const vshort = v => `${v.date} disabled=${v.disabled} ${v.code || ""} | ${lt(v.lines)} | toplam ${(v.totalMinor || 0) / 100}`;
export const lockTo = async (c, until) => {
  await must(`kilit ${until || "yok"}`, c.api.put("/api/admin/period-lock", { lockedUntil: until }));
  await c.app.ledger.snapshots.runPending();
};
/** Yıl × hesap bakiyesi (book({}) maddeleri TARİHLE süzülür — book({ from }) açık dönemi süzmüyor). */
export function yil(app, year, accounts) {
  const all = app.ledger.book({});
  const out = {};
  for (const acc of accounts) out[acc] = all.filter(e => e.date.startsWith(String(year))).reduce((s, e) => s + e.lines.filter(l => l.account === acc).reduce((t, l) => t + l.debit - l.credit, 0), 0) / 100;
  return out;
}
