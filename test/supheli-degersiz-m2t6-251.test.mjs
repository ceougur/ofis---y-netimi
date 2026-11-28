// 2.5.1 M2 tur 6 — Değersiz Alacak sınırı (para çekirdeği): dar kontrol DK-M2T5 ORTA-1 — Alış Faturası Düzenle'de peşin ödemenin düşürülmesi / kaldırılması.
// KARARLAR (AYNEN; görev metni docs/devir/2.5.1-DEVAM/m2t6-istem.txt):
//   SK-64 = A (28.11 06:13 UTC — KULLANICI KARARIYLA ÖNERİ UYGULANDI, 20:26 yetkisi): "Değersiz Alacak satırı olan caride Ödeme satırının silinmesi ya da Alacak Yaz tutarının artırılması cariyi
//     eksiye götürüyorsa … A (ÖNERİ; uygulanacak): reddedilsin (S-M2T2-1 / S-DKM2T3-1 ile aynı kural) … Öneri A: Değersiz'li caride eksiye götüren her kayıt değişikliği tek kural."
//   BAŞ MİMAR KARARI 28.11 11:55 UTC (1): "ORTA-1 → DEĞERSİZ TUR 6 (… alış faturasında cari değişmiyorsa denetim tutar koşulsuz kurulur — denetim zaten yalnız 'bakiye düştü ve eksi' iken
//     reddeder; iletinin sözü 'alış faturasının düzenlenmesi'; net 0 / tutar artışı / eksiye düşmeyen azaltma KABUL kalır — testte)."
// ELLE BEKLENEN SAYILAR (kurallardan; ders 5 — rapor §0 'NASIL BOZULUR' tablosu):
//   Taban T = Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 · Değersiz 3.000 @17.09 → bakiye 423,55.
//   Dar kontrolün vakası AYNEN: T + Alış 500 + peşin ödeme 500 (01.10) → 423,55; + bağsız tahsilat 1.000 (05.10; avans — kabul) → −576,45.
//     Peşin 500 → 100: −976,45 olurdu → RET (−576,45 kalır); peşin kaldırıldı: −1.076,45 olurdu → RET. Peşin 500 → 600: −476,45 (bakiye yükselir) → kabul.
//     Tutar 500 → 100 + peşin kaldırıldı: −576,45 + 400 − 500 = −676,45 → RET; tutar 500 → 100 + peşin 500 → 100: −576,45 (aynı) → kabul.
//   Avanssız: T + Alış 500 + peşin 500 → 423,55; peşin → 100: 23,55 kabul; → 76,45: TAM 0 kabul; → 76,44: −0,01 RET.
//   B4 (net 0): T + Alış 100 → 323,55; Düzenle 1.100 + peşin 1.000 → 323,55 kabul.
//   İleti sözü (Değersiz olmasaydı da eksi kalan durumda görünür): T + Alış 5.000 + peşin 5.000 → 423,55; peşin kaldırılırsa −4.576,45; Değersiz'siz −1.576,45 → 'alış faturasının düzenlenmesi'.
// Sahte saat 15.10.2026 (ders 13), akan saat; iki saat diliminde koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";

const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const WHERE = "cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi";

async function boot() {
  const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const api = apiOf(await loginAdmin(server));
  await api.post("/api/workspace/bank/setup/dismiss", {});
  return { server, api, store: server.app.store };
}
let phone = 0;
const nextPhone = prefix => `0500 ${prefix} ${String((phone += 1) % 100).padStart(2, "0")} ${String(Math.floor(phone / 100)).padStart(2, "0")}`;
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const balanceOf = async (api, party) => (await must("kart", api.get(`${ACC}/${party}`))).totals.balance;
const writeOffsOf = async (api, party, did) => (await must("liste", api.get(`${ACC}/${party}/doubtful`))).records.find(item => item.id === did)?.writeOffs || [];

