// 2.5.0 TEK ADAY HIZ DÜZELTMESİ (t3hiz; ders 47 / 53 (a); tasarım notu docs/erp/C5-ACILIS-TASARIM.md §19.9) — DAVRANIŞ AYNEN, yalnız süre. Üç düzeltmenin eşdeğerliği kalıcı tutulur:
//   H1 lib/bank/doubtful.mjs linkedShares'in ön denetimi (LINKED_CHEQUE_PARTIES_SQL): evrak bağlı carilerin kümesi ESKİ sorguyla (hakem: aşağıda AYNEN) aynı — bütün cariler listesinde de;
//   H2 lib/obligation-input.mjs accountSettleInput / obligationExtras (tek cari) sorgu planları: girdinin bütün alanları ESKİ gövdeyle (hakem: aşağıda AYNEN) aynı, harita SIRASI dahil;
//   H3 linkedShares'in işlem dışı belleği (LINKED_MEMO_TEST): bellekli ↔ belleksiz çıktı aynı (ayırıcının iki yükleyicisi, cari kartı, Mutabakat Testi); bellek veri durumu değişince
//      (yazım, kapı reddi — geri alınan işlem, store dışı yazım, başka bağlantının yazımı, kilit) ve şirketten şirkete geçmez; kesit belleğinin anahtarı görünümü (açık kalanlar, aynı gün
//      işlenenler) taşır.
// Ayrıca her aşamanın normalleştirilmiş çıktısı (kimlikler oluşturulma sırasıyla etiket) DÜZELTMEDEN ÖNCEKİ kodun (sınama ucu 9c09f18d) ürettiği hakemle aynı
// (test/fixtures/t3hiz-esdegerlik-250-hakem.json; o kodun kopyasında HAKEM_YAZ=<dosya> ile bu testin kendisi üretti) — üç yolun ortak mantığına konan hata (bir carinin payı atlanır …)
// bellekli ↔ belleksiz karşılaştırmasını bozmaz ama hakemde DEĞERLE yakalanır (test/t3hiz-esdegerlik-250-mutasyon.mjs).
// Sınıflar (programın KENDİ API'siyle; ders 17): şüpheli + bağlı nakit / çek, bağsız, aynı gün iki bağlı tahsilat (ders 31), kısmi şüpheli, bağlı tahsilatlı faturanın iptali, yalnız evrak
// bağlı şüpheli carisi, yalnız bağsız evraklı şüpheli carisi, şüphelisiz kalabalık cari (peşinli faturalar, Vade / Beklenen Ödeme Tarihli elle borçlar, bağlı ve bağsız çek), faturayla ciro
// (tedarikçi), kilitli ↔ açık dönem, iki şirket. Sahte DURAĞAN saat, her yazımda +1 dk (ders 13). Tabanda (9c09f18d) KIRMIZI: LINKED_MEMO_TEST / LINKED_CHEQUE_PARTIES_SQL yok.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import * as D from "../server/lib/bank/doubtful.mjs";
import { createObligationInput } from "../server/lib/obligation-input.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
// BEKLENTİ BİLEREK DEĞİŞTİ (2.5.0 İzleyen küçük tur — tasarım docs/erp/C7B-FATURA-TASARIM.md §19.2): kuyruk girdisinin fatura satırları iade belgesinin kesintisini (coverCuts) da taşır — hakem aynı sütunu okur
// (lib/obligation-input.mjs ile AYNI ifade; öbür alanlar ve sıra aynen).
// BEKLENTİ BİLEREK DEĞİŞTİ (2.5.0 İzleyen tur 2 — S241 = A, tasarım §20.1): fatura satırları Düzenle azalış kaydını (editCuts) da taşır — hakem aynı ifadeyi okur.
const COVER_CUTS = "CASE WHEN kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%' THEN json_extract(payment_json, '$.coverCuts') END AS coverCuts, CASE WHEN kind IN ('sale', 'smm') AND status = 'issued' AND payment_json LIKE '%editCuts%' THEN json_extract(payment_json, '$.editCuts') END AS editCuts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HAKEM = path.join(HERE, "fixtures", "t3hiz-esdegerlik-250-hakem.json");
const WRITE = process.env.HAKEM_YAZ || "";
const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

