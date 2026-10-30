// 2.4.8 W7 — "WhatsApp'ı Bağla" bağlantısı TAŞINAMAZ (bağımsız gözden geçirme, ORTA; b5deb221 bulut/kapi/wa-bagla.mjs oturumAc / sayfa / kodAl).
// SALDIRI: saldırgan kendi deneme kurulumuyla oturum açar, `kapi.<alan>/wa/bagla#o=…` bağlantısını kurbana "DestekOfis destek: WhatsApp'ınızı bağlayın"
// diye yollar; kurban Embedded Signup'ı tamamlar; kapıcı kodu değiştirip belirteci SALDIRGANIN anahtarına şifrelerdi.
// DÜZELTME: program her oturumda tek kullanımlık SIR üretir (kapıcıya yalnız SHA-256 özeti); ekran sırrı adrese yazmaz, açtığı pencereye postMessage ile verir;
// kapıcı sayfası sırrı yalnız pencereyi açandan ve yerel / özel ağ kökeninden kabul eder; kod değişimi (ve iptal) sırla, kapıcı özeti sabit süreli
// karşılaştırır, sır tek kullanımlık. Tarayıcı tarafı (pencere, postMessage, köken) uçtan uca: test/e2e/senaryo-whatsapp-ayar-248.mjs A7–A10.
// "Nasıl bozulur": sırsız (taşınan) bağlantıyla değişim; başka oturumun / rastgele sırla değişim; aynı sırla ikinci değişim ya da iptal; kapıcı sırrı düz
// saklar; program sırrı adrese / işlem geçmişine yazar; uzak (tünel / genel ad) adresten oturum açılır; firma adı sayfada HTML olarak yorumlanır; sayfa
// başka sitenin çerçevesine alınır; üç köken kuralı (sayfa, program, ekran) ayrışır.
// Gerçek Meta'ya, Cloudflare'e, lisans servisine istek YOK (ders 30). Eski kodda (b5deb221) modüller ad alanıyla yüklenir: dosya yüklenir, denetimler
// davranışla kırmızı olur (ders 38: kırmızının nedeni iletide).
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import * as waBagla from "../bulut/kapi/wa-bagla.mjs";
import * as protokol from "../server/lib/kapi-protokol.mjs";
import * as embedded from "../server/lib/whatsapp/embedded.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";
import { sahteOnbellek, sahteR2, startKapi } from "./kapi-yerel.mjs";
import { rawRequest } from "./mobil-uzak-ortak.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

const T0 = Date.parse("2026-11-20T10:00:00+03:00");
const ALAN = "destekofis.test";
const KAPI = `kapi.${ALAN}`;
const APP_ID = "1505264761663625";
const CONFIG_ID = "990011223344556";
const UYGULAMA_SIRRI = "DESTEKOFIS-META-APP-SECRET-0123456789abcdef";
const META_BELIRTEC = "EAAG-isletme-belirteci-W7-tasinma-0123456789";
const WABA = "102290129340398";
const PNID = "106540352242922";
const WA_ENV = { WA_UYGULAMA_KIMLIGI: APP_ID, WA_KURULUM_KIMLIGI: CONFIG_ID, WA_UYGULAMA_SIRRI: UYGULAMA_SIRRI, WA_GRAPH_URL: "https://meta.kapi.test" };
const YALNIZ = "Bu bağlantı yalnız DestekOfis programından açılır. Bağlantıyı size başkası gönderdiyse pencereyi kapatın.";
const YEREL = "WhatsApp'ı Bağla işlemi ofisteki bilgisayardan yapılır: programı ofis ağındaki bir bilgisayarda açıp yeniden deneyin.";
const yeniSir = () => randomBytes(32).toString("base64url");
const ozet = sir => createHash("sha256").update(sir).digest("hex");

