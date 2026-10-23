// 2.4.4 E6 (eleştirmen 31d, 22.10.2026; karar kullanıcı adına 5 dk yetkisiyle — 22.10 "verilmiş kâğıt / fiş numarası bir daha kullanılmaz" kararıyla aynı,
// yaygın uygulama): kâğıt ve fiş serisinde (Müşteri Fişi FIS, kâğıt makbuz SMM, iç iade IAD) verilmiş numara belge SİLİNSE de kullanılmış sayılır. Serinin
// tabanı yalnız yükselir (v32'nin numberFloor düzeni, routes/invoices.mjs reserveNumber); Silinenler'den geri yüklenen belge KENDİ numarasıyla döner; iki belge
// aynı numarayı taşımaz — numara arada başka belgeye verilmişse (eski veri) geri yükleme reddedilir, belge Silinenler'de kalır.
// Kök neden (ad865f0, 2.4.3'te de): deleteInvoice satırı siler, nextNumber yalnız seride DURAN belgelerin MAX(seq)'ini sayar → silinen son numara sıradaki
// belgeye yeniden verilir; restoreDeleted çakışmada sıra numarasını düşürüp numara metnini bırakıyordu (listede iki belge FIS…001).
//
// "Nasıl bozulur?" (önce yazıldı — not defteri e67/NASIL-BOZULUR.md; testler buradan):
//   N1  Müşteri Fişi FIS n sil → yeni bırakma FIS n'i yeniden alır (kök)            → S1
//   N2  sil → yeni belge → Silinenler'den geri yükle → iki belgede FIS n             → S1
//   N3  sil + aynı cari ve aynı içerikle yeniden kes → n+1                           → S1
//   N4  kâğıt makbuz (Kâğıt Makbuz Olarak Bırak, SMM), kâğıt kayıt (Kâğıt profil), iç iade (IAD) → S2, S3, S8
//   N5  toplu sil; iptal edilmiş belgeyi sil                                          → S3
//   N6  iki oturum aynı anda: biri siler, öbürü bırakır (iki sıra)                   → S5
//   N7  002 şirketi kendi tabanını tutar                                              → S6
//   N8  eski veri: numara arada verilmişse geri yükleme 409, belge Silinenler'de      → S7 (gerçek v2.4.3 verisiyle: test/goc-244-silinen-numara.test.mjs)
//   N9  numara–tarih sırası: silinen son belgenin NUMARASI kullanılmış, TARİHİ sırayı bağlamaz (r31e N1, 23.10.2026; önceden "serinin son tarihi") → S4
//       (yanlış tarihle silinen fişin doğru tarihle yeniden kesilmesi ve sırayı bozan geri yükleme: test/numara-silinen-tarih-244.test.mjs)
//   N10 taslak / numarasız bekleyen silmek tabanı değiştirmez                         → S4
//   N12 geri yüklenen belge kendi numarasıyla; sonraki numara değişmez                → S1, S2
// Kâhin: karar metni (yukarıda) + veri tabanı sayımı (bir numara en çok bir canlı belgede: number ∪ paper_no). Bu dosya programla aynı elden (ders 5).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const TODAY = "2026-06-17";
const day = offset => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const fis = seq => `FIS2026${String(seq).padStart(9, "0")}`;
const smm = seq => `SMM2026${String(seq).padStart(9, "0")}`;

