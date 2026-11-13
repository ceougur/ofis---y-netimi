// 2.5.0 BİRLEŞİK TUR 8 — İş 7: şüpheli alacak kuralının ret iletisi anlaşılır (S145 = A, S155 = A); KURAL, durum kodu ve kapının öbür iletisi AYNEN.
// KARARLAR (iş listesi D, AYNEN): S145 = A (13.11 03:44) "şüpheliye alma tarihinden ÖNCEKİ tarihe tahsilat REDDEDİLMEYE devam eder; ileti anlaşılır olur". S155 = A (13.11 08:35)
// "Şüpheli Alacak kuralının ölçüsü TOPLAM borçtur: bir kayıt (tahsilat, çek, Alacak Yaz, iade, borç silme, geri yükleme — türü fark etmez) ancak 'kayıttan sonra carinin borcu
// açık şüpheli tutarın altına düşüyorsa' reddedilir; şüpheliye alma günündeki borca ayrıca BAKILMAZ (örnek: borç 1.000 → şüpheli 900 → sonradan yeni borç 500 → şüpheli
// tarihinden önceye tahsilat 300 KABUL, bakiye 1.200; yeni borç yokken aynı tahsilat RET, bakiye 1.000) … anlaşılır ileti bu kurala göre yazılır."
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { IntegrityError } from "../server/lib/integrity.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const RET = /^Bu kayıt carinin borcunu açık şüpheli tutarın altına düşürür \(borç ([\d.,]+ TL), açık şüpheli ([\d.,]+ TL)\); kaydı şüpheliye alma tarihinden sonraya girin ya da önce şüpheli kaydını düzeltin\.$/;
const messageOf = res => String(res.data?.error?.message || res.data?.message || res.data?.error || "");
const codeOf = res => res.data?.code ?? res.data?.error?.code;

