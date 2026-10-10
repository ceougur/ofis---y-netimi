// Hakem (ACILIS-EKSI-KMH): banka hesabında eksi açılış ve KMH limiti, verilen kod kökünde (HEAD ya da v2.0.26) programın GERÇEK HTTP API'siyle,
// koşucusuz.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü (durum, kod, ileti, hesap kartındaki bakiye/limit) yazar.
//
// Vakalar (banka modülü olan sürümde):
//   P1 Ticari, KMH 23.059, açılış −11.529,50            P2 Diğer, aynı                P3 Vadesiz, aynı (karşı deney)
//   P4 Vadesiz, KMH yok, açılış −5.000                  P5 Vadesiz, KMH 10.000, açılış −30.000 (açılış KMH'yi aşar)
//   P6 Ticari, KMH 23.059 (API'den), açılış +1.000 doğrulanmış → hesap kartında KMH; Diğer Gider 12.529,50 (KMH içinde −11.529,50)
//   P7 Vadesiz, KMH 23.059, açılış 0 doğrulanmış → Düzenle'de tür Ticari (istemcinin gönderdiği gibi creditLimit YOK) → kartta KMH kalır mı;
//      Diğer Gider 12.529,50
//   P8 Ticari, KMH yok, açılış +1.000 doğrulanmış → Diğer Gider 12.529,50 (karşı deney: Uyar → 409 bekler)
//   P9 Ticari açılış +1.000 → Açılışı Düzelt −500
// (banka modülü olmayan sürümde, ör. v2.0.26) GET/POST /api/workspace/bank/accounts — banka hesabı ve açılışı kavramı var mı.
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ moneyStrict: false });
const admin = await loginAdmin(server);
const today = new Date().toISOString().slice(0, 10);
const back = days => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const out = { kok: root, bugun: today, vakalar: [] };
const body = r => (r.data && typeof r.data === "object" && "data" in r.data && r.data.ok !== undefined ? r.data.data : r.data);
const pick = r => {
  const d = r.data && typeof r.data === "object" ? r.data : {};
  return { durum: r.status, kod: r.status === 200 ? null : d.code ?? null, ileti: r.status === 200 ? null : d.error ?? d.message ?? null };
};

const probe = await admin.get("/api/workspace/bank/accounts");
out.bankaModulu = probe.status === 200;
out.vakalar.push({ ad: "P0 GET /api/workspace/bank/accounts", durum: probe.status });

if (out.bankaModulu) {
  let n = 0;
  const open = async (label, kind, amount, { creditLimit, confirmed = false, date = back(10) } = {}) => {
    n += 1;
    const req = { bankName: "Denizbank", name: `${label} ${n}`, kind, currency: "TRY", ...(creditLimit !== undefined ? { creditLimit } : {}), opening: { date, amount, confirmed } };
    const r = await admin.post("/api/workspace/bank/accounts", req);
    const id = r.status === 200 ? body(r).id : null;
    return { r, id };
  };
  const card = async id => {
    const r = await admin.get(`/api/workspace/bank/accounts/${id}`);
    const a = body(r)?.account || body(r);
    return a ? { kind: a.kind, glSub: a.glSub, creditLimitMinor: a.creditLimitMinor, balanceMinor: a.balanceMinor ?? a.balance?.cents ?? null, openingMinor: a.opening?.amountMinor ?? null } : null;
  };
  const vaka = async (ad, kind, amount, opts) => {
    const { r, id } = await open(ad, kind, amount, opts);
    out.vakalar.push({ ad, istek: { kind, amount, ...opts }, ...pick(r), kart: id ? await card(id) : null });
    return id;
  };
  await vaka("P1 Ticari KMH 23.059 açılış −11.529,50", "commercial", "-11529,50", { creditLimit: "23059" });
  await vaka("P2 Diğer KMH 23.059 açılış −11.529,50", "other", "-11529,50", { creditLimit: "23059" });
  await vaka("P3 Vadesiz KMH 23.059 açılış −11.529,50", "demand", "-11529,50", { creditLimit: "23059" });
  await vaka("P4 Vadesiz KMH yok açılış −5.000", "demand", "-5000", {});
  await vaka("P5 Vadesiz KMH 10.000 açılış −30.000", "demand", "-30000", { creditLimit: "10000" });

  const gider = async (ad, id) => {
    const r = await admin.post("/api/workspace/bank/vouchers", { type: "other_out", amount: "12529,50", accountId: id, date: today });
    out.vakalar.push({ ad, ...pick(r), kartSonra: await card(id) });
  };
  const p6 = await vaka("P6 Ticari KMH 23.059 (API) açılış +1.000 doğrulanmış", "commercial", "1000", { creditLimit: "23059", confirmed: true });
  if (p6) await gider("P6b Ticari (API KMH) Diğer Gider 12.529,50 → −11.529,50", p6);

  const p7 = await vaka("P7 Vadesiz KMH 23.059 açılış 0 doğrulanmış", "demand", "0", { creditLimit: "23059", confirmed: true });
  if (p7) {
    const r = await admin.put(`/api/workspace/bank/accounts/${p7}`, { kind: "commercial" });
    out.vakalar.push({ ad: "P7b Düzenle: tür Ticari (creditLimit gönderilmez; istemci hof-bank.js:779 gibi)", ...pick(r), kartSonra: await card(p7) });
    await gider("P7c Ticari'ye çevrilmiş hesapta Diğer Gider 12.529,50 → −12.529,50", p7);
  }
  const p8 = await vaka("P8 Ticari KMH yok açılış +1.000 doğrulanmış", "commercial", "1000", { confirmed: true });
  if (p8) await gider("P8b Ticari (KMH yok) Diğer Gider 12.529,50 → −11.529,50", p8);

  const p9 = await vaka("P9 Ticari açılış +1.000", "commercial", "1000", {});
  if (p9) {
    const r = await admin.post(`/api/workspace/bank/accounts/${p9}/opening`, { date: back(10), amount: "-500" });
    out.vakalar.push({ ad: "P9b Ticari Açılışı Düzelt −500", ...pick(r), kartSonra: await card(p9) });
  }
} else {
  const r = await admin.post("/api/workspace/bank/accounts", { bankName: "Denizbank", name: "Ticari", kind: "commercial", currency: "TRY", creditLimit: "23059", opening: { date: back(10), amount: "-11529,50" } });
  out.vakalar.push({ ad: "L1 POST /api/workspace/bank/accounts (Ticari, KMH, eksi açılış)", ...pick(r) });
}
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
