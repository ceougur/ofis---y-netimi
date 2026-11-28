// 2.5.1 M2 tur 5 — Değersiz Alacak sınırı (para çekirdeği; 2.5.1'in SON Değersiz turu): SK-64 = A + dar kontrol DK-M2T4'ün iki ORTA'sı (ORTA-A Otomatik Dağıt, ORTA-B Silinenler hızı).
// KARARLAR (AYNEN; iş listesi C / D, görev metni docs/devir/2.5.1-DEVAM/m2t5-istem.txt):
//   SK-64 = A (28.11 06:13 UTC — KULLANICI KARARIYLA ÖNERİ UYGULANDI, 20:26 yetkisi): "Değersiz Alacak satırı olan caride Ödeme satırının silinmesi ya da Alacak Yaz tutarının artırılması cariyi
//     eksiye götürüyorsa — örnek: bakiye −76,45 iken Ödeme silinince −576,45. A (ÖNERİ; uygulanacak): reddedilsin (S-M2T2-1 / S-DKM2T3-1 ile aynı kural), bakiye −76,45 kalır. … Öneri A:
//     Değersiz'li caride eksiye götüren her kayıt değişikliği tek kural."
//   BAŞ MİMAR KARARI 28.11 07:14 (4) BM-M2T4-3: "tahsilat artışı ve YENİ Alacak Yaz avans — KABUL; ama SK-64 = A 'Alacak Yaz tutarının ARTIRILMASI' diyor → tur 5'te."
//   BAŞ MİMAR KARARI 28.11 08:22: ORTA-A — "taksit kartının Otomatik Dağıt yolu kart toplamını düşürürken Değersiz bakiye denetiminden geçmiyor … Kararın metni kart toplamını düşüren her yolu
//     kapsıyor"; ORTA-B — "daraltma yalnız en eski Değersiz satırından ÖNCE silinen faturaları dışarıda bırakıyor; Değersiz'den SONRA silinen her fatura (başka carilerinki dahil) yine tek tek
//     taranıyor".
// ELLE BEKLENEN SAYILAR (kurallardan; ders 5):
//   Taban T = Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 · Değersiz 3.000 @17.09 → bakiye 423,55.
//   SK-64 örneği: T + Ödeme 500 (01.10) → 923,55; + bağsız Tahsilat 1.000 (05.10; avans — kabul) → −76,45. Ödeme silinirse −76,45 − 500 = −576,45 → RET, −76,45 kalır. İleti 'Ödeme hareketi
//   silinemez' (Borç hareketi DEĞİL). Değersiz satırı silinince bakiye −76,45 + 3.000 = 2.923,55; şüpheli kaydın kalanı 3.000 − 2.876,45 (aynı gün, kayıttan önce bağlı — S-M2-1 = B) − 1.000
//   (bağsız; kalan 123,55'e kadar) = 0 → S155 engel değil → Ödeme silinir → 2.423,55.
//   Ödeme 500 → 100: −76,45 − 400 = −476,45 → RET; 500 → 600: +100 → 23,55 kabul; tarih 01.10 → 03.10: bakiye aynı, kabul.
//   Alacak Yaz: T + Alacak 400 (avans — yeni Alacak Yaz KABUL) → 23,55; 400 → 500: −76,45 → RET (23,55 kalır); 400 → 423,55: TAM 0 → kabul; 423,55 → 423,56: −0,01 → RET.
//   Otomatik Dağıt (dar kontrolün vakası AYNEN): T'de Borç Yaz yerine 3.400'lük kart → bakiye 423,55; Otomatik Dağıt 100 → 100 − 3.400 = −2.876,45 → RET; kart 3.400, taksitleri, bakiye 423,55
//   değişmez. 3.500 → 523,55 kabul; aynı toplam (3.400) 3 taksit → kabul.
// Sahte saat 15.10.2026 (ders 13), akan saat; iki saat diliminde koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";
import { openAcceptanceAccounts, openPos, salesOf, ziraatPos } from "./banka-220-pos-ortak.mjs";
import * as D from "../server/lib/bank/doubtful.mjs";

const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const PLANS = "/api/workspace/plans";
const WHERE = "cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi";

async function boot() {
  const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const api = apiOf(await loginAdmin(server));
  await api.post("/api/workspace/bank/setup/dismiss", {});
  return { server, api, store: server.app.store };
}
let phone = 0;
const nextPhone = prefix => `0500 ${prefix} ${String((phone += 1) % 100).padStart(2, "0")} ${String(Math.floor(phone / 100)).padStart(2, "0")}`;
const saleBody = (accountId, price, { date = "2026-09-10", payment = { rest: "open" }, status } = {}) => ({ scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(price), vatRate: 0 }], payment, ...(status ? { status } : {}) });
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const outBody = (amount, date) => ({ kind: "out", amount, date, method: "cash", cashForce: true, similarOk: true, note: "Ödeme" });
const balanceOf = async (api, party) => (await must("kart", api.get(`${ACC}/${party}`))).totals.balance;
const tlText = minor => (minor / 100).toFixed(2).replace(".", ",");
const writeOffsOf = async (api, party, did) => (await must("liste", api.get(`${ACC}/${party}/doubtful`))).records.find(item => item.id === did)?.writeOffs || [];
const lastEntry = (store, party, kind) => store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = ? AND source = '' ORDER BY created_at DESC, rowid DESC LIMIT 1", party, kind).id;
const rowsOf = (store, party) => JSON.stringify(store.all("SELECT id, kind, amount, date, account_id FROM account_entries WHERE account_id = ? ORDER BY id", party));

