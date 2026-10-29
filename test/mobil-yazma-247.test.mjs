// 2.4.7 M5: mobilden yazma — tahsilat, ödeme, taksit kartına tahsilat, stok girişi (server/lib/mobile-write.mjs; kullanıcı kararları S1–S8 docs/2.4.7-IS-LISTESI.md
// "KARARLAR — M5 mobil yazma"; bağımsız kâhin test/bagimsiz/mobil-yazma/). Her denetim yeni davranışın varlığını iddia eder: eski kodda mobil yazma 405 (salt okunur)
// olduğu için kırmızıdır ve iletisi nedeni söyler (ders 7, 38). Para kuralı burada YAZILMAZ: beklenen sayılar masaüstünün AYNI ucundan (eşdeğerlik) ya da elle.
// Saat sahte ve sabit (config.now = config.remoteNow; ders 13, 22); süreç saat dilimi Türkiye (sunucunun "bugün"ü TR günü — S6).
process.env.TZ = "Europe/Istanbul";

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { signToken } from "../server/lib/license-token.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { createPhone, remoteBase } from "./mobil-uzak-ortak.mjs";

// Eski kodda modül yok: içe aktarma testleri tek tek (nedenli) kırar, dosyanın tamamını değil.
const writeLib = await import("../server/lib/mobile-write.mjs").catch(error => ({ missing: error.message }));
const pendingLib = await import("../client/mobil/yazma-bekleyen.js").catch(error => ({ missing: error.message }));
const T0 = "2026-10-20T10:00:00+03:00";
const PASSWORD = "Personel-Mobil-2026!";
const need = (lib, name) => {
  assert.equal(typeof lib[name], "function", `M5 modülü / işlevi yok (${name}): ${lib.missing || "dışa aktarılmamış"}`);
  return lib[name];
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const describeRes = r => `${r.status} ${r.data?.code || r.code || ""} ${String(r.data?.error || r.text || "").slice(0, 120)}`;

async function office({ start = T0, license } = {}) {
  const clock = createClock({ time: Date.parse(start), fixed: true });
  const server = await startTestServer({ now: clock, remoteNow: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...(license ? { license: license(clock) } : {}) });
  const admin = await loginAdmin(server);
  const company = (unwrap(await admin.get("/api/companies"))).companies.find(c => c.code === "001").id;
  const ctx = {
    server,
    clock,
    admin,
    company,
    store: () => server.app.store,
    async account(name, opening) {
      const r = await admin.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-10-01", ...(opening ? { openingBalance: opening, openingSide: "auto" } : {}) });
      assert.equal(r.status, 200, describeRes(r));
      return unwrap(r).id;
    },
    async invoice(accountId, amount, day, hofCompany = "") {
      const q = hofCompany ? `?hofCompany=${hofCompany}` : "";
      if (!ctx.service?.[hofCompany]) (ctx.service ||= {})[hofCompany] = unwrap(await admin.post(`/api/workspace/stock${q}`, { kind: "service", code: `HZM-${hofCompany || "1"}`, name: "Hizmet", unit: "Adet", salePrice: "100" })).id;
      const r = await admin.post(`/api/workspace/invoices${q}`, { kind: "sale", scenario: "service_sale", accountId, issueDate: day, lines: [{ itemId: ctx.service[hofCompany], qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open" } });
      assert.equal(r.status, 200, describeRes(r));
      return unwrap(r).id;
    },
    // Ofis ağındaki mobil görünüm (olağan oturum) ya da uzak telefon üzerinden mobil yazma.
    mobile: (client, path, body, requestId, company = ctx.company) => client.post(`/api/mobil${path}${path.includes("?") ? "&" : "?"}company=${encodeURIComponent(company)}`, body, requestId ? { "x-hof-request": requestId } : {}),
    entries: accountId => ctx.store().all("SELECT kind, amount, date, method, invoice_id AS invoiceId, fin_ref AS finRef, created_by AS createdBy FROM account_entries WHERE account_id = ? AND kind IN ('in', 'out') ORDER BY rowid", accountId).map(row => ({ ...row })),
    open: async id => unwrap(await admin.get(`/api/workspace/invoices/${id}`)).open,
    balance: async id => unwrap(await admin.get(`/api/workspace/accounts/${id}`)).totals.balance,
    cash: async () => unwrap(await admin.get("/api/workspace/cash")).totals.balance,
    close: () => server.close(),
  };
  return ctx;
}
const rid = n => `m5-test-istek-${String(n).padStart(6, "0")}`;

describe("M5 sözleşme: mobil yazma beyaz listesi ve telefon kuralları (birim)", () => {
  it("yalnız dört yazma ucu tanınır (tahsilat, ödeme, taksit kartına tahsilat, stok girişi); eski el yapımı yollar tanınmaz", () => {
    const match = need(writeLib, "matchMobileWrite");
    assert.deepEqual(["/api/mobil/accounts/a1/tahsilat", "/api/mobil/accounts/a1/odeme", "/api/mobil/plans/p1/tahsilat", "/api/mobil/stock/s1/giris"].map(p => match("POST", `${p}?company=x`)?.route.name), ["tahsilat", "odeme", "taksit", "stok"]);
    for (const p of ["/api/mobil/accounts/a1/entries", "/api/mobil/accounts/a1/entry", "/api/mobil/stock/s1/move", "/api/mobil/stock/s1/cikis", "/api/mobil/cheques", "/api/mobil/cash", "/api/mobil/accounts/a1/tahsilat/x"]) assert.equal(match("POST", p), null, p);
    assert.equal(match("GET", "/api/mobil/accounts/a1/tahsilat"), null, "GET yazma değildir");
  });
  it("S1/S2/S3/S6/S8: kapalı alan REDDEDİLİR (400 mobile-field), sessizce düşürülmez; bilinmeyen alan da", () => {
    const body = need(writeLib, "mobileWriteBody");
    const match = need(writeLib, "matchMobileWrite");
    const route = name => match("POST", { tahsilat: "/api/mobil/accounts/a/tahsilat", odeme: "/api/mobil/accounts/a/odeme", taksit: "/api/mobil/plans/p/tahsilat", stok: "/api/mobil/stock/s/giris" }[name]).route;
    const rejects = (name, input, field) => assert.throws(() => body(route(name), input), error => error.status === 400 && error.extra?.code === "mobile-field" && error.extra?.field === field, `${name} ${JSON.stringify(input)} → 400 mobile-field ${field}`);
    rejects("tahsilat", { amount: "10", invoiceId: "inv-1" }, "invoiceId"); // S1
    rejects("odeme", { amount: "10", invoiceId: "inv-1" }, "invoiceId"); // S1
    rejects("odeme", { amount: "10", refundOf: "inv-1" }, "refundOf");
    rejects("tahsilat", { amount: "10", method: "cheque" }, "method"); // S2
    rejects("tahsilat", { amount: "10", method: "cek" }, "method"); // S2
    rejects("taksit", { amount: "10", itemId: "item-1" }, "itemId"); // S3 (taksit seçimi yok)
    rejects("tahsilat", { amount: "10", date: "2026-10-19" }, "date"); // S6
    rejects("stok", { qty: "1", kind: "out" }, "kind"); // S8
    rejects("stok", { qty: "1", pay: "cash" }, "pay"); // S8 (para yazan stok hareketi yok)
    rejects("tahsilat", { amount: "10", overpay: true }, "overpay"); // Fazlasını Avans Yaz yalnız taksit kartında
    rejects("tahsilat", { amount: "10", doubtfulSkip: true }, "doubtfulSkip");
    assert.deepEqual(body(route("tahsilat"), { amount: "1250,50", note: "ok" }), { kind: "in", amount: "1250,50", method: "cash", note: "ok" });
    assert.deepEqual(body(route("odeme"), { amount: 12.5, method: "bank", bankAccountId: "b1", cashForce: true }), { kind: "out", amount: "12,5", method: "bank", bankAccountId: "b1", cashForce: true });
    assert.deepEqual(body(route("stok"), { qty: "5" }), { kind: "in", pay: "none", qty: "5" });
  });
  it("tutar (banka planı §9.2/9): en çok 2 ondalık, binlik ayırıcısız; biçim dışı tutar YUVARLANMAZ (400 mobile-amount)", () => {
    const body = need(writeLib, "mobileWriteBody");
    const route = need(writeLib, "matchMobileWrite")("POST", "/api/mobil/accounts/a/tahsilat").route;
    for (const bad of ["12,345", "1.234,56", "1.234", "-5", "abc", "", "10.5", 12.345]) assert.throws(() => body(route, { amount: bad }), error => error.status === 400 && error.extra?.code === "mobile-amount", `tutar ${JSON.stringify(bad)} reddedilmeli`);
    assert.equal(body(route, { amount: "0,01" }).amount, "0,01");
    assert.equal(body(route, { amount: 1.15 }).amount, "1,15");
  });
  it("oturum özetinin yazma hakları yetkiden: personel tahsilat girer, ödeme / avans göremez; salt okunurda hiçbiri", () => {
    const rights = need(writeLib, "mobileWriteRights");
    assert.deepEqual(rights(["accounts.collect", "plans.collect", "stock.move"]), { writesEnabled: true, writes: { tahsilat: true, odeme: false, taksit: true, avans: false, stok: true } });
    assert.deepEqual(rights([]), { writesEnabled: false, writes: { tahsilat: false, odeme: false, taksit: false, avans: false, stok: false } });
  });
  it("S7 telefon kuralı: sonucu belirsiz istek formun açılışından 24 saat içinde aynı kimlikle yeniden gönderilir, sonra GÖNDERİLMEZ", () => {
    const can = need(pendingLib, "yenidenGonderilebilir");
    const at = Date.parse(T0);
    assert.equal(can({ formAt: at }, at + 24 * 3_600_000), true, "24. saat dahil");
    assert.equal(can({ formAt: at }, at + 24 * 3_600_000 + 1), false, "24 saati geçince gönderilmez");
    assert.equal(can({}, at), false, "zamansız kayıt gönderilmez");
    const store = need(pendingLib, "createBekleyenler")();
    store.add({ requestId: "a", formAt: at });
    store.add({ requestId: "a", formAt: at + 1 });
    assert.equal(store.list().length, 1, "aynı kimlik tek kayıt");
    store.remove("a");
    assert.equal(store.list().length, 0);
  });
});

describe("M5 ofis ağında mobil yazma (olağan oturum): masaüstünün aynı ucu, aynı sonuç", () => {
  let ctx;
  before(async () => {
    ctx = await office();
  });
  after(() => ctx?.close());

  it("S1 FIFO: bağsız mobil tahsilat en eski açık faturayı kapatır; masaüstüyle aynı (eşdeğerlik çifti)", async () => {
    const results = {};
    for (const channel of ["mobil", "masaustu"]) {
      const acc = await ctx.account(`FIFO ${channel}`);
      // Fatura serisi tarih sırasını korur (kronoloji): ikinci yan sonraki günlerde.
      const f1 = await ctx.invoice(acc, "1000", channel === "mobil" ? "2026-10-01" : "2026-10-06");
      const f2 = await ctx.invoice(acc, "500", channel === "mobil" ? "2026-10-05" : "2026-10-08");
      const body = { amount: "1200", method: "cash" };
      const r = channel === "mobil" ? await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, body, rid(`fifo-${channel}`)) : await ctx.admin.post(`/api/workspace/accounts/${acc}/entries`, { kind: "in", ...body }, { "x-hof-request": rid(`fifo-${channel}`) });
      assert.equal(r.status, 200, `${channel}: ${describeRes(r)}`);
      results[channel] = { f1: await ctx.open(f1), f2: await ctx.open(f2), balance: await ctx.balance(acc), entries: ctx.entries(acc).map(({ createdBy, ...rest }) => rest) };
    }
    assert.deepEqual(results.mobil, { f1: 0, f2: 300, balance: 300, entries: [{ kind: "in", amount: 1200, date: "2026-10-20", method: "cash", invoiceId: "", finRef: "" }] }, "mobil: F1 kapanır, F2'de 300 kalır; fatura bağı yok");
    assert.deepEqual(results.mobil, results.masaustu, "mobil = masaüstü");
  });

  it("istek kimliği zorunlu; aynı kimlik ikinci kez yeni kayıt açmaz (ilk sonuç), farklı içerik 409; kimlik şirketin veri dosyasında", async () => {
    const acc = await ctx.account("Kimlik");
    const none = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "10" }, "");
    assert.equal(none.status, 400, describeRes(none));
    assert.equal(none.data.code, "mobile-request-id");
    const first = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "10" }, rid("kimlik"));
    const again = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "10" }, rid("kimlik"));
    assert.equal(first.status, 200, describeRes(first));
    assert.equal(again.status, 200, describeRes(again));
    assert.equal(unwrap(again).replayed, true, "ikinci gönderim 'zaten kaydedildi'");
    assert.equal(unwrap(again).entryId, unwrap(first).entryId);
    assert.equal(ctx.entries(acc).length, 1, "tek kayıt");
    const changed = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "11" }, rid("kimlik"));
    assert.equal(changed.status, 409, describeRes(changed));
    assert.equal(changed.data.code, "request-id-reused");
    assert.equal(ctx.entries(acc).length, 1);
    const keys = ctx.store().get("SELECT COUNT(*) AS n FROM request_keys WHERE key LIKE ?", `%${rid("kimlik")}`).n;
    assert.equal(keys, 1, "istek kimliği şirketin veri dosyasında (request_keys)");
  });

  it("S4 Kasa eksi (Uyar): soru 409 cash-negative, kayıt yok; 'Yine de Kaydet' aynı kimlikle → tek kayıt", async () => {
    const acc = await ctx.account("Tedarikçi K");
    const id = rid("kasa");
    const ask = await ctx.mobile(ctx.admin, `/accounts/${acc}/odeme`, { amount: "99999" }, id);
    assert.equal(ask.status, 409, describeRes(ask));
    assert.equal(ask.data.code, "cash-negative");
    assert.equal(ctx.entries(acc).length, 0, "soru sırasında kayıt yok (ders 3)");
    const ok = await ctx.mobile(ctx.admin, `/accounts/${acc}/odeme`, { amount: "99999", cashForce: true }, id);
    assert.equal(ok.status, 200, describeRes(ok));
    assert.equal(ctx.entries(acc).length, 1);
    assert.equal(ctx.entries(acc)[0].kind, "out", "ödeme yönü");
  });

  it("S3/K8: taksit kartına mobil tahsilat; kalanı aşan 409 plan-overpay, Fazlasını Avans Yaz (yönetici) yazar, ödenmiş kart 409 plan-paid", async () => {
    const acc = await ctx.account("Taksitli", "300");
    const plan = unwrap(await ctx.admin.post("/api/workspace/plans", { name: "Taksitli", registeredOn: "2026-10-01", total: "300", accountId: acc, mode: "auto", count: "3", firstDue: "2026-11-01", coversBalance: true })).id;
    const pay = (amount, n, extra = {}) => ctx.mobile(ctx.admin, `/plans/${plan}/tahsilat`, { amount, ...extra }, rid(`k8-${n}`));
    const r1 = await pay("100", 1);
    assert.equal(r1.status, 200, describeRes(r1));
    assert.equal(unwrap(r1).plan.remaining, 200);
    const r2 = await pay("250", 2);
    assert.equal(r2.status, 409, describeRes(r2));
    assert.equal(r2.data.code, "plan-overpay");
    const r3 = await pay("250", 2, { overpay: true });
    assert.equal(r3.status, 200, describeRes(r3));
    assert.equal(unwrap(r3).plan.remaining, 0);
    assert.equal(unwrap(r3).plan.extra, 50);
    const r4 = await pay("10", 4);
    assert.equal(r4.status, 409, describeRes(r4));
    assert.equal(r4.data.code, "plan-paid");
    assert.equal(await ctx.balance(acc), -50, "cari: fazlası avans (−50)");
  });

  it("S8: mobil stok girişi parasız miktar girişi (Kasa ve cari değişmez); çıkış yolu yok", async () => {
    const item = unwrap(await ctx.admin.post("/api/workspace/stock", { kind: "product", code: "M5-U1", name: "Ürün", unit: "Adet" })).id;
    const cashBefore = await ctx.cash();
    const r = await ctx.mobile(ctx.admin, `/stock/${item}/giris`, { qty: "5" }, rid("stok"));
    assert.equal(r.status, 200, describeRes(r));
    assert.equal(unwrap(r).item.qty, 5);
    const move = { ...ctx.store().get("SELECT kind, qty, pay, amount FROM stock_moves WHERE item_id = ? ORDER BY rowid DESC LIMIT 1", item) };
    assert.deepEqual(move, { kind: "in", qty: 5, pay: "none", amount: 0 });
    assert.equal(await ctx.cash(), cashBefore, "Kasa değişmez");
    const out = await ctx.mobile(ctx.admin, `/stock/${item}/giris`, { qty: "1", kind: "out" }, rid("stok-cikis"));
    assert.equal(out.status, 400, describeRes(out));
    const cikis = await ctx.admin.post(`/api/mobil/stock/${item}/cikis?company=${ctx.company}`, { qty: "1" }, { "x-hof-request": rid("stok-cikis-2") });
    assert.equal(cikis.status, 405, "stok çıkışı mobil yolu yok");
  });

  it("S6: tarih sunucunun TR günü — gece yarısından önce o gün, sonra ertesi gün (ay sonu → ay başı); telefon tarihi reddedilir", async () => {
    const acc = await ctx.account("Gece");
    ctx.clock.set(Date.parse("2026-10-31T23:59:30+03:00"));
    const before_ = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "10" }, rid("gece-1"));
    ctx.clock.set(Date.parse("2026-11-01T00:00:30+03:00"));
    const after_ = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "20" }, rid("gece-2"));
    // Kesinti 'sonra' + gece yarısından sonra yeniden gönderim: ilk kayıt (31.10) döner, yeni gün kaydı açılmaz.
    const replay = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "10" }, rid("gece-1"));
    const dated = await ctx.mobile(ctx.admin, `/accounts/${acc}/tahsilat`, { amount: "5", date: "2026-10-30" }, rid("gece-3"));
    ctx.clock.set(Date.parse(T0));
    assert.deepEqual([before_.status, after_.status, replay.status, dated.status], [200, 200, 200, 400], [before_, after_, replay, dated].map(describeRes).join(" | "));
    assert.equal(unwrap(replay).replayed, true);
    assert.deepEqual(ctx.entries(acc).map(e => [e.amount, e.date]), [[10, "2026-10-31"], [20, "2026-11-01"]]);
  });

  it("yazma formunun hesap / POS seçicisi mobil beyaz listede (masaüstü formunun ucu)", async () => {
    const r = await ctx.admin.get(`/api/mobil/bank/choices?company=${ctx.company}`);
    assert.equal(r.status, 200, describeRes(r));
    assert.ok(unwrap(r).forms?.bank, "forms.bank var");
  });

  it("oturum özetinde yazma açık (writesEnabled + haklar)", async () => {
    const s = unwrap(await ctx.admin.get("/api/mobil/session"));
    assert.equal(s.writesEnabled, true);
    assert.deepEqual(s.writes, { tahsilat: true, odeme: true, taksit: true, avans: true, stok: true });
  });
});

