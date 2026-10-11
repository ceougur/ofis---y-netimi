// Hakem: KASA-ISTEK-KIMLIGI — verilen kod kökünde (v2.0.26 ya da HEAD) programın GERÇEK HTTP API'siyle.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü (durum kodu, gövde, Kasa satırları, mizan) yazar.
// Vakalar (boş şirket, yönetici):
//   1  POST /api/workspace/cash giriş 1.000 "Kasaya Giriş" (kimliksiz; eksi bakiyeye takılmasın diye)
//   2  POST /api/workspace/cash çıkış 212 "Temizlik Gideri", x-hof-request = K1
//   3  aynısı, aynı K1 (yineleme: plan §3.3 adım 1 / §3.10/1 → ikinci kez yazılmamalı, replayed)
//   4  çıkış 250, aynı K1 (farklı içerik: plan §3.3 adım 1 → 409)
//   5  iki istek AYNI ANDA, çıkış 10, aynı K2 (çift tıklama / ağ yeniden denemesi)
//   6  KARŞI DENEY: cari aç + cari nakit tahsilatı 300 iki kez aynı K3 (POST /api/workspace/accounts/:id/entries)
// Sonra: Kasa (GET /api/workspace/cash?method=cash) satırları ve bakiye; Hesap Mizanı 100/120/649/770.
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ moneyStrict: false });
const admin = await loginAdmin(server);
const out = { kok: root, adimlar: [] };
const today = new Date().toISOString().slice(0, 10);
const K1 = "a1".repeat(16); // 32 onaltılık hane (ekranın HOF.requestId() biçimi)
const K2 = "b2".repeat(16);
const K3 = "c3".repeat(16);
const short = r => ({ durum: r.status, ok: r.data?.ok ?? null, veri: r.data?.data ?? null, hata: r.status === 200 ? null : { error: r.data?.error ?? r.data, code: r.data?.code ?? null } });
const step = async (ad, fn) => {
  const r = await fn();
  const rec = Array.isArray(r) ? r.map(short) : short(r);
  out.adimlar.push({ ad, sonuc: rec });
  return r;
};
const cashBody = (kind, amount, description) => ({ kind, amount, date: today, description, method: "cash" });

await step("1 Kasa giriş 1.000 (kimliksiz)", () => admin.post("/api/workspace/cash", cashBody("in", "1000", "Kasaya Giriş")));
await step("2 Kasa çıkış 212, K1", () => admin.post("/api/workspace/cash", cashBody("out", "212", "Temizlik Gideri"), { "x-hof-request": K1 }));
await step("3 Kasa çıkış 212, K1 (aynı içerik, yineleme)", () => admin.post("/api/workspace/cash", cashBody("out", "212", "Temizlik Gideri"), { "x-hof-request": K1 }));
await step("4 Kasa çıkış 250, K1 (farklı içerik)", () => admin.post("/api/workspace/cash", cashBody("out", "250", "Temizlik Gideri"), { "x-hof-request": K1 }));
await step("5 Kasa çıkış 10 ×2 AYNI ANDA, K2", () => Promise.all([0, 1].map(() => admin.post("/api/workspace/cash", cashBody("out", "10", "Çay Ocağı"), { "x-hof-request": K2 }))));
const acc = await step("6a cari aç (karşı deney)", () => admin.post("/api/workspace/accounts", { name: "Hakem Müşteri", type: "customer" }));
const accId = acc.data?.data?.id;
await step("6b cari nakit tahsilat 300, K3", () => admin.post(`/api/workspace/accounts/${encodeURIComponent(accId)}/entries`, { kind: "in", amount: "300", date: today, method: "cash" }, { "x-hof-request": K3 }));
await step("6c cari nakit tahsilat 300, K3 (aynı içerik, yineleme)", () => admin.post(`/api/workspace/accounts/${encodeURIComponent(accId)}/entries`, { kind: "in", amount: "300", date: today, method: "cash" }, { "x-hof-request": K3 }));

const cash = await admin.get(`/api/workspace/cash?method=cash`);
const entries = cash.data?.data?.entries || [];
out.kasa = {
  durum: cash.status,
  bakiye: cash.data?.data?.totals?.balance ?? null,
  satirSayisi: entries.length,
  satirlar: entries.map(e => ({ kaynak: e.source, tur: e.kind, tutar: e.amount, aciklama: e.description || e.note || "" })),
  temizlikGideriSatiri: entries.filter(e => (e.description || "") === "Temizlik Gideri").length,
  cayOcagiSatiri: entries.filter(e => (e.description || "") === "Çay Ocağı").length,
  cariTahsilatSatiri: entries.filter(e => e.source === "account").length,
};
const ledger = await admin.get("/api/workspace/ledger");
const accounts = ledger.data?.data?.trial?.accounts || [];
out.mizan = Object.fromEntries(accounts.filter(a => ["100", "120", "649", "770"].includes(String(a.code))).map(a => [a.code, { ad: a.name, borc: a.debit, alacak: a.credit, bakiye: a.balance }]));
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
