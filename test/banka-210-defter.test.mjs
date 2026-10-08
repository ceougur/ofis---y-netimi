// 2.1.0 — Aşama 2, Dilim 4: Ana Defter — moneyAccount (yol + hesap → ana/alt hesap), alt hesap bakiyeleri, hesap planı eklemeleri
// (docs/BANKA-MODULU-PLAN.md §3.11).
//
// ÇALIŞIYOR MU:
//  - moneyAccount(yol, hesap): nakit → 100; havale → 102 (hesabın alt hesabı, hesapsız 102.00 "Hesabı Atanmamış Eski Hareketler");
//    POS → 108 (POS'un alt hesabı, hesapsız 108.00); kurumsal kartla ödeme → 309 (kartın alt hesabı); tanınmayan yol → 100 (2.0.26'nın
//    yevmiyesiyle aynı: mizan değişmez).
//  - Yevmiye satırları alt hesabı taşır; Kasa ↔ Banka transferinin banka bacağının hesabı ikiz satırdan okunur; Banka Fişi
//    (bank_lines) kendi THP kodu ve alt hesabıyla madde olur.
//  - subBalances / subTrial: Σ alt hesap = ana hesap (102 = Σ102.*); dönem süzgeci mizanla aynı.
//  - Hesap planı: 300, 309, 642, 646, 653, 656, 659, 780 eklenir; 649'un adı "Diğer Olağan Gelir ve Kârlar"; tutarlar değişmez.
//  - 300/309 beklenenleri (mutabakat satırı) yalnız kullanıldığında: banka kullanmayan kurulumun Defter Mutabakatı aynı kalır.
// NASIL BOZARIM:
//  1. Havale satırı hesaba bağlıyken yevmiye onu 102.00'a yazarsa alt hesap bakiyesi Σ ≠ ana hesap → subBalances testi kırılır.
//  2. Transferin banka bacağı ikiz okunmadan yazılırsa (nakit bacağının boş fin_ref'i) 102.01 eksik kalır.
//  3. Tanınmayan yol 100 dışına yazılırsa 2.0.26 verisinin mizanı değişir (K11).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, insertBankAccount, insertPos, integrityOk, localDay, must, rawGet, rawRun } from "./banka-210-ortak.mjs";

const TODAY = localDay(0);
const ledgerLib = () => import("../server/lib/general-ledger.mjs");
const REFS = {
  accounts: { "acc-102": { kind: "demand", gl: "102", glSub: "102.01" }, "acc-309": { kind: "card", gl: "309", glSub: "309.01" }, "acc-300": { kind: "loan", gl: "300", glSub: "300.01" } },
  pos: { "pos-1": { glSub: "108.01" } },
};

