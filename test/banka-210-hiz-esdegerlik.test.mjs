// 2.1.0 — hız düzeltmesi (11.10.2026; docs/BANKA-MODULU-PLAN.md §3.11 madde 5 bütçesi; ölçek: docs/kanit/2026-10-11/olcek) EŞDEĞERLİK testi.
//
// Düzeltme bir yeniden düzenlemedir: davranış ve çıktı DEĞİŞMEZ, yalnız hız. KÂHİN eski uygulamanın kendisidir: 2824f22'deki
// server/lib/bank/money-lines.mjs ve server/routes/report-center.mjs dondurulmuş kopyaları (test/fixtures/hiz-210-eski/; yalnız import yolları
// değişti). Aynı veri tabanında eski ve yeni yol birlikte çalıştırılır, çıktılar BİREBİR karşılaştırılır:
//   1. Rapor Merkezi: Banka Bakiye (her hesap grubu), Banka Hareket (her hesap seçeneği: tüm Gerçek Banka, her hesap — vadesiz, pasif, kurumsal
//      kart, kredi —, Hesabı Atanmamış; her hareket süzgeci), Banka ve POS Hareketleri (her yol), Kasa Hareketleri × dönemler (Bu Yıl, Tüm Zamanlar,
//      Bu Ay, Geçen Ay, Son 30 Gün, dönem başı = ilk hareket günü, tek gün, geçmiş dönem, boş dönem, gelecek dönem, tanınmayan dönem adı = dönem
//      başı yok) → başlık, kolonlar, BÜTÜN satırlar, toplam sayı, TOPLAM satırı, özet aynı. Eski rapor merkezi eski moneyLines'la ve eski moneyLines'la
//      kurulmuş Kasa servisiyle kurulur (Banka ve POS / Kasa raporlarının satırları da eski yoldan).
//   2. moneyLines'ın okuma uçları (satır yolu, özet, gruplar, dönem grupları, hesap toplamı, hesabı atanmamış, Bugün ve Bu Ay, sınıflanmış satırlar):
//      eski ↔ yeni aynı; yeni toplam yolları (classifiedTotals, keyTotals) eski sınıflanmış satırların eski rapor döngüsüyle toplanmasına eşit.
//   3. Cari arama: yeni (yalnız ilk 20 carinin bakiyesi) = eski (bütün carilerin listesi → tür önceliği → ilk 20).
// VERİ (programın kendi API'si, sahte saat): mutabakat motoru (rastgele; iki tohum: cari, Kasa, stok, taksit, fatura — peşin/vadeli/taksitli/
// iade/iptal —, çek/senet, iki vadesiz banka hesabı, Banka Fişleri, ücretli/BSMV'li transfer, ters kayıtlar, kurumsal kart, hesapsız eski satırlar)
// + elle: kurumsal kart ve kredi hesabı (kredi kullanımı / geri ödemesi faizli, kart borcu ödemesi, kartla cari ödemesi), Kasa ↔ Banka iki yön,
// ücretli transfer ve ters kaydı, Devir Kapanışı'lı kurulum (sihirbaz), eski bakiye aktarımı (Bankaya Geçmiş Say), Açılışı Düzelt, pasif hesap,
// tarihi gelmemiş hesapsız eski havale/POS (saat ileri alınıp girilir, geri alınır — eski sürümden kalan ileri tarihli satır gibi); karşılaştırmalar
// iki saatte (ileri tarihli satırlar gelecekte ve tarihi gelmiş).
// NASIL BOZARIM (önce yazıldı): sınıflama (açılış/Devir/aktarma = düzeltme, iç hareket, gider payı yönü ve tutarı aşmaması, ters kaydın asıl türü)
// SQL'e taşınırken kayar; dönem başı devri ve hesapların ilk görünme sırası değişir (aynı gün başlayan iki hesap); ileri tarihli hesapsız satır
// bakiyeye karışır; Hesabı Atanmamış süzgeci bağlı satırı alır; boş dönem/tanınmayan dönem adı (dönem başı yok); yol süzgecinin kaynağa itilmesi
// (nakit ↔ banka ↔ kart ↔ kurumsal kart ↔ kredi) satır düşürür; planlayıcı ipucu (CROSS JOIN, eşitlik koşulu) satır kümesini değiştirir; cari
// aramasında ilk 20'nin seçimi (Cari No sırası, tür önceliği) bakiyelere bakmadan değişir. Mutasyon kanıtı: docs/kanit/2026-10-11/hiz-duzeltme.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin } from "./helpers.mjs";
import { runReconciliation } from "./mutabakat/motor.mjs";
import { BANK, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";
import { registerCashRoutes } from "../server/routes/cash.mjs";
import { createMoneyLines as createOldMoneyLines } from "./fixtures/hiz-210-eski/money-lines.mjs";
import { registerReportCenter as registerOldReportCenter } from "./fixtures/hiz-210-eski/report-center.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const LATER = "2026-10-23T12:00:00+03:00";
const plain = value => JSON.parse(JSON.stringify(value));
// Rota kaydı yapmayan yönlendirici: eski rapor merkezi ve eski Kasa servisi yalnız işlevleri için kurulur.
const noRouter = () => new Proxy({}, { get: () => () => {} });

function adminOf(app) {
  const user = app.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
  app.context.access.attach(user);
  user.roleKey = app.context.access.roleKeyOf(user);
  return user;
}
// Eski yol: eski moneyLines + onunla kurulan Kasa servisi + eski rapor merkezi (aynı veri tabanı, aynı servisler).
function oldPath(app) {
  const ctx = app.context;
  const money = createOldMoneyLines(ctx.store);
  const cash = registerCashRoutes(noRouter(), { ...ctx, money });
  const center = registerOldReportCenter(noRouter(), { ...ctx, money, cash: () => cash, accounts: () => ctx.accounts, plans: () => ctx.plans, stock: () => ctx.stock, cheques: () => ctx.cheques, invoices: () => ctx.invoices, overview: () => ctx.overview, ledger: () => ctx.ledger, integrity: () => ctx.integrity });
  return { money, cash, center };
}

const addDays = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Veri: motor + elle eklenen banka işlemleri. Dönüş: { ctx, today, firstDay, banks }. Hata olursa sunucu kapanır (koşu asılı kalmaz). */
async function seed(seedNo, operations) {
  const ctx = await bootBank({ now: NOW, bankPickLegacy: true });
  try {
    return await fill(ctx, seedNo, operations);
  } catch (error) {
    await ctx.server.close();
    throw error;
  }
}
async function fill(ctx, seedNo, operations) {
  const report = await runReconciliation({ client: await loginAdmin(ctx.server), seed: seedNo, operations, verifyEvery: 100, reportEvery: 1000, burst: 0 });
  assert.deepEqual(report.mismatches.slice(0, 3), [], `motor (tohum ${seedNo}) tutarlı`);
  const api = ctx.api;
  const today = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
  const party = await must("cari", api.post("/api/workspace/accounts", { name: "Hız Eşdeğerlik Ltd.", type: "customer", registeredOn: addDays(today, -200) }));
  const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Hız Tedarik A.Ş.", type: "supplier", registeredOn: addDays(today, -200) }));
  const entry = body => must(`cari hareket ${JSON.stringify(body).slice(0, 80)}`, api.post(`/api/workspace/accounts/${body.party || party.id}/entries`, { similarOk: true, negativeOk: true, ...body, party: undefined }));
  // Hesapsız eski satırlar (eski sürüm gibi: hesap verilmeden havale ve POS): Devir Kapanışı'ndan önce ve sonra.
  for (const [offset, method, kind, amount] of [[-60, "bank", "in", "1.250,50"], [-58, "card", "in", "640"], [-40, "bank", "out", "300"], [-12, "bank", "in", "2.000"], [-11, "card", "in", "150,25"]]) await entry({ kind, method, amount, date: addDays(today, offset) });
  // Yeni vadesiz hesap D (açılış −20 gün) + kurulum sihirbazı: Devir Kapanışı (−20'den önceki hesapsız satırlar kapanır).
  const d = await openAccount(api, { bankName: "Vakıfbank", name: "Devir Hesabı", kind: "demand", opening: { date: addDays(today, -20), amount: "30.000", confirmed: true } });
  await must("sihirbaz (Devir Kapanışı)", api.post(`${BANK}/setup`, { accountId: d.id, carryClose: true, assign: "all", negativeOk: true }));
  // Kurumsal kart (açılış borcu) ve kredi hesabı.
  const card = await openAccount(api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "500.000", opening: { date: addDays(today, -20), amount: "4.000", confirmed: true } });
  const loan = await openAccount(api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: addDays(today, -20), amount: "0", confirmed: true } });
  // Eski bakiye aktarımı (Bankaya Geçmiş Say): D'nin açılışından sonraki hesapsız havale (−12) D'ye.
  await must("eski bakiye aktarımı", api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: d.id, amount: "500", negativeOk: true }));
  // Kredi kullanımı + faizli geri ödeme; kart borcu ödemesi; kartla cari ödemesi (kurumsal kart bağı).
  await must("kredi kullanımı", api.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: d.id, loanAccountId: loan.id, amount: "50.000", date: addDays(today, -9), similarOk: true }));
  await must("kredi geri ödemesi", api.post(`${BANK}/vouchers`, { type: "loan_repay", accountId: d.id, loanAccountId: loan.id, amount: "5.000", interestAmount: "250", date: addDays(today, -5), similarOk: true, negativeOk: true }));
  await must("kart borcu ödemesi", api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: d.id, cardAccountId: card.id, amount: "1.500", date: addDays(today, -4), similarOk: true, negativeOk: true }));
  await entry({ party: supplier.id, kind: "out", method: "card", bankAccountId: card.id, amount: "780,40", date: addDays(today, -3) });
  // Kasa ↔ Banka iki yön (D), masraf, faiz, ücretli transfer (BSMV Hariç) ve ters kaydı, ücretsiz transfer.
  const banks = (await must("hesaplar", api.get(`${BANK}/accounts?status=all`))).accounts;
  const other = banks.find(item => item.kind === "demand" && item.id !== d.id);
  await must("bankadan kasaya", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "2.000", date: addDays(today, -8), bankAccountId: d.id, negativeOk: true }));
  await must("kasadan bankaya", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "500", date: addDays(today, -8), bankAccountId: d.id, cashForce: true }));
  await must("masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: d.id, amount: "12,50", feeType: "eft", tax: "bsmv_incl", date: addDays(today, -7), similarOk: true, negativeOk: true }));
  await must("faiz", api.post(`${BANK}/vouchers`, { type: "interest_in", accountId: d.id, amount: "1.000", stoppageRate: "15", date: addDays(today, -7), similarOk: true }));
  const paid = await must("ücretli transfer", api.post(`${BANK}/transfers`, { accountId: d.id, toAccountId: other.id, amount: "3.000", date: addDays(today, -6), feeAmount: "7,50", feeTax: "bsmv_excl", feeType: "eft", channel: "eft", similarOk: true, negativeOk: true }));
  await must("ücretli transfer 2", api.post(`${BANK}/transfers`, { accountId: other.id, toAccountId: d.id, amount: "1.111,11", date: addDays(today, -6), feeAmount: "2", feeTax: "bsmv_incl", feeType: "havale", similarOk: true, negativeOk: true }));
  await must("transfer ters kaydı", api.post(`${BANK}/events/${encodeURIComponent(paid.id)}/reverse`, { reason: "Eşdeğerlik", negativeOk: true }));
  await must("ücretsiz transfer", api.post(`${BANK}/transfers`, { accountId: other.id, toAccountId: d.id, amount: "100", date: today, similarOk: true, negativeOk: true }));
  // Açılışı Düzelt (aynı gün, tutar) ve pasif hesap (hareketli).
  await must("Açılışı Düzelt", api.post(`${BANK}/accounts/${card.id}/opening`, { date: addDays(today, -20), amount: "4.250", confirmed: true }));
  await must("pasif", api.post(`${BANK}/accounts/${loan.id}/status`, { status: "passive" }));
  // Tarihi gelmemiş hesapsız eski satırlar: saat ileri alınır, girilir, geri alınır (eski sürümden kalan ileri tarihli satır).
  ctx.server.clock.set(addDays(today, 25));
  for (const [offset, method, kind, amount] of [[7, "bank", "in", "900"], [12, "card", "in", "75,10"], [22, "bank", "out", "60"]]) await entry({ kind, method, amount, date: addDays(today, offset) });
  ctx.server.clock.set(NOW);
  const firstDay = ctx.store.get("SELECT MIN(date) AS d FROM (SELECT date FROM account_entries UNION ALL SELECT date FROM fin_events UNION ALL SELECT date FROM cash_entries)").d;
  return { ctx, today, firstDay, banks: (await must("hesaplar", api.get(`${BANK}/accounts?status=all`))).accounts };
}

