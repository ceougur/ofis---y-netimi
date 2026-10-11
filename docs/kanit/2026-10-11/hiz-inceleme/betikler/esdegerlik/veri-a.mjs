// Senaryo A verisini kurar (senaryo-a.mjs ile aynı adımlar). ctx: bootBank/boot dönüşü (api, db, server, app).
import { addDays } from "./ortak.mjs";
const R = "/home/user/ofis---y-netimi";
const { BANK, must, openAccount } = await import(`${R}/test/banka-210-hesap-ortak.mjs`);
const { rawAll } = await import(`${R}/test/banka-210-ortak.mjs`);
export async function buildA(ctx, NOW, log = []) {
  const note = (label, res) => {
    log.push({ label, status: res.status, data: typeof res.data === "object" ? JSON.stringify(res.data).slice(0, 300) : String(res.data).slice(0, 300) });
    return res;
  };
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
  return { today, D0, T1 };
}
