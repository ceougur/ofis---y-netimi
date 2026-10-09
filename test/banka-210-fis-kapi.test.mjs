// 2.1.0 — Aşama 4, dilim 3: Banka Fişi'nin kapı denetimleri ve statik denetimi (docs/BANKA-MODULU-PLAN.md §3.7 "Banka Fişi kuralı",
// §3.11 bank:voucher / bank:event, §11.2 "191/193 tuzağı").
//
// ÇALIŞIYOR MU: fiş kurucularının (masraf her vergi kipinde, faiz, diğer, kart, kredi) ürettiği her satır kümesi dengeli ve beyaz listede; hiçbir
//   kurucu 100, 101, 103, 120, 127, 191, 320, 336, 360, 391'e satır yazmaz (rastgele tutarlarla özellik testi).
// NASIL BOZARIM (uçlar atlanarak, bank.post'un İÇİNDEN ham yazımla — kapı yakalamalı, hiçbir satır yazılmamalı):
//   - Fişle 320 / 127 / 336 / 100'e satır → 409 bank:voucher.
//   - Para satırı olayın hesabı ya da karşı hesabı dışındaki bir hesaba (bank_ref = Ziraat, satır Garanti) → 409 bank:voucher.
//   - Satırsız ve faturasız Masraf başlığı → 409 bank:voucher; faturası iptal edilmiş etkin masraf başlığı → 409.
//   - Modül satırı (cari tahsilatı) bir Banka Fişi'nin işlem başlığını taşıyor → 409 bank:event.
//   - TL satırında döviz tutarı ≠ TL → 409 bank:voucher.
//   - Banka Fişi satırını ham UPDATE ile değiştirmek (bank.post dışından): tutar → kapı ya da K6; tutar dışı kolon → K6 money-raw (test
//     kipinde 500); ikisinde de hiçbir şey yazılmaz.
// STATİK: lib/bank ve routes/bank*.mjs içinde fiş satırı kuran her "gl: 'NNN'" yazımı beyaz listedeki bir koddur; yasak kodlar yalnız
//   FORBIDDEN_GL tanımında geçer.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assertLines, FORBIDDEN_GL, ROLE_GL } from "../server/lib/bank/voucher.mjs";
import { assert, bootBank, counts, must, openBankSet, supplier, voucher } from "./banka-210-fis-ortak.mjs";
import * as builders from "../server/lib/bank/voucher.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Aşama 4 — fiş kurucuları (özellik testi) ve statik denetim", () => {
  it("her kurucu her vergi kipinde dengeli, beyaz listede, yasak koda satır yazmaz", () => {
    const bank = { id: "bacc-a", kind: "demand", gl: "102", glSub: "102.01", currency: "TRY" };
    const card = { id: "bacc-k", kind: "card", gl: "309", glSub: "309.01", currency: "TRY" };
    const loan = { id: "bacc-l", kind: "loan", gl: "300", glSub: "300.01", currency: "TRY" };
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let checked = 0;
    for (let i = 0; i < 400; i += 1) {
      const amount = 1 + Math.floor(rand() * 100_000_000);
      const sets = [
        ...["bsmv_incl", "bsmv_excl", "none"].map(tax => builders.feeLines({ account: bank, amountMinor: amount, tax, ratePpm: 50_000, gl: rand() < 0.5 ? "770" : "653", feeName: "EFT" }).lines),
        builders.interestInLines({ account: bank, grossMinor: amount + 1, stoppageMinor: Math.floor(amount * rand()), gl: "642" }),
        builders.interestOutLines({ account: bank, amountMinor: amount, taxMinor: Math.floor(amount * rand() * 0.2), gl: "780" }),
        builders.otherLines({ account: bank, direction: "in", amountMinor: amount, gl: "649" }),
        builders.otherLines({ account: bank, direction: "out", amountMinor: amount, gl: "659" }),
        builders.cardPaymentLines({ bank, card, amountMinor: amount }),
        builders.loanDrawLines({ bank, loan, amountMinor: amount }),
        builders.loanRepayLines({ bank, loan, principalMinor: amount, interestMinor: Math.floor(amount * rand() * 0.1), gl: "780" }),
      ];
      for (const lines of sets) {
        assert.ok(assertLines(lines));
        for (const line of lines) assert.ok(!FORBIDDEN_GL.has(String(line.gl)), `yasak kod ${line.gl}`);
        checked += 1;
      }
    }
    assert.equal(checked, 400 * 10);
  });

  it("statik: lib/bank ve routes/bank*.mjs'te satır kuran her gl yazımı beyaz listede", () => {
    const allowed = new Set(Object.values(ROLE_GL).flat());
    const files = [
      ...readdirSync(path.join(ROOT, "server/lib/bank")).filter(name => name.endsWith(".mjs")).map(name => path.join(ROOT, "server/lib/bank", name)),
      ...readdirSync(path.join(ROOT, "server/routes")).filter(name => /^bank.*\.mjs$/.test(name)).map(name => path.join(ROOT, "server/routes", name)),
    ];
    const bad = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bgl:\s*["'`](\d{3})["'`]/g)) if (!allowed.has(match[1]) || FORBIDDEN_GL.has(match[1])) bad.push(`${path.relative(ROOT, file)}: gl ${match[1]}`);
    }
    assert.deepEqual(bad, []);
  });
});

