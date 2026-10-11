// Hakem: KASA-ISTEK-KIMLIGI — KOMŞU yol (Ders 10). İstek kimliğini uygulayan uçlarda eksi bakiye denetimi (guardOut) bank.post'tan
// (yani istek kimliği aramasından) ÖNCE çalışıyor mu? Başarılı bir çıkışın aynı kimlikle yinelenmesi, Kasa o çıkışla sıfıra indiyse
// "replayed" yerine 409 cash-negative alır mı? (SENARYO-DILI §5.6: istek kimliği 3., eksi bakiye 6. öncelik.)
//   node komsu.mjs <kod-kökü>
// Vakalar (boş şirket, Kasa eksi bakiye "Uyar" = varsayılan):
//   A  Kasa giriş 100 → cari nakit ÖDEME 100, K1 → aynısı K1
//   B  Kasa giriş 100 → Kasadan Bankaya Yatır 100, K2 → aynısı K2 (hesap tanımlı değil: hesapsız transfer)
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ moneyStrict: false });
const admin = await loginAdmin(server);
const today = new Date().toISOString().slice(0, 10);
const K1 = "d4".repeat(16);
const K2 = "e5".repeat(16);
const short = r => ({ durum: r.status, veri: r.data?.data ?? null, hata: r.status === 200 ? null : { error: r.data?.error ?? r.data, code: r.data?.code ?? null } });
const out = { kok: root, adimlar: [] };
const step = async (ad, fn) => {
  const r = await fn();
  out.adimlar.push({ ad, ...short(r) });
  return r;
};
await step("A1 Kasa giriş 100", () => admin.post("/api/workspace/cash", { kind: "in", amount: "100", date: today, description: "Kasaya Giriş", method: "cash" }));
const acc = await step("A2 cari aç", () => admin.post("/api/workspace/accounts", { name: "Hakem Tedarikçi", type: "supplier" }));
const id = encodeURIComponent(acc.data?.data?.id);
await step("A3 cari nakit ödeme 100, K1", () => admin.post(`/api/workspace/accounts/${id}/entries`, { kind: "out", amount: "100", date: today, method: "cash" }, { "x-hof-request": K1 }));
await step("A4 aynısı, K1 (yineleme)", () => admin.post(`/api/workspace/accounts/${id}/entries`, { kind: "out", amount: "100", date: today, method: "cash" }, { "x-hof-request": K1 }));
await step("B1 Kasa giriş 100", () => admin.post("/api/workspace/cash", { kind: "in", amount: "100", date: today, description: "Kasaya Giriş", method: "cash" }));
await step("B2 Kasadan Bankaya Yatır 100, K2", () => admin.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "100", date: today }, { "x-hof-request": K2 }));
await step("B3 aynısı, K2 (yineleme)", () => admin.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "100", date: today }, { "x-hof-request": K2 }));
const cash = await admin.get("/api/workspace/cash?method=cash");
out.kasaBakiye = cash.data?.data?.totals?.balance ?? null;
out.kasaSatir = (cash.data?.data?.entries || []).length;
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
