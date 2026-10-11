// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2): hesap kartı kuralları.
//
// Bulgular (doğrulandı):
//   - (orta) Kurumsal Kredi Kartı ve Kredi Hesabı'nda açılış borcu EKSİ dönüyordu (−5.000); Açılışı Düzelt formu eksi ön değerle açılıp "eksi
//     olamaz" diyordu; değişiklik yokken de ters kayıt + yeni açılış yazılıyordu. Kural: kart/kredide açılıştaki borç ARTI (girildiği gibi);
//     değişmeyen açılış yeni olay yazmaz; tutar değişince tek ters kayıt + yeni açılış.
//   - (düşük) Sıfır (satırsız) açılışlı hesaba "Açılış Bakiyesi Gir" bank.cancel istiyordu (403) — ters kaydedilecek para yok; aynı kişi hesabı
//     silip açılışla yeniden açabiliyordu. Kural: satırsız açılışın yerine ilk açılış bank.cancel istemez; satırlı açılışın düzeltmesi ister.
//   - (düşük) Planlı işlemi olan hesap silinebiliyor, plan sahipsiz kalıyordu (rozet sayıyor, Gerçekleştir 404). Kural: 409 bank-account-has-plans.
//   - (düşük) Rozet ve Genel Bakış'taki "Hesabı Belirsiz Yeni Hareket" sayısı satırlar atandıktan sonra düşmüyordu (yalnız yeniden açılışta).
//     Kural: onarımın bulduğu satırlardan hâlâ hesaba bağlanmamış olanlar canlı sayılır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOk } from "./banka-210-ortak.mjs";
import { BANK, NOW, bootBank, expectStatus, must, openAccount, subBalances } from "./banka-210-hesap-ortak.mjs";

const eventCount = store => store.get("SELECT COUNT(*) AS n FROM fin_events").n;

