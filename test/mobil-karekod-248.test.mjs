// 2.4.8 M4/M5 — iPhone eşleme akışı ve "Son Özeti Göster" (docs/2.4.8-IS-LISTESI.md "KARAR M4", "KARAR M5"; client/mobil/karekod.js, app.js, index.html).
// Denenen: (1) iOS / simge algılaması (iPhone, iPad masaüstü imzası, Android, masaüstü; navigator.standalone ve display-mode); (2) karekod metninden eşleme kodu —
// yalnız BU ofisin /mobil/#eslesme= adresi, başka ofis / başka site / biçimsiz → açık ileti; (3) programın KENDİ karekodu (qr.mjs encodeQr; Yönetim → Mobil Cihazlar'ın
// ürettiği adres) piksellere çizilip depodaki çözücüyle (client/mobil/vendor/jsqr-1.4.0.js) okunur → aynı kod; (4) çözücü dosyası npm jsqr@1.4.0 ile bayt bayt aynı
// (lisans dosyası yanında); (5) mobil sayfada kamera izni (Permissions-Policy camera=(self)) yalnız /mobil/ belgesinde, masaüstünde kapalı; (6) hizmet çalışanı karekod.js'i
// kabukta tutar; (7) kılavuz iPhone akışını anlatır; (8) M5: "Son Özeti Göster" formun ÜSTÜNDE ve uyarı cümlesi.
// Eski kodda (e7c7338d) karekod.js / çözücü yok, başlık camera=(), kılavuz "Safari'de eşle, sonra Ana Ekrana Ekle", düğme formun altında → kırmızı (iletide neden).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { encodeQr } from "../server/lib/qr.mjs";
import { ADMIN_PASSWORD, createClient, startTestServer } from "./helpers.mjs";

const ROOT = new URL("../", import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), "utf8");
const karekod = await import("../client/mobil/karekod.js").catch(error => ({ missing: `client/mobil/karekod.js yüklenemedi (${error.code || error.message})` }));
const need = () => assert.ok(!karekod.missing, karekod.missing);
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const win = (ua, { standalone, displayMode = false, touch = 0 } = {}) => ({
  navigator: { userAgent: ua, maxTouchPoints: touch, ...(standalone === undefined ? {} : { standalone }) },
  matchMedia: q => ({ matches: q === "(display-mode: standalone)" && displayMode }),
});

/** Karekod modüllerini RGBA piksellere çizer (ölçek 6, sessiz bölge 4 modül) — kameranın gördüğü ekrandaki karekod. */
function rasterize(text, scale = 6, quiet = 4) {
  const { size, modules } = encodeQr(text);
  const full = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(full * full * 4).fill(255);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy += 1)
        for (let dx = 0; dx < scale; dx += 1) {
          const i = (((y + quiet) * scale + dy) * full + (x + quiet) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }
  return { data, width: full, height: full };
}

