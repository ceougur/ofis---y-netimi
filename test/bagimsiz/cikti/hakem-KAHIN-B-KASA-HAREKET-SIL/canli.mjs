// Hakem: KAHIN-B-KASA-HAREKET-SIL — verilen kod kökünde (v2.0.26 ya da HEAD) programın GERÇEK HTTP API'siyle Kasa elle hareketi silme.
//   node canli.mjs <kod-kökü>
// Beklenen değer HESAPLAMAZ; yalnız programın döndürdüğünü (durum kodu, gövde, Kasa bakiyesi/satırları, Hesap Planı Mizanı 100/500/649/770,
// ANLIK DURUM Nakit Kasa, Silinenler, Mutabakat Testi) yazar. Tarihler sunucunun kendi "bugün"üne göredir (GET /api/workspace/ledger/lock).
// İki ayrı sunucu (boş şirket, yönetici):
//   A) en küçük: giriş 100 → sil
//   B) tanı (en-kucuk-KAHIN-B-KASA-HAREKET-SIL-tani.json ile aynı sıra):
//      H0 giriş 1.000 (T−9) · H5 giriş 50 (T−8) · kilit T−7 · sil H5 (kilitli) · H1 giriş 100 · H2 çıkış 200 · [k1] · sil H2 · sil H1 · [k2]
//      · sil H1 (ikinci kez) · H3 giriş 500 · H4 çıkış 1.500 · sil H3 (Kasa eksiye) · [k3] · sil H3 cashForce · [son]
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const out = { kok: root, enKucuk: null, tani: null };

const short = r => ({ durum: r.status, ok: r.data?.ok ?? null, veri: r.data?.data ?? null, hata: r.status === 200 ? null : { error: r.data?.error ?? r.data, code: r.data?.code ?? r.data?.data?.code ?? null } });
const shift = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function snapshot(admin) {
  const cash = await admin.get("/api/workspace/cash?method=cash");
  const entries = cash.data?.data?.entries || [];
  const ledger = await admin.get("/api/workspace/ledger");
  const accounts = ledger.data?.data?.trial?.accounts || [];
  const overview = await admin.get("/api/workspace/overview");
  return {
    kasaDurum: cash.status,
    kasaBakiye: cash.data?.data?.totals?.balance ?? null,
    kasaSatirlari: entries.map(e => ({ tarih: e.date, tur: e.kind, tutar: e.amount, aciklama: e.description || "" })),
    anlikDurumNakitKasa: overview.data?.data?.cash?.balance ?? null,
    mizanDurum: ledger.status,
    mizan: Object.fromEntries(accounts.filter(a => ["100", "500", "649", "770"].includes(String(a.code))).map(a => [a.code, { ad: a.name, borc: a.debit, alacak: a.credit, bakiye: a.balance }])),
  };
}

async function newServer() {
  const server = await startTestServer();
  const admin = await loginAdmin(server);
  const lock = await admin.get("/api/workspace/ledger/lock");
  const today = lock.data?.data?.today || new Date().toISOString().slice(0, 10);
  const policy = await admin.put("/api/admin/negative-policy", { cash: "warn" });
  return { server, admin, today, policy: short(policy) };
}

// ---------- A) en küçük ----------
{
  const { server, admin, today, policy } = await newServer();
  const rec = { bugun: today, politika: policy, adimlar: [] };
  const h1 = await admin.post("/api/workspace/cash", { kind: "in", amount: "100", date: today, description: "Hurda Satışı", method: "cash" });
  rec.adimlar.push({ ad: "1 H1 giriş 100", sonuc: short(h1) });
  rec.adimlar.push({ ad: "2 sil H1", sonuc: short(await admin.del(`/api/workspace/cash/${encodeURIComponent(h1.data?.data?.id)}`)) });
  rec.son = await snapshot(admin);
  const trash = await admin.get("/api/admin/trash");
  rec.silinenler = (trash.data?.data?.items || trash.data?.data || []).filter?.(t => t.kind === "cash").map(t => ({ tur: t.kind, baslik: t.title })) ?? trash.data;
  const integ = await admin.get("/api/workspace/ledger/integrity");
  rec.mutabakat = { durum: integ.status, ok: integ.data?.data?.ok ?? null, basarisiz: (integ.data?.data?.checks || []).filter(c => c.ok === false).map(c => c.id || c.name) };
  await server.close();
  out.enKucuk = rec;
}

// ---------- B) tanı ----------
{
  const { server, admin, today, policy } = await newServer();
  const rec = { bugun: today, politika: policy, adimlar: [], ara: {} };
  const ids = {};
  const step = async (ad, fn) => {
    const r = await fn();
    rec.adimlar.push({ ad, sonuc: short(r) });
    return r;
  };
  const write = (alias, kind, amount, date, description) => step(`${alias} ${kind === "in" ? "giriş" : "çıkış"} ${amount} (${date})`, async () => {
    const r = await admin.post("/api/workspace/cash", { kind, amount, date, description, method: "cash" });
    if (r.status === 200) ids[alias] = r.data?.data?.id;
    return r;
  });
  const del = (label, alias, force = false) => step(label, () => admin.del(`/api/workspace/cash/${encodeURIComponent(ids[alias])}${force ? "?cashForce=1&negativeOk=1" : ""}`));

  await write("H0", "in", "1000", shift(today, -9), "Kasaya Giriş");
  await write("H5", "in", "50", shift(today, -8), "Eski Hurda");
  await step(`kilit ${shift(today, -7)}`, () => admin.put("/api/admin/period-lock", { lockedUntil: shift(today, -7) }));
  await del("4 sil H5 (kilitli tarih)", "H5");
  await write("H1", "in", "100", today, "Hurda Satışı");
  await write("H2", "out", "200", today, "Temizlik Gideri");
  rec.ara.k1 = await snapshot(admin);
  await del("7 sil H2 (çıkış)", "H2");
  await del("8 sil H1 (giriş)", "H1");
  rec.ara.k2 = await snapshot(admin);
  await del("9 sil H1 (ikinci kez)", "H1");
  await write("H3", "in", "500", today, "Prim İadesi");
  await write("H4", "out", "1500", today, "Kira Ödemesi");
  await del("12 sil H3 (Kasa eksiye düşer, Uyar)", "H3");
  rec.ara.k3 = await snapshot(admin);
  await del("13 sil H3 (Yine de Kaydet: cashForce)", "H3", true);
  rec.son = await snapshot(admin);
  const trash = await admin.get("/api/admin/trash");
  const items = trash.data?.data?.items || trash.data?.data || [];
  rec.silinenler = Array.isArray(items) ? items.filter(t => t.kind === "cash").map(t => ({ tur: t.kind, baslik: t.title })) : trash.data;
  const integ = await admin.get("/api/workspace/ledger/integrity");
  rec.mutabakat = { durum: integ.status, ok: integ.data?.data?.ok ?? null, basarisiz: (integ.data?.data?.checks || []).filter(c => c.ok === false).map(c => c.id || c.name) };
  await server.close();
  out.tani = rec;
}

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
