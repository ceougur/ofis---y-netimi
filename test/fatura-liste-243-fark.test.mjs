// 2.4.3 H3 (fatura modülü yükte hız testi, docs/kanit/2026-10-17/hiz-fatura): GET /api/workspace/invoices her istekte bütün belgeleri ağır
// sütunlarıyla okuyup şekillendiriyor, sonra 200'ünü gönderiyordu. Artık süzgeç, ödeme durumu, sıralama ve toplamlar hafif satırlardan;
// ağır sütunlar ve satırın tam şekli yalnız sayfadaki satırlar için (routes/invoices.mjs list(user, query, page)).
// FARK TESTİ: aynı veride liste ucunun yanıtı, eski yol (sayfasız list(): önce bütün satırlar şekillenir, sonra süzgeç/sıralama/toplam —
// 2.4.2 / 4d546e9 algoritması, PDF ve Excel hâlâ bunu kullanır) + eski ucun dilimlemesiyle BAYT BAYT aynı olmalı: her sekme (Gönderilecekler
// dahil), sıralama, ödeme durumu, arama, tarih, belge türü, cari, kalem, sayfa (offset/limit). Veri programın API'sinden, tohumlu rastgele;
// sahte saat DURUR (bütün belgeler aynı oluşturma anında: aynı tarih/saatteki belgelerin sırası satır okuma sırasına kalır — yeni yol okuma
// sırasını değiştirirse bu test yakalar).
// Ayrıca (eski kodda kırmızı): sayfa dışındaki belgeler ağır sütunlarla (satıcı/alıcı JSON'u, defter) okunmaz.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { TODAY as POS_TODAY, bootBank, must, openAcceptanceAccounts, openPos, posInvoice, ziraatPos } from "./banka-220-pos-ortak.mjs";

const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// Geçerli T.C. kimlik numarası (algoritmayla; gerçek kişiye ait değil).
const tckn = seed => {
  const d = [1 + (seed % 9), ...String(seed * 7919 + 12345678).padStart(8, "0").slice(-8).split("").map(Number)];
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join("");
};
const TODAY = "2026-10-01";
const addDays = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
// Eski ucun limit/offset okuması (2.4.2 routes/invoices.mjs GET /api/workspace/invoices, aynen).
const oldPage = (params, data) => {
  const limit = Math.min(5000, Math.max(1, Math.trunc(Number(params.get("limit")) || 200)));
  const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
  return { ...data, invoices: data.invoices.slice(offset, offset + limit), total: data.invoices.length, offset, limit, hasMore: offset + limit < data.invoices.length };
};

