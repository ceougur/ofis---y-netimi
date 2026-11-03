# CI kırmızıları — 03.11.2026 (ders 20: ön koşul zorla üretildi)

Taban: `87b28e3e` (claude/compassionate-galileo-f9kghg). Eski kod kopyaları `git archive <commit> | tar -x` ile ayrı klasörde (ders 23);
kopyalarda `npm ci` yok, `node_modules` ana ağacınkine bağlı. Kopyada koşan kayıtlarda `commit undefined` yazar (kopya git deposu değil):
kaydın adındaki commit geçerlidir. Bütün koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9`; Linux, Node v22.22.0.

## KIRMIZI 1 — CI #959 (0ecc90de) Windows Node 22, T35r "ön koşul: toparlama Sonucu Belirsiz yazdı (geldi accepted)"
- KÖK NEDEN (TEST): sahte Meta ileti yanıtını sabit 2.500 ms geciktiriyordu; "istek Meta'dayken yedek + geri yükleme" ön koşulu ancak yedek + geri
  yükleme + ara okuma 2,5 sn'den kısa sürerse kuruluyordu. Yavaş Windows koşucusunda daha uzun sürünce Meta yanıtı geri yüklenen şirket yeniden
  açılmadan geldi, defter (A7) kabulü öğrendi, toparlama satırı defterden "accepted" yazdı. Ürün davranışı DOĞRU (Meta'nın kabul ettiği ileti
  "Meta Kabul Etti"); yalnız testin ön koşulu kurulmadı. Doğal Linux koşusunda (olc) ileti isteği → geri yükleme bitti ≈ 200 ms.
- ZORLA: `node test/whatsapp-t35r-yaris-zorla.mjs <deneme> yavas <ms>` (ön yükleme `test/fixtures/t35r-yaris-zorla.mjs`: geri yüklemenin dosya
  kopyası olay döngüsünü kilitleyerek <ms> uzar). Ön koşul: ileti isteği → geri yükleme bitti > 2.500 ms.
- KIRMIZI (eski test, 87b28e3e kopyası): `t35r-eski-87b28e3e-yavas-UTC` 0/3 yeşil, 3/3 ön koşul OLUŞTU (≈3.660 ms), hepsinde CI'deki ileti
  "geldi accepted", Meta yanıtı ara okumadan ÖNCE.
- DÜZELTME: sahte Graph'a `state.hold { match, promise }` (yanıt kapıda tutulur); T35r yanıtı geri yükleme + ara okuma bitene dek kapıda tutar,
  `held` ile ön koşulu sınar, program zaman aşımı 60 sn (kapıdan uzun; 8 sn'lik eski değer 9 sn'lik zorlamada aşılırdı).
- YEŞİL (yeni): `t35r-yeni-yavas-UTC` 5/5 (≈3.650 ms, ön koşul 5/5), `t35r-yeni-yavas-Istanbul` 3/3 (+9.000 ms → ≈9.140 ms, ön koşul 3/3).
  Zorlamasız (yalnız ölçüm, `olc`): `t35r-yeni-dogal-olc-UTC` 5/5, `t35r-yeni-dogal-olc-Istanbul` 5/5 (ileti isteği → geri yükleme ≈ 110–270 ms).
  Dosyanın tamamı: `karar-tablosu-248-UTC` 94/94, `karar-tablosu-248-Istanbul` 94/94. Sahte Graph'ı kullanan 17 test dosyası (komşu, ders 10):
  `komsu-sahte-graph-kullananlar-UTC` 110/110; `komsu-whatsapp-s1-248-UTC` 10/10.
- Kanıt kayıtları "BELİRSİZ (özet satırı tanınmadı)" der: zorla betiği node:test özeti basmaz; sonuç betiğin kendi satırlarında ve çıkış kodunda.

## KIRMIZI 2 — CI #963 (521be1b9) e2e senaryo-mobil-yazma-247 Y9 "✗ personel tahsilatı kaydedildi"
- KÖK NEDEN (TEST): `toastText` `waitForSelector(".toast")` ile bekliyor; Y9'da eşlemenin "Cihaz eşlendi…" bildirimi (5 sn yaşar) personel
  Kaydet'e bastığında hâlâ ekranda (doğal koşuda eşleme bildirimi → Kaydet ≈ 2,6 sn). Bekleme hemen döner; sunucu yanıtı o okumadan sonra gelirse
  "Tahsilat kaydedildi" henüz yoktur → ✗; kayıt yazılmıştır → hemen ardından "✓ kaydı giren personel (true)". Y2'de de aynı gizli yarış vardı
  (doğal koşuda bildirim "Cihaz eşlendi… | Tahsilat kaydedildi…"). Ürün gerilemesi DEĞİL: zorlama 0ecc90de, 521be1b9 ve 87b28e3e'de aynı kırmızıyı verir.
- ZORLA: `HOF_BILDIRIM_ZORLA=yavas HOF_BILDIRIM_ZORLA_BAGLAM=2 node --import ./test/e2e/bildirim-yaris-zorla.mjs test/e2e/senaryo-mobil-yazma-247.mjs`
  (yalnız Y9 bağlamında kayıt yazan POST /api/mobil/… yanıtı 1.200 ms gecikir — yüklü CI). Ön koşul: eşleme bildirimi → personel Kaydet < 5.000 ms.
- DÜZELTME: senaryonun `submit` yardımcısı Kaydet'ten önce ekrandaki eski bildirimleri kaldırır; Kaydet'ten sonra gelen her bildirim okunur.
- KIRMIZI (eski test; zorlamalı): 87b28e3e 2/2, 521be1b9 2/2, 0ecc90de 2/2 — hepsi Y9 "✗ personel tahsilatı kaydedildi" + "✓ kaydı giren personel (true)"
  (CI #963'teki iletiyle aynı), ön koşul 6/6 OLUŞTU (eşleme bildirimi → Kaydet ≈ 2,5–2,6 sn, istek anında açık bildirim 1). Zorlamasız eski: 11/11 yeşil.
- YEŞİL (yeni test): zorlamalı 3/3 (ön koşul 3/3: bildirim Kaydet'ten hemen önce temizlendi), zorlamasız 5/5 (74/74).
- Sayılar: `e2e-ozet.txt` (bu klasörde; her koşunun satırı, Y9 sonucu, ön koşul ölçümü).
- Genel denetimler (lisans-servisi-izolasyonu, platform-tasinabilirlik, yazim-duzeni, ci-kapi-listesi, whatsapp-meta-izolasyon): `genel-denetimler-UTC` 25/25,
  `genel-denetimler-Istanbul` 25/25 (son dosya değişikliğinden sonra). Zorla betiklerinin adı `*.test.mjs` DEĞİL — npm test'e girmez; ci.yml değişmedi.
- ÜRÜN KODU DEĞİŞMEDİ. DENENMEYEN: gerçek Windows koşucusu (ders 18: T35r düzeltmesi CI'nin Windows işlerinde iki yeşil görülmeden "düzeldi" yazılmaz);
  öbür e2e dosyalarındaki aynı `waitForSelector(".toast")` kalıbı bu işte taranmadı.
