// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2): büyük veride Banka penceresi ve kapı.
//
// Bulgular (doğrulandı):
//   - (yüksek) 1.000.000 harekette Genel Bakış, rozet, Hesaplar ~4 sn, Alt Hesap Mizanı ~40 sn, Hesabı Atanmamış ~60–78 sn, sihirbaz önizlemesi
//     ~106 sn sürüyor; sunucu tek iş parçacığında olduğu için o sürede bütün kullanıcılar (bütün şirketler) bekliyordu. Düzeltme: Genel Bakış ve
//     Hesaplar her hesabın saklanan toplamından (refTotal) ve bağsız satırların kısmi indeksinden okur (bütün para satırları gruplanmaz); Alt
//     Hesap Mizanı Ana Defter'i kurmaz (tüm zamanlar saklanan toplamlardan, dönem tek geçişte); Hesabı Atanmamış ve sihirbaz bağsız satırların
//     indeksini kullanır (GG2'nin önceki parçası). Ölçüm: tools/banka-hareket-olcum.mjs (KANIT).
//   - (orta) Hareketsiz hesabın türü değişince (Vadesiz → Ticari) tam mutabakat kapısı koşuyordu (100.000 satırda ~10 sn). Düzeltme: hesaba
//     bağlı satır yoksa karar süzgeçte kalır.
//   - (orta) Ölçüm aracı yeni olay kimliği biçimini tanımıyordu (ilk kopyada UNIQUE hatası). Düzeltme + küçük hacimli koşu burada (biçim
//     değişirse kırılır).
// ÇALIŞIYOR MU: yeni Alt Hesap Mizanı = Ana Defter'den kurulan alt hesap mizanı (tüm zamanlar ve dönem); yeni Genel Bakış = bütün para
// satırlarının gruplanmasıyla bulunan değerler (rastgele mutabakat motoru verisi + kart, kredi ve bağsız eski satırlar).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { subTrial, trialBalance } from "../server/lib/general-ledger.mjs";
import { loginAdmin } from "./helpers.mjs";
import { runReconciliation } from "./mutabakat/motor.mjs";
import { BANK, boot, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-10-08T12:00:00+03:00";

/** Ana Defter'den (eski yol) alt hesap mizanı: { rows, mains } — yeni uçla karşılaştırılır. */
function fromLedger(app, { from = "", to = "" } = {}) {
  const entries = app.context.ledger.build();
  const rows = subTrial(entries, { from, to }).map(row => ({ sub: row.sub, account: row.account, opening: row.opening, debit: row.debit, credit: row.credit, balance: row.balance }));
  const trial = trialBalance(entries, { from, to });
  const mains = ["102", "108", "300", "309"].map(code => ({ account: code, balance: trial.accounts.find(row => row.code === code)?.balance || 0 })).filter(item => item.balance);
  return { rows, mains };
}
const strip = data => ({ rows: data.rows.map(row => ({ sub: row.sub, account: row.account, opening: row.opening, debit: row.debit, credit: row.credit, balance: row.balance })), mains: data.mains.map(item => ({ account: item.account, balance: item.balance })).filter(item => item.balance) });

describe("GG2 — Alt Hesap Mizanı ve Genel Bakış tek kaynaktan (Ana Defter kurulmadan) = eski yol", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW });
    const report = await runReconciliation({ client: await loginAdmin(ctx.server), seed: 9, operations: 250, verifyEvery: 50, burst: 0 });
    assert.deepEqual(report.mismatches.slice(0, 3), [], "motor tutarlı");
    const api = ctx.api;
    // Kart, kredi ve hesabı atanmamış eski satırlar (102.00 / 108.00) da olsun.
    const bank = (await must("hesaplar", api.get(`${BANK}/accounts`))).accounts.find(item => item.kind === "demand");
    const card = await openAccount(api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-08-01", amount: "1.500", confirmed: true } });
    const loan = await openAccount(api, { bankName: "Garanti BBVA", name: "Kredi", kind: "loan", opening: { date: "2026-08-01", amount: "0" } });
    await must("kredi", api.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: bank.id, loanAccountId: loan.id, amount: "20.000", date: "2026-09-10", similarOk: true }));
    await must("kart ödemesi", api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: bank.id, cardAccountId: card.id, amount: "700", date: "2026-09-12", similarOk: true, negativeOk: true }));
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-01-01" }));
    await must("eski havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "3.210,55", method: "bank", date: "2026-07-03" }));
    await must("eski POS", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.111,11", method: "card", date: "2026-07-04" }));
  });
  after(() => ctx.server.close());

  it("tüm zamanlar ve üç dönem: alt hesaplar, borç/alacak/bakiye ve ana hesaplar Ana Defter'le kuruşu kuruşuna aynı", async () => {
    for (const range of [{}, { from: "2026-09-01", to: "2026-09-30" }, { from: "2026-07-01" }, { to: "2026-08-15" }]) {
      const query = new URLSearchParams(range).toString();
      const data = await must(`alt mizan ${query}`, ctx.api.get(`${BANK}/sub-trial${query ? `?${query}` : ""}`));
      assert.deepEqual(strip(data), fromLedger(ctx.app, range), `dönem ${query || "tüm zamanlar"}`);
      assert.ok(data.mains.every(item => item.ok), JSON.stringify(data.mains));
    }
    const all = await must("alt mizan", ctx.api.get(`${BANK}/sub-trial`));
    assert.ok(all.rows.some(row => row.sub === "102.00") && all.rows.some(row => row.sub === "108.00"), "bağsız eski satırlar 102.00 / 108.00");
    assert.ok(all.rows.some(row => row.account === "309") && all.rows.some(row => row.account === "300"), "kart ve kredi alt hesapları");
  });

  it("Genel Bakış ve Hesaplar: bütün para satırlarının gruplanmasıyla bulunan değerlerle aynı", async () => {
    const money = ctx.app.context.money;
    const kindOf = new Map(ctx.store.all("SELECT id, kind FROM bank_accounts").map(row => [row.id, row.kind]));
    let realBank = 0;
    let card = 0;
    let loan = 0;
    let looseBank = 0;
    let looseCard = 0;
    const perAccount = new Map();
    for (const group of money.groups()) {
      const cents = Number(group.cents);
      if (group.ref) perAccount.set(group.ref, (perAccount.get(group.ref) || 0) + cents);
      if (group.way === "bank" && group.ref && !["card", "loan"].includes(kindOf.get(group.ref))) realBank += cents;
      else if (group.way === "bank" && !group.ref) looseBank += cents;
      else if (group.way === "card" && !group.ref) looseCard += cents;
      else if (group.way === "ccard") card -= cents;
      else if (group.way === "loan") loan -= cents;
    }
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.deepEqual([summary.realBank.minor, summary.debt.cardMinor, summary.debt.loanMinor, summary.unassigned.bankMinor, summary.unassigned.cardMinor], [realBank, card, loan, looseBank, looseCard]);
    const list = await must("hesaplar", ctx.api.get(`${BANK}/accounts?status=all`));
    for (const account of list.accounts) assert.equal(account.balanceMinor, perAccount.get(account.id) || 0, account.label);
    assert.equal(list.totals.realBankMinor, realBank);
  });
});

