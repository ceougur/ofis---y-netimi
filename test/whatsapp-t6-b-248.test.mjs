// 2.4.8 T6 arıza testleri T6-B1 / T6-B2 (gerçek tmpfs betikleri test/t6-248/b-disk-dolu.mjs b1 / b3 — wt-t6-248 — süreç İÇİ yazım hatası enjeksiyonuyla kalıcılaştırıldı;
// tmpfs / kök kullanıcı gerekmez). Kök neden ortak: step()'te Meta DIŞI hata (şirket dosyasına yazım düştü — disk dolu, kilit) yolu korumasızdı:
//   B1: disk PDF yüklemesi Meta'dayken dolunca (a) yüklemeden sonraki yazımlar düşüyor, iş "Hazırlanıyor"da KALIYOR (next() seçmez; yalnız açılıştaki recover()
//       alıyordu) → yer açılınca da gitmiyor, toplu iş bitmiyor; (b) "Hazırlanıyor" yazımı düşen öbür işler her turda BEKLEMESİZ yeniden deneniyordu (meşgul döngü).
//   B2: yalnız PDF kimliğinin (media_id) yazımı düşünce her turda Meta'ya YENİ PDF yükleniyor, kimlik kayboluyor → Meta'da sahipsiz kişisel mali veri (S3 A ihlali).
// Beklenen: Meta dışı hatada iş güvenli duruma döner ve BEKLEMELİ yeniden denenir (30 sn → 2 dk → 15 dk; bellekte de — yazım düşse de); yüklenip kaydedilemeyen PDF
// bellekteki kimlikle hemen Meta'dan silinir; "Hazırlanıyor"da kalan iş bakım turunda (5 dk) da Bekliyor'a döner; çift ileti yok.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13); disk dolu = şirket dosyasının yazım işlevi (store.run) hata atar
// (SQLITE_FULL iletisiyle); dolum anı PDF yükleme isteğinin İÇİNE denk getirilir (ders 20).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const diskFull = () => Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR", errcode: 13 });
const uploads = fake => fake.requests.filter(item => item.method === "POST" && /\/media$/.test(item.path)).length;