describe("Aşama 4 — kapı: bank.post içinden ham Banka Fişi bozmaları", () => {
  let ctx;
  let set;
  const user = { id: "test", role: "admin", permissions: [] };
  before(async () => {
    ctx = await bootBank();
    set = await openBankSet(ctx.api);
  });
  after(() => ctx.server.close());

  const rawEvent = ({ type = "other_out", date = "2026-10-08", bankRef = "", invoiceId = "", direction = "out", amount = 100 } = {}) => {
    const id = `ev-${randomUUID()}`;
    ctx.store.run(
      "INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, bank_ref, invoice_id, direction, amount_minor, try_minor, currency, method, created_by, created_at) VALUES (?, 2026, ?, ?, ?, ?, 'active', 'manual', '', ?, ?, ?, ?, ?, 'TRY', 'bank', 'test', ?)",
      id, 800000 + Math.floor(Math.random() * 90000), `BNK-2026-K${randomUUID().slice(0, 8)}`, type, date, bankRef, invoiceId, direction, amount, amount, new Date().toISOString(),
    );
    ctx.store.touchEvent(id);
    return id;
  };
  const rawLine = (eventId, seq, { role, gl, sub = "", ref = "", side, minor, fx = minor }) => ctx.store.run("INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor, currency, fx_minor, rate_e6) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRY', ?, 1000000)", `bl-${randomUUID()}`, eventId, seq, role, gl, sub, ref, side, minor, fx);
  const attempt = async (label, write, code) => {
    const before = counts(ctx.store);
    let error = null;
    try {
      ctx.bank.post({ user, module: "test", op: "create", write });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error, `${label}: reddedilmeliydi`);
    assert.equal(error.status, 409, `${label}: ${error.status} ${error.message}`);
    assert.ok((error.extra?.failures || []).some(item => item.code.startsWith(code)), `${label}: ${code} bekleniyordu (${(error.extra?.failures || []).map(item => item.code).join(", ")})`);
    assert.deepEqual(counts(ctx.store), before, `${label}: hiçbir satır yazılmadı`);
  };
  const bankLine = (side, minor, account = set.ziraat) => ({ role: "bank", gl: "102", sub: account.glSub, ref: account.id, side, minor });

  it("320 / 127 / 336 / 100'e satır → bank:voucher", async () => {
    for (const gl of ["320", "127", "336", "100"]) {
      await attempt(`${gl}'e satır`, () => {
        const id = rawEvent({ bankRef: set.ziraat.id });
        rawLine(id, 1, { role: "expense", gl, side: "D", minor: 100 });
        rawLine(id, 2, { ...bankLine("C", 100) });
        return { id };
      }, "bank:voucher");
    }
  });

  it("para satırı olayın hesabı dışında → bank:voucher; TL satırında döviz ≠ TL → bank:voucher", async () => {
    await attempt("başka hesaba para satırı", () => {
      const id = rawEvent({ bankRef: set.ziraat.id });
      rawLine(id, 1, { role: "expense", gl: "659", side: "D", minor: 100 });
      rawLine(id, 2, { ...bankLine("C", 100, set.garanti) });
      return { id };
    }, "bank:voucher");
    await attempt("TL satırında döviz farklı", () => {
      const id = rawEvent({ bankRef: set.ziraat.id });
      rawLine(id, 1, { role: "expense", gl: "659", side: "D", minor: 100 });
      rawLine(id, 2, { ...bankLine("C", 100), fx: 90 });
      return { id };
    }, "bank:voucher");
  });

  it("satırsız ve faturasız Masraf başlığı → bank:voucher; faturası iptal edilmiş etkin masraf başlığı → bank:voucher", async () => {
    await attempt("satırsız faturasız masraf", () => ({ id: rawEvent({ type: "fee", bankRef: set.ziraat.id, amount: 0, direction: "" }) }), "bank:voucher");
    const party = await supplier(ctx.api, "Kapı Bankası");
    const fee = await voucher(ctx.api, { type: "fee", accountId: set.ziraat.id, amount: "12", feeType: "eft", tax: "vat_incl", partyId: party.id, invoiceNo: "KP-1" });
    await attempt("faturası iptal edilmiş masraf başlığı", () => {
      ctx.store.run("UPDATE invoices SET status = 'cancelled' WHERE id = ?", fee.invoice.id);
      ctx.store.run("DELETE FROM account_entries WHERE source = 'invoice' AND source_id = ?", fee.invoice.id);
      ctx.store.touchEvent(fee.id);
      return { id: fee.id };
    }, "bank:voucher");
  });

  it("modül satırı Banka Fişi'nin işlem başlığını taşıyor → bank:event", async () => {
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Olay Carisi", type: "customer", registeredOn: "2026-09-01" }));
    const fee = await voucher(ctx.api, { type: "other_in", accountId: set.ziraat.id, amount: "9" });
    await attempt("modül satırı fiş olayında", () => {
      ctx.store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, method, fin_ref, event_id, created_by, created_at) VALUES (?, ?, 'in', 9, '2026-10-08', '', '', '', 'bank', ?, ?, 'test', ?)", `ae-${randomUUID()}`, party.id, set.ziraat.id, fee.id, new Date().toISOString());
      ctx.store.touchEvent(fee.id);
      return { id: fee.id };
    }, "bank:event");
  });

  it("Banka Fişi satırını bank.post dışından düzeltmek → kapı ya da K6 (money-raw), hiçbir şey yazılmaz", async () => {
    const fee = await voucher(ctx.api, { type: "other_out", accountId: set.ziraat.id, amount: "8" });
    const raw = sql => {
      try {
        ctx.store.run(sql, fee.id);
        return null;
      } catch (caught) {
        return caught;
      }
    };
    // Tutarı değiştiren ham yazım fişi dengesiz bırakır: mutabakat kapısı (K6'dan önce çalışır) ya da K6 reddeder.
    const money = raw("UPDATE bank_lines SET try_minor = 1 WHERE event_id = ?");
    assert.ok(money, "ham tutar düzeltmesi reddedilmeli");
    assert.ok(["ledger-integrity", "money-guard"].includes(money.extra?.code), `kod ${money.extra?.code}`);
    assert.equal(ctx.store.get("SELECT MIN(try_minor) AS n FROM bank_lines WHERE event_id = ?", fee.id).n, 800);
    // Dengeyi bozmayan ama para satırının serbest olmayan bir kolonuna ham yazım: yalnız K6 yakalar (money-raw → money-guard).
    const quiet = raw("UPDATE bank_lines SET rate_source = 'elle' WHERE event_id = ?");
    assert.ok(quiet, "K6: bank.post dışında para tablosuna yazım reddedilmeli");
    assert.equal(quiet.extra?.code, "money-guard");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM bank_lines WHERE event_id = ? AND rate_source <> ''", fee.id).n, 0, "hiçbir şey yazılmadı");
  });
});
