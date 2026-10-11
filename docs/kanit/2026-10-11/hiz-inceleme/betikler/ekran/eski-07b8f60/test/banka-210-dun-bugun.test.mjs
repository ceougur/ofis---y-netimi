// 2.1.0 Aşama 15 "Çalışıyor Mu": "Dün 200 dönen her para işlemi bugün de 200" (plan §9.2/4 kabul ölçütü; §12.3 Aşama 15).
//
// Yöntem (CLAUDE.md test kuralı: veri programın kendisinin ürettiği): v2.0.26'nın GERÇEK kodu (git etiketi) çalıştırılır; yönetici
// kullanıcıları (avukat, muhasebe, personel, özel rol "Kasa ve Cari", kişiden cari yönetimi kaldırılmış muhasebe), cariler, taksit kartları,
// ürün, çekler ve Kasa nakdi o sürümün API'sinden girilir. Veri klasörü ikiye kopyalanır:
//   DÜN   = kopya v2.0.26 koduyla açılır, aşağıdaki para işlemleri her rolle yapılır, durum kodları kaydedilir;
//   BUGÜN = öbür kopya 2.1.0 koduyla açılır (göç 20 + yetki göçü), AYNI işlemler AYNI sırayla yapılır.
// Beklenen: her hücrede durum kodu aynı. İstisnalar (plan §9.2/4): personelin KENDİ girdiği BANKA BAĞLI satırı silmesi/parasını değiştirmesi
// ve K8 ödenmiş kart kuralı — bu veride banka hesabı tanımlı değil (havaleler hesaba bağlanmaz), K8 2.1.0'da yok: istisna hücre yok.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.0.26";
// Tarihler bugüne göre (CLAUDE.md: senaryolar tarihe bağlı yazılmaz); iki sürüm de gerçek saatle çalışır (v2.0.26 sahte saat tanımaz).
const pad = n => String(n).padStart(2, "0");
const dayOf = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = dayOf(0);
const WEEK_AGO = dayOf(-7);
const DUE = dayOf(60);
const ROLES = ["admin", "avukat", "muhasebe", "personel", "ozel", "kaldirilmis"];
const PASSWORD = "Personel-2026!";
const CUSTOM = ["accounts.view", "accounts.collect", "accounts.manage", "payments.create", "plans.view", "plans.collect", "plans.manage", "cash.view", "cash.manage", "stock.view", "stock.move", "stock.sell", "cheques.view", "cheques.manage", "invoices.view", "invoices.manage"];

