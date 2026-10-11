// 2.1.0 — Aşama 2, Dilim 1: sunucunun saati tek kaynaktan (config.now; server/lib/clock.mjs). docs/BANKA-MODULU-PLAN.md §12.3
// Aşama 2 "config.now + startTestServer({ now }) + Playwright page.clock eşlemesi". Valör kuyruğu, iş günü, İşlem No yılı ve
// kabul testinin "saat 12.10.2026" adımları sunucunun bugününü değiştirebilmeyi ister. Kural:
//   - İŞ SAATİ (config.now): "bugün" (hareketin varsayılan tarihi, ileri tarih ve dönem kilidi denetimi, mutabakat kapısının
//     bugünü, raporların/ANLIK DURUM'un bugünü, takvim) ve iş kayıtlarının zaman damgaları (created_at, işlem geçmişi, Silinenler,
//     mutabakat günlüğü, fatura saati).
//   - ALTYAPI SAATİ (gerçek saat): oturum süresi, giriş denemesi sınırı, lisans, yedek zamanlayıcı, güncelleyici, günlük, süre
//     ölçümü. Sahte saat ileri alınınca kullanıcı oturumdan düşmez.
//   - Üretimde sahte saat yalnız programdan verilir (createApp({ now })); ortam değişkeni yoktur.
// A13 testi (asama0-226-saat.test.mjs) node:test Date taklidiyle çalışır; gerçek saat yolu her çağrıda Date'i okuduğu için o
// test değişmeden geçer (aynı mekanizma genişletildi, ikinci mekanizma yok).
//
// NASIL BOZARIM (bu testlerin kaynağı):
//   - Sahte gün gerçek günden farklıyken tarihsiz hareket hangi günü alır? (Kasa, kayıt tahsilatı, cari, taksit, stok, çek, fatura)
//   - Saat ileri alınınca: yeni gün ileri tarih sayılmamalı, ertesi gün sayılmalı; mutabakat kapısı aynı bugünü kullanmalı.
//   - Çocuk şirket (002) başka saat mi kullanıyor?
//   - Saat 30 gün ileri: oturum düşüyor mu? (düşmemeli: altyapı gerçek saat)
//   - Sabit / akan saat, tarih-only girdi, bozuk girdi, gerçek saat (taklitle uyum).
//   - İş modüllerine yeni bir `new Date()` / `Date.now()` sızarsa statik tarama kırılır.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";
import { createClock, systemClock } from "../server/lib/clock.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pad = n => String(n).padStart(2, "0");
const localDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const T = "2027-01-04T10:00:00+03:00"; // Pazartesi; gerçek günden (testin koştuğu gün) farklı
const DAY = 86_400_000;
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });

