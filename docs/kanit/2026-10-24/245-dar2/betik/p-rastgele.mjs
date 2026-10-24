// 2.4.5 ikinci dar kontrol — rastgele tohumlu karışık işlem dizisi (D1/KS7 + G8 tek geçiş). Her işlemden sonra:
//  (A) toplu yol (fatura listesi, >8 cari → allSettled) = cari başına yol (fatura kartı, paymentStates([row])): açık, ödenen, durum
//  (B) cari kartı Kalan (entryStates) = takvim (dues → allEntryStates) = Vade Takip kalemi (vadeli elle satırlar; kapsayan kart yoksa)
//  (C) takvim fatura kalemi = kart açığı (kapsayan kart yoksa, vade ≤ bugün+7)
//  (D) durum dökümü (eski 201ffef ile aynı tohumda karşılaştırma için; kimlikler oluşturma sırasıyla adlandırılır) → <çıktı>.jsonl
// Kullanım: ROOT=<kök> node p-rastgele.mjs <tohum> <adım> <çıktı.jsonl>
import { writeFileSync } from "node:fs";
import { start, must, day } from "./h.mjs";

const seed = Number(process.argv[2] || 1);
const steps = Number(process.argv[3] || 120);
const dumpPath = process.argv[4] || "";
let s = seed >>> 0 || 1;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = list => list[Math.floor(rnd() * list.length)];
const amtN = (lo = 50, hi = 1500) => Math.round((lo + rnd() * (hi - lo)) * 100) / 100;
const amt = (lo, hi) => String(amtN(lo, hi)).replace(".", ",");

