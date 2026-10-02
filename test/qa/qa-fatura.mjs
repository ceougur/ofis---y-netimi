// Fatura modülü QA denetimi (API) — ISTQB/ISO 25010 düzeni: her test adım, beklenen, gerçek, durum, önem.
// Gerçek sunucu, Konya verisi. Sonuç: qa/sonuc-api.json
import fs from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADMIN_PASSWORD, createClient, createUser, startTestServer } from "../../test/helpers.mjs";
import { modelInvoice } from "../../test/mutabakat/fatura-model.mjs";
import { WITHHOLDING, computeInvoice } from "../../server/lib/invoice-math.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts");
fs.mkdirSync(OUT, { recursive: true });
const R = [];
const pad = v => String(v).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));
const TODAY = iso(new Date());
const YEAR = TODAY.slice(0, 4);
const vkn = nine => {
  const d = String(nine).padStart(9, "0").split("").map(Number);
  let sum = 0;
  d.forEach((digit, i) => {
    const t = (digit + (9 - i)) % 10;
    let v = (t * 2 ** (9 - i)) % 9;
    if (t !== 0 && v === 0) v = 9;
    sum += v;
  });
  return `${d.join("")}${(10 - (sum % 10)) % 10}`;
};
const c = v => Math.round(Number(v) * 100);
// Test kaydı. fn → { ok, actual, status?, severity?, bug? }. status: PASS | FAIL | PARTIAL | BLOCKED | N/A (özellik yok)
async function T(id, section, name, steps, expected, fn, { severity = "Medium" } = {}) {
  let out;
  try {
    out = await fn();
  } catch (error) {
    out = { ok: false, actual: `HATA: ${error.message}`, severity: "High", bug: error.stack?.split("\n").slice(0, 2).join(" ") };
  }
  const status = out.status || (out.ok ? "PASS" : "FAIL");
  const row = { id, section, name, steps, expected, actual: out.actual || "", status, severity: status === "PASS" ? "" : out.severity || severity, bug: out.bug || "" };
  R.push(row);
  console.log(`${status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "◐"} ${id} ${name} — ${status}${row.severity ? ` (${row.severity})` : ""}${out.actual ? ` · ${String(out.actual).slice(0, 160)}` : ""}`);
  return out;
}
const server = await startTestServer();
const admin = await createClient(server.base);
await admin.login("admin", ADMIN_PASSWORD);
const api = async (client, method, url, body) => {
  const r = await client[method === "delete" ? "del" : method](url, body);
  return { status: r.status, data: r.data?.data, error: r.data?.error, code: r.data?.code, raw: r.data };
};
const A = (m, u, b) => api(admin, m, u, b);
const inv = async body => A("post", "/api/workspace/invoices", body);
const detail = id => A("get", `/api/workspace/invoices/${id}`).then(r => r.data);
const account = id => A("get", `/api/workspace/accounts/${id}`).then(r => r.data);
const stock = id => A("get", `/api/workspace/stock/${id}`).then(r => r.data);
const cash = () => A("get", "/api/workspace/cash").then(r => r.data);
const report = (id, q = "") => A("get", `/api/workspace/report-center/${id}${q ? `?${q}` : ""}`);
const sumOf = (rep, label) => Number(String(rep.summary?.find(([k]) => k === label)?.[1] || "0").replace(/[^\d,-]/g, "").replace(",", "."));
const integrity = () => A("get", "/api/workspace/ledger/integrity").then(r => r.data);
const store = server.app.store;

// ===================== KURULUM: Konya verisi =====================
const ids = {};
await A("put", "/api/workspace/invoices/settings", { seller: { name: "Av. Mehmet Demir Hukuk Bürosu", taxNo: vkn(123456789), taxOffice: "Selçuklu", address: "Nalçacı Cd. No: 12/3", district: "Selçuklu", city: "Konya", phone: "0332 233 44 55", iban: "TR330006100519786457841326" }, defaults: { vatRate: 20, dueDays: 30 } });
const mk = async (url, body) => (await A("post", url, body)).data?.id;
ids.supplier = await mk("/api/workspace/accounts", { name: "Selçuklu Yapı Market Ltd. Şti.", type: "supplier", taxNo: vkn(612345678), taxOffice: "Selçuklu", address: "Sanayi Cd. 45", city: "Konya", phone: "0332 345 67 89" });
ids.supplier2 = await mk("/api/workspace/accounts", { name: "Meram Ofis Kırtasiye", type: "supplier", taxNo: vkn(555123456), taxOffice: "Meram", city: "Konya" });
ids.ayse = await mk("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", taxNo: "10000000146", address: "Yazır Mh. 1234 Sk. No: 7", district: "Selçuklu", city: "Konya", phone: "0532 601 10 10", dueDays: 15 });
// Dosya bağı (caseKey) yalnız açık veri oturumunda VAR OLAN kayda kurulabilir (program kuralı): arayüz denetiminde Excel ile.
ids.teknik = await mk("/api/workspace/accounts", { name: "Konya Teknik Mühendislik A.Ş.", type: "customer", taxNo: vkn(987654321), taxOffice: "Meram", address: "Büsan OSB 3. Sk. No: 9", district: "Karatay", city: "Konya", eInvoice: 1 });
ids.hasan1 = await mk("/api/workspace/accounts", { name: "Hasan Öztürk", type: "customer", phone: "0533 100 00 01", city: "Konya" });
ids.hasan2 = (await A("post", "/api/workspace/accounts", { name: "Hasan Öztürk", type: "customer", phone: "0533 100 00 02", city: "Konya", allowDuplicate: true, force: true })).data?.id;
ids.kagit = await mk("/api/workspace/stock", { name: "A4 Fotokopi Kağıdı", code: "KRT-A4", unit: "Paket", unitPrice: 0, salePrice: 185, minQty: 20 });
ids.toner = await mk("/api/workspace/stock", { name: "HP 85A Toner", code: "TNR-85A", unit: "Adet", unitPrice: 0, salePrice: 1450, minQty: 2 });
ids.klasor = await mk("/api/workspace/stock", { name: "Dosya Klasörü", code: "KLS-01", unit: "Adet", unitPrice: 0, salePrice: 45, minQty: 0 });
ids.danis = await mk("/api/workspace/stock", { kind: "service", name: "Hukuki Danışmanlık (Saat)", code: "HZM-DAN", unit: "Saat", unitPrice: 0, salePrice: 2500 });
// Açılış bakiyesi: nakit 10.000, banka 50.000 (eksi bakiye denetimi "Uyar" — açılış olmadan havale 409 verir, doğru davranış).
await A("post", "/api/workspace/cash", { kind: "in", amount: "10000", method: "cash", description: "Açılış — kasa devri", date: shift(-40) });
await A("post", "/api/workspace/cash", { kind: "in", amount: "50000", method: "bank", description: "Açılış — banka devri", date: shift(-40) });
function pdfText(buffer) {
  const text = buffer.toString("latin1");
  const objects = new Map([...text.matchAll(/(\d+) 0 obj\n?([\s\S]*?)\nendobj/g)].map(match => [Number(match[1]), match[2]]));
  const stream = body => {
    const match = /stream\n([\s\S]*?)\nendstream/.exec(body || "");
    if (!match) return "";
    try {
      return /FlateDecode/.test(body) ? inflateSync(Buffer.from(match[1], "latin1")).toString("latin1") : match[1];
    } catch {
      return "";
    }
  };
  const fonts = new Map();
  for (const body of objects.values()) {
    for (const [, name, id] of (/\/Font << ([^>]*) >>/.exec(body)?.[1] || "").matchAll(/\/(\w+) (\d+) 0 R/g)) {
      if (fonts.has(name)) continue;
      const cmap = new Map();
      const unicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(id)) || "");
      for (const [, gid, hex] of stream(objects.get(Number(unicode?.[1]))).matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) cmap.set(gid, String.fromCodePoint(...hex.match(/.{4}/g).map(part => parseInt(part, 16))));
      fonts.set(name, cmap);
    }
  }
  const out = [];
  for (const body of objects.values()) {
    if (!/\/Length/.test(body) || /ToUnicode|FontFile|beginbfchar/.test(body)) continue;
    for (const [, font, glyphs] of stream(body).matchAll(/\/(\w+) [\d.]+ Tf [^<]*<([0-9A-F]*)> Tj/g)) out.push((glyphs.match(/.{4}/g) || []).map(gid => fonts.get(font)?.get(gid) ?? "?").join(""));
  }
  return out.join("\n");
}
console.log("Kurulum:", JSON.stringify(ids));