describe("Birleşik tur 8 — İş 7: şüpheli kuralının reddi anlaşılır iletiyle (S145 = A, S155 = A); kural aynen", () => {
  let server;
  let api;
  let n = 0;
  let goods;
  before(async () => {
    server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: false }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)), del: async u => unwrap(await client.del(u)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    goods = (await api.post("/api/workspace/stock", { kind: "goods", code: "MAL-B8-SUP", name: "Tur8 Şüpheli Malı", unit: "Adet", openingQty: "1000", salePrice: "100" })).data;
  });
  after(async () => server?.close());
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  // Borç 1.000 (−60) → Şüpheli Alacağa Al 900 (−10).
  const setup = async label => {
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: `Tur8 Şüpheli ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 287 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
    await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "1000", date: day(-60), method: "cash", cashForce: true, similarOk: true }));
    await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "900", date: day(-10), reason: "lawsuit", note: "dava" }));
    return acc;
  };
  const entry = (acc, body) => api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body });
  const balance = async acc => (await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance;
  const rejected = async (acc, res, borc) => {
    assert.deepEqual([res.status, codeOf(res)], [409, "ledger-integrity"], "kural aynı: 409 ledger-integrity");
    const match = RET.exec(messageOf(res));
    assert.ok(match, `anlaşılır ileti: ${messageOf(res)}`);
    assert.deepEqual([match[1], match[2]], [borc, "900,00 TL"], "iletideki tutarlar: kayıttan sonraki borç, açık şüpheli");
    assert.equal(await balance(acc), 1000, "kayıt yazılmadı (bakiye 1.000)");
  };

  it("şüpheli tarihinden ÖNCEYE tahsilat 300 → RET, ileti 'borç 700,00 TL, açık şüpheli 900,00 TL'", async () => {
    const acc = await setup("Önceye Tahsilat");
    await rejected(acc, await entry(acc, { kind: "in", amount: "300", date: day(-11) }), "700,00 TL");
  });
  it("öbür kayıt türleri aynı ileti: önceye Alacak Yaz 300 ve önceye faturasız stok iadesi 300 → RET", async () => {
    const a = await setup("Önceye Alacak");
    await rejected(a, await entry(a, { kind: "credit", amount: "300", date: day(-30) }), "700,00 TL");
    const b = await setup("Önceye İade");
    await rejected(b, await api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "1", unitPrice: "300", pay: "account", accountId: b.id, date: day(-30), reason: "return" }), "700,00 TL");
  });
  it("Silinenler'den geri yükleme (önceye tahsilat 300, şüpheliden önce silinmişti) → RET, aynı ileti", async () => {
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Tur8 Şüpheli Geri Yükleme", type: "customer", registeredOn: day(-400), phone: "0500 287 99 99" }));
    await must("borç", entry(acc, { kind: "debt", amount: "1000", date: day(-60) }));
    const paid = await must("tahsilat", entry(acc, { kind: "in", amount: "300", date: day(-30) }));
    const id = paid.entries.find(row => row.kind === "in").id;
    await must("sil", api.del(`/api/workspace/accounts/${acc.id}/entries/${id}`));
    await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "900", date: day(-10), reason: "lawsuit", note: "dava" }));
    const trash = await must("Silinenler", api.get("/api/admin/trash"));
    const items = (Array.isArray(trash) ? trash : Object.values(trash).flat()).filter(item => item && item.kind === "account-entry" && String(item.title).includes("Geri Yükleme"));
    assert.equal(items.length, 1, "ön koşul: Silinenler'de tek öğe");
    await rejected(acc, await api.post("/api/admin/trash/restore", { id: items[0].id }), "700,00 TL");
  });
  it("KABUL edilenler değişmedi: bugün tarihli 300 (700), şüpheli günü 300 (700), borcun yettiği eski tarih 100 (900), sonradan yeni borç 500 varken önceye 300 (1.200)", async () => {
    for (const [label, run, want] of [
      ["Bugün", acc => entry(acc, { kind: "in", amount: "300", date: day(0) }), 700],
      ["Şüpheli Günü", acc => entry(acc, { kind: "in", amount: "300", date: day(-10) }), 700],
      ["Eski Tarih 100", acc => entry(acc, { kind: "in", amount: "100", date: day(-30) }), 900],
      ["Yeni Borç Sonra", async acc => {
        await must("yeni borç", entry(acc, { kind: "debt", amount: "500", date: day(-2) }));
        return entry(acc, { kind: "in", amount: "300", date: day(-30) });
      }, 1200],
    ]) {
      const acc = await setup(label);
      const res = await run(acc);
      assert.equal(res.status, 200, `${label}: ${res.status} ${messageOf(res)}`);
      assert.equal(await balance(acc), want, label);
    }
  });
  it("kapının GENEL iletisi başka nedenlerde aynen; şüpheli nedeni öbür bir nedenle birlikteyse genel ileti", () => {
    const generic = /^İşlem geri alındı: kayıt defterler arasında sapma oluşturacaktı \(Kasa\)\. Hiçbir değişiklik yazılmadı; yöneticinize bildirin\.$/;
    assert.match(new IntegrityError([{ code: "cash:total", name: "Kasa", ok: false }]).message, generic);
    const figures = [{ party: "x", balanceMinor: 70000, openMinor: 90000 }];
    assert.match(new IntegrityError([{ code: "cash:total", name: "Kasa", ok: false }, { code: "doubtful:balance", name: "Şüpheli", figures }]).message, generic);
    assert.match(new IntegrityError([{ code: "doubtful:balance", name: "Kasa", figures }, { code: "cash:total", name: "Kasa", ok: false }]).message, generic, "şüpheli nedeni İLK sırada olsa da başka neden varsa genel ileti");
    assert.match(new IntegrityError([{ code: "doubtful:balance", name: "Şüpheli", figures }]).message, RET);
    assert.equal(new IntegrityError([{ code: "doubtful:balance", name: "Şüpheli", figures }]).code ?? "ledger-integrity", "ledger-integrity");
  });
});
