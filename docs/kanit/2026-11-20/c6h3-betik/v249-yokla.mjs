// v2.4.9 yanıt biçimlerini yoklar (yalnız geliştirme; çıktı not defterine). node v249-yokla.mjs <v2.4.9 kökü> <çıktı klasörü>
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, out] = process.argv.slice(2);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const helpers = await import(pathToFileURL(path.join(root, "test/helpers.mjs")).href);
const server = await helpers.startTestServer({ dataDir: path.join(out, "data"), backupDir: path.join(out, "backups"), now: { time: "2026-10-20T12:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = await helpers.loginAdmin(server);
const show = (label, res) => console.log(`== ${label} ${res.status}\n${JSON.stringify(res.data).slice(0, 1500)}`);
show("dismiss", await c.post("/api/workspace/bank/setup/dismiss", {}));
const cust = (await c.post("/api/workspace/accounts", { name: "Müşteri A", type: "customer" })).data.data;
const item = (await c.post("/api/workspace/stock", { name: "Ürün P", unit: "Adet", unitPrice: "50", openingQty: "10", openingDate: "2026-01-10" })).data.data;
show("satış", await c.post("/api/workspace/invoices", { kind: "sale", accountId: cust.id, issueDate: "2026-05-04", lines: [{ itemId: item.id, name: "", qty: 2, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
show("kasa", await c.post("/api/workspace/cash", { kind: "in", amount: "1000", description: "Danışmanlık", date: "2026-02-01" }));
show("banka", await c.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-01-02", amount: "25.000", confirmed: true } }));
show("vergi", await c.post("/api/workspace/tax/payments", { way: "cash", taxType: "vat", amount: "100", date: "2026-03-01", exceedOk: true }));
show("ledger", await c.get("/api/workspace/ledger?to=2026-10-20"));
show("ledger yıl", await c.get("/api/workspace/ledger?from=2026-01-01&to=2026-10-20"));
show("cash", await c.get("/api/workspace/cash?to=2026-10-20"));
show("stock", await c.get("/api/workspace/stock"));
show("accounts", await c.get("/api/workspace/accounts"));
show("rc stok-ozet", await c.get("/api/workspace/report-center/stok-ozet?to=2026-10-20"));
show("rc banka-bakiye", await c.get("/api/workspace/report-center/banka-bakiye?to=2026-10-20"));
await server.close();