// ===================== 1. FONKSİYONEL =====================
// Alış: stok dolar (100 paket × 120, 5 toner × 1.100, 40 klasör × 28; %20 KDV), tedarikçi cari alacaklı.
const alis = await inv({ scenario: "goods_purchase", accountId: ids.supplier, number: "SYM2026000000017", issueDate: shift(-20), despatchNo: "İRS-4471", despatchDate: shift(-20), orderNo: "SİP-2026-88", lines: [{ itemId: ids.kagit, qty: 100, unitPrice: 120, vatRate: 20 }, { itemId: ids.toner, qty: 5, unitPrice: 1100, vatRate: 20 }, { itemId: ids.klasor, qty: 40, unitPrice: 28, vatRate: 20 }], payment: { cash: [{ amount: 5000, method: "bank" }], rest: "open", dueDate: shift(-10) } });
await T("F2.2", "1 Fonksiyonel", "Alış faturası oluşturma (stoğa mal, kısmi banka ödemesi, vade)", "Tedarikçiden 3 kalem alış; 5.000 TL havale, kalanı 10 gün vadeli", "200; ödenecek 22.344,00; stok 100/5/40; tedarikçi −17.344,00", async () => {
  const sup = await account(ids.supplier);
  const k = await stock(ids.kagit);
  return { ok: alis.status === 200 && c(alis.data.tryPayable) === 2234400 && c(sup.totals.balance) === -1734400 && Number(k.qty) === 100 && c(k.unitPrice) === 12000, actual: `${alis.status} ödenecek ${alis.data?.tryPayable} tedarikçi ${sup.totals.balance} kağıt ${k.qty} maliyet ${k.unitPrice}` };
}, { severity: "Critical" });
// Satış: Ayşe Kaya'ya 10 paket kağıt + 2 saat danışmanlık; 1.000 nakit, kalan 3 taksit.
const satis = await inv({ scenario: "goods_sale", accountId: ids.ayse, issueDate: shift(-15), lines: [{ itemId: ids.kagit, qty: 10, unitPrice: 185, vatRate: 20 }, { itemId: ids.danis, qty: 2, unitPrice: 2500, vatRate: 20 }], payment: { cash: [{ amount: 1000, method: "cash" }], rest: "installments", installments: { count: 3, firstDue: shift(15) } }, note: "Konya 6. İcra 2026/1234 dosyası kapsamında" });
await T("F2.1", "1 Fonksiyonel", "Satış faturası oluşturma (stoklu + hizmet, peşin + taksit)", "Ayşe Kaya'ya 10 paket kağıt (185) + 2 saat danışmanlık (2.500); 1.000 nakit, kalan 3 taksit", "200; ödenecek 8.220,00; taksit kartı 7.220 / 3; stok 90; Kasa nakit +1.000 (açılış 10.000 → 11.000)", async () => {
  const a = await account(ids.ayse);
  const k = await stock(ids.kagit);
  const cs = await cash();
  return { ok: satis.status === 200 && c(satis.data.tryPayable) === 822000 && a.plans.length === 1 && c(a.plans[0].totals.total) === 722000 && Number(k.qty) === 90 && c(cs.byMethod.cash) === 1100000, actual: `${satis.status} ödenecek ${satis.data?.tryPayable} kart ${a.plans[0]?.totals.total} stok ${k.qty} nakit ${cs.byMethod.cash}` };
}, { severity: "Critical" });

