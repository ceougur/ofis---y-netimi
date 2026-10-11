// m5 sondası (10.10.2026): hesaba atanmış ileri tarihli banka satırı hangi yolla oluşur? Her yol denenir; yanıt kodu + gövde + Gerçek Banka okunur.
// Komut: node docs/kanit/2026-10-10/kucuk-duzeltmeler-2/m5-gercek-banka-ileri-tarih-sonda.mjs
import { startTestServer, loginAdmin } from "../../../../test/helpers.mjs";

const server = await startTestServer({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
const api = await loginAdmin(server);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const show = (label, r) => console.log(`${label}: ${r.status} ${r.status === 200 ? "" : JSON.stringify(r.data).slice(0, 160)}`);
await api.post("/api/workspace/bank/setup/dismiss", {});
const acc = unwrap(await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
const party = unwrap(await api.post("/api/workspace/accounts", { name: "Ali", type: "customer", registeredOn: "2026-09-01" }));
const real = async () => unwrap(await api.get("/api/workspace/bank/summary")).realBank.minor / 100;
console.log("başlangıç Gerçek Banka", await real());
// 1. Doğrudan ileri tarih: cari havale tahsilatı, banka fişi, hesap açılışı, transfer
show("1a cari havale 2026-10-20", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "100", date: "2026-10-20", method: "bank", bankAccountId: acc.id }));
show("1b banka fişi 2026-10-20", await api.post("/api/workspace/bank/vouchers", { type: "fee", accountId: acc.id, amount: "10", date: "2026-10-20" }));
show("1c açılış 2026-10-20", await api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "İleri", kind: "demand", opening: { date: "2026-10-20", amount: "500", confirmed: true } }));
// 2. Bugün yaz, sil, saat ilerlemeden geri yükle (geri yükleme ileri tarih kuralı)
const entry = unwrap(await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "200", date: "2026-10-08", method: "bank", bankAccountId: acc.id }));
show("2 bugün havale", { status: entry ? 200 : 0, data: entry });
console.log("Gerçek Banka (bugün 200 sonrası)", await real());
// 3. Saat geri alınırsa (bilgisayar saati 3 gün geri): bugün yazılan satır "ileri tarihli" olur
server.clock.set("2026-10-05T12:00:00+03:00");
const summary = unwrap(await api.get("/api/workspace/bank/summary"));
const cash = unwrap(await api.get("/api/workspace/overview/anlik-durum")) || null;
console.log("3 saat geri: Gerçek Banka", summary.realBank.minor / 100, "· ileri tarihli eski kova", JSON.stringify(summary.unassigned.future || null));
await server.close();
