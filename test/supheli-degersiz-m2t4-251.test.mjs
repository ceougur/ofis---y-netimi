// 2.5.1 M2 tur 4 — Değersiz Alacak sınırı (para çekirdeği): dar kontrol DK-M2T3'ün iki ORTA'sı + S-DKM2T3-1 = A + DÜŞÜK-1 / DÜŞÜK-2.
// KARARLAR (AYNEN; iş listesi C / D, görev metni docs/devir/2.5.1-DEVAM/m2t4-istem.txt):
//   S270 = A değişmezi: "hiçbir sırada bir şüpheli kaydın Değersiz toplamı, o kayda şüpheliye alınan tutardan kayda düşmüş tahsilatlar çıkınca kalanı aşamaz; Değersiz yazımı cariyi alacaklıya
//     (eksi bakiyeye) düşürmez." Baş mimar okuması §2.4: "ipucu ve önerilen tutar bu reddi de bilir — ekranın önerdiği tutar ve tarih HER ZAMAN kabul edilir."
//   S-DKM2T3-1 = A (28.11 04:49 UTC — KULLANICI KARARIYLA ÖNERİ UYGULANDI, 20:26 yetkisi): "Borç Yaz silme / düzeltmesi de aynı kuralla reddedilsin — bakiye 423,55 kalır, ileti aynı dört
//     alanlı düzende … taksit kartı silme de aynı sınıf — ölçülür, aynı kuralla ele alınır".
//   BAŞ MİMAR KARARI 28.11 04:49 UTC: ORTA-1 hız (Silinenler taraması), ORTA-2 (önerilen tutar her zaman kabul), DÜŞÜK-1 ('ne yapmalı' S155 de engelliyorsa başka yol), DÜŞÜK-2 (M8 sınıfına kalıcı test).
// ELLE BEKLENEN SAYILAR (kurallardan; ders 5):
//   Taban T = Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 · Değersiz 3.000 @17.09 → bakiye 6.300 − 2.876,45 − 3.000 = 423,55.
//   Borç Yaz 3.400 silinirse 423,55 − 3.400 = −2.976,45 (RET → 423,55 kalır); 100'e düşerse −2.876,45 (RET); 3.500'e çıkarsa 523,55; 3.000'e düşerse 23,55 (eksi değil → kabul); Alacak'a
//   çevrilirse 423,55 − 6.800 = −6.376,45 (RET). Taksit kartı 3.400 (Borç Yaz yerine) aynı sayılar.
//   ORTA-2 (dar kontrolün d-oneri-ret vakası, tohum 37 / cari 2'den küçültülmüş): Fatura 1.500 (14.09) + Borç 3.400 (12.09) = 4.900; S1 500 @01.10; bağlı 1.327,19 + 122,85 + 168,48 @01.10;
//   Değersiz 500 @15.10 (S1; sil → bağlı 501,63 @14.09 → Silinenler'den geri yükle); bakiye 4.900 − 2.120,15 − 500 = 2.279,85; S2 1.500 @19.09 (Şüpheliye Al).
//   S2'nin Değersiz'i 1.500 @19.09: S2'ye o tarihten sonra hiçbir tahsilat bağlanmadan şüpheliye alındı → kalanı 1.500; bakiye 2.279,85 ≥ 1.500 → form 1.500 önerir. S1'in Değersiz 500'ü
//   YAZILDIĞI ANDA S2 yoktu (S1 kalanı 500 — sığar); 1.500 yazıldıktan sonraki hâlde de S1'e düşen tahsilat değişmez (S1 kalanı 500 — sığar) → S270 hiçbir sırada bozulmaz → 1.500 KABUL,
//   bakiye 779,85. (Tabanda 409 "… 500,00 TL Değersiz Alacak satırı şüpheli kaydın kalanını aşar … en çok 400,00" — S1'in yazıldığı andaki dünyası S2'nin SONRADAN yazılan Değersiz satırını
//   kuyruktan okuyordu.)
//   M8 sınıfı (DÜŞÜK-2; dar kontrolün e-m8 vakaları): Fatura 2.900 (13.09) + Borç 1.000 (12.09) = 3.900; S 3.000 @17.09; aynı gün, kayıttan SONRA bağlı 2.876,45 → bakiye 1.023,55. Değersiz
//   @17.09: S264 → o günün bağlı payı Değersiz'den SONRA sayılır → kalan 3.000; bakiye sınırı 1.023,55 → sınır 1.023,55; S155: yazımdan sonra borç 0, kaydın kalanına (1.976,45) aynı günün bağlı
//   tahsilatı düşer → açık şüpheli 0 → öneri 1.023,55, yazımdan sonra bakiye 0. (M8 mutantı aynı günün kesitini önceki günden okur → öneri 23,55.)
//   İkinci vaka: bağlı 1.000 (aynı gün, kayıttan sonra) + 20.09 bağlı 200 → bakiye 2.700 → sınır ve öneri 2.700, sonra bakiye 0 (M8: öneri 1.900).
// Sahte saat 15.10.2026 (ders 13), akan saat; iki saat diliminde koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";
import * as D from "../server/lib/bank/doubtful.mjs";

