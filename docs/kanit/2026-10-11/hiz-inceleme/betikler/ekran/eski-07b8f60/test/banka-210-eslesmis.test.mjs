// 2.1.0 — Ekstreyle eşleşmiş satırın korunması (plan §3.8 "Modül satırı, fin_ref dolu" ve "Fatura", §3.13, §11.2 "Eşleşmiş satır başka
// yoldan değişir", §12.4 "Değişiklik: eşleşmiş satırı düzelt ya da sil"). Cari ve Banka Fişi (banka-210-asama5-cari B19, -ters-kayit) ile
// bankalar arası / Kasa ↔ Banka transferi (banka-210-transfer B12, B17) zaten sınanıyor; burada geri kalan modüller:
// taksit tahsilatı, kayıt (detay kartı) tahsilatı, stok peşini, çek tahsil/ödeme, fatura peşini, Kasa ↔ Banka.
//
// Eşleşme nasıl yazılıyor: ekstre modülü (Aşama 12) 2.3.0'a ertelendi; ekranı ve ucu yok. Eşleşme, planın §5.2 bank_matches tablosuna
// (göç 20 ile kurulu) planın tarif ettiği satır olarak doğrudan yazılır: { line_id, bank_account_id, event_id = modül satırının olayı,
// amount_minor, digest, kind 'manual', created_by, created_at }; "Eşleşmeyi Kaldır" = undone_at doldurulur. Program bu tabloyu bank.post'un
// assertMutable'ında (post.mjs) okur — testin sınadığı tam olarak bu korumadır.
//
// Nasıl bozarım (önce yazıldı; testler buradan):
//   E1  Taksit tahsilatı (havale, Ziraat) eşleşmiş: tutarı düzelt / hesabı Garanti'ye taşı / sil → 409 bank-reconciled; yalnız açıklama → 200
//   E2  Kayıt tahsilatı eşleşmiş: tutar / sil → 409; açıklama → 200
//   E3  Stok peşin satışı (havale) eşleşmiş: miktar / sil → 409; açıklama → 200
//   E4  Çek bankaya tahsil eşleşmiş: tahsili geri al → 409 (bakiye ve çek durumu değişmez); verilen çek ödemesi eşleşmiş: geri al → 409
//   E5  Fatura peşini (havale) eşleşmiş: peşin tutarı değiştir / iptal et / sil → 409; yalnız kalem açıklaması → 200 (plan §3.8 ve Aşama 7)
//   E6  Kasa ↔ Banka (Bankadan Kasaya) eşleşmiş: sil / tutar → 409 (B17'nin öbür yönü: Kasadan Bankaya)
//   E7  Eşleşme kalkınca (undone_at) her biri 200 ile değişir/silinir; sayılar bağımsız beklenenle; Mutabakat Testi tutarlı
//   E8  Taksite Aktar (op move) eşleşmeyi korur, satır tablo değiştirir; eşleşme özeti aynı (plan §3.8 son satır)
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { integrityOk, rawRun } from "./banka-210-ortak.mjs";
import { BANK, NOW, TODAY, bootBank, expectStatus, must, openAcceptanceAccounts, subBalances } from "./banka-210-hesap-ortak.mjs";

const balanceTl = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor / 100;
/** Ekstre eşleşmesi (plan §5.2 bank_matches satırı). Dönüş: "Eşleşmeyi Kaldır" işlevi. */
function match(db, accountId, eventId, amountMinor) {
  assert.ok(eventId, "eşlenecek satırın olayı (event_id) var");
  const id = `bm-${randomUUID()}`;
  rawRun(db, "INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, score, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'test', 'manual', 80, 'test', ?)", id, `line-${randomUUID()}`, accountId, eventId, amountMinor, NOW);
  return () => rawRun(db, "UPDATE bank_matches SET undone_at = ?, undone_by = 'test', undo_reason = 'test' WHERE id = ?", NOW, id);
}

