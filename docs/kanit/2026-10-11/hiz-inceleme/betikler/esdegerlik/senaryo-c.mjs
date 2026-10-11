// Senaryo C: ham (K6 ve kapı dışı) yazılmış uç satırlar — sınıflamanın SQL'e taşınmasında kayabilecek kollar:
// gider payı > tutar, eksi gider payı (ters kaydın gelişi), asıl işlemi bulunamayan ters kayıt, ters kaydın ters kaydı (açılış zinciri),
// hesapsız kredi/kart rolü satırı, kart hesabına bağlı havale (yol bilinmiyor), vadesiz hesaba bağlı POS satırı, gönderen hesabı kart olan iç hareket.
// Kullanım: node senaryo-c.mjs [büyük] [çıktı.json]   (büyük: toplam 2^53 kuruşu aşan satırlar da eklenir)
import { writeFileSync } from "node:fs";
import { addDays, compareMoney, compareReports } from "./ortak.mjs";
const R = "/home/user/ofis---y-netimi";
const { BANK, bootBank, must, openAccount } = await import(`${R}/test/banka-210-hesap-ortak.mjs`);
const { rawRun, rawAll } = await import(`${R}/test/banka-210-ortak.mjs`);

const big = process.argv[2] === "büyük";
const out = process.argv[3] || (big ? "senaryo-c-buyuk.json" : "senaryo-c-sonuc.json");
const NOW = "2026-10-08T12:00:00+03:00";
const ctx = await bootBank({ now: { time: NOW, fixed: true }, bankPickLegacy: true, reportWorker: true, gateVerify: false, moneyStrict: false });
let result;
try {
  const api = ctx.api;
  const today = "2026-10-08";
  const party = await must("cari", api.post("/api/workspace/accounts", { name: "Ham Ltd.", type: "customer", registeredOn: addDays(today, -400) }));
  const D0 = addDays(today, -40);
  const A = await openAccount(api, { bankName: "A", name: "A", kind: "demand", opening: { date: D0, amount: "10.000", confirmed: true } });
  const B = await openAccount(api, { bankName: "B", name: "B", kind: "demand", opening: { date: D0, amount: "10.000", confirmed: true } });
  const K = await openAccount(api, { bankName: "K", name: "Kart", kind: "card", creditLimit: "100.000", opening: { date: D0, amount: "0", confirmed: true } });
  const L = await openAccount(api, { bankName: "L", name: "Kredi", kind: "loan", opening: { date: D0, amount: "0", confirmed: true } });
  await must("transfer", api.post(`${BANK}/transfers`, { accountId: A.id, toAccountId: B.id, amount: "1.000", date: addDays(today, -20), feeAmount: "15", feeTax: "bsmv_excl", feeType: "eft", similarOk: true, negativeOk: true }));
  const openingEvent = rawAll(ctx.db, "SELECT id FROM fin_events WHERE type = 'opening' AND bank_ref = ?", A.id)[0].id;
  let seq = 9000;
  const ev = ({ type, date, bank = "", reversalOf = "", created = "2026-10-08T09:00:00.000Z" }) => {
    seq += 1;
    const id = `ev-ham-${seq}`;
    rawRun(ctx.db, "INSERT INTO fin_events (id, year, seq, no, type, date, reversal_of, bank_ref, created_by, created_at) VALUES (?, 2026, ?, ?, ?, ?, ?, ?, 'test', ?)", id, seq, `BNK-2026-H${seq}`, type, date, reversalOf, bank, created);
    return id;
  };
  let line = 0;
  const bl = (event, { role, ref = "", side, minor, gl = "102" }) => {
    line += 1;
    rawRun(ctx.db, "INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)", `bl-ham-${line}`, event, line, role, gl, ref, side, minor);
  };
  const d1 = addDays(today, -15);
  // C1: gider payı > tutar (gönderende çıkış 1.000, gider 5.000).
  const c1 = ev({ type: "transfer", date: d1, bank: A.id });
  bl(c1, { role: "bank", ref: A.id, side: "C", minor: 100000 });
  bl(c1, { role: "bank", ref: B.id, side: "D", minor: 100000 });
  bl(c1, { role: "expense", side: "D", minor: 500000, gl: "770" });
  bl(c1, { role: "tax", side: "D", minor: 25000, gl: "770" });
  bl(c1, { role: "bank", ref: A.id, side: "C", minor: 525000 });
  // C2: eksi gider payı — transferin ters kaydı gibi (gönderen hesaba giriş, gider alacak).
  const c2 = ev({ type: "reversal", date: d1, bank: A.id, reversalOf: c1 });
  bl(c2, { role: "bank", ref: A.id, side: "D", minor: 100000 });
  bl(c2, { role: "expense", side: "C", minor: 30000, gl: "770" });
  bl(c2, { role: "bank", ref: B.id, side: "C", minor: 70000 });
  // C2b: eksi gider payı tutardan büyük.
  const c2b = ev({ type: "reversal", date: d1, bank: B.id, reversalOf: c1 });
  bl(c2b, { role: "bank", ref: B.id, side: "D", minor: 1000 });
  bl(c2b, { role: "expense", side: "C", minor: 90000, gl: "770" });
  // C3: asıl işlemi bulunamayan ters kayıt.
  const c3 = ev({ type: "reversal", date: d1, bank: A.id, reversalOf: "ev-yok" });
  bl(c3, { role: "bank", ref: A.id, side: "D", minor: 4321 });
  // C4: açılışın ters kaydı ve onun ters kaydı.
  const c4 = ev({ type: "reversal", date: D0, bank: A.id, reversalOf: openingEvent });
  bl(c4, { role: "bank", ref: A.id, side: "C", minor: 777 });
  const c4b = ev({ type: "reversal", date: D0, bank: A.id, reversalOf: c4 });
  bl(c4b, { role: "bank", ref: A.id, side: "D", minor: 777 });
  // C5: hesapsız kredi ve kart rolü satırları (bugün ve ileri tarih).
  const c5 = ev({ type: "carry_close", date: addDays(today, -10) });
  bl(c5, { role: "loan", side: "C", minor: 12345, gl: "300" });
  bl(c5, { role: "card", side: "D", minor: 2345, gl: "309" });
  bl(c5, { role: "pos", side: "D", minor: 345, gl: "108" });
  const c5f = ev({ type: "fee", date: addDays(today, 9) });
  bl(c5f, { role: "loan", side: "D", minor: 555, gl: "300" });
  bl(c5f, { role: "bank", side: "C", minor: 556 });
  // C6: gönderen hesabı kart olan iç hareket (gider payı uygulanmaz).
  const c6 = ev({ type: "card_payment", date: addDays(today, -5), bank: K.id });
  bl(c6, { role: "card", ref: K.id, side: "C", minor: 50000, gl: "309" });
  bl(c6, { role: "bank", ref: A.id, side: "C", minor: 50000 });
  bl(c6, { role: "expense", side: "D", minor: 1500, gl: "770" });
  // C6b: başlıktaki gönderen hesap gider satırı olmayan kredi hesabı (iç hareket, loan).
  const c6b = ev({ type: "loan_repay", date: addDays(today, -5), bank: L.id });
  bl(c6b, { role: "loan", ref: L.id, side: "D", minor: 20000, gl: "300" });
  bl(c6b, { role: "bank", ref: A.id, side: "C", minor: 20000 });
  // C7: modül satırları — kart hesabına bağlı havale (yol bilinmiyor), vadesiz hesaba bağlı POS, kredi hesabına bağlı havale.
  const entry = (method, fin, amount, date, kind = "in") => {
    const id = `ae-ham-${method}-${amount}`;
    rawRun(ctx.db, "INSERT INTO account_entries (id, account_id, kind, amount, date, method, fin_ref, source, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'ham', 'test', '2026-10-08T09:00:00.000Z')", id, party.id, kind, amount, date, method, fin);
  };
  entry("bank", K.id, 11.11, addDays(today, -3));
  entry("card", A.id, 22.22, addDays(today, -3));
  entry("bank", L.id, 33.33, addDays(today, -3), "out");
  entry("card", "", 44.44, addDays(today, 3));
  entry("bank", "bacc-silinmis", 55.55, addDays(today, -3));
  entry("bank", A.id, 0.005, addDays(today, -2));
  entry("bank", A.id, 1.015, addDays(today, -2));
  if (big) {
    // Toplam 2^53 kuruşu aşan satırlar (her biri 1e12 TL = API sınırı).
    for (let i = 0; i < 95; i += 1) {
      const e = ev({ type: "transfer_in_test", date: addDays(today, -1) });
      bl(e, { role: "bank", ref: B.id, side: "D", minor: 100000000000000 });
    }
  }
  ctx.app.context.money.reset?.();
  const banks = rawAll(ctx.db, "SELECT id, kind, status FROM bank_accounts");
  const periods = [["varsayılan", {}], ["all", { preset: "all" }], ["D0 tek", { from: D0, to: D0 }], ["D0+1", { from: addDays(D0, 1), to: today }], ["d1 başı", { from: d1, to: today }], ["d1 tek", { from: d1, to: d1 }], ["ileri", { from: today, to: addDays(today, 20) }], ["yalnız bitiş", { to: d1 }]];
  const froms = ["", D0, addDays(D0, 1), d1, addDays(d1, 1), today, addDays(today, 10)];
  const untils = ["", today, d1, D0, addDays(today, 10)];
  let rep;
  let mon;
  let err = null;
  try {
    rep = await compareReports(ctx.app, "C", periods, banks);
    mon = compareMoney(ctx.app, "C", { today, froms, untils, banks });
  } catch (error) {
    err = String(error?.stack || error).slice(0, 1500);
  }
  // Yeni yolun doğrudan çağrısı (karşılaştırma dışı, hata görmek için).
  const direct = {};
  for (const [label, fn] of [["classifiedTotals", () => ctx.app.context.money.classifiedTotals({ ways: ["bank", "card", "ccard", "loan"], until: today, from: "2026-01-01", day: today })], ["keyTotals", () => ctx.app.context.money.keyTotals({ ways: ["bank"], refs: [A.id, B.id], before: today, until: today })], ["oldClassifiedSum", () => null]]) {
    try {
      direct[label] = JSON.stringify(fn()).slice(0, 400);
    } catch (error) {
      direct[label] = `HATA ${error.code || ""} ${error.message}`;
    }
  }
  result = { big, err, direct, rep: rep && { compared: rep.compared, rows: rep.rows, diffs: rep.diffs.length, first: rep.diffs.slice(0, 20), kinds: [...new Set(rep.diffs.map(d => `${d.tag.split(" · ")[1].split(" ")[0]} eski=${d.expected} yeni=${String(d.actual).slice(0, 40)}`))] }, mon: mon && { checks: mon.checks, diffs: mon.diffs.length, first: mon.diffs.slice(0, 20) } };
} finally {
  await ctx.server.close();
}
if (result.rep) result.rep.all = undefined;
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ big: result.big, err: result.err?.slice(0, 400), direct: result.direct, rep: result.rep && { c: result.rep.compared, rows: result.rep.rows, d: result.rep.diffs }, mon: result.mon && { c: result.mon.checks, d: result.mon.diffs } }));
