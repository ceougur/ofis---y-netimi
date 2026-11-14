// 2.5.0 Ç5-A tur 3a (tasarım notu docs/erp/C5-ACILIS-TASARIM.md §18.9; BAŞ MİMAR KARARI 13.11 — §18.3 (a)) — kuyruğun GİRDİ KURUCUSU lib/obligation-input.mjs'e TAŞINDI, davranış
// DEĞİŞMEZ. Bu test iki şeyi kalıcı tutar:
//   (1) modül YALNIZ store ile (ayrı, salt okunur bağlantı; servis ağacı yok — defter yükleyicilerinin ve işçilerin kuracağı biçim) kurulunca `buildObligations` çıktısı fatura servisinin
//       dışa açık yüzüyle (invoices.obligationsFor / obligationsOf / allObligations) BAYT BAYT aynıdır — tek cari yolu ve toplu yol, iki şirket, kilitli / kilitsiz, işlem içi okuma;
//   (2) servis yüzünün normalleştirilmiş çıktısı (kimlikler oluşturulma sırasıyla etiket) TAŞIMADAN ÖNCEKİ kodun ürettiği hakem dosyasıyla aynıdır
//       (test/fixtures/obligation-input-250-hakem.json; c5a3a-taban'da `HAKEM_YAZ=<dosya>` ile bu testin kendisi üretti). Hakem davranışın kâhinidir: modüle bilerek konan hata
//       (çek / senet bağını atla, şüpheli kayıtlarını boş ver, bağ zamanını kaydır, kilit çözücü hep açık …) (1)'i bozmaz (iki taraf aynı modülü kullanır) ama (2)'de DEĞERLE yakalanır
//       (test/obligation-input-250-mutasyon.mjs).
// Sınıflar (programın KENDİ API'siyle; ders 17): bağsız / bağlı tahsilat, çek / senet bağı (+ karşılıksız), şüpheli kaydı, taksit kartı (+ kart tahsilatı), faturasız iade (stok), Vade /
// Beklenen Ödeme Tarihi, mahsup, kilitli dönem + kilitten SONRA düzeltmeyle kurulan bağ (cari tahsilatı ve çek), ikinci şirket. Sahte DURAĞAN saat, her yazımda +1 dk (ders 13).
// Tabanda (c5a3a-taban) KIRMIZI: modül yok (içe aktarma hatası) — (2) tabanda yeşildir (hakemi o üretti).
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { buildObligations } from "../server/lib/obligation-queue.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HAKEM = path.join(HERE, "fixtures", "obligation-input-250-hakem.json");
const WRITE = process.env.HAKEM_YAZ || "";
const loaded = await import("../server/lib/obligation-input.mjs").then(module => ({ module }), error => ({ error }));
const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const AUDIT = { id: "test", role: "admin", permissions: [] };
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

