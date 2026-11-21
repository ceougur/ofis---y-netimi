// 2.5.0 S231 — çek / senet içe aktarmasının HIZ düzeltmesinin EŞDEĞERLİĞİ (ders 47: hız düzeltmesi eşdeğerlik testiyle). S223'ün ad haritası
// (lib/names.mjs foldedNameIndex: bütün cariler satır satır, her ad ayrı katlanır) yerine çek yüklemesi foldedNameLookup kullanır (adlar tek metin,
// tek seferde katlanır, yalnız aranan adlar haritaya girer). Sonuç her ad için AYNI kimlikler olmalı:
//   (1) foldJoinedNames: birleşik metnin her öğesi foldPersonName(öğe) ile aynı — bütün Unicode kod noktaları, birleşen nokta, boşluk türleri, son sigma.
//   (2) foldedNameLookup ↔ foldedNameIndex: aranan / aranmayan ad, silinmiş / eklenmiş kayıt, adında ayraç ("\u0000" / "\u0001") geçen kayıt (yedek yol).
//   (3) Programda: accounts servisinin personIndexFor ↔ personIndex — matchName aynı cari (ya da boş) döner; veri tabanında adında ayraç olan cari varken de.
// NASIL BOZARIM (mutantlar): önbellek anahtarını aranan adın İngilizce küçük harfi yapmak; birleşik metinde baş / son boşluğu kırpmamak; ayraç denetimini
// kaldırmak; aranmayan adı yedek yola değil boş sonuca göndermek.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must, rawRun } from "./banka-210-ortak.mjs";
import * as names from "../server/lib/names.mjs";

const NOW = "2026-10-08T12:00:00+03:00";

