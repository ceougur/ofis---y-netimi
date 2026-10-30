// 2.4.6 madde 1–3 — Maliyet Hesap Kartı çekirdeği (veri + hesap + sektör + API). Kullanıcı kararları 24–25.10.2026 (docs/2.4.6-IS-LISTESI.md).
// Kâhin (ders 5): asıl bağımsız kâhin test/bagimsiz/maliyet (kodu görmeyen ajan, Python; `python3 -I test/bagimsiz/maliyet/kos.py`, uyarlayıcı programın
// gerçek API'sine bağlanır). Buradaki beklenenler formül tablosunun yazılı kuralından (ARA = Σ miktar × fiyat; yüzde = ARA × p / 100; toplama; yüzde
// ekle = T × q / 100 + T; bölme = Y / k) ve kullanıcı kararlarından (sekme adları, boş yapı, K1 "Bölen 0 olamaz", sektör kapısı) elle yazıldı.
// NASIL BOZULUR (önce yazıldı): sektör dışında API açık kalır · sektör değişince veri silinir · şablona müşteri fiyatı / marka / yıl girer · şablon her
// açılışta yeniden kurulup kullanıcının değişikliğini ezer · eklenen satır ARA'ya girmez ya da adımlara karışır · silinen satır toplamda kalır · oran
// değişince etiket de değişir (ya da tersi) · bölen 0 / boş kaydedilir (sonsuz) · ara değer yuvarlanır · ön izleme yazar · iki kişi aynı kartı kaydeder,
// ilki sessizce ezilir · değişmeyen kart sürüm çatışmasıyla kaydı engeller · yetkisiz kişi yazar · 002'nin sektörü 001'in kartını açar · yeniden
// başlatınca değer kaybolur · "Tüm Hareketleri Sil" kartı siler · "Tümünü Sıfırla" eski değeri bırakır · yedekten dönünce değer gelmez · matriste taban
// hücresine fark yazılır · fiyat listesine ölçü satırı eklenir · bilgi kartına satır eklenir · Excel tutarsızlığı "düzeltilir" (÷120 → ÷130).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ADMIN_PASSWORD, createUser, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

// 2.4.6 (kullanıcı kararı 25.10.2026): Maliyet Hesap Kartı kendi iki yetkisiyle (maliyet.view / maliyet.manage; varsayılan yalnız yönetici).
async function grant(admin, username, add, remove = []) {
  const users = (await admin.get("/api/admin/users")).data.data;
  const target = (Array.isArray(users) ? users : users.users).find(user => user.username === username);
  const res = await admin.patch(`/api/admin/users/${target.id}`, { grants: { add, remove } });
  assert.equal(res.status, 200, `yetki ${username}: ${JSON.stringify(res.data).slice(0, 200)}`);
}
import { createStore } from "../server/lib/db.mjs";
import { LATEST_VERSION, MIGRATIONS, runMigrations } from "../server/lib/migrations.mjs";
import { MALIYET_KARTLAR, MALIYET_SEKMELER, sablonKart } from "../server/lib/maliyet/sablon.mjs";
import { kartHesap } from "../server/lib/maliyet/hesap.mjs";
import { sectorById } from "../server/lib/insight/sectors.mjs";

