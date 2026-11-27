# Ç7b TUR 2b — ajan raporu (AYNEN; ajan afeb75f1549249305)

## Ç7b TUR 2b — ARA RAPOR (YARIM)

Bağlamım daraldığı için durdum ("SIRA ve ARA RAPOR"). Çalışan arka plan işim yok. PUSH yapmadım.

- **Dal:** worktree-agent-afeb75f1549249305. Taban c7b2b-taban = b88d4402; reset sonrası `git log` ile doğruladım.
- **Commit'ler:** 58a50330 (iş A), 29706d98 (B-7), b66f1ae8 (kanıt).
- **Ortam:** yük 1,9 / 4 çekirdek, boş bellek 8 GB, boş disk 9,0 GB.
- **Ölçüm kilidi** (olcum.lock) baştan sona ana oturumdaydı. Yük koşusu başlatmadım. Komşuları kilit doluyken izinli düzenle, sırayla ve tek tek koştum.

### Değişen gözlenebilir davranış
- **B-7 (BAŞ MİMAR KARARI 19.11 04:35):**
  - İhracat kalemi olan satış / SMM faturasının kalemleri kilit izine girdi: hesap, istisna kodu (301 / 302), net. Girdi `invoice_lines_export_lock`, `server/lib/integrity.mjs`.
  - Kilit izi tanımının sürümü `LOCK_SQL_VERSION` 2.5.0 → 2.5.1 oldu. Bu tanımın sürümüdür, program sürümü değildir.
  - Önceki tanımla kaydedilmiş koşunun izi kendi sürümüyle karşılaştırılıyor, yani var olan kilitlerde yanlış alarm çıkmıyor.
  - Yeni test `test/c7b-kilit-izi-250.test.mjs`, v2.4.9'un gerçek koduyla:
    - Güncellemede kilit izi ve Donmuş Defter alarmı yok.
    - Kural farkı yalnız KG-24'ten geliyor: elle 600 +2.000 / 601 −2.000.
    - Dört kapı dışı bozulmanın her biri güncel izi değiştiriyor, 2.5.0 izini değiştirmiyor.
    - Kırmızı kanıt (tur 2 kodu): "istisna kodu: güncel kilit izi değişmeli". c7b2-taban'da tutar farkı yok (KG-24 yok).
    - Yeşil: UTC 1/1, Europe/Istanbul 1/1.
  - Süzgeç `integrity-scope` LOCK_FIELDS'e dokunmadım (yasak).
- Ürün kodunda başka değişiklik yok. Geri kalan iş test beklentileri ve test aracıdır.

### İş A — kırık komşular (22 dosya + tur 2'nin 3 testi + yeni test)
Son durum, uç 29706d98, Europe/Istanbul:
- **Yeşil (21 dosya):** acilis-519, altin, gg2-fis, goc-zinciri, hiz-esdegerlik, pos-kabul, senet-121, tahsile-ver-tur2, defter-kaynak-iz, donmus-defter-250, hesap-plani-sinif, kapi-para, kasa-acilis-once, kural-farki-duzeltme 8/8, kural-farki-yil 10/10, c7b-kilit-izi, c7b-kitap-turetme 7/7, c7b-kdv-s4 4/4, c7b-kart-kapat-onay 2/2.
- UTC'de de aynı dosyalar yeşil; tur 2'nin üç testi UTC'de koşulmadı.
- **Kırmızı (KALAN):**
  - gg-cari: 1 kırık (B-9).
  - gg2-hiz: 1 kırık (B-10).
  - donmus-defter-bellek: 1 kırık.
  - donmus-defter-tur1: 8 kırık.
  - donmus-defter-tur3: 3 kırık.
  - donmus-defter-tur4: 11 kırık.
  - donmus-defter-yasam: 2 kırık.
- Son beşin nedeni aynı: Ç3 mekanik testleri, tohumdaki Kasa girişleri ve Borç Yaz yüzünden "2.4.9 = güncel" varsayıyor.
  - Önerim: `test/fixtures/c7b-kural.mjs` `c7bOf` çevirisini donmuş tarafa yalnız 2.4.9 kurallı satırlarda uygulamak.
  - Tur 1 / tur 3'teki 649 → 642 benzetiminde alt hesap artık düşüyor.

Değişen beklentiler (her biri testte "BEKLENTİ BİLEREK DEĞİŞTİ" ve karar numarasıyla):
- **Yeni ortak çeviri `test/fixtures/c7b-kural.mjs`:**
  - 2.4.9 maddesini Ç7b'ye çeviriyor: K-01 / K-02, C-01 / C-02, KG-2, KG-3, KG-8, F-08.
  - `c7bCorrectionLines` fişin Ç7b payını hesaplıyor: aynı yıl aynı hesap; önceki yıl 671 / 681 (M7); alt defter maddesi fiş dışı (B14 (a)).
- **`test/guvenilirlik/defter-olgulari.mjs`:**
  - Alt defter denetimleri (336 / 191 / 391) bütün canlı türetmeyi okuyor.
  - Bu yüzden `deltaAll` eklendi; mutabakat denetimi, rapor ve Mutabakat Testi katlaması bunu kullanıyor.
  - Taban kopyası 336'yı 602'ye geri çeviriyor.
