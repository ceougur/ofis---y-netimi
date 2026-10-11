// Cari arama + Kasa/Banka eksi bakiye denetimi: aynı senaryo eski (07b8f60) ve yeni (HEAD) kodda; çıktı JSON (kimliksiz).
// Kullanım: node senaryo.mjs <kök> <çıktı.json>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, outFile] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { bootBank } = await imp("test/banka-210-hesap-ortak.mjs");
const { apiOf } = await imp("test/banka-210-ortak.mjs");

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const addDays = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const ctx = await bootBank({ now: { time: NOW, fixed: true } });
const api = ctx.api;
const out = { search: [], list: [], guard: [] };
const idName = new Map();
const scrub = value => JSON.parse(JSON.stringify(value, (k, v) => (typeof v === "string" && idName.has(v) ? `#${idName.get(v)}` : v)));
const rec = (bucket, label, res) => {
  const item = { label, status: res.status, code: res.code || "", error: res.error || "" };
  if (res.status !== 200 && res.data && typeof res.data === "object") item.extra = { balance: res.data.balance, after: res.data.after, method: res.data.method, accountId: res.data.accountId };
  out[bucket].push(scrub(item));
  return res;
};
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
};

try {
  // ---------- A. Cariler ----------
  const accounts = [];
  const mk = async (body, extra = {}) => {
    const a = await must(`cari ${body.name}`, api.post("/api/workspace/accounts", { registeredOn: addDays(TODAY, -100), ...body }));
    idName.set(a.id, `${body.name}|${body.type || "customer"}|${body.phone || ""}`);
    accounts.push({ ...a, ...extra });
    return a;
  };
  // 26 "Ahmet ..." (20'den çok eşleşme), Cari No karışık.
  for (let i = 0; i < 26; i += 1) {
    const refNo = [3, 7, 11].includes(i) ? ["100", "20", "A-5"][[3, 7, 11].indexOf(i)] : i === 13 ? "a-6" : i === 15 ? "b9" : i === 16 ? "B10" : "";
    await mk({ name: `Ahmet ${["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik"][i % 5]} ${i}`, type: i % 3 === 0 ? "supplier" : i % 7 === 0 ? "other" : "customer", phone: `0532 111 ${String(1000 + i)}`, ...(refNo ? { refNo } : {}) });
  }
  const a1 = await mk({ name: "Ahmet Yılmaz", type: "customer", phone: "0532 999 0001", note: "özelnot müşteri" });
  const a2 = await mk({ name: "Ahmet Yılmaz", type: "supplier", phone: "0532 999 0002", email: "ahmet@ornek.com" });
  await mk({ name: "IŞIK Ltd", type: "supplier", phone: "0212 333 4455" });
  await mk({ name: "ışık ticaret", type: "customer" });
  await mk({ name: "İsmail Öztürk", type: "customer", fields: [{ label: "Plaka", value: "34 ABC 123" }] });
  await mk({ name: "ismail öztürk", type: "other", address: "Kadıköy İstanbul" });
  await mk({ name: "Çağrı Şen", type: "supplier" });
  const pas = await mk({ name: "Ahmet Pasif", type: "supplier", status: "passive" });
  const del = await mk({ name: "Ahmet Silinen", type: "customer" });
  await must("sil", api.del(`/api/workspace/accounts/${del.id}`));
  // Bakiyeler: borç/alacak/tahsilat + taksit kartları (gecikmiş).
  for (const [i, a] of accounts.entries()) {
    if (a.id === del.id) continue;
    if (i % 2 === 0) await must("borç", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: String(100 * (i + 1)), date: addDays(TODAY, -50) }));
    if (i % 3 === 0) await must("alacak", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "credit", amount: String(37 * (i + 1)), date: addDays(TODAY, -40) }));
    if (i % 4 === 0) await must("tahsilat", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", method: "cash", amount: String(11 * (i + 1)), date: addDays(TODAY, -30) }));
    if (i % 5 === 0) await must("kart", api.post("/api/workspace/plans", { accountId: a.id, name: a.name, total: String(1200 + i), mode: "auto", count: 4, firstDue: addDays(TODAY, -60), registeredOn: addDays(TODAY, -70) }));
  }
  await must("pasif borç", api.post(`/api/workspace/accounts/${pas.id}/entries`, { kind: "debt", amount: "777", date: addDays(TODAY, -5) }));
  // ---------- Arama ----------
  const queries = ["", "a", "ah", "AHMET", "ahmet", "ahmet yılmaz", "AHMET YILMAZ", "ı", "I", "i", "İ", "ışık", "IŞIK", "isMAİL", "öz", "ÖZ", "0532", "532", "999 0002", "1105", "100", "A-5", "a-5", "b9", "özelnot", "ornek", "34 abc", "plaka", "kadıköy", "pasif", "silinen", "xyz-yok", "  ahmet  "];
  for (const q of queries) {
    for (const type of ["", "customer", "supplier", "other", "bogus"]) {
      for (const prefer of ["", "supplier", "customer", "bogus"]) {
        const params = new URLSearchParams({ q, ...(type ? { type } : {}), ...(prefer ? { prefer } : {}) });
        const r = apiOf; // eslint
        const res = await api.get(`/api/workspace/accounts/search?${params}`);
        out.search.push(scrub({ params: String(params), status: res.status, rows: Array.isArray(res.data) ? res.data : res.data }));
      }
    }
  }
  // ---------- Liste ----------
  for (const qs of ["", "status=all", "status=passive", "sort=balance", "sort=name", "sort=overdue", "sort=registered", "balance=debtor", "balance=creditor", "balance=overdue", "q=ahmet&sort=balance&limit=5&offset=3", "plan=has", "plan=none", "type=supplier&status=all", "q=ı&status=all", "limit=3000"]) {
    const res = await api.get(`/api/workspace/accounts?${qs}`);
    const d = res.data || {};
    out.list.push(scrub({ qs, status: res.status, total: d.total, totals: d.totals, rows: (d.accounts || []).map(a => ({ id: a.id, refNo: a.refNo, balance: a.balance, overdue: a.overdue, planRemaining: a.planRemaining, status: a.status, next: a.next?.dueDate || "" })) }));
  }

  // ---------- B. Kasa eksi bakiye (Uyar) ----------
  const cash = body => api.post("/api/workspace/cash", { description: "t", ...body });
  rec("guard", "B1 boş Kasa çıkış 100", await cash({ kind: "out", amount: "100", date: TODAY }));
  const kasaNow = await api.get("/api/workspace/cash");
  out.guard.push({ label: "kasa başlangıç", byMethod: kasaNow.data?.byMethod, balance: kasaNow.data?.balance });
  const in1000 = (await rec("guard", "B2 giriş 1000", await cash({ kind: "in", amount: "1000", date: TODAY }))).data;
  rec("guard", "B3 çıkış 600", await cash({ kind: "out", amount: "600", date: TODAY }));
  rec("guard", "B4 çıkış 500", await cash({ kind: "out", amount: "500", date: TODAY }));
  const fut = (await rec("guard", "B5 ileri giriş 5000 (+10)", await cash({ kind: "in", amount: "5000", date: addDays(TODAY, 10) }))).data;
  rec("guard", "B6 çıkış 1000 bugün", await cash({ kind: "out", amount: "1000", date: TODAY }));
  rec("guard", "B7 ileri çıkış 300 (+5)", await cash({ kind: "out", amount: "300", date: addDays(TODAY, 5) }));
  rec("guard", "B8 çıkış 200", await cash({ kind: "out", amount: "200", date: TODAY }));
  rec("guard", "B9 çıkış 300", await cash({ kind: "out", amount: "300", date: TODAY }));
  rec("guard", "B10 geçmiş çıkış 50 (-60)", await cash({ kind: "out", amount: "50", date: addDays(TODAY, -60) }));
  rec("guard", "B10b ileri çıkış 6000 (+20)", await cash({ kind: "out", amount: "6000", date: addDays(TODAY, 20) }));
  rec("guard", "B10c ileri çıkış 4000 (+20)", await cash({ kind: "out", amount: "4000", date: addDays(TODAY, 20) }));
  rec("guard", "B10d ileri çıkış 4000 (+12)", await cash({ kind: "out", amount: "4000", date: addDays(TODAY, 12) }));
  // Cari nakit ödeme (accounts.mjs guardOut).
  const party = await mk({ name: "Kasa Test Cari", type: "supplier" });
  rec("guard", "B11 cari nakit ödeme 250", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "cash", amount: "250", date: TODAY }));
  rec("guard", "B11b cari nakit ödeme 250 onaylı", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "cash", amount: "250", date: TODAY, cashForce: true }));
  rec("guard", "B12 cari havale ödeme 10000 (hesap yok)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "bank", amount: "10000", date: TODAY }));
  rec("guard", "B13 cari POS tahsilat 3000", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", method: "card", amount: "3000", date: TODAY }));
  rec("guard", "B13b cari kart ödeme 700 (kart yok)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "card", amount: "700", date: TODAY }));
  rec("guard", "B13c cari havale tahsilat 9000", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", method: "bank", amount: "9000", date: TODAY }));
  rec("guard", "B14 nakit çıkış 100 (banka/POS sayılmamalı)", await cash({ kind: "out", amount: "100", date: TODAY }));
  // Düzeltme / silme.
  rec("guard", "B15 girişi 1000→100 düzelt", await api.put(`/api/workspace/cash/${in1000.id}`, { kind: "in", amount: "100", date: TODAY, description: "t" }));
  rec("guard", "B15b girişi 1000→900 düzelt", await api.put(`/api/workspace/cash/${in1000.id}`, { kind: "in", amount: "900", date: TODAY, description: "t" }));
  rec("guard", "B15c girişin tarihini +15 yap", await api.put(`/api/workspace/cash/${in1000.id}`, { kind: "in", amount: "1000", date: addDays(TODAY, 15), description: "t" }));
  rec("guard", "B16 giriş 1000 sil", await api.del(`/api/workspace/cash/${in1000.id}`));
  rec("guard", "B16b ileri giriş 5000 sil", await api.del(`/api/workspace/cash/${fut.id}`));
  // Stok nakit alımı.
  const item = await api.post("/api/workspace/stock", { name: "Çay", unit: "Adet", openingQty: "0" });
  rec("guard", "B17 stok kartı", item);
  if (item.status === 200) {
    const sid = item.data.id || item.data.item?.id;
    rec("guard", "B17b stok nakit alım 40×90", await api.post(`/api/workspace/stock/${sid}/moves`, { kind: "in", qty: "40", unitPrice: "90", pay: "cash", date: TODAY }));
    rec("guard", "B17c stok nakit alım 1×90", await api.post(`/api/workspace/stock/${sid}/moves`, { kind: "in", qty: "1", unitPrice: "90", pay: "cash", date: TODAY }));
  }
  // Transfer.
  rec("guard", "B18 kasadan bankaya 100000", await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "100000", date: TODAY }));
  rec("guard", "B18b kasadan bankaya 100", await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "100", date: TODAY }));
  // Eşzamanlı iki ödeme.
  const k = await api.get("/api/workspace/cash");
  out.guard.push({ label: "kasa eşzamanlı öncesi", byMethod: k.data?.byMethod, byMethodAt: k.data?.byMethodAt, balance: k.data?.balance });
  rec("guard", "B19 tamamla 1000 giriş", await cash({ kind: "in", amount: "1000", date: TODAY }));
  const k2 = await api.get("/api/workspace/cash");
  const avail = Math.min(k2.data?.byMethodAt?.cash ?? k2.data?.byMethod?.cash, k2.data?.byMethod?.cash);
  out.guard.push({ label: "kasa eşzamanlı", byMethod: k2.data?.byMethod, avail });
  const half = String(Math.floor((avail * 0.6) * 100) / 100).replace(".", ",");
  const both = await Promise.all([cash({ kind: "out", amount: half, date: TODAY }), cash({ kind: "out", amount: half, date: TODAY })]);
  out.guard.push({ label: `B20 eşzamanlı iki çıkış ${half}`, statuses: both.map(r => `${r.status} ${r.code || ""}`).sort() });
  // Engelle / Kontrol Yok.
  rec("guard", "B21 politika block", await api.put("/api/admin/negative-policy", { cash: "block" }));
  rec("guard", "B21b çıkış 100000 onaylı (block)", await cash({ kind: "out", amount: "100000", date: TODAY, cashForce: true }));
  rec("guard", "B21c cari nakit ödeme 100000 onaylı (block)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "cash", amount: "100000", date: TODAY, cashForce: true }));
  rec("guard", "B22 politika off", await api.put("/api/admin/negative-policy", { cash: "off" }));
  rec("guard", "B22b çıkış 100000 (off)", await cash({ kind: "out", amount: "100000", date: TODAY }));
  rec("guard", "B22c politika warn", await api.put("/api/admin/negative-policy", { cash: "warn" }));
  rec("guard", "B22d çıkış 1 (Kasa eksi)", await cash({ kind: "out", amount: "1", date: TODAY }));

  // ---------- C. Banka K7 ve kurumsal kart ----------
  const BANK = "/api/workspace/bank";
  const ziraat = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "1000", confirmed: true } }));
  idName.set(ziraat.id, "ZIRAAT");
  rec("guard", "C1 politika Engelle", await api.put(`${BANK}/accounts/${ziraat.id}`, { negativePolicy: "block" }));
  rec("guard", "C2 havale ödeme 2000 (Engelle)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "bank", amount: "2000", date: TODAY, bankAccountId: ziraat.id, cashForce: true }));
  rec("guard", "C3 havale ödeme 1000 (tam)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "bank", amount: "1000", date: TODAY, bankAccountId: ziraat.id }));
  rec("guard", "C4 politika Uyar", await api.put(`${BANK}/accounts/${ziraat.id}`, { negativePolicy: "warn" }));
  rec("guard", "C5 havale ödeme 1 (Uyar)", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "bank", amount: "1", date: TODAY, bankAccountId: ziraat.id }));
  rec("guard", "C6 havale ödeme 1 onaylı", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "bank", amount: "1", date: TODAY, bankAccountId: ziraat.id, negativeOk: true }));
  rec("guard", "C7 bankadan kasaya 50 (Uyar)", await api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "50", date: TODAY, bankAccountId: ziraat.id }));
  const card = await must("kart", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Kurumsal", kind: "card", creditLimit: "500", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
  idName.set(card.id, "KART");
  rec("guard", "C8 kartla ödeme 501", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "card", amount: "501", date: TODAY, bankAccountId: card.id }));
  rec("guard", "C9 kartla ödeme 500", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "card", amount: "500", date: TODAY, bankAccountId: card.id }));
  rec("guard", "C10 kartla ödeme 0,01", await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "card", amount: "0,01", date: TODAY, bankAccountId: card.id }));
  rec("guard", "C11 nakit çıkış 1 (kart/banka Kasa'yı etkilemez)", await cash({ kind: "out", amount: "1", date: TODAY }));
  const fin = await api.get("/api/workspace/cash");
  out.guard.push({ label: "kasa son", byMethod: fin.data?.byMethod, byMethodAt: fin.data?.byMethodAt, balance: fin.data?.balance });
  const integ = await api.get("/api/workspace/ledger/integrity");
  out.guard.push({ label: "mutabakat", ok: integ.data?.ok, failures: (integ.data?.failures || []).map(f => f.code) });
} finally {
  await ctx.server.close();
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`arama ${out.search.length}, liste ${out.list.length}, denetim ${out.guard.length}`);
