// 2.4.7 bağımsız gözden geçirme B2b'nin tünel kolu: ofis saati kapıcının zaman payının dışındayken (±10 dk) M3 kaydı ve canlı işaret kapıcı yanıtının Date
// başlığıyla düzeltiliyordu, ama tünel başvurusu (lib/tunnel/gate-client.mjs) imza zamanını ham ofis saatinden veriyordu → kapıcı 401 "kapi-zaman", canlı
// bağlantı hiç açılmaz. Düzeltme: lib/tunnel/attach.mjs kapiBasvurusu imza saatini mobileSync.kapiSaati()'nden alır; "kapi-zaman" alınırsa kayıt bir kez
// tetiklenir (farkı ölçer) ve başvuru yinelenir. GERÇEK kapıcı (createKapi, test/kapi-yerel.mjs); Cloudflare ayarı verilmez → imza geçen başvuru
// "kapi-tunel-ayar"da durur (imzadan SONRAKİ ilk adım), geçmeyen "kapi-zaman"da. Dış istek yok (ders 30); saat sahte ve sabit (ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { kapiBasvurusu } from "../server/lib/tunnel/attach.mjs";
import { kurulum } from "./mobil-gg247-ortak.mjs";

const DK = 60_000;
const kod = async istek => {
  try {
    await istek;
    return "basarili";
  } catch (error) {
    return error?.gateCode || String(error?.message || error);
  }
};

for (const fark of [10 * DK, -10 * DK]) {
  describe(`tünel başvurusu, ofis saati ${fark / DK} dk`, () => {
    let ctx;
    before(async () => {
      ctx = await kurulum({ farkMs: fark, licenseId: "LIS-TUNEL-SAAT" });
      await ctx.sync.kayitGonder(); // ofis kapıcıda kayıtlı; kayıt yanıtının Date başlığı farkı ölçer
    });
    after(async () => {
      await ctx?.close();
    });
    const basvuru = () =>
      kapiBasvurusu({ gateUrl: ctx.kapi.base, config: { remoteNow: ctx.ofisSaati, fetchImpl: (...a) => globalThis.fetch(...a) }, store: ctx.server.app.store, mobileSync: () => ctx.sync });

    it("ön koşul: ham ofis saatiyle imzalanan başvuru kapıcıda kapi-zaman (pay dışında)", async () => {
      const ham = kapiBasvurusu({ gateUrl: ctx.kapi.base, config: { remoteNow: ctx.ofisSaati, fetchImpl: (...a) => globalThis.fetch(...a) }, store: ctx.server.app.store });
      assert.equal(await kod(ham.provision()), "kapi-zaman");
    });

    it("fark ölçülmüşken başvuru imzası kapıcı saatinde: kapi-zaman değil, imzadan sonraki adıma (kapi-tunel-ayar) ulaşır", async () => {
      assert.ok(Math.abs(ctx.sync.status().saat?.farkMs + fark) <= 1_000, `ön koşul: kayıt farkı ölçtü (${JSON.stringify(ctx.sync.status().saat)})`);
      assert.equal(await kod(basvuru().provision()), "kapi-tunel-ayar", "tünel başvurusu saat telafisini almalı");
    });
  });
}
