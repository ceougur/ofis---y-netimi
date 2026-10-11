// 2.1.0 TEMEL SÜRÜM — ERTELENENLER GÖRÜNMEZ ve API'DEN ÇAĞRILAMAZ (kullanıcı kararı 10.10.2026 "TEMEL SÜRÜME BAŞLA"; plan §12.1 "yarım özellik
// görünmez"). Ertelenenler: döviz/kur/değerleme (Aşama 13), Bankaya Tahsile Ver, K8 taksit avans/fazla ödeme, faturanın bankalı iade/iptal
// ayrıntısı ve toplu kesim, kalan §8.10 raporları, Kasa açılış/devir; POS 2.2.0, ekstre ve mutabakat 2.3.0. Her biri için iki iddia sınanır:
//   (1) GÖRÜNMEZ — sunucunun ekrana verdiği veride (Banka Ayarları bölümleri/kalemleri, hesap türleri, fiş türleri, süzgeç grupları, Rapor
//       Merkezi listesi, Roller kataloğu, ANLIK DURUM ve Birleşik Rapor sütunları) yer almaz;
//   (2) API REDDEDER — doğrudan istek 4xx döner ve veri tabanına hiçbir şey yazılmaz (ders 3: reddedilen istek başarı değildir; sayılar okunur).
// Ekranın kendisi (düğme, sekme, seçenek) test/e2e/senaryo-banka-210-temel.mjs'te tarayıcıdan denetlenir.
// Bulgu (bu testin kırmızısı, 2.1.0 temel sürüm öncesi kod f5259dd): gizli ayarlar (POS, Ekstre, Döviz, Kanal Alanı, Elle Banka Fişi) API'den
// değiştirilebiliyordu; PUT ile Elle Banka Fişi açılınca gizli fiş — Kambiyo Kârı (646) satırı dahil — API'den yazılıyordu; Bağdaştırıcılar
// satırı ("Açık bankacılık ve sanal POS bağlantısı kapalıdır") olmayan özelliği ekranda anlatıyordu.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";
import { xlsxSheets } from "./banka-210-ortak.mjs";

const count = (store, table) => Number(store.get(`SELECT COUNT(*) AS n FROM ${table}`).n);
const TABLES = ["bank_accounts", "fin_events", "bank_lines", "pos_terminals", "pos_rates", "pos_sales", "pos_items", "cheque_collections", "fx_rates", "bank_statements", "bank_statement_lines", "bank_matches", "cash_entries", "account_entries"];
const snapshot = store => Object.fromEntries(TABLES.map(table => [table, count(store, table)]));
// "Uç yok": yol hiç yoksa 404; aynı kalıpta bir :id yolu varsa (ör. /cash/:id) yöntem 405 — ikisi de işlemin olmadığı anlamına gelir.
const NO_ROUTE = [404, 405];

