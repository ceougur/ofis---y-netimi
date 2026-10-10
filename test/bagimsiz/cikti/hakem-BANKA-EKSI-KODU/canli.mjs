// Hakem (BANKA-EKSI-KODU): eksi bakiye reddinin KODU ve onay bayrağı, verilen kod kökünde (v2.0.26 ya da HEAD) programın GERÇEK HTTP
// API'siyle, koşucusuz.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü (durum, kod, yanıt alanları, sonraki bakiye) yazar.
//
// Vakalar:
//   K1  Kasa (nakit) Uyar: boş Kasa'dan 100 çıkış → durum/kod (denetim: programın Kasa kodu).
//   K2  Kasa Engelle: aynı → durum/kod.
//   N0  GET /api/admin/negative-policy (plan §3.9 "bugünkü biçimini korur {cash, bank:'off', card:'off'}").
//   B*  (yalnız banka modülü olan sürümde) doğrulanmış hesap 97.359; C30'a 50.921,69 havale (200); C28'e 50.921,69 havale:
//       B1 bayraksız → durum/kod/alanlar; B2 yalnız cashForce (plan §3.9 "Yine de Kaydet, `cashForce`") → durum/kod;
//       B3 yalnız negativeOk → durum; hesap Engelle; B4 bayraksız (1.000) → durum/kod; B5 cashForce + negativeOk (1.000) → durum/kod.
//   L*  (banka modülü olmayan sürümde, ör. v2.0.26) negative-policy'ye bank:'warn' yazılır; boş "Banka" yolundan cariye 5.000 havale
//       ödemesi → durum/kod (canlı sürümde havale yolunda eksi bakiye denetimi var mı).
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ moneyStrict: false });
const admin = await loginAdmin(server);
const today = new Date().toISOString().slice(0, 10);
const out = { kok: root, bugun: today, vakalar: [] };
const pick = r => {
  const d = r.data && typeof r.data === "object" ? r.data : {};
  // Başarılı yanıtta gövde yazılmaz (yalnız durum); retlerde bütün alanlar (kod, accountId, method, bakiye…).
  const alanlar = r.status === 200 ? null : Object.fromEntries(Object.entries(d).filter(([k]) => !["error", "message"].includes(k)));
  return { durum: r.status, kod: d.code ?? null, ileti: d.error ?? d.message ?? null, alanlar };
};
const add = (ad, r, ek = {}) => out.vakalar.push({ ad, ...pick(r), ...ek });
// Başarılı yanıt { ok: true, data: {...} } biçiminde (eski sürümlerde düz olabilir).
const body = r => (r.data && typeof r.data === "object" && "data" in r.data && r.data.ok !== undefined ? r.data.data : r.data);

// ---- Kasa (nakit) ----
let r = await admin.put("/api/admin/negative-policy", { cash: "warn" });
out.vakalar.push({ ad: "N-put-cash-warn", durum: r.status });
add("K1 Kasa Uyar: boş Kasa'dan 100 çıkış", await admin.post("/api/workspace/cash", { kind: "out", amount: 100, date: today, description: "Kasadan Çıkış", method: "cash" }));
r = await admin.put("/api/admin/negative-policy", { cash: "block" });
add("K2 Kasa Engelle: boş Kasa'dan 100 çıkış", await admin.post("/api/workspace/cash", { kind: "out", amount: 100, date: today, description: "Kasadan Çıkış", method: "cash" }));
await admin.put("/api/admin/negative-policy", { cash: "off" });
r = await admin.get("/api/admin/negative-policy");
out.vakalar.push({ ad: "N0 GET /api/admin/negative-policy", durum: r.status, govde: r.data });

const supplier = async name => {
  const res = await admin.post("/api/workspace/accounts", { name, type: "supplier" });
  if (res.status !== 200) throw new Error("cari: " + JSON.stringify(res.data));
  const b = body(res);
  return b.id ?? b.account?.id;
};
const probe = await admin.get("/api/workspace/bank/accounts");
out.bankaModulu = probe.status === 200;

if (out.bankaModulu) {
  const acc = await admin.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı B6", kind: "demand", currency: "TRY", iban: "TR770006206026658218209388", opening: { date: today, amount: "97359", confirmed: true } });
  if (acc.status !== 200) throw new Error("hesap: " + JSON.stringify(acc.data));
  const bankAccountId = body(acc).id;
  out.hesapId = bankAccountId;
  const c30 = await supplier("Ege Danışmanlık C30");
  const c28 = await supplier("Toros Yapı Ltd. C28");
  const pay = (cari, flags = {}, amount = "50921,69") => admin.post(`/api/workspace/accounts/${cari}/entries`, { kind: "out", amount, date: today, method: "bank", bankAccountId, ...flags });
  const balance = async () => {
    const list = await admin.get("/api/workspace/bank/accounts");
    const b = body(list);
    const rows = Array.isArray(b) ? b : b.accounts || b.rows || [];
    const row = rows.find(x => x.id === bankAccountId);
    return row ? Object.fromEntries(Object.entries(row).filter(([k]) => /bal/i.test(k))) : null;
  };
  add("B0 C30'a 50.921,69 havale", await pay(c30), { bakiyeSonra: await balance() });
  add("B1 Uyar, bayraksız: C28'e 50.921,69 havale", await pay(c28), { bakiyeSonra: await balance() });
  add("B2 Uyar, yalnız cashForce:true (plan §3.9 bayrağı)", await pay(c28, { cashForce: true }), { bakiyeSonra: await balance() });
  const b2 = out.vakalar.at(-1);
  if (b2.durum !== 200) add("B3 Uyar, yalnız negativeOk:true (programın bayrağı)", await pay(c28, { negativeOk: true }), { bakiyeSonra: await balance() });
  const put = await admin.put(`/api/workspace/bank/accounts/${bankAccountId}`, { negativePolicy: "block" });
  out.vakalar.push({ ad: "P hesap Engelle", durum: put.status });
  // Engelle'de tutar 1.000 (B3 aynı gün aynı tutarla yazıldığı için 50.921,69 Benzer İşlem'e takılır; o ret bu sınıfın konusu değil).
  add("B4 Engelle, bayraksız: C28'e 1.000 havale", await pay(c28, {}, "1000"), { bakiyeSonra: await balance() });
  add("B5 Engelle, cashForce + negativeOk: C28'e 1.000 havale", await pay(c28, { cashForce: true, negativeOk: true }, "1000"), { bakiyeSonra: await balance() });
} else {
  const put = await admin.put("/api/admin/negative-policy", { cash: "warn", bank: "warn", card: "warn" });
  out.vakalar.push({ ad: "L0 negative-policy bank:'warn' yazımı", durum: put.status, govde: put.data });
  const get = await admin.get("/api/admin/negative-policy");
  out.vakalar.push({ ad: "L1 GET negative-policy (yazımdan sonra)", durum: get.status, govde: get.data });
  const cari = await supplier("Toros Yapı Ltd. C28");
  add("L2 boş Banka yolundan cariye 5.000 havale ödemesi (bayraksız)", await admin.post(`/api/workspace/accounts/${cari}/entries`, { kind: "out", amount: 5000, date: today, method: "bank" }));
}
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
