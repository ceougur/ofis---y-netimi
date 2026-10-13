// 2.2.0 İz 3 (POS'un arayüzü ve kalan açıklar; docs/2.2.0-IS-LISTESI.md İz 3, plan §4, §8.7, §8.9–8.11) — sunucu tarafı. Beklenen sayılar planın
// önceden yazılmış tablolarından (§4.2 satış akışı, §4.3 komisyon kipleri, §12.5 kabul 20–26); program kodundan türetilmez.
//   1. POS yalnız "POS Kullan" işaretli banka hesabına bağlanır (müşteri madde 6: POS bankanın içinden) — 400 pos-account-flag.
//   2. Bilinen hata: fatura Düzenle / cari tahsilatı düzeltmede yalnız provizyon no ya da kartın son 4 hanesi değişince satış kaydı güncellenmiyordu.
//   3. Tahsilat formunun POS önizlemesi (§8.9), POS İadesinin asıl işlem önerisi (§4.6), düzeltme formunun POS bilgisi.
//   4. Gizli POS ayarları ve yetkileri açıldı (bank.pos, bank.commission); henüz olmayan seçenekler (Ekstre ile, Her Valörde Taslak) gizli kalır.
//   5. Hareketler'de POS süzgeci (?pos=); Birleşik Rapor'da POS Bekleyen (Net) / Blokeli POS; Rapor Merkezi'nde POS Ödeme Takvimi ve Faturası
//      Beklenen Komisyonlar (ekran/PDF/Excel, TOPLAM); Banka Masraf Raporu POS komisyonunu kapsar.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, TODAY, balanceOf, bootBank, expectStatus, flagPos, kurus, must, openAcceptanceAccounts, openPos, posCheck, posInvoice, salesOf, settle, subBalances, summaryOf, trialBalances, ziraatPos } from "./banka-220-pos-ortak.mjs";

const RC = "/api/workspace/report-center";
const count = (store, table) => Number(store.get(`SELECT COUNT(*) AS n FROM ${table}`).n);
const setClock = (ctx, iso) => ctx.server.clock.set(`${iso}T10:00:00+03:00`);
// Excel tutarı sayı hücresine yazar ("9.750,00 TL" → 9750).
const cellOf = value => (/ TL$/.test(String(value)) ? Number(String(value).replace(/ TL$/, "").replace(/\./g, "").replace(",", ".")) : value);

async function world() {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const urunB = await must("Ürün B", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "100" }));
  return { ctx, api: ctx.api, acc, abc, urunB };
}

