// Bağımsız kontrol turu 2 (15.10.2026; 469d547 sonrası değişiklikler). K1 YÜKSEK: "Mevcut borcu taksitlendir" (coversBalance) kartı şüpheli
// kaydından SONRA açılınca taksit tahsilatı 128'den düşmüyordu (kart "yeni satış" sayılıyordu); 120 bitince taksit genel kapı metniyle
// reddediliyordu. Kural: kapsayan kart yeni alacak getirmez (yevmiyede 602 yazılmaz) → taksiti tarih kapısına takılmadan şüpheliden düşer.
// K2: silinen kaydın geri yüklenmesi çakışma yaratınca açık 409 (silmedeki gibi). K3: kayıt tarihinden ÖNCE tarihli (zaten 120'deki)
// tahsilatı "Normal Cari Hesaba İşle" yapmak defteri değiştirmez → 409 yanlış ret olmamalı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { bootBank, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { ACC, collect, customer, debt, listOf, release, take } from "./banka-230-supheli-ortak.mjs";

const PLAN = "/api/workspace/plans";
const remainingOf = async (api, accountId, recordId) => (await listOf(api, accountId)).records.find(row => row.id === recordId).remainingMinor;

describe("kontrol turu 2 — K1 kapsayan kart, K2 geri yükleme çakışması, K3 PUT yanlış ret", () => {
  let ctx;
  let api;
  before(async () => { ctx = await bootBank(); api = ctx.api; });
  after(() => ctx?.server.close());

  it("K1: şüpheli kaydından sonra açılan 'mevcut borcu taksitlendir' kartının taksitleri şüpheliden düşer; ikinci taksit reddedilmez", async () => {
    const acc = await customer(api, "Taksitlendirilen Müşteri");
    await debt(api, acc.id, 1000, "2026-09-10");
    const record = (await must("al 600", take(api, acc.id, { amount: 600, date: "2026-10-01", reason: "lawsuit", note: "Dava" }))).record;
    const plan = await must("kapsayan kart", api.post(PLAN, { accountId: acc.id, name: "Borç Taksit", total: "1000", mode: "auto", count: 4, firstDue: "2026-10-03", registeredOn: "2026-10-02", coversBalance: true }));
    await must("taksit 1", api.post(`${PLAN}/${plan.id}/entries`, { kind: "in", amount: "250", method: "cash", date: "2026-10-03" }));
    assert.equal(await remainingOf(api, acc.id, record.id), 35000, "ilk taksit şüpheliden düştü: 600 − 250 = 350");
    const second = await api.post(`${PLAN}/${plan.id}/entries`, { kind: "in", amount: "250", method: "cash", date: "2026-10-04" });
    assert.equal(second.status, 200, `ikinci taksit: ${second.status} ${JSON.stringify(second.data).slice(0, 300)}`);
    assert.equal(await remainingOf(api, acc.id, record.id), 10000, "ikinci taksit de düştü: 350 − 250 = 100");
    const gl = await trialBalances(api);
    assert.equal(gl["128"], 100, "128 = kalan 100");
    assert.equal(gl["120"], 400, "120 = 1.000 − 600 (şüpheliye) = 400; taksitler 120'ye dokunmadı");
    await integrityOk(api, "kapsayan kart taksitleri");
  });

  it("K2: silinen kaydın geri yüklenmesi başka kaydın çıkarma başlığını bozacaksa açık 409 doubtful-delete-conflict", async () => {
    const acc = await customer(api, "Geri Yükleme Çakışması");
    await debt(api, acc.id, 1500, "2026-09-10");
    const a = (await must("al A", take(api, acc.id, { amount: 1000, date: "2026-10-01", reason: "lawsuit", note: "A" }))).record;
    const b = (await must("al B", take(api, acc.id, { amount: 500, date: "2026-10-02", reason: "enforcement", note: "B" }))).record;
    await collect(api, acc.id, 300, "2026-10-03"); // A'dan düşer
    await must("sil A", api.del(`${ACC}/${acc.id}/doubtful/${a.id}`)); // tahsilat B'ye kayar: B kalan 200
    await must("çıkar B", release(api, acc.id, b.id, { date: "2026-10-05", note: "Çıkar" })); // başlık 200
    const trash = (await must("Silinenler", api.get("/api/admin/trash"))).find(row => row.kind === "doubtful" && row.ref === a.id);
    assert.ok(trash, "A Silinenler'de");
    const res = await api.post("/api/admin/trash/restore", { id: trash.id });
    assert.equal(res.status, 409, JSON.stringify(res.data).slice(0, 300));
    assert.equal(res.data.code, "doubtful-delete-conflict", JSON.stringify(res.data).slice(0, 300));
    assert.doesNotMatch(res.data.error, /yöneticinize bildirin/, "genel kapı metni değil");
    assert.match(res.data.error, /geri yüklenemez/);
    await integrityOk(api, "reddedilen geri yükleme sonrası");
  });

  it("K3: kayıt tarihinden önce tarihli tahsilat (zaten 120'de) 'Normal Cari Hesaba İşle' yapılınca 409 olmaz; defter değişmez", async () => {
    const acc = await customer(api, "Önce Tahsilat Müşterisi");
    await debt(api, acc.id, 1000, "2026-09-10");
    const paid = await collect(api, acc.id, 150, "2026-09-20");
    const record = (await must("al 800", take(api, acc.id, { amount: 800, date: "2026-10-01", reason: "lawsuit", note: "Dava" }))).record;
    const before = await trialBalances(api);
    const res = await api.put(`${ACC}/${acc.id}/entries/${paid.entryId}`, { kind: "in", amount: "150", method: "cash", date: "2026-09-20", note: "Tahsilat", doubtfulSkip: true });
    assert.equal(res.status, 200, `PUT doubtfulSkip: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const after_ = await trialBalances(api);
    assert.equal(after_["120"], before["120"], "120 değişmedi");
    assert.equal(after_["128"], before["128"], "128 değişmedi");
    assert.equal(await remainingOf(api, acc.id, record.id), 80000, "kayıt kalanı 800");
    await integrityOk(api, "işaret sonrası");
  });
});
