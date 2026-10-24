// 2.4.5 G8 — kapama tek geçiş eşdeğerlik denetimi: ESKİ kod (iki ayrı geçiş: allPaymentStates + allEntryStates) ile YENİ kod (routes/invoices.mjs allSettled)
// AYNI veride AYNI sonucu verir mi — bayt bayt. Ürün koduna dokunmaz; yalnız denetim aracıdır (kanıt docs/kanit/2026-10-24/245-g8-tek-gecis).
//
//   HUKUK_LICENSE_URL=http://127.0.0.1:9 node --disable-warning=ExperimentalWarning tools/kapama-tek-gecis-esdegerlik.mjs \
//     --eski <eski kod kökü (ayrı kopya, ders 23)> --kok <çalışma klasörü> [--tohum 1] [--tohumlar 5] [--islem 300]
//
// Her tohumda: (1) veri YENİ kodun kendi API'sinden üretilir — mutabakat motoru (fatura, tahsilat / ödeme, çek / senet, taksit, stok satışı / alımı / iadesi
// açık hesaba, şüpheliye alma + Değersiz Alacak Yaz = D1 olayları), ardından elle Borç / Alacak satırlarının bir kısmına Vade Tarihi / Beklenen Ödeme Tarihi
// (PUT, programın ucu), üç faturasız vadeli cari, iki ek D1 olayı (stok satış iadesi açık hesaba, değersiz yazma); her yanıt okunur (ders 3).
// (2) Veri dört taze kopyaya alınır: {eski, yeni} × {önce fatura durumları, önce elle satırlar}; her kopya kendi kodunun sunucusuyla DURAĞAN aynı sahte
// saatte açılır, iki harita okunur (A), sonra aynı tahsilat yazılır ve yeniden okunur (B, bayatlık). Fatura durumları kimliğe göre sıralı; elle satırlar
// yazım sırasıyla (harita sırası) ve kimliğe göre sıralı ayrı ayrı karşılaştırılır. Yeni tahsilatın kimliği iki kopyada farklıdır (rastgele) → yer tutucu.
// (3) Yeni kodda toplu yol = cari başına yol (her fatura tek başına, her vadeli cari entryStates ile).
// Çıktı: tohum başına özet + sha256'lar; sonda `# tests / pass / fail` (tools/kanit.mjs kos okur). Uyuşmazlıkta çıkış 1 ve ilk farkın yeri.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { addDays, motorNow, rng, runReconciliation } from "../test/mutabakat/motor.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const LICENSE_ENV = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
const NEW_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_ROOT = value("eski", "") && path.resolve(value("eski", ""));
const WORK = value("kok", "") && path.resolve(value("kok", ""));
if (!OLD_ROOT || !WORK) throw new Error("--eski <eski kod kökü> ve --kok <çalışma klasörü> gerekli");
const firstSeed = Number(value("tohum", 1));
const seeds = Number(value("tohumlar", 5));
const operations = Number(value("islem", 300));
const AUDITOR = { id: "kapama-esdegerlik", role: "admin", permissions: [] };
const sha = text => createHash("sha256").update(text).digest("hex");
const log = line => console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
});
const must = async (what, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const helpersOf = async root => import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const byId = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

// (1) Veri: yeni kodun API'sinden.
async function generate(seed, dataDir) {
  const { loginAdmin, startTestServer } = await helpersOf(NEW_ROOT);
  const server = await startTestServer({ dataDir, bankPickLegacy: true, now: motorNow(), env: LICENSE_ENV });
  const counts = { vade: 0, beklenen: 0, vadeRet: 0, vadeliCari: 0, stokIade: 0, degersiz: 0, ekRet: 0 };
  try {
    const client = await loginAdmin(server);
    // verifyEvery 1: motorun modeli Mevcut Borç kartının iadeyle küçülen kapsamını yalnız doğrulamada programdan benimser (motor.mjs verify, "model kapsamı
    // (FIFO) tutmaz"); seyrek doğrulamada model kayar ve taksit tahsilatı tutarı kartı aşıp 409 "beklenmeyen ret" olur (tohum 1, 600 işlem, işlem 538).
    const report = await runReconciliation({ client, seed, operations, verifyEvery: 1, reportEvery: 0, burst: 20, pos: true });
    if (report.mismatches.length) throw new Error(`motor uyuşmazlığı: ${JSON.stringify(report.mismatches[0]).slice(0, 400)}`);
    const api = apiOf(client);
    const R = rng(seed * 7919 + 17);
    const T = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
    const store = server.app.store;
    // Ek elle Borç / Alacak (motor az yazar): carilerin ~%70'ine bir satır, tarih son 120 gün (kilitli dönem reddedilir — sayılır).
    for (const acc of store.all("SELECT id, type FROM accounts WHERE deleted_at IS NULL ORDER BY id")) {
      if (!R.chance(0.7)) continue;
      const res = await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: acc.type === "supplier" ? "credit" : "debt", amount: R.int(100, 3000), date: addDays(T, -R.int(0, 120)), note: "eşdeğerlik" });
      if (res.status === 200) counts.elle = (counts.elle || 0) + 1;
      else counts.elleRet = (counts.elleRet || 0) + 1;
    }
    // Elle Borç / Alacak satırlarının ~%45'ine Vade, onların ~%35'ine Beklenen (programın PUT ucu; kilitli dönem reddedilir — sayılır).
    for (const row of store.all("SELECT id, account_id AS accountId, date FROM account_entries WHERE source = '' AND kind IN ('debt', 'credit') ORDER BY rowid")) {
      if (!R.chance(0.45)) continue;
      const dueDate = addDays(row.date, R.int(0, 90));
      const body = { dueDate, ...(R.chance(0.35) ? { expectedDate: addDays(row.date, R.int(0, 120)) } : {}) };
      const res = await api.put(`/api/workspace/accounts/${row.accountId}/entries/${row.id}`, body);
      if (res.status === 200) {
        counts.vade += 1;
        if (body.expectedDate) counts.beklenen += 1;
      } else counts.vadeRet += 1;
    }
    // Faturası olmayan vadeli cariler (iki harita farklı kümeden okunursa düşerler).
    let payee = null;
    for (let i = 0; i < 3; i++) {
      const acc = await must("vadeli cari", api.post("/api/workspace/accounts", { name: `Vadeli Cari ${seed}-${i + 1}`, type: i === 2 ? "supplier" : "customer", phone: `0532 ${seed} ${i + 1}0 ${100 + i}` }));
      const kind = i === 2 ? "credit" : "debt";
      await must("vadeli satır", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind, amount: 500 + i * 125, date: addDays(T, -40 + i), dueDate: addDays(T, -10 + i * 5), ...(i === 1 ? { expectedDate: addDays(T, 3) } : {}) }));
      await must("vadeli satırın ödemesi", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: i === 2 ? "out" : "in", method: "cash", amount: 150, date: T, cashForce: true }));
      counts.vadeliCari += 1;
      // Bayatlık yazımı bu carinin (faturasız, vadeli borç 500 − 150) tahsilatıdır: elle satır haritası kesin değişir; iki kodda aynı istek.
      if (i === 0) payee = { id: acc.id, kind: "in", date: T };
    }
    // Ek D1 olayları: faturalı bir müşteride stok satış iadesi (açık hesap) ve şüpheliye alma + değersiz yazma.
    const customers = store.all("SELECT DISTINCT i.account_id AS id FROM invoices i JOIN accounts a ON a.id = i.account_id AND a.deleted_at IS NULL WHERE i.kind = 'sale' AND i.status = 'issued' AND a.type = 'customer' ORDER BY i.account_id");
    const item = ((await must("stok", api.get("/api/workspace/stock"))).items || []).filter(row => row.kind !== "service" && Number(row.qty) >= 0).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    if (customers.length && item) {
      const target = customers[R.int(0, customers.length - 1)].id;
      const res = await api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", reason: "return", qty: "2", unitPrice: "75", pay: "account", accountId: target, date: T });
      if (res.status === 200) counts.stokIade += 1;
      else counts.ekRet += 1;
    }
    for (const row of customers.slice(0, 6)) {
      const balance = Number((await must("cari", api.get(`/api/workspace/accounts/${row.id}`))).totals?.balance) || 0;
      if (!(balance > 100)) continue;
      const taken = await api.post(`/api/workspace/accounts/${row.id}/doubtful`, { amount: Math.floor(balance / 2), date: T, reason: "lawsuit", note: "eşdeğerlik" });
      if (taken.status !== 200) {
        counts.ekRet += 1;
        continue;
      }
      const did = taken.data.id || taken.data.record?.id;
      const off = await api.post(`/api/workspace/accounts/${row.id}/doubtful/${did}/write-off`, { amount: Math.floor(balance / 4), date: T, note: "eşdeğerlik" });
      if (off.status === 200) counts.degersiz += 1;
      else counts.ekRet += 1;
      break;
    }
    const shape = {
      cari: store.get("SELECT COUNT(*) AS n FROM accounts").n,
      fatura: store.get("SELECT COUNT(*) AS n FROM invoices").n,
      faturaliCari: store.get("SELECT COUNT(DISTINCT account_id) AS n FROM invoices").n,
      vadeliCariSayisi: store.get("SELECT COUNT(DISTINCT account_id) AS n FROM account_entries WHERE source = '' AND kind IN ('debt', 'credit') AND (due_date <> '' OR expected_date <> '')").n,
      degersizSatir: store.get("SELECT COUNT(*) AS n FROM account_entries WHERE source = 'doubtful'").n,
      stokIadeSatir: store.get("SELECT COUNT(*) AS n FROM account_entries e JOIN stock_moves m ON m.id = e.source_id WHERE e.source = 'stock' AND m.reason IN ('return', 'preturn')").n,
      supheli: store.get("SELECT COUNT(*) AS n FROM doubtful_receivables").n,
      cek: store.get("SELECT COUNT(*) AS n FROM cheques").n,
      kart: store.get("SELECT COUNT(*) AS n FROM plans").n,
    };
    return { T, counts, shape, motor: report.byKind, payee };
  } finally {
    await server.close();
  }
}

