// 2.4.8 kullanıcı isteği (31.10.2026 ~08:20 UTC "şimdi yap"): "WhatsApp Gönderimleri" ekranında yalnız son 30 gönderim görünüyordu, eskisine ulaşılamıyordu.
// GET /api/workspace/whatsapp/batches: before (imleç: ekrandaki son gönderimin kimliği; OFFSET değil — araya yeni gönderim girse de sayfa kaymaz), from / to (gönderimin
// başladığı YEREL gün, iki uç dahil; lib/clock.mjs now.today ile aynı gün), dış girdi doğrulaması (400 + Türkçe ileti), limit en çok 200; eski çağıranlar (limit=30) aynı.
// Veri programın kendi API'siyle üretilir (65+ toplu gönderim; yerel sahte Graph, gerçek Meta yok). Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const local = (y, m, d, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s, 0);
let ctx;
let account;
const created = []; // oluşturma sırasıyla toplu iş kimlikleri
const body = () => ({ kind: "statement", ids: [account.id], preset: "thisMonth", sendAgain: true });

async function make(at) {
  if (at) ctx.clock.set(at);
  const res = await ctx.batch(body());
  assert.equal(res.status, 200, `toplu iş açılamadı: ${res.status} ${JSON.stringify(res.data)}`);
  await ctx.drain();
  created.push(res.data.data.batch.id);
  return res.data.data.batch;
}
async function page(query) {
  const res = await ctx.api.get(`${URLS.batches}?${new URLSearchParams(query)}`);
  assert.equal(res.status, 200, `liste (${new URLSearchParams(query)}): ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data.map(batch => batch.id);
}
async function rejected(query, field, message) {
  const res = await ctx.api.get(`${URLS.batches}?${new URLSearchParams(query)}`);
  assert.equal(res.status, 400, `${new URLSearchParams(query)}: 400 beklenir (geldi ${res.status} ${JSON.stringify(res.data).slice(0, 200)})`);
  assert.equal(res.data.code, "whatsapp-invalid", "kod");
  assert.equal(res.data.field, field, "alan");
  assert.match(res.data.error, message, `ileti (geldi "${res.data.error}")`);
}
const newestFirst = ids => [...ids].reverse();

describe("2.4.8 WhatsApp Gönderimleri — Daha Fazla Göster (imleç) ve tarih süzgeci", () => {
  before(async () => {
    ctx = await startWa({ now: { time: local(2026, 10, 30, 10), fixed: true } });
    account = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
    // 30.10: 60 gönderim, dakikada bir; 10:30'da iki gönderim AYNI anda (sıra rowid'le).
    for (let i = 0; i < 60; i += 1) await make(i === 31 ? null : local(2026, 10, 30, 10, i));
    // Gün sınırı ve ayın 1'i (yerel): 31.10 23:59:59, 01.11 00:00:00 (iki gönderim aynı anda), 01.11 12:00, 02.11 09:00.
    await make(local(2026, 10, 31, 23, 59, 59));
    await make(local(2026, 11, 1, 0, 0, 0));
    await make(null);
    await make(local(2026, 11, 1, 12));
    await make(local(2026, 11, 2, 9));
    assert.equal(created.length, 65, "ön koşul: 65 gönderim");
  });
  after(async () => {
    await ctx?.close();
  });

  it("İlk 30, sonraki 30, son 5 (en yeni önce; aynı anda açılanlar sonra açılan önce); sonrası boş", async () => {
    const all = newestFirst(created);
    const first = await page({ limit: 30 });
    assert.deepEqual(first, all.slice(0, 30), "ilk sayfa = en yeni 30 (eski çağıran limit=30 değişmedi)");
    const second = await page({ limit: 30, before: first.at(-1) });
    assert.deepEqual(second, all.slice(30, 60), "ikinci sayfa ilk sayfanın devamı");
    const third = await page({ limit: 31, before: second.at(-1) });
    assert.deepEqual(third, all.slice(60), "son 5 (bir fazla istenince daha eskisi yok)");
    assert.deepEqual(await page({ limit: 30, before: third.at(-1) }), [], "en eskiden sonrası boş");
  });

  it("İmleç kararlılığı: ilk sayfa okunduktan sonra yeni gönderim gelse de ikinci sayfa kaymaz", async () => {
    const all = newestFirst(created);
    const first = await page({ limit: 30 });
    const fresh = await make(local(2026, 11, 2, 10));
    const second = await page({ limit: 30, before: first.at(-1) });
    assert.deepEqual(second, all.slice(30, 60), "araya giren yeni gönderim ikinci sayfayı kaydırmaz (tekrar ya da atlama yok)");
    assert.equal((await page({ limit: 30 }))[0], fresh.id, "yeni gönderim baştan yüklenince en üstte");
  });

  it("Tarih süzgeci: yerel gün, iki uç dahil (23:59:59 ve 00:00:00), ayın 1'i; süzgeç + imleç birlikte; boş gün", async () => {
    const [b61, b62, b63, b64, b65] = created.slice(60, 65);
    assert.deepEqual(await page({ from: "2026-10-31", to: "2026-10-31" }), [b61], "31.10: yalnız 23:59:59 gönderimi (gece yarısından sonrakiler 01.11)");
    assert.deepEqual(await page({ from: "2026-11-01", to: "2026-11-01" }), [b64, b63, b62], "01.11 (ayın 1'i): 00:00:00'daki iki gönderim dahil");
    assert.equal((await page({ from: "2026-11-01" })).at(-1), b62, "Başlangıç ucu dahil: 01.11 00:00:00.000'daki ilk gönderim en eski satır");
    assert.equal((await page({ to: "2026-10-31", limit: 200 })).length, 61, "yalnız Bitiş: 30.10 (60) + 31.10 (1)");
    assert.deepEqual(await page({ from: "2026-11-02" }).then(ids => ids.includes(b65) && !ids.includes(b64)), true, "yalnız Başlangıç");
    const day = newestFirst(created.slice(0, 60));
    const one = await page({ from: "2026-10-30", to: "2026-10-30", limit: 31 });
    assert.deepEqual(one, day.slice(0, 31), "süzgeçli ilk sayfa");
    assert.deepEqual(await page({ from: "2026-10-30", to: "2026-10-30", limit: 31, before: one.at(-1) }), day.slice(31), "süzgeçli sonraki sayfa (süzgeç dışına taşmaz)");
    assert.deepEqual(await page({ from: "2026-10-29", to: "2026-10-29" }), [], "gönderimsiz gün boş");
  });

  it("Dış girdi: geçersiz aralık / tarih / imleç 400 + Türkçe ileti; limit en çok 200, sayı değilse 50", async () => {
    await rejected({ from: "2026-11-02", to: "2026-11-01" }, "from", /^Başlangıç tarihi Bitiş tarihinden sonra olamaz\.$/);
    await rejected({ from: "2026-02-30" }, "from", /^Başlangıç tarihi geçersiz\.$/);
    await rejected({ to: "01.11.2026" }, "to", /^Bitiş tarihi geçersiz\.$/);
    await rejected({ before: "wab-yok" }, "before", /Daha eski gönderimler yüklenemedi/);
    await rejected({ before: "../../x'; DROP" }, "before", /Daha eski gönderimler yüklenemedi/);
    await rejected({ before: "x".repeat(150) }, "before", /Daha eski gönderimler yüklenemedi/);
    assert.equal((await page({ limit: 500 })).length, created.length, "limit 500 → en çok 200 (66 gönderimin hepsi)");
    assert.equal((await page({ limit: "abc" })).length, 50, "sayı olmayan limit → 50");
    assert.equal((await page({})).length, 50, "limitsiz → 50 (eski davranış)");
  });
});
