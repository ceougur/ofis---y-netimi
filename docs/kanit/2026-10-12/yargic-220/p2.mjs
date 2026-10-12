// Yargıç 2.2.0 — p2: v2.1.0'ın GERÇEK koduyla (7c6405f, ayrı kopya) üretilen veri 2.2.0'da (göç 21) açılınca ne olur?
// Kasa "Açılış …" girişleri (2.1.0'da 649), iki "Açılış" girişi, kilitli dönem; kurumsal kart; POS'suz kart tahsilatı (108.00); çek/senet.
// Koşu: node docs/kanit/2026-10-12/yargic-220/p2.mjs <eski-kod-klasörü>
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OLD_DIR = process.argv[2];
if (!OLD_DIR) throw new Error("eski kod klasörü verilmeli");
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank";
const root = mkdtempSync(path.join(process.env.SP || "/tmp", "yargic220-p2-"));
const dirs = { dataDir: path.join(root, "data") };
const ok = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data?.ok === true ? res.data.data : res.data;
};
const trial = ledger => Object.fromEntries(ledger.trial.accounts.map(r => [r.code, r.balance]));
const trIban = (bankCode, account) => {
  const bban = `${String(bankCode).padStart(5, "0")}0${String(account).padStart(16, "0")}`;
  let rest = 0;
  for (const digit of `${bban}292700`) rest = (rest * 10 + Number(digit)) % 97;
  return `TR${String(98 - rest).padStart(2, "0")}${bban}`;
};

