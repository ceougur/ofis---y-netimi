// 2.4.4 iş listesi 24 — gerçek EDM test ortamı düzeneği (tools/edm-gercek.mjs) kendi güvenceleriyle: adres bekçisi canlıya (ve izin listesi dışındaki her
// adrese) isteği ağa çıkarmadan düşürür; giriş başarısızsa betik HEMEN durur (tek Login, yeniden deneme yok); kimlik bilgisi hiçbir çıktıya girmez; kuru
// koşu (sahte EDM) bütün adımları uçtan uca geçer. Gerçek EDM'ye bağlanılmaz (kuru kip yalnız yerel adrese izin verir).
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan):
//   D1 betik canlıya gider: Servis Adresi / ortam canlı, e-SMM adresi canlıdan türetilir, adresin büyük harf / port / yol / alt alan adı varyantı geçer
//   D2 bekçi isteği reddeder ama program bunu "belirsiz gönderim" sayar (numara harcanır) → ret "bağlantı kurulamadı" sınıfında olmalı
//   D3 giriş başarısızken betik sürer ya da yeniden dener (EDM hesabı kilitlenir)
//   D4 kullanıcı adı / parola JSON'a, OZET'e, XML'e, ekrana (stdout) düşer
//   D5 önceki gerçek koşunun kanıtı yeni koşuyla sessizce ezilir
//   D6 üretim girişi e-SMM'yi açmıyorken düzenek kendi bayrağıyla açıp "üretimde çalışıyor" der
//   D7 kimlik bilgisi verilmeden betik ağa çıkar
//   D8 test ortamının e-SMM şablonu VKN'li düzenleyende unvanı basmıyor (EDM yanıtı 22.10.2026: kural PartyName, canlı GİB standardında) → düzenek bunu
//      "kaldı" sayıp her gerçek koşuyu düşürür; ya da tersine e-Arşiv / TCKN'li düzenleyende eksik unvanı da görmezden gelir
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import { EDM_SMM_URLS, EDM_URLS, createEdmSmmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { startMockEdm } from "./einvoice-mock.mjs";
import { TEST_URLS, ardisikNumara, bekciFetch, edmOkuyucu, izinliAdres, izleyiciFetch, maskeci, soapIslemi, unvanDenetimi, uretimBayraklari } from "../tools/edm-gercek.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(ROOT, "tools", "edm-gercek.mjs");
const MOCK = { EDM_TEST_KULLANICI: "edmkullanici", EDM_TEST_PAROLA: "Gizli-Parola-1" };
const dirs = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "edm-duzenek-"));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
// Betik ayrı süreçte (gerçek kullanım gibi); ders 30: lisans servisi yerel ölü adres (betik kendisi de verir).
const runTool = (args, env) => {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("EDM_TEST_")));
  return spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", TOOL, ...args], { cwd: ROOT, env: { ...clean, HUKUK_LICENSE_URL: "http://127.0.0.1:9", ...env }, encoding: "utf8", timeout: 240_000 });
};
const files = dir => readdirSync(dir).flatMap(name => (statSync(path.join(dir, name)).isDirectory() ? files(path.join(dir, name)).map(item => path.join(name, item)) : [name]));
const json = (dir, name) => JSON.parse(readFileSync(path.join(dir, name), "utf8"));

