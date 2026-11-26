// 2.5.0 UD düzeltme turu 4 — S269 = A ve S268 = A: S264 = A sınırı 'kayıt kapalı' denetiminden ÖNCE de uygulanır; düğme ve form ipucu yazılabilir tutarı gösterir.
// KARARLAR (iş listesi C / D; kullanıcı kararı — 'ÖNERİYİ UYGULA' kuralıyla öneri uygulandı, kullanıcı 14.11 AYNEN: "bana sorun varsa önerilerini uygula"):
//   S264 = A: "'Değersiz' sınır denetimi aynı günün sırasına uyar — Değersiz, o günün bağlı payından ÖNCE değerlendirilir, tam tutar kabul edilir (kâhin ve v2.4.9 böyle)."
//   S269 = A: "S264 sınırı 'kayıt kapalı' denetiminden ÖNCE de uygulanır (Değersiz Yaz ve Silinenler'den geri yükleme); bu kayıtlarda düğme görünür; ipucu ve önerilen tutar sınırı
//   gösterir (S268 A)." Örnekler (dar kontrol UD3 ORTA-1): P1 fatura 2.900 · Borç 3.400 · 17.09 bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 · Değersiz 1.000 → Değersiz 2.000
//   kabul, bakiye 423,55 (v2.4.9 423,55); P2 bağlı tahsilat 3.000 = şüpheli 3.000 → Değersiz 3.000 kabul, bakiye 400 (v2.4.9 400).
//   S268 = A: "ipucu ve önerilen tutar S264 sınırını gösterir."
// Beklenen sayılar karar metinlerinden ve dar kontrolün v2.4.9 gerçek kodundaki koşusundan (dk-ud3 v249-s264: P1 423,55 · P2 400 · P3 R1 1.500 kabul, sonra 423,55 · P5 R1 1.500 kabul,
// 1.923,55); programdan türetilmedi (ders 5). Sahte saat 08.10.2026 (banka-210-hesap-ortak; ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TODAY, bootBank, expectStatus } from "./banka-210-hesap-ortak.mjs";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { ACC, balanceOf, listOf, release, take, writeOff } from "./banka-230-supheli-ortak.mjs";

