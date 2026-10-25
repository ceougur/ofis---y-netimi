// 2.4.6 madde 9 — DB1 (ORTA, para çekirdeği; docs/2.4.5-IS-LISTESI.md "İKİNCİ DAR KONTROL" DB1, docs/2.4.6-IS-LISTESI.md madde 9): "iade geri ödemesi" bağı.
// Bulgu (yeniden üretme kaynağı docs/kanit/2026-10-24/245-dar2/betik/s1-iade-geri-odeme.mjs): faturasız stok Satış İadesi ya da fatura iadesi bedeli cari kartından
// "Ödeme" ile müşteriye geri ödenince fatura + vadeli borç açığı iade kadar EKSİK görünüyordu (B 200 + borç 300 = 500, bakiye 800). Kök: lib/invoice-settle.mjs
// default dalı cari "Ödeme"yi her zaman borç tarafında ödeme sayıyor; iade alacağı en eski açık faturayı kapatıyor, geri ödeme onu yeniden açmıyordu.
// KURAL (önceden yazılmış metin — v2.1.0 R1, invoice-settle.mjs "iadenin GERİ ÖDEMESİ ödeme değil, iadenin alacağını geri alan yükümlülüktür" + K1 adım R "iadenin
// geri ödemesi iade belgesinin kendi alacağıyla kapanır"; 2.4.5 öneri metni "geri ödeme iadeye bağlanır, R1 düzeni") + ana oturum kararları (docs/2.4.6-IS-LISTESI.md
// "KARAR — 5 DK YETKİSİYLE UYGULANDI", 25.10.2026): K-d Ödeme'de "Kapatılacak Fatura" olarak müşteriye ait İADE seçilir (öbür yönler aynen reddedilir); K-c tedarikçinin
// Tahsilat ile geri ödemesi alış iadesine bağlanır; K-a yalnız iade kadarı geri ödeme, fazlası avans (alacak tarafında yükümlülük değil); K-b iadeye bağlanmamış
// Ödeme açık iadeler ve elle Alacak arasında TEK FIFO (en eskiden); K-e her ödeme yolu (nakit, havale, kart, çek) geri ödeme sayılır; K-f cari türüne bakılmaz.
// Cari bakiye, Kasa ve yevmiye DEĞİŞMEZ. Beklenen sayılar programdan değil, bu metinlerden elle (ders 5).
// "Nasıl bozulur?": bağ yok sayılır (eski); bağ yanlış tarafta (Tahsilat → satıştan iade); geri ödeme iadeden fazla (fazlası avans olmalı, reddedilmemeli); başka
// carinin iadesi; Kapatılacak Fatura ile birlikte; kısmi geri ödeme; bağ sonradan eklenir / kaldırılır (bakiye, Kasa, mizan aynı kalmalı); geri ödeme silinip geri
// yüklenir; iade silinir / küçültülür / geri yüklenir; iade belgesi düzenlenip kendi geri ödemesi + bağlı geri ödeme iadeyi aşar; bağsız Ödeme eski kuralda önce elle
// Alacak'ı kapatıyordu (K-b); çekle geri ödeme bağlanmıyordu (K-e); tedarikçi tarafı simetriği (alıştan iade faturası, faturasız Alış İadesi).
// Sahte DURAĞAN saat (ders 13); HUKUK_LICENSE_URL (ders 30).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { classifyLine, settleLedger } from "../server/lib/invoice-settle.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const ROLE = { recvDue: false, recvPay: false, payDue: false, payPay: false };