async function base(api, name, { debtCard = false, writeOff = true } = {}) {
  const a = await must("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("471") }));
  const inv = await must("fatura", api.post(INV, saleBody(a.id, 2900)));
  let debt = null;
  if (debtCard) debt = (await must("kart", api.post(PLANS, { accountId: a.id, name: "Kart", total: 3400, registeredOn: "2026-09-12", installments: { count: 2, firstDue: "2026-11-01", everyMonths: 1 } }))).id;
  else await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  await must("bağlı", api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id)));
  const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  if (writeOff) await must("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  return { a, inv, s, debt };
}
async function deleteWriteOffs(api, party, did) {
  for (const line of await writeOffsOf(api, party, did)) await must("Değersiz satırını sil", api.del(`${ACC}/${party}/doubtful/${did}/write-offs/${line.entryId}`));
}
// Ret iletisinin dört alanı: ne oldu (tarih + tutar + sonuç bakiye), neden, ne yapmalı, güvence. Sözcük işlemin kendi adıyla — 'Borç hareketi' geçmez (SK-64; görev metni).
function assertRefusal(r, { what, act, after, then }) {
  assert.equal(r.status, 409, `${r.status} ${r.error}`);
  assert.equal(r.code, "doubtful-writeoff-balance", r.error);
  assert.ok(r.error.startsWith(`${what}: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı var; ${act} sonra cari ${after} TL alacaklı (eksi bakiye) olurdu. `), r.error);
  assert.ok(!r.error.includes("Borç hareketi"), `ileti 'Borç hareketi' diyor: ${r.error}`);
  assert.ok(r.error.includes(`Önce Değersiz Alacak satırını silin (${WHERE})`.replace("Önce", r.data.recordFirst ? "Önce" : "önce")), r.error);
  assert.ok(r.error.includes(`sonra ${then}`), r.error);
  assert.ok(r.error.endsWith("Hiçbir şey kaydedilmedi."), r.error);
}
// İletinin 'ne yapmalı' yolunu izler (recordFirst: şüpheli kaydı da silinir) ve işlemi yineler → 200 beklenir.
async function followFix(api, r, b, retry) {
  await deleteWriteOffs(api, b.a.id, b.s);
  if (r.data.recordFirst) await must("şüpheli kaydı sil", api.del(`${ACC}/${b.a.id}/doubtful/${b.s}`));
  const again = await retry();
  assert.equal(again.status, 200, `ileti yolu işlemi kabul ettirmedi: ${again.status} ${again.error}`);
}

