// 2.4.9 P1 düzeltme turu 1 — cari "Kredi Kartına İade" (giriş + kart yolu; plan §4.6 "ödeme iadesi (giriş) → Kurumsal Kart, POS satışı oluşmaz, 309 düşer").
// Beklenen davranış KULLANICI KARARINDAN (docs/2.4.9-IS-LISTESI.md "KULLANICI KARARI (03.11 ~20:35 UTC") ve P1 dar kontrol bulgusundan; program kodundan türetilmez:
//   P1-b  müşteride kutu (ve sunucuda POST) YALNIZ o caride silinmemiş, Kredi Kartı ile yapılmış bir "Ödeme" varken; davranış tedarikçideki gibi (seçilen karta,
//         POS satışı yok); tutara üst sınır YOK; düzeltmede (PUT) var olan satırlar korunur. Bayrak cari ayrıntısında (hasCardPayment), cari bazında.
//   DÜŞÜK-1 (ORTA'ya yükseltildi) var olan "Kredi Kartına İade" satırında kutu kaldırılıp kaydedilince (gövde cardRefund: false) düzeltme UYGULANIR: satır POS'a
//         (tek POS kendiliğinden, 2 POS'ta seçilen) ya da Nakit'e geçer, kart etkisi geri alınır. Alan gönderilmezse (eski istemci / mobil) önceki satırın bağı sürer.
// Eski kodda (a5a3fcb8) kırmızı hücreler ve beklenen nedenleri: P1-b — müşteriye kartla ödeme yokken POST 200 (karta yazılır); DÜŞÜK-1 — satır kartta kalır (tek POS) /
// 400 pos-not-for-payment (2 POS); ters yön (komşu) — tek kartta POS satırı karta çevrilince satır POS'ta kalır. Tedarikçi / Diğer hücresi ve "alan yok → bağ sürer"
// eski kodda da yeşil (gerileme koruması). Sahte saat 08.10.2026 (ders 13); sunucu süreç içinde, lisans zamanlayıcısı kapalı (ders 30).
// P1 TUR 2 (P1 tur 1 dar kontrolü, 03.11.2026; docs/2.4.9-IS-LISTESI.md "P1 TUR 1 DAR KONTROL") — düzeltmede (PUT) kart iadesi kuralları POST'la aynı:
//   DÜŞÜK-1 (tur 1 gerilemesi) etkin Kredi Kartı yokken (0 kart ya da tek kart pasif) PUT cardRefund:true → 400 bank-account-invalid (Yargıç 2.3.0 #6; önceden satır
//           sessizce hesapsıza — 108 — yazılıyordu). Var olan kart iadesi satırı korunur (pasif kartta açıklama düzeltmesi 200, kartı aynı).
//   DÜŞÜK-2 (03.11 yetkisiyle BAŞ MİMAR KARARI) "var olan satırlar korunur" yalnız VAR OLAN kart iadesi satırları: iade olmayan satır müşteride iadeye çevrilirken
//           POST'un card-refund-no-payment denetimi aynen (kartla ödemesi yoksa 400); var olan iade satırının tutar / tarih / kart düzeltmesi serbest.
//   TEST-1  yalnız POS İadesi (POS'a bağlı çıkış; cari formundan ve Banka → POS İşlemleri'nden) olan müşteride bayrak false, POST 400 (mutasyon mA: bayrak
//           sorgusu Kredi Kartı hesabı yerine "hesaba bağlı her çıkış").
//   TEST-2  iade → POS çevirmesinde POS ayrıntısı (taksit, provizyon no, son 4 hane) GÖVDEDEN yazılır (mutasyon mB: PUT önceki satıra göre karar verir).
// Eski kodda (20ca225a) beklenen kırmızılar: DÜŞÜK-1 hücreleri 200 + satır hesapsız; DÜŞÜK-2 hücresi 200 + satır karta. TEST-1 / TEST-2 eski kodda yeşil (doğru davranış).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BANK, TODAY, balanceOf, bootBank, expectStatus, kurus, must, openAcceptanceAccounts, openPos, posCheck, ziraatPos } from "./banka-220-pos-ortak.mjs";
import { openAccount } from "./banka-210-hesap-ortak.mjs";