describe("GG2 — hareketsiz hesabın türü değişince kapı süzgeçte kalır", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW, gateVerify: false, moneyStrict: false });
  });
  after(() => ctx.server.close());

  it("Vadesiz → Ticari (satırsız açılış): süzgeç yolu; hareketli hesapta tür değişmez (409)", async () => {
    const empty = await openAccount(ctx.api, { bankName: "QNB", name: "Boş", kind: "demand", opening: { date: "2026-10-01", amount: "0" } });
    await must("tür", ctx.api.put(`${BANK}/accounts/${empty.id}`, { kind: "commercial" }));
    const gate = ctx.app.integrity.stats().gate;
    assert.equal(gate.path, "scoped", `kapı yolu: ${gate.reason || ""}`);
    const used = await openAccount(ctx.api, { bankName: "QNB", name: "Dolu", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    expectStatus(await ctx.api.put(`${BANK}/accounts/${used.id}`, { kind: "commercial" }), 409, "bank-account-has-movements", "hareketli hesap");
  });
});

describe("GG2 — ölçüm aracı yeni olay kimliğiyle çalışır (küçük hacim)", () => {
  it("tools/banka-hareket-olcum.mjs --hedef 3000 --gun 15 --tekrar 1: hatasız biter, Banka penceresinin bütün uçlarını ölçer", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gg2-olcum-"));
    try {
      const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(ROOT, "tools", "banka-hareket-olcum.mjs"), "--hedef", "3000", "--gun", "15", "--tekrar", "1", "--klasor", dir], { encoding: "utf8", timeout: 300_000 });
      assert.equal(run.status, 0, `${run.stdout.slice(-1500)}\n${run.stderr.slice(-1500)}`);
      for (const label of ["Hareketler ilk sayfa", "Genel Bakış (özet)", "Hesaplar listesi", "Hesabı Atanmamış Eski Hareketler", "Alt Hesap Mizanı (tüm zamanlar)", "Kurulum Sihirbazı önizlemesi", "Başka kullanıcı bekler", "Kayıttan hemen sonra Genel Bakış"]) {
        assert.ok(run.stdout.includes(label), `ölçüm satırı: ${label}`);
      }
      assert.match(run.stdout, /Ziraat [\d.]+ olay/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