function periods(today, firstDay) {
  return [
    ["varsayılan (Bu Yıl)", {}],
    ["Tüm Zamanlar", { preset: "all" }],
    ["Bu Ay", { preset: "thisMonth" }],
    ["Geçen Ay", { preset: "lastMonth" }],
    ["Son 30 Gün", { preset: "last30" }],
    ["dönem başı = ilk hareket günü", { from: firstDay, to: today }],
    ["ilk günden sonraki gün", { from: addDays(firstDay, 1), to: addDays(today, 30) }],
    ["tek gün (ilk hareket günü)", { from: firstDay, to: firstDay }],
    ["geçmiş dönem", { from: addDays(today, -45), to: addDays(today, -15) }],
    ["yalnız bitiş", { to: addDays(today, -10) }],
    ["boş dönem (2020)", { from: "2020-01-01", to: "2020-12-31" }],
    ["gelecek dönem", { from: addDays(today, 1), to: addDays(today, 40) }],
    ["tanınmayan dönem adı (dönem başı yok)", { preset: "tanimsiz" }],
  ];
}

function reportCases(banks) {
  const out = [];
  for (const bankGroup of ["", "real", "debt", "unassigned", "all"]) out.push(["banka-bakiye", bankGroup ? { bankGroup } : {}]);
  const accounts = ["", ...banks.map(bank => bank.id), "unassigned"];
  for (const bankAccount of accounts) for (const bankMove of ["", "external", "internal"]) out.push(["banka-hareket", { ...(bankAccount ? { bankAccount } : {}), ...(bankMove ? { bankMove } : {}) }]);
  for (const payMethod of ["", "bank", "card"]) out.push(["banka-pos-hareketleri", payMethod ? { payMethod } : {}]);
  out.push(["kasa-hareketleri", {}], ["kasa-gunluk", {}], ["alt-hesap-mizani", {}], ["banka-masraf", {}]);
  return out;
}