async function boot() {
  resetEdmCaches();
  const edm = await startMockEdm();
  const server = await startTestServer({ edocEnabled: true, esmmEnabled: true, now: `${TODAY}T10:00:00`, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const wrap = c => ({ get: async url => unwrap(await c.get(url)), post: async (url, body) => unwrap(await c.post(url, body)), put: async (url, body) => unwrap(await c.put(url, body)), del: async url => unwrap(await c.del(url)) });
  const api = wrap(client);
  const ctx = { edm, server, api, wrap, store: server.app.store };
  ctx.setup = async (q = "", name = SELLER.name, extra = {}) => {
    const saved = await api.put(`/api/workspace/invoices/settings${q}`, { ...extra, seller: { ...SELLER, name }, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const ids = {};
    for (const [key, body] of [["client", CLIENT], ["person", PERSON]]) {
      const created = await api.post(`/api/workspace/accounts${q}`, body);
      assert.equal(created.status, 200, JSON.stringify(created.data));
      ids[key] = created.data.id || created.data.account?.id;
    }
    return ids;
  };
  ctx.ids = await ctx.setup();
  ctx.must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  ctx.sale = (extra = {}, q = "", accountId = ctx.ids.person, a = api) => a.post(`/api/workspace/invoices${q}`, { scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, issueDate: day(0), eSend: "later", ...extra });
  ctx.makbuz = (extra = {}) => api.post("/api/workspace/invoices", { scenario: "smm", accountId: ctx.ids.client, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, issueDate: day(0), eSend: "later", ...extra });
  ctx.withdraw = (id, q = "", a = api) => a.post(`/api/workspace/invoices/${id}/withdraw${q}`, {});
  ctx.remove = (id, q = "", a = api) => a.del(`/api/workspace/invoices/${id}${q ? `${q}&` : "?"}reason=${encodeURIComponent("test: sil")}`);
  // "Kes, Sonra Gönder" → Müşteri Fişi / Kâğıt Makbuz Olarak Bırak: kâğıt serisinden numara.
  ctx.slip = async (label, create = () => ctx.sale(), q = "") => {
    const doc = await ctx.must(`${label} kayıt`, create());
    const left = await ctx.must(`${label} bırak`, ctx.withdraw(doc.id, q));
    return { id: doc.id, number: left.number };
  };
  ctx.trashItem = async (invoiceId, q = "") => (await ctx.must("Silinenler", api.get(`/api/admin/trash${q}`))).find(item => item.kind === "invoice" && item.ref === invoiceId);
  ctx.restore = async (invoiceId, q = "") => {
    const item = await ctx.trashItem(invoiceId, q);
    assert.ok(item, `Silinenler'de yok: ${invoiceId}`);
    return api.post(`/api/admin/trash/restore${q}`, { id: item.id });
  };
  ctx.nextPaper = async (key = "paper", q = "") => (await ctx.must("ayar", api.get(`/api/workspace/invoices/settings${q}`))).nextNumbers[key].number;
  // Kâhin sayımı: numara en çok bir canlı belgede (belge numarası ya da Kâğıt Fatura No).
  ctx.holders = (number, store = ctx.store) => store.all("SELECT id, number, paper_no AS paperNo, status FROM invoices WHERE number = ? OR paper_no = ?", number, number);
  ctx.close = async () => {
    await server.close();
    await edm.close();
  };
  return ctx;
}

describe("E6: silinen kâğıt / fiş belgenin numarası kullanılmış sayılır; geri yüklenen belge kendi numarasıyla döner", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("S1 Müşteri Fişi: A FIS…001 → Sil → aynı cari ve içerikle B → FIS…002 (FIS…001 yeniden verilmez); A geri yüklenince kendi numarasıyla döner, iki belgede aynı numara yok", async () => {
    const a = await ctx.slip("A");
    assert.equal(a.number, fis(1));
    const removed = await ctx.must("A sil", ctx.remove(a.id));
    assert.equal(removed.number, fis(1));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE id = ?", a.id).n, 0, "ön koşul: A seride değil (Silinenler'de)");
    assert.equal(await ctx.nextPaper(), fis(2), "Fatura Ayarları sıradaki numarayı doğru gösterir");
    const b = await ctx.slip("B (aynı cari, aynı içerik)");
    assert.equal(b.number, fis(2), `B'nin fiş numarası: ${b.number} — silinen A'nın numarası yeniden verilmemeli`);
    const back = await ctx.restore(a.id);
    assert.equal(back.status, 200, JSON.stringify(back.data));
    assert.match(back.data.message, new RegExp(`${fis(1)} geri geldi`));
    assert.doesNotMatch(back.data.message, /sıra numarası düştü/);
    const row = ctx.store.get("SELECT number, seq, status FROM invoices WHERE id = ?", a.id);
    assert.deepEqual({ ...row }, { number: fis(1), seq: 1, status: "cancelled" }, "kendi numarası ve sırasıyla, etkisiz");
    for (const n of [1, 2]) assert.equal(ctx.holders(fis(n)).length, 1, `${fis(n)}: ${JSON.stringify(ctx.holders(fis(n)))}`);
    assert.equal(await ctx.nextPaper(), fis(3), "geri yükleme sıradaki numarayı değiştirmez");
  });

  test("S2 kâğıt makbuz: e-SMM makbuzu Kâğıt Makbuz Olarak Bırak SMM…001 → Sil → yeni makbuz SMM…002; geri yüklenen SMM…001 tek", async () => {
    const a = await ctx.slip("makbuz A", () => ctx.makbuz());
    assert.equal(a.number, smm(1));
    await ctx.must("makbuz A sil", ctx.remove(a.id));
    assert.equal(await ctx.nextPaper("smm"), smm(2));
    const b = await ctx.slip("makbuz B", () => ctx.makbuz());
    assert.equal(b.number, smm(2), `B'nin kâğıt makbuz numarası: ${b.number}`);
    assert.equal((await ctx.restore(a.id)).status, 200);
    for (const n of [1, 2]) assert.equal(ctx.holders(smm(n)).length, 1, `${smm(n)}: ${JSON.stringify(ctx.holders(smm(n)))}`);
  });

  test("S3 kâğıt kayıt (Kâğıt profil), iptal edilmiş belgeyi silme ve toplu sil: hiçbir silinen numara yeniden verilmez", async () => {
    await ctx.must("e-Arşiv kapalı", ctx.api.put("/api/workspace/invoices/settings", { earsiv: false }));
    try {
      const paper = await ctx.must("kâğıt fatura", ctx.sale({ profile: "KAGIT", eSend: undefined }));
      assert.equal(paper.number, fis(3));
      await ctx.must("iptal", ctx.api.post(`/api/workspace/invoices/${paper.id}/cancel`, { reason: "test: iptal sonra sil" }));
      await ctx.must("iptal edilmiş belgeyi sil", ctx.remove(paper.id));
      const second = await ctx.must("kâğıt fatura 2", ctx.sale({ profile: "KAGIT", eSend: undefined }));
      assert.equal(second.number, fis(4), `iptal edilip silinen ${fis(3)} yeniden verilmedi`);
      const third = await ctx.must("kâğıt fatura 3", ctx.sale({ profile: "KAGIT", eSend: undefined }));
      assert.equal(third.number, fis(5));
      const bulk = await ctx.must("toplu sil", ctx.api.post("/api/workspace/invoices/bulk-delete", { ids: [second.id, third.id], reason: "test: toplu sil" }));
      assert.equal(bulk.deleted ?? bulk.results.filter(item => item.ok).length, 2, JSON.stringify(bulk.results));
      assert.equal(ctx.store.get("SELECT MAX(seq) AS n FROM invoices WHERE series = 'FIS' AND year = 2026").n, 2, "ön koşul: seride en büyük FIS…002 duruyor");
      const fourth = await ctx.must("kâğıt fatura 4", ctx.sale({ profile: "KAGIT", eSend: undefined }));
      assert.equal(fourth.number, fis(6), "toplu silinen son numara (FIS…005) yeniden verilmedi");
    } finally {
      await ctx.must("e-Arşiv açık", ctx.api.put("/api/workspace/invoices/settings", { earsiv: true }));
    }
  });

  test("S4 numara–tarih sırası: silinen son fişin numarası kullanılmış kalır, tarihi sırayı bağlamaz (ileti seride duran son belgeyi anar); taslak ve numarasız bekleyeni silmek tabanı değiştirmez", async () => {
    const floor = () => JSON.parse(ctx.store.get("SELECT value FROM settings WHERE key = 'invoice.numberFloor'")?.value || "{}").FIS2026;
    assert.equal(floor().seq, 5, JSON.stringify(floor()));
    assert.equal(floor().deleted, true);
    // S3'ten: seride en büyük canlı belge FIS…006 (bugün), silinmiş en büyük numara FIS…005. Dünkü bekleyen belge fiş numarası almaz.
    const old = await ctx.must("dünkü bekleyen", ctx.sale());
    ctx.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", day(-1), old.id);
    const left = await ctx.withdraw(old.id);
    assert.equal(left.status, 409, JSON.stringify(left.data));
    assert.equal(left.data.code, "chronology");
    assert.match(left.data.error, /FIS serisinde son belge FIS2026000000006/, left.data.error);
    // Bilerek güncellendi (r31e N1, karar 23.10.2026): son silinen belge en büyük numara olsa da TARİHİ sırayı bağlamaz — engel seride duran FIS…006
    // (bugün); önceden ileti silinen FIS…007'yi "belge silindi" diye anıyordu. Numarası yine verilmez (aşağıda sıradaki FIS…008).
    const g = await ctx.slip("G");
    assert.equal(g.number, fis(7));
    await ctx.must("G sil", ctx.remove(g.id));
    const again = await ctx.withdraw(old.id);
    assert.equal(again.status, 409);
    assert.match(again.data.error, new RegExp(`son belge ${fis(6)} 17\\.06\\.2026 tarihli`), again.data.error);
    assert.doesNotMatch(again.data.error, /belge silindi|e-Belge olarak gönderildi/);
    await ctx.must("dünkü iptal", ctx.api.post(`/api/workspace/invoices/${old.id}/cancel`, { reason: "test: sıra" }));
    const before = JSON.stringify(floor());
    const draft = await ctx.must("taslak", ctx.sale({ status: "draft" }));
    await ctx.must("taslak sil", ctx.remove(draft.id));
    const waiting = await ctx.must("numarasız bekleyen", ctx.sale());
    assert.equal(ctx.store.get("SELECT seq FROM invoices WHERE id = ?", waiting.id).seq, 0, "ön koşul: numarasız");
    await ctx.must("numarasız bekleyeni sil", ctx.remove(waiting.id));
    assert.equal(JSON.stringify(floor()), before, "taban değişmedi");
    assert.equal(await ctx.nextPaper(), fis(8));
  });
});

describe("E6: iç iade serisi (IAD) — müşterinin numara vermediği satıştan iade", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("S8 numarasız satıştan iade IAD…001 → Sil → sonraki iade IAD…002; geri yüklenen IAD…001 kendi numarasıyla, tek", async () => {
    await ctx.must("e-Arşiv kapalı", ctx.api.put("/api/workspace/invoices/settings", { earsiv: false }));
    const sale = await ctx.must("asıl satış", ctx.sale({ profile: "KAGIT", eSend: undefined, issueDate: day(-1), lines: [{ name: "Ürün", qty: 3, unitPrice: 100, vatRate: 20 }] }));
    const lineId = (await ctx.must("kart", ctx.api.get(`/api/workspace/invoices/${sale.id}`))).lines[0].id;
    const ret = () => ctx.api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale.id, issueDate: day(0), number: "", lines: [{ originLineId: lineId, qty: 1 }], payment: { rest: "open" } });
    const r1 = await ctx.must("iade 1", ret());
    assert.equal(r1.number, "IAD2026000000001");
    await ctx.must("iade 1 sil", ctx.remove(r1.id));
    const r2 = await ctx.must("iade 2", ret());
    assert.equal(r2.number, "IAD2026000000002", `silinen iç iade numarası yeniden verilmedi: ${r2.number}`);
    assert.equal((await ctx.restore(r1.id)).status, 200);
    for (const n of ["IAD2026000000001", "IAD2026000000002"]) assert.equal(ctx.holders(n).length, 1, n);
  });
});

describe("E6: iki oturum, 002 şirketi, eski veride arada verilmiş numara", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("S5 iki oturum aynı anda: biri belgeyi silerken öbürü başka belgeyi bırakır (iki sıra) → her numara tek belgede; bütün silinenler geri yüklenebilir", async () => {
    const otherClient = ctx.server.client();
    assert.equal((await otherClient.login("admin", ADMIN_PASSWORD)).status, 200);
    const second = ctx.wrap(otherClient);
    const removed = [];
    for (let round = 0; round < 6; round += 1) {
      const doomed = await ctx.slip(`silinecek ${round}`);
      const next = await ctx.must(`bekleyen ${round}`, ctx.sale());
      const del = () => ctx.remove(doomed.id);
      const left = () => ctx.withdraw(next.id, "", second);
      const [d, l] = round % 2 ? await Promise.all([del(), left()]) : (await Promise.all([left(), del()])).reverse();
      assert.equal(d.status, 200, JSON.stringify(d.data));
      assert.equal(l.status, 200, JSON.stringify(l.data));
      assert.notEqual(l.data.number, doomed.number, `tur ${round}: silinen ${doomed.number} bırakılan belgeye verildi`);
      removed.push(doomed.id);
    }
    for (const id of removed) assert.equal((await ctx.restore(id)).status, 200, `geri yükle ${id}`);
    const all = ctx.store.all("SELECT number AS n FROM invoices WHERE number LIKE 'FIS%' UNION ALL SELECT paper_no AS n FROM invoices WHERE paper_no LIKE 'FIS%'").map(row => row.n);
    assert.equal(all.length, 12);
    assert.equal(new Set(all).size, all.length, `tekrar eden fiş numarası: ${all.filter((n, i) => all.indexOf(n) !== i)}`);
  });

  test("S6 002 şirketi kendi tabanını tutar: 002'de silinen FIS…001 002'de yeniden verilmez; 001'in sırası değişmez", async () => {
    const created = await ctx.must("002", ctx.api.post("/api/companies", { name: "İkinci Büro", select: false }));
    const q = `?hofCompany=${encodeURIComponent((created.company || created).id)}`;
    const ids = await ctx.setup(q, "İkinci Büro Ltd.", { start: { TEA2026: 500 } });
    const before001 = await ctx.nextPaper();
    const a = await ctx.slip("002 A", () => ctx.sale({}, q, ids.person), q);
    assert.equal(a.number, fis(1), "002 kendi serisinde baştan");
    await ctx.must("002 A sil", ctx.remove(a.id, q));
    const b = await ctx.slip("002 B", () => ctx.sale({}, q, ids.person), q);
    assert.equal(b.number, fis(2), `002 B: ${b.number}`);
    assert.equal(await ctx.nextPaper(), before001, "001'in sıradaki numarası değişmedi");
    assert.equal((await ctx.restore(a.id, q)).status, 200);
    assert.equal(await ctx.nextPaper("paper", q), fis(3));
  });

  test("S7 eski veride (2.4.3) numara arada başka belgeye verilmişse geri yükleme reddedilir; belge Silinenler'de kalır, numara tek belgede", async () => {
    // 2.4.3 benzetimi: silme tabana iz bırakmaz — taban silmeden önceki hâline döndürülür (gerçek eski sürüm verisiyle aynı yol:
    // test/goc-244-silinen-numara.test.mjs).
    const floorRaw = () => ctx.store.get("SELECT value FROM settings WHERE key = 'invoice.numberFloor'")?.value ?? null;
    const removeWithoutTrace = async (label, id) => {
      const saved = floorRaw();
      await ctx.must(label, ctx.remove(id));
      if (saved === null) ctx.store.run("DELETE FROM settings WHERE key = 'invoice.numberFloor'");
      else ctx.store.run("UPDATE settings SET value = ? WHERE key = 'invoice.numberFloor'", saved);
    };
    const start = Number((await ctx.nextPaper()).slice(-9));
    // (1) numara seride duran belgede.
    const a = await ctx.slip("A");
    assert.equal(a.number, fis(start));
    await removeWithoutTrace("A sil", a.id);
    const b = await ctx.slip("B");
    assert.equal(b.number, fis(start), "ön koşul (eski davranış benzetimi): numara B'ye verildi");
    const refused = await ctx.restore(a.id);
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "invoice-number-taken");
    assert.match(refused.data.error, new RegExp(`${fis(start)} geri yüklenmez: bu numara belge silindikten sonra başka bir belgeye verildi \\(17\\.06\\.2026 tarihli, Ayşe Kaya\\)`), refused.data.error);
    assert.ok(await ctx.trashItem(a.id), "belge Silinenler'de kalır");
    assert.equal(ctx.holders(fis(start)).length, 1);
    // (2) numara Kâğıt Fatura No'ya taşınmış belgede (bırakılıp e-Belge olarak gönderilen).
    const c = await ctx.slip("C");
    await removeWithoutTrace("C sil", c.id);
    const d = await ctx.slip("D");
    assert.equal(d.number, c.number, "ön koşul");
    const sent = await ctx.must("D gönder", ctx.api.post(`/api/workspace/invoices/${d.id}/send`, {}));
    assert.equal(sent.paperNo, c.number);
    const refused2 = await ctx.restore(c.id);
    assert.equal(refused2.status, 409, JSON.stringify(refused2.data));
    assert.match(refused2.data.error, new RegExp(`şimdi ${sent.number} numaralı`), refused2.data.error);
    // (2b) numara yalnız başka belgenin Kâğıt Fatura No'sunda (elle yazılmış; işlem geçmişinde bırakma yok).
    const c2 = await ctx.slip("C2");
    await removeWithoutTrace("C2 sil", c2.id);
    const typed = await ctx.must("Kâğıt Fatura No'su C2'nin numarası", ctx.sale({ paperNo: c2.number }));
    const refused2b = await ctx.restore(c2.id);
    assert.equal(refused2b.status, 409, JSON.stringify(refused2b.data));
    assert.equal(refused2b.data.holderId, typed.id);
    // (3) numara yalnız işlem geçmişinde (taşınan belgenin Kâğıt Fatura No'su önceden doluydu).
    const e = await ctx.slip("E");
    await removeWithoutTrace("E sil", e.id);
    const fDoc = await ctx.must("F kayıt", ctx.sale({ paperNo: "EL-77" }));
    assert.equal((await ctx.must("F bırak", ctx.withdraw(fDoc.id))).number, e.number, "ön koşul");
    assert.equal((await ctx.must("F gönder", ctx.api.post(`/api/workspace/invoices/${fDoc.id}/send`, {}))).paperNo, "EL-77");
    const refused3 = await ctx.restore(e.id);
    assert.equal(refused3.status, 409, JSON.stringify(refused3.data));
    assert.equal(refused3.data.code, "invoice-number-taken");
    // Reddedilen geri yükleme veri yazmaz.
    for (const id of [a.id, c.id, c2.id, e.id]) assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE id = ?", id).n, 0);
  });
});
