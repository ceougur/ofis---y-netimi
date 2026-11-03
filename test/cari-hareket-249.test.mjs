// 2.4.9 C1 — HAREKETLİ CARİ SİLİNEMEZ (docs/2.4.9-tasarim/C1-hareketli-cari.md §8 "Nasıl bozulur?", §10 test matrisi).
// KULLANICI KARARLARI (03.11.2026, AYNEN özet): KARAR ~11:45 A — hareketi olan cari silinemez, program "Pasife Al" önerir (Sil pasif + nedeni görünür yazı,
// deleteBlock ile aynı yer); hiç hareketi olmayan (yanlış açılmış) cari silinebilir; cariyi kaldıran bütün yollar aynı kurala; daha önce silinmiş cariler
// Silinenler'den geri yüklenebilir kalır. İLKE ~11:50 — hareket = cariye bağlı her parasal işlem (tahsilat/ödeme, Borç/Alacak Yaz, açılış bakiyesi, stok
// hareketinin cari satırı, taksit kartı ve tahsilatları, çek/senet, fatura — taslak/iptal dahil —, mahsup, iade); not, WhatsApp gönderim izi, değişiklik
// geçmişi hareket değil. S1 A (Silinenler'deki kayıt sayılmaz; kalıcı silmede sayılır), S2 A (tutarı sıfır kart/taslak sayılır), S3 A (eski silinmiş
// carilere dokunulmaz). BAŞ MİMAR KARARI: silinmiş cariye tahsilat yarışı (§9) C1'e girer.
// Kâhin: beklenen sayılar (counts) her durumda girilen kayıtların ELLE sayımıdır (1 tahsilat → 1 cari hareketi, 1 taslak → 1 fatura …); program kodundan
// türetilmez. Hata kodu tek: account-has-movements (BAŞ MİMAR YORUMU Y1).
// Eski kodda (35e90e47) beklenen kırmızılar: T1 "beklenen 409, gelen 200"; T4 yeniden silme 200; T5 hareketli cari 200; T7 cari kalıcı silinir; T8 satır yazılır.
// T2 (zaten engelleniyordu) eski kodda yalnız kod/ileti farkıyla kırmızıdır — kanıt sayılmaz (ders 38). Sahte saat (ders 13).
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { boot, must, rawRun } from "./banka-210-ortak.mjs";
import { bootBank, openAcceptanceAccounts, openPos, posInvoice, ziraatPos } from "./banka-220-pos-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ACC = "/api/workspace/accounts";
const ZERO = { entries: 0, stock: 0, invoices: 0, offsets: 0, plans: 0, cheques: 0, doubtful: 0, vouchers: 0 };
const LINE = { name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 };
const cashOf = async api => (await must("Kasa", api.get("/api/workspace/cash"))).totals.balance;
const deletedAt = (ctx, id) => {
  const row = ctx.store.get("SELECT deleted_at AS d FROM accounts WHERE id = ?", id);
  return row ? row.d : "YOK";
};