// (2) Bir kopyayı verilen kodla açıp iki haritayı okur; sonra aynı tahsilatı yazıp yeniden okur.
async function dumpWith(root, dataDir, { time, payFirst, payee, perAccount }) {
  const { loginAdmin, startTestServer } = await helpersOf(root);
  const server = await startTestServer({ dataDir, now: { time, fixed: true }, env: LICENSE_ENV });
  try {
    const inv = server.app.context.invoices;
    const rows = () => server.app.store.all("SELECT id, account_id AS accountId, try_payable AS tryPayable FROM invoices ORDER BY id");
    const read = () => {
      const pay = () => [...inv.paymentStates(rows())].sort(byId);
      const entries = () => [...inv.allEntryStates()];
      let p;
      let e;
      if (payFirst) {
        p = pay();
        e = entries();
      } else {
        e = entries();
        p = pay();
      }
      return { pay: JSON.stringify(p), entriesRaw: JSON.stringify(e), entries: JSON.stringify([...e].sort(byId)), sizes: [p.length, e.length] };
    };
    const a = read();
    let invariant = null;
    if (perAccount) {
      const one = new Map(rows().map(row => [row.id, JSON.stringify(inv.paymentStates([row]).get(row.id))]));
      const many = new Map(JSON.parse(a.pay).map(([id, state]) => [id, JSON.stringify(state)]));
      const dated = server.app.store.all("SELECT DISTINCT e.account_id AS id FROM account_entries e JOIN accounts c ON c.id = e.account_id AND c.deleted_at IS NULL WHERE e.source = '' AND e.kind IN ('debt', 'credit') AND (e.due_date <> '' OR e.expected_date <> '')").map(row => row.id);
      const each = [];
      for (const id of dated) for (const pair of inv.entryStates(id, server.app.context.accounts.detail(id, AUDITOR, { withRemaining: false }).ledger)) each.push(pair);
      const payDiff = [...one].filter(([id, state]) => many.get(id) !== state).map(([id]) => id);
      invariant = { payDiff, entriesSame: JSON.stringify(each.sort(byId)) === a.entries, invoices: one.size, entries: each.length };
    }
    const api = apiOf(await loginAdmin(server));
    const before = new Set(server.app.store.all("SELECT id FROM account_entries").map(row => row.id));
    await must("tahsilat (bayatlık)", api.post(`/api/workspace/accounts/${payee.id}/entries`, { kind: payee.kind, method: "cash", amount: 37.5, date: payee.date, cashForce: true }));
    const added = server.app.store.all("SELECT id FROM account_entries").map(row => row.id).filter(id => !before.has(id));
    const b = read();
    const mask = text => added.reduce((out, id) => out.split(id).join("<YENI-TAHSILAT>"), text);
    return { a, b: { ...b, pay: mask(b.pay), entriesRaw: mask(b.entriesRaw), entries: mask(b.entries) }, invariant, added: added.length };
  } finally {
    await server.close();
  }
}

