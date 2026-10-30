# Bilerek kırmızı kanıt (ders 7, 23, 38)

Amaç: `kahin_test.py`'nin dişi olduğunu, modelin GERÇEK bir sapmasında (mutasyon anahtarı değil, koda gömülü hata) kırmızı verdiğini göstermek.

- Ayrı kopya (ders 23): `mobil-yazma/` ve `cari/` dosyaları not defterinde benzersiz klasöre (`mobilyazma247-kirmizi/`) kopyalandı; çalışma ağacına
  dokunulmadı. Komut kayıtta (`komut` alanı) — kopyanın yolu.
- Gömülen hata: `kahin.py` yazım adımında POS tahsilatı da Kasa'ya yazılır (kalıcı karar "Kasa yalnız nakit"in ihlali):
  `if yol == "nakit" or (yol == "pos" and mut == 13) …` → `if yol in ("nakit", "pos") or …`.
- Beklenen neden (ders 38): POS tahsilatı olan elle senaryolarda (E02 çifti, E28) `kasa` / `kasaGun` / `pos:<hesap>` farkı ve rastgele senaryolarda akış
  beklentisiyle fark; kabul.json yeniden üretilemez (A1). Kayıt `kahin-mobil-yazma-kirmizi-pos-kasaya.{json,log}`: çıkış 1, başarısız testlerin iletisinde
  model ile elle beklenenin Kasa / POS değerleri.
- Aynı testler hatasız modelde yeşil: `../../2026-10-29/kahin-mobil-yazma-son.{json,log}`.
