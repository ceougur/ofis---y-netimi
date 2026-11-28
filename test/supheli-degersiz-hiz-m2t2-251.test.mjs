// 2.5.1 M2 tur 2 — Değersiz Alacak sınırının HIZ düzeltmesi: EŞDEĞERLİK testi (ders 47: hız düzeltmesi eşdeğerlik testiyle; dar kontrol DK-M2 YÜKSEK-1).
// Hakem: tur 1'in TAM hesabı (lib/bank/doubtful.mjs WRITE_OFF_TEST.exact = true — her aday gün, her deneme tam kuyrukla). Ürün yolu (kısaltmalar açık) aynı veride BİREBİR aynı sonucu
// vermeli: şüpheli kayıt listesinin 'writeOff' alanı (düğme görünürlüğü anyMinor > 0, bugünün ve en çok yazdıran günün sınırı / önerisi / nedeni), formun uç noktası (seçilen günün sınırı /
// önerisi / engeli + bugün + en iyi gün) ve işlem İÇİNDEKİ yol (bellek kapalı — Değersiz Yaz / geri yükleme yolu). Ayrıca kısaltmanın dayandığı önerme: F(S, D) gün ilerledikçe ARTMAZ.
// Rastgele senaryolar (dar kontrolün p1 taraması gibi; en az 4 tohum × 8 cari × 16 adım; M2T2_TOHUM ile çoğaltılır): bağlı / bağsız tahsilat, Şüpheliye Al (1–3 kayıt), Değersiz (önerilen,
// kısmi, başka günle), Değersiz satırı silme / geri yükleme, Şüpheliden Çıkar, S155 (bakiye sınırı), sonunda dönem kilidi. Sahte saat 15.10.2026 (ders 13); iki saat diliminde koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";
import * as doubtfulLib from "../server/lib/bank/doubtful.mjs";

const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const INV_URL = "/api/workspace/invoices";
const SEEDS = (process.env.M2T2_TOHUM || "1,2,3,4").split(",").map(Number);
const CARI = Number(process.env.M2T2_CARI || 8);
const STEPS = Number(process.env.M2T2_ADIM || 16);
const mulberry = seed => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const tlText = minor => (minor / 100).toFixed(2).replace(".", ",");
const CDAYS = ["2026-09-13", "2026-09-15", "2026-09-17", "2026-09-18", "2026-09-20", "2026-09-25", "2026-10-01", "2026-10-05", "2026-10-10", TODAY];
const QDAYS = ["2026-09-12", "2026-09-13", "2026-09-16", "2026-09-17", "2026-09-19", "2026-09-25", "2026-09-30", "2026-10-01", "2026-10-07", TODAY];
const ALLDAYS = [];
for (let d = Date.parse("2026-09-13T00:00:00Z"); d <= Date.parse(`${TODAY}T00:00:00Z`); d += 86_400_000) ALLDAYS.push(new Date(d).toISOString().slice(0, 10));

const exact = on => {
  assert.ok(doubtfulLib.WRITE_OFF_TEST, "WRITE_OFF_TEST yok (tur 2 öncesi kod)");
  doubtfulLib.WRITE_OFF_TEST.exact = on;
};