describe("2.4.8 T6-B1 / T6-B2 — Meta dışı hata (yazım, disk dolu) yolunda bekleme, PDF temizliği, takılı iş", () => {
  it("B2: yalnız PDF kimliğinin yazımı düşüyor — 20 turda tek yükleme ve Meta'da sahipsiz PDF yok; bekleme 30 sn → 2 dk; yazım düzelince tek ileti", async () => {
    const ctx = await startWa();
    const store = ctx.server.app.store;
    const run = store.run;
    let failing = true;
    store.run = (sql, ...args) => {
      if (failing && /^UPDATE wa_jobs SET media_id = \?/.test(sql)) throw diskFull();
      return run.call(store, sql, ...args);
    };
    try {
      const a = await ctx.account("Zorla PDF", "0553 999 00 01", 40);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      for (let i = 0; i < 20; i += 1) await ctx.wa.scheduler.runOnce();
      assert.equal(uploads(ctx.fake), 1, `20 turda Meta'ya ${uploads(ctx.fake)} PDF yüklendi (beklemesiz yeniden deneme olmamalı)`);
      assert.equal(ctx.fake.state.media.size, 0, `kimliği kaydedilemeyen PDF Meta'dan hemen silinmeli (Meta'da ${ctx.fake.state.media.size} sahipsiz PDF)`);
      const job = ctx.store.get("SELECT state, next_at FROM wa_jobs WHERE batch_id = ?", id);
      assert.equal(job.state, "pending");
      assert.ok(job.next_at && Date.parse(job.next_at) - ctx.clock().getTime() >= 25_000, `iş beklemeli (next_at ${job.next_at})`);
      ctx.clock.advance(31_000);
      for (let i = 0; i < 5; i += 1) await ctx.wa.scheduler.runOnce();
      assert.equal(uploads(ctx.fake), 2, "30 sn sonra bir yeniden deneme");
      assert.equal(ctx.fake.state.media.size, 0);
      assert.equal(ctx.messageRequests().length, 0);
      failing = false;
      ctx.clock.advance(60_000);
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, 0, "ikinci bekleme (2 dk) dolmadan gitmez");
      ctx.clock.advance(61_000);
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, 1, "yazım düzelince tek ileti");
      assert.equal((await ctx.detail(id)).state, "done");
    } finally {
      store.run = run;
      await ctx.close();
    }
  });

  it("B1: disk ilk PDF yüklemesi Meta'dayken doluyor — dolu diskte meşgul döngü yok; yer açılınca 'Hazırlanıyor'da kalan iş bakım turunda döner, herkes bir kez alır", async () => {
    let full = false;
    let ctx = null;
    let armed = true;
    const fetchImpl = async (url, init = {}) => {
      const response = await globalThis.fetch(url, init);
      // Disk, ilk PDF yüklemesinin yanıtı programa dönmeden HEMEN önce dolar (yükleme Meta'da işlendi; sonraki yazımlar düşer).
      if (armed && (init.method || "GET") === "POST" && /\/media$/.test(new URL(url).pathname)) {
        armed = false;
        full = true;
      }
      return response;
    };
    ctx = await startWa({ fetchImpl });
    const store = ctx.server.app.store;
    const run = store.run;
    let dropped = 0;
    store.run = (sql, ...args) => {
      if (full && /^\s*(UPDATE|INSERT|DELETE|REPLACE)/i.test(sql)) {
        dropped += 1;
        throw diskFull();
      }
      return run.call(store, sql, ...args);
    };
    try {
      const people = [];
      for (let i = 1; i <= 3; i += 1) people.push(await ctx.account(`Disk Kişi ${i}`, `0553 999 00 1${i}`, 40));
      const id = (await ctx.batch({ kind: "statement", ids: people.map(p => p.id), preset: "thisMonth" })).data.data.batch.id;
      let busy = 0;
      for (let i = 0; i < 20; i += 1) {
        const r = await ctx.wa.scheduler.runOnce();
        if (r.did) busy += 1;
        ctx.clock.advance(1000);
      }
      assert.equal(full, true, "ön koşul: disk PDF yüklemesi sırasında doldu");
      assert.equal(ctx.messageRequests().length, 0, "dolu diskte ileti yok");
      // Bulgular birlikte toplanır (ders 38: her kırmızının kendi nedeni iletide görünsün).
      const problems = [];
      if (busy > 3) problems.push(`dolu diskte işçi beklemesiz yeniden denedi: 20 turda ${busy} kez iş yürüttü (yazılamayan ${dropped} yazım)`);
      if (uploads(ctx.fake) !== 1) problems.push(`dolu diskte ${uploads(ctx.fake)} PDF yüklendi`);
      if (ctx.fake.state.media.size !== 0) problems.push(`kimliği yazılamayan PDF Meta'da kaldı (${ctx.fake.state.media.size})`);
      full = false;
      ctx.clock.advance(6 * 60_000);
      await ctx.drain();
      await ctx.drain();
      const d = await ctx.detail(id);
      const open = d.jobs.map(job => job.state).filter(state => state !== "accepted");
      if (open.length) problems.push(`yer açılınca takılı iş kaldı: ${open.join(", ")} (toplu iş ${d.state})`);
      const per = {};
      for (const item of ctx.messageRequests()) per[item.body.to] = (per[item.body.to] || 0) + 1;
      if (Object.values(per).some(n => n > 1)) problems.push(`çift ileti: ${JSON.stringify(per)}`);
      assert.deepEqual(problems, []);
      assert.equal(d.state, "done");
      assert.deepEqual(Object.values(per), [1, 1, 1], `kişi başına bir ileti (${JSON.stringify(per)})`);
    } finally {
      store.run = run;
      await ctx.close();
    }
  });
});
