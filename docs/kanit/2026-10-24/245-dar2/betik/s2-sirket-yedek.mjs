// 2.4.5 ikinci dar kontrol — S2: iki şirket + 002 yedek → çalış → geri yükle; tek geçiş önbelleği (allSettled) ve KS7 sonuçları şirketler arasında
// karışıyor mu, geri yüklemeden sonra bayat kalıyor mu? Her adımda fatura kartı, fatura listesi (toplu), takvim, cari kartı Kalan okunur.
import { start, must, day, helpers } from "./h.mjs";

const { server, api } = await start({ maxCompanies: 2 });
const out = [];
let bad = 0;
try {
  const created = await must("002", api.post("/api/companies", { name: "Dar Kontrol Şirketi", select: false }));
  const second = created.company || created;
  const Q = { "001": "", "002": `hofCompany=${encodeURIComponent(second.id)}` };
  const u = (path, q) => (q ? `${path}${path.includes("?") ? "&" : "?"}${q}` : path);
  const facts = {};
  async function build(code, amount) {
    const q = Q[code];
    const svc = await must("hizmet", api.post(u("/api/workspace/stock", q), { kind: "service", code: `HZM-${code}`, name: "Hizmet", unit: "Adet", salePrice: "100" }));
    const goods = await must("ürün", api.post(u("/api/workspace/stock", q), { kind: "goods", code: `URN-${code}`, name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "1000" }));
    const acc = await must("cari", api.post(u("/api/workspace/accounts", q), { name: "Ortak Ad", type: "customer", registeredOn: day(-400), phone: "05009998877" }));
    // 9 dolgu cari + fatura (fatura listesi toplu yolu)
    for (let i = 0; i < 9; i += 1) {
      const f = await must("dolgu", api.post(u("/api/workspace/accounts", q), { name: `Dolgu ${code} ${i}`, type: "customer", registeredOn: day(-400) }));
      await must("dolgu fatura", api.post(u("/api/workspace/invoices", q), { scenario: "service_sale", accountId: f.id, issueDate: day(-90), lines: [{ itemId: svc.id, qty: 1, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(-80) } }));
    }
    const inv = await must("fatura", api.post(u("/api/workspace/invoices", q), { scenario: "service_sale", accountId: acc.id, issueDate: day(-60), lines: [{ itemId: svc.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate: day(-50) } }));
    await must("borç", api.post(u(`/api/workspace/accounts/${acc.id}/entries`, q), { kind: "debt", amount: String(amount / 2), date: day(-40), dueDate: day(-30), method: "cash" }));
    await must("stok iade", api.post(u(`/api/workspace/stock/${goods.id}/moves`, q), { kind: "in", reason: "return", qty: "2", unitPrice: String(amount / 10), pay: "account", accountId: acc.id, date: day(-5) }));
    facts[code] = { acc: acc.id, inv: inv.id };
  }
  async function read(code, label) {
    const q = Q[code];
    const { acc, inv } = facts[code];
    const doc = await must("fatura", api.get(u(`/api/workspace/invoices/${inv}`, q)));
    const listed = (await must("liste", api.get(u("/api/workspace/invoices?limit=5000", q)))).invoices.find(r => r.id === inv);
    const card = await must("kart", api.get(u(`/api/workspace/accounts/${acc}`, q)));
    const debt = card.entries.find(e => e.kind === "debt" && !e.source);
    const dues = await must("dues", api.get(u("/api/workspace/dues", q)));
    const mine = dues.items.filter(i => i.person === "Ortak Ad").map(i => `${i.source}:${i.amount}`).sort();
    const row = { label, code, bakiye: card.totals.balance, faturaKart: doc.open, faturaListe: listed?.open, borcKalan: debt?.remaining, takvim: mine.join(" ") };
    if (listed?.open !== doc.open) bad += 1;
    out.push(row);
    return row;
  }
  await build("001", 1000);
  await build("002", 3000);
  const a1 = await read("001", "ilk");
  const a2 = await read("002", "ilk");
  const b1 = await read("001", "002 okunduktan sonra");
  if (JSON.stringify({ ...a1, label: "" }) !== JSON.stringify({ ...b1, label: "" })) bad += 1;
  // 002 yedek → tahsilat (hepsini kapatır) → oku → geri yükle → oku
  const backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: second.id }))).backups[0].name;
  await must("tahsilat", api.post(u(`/api/workspace/accounts/${facts["002"].acc}/entries`, Q["002"]), { kind: "in", amount: "3900", date: day(-1), method: "cash" }));
  await read("002", "tahsilattan sonra");
  await read("001", "002 tahsilatından sonra 001");
  await must("geri yükle", api.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: helpers.ADMIN_PASSWORD }));
  const c2 = await read("002", "geri yüklemeden sonra");
  if (JSON.stringify({ ...a2, label: "" }) !== JSON.stringify({ ...c2, label: "" })) bad += 1;
  const c1 = await read("001", "geri yüklemeden sonra 001");
  if (JSON.stringify({ ...a1, label: "" }) !== JSON.stringify({ ...c1, label: "" })) bad += 1;
} finally {
  await server.close();
}
for (const row of out) console.log(JSON.stringify(row));
console.log(`UYUŞMAZLIK ${bad}`);
process.exitCode = bad ? 1 : 0;