describe("GG2 — kart ve kredide açılış borcu artı; Açılışı Düzelt değişmeyen açılışı yeniden yazmaz", () => {
  let ctx;
  let card;
  let loan;
  before(async () => {
    ctx = await bootBank();
    card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
    loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("hesap kartında açılıştaki borç girildiği gibi artı (5.000 / 10.000); bakiye borç yönünde (309/300 alacak)", async () => {
    const view = await must("kart", ctx.api.get(`${BANK}/accounts/${card.id}`));
    assert.equal(view.opening.amountMinor, 500_000);
    assert.equal(view.opening.tryMinor, 500_000);
    assert.equal(view.balanceMinor, -500_000, "kart borcu bakiyede eksi (bankanın alacağı)");
    const credit = await must("kredi", ctx.api.get(`${BANK}/accounts/${loan.id}`));
    assert.equal(credit.opening.amountMinor, 1_000_000);
    const subs = await subBalances(ctx.api);
    assert.equal(subs[card.glSub].balance, -5000);
    assert.equal(subs[loan.glSub].balance, -10000);
  });

  it("formun ön değeriyle (5.000) yalnız Bakiye Doğrulandı gönderilince 200 ve yeni olay yok; tutar değişince tek ters kayıt + yeni açılış", async () => {
    const before = eventCount(ctx.store);
    const same = await must("aynı açılış", ctx.api.post(`${BANK}/accounts/${card.id}/opening`, { date: "2026-10-01", amount: "5.000", confirmed: true }));
    assert.equal(same.reversed, null);
    assert.equal(eventCount(ctx.store), before, "değişiklik yokken olay yazılmaz");
    const changed = await must("yeni tutar", ctx.api.post(`${BANK}/accounts/${card.id}/opening`, { date: "2026-10-01", amount: "6.000", confirmed: true }));
    assert.ok(changed.reversed, "eski açılış ters kaydedildi");
    assert.equal(eventCount(ctx.store), before + 2, "ters kayıt + yeni açılış");
    assert.equal(changed.account.opening.amountMinor, 600_000);
    const subs = await subBalances(ctx.api);
    assert.equal(subs[card.glSub].balance, -6000);
    const sameLoan = eventCount(ctx.store);
    await must("kredi aynı", ctx.api.post(`${BANK}/accounts/${loan.id}/opening`, { date: "2026-10-01", amount: "10.000", confirmed: true }));
    assert.equal(eventCount(ctx.store), sameLoan);
    await integrityOk(ctx.api, "açılış düzeltmelerinden sonra");
  });
});

describe("GG2 — sıfır açılışa ilk açılış bank.cancel istemez; planlı işlemi olan hesap silinmez", () => {
  let ctx;
  let accountant;
  before(async () => {
    ctx = await bootBank();
    accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe1");
    const res = await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.cancel"] } });
    assert.equal(res.status, 200);
  });
  after(() => ctx.server.close());

  it("bank.cancel'siz muhasebe: sıfır açılışlı hesaba Açılış Bakiyesi Gir 200; satırlı açılışı düzeltmek 403", async () => {
    const own = await must("hesap (açılış 0)", accountant.post(`${BANK}/accounts`, { bankName: "QNB", name: "Muhasebe Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "0" } }));
    assert.equal(own.opening.hasLines, false);
    const enter = await accountant.post(`${BANK}/accounts/${own.id}/opening`, { date: "2026-10-01", amount: "25.000", confirmed: true });
    expectStatus(enter, 200, "", "ilk açılış");
    assert.equal(enter.data.account.opening.amountMinor, 2_500_000);
    assert.equal(enter.data.account.opening.hasLines, true);
    const fix = await accountant.post(`${BANK}/accounts/${own.id}/opening`, { date: "2026-10-01", amount: "26.000", confirmed: true });
    expectStatus(fix, 403, "", "satırlı açılışı düzelt");
  });

  it("planlı işlemi olan hesap silinmez (409 bank-account-has-plans); plan silinince silinir; rozet sahipsiz plan saymaz", async () => {
    const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Planlı", kind: "demand", opening: { date: "2026-10-01", amount: "0" } });
    const plan = await must("plan", ctx.api.post(`${BANK}/plans`, { type: "fee", accountId: account.id, amount: "25", feeType: "eft", tax: "none", plannedDate: "2026-10-05", repeat: "monthly" }));
    assert.equal((await must("rozet", ctx.api.get(`${BANK}/badge`))).count, 1);
    const del = await ctx.api.del(`${BANK}/accounts/${account.id}`);
    expectStatus(del, 409, "bank-account-has-plans", "planlı hesabı sil");
    const view = await must("hesap", ctx.api.get(`${BANK}/accounts/${account.id}`));
    assert.equal(view.deletable, false);
    assert.equal(view.plannedCount, 1);
    await must("planı sil", ctx.api.del(`${BANK}/plans/${plan.id}`));
    await must("hesabı sil", ctx.api.del(`${BANK}/accounts/${account.id}`));
    assert.equal((await must("rozet", ctx.api.get(`${BANK}/badge`))).count, 0);
  });
});

describe("GG2 — Hesabı Belirsiz Yeni Hareketler canlı sayılır (rozet atamadan sonra düşer)", () => {
  let server;
  let api;
  let dataDir;
  let account;
  let id;
  const boot = async () => {
    server = await startTestServer({ dataDir, now: NOW });
    api = apiOf(await loginAdmin(server));
  };
  before(async () => {
    dataDir = path.join(mkdtempSync(path.join(tmpdir(), "gg2-rozet-")), "data");
    await boot();
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    await must("havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.000", method: "bank", date: "2026-10-02" }));
    await server.close();
    // Eski sürüm (2.0.26) gibi: olaysız havale satırı doğrudan dosyaya.
    const db = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
    const row = db.prepare("SELECT * FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1").get(party.id);
    id = `aentry-${randomUUID()}`;
    const cols = Object.keys(row);
    const values = cols.map(c => (c === "id" ? id : c === "event_id" ? "" : c === "fin_ref" ? "" : c === "date" ? "2026-10-05" : c === "created_at" ? new Date().toISOString() : row[c]));
    db.prepare(`INSERT INTO account_entries (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...values);
    db.close();
    await boot();
  });
  after(() => server.close());

  it("onarımdan sonra rozet 1; Bu Hesaba Ata → rozet ve Genel Bakış 0 (sunucu yeniden açılmadan)", async () => {
    assert.equal((await must("rozet", api.get(`${BANK}/badge`))).count, 1);
    assert.equal((await must("özet", api.get(`${BANK}/summary`))).unassigned.newCount, 1);
    await must("ata", api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: [{ table: "account_entries", id }] }));
    assert.equal((await must("rozet", api.get(`${BANK}/badge`))).count, 0);
    assert.equal((await must("özet", api.get(`${BANK}/summary`))).unassigned.newCount, 0);
    assert.equal((await must("eski", api.get(`${BANK}/legacy`))).newCount, 0);
  });
});