const { server, api } = await start();
const log = [];
const failures = [];
const dumps = [];
const names = new Map(); // kimlik → kararlı ad
const nameOf = (id, prefix) => {
  if (!names.has(id)) names.set(id, `${prefix}${names.size}`);
  return names.get(id);
};
try {
  const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-R", name: "Hizmet", unit: "Adet", salePrice: "100" }));
  const goods = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "URN-R", name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "100000" }));
  let invDay = -150;
  const nextInvDay = () => (invDay = Math.min(0, invDay + Math.floor(rnd() * 2)));
  // Dolgu: 9 müşteri, her birine bir fatura (fatura listesi toplu yolu açılsın).
  for (let i = 0; i < 9; i += 1) {
    const f = await must("dolgu", api.post("/api/workspace/accounts", { name: `Dolgu ${i}`, type: "customer", registeredOn: day(-400), phone: `0501 000 00 ${10 + i}` }));
    await must("dolgu fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: f.id, issueDate: day(invDay), lines: [{ itemId: svc.id, qty: 1, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(invDay + 5) } }));
  }
  const accs = [];
  for (let i = 0; i < 4; i += 1) accs.push(await must("cari", api.post("/api/workspace/accounts", { name: `Rastgele ${i}`, type: i === 3 ? "supplier" : "customer", registeredOn: day(-400), phone: `0500 000 00 ${10 + i}` })));
  accs.forEach(a => nameOf(a.id, "C"));
  const customers = accs.filter(a => a.type === "customer");
  const supplier = accs.find(a => a.type === "supplier");
  const touched = new Set(); // KS7 satırı (stok iadesi / değersiz) görmüş cariler
  const refunded = new Set(); // müşteriye cari "Ödeme" yapılmış cariler (S1 sınıfı)
  const invs = new Map(accs.map(a => [a.id, []]));
  const moves = []; // { moveId, accountId, kind, reason }
  const doubts = new Map(); // accountId → [did]
  const entriesMine = new Map(accs.map(a => [a.id, []]));
  const card = id => must("kart", api.get(`/api/workspace/accounts/${id}`));
  const addEntry = async (acc, body) => {
    const before = new Set((await card(acc.id)).entries.map(e => e.id));
    const r = await api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, ...body });
    if (r.status !== 200) return r.status;
    const fresh = (await card(acc.id)).entries.find(e => !before.has(e.id));
    if (fresh) {
      entriesMine.get(acc.id).push(fresh.id);
      nameOf(fresh.id, "E");
    }
    return 200;
  };
  const stockMove = async (acc, kind, reason) => {
    const r = await api.post(`/api/workspace/stock/${goods.id}/moves`, { kind, reason, qty: String(1 + Math.floor(rnd() * 9)), unitPrice: String(Math.floor(20 + rnd() * 180)), pay: "account", accountId: acc.id, date: day(-Math.floor(rnd() * 90)) });
    if (r.status === 200) {
      moves.push({ moveId: r.data.moveId, accountId: acc.id, kind, reason });
      nameOf(r.data.moveId, "M");
      if (reason === "return") touched.add(acc.id);
    }
    return r.status;
  };
  const ops = [
    [3, async () => {
      const acc = pick(accs);
      const d = -Math.floor(rnd() * 90);
      const kind = acc.type === "supplier" ? (rnd() < 0.8 ? "credit" : "debt") : rnd() < 0.85 ? "debt" : "credit";
      return ["borç/alacak", acc.name, kind, await addEntry(acc, { kind, amount: amt(), date: day(d), dueDate: rnd() < 0.8 ? day(d + Math.floor(rnd() * 40)) : "", expectedDate: rnd() < 0.3 ? day(d + Math.floor(rnd() * 20)) : "" })];
    }],
    [3, async () => {
      const acc = pick(accs);
      const kind = acc.type === "supplier" ? "out" : "in";
      const linked = rnd() < 0.25 && invs.get(acc.id).length ? pick(invs.get(acc.id)) : "";
      return ["tahsilat/ödeme", acc.name, kind, linked ? "bağlı" : "", await addEntry(acc, { kind, amount: amt(), date: day(-Math.floor(rnd() * 60)), invoiceId: linked })];
    }],
    [1, async () => {
      const acc = pick(customers);
      refunded.add(acc.id);
      return ["müşteriye ödeme", acc.name, await addEntry(acc, { kind: "out", amount: amt(50, 400), date: day(-Math.floor(rnd() * 30)) })];
    }],
    [3, async () => {
      const acc = pick(accs);
      const d = acc.type === "supplier" ? -Math.floor(rnd() * 90) : nextInvDay();
      const body = acc.type === "supplier"
        ? { scenario: "expense_purchase", accountId: acc.id, number: `AL-${Math.floor(rnd() * 1e9)}`, issueDate: day(d), lines: [{ name: "Gider", expenseCode: "advisory", qty: 1, unitPrice: amt().replace(",", "."), vatRate: 0 }], payment: { rest: "open", dueDate: day(d + 10) } }
        : { scenario: "service_sale", accountId: acc.id, issueDate: day(d), lines: [{ itemId: svc.id, qty: 1, unitPrice: amt().replace(",", "."), vatRate: pick([0, 20]) }], payment: { rest: "open", dueDate: day(d + 15) } };
      const r = await api.post("/api/workspace/invoices", body);
      if (r.status === 200) {
        invs.get(acc.id).push(r.data.id);
        nameOf(r.data.id, "F");
      }
      return ["fatura", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    }],
    [2, async () => ["stok satış (açık hesap)", ...(await (async acc => [acc.name, await stockMove(acc, "out", "")])(pick(customers)))]],
    [3, async () => ["stok satış iadesi (açık hesap)", ...(await (async acc => [acc.name, await stockMove(acc, "in", "return")])(pick(customers)))]],
    [1, async () => ["stok alımı (tedarikçi)", supplier.name, await stockMove(supplier, "in", "")]],
    [1, async () => ["stok çıkışı tedarikçiye (KS7.1)", supplier.name, await stockMove(supplier, "out", "")]],
    [2, async () => {
      if (!moves.length) return ["stok düzelt", "yok"];
      const m = pick(moves);
      const body = { qty: String(1 + Math.floor(rnd() * 9)), unitPrice: String(Math.floor(20 + rnd() * 180)) };
      // giriş hareketinde nedeni değiştir (iade ↔ alım): KS7 rolü değişir
      if (m.kind === "in" && rnd() < 0.5) body.reason = m.reason === "return" ? "" : "return";
      const r = await api.put(`/api/workspace/stock/${goods.id}/moves/${m.moveId}`, body);
      if (r.status === 200 && "reason" in body) {
        m.reason = body.reason;
        if (m.reason === "return") touched.add(m.accountId);
      }
      return ["stok düzelt", nameOf(m.moveId), JSON.stringify(body), r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    }],
    [2, async () => {
      if (!moves.length) return ["stok sil", "yok"];
      const i = Math.floor(rnd() * moves.length);
      const m = moves[i];
      const r = await api.del(`/api/workspace/stock/${goods.id}/moves/${m.moveId}`);
      if (r.status === 200) moves.splice(i, 1);
      return ["stok sil", nameOf(m.moveId), r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    }],
    [2, async () => {
      const trash = await must("silinenler", api.get("/api/admin/trash"));
      const items = (trash.items || trash).filter(it => ["stock-move", "doubtful-writeoff", "account-entry"].includes(it.kind) && it.restorable !== false);
      if (!items.length) return ["geri yükle", "yok"];
      const it = pick(items);
      const r = await api.post("/api/admin/trash/restore", { id: it.id, force: true });
      if (r.status === 200 && it.kind === "stock-move") {
        const ref = it.id.replace(/^trash:/, "");
        // hareket kimliği payload'da; yeniden listeden bul
        const det = await must("ürün", api.get(`/api/workspace/stock/${goods.id}`));
        for (const mv of det.moves || []) if (mv.accountId && !moves.some(x => x.moveId === mv.id)) moves.push({ moveId: mv.id, accountId: mv.accountId, kind: mv.kind, reason: mv.reason || "" });
        void ref;
      }
      return ["geri yükle", it.kind, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    }],
    [2, async () => {
      const acc = pick(customers);
      const c = await card(acc.id);
      const bal = Number(c.totals.balance);
      if (!(bal > 10)) return ["şüpheliye al", acc.name, "bakiye yok"];
      const r = await api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: String(Math.round(bal * (0.3 + rnd() * 0.7) * 100) / 100).replace(".", ","), date: day(-Math.floor(rnd() * 20)), reason: "lawsuit", note: "dava" });
      if (r.status === 200) {
        const did = r.data.id || r.data.record?.id;
        if (!doubts.has(acc.id)) doubts.set(acc.id, []);
        doubts.get(acc.id).push(did);
      }
      return ["şüpheliye al", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    }],
    [4, async () => {
      const acc = pick(customers.filter(a => doubts.get(a.id)?.length) .concat([null]));
      if (!acc) return ["değersiz yaz", "yok"];
      const did = pick(doubts.get(acc.id));
      const info = await api.get(`/api/workspace/accounts/${acc.id}/doubtful`);
      const rec = (info.data?.records || []).find(x => x.id === did);
      const open = Number(rec?.remainingMinor || 0) / 100;
      if (!(open > 1)) return ["değersiz yaz", acc.name, "açık yok"];
      const r = await api.post(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-off`, { amount: String(Math.round(open * (rnd() < 0.5 ? 1 : 0.5) * 100) / 100).replace(".", ","), date: day(-Math.floor(rnd() * 10)), note: "değersiz" });
      if (r.status === 200) touched.add(acc.id);
      return ["değersiz yaz", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    }],
    [1, async () => {
      const acc = pick(customers);
      const c = await card(acc.id);
      const w = c.entries.filter(e => e.source === "doubtful");
      if (!w.length) return ["değersiz sil", acc.name, "yok"];
      const e = pick(w);
      const r = await api.del(`/api/workspace/accounts/${acc.id}/doubtful/${e.sourceId}/write-offs/${e.id}`);
      return ["değersiz sil", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 160) : ""];
    }],
    [1, async () => {
      const acc = pick(customers);
      const r = await api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-Math.floor(rnd() * 10)), total: amt(50, 600), accountId: acc.id, mode: "auto", count: "2", firstDue: day(5), coversBalance: true });
      return ["mevcut borç kartı", acc.name, r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 120) : ""];
    }],
    [2, async () => {
      const acc = pick(accs.filter(a => entriesMine.get(a.id).length).concat([null]));
      if (!acc) return ["sil", "yok"];
      const list = entriesMine.get(acc.id);
      const id = list.splice(Math.floor(rnd() * list.length), 1)[0];
      const r = await api.del(`/api/workspace/accounts/${acc.id}/entries/${id}`);
      return ["sil", acc.name, nameOf(id), r.status, r.status !== 200 ? JSON.stringify(r.data).slice(0, 120) : ""];
    }],
  ];
  const bag = ops.flatMap(([w, f]) => Array(w).fill(f));
  const allInvoiceIds = () => accs.flatMap(a => invs.get(a.id));
  for (let step = 0; step < steps; step += 1) {
    let res;
    try {
      res = await pick(bag)();
    } catch (e) {
      res = ["HATA", String(e.message).slice(0, 200)];
    }
    log.push(`${step}: ${res.join(" ")}`);
    // (A) toplu ↔ cari başına
    const listed = await must("liste", api.get("/api/workspace/invoices?limit=5000"));
    const byId = new Map((listed.invoices || []).map(r => [r.id, r]));
    const dump = { step, op: res.slice(0, 2).join(" "), accounts: {} };
    const docs = new Map();
    for (const id of allInvoiceIds()) {
      const doc = await must("fatura", api.get(`/api/workspace/invoices/${id}`));
      docs.set(id, doc);
      const row = byId.get(id);
      if (!row) failures.push(`${step} ${nameOf(id)}: listede yok`);
      else if (Math.abs((row.open || 0) - (doc.open || 0)) > 0.005 || row.payState !== doc.payState || Math.abs((row.paid || 0) - (doc.paid || 0)) > 0.005) failures.push(`${step} ${nameOf(id)}: toplu ${row.open}/${row.payState} ≠ kart ${doc.open}/${doc.payState}`);
    }
    const dues = await must("dues", api.get("/api/workspace/dues"));
    const accountItems = new Map(dues.items.filter(i => i.source === "account").map(i => [i.entryId, i]));
    const invoiceItems = new Map(dues.items.filter(i => i.source === "invoice").map(i => [i.invoiceId, i]));
    const vade = await must("vade", api.get(`/api/workspace/overview/vade-takip?from=${day(-400)}&to=${day(400)}&sources=account`));
    const vadeItems = new Map(vade.rows.filter(r => r.source === "account").map(r => [r.entryId || r.ref?.entryId, r]));
    for (const acc of accs) {
      const c = await card(acc.id);
      const covers = (c.plans || []).some(p => p.coversBalance && p.status !== "closed");
      const anyPlan = (c.plans || []).length > 0;
      const ad = { bakiye: c.totals.balance, faturalar: {}, satirlar: {} };
      for (const id of invs.get(acc.id)) {
        const doc = docs.get(id);
        ad.faturalar[nameOf(id)] = `${doc.kind}/${doc.open}/${doc.payState}`;
        const di = invoiceItems.get(id);
        const dueOk = (doc.dueDate || doc.issueDate) <= day(7);
        if (!covers && dueOk && doc.status === "issued") {
          if (doc.open > 0.005 && !di) failures.push(`${step} ${acc.name} ${nameOf(id)}: açık ${doc.open} takvimde YOK`);
          if (di && Math.abs(di.amount - doc.open) > 0.005) failures.push(`${step} ${acc.name} ${nameOf(id)}: takvim ${di.amount} ≠ kart açığı ${doc.open}`);
          if (!(doc.open > 0.005) && di) failures.push(`${step} ${acc.name} ${nameOf(id)}: kart açığı 0 ama takvimde ${di.amount}`);
        }
      }
      for (const e of c.entries) {
        if (e.source || !["debt", "credit"].includes(e.kind)) continue;
        ad.satirlar[nameOf(e.id, "E")] = `${e.kind}/${e.remaining}`;
        if (!(e.dueDate || e.expectedDate)) continue;
        const di = accountItems.get(e.id);
        const vi = vadeItems.get(e.id);
        const rem = Number(e.remaining);
        const inWindow = (e.expectedDate || e.dueDate) <= day(7);
        if (!(rem > 0.005)) {
          if (di) failures.push(`${step} ${acc.name} ${nameOf(e.id)}: kart Kalan ${rem} ama takvimde ${di.amount}`);
          if (vi) failures.push(`${step} ${acc.name} ${nameOf(e.id)}: kart Kalan ${rem} ama Vade Takip'te ${vi.amount}`);
          continue;
        }
        if (vi && di && Math.abs(vi.amount - di.amount) > 0.005) failures.push(`${step} ${acc.name}: Vade Takip ${vi.amount} ≠ takvim ${di.amount}`);
        if (!covers) {
          if (inWindow && !di) failures.push(`${step} ${acc.name} ${nameOf(e.id)}: kart Kalan ${rem} takvimde YOK`);
          if (di && Math.abs(di.amount - rem) > 0.005) failures.push(`${step} ${acc.name} ${nameOf(e.id)}: takvim ${di.amount} ≠ kart Kalan ${rem}`);
          if (!vi) failures.push(`${step} ${acc.name} ${nameOf(e.id)}: kart Kalan ${rem} Vade Takip'te YOK`);
        }
      }
      ad.ks7 = touched.has(acc.id);
      ad.kart = anyPlan;
      ad.geriOdeme = refunded.has(acc.id);
      dump.accounts[acc.name] = ad;
    }
    dumps.push(dump);
  }
  // Son: yevmiye mizanı + ana defter uzlaşması + Kasa (KS7 bunlara dokunmamalı; eski ile aynı olmalı)
  const ledger = await must("yevmiye", api.get(`/api/workspace/ledger?from=${day(-400)}&to=${day(30)}`));
  const cash = await must("kasa", api.get(`/api/workspace/cash?from=${day(-400)}&to=${day(30)}`));
  const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (/(^id$|Id$|At$|_at$|eventNo|receiptNo|number|ref)/.test(k) ? undefined : x)));
  dumps.push({ step: "son", op: "yevmiye+kasa", accounts: {}, trial: strip(ledger.trial), reconciliation: strip(ledger.reconciliation), cash: strip({ totals: cash.totals, byMethod: cash.byMethod, balance: cash.balance }) });
} finally {
  await server.close();
}
if (dumpPath) writeFileSync(dumpPath, dumps.map(d => JSON.stringify(d)).join("\n") + "\n");
console.log(log.join("\n"));
console.log(`HATA SAYISI ${failures.length}`);
console.log(failures.slice(0, 40).join("\n"));
process.exitCode = failures.length ? 1 : 0;