describe("createClock — çalışıyor mu", () => {
  it("gerçek saat: her çağrıda Date'i okur (taklit edilebilir), bugün yerel gün", () => {
    const real = createClock();
    assert.equal(real.isClock, true);
    assert.equal(real.controllable, false);
    assert.ok(Math.abs(real().getTime() - Date.now()) < 1000);
    assert.equal(real.today(), localDay(new Date()));
    assert.equal(typeof real.set, "undefined", "gerçek saat kurulamaz");
    assert.equal(createClock(real), real, "saat paylaşılır (şirketler aynı saati kullanır)");
    assert.equal(systemClock.isClock, true);
    mock.timers.enable({ apis: ["Date"], now: new Date(T).getTime() });
    try {
      assert.equal(real.today(), localDay(new Date(T)), "node:test Date taklidi (A13 testi) gerçek saat yolunda geçerli");
    } finally {
      mock.timers.reset();
    }
  });
  it("sabit sahte saat: set, advance (gün), freeze/resume; ISO damgası", () => {
    const clock = createClock({ time: T, fixed: true });
    assert.equal(clock.controllable, true);
    assert.equal(clock().toISOString(), "2027-01-04T07:00:00.000Z");
    assert.equal(clock.iso(), "2027-01-04T07:00:00.000Z");
    assert.equal(clock.ms(), Date.parse(T));
    assert.equal(clock.today(), localDay(new Date(T)));
    clock.advance({ days: 4 });
    assert.equal(clock.ms(), Date.parse(T) + 4 * DAY);
    clock.advance(30 * 60_000);
    assert.equal(clock.ms(), Date.parse(T) + 4 * DAY + 30 * 60_000);
    clock.set("2026-10-12T09:00:00+03:00");
    assert.equal(clock.iso(), "2026-10-12T06:00:00.000Z");
    assert.equal(clock.isFixed(), true);
  });
  it("akan sahte saat: verilen andan gerçek zamanla ilerler; yalnız tarih verilirse yerel öğlen", async () => {
    const clock = createClock(T);
    assert.equal(clock.isFixed(), false);
    const first = clock.ms();
    assert.ok(first >= Date.parse(T) && first - Date.parse(T) < 1000);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(clock.ms() - first >= 20, "saat akıyor");
    clock.freeze();
    const frozen = clock.ms();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(clock.ms(), frozen);
    clock.resume();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(clock.ms() > frozen);
    const dayOnly = createClock("2026-10-08");
    assert.equal(dayOnly.today(), "2026-10-08");
    assert.equal(dayOnly().getHours(), 12);
    const fromDate = createClock(new Date(T));
    assert.ok(Math.abs(fromDate.ms() - Date.parse(T)) < 1000);
    const fromFn = createClock(() => Date.parse(T));
    assert.equal(fromFn().toISOString(), "2027-01-04T07:00:00.000Z");
    assert.equal(fromFn.controllable, false);
  });
  it("nasıl bozarım: bozuk zaman TypeError; sahte saat dışarıdan dondurulamaz (Date döndürür, kopyası)", () => {
    for (const bad of ["abc", "2026-13-40", Number.NaN, Infinity, {}, { time: "x" }]) assert.throws(() => createClock(bad), TypeError, String(bad));
    const clock = createClock({ time: T, fixed: true });
    assert.throws(() => clock.set("bozuk"), TypeError);
    assert.throws(() => clock.advance("1 gün"), TypeError);
    const value = clock();
    value.setFullYear(1999);
    assert.equal(clock().getFullYear(), 2027, "döndürülen Date değiştirilse de saat değişmez");
  });
});

