// 2.5.1 M2 tur 2 — Değersiz Alacak'tan sonra fatura iptali / iadesi, öbür şüpheli kaydın silinmesi ve kapı reddinin iletisi (para çekirdeği; dar kontrol DK-M2 ORTA-2 / ORTA-3).
// KARARLAR (AYNEN; iş listesi C / D):
//   S-DKM2-2 = A (27.11 23:47 UTC — KULLANICI KARARIYLA ÖNERİ UYGULANDI, 20:26 yetkisi): "Değersiz Alacak yazıldıktan sonra faturanın iptali ya da iadesi cariyi eksiye düşürüyorsa ne olsun? …
//     A (ÖNERİ): iptal de iade de reddedilsin — ileti 'önce Değersiz Alacak satırını silin (en çok 523,55 yazılabilirdi)'."
//   S-DKM2-3 = C (aynı karar anı): "uç durum böyle kalsın (BİLİNEN SINIR) — yalnız ileti düzelsin ('bu kayıt silinirse tahsilat Değersiz yazılan kayda düşer')".
//   Görev metni (m2t2-istem.txt İş 2): değişmez (i)'de bağlı olduğu fatura W'nin yazım anından sonra değişmiş / iptal edilmiş tahsilat da 'sonradan değişmiş' sayılır — v2.5.0 gerçek verisinde
//     Mutabakat YANLIŞ kırmızıya düşmez; kapı reddinde writeoff-limit / writeoff-balance nedenlerinin anlaşılır Türkçe iletisi (S155 deseniyle).
// ELLE BEKLENEN SAYILAR (kurallardan; ders 5): taban T = Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 · Değersiz 3.000 @17.09 (S264)
//   → bakiye 423,55. İptal: cari 423,55 − 2.900 = −2.476,45 (Değersiz olmasaydı +523,55 → "Değersiz yüzünden"); iptalden sonra tahsilat bağsız, aynı gün Şüpheliye Al'dan sonra sayılır →
//   kaydın kalanı 3.000 − 2.876,45 = 123,55 (S270) → iletideki "en çok" 123,55 (karar metnindeki örnek 523,55 bakiyedir; sınır S270 gereği kalan — m2t2-rapor.md). Tam iade (01.10): iade alacağı
//   bağsız sonraki alacak (S270 "sonradan gelen bağsız") → 17.09 sınırı 3.000 − 2.900 = 100,00.
// Sahte saat 15.10.2026 (ders 13), akan saat.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";
import * as doubtfulLib from "../server/lib/bank/doubtful.mjs";
import * as integrityLib from "../server/lib/integrity.mjs";

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
// Taban T (+ isteğe bağlı ek borç); fatura iki satır 2 × 1.450 (kısmi iade için).
async function base(api, name, { extra = 0 } = {}) {
  phone += 1;
  const a = await must("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 253 ${String(phone).padStart(2, "0")} 01` }));
  const inv = await must("fatura", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 2, unitPrice: "1450", vatRate: 0 }], payment: { rest: "open" } }));
  await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  if (extra) await must("ek borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: String(extra), date: "2026-09-12", note: "Ek borç" }));
  await must("bağlı", api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id }));
  const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  await must("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  const detail = await must("fatura ayrıntısı", api.get(`${INV}/${inv.id}`));
  const line = (detail.lines || detail.invoice?.lines || [])[0];
  return { a, inv, s, lineId: line?.id };
}
const balanceOf = async (api, party) => (await must("kart", api.get(`${ACC}/${party}`))).totals.balance;
const returnBody = (b, qty) => ({ kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: b.lineId, qty }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
const fourParts = (error, { what, after, could }) => {
  assert.match(error, new RegExp(`^${what}: bu caride 17\\.09\\.2026 tarihli 3\\.000,00 TL Değersiz Alacak satırı var`), error);
  assert.ok(error.includes(`sonra cari ${after} TL alacaklı (eksi bakiye) olurdu`), error);
  assert.ok(error.includes(`en çok ${could} TL Değersiz Alacak yazılabilirdi`), error);
  assert.ok(error.includes(`Ne yapmalı: önce Değersiz Alacak satırını silin (${WHERE})`), error);
  assert.ok(error.endsWith("Hiçbir şey kaydedilmedi."), error);
};

describe("2.5.1 M2 tur 2 — S-DKM2-2 = A: Değersiz'den sonra iptal de iade de cariyi eksiye düşürecekse reddedilir", () => {
  it("fatura iptali → 409 doubtful-writeoff-balance, dört parçalı ileti (en çok 123,55); hiçbir şey yazılmaz", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T2 İptal");
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" });
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      fourParts(r.error, { what: "Fatura iptal edilemez", after: "2.476,45", could: "123,55" });
      assert.equal(store.get("SELECT status FROM invoices WHERE id = ?", b.inv.id).status, "issued");
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      assert.equal(Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE invoice_id = ?", b.inv.id).n), 1, "bağ kopmadı");
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("fatura silme (iptali çağırır) → aynı ret; fatura yerinde", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T2 Silme");
      const r = await api.del(`${INV}/${b.inv.id}`);
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.equal(store.get("SELECT status FROM invoices WHERE id = ?", b.inv.id)?.status, "issued");
      assert.equal(await balanceOf(api, b.a.id), 423.55);
    } finally {
      server.close();
    }
  });
  it("tam iade → 409, ileti 'İade faturası kaydedilemez' (en çok 100,00); iade yazılmaz", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T2 İade");
      const r = await api.post(INV, returnBody(b, 2));
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      fourParts(r.error, { what: "İade faturası kaydedilemez", after: "2.476,45", could: "100,00" });
      assert.equal(Number(store.get("SELECT COUNT(*) AS n FROM invoices WHERE original_id = ?", b.inv.id).n), 0);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
    } finally {
      server.close();
    }
  });
  it("iade cariyi eksiye düşürmüyorsa kabul; iadenin Düzenle'si eksiye düşürünce 409 (öncesi Düzenle'den önceki bakiye)", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T2 İade Düzenle", { extra: 2000 });
      assert.equal(await balanceOf(api, b.a.id), 2423.55);
      const half = await must("kısmi iade", api.post(INV, returnBody(b, 1)));
      assert.equal(await balanceOf(api, b.a.id), 973.55);
      const r = await api.post(`${INV}/${half.id}/edit`, returnBody(b, 2));
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      fourParts(r.error, { what: "İade faturası kaydedilemez", after: "476,45", could: "100,00" });
      assert.equal(await balanceOf(api, b.a.id), 973.55);
      assert.equal(Number(store.get("SELECT payable_total AS p FROM invoices WHERE id = ?", half.id)?.p ?? 1450), 1450);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("iptal cariyi eksiye düşürmüyorsa kabul ve Mutabakat yeşil (bağı kopan tahsilat değişmez (i)'de 'sonradan değişmiş')", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T2 İptal Artı", { extra: 3000 });
      assert.equal(await balanceOf(api, b.a.id), 3423.55);
      await must("iptal", api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" }));
      assert.equal(await balanceOf(api, b.a.id), 523.55);
      assert.deepEqual(doubtfulLib.doubtfulProblems(store, { parties: [b.a.id] }).map(item => item.sample), []);
      const integrity = await integrityOf(api);
      assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 600));
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 2 — v2.5.0'ın GERÇEK verisi (Değersiz → iptal o sürümde kabul): Mutabakat yanlış kırmızıya düşmez", () => {
  it("fixture (v2.5.0 üretimi): Mutabakat tamam; sonraki işlem ve Değersiz satırını silme kabul", async () => {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "m2t2-v250-iptal");
    const { party, did } = JSON.parse(readFileSync(path.join(dir, "ids.json"), "utf8"));
    const server = await startTestServer({
      now: `${TODAY}T12:00:00+03:00`,
      env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
      prepare: ({ dataDir }) => {
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(dir, "destekofis.sqlite.gz"))));
        copyFileSync(path.join(dir, "sirketler.json"), path.join(dataDir, "sirketler.json"));
      },
    });
    try {
      const api = apiOf(await loginAdmin(server));
      assert.equal(await balanceOf(api, party), -2476.45, "v2.5.0 verisi");
      const first = await integrityOf(api);
      assert.equal(first.ok, true, JSON.stringify(first.failures).slice(0, 700));
      await must("sonraki işlem", api.post(`${ACC}/${party}/entries`, { kind: "debt", amount: "10", date: TODAY, note: "Sonraki" }));
      assert.equal((await integrityOf(api)).ok, true);
      const record = (await must("liste", api.get(`${ACC}/${party}/doubtful`))).records.find(item => item.id === did);
      await must("Değersiz satırını sil", api.del(`${ACC}/${party}/doubtful/${did}/write-offs/${record.writeOffs[0].entryId}`));
      assert.equal(await balanceOf(api, party), 533.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 2 — S-DKM2-3 = C: öbür kaydın silinmesi reddi KALIR, ileti doğru anlatır", () => {
  it("S2 silinirse bağsız tahsilat Değersiz yazılan S1'e düşer → 409 doubtful-delete-conflict, dört parçalı ileti; S2 yerinde, bakiye 2.300", async () => {
    const { server, api, store } = await boot();
    try {
      phone += 1;
      const a = await must("cari", api.post(ACC, { name: "M2T2 Silme Çakışması", type: "customer", registeredOn: "2026-09-01", phone: `0500 253 ${String(phone).padStart(2, "0")} 02` }));
      await must("fatura", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
      await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
      const s2 = (await must("S2", api.post(`${ACC}/${a.id}/doubtful`, { amount: "1000", date: "2026-09-13", reason: "lawsuit" }))).record.id;
      const s1 = (await must("S1", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-15", reason: "lawsuit" }))).record.id;
      await must("bağsız", api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "1000", date: "2026-10-01", method: "cash", cashForce: true, similarOk: true, note: "Bağsız" }));
      await must("Değersiz S1", api.post(`${ACC}/${a.id}/doubtful/${s1}/write-off`, { amount: "3000", date: "2026-09-20" }));
      assert.equal(await balanceOf(api, a.id), 2300);
      const r = await api.del(`${ACC}/${a.id}/doubtful/${s2}`);
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-delete-conflict", r.error);
      assert.match(r.error, /^Şüpheli alacak kaydı silinemez: bu kayıt silinirse carinin bağsız tahsilatı Değersiz Alacak yazılan kayda düşer ve o kaydın 20\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı/, r.error);
      assert.ok(r.error.includes(`Ne yapmalı: önce o Değersiz Alacak satırını silin (${WHERE}), sonra bu işlemi yeniden deneyin`), r.error);
      assert.ok(!r.error.includes("yazıldığı andaki sınırı aşardı"), r.error);
      assert.equal(store.get("SELECT status FROM doubtful_receivables WHERE id = ?", s2).status, "open");
      assert.equal(await balanceOf(api, a.id), 2300);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 2 — kapı reddinin iletisi: yalnız Değersiz sınırı (S270) nedeniyse anlaşılır Türkçe cümle", () => {
  it("writeoff-limit / writeoff-balance → ne oldu / neden / ne yapmalı / nereye; başka nedenle birlikteyse genel ileti", () => {
    const limit = { code: "doubtful:records", name: "Şüpheli Alacak Kayıtları", ok: false, count: 1, sample: ["x"], writeOffs: [{ kind: "writeoff-limit", date: "2026-09-17", minor: 300000, roomMinor: 12355 }] };
    const balance = { code: "doubtful:records", name: "Şüpheli Alacak Kayıtları", ok: false, count: 1, sample: ["x"], writeOffs: [{ kind: "writeoff-balance", date: "2026-09-17", minor: 300000, balanceMinor: -247645 }] };
    const a = new integrityLib.IntegrityError([limit]);
    assert.equal(a.status ?? a.statusCode ?? 409, 409);
    assert.equal(a.message, `Bu kayıtla carinin 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı şüpheli kaydın kalanını aşar: Değersiz Alacak, kayda düşen tahsilatlar çıkınca kalanı (en çok 123,55 TL) aşamaz. Ne yapmalı: önce Değersiz Alacak satırını silin (${WHERE}), sonra bu kaydı yeniden girin; gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir). Hiçbir değişiklik yazılmadı.`);
    const b = new integrityLib.IntegrityError([balance]);
    assert.ok(b.message.startsWith("Bu kayıtla carinin 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı cariyi alacaklıya (eksi bakiye -2.476,45 TL) düşürür"), b.message);
    const mixed = new integrityLib.IntegrityError([limit, { code: "party:accounts", name: "Cari", ok: false, count: 1 }]);
    assert.ok(mixed.message.startsWith("İşlem geri alındı: kayıt defterler arasında sapma oluşturacaktı"), mixed.message);
    const plain = new integrityLib.IntegrityError([{ code: "doubtful:records", name: "Şüpheli Alacak Kayıtları", ok: false, count: 1, sample: ["y"] }]);
    assert.ok(plain.message.startsWith("İşlem geri alındı"), plain.message);
  });
});