describe("Ana Defter — moneyAccount ve alt hesaplar (birim)", () => {
  it("moneyAccount: yol + hesap → { ana hesap, alt hesap }", async () => {
    const { moneyAccount } = await ledgerLib();
    assert.equal(typeof moneyAccount, "function", "moneyAccount yok");
    assert.deepEqual(moneyAccount("cash", "", REFS), { account: "100", sub: "" });
    assert.deepEqual(moneyAccount("bank", "", REFS), { account: "102", sub: "102.00" });
    assert.deepEqual(moneyAccount("bank", "acc-102", REFS), { account: "102", sub: "102.01" });
    assert.deepEqual(moneyAccount("card", "", REFS), { account: "108", sub: "108.00" });
    assert.deepEqual(moneyAccount("card", "pos-1", REFS), { account: "108", sub: "108.01" });
    assert.deepEqual(moneyAccount("card", "acc-309", REFS), { account: "309", sub: "309.01" });
    assert.deepEqual(moneyAccount("bitcoin", "", REFS), { account: "100", sub: "" }, "tanınmayan yol 2.0.26'daki gibi 100 (mizan değişmez)");
  });

  it("journal: satırlar alt hesabı taşır; transferin banka bacağı ikizden; Banka Fişi kendi koduyla; Σ alt hesap = ana hesap", async () => {
    const { journal, subBalances, subTrial, trialBalance } = await ledgerLib();
    const entries = journal({
      payments: [{ id: "p1", amount: 300, date: "2026-10-01", note: "", method: "card", ref: "pos-1" }],
      cashEntries: [
        { id: "c1", kind: "out", amount: 2000, date: "2026-10-02", description: "Yatırma", method: "cash", transferId: "t1", ref: "", bankRef: "acc-102" },
        { id: "c2", kind: "in", amount: 2000, date: "2026-10-02", description: "Yatırma", method: "bank", transferId: "t1", ref: "acc-102" },
      ],
      accountEntries: [
        { id: "a1", kind: "in", amount: 1500, date: "2026-10-03", note: "", source: "", method: "bank", accountType: "customer", party: "cari-1", ref: "acc-102" },
        { id: "a2", kind: "in", amount: 100, date: "2026-10-03", note: "", source: "", method: "bank", accountType: "customer", party: "cari-1", ref: "" },
        { id: "a3", kind: "out", amount: 180, date: "2026-10-04", note: "", source: "", method: "card", accountType: "supplier", party: "cari-2", ref: "acc-309" },
      ],
      bankLines: [
        { eventId: "ev-1", no: "BNK-2026-000001", date: "2026-10-05", description: "Faiz", seq: 1, gl: "102", sub: "102.01", side: "D", tryMinor: 85000 },
        { eventId: "ev-1", no: "BNK-2026-000001", date: "2026-10-05", description: "Faiz", seq: 2, gl: "193", sub: "", side: "D", tryMinor: 15000 },
        { eventId: "ev-1", no: "BNK-2026-000001", date: "2026-10-05", description: "Faiz", seq: 3, gl: "642", sub: "", side: "C", tryMinor: 100000 },
      ],
      refs: REFS,
    });
    const transfer = entries.find(entry => entry.id === "transfer:t1");
    assert.deepEqual(transfer.lines.map(line => [line.account, line.sub || "", line.debit, line.credit]), [["102", "102.01", 200000, 0], ["100", "", 0, 200000]], "banka bacağı 102.01 (ikizin hesabı)");
    const fis = entries.find(entry => entry.id === "bank:ev-1");
    assert.ok(fis, "Banka Fişi yevmiye maddesi");
    assert.deepEqual(fis.lines.map(line => [line.account, line.sub || "", line.debit, line.credit]), [["102", "102.01", 85000, 0], ["193", "", 15000, 0], ["642", "", 0, 100000]]);
    const subs = subBalances(entries);
    assert.equal(subs.get("102.01"), 200000 + 150000 + 85000);
    assert.equal(subs.get("102.00"), 10000);
    assert.equal(subs.get("108.01"), 30000);
    assert.equal(subs.get("309.01"), -18000);
    const trial = trialBalance(entries);
    const balance = code => Math.round((trial.accounts.find(row => row.code === code)?.balance || 0) * 100);
    for (const code of ["102", "108", "309"]) {
      const total = [...subs].filter(([sub]) => sub.startsWith(`${code}.`)).reduce((sum, [, value]) => sum + value, 0);
      assert.equal(total, balance(code), `Σ ${code}.* = ${code}`);
    }
    const sub = subTrial(entries, { from: "2026-10-03" });
    const row = sub.find(item => item.sub === "102.01");
    assert.deepEqual([row.account, Math.round(row.opening * 100), Math.round(row.debit * 100), Math.round(row.balance * 100)], ["102", 200000, 235000, 435000], "alt hesap mizanı: devir + dönem");
  });

  it("hesap planı: yeni hesaplar ve 649'un adı", async () => {
    const { CHART } = await ledgerLib();
    for (const code of ["300", "309", "642", "646", "653", "656", "659", "780"]) assert.ok(CHART[code], `${code} hesap planında yok`);
    assert.equal(CHART[649], "Diğer Olağan Gelir ve Kârlar");
    assert.equal(CHART[102], "Bankalar (Havale / EFT)", "102 adı değişmez");
    assert.equal(CHART[108], "Kredi Kartı Tahsilatları (POS)", "108 adı değişmez");
  });
});

describe("Ana Defter — uçtan uca (gerçek veri)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("banka kullanmayan kurulum: mizan tutarları ve Defter Mutabakatı satırları 300/309 olmadan (2.0.26 ile aynı liste)", async () => {
    const { api } = ctx;
    await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "5.000", date: TODAY, description: "Elle giriş" }));
    await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "1.000", date: TODAY }));
    const ledger = await must("Ana Defter", api.get("/api/workspace/ledger"));
    const codes = ledger.reconciliation.checks.map(item => item.code);
    assert.ok(!codes.includes("300") && !codes.includes("309"), `kullanılmayan 300/309 mutabakat satırı açılmaz: ${codes}`);
    const row649 = ledger.trial.accounts.find(row => row.code === "649");
    assert.equal(row649?.name, "Diğer Olağan Gelir ve Kârlar");
    assert.equal(row649?.balance, -5000, "649'un tutarı değişmez");
    await integrityOk(api, "banka kullanmayan kurulum");
  });

  it("transferin banka bacağı hesaba bağlanınca 102.01'e yazılır (ikizden); Σ102.* = 102; mutabakat tutar", async () => {
    const { api, db, app } = ctx;
    insertBankAccount(db, { id: "acc-102", code: "ZRT-TL", kind: "demand", glSub: "102.01" });
    insertPos(db, { id: "pos-1", code: "POS-1", glSub: "108.01", bankAccountId: "acc-102" });
    const transfer = await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "750", date: TODAY }));
    const eventId = rawGet(db, "SELECT event_id AS e FROM cash_entries WHERE id = ?", transfer.bankId).e;
    rawRun(db, "UPDATE cash_entries SET fin_ref = 'acc-102' WHERE id = ?", transfer.bankId);
    rawRun(db, "UPDATE fin_events SET bank_ref = 'acc-102' WHERE id = ?", eventId);
    app.integrity.start();
    const { subBalances, trialBalance } = await ledgerLib();
    const entries = app.ledger.build();
    const line = entries.find(entry => entry.id === `transfer:${transfer.transferId}`).lines.find(item => item.account === "102");
    assert.equal(line.sub, "102.01", "banka bacağının hesabı ikizden okunur");
    const subs = subBalances(entries);
    assert.equal(subs.get("102.01"), 75000);
    const total = [...subs].filter(([sub]) => sub.startsWith("102.")).reduce((sum, [, value]) => sum + value, 0);
    assert.equal(total, Math.round(trialBalance(entries).accounts.find(row => row.code === "102").balance * 100), "Σ102.* = 102");
    await integrityOk(api, "hesaba bağlı transfer");
  });
});