describe("DB1 classifyLine (saf): iadeye bağlı geri ödeme yükümlülüktür; bağsız Ödeme / Tahsilat değişmedi", () => {
  const line = extra => ({ id: "x", origin: "account", kind: "", date: "2026-10-01", debit: 0, credit: 0, ...extra });
  it("müşteriye bağlı Ödeme (çıkış) alacak tarafında yükümlülük; tedarikçiden bağlı Tahsilat (giriş) borç tarafında yükümlülük", () => {
    assert.deepEqual(classifyLine(line({ kind: "out", debit: 300, refundOf: "smove-1" })), { ...ROLE, recvDue: true });
    assert.deepEqual(classifyLine(line({ kind: "in", credit: 300, refundOf: "inv-ret" })), { ...ROLE, payDue: true });
  });
  it("bağsız Ödeme borç tarafında, bağsız Tahsilat alacak tarafında ödeme (R1c, değişmedi); Borç / Alacak Yaz yükümlülük", () => {
    assert.deepEqual(classifyLine(line({ kind: "out", debit: 300 })), { ...ROLE, payPay: true });
    assert.deepEqual(classifyLine(line({ kind: "in", credit: 300 })), { ...ROLE, recvPay: true });
    assert.deepEqual(classifyLine(line({ kind: "debt", debit: 300, refundOf: "smove-1" })), { ...ROLE, recvDue: true }, "bağ yalnız Tahsilat / Ödeme'de anlamlı");
    assert.deepEqual(classifyLine(line({ origin: "stock", kind: "out", debit: 300, refundOf: "smove-1" })), { ...ROLE, recvDue: true }, "modül satırında bağ okunmaz");
    assert.deepEqual(classifyLine(line({ origin: "", kind: "out", debit: 300, refundOf: "smove-1" })), { ...ROLE, payPay: true }, "bağ yalnız elle cari satırında (origin account) okunur");
  });
});

describe("DB1 settleLedger (saf): faturasız stok iadesinin bağlı geri ödemesi iadenin alacağıyla kapanır", () => {
  const invoices = [{ id: "B", kind: "sale", status: "issued", payable: 500, dueDate: "2026-09-30", issuedAt: "2026-09-20T10:00:00" }];
  const base = [
    { id: "lB", origin: "invoice", kind: "debt", sourceId: "B", date: "2026-09-20", at: "2026-09-20T10:00:00", debit: 500, credit: 0 },
    { id: "lD", origin: "account", kind: "debt", date: "2026-09-25", at: "2026-09-25T10:00:00", debit: 300, credit: 0 },
    { id: "lR", origin: "stock", kind: "credit", sourceId: "smove-1", stockReason: "return", date: "2026-10-15", at: "2026-10-15T10:00:00", debit: 0, credit: 300 },
  ];
  const refund = extra => ({ id: "lP", origin: "account", kind: "out", date: "2026-10-16", at: "2026-10-16T10:00:00", debit: 300, credit: 0, ...extra });
  it("bağlı: fatura 500 ve borç 300 açık kalır (Σ 800 = bakiye); geri ödeme kapandı", () => {
    const out = settleLedger({ lines: [...base, refund({ refundOf: "smove-1" })], invoices, today: TODAY });
    assert.equal(out.invoices.get("B").open, 500);
    assert.equal(out.entries.get("lD").remaining, 300);
    assert.equal(out.entries.get("lP").remaining, 0);
  });
  it("kısmi: 100 bağlı geri ödeme → iadenin 200'ü en eski açık borcu (fatura) kapatır", () => {
    const out = settleLedger({ lines: [...base, refund({ refundOf: "smove-1", debit: 100 })], invoices, today: TODAY });
    assert.equal(out.invoices.get("B").open, 300);
    assert.equal(out.entries.get("lD").remaining, 300);
  });
  it("bağsız (seçilmedi): eski düzen — iade faturayı kapatır, geri ödeme açmaz (B 200)", () => {
    const out = settleLedger({ lines: [...base, refund({})], invoices, today: TODAY });
    assert.equal(out.invoices.get("B").open, 200);
  });
  it("K-a: iadesi silinmiş bağlı geri ödemenin kalanı 0 → tamamı avans (yükümlülük değil); B 500", () => {
    const out = settleLedger({ lines: [base[0], base[1], refund({ refundOf: "smove-1" })], invoices, today: TODAY });
    assert.equal(out.invoices.get("B").open, 500);
    assert.equal(out.entries.has("lP"), false, "geri ödeme açık yükümlülük olmaz");
  });
  it("K-a: iadeden fazla (500 > 300) — 300 geri ödeme, 200 avans: B 500, borç 300; avans önce elle Alacak'ı kapatır, kalanı bakiyede", () => {
    const over = refund({ refundOf: "smove-1", debit: 500 });
    let out = settleLedger({ lines: [...base, over], invoices, today: TODAY });
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lD").remaining, out.entries.get("lP").remaining], [500, 300, 0]);
    const credit = { id: "lA", origin: "account", kind: "credit", date: "2026-09-28", at: "2026-09-28T10:00:00", debit: 0, credit: 150 };
    out = settleLedger({ lines: [...base, credit, over], invoices, today: TODAY });
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lA").remaining], [500, 0], "avans 200: elle Alacak 150 kapandı (50 bakiyede)");
  });
});

