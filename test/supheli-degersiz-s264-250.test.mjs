// 2.5.0 UD düzeltme turu 3 — S264 = A: 'Değersiz' sınır denetimi aynı günün sırasına uyar.
// KARAR (iş listesi C / D; kullanıcı kararı — 'ÖNERİYİ UYGULA' kuralıyla öneri uygulandı, kullanıcı 14.11 AYNEN: "bana sorun varsa önerilerini uygula"):
//   S264 = A (S-KC1; aynı gün, şüpheliye almadan önce yazılmış bağlı tahsilat): "'Değersiz' sınır denetimi aynı günün sırasına uyar — Değersiz, o günün bağlı payından ÖNCE
//   değerlendirilir, tam tutar kabul edilir (kâhin ve v2.4.9 böyle)."
//   S25 = A (c): "nakit / havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat → S14 ile aynı (şüpheli kısım 128'den düşer)." (S130 A: şüpheliye alınan tutar kalemlerden
//   en eskiden düşer — burada Fatura G1 2.900 tamamen şüpheli kısımdadır.)
// Beklenen sayılar karar metinlerinden ve kâhinin aynı adımlardaki beklentisinden (bağımsız kâhin test/bagimsiz/cari, kodu görmeden; UD turu 3 not defteri s264-*.json — a / b / e
// senaryolarında kâhinle program aynı); programdan türetilmedi (ders 5). Sahte saat 08.10.2026 (banka-210-hesap-ortak; ders 13).
// Kurulum (her alt testte yeni cari): Fatura G1 2.900 (05.09) · Borç 3.400 (11.09, vade 31.12) · tahsilat 2.876,45 (17.09; [G1'e bağlı]) · Şüpheliye Al 3.000 (17.09 ya da 15.09).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, expectStatus } from "./banka-210-hesap-ortak.mjs";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { ACC, balanceOf, listOf, take, writeOff } from "./banka-230-supheli-ortak.mjs";

