// 2.4.4 — UX15 (uzman UX bulgusu 18.10.2026, docs/kanit/2026-10-18/uiux-a-243/uzman-ux-BULGULAR.md): geriye tarihli belgede numara/tarih sırası
// çakışması formda değil, numarayı gösteren onaydan SONRA hata olarak çıkıyordu. KURAL: numara / tarih çakışması (seride daha yeni tarihli numaralı
// belge varken eski tarih; elle yazılan numaranın aynı caride kayıtlı olması; dönem kilidi) formun ön hesabında (POST /invoices/calc) — kaydetmeden,
// ağa çıkmadan — kayıttaki AYNI denetimle söylenir; kayıttaki kural değişmez. Seride daha eski tarihli gönderilmemiş belge varken numara kayıtta
// verilmez (O1): ön hesap bunu da söyler (orderHold), onay numara göstermez.
// Nasıl bozulur (testler bu listeden; docs/kanit/2026-10-22/244-ux15/): (1) sıra: geriye tarih; (2) aynı gün / sınır gün; (3) yıl dönümü (seri yılı) ve
// Düzenle'de başka yıla; (4) iki kullanıcı aynı anda (biri formdayken öbürü kaydeder); (5) tür/seri: kâğıt (FIS), SMM, iade (iç seri / kendi serimiz),
// e-Arşiv / e-Fatura, Kes, Sonra Gönder; (6) elle numara çakışması (Düzenle'de kendisi sayılmaz); (7) dönem kilidi (yeni belge / Düzenle);
// (8) daha eski bekleyen (onay numarası); (9) Düzenle (önceki / sonraki belge; numarasız bekleyen); (10) 002 şirketi; (11) taslak; (12) yetkisiz.
// Ayrıca ayrışma (fark) denetimi: tohumlu rastgele sırada her adımda ön hesabın hükmü = kaydın sonucu (ileti aynı).
// Eski kodda (163dd5d) ön hesap numbering/orderHold döndürmez ve blockers'a çakışma koymaz → testler kırmızı (ders 7). Sahte saat (ders 13).
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const LINES = [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }];
const INV = "/api/workspace/invoices";
const CALC = `${INV}/calc`;
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const dayText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

const open = [];
after(async () => {
  for (const item of open.splice(0)) {
    await item.server?.close();
    await item.edm?.close();
  }
});