const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const PLANS = "/api/workspace/plans";
const WHERE = "cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi";
const RECORD_WHERE = "cari kartı → Şüpheli Alacak → kaydın satırındaki × düğmesi";

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
const balanceOf = async (api, party) => (await must("kart", api.get(`${ACC}/${party}`))).totals.balance;
const tlText = minor => (minor / 100).toFixed(2).replace(".", ",");
const writeOffsOf = async (api, party, did) => (await must("liste", api.get(`${ACC}/${party}/doubtful`))).records.find(item => item.id === did)?.writeOffs || [];

// Taban T; debtCard: Borç Yaz yerine 3.400'lük taksit kartı.
async function base(api, name, { debtCard = false, writeOff = true } = {}) {
  const a = await must("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("461") }));
  const inv = await must("fatura", api.post(INV, saleBody(a.id, 2900)));
  let debt = null;
  if (debtCard) debt = (await must("kart", api.post(PLANS, { accountId: a.id, name: "Kart", total: 3400, registeredOn: "2026-09-12", installments: { count: 2, firstDue: "2026-11-01", everyMonths: 1 } }))).id;
  else {
    await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  }
  await must("bağlı", api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id)));
  const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  if (writeOff) await must("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  return { a, inv, s, debt };
}
const debtIdOf = (store, party) => store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'debt' AND source = '' ORDER BY created_at DESC, rowid DESC LIMIT 1", party).id;
const plainTail = (error, then) => {
  assert.ok(error.includes(`Ne yapmalı: önce Değersiz Alacak satırını silin (${WHERE}), sonra ${then}; gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir).`), error);
  assert.ok(error.endsWith("Hiçbir şey kaydedilmedi."), error);
};
const heldTail = (error, then) => {
  assert.ok(error.includes("Ne yapmalı: Değersiz Alacak satırını silmek yetmez — "), error);
  assert.ok(error.includes(`Önce Değersiz Alacak satırını silin (${WHERE}), sonra şüpheli alacak kaydını silin (${RECORD_WHERE}) ya da Şüpheliden Çıkar ile çıkarın, sonra ${then}; alacak hâlâ şüpheliyse kalan borç için yeniden Şüpheliye Alın.`), error);
  assert.ok(error.endsWith("Hiçbir şey kaydedilmedi."), error);
};
async function deleteWriteOffs(api, party, did) {
  for (const line of await writeOffsOf(api, party, did)) await must("Değersiz satırını sil", api.del(`${ACC}/${party}/doubtful/${did}/write-offs/${line.entryId}`));
}

