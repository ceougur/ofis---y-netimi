// Gerileme fark testi (bağımsız doğrulayıcı, 12.10.2026; KOD DEĞİŞTİRMEZ): mevcut çek/senet akışları (al/ver/tahsil/ciro/karşılıksız/geri al,
// faturadan gelen çek, faturayla ciro, taksite sayılan çek, carisiz evrak, düzelt/sil) AYNI API sırasıyla iki kodda koşulur:
//   v2.1.0 (gerçek etiket kodu; test/guvenilirlik/surumler.mjs checkoutTag → git archive ayrı kopya) ve guncel (bu worktree).
// Her adımın yanıtı (durum + gövde) ve sonda okunan ekran/rapor uçları (çek listesi + süzgeçler, çek kartları, Ana Defter mizanı, Mutabakat
// Testi, Alt Hesap Mizanı, banka hesapları, cari listesi, Nakit Akış, Vade Takip, takvim/zil, ANLIK DURUM, Rapor Merkezi'nin BÜTÜN raporları,
// fatura portföy seçicisi) kimlikler normalleştirilerek JSON'a yazılır. Karşılaştırma ayrı betikte (fark-karsilastir.mjs).
//
//   node docs/kanit/2026-10-12/tahsile-ver/gerileme/fark-cek-akislari.mjs <v2.1.0|guncel> <cikti.json>
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CURRENT, bootVersion } from "../../../../../test/guvenilirlik/surumler.mjs";

const [version = CURRENT, out = "fark.json"] = process.argv.slice(2);
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "fark-cek-"));
const app = await bootVersion(version, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: NOW, fixed: true }, moneyStrict: true, gateVerify: true, reportWorker: false });
const api = await app.login();