describe("2.1.0 — ekstreyle eşleşmiş modül satırı korunur (409 bank-reconciled)", () => {
  let ctx;
  let acc;
  let party;
  let supplier;
  // Bağımsız beklenen: hesap bakiyeleri (TL), her başarılı işlemde testin kendisi günceller.
  const want = { ziraat: 100000, garanti: 50000 };
  const check = async label => {
    assert.equal(await balanceTl(ctx.api, acc.ziraat), want.ziraat, `${label}: Ziraat`);
    assert.equal(await balanceTl(ctx.api, acc.garanti), want.garanti, `${label}: Garanti`);
    const subs = await subBalances(ctx.api);
    assert.equal(subs[acc.ziraat.glSub].balance, want.ziraat, `${label}: Alt Hesap Mizanı 102.01`);
    assert.equal(subs[acc.garanti.glSub].balance, want.garanti, `${label}: Alt Hesap Mizanı 102.02`);
    await integrityOk(ctx.api, label);
  };
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    supplier = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  });
  after(() => ctx?.server.close());

  it("E1: taksit tahsilatı eşleşmiş → tutar / hesap taşıma / sil 409; açıklama 200; eşleşme kalkınca silinir", async () => {
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: party.id, name: party.name, total: "9.000", mode: "auto", count: 3, firstDue: "2026-10-15" }));
    const url = `/api/workspace/plans/${plan.id}/entries`;
    const res = await must("tahsilat", ctx.api.post(url, { kind: "in", amount: "3.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    want.ziraat += 3000;
    const row = ctx.store.get("SELECT event_id FROM plan_entries WHERE id = ?", res.entryId);
    const undo = match(ctx.db, acc.ziraat.id, row.event_id, 300000);
    expectStatus(await ctx.api.put(`${url}/${res.entryId}`, { amount: "2.000", method: "bank", date: TODAY }), 409, "bank-reconciled", "tutar");
    expectStatus(await ctx.api.put(`${url}/${res.entryId}`, { amount: "3.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }), 409, "bank-reconciled", "hesap taşıma");
    expectStatus(await ctx.api.del(`${url}/${res.entryId}`), 409, "bank-reconciled", "sil");
    expectStatus(await ctx.api.del(`/api/workspace/plans/${plan.id}`), 409, null, "kartı sil (bağlı tahsilat)");
    await check("E1 eşleşmiş");
    await must("yalnız açıklama", ctx.api.put(`${url}/${res.entryId}`, { amount: "3.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, note: "Ekim taksiti" }));
    assert.equal(ctx.store.get("SELECT note FROM plan_entries WHERE id = ?", res.entryId).note, "Ekim taksiti");
    undo();
    await must("eşleşme kalktı: sil", ctx.api.del(`${url}/${res.entryId}`));
    want.ziraat -= 3000;
    await check("E1 sonrası");
  });

  it("E2: kayıt tahsilatı eşleşmiş → tutar / sil 409; açıklama 200", async () => {
    const created = await must("kayıt tahsilatı", ctx.api.post("/api/workspace/cases/DOSYA-E2/payments", { amount: "700", date: TODAY, method: "bank", bankAccountId: acc.garanti.id, caseTitle: "Dosya E2" }));
    want.garanti += 700;
    const row = ctx.store.get("SELECT event_id FROM payments WHERE id = ?", created.id);
    const undo = match(ctx.db, acc.garanti.id, row.event_id, 70000);
    expectStatus(await ctx.api.put(`/api/workspace/payments/${created.id}`, { amount: "500", date: TODAY, method: "bank", bankAccountId: acc.garanti.id }), 409, "bank-reconciled", "tutar");
    expectStatus(await ctx.api.put(`/api/workspace/payments/${created.id}`, { amount: "700", date: TODAY, method: "cash" }), 409, "bank-reconciled", "nakde çevir");
    expectStatus(await ctx.api.del(`/api/workspace/payments/${created.id}`), 409, "bank-reconciled", "sil");
    await check("E2 eşleşmiş");
    await must("yalnız açıklama", ctx.api.put(`/api/workspace/payments/${created.id}`, { amount: "700", date: TODAY, method: "bank", bankAccountId: acc.garanti.id, note: "Vekâlet ücreti" }));
    undo();
    await must("eşleşme kalktı: sil", ctx.api.del(`/api/workspace/payments/${created.id}`));
    want.garanti -= 700;
    await check("E2 sonrası");
  });

  it("E3: stok peşin satışı (havale) eşleşmiş → miktar / sil 409; açıklama 200", async () => {
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün E3", unit: "Adet", openingQty: "10", unitPrice: "100" }));
    const moves = `/api/workspace/stock/${item.id}/moves`;
    const sold = await must("satış", ctx.api.post(moves, { kind: "out", qty: "2", unitPrice: "1.500", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    want.ziraat += 3000;
    const row = ctx.store.get("SELECT event_id FROM stock_moves WHERE id = ?", sold.moveId);
    const undo = match(ctx.db, acc.ziraat.id, row.event_id, 300000);
    expectStatus(await ctx.api.put(`${moves}/${sold.moveId}`, { qty: "1", unitPrice: "1.500", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }), 409, "bank-reconciled", "miktar");
    expectStatus(await ctx.api.del(`${moves}/${sold.moveId}`), 409, "bank-reconciled", "sil");
    await check("E3 eşleşmiş");
    await must("yalnız açıklama", ctx.api.put(`${moves}/${sold.moveId}`, { qty: "2", unitPrice: "1.500", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, note: "Mağaza satışı" }));
    undo();
    await must("eşleşme kalktı: sil", ctx.api.del(`${moves}/${sold.moveId}`));
    want.ziraat -= 3000;
    await check("E3 sonrası");
  });

  it("E4: çek bankaya tahsili eşleşmiş → Geri Al 409 (çek Tahsil Edildi kalır, Garanti değişmez); verilen çek ödemesi eşleşmiş → Geri Al 409", async () => {
    const inCheque = await must("alınan çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "4.000", issueDate: TODAY, dueDate: "2026-12-31", drawer: "Keşideci A", serialNo: "E4-1" }));
    await must("tahsil", ctx.api.post(`/api/workspace/cheques/${inCheque.id}/actions`, { action: "collect", date: TODAY, method: "bank", bankAccountId: acc.garanti.id }));
    want.garanti += 4000;
    const collect = ctx.store.get("SELECT event_id FROM cheque_events WHERE cheque_id = ? AND kind = 'collect'", inCheque.id);
    const undoIn = match(ctx.db, acc.garanti.id, collect.event_id, 400000);
    expectStatus(await ctx.api.post(`/api/workspace/cheques/${inCheque.id}/undo`, {}), 409, "bank-reconciled", "tahsili geri al");
    assert.equal(ctx.store.get("SELECT status FROM cheques WHERE id = ?", inCheque.id).status, "collected", "çek Tahsil Edildi kalır");
    const outCheque = await must("verilen çek", ctx.api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "1.000", issueDate: TODAY, dueDate: "2026-12-31", accountId: supplier.id, serialNo: "E4-2" }));
    await must("ödeme", ctx.api.post(`/api/workspace/cheques/${outCheque.id}/actions`, { action: "pay", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id }));
    want.ziraat -= 1000;
    const pay = ctx.store.get("SELECT event_id FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", outCheque.id);
    const undoOut = match(ctx.db, acc.ziraat.id, pay.event_id, 100000);
    expectStatus(await ctx.api.post(`/api/workspace/cheques/${outCheque.id}/undo`, {}), 409, "bank-reconciled", "ödemeyi geri al");
    assert.equal(ctx.store.get("SELECT status FROM cheques WHERE id = ?", outCheque.id).status, "paid");
    await check("E4 eşleşmiş");
    undoIn();
    undoOut();
    await must("eşleşme kalktı: tahsili geri al", ctx.api.post(`/api/workspace/cheques/${inCheque.id}/undo`, {}));
    await must("eşleşme kalktı: ödemeyi geri al", ctx.api.post(`/api/workspace/cheques/${outCheque.id}/undo`, {}));
    want.garanti -= 4000;
    want.ziraat += 1000;
    await check("E4 sonrası");
  });

  it("E5: fatura peşini (havale) eşleşmiş → peşin tutarı / iptal / sil 409; yalnız kalem açıklaması 200 (plan §3.8 Fatura)", async () => {
    const body = (cashAmount, lineName = "Danışmanlık") => ({ kind: "sale", accountId: party.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: lineName, qty: 1, unitPrice: 5000, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: cashAmount, method: "bank", bankAccountId: acc.ziraat.id, lineKey: "p1" }], cheques: [], endorse: [], rest: "open" }, force: true });
    const doc = await must("fatura", ctx.api.post("/api/workspace/invoices", body("5.000")));
    want.ziraat += 5000;
    const row = ctx.store.get("SELECT event_id FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", doc.id);
    const undo = match(ctx.db, acc.ziraat.id, row.event_id, 500000);
    const number = ctx.store.get("SELECT number FROM invoices WHERE id = ?", doc.id).number;
    expectStatus(await ctx.api.post(`/api/workspace/invoices/${doc.id}/edit`, { ...body("4.000"), number }), 409, "bank-reconciled", "peşin tutar");
    expectStatus(await ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" }), 409, "bank-reconciled", "iptal");
    expectStatus(await ctx.api.del(`/api/workspace/invoices/${doc.id}`), 409, "bank-reconciled", "sil");
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, "issued", "fatura kaydedilmiş kalır");
    await check("E5 eşleşmiş");
    await must("yalnız kalem açıklaması", ctx.api.post(`/api/workspace/invoices/${doc.id}/edit`, { ...body("5.000", "Danışmanlık (Ekim)"), number }));
    assert.equal(ctx.store.get("SELECT event_id FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", doc.id).event_id, row.event_id, "olay korunur (eşleşme geçerli)");
    undo();
    await must("eşleşme kalktı: iptal", ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" }));
    want.ziraat -= 5000;
    await check("E5 sonrası");
  });

  it("E6: Kasadan Bankaya (Garanti) eşleşmiş → sil / tutar 409; eşleşme kalkınca silinir", async () => {
    await must("kasaya nakit", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "1.000", date: TODAY, description: "Nakit", method: "cash" }));
    const t = await must("kasadan bankaya", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "800", date: TODAY, bankAccountId: acc.garanti.id }));
    want.garanti += 800;
    const leg = ctx.store.get("SELECT event_id FROM cash_entries WHERE id = ?", t.bankId);
    const undo = match(ctx.db, acc.garanti.id, leg.event_id, 80000);
    expectStatus(await ctx.api.del(`/api/workspace/cash/${t.id}?cashForce=1`), 409, "bank-reconciled", "sil");
    expectStatus(await ctx.api.put(`/api/workspace/cash/${t.id}`, { kind: "out", amount: "500", date: TODAY, description: "x" }), 409, "bank-reconciled", "tutar");
    await check("E6 eşleşmiş");
    undo();
    await must("eşleşme kalktı: sil", ctx.api.del(`/api/workspace/cash/${t.id}?cashForce=1`));
    want.garanti -= 800;
    await check("E6 sonrası");
  });

  it("E8: Taksite Aktar eşleşmiş kayıt tahsilatını karta taşır; olay, hesap ve eşleşme aynı kalır; Geri Al ile yine aynı", async () => {
    const matrix = [
      ["Ad Soyad", "Telefon", "Ekim 2026 taksiti", "Kasım 2026 taksiti", "Toplam", "Ödenen"],
      ["Ayşe Kaya", "0532 444 55 66", "5.000", "5.000", "10.000", ""],
    ];
    const staged = await must("yükle", ctx.api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
    await must("onayla", ctx.api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const rows = (await ctx.api.client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const key = rows.find(row => row["Ad Soyad"] === "Ayşe Kaya").__hofKey;
    const pay = await must("havale kayıt tahsilatı", ctx.api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "1.200", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id, caseTitle: "Ayşe Kaya" }));
    want.ziraat += 1200;
    const before = { ...ctx.store.get("SELECT event_id, fin_ref, method FROM payments WHERE id = ?", pay.id) };
    match(ctx.db, acc.ziraat.id, before.event_id, 120000);
    const preview = await must("ön izleme", ctx.api.get("/api/workspace/plans/from-table"));
    const result = await must("Taksite Aktar", ctx.api.post("/api/workspace/plans/from-table", { keys: [key], fingerprint: preview.fingerprint }));
    assert.equal(result.paymentsMoved, 1);
    const onCard = { ...ctx.store.get("SELECT event_id, fin_ref, method FROM plan_entries WHERE event_id = ?", before.event_id) };
    assert.deepEqual(onCard, before, "satır karta taşındı; olay, hesap ve yol aynı");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", before.event_id).n, 1, "eşleşme korunur");
    await check("E8 Taksite Aktar");
    await must("geri al", ctx.api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.deepEqual({ ...ctx.store.get("SELECT event_id, fin_ref, method FROM payments WHERE id = ?", pay.id) }, before, "geri alınınca aynı satır");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", before.event_id).n, 1, "eşleşme hâlâ geçerli");
    expectStatus(await ctx.api.del(`/api/workspace/payments/${pay.id}`), 409, "bank-reconciled", "geri alınan eşleşmiş satır silinmez");
    await check("E8 geri al");
  });
});
