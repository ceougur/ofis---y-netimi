// 2.5.0 birleşik tur 6 — S94 = A (KULLANICI KARARI 10.11.2026 13:16 UTC, AYNEN: "a"): Kasa açılışından önce tarihli, yedekten / eski sürümden gelen Vergi Ödemesi
// yanlışsa BÖYLE KALIR (S12'ye istisna yok): yol açılış günü / sonrası tarihle yeniden girmek ya da yöneticinin açılışı öne alması; Vergi Ödemesi iletisine (409
// cash-tax-payment, routes/cash.mjs) bu yol eklenir.
// Önceden: ileti yalnız "Silip Vergi Ödemesi'nden doğru tutarla yeniden girin" diyordu — aynı tarihle yeniden giriş S12 ile 409 cash-before-opening (çıkmaz görünümü).
// Veri programın API'sinden: açılış yokken girilen Vergi Ödemesi silinir, açılış girilir, Silinenler'den geri alınır (Z9 yolu — yedekten / eski sürümden gelen satırın
// programdaki karşılığı). Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Ekrandaki karşılığı test/e2e/senaryo-defter-243.mjs "S94" adımı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10";
const EARLY = "2026-03-05";
const LATER = "2026-03-12";
const OLD_TEXT = "Bu hareket bir Vergi Ödemesi; Kasa'dan düzeltilmez. Silip Vergi Ödemesi'nden doğru tutarla yeniden girin.";
const WAY_OUT = (opening = "10.03.2026") => ` Hareket Kasa açılışından (${opening}) önce tarihli: yeniden girerken tarihi Kasa açılış günü ya da sonrası yapın; ödeme gerçekten açılıştan önceyse yönetici Kasa → Açılış Bakiyesi'nin tarihini öne alabilir.`;
const FORCE = { cashForce: true, similarOk: true, force: true, exceedOk: true };

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};

describe("S94 = A — Kasa açılışından önce tarihli Vergi Ödemesi: düzeltme reddinin iletisi çıkış yolunu söyler; iki yol da çalışır", () => {
  let server;
  let api;
  const ids = {};
  const taxRows = () => server.app.store.all("SELECT id, date, amount FROM cash_entries WHERE COALESCE(tax_json, '') <> '' ORDER BY rowid").map(row => ({ ...row }));
  const payTax = (date, amount) => api.post("/api/workspace/tax/payments", { way: "cash", date, taxType: "kdv", amount, description: "KDV", ...FORCE });
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    // Açılış yokken (S12 yok) Vergi Ödemesi; silinir; açılış girilir; Silinenler'den geri alınır → açılıştan önce tarihli Vergi Ödemesi (uyarı).
    await must("Vergi Ödemesi (açılış yokken)", payTax(EARLY, "7"));
    ids.early = taxRows().at(-1).id;
    await must("sil", api.del(`/api/workspace/cash/${ids.early}`));
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    const listed = await must("Silinenler", api.get("/api/admin/trash"));
    const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === ids.early);
    assert.ok(item, "ön koşul: Vergi Ödemesi Silinenler'de");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    await must("Vergi Ödemesi (açılıştan sonra)", payTax(LATER, "9"));
    ids.later = taxRows().at(-1).id;
    const notice = (await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).checks.find(check => check.code === "cash:before-opening");
    assert.deepEqual({ satirlar: taxRows().map(row => [row.date, row.amount]), uyari: notice?.count }, { satirlar: [[EARLY, 7], [LATER, 9]], uyari: 1 }, "ön koşul");
  });
  after(() => server?.close());

  it("açılıştan önce tarihli Vergi Ödemesi Kasa'dan düzeltilmek istenince 409 cash-tax-payment: ileti çıkış yolunu söyler (açılış günü / sonrası ya da açılışı öne almak); satır değişmez", async () => {
    const res = await api.put(`/api/workspace/cash/${ids.early}`, { kind: "out", amount: "8", date: EARLY, description: "x", ...FORCE });
    assert.deepEqual({ status: res.status, code: res.code, error: res.error, openingDate: res.data?.openingDate, date: res.data?.date }, { status: 409, code: "cash-tax-payment", error: `${OLD_TEXT}${WAY_OUT()}`, openingDate: OPEN, date: EARLY });
    assert.deepEqual(taxRows().map(row => [row.date, row.amount]), [[EARLY, 7], [LATER, 9]], "satır değişmedi");
  });

  it("açılıştan SONRA tarihli Vergi Ödemesi: ileti değişmedi (çıkış yolu cümlesi yok)", async () => {
    const res = await api.put(`/api/workspace/cash/${ids.later}`, { kind: "out", amount: "8", date: LATER, description: "x", ...FORCE });
    assert.deepEqual({ status: res.status, code: res.code, error: res.error, openingDate: res.data?.openingDate }, { status: 409, code: "cash-tax-payment", error: OLD_TEXT, openingDate: undefined });
  });

  it("iletideki yol 1: sil + aynı tarihle yeniden giriş 409 cash-before-opening (S12, istisna yok); açılış GÜNÜ tarihiyle 200; uyarı kalkar", async () => {
    await must("sil", api.del(`/api/workspace/cash/${ids.early}`));
    const same = await payTax(EARLY, "8");
    const day = await payTax(OPEN, "8");
    const notice = (await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).checks.find(check => check.code === "cash:before-opening");
    assert.deepEqual({ ayniTarih: [same.status, same.code], acilisGunu: day.status, uyari: notice?.count ?? 0, satirlar: taxRows().map(row => [row.date, row.amount]) }, { ayniTarih: [409, "cash-before-opening"], acilisGunu: 200, uyari: 0, satirlar: [[LATER, 9], [OPEN, 8]] });
  });

  // Birleşik tur 7 İş 5 (dar kontrol DK-B6 DÜŞÜK-2, yaşayan mutant M9 `<` → `<=`): açılış GÜNÜ tarihli Vergi Ödemesi açılıştan önce DEĞİLDİR (açılış günün başı) — ileti
  // çıkış yolu cümlesini taşımaz, yanıtta açılış tarihi yok.
  it("açılış GÜNÜ tarihli Vergi Ödemesi Kasa'dan düzeltilmek istenince: 409 cash-tax-payment, ileti değişmedi (çıkış yolu cümlesi yok — açılış günü 'önce' sayılmaz)", async () => {
    const onDay = taxRows().find(row => row.date === OPEN);
    assert.ok(onDay, "ön koşul: açılış günü tarihli Vergi Ödemesi");
    const res = await api.put(`/api/workspace/cash/${onDay.id}`, { kind: "out", amount: "9", date: OPEN, description: "x", ...FORCE });
    assert.deepEqual({ status: res.status, code: res.code, error: res.error, openingDate: res.data?.openingDate }, { status: 409, code: "cash-tax-payment", error: OLD_TEXT, openingDate: undefined });
  });

  it("iletideki yol 2: yönetici Kasa açılışını öne alır (04.03) → açılıştan önceki güne (05.03) Vergi Ödemesi 200", async () => {
    await must("açılışı öne al", api.post("/api/workspace/cash/opening", { amount: "5.000", date: "2026-03-04" }));
    const res = await payTax(EARLY, "3");
    assert.equal(res.status, 200, `${res.status} ${res.code} ${String(res.error || "").slice(0, 200)}`);
    assert.deepEqual(taxRows().map(row => row.date).sort(), [EARLY, OPEN, LATER]);
  });
});