describe("2.5.1 M2 tur 5 — SK-64 = A: Değersiz'li caride Ödeme silme / Alacak Yaz artırma cariyi eksiye götürüyorsa ret (S-M2T2-1 / S-DKM2T3-1 ile aynı kural)", () => {
  async function example(api, name) {
    const b = await base(api, name);
    await must("Ödeme 500", api.post(`${ACC}/${b.a.id}/entries`, outBody("500", "2026-10-01")));
    await must("Tahsilat 1.000 (avans)", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
    return b;
  }
  it("kararın örneği AYNEN: bakiye −76,45 iken Ödeme 500 silinir → 409 'Ödeme hareketi silinemez', bakiye −76,45 kalır (kabul olsaydı −576,45); ileti yolu silmeyi kabul ettirir (2.423,55)", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await example(api, "M2T5 SK64 Örnek");
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      const out = lastEntry(store, b.a.id, "out");
      const before = rowsOf(store, b.a.id);
      const r = await api.del(`${ACC}/${b.a.id}/entries/${out}`);
      assertRefusal(r, { what: "Ödeme hareketi silinemez", act: "silmeden", after: "576,45", then: "ödeme hareketini silin" });
      assert.equal(r.data.balanceMinor, -57645);
      assert.equal(r.data.recordFirst, undefined, "Değersiz satırı silinince S155 engel değil (elle: kalan 0)");
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      assert.equal(rowsOf(store, b.a.id), before, "hiçbir cari satırı değişmedi");
      assert.equal(Number(store.get("SELECT COUNT(*) AS n FROM trash WHERE kind = 'account-entry' AND ref = ?", out).n), 0, "Silinenler'e gitmedi");
      await followFix(api, r, b, () => api.del(`${ACC}/${b.a.id}/entries/${out}`));
      assert.equal(await balanceOf(api, b.a.id), 2423.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("Ödeme tutarını düşürme (500 → 100: −476,45) ve başka cariye taşıma (eski cari −576,45) → 409 'Ödeme hareketi düzeltilemez'; tutar artırma (600: 23,55) ve tarih değişikliği kabul", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await example(api, "M2T5 SK64 Düzelt");
      const out = lastEntry(store, b.a.id, "out");
      const cut = await api.put(`${ACC}/${b.a.id}/entries/${out}`, { ...outBody("100", "2026-10-01") });
      assertRefusal(cut, { what: "Ödeme hareketi düzeltilemez", act: "düzeltmeden", after: "476,45", then: "ödeme hareketini düzeltin" });
      const other = await must("öbür cari", api.post(ACC, { name: "M2T5 Öbür", type: "customer", registeredOn: "2026-09-01", phone: nextPhone("472") }));
      const move = await api.put(`${ACC}/${b.a.id}/entries/${out}`, { ...outBody("500", "2026-10-01"), accountId: other.id });
      assertRefusal(move, { what: "Ödeme hareketi düzeltilemez", act: "düzeltmeden", after: "576,45", then: "ödeme hareketini düzeltin" });
      const row = store.get("SELECT account_id AS party, amount FROM account_entries WHERE id = ?", out);
      assert.deepEqual([row.party, Number(row.amount)], [b.a.id, 500]);
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      assert.equal(await balanceOf(api, other.id), 0);
      await must("tarih 03.10", api.put(`${ACC}/${b.a.id}/entries/${out}`, outBody("500", "2026-10-03")));
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      await must("600", api.put(`${ACC}/${b.a.id}/entries/${out}`, outBody("600", "2026-10-03")));
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      assert.equal((await integrityOf(api)).ok, true);
      // Tutar düşürmenin ileti yolu: Değersiz satırını sil → 100 → kabul.
      const again = await api.put(`${ACC}/${b.a.id}/entries/${out}`, outBody("100", "2026-10-03"));
      assertRefusal(again, { what: "Ödeme hareketi düzeltilemez", act: "düzeltmeden", after: "476,45", then: "ödeme hareketini düzeltin" });
      await followFix(api, again, b, () => api.put(`${ACC}/${b.a.id}/entries/${out}`, outBody("100", "2026-10-03")));
      assert.equal(await balanceOf(api, b.a.id), 2523.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("Alacak Yaz: yeni 400 kabul (avans; BM-M2T4-3) → 23,55; 500'e artırma → 409 'Alacak hareketi düzeltilemez' (23,55 kalır); 423,55 (tam 0) kabul; 423,56 (−0,01) ret; Borç'a çevirme kabul", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T5 Alacak");
      await must("Alacak Yaz 400 (yeni — kabul)", api.post(`${ACC}/${b.a.id}/entries`, { kind: "credit", amount: "400", date: "2026-10-01", note: "Alacak" }));
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      const credit = lastEntry(store, b.a.id, "credit");
      const up = await api.put(`${ACC}/${b.a.id}/entries/${credit}`, { kind: "credit", amount: "500", date: "2026-10-01", note: "Alacak" });
      assertRefusal(up, { what: "Alacak hareketi düzeltilemez", act: "düzeltmeden", after: "76,45", then: "alacak hareketini düzeltin" });
      assert.equal(Number(store.get("SELECT amount FROM account_entries WHERE id = ?", credit).amount), 400);
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      await must("tam 0", api.put(`${ACC}/${b.a.id}/entries/${credit}`, { kind: "credit", amount: "423,55", date: "2026-10-01", note: "Alacak" }));
      assert.equal(await balanceOf(api, b.a.id), 0);
      const cent = await api.put(`${ACC}/${b.a.id}/entries/${credit}`, { kind: "credit", amount: "423,56", date: "2026-10-01", note: "Alacak" });
      assertRefusal(cent, { what: "Alacak hareketi düzeltilemez", act: "düzeltmeden", after: "0,01", then: "alacak hareketini düzeltin" });
      await must("Borç'a çevir", api.put(`${ACC}/${b.a.id}/entries/${credit}`, { kind: "debt", amount: "423,55", date: "2026-10-01", note: "Alacak" }));
      assert.equal(await balanceOf(api, b.a.id), 847.1);
      // Yeni Alacak Yaz (eksiye götürse de) ve tahsilat artışı avanstır — kabul (BM-M2T4-3).
      await must("yeni Alacak Yaz 1.000", api.post(`${ACC}/${b.a.id}/entries`, { kind: "credit", amount: "1000", date: "2026-10-02", note: "Alacak" }));
      assert.equal(await balanceOf(api, b.a.id), -152.9);
      await must("tahsilat 100", api.post(`${ACC}/${b.a.id}/entries`, pay("100", "2026-10-03")));
      const inId = lastEntry(store, b.a.id, "in");
      await must("tahsilat 100 → 400 (avans)", api.put(`${ACC}/${b.a.id}/entries/${inId}`, pay("400", "2026-10-03")));
      assert.equal(await balanceOf(api, b.a.id), -552.9);
      assert.equal((await integrityOf(api)).ok, true);
      // Alacak artırmanın ileti yolu: Değersiz satırını sil → artır → kabul.
      const credit2 = lastEntry(store, b.a.id, "credit");
      const up2 = await api.put(`${ACC}/${b.a.id}/entries/${credit2}`, { kind: "credit", amount: "1100", date: "2026-10-02", note: "Alacak" });
      assertRefusal(up2, { what: "Alacak hareketi düzeltilemez", act: "düzeltmeden", after: "652,90", then: "alacak hareketini düzeltin" });
      await followFix(api, up2, b, () => api.put(`${ACC}/${b.a.id}/entries/${credit2}`, { kind: "credit", amount: "1100", date: "2026-10-02", note: "Alacak" }));
      assert.equal(await balanceOf(api, b.a.id), 2347.1);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  // Ayna yol (alacak yönlü belge): Alış Faturası 100 (01.10; Değersiz'li cariden alış — yeni alacak, kabul) → 323,55; Düzenle 100 → 1.000 → −576,45 → RET (323,55 kalır); 100 → 423,55 (tam 0) kabul.
  it("Alış Faturası Düzenle'si tutarı artırıp eksiye götürüyorsa → 409 'Alış faturası düzenlenemez'; tam 0'a götüren artış kabul; ileti yolu işe yarar", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T5 Alış");
      const body = price => ({ scenario: "expense_purchase", accountId: b.a.id, number: "ALS-1", issueDate: "2026-10-01", lines: [{ name: "Gider", qty: 1, unitPrice: String(price), vatRate: 0, expense: "rent" }], payment: { rest: "open" } });
      const p = await must("alış 100", api.post(INV, body(100)));
      assert.equal(await balanceOf(api, b.a.id), 323.55);
      const r = await api.post(`${INV}/${p.id}/edit`, body(1000));
      assertRefusal(r, { what: "Alış faturası düzenlenemez", act: "düzenlemeden", after: "576,45", then: "faturayı düzenleyin" });
      assert.equal(Number(store.get("SELECT payable_total AS p FROM invoices WHERE id = ?", p.id).p), 100);
      assert.equal(await balanceOf(api, b.a.id), 323.55);
      await must("tam 0", api.post(`${INV}/${p.id}/edit`, body("423,55")));
      assert.equal(await balanceOf(api, b.a.id), 0);
      assert.equal((await integrityOf(api)).ok, true);
      const again = await api.post(`${INV}/${p.id}/edit`, body(1000));
      assertRefusal(again, { what: "Alış faturası düzenlenemez", act: "düzenlemeden", after: "576,45", then: "faturayı düzenleyin" });
      await followFix(api, again, b, () => api.post(`${INV}/${p.id}/edit`, body(1000)));
      assert.equal(await balanceOf(api, b.a.id), 2423.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("POS İadesi silme → 409 'POS İadesi silinemez' (−76,45 kalır); ileti yolu silmeyi kabul ettirir", async () => {
    const { server, api, store } = await boot();
    try {
      const acc = await openAcceptanceAccounts(api);
      await openPos(api, ziraatPos(acc.ziraat.id));
      const b = await base(api, "M2T5 POS");
      await must("POS tahsilatı 1.000 (avans)", api.post(`${ACC}/${b.a.id}/entries`, { kind: "in", method: "card", amount: "1000", date: "2026-10-05", similarOk: true }));
      const sale = (await salesOf(api, "?kind=sale")).find(item => item.party?.id === b.a.id) || (await salesOf(api, "?kind=sale"))[0];
      await must("POS İadesi 500", api.post(`${ACC}/${b.a.id}/entries`, { kind: "out", method: "card", posRefund: true, amount: "500", date: "2026-10-06", posRefundOf: sale.id, similarOk: true }));
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      const refund = lastEntry(store, b.a.id, "out");
      const r = await api.del(`${ACC}/${b.a.id}/entries/${refund}?cashForce=1`);
      assertRefusal(r, { what: "POS İadesi silinemez", act: "silmeden", after: "576,45", then: "POS İadesini silin" });
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      assert.equal(Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE id = ?", refund).n), 1);
      await followFix(api, r, b, () => api.del(`${ACC}/${b.a.id}/entries/${refund}?cashForce=1`));
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("taksit kartının ödeme / iade hareketi: silme ve tutar düşürme → 409; kart ve bakiye değişmez", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T5 Kart Hareketi", { debtCard: true });
      await must("kart tahsilatı 1.000", api.post(`${PLANS}/${b.debt}/entries`, { kind: "in", amount: "1000", date: "2026-10-05", method: "cash", cashForce: true }));
      await must("kart iadesi 500", api.post(`${PLANS}/${b.debt}/entries`, { kind: "out", amount: "500", date: "2026-10-06", method: "cash", cashForce: true }));
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      const outId = store.get("SELECT id FROM plan_entries WHERE plan_id = ? AND kind = 'out'", b.debt).id;
      const del = await api.del(`${PLANS}/${b.debt}/entries/${outId}?cashForce=1`);
      assertRefusal(del, { what: "Taksit kartının ödeme / iade hareketi silinemez", act: "silmeden", after: "576,45", then: "taksit kartının ödeme / iade hareketini silin" });
      const cut = await api.put(`${PLANS}/${b.debt}/entries/${outId}`, { amount: "100", date: "2026-10-06", method: "cash", cashForce: true });
      assertRefusal(cut, { what: "Taksit kartının ödeme / iade hareketi düzeltilemez", act: "düzeltmeden", after: "476,45", then: "taksit kartının ödeme / iade hareketini düzeltin" });
      assert.equal(Number(store.get("SELECT amount FROM plan_entries WHERE id = ?", outId).amount), 500);
      assert.equal(await balanceOf(api, b.a.id), -76.45);
      await followFix(api, del, b, () => api.del(`${PLANS}/${b.debt}/entries/${outId}?cashForce=1`));
      assert.equal(await balanceOf(api, b.a.id), 2423.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("ETKİLENMEZ: Değersiz'siz caride ve Değersiz satırı silinmiş caride Ödeme silme eksiye götürse de kabul (yeni denetim çalışmaz)", async () => {
    const { server, api, store } = await boot();
    try {
      for (const [name, writeOff, clear] of [["M2T5 Değersizsiz", false, false], ["M2T5 Değersiz Silindi", true, true]]) {
        const b = await base(api, name, { writeOff });
        if (clear) await deleteWriteOffs(api, b.a.id, b.s);
        await must("şüpheli kaydı sil", api.del(`${ACC}/${b.a.id}/doubtful/${b.s}`));
        const start = await balanceOf(api, b.a.id);
        await must("Ödeme 500", api.post(`${ACC}/${b.a.id}/entries`, outBody("500", "2026-10-01")));
        await must("Tahsilat (avans)", api.post(`${ACC}/${b.a.id}/entries`, pay(String(start + 500 + 76.45).replace(".", ","), "2026-10-05")));
        assert.equal(await balanceOf(api, b.a.id), -76.45, name);
        await must(`${name}: Ödeme sil`, api.del(`${ACC}/${b.a.id}/entries/${lastEntry(store, b.a.id, "out")}`));
        assert.equal(await balanceOf(api, b.a.id), -576.45, name);
      }
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 5 — ORTA-A: Otomatik Dağıt kartın toplamını düşürüp Değersiz'li cariyi eksiye götürüyorsa kart düzenlemesiyle aynı ret (atomik)", () => {
  it("dar kontrolün vakası AYNEN: taban T kart 3.400 → Otomatik Dağıt 100 → 409; kart toplamı 3.400, taksitler, cari satırları ve bakiye 423,55 değişmez", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T5 Dağıt", { debtCard: true });
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      const snap = () => JSON.stringify({
        plan: store.get("SELECT total, updated_at FROM plans WHERE id = ?", b.debt),
        items: store.all("SELECT id, due_date, amount FROM plan_items WHERE plan_id = ? ORDER BY seq", b.debt),
        audit: store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'plan.distributed' AND entity_id = ?", b.debt).n,
        lines: rowsOf(store, b.a.id),
      });
      const before = snap();
      for (const count of [1, 2, 12]) {
        const r = await api.post(`${PLANS}/${b.debt}/distribute`, { total: "100", count, firstDue: "2026-11-01", everyMonths: 1 });
        assert.equal(r.status, 409, `${count} taksit: ${r.status} ${r.error}`);
        assert.equal(r.code, "doubtful-writeoff-balance", r.error);
        assert.ok(r.error.startsWith("Otomatik Dağıt kaydedilemez: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı var; dağıtımdan sonra cari 2.876,45 TL alacaklı (eksi bakiye) olurdu. "), r.error);
        assert.ok(r.error.includes("sonra Otomatik Dağıt'ı yeniden yapın"), r.error);
        assert.equal(snap(), before, `${count} taksit: veri tabanı değişti`);
      }
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      await must("aynı toplam, 3 taksit", api.post(`${PLANS}/${b.debt}/distribute`, { total: "3400", count: 3, firstDue: "2026-11-01", everyMonths: 1 }));
      assert.equal(store.all("SELECT id FROM plan_items WHERE plan_id = ?", b.debt).length, 3);
      await must("toplam 3.500", api.post(`${PLANS}/${b.debt}/distribute`, { total: "3500", count: 2, firstDue: "2026-11-01", everyMonths: 1 }));
      assert.equal(await balanceOf(api, b.a.id), 523.55);
      await must("toplam 3.000 (23,55 — eksi değil)", api.post(`${PLANS}/${b.debt}/distribute`, { total: "3000", count: 2, firstDue: "2026-11-01", everyMonths: 1 }));
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      assert.equal((await integrityOf(api)).ok, true);
      // İleti yolu: Değersiz satırını sil (gerekirse şüpheli kaydı) → Otomatik Dağıt 100 → kabul.
      const r = await api.post(`${PLANS}/${b.debt}/distribute`, { total: "100", count: 1, firstDue: "2026-11-01" });
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      await followFix(api, r, b, () => api.post(`${PLANS}/${b.debt}/distribute`, { total: "100", count: 1, firstDue: "2026-11-01" }));
      assert.equal(Number(store.get("SELECT total FROM plans WHERE id = ?", b.debt).total), 100);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("dönem kilidi Kayıt Tarihi'ni kapsıyorsa kilit iletisi Değersiz iletisinden ÖNCE gelir", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T5 Dağıt Kilit", { debtCard: true });
      await must("kilit 30.09", api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
      const r = await api.post(`${PLANS}/${b.debt}/distribute`, { total: "100", count: 1, firstDue: "2026-11-01" });
      assert.equal(r.status, 409, r.error);
      assert.notEqual(r.code, "doubtful-writeoff-balance", r.error);
      assert.match(r.error, /Kayıt Tarihi/, r.error);
    } finally {
      server.close();
    }
  });
});

// ORTA-B: değişmez (i)'nin Silinenler taraması. Ölçü süre değil iş sayısı (ders 47; dişli): Silinenler sorgusu sayısı ve okunan fatura gövdesi sayısı. Silinenler'e değişmezi koşan sunucunun
// yazım yolu dışında 200 fatura (başka cariler; Değersiz'den SONRA silinmiş gibi) eklenir.
function trashSpy(store) {
  const seen = [];
  const undo = [];
  for (const method of ["get", "all"]) {
    const original = store[method];
    store[method] = (sql, ...args) => {
      const result = original.call(store, sql, ...args);
      if (/\bFROM trash\b/.test(String(sql)) && /payload_json/.test(String(sql))) seen.push({ sql: String(sql), rows: Array.isArray(result) ? result.length : result ? 1 : 0 });
      return result;
    };
    undo.push(() => { store[method] = original; });
  }
  return { seen, restore: () => undo.forEach(fn => fn()) };
}
function fillTrash(server, n, at) {
  const insert = server.app.db.prepare("INSERT INTO trash (id, kind, ref, payload_json, deleted_at) VALUES (?, 'invoice', ?, ?, ?)");
  for (let i = 0; i < n; i += 1) insert.run(`trash-m2t5-${at}-${i}`, `invoice-m2t5-${i}`, JSON.stringify({ invoice: { account_id: `account-baska-${i}` }, pad: "x".repeat(500) }), at);
}
describe("2.5.1 M2 tur 5 — ORTA-B: Silinenler taraması Silinenler'deki fatura sayısıyla ve Değersiz satırlı cari sayısıyla çoğalmaz; sonuç tam taramayla BİREBİR", () => {
  it("10 Değersiz satırlı cari, Değersiz'den SONRA silinmiş 200 başka cari faturası: taramanın sonucunu okuyabilecek satır yoksa Silinenler gövdesi HİÇ okunmaz; sonuç tam taramayla aynı", async () => {
    const { server, api, store } = await boot();
    try {
      for (let c = 0; c < 10; c += 1) await base(api, `M2T5 Hız ${c}`);
      fillTrash(server, 200, "2026-11-01T10:00:00.000Z");
      const spy = trashSpy(store);
      let fast;
      try {
        fast = JSON.stringify(D.writeOffInvariantProblems(store));
      } finally {
        spy.restore();
      }
      assert.deepEqual(spy.seen.map(item => item.sql.slice(0, 60)), [], "Silinenler fatura gövdesi okundu");
      D.WRITE_OFF_TEST.fullTrash = true;
      try {
        assert.equal(fast, JSON.stringify(D.writeOffInvariantProblems(store)));
      } finally {
        D.WRITE_OFF_TEST.fullTrash = false;
      }
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  // Elle: Fatura 2.900 + Borç 6.400 = 9.300; 17.09 bağlı 2.876,45 → 6.423,55; Şüpheliye Al 3.000; AYNI GÜN, Değersiz'den ÖNCE bağsız tahsilat 50 (17.09) → 6.373,55; Değersiz 1.000 @17.09
  // → 5.373,55. Bağsız 50 W'nin gününde, W'den önce yazılmış → taramanın sonucu W'yi etkileyebilir (S-DKM2-2 sınıfı) → tarama GEREKİR. Değersiz'den sonra 4 carinin faturası silinir.
  it("4 carinin taraması gerekiyor (aynı gün, Değersiz'den önce bağsız tahsilat + faturası Değersiz'den sonra silinmiş): Mutabakat'ta TEK Silinenler sorgusu; sonuç tam taramayla aynı", async () => {
    const { server, api, store } = await boot();
    try {
      const parties = [];
      for (let c = 0; c < 4; c += 1) {
        const a = await must("cari", api.post(ACC, { name: `M2T5 Tarama ${c}`, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("473") }));
        const inv = await must("fatura", api.post(INV, saleBody(a.id, 2900)));
        const other = await must("öbür fatura", api.post(INV, saleBody(a.id, 700)));
        await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "6400", date: "2026-09-12", note: "Borç" }));
        await must("bağlı", api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id)));
        const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
        await must("bağsız 50 (aynı gün, Değersiz'den önce)", api.post(`${ACC}/${a.id}/entries`, pay("50", "2026-09-17")));
        await must("Değersiz 1.000", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "1000", date: "2026-09-17" }));
        if (c % 2) await must("öbür faturayı sil", api.del(`${INV}/${other.id}`));
        parties.push(a.id);
      }
      fillTrash(server, 200, "2026-11-01T10:00:00.000Z");
      const spy = trashSpy(store);
      let fast;
      try {
        fast = JSON.stringify(D.writeOffInvariantProblems(store));
      } finally {
        spy.restore();
      }
      assert.equal(spy.seen.length, 1, `Silinenler sorgusu sayısı ${spy.seen.length} (cari başına ayrı tarama — tur 4 hâli)`);
      D.WRITE_OFF_TEST.fullTrash = true;
      try {
        assert.equal(fast, JSON.stringify(D.writeOffInvariantProblems(store)));
        for (const party of parties) assert.equal(JSON.stringify(D.writeOffInvariantProblems(store, { parties: [party] })), JSON.stringify((() => {
          D.WRITE_OFF_TEST.fullTrash = false;
          try {
            return D.writeOffInvariantProblems(store, { parties: [party] });
          } finally {
            D.WRITE_OFF_TEST.fullTrash = true;
          }
        })()));
      } finally {
        D.WRITE_OFF_TEST.fullTrash = false;
      }
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
});

// Rastgele (dar kontrolün d-rastgele düzeni; düzeltme ajanından bağımsız üretilmiş vakalar ana oturumda): her adımdan sonra değişmez (i)'nin sayımı tam Silinenler taramasıyla
// (WRITE_OFF_TEST.fullTrash) BİREBİR; denetimli bir işlem (Ödeme sil / düşür, Alacak artır, Borç sil / düşür, kart Otomatik Dağıt) KABUL edildiyse Değersiz'li cari eksiye düşmedi; Mutabakat
// sonunda tamam. Silinenler'de başka carilerin faturaları (Değersiz'den önce ve SONRA silinmiş), taslak silme, Silinenler'den geri yükleme, aynı gün Değersiz'den önce bağsız tahsilat.
// M2T5_TOHUM / M2T5_CARI / M2T5_ADIM ile çoğaltılır (kanıt koşusu 40 tohum).
const SEEDS = (process.env.M2T5_TOHUM || "5,17,29").split(",").map(Number);
const CARI = Number(process.env.M2T5_CARI || 4);
const STEPS = Number(process.env.M2T5_ADIM || 18);
const mulberry = seed => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const CDAYS = ["2026-09-13", "2026-09-14", "2026-09-17", "2026-09-19", "2026-09-22", "2026-09-25", "2026-10-01", "2026-10-03", "2026-10-08", "2026-10-12", TODAY];
// Üçüncü öğe: yeni yolun Silinenler sorgusu sayısı (0: tarama gereksiz bulundu; ≥ 1: tarama yapıldı — eşdeğerliğin asıl sınandığı adımlar).
const compareTrash = store => {
  const run = full => {
    D.WRITE_OFF_TEST.fullTrash = full;
    D.WRITE_OFF_TEST.count = full ? null : { quotes: 0, trials: 0, trash: 0 };
    try {
      return [JSON.stringify(D.writeOffInvariantProblems(store)), D.WRITE_OFF_TEST.count?.trash || 0];
    } finally {
      D.WRITE_OFF_TEST.fullTrash = false;
      D.WRITE_OFF_TEST.count = null;
    }
  };
  const [fast, scans] = run(false);
  return [fast, run(true)[0], scans];
};
describe("2.5.1 M2 tur 5 — rastgele: Silinenler taraması eşdeğer, denetimli işlem Değersiz'li cariyi eksiye götürmez", () => {
  for (const seed of SEEDS) {
    it(`tohum ${seed} (${CARI} cari × ${STEPS} adım)`, async () => {
      const { server, api, store } = await boot();
      const rand = mulberry(seed * 7919 + 11);
      const pick = list => list[Math.floor(rand() * list.length)];
      const stats = { steps: 0, compared: 0, scanned: 0, guarded: 0, refused: 0, accepted: 0, invDeleted: 0, otherDeleted: 0, restored: 0, writes: 0 };
      const failures = [];
      try {
        // Başka cari (Değersiz'siz): faturaları Silinenler'e gider.
        const stranger = await must("başka cari", api.post(ACC, { name: `M2T5 Başka ${seed}`, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("474") }));
        const strangerInvs = [];
        for (let i = 0; i < 4; i += 1) strangerInvs.push((await must("başka fatura", api.post(INV, saleBody(stranger.id, 500, { date: "2026-09-14" })))).id);
        await must("başkanın 1. faturasını sil (Değersiz'den ÖNCE)", api.del(`${INV}/${strangerInvs.shift()}`));
        const accs = [];
        for (let c = 0; c < CARI; c += 1) {
          const a = await must("cari", api.post(ACC, { name: `M2T5 Rastgele ${seed}-${c}`, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("475") }));
          const invs = [(await must("fatura", api.post(INV, saleBody(a.id, pick(["2900", "1500", "4000"]), { date: "2026-09-14" })))).id];
          await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: pick(["3400", "1200", "6000"]), date: "2026-09-12", note: "Borç" }));
          const plan = rand() < 0.5 ? (await must("kart", api.post(PLANS, { accountId: a.id, name: "Kart", total: 2000, registeredOn: "2026-09-12", installments: { count: 2, firstDue: "2026-11-01", everyMonths: 1 } }))).id : null;
          accs.push({ id: a.id, invs, plan, recs: [], trashed: [] });
        }
        for (let step = 0; step < STEPS * CARI; step += 1) {
          stats.steps += 1;
          const A = pick(accs);
          const date = pick(CDAYS);
          const kind = !A.recs.length ? "take" : pick(["bound", "bound", "free", "sameday", "sameday", "take", "write", "write", "write", "write", "write", "out", "out", "outdel", "outcut", "credit", "creditup", "debtcut", "distribute", "invdel", "strangerdel", "draftdel", "restore", "wodel"]);
          const tag = `t${seed} s${step} ${kind}`;
          const hadWriteOff = () => Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND source = 'doubtful' AND kind = 'credit'", A.id).n) > 0;
          let guarded = null;
          if (kind === "bound" || kind === "free" || kind === "sameday") {
            let d = date;
            if (kind === "sameday") d = (await must("liste", api.get(`${ACC}/${A.id}/doubtful`))).records.find(x => x.id === pick(A.recs))?.date || date;
            const live = A.invs.filter(id => store.get("SELECT 1 AS found FROM invoices WHERE id = ? AND status = 'issued'", id));
            await api.post(`${ACC}/${A.id}/entries`, pay(tlText(Math.round(1000 + rand() * (kind === "free" ? 400000 : 120000))), d, kind === "bound" && live.length ? pick(live) : ""));
          } else if (kind === "take" && A.recs.length < 3) {
            const r = await api.post(`${ACC}/${A.id}/doubtful`, { amount: pick(["3000", "1500", "500", "1000"]), date: date < "2026-09-14" ? "2026-09-14" : date, reason: "lawsuit" });
            if (r.status === 200) A.recs.push(r.data.record.id);
          } else if (kind === "write") {
            const did = pick(A.recs);
            const q = await api.get(`${ACC}/${A.id}/doubtful/${did}/write-off?date=${date}`);
            if (q.status === 200 && !q.data.blocked && q.data.offerMinor > 0) {
              const r = await api.post(`${ACC}/${A.id}/doubtful/${did}/write-off`, { amount: tlText(q.data.offerMinor), date });
              if (r.status === 200) stats.writes += 1;
              else failures.push(`${tag}: önerilen ${q.data.offerMinor} @${date} reddedildi ${r.status} ${String(r.error).slice(0, 200)}`);
            }
          } else if (kind === "wodel") {
            const did = pick(A.recs);
            const line = (await writeOffsOf(api, A.id, did)).at(-1);
            if (line) await api.del(`${ACC}/${A.id}/doubtful/${did}/write-offs/${line.entryId}`);
          } else if (kind === "out") await api.post(`${ACC}/${A.id}/entries`, outBody(tlText(Math.round(5000 + rand() * 80000)), date));
          else if (kind === "credit") await api.post(`${ACC}/${A.id}/entries`, { kind: "credit", amount: tlText(Math.round(5000 + rand() * 80000)), date, note: "Alacak" });
          else if (kind === "outdel" || kind === "outcut") {
            const row = store.get("SELECT id, amount, date FROM account_entries WHERE account_id = ? AND kind = 'out' AND source = '' ORDER BY rowid DESC LIMIT 1", A.id);
            if (row) guarded = () => (kind === "outdel" ? api.del(`${ACC}/${A.id}/entries/${row.id}?cashForce=1`) : api.put(`${ACC}/${A.id}/entries/${row.id}`, outBody(tlText(Math.max(1, Math.round(row.amount * 100 * rand()))), row.date)));
          } else if (kind === "creditup") {
            const row = store.get("SELECT id, amount, date FROM account_entries WHERE account_id = ? AND kind = 'credit' AND source = '' ORDER BY rowid DESC LIMIT 1", A.id);
            if (row) guarded = () => api.put(`${ACC}/${A.id}/entries/${row.id}`, { kind: "credit", amount: tlText(Math.round(row.amount * 100 * (1 + rand() * 3))), date: row.date, note: "Alacak" });
          } else if (kind === "debtcut") {
            const row = store.get("SELECT id, amount, date FROM account_entries WHERE account_id = ? AND kind = 'debt' AND source = '' ORDER BY rowid DESC LIMIT 1", A.id);
            if (row) guarded = () => api.put(`${ACC}/${A.id}/entries/${row.id}`, { kind: "debt", amount: tlText(Math.max(1, Math.round(row.amount * 100 * rand()))), date: row.date, note: "Borç" });
          } else if (kind === "distribute" && A.plan) {
            const total = Number(store.get("SELECT total FROM plans WHERE id = ?", A.plan)?.total || 0);
            guarded = () => api.post(`${PLANS}/${A.plan}/distribute`, { total: tlText(Math.max(100, Math.round(total * 100 * rand() * 1.3))), count: 1 + Math.floor(rand() * 3), firstDue: "2026-11-01", everyMonths: 1 });
          } else if (kind === "invdel" && A.invs.length && rand() < 0.5) {
            const id = pick(A.invs);
            if ((await api.del(`${INV}/${id}`)).status === 200) {
              stats.invDeleted += 1;
              A.trashed.push(id);
            }
          } else if (kind === "strangerdel" && strangerInvs.length) {
            if ((await api.del(`${INV}/${strangerInvs.shift()}`)).status === 200) stats.otherDeleted += 1;
          } else if (kind === "draftdel") {
            const draft = await api.post(INV, saleBody(rand() < 0.5 ? A.id : stranger.id, "700", { date: pick(CDAYS), status: "draft" }));
            if (draft.status === 200) await api.del(`${INV}/${draft.data.id}`);
          } else if (kind === "restore" && A.trashed.length) {
            const ref = A.trashed.splice(Math.floor(rand() * A.trashed.length), 1)[0];
            const item = (await must("Silinenler", api.get("/api/admin/trash"))).find(x => x.kind === "invoice" && x.ref === ref);
            if (item && (await api.post("/api/admin/trash/restore", { id: item.id })).status === 200) stats.restored += 1;
          }
          if (guarded) {
            const had = hadWriteOff();
            const before = await balanceOf(api, A.id);
            const r = await guarded();
            stats.guarded += 1;
            if (r.status === 200) {
              stats.accepted += 1;
              const after = await balanceOf(api, A.id);
              if (had && after < before && after < 0) failures.push(`${tag}: Değersiz'li caride denetimli işlem eksiye götürdü (${before} → ${after})`);
            } else if (r.code === "doubtful-writeoff-balance") {
              stats.refused += 1;
              if (!had) failures.push(`${tag}: Değersiz'siz caride Değersiz reddi`);
              if (r.error.includes("Borç hareketi") && kind !== "debtcut") failures.push(`${tag}: ileti 'Borç hareketi' diyor: ${r.error.slice(0, 120)}`);
            }
          }
          const [fast, full, scans] = compareTrash(store);
          stats.compared += 1;
          if (scans) stats.scanned += 1;
          if (fast !== full) failures.push(`${tag}: Silinenler taraması FARKLI — yeni ${fast.slice(0, 300)} · tam ${full.slice(0, 300)}`);
        }
        const integrity = await integrityOf(api);
        if (!integrity.ok) failures.push(`tohum ${seed}: Mutabakat kırmızı ${JSON.stringify(integrity.failures).slice(0, 600)}`);
        console.log(`# M2T5 tohum ${seed}: ${JSON.stringify(stats)}`);
        assert.deepEqual(failures, []);
        assert.ok(stats.compared > 0 && stats.guarded > 0, JSON.stringify(stats));
      } finally {
        D.WRITE_OFF_TEST.fullTrash = false;
        server.close();
      }
    });
  }
});
