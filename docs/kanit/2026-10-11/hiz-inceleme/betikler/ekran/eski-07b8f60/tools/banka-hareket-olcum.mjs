// Banka Hareketleri ölçümü (v2.1.0 Aşama 4; docs/BANKA-MODULU-PLAN.md §8.6 "1.000.000 harekette liste ve arama < 1 sn", §12.5).
//
// Veri programın KENDİ ürettiği veridir: önce gerçek sunucu (bu dalın kodu) gerçek HTTP API'si üzerinden tohumu yazar — banka hesapları
// (açılış 03.01.2022), 360 günlük Banka Fişleri (masraf BSMV'li, diğer gelir, kart borcu ödemesi, faiz geliri, Ters Kaydet) ve cari havale
// tahsilatları (Bu Hesaba Ata ile hesaba bağlı). Hacim, tohumun işlem başlıkları, fiş satırları ve hesaba bağlı cari satırlarının satır satır
// kopyalanmasıyla büyütülür (her kopya kendi kimlikleri ve İşlem No'larıyla; tarihleri 0–3 yıl geriye kaydırılır). En eski güne tek bir
// "nadir" fiş (yalnız onda geçen açıklama) API'den eklenir: aramanın en kötü durumu (bütün dizin taranır).
//
// Ölçüm (HTTP, her biri --tekrar kez; ortanca ve en çok): Hareketler ilk sayfa (yürüyen bakiyeli), 2. ve 20. sayfa (imleçle), Masraf süzgeci,
// yön süzgeci, tüm hesaplar, arama (sık geçen sözcük, nadir sözcük, İşlem No), Planlı görünüm, İşlem Kartı (fiş ve cari satırı), Banka Masraf
// Raporu (bir ay; Excel), hesap kartı; bir Banka Fişi kaydı (kapı dahil) ve kayıttan hemen sonra ilk sayfa, hesap kartı ve arama (hesap bakiyesi
// her yeni kayıtta bir kez yeniden okunur).
//
// GG2 (Aşama 3–4 bağımsız gözden geçirme): Banka penceresinin öbür uçları da ölçülür (Genel Bakış, rozet, Hesaplar, Hesabı Atanmamış, Alt Hesap
// Mizanı, sihirbaz önizlemesi, bir yıllık Masraf Raporu; kayıttan hemen sonra Genel Bakış ve Hesaplar) ve ağır istek sürerken başka bir
// kullanıcının isteğinin bekleme süresi (sunucu tek iş parçacığında: uzun istek herkesi bekletir).
//
// Kullanım: node tools/banka-hareket-olcum.mjs --hedef 1000000 [--klasor <dir>] [--tekrar 5] [--json <dosya>] [--yeniden] [--tohum-yeniden]
//           [--gun 360] (tohumun gün sayısı; npm test'teki küçük koşu az günle)
import { fork } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const flag = name => argv.includes(`--${name}`);
const TARGET = Number(opt("hedef", "1000000")) || 1_000_000;
const DIR = path.resolve(opt("klasor", path.join(os.tmpdir(), "destekofis-hareket-olcum")));
const REPEAT = Number(opt("tekrar", "5")) || 5;
const JSON_OUT = opt("json", "");
const SEED_DAYS = Math.max(10, Number(opt("gun", "360")) || 360);
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = NOW.slice(0, 10);
const OPENING = "2022-01-03";
const PASS = "Hareket-Olcum-2026!";
const BANK = "/api/workspace/bank";
const RARE = "TEK-KAYIT-OLCUM";
const log = (...items) => console.log(...items);
const ms = value => (value === null || value === undefined ? "—" : value >= 100 ? String(Math.round(value)) : value.toFixed(1));