describe("Sunucu sahte saatle (startTestServer({ now }))", () => {
  let server;
  let api;
  let admin;
  const day0 = localDay(new Date(T));
  before(async () => {
    server = await startTestServer({ now: { time: T, fixed: true } });
    admin = await loginAdmin(server);
    api = {
      get: async url => unwrap(await admin.get(url)),
      post: async (url, body) => unwrap(await admin.post(url, body)),
    };
  });
  after(async () => {
    await server?.close();
  });
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${res.error || JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };

  it("sunucunun saati paylaşılır: server.clock = app.config.now = context.now", () => {
    assert.equal(server.clock, server.app.config.now);
    assert.equal(server.app.context.now, server.app.config.now);
    assert.equal(server.clock.controllable, true);
    assert.equal(server.app.period.today(), day0);
  });

  it("çalışıyor mu: tarihsiz Kasa hareketi, kayıt tahsilatı, cari hareketi, taksit kartı/tahsilatı, stok, çek ve fatura sahte günü alır", async () => {
    const { store } = server.app;
    const cash = await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "70", description: "Danışmanlık" }));
    const cashRow = store.get("SELECT date, created_at AS createdAt FROM cash_entries WHERE id = ?", cash.id);
    assert.equal(cashRow.date, day0);
    assert.equal(cashRow.createdAt, "2027-01-04T07:00:00.000Z", "zaman damgası iş saatinden");
    const audit = store.get("SELECT created_at AS at FROM audit_events WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1", cash.id);
    assert.equal(audit?.at, "2027-01-04T07:00:00.000Z", "işlem geçmişi iş saatinden");

    const payment = await must("kayıt tahsilatı", api.post("/api/workspace/cases/SAAT-1/payments", { amount: "50", caseTitle: "Saat" }));
    assert.equal(store.get("SELECT date FROM payments WHERE id = ?", payment.id).date, day0);

    const account = await must("cari", api.post("/api/workspace/accounts", { name: "Saat Cari", type: "customer" }));
    assert.equal(store.get("SELECT registered_on AS d FROM accounts WHERE id = ?", account.id).d, day0, "cari kayıt tarihi");
    const entry = await must("cari hareketi", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "40", method: "cash" }));
    assert.equal(store.get("SELECT date FROM account_entries WHERE id = ?", entry.entryId).date, day0);

    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "Saat Kart", total: "300", mode: "auto", count: 3, firstDue: day0 }));
    assert.equal(store.get("SELECT registered_on AS d FROM plans WHERE id = ?", plan.id).d, day0, "kartın Kayıt Tarihi");
    const collect = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", method: "cash" }));
    assert.equal(store.get("SELECT date FROM plan_entries WHERE id = ?", collect.entryId).date, day0);

    const stock = await must("stok", api.post("/api/workspace/stock", { name: "Saat Ürün", unit: "Adet", unitPrice: "10", openingQty: "5", openingPay: "none" }));
    assert.equal(store.get("SELECT date FROM stock_moves WHERE item_id = ? ORDER BY created_at LIMIT 1", stock.id).date, day0, "açılış stoku");

    const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "500", dueDate: "2027-03-01", drawer: "Saat Keşideci", serialNo: "SA-1" }));
    assert.equal(store.get("SELECT issue_date AS d FROM cheques WHERE id = ?", cheque.id).d, day0, "alış tarihi");

    const service = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "SHZ", name: "Saat Hizmet", unit: "Adet", salePrice: "1000" }));
    const invoice = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, lines: [{ itemId: service.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }));
    const inv = store.get("SELECT issue_date AS d, issue_time AS t, year FROM invoices WHERE id = ?", invoice.id);
    const at = new Date(T);
    assert.deepEqual({ d: inv.d, t: inv.t, year: inv.year }, { d: day0, t: `${pad(at.getHours())}:${pad(at.getMinutes())}`, year: 2027 }, "fatura tarihi, saati ve yılı");

    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    assert.equal(overview.today, day0, "ANLIK DURUM'un bugünü");
    const integrity = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 400));
  });

  it("nasıl bozarım: sahte günden bir gün sonrası ileri tarih (400); saat ilerleyince o gün girilir, kapı engellemez", async () => {
    const next = localDay(new Date(Date.parse(T) + DAY));
    const future = await api.post("/api/workspace/cash", { kind: "in", amount: "5", date: next, description: "Yarın" });
    assert.equal(future.status, 400);
    assert.equal(future.code, "date-future");
    server.clock.advance({ days: 1 });
    assert.equal(server.app.period.today(), next);
    const ok = await api.post("/api/workspace/cash", { kind: "in", amount: "5", date: next, description: "Artık bugün" });
    assert.equal(ok.status, 200, `${ok.status} ${ok.code} ${ok.error}`);
    const plain = await must("tarihsiz", api.post("/api/workspace/cash", { kind: "out", amount: "1", description: "Tarihsiz" }));
    assert.equal(server.app.store.get("SELECT date FROM cash_entries WHERE id = ?", plain.id).date, next);
    const integrity = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true);
  });

  it("nasıl bozarım: saat 30 gün ileri — oturum düşmez (oturum süresi gerçek saatle), işlem yine sahte günle", async () => {
    server.clock.advance({ days: 30 });
    const me = await admin.get("/api/auth/me");
    assert.equal(me.status, 200, "oturum açık kalmalı");
    const plain = await must("tarihsiz", api.post("/api/workspace/cash", { kind: "in", amount: "2", description: "Otuz gün sonra" }));
    assert.equal(server.app.store.get("SELECT date FROM cash_entries WHERE id = ?", plain.id).date, server.clock.today());
  });

  it("çocuk şirket (002) aynı saati kullanır", async () => {
    const created = await must("şirket", api.post("/api/companies", { name: "Saat İkinci" }));
    const id = created.company?.id;
    assert.ok(id, JSON.stringify(created).slice(0, 200));
    const entry = await must("002 Kasa", api.post(`/api/workspace/cash?hofCompany=${encodeURIComponent(id)}`, { kind: "in", amount: "9", description: "002" }));
    assert.ok(server.app.openCompanyIds().includes(id), "002 açık");
    const list = await must("002 Kasa listesi", api.get(`/api/workspace/cash?hofCompany=${encodeURIComponent(id)}`));
    const row = list.entries.find(item => item.id === entry.id);
    assert.equal(row?.date, server.clock.today(), "002'de tarihsiz hareket aynı sahte günü alır");
    assert.equal(row?.createdAt, server.clock.iso(), "002'nin zaman damgası da aynı saatten");
  });
});

describe("Gerçek saat (now verilmezse) davranış değişmez", () => {
  it("bugün = gerçek yerel gün; app.config.now gerçek saat", async () => {
    const server = await startTestServer();
    try {
      assert.equal(server.clock.controllable, false);
      assert.equal(server.app.period.today(), localDay(new Date()));
      const client = await loginAdmin(server);
      const res = unwrap(await client.post("/api/workspace/cash", { kind: "in", amount: "3", description: "Gerçek" }));
      assert.equal(res.status, 200);
      assert.equal(server.app.store.get("SELECT date FROM cash_entries WHERE id = ?", res.data.id).date, localDay(new Date()));
    } finally {
      await server.close();
    }
  });
});

