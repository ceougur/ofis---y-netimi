// Kopyalanan veri klasörünü hata ayıklama kopyasıyla açar, carinin kuyruk GİRDİSİNİ (buildObligations input) döker.
// Kullanım: ROOT=<kod (obligationInputFor kancalı)> DATA=<veri> HESAP=<cari kimliği> OUT=<dosya> node girdi.mjs
import { writeFileSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer } = await imp("test/helpers.mjs");
const { motorNow } = await imp("test/mutabakat/motor.mjs");
const { buildObligations } = await imp("server/lib/obligation-queue.mjs");
const copy = mkdtempSync(path.join(tmpdir(), "udfix-girdi-"));
cpSync(process.env.DATA, copy, { recursive: true });
const server = await startTestServer({ dataDir: copy, bankPickLegacy: true, now: motorNow() });
try {
  const ctx = server.app.context;
  const id = process.env.HESAP;
  const det = ctx.accounts.detail(id, { id: "dbg", role: "admin", permissions: [] }, { withRemaining: false });
  const input = ctx.invoices.obligationInputFor(id, det.ledger || []);
  const enc = (v, k) => {
    if (v instanceof Map) return { __map: [...v].map(([a, b]) => [a, enc(b)]) };
    if (v instanceof Set) return { __set: [...v].map(x => enc(x)) };
    if (typeof v === "function") return v.history ? { __lock: v.history } : { __fn: k };
    if (Array.isArray(v)) return v.map(x => enc(x));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([a, b]) => [a, enc(b, a)]));
    return v;
  };
  const lockDays = {};
  if (typeof input.lockAt === "function") for (const l of input.lines || []) lockDays[String(l.at || "")] = input.lockAt(l.at);
  writeFileSync(process.env.OUT, JSON.stringify({ input: enc(input), lockDays, balance: det.account?.balance ?? null }, null, 0));
  const r = buildObligations(input);
  const sig = r.items.reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0);
  const bal = Math.round((input.lines || []).reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0) * 100);
  console.log(`girdi: ${(input.lines || []).length} satır; anahtarlar ${Object.keys(input).join(",")}; Σ kalem ${sig} · Σ satır ${bal} · geçiş ${JSON.stringify(r.prepaidPasses)}`);
} finally {
  await server.close();
}