- **`test/mutabakat/motor.mjs`:** Hesap Planı Mizanı'nın 336'sı da KG-3'le hesaplanıyor.
- **senet-121 (KG-2):** kural farkı 3 madde, 101.100 TL. Elle: (1e7 + 1e7 + 90.000 + 110.000 + 20.000) / 2 kuruş.
- **tahsile-ver-tur2:** 600 −4.700.
- **kapi-para ve kasa-acilis-once (KG-3):** kayıt tahsilatı 602 → 336. Tutar veri tabanından.
- **kural-farki-yil y7 / y10 (C-01):** reddedilen Borç Yaz artık 602.90'a gidiyor.
- **kural-farki-duzeltme:**
  - [2] beklenen Ç7b fiş payı fixture'dan.
  - [4] kalan: aynı yılda B 602.90, önceki yılda B 671.
  - [7] bozulan satır artık tahsilat.
  - [8] elle: Borç Yaz 1.000 TL, 602 → 602.90; kural farkı sayısı 2 → 3.
  - Değişmez denetimi 336 / 191 / 391'i dışarıda bırakıyor (B-8).
- **hesap-plani-sinif:** 301 / 302 istisna kodudur, hesap kodu değildir.
- **defter-kaynak-iz:** tohuma karma ihracat satışı eklendi.

### BAŞ MİMAR KARARI GEREKİYOR (tasarım notu §12.3)
- **B-8 — kural farkı fişle kapanmıyor:**
  - KG-3 (602 → 336.90) ve KG-8 / F-08 (391 ↔ 191) kilitli eski veride alt defter farkı üretiyor.
  - Bunlar fişin dışında kalıyor (B14 (a)). Kural Değişikliği Farkı uyarısı hiç "Düzeltildi" olmuyor.
  - Kilitli döneminde kayıt tahsilatı ya da mahsupsuz ayda iade faturası olan her eski kurulumda uyarı kalıcı kalır.
  - v2.0.26 verisinde ortaya çıktı.
  - Fişten sonra ayrışma da var. Karma defterde 336 −750; Defter Mutabakatı'nda −1.500.
  - Seçenekler:
    - (A) Üç kuralın yeni yönü yalnız açık dönemden başlasın. Bu B-6'nın genellemesi; göç 51 kural geçiş gününü işaretler. Önerim A.
    - (B) Uyarı kalsın, BİLİNEN SINIR olarak.
  - B-6 da bu kararla birlikte tasarlanmalı. Bu yüzden B-6'yı kodlamadım.
- **B-9 — süzgeç fatura KDV'sini eski yönle hesaplıyor:**
  - `lib/integrity-scope.mjs` (dosya sınırı dışında) 191 / 391'i Ç7b öncesi yönle hesaplıyor.
  - Sonuç: iade faturası yazımında süzgeç bulgu veriyor, tam kapı kabul ediyor.
  - Üretimde bu bir hız sorunu. Testte eşdeğerlik ihlali: gg-cari kırmızı (`bulgu: 1`), tabanda yeşil.
  - Öneri: integrity-scope.mjs'e yalnız 191 / 391 formülü ve KG-3'ün 336'sı için izin. B-6 da süzgeçte aynı ay kuralını ister.
- **B-10 — Alt Hesap Mizanı yeni alt hesapları göstermiyor:**
  - Banka modülündeki hızlı yol (`lib/bank/**`) Ç7b'nin banka dışı .90 alt hesaplarını göstermiyor (336.90, 600.90, 602.90 …). Ana Defter subTrial gösteriyor; gg2-hiz bu yüzden kırmızı.
  - Seçenekler: (A) hızlı yol bunları da listelesin (lib/bank izni, Ç6-EKRAN ile); (B) rapor yalnız banka / evrak alt hesaplarını göstersin, test süzsün.
- **Not (MA için):** kilitli önceki yıldaki salt sınıflama farkları M7 ile 671 / 681 brüt çifti olarak fişe giriyor. Net 0; v2.0.26 verisinde 155.990,50 TL.

### Yapılmadı / KOŞULMADI / ÖLÇÜLEMEDİ
- **YARIM:** iş A'nın beş Ç3 dosyası.
- **Yapılmadı:**
  - C (B-6, göç 51 işareti) — B-8 kararına bağlı.
  - D (KG-7: göç 51, alan, mahsup seçimi, form) ve kılavuz.
  - E: kabul A–G — "sonra" kâhin defter / cari / sürücü koşuları, kilitli v2.4.9 sınıf testi, hız (ÖLÇÜLEMEDİ: kilit hep doluydu), mutantlar, ekran senaryoları.
- KDV Özeti kararı (A) için kod değişikliği gerekmiyordu.
- Sürücü eşlemesi notu tur 2'den aynen geçerli: `__kdvIndirimAyi` → KG-7 alanı.

### Ana oturumun yeniden koşacakları
- Her dosya için: `node --test --test-concurrency=1 <dosya>`, `HUKUK_LICENSE_URL=http://127.0.0.1:9`, iki saat diliminde. Beklenen sayılar yukarıdaki listede.
- B-7 kırmızısı: tur 2 kodu (b88d4402) bir worktree kopyasında, ders 54'e göre.

### Kanıt ve not defteri
- Kanıt: `docs/kanit/2026-11-19/c7b2b-komsu-ozet.txt`, `c7b2b-kirmizi-b7-tur2kodu.txt`, `c7b2b-kirmizi-b7-c7b2taban.txt`, `c7b2b-taban-gg-cari.txt`.
- Not defteri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2b-ag
  - Koşucular: tek-tek.sh, komsu.sh.
  - Ham çıktılar: tek-*.out.
  - Düzenleme betikleri: ed-*.py.
  - Tur 2'nin kopyaları: olcum/, s15/.
- Taban kopyalarını ve worktree'yi tam yoluyla sildim. worktree'yi kendi kopyam olduğu için `--force` ile kaldırdım.
