// Yargıç sondası 5: bağlı satır silinir (Silinenler) → banka hesabı silinir → satır geri yüklenir. Satır silinmiş hesaba bağlanır mı?
import { BANK, bootBank, TODAY } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
for (const variant of ["cari", "kasa-transfer", "kart"]) {
  const ctx = await bootBank();
  const { api, store } = ctx;
  try {
    const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: variant === "kart" ? "card" : "demand", ...(variant === "kart" ? { creditLimit: "5.000" } : {}), opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
    const c = (await api.post("/api/workspace/accounts", { name: "Cari C", type: "customer", registeredOn: "2026-10-01" })).data;
    let kind;
    let ref;
    if (variant === "cari" || variant === "kart") {
      const r = await api.post(`/api/workspace/accounts/${c.id}/entries`, variant === "kart" ? { kind: "out", method: "card", bankAccountId: A.id, date: TODAY, amount: "300" } : { kind: "in", method: "bank", bankAccountId: A.id, date: TODAY, amount: "1.000" });
      log(variant, "satır", r.status, r.code || "");
      const del = await api.del(`/api/workspace/accounts/${c.id}/entries/${r.data.entryId}`);
      log(variant, "satır sil", del.status, del.code || "", (del.error || "").slice(0, 120));
      kind = "account-entry";
      ref = r.data.entryId;
    } else {
      const r = await api.post("/api/workspace/cash/transfer", { direction: "to-bank", bankAccountId: A.id, amount: "500", date: TODAY });
      log(variant, "kasadan bankaya", r.status, r.code || "", JSON.stringify(r.data).slice(0, 200));
      const id = store.get("SELECT id FROM cash_entries WHERE fin_ref = ?", A.id)?.id;
      const del = await api.del(`/api/workspace/cash/${id}`);
      log(variant, "transfer sil", del.status, del.code || "", (del.error || "").slice(0, 160));
    }
    log(variant, "bağlı satır sayısı (etkin)", store.get("SELECT COUNT(*) AS n FROM account_entries WHERE fin_ref = ?", A.id).n, store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE fin_ref = ?", A.id).n);
    const delAcc = await api.del(`${BANK}/accounts/${A.id}`);
    log(variant, "hesabı sil", delAcc.status, delAcc.code || "", (delAcc.error || "").slice(0, 160));
    const trash = (await api.get("/api/admin/trash")).data;
    const items = (trash.items || trash.rows || trash).filter(item => !item.restoredAt);
    log(variant, "Silinenler", JSON.stringify(items.map(i => [i.kind, i.ref])).slice(0, 300));
    for (const item of items.filter(i => i.kind !== "bank-account")) {
      const res = await api.post("/api/admin/trash/restore", { id: item.id });
      log(variant, "geri yükle", item.kind, res.status, res.code || "", (res.error || "").slice(0, 200));
    }
    const rows = [
      ...store.all("SELECT 'account_entries' t, id, fin_ref FROM account_entries WHERE fin_ref <> ''"),
      ...store.all("SELECT 'cash_entries' t, id, fin_ref FROM cash_entries WHERE fin_ref <> ''"),
    ];
    for (const row of rows) {
      const acc = store.get("SELECT deleted_at, status FROM bank_accounts WHERE id = ?", row.fin_ref);
      log(variant, "bağlı satır", row.t, "hesap silinmiş mi:", Boolean(acc?.deleted_at), "durum", acc?.status);
    }
    const sum = await api.get(`${BANK}/summary`);
    log(variant, "Gerçek Banka", sum.data?.realBank?.minor, "Kart borcu", sum.data?.debt?.cardMinor, "Hesabı Atanmamış", sum.data?.unassigned?.totalMinor);
    const subs = (await api.get(`${BANK}/sub-trial`)).data;
    log(variant, "alt mizan", JSON.stringify(subs.rows.map(r => [r.sub, r.balance, r.name])));
    const integ = await integrityOf(api);
    log(variant, "mutabakat", integ.ok, JSON.stringify(integ.failures || []).slice(0, 300));
  } finally {
    await ctx.server.close();
  }
}