await T("F3.1", "1 Fonksiyonel", "Fatura tipleri: satış, alış, satıştan iade, alıştan iade, SMM", "Her türden belge kes", "Beş tür de kesilir; iade asıl faturaya bağlı; SMM stopaj %20", async () => {
  const sret = await inv({ kind: "sale_return", originalId: satis.data.id, issueDate: shift(-10), lines: [{ originLineId: satis.data.lines[0].id, qty: 2 }], payment: {} });
  const pret = await inv({ kind: "purchase_return", originalId: alis.data.id, issueDate: shift(-10), lines: [{ originLineId: alis.data.lines[2].id, qty: 5 }], payment: {} });
  const smm = await inv({ kind: "smm", accountId: ids.teknik, issueDate: shift(-9), stoppageRate: 20, lines: [{ name: "Vekâlet Ücreti — Konya 6. İcra 2026/1234", qty: 1, unitPrice: 10000, vatRate: 20 }], payment: { rest: "open" } });
  ids.sret = sret.data?.id;
  ids.pret = pret.data?.id;
  ids.smm = smm.data?.id;
  const ok = sret.status === 200 && pret.status === 200 && smm.status === 200 && sret.data.originalId === satis.data.id && c(smm.data.stoppageTotal) === 200000 && c(smm.data.tryPayable) === 1000000;
  return { ok, actual: `iade ${sret.status} ${sret.data?.tryPayable} · alıştan iade ${pret.status} ${pret.data?.tryPayable} · SMM ${smm.status} stopaj ${smm.data?.stoppageTotal} ödenecek ${smm.data?.tryPayable} (${smm.error || ""}${sret.error || ""}${pret.error || ""})` };
}, { severity: "Critical" });
await T("F3.2", "1 Fonksiyonel", "Proforma", "Taslak kaydet; PDF'ini al", "Taslak numarasız; PDF başlığı PROFORMA; deftere dokunmaz", async () => {
  const before = await account(ids.hasan1);
  const d = await inv({ scenario: "service_sale", accountId: ids.hasan1, status: "draft", lines: [{ name: "Sözleşme İncelemesi", qty: 1, unitPrice: 3000, vatRate: 20 }], payment: { rest: "open" } });
  const pdf = await admin.raw("GET", `/api/workspace/invoices/${d.data.id}/fatura.pdf`);
  const after = await account(ids.hasan1);
  ids.draft = d.data.id;
  return { ok: d.status === 200 && d.data.status === "draft" && !d.data.number && pdf.status === 200 && pdf.buffer.subarray(0, 4).toString() === "%PDF" && pdfText(pdf.buffer).includes("PROFORMA") && before.totals.balance === after.totals.balance, actual: `taslak ${d.status} no="${d.data?.number}" pdf ${pdf.status} PROFORMA=${pdfText(pdf.buffer).includes("PROFORMA")} bakiye ${before.totals.balance}→${after.totals.balance}` };
});
await T("F3.3", "1 Fonksiyonel", "İrsaliyeli fatura", "Alışta irsaliye no/tarih, sipariş no yazıldı", "Alanlar kayıtta ve kartta", async () => {
  const d = await detail(alis.data.id);
  return { ok: d.despatchNo === "İRS-4471" && d.despatchDate === shift(-20) && d.orderNo === "SİP-2026-88", actual: `irsaliye ${d.despatchNo} ${d.despatchDate} sipariş ${d.orderNo}` };
});
await T("F3.4", "1 Fonksiyonel", "Tevkifatlı fatura (9/10, kod 602)", "Mühendislik firmasına danışmanlık 10.000 + %20 KDV, tevkifat 9/10", "KDV 2.000; tevkifat 1.800; ödenecek 10.200; tür TEVKIFAT", async () => {
  const r = await inv({ scenario: "service_sale", accountId: ids.teknik, issueDate: shift(-8), lines: [{ name: "Hukuki Danışmanlık (Proje)", qty: 1, unitPrice: 10000, vatRate: 20, withholdingCode: "602" }], payment: { rest: "open", dueDate: shift(22) } });
  ids.tevkifat = r.data?.id;
  return { ok: r.status === 200 && c(r.data.vatTotal) === 200000 && c(r.data.withheldTotal) === 180000 && c(r.data.tryPayable) === 1020000 && r.data.typeCode === "TEVKIFAT", actual: `${r.status} KDV ${r.data?.vatTotal} tevkifat ${r.data?.withheldTotal} ödenecek ${r.data?.tryPayable} tür ${r.data?.typeCode}` };
}, { severity: "High" });
await T("F3.5", "1 Fonksiyonel", "İstisnalı fatura (%0 KDV, istisna kodu 301)", "Hizmet ihracatı kalemi %0 + 302", "KDV 0; tür ISTISNA", async () => {
  const r = await inv({ scenario: "service_sale", accountId: ids.teknik, issueDate: shift(-8), lines: [{ name: "Yurt Dışı Danışmanlık", qty: 1, unitPrice: 5000, vatRate: 0, exemptionCode: "302" }], payment: { rest: "open" } });
  ids.istisna = r.data?.id;
  return { ok: r.status === 200 && c(r.data.vatTotal) === 0 && r.data.typeCode === "ISTISNA", actual: `${r.status} KDV ${r.data?.vatTotal} tür ${r.data?.typeCode}` };
});
await T("F3.6", "1 Fonksiyonel", "Fiyat farkı faturası", "Tür listesinde ara", "Ayrı belge türü olarak", async () => ({ ok: false, status: "N/A", severity: "Low", actual: "Ayrı 'Fiyat Farkı' türü yok; fiyat farkı hizmet kalemiyle (stoksuz satır) kesilebilir, GİB'de fatura tipi SATIS olarak gider" }));
await T("F3.7", "1 Fonksiyonel", "e-İrsaliye", "Modülde ara", "e-İrsaliye belgesi", async () => ({ ok: false, status: "N/A", severity: "Medium", actual: "Yok; faturada irsaliye no/tarihi alanı var (irsaliyeli fatura). e-İrsaliye sonraki sürüm önerisi (docs/FATURA-KARSILASTIRMA.md)" }));
await T("F4", "1 Fonksiyonel", "Cari seçimi: kartından çekme ve yeni cari", "Formda cari ara; formdan yeni cari aç", "Arama + seçim; formdan yeni cari açılabilir", async () => {
  const q = await A("get", "/api/workspace/accounts?q=Ay%C5%9Fe&limit=5");
  const hit = JSON.stringify(q.data || {}).includes(ids.ayse);
  return { ok: false, status: "PARTIAL", severity: "Low", actual: `Arama/seçim çalışıyor (${hit ? "Ayşe Kaya bulundu" : "bulunamadı"}); formun içinden yeni cari açma yok — 'Yoksa Cari ekranından açın' yazısı var (fatura formunu kapatmadan Cari penceresi açılabilir)` };
});
await T("F5", "1 Fonksiyonel", "Stoklu / stoksuz kalem aynı faturada", "Satışta stok kalemi + serbest hizmet satırı", "Stok kalemi stok hareketi üretir, hizmet üretmez", async () => {
  const d = await detail(satis.data.id);
  return { ok: d.lines[0].goods === true && Boolean(d.lines[0].moveId) && d.lines[1].goods === false && !d.lines[1].moveId, actual: `kağıt goods=${d.lines[0].goods} move=${Boolean(d.lines[0].moveId)}; danışmanlık goods=${d.lines[1].goods} move=${Boolean(d.lines[1].moveId)}` };
});
await T("F6.1", "1 Fonksiyonel", "KDV oranları 0/1/10/20 ve özel oran", "Her oranla kalem; %18 ile dene", "0/1/10/20 kabul; 18 reddedilir (GİB listesi dışı)", async () => {
  const r = await A("post", "/api/workspace/invoices/calc", { kind: "sale", accountId: ids.hasan1, lines: [0, 1, 10, 20].map(v => ({ name: `Kalem %${v}`, qty: 1, unitPrice: 100, vatRate: v })) });
  const bad = await A("post", "/api/workspace/invoices/calc", { kind: "sale", accountId: ids.hasan1, lines: [{ name: "X", qty: 1, unitPrice: 100, vatRate: 18 }] });
  return { ok: r.status === 200 && c(r.data.totals.vat) === 3100 && bad.status === 400, actual: `dört oran KDV toplamı ${r.data?.totals?.vat} (beklenen 31,00); %18 → ${bad.status} "${bad.error}"` };
});
await T("F6.2", "1 Fonksiyonel", "Satır iskontosu + genel iskonto + tevkifat birlikte", "2 kalem: 1.000 (%10 satır isk., KDV 20, tevkifat 5/10), 500 (KDV 10); genel iskonto %5", "Matrah 1.330,00; KDV 218,50 (171,00+47,50); tevkifat 85,50; ödenecek 1.463,00", async () => {
  const r = await A("post", "/api/workspace/invoices/calc", { kind: "sale", accountId: ids.teknik, discountRate: 5, lines: [{ name: "A", qty: 1, unitPrice: 1000, discountRate: 10, vatRate: 20, withholdingCode: "604" }, { name: "B", qty: 1, unitPrice: 500, vatRate: 10 }] });
  const t = r.data?.totals || {};
  return { ok: r.status === 200 && c(t.net) === 133000 && c(t.vat) === 21850 && c(t.withheld) === 8550 && c(t.payable) === 146300, actual: `matrah ${t.net} KDV ${t.vat} tevkifat ${t.withheld} ödenecek ${t.payable}` };
}, { severity: "High" });
await T("F7", "1 Fonksiyonel", "Otomatik hesaplama = bağımsız model (5.000 rastgele kombinasyon)", "Programın hesabı ile ayrı yazılmış BigInt modeli karşılaştır", "Kuruşu kuruşuna aynı", async () => {
  let bad = 0, n = 0;
  let seed = 4242;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = l => l[Math.floor(rnd() * l.length)];
  for (let i = 0; i < 5000; i++) {
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => { const vat = pick([0, 1, 10, 20]); const code = vat && rnd() < 0.3 ? pick(["612", "624", "616", "603"]) : ""; return { qty: 1 + Math.floor(rnd() * 90000), price4: Math.floor(rnd() * 90_000_000), disc: pick([0, 0, 3, 5, 12]), vat, whCode: code, wh: code ? [WITHHOLDING[code].num, WITHHOLDING[code].den] : null, account: "600" }; });
    const o = { incl: rnd() < 0.4, disc: rnd() < 0.3 ? 1 + Math.floor(rnd() * 30) : 0, stop: rnd() < 0.2 ? pick([10, 20]) : 0, rate6: 1_000_000 };
    let p;
    try { p = computeInvoice(lines.map(l => ({ qty: l.qty / 1000, unitPrice: l.price4 / 10000, discountRate: l.disc, vatRate: l.vat, withholdingCode: l.whCode })), { pricesIncludeVat: o.incl, discountRate: o.disc, stoppageRate: o.stop }); } catch { continue; }
    const m = modelInvoice(lines, o);
    n++;
    if (p.totals.payable !== m.payable || p.totals.vat !== m.vat) bad++;
  }
  return { ok: bad === 0 && n > 4000, actual: `${n} fatura karşılaştırıldı, sapma ${bad}` };
}, { severity: "Critical" });
await T("F8.1", "1 Fonksiyonel", "Numara: seri + sıra, otomatik artırım", "Kesilen satış belgelerinin numaraları", "FIS2026 serisinde 1'den boşluksuz; SMM ayrı seri", async () => {
  const list = (await A("get", "/api/workspace/invoices?tab=all&limit=500")).data.invoices.filter(x => x.status !== "draft" && x.number);
  const fis = list.filter(x => x.number.startsWith("FIS")).map(x => Number(x.number.slice(-9))).sort((a, b) => a - b);
  const smm = list.filter(x => x.number.startsWith("SMM")).length;
  return { ok: fis.every((n, i) => n === i + 1) && smm === 1, actual: `FIS: ${fis.join(",")} · SMM: ${smm}` };
}, { severity: "High" });
await T("F8.2", "1 Fonksiyonel", "Numara: elle değiştirme (manuel override)", "Kendi serimizde numarayı elle vermeyi dene", "Kendi belgemizde numara programdan; alış/karşı tarafın belgesinde elle", async () => {
  const r = await inv({ scenario: "service_sale", accountId: ids.hasan1, number: "ELLE-1", lines: [{ name: "Deneme", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const own = r.data?.number;
  if (r.status === 200) await A("post", `/api/workspace/invoices/${r.data.id}/cancel`, { reason: "QA" });
  return { ok: false, status: "PARTIAL", severity: "Low", actual: `Kendi serimizde elle numara yok (gönderilen "ELLE-1" yok sayıldı, ${own} verildi — VUK sıra kuralı için bilinçli); alış ve müşterinin kestiği iade faturasında numara elle girilir` };
});
await T("F8.3", "1 Fonksiyonel", "Numara: mükerrer kontrol (tedarikçi faturası)", "Aynı tedarikçiye aynı numarayla ikinci alış", "409 invoice-duplicate; başka tedarikçide aynı numara serbest", async () => {
  const dup = await inv({ scenario: "expense_purchase", accountId: ids.supplier, number: "SYM2026000000017", lines: [{ name: "Kargo", qty: 1, unitPrice: 100, vatRate: 20, expenseCode: "freight" }], payment: { rest: "open" } });
  const other = await inv({ scenario: "expense_purchase", accountId: ids.supplier2, number: "SYM2026000000017", issueDate: shift(-5), lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 300, vatRate: 20, expenseCode: "office" }], payment: { cash: [{ amount: 360, method: "cash" }] } });
  ids.gider = other.data?.id;
  return { ok: dup.status === 409 && dup.code === "invoice-duplicate" && other.status === 200, actual: `aynı tedarikçi → ${dup.status} ${dup.code}; başka tedarikçi → ${other.status}` };
}, { severity: "High" });
await T("F8.4", "1 Fonksiyonel", "Numara ve tarih sırası (kronoloji) + iptalde numara korunur", "Serinin son belgesinden eski tarihli belge kes; bir belgeyi iptal et", "Eski tarihli → 400 chronology; iptal edilen numara listede kalır, yeniden verilmez", async () => {
  const old = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: shift(-30), lines: [{ name: "Eski", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const t = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: TODAY, lines: [{ name: "İptal edilecek", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const canc = await A("post", `/api/workspace/invoices/${t.data.id}/cancel`, { reason: "QA" });
  const next = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: TODAY, lines: [{ name: "Sonraki", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const seq = x => Number(String(x).slice(-9));
  return { ok: old.status === 400 && old.code === "chronology" && canc.data?.number === t.data.number && canc.data.status === "cancelled" && seq(next.data.number) === seq(t.data.number) + 1, actual: `eski tarih → ${old.status} ${old.code}; iptal edilen ${canc.data?.number} (${canc.data?.status}); sonraki ${next.data?.number}` };
}, { severity: "High" });
await T("F9", "1 Fonksiyonel", "Tarih alanları: fatura, vade, sevk, sipariş; geçersiz biçimler", "Geçerli alanlar kaydedilir; '31.12.2026', '2026-02-30', ileri tarih, vade<fatura reddedilir", "Hepsi 400 ile açıklayıcı Türkçe mesaj", async () => {
  const base = { scenario: "service_sale", accountId: ids.hasan1, lines: [{ name: "X", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } };
  const a = await inv({ ...base, issueDate: "31.12.2026" });
  const b = await inv({ ...base, issueDate: "2026-02-30" });
  const d = await inv({ ...base, issueDate: shift(3) });
  const e = await inv({ ...base, payment: { rest: "open", dueDate: shift(-2) } });
  const f = await inv({ ...base, despatchDate: "abc" });
  const all = [a, b, d, e, f];
  return { ok: all.every(x => x.status === 400) && all.every(x => /[çğışöüÇĞİŞÖÜ]|tarih|Vade/.test(x.error || "")), actual: all.map(x => `${x.status}:${(x.error || "").slice(0, 40)}`).join(" | ") };
});
await T("F10", "1 Fonksiyonel", "Ödeme planı / taksit entegrasyonu", "Satıştaki 3 taksit; 1. taksit tahsil et; kalanını tahsil et", "Kart 3 taksit; tahsilatta fatura 'Taksitte/Kısmen'; tamamında 'Ödendi'", async () => {
  const a = await account(ids.ayse);
  const plan = a.plans[0];
  const pd = (await A("get", `/api/workspace/plans/${plan.id}`)).data;
  const first = await A("post", `/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: pd.items[0].amount, method: "bank", date: TODAY });
  const d1 = await detail(satis.data.id);
  const rest = (await A("get", `/api/workspace/plans/${plan.id}`)).data.totals.remaining;
  const second = await A("post", `/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: rest, method: "cash", date: TODAY });
  const d2 = await detail(satis.data.id);
  ids.plan = plan.id;
  return { ok: pd.items.length === 3 && first.status === 200 && second.status === 200 && d2.payState === "paid" && c(d2.open) === 0 && ["partial", "installment"].includes(d1.payState), actual: `taksit ${pd.items.length}; 1. tahsilat → ${d1.payStateLabel} (açık ${d1.open}); tamamı → ${d2.payStateLabel} (açık ${d2.open})` };
}, { severity: "Critical" });
await T("F11", "1 Fonksiyonel", "Ödeme durumu ve Kasa/Banka bağlantısı", "Hizmet satışı tamamı kredi kartıyla; alış tamamı havale", "Satış 'Ödendi', Kart +; alış 'Ödendi', Banka −; Kasa satırı kaynağı 'invoice'", async () => {
  const before = await cash();
  const s = await inv({ scenario: "service_sale", accountId: ids.hasan2, issueDate: TODAY, lines: [{ name: "İhtarname Hazırlama", qty: 1, unitPrice: 1500, vatRate: 20 }], payment: { cash: [{ amount: 1800, method: "card" }] } });
  const p = await inv({ scenario: "expense_purchase", accountId: ids.supplier2, number: "MOK-2026-9", issueDate: shift(-3), lines: [{ name: "Kartuş", qty: 2, unitPrice: 400, vatRate: 20, expenseCode: "office" }], payment: { cash: [{ amount: 960, method: "bank" }] } });
  const after = await cash();
  const rows = after.entries.filter(e => e.source === "invoice" && (e.invoiceId === s.data?.id || e.invoiceId === p.data?.id));
  return { ok: s.data?.payState === "paid" && p.data?.payState === "paid" && c(after.byMethod.card - before.byMethod.card) === 180000 && c(before.byMethod.bank - after.byMethod.bank) === 96000 && rows.length === 2, actual: `satış ${s.data?.payStateLabel} kart +${(after.byMethod.card - before.byMethod.card).toFixed(2)}; alış ${p.data?.payStateLabel} banka ${(after.byMethod.bank - before.byMethod.bank).toFixed(2)}; Kasa satırı ${rows.length}` };
}, { severity: "Critical" });
await T("F12", "1 Fonksiyonel", "Not, açıklama, özel alanlar", "Faturada not ve kalem açıklaması; özel alan", "Not ve açıklama kartta/PDF'te; özel alan tanımlama", async () => {
  const d = await detail(satis.data.id);
  return { ok: false, status: "PARTIAL", severity: "Low", actual: `Not kayıtlı ("${d.note.slice(0, 40)}") ve PDF altına basılıyor; kalem açıklaması var; faturaya özel (kullanıcı tanımlı) alan yok (cari ve stok kartında var)` };
});
await T("F13", "1 Fonksiyonel", "Yaşam döngüsü: Taslak → Düzenle → Kes → İptal; kesilmiş belge düzeltilemez", "Taslağı düzenle (PUT), kes, iptal et; kesilmişe PUT; iptal edilmişi iptal", "PUT taslak 200; kes 200; kesilmişe PUT 409; iptal 200; ikinci iptal 409", async () => {
  const e = await A("put", `/api/workspace/invoices/${ids.draft}`, { scenario: "service_sale", accountId: ids.hasan1, lines: [{ name: "Sözleşme İncelemesi (güncel)", qty: 2, unitPrice: 3000, vatRate: 20 }], payment: { rest: "open" } });
  const k = await A("post", `/api/workspace/invoices/${ids.draft}/issue`, { issueDate: TODAY });
  const editIssued = await A("put", `/api/workspace/invoices/${ids.draft}`, { scenario: "service_sale", accountId: ids.hasan1, lines: [{ name: "X", qty: 1, unitPrice: 1, vatRate: 20 }] });
  const canc = await A("post", `/api/workspace/invoices/${ids.draft}/cancel`, { reason: "QA yaşam döngüsü" });
  const again = await A("post", `/api/workspace/invoices/${ids.draft}/cancel`, { reason: "ikinci" });
  const del = await A("delete", `/api/workspace/invoices/${ids.draft}`);
  return { ok: e.status === 200 && k.status === 200 && c(k.data.tryPayable) === 720000 && editIssued.status === 409 && canc.status === 200 && again.status === 409 && del.status === 409, actual: `düzenle ${e.status}; kes ${k.status} ${k.data?.tryPayable}; kesilmişe PUT ${editIssued.status}; iptal ${canc.status}; ikinci iptal ${again.status}; kesilmişi sil ${del.status}` };
}, { severity: "High" });
await T("F14", "1 Fonksiyonel", "Yazdırma / PDF: şablon, antet, logo, e-imza alanı", "Satış PDF'i; antet (firma bilgisi) ve logo", "PDF üretilir; antet var; logo ve e-imza alanı?", async () => {
  const pdf = await admin.raw("GET", `/api/workspace/invoices/${satis.data.id}/fatura.pdf`);
  const text = pdfText(pdf.buffer);
  const antet = text.includes("Av. Mehmet Demir Hukuk Bürosu") && text.includes("Nalçacı");
  return { ok: false, status: antet ? "PARTIAL" : "FAIL", severity: antet ? "Low" : "High", actual: `PDF ${pdf.status} ${pdf.buffer.length} bayt; antette firma adı ve adres var=${antet}; not basılı=${text.includes("Konya 6. İcra")}; tek şablon (A4); logo yok; e-imza/kaşe alanı yok; ibare: ${text.includes("Müşteri Fişi") ? "Müşteri Fişi" : "?"}` };
});
await T("F15", "1 Fonksiyonel", "e-Fatura / e-Arşiv / e-İrsaliye", "e-Belge kapalı programda gönder/UBL; açık programda sahte EDM ile tam döngü (ayrı test takımı)", "Kapalıyken 404; açıkken gönder/durum/iptal/gelen kutusu çalışır", async () => {
  const send = await A("post", `/api/workspace/invoices/${satis.data.id}/send`, {});
  const ubl = await admin.raw("GET", `/api/workspace/invoices/${satis.data.id}/ubl.xml`);
  return { ok: send.status === 404 && ubl.status === 404, status: send.status === 404 && ubl.status === 404 ? "PARTIAL" : "FAIL", severity: "Medium", actual: `Bu kurulumda e-Belge kapalı (kullanıcı kararı): gönder ${send.status}, UBL ${ubl.status}. Açık kurulum: test/einvoice-edm.test.mjs 22/22 (sahte EDM sunucusu: e-Fatura gönder/durum/ret, e-Arşiv gönder/iptal, sonra gönder, gelen kutusu). Gerçek GİB/EDM test ortamına bağlantı yapılmadı (hesap yok); e-İrsaliye yok` };
});
await T("F16", "1 Fonksiyonel", "Toplu işlemler", "Çoklu seçim PDF/Excel; toplu onay; toplu iptal", "Seçilenleri PDF/Excel/XML; toplu onay/iptal?", async () => {
  const idsAll = (await A("get", "/api/workspace/invoices?tab=sale")).data.invoices.map(x => x.id).slice(0, 3);
  const pdf = await admin.raw("GET", `/api/workspace/invoices/toplu.pdf?ids=${idsAll.join(",")}`);
  const xlsx = await admin.raw("GET", `/api/workspace/invoices/export.xlsx?ids=${idsAll.join(",")}`);
  const ok = pdf.status === 200 && pdf.buffer.subarray(0, 4).toString() === "%PDF" && xlsx.status === 200 && xlsx.buffer.subarray(0, 2).toString() === "PK";
  return { ok: false, status: ok ? "PARTIAL" : "FAIL", severity: "Low", actual: `Seçilenleri PDF ${pdf.status} / Excel ${xlsx.status} / XML ZIP (e-Belge açıkken) var; Gönderilecekler'de "Tümünü Gönder" var; toplu onay (taslakları topluca kesme) ve toplu iptal YOK — her belge tek tek (iptal nedeni istenir)` };
});
await T("F17", "1 Fonksiyonel", "Yetkilendirme: rol bazlı görüntüleme / oluşturma", "personel, muhasebe, avukat, 'yalnız görüntüleme' yetkili kullanıcı", "personel 403/403; muhasebe 200/200; avukat 200/200; görüntüleme yetkilisi 200/403", async () => {
  const mkUser = async (u, role, grants) => { const r = await admin.post("/api/admin/users", { username: u, name: u, role, password: "Qa-Deneme-2026!", mustChangePassword: false, ...(grants ? { grants } : {}) }); if (r.status !== 200) throw new Error(`kullanıcı ${u}: ${JSON.stringify(r.data)}`); const cl = createClient(server.base); await cl.login(u, "Qa-Deneme-2026!"); return cl; };
  const personel = await mkUser("zeynep", "personel");
  const muhasebe = await mkUser("fatma", "muhasebe");
  const avukat = await mkUser("ali", "avukat");
  const viewer = await mkUser("okur", "personel", { add: ["invoices.view"] });
  const body = { scenario: "service_sale", accountId: ids.hasan1, lines: [{ name: "Yetki", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } };
  const res = {};
  for (const [name, cl] of Object.entries({ personel, muhasebe, avukat, viewer })) {
    const l = await api(cl, "get", "/api/workspace/invoices");
    const cr = await api(cl, "post", "/api/workspace/invoices", { ...body, status: "draft" });
    res[name] = `${l.status}/${cr.status}`;
    if (cr.status === 200) await api(cl, "delete", `/api/workspace/invoices/${cr.data.id}`);
  }
  ids.clients = { personel, muhasebe, avukat, viewer };
  return { ok: res.personel === "403/403" && res.muhasebe === "200/200" && res.avukat === "200/200" && res.viewer === "200/403", actual: Object.entries(res).map(([k, v]) => `${k} ${v}`).join("; ") };
}, { severity: "Critical" });
await T("F1.1", "1 Fonksiyonel", "Liste: filtreler ve arama", "tab, ödeme durumu, tarih aralığı, cari, ürün, metin araması", "Her süzgeç doğru alt kümeyi döner", async () => {
  const all = (await A("get", "/api/workspace/invoices?tab=all&limit=500")).data.invoices;
  const byAcc = (await A("get", `/api/workspace/invoices?tab=all&account=${ids.ayse}`)).data.invoices;
  const byItem = (await A("get", `/api/workspace/invoices?tab=all&item=${ids.kagit}`)).data.invoices;
  const q = (await A("get", "/api/workspace/invoices?tab=all&q=vek%C3%A2let")).data.invoices;
  const paid = (await A("get", "/api/workspace/invoices?tab=all&pay=paid")).data.invoices;
  const range = (await A("get", `/api/workspace/invoices?tab=all&from=${shift(-20)}&to=${shift(-20)}`)).data.invoices;
  const canc = (await A("get", "/api/workspace/invoices?tab=cancelled")).data.invoices;
  const ok = byAcc.every(x => x.accountId === ids.ayse) && byAcc.length >= 2 && byItem.length >= 2 && q.length === 1 && q[0].kind === "smm" && paid.every(x => x.payState === "paid") && paid.length >= 3 && range.length === 1 && range[0].id === alis.data.id && canc.length >= 3;
  return { ok, actual: `toplam ${all.length}; cari ${byAcc.length}; ürün ${byItem.length}; 'vekâlet' ${q.length}; ödendi ${paid.length}; tarih ${range.length}; iptal ${canc.length}` };
});
await T("F1.2", "1 Fonksiyonel", "Liste: sıralama ve dışa aktarma", "sort=amount/party/number; liste PDF; Excel", "Sıralı; PDF ve Excel üretilir", async () => {
  const amt = (await A("get", "/api/workspace/invoices?tab=all&sort=amount")).data.invoices.map(x => x.tryPayable);
  const party = (await A("get", "/api/workspace/invoices?tab=all&sort=party")).data.invoices.map(x => x.accountName);
  const pdf = await admin.raw("GET", "/api/workspace/invoices/liste.pdf?tab=all");
  const xlsx = await admin.raw("GET", "/api/workspace/invoices/export.xlsx?tab=all");
  const sortedAmt = amt.every((v, i) => i === 0 || amt[i - 1] >= v);
  const coll = new Intl.Collator("tr");
  const sortedParty = party.every((v, i) => i === 0 || coll.compare(party[i - 1], v) <= 0);
  return { ok: sortedAmt && sortedParty && pdf.status === 200 && xlsx.status === 200, actual: `tutar sıralı=${sortedAmt} cari sıralı=${sortedParty} PDF ${pdf.status} Excel ${xlsx.status}` };
});
await T("F1.3", "1 Fonksiyonel", "Liste: kolon özelleştirme", "Liste kolonlarını gizle/sırala", "Kolon seçici", async () => ({ ok: false, status: "N/A", severity: "Low", actual: "Fatura listesinde kolon özelleştirme yok (sabit kolonlar: Tarih, No, Cari, Durum, Tutar, Açık); ana tablo kolonları özelleştirilebilir, fatura listesi değil" }));

// ===================== 2. ENTEGRASYON =====================
await T("E1", "2 Entegrasyon", "Fatura → Cari bakiyesi (alacak/borç yönü)", "Ayşe Kaya: 8.220 satış − 1.000 peşin − 444 iade (2 paket + KDV) − 6.776 taksit tahsilatı; tedarikçi: −22.344 + 5.000 + 168 (iade 5 klasör + KDV)", "Ayşe 0,00; tedarikçi −17.176,00", async () => {
  const a = await account(ids.ayse);
  const s = await account(ids.supplier);
  return { ok: c(a.totals.balance) === 0 && c(s.totals.balance) === -1717600, actual: `Ayşe Kaya ${a.totals.balance}; Selçuklu Yapı ${s.totals.balance}` };
}, { severity: "Critical" });
await T("E2", "2 Entegrasyon", "Fatura → Kasa/Banka: doğru hesap, iptalde geri", "Kart ödemeli satışı iptal et; Kasa kart bakiyesi", "İptal sonrası kart −1.800; satır silinir; mutabakat tutarlı", async () => {
  const before = await cash();
  const s = (await A("get", `/api/workspace/invoices?tab=all&account=${ids.hasan2}`)).data.invoices.find(x => x.kind === "sale");
  const canc = await A("post", `/api/workspace/invoices/${s.id}/cancel`, { reason: "QA Kasa geri alma", cashForce: true });
  const after = await cash();
  const i = await integrity();
  return { ok: canc.status === 200 && c(before.byMethod.card - after.byMethod.card) === 180000 && !after.entries.some(e => e.invoiceId === s.id) && i.ok, actual: `iptal ${canc.status}; kart ${before.byMethod.card}→${after.byMethod.card}; satır kaldı=${after.entries.some(e => e.invoiceId === s.id)}; mutabakat ${i.ok}` };
}, { severity: "Critical" });
await T("E3", "2 Entegrasyon", "Fatura → Taksitler: kart faturaya bağlı, silinemez; iade kartı küçültür", "Faturanın kartını Taksitler'den silmeyi dene; iade kartı küçülttü mü", "Silme 409 invoice-linked; kart iadeyle 7.220→6.776 (444 iade)", async () => {
  const del = await A("delete", `/api/workspace/plans/${ids.plan}`);
  const plan = (await A("get", `/api/workspace/plans/${ids.plan}`)).data;
  return { ok: del.status === 409 && c(plan.totals.total) === 677600, actual: `sil ${del.status} ${del.code || del.error?.slice(0, 50)}; kart toplamı ${plan.totals.total} (7.220 − 444 iade)` };
}, { severity: "High" });
await T("E4", "2 Entegrasyon", "Fatura → Stok: miktar, maliyet, kritik stok uyarısı", "Toner 5 alındı (minQty 2); 4 sat → 1 kaldı → uyarı", "Stok 1; uyarı listesinde HP 85A Toner; maliyet 1.100", async () => {
  const s = await inv({ scenario: "goods_sale", accountId: ids.teknik, issueDate: TODAY, lines: [{ itemId: ids.toner, qty: 4, unitPrice: 1450, vatRate: 20 }], payment: { rest: "open", dueDate: shift(5) } });
  ids.tonerSale = s.data?.id;
  const t = await stock(ids.toner);
  const alerts = (await A("get", "/api/workspace/stock/alerts")).data || [];
  return { ok: s.status === 200 && Number(t.qty) === 1 && c(t.unitPrice) === 110000 && alerts.some(a => a.id === ids.toner), actual: `toner ${t.qty} ${t.unit} maliyet ${t.unitPrice}; uyarı: ${alerts.map(a => a.name).join(", ") || "yok"}` };
}, { severity: "High" });
await T("E5", "2 Entegrasyon", "Fatura → İcra dosyası bağı (API tarafı)", "Olmayan dosyaya bağlı cari açmayı dene; carinin faturaları", "Boşa düşen bağ reddedilir; carinin faturaları listelenir (arayüz denetimi: gerçek dosyayla)", async () => {
  const dangling = await A("post", "/api/workspace/accounts", { name: "Boş Bağ", type: "customer", caseKey: "2026/9999", caseTitle: "Olmayan dosya" });
  const list = (await A("get", `/api/workspace/invoices?tab=all&account=${ids.ayse}`)).data.invoices;
  return { ok: false, status: dangling.status === 400 && list.length >= 2 ? "PARTIAL" : "FAIL", severity: "Medium", actual: `olmayan dosyaya bağ → ${dangling.status} "${(dangling.error || "").slice(0, 60)}"; Ayşe Kaya'nın ${list.length} belgesi cari süzgeciyle listelenir. Faturada dosya alanı yok; bağ cari üzerinden (arayüz denetimi U7)` };
});
await T("E6", "2 Entegrasyon", "Fatura → Tahsilat Takvimi / Vade Takip", "Toner satışı 5 gün vadeli; alış vadesi 10 gün geçti (tedarikçiye ödenecek)", "Vade listesi: 7 gün içindekiler ve gecikenler; gecikme uyarısı", async () => {
  const dues = (await A("get", "/api/workspace/dues")).data.items.filter(i => i.source === "invoice");
  const toner = dues.find(i => i.invoiceId === ids.tonerSale);
  const late = dues.find(i => i.invoiceId === alis.data.id);
  return { ok: Boolean(toner) && toner.state === "upcoming" && Boolean(late) && late.state === "overdue" && late.direction === "out", actual: `takvimde fatura kalemi ${dues.length}: toner ${toner?.state} ${toner?.dueText}; alış ${late?.state} (${late?.direction}, ${late?.dueText})` };
}, { severity: "High" });
await T("E7.1", "2 Entegrasyon", "Fatura → Raporlar: Cari Ekstre, Kasa Hareketleri, Mizan", "Ayşe Kaya ekstresi; Kasa raporu kaynak; mizan dengesi", "Ekstrede fatura/iade/tahsilat satırları; Kasa'da fatura satırı; mizan dengeli", async () => {
  const ekstre = await report("cari-ekstre", `account=${ids.ayse}&from=${shift(-60)}&to=${TODAY}`);
  const text = JSON.stringify(ekstre.data?.rows || []);
  const kasa = await report("kasa-hareketleri", `from=${shift(-60)}&to=${TODAY}`);
  const mizan = await report("hesap-mizani", `from=${shift(-60)}&to=${TODAY}`);
  const mz = (await A("get", "/api/workspace/ledger")).data;
  return { ok: ekstre.status === 200 && /Satış Faturası/.test(text) && /İade/.test(text) && kasa.status === 200 && JSON.stringify(kasa.data.rows).includes("Fatura") && mizan.status === 200 && mz.trial.balanced, actual: `ekstre ${ekstre.data?.total} satır (fatura ${/Satış Faturası/.test(text)}, iade ${/İade/.test(text)}); Kasa raporu ${kasa.data?.total} satır; mizan dengeli=${mz.trial.balanced}` };
}, { severity: "High" });
await T("E7.2", "2 Entegrasyon", "Fatura → Raporlar: KDV Özeti, Yaşlandırma, Açık Faturalar, Gider, Ba-Bs, Stopaj/Tevkifat", "Bu ayın KDV özeti ve diğerleri", "Hesaplanan KDV = satış KDV − iade; yaşlandırmada gecikmiş alış değil satış; açık faturalar listesi; gider raporunda kırtasiye", async () => {
  const from = shift(-60);
  const list = (await A("get", "/api/workspace/invoices?tab=all&limit=500")).data.invoices.filter(x => x.status === "issued");
  const out391 = list.filter(x => ["sale", "smm"].includes(x.kind)).reduce((s, x) => s + c(x.tryVat) - c(x.withheldTotal), 0) - list.filter(x => x.kind === "sale_return").reduce((s, x) => s + c(x.tryVat), 0);
  const in191 = list.filter(x => x.kind === "purchase").reduce((s, x) => s + c(x.tryVat), 0) - list.filter(x => x.kind === "purchase_return").reduce((s, x) => s + c(x.tryVat), 0);
  const kdv = await report("kdv-ozeti", `from=${from}&to=${TODAY}`);
  const hesaplanan = c(String(kdv.data.summary.find(([k]) => k.startsWith("Hesaplanan"))?.[1] || "0").replace(/[^\d,-]/g, "").replace(",", "."));
  const indirilecek = c(String(kdv.data.summary.find(([k]) => k.startsWith("İndirilecek"))?.[1] || "0").replace(/[^\d,-]/g, "").replace(",", "."));
  const yas = await report("alacak-yaslandirma", "");
  const acik = await report("acik-faturalar", "");
  const gider = await report("gider-raporu", `from=${from}&to=${TODAY}`);
  const babs = await report("ba-bs", `from=${from}&to=${TODAY}`);
  const stopaj = await report("stopaj-tevkifat", `from=${from}&to=${TODAY}`);
  const ok = hesaplanan === out391 && indirilecek === in191 && yas.status === 200 && acik.status === 200 && acik.data.total >= 2 && gider.status === 200 && JSON.stringify(gider.data.rows).includes("Kırtasiye") && babs.status === 200 && stopaj.status === 200 && /1\.800|602|Tevkifat/.test(JSON.stringify(stopaj.data));
  return { ok, actual: `KDV 391 ${hesaplanan / 100} (model ${out391 / 100}), 191 ${indirilecek / 100} (model ${in191 / 100}); yaşlandırma ${yas.status}; açık fatura ${acik.data?.total}; gider ${gider.status} kırtasiye=${JSON.stringify(gider.data?.rows || "").includes("Kırtasiye")}; Ba-Bs ${babs.status}; stopaj/tevkifat ${stopaj.status}` };
}, { severity: "High" });
await T("E8", "2 Entegrasyon", "Fatura → Görevler / Notlar", "Faturaya görev ata, not ekle", "Fatura üzerinden görev/not", async () => ({ ok: false, status: "N/A", severity: "Low", actual: "Faturaya görev atama ve not iş parçacığı yok; fatura üzerinde serbest 'Not' alanı var; görev ve notlar dosya kaydına bağlanır" }));
await T("E9", "2 Entegrasyon", "Çift yönlü tutarlılık: cari elle düzeltme, faturadan gelen satırı elle değiştirme", "Hasan Öztürk'e elle 'alacak' 100 yaz; faturadan gelen cari satırını sil/düzelt; Kasa satırını düzelt", "Elle alacak faturanın açığını düşürür (FIFO) ve mutabakat tutarlı; faturadan gelen satırlar 409", async () => {
  const s = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: TODAY, lines: [{ name: "Dilekçe", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open", dueDate: shift(10) } });
  const manual = await A("post", `/api/workspace/accounts/${ids.hasan1}/entries`, { kind: "credit", amount: "100", date: TODAY, note: "Elle düzeltme (QA)" });
  const d = await detail(s.data.id);
  const a = await account(ids.hasan1);
  const invRow = a.entries.find(e => e.source === "invoice" && e.sourceId === s.data.id);
  const delRow = await A("delete", `/api/workspace/accounts/${ids.hasan1}/entries/${invRow.id}`);
  const editRow = await A("put", `/api/workspace/accounts/${ids.hasan1}/entries/${invRow.id}`, { kind: "debt", amount: "1", date: TODAY });
  const i = await integrity();
  ids.hasanSale = s.data.id;
  return { ok: manual.status === 200 && d.payState === "partial" && delRow.status === 409 && editRow.status === 409 && i.ok, actual: `elle alacak ${manual.status} → fatura ${d.payStateLabel} (açık ${d.open}); faturadan gelen satırı sil ${delRow.status} düzelt ${editRow.status}; mutabakat ${i.ok}` };
}, { severity: "High" });

// ===================== 3. VERİ BÜTÜNLÜĞÜ =====================
await T("D2", "3 Veri Bütünlüğü", "Yuvarlama (0,01 TL) ve başlık = kalemler", "3 × 33,333 (%1), 7 × 0,07 (%10), KDV dahil 99,99 (%20); mutabakat kapısının 'fatura:lines' denetimi", "Satır bazında yuvarlama, başlık = kalem toplamı; kapı ok", async () => {
  const r = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "A", qty: 3, unitPrice: 33.333, vatRate: 1 }, { name: "B", qty: 7, unitPrice: 0.07, vatRate: 10 }, { name: "C", qty: 1, unitPrice: 99.99, vatRate: 20 }], payment: { rest: "open" } });
  const i = await integrity();
  const lines = r.data?.lines || [];
  const sum = lines.reduce((s, l) => s + c(l.payable), 0);
  return { ok: r.status === 200 && sum === c(r.data.payableTotal) && i.ok, actual: `kalemler ${lines.map(l => l.payable).join("+")} = ${sum / 100}; başlık ${r.data?.payableTotal}; kapı ${i.ok} ${i.failures?.map(f => f.name).join(",") || ""}` };
}, { severity: "High" });
await T("D3", "3 Veri Bütünlüğü", "Çok satırlı fatura: 200 kalem (sınır 500)", "200 kalemli satış kes; kartı aç; PDF al", "Kesme < 3 sn; açma < 1 sn; PDF üretilir; toplam doğru", async () => {
  const lines = Array.from({ length: 200 }, (_, i) => ({ name: `Kalem ${i + 1}`, qty: 1 + (i % 5), unitPrice: 10 + i * 0.37, vatRate: [1, 10, 20][i % 3] }));
  const t0 = performance.now();
  const r = await inv({ scenario: "service_sale", accountId: ids.teknik, issueDate: TODAY, lines, payment: { rest: "open" } });
  const t1 = performance.now();
  const d = await detail(r.data.id);
  const t2 = performance.now();
  const pdf = await admin.raw("GET", `/api/workspace/invoices/${r.data.id}/fatura.pdf`);
  const t3 = performance.now();
  const expect = computeInvoice(lines, {}).totals.payable;
  const over = await inv({ scenario: "service_sale", accountId: ids.teknik, lines: Array.from({ length: 501 }, (_, i) => ({ name: `K${i}`, qty: 1, unitPrice: 1, vatRate: 20 })), payment: { rest: "open" } });
  return { ok: r.status === 200 && d.lines.length === 200 && c(d.payableTotal) === expect && pdf.status === 200 && t1 - t0 < 3000 && t2 - t1 < 1000 && over.status === 400, actual: `kes ${(t1 - t0).toFixed(0)} ms, aç ${(t2 - t1).toFixed(0)} ms, PDF ${(t3 - t2).toFixed(0)} ms (${pdf.buffer.length} bayt); toplam ${d.payableTotal} = model ${expect / 100}; 501 kalem → ${over.status}` };
}, { severity: "Medium" });
await T("D4", "3 Veri Bütünlüğü", "Negatif miktar/fiyat, sıfır tutar, aşırı büyük tutar, 4 ondalık miktar", "qty −1; fiyat −5; %100 iskonto (sıfır); fiyat 1e13; miktar 0,0001", "Hepsi 400 ve Türkçe mesaj; hiçbiri kayıt bırakmaz", async () => {
  const base = { scenario: "service_sale", accountId: ids.hasan1, payment: { rest: "open" } };
  const before = (await A("get", "/api/workspace/invoices?tab=all&limit=500")).data.total;
  const cases = [
    ["qty −1", await inv({ ...base, lines: [{ name: "X", qty: -1, unitPrice: 10, vatRate: 20 }] })],
    ["fiyat −5", await inv({ ...base, lines: [{ name: "X", qty: 1, unitPrice: -5, vatRate: 20 }] })],
    ["sıfır", await inv({ ...base, lines: [{ name: "X", qty: 1, unitPrice: 10, discountRate: 100, vatRate: 20 }] })],
    ["1e13", await inv({ ...base, lines: [{ name: "X", qty: 1, unitPrice: 1e13, vatRate: 20 }] })],
    ["0,0001", await inv({ ...base, lines: [{ name: "X", qty: 0.0001, unitPrice: 10, vatRate: 20 }] })],
  ];
  const after = (await A("get", "/api/workspace/invoices?tab=all&limit=500")).data.total;
  return { ok: cases.every(([, r]) => r.status === 400) && before === after, actual: cases.map(([n, r]) => `${n}:${r.status} "${(r.error || "").slice(0, 36)}"`).join(" | ") + ` · kayıt ${before}→${after}` };
}, { severity: "High" });
await T("D5", "3 Veri Bütünlüğü", "Dövizli fatura (USD, kur 34,2512)", "1.000 USD + %20 KDV, kur 34,2512", "Belge 1.200 USD; deftere TL 41.101,44; cari TL", async () => {
  const r = await inv({ scenario: "service_sale", accountId: ids.teknik, issueDate: TODAY, currency: "USD", rate: 34.2512, lines: [{ name: "Uluslararası Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
  const before = await account(ids.teknik);
  return { ok: r.status === 200 && r.data.currency === "USD" && c(r.data.payableTotal) === 120000 && c(r.data.tryPayable) === 4110144, actual: `${r.status} ${r.data?.currency} belge ${r.data?.payableTotal} TL ${r.data?.tryPayable}; cari ${before.totals.balance}` };
}, { severity: "Medium" });
await T("D6", "3 Veri Bütünlüğü", "İptal/iade sonrası bağlı kayıtların geri alınması (tablo sayımı)", "Çekli + taksitli + stoklu satış kes; iptal et; tablolar", "stok hareketi, cari satırı, taksit kartı, çek: öncekiyle aynı; Kasa aynı", async () => {
  const count = () => ({ moves: store.get("SELECT COUNT(*) AS n FROM stock_moves").n, entries: store.get("SELECT COUNT(*) AS n FROM account_entries").n, plans: store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL").n, cheques: store.get("SELECT COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL").n });
  const before = count();
  const cs0 = await cash();
  const r = await inv({ scenario: "goods_sale", accountId: ids.hasan2, issueDate: TODAY, lines: [{ itemId: ids.klasor, qty: 5, unitPrice: 45, vatRate: 20 }], payment: { cash: [{ amount: 70, method: "cash" }], cheques: [{ instrument: "cheque", amount: 100, dueDate: shift(30), serialNo: "ZB-7781", bank: "Ziraat Konya Şb." }], rest: "installments", installments: { count: 2, firstDue: shift(15) } } });
  const mid = count();
  const canc = await A("post", `/api/workspace/invoices/${r.data.id}/cancel`, { reason: "QA geri alma", cashForce: true });
  const after = count();
  const cs1 = await cash();
  const i = await integrity();
  return { ok: r.status === 200 && canc.status === 200 && JSON.stringify(after) === JSON.stringify(before) && mid.moves === before.moves + 1 && mid.cheques === before.cheques + 1 && mid.plans === before.plans + 1 && c(cs0.byMethod.cash) === c(cs1.byMethod.cash) && i.ok, actual: `önce ${JSON.stringify(before)} → kesince ${JSON.stringify(mid)} → iptal ${JSON.stringify(after)}; nakit ${cs0.byMethod.cash}→${cs1.byMethod.cash}; kapı ${i.ok}` };
}, { severity: "Critical" });

// ===================== 5. EDGE / NEGATİF =====================
await T("N1.1", "5 Edge", "Eşzamanlılık: aynı taslağı iki kullanıcı aynı anda keser", "admin ve muhasebe aynı taslağa /issue", "Biri 200, diğeri 409 (invoice-stale); tek belge", async () => {
  const d = await inv({ scenario: "service_sale", accountId: ids.hasan1, status: "draft", lines: [{ name: "Eşzamanlı", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } });
  const [a, b] = await Promise.all([A("post", `/api/workspace/invoices/${d.data.id}/issue`, { issueDate: TODAY }), api(ids.clients.muhasebe, "post", `/api/workspace/invoices/${d.data.id}/issue`, { issueDate: TODAY })]);
  const st = [a.status, b.status].sort();
  const rows = store.get("SELECT COUNT(*) AS n FROM invoices WHERE id = ?", d.data.id).n;
  return { ok: st.join("/") === "200/409" && rows === 1, actual: `durumlar ${st.join("/")} (${a.code || b.code}); kayıt ${rows}` };
}, { severity: "High" });
await T("N1.2", "5 Edge", "Eşzamanlılık: 20 satış aynı anda → numaralar tekil ve boşluksuz", "İki kullanıcı 10'ar satışı aynı anda keser", "20 belge, 20 farklı ardışık numara", async () => {
  const mkSale = cl => api(cl, "post", "/api/workspace/invoices", { scenario: "service_sale", accountId: ids.hasan1, issueDate: TODAY, lines: [{ name: "Paralel", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const results = await Promise.all([...Array(10).fill(admin), ...Array(10).fill(ids.clients.avukat)].map(mkSale));
  const nums = results.filter(r => r.status === 200).map(r => Number(r.data.number.slice(-9))).sort((a, b) => a - b);
  const unique = new Set(nums).size;
  const gapless = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  return { ok: results.every(r => r.status === 200) && unique === 20 && gapless, actual: `${results.filter(r => r.status === 200).length}/20 kesildi; tekil ${unique}; ardışık ${gapless} (${nums[0]}…${nums.at(-1)})` };
}, { severity: "High" });
await T("N2", "5 Edge", "İnternet kesilmesi sırasında kayıt", "Yerel sunucu; istek yarıda kesilince", "Yarım kayıt kalmaz", async () => ({ ok: false, status: "BLOCKED", severity: "Medium", actual: "Bu ortamda simüle edilemedi (sunucu yerel ağda, istek kesintisi üretilmedi). Kod: her kesim tek BEGIN IMMEDIATE işlemi (yarım yazım imkânsız); istemci 'HOF.api' hatayı gösterir, yeniden deneme kullanıcıya bırakılır; e-Belge gönderiminde bağlantı kopması belgenin durumunu değiştirmez (Durum Sorgula ile alınır)" }));
await T("N3", "5 Edge", "Çok uzun açıklama / özel karakter / emoji", "Not 2.001 karakter; kalem adı 'Üçgen & \"Çift\" <tırnak> 😀 ₺'", "2.001 → 400; özel karakter ve emoji olduğu gibi saklanır, PDF üretilir", async () => {
  const long = await inv({ scenario: "service_sale", accountId: ids.hasan1, note: "A".repeat(2001), lines: [{ name: "X", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const name = "Üçgen & \"Çift\" <tırnak> 😀 ₺ İĞŞ";
  const r = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: TODAY, note: "Satır 1\nSatır 2 — 'tek' tırnak; %100 ✓", lines: [{ name, qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const d = await detail(r.data.id);
  const pdf = await admin.raw("GET", `/api/workspace/invoices/${r.data.id}/fatura.pdf`);
  return { ok: long.status === 400 && r.status === 200 && d.lines[0].name === name && d.note.includes("✓") && pdf.status === 200, actual: `2.001 karakter → ${long.status}; kalem adı korundu=${d.lines[0].name === name}; not korundu=${d.note.includes("✓")}; PDF ${pdf.status}` };
});
await T("N4", "5 Edge", "Geçersiz vergi numarası ve eksik zorunlu alan", "Cari: VKN '1234567891' (yanlış kontrol hanesi), TCKN '12345678901'; fatura: cari yok, kalem yok", "VKN/TCKN 400; cari/kalem eksik 400 Türkçe", async () => {
  const badVkn = await A("post", "/api/workspace/accounts", { name: "Hatalı VKN", type: "customer", taxNo: "1234567891" });
  const badTckn = await A("post", "/api/workspace/accounts", { name: "Hatalı TCKN", type: "customer", taxNo: "12345678901" });
  const noAcc = await inv({ scenario: "service_sale", lines: [{ name: "X", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const noLines = await inv({ scenario: "service_sale", accountId: ids.hasan1, lines: [], payment: { rest: "open" } });
  return { ok: badVkn.status === 400 && badTckn.status === 400 && noAcc.status === 400 && noLines.status === 400, actual: `VKN ${badVkn.status} "${(badVkn.error || "").slice(0, 40)}"; TCKN ${badTckn.status}; cari yok ${noAcc.status} "${(noAcc.error || "").slice(0, 30)}"; kalem yok ${noLines.status} "${(noLines.error || "").slice(0, 30)}"` };
}, { severity: "High" });
await T("N5", "5 Edge", "Geçmiş tarihli / ileri tarihli fatura", "Geçen yıl tarihli (yeni seri yılı); yarın tarihli", "Geçen yıl: kesilir (ayrı yıl serisi) — kronoloji yıl içinde; yarın: 400 date-future; 7 gün uyarısı", async () => {
  const lastYear = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: `${Number(YEAR) - 1}-12-15`, lines: [{ name: "Geçen yıl", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const future = await inv({ scenario: "service_sale", accountId: ids.hasan1, issueDate: shift(1), lines: [{ name: "Yarın", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  const warn = await A("post", "/api/workspace/invoices/calc", { kind: "sale", accountId: ids.hasan1, issueDate: shift(-9), lines: [{ name: "X", qty: 1, unitPrice: 10, vatRate: 20 }] });
  return { ok: lastYear.status === 200 && lastYear.data.number.includes(String(Number(YEAR) - 1)) && future.status === 400 && future.code === "date-future" && (warn.data?.warnings || []).length > 0, actual: `geçen yıl ${lastYear.status} ${lastYear.data?.number}; yarın ${future.status} ${future.code}; 9 gün geriye tarihli: uyarı "${(warn.data?.warnings || [])[0]?.slice?.(0, 60) || JSON.stringify((warn.data?.warnings || [])[0]).slice(0, 60)}"` };
});
await T("N7", "5 Edge", "Lisans / deneme süresi dolmuşken fatura", "Etkinleştirilmemiş (salt okunur) kurulumda fatura kes, liste al", "Yazma 403; okuma 200", async () => {
  const ro = await startTestServer({ license: { enforce: true, trustedKeys: [], services: [], fetchImpl: async () => { throw new Error("offline"); }, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f99", firstCheckDelayMs: 3_600_000 } });
  try {
    const cl = createClient(ro.base);
    await cl.login("admin", ADMIN_PASSWORD);
    const w = await api(cl, "post", "/api/workspace/invoices", { scenario: "service_sale", accountId: "x", lines: [{ name: "X", qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
    const r = await api(cl, "get", "/api/workspace/invoices");
    const lic = await api(cl, "get", "/api/license");
    return { ok: w.status === 403 && r.status === 200, actual: `kes ${w.status} "${(w.error || "").slice(0, 60)}"; liste ${r.status}; lisans durumu ${lic.data?.state || lic.status}` };
  } finally {
    await ro.close();
  }
}, { severity: "High" });

// ===================== 6. GÜVENLİK =====================
await T("S2", "6 Güvenlik", "Audit log: kim, ne zaman, ne değiştirdi", "audit_events: invoice.created / cancelled / issued; İşlem Geçmişi raporu", "Her olayda aktör, zaman, belge no, tutar", async () => {
  const rows = store.all("SELECT type, actor_name AS actor, payload_json AS payload, created_at AS at FROM audit_events WHERE type LIKE 'invoice.%' ORDER BY created_at");
  const types = [...new Set(rows.map(r => r.type))];
  const sample = rows.find(r => r.type === "invoice.cancelled");
  const rep = await report("islem-gecmisi", `from=${shift(-1)}&to=${TODAY}`);
  const inReport = JSON.stringify(rep.data?.rows || []).includes("invoice") || JSON.stringify(rep.data?.rows || []).includes("Fatura");
  return { ok: rows.length > 20 && types.includes("invoice.created") && types.includes("invoice.cancelled") && sample && sample.actor && sample.at && JSON.parse(sample.payload).number && rep.status === 200 && inReport, actual: `${rows.length} olay; türler: ${types.join(", ")}; örnek iptal: ${sample?.actor} ${sample?.at} ${JSON.parse(sample?.payload || "{}").number} "${JSON.parse(sample?.payload || "{}").reason}"; İşlem Geçmişi raporu ${rep.status} faturayı içeriyor=${inReport}` };
}, { severity: "High" });
await T("S3", "6 Güvenlik", "Hassas veri maskeleme", "TCKN/IBAN listede ve kartta nasıl görünür", "Gerekiyorsa maskeleme", async () => ({ ok: false, status: "PARTIAL", severity: "Low", actual: "Maskeleme yok: TCKN cari ve fatura kartında tam görünür (belgede yasal olarak zorunlu). Yetkisi olmayan rol faturayı hiç göremez (403). Entegratör parolası şifreli (AES-256-GCM, anahtar yedekte yok) ve ekrana çıkmaz" }));

// ===================== 7. RAPORLAMA / UYUMLULUK =====================
await T("R3", "7 Uyumluluk", "Yasal saklama ve arşivleme", "Kesilmiş belge silinebiliyor mu; iptal edilen saklanıyor mu; yedek", "Kesilen belge silinemez (409); iptal edilen numarasıyla kalır; yedek alınır", async () => {
  const del = await A("delete", `/api/workspace/invoices/${satis.data.id}`);
  const canc = (await A("get", "/api/workspace/invoices?tab=cancelled")).data.invoices;
  return { ok: del.status === 409 && canc.length >= 3 && canc.every(x => x.number), status: del.status === 409 ? "PARTIAL" : "FAIL", severity: "Low", actual: `kesilmişi sil ${del.status}; iptal edilenler numaralı ${canc.length}; veritabanı yedeği (VACUUM INTO) ve Drive yedeği var; 10 yıllık saklama / dönem arşivleme otomasyonu ve e-Belge (UBL) yasal saklama (imzalı XML arşivi) YOK — entegratör saklar` };
});

await T("N6", "5 Edge", "Silinmiş cari / stok kartına bağlı fatura", "Bakiyeli ve faturalı Ayşe Kaya carisini sil; faturasını aç; klasör ürününü (hareketli) sil; iade kes; iadesi olan alışı iptal et", "Borçlu cari silinemez (409) ya da silinince fatura açılır; silinmiş ürünlü faturanın iadesi anlamlı mesajla reddedilir ya da çalışır", async () => {
  const bal = (await account(ids.ayse)).totals.balance;
  const delAcc = await A("delete", `/api/workspace/accounts/${ids.ayse}`);
  const h2inv = (await A("get", `/api/workspace/invoices?tab=all&account=${ids.ayse}`)).data.invoices[0];
  const open = h2inv ? await A("get", `/api/workspace/invoices/${h2inv.id}`) : { status: 0 };
  const delItem = await A("delete", `/api/workspace/stock/${ids.klasor}`);
  const ret = await inv({ kind: "purchase_return", originalId: alis.data.id, issueDate: TODAY, lines: [{ originLineId: alis.data.lines[2].id, qty: 1 }], payment: {} });
  const cancAlis = await A("post", `/api/workspace/invoices/${alis.data.id}/cancel`, { reason: "QA" });
  const ok = (delAcc.status === 409 || (delAcc.status === 200 && open.status === 200)) && (delItem.status === 409 || [200, 400].includes(ret.status)) && cancAlis.status === 409;
  return { ok, severity: "Medium", actual: `cari (bakiye ${bal}, faturalı) sil ${delAcc.status} "${(delAcc.error || "").slice(0, 50)}"; faturası aç ${open.status}; ürün sil ${delItem.status} "${(delItem.error || "").slice(0, 50)}"; silinmiş ürünlü iade ${ret.status} "${(ret.error || "").slice(0, 50)}"; iadesi/satışı olan alışı iptal ${cancAlis.status} ${cancAlis.code}` };
});
const final = await integrity();
await T("D7", "3 Veri Bütünlüğü", "Koşu sonunda mutabakat kapısı ve mizan", "Tüm işlemlerden sonra", "Kapı ok; mizan dengeli", async () => {
  const mz = (await A("get", "/api/workspace/ledger")).data;
  return { ok: final.ok && mz.trial.balanced, actual: `kapı ${final.ok} ${final.failures?.map(f => f.name).join("; ") || ""}; mizan dengeli=${mz.trial.balanced} (borç ${mz.trial.totals.debit} alacak ${mz.trial.totals.credit})` };
}, { severity: "Critical" });

fs.writeFileSync(path.join(OUT, "sonuc-api.json"), JSON.stringify({ ids, results: R }, null, 2));
const counts = R.reduce((o, r) => ((o[r.status] = (o[r.status] || 0) + 1), o), {});
console.log("\nÖZET:", JSON.stringify(counts));
await server.close();