// Hareketli cari: kart Sil'i pasif + nedeni, DELETE 409 account-has-movements (cashForce'la da), cari duruyor, Kasa aynı, sayılar elle sayımla aynı.
async function assertRefused(ctx, label, accountId, counts, { passive = false } = {}) {
  const card = await must(`${label}: kart`, ctx.api.get(`${ACC}/${accountId}`));
  const cashBefore = await cashOf(ctx.api);
  const res = await ctx.api.del(`${ACC}/${accountId}?cashForce=1`);
  assert.equal(res.status, 409, `${label}: hareketli cari silinmemeli — beklenen 409, gelen ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  assert.equal(deletedAt(ctx, accountId), null, `${label}: cari silinmiş olmamalı`);
  assert.equal(await cashOf(ctx.api), cashBefore, `${label}: Kasa değişmemeli`);
  // İki istemci sarmalayıcısı (banka-210-ortak: code/error üstte; surumler: gövdede) aynı okunur.
  const code = res.code ?? res.data?.code;
  const error = res.error ?? res.data?.error;
  assert.equal(code, "account-has-movements", `${label}: tek hata kodu`);
  assert.deepEqual(res.data.counts, { ...ZERO, ...counts }, `${label}: hareket sayıları (elle sayım)`);
  assert.equal(res.data.passive, passive, `${label}: pasif bilgisi`);
  assert.equal(card.deleteBlock, error, `${label}: kartın Sil nedeni silme ucunun iletisiyle aynı`);
  assert.match(card.deleteBlock, /Hareketi olan cari silinmez/, `${label}: neden görünür`);
  if (!passive) assert.match(card.deleteBlock, /Pasife Al/, `${label}: Pasife Al önerisi`);
  return { ...res, code, error };
}
// Hareketsiz cari: kart Sil açık, DELETE 200, Silinenler'de.
async function assertDeleted(ctx, label, accountId) {
  const card = await must(`${label}: kart`, ctx.api.get(`${ACC}/${accountId}`));
  assert.equal(card.deleteBlock, "", `${label}: hareketsiz caride Sil açık`);
  await must(`${label}: sil`, ctx.api.del(`${ACC}/${accountId}`));
  assert.ok(deletedAt(ctx, accountId), `${label}: cari silindi (yumuşak)`);
  const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
  assert.ok(trash.some(item => item.id === `account:${accountId}`), `${label}: Silinenler'de`);
}
// Durum durum sonuç: biri kırmızı olsa da öbürleri koşar; test sonunda her durumun sonucu ve nedeni tek iletide (eski kodda kırmızı kanıtı — ders 38).
async function check(outcomes, label, fn) {
  try {
    await fn();
    outcomes.push(`✓ ${label}`);
  } catch (error) {
    outcomes.push(`✗ ${label}: ${String(error?.message || error).split("\n")[0]}`);
  }
}
function verdict(name, outcomes) {
  const failed = outcomes.filter(line => line.startsWith("✗"));
  assert.equal(failed.length, 0, `${name}: ${failed.length}/${outcomes.length} durum kırmızı\n${outcomes.join("\n")}`);
}
const newAccount = (ctx, name, extra = {}) => must(`cari ${name}`, ctx.api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", ...extra }));
const entry = (ctx, id, body) => must(`hareket ${body.kind}`, ctx.api.post(`${ACC}/${id}/entries`, { date: TODAY, method: "cash", ...body }));

describe("2.4.9 C1 — hareket tanımı (H1–H14), silme ucu, kart, yarış (bankasız şirket)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => ctx?.server.close());

  it("T1 bugün silinebilen her hareket türü tek başına cariyi korur (tahsilat, ödeme, havale, Borç/Alacak Yaz, açılış, stok, taslak/iptal/e-SMM, yetim satır, mahsup)", async () => {
    const cases = [
      ["nakit tahsilat", async a => entry(ctx, a.id, { kind: "in", amount: "500" }), { entries: 1 }],
      ["nakit ödeme", async a => entry(ctx, a.id, { kind: "out", amount: "300", cashForce: true }), { entries: 1 }],
      ["havale (banka hesabı atanmamış)", async a => entry(ctx, a.id, { kind: "in", amount: "200", method: "bank" }), { entries: 1 }],
      ["Borç Yaz", async a => entry(ctx, a.id, { kind: "debt", amount: "250" }), { entries: 1 }],
      ["Alacak Yaz", async a => entry(ctx, a.id, { kind: "credit", amount: "120" }), { entries: 1 }],
      ["taslak fatura", async a => must("taslak", ctx.api.post("/api/workspace/invoices", { status: "draft", scenario: "service_sale", accountId: a.id, lines: [LINE] })), { invoices: 1 }],
      // (0,00 TL'lik taslak kaydedilemiyor — 400 "ödenecek tutarı sıfırdan büyük olmalı"; S2 A burada kalemsiz kartla denenir, T2.)
      ["iptal edilmiş fatura", async a => {
        const doc = await must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: TODAY, lines: [LINE], payment: { rest: "open" } }));
        await must("iptal", ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "C1 kanıt" }));
      }, { invoices: 1 }],
      ["e-SMM (serbest meslek makbuzu) taslağı", async a => must("SMM taslak", ctx.api.post("/api/workspace/invoices", { status: "draft", scenario: "smm", accountId: a.id, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }] })), { invoices: 1 }],
      ["ürünü sonradan silinen açık hesap stok alımı", async a => {
        const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: `C1 Ürün ${a.id.slice(-6)}`, unit: "Adet", unitPrice: 10 }));
        await must("stok", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: 2, unitPrice: 5, pay: "account", accountId: a.id, date: TODAY }));
        await must("ürünü sil", ctx.api.del(`/api/workspace/stock/${item.id}`));
      }, { stock: 1 }],
      ["açılış bakiyesi (Yeni Cari)", null, { entries: 1 }, { openingBalance: "400" }],
    ];
    const outcomes = [];
    for (const [label, setup, counts, extra] of cases) {
      await check(outcomes, label, async () => {
        const account = await newAccount(ctx, `T1 ${label}`, extra);
        if (setup) await setup(account);
        await assertRefused(ctx, label, account.id, counts);
      });
    }
    await check(outcomes, "açılış bakiyesi (Excel'den cari yükleme)", async () => {
      const matrix = [["ADI SOYADI", "TELEFON", "BAKİYE"], ["T1 Excel Açılışlı", "0532 249 00 01", "1.500"]];
      const preview = await must("Excel ön izleme", ctx.api.post(`${ACC}/import/preview`, { matrix }));
      await must("Excel yükle", ctx.api.post(`${ACC}/import`, { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "c1.xlsx" }));
      const excel = ctx.store.get("SELECT id FROM accounts WHERE name = 'T1 Excel Açılışlı' AND deleted_at IS NULL");
      await assertRefused(ctx, "açılış bakiyesi (Excel)", excel.id, { entries: 1 });
    });
    verdict("T1", outcomes);
  });

  it("T2 zaten korunan türler aynı kurala ve tek koda geçer (kayıtlı fatura, peşinli fatura, mahsup, çek, ciro alan cari, taksit kartı açık/kapalı/kalemsiz, şüpheli alacak)", async () => {
    const outcomes = [];
    await check(outcomes, "kayıtlı fatura", async () => {
      const issued = await newAccount(ctx, "T2 Faturalı");
      await must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: issued.id, issueDate: TODAY, lines: [LINE], payment: { rest: "open" } }));
      await assertRefused(ctx, "kayıtlı fatura", issued.id, { invoices: 1 });
    });
    await check(outcomes, "peşin tahsilatlı fatura", async () => {
      const paid = await newAccount(ctx, "T2 Peşinli Faturalı");
      await must("peşinli fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: paid.id, issueDate: TODAY, lines: [LINE], payment: { cash: [{ amount: 120, method: "cash" }], rest: "open" } }));
      await assertRefused(ctx, "peşin tahsilatlı fatura", paid.id, { invoices: 1 });
    });
    await check(outcomes, "mahsup", async () => {
      const offset = await newAccount(ctx, "T2 Mahsuplu");
      const invoice = await must("satış", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: offset.id, issueDate: TODAY, lines: [{ ...LINE, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }));
      const credit = await entry(ctx, offset.id, { kind: "credit", amount: "300", note: "İndirim" });
      await must("mahsup", ctx.api.post(`/api/workspace/invoices/${invoice.id}/offsets`, { counterType: "entry", counterId: credit.entryId, amount: "300", date: TODAY }));
      await assertRefused(ctx, "mahsup", offset.id, { invoices: 1, offsets: 1, entries: 1 });
    });
    await check(outcomes, "alınan çek ve ciro alan cari", async () => {
      const drawer = await newAccount(ctx, "T2 Çek Veren");
      const supplier = await newAccount(ctx, "T2 Ciro Alan", { type: "supplier" });
      const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.500", issueDate: TODAY, dueDate: "2026-12-31", drawer: "Keşideci", serialNo: "C1-1", bank: "Ziraat", accountId: drawer.id }));
      await assertRefused(ctx, "alınan çek", drawer.id, { cheques: 1 });
      await must("ciro", ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "endorse", date: TODAY, accountId: supplier.id }));
      await assertRefused(ctx, "ciro alan cari", supplier.id, { cheques: 1 });
    });
    await check(outcomes, "açık taksit kartı", async () => {
      const planned = await newAccount(ctx, "T2 Taksitli");
      await must("kart", ctx.api.post("/api/workspace/plans", { accountId: planned.id, name: "T2 Taksitli", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
      await assertRefused(ctx, "açık taksit kartı", planned.id, { plans: 1 });
    });
    await check(outcomes, "kapatılmış taksit kartı", async () => {
      const closed = await newAccount(ctx, "T2 Kapalı Kartlı");
      const closedPlan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: closed.id, name: "T2 Kapalı Kartlı", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
      await must("kartı kapat", ctx.api.put(`/api/workspace/plans/${closedPlan.id}`, { status: "closed" }));
      await assertRefused(ctx, "kapatılmış taksit kartı", closed.id, { plans: 1 });
    });
    await check(outcomes, "taksit kurulmamış, toplamı sıfır kart (S2 A)", async () => {
      const empty = await newAccount(ctx, "T2 Kalemsiz Kartlı");
      const emptyPlan = await must("kalemsiz kart", ctx.api.post("/api/workspace/plans", { accountId: empty.id, name: "T2 Kalemsiz Kartlı", total: "0", registeredOn: TODAY }));
      assert.equal(emptyPlan.items?.length ?? 0, 0, "kalemsiz kart (Taksit kurulmadı)");
      assert.equal(Number(emptyPlan.total), 0, "toplamı sıfır");
      await assertRefused(ctx, "taksit kurulmamış kart (S2 A)", empty.id, { plans: 1 });
    });
    await check(outcomes, "şüpheli alacak", async () => {
      const doubtful = await newAccount(ctx, "T2 Şüpheli");
      await entry(ctx, doubtful.id, { kind: "debt", amount: "1.000", date: "2026-10-01" });
      await must("şüpheli al", ctx.api.post(`${ACC}/${doubtful.id}/doubtful`, { amount: 1000, date: "2026-10-02", reason: "other" }));
      await assertRefused(ctx, "şüpheli alacak", doubtful.id, { entries: 1, doubtful: 1 });
    });
    verdict("T2", outcomes);
  });

  it("T3 hareketsiz cari silinir — not, telefon, WhatsApp gönderim izi, değişiklik geçmişi hareket değil; Silinenler'deki kayıt sayılmaz (S1 A)", async () => {
    const plain = await newAccount(ctx, "T3 Bilgili Cari", { phone: "0532 249 00 03", note: "Yanlış açıldı" });
    await must("düzelt", ctx.api.put(`${ACC}/${plain.id}`, { name: "T3 Bilgili Cari (düzeltildi)" }));
    rawRun(ctx.db, "INSERT INTO message_sends (id, batch_id, account_id, kind, phone, body, status, created_by, created_at) VALUES (?, 'b-c1', ?, 'message', '905322490003', 'Merhaba', 'sent', 'admin', ?)", `ms-${plain.id.slice(-8)}`, plain.id, NOW);
    assert.ok(ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE entity_id = ?", plain.id).n >= 2, "değişiklik geçmişi var");
    await assertDeleted(ctx, "bilgili hareketsiz cari", plain.id);

    const trashedEntry = await newAccount(ctx, "T3 Tahsilatı Silinenlerde");
    const made = await entry(ctx, trashedEntry.id, { kind: "in", amount: "70" });
    await must("hareketi sil", ctx.api.del(`${ACC}/${trashedEntry.id}/entries/${made.entryId}?cashForce=1`));
    await assertDeleted(ctx, "tahsilatı Silinenler'de (S1 A)", trashedEntry.id);

    const trashedPlan = await newAccount(ctx, "T3 Kartı Silinenlerde");
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: trashedPlan.id, name: "T3 Kartı Silinenlerde", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    await must("kartı sil", ctx.api.del(`/api/workspace/plans/${plan.id}`));
    await assertDeleted(ctx, "taksit kartı Silinenler'de (S1 A)", trashedPlan.id);

    const trashedDraft = await newAccount(ctx, "T3 Taslağı Silinenlerde");
    const draft = await must("taslak", ctx.api.post("/api/workspace/invoices", { status: "draft", scenario: "service_sale", accountId: trashedDraft.id, lines: [LINE] }));
    await must("taslağı sil", ctx.api.del(`/api/workspace/invoices/${draft.id}?reason=C1`));
    await assertDeleted(ctx, "taslağı Silinenler'de (S1 A)", trashedDraft.id);

    const trashedCheque = await newAccount(ctx, "T3 Çeki Silinenlerde");
    const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "500", issueDate: TODAY, dueDate: "2026-12-31", drawer: "Keşideci", serialNo: "C1-3", bank: "Ziraat", accountId: trashedCheque.id }));
    await must("çeki sil", ctx.api.del(`/api/workspace/cheques/${cheque.id}`));
    await assertDeleted(ctx, "çeki Silinenler'de (S1 A)", trashedCheque.id);
  });

  it("T4 eski sürümde silinmiş hareketli cari (S3 A) Silinenler'den geri yüklenir, Kasa geri gelir; bir daha silinemez", async () => {
    const old = await newAccount(ctx, "T4 Eski Silinmiş");
    await entry(ctx, old.id, { kind: "in", amount: "300" });
    const withOld = await cashOf(ctx.api);
    // Eski sürüm (v2.0.6–v2.4.8) bu cariyi silebiliyordu: yumuşak silme doğrudan yazılır (store dışı; eski veri benzetimi). Gerçek v2.4.7 verisi aşağıda.
    rawRun(ctx.db, "UPDATE accounts SET deleted_at = ?, deleted_by = 'eski-surum' WHERE id = ?", NOW, old.id);
    assert.equal(await cashOf(ctx.api), withOld - 300, "silinmiş carinin tahsilatı Kasa'da görünmüyor (eski sürümün izi)");
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `account:${old.id}` }));
    assert.equal(await cashOf(ctx.api), withOld, "geri yüklenince Kasa geri gelir");
    await assertRefused(ctx, "geri yüklenen hareketli cari", old.id, { entries: 1 });
  });

  it("T5 aynı adlı iki cari: yalnız hareketsiz olan silinir; pasif hareketli caride ileti pasif sürümü", async () => {
    const busy = await newAccount(ctx, "Ayşe Demir", { phone: "0532 249 00 51" });
    const idle = await newAccount(ctx, "Ayşe Demir", { phone: "0532 249 00 52" });
    await entry(ctx, busy.id, { kind: "in", amount: "90" });
    await assertRefused(ctx, "aynı adlı hareketli", busy.id, { entries: 1 });
    await assertDeleted(ctx, "aynı adlı hareketsiz", idle.id);
    assert.equal(deletedAt(ctx, busy.id), null, "hareketli ikiz duruyor");
    await must("pasife al", ctx.api.put(`${ACC}/${busy.id}`, { status: "passive" }));
    const res = await assertRefused(ctx, "pasif hareketli", busy.id, { entries: 1 }, { passive: true });
    assert.match(res.error, /cari zaten pasif/);
    assert.doesNotMatch(res.error, /Pasife Al ile/);
  });

  it("T6 kartın neden yazısı = silme iletisi; parçalar elle sayımla; yetkisiz kullanıcıya neden gitmez", async () => {
    const many = await newAccount(ctx, "T6 Çok Hareketli");
    await entry(ctx, many.id, { kind: "debt", amount: "1.000" });
    await entry(ctx, many.id, { kind: "in", amount: "100" });
    await entry(ctx, many.id, { kind: "in", amount: "50" });
    await must("taslak", ctx.api.post("/api/workspace/invoices", { status: "draft", scenario: "service_sale", accountId: many.id, lines: [LINE] }));
    await must("kart", ctx.api.post("/api/workspace/plans", { accountId: many.id, name: "T6 Çok Hareketli", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    const res = await assertRefused(ctx, "çok hareketli", many.id, { entries: 3, invoices: 1, plans: 1 });
    assert.match(res.error, /^Bu carinin hareketi var: 3 cari hareketi, 1 fatura \/ makbuz \(taslak ve iptal dahil\), 1 taksit kartı\. /);
    await must("personel", ctx.api.post("/api/admin/users", { username: "personel249", name: "Personel", role: "personel", password: "Personel-2026!", mustChangePassword: false }));
    const client = ctx.server.client();
    assert.equal((await client.login("personel249", "Personel-2026!")).status, 200);
    const seen = await client.get(`${ACC}/${many.id}`);
    if (seen.status === 200) assert.equal(seen.data.data.deleteBlock, "", "yetkisiz kullanıcıya neden gönderilmez");
    assert.equal((await client.del(`${ACC}/${many.id}`)).status, 403, "yetkisiz silme 403 (değişmez)");
  });

  it("T7 Taksit aktarımını Geri Al: aktarımın açtığı cari yalnız gerçekten boşsa kalıcı silinir (taslak fatura, Silinenler'deki tahsilat ve fatura cariyi tutar)", async () => {
    const matrix = [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade"], ["T7 Taslaklı", "900", "3", "01.11.2026"], ["T7 Silinenli", "900", "3", "01.11.2026"], ["T7 Faturası Silinenli", "900", "3", "01.11.2026"], ["T7 Boş", "900", "3", "01.11.2026"]];
    const result = await must("Excel'den taksit yükle", ctx.api.post("/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue" }, fileName: "c1-taksit.xlsx", linkRecords: false }));
    assert.equal(result.created, 4);
    const idOf = name => ctx.store.get("SELECT id FROM accounts WHERE name = ? AND deleted_at IS NULL", name)?.id;
    const drafted = idOf("T7 Taslaklı");
    const trashed = idOf("T7 Silinenli");
    const trashedInvoice = idOf("T7 Faturası Silinenli");
    const empty = idOf("T7 Boş");
    assert.ok(drafted && trashed && trashedInvoice && empty, "aktarım dört cari açtı");
    const draft = await must("taslak", ctx.api.post("/api/workspace/invoices", { status: "draft", scenario: "service_sale", accountId: drafted, lines: [LINE] }));
    const made = await entry(ctx, trashed, { kind: "in", amount: "40" });
    await must("tahsilatı sil", ctx.api.del(`${ACC}/${trashed}/entries/${made.entryId}?cashForce=1`));
    const gone = await must("taslak (silinecek)", ctx.api.post("/api/workspace/invoices", { status: "draft", scenario: "service_sale", accountId: trashedInvoice, lines: [LINE] }));
    await must("taslağı sil", ctx.api.del(`/api/workspace/invoices/${gone.id}?reason=C1`));
    const undone = await must("geri al", ctx.api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.equal(undone.accountsKept, 3, `taslaklı, Silinenler'de tahsilatı ve faturası olan cari kalır: ${JSON.stringify(undone)}`);
    assert.equal(undone.accounts, 1, "yalnız boş cari kalıcı silinir");
    assert.ok(ctx.store.get("SELECT 1 AS f FROM accounts WHERE id = ?", drafted), "taslaklı cari duruyor");
    assert.ok(ctx.store.get("SELECT 1 AS f FROM accounts WHERE id = ?", trashed), "Silinenler'deki tahsilatın carisi duruyor");
    assert.ok(ctx.store.get("SELECT 1 AS f FROM accounts WHERE id = ?", trashedInvoice), "Silinenler'deki faturanın carisi duruyor");
    assert.equal(ctx.store.get("SELECT 1 AS f FROM accounts WHERE id = ?", empty), undefined, "boş cari kalıcı silindi");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id WHERE i.id = ? AND a.id IS NULL", draft.id).n, 0, "taslak fatura yetim kalmadı");
    // Toplu kalıcı silmenin tek geçişli Silinenler dizini (openTrashAccounts) cari başına sorguyla aynı sonucu verir (ders 47 hız düzeltmesi: davranış aynen).
    const { accountMovements, openTrashAccounts } = await import("../server/lib/account-movements.mjs");
    const trashIndex = openTrashAccounts(ctx.store);
    for (const id of [drafted, trashed, trashedInvoice, empty]) assert.deepEqual(accountMovements(ctx.store, id, { includeDeleted: true, trashIndex }), accountMovements(ctx.store, id, { includeDeleted: true }), `dizinli ve dizinsiz sayım aynı (${id})`);
    assert.equal(accountMovements(ctx.store, trashed, { includeDeleted: true }).deleted.trash, 1, "Silinenler'deki tahsilat kalıcı silmede sayılır");
    assert.equal(accountMovements(ctx.store, trashedInvoice, { includeDeleted: true }).deleted.trash, 1, "Silinenler'deki fatura kalıcı silmede sayılır");
    assert.equal(accountMovements(ctx.store, trashedInvoice).total, 0, "S1 A: Silinenler'deki fatura cari silmede sayılmaz");
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const item = trash.find(row => row.kind === "account-entry" && row.title === "T7 Silinenli");
    assert.ok(item, "tahsilat Silinenler'de");
    await must("tahsilatı geri yükle", ctx.api.post("/api/admin/trash/restore", { id: item.id }));
  });

  it("T8 yarış (§9, zorla): tahsilatın gövdesi yoldayken hareketsiz cari silinirse tahsilat YAZILMAZ (404), Kasa değişmez", async () => {
    const victim = await newAccount(ctx, "T8 Yarış Carisi");
    const cashBefore = await cashOf(ctx.api);
    const body = JSON.stringify({ kind: "in", amount: "500", date: TODAY, method: "cash" });
    const { port } = new URL(ctx.server.base);
    let removed = null;
    const reply = await new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, method: "POST", path: `${ACC}/${victim.id}/entries`, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, res => {
        let text = "";
        res.on("data", chunk => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode, text }));
      });
      req.on("error", reject);
      req.flushHeaders();
      // Başlıklar gitti, gövde yok: sunucu cariyi okudu ve gövdeyi bekliyor. Bu arada cari silinir (ön koşulun GERÇEKTEN oluştuğu görülür — ders 20).
      setTimeout(async () => {
        removed = await ctx.api.del(`${ACC}/${victim.id}`);
        req.end(body);
      }, 300);
    });
    assert.equal(removed?.status, 200, "ön koşul: cari gövde beklenirken silindi");
    assert.ok(deletedAt(ctx, victim.id), "cari silinmiş");
    const rows = ctx.store.all("SELECT kind, amount FROM account_entries WHERE account_id = ?", victim.id);
    assert.deepEqual(rows.map(row => ({ ...row })), [], "silinmiş cariye tahsilat yazılmamalı");
    assert.equal(reply.status, 404, `tahsilat reddedilir: ${reply.text.slice(0, 160)}`);
    assert.equal(await cashOf(ctx.api), cashBefore, "Kasa değişmez");
  });
});

