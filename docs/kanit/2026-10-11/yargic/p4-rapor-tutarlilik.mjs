// Yargıç sondası 4: banka raporlarının iç tutarlılığı (Dönem Başı + Giriş − Çıkış + Transfer ± Düzeltme = Dönem Sonu; TOPLAM = satırlar) ve
// kaynaklar arası aynı sayı (Genel Bakış, ANLIK DURUM, Banka Bakiye, Alt Hesap Mizanı, Hesap Planı Mizanı, Birleşik Rapor). Geçen yıldan devreden
// hareketler, ters kayıt, transfer ücreti, kredi, kurumsal kart, Kasa ↔ Banka.
import { BANK, bootBank } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
const ctx = await bootBank({ now: "2026-10-08T12:00:00+03:00" });
const { api } = ctx;
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${r.code} ${r.error}`);
  return r.data;
};
const num = cell => {
  const raw = String(cell ?? "").replace(/−/g, "-").replace(" TL", "").trim();
  if (!raw) return 0;
  return Number(raw.replace(/\./g, "").replace(",", "."));
};
const near = (a, b) => Math.abs(a - b) < 0.005;
let problems = 0;
const check = (label, ok, detail = "") => {
  if (!ok) problems += 1;
  log(`${ok ? "TAMAM" : "FARK "} ${label}${detail ? ` ${detail}` : ""}`);
};
try {
  // Saat geçen yıla alınarak eski hareketler girilir (ileri tarih kuralı).
  ctx.server.clock.set("2025-12-20T12:00:00+03:00");
  const A = await must("A", api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", opening: { date: "2025-12-20", amount: "5.000", confirmed: true } }));
  const c = await must("cari", api.post("/api/workspace/accounts", { name: "Müşteri M", type: "customer", registeredOn: "2025-12-01" }));
  ctx.server.clock.set("2025-12-28T12:00:00+03:00");
  await must("fee 2025", api.post(`${BANK}/vouchers`, { type: "fee", accountId: A.id, amount: "100", tax: "bsmv_incl", date: "2025-12-22" }));
  await must("tahsilat 2025", api.post(`/api/workspace/accounts/${c.id}/entries`, { kind: "in", method: "bank", bankAccountId: A.id, date: "2025-12-28", amount: "2.000" }));
  ctx.server.clock.set("2026-10-08T12:00:00+03:00");
  const B = await must("B", api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "B", kind: "demand", opening: { date: "2026-01-01", amount: "1.000", confirmed: true } }));
  const KK = await must("KK", api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "KK", kind: "card", creditLimit: "10.000", opening: { date: "2026-01-01", amount: "0", confirmed: true } }));
  const L = await must("L", api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "Kredi", kind: "loan", opening: { date: "2026-01-01", amount: "0", confirmed: true } }));
  await must("transfer", api.post(`${BANK}/transfers`, { type: "transfer", accountId: A.id, toAccountId: B.id, amount: "1.000", feeAmount: "5", feeTax: "bsmv_incl", date: "2026-03-10" }));
  const fee = await must("fee", api.post(`${BANK}/vouchers`, { type: "fee", accountId: B.id, amount: "50", tax: "bsmv_incl", date: "2026-04-01" }));
  await must("ters", api.post(`${BANK}/events/${fee.id}/reverse`, { date: "2026-05-01" }));
  const sup = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier", registeredOn: "2026-01-01" }));
  await must("kart harcama", api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", bankAccountId: KK.id, date: "2026-06-01", amount: "400" }));
  await must("kart borcu", api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: A.id, cardAccountId: KK.id, amount: "250", date: "2026-07-01" }));
  await must("kredi kullan", api.post(`${BANK}/transfers`, { type: "loan_draw", accountId: B.id, loanAccountId: L.id, amount: "3.000", date: "2026-08-01" }));
  await must("kredi öde", api.post(`${BANK}/transfers`, { type: "loan_repay", accountId: B.id, loanAccountId: L.id, amount: "1.000", interestAmount: "50", date: "2026-09-01" }));
  await must("kasaya", api.post("/api/workspace/cash/transfer", { direction: "to-cash", bankAccountId: A.id, amount: "300", date: "2026-09-10" }));
  await must("bankaya", api.post("/api/workspace/cash/transfer", { direction: "to-bank", bankAccountId: B.id, amount: "200", date: "2026-09-11" }));
  await must("faiz", api.post(`${BANK}/vouchers`, { type: "interest_in", accountId: A.id, amount: "80", stoppageRate: "15", date: "2026-10-01" }));

  const summary = await must("summary", api.get(`${BANK}/summary`));
  const overview = await must("overview", api.get("/api/workspace/overview"));
  const subs = await must("sub", api.get(`${BANK}/sub-trial`));
  const ledger = await must("ledger", api.get("/api/workspace/ledger"));
  const trial = Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance]));
  const real = summary.realBank.minor / 100;
  log("Gerçek Banka (Genel Bakış)", real, "Kart+Kredi", summary.debt);
  check("ANLIK DURUM Gerçek Banka = Genel Bakış", near(overview.cash.bank.balance, real), `${overview.cash.bank.balance}`);
  const sub102 = subs.rows.filter(row => row.sub.startsWith("102.")).reduce((s, row) => s + row.balance, 0);
  check("Alt Hesap Mizanı Σ102 = Genel Bakış", near(sub102, real), `${sub102}`);
  check("Hesap Planı Mizanı 102 = Genel Bakış", near(trial["102"] || 0, real), `${trial["102"]}`);
  const companies = await api.get("/api/companies/report");
  log("birleşik rapor", companies.status, JSON.stringify(companies.data?.rows?.[0] || companies.data).slice(0, 300));

  for (const [label, from, to, preset = ""] of [["Bu Yıl", "2026-01-01", "2026-12-31"], ["Geçen Yıl", "2025-01-01", "2025-12-31"], ["Tüm Zamanlar", "", "", "all"], ["Ara dönem", "2026-03-15", "2026-08-15"]]) {
    for (const bankGroup of ["real", "debt", "all"]) {
      const rep = await must(`bakiye ${label}`, api.get(`/api/workspace/report-center/banka-bakiye?${new URLSearchParams({ from, to, bankGroup, preset })}`));
      const H = name => rep.headers.indexOf(name);
      for (const row of rep.rows) {
        const lhs = num(row[H("Dönem Başı")]) + num(row[H("Giriş")]) - num(row[H("Çıkış")]) + num(row[H("Transfer Giriş")]) - num(row[H("Transfer Çıkış")]) + num(row[H("Açılış ve Devir Düzeltmesi")]);
        check(`Banka Bakiye [${label}/${bankGroup}] ${row[2]}: başı+giriş−çıkış+tr±düz = sonu`, near(lhs, num(row[H("Dönem Sonu")])), `${lhs.toFixed(2)} ↔ ${row[H("Dönem Sonu")]}`);
      }
      if (bankGroup === "real" && to === "") {
        const sum = rep.rows.reduce((s, row) => s + num(row[H("Dönem Sonu")]), 0);
        check(`Banka Bakiye Tüm Zamanlar Σ Dönem Sonu = Genel Bakış`, near(sum, real), `${sum}`);
      }
    }
    for (const acc of [A, B, KK, L]) {
      const rep = await must(`hareket ${label}`, api.get(`/api/workspace/report-center/banka-hareket?${new URLSearchParams({ from, to, bankAccount: acc.id, preset })}`));
      const S = Object.fromEntries(rep.summary);
      const lhs = num(S["Devir"]) + num(S["Giriş"]) - num(S["Çıkış"]) + num(S["Transfer Giriş"]) - num(S["Transfer Çıkış"]) + num(S["Açılış ve Devir Düzeltmeleri"]);
      check(`Banka Hareket [${label}] ${acc.name}: devir+giriş−çıkış+tr±düz = dönem sonu`, near(lhs, num(S["Dönem Sonu"])), `${lhs.toFixed(2)} ↔ ${S["Dönem Sonu"]}`);
      const last = rep.rows.at(-1);
      check(`Banka Hareket [${label}] ${acc.name}: son satır bakiyesi = dönem sonu`, near(num(last?.[9]), num(S["Dönem Sonu"])), `${last?.[9]} ↔ ${S["Dönem Sonu"]}`);
      const bak = await must("bakiye all", api.get(`/api/workspace/report-center/banka-bakiye?${new URLSearchParams({ from, to, bankGroup: "all", preset })}`));
      const brow = bak.rows.find(row => row[3] === acc.glSub);
      check(`Banka Hareket ↔ Banka Bakiye [${label}] ${acc.name} dönem sonu`, near(num(brow?.[10]), num(S["Dönem Sonu"])), `${brow?.[10]} ↔ ${S["Dönem Sonu"]}`);
      check(`Banka Hareket ↔ Banka Bakiye [${label}] ${acc.name} dönem başı`, near(num(brow?.[4]), num(S["Devir"])), `${brow?.[4]} ↔ ${S["Devir"]}`);
    }
    const subRep = await api.get(`/api/workspace/report-center/alt-hesap-mizani?${new URLSearchParams({ from, to, preset })}`);
    if (subRep.status === 200) log(`Alt Hesap Mizanı [${label}] başlıklar`, JSON.stringify(subRep.data.headers), "satır", subRep.data.rows.length);
    const fees = await must("masraf", api.get(`/api/workspace/report-center/banka-masraf?${new URLSearchParams({ from, to, preset })}`));
    const T = fees.headers.indexOf("Toplam");
    const sumT = fees.rows.reduce((s, row) => s + num(row[T]), 0);
    log(`Banka Masraf [${label}] satır ${fees.rows.length} Σ Toplam ${sumT.toFixed(2)} özet ${JSON.stringify(fees.summary)}`);
  }
  const integ = await integrityOf(api);
  check("Mutabakat Testi", integ.ok, JSON.stringify(integ.failures || []).slice(0, 300));
  log("SORUN SAYISI", problems);
} finally {
  await ctx.server.close();
}