// ---- ESKİ KOD (hakem; 9c09f18d'deki metin AYNEN) ----
const OLD_CHEQUE_PARTIES_SQL = "SELECT DISTINCT j.value AS id FROM json_each(?) j WHERE EXISTS (SELECT 1 FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE ev.invoice_id <> '' AND (c.account_id = j.value OR c.endorse_account_id = j.value OR ev.account_id = j.value))";
const OLD_DATED_ONE_SQL = "SELECT id, account_id AS accountId, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE source = '' AND kind IN ('debt', 'credit') AND (due_date <> '' OR expected_date <> '') AND account_id = ?";
// lib/obligation-input.mjs accountSettleInput (9c09f18d) — offsetLabel / chequeLinks modülün kendisinden (bu düzeltmede değişmediler).
function oldAccountSettleInput(store, input, accountId, ledger, day) {
  const all = store.all(`SELECT id, kind, status, try_payable AS payable, original_id AS originalId, due_date AS dueDate, plan_id AS planId, COALESCE(NULLIF(issued_at, ''), created_at) AS issuedAt, ${COVER_CUTS} FROM invoices WHERE account_id = ?`, accountId);
  const links = new Map();
  for (const entry of store.all("SELECT id, source_id AS invoiceId FROM account_entries WHERE account_id = ? AND source = 'invoice' AND kind IN ('in', 'out')", accountId)) links.set(entry.id, entry.invoiceId);
  const planned = new Set(all.filter(item => item.planId).map(item => item.id));
  for (const entry of store.all("SELECT id, invoice_id AS invoiceId FROM account_entries WHERE account_id = ? AND source IN ('', 'bank') AND invoice_id <> ''", accountId)) if (!planned.has(entry.invoiceId)) links.set(entry.id, entry.invoiceId);
  const chequeEvents = new Map();
  const reversals = new Map();
  input.chequeLinks(store.all("SELECT ev.cheque_id AS chequeId, ev.kind, ev.invoice_id AS invoiceId, ev.effects_json AS effects, c.invoice_id AS own FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE c.account_id = ? OR c.endorse_account_id = ? OR ev.account_id = ? ORDER BY ev.rowid", accountId, accountId, accountId), planned, links, chequeEvents, reversals);
  const offsets = store.all("SELECT id, invoice_id AS invoiceId, counter_type AS counterType, counter_id AS counterId, amount, date, note, created_at AS createdAt FROM invoice_offsets WHERE account_id = ? ORDER BY date, created_at", accountId).map(offset => ({ ...offset, label: input.offsetLabel(offset) }));
  const plansById = new Map();
  for (const invoice of all.filter(item => item.planId)) {
    const plan = store.get("SELECT total FROM plans WHERE id = ? AND deleted_at IS NULL", invoice.planId);
    const schedule = store.all("SELECT due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date", invoice.planId);
    plansById.set(invoice.id, { planTotal: Number(plan?.total) || 0, schedule });
  }
  return { lines: ledger, invoices: all.map(item => ({ ...item, ...(plansById.get(item.id) || {}) })), links, chequeEvents, reversals, offsets, today: day };
}

