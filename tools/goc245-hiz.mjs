// 2.4.5 G8 — Tahsilat Takvimi (GET /api/workspace/dues) hız ölçümü: 2.4.4 (git etiketi v2.4.4 = d2cef7c ürün kodu) ile 2.4.5 adayı AYNI veride.
// Ürün koduna dokunmaz; yalnız ölçüm aracıdır. Ders 15: ölçümler tek tek (çağıran flock altında koşar), her ölçüm taze veri kopyasında.
//
//   node --disable-warning=ExperimentalWarning tools/goc245-hiz.mjs veri  --kok <klasör> [--tohum 5] [--fatura 10000] [--cari 2000] [--borc 4000]
//   node --disable-warning=ExperimentalWarning tools/goc245-hiz.mjs vade  --kok <klasör>      (2.4.5 açılır → göç v33 → elle borçların ~yarısına Vade / Beklenen)
//   node --disable-warning=ExperimentalWarning tools/goc245-hiz.mjs olc   --kok <klasör> [--tekrar 3]
//
// veri: v2.4.4'ün GERÇEK koduyla (test/guvenilirlik/surumler.mjs bootVersion, ayrı kopya), kendi API'sinden, 12 ay, iş günü başına saat akar (sahte saat,
//   ders 13): cari (müşteri + tedarikçi), hizmet satışı (vadeli açık / kısmi peşin / peşin), alış, elle Borç (Borç Yaz) ve cari tahsilatı. Her yanıt okunur
//   (ders 3: 200 dışı yanıt üretimi durdurur).
// vade: 2.4.5 adayı aynı klasörü açar (güncelleyicinin yaptığı gibi; v33 göçü), elle Borç satırlarının ~yarısına Vade Tarihi (kayıt tarihi + 0–90 gün),
//   bunların ~%30'una Beklenen Ödeme Tarihi (PUT /accounts/:id/entries/:entryId; programın kendi ucu). Sonuç = "vadeli" veri (2.4.4 bu kolonları görmez).
// olc: her ölçüm taze kopyada, ayrı açılışta. Değişkenler: A = v2.4.4, B = 2.4.5 (vadeli veri), C = 2.4.5 aynı veri ama Vade / Beklenen kolonları boş
//   (kopyada SQL ile; allEntryStates hiç çağrılmaz → B − C = carinin vadeli kalemlerinin maliyeti). Her değişkende: soğuk (açılıştan sonraki ilk istek, önbellek boş),
//   sıcak (aynı istek ×15, ortanca), "değişmedi" (?since=sürüm ×15), tahsilattan sonraki ilk yanıt (×8: POST tahsilat → GET dues; ortanca ve en çok), yanıt boyu
//   ve kalem sayısı (kaynağa göre). Sunucu aynı süreçte (createApp); süreler istemcinin gördüğü (HTTP, yerel).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClock } from "../server/lib/clock.mjs";
import { rng } from "../test/mutabakat/motor.mjs";
import { FIRST, LAST, SERVICE, SUPPLIER } from "../test/guvenilirlik/adlar.mjs";
import { bootVersion, CURRENT } from "../test/guvenilirlik/surumler.mjs";
import { companyDbFile, readRegistry } from "../test/guvenilirlik/uretici.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const args = process.argv.slice(2);
const step = args[0];
const value = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
if (!value("kok", "")) throw new Error("--kok <klasör> gerekli");
const root = path.resolve(value("kok", ""));
mkdirSync(root, { recursive: true });
const log = line => console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
const pad = v => String(v).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = day => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
const addDays = (day, n) => {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const r2 = v => Math.round(v * 100) / 100;
const median = list => {
  const s = [...list].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const round1 = v => (v === null ? null : Math.round(v * 10) / 10);
const flags = { edocEnabled: true, edocLive: true, esmmEnabled: true };
const manifestFile = path.join(root, "manifest.json");
const summary = (tests, fail, note) => {
  console.log(`# ${note}`);
  console.log(`# tests ${tests}\n# pass ${tests - fail}\n# fail ${fail}\n# cancelled 0\n# skipped 0\n# todo 0`);
};
const must = async (what, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};

if (step === "veri") {
  const seed = Number(value("tohum", 5));
  const r = rng(seed);
  const target = { fatura: Number(value("fatura", 10000)), cari: Number(value("cari", 2000)), borc: Number(value("borc", 4000)), tahsilat: Number(value("tahsilat", 2000)) };
  const endDay = value("gun", iso(new Date()));
  const startDay = addDays(endDay, -365);
  const days = [];
  for (let d = startDay; d <= endDay; d = addDays(d, 1)) if (![0, 6].includes(parse(d).getDay())) days.push(d);
  const base = path.join(root, "veri");
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  const clock = createClock({ time: new Date(Number(startDay.slice(0, 4)), Number(startDay.slice(5, 7)) - 1, Number(startDay.slice(8, 10)), 9, 0, 0), fixed: false });
  const server = await bootVersion("v2.4.4", { dataDir: path.join(base, "data"), backupDir: path.join(base, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, ...flags });
  const started = performance.now();
  const counts = {};
  const bump = k => (counts[k] = (counts[k] || 0) + 1);
  let requests = 0;
  try {
    const api = await server.login();
    const call = async (what, promise) => {
      requests += 1;
      return must(what, promise);
    };
    const customers = [];
    const suppliers = [];
    for (let i = 0; i < target.cari; i += 1) {
      const name = `${r.pick(FIRST)} ${r.pick(LAST)}${i % 7 === 0 ? ` ${i}` : ""}`;
      const made = await call("müşteri", api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: startDay, phone: `05${r.int(30, 59)}${String(r.int(1000000, 9999999))}` }));
      customers.push(made.id || made.account?.id);
      bump("cari-musteri");
    }
    for (let i = 0; i < Math.max(20, Math.round(target.cari / 20)); i += 1) {
      const made = await call("tedarikçi", api.post("/api/workspace/accounts", { name: `${SUPPLIER[i % SUPPLIER.length]} ${i + 1}`, type: "supplier", registeredOn: startDay }));
      suppliers.push(made.id || made.account?.id);
      bump("cari-tedarikci");
    }
    const perDay = { fatura: target.fatura / days.length, borc: target.borc / days.length, tahsilat: target.tahsilat / days.length };
    const quota = { fatura: 0, borc: 0, tahsilat: 0 };
    let purchaseNo = 0;
    for (const [index, day] of days.entries()) {
      clock.set(new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 9, 0, 0));
      const last = index === days.length - 1;
      const take = key => {
        quota[key] += perDay[key];
        const n = last ? Math.max(0, target[key] - (counts[`_${key}`] || 0)) : Math.floor(quota[key]);
        quota[key] -= last ? quota[key] : n;
        counts[`_${key}`] = (counts[`_${key}`] || 0) + n;
        return n;
      };
      for (let k = take("fatura"); k > 0; k -= 1) {
        if (r.next() < 0.88) {
          const lines = Array.from({ length: r.int(1, 3) }, () => ({ name: r.pick(SERVICE), qty: r.int(1, 5), unitPrice: r.int(150, 4500), vatRate: r.pick([20, 20, 10]) }));
          const payable = lines.reduce((s, l) => s + l.qty * l.unitPrice * (1 + l.vatRate / 100), 0);
          const p = r.next();
          const payment = p < 0.55 ? { rest: "open", dueDate: addDays(day, r.int(0, 60)) } : p < 0.75 ? { cash: [{ amount: r2(payable * 0.4), method: "cash" }], rest: "open", dueDate: addDays(day, r.int(5, 45)) } : { cash: [{ amount: r2(payable), method: "cash" }], rest: "open" };
          await call(`satış ${day}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: r.pick(customers), issueDate: day, lines, payment, force: true, cashForce: true }));
          bump(p < 0.55 ? "fatura-satis-vadeli" : p < 0.75 ? "fatura-satis-kismi" : "fatura-satis-pesin");
        } else {
          purchaseNo += 1;
          await call(`alış ${day}`, api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: r.pick(suppliers), number: `ALS${day.slice(0, 4)}${String(purchaseNo).padStart(9, "0")}`, issueDate: day, lines: [{ name: "Ofis Gideri", qty: 1, unitPrice: r.int(300, 6000), vatRate: 20, expenseCode: "rent" }], payment: { rest: "open", dueDate: addDays(day, r.int(10, 40)) }, force: true, cashForce: true }));
          bump("fatura-alis");
        }
      }
      for (let k = take("borc"); k > 0; k -= 1) {
        await call(`borç ${day}`, api.post(`/api/workspace/accounts/${r.pick(customers)}/entries`, { kind: "debt", amount: r.int(200, 9000), date: day, note: `Hizmet bedeli ${r.int(1, 999)}` }));
        bump("elle-borc");
      }
      for (let k = take("tahsilat"); k > 0; k -= 1) {
        await call(`tahsilat ${day}`, api.post(`/api/workspace/accounts/${r.pick(customers)}/entries`, { kind: "in", amount: r.int(100, 5000), date: day, method: "cash", note: "Tahsilat" }));
        bump("cari-tahsilat");
      }
      if (index % 25 === 0) log(`  ${day}: ${JSON.stringify(counts)}`);
    }
  } finally {
    await server.close();
  }
  for (const key of Object.keys(counts)) if (key.startsWith("_")) delete counts[key];
  const manifest = { version: "v2.4.4", commit: server.commit, seed, startDay, endDay, counts, requests, ms: Math.round(performance.now() - started) };
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
  log(`üretildi ${JSON.stringify(counts)}; ${requests} istek, ${(manifest.ms / 1000).toFixed(0)} sn`);
  summary(requests, 0, `v2.4.4 ile ${requests} API isteği, hepsi 200 (200 dışı üretimi durdururdu)`);
} else if (step === "vade") {
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const target = path.join(root, "vadeli");
  rmSync(target, { recursive: true, force: true });
  cpSync(path.join(root, "veri"), target, { recursive: true });
  const day = manifest.endDay;
  const clock = createClock({ time: new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12, 0, 0), fixed: true });
  const r = rng(manifest.seed + 1);
  const server = await bootVersion(CURRENT, { dataDir: path.join(target, "data"), backupDir: path.join(target, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, ...flags, legacyCasePayments: false, legacyTableTransfer: false, moneyStrict: false, gateVerify: false });
  let puts = 0;
  const kinds = { vade: 0, vadeBeklenen: 0 };
  try {
    const api = await server.login();
    const db = new DatabaseSync(companyDbFile(path.join(target, "data"), (readRegistry(path.join(target, "data")) || [{ id: "sirket-001", dir: "" }])[0]), { readOnly: true });
    const rows = db.prepare("SELECT id, account_id AS accountId, date FROM account_entries WHERE source = '' AND kind = 'debt' ORDER BY rowid").all();
    db.close();
    for (const row of rows) {
      if (r.next() >= 0.5) continue;
      const dueDate = addDays(row.date, r.int(0, 90));
      const body = { dueDate };
      if (r.next() < 0.3) body.expectedDate = addDays(dueDate, r.int(0, 20));
      await must("vade", api.put(`/api/workspace/accounts/${row.accountId}/entries/${row.id}`, body));
      puts += 1;
      kinds[body.expectedDate ? "vadeBeklenen" : "vade"] += 1;
    }
    manifest.vade = { debts: rows.length, puts, ...kinds };
  } finally {
    await server.close();
  }
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
  log(`vade verildi: ${JSON.stringify(manifest.vade)}`);
  summary(puts, 0, `${puts} PUT (Vade / Beklenen), hepsi 200`);
} else if (step === "olc") {
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const day = manifest.endDay;
  const repeat = Number(value("tekrar", 3));
  const variants = [
    { id: "A", label: "2.4.4 (v2.4.4), vadeli veri (kolonları görmez)", version: "v2.4.4", source: "vadeli" },
    { id: "B", label: "2.4.5 adayı, vadeli veri", version: CURRENT, source: "vadeli" },
    { id: "C", label: "2.4.5 adayı, aynı veri, Vade / Beklenen boş", version: CURRENT, source: "vadeli", clear: true },
  ].filter(v => value("degisken", "A,B,C").split(",").includes(v.id));
  const results = [];
  for (let round = 1; round <= repeat; round += 1) {
    for (const variant of variants) {
      const dir = path.join(root, `olc-${variant.id}`);
      rmSync(dir, { recursive: true, force: true });
      cpSync(path.join(root, variant.source), dir, { recursive: true });
      if (variant.clear) {
        const db = new DatabaseSync(companyDbFile(path.join(dir, "data"), (readRegistry(path.join(dir, "data")) || [{ id: "sirket-001", dir: "" }])[0]));
        db.exec("UPDATE account_entries SET due_date = '', expected_date = ''");
        db.close();
      }
      const clock = createClock({ time: new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12, 0, 0), fixed: true });
      // Üretim ayarları: surumler.mjs'in güncel koda verdiği test denetimleri (moneyStrict, gateVerify — her yazımda defter doğrulaması) ve legacy* açıklığı kapatılır.
      const extra = variant.version === CURRENT ? { legacyCasePayments: false, legacyTableTransfer: false, legacyTableDues: false, moneyStrict: false, gateVerify: false } : {};
      const bootStart = performance.now();
      const server = await bootVersion(variant.version, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, ...flags, ...extra });
      const bootMs = performance.now() - bootStart;
      try {
        const api = await server.login();
        const timed = async url => {
          const t = performance.now();
          const res = await api.client.raw("GET", url);
          const ms = performance.now() - t;
          if (res.status !== 200) throw new Error(`${variant.id} ${url}: ${res.status}`);
          const body = res.data || {};
          const data = body && "ok" in body ? body.data : body;
          return { ms, bytes: res.buffer.length, data };
        };
        const cold = await timed("/api/workspace/dues");
        const warm = [];
        for (let i = 0; i < 15; i += 1) warm.push((await timed("/api/workspace/dues")).ms);
        const unchanged = [];
        for (let i = 0; i < 15; i += 1) unchanged.push((await timed(`/api/workspace/dues?since=${encodeURIComponent(cold.data.version)}`)).ms);
        // Tahsilattan sonra: vadeli kalemi olan bir carinin (ilk kalem) tahsilatı → ilk GET (önbellek geçersiz) ve ikinci GET (önbellekten).
        const accountItem = cold.data.items.find(item => item.source === "account");
        const accountId = accountItem?.accountId || (await must("cari listesi", api.get("/api/workspace/accounts?limit=1"))).accounts[0].id;
        const afterFirst = [];
        const afterSecond = [];
        const postMs = [];
        for (let i = 0; i < 8; i += 1) {
          const t = performance.now();
          await must("tahsilat", api.post(`/api/workspace/accounts/${accountId}/entries`, { kind: "in", amount: 10, date: day, method: "cash", note: `Ölçüm ${i + 1}` }));
          postMs.push(performance.now() - t);
          afterFirst.push((await timed("/api/workspace/dues")).ms);
          afterSecond.push((await timed("/api/workspace/dues")).ms);
        }
        const bySource = {};
        for (const item of cold.data.items) bySource[item.source || "(tablo)"] = (bySource[item.source || "(tablo)"] || 0) + 1;
        const row = { round, variant: variant.id, label: variant.label, bootMs: round1(bootMs), coldMs: round1(cold.ms), warmMedianMs: round1(median(warm)), warmMaxMs: round1(Math.max(...warm)), unchangedMedianMs: round1(median(unchanged)), afterWriteFirstMedianMs: round1(median(afterFirst)), afterWriteFirstMaxMs: round1(Math.max(...afterFirst)), afterWriteSecondMedianMs: round1(median(afterSecond)), postMedianMs: round1(median(postMs)), bytes: cold.bytes, items: cold.data.items.length, bySource };
        results.push(row);
        log(`${variant.id} tur ${round}: soğuk ${row.coldMs} ms · sıcak ${row.warmMedianMs} · değişmedi ${row.unchangedMedianMs} · tahsilattan sonra ilk ${row.afterWriteFirstMedianMs} (en çok ${row.afterWriteFirstMaxMs}) · ikinci ${row.afterWriteSecondMedianMs} · ${row.items} kalem ${JSON.stringify(bySource)} · ${(row.bytes / 1024).toFixed(0)} KB`);
      } finally {
        await server.close();
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }
  const table = {};
  for (const variant of variants) {
    const rows = results.filter(r => r.variant === variant.id);
    table[variant.id] = { label: variant.label, ...Object.fromEntries(["bootMs", "coldMs", "warmMedianMs", "unchangedMedianMs", "afterWriteFirstMedianMs", "afterWriteFirstMaxMs", "afterWriteSecondMedianMs", "postMedianMs"].map(k => [k, round1(median(rows.map(r => r[k])))])), items: rows[0]?.items, bySource: rows[0]?.bySource, bytes: rows[0]?.bytes };
  }
  const out = { day, manifest, repeat, table, results };
  writeFileSync(path.join(root, "olcum.json"), `${JSON.stringify(out, null, 1)}\n`);
  for (const [id, t] of Object.entries(table)) log(`ÖZET ${id} (${t.label}): soğuk ${t.coldMs} · sıcak ${t.warmMedianMs} · değişmedi ${t.unchangedMedianMs} · tahsilattan sonra ilk ${t.afterWriteFirstMedianMs} (en çok ${t.afterWriteFirstMaxMs}) · ikinci ${t.afterWriteSecondMedianMs} ms · ${t.items} kalem`);
  summary(results.length, 0, `${results.length} ölçüm turu (değişken × tekrar); süreler ölçüm, eşik denetimi değil`);
} else {
  throw new Error(`Bilinmeyen adım: ${step}`);
}
