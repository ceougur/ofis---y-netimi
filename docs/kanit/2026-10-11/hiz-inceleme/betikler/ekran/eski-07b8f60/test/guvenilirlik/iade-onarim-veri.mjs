// Canlı Hata 2 (2.1.0) açılış onarımı fikstürü: GERÇEK v2.0.26 koduyla (git etiketi), o sürümün API'sinden, kullanıcı gibi girilen
// veri. 2.0.24–2.0.26'da peşinli taksitli satış faturasında iade + peşinin geri ödenmesi faturanın kendi taksit kartını yeniden
// büyütüyordu; bu veride o kartlar yanlış (fazla) kalır. Test: test/iade-210-onarim.test.mjs (güncel kodla açar, onarımı denetler).
//
//   Yeniden üret (etiket gerekir: git fetch --tags):
//     node --disable-warning=ExperimentalWarning test/guvenilirlik/iade-onarim-veri.mjs
//   → test/fixtures/surum-2.0.26-iade (+ içerik deposu test/fixtures/surum-nesneler)
//
// Senaryolar (her biri ayrı cari; tarih = üretim günü T'ye göre):
//   C      1.000 (500 peşin, 1 taksit vadesi T−20) → malın tamamı iade + 500 nakit geri          → v2.0.26 kart 500 (doğrusu 0)
//   B      1.000 (500 peşin, vade T+30) → 600 açık iade → 400 iade + 400 nakit geri               → v2.0.26 kart 400 bugün vadeli (doğrusu 0)
//   J      1.000 (400 peşin, 2 taksit) → 300 kart tahsilatı → tam iade + 700 nakit geri           → v2.0.26 kart kalanı 300 (doğrusu 0)
//   A      3.000 (2.000 peşin) → 1 açık iade → 1.500 kart tahsilatı (fazla) → 1 iade + 300 geri  → v2.0.26 toplam 300, kalan 0 (kalan doğru)
//   D      peşinsiz 1.000 → 400 iade + 400 nakit geri                                          → kart 1.000 (DOĞRU; dokunulmamalı)
//   E      1.000 (500 peşin) → 300 iade + 300 nakit geri                                         → kart 500 (DOĞRU; dokunulmamalı)
//   KILIT  C ile aynı, taksit vadesi T−40; en sonda dönem T−30'a kadar kilitlenir                → kart 500 kalır (kilitli döneme yazılmaz)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { packFixture } from "./fikstur.mjs";
import { bootVersion } from "./surumler.mjs";

export const IADE_FIXTURE = "surum-2.0.26-iade";
const TAG = "v2.0.26";
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function produce({ log = console.log } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-iade-onarim-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const server = await bootVersion(TAG, { dataDir, backupDir });
  try {
    const api = await server.login();
    const must = async (label, promise) => {
      const res = await promise;
      if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    const T = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
    const saleDay = addDays(T, -60);
    const customer = name => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: addDays(T, -90) }));
    const sale = async (acc, { qty = 10, price = 100, cash = [], count = 1, firstDue }) => {
      const doc = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: saleDay, currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty, unitPrice: price, vatRate: 0 }], payment: { cash, cheques: [], endorse: [], rest: "installments", installments: { count, firstDue, everyMonths: 1 } }, force: true }));
      return { id: doc.id, planId: doc.plan?.id || doc.planId, lineId: doc.lines[0].id, number: doc.number };
    };
    const giveBack = (acc, inv, qty, refund = 0) => must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: inv.id, issueDate: T, lines: [{ originLineId: inv.lineId, qty }], payment: { cash: refund ? [{ amount: refund, method: "cash" }] : [], cheques: [], endorse: [], rest: "open" }, force: true }));
    const collect = (inv, amount) => must("kart tahsilatı", api.post(`/api/workspace/plans/${inv.planId}/entries`, { kind: "in", amount: String(amount), method: "cash", date: T }));
    const nakit = amount => [{ amount, method: "cash" }];
    const out = {};
    const keep = async (key, acc, inv) => {
      const plan = await must("kart", api.get(`/api/workspace/plans/${inv.planId}`));
      out[key] = { accountId: acc.id, name: acc.name, invoiceId: inv.id, planId: inv.planId, v2026: { total: plan.totals.total, paid: plan.totals.paid, left: plan.totals.remaining } };
    };

    let acc = await customer("Onarım C");
    let inv = await sale(acc, { cash: nakit(500), firstDue: addDays(T, -20) });
    await giveBack(acc, inv, 10, 500);
    await keep("C", acc, inv);

    acc = await customer("Onarım B");
    inv = await sale(acc, { cash: nakit(500), firstDue: addDays(T, 30) });
    await giveBack(acc, inv, 6);
    await giveBack(acc, inv, 4, 400);
    await keep("B", acc, inv);

    acc = await customer("Onarım J");
    inv = await sale(acc, { cash: nakit(400), count: 2, firstDue: addDays(T, 10) });
    await collect(inv, 300);
    await giveBack(acc, inv, 10, 700);
    await keep("J", acc, inv);

    acc = await customer("Onarım A");
    inv = await sale(acc, { qty: 3, price: 1000, cash: nakit(2000), firstDue: addDays(T, 30) });
    await giveBack(acc, inv, 1);
    await collect(inv, 1500);
    await giveBack(acc, inv, 1, 300);
    await keep("A", acc, inv);

    acc = await customer("Onarım D");
    inv = await sale(acc, { firstDue: addDays(T, -20) });
    await giveBack(acc, inv, 4, 400);
    await keep("D", acc, inv);

    acc = await customer("Onarım E");
    inv = await sale(acc, { cash: nakit(500), firstDue: addDays(T, -20) });
    await giveBack(acc, inv, 3, 300);
    await keep("E", acc, inv);

    acc = await customer("Onarım Kilit");
    inv = await sale(acc, { cash: nakit(500), firstDue: addDays(T, -40) });
    await giveBack(acc, inv, 10, 500);
    await keep("KILIT", acc, inv);

    const lockedUntil = addDays(T, -30);
    await must("dönem kilidi", api.put("/api/admin/period-lock", { lockedUntil }));
    for (const [key, item] of Object.entries(out)) log(`${key}: v2.0.26 kart toplam ${item.v2026.total} · ödenen ${item.v2026.paid} · kalan ${item.v2026.left}`);
    await server.close();
    const packed = packFixture({ name: IADE_FIXTURE, dataDir, backupDir, manifest: { cut: TAG, commit: server.commit, today: T, lockedUntil, cases: out } });
    log(`${IADE_FIXTURE}: ${packed.files} dosya, ${packed.bytes} bayt`);
    return { today: T, cases: out };
  } catch (error) {
    await server.close().catch(() => {});
    throw error;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await produce();
