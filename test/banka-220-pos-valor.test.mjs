// 2.2.0 — Aşama 11 (Komisyon, Valör, Bloke, İade, İptal) "Nasıl Bozarım" (plan §12.3 Aşama 11 satırı). Beklenen sayılar plan §4.2–§4.6
// tablolarından ve iş günü örneklerinden (§4.5); taksitli kısmi iade ayrıca bağımsız BigInt modeliyle (aşağıda; programın kodundan türetilmez).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BANK, TODAY, balanceOf, bootBank, calendarOf, expectStatus, kurus, must, openAcceptanceAccounts, openPos, posCheck, posInvoice, salesOf, settle, subBalances, summaryOf, trialBalances, ziraatPos } from "./banka-220-pos-ortak.mjs";

async function world(posExtra = {}, options = {}) {
  const ctx = await bootBank(options);
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id, posExtra));
  return { ctx, api: ctx.api, acc, abc, pos };
}
const collect = (api, accountId, body) => api.post(`/api/workspace/accounts/${accountId}/entries`, { kind: "in", method: "card", date: TODAY, ...body });
const refundEntry = (api, accountId, body) => api.post(`/api/workspace/accounts/${accountId}/entries`, { kind: "out", method: "card", posRefund: true, ...body });
const setClock = (w, iso) => w.ctx.server.clock.set(`${iso}T10:00:00+03:00`);
const vouchers = w => w.ctx.store.all("SELECT no, date, value_date AS valueDate, status, description FROM fin_events WHERE type = 'pos_settlement' ORDER BY rowid");