async function compareReports(app, label, today, firstDay, banks) {
  const user = adminOf(app);
  const old = oldPath(app);
  let compared = 0;
  let rows = 0;
  for (const [periodName, period] of periods(today, firstDay)) {
    for (const [id, filter] of reportCases(banks)) {
      const query = new URLSearchParams({ ...period, ...filter });
      const tag = `${label} · ${id} ${JSON.stringify(filter)} · ${periodName}`;
      let expected;
      let error = null;
      try {
        expected = plain(await old.center.run(user, id, new URLSearchParams(query)));
      } catch (caught) {
        error = caught;
      }
      if (error) {
        await assert.rejects(() => app.context.reportCenter.run(user, id, new URLSearchParams(query)), { message: error.message }, `${tag}: eski yol hata verdi, yeni de aynı hatayı vermeli`);
        compared += 1;
        continue;
      }
      const actual = plain(await app.context.reportCenter.run(user, id, new URLSearchParams(query)));
      assert.deepStrictEqual(actual, expected, tag);
      compared += 1;
      rows += expected.total;
    }
  }
  return { compared, rows };
}

// Eski rapor döngüsü (2824f22 Banka Bakiye Raporu) — eski sınıflanmış satırlardan anahtar bazında toplam (classifiedTotals'ın kâhini).
function oldBalanceTotals(lines, from, day) {
  const sums = new Map();
  const ahead = { count: 0, cents: 0, first: "" };
  for (const line of lines) {
    const signed = line.kind === "in" ? Number(line.cents) : -Number(line.cents);
    if (!line.ref && line.date > day) {
      ahead.count += 1;
      ahead.cents += signed;
      if (!ahead.first || line.date < ahead.first) ahead.first = line.date;
      continue;
    }
    const key = line.ref || `u:${line.way}`;
    if (!sums.has(key)) sums.set(key, { opening: 0, ext_in: 0, ext_out: 0, tr_in: 0, tr_out: 0, adjust: 0, closing: 0, lines: 0 });
    const b = sums.get(key);
    b.closing += signed;
    b.lines += 1;
    if (from && line.date < from) {
      b.opening += signed;
      continue;
    }
    for (const column of ["ext_in", "ext_out", "tr_in", "tr_out", "adjust"]) b[column] += line[column];
  }
  return { sums: Object.fromEntries([...sums].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), ahead };
}
const newBalanceTotals = items => {
  const sums = {};
  const ahead = { count: 0, cents: 0, first: "" };
  for (const item of items) {
    if (Number(item.ahead) === 1) {
      ahead.count += item.lines;
      ahead.cents += item.closing;
      if (!ahead.first || item.first < ahead.first) ahead.first = item.first;
      continue;
    }
    sums[item.key] = { opening: item.opening, ext_in: item.ext_in, ext_out: item.ext_out, tr_in: item.tr_in, tr_out: item.tr_out, adjust: item.adjust, closing: item.closing, lines: item.lines };
  }
  return { sums: Object.fromEntries(Object.entries(sums).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), ahead };
};
// Eski Banka Hareket Raporu döngüsünün dönem başı: anahtarların ilk görünme sırası ve devirleri (keyTotals'ın kâhini).
function oldBefore(lines, keyOf, from) {
  const order = [];
  const sums = new Map();
  for (const line of lines) {
    if (!(from && line.date < from)) continue;
    const key = keyOf(line);
    if (!sums.has(key)) {
      sums.set(key, { cents: 0, count: 0 });
      order.push(key);
    }
    sums.get(key).cents += line.kind === "in" ? Number(line.cents) : -Number(line.cents);
    sums.get(key).count += 1;
  }
  return order.map(key => ({ key, ...sums.get(key) }));
}

