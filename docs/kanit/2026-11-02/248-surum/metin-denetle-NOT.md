# Kılavuz metin denetimi (docs/kilavuz/metin-denetle.mjs) — 2.4.8 sürüm commit'i

- 2.4.8 (843ddf93 + sürüm commit'i): metin-denetle 168/200, 32 ad bulunamadı (30'u 8. Banka, 2'si 7. Kasa). Girdisini veren
  docs/kilavuz/ekran-banka.mjs: 37 denetim geçti, 7 başarısız (dogrulanmadi, kart, kredi, genel-bakis, planli-ikinci-kart zaman aşımı;
  Banka raporları ve Banka yetkileri ekranları açılamadığı için eksik). Ham çıktı: ekran-banka-248.log, metin-denetle-248.log.
- v2.4.7 (etiket, ayrı kopya `git archive v2.4.7`, ders 23): ekran-banka.mjs AYNI — 37 geçti, 7 başarısız, aynı adımlar. Ham çıktı: ekran-banka-v247.log.
- Sonuç: 2.4.8 gerilemesi DEĞİL; kılavuz ekran betiğinin örnek akışı eskimiş (betik son 2.2.0'da değişti; metin-denetle 2.4.x'te koşulmamış, son kanıt
  2026-10-11). Ders 42'nin zorunlu denetimi pdf-denetle 39/39 yeşil. Betiğin güncellenmesi → 2.4.9 (teslim notu DENENMEYEN: kılavuz Banka/Kasa ad denetimi).
