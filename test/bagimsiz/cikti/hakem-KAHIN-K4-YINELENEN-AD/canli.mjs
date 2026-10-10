// Hakem: KAHIN-K4-YINELENEN-AD — verilen kod kökünde (v2.0.26 ya da HEAD) programın GERÇEK HTTP API'siyle.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü ve sonraki okumaları yazar. Koşucu (surucu.mjs) KULLANILMAZ:
// takma ad ↔ kimlik eşlemesi koşucunun işidir; burada programın kendisi ne yapıyor (ikinci istek ne döndürür, kaç belge var)
// ona bakılır.
// Vakalar (boş şirket, aynı kullanıcı):
//   S  satış: hizmet 1 × 500, KDV %20 hariç, 2 taksit; x-hof-request K1 ile İKİ kez AYNI gövde (en küçük senaryonun 2. ve 3. adımı)
//   A1 alış: tedarikçi, hizmet 1 × 300 %20, belge no "A-100"; K2 ile iki kez AYNI gövde (no dahil)
//   A2 alış: K3 ile önce no "Z3", sonra no "Z4" (koşucunun `number: step.ad` eşlemesi; senaryoda yalnız `ad` farklı)
//   D  satış: K4 ile önce 500, sonra 501 (aynı kimlik, farklı içerik)
// Sonra: fatura listesi (kaç belge), Taksitler (kaç kart), Cari listesi bakiyeleri, Hesap Mizanı 120/191/320/391/600/770.
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] || ".");
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({});
const admin = await loginAdmin(server);
const out = { kok: root, vakalar: {} };
const today = new Date().toISOString().slice(0, 10);
const [yy, mm] = today.split("-").map(Number);
const firstDue = new Date(Date.UTC(yy, mm, 5)).toISOString().slice(0, 10);
const D = r => {
  const p = r.data;
  const okBody = p && typeof p === "object" && p.ok === true;
  return { status: r.status, ok: r.status === 200 && okBody, data: okBody ? p.data : p, code: p && typeof p === "object" ? p.code ?? null : null, error: p && typeof p === "object" ? p.error ?? "" : "" };
};
const key = s => (s + "-hakem-k4-yinelenen-ad").padEnd(32, "x");
const post = async (url, body, k) => D(await admin.post(url, body, k ? { "x-hof-request": key(k) } : {}));
const yanit = r => ({ durum: r.status, kod: r.code, hata: r.ok ? null : r.error, id: r.data?.id ?? null, planId: r.data?.planId ?? null, numara: r.data?.number ?? null, replayed: r.ok ? Boolean(r.data?.replayed) : null, odenecek: r.ok ? r.data?.payableTotal ?? null : null });

const musteri = await post("/api/workspace/accounts", { name: "Hakem Müşteri", type: "customer" });
const tedarikci = await post("/api/workspace/accounts", { name: "Hakem Tedarikçi", type: "supplier" });
if (!musteri.ok || !tedarikci.ok) throw new Error(`cari açılamadı: ${musteri.status} ${tedarikci.status}`);

const satis = (tutar = "500") => ({ kind: "sale", accountId: musteri.data.id, issueDate: today, pricesIncludeVat: false, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: tutar, vatRate: 20 }], payment: { cash: [], rest: "installments", installments: { count: 2, firstDue, everyMonths: 1 } } });
const alis = no => ({ kind: "purchase", accountId: tedarikci.data.id, issueDate: today, pricesIncludeVat: false, number: no, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: "300", vatRate: 20 }], payment: { cash: [], rest: "open" } });

const s1 = await post("/api/workspace/invoices", satis(), "K1");
const s2 = await post("/api/workspace/invoices", satis(), "K1");
out.vakalar.S = { ilk: yanit(s1), ikinci: yanit(s2), ayniBelge: s1.ok && s2.ok && s1.data.id === s2.data.id, ayniKart: s1.ok && s2.ok && s1.data.planId === s2.data.planId };
const a1 = await post("/api/workspace/invoices", alis("A-100"), "K2");
const a2 = await post("/api/workspace/invoices", alis("A-100"), "K2");
out.vakalar.A1 = { ilk: yanit(a1), ikinci: yanit(a2), ayniBelge: a1.ok && a2.ok && a1.data.id === a2.data.id };
const z3 = await post("/api/workspace/invoices", alis("Z3"), "K3");
const z4 = await post("/api/workspace/invoices", alis("Z4"), "K3");
out.vakalar.A2 = { ilk: yanit(z3), ikinci: yanit(z4) };
const d1 = await post("/api/workspace/invoices", satis("500"), "K4");
const d2 = await post("/api/workspace/invoices", satis("501"), "K4");
out.vakalar.D = { ilk: yanit(d1), ikinci: yanit(d2) };

const list = D(await admin.get("/api/workspace/invoices?limit=5000"));
const docs = (list.data?.invoices || []).filter(i => i.status !== "draft");
out.faturaListesi = { durum: list.status, belgeSayisi: docs.length, belgeler: docs.map(i => ({ id: i.id, tur: i.kind, numara: i.number, odenecek: i.payableTotal ?? i.totals?.payable ?? null })) };
const plans = D(await admin.get("/api/workspace/plans?status=all"));
out.taksitKartlari = { durum: plans.status, kartSayisi: (plans.data?.plans || []).length, kartlar: (plans.data?.plans || []).map(p => ({ id: p.id, toplam: p.totals?.total, odenen: p.totals?.paid, kalan: p.totals?.remaining })) };
const parties = D(await admin.get("/api/workspace/accounts?status=all&limit=5000"));
out.cariler = Object.fromEntries((parties.data?.accounts || []).map(a => [a.name, a.balance]));
const ledger = D(await admin.get("/api/workspace/ledger"));
const accounts = ledger.data?.trial?.accounts || [];
out.mizan = Object.fromEntries(accounts.filter(a => ["120", "191", "320", "391", "600", "770"].includes(String(a.code))).map(a => [a.code, { borc: a.debit, alacak: a.credit, bakiye: a.balance }]));
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
