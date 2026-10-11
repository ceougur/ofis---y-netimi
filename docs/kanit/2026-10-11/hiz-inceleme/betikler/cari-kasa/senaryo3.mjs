// Rastgele (tohumlu) 300 cari: aynı ad, büyük/küçük harf farkıyla aynı Cari No, pasif, silinmiş, tür karışık; arama eski ↔ yeni.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, outFile, seedArg] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { bootBank } = await imp("test/banka-210-hesap-ortak.mjs");
let seed = Number(seedArg || 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = list => list[Math.floor(rnd() * list.length)];
const ctx = await bootBank({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
const api = ctx.api;
const names = new Map();
const out = [];
try {
  const accs = [];
  for (let i = 0; i < 300; i += 1) {
    const name = `${pick(["Ali", "ALİ", "ali", "Ayşe", "Işıl", "ışıl", "Ömer", "ömer", "Can"])} ${pick(["Kaya", "KAYA", "Er", "Şen", "Uç"])}${rnd() < 0.3 ? "" : ` ${Math.floor(rnd() * 40)}`}`;
    const refNo = rnd() < 0.2 ? pick(["x1", "X1", "x2", "y10", "Y9", "5", "05", "50", "z"]) + (rnd() < 0.5 ? "" : String(i)) : "";
    const res = await api.post("/api/workspace/accounts", { name, type: pick(["customer", "supplier", "other"]), phone: rnd() < 0.5 ? `05${Math.floor(rnd() * 1e9)}` : "", status: rnd() < 0.15 ? "passive" : "active", registeredOn: "2026-06-01", ...(refNo ? { refNo } : {}) });
    if (res.status !== 200) { out.push({ create: i, status: res.status, error: res.error }); continue; }
    names.set(res.data.id, `${i}`);
    accs.push(res.data);
    if (rnd() < 0.5) await api.post(`/api/workspace/accounts/${res.data.id}/entries`, { kind: pick(["debt", "credit"]), amount: String(Math.floor(rnd() * 5000) + 1), date: "2026-09-01" });
    if (rnd() < 0.1) await api.post("/api/workspace/plans", { accountId: res.data.id, name, total: "900", mode: "auto", count: 3, firstDue: "2026-08-01", registeredOn: "2026-07-01" });
  }
  for (const a of accs.filter(() => rnd() < 0.05)) await api.del(`/api/workspace/accounts/${a.id}`);
  const qs = ["", "a", "al", "ali", "ALİ", "ALI", "ı", "ışıl", "IŞIL", "ö", "Ö", "kaya", "x1", "X1", "05", "5", "1", "2", "er", "şen", "uç", "can 1"];
  for (const q of qs) for (const type of ["", "customer", "supplier", "other"]) for (const prefer of ["", "supplier", "customer", "other"]) {
    const p = new URLSearchParams({ q, ...(type ? { type } : {}), ...(prefer ? { prefer } : {}) });
    const res = await api.get(`/api/workspace/accounts/search?${p}`);
    out.push({ p: String(p), status: res.status, rows: (res.data || []).map(r => [names.get(r.id), r.refNo, r.name, r.type, r.balance, r.status]) });
  }
} finally { await ctx.server.close(); }
writeFileSync(outFile, JSON.stringify(out));
console.log(out.length, out.filter(x => x.rows?.length === 20).length);
