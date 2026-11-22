// DK-C6H45 s-deger: S236 = A — yıl ortası kilit, kilit ilerletme, iki şirket, yedek → geri yükleme (001: yeniden açılışta), kilit geri çekme / yeniden kilit; toplanabilirlik, Aktif = Pasif.
// Kullanım: node s-deger.mjs <ROOT> <çıktı.json>
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [root, out] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { apiOf, must } = await imp("test/banka-210-ortak.mjs");
const { lockAndWait } = await imp("test/fixtures/donma-bekle.mjs");
const { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } = await imp("test/helpers.mjs");
const FS = "/api/workspace/financial-statements";
const tmp = mkdtempSync(path.join(tmpdir(), "dkc6h45-deger-"));
const opts = { dataDir: path.join(tmp, "data"), backupDir: path.join(tmp, "backups"), now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, maxCompanies: 2, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
let server = await startTestServer(opts);
let api = apiOf(await loginAdmin(server));
const R = { steps: {} };
const item153 = bs => bs.aktif.gruplar.flatMap(g => g.kalemler).flatMap(k => k.hesaplar).find(r => r.hesap === "153")?.tutarMinor ?? 0;
const D = gt => gt.items.find(i => i.kod === "D").tutarMinor;
const READ = {
  gt25: `${FS}/income-statement?from=2025-01-01&to=2025-12-31`, gtH1: `${FS}/income-statement?from=2026-01-01&to=2026-06-30`, gtQ3: `${FS}/income-statement?from=2026-07-01&to=2026-09-30`,
  gtQ4: `${FS}/income-statement?from=2026-10-01&to=2026-10-08`, gt26: `${FS}/income-statement?from=2026-01-01&to=2026-10-08`, gtH2: `${FS}/income-statement?from=2026-07-01&to=2026-10-08`,
  bs1231: `${FS}/balance-sheet?date=2025-12-31`, bs0630: `${FS}/balance-sheet?date=2026-06-30`, bs0701: `${FS}/balance-sheet?date=2026-07-01`, bs0930: `${FS}/balance-sheet?date=2026-09-30`,
  bsNow: `${FS}/balance-sheet?date=2026-10-08`,
};
const Q = { c1: "", c2: "" };
const withQ = (url, co) => (Q[co] ? `${url}${url.includes("?") ? "&" : "?"}${Q[co]}` : url);
const storeOf = co => (co === "c1" ? server.app.store : server.app.openCompany(Q.c2id).store);
const read = async (name, co = "c1") => {
  const S = {};
  for (const [k, url] of Object.entries(READ)) {
    const d = await must(k, api.get(withQ(url, co)));
    S[k] = k.startsWith("gt") ? { D: D(d), kar: d.subtotals.donemNetKari } : { s153: item153(d), fark: d.toplamlar.farkMinor, kar: d.hesaplanmis?.donemNetKari?.tutarMinor ?? null, gecmis: d.hesaplanmis?.gecmisYillar?.map(r => [r.yil, r.tutarMinor]) };
  }
  S.toplanir = { H1Q3Q4: S.gtH1.D + S.gtQ3.D + S.gtQ4.D, gt26: S.gt26.D, H2: S.gtQ3.D + S.gtQ4.D, gtH2: S.gtH2.D };
  const store = storeOf(co);
  S.runs = store.all("SELECT no, kind, state, from_date, through FROM ledger_snapshot_runs ORDER BY no").map(r => [r.no, r.kind, r.state, r.from_date, r.through]);
  S.cards = store.all("SELECT s.run, i.name, s.kind, s.unit_price FROM ledger_valuation_cards s JOIN stock_items i ON i.id = s.item_id ORDER BY s.run, i.name").map(r => [r.run, r.name, r.kind, r.unit_price]);
  S.kartlar = store.all("SELECT name, kind, unit_price FROM stock_items ORDER BY name").map(r => [r.name, r.kind, r.unit_price]);
  R.steps[`${co}:${name}`] = S;
};
const ids = { c1: {}, c2: {} };
const card = async (co, id, body) => {
  const cur = await must("kart", api.get(withQ(`/api/workspace/stock/${id}`, co)));
  return must("kart düzelt", api.put(withQ(`/api/workspace/stock/${id}`, co), { ...body, updatedAt: cur.item?.updatedAt ?? cur.updatedAt }));
};
const seed = async co => {
  const sup = (await must("tedarikçi", api.post(withQ("/api/workspace/accounts", co), { name: "Tedarikçi T", type: "supplier" }))).id;
  const cus = (await must("müşteri", api.post(withQ("/api/workspace/accounts", co), { name: "Müşteri M", type: "customer" }))).id;
  const K = await must("K", api.post(withQ("/api/workspace/stock", co), { name: "Ürün K", unit: "Adet", unitPrice: "50" }));
  const H = await must("H", api.post(withQ("/api/workspace/stock", co), { name: "Ürün H", unit: "Adet", unitPrice: "25" }));
  const P = await must("P", api.post(withQ("/api/workspace/stock", co), { name: "Ürün P", unit: "Adet", unitPrice: "30" }));
  const mv = (label, id, body) => must(label, api.post(withQ(`/api/workspace/stock/${id}/moves`, co), body));
  await mv("K giriş", K.id, { kind: "in", qty: "10", unitPrice: "0", pay: "none", date: "2025-03-01" });
  await mv("H alış", H.id, { kind: "in", qty: "4", unitPrice: "25", pay: "account", accountId: sup, date: "2025-04-01" });
  await mv("P giriş", P.id, { kind: "in", qty: "5", unitPrice: "0", pay: "none", date: "2026-03-01" });
  await mv("P giriş 2", P.id, { kind: "in", qty: "5", unitPrice: "0", pay: "none", date: "2026-08-01" });
  await mv("K satış", K.id, { kind: "out", qty: "2", unitPrice: "100", pay: "account", accountId: cus, date: "2026-05-01" });
  await mv("H alış 2", H.id, { kind: "in", qty: "2", unitPrice: "40", pay: "account", accountId: sup, date: "2026-07-15" });
  ids[co] = { K: K.id, H: H.id, P: P.id };
};
try {
  const second = await must("002", api.post("/api/companies", { name: "Değerleme İkinci", select: false }));
  Q.c2id = (second.company || second).id;
  Q.c2 = `hofCompany=${encodeURIComponent(Q.c2id)}`;
  await seed("c1");
  await seed("c2");
  await read("acik");
  await read("acik", "c2");
  await lockAndWait(api.client, "2026-06-30");
  await lockAndWait(api.client, "2025-12-31", { query: Q.c2 });
  await read("A_kilit0630");
  await read("A_kilit1231", "c2");
  await card("c1", ids.c1.P, { unitPrice: "90" });
  await card("c1", ids.c1.K, { unitPrice: "80" });
  await read("B_kart");
  await read("B_kart001Degisti", "c2");
  await lockAndWait(api.client, "2026-09-30");
  await read("C_kilit0930");
  const backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
  await card("c1", ids.c1.P, { unitPrice: "10" });
  await card("c1", ids.c1.H, { kind: "service" });
  await read("D_kart2");
  const restored = await must("geri yükle", api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
  R.restore = restored;
  await server.close();
  server = await startTestServer(opts);
  api = apiOf(await loginAdmin(server));
  R.staged = server.app.stagedRestore;
  await read("E_geriYukle");
  await read("E_geriYukle", "c2");
  await card("c1", ids.c1.P, { unitPrice: "10" });
  await lockAndWait(api.client, "2026-06-30");
  await read("F_kilitGeri0630");
  await lockAndWait(api.client, "2026-09-30");
  await read("G_yenidenKilit0930");
} catch (e) {
  R.error = String(e?.stack || e).slice(0, 1500);
} finally {
  await server.close();
  removeTestDir(tmp);
}
writeFileSync(out, JSON.stringify(R, null, 1));
console.log("yazıldı", out);