// Ekranın okuduğu iki uç (liste + form ucu) — aynı veri durumunda.
async function screen(api, party) {
  const list = await must("liste", api.get(`${ACC}/${party}/doubtful`));
  const records = list.records.map(record => ({ id: record.id, writeOff: record.writeOff ?? null }));
  const quotes = {};
  for (const record of list.records) {
    if (!record.writeOff) continue;
    for (const day of QDAYS) quotes[`${record.id}|${day}`] = await must("uç", api.get(`${ACC}/${party}/doubtful/${record.id}/write-off?date=${day}`));
  }
  return { records, quotes };
}
// İşlem İÇİNDEKİ yol (bellek kapalı — Değersiz Yaz, geri yükleme ve iletiler bu yoldan okur): aynı işlevler store.tx içinde, sonra geri alınır.
function inTransaction(store, party, { lockedUntil = "" } = {}) {
  const ROLLBACK = new Error("geri al");
  let out = null;
  try {
    store.tx(() => {
      const ctx = doubtfulLib.writeOffContextOf(store, party);
      const balanceMinor = doubtfulLib.ledgerBalanceMinor(store, party);
      out = ctx.rows.records.filter(record => record.status === "open").map(record => ({
        id: record.id,
        days: doubtfulLib.writeOffDays(ctx, record, { today: TODAY, lockedUntil, balanceMinor }),
        quotes: QDAYS.filter(day => day >= record.date && day > lockedUntil).map(day => doubtfulLib.writeOffLimitOf(ctx, record, day, { balanceMinor })),
      }));
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  return out;
}

// S155 dalı + ARADAKİ bağlı tahsilat günü (aday gün: ilk gün, bağlı gün, bugün): kısa yol ara günü hesaplamadan geçebilmeli ve sonuç tam hesapla aynı olmalı.
// Olaylar: Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 13.09 Şüpheliye Al 3.000 (S) · 17.09 faturaya bağlı tahsilat 2.876,45 · 25.09 Şüpheliye Al 500 (S2). Bakiye 3.423,55.
// ELLE BEKLENEN (kurallardan; ders 5): 17.09 tarihli Değersiz o günün bağlı payından ÖNCE (S264) → sınır 3.000; S155 (kayıttan sonra borç ≥ açık şüpheli; S2'nin 500'ü hiçbir günde düşmez —
// 25.09'dan sonra alacak yok): 3.423,55 − X ≥ 500 → öneri 2.923,55 ve HİÇBİR günde öneri 2.923,55'i aşamaz. Bugün (15.10): bağlı pay düşülmüş kalan 3.000 − 2.876,45 = 123,55 (S-M2-1 = B)
// → sınır = öneri 123,55. En çok yazdıran gün: 2.923,55'i veren en erken gün (seçim kuralı) — 13.09 ya da 17.09 (13.09'un önerisi kuyruğun bağlı payından türer; elle hesaplanmadı, tam hesapla eşitlik).
describe("2.5.1 M2 tur 2 — S155 dalı ve aradaki bağlı tahsilat günü: kısa yol tam hesapla aynı, elle beklenen sınır / öneri", () => {
  it("17.09: sınır 3.000 / öneri 2.923,55; bugün 123,55; en iyi öneri 2.923,55 (en erken gün) ve önerilen tutar o günle kabul", async () => {
    const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const api = apiOf(await loginAdmin(server));
    try {
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const acc = await must("cari", api.post(ACC, { name: "M2T2 Ara Gün", type: "customer", registeredOn: "2026-09-01", phone: "0500 252 99 01" }));
      const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
      await must("borç", api.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
      const s = (await must("şüpheli", api.post(`${ACC}/${acc.id}/doubtful`, { amount: "3000", date: "2026-09-13", reason: "lawsuit" }))).record.id;
      await must("bağlı", api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id }));
      await must("şüpheli 2", api.post(`${ACC}/${acc.id}/doubtful`, { amount: "500", date: "2026-09-25", reason: "lawsuit" }));
      exact(false);
      const fast = await screen(api, acc.id);
      exact(true);
      const full = await screen(api, acc.id);
      exact(false);
      assert.deepEqual(fast, full, "kısa yol ≠ tam hesap");
      const writeOff = fast.records.find(item => item.id === s).writeOff;
      const mid = fast.quotes[`${s}|2026-09-17`];
      assert.deepEqual([mid.limitMinor, mid.offerMinor, mid.s155], [300000, 292355, true], JSON.stringify(mid));
      assert.deepEqual([writeOff.today.limitMinor, writeOff.today.offerMinor], [12355, 12355], JSON.stringify(writeOff));
      assert.equal(writeOff.best.offerMinor, 292355, JSON.stringify(writeOff));
      assert.ok(["2026-09-13", "2026-09-17"].includes(writeOff.best.date), JSON.stringify(writeOff));
      for (const quote of Object.values(fast.quotes)) assert.ok(quote.offerMinor <= 292355, JSON.stringify(quote));
      if (writeOff.best.date === "2026-09-13") assert.equal(fast.quotes[`${s}|2026-09-13`].offerMinor, 292355);
      else assert.ok(fast.quotes[`${s}|2026-09-13`].offerMinor < 292355);
      // Önerilen tutar önerilen günle kabul edilir (BAŞ MİMAR Y30-6) ve sonra cari eksiye düşmez.
      const done = await api.post(`${ACC}/${acc.id}/doubtful/${s}/write-off`, { amount: "2923,55", date: writeOff.best.date });
      assert.equal(done.status, 200, `${done.code} ${done.error}`);
      assert.equal((await must("kart", api.get(`${ACC}/${acc.id}`))).totals.balance, 500);
    } finally {
      // Önce sunucu kapanır (eski kodda bayrak yok — kapanmazsa koşu zaman aşımına kadar asılı kalır).
      server.close();
      if (doubtfulLib.WRITE_OFF_TEST) Object.assign(doubtfulLib.WRITE_OFF_TEST, { exact: false, count: null });
    }
  });
});

// HIZ DİŞİ (süre yerine İŞ SAYISI — yükten bağımsız, CI'de kararlı): dar kontrol DK-M2 YÜKSEK-1'in verisi (p6) küçültülmüş — Açılış borcu 6.000 (02.01) · 03.01 Şüpheliye Al 5.000 ·
// 30 GÜNDE faturaya bağlı tahsilat (her gün fatura 1.000 + bağlı 999). Kayıt bağlı tahsilatlardan önce → aday gün 32 (ilk gün, 30 bağlı gün, bugün). Tur 1 her aday günü hesaplıyordu
// (32 sınır hesabı + denemeler); kısa yol sonucu değiştiremeyecek günleri hesaplamaz: liste 2 sınır hesabı (ilk gün + bugün), deneme YOK (sonra Değersiz satırı yok; S155 üst sınırla).
// Sonra bugünün tarihiyle 100 TL Değersiz yazılınca: ilk günün sınırı bir deneme ister (sonra gelen Değersiz satırı) — liste yine 2 sınır hesabı, en çok birkaç deneme.
describe("2.5.1 M2 tur 2 — hız dişi: liste ve form ucunun iş sayısı bağlı tahsilat GÜNÜ sayısıyla büyümez", () => {
  it("30 bağlı tahsilat günü: liste 2 sınır hesabı + 0 deneme; Değersiz satırından sonra 2 sınır hesabı + ≤ 2 deneme; form ucu ≤ 3 sınır hesabı", { timeout: 600_000 }, async () => {
    const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const api = apiOf(await loginAdmin(server));
    const count = () => {
      doubtfulLib.WRITE_OFF_TEST.count = { quotes: 0, trials: 0 };
      return doubtfulLib.WRITE_OFF_TEST.count;
    };
    try {
      assert.ok(doubtfulLib.WRITE_OFF_TEST, "WRITE_OFF_TEST yok (tur 2 öncesi kod)");
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const acc = await must("cari", api.post(ACC, { name: "M2T2 Hız Dişi", type: "customer", registeredOn: "2026-01-01", phone: "0500 252 99 02" }));
      await must("borç", api.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: "6000", date: "2026-01-02", note: "Açılış borcu" }));
      const s = (await must("şüpheli", api.post(`${ACC}/${acc.id}/doubtful`, { amount: "5000", date: "2026-01-03", reason: "lawsuit" }))).record.id;
      for (let i = 0; i < 30; i += 1) {
        const day = new Date(Date.parse("2026-01-05T00:00:00Z") + i * 9 * 86_400_000).toISOString().slice(0, 10);
        const inv = await must("fatura", api.post(INV_URL, { scenario: "service_sale", accountId: acc.id, issueDate: day, lines: [{ name: "Hizmet", qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open" } }));
        await must("bağlı", api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "999", date: day, method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id }));
      }
      let c = count();
      const list = await must("liste", api.get(`${ACC}/${acc.id}/doubtful`));
      assert.deepEqual([c.quotes, c.trials], [2, 0], `liste iş sayısı ${JSON.stringify(c)}`);
      assert.deepEqual([list.records[0].writeOff.anyMinor, list.records[0].writeOff.best.date, list.records[0].writeOff.best.offerMinor], [500000, "2026-01-03", 500000]);
      c = count();
      await must("uç", api.get(`${ACC}/${acc.id}/doubtful/${s}/write-off?date=2026-03-01`));
      assert.ok(c.quotes <= 3 && c.trials === 0, `form ucu iş sayısı ${JSON.stringify(c)}`);
      doubtfulLib.WRITE_OFF_TEST.count = null;
      await must("Değersiz 100", api.post(`${ACC}/${acc.id}/doubtful/${s}/write-off`, { amount: "100", date: TODAY }));
      c = count();
      const after = await must("liste", api.get(`${ACC}/${acc.id}/doubtful`));
      assert.ok(c.quotes === 2 && c.trials <= 2, `Değersiz satırından sonra liste iş sayısı ${JSON.stringify(c)}`);
      assert.equal(after.records[0].writeOff.best.offerMinor, 490000);
    } finally {
      // Önce sunucu kapanır (eski kodda bayrak yok — kapanmazsa koşu zaman aşımına kadar asılı kalır).
      server.close();
      if (doubtfulLib.WRITE_OFF_TEST) Object.assign(doubtfulLib.WRITE_OFF_TEST, { exact: false, count: null });
    }
  });
});

describe("2.5.1 M2 tur 2 — Değersiz sınırı hız düzeltmesi: tur 1'in tam hesabıyla BİREBİR (liste, form ucu, işlem içi yol; F(S, D) günle artmaz)", () => {
  for (const seed of SEEDS) {
    it(`tohum ${seed}: ${CARI} cari × ${STEPS} adım + dönem kilidi — her adımda kısa yol = tam hesap`, { timeout: 1_800_000 }, async () => {
      const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
      const api = apiOf(await loginAdmin(server));
      const store = server.app.store;
      const rand = mulberry(seed * 7919 + 251);
      const pick = list => list[Math.floor(rand() * list.length)];
      const counts = { snapshots: 0, quotes: 0, txQuotes: 0, monotone: 0, writes: 0, partial: 0, restored: 0, released: 0, midBest: 0, proposalDiff: 0, laterTarget: 0, s155: 0 };
      const parties = [];
      try {
        await api.post("/api/workspace/bank/setup/dismiss", {});
        const compare = async (party, label, lockedUntil = "") => {
          exact(false);
          const fast = await screen(api, party);
          const fastTx = inTransaction(store, party, { lockedUntil });
          exact(true);
          const full = await screen(api, party);
          const fullTx = inTransaction(store, party, { lockedUntil });
          exact(false);
          assert.deepEqual(fast, full, `${label}: ekran (liste / form ucu) kısa yol ≠ tam hesap`);
          assert.deepEqual(fastTx, fullTx, `${label}: işlem içi yol kısa yol ≠ tam hesap`);
          counts.snapshots += 1;
          counts.quotes += Object.keys(fast.quotes).length;
          counts.txQuotes += (fastTx || []).reduce((sum, item) => sum + item.quotes.length, 0);
          for (const quote of Object.values(fast.quotes)) if (quote.s155) counts.s155 += 1;
          // Önerme: F(S, D) (sınırın üst ucu, kaydın D gününden itibaren bağlı satırlar yokken kalanı) gün ilerledikçe artmaz — kısaltmanın (2) tek dayanağı.
          const ctx = doubtfulLib.writeOffContextOf(store, party);
          const balanceMinor = doubtfulLib.ledgerBalanceMinor(store, party);
          for (const record of ctx.rows.records.filter(item => item.status === "open")) {
            let previous = Infinity;
            for (const day of ALLDAYS.filter(item => item >= record.date)) {
              const room = doubtfulLib.writeOffLimitOf(ctx, record, day, { balanceMinor }).roomMinor;
              assert.ok(room <= previous, `${label}: F(S, D) arttı — kayıt ${record.id} ${day}: ${room} > ${previous}`);
              previous = room;
              counts.monotone += 1;
            }
            // Dar kontrolün önerisi ("yalnız ilk gün + bugün") ile tam taramanın farkı (bilgi: kısa yol ara günleri gerektiğinde hesapladığı için sonuç her durumda tam taramayla aynı).
            exact(true);
            const days = doubtfulLib.writeOffDays(ctx, record, { today: TODAY, lockedUntil, balanceMinor });
            exact(false);
            if (days.best && days.first && days.today && days.best.date !== days.first.date && days.best.date !== days.today.date) counts.midBest += 1;
            const pair = [days.first, days.today].filter(Boolean);
            const pairBest = pair.reduce((best, quote) => (!best || quote.offerMinor > best.offerMinor || (quote.offerMinor === best.offerMinor && quote.limitMinor > best.limitMinor) ? quote : best), null);
            if (pairBest && days.best && (pairBest.date !== days.best.date || pairBest.offerMinor !== days.best.offerMinor || Math.max(...pair.map(q => q.limitMinor)) !== days.anyMinor)) counts.proposalDiff += 1;
            if (ctx.credits.some(credit => credit.target && credit.target !== record.id && credit.date > record.date)) counts.laterTarget += 1;
          }
        };
        for (let c = 0; c < CARI; c += 1) {
          const acc = await must("cari", api.post(ACC, { name: `M2T2 Eşdeğerlik ${seed}-${c}`, type: "customer", registeredOn: "2026-09-01", phone: `0500 252 ${String(seed % 100).padStart(2, "0")} ${String(c).padStart(2, "0")}` }));
          parties.push(acc.id);
          const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
          await must("borç", api.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: pick(["3400", "1200", "6000"]), date: "2026-09-12", note: "Borç" }));
          const records = [];
          const deleted = [];
          for (let step = 0; step < STEPS; step += 1) {
            const kind = !records.length && step >= 2 ? "take" : pick(["bound", "bound", "bound", "sameday", "sameday", "free", "take", "take", "write", "write", "write", "partial", "partial", "delete", "restore", "restore", "release"]);
            const date = pick(CDAYS);
            if (kind === "sameday" && records.length) {
              // S264 / S155 sınıfı: bir kaydın GÜNÜNDE faturaya bağlı tahsilat (o günün bağlı payı Değersiz'den sonra sayılır; ikinci kayıtla öneri < sınır olabilir).
              const record = (await must("liste", api.get(`${ACC}/${acc.id}/doubtful`))).records.find(item => item.id === pick(records));
              if (record) await api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: tlText(Math.round(1000 + rand() * 300000)), date: record.date, method: "cash", cashForce: true, similarOk: true, note: "aynı gün bağlı", invoiceId: inv.id });
            } else if (kind === "bound" || kind === "free") {
              await api.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: tlText(Math.round(1000 + rand() * 150000)), date, method: "cash", cashForce: true, similarOk: true, note: kind, ...(kind === "bound" ? { invoiceId: inv.id } : {}) });
            } else if (kind === "take" && records.length < 3) {
              const r = await api.post(`${ACC}/${acc.id}/doubtful`, { amount: pick(["3000", "1500", "500", "1000"]), date: date < "2026-09-13" ? "2026-09-13" : date, reason: "lawsuit" });
              if (r.status === 200) records.push(r.data.record.id);
            } else if ((kind === "write" || kind === "partial") && records.length) {
              const did = pick(records);
              const quote = await must("uç", api.get(`${ACC}/${acc.id}/doubtful/${did}/write-off?date=${date}`));
              if (!quote.blocked && quote.offerMinor > 0) {
                const amount = kind === "partial" ? Math.max(1, Math.floor(quote.offerMinor * (0.2 + rand() * 0.6))) : quote.offerMinor;
                const r = await api.post(`${ACC}/${acc.id}/doubtful/${did}/write-off`, { amount: tlText(amount), date });
                assert.equal(r.status, 200, `tohum ${seed} cari ${c} adım ${step}: önerilen / altı ${tlText(amount)} @${date} reddedildi: ${r.code} ${r.error}`);
                counts[kind === "partial" ? "partial" : "writes"] += 1;
              }
            } else if (kind === "delete" && records.length) {
              const did = pick(records);
              const record = (await must("liste", api.get(`${ACC}/${acc.id}/doubtful`))).records.find(item => item.id === did);
              const line = record?.writeOffs?.at(-1);
              if (line && (await api.del(`${ACC}/${acc.id}/doubtful/${did}/write-offs/${line.entryId}`)).status === 200) deleted.push(line.entryId);
            } else if (kind === "restore" && deleted.length) {
              const entryId = deleted.shift();
              const item = (await must("Silinenler", api.get("/api/admin/trash"))).find(row => row.kind === "doubtful-writeoff" && row.ref === entryId);
              if (item && (await api.post("/api/admin/trash/restore", { id: item.id })).status === 200) counts.restored += 1;
            } else if (kind === "release" && records.length && rand() < 0.5) {
              if ((await api.post(`${ACC}/${acc.id}/doubtful/${pick(records)}/release`, { date: TODAY })).status === 200) counts.released += 1;
            }
            await compare(acc.id, `tohum ${seed} cari ${c} adım ${step} (${kind})`);
          }
        }
        // Dönem kilidi: ilk açık gün kilidin ertesi olur (aday günler değişir).
        await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-09-17" }));
        for (const party of parties) await compare(party, `tohum ${seed} kilitli (17.09) ${party}`, "2026-09-17");
        const integrity = await integrityOf(api);
        assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 900));
      } finally {
        server.close();
        if (doubtfulLib.WRITE_OFF_TEST) Object.assign(doubtfulLib.WRITE_OFF_TEST, { exact: false, count: null });
      }
      console.log(`# M2T2 eşdeğerlik tohum ${seed}: ${JSON.stringify(counts)}`);
      assert.ok(counts.snapshots >= CARI * STEPS && counts.writes + counts.partial >= 3, JSON.stringify(counts));
    });
  }
});