describe("S264 = A — Değersiz sınırı aynı günün sırasına uyar (o günün bağlı payından ÖNCE)", () => {
  let ctx;
  let n = 0;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());
  const kur = async ({ bagli = true, sup = "2026-09-17" } = {}) => {
    n += 1;
    const acc = await must("cari", ctx.api.post(ACC, { name: `S264 Müşteri ${n}`, type: "customer", registeredOn: "2026-09-01" }));
    const g1 = await must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-05", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
    await must("borç", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-11", dueDate: "2026-12-31", note: "Borç" }));
    await must("tahsilat", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Tahsilat", ...(bagli ? { invoiceId: g1.id } : {}) }));
    const { record } = await must("şüpheliye al", take(ctx.api, acc.id, { amount: "3000", date: sup, reason: "lawsuit" }));
    return { acc, record };
  };
  const kayit = async (acc, did) => (await listOf(ctx.api, acc.id)).records.find(item => item.id === did);

  it("(a) aynı gün, şüpheliye almadan önce yazılmış BAĞLI tahsilat: Değersiz 3.000 (tam tutar) kabul; kayıt Değersiz Yazıldı, kalan 0; bakiye 423,55", async () => {
    const { acc, record } = await kur();
    await must("değersiz 3.000", writeOff(ctx.api, acc.id, record.id, { amount: "3000", date: "2026-09-17" }));
    const r = await kayit(acc, record.id);
    assert.equal(r.writtenOffMinor, 300000);
    assert.equal(r.remainingMinor, 0);
    assert.equal(r.stateKey, "writtenOff");
    assert.equal(await balanceOf(ctx.api, acc.id), 423.55, "2.900 + 3.400 − 2.876,45 − 3.000");
    await integrityOk(ctx.api, "S264 (a)");
  });

  it("(a′) aynı kurulumda kalanı aşan Değersiz (3.000,01) yine 400 doubtful-writeoff-exceeds — sınır 3.000; hiçbir satır yazılmaz", async () => {
    const { acc, record } = await kur();
    const once = ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n;
    const res = await writeOff(ctx.api, acc.id, record.id, { amount: "3000,01", date: "2026-09-17" });
    expectStatus(res, 400, "doubtful-writeoff-exceeds", "3.000,01 > 3.000");
    assert.match(String(res.error?.message || res.error || ""), /3\.000,00 TL/, "iletide sınır 3.000,00 TL");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n, once, "reddedilen yazım iz bırakmaz");
    await integrityOk(ctx.api, "S264 (a′)");
  });

  it("(b) aynı gün BAĞSIZ tahsilat: karar kapsamaz — sınır kalan 123,55; Değersiz 3.000 400 doubtful-writeoff-exceeds (kâhin ve v2.4.9 aynı)", async () => {
    const { acc, record } = await kur({ bagli: false });
    const res = await writeOff(ctx.api, acc.id, record.id, { amount: "3000", date: "2026-09-17" });
    expectStatus(res, 400, "doubtful-writeoff-exceeds", "bağsız aynı gün");
    assert.match(String(res.error?.message || res.error || ""), /123,55 TL/);
    await must("değersiz 123,55", writeOff(ctx.api, acc.id, record.id, { amount: "123,55", date: "2026-09-17" }));
    assert.equal((await kayit(acc, record.id)).remainingMinor, 0);
    await integrityOk(ctx.api, "S264 (b)");
  });

  it("(e) aynı gün BAĞLI 1.000 + BAĞSIZ 500 tahsilat, sonra Şüpheliye Al 3.000: sınır 3.000 − 500 = 2.500 (yalnız bağlı pay geri sayılır); 2.500,01 400, 2.500 kabul", async () => {
    n += 1;
    const acc = await must("cari", ctx.api.post(ACC, { name: `S264 Müşteri ${n}`, type: "customer", registeredOn: "2026-09-01" }));
    const g1 = await must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-05", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
    await must("borç", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-11", dueDate: "2026-12-31", note: "Borç" }));
    await must("bağlı tahsilat", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "1000", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: g1.id }));
    await must("bağsız tahsilat", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "500", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağsız" }));
    const { record } = await must("şüpheliye al", take(ctx.api, acc.id, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }));
    const res = await writeOff(ctx.api, acc.id, record.id, { amount: "2500,01", date: "2026-09-17" });
    expectStatus(res, 400, "doubtful-writeoff-exceeds", "2.500,01 > 2.500");
    assert.match(String(res.error?.message || res.error || ""), /2\.500,00 TL/);
    await must("değersiz 2.500", writeOff(ctx.api, acc.id, record.id, { amount: "2500", date: "2026-09-17" }));
    assert.equal((await kayit(acc, record.id)).remainingMinor, 0);
    assert.equal(await balanceOf(ctx.api, acc.id), 2300, "2.900 + 3.400 − 1.000 − 500 − 2.500");
    await integrityOk(ctx.api, "S264 (e)");
  });

  it("(c) bağlı tahsilat kayıttan SONRAKİ bir günde (S25 (c)): payı şüpheliden düşer — ertesi günün Değersiz'inde sınır 123,55 (S264 yalnız aynı günü söyler)", async () => {
    const { acc, record } = await kur({ sup: "2026-09-15" });
    const res = await writeOff(ctx.api, acc.id, record.id, { amount: "3000", date: "2026-09-18" });
    expectStatus(res, 400, "doubtful-writeoff-exceeds", "S25 (c) payı düşmüş");
    assert.match(String(res.error?.message || res.error || ""), /123,55 TL/);
    await integrityOk(ctx.api, "S264 (c)");
  });

  it("(d) komşu yol — (a)'da kabul edilen Değersiz satırı silinip Silinenler'den geri yüklenir (aynı sınır; önceden 409)", async () => {
    const { acc, record } = await kur();
    await must("değersiz 3.000", writeOff(ctx.api, acc.id, record.id, { amount: "3000", date: "2026-09-17" }));
    const entryId = (await kayit(acc, record.id)).writeOffs[0].entryId;
    await must("değersiz sil", ctx.api.del(`${ACC}/${acc.id}/doubtful/${record.id}/write-offs/${entryId}`));
    assert.equal((await kayit(acc, record.id)).writtenOffMinor, 0);
    const item = (await must("Silinenler", ctx.api.get("/api/admin/trash"))).find(row => row.kind === "doubtful-writeoff" && row.ref === entryId);
    assert.ok(item, "Silinenler'de Değersiz Alacak satırı");
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: item.id }));
    const r = await kayit(acc, record.id);
    assert.equal(r.writtenOffMinor, 300000);
    assert.equal(r.remainingMinor, 0);
    assert.equal(await balanceOf(ctx.api, acc.id), 423.55);
    await integrityOk(ctx.api, "S264 (d)");
  });
});
