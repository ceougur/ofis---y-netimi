import sys
D = sys.argv[1]


def duzenle(ad, cift):
    p = f"{D}/{ad}"
    t = open(p, encoding="utf-8").read()
    for a, b in cift:
        assert t.count(a) == 1, (ad, a[:60], t.count(a))
        t = t.replace(a, b)
    open(p, "w", encoding="utf-8").write(t)


duzenle("karsilastir.py", [
    ('''    "C7b6-KAPAT": ("''', '''    "F06-FINANSMAN-251": ("kitap F-06 / M14 'finansman türü 780'; Ç7b tasarım notu §9 B-1 (BAŞ MİMAR KARARI 19.11 04:03) B-1 = B: '780 türü ve tanınmayan türün 770.90'ı 2.5.1' — programın gider türü listesinde finansman yok, 770'e düşer", "2.5.1 (Ç7b B-1; iş listesi B)"),
    "C7b6-KAPAT": ("'''),
    ('''    "C7b6-KAPAT": "Ç7b-(6)",''', '''    "F06-FINANSMAN-251": "2.5.1-Ç7b-B1 (F-06 finansman 780)",
    "C7b6-KAPAT": "Ç7b-(6)",'''),
    ('''        # SÜRÜCÜ BAKIMI 4: KG2-H03 / KG3-KAYIT / KG8-IADE-KDV / KG24-IHRACAT / F06-GIDER-TURU dönüşümleri kalktı (Ç7b tur 2–2e programda).
''', '''        # SÜRÜCÜ BAKIMI 4: KG2-H03 / KG3-KAYIT / KG8-IADE-KDV / KG24-IHRACAT / F06-GIDER-TURU dönüşümleri kalktı (Ç7b tur 2–2e programda). Finansman gider türü (780) Ç7b B-1 = B
        # ile 2.5.1'de: BUGÜN görünümünde 770 (U, kimlik 2.5.1-Ç7b-B1).
        elif h == "780" and tur in ("alis_faturasi", "alis_iade_faturasi") and v.get("gider_turu") == "finansman":
            n = "770"
            et.add("F06-FINANSMAN-251")
'''),
])
duzenle("program.mjs", [
    ('''        if (!hid) return apiYok(`silinecek ${h.tur} hesabı ${h.anahtar} programda yok`);
''', '''        if (!hid) return apiYok(`silinecek ${h.tur} hesabı ${h.anahtar} programda yok`);
        await altHesaplariOku();   // silinen hesabın alt hesap kodu (102.NN) eşlemede kalsın — sondaki okuma silinen hesabı listelemez
'''),
    ('''  for (const i of sira) {
    const o = s.olaylar[i];
    const no = i + 1;''', '''  // SÜRÜCÜ BAKIMI 4 (kâhin bakımı 13 A7 s104 / Ü19: 'F2 / P2 / KA aynı yedekten'): geri yüklenen yedekte bulunan kayıtların GİRİŞ sırası yedeğin içeriğini değiştirmez
  // (README senaryo dili `yedekten`: 'kayıt geri yüklenen yedekte / eski sürüm verisinde vardı — veri aynen'). Eski sürüm (v2.4.9) Kasa açılışını ilk Kasa hareketinden SONRA
  // tarihli kabul etmez (409 cash-opening-after-first); açılış önce girilir, sonra açılıştan önce tarihli hareket (eski sürümde S12 yok) — yedekteki veri aynı.
  // Yalnız eski sürüm aşamasında (olay no ≤ SON_YEDEK) ve yalnız kesintisiz `yedekten` bloğunun içinde; karşılaştırıcı kâhini programın sırasıyla uygular (yedekten olayda
  // kâhin S12 / R8 uygulamaz).
  if (SON_YEDEK) {
    for (let p = 0; p < sira.length; p += 1) {
      const o = s.olaylar[sira[p]];
      if (!(o.tur === "kasa_acilis" && o.yedekten && sira[p] + 1 <= SON_YEDEK)) continue;
      let q = p;
      while (q > 0 && s.olaylar[sira[q - 1]].yedekten) q -= 1;
      if (q < p) sira.splice(q, 0, ...sira.splice(p, 1));
    }
  }
  for (const i of sira) {
    const o = s.olaylar[i];
    const no = i + 1;'''),
])
print("tamam")
