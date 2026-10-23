# r31e N1 + Y8 (is/r31e-n1, taban aday11 39382c4)

Kayıtlar (tools/kanit.mjs kos; ../r31e-n1-*.json/.log):
- r31e-n1-kirmizi-eski-39382c4: yeni test (test/numara-silinen-tarih-244.test.mjs) ESKİ kodda (git worktree 39382c4) 0/7. Nedenler iletide: A1/A2/A4/A5 bugün−3/−4
  tarihli fiş 400 "son belge … (belge silindi; numara kullanılmış sayılır) … tarihli"; A3 Düzenle 400 "Sonraki belge FIS…002 (belge silindi…)"; B1 taban kaydında
  kept yok; C1 lib/number-floor.mjs yok (yeni modül — yapısal kırmızı).
- r31e-n1-yesil: yeni test + numara-silinen-244 (S4 bilerek güncellendi) + ux18 (T11b yeni) 35/35.
- r31e-n1-mutasyon: 9/9 yakalandı (mutasyon.py; ayrı kopya 39382c4 + yeni dosyalar). M6q (Y8) yalnız T11b'yi kırar: 409 invoice-paid-elsewhere
  "kendi ödemesi dışında 400,00 TL ödeme sayılmış" (beklenen neden).
- r31e-n1-komsular: 60 dosya 592/592. r31e-n1-e2e-senaryo-217 (Silinenler fatura yolu, flock): 65/65.
- Kâhin (test/bagimsiz/ebelge, DOKUNULMADI): kahin-ebelge-senaryolar.txt 23/24 — hedefli-244-e6-silinen-numara fark 4 + ihlal 1 (kahin-ebelge-e6-fark.json): adım 4 B3
  (06-15, silinen B2 06-16'dan sonra) model 4xx / program 200; adım 6 B2 geri yükleme model 2xx / program 409 invoice-restore-chronology; ihlal I2 silinen B2'yi sayıyor.
  Kâhinin K38/K39 "sıra-tarih tabanı silineni de sayar" kuralı [AJAN] E6 metni kaynaklı; 23.10 kararıyla değişti → kâhin AYRI ELDEN güncellenmeli (CI kahin-ebelge-senaryo
  o zamana kadar kırmızı).