// Eski sürüm / elle düzenleme benzetimi: store dışı doğrudan yazılmış satırlar mutabakat kapısını bozar (sonraki her yazım reddedilir), bu yüzden ayrı
// sunucuda ve satırlar yazıldıktan sonra yalnız okuma + silme denemesi.
describe("2.4.9 C1 — kaynağı olmayan (yetim) satırlar da hareket", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => ctx?.server.close());

  it("T1 faturası olmayan cari satırı ve faturası olmayan mahsup fişi tek başına cariyi korur", async () => {
    const orphanEntry = await newAccount(ctx, "T1 Yetim Satırlı");
    const orphanOffset = await newAccount(ctx, "T1 Yetim Mahsuplu");
    rawRun(ctx.db, "INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, method, created_by, created_at) VALUES (?, ?, 'debt', 75, ?, 'yetim', 'invoice', 'olmayan-fatura', 'cash', 'eski', ?)", `aentry-yetim-${orphanEntry.id.slice(-8)}`, orphanEntry.id, TODAY, NOW);
    rawRun(ctx.db, "INSERT INTO invoice_offsets (id, account_id, invoice_id, counter_type, counter_id, amount, date, note, created_by, created_at) VALUES (?, ?, 'olmayan-fatura', 'entry', 'olmayan-satir', 10, ?, '', 'eski', ?)", `offset-yetim-${orphanOffset.id.slice(-8)}`, orphanOffset.id, TODAY, NOW);
    const outcomes = [];
    await check(outcomes, "kaynağı olmayan (yetim) cari satırı", () => assertRefused(ctx, "yetim satır", orphanEntry.id, { entries: 1 }));
    await check(outcomes, "faturası olmayan mahsup fişi", () => assertRefused(ctx, "yetim mahsup", orphanOffset.id, { offsets: 1 }));
    verdict("T1 yetim", outcomes);
  });
});

