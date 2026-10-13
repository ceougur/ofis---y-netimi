// Bağımsız doğrulayıcı (tur 2) — ek denemeler: zil/takvim önbelleği (banka adı, hafta sonu ayarı), dönemli Alt Hesap Mizanı (bağımsız beklenen),
// tür değişikliği (kapanmış kaydı olan hesap → Vadeli), çek kartında Geri Al etiketi. Sahte saat 08.10.2026 Perşembe.
// Koşum: node --test --test-concurrency=1 docs/kanit/2026-10-12/tahsile-ver/dogrulayici-2/t2-ek.test.mjs
import { after, before, describe, it } from "node:test";
import { integrityOf } from "../../../../../test/banka-210-ortak.mjs";
import { BANK, bootBank, must, openAcceptanceAccounts, openAccount } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const log = (label, value) => console.log(`[t2-ek] ${label}: ${JSON.stringify(value)}`);
const receive = (api, body) => must(`çek al ${body.serialNo || ""}`, api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body }));

describe("zil/takvim, Vade Takip ve Nakit Akış aynı gün ve aynı banka adı mı (ayar ve ad değişince)", () => {
  let ctx;
  let acc;
  let buyer;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => ctx.server.close());

  it("B1 banka adı değişince; B1b hafta sonu 'Yalnız Pazar' olunca", async () => {
    const { api } = ctx;
    // Vade 10.10.2026 Cumartesi → iş günü 12.10 Pazartesi; 7 gün içinde (zilde görünür).
    const c = await receive(api, { serialNo: "Z1", accountId: buyer.id, dueDate: "2026-10-10" });
    await must("ver", act(api, c.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    const zil = async () => (await must("dues", api.get("/api/workspace/dues"))).items.filter(item => item.chequeId === c.id).map(item => [item.dueDate, item.label]);
    const vade = async () => (await must("vade", api.get("/api/workspace/overview/vade-takip?preset=all"))).rows?.filter(row => row.ref?.id === c.id).map(row => [row.date, row.label]);
    log("B1 önce zil", await zil());
    log("B1 önce vade takip", await vade().catch(error => String(error).slice(0, 200)));
    await must("ad değiştir", api.put(`${BANK}/accounts/${acc.ziraat.id}`, { bankName: "T.C. Ziraat Bankası A.Ş." }));
    log("B1 ad değişti → zil", await zil());
    log("B1 ad değişti → vade takip", await vade().catch(error => String(error).slice(0, 200)));
    const settings = await must("ayarlar", api.get(`${BANK}/settings`));
    const put = await api.put(`${BANK}/settings`, { ...(settings.values || settings), holidayAdvanced: { ...((settings.values || settings).holidayAdvanced || {}), weekend: "sun" } });
    log("B1b hafta sonu Yalnız Pazar", { status: put.status, code: put.code, error: put.error });
    log("B1b → zil", await zil());
    log("B1b → vade takip", await vade().catch(error => String(error).slice(0, 200)));
  });
});

describe("dönemli Alt Hesap Mizanı ve Yevmiye — bağımsız beklenen (planın maddeleri, elle)", () => {
  let ctx;
  let acc;
  let buyer;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => ctx.server.close());

  it("B8 al 05.10 · ver Z 06.10 · geri al 07.10 · ver G 07.10 → dönem 07.10–08.10", async () => {
    const { api } = ctx;
    const c = await receive(api, { serialNo: "M1", accountId: buyer.id, amount: "1.000" });
    await must("ver Z", act(api, c.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    await must("geri al", act(api, c.id, { action: "bank-withdraw", date: "2026-10-07" }));
    await must("ver G", act(api, c.id, { action: "bank-deposit", date: "2026-10-07", bankAccountId: acc.garanti.id }));
    const sub = await must("alt hesap", api.get(`${BANK}/sub-trial?from=2026-10-07&to=2026-10-08`));
    const rows = Object.fromEntries(sub.rows.filter(row => row.account === "101").map(row => [row.sub, [row.opening, row.debit, row.credit, row.balance]]));
    // Beklenen (elle, planın yevmiyesinden): 101.01 açılış 1000−1000=0, borç 1000 (geri al), alacak 1000 (ver G), bakiye 0;
    // 101.02 açılış 1000, borç 1000, alacak 1000, bakiye 1000.
    log("B8 dönem 101.x [açılış, borç, alacak, bakiye]", rows);
    log("B8 beklenen", { "101.01": [0, 1000, 1000, 0], "101.02": [1000, 1000, 1000, 1000] });
    log("B8 ana hesaplar", sub.mains.filter(main => main.account === "101"));
    const whole = await must("alt hesap tüm", api.get(`${BANK}/sub-trial`));
    log("B8 tüm zamanlar 101.x", Object.fromEntries(whole.rows.filter(row => row.account === "101").map(row => [row.sub, [row.opening, row.debit, row.credit, row.balance]])));
    const ledger = await must("mizan", api.get("/api/workspace/ledger"));
    log("B8 Hesap Planı Mizanı 101", ledger.trial.accounts.filter(row => row.code === "101"));
    const j = await must("yevmiye 07.10", api.get("/api/workspace/report-center/yevmiye?from=2026-10-07&to=2026-10-07"));
    log("B8 yevmiye 07.10", j.rows.map(row => [row[1], row[3], row[4], row[5]]));
    const d = await api.get("/api/workspace/report-center/defter-mutabakati");
    log("B8 Defter Mutabakatı raporu", { status: d.status, rows: d.data?.rows?.filter(row => String(row).includes("101") || String(row).includes("Tahsil")) });
    const r = await integrityOf(api);
    log("B8 mutabakat", { ok: r.ok, bad: r.checks.filter(item => !item.ok).map(item => item.code) });
  });

  it("B9 kapanmış kaydı olan hesabın türü Vadeli; ardından aynı çek o hesaba tahsile verilemez; tarih karşılaştırması", async () => {
    const { api, store } = ctx;
    const empty = await openAccount(api, { bankName: "Halkbank", name: "Boş", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const c = await receive(api, { serialNo: "M2", accountId: buyer.id, amount: "500" });
    await must("ver", act(api, c.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: empty.id }));
    await must("geri al", act(api, c.id, { action: "bank-withdraw", date: "2026-10-06" }));
    const kind = await api.put(`${BANK}/accounts/${empty.id}`, { kind: "time" });
    log("B9 tür Vadeli", { status: kind.status, code: kind.code, error: kind.error });
    log("B9 hesap", store.get("SELECT kind FROM bank_accounts WHERE id = ?", empty.id));
    const r = await integrityOf(api);
    log("B9 mutabakat", { ok: r.ok, bad: r.checks.filter(item => !item.ok).map(item => [item.code, item.sample]) });
    const again = await act(api, c.id, { action: "bank-deposit", date: "2026-10-08", bankAccountId: empty.id });
    log("B9 Vadeli'ye yeniden ver", { status: again.status, code: again.code });
    const card = await must("kart", api.get(`${CHEQUES}/${c.id}`));
    log("B9 çek kartı geçmişi", card.collections.map(item => [item.status, item.bankLabel, item.givenDate, item.closedDate]));
  });
});
