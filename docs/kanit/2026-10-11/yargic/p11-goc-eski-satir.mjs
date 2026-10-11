// Yargıç sondası 11: GERÇEK 2.0.26 verisi (test/fixtures/surum-2.0.26-zincir, o sürümün koduyla üretildi) güncel koda göçer; kullanıcı ilk banka
// hesabını bugünkü açılışla tanımlar; sonra eski (hesapsız) havale satırlarının tutarını düzeltmeyi dener.
import { readFixture, unpackFixture } from "../../../../test/guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion } from "../../../../test/guvenilirlik/surumler.mjs";
const log = (...a) => console.log(...a);
const name = "surum-2.0.26-zincir";
const before = readFixture(name).oncesi;
const fixture = unpackFixture(name);
const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${before.today}T12:00:00+03:00` });
try {
  const api = await server.login();
  log("bugün", before.today);
  const store = server.app.store;
  const rows = store.all("SELECT e.id, e.account_id AS accountId, e.kind, e.amount, e.date, e.method, e.source FROM account_entries e WHERE e.method = 'bank' AND e.kind IN ('in','out') AND e.fin_ref = '' AND (e.source = '' OR e.source IS NULL) AND e.date < ? ORDER BY e.date DESC LIMIT 3", before.today);
  log("001'de hesapsız eski havale cari satırları (ilk 3)", JSON.stringify(rows));
  const unwrap = r => (r.data?.ok ? r.data.data : r.data);
  const acc = await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: before.today, amount: "10.000", confirmed: true } });
  log("ilk banka hesabı (açılış bugün)", acc.status);
  for (const row of rows) {
    const res = await api.put(`/api/workspace/accounts/${row.accountId}/entries/${row.id}`, { kind: row.kind, method: "bank", date: row.date, amount: String(row.amount + 1).replace(".", ",") });
    log(`eski havale ${row.date} ${row.amount} → +1`, res.status, unwrap(res)?.code || res.data?.code || "", String(res.data?.error || "").slice(0, 160));
  }
  const add = await api.post(`/api/workspace/accounts/${rows[0].accountId}/entries`, { kind: "in", method: "bank", date: rows[0].date, amount: "50" });
  log(`unutulmuş eski havaleyi ${rows[0].date} tarihiyle girmek`, add.status, add.data?.code || "");
} finally {
  await server.close();
  fixture.cleanup();
}
