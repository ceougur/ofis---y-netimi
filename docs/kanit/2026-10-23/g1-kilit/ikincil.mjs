// G1 ikincil bulgu nitelemesi: kilitli döneme kapısız yazımdan (fatura geri yükleme) SONRA kullanıcı ne görür? Üretim ve test kipi.
// Kullanım: node ikincil.mjs <depo kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]);
const { loginAdmin, startTestServer } = await import(pathToFileURL(path.join(root, "test/helpers.mjs")).href);
const { apiOf } = await import(pathToFileURL(path.join(root, "test/banka-210-ortak.mjs")).href);
const TODAY = "2026-10-08";
const LINE = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const short = r => [r.status, r.code || "", String(r.error || r.data?.message || "").slice(0, 150)];
const out = {};
for (const [mode, opts] of [["uretim", { gateVerify: false, moneyStrict: false }], ["test", { gateVerify: true }]]) {
  const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...opts });
  try {
    const api = apiOf(await loginAdmin(server));
    const acc = (await api.post("/api/workspace/accounts", { name: "İkincil", type: "customer", registeredOn: "2026-01-01" })).data;
    const doc = (await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-15", lines: LINE, payment: { rest: "open" }, force: true })).data;
    await api.del(`/api/workspace/invoices/${doc.id}?reason=x&force=1&cashForce=1`);
    await api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" });
    const item = (await api.get("/api/admin/trash")).data.find(t => t.kind === "invoice");
    const r = {};
    r.geriYukleme = short(await api.post("/api/admin/trash/restore", { id: item.id }));
    r.mutabakat = (await api.get("/api/workspace/ledger/integrity")).data.failures?.map(f => f.code) || [];
    r.kasaGirisi = short(await api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "x" }));
    r.pesinSatis = short(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: TODAY, lines: LINE, payment: { cash: [{ amount: 600, method: "cash" }], rest: "open" }, force: true, cashForce: true }));
    r.cariTahsilat = short(await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "20", date: TODAY, method: "cash" }));
    r.kapiYolu = server.app.integrity.stats().gate;
    // Tam kapıya giden bir işlem (store dışı yazım sayacı → tam kapı; POS'lu/stoklu satışın 2.4.3 verisinde düştüğü yol): kullanıcı ne görür?
    server.app.db.prepare("UPDATE settings SET value = value WHERE rowid = (SELECT MIN(rowid) FROM settings)").run();
    r.tamKapiKasa = short(await api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "tam" }));
    r.tamKapiYolu = [server.app.integrity.stats().gate.path, server.app.integrity.stats().gate.reason];
    r.kilitDegisti = short(await api.put("/api/admin/period-lock", { lockedUntil: "2026-09-29" }));
    r.sonraKasa = short(await api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "y" }));
    r.sonraMutabakat = (await api.get("/api/workspace/ledger/integrity")).data.failures?.map(f => f.code) || [];
    out[mode] = r;
  } finally {
    await server.close();
  }
}
console.log(JSON.stringify(out, null, 1));