describe("M5 uzaktan (eşli cihaz): M2 kapısı her yazmada", () => {
  let ctx;
  let remote;
  let phoneY;
  let phoneP;
  let second;
  let staffId;
  const pair = async (userId, username, password) => {
    assert.equal((await ctx.admin.put(`/api/admin/mobile/access/${userId}`, { remote: true })).status, 200);
    const code = unwrap(await ctx.admin.post("/api/admin/mobile/codes", { userId })).code;
    const phone = createPhone(remote.base);
    assert.equal((await phone.pair(code)).status, 200);
    const login = await phone.login(username, password);
    assert.equal(login.status, 200, login.text);
    return phone;
  };
  const send = (phone, path, body, id, company = ctx.company) => phone.post(`/api/mobil${path}?company=${encodeURIComponent(company)}`, body, { headers: { "x-hof-request": id } });
  before(async () => {
    ctx = await office();
    remote = await remoteBase(ctx.server);
    const users = async () => Object.fromEntries(unwrap(await ctx.admin.get("/api/admin/users")).map(u => [u.username, u.id]));
    await createUser(ctx.server, ctx.admin, { username: "m5-personel", role: "personel", password: PASSWORD });
    const ids = await users();
    staffId = ids["m5-personel"];
    second = unwrap(await ctx.admin.post("/api/companies", { code: "002", name: "İkinci" })).company.id;
    phoneY = await pair(ids.admin, "admin", ADMIN_PASSWORD);
    phoneP = await pair(staffId, "m5-personel", PASSWORD);
  });
  after(() => ctx?.close());

  it("eşli cihazdan tahsilat yazılır; kaydı eşlendiği kullanıcı girer (uzak oturum)", async () => {
    const acc = await ctx.account("Uzak A");
    const r = await send(phoneP, `/accounts/${acc}/tahsilat`, { amount: "75" }, rid("uzak-1"));
    assert.equal(r.status, 200, r.text);
    const [entry] = ctx.entries(acc);
    assert.equal(entry.createdBy, staffId, "kaydı telefonun kullanıcısı girdi");
    assert.equal(entry.amount, 75);
  });

  it("rol yetkisi mobilde de aynı: personel ödeme 403, kayıt yok", async () => {
    const acc = await ctx.account("Uzak B");
    const r = await send(phoneP, `/accounts/${acc}/odeme`, { amount: "10" }, rid("uzak-2"));
    assert.equal(r.status, 403, r.text);
    assert.equal(ctx.entries(acc).length, 0);
  });

  it("şirket yetkisi: personel 002'ye yazamaz (403); başka şirketin cari kimliği isteğin şirketinde çözülmez (404), hiçbir şirkete yazılmaz", async () => {
    const acc002 = unwrap(await ctx.admin.post(`/api/workspace/accounts?hofCompany=${second}`, { name: "002 Carisi", type: "customer" })).id;
    const forbidden = await send(phoneP, `/accounts/${acc002}/tahsilat`, { amount: "10" }, rid("uzak-3"), second);
    assert.equal(forbidden.status, 403, forbidden.text);
    assert.equal(forbidden.code, "company-forbidden");
    const cross = await send(phoneY, `/accounts/${acc002}/tahsilat`, { amount: "10" }, rid("uzak-4"), ctx.company);
    assert.equal(cross.status, 404, cross.text);
    const inSecond = await ctx.admin.get(`/api/workspace/accounts/${acc002}?hofCompany=${second}`);
    assert.equal(unwrap(inSecond).entries.filter(e => e.kind === "in").length, 0, "002'ye de yazılmadı");
    const ok = await send(phoneY, `/accounts/${acc002}/tahsilat`, { amount: "10" }, rid("uzak-5"), second);
    assert.equal(ok.status, 200, ok.text);
  });

  it("aynı anda: iki cihaz + masaüstü aynı cariye ayrı kimlikle — üç kayıt; aynı cihazdan çift dokunuş (aynı kimlik aynı anda) — tek kayıt", async () => {
    const acc = await ctx.account("Yarış");
    const results = await Promise.all([
      send(phoneY, `/accounts/${acc}/tahsilat`, { amount: "10" }, rid("yaris-1")),
      send(phoneP, `/accounts/${acc}/tahsilat`, { amount: "20" }, rid("yaris-2")),
      ctx.admin.post(`/api/workspace/accounts/${acc}/entries`, { kind: "in", amount: "30" }, { "x-hof-request": rid("yaris-3") }),
      send(phoneY, `/accounts/${acc}/tahsilat`, { amount: "40" }, rid("yaris-4")),
      send(phoneY, `/accounts/${acc}/tahsilat`, { amount: "40" }, rid("yaris-4")),
    ]);
    assert.deepEqual(results.map(r => r.status), [200, 200, 200, 200, 200], results.map(r => r.text || JSON.stringify(r.data)).join(" | "));
    assert.deepEqual(ctx.entries(acc).map(e => e.amount).sort((a, b) => a - b), [10, 20, 30, 40], "çift dokunuş tek kayıt");
    assert.equal(await ctx.balance(acc), -100);
  });

  it("silinen cihaz ve uzak izni kaldırılan kullanıcı yazamaz (401), kayıt yok", async () => {
    const acc = await ctx.account("Silinen");
    const devices = unwrap(await ctx.admin.get("/api/admin/mobile/devices")).devices;
    const own = devices.find(d => d.id === phoneY.deviceId);
    assert.equal((await ctx.admin.del(`/api/admin/mobile/devices/${own.id}`)).status, 200);
    const gone = await send(phoneY, `/accounts/${acc}/tahsilat`, { amount: "10" }, rid("sil-1"));
    assert.equal(gone.status, 401, gone.text);
    assert.equal((await ctx.admin.put(`/api/admin/mobile/access/${staffId}`, { remote: false })).status, 200);
    const revoked = await send(phoneP, `/accounts/${acc}/tahsilat`, { amount: "10" }, rid("sil-2"));
    assert.equal(revoked.status, 401, revoked.text);
    assert.equal(ctx.entries(acc).length, 0);
  });
});