describe("D1/D2: adres bekçisi (izin listesi)", () => {
  test("gerçek kipte yalnız EDM test ortamının iki servisi (WSDL sorguları dahil) ve yerel adres; kuru kipte yalnız yerel", () => {
    for (const url of [TEST_URLS.fatura, TEST_URLS.smm, `${TEST_URLS.fatura}?singleWsdl`, `${TEST_URLS.smm}?wsdl`, `${TEST_URLS.fatura}?xsd=xsd0`]) {
      assert.equal(izinliAdres(url, { mod: "gercek" }), true, url);
      assert.equal(izinliAdres(url, { mod: "kuru" }), false, `kuru kipte ağa çıkılmaz: ${url}`);
    }
    for (const url of ["http://127.0.0.1:5123/EFaturaEDM21ea/EFaturaEDM.svc", "http://localhost:9/", "http://127.0.0.1:9"]) {
      assert.equal(izinliAdres(url, { mod: "kuru" }), true, url);
      assert.equal(izinliAdres(url, { mod: "gercek" }), true, url);
    }
  });
  test("canlı EDM ve her varyantı reddedilir (büyük harf, port, yol, http, alt alan adı, kimlikli adres, portal, başka ana bilgisayar)", () => {
    const refused = [
      EDM_URLS.live,
      EDM_SMM_URLS.live,
      "https://PORTAL2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc",
      "https://portal2.edmbilisim.com.tr:443/EFaturaEDM/ESmmEDM.svc",
      "https://portal4.edmbilisim.com.tr/EFaturaUI/",
      "https://portal2.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://portal2.edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc",
      "https://baska-edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc",
      "https://test.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc",
      "https://test.edmbilisim.com.tr:8443/EFaturaEDM21ea/EFaturaEDM.svc",
      "http://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://test.edmbilisim.com.tr.ornek.com/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://kullanici:parola@test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EmmEDM.svc",
      TEST_URLS.portal,
      "https://api.github.com/",
      "https://lisans.destekofis.com.tr/v1/check",
      "geçersiz adres",
    ];
    for (const url of refused) assert.equal(izinliAdres(url, { mod: "gercek" }), false, url);
  });
  test("bekçi izinsiz isteği AĞA ÇIKARMADAN düşürür; program bunu 'EDM'ye ulaşılamadı' (kesin ulaşmadı) sayar — belirsiz gönderim değil", async () => {
    resetEdmCaches();
    let innerCalls = 0;
    const kayit = { izinli: [], reddedilen: [] };
    const fetchImpl = bekciFetch(async () => {
      innerCalls += 1;
      throw new Error("ağa çıkılmamalıydı");
    }, { mod: "gercek", kayit });
    const live = createEdmSmmClient({ baseUrl: EDM_SMM_URLS.live, username: "u", password: "p", env: "live", fetchImpl, useWsdl: false });
    const number = "ESM2026000000001";
    const uuid = "8f0c2a3e-1111-4222-8333-944445555666";
    const xml = `<Invoice><cbc:ProfileID>ESMM</cbc:ProfileID><cbc:ID>${number}</cbc:ID><cbc:UUID>${uuid}</cbc:UUID></Invoice>`;
    // Gönderim (önce giriş), numara vermeden önceki erişim denetimi ve durum sorgusu: hepsi "kesin ulaşmadı" — program numarayı geri bırakır.
    for (const [label, call] of [["gönderim", () => live.send({ xml, number, uuid })], ["erişim denetimi", () => live.ensureSession()], ["durum", () => live.status({ uuid, number })]]) {
      await assert.rejects(call(), error => {
        assert.equal(error.code, "integrator-unreachable", `${label}: ${error.code} ${error.message}`);
        return true;
      });
    }
    assert.equal(innerCalls, 0, "ağa hiçbir istek çıkmadı");
    assert.ok(kayit.reddedilen.length >= 1 && kayit.reddedilen.every(item => item.startsWith("https://portal2.edmbilisim.com.tr/")), JSON.stringify(kayit));
    assert.deepEqual(kayit.izinli, []);
  });
  test("D2: oturum açıkken GÖNDERİM isteği (yan etkili, yinelenmeyen işlem) bekçiye takılınca da 'kesin ulaşmadı' — 'Sonucu Belirsiz' değil", async () => {
    resetEdmCaches();
    const edm = await startMockEdm();
    try {
      const kayit = { izinli: [], reddedilen: [] };
      const bekci = bekciFetch(globalThis.fetch, { mod: "kuru", kayit });
      // Giriş sahte EDM'ye (yerel, izinli); gönderim isteği canlı adrese yönelmiş gibi bekçiden geçer (ör. adres oturum açıldıktan sonra değişti).
      const fetchImpl = (url, init = {}) => (/SendSMMRequest/.test(String(init.body || "")) ? bekci(EDM_SMM_URLS.live, init) : bekci(url, init));
      const client = createEdmSmmClient({ baseUrl: edm.url.replace(/EFaturaEDM\.svc$/, "ESmmEDM.svc"), username: "edmkullanici", password: "Gizli-Parola-1", env: "test", fetchImpl });
      await client.ensureSession();
      const number = "TES2026000000001";
      const uuid = "8f0c2a3e-1111-4222-8333-944445555667";
      await assert.rejects(client.send({ xml: `<Invoice><cbc:ProfileID>ESMM</cbc:ProfileID><cbc:ID>${number}</cbc:ID><cbc:UUID>${uuid}</cbc:UUID></Invoice>`, number, uuid }), error => {
        assert.equal(error.code, "integrator-unreachable", `${error.code}: ${error.message}`);
        return true;
      });
      assert.deepEqual(kayit.reddedilen, [EDM_SMM_URLS.live]);
      assert.equal(edm.state.smm.sent.length, 0, "sahte EDM'ye de gönderim gitmedi");
    } finally {
      await edm.close();
    }
  });
});