describe("Aşama 15 — dün (v2.0.26) 200 dönen her para işlemi bugün (2.1.0) de aynı kodu döner", { skip: !tagsAvailable([OLD]) && `${OLD} etiketi yok (git fetch --tags)` }, () => {
  let root;
  let ids;
  const results = { [OLD]: {}, [CURRENT]: {} };
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "destekofis-dun-bugun-"));
    const seed = { dataDir: path.join(root, "seed", "data"), backupDir: path.join(root, "seed", "backups") };
    const server = await bootVersion(OLD, seed);
    try {
      const admin = await server.login();
      const must = async (label, promise) => {
        const res = await promise;
        assert.equal(res.status, 200, `${OLD} ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
        return res.data;
      };
      const role = await must("özel rol", admin.post("/api/admin/roles", { name: "Kasa ve Cari", permissions: CUSTOM }));
      const roleOf = { avukat: "avukat", muhasebe: "muhasebe", personel: "personel", ozel: role.id, kaldirilmis: "muhasebe" };
      for (const [name, value] of Object.entries(roleOf)) await must(`kullanıcı ${name}`, admin.post("/api/admin/users", { username: `u-${name}`, name, role: value, password: PASSWORD, mustChangePassword: false }));
      const list = await must("kullanıcılar", admin.get("/api/admin/users"));
      const target = list.find(user => user.username === "u-kaldirilmis");
      await must("kişiden cari yönetimi kaldır", admin.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["accounts.manage"] } }).then(res => ({ status: res.status, data: res.data })));
      const customer = await must("müşteri", admin.post("/api/workspace/accounts", { name: "Müşteri M", type: "customer", registeredOn: WEEK_AGO }));
      const supplier = await must("tedarikçi", admin.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier", registeredOn: WEEK_AGO }));
      const item = await must("ürün", admin.post("/api/workspace/stock", { name: "Ürün Y", unit: "Adet", openingQty: "1000", unitPrice: "1" }));
      await must("Kasa nakit", admin.post("/api/workspace/cash", { kind: "in", amount: "500.000", date: WEEK_AGO, description: "Açılış", method: "cash" }));
      ids = { customer: customer.id, supplier: supplier.id, item: item.id, plans: {}, refund: {}, chequesIn: {}, chequesOut: {} };
      for (const name of ROLES) {
        ids.plans[name] = (await must("kart", admin.post("/api/workspace/plans", { accountId: customer.id, name: `Kart ${name}`, total: "100.000", mode: "auto", count: 2, firstDue: DUE }))).id;
        const refund = await must("iade kartı", admin.post("/api/workspace/plans", { accountId: customer.id, name: `İade ${name}`, total: "100.000", mode: "auto", count: 2, firstDue: DUE }));
        await must("iade edilecek tahsilat", admin.post(`/api/workspace/plans/${refund.id}/entries`, { kind: "in", amount: "1.000", method: "cash", date: WEEK_AGO }));
        ids.refund[name] = refund.id;
        ids.chequesIn[name] = (await must("alınan çek", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", issueDate: WEEK_AGO, dueDate: DUE, drawer: "Keşideci", serialNo: `IN-${name}` }))).id;
        ids.chequesOut[name] = (await must("verilen çek", admin.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "200", issueDate: WEEK_AGO, dueDate: DUE, accountId: supplier.id, serialNo: `OUT-${name}` }))).id;
      }
    } finally {
      await server.close();
    }
    for (const side of ["dun", "bugun"]) cpSync(path.join(root, "seed"), path.join(root, side), { recursive: true });
  });
  after(() => root && rmSync(root, { recursive: true, force: true }));

  // Her rolle aynı sıra: yeni para satırları + kendi satırını düzelt/sil. Tutarlar rol başına ayrı (aynı gün aynı tutar karışmasın).
  const idx = name => ROLES.indexOf(name) + 1;
  const amt = (base, name) => String(base + idx(name));
  const CASES = [
    ["cari tahsilat nakit", (api, n) => api.post(`/api/workspace/accounts/${ids.customer}/entries`, { kind: "in", amount: amt(100, n), method: "cash", date: TODAY })],
    ["cari tahsilat havale", (api, n) => api.post(`/api/workspace/accounts/${ids.customer}/entries`, { kind: "in", amount: amt(110, n), method: "bank", date: TODAY })],
    ["cari tahsilat POS", (api, n) => api.post(`/api/workspace/accounts/${ids.customer}/entries`, { kind: "in", amount: amt(120, n), method: "card", date: TODAY })],
    ["cari ödeme nakit", (api, n) => api.post(`/api/workspace/accounts/${ids.supplier}/entries`, { kind: "out", amount: amt(130, n), method: "cash", date: TODAY, cashForce: true })],
    ["cari ödeme havale", (api, n) => api.post(`/api/workspace/accounts/${ids.supplier}/entries`, { kind: "out", amount: amt(140, n), method: "bank", date: TODAY, cashForce: true })],
    ["kayıt tahsilatı havale", (api, n) => api.post(`/api/workspace/cases/K-${n}/payments`, { amount: amt(150, n), date: TODAY, method: "bank", caseTitle: `K ${n}` })],
    ["taksit tahsilatı havale", (api, n) => api.post(`/api/workspace/plans/${ids.plans[n]}/entries`, { kind: "in", amount: amt(160, n), method: "bank", date: TODAY })],
    ["taksit iadesi havale", (api, n) => api.post(`/api/workspace/plans/${ids.refund[n]}/entries`, { kind: "out", amount: amt(170, n), method: "bank", date: TODAY, cashForce: true })],
    ["stok satışı peşin havale", (api, n) => api.post(`/api/workspace/stock/${ids.item}/moves`, { kind: "out", qty: "1", unitPrice: amt(180, n), pay: "cash", method: "bank", date: TODAY })],
    ["stok alımı peşin havale", (api, n) => api.post(`/api/workspace/stock/${ids.item}/moves`, { kind: "in", qty: "1", unitPrice: amt(190, n), pay: "cash", method: "bank", date: TODAY, cashForce: true })],
    ["çek bankaya tahsil", (api, n) => api.post(`/api/workspace/cheques/${ids.chequesIn[n]}/actions`, { action: "collect", date: TODAY, method: "bank" })],
    ["verilen çek ödemesi havale", (api, n) => api.post(`/api/workspace/cheques/${ids.chequesOut[n]}/actions`, { action: "pay", date: TODAY, method: "bank", cashForce: true })],
    ["satış faturası peşin havale", (api, n) => api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.customer, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: Number(amt(200, n)), discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: amt(200, n), method: "bank" }], cheques: [], endorse: [], rest: "open" }, force: true })],
    ["alış faturası peşin havale", (api, n) => api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.supplier, number: `AL-${n}`, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: Number(amt(210, n)), discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: amt(210, n), method: "bank" }], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true })],
    ["Kasadan Bankaya", (api, n) => api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: amt(220, n), date: TODAY })],
    ["Bankadan Kasaya", (api, n) => api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: amt(230, n), date: TODAY })],
  ];
  // Kendi girdiği havale satırını (cari, kayıt, taksit) nakde çevir, açıklamasını değiştir, sil.
  const OWN = [
    ["cari", async (api, n) => {
      const res = await api.post(`/api/workspace/accounts/${ids.customer}/entries`, { kind: "in", amount: amt(300, n), method: "bank", date: TODAY });
      const url = `/api/workspace/accounts/${ids.customer}/entries/${res.data?.entryId}`;
      return { created: res.status, note: () => api.put(url, { kind: "in", amount: amt(300, n), method: "bank", date: TODAY, note: "açıklama" }), cash: () => api.put(url, { kind: "in", amount: amt(300, n), method: "cash", date: TODAY }), del: () => api.del(url) };
    }],
    ["kayıt", async (api, n) => {
      const res = await api.post(`/api/workspace/cases/OWN-${n}/payments`, { amount: amt(310, n), date: TODAY, method: "bank", caseTitle: "Kendi" });
      const url = `/api/workspace/payments/${res.data?.id}`;
      return { created: res.status, note: () => api.put(url, { amount: amt(310, n), date: TODAY, method: "bank", note: "açıklama" }), cash: () => api.put(url, { amount: amt(310, n), date: TODAY, method: "cash" }), del: () => api.del(url) };
    }],
    ["taksit", async (api, n) => {
      const res = await api.post(`/api/workspace/plans/${ids.plans[n]}/entries`, { kind: "in", amount: amt(320, n), method: "bank", date: TODAY });
      const url = `/api/workspace/plans/${ids.plans[n]}/entries/${res.data?.entryId}`;
      return { created: res.status, note: () => api.put(url, { amount: amt(320, n), date: TODAY, method: "bank", note: "açıklama" }), cash: () => api.put(url, { amount: amt(320, n), date: TODAY, method: "cash" }), del: () => api.del(url) };
    }],
  ];

  async function runSide(version, side) {
    const options = { dataDir: path.join(root, side, "data"), backupDir: path.join(root, side, "backups") };
    const server = await bootVersion(version, options);
    const out = results[version];
    try {
      const apis = { admin: await server.login() };
      for (const name of ROLES.slice(1)) apis[name] = await server.login(`u-${name}`, PASSWORD);
      for (const name of ROLES) {
        for (const [label, run] of CASES) {
          const res = await run(apis[name], name);
          out[`${label} × ${name}`] = `${res.status}${res.status === 200 ? "" : ` ${res.data?.code || ""}`}`.trim();
        }
        for (const [label, make] of OWN) {
          const row = await make(apis[name], name);
          out[`kendi ${label} havalesi: gir × ${name}`] = String(row.created);
          if (row.created !== 200) continue;
          out[`kendi ${label} havalesi: açıklama × ${name}`] = String((await row.note()).status);
          out[`kendi ${label} havalesi: nakde çevir × ${name}`] = String((await row.cash()).status);
          out[`kendi ${label} havalesi: sil × ${name}`] = String((await row.del()).status);
        }
      }
      if (version === CURRENT) {
        const integrity = await apis.admin.get("/api/workspace/ledger/integrity");
        assert.equal(integrity.data.ok, true, `bugün: Mutabakat Testi ${JSON.stringify(integrity.data.failures).slice(0, 500)}`);
      }
    } finally {
      await server.close();
    }
  }

  it("dün: v2.0.26 kodu, kopya veriyle bütün roller", async () => {
    await runSide(OLD, "dun");
    assert.ok(Object.keys(results[OLD]).length >= ROLES.length * (CASES.length + OWN.length));
  });
  it("bugün: 2.1.0 kodu (göç 20 + yetki göçü), aynı kopya veriyle aynı işlemler", async () => {
    await runSide(CURRENT, "bugun");
  });
  it("karşılaştırma: her hücrede aynı durum kodu (dün 200 → bugün 200; dün 403 → bugün 403)", () => {
    const old = results[OLD];
    const now = results[CURRENT];
    assert.deepEqual(Object.keys(now).sort(), Object.keys(old).sort(), "aynı hücreler");
    const diff = Object.keys(old).filter(key => old[key] !== now[key]).map(key => `${key}: dün ${old[key]} → bugün ${now[key]}`);
    const ok200 = Object.values(old).filter(value => value === "200").length;
    console.log(`[dün-bugün] hücre ${Object.keys(old).length}, dün 200 olan ${ok200}, fark ${diff.length}`);
    assert.deepEqual(diff, [], `dün ile bugün farklı:\n${diff.join("\n")}`);
  });
});