describe("2.4.9 C1 — banka ve POS: hesaba bağlı tahsilat, POS İptal İadesi fişi (H14)", () => {
  let ctx;
  let acc;
  let pos;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id));
  });

  it("T2 banka hesabına bağlı tahsilat: aynı kural, tek kod", async () => {
    const linked = await newAccount(ctx, "T2 Havaleli");
    await entry(ctx, linked.id, { kind: "in", amount: "800", method: "bank", bankAccountId: acc.ziraat.id });
    await assertRefused(ctx, "banka hesabına bağlı tahsilat", linked.id, { entries: 1 });
  });

  it("T1 POS'lu faturası silinmiş (Müşteriye İade Edildi) caride yalnız POS İptal İadesi fişi kalır: yine hareket (İLKEYLE H14)", async () => {
    const buyer = await newAccount(ctx, "T1 POS İadeli");
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "C1P", name: "C1 POS Ürünü", unit: "Adet", openingQty: "10" }));
    const invoice = await must("POS'lu fatura", posInvoice(ctx.api, { accountId: buyer.id, itemId: item.id, name: "C1 POS Ürünü", qty: 1, unitPrice: 1200, date: TODAY, posId: pos.id }));
    // Provizyon günü geçince silme İptal İadesi yapar (aynı gün void olur; pos.mjs). Bu describe'ın son testi: saat geri alınmaz.
    ctx.server.clock.set("2026-10-09T10:00:00+03:00");
    await must("faturayı sil (Müşteriye İade Edildi)", ctx.api.del(`/api/workspace/invoices/${invoice.id}?reason=C1`));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'pos_cancel_refund' AND party_id = ?", buyer.id).n, 1, "POS İptal İadesi fişi carinin");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", buyer.id).n, 0, "carinin satırı kalmadı");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE account_id = ?", buyer.id).n, 0, "fatura Silinenler'de");
    await assertRefused(ctx, "POS İptal İadesi fişi", buyer.id, { vouchers: 1 });
  });
});