// Kararlı serileştirme: Map → [anahtar, değer] anahtar sırasıyla; Set → sıralı; overdue(gün) bugün / −30 / +30; başka işlev "[işlev]"; döngü "[döngü]".
function plain(value, seen = new WeakSet(), key = "") {
  if (typeof value === "function") return key === "overdue" ? { d0: plain(value(TODAY), seen), dm30: plain(value(day(-30)), seen), dp30: plain(value(day(30)), seen) } : "[işlev]";
  if (!value || typeof value !== "object") return value === undefined ? "[tanımsız]" : value;
  if (seen.has(value)) return "[döngü]";
  seen.add(value);
  let result;
  if (value instanceof Map) result = { "[Map]": [...value].map(([k, v]) => [plain(k, seen), plain(v, seen)]).sort((a, b) => (JSON.stringify(a[0]) < JSON.stringify(b[0]) ? -1 : 1)) };
  else if (value instanceof Set) result = { "[Set]": [...value].map(v => JSON.stringify(plain(v, seen))).sort() };
  else if (Array.isArray(value)) result = value.map(v => plain(v, seen));
  else {
    result = {};
    for (const k of Object.keys(value)) result[k] = plain(value[k], seen, k);
  }
  seen.delete(value);
  return result;
}
const text = value => JSON.stringify(plain(value));
const ID_TABLES = ["invoices", "account_entries", "plans", "plan_items", "plan_entries", "cheques", "cheque_events", "doubtful_receivables", "invoice_offsets", "stock_moves", "stock_items"];
// Kimlik → oluşturulma sırasıyla etiket (cari: adı). Etiket kimlik rastgele olsa da iki koşuda aynıdır (aynı senaryo, aynı sıra).
function labeller(store) {
  const map = new Map();
  for (const row of store.all("SELECT id, name FROM accounts ORDER BY rowid")) map.set(row.id, `cari<${row.name}>`);
  for (const table of ID_TABLES) {
    let rows = [];
    try {
      rows = store.all(`SELECT id FROM ${table} ORDER BY rowid`);
    } catch {
      rows = [];
    }
    rows.forEach((row, index) => map.set(String(row.id), `${table}#${index + 1}`));
  }
  const ids = [...map.keys()].filter(id => id.length >= 8).sort((a, b) => b.length - a.length);
  const pattern = ids.length ? new RegExp(ids.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : null;
  // Map / Set sırası etiketlenmiş anahtarla yeniden kurulur (kimlikler rastgele: ham anahtar sırası koşudan koşuya değişir).
  const canon = value => {
    if (Array.isArray(value)) return value.map(canon);
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value["[Map]"])) return { "[Map]": value["[Map]"].map(([k, v]) => [canon(k), canon(v)]).sort((a, b) => (JSON.stringify(a[0]) < JSON.stringify(b[0]) ? -1 : 1)) };
    if (Array.isArray(value["[Set]"])) return { "[Set]": [...value["[Set]"]].sort() };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canon(v)]));
  };
  return json => JSON.stringify(canon(JSON.parse(pattern ? json.replace(pattern, id => map.get(id)) : json)));
}

