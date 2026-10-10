// Hakem: KAHIN-A-YINELEME-SIRASI komşusu (program tarafı) — Kasa'yı tam sıfırlayan nakit çıkışın AYNI istek kimliğiyle yinelenmesi.
//   node canli-eksi.mjs <kod-kökü>
// Dil §5.6 (3 istek kimliği → 6 eksi bakiye) ve plan §3.3 (1 requests.lookup → 8 guardFinal): yinelemede yazım yoktur, son durum
// eksiye düşmez; beklenen "replayed:true". Beklenen değer hesaplamaz; programın yanıtını ve sonraki okumaları yazar. Her vaka yeni sunucu.
//   CO-<politika>  cari ödeme (tedarikçiye) 100 nakit, Kasa 100 → r1 kimlik K; r2 AYNI kimlik+gövde; r3 AYNI kimlik+gövde + cashForce:true
//   KB-<politika>  Kasadan Bankaya 100 (hesapsız; kurulumda banka hesabı yok), Kasa 100 → aynı üç istek
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] || ".");
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const out = { kok: root, vakalar: {} };
const today = new Date().toISOString().slice(0, 10);
const D = r => {
  const p = r.data;
  const okBody = p && typeof p === "object" && p.ok === true;
  return { status: r.status, ok: r.status === 200 && okBody, data: okBody ? p.data : p, code: p && typeof p === "object" ? p.code ?? null : null, error: p && typeof p === "object" ? p.error ?? "" : "" };
};
const key = s => (s + "-hakem-eksi-yineleme").padEnd(32, "x");
const yanit = r => ({ durum: r.status, kod: r.code, hata: r.ok ? null : String(r.error).slice(0, 160), replayed: r.ok ? Boolean(r.data?.replayed) : null, id: r.ok ? r.data?.entryId ?? r.data?.id ?? null : null });

async function vaka(ad, politika, tur) {
  const server = await startTestServer({});
  const admin = await loginAdmin(server);
  const post = async (url, body, k) => D(await admin.post(url, body, k ? { "x-hof-request": key(k) } : {}));
  const put = async (url, body) => D(await admin.put(url, body));
  const get = async url => D(await admin.get(url));
  const pol = await put("/api/admin/negative-policy", { cash: politika });
  const acilis = await post("/api/workspace/cash", { kind: "in", amount: "100", date: today, description: "Kasaya Giriş", method: "cash" });
  let istek;
  let tedarikci = null;
  if (tur === "CO") {
    tedarikci = await post("/api/workspace/accounts", { name: `Hakem ${ad}`, type: "supplier" });
    istek = extra => post(`/api/workspace/accounts/${tedarikci.data.id}/entries`, { kind: "out", amount: "100", date: today, method: "cash", ...extra }, "K");
  } else {
    istek = extra => post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "100", date: today, ...extra }, "K");
  }
  const r1 = await istek({});
  const r2 = await istek({});
  const r3 = await istek({ cashForce: true, negativeOk: true });
  const cash = await get("/api/workspace/cash");
  let cariBakiye = null;
  if (tedarikci?.ok) {
    const parties = await get("/api/workspace/accounts?status=all&limit=5000");
    cariBakiye = (parties.data?.accounts || []).find(a => a.id === tedarikci.data.id)?.balance ?? null;
  }
  const integrity = await get("/api/workspace/ledger/integrity");
  out.vakalar[ad] = {
    politika: { durum: pol.status, kod: pol.code },
    kasaGirisi: { durum: acilis.status, kod: acilis.code },
    r1: yanit(r1),
    r2_ayniKimlik: yanit(r2),
    r3_ayniKimlik_cashForce: yanit(r3),
    kasaBakiye: cash.ok ? cash.data?.totals?.balance ?? null : `okunamadı ${cash.status}`,
    kasaHareketSayisi: cash.ok ? (cash.data?.entries || cash.data?.rows || []).length : null,
    cariBakiye,
    mutabakatTesti: integrity.ok ? integrity.data?.ok ?? null : `okunamadı ${integrity.status}`,
  };
  await server.close();
}

await vaka("CO-uyar", "warn", "CO");
await vaka("CO-engelle", "block", "CO");
await vaka("KB-uyar", "warn", "KB");
await vaka("KB-engelle", "block", "KB");
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
