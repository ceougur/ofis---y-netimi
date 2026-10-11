// 2.0.23 (2. bağımsız gözden geçirme) — fatura kapamasının tohumlu rastgele işlem dizileriyle denetimi. "Carinin Mevcut
// Borcu" kartları, stoktan taksitli satış, kart ve cari kartından tahsilat; serbest kipte iptal, iade, kart iadesi / kapatma /
// silme / geri yükleme, Borç Yaz silme, alış ve mahsup da. Değişmezler:
//   - fatura listesi (toplu yol) ile fatura kartı (cari başına yol) aynı durum, ödenen, açık ve kapatanları gösterir;
//   - ödenen + açık = ödenecek; kapatanların toplamı = ödenen; açık eksi olmaz;
//   - kısıtlı kipte (yalnız alacak tarafı, Borç Yaz yok — Borç Yaz yaşlandırma kalemi değildir; kart dışı tahsilat kapsanmamış
//     borcu aşmaz) her carinin Alacak Yaşlandırma toplamı cari bakiyesine eşittir: aynı borç iki kez sayılmaz, hiçbiri düşmez.
// 2.0.22'de kısıtlı kip tohum 7'de 10 carinin 9'unda yaşlandırma bakiyeden büyüktü (fatura ve kart aynı borcu iki kez sayıyordu).
import assert from "node:assert/strict";
import { test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const parse = text => Number(String(text).replace(/[^\d,-]/g, "").replace(",", "."));
const pad = value => String(value).padStart(2, "0");
const BASE = Date.parse("2025-01-01T00:00:00Z");
const dayOf = n => {
  const d = new Date(BASE + n * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

async function run({ mode, seed, steps }) {
  const server = await startTestServer();
  try {
    const client = await loginAdmin(server);
    const api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => unwrap(await client.post(url, body)),
      put: async (url, body) => unwrap(await client.put(url, body)),
      del: async url => unwrap(await client.del(url)),
    };
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      return res.data;
    };
    let state = seed;
    const random = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = list => list[Math.floor(random() * list.length)];
    const money = (min, max) => Math.round((min + random() * (max - min)) * 100) / 100;
    const done = {};
    const ok = (label, res) => {
      done[res.status === 200 ? label : `${label} (${res.status})`] = (done[res.status === 200 ? label : `${label} (${res.status})`] || 0) + 1;
      return res.status === 200 ? res.data : null;
    };
    await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: 5_000_000, date: dayOf(0), description: "Açılış" }));
    const item = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    const goods = await must("ürün", api.post("/api/workspace/stock", { name: "Mal R", code: "MALR", unit: "Adet", unitPrice: 10, salePrice: 20 }));
    const accs = [];
    for (let i = 0; i < 8; i += 1) accs.push(await must("cari", api.post("/api/workspace/accounts", { name: `Rastgele ${i + 1}`, type: "customer", registeredOn: dayOf(0), phone: `0500 111 ${String(1000 + i)}` })));
    const sales = [];
    const purchases = [];
    const cards = [];
    const deleted = [];
    const debts = [];
    let purchaseNo = 0;
    const detailOf = acc => must("cari", api.get(`/api/workspace/accounts/${acc.id}`));
    const freeOf = async acc => {
      const d = await detailOf(acc);
      const coveredLeft = d.plans.filter(p => p.coversBalance && p.status !== "closed").reduce((sum, p) => sum + Math.max(0, (p.totals?.total || 0) - (p.totals?.paid || 0)), 0);
      return { d, free: Math.round((d.totals.balance - coveredLeft) * 100) / 100 };
    };
    for (let step = 0; step < steps; step += 1) {
      const day = dayOf(5 + Math.floor(step / 2));
      const acc = pick(accs);
      const op = random();
      if (op < 0.2) {
        const variant = random();
        const payment = variant < 0.6 ? { rest: "open", dueDate: day } : variant < 0.8 ? { cash: [{ amount: money(10, 200), method: "cash" }], rest: "open", dueDate: day } : mode === "serbest" ? { rest: "installments", installments: { count: 2, firstDue: dayOf(40 + step), everyMonths: 1 } } : { rest: "open", dueDate: day };
        const created = ok("satış", await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day, lines: [{ itemId: item.id, qty: 1 + Math.floor(random() * 3), unitPrice: money(100, 900), vatRate: 0 }], payment, cashForce: true }));
        if (created) sales.push({ id: created.id, accountId: acc.id });
      } else if (op < 0.3) {
        if (mode !== "serbest") continue;
        const back = random() < 0.4 ? dayOf(Math.floor(random() * 5)) : day;
        const created = ok("borç yaz", await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: money(50, 600), date: back, note: "borç" }));
        if (created) debts.push({ accountId: acc.id, entryId: created.entryId });
      } else if (op < 0.42) {
        const { free } = await freeOf(acc);
        if (!(free > 1)) continue;
        const total = random() < 0.5 ? free : Math.round(free * (0.3 + random() * 0.6) * 100) / 100;
        const card = ok("mevcut borç kartı", await api.post("/api/workspace/plans", { name: acc.name, registeredOn: day, total: String(total), accountId: acc.id, mode: "auto", count: "3", firstDue: dayOf(60 + step), coversBalance: true }));
        if (card) cards.push({ id: card.id, accountId: acc.id });
      } else if (op < 0.47) {
        const res = ok("stoktan taksitli satış", await api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: 1 + Math.floor(random() * 20), unitPrice: 20, pay: "account", accountId: acc.id, date: day, force: true, installments: { count: 2, firstDue: dayOf(60 + step), everyMonths: 1 } }));
        if (res) for (const p of (await detailOf(acc)).plans) if (p.coversBalance && !p.invoiceId && !cards.some(c => c.id === p.id)) cards.push({ id: p.id, accountId: acc.id });
      } else if (op < 0.62) {
        const live = cards.filter(c => !deleted.includes(c.id));
        if (!live.length) continue;
        const c = pick(live);
        const card = (await api.get(`/api/workspace/plans/${c.id}`)).data;
        if (!card || card.status === "closed" || !(card.totals?.remaining > 1)) continue;
        ok("kart tahsilatı", await api.post(`/api/workspace/plans/${c.id}/entries`, { kind: "in", amount: Math.min(card.totals.remaining, money(10, 400)), date: day, method: "bank" }));
      } else if (op < 0.72) {
        const { free } = await freeOf(acc);
        const amount = mode === "serbest" ? money(10, 400) : Math.min(free, money(10, 400));
        if (!(amount > 0.5)) continue;
        const body = { kind: "in", amount, date: day, method: "cash", cashForce: true };
        if (mode === "serbest" && random() < 0.3) {
          const mine = sales.filter(s => s.accountId === acc.id);
          if (mine.length) body.invoiceId = pick(mine).id;
        }
        ok(body.invoiceId ? "bağlı tahsilat" : "bağsız tahsilat", await api.post(`/api/workspace/accounts/${acc.id}/entries`, body));
      } else if (mode !== "serbest") {
        continue;
      } else if (op < 0.76) {
        const live = cards.filter(c => !deleted.includes(c.id));
        if (!live.length) continue;
        const card = (await api.get(`/api/workspace/plans/${pick(live).id}`)).data;
        if (card?.totals?.paid > 1) ok("kart iadesi", await api.post(`/api/workspace/plans/${card.id}/entries`, { kind: "out", amount: Math.min(card.totals.paid, money(5, 100)), date: day, method: "bank", cashForce: true }));
      } else if (op < 0.79) {
        const live = cards.filter(c => !deleted.includes(c.id));
        if (!live.length) continue;
        const card = (await api.get(`/api/workspace/plans/${pick(live).id}`)).data;
        if (card) ok(card.status === "closed" ? "kart yeniden aç" : "kart kapat", await api.put(`/api/workspace/plans/${card.id}`, { status: card.status === "closed" ? "active" : "closed" }));
      } else if (op < 0.82) {
        const live = cards.filter(c => !deleted.includes(c.id));
        if (live.length && random() < 0.6) {
          const card = pick(live);
          if (ok("kart sil", await api.del(`/api/workspace/plans/${card.id}`))) deleted.push(card.id);
        } else if (deleted.length) {
          const id = deleted.pop();
          const trash = (await api.get("/api/admin/trash")).data;
          const entry = (Array.isArray(trash) ? trash : trash?.items || []).find(row => row.kind === "plan" && (row.ref === id || row.id === `plan:${id}` || String(row.id).includes(id)));
          if (entry) ok("kart geri yükle", await api.post("/api/admin/trash/restore", { id: entry.id }));
          else deleted.push(id);
        }
      } else if (op < 0.86) {
        const mine = sales.filter(s => s.accountId === acc.id);
        if (!mine.length) continue;
        const target = pick(mine);
        sales.splice(sales.indexOf(target), 1);
        ok("iptal", await api.post(`/api/workspace/invoices/${target.id}/cancel`, { reason: "deneme", force: true, cashForce: true }));
      } else if (op < 0.9) {
        const mine = sales.filter(s => s.accountId === acc.id);
        if (!mine.length) continue;
        const card = (await api.get(`/api/workspace/invoices/${pick(mine).id}`)).data;
        if (card?.status !== "issued") continue;
        ok("iade", await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: card.id, issueDate: day > card.issueDate ? day : card.issueDate, lines: [{ originLineId: card.lines[0].id, qty: 1 }], payment: {}, force: true, cashForce: true }));
      } else if (op < 0.93) {
        const mine = debts.filter(d => d.accountId === acc.id);
        if (!mine.length) continue;
        const target = pick(mine);
        debts.splice(debts.indexOf(target), 1);
        ok("borç yaz sil", await api.del(`/api/workspace/accounts/${acc.id}/entries/${target.entryId}`));
      } else if (op < 0.97) {
        const created = ok("alış", await api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: acc.id, issueDate: day, number: `AL-R-${(purchaseNo += 1)}`, lines: [{ name: "Hizmet alımı", qty: 1, unitPrice: money(50, 400), vatRate: 0 }], payment: { rest: "open", dueDate: day } }));
        if (created) purchases.push({ id: created.id, accountId: acc.id });
      } else {
        const mine = purchases.filter(p => p.accountId === acc.id);
        if (!mine.length) continue;
        const target = pick(mine);
        const candidates = (await api.get(`/api/workspace/invoices/${target.id}/offsets`)).data;
        const counter = candidates?.invoices?.[0];
        if (!counter || !(candidates.open > 0.01)) continue;
        ok("mahsup", await api.post(`/api/workspace/invoices/${target.id}/offsets`, { counterType: "invoice", counterId: counter.id, amount: Math.max(0.01, Math.round(Math.min(candidates.open, counter.open) * random() * 100) / 100), date: day }));
      }
    }
    const problems = [];
    const list = (await must("liste", api.get("/api/workspace/invoices?tab=all&limit=5000"))).invoices.filter(doc => doc.status === "issued");
    const key = doc => JSON.stringify([doc.payState, doc.paid, doc.open, (doc.closers || []).map(c => [c.mode, c.amount, c.date, c.method || ""])]);
    for (const doc of list) {
      const card = await must("kart", api.get(`/api/workspace/invoices/${doc.id}`));
      if (key(doc) !== key(card)) problems.push(`${doc.displayNo}: liste ${key(doc)} ≠ kart ${key(card)}`);
      if (!["sale", "smm", "purchase"].includes(doc.kind)) continue;
      if (Math.round((doc.paid + doc.open) * 100) !== Math.round(doc.tryPayable * 100)) problems.push(`${doc.displayNo}: ödenen ${doc.paid} + açık ${doc.open} ≠ ${doc.tryPayable}`);
      const closed = Math.round((doc.closers || []).reduce((sum, c) => sum + c.amount, 0) * 100);
      if (closed !== Math.round(doc.paid * 100)) problems.push(`${doc.displayNo}: kapatanlar ${closed / 100} ≠ ödenen ${doc.paid}`);
      if (doc.open < -0.004) problems.push(`${doc.displayNo}: açık ${doc.open}`);
    }
    if (mode === "kisitli") {
      const aging = await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
      for (const acc of accs) {
        const row = aging.rows.find(r => r[0] === acc.name);
        const total = row ? parse(row.at(-1)) : 0;
        const balance = Math.max(0, (await detailOf(acc)).totals.balance);
        if (Math.abs(total - balance) > 0.01) problems.push(`${acc.name}: yaşlandırma ${total} ≠ bakiye ${balance}`);
      }
    }
    return { problems, done, invoices: list.length };
  } finally {
    await server.close();
  }
}

for (const [mode, seed, steps] of [["kisitli", 7, 160], ["kisitli", 11, 160], ["serbest", 3, 200]]) {
  test(`kapama, rastgele dizi (${mode}, tohum ${seed}, ${steps} adım): liste = kart, değişmezler${mode === "kisitli" ? ", yaşlandırma = bakiye" : ""}`, async () => {
    const result = await run({ mode, seed, steps });
    assert.ok(result.invoices > 10, `yeterli fatura kesildi (${result.invoices}; ${JSON.stringify(result.done)})`);
    assert.ok((result.done["mevcut borç kartı"] || 0) + (result.done["stoktan taksitli satış"] || 0) > 5, `Mevcut Borç kartı açıldı (${JSON.stringify(result.done)})`);
    assert.deepEqual(result.problems, [], `${result.problems.length} sorun (${JSON.stringify(result.done)})`);
  });
}
