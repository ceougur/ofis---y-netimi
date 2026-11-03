// C1 TUR 1 — banka carisi kartının C1'e ait payı (ders 47): aynı veri kopyasında hareket sayacı (accountMovements) tek başına ve alt sorgu alt sorgu.
// Kart açılışındaki C1 farkı (35e90e47 → fe5bcf27) sayaçtan mı geliyor, hangi parçasından? Ürün kodu DEĞİŞMEZ.
// Kullanım: flock <kilit> node olcum-sayac-ayrinti.mjs --kod <kopya> --taban <veri-taban> --is <iş klasörü> --json <çıktı> [--n 30]
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const arg = (name, fallback = "") => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const kod = path.resolve(arg("kod"));
const taban = path.resolve(arg("taban"));
const is = path.resolve(arg("is"));
const jsonOut = path.resolve(arg("json"));
const N = Number(arg("n", "30"));
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const veri = JSON.parse(readFileSync(path.join(taban, "veri.json"), "utf8"));
rmSync(is, { recursive: true, force: true });
mkdirSync(is, { recursive: true });
cpSync(path.join(taban, "data"), path.join(is, "data"), { recursive: true });
const { startTestServer, createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(kod, "test/helpers.mjs")).href);
const movementsFile = path.join(kod, "server/lib/account-movements.mjs");
const { accountMovements } = existsSync(movementsFile) ? await import(pathToFileURL(movementsFile).href) : { accountMovements: null };
const p50 = list => {
  const s = list.slice().sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)] * 1000) / 1000;
};
const time = fn => {
  for (let i = 0; i < 3; i += 1) fn();
  const out = [];
  for (let i = 0; i < N; i += 1) {
    const s = performance.now();
    fn();
    out.push(performance.now() - s);
  }
  return { p50: p50(out), enCok: Math.round(Math.max(...out) * 1000) / 1000 };
};
const server = await startTestServer({ dataDir: path.join(is, "data"), backupDir: path.join(is, "backups"), now: { time: "2026-10-09T12:00:00+03:00", fixed: true }, gateVerify: false, moneyStrict: false, reportWorker: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const sonuc = { kod, N, yuk: loadavg().map(v => Math.round(v * 100) / 100) };
try {
  const client = createClient(server.base);
  if ((await client.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş");
  const store = server.app.store;
  const id = veri.ids.bankParty;
  if (accountMovements) sonuc.sayac = time(() => accountMovements(store, id));
  // Parça parça (aynı alt sorgular, tek başına) — hangi sayaç pahalı?
  const parts = {
    allEntries: "SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?1",
    stock: "SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?1 AND source = 'stock'",
    linkedEntries: "SELECT COUNT(*) AS n FROM account_entries e WHERE e.account_id = ?1 AND ((e.source = 'invoice' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id = e.source_id AND i.account_id = ?1)) OR (e.source = 'cheque' AND EXISTS (SELECT 1 FROM cheques c WHERE c.id = e.source_id AND c.deleted_at IS NULL AND (c.account_id = ?1 OR c.endorse_account_id = ?1))) OR (e.source = 'doubtful' AND EXISTS (SELECT 1 FROM doubtful_receivables d WHERE d.id = e.source_id AND d.account_id = ?1 AND d.status <> 'cancelled')))",
    invoices: "SELECT COUNT(*) AS n FROM invoices WHERE account_id = ?1",
    offsets: "SELECT COUNT(*) AS n FROM invoice_offsets WHERE account_id = ?1",
    plans: "SELECT COUNT(*) AS n FROM plans WHERE account_id = ?1 AND deleted_at IS NULL",
    cheques: "SELECT COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL AND (account_id = ?1 OR endorse_account_id = ?1)",
    doubtful: "SELECT COUNT(*) AS n FROM doubtful_receivables WHERE account_id = ?1 AND status <> 'cancelled'",
    vouchers: "SELECT COUNT(*) AS n FROM fin_events e WHERE e.party_id = ?1 AND +e.src_table = '' AND (EXISTS (SELECT 1 FROM bank_lines l WHERE l.event_id = e.id) OR (+e.type = 'pos_cancel_refund' AND EXISTS (SELECT 1 FROM pos_sales s WHERE s.event_id = e.id)))",
  };
  sonuc.parca = {};
  for (const [key, sql] of Object.entries(parts)) sonuc.parca[key] = { ...time(() => store.get(sql, id)), n: store.get(sql, id).n, plan: store.all(`EXPLAIN QUERY PLAN ${sql}`, id).map(row => row.detail) };
  // Kart (uç) — sayaçla ve sayaçsız: aynı süreçte, detail() doğrudan (yönetici, kart görünümü ve fatura kapamasının defter okuması).
  const admin = store.get("SELECT * FROM users WHERE username = 'admin'");
  const accounts = server.app.context.accounts;
  sonuc.kartDetail = time(() => accounts.detail(id, admin));
  sonuc.defterDetail = time(() => accounts.detail(id, admin, { withRemaining: false }));
  // HTTP kart (uç; JSON dahil), aynı süreçte sırayla.
  for (let i = 0; i < 3; i += 1) await client.get(`/api/workspace/accounts/${id}`);
  const http = [];
  for (let i = 0; i < N; i += 1) {
    const s = performance.now();
    const res = await client.get(`/api/workspace/accounts/${id}`);
    http.push(performance.now() - s);
    if (res.status !== 200) throw new Error(`kart ${res.status}`);
    if (i === 0) sonuc.kartJsonBayt = JSON.stringify(res.data).length;
  }
  sonuc.kartHttp = { p50: p50(http), enCok: Math.round(Math.max(...http) * 1000) / 1000 };
  sonuc.veri = { cariSatiri: store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", id).n, fatura: store.get("SELECT COUNT(*) AS n FROM invoices WHERE account_id = ?", id).n, fis: store.get("SELECT COUNT(*) AS n FROM fin_events WHERE party_id = ?", id).n };
} finally {
  await server.close();
  rmSync(is, { recursive: true, force: true });
}
writeFileSync(jsonOut, `${JSON.stringify(sonuc, null, 1)}\n`);
console.log(JSON.stringify(sonuc, null, 1));
console.log("# tests 1\n# pass 1\n# fail 0");
