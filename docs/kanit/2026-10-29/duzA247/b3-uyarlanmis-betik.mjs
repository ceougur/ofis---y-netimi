// B3 yeniden üretme betiğinin (gg247-ana-tekrar/b3-tek-lisans-cok-ofis.test.mjs) ÖLÇÜSÜ UYARLANMIŞ kopyası — adımlar aynı, iki fark:
//   (1) "kabul edilen kayıtların cihaz toplamı" yerine "AYNI ANDA kapıcıdan geçen cihaz" sayılır: karar gereği yeni ofis kaydı KABUL edilir, eskisi devre dışı
//       kalır; asıl iddia (tek lisansla en çok 3 cihaz) aynı anda geçen cihazla ölçülür. Geçen = imzalı özet okuması kapi-cihaz almayan cihaz.
//   (2) sahte Cloudflare'de silme var (deleteTunnel / deleteCname); sayılan, SONDA duran tünel ve DNS kaydı.
// W: GG_W ortam değişkeni (eski kod kopyası ya da yeni çalışma ağacı).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
const W = process.env.GG_W || "/home/user/ofis---y-netimi/.claude/worktrees/agent-a4ce03c386642542b";
const { lisansAnahtari, ofisAnahtari, cihaz } = await import(`${W}/test/kapi-ortak.mjs`);
const { startKapi } = await import(`${W}/test/kapi-yerel.mjs`);
const { kapiIstemcisi } = await import(`${W}/server/lib/mobile-ozet.mjs`);
const { tunelIstegi } = await import(`${W}/bulut/kapi/tunel.mjs`);
const { ecdsaImzala, mesaj, sha256Hex } = await import(`${W}/server/lib/kapi-protokol.mjs`);
const { rawRequest } = await import(`${W}/test/mobil-uzak-ortak.mjs`);

const T = Date.parse("2026-11-18T10:00:00+03:00");
const MACHINE = "0123456789abcdef0123456789abcdef";

describe(`B3 (uyarlanmış ölçü) tek lisans (tek makine) → birden çok ofis kimliği — W=${W}`, () => {
  let kapi, lisans, belirtec, now;
  before(async () => {
    let t = T;
    now = () => (t += 1);
    lisans = lisansAnahtari();
    belirtec = () => lisans.belirtec({ at: T, machine: MACHINE, licenseId: "LIS-GG-B3", mobileDevices: 3 });
    kapi = await startKapi({ now: () => t, trustedKeys: lisans.trusted });
  });
  after(() => kapi?.close());

  it("aynı lisans belirteciyle 4 ofis × 3 cihaz: AYNI ANDA kapıcıdan geçen cihaz ≤ 3", async () => {
    const istemci = kapiIstemcisi({ url: kapi.base, fetchImpl: (...a) => fetch(...a), simdi: () => T + 1000, kayitSimdi: now });
    const ofisler = [];
    for (let i = 0; i < 4; i += 1) {
      const ofis = await ofisAnahtari();
      const cihazlar = [];
      for (let j = 0; j < 3; j += 1) cihazlar.push(await cihaz());
      const r = await istemci.kayit(ofis, { lisans: belirtec(), cihazlar: cihazlar.map(c => ({ id: c.id, anahtar: c.anahtar })) });
      ofisler.push({ ofis, cihazlar, ok: r.ok, code: r.code || "" });
    }
    let gecen = 0;
    for (const { ofis, cihazlar } of ofisler)
      for (const c of cihazlar) {
        const ms = T + 1000;
        const r = await rawRequest(kapi.base, "GET", "/kapi/ozet", { headers: { host: kapi.ofisHost(ofis.id), ...(await c.basliklar("GET", ms)) } });
        if (r.code !== "kapi-cihaz") gecen += 1;
      }
    console.log("kayıtlar:", JSON.stringify(ofisler.map(o => ({ ofis: o.ofis.id, ok: o.ok, code: o.code }))));
    console.log("aynı lisans/makine için kapıcıdan AYNI ANDA geçen cihaz:", gecen, "(lisans sınırı 3)");
    assert.ok(gecen <= 3, `tek lisansla kapıcıdan aynı anda ${gecen} cihaz geçiyor (sınır 3)`);
  });

  it("her ofis kimliği ayrı tünel + DNS kaydı alıyor mu (sahte Cloudflare; sonda duranlar)", async () => {
    const cf = { tunnels: [], cnames: [] };
    const cloudflare = {
      findTunnel: async name => cf.tunnels.find(x => x.name === name) || null,
      createTunnel: async name => {
        const tunnel = { id: globalThis.crypto.randomUUID(), name };
        cf.tunnels.push(tunnel);
        return tunnel;
      },
      ensureCname: async (hostname, target) => {
        if (!cf.cnames.some(x => x.hostname === hostname)) cf.cnames.push({ hostname, target });
      },
      tunnelToken: async () => "sahte-tunel-belirteci",
      deleteTunnel: async id => {
        cf.tunnels = cf.tunnels.filter(x => x.id !== id);
      },
      deleteCname: async hostname => {
        cf.cnames = cf.cnames.filter(x => x.hostname !== hostname);
        return true;
      },
    };
    const istemci = kapiIstemcisi({ url: kapi.base, fetchImpl: (...a) => fetch(...a), simdi: () => T + 1000, kayitSimdi: now });
    const kodlar = [];
    for (let i = 0; i < 5; i += 1) {
      const ofis = await ofisAnahtari();
      const k = await istemci.kayit(ofis, { lisans: belirtec(), cihazlar: [] });
      assert.equal(k.ok, true, JSON.stringify(k));
      const yol = `/v1/ofis/${ofis.id}/tunel`;
      const govde = JSON.stringify({ v: 1, ofis: ofis.id });
      const ms = T + 2000;
      const imza = await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis("POST", yol, ms, await sha256Hex(govde)));
      const req = new Request(`https://kapi.destekofis.test${yol}`, { method: "POST", headers: { "content-type": "application/json", "x-do-zaman": String(ms), "x-do-imza": imza }, body: govde });
      const yanit = await tunelIstegi(req, kapi.env, { now: () => T + 2000, lisansGorunumu: kapi.kapi.lisansGorunumu, cloudflare });
      kodlar.push(yanit.status);
      assert.equal(yanit.status, 200, await yanit.clone().text());
    }
    console.log("tek lisansla SONDA duran tünel:", cf.tunnels.length, "| DNS kaydı:", cf.cnames.length, "| başvuru durumları:", kodlar.join(","));
    assert.ok(cf.tunnels.length <= 1 && cf.cnames.length <= 1, `tek lisans/makine ${cf.tunnels.length} tünel + ${cf.cnames.length} DNS kaydı tutuyor`);
  });
});