describe("D4/D6: maskeleme ve üretim bayrakları", () => {
  test("maskeci kullanıcı adını ve parolayı (uzunu önce) her yerde siler", () => {
    const mask = maskeci(["Gizli-Parola-1", "edmkullanici", "ab"]);
    assert.equal(mask("giriş edmkullanici / Gizli-Parola-1 / ab"), "giriş *** / *** / ab");
    assert.equal(mask({ u: "edmkullanici" }), '{"u":"***"}');
  });
  test("düzenek bayrakları server/server.mjs'ten okur: e-Belge, canlı ve e-SMM açık (yorum satırlarındaki örnekler sayılmaz)", () => {
    const flags = uretimBayraklari(readFileSync(path.join(ROOT, "server", "server.mjs"), "utf8"));
    assert.deepEqual(flags, { edocEnabled: true, edocLive: true, esmmEnabled: true });
    // Kaynak tarayan lisans denetimi (lisans-servisi-izolasyonu) bu örneği gerçek çağrı sanmasın: çağrı adı parçalı yazılır.
    const call = ["create", "App("].join("");
    assert.deepEqual(uretimBayraklari(`// ${call}{ esmmEnabled: true })\nconst app = ${call}{ edocEnabled: true, edocLive: true });`), { edocEnabled: true, edocLive: true });
  });
});

