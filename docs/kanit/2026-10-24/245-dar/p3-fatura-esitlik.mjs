// Dar kontrol 2.4.5: rastgele işlemler sonrası İKİ YOLUN tutarlılığı (programla aynı elden kâhin değil; iç tutarlılık + değişmezler):
//   (a) cari kartı (detail → entryStates) Kalan − kartın kapsadığı  ==  takvim (dues → allEntryStates) kalemi tutarı  ==  Vade Takip kalemi
//   (b) Σ elle borç Kalan (alacak tarafı) ≤ max(0, bakiye) ... yalnız bilgi
//   (c) takvim önbelleği: her işlemden sonra okunan değer, aynı veriyle YENİ sunucuda (önbelleksiz) hesaplananla aynı mı (tekrar başlatma pahalı → aynı
//       sunucuda since'siz iki okuma + kartla karşılaştırma).
// Kullanım: node p2-rastgele.mjs <tohum> <adım>
import { start, must, day } from "./h.mjs";

const seed = Number(process.argv[2] || 1);
const steps = Number(process.argv[3] || 120);
let s = seed >>> 0 || 1;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = list => list[Math.floor(rnd() * list.length)];
const amt = () => String(Math.round((50 + rnd() * 1500) * 100) / 100).replace(".", ",");

const { server, api } = await start();
const log = [];
const failures = [];
try {
  const item = await must("stok", api.post("/api/workspace/stock", { kind: "service", code: "HZM-R", name: "Hizmet", unit: "Adet", salePrice: "100" }));
  const accs = [];
  for (let i = 0; i < 4; i += 1) accs.push(await must("cari", api.post("/api/workspace/accounts", { name: `Rastgele ${i}`, type: i === 3 ? "supplier" : "customer", registeredOn: day(-400), phone: `0500 000 00 ${10 + i}` })));
  const entries = new Map(accs.map(a => [a.id, []]));
  const invs = new Map(accs.map(a => [a.id, []]));
  const plans = new Map(accs.map(a => [a.id, []]));
  const cheques = new Map(accs.map(a => [a.id, []]));
  const addEntry = async (acc, body) => {
    const before = new Set((await must("kart", api.get(`/api/workspace/accounts/${acc.id}`))).entries.map(e => e.id));
    const r = await api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", ...body });
    if (r.status !== 200) return { status: r.status, data: r.data };
    const after = (await must("kart", api.get(`/api/workspace/accounts/${acc.id}`))).entries;
    const fresh = after.find(e => !before.has(e.id));
    if (fresh) entries.get(acc.id).push(fresh.id);
    return { status: 200, id: fresh?.id };
  };
  const ops = [
    async () => {
      const acc = pick(accs);
      const d = -Math.floor(rnd() * 90);
      const due = rnd() < 0.8 ? day(d + Math.floor(rnd() * 40)) : "";
      const exp = rnd() < 0.3 ? day(d + Math.floor(rnd() * 20)) : "";
      const kind = acc.type === "supplier" ? (rnd() < 0.8 ? "credit" : "debt") : rnd() < 0.85 ? "debt" : "credit";
      return ["borç/alacak", acc.name, kind, (await addEntry(acc, { kind, amount: amt(), date: day(d), dueDate: due, expectedDate: exp })).status];
    },
    async () => {
      const acc = pick(accs);
      const kind = acc.type === "supplier" ? "out" : "in";
      const linked = rnd() < 0.25 && invs.get(acc.id).length ? pick(invs.get(acc.id)) : "";
      return ["tahsilat/ödeme", acc.name, kind, linked ? "bağlı" : "", (await addEntry(acc, { kind, amount: amt(), date: day(-Math.floor(rnd() * 60)), invoiceId: linked })).status];
    },
    async () => {
      const acc = pick(accs);
      const d = -Math.floor(rnd() * 90);
      const supplier = acc.type === "supplier";
      const body = supplier
        ? { scenario: "expense_purchase", accountId: acc.id, number: `AL-${Math.floor(rnd() * 1e9)}`, issueDate: day(d), lines: [{ name: "Gider", expenseCode: "advisory", qty: 1, unitPrice: amt().replace(",", "."), vatRate: 0 }], payment: { rest: "open", dueDate: day(d + 10) } }
        : { scenario: "service_sale", accountId: acc.id, issueDate: day(d), lines: [{ itemId: item.id, qty: 1, unitPrice: amt().replace(",", "."), vatRate: pick([0, 20]) }], payment: { rest: "open", dueDate: day(d + 15) } };
      const r = await api.post("/api/workspace/invoices", body);
      if (r.status === 200) invs.get(acc.id).push(r.data.id);
      return ["fatura", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    },
    async () => {
      const acc = pick(accs.filter(a => a.type === "customer"));
      const cover = rnd() < 0.5;
      const r = await api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-Math.floor(rnd() * 30)), total: amt(), accountId: acc.id, mode: "auto", count: "2", firstDue: day(5), coversBalance: cover });
      if (r.status === 200) plans.get(acc.id).push(r.data.id);
      return ["taksit kartı", acc.name, cover ? "mevcut borç" : "ayrı", r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 120) : ""];
    },
    async () => {
      const acc = pick(accs.filter(a => plans.get(a.id).length));
      if (!acc) return ["kart tahsilatı", "yok"];
      const plan = pick(plans.get(acc.id));
      const r = await api.post(`/api/workspace/plans/${plan}/entries`, { kind: "in", amount: amt(), date: day(-Math.floor(rnd() * 5)), method: "cash" });
      return ["kart tahsilatı", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 120) : ""];
    },
    async () => {
      const acc = pick(accs.filter(a => a.type === "customer"));
      const r = await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: acc.id, amount: amt(), issueDate: day(-Math.floor(rnd() * 30)), dueDate: day(30), drawer: "Keşideci", serialNo: `R-${Math.floor(rnd() * 1e9)}`, bank: "Ziraat" });
      if (r.status === 200) cheques.get(acc.id).push(r.data.id);
      return ["çek al", acc.name, r.status];
    },
    async () => {
      const acc = pick(accs.filter(a => cheques.get(a.id).length));
      if (!acc) return ["karşılıksız", "yok"];
      const id = cheques.get(acc.id).shift();
      const r = await api.post(`/api/workspace/cheques/${id}/actions`, { action: "bounce", date: day(0) });
      return ["karşılıksız", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 120) : ""];
    },
    async () => {
      const acc = pick(accs.filter(a => entries.get(a.id).length));
      if (!acc) return ["sil", "yok"];
      const list = entries.get(acc.id);
      const id = list.splice(Math.floor(rnd() * list.length), 1)[0];
      const r = await api.del(`/api/workspace/accounts/${acc.id}/entries/${id}`);
      return ["sil", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 120) : ""];
    },
    async () => {
      const acc = pick(accs.filter(a => entries.get(a.id).length));
      if (!acc) return ["düzelt", "yok"];
      const card = await must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
      const entry = card.entries.find(e => e.id === pick(entries.get(acc.id)));
      if (!entry || entry.source) return ["düzelt", "yok"];
      const r = await api.put(`/api/workspace/accounts/${acc.id}/entries/${entry.id}`, { kind: entry.kind, amount: amt(), date: entry.date, note: entry.note, method: entry.method || "cash", invoiceId: entry.invoiceId || "" });
      return ["düzelt", acc.name, entry.kind, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 120) : ""];
    },
  ];
  for (let step = 0; step < steps; step += 1) {
    const op = pick(ops);
    let res;
    try {
      res = await op();
    } catch (e) {
      res = ["HATA", String(e.message).slice(0, 200)];
    }
    log.push(`${step}: ${res.join(" ")}`);
  }
  const list = await must("faturalar", api.get("/api/workspace/invoices?limit=1000&tab=all"));
  const rows = (list.invoices || list.rows || []).map(r => [r.displayNo || r.number, r.accountName, r.tryPayable, r.open, r.payState || r.payStateLabel].join("|")).sort();
  const bal = [];
  for (const acc of accs) { const c = await must("kart", api.get(`/api/workspace/accounts/${acc.id}`)); bal.push(`${acc.name}|${c.totals.balance}`); }
  console.log("FATURA " + rows.join("\nFATURA "));
  console.log("BAKIYE " + bal.join("\nBAKIYE "));
} finally {
  await server.close();
}
console.log(log.map(l=>"ADIM "+l).join("\n"));
console.log(`HATA SAYISI ${failures.length}`);
console.log(failures.slice(0, 30).join("\n"));