describe("fatura listesi (2.4.3 H3): sayfalı uç = eski yol + dilim, bayt bayt", () => {
  let server;
  let mock;
  let api;
  let store;
  const made = { sale: 0, purchase: 0, draft: 0, sale_return: 0, purchase_return: 0, cancel: 0, payment: 0, waiting: 0 };
  const refused = {};
  const refuse = (kind, response) => (refused[kind] ||= `${response.status} ${JSON.stringify(response.data).slice(0, 200)}`);
  const accountsAll = [];
  const items = [];
  before(async () => {
    mock = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, now: { time: `${TODAY}T09:30:00.000Z`, fixed: true }, gateVerify: false });
    store = server.app.context.store;
    const client = await loginAdmin(server);
    api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => {
        const response = await client.post(url, body);
        return { status: response.status, data: unwrap(response) };
      },
      put: async (url, body) => client.put(url, body),
    };
    assert.equal((await api.post("/api/workspace/bank/setup/dismiss", {})).status, 200);
    const year = Number(TODAY.slice(0, 4));
    const settings = await api.put("/api/workspace/invoices/settings", {
      seller: { name: "FARK TEST TİCARET A.Ş.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@farktest.com.tr" },
      efatura: true,
      earsiv: true,
      start: { [`TEF${year}`]: 500000001, [`TEA${year}`]: 500000001 },
      integrator: { env: "test", baseUrl: mock.url, username: "kullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
    });
    assert.equal(settings.status, 200, JSON.stringify(settings.data).slice(0, 300));
    const random = rng(2431);
    const pick = list => list[Math.floor(random() * list.length)];
    const int = (a, b) => a + Math.floor(random() * (b - a + 1));
    const addr = { taxOffice: "Merkez", address: "Cumhuriyet Cd. No: 5", district: "Merkez", city: "Bursa" };
    // Cariler: e-Fatura mükellefi firmalar (aynı adın farklı yazımları dahil, sıralama için), mükellef olmayan firmalar, şahıslar, tedarikçiler.
    const customers = [];
    const suppliers = [];
    for (let i = 0; i < 6; i += 1) {
      const name = ["Çınar Yapı", "çınar Gıda", "Şahin Tekstil", "İnci Medikal", "Ilgaz Lojistik", "Öz Bilişim"][i] + ` ${String(i + 1).padStart(2, "0")} A.Ş.`;
      const created = await api.post("/api/workspace/accounts", { name, type: "customer", taxNo: BUYER_VKN, ...addr, eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr", registeredOn: addDays(TODAY, -400) });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      customers.push({ id: created.data.id, name, efatura: true });
    }
    for (let i = 0; i < 8; i += 1) {
      const name = `Ticaret ${String(i + 1).padStart(2, "0")} Ltd. Şti.`;
      const created = await api.post("/api/workspace/accounts", { name, type: "customer", taxNo: vkn(300000000 + i * 7777), ...addr, registeredOn: addDays(TODAY, -400) });
      customers.push({ id: created.data.id, name });
    }
    for (let i = 0; i < 6; i += 1) {
      const [first, last] = [["Ayşe", "Yılmaz"], ["Mehmet", "Kaya"], ["Zeynep", "Çelik"], ["Ali", "Öztürk"], ["Elif", "Şahin"], ["Can", "Işık"]][i];
      const created = await api.post("/api/workspace/accounts", { name: `${first} ${last}`, type: "customer", partyKind: "person", firstName: first, familyName: last, taxNo: tckn(1000 + i), ...addr, registeredOn: addDays(TODAY, -400) });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      customers.push({ id: created.data.id, name: `${first} ${last}` });
    }
    for (let i = 0; i < 5; i += 1) {
      const name = `Tedarik ${String(i + 1).padStart(2, "0")} San. A.Ş.`;
      const created = await api.post("/api/workspace/accounts", { name, type: "supplier", taxNo: vkn(600000000 + i * 3331), ...addr, registeredOn: addDays(TODAY, -400) });
      suppliers.push({ id: created.data.id, name });
    }
    accountsAll.push(...customers, ...suppliers);
    for (let i = 0; i < 12; i += 1) {
      const created = await api.post("/api/workspace/stock", { name: `Ürün ${String(i + 1).padStart(2, "0")} ${["Çimento", "Boya", "Vida", "Kablo"][i % 4]}`, code: `FRK-${i + 1}`, unit: "Adet", salePrice: 10 + i * 7.35, unitPrice: 5 + i * 3.1, openingQty: 1_000_000, openingPay: "none" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      items.push({ id: created.data.id || created.data.item?.id, price: 10 + i * 7.35, cost: 5 + i * 3.1 });
    }
    const sales = [];
    const purchases = [];
    let purchaseNo = 0;
    const lines = (sale, n) => Array.from({ length: n }, () => {
      const it = pick(items);
      return { itemId: it.id, name: "", qty: int(1, sale ? 9 : 40), unitPrice: sale ? it.price : it.cost, vatRate: pick([1, 10, 20, 20]) };
    });
    // 240 gün, gün başına 5–8 işlem (tarih ileri akar: VUK sırası); saat bazen aynı, bazen farklı.
    for (let day = 240; day >= 0; day -= 1) {
      const date = addDays(TODAY, -day);
      // Yolun ortasında iki cari yeniden adlandırılır: eski faturalarda alıcı adı (party_json) cari kartının adından farklı olur — liste
      // aramada alıcı adını da arar, Cari sıralaması alıcı adıyla yapılır (eski yolla aynı olmalı).
      if (day === 120) {
        for (const [index, name] of [[0, "Zeytin Yapı 01 A.Ş."], [7, "Ahenk Ticaret 02 Ltd. Şti."]]) {
          const renamed = await api.put(`/api/workspace/accounts/${customers[index].id}`, { name });
          assert.equal(renamed.status, 200, JSON.stringify(renamed.data).slice(0, 300));
          customers[index].oldName = customers[index].name;
          customers[index].name = name;
        }
      }
      const count = int(5, 8);
      for (let k = 0; k < count; k += 1) {
        const op = random();
        const time = random() < 0.5 ? "10:00" : pick(["08:15", "09:45", "13:30", "17:05"]);
        if (op < 0.5) {
          const who = pick(customers);
          const variant = random();
          const doc = lines(true, int(1, 4));
          const payment = variant < 0.35 ? { rest: "open", dueDate: addDays(date, int(-5, 40)) } : variant < 0.55 ? { cash: [{ amount: int(1, 50), method: "cash" }], rest: "open" } : variant < 0.75 ? { cash: [{ amount: 100000, method: "cash" }], rest: "open" } : variant < 0.88 ? { rest: "installments", installments: { count: int(2, 4), firstDue: addDays(date, 15), everyMonths: 1 } } : { cheques: [{ instrument: pick(["cheque", "note"]), amount: int(20, 300), dueDate: addDays(date, int(10, 90)), serialNo: `F-${day}-${k}`, bank: "Ziraat" }], rest: "open" };
          const later = random() < 0.2;
          const created = await api.post("/api/workspace/invoices", { kind: "sale", scenario: "goods_sale", accountId: who.id, issueDate: date, issueTime: time, lines: doc, payment, note: random() < 0.15 ? `Not ${pick(["sipariş", "Çınar", "acil", "ıslak imza"])} ${k}` : "", orderNo: random() < 0.1 ? `SP-${day}${k}` : "", force: true, cashForce: true, ...(later ? { eSend: "later" } : {}) });
          if (created.status === 200) {
            made.sale += 1;
            if (later) made.waiting += 1;
            sales.push({ id: created.data.id, accountId: who.id, lineId: created.data.lines?.[0]?.id });
            // Dar kontrol 2.4.3 (O1): seride daha eski tarihli bekleyen varken Kaydet numara vermez, belgeyi Gönderilecekler'e koyar. Bu veride
            // entegratör hesabı geçersizdir; "Kaydet ve Gönder" (ek 1: giriş reddedilince numara verilmez) yerine düz Kaydet (numaralı, "Gönderilmedi")
            // kullanılır. Tümünü Gönder bekleyeni eritemez: kullanıcı gibi bekleyenler eski tarihliden başlayarak Listeden Silinir (Müşteri Fişi;
            // fiş serisi de numara–tarih sırasına uyar). Son 5 günde silinmez — sonda bekleyen belge kalsın.
            if (created.data.autoSend?.code === "einvoice-order" && day > 5) {
              const pending = await api.get("/api/workspace/invoices?tab=pending&limit=5000");
              const waiting = pending.invoices.filter(row => row.eStatus === "waiting").sort((a, b) => `${a.issueDate} ${a.issueTime || ""} ${a.createdAt}`.localeCompare(`${b.issueDate} ${b.issueTime || ""} ${b.createdAt}`));
              for (const item of waiting) {
                const withdrawn = await api.post(`/api/workspace/invoices/${item.id}/withdraw`, {});
                assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.data).slice(0, 300));
              }
            }
          }
        } else if (op < 0.65) {
          const sup = pick(suppliers);
          const created = await api.post("/api/workspace/invoices", { kind: "purchase", scenario: "goods_purchase", accountId: sup.id, number: `ALS2026${String((purchaseNo += 1)).padStart(9, "0")}`, issueDate: date, issueTime: time, lines: lines(false, int(1, 3)), payment: random() < 0.4 ? { cash: [{ amount: int(5, 400), method: "cash" }], rest: "open" } : { rest: "open" }, force: true, cashForce: true });
          if (created.status === 200) {
            made.purchase += 1;
            purchases.push({ id: created.data.id, lineId: created.data.lines?.[0]?.id });
          }
        } else if (op < 0.71) {
          const created = await api.post("/api/workspace/invoices", { kind: random() < 0.7 ? "sale" : "purchase", scenario: "goods_sale", accountId: pick(customers).id, issueDate: date, lines: lines(true, int(1, 2)), status: "draft", payment: { rest: "open" } });
          if (created.status === 200) made.draft += 1;
        } else if (op < 0.79 && sales.length > 10) {
          const orig = sales.splice(int(Math.max(0, sales.length - 40), sales.length - 1), 1)[0];
          const created = await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: orig.id, issueDate: date, lines: [{ originLineId: orig.lineId, qty: 1 }], payment: {}, force: true, cashForce: true, eSend: "later" });
          if (created.status === 200) made.sale_return += 1;
          else refuse("sale_return", created);
        } else if (op < 0.82 && purchases.length > 10) {
          const orig = purchases.splice(int(Math.max(0, purchases.length - 40), purchases.length - 1), 1)[0];
          const created = await api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: orig.id, issueDate: date, lines: [{ originLineId: orig.lineId, qty: 1 }], payment: {}, force: true, cashForce: true, eSend: "later" });
          if (created.status === 200) made.purchase_return += 1;
          else refuse("purchase_return", created);
        } else if (op < 0.86 && purchases.length > 10) {
          const target = purchases.splice(int(0, purchases.length - 1), 1)[0];
          const done = await api.post(`/api/workspace/invoices/${target.id}/cancel`, { reason: "Fark testi", force: true, stockForce: true, cashForce: true });
          if (done.status === 200) made.cancel += 1;
        } else if (sales.length) {
          const target = pick(sales);
          const body = { kind: "in", amount: int(1, 400), date, method: pick(["cash", "bank"]), cashForce: true, negativeOk: true };
          if (random() < 0.5) body.invoiceId = target.id;
          const paid = await api.post(`/api/workspace/accounts/${target.accountId}/entries`, body);
          if (paid.status === 200) made.payment += 1;
        }
      }
    }
  });
  after(async () => {
    await server?.close();
    await mock?.close();
  });

  test("veri çeşitliliği (reddedilen istek sayılmaz)", async () => {
    const all = await api.get("/api/workspace/invoices?tab=all&limit=5000");
    const states = new Set(all.invoices.map(item => item.payState));
    const eStates = new Set(all.invoices.map(item => item.eStatus));
    assert.ok(all.total >= 900, `en az 900 belge (${all.total}; ${JSON.stringify(made)})`);
    for (const [kind, min] of Object.entries({ sale: 400, purchase: 100, draft: 30, sale_return: 30, purchase_return: 10, cancel: 15, payment: 50, waiting: 50 })) assert.ok(made[kind] >= min, `${kind}: ${made[kind]} < ${min} (${JSON.stringify(made)}; ilk ret ${refused[kind] || "yok"})`);
    for (const state of ["open", "paid", "partial", "overdue", "installment", "draft", "cancelled"]) assert.ok(states.has(state), `ödeme durumu ${state} var (${[...states].join(", ")})`);
    assert.ok(eStates.has("waiting") && eStates.has("none") && [...eStates].some(state => !["waiting", "none"].includes(state)), `e-Belge durumları: ${[...eStates].join(", ")}`);
    const created = new Set(all.invoices.map(item => item.createdAt));
    assert.ok(created.size < all.total / 10, `sahte saat durur: oluşturma anları çoğunlukla aynı (${created.size} farklı / ${all.total})`);
  });

  test("her sekme × sıralama × ödeme durumu (ilk sayfa) ve tohumlu 400 süzgeç/arama/sayfa birleşimi: yanıt eski yolla bayt bayt aynı", async t => {
    const invoices = server.app.context.invoices;
    const admin = { role: "admin", permissions: [] };
    const all = await api.get("/api/workspace/invoices?tab=all&limit=5000");
    const sample = all.invoices;
    const random = rng(9431);
    const pick = list => list[Math.floor(random() * list.length)];
    const combos = [];
    for (const tab of ["", "sale", "purchase", "returns", "drafts", "pending", "cancelled", "all", "yok"]) {
      for (const sort of ["", "date", "number", "amount", "party"]) for (const pay of ["", "open", "paid", "overdue", "partial", "unpaid"]) combos.push({ tab, sort, pay });
    }
    const needles = () => {
      const doc = pick(sample);
      return pick([
        doc.displayNo?.slice(-6) || "",
        doc.displayNo || "",
        doc.accountName.slice(0, int(3, 8)),
        doc.accountName.toLocaleUpperCase("tr-TR").slice(0, 5),
        "çınar",
        "ÇINAR",
        "Çınar Yapı",
        "Ticaret 02",
        "Zeytin",
        "ıslak",
        "FRK-1",
        "ürün 0",
        "sp-",
        "a ş",
        "zzzz yok",
        BUYER_VKN.slice(0, 6),
        doc.ettn?.slice(0, 8) || "",
      ]);
    };
    const int = (a, b) => a + Math.floor(random() * (b - a + 1));
    for (let i = 0; i < 400; i += 1) {
      const doc = pick(sample);
      const from = random() < 0.3 ? addDays(TODAY, -int(0, 200)) : "";
      const to = random() < 0.3 ? addDays(TODAY, -int(0, 120)) : "";
      combos.push({
        tab: pick(["", "sale", "purchase", "returns", "drafts", "pending", "cancelled", "all"]),
        sort: pick(["date", "number", "amount", "party", "date"]),
        pay: random() < 0.4 ? pick(["open", "paid", "overdue", "partial", "unpaid", "installment"]) : "",
        q: random() < 0.45 ? needles() : "",
        from,
        to,
        profile: random() < 0.15 ? pick(["TEMELFATURA", "EARSIVFATURA", "KAGIT", "TICARIFATURA"]) : "",
        account: random() < 0.15 ? doc.accountId : "",
        item: random() < 0.08 ? pick(items).id : "",
        side: random() < 0.08 ? pick(["sale", "purchase"]) : "",
        kind: random() < 0.06 ? pick(["sale", "purchase", "sale_return", "purchase_return"]) : "",
        status: random() < 0.06 ? pick(["draft", "issued", "cancelled"]) : "",
        offset: random() < 0.5 ? String(pick([0, 1, 7, 199, 200, 350, 900, 4000])) : "",
        limit: random() < 0.6 ? String(pick([1, 3, 50, 200, 5000, 0, -4, "abc"])) : "",
      });
    }
    let rows = 0;
    let compared = 0;
    const diffs = [];
    for (const combo of combos) {
      const params = new URLSearchParams(Object.entries(combo).filter(([, value]) => value !== ""));
      const response = await api.get(`/api/workspace/invoices?${params}`);
      const expected = oldPage(params, invoices.list(admin, invoices.listQuery(params)));
      compared += 1;
      rows += expected.invoices.length;
      if (JSON.stringify(response) !== JSON.stringify(expected)) diffs.push({ params: params.toString(), yeni: JSON.stringify(response).slice(0, 300), eski: JSON.stringify(expected).slice(0, 300) });
    }
    t.diagnostic(`fark testi: ${compared} birleşim, ${rows} satır karşılaştırıldı, ${diffs.length} farklı; veri ${all.total} belge ${JSON.stringify(made)}`);
    assert.deepEqual(diffs.slice(0, 3), [], `${diffs.length}/${compared} birleşimde yanıt farklı`);
    assert.ok(compared >= 670 && rows > 20_000, `kapsam: ${compared} birleşim, ${rows} satır`);
  });

  test("sayfa dışındaki belgeler ağır sütunlarla okunmaz (menü rozeti limit=1, ilk sayfa, numara araması)", async () => {
    const original = store.all;
    const heavy = [];
    store.all = function patched(sql, ...args) {
      const result = original.call(this, sql, ...args);
      if (/i\.seller_json/.test(String(sql))) heavy.push(result.length);
      return result;
    };
    try {
      const total = (await api.get("/api/workspace/invoices?tab=all&limit=1")).total;
      assert.ok(total >= 900);
      const read = () => heavy.reduce((sum, n) => sum + n, 0);
      heavy.length = 0;
      await api.get("/api/workspace/invoices?tab=sale&pay=overdue&limit=1");
      assert.ok(read() <= 1, `rozet isteği ${read()} belgeyi ağır sütunlarla okudu (en çok 1)`);
      heavy.length = 0;
      await api.get("/api/workspace/invoices?tab=all&limit=200");
      assert.ok(read() <= 200, `ilk sayfa ${read()} belgeyi ağır sütunlarla okudu (en çok 200)`);
      heavy.length = 0;
      const one = (await api.get("/api/workspace/invoices?tab=all&limit=5000")).invoices.find(item => item.number);
      heavy.length = 0;
      const found = await api.get(`/api/workspace/invoices?tab=all&q=${encodeURIComponent(one.number)}&limit=200`);
      assert.ok(found.invoices.some(item => item.id === one.id));
      assert.ok(read() <= found.invoices.length, `numara araması ${read()} belgeyi ağır sütunlarla okudu (sonuç ${found.invoices.length})`);
    } finally {
      store.all = original;
    }
  });
});

