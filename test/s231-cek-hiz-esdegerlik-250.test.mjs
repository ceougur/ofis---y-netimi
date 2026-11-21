// 2.5.0 S231 — çek / senet içe aktarmasının HIZ düzeltmesinin EŞDEĞERLİĞİ (ders 47: hız düzeltmesi eşdeğerlik testiyle). S223'ün ad haritası
// (lib/names.mjs foldedNameIndex: bütün cariler satır satır, her ad ayrı katlanır) yerine çek yüklemesi foldedNameLookup kullanır (adlar tek metin,
// tek seferde katlanır, yalnız aranan adlar haritaya girer). Sonuç her ad için AYNI kimlikler olmalı:
//   (1) foldJoinedNames: birleşik metnin her öğesi foldPersonName(öğe) ile aynı — bütün Unicode kod noktaları, birleşen nokta, boşluk türleri, son sigma.
//   (2) foldedNameLookup ↔ foldedNameIndex: aranan / aranmayan ad, silinmiş / eklenmiş kayıt, adında ayraç ("\u001f") geçen kayıt (yedek yol).
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
      const items = foldJoinedNames(batch.join("\u001f")).split("\u001f");
      assert.equal(items.length, batch.length, "parça sayısı");
      for (let i = 0; i < batch.length; i += 1) {
        if (items[i] !== foldPersonName(batch[i])) {
          differences += 1;
          if (differences < 5) console.log("fark", JSON.stringify(batch[i]), JSON.stringify(items[i]), JSON.stringify(foldPersonName(batch[i])));
        }
      }
      checked += batch.length;
      batch = [];
    };
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if ((code >= 0xd800 && code <= 0xdfff) || code === 0x1f) continue;
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
    const joined = list => () => ({ n: list.length, r: list.map((_, i) => String(i + 1)).join(","), s: list.map(([, name]) => name).join("\u001f") });
    const idsOf = list => rowids => new Map(rowids.map(rowid => [rowid, list[Number(rowid) - 1][0]]));
    const wanted = ["AHMET YILMAZ", "İSMAİL IŞIK", "ÉLİF", "οδος", "ΟΔΟΣ", "  ", "zeynep kılıç", "Şükrü ÖZÇELİK", "KK LTD", "Yok Kişi", "ALİ\u001e VELİ"];
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
      const fresh = foldedNameLookup(wanted, joined(list), idsOf(list), fallback);
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
    compare([...rows, ["b1", "Ali\u001e Veli"]], "adında U+001E (ayraç değil)", false);
    compare([["b2", "Ali\u001fVeli"], ...rows], "adında U+001F (ayraç; listenin başında — kayma)", true);
    // Parça sayısı tutmazsa yedek yol.
    const broken = foldedNameLookup(["Ali Veli"], () => ({ n: 2, r: "1,2", s: "Ali\u001fVeli\u001fAli Veli" }), () => new Map([["1", "c1"], ["2", "c2"]]), foldedNameIndex(() => [{ id: "c1", name: "Ali\u001fVeli" }, { id: "c2", name: "Ali Veli" }]));
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
      // HIZ YOLU GERÇEKTEN KULLANILIYOR MU: aranan adlarda personIndexFor satır satır okumaya (personIndex'in sorgusu) DÜŞMEMELİ. (Ölçülen hata: ayraç
      // U+0000 iken veri tabanı sürücüsü birleşik metni kesiyordu → her yüklemede yedek yol; sonuç doğru, süre S223'ten kötü.)
      const ROW_SQL = "SELECT id, name FROM accounts WHERE deleted_at IS NULL";
      const store = ctx.app.store;
      const realAll = store.all;
      let rowReads = 0;
      store.all = function (sql, ...args) {
        if (sql === ROW_SQL) rowReads += 1;
        return realAll.call(this, sql, ...args);
      };
      const check = (label, expectRowReads) => {
        rowReads = 0;
        const fresh = service.personIndexFor(drawers);
        const got = drawers.map(name => service.matchName(name, fresh));
        assert.equal(rowReads, expectRowReads, `${label}: satır satır okuma (yedek yol) sayısı`);
        const old = service.personIndex();
        for (const name of [...drawers, "ilker ışık"]) assert.equal(service.matchName(name, fresh), service.matchName(name, old), `${label}: ${JSON.stringify(name)}`);
        return got;
      };
      let first;
      try {
        first = check("düz", 0);
      } catch (error) {
        store.all = realAll;
        throw error;
      }
      assert.ok(first[0] && first[7], "büyük harfli ad tek cariye bağlanır (ön koşul)");
      assert.equal(first[4], "", "çift caride iki adaylı yazım bağlanmaz (ön koşul)");
      assert.equal(first[8], "", "silinmiş cari aday değil (ön koşul)");
      const odd = await make("Ali Veli");
      rawRun(ctx.db, "UPDATE accounts SET name = ? WHERE id = ?", "Ali\u001f Veli", odd);
      try {
        check("adında ayraç U+001F (yedek yol)", 1);
      } finally {
        store.all = realAll;
      }
    });
  });
});
