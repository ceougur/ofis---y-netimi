// Tek istek ölçümü (hız düzeltmesi, 11.10.2026; docs/BANKA-MODULU-PLAN.md §3.11 madde 5 bütçesi "Hareketler sayfası ve arama 1.000.000 satırda
// < 1 sn"). Ürün kodu DEĞİŞMEZ; yalnız ölçüm aracıdır.
//
// Ölçek tabanının (tools/olcek-210.mjs --asama veri: 001'de 100.000 + 002'de 12.000 para satırı, programın kendi API'sinden) TAZE KOPYASINDA,
// BOŞ sunucuda (başka istek yok) her uç için ısınma + N ölçüm (ms; en az / ortanca / en çok). Sunucu AYRI süreçte (--kod ile verilen kod
// ağacından: önce = eski kodun `git archive` kopyası, sonra = bu dal). Ölçülenler:
//   - Rapor Merkezi banka raporları (HTTP; banka-bakiye her bankGroup × Bu Yıl / Tüm Zamanlar, banka-hareket her bankAccount seçeneği × her
//     bankMove, banka-masraf, alt-hesap-mizani, banka-pos-hareketleri, kasa-hareketleri);
//   - aynı raporların sunucu içindeki doğrudan build süresi (reportCenter.run, JSON/aktarım yok) ve TAM çıktısının (bütün satırlar, TOPLAM,
//     özet) sha256'sı: önce ↔ sonra karşılaştırması = gerçek 100.000 satırlık veride eşdeğerlik;
//   - Banka Hareketleri listesi (/bank/movements; tüm hesaplar, tek hesap, kart, arama), Cari arama (/accounts/search), Cari listesi
//     (/accounts) — yanıt gövdesinin (imleç hariç) sha256'sı da;
//   - yazımlar (sonda; okumalar iki kodda aynı veride olsun diye): cari tahsilat nakit / havale, cari ödeme nakit, peşin satış faturası,
//     Banka Fişi (masraf), bankalar arası transfer.
// Kullanım (ders 15: flock):
//   flock /tmp/destekofis-olcum.lock node docs/kanit/2026-10-11/hiz-duzeltme/tek-istek.mjs --kod <kod kökü> --kaynak <olcek klasörü> \
//     --etiket once|sonra --json <çıktı.json> [--tekrar 5]
import { fork } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), "..", "..", "..", "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const PASS = "Olcek-210-Yonetici!";
const sha = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);

// ======================================================================== SUNUCU (ayrı süreç) ========================================================================
if (process.env.TEK_ISTEK_SUNUCU) {
  const conf = JSON.parse(process.env.TEK_ISTEK_SUNUCU);
  const { createApp } = await import(pathToFileURL(path.join(conf.kod, "server", "app.mjs")).href);
  const app = createApp({
    dataDir: conf.dataDir,
    backupDir: path.join(path.dirname(conf.dataDir), "backups"),
    logLevel: "silent",
    scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: false,
    moneyStrict: false,
    gateVerify: false,
    integrityScan: false,
    now: { time: conf.now },
  });
  const { port } = await app.listen(0, "127.0.0.1");
  const admin = app.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
  if (app.context.access) {
    app.context.access.attach(admin);
    admin.roleKey = app.context.access.roleKeyOf(admin);
  }
  process.send({ cmd: "ready", port });
  process.on("message", async message => {
    if (message.cmd === "run") {
      try {
        const t0 = performance.now();
        const data = await app.context.reportCenter.run(admin, message.id, new URLSearchParams(message.query));
        const ms = performance.now() - t0;
        process.send({ cmd: "run", ms, hash: sha(data), total: data.total, footer: data.footer, summary: data.summary });
      } catch (error) {
        process.send({ cmd: "run", error: String(error?.message || error) });
      }
    } else if (message.cmd === "close") {
      await app.close();
      process.send({ cmd: "closed" });
      process.exit(0);
    }
  });
} else {
  await main();
}

