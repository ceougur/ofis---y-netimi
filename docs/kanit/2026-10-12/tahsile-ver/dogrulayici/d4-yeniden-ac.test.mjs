// Bağımsız doğrulayıcı (tur 1) — "kapandıktan sonra hesabı değiştir, sonra Geri Al ile kaydı YENİDEN AÇ" sırası.
// Kural (uygulayıcı): tahsildeki evrakı olan hesap pasife alınamaz / türü değişemez (409 bank-cheques-pending). Ama kayıt tahsilde değilken
// (tahsil edildi ya da karşılıksız döndü) hesap pasife alınır / türü değişir; sonra tahsil ya da karşılıksız GERİ ALINIRSA kayıt yeniden
// "Bankada Tahsilde" olur (reopenFor) — hesap uygunluğu yeniden denetleniyor mu?
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOf } from "../../../../../test/banka-210-ortak.mjs";
import { TODAY, bootBank, must, openAccount } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CHEQUES = "/api/workspace/cheques";
const BANK = "/api/workspace/bank";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const short = res => ({ status: res.status, code: res.code, error: res.error });
const log = (label, value) => console.log(`[d4] ${label}: ${JSON.stringify(value)}`);
const pendingOn = (store, chequeId) => store.get("SELECT k.status, a.status AS accountStatus, a.kind, a.currency FROM cheque_collections k JOIN bank_accounts a ON a.id = k.bank_account_id WHERE k.cheque_id = ? ORDER BY k.rowid DESC LIMIT 1", chequeId);

describe("D4 — kapanmış tahsil kaydı Geri Al ile yeniden açılırken hesap uygunluğu", () => {
  let ctx, buyer;
  before(async () => {
    ctx = await bootBank();
    buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => ctx.server.close());

  it("A: tahsile ver → karşılıksız → hesabı PASİFE al → karşılıksızı Geri Al → kayıt pasif hesapta yeniden 'Bankada Tahsilde' mi?", async () => {
    const x = await openAccount(ctx.api, { bankName: "Akbank", name: "Tahsil A", kind: "demand", currency: "TRY" });
    const cheque = await must("çek", ctx.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", accountId: buyer.id, serialNo: "D4-A" }));
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: x.id }));
    const pendingPassive = await ctx.api.post(`${BANK}/accounts/${x.id}/status`, { status: "passive" });
    log("A bekleyenken pasif", short(pendingPassive));
    await must("karşılıksız", act(ctx.api, cheque.id, { action: "bounce", date: TODAY }));
    const passive = await ctx.api.post(`${BANK}/accounts/${x.id}/status`, { status: "passive" });
    log("A karşılıksızdan sonra pasif", short(passive));
    const undo = await ctx.api.post(`${CHEQUES}/${cheque.id}/undo`, {});
    log("A karşılıksızı geri al", short(undo));
    const state = pendingOn(ctx.store, cheque.id);
    log("A kayıt / hesap", state);
    const collect = await act(ctx.api, cheque.id, { action: "collect", date: TODAY });
    log("A tahsil", short(collect));
    const result = await integrityOf(ctx.api);
    log("A mutabakat", { ok: result.ok, bad: result.checks.filter(item => !item.ok).map(item => item.code) });
    assert.ok(!(undo.status === 200 && state.status === "pending" && state.accountStatus !== "active"), "Geri Al tahsildeki evrakı PASİF hesapta yeniden açtı (kural: tahsildeki evrakın hesabı pasif olamaz)");
  });

  it("B: tahsile ver → karşılıksız → hesap türü Vadesiz → Vadeli → karşılıksızı Geri Al → kayıt Vadeli hesapta mı?", async () => {
    const y = await openAccount(ctx.api, { bankName: "Akbank", name: "Tahsil B", kind: "demand", currency: "TRY" });
    const cheque = await must("çek", ctx.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "700", issueDate: "2026-10-05", dueDate: "2026-10-31", accountId: buyer.id, serialNo: "D4-B" }));
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: y.id }));
    await must("karşılıksız", act(ctx.api, cheque.id, { action: "bounce", date: TODAY }));
    const kind = await ctx.api.put(`${BANK}/accounts/${y.id}`, { kind: "time" });
    log("B tür → Vadeli", short(kind));
    const undo = await ctx.api.post(`${CHEQUES}/${cheque.id}/undo`, {});
    log("B karşılıksızı geri al", short(undo));
    const state = pendingOn(ctx.store, cheque.id);
    log("B kayıt / hesap", state);
    const collect = await act(ctx.api, cheque.id, { action: "collect", date: TODAY });
    log("B tahsil", short(collect));
    const result = await integrityOf(ctx.api);
    log("B mutabakat", { ok: result.ok, bad: result.checks.filter(item => !item.ok).map(item => item.code) });
    assert.ok(!(undo.status === 200 && state.status === "pending" && state.kind === "time"), "Geri Al tahsildeki evrakı tahsile UYGUN OLMAYAN (Vadeli) hesapta yeniden açtı");
  });

  it("C: tahsile ver → tahsil → hesabı pasife al → tahsili Geri Al → kayıt pasif hesapta mı?", async () => {
    const z = await openAccount(ctx.api, { bankName: "Akbank", name: "Tahsil C", kind: "demand", currency: "TRY" });
    const cheque = await must("çek", ctx.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "400", issueDate: "2026-10-05", dueDate: "2026-10-31", accountId: buyer.id, serialNo: "D4-C" }));
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: z.id }));
    await must("tahsil", act(ctx.api, cheque.id, { action: "collect", date: TODAY }));
    const passive = await ctx.api.post(`${BANK}/accounts/${z.id}/status`, { status: "passive" });
    log("C tahsilden sonra pasif", short(passive));
    const undo = await ctx.api.post(`${CHEQUES}/${cheque.id}/undo`, {});
    log("C tahsili geri al", short(undo));
    const state = pendingOn(ctx.store, cheque.id);
    log("C kayıt / hesap", state);
    const result = await integrityOf(ctx.api);
    log("C mutabakat", { ok: result.ok, bad: result.checks.filter(item => !item.ok).map(item => item.code) });
    assert.ok(!(undo.status === 200 && state.status === "pending" && state.accountStatus !== "active"), "Geri Al tahsildeki evrakı PASİF hesapta yeniden açtı");
  });
});