describe("2.4.9 C1 — kilitli dönem ve iki şirket", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW, maxCompanies: 2 });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => ctx?.server.close());

  it("T5 iki şirket: 002'deki hareketli cari silinmez, 001'deki aynı adlı hareketsiz cari silinir", async () => {
    const created = await must("002", ctx.api.post("/api/companies", { name: "C1 İkinci Şirket", select: false }));
    const second = created.company || created;
    const q = `hofCompany=${encodeURIComponent(second.id)}`;
    const there = await must("002 cari", ctx.api.post(`${ACC}?${q}`, { name: "Ortak Cari", type: "customer", registeredOn: "2026-09-01" }));
    await must("002 tahsilat", ctx.api.post(`${ACC}/${there.id}/entries?${q}`, { kind: "in", amount: "250", date: TODAY, method: "cash" }));
    const here = await newAccount(ctx, "Ortak Cari");
    const refused = await ctx.api.del(`${ACC}/${there.id}?${q}&cashForce=1`);
    assert.equal(refused.status, 409, `002 hareketli cari: ${refused.status} ${JSON.stringify(refused.data).slice(0, 160)}`);
    assert.equal(refused.code, "account-has-movements");
    assert.deepEqual(refused.data.counts, { ...ZERO, entries: 1 });
    await assertDeleted(ctx, "001 hareketsiz aynı adlı", here.id);
    const card = await must("002 kart", ctx.api.get(`${ACC}/${there.id}?${q}`));
    assert.equal(card.status, "active", "002 carisi duruyor");
  });

  it("T5 kilitli dönem: hareketli cari kilitliyken de account-has-movements (kilidi açmak silmeye yetmez); hareketsiz cari kilitliyken silinir", async () => {
    const locked = await newAccount(ctx, "T5 Kilitli Hareketli");
    await entry(ctx, locked.id, { kind: "debt", amount: "1.000", date: "2026-09-15" });
    const idle = await newAccount(ctx, "T5 Kilitli Hareketsiz");
    await must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
    try {
      const res = await assertRefused(ctx, "kilitli dönemde hareketli", locked.id, { entries: 1 });
      assert.doesNotMatch(res.error, /dönem kilidini açmalı/, "kilit açma yönlendirmesi yok");
      await assertDeleted(ctx, "kilitli dönemde hareketsiz", idle.id);
    } finally {
      await must("kilidi aç", ctx.api.put("/api/admin/period-lock", { lockedUntil: "" }));
    }
    await assertRefused(ctx, "kilit açıkken hareketli", locked.id, { entries: 1 });
  });
});

