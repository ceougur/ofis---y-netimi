// 2.4.8 T2-5 GÜVENLİ TARAF (ana oturum, 31.10.2026): Meta'da utility şablonun izinli teslim süresi (TTL) aralığı belgede OKUNMADI (D0-W5-8) — S2 A'nın 3 günü
// reddedilebilir. Önceden program "Süresi Doldu" anını ve PDF'in Meta'dan silinmesini AYARDAKİ değere (72 saat) bağlıyordu → Meta reddettiyse (varsayılan 30 gün)
// Meta hâlâ teslim etmeye çalışırken 73. saatte "Süresi Doldu" deyip PDF'i siliyordu. Beklenen: TTL = META'NIN KABUL ETTİĞİ değer (şablon listesindeki /
// açma yanıtındaki message_send_ttl_seconds — D0-W5-9); okunamazsa ya da reddedildiyse Meta'nın varsayılanı 30 gün; Meta'nın hâlâ teslim etmeye çalıştığı
// iletinin PDF'i hiçbir durumda önceden silinmez. Kartta "Meta teslim süresini kabul etmedi; Meta 30 güne kadar teslim etmeyi dener."
// Düzenek: gerçek program (şablonları kendisi açar) + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; ttlRange ile reddi kurar, kabul edileni kaydeder ve
// listede gösterir) + sahte saat (ders 13). Bildirim yolu çalışıyor (bir "sent" bildirimi), çünkü süre dolumu yalnız o zaman yazılır (§7a 16).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ENSURE = "/api/workspace/whatsapp/templates/ensure";

async function scenario({ ttlRange = null, ttlHours = null } = {}) {
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
  const ctx = await startWa({ fake, connect: false });
  try {
    if (ttlRange) fake.state.ttlRange = ttlRange;
    assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status, 200);
    if (ttlHours) assert.equal((await ctx.api.put(URLS.sending, { ttlHours })).status, 200);
    const ensured = await ctx.api.post(ENSURE, {});
    assert.equal(ensured.status, 200, JSON.stringify(ensured.data));
    for (const tpl of fake.state.templates) tpl.status = "APPROVED"; // Meta onayladı
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const id = res.data.data.batch.id;
    await ctx.drain();
    const job = (await ctx.jobs(id))[0];
    assert.equal(job.state, "accepted");
    ctx.statuses([{ id: job.wamid, status: "sent", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]);
    const close = async () => {
      await ctx.close();
      await fake.close();
    };
    return { ctx, fake, id, ensured: ensured.data.data, state: async () => (await ctx.jobs(id))[0].state, close };
  } catch (error) {
    await ctx.close();
    await fake.close();
    throw error;
  }
}

describe("2.4.8 T2-5 güvenli taraf — Süresi Doldu ve PDF silme Meta'nın KABUL ETTİĞİ teslim süresine bağlı", () => {
  it("Meta 259.200 sn'yi (3 gün) REDDEDER: iş 73. saatte Süresi Doldu OLMAZ, PDF silinmez; kartta uyarı; 30 gün + 1 saatte Süresi Doldu + PDF silinir", async () => {
    const s = await scenario({ ttlRange: [30, 43_200] });
    try {
      s.ctx.clock.advance(73 * HOUR + MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent", "Meta hâlâ teslim etmeye çalışıyor: 73. saatte Süresi Doldu olmamalı");
      assert.equal(s.fake.state.deleted.length, 0, "Meta hâlâ teslim etmeye çalışırken PDF silinmemeli");
      assert.ok(s.ensured.items.every(item => item.warnings.includes("Meta teslim süresini kabul etmedi; Meta 30 güne kadar teslim etmeyi dener.")), JSON.stringify(s.ensured.items.map(item => item.warnings)));
      // 30. günün hemen öncesi: bildirim yolu hâlâ çalışıyor (son 7 günde bildirim geldi — §7a 16); süre yine dolmadı.
      s.ctx.clock.advance(30 * DAY - 73 * HOUR - 2 * HOUR);
      s.ctx.statuses([{ id: "wamid.BASKA0001", status: "sent", timestamp: String(Math.floor(s.ctx.clock.ms() / 1000)) }]);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent", "30 gün dolmadan Süresi Doldu yok");
      assert.equal(s.fake.state.deleted.length, 0);
      s.ctx.clock.advance(3 * HOUR + MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "expired", "Meta'nın varsayılanı 30 gün + 1 saatte Süresi Doldu");
      assert.equal(s.fake.state.deleted.length, 1, "30 günde PDF silinir");
    } finally {
      await s.close();
    }
  });

  it("Meta TTL'i reddetti ve bildirim yolu 7 günden beri sessiz: iş Gönderildi'de kalır (§7a 16), PDF yine 30 gün + 1 saatte silinir (Meta artık teslim etmeye çalışmaz)", async () => {
    const s = await scenario({ ttlRange: [30, 43_200] });
    try {
      s.ctx.clock.advance(30 * DAY - MIN);
      await s.ctx.drain();
      assert.equal(s.fake.state.deleted.length, 0, "30 gün dolmadan PDF silinmez");
      s.ctx.clock.advance(HOUR + 2 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent");
      assert.equal(s.fake.state.deleted.length, 1);
    } finally {
      await s.close();
    }
  });

  it("Meta 43.200 sn'yi (12 saat) KABUL EDER: 13. saatte Süresi Doldu + PDF silinir (12 saat 30 dk'da henüz değil)", async () => {
    const s = await scenario({ ttlRange: [30, 43_200], ttlHours: 12 });
    try {
      assert.ok(s.fake.state.templates.filter(item => item.name.startsWith("destekofis_")).every(item => item.message_send_ttl_seconds === 43_200));
      s.ctx.clock.advance(12 * HOUR + 30 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent");
      assert.equal(s.fake.state.deleted.length, 0);
      s.ctx.clock.advance(31 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "expired", "Meta'nın kabul ettiği 12 saat + 1 saatte Süresi Doldu");
      assert.equal(s.fake.state.deleted.length, 1);
    } finally {
      await s.close();
    }
  });

  it("Meta 259.200 sn'yi KABUL EDER: eskisi gibi 73. saatte Süresi Doldu + PDF silinir (72 saat 30 dk'da henüz değil)", async () => {
    const s = await scenario();
    try {
      s.ctx.clock.advance(72 * HOUR + 30 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent");
      s.ctx.clock.advance(31 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "expired");
      assert.equal(s.fake.state.deleted.length, 1);
    } finally {
      await s.close();
    }
  });
});
