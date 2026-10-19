# 2.4.3 gerileme tabanı (değişiklikten ÖNCE, kod 4d546e9)

Komut: `kos-taban.sh` (liste.txt'teki 47 e2e senaryosu sırayla, `npm run -s <ad>`, HUKUK_LICENSE_URL=http://127.0.0.1:9), git archive kopyasında.
Sonuç (sonuc-ilk-kopya.tsv): 44/47 çıkış 0. Düşen 3:
- senaryo-banka-210-temel, banka-210-ekran-aciklama: v2.0.23 git etiketi gerekiyor, archive kopyasında git yok → ORTAM. Ana depoda (aynı kod; 4d546e9..HEAD
  arasında server/client/test farkı yok) yeniden: 80/80 ve 11/11 GEÇTİ.
- senaryo-banka-210-eski-satir: adım 2 "Banka Hesabı seçicisi:" BOŞ liste (24/25). Ana depoda yeniden 25/25 GEÇTİ. Git'e bağlı değil → ARA SIRA KIRMIZI
  (ders 20): test seçenekleri tutar alanı görünür görünmez okuyor; seçici yüklenmeden okunmuş olabilir (yükte: aynı anda iki ajan çalışıyordu).
  Ürün mü test mi zorla üretilerek ayrılacak (iş listesi T1, banka/rapor paketi).
Hüküm: taban 47/47 yeşil (biri ara sıra kırmızı, araştırılıyor).