// ---------- 1) v2.1.0 ----------
const oldH = await import(pathToFileURL(path.join(OLD_DIR, "test", "helpers.mjs")).href);
let srv = await oldH.startTestServer({ ...dirs, now: NOW });
let api = await oldH.loginAdmin(srv);
const buyer = await ok("müşteri", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
const seller = await ok("tedarikçi", api.post("/api/workspace/accounts", { name: "Eski Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }));
const ziraat = await ok("banka", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: trIban(10, 1234567), opening: { date: "2026-09-01", amount: "100.000", confirmed: true } }));
const kart = await ok("kart", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Bankkart", kind: "card", creditLimit: "50.000", opening: { date: "2026-09-01", amount: "0", confirmed: true } }));
const cash = (body, label) => ok(label, api.post("/api/workspace/cash", { method: "cash", ...body }));
await cash({ kind: "in", amount: "5.000", date: "2026-09-01", description: "Açılış bakiyesi" }, "kasa açılış");
await cash({ kind: "in", amount: "300", date: "2026-09-10", description: "Avans iadesi" }, "kasa giriş");
await cash({ kind: "in", amount: "100", date: "2026-09-15", description: "Açılış farkı (sayım)" }, "kasa 2. açılış");
await cash({ kind: "out", amount: "200", date: "2026-09-20", description: "Kırtasiye" }, "kasa çıkış");
await cash({ kind: "in", amount: "50", date: "2026-10-03", description: "açılışta unutulan bozuk para" }, "kasa 3. 'açılış'");
await ok("POS'suz kart tahsilatı", api.post(`/api/workspace/accounts/${buyer.id}/entries`, { kind: "in", amount: "1.000", method: "card", date: "2026-09-25" }));
await ok("kartla ödeme", api.post(`/api/workspace/accounts/${seller.id}/entries`, { kind: "out", amount: "400", method: "card", bankAccountId: kart.id, date: "2026-09-26" }));
await ok("alınan çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "700", issueDate: "2026-09-20", dueDate: "2026-12-01", accountId: buyer.id, serialNo: "Y-C1", bank: "Akbank" }));
await ok("alınan senet", api.post("/api/workspace/cheques", { direction: "in", instrument: "note", amount: "900", issueDate: "2026-09-20", dueDate: "2026-12-01", accountId: buyer.id, serialNo: "Y-N1" }));
await ok("verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "350", issueDate: "2026-09-22", dueDate: "2026-11-15", accountId: seller.id, serialNo: "Y-V1", bank: "Ziraat Bankası Merkez" }));
await ok("dönem kilidi", api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
const oldLedger = await ok("eski Ana Defter", api.get("/api/workspace/ledger"));
const oldLedgerSep = await ok("eski Ana Defter Eylül", api.get("/api/workspace/ledger?from=2026-09-01&to=2026-09-30"));
const oldInteg = await ok("eski mutabakat", api.get("/api/workspace/ledger/integrity"));
const oldCash = await ok("eski Kasa", api.get("/api/workspace/cash"));
await srv.app.close();

// ---------- 2) 2.2.0 (HEAD) aynı veri dosyasıyla ----------
const newH = await import(pathToFileURL(path.resolve("test/helpers.mjs")).href);
srv = await newH.startTestServer({ ...dirs, now: NOW });
api = await newH.loginAdmin(srv);
const newLedger = await ok("yeni Ana Defter", api.get("/api/workspace/ledger"));
const newLedgerSep = await ok("yeni Ana Defter Eylül", api.get("/api/workspace/ledger?from=2026-09-01&to=2026-09-30"));
const newInteg = await ok("yeni mutabakat", api.get("/api/workspace/ledger/integrity"));
const accounts = await ok("hesaplar", api.get(`${BANK}/accounts`));
const diff = (a, b) => {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.filter(k => (a[k] ?? 0) !== (b[k] ?? 0)).map(k => `${k}: ${a[k] ?? 0} → ${b[k] ?? 0}`);
};
console.log("ESKİ mutabakat ok:", oldInteg.ok, "YENİ mutabakat ok:", newInteg.ok, JSON.stringify((newInteg.failures || []).map(f => [f.code, f.label || f.name, f.detail || f.message]).slice(0, 6)));
console.log("Mizan farkı (bütün dönem) eski → yeni:", JSON.stringify(diff(trial(oldLedger), trial(newLedger))));
console.log("Mizan farkı (KİLİTLİ Eylül) eski → yeni:", JSON.stringify(diff(trial(oldLedgerSep), trial(newLedgerSep))));
console.log("Toplam borç/alacak eski:", oldLedger.trial.totals, "yeni:", newLedger.trial.totals);
console.log("Kasa bakiyesi eski:", oldCash.balance ?? oldCash.summary?.balance);
const newCash = await ok("yeni Kasa", api.get("/api/workspace/cash"));
console.log("Kasa bakiyesi yeni:", newCash.balance ?? newCash.summary?.balance, "açılış bilgisi:", JSON.stringify(newCash.opening ?? newCash.cashOpening ?? null).slice(0, 300));
const list = accounts.accounts || accounts.rows || accounts;
console.log("Hesaplar:", JSON.stringify((Array.isArray(list) ? list : []).map(a => ({ name: `${a.bankName} · ${a.name}`, kind: a.kind, parentId: a.parentId, suggest: a.parentSuggestion || a.suggestedParent || a.suggestParent || null, flags: [a.useCard, a.useCheque, a.useNote, a.usePos] }))));
// Yeni Kasa açılış girişi (Kasa → Açılış Bakiyesi) ile eski iki "Açılış" girişi
const op = await api.post("/api/workspace/cash/opening", { amount: "1.000", date: "2026-10-01" });
console.log("Kasa → Açılış Bakiyesi (eski veride iki 'Açılış' varken):", op.status, JSON.stringify(op.data).slice(0, 300));
// Eski veride sıradan bir Kasa girişi açıklaması düzeltmesi (açık dönemde, 'açılışta…' satırı)
const entries = newCash.entries || newCash.rows || [];
const third = entries.find(e => /bozuk para/.test(e.description || ""));
if (third) {
  const ed = await api.put(`/api/workspace/cash/${third.id}`, { kind: "in", amount: "50", date: "2026-10-03", description: "Bozuk para", method: "cash" });
  console.log("eski 'açılışta…' girişinin açıklamasını düzelt:", ed.status, JSON.stringify(ed.data).slice(0, 300));
}
// POS tanımlanınca eski 108.00 satırı
await ok("POS Kullan", api.put(`${BANK}/accounts/${ziraat.id}`, { usePos: true }));
const posRes = await api.post(`${BANK}/pos`, { name: "Ziraat POS", bankAccountId: ziraat.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 1, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "1", terminalNo: "T1", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2" }] });
console.log("POS aç:", posRes.status);
const sub = await ok("alt hesap", api.get(`${BANK}/sub-trial`));
console.log("Alt Hesap Mizanı 108.*/309.*/101.*/121.*/103/321:", JSON.stringify(sub.rows.filter(r => /^(108|309|101|121|103|321)/.test(r.sub)).map(r => [r.sub, r.balance, r.name])));
const integ2 = await ok("mutabakat", api.get("/api/workspace/ledger/integrity"));
console.log("son mutabakat ok:", integ2.ok, JSON.stringify((integ2.failures || []).map(f => [f.code, f.name || f.label]).slice(0, 6)));
await srv.app.close();
process.exit(0);
