// Sonda (10.10.2026, ertelenenler denetimi): gizli "Elle Banka Fişi" ayarı API'den açılıp gizli fiş — Kambiyo Kârı (646, döviz) satırıyla —
// yazılabiliyor mu? Çalıştırma: node docs/kanit/2026-10-10/t4-nakit-akis/elle-fis-sonda.mjs (depo kökünden). Çıktı: her adımın durum kodu ve
// veri tabanındaki sayılar (ders 3). Beklenen (düzeltmeden sonra): PUT 400 bank-setting-later, fiş 409 bank-manual-off, 646 bakiyesi 0.
import { loginAdmin, startTestServer } from "../../../../test/helpers.mjs";

const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00" });
try {
  const admin = await loginAdmin(server);
  const unwrap = res => ({ status: res.status, code: res.data?.code || res.data?.error?.code || "", data: res.data?.ok ? res.data.data : res.data });
  const account = unwrap(await admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));
  console.log("hesap", account.status);
  const put = unwrap(await admin.put("/api/workspace/bank/settings", { values: { other: { manualVoucher: true } } }));
  console.log("PUT other.manualVoucher=true →", put.status, put.code || "", "okunan:", put.data?.values?.other?.manualVoucher);
  const kambiyo = unwrap(await admin.post("/api/workspace/bank/vouchers", { type: "other_in", accountId: account.data.id, lines: [{ role: "fx_gain", gl: "646", side: "C", amount: "5" }, { role: "bank", accountId: account.data.id, side: "D", amount: "5" }] }));
  console.log("Kambiyo Kârı (646) elle fişi →", kambiyo.status, kambiyo.code || "", kambiyo.data?.no || "");
  const lines = server.app.store.get("SELECT COUNT(*) AS n, COALESCE(SUM(CASE side WHEN 'C' THEN try_minor ELSE -try_minor END), 0) AS c FROM bank_lines WHERE gl LIKE '646%'");
  console.log("bank_lines 646 satır:", lines.n, "alacak (kuruş):", lines.c);
  const trial = unwrap(await admin.get("/api/workspace/ledger"));
  const row = trial.data?.trial?.accounts?.find(item => item.code === "646");
  console.log("Hesap Planı Mizanı 646:", row ? row.balance : 0);
} finally {
  await server.close();
}
