// Ç5-A tur 2d İş 2 sondası (c5a2-betik/pos-bag.mjs'ten; ek: faturanın banka olayları, Ters Kaydet, iptal). Ç5-A tur 2 İş 6 — dar kontrol K-b (i) DOĞRULANMADI: POS komisyon faturasının kaydı (programın KENDİ yolu: Şimdi Oluştur → Kaydet) kilitli aydaki kesinti / iade satırlarına
// bağ YAZIYOR mu ve sağlayıcı carisinin açık şüphelisi varken kilitli defter değişiyor mu? ROOT=<kod> node pos-bag.mjs [supheli=1|0]
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const DOUBTFUL = process.argv[2] !== "0";
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { BANK, bootBank, must, openPos, settle, ziraatPos } = await imp("test/banka-220-pos-ortak.mjs");
const LOCK = "2026-09-30";
const out = { kod: ROOT, supheli: DOUBTFUL };
const ctx = await bootBank({ now: "2026-09-02T10:00:00+03:00" });
const app = ctx.server.app;
const st = r => `${r.status}${r.status >= 400 ? " " + JSON.stringify(r.data).slice(0, 200) : ""}`;
const lockedLines = () => {
  const m = new Map();
  for (const e of app.ledger.build()) {
    if (!(String(e.date) <= LOCK)) continue;
    for (const l of e.lines || []) {
      const key = `${e.date}|${l.account}|${l.party ? "cari" : ""}|B${l.debit || 0}|A${l.credit || 0}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
  }
  return m;
};
const diff = (a, b) => {
  const d = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) { const n = (b.get(key) || 0) - (a.get(key) || 0); if (n) d.push(`${n > 0 ? "+" : "-"}${key}`); }
  return d.sort();
};
const card = async id => (await must("cari", ctx.api.get(`/api/workspace/accounts/${id}`))).totals;
try {
  const ziraat = await must("Ziraat", ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-09-01", amount: "100.000", confirmed: true } }));
  const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
  const customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  await openPos(ctx.api, { ...ziraatPos(ziraat.id, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }), validFrom: "2026-09-01", refundCommission: "full" });
  await must("satış 1", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-09-02" }));
  await must("satış 2", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "12.000", method: "card", date: "2026-09-02" }));
  ctx.server.clock.set("2026-09-08T10:00:00+03:00");
  await settle(ctx.api);
  out.kesintidenSonraSaglayici = await card(provider.id);
  if (DOUBTFUL) out.supheliyeAlma = st(await ctx.api.post(`/api/workspace/accounts/${provider.id}/doubtful`, { amount: 200, date: "2026-09-09", reason: "lawsuit", note: "İş 6" }));
  const sales = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales`))).sales;
  ctx.server.clock.set("2026-09-10T10:00:00+03:00");
  out.iade = st(await ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "out", amount: "10.000", method: "card", date: "2026-09-10", posRefundOf: sales[0].id }));
  ctx.server.clock.set("2026-09-15T10:00:00+03:00");
  await settle(ctx.api);
  out.bankaSatirlari = app.store.all("SELECT kind, amount, date, invoice_id AS inv FROM account_entries WHERE source = 'bank' AND account_id = ? ORDER BY date, created_at", provider.id);
  ctx.server.clock.set("2026-10-08T12:00:00+03:00");
  out.kilit = st(await ctx.api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
  await app.ledger.snapshots?.runPending?.();
  const created = await must("Eylül taslağı", ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-09" }));
  out.taslak = created.created.map(row => ({ net: row.netMinor }));
  const once = lockedLines();
  const s0 = await card(provider.id);
  const logBefore = app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n;
  out.kaydet = st(await ctx.api.post(`/api/workspace/invoices/${created.created[0].invoiceId}/issue`, { number: "OK-EYL", force: true }));
  out.bagdanSonraBankaSatirlari = app.store.all("SELECT kind, amount, date, (invoice_id <> '') AS bagli FROM account_entries WHERE source = 'bank' AND account_id = ? ORDER BY date, created_at", provider.id);
  out.kilitliDonemDefterFarki = diff(once, lockedLines());
  out.tarama = (app.integrity.scan().findings || []).map(f => f.code);
  out.gunlukArtisi = app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n - logBefore;
  out.saglayiciOnce = s0;
  out.saglayiciSonra = await card(provider.id);
  const invId = created.created[0].invoiceId;
  out.fatura = app.store.get("SELECT kind, status, issue_date AS d, account_id = ? AS saglayici FROM invoices WHERE id = ?", provider.id, invId);
  out.olaylar = app.store.all("SELECT id, no, type, src_table AS src, date, status FROM fin_events WHERE invoice_id = ?", invId);
  out.bagliIn = app.store.all("SELECT kind, date FROM account_entries WHERE invoice_id = ?", invId);
  const before2 = lockedLines();
  out.tersKaydet = [];
  for (const ev of out.olaylar) out.tersKaydet.push({ no: ev.no, type: ev.type, sonuc: st(await ctx.api.post(`${BANK}/events/${ev.id}/reverse`, { reason: "deneme" })) });
  out.iptal = st(await ctx.api.post(`/api/workspace/invoices/${invId}/cancel`, { reason: "deneme" }));
  out.tersSonrasiDefterFarki = diff(before2, lockedLines());
} catch (e) { out.HATA = String(e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 1));
await ctx.server.close();
