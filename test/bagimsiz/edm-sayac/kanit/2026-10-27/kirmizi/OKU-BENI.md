# Kırmızı kanıt — kâhin testinin dişi (ders 7, 38)

Bu klasördeki kayıt BİLEREK BAŞARISIZDIR. `ozet` yalnız üst klasörü (`../`) okur; bu klasör yeşil kayıtla karışmaz.

- Kod: commit 8e3f67d'nin `test/bagimsiz/edm-sayac/` kopyası, `git archive 8e3f67d test/bagimsiz/edm-sayac | tar -x` ile not defterinde ayrı
  bir klasöre açıldı (ders 23, 25). Yalnız `kahin.py` `Kahin.islem` içine `k = self.anahtar(o)` satırından sonra şu hata eklendi:

  ```python
  if t == "iptal":  # BİLEREK HATA (kırmızı kanıt): iptal sayılmış belgeyi düşürür
      d.kayitlar.pop(k, None)
      return
  ```
- Komut: `KANIT_DIR=<kopya>/kanit node tools/kanit.mjs kos kahin-sayac-kirmizi-iptal-dusurur -- python3 -I <kopya>/test/bagimsiz/edm-sayac/kahin_test.py`
- Sonuç: çıkış 1, 103/114, 11 başarısız. Nedenler beklenen davranışın yokluğu: A1 (yeniden üretim elle beklentiyle ayrışır), B U08 (Ekim kaydı
  iptalle düştü), B U10, B U18 ve B U32 (iptal sonrası 0), C R1–R3 ve C4 (iptal edilen belgeler eksik), D2 monotonluk (sayı azaldı), D5 gürültü
  (eklenen iptal sayıyı değiştirdi). Ham çıktı
  `kahin-sayac-kirmizi-iptal-dusurur.log`.
- Aynı kodun düzgün hâli: `../kahin-sayac.json` (114/114, çıkış 0, commit 8e3f67d).