const OLD = "v2.4.7";
describe("2.4.9 C1 — gerçek eski sürüm verisi (v2.4.7 kodu; S3 A): orada silinmiş hareketli cari geri yüklenir, sonra silinemez", { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok (git fetch --tags)` }, () => {
  it("T4 v2.4.7'de silinen tahsilatlı cari güncel kodda Silinenler'de; geri yüklenince Kasa geri gelir; yeniden silme 409", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "cari-hareket-249-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let accountId = "";
    try {
      const oldServer = await bootVersion(OLD, { ...dirs, now: NOW });
      try {
        const api = await oldServer.login();
        await must("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
        const account = await must("cari", api.post(ACC, { name: "Eski Sürüm Carisi", type: "customer", registeredOn: "2026-09-01" }));
        accountId = account.id;
        await must("tahsilat", api.post(`${ACC}/${account.id}/entries`, { kind: "in", amount: "400", date: TODAY, method: "cash" }));
        await must("v2.4.7 siliyor (C1 öncesi)", api.del(`${ACC}/${account.id}`));
      } finally {
        await oldServer.close();
      }
      const server = await bootVersion(CURRENT, { ...dirs, now: NOW });
      try {
        const api = await server.login();
        const ctx = { api, store: server.app.store, db: server.app.db };
        const trash = await must("Silinenler", api.get("/api/admin/trash"));
        assert.ok(trash.some(item => item.id === `account:${accountId}`), "eski silinmiş cari Silinenler'de (S3 A: dokunulmaz)");
        const before = await cashOf(api);
        await must("geri yükle", api.post("/api/admin/trash/restore", { id: `account:${accountId}` }));
        assert.equal(await cashOf(api), before + 400, "tahsilat Kasa'ya geri gelir");
        await assertRefused(ctx, "v2.4.7'den gelen geri yüklenmiş cari", accountId, { entries: 1 });
      } finally {
        await server.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
