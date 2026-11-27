// S-KD-3 ölçümü: Excel'den yüklenen kart (Kayıt Tarihi 20.12.2026, yükleme 03.01.2027) — defter maddesi hangi tarihle? argv[2] = kod kökü.
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.argv[2];
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const server = await startTestServer({ now: { time: "2027-01-03T10:00:00+03:00", fixed: true } });
const client = await loginAdmin(server);
const r = await client.post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"], ["Kart Müşterisi", "9000", "3", "20.01.2027", "0", "20.12.2026"]], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" }, fileName: "kart.xlsx", linkRecords: false });
console.log("import", r.status, JSON.stringify(r.data).slice(0, 300));
const store = server.app.store;
console.log("plans", JSON.stringify(store.all("SELECT id, account_id, total, registered_on, created_at, import_id FROM plans")));
console.log("plan_imports", JSON.stringify(store.all("SELECT id, created_at FROM plan_imports")));
const entries = server.app.ledger.build().filter(e => e.id.startsWith("plan"));
console.log("defter", JSON.stringify(entries.map(e => ({ id: e.id, date: e.date, lines: e.lines.map(l => `${l.debit ? "B" : "A"} ${l.account} ${(l.debit || l.credit) / 100}`) }))));
const acc = store.get("SELECT id FROM accounts LIMIT 1");
console.log("account_entries", JSON.stringify(store.all("SELECT kind, amount, date, source FROM account_entries")));
const ex = await client.get(`/api/workspace/accounts/${acc.id}/entries`);
console.log("cari hareket", ex.status, JSON.stringify(ex.data).slice(0, 700));
const p = await client.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: "2026-12-31" });
console.log("preview", p.status, JSON.stringify(p.data).slice(0, 300));
if (p.status === 200) {
  for (let i = 0; i < 400; i++) {
    const j = await client.get(`/api/admin/devir/preview/${p.data.data.id}`);
    if (j.data.data.state !== "running") {
      const res = j.data.data.result;
      if (!res) {
        console.log("job", JSON.stringify(j.data.data));
        break;
      }
      console.log("plan cariler", JSON.stringify(res.plan.newYear.cariler.map(x => ({ ad: x.ad, k: x.kBakiyeMinor, satir: x.satirlar.map(s => [s.tur, s.tutarMinor]) }))));
      console.log("plan kartlar", JSON.stringify(res.plan.newYear.kartlar.map(x => ({ toplam: x.toplamMinor, kalan: x.kalanMinor, durum: x.durum }))));
      console.log("sorunlar", JSON.stringify(res.plan.sorunlar), "durdurur", JSON.stringify(res.onDenetim.durdurur.map(x => x.kod)));
      console.log("120/519 kapanış", JSON.stringify(res.plan.archive.kapanisBakiyeleri.filter(x => x.hesap === "120" || x.hesap === "519")));
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
await server.close();