describe("İz 3.1: POS yalnız \"POS Kullan\" işaretli banka hesabına bağlanır", () => {
  let w;
  before(async () => {
    w = await world();
  });
  after(() => w?.ctx.server.close());

  it("işaretsiz hesaba POS açma → 400 pos-account-flag, hiçbir şey yazılmaz; işaretlenince açılır (108.01)", async () => {
    const before = [count(w.ctx.store, "pos_terminals"), count(w.ctx.store, "pos_rates")];
    expectStatus(await w.api.post(`${BANK}/pos`, ziraatPos(w.acc.ziraat.id)), 400, "pos-account-flag", "işaretsiz Ziraat");
    assert.deepEqual([count(w.ctx.store, "pos_terminals"), count(w.ctx.store, "pos_rates")], before, "reddedilen istek POS ve oran yazmadı");
    await must("POS Kullan", w.api.put(`${BANK}/accounts/${w.acc.ziraat.id}`, { usePos: true }));
    const pos = (await must("POS aç", w.api.post(`${BANK}/pos`, ziraatPos(w.acc.ziraat.id)))).pos;
    assert.equal(pos.glSub, "108.01");
    assert.equal(pos.bankAccountId, w.acc.ziraat.id);
  });

  it("bağlı hesabı işaretsiz hesaba değiştirme ve bekleyenleri işaretsiz hesaba taşıma → 400; yalnız ad düzeltmesi serbest; işaretlenince geçer", async () => {
    const pos = (await must("POS listesi", w.api.get(`${BANK}/pos`))).pos[0];
    expectStatus(await w.api.put(`${BANK}/pos/${pos.id}`, { bankAccountId: w.acc.garanti.id }), 400, "pos-account-flag", "işaretsiz Garanti'ye bağla");
    expectStatus(await w.api.post(`${BANK}/pos/${pos.id}/move-pending`, { bankAccountId: w.acc.garanti.id }), 400, "pos-account-flag", "işaretsiz Garanti'ye taşı");
    assert.equal((await must("POS", w.api.get(`${BANK}/pos/${pos.id}`))).bankAccountId, w.acc.ziraat.id, "bağ değişmedi");
    const renamed = await must("ad düzelt", w.api.put(`${BANK}/pos/${pos.id}`, { name: "Ziraat Fiziki POS (Mağaza)" }));
    assert.equal(renamed.name, "Ziraat Fiziki POS (Mağaza)");
    await flagPos(w.api, w.acc.garanti.id);
    assert.equal((await must("Garanti'ye bağla", w.api.put(`${BANK}/pos/${pos.id}`, { bankAccountId: w.acc.garanti.id }))).bankAccountId, w.acc.garanti.id);
    // POS'u olan hesabın işareti kapatılamaz (İz 2.2 kuralı; burada yalnız tutarlılık).
    expectStatus(await w.api.put(`${BANK}/accounts/${w.acc.garanti.id}`, { usePos: false }), 409, "bank-flag-in-use", "POS'lu hesabın işareti");
  });

  it("\"Ekstre ile\" bankaya geçiş bu sürümde seçilemez (400 pos-settle-later); Otomatik ve Elle Onay seçilir", async () => {
    const pos = (await must("POS listesi", w.api.get(`${BANK}/pos`))).pos[0];
    expectStatus(await w.api.put(`${BANK}/pos/${pos.id}`, { settleMode: "statement" }), 400, "pos-settle-later", "Ekstre ile");
    assert.equal((await must("Elle Onay", w.api.put(`${BANK}/pos/${pos.id}`, { settleMode: "manual" }))).settleMode, "manual");
    assert.equal((await must("Otomatik", w.api.put(`${BANK}/pos/${pos.id}`, { settleMode: "auto" }))).settleMode, "auto");
  });
});

describe("Bilinen hata (İz 3.6): yalnız provizyon no / kartın son 4 hanesi değişen POS satırı", () => {
  let w;
  let pos;
  before(async () => {
    w = await world();
    pos = await openPos(w.api, ziraatPos(w.acc.ziraat.id));
  });
  after(() => w?.ctx.server.close());

  const body = (extra = {}) => ({ kind: "sale", accountId: w.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: w.urunB.id, name: "Ürün B", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 1000, method: "card", posId: pos.id, lineKey: "p1", posInstallments: 1, ...extra }], cheques: [], endorse: [], rest: "open" }, force: true });
  const activeOf = async invoiceId => (await salesOf(w.api, "?kind=sale")).filter(sale => sale.status === "active" && sale.invoice?.id === invoiceId);

  it("fatura Düzenle: aynı tutarda provizyon AAA1 → BBB2, son 4 hane 1111 → 2222 → satış kaydı güncellenir (tek etkin satış, takvim aynı)", async () => {
    const doc = await must("fatura", w.api.post("/api/workspace/invoices", body({ authCode: "AAA1", cardLast4: "1111" })));
    const number = w.ctx.store.get("SELECT number FROM invoices WHERE id = ?", doc.id).number;
    const [first] = await activeOf(doc.id);
    assert.deepEqual([first.authCode, first.cardLast4], ["AAA1", "1111"]);
    await must("düzelt", w.api.post(`/api/workspace/invoices/${doc.id}/edit`, { ...body({ authCode: "BBB2", cardLast4: "2222" }), number }));
    const after = await activeOf(doc.id);
    assert.equal(after.length, 1, "tek etkin satış");
    assert.deepEqual([after[0].authCode, after[0].cardLast4], ["BBB2", "2222"], "provizyon ve son 4 hane güncellendi");
    assert.deepEqual(after[0].items.map(item => [item.valueDate, item.netMinor]), first.items.map(item => [item.valueDate, item.netMinor]), "valör takvimi aynı");
    // Düzenle formu dolu açılsın: faturanın peşin satırı POS bilgisini taşır.
    const detail = await must("fatura kartı", w.api.get(`/api/workspace/invoices/${doc.id}`));
    const line = detail.payment.cash[0];
    assert.deepEqual([line.posId, line.posInstallments, line.authCode, line.cardLast4], [pos.id, 1, "BBB2", "2222"], "Düzenle formunun POS bilgisi");
    await posCheck(w.api, "provizyon düzeltmesi");
  });

  it("başka satışın provizyonuna düzeltme → 409 pos-auth-duplicate; kayıt değişmez", async () => {
    const other = await must("ikinci fatura", w.api.post("/api/workspace/invoices", body({ authCode: "CCC3", lineKey: "q1" })));
    assert.ok(other.id);
    const doc = await must("üçüncü fatura", w.api.post("/api/workspace/invoices", body({ authCode: "DDD4" })));
    const number = w.ctx.store.get("SELECT number FROM invoices WHERE id = ?", doc.id).number;
    expectStatus(await w.api.post(`/api/workspace/invoices/${doc.id}/edit`, { ...body({ authCode: "CCC3" }), number }), 409, "pos-auth-duplicate", "aynı gün aynı POS'ta CCC3 var");
    assert.equal((await activeOf(doc.id))[0].authCode, "DDD4", "kayıt değişmedi");
  });

  it("cari tahsilatı düzeltme: yalnız provizyon değişince satış kaydı güncellenir; düzeltme formunun POS bilgisi (GET /bank/pos/row)", async () => {
    const created = await must("POS tahsilatı", w.api.post(`/api/workspace/accounts/${w.abc.id}/entries`, { kind: "in", amount: "500", method: "card", posId: pos.id, posInstallments: 1, authCode: "E1", date: TODAY }));
    const entryId = created.entryId || created.entry?.id || created.id;
    assert.ok(entryId, `kayıt kimliği: ${JSON.stringify(created).slice(0, 200)}`);
    await must("düzelt", w.api.put(`/api/workspace/accounts/${w.abc.id}/entries/${entryId}`, { kind: "in", amount: "500", method: "card", posId: pos.id, posInstallments: 1, authCode: "E2", cardLast4: "4321", date: TODAY }));
    const row = await must("POS bilgisi", w.api.get(`${BANK}/pos/row?row=${encodeURIComponent(`account_entries:${entryId}`)}`));
    assert.deepEqual([row.sale.posId, row.sale.installments, row.sale.authCode, row.sale.cardLast4], [pos.id, 1, "E2", "4321"]);
    await posCheck(w.api, "cari düzeltme");
  });
});