describe("D8: resmî PDF'te düzenleyenin unvanı", () => {
  test("e-SMM'de VKN'li düzenleyende BİLGİ (denetim değil); e-SMM'de TCKN'li düzenleyende ve e-Arşiv / e-Fatura'da denetim", () => {
    assert.equal(unvanDenetimi({ profile: "ESMM", taxNo: "3230512384" }), "bilgi");
    assert.equal(unvanDenetimi({ profile: "ESMM", taxNo: " 323 051 2384 " }), "bilgi", "boşluklu VKN");
    assert.equal(unvanDenetimi({ profile: "ESMM", taxNo: "10000000146" }), "denetim", "TCKN'li (şahıs) düzenleyen");
    for (const profile of ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"]) assert.equal(unvanDenetimi({ profile, taxNo: "3230512384" }), "denetim", profile);
  });
});

describe("Kuru koşu (sahte EDM): betik uçtan uca", () => {
  test("bütün adımlar geçer; 5 e-SMM + 2 e-Arşiv gönderilir, 1 iptal; OZET kullanıcıya numaraları ve test portalını verir; kimlik bilgisi hiçbir dosyada ve ekranda yok", () => {
    let out = tempDir();
    let run = runTool(["--kuru", "--cikti", out], MOCK);
    // Ders 22: koşu TR gece yarısını geçerse betik sonucu bilerek GEÇERSİZ sayar (çıkış 4, gunDegisti) — o durumda bir kez yeniden koşulur.
    if (run.status === 4 && existsSync(path.join(out, "ozet.json")) && json(out, "ozet.json").gunDegisti) {
      out = tempDir();
      run = runTool(["--kuru", "--cikti", out], MOCK);
    }
    assert.equal(run.status, 0, `${run.stdout.slice(-3000)}\n${run.stderr.slice(-1500)}`);
    const summary = json(out, "ozet.json");
    assert.equal(summary.cikis, 0);
    assert.equal(summary.denetim.kalan, 0);
    assert.ok(summary.denetim.toplam >= 40, `denetim sayısı ${summary.denetim.toplam}`);
    assert.deepEqual(summary.adimlar.map(item => item.adim), ["hazirlik", "a-baglanti", "hazirlik-cariler", "g-toplu-gonderim", "b-makbuz", "c-durum", "d-resmi-pdf", "e-iptal", "f-bulunamadi", "h-hata-kodlari"]);
    assert.ok(summary.adimlar.every(item => ["geçti", "bilgi"].includes(item.durum)), JSON.stringify(summary.adimlar));
    assert.deepEqual(summary.belgeler.map(item => [item.kod, item.tur]), [["G1", "e-SMM"], ["G2", "e-SMM"], ["G3", "e-Arşiv"], ["G4", "e-Arşiv"], ["G5", "e-SMM"], ["B1", "e-SMM"], ["B2", "e-SMM"]]);
    for (const item of summary.belgeler) {
      assert.match(item.no, item.tur === "e-SMM" ? /^TES\d{13}$/ : /^TEA\d{13}$/, item.no);
      assert.match(item.ettn, /^[0-9a-f-]{36}$/);
      assert.ok(item.gonderim && item.alici, JSON.stringify(item));
    }
    assert.equal(summary.belgeler.find(item => item.kod === "B1").edmDurum, "İptal Edildi");
    assert.ok(summary.belgeler.find(item => item.kod === "B1").iptal, "iptal saati yazılı");
    assert.deepEqual(summary.bekci.reddedilen, [], "kuru koşuda izin dışı istek yok");
    const edm = json(out, "kuru-edm-kaydi.json");
    assert.equal(edm.smmGonderilen.length, 5);
    assert.equal(edm.smmIptal, 1);
    assert.deepEqual(edm.ihlaller, []);
    assert.equal(edm.smm.filter(op => op === "Login").length, 1, "e-SMM servisine tek giriş (f adımı programın oturumunu kullanır)");
    assert.equal(json(out, "f-bulunamadi.json").kayit["e-SMM GetSMMStatus"].integratorCode, "11017", "sahte servisin 'bulunamadı' kodu kaydedildi");
    const ozet = readFileSync(path.join(out, "OZET.md"), "utf8");
    assert.match(ozet, /https:\/\/test\.edmbilisim\.com\.tr\/EFaturaUI21ea\//);
    assert.match(ozet, /SMMM Portalı Girişi/);
    assert.match(ozet, /KURU KOŞU/);
    assert.match(ozet, /\| Kod \| Belge Türü \| Belge No \| ETTN \/ UUID \| Belge Tarihi \| Gönderim \(TR\) \| Alıcı \| Brüt \| Stopaj \| KDV \| Net Ödenecek \| EDM Son Durum \| İptal \(TR\) \|/);
    for (const name of files(out)) {
      const bytes = readFileSync(path.join(out, name));
      for (const secret of Object.values(MOCK)) assert.ok(!bytes.includes(Buffer.from(secret)), `${name} kimlik bilgisi taşıyor`);
    }
    for (const secret of Object.values(MOCK)) assert.ok(!run.stdout.includes(secret) && !run.stderr.includes(secret), "ekrana kimlik bilgisi yazılmadı");
    assert.match(run.stdout, /kimlik bilgisi taraması: \d+ dosya, eşleşme 0/);
    assert.match(run.stdout.trim().split(/\r?\n/).at(-1), /^SONUÇ: \d+ geçti, 0 kaldı \(çıkış 0\)$/, "son satır kanit.mjs'in okuduğu özet");
  });

  test("D3: parola yanlışsa betik giriş adımında HEMEN durur — tek Login, yeniden deneme yok, başka hiçbir EDM isteği yok; çıkış 2", () => {
    const out = tempDir();
    const run = runTool(["--kuru", "--cikti", out], { ...MOCK, EDM_TEST_PAROLA: "Yanlis-Parola-9" });
    assert.equal(run.status, 2, run.stdout.slice(-2000));
    const summary = json(out, "ozet.json");
    assert.match(summary.durduruldu, /yeniden denenmedi/);
    assert.deepEqual(summary.adimlar.map(item => [item.adim, item.durum]), [["hazirlik", "geçti"], ["a-baglanti", "durdu"]]);
    const edm = json(out, "kuru-edm-kaydi.json");
    assert.deepEqual(edm.fatura, ["Login"], "e-Fatura servisine tek giriş denemesi");
    assert.deepEqual(edm.smm, [], "e-SMM servisine hiç istek yok");
    assert.ok(!existsSync(path.join(out, "g-toplu-gonderim.json")) && !existsSync(path.join(out, "b-makbuz.json")), "sonraki adımlar koşmadı");
    for (const name of files(out)) assert.ok(!readFileSync(path.join(out, name)).includes(Buffer.from("Yanlis-Parola-9")), `${name} parolayı taşıyor`);
  });

  test("D5/D7: önceki özetin üzerine --uzerine-yaz olmadan yazılmaz; kimlik bilgisi yoksa hiçbir istek yapılmaz (çıkış 4)", () => {
    const out = tempDir();
    const first = runTool(["--kuru", "--cikti", out], { ...MOCK, EDM_TEST_PAROLA: "Yanlis-Parola-9" });
    assert.equal(first.status, 2);
    const before = readFileSync(path.join(out, "ozet.json"), "utf8");
    const again = runTool(["--kuru", "--cikti", out], MOCK);
    assert.equal(again.status, 4);
    assert.match(again.stderr, /--uzerine-yaz/);
    assert.equal(readFileSync(path.join(out, "ozet.json"), "utf8"), before, "önceki özet değişmedi");
    const empty = tempDir();
    const none = runTool(["--kuru", "--cikti", path.join(empty, "yok")], { EDM_TEST_KULLANICI: "", EDM_TEST_PAROLA: "" });
    assert.equal(none.status, 4);
    assert.match(none.stderr, /EDM_TEST_KULLANICI ve EDM_TEST_PAROLA/);
    assert.ok(!existsSync(path.join(empty, "yok")), "çıktı klasörü bile açılmadı");
    const noMode = runTool([], MOCK);
    assert.equal(noMode.status, 4, "kip (--gercek / --kuru) verilmeden koşmaz");
  });
});

// 2.4.4 iş listesi 24b — --eszamanli: 20 e-SMM Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA (3 oturum), iki oturum aynı anda Tümünü Gönder,
// bağımsız okuyucu. "Nasıl bozulur?" listesi: docs/kanit/2026-10-22/244-edm-eszamanli/NOT.md (N1–N16). Bu testler düzeneğin kendisini sınar: kuru koşu
// geçer ve ön koşul (eşzamanlılık) gerçekten oluşur (ders 20); sahte EDM'ye enjekte edilen her hata düzeneği KIRMIZI yapar, neden iletiden okunur (ders 7/38).
const failedChecks = dir =>
  readdirSync(dir)
    .filter(name => /^[a-z].*\.json$/.test(name) && !["ozet.json", "bekci.json", "kuru-edm-kaydi.json"].includes(name))
    .flatMap(name => (json(dir, name).denetimler || []).filter(item => !item.gecti).map(item => `${name.replace(/\.json$/, "")}: ${item.denetim}`));

describe("--eszamanli: yardımcılar", () => {
  test("ardisikNumara boşluğu ve tekrarı bulur; soapIslemi işlem adını gövdeden okur", () => {
    assert.deepEqual(ardisikNumara([5, 3, 4]), { tamam: true, en: 3, son: 5, tekrar: [], bosluk: [], boslukSayisi: 0 });
    assert.equal(ardisikNumara([3, 5]).tamam, false);
    assert.deepEqual(ardisikNumara([3, 5]).bosluk, [4]);
    assert.deepEqual(ardisikNumara([3, 4, 4]).tekrar, [4]);
    assert.equal(ardisikNumara([]).tamam, false, "boş dizi 'ardışık' sayılmaz (ders 4)");
    assert.equal(soapIslemi("POST", '<s:Envelope><s:Body><tem:SendSMMRequest xmlns:tem="x">'), "SendSMM");
    assert.equal(soapIslemi("POST", "<Envelope><Body><LoginRequest>"), "Login");
    assert.equal(soapIslemi("GET", ""), "WSDL");
  });
  test("izleyici en çok eşzamanlı isteği ve işlem sayısını yazar, hatayı aynen yükseltir", async () => {
    const kayit = {};
    let release;
    const gate = new Promise(resolve => (release = resolve));
    const fetchImpl = izleyiciFetch(async (url, init) => {
      if (/boom/.test(init.body)) throw new Error("ağ");
      await gate;
      return { ok: true };
    }, kayit);
    const body = "<Envelope><Body><SendSMMRequest>";
    const calls = [1, 2, 3].map(() => fetchImpl("http://127.0.0.1:1/EFaturaEDM21ea/ESmmEDM.svc", { method: "POST", body }));
    await new Promise(resolve => setImmediate(resolve));
    release();
    await Promise.all(calls);
    await assert.rejects(fetchImpl("http://127.0.0.1:1/EFaturaEDM21ea/ESmmEDM.svc", { method: "POST", body: "<LoginRequest>boom" }), /ağ/);
    assert.equal(kayit.islemler["smm:SendSMM"].sayi, 3);
    assert.equal(kayit.islemler["smm:SendSMM"].enCokEszamanli, 3);
    assert.equal(kayit.islemler["smm:Login"].hata, 1);
  });
  test("bağımsız okuyucu (programın EDM istemcisinden ayrı): kendi girişi, GetSMM YALNIZ ETTN ile, EDM'nin kaydındaki numarayı okur; olmayan ETTN 0 kayıt; yanlış parola giriş hatası", async () => {
    const edm = await startMockEdm();
    try {
      const url = edm.url.replace(/EFaturaEDM\.svc$/, "ESmmEDM.svc");
      const uuid = "8f0c2a3e-1111-4222-8333-944445555777";
      // EDM'nin defteri: makbuz BAŞKA numarayla kayıtlı (çift kayıt arızasının sonucu) — okuyucu numarayı EDM'den okur, programdan almaz.
      edm.state.smm.sent.push({ id: "TES2026000000099", uuid, xml: "", head: {} });
      const reader = edmOkuyucu({ url, username: "edmkullanici", password: "Gizli-Parola-1", fetchImpl: globalThis.fetch });
      await reader.login();
      const found = await reader.lookup(uuid);
      assert.equal(found.okundu, true);
      assert.deepEqual(found.kayitlar.map(item => item.id), ["TES2026000000099"]);
      const none = await reader.lookup("8f0c2a3e-1111-4222-8333-944445555778");
      assert.deepEqual([none.okundu, none.kayitlar.length], [true, 0]);
      const request = edm.state.smm.calls.filter(call => call.op === "GetSMM");
      assert.equal(request.length, 2);
      assert.deepEqual(edm.state.smm.violations, [], "okuyucunun istekleri gerçek WSDL sözleşmesine uyar (ad alanı, SOAPAction, REQUEST_HEADER ilk, niteliksiz)");
      await assert.rejects(edmOkuyucu({ url, username: "edmkullanici", password: "Yanlis-9", fetchImpl: globalThis.fetch }).login(), /okuyucu girişi başarısız.*2001/);
    } finally {
      await edm.close();
    }
  });
});

describe("--eszamanli: kuru koşu (sahte EDM)", () => {
  test("zorla araya girme: bütün adımlar geçer, ön koşul GERÇEKTEN oluştu (sahte EDM'de ≥ 10 SendSMM ve soğuk başta ≥ 2 Login aynı anda); 30 belge, TES ardışık; OZET tablosu; kimlik bilgisi yok", () => {
    let out = tempDir();
    let run = runTool(["--kuru", "--eszamanli", "--zorla", "--cikti", out], MOCK);
    if (run.status === 4 && existsSync(path.join(out, "ozet.json")) && json(out, "ozet.json").gunDegisti) {
      out = tempDir();
      run = runTool(["--kuru", "--eszamanli", "--zorla", "--cikti", out], MOCK);
    }
    assert.equal(run.status, 0, `${run.stdout.slice(-3000)}\n${run.stderr.slice(-1500)}\n${failedChecks(out).join("\n")}`);
    const summary = json(out, "ozet.json");
    assert.deepEqual(summary.adimlar.map(item => item.adim), ["hazirlik", "a-baglanti", "hazirlik-cariler", "hazirlik-kullanicilar", "ya-eszamanli-kayit", "yb-tumunu-gonder", "yc-durum", "yd-resmi-pdf", "ye-edm-okuyucu", "yf-degismezler", "h-hata-kodlari"]);
    assert.equal(summary.denetim.kalan, 0);
    assert.equal(summary.belgeler.length, 30);
    assert.deepEqual([...new Set(summary.belgeler.map(item => item.aliciTuru))].sort(), ["TCKN", "VKN"]);
    for (const item of summary.belgeler) {
      assert.match(item.no, /^TES\d{13}$/);
      assert.equal(item.edmNo, item.no, `${item.kod}: bağımsız okuyucunun EDM'den okuduğu numara`);
    }
    const ya = json(out, "ya-eszamanli-kayit.json");
    assert.ok(ya.kayit.sahteEdmEnCokEszamanli.SendSMM >= 10, JSON.stringify(ya.kayit.sahteEdmEnCokEszamanli));
    assert.ok(ya.kayit.sahteEdmEnCokEszamanli.Login >= 2, "soğuk başta Login'ler aynı anda (ön koşul)");
    assert.equal(ya.kayit.yetkisiz.status, 403);
    assert.equal(ya.kayit.istekler.filter(item => item.asama === "A" && item.autoSend?.ok).length, 20);
    const edm = json(out, "kuru-edm-kaydi.json");
    assert.equal(edm.smmGonderilen.length, 30);
    assert.equal(new Set(edm.smmGonderilen).size, 30, "sahte EDM'ye her makbuz bir kez gitti");
    assert.deepEqual(edm.ihlaller, []);
    const ozet = readFileSync(path.join(out, "OZET.md"), "utf8");
    assert.match(ozet, /\| Kod \| Aşama \| Oturum \| Belge No \| ETTN \/ UUID \| Belge Tarihi \| Saat \| Alıcı Türü \| Alıcı \| Brüt \| Stopaj \| KDV \| Net Ödenecek \| EDM Son Durum \| EDM'deki No \(Bağımsız Okuyucu\) \|/);
    assert.match(ozet, /Belgeler İPTAL EDİLMEDİ/);
    assert.equal((ozet.match(/^\| [AB]\d\d \|/gm) || []).length, 30);
    for (const name of files(out)) {
      const bytes = readFileSync(path.join(out, name));
      for (const secret of Object.values(MOCK)) assert.ok(!bytes.includes(Buffer.from(secret)), `${name} kimlik bilgisi taşıyor`);
    }
    assert.match(run.stdout.trim().split(/\r?\n/).at(-1), /^SONUÇ: \d+ geçti, 0 kaldı \(çıkış 0\)$/);
  });

  test("testin dişi: sahte EDM'ye enjekte edilen her hata düzeneği KIRMIZI yapar, neden iletide (kayıp, çift kayıt, yanlış durum, askı)", () => {
    const cases = [
      ["kayip", [], [/ye-edm-okuyucu: A\d\d TES\d{13}: EDM'de 0 kayıt/, /numaralı ama EDM'de olmayan belge: 1 — A\d\d TES\d{13} programda sent/]],
      ["cift", [], [/ye-edm-okuyucu: A\d\d (TES\d{13}): EDM'de 1 kayıt, EDM'deki numara (?!\1)TES\d{13}/, /sahte EDM'nin defterinde numaralar tekil \(29\/30\)/]],
      ["durum", [], [/yc-durum: A\d\d TES\d{13}: EDM son durum error \(PACKAGE - FAIL\)/]],
      ["aski", ["--zaman-asimi", "3000"], [/ya-eszamanli-kayit: A\d\d \(\w+, (VKN|TCKN)\) ASKIDA: 3 sn içinde yanıt yok/]],
    ];
    for (const [fault, extra, reasons] of cases) {
      const out = tempDir();
      const run = runTool(["--kuru", "--eszamanli", "--ariza", fault, ...extra, "--cikti", out], MOCK);
      const failed = failedChecks(out);
      assert.equal(run.status, 1, `${fault}: çıkış ${run.status}\n${failed.join("\n")}\n${run.stdout.slice(-1500)}`);
      for (const reason of reasons) assert.ok(failed.some(item => reason.test(item)), `${fault}: beklenen neden ${reason} iletide yok:\n${failed.join("\n")}`);
      if (fault === "aski") assert.equal(failed.length, 1, `askıda yalnız o istek kalır; belge yine izlenir ve öbür değişmezler geçer:\n${failed.join("\n")}`);
    }
  });

  test("hata enjeksiyonu / zorla / kısa zaman aşımı gerçek kipte ya da --eszamanli'siz reddedilir; hiçbir istek yapılmaz, çıktı klasörü açılmaz (çıkış 4)", () => {
    const empty = tempDir();
    for (const args of [["--gercek", "--eszamanli", "--ariza", "kayip"], ["--gercek", "--eszamanli", "--zorla"], ["--gercek", "--eszamanli", "--zaman-asimi", "1000"], ["--kuru", "--ariza", "kayip"], ["--kuru", "--eszamanli", "--ariza", "bilinmeyen"], ["--kuru", "--sicak"]]) {
      const target = path.join(empty, args.join("_").replace(/[^a-z0-9_]/gi, ""));
      const run = runTool([...args, "--cikti", target], MOCK);
      assert.equal(run.status, 4, `${args.join(" ")}: ${run.status} ${run.stderr}`);
      assert.ok(!existsSync(target), `${args.join(" ")}: çıktı klasörü açılmadı`);
      assert.match(run.stderr, /[hH]içbir istek yapılmadı/);
    }
  });
});