// SIRALI serileştirme (H2: harita sırası da karşılaştırılır): Map → [anahtar, değer] EKLENME sırasıyla; Set → ekleme sırası; işlev "[işlev]".
function ordered(value) {
  if (typeof value === "function") return "[işlev]";
  if (!value || typeof value !== "object") return value === undefined ? "[tanımsız]" : value;
  if (value instanceof Map) return { "[Map]": [...value].map(([k, v]) => [ordered(k), ordered(v)]) };
  if (value instanceof Set) return { "[Set]": [...value].map(ordered) };
  if (Array.isArray(value)) return value.map(ordered);
  return Object.fromEntries(Object.keys(value).map(k => [k, ordered(value[k])]));
}
// Kararlı serileştirme (hakem; kimlikler rastgele): Map anahtar sırasıyla, Set sıralı (test/obligation-input-250.test.mjs ile aynı kural).
function plain(value, seen = new WeakSet()) {
  if (typeof value === "function") return "[işlev]";
  if (!value || typeof value !== "object") return value === undefined ? "[tanımsız]" : value;
  if (seen.has(value)) return "[döngü]";
  seen.add(value);
  let result;
  if (value instanceof Map) result = { "[Map]": [...value].map(([k, v]) => [plain(k, seen), plain(v, seen)]).sort((a, b) => (JSON.stringify(a[0]) < JSON.stringify(b[0]) ? -1 : 1)) };
  else if (value instanceof Set) result = { "[Set]": [...value].map(v => JSON.stringify(plain(v, seen))).sort() };
  else if (Array.isArray(value)) result = value.map(v => plain(v, seen));
  else {
    result = {};
    // BEKLENTİ BİLEREK DEĞİŞTİ (İzleyen küçük tur §19.2): fatura satırının yeni coverCuts sütunu kesintisi olmayan belgede null — hakem dökümü (o sütundan önce üretildi) bu alanı taşımaz; null
    // değer atlanır, dolu değer dökümde kalır (kesinti varsa fark görünür).
    // İzleyen tur 2 (S241 = A, §20.1): editCuts sütunu da aynı kuralla (kaydı olmayan belgede null — atlanır).
    for (const k of Object.keys(value)) if (!((k === "coverCuts" || k === "editCuts") && value[k] === null)) result[k] = plain(value[k], seen);
  }
  seen.delete(value);
  return result;
}
const ID_TABLES = ["users", "invoices", "account_entries", "plans", "plan_items", "plan_entries", "cheques", "cheque_events", "doubtful_receivables", "doubtful_provisions", "invoice_offsets", "fin_events"];
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
  const canon = value => {
    if (Array.isArray(value)) return value.map(canon);
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value["[Map]"])) return { "[Map]": value["[Map]"].map(([k, v]) => [canon(k), canon(v)]).sort((a, b) => (JSON.stringify(a[0]) < JSON.stringify(b[0]) ? -1 : 1)) };
    if (Array.isArray(value["[Set]"])) return { "[Set]": [...value["[Set]"]].sort() };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canon(v)]));
  };
  return json => JSON.stringify(canon(JSON.parse(pattern ? json.replace(pattern, id => map.get(id)) : json)));
}

