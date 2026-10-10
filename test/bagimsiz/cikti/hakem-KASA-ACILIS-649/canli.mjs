// Hakem: KASA-ACILIS-649 — verilen kod kökünde (v2.0.26 ya da HEAD) programın GERÇEK HTTP API'siyle.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü yazar.
// Vakalar (boş şirket):
//   1. Kasa'ya elle giriş 49.505, açıklama "Açılış Bakiyesi" (koşucunun kasa_acilis karşılığı; programda ayrı Kasa açılışı yok)
//   2. Kasa'ya elle giriş 100, açıklama "Kasaya Giriş" (açılış sözcüğü yok)
//   3. Cari "Açılış Bakiyesi" alanı 1.000 (programın kendi açılış yolu; karşılaştırma için)
// Sonra: Hesap Mizanı (GET /api/workspace/ledger) 100/120/500/649 satırları ve Kasa raporu (bugün) Devir / Dönem Giriş.
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ moneyStrict: false });
const admin = await loginAdmin(server);
const out = { kok: root, adimlar: [] };
const U = r => (r && r.data && r.data.ok !== undefined && "data" in r.data ? { status: r.status, data: r.data.data, err: r.data } : { status: r.status, data: r.data, err: r.data });
const today = new Date().toISOString().slice(0, 10);
const step = async (ad, fn) => {
  const r = U(await fn());
  out.adimlar.push({ ad, durum: r.status, hata: r.status === 200 ? null : r.err });
  if (r.status !== 200) throw new Error(`${ad}: ${r.status} ${JSON.stringify(r.err)}`);
  return r.data;
};
await step("1 Kasa elle giriş 49.505 'Açılış Bakiyesi'", () => admin.post("/api/workspace/cash", { kind: "in", amount: "49505", date: today, description: "Açılış Bakiyesi", method: "cash" }));
await step("2 Kasa elle giriş 100 'Kasaya Giriş'", () => admin.post("/api/workspace/cash", { kind: "in", amount: "100", date: today, description: "Kasaya Giriş", method: "cash" }));
await step("3 Cari açılış bakiyesi 1.000 (müşteri)", () => admin.post("/api/workspace/accounts", { name: "Hakem Müşteri", type: "customer", openingBalance: "1000" }));
const ledger = U(await admin.get("/api/workspace/ledger"));
const accounts = ledger.data?.trial?.accounts || [];
out.mizan = Object.fromEntries(accounts.filter(a => ["100", "120", "500", "649"].includes(String(a.code))).map(a => [a.code, { ad: a.name, borc: a.debit, alacak: a.credit, bakiye: a.balance }]));
out.mutabakat = ledger.data?.reconciliation ? { ok: ledger.data.reconciliation.ok, fark: (ledger.data.reconciliation.rows || ledger.data.reconciliation.accounts || []).filter(r => Math.abs(Number(r.diff || r.difference || 0)) > 0.004).length } : null;
const cash = U(await admin.get(`/api/workspace/cash?from=${today}&to=${today}`));
out.kasaRaporuBugun = cash.status === 200 ? { devir: cash.data.opening, donemGiris: cash.data.period?.in, donemCikis: cash.data.period?.out, bakiye: cash.data.totals?.balance, satirlar: (cash.data.entries || []).map(e => ({ kaynak: e.source, tur: e.kind, tutar: e.amount, aciklama: e.description || e.note || "" })) } : { durum: cash.status, hata: cash.err };
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