describe("2.4.8 M4 iOS / simge algılaması (client/mobil/karekod.js)", () => {
  it("iPhone ve iPad (masaüstü imzası + dokunmatik) iOS; Android ve masaüstü değil", () => {
    need();
    assert.equal(karekod.iosMu(win(IPHONE).navigator), true, "iPhone");
    assert.equal(karekod.iosMu(win(IPAD_DESKTOP, { touch: 5 }).navigator), true, "iPadOS (Macintosh + dokunmatik)");
    assert.equal(karekod.iosMu(win(IPAD_DESKTOP, { touch: 0 }).navigator), false, "gerçek Mac");
    assert.equal(karekod.iosMu(win(ANDROID).navigator), false, "Android");
    assert.equal(karekod.iosMu(win(DESKTOP).navigator), false, "masaüstü");
  });
  it("tarayıcı sekmesi ↔ ana ekran simgesi: navigator.standalone ya da display-mode: standalone", () => {
    need();
    assert.equal(karekod.iosTarayici(win(IPHONE, { standalone: false })), true, "iPhone Safari sekmesi → yönlendirme");
    assert.equal(karekod.iosTarayici(win(IPHONE)), true, "standalone alanı yok (başka iOS tarayıcısı) → yönlendirme");
    assert.equal(karekod.iosSimge(win(IPHONE, { standalone: true })), true, "iPhone simgesi");
    assert.equal(karekod.iosTarayici(win(IPHONE, { standalone: true })), false);
    assert.equal(karekod.iosSimge(win(IPHONE, { standalone: false, displayMode: true })), true, "display-mode: standalone da simge sayılır");
    assert.equal(karekod.iosTarayici(win(ANDROID, { standalone: false })), false, "Android tarayıcı: bugünkü akış (yönlendirme yok)");
    assert.equal(karekod.iosSimge(win(ANDROID, { displayMode: true })), false, "Android simgesi: bugünkü akış");
    assert.equal(karekod.iosTarayici(win(DESKTOP)), false, "masaüstü: bugünkü akış");
    assert.equal(karekod.simgeMi({ navigator: {}, matchMedia: () => { throw new Error("yok"); } }), false, "matchMedia hata verirse simge sayılmaz");
  });
});

describe("2.4.8 M4 karekod metninden eşleme kodu — yalnız bu ofisin adresi", () => {
  const konum = { origin: "https://o5rxbrt4ejchw464e.destekofis.net" };
  const KOD = "Ab3_dE-fGh1JkLmN0pQr";
  it("bu ofisin eşleme adresi → kod", () => {
    need();
    assert.deepEqual(karekod.eslesmeKodu(`${konum.origin}/mobil/#eslesme=${KOD}`, konum), { kod: KOD });
    assert.deepEqual(karekod.eslesmeKodu(`  ${konum.origin}/mobil/#eslesme=${KOD}\n`, konum), { kod: KOD }, "baştaki/sondaki boşluk");
  });
  it("başka ofisin adresi → 'başka bir ofisin' iletisi; biçimsiz / başka site / yol → 'eşleme karekodu değil'", () => {
    need();
    assert.equal(karekod.eslesmeKodu(`https://baskaofis1234.destekofis.net/mobil/#eslesme=${KOD}`, konum).hata, karekod.ILETI.baskaOfis);
    assert.match(karekod.ILETI.baskaOfis, /başka bir ofisin/);
    for (const metin of ["merhaba", "", null, `${konum.origin}/mobil/`, `${konum.origin}/mobil/#eslesme=kisa`, `${konum.origin}/admin.html#eslesme=${KOD}`, `${konum.origin}/mobil/?x=1#eslesme=${KOD}`, `javascript:alert(1)//#eslesme=${KOD}`, `https://u:p@o5rxbrt4ejchw464e.destekofis.net/mobil/#eslesme=${KOD}`, `${konum.origin}/mobil/#eslesme=${KOD}&x=<b>`]) {
      const r = karekod.eslesmeKodu(metin, konum);
      assert.equal(r.kod, undefined, `kabul edilmemeli: ${metin}`);
      assert.equal(r.hata, karekod.ILETI.degil, `ileti: ${metin}`);
    }
  });
  it("kamera hataları açık ileti verir (izin reddi ayrı)", () => {
    need();
    assert.equal(karekod.kameraHatasi({ name: "NotAllowedError" }), karekod.ILETI.izin);
    assert.match(karekod.ILETI.izin, /Kamera izni verilmedi/);
    assert.equal(karekod.kameraHatasi({ name: "NotFoundError" }), karekod.ILETI.kameraYok);
    assert.equal(karekod.kameraHatasi({ name: "TypeError" }), karekod.ILETI.desteklenmiyor);
  });
});