const ACC = "/api/workspace/accounts";
async function world({ cards = 2, poses = 1 } = {}) {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id));
  const pos2 = poses > 1 ? await openPos(ctx.api, ziraatPos(acc.ziraat.id, { name: "Ziraat Sanal POS", terminalNo: "T002" })) : null;
  const card = name => openAccount(ctx.api, { bankName: "Ziraat Bankası", name, kind: "card", parentId: acc.ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  const kk1 = cards >= 1 ? await card("World") : null;
  const kk2 = cards >= 2 ? await card("Bonus") : null;
  const party = (name, type) => must(name, ctx.api.post(ACC, { name, type, registeredOn: "2026-09-01" }));
  const abc = await party("ABC Ltd.", "customer");
  const abc2 = await party("ABC Ltd.", "customer"); // aynı adlı ikinci müşteri: bayrak cari bazında
  const sup = await party("Toptancı A.Ş.", "supplier");
  const other = await party("Ortak Ltd.", "other");
  return { ctx, api: ctx.api, acc, pos, pos2, kk1, kk2, abc, abc2, sup, other };
}
const row = (w, id) => w.ctx.store.get("SELECT id, kind, amount, method, fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE id = ?", id);
const rowsOf = (w, accountId) => w.ctx.store.all("SELECT id, kind, amount, method, fin_ref AS finRef FROM account_entries WHERE account_id = ? ORDER BY rowid", accountId);
const activeSales = (w, eventId) => w.ctx.store.all("SELECT pos_id AS posId, kind, gross_minor AS gross FROM pos_sales WHERE event_id = ? AND status = 'active'", eventId).map(sale => ({ ...sale }));
const saleDetail = (w, eventId) => w.ctx.store.all("SELECT pos_id AS posId, kind, gross_minor AS gross, installments, auth_code AS authCode, card_last4 AS cardLast4 FROM pos_sales WHERE event_id = ? AND status = 'active'", eventId).map(sale => ({ ...sale }));
const setStatus = (w, accountId, status) => must(`hesap ${status}`, w.api.post(`${BANK}/accounts/${accountId}/status`, { status }));
const flagOf = async (w, accountId) => (await must("cari", w.api.get(`${ACC}/${accountId}`))).hasCardPayment;
const detailEntry = async (w, accountId, entryId) => (await must("cari", w.api.get(`${ACC}/${accountId}`))).entries.find(entry => entry.id === entryId);
const entry = (w, accountId, body) => w.api.post(`${ACC}/${accountId}/entries`, { date: TODAY, ...body });
const edit = (w, accountId, entryId, body) => w.api.put(`${ACC}/${accountId}/entries/${entryId}`, { date: TODAY, ...body });
const posPending = async w => (await must("banka özeti", w.api.get(`${BANK}/summary`))).posPending?.grossMinor ?? 0;
const cashOf = async w => (await must("Kasa", w.api.get("/api/workspace/cash"))).byMethod?.cash ?? 0;
const cardPay = (w, accountId, amount, cardId) => must("kartla Ödeme", entry(w, accountId, { kind: "out", method: "card", amount, ...(cardId ? { bankAccountId: cardId } : {}) }));

describe("P1-b — müşteride Kredi Kartına İade yalnız o cariye kredi kartıyla yapılmış bir Ödeme varken (kullanıcı kararı 03.11.2026)", () => {
  it("kartla ödemesi olmayan müşteri: POST cardRefund 400 card-refund-no-payment, satır yok, kart değişmez; nakit / havale / POS hareketi bayrak açmaz (false)", async () => {
    const w = await world();
    try {
      // Kartla olmayan para hareketleri: nakit ödeme, havale ödemesi, POS tahsilatı.
      await must("nakit Ödeme", entry(w, w.abc.id, { kind: "out", method: "cash", amount: "40", cashForce: true }));
      await must("havale Ödeme", entry(w, w.abc.id, { kind: "out", method: "bank", amount: "30", bankAccountId: w.acc.ziraat.id }));
      await must("POS tahsilatı", entry(w, w.abc.id, { kind: "in", method: "card", amount: "20" }));
      const before = { n: rowsOf(w, w.abc.id).length, kk1: await balanceOf(w.api, w.kk1.id), kk2: await balanceOf(w.api, w.kk2.id) };
      const res = await entry(w, w.abc.id, { kind: "in", method: "card", amount: "120", cardRefund: true, bankAccountId: w.kk2.id });
      expectStatus(res, 400, "card-refund-no-payment", "kartla ödemesi olmayan müşteriye Kredi Kartına İade");
      assert.match(res.error || "", /kredi kartıyla yapılmış bir ödeme yok/);
      assert.equal(rowsOf(w, w.abc.id).length, before.n, "satır yazılmadı");
      assert.deepEqual([await balanceOf(w.api, w.kk1.id), await balanceOf(w.api, w.kk2.id)], [before.kk1, before.kk2], "kartlar değişmedi");
      // Kutusuz (cardRefund yok) giriş + kart POS tahsilatıdır — kural yalnız işaretli istekte.
      const plain = await must("POS tahsilatı 2", entry(w, w.abc.id, { kind: "in", method: "card", amount: "25", similarOk: true }));
      assert.equal(row(w, plain.entryId).finRef, w.pos.id, "işaretsiz → POS");
      assert.equal(await flagOf(w, w.abc.id), false, "kartla ödeme yok → hasCardPayment false");
      await posCheck(w.api, "P1-b ödemesiz");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("müşteriye kartla Ödeme 400 (KART1) → Kredi Kartına İade 500 (ödemeden büyük, üst sınır yok) seçilen KART2'ye, POS satışı yok; aynı adlı ikinci müşteride 400; bayrak cari bazında", async () => {
    const w = await world();
    try {
      const paid = await cardPay(w, w.abc.id, "400", w.kk1.id);
      assert.equal(row(w, paid.entryId).finRef, w.kk1.id, "ödeme KART1'de");
      const kk2Before = await balanceOf(w.api, w.kk2.id);
      const pending = await posPending(w);
      const back = await must("Kredi Kartına İade 500", entry(w, w.abc.id, { kind: "in", method: "card", amount: "500", cardRefund: true, bankAccountId: w.kk2.id }));
      const r = row(w, back.entryId);
      assert.deepEqual([r.kind, r.method, r.amount, r.finRef], ["in", "card", 500, w.kk2.id], "satır seçilen KART2'de");
      assert.deepEqual(activeSales(w, r.eventId), [], "POS satışı oluşmadı");
      assert.equal((await balanceOf(w.api, w.kk2.id)) - kk2Before, kurus(500), "KART2 borcu 500 azaldı (alacak +500)");
      assert.equal(await posPending(w), pending, "POS Bekleyen değişmedi");
      assert.equal((await detailEntry(w, w.abc.id, back.entryId)).cardRefund, true, "cari kartında satır Kredi Kartına İade");
      // Tek kart kuralı tedarikçidekiyle aynı: 2 kartta kart kimliği verilmezse 400 bank-account-required.
      expectStatus(await entry(w, w.abc.id, { kind: "in", method: "card", amount: "10", cardRefund: true, similarOk: true }), 400, "bank-account-required", "kart seçilmedi");
      // Aynı adlı ikinci müşteri: kartla ödemesi yok → 400, satır yok.
      expectStatus(await entry(w, w.abc2.id, { kind: "in", method: "card", amount: "50", cardRefund: true, bankAccountId: w.kk2.id }), 400, "card-refund-no-payment", "ABC #2 (kartla ödemesi yok)");
      assert.equal(rowsOf(w, w.abc2.id).length, 0, "ABC #2'de satır yok");
      assert.equal(await flagOf(w, w.abc.id), true, "ABC #1: kartla ödeme var → hasCardPayment true");
      assert.equal(await flagOf(w, w.abc2.id), false, "ABC #2: hasCardPayment false");
      assert.equal(await flagOf(w, w.sup.id), false, "tedarikçi: kartla ödeme yok → false");
      await cardPay(w, w.sup.id, "90", w.kk1.id);
      assert.equal(await flagOf(w, w.sup.id), true, "tedarikçiye kartla ödeme → true (bilgi; tedarikçide kutu zaten var)");
      await posCheck(w.api, "P1-b ödemeli");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("silinmemiş: kartla ödeme silinince yeni Kredi Kartına İade 400 ve bayrak false; var olan iade satırının düzeltmesi (PUT, alan yok ya da cardRefund true) 200 ve kartta kalır", async () => {
    const w = await world();
    try {
      const paid = await cardPay(w, w.abc.id, "300", w.kk1.id);
      const back = await must("Kredi Kartına İade 120", entry(w, w.abc.id, { kind: "in", method: "card", amount: "120", cardRefund: true, bankAccountId: w.kk1.id }));
      await must("kartla ödemeyi sil", w.api.del(`${ACC}/${w.abc.id}/entries/${paid.entryId}`));
      expectStatus(await entry(w, w.abc.id, { kind: "in", method: "card", amount: "60", cardRefund: true, bankAccountId: w.kk1.id, similarOk: true }), 400, "card-refund-no-payment", "silinmiş ödemeden sonra yeni iade");
      const kk1 = await balanceOf(w.api, w.kk1.id);
      // PUT: gövdede cardRefund yok (eski istemci) → önceki bağ sürer; 120 → 110.
      await must("düzelt (alan yok)", edit(w, w.abc.id, back.entryId, { kind: "in", method: "card", amount: "110" }));
      assert.deepEqual([row(w, back.entryId).amount, row(w, back.entryId).finRef], [110, w.kk1.id], "110, KART1'de");
      assert.equal((await balanceOf(w.api, w.kk1.id)) - kk1, -kurus(10), "kart etkisi 120 → 110");
      // PUT: cardRefund true → korunur (müşteride ödeme olmasa da var olan satır).
      await must("düzelt (cardRefund true)", edit(w, w.abc.id, back.entryId, { kind: "in", method: "card", amount: "100", cardRefund: true }));
      assert.deepEqual([row(w, back.entryId).amount, row(w, back.entryId).finRef], [100, w.kk1.id], "100, KART1'de");
      assert.equal((await detailEntry(w, w.abc.id, back.entryId)).cardRefund, true, "satır hâlâ Kredi Kartına İade");
      assert.equal(await flagOf(w, w.abc.id), false, "ödeme silindi → hasCardPayment false");
      await posCheck(w.api, "P1-b silinmiş ödeme");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("tedarikçi ve Diğer türü cari: kartla ödeme olmadan da Kredi Kartına İade 200, tek kart kendiliğinden (değişmedi — gerileme koruması)", async () => {
    const w = await world({ cards: 1 });
    try {
      for (const party of [w.sup, w.other]) {
        const back = await must(`${party.name} iade`, entry(w, party.id, { kind: "in", method: "card", amount: "75", cardRefund: true }));
        assert.equal(row(w, back.entryId).finRef, w.kk1.id, `${party.name}: tek kart kendiliğinden`);
        assert.deepEqual(activeSales(w, row(w, back.entryId).eventId), [], `${party.name}: POS satışı yok`);
      }
      await posCheck(w.api, "P1-b tedarikçi");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("DÜŞÜK-1 — var olan Kredi Kartına İade satırında kutu kaldırılınca (cardRefund: false) düzeltme uygulanır", () => {
  it("tek POS: tedarikçi ve kartla ödemeli müşteri — PUT cardRefund:false, tutar aynı → satır POS'a, etkin POS satışı, kart etkisi geri, POS Bekleyen +", async () => {
    const w = await world();
    try {
      await cardPay(w, w.abc.id, "200", w.kk1.id);
      for (const party of [w.sup, w.abc]) {
        const back = await must(`${party.name} iade 150`, entry(w, party.id, { kind: "in", method: "card", amount: "150", cardRefund: true, bankAccountId: w.kk2.id, similarOk: true }));
        const kk2 = await balanceOf(w.api, w.kk2.id);
        const pending = await posPending(w);
        const balance = (await must("cari", w.api.get(`${ACC}/${party.id}`))).totals.balance;
        const res = await edit(w, party.id, back.entryId, { kind: "in", method: "card", amount: "150,00", cardRefund: false, posInstallments: "1" });
        assert.equal(res.status, 200, `${party.name}: PUT ${res.status} ${res.error || ""}`);
        const r = row(w, back.entryId);
        assert.deepEqual([r.method, r.amount, r.finRef], ["card", 150, w.pos.id], `${party.name}: satır POS'a geçti (önceki KART2)`);
        assert.deepEqual(activeSales(w, r.eventId), [{ posId: w.pos.id, kind: "sale", gross: kurus(150) }], `${party.name}: etkin POS satışı 150`);
        assert.equal((await balanceOf(w.api, w.kk2.id)) - kk2, -kurus(150), `${party.name}: KART2'deki iade geri alındı`);
        assert.equal((await posPending(w)) - pending, kurus(150), `${party.name}: POS Bekleyen +150`);
        assert.equal((await must("cari", w.api.get(`${ACC}/${party.id}`))).totals.balance, balance, `${party.name}: cari bakiyesi değişmedi (tutar aynı)`);
        assert.equal((await detailEntry(w, party.id, back.entryId)).cardRefund, undefined, `${party.name}: satır artık POS tahsilatı`);
        await posCheck(w.api, `DÜŞÜK-1 ${party.name}`);
      }
    } finally {
      await w.ctx.server.close();
    }
  });

  it("2 POS: PUT cardRefund:false + posId POS2 → 200, satır POS2'de (önceden 400 pos-not-for-payment: \"POS yalnız tahsilatta ve POS iadesinde kullanılır…\")", async () => {
    const w = await world({ poses: 2 });
    try {
      const back = await must("iade 90", entry(w, w.sup.id, { kind: "in", method: "card", amount: "90", cardRefund: true, bankAccountId: w.kk2.id }));
      const res = await edit(w, w.sup.id, back.entryId, { kind: "in", method: "card", amount: "90,00", cardRefund: false, posId: w.pos2.id, posInstallments: "1" });
      assert.equal(res.status, 200, `PUT ${res.status} ${res.code || ""} ${res.error || ""}`);
      const r = row(w, back.entryId);
      assert.equal(r.finRef, w.pos2.id, "satır POS2'de");
      assert.deepEqual(activeSales(w, r.eventId), [{ posId: w.pos2.id, kind: "sale", gross: kurus(90) }], "POS2'de etkin satış 90");
      assert.equal(await balanceOf(w.api, w.kk2.id), 0, "KART2 etkisi geri alındı (açılış 0)");
      // POS seçilmezse 2 POS'ta seçim istenir (yeni kayıttaki kural).
      const back2 = await must("iade 40", entry(w, w.sup.id, { kind: "in", method: "card", amount: "40", cardRefund: true, bankAccountId: w.kk2.id, similarOk: true }));
      expectStatus(await edit(w, w.sup.id, back2.entryId, { kind: "in", method: "card", amount: "40", cardRefund: false }), 400, "pos-required", "2 POS, POS seçilmedi");
      assert.equal(row(w, back2.entryId).finRef, w.kk2.id, "reddedilen düzeltmede satır KART2'de kaldı");
      await posCheck(w.api, "DÜŞÜK-1 2 POS");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("alan gönderilmezse (eski istemci) önceki kart bağı sürer; cardRefund:false + Nakit → nakit satır, Kasa +, kart etkisi geri", async () => {
    const w = await world();
    try {
      const back = await must("iade 80", entry(w, w.sup.id, { kind: "in", method: "card", amount: "80", cardRefund: true, bankAccountId: w.kk1.id }));
      await must("alan yok", edit(w, w.sup.id, back.entryId, { kind: "in", method: "card", amount: "80" }));
      assert.equal(row(w, back.entryId).finRef, w.kk1.id, "alan yok → KART1'de kaldı");
      const cash = await cashOf(w);
      await must("Nakit'e", edit(w, w.sup.id, back.entryId, { kind: "in", method: "cash", amount: "80", cardRefund: false }));
      const r = row(w, back.entryId);
      assert.deepEqual([r.method, r.finRef], ["cash", ""], "nakit, hesapsız");
      assert.equal(await balanceOf(w.api, w.kk1.id), 0, "KART1 etkisi geri alındı");
      assert.equal(Math.round(((await cashOf(w)) - cash) * 100), kurus(80), "Kasa +80");
      await posCheck(w.api, "DÜŞÜK-1 Nakit");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("ters yön (komşu): tek kartta POS tahsilatı satırı Kredi Kartına İade'ye çevrilince (kart kimliği yok, tutar aynı) satır kartta; POS satışı geçersiz", async () => {
    const w = await world({ cards: 1 });
    try {
      const sale = await must("POS tahsilatı 70", entry(w, w.sup.id, { kind: "in", method: "card", amount: "70" }));
      assert.equal(row(w, sale.entryId).finRef, w.pos.id);
      const res = await edit(w, w.sup.id, sale.entryId, { kind: "in", method: "card", amount: "70,00", cardRefund: true });
      assert.equal(res.status, 200, `PUT ${res.status} ${res.code || ""} ${res.error || ""}`);
      const r = row(w, sale.entryId);
      assert.equal(r.finRef, w.kk1.id, "satır tek karta (KART1)");
      assert.deepEqual(activeSales(w, r.eventId), [], "etkin POS satışı kalmadı");
      assert.equal(await balanceOf(w.api, w.kk1.id), kurus(70), "KART1 alacak +70");
      await posCheck(w.api, "ters yön");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("P1 tur 2 — düzeltmede (PUT) kart iadesi kuralları POST'la aynı (dar kontrol DÜŞÜK-1 / DÜŞÜK-2, TEST-1 / TEST-2)", () => {
  it("DÜŞÜK-1 0 kart: POS ve Nakit tahsilatı PUT cardRefund:true → 400 bank-account-invalid, satır yerinde (POS / Nakit), POS satışı sürer; POST da 400", async () => {
    const w = await world({ cards: 0 });
    try {
      const sale = await must("POS tahsilatı 70", entry(w, w.sup.id, { kind: "in", method: "card", amount: "70" }));
      const cashIn = await must("Nakit tahsilat 50", entry(w, w.sup.id, { kind: "in", method: "cash", amount: "50" }));
      const eventId = row(w, sale.entryId).eventId;
      assert.deepEqual(activeSales(w, eventId), [{ posId: w.pos.id, kind: "sale", gross: kurus(70) }], "ön koşul: etkin POS satışı 70");
      const pending = await posPending(w);
      const cash = await cashOf(w);
      const res = await edit(w, w.sup.id, sale.entryId, { kind: "in", method: "card", amount: "70,00", cardRefund: true });
      expectStatus(res, 400, "bank-account-invalid", "0 kart: POS satırı Kredi Kartına İade'ye");
      assert.match(res.error || "", /Kredi Kartına İade için etkin bir kredi kartı hesabı gerekir/);
      const r = row(w, sale.entryId);
      assert.deepEqual([r.method, r.amount, r.finRef], ["card", 70, w.pos.id], "satır POS'ta kaldı (hesapsıza yazılmadı)");
      assert.deepEqual(activeSales(w, r.eventId), [{ posId: w.pos.id, kind: "sale", gross: kurus(70) }], "POS satışı sürüyor");
      assert.equal(await posPending(w), pending, "POS Bekleyen değişmedi");
      const res2 = await edit(w, w.sup.id, cashIn.entryId, { kind: "in", method: "card", amount: "50", cardRefund: true });
      expectStatus(res2, 400, "bank-account-invalid", "0 kart: Nakit satırı Kredi Kartına İade'ye");
      assert.deepEqual([row(w, cashIn.entryId).method, row(w, cashIn.entryId).finRef], ["cash", ""], "satır Nakit kaldı");
      assert.equal(await cashOf(w), cash, "Kasa değişmedi");
      // POST aynı kural (Yargıç 2.3.0 #6) — gerileme koruması.
      expectStatus(await entry(w, w.sup.id, { kind: "in", method: "card", amount: "30", cardRefund: true }), 400, "bank-account-invalid", "0 kart: yeni Kredi Kartına İade");
      // Kutusuz düzeltme (alan yok / false) eskisi gibi 200: POS'ta kalır.
      await must("POS satırı açıklama (alan yok)", edit(w, w.sup.id, sale.entryId, { kind: "in", method: "card", amount: "70", note: "düzeltme" }));
      await must("POS satırı cardRefund:false", edit(w, w.sup.id, sale.entryId, { kind: "in", method: "card", amount: "70", cardRefund: false }));
      assert.equal(row(w, sale.entryId).finRef, w.pos.id, "kutusuz düzeltmede satır POS'ta");
      await posCheck(w.api, "tur 2 DÜŞÜK-1 0 kart");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("DÜŞÜK-1 tek kart pasif: POS satırı PUT cardRefund:true → 400 bank-account-invalid; var olan iade satırı korunur (açıklama düzeltmesi 200, kartı aynı; tutar değişikliği pasif kartta 400)", async () => {
    const w = await world({ cards: 1 });
    try {
      const back = await must("iade 80 (KART1)", entry(w, w.sup.id, { kind: "in", method: "card", amount: "80", cardRefund: true }));
      assert.equal(row(w, back.entryId).finRef, w.kk1.id, "ön koşul: iade KART1'de");
      const sale = await must("POS tahsilatı 60", entry(w, w.sup.id, { kind: "in", method: "card", amount: "60" }));
      await setStatus(w, w.kk1.id, "passive");
      const kk1 = await balanceOf(w.api, w.kk1.id);
      const res = await edit(w, w.sup.id, sale.entryId, { kind: "in", method: "card", amount: "60,00", cardRefund: true });
      expectStatus(res, 400, "bank-account-invalid", "tek kart pasif: POS satırı Kredi Kartına İade'ye");
      const r = row(w, sale.entryId);
      assert.deepEqual([r.method, r.finRef], ["card", w.pos.id], "satır POS'ta kaldı (hesapsıza yazılmadı)");
      assert.deepEqual(activeSales(w, r.eventId), [{ posId: w.pos.id, kind: "sale", gross: kurus(60) }], "POS satışı sürüyor");
      expectStatus(await entry(w, w.sup.id, { kind: "in", method: "card", amount: "20", cardRefund: true }), 400, "bank-account-invalid", "tek kart pasif: yeni Kredi Kartına İade");
      // Var olan iade satırı: parası değişmeyen düzeltme (açıklama) satırın kendi kartında kalır — korunur.
      await must("pasif kartta açıklama düzeltmesi", edit(w, w.sup.id, back.entryId, { kind: "in", method: "card", amount: "80", cardRefund: true, note: "pasif kartta açıklama" }));
      const kept = w.ctx.store.get("SELECT amount, fin_ref AS finRef, note FROM account_entries WHERE id = ?", back.entryId);
      assert.deepEqual([kept.amount, kept.finRef, kept.note], [80, w.kk1.id, "pasif kartta açıklama"], "iade satırı KART1'de, açıklama düzeldi");
      // Parası değişirse pasif hesabın kuralı (Yargıç Y1) — 400, satır aynı.
      expectStatus(await edit(w, w.sup.id, back.entryId, { kind: "in", method: "card", amount: "70", cardRefund: true }), 400, "bank-account-invalid", "pasif kartta tutar değişikliği");
      assert.deepEqual([row(w, back.entryId).amount, row(w, back.entryId).finRef], [80, w.kk1.id], "iade satırı 80, KART1");
      assert.equal(await balanceOf(w.api, w.kk1.id), kk1, "KART1 değişmedi");
      await setStatus(w, w.kk1.id, "active");
      await posCheck(w.api, "tur 2 DÜŞÜK-1 pasif kart");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("DÜŞÜK-2 müşteri: iade olmayan satır (POS / Nakit) PUT ile Kredi Kartına İade'ye — kartla ödemesi yoksa 400 card-refund-no-payment, varsa 200; var olan iade satırının tutar / tarih / kart düzeltmesi serbest; tedarikçi serbest", async () => {
    const w = await world();
    try {
      // ABC #1: kartla ödemesi yok.
      const sale = await must("ABC #1 POS tahsilatı 90", entry(w, w.abc.id, { kind: "in", method: "card", amount: "90" }));
      const cashIn = await must("ABC #1 Nakit tahsilat 40", entry(w, w.abc.id, { kind: "in", method: "cash", amount: "40" }));
      const kk = [await balanceOf(w.api, w.kk1.id), await balanceOf(w.api, w.kk2.id)];
      const res = await edit(w, w.abc.id, sale.entryId, { kind: "in", method: "card", amount: "90,00", cardRefund: true, bankAccountId: w.kk1.id });
      expectStatus(res, 400, "card-refund-no-payment", "ABC #1: POS satırı Kredi Kartına İade'ye (kartla ödeme yok)");
      assert.match(res.error || "", /kredi kartıyla yapılmış bir ödeme yok/);
      const r = row(w, sale.entryId);
      assert.deepEqual([r.method, r.finRef], ["card", w.pos.id], "satır POS'ta kaldı");
      assert.deepEqual(activeSales(w, r.eventId), [{ posId: w.pos.id, kind: "sale", gross: kurus(90) }], "POS satışı sürüyor");
      expectStatus(await edit(w, w.abc.id, cashIn.entryId, { kind: "in", method: "card", amount: "40", cardRefund: true, bankAccountId: w.kk1.id }), 400, "card-refund-no-payment", "ABC #1: Nakit satırı Kredi Kartına İade'ye");
      assert.deepEqual([row(w, cashIn.entryId).method, row(w, cashIn.entryId).finRef], ["cash", ""], "satır Nakit kaldı");
      assert.deepEqual([await balanceOf(w.api, w.kk1.id), await balanceOf(w.api, w.kk2.id)], kk, "kartlar değişmedi");
      // ABC #2: kartla Ödeme 300 (KART1) → POS satırı iadeye çevrilebilir (200, KART2, POS satışı geçersiz).
      const paid = await cardPay(w, w.abc2.id, "300", w.kk1.id);
      const sale2 = await must("ABC #2 POS tahsilatı 90", entry(w, w.abc2.id, { kind: "in", method: "card", amount: "90", similarOk: true }));
      await must("ABC #2 POS → Kredi Kartına İade", edit(w, w.abc2.id, sale2.entryId, { kind: "in", method: "card", amount: "90", cardRefund: true, bankAccountId: w.kk2.id }));
      assert.equal(row(w, sale2.entryId).finRef, w.kk2.id, "ABC #2: satır KART2'de");
      assert.deepEqual(activeSales(w, row(w, sale2.entryId).eventId), [], "ABC #2: etkin POS satışı kalmadı");
      const back = await must("ABC #2 iade 120 (KART2)", entry(w, w.abc2.id, { kind: "in", method: "card", amount: "120", cardRefund: true, bankAccountId: w.kk2.id }));
      // Kartla ödeme silinir: var olan iade satırları serbestçe düzeltilir; iade olmayan yeni satır artık çevrilemez.
      await must("kartla ödemeyi sil", w.api.del(`${ACC}/${w.abc2.id}/entries/${paid.entryId}`));
      assert.equal(await flagOf(w, w.abc2.id), false, "ABC #2: ödeme silindi → hasCardPayment false");
      await must("iade 120 → 110, 07.10, KART1", edit(w, w.abc2.id, back.entryId, { kind: "in", method: "card", amount: "110", date: "2026-10-07", cardRefund: true, bankAccountId: w.kk1.id }));
      const moved = w.ctx.store.get("SELECT amount, date, fin_ref AS finRef FROM account_entries WHERE id = ?", back.entryId);
      assert.deepEqual([moved.amount, moved.date, moved.finRef], [110, "2026-10-07", w.kk1.id], "var olan iade satırı: tutar, tarih, kart düzeldi");
      await must("çevrilmiş iade 90 → 85 (alan yok)", edit(w, w.abc2.id, sale2.entryId, { kind: "in", method: "card", amount: "85" }));
      assert.deepEqual([row(w, sale2.entryId).amount, row(w, sale2.entryId).finRef], [85, w.kk2.id], "çevrilmiş iade satırı 85, KART2");
      const sale3 = await must("ABC #2 POS tahsilatı 25", entry(w, w.abc2.id, { kind: "in", method: "card", amount: "25" }));
      expectStatus(await edit(w, w.abc2.id, sale3.entryId, { kind: "in", method: "card", amount: "25", cardRefund: true, bankAccountId: w.kk1.id }), 400, "card-refund-no-payment", "ABC #2 ödeme silindikten sonra POS satırı iadeye");
      assert.equal(row(w, sale3.entryId).finRef, w.pos.id, "ABC #2: yeni POS satırı POS'ta");
      // Tedarikçi: kartla ödeme olmadan da çevrilir (kural yalnız müşteride).
      const supSale = await must("tedarikçi POS tahsilatı 45", entry(w, w.sup.id, { kind: "in", method: "card", amount: "45" }));
      await must("tedarikçi POS → Kredi Kartına İade", edit(w, w.sup.id, supSale.entryId, { kind: "in", method: "card", amount: "45", cardRefund: true, bankAccountId: w.kk1.id }));
      assert.equal(row(w, supSale.entryId).finRef, w.kk1.id, "tedarikçi: satır KART1'de");
      await posCheck(w.api, "tur 2 DÜŞÜK-2");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("TEST-1 yalnız POS İadesi (cari formundan ve Banka → POS İşlemleri'nden; POS'a bağlı çıkış) olan müşteride hasCardPayment false, Kredi Kartına İade POST 400", async () => {
    const w = await world();
    try {
      const sale = await must("POS tahsilatı 200", entry(w, w.abc.id, { kind: "in", method: "card", amount: "200" }));
      const saleId = w.ctx.store.get("SELECT id FROM pos_sales WHERE event_id = ? AND status = 'active' AND kind = 'sale'", row(w, sale.entryId).eventId)?.id;
      assert.ok(saleId, "ön koşul: POS satışı");
      await must("cari POS İadesi 50", entry(w, w.abc.id, { kind: "out", method: "card", amount: "50", posRefund: true, posRefundOf: saleId }));
      await must("Banka → POS İşlemleri → İade 30", w.api.post(`${BANK}/pos/sales/${saleId}/refund`, { amount: "30", date: TODAY }));
      const outs = rowsOf(w, w.abc.id).filter(item => item.kind === "out");
      assert.deepEqual(outs.map(item => [item.method, item.amount, item.finRef]), [["card", 50, w.pos.id], ["card", 30, w.pos.id]], "ön koşul: iki POS İadesi, POS'a bağlı çıkış");
      assert.equal(await flagOf(w, w.abc.id), false, "yalnız POS İadesi → hasCardPayment false");
      const kk = [await balanceOf(w.api, w.kk1.id), await balanceOf(w.api, w.kk2.id)];
      const res = await entry(w, w.abc.id, { kind: "in", method: "card", amount: "40", cardRefund: true, bankAccountId: w.kk1.id });
      expectStatus(res, 400, "card-refund-no-payment", "yalnız POS İadesi olan müşteriye Kredi Kartına İade");
      assert.equal(rowsOf(w, w.abc.id).filter(item => item.kind === "in").length, 1, "yeni satır yok");
      assert.deepEqual([await balanceOf(w.api, w.kk1.id), await balanceOf(w.api, w.kk2.id)], kk, "kartlar değişmedi");
      await posCheck(w.api, "tur 2 TEST-1");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("TEST-2 iade → POS çevirmesinde POS ayrıntısı gövdeden: taksit 3, provizyon no 123456, son 4 hane 4242 (tedarikçi ve kartla ödemeli müşteri)", async () => {
    const w = await world();
    try {
      await cardPay(w, w.abc.id, "200", w.kk1.id);
      for (const [party, auth] of [[w.sup, "123456"], [w.abc, "123457"]]) {
        const back = await must(`${party.name} iade 150`, entry(w, party.id, { kind: "in", method: "card", amount: "150", cardRefund: true, bankAccountId: w.kk2.id, similarOk: true }));
        await must(`${party.name} iade → POS`, edit(w, party.id, back.entryId, { kind: "in", method: "card", amount: "150", cardRefund: false, posInstallments: "3", authCode: auth, cardLast4: "4242" }));
        const r = row(w, back.entryId);
        assert.equal(r.finRef, w.pos.id, `${party.name}: satır POS'ta`);
        assert.deepEqual(saleDetail(w, r.eventId), [{ posId: w.pos.id, kind: "sale", gross: kurus(150), installments: 3, authCode: auth, cardLast4: "4242" }], `${party.name}: POS satışı gövdedeki taksit / provizyon / son 4 haneyle`);
      }
      await posCheck(w.api, "tur 2 TEST-2");
    } finally {
      await w.ctx.server.close();
    }
  });
});
