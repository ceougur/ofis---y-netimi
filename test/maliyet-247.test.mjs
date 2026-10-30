// 2.4.7 — Maliyet Hesap Kartı müşteri istekleri (kullanıcı, 28.10.2026; docs/2.4.7-IS-LISTESI.md, CLAUDE.md "İSTEK … Maliyet Hesap Kartı"):
//   (1) her sekmede PDF: o sekmenin kartları EKRANDAKİ değerlerle (kaydedilmemiş taslak dahil), maliyet.view yeter, sektör kapısı aynı, hiçbir şey yazılmaz;
//   (2) Cam ve Mika kartlarında iki oran kutusu BOŞ gelir, etiketlerde sayı yok ("KDV", "Maliyet"; Mika "Masraf%" aynen); boş oran hesapta 0 (NaN yok);
//       bölenler (200 / 170 / 120) değişmez; 2.4.6'da kurulmuş ama hiç kaydedilmemiş kart yeni ilk hâle döner, kullanıcının KAYDETTİĞİ kart değişmez;
//   (3) toplama adımının boş etiketi "Toplam" (yan panelin "Genel"i aynen).
// Beklenenler kullanıcının sözünden ve formül tablosunun yazılı kuralından elle yazıldı (ARA = Σ miktar × fiyat; yüzde = ARA × p / 100; toplama;
// yüzde ekle = T × q / 100 + T; bölme = Y / k; boş = 0). Enter ile odak (4) ekranda: test/e2e/senaryo-maliyet-246.mjs M15.
// NASIL BOZULUR (önce yazıldı): şablon 18 / 20 getirmeye devam eder · boş oran NaN / hata verir · etikette sayı kalır · bölen de boşalır · güncelleme
// kullanıcının kaydettiği 18'i siler · hiç dokunulmamış eski kart 18'de kalır · yükseltme her açılışta rev artırır (iki kişide sahte 409) · PDF kayıtlı
// hâli basar (ekrandaki taslağı değil) · PDF taslağı kaydeder · PDF yetkisiz kişiye / sektör dışında açılır · PDF başka sekmenin kartını basar.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText } from "./pdf-metin.mjs";
import { MALIYET_KARTLAR, sablonKart } from "../server/lib/maliyet/sablon.mjs";