const results = [];
let failures = 0;
mkdirSync(WORK, { recursive: true });
for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
  const base = path.join(WORK, `tohum-${seed}`);
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  const source = path.join(base, "veri");
  const started = performance.now();
  const made = await generate(seed, source);
  const time = `${made.T}T17:00:00+03:00`;
  const { payee } = made;
  const runs = {};
  for (const [code, root] of [["eski", OLD_ROOT], ["yeni", NEW_ROOT]]) {
    for (const payFirst of [true, false]) {
      const name = `${code}-${payFirst ? "fatura-once" : "elle-once"}`;
      const dir = path.join(base, name);
      cpSync(source, dir, { recursive: true });
      runs[name] = await dumpWith(root, dir, { time, payFirst, payee, perAccount: code === "yeni" && payFirst });
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const problems = [];
  const fields = ["pay", "entries", "entriesRaw"];
  for (const phase of ["a", "b"]) {
    for (const order of ["fatura-once", "elle-once"]) {
      for (const field of fields) {
        const left = runs[`eski-${order}`][phase][field];
        const right = runs[`yeni-${order}`][phase][field];
        if (left !== right) {
          let at = 0;
          while (at < left.length && left[at] === right[at]) at += 1;
          problems.push(`${phase === "a" ? "A (açılış)" : "B (tahsilattan sonra)"} ${order} ${field}: eski ≠ yeni (ilk fark ${at}. karakter: eski "${left.slice(Math.max(0, at - 60), at + 60)}" · yeni "${right.slice(Math.max(0, at - 60), at + 60)}")`);
        }
      }
      if (runs[`yeni-${order}`][phase].pay !== runs["yeni-fatura-once"][phase].pay || runs[`yeni-${order}`][phase].entries !== runs["yeni-fatura-once"][phase].entries) problems.push(`${phase} yeni: çağrı sırası sonucu değiştirdi (${order})`);
    }
  }
  for (const code of ["eski", "yeni"]) if (runs[`${code}-fatura-once`].a.entries === runs[`${code}-fatura-once`].b.entries) problems.push(`B ${code}: tahsilattan sonra elle satır haritası değişmedi (bayatlık sınanamadı)`);
  const inv = runs["yeni-fatura-once"].invariant;
  if (inv.payDiff.length) problems.push(`yeni kod toplu ↔ cari başına: ${inv.payDiff.length} fatura durumu farklı (ilk ${inv.payDiff[0]})`);
  if (!inv.entriesSame) problems.push("yeni kod toplu ↔ cari başına: elle satır haritası farklı");
  const [payCount, entryCount] = runs["yeni-fatura-once"].a.sizes;
  if (!(made.shape.faturaliCari > 8)) problems.push(`faturalı cari ${made.shape.faturaliCari} ≤ 8: paymentStates toplu yolu (allPaymentStates) sınanamadı`);
  if (!(entryCount > 0) || !(payCount > 0)) problems.push(`boş harita (fatura ${payCount}, elle ${entryCount}) — eşdeğerlik sınanamadı`);
  const row = {
    seed,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    shape: made.shape,
    counts: made.counts,
    sizes: { fatura: payCount, elleSatir: entryCount },
    sha: Object.fromEntries(Object.entries(runs).map(([name, run]) => [name, { A: sha(run.a.pay + "\n" + run.a.entriesRaw), B: sha(run.b.pay + "\n" + run.b.entriesRaw) }])),
    invariant: { faturalar: inv.invoices, elleSatir: inv.entries, toplu_cariBasina_fatura_farki: inv.payDiff.length, elle_ayni: inv.entriesSame },
    problems,
  };
  results.push(row);
  if (problems.length) failures += 1;
  log(`tohum ${seed}: ${problems.length ? "UYUŞMAZLIK" : "AYNI"} · ${JSON.stringify(row.shape)} · vade ${made.counts.vade} (beklenen ${made.counts.beklenen}, ret ${made.counts.vadeRet}) · fatura durumu ${payCount}, elle satır ${entryCount} · ${row.seconds} sn`);
  log(`  sha A eski/yeni ${row.sha["eski-fatura-once"].A.slice(0, 16)} / ${row.sha["yeni-fatura-once"].A.slice(0, 16)} · B ${row.sha["eski-fatura-once"].B.slice(0, 16)} / ${row.sha["yeni-fatura-once"].B.slice(0, 16)}`);
  for (const problem of problems) log(`  ✗ ${problem}`);
  rmSync(base, { recursive: true, force: true });
}
const out = path.join(WORK, "sonuc.json");
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`\nSonuç: ${out}`);
console.log(`# tests ${results.length}\n# pass ${results.length - failures}\n# fail ${failures}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exit(failures ? 1 : 0);