async function setup({ now = "2026-06-17T09:00:00", edoc = false } = {}) {
  let edm = null;
  let fetchImpl;
  if (edoc) {
    resetEdmCaches();
    edm = await startMockEdm();
    fetchImpl = async (input, init) => {
      const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
      if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
      return globalThis.fetch(input, init);
    };
  }
  const server = await startTestServer({ now, ...(edoc ? { edocEnabled: true, fetchImpl, edocStatusPollMs: [5, 5] } : {}), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const ctx = { server, edm };
  open.push(ctx);
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const wrap = c => ({ client: c, get: async url => unwrap(await c.get(url)), post: async (url, body) => unwrap(await c.post(url, body)), put: async (url, body) => unwrap(await c.put(url, body)) });
  const api = wrap(client);
  if (edoc) {
    assert.equal((await api.put(`${INV}/settings`, { seller: SELLER, efatura: true, earsiv: true })).status, 200);
    assert.equal((await api.put(`${INV}/settings`, { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
  }
  const today = (await api.get("/api/workspace/ledger/lock")).data.today;
  assert.equal(today, now.slice(0, 10), "sahte saat");
  const day = offset => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
  };
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const account = async (body, as = api) => (await must(`cari ${body.name}`, as.post("/api/workspace/accounts", body))).id;
  const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
  return { ...ctx, api, wrap, today, day, must, account, count };
}

// Kayıt gövdesi; ön hesap (calc) aynı gövdeyi alır (form da aynısını gönderir: docBody).
const saleBody = (accountId, date, extra = {}) => ({ scenario: "service_sale", accountId, issueDate: date, lines: LINES, payment: { rest: "open" }, ...extra });
const purchaseBody = (accountId, date, number, extra = {}) => ({ scenario: "expense_purchase", accountId, issueDate: date, number, lines: LINES, payment: { rest: "open" }, ...extra });

describe("2.4.4 UX15: numara / tarih çakışması kayıttan ÖNCE (ön hesap = kayıttaki denetim)", () => {
  test("1–2 sıra: geriye tarihli kâğıt fatura ön hesapta söylenir (ileti kayıttakiyle aynı, ne yapılacağını söyler); aynı gün serbest; sıradaki numara değişmez", async () => {
    const ctx = await setup();
    const ayse = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    const first = await ctx.must("bugün", ctx.api.post(INV, saleBody(ayse, ctx.day(0))));
    assert.equal(first.number, "FIS2026000000001");
    const calc = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(-1)))).data;
    const expected = `FIS serisinde son belge FIS2026000000001 ${dayText(ctx.day(0))} tarihli; yeni belge daha eski tarihli kaydedilemez (numara ve tarih sırası uyuşmalı). Belge tarihini ${dayText(ctx.day(0))} ya da sonrası yapın.`;
    assert.deepEqual(calc.numbering, [expected], JSON.stringify(calc.numbering));
    assert.ok(calc.blockers.includes(expected), "kesin red nedeni (form onayı açmaz)");
    assert.equal(calc.orderHold, null);
    const before = ctx.count();
    const saved = await ctx.api.post(INV, saleBody(ayse, ctx.day(-1)));
    assert.equal(saved.status, 400);
    assert.equal(saved.data.code, "chronology");
    assert.equal(saved.data.error, expected, "kayıt aynı iletiyle reddeder");
    assert.equal(ctx.count(), before, "belge yazılmadı");
    // Aynı gün sırayı bozmaz (katı <): ön hesap boş, kayıt numara alır.
    const same = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(0)))).data;
    assert.deepEqual(same.numbering, []);
    assert.deepEqual(same.blockers, []);
    assert.equal(same.nextNumber, "FIS2026000000002");
    assert.equal((await ctx.must("aynı gün", ctx.api.post(INV, saleBody(ayse, ctx.day(0))))).number, "FIS2026000000002");
  });

  test("5 seri: SMM kendi serisinde; alış (elle numara) seri sırasına bağlı değil; satıştan iade (numarasız → iç seri IAD; numaralı → elle) ve alıştan iade (kendi serimiz FIS)", async () => {
    const ctx = await setup();
    const ayse = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    const firm = await ctx.account({ name: "Danışan Ltd.", type: "customer", taxNo: "1234567890", taxOffice: "Konak" });
    const supplier = await ctx.account({ name: "Toptancı A.Ş.", type: "supplier" });
    // İadelerin asıl satışı (FIS…001, 6 gün önce) önce kesilir; sonra bugünün FIS…002'si.
    const sale = await ctx.must("asıl", ctx.api.post(INV, saleBody(ayse, ctx.day(-6), { lines: [{ name: "Ürün", qty: 3, unitPrice: 100, vatRate: 20 }] })));
    // SMM: FIS'teki belge SMM serisini etkilemez.
    await ctx.must("FIS bugün", ctx.api.post(INV, saleBody(ayse, ctx.day(0))));
    const smm = { kind: "smm", accountId: firm, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } };
    assert.deepEqual((await ctx.api.post(CALC, { ...smm, issueDate: ctx.day(-3) })).data.numbering, [], "SMM serisinde belge yok");
    await ctx.must("SMM", ctx.api.post(INV, { ...smm, issueDate: ctx.day(-2) }));
    const smmCalc = (await ctx.api.post(CALC, { ...smm, issueDate: ctx.day(-3) })).data;
    assert.equal(smmCalc.numbering.length, 1);
    assert.match(smmCalc.numbering[0], /^SMM serisinde son belge SMM2026000000001 /);
    const smmSave = await ctx.api.post(INV, { ...smm, issueDate: ctx.day(-3) });
    assert.equal(smmSave.status, 400);
    assert.equal(smmSave.data.error, smmCalc.numbering[0]);
    // Alış: numara tedarikçinin; geriye tarih serbest.
    const pc = (await ctx.api.post(CALC, purchaseBody(supplier, ctx.day(-9), "A-1"))).data;
    assert.deepEqual(pc.numbering, []);
    await ctx.must("alış eski", ctx.api.post(INV, purchaseBody(supplier, ctx.day(-9), "A-1")));
    // Satıştan iade: asıl satış (3 adet) → numarasız iade bugün (IAD) → numarasız iade dün: iç seride çakışma; numaralı iade (müşterinin No) serbest.
    const lineId = (await ctx.api.get(`${INV}/${sale.id}`)).data.lines[0].id;
    const ret = (date, number = "") => ({ kind: "sale_return", originalId: sale.id, issueDate: date, number, lines: [{ originLineId: lineId, qty: 1 }], payment: { rest: "open" } });
    const r1 = await ctx.must("iade bugün", ctx.api.post(INV, ret(ctx.day(0))));
    assert.match(r1.number, /^IAD2026/);
    const rc = (await ctx.api.post(CALC, ret(ctx.day(-1)))).data;
    assert.equal(rc.numbering.length, 1, JSON.stringify(rc.numbering));
    assert.match(rc.numbering[0], /^IAD serisinde son belge IAD2026000000001 /);
    const rs = await ctx.api.post(INV, ret(ctx.day(-1)));
    assert.equal(rs.status, 400);
    assert.equal(rs.data.error, rc.numbering[0]);
    assert.deepEqual((await ctx.api.post(CALC, ret(ctx.day(-1), "MI-7"))).data.numbering, [], "müşterinin numarası: iç seri yok");
    await ctx.must("numaralı iade", ctx.api.post(INV, ret(ctx.day(-1), "MI-7")));
    // Aynı caride aynı numaralı ikinci iade: elle numara çakışması. (Not: "mi-7" Türkçe büyük harfle "Mİ-7" olur — başka numara; kayıt da öyle sayar.)
    const dup = (await ctx.api.post(CALC, ret(ctx.day(0), "MI-7"))).data;
    assert.deepEqual(dup.numbering, [`MI-7 numaralı satıştan iade faturası bu caride ${dayText(ctx.day(-1))} tarihiyle zaten kayıtlı.`]);
    const dupSave = await ctx.api.post(INV, ret(ctx.day(0), "MI-7"));
    assert.equal(dupSave.status, 409);
    assert.equal(dupSave.data.code, "invoice-duplicate");
    assert.equal(dupSave.data.error, dup.numbering[0]);
    // Alıştan iade: kendi serimiz (FIS) — FIS'in son belgesi bugün.
    const purchase = await ctx.must("alış", ctx.api.post(INV, purchaseBody(supplier, ctx.day(-8), "A-2", { lines: [{ name: "Malzeme", qty: 2, unitPrice: 50, vatRate: 20 }] })));
    const pLine = (await ctx.api.get(`${INV}/${purchase.id}`)).data.lines[0].id;
    const pret = date => ({ kind: "purchase_return", originalId: purchase.id, issueDate: date, lines: [{ originLineId: pLine, qty: 1 }], payment: { rest: "open" } });
    const prc = (await ctx.api.post(CALC, pret(ctx.day(-1)))).data;
    assert.equal(prc.numbering.length, 1);
    assert.match(prc.numbering[0], /^FIS serisinde son belge FIS2026000000002 /, JSON.stringify(prc.numbering));
    const prs = await ctx.api.post(INV, pret(ctx.day(-1)));
    assert.equal(prs.status, 400);
    assert.equal(prs.data.error, prc.numbering[0]);
  });

  test("6 elle numara: aynı caride aynı numara söylenir (büyük/küçük harf aynı), başka caride serbest; Düzenle'de belgenin kendisi çakışma sayılmaz", async () => {
    const ctx = await setup();
    const s1 = await ctx.account({ name: "Toptancı A.Ş.", type: "supplier" });
    const s2 = await ctx.account({ name: "Başka Toptancı", type: "supplier" });
    const p1 = await ctx.must("alış", ctx.api.post(INV, purchaseBody(s1, ctx.day(-2), "ABC123")));
    const p2 = await ctx.must("alış 2", ctx.api.post(INV, purchaseBody(s1, ctx.day(-1), "XYZ9")));
    const calc = (await ctx.api.post(CALC, purchaseBody(s1, ctx.day(0), "abc123"))).data;
    const expected = `ABC123 numaralı alış faturası bu caride ${dayText(ctx.day(-2))} tarihiyle zaten kayıtlı.`;
    assert.deepEqual(calc.numbering, [expected]);
    const saved = await ctx.api.post(INV, purchaseBody(s1, ctx.day(0), "abc123"));
    assert.equal(saved.status, 409);
    assert.equal(saved.data.error, expected);
    assert.deepEqual((await ctx.api.post(CALC, purchaseBody(s2, ctx.day(0), "ABC123"))).data.numbering, [], "başka cari");
    // Düzenle: kendi numarasıyla — çakışma yok (kimliği gönderilir); başka belgenin numarasına çevirmek — çakışma, kayıt da reddeder.
    assert.deepEqual((await ctx.api.post(CALC, { ...purchaseBody(s1, ctx.day(-2), "ABC123"), existingId: p1.id })).data.numbering, []);
    const edit = (await ctx.api.post(CALC, { ...purchaseBody(s1, ctx.day(-1), "ABC123"), existingId: p2.id })).data;
    assert.deepEqual(edit.numbering, [expected]);
    const edited = await ctx.api.post(`${INV}/${p2.id}/edit`, purchaseBody(s1, ctx.day(-1), "ABC123"));
    assert.equal(edited.status, 409);
    assert.equal(edited.data.error, expected);
    await ctx.must("kendi numarasıyla düzenle", ctx.api.post(`${INV}/${p1.id}/edit`, purchaseBody(s1, ctx.day(-2), "ABC123", { note: "düzeltme" })));
  });

  test("7 dönem kilidi: kilitli güne yeni belge ve Düzenle'de kilitli güne taşıma ön hesapta söylenir; kilidin ertesi günü serbest", async () => {
    const ctx = await setup();
    const supplier = await ctx.account({ name: "Toptancı A.Ş.", type: "supplier" });
    const ayse = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    const p = await ctx.must("alış", ctx.api.post(INV, purchaseBody(supplier, ctx.day(-5), "K-1")));
    await ctx.must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: ctx.day(-10) }));
    const lockText = date => `Fatura ${dayText(date)} tarihli; ${dayText(ctx.day(-10))} ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı.`;
    const c1 = (await ctx.api.post(CALC, purchaseBody(supplier, ctx.day(-10), "K-2"))).data;
    assert.deepEqual(c1.numbering, [lockText(ctx.day(-10))]);
    const s1 = await ctx.api.post(INV, purchaseBody(supplier, ctx.day(-10), "K-2"));
    assert.equal(s1.status, 409);
    assert.equal(s1.data.code, "period-locked");
    assert.equal(s1.data.error, c1.numbering[0]);
    assert.deepEqual((await ctx.api.post(CALC, purchaseBody(supplier, ctx.day(-9), "K-2"))).data.numbering, [], "kilidin ertesi günü");
    // Kâğıt satış: kilit + seri sırası birlikte (ikisi de söylenir; kayıt önce kilidi söyler).
    await ctx.must("satış", ctx.api.post(INV, saleBody(ayse, ctx.day(0))));
    const both = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(-12)))).data.numbering;
    assert.equal(both.length, 2, JSON.stringify(both));
    assert.equal(both[0], lockText(ctx.day(-12)));
    assert.match(both[1], /^FIS serisinde son belge/);
    assert.equal((await ctx.api.post(INV, saleBody(ayse, ctx.day(-12)))).data.error, both[0]);
    // Düzenle: kilitli güne taşıma.
    const ec = (await ctx.api.post(CALC, { ...purchaseBody(supplier, ctx.day(-11), "K-1"), existingId: p.id })).data;
    assert.deepEqual(ec.numbering, [lockText(ctx.day(-11))]);
    const ed = await ctx.api.post(`${INV}/${p.id}/edit`, purchaseBody(supplier, ctx.day(-11), "K-1"));
    assert.equal(ed.status, 409);
    assert.equal(ed.data.error, ec.numbering[0]);
  });

  test("9 Düzenle: önceki / sonraki belge sınırı Düzenle kuralıyla (yeni belge kuralı yanlış uyarı vermez); 11 taslak kaydı engellenmez", async () => {
    const ctx = await setup();
    const ayse = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    const f1 = await ctx.must("1", ctx.api.post(INV, saleBody(ayse, ctx.day(-5))));
    const f2 = await ctx.must("2", ctx.api.post(INV, saleBody(ayse, ctx.day(-3))));
    await ctx.must("3", ctx.api.post(INV, saleBody(ayse, ctx.day(-1))));
    const editCalc = async date => (await ctx.api.post(CALC, { ...saleBody(ayse, date), existingId: f2.id })).data.numbering;
    // Tarihi değişmeyen (ya da arada kalan) ortadaki belge: Düzenle serbest. Yeni belge kuralı ("son belge FIS…003") burada YANLIŞ uyarı olurdu.
    assert.deepEqual(await editCalc(ctx.day(-3)), [], "tarih aynı");
    assert.deepEqual(await editCalc(ctx.day(-4)), [], "arada");
    const older = await editCalc(ctx.day(-6));
    assert.deepEqual(older, [`Önceki belge ${f1.number} ${dayText(ctx.day(-5))} tarihli; bu belge ondan eski tarihli olamaz (numara ve tarih sırası).`]);
    const newer = await editCalc(ctx.day(0));
    assert.deepEqual(newer, [`Sonraki belge FIS2026000000003 ${dayText(ctx.day(-1))} tarihli; bu belge ondan yeni tarihli olamaz (numara ve tarih sırası).`]);
    for (const [date, message] of [[ctx.day(-6), older[0]], [ctx.day(0), newer[0]]]) {
      const res = await ctx.api.post(`${INV}/${f2.id}/edit`, saleBody(ayse, date));
      assert.equal(res.status, 400);
      assert.equal(res.data.error, message);
    }
    await ctx.must("arada düzenle", ctx.api.post(`${INV}/${f2.id}/edit`, saleBody(ayse, ctx.day(-4))));
    // Taslak: numara almaz — geriye tarihli taslak kaydedilir; ön hesap Kaydet'in reddini söyler; taslaktan kayıt aynı iletiyle reddeder.
    const draftCalc = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(-2)))).data.numbering;
    assert.equal(draftCalc.length, 1);
    const draft = await ctx.must("taslak", ctx.api.post(INV, saleBody(ayse, ctx.day(-2), { status: "draft" })));
    const issued = await ctx.api.post(`${INV}/${draft.id}/issue`, {});
    assert.equal(issued.status, 400);
    assert.equal(issued.data.error, draftCalc[0]);
  });

  test("3 yıl dönümü: seri yılı ayrı (31.12 belgesi 01.01 numaralısından sonra serbest); aynı yıl içinde engel; Düzenle'de başka yıla alınamaz", async () => {
    const ctx = await setup({ now: "2027-01-02T09:00:00" });
    const ayse = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    await ctx.must("2026 sonu", ctx.api.post(INV, saleBody(ayse, "2026-12-30")));
    const y27 = await ctx.must("2027", ctx.api.post(INV, saleBody(ayse, "2027-01-02")));
    assert.equal(y27.number, "FIS2027000000001");
    const c31 = (await ctx.api.post(CALC, saleBody(ayse, "2026-12-31"))).data;
    assert.deepEqual(c31.numbering, [], "2026 serisinde son belge 30.12");
    assert.equal(c31.nextNumber, "FIS2026000000002");
    const c01 = (await ctx.api.post(CALC, saleBody(ayse, "2027-01-01"))).data.numbering;
    assert.deepEqual(c01, ["FIS serisinde son belge FIS2027000000001 02.01.2027 tarihli; yeni belge daha eski tarihli kaydedilemez (numara ve tarih sırası uyuşmalı). Belge tarihini 02.01.2027 ya da sonrası yapın."]);
    assert.equal((await ctx.api.post(INV, saleBody(ayse, "2027-01-01"))).data.error, c01[0]);
    assert.equal((await ctx.must("31.12", ctx.api.post(INV, saleBody(ayse, "2026-12-31")))).number, "FIS2026000000002");
    const cross = (await ctx.api.post(CALC, { ...saleBody(ayse, "2026-12-31"), existingId: y27.id })).data.numbering;
    assert.deepEqual(cross, ["Numara 2027 yılına ait; tarih başka yıla alınamaz."]);
    const res = await ctx.api.post(`${INV}/${y27.id}/edit`, saleBody(ayse, "2026-12-31"));
    assert.equal(res.status, 400);
    assert.equal(res.data.error, cross[0]);
  });

  test("10 002 şirketi: ön hesap seçili şirketin serisine ve kilidine bakar", async () => {
    const ctx = await setup();
    const ayse = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    await ctx.must("001 bugün", ctx.api.post(INV, saleBody(ayse, ctx.day(0))));
    const company = (await ctx.must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: true }))).company;
    assert.equal(company.code, "002");
    const b = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    const empty = (await ctx.api.post(CALC, saleBody(b, ctx.day(-1)))).data;
    assert.deepEqual(empty.numbering, [], "002'de FIS serisinde belge yok (001'inki sayılmaz)");
    assert.equal(empty.nextNumber, "FIS2026000000001");
    await ctx.must("002 dün", ctx.api.post(INV, saleBody(b, ctx.day(-1))));
    await ctx.must("002 kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: ctx.day(-20) }));
    const in002 = (await ctx.api.post(CALC, saleBody(b, ctx.day(-2)))).data.numbering;
    assert.equal(in002.length, 1);
    assert.match(in002[0], new RegExp(`^FIS serisinde son belge FIS2026000000001 ${dayText(ctx.day(-1)).replace(/\./g, "\\.")} tarihli`));
    assert.equal((await ctx.api.post(INV, saleBody(b, ctx.day(-2)))).data.error, in002[0]);
    await ctx.must("001'e dön", ctx.api.post("/api/companies/select", { id: "sirket-001" }));
    const in001 = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(-21)))).data.numbering;
    assert.equal(in001.length, 1, `001'de kilit yok, yalnız seri sırası: ${JSON.stringify(in001)}`);
    assert.match(in001[0], new RegExp(`^FIS serisinde son belge FIS2026000000001 ${dayText(ctx.day(0)).replace(/\./g, "\\.")} tarihli`));
  });

  test("ayrışma: tohumlu rastgele sırada her adımda ön hesabın hükmü = kaydın sonucu (ileti aynı; kabulde numara)", async () => {
    const ctx = await setup();
    const ayse = await ctx.account({ name: "Ayşe Kaya", type: "customer" });
    const firm = await ctx.account({ name: "Danışan Ltd.", type: "customer", taxNo: "1234567890", taxOffice: "Konak" });
    const supplier = await ctx.account({ name: "Toptancı A.Ş.", type: "supplier" });
    let seed = 2441522;
    const rand = n => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const tally = { ok: 0, rejected: 0, lock: 0 };
    for (let step = 0; step < 90; step += 1) {
      if (step === 45) await ctx.must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: ctx.day(-24) }));
      const date = ctx.day(-rand(30));
      const pick = rand(3);
      const body = pick === 0 ? saleBody(ayse, date) : pick === 1 ? { kind: "smm", accountId: firm, issueDate: date, lines: LINES, payment: { rest: "open" } } : purchaseBody(supplier, date, `P-${rand(12)}`);
      const calc = await ctx.api.post(CALC, body);
      assert.equal(calc.status, 200, JSON.stringify(calc.data).slice(0, 300));
      const saved = await ctx.api.post(INV, body);
      const where = `adım ${step} (${pick} ${date} ${body.number || ""})`;
      if (calc.data.numbering.length) {
        assert.notEqual(saved.status, 200, `${where}: ön hesap "${calc.data.numbering[0]}" dedi, kayıt kabul etti`);
        assert.equal(saved.data.error, calc.data.numbering[0], `${where}: ileti aynı`);
        tally.rejected += 1;
        if (saved.data.code === "period-locked") tally.lock += 1;
      } else {
        assert.equal(saved.status, 200, `${where}: ön hesap boş, kayıt reddetti: ${JSON.stringify(saved.data).slice(0, 300)}`);
        if (pick !== 2) assert.equal(saved.data.number, calc.data.nextNumber, `${where}: numara ön hesaptaki`);
        tally.ok += 1;
      }
    }
    // Ön koşul: üç yol da (kabul, seri/numara reddi, kilit reddi) gerçekten oluştu (ders 20).
    assert.ok(tally.ok >= 10 && tally.rejected - tally.lock >= 10 && tally.lock >= 3, JSON.stringify(tally));
  });
});