describe("2.5.0 TEK ADAY HIZ (t3hiz): şüpheli ↔ kuyruk ayırıcısının ön denetimi, kuyruk girdisinin sorgu planları ve işlem dışı belleği — davranış AYNEN", () => {
  let server;
  let client;
  let second;
  let n = 0;
  const stages = {};
  const hakem = WRITE ? null : JSON.parse(readFileSync(HAKEM, "utf8"));
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    client = await loginAdmin(server);
  });
  after(async () => {
    if (WRITE) writeFileSync(WRITE, `${JSON.stringify(stages, null, 1)}\n`);
    await server?.close();
  });
  const tick = () => server.clock.advance({ minutes: 1 });
  const scoped = (url, co) => (co ? `${url}${url.includes("?") ? "&" : "?"}hofCompany=${co}` : url);
  const call = async (method, url, body, co = "") => {
    tick();
    return unwrap(method === "get" ? await client.get(scoped(url, co)) : await client[method](scoped(url, co), body));
  };
  const must = async (label, method, url, body, co = "") => {
    const res = await call(method, url, body, co);
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const app = co => (co ? server.app.openCompany(co) : server.app);
  const memoOff = value => {
    if (D.LINKED_MEMO_TEST) D.LINKED_MEMO_TEST.off = value;
  };

  // Sınıf verisi (bir şirket): döndürür { ad → kimlik }.
  async function build(co, k) {
    // Tarih imleci: faturalar şirketin serisinde tarih sırasıyla (kronoloji kuralı); her adım imleçten (göreli, ders 13).
    let t = -300;
    const at = (step = 1) => day((t += step));
    const acc = async name => must(`cari ${name}`, "post", "/api/workspace/accounts", { name: `${name} ${k}`, type: name.startsWith("Tedarikçi") ? "supplier" : "customer", registeredOn: day(-400), phone: `0500 418 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }, co);
    const sale = async (a, amount, payment = { rest: "open" }) => (await must("fatura", "post", "/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: at(), lines: [{ name: "Hizmet", qty: 1, unitPrice: String(amount), vatRate: 0 }], payment }, co)).id;
    const cash = (a, amount, extra = {}, date = at()) => must("tahsilat", "post", `/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: String(amount), date, method: "cash", cashForce: true, similarOk: true, ...extra }, co);
    const cheque = (a, amount, invoiceId = "") => must("çek", "post", "/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: `T3H${k}-${(n += 1)}`, amount: String(amount), accountId: a.id, issueDate: at(), dueDate: day(60), ...(invoiceId ? { invoiceId } : {}) }, co);
    const take = (a, amount) => must("şüpheliye al", "post", `/api/workspace/accounts/${a.id}/doubtful`, { amount: String(amount), date: at(), reason: "lawsuit", note: "t3hiz" }, co);
    const ids = {};
    // A — S168 örneği + bağlı nakit / çek + bağsız
    const A = await acc("Şüpheli S168");
    ids.A = A.id;
    const aF1 = await sale(A, 1000);
    await take(A, 1000);
    ids.aF2 = await sale(A, 500);
    await cash(A, 400, { doubtfulSkip: true });
    await cash(A, 300, { invoiceId: ids.aF2 });
    await cheque(A, 200, aF1);
    ids.aFree = (await cash(A, 100)).id;
    // G — aynı gün iki bağlı tahsilat (ders 31): ayırıcı aynı günün alacaklarını kimlikle (rastgele UUID) sıralar — HANGİ satırın payı aldığı koşudan koşuya değişebilir (tur 3d GÖZLEMİ,
    // dar kontrole). Bu yüzden G hakeme GİRMEZ (yalnız bellekli ↔ belleksiz ve kesit anahtarı sınamasında).
    const G = await acc("Aynı Gün Şüpheli");
    const gF1 = await sale(G, 1000);
    await take(G, 1000);
    const gF2 = await sale(G, 500);
    await cash(G, 400, { doubtfulSkip: true });
    const same = at();
    await cash(G, 50, { invoiceId: gF2 }, same);
    await cash(G, 50, { invoiceId: gF1 }, same);
    // B — kısmi şüpheli, bağlı tahsilatlı faturanın iptali
    const B = await acc("Kısmi Şüpheli");
    ids.B = B.id;
    const bF1 = await sale(B, 1000);
    await take(B, 600);
    const bF3 = await sale(B, 300);
    await cash(B, 100, { invoiceId: bF3 });
    await cash(B, 200, { invoiceId: bF1 });
    await must("fatura iptali", "post", `/api/workspace/invoices/${bF3}/cancel`, { reason: "t3hiz", cashForce: true, negativeOk: true }, co);
    // E — yalnız evrak bağlı şüpheli carisi; F — yalnız bağsız evraklı şüpheli carisi
    const E = await acc("Şüpheli Çekli");
    const eF1 = await sale(E, 800);
    await take(E, 800);
    const eF2 = await sale(E, 400);
    await cheque(E, 300, eF2);
    ids.eF1 = eF1;
    const F = await acc("Şüpheli Bağsız Çekli");
    await sale(F, 700);
    await take(F, 700);
    await cheque(F, 250);
    // C — şüphelisiz kalabalık cari: peşinli faturalar (peşin bağları sırayla), Vade / Beklenen Ödeme Tarihli elle borçlar, bağlı / bağsız çek, Kapatılacak Fatura
    const C = await acc("Şüphelisiz Kalabalık");
    const cInv = [];
    for (const amount of [900, 800, 700, 600]) cInv.push(await sale(C, amount, { cash: [{ amount: String(amount / 4), method: "cash" }], cheques: [], endorse: [], rest: "open" }));
    // Son satır GERİYE tarihli (yazım sırası ≠ tarih sırası): haritanın sırası dizin seçimine bağlıysa (eski plan source_id · rowid, carinin dizini tarih) burada ayrışır.
    for (const [due, expected, back] of [[20, 25, 0], [10, 0, 0], [0, 15, 0], [30, 30, 3]]) await must("elle borç", "post", `/api/workspace/accounts/${C.id}/entries`, { kind: "debt", amount: String(100 + due + expected), date: back ? day(t - back) : at(), ...(due ? { dueDate: day(due) } : {}), ...(expected ? { expectedDate: day(expected) } : {}), note: `vade ${due}/${expected}` }, co);
    await cash(C, 150, { invoiceId: cInv[1] });
    const cLinked = await cheque(C, 220, cInv[2]);
    await cheque(C, 130);
    // D — tedarikçi: C'nin bağlı çeki faturayla ciro edilir (ciro olayının carisi / ciro edilen D)
    const Dt = await acc("Tedarikçi Ciro");
    await must("ciroyla alış", "post", "/api/workspace/invoices", { kind: "purchase", accountId: Dt.id, number: `T3H-${k}`, issueDate: at(), pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 220, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [cLinked.id], rest: "open" }, force: true }, co);
    assert.ok(t < -150, `sınıf verisi kilit gününden (−150) önce biter: ${t}`);
    return ids;
  }

  // Bir şirketin dökümü (aşama): ayırıcı (SQL yükleyicisi) bütün şirket + cari başına, yevmiye yükleyicisi (120 / 128 / şüpheli satırları), kuyruk girdisi her cari için, cari kartı (şüpheli
  // carileri), Mutabakat Testi bulguları.
  // hakem: true → aynı gün sırası kimliğe bağlı olan G carisi dışarıda (ayırıcı cari başına bağımsız koşar: öbür carilerin sonucu G'den etkilenmez).
  async function dump(co, { hakem: forHakem = false } = {}) {
    const target = app(co);
    const { store } = target;
    const skip = new Set(forHakem ? store.all("SELECT id FROM accounts WHERE name LIKE 'Aynı Gün Şüpheli%'").map(row => row.id) : []);
    const parties = store.all("SELECT DISTINCT account_id AS id FROM doubtful_receivables ORDER BY rowid").map(row => row.id).filter(id => !skip.has(id));
    const out = { all: plain(forHakem ? D.doubtfulState(store, { parties }) : D.doubtfulState(store)), party: {}, journal: [], input: {}, card: {} };
    for (const party of parties) out.party[party] = plain(D.doubtfulState(store, { parties: [party] }));
    for (const entry of target.ledger.build()) {
      const lines = (entry.lines || []).filter(line => ["120", "128", "129", "659", "644"].includes(line.account) && parties.includes(line.party));
      if (lines.length) out.journal.push({ id: entry.id, date: entry.date, lines: lines.map(line => `${line.account} ${line.party} ${line.debit} ${line.credit}`) });
    }
    const input = createObligationInput({ store });
    for (const { id } of store.all("SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY rowid").filter(row => !skip.has(row.id))) {
      const ledger = input.ledgerLines({ ids: [id] }).get(id) || [];
      const extras = input.obligationExtras(id, new Map());
      out.input[id] = plain({ settle: input.accountSettleInput(id, ledger, ""), dueDates: extras.dueDates, promises: extras.promises, schedules: extras.schedules, linkTimes: extras.linkTimes, linkMoments: extras.linkMoments });
    }
    for (const party of parties) {
      const card = await must("cari kartı", "get", `/api/workspace/accounts/${party}`, undefined, co);
      out.card[party] = { doubtful: card.doubtful ?? null, entries: (card.entries || []).map(entry => ({ id: entry.id, amount: entry.amount, doubtfulNormal: entry.doubtfulNormal, doubtfulNormalPart: entry.doubtfulNormalPart ?? null })), balance: card.account?.balance ?? card.balance ?? null };
    }
    return { text: JSON.stringify(out), label: labeller(store) };
  }
  // Aşama: belleksiz ↔ bellekli soğuk ↔ bellekli ılık AYNI; hakemle AYNI (normalleştirilmiş).
  async function stage(name, co = "") {
    memoOff(true);
    // Mutabakat Testi bulguları aşamada BİR kez, dökümlerden önce: tarama durum tutar (bozulmayı ilk taramada bildirir, aynı veri durumunda sonraki taramada bildirmez — belleksiz iki
    // taramada da öyle; bu düzeltmeden bağımsız), karşılaştırma sırası sonucu değiştirmesin.
    const integrity = (app(co).integrity.scan().findings || []).map(f => `${f.code} ${f.key || ""}`).sort();
    const off = await dump(co);
    memoOff(false);
    const cold = await dump(co);
    const warm = await dump(co);
    if (!WRITE) {
      assert.ok(D.LINKED_MEMO_TEST, "linkedShares'in belleği (LINKED_MEMO_TEST) yok — hız düzeltmesi uygulanmamış");
      assert.equal(cold.text, off.text, `${name}: bellekli (soğuk) ↔ belleksiz farklı`);
      assert.equal(warm.text, off.text, `${name}: bellekli (ılık) ↔ belleksiz farklı`);
    }
    const forHakem = await dump(co, { hakem: true });
    const normal = { ...JSON.parse(forHakem.label(forHakem.text)), integrity: JSON.parse(forHakem.label(JSON.stringify(integrity))) };
    if (WRITE) stages[name] = normal;
    else assert.deepEqual(normal, hakem[name], `${name}: düzeltmeden önceki kodun hakemiyle farklı`);
    return off;
  }

  it("H1 + H2: aday cari kümesi ve kuyruk girdisi (her cari) ESKİ sorgu / gövdeyle aynı — harita sırası dahil, iki şirkette", { timeout: 600_000 }, async () => {
    const created = await must("ikinci şirket", "post", "/api/companies", { name: "T3H İkinci Şirket" });
    second = created.company;
    const one = await build("", "001");
    const two = await build(second.id, "002");
    assert.ok(one.A && two.A);
    for (const co of ["", second.id]) {
      const { store } = app(co);
      const everyone = JSON.stringify(store.all("SELECT id FROM accounts ORDER BY rowid").map(row => row.id));
      const doubtfulOnes = JSON.stringify(store.all("SELECT DISTINCT account_id AS id FROM doubtful_receivables").map(row => row.id));
      if (!WRITE) {
        assert.ok(D.LINKED_CHEQUE_PARTIES_SQL, "LINKED_CHEQUE_PARTIES_SQL yok — ön denetim eski sorguda");
        for (const list of [everyone, doubtfulOnes]) {
          const oldSet = store.all(OLD_CHEQUE_PARTIES_SQL, list).map(row => row.id).sort();
          const newSet = store.all(D.LINKED_CHEQUE_PARTIES_SQL, list).map(row => row.id).sort();
          assert.deepEqual(newSet, oldSet, "evrak bağlı cariler kümesi eski sorguyla aynı");
          assert.ok(oldSet.length >= (list === everyone ? 4 : 2), `sınıf verisinde evrak bağlı cariler (bütün cariler: şüpheli S168, şüpheli çekli, kalabalık, ciro edilen; şüpheliler: ilk ikisi): ${oldSet.length}`);
        }
      }
      const input = createObligationInput({ store });
      let peşin = 0;
      let dated = 0;
      for (const { id } of store.all("SELECT id FROM accounts ORDER BY rowid")) {
        const ledger = input.ledgerLines({ ids: [id] }).get(id) || [];
        assert.equal(JSON.stringify(ordered(input.accountSettleInput(id, ledger, TODAY))), JSON.stringify(ordered(oldAccountSettleInput(store, input, id, ledger, TODAY))), `kuyruk girdisi eski gövdeyle aynı (sıra dahil): ${id}`);
        const extras = input.obligationExtras(id, new Map());
        const dueDates = new Map();
        const promises = new Map();
        for (const row of store.all(OLD_DATED_ONE_SQL, id)) {
          if (row.dueDate) dueDates.set(row.id, row.dueDate);
          if (row.expectedDate) promises.set(row.id, row.expectedDate);
        }
        assert.equal(JSON.stringify(ordered({ dueDates: extras.dueDates, promises: extras.promises })), JSON.stringify(ordered({ dueDates, promises })), `Vade / Beklenen Ödeme Tarihi haritası eski sorguyla aynı (sıra dahil): ${id}`);
        peşin = Math.max(peşin, store.all("SELECT 1 FROM account_entries WHERE account_id = ? AND source = 'invoice' AND kind = 'in'", id).length);
        dated = Math.max(dated, dueDates.size + promises.size);
      }
      assert.ok(peşin >= 4 && dated >= 6, `sıra sınaması anlamlı: peşin ${peşin}, vadeli ${dated}`);
    }
  });

  it("H3: bellekli ↔ belleksiz ↔ hakem — ilk durum, kilitli dönem, yazım, kapı reddi, store dışı yazım, başka bağlantı, kilit kalkınca; iki şirket", { timeout: 900_000 }, async () => {
    // Sınıf verisi önceki testte kuruldu; kurulamadıysa (ör. bilerek hata açılmış program yazımı reddetti) değer iletisiyle düşer (TypeError zinciri değil).
    const row = (sql, ...args) => {
      const found = server.app.store.get(sql, ...args);
      assert.ok(found, `sınıf verisi yok: ${sql.slice(0, 80)}`);
      return found;
    };
    const ids = { A: row("SELECT id FROM accounts WHERE name = 'Şüpheli S168 001'").id };
    ids.aF2 = row("SELECT id FROM invoices WHERE account_id = ? AND status = 'issued' ORDER BY rowid LIMIT 1 OFFSET 1", ids.A).id;
    ids.aFree = row("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in' AND invoice_id = '' AND doubtful_skip = 0 AND source = '' ORDER BY rowid LIMIT 1", ids.A).id;
    await stage("1 ilk");
    await stage("1 ilk (002)", second.id);
    await must("kilit", "put", "/api/admin/period-lock", { lockedUntil: day(-150) });
    await stage("2 kilitli");
    // Yazım: aynı gün yeni bağlı tahsilat (kilit sonrası gün).
    // Yazım AYIRT EDİCİ: kayıttan sonra kesilen yeni faturaya bağlı tahsilat — kuyrukta payı yok → bağlı kural 120 (bağsız kural olsaydı 128); bayat kurulum (satır yok → bağsız) burada ayrışır.
    const h = await must("yeni fatura", "post", "/api/workspace/invoices", { scenario: "service_sale", accountId: ids.A, issueDate: day(-12), lines: [{ name: "Hizmet", qty: 1, unitPrice: "300", vatRate: 0 }], payment: { rest: "open" } });
    await must("bağlı tahsilat", "post", `/api/workspace/accounts/${ids.A}/entries`, { kind: "in", amount: "25", date: day(-10), method: "cash", cashForce: true, similarOk: true, invoiceId: h.id });
    const afterWrite = await stage("3 yazım");
    // Kapı reddi: önce bellek ılık (aşama), sonra 120'ye düşecek kısmı şüpheli dışı borcu aşan bağlı tahsilat — işlem GERİ ALINIR; döküm değişmez.
    // Reddedilen satır sonraki bağlı tahsilattan ÖNCE tarihli: işlem içinde kurulan (geri alınan) kurulum bellekte kalsaydı sonraki kesite girerdi.
    const rejected = await call("post", `/api/workspace/accounts/${ids.A}/entries`, { kind: "in", amount: "5000", date: day(-11), method: "cash", cashForce: true, similarOk: true, invoiceId: ids.aF2 });
    assert.equal(rejected.status, 409, `kapı reddi bekleniyor: ${rejected.status} ${JSON.stringify(rejected.data).slice(0, 300)}`);
    const afterReject = await stage("4 kapı reddi");
    assert.equal(afterReject.text, afterWrite.text, "reddedilen yazım dökümü değiştirmez");
    // Store dışı yazım (aynı bağlantı, store'u atlayan db.prepare): total_changes değişir.
    server.app.store.db.prepare("UPDATE account_entries SET amount = 90 WHERE id = ?").run(ids.aFree);
    const outside = await stage("5 store dışı yazım");
    assert.notEqual(outside.text, afterReject.text, "store dışı yazım dökümü değiştirir (bellek bayat kalmamalı)");
    // Başka bağlantının yazımı: data_version değişir.
    const other = new DatabaseSync(server.app.config.dbPath);
    try {
      other.prepare("UPDATE account_entries SET amount = 100 WHERE id = ?").run(ids.aFree);
    } finally {
      other.close();
    }
    const otherConn = await stage("6 başka bağlantı");
    assert.equal(otherConn.text, afterReject.text, "başka bağlantı eski tutarı geri yazdı → döküm reddetme sonrasıyla aynı");
    await must("kilit kalkar", "put", "/api/admin/period-lock", { lockedUntil: "" });
    await stage("7 kilit kalktı");
    await stage("7 kilit kalktı (002)", second.id);
    const file = resolveDbPath(server.app.companies.dirsOf(server.app.companies.get(second.id)).dataDir);
    assert.ok(file.endsWith(".sqlite"));
  });

  it("H3: kesit belleğinin anahtarı görünümü taşır — aynı satır, farklı açık kalan / aynı gün işlenen → belleksiz sonuçla aynı", { skip: Boolean(WRITE), timeout: 120_000 }, async () => {
    assert.ok(D.LINKED_MEMO_TEST, "LINKED_MEMO_TEST yok");
    const { store } = server.app;
    const party = store.get("SELECT id FROM accounts WHERE name = 'Aynı Gün Şüpheli 001'")?.id;
    assert.ok(party, "sınıf verisi yok (Aynı Gün Şüpheli)");
    const lines = store.all("SELECT id, date FROM account_entries WHERE account_id = ? AND kind = 'in' AND invoice_id <> '' ORDER BY rowid", party);
    const records = store.all("SELECT id, date, amount_minor AS amountMinor FROM doubtful_receivables WHERE account_id = ? AND status <> 'cancelled' ORDER BY rowid", party);
    assert.ok(lines.length >= 2 && records.length >= 1);
    const sameDay = lines.filter(line => lines.filter(other => other.date === line.date).length === 2);
    assert.equal(sameDay.length, 2, "aynı gün iki bağlı tahsilat");
    const views = [
      { open: records.map(r => ({ id: r.id, date: r.date, remainingMinor: r.amountMinor })), done: new Set(), known: new Set() },
      { open: records.map(r => ({ id: r.id, date: r.date, remainingMinor: Math.floor(r.amountMinor / 3) })), done: new Set(), known: new Set() },
      { open: records.map(r => ({ id: r.id, date: r.date, remainingMinor: r.amountMinor })), done: new Set([`account:${sameDay[1].id}`]), known: new Set([`account:${sameDay[1].id}`]) },
      { open: records.map(r => ({ id: r.id, date: r.date, remainingMinor: r.amountMinor })), done: new Set(), known: new Set([`account:${sameDay[1].id}`]) },
    ];
    const results = [];
    for (const line of [...lines, ...sameDay]) {
      for (const view of views) {
        memoOff(true);
        const fresh = D.linkedShares(store, [party]);
        assert.equal(typeof fresh, "function", "bağlı alacaklı şüpheli carisi için geri çağrı (aday) bekleniyor (belleksiz)");
        const expected = JSON.stringify(fresh({ ref: `account:${line.id}`, party }, view));
        memoOff(false);
        const shared = D.linkedShares(store, [party]);
        assert.equal(typeof shared, "function", "bağlı alacaklı şüpheli carisi için geri çağrı (aday) bekleniyor");
        const got = JSON.stringify(shared({ ref: `account:${line.id}`, party }, view));
        assert.equal(got, expected, `kesit belleği görünümü ayırt etmeli: ${line.id} ${JSON.stringify([...view.done])}`);
        assert.equal(JSON.stringify(D.linkedShares(store, [party])({ ref: `account:${line.id}`, party }, view)), expected, "ılık bellek aynı");
        results.push(expected);
      }
    }
    assert.ok(new Set(results).size >= 3, `görünümler farklı sonuç vermeli (sınama anlamlı): ${new Set(results).size}`);
  });
  it("H3: geri alınan işlemin İÇİNDE okunan durum bellekte kalmaz (geri alma total_changes'ı azaltmaz — aynı anahtar)", { skip: Boolean(WRITE), timeout: 120_000 }, async () => {
    assert.ok(D.LINKED_MEMO_TEST, "LINKED_MEMO_TEST yok");
    const { store } = server.app;
    const party = store.get("SELECT id FROM accounts WHERE name = 'Şüpheli S168 001'")?.id;
    assert.ok(party, "sınıf verisi yok (Şüpheli S168)");
    // Carinin EN BÜYÜK bağlı tahsilatı (kuyrukta payı olan faturaya — S168 Fatura 2) ve faturası; işlem içinde ondan ÖNCE tarihli, aynı faturaya bağlı büyük tahsilat yazılır (o kesitin kuyruğunu değiştirir) ve işlem geri alınır.
    const last = store.get("SELECT id, date, invoice_id AS invoiceId, created_by AS createdBy FROM account_entries WHERE account_id = ? AND kind = 'in' AND invoice_id <> '' ORDER BY amount DESC, rowid LIMIT 1", party);
    assert.ok(last, "bağlı tahsilat yok");
    const earlier = (() => {
      const at = new Date(`${last.date}T00:00:00Z`);
      at.setUTCDate(at.getUTCDate() - 1);
      return at.toISOString().slice(0, 10);
    })();
    const state = () => JSON.stringify(plain(D.doubtfulState(store, { parties: [party] })));
    memoOff(false);
    const before = state();
    const total0 = store.changeCounters().total;
    let inside = "";
    assert.throws(() => store.tx(() => {
      store.db.prepare("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, created_by, created_at, method, invoice_id) VALUES (?, ?, 'in', 5000, ?, 't3hiz geri alınacak', '', '', ?, ?, 'cash', ?)")
        .run("t3hiz-geri-alinacak", party, earlier, last.createdBy, "2026-10-20T09:00:00.000Z", last.invoiceId);
      inside = state();
      throw new Error("t3hiz: bilerek geri al");
    }), /bilerek geri al/);
    assert.ok(!store.get("SELECT 1 AS found FROM account_entries WHERE id = 't3hiz-geri-alinacak'"), "işlem geri alındı");
    assert.notEqual(inside, before, "sınama anlamlı: işlem içindeki durum farklı (yazılan satır kesite girdi)");
    assert.ok(store.changeCounters().total > total0, "sınama anlamlı: geri alma total_changes'ı azaltmadı (işlem dışındaki okuma işlem içindekiyle aynı sayacı görür)");
    memoOff(true);
    const off = state();
    memoOff(false);
    assert.equal(off, before, "belleksiz: geri alınan satır yok");
    assert.equal(state(), off, "bellekli: geri alınan işlemin içindeki kurulum bellekte KALMAMALI");
  });
});