// Statik tarama: iş modüllerinde saat yalnız context.now (config.now) üzerinden okunur. Altyapı saati gereken satır (süre ölçümü,
// bellek önbelleği süresi) satır sonunda "saat: gerçek" işaretini taşır. Banka dosyaları (server/lib/bank/**, server/routes/bank*.mjs)
// eklendikçe kapsama girer.
const BUSINESS_FILES = [
  "server/lib/period.mjs",
  "server/lib/integrity.mjs",
  "server/lib/audit.mjs",
  "server/lib/trash.mjs",
  "server/lib/minor.mjs",
  "server/lib/business-days.mjs",
  "server/routes/accounts.mjs",
  "server/routes/cash.mjs",
  "server/routes/cheques.mjs",
  "server/routes/companies.mjs",
  "server/routes/dues.mjs",
  "server/routes/invoices.mjs",
  "server/routes/ledger.mjs",
  "server/routes/overview.mjs",
  "server/routes/plan-transfer.mjs",
  "server/routes/plans.mjs",
  "server/routes/report-center.mjs",
  "server/routes/reports.mjs",
  "server/routes/stock.mjs",
  "server/routes/trash.mjs",
  "server/routes/whatsapp.mjs",
  "server/routes/workspace.mjs",
];
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith(".mjs") ? [path.join(dir, entry.name)] : []));
}
export function businessFiles() {
  const bank = [...walk(path.join(ROOT, "server/lib/bank")), ...walk(path.join(ROOT, "server/lib/calendars")), ...readdirSync(path.join(ROOT, "server/routes")).filter(name => /^bank.*\.mjs$/.test(name)).map(name => path.join(ROOT, "server/routes", name))];
  return [...BUSINESS_FILES.map(file => path.join(ROOT, file)), ...bank];
}
export function clockLeaks(source) {
  const out = [];
  source.split("\n").forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, "");
    const marked = /saat: gerçek/.test(line);
    if (/\bnew Date\(\s*\)|\bDate\.now\(\s*\)/.test(code) && !marked) out.push({ line: index + 1, text: line.trim().slice(0, 160) });
    // systemClock (gerçek saat) yalnız içe aktarılır ve context.now yoksa geri düşüş olarak kullanılır (`= systemClock`,
    // `|| systemClock`); iş kodunda doğrudan çağrılırsa sahte saati delip geçer.
    else if (/\bsystemClock\b/.test(code.replace(/^import \{[^}]*\} from [^;]*;/, "").replace(/(=|\|\|)\s*systemClock\b(?![.(])/g, "")) && !marked) out.push({ line: index + 1, text: line.trim().slice(0, 160) });
  });
  return out;
}

describe("Statik tarama: iş modüllerinde saat tek kaynaktan", () => {
  it("tarayıcı kendini sınar: sızıntıyı yakalar, işaretli satırı ve yorumu geçer", () => {
    assert.equal(clockLeaks("const a = new Date();").length, 1);
    assert.equal(clockLeaks("const a = Date.now();").length, 1);
    assert.equal(clockLeaks("const started = Date.now(); // saat: gerçek (süre ölçümü)").length, 0);
    assert.equal(clockLeaks("// new Date() yorumda").length, 0);
    assert.equal(clockLeaks("const d = new Date(value);").length, 0);
    assert.equal(clockLeaks("const d = new Date(Date.UTC(2026, 0, 1));").length, 0);
    assert.equal(clockLeaks("const day = systemClock.today();").length, 1, "gerçek saatin doğrudan kullanımı");
    assert.equal(clockLeaks("export function x(router, { now: clock = systemClock }) {").length, 0);
    assert.equal(clockLeaks("const clock = context.now || systemClock;").length, 0);
    assert.equal(clockLeaks('import { systemClock } from "../lib/clock.mjs";').length, 0);
  });
  it("iş modüllerinde `new Date()` / `Date.now()` yok (yalnız context.now)", () => {
    const leaks = [];
    for (const file of businessFiles()) {
      for (const leak of clockLeaks(readFileSync(file, "utf8"))) leaks.push(`${path.relative(ROOT, file)}:${leak.line}  ${leak.text}`);
    }
    assert.deepEqual(leaks, [], `İş saati dışarıdan okunuyor:\n${leaks.join("\n")}`);
  });
});