describe("S269 = A / S268 = A — Değersiz sınırı 'kayıt kapalı' denetiminden önce; düğme / ipucu yazılabilir tutarı gösterir", () => {
  let ctx;
  let n = 0;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());
  const kur = async ({ fatura = "2900", tahsil = "2876,45", sup = ["3000"], bagli = true, gun = "2026-09-17" } = {}) => {
    n += 1;
    const acc = await must("cari", ctx.api.post(ACC, { name: `S269 Müşteri ${n}`, type: "customer", registeredOn: "2026-09-01" }));
    const g1 = await must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-05", lines: [{ name: "Hizmet", qty: 1, unitPrice: fatura, vatRate: 0 }], payment: { rest: "open" } }));
    await must("borç", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-11", dueDate: "2026-12-31", note: "Borç" }));
    if (tahsil) await must("tahsilat", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: tahsil, date: gun, method: "cash", cashForce: true, similarOk: true, note: "Tahsilat", ...(bagli ? { invoiceId: g1.id } : {}) }));
    const recs = [];
    for (const amount of sup) recs.push((await must("şüpheliye al", take(ctx.api, acc.id, { amount, date: gun, reason: "lawsuit" }))).record);
    return { acc, g1, record: recs[0], recs };
  };
  const kayit = async (acc, did) => (await listOf(ctx.api, acc.id)).records.find(item => item.id === did);
  const satir = acc => ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n;

  it("S268 = A — açık kayıtta (kalan 123,55) yazılabilir tutar 3.000 ve günü 17.09 listede; bağsızda kalan 123,55, gün boş", async () => {
    const { acc, record } = await kur();
    const r = await kayit(acc, record.id);
    assert.equal(r.remainingMinor, 12355);
    assert.equal(r.writeOffRoomMinor, 300000, "ipucu / önerilen tutar S264 sınırı");
    assert.equal(r.writeOffRoomDate, "2026-09-17", "bağlı pay o günde (bugün değil) → form o güne kurulur");
    const b = await kur({ bagli: false });
    const rb = await kayit(b.acc, b.record.id);
    assert.equal(rb.writeOffRoomMinor, 12355, "bağsız tahsilat sınırı küçültür (S264 kapsamaz)");
    assert.equal(rb.writeOffRoomDate, "");
  });

  it("S268 = A — bağlı pay BUGÜN düşüyorsa yazılabilir tutar bugünün sınırı, gün boş (form bugünle açılır)", async () => {
    const { acc, record } = await kur({ gun: TODAY });
    const r = await kayit(acc, record.id);
    assert.equal(r.writeOffRoomMinor, 300000);
    assert.equal(r.writeOffRoomDate, "");
  });

  it("P1 — Değersiz 1.000 sonra 2.000 (17.09): ikisi de kabul; ara durumda düğme verisi 2.000; sonunda bakiye 423,55 (v2.4.9)", async () => {
    const { acc, record } = await kur();
    await must("değersiz 1.000", writeOff(ctx.api, acc.id, record.id, { amount: "1000", date: "2026-09-17" }));
    const ara = await kayit(acc, record.id);
    assert.equal(ara.remainingMinor, 0, "kalan aynı günün bağlı payıyla 0");
    assert.equal(ara.status, "open");
    const fazla = await writeOff(ctx.api, acc.id, record.id, { amount: "2000,01", date: "2026-09-17" });
    expectStatus(fazla, 400, "doubtful-writeoff-exceeds", "2.000,01 > 2.000 (kayıt kapalı sayılmaz; sınır 2.000)");
    assert.match(String(fazla.error?.message || fazla.error || ""), /2\.000,00 TL/);
    await must("değersiz 2.000", writeOff(ctx.api, acc.id, record.id, { amount: "2000", date: "2026-09-17" }));
    assert.equal(ara.writeOffRoomMinor, 200000, "ara durumda düğme görünür, ipucu 2.000");
    assert.equal(ara.writeOffRoomDate, "2026-09-17");
    const son = await kayit(acc, record.id);
    assert.equal(son.writtenOffMinor, 300000);
    assert.equal(son.remainingMinor, 0);
    assert.equal(son.writeOffRoomMinor, 0, "sınır doldu → düğme yok");
    assert.equal(await balanceOf(ctx.api, acc.id), 423.55, "2.900 + 3.400 − 2.876,45 − 1.000 − 2.000");
    await integrityOk(ctx.api, "S269 P1");
  });

  it("P1′ — kalanı kapanmış kayıtta ERTESİ gün Değersiz: o günün bağlı payı yok → 409 doubtful-closed (eskisi gibi); satır yazılmaz", async () => {
    const { acc, record } = await kur();
    await must("değersiz 1.000", writeOff(ctx.api, acc.id, record.id, { amount: "1000", date: "2026-09-17" }));
    const once = satir(acc);
    const res = await writeOff(ctx.api, acc.id, record.id, { amount: "1000", date: "2026-09-18" });
    expectStatus(res, 409, "doubtful-closed", "18.09: bağlı pay yok");
    assert.equal(satir(acc), once);
  });

  it("P2 — bağlı tahsilat 3.000 = şüpheli 3.000 (kayıt Tahsil Edildi): yazılabilir 3.000; Değersiz 3.000 kabul, bakiye 400 (v2.4.9)", async () => {
    const { acc, record } = await kur({ fatura: "3000", tahsil: "3000" });
    const r = await kayit(acc, record.id);
    assert.equal(r.stateKey, "collected");
    await must("değersiz 3.000", writeOff(ctx.api, acc.id, record.id, { amount: "3000", date: "2026-09-17" }));
    assert.equal(r.writeOffRoomMinor, 300000, "Tahsil Edildi görünen kayıtta düğme verisi 3.000");
    const son = await kayit(acc, record.id);
    assert.equal(son.writtenOffMinor, 300000);
    assert.equal(son.stateKey, "writtenOff");
    assert.equal(await balanceOf(ctx.api, acc.id), 400, "3.000 + 3.400 − 3.000 − 3.000");
    await integrityOk(ctx.api, "S269 P2");
  });

  it("P3 — aynı gün iki kayıt (1.500 + 1.500): R1'e (Tahsil Edildi) Değersiz 1.500 kabul, sonra R2'ye 1.500 kabul; bakiye 1.923,55 → 423,55 (v2.4.9)", async () => {
    const { acc, recs } = await kur({ sup: ["1500", "1500"] });
    const r1 = await kayit(acc, recs[0].id);
    await must("R1 değersiz 1.500", writeOff(ctx.api, acc.id, recs[0].id, { amount: "1500", date: "2026-09-17" }));
    assert.equal(r1.writeOffRoomMinor, 150000, "R1 (Tahsil Edildi görünen) düğme verisi 1.500");
    assert.equal(await balanceOf(ctx.api, acc.id), 1923.55);
    await must("R2 değersiz 1.500", writeOff(ctx.api, acc.id, recs[1].id, { amount: "1500", date: "2026-09-17" }));
    assert.equal((await kayit(acc, recs[0].id)).writtenOffMinor, 150000);
    assert.equal((await kayit(acc, recs[1].id)).writtenOffMinor, 150000);
    assert.equal(await balanceOf(ctx.api, acc.id), 423.55);
    await integrityOk(ctx.api, "S269 P3");
  });

  it("P5 — aynı gün R2 Şüpheliden Çıkar, sonra R1'e Değersiz 1.500 kabul; bakiye 1.923,55 (v2.4.9); çıkarılmış kayıtta düğme verisi 0", async () => {
    const { acc, recs } = await kur({ sup: ["1500", "1500"] });
    await must("R2 çıkar", release(ctx.api, acc.id, recs[1].id, { date: "2026-09-17" }));
    const ciks = await kayit(acc, recs[1].id);
    const r2 = await writeOff(ctx.api, acc.id, recs[1].id, { amount: "1", date: "2026-09-17" });
    expectStatus(r2, 409, "doubtful-closed", "çıkarılmış kayıt kapalı kalır");
    await must("R1 değersiz 1.500", writeOff(ctx.api, acc.id, recs[0].id, { amount: "1500", date: "2026-09-17" }));
    assert.equal(ciks.writeOffRoomMinor, 0, "çıkarılmış kayıt: Değersiz düğmesi yok");
    assert.equal((await kayit(acc, recs[0].id)).writtenOffMinor, 150000);
    assert.equal(await balanceOf(ctx.api, acc.id), 1923.55, "2.900 + 3.400 − 2.876,45 − 1.500");
    await integrityOk(ctx.api, "S269 P5");
  });

  it("Silinenler — Değersiz 3.000 silinir, SONRA aynı gün bağlı tahsilat 3.000 kaydı kapatır; geri yükleme kabul (önceden 409 doubtful-closed); bakiye 400", async () => {
    const { acc, g1, record } = await kur({ fatura: "3000", tahsil: "" });
    await must("değersiz 3.000", writeOff(ctx.api, acc.id, record.id, { amount: "3000", date: "2026-09-17" }));
    const entryId = (await kayit(acc, record.id)).writeOffs[0].entryId;
    await must("değersiz sil", ctx.api.del(`${ACC}/${acc.id}/doubtful/${record.id}/write-offs/${entryId}`));
    await must("bağlı tahsilat 3.000", ctx.api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "3000", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Tahsilat", invoiceId: g1.id }));
    const ara = await kayit(acc, record.id);
    assert.equal(ara.remainingMinor, 0, "kayıt bağlı tahsilatla kapandı");
    const item = (await must("Silinenler", ctx.api.get("/api/admin/trash"))).find(row => row.kind === "doubtful-writeoff" && row.ref === entryId);
    assert.ok(item, "Silinenler'de Değersiz Alacak satırı");
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: item.id }));
    assert.equal(ara.writeOffRoomMinor, 300000, "geri yüklemeden önce düğme verisi 3.000");
    const son = await kayit(acc, record.id);
    assert.equal(son.writtenOffMinor, 300000);
    assert.equal(await balanceOf(ctx.api, acc.id), 400, "3.000 + 3.400 − 3.000 − 3.000");
    await integrityOk(ctx.api, "S269 Silinenler");
  });
});