describe("2.4.4 UX15: e-Belge (sahte EDM; ağa çıkmaz)", () => {
  const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || "Kişi", taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
  const FIRM = { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" };

  test("5 Kes, Sonra Gönder ve Kaydet ve Gönder aynı koşul ve aynı iletiyle reddedilir; ön hesap ikisinden önce söyler (e-Arşiv TEA)", async () => {
    const ctx = await setup({ edoc: true });
    const ayse = await ctx.account(person("Ayşe Kaya", "10000000146"));
    const sent = await ctx.must("gönder", ctx.api.post(INV, saleBody(ayse, ctx.day(0), { eSend: "now" })));
    assert.equal(sent.autoSend?.ok, true, JSON.stringify(sent.autoSend));
    assert.equal(sent.number, "TEA2026000000001");
    const calc = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(-1)))).data;
    assert.equal(calc.profile, "EARSIVFATURA");
    assert.equal(calc.numbering.length, 1, JSON.stringify(calc.numbering));
    assert.match(calc.numbering[0], new RegExp(`^TEA serisinde son belge TEA2026000000001 .+ Belge tarihini ${dayText(ctx.day(0)).replace(/\./g, "\\.")} ya da sonrası yapın\\.$`));
    const before = ctx.count();
    const now = await ctx.api.post(INV, saleBody(ayse, ctx.day(-1), { eSend: "now" }));
    assert.equal(now.status, 400);
    assert.equal(now.data.error, calc.numbering[0]);
    const later = await ctx.api.post(INV, saleBody(ayse, ctx.day(-1), { eSend: "later" }));
    assert.equal(later.status, 400);
    assert.equal(later.data.code, "chronology");
    // Kâhin I23 (22.10.2026): ön hesap hangi düğmeye basılacağını bilmez — Kes, Sonra Gönder de ön hesabın iletisiyle reddedilir.
    assert.equal(later.data.error, calc.numbering[0]);
    assert.equal(ctx.count(), before, "hiçbir yol belge yazmadı");
    assert.equal(ctx.edm.state.sent.length, 1, "EDM'ye yeni istek yok");
  });

  test("8 daha eski bekleyen: numara kayıtta verilmeyecekse ön hesap söyler (orderHold) — kayıt da numarasız Gönderilecekler'e koyar", async () => {
    const ctx = await setup({ edoc: true });
    const ayse = await ctx.account(person("Ayşe Kaya", "10000000146"));
    const mehmet = await ctx.account(person("Mehmet Demir", "12345678950"));
    await ctx.must("eski gönderilen", ctx.api.post(INV, saleBody(ayse, ctx.day(-5), { eSend: "now" })));
    const waiting = await ctx.must("bekleyen", ctx.api.post(INV, saleBody(mehmet, ctx.day(-3), { eSend: "later" })));
    assert.equal(waiting.number, "");
    const calc = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(0)))).data;
    assert.deepEqual(calc.numbering, []);
    assert.deepEqual(calc.orderHold, { count: 1, text: "Bu seride daha eski tarihli gönderilmemiş 1 belge var; GİB sıra kuralı gereği önce onlar gönderilmeli. Belge numarasız Gönderilecekler'e eklenecek — Tümünü Gönder ile eskiden yeniye gönderin." });
    const saved = await ctx.must("bugün", ctx.api.post(INV, saleBody(ayse, ctx.day(0), { eSend: "now" })));
    assert.equal(saved.number, "", "numara verilmedi (ön hesabın dediği gibi)");
    assert.equal(saved.autoSend?.code, "einvoice-order");
    // Bekleyenden eski tarihli belge onu beklemez: orderHold yok, numara verilir.
    const older = (await ctx.api.post(CALC, saleBody(ayse, ctx.day(-4)))).data;
    assert.equal(older.orderHold, null);
    assert.deepEqual(older.numbering, []);
    const numbered = await ctx.must("-4", ctx.api.post(INV, saleBody(ayse, ctx.day(-4), { eSend: "now" })));
    assert.equal(numbered.number, older.nextNumber);
    // Düzenle numara vermez: bekleyen belgenin Düzenle ön hesabında orderHold yok; serinin sonundan eski tarihe almak söylenir.
    const ec = (await ctx.api.post(CALC, { ...saleBody(mehmet, ctx.day(-6)), existingId: waiting.id })).data;
    assert.equal(ec.orderHold, null);
    assert.deepEqual(ec.numbering, [`TEA serisinde son gönderilen belge TEA2026000000002 ${dayText(ctx.day(-4))} tarihli; numarası gönderimde verilecek bu belge ondan eski tarihli olamaz (numara ve tarih sırası).`]);
    const ed = await ctx.api.post(`${INV}/${waiting.id}/edit`, saleBody(mehmet, ctx.day(-6)));
    assert.equal(ed.status, 400);
    assert.equal(ed.data.error, ec.numbering[0]);
  });

  test("4 iki kullanıcı aynı anda: A formdayken (uyarı yok) B daha yeni tarihli e-Fatura kaydeder; A'nın Kaydet öncesi ön hesabı söyler, yarışta kayıt yine reddeder", async () => {
    const ctx = await setup({ edoc: true });
    const firm = await ctx.account(FIRM);
    const bClient = await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" });
    const b = ctx.wrap(bClient);
    const formA = saleBody(firm, ctx.day(-1));
    const first = (await ctx.api.post(CALC, formA)).data;
    assert.equal(first.profile, "TEMELFATURA");
    assert.deepEqual(first.numbering, [], "A formu açarken çakışma yok");
    assert.equal(first.nextNumber, "TEF2026000000001");
    const bSaved = await ctx.must("B kaydeder", b.post(INV, saleBody(firm, ctx.day(0), { eSend: "now" })));
    assert.equal(bSaved.number, "TEF2026000000001");
    // Form Kaydet'e basınca önce yeniden hesaplar (submitForm → runCalc): çakışma onaydan önce görünür.
    const again = (await ctx.api.post(CALC, formA)).data;
    assert.equal(again.numbering.length, 1);
    assert.match(again.numbering[0], /^TEF serisinde son belge TEF2026000000001 /);
    // Yarış (A'nın ön hesabı B'den önce boş döndü): asıl güvence kayıttaki denetim.
    const aSaved = await ctx.api.post(INV, { ...formA, eSend: "now" });
    assert.equal(aSaved.status, 400);
    assert.equal(aSaved.data.error, again.numbering[0]);
    // Aynı anda iki kayıt: ikisinin ön hesabı boş (ikisi de dün); biri numara alır, öbürü de (aynı gün) — sıra bozulmaz.
    const two = await Promise.all([ctx.api.post(INV, saleBody(firm, ctx.day(0), { eSend: "now" })), b.post(INV, saleBody(firm, ctx.day(0), { eSend: "now" }))]);
    assert.deepEqual(two.map(item => item.status), [200, 200]);
    assert.deepEqual(two.map(item => item.data.number).sort(), ["TEF2026000000002", "TEF2026000000003"]);
  });

  test("12 yetkisiz: fatura görme yetkisi olmayan ön hesabı çağıramaz (çakışma bilgisi sızmaz)", async () => {
    const ctx = await setup({ edoc: true });
    const ayse = await ctx.account(person("Ayşe Kaya", "10000000146"));
    const staff = ctx.wrap(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
    const res = await staff.post(CALC, saleBody(ayse, ctx.day(-1)));
    assert.equal(res.status, 403);
    assert.equal(res.data.numbering, undefined);
  });
});
