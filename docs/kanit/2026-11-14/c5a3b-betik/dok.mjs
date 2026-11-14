// Ç5-A tur 3a — kabul A (BAYT BAYT EŞDEĞERLİK): bir kod kökünün DIŞA AÇIK yüzünden (invoices.obligationsFor / obligationsOf / allObligations / entryStates / allEntryStates /
// paymentStates / cardLedgerState / repairScreen) bütün şirketlerin bütün carilerinin kuyruk çıktısını JSON satırı olarak döker. Map / Set anahtar sırasıyla; overdue(gün) üç günde.
// Kullanım: node dok.mjs <kod kökü> <veri kopyası (data/, backups/)> <çıktı.jsonl> [şimdi=2026-10-08T12:00:00+03:00]
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, out, nowText = "2026-10-08T12:00:00+03:00"] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: nowText, fixed: true }, moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200 && (await client.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş");
const AUDITOR = { id: "dok", role: "admin", permissions: [] };
const day = nowText.slice(0, 10);
const shift = n => {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
};
// Kararlı serileştirme: Map → [anahtar, değer] anahtar sırasıyla; Set → sıralı dizi; overdue → üç günde değer; başka işlev → "[işlev]"; döngü → "[döngü]".
function plain(value, seen = new WeakSet(), key = "") {
  if (typeof value === "function") return key === "overdue" ? { d0: plain(value(day), seen), dm30: plain(value(shift(-30)), seen), dp30: plain(value(shift(30)), seen) } : "[işlev]";
  if (!value || typeof value !== "object") return value === undefined ? "[tanımsız]" : value;
  if (seen.has(value)) return "[döngü]";
  seen.add(value);
  let result;
  if (value instanceof Map) result = { "[Map]": [...value].map(([k, v]) => [plain(k, seen), plain(v, seen)]).sort((a, b) => (JSON.stringify(a[0]) < JSON.stringify(b[0]) ? -1 : 1)) };
  else if (value instanceof Set) result = { "[Set]": [...value].map(v => JSON.stringify(plain(v, seen))).sort() };
  else if (Array.isArray(value)) result = value.map(v => plain(v, seen));
  else {
    result = {};
    for (const k of Object.keys(value)) result[k] = plain(value[k], seen, k);
  }
  seen.delete(value);
  return result;
}
const lines = [];
const summary = { cariler: 0, sirketler: [] };
const companies = app.companies.list();
for (const company of companies) {
  if (company.id !== app.companyId) await client.get(`/api/workspace/accounts?limit=1&hofCompany=${company.id}`);
  const target = company.id === app.companyId ? app : app.openCompany(company.id);
  if (!target) throw new Error(`şirket açılmadı: ${company.id}`);
  const ctx = target.context;
  const inv = ctx.invoices;
  const ids = ctx.store.all("SELECT id FROM accounts ORDER BY id").map(row => row.id);
  const ledgerOf = id => {
    try {
      return ctx.accounts.detail(id, AUDITOR, { withRemaining: false }).ledger;
    } catch {
      return null;
    }
  };
  // 1) tek cari önbellekli yol (bütün cariler önbelleğinden ÖNCE; ilk 40 cari) — iki okuma
  const before = new Map();
  for (const id of ids.slice(0, 40)) before.set(id, [plain(inv.obligationsOf(id, () => ledgerOf(id))), plain(inv.obligationsOf(id, () => ledgerOf(id)))]);
  // 2) bütün cariler
  const all = inv.allObligations();
  const allEntries = inv.allEntryStates();
  const invoices = ctx.store.all("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId FROM invoices ORDER BY id");
  const pay = inv.paymentStates(invoices);
  const repair = inv.repairScreen(invoices.map(row => row.id));
  const card = new Map(invoices.filter(row => row.planId).map(row => [row.id, inv.cardLedgerState(row)]));
  const allLines = ctx.accounts.allLedgers({}).lines;
  const planMap = ctx.plans.ledgerPlansByAccount();
  for (const id of ids) {
    const ledger = ledgerOf(id);
    const row = {
      sirket: company.id,
      cari: id,
      tumu: all ? plain(all.get(id) || null) : null,
      tek: ledger ? plain(inv.obligationsFor(id, ledger)) : null,
      onbellek: ledger ? plain(inv.obligationsOf(id, () => ledger)) : null,
      onbellekOnce: before.get(id) || null,
      kalan: ledger ? plain(inv.entryStates(id, ledger)) : null,
      defter: ledger ? plain(ledger) : null,
      satirlar: plain(allLines.get(id) || null),
      kartListesi: plain(ctx.plans.forAccount(id, AUDITOR)),
      kartHaritasi: plain(planMap.get(id) || null),
    };
    lines.push(JSON.stringify(row));
  }
  lines.push(JSON.stringify({ sirket: company.id, cari: "[toplu]", tumKalan: plain(allEntries), odeme: plain(pay), onarim: plain(repair), kart: plain(card) }));
  if (process.env.KENDI) {
    const { createStore, openDatabase } = await import(pathToFileURL(path.join(root, "server", "lib", "db.mjs")).href);
    const { resolveDbPath } = await import(pathToFileURL(path.join(root, "server", "lib", "db-path.mjs")).href);
    const { createObligationInput } = await import(pathToFileURL(path.join(root, "server", "lib", "obligation-input.mjs")).href);
    const { buildObligations } = await import(pathToFileURL(path.join(root, "server", "lib", "obligation-queue.mjs")).href);
    const file = company.id === app.companyId ? app.config.dbPath : resolveDbPath(app.companies.dirsOf(app.companies.get(company.id)).dataDir);
    const db = openDatabase(file, { readOnly: true });
    const input = createObligationInput({ store: createStore(db) });
    const own = input.ledgerLines();
    const inputs = input.batchInputs(day);
    const live = new Set(ctx.store.all("SELECT id FROM accounts WHERE deleted_at IS NULL").map(row => row.id));
    const k = { sirket: company.id, cari: 0, kumeAyni: JSON.stringify([...own.keys()].sort()) === JSON.stringify([...allLines.keys()].sort()) && JSON.stringify([...own.keys()].sort()) === JSON.stringify([...(all ? all.keys() : [])].sort()), satirFark: 0, tekFark: 0, topluFark: 0, ornek: [] };
    const t0 = Date.now();
    for (const id of ids) {
      if (!live.has(id)) continue;
      k.cari += 1;
      const ledger = ledgerOf(id);
      const bad = [];
      if (JSON.stringify(plain(own.get(id))) !== JSON.stringify(plain(allLines.get(id)))) { k.satirFark += 1; bad.push("satir"); }
      if (JSON.stringify(plain(buildObligations(input.accountInput(id, day, null)))) !== JSON.stringify(plain(inv.obligationsFor(id, ledger)))) { k.tekFark += 1; bad.push("tek"); }
      if (JSON.stringify(plain(buildObligations(inputs.get(id)))) !== JSON.stringify(plain(all.get(id)))) { k.topluFark += 1; bad.push("toplu"); }
      if (bad.length && k.ornek.length < 5) k.ornek.push([id, bad]);
    }
    k.sure = Date.now() - t0;
    db.close();
    writeFileSync(process.env.KENDI, `${JSON.stringify(k)}\n`, { flag: "a" });
  }
  summary.cariler += ids.length;
  summary.sirketler.push({ id: company.id, cari: ids.length, fatura: invoices.length, kartli: card.size });
}
writeFileSync(out, `${lines.join("\n")}\n`);
const hash = createHash("sha256").update(lines.join("\n")).digest("hex");
console.log(JSON.stringify({ ...summary, satir: lines.length, sha256: hash }));
await app.close();