describe("İş günü: hafta sonu, arife ve bayram, ay sonu taksiti (plan §4.5 örnekleri)", () => {
  it("02.10.2026 Cuma + 2 iş günü = 06.10.2026 Salı; 27.10.2026 + 2 iş günü = 30.10.2026 (28.10 yarım gün, 29.10 tatil)", async () => {
    const w = await world();
    try {
      setClock(w, "2026-10-02");
      await must("02.10 satışı", collect(w.api, w.abc.id, { amount: "1.000", date: "2026-10-02" }));
      setClock(w, "2026-10-27");
      await must("27.10 satışı", collect(w.api, w.abc.id, { amount: "2.000", date: "2026-10-27" }));
      const sales = await salesOf(w.api);
      const valorOf = date => sales.find(sale => sale.date === date).items[0].valueDate;
      assert.equal(valorOf("2026-10-02"), "2026-10-06");
      assert.equal(valorOf("2026-10-27"), "2026-10-30");
      assert.equal(sales.find(sale => sale.date === "2026-10-27").explain, "30.10.2026 (27.10 Salı + 2 iş günü; 29.10.2026 Cumhuriyet Bayramı atlandı)");
      // Kuyruk: 02.10 satışının valörü (06.10) kendi tarihiyle yazılır; 30.10 henüz gelmedi.
      await settle(w.api);
      assert.deepEqual(vouchers(w).map(row => [row.date, row.valueDate]), [["2026-10-06", "2026-10-06"]]);
      await posCheck(w.api, "iş günü");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("ay sonu taksiti: 31.01.2028 3 taksit → 29.02.2028 (artık yıl), 31.03.2028, 02.05.2028 (30.04 Pazar, 01.05 tatil)", async () => {
    const w = await world();
    try {
      setClock(w, "2028-01-31");
      await must("31.01 satışı", collect(w.api, w.abc.id, { amount: "3.000", date: "2028-01-31", installments: 3 }));
      const sale = (await salesOf(w.api))[0];
      assert.deepEqual(sale.items.map(item => item.valueDate), ["2028-02-29", "2028-03-31", "2028-05-02"]);
      await posCheck(w.api, "ay sonu");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("Valör kuyruğu: sunucu kapalıyken geçen valör, iki tetik aynı anda, kilit (Gecikmeli Aktarım, bekleyen uyarısı), onay kipi", () => {
  it("sunucu kapalıyken geçen valör → açılışta her gün kendi tarihiyle (12.10 ve 13.10 ayrı gün fişleri)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pos-acilis-"));
    const dataDir = path.join(root, "data");
    const first = await world({}, { dataDir });
    await must("08.10 satışı", collect(first.api, first.abc.id, { amount: "1.000" }));
    setClock(first, "2026-10-09");
    await must("09.10 satışı", collect(first.api, first.abc.id, { amount: "2.000", date: "2026-10-09" }));
    const ziraat = first.acc.ziraat.id;
    await first.ctx.server.close();
    const ctx = await bootBank({ dataDir, now: "2026-10-16T09:00:00+03:00" });
    try {
      for (let i = 0; i < 50 && !ctx.store.get("SELECT 1 AS found FROM fin_events WHERE type = 'pos_settlement' LIMIT 1"); i += 1) await new Promise(resolve => setTimeout(resolve, 20));
      const rows = ctx.store.all("SELECT date, value_date AS valueDate FROM fin_events WHERE type = 'pos_settlement' ORDER BY date");
      assert.deepEqual(rows.map(row => [row.date, row.valueDate]), [["2026-10-12", "2026-10-12"], ["2026-10-13", "2026-10-13"]], "açılışta kuyruk: her gün kendi tarihiyle");
      assert.equal(await balanceOf(ctx.api, ziraat), kurus(100000) + kurus(975) + kurus(1950));
      await posCheck(ctx.api, "açılış kuyruğu");
    } finally {
      await ctx.server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("iki tetik aynı anda (iki \"Şimdi Aktar\") → tek gün fişi", async () => {
    const w = await world();
    try {
      await must("satış", collect(w.api, w.abc.id, { amount: "1.000" }));
      setClock(w, "2026-10-12");
      const [a, b] = await Promise.all([settle(w.api), settle(w.api)]);
      assert.equal(a.settled + b.settled, 1);
      assert.equal(vouchers(w).length, 1);
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(100975));
      await posCheck(w.api, "iki tetik");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("kilit konarken valörü gelmiş bekleyen → 409 bank-pending-before-lock + liste; Yine de Kilitle → fiş kilit + 1'e Gecikmeli Aktarım (late); kilit + 1 bugünden sonraysa bekler", async () => {
    const w = await world({ settleMode: "manual" });
    try {
      await must("satış", collect(w.api, w.abc.id, { amount: "1.000" }));
      setClock(w, "2026-10-14");
      const res = await w.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-12" });
      expectStatus(res, 409, "bank-pending-before-lock", "kilit uyarısı");
      await must("Yine de Kilitle", w.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-12", force: true }));
      await must("otomatik", w.api.put(`${BANK}/pos/${w.pos.id}`, { settleMode: "auto" }));
      await settle(w.api);
      const [row] = vouchers(w);
      assert.deepEqual([row.date, row.valueDate], ["2026-10-13", "2026-10-12"], "kilit + 1 (13.10), gerçek valör kalemde");
      assert.match(row.description, /Gecikmeli Aktarım/);
      assert.equal((await salesOf(w.api))[0].items[0].late, true);
      // Kilit bugüne: kilit + 1 yarın → bekler (kalem kilit konarken Onay Bekleyen'deydi).
      await must("elle onay", w.api.put(`${BANK}/pos/${w.pos.id}`, { settleMode: "manual" }));
      await must("14.10 satışı", collect(w.api, w.abc.id, { amount: "500", date: "2026-10-14" }));
      setClock(w, "2026-10-17");
      await must("kilit 17.10", w.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-17", force: true }));
      await must("otomatik", w.api.put(`${BANK}/pos/${w.pos.id}`, { settleMode: "auto" }));
      assert.equal((await settle(w.api)).settled, 0, "kilit + 1 (18.10) bugünden sonra: bekler");
      assert.equal(vouchers(w).length, 1);
      setClock(w, "2026-10-18");
      assert.equal((await settle(w.api)).settled, 1);
      assert.deepEqual(vouchers(w).at(-1).date, "2026-10-18");
      await posCheck(w.api, "kilit");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("onay kipi (Elle Onay): valör gelince kuyruk yazmaz (Onay Bekleyen); onayda gerçek tarih 13.10 ve net 9.740 → fark 10 BSMV kipinde 653'e (653 = 260)", async () => {
    const w = await world({ settleMode: "manual" });
    try {
      await must("satış", collect(w.api, w.abc.id, { amount: "10.000" }));
      setClock(w, "2026-10-13");
      assert.equal((await settle(w.api)).settled, 0);
      const summary = await summaryOf(w.api);
      assert.deepEqual([summary.posPending.awaiting.count, summary.posPending.awaiting.netMinor], [1, kurus(9750)], "Onay Bekleyen 1 kalem, 9.750");
      await must("onayla", w.api.post(`${BANK}/pos/items/confirm`, { posId: w.pos.id, valueDate: "2026-10-12", date: "2026-10-13", netAmount: "9.740" }));
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(109740));
      const trial = await trialBalances(w.api);
      assert.equal(kurus(trial["653"] || 0), kurus(260));
      assert.equal(kurus((await subBalances(w.api))["108.01"]?.balance || 0), 0);
      await posCheck(w.api, "onay");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("İade, komisyon tahsili ve net eksi (plan §4.6)", () => {
  it("iade > satış → 409 pos-refund-exceeds; iade satıştan önce → 400; asıl işlem seçilmeden (birden çok aday) → 400 pos-refund-origin", async () => {
    const w = await world();
    try {
      const a = await must("satış 1", collect(w.api, w.abc.id, { amount: "1.000" }));
      await must("satış 2", collect(w.api, w.abc.id, { amount: "1.000", similarOk: true }));
      const sale = (await salesOf(w.api))[0];
      expectStatus(await refundEntry(w.api, w.abc.id, { amount: "1.500", date: TODAY, posRefundOf: sale.id }), 409, "pos-refund-exceeds", "iade > satış");
      expectStatus(await refundEntry(w.api, w.abc.id, { amount: "500", date: "2026-10-07", posRefundOf: sale.id }), 400, "pos-refund-before-sale", "iade satıştan önce");
      expectStatus(await refundEntry(w.api, w.abc.id, { amount: "500", date: TODAY }), 400, "pos-refund-origin", "asıl işlem seçilmedi");
      await must("iade 400", refundEntry(w.api, w.abc.id, { amount: "400", date: TODAY, posRefundOf: sale.id }));
      expectStatus(await refundEntry(w.api, w.abc.id, { amount: "700", date: TODAY, posRefundOf: sale.id, similarOk: true }), 409, "pos-refund-exceeds", "Σ iade > satış");
      assert.ok(a.entryId);
      await posCheck(w.api, "iade sınırı");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("tam iade valörden önce (İade Edilmez) → 12.10 banka −250, 653 = 250; Komisyon Tahsili Bekleyen 250", async () => {
    const w = await world();
    try {
      await must("satış", collect(w.api, w.abc.id, { amount: "10.000" }));
      const sale = (await salesOf(w.api))[0];
      setClock(w, "2026-10-09");
      await must("tam iade", refundEntry(w.api, w.abc.id, { amount: "10.000", date: "2026-10-09", posRefundOf: sale.id }));
      const summary = await summaryOf(w.api);
      assert.deepEqual([summary.posPending.netMinor, summary.posPending.feeMinor], [-kurus(250), kurus(250)]);
      const calendar = await calendarOf(w.api);
      assert.deepEqual(calendar.rows.map(row => [row.valueDate, row.kind, row.netMinor]), [["2026-10-12", "fee", -kurus(250)]], "Komisyon Tahsili satırı");
      setClock(w, "2026-10-12");
      await settle(w.api);
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(100000) - kurus(250), "banka −250");
      assert.equal(kurus((await trialBalances(w.api))["653"] || 0), kurus(250));
      await posCheck(w.api, "tam iade");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("valörden sonra kısmi iade 3.000: İade Edilmez → iade valöründe banka −3.000; Oransal → −2.925 ve 653 −75 (plan §4.6 tablosu)", async () => {
    for (const [policy, bank, fee] of [["none", 3000, 250], ["proportional", 2925, 175]]) {
      const w = await world({ refundCommission: policy });
      try {
        await must("satış", collect(w.api, w.abc.id, { amount: "10.000" }));
        const sale = (await salesOf(w.api))[0];
        setClock(w, "2026-10-13");
        await settle(w.api);
        const before = await balanceOf(w.api, w.acc.ziraat.id);
        await must("iade", refundEntry(w.api, w.abc.id, { amount: "3.000", date: "2026-10-13", posRefundOf: sale.id }));
        setClock(w, "2026-10-15");
        await settle(w.api);
        assert.equal(before - (await balanceOf(w.api, w.acc.ziraat.id)), kurus(bank), `${policy}: banka −${bank}`);
        assert.equal(kurus((await trialBalances(w.api))["653"] || 0), kurus(fee), `${policy}: 653 = ${fee}`);
        await posCheck(w.api, `iade ${policy}`);
      } finally {
        await w.ctx.server.close();
      }
    }
  });

  it("valörden önce kısmi iade 3.000 (Oransal): bekleyen kalem net 6.825 (kom. 175); valörde banka +6.825", async () => {
    const w = await world({ refundCommission: "proportional" });
    try {
      await must("satış", collect(w.api, w.abc.id, { amount: "10.000" }));
      const sale = (await salesOf(w.api))[0];
      await must("iade", refundEntry(w.api, w.abc.id, { amount: "3.000", date: TODAY, posRefundOf: sale.id }));
      assert.deepEqual((await calendarOf(w.api)).rows.map(row => [row.valueDate, row.netMinor, row.grossMinor]), [["2026-10-12", kurus(6825), kurus(7000)]], "brüt 7.000, net 6.825");
      setClock(w, "2026-10-12");
      await settle(w.api);
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(106825));
      assert.equal(kurus((await trialBalances(w.api))["653"] || 0), kurus(175));
      await posCheck(w.api, "valörden önce oransal");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("10 TL satış + 15 TL sabit ücret (oran %0) → banka −5", async () => {
    const w = await world({ fixedFee: "15", rates: [{ installments: 1, rate: "0" }] });
    try {
      await must("10 TL", collect(w.api, w.abc.id, { amount: "10" }));
      setClock(w, "2026-10-12");
      await settle(w.api);
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(100000) - kurus(5));
      assert.equal(kurus((await trialBalances(w.api))["653"] || 0), kurus(15));
      await posCheck(w.api, "sabit ücret");
    } finally {
      await w.ctx.server.close();
    }
  });
});

// Bağımsız BigInt modeli (plan §4.2–§4.6 metninden; program kodu kullanılmaz): kom = round(brüt × oran / 10^6) (yarım sıfırdan uzağa);
// taksitler brütü eşit böler, artık son kaleme; komisyon brüt ağırlıklı (aşağı yuvarlanır), artık son kaleme; iade bekleyen kalemlere sondan başa;
// Oransal komisyon iadesi round(kom × iade / satış), iade parçalarına brüt ağırlıklı.
const roundDiv = (a, b) => (a >= 0n ? (2n * a + b) / (2n * b) : -((2n * -a + b) / (2n * b)));
function weighted(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0n);
  const out = weights.map(weight => (total * weight) / sum);
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0n);
  return out;
}
function model({ gross, ppm, n, settled, refund }) {
  const G = BigInt(gross);
  const commission = roundDiv(G * BigInt(ppm), 1_000_000n);
  const base = G / BigInt(n);
  const grossParts = Array.from({ length: n }, (_, i) => (i === n - 1 ? G - base * BigInt(n - 1) : base));
  const commissionParts = weighted(commission, grossParts);
  const day = grossParts.map((g, i) => g - commissionParts[i]);
  let left = BigInt(refund);
  const refundParts = new Array(n).fill(0n);
  for (let i = n - 1; i >= 0 && left > 0n; i -= 1) {
    if (i < settled) break;
    const take = left < grossParts[i] ? left : grossParts[i];
    refundParts[i] = take;
    left -= take;
  }
  const refundCommission = roundDiv(commission * BigInt(refund), G);
  const used = refundParts.map((value, i) => [value, i]).filter(([value]) => value > 0n);
  const shares = weighted(refundCommission, used.map(([value]) => value));
  used.forEach(([value, i], k) => {
    day[i] -= value - shares[k];
  });
  return { day, leftover: left, commission, refundCommission };
}

describe("Taksitli kısmi iade (3 taksit, 1'i bankaya geçmiş, Oransal) — bağımsız BigInt modeli", () => {
  it("12.000 / %3,5 / 3 taksit; 13.11'de 5.000 iade → gün netleri ve banka toplamı modelle aynı", async () => {
    const w = await world({ refundCommission: "proportional" });
    try {
      setClock(w, "2026-10-12");
      await must("taksitli satış", collect(w.api, w.abc.id, { amount: "12.000", date: "2026-10-12", installments: 3 }));
      const sale = (await salesOf(w.api))[0];
      setClock(w, "2026-11-13");
      await settle(w.api);
      const start = await balanceOf(w.api, w.acc.ziraat.id);
      await must("kısmi iade", refundEntry(w.api, w.abc.id, { amount: "5.000", date: "2026-11-13", posRefundOf: sale.id }));
      const expected = model({ gross: 1_200_000, ppm: 35_000, n: 3, settled: 1, refund: 500_000 });
      assert.equal(expected.leftover, 0n, "bekleyen kalemler iadeyi karşılar");
      const calendar = await calendarOf(w.api);
      const byDate = Object.fromEntries(calendar.rows.map(row => [row.valueDate, row.netMinor]));
      assert.equal(byDate["2026-12-14"], Number(expected.day[1]), "14.12 net");
      assert.equal(byDate["2027-01-12"] ?? 0, Number(expected.day[2]), "12.01.2027 net");
      setClock(w, "2027-01-12");
      await settle(w.api);
      assert.equal((await balanceOf(w.api, w.acc.ziraat.id)) - start, Number(expected.day[1] + expected.day[2]), "iade sonrası bankaya geçen");
      assert.equal(kurus((await trialBalances(w.api))["653"] || 0), Number(expected.commission - expected.refundCommission), "653 = kom − iade edilen");
      await posCheck(w.api, "taksitli kısmi iade");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("Düzeltme, silme, geri yükleme, fatura iptali (plan §3.8, §4.6)", () => {
  it("valörden sonra tutar düzelt → bank.replan (gün fişi ters + r2); eşleşmişse 409 pos-settled", async () => {
    const w = await world();
    try {
      const res = await must("satış", collect(w.api, w.abc.id, { amount: "10.000" }));
      setClock(w, "2026-10-13");
      await settle(w.api);
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(109750));
      await must("düzelt 8.000", w.api.put(`/api/workspace/accounts/${w.abc.id}/entries/${res.entryId}`, { amount: "8.000" }));
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(107800), "yeniden planlama: 8.000 − 200");
      const rows = vouchers(w);
      assert.deepEqual(rows.map(row => [row.date, row.status]), [["2026-10-12", "reversed"], ["2026-10-12", "active"]], "eski fiş ters, r2 aynı valörle");
      const current = w.ctx.store.get("SELECT id, try_minor AS tryMinor FROM fin_events WHERE type = 'pos_settlement' AND status = 'active'");
      w.ctx.db.prepare("INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'x', 'manual', 'admin', ?)").run(`m-${randomUUID()}`, `l-${randomUUID()}`, w.acc.ziraat.id, current.id, current.tryMinor, new Date().toISOString());
      expectStatus(await w.api.put(`/api/workspace/accounts/${w.abc.id}/entries/${res.entryId}`, { amount: "7.000" }), 409, "pos-settled", "eşleşmiş gün fişi");
      expectStatus(await w.api.del(`/api/workspace/accounts/${w.abc.id}/entries/${res.entryId}`), 409, "pos-settled", "eşleşmiş: silme");
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(107800), "değişmedi");
      await posCheck(w.api, "replan");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("POS'lu satırı sil (valörden önce void) → valör geçsin → geri yükle: asıl valörüyle etkin, gün fişi asıl valör tarihiyle", async () => {
    const w = await world();
    try {
      const res = await must("satış", collect(w.api, w.abc.id, { amount: "1.000", authCode: "X1" }));
      await must("sil", w.api.del(`/api/workspace/accounts/${w.abc.id}/entries/${res.entryId}`));
      assert.equal((await salesOf(w.api))[0].status, "void");
      setClock(w, "2026-10-14");
      const trash = await must("Silinenler", w.api.get("/api/admin/trash"));
      const list = trash.items || trash.rows || trash;
      const item = list.find(entry => entry.kind === "account-entry" && !entry.restoredAt);
      await must("geri yükle", w.api.post("/api/admin/trash/restore", { id: item.id }));
      const sale = (await salesOf(w.api))[0];
      assert.deepEqual([sale.status, sale.items[0].valueDate, sale.items[0].status], ["active", "2026-10-12", "settled"]);
      assert.deepEqual(vouchers(w).map(row => row.date), ["2026-10-12"]);
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), kurus(100975));
      await posCheck(w.api, "geri yükle");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("aynı provizyonla yeni satış → eskisini geri yükle → 409 pos-auth-duplicate", async () => {
    const w = await world();
    try {
      const res = await must("satış", collect(w.api, w.abc.id, { amount: "1.000", authCode: "Z9" }));
      await must("sil", w.api.del(`/api/workspace/accounts/${w.abc.id}/entries/${res.entryId}`));
      await must("aynı provizyonla yeni", collect(w.api, w.abc.id, { amount: "1.100", authCode: "Z9" }));
      const trash = await must("Silinenler", w.api.get("/api/admin/trash"));
      const list = trash.items || trash.rows || trash;
      const item = list.find(entry => entry.kind === "account-entry" && !entry.restoredAt);
      expectStatus(await w.api.post("/api/admin/trash/restore", { id: item.id }), 409, "pos-auth-duplicate", "geri yükleme");
      await posCheck(w.api, "provizyon geri yükleme");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("POS'lu faturayı aynı provizyonla 6 kez düzelt (peşin satırı silinip yeniden yazılır) → her düzeltme 200; tek etkin satış, eskiler void", async () => {
    // Aynı işlemde eski satış kaldırılmadan yenisi yazılırsa aynı provizyon "pos-auth-duplicate" olurdu (olay kimliği sırasına bağlı, ~%50).
    const w = await world();
    try {
      const item = await must("ürün", w.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "25" }));
      const body = price => ({ kind: "sale", accountId: w.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: item.id, name: "Ürün B", qty: 1, unitPrice: price, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: price, method: "card", posId: w.pos.id, authCode: "PRV77" }], cheques: [], endorse: [], rest: "open" }, force: true });
      const doc = await must("fatura", w.api.post("/api/workspace/invoices", body(1000)));
      const number = w.ctx.store.get("SELECT number FROM invoices WHERE id = ?", doc.id).number;
      for (const price of [1100, 1200, 1300, 1400, 1500, 1600]) await must(`düzelt ${price}`, w.api.post(`/api/workspace/invoices/${doc.id}/edit`, { ...body(price), number }));
      const active = (await salesOf(w.api, "?kind=sale")).filter(sale => sale.status === "active");
      assert.deepEqual(active.map(sale => [sale.grossMinor, sale.authCode]), [[kurus(1600), "PRV77"]], "tek etkin satış, son tutar");
      assert.equal((await summaryOf(w.api)).posPending.grossMinor, kurus(1600));
      await posCheck(w.api, "aynı provizyonla düzelt");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("POS'lu faturayı aynı gün iptal → void, komisyon 0; ertesi gün taksitli faturayı iptal → İptal İadesi: 3 Komisyon Tahsili 140, 108.01 = 0, POS Bekleyen (Net) −420", async () => {
    const w = await world();
    try {
      const item = await must("ürün", w.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "25" }));
      const same = await must("fatura", posInvoice(w.api, { accountId: w.abc.id, itemId: item.id, qty: 1, unitPrice: 1000, date: TODAY }));
      await must("aynı gün iptal", w.api.post(`/api/workspace/invoices/${same.id}/cancel`, { reason: "test" }));
      let sale = (await salesOf(w.api, "?kind=sale")).find(entry => entry.invoice?.id === same.id);
      assert.equal(sale.status, "void");
      assert.deepEqual([(await summaryOf(w.api)).posPending.netMinor, (await summaryOf(w.api)).posPending.grossMinor], [0, 0], "komisyon 0");
      setClock(w, "2026-10-12");
      const taksitli = await must("taksitli", posInvoice(w.api, { accountId: w.abc.id, itemId: item.id, qty: 12, unitPrice: 1000, date: "2026-10-12", installments: 3 }));
      setClock(w, "2026-10-15");
      const bankBefore = await balanceOf(w.api, w.acc.ziraat.id);
      await must("ertesi gün iptal", w.api.post(`/api/workspace/invoices/${taksitli.id}/cancel`, { reason: "test" }));
      sale = (await salesOf(w.api, "?kind=sale")).find(entry => entry.invoice?.id === taksitli.id);
      assert.equal(sale.status, "cancelled", "İptal İadesi yapıldı");
      const cal = await calendarOf(w.api);
      assert.deepEqual(cal.rows.map(row => [row.valueDate, row.kind, row.netMinor]), [["2026-11-12", "fee", -kurus(140)], ["2026-12-14", "fee", -kurus(140)], ["2027-01-12", "fee", -kurus(140)]]);
      const summary = await summaryOf(w.api);
      assert.deepEqual([summary.posPending.netMinor, summary.posPending.feeMinor], [-kurus(420), kurus(420)], "Komisyon Tahsili Bekleyen 420");
      assert.equal(kurus((await subBalances(w.api))["108.01"]?.balance || 0), 0, "108.01 = 0");
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), bankBefore, "banka bugün değişmez");
      assert.equal((await must("Ürün B", w.api.get(`/api/workspace/stock/${item.id}`))).qty, 25);
      const refund = (await salesOf(w.api, "?kind=refund")).find(entry => entry.origin?.id === sale.id);
      assert.equal(refund.src, "cancel");
      await posCheck(w.api, "iptal");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("bankaya geçmiş ve eşleşmiş POS'lu faturayı iptal (Müşteriye İade Edildi) → 200, iade kalemi, eski fiş ve eşleşme değişmez; Kayıt Hatası → 409 pos-settled", async () => {
    const w = await world();
    try {
      const item = await must("ürün", w.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "25" }));
      const a = await must("fatura A", posInvoice(w.api, { accountId: w.abc.id, itemId: item.id, qty: 10, unitPrice: 1000, date: TODAY }));
      const b = await must("fatura B", posInvoice(w.api, { accountId: w.abc.id, itemId: item.id, qty: 2, unitPrice: 1000, date: TODAY, extra: { similarOk: true } }));
      setClock(w, "2026-10-13");
      await settle(w.api);
      const voucher = w.ctx.store.get("SELECT id, no, try_minor AS tryMinor FROM fin_events WHERE type = 'pos_settlement' AND status = 'active'");
      w.ctx.db.prepare("INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'x', 'manual', 'admin', ?)").run(`m-${randomUUID()}`, `l-${randomUUID()}`, w.acc.ziraat.id, voucher.id, voucher.tryMinor, new Date().toISOString());
      expectStatus(await w.api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "hata", posOutcome: "entry-error" }), 409, "pos-settled", "Kayıt Hatası");
      await must("İade Edildi", w.api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "iade" }));
      assert.equal(w.ctx.store.get("SELECT status FROM fin_events WHERE id = ?", voucher.id).status, "active", "eski gün fişi değişmedi");
      assert.ok(w.ctx.store.get("SELECT 1 AS found FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", voucher.id), "eşleşme duruyor");
      const refund = (await salesOf(w.api, "?kind=refund"))[0];
      assert.deepEqual(refund.items.map(entry => [entry.valueDate, entry.grossMinor]), [["2026-10-15", kurus(10000)]], "iade kalemi iade valöründe");
      setClock(w, "2026-10-15");
      const before = await balanceOf(w.api, w.acc.ziraat.id);
      await settle(w.api);
      assert.equal(before - (await balanceOf(w.api, w.acc.ziraat.id)), kurus(10000), "İade Edilmez: banka −10.000");
      await posCheck(w.api, "eşleşmiş iptal");
    } finally {
      await w.ctx.server.close();
    }
  });
});