describe("2.1.0 temel sürüm: ertelenen banka özellikleri görünmez ve API'den çağrılamaz", () => {
  let ctx;
  let ziraat;
  before(async () => {
    ctx = await bootBank();
    ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("Banka Ayarları (ekran verisi): POS, Ekstre, Döviz, Kanal Alanı, Elle Banka Fişi ve Bağdaştırıcılar görünmez", async () => {
    const settings = await must("ayarlar", ctx.api.get(`${BANK}/settings`));
    const section = id => settings.sections.find(item => item.id === id);
    for (const id of ["pos", "posAdvanced", "statement", "fx", "fxAdvanced", "movement"]) assert.equal(section(id).available, false, `${id} bölümü görünmemeli`);
    const hiddenItems = [["account", "defaultPosId"], ["holidayAdvanced", "shift"], ["gl", "fxGain"], ["gl", "fxLoss"], ["other", "manualVoucher"], ["other", "adapters"]];
    for (const [id, key] of hiddenItems) assert.equal(section(id).items.find(item => item.key === key).available, false, `${id}.${key} görünmemeli`);
    // Görünen bütün kalemlerin adı ve yardımı ertelenen bir özelliği anlatmaz (POS komisyonu masraf türü ve 108 sabit eşlemesi 2.1.0'da kullanılır).
    const visible = settings.sections.filter(item => item.available !== false).flatMap(item => item.items.filter(entry => entry.available !== false).map(entry => `${item.label} › ${entry.label}: ${entry.text || ""} ${entry.help || ""}`));
    const later = visible.filter(textLine => /sanal POS|açık bankacılık|ekstre ile|döviz al|kur değerleme|değerleme kuru|valör günü|bloke süresi|tahsile ver/i.test(textLine));
    assert.deepEqual(later, [], "görünen ayar ertelenen özelliği anlatmamalı");
  });

  it("gizli ayar API'den değiştirilemez (400 bank-setting-later; kayıt değişmez); aynı (varsayılan) değer ve görünen ayar kaydedilir", async () => {
    const raw = () => ctx.store.setting("bank.settings", "");
    const changes = [
      ["pos", "valorDays", 2],
      ["pos", "taxMode", "none"],
      ["pos", "refundCommission", "full"],
      ["posAdvanced", "blockDays", 3],
      ["posAdvanced", "settlement", "manual"],
      ["statement", "toleranceDays", 5],
      ["statement", "autoConfirmStrong", true],
      ["fx", "source", "manual"],
      ["fx", "invoiceSuggest", false],
      ["fxAdvanced", "reverseNextDay", true],
      ["fxAdvanced", "exchangeTaxPermille", 2],
      ["movement", "channel", "required"],
      ["holidayAdvanced", "shift", "preceding"],
      ["other", "manualVoucher", true],
    ];
    const before = raw();
    for (const [section, key, value] of changes) expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { [section]: { [key]: value } } }), 400, "bank-setting-later", `${section}.${key} = ${JSON.stringify(value)}`);
    // Görünen ayarla birlikte gönderilen gizli değişiklik de bütün isteği düşürür (hiçbiri yazılmaz).
    expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { negative: { policy: "block" }, other: { manualVoucher: true } } }), 400, "bank-setting-later", "karma istek");
    assert.equal(raw(), before, "reddedilen istekler ayar kaydını değiştirmedi");
    const values = (await must("ayarlar", ctx.api.get(`${BANK}/settings`))).values;
    assert.deepEqual([values.pos.valorDays, values.statement.toleranceDays, values.fx.source, values.other.manualVoucher, values.movement.channel, values.negative.policy], [1, 3, "tcmb", false, "optional", "warn"], "değerler varsayılan");
    // Aynı (varsayılan) değeri göndermek serbest; görünen ayar kaydedilir.
    const saved = await must("varsayılanla + görünen", ctx.api.put(`${BANK}/settings`, { values: { pos: { valorDays: 1 }, other: { manualVoucher: false }, negative: { policy: "block" } } }));
    assert.equal(saved.values.negative.policy, "block");
    assert.equal(saved.values.other.manualVoucher, false);
    await must("varsayılana dön", ctx.api.post(`${BANK}/settings/reset`, {}));
  });

  it("eski kayıtta gizli ayar dolu olsa da etkisiz: Elle Banka Fişi kapalı kalır (409 bank-manual-off), Kambiyo Kârı (646) fişi yazılamaz", async () => {
    // Nasıl bozarım: önceki bir yapının (ya da doğrudan veri tabanı yazımının) bıraktığı açık Elle Banka Fişi ve ekstre toleransı.
    const stored = JSON.parse(ctx.store.setting("bank.settings", "") || "{}");
    ctx.store.setSetting("bank.settings", JSON.stringify({ ...stored, other: { ...(stored.other || {}), manualVoucher: true }, statement: { toleranceDays: 9 } }));
    const view = await must("ayarlar", ctx.api.get(`${BANK}/settings`));
    assert.equal(view.values.other.manualVoucher, false, "kayıtlı gizli değer okunmaz");
    assert.equal(view.values.statement.toleranceDays, 3, "kayıtlı gizli değer okunmaz (ekstre)");
    const meta = await must("fiş seçenekleri", ctx.api.get(`${BANK}/voucher-meta`));
    assert.equal(meta.manualVoucher, false, "fiş formu Elle Banka Fişi sunmaz");
    const before = snapshot(ctx.store);
    const kambiyo = { type: "other_in", accountId: ziraat.id, lines: [{ role: "fx_gain", gl: "646", side: "C", amount: "5" }, { role: "bank", accountId: ziraat.id, side: "D", amount: "5" }] };
    expectStatus(await ctx.api.post(`${BANK}/vouchers`, kambiyo), 409, "bank-manual-off", "Kambiyo Kârı elle fişi");
    const manual = { type: "other_out", accountId: ziraat.id, lines: [{ role: "expense", gl: "659", side: "D", amount: "5" }, { role: "bank", accountId: ziraat.id, side: "C", amount: "5" }] };
    expectStatus(await ctx.api.post(`${BANK}/vouchers`, manual), 409, "bank-manual-off", "elle fiş");
    assert.deepEqual(snapshot(ctx.store), before, "reddedilen fiş hiçbir şey yazmadı");
    ctx.store.setSetting("bank.settings", JSON.stringify(stored));
  });

  it("döviz, kur ve değerleme: hesap türlerinde ve fiş türlerinde yok; döviz hesabı, döviz fişi ve değerleme API'den 400; Genel Bakış features.fx kapalı", async () => {
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.features?.fx, false, "döviz kapalı");
    const meta = await must("fiş seçenekleri", ctx.api.get(`${BANK}/voucher-meta`));
    assert.deepEqual(meta.types.map(item => item.type).sort(), ["card_payment", "fee", "interest_in", "interest_out", "loan_draw", "loan_repay", "other_in", "other_out"], "fiş türleri: döviz al/sat, değerleme, POS yok");
    assert.ok(!meta.groups.some(item => /Döviz|\bKur\b|Değerleme|POS|Ekstre|Tahsile/.test(item.label) || /^(fx|pos|statement|revaluation)/.test(item.key)), `Hareketler süzgeç grupları: ${JSON.stringify(meta.groups)}`);
    const before = snapshot(ctx.store);
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Dolar", kind: "fx", currency: "USD", opening: { date: "2026-10-01", amount: "1.000", rate: "34,25" } }), 400, "bank-currency-later", "döviz hesabı");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Euro Vadesiz", kind: "demand", currency: "EUR" }), 400, "bank-currency-later", "EUR vadesiz");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Döviz TL", kind: "fx", currency: "TRY" }), 400, "bank-currency", "Döviz türü TL");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${ziraat.id}`, { currency: "USD" }), 400, "bank-currency-later", "TL hesabı dövize çevirme");
    for (const type of ["fx_exchange", "revaluation", "pos_sale", "pos_settlement", "cheque_deposit", "opening", "carry_close"]) {
      const res = await ctx.api.post(`${BANK}/vouchers`, { type, accountId: ziraat.id, amount: "10" });
      assert.ok(res.status >= 400 && res.status < 500, `fiş türü ${type}: ${res.status} ${res.error || ""}`);
    }
    for (const url of [`${BANK}/fx-rates`, `${BANK}/rates`, `${BANK}/revaluation`, `${BANK}/fx/exchange`]) {
      assert.ok(NO_ROUTE.includes((await ctx.api.post(url, { currency: "USD", rate: "34,25", amount: "10" })).status), `POST ${url}`);
      assert.ok(NO_ROUTE.includes((await ctx.api.get(url)).status), `GET ${url}`);
    }
    assert.deepEqual(snapshot(ctx.store), before, "döviz istekleri hiçbir şey yazmadı");
  });

  it("POS: hesap türü değil, uç yok (404), POS tablolarına yazılmaz; ANLIK DURUM ve Birleşik Rapor'da POS Bekleyen / Blokeli POS yok", async () => {
    const before = snapshot(ctx.store);
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Fiziki POS", kind: "pos" }), 400, "bank-kind", "POS hesap türü");
    for (const url of [`${BANK}/pos`, `${BANK}/pos-terminals`, `${BANK}/pos/sales`, `${BANK}/pos/settle`, `${BANK}/pos/commission`]) {
      assert.ok(NO_ROUTE.includes((await ctx.api.post(url, { name: "POS", amount: "10" })).status), `POST ${url}`);
      assert.ok(NO_ROUTE.includes((await ctx.api.get(url)).status), `GET ${url}`);
    }
    assert.deepEqual(snapshot(ctx.store), before, "POS istekleri hiçbir şey yazmadı");
    const overview = await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview"));
    assert.equal(overview.cash.bank.pos, false, "ANLIK DURUM POS kutusu kapalı");
    const combined = await must("Birleşik Rapor", ctx.api.get("/api/companies/report"));
    assert.ok(combined.headers.includes("Gerçek Banka") && !combined.headers.some(header => /POS Bekleyen|Blokeli POS/.test(header)), `Birleşik Rapor sütunları: ${combined.headers.join(" | ")}`);
    const xlsx = await ctx.api.raw("GET", "/api/companies/report.xlsx");
    assert.equal(xlsx.status, 200);
    const cells = Object.values(xlsxSheets(xlsx.buffer)).flat(2).map(String);
    assert.ok(cells.includes("Gerçek Banka") && !cells.some(cell => /POS Bekleyen|Blokeli POS/.test(cell)), "Birleşik Rapor Excel: Gerçek Banka var, POS sütunu yok");
  });

  it("ekstre ve mutabakat: uç yok (404), ekstre tablolarına yazılmaz", async () => {
    const before = snapshot(ctx.store);
    for (const url of [`${BANK}/statements`, `${BANK}/statements/import`, `${BANK}/statement`, `${BANK}/reconcile`, `${BANK}/matches`, `${BANK}/accounts/${ziraat.id}/statement`]) {
      assert.ok(NO_ROUTE.includes((await ctx.api.post(url, { accountId: ziraat.id, lines: [] })).status), `POST ${url}`);
      assert.ok(NO_ROUTE.includes((await ctx.api.get(url)).status), `GET ${url}`);
    }
    assert.deepEqual(snapshot(ctx.store), before, "ekstre istekleri hiçbir şey yazmadı");
  });

  it("Bankaya Tahsile Ver: çek işlemlerinde yok; 'deposit' işlemi reddedilir, çek durumu ve cheque_collections değişmez", async () => {
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Çek Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-11-05", serialNo: "TV-1", accountId: party.id }));
    const detail = await must("çek kartı", ctx.api.get(`/api/workspace/cheques/${cheque.id}`));
    assert.ok(!(detail.actions || []).some(action => /deposit|tahsile|collection/i.test(`${action.key} ${action.label}`)), `çek işlemleri: ${JSON.stringify(detail.actions)}`);
    const before = snapshot(ctx.store);
    for (const action of ["deposit", "collection", "bank_collect", "cheque_deposit"]) {
      const res = await ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action, date: "2026-10-08", bankAccountId: ziraat.id, status: "portfolio" });
      assert.ok(res.status === 409 || res.status === 400, `işlem ${action}: ${res.status} ${res.error || ""}`);
    }
    assert.deepEqual(snapshot(ctx.store), before, "reddedilen işlem hiçbir şey yazmadı");
    assert.equal((await must("çek kartı", ctx.api.get(`/api/workspace/cheques/${cheque.id}`))).status, "portfolio", "çek portföyde");
  });

  it("Kasa açılış/devir: Kasa'da açılış ya da devir hareketi girilemez (400); Kasa yalnız tahsilat ve ödeme", async () => {
    const before = snapshot(ctx.store);
    for (const kind of ["opening", "carry", "devir", "acilis"]) expectStatus(await ctx.api.post("/api/workspace/cash", { kind, amount: "500", date: "2026-10-08", description: "Kasa açılışı" }), 400, null, `Kasa ${kind}`);
    for (const url of ["/api/workspace/cash/opening", "/api/workspace/cash/carry"]) assert.ok(NO_ROUTE.includes((await ctx.api.post(url, { amount: "500", date: "2026-10-08" })).status), `POST ${url}`);
    assert.deepEqual(snapshot(ctx.store), before, "Kasa açılış istekleri hiçbir şey yazmadı");
  });

  it("Rapor Merkezi: Banka grubunda yalnız temel 4 rapor; ertelenen §8.10 raporları listede yok ve 404 (ekran, PDF, Excel)", async () => {
    const catalog = await must("rapor listesi", ctx.api.get("/api/workspace/report-center"));
    const bank = catalog.reports.filter(report => report.group === "Banka").map(report => report.id).sort();
    assert.deepEqual(bank, ["alt-hesap-mizani", "banka-bakiye", "banka-hareket", "banka-masraf"], `Banka grubu: ${bank.join(", ")}`);
    const titles = catalog.reports.map(report => report.title);
    for (const title of ["POS Satış Raporu", "POS Komisyon Raporu", "POS Bekleyen Raporu", "POS Valör Raporu", "Banka Mutabakat Raporu", "Kur Değerleme Raporu", "Tahsildeki Çekler", "Banka Nakit Akış Raporu", "Günlük Banka Raporu", "Aylık Banka Raporu", "Bankalar Arası Transfer Raporu", "Faturası Beklenen Komisyonlar"]) assert.ok(!titles.includes(title), `listede ${title} olmamalı`);
    const ids = ["pos-satis", "pos-komisyon", "pos-bekleyen", "pos-valor", "banka-mutabakat", "kur-degerleme", "tahsildeki-cekler", "banka-nakit-akis", "banka-gunluk", "banka-aylik", "banka-transfer", "kasa-banka-transfer", "banka-bazinda-bakiye", "para-birimi-bakiye", "cari-banka", "fatura-banka", "taksit-banka", "faturasi-beklenen-komisyonlar"];
    for (const id of ids) for (const suffix of ["", "/pdf", "/xlsx"]) assert.equal((await ctx.api.raw("GET", `/api/workspace/report-center/${id}${suffix}?preset=all`)).status, 404, `${id}${suffix}`);
  });

  it("Roller ve Kişiye Özel Yetki kataloğu: POS, komisyon, ekstre ve mutabakat yetkileri görünmez", async () => {
    const roles = await must("roller", ctx.api.get("/api/admin/roles"));
    const keys = roles.groups.flatMap(group => group.items.map(item => item.key));
    for (const key of ["bank.pos", "bank.commission", "bank.statement", "bank.reconcile"]) assert.ok(!keys.includes(key), `${key} katalogda görünmemeli`);
    assert.ok(keys.includes("bank.view") && keys.includes("bank.transfer"), "temel banka yetkileri görünür");
  });
});