const labels = new Map(); // gerçek kimlik → etiket
const name = (id, label) => {
  if (id && !labels.has(id)) labels.set(id, label);
  return id;
};
const steps = [];
const call = async (label, method, url, body) => {
  const res = method === "GET" ? await api.get(url) : method === "PUT" ? await api.put(url, body) : method === "DELETE" ? await api.del(url, body) : await api.post(url, body);
  steps.push({ label, method, url, body, status: res.status, data: res.data });
  return res;
};
const must = async (label, method, url, body) => {
  const res = await call(label, method, url, body);
  if (res.status !== 200) throw new Error(`${version}: ${label} ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};

// ---- Kurulum ----
const ziraat = await must("hesap ziraat", "POST", "/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
name(ziraat.id, "bank:ziraat");
const garanti = await must("hesap garanti", "POST", "/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
name(garanti.id, "bank:garanti");
const abc = await must("cari ABC", "POST", "/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" });
name(abc.id, "cari:ABC");
const xyz = await must("cari XYZ", "POST", "/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" });
name(xyz.id, "cari:XYZ");
const def = await must("cari DEF", "POST", "/api/workspace/accounts", { name: "DEF Müşteri", type: "customer", registeredOn: "2026-09-01" });
name(def.id, "cari:DEF");
await must("kasa açılış nakit", "POST", "/api/workspace/cash", { kind: "in", amount: "20.000", date: "2026-10-01", note: "Kasa açılış" }).catch(() => null);

const CH = "/api/workspace/cheques";
const cheque = async (label, body) => {
  const data = await must(`çek al ${label}`, "POST", CH, { direction: "in", instrument: "cheque", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body });
  name(data.id, `cek:${label}`);
  return data;
};
const act = (label, id, body) => call(label, "POST", `${CH}/${id}/actions`, body);
const undo = (label, id) => call(label, "POST", `${CH}/${id}/undo`, {});

// ---- Çek akışları ----
const c1 = await cheque("C1", { amount: "1.000", accountId: abc.id, serialNo: "C1", bank: "Akbank Kadıköy" });
await act("C1 tahsil havale ziraat", c1.id, { action: "collect", date: "2026-10-08", method: "bank", bankAccountId: ziraat.id, status: "portfolio" });
await undo("C1 geri al", c1.id);
await act("C1 tahsil hesapsız (çok hesap)", c1.id, { action: "collect", date: "2026-10-08", method: "bank" });
await act("C1 tahsil nakit", c1.id, { action: "collect", date: "2026-10-08", method: "cash" });
await undo("C1 geri al 2", c1.id);
await act("C1 tahsil havale garanti", c1.id, { action: "collect", date: "2026-10-07", method: "bank", bankAccountId: garanti.id });
await act("C1 ikinci tahsil (409)", c1.id, { action: "collect", date: "2026-10-08", method: "bank", bankAccountId: garanti.id });

const c2 = await cheque("C2", { amount: "2.000", accountId: abc.id, serialNo: "C2", bank: "Yapı Kredi" });
await act("C2 ciro XYZ", c2.id, { action: "endorse", date: "2026-10-06", accountId: xyz.id });
await undo("C2 ciro geri al", c2.id);
await act("C2 ciro alındığı cariye (400)", c2.id, { action: "endorse", date: "2026-10-06", accountId: abc.id });
await act("C2 ciro XYZ yeniden", c2.id, { action: "endorse", date: "2026-10-07", accountId: xyz.id });

const c3 = await cheque("C3", { amount: "3.000", accountId: def.id, serialNo: "C3", bank: "İş Bankası" });
await act("C3 karşılıksız", c3.id, { action: "bounce", date: "2026-10-07" });
await undo("C3 karşılıksız geri al", c3.id);
await act("C3 karşılıksız yeniden", c3.id, { action: "bounce", date: "2026-10-08" });

const c4 = await must("çek ver C4", "POST", CH, { direction: "out", instrument: "cheque", amount: "1.500", accountId: xyz.id, serialNo: "C4", bank: "Garanti", issueDate: "2026-10-05", dueDate: "2026-10-20" });
name(c4.id, "cek:C4");
await act("C4 ödeme havale garanti", c4.id, { action: "pay", date: "2026-10-08", method: "bank", bankAccountId: garanti.id });
await undo("C4 ödeme geri al", c4.id);
await act("C4 ödeme nakit", c4.id, { action: "pay", date: "2026-10-08", method: "cash", cashForce: true });

const n1 = await cheque("N1", { instrument: "note", amount: "500", accountId: abc.id, serialNo: "N1", dueDate: "2026-11-15" });
await act("N1 tahsil nakit", n1.id, { action: "collect", date: "2026-10-08", method: "cash" });

const f1 = await cheque("F1", { amount: "700", drawer: "Elden Kişi", serialNo: "F1", dueDate: "2026-10-10" });
await act("F1 tahsil nakit", f1.id, { action: "collect", date: "2026-10-08", method: "cash" });
const f2 = await cheque("F2", { amount: "650", drawer: "Carisiz Keşideci", serialNo: "F2", dueDate: "2026-10-11" });

const plan = await must("taksit kartı P1", "POST", "/api/workspace/plans", { name: "ABC Taksit", accountId: abc.id, total: "900", mode: "auto", count: 1, firstDue: "2026-11-08", registeredOn: "2026-10-01" });
name(plan.id, "plan:P1");
const c5 = await cheque("C5", { amount: "900", accountId: abc.id, planId: plan.id, serialNo: "C5" });
await act("C5 karşılıksız (taksitli)", c5.id, { action: "bounce", date: "2026-10-08" });
await undo("C5 karşılıksız geri al", c5.id);

const c6 = await cheque("C6", { amount: "400", accountId: abc.id, serialNo: "C6" });
await call("C6 tutar düzelt", "PUT", `${CH}/${c6.id}`, { amount: "450", updatedAt: (await api.get(`${CH}/${c6.id}`)).data.updatedAt });
await call("C6 vade düzelt", "PUT", `${CH}/${c6.id}`, { dueDate: "2026-12-01" });
await call("C6 sil", "DELETE", `${CH}/${c6.id}`);

const c7 = await cheque("C7", { amount: "600", accountId: def.id, serialNo: "C7", dueDate: "2026-10-10" });
const c8 = await cheque("C8", { amount: "1.250", accountId: def.id, serialNo: "C8", dueDate: "2026-10-17" });

// ---- Faturalar ----
const INV = "/api/workspace/invoices";
const sale1 = await must("satış faturası çekle", "POST", INV, { kind: "sale", accountId: abc.id, issueDate: "2026-10-08", pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "2.000", dueDate: "2026-11-20", serialNo: "FC-1", bank: "İş Bankası" }], endorse: [], rest: "open" }, force: true });
name(sale1.id, "fat:S1");
const sale2 = await must("satış faturası çekle 2", "POST", INV, { kind: "sale", accountId: def.id, issueDate: "2026-10-08", pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1200, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "note", amount: "1.200", dueDate: "2026-11-25", serialNo: "FN-2", bank: "" }], endorse: [], rest: "open" }, force: true });
name(sale2.id, "fat:S2");
await call("satış 2 iptal (çek kalkar)", "POST", `${INV}/${sale2.id}/cancel`, { reason: "deneme" });
const portfolio = await must("ciro portföyü", "GET", `${INV}/portfolio`);
for (const row of portfolio.cheques || portfolio || []) if (row?.serialNo && row.id) name(row.id, `cek:${row.serialNo}`);
const purchase1 = await must("alış faturası ciro C7", "POST", INV, { kind: "purchase", accountId: xyz.id, number: "A-1", issueDate: "2026-10-08", pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 600, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [c7.id], rest: "open" }, force: true });
name(purchase1.id, "fat:A1");
await call("alış 1 iptal (ciro geri)", "POST", `${INV}/${purchase1.id}/cancel`, { reason: "deneme" });
const fc1 = (await api.get(`${CH}?q=FC-1`)).data.cheques?.[0];
if (fc1) name(fc1.id, "cek:FC-1");
const purchase2 = await must("alış faturası ciro FC-1", "POST", INV, { kind: "purchase", accountId: xyz.id, number: "A-2", issueDate: "2026-10-08", pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 2500, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "500", dueDate: "2026-11-30", serialNo: "VC-1", bank: "Halkbank" }], endorse: fc1 ? [fc1.id] : [], rest: "open" }, force: true });
name(purchase2.id, "fat:A2");
await call("satış 1 iptal (çek ciro edildi: 409)", "POST", `${INV}/${sale1.id}/cancel`, { reason: "deneme" });

// ---- Okuma (ekran ve rapor uçları) ----
const reads = {};
const read = async (key, url) => {
  const res = await api.get(url);
  reads[key] = { status: res.status, data: res.data };
};
await read("cekListe", CH);
for (const status of ["portfolio", "collected", "endorsed", "bounced", "paid", "pending", "open", "closed", "overdue", "soon"]) await read(`cekListe:${status}`, `${CH}?status=${status}`);
await read("cekListe:in", `${CH}?direction=in`);
await read("cekListe:abc", `${CH}?account=${abc.id}`);
const all = (await api.get(CH)).data.cheques || [];
for (const row of all) {
  name(row.id, `cek:${row.serialNo || row.id}`);
  await read(`cekKart:${row.serialNo}`, `${CH}/${row.id}`);
}
await read("portfoy", `${INV}/portfolio`);
await read("anaDefter", "/api/workspace/ledger");
await read("anaDefterDonem", "/api/workspace/ledger?from=2026-10-06&to=2026-10-07");
await read("mutabakat", "/api/workspace/ledger/integrity");
await read("altHesap", "/api/workspace/bank/sub-trial");
await read("altHesapDonem", "/api/workspace/bank/sub-trial?from=2026-10-06&to=2026-10-07");
await read("bankaHesaplar", "/api/workspace/bank/accounts");
await read("cariler", "/api/workspace/accounts");
await read("nakitAkis", "/api/workspace/overview/nakit-akisi");
await read("vadeTakip", "/api/workspace/overview/vade-takip");
await read("vadeTakipCek", "/api/workspace/overview/vade-takip?sources=cheque,note");
await read("anlikDurum", "/api/workspace/overview");
await read("dues", "/api/workspace/dues");
const catalog = (await api.get("/api/workspace/report-center")).data;
for (const report of catalog.reports || []) {
  await read(`rapor:${report.id}`, `/api/workspace/report-center/${report.id}?preset=all`);
  await read(`rapor:${report.id}:varsayilan`, `/api/workspace/report-center/${report.id}`);
}
for (const report of (catalog.reports || []).filter(item => item.params?.includes("account"))) await read(`rapor:${report.id}:abc`, `/api/workspace/report-center/${report.id}?preset=all&account=${abc.id}`);
await read("ekstreABC", `/api/workspace/overview/ekstre?account=${abc.id}&preset=all`);
await read("mizan", "/api/workspace/overview/mizan?preset=all");

// ---- Normalleştirme ----
const ID = /^(?:[a-z]+[-_])?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z]{2,8}-[0-9a-z]{6,}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SKIP = new Set(["createdAt", "updatedAt", "created_at", "updated_at", "generatedAt", "durationMs", "ms", "took", "elapsedMs"]);
const anon = new Map();
const norm = value => {
  if (Array.isArray(value)) return value.map(norm);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !SKIP.has(key)).map(([key, item]) => [key, norm(item)]));
  if (typeof value === "string") {
    if (labels.has(value)) return `<${labels.get(value)}>`;
    if (ISO.test(value)) return "<zaman>";
    let text = value;
    for (const [id, label] of labels) if (text.includes(id)) text = text.split(id).join(`<${label}>`);
    if (ID.test(text)) {
      if (!anon.has(text)) anon.set(text, `<id${anon.size + 1}>`);
      return anon.get(text);
    }
    return text;
  }
  return value;
};
writeFileSync(out, JSON.stringify({ version, commit: app.commit, steps: norm(steps), reads: norm(reads) }, null, 1));
console.log(`${version}: ${steps.length} adım, ${Object.keys(reads).length} okuma → ${out}`);
await app.close();