describe("S231 — çek yüklemesinin ad haritası (foldedNameLookup) S223'ünkiyle eşdeğer", () => {
  it("(1) foldJoinedNames: birleşik metnin her öğesi foldPersonName ile aynı (bütün kod noktaları × bağlam)", () => {
    const { foldJoinedNames, foldPersonName } = names;
    assert.equal(typeof foldJoinedNames, "function", "lib/names.mjs foldJoinedNames yok");
    const patterns = char => [char, `A${char}`, `${char}\u0307`, `I${char}`, `İ${char}`, ` ${char}  ${char}\t`, `Σ${char}`, `${char}AΣ`, `\u0301${char}x`];
    let differences = 0;
    let checked = 0;
    let batch = [];
    const flush = () => {
      if (!batch.length) return;
      const joined = batch.map((value, i) => `k${i}\u0001${value}`).join("\u0000");
      const items = foldJoinedNames(joined).split("\u0000");
      assert.equal(items.length, batch.length, "öğe sayısı");
      for (let i = 0; i < batch.length; i += 1) {
        const item = items[i];
        const cut = item.indexOf("\u0001");
        if (item.slice(0, cut) !== `k${i}` || item.slice(cut + 1) !== foldPersonName(batch[i])) {
          differences += 1;
          if (differences < 5) console.log("fark", JSON.stringify(batch[i]), JSON.stringify(item.slice(cut + 1)), JSON.stringify(foldPersonName(batch[i])));
        }
      }
      checked += batch.length;
      batch = [];
    };
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if ((code >= 0xd800 && code <= 0xdfff) || code === 0 || code === 1) continue;
      batch.push(...patterns(String.fromCodePoint(code)));
      if (batch.length >= 90_000) flush();
    }
    // Elle bağlam: son sigma ad sonunda / ortasında, baş ve son boşluk, yalnız boşluk, boş ad.
    batch.push("ΟΔΟΣ", "ΟΔΟΣ ", "ΟΔΟΣ'", "'Σ", "ΑΣ Β", "   ", "", " \t Ahmet  Yılmaz \u00a0", "İSMAİL", "ILGIN", "Ahmet\u3000Yılmaz");
    flush();
    assert.ok(checked > 9_000_000, `denetlenen ${checked}`);
    assert.equal(differences, 0, "birleşik katlama öğe başına katlamadan farklı");
  });

  it("(2) foldedNameLookup ↔ foldedNameIndex: aranan, aranmayan, eklenen kayıt ve ayraçlı metinde aynı kimlikler", () => {
    const { foldedNameLookup, foldedNameIndex } = names;
    assert.equal(typeof foldedNameLookup, "function", "lib/names.mjs foldedNameLookup yok");
    const rows = [
      ["a1", "Ahmet Yılmaz"], ["a2", "AHMET YILMAZ"], ["a3", "ahmet  yılmaz "], ["a4", "Ahmet\tYılmaz"], ["a5", "İsmail Işık"], ["a6", "ISMAIL IŞIK"],
      ["a7", "e\u0301lif"], ["a8", "élif"], ["a9", "ΟΔΟΣ"], ["a10", "οδος"], ["a11", "οδοσ"], ["a12", "   "], ["a13", "Zeynep Kılıç"], ["a14", "Şükrü Özçelik"],
      ["a15", "ŞÜKRÜ ÖZÇELİK"], ["a16", "K\u212a Ltd"], ["a17", "kk ltd"], ["a18", "Ahu Ak"],
    ];
    const joined = list => () => ({ n: list.length, bad: list.filter(([, name]) => /[\u0000\u0001]/.test(name)).length, s: list.map(([id, name]) => `${id}\u0001${name}`).join("\u0000") });
    const wanted = ["AHMET YILMAZ", "İSMAİL IŞIK", "ÉLİF", "οδος", "ΟΔΟΣ", "  ", "zeynep kılıç", "Şükrü ÖZÇELİK", "KK LTD", "Yok Kişi", "ALİ\u0001 VELİ"];
    const sameKey = ["ismail ışık", "ŞÜKRÜ ÖZÇELİK", "ahmet\u00a0yılmaz"]; // aranan kümede yazılmamış ama anahtarı aynı (yedek yola GİTMEZ)
    const others = ["Ahu Ak", "Başka Ad"]; // anahtarı aranan kümede değil (yedek yol); 'Ahu Ak' veride var
    // expectFallback: düz metinde aranan / aynı anahtarlı adlar yedek yolu ÇAĞIRMAZ (daraltılmış harita kullanılır); ayraçlı metinde ilk soruda çağırır.
    const compare = (list, label, expectFallback) => {
      const old = foldedNameIndex(() => list.map(([id, name]) => ({ id, name })));
      let fallbackCalls = 0;
      const fallback = foldedNameIndex(() => {
        fallbackCalls += 1;
        return list.map(([id, name]) => ({ id, name }));
      });
      const fresh = foldedNameLookup(wanted, joined(list), fallback);
      for (const name of [...wanted, ...sameKey]) assert.deepEqual(fresh.ids(name).sort(), old.ids(name).sort(), `${label}: ${JSON.stringify(name)}`);
      assert.equal(fallbackCalls, expectFallback ? 1 : 0, `${label}: aranan adlarda yedek yol çağrısı`);
      for (const name of others) assert.deepEqual(fresh.ids(name).sort(), old.ids(name).sort(), `${label}: ${JSON.stringify(name)}`);
      assert.equal(fallbackCalls, 1, `${label}: aranmayan ad yedek yoldan (bir kez kurulur)`);
      fresh.add("n1", "Ahmet YILMAZ");
      old.add("n1", "Ahmet YILMAZ");
      assert.deepEqual(fresh.ids("ahmet yılmaz").sort(), old.ids("ahmet yılmaz").sort(), `${label}: eklenen`);
    };
    assert.deepEqual(foldedNameIndex(() => rows.map(([id, name]) => ({ id, name }))).ids("Ahu Ak"), ["a18"], "ön koşul: 'Ahu Ak' veride");
    compare(rows, "düz", false);
    compare([...rows, ["b1", "Ali\u0001 Veli"]], "adında U+0001", true);
    compare([...rows, ["b2", "Ali\u0000Veli"]], "adında U+0000", true);
    // Öğe sayısı tutmazsa (bad doğru bildirilmese de) yedek yol.
    const broken = foldedNameLookup(["Ali Veli"], () => ({ n: 2, bad: 0, s: "c1\u0001Ali\u0000Veli\u0000c2\u0001Ali Veli" }), foldedNameIndex(() => [{ id: "c1", name: "Ali\u0000Veli" }, { id: "c2", name: "Ali Veli" }]));
    assert.deepEqual(broken.ids("ali veli"), ["c2"]);
  });

  describe("(3) programda personIndexFor ↔ personIndex (matchName)", () => {
    let ctx;
    let api;
    before(async () => {
      ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
      api = ctx.api;
    });
    after(() => ctx?.server.close());

    it("büyük / küçük harf, boşluk, çift cari, silinmiş cari, adında ayraç olan cari: aynı cari", async () => {
      const make = async (name, phone = "") => (await must(`cari ${name}`, api.post("/api/workspace/accounts", { name, phone, type: "customer", registeredOn: "2026-10-01" }))).id;
      for (const name of ["Ahmet Yılmaz", "Zeynep Kılıç", "ZEYNEP KILIÇ", "İlker Işık", "Deniz Ak", "Ömer Çiftçi"]) await make(name);
      const gone = await make("Bora Ünsal");
      await must("sil", api.del(`/api/workspace/accounts/${gone}`));
      const service = ctx.app.context.accounts;
      assert.equal(typeof service.personIndexFor, "function", "routes/accounts.mjs personIndexFor yok");
      const drawers = ["AHMET YILMAZ", "ahmet  yılmaz", "Zeynep Kılıç", "ZEYNEP KILIÇ", "ZEYNEP KILIç", "İLKER IŞIK", "DENİZ AK", " ÖMER ÇİFTÇİ ", "BORA ÜNSAL", "Yok Kişi", ""];
      const check = label => {
        const fresh = service.personIndexFor(drawers);
        const old = service.personIndex();
        for (const name of [...drawers, "ilker ışık"]) assert.equal(service.matchName(name, fresh), service.matchName(name, old), `${label}: ${JSON.stringify(name)}`);
        return drawers.map(name => service.matchName(name, fresh));
      };
      const first = check("düz");
      assert.ok(first[0] && first[7], "büyük harfli ad tek cariye bağlanır (ön koşul)");
      assert.equal(first[4], "", "çift caride iki adaylı yazım bağlanmaz (ön koşul)");
      assert.equal(first[8], "", "silinmiş cari aday değil (ön koşul)");
      const odd = await make("Ali Veli");
      rawRun(ctx.db, "UPDATE accounts SET name = ? WHERE id = ?", "Ali\u0001 Veli", odd);
      check("ayraçlı ad (yedek yol)");
    });
  });
});
