// Hakem: KAHIN-A-YINELEME-SIRASI — verilen kod kökünde (v2.0.26 ya da HEAD) programın GERÇEK HTTP API'siyle, koşucusuz.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü ve sonraki okumaları yazar.
// Her vaka kendi carisi + kendi taksitli satış faturası (hizmet 1 × 100, KDV %20 hariç → 120, 2 taksit) üzerinde:
//   R1  120 (kimlik K1) → AYNI kimlik + AYNI gövde 120           (en küçük senaryonun 3. ve 4. adımı; kalanı aşan yineleme)
//   R2  100 (kimlik K2) → AYNI kimlik + AYNI gövde 100           (kalan 20 < 100: yineleme kalanı aşar)
//   R3   50 (kimlik K3) → AYNI kimlik + AYNI gövde  50           (kalan 70 ≥ 50: yineleme kalanı aşmaz)
//   D   120 (kimlik K4) → AYNI kimlik, FARKLI gövde 60           (dil §5.4 / plan §3.3 adım 1: 409; hedef kuralından önce)
//   N   120 (kimlik K5) → YENİ kimlik K6, aynı gövde 120         (kapanmış karta YENİ tahsilat: BELİRSİZ-6 / plan K8 alanı)
//   N0  120 (kimliksiz) → kimliksiz 120                           (aynı, istek kimliği hiç yok)
// Her vakadan sonra: kartın hareket sayısı + toplam/ödenen/kalan, carinin bakiyesi, Kasa toplamı (birikimli) ve vakanın Kasa farkı.
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
const key = s => (s + "-hakem-kahin-a-yineleme").padEnd(32, "x");
const post = async (url, body, k) => D(await admin.post(url, body, k ? { "x-hof-request": key(k) } : {}));
const get = async url => D(await admin.get(url));
const yanit = r => ({ durum: r.status, kod: r.code, hata: r.ok ? null : String(r.error).slice(0, 200), entryId: r.data?.entryId ?? null, replayed: r.ok ? Boolean(r.data?.replayed) : null });
const kasa = async () => {
  const c = await get("/api/workspace/cash");
  return c.ok ? c.data?.totals?.balance ?? null : `okunamadı ${c.status}`;
};

async function vaka(ad, ilk, ikinci) {
  const cari = await post("/api/workspace/accounts", { name: `Hakem ${ad}`, type: "customer" });
  if (!cari.ok) throw new Error(`${ad}: cari açılamadı ${cari.status} ${cari.error}`);
  const fat = await post("/api/workspace/invoices", { kind: "sale", accountId: cari.data.id, issueDate: today, pricesIncludeVat: false, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: "100", vatRate: 20 }], payment: { cash: [], rest: "installments", installments: { count: 2, firstDue, everyMonths: 1 } } });
  if (!fat.ok || !fat.data?.planId) throw new Error(`${ad}: fatura/kart yok ${fat.status} ${fat.error}`);
  const planId = fat.data.planId;
  const kasaOnce = await kasa();
  const tah = tutar => ({ kind: "in", amount: tutar, date: today, method: "cash" });
  const r1 = await post(`/api/workspace/plans/${planId}/entries`, tah(ilk.tutar), ilk.kimlik);
  const r2 = await post(`/api/workspace/plans/${planId}/entries`, tah(ikinci.tutar), ikinci.kimlik);
  const plan = await get(`/api/workspace/plans/${planId}`);
  const list = await get("/api/workspace/plans?status=all");
  const row = (list.data?.plans || []).find(p => p.id === planId);
  const parties = await get("/api/workspace/accounts?status=all&limit=5000");
  const bakiye = (parties.data?.accounts || []).find(a => a.id === cari.data.id)?.balance ?? null;
  const kasaSonra = await kasa();
  out.vakalar[ad] = {
    gonderilen: { ilk, ikinci },
    ilk: yanit(r1),
    ikinci: yanit(r2),
    ayniHareket: r1.ok && r2.ok ? r1.data.entryId === r2.data.entryId : null,
    kart: {
      hareketSayisi: plan.ok ? (plan.data?.entries || []).length : `okunamadı ${plan.status}`,
      hareketler: plan.ok ? (plan.data?.entries || []).map(e => ({ tur: e.kind, tutar: e.amount })) : null,
      toplam: row?.totals?.total ?? null,
      odenen: row?.totals?.paid ?? null,
      kalan: row?.totals?.remaining ?? null,
    },
    cariBakiye: bakiye,
    kasaOnce,
    kasaSonra,
    kasaFarki: typeof kasaOnce === "number" && typeof kasaSonra === "number" ? Math.round((kasaSonra - kasaOnce) * 100) / 100 : null,
  };
}

await vaka("R1", { tutar: "120", kimlik: "K1" }, { tutar: "120", kimlik: "K1" });
await vaka("R2", { tutar: "100", kimlik: "K2" }, { tutar: "100", kimlik: "K2" });
await vaka("R3", { tutar: "50", kimlik: "K3" }, { tutar: "50", kimlik: "K3" });
await vaka("D", { tutar: "120", kimlik: "K4" }, { tutar: "60", kimlik: "K4" });
await vaka("N", { tutar: "120", kimlik: "K5" }, { tutar: "120", kimlik: "K6" });
await vaka("N0", { tutar: "120", kimlik: null }, { tutar: "120", kimlik: null });

const integrity = await get("/api/workspace/ledger/integrity");
out.mutabakatTesti = integrity.ok ? { ok: integrity.data?.ok ?? null, basarisiz: (integrity.data?.checks || []).filter(c => c.ok === false).map(c => c.name || c.id || c.label) } : `okunamadı ${integrity.status}`;
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