const BASE = "/api/maliyet";
const data = response => {
  assert.equal(response.status, 200, `beklenen 200: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return response.data.data;
};
const setSector = async (client, id, query = "") => data(await client.post(`/api/workspace/insight/sector${query}`, { sectorId: id, source: "manual" }));
const adim = (kart, kod) => kart.adimlar.find(item => item.kod === kod);
const rowsOf = kart => kart.satirlar.map(({ id, ad, birim, miktar, fiyat }) => ({ id, ad, birim, miktar, fiyat }));

describe("2.4.6 Maliyet Hesap Kartı: şablon (boş yapı) ve hesap zinciri", () => {
  it("4 sekme Excel sırasıyla, nötr adlarla; marka ve yıl yok; miktar / fiyat / taban / fark yok", () => {
    assert.deepEqual(MALIYET_SEKMELER.map(sekme => [sekme.kod, sekme.ad]), [["cam", "Cam Maliyet"], ["liste-1", "Bayi Fiyat Listesi 1"], ["mika", "Mika Maliyet"], ["liste-2", "Bayi Fiyat Listesi 2"]]);
    const text = JSON.stringify(MALIYET_KARTLAR);
    assert.doesNotMatch(text, /bel+a|20(19|2[0-9])/i, "marka ve yıl hiçbir adda yok");
    assert.equal(MALIYET_KARTLAR.filter(kart => kart.sekme === "cam").length, 5);
    assert.equal(MALIYET_KARTLAR.filter(kart => kart.tur === "matris").length, 12);
    for (const kart of MALIYET_KARTLAR) {
      for (const satir of kart.satirlar || []) for (const key of ["miktar", "fiyat", "boy", "alis_ft", "giden_kg"]) assert.ok(!Object.hasOwn(satir, key), `${kart.kod} ${satir.id}: şablonda ${key} yok`);
      if (kart.tur === "matris") assert.ok(!Object.values(kart.hucreler).some(value => typeof value === "number"), `${kart.kod}: hücrelerde sayı yok (yalnız kaynak)`);
    }
  });

  it("Excel tutarsızlıkları AYNEN: 130 / 150'lik 1S1Ç ÷120, Cam 130 1S2Ç CM elle (sonuç %20 Maliyet), Mika 120 1S2Ç etiketsiz; 2.4.7: oranlar boş, etiketlerde sayı yok", () => {
    assert.equal(sablonKart("cam/130-1s1c-h182-kabin").adimlar.find(item => item.kod === "bolme").bolen, 120);
    assert.equal(sablonKart("mika/150-1s1c-h182-kabin").adimlar.find(item => item.kod === "bolme").bolen, 120);
    const cam5 = sablonKart("cam/130-1s2c-h182-kabin");
    assert.deepEqual(cam5.adimlar.map(item => item.kod), ["ara", "yuzde", "toplama", "yuzde_ekle", "cm_elle"]);
    assert.equal(cam5.sonuc, "yuzde_ekle");
    assert.equal(sablonKart("mika/120-1s2c-h182-kabin").adimlar.find(item => item.kod === "bolme").etiket, "");
    const yan = sablonKart("mika/80-lik-yan-panel");
    assert.deepEqual(yan.adimlar.map(item => [item.kod, item.etiket, item.oran ?? null]), [["ara", "Ara", null], ["yuzde", "Masraf", null], ["toplama", "Genel", null], ["yuzde_ekle", "Maliyet", null]]);
    assert.deepEqual(["mika/100x100-oval-kabin", "mika/100x100-kose-kabin", "mika/170-2s2c-h182", "mika/150-1s1c-h182-kabin", "mika/120-1s2c-h182-kabin"].map(kod => sablonKart(kod).adimlar[1].oran), [null, null, null, null, null], "2.4.7 (müşteri isteği 28.10.2026): Masraf% oranı boş gelir");
  });

  it("zincir: tutar = miktar × fiyat → ARA → %18 → toplama → %20 ekle → ÷200; ara değer yuvarlanmaz; boş girdi 0 sayılır", () => {
    const sablon = sablonKart("cam/100x100-oval-kabin");
    const values = [[2.5, 141.3], [1.25, 610.4], [null, 33], [0.3, 87.77], [12, 1.15], [4, 9.9], [24, 0.37]];
    // 2.4.7: şablonda oranlar boş; zincir kuralı oranlar açıkça 18 / 20 verilerek denenir (girdi).
    const durum = { ad: sablon.ad, satirlar: sablon.satirlar.map((satir, index) => ({ ...satir, miktar: values[index][0], fiyat: values[index][1] })), adimlar: { yuzde: { deger: 18 }, yuzde_ekle: { deger: 20 } } };
    const view = kartHesap(sablon, durum);
    let ara = 0;
    for (const [miktar, fiyat] of values) ara += (miktar ?? 0) * fiyat;
    const yuzde = (ara * 18) / 100;
    const toplama = ara + yuzde;
    const ekle = (toplama * 20) / 100 + toplama;
    assert.equal(adim(view, "ara").deger, ara);
    assert.equal(adim(view, "yuzde").deger, yuzde);
    assert.equal(adim(view, "toplama").deger, toplama);
    assert.equal(adim(view, "yuzde_ekle").deger, ekle);
    assert.equal(view.sonuc, ekle / 200);
    assert.notEqual(view.sonuc, Math.round(view.sonuc * 100) / 100, "örnek yuvarlamayı ayırt ediyor");
    assert.equal(view.satirlar[2].miktar, null, "boş girdi null kalır");
    assert.equal(view.satirlar[2].tutar, 0, "hesapta 0");
  });

  it("matris: liste-1 tesettür parlaktan, B7 zinciri, yan panel ayrı parlak farkı; liste-2 elle hücreler TABAN", () => {
    const l1 = sablonKart("liste-1/seri-2-sabit-2-acilir");
    assert.equal(l1.hucreler.r1c1, "taban");
    assert.equal(l1.hucreler.r3c1, "r2c1", "B7 = B6 + fark (zincir)");
    assert.equal(l1.hucreler.r4c1, "r1c1", "B8 = B5 + fark (çapa)");
    assert.equal(l1.hucreler.r5c4, "r5c3", "tesettür = parlak + fark");
    assert.equal(sablonKart("liste-1/1-sabit-2-calisir").hucreler.r5c1, "r4c1");
    assert.equal(sablonKart("liste-1/seri-yan-panel").hucreler.r2c3, "r2c1");
    const kose = sablonKart("liste-2/seri-kose-girisli");
    assert.deepEqual(["r1c1", "r2c2", "r12c1", "r12c4"].map(hucre => kose.hucreler[hucre]), ["taban", "taban", "taban", "taban"]);
    assert.equal(kose.hucreler.r3c2, "r2c2");
    assert.equal(sablonKart("liste-2/seri-oval-2-sabit-4-calisir").hucreler.r11c1, "taban");
    assert.equal(sablonKart("liste-2/seri-oval-2-sabit-4-calisir").hucreler.r11c2, "r10c2");
    const view = kartHesap(l1, { ad: l1.ad, olcuBasligi: "Ölçü", sutunlar: {}, olculer: {}, hucreler: { r1c1: 1000.1, r2c1: 50.05, r3c1: 25, r3c3: 7.3, r3c4: 0.2 } });
    assert.equal(view.hucreler.r3c1.deger, 1000.1 + 50.05 + 25);
    assert.equal(view.hucreler.r3c4.deger, 1000.1 + 50.05 + 25 + 7.3 + 0.2);
    assert.equal(view.hucreler.r10c1.deger, 1000.1, "boş fark 0");
  });

  it("sektör: Duşakabin Üretimi mevcut Üretim ve Sanayi grubunda, maliyet modülü yalnız onda", () => {
    const sector = sectorById("dusakabin");
    assert.equal(sector.name, "Duşakabin Üretimi");
    assert.equal(sector.group, "uretim");
    assert.equal(sector.modules.maliyet, true);
    assert.ok(!sectorById("uretim").modules.maliyet && !sectorById("genel").modules.maliyet);
  });
});

describe("2.4.6 Maliyet Hesap Kartı: göç v34 (yalnız ekleyici)", () => {
  it("v33 veri dosyası v34'e geçer: yalnız maliyet_* tabloları (STRICT, boş) eklenir; ikinci açılış bir şey yapmaz", () => {
    const db = new DatabaseSync(":memory:");
    const store = createStore(db);
    for (const migration of MIGRATIONS.filter(item => item.version <= 33)) store.tx(() => {
      migration.up(store, { company: null, now: () => new Date("2026-10-25T07:00:00Z") });
      store.exec(`PRAGMA user_version = ${migration.version}`);
    });
    const tables = store.all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(row => row.name);
    assert.ok(!tables.some(name => name.startsWith("maliyet_")), "v33'te maliyet tablosu yok");
    const result = runMigrations(store, {});
    assert.ok(result.applied.includes(34));
    assert.ok(LATEST_VERSION >= 34);
    // v34'TEN SONRAKİ göçlerin eklediği tablolar (2.4.7 v37 edoc_usage …) bu testin konusu değil: ayrı bir dosyada v34'e kadar ve en son sürüme kadar
    // göçün tablo farkı çıkarılır; v34'ün eklediği yine YALNIZ maliyet_* olmalıdır.
    const tablesAt = upTo => {
      const probe = createStore(new DatabaseSync(":memory:"));
      for (const migration of MIGRATIONS.filter(item => item.version <= upTo)) probe.tx(() => migration.up(probe, { company: null, now: () => new Date("2026-10-25T07:00:00Z") }));
      return probe.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name);
    };
    const at34 = new Set(tablesAt(34));
    const later = new Set(tablesAt(LATEST_VERSION).filter(name => !at34.has(name)));
    const added = store.all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(row => row.name).filter(name => !tables.includes(name) && !later.has(name));
    assert.deepEqual(added, ["maliyet_adimlar", "maliyet_basliklar", "maliyet_hucreler", "maliyet_kartlar", "maliyet_satirlar", "maliyet_sekmeler"]);
    for (const name of added) {
      assert.equal(db.prepare("SELECT strict FROM pragma_table_list WHERE name = ?").get(name)?.strict, 1, `${name} STRICT`);
      assert.equal(store.get(`SELECT COUNT(*) AS n FROM ${name}`).n, 0, `${name} boş kurulur (şablon sektör seçilince)`);
    }
    assert.deepEqual(runMigrations(store, {}).applied, []);
    db.close();
  });
});

describe("2.4.6 Maliyet Hesap Kartı: API", () => {
  let server;
  let admin;
  const roots = [];
  before(async () => {
    server = await startTestServer({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server?.close();
    for (const root of roots) removeTestDir(root);
  });

  it("sektör dışında kapalı (403 maliyet-sector, şablon kurulmaz); Duşakabin Üretimi seçilince açılır, boş şablon bir kez kurulur", async () => {
    const durum = data(await admin.get(`${BASE}/durum`));
    assert.equal(durum.acik, false);
    for (const response of [await admin.get(BASE), await admin.post(`${BASE}/onizle`, { kartlar: [] }), await admin.put(BASE, { kartlar: [] })]) {
      assert.equal(response.status, 403);
      assert.equal(response.data.code, "maliyet-sector");
      assert.match(response.data.error, /Duşakabin Üretimi/);
    }
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM maliyet_kartlar").n, 0, "sektör dışında şablon kurulmaz");
    await setSector(admin, "dusakabin");
    assert.equal(data(await admin.get(`${BASE}/durum`)).acik, true);
    const state = data(await admin.get(BASE));
    assert.deepEqual(state.sekmeler.map(sekme => [sekme.kod, sekme.ad, sekme.kartlar.length]), [["cam", "Cam Maliyet", 5], ["liste-1", "Bayi Fiyat Listesi 1", 8], ["mika", "Mika Maliyet", 7], ["liste-2", "Bayi Fiyat Listesi 2", 8]]);
    assert.equal(Object.keys(state.kartlar).length, MALIYET_KARTLAR.length);
    for (const kart of Object.values(state.kartlar)) {
      if (kart.tur === "zincir") assert.ok(kart.satirlar.every(satir => satir.miktar === null && satir.fiyat === null), `${kart.kod}: miktar / fiyat boş`);
      if (kart.tur === "matris") assert.ok(Object.values(kart.hucreler).every(hucre => (hucre.taban ?? hucre.fark ?? null) === null), `${kart.kod}: taban / fark boş`);
    }
    const oval = state.kartlar["cam/100x100-oval-kabin"];
    assert.deepEqual(oval.adimlar.map(item => [item.kod, item.etiket, item.oran ?? item.bolen ?? null]), [["ara", "Ara", null], ["yuzde", "KDV", null], ["toplama", "Toplam", null], ["yuzde_ekle", "Maliyet", null], ["bolme", "Oval Kabin CM Maliyeti", 200]]);
    assert.equal(oval.sonuc, 0);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM maliyet_kartlar").n, MALIYET_KARTLAR.length);
    data(await admin.get(BASE));
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM maliyet_kartlar").n, MALIYET_KARTLAR.length, "ikinci açılış yeniden kurmaz");
  });

  it("Kaydet: miktar / fiyat, satır ekle / sil, ✎ adlar, oran / bölen; eklenen satır yalnız ARA'ya girer; etiket ile oran ayrı", async () => {
    const state = data(await admin.get(BASE));
    const kart = state.kartlar["cam/100x100-kose-kabin"];
    const satirlar = rowsOf(kart).map((satir, index) => ({ ...satir, miktar: index + 1, fiyat: "10,5" }));
    satirlar.splice(2, 1); // Fitil silinir
    satirlar.push({ id: "y-ek1", ad: "Silikon", birim: "Adet", miktar: 3, fiyat: 7.25 });
    const saved = data(await admin.put(BASE, {
      sekmeler: [{ kod: "cam", rev: state.sekmeler[0].rev, ad: "Cam Kabin Maliyeti" }],
      kartlar: [{ kod: kart.kod, rev: kart.rev, ad: "100X100 Köşe Kabin Yeni", satirlar, adimlar: [{ kod: "yuzde", oran: 20 }, { kod: "yuzde_ekle", etiket: "%25 Maliyet" }, { kod: "bolme", bolen: "190" }] }],
    }));
    assert.deepEqual(saved.degisen, { kartlar: [kart.kod], sekmeler: ["cam"] });
    const after = saved.kartlar[kart.kod];
    assert.equal(after.rev, kart.rev + 1);
    assert.equal(after.ad, "100X100 Köşe Kabin Yeni");
    assert.equal(saved.sekmeler[0].ad, "Cam Kabin Maliyeti");
    assert.deepEqual(after.satirlar.map(satir => satir.ad), ["Aliminyum", "Cam", "Mıknatıs", "Plastik Malz.", "Tekerlek", "Vida", "Silikon"]);
    let ara = 0;
    for (const satir of satirlar) ara += Number(satir.miktar) * Number(String(satir.fiyat).replace(",", "."));
    assert.equal(adim(after, "ara").deger, ara, "eklenen satır ARA'ya girdi, silinen çıktı");
    assert.equal(adim(after, "yuzde").etiket, "KDV", "oran değişti, etiket değişmedi");
    assert.equal(adim(after, "yuzde").oran, 20);
    assert.equal(adim(after, "yuzde_ekle").oran, null, "etiket değişti, oran değişmedi (2.4.7: boş gelir, boş kaldı)");
    assert.equal(adim(after, "yuzde_ekle").etiket, "%25 Maliyet");
    const toplama = ara + (ara * 20) / 100;
    assert.equal(adim(after, "yuzde_ekle").deger, toplama, "boş oran 0 sayılır");
    assert.equal(after.sonuc, toplama / 190);
    // Yeniden aç: aynı değerler (veri tabanından).
    const reopened = data(await admin.get(BASE)).kartlar[kart.kod];
    assert.deepEqual(reopened, after);
    const audit = server.app.store.get("SELECT payload_json FROM audit_events WHERE type = 'maliyet.saved' ORDER BY rowid DESC LIMIT 1");
    assert.ok(audit, "işlem geçmişine yazıldı");
    assert.doesNotMatch(audit.payload_json, /10\.5|7\.25|Silikon/, "işlem geçmişine değer yazılmaz");
  });

  it("K1: bölen 0, boş ya da sayı değilse reddedilir (\"Bölen 0 olamaz.\"); kayıt değişmez; ön izleme de reddeder", async () => {
    const state = data(await admin.get(BASE));
    const kart = state.kartlar["mika/170-2s2c-h182"];
    for (const bolen of [0, "0", null, ""]) {
      const response = await admin.put(BASE, { kartlar: [{ kod: kart.kod, rev: kart.rev, adimlar: [{ kod: "bolme", bolen }] }] });
      assert.equal(response.status, 400, `bölen ${JSON.stringify(bolen)}`);
      assert.equal(response.data.code, "maliyet-bolen");
      assert.match(response.data.error, /Bölen 0 olamaz\./);
      assert.equal((await admin.post(`${BASE}/onizle`, { kartlar: [{ kod: kart.kod, adimlar: [{ kod: "bolme", bolen }] }] })).status, 400);
    }
    const word = await admin.put(BASE, { kartlar: [{ kod: kart.kod, rev: kart.rev, adimlar: [{ kod: "bolme", bolen: "on yedi" }] }] });
    assert.equal(word.status, 400);
    const bad = await admin.put(BASE, { kartlar: [{ kod: kart.kod, rev: kart.rev, satirlar: [{ id: "s1", miktar: "1.250,5" }] }] });
    assert.equal(bad.status, 400, "binlik ayırıcılı metin tahmin edilmez");
    assert.match(bad.data.error, /sayı olmalı/);
    assert.deepEqual(data(await admin.get(BASE)).kartlar[kart.kod], kart, "reddedilen istekler hiçbir şey yazmadı");
  });

  it("ön izleme yazmaz; değişmeyen kart sürüm denetimine girmez ve yazılmaz", async () => {
    const state = data(await admin.get(BASE));
    const kart = state.kartlar["cam/170-2s2c-h182"];
    const before = server.app.store.get("SELECT COUNT(*) AS n, MAX(rev) AS rev FROM maliyet_kartlar");
    const preview = data(await admin.post(`${BASE}/onizle`, { kartlar: [{ kod: kart.kod, satirlar: [{ id: "s1", miktar: 2, fiyat: 3 }] }] }));
    assert.equal(preview.degisti, true);
    assert.equal(adim(preview.kartlar[kart.kod], "ara").deger, 6, "satır listesi gönderilen gibi (öbür satırlar silinmiş taslak)");
    assert.deepEqual(data(await admin.get(BASE)).kartlar[kart.kod], kart, "ön izleme yazmadı");
    assert.equal(data(await admin.post(`${BASE}/onizle`, { kartlar: [{ kod: kart.kod, ad: kart.ad }] })).degisti, false);
    const same = data(await admin.put(BASE, { kartlar: [{ kod: kart.kod, rev: 999, ad: kart.ad, satirlar: rowsOf(kart) }] }));
    assert.deepEqual(same.degisen, { kartlar: [], sekmeler: [] }, "değişmeyen kart bayat sürümle bile 409 vermez, yazılmaz");
    assert.deepEqual(server.app.store.get("SELECT COUNT(*) AS n, MAX(rev) AS rev FROM maliyet_kartlar"), before);
  });

  it("matris / gramaj / bilgi: taban hücresine fark yazılmaz, ölçü satırı ve bilgi satırı eklenmez; ✎ sütun / ölçü / parça; elle Giden Kğ", async () => {
    const state = data(await admin.get(BASE));
    const matris = state.kartlar["liste-2/seri-kose-girisli"];
    assert.equal((await admin.put(BASE, { kartlar: [{ kod: matris.kod, rev: matris.rev, hucreler: { r1c1: { fark: 5 } } }] })).status, 400);
    assert.equal((await admin.put(BASE, { kartlar: [{ kod: matris.kod, rev: matris.rev, hucreler: { r2c1: { taban: 5 } } }] })).status, 400);
    assert.equal((await admin.put(BASE, { kartlar: [{ kod: matris.kod, rev: matris.rev, hucreler: { r13c1: 5 } }] })).status, 400, "K3: ölçü satırı eklenmez");
    assert.equal((await admin.put(BASE, { kartlar: [{ kod: matris.kod, rev: matris.rev, olculer: { r13: "135 * 135" } }] })).status, 400);
    const saved = data(await admin.put(BASE, { kartlar: [{ kod: matris.kod, rev: matris.rev, hucreler: { r1c2: { taban: 4100 }, r2c2: { taban: 4100 }, r3c2: { fark: 150.5 } }, sutunlar: { c2: "Beyaz 4 MM / Şeffaf Cam" }, olculer: { r1: "70 x 70" } }] })).kartlar[matris.kod];
    assert.equal(saved.hucreler.r3c2.deger, 4250.5, "I6 = I5 (elle taban) + fark");
    assert.equal(saved.hucreler.r4c2.deger, 4250.5, "boş fark 0");
    assert.equal(saved.sutunlar[1].ad, "Beyaz 4 MM / Şeffaf Cam");
    assert.equal(saved.olculer[0].ad, "70 x 70");
    const bilgi = state.kartlar["liste-2/montaj-satirlari"];
    assert.equal((await admin.put(BASE, { kartlar: [{ kod: bilgi.kod, rev: bilgi.rev, satirlar: [{ id: "b9", ad: "Yeni" }] }] })).status, 400, "bilgi kartına satır eklenmez");
    const info = data(await admin.put(BASE, { kartlar: [{ kod: bilgi.kod, rev: bilgi.rev, satirlar: [{ id: "b2", ad: "Lüks Kabin Montajı", degerler: ["1.500 TL"] }] }] })).kartlar[bilgi.kod];
    assert.deepEqual(info.satirlar[1], { id: "b2", ad: "Lüks Kabin Montajı", degerler: ["1.500 TL"] });
    const gramaj = state.kartlar["mika/profil-agirliklari"];
    const satirlar = gramaj.satirlar.map(({ id, parca, cins }) => ({ id, parca, cins }));
    Object.assign(satirlar[0], { giden_kg: 2.75, alis_ft: 100 });
    Object.assign(satirlar[1], { boy: 3, br_gramaj: 0.45, alis_ft: 100, giden_kg: 999 });
    satirlar.push({ id: "y-ek", parca: "Kapak", cins: "Kgr", boy: 2, br_gramaj: 0.1, alis_ft: 50 });
    const g = data(await admin.put(BASE, { kartlar: [{ kod: gramaj.kod, rev: gramaj.rev, satirlar }] })).kartlar[gramaj.kod];
    assert.equal(g.satirlar[0].giden_kg, 2.75, "elle satır girdisi");
    assert.equal(g.satirlar[0].giden_kg_girdi, 2.75);
    assert.equal(g.satirlar[1].giden_kg, 3 * 0.45, "hesaplanan satıra gelen değer yok sayılır");
    assert.equal(g.satirlar.at(-1).giden_kg, 2 * 0.1, "eklenen satırda Giden Kğ hesaplanır");
    assert.equal(g.toplam.giden_kg, 2.75 + 3 * 0.45 + 2 * 0.1);
    assert.equal(g.toplam.satir_top, 100 * 2.75 + 100 * (3 * 0.45) + 50 * (2 * 0.1));
  });

  it("iki kişi aynı anda: aynı kartta ikinci kaydeden 409 (ilkinin değişikliği korunur); farklı kartlar ikisi de yazılır; eşzamanlı iki PUT'tan biri geçer", async () => {
    const other = await createUser(server, admin, { username: "muh246", role: "muhasebe" });
    await grant(admin, "muh246", ["maliyet.view", "maliyet.manage"]);
    const a = data(await admin.get(BASE));
    const b = data(await other.get(BASE));
    const kod = "cam/130-1s1c-h182-kabin";
    data(await admin.put(BASE, { kartlar: [{ kod, rev: a.kartlar[kod].rev, satirlar: [{ id: "s1", ad: "Aliminyum", birim: "Kgr", miktar: 1, fiyat: 100 }] }] }));
    const stale = await other.put(BASE, { kartlar: [{ kod, rev: b.kartlar[kod].rev, satirlar: [{ id: "s1", ad: "Aliminyum", birim: "Kgr", miktar: 9, fiyat: 9 }] }, { kod: "cam/100x100-oval-kabin", rev: b.kartlar["cam/100x100-oval-kabin"].rev, ad: "Yarım Kalmasın" }] });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.code, "maliyet-stale");
    assert.deepEqual(stale.data.bayat.map(item => item.kod), [kod]);
    assert.match(stale.data.error, /başka biri kaydetti/);
    const now = data(await admin.get(BASE));
    assert.equal(now.kartlar[kod].satirlar[0].miktar, 1, "ilk kaydedenin değeri korundu");
    assert.equal(now.kartlar["cam/100x100-oval-kabin"].ad, "100X100 Oval Kabin", "409'da aynı istekteki öbür kart da yazılmadı (tek işlem)");
    const otherCard = "mika/100x100-oval-kabin";
    data(await other.put(BASE, { kartlar: [{ kod: otherCard, rev: b.kartlar[otherCard].rev, ad: "Mika Oval" }, { kod, rev: b.kartlar[kod].rev, ad: b.kartlar[kod].ad, satirlar: rowsOf(now.kartlar[kod]) }] }));
    const rev = data(await admin.get(BASE)).kartlar[otherCard].rev;
    const results = await Promise.all([admin, other].map((client, index) => client.put(BASE, { kartlar: [{ kod: otherCard, rev, ad: `Eşzamanlı ${index}` }] })));
    assert.deepEqual(results.map(item => item.status).sort(), [200, 409]);
    const winner = results.findIndex(item => item.status === 200);
    assert.equal(data(await admin.get(BASE)).kartlar[otherCard].ad, `Eşzamanlı ${winner}`);
  });

  it("yetki: maliyet.view / maliyet.manage (varsayılan yalnız yönetici); Muhasebe ve Personel rolü görmez; izin verilince görür / yazar; kaldırılınca kapanır", async () => {
    const personel = await createUser(server, admin, { username: "per246", role: "personel" });
    const muhasebe = await createUser(server, admin, { username: "muhy246", role: "muhasebe" });
    for (const [client, name] of [[personel, "Personel"], [muhasebe, "Muhasebe"]]) {
      for (const res of [await client.get(`${BASE}/durum`), await client.get(BASE), await client.post(`${BASE}/onizle`, { kartlar: [] })]) assert.equal(res.status, 403, `${name} rolü varsayılan olarak göremez`);
      const me = (await client.get("/api/auth/me")).data.data;
      const perms = me?.permissions;
      assert.ok(Array.isArray(perms) && perms.includes("stock.view"), `${name}: yetki listesi okundu`);
      assert.ok(!perms.includes("maliyet.view") && !perms.includes("maliyet.manage"), `${name}: yetki listesinde maliyet yok`);
    }
    await grant(admin, "per246", ["maliyet.view"]);
    const read = data(await personel.get(BASE));
    assert.equal(read.canManage, false);
    assert.equal(data(await personel.get(`${BASE}/durum`)).canManage, false);
    assert.equal(data(await personel.post(`${BASE}/onizle`, { kartlar: [] })).degisti, false);
    const kart = read.kartlar["cam/100x100-oval-kabin"];
    const put = await personel.put(BASE, { kartlar: [{ kod: kart.kod, rev: kart.rev, ad: "Yetkisiz" }] });
    assert.equal(put.status, 403);
    assert.equal(data(await admin.get(BASE)).kartlar[kart.kod].ad, kart.ad);
    // Düzenleme görüntülemesiz yetmez.
    await grant(admin, "per246", ["maliyet.manage"], ["maliyet.view"]);
    assert.equal((await personel.put(BASE, { kartlar: [{ kod: kart.kod, rev: kart.rev, ad: "Yetkisiz" }] })).status, 403);
    assert.equal((await personel.get(BASE)).status, 403);
    assert.equal((await personel.get(`${BASE}/durum`)).status, 403);
    await grant(admin, "per246", ["maliyet.view", "maliyet.manage"]);
    assert.equal(data(await personel.get(BASE)).canManage, true);
    const saved = data(await personel.put(BASE, { kartlar: [{ kod: kart.kod, rev: kart.rev, ad: "İzinli Ad" }] }));
    assert.equal(saved.kartlar[kart.kod].ad, "İzinli Ad");
    data(await admin.put(BASE, { kartlar: [{ kod: kart.kod, rev: saved.kartlar[kart.kod].rev, ad: kart.ad }] }));
  });

  it("sektör değişince veri silinmez (yalnız kapanır); yeniden seçilince aynen döner; yeniden başlatınca kalır", async () => {
    const before = data(await admin.get(BASE));
    await setSector(admin, "uretim");
    assert.equal((await admin.get(BASE)).status, 403);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM maliyet_kartlar").n, MALIYET_KARTLAR.length, "veri duruyor");
    await setSector(admin, "dusakabin");
    assert.deepEqual(data(await admin.get(BASE)), before);
    const dataDir = server.dataDir;
    roots.push(server.root);
    await server.app.close();
    const restarted = await startTestServer({ dataDir, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    try {
      const client = await loginAdmin(restarted);
      assert.deepEqual(data(await client.get(BASE)).kartlar, before.kartlar, "yeniden başlatınca aynı");
    } finally {
      await restarted.close();
    }
    server = await startTestServer({ dataDir, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
  });

  it("şirket kapsamı: 002'nin sektörü ayrı; 002 Duşakabin değilken kapalı, seçilince kendi boş şablonu; yedek → geri yükle; Tüm Hareketleri Sil dokunmaz, Tümünü Sıfırla siler", async () => {
    const second = data(await admin.post("/api/companies", { name: "Kabin Şirketi" })).company;
    const q = `?hofCompany=${second.id}`;
    assert.equal((await admin.get(`${BASE}${q}`)).status, 403, "001 Duşakabin, 002 değil");
    await setSector(admin, "dusakabin", q);
    const fresh = data(await admin.get(`${BASE}${q}`));
    const kod = "cam/100x100-oval-kabin";
    assert.equal(fresh.kartlar[kod].ad, "100X100 Oval Kabin", "002'nin kendi boş şablonu (001'in değişikliği gelmez)");
    const first = data(await admin.put(`${BASE}${q}`, { kartlar: [{ kod, rev: fresh.kartlar[kod].rev, satirlar: [{ id: "s1", ad: "Aliminyum", birim: "Kgr", miktar: 2, fiyat: 50 }] }] }));
    const snapshot = async () => data(await admin.get(`${BASE}${q}`)).kartlar[kod];
    const before = await snapshot();
    const backup = data(await admin.post("/api/admin/backups", { scope: "one", companyId: second.id })).backups[0].name;
    data(await admin.put(`${BASE}${q}`, { kartlar: [{ kod, rev: first.kartlar[kod].rev, satirlar: [{ id: "s1", ad: "Aliminyum", birim: "Kgr", miktar: 3, fiyat: 50 }] }] }));
    assert.notDeepEqual(await snapshot(), before);
    data(await admin.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    assert.deepEqual(await snapshot(), before, "geri yüklenince yedek anındaki gibi");
    data(await admin.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: ADMIN_PASSWORD }));
    assert.deepEqual(await snapshot(), before, "Tüm Hareketleri Sil maliyet kartına dokunmaz");
    data(await admin.post(`/api/companies/${second.id}/reset`, { mode: "all", confirm: second.code, password: ADMIN_PASSWORD }));
    assert.equal((await admin.get(`${BASE}${q}`)).status, 403, "Tümünü Sıfırla sektörü de sıfırlar");
    await setSector(admin, "dusakabin", q);
    const reset = await snapshot();
    assert.equal(reset.rev, 1);
    assert.ok(reset.satirlar.every(satir => satir.miktar === null && satir.fiyat === null), "Tümünü Sıfırla'dan sonra boş şablon");
    assert.equal(data(await admin.get(BASE)).kartlar[kod].ad, "100X100 Oval Kabin", "001 etkilenmez");
  });
});
