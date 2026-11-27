// UD tur 2 — mutabakat tohum 3'ün en küçük örneği programın GERÇEK HTTP uçlarıyla (taksitli FATURA + kendi kartına Taksit Tahsilatı).
// Kullanım: ROOT=<program kökü> node surucu3.mjs [--kilitsiz]
// Çıktı: adım yanıt kodları, cari bakiyesi, faturaların açığı, kartların taksitleri; programda Tek Yükümlülük Kuyruğu varsa Σ açık kalem.
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const kilitsiz = process.argv.includes("--kilitsiz");
const server = await startTestServer({ now: "2026-11-23T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = await loginAdmin(server);
const unwrap = r => r.data?.data ?? r.data;
const log = [];
const api = async (method, url, body, etiket) => {
  const r = method === "GET" ? await c.get(url) : method === "DELETE" ? await c.del(url) : await c[method.toLowerCase()](url, body);
  if (etiket) log.push(`${etiket}: ${r.status}${r.status === 200 ? "" : " " + JSON.stringify(r.data).slice(0, 300)}`);
  return { status: r.status, data: unwrap(r) };
};
try {
  const urun = (await api("POST", "/api/workspace/stock", { kind: "service", code: "UD-HZM", name: "Ud Hizmeti", unit: "Adet", salePrice: "100" }, "hizmet")).data?.id;
  const mal = (await api("POST", "/api/workspace/stock", { kind: "goods", code: "UD-MAL", name: "Ud Malı", unit: "Adet", openingQty: "100000", salePrice: "100" }, "mal")).data?.id;
  const cari = (await api("POST", "/api/workspace/accounts", { name: "Uc Musteri", type: "customer", registeredOn: "2026-07-01" }, "cari")).data;
  const id = cari?.id ?? cari?.account?.id;
  const fatura = async (tutar, tarih, taksit, etiket) => {
    const payment = taksit ? { rest: "installments", installments: { count: taksit.sayi, firstDue: taksit.ilkVade, everyMonths: 1 } } : { rest: "open", ...(process.env.F2_VADE && tutar === "250811.27" ? { dueDate: process.env.F2_VADE } : {}) };
    const r = await api("POST", "/api/workspace/invoices", { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 1, unitPrice: tutar, vatRate: 0 }], accountId: id, issueDate: tarih, payment }, etiket);
    return r.data?.id ?? r.data?.invoice?.id;
  };
  const F1 = await fatura("5944.84", "2026-08-16", { sayi: 6, ilkVade: "2026-09-02" }, "F1 taksitli satış 5.944,84");
  const C1 = (await api("GET", `/api/workspace/invoices/${F1}`)).data?.planId;
  await api("POST", `/api/workspace/accounts/${id}/entries`, { kind: "credit", amount: "32083.69", date: "2026-08-24", note: "A" }, "Alacak 32.083,69 (24.08)");
  const F2 = await fatura("250811.27", "2026-09-02", null, "F2 satış 250.811,27 (02.09)");
  if (!kilitsiz) await api("PUT", "/api/admin/period-lock", { lockedUntil: "2026-08-30", force: true }, "kilit 30.08");
  await api("POST", `/api/workspace/stock/${mal}/moves`, { kind: "out", qty: "1", unitPrice: "393.67", pay: "account", accountId: id, date: "2026-09-21" }, "stoktan satış 393,67 (21.09)");
  await api("POST", `/api/workspace/plans/${C1}/entries`, { kind: "in", amount: "4817.64", date: "2026-09-21", method: "cash", cashForce: true, similarOk: true, overpay: true }, "C1 Taksit Tahsilatı 4.817,64 (21.09)");
  const k2 = await api("POST", "/api/workspace/plans", { name: "Uc Musteri", registeredOn: "2026-09-21", total: "207.05", accountId: id, mode: "auto", count: "1", firstDue: "2026-10-12", coversBalance: true }, "C2 Mevcut Borç kartı 207,05 (21.09)");
  const C2 = k2.data?.id ?? k2.data?.plan?.id;
  await api("POST", `/api/workspace/plans/${C2}/entries`, { kind: "in", amount: "8528.77", date: "2026-09-25", method: "cash", cashForce: true, similarOk: true, overpay: true }, "C2 Taksit Tahsilatı 8.528,77 (25.09)");
  if (!kilitsiz) await api("PUT", "/api/admin/period-lock", { lockedUntil: "", force: true }, "kilit kaldır");
  console.log(log.join("\n"));
  const acc = (await api("GET", `/api/workspace/accounts/${id}`)).data;
  console.log("cari bakiyesi", acc?.balance ?? acc?.account?.balance);
  for (const [ad, fid] of [["F1", F1], ["F2", F2]]) {
    const f = (await api("GET", `/api/workspace/invoices/${fid}`)).data;
    console.log(ad, "açık", f?.open, "kendi açığı", f?.ownOpen, "ödenen", f?.paid);
  }
  for (const [ad, pid] of [["C1", C1], ["C2", C2]]) {
    const p = (await api("GET", `/api/workspace/plans/${pid}`)).data;
    const plan = p?.plan ?? p;
    const items = plan?.items || p?.items || [];
    console.log(ad, "durum", plan?.status, "toplam", plan?.totals?.total ?? plan?.total, "ödenen", plan?.totals?.paid, "kalan", plan?.totals?.left ?? plan?.totals?.remaining, "taksitler", JSON.stringify(items.map(i => [i.dueDate, i.amount, i.paid ?? i.paidAmount, i.status])));
  }
  const all = server.app.context?.invoices?.allObligations?.();
  if (all) {
    const q = all.get(id);
    const sig = (q?.items || []).reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0);
    console.log("Tek Yükümlülük Kuyruğu: Σ açık kalem", sig / 100, "kalemler", JSON.stringify((q?.items || []).map(i => [i.key, i.remaining])));
  } else console.log("Tek Yükümlülük Kuyruğu: YOK (bu sürümde)");
  const ctx = server.app.context;
  if (ctx?.invoices?.obligationInputFor) {
    const det = ctx.accounts.detail(id, { id: "dbg", role: "admin", permissions: [] }, { withRemaining: false });
    const input = ctx.invoices.obligationInputFor(id, det.ledger || []);
    const enc = (v, k) => {
      if (v instanceof Map) return { __map: [...v].map(([a, b]) => [a, enc(b)]) };
      if (v instanceof Set) return { __set: [...v].map(x => enc(x)) };
      if (typeof v === "function") return v.history ? { __lock: v.history } : { __fn: k };
      if (Array.isArray(v)) return v.map(x => enc(x));
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([a, b]) => [a, enc(b, a)]));
      return v;
    };
    if (process.env.GIRDI_YAZ) (await import("node:fs")).writeFileSync(process.env.GIRDI_YAZ, JSON.stringify({ input: enc(input) }));
    console.log("  faturalar", JSON.stringify(input.invoices));
    console.log("  takvimler", JSON.stringify([...(input.schedules || new Map())]));
    console.log("  satırlar-tam", JSON.stringify(input.lines));
    for (const l of input.lines || []) console.log("  satır", JSON.stringify({ id: l.id, origin: l.origin, kind: l.kind, planId: l.planId, itemId: l.itemId, covers: l.covers, coverTotal: l.coverTotal, date: l.date, at: l.at, debit: l.debit, credit: l.credit, kilit: typeof input.lockAt === "function" ? input.lockAt(l.at) : "" }));
  }
} finally {
  await server.close?.();
}
process.exit(0);