function compareMoney(app, label, today, firstDay, banks) {
  const fresh = app.context.money;
  const old = createOldMoneyLines(app.store);
  let checks = 0;
  const same = (actual, expected, tag) => {
    assert.deepStrictEqual(plain(actual), plain(expected), `${label} · ${tag}`);
    checks += 1;
  };
  const refs = banks.map(bank => bank.id);
  const real = banks.filter(bank => bank.kind !== "card" && bank.kind !== "loan").map(bank => bank.id);
  const dates = [today, firstDay, addDays(today, -30), addDays(today, 10), "9999-12-31"];
  // Satır yolu ve özetler.
  for (const ways of [null, ["cash"], ["bank"], ["card"], ["bank", "card"], ["bank", "card", "ccard", "loan"], ["ccard"], ["loan"], ["cash", "bank", "card"]]) {
    same(fresh.lines({ ways }), old.lines({ ways }), `lines ${ways}`);
    same(fresh.lines({ ways, light: true }), old.lines({ ways, light: true }), `lines light ${ways}`);
    same(fresh.classified({ ways }), old.classified({ ways }), `classified ${ways}`);
    for (const until of ["", today, addDays(today, -15)]) same(fresh.classified({ ways, until, light: true }), old.classified({ ways, until, light: true }), `classified light ${ways} ${until}`);
  }
  for (const ref of ["", ...refs]) {
    same(fresh.lines({ ref }), old.lines({ ref }), `lines ref ${ref}`);
    same(fresh.classified({ ref, until: today }), old.classified({ ref, until: today }), `classified ref ${ref}`);
    same(fresh.refTotal({ ref }), old.refTotal({ ref }), `refTotal ${ref}`);
    for (const after of dates.slice(1, 4)) same(fresh.refTotal({ ref, after }), old.refTotal({ ref, after }), `refTotal ${ref} ${after}`);
    same(fresh.lastDate(ref), old.lastDate(ref), `lastDate ${ref}`);
  }
  for (const method of ["", "cash", "bank", "card", "noncash"]) {
    const ways = method === "" ? null : method === "noncash" ? ["bank", "card"] : [method];
    same(fresh.rows({ ways }), old.rows({ ways }), `rows ${method}`);
  }
  for (const after of dates) same(fresh.rows({ after }), old.rows({ after }), `rows after ${after}`);
  same(fresh.lines({ unbound: true, light: true }), old.lines({ unbound: true, light: true }), "lines unbound");
  same(fresh.groups(), old.groups(), "groups");
  same(fresh.balances(), old.balances(), "balances");
  for (const day of dates) {
    same(fresh.summary(day), old.summary(day), `summary ${day}`);
    // Kasa'nın eksi bakiye denetimi (guardOut) artık yalnız yolun bakiyesini okur: eski tam özetin byMethod / byMethodAt'ıyla aynı.
    const full = old.summary(day);
    for (const way of ["cash", "bank", "card"]) same(fresh.wayBalance(way, day), { all: full.byMethod[way], at: full.byMethodAt[way] }, `wayBalance ${way} ${day}`);
    same(fresh.flows(day), old.flows(day), `flows ${day}`);
    same(fresh.unassigned({ until: day }), old.unassigned({ until: day }), `unassigned until ${day}`);
    same(fresh.unassigned({ after: day }), old.unassigned({ after: day }), `unassigned after ${day}`);
  }
  same(fresh.unassignedWays({}), old.unassignedWays({}), "unassignedWays");
  for (const [from, to] of [["", ""], [firstDay, today], [addDays(today, -30), today], ["2020-01-01", "2020-12-31"], [addDays(today, 1), addDays(today, 40)]]) same(fresh.periodGroups({ from, to }), old.periodGroups({ from, to }), `periodGroups ${from} ${to}`);
  // Yeni toplam yolları = eski satırların eski döngüyle toplanması.
  for (const until of ["", today, addDays(today, 40), addDays(today, -15)]) {
    const lines = old.classified({ ways: ["bank", "card", "ccard", "loan"], until, light: true });
    for (const from of ["", firstDay, addDays(firstDay, 1), addDays(today, -30), today, addDays(today, 5)]) {
      for (const day of [today, addDays(today, 15)]) {
        same(newBalanceTotals(fresh.classifiedTotals({ ways: ["bank", "card", "ccard", "loan"], until, from, day })), oldBalanceTotals(lines, from, day), `classifiedTotals until ${until} from ${from} day ${day}`);
      }
    }
  }
  // Banka Hareket Raporu'nun kaynağı: dönem satırları (since) ve dönem başı devri (keyTotals) = eski satırlar.
  const scopes = [
    ["tüm Gerçek Banka", { ways: ["bank"], refs: real }, { ways: ["bank"] }, line => line.ref && real.includes(line.ref), line => line.ref],
    ["Hesabı Atanmamış", { ways: ["bank", "card"], unbound: true }, { ways: ["bank", "card"] }, line => !line.ref, line => `u:${line.way}`],
    ...refs.map(ref => [`hesap ${ref}`, { ref }, { ref }, () => true, line => line.ref]),
  ];
  for (const [name, scope, oldScope, keep, keyOf] of scopes) {
    for (const until of [today, addDays(today, 40), addDays(today, -15)]) {
      const lines = old.classified({ ...oldScope, until }).filter(keep);
      for (const from of ["", firstDay, addDays(firstDay, 1), addDays(today, -30), addDays(today, -6), today]) {
        same(fresh.classified({ ...scope, since: from, until }).filter(keep), lines.filter(line => !from || line.date >= from), `${name} dönem satırları ${from}–${until}`);
        same(from ? fresh.keyTotals({ ...scope, before: from, until }) : [], oldBefore(lines, keyOf, from), `${name} devir ${from}–${until}`);
      }
    }
  }
  return checks;
}