describe("2.5.1 M2 tur 4 — ORTA-2: formun önerdiği Değersiz tutarı kapıda reddedilmez (S270 'hiçbir sırada'; öneri her zaman kabul)", () => {
  async function scenario(api, name, { restore }) {
    const a = await must("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("462") }));
    const inv = await must("fatura 1.500", api.post(INV, saleBody(a.id, 1500, { date: "2026-09-14" })));
    await must("borç 3.400", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
    const s1 = (await must("S1", api.post(`${ACC}/${a.id}/doubtful`, { amount: "500", date: "2026-10-01", reason: "lawsuit" }))).record.id;
    for (const amount of ["1327,19", "122,85", "168,48"]) await must(`bağlı ${amount}`, api.post(`${ACC}/${a.id}/entries`, pay(amount, "2026-10-01", inv.id)));
    if (restore) {
      await must("Değersiz 500 (S1)", api.post(`${ACC}/${a.id}/doubtful/${s1}/write-off`, { amount: "500", date: "2026-10-15" }));
      const line = (await writeOffsOf(api, a.id, s1)).at(-1);
      await must("Değersiz satırını sil", api.del(`${ACC}/${a.id}/doubtful/${s1}/write-offs/${line.entryId}`));
      await must("bağlı 501,63 @14.09", api.post(`${ACC}/${a.id}/entries`, pay("501,63", "2026-09-14", inv.id)));
      const item = (await must("Silinenler", api.get("/api/admin/trash"))).find(x => x.kind === "doubtful-writeoff" && x.ref === line.entryId);
      await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    } else {
      await must("bağlı 501,63 @14.09", api.post(`${ACC}/${a.id}/entries`, pay("501,63", "2026-09-14", inv.id)));
      await must("Değersiz 500 (S1)", api.post(`${ACC}/${a.id}/doubtful/${s1}/write-off`, { amount: "500", date: "2026-10-15" }));
    }
    const s2 = (await must("S2 1.500 @19.09", api.post(`${ACC}/${a.id}/doubtful`, { amount: "1500", date: "2026-09-19", reason: "lawsuit" }))).record.id;
    return { a, s1, s2 };
  }
  for (const restore of [true, false]) {
    it(`dar kontrolün vakası (${restore ? "S1'in Değersiz satırı Silinenler'den geri yüklenmiş" : "doğrudan yazılmış"}): S2 için öneri 1.500 @19.09 → yazım 200, bakiye 779,85, Mutabakat tamam; 1.500,01 → ret`, async () => {
      const { server, api } = await boot();
      try {
        const { a, s2 } = await scenario(api, `M2T4 Öneri ${restore ? "Geri" : "Düz"}`, { restore });
        assert.equal(await balanceOf(api, a.id), 2279.85);
        const listed = (await must("liste", api.get(`${ACC}/${a.id}/doubtful`))).records.find(item => item.id === s2).writeOff;
        assert.deepEqual([listed.best.date, listed.best.limitMinor, listed.best.offerMinor], ["2026-09-19", 150000, 150000]);
        for (const day of ["2026-09-19", "2026-09-25"]) {
          const q = await must("form", api.get(`${ACC}/${a.id}/doubtful/${s2}/write-off?date=${day}`));
          assert.deepEqual([q.limitMinor, q.offerMinor], [150000, 150000], day);
        }
        const over = await api.post(`${ACC}/${a.id}/doubtful/${s2}/write-off`, { amount: "1500,01", date: "2026-09-19" });
        assert.equal(over.status, 400, over.error);
        assert.equal(over.code, "doubtful-writeoff-exceeds", over.error);
        const r = await api.post(`${ACC}/${a.id}/doubtful/${s2}/write-off`, { amount: tlText(listed.best.offerMinor), date: listed.best.date });
        assert.equal(r.status, 200, `önerilen tutar reddedildi: ${r.status} ${r.error}`);
        assert.equal(await balanceOf(api, a.id), 779.85);
        assert.equal((await integrityOf(api)).ok, true);
      } finally {
        server.close();
      }
    });
  }
  it("değişmez (i)'nin dünyası: S1'in Değersiz satırı, SONRA yazılan Değersiz satırını kuyruktan da okumaz (tur 3 hâli = leakLater → aynı yazım kapıda 409)", async () => {
    const { server, api, store } = await boot();
    try {
      const { a, s2 } = await scenario(api, "M2T4 Sızıntı", { restore: true });
      await must("S2 Değersiz 1.500", api.post(`${ACC}/${a.id}/doubtful/${s2}/write-off`, { amount: "1500", date: "2026-09-19" }));
      assert.deepEqual(D.writeOffInvariantProblems(store, { parties: [a.id] }), []);
      D.WRITE_OFF_TEST.leakLater = true;
      try {
        const leaked = D.writeOffInvariantProblems(store, { parties: [a.id] });
        assert.equal(leaked.length, 1, JSON.stringify(leaked));
        assert.deepEqual([leaked[0].figure.kind, leaked[0].figure.minor, leaked[0].figure.roomMinor], ["writeoff-limit", 50000, 40000]);
      } finally {
        D.WRITE_OFF_TEST.leakLater = false;
      }
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 4 — S-DKM2T3-1 = A: Değersiz satırı olan caride Borç Yaz / taksit kartı silme ya da düşürme cariyi eksiye götürüyorsa fatura iptaliyle aynı ret", () => {
  it("Borç Yaz 3.400 silme → 409 'Borç hareketi silinemez', bakiye 423,55 kalır; ileti S155'i de bilir ve izlenen yol silmeyi kabul ettirir (23,55)", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T4 Borç Sil");
      const debt = debtIdOf(store, b.a.id);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      const r = await api.del(`${ACC}/${b.a.id}/entries/${debt}`);
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.match(r.error, /^Borç hareketi silinemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; silmeden sonra cari 2\.976,45 TL alacaklı \(eksi bakiye\) olurdu\. /, r.error);
      assert.ok(r.error.includes("Değersiz Alacak yazımı cariyi alacaklıya düşüremez — bu silmeyle o kayda Değersiz Alacak yazılamazdı."), r.error);
      // Değersiz satırı silinse de borç 23,55 < açık şüpheli 123,55 (S155) → ileti şüpheli kaydın da düzeltilmesini söyler.
      assert.ok(r.error.includes("silmeden sonra carinin borcu (23,55 TL) şüpheli kaydın kalanını (123,55 TL) karşılamaz."), r.error);
      heldTail(r.error, "borç hareketini silin");
      assert.equal(r.data.balanceMinor, -297645);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      assert.equal(Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE id = ?", debt).n), 1, "borç satırı yerinde");
      // İletinin yolu: Değersiz satırını sil → şüpheli kaydı sil → borç hareketini sil → kabul.
      await deleteWriteOffs(api, b.a.id, b.s);
      const early = await api.del(`${ACC}/${b.a.id}/entries/${debt}`);
      assert.equal(early.status, 409, "yalnız Değersiz silinince S155 yine reddeder (DÜŞÜK-1'in kendisi)");
      assert.equal(early.code, "ledger-integrity", early.error);
      await must("şüpheli kaydı sil", api.del(`${ACC}/${b.a.id}/doubtful/${b.s}`));
      await must("borç hareketini sil", api.del(`${ACC}/${b.a.id}/entries/${debt}`));
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("iletinin öbür yolu: Değersiz satırını sil → Şüpheliden Çıkar → Borç Yaz'ı sil → kabul (23,55)", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T4 Borç Çıkar");
      const debt = debtIdOf(store, b.a.id);
      await deleteWriteOffs(api, b.a.id, b.s);
      await must("Şüpheliden Çıkar", api.post(`${ACC}/${b.a.id}/doubtful/${b.s}/release`, { date: TODAY }));
      await must("borç hareketini sil", api.del(`${ACC}/${b.a.id}/entries/${debt}`));
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("Borç Yaz 3.400 → 100 düzeltme → 409 'Borç hareketi düzeltilemez' (yalnız Değersiz yüzünden; ileti eski yol); izlenen yol: Değersiz satırını sil → 100 → kabul (123,55), form 123,55 önerir", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T4 Borç Düşür");
      const debt = debtIdOf(store, b.a.id);
      const r = await api.put(`${ACC}/${b.a.id}/entries/${debt}`, { kind: "debt", amount: "100", date: "2026-09-12", note: "Borç" });
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.match(r.error, /^Borç hareketi düzeltilemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; düzeltmeden sonra cari 2\.876,45 TL alacaklı \(eksi bakiye\) olurdu\. /, r.error);
      assert.ok(r.error.includes("bu düzeltmeyle o kayda en çok 123,55 TL Değersiz Alacak yazılabilirdi"), r.error);
      plainTail(r.error, "borç hareketini düzeltin");
      assert.equal(r.data.recordFirst, undefined);
      assert.equal(Number(store.get("SELECT amount FROM account_entries WHERE id = ?", debt).amount), 3400);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      await deleteWriteOffs(api, b.a.id, b.s);
      await must("borç 100", api.put(`${ACC}/${b.a.id}/entries/${debt}`, { kind: "debt", amount: "100", date: "2026-09-12", note: "Borç" }));
      assert.equal(await balanceOf(api, b.a.id), 123.55);
      const q = await must("form", api.get(`${ACC}/${b.a.id}/doubtful/${b.s}/write-off?date=2026-09-17`));
      assert.equal(q.offerMinor, 12355);
      await must("Değersiz 123,55", api.post(`${ACC}/${b.a.id}/doubtful/${b.s}/write-off`, { amount: "123,55", date: "2026-09-17" }));
      assert.equal(await balanceOf(api, b.a.id), 0);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("Borç Yaz'ı Alacak'a çevirme (−6.376,45) ve başka cariye taşıma (eski cari −2.976,45) → 409; satır değişmez", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T4 Borç Çevir");
      const debt = debtIdOf(store, b.a.id);
      const flip = await api.put(`${ACC}/${b.a.id}/entries/${debt}`, { kind: "credit", amount: "3400", date: "2026-09-12", note: "Borç" });
      assert.equal(flip.status, 409, flip.error);
      assert.equal(flip.code, "doubtful-writeoff-balance", flip.error);
      assert.ok(flip.error.includes("düzeltmeden sonra cari 6.376,45 TL alacaklı (eksi bakiye) olurdu"), flip.error);
      assert.ok(flip.error.includes("Değersiz Alacak satırı olmasaydı da cari 3.376,45 TL alacaklı olurdu"), flip.error);
      assert.ok(flip.error.includes("düzeltmeden sonra cari 3.376,45 TL alacaklı olur ve borcu şüpheli kaydın kalanını (123,55 TL) karşılamaz."), flip.error);
      const other = await must("öbür cari", api.post(ACC, { name: "M2T4 Öbür", type: "customer", registeredOn: "2026-09-01", phone: nextPhone("463") }));
      const move = await api.put(`${ACC}/${b.a.id}/entries/${debt}`, { accountId: other.id, kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
      assert.equal(move.status, 409, move.error);
      assert.equal(move.code, "doubtful-writeoff-balance", move.error);
      assert.ok(move.error.includes("düzeltmeden sonra cari 2.976,45 TL alacaklı (eksi bakiye) olurdu"), move.error);
      const row = store.get("SELECT kind, account_id AS party, amount FROM account_entries WHERE id = ?", debt);
      assert.deepEqual([row.kind, row.party, Number(row.amount)], ["debt", b.a.id, 3400]);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      assert.equal(await balanceOf(api, other.id), 0);
    } finally {
      server.close();
    }
  });
  it("bakiyeyi düşürmeyen ya da eksiye götürmeyen düzeltme kabul: 3.500 (523,55), tarih 13.09 (aynı), 3.000 (23,55); Değersiz'siz caride silme bugünkü kural (S155)", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T4 Borç Kabul");
      const debt = debtIdOf(store, b.a.id);
      await must("3.500", api.put(`${ACC}/${b.a.id}/entries/${debt}`, { kind: "debt", amount: "3500", date: "2026-09-12", note: "Borç" }));
      assert.equal(await balanceOf(api, b.a.id), 523.55);
      await must("tarih", api.put(`${ACC}/${b.a.id}/entries/${debt}`, { kind: "debt", amount: "3500", date: "2026-09-13", note: "Borç" }));
      assert.equal(await balanceOf(api, b.a.id), 523.55);
      await must("3.000", api.put(`${ACC}/${b.a.id}/entries/${debt}`, { kind: "debt", amount: "3000", date: "2026-09-13", note: "Borç" }));
      assert.equal(await balanceOf(api, b.a.id), 23.55);
      assert.equal((await integrityOf(api)).ok, true);
      const n = await base(api, "M2T4 Değersizsiz", { writeOff: false });
      const r = await api.del(`${ACC}/${n.a.id}/entries/${debtIdOf(store, n.a.id)}`);
      assert.equal(r.status, 409, r.error);
      assert.equal(r.code, "ledger-integrity", "Değersiz'siz caride yeni denetim çalışmaz; S155 bugünkü gibi");
    } finally {
      server.close();
    }
  });
  it("taksit kartı (aynı sınıf): 3.400'lük kartı silme → 409 'Taksit kartı silinemez'; tutarı 100'e düşürme → 409 'Taksit kartı düzenlenemez'; kart değişmez, bakiye 423,55", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T4 Kart", { debtCard: true });
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      const del = await api.del(`${PLANS}/${b.debt}`);
      assert.equal(del.status, 409, del.error);
      assert.equal(del.code, "doubtful-writeoff-balance", del.error);
      assert.match(del.error, /^Taksit kartı silinemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; silmeden sonra cari 2\.976,45 TL alacaklı \(eksi bakiye\) olurdu\. /, del.error);
      heldTail(del.error, "taksit kartını silin");
      const cut = await api.put(`${PLANS}/${b.debt}`, { total: 100 });
      assert.equal(cut.status, 409, cut.error);
      assert.equal(cut.code, "doubtful-writeoff-balance", cut.error);
      assert.match(cut.error, /^Taksit kartı düzenlenemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; düzenlemeden sonra cari 2\.876,45 TL alacaklı \(eksi bakiye\) olurdu\. /, cut.error);
      plainTail(cut.error, "taksit kartını düzenleyin");
      const plan = store.get("SELECT total, deleted_at AS gone FROM plans WHERE id = ?", b.debt);
      assert.deepEqual([Number(plan.total), plan.gone], [3400, null]);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      await must("kart 3.500", api.put(`${PLANS}/${b.debt}`, { total: 3500 }));
      assert.equal(await balanceOf(api, b.a.id), 523.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 4 — DÜŞÜK-1: 'ne yapmalı' S155'i de bilir; izlenen yol işlemi gerçekten kabul ettirir", () => {
  it("Düzenle 2.900 → 100: ileti şüpheli kaydı da söyler; Değersiz satırı sil → şüpheli kaydı sil → Düzenle → kabul (623,55)", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T4 Düzenle Yol");
      const r = await api.post(`${INV}/${b.inv.id}/edit`, saleBody(b.a.id, 100));
      assert.equal(r.status, 409, r.error);
      heldTail(r.error, "faturayı düzenleyin");
      await deleteWriteOffs(api, b.a.id, b.s);
      const early = await api.post(`${INV}/${b.inv.id}/edit`, saleBody(b.a.id, 100));
      assert.equal(early.status, 409, "yalnız Değersiz silinince S155 yine reddeder");
      await must("şüpheli kaydı sil", api.del(`${ACC}/${b.a.id}/doubtful/${b.s}`));
      await must("Düzenle 100", api.post(`${INV}/${b.inv.id}/edit`, saleBody(b.a.id, 100)));
      assert.equal(Number(store.get("SELECT payable_total AS p FROM invoices WHERE id = ?", b.inv.id).p), 100);
      assert.equal(await balanceOf(api, b.a.id), 623.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("Değersiz silinince geçen ret (iptal, 123,55): ileti AYNEN eski yol ve yol işe yarar", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T4 İptal Yol");
      const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" });
      assert.equal(r.status, 409, r.error);
      assert.ok(r.error.includes("bu fatura olmasaydı o kayda en çok 123,55 TL Değersiz Alacak yazılabilirdi"), r.error);
      plainTail(r.error, "faturayı iptal edin");
      await deleteWriteOffs(api, b.a.id, b.s);
      await must("iptal", api.post(`${INV}/${b.inv.id}/cancel`, { reason: "x" }));
      assert.equal(await balanceOf(api, b.a.id), 523.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 4 — DÜŞÜK-2: M8 sınıfı (aynı gün, kayıttan SONRA yazılmış bağlı tahsilat + S155) — öneri o günün kesitinden", () => {
  for (const [bound, later, limit, offer] of [["2876,45", "", 102355, 102355], ["1000", "200", 270000, 270000]]) {
    it(`Borç 1.000 + Fatura 2.900, S 3.000 @17.09, sonra aynı gün bağlı ${bound}${later ? ` + 20.09 bağlı ${later}` : ""}: @17.09 sınır ${tlText(limit)}, öneri ${tlText(offer)} → yazım 200, bakiye 0`, async () => {
      const { server, api } = await boot();
      try {
        const a = await must("cari", api.post(ACC, { name: `M2T4 M8 ${bound}`, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("464") }));
        const inv = await must("fatura", api.post(INV, saleBody(a.id, 2900, { date: "2026-09-13" })));
        await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "1000", date: "2026-09-12", note: "Borç" }));
        const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
        await must("bağlı (aynı gün, kayıttan sonra)", api.post(`${ACC}/${a.id}/entries`, pay(bound, "2026-09-17", inv.id)));
        if (later) await must("bağlı @20.09", api.post(`${ACC}/${a.id}/entries`, pay(later, "2026-09-20", inv.id)));
        const q = await must("form", api.get(`${ACC}/${a.id}/doubtful/${s}/write-off?date=2026-09-17`));
        assert.deepEqual([q.limitMinor, q.offerMinor], [limit, offer]);
        const r = await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: tlText(offer), date: "2026-09-17" });
        assert.equal(r.status, 200, r.error);
        assert.equal(await balanceOf(api, a.id), 0);
        assert.equal((await integrityOf(api)).ok, true);
      } finally {
        server.close();
      }
    });
  }
});

describe("2.5.1 M2 tur 4 — ORTA-1: değişmez (i)'nin Silinenler taraması dizinli ve tam taramayla aynı sonuç", () => {
  it("sorgu planı: iki Silinenler sorgusunda tablo baştan sona okunmaz (SCAN trash yok)", async () => {
    const { server, store } = await boot();
    try {
      assert.ok(D.WRITE_OFF_TRASH_SQL && D.WRITE_OFF_ACTIVITY_TRASH_SQL, "dizinli Silinenler sorguları yok (tur 4 öncesi kod — tam tarama)");
      for (const [sql, args] of [[D.WRITE_OFF_TRASH_SQL, ["account-x", "2026-10-15T09:00:00.000Z"]], [D.WRITE_OFF_ACTIVITY_TRASH_SQL, ["2026-10-15T09:00:00.000Z", "account-x"]]]) {
        const plan = store.all(`EXPLAIN QUERY PLAN ${sql}`, ...args).map(row => row.detail);
        assert.ok(plan.some(line => /USING (COVERING )?INDEX idx_trash_open/.test(line)), plan.join(" | "));
        assert.ok(!plan.some(line => /^SCAN trash\b/.test(line)), plan.join(" | "));
      }
    } finally {
      server.close();
    }
  });
});

// Rastgele: 'önerinin (ve altının) yazımı kabul edilir', 'sınırın 1 kuruş fazlası reddedilir', Borç Yaz silmesi kabul edildiyse cari Değersiz yüzünden eksiye düşmedi, Mutabakat her tohumun sonunda
// tamam; her adımda değişmez (i)'nin sayımı tam Silinenler taramasıyla (WRITE_OFF_TEST.fullTrash) BİREBİR (fatura silme / taslak silme / Silinenler'den geri yükleme adımları dahil).
// Dar kontrolün a-esdeger üreticisinin tek sunuculu hâli; tohum 37 dahil. M2T4_TOHUM / M2T4_CARI / M2T4_ADIM ile çoğaltılır (kanıt koşusu 40 tohum).
const SEEDS = (process.env.M2T4_TOHUM || "37,3,11").split(",").map(Number);
const CARI = Number(process.env.M2T4_CARI || 5);
const STEPS = Number(process.env.M2T4_ADIM || 20);
const mulberry = seed => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const CDAYS = ["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-22", "2026-09-25", "2026-09-28", "2026-10-01", "2026-10-03", "2026-10-05", "2026-10-08", "2026-10-10", "2026-10-12", TODAY];
const invariantText = store => {
  const run = (full, leak = false) => {
    D.WRITE_OFF_TEST.fullTrash = full;
    D.WRITE_OFF_TEST.leakLater = leak;
    try {
      return JSON.stringify(D.writeOffInvariantProblems(store));
    } finally {
      D.WRITE_OFF_TEST.fullTrash = false;
      D.WRITE_OFF_TEST.leakLater = false;
    }
  };
  return [run(false), run(true), run(false, true)];
};
// Tur 4'ün (i) dünyası düzeltmesi YALNIZ gevşetir mi (programın ürettiği sıralarda): yeni hâlin bulduğu her ihlal tur 3 hâlinde (leakLater) de vardır.
const keysOf = text => new Set(JSON.parse(text).map(item => item.key));
describe("2.5.1 M2 tur 4 — rastgele: önerinin yazımı kabul, Silinenler taraması eşdeğer, Borç Yaz silmesi eksiye götürmez", () => {
  for (const seed of SEEDS) {
    it(`tohum ${seed} (${CARI} cari × ${STEPS} adım)`, async () => {
      const { server, api, store } = await boot();
      const rand = mulberry(seed * 104729 + 3);
      const pick = list => list[Math.floor(rand() * list.length)];
      const stats = { steps: 0, writes: 0, over: 0, compared: 0, leakOnly: 0, trashInvoices: 0, invDeleted: 0, invRestored: 0, debtDeleted: 0, debtRefused: 0, negativeChecks: 0 };
      const failures = [];
      try {
        for (let c = 0; c < CARI; c += 1) {
          const a = await must("cari", api.post(ACC, { name: `M2T4 Rastgele ${seed}-${c}`, type: "customer", registeredOn: "2026-09-01", phone: nextPhone("465") }));
          const invs = [];
          // Belge numarası tarih sırasıyla (FIS serisi): ilk carinin ilk faturası 10.09, öbürleri 14.09.
          for (let i = 0; i < 1 + Math.floor(rand() * 2); i += 1) invs.push((await must("fatura", api.post(INV, saleBody(a.id, pick(["2900", "1500", "4000"]), { date: i || c ? "2026-09-14" : "2026-09-10" })))).id);
          const debtAmount = pick(["3400", "1200", "6000", "0"]);
          if (debtAmount !== "0") await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: debtAmount, date: "2026-09-12", note: "Borç" }));
          const recs = [];
          const deleted = [];
          const trashed = [];
          for (let step = 0; step < STEPS; step += 1) {
            stats.steps += 1;
            const kind = !recs.length && step >= 1 ? "take" : pick(["bound", "bound", "bound", "sameday", "free", "free", "take", "take", "write", "write", "write", "write", "partial", "partial", "over", "over", "delete", "restore", "release", "recdel", "invdel", "draftdel", "invrestore", "debtdel"]);
            const date = pick(CDAYS);
            const tag = `t${seed} c${c} s${step} ${kind}`;
            if (kind === "bound" || kind === "free" || (kind === "sameday" && recs.length)) {
              let d = date;
              if (kind === "sameday") {
                const rec = (await must("liste", api.get(`${ACC}/${a.id}/doubtful`))).records.find(x => x.id === pick(recs));
                if (!rec) continue;
                d = rec.date;
              }
              const live = invs.filter(id => store.get("SELECT 1 AS found FROM invoices WHERE id = ? AND status = 'issued'", id));
              const amount = tlText(Math.round(1000 + rand() * (kind === "free" ? 150000 : 300000)));
              await api.post(`${ACC}/${a.id}/entries`, pay(amount, d, kind !== "free" && live.length ? pick(live) : ""));
            } else if (kind === "take" && recs.length < 3) {
              const r = await api.post(`${ACC}/${a.id}/doubtful`, { amount: pick(["3000", "1500", "500", "1000", "2000"]), date: date < "2026-09-13" ? "2026-09-13" : date, reason: pick(["lawsuit", "protest"]) });
              if (r.status === 200) recs.push(r.data.record.id);
            } else if ((kind === "write" || kind === "partial" || kind === "over") && recs.length) {
              const did = pick(recs);
              const q = await api.get(`${ACC}/${a.id}/doubtful/${did}/write-off?date=${date}`);
              if (q.status !== 200 || q.data.blocked || !(q.data.offerMinor > 0)) continue;
              let amount = q.data.offerMinor;
              if (kind === "partial") amount = Math.max(1, Math.floor(amount * (0.2 + rand() * 0.6)));
              if (kind === "over") amount = q.data.limitMinor + 1;
              const r = await api.post(`${ACC}/${a.id}/doubtful/${did}/write-off`, { amount: tlText(amount), date });
              if (kind === "over") {
                stats.over += 1;
                if (r.status === 200) failures.push(`${tag}: sınırın 1 kuruş fazlası (${tlText(amount)} @${date}) KABUL edildi`);
              } else {
                stats.writes += 1;
                if (r.status !== 200) failures.push(`${tag}: ÖNERİLEN ${kind === "partial" ? "altı " : ""}${tlText(amount)} @${date} (öneri ${q.data.offerMinor}) REDDEDİLDİ ${r.status} ${String(r.error).slice(0, 300)}`);
              }
            } else if (kind === "delete" && recs.length) {
              const did = pick(recs);
              const line = (await writeOffsOf(api, a.id, did)).at(-1);
              if (!line) continue;
              const r = await api.del(`${ACC}/${a.id}/doubtful/${did}/write-offs/${line.entryId}`);
              if (r.status === 200) deleted.push(line.entryId);
            } else if (kind === "restore" && deleted.length) {
              const ref = deleted.splice(Math.floor(rand() * deleted.length), 1)[0];
              const item = (await must("Silinenler", api.get("/api/admin/trash"))).find(x => x.kind === "doubtful-writeoff" && x.ref === ref);
              if (item) await api.post("/api/admin/trash/restore", { id: item.id });
            } else if (kind === "release" && recs.length && rand() < 0.5) {
              await api.post(`${ACC}/${a.id}/doubtful/${pick(recs)}/release`, { date: pick([TODAY, "2026-10-01"]) });
            } else if (kind === "recdel" && recs.length && rand() < 0.4) {
              const i = Math.floor(rand() * recs.length);
              const r = await api.del(`${ACC}/${a.id}/doubtful/${recs[i]}`);
              if (r.status === 200) recs.splice(i, 1);
            } else if (kind === "invdel" && invs.length && rand() < 0.5) {
              const id = pick(invs);
              const r = await api.del(`${INV}/${id}`);
              if (r.status === 200) {
                stats.invDeleted += 1;
                trashed.push(id);
              }
            } else if (kind === "draftdel") {
              const draft = await api.post(INV, saleBody(a.id, pick(["700", "1500"]), { date: pick(CDAYS), status: "draft" }));
              if (draft.status === 200 && (await api.del(`${INV}/${draft.data.id}`)).status === 200) stats.invDeleted += 1;
            } else if (kind === "invrestore" && trashed.length) {
              const ref = trashed.splice(Math.floor(rand() * trashed.length), 1)[0];
              const item = (await must("Silinenler", api.get("/api/admin/trash"))).find(x => x.kind === "invoice" && x.ref === ref);
              if (item && (await api.post("/api/admin/trash/restore", { id: item.id })).status === 200) stats.invRestored += 1;
            } else if (kind === "debtdel") {
              const row = store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'debt' AND source = '' LIMIT 1", a.id);
              if (!row) continue;
              const had = Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND source = 'doubtful'", a.id).n) > 0;
              const before = await balanceOf(api, a.id);
              const r = await api.del(`${ACC}/${a.id}/entries/${row.id}?cashForce=1`);
              if (r.status === 200) {
                stats.debtDeleted += 1;
                const after = await balanceOf(api, a.id);
                if (had) {
                  stats.negativeChecks += 1;
                  if (after < before && after < 0) failures.push(`${tag}: Değersiz satırı olan caride Borç Yaz silmesi cariyi eksiye götürdü (${before} → ${after})`);
                }
              } else if (r.code === "doubtful-writeoff-balance") stats.debtRefused += 1;
            }
            const [fast, full, leak] = invariantText(store);
            stats.compared += 1;
            if (fast !== full) failures.push(`${tag}: Silinenler taraması FARKLI — dizinli ${fast.slice(0, 300)} · tam ${full.slice(0, 300)}`);
            const leaked = keysOf(leak);
            for (const key of keysOf(fast)) if (!leaked.has(key)) failures.push(`${tag}: (i) dünyası düzeltmesi YENİ ihlal üretti: ${key}`);
            for (const key of leaked) if (!keysOf(fast).has(key)) stats.leakOnly += 1;
          }
        }
        stats.trashInvoices = Number(store.get("SELECT COUNT(*) AS n FROM trash WHERE kind = 'invoice'").n);
        const integrity = await integrityOf(api);
        if (!integrity.ok) failures.push(`tohum ${seed}: Mutabakat kırmızı ${JSON.stringify(integrity.failures).slice(0, 600)}`);
        console.log(`# M2T4 tohum ${seed}: ${JSON.stringify(stats)}`);
        assert.deepEqual(failures, []);
        assert.ok(stats.writes > 0 && stats.compared > 0, JSON.stringify(stats));
      } finally {
        D.WRITE_OFF_TEST.fullTrash = false;
        server.close();
      }
    });
  }
});