describe("K-b settleLedger (saf): iadeye bağlanmamış Ödeme açık iadeler ve elle Alacak arasında tek sıra, en eskiden", () => {
  const ret = date => ({ id: "lR", origin: "stock", kind: "credit", sourceId: "smove-9", stockReason: "return", date, at: `${date}T10:00:00`, debit: 0, credit: 300 });
  const credit = date => ({ id: "lA", origin: "account", kind: "credit", date, at: `${date}T10:00:00`, debit: 0, credit: 200 });
  const pay = { id: "lP", origin: "account", kind: "out", date: "2026-10-10", at: "2026-10-10T10:00:00", debit: 300, credit: 0 };
  it("açık iade (10-01) elle Alacak'tan (10-05) eski: Ödeme 300 önce iadeyi kapatır → Alacak 200 açık kalır (eski kural: Alacak kapanıyordu)", () => {
    const out = settleLedger({ lines: [ret("2026-10-01"), credit("2026-10-05"), pay], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lA").remaining, 200);
  });
  it("elle Alacak (09-25) iadeden (10-01) eski: önce Alacak 200, kalan 100 iadeye → Alacak 0", () => {
    const out = settleLedger({ lines: [ret("2026-10-01"), credit("2026-09-25"), pay], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lA").remaining, 0);
  });
  it("Tahsilat simetriği: açık Alış İadesi (preturn) elle Borç'tan eski → bağsız Tahsilat önce iadeyi kapatır, borç açık kalır", () => {
    const preturn = { id: "lQ", origin: "stock", kind: "debt", sourceId: "smove-8", stockReason: "preturn", date: "2026-10-01", at: "2026-10-01T10:00:00", debit: 300, credit: 0 };
    const debt = { id: "lD", origin: "account", kind: "debt", date: "2026-10-05", at: "2026-10-05T10:00:00", debit: 200, credit: 0 };
    const collect = { id: "lT", origin: "account", kind: "in", date: "2026-10-10", at: "2026-10-10T10:00:00", debit: 0, credit: 300 };
    const out = settleLedger({ lines: [preturn, debt, collect], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lD").remaining, 200);
  });
});

describe("DB1 API: cari kartından iade geri ödemesi iadeye bağlanır (Geri Ödenen İade)", () => {
  let server;
  let api;
  let goods;
  let n = 0;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, legacyCasePayments: false, legacyTableTransfer: false, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    goods = (await api.post("/api/workspace/stock", { kind: "goods", code: "URN-DB1", name: "Ürün DB1", unit: "Adet", salePrice: "100", unitPrice: "100", openingQty: "1000" })).data;
  });
  after(async () => server?.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const refused = async (label, promise, status, code) => {
    const res = await promise;
    assert.equal(res.status, status, `${label}: beklenen ${status}, gelen ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    if (code) assert.equal(res.data?.code ?? res.data?.error?.code ?? res.data?.data?.code, code, `${label}: kod ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const card = acc => must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const invoice = async id => {
    const doc = await must("fatura oku", api.get(`/api/workspace/invoices/${id}`));
    return [doc.payState, doc.open];
  };
  const duesOf = async acc => (await must("takvim", api.get("/api/workspace/dues"))).items.filter(row => row.accountId === acc.id || row.person === acc.name).map(row => [row.source, row.amount]).sort();
  const vadeOf = async acc => (await must("vade takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-1100)}&to=${day(30)}`))).rows.filter(row => row.party === acc.name).map(row => [row.source, row.amount]).sort();
  const facts = async acc => {
    const ledger = await must("defter", api.get("/api/workspace/ledger"));
    const cash = await must("kasa", api.get("/api/workspace/cash"));
    return JSON.stringify({ trial: ledger.trial, cash: cash.totals, balance: (await card(acc)).totals });
  };
  // Kırmızı kanıtta (eski kod, ders 38) ilk düşen denetim iş sonucu olsun (B'nin açığı): satır kimliği bağ kolonuna bakmadan okunur; kolon sonra.
  const lastEntry = acc => server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", acc.id);
  const refundOfDb = id => server.app.store.get("SELECT refund_of AS refundOf FROM account_entries WHERE id = ?", id).refundOf;
  // dar2 S1 akışı (göreli günlerle): A 1.000 (t, tahsil edildi) → B 500 (t+30, vade t+40) → elle Borç 300 (t+35, vade t+50) → iade 300 (t+55) → geri ödeme
  // 300 (t+56, testte). Bakiye 800. Fatura serisi tarih sırası ister: her kurulum bir öncekinden sonraki 60 günü kullanır (t = −960, −900, …; hepsi geçmişte).
  let cursor = -960;
  async function setup(label, { mode = "stock", docRefund = 0, type = "customer" } = {}) {
    const t = cursor;
    cursor += 60;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: `DB1 ${label}`, type, registeredOn: day(-1000), phone: `0500 246 00 ${String((n += 1)).padStart(2, "0")}` }));
    const a = await must("fatura A", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(t + 10) } }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "1000", date: day(t + 5), method: "cash" }));
    const b = await must("fatura B", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t + 30), lines: [{ itemId: goods.id, qty: 5, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(t + 40) } }));
    const before_ = new Set((await card(acc)).entries.map(row => row.id));
    const debtCard = await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "300", date: day(t + 35), dueDate: day(t + 50) }));
    const debt = debtCard.entries.find(row => !before_.has(row.id));
    let target;
    if (mode === "stock") {
      await must("stok iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "3", unitPrice: "100", pay: "account", accountId: acc.id, date: day(t + 55) }));
      target = server.app.store.get("SELECT id FROM stock_moves WHERE account_id = ? AND reason = 'return' ORDER BY rowid DESC LIMIT 1", acc.id).id;
    } else {
      const full = await must("A oku", api.get(`/api/workspace/invoices/${a.id}`));
      target = (await must("iade faturası", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: a.id, issueDate: day(t + 55), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash: docRefund ? [{ amount: String(docRefund), method: "cash", date: day(t + 55) }] : [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }))).id;
    }
    return { acc, a: a.id, b: b.id, debt, target, at: offset => day(t + offset) };
  }
  const remaining = async (acc, id) => (await card(acc)).entries.find(row => row.id === id).remaining;

  it("faturasız stok Satış İadesi + bağlı Ödeme: fatura B 500 ve borç 300 açık (Σ 800 = bakiye), takvim / Vade Takip aynı; bakiye, Kasa, mizan bağla değişmez", async () => {
    const { acc, a, b, debt, target, at } = await setup("Stok");
    // Önce bağsız (eski düzen) — sonra aynı satıra bağ eklenir: para kaydı aynı, yalnız kapama değişir.
    await must("geri ödeme (bağsız)", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true }));
    const pay = lastEntry(acc);
    assert.deepEqual(await invoice(b), ["overdue", 200], "bağsız: eski düzen (R1c) — B 200");
    const before_ = await facts(acc);
    const linked = await must("bağ ekle", api.put(`/api/workspace/accounts/${acc.id}/entries/${pay.id}`, { refundOf: target }));
    assert.equal(linked.totals.balance, 800, "bakiye 1.000 + 500 + 300 − 1.000 − 300 + 300");
    assert.deepEqual(await invoice(b), ["overdue", 500], "bağlı: iadenin alacağı geri ödemeyi kapatır, B'yi kapatmaz");
    assert.equal(refundOfDb(pay.id), target, "veri tabanında refund_of yazıldı");
    assert.equal(linked.entries.find(row => row.id === pay.id).refundOf, target);
    assert.match(linked.entries.find(row => row.id === pay.id).refundLabel || "", /Satış İadesi \(Faturasız\)/);
    assert.deepEqual(await invoice(a), ["paid", 0]);
    assert.equal(await remaining(acc, debt.id), 300, "vadeli borç açık");
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]], "takvim / zil: B 500 + borç 300");
    assert.deepEqual(await vadeOf(acc), [["account", 300], ["invoice", 500]], "Vade Takip takvimle aynı");
    assert.equal(await facts(acc), before_, "bakiye, Kasa ve mizan bağ eklenince değişmez");
    assert.deepEqual((await card(acc)).refundables, [], "iadenin tamamı geri ödendi: seçenek kalmadı");
    await must("bağı kaldır", api.put(`/api/workspace/accounts/${acc.id}/entries/${pay.id}`, { refundOf: "" }));
    assert.deepEqual(await invoice(b), ["overdue", 200], "bağ kaldırılınca bağsız düzen");
    assert.deepEqual((await card(acc)).refundables.map(item => [item.id, item.refundKind, item.left]), [[target, "out", 300]], "Ödeme formunun seçeneği yeniden: iade, kalan 300");
    assert.equal(await facts(acc), before_, "bağ kaldırılınca da bakiye, Kasa ve mizan aynı");
  });

  it("K-d: fatura iadesi (satıştan iade belgesi) Ödeme'de Kapatılacak Fatura olarak seçilir: B 500, borç 300; bağ refund_of'ta (invoice_id boş); iadenin kapatanı bu geri ödeme", async () => {
    const { acc, b, debt, target, at } = await setup("Fatura", { mode: "invoice" });
    await must("Kapatılacak Fatura: iade", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, invoiceId: target }));
    const pay = lastEntry(acc);
    assert.equal((await card(acc)).totals.balance, 800);
    assert.deepEqual(await invoice(b), ["overdue", 500]);
    assert.equal(refundOfDb(pay.id), target);
    assert.equal(server.app.store.get("SELECT invoice_id AS v FROM account_entries WHERE id = ?", pay.id).v, "", "invoice_id boş (şüpheli alacak kuralı ve yevmiye değişmez)");
    assert.equal(await remaining(acc, debt.id), 300);
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]]);
    const ret = await must("iade oku", api.get(`/api/workspace/invoices/${target}`));
    assert.equal(ret.payState, "return");
    assert.equal(ret.open, 0, "iade belgesi açığı 0 (geri ödendi)");
    assert.deepEqual(ret.closers.map(item => [item.id, item.amount, item.mode]), [[pay.id, 300, "linked"]], "iadenin kapatanı cari kartındaki geri ödeme (Bağlı)");
  });

  it("K-a kısmi + fazla: bağlı 100 → iadenin kalan 200'ü B'yi kapatır (B 300); ikinci bağlı 250 → 200 geri ödeme + 50 avans (reddedilmez): B 500", async () => {
    const { acc, b, debt, target, at } = await setup("Kısmi");
    await must("kısmi geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    assert.equal((await card(acc)).totals.balance, 600);
    assert.deepEqual(await invoice(b), ["overdue", 300]);
    assert.equal(await remaining(acc, debt.id), 300);
    assert.deepEqual((await card(acc)).refundables.map(item => [item.id, item.left]), [[target, 200]], "seçenekte kalan 200");
    await must("kalanı aşan ikinci geri ödeme (K-a: kabul)", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "250", date: at(57), method: "cash", cashForce: true, refundOf: target }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "iadenin tamamı geri ödendi: B 500");
    assert.equal(await remaining(acc, debt.id), 300, "avans 50 borcu kapatmaz (alacak tarafında ödeme değil)");
    assert.equal((await card(acc)).totals.balance, 850, "bakiye 600 + 250; açık kalemler B 500 + borç 300, avans 50 kalemsiz");
    assert.deepEqual((await card(acc)).refundables, []);
  });

  it("iade belgesinin kendi geri ödemesi (100) kalanı düşürür: cari kartından bağlanan 250'nin 200'ü geri ödeme, 50'si avans (K-a); B 500", async () => {
    const { acc, b, target, at } = await setup("Belge Geri Ödeme", { mode: "invoice", docRefund: 100 });
    assert.deepEqual(await invoice(b), ["overdue", 300], "belge 100 geri ödedi: iadenin kalan 200'ü asıl faturaya mahsup (K1), serbest kalan tahsilat B'yi 200 kapatır → B 300");
    assert.deepEqual((await card(acc)).refundables.map(item => [item.id, item.left]), [[target, 200]], "seçenekte kalan 200 (300 − belgedeki 100)");
    await must("kalanı aşan bağlı geri ödeme (250 > 200; K-a: kabul)", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "250", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "iadenin tamamı geri ödendi (100 belge + 200 cari), 50 avans: B 500");
    assert.deepEqual((await card(acc)).refundables, []);
    // Kapama çekirdeğinin kendi bölmesi (seçenek listesinden bağımsız): bağlı 250'nin geri ödeme kısmı 200 (300 − belgedeki 100) iadeyle kapanır, açık kalmaz;
    // belgedeki geri ödeme kalandan düşmeseydi bağlı satırın 250'si geri ödeme sayılır, iade 300'ü aşan 50 açık yükümlülük kalırdı.
    const linked = lastEntry(acc).id;
    assert.equal(server.app.context.invoices.allEntryStates().get(linked)?.remaining ?? 0, 0, "bağlı geri ödemenin açık kalanı 0 (50 avans yükümlülük değil)");
  });

  it("reddedilen bağlar (öbür yönler aynen, K-d): ters yön (refundOf ve Kapatılacak Fatura yolu), başka carinin iadesi, satış faturası + iade birlikte, Borç Yaz'da, peşin iade, iptal edilmiş iade", async () => {
    const { acc, b, target, at } = await setup("Ret");
    const other = await setup("Ret Öbür");
    const entries = `/api/workspace/accounts/${acc.id}/entries`;
    const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n;
    const was = count();
    await refused("Tahsilat → satıştan iade", api.post(entries, { kind: "in", amount: "100", date: at(56), method: "cash", refundOf: target }), 409, "refund-side");
    await refused("Tahsilat → satıştan iade (Kapatılacak Fatura yolu)", api.post(entries, { kind: "in", amount: "100", date: at(56), method: "cash", invoiceId: target }), 409, "refund-side");
    await refused("Ödeme → satış faturası (Kapatılacak Fatura)", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, invoiceId: b }), 409);
    await refused("başka carinin iadesi", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: other.target }), 404, "refund-missing");
    await refused("Kapatılacak Fatura ile birlikte", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: target, invoiceId: b }), 409);
    await refused("Borç Yaz'da", api.post(entries, { kind: "debt", amount: "100", date: at(56), refundOf: target }), 400, "refund-kind");
    await must("peşin iade (Kasa'dan geri verildi)", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "100", pay: "cash", method: "cash", date: at(57), cashForce: true }));
    const cashReturn = server.app.store.get("SELECT id FROM stock_moves WHERE reason = 'return' AND pay = 'cash' ORDER BY rowid DESC LIMIT 1").id;
    await refused("peşin iade cariye yazılmadı", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: cashReturn }), 404, "refund-missing");
    assert.equal(count(), was, "reddedilen isteklerin hiçbiri satır yazmadı (ders 3)");
    const inv = await setup("Ret İptal", { mode: "invoice" });
    await must("iadeyi iptal et", api.post(`/api/workspace/invoices/${inv.target}/cancel`, { reason: "deneme", force: true, cashForce: true }));
    await refused("iptal edilmiş iade", api.post(`/api/workspace/accounts/${inv.acc.id}/entries`, { kind: "out", amount: "100", date: inv.at(56), method: "cash", cashForce: true, refundOf: inv.target }), 409, "refund-invalid");
  });

  it("geri ödeme silinir → bağsız iade B'yi kapatır; Silinenler'den geri gelince bağ korunur", async () => {
    const { acc, b, target, at } = await setup("Sil");
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    const pay = lastEntry(acc);
    await must("geri ödemeyi sil", api.del(`/api/workspace/accounts/${acc.id}/entries/${pay.id}?cashForce=1`));
    assert.deepEqual(await invoice(b), ["overdue", 200], "geri ödeme yokken iade alacağı B'yi kapatır");
    const item = server.app.store.get("SELECT id FROM trash WHERE ref = ? ORDER BY rowid DESC LIMIT 1", pay.id);
    assert.ok(item, "Silinenler'de");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${item.id}` }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "geri yüklenen geri ödeme yine iadeye bağlı");
    assert.equal(refundOfDb(pay.id), target, "bağ geri yüklemede korundu");
  });

  it("iade silinince bağlı geri ödemenin tamamı avans olur (K-a; B 500, borç 300 açık); iade geri yüklenince yeniden eşleşir", async () => {
    const { acc, b, debt, target, at } = await setup("İade Sil");
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    await must("stok iadesini sil", api.del(`/api/workspace/stock/${goods.id}/moves/${target}`));
    const after_ = await card(acc);
    assert.equal(after_.totals.balance, 1100, "bakiye 1.000 + 500 + 300 − 1.000 + 300");
    assert.deepEqual(await invoice(b), ["overdue", 500]);
    assert.equal(await remaining(acc, debt.id), 300);
    assert.match(after_.entries.find(row => row.refundOf === target).refundLabel, /bulunamadı/, "kart iadenin silindiğini söyler");
    const item = server.app.store.get("SELECT id FROM trash WHERE ref = ? ORDER BY rowid DESC LIMIT 1", target);
    await must("iadeyi geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${item.id}` }));
    assert.equal((await card(acc)).totals.balance, 800);
    assert.deepEqual(await invoice(b), ["overdue", 500]);
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]]);
  });

  it("bağlı geri ödemesi olan stok iadesi düzeltilir (K-a): küçülünce fazlası avans (B 500), büyüyünce artanı B'yi kapatır (B 400), Kasa'ya çevrilince tamamı avans (B 500)", async () => {
    const { acc, b, debt, target, at } = await setup("Stok Düzelt");
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    const move = `/api/workspace/stock/${goods.id}/moves/${target}`;
    await must("iade 2 adede (200 < 300)", api.put(move, { qty: "2" }));
    assert.deepEqual([await invoice(b), await remaining(acc, debt.id)], [["overdue", 500], 300], "iade 200 → geri ödeme 200, avans 100");
    await must("iade 4 adede (400 > 300)", api.put(move, { qty: "4" }));
    assert.deepEqual(await invoice(b), ["overdue", 400], "iade 400: önce geri ödeme 300, kalan 100 en eski açık borcu (B) kapatır");
    await must("iade Kasa'dan (cariye yazılmaz)", api.put(move, { pay: "cash", method: "cash", cashForce: true }));
    assert.deepEqual([await invoice(b), await remaining(acc, debt.id)], [["overdue", 500], 300], "iadenin carideki alacağı yok → geri ödemenin tamamı avans");
  });

  it("iade belgesi düzenlenip kendi geri ödemesi + cari kartından bağlı geri ödeme iadeyi aşarsa (150 + 200 > 300) kaydedilir; belgeninki önce, bağlının fazlası avans (K-a): B 500", async () => {
    const { acc, a, b, target, at } = await setup("Belge Sınırı", { mode: "invoice" });
    await must("bağlı geri ödeme 200", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "200", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    const full = await must("A oku", api.get(`/api/workspace/invoices/${a}`));
    const body = (cash) => ({ kind: "sale_return", accountId: acc.id, originalId: a, issueDate: at(55), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash, cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true });
    await must("belgede 150 (150 + bağlı 200 > 300)", api.post(`/api/workspace/invoices/${target}/edit`, body([{ amount: "150", method: "cash", date: at(56) }])));
    assert.deepEqual(await invoice(b), ["overdue", 500], "iade 300'ün 150'si belgede, 150'si bağlı geri ödemede; bağlının 50'si avans");
    const ret = await must("iade oku", api.get(`/api/workspace/invoices/${target}`));
    assert.equal(ret.open, 0);
  });

  it("K-e: verilen çek (Kapatılacak Fatura: satıştan iade) iadenin geri ödemesidir — B 500; alınan çek iadeye bağlanmaz (409)", async () => {
    const { acc, b, debt, target, at } = await setup("Çek", { mode: "invoice" });
    const cheque = { instrument: "cheque", accountId: acc.id, amount: 300, issueDate: at(56), dueDate: day(30), invoiceId: target };
    await refused("alınan evrak → satıştan iade", api.post("/api/workspace/cheques", { ...cheque, direction: "in", serialNo: "DB1-C1" }), 409);
    await must("verilen çek: iade geri ödemesi", api.post("/api/workspace/cheques", { ...cheque, direction: "out", serialNo: "DB1-C2" }));
    assert.deepEqual([await invoice(b), await remaining(acc, debt.id)], [["overdue", 500], 300]);
    const ret = await must("iade oku", api.get(`/api/workspace/invoices/${target}`));
    assert.deepEqual([ret.open, ret.closers.length, ret.closers[0]?.amount], [0, 1, 300], "iadenin kapatanı verilen çek");
  });

  it("K-f: kural cari türüne bakmaz — Tedarikçi türündeki caride de satıştan iadenin geri ödemesi bağlanır (B 500)", async () => {
    const { acc, b, target, at } = await setup("Tür Tedarikçi", { type: "supplier" });
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, invoiceId: target }));
    assert.deepEqual(await invoice(b), ["overdue", 500]);
  });

  it("K-b: iadeye bağlanmamış Ödeme açık iade belgesi (eski) ile elle Alacak (yeni) arasında en eskiden: iade açığı 0, Alacak 200 açık (eski kural: Alacak 0, iade açığı 200)", async () => {
    const t = cursor;
    cursor += 60;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "DB1 Tek Sıra", type: "customer", registeredOn: day(-1000), phone: "0500 246 09 99" }));
    // A peşin ödendi (faturaya bağlı): iadenin alacağı asıl faturaya mahsup edilemez → iade belgesi açık 300 (K1).
    const a = await must("fatura A (peşin)", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { cash: [{ amount: "1000", method: "cash", date: day(t) }], rest: "open", dueDate: day(t + 10) } }));
    const full = await must("A oku", api.get(`/api/workspace/invoices/${a.id}`));
    const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: a.id, issueDate: day(t + 20), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    const before_ = new Set((await card(acc)).entries.map(row => row.id));
    const credited = await must("elle Alacak", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "credit", amount: "200", date: day(t + 30) }));
    const credit = credited.entries.find(row => !before_.has(row.id));
    assert.equal((await must("iade oku", api.get(`/api/workspace/invoices/${ret.id}`))).open, 300, "ön koşul: iade açığı 300 (asıl fatura ödenmiş)");
    await must("bağsız Ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: day(t + 40), method: "cash", cashForce: true }));
    assert.equal((await must("iade oku", api.get(`/api/workspace/invoices/${ret.id}`))).open, 0, "eski açık iade önce kapandı");
    assert.equal(await remaining(acc, credit.id), 200, "yeni elle Alacak açık kalır");
    assert.equal((await card(acc)).totals.balance, -200, "bakiye 1.000 − 1.000 − 300 − 200 + 300 = Alacak 200");
  });

  it("tedarikçi simetriği: alıştan iade faturası + tedarikçiden bağlı Tahsilat → açık alış faturası kapanmaz", async () => {
    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "DB1 Tedarikçi", type: "supplier", registeredOn: day(-400) }));
    const p1 = await must("alış P1", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "DB1-P1", issueDate: day(-50), pricesIncludeVat: false, lines: [{ itemId: goods.id, qty: 4, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: day(-40) } }));
    await must("P1 ödemesi", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "400", date: day(-45), method: "cash", cashForce: true }));
    const p2 = await must("alış P2", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "DB1-P2", issueDate: day(-30), pricesIncludeVat: false, lines: [{ itemId: goods.id, qty: 3, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: day(-20) } }));
    const full = await must("P1 oku", api.get(`/api/workspace/invoices/${p1.id}`));
    const ret = await must("alıştan iade", api.post("/api/workspace/invoices", { kind: "purchase_return", accountId: supplier.id, originalId: p1.id, number: "DB1-R1", issueDate: day(-10), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    assert.deepEqual(await invoice(p2.id), ["overdue", 200], "bağsız: iadenin artanı en eski açık alışı (P2) kapatır");
    // Tedarikçiye kesilmiş satış faturası (Kapatılacak Fatura olarak geçerli) + bağ birlikte: iade geri ödemesi fatura kapatmaz → 400 (hiçbir satır yazılmaz).
    const sale = await must("tedarikçiye satış", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: supplier.id, issueDate: day(-9), lines: [{ itemId: goods.id, qty: 1, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(-9) } }));
    const rows = () => server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", supplier.id).n;
    const was = rows();
    await refused("Kapatılacak Fatura + Geri Ödenen İade", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "in", amount: "100", date: day(-9), method: "cash", refundOf: ret.id, invoiceId: sale.id }), 400, "refund-with-invoice");
    assert.equal(rows(), was, "reddedilen istek satır yazmadı");
    await must("satışı iptal et", api.post(`/api/workspace/invoices/${sale.id}/cancel`, { reason: "deneme", force: true, cashForce: true }));
    await must("tedarikçinin geri ödemesi (bağlı Tahsilat)", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "in", amount: "100", date: day(-9), method: "cash", refundOf: ret.id }));
    assert.deepEqual(await invoice(p2.id), ["overdue", 300], "bağlı: iadenin alacağı geri ödemeyi kapatır, P2 açık 300");
    assert.equal((await card(supplier)).totals.balance, -300, "tedarikçiye borcumuz 300");
    assert.deepEqual((await card(supplier)).refundables, [], "alıştan iadenin tamamı geri alındı");
    await refused("Ödeme → alıştan iade", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "100", date: day(-9), method: "cash", cashForce: true, refundOf: ret.id }), 409, "refund-side");
  });
});