// POS peşinli satış (posCash: İptal / Sil penceresinin "POS İşlemi" seçimi) yalnız sayfadaki satırlar için okunur; eski yolla aynı olmalı.
describe("fatura listesi (2.4.3 H3): POS peşinli satışların posCash bayrağı sayfalı uçta eski yolla aynı", () => {
  test("POS'lu, nakit, açık, iptal edilmiş satışlar; her sayfa dilimi", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      const customer = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "POS Müşterisi", type: "customer", registeredOn: "2026-10-01" }));
      const item = await must("ürün", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "P", name: "Ürün P", unit: "Adet", openingQty: "500" }));
      await openPos(ctx.api, ziraatPos(acc.ziraat.id));
      const ids = [];
      for (let i = 0; i < 12; i += 1) {
        const doc = i % 3 === 0
          ? await must(`POS ${i}`, posInvoice(ctx.api, { accountId: customer.id, itemId: item.id, name: "Ürün P", qty: 1 + i, unitPrice: 100, date: POS_TODAY, extra: { similarOk: true } }))
          : await must(`satış ${i}`, ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: customer.id, issueDate: POS_TODAY, lines: [{ itemId: item.id, name: "Ürün P", qty: 1 + i, unitPrice: 100, vatRate: 20 }], payment: i % 3 === 1 ? { cash: [{ amount: 50, method: "cash" }], rest: "open" } : { rest: "open" }, force: true, similarOk: true }));
        ids.push(doc.id);
      }
      await must("iptal", ctx.api.post(`/api/workspace/invoices/${ids[6]}/cancel`, { reason: "deneme", posOutcome: "refunded", force: true, stockForce: true, cashForce: true }));
      const invoices = ctx.server.app.context.invoices;
      const admin = { role: "admin", permissions: [] };
      let posRows = 0;
      for (const tab of ["all", "sale", "cancelled"]) {
        for (const [offset, limit] of [[0, 200], [0, 1], [1, 2], [3, 4], [5, 5], [10, 3]]) {
          const params = new URLSearchParams({ tab, offset: String(offset), limit: String(limit) });
          const response = unwrap(await ctx.api.get(`/api/workspace/invoices?${params}`));
          const expected = oldPage(params, invoices.list(admin, invoices.listQuery(params)));
          assert.equal(JSON.stringify(response), JSON.stringify(expected), `${params}: yanıt eski yolla aynı`);
          posRows += response.invoices.filter(row => row.posCash).length;
        }
      }
      assert.ok(posRows >= 6, `sayfalarda POS'lu satır (posCash) görüldü: ${posRows}`);
    } finally {
      await ctx.server.close();
    }
  });
});