function startServer(kod, dataDir, now) {
  const child = fork(SELF, [], { env: { ...process.env, TEK_ISTEK_SUNUCU: JSON.stringify({ kod, dataDir, now }) }, stdio: ["ignore", "inherit", "inherit", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
  const waiters = new Map();
  child.on("message", message => {
    const list = waiters.get(message.cmd) || [];
    const next = list.shift();
    if (next) next(message);
  });
  const ask = (cmd, payload = {}) => new Promise(resolve => {
    const reply = cmd === "close" ? "closed" : cmd;
    waiters.set(reply, [...(waiters.get(reply) || []), resolve]);
    child.send({ cmd, ...payload });
  });
  return new Promise((resolve, reject) => {
    waiters.set("ready", [message => resolve({ child, ask, base: `http://127.0.0.1:${message.port}` })]);
    child.once("exit", code => reject(new Error(`sunucu süreci çıktı (${code})`)));
  });
}

function client(base) {
  let cookie = "";
  const request = async (method, url, body) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await response.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: response.status, data, bytes: text.length };
  };
  return { get: url => request("GET", url), post: (url, body) => request("POST", url, body ?? {}) };
}
function unwrap(response) {
  return response.data && typeof response.data === "object" && "ok" in response.data ? response.data.data : response.data;
}
function stats(list) {
  const sorted = list.slice().sort((a, b) => a - b);
  return { min: Math.round(sorted[0]), p50: Math.round(sorted[Math.floor((sorted.length - 1) / 2)]), max: Math.round(sorted.at(-1)) };
}

async function main() {
  const kod = path.resolve(opt("kod", ROOT));
  const kaynak = path.resolve(opt("kaynak", path.join(os.tmpdir(), "destekofis-olcek-210")));
  const label = opt("etiket", "olcum");
  const repeat = Math.max(1, Number(opt("tekrar", "5")));
  const now = opt("simdi", "2026-10-11T12:00:00+03:00");
  const out = opt("json", "");
  const work = path.join(path.dirname(kaynak), `tek-istek-${label}-${process.pid}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(path.join(kaynak, "veri"), work, { recursive: true });
  const t0 = performance.now();
  const server = await startServer(kod, path.join(work, "data"), now);
  const result = { etiket: label, kod, kaynak, simdi: now, tekrar: repeat, acilisMs: Math.round(performance.now() - t0), olcumler: [], yazimlar: [] };
  console.log(`[${label}] sunucu açıldı (${result.acilisMs} ms), kod ${kod}`);
  try {
    const api = client(server.base);
    const login = await api.post("/api/auth/login", { username: "admin", password: PASS });
    if (login.status !== 200) throw new Error(`giriş ${login.status}`);
    const companies = unwrap(await api.get("/api/companies")).companies;
    const c001 = companies.find(company => company.code === "001").id;
    const at = url => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(c001)}`;
    const banks = unwrap(await api.get(at("/api/workspace/bank/accounts?status=all"))).accounts;
    const demand = banks.filter(bank => bank.kind === "demand");
    const card = banks.find(bank => bank.kind === "card");
    const loan = banks.find(bank => bank.kind === "loan");
    const parties = unwrap(await api.get(at("/api/workspace/accounts?status=all&limit=50"))).accounts;
    result.hesaplar = banks.map(bank => `${bank.kind} ${bank.bankName} · ${bank.name}`);

    // Ölçülecek istekler: { ad, url (HTTP), rapor ({ id, query } doğrudan build + tam çıktı özeti) }.
    const reports = [];
    for (const preset of ["thisYear", "all"]) for (const group of ["real", "debt", "unassigned", "all"]) reports.push({ ad: `banka-bakiye ${preset} ${group}`, id: "banka-bakiye", query: { preset, bankGroup: group } });
    const accountChoices = [["tüm", ""], ["vadesiz-1", demand[0]?.id], ["vadesiz-2", demand[1]?.id], ...(card ? [["kart", card.id]] : []), ...(loan ? [["kredi", loan.id]] : []), ["atanmamış", "unassigned"]];
    for (const [name, value] of accountChoices) for (const move of ["", "external", "internal"]) reports.push({ ad: `banka-hareket thisYear ${name} ${move || "hepsi"}`, id: "banka-hareket", query: { preset: "thisYear", bankAccount: value, bankMove: move } });
    for (const [name, value] of accountChoices.slice(0, 2)) reports.push({ ad: `banka-hareket all ${name} hepsi`, id: "banka-hareket", query: { preset: "all", bankAccount: value } });
    reports.push({ ad: "banka-hareket lastMonth vadesiz-1 hepsi", id: "banka-hareket", query: { preset: "lastMonth", bankAccount: demand[0]?.id } });
    reports.push({ ad: "banka-masraf thisYear", id: "banka-masraf", query: { preset: "thisYear" } });
    reports.push({ ad: "alt-hesap-mizani thisYear", id: "alt-hesap-mizani", query: { preset: "thisYear" } });
    reports.push({ ad: "alt-hesap-mizani all", id: "alt-hesap-mizani", query: { preset: "all" } });
    for (const method of ["", "bank", "card"]) reports.push({ ad: `banka-pos-hareketleri thisYear ${method || "hepsi"}`, id: "banka-pos-hareketleri", query: { preset: "thisYear", payMethod: method } });
    reports.push({ ad: "kasa-hareketleri thisYear", id: "kasa-hareketleri", query: { preset: "thisYear" } });

    const name = parties[7]?.name || "Ölçek";
    const lists = [
      { ad: "Banka Hareketleri (tüm hesaplar, 50)", url: "/api/workspace/bank/movements?limit=50" },
      { ad: "Banka Hareketleri (vadesiz-1, 50)", url: `/api/workspace/bank/movements?limit=50&account=${demand[0].id}` },
      ...(card ? [{ ad: "Banka Hareketleri (kart, 50)", url: `/api/workspace/bank/movements?limit=50&account=${card.id}` }] : []),
      { ad: "Banka Hareketleri (arama 'Doldurma')", url: "/api/workspace/bank/movements?limit=50&q=Doldurma" },
      { ad: `Cari arama (2 harf '${name.slice(0, 2)}')`, url: `/api/workspace/accounts/search?q=${encodeURIComponent(name.slice(0, 2))}` },
      { ad: `Cari arama (5 harf '${name.slice(0, 5)}')`, url: `/api/workspace/accounts/search?q=${encodeURIComponent(name.slice(0, 5))}` },
      { ad: `Cari arama (tam ad)`, url: `/api/workspace/accounts/search?q=${encodeURIComponent(name)}` },
      { ad: "Cari arama (telefon 0532)", url: "/api/workspace/accounts/search?q=0532" },
      { ad: "Cari arama (tedarikçi öne)", url: `/api/workspace/accounts/search?q=${encodeURIComponent(name.slice(0, 3))}&prefer=supplier` },
      { ad: "Cari listesi (300)", url: "/api/workspace/accounts?limit=300" },
      { ad: "Banka Genel Bakış", url: "/api/workspace/bank/summary" },
    ];

    for (const report of reports) {
      const query = Object.fromEntries(Object.entries(report.query).filter(([, value]) => value !== undefined && value !== ""));
      const url = at(`/api/workspace/report-center/${report.id}?${new URLSearchParams(query)}`);
      const http = [];
      const direct = [];
      let hash = "";
      let total = null;
      let status = 0;
      let error = "";
      for (let i = 0; i <= repeat; i += 1) {
        const s = performance.now();
        const response = await api.get(url);
        const ms = performance.now() - s;
        status = response.status;
        if (i) http.push(ms);
        const run = await server.ask("run", { id: report.id, query });
        if (run.error) error = run.error;
        else {
          if (i) direct.push(run.ms);
          hash = run.hash;
          total = run.total;
        }
      }
      const item = { ad: report.ad, tur: "rapor", durum: status, http: stats(http), build: direct.length ? stats(direct) : null, satir: total, ozet: hash, hata: error || undefined };
      result.olcumler.push(item);
      console.log(`[${label}] ${item.ad.padEnd(48)} HTTP p50 ${String(item.http.p50).padStart(6)} ms · build p50 ${String(item.build?.p50 ?? "-").padStart(6)} ms · ${total} satır · ${hash}${error ? ` · HATA ${error}` : ""}`);
    }
    for (const item of lists) {
      const times = [];
      let hash = "";
      let status = 0;
      let count = null;
      for (let i = 0; i <= repeat; i += 1) {
        const s = performance.now();
        const response = await api.get(at(item.url));
        const ms = performance.now() - s;
        status = response.status;
        if (i) times.push(ms);
        const data = unwrap(response);
        const body = Array.isArray(data) ? data : data && typeof data === "object" ? { ...data, nextCursor: undefined, today: undefined } : data;
        hash = sha(body);
        count = Array.isArray(data) ? data.length : Array.isArray(data?.rows) ? data.rows.length : Array.isArray(data?.accounts) ? data.accounts.length : null;
      }
      const row = { ad: item.ad, tur: "liste", durum: status, http: stats(times), satir: count, ozet: hash };
      result.olcumler.push(row);
      console.log(`[${label}] ${row.ad.padEnd(48)} HTTP p50 ${String(row.http.p50).padStart(6)} ms · ${count} satır · ${hash}`);
    }

    // Yazımlar (sonda): her biri tekrar sayısı kadar, bugünün tarihiyle.
    const today = unwrap(await api.get(at("/api/workspace/ledger/lock"))).today;
    const items = (unwrap(await api.get(at("/api/workspace/stock?limit=50"))).items || []).filter(stockItem => stockItem.kind === "product" && !stockItem.deletedAt);
    const party = () => parties[Math.floor(Math.random() * parties.length)].id;
    const writes = [
      ["Cari tahsilat (nakit)", () => api.post(at(`/api/workspace/accounts/${party()}/entries`), { kind: "in", amount: "1.234,56", method: "cash", date: today, note: "tek-istek", requestId: randomUUID() })],
      ["Cari tahsilat (havale)", () => api.post(at(`/api/workspace/accounts/${party()}/entries`), { kind: "in", amount: "2.345,67", method: "bank", bankAccountId: demand[0].id, date: today, note: "tek-istek", requestId: randomUUID(), similarOk: true })],
      ["Cari ödeme (nakit)", () => api.post(at(`/api/workspace/accounts/${party()}/entries`), { kind: "out", amount: "123,45", method: "cash", date: today, note: "tek-istek", requestId: randomUUID() })],
      ...(items.length ? [["Satış faturası (peşin nakit)", () => api.post(at("/api/workspace/invoices"), { kind: "sale", accountId: party(), issueDate: today, note: "tek-istek", lines: [{ itemId: items[0].id, name: "", qty: 1, unitPrice: 50, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 60, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true, requestId: randomUUID() })]] : []),
      ["Banka Fişi (masraf)", () => api.post(at("/api/workspace/bank/vouchers"), { type: "fee", accountId: demand[0].id, date: today, amount: "12,34", feeType: "eft", tax: "bsmv_incl", description: "tek-istek", similarOk: true, requestId: randomUUID() })],
      ["Bankalar arası transfer", () => api.post(at("/api/workspace/bank/transfers"), { accountId: demand[0].id, toAccountId: demand[1].id, amount: "100", date: today, description: "tek-istek", similarOk: true, requestId: randomUUID() })],
    ];
    for (const [kind, call] of writes) {
      const times = [];
      const statuses = {};
      for (let i = 0; i <= repeat; i += 1) {
        const s = performance.now();
        const response = await call();
        const ms = performance.now() - s;
        statuses[response.status] = (statuses[response.status] || 0) + 1;
        if (i) times.push(ms);
      }
      const row = { ad: kind, tur: "yazim", http: stats(times), durum: statuses };
      result.yazimlar.push(row);
      console.log(`[${label}] ${kind.padEnd(48)} p50 ${String(row.http.p50).padStart(6)} ms · ${JSON.stringify(statuses)}`);
    }
  } finally {
    await server.ask("close");
    rmSync(work, { recursive: true, force: true });
  }
  if (out) {
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(out, JSON.stringify(result, null, 1));
  }
}
