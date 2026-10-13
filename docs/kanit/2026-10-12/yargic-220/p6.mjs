// Yargıç 2.2.0 — p6: Bankaya Tahsile Ver + senet 121/321 birleşik akış; Yevmiye/Alt Hesap Mizanı, cari, banka, ANLIK DURUM, Mutabakat.
// Bağımsız beklenen (plan §3.14, §3.11a; Tekdüzen): alınan çek 101.01 → 101.02 → karşılıksız (B 120 / A 101.02); alınan senet 121.01 → 121.02 →
// tahsil (B 102.01 / A 121.02); verilen senet 321; verilen çek 103; ciro edilen senet (B 320 / A 121.01).
// Koşu: node docs/kanit/2026-10-12/yargic-220/p6.mjs
import { BANK, bootBank, must, openAcceptanceAccounts, subBalances, trialBalances } from "../../../../test/banka-210-hesap-ortak.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const note = (id, v) => console.log(`NOT   [${id}] ${JSON.stringify(v).slice(0, 900)}`);
const C = "/api/workspace/cheques";

const ctx = await bootBank();
const acc = await openAcceptanceAccounts(ctx.api, { useCheque: true, useNote: true });
const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "Alıcı A", type: "customer", registeredOn: "2026-10-01" }));
const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "Satıcı S", type: "supplier", registeredOn: "2026-10-01" }));
const doc = body => must(body.serialNo, ctx.api.post(C, { dueDate: "2026-10-20", ...body }));
const act = (id, body) => ctx.api.post(`${C}/${id}/actions`, body);
const cek = await doc({ direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-02", accountId: buyer.id, serialNo: "AC1", bank: "Akbank" });
const senet = await doc({ direction: "in", instrument: "note", amount: "2.000", issueDate: "2026-10-02", accountId: buyer.id, serialNo: "AS1" });
const senet2 = await doc({ direction: "in", instrument: "note", amount: "700", issueDate: "2026-10-02", accountId: buyer.id, serialNo: "AS2" });
const vsen = await doc({ direction: "out", instrument: "note", amount: "500", issueDate: "2026-10-03", accountId: seller.id, serialNo: "VS1" });
await doc({ direction: "out", instrument: "cheque", amount: "300", issueDate: "2026-10-03", accountId: seller.id, serialNo: "VC1", bankAccountId: acc.ziraat.id });
note("tahsile ver çek", (await act(cek.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id })).status);
note("tahsile ver senet", (await act(senet.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.garanti.id })).status);
note("senet2 ciro", (await act(senet2.id, { action: "endorse", date: "2026-10-06", accountId: seller.id })).status);
let sub = await subBalances(ctx.api);
check("S1", "alt hesaplar 101.01/101.02/121.01/121.02 (tahsilde)", [0, 1000, 0, 2000], ["101.01", "101.02", "121.01", "121.02"].map(k => sub[k]?.balance ?? 0));
const tahsil = await act(senet.id, { action: "collect", date: "2026-10-07" });
note("senedi tahsil (kayıtlı hesap Garanti)", [tahsil.status, tahsil.data?.code, tahsil.data?.error]);
const bounce = await act(cek.id, { action: "bounce", date: "2026-10-08" });
note("çek karşılıksız", [bounce.status, bounce.data?.code, bounce.data?.error]);
const pay = await act(vsen.id, { action: "pay", date: "2026-10-08", method: "bank", bankAccountId: acc.ziraat.id });
note("verilen senet öde (Ziraat)", [pay.status, pay.data?.code, pay.data?.error]);
sub = await subBalances(ctx.api);
const tb = await trialBalances(ctx.api);
check("S2", "mizan 101 / 121 / 103 / 321", [0, 0, -300, 0], ["101", "121", "103", "321"].map(k => tb[k] ?? 0));
check("S3", "alt hesaplar 101.01/101.02/121.01/121.02", [0, 0, 0, 0], ["101.01", "101.02", "121.01", "121.02"].map(k => sub[k]?.balance ?? 0));
// Ziraat 100.000 − 500 (senet ödemesi) = 99.500; Garanti 50.000 + 2.000 = 52.000
const bal = async id => (await must("h", ctx.api.get(`${BANK}/accounts/${id}`))).balanceMinor / 100;
check("S4", "Ziraat / Garanti", [99500, 52000], [await bal(acc.ziraat.id), await bal(acc.garanti.id)]);
// cari: alıcı −1.000 −2.000 −700 (evrak alındı) + 1.000 (karşılıksız) = −2.700 ; satıcı: +500 (senet verildi) +300 (çek verildi) +700 (ciro) = +1.500 (borcumuz kapandı yönünde)
const party = async id => (await must("cari", ctx.api.get(`/api/workspace/accounts/${id}`))).totals.balance;
check("S5", "cari Alıcı A / Satıcı S", [-2700, 1500], [await party(buyer.id), await party(seller.id)]);
check("S6", "mizan 120 / 320", [-2700, 1500], [tb["120"] ?? 0, tb["320"] ?? 0]);
const ov = await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview"));
const s = JSON.stringify(ov);
note("ANLIK DURUM çek bölümü", Object.fromEntries(Object.entries(ov).filter(([k]) => /cheq|cek|evrak/i.test(k))));
const summary = await must("çek özet", ctx.api.get(`${C}?status=portfolio`));
note("çek özeti", summary.summary || Object.keys(summary));
// Yevmiye: bütün maddelerde borç = alacak; senet satırları 121 / 321
const ledger = await must("yevmiye", ctx.api.get("/api/workspace/ledger"));
const entries = ledger.journal || ledger.entries || [];
const unbalanced = entries.filter(e => Math.round(e.lines.reduce((t, l) => t + (l.debit || 0) - (l.credit || 0), 0)) !== 0);
check("S7", "dengesiz yevmiye maddesi", 0, unbalanced.length);
const integ = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
check("S8", "Mutabakat", true, integ.ok);
// geri al zinciri: karşılıksızı Geri Al → yeniden tahsilde; Bankadan Geri Al → portföy
const undo = await ctx.api.post(`${C}/${cek.id}/undo`, {});
note("karşılıksızı geri al", [undo.status, undo.data?.code, undo.data?.error]);
sub = await subBalances(ctx.api);
check("S9", "geri al sonrası 101.02 (yeniden tahsilde)", 1000, sub["101.02"]?.balance ?? 0);
const wd = await act(cek.id, { action: "bank-withdraw", date: "2026-10-08" });
note("bankadan geri al", [wd.status, wd.data?.code]);
sub = await subBalances(ctx.api);
check("S10", "bankadan geri al sonrası 101.01 / 101.02", [1000, 0], [sub["101.01"]?.balance ?? 0, sub["101.02"]?.balance ?? 0]);
check("S11", "Mutabakat", true, (await must("m", ctx.api.get("/api/workspace/ledger/integrity"))).ok);
await ctx.server.close();
console.log("\nÖZET", out.filter(o => !o.ok).length, "fark /", out.length, "denetim");
process.exit(0);
