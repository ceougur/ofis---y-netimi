// Eleştirmen 2.2.0 — e3: yedekten geri yükleme ile bekleyen POS kalemi (002 şirketinde; 001'in geri yüklemesi yeniden başlatmayla uygulanır).
// Yedek tatbikatı (CLAUDE.md): yedek → çalış → geri yükle → sayılar → yeniden çalış. Beklenen §4.4 (tek net fiş, her gün kendi tarihiyle) ve el hesabı.
// Koşu: node docs/kanit/2026-10-12/elestirmen-220/e3-geri-yukle-002.mjs
import { BANK, bootBank as bootBase, must, openAcceptanceAccounts, subBalances } from "../../../../test/banka-210-hesap-ortak.mjs";
import { ADMIN_PASSWORD } from "../../../../test/helpers.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const posBody = (accId, extra = {}) => ({
  name: "Ziraat Fiziki POS", bankAccountId: accId, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly",
  provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }], ...extra,
});
const setDay = (ctx, d) => ctx.server.clock.set(`${d}T12:00:00+03:00`);
async function bootBank() {
  const ctx = await bootBase({ maxCompanies: 2 });
  const created = await must("002", ctx.api.post("/api/companies", { name: "Geri Yükleme Şirketi", select: false }));
  const co = created.company || created;
  const q = `hofCompany=${encodeURIComponent(co.id)}`;
  const w = p => p + (p.includes("?") ? "&" : "?") + q;
  const api = { get: p => ctx.api.get(w(p)), post: (p, b) => ctx.api.post(w(p), b), put: (p, b) => ctx.api.put(w(p), b) };
  return { server: ctx.server, root: ctx.api, api, co: { id: co.id, code: co.code } };
}
const bal = async (ctx, id) => (await must("hesap", ctx.api.get(`${BANK}/accounts/${id}`))).balanceMinor / 100;
const integ = async ctx => {
  const r = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
  return r.ok ? true : (r.failures || []).map(f => f.code || f.label).slice(0, 5);
};
const companyOf = async ctx => ctx.co;
const backup = async (ctx, co) => (await must("yedek", ctx.root.post("/api/admin/backups", { scope: "one", companyId: co.id }))).backups[0].name;
const restore = (ctx, co, name) => ctx.root.post("/api/admin/backups/restore", { name, company: co.id, confirm: co.code, password: ADMIN_PASSWORD });
const posDayVouchers = async ctx => {
  const mv = await must("hareketler", ctx.api.get(`${BANK}/movements?limit=500`));
  return mv.rows.filter(r => /POS Gün Sonu/.test(JSON.stringify(r))).map(r => r.date);
};
{
  // R1: satış (bekliyor) → yedek → 12.10 aktarım → geri yükle → aktarım: Ziraat tam bir kez +9.750
  const ctx = await bootBank();
  const co = await companyOf(ctx);
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await must("POS", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id)));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  const b1 = await backup(ctx, co);
  setDay(ctx, "2026-10-12");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("R1-0", "geri yüklemeden önce Ziraat 109.750", 109750, await bal(ctx, acc.ziraat.id));
  const rs = await restore(ctx, co, b1);
  check("R1-1", "geri yükle durum", 200, rs.status);
  if (rs.status !== 200) console.log("   ", rs.code, rs.error);
  const sum0 = await must("özet", ctx.api.get(`${BANK}/summary`));
  const cal0 = await must("takvim", ctx.api.get(`${BANK}/pos/calendar`));
  console.log("   geri yükleme hemen sonra (önce özet): due=", JSON.stringify(sum0.posPending.due), "net=", sum0.posPending.netMinor, "takvim=", JSON.stringify(cal0.rows.map(r => [r.valueDate, r.netMinor, r.due])));
  await new Promise(r => setTimeout(r, 300));
  console.log("   300 ms sonra (aktar YOK) Ziraat:", await bal(ctx, acc.ziraat.id));
  const afterRestore = await bal(ctx, acc.ziraat.id);
  const sumR = await must("özet", ctx.api.get(`${BANK}/summary`));
  console.log("   geri yüklemeden hemen sonra Ziraat:", afterRestore, "valörü gelmiş aktarılmadı:", JSON.stringify(sumR.posPending.due));
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("R1-2", "geri yükle + aktar → Ziraat 109.750 (çift fiş yok)", 109750, await bal(ctx, acc.ziraat.id));
  const subs = await subBalances(ctx.api);
  check("R1-3", "108.01 = 0, 102.01 = 109.750", [0, 109750], [subs["108.01"]?.balance ?? 0, subs["102.01"]?.balance ?? null]);
  check("R1-4", "POS Gün Sonu fişi sayısı 1, tarih 12.10", ["2026-10-12"], await posDayVouchers(ctx));
  check("R1-5", "Mutabakat", true, await integ(ctx));
  // R2: aktarımdan SONRA yedek → valörden sonra iade + aktarım → geri yükle → iade yok; yeniden iade → aynı sonuç
  const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
  const b2 = await backup(ctx, co);
  setDay(ctx, "2026-10-13");
  await must("iade", ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "3.000", date: "2026-10-13" }));
  setDay(ctx, "2026-10-20");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("R2-0", "iade aktarıldı: Ziraat 106.750", 106750, await bal(ctx, acc.ziraat.id));
  const rs2 = await restore(ctx, co, b2);
  check("R2-1", "geri yükle durum", 200, rs2.status);
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("R2-2", "geri yükleme sonrası Ziraat 109.750, iade sayısı 0", [109750, 0], [await bal(ctx, acc.ziraat.id), (await must("iadeler", ctx.api.get(`${BANK}/pos/sales?kind=refund`))).sales.length]);
  const again = await ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "3.000", date: "2026-10-20" });
  setDay(ctx, "2026-10-30");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("R2-3", "yeniden iade (200) → Ziraat 106.750, Mutabakat", [200, 106750, true], [again.status, await bal(ctx, acc.ziraat.id), await integ(ctx)]);
  await ctx.server.close();
}
{
  // R3: yedek (bekleyen kalem, 08.10) → saat 20.10'a atlar (aradaki valör kaçırılmış) → geri yükle → aktar: fiş 12.10 tarihli, tutar 9.750 bir kez
  const ctx = await bootBank();
  const co = await companyOf(ctx);
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await must("POS", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id)));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  const b1 = await backup(ctx, co);
  // yedekten sonra ikinci satış (geri yüklemeyle kaybolmalı)
  await must("satış 2", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "5.000", method: "card", date: "2026-10-08", similarOk: true }));
  setDay(ctx, "2026-10-20");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("R3-0", "geri yüklemeden önce Ziraat 100.000 + 9.750 + 4.875", 114625, await bal(ctx, acc.ziraat.id));
  // kilit 15.10 (iki fiş 12.10'da, kilitli dönemde)
  const lk = await ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-15" });
  check("R3-1", "kilit 15.10", 200, lk.status);
  const rs = await restore(ctx, co, b1);
  console.log("   geri yükle:", rs.status, rs.code || "", rs.error || "");
  const lock = await ctx.api.get("/api/admin/period-lock");
  console.log("   geri yükleme sonrası kilit:", JSON.stringify(lock.data));
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("R3-2", "geri yükle + aktar → Ziraat 109.750", 109750, await bal(ctx, acc.ziraat.id));
  check("R3-3", "Mutabakat", true, await integ(ctx));
  console.log("   POS Gün Sonu:", JSON.stringify(await posDayVouchers(ctx)));
  await ctx.server.close();
}
const bad = out.filter(x => !x.ok);
console.log(`\nTOPLAM ${out.length} denetim, FARK ${bad.length}: ${bad.map(x => x.id).join(", ")}`);
process.exitCode = bad.length ? 1 : 0;