describe("M5 lisans: lisans geçersizken mobil yazma kapalı, yenilenince açılır", () => {
  it("salt okunur lisansta uzak yazma 403 remote-license; lisans geçerli olunca aynı cihaz yazar", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ format: "pem", type: "pkcs8" });
    let valid = true;
    const machine = `ab${"12".repeat(15)}`;
    const license = clock => ({
      enforce: true, trustedKeys: { "m5-test": publicKey.export({ format: "der", type: "spki" }).toString("base64") }, services: ["https://lisans.m5.test/api/lisans"], machineId: machine, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false,
      fetchImpl: async () => {
        const at = new Date(clock.ms()).toISOString();
        return { status: 200, json: async () => ({ ok: true, token: signToken({ schema: 1, product: "DestekOfis", type: "license-token", kind: "license", status: valid ? "active" : "blocked", licenseId: "LIS-M5", customer: "M5", machine, issuedAt: at, startsAt: at, expiresAt: null, offline: false, message: "" }, pem, "m5-test") }) };
      },
    });
    const ctx = await office({ license });
    try {
      await ctx.server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
      assert.equal(ctx.server.app.license.status().writable, true, "ön koşul: lisans etkin");
      const remote = await remoteBase(ctx.server);
      const adminId = Object.fromEntries(unwrap(await ctx.admin.get("/api/admin/users")).map(u => [u.username, u.id])).admin;
      await ctx.admin.put(`/api/admin/mobile/access/${adminId}`, { remote: true });
      const phone = createPhone(remote.base);
      assert.equal((await phone.pair(unwrap(await ctx.admin.post("/api/admin/mobile/codes", { userId: adminId })).code)).status, 200);
      assert.equal((await phone.login("admin", ADMIN_PASSWORD)).status, 200);
      const acc = await ctx.account("Lisans");
      valid = false;
      await ctx.server.app.license.check();
      const blocked = await phone.post(`/api/mobil/accounts/${acc}/tahsilat?company=${ctx.company}`, { amount: "10" }, { headers: { "x-hof-request": rid("lisans-1") } });
      assert.equal(blocked.status, 403, blocked.text);
      assert.equal(blocked.code, "remote-license");
      valid = true;
      await ctx.server.app.license.check();
      assert.equal((await phone.login("admin", ADMIN_PASSWORD)).status, 200);
      const okay = await phone.post(`/api/mobil/accounts/${acc}/tahsilat?company=${ctx.company}`, { amount: "10" }, { headers: { "x-hof-request": rid("lisans-2") } });
      assert.equal(okay.status, 200, okay.text);
      assert.equal(ctx.entries(acc).length, 1);
    } finally {
      await ctx.close();
    }
  });
});