describe("2.5.0 Ç5-A tur 3a — kuyruğun girdi kurucusu (lib/obligation-input.mjs): yalnız store ile = servis yüzü; davranış taşımadan önceki kodla aynı", () => {
  let server;
  let client;
  let second;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    client = await loginAdmin(server);
  });
  after(async () => server?.close());
  const tick = () => server.clock.advance({ minutes: 1 });
  const scoped = (url, co) => (co ? `${url}${url.includes("?") ? "&" : "?"}hofCompany=${co}` : url);
  const call = async (method, url, body, co) => unwrap(await client[method](scoped(url, co), body));
  const must = async (label, method, url, body, co) => {
    const res = await call(method, url, body, co);
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    tick();
    return res.data;
  };
  let n = 0;
  async function build(co, tag) {
    await call("post", "/api/workspace/bank/setup/dismiss", {}, co);
    await must("negatif kasa", "put", "/api/admin/negative-policy", { cash: "off" }, co);
    const account = name => must(`cari ${name}`, "post", "/api/workspace/accounts", { name: `OI ${tag} ${name}`, type: "customer", registeredOn: day(-400), phone: `0500 253 ${String(10 + (n += 1)).padStart(2, "0")} 00` }, co);
    const item = await must("hizmet", "post", "/api/workspace/stock", { kind: "service", code: `OI-HZM-${tag}`, name: "OI Hizmet", unit: "Adet", salePrice: "100" }, co);
    const sale = async (acc, date, amount, due) => (await must("fatura", "post", "/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate: due } }, co)).id;
    const entry = async (acc, body) => {
      const known = new Set((await must("cari kartı", "get", `/api/workspace/accounts/${acc.id}`, undefined, co)).entries.map(e => e.id));
      return (await must("hareket", "post", `/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, ...body }, co)).entries.find(e => !known.has(e.id));
    };
    const cheque = (acc, amount, extra) => must("evrak", "post", "/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: acc.id, amount: String(amount), issueDate: day(-20), dueDate: day(40), serialNo: `OI${tag}${(n += 1)}`, bank: "Ziraat", ...extra }, co);
    const out = {};
    const v = {};
    // Fatura kronolojisi (seri içinde belge tarihi ileri gider): yazımlar tarihe göre (aynı günde yazıldığı sırayla) TEK kuyrukta koşulur.
    const steps = [];
    const at = (date, fn) => steps.push({ date, i: steps.length, fn });
    // bağsız / bağlı tahsilat
    out.free = await account("Bağsız");
    at(day(-50), () => sale(out.free, day(-50), 300, day(-50)));
    at(day(-40), () => sale(out.free, day(-40), 300, day(-10)));
    at(day(-5), () => entry(out.free, { kind: "in", amount: "400", date: day(-5) }));
    out.bound = await account("Bağlı");
    at(day(-50), () => sale(out.bound, day(-50), 300, day(-50)));
    at(day(-40), async () => { v.bf2 = await sale(out.bound, day(-40), 300, day(-10)); });
    at(day(-5), () => entry(out.bound, { kind: "in", amount: "300", date: day(-5), invoiceId: v.bf2 }));
    // şüpheli kaydı (bağsız tahsilatla)
    out.doubt = await account("Şüpheli");
    at(day(-60), () => sale(out.doubt, day(-60), 1000, day(-60)));
    at(day(-45), () => must("şüpheliye al", "post", `/api/workspace/accounts/${out.doubt.id}/doubtful`, { amount: "1000", date: day(-45), reason: "lawsuit", note: "dava" }, co));
    at(day(-30), () => sale(out.doubt, day(-30), 500, day(-30)));
    at(day(-10), () => entry(out.doubt, { kind: "in", amount: "300", date: day(-10) }));
    // kilitten SONRA düzeltmeyle kurulan bağ (O-1 kalıbı; cari tahsilatı)
    out.lockEdit = await account("Kilit Düzeltme");
    at(day(-50), async () => { out.lf1 = await sale(out.lockEdit, day(-50), 300, day(-50)); });
    at(day(-45), () => entry(out.lockEdit, { kind: "in", amount: "300", date: day(-45) }));
    at(day(-40), () => sale(out.lockEdit, day(-40), 300, day(10)));
    at(day(-35), () => sale(out.lockEdit, day(-35), 300, day(-35)));
    at(day(-5), async () => { out.lp2 = await entry(out.lockEdit, { kind: "in", amount: "300", date: day(-5) }); });
    if (tag !== "001") {
      // 002: kilit SONRADAN (ikinci durumda) konur; bağ kilitten sonra düzeltmeyle kurulur — kilit belleği yazımdan sonra yenilenmeli (anahtar)
      out.lateLock = await account("Kilit Sonra");
      at(day(-50), async () => { out.ll1 = await sale(out.lateLock, day(-50), 300, day(-50)); });
      at(day(-45), () => entry(out.lateLock, { kind: "in", amount: "300", date: day(-45) }));
      at(day(-40), () => sale(out.lateLock, day(-40), 300, day(10)));
      at(day(-35), () => sale(out.lateLock, day(-35), 300, day(-35)));
      at(day(-5), async () => { out.llp2 = await entry(out.lateLock, { kind: "in", amount: "300", date: day(-5) }); });
    } else {
      // çek / senet bağı (Kapatılacak Fatura) + bağsız evrakın karşılıksızı
      out.cheque = await account("Çek");
      at(day(-50), () => sale(out.cheque, day(-50), 300, day(-50)));
      at(day(-40), async () => { v.cf2 = await sale(out.cheque, day(-40), 500, day(-10)); });
      at(day(-20), () => cheque(out.cheque, 500, { invoiceId: v.cf2 }));
      at(day(-15), async () => { v.bounced = await cheque(out.cheque, 200, { issueDate: day(-15) }); });
      at(day(0), () => must("karşılıksız", "post", `/api/workspace/cheques/${v.bounced.id}/actions`, { action: "bounce", date: day(0), method: "cash", cashForce: true }, co));
      // taksit kartı (Yeni Borç) + bağsız cari tahsilatı + kart tahsilatı
      out.card = await account("Kart");
      at(day(-8), async () => { v.plan = await must("kart", "post", "/api/workspace/plans", { name: out.card.name, registeredOn: day(-8), total: "600", accountId: out.card.id, mode: "auto", count: "2", firstDue: day(-5), everyMonths: "1" }, co); });
      at(day(-2), () => entry(out.card, { kind: "in", amount: "400", date: day(-2) }));
      at(day(0), () => must("kart tahsilatı", "post", `/api/workspace/plans/${v.plan.id}/entries`, { kind: "in", amount: "50", date: day(0), method: "cash", cashForce: true }, co));
      // faturasız iade (stoktan veresiye satış + satıştan iade)
      out.ret = await account("İade");
      const goods = await must("ürün", "post", "/api/workspace/stock", { name: "OI Ürün", code: "OI-URN", unit: "Adet", unitPrice: "10", salePrice: "100" }, co);
      at(day(-100), () => must("alım", "post", `/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", unitPrice: "10", pay: "none", date: day(-100) }, co));
      at(day(-20), () => must("veresiye satış", "post", `/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "10", unitPrice: "100", pay: "account", method: "cash", accountId: out.ret.id, date: day(-20) }, co));
      at(day(-5), () => must("faturasız iade", "post", `/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "2", unitPrice: "100", pay: "account", accountId: out.ret.id, date: day(-5) }, co));
      // Vade Tarihi / Beklenen Ödeme Tarihi
      out.due = await account("Vade");
      at(day(-25), () => entry(out.due, { kind: "debt", amount: "200", date: day(-25), dueDate: day(-15) }));
      at(day(-20), () => entry(out.due, { kind: "debt", amount: "500", date: day(-20), dueDate: day(5), expectedDate: day(-3) }));
      // mahsup (karşı belge adı)
      out.offset = await account("Mahsup");
      at(day(-15), async () => {
        const of1 = await sale(out.offset, day(-15), 1000, day(-15));
        const credit = await must("alacak yaz", "post", `/api/workspace/accounts/${out.offset.id}/entries`, { kind: "credit", amount: "300", date: day(-15), note: "İndirim" }, co);
        await must("mahsup", "post", `/api/workspace/invoices/${of1}/offsets`, { counterType: "entry", counterId: credit.entryId, amount: "300", date: day(-15) }, co);
      });
      // kilitten SONRA evrak düzeltmesiyle kurulan çek bağı (ORTA-1 kalıbı)
      out.lockCheque = await account("Kilit Çek");
      at(day(-60), () => sale(out.lockCheque, day(-60), 1000, day(10)));
      at(day(-50), async () => { out.kf2 = await sale(out.lockCheque, day(-50), 500, day(-50)); });
      at(day(-45), () => entry(out.lockCheque, { kind: "in", amount: "500", date: day(-45) }));
      at(day(-35), () => entry(out.lockCheque, { kind: "debt", amount: "300", date: day(-35), dueDate: day(-25) }));
      at(day(-30), async () => { out.kch = await cheque(out.lockCheque, 300, { issueDate: day(-30) }); });
    }
    steps.sort((x, y) => (x.date === y.date ? x.i - y.i : x.date < y.date ? -1 : 1));
    for (const step of steps) await step.fn();
    return out;
  }
  const lock = (co, until) => must(`kilit ${until || "yok"}`, "put", "/api/admin/period-lock", { lockedUntil: until }, co);

  // Bir şirketin bütün carileri: servis yüzü ↔ yalnız store ile kurulan modül; servis yüzünün normalleştirilmiş çıktısı (hakem için).
  function snapshot(target, company, state, digests) {
    const ctx = target.context;
    const inv = ctx.invoices;
    const ids = ctx.store.all("SELECT id, name FROM accounts WHERE deleted_at IS NULL AND name LIKE 'OI %' ORDER BY name");
    assert.ok(ids.length >= 4, `${company}: sınıf carileri (${ids.length})`);
    const ledgerOf = id => ctx.accounts.detail(id, AUDIT, { withRemaining: false }).ledger;
    const norm = labeller(ctx.store);
    // tek cari önbellekli yol önce (bütün cariler önbelleği soğukken), sonra bütün cariler
    const single = new Map(ids.map(({ id }) => [id, text(inv.obligationsOf(id, () => ledgerOf(id)))]));
    const all = inv.allObligations();
    for (const { id, name } of ids) {
      const fresh = text(inv.obligationsFor(id, ledgerOf(id)));
      assert.equal(single.get(id), fresh, `${state} ${company} ${name}: obligationsOf (soğuk) = obligationsFor`);
      assert.equal(text(all.get(id)), fresh, `${state} ${company} ${name}: allObligations = obligationsFor`);
      digests[`${state}|${company}|${name}`] = norm(fresh);
    }
    if (WRITE) return;
    assert.ok(!loaded.error, `lib/obligation-input.mjs yüklenemedi (taşıma yok): ${loaded.error?.message}`);
    // (1) modül YALNIZ store ile — ayrı salt okunur bağlantı, servis ağacı yok
    const file = company === "001" ? server.app.config.dbPath : resolveDbPath(server.app.companies.dirsOf(server.app.companies.get(second.id)).dataDir);
    const db = openDatabase(file, { readOnly: true });
    try {
      const store = createStore(db);
      const input = loaded.module.createObligationInput({ store });
      const lines = ctx.accounts.allLedgers({}).lines;
      const tables = input.settleTables();
      const extras = input.obligationExtras();
      for (const { id, name } of ids) {
        const ledger = ledgerOf(id);
        const mine = text(buildObligations(input.withExtras(input.accountSettleInput(id, ledger, TODAY), input.obligationExtras(id), id)));
        assert.equal(mine, text(inv.obligationsFor(id, ledger)), `${state} ${company} ${name}: modül (yalnız store, tek cari) = servis obligationsFor`);
        const batch = text(buildObligations(input.withExtras(input.batchSettleInput(id, lines.get(id) || [], tables, TODAY), extras, id)));
        assert.equal(batch, text(all.get(id)), `${state} ${company} ${name}: modül (yalnız store, toplu) = servis allObligations`);
      }
      // işlem içinde (yazım yanıtı yolu): kilit belleği ne okunur ne yazılır — sonuç aynı
      const probe = ids[0].id;
      const inside = ctx.store.tx(() => text(inv.obligationsFor(probe, ledgerOf(probe))));
      assert.equal(inside, text(inv.obligationsFor(probe, ledgerOf(probe))), `${state} ${company}: işlem içi = işlem dışı`);
    } finally {
      db.close();
    }
  }

  it("sınıf verisi iki şirkette, kilitli ↔ kilitsiz: modül (yalnız store) = servis yüzü; servis yüzü = taşımadan önceki kodun hakemi", { timeout: 300_000 }, async () => {
    const created = await must("ikinci şirket", "post", "/api/companies", { name: "OI İkinci Şirket" });
    second = created.company;
    const one = await build("", "001");
    const two = await build(second.id, "002");
    // 001 kilitli (−40); kilitten SONRA: cari tahsilatı düzeltmeyle F1'e bağlanır, bağsız çek düzeltmeyle F2'ye bağlanır. 002 kilitsiz.
    await lock("", day(-40));
    await must("düzeltmeyle bağ", "put", `/api/workspace/accounts/${one.lockEdit.id}/entries/${one.lp2.id}`, { invoiceId: one.lf1, cashForce: true });
    await must("çek bağı", "put", `/api/workspace/cheques/${one.kch.id}`, { invoiceId: one.kf2 });
    await must("002 düzeltmeyle bağ", "put", `/api/workspace/accounts/${two.lockEdit.id}/entries/${two.lp2.id}`, { invoiceId: two.lf1, cashForce: true }, second.id);
    const child = () => server.app.openCompany(second.id);
    assert.ok(child(), "002 açık");
    const digests = {};
    snapshot(server.app, "001", "kilitli", digests);
    snapshot(child(), "002", "kilitli", digests);
    // 001'in kilidi kalkar, 002 kilitlenir: kilit belleği şirketler arasında sızmaz; kilit değişince anahtar yenilenir
    await lock("", "");
    await lock(second.id, day(-40));
    await must("002 kilitten sonra düzeltmeyle bağ", "put", `/api/workspace/accounts/${two.lateLock.id}/entries/${two.llp2.id}`, { invoiceId: two.ll1, cashForce: true }, second.id);
    snapshot(server.app, "001", "kilit-degisti", digests);
    snapshot(child(), "002", "kilit-degisti", digests);
    if (WRITE) {
      writeFileSync(WRITE, `${JSON.stringify({ uretim: "c5a3a-taban — taşımadan önceki kod; HAKEM_YAZ ile bu testin kendisi", sayi: Object.keys(digests).length, cariler: digests }, null, 1)}\n`);
      return;
    }
    // (2) hakem: taşımadan önceki kodun aynı senaryodaki çıktısı
    const hakem = JSON.parse(readFileSync(HAKEM, "utf8"));
    assert.deepEqual(Object.keys(digests).sort(), Object.keys(hakem.cariler).sort(), "aynı sınıf carileri ve durumlar");
    const differ = Object.keys(digests).filter(key => digests[key] !== hakem.cariler[key]);
    assert.deepEqual(differ, [], `hakemden farklı çıktı (taşıma davranışı değiştirdi): ${differ.slice(0, 5).join(" · ")}`);
  });
});