const addDays = (iso, days) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}${iso.slice(10)}`;
};
const median = list => {
  const sorted = list.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};

async function loadCode() {
  const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
  const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
  return { createApp, createClient };
}
const appOptions = dataDir => ({
  dataDir,
  backupDir: path.join(path.dirname(dataDir), "backups"),
  logLevel: "silent",
  scheduleBackups: false,
  // Tohumun cari havaleleri eski sürümün hesabı atanmamış hareketleri gibi yazılır, sonra "Bu Hesaba Ata" ile bağlanır (2.1.0 Aşama 5–6).
  bankPickLegacy: true,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" },
  license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false,
  integrityScan: false,
  analysisWorker: false,
  now: NOW,
  moneyStrict: false,
  gateVerify: false,
});
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
async function must(label, promise) {
  const response = await promise;
  if (response.status !== 200) throw new Error(`${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return unwrap(response);
}

// ---------- Tohum: gerçek sunucu, gerçek API ----------
async function buildSeed(seedDir) {
  rmSync(seedDir, { recursive: true, force: true });
  mkdirSync(seedDir, { recursive: true });
  const { createApp, createClient } = await loadCode();
  const app = createApp(appOptions(path.join(seedDir, "data")));
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  const started = performance.now();
  try {
    await must("giriş", client.login("admin", PASS));
    const account = body => must(`hesap ${body.name}`, client.post(`${BANK}/accounts`, body));
    const ziraat = await account({ bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: OPENING, amount: "1.000.000", confirmed: true } });
    const garanti = await account({ bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: OPENING, amount: "500.000", confirmed: true } });
    const card = await account({ bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", opening: { date: OPENING, amount: "0" } });
    const party = await must("cari", client.post("/api/workspace/accounts", { name: "Ölçüm Müşterisi A.Ş.", type: "customer", registeredOn: "2022-01-01" }));
    const voucher = body => must(`fiş ${body.type}`, client.post(`${BANK}/vouchers`, { similarOk: true, ...body }));
    let n = 0;
    for (let day = SEED_DAYS; day >= 1; day -= 1) {
      const date = addDays(TODAY, -day);
      n += 1;
      await voucher({ type: "fee", accountId: ziraat.id, date, amount: `${10 + (n % 50)},${String(n % 100).padStart(2, "0")}`, feeType: n % 3 ? "eft" : "havale", tax: "bsmv_incl", description: `EFT ücreti ${n}`, reference: `DEK-${n}` });
      await voucher({ type: "other_in", accountId: ziraat.id, date, amount: `${100 + n}`, description: n % 10 ? `Diğer gelir ${n}` : `Promosyon ${n}` });
      if (n % 7 === 0) await voucher({ type: "card_payment", accountId: ziraat.id, cardAccountId: card.id, date, amount: `${500 + n}` });
      if (n % 30 === 0) await voucher({ type: "interest_in", accountId: garanti.id, date, amount: `${1000 + n}`, stoppageRate: "15" });
      if (n % 25 === 0) {
        const fee = await voucher({ type: "fee", accountId: ziraat.id, date, amount: "21", feeType: "pos-komisyonu", tax: "bsmv_incl", description: `Ters kaydedilecek ${n}` });
        await must("ters", client.post(`${BANK}/events/${fee.id}/reverse`, {}));
      }
      await must("havale", client.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: `${2000 + n}`, method: "bank", date, note: `Havale ${n}` }));
    }
    const rows = app.store.all("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in' AND fin_ref = ''", party.id);
    await must("ata", client.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: rows.map(row => ({ table: "account_entries", id: row.id })) }));
    const integrity = await must("Mutabakat Testi", client.get("/api/workspace/ledger/integrity"));
    if (!integrity.ok) throw new Error(`tohum tutarsız: ${JSON.stringify(integrity.failures).slice(0, 400)}`);
    const count = app.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE bank_ref = ? OR counter_ref = ?", ziraat.id, ziraat.id).n;
    log(`tohum: ${count} Ziraat olayı (${Math.round((performance.now() - started) / 1000)} sn)`);
    return { ziraat: ziraat.id, garanti: garanti.id, card: card.id, party: party.id };
  } finally {
    await app.close();
  }
}

