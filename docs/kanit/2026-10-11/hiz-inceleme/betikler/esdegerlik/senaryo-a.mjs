// Senaryo A: eşdeğerlik testinin KAPSAMADIĞI uç durumlar (sabit saat → aynı created_at, sıralama rank/rid'e kalır).
// Kullanım: node senaryo-a.mjs [çıktı.json]
import { writeFileSync } from "node:fs";
import { addDays, compareMoney, compareReports } from "./ortak.mjs";
const R = "/home/user/ofis---y-netimi";
const { BANK, bootBank, must, openAccount } = await import(`${R}/test/banka-210-hesap-ortak.mjs`);
const { rawRun, rawAll } = await import(`${R}/test/banka-210-ortak.mjs`);

const out = process.argv[2] || "senaryo-a-sonuc.json";
const NOW = "2026-10-08T12:00:00+03:00";
const log = [];
const note = (label, res) => {
  log.push({ label, status: res.status, data: typeof res.data === "object" ? JSON.stringify(res.data).slice(0, 300) : String(res.data).slice(0, 300) });
  return res;
};
const ctx = await bootBank({ now: { time: NOW, fixed: true }, bankPickLegacy: true, reportWorker: true });
let result;
try {
  const api = ctx.api;
  const today = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
  const party = await must("cari", api.post("/api/workspace/accounts", { name: "Uç Durum Ltd.", type: "customer", registeredOn: addDays(today, -400) }));
  const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Uç Tedarik A.Ş.", type: "supplier", registeredOn: addDays(today, -400) }));
  const gone = await must("silinecek cari", api.post("/api/workspace/accounts", { name: "Silinecek Cari", type: "customer", registeredOn: addDays(today, -400) }));
  const entry = (body, who = party.id) => api.post(`/api/workspace/accounts/${who}/entries`, { similarOk: true, negativeOk: true, cashForce: true, ...body });
  const D0 = addDays(today, -50);
  // Hesapsız eski satırlar: D0 (hesapların açıldığı gün) dahil, kuruş ve büyük tutar.
  for (const [offset, method, kind, amount] of [[-100, "bank", "in", "0,01"], [-60, "card", "in", "640"], [-60, "bank", "out", "300"], [-50, "bank", "in", "1.250,50"], [-50, "card", "out", "10,10"], [-49, "card", "in", "999.999.999,99"]]) note(`hesapsız ${offset} ${method} ${kind} ${amount}`, await entry({ kind, method, amount, date: addDays(today, offset) }));
  note("silinecek carinin havalesi", await entry({ kind: "in", method: "bank", amount: "777", date: addDays(today, -55) }, gone.id));
  // Aynı gün (D0) açılan hesaplar — oluşturma sırası B, A (sabit saat: created_at eşit → rid).
  const B = await openAccount(api, { bankName: "Banka B", name: "B Vadesiz", kind: "demand", opening: { date: D0, amount: "20.000", confirmed: true } });
  const A = await openAccount(api, { bankName: "Banka A", name: "A Vadesiz", kind: "demand", opening: { date: D0, amount: "10.000", confirmed: true } });
  const K = await openAccount(api, { bankName: "Banka K", name: "Şirket Kartı", kind: "card", creditLimit: "100.000", opening: { date: D0, amount: "1.000", confirmed: true } });
  const L = await openAccount(api, { bankName: "Banka L", name: "Kredi", kind: "loan", opening: { date: D0, amount: "0", confirmed: true } });
  // Hiç satırı olmayan hesap (açılış 0) ve sonra açılan C.
  const E = note("boş hesap", await api.post(`${BANK}/accounts`, { bankName: "Banka E", name: "Boş Hesap", kind: "demand", opening: { date: addDays(today, -10), amount: "0", confirmed: true } }));
  const C = await openAccount(api, { bankName: "Banka C", name: "C Vadesiz", kind: "demand", opening: { date: addDays(today, -30), amount: "5.000", confirmed: true } });
  // D0'da A'ya cari tahsilatı (rank 4, B'nin açılışından önce sıralanır), B'ye Kasa ↔ Banka (rank 2).
  note("A'ya D0 havale", await entry({ kind: "in", method: "bank", bankAccountId: A.id, amount: "100", date: D0 }));
  note("B kasadan bankaya D0", await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "50", date: D0, bankAccountId: B.id, cashForce: true, negativeOk: true }));
  // Transferler: ücret = tutar, ücret > tutar (dene), dönem sınır günleri.
  const T1 = addDays(today, -20);
  const tr1 = note("transfer ücretli", await api.post(`${BANK}/transfers`, { accountId: A.id, toAccountId: B.id, amount: "1.000", date: T1, feeAmount: "15", feeTax: "bsmv_excl", feeType: "eft", channel: "eft", similarOk: true, negativeOk: true }));
  note("transfer ücret>tutar", await api.post(`${BANK}/transfers`, { accountId: A.id, toAccountId: B.id, amount: "5", date: T1, feeAmount: "7,50", feeTax: "bsmv_incl", feeType: "eft", similarOk: true, negativeOk: true }));
  note("transfer ücret=tutar", await api.post(`${BANK}/transfers`, { accountId: B.id, toAccountId: A.id, amount: "10", date: T1, feeAmount: "10", feeTax: "none", feeType: "eft", similarOk: true, negativeOk: true }));
  note("transfer B→C", await api.post(`${BANK}/transfers`, { accountId: B.id, toAccountId: C.id, amount: "2.222,22", date: addDays(today, -19), feeAmount: "3,33", feeTax: "bsmv_incl", feeType: "havale", similarOk: true, negativeOk: true }));
  if (tr1.status === 200) {
    const rev = note("ters kayıt", await api.post(`${BANK}/events/${encodeURIComponent(tr1.data.id)}/reverse`, { reason: "uç", negativeOk: true }));
    if (rev.status === 200) {
      const revId = rev.data.id || rev.data.reversal?.id || rev.data.event?.id;
      note(`ters kaydın ters kaydı (${revId})`, await api.post(`${BANK}/events/${encodeURIComponent(revId)}/reverse`, { reason: "uç2", negativeOk: true }));
    }
  }
  // Kurumsal kart, kredi, kart borcu ödemesi, masraf (BSMV dahil/hariç), faiz.
  note("kartla tedarikçi ödemesi", await entry({ kind: "out", method: "card", bankAccountId: K.id, amount: "780,40", date: addDays(today, -15) }, supplier.id));
  note("kredi kullanımı", await api.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: A.id, loanAccountId: L.id, amount: "50.000", date: addDays(today, -14), similarOk: true }));
  note("kredi ödemesi", await api.post(`${BANK}/vouchers`, { type: "loan_repay", accountId: A.id, loanAccountId: L.id, amount: "5.000", interestAmount: "250", date: addDays(today, -5), similarOk: true, negativeOk: true }));
  note("kart borcu ödemesi", await api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: B.id, cardAccountId: K.id, amount: "500", date: addDays(today, -4), similarOk: true, negativeOk: true }));
  note("masraf", await api.post(`${BANK}/vouchers`, { type: "fee", accountId: C.id, amount: "12,50", feeType: "eft", tax: "bsmv_incl", date: addDays(today, -3), similarOk: true, negativeOk: true }));
  note("faiz", await api.post(`${BANK}/vouchers`, { type: "interest_in", accountId: C.id, amount: "1.000", stoppageRate: "15", date: today, similarOk: true }));
  // Silme / geri yükleme: A'ya bağlı bir cari tahsilatı silinip geri yüklenir; bir başkası silinip kalır.
  const del1 = note("silinecek tahsilat 1", await entry({ kind: "in", method: "bank", bankAccountId: A.id, amount: "333", date: addDays(today, -7) }));
  const del2 = note("silinecek tahsilat 2", await entry({ kind: "in", method: "bank", bankAccountId: B.id, amount: "444", date: addDays(today, -7) }));
  const lastId = () => rawAll(ctx.db, "SELECT id FROM account_entries ORDER BY rowid DESC LIMIT 2").map(r => r.id);
  const [id2, id1] = lastId();
  note("sil 1", await api.del(`/api/workspace/accounts/${party.id}/entries/${id1}`));
  note("sil 2", await api.del(`/api/workspace/accounts/${party.id}/entries/${id2}`));
  note("silinecek cariyi sil", await api.del(`/api/workspace/accounts/${gone.id}`));
  note("cariyi geri yükle", await api.post("/api/admin/trash/restore", { id: `account:${gone.id}` }));
  note("geri yüklenen carinin ikinci havalesi", await entry({ kind: "out", method: "bank", amount: "77", date: addDays(today, -54) }, gone.id));
  note("cariyi yeniden sil", await api.del(`/api/workspace/accounts/${gone.id}`));
  note("cariyi yeniden geri yükle", await api.post("/api/admin/trash/restore", { id: `account:${gone.id}` }));
  // Pasif hesap.
  note("C pasif", await api.post(`${BANK}/accounts/${C.id}/status`, { status: "passive" }));
  // İleri tarihli hesapsız satırlar (saat ileri → gir → geri).
  ctx.server.clock.set(`${addDays(today, 30)}T12:00:00+03:00`);
  for (const [offset, method, kind, amount] of [[7, "bank", "in", "900"], [12, "card", "in", "75,10"], [22, "bank", "out", "60"]]) note(`ileri ${offset}`, await entry({ kind, method, amount, date: addDays(today, offset) }));
  ctx.server.clock.set(NOW);
  ctx.app.context.money.reset?.();

  const banks = (await must("hesaplar", api.get(`${BANK}/accounts?status=all`))).accounts;
  const dates = rawAll(ctx.db, "SELECT DISTINCT date FROM (SELECT date FROM account_entries UNION SELECT date FROM fin_events UNION SELECT date FROM cash_entries) ORDER BY date").map(r => r.date);
  const firstDay = dates[0];
  const periods = [
    ["varsayılan", {}], ["all", { preset: "all" }], ["thisMonth", { preset: "thisMonth" }], ["lastMonth", { preset: "lastMonth" }], ["last30", { preset: "last30" }],
    ["D0 başı", { from: D0, to: today }], ["D0+1", { from: addDays(D0, 1), to: today }], ["T1 başı", { from: T1, to: today }], ["T1 bitişi", { from: D0, to: T1 }], ["T1 tek gün", { from: T1, to: T1 }],
    ["D0 tek gün", { from: D0, to: D0 }], ["ilk gün", { from: firstDay, to: firstDay }], ["bugün tek", { from: today, to: today }], ["gelecek", { from: addDays(today, 1), to: addDays(today, 40) }],
    ["ileri dahil", { from: addDays(today, -10), to: addDays(today, 25) }], ["yalnız bitiş", { to: addDays(today, -19) }], ["ters aralık", { from: today, to: D0 }], ["boş 2020", { from: "2020-01-01", to: "2020-12-31" }],
  ];
  const froms = ["", firstDay, D0, addDays(D0, 1), T1, addDays(T1, 1), addDays(today, -19), today, addDays(today, 8), addDays(today, 50)];
  const untils = ["", today, T1, D0, addDays(D0, -1), addDays(today, 12), addDays(today, 40)];
  const rep1 = await compareReports(ctx.app, "A bugün", periods, banks);
  const mon1 = compareMoney(ctx.app, "A bugün", { today, froms, untils, banks });
  // Saat ileri: ileri tarihli satırların bir kısmının tarihi geldi.
  ctx.server.clock.set(`${addDays(today, 15)}T12:00:00+03:00`);
  const later = addDays(today, 15);
  const rep2 = await compareReports(ctx.app, "A +15", periods, banks);
  const mon2 = compareMoney(ctx.app, "A +15", { today: later, froms, untils, banks });
  ctx.server.clock.set(NOW);
  rawRun(ctx.db, "UPDATE accounts SET deleted_at = '2026-10-08T09:00:00.000Z' WHERE id = ?", gone.id);
  log.push({ label: "son: cariyi ham sil", status: 200, data: JSON.stringify(rawAll(ctx.db, "SELECT id, deleted_at FROM accounts WHERE id = ?", gone.id)) });
  ctx.app.context.money.reset?.();
  const rep3 = await compareReports(ctx.app, "A geri yükleme", periods, banks);
  const mon3 = compareMoney(ctx.app, "A geri yükleme", { today, froms, untils, banks });
  result = { rep3: { compared: rep3.compared, diffs: rep3.diffs.length, first: rep3.diffs.slice(0, 10) }, mon3: { checks: mon3.checks, diffs: mon3.diffs.length, first: mon3.diffs.slice(0, 10) }, today, D0, T1, banks: banks.map(b => ({ id: b.id, kind: b.kind, status: b.status, name: b.name })), log, rep1: { compared: rep1.compared, rows: rep1.rows, diffs: rep1.diffs.length, first: rep1.diffs.slice(0, 15) }, mon1: { checks: mon1.checks, diffs: mon1.diffs.length, first: mon1.diffs.slice(0, 10) }, rep2: { compared: rep2.compared, rows: rep2.rows, diffs: rep2.diffs.length, first: rep2.diffs.slice(0, 15) }, mon2: { checks: mon2.checks, diffs: mon2.diffs.length, first: mon2.diffs.slice(0, 10) } };
} finally {
  await ctx.server.close();
}
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ rep1: result.rep1.compared, rep1Diffs: result.rep1.diffs, rows1: result.rep1.rows, mon1: result.mon1.checks, mon1Diffs: result.mon1.diffs, rep2: result.rep2.compared, rep2Diffs: result.rep2.diffs, mon2: result.mon2.checks, mon2Diffs: result.mon2.diffs, rep3: result.rep3.compared, rep3Diffs: result.rep3.diffs, mon3Diffs: result.mon3.diffs }));
for (const item of result.log) if (item.status !== 200) console.log("RED", item.label, item.status, item.data);