describe("2.4.8 M4 karekod çözücü (client/mobil/vendor/jsqr-1.4.0.js; Apache 2.0)", () => {
  const VENDOR = "client/mobil/vendor/jsqr-1.4.0.js";
  it("çözücü npm jsqr@1.4.0 dist/jsQR.js ile bayt bayt aynı (yalnız ES modülü sarmalı); lisans ve kaynak dosya başında, lisans metni yanında", () => {
    assert.ok(existsSync(new URL(VENDOR, ROOT)), `${VENDOR} yok (karekod çözücü depoda değil)`);
    const src = read(VENDOR).replace(/\r\n/g, "\n");
    assert.match(src, /Apache License 2\.0/);
    assert.match(src, /https:\/\/github\.com\/cozmo\/jsQR/);
    const start = src.indexOf("(function webpackUniversalModuleDefinition");
    const end = src.lastIndexOf("export default module.exports;");
    assert.ok(start > 0 && end > start, "sarmal biçimi");
    const lib = src.slice(start, end).replace(/\n$/, "");
    const hash = createHash("sha256").update(lib).digest("hex");
    assert.equal(hash, "bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859", "kütüphane gövdesi değişmemeli");
    assert.ok(src.includes(hash), "dosya başı kaynak özetini yazar");
    assert.match(read("client/mobil/vendor/jsqr-LICENSE.txt"), /Apache License\s+Version 2\.0/);
    assert.ok(!/\bhttps?:\/\/(cdn|unpkg|jsdelivr)/i.test(read("client/mobil/karekod.js")), "CDN yok");
  });
  it("programın kendi karekodu (Yönetim → Mobil Cihazlar adresi) piksellerden okunur → aynı eşleme kodu", async () => {
    need();
    const server = await startTestServer({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    try {
      const address = await server.app.listenRemote(0, "127.0.0.1");
      const remote = `http://127.0.0.1:${address.port}`;
      server.app.mobileRemote.setPublicUrl(remote);
      const api = createClient(server.base);
      await api.login("admin", ADMIN_PASSWORD);
      const me = (await api.get("/api/admin/users")).data.data.find(user => user.username === "admin");
      assert.equal((await api.put(`/api/admin/mobile/access/${me.id}`, { remote: true })).status, 200);
      const code = (await api.post("/api/admin/mobile/codes", { userId: me.id })).data.data;
      assert.ok(code?.url?.startsWith(`${remote}/mobil/#eslesme=`), `karekod adresi: ${code?.url}`);
      const jsQR = await karekod.cozucu();
      const img = rasterize(code.url);
      const text = karekod.kareCoz(jsQR, img.data, img.width, img.height);
      assert.equal(text, code.url, "çözücü programın karekodunu okumalı");
      assert.deepEqual(karekod.eslesmeKodu(text, { origin: remote }), { kod: code.code });
      assert.equal(karekod.eslesmeKodu(text, { origin: "https://baska.destekofis.net" }).hata, karekod.ILETI.baskaOfis);
      const blank = new Uint8ClampedArray(img.data.length).fill(255);
      assert.equal(karekod.kareCoz(jsQR, blank, img.width, img.height), null, "boş karede karekod yok");
    } finally {
      await server.close();
    }
  });
});

describe("2.4.8 M4 sunucu: kamera izni yalnız mobil sayfada; kabuk karekod.js'i taşır", () => {
  let server;
  let remote;
  before(async () => {
    server = await startTestServer({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const address = await server.app.listenRemote(0, "127.0.0.1");
    remote = `http://127.0.0.1:${address.port}`;
  });
  after(() => server?.close());
  it("/mobil/ belgesi camera=(self) (ofis ağı + uzak dinleyici); masaüstü ve öbür yanıtlar camera=()", async () => {
    for (const base of [server.base, remote]) {
      for (const p of ["/mobil/", "/mobil/index.html"]) {
        const res = await fetch(base + p, { headers: { "user-agent": IPHONE } });
        assert.equal(res.status, 200, `${base}${p}`);
        const pp = res.headers.get("permissions-policy") || "";
        assert.match(pp, /(^|, )camera=\(self\)/, `${base}${p}: simgede Karekodu Okut için kamera kendi kökenine açık olmalı (gelen "${pp}")`);
        assert.match(pp, /microphone=\(\)/, "mikrofon kapalı kalır");
      }
    }
    for (const p of ["/index.html", "/mobil/app.js", "/admin.html"]) {
      const res = await fetch(server.base + p, { redirect: "manual" });
      assert.match(res.headers.get("permissions-policy") || "", /camera=\(\)/, `${p}: kamera kapalı kalmalı`);
    }
    const kod = await fetch(`${server.base}/mobil/karekod.js`);
    assert.equal(kod.status, 200, "karekod.js sunulmalı");
    const coz = await fetch(`${server.base}/mobil/vendor/jsqr-1.4.0.js`);
    assert.equal(coz.status, 200, "çözücü sunulmalı");
    assert.match(coz.headers.get("content-type") || "", /javascript/);
  });
  it("hizmet çalışanı karekod.js'i kabukta tutar (app.js'in durağan içe aktarması; sunucu kapalıyken sayfa açılır)", () => {
    const sw = read("client/mobil/sw.js");
    assert.match(sw, /"karekod\.js"/, "sw.js ASSETS karekod.js içermeli");
    assert.match(read("client/mobil/app.js"), /from '\.\/karekod\.js'/);
  });
});

describe("2.4.8 M4/M5 ekran ve kılavuz metinleri", () => {
  const html = read("client/mobil/index.html");
  it("M4: yönlendirme sayfası üç adım, eşleme yok; simgede Karekodu Okut + yeni karekod notu", () => {
    const guide = /<div id="ios-guide"[\s\S]*?<\/ol>/.exec(html)?.[0] || "";
    assert.ok(guide, "ios-guide paneli yok");
    assert.match(guide, /Paylaş düğmesine dokunun → <b>Ana Ekrana Ekle<\/b>/);
    assert.match(guide, /Ana ekrandaki <b>DestekOfis<\/b> simgesini açın/);
    assert.match(guide, /<b>Karekodu Okut<\/b> ile bilgisayardaki aynı karekodu okutun \(karekod 5 dakika geçerli\)/);
    assert.ok(!/<button|<input/.test(guide), "yönlendirme sayfası seçenek / düğme sunmaz");
    assert.match(html, /id="scan-open">Karekodu Okut/);
    assert.match(html, /yöneticinizden yeni karekod isteyin/);
  });
  it("M5: Son Özeti Göster giriş formunun alanlarından ÖNCE; uyarı cümlesi", () => {
    const form = /<form id="login-form"[\s\S]*?<\/form>/.exec(html)?.[0] || "";
    const note = form.indexOf('id="offline-note"');
    assert.ok(note > 0, "offline-note giriş formunda olmalı");
    assert.ok(note < form.indexOf('id="username"'), "Son Özeti Göster kullanıcı adı alanının ÜSTÜNDE olmalı");
    assert.match(form, /Son Özeti Göster'e basarak son yüklenen bilgileri görebilirsiniz/);
    assert.match(read("client/mobil/ozet.js"), /OFFLINE_HINT = "Son Özeti Göster'e basarak son yüklenen bilgileri görebilirsiniz\."/);
  });
  it("kılavuz: iPhone'da Ana Ekrana Ekle → simgede Karekodu Okut; Android bugünkü gibi", () => {
    const k = read("docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html");
    assert.match(k, /<b>iPhone ve iPad:<\/b>[^\n]*<b>Ana Ekrana Ekle<\/b>[^\n]*<b>Karekodu Okut<\/b>/);
    assert.match(k, /<b>Android telefon:<\/b>[^\n]*<b>Eşleştir<\/b>/);
    assert.ok(!k.includes("iPhone'da Safari'de Paylaş → <b>Ana Ekrana Ekle</b>"), "eski 'Safari'de eşle, sonra ana ekrana ekle' sırası kalmamalı");
  });
});
