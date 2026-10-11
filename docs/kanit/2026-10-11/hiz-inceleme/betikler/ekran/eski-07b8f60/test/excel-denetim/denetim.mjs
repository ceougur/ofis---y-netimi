// Mali denetim: programın kendi ekranlarından/raporlarından okunan sayılar, Excel'den bağımsız hesaplanan beklenenle
// (model.py → beklenen.json) karşılaştırılır. Her iki şirket ayrı ayrı; şirketler arası karışma da denetlenir.
// Kullanım: SP=<çalışma> [DATE_TO=YYYY-MM-DD] node denetim.mjs
import fs from "node:fs";
import path from "node:path";
import { HERE, PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const ROOT = path.join(SP, "canli");
const OUT = path.join(HERE, "cikti");
const RAW = path.join(OUT, "ham");
fs.mkdirSync(RAW, { recursive: true });
const DATE_TO = process.env.DATE_TO || "";
const EXP = JSON.parse(fs.readFileSync(path.join(HERE, `veri/beklenen${DATE_TO ? `-${DATE_TO}` : ""}.json`), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = startServer(ROOT, { fresh: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;

const rows = [];
let section = "";
const near = (a, b, eps = 0.006) => Math.abs(Number(a) - Number(b)) < eps;
const tl = n => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
function check(company, label, expected, actual, { eps = 0.006, fmt = tl, note = "" } = {}) {
  const ok = typeof expected === "number" ? near(expected, actual, eps) : String(expected) === String(actual);
  rows.push({ company, section, label, expected: typeof expected === "number" ? fmt(expected) : String(expected), actual: typeof actual === "number" ? fmt(actual) : String(actual), ok, note });
  console.log(`${ok ? "✓" : "✗"} [${company}] ${label}: beklenen ${typeof expected === "number" ? fmt(expected) : expected} · program ${typeof actual === "number" ? fmt(actual) : actual}${note ? ` (${note})` : ""}`);
  return ok;
}
const money = text => {
  if (typeof text === "number") return text;
  const t = String(text ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(t) || 0;
};
const summaryOf = (rep, re) => { const row = (rep?.summary || []).find(([k]) => re.test(k)); return row ? money(row[1]) : null; };
const n = v => Number(v);

const admin = staff(BASE);
if ((await admin.login("admin", PASS)).status !== 200) throw new Error("yönetici girişi");

const reports = ["kdv-ozeti", "fatura-satis", "fatura-alis", "gider-raporu", "banka-pos-hareketleri", "kasa-hareketleri", "mizan", "hesap-mizani", "defter-mutabakati", "cek-portfoy", "taksit-kartlari", "stok-durumu", "acik-faturalar", "cari-listesi", "cari-tahsilat", "taksit-tahsilatlari"];
const snapshot = {};
for (const [code, id] of Object.entries(state.companies)) {
  const c = admin.withCompany(id);
  const get = async url => { const r = await c.get(url); if (r.status !== 200) console.log(`  ! ${code} ${url} → ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); return r.data; };
  const snap = (snapshot[code] = {
    overview: await get("/api/workspace/overview"),
    cash: await get("/api/workspace/cash?period=all"),
    accounts: await get("/api/workspace/accounts?status=all&limit=5000"),
    stock: await get("/api/workspace/stock?limit=1000"),
    cheques: await get("/api/workspace/cheques?status=all&limit=5000"),
    plans: await get("/api/workspace/plans?status=all&limit=5000"),
    invoiceCounts: (await get("/api/workspace/invoices?tab=sale"))?.tabCounts,
    reports: {},
  });
  for (const id2 of reports) snap.reports[id2] = await get(`/api/workspace/report-center/${id2}?preset=all`);
  fs.writeFileSync(path.join(RAW, `${code}.json`), JSON.stringify(snap, null, 1));
}

for (const [code] of Object.entries(state.companies)) {
  const s = snapshot[code];
  section = "İşlem sayıları";
  const counts = EXP.counts;
  check(code, "Satış faturası adedi", counts["Mal Satışı"], s.invoiceCounts?.sale, { fmt: String });
  check(code, "Alış + gider faturası adedi", counts["Mal Alımı"] + counts["Gider Ödemesi"], s.invoiceCounts?.purchase, { fmt: String });
  const accRows = s.accounts.accounts;
  check(code, "Cari kartı adedi (350 Excel + 12 personel + 11 gider)", 373, accRows.length, { fmt: String });

  section = "KDV";
  const kdv = s.reports["kdv-ozeti"];
  check(code, "Hesaplanan KDV (391)", n(EXP.kdv.hesaplanan), summaryOf(kdv, /Hesaplanan/));
  check(code, "İndirilecek KDV (191)", n(EXP.kdv.indirilecek), summaryOf(kdv, /İndirilecek/));
  check(code, "Devreden/Ödenecek KDV", Math.abs(n(EXP.kdv.odenecek)), summaryOf(kdv, /Devreden|Ödenecek/));

  section = "Kasa ve Banka/POS";
  check(code, "Nakit Kasa bakiyesi", n(EXP.balances.cash), s.cash?.totals?.balance);
  const ov = s.overview;
  check(code, "Banka (Havale/EFT) bakiyesi — ANLIK DURUM", n(EXP.balances.bank), ov?.cash?.byMethod?.bank);
  check(code, "POS / Kredi Kartı bakiyesi — ANLIK DURUM", n(EXP.balances.card), ov?.cash?.byMethod?.card);
  const bp = s.reports["banka-pos-hareketleri"];
  check(code, "Banka — Banka ve POS Hareketleri raporu", n(EXP.balances.bank), summaryOf(bp, /^Banka/));
  check(code, "POS / Kredi Kartı — Banka ve POS Hareketleri raporu", n(EXP.balances.card), summaryOf(bp, /^POS/));
  const methodIn = m => n(EXP.methods[`${m}:in`] || 0), methodOut = m => n(EXP.methods[`${m}:out`] || 0);
  check(code, "Banka + POS dönem girişi", methodIn("bank") + methodIn("card"), summaryOf(bp, /Dönem Giriş/));
  check(code, "Banka + POS dönem çıkışı", methodOut("bank") + methodOut("card"), summaryOf(bp, /Dönem Çıkış/));

  section = "Cari bakiyeler";
  const byRef = new Map(accRows.map(a => [a.refNo, a]));
  let wrong = 0;
  const wrongList = [];
  for (const [ref, bal] of Object.entries(EXP.cari)) {
    const a = byRef.get(ref);
    if (!a || !near(a.balance, n(bal))) { wrong += 1; if (wrongList.length < 10) wrongList.push(`${ref} beklenen ${bal} program ${a?.balance}`); }
  }
  check(code, `Cari bakiyesi tutan cari (${Object.keys(EXP.cari).length} cari tek tek)`, Object.keys(EXP.cari).length, Object.keys(EXP.cari).length - wrong, { fmt: String, note: wrongList.join("; ") });
  const debtors = accRows.filter(a => a.balance > 0).reduce((t, a) => t + a.balance, 0);
  const creditors = accRows.filter(a => a.balance < 0).reduce((t, a) => t - a.balance, 0);
  check(code, "Borçlu cariler toplamı (alacağımız)", n(EXP.cari_totals.borclu), debtors);
  check(code, "Alacaklı cariler toplamı (borcumuz)", n(EXP.cari_totals.alacakli), creditors);
  const personnel = accRows.filter(a => /^PER-/.test(a.refNo || "")).reduce((t, a) => t + Math.abs(a.balance), 0);
  const gider = accRows.filter(a => /^GDR-/.test(a.refNo || "")).reduce((t, a) => t + Math.abs(a.balance), 0);
  check(code, "Personel carileri (maaş tahakkuk = ödeme) bakiye", 0, personnel);
  check(code, "Gider carileri (peşin ödenen gider) bakiye", 0, gider);

  section = "Stok";
  const items = s.stock.items || s.stock.rows || [];
  const byCode = new Map(items.map(i => [i.code, i]));
  let stockWrong = 0;
  const sw = [];
  for (const [codeP, qty] of Object.entries(EXP.stock)) {
    const it = byCode.get(codeP);
    if (!it || !near(it.qty, n(qty), 0.0005)) { stockWrong += 1; if (sw.length < 8) sw.push(`${codeP} beklenen ${qty} program ${it?.qty}`); }
  }
  check(code, `Stok miktarı tutan ürün (${Object.keys(EXP.stock).length} ürün)`, Object.keys(EXP.stock).length, Object.keys(EXP.stock).length - stockWrong, { fmt: String, note: sw.join("; ") });

  section = "Çek / Senet";
  const ch = s.cheques.cheques || s.cheques.rows || [];
  const inT = ch.filter(x => x.direction === "in").reduce((t, x) => t + x.amount, 0);
  const outT = ch.filter(x => x.direction === "out").reduce((t, x) => t + x.amount, 0);
  check(code, "Alınan çek/senet adedi", EXP.cheques.in_count, ch.filter(x => x.direction === "in").length, { fmt: String });
  check(code, "Alınan çek/senet toplamı", n(EXP.cheques.in_total), inT);
  check(code, "Verilen çek/senet adedi", EXP.cheques.out_count, ch.filter(x => x.direction === "out").length, { fmt: String });
  check(code, "Verilen çek/senet toplamı", n(EXP.cheques.out_total), outT);

  section = "Taksit";
  const pl = s.plans.plans || [];
  check(code, "Taksit kartı adedi", EXP.plans.count, pl.length, { fmt: String });
  check(code, "Taksit kartları toplamı", n(EXP.plans.total), pl.reduce((t, p) => t + (p.totals?.total ?? p.total), 0));
  check(code, "Taksit tahsilatı (ödenen)", n(EXP.plans.paid), pl.reduce((t, p) => t + (p.totals?.paid ?? 0), 0));
  check(code, "Taksit kalan", n(EXP.plans.remaining), pl.reduce((t, p) => t + (p.totals?.remaining ?? 0), 0));

  section = "Satış ve alış";
  const fs1 = s.reports["fatura-satis"];
  const fa = s.reports["fatura-alis"];
  check(code, "Satış faturaları matrahı", n(EXP.money.sale_net), summaryOf(fs1, /^Matrah/));
  check(code, "Satış faturaları KDV", n(EXP.money.sale_vat), summaryOf(fs1, /^KDV/));
  check(code, "Satış faturaları ödenecek (genel toplam)", n(EXP.money.sale_payable), summaryOf(fs1, /^Ödenecek/));
  check(code, "Alış + gider faturaları matrahı", n(EXP.money.purchase_net) + n(EXP.money.expense_net), summaryOf(fa, /^Matrah/));
  check(code, "Alış + gider faturaları ödenecek", n(EXP.money.purchase_payable) + n(EXP.money.expense_gross), summaryOf(fa, /^Ödenecek/));
  check(code, "Gider raporu (KDV hariç gider)", n(EXP.money.expense_net), summaryOf(s.reports["gider-raporu"], /Toplam Gider/));
  check(code, "Hesap mizanı borç = alacak (fark)", 0, summaryOf(s.reports["hesap-mizani"], /^Fark/));
  check(code, "Ana Defter mutabakatı", "Tutarlı", (s.reports["defter-mutabakati"]?.summary || []).find(([k]) => k === "Sonuç")?.[1] || "");
  console.log(`  [${code}] fatura-satis özet: ${JSON.stringify(fs1?.summary)}`);
  console.log(`  [${code}] fatura-alis özet: ${JSON.stringify(fa?.summary)}`);
  console.log(`  [${code}] defter-mutabakati özet: ${JSON.stringify(s.reports["defter-mutabakati"]?.summary)}`);
  console.log(`  [${code}] hesap-mizani özet: ${JSON.stringify(s.reports["hesap-mizani"]?.summary)}`);
  console.log(`  [${code}] banka-pos özet: ${JSON.stringify(s.reports["banka-pos-hareketleri"]?.summary)}`);
  console.log(`  [${code}] gider özet: ${JSON.stringify(s.reports["gider-raporu"]?.summary)}`);
}

fs.writeFileSync(path.join(OUT, `denetim-sonucu${DATE_TO ? `-${DATE_TO}` : ""}.json`), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.ok);
console.log(`\nDenetim: ${rows.length - bad.length}/${rows.length} tuttu; ${bad.length} fark.`);
await app.close();