async function compareSearch(ctx, label) {
  const app = ctx.app;
  const user = adminOf(app);
  const names = ctx.store.all("SELECT name, phone FROM accounts WHERE deleted_at IS NULL ORDER BY rowid LIMIT 40");
  const queries = ["", "a", "ı", "Ö", "ltd", "xyz-yok", "0532", ...names.slice(0, 8).map(row => row.name.slice(0, 3)), ...names.slice(0, 4).map(row => row.name), ...names.filter(row => row.phone).slice(0, 2).map(row => String(row.phone).replace(/\D/g, "").slice(-4))];
  let checks = 0;
  for (const q of queries) {
    for (const type of ["", "customer", "supplier"]) {
      for (const prefer of ["", "supplier", "customer"]) {
        // Eski uç (2824f22): bütün carilerin listesi (bakiyeleriyle) → tür önceliği → ilk 20.
        const data = app.context.accounts.list(user, { q, status: "all", type });
        if (prefer) data.accounts.sort((a, b) => Number(b.type === prefer) - Number(a.type === prefer));
        const expected = data.accounts.slice(0, 20).map(item => ({ id: item.id, refNo: item.refNo, name: item.name, phone: item.phone, type: item.type, registeredOn: item.registeredOn || "", groupId: item.groupId || "", subgroupId: item.subgroupId || "", groupName: item.groupName, subgroupName: item.subgroupName, balance: item.balance, status: item.status, caseKey: item.caseKey || "", caseSource: item.caseSource || "", caseTitle: item.caseTitle || "" }));
        const params = new URLSearchParams({ q, ...(type ? { type } : {}), ...(prefer ? { prefer } : {}) });
        const actual = await must(`arama ${params}`, ctx.api.get(`/api/workspace/accounts/search?${params}`));
        assert.deepStrictEqual(plain(actual), plain(expected), `${label} · cari arama ${params}`);
        checks += 1;
      }
    }
  }
  return checks;
}

