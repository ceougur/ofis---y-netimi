// Sonda (10.10.2026, İş 3 — bulgu, DÜZELTİLMEDİ): eski sürümden kalan İLERİ TARİHLİ hesapsız havale (2.0.13–2.0.16'da Kasa'ya ileri tarihle
// Havale/EFT yoluyla girilebiliyordu; bugünkü kod yazmaz, burada veri tabanına doğrudan yazılır) varken (a) "Bu Hesaba Ata" ve (b) Kurulum
// Sihirbazı (eski hareketleri aktar: tümü) ne yapar? Çalıştırma: node docs/kanit/2026-10-10/t4-nakit-akis/ileri-tarihli-eski-havale-sonda.mjs
import { randomUUID } from "node:crypto";
import { loginAdmin, startTestServer } from "../../../../test/helpers.mjs";

const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00" });
try {
  const admin = await loginAdmin(server);
  const unwrap = res => ({ status: res.status, code: res.data?.code || "", error: res.data?.error || "", data: res.data?.ok ? res.data.data : res.data });
  const account = unwrap(await admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));
  const past = randomUUID();
  const ahead = randomUUID();
  const insert = (id, date, amount) => server.app.db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES (?, 'out', ?, ?, 'Eski havale', 'bank', 'test', ?)").run(id, amount, date, new Date().toISOString());
  insert(past, "2026-10-05", 250); // geçmiş tarihli eski havale (açılıştan sonra): normalde aktarılır
  insert(ahead, "2026-10-18", 1000); // ileri tarihli eski havale
  const legacy = unwrap(await admin.get("/api/workspace/bank/legacy"));
  console.log("Hesabı Atanmamış satırlar:", legacy.data.rows.map(row => `${row.date} ${row.amountMinor / 100} atanabilir=${row.assignable}`).join(" | "));
  const one = unwrap(await admin.post("/api/workspace/bank/legacy/assign", { accountId: account.data.id, rows: [{ table: "cash_entries", id: ahead }] }));
  console.log("(a) Bu Hesaba Ata (ileri tarihli) →", one.status, one.code, one.error.slice(0, 160));
  const plan = unwrap(await admin.post(`/api/workspace/bank/setup?dryRun=1`, { accountId: account.data.id, carryClose: true, assign: "all" }));
  console.log("(b) Kurulum Sihirbazı ön izleme →", plan.status, plan.code, JSON.stringify(plan.data?.rows?.length ?? plan.data?.assign ?? "").slice(0, 80));
  const setup = unwrap(await admin.post("/api/workspace/bank/setup", { accountId: account.data.id, carryClose: true, assign: "all" }));
  console.log("(b) Kurulum Sihirbazı (tümü) →", setup.status, setup.code, setup.error.slice(0, 160));
  const after = unwrap(await admin.get("/api/workspace/bank/legacy"));
  console.log("sonra Hesabı Atanmamış satır sayısı:", after.data.rows.length, "(geçmiş tarihli 250 de aktarıldı mı:", !after.data.rows.some(row => row.id === past), ")");
  const flow = unwrap(await admin.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
  console.log("Nakit Akış: başlangıç", flow.data.cashToday, "kırılım", JSON.stringify(flow.data.start), "ileri tarihli satır akışta:", flow.data.rows.filter(row => row.date === "2026-10-18").map(row => `${row.direction} ${row.amount}`).join(", "), "dönem sonu", flow.data.closing);
} finally {
  await server.close();
}