const BASE = "/api/maliyet";
const data = response => {
  assert.equal(response.status, 200, `beklenen 200: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return response.data.data;
};
const adim = (kart, kod) => kart.adimlar.find(item => item.kod === kod);
const CAM = MALIYET_KARTLAR.filter(kart => kart.sekme === "cam");
const MIKA = MALIYET_KARTLAR.filter(kart => kart.sekme === "mika" && kart.tur === "zincir");
const YAN = "mika/80-lik-yan-panel";

describe("2.4.7 Maliyet Hesap Kartı: şablon — oranlar boş, etiketlerde sayı yok, Toplam", () => {
  it("Cam kartları: KDV ve Maliyet kutuları boş, etiketler \"KDV\" / \"Maliyet\", toplama \"Toplam\"; bölenler değişmedi", () => {
    assert.equal(CAM.length, 5);
    for (const kart of CAM) {
      assert.deepEqual([adim(kart, "yuzde").etiket, adim(kart, "yuzde").oran], ["KDV", null], `${kart.kod} KDV`);
      assert.deepEqual([adim(kart, "yuzde_ekle").etiket, adim(kart, "yuzde_ekle").oran], ["Maliyet", null], `${kart.kod} Maliyet`);
      assert.equal(adim(kart, "toplama").etiket, "Toplam", `${kart.kod} toplama etiketi`);
    }
    assert.deepEqual(CAM.map(kart => adim(kart, "bolme")?.bolen ?? null), [200, 200, 170, 120, null], "bölenler 2.4.6'daki gibi (130 1S2Ç elle CM)");
  });

  it("Mika kartları: Masraf% ve Maliyet kutuları boş, etiketlerde sayı yok; toplama \"Toplam\" (yan panel \"Genel\"); bölenler değişmedi", () => {
    assert.equal(MIKA.length, 6);
    for (const kart of MIKA) {
      assert.equal(adim(kart, "yuzde").oran, null, `${kart.kod} Masraf oranı boş`);
      assert.equal(adim(kart, "yuzde_ekle").oran, null, `${kart.kod} Maliyet oranı boş`);
      assert.equal(adim(kart, "yuzde_ekle").etiket, "Maliyet", `${kart.kod} Maliyet etiketi`);
      assert.match(adim(kart, "yuzde").etiket, /^Masraf ?%?$/, `${kart.kod} Masraf etiketi (Excel yazımı aynen, sayı yok)`);
      assert.equal(adim(kart, "toplama").etiket, kart.kod === YAN ? "Genel" : "Toplam", `${kart.kod} toplama etiketi`);
    }
    assert.deepEqual(MIKA.map(kart => adim(kart, "bolme")?.bolen ?? null), [200, 200, 170, 120, 120, null]);
    for (const kart of [...CAM, ...MIKA]) for (const kod of ["yuzde", "toplama", "yuzde_ekle"]) assert.doesNotMatch(adim(kart, kod).etiket, /\d/, `${kart.kod} ${kod}: etikette sayı yok`);
  });
});

describe("2.4.7 Maliyet Hesap Kartı: API", () => {
  let server;
  let admin;
  const store = () => server.app.store;
  before(async () => {
    server = await startTestServer({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
    data(await admin.post("/api/workspace/insight/sector", { sectorId: "dusakabin", source: "manual" }));
  });
  after(async () => {
    await server?.close();
  });
  const pdf = (client, body) => client.raw("POST", `${BASE}/pdf`, { body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  it("yeni kart: oran kutuları boş, boşken oran 0 sayılır (NaN / hata yok); oran yazılınca zincir kuralı", async () => {
    const state = data(await admin.get(BASE));
    for (const kod of [...CAM, ...MIKA].map(kart => kart.kod)) {
      const kart = state.kartlar[kod];
      assert.deepEqual([adim(kart, "yuzde").oran, adim(kart, "yuzde_ekle").oran], [null, null], `${kod}: iki oran boş`);
    }
    const kart = state.kartlar["cam/100x100-oval-kabin"];
    const satirlar = kart.satirlar.map(({ id, ad, birim }, index) => ({ id, ad, birim, miktar: index === 0 ? 2.5 : index === 1 ? 3 : null, fiyat: index === 0 ? 1250.75 : index === 1 ? 100 : null }));
    const ara = 2.5 * 1250.75 + 3 * 100;
    const bos = data(await admin.post(`${BASE}/onizle`, { kartlar: [{ kod: kart.kod, rev: kart.rev, satirlar }] })).kartlar[kart.kod];
    assert.equal(adim(bos, "ara").deger, ara);
    assert.equal(adim(bos, "yuzde").deger, 0, "boş KDV oranı 0");
    assert.equal(adim(bos, "toplama").deger, ara);
    assert.equal(adim(bos, "yuzde_ekle").deger, ara, "boş Maliyet oranı 0");
    assert.equal(bos.sonuc, ara / 200);
    assert.ok(Number.isFinite(bos.sonuc) && !adim(bos, "bolme").hata, "sonuç sayı, hata işareti yok");
    const dolu = data(await admin.post(`${BASE}/onizle`, { kartlar: [{ kod: kart.kod, rev: kart.rev, satirlar, adimlar: [{ kod: "yuzde", oran: "18" }, { kod: "yuzde_ekle", oran: 20 }] }] })).kartlar[kart.kod];
    const toplama = ara + (ara * 18) / 100;
    assert.equal(dolu.sonuc, ((toplama * 20) / 100 + toplama) / 200, "kullanıcı yazınca 18 / 20 ile Excel kalıbı");
    assert.equal(adim(dolu, "yuzde").etiket, "KDV", "oran yazılınca etiket değişmez");
  });

  it("güncelleme: 2.4.6'da kurulmuş HİÇ kaydedilmemiş kart yeni ilk hâle döner; kullanıcının kaydettiği kart (18 / 20) değişmez; rev artmaz; ikinci açılış bir şey yapmaz", async () => {
    // 2.4.6'nın kurduğu hâl (ek denetim; gerçek 2.4.6 koduyla üretilmiş veri: test/maliyet-sablon-247-eski-surum.mjs).
    const eski = (kod, yuzde, oran, ekle, ekleOran, toplama = "") => {
      store().run("UPDATE maliyet_adimlar SET etiket = ?, deger = ? WHERE kart = ? AND kod = 'yuzde'", yuzde, oran, kod);
      store().run("UPDATE maliyet_adimlar SET etiket = ?, deger = ? WHERE kart = ? AND kod = 'yuzde_ekle'", ekle, ekleOran, kod);
      store().run("UPDATE maliyet_adimlar SET etiket = ? WHERE kart = ? AND kod = 'toplama'", toplama, kod);
    };
    const DOKUNULMAMIS = "cam/170-2s2c-h182";
    const KAYDEDILMIS = "cam/100x100-kose-kabin";
    const MIKA_DOKUNULMAMIS = "mika/150-1s1c-h182-kabin";
    eski(DOKUNULMAMIS, "KDV/18", 18, "%20 Maliyet", 20);
    eski(MIKA_DOKUNULMAMIS, "Masraf%", 17, "%15 Maliyet", 15);
    eski(YAN, "Masraf", 15, "%20 Maliyet", 15, "Genel");
    eski(KAYDEDILMIS, "KDV/18", 18, "%20 Maliyet", 20);
    store().run("UPDATE maliyet_kartlar SET rev = 2, updated_by = 'u', updated_at = '2026-10-27T10:00:00.000Z' WHERE kod = ?", KAYDEDILMIS);
    // Kullanıcının kaydettiği ama etiketi / oranı 2.4.6 değeri olmayan kart da değişmez (adım AYNEN eşleşmeli).
    eski("cam/130-1s1c-h182-kabin", "KDV/18", 19, "%20 Maliyet", 20);
    const revOnce = Object.fromEntries(store().all("SELECT kod, rev FROM maliyet_kartlar").map(row => [row.kod, row.rev]));
    const state = data(await admin.get(BASE));
    const view = kod => state.kartlar[kod];
    for (const kod of [DOKUNULMAMIS, MIKA_DOKUNULMAMIS]) {
      assert.deepEqual([adim(view(kod), "yuzde").oran, adim(view(kod), "yuzde_ekle").oran], [null, null], `${kod}: dokunulmamış kart → oranlar boş`);
      assert.equal(adim(view(kod), "yuzde_ekle").etiket, "Maliyet");
      assert.equal(adim(view(kod), "toplama").etiket, "Toplam");
    }
    assert.equal(adim(view(DOKUNULMAMIS), "yuzde").etiket, "KDV");
    assert.equal(adim(view(MIKA_DOKUNULMAMIS), "yuzde").etiket, "Masraf%");
    assert.deepEqual(view(YAN).adimlar.map(item => [item.kod, item.etiket, item.oran ?? null]), [["ara", "Ara", null], ["yuzde", "Masraf", null], ["toplama", "Genel", null], ["yuzde_ekle", "Maliyet", null]], "yan panel");
    assert.deepEqual(view(KAYDEDILMIS).adimlar.map(item => [item.kod, item.etiket, item.oran ?? item.bolen ?? null]), [["ara", "Ara", null], ["yuzde", "KDV/18", 18], ["toplama", "", null], ["yuzde_ekle", "%20 Maliyet", 20], ["bolme", "Köşe Kabin CM Maliyeti", 200]], "kullanıcının kaydettiği kart AYNEN (18 / 20, eski etiketler)");
    assert.equal(adim(view("cam/130-1s1c-h182-kabin"), "yuzde").oran, 19, "2.4.6 değerinden farklı oran (kullanıcı verisi) değişmez");
    assert.equal(adim(view("cam/130-1s1c-h182-kabin"), "yuzde_ekle").oran, null, "aynı karttaki eşleşen adım yine de yeni ilk hâlde");
    const revSonra = Object.fromEntries(store().all("SELECT kod, rev FROM maliyet_kartlar").map(row => [row.kod, row.rev]));
    assert.deepEqual(revSonra, revOnce, "yükseltme rev artırmaz (açık pencerede sahte 409 yok)");
    const ikinci = data(await admin.get(BASE));
    assert.deepEqual(ikinci.kartlar, state.kartlar, "ikinci açılış aynı");
  });

  it("PDF: dört sekme; başlık sekmenin adı, kart adları ve ekrandaki (kaydedilmemiş) değer; hiçbir şey yazılmaz", async () => {
    const state = data(await admin.get(BASE));
    const sekmeAd = Object.fromEntries(state.sekmeler.map(sekme => [sekme.kod, sekme.ad]));
    const before = JSON.stringify(store().all("SELECT * FROM maliyet_satirlar ORDER BY kart, id")) + JSON.stringify(store().all("SELECT * FROM maliyet_hucreler ORDER BY kart, hucre")) + JSON.stringify(store().all("SELECT kod, ad, rev FROM maliyet_kartlar ORDER BY kod"));
    const oval = state.kartlar["cam/100x100-oval-kabin"];
    const camTaslak = { kod: oval.kod, rev: oval.rev, satirlar: oval.satirlar.map(({ id, ad, birim }, index) => ({ id, ad, birim, miktar: index === 0 ? 2.5 : null, fiyat: index === 0 ? 1250.75 : null })), adimlar: [{ kod: "yuzde", oran: 18 }, { kod: "yuzde_ekle", oran: 20 }] };
    const mat1 = state.sekmeler.find(sekme => sekme.kod === "liste-1").kartlar[0];
    const mat2 = state.sekmeler.find(sekme => sekme.kod === "liste-2").kartlar[0];
    const yan = state.kartlar[YAN];
    const taslak = {
      cam: { kartlar: [camTaslak] },
      "liste-1": { kartlar: [{ kod: mat1, rev: state.kartlar[mat1].rev, hucreler: { r1c1: { taban: 1500 }, r1c2: { fark: 250.5 } } }] },
      mika: { kartlar: [{ kod: YAN, rev: yan.rev, satirlar: yan.satirlar.map(({ id, ad, birim }, index) => ({ id, ad, birim, miktar: index === 0 ? 4 : null, fiyat: index === 0 ? 31.25 : null })) }] },
      "liste-2": { kartlar: [{ kod: mat2, rev: state.kartlar[mat2].rev, hucreler: { r1c1: { taban: 777 } } }], sekmeler: [{ kod: "liste-2", rev: state.sekmeler[3].rev, ad: "Eski Liste" }] },
    };
    // Ekrandaki değer (kâhin: formül tablosu kuralı elle): Cam Oval — tutar 3.126,875 → "3.126,88"; ARA aynı; KDV %18; Maliyet %20; ÷200.
    const ara = 2.5 * 1250.75;
    const sonuc = ((ara + (ara * 18) / 100) * 20 / 100 + (ara + (ara * 18) / 100)) / 200;
    const fmt = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    const beklenen = {
      cam: [sekmeAd.cam, "100X100 Oval Kabin", "130 1S2Ç H:182 Kabin", "1.250,75", "3.126,88", fmt(sonuc), "KDV", "Maliyet", "Toplam", "Malzeme", "Birim Fiyat"],
      "liste-1": [sekmeAd["liste-1"], state.kartlar[mat1].ad, "1.500,00", "1.750,50", "Katlanır Kapı Siyah Alüminyüm"],
      mika: [sekmeAd.mika, "80'lik Yan Panel", "Profil Ağırlıkları Net", "31,25", "125,00", "Genel"],
      "liste-2": ["Eski Liste", state.kartlar[mat2].ad, "777,00", "Montaj Satırları"],
    };
    for (const kod of ["cam", "liste-1", "mika", "liste-2"]) {
      const res = await pdf(admin, { sekme: kod, ...taslak[kod] });
      assert.equal(res.status, 200, `${kod}: ${res.status} ${res.buffer.toString("utf8").slice(0, 200)}`);
      assert.match(res.headers.get("content-type"), /application\/pdf/);
      assert.ok(res.buffer.subarray(0, 5).toString("latin1") === "%PDF-", `${kod}: PDF dosyası`);
      const disposition = decodeURIComponent(/filename\*=UTF-8''([^;]+)/i.exec(res.headers.get("content-disposition") || "")?.[1] || "");
      assert.ok(disposition.startsWith(kod === "liste-2" ? "Eski Liste " : `${sekmeAd[kod]} `) && disposition.endsWith(".pdf"), `${kod}: dosya adı sekmenin adıyla (${disposition})`);
      const text = pdfText(res.buffer);
      for (const parca of beklenen[kod]) assert.ok(text.includes(parca), `${kod}: PDF'te "${parca}" yok\n${text.slice(0, 600)}`);
      // Yalnız o sekmenin kartları.
      const baska = kod === "cam" ? "Profil Ağırlıkları Net" : kod === "mika" ? "130 1S2Ç H:182 Kabin" : "100X100 Oval Kabin";
      assert.ok(!text.includes(baska), `${kod}: başka sekmenin kartı ("${baska}") PDF'te yok`);
    }
    const sonra = JSON.stringify(store().all("SELECT * FROM maliyet_satirlar ORDER BY kart, id")) + JSON.stringify(store().all("SELECT * FROM maliyet_hucreler ORDER BY kart, hucre")) + JSON.stringify(store().all("SELECT kod, ad, rev FROM maliyet_kartlar ORDER BY kod"));
    assert.equal(sonra, before, "PDF hiçbir şey yazmadı");
    assert.equal(store().get("SELECT ad FROM maliyet_sekmeler WHERE kod = 'liste-2'").ad, sekmeAd["liste-2"], "taslak sekme adı yazılmadı");
    const audit = store().get("SELECT payload_json FROM audit_events WHERE type = 'maliyet.pdf' ORDER BY rowid DESC LIMIT 1");
    assert.ok(audit && !/777|1500|1250/.test(audit.payload_json), "işlem geçmişinde yalnız sekme (değer yok)");
    assert.equal((await pdf(admin, { sekme: "yok" })).status, 404, "bilinmeyen sekme 404");
    assert.equal((await pdf(admin, { sekme: "cam", kartlar: [{ ...camTaslak, adimlar: [{ kod: "bolme", bolen: 0 }] }] })).status, 400, "geçersiz taslak 400 (Bölen 0 olamaz)");
  });

  it("PDF yetkisi: maliyet.view yoksa 403; görüntüleme yetkisi yeter (düzenleme gerekmez); sektör dışında 403", async () => {
    const personel = await createUser(server, admin, { username: "per247", role: "personel" });
    assert.equal((await pdf(personel, { sekme: "cam" })).status, 403);
    const users = data(await admin.get("/api/admin/users"));
    const target = (Array.isArray(users) ? users : users.users).find(user => user.username === "per247");
    data(await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: ["maliyet.view"], remove: [] } }));
    const ok = await pdf(personel, { sekme: "mika" });
    assert.equal(ok.status, 200, "yalnız görüntüleme yetkisiyle PDF");
    data(await admin.post("/api/workspace/insight/sector", { sectorId: "uretim", source: "manual" }));
    const kapali = await pdf(admin, { sekme: "cam" });
    assert.equal(kapali.status, 403, "sektör dışında 403");
    assert.equal(kapali.data?.code, "maliyet-sector");
  });
});
