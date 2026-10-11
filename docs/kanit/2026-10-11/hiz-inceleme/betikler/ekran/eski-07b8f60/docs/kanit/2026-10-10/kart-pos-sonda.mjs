// Kullanıcının ANLIK DURUM ekranındaki durum (havale tahsilatı 10.000 + kredi kartıyla ödeme 8.656) 2.1.0 dalında: kart ödemesi nereye düşüyor?
import { pathToFileURL } from "node:url";
const R = "/home/user/ofis---y-netimi/test/";
const { bootBank, openAccount, BANK, TODAY, ZIRAAT_IBAN } = await import(pathToFileURL(R + "banka-210-hesap-ortak.mjs").href);
const { must } = await import(pathToFileURL(R + "banka-210-ortak.mjs").href);
const ctx = await bootBank();
const { api } = ctx;
try {
  const ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  const musteri = await must("cari A", api.post("/api/workspace/accounts", { name: "Müşteri A", type: "customer" }));
  const tedarikci = await must("cari B", api.post("/api/workspace/accounts", { name: "Tedarikçi B", type: "supplier" }));
  await must("havale tahsilatı", api.post(`/api/workspace/accounts/${musteri.id}/entries`, { kind: "in", amount: "10.000", method: "bank", bankAccountId: ziraat.id, date: TODAY }));
  await must("kartla ödeme", api.post(`/api/workspace/accounts/${tedarikci.id}/entries`, { kind: "out", amount: "8.656", method: "card", date: TODAY }));
  const show = async label => {
    const b = (await must("ANLIK DURUM", api.get("/api/workspace/overview"))).cash.bank;
    console.log(`${label}: ${b.labels?.realBank} ${b.balance} · bugün +${b.today?.in} −${b.today?.out} · ${b.labels?.debt} ${b.debt?.shown ? b.debt.total : "(gösterilmiyor)"} · ${b.labels?.unassigned} ${b.unassigned?.total}`);
  };
  await show("1) kart hesabı yokken");
  const kart = await openAccount(api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  await must("Kart Borcuna Aktar", api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: kart.id, amount: "8.656", date: TODAY }));
  await show("2) Kart Borcuna Aktar sonrası");
  const second = await api.post(`/api/workspace/accounts/${tedarikci.id}/entries`, { kind: "out", amount: "500", method: "card", bankAccountId: kart.id, date: TODAY });
  console.log(`3) yeni kartla ödemede kart hesabı verilince: ${second.status} ${JSON.stringify(second.data).slice(0, 160)}`);
  await show("3) sonrası");
  const integrity = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  console.log(`Mutabakat Testi: ${integrity.ok ? "tamam" : "BOZUK"}`);
} finally {
  await ctx.server.close();
}
