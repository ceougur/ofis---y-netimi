// Yargıç 2.2.0 — p3: POS sil → geri yükle (valörden SONRA), Şirket Verisini Sıfırla (POS + tahsile ver), ?hofCompany= (002'de POS),
// ANLIK DURUM ↔ POS Ödeme Takvimi ↔ mizan 108, "Tüm Zamanlar" yan etkisi (Çek/Senet Portföyü, Vade Dağılımı, Taksit Vade Listesi).
// Beklenenler plan §4.6 (Kayıt Hatası Silme), §5.6, §9.2/11 ve el hesabından. Koşu: node docs/kanit/2026-10-12/yargic-220/p3.mjs
import { apiOf } from "../../../../test/banka-210-ortak.mjs";
import { BANK, bootBank, must, openAcceptanceAccounts, trialBalances, subBalances } from "../../../../test/banka-210-hesap-ortak.mjs";
import { createUser } from "../../../../test/helpers.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const note = (id, value) => console.log(`NOT   [${id}] ${JSON.stringify(value).slice(0, 700)}`);
const posBody = (accId, extra = {}) => ({
  name: "Ziraat Fiziki POS", bankAccountId: accId, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly",
  provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01",
  rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }], ...extra,
});
const integ = async api => {
  const r = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  return { ok: r.ok, failures: (r.failures || []).map(f => [f.code, f.name || f.label]).slice(0, 6) };
};
const bal = async (api, id) => (await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor / 100;

// ---------- E: valörden sonra POS'lu cari tahsilatı sil (Kayıt Hatası) → geri yükle ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await must("POS", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id)));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const entry = await must("POS tahsilatı", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  ctx.server.clock.set("2026-10-13T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("E1", "valör sonrası Ziraat", 109750, await bal(ctx.api, acc.ziraat.id));
  const del = await ctx.api.del(`/api/workspace/accounts/${party.id}/entries/${entry.entryId || entry.id}`);
  note("E2-sil", [del.status, del.code, del.error]);
  if (del.status === 200) {
    // §4.6: bankaya geçmişse bank.replan → gün fişi ters; Ziraat 100.000; 653 0; 108 0
    check("E3", "sildikten sonra Ziraat (gün fişi ters)", 100000, await bal(ctx.api, acc.ziraat.id));
    const tb = await trialBalances(ctx.api);
    check("E4", "sildikten sonra 108 / 653 / 120", [0, 0, 0], [tb["108"] ?? 0, tb["653"] ?? 0, tb["120"] ?? 0]);
    check("E5", "Mutabakat", true, (await integ(ctx.api)).ok);
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const item = (Array.isArray(trash) ? trash : trash.items || []).find(t => t.ref === (entry.entryId || entry.id));
    note("E6-çöp", item ? { id: item.id, kind: item.kind } : "bulunamadı");
    if (item) {
      const res = await ctx.api.post("/api/admin/trash/restore", { id: item.id });
      note("E7-geri", [res.status, res.code, res.error]);
      await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
      check("E8", "geri yükleme sonrası Ziraat (valör geçmiş: 109.750)", 109750, await bal(ctx.api, acc.ziraat.id));
      const tb2 = await trialBalances(ctx.api);
      check("E9", "geri yükleme sonrası 108 / 653 / 120", [0, 250, -10000], [tb2["108"] ?? 0, tb2["653"] ?? 0, tb2["120"] ?? 0]);
      const sales = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales`))).sales;
      note("E10-satışlar", sales.map(s => [s.kind, s.status, s.grossMinor, s.items.map(i => [i.status, i.valueDate, i.netMinor])]));
      check("E11", "Mutabakat", true, (await integ(ctx.api)).ok);
    }
  }
  await ctx.server.close();
}

// ---------- F: Şirket Verisini Sıfırla (Tüm Hareketleri Sil) — POS bekleyen kalem + tahsildeki çek varken ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api, { useCheque: true, useNote: true });
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  const p = (await must("POS", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id)))).pos;
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS 3 taksit", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "12.000", method: "card", installments: 3, date: "2026-10-08" }));
  const cq = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-02", dueDate: "2026-11-20", accountId: party.id, serialNo: "R1", bank: "Akbank" }));
  await must("tahsile ver", ctx.api.post(`/api/workspace/cheques/${cq.id}/actions`, { action: "bank-deposit", date: "2026-10-08", bankAccountId: acc.ziraat.id }));
  const companies = await must("şirketler", ctx.api.get("/api/companies"));
  const company = (companies.companies || companies)[0];
  const reset = await ctx.api.post(`/api/companies/${company.id}/reset`, { mode: "movements", confirm: company.code, password: "Test-Admin-2026!" });
  note("F1-sıfırla", [reset.status, reset.code, reset.error]);
  const count = t => ctx.store.get(`SELECT COUNT(*) AS n FROM ${t}`).n;
  check("F2", "pos_sales / pos_items / cheque_collections / fin_events satırı", [0, 0, 0, 0], ["pos_sales", "pos_items", "cheque_collections", "fin_events"].map(count));
  check("F3", "POS kartı kalır (Tüm Hareketleri Sil)", 1, count("pos_terminals"));
  check("F4", "Mutabakat", true, (await integ(ctx.api)).ok);
  // yeniden çalış: aynı POS'a tahsilat, valör, banka
  const party2 = await must("cari 2", ctx.api.post("/api/workspace/accounts", { name: "XYZ", type: "customer", registeredOn: "2026-10-01" }));
  const re = await ctx.api.post(`/api/workspace/accounts/${party2.id}/entries`, { kind: "in", amount: "1.000", method: "card", date: "2026-10-08", posId: p.id });
  note("F5-yeni tahsilat", [re.status, re.code, re.error]);
  ctx.server.clock.set("2026-10-13T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  const tb = await trialBalances(ctx.api);
  note("F6-mizan", { 102: tb["102"], 108: tb["108"], 653: tb["653"], 101: tb["101"] });
  check("F7", "sıfırlama sonrası 108 / 653 (1.000 @ %2,5 → 25)", [0, 25], [tb["108"] ?? 0, tb["653"] ?? 0]);
  check("F8", "Mutabakat", true, (await integ(ctx.api)).ok);
  await ctx.server.close();
}

// ---------- G: ?hofCompany= — 002'de POS; 001'e yazılmaz; yetkisiz kişi 403 ----------
{
  const ctx = await bootBank();
  const c2 = await ctx.api.post("/api/companies", { name: "İkinci Şirket" });
  note("G0-şirket", [c2.status, c2.code, c2.error]);
  const list = await must("şirketler", ctx.api.get("/api/companies"));
  const second = (list.companies || list).find(c => c.code === "002");
  const q = `?hofCompany=${second.id}`;
  const w = (p, glue = "?") => (p.includes("?") ? `${p}&hofCompany=${second.id}` : `${p}${q}`);
  const z2 = await must("002 hesap", ctx.api.post(w(`${BANK}/accounts`), { bankName: "Ziraat Bankası", name: "002 TL", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
  await must("002 POS Kullan", ctx.api.put(w(`${BANK}/accounts/${z2.id}`), { usePos: true }));
  const p2 = (await must("002 POS", ctx.api.post(w(`${BANK}/pos`), posBody(z2.id, { name: "002 POS" })))).pos;
  const party = await must("002 cari", ctx.api.post(w("/api/workspace/accounts"), { name: "002 Müşteri", type: "customer", registeredOn: "2026-10-01" }));
  await must("002 POS tahsilatı", ctx.api.post(w(`/api/workspace/accounts/${party.id}/entries`), { kind: "in", amount: "2.000", method: "card", date: "2026-10-08" }));
  const pos001 = (await must("001 POS", ctx.api.get(`${BANK}/pos`))).pos;
  check("G1", "001'de POS yok", 0, pos001.length);
  const v001 = await ctx.api.get(`${BANK}/pos/${p2.id}`);
  check("G2", "002'nin POS kimliği 001'de 404", 404, v001.status);
  const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "y-muh", role: "muhasebe" }));
  const s002 = await staff.get(w(`${BANK}/pos`));
  note("G3-muhasebe 002 (atanmamış)", [s002.status, s002.code]);
  ctx.server.clock.set("2026-10-13T12:00:00+03:00");
  await must("002 aktar", ctx.api.post(w(`${BANK}/settle`), {}));
  check("G4", "002 Ziraat (1.000 + 1.950)", 2950, (await must("002 hesap", ctx.api.get(w(`${BANK}/accounts/${z2.id}`)))).balanceMinor / 100);
  const tb1 = await trialBalances(ctx.api);
  check("G5", "001 mizanında 108/653 yok", [0, 0], [tb1["108"] ?? 0, tb1["653"] ?? 0]);
  check("G6", "002 Mutabakat", true, (await must("m", ctx.api.get(w("/api/workspace/ledger/integrity")))).ok);
  await ctx.server.close();
}

// ---------- H: ANLIK DURUM ↔ takvim ↔ mizan 108; "Tüm Zamanlar" vade raporları ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api, { useCheque: true, useNote: true });
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await must("POS", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id)));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS 3 taksit", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "12.000", method: "card", installments: 3, date: "2026-10-08" }));
  await must("POS tek", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  const c1 = await must("çek 1", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-02", dueDate: "2026-12-01", accountId: party.id, serialNo: "H1", bank: "Akbank" }));
  await must("çek 2", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "note", amount: "500", issueDate: "2026-10-02", dueDate: "2027-02-01", accountId: party.id, serialNo: "H2" }));
  await must("çek 3 (geçmiş vade)", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "200", issueDate: "2026-10-01", dueDate: "2026-10-05", accountId: party.id, serialNo: "H3", bank: "Akbank" }));
  await must("tahsile ver", ctx.api.post(`/api/workspace/cheques/${c1.id}/actions`, { action: "bank-deposit", date: "2026-10-08", bankAccountId: acc.ziraat.id }));
  await must("taksit kartı", ctx.api.post("/api/workspace/plans", { accountId: party.id, name: party.name, total: "3.000", mode: "auto", count: 3, firstDue: "2026-10-15", registeredOn: "2026-09-01" }));
  // bağımsız beklenen: POS net bekleyen = 12.000 − 420 + 10.000 − 250 = 21.330; brüt 108 = 22.000
  const tb = await trialBalances(ctx.api);
  check("H1", "mizan 108 (brüt bekleyen)", 22000, tb["108"] ?? 0);
  const ov = JSON.stringify(await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview")));
  const posNet = Number((ov.match(/"posNet":(-?[\d.]+)/) || [])[1]);
  check("H2", "ANLIK DURUM POS Bekleyen (Net)", 21330, posNet);
  const cal = await must("takvim", ctx.api.get(`${BANK}/pos/calendar`));
  const calNet = (cal.rows || []).reduce((s, r) => s + r.netMinor, 0) / 100;
  check("H3", "POS Ödeme Takvimi net toplam", 21330, calNet);
  // Tüm Zamanlar (istemcinin gönderdiği biçim: from = 50 yıl önce, to = bugün, preset=all)
  const ALL = "?preset=all&from=1976-01-01&to=2026-10-08";
  const rc = async (id, qs) => must(id, ctx.api.get(`/api/workspace/report-center/${id}${qs}`));
  const sumMoney = (rep, col) => rep.rows.reduce((s, r) => s + Number(String(r[col]).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "") || 0), 0);
  const pt = await rc("pos-odeme-takvimi", ALL);
  check("H4", "POS Ödeme Takvimi (Tüm Zamanlar) net satır toplamı", 21330, Math.round(sumMoney(pt, 5) * 100) / 100);
  const cp = await rc("cek-portfoy", ALL);
  note("H5-çek portföy satırları", cp.rows.map(r => r.join(" | ")));
  check("H6", "Çek/Senet Portföyü (Tüm Zamanlar) satır sayısı (ileri vadeli dahil)", 3, cp.rows.length);
  const cpMonth = await rc("cek-portfoy", "?preset=thisMonth&from=2026-10-01&to=2026-10-31");
  check("H7", "Çek/Senet Portföyü (Bu Ay) yalnız Ekim vadeli (H3)", 1, cpMonth.rows.length);
  const tv = await rc("taksit-vadeleri", ALL);
  check("H8", "Taksit Vade Listesi (Tüm Zamanlar) 3 taksit (Ekim, Kasım, Aralık)", 3, tv.rows.length);
  const vd = await rc("cek-vade-dagilimi", "");
  note("H9-vade dağılımı", vd.rows.map(r => r.join(" | ")));
  note("H9b-vade dağılımı özet", vd.summary);
  // Kasa Hareketleri gibi vade OLMAYAN raporda Tüm Zamanlar ileri tarihli satırı göstermez mi (2.1.0 kuralı: bugüne kadar)
  await must("ileri tarihli? (Kasa)", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "10", date: "2026-10-08", description: "Bugün", method: "cash" }));
  const kh = await rc("kasa-hareketleri", ALL);
  note("H10-kasa-hareketleri subtitle", kh.subtitle);
  check("H11", "Mutabakat", true, (await integ(ctx.api)).ok);
  await ctx.server.close();
}

console.log("\nÖZET", out.filter(o => !o.ok).length, "fark /", out.length, "denetim");
process.exit(0);