function sahteMeta() {
  const m = { istekler: [] };
  m.fetch = async url => {
    const u = new URL(url);
    m.istekler.push({ host: u.host, path: u.pathname, code: u.searchParams.get("code") });
    return new Response(JSON.stringify({ access_token: META_BELIRTEC, token_type: "bearer" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return m;
}

/** Kapıcı Node'da (sahte R2, sahte saat, sahte Meta). Program kanalı imzalı istekle (server/lib/mobile-ozet.mjs waOturum ile aynı gövde). */
async function kapici() {
  const t = T0;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const meta = sahteMeta();
  const kapi = createKapi({ now: () => t, onbellek: sahteOnbellek(), lisansFetch: async () => ({ json: async () => ({ ok: false }) }), waFetch: meta.fetch, fetchOrigin: async () => new Response("{}", { status: 200 }) });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: ALAN, ...WA_ENV };
  const istek = (url, init) => kapi.fetch(new Request(url, init), env);
  const istemci = kapiIstemcisi({ url: `https://${KAPI}`, fetchImpl: istek, simdi: () => t, kayitSimdi: () => t });
  const c = {
    r2,
    meta,
    async ofis(makine) {
      const o = await ofisAnahtari();
      const r = await istemci.kayit(o, { lisans: lisans.belirtec({ at: t, machine: makine, licenseId: `LIS-${makine.slice(0, 6)}` }), cihazlar: [] });
      assert.equal(r.ok, true, `ön koşul: ofis kaydı ${JSON.stringify(r)}`);
      return o;
    },
    async programAnahtari() {
      const cift = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
      const jwk = await globalThis.crypto.subtle.exportKey("jwk", cift.publicKey);
      return { gizli: cift.privateKey, acik: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
    },
    async ham(o, yol, govde) {
      const metin = JSON.stringify(govde);
      const basliklar = { "content-type": "application/json", "x-do-zaman": String(t), "x-do-imza": await protokol.ecdsaImzala(o.imzaAnahtari, protokol.mesaj.ofis("POST", yol, t, await protokol.sha256Hex(metin))) };
      const r = await istek(`https://${KAPI}${yol}`, { method: "POST", headers: basliklar, body: metin });
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    },
    async oturum(o, { sir = yeniSir(), firma = "Deneme Ticaret Ltd", sirOzetsiz = false } = {}) {
      const p = await c.programAnahtari();
      const ac = await c.ham(o, `/v1/ofis/${o.id}/wa/oturum`, { v: 1, ofis: o.id, anahtar: p.acik, ...(sirOzetsiz ? {} : { sirOzeti: ozet(sir) }), firma });
      return { ac, sir, p, oturum: ac.data?.oturum, adres: ac.data?.adres };
    },
    waAl: (o, oturum) => c.ham(o, `/v1/ofis/${o.id}/wa/oturum/${oturum}/al`, { v: 1, ofis: o.id }),
    async sayfa() {
      const r = await istek(`https://${KAPI}/wa/bagla`, { headers: { accept: "text/html" } });
      return { status: r.status, metin: await r.text(), basliklar: r.headers };
    },
    // Bağlama sayfasının kapıcıya istekleri (aynı köken).
    async sayfaIstegi(yol, govde) {
      const r = await istek(`https://${KAPI}${yol}`, { method: "POST", headers: { "content-type": "application/json", origin: `https://${KAPI}` }, body: JSON.stringify(govde) });
      const metin = await r.text();
      let veri = {};
      try {
        veri = JSON.parse(metin);
      } catch {
        veri = { metin: metin.slice(0, 60) };
      }
      return { status: r.status, tur: r.headers.get("content-type") || "", ...veri };
    },
    kod: (oturum, ek = {}) => c.sayfaIstegi("/wa/bagla/kod", { oturum, kod: "AQD-kurbanin-kodu-0001", wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", ...ek }),
    dogrula: (oturum, ek = {}) => c.sayfaIstegi("/wa/bagla/dogrula", { oturum, ...ek }),
    r2Metni: () => [...r2.nesneler.values()].map(k => new TextDecoder().decode(k.veri)).join("\n"),
    oturumKaydi: oturum => {
      const k = r2.nesneler.get(`wa-oturum/${oturum}.json`);
      return k ? JSON.parse(new TextDecoder().decode(k.veri)) : null;
    },
  };
  return c;
}
const ozetle = r => `${r.status} ${r.code || ""} ${r.data ? JSON.stringify(r.data) : r.metin || ""}`.trim();

describe("2.4.8 W7 taşınamaz bağlantı (A) — kapıcı: sır özeti, sırsız / yanlış sırlı / ikinci kullanım reddi", () => {
  it("TAŞINAN BAĞLANTI: saldırganın oturum adresiyle (sır yok) kod değişimi, iptal ve doğrulama yapılamaz; Meta'ya istek gitmez, oturum bozulmaz", async () => {
    const c = await kapici();
    const saldirgan = await c.ofis("ab".repeat(16));
    const { ac, oturum, adres } = await c.oturum(saldirgan);
    assert.equal(ac.ok, true, `ön koşul: saldırganın oturumu açıldı ${ozetle(ac)}`);
    assert.match(adres, /#o=[A-Za-z0-9_-]{43}$/, "ön koşul: kurbana giden bağlantı");
    // Kurbanın tarayıcısında yalnız bağlantı var (sır programın ekranında; adreste YOK).
    const k = await c.kod(oturum);
    assert.deepEqual([k.status, k.code], [403, "kapi-wa-sir"], `taşınan bağlantı kod değişimi YAPTI (kurbanın belirteci saldırganın anahtarına şifrelenir): ${ozetle(k)}`);
    assert.equal(k.error, YALNIZ, "ret iletisi");
    assert.equal(c.meta.istekler.length, 0, `sırsız istekte Meta'ya kod değişimi gitti (${c.meta.istekler.length})`);
    const iptal = await c.kod(oturum, { hata: "iptal", ileti: "x", kod: undefined });
    assert.deepEqual([iptal.status, iptal.code], [403, "kapi-wa-sir"], `sırsız iptal oturumu kapattı: ${ozetle(iptal)}`);
    const d = await c.dogrula(oturum);
    assert.deepEqual([d.status, d.code], [403, "kapi-wa-sir"], `sırsız doğrulama firma adını verdi: ${ozetle(d)}`);
    assert.equal(c.oturumKaydi(oturum)?.durum, "bekliyor", "reddedilen istekler oturuma dokunmadı");
    assert.equal((await c.waAl(saldirgan, oturum)).data?.durum, "bekliyor", "saldırganın programı belirteç alamaz");
  });

  it("YANLIŞ SIR: başka oturumun sırrı ve rastgele sır reddedilir; doğru sırla doğrulama firma adını verir, değişim olur", async () => {
    const c = await kapici();
    const o = await c.ofis("ab".repeat(16));
    const a = await c.oturum(o);
    const b = await c.oturum(o);
    assert.ok(a.oturum && b.oturum, `ön koşul: iki oturum ${ozetle(a.ac)} / ${ozetle(b.ac)}`);
    for (const [ad, sir] of [["başka oturumun sırrı", b.sir], ["rastgele sır", yeniSir()], ["biçimsiz sır", "kisa"], ["özet (sır yerine)", ozet(a.sir)]]) {
      const k = await c.kod(a.oturum, { sir });
      assert.deepEqual([k.status, k.code], [403, "kapi-wa-sir"], `${ad} kabul edildi: ${ozetle(k)}`);
      const d = await c.dogrula(a.oturum, { sir });
      assert.deepEqual([d.status, d.code], [403, "kapi-wa-sir"], `${ad} doğrulamada kabul edildi: ${ozetle(d)}`);
    }
    assert.equal(c.meta.istekler.length, 0, "yanlış sırla Meta'ya gidilmedi");
    const d = await c.dogrula(a.oturum, { sir: a.sir });
    assert.deepEqual([d.status, d.data?.firma], [200, "Deneme Ticaret Ltd"], `doğru sırla doğrulama: ${ozetle(d)}`);
    assert.ok(d.data.kalanSn > 0 && d.data.kalanSn <= 600, `kalan süre ${d.data.kalanSn}`);
    const k = await c.kod(a.oturum, { sir: a.sir });
    assert.deepEqual([k.status, k.data?.durum], [200, "hazir"], `doğru sırla değişim: ${ozetle(k)}`);
    assert.equal(c.meta.istekler.length, 1);
    const al = await c.waAl(o, a.oturum);
    assert.equal(await protokol.waCoz(a.p.gizli, al.data.sifreli, protokol.waBaglam(o.id, a.oturum)), META_BELIRTEC, "belirteç oturumu açan programa");
  });

  it("SIR TEK KULLANIMLIK: değişimden sonra aynı sırla ikinci kod / iptal / doğrulama 409; teslimden sonra oturum yok; iptalden sonra da kod yok", async () => {
    const c = await kapici();
    const o = await c.ofis("ab".repeat(16));
    const a = await c.oturum(o);
    const once = await c.dogrula(a.oturum, { sir: a.sir });
    assert.deepEqual([once.status, once.data?.firma], [200, "Deneme Ticaret Ltd"], `ön koşul: doğru sırla doğrulama (sırrı tüketmez): ${ozetle(once)}`);
    assert.equal((await c.kod(a.oturum, { sir: a.sir })).data?.durum, "hazir", "ilk kullanım");
    for (const [ad, istek] of [["ikinci kod", () => c.kod(a.oturum, { sir: a.sir, kod: "AQD-ikinci-kod" })], ["iptal", () => c.kod(a.oturum, { sir: a.sir, hata: "iptal", ileti: "x" })], ["doğrulama", () => c.dogrula(a.oturum, { sir: a.sir })]]) {
      const r = await istek();
      assert.deepEqual([r.status, r.code], [409, "kapi-wa-kullanildi"], `aynı sırla ${ad}: ${ozetle(r)}`);
    }
    assert.deepEqual(c.meta.istekler.map(x => x.code), ["AQD-kurbanin-kodu-0001"], "Meta'ya tek değişim");
    assert.equal((await c.waAl(o, a.oturum)).data?.durum, "hazir");
    assert.equal((await c.kod(a.oturum, { sir: a.sir })).code, "kapi-wa-oturum", "teslimden sonra oturum silindi");
    const b = await c.oturum(o);
    assert.equal((await c.kod(b.oturum, { sir: b.sir, hata: "iptal", ileti: "Bağlama yarıda bırakıldı." })).data?.durum, "hata", "ön koşul: iptal");
    const sonra = await c.kod(b.oturum, { sir: b.sir });
    assert.deepEqual([sonra.status, sonra.code], [409, "kapi-wa-kullanildi"], `iptalden sonra aynı sırla kod: ${ozetle(sonra)}`);
    assert.equal(c.meta.istekler.length, 1);
  });

  it("kapıcı sırrı SAKLAMAZ (yalnız SHA-256 özeti); sır özeti olmayan oturum açılmaz; firma adından denetim / yön karakterleri çıkar", async () => {
    const c = await kapici();
    const o = await c.ofis("ab".repeat(16));
    const ozetsiz = await c.oturum(o, { sirOzetsiz: true });
    assert.deepEqual([ozetsiz.ac.status, ozetsiz.ac.code], [400, "kapi-istek"], `sır özeti olmadan oturum açıldı (sayfa taşınabilir kalır): ${ozetle(ozetsiz.ac)}`);
    const a = await c.oturum(o, { firma: "Kurban‮ Ticaret\u0007\n Ltd" });
    const kayit = c.oturumKaydi(a.oturum);
    assert.equal(kayit?.sirOzeti, ozet(a.sir), `oturum kaydında sır özeti: ${JSON.stringify(kayit && Object.keys(kayit))}`);
    assert.ok(!c.r2Metni().includes(a.sir), "sırrın kendisi R2'ye yazılmaz");
    assert.equal(kayit.firma, "Kurban Ticaret Ltd", "firma adı: yön (RLO) ve denetim karakterleri çıkarıldı");
    const d = await c.dogrula(a.oturum, { sir: a.sir });
    assert.equal(d.data?.firma, "Kurban Ticaret Ltd");
    assert.ok(!JSON.stringify(d).includes(a.sir), "doğrulama yanıtında sır yok");
  });

  it("sayfa: firma adı yalnız textContent ile (HTML yorumlanmaz), SDK sır doğrulanmadan yüklenmez, çerçeveye alınamaz, COOP yok, sır adreste yok", async () => {
    const c = await kapici();
    const o = await c.ofis("ab".repeat(16));
    const XSS = `Kötü <script>window.__xss=1</script><img src=x onerror="window.__xss=2"> & "Ltd"`;
    const a = await c.oturum(o, { firma: XSS });
    assert.ok(!a.adres.includes(a.sir), "bağlantı adresinde sır yok");
    const d = await c.dogrula(a.oturum, { sir: a.sir });
    assert.deepEqual([d.status, d.tur.startsWith("application/json"), d.data?.firma], [200, true, XSS], `doğrulama firma adını JSON metin olarak verir: ${ozetle(d)}`);
    const s = await c.sayfa();
    assert.equal(s.status, 200);
    assert.ok(!s.metin.includes("window.__xss"), "firma adı sayfa kaynağına girmez (oturuma göre değil, sırla gelir)");
    assert.match(s.metin, /getElementById\('wa-firma'\)\.textContent=/, "firma adı textContent ile basılır");
    assert.doesNotMatch(s.metin, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, "sayfa betiğinde HTML yorumlayan yazım yok");
    assert.match(s.metin, /Bağlanacak Program: <strong id="wa-firma"><\/strong>/, "Bağlanacak Program alanı (boş; sır doğrulanınca dolar)");
    assert.doesNotMatch(s.metin, /<script[^>]*\ssrc=/, "Facebook SDK betik etiketi sayfada yok (sır doğrulanınca betikle yüklenir)");
    const csp = s.basliklar.get("content-security-policy") || "";
    assert.match(csp, /frame-ancestors 'none'/, `CSP frame-ancestors 'none': ${csp}`);
    assert.equal(s.basliklar.get("x-frame-options"), "DENY", "X-Frame-Options DENY");
    assert.equal(s.basliklar.get("cross-origin-opener-policy"), null, "sayfa COOP koymaz (pencereyi açanla bağ gerekli)");
    assert.ok(s.metin.includes(YALNIZ), "taşınan bağlantı iletisi sayfada (wa-ayar)");
    assert.match(s.metin, /e\.source!==acan\|\|!yerelKoken\(e\.origin\)/, "sır yalnız pencereyi açandan ve yerel kökenden");
  });
});

// Üç köken kuralı tek tabloyla: kapıcı sayfası (yerelKoken — asıl denetim), program sunucusu (isLocalOrigin — oturum açma), ekran (isLocalOrigin — düğme).
const KOKENLER = [
  ["http://localhost:4100", true],
  ["http://localhost", true],
  ["https://localhost:8443", true],
  ["http://127.0.0.1:4100", true],
  ["http://127.45.6.7", true],
  ["http://[::1]:4100", true],
  ["http://10.0.0.5:4100", true],
  ["http://172.16.0.1", true],
  ["http://172.31.255.254:4100", true],
  ["http://192.168.1.10:4100", true],
  ["http://ofis-pc.local:4100", true],
  ["https://o5rxbrt4ejchw464e.destekofis.net", false],
  ["https://kapi.destekofis.net", false],
  ["https://saldirgan.example", false],
  ["http://172.15.0.1", false],
  ["http://172.32.0.1", false],
  ["http://192.169.1.1", false],
  ["http://11.0.0.1", false],
  ["http://100.64.0.1", false],
  ["http://169.254.1.1", false],
  ["http://ofis-pc:4100", false],
  ["http://ofis.lan", false],
  ["http://router.home.arpa", false],
  ["http://sunucu.internal", false],
  ["http://local", false],
  ["http://localhost.saldirgan.example", false],
  ["http://127.0.0.1.nip.io", false],
  ["http://[fd00::1]", false],
  ["null", false],
  ["file://", false],
  ["ftp://127.0.0.1", false],
  ["http://127.0.0.1:4100/yol", false],
  ["http://kullanici@127.0.0.1", false],
  ["", false],
  ["javascript:alert(1)", false],
];

describe("2.4.8 W7 taşınamaz bağlantı (B) — köken kuralı: sayfa, program ve ekran aynı", () => {
  it("kapıcı sayfasının yerelKoken'i, programın isLocalOrigin'i ve ekranın kopyası aynı tabloyu verir", async () => {
    const c = await kapici();
    const sayfa = (await c.sayfa()).metin;
    const satir = /^function yerelKoken\(k\)\{.*\}$/m.exec(sayfa);
    assert.ok(satir, "kapıcı sayfasında yerelKoken kuralı yok (sır her kökenden kabul edilir)");
    const sayfaKurali = new Function(`${satir[0]}; return yerelKoken;`)();
    const ekranKaynagi = readFileSync(new URL("../client/assets/hof-whatsapp-ayar.js", import.meta.url), "utf8");
    const parca = /\/\/ <yerel-koken>\r?\n([\s\S]*?)\r?\n\s*\/\/ <\/yerel-koken>/.exec(ekranKaynagi); // ders 27: Windows CRLF
    assert.ok(parca, "ekranda isLocalOrigin kuralı yok");
    const ekranKurali = new Function(`${parca[1]}; return isLocalOrigin;`)();
    assert.equal(typeof embedded.isLocalOrigin, "function", "programda isLocalOrigin yok");
    const farklar = [];
    for (const [koken, beklenen] of KOKENLER) {
      const sonuc = [sayfaKurali(koken), embedded.isLocalOrigin(koken), ekranKurali(koken)];
      if (sonuc.some(x => x !== beklenen)) farklar.push(`${koken || "(boş)"}: beklenen ${beklenen}, sayfa/program/ekran ${sonuc.join("/")}`);
    }
    assert.deepEqual(farklar, []);
  });
});

describe("2.4.8 W7 taşınamaz bağlantı (C) — program: sır ekrana (adrese değil), kapıcıya özet; uzak / genel adresten oturum açılmaz", () => {
  async function program() {
    const clock = createClock({ time: new Date(T0).toISOString(), fixed: true });
    const lisans = lisansAnahtari();
    const MACHINE = "0123456789abcdef0123456789abcdef";
    const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-W7-TASINMA" });
    const meta = sahteMeta();
    const graph = await startFakeGraph({ token: META_BELIRTEC, phoneNumberId: PNID, wabaId: WABA });
    const kapi = await startKapi({ now: () => clock.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }), ekEnv: WA_ENV, waFetch: meta.fetch });
    const server = await startTestServer({
      now: clock,
      remoteNow: clock,
      mobileKapiUrl: kapi.base,
      whatsappGraphUrl: graph.url,
      whatsappTimeoutMs: 1500,
      license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.w7.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
    });
    await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    const admin = await loginAdmin(server);
    assert.equal((await admin.put("/api/admin/office", { name: "Kurban Hukuk Bürosu" })).status, 200, "ön koşul: ofis adı");
    return {
      meta,
      kapi,
      server,
      admin,
      // Program ekranının isteği, istenen Host başlığıyla (tarayıcının adres çubuğundaki ad).
      bagla: host => rawRequest(server.base, "POST", "/api/workspace/whatsapp/connection/embedded", { headers: { host, cookie: admin.cookie }, body: {} }),
      close: async () => {
        await server.close().catch(() => {});
        await kapi.close();
        await graph.close();
      },
    };
  }

  it("yerel adresten: yanıtta tek kullanımlık sır (43 karakter) var, adreste yok; kapıcıya yalnız özeti ve firma adı gider; sır işlem geçmişine girmez", async () => {
    const c = await program();
    try {
      const port = new URL(c.server.base).port;
      for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `192.168.1.10:${port}`]) {
        const r = await c.bagla(host);
        assert.equal(r.status, 200, `${host}: ${r.text.slice(0, 200)}`);
        const { session, url, secret } = r.data.data;
        assert.match(String(secret || ""), /^[A-Za-z0-9_-]{43}$/, `${host}: yanıtta tek kullanımlık sır yok (${JSON.stringify(Object.keys(r.data.data))})`);
        assert.ok(!url.includes(secret), `${host}: sır bağlantı adresinde`);
        const kayit = JSON.parse(new TextDecoder().decode(c.kapi.r2.nesneler.get(`wa-oturum/${session}.json`).veri));
        assert.deepEqual([kayit.sirOzeti, kayit.firma], [ozet(secret), "Kurban Hukuk Bürosu"], `${host}: kapıcıda özet + firma`);
        assert.ok(!JSON.stringify(kayit).includes(secret), `${host}: kapıcıya sırrın kendisi gitti`);
        const gecmis = JSON.stringify(c.server.app.store.all("SELECT * FROM audit_events")) + JSON.stringify(c.server.app.store.all("SELECT key, value FROM settings"));
        assert.ok(!gecmis.includes(secret), `${host}: sır işlem geçmişinde / ayarlarda`);
      }
      assert.ok(c.kapi.gunluk.every(g => !/sir|secret/i.test(g.adres)), "kapıcı adreslerinde sır yok");
    } finally {
      await c.close();
    }
  });

  it("uzak / genel adresten (tünel adı, genel ad, tek etiketli ad): 409 'WhatsApp'ı Bağla işlemi ofisteki bilgisayardan yapılır'; kapıcıda oturum açılmaz", async () => {
    const c = await program();
    try {
      const port = new URL(c.server.base).port;
      const once = c.kapi.gunluk.filter(g => g.adres.includes("/wa/oturum")).length;
      for (const host of ["o5rxbrt4ejchw464e.destekofis.net", `ofis.ornek.com.tr:${port}`, `ofis-pc:${port}`]) {
        const r = await c.bagla(host);
        assert.deepEqual([r.status, r.code, r.data?.error], [409, "whatsapp-embedded-local", YEREL], `${host}: ${r.text.slice(0, 200)}`);
      }
      assert.equal(c.kapi.gunluk.filter(g => g.adres.includes("/wa/oturum")).length, once, "uzak adresten kapıcıya oturum isteği gitmedi");
      // Uzak dinleyiciden gelen istek (isRemoteRequest): yerel adla gelse bile reddedilir (savunma derinliği; uzak dinleyici bu yolu zaten açmaz).
      const sahte = embedded.createEmbeddedSignup({ mobileSync: () => ({ enabled: () => true, waOturumAc: async () => assert.fail("uzak istekte kapıcıya gidildi") }) });
      await assert.rejects(sahte.start({ companyId: "x", origin: "http://127.0.0.1:4100", remote: true }), error => error.status === 409 && error.extra?.code === "whatsapp-embedded-local");
    } finally {
      await c.close();
    }
  });

  it("Yönetim sayfası Cross-Origin-Opener-Policy: same-origin-allow-popups (bağlama penceresiyle bağ); öbür sayfalar same-origin kalır", async () => {
    const c = await program();
    try {
      const admin = await c.admin.raw("GET", "/admin.html");
      assert.equal(admin.status, 200);
      assert.equal(admin.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups", "admin.html same-origin ile pencereyle bağı keser: program pencereyi 'kapandı' sanar, sır verilemez");
      for (const yol of ["/", "/index.html", "/mobil/"]) {
        const r = await c.admin.raw("GET", yol);
        if (r.status !== 200) continue;
        assert.equal(r.headers.get("cross-origin-opener-policy"), "same-origin", `${yol} same-origin kalır`);
      }
    } finally {
      await c.close();
    }
  });
});

// Kılavuzda ve iletide aynı cümle (kapıcı tek kaynak).
it("ileti sabitleri: kapıcının taşınan bağlantı iletisi ve programın yerel adres iletisi", () => {
  assert.equal(waBagla.WA_YALNIZ_PROGRAM, YALNIZ, "kapıcıda taşınan bağlantı iletisi yok");
  assert.equal(embedded.EMBEDDED_LOCAL_ONLY, YEREL, "programda yerel adres iletisi yok");
});
