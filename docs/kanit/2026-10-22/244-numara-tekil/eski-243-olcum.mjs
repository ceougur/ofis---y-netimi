// Ölçüm (göç yok): v2.4.3'ün GERÇEK koduyla üretilmiş veride tekrar verilmiş fiş numarası güncel kodda ne olur?
// Kullanım (depo kökünden): HUKUK_LICENSE_URL=http://127.0.0.1:9 node docs/kanit/2026-10-22/244-numara-tekil/eski-243-olcum.mjs <geçici klasör>
// (v2.4.3 etiketi gerekir: git fetch --tags). Gerçek EDM'ye bağlanmaz (sahte EDM).
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const load = rel => import(pathToFileURL(path.join(W, rel)).href);
const { createClock } = await load("server/lib/clock.mjs");
const { resetEdmCaches } = await load("server/lib/einvoice/edm.mjs");
const { OUR_VKN, startMockEdm } = await load("test/einvoice-mock.mjs");
const { CURRENT, bootVersion } = await load("test/guvenilirlik/surumler.mjs");
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const root = mkdtempSync(path.join(process.argv[2], "eski-243-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, edocStatusPollMs: [10, 10] };
const clock = createClock({ time: new Date(2026, 5, 17, 10, 0, 0).getTime(), fixed: true });
resetEdmCaches();
const edm = await startMockEdm();
const ok = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data; };
const log = (...a) => console.log(...a);
const ids = {};
const sale = (api, extra = {}) => ok("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later", ...extra }));
const dump = store => store.all("SELECT number, paper_no AS paperNo, profile, e_status AS e FROM invoices ORDER BY created_at");
const dupes = store => {
  const all = store.all("SELECT number AS n FROM invoices WHERE number LIKE 'FIS%' UNION ALL SELECT paper_no AS n FROM invoices WHERE paper_no LIKE 'FIS%'").map(r => r.n);
  return [...new Set(all.filter((n, i) => all.indexOf(n) !== i))];
};
try {
  const old = await bootVersion("v2.4.3", { ...dirs, now: clock });
  try {
    const api = await old.login();
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await ok("ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    const acc = await ok("cari", api.post("/api/workspace/accounts", PERSON));
    ids.person = acc.id || acc.account?.id;
    const step = async (name, send) => {
      const doc = await sale(api);
      const left = await ok(`${name} bırak`, api.post(`/api/workspace/invoices/${doc.id}/withdraw`, {}));
      let sent = null;
      if (send) sent = await ok(`${name} gönder`, api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
      log(`v2.4.3 ${name}: bırakıldı ${left.number}${sent ? ` → gönderildi ${sent.number} (Kâğıt Fatura No ${sent.paperNo})` : " (seride kaldı)"}`);
      ids[name] = doc.id;
    };
    await step("A", true);
    await step("B", false);
    await step("C", true);
    log("v2.4.3 sonu: tekrar eden fiş numaraları:", JSON.stringify(dupes(old.app.store)));
  } finally {
    await old.close();
  }
  const cur = await bootVersion(CURRENT, { ...dirs, now: clock });
  try {
    const api = await cur.login();
    const store = cur.app.store;
    log("güncel açılış: tekrar eden:", JSON.stringify(dupes(store)), "· ayrılış kaydı:", store.get("SELECT value FROM settings WHERE key = 'invoice.numberFloor'")?.value || "(yok)");
    const s = await ok("ayar oku", api.get("/api/workspace/invoices/settings"));
    log("güncel Fatura Ayarları sıradaki fiş:", s.nextNumbers.paper.number);
    const d = await sale(api);
    const dl = await ok("D bırak", api.post(`/api/workspace/invoices/${d.id}/withdraw`, {}));
    log("güncel D bırakıldı:", dl.number, "· aynı numaralı belgeler:", JSON.stringify(store.all("SELECT number, paper_no AS paperNo FROM invoices WHERE number = ? OR paper_no = ?", dl.number, dl.number)));
    const bs = await ok("B gönder", api.post(`/api/workspace/invoices/${ids.B}/send`, {}));
    log("güncel B (2.4.3'te tekrar verilmiş FIS) gönderildi:", bs.number, "Kâğıt Fatura No", bs.paperNo, "· ayrılış kaydı:", store.get("SELECT value FROM settings WHERE key = 'invoice.numberFloor'")?.value);
    const e = await sale(api);
    log("güncel E bırakıldı:", (await ok("E bırak", api.post(`/api/workspace/invoices/${e.id}/withdraw`, {}))).number);
    const integ = await ok("bütünlük", api.get("/api/workspace/ledger/integrity"));
    log("bütünlük:", integ.ok, "· tekrar eden (son):", JSON.stringify(dupes(store)));
    log("belgeler:", JSON.stringify(dump(store)));
  } finally {
    await cur.close();
  }
} finally {
  await edm.close();
  rmSync(root, { recursive: true, force: true });
}