for (const [seedNo, operations] of [[21, 300], [22, 300]]) {
  describe(`hız düzeltmesi eşdeğerliği — tohum ${seedNo} (${operations} motor işlemi + elle banka işlemleri)`, () => {
    let data;
    before(async () => {
      data = await seed(seedNo, operations);
    });
    after(() => data?.ctx.server.close());

    it("veri kapsamı: sınıflamanın bütün kolları ve süzgeçlerin bütün seçenekleri veride var (karşılaştırma boşa çalışmaz)", () => {
      const store = data.ctx.store;
      const types = new Set(store.all("SELECT DISTINCT type FROM fin_events").map(row => row.type));
      for (const type of ["opening", "carry_close", "legacy_reclass", "reversal", "transfer", "cash_transfer", "loan_draw", "loan_repay", "card_payment", "fee", "interest_in"]) assert.ok(types.has(type), `işlem türü ${type} yok: ${[...types].join(", ")}`);
      const reversedTypes = new Set(store.all("SELECT DISTINCT o.type FROM fin_events r JOIN fin_events o ON o.id = r.reversal_of WHERE r.type = 'reversal'").map(row => row.type));
      assert.ok(reversedTypes.has("transfer"), `ters kaydı olan transfer yok: ${[...reversedTypes]}`);
      assert.ok(reversedTypes.has("opening"), `ters kaydı olan açılış (Açılışı Düzelt) yok: ${[...reversedTypes]}`);
      const kinds = new Set(data.banks.map(bank => bank.kind));
      for (const kind of ["demand", "card", "loan"]) assert.ok(kinds.has(kind), `hesap türü ${kind} yok`);
      assert.ok(data.banks.some(bank => bank.status === "passive"), "pasif hesap yok");
      const money = data.ctx.app.context.money;
      const rows = money.classified({ ways: ["bank", "card", "ccard", "loan"] });
      assert.ok(rows.some(row => row.adjust !== 0), "düzeltme payı (açılış / Devir / aktarma) olan satır yok");
      assert.ok(rows.some(row => row.tr_in > 0) && rows.some(row => row.tr_out > 0), "iç hareket (transfer) payı yok");
      assert.ok(rows.some(row => row.tr_out > 0 && row.ext_out > 0), "gider payı (transfer ücreti) olan iç hareket çıkışı yok");
      assert.ok(rows.some(row => row.tr_in > 0 && row.ext_in > 0), "ters kaydında gider payı (dış giriş) olan iç hareket girişi yok");
      assert.ok(rows.some(row => row.ext_in > 0 && row.src !== 9) && rows.some(row => row.ext_out > 0 && row.src === 9), "dış giriş/çıkış (modül + fiş) yok");
      assert.ok(rows.some(row => !row.ref && row.date > data.today), "tarihi gelmemiş hesapsız satır yok");
      assert.ok(rows.some(row => !row.ref && row.date <= data.today && row.way === "bank") && rows.some(row => !row.ref && row.way === "card"), "hesapsız havale ve POS yok");
      assert.ok(rows.some(row => row.way === "ccard") && rows.some(row => row.way === "loan"), "kurumsal kart ve kredi satırı yok");
      // Aynı gün başlayan iki hesap (devir sırası eşitliği): motorun iki vadesiz hesabı aynı gün açılır.
      const firsts = store.all("SELECT bank_ref AS ref, MIN(date) AS d FROM fin_events WHERE type = 'opening' GROUP BY bank_ref");
      assert.ok(new Set(firsts.map(row => row.d)).size < firsts.length, "aynı gün açılan iki hesap yok");
    });

    it("Rapor Merkezi: banka/Kasa raporları × her süzgeç × dönemler — eski ve yeni çıktı birebir (bugün)", async () => {
      const result = await compareReports(data.ctx.app, `tohum ${seedNo} bugün`, data.today, data.firstDay, data.banks);
      assert.ok(result.compared >= 13 * 30, `karşılaştırma sayısı ${result.compared}`);
      assert.ok(result.rows > 1000, `karşılaştırılan satır ${result.rows}`);
    });

    it("moneyLines okuma uçları ve yeni toplam yolları — eski ile aynı (bugün)", () => {
      const checks = compareMoney(data.ctx.app, `tohum ${seedNo} bugün`, data.today, data.firstDay, data.banks);
      assert.ok(checks > 200, `denetim sayısı ${checks}`);
    });

    it("cari arama — ilk 20 (Cari No sırası, tür önceliği, bakiye) eski uçla aynı", async () => {
      const checks = await compareSearch(data.ctx, `tohum ${seedNo}`);
      assert.ok(checks >= 100, `denetim sayısı ${checks}`);
    });

    it("saat ileri (tarihi gelmemiş hesapsız satırların bir kısmının tarihi geldi): raporlar ve okuma uçları yine birebir", async () => {
      data.ctx.server.clock.set(LATER);
      const later = (await must("bugün", data.ctx.api.get("/api/workspace/ledger/lock"))).today;
      assert.equal(later, "2026-10-23");
      const result = await compareReports(data.ctx.app, `tohum ${seedNo} +15 gün`, later, data.firstDay, data.banks);
      assert.ok(result.compared >= 13 * 30);
      compareMoney(data.ctx.app, `tohum ${seedNo} +15 gün`, later, data.firstDay, data.banks);
      data.ctx.server.clock.set(NOW);
    });
  });
}