async function base(api, name, { writeOff = true } = {}) {
  const a = await must("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("472") }));
  const inv = await must("fatura", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
  await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  await must("bağlı", api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id)));
  const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  if (writeOff) await must("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  return { a, inv, s };
}
async function deleteWriteOffs(api, party, did) {
  for (const line of await writeOffsOf(api, party, did)) await must("Değersiz satırını sil", api.del(`${ACC}/${party}/doubtful/${did}/write-offs/${line.entryId}`));
}
// Alış Faturası gövdesi (dar kontrolün betiğindeki biçim AYNEN): tutar + peşin nakit ödeme satırları.
const purchaseBody = (party, number, price, cash, { date = "2026-10-01", item = null, accountId = party } = {}) => ({
  scenario: item ? "goods_purchase" : "expense_purchase",
  accountId,
  number,
  issueDate: date,
  lines: [item ? { itemId: item, qty: 1, unitPrice: String(price), vatRate: 0 } : { name: "Gider", qty: 1, unitPrice: String(price), vatRate: 0, expense: "rent" }],
  payment: { cash: cash.map(amount => ({ amount, method: "cash" })), cheques: [], endorse: [], rest: "open" },
  cashForce: true,
  force: { cash: true, negative: true, similar: true },
});
// Ret iletisinin dört alanı: ne oldu (tarih + tutar + sonuç bakiye), neden, ne yapmalı, güvence.
function assertRefusal(r, after) {
  assert.equal(r.status, 409, `${r.status} ${r.error}`);
  assert.equal(r.code, "doubtful-writeoff-balance", r.error);
  assert.ok(r.error.startsWith(`Alış faturası düzenlenemez: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı var; düzenlemeden sonra cari ${after} TL alacaklı (eksi bakiye) olurdu. `), r.error);
  assert.ok(!r.error.includes("tutarının artırılması"), `ileti hâlâ 'tutarının artırılması' diyor: ${r.error}`);
  assert.ok(r.error.includes(`Önce Değersiz Alacak satırını silin (${WHERE})`.replace("Önce", r.data.recordFirst ? "Önce" : "önce")), r.error);
  assert.ok(r.error.includes("sonra faturayı düzenleyin"), r.error);
  assert.ok(r.error.endsWith("Hiçbir şey kaydedilmedi."), r.error);
}
// Ret atomik mi: faturanın satırı ve kalemleri, carinin bütün hareketleri, işlem başlıkları, Değişiklik Geçmişi ve Silinenler bayt bayt.
const snapshot = (store, party, invoiceId) => JSON.stringify({
  inv: store.all("SELECT * FROM invoices WHERE id = ?", invoiceId),
  lines: store.all("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY rowid", invoiceId),
  entries: store.all("SELECT * FROM account_entries WHERE account_id = ? ORDER BY id", party),
  events: store.all("SELECT * FROM fin_events ORDER BY rowid"),
  audit: store.get("SELECT COUNT(*) AS n FROM audit_events").n,
  trash: store.all("SELECT * FROM trash ORDER BY rowid"),
});
const payableOf = (store, id) => Number(store.get("SELECT payable_total AS p FROM invoices WHERE id = ?", id).p);
const cashOf = (store, id) => store.all("SELECT amount FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out' ORDER BY rowid", id).map(row => Number(row.amount));

describe("2.5.1 M2 tur 6 — ORTA-1: Alış Faturası Düzenle'de peşin ödeme düşürülür / kaldırılırsa Değersiz'li cari eksiye inmez (tutar koşulsuz denetim)", () => {
  // Dar kontrolün vakaları AYNEN (a-yollar.mjs A1 / A2).
  it("tutar aynı, peşin 500 → 100 ve peşin kaldırıldı → 409 'Alış faturası düzenlenemez', −576,45 kalır, ret atomik; ileti yolu izlenince kabul", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T6 Peşin");
      const p = await must("alış 500 + peşin 500", api.post(INV, purchaseBody(b.a.id, "ALS-T6A", 500, [500])));
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      await must("avans 1.000", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      const before = snapshot(store, b.a.id, p.id);
      const r1 = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6A", 500, [100]));
      assertRefusal(r1, "976,45");
      assert.equal(snapshot(store, b.a.id, p.id), before, "ret atomik değil (peşin 500 → 100)");
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      const r2 = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6A", 500, []));
      assertRefusal(r2, "1.076,45");
      assert.equal(snapshot(store, b.a.id, p.id), before, "ret atomik değil (peşin kaldırıldı)");
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      assert.deepEqual([payableOf(store, p.id), cashOf(store, p.id)], [500, [500]]);
      assert.equal((await integrityOf(api)).ok, true);
      // İleti yolu: Değersiz satırı silinir → aynı Düzenle kabul (−576,45 + 3.000 − 500 = 1.923,55).
      await deleteWriteOffs(api, b.a.id, b.s);
      assert.equal(await balanceOf(api, b.a.id), 2423.55);
      await must("ileti yolu: peşin kaldırıldı", api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6A", 500, [])));
      assert.equal(await balanceOf(api, b.a.id), 1923.55);
      assert.deepEqual(cashOf(store, p.id), []);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("tutar 500 → 100 ve peşin kaldırıldı (bakiye yine düşer: −676,45) → 409; tutar 500 → 100 ve peşin 500 → 100 (net 0) kabul; peşin artışı (bakiye yükselir) kabul", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T6 Tutar Düşer");
      const p = await must("alış 500 + peşin 500", api.post(INV, purchaseBody(b.a.id, "ALS-T6B", 500, [500])));
      await must("avans 1.000", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      const before = snapshot(store, b.a.id, p.id);
      const r = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6B", 100, []));
      assertRefusal(r, "676,45");
      assert.equal(snapshot(store, b.a.id, p.id), before, "ret atomik değil (tutar düştü, peşin kaldırıldı)");
      await must("tutar 100 + peşin 100 (net 0)", api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6B", 100, [100])));
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      assert.deepEqual([payableOf(store, p.id), cashOf(store, p.id)], [100, [100]]);
      // Peşin artışı (100 → 100 tutarlı faturada yapılamaz) — ayrı fatura: 500 + peşin 500 → peşin 600 değil, tutar 600 + peşin 600 bakiyeyi değiştirmez; peşin artışı için tutar aynı kalıp
      // peşin < tutar olan fatura: 800 + peşin 300 → peşin 700 (bakiye +400 yükselir, eksi kalsa da kabul).
      const q = await must("alış 800 + peşin 300", api.post(INV, purchaseBody(b.a.id, "ALS-T6C", 800, [300])));
      assert.equal(await balanceOf(api, b.a.id), -1076.45);
      await must("peşin 300 → 700 (bakiye yükselir)", api.post(`${INV}/${q.id}/edit`, purchaseBody(b.a.id, "ALS-T6C", 800, [700])));
      assert.equal(await balanceOf(api, b.a.id), -676.45);
      // Yalnız tarih / numara değişir (tutar ve peşin aynı) — bakiye aynı → kabul.
      await must("tarih 01.10 → 03.10", api.post(`${INV}/${q.id}/edit`, purchaseBody(b.a.id, "ALS-T6C", 800, [700], { date: "2026-10-03" })));
      assert.equal(await balanceOf(api, b.a.id), -676.45);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("avanssız: peşin 500 → 100 (23,55) ve → 76,45 (TAM 0) kabul; → 76,44 (−0,01) 409", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T6 Tam Sıfır");
      const p = await must("alış 500 + peşin 500", api.post(INV, purchaseBody(b.a.id, "ALS-T6D", 500, [500])));
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      await must("peşin → 100", api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6D", 500, [100])));
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      await must("peşin 500 → 76,45 (tam 0)", api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6D", 500, ["76,45"])));
      assert.equal(await balanceOf(api, b.a.id), 0);
      const before = snapshot(store, b.a.id, p.id);
      const r = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6D", 500, ["76,44"]));
      assertRefusal(r, "0,01");
      assert.equal(snapshot(store, b.a.id, p.id), before);
      assert.equal(await balanceOf(api, b.a.id), 0);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  // B4 (dar kontrolün b-ek.mjs'i AYNEN): net 0 kabul.
  it("B4: tutar 100 → 1.100 + peşin 1.000 (net 0) kabul, 323,55 kalır", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T6 Net Sıfır");
      const p = await must("alış 100", api.post(INV, purchaseBody(b.a.id, "ALS-T6E", 100, [])));
      assert.equal(await balanceOf(api, b.a.id), 323.55);
      await must("100 → 1.100 + peşin 1.000", api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6E", 1100, [1000])));
      assert.equal(await balanceOf(api, b.a.id), 323.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("ileti sözü 'alış faturasının düzenlenmesi' (Değersiz olmasaydı da eksi kalan durumda) — peşin kaldırma da tutar artışı da", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T6 İleti");
      const p = await must("alış 5.000 + peşin 5.000", api.post(INV, purchaseBody(b.a.id, "ALS-T6F", 5000, [5000])));
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      const r = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6F", 5000, []));
      assertRefusal(r, "4.576,45");
      assert.ok(r.error.includes("Değersiz Alacak satırı olan caride alış faturasının düzenlenmesi cariyi alacaklıya (eksi bakiyeye) götüremez; Değersiz Alacak satırı olmasaydı da cari 1.576,45 TL alacaklı olurdu"), r.error);
      // Tutar artışında da aynı söz: 5.000 → 9.000 (peşin 5.000 aynı) → 423,55 − 4.000 = −3.576,45; Değersiz'siz −576,45.
      const r2 = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6F", 9000, [5000]));
      assertRefusal(r2, "3.576,45");
      assert.ok(r2.error.includes("caride alış faturasının düzenlenmesi cariyi alacaklıya (eksi bakiyeye) götüremez; Değersiz Alacak satırı olmasaydı da cari 576,45 TL alacaklı olurdu"), r2.error);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
    } finally {
      server.close();
    }
  });
  it("Stoğa Mal Alışı (aynı tür, aynı Düzenle yolu): peşin kaldırılırsa 409, stok ve cari değişmez", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T6 Stok Alış");
      const item = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "T6G", name: "Ürün T6G", unit: "Adet" }));
      const p = await must("mal alışı 500 + peşin 500", api.post(INV, purchaseBody(b.a.id, "ALS-T6G", 500, [500], { item: item.id })));
      await must("avans 1.000", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      const before = snapshot(store, b.a.id, p.id);
      const r = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6G", 500, [], { item: item.id }));
      assertRefusal(r, "1.076,45");
      assert.equal(snapshot(store, b.a.id, p.id), before);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 6 — yanlış yere düşmüyor: Değersiz'siz / Değersiz'i silinmiş cari, cari değişimi, iptal, dönem kilidi", () => {
  it("Değersiz satırı HİÇ olmayan carinin (Şüpheli kayıt var) ve Değersiz satırı silinmiş carinin peşin kaldırması kabul", async () => {
    const { server, api } = await boot();
    try {
      for (const [name, writeOff] of [["M2T6 Değersizsiz", false], ["M2T6 Değersiz Silinmiş", true]]) {
        const b = await base(api, name, { writeOff });
        if (writeOff) await deleteWriteOffs(api, b.a.id, b.s);
        const start = await balanceOf(api, b.a.id);
        assert.equal(start, 3423.55);
        const p = await must("alış 4.000 + peşin 4.000", api.post(INV, purchaseBody(b.a.id, `ALS-T6H${writeOff ? 1 : 0}`, 4000, [4000])));
        await must("avans 3.500", api.post(`${ACC}/${b.a.id}/entries`, pay("3500", "2026-10-05")));
        assert.equal(await balanceOf(api, b.a.id), -76.45);
        await must(`${name}: peşin kaldırıldı`, api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, `ALS-T6H${writeOff ? 1 : 0}`, 4000, [])));
        assert.equal(await balanceOf(api, b.a.id), -4076.45);
      }
    } finally {
      server.close();
    }
  });
  it("cari değişimi (Değersiz'li A'dan B'ye) tur 5 davranışı AYNEN: kabul; A'nın bakiyesi yükselir", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T6 Cari A");
      const other = await must("cari B", api.post(ACC, { name: "M2T6 Cari B", type: "supplier", registeredOn: "2026-09-01", phone: nextPhone("473") }));
      const p = await must("alış 500 + peşin 200", api.post(INV, purchaseBody(b.a.id, "ALS-T6I", 500, [200])));
      await must("avans 1.000", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
      assert.equal(await balanceOf(api, b.a.id), -876.45);
      await must("cari A → B", api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6I", 500, [200], { accountId: other.id })));
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      assert.equal(await balanceOf(api, other.id), -300);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("alış faturası iptali (peşinli ve peşinsiz) kabul — iptal bakiyeyi düşürmez", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T6 İptal");
      const p = await must("alış 500 + peşin 500", api.post(INV, purchaseBody(b.a.id, "ALS-T6J", 500, [500])));
      const q = await must("alış 300 açık", api.post(INV, purchaseBody(b.a.id, "ALS-T6K", 300, [])));
      await must("avans 1.000", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
      assert.equal(await balanceOf(api, b.a.id), -876.45);
      await must("peşinli iptal", api.post(`${INV}/${p.id}/cancel`, { reason: "test" }));
      assert.equal(await balanceOf(api, b.a.id), -876.45);
      await must("peşinsiz iptal", api.post(`${INV}/${q.id}/cancel`, { reason: "test" }));
      assert.equal(await balanceOf(api, b.a.id), -576.45);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("dönem kilidi faturanın tarihini kapsıyorsa kilit iletisi Değersiz iletisinden ÖNCE gelir", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T6 Kilit");
      const p = await must("alış 500 + peşin 500", api.post(INV, purchaseBody(b.a.id, "ALS-T6L", 500, [500])));
      await must("avans 1.000", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
      await must("kilit 01.10", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-01" }));
      const r = await api.post(`${INV}/${p.id}/edit`, purchaseBody(b.a.id, "ALS-T6L", 500, []));
      assert.equal(r.status, 409, r.error);
      assert.notEqual(r.code, "doubtful-writeoff-balance", r.error);
      assert.match(r.error, /kilit/i, r.error);
      assert.equal(await balanceOf(api, b.a.id), -576.45);
    } finally {
      server.close();
    }
  });
});