// ---------- Kopyalama ----------
async function grow(file, accounts, target) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF; PRAGMA foreign_keys = OFF;");
  try {
    const events = db.prepare("SELECT * FROM fin_events WHERE type NOT IN ('opening', 'legacy_assign', 'carry_close') ORDER BY rowid").all();
    const ids = new Set(events.map(row => row.id));
    const lines = db.prepare("SELECT * FROM bank_lines WHERE event_id IN (SELECT value FROM json_each(?)) ORDER BY rowid").all(JSON.stringify([...ids]));
    const entries = db.prepare("SELECT * FROM account_entries WHERE event_id IN (SELECT value FROM json_each(?)) ORDER BY rowid").all(JSON.stringify([...ids]));
    for (const row of [...lines, ...entries]) ids.add(row.id);
    const seedCount = db.prepare("SELECT COUNT(*) AS n FROM fin_events WHERE bank_ref = ? OR counter_ref = ?").get(accounts.ziraat, accounts.ziraat).n;
    const copies = Math.max(0, Math.ceil(target / Math.max(1, seedCount)) - 1);
    const { eventNoText } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "bank", "event-no.mjs")).href);
    const statement = (table, sample) => {
      const columns = Object.keys(sample);
      return { columns, run: db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`) };
    };
    const insert = { fin_events: statement("fin_events", events[0]), bank_lines: statement("bank_lines", lines[0]), account_entries: statement("account_entries", entries[0]) };
    const maxSeq = new Map(db.prepare("SELECT year, MAX(seq) AS seq FROM fin_events GROUP BY year").all().map(row => [row.year, row.seq]));
    // Kimlikler: eski biçim "<önek>-<uuid>" ve olay kimliğinin sıralı biçimi (Aşama 4 dilim 4; lib/bank/event-no.mjs newEventId:
    // "ev-" + 13 hane (zaman + sayaç, 36 tabanı) + "-" + uuid'nin ilk 18 karakteri). GG2: araç yalnız ilkini tanıyordu; yeni kimlikler
    // kopyada değişmediği için ilk kopyada "UNIQUE constraint failed: fin_events.id" ile duruyordu.
    const ID = /\b(?:[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|ev-[0-9a-z]{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4})\b/g;
    const DAY = /^\d{4}-\d{2}-\d{2}/;
    const started = performance.now();
    for (let k = 1; k <= copies; k += 1) {
      const suffix = `~${k}`;
      const shift = -364 * (k % 4);
      const value = item => {
        if (typeof item !== "string") return item;
        let out = item.replace(ID, match => (ids.has(match) ? `${match}${suffix}` : match));
        if (shift && DAY.test(out)) out = addDays(out, shift);
        return out;
      };
      db.exec("BEGIN");
      for (const [table, rows] of [["fin_events", events], ["bank_lines", lines], ["account_entries", entries]]) {
        const { columns, run } = insert[table];
        for (const row of rows) {
          const next = {};
          for (const column of columns) next[column] = value(row[column]);
          if (table === "fin_events") {
            const year = Number(next.date.slice(0, 4));
            const seq = (maxSeq.get(year) || 0) + 1;
            maxSeq.set(year, seq);
            Object.assign(next, { year, seq, no: eventNoText(year, seq), request_key: "" });
            if (next.origin_key) next.origin_key = `${next.origin_key}${suffix}`;
          }
          if (table === "account_entries" && next.receipt_no) next.receipt_no = "";
          run.run(...columns.map(column => next[column] ?? null));
        }
      }
      db.exec("COMMIT");
      if (k % 50 === 0) process.stdout.write(`  kopya ${k}/${copies} (${Math.round((performance.now() - started) / 1000)} sn)\r`);
    }
    for (const [year, seq] of maxSeq) db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(`meta.bank.seq.${year}`, String(seq), new Date(NOW).toISOString());
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const total = db.prepare("SELECT COUNT(*) AS n FROM fin_events WHERE bank_ref = ? OR counter_ref = ?").get(accounts.ziraat, accounts.ziraat).n;
    const all = db.prepare("SELECT COUNT(*) AS n FROM fin_events").get().n;
    return { copies, seedCount, ziraatEvents: total, events: all, lines: db.prepare("SELECT COUNT(*) AS n FROM bank_lines").get().n, seconds: Math.round((performance.now() - started) / 1000) };
  } finally {
    db.close();
  }
}

async function fixture() {
  const seedDir = path.join(DIR, `tohum-${SEED_DAYS}`);
  let accounts;
  if (!existsSync(path.join(seedDir, "hazir.json")) || flag("tohum-yeniden")) {
    accounts = await buildSeed(seedDir);
    writeFileSync(path.join(seedDir, "hazir.json"), JSON.stringify(accounts));
  } else accounts = JSON.parse(readFileSync(path.join(seedDir, "hazir.json"), "utf8"));
  const dir = path.join(DIR, `n-${TARGET}`);
  if (existsSync(path.join(dir, "hazir.json")) && !flag("yeniden")) return { dir, accounts, info: JSON.parse(readFileSync(path.join(dir, "hazir.json"), "utf8")) };
  rmSync(dir, { recursive: true, force: true });
  cpSync(seedDir, dir, { recursive: true });
  const info = await grow(path.join(dir, "data", "destekofis.sqlite"), accounts, TARGET);
  log(`\n  ${TARGET}: Ziraat ${info.ziraatEvents} olay; toplam ${info.events} olay, ${info.lines} fiş satırı (${info.copies} kopya, ${info.seconds} sn)`);
  writeFileSync(path.join(dir, "hazir.json"), JSON.stringify(info, null, 2));
  return { dir, accounts, info };
}

// ---------- Ölçüm ----------
async function measure({ dir, accounts, info }) {
  const work = path.join(DIR, "calisma");
  rmSync(work, { recursive: true, force: true });
  cpSync(dir, work, { recursive: true });
  const { createApp, createClient } = await loadCode();
  const openedAt = performance.now();
  const app = createApp(appOptions(path.join(work, "data")));
  const openMs = performance.now() - openedAt;
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  const out = { info, openMs, rows: [] };
  try {
    await must("giriş", client.login("admin", PASS));
    const rare = await must("nadir fiş", client.post(`${BANK}/vouchers`, { type: "other_out", accountId: accounts.ziraat, date: addDays(OPENING, 1), amount: "1,23", description: `${RARE} en eski gün`, similarOk: true }));
    const z = accounts.ziraat;
    const timeIt = async (label, run, check = null) => {
      const times = [];
      let result = null;
      for (let k = 0; k < REPEAT; k += 1) {
        const at = performance.now();
        result = await run();
        times.push(performance.now() - at);
      }
      if (check) check(result);
      out.rows.push({ label, median: median(times), max: Math.max(...times), rows: Array.isArray(result?.rows) ? result.rows.length : null });
      log(`${label.padEnd(56)} ortanca ${ms(median(times)).padStart(6)} ms · en çok ${ms(Math.max(...times)).padStart(6)} ms${Array.isArray(result?.rows) ? ` · ${result.rows.length} satır` : ""}`);
      return result;
    };
    const list = query => must(`hareketler ${query}`, client.get(`${BANK}/movements?${query}`));
    const first = await timeIt("Hareketler ilk sayfa (Ziraat, 50, yürüyen bakiye)", () => list(`account=${z}&limit=50`), page => {
      if (!page.balance || page.rows.length !== 50) throw new Error("ilk sayfa beklenmedik");
    });
    await timeIt("Hareketler 2. sayfa (imleç)", () => list(`account=${z}&limit=50&cursor=${encodeURIComponent(first.nextCursor)}`));
    let cursor = first.nextCursor;
    for (let k = 2; k < 20; k += 1) cursor = (await list(`account=${z}&limit=50&cursor=${encodeURIComponent(cursor)}`)).nextCursor;
    await timeIt("Hareketler 20. sayfa (imleç)", () => list(`account=${z}&limit=50&cursor=${encodeURIComponent(cursor)}`));
    await timeIt("Hareketler en büyük sayfa (200)", () => list(`account=${z}&limit=200`));
    await timeIt("Süzgeç: Masraf (KDV'li ödeme dahil)", () => list(`account=${z}&type=fee&limit=50`));
    await timeIt("Süzgeç: Çıkış", () => list(`account=${z}&dir=out&limit=50`));
    await timeIt("Süzgeç: tarih aralığı (bir ay, 3 yıl önce)", () => list(`account=${z}&from=2023-03-01&to=2023-03-31&limit=50`));
    await timeIt("Tüm hesaplar ilk sayfa", () => list("limit=50"));
    await timeIt("Arama: sık geçen (Promosyon)", () => list(`account=${z}&q=Promosyon&limit=50`));
    await timeIt("Arama: cari adı (ölçüm müşterisi)", () => list(`account=${z}&q=${encodeURIComponent("ölçüm müşterisi")}&limit=50`));
    await timeIt(`Arama: nadir (${RARE}, en eski gün; dizinin tamamı)`, () => list(`account=${z}&q=${RARE}&limit=50`), page => {
      if (page.rows.length !== 1) throw new Error(`nadir arama ${page.rows.length} satır`);
    });
    await timeIt("Arama: nadir, hesap seçilmeden", () => list(`q=${RARE}&limit=50`));
    await timeIt("Arama: İşlem No (tam)", () => list(`q=${rare.no}`));
    await timeIt("Planlı görünüm", () => list(`account=${z}&planned=1`));
    await timeIt("İşlem Kartı (fiş, İşlem No ile)", () => must("kart", client.get(`${BANK}/events/${rare.no}`)));
    const party = app.store.get("SELECT event_id AS id FROM account_entries WHERE fin_ref = ? AND event_id <> '' ORDER BY rowid DESC LIMIT 1", z);
    await timeIt("İşlem Kartı (hesaba bağlı cari satırı, yevmiyesiyle)", () => must("kart", client.get(`${BANK}/events/${party.id}`)));
    await timeIt("Banka Masraf Raporu (bir ay)", () => must("rapor", client.get(`${BANK}/reports/fees?from=2026-09-01&to=2026-09-30`)));
    await timeIt("Banka Masraf Raporu Excel (bir ay)", async () => {
      const res = await client.raw("GET", `${BANK}/reports/fees?from=2026-09-01&to=2026-09-30&format=xlsx`);
      if (res.status !== 200) throw new Error(`Excel ${res.status}`);
      return null;
    });
    await timeIt("Hesap kartı (bakiye)", () => must("hesap", client.get(`${BANK}/accounts/${z}`)));
    await timeIt("Genel Bakış (özet)", () => must("özet", client.get(`${BANK}/summary`)));
    await timeIt("Menü rozeti", () => must("rozet", client.get(`${BANK}/badge`)));
    await timeIt("Hesaplar listesi", () => must("hesaplar", client.get(`${BANK}/accounts`)));
    await timeIt("Hesabı Atanmamış Eski Hareketler", () => must("eski", client.get(`${BANK}/legacy`)));
    await timeIt("Alt Hesap Mizanı (tüm zamanlar)", () => must("alt mizan", client.get(`${BANK}/sub-trial`)));
    await timeIt("Alt Hesap Mizanı (bir ay)", () => must("alt mizan ay", client.get(`${BANK}/sub-trial?from=2026-09-01&to=2026-09-30`)));
    await timeIt("Kurulum Sihirbazı önizlemesi (Garanti)", () => must("sihirbaz", client.post(`${BANK}/setup?dryRun=1`, { accountId: accounts.garanti, carryClose: true, assign: "all" })));
    await timeIt("Banka Masraf Raporu (bir yıl)", () => must("rapor yıl", client.get(`${BANK}/reports/fees?from=2025-10-01&to=2026-09-30`)));
    // Ağır istek sürerken başka kullanıcının en hafif isteği (oturum bilgisi) ne kadar bekliyor? Başka kullanıcı AYRI süreçte
    // (tools/banka-olcum-bekleme.mjs); aynı süreçte ağır istek ölçüm saatini de durdururdu.
    const other = fork(path.join(ROOT, "tools", "banka-olcum-bekleme.mjs"), [`http://127.0.0.1:${port}`, "admin", PASS], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
    const nextMessage = () => new Promise(resolve => other.once("message", resolve));
    await nextMessage();
    const blocked = async (label, heavy) => {
      const times = [];
      for (let k = 0; k < REPEAT; k += 1) {
        const answer = nextMessage();
        other.send("git");
        const pending = heavy();
        const result = await answer;
        await pending;
        if (result.status !== 200) throw new Error(`başka kullanıcı: ${result.status}`);
        times.push(result.ms);
      }
      out.rows.push({ label, median: median(times), max: Math.max(...times), rows: null });
      log(`${label.padEnd(56)} ortanca ${ms(median(times)).padStart(6)} ms · en çok ${ms(Math.max(...times)).padStart(6)} ms`);
    };
    await blocked("Başka kullanıcı bekler: Genel Bakış sürerken", () => must("özet", client.get(`${BANK}/summary`)));
    await blocked("Başka kullanıcı bekler: Alt Hesap Mizanı sürerken", () => must("alt mizan", client.get(`${BANK}/sub-trial`)));
    await blocked("Başka kullanıcı bekler: Masraf Raporu (yıl) sürerken", () => must("rapor yıl", client.get(`${BANK}/reports/fees?from=2025-10-01&to=2026-09-30`)));
    other.send("kapat");
    // Yazımdan sonra: hesabın bakiyesi (tek kaynak, saklanan toplam) her yeni kayıtta bir kez yeniden okunur — ilk sayfa ve hesap kartı bu
    // okumayı öder. Kaydın kendisi (Banka Fişi, kapı dahil) ayrı ölçülür.
    let seq = 0;
    const post = () => must("yeni fiş", client.post(`${BANK}/vouchers`, { type: "other_in", accountId: z, date: TODAY, amount: `${1 + (seq += 1)}`, description: `Ölçüm kaydı ${seq}`, similarOk: true }));
    await timeIt("Banka Fişi kaydet (Ziraat, kapı dahil)", post);
    // Benzer İşlem denetimiyle (similarOk yok): hesabın ±12 günlük olayları taranır; tutar benzersiz (eşleşme yok, 200).
    await timeIt("Banka Fişi kaydet, Benzer İşlem denetimiyle", () => must("yeni fiş (benzer denetimi)", client.post(`${BANK}/vouchers`, { type: "other_in", accountId: z, date: TODAY, amount: `98765,${String((seq += 1) % 100).padStart(2, "0")}`, description: `Ölçüm kaydı ${seq}` })));
    const afterWrite = async (label, run) => {
      const times = [];
      let result = null;
      for (let k = 0; k < REPEAT; k += 1) {
        await post();
        const at = performance.now();
        result = await run();
        times.push(performance.now() - at);
      }
      out.rows.push({ label, median: median(times), max: Math.max(...times), rows: Array.isArray(result?.rows) ? result.rows.length : null });
      log(`${label.padEnd(56)} ortanca ${ms(median(times)).padStart(6)} ms · en çok ${ms(Math.max(...times)).padStart(6)} ms${Array.isArray(result?.rows) ? ` · ${result.rows.length} satır` : ""}`);
    };
    await afterWrite("Kayıttan hemen sonra ilk sayfa (bakiye yeniden)", () => list(`account=${z}&limit=50`));
    await afterWrite("Kayıttan hemen sonra hesap kartı", () => must("hesap", client.get(`${BANK}/accounts/${z}`)));
    await afterWrite("Kayıttan hemen sonra arama (nadir, hesap seçili)", () => list(`account=${z}&q=${RARE}&limit=50`));
    await afterWrite("Kayıttan hemen sonra Genel Bakış", () => must("özet", client.get(`${BANK}/summary`)));
    await afterWrite("Kayıttan hemen sonra Hesaplar listesi", () => must("hesaplar", client.get(`${BANK}/accounts`)));
    await afterWrite("Kayıttan hemen sonra menü rozeti", () => must("rozet", client.get(`${BANK}/badge`)));
  } finally {
    await app.close();
    rmSync(work, { recursive: true, force: true });
  }
  return out;
}

const data = await fixture();
const result = await measure(data);
log(`\naçılış ${ms(result.openMs)} ms · Ziraat ${data.info.ziraatEvents.toLocaleString("tr-TR")} olay · toplam ${data.info.events.toLocaleString("tr-TR")} olay / ${data.info.lines.toLocaleString("tr-TR")} fiş satırı`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(result, null, 2));
