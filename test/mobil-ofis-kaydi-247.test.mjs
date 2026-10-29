// 2.4.7 M3/M4: ofis kaydı ilk kullanımda bir kez üretilir. Yeni kurulumda özet eşitlemesi (mobile-sync) ile tünel başvurusu (gate-client)
// aynı anda ofisKaydi() çağırırsa iki ayrı kimlik/anahtar üretilmemeli: bellekte biri, ayarda öbürü kalırsa yeniden açılışta telefon adresi
// (<kimlik>.destekofis.net) değişir ve eşli cihazlar kopar (M4 uçtan uca test ajanının bulgusu, 29.10.2026).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ofisKaydi } from "../server/lib/mobile-ozet.mjs";

function bellekDepo() {
  const ayarlar = new Map();
  return {
    setting: (anahtar, varsayilan) => (ayarlar.has(anahtar) ? ayarlar.get(anahtar) : varsayilan),
    setSetting: (anahtar, deger) => ayarlar.set(anahtar, deger),
    ayarlar,
  };
}

describe("2.4.7 ofis kaydı: eşzamanlı ilk kullanım tek kimlik üretir", () => {
  it("aynı anda iki çağrı → aynı kimlik ve anahtar; ayardaki kayıt da o", async () => {
    const store = bellekDepo();
    const [a, b] = await Promise.all([ofisKaydi(store), ofisKaydi(store)]);
    assert.equal(a.id, b.id, "iki çağrı aynı ofis kimliğini almalı");
    assert.equal(a.sir, b.sir, "iki çağrı aynı kapıcı sırrını almalı");
    assert.deepEqual(a.acik, b.acik, "iki çağrı aynı açık anahtarı almalı");
    const sonraki = await ofisKaydi(store);
    assert.equal(sonraki.id, a.id, "ayara yazılan kayıt bellekteki kimlikle aynı olmalı (yeniden açılışta adres değişmez)");
  });

  it("beş eşzamanlı çağrı → tek kimlik; kayıt ayara bir kez yazılır", async () => {
    const store = bellekDepo();
    let yazim = 0;
    const yaz = store.setSetting;
    store.setSetting = (k, v) => { yazim += 1; return yaz(k, v); };
    const sonuclar = await Promise.all(Array.from({ length: 5 }, () => ofisKaydi(store)));
    assert.equal(new Set(sonuclar.map(s => s.id)).size, 1, "tek ofis kimliği");
    assert.equal(yazim, 1, "kayıt ayara yalnız bir kez yazılmalı");
  });

  it("ayrı depolar ayrı kimlik alır (tek uçuş depo başına)", async () => {
    const [a, b] = await Promise.all([ofisKaydi(bellekDepo()), ofisKaydi(bellekDepo())]);
    assert.notEqual(a.id, b.id);
  });
});