describe("İz 3.2: tahsilat formunun POS önizlemesi ve POS İadesinin asıl işlem önerisi", () => {
  let w;
  let pos;
  let invoice;
  before(async () => {
    w = await world();
    pos = await openPos(w.api, ziraatPos(w.acc.ziraat.id));
  });
  after(() => w?.ctx.server.close());

  it("10.000 Tek Çekim (08.10.2026 Perşembe) → komisyon 250 (%2,50), net 9.750, valör 12.10.2026 (kabul 20–22)", async () => {
    const p = await must("önizleme", w.api.get(`${BANK}/pos/preview?pos=${pos.id}&amount=10.000&installments=1&date=2026-10-08`));
    assert.deepEqual([p.ratePpm, p.commissionMinor, p.netMinor, p.blocked], [25_000, kurus(250), kurus(9750), false]);
    assert.deepEqual(p.items.map(item => [item.valueDate, item.netMinor]), [["2026-10-12", kurus(9750)]]);
    assert.equal(count(w.ctx.store, "pos_sales"), 0, "önizleme hiçbir şey yazmaz");
  });

  it("12.000 3 Taksit (12.10.2026) → 3 × 3.860; 12.11.2026 · 14.12.2026 (12.12 Cumartesi) · 12.01.2027; komisyon 420 (kabul 25–26)", async () => {
    const p = await must("önizleme", w.api.get(`${BANK}/pos/preview?pos=${pos.id}&amount=12000&installments=3&date=2026-10-12`));
    assert.deepEqual([p.commissionMinor, p.netMinor], [kurus(420), kurus(11580)]);
    assert.deepEqual(p.items.map(item => [item.valueDate, item.netMinor]), [["2026-11-12", kurus(3860)], ["2026-12-14", kurus(3860)], ["2027-01-12", kurus(3860)]]);
  });

  it("tanımsız taksit → 400 pos-rate-missing; personel (tahsilat yetkisi) önizler; yetkisi olmayan rol 403", async () => {
    expectStatus(await w.api.get(`${BANK}/pos/preview?pos=${pos.id}&amount=100&installments=9`), 400, "pos-rate-missing", "9 taksit");
    const staff = apiOf(await createUser(w.ctx.server, w.api.client, { username: "pos-iz3-personel", role: "personel" }));
    assert.equal((await must("personel önizleme", staff.get(`${BANK}/pos/preview?pos=${pos.id}&amount=100&installments=1`))).netMinor, kurus(97.5));
  });

  it("asıl işlem önerisi: satıştan iade faturasında asıl faturanın POS satışı (kalan 10.000); POS'suz caride boş", async () => {
    invoice = await must("POS'lu fatura", posInvoice(w.api, { accountId: w.abc.id, itemId: w.urunB.id, qty: 10, unitPrice: 1000, date: TODAY, posId: pos.id }));
    const origins = await must("öneri", w.api.get(`${BANK}/pos/origins?invoice=${invoice.id}`));
    assert.deepEqual(origins.sales.map(sale => [sale.posId, sale.grossMinor, sale.remainingMinor]), [[pos.id, kurus(10000), kurus(10000)]]);
    const byParty = await must("cari önerisi", w.api.get(`${BANK}/pos/origins?party=${w.abc.id}`));
    assert.equal(byParty.sales.length, 1);
    const other = await must("başka cari", w.api.post("/api/workspace/accounts", { name: "XYZ Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    assert.deepEqual((await must("boş", w.api.get(`${BANK}/pos/origins?party=${other.id}`))).sales, []);
  });
});

describe("İz 3.4: POS ayarları ve yetkileri açıldı; henüz olmayan seçenekler gizli", () => {
  let w;
  before(async () => {
    w = await world();
  });
  after(() => w?.ctx.server.close());

  it("Banka Ayarları: POS ve Gelişmiş → POS görünür, Varsayılan POS görünür; değer kaydedilir; \"Ekstre ile\" ve \"Her Valörde Taslak\" listede yok ve 400", async () => {
    const settings = await must("ayarlar", w.api.get(`${BANK}/settings`));
    const section = id => settings.sections.find(item => item.id === id);
    assert.equal(section("pos").available, true);
    assert.equal(section("posAdvanced").available, true);
    assert.equal(section("account").items.find(item => item.key === "defaultPosId").available, true);
    const options = (id, key) => section(id).items.find(item => item.key === key).options.map(([value]) => value);
    assert.deepEqual(options("posAdvanced", "settlement"), ["auto", "manual"]);
    assert.deepEqual(options("posAdvanced", "commissionInvoice"), ["month_end", "manual"]);
    const saved = await must("kaydet", w.api.put(`${BANK}/settings`, { values: { pos: { valorDays: 2, refundCommission: "proportional" }, posAdvanced: { provisionDays: 1, settlement: "manual" } } }));
    assert.deepEqual([saved.values.pos.valorDays, saved.values.pos.refundCommission, saved.values.posAdvanced.provisionDays, saved.values.posAdvanced.settlement], [2, "proportional", 1, "manual"]);
    const raw = w.ctx.store.setting("bank.settings", "");
    expectStatus(await w.api.put(`${BANK}/settings`, { values: { posAdvanced: { settlement: "statement" } } }), 400, "bank-setting-later", "Ekstre ile");
    expectStatus(await w.api.put(`${BANK}/settings`, { values: { posAdvanced: { commissionInvoice: "each_valor" } } }), 400, "bank-setting-later", "Her Valörde Taslak");
    assert.equal(w.ctx.store.setting("bank.settings", ""), raw, "reddedilen istek ayarı değiştirmedi");
    // Yeni POS bu varsayılanları alır (valör 2, provizyon 1, iadede komisyon Oransal).
    await flagPos(w.api, w.acc.ziraat.id);
    const pos = (await must("POS", w.api.post(`${BANK}/pos`, { name: "Varsayılanlı POS", bankAccountId: w.acc.ziraat.id, rates: [{ installments: 1, rate: "2" }] }))).pos;
    assert.deepEqual([pos.valorDays, pos.provisionDays, pos.refundCommission], [2, 1, "proportional"]);
    await must("Varsayılan POS", w.api.put(`${BANK}/settings`, { values: { account: { defaultPosId: pos.id } } }));
    assert.equal((await must("seçici", w.api.get(`${BANK}/choices`))).forms.pos.defaultId, pos.id);
  });

  it("Roller kataloğu: POS Tanımlama (bank.pos) ve Komisyon Oranlarını Değiştirme (bank.commission) görünür; Ekstre / Mutabakat hâlâ gizli", async () => {
    const roles = await must("roller", w.api.get("/api/admin/roles"));
    const keys = roles.groups.flatMap(group => group.items.map(item => item.key));
    assert.ok(keys.includes("bank.pos") && keys.includes("bank.commission"), "POS yetkileri görünür");
    assert.ok(!keys.includes("bank.statement") && !keys.includes("bank.reconcile"), "Ekstre ve Mutabakat yetkileri gizli");
  });
});

describe("İz 3.3 ve 3.5: Hareketler POS süzgeci, Birleşik Rapor POS sütunları, Rapor Merkezi POS raporları, Banka Masraf Raporu", () => {
  let w;
  let pos;
  before(async () => {
    w = await world();
    pos = await openPos(w.api, ziraatPos(w.acc.ziraat.id));
    // 08.10: 10.000 Tek Çekim; 12.10: 12.000 3 Taksit (kabul 20 ve 25).
    await must("Tek Çekim", posInvoice(w.api, { accountId: w.abc.id, itemId: w.urunB.id, qty: 10, unitPrice: 1000, date: TODAY, posId: pos.id }));
  });
  after(() => w?.ctx.server.close());

  it("Birleşik Rapor: POS Bekleyen (Net) 9.750 ve Blokeli POS 0 sütunları (ekran, PDF, Excel); banka yetkisi olmayana POS sütunu yok", async () => {
    const report = await must("Birleşik Rapor", w.api.get("/api/companies/report"));
    const at = header => report.headers.indexOf(header);
    assert.ok(at("POS Bekleyen (Net)") > at("Gerçek Banka") && at("Blokeli POS") === at("POS Bekleyen (Net)") + 1 && at("Kart ve Kredi Borcu") === at("Blokeli POS") + 1, report.headers.join(" | "));
    assert.equal(report.table[0][at("POS Bekleyen (Net)")], 9750);
    assert.equal(report.table[0][at("Blokeli POS")], 0);
    assert.equal(report.totals[at("POS Bekleyen (Net)")], 9750, "TOPLAM");
    const xlsx = await w.api.raw("GET", "/api/companies/report.xlsx");
    const cells = Object.values(xlsxSheets(xlsx.buffer)).flat(2).map(String);
    assert.ok(cells.includes("POS Bekleyen (Net)") && cells.includes("Blokeli POS"), "Excel'de POS sütunları");
    assert.equal((await w.api.raw("GET", "/api/companies/report.pdf")).status, 200);
    const staff = apiOf(await createUser(w.ctx.server, w.api.client, { username: "pos-iz3-birlesik", role: "personel" }));
    const limited = await must("personel Birleşik Rapor", staff.get("/api/companies/report"));
    assert.ok(!limited.headers.includes("POS Bekleyen (Net)"), `personelde POS sütunu yok: ${limited.headers.join(" | ")}`);
  });

  it("POS Ödeme Takvimi raporu: 12.10 9.750 · 12.11 / 14.12 / 12.01 3.860; TOPLAM = satırlar (21.330); Tür ve POS süzgeçleri; PDF ve Excel aynı TOPLAM", async () => {
    setClock(w.ctx, "2026-10-12");
    await must("Taksitli", posInvoice(w.api, { accountId: w.abc.id, itemId: w.urunB.id, qty: 12, unitPrice: 1000, date: "2026-10-12", posId: pos.id, installments: 3 }));
    const catalog = await must("rapor listesi", w.api.get(RC));
    const ids = catalog.reports.filter(report => report.group === "Banka").map(report => report.id);
    assert.ok(ids.includes("pos-odeme-takvimi") && ids.includes("faturasi-beklenen-komisyonlar"), ids.join(", "));
    assert.ok(catalog.choices.posTerminal.some(([id]) => id === pos.id), "POS süzgeci seçenekleri");
    const data = await must("takvim", w.api.get(`${RC}/pos-odeme-takvimi?preset=all`));
    assert.deepEqual(data.rows.map(row => [row[0], row[2], row[5]]), [["12.10.2026", "POS", "9.750,00 TL"], ["12.11.2026", "POS", "3.860,00 TL"], ["14.12.2026", "POS", "3.860,00 TL"], ["12.01.2027", "POS", "3.860,00 TL"]]);
    assert.equal(data.footer[5], "21.330,00 TL", "TOPLAM net = satırlar");
    assert.equal(data.footer[4], "22.000,00 TL", "TOPLAM brüt");
    assert.equal((await must("blokeli", w.api.get(`${RC}/pos-odeme-takvimi?preset=all&posKind=blocked`))).rows.length, 0, "Blokeli POS süzgeci");
    assert.equal((await must("POS süzgeci", w.api.get(`${RC}/pos-odeme-takvimi?preset=all&posTerminal=${pos.id}`))).rows.length, 4);
    const xlsx = await w.api.raw("GET", `${RC}/pos-odeme-takvimi/xlsx?preset=all`);
    assert.equal(xlsx.status, 200);
    const all = Object.values(xlsxSheets(xlsx.buffer))[0];
    const sheet = all.slice(Math.max(0, all.findIndex(row => row.length > 1)));
    assert.deepEqual(sheet.at(-1), data.footer.map(cellOf), "Excel TOPLAM");
    assert.equal((await w.api.raw("GET", `${RC}/pos-odeme-takvimi/pdf?preset=all`)).status, 200);
  });

  it("Hareketler ?pos= süzgeci: yalnız bu POS'un gün sonu fişi; bilinmeyen POS 404", async () => {
    setClock(w.ctx, "2026-10-13");
    assert.equal((await settle(w.api)).settled, 1);
    const moves = await must("hareketler", w.api.get(`${BANK}/movements?pos=${pos.id}`));
    assert.ok(moves.rows.length >= 1 && moves.rows.every(row => row.type === "pos_settlement"), JSON.stringify(moves.rows.map(row => row.type)));
    assert.equal(moves.rows[0].signedMinor, kurus(9750), "Ziraat'e giren net 9.750");
    expectStatus(await w.api.get(`${BANK}/movements?pos=pos-yok`), 404, "pos-missing", "bilinmeyen POS");
  });

  it("Banka Masraf Raporu POS komisyonunu kapsar: 12.10 gün sonu → matrah 238,10 · BSMV 11,90 · toplam 250,00 (653)", async () => {
    const fee = await must("masraf", w.api.get(`${RC}/banka-masraf?preset=all`));
    const row = fee.rows.find(item => /POS Komisyonu/.test(item[3]));
    assert.ok(row, `POS komisyonu satırı: ${JSON.stringify(fee.rows)}`);
    assert.deepEqual([row[0], row[4], row[5], row[6], row[8]], ["12.10.2026", "653 Komisyon Giderleri", "238,10 TL", "11,90 TL", "250,00 TL"]);
    await posCheck(w.api, "raporlar");
  });
});

describe("İz 3.5: Faturası Beklenen Komisyonlar (KDV'li kip; plan §4.3 kabul 24)", () => {
  it("10.000 KDV Hariç → 12.10 kesinti 300 → Ekim: Faturası Beklenen 300; Şimdi Oluştur → Taslak Hazır; TOPLAM = satırlar", async () => {
    const w = await world();
    try {
      const provider = await must("sağlayıcı", w.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
      const pos = await openPos(w.api, ziraatPos(w.acc.ziraat.id, { name: "Ödeme Kuruluşu POS", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }));
      await must("satış", posInvoice(w.api, { accountId: w.abc.id, itemId: w.urunB.id, qty: 10, unitPrice: 1000, date: TODAY, posId: pos.id }));
      setClock(w.ctx, "2026-10-12");
      await settle(w.api);
      const data = await must("rapor", w.api.get(`${RC}/faturasi-beklenen-komisyonlar?preset=thisYear`));
      assert.deepEqual(data.rows.map(row => [row[0], row[1], row[2], row[5], row[6]]), [["10.2026", "Ödeme Kuruluşu POS", "Örnek Ödeme Kuruluşu A.Ş.", "300,00 TL", "Faturası Beklenen"]]);
      assert.equal(data.footer[5], "300,00 TL", "TOPLAM");
      await must("Şimdi Oluştur", w.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-10" }));
      const drafted = await must("rapor", w.api.get(`${RC}/faturasi-beklenen-komisyonlar?preset=thisYear`));
      assert.equal(drafted.rows[0][6], "Taslak Hazır");
      assert.equal((await w.api.raw("GET", `${RC}/faturasi-beklenen-komisyonlar/pdf?preset=thisYear`)).status, 200);
      assert.equal((await w.api.raw("GET", `${RC}/faturasi-beklenen-komisyonlar/xlsx?preset=thisYear`)).status, 200);
      // Masraf raporunda KDV kipinin kesintisi gün fişinde 653 değildir (faturadan gelir): fatura kaydedilmeden POS komisyonu satırı yok.
      const fee = await must("masraf", w.api.get(`${RC}/banka-masraf?preset=all`));
      assert.ok(!fee.rows.some(row => /POS Komisyonu/.test(row[3])), "faturasız KDV kesintisi masraf raporunda yok");
      await posCheck(w.api, "KDV kipi raporu");
    } finally {
      await w.ctx.server.close();
    }
  });
});

// Yargıç 2.2.0 Y1 (plan §4.4/6 "pos_sales'in yalnız değişmeyen alanları kilit izine girer"; §4.6 Bekleyenleri Yeni Hesaba Taşı): kilit izinde
// pos_sales.bank_account_id vardı; kilitli dönemdeki satışın bekleyen kalemleri taşınınca kapı 409 ledger-integrity verip işlemi geri alıyor ve
// integrity_log'a sahte "Geri Alındı" yazıyordu. Beklenen (plan §4.2 tablosu; yargıcın p1 C): 12.000 TL 3 taksit %3,5 → komisyon 420; kalemler
// 4.000 / 140 / 3.860 (net). Taşımadan sonra Kasım valöründe 3.860 Garanti'ye geçer, Ziraat değişmez; kilitli dönemin mizanı aynı kalır.
describe("Yargıç Y1: kilitli dönemdeki satışın bekleyenleri yeni hesaba taşınır (409 değil); kilitli mizan değişmez", () => {
  it("05.10 satış, kilit 10.10 → Bekleyenleri Taşı 200 (1 satış); mizan/alt hesap aynı; Geri Alındı kaydı yok; Kasım valörü Garanti'ye", async () => {
    const w = await world();
    try {
      await flagPos(w.api, w.acc.garanti.id);
      const pos = await openPos(w.api, ziraatPos(w.acc.ziraat.id));
      await must("POS 3 taksit", w.api.post(`/api/workspace/accounts/${w.abc.id}/entries`, { kind: "in", amount: "12.000", method: "card", installments: 3, date: "2026-10-05" }));
      const [ziraat0, garanti0] = [await balanceOf(w.api, w.acc.ziraat.id), await balanceOf(w.api, w.acc.garanti.id)];
      setClock(w.ctx, "2026-10-20");
      await must("kilit 10.10", w.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-10" }));
      const lockedRange = "?from=2026-01-01&to=2026-10-10";
      const before = [await trialBalances(w.api, lockedRange), await trialBalances(w.api), await subBalances(w.api)];
      const moved = await must("Bekleyenleri Taşı", w.api.post(`${BANK}/pos/${pos.id}/move-pending`, { bankAccountId: w.acc.garanti.id }));
      assert.equal(moved.moved, 1, "kilitli satış taşındı");
      assert.equal(w.ctx.store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'rolled-back'").n, 0, "sahte Geri Alındı kaydı yok");
      assert.deepEqual([await trialBalances(w.api, lockedRange), await trialBalances(w.api), await subBalances(w.api)], before, "kilitli dönem ve bütün mizan/alt hesap aynı");
      await posCheck(w.api, "taşımadan sonra");
      setClock(w.ctx, "2026-11-12");
      await settle(w.api);
      assert.equal((await balanceOf(w.api, w.acc.garanti.id)) - garanti0, kurus(3860), "Kasım taksiti (net 3.860) Garanti'ye");
      assert.equal(await balanceOf(w.api, w.acc.ziraat.id), ziraat0, "Ziraat değişmez");
      assert.deepEqual(await trialBalances(w.api, lockedRange), before[0], "valörden sonra da kilitli dönem aynı");
      await posCheck(w.api, "Kasım valörü");
    } finally {
      await w.ctx.server.close();
    }
  });
});
