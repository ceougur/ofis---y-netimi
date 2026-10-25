# 2.4.6 TAM KAPI (son aday) — aday246-3 46db18c, yerel koşu 25.10.2026 15:59–18:45 UTC

Ortam: linux x64, 4 çekirdek, 16 GB, Node v22.22.0; disk başta 13 GB boş (ders 24); her koşu `tools/kanit.mjs kos` ile, ölçüm/e2e `flock …/scratchpad/kos.lock`
altında tek tek (ders 15); `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30); eski kod e77447a `git archive` ile not defterinde ayrı kopya (ders 23, 25).
Ürün kodu DEĞİŞMEDİ. Depo araçları da değişmedi; bu kapıya özgü ölçüm betikleri not defterindedir, kopyaları `araclar/*.txt`.
"+1 izlenmeyen" = bu kanıt klasörünün kendisi (koşu sırasında henüz commit edilmemişti).

## 1. Tam npm test — GEÇTİ
`npm-test`: 3645/3645, 0 başarısız / iptal / atlanan, çıkış 0, 2078 sn.

## 2. ci.yml'nin BÜTÜN e2e listesi (ders 37) — 71/71 GEÇTİ
`ci-e2e-*` (ci.yml'deki `kanit.mjs kos e2e-… npm run …` satırlarının tamamı, senaryo-maliyet-246 ve senaryo-iade-246 dahil): 71 koşu, toplam 3559/3559 denetim, kırmızı 0.

## 3. CI dışı senaryolar (ders 8) — 14/14 GEÇTİ
package.json'daki, ci.yml'de olmayan bütün test:senaryo-* betikleri + ui-ux-217: senaryo-210 57/57, 211 59/59, 212 24/24, 213 64/64, 214 48/48, 215 73/73,
216 54/54, 217 65/65, 218 50/50, senaryo-rapor 87/87, senaryo-taslak 31/31, senaryo-whatsapp 45/45, senaryo (tablodan-aktar) 30/30, ui-ux-217 407/407 (toplam 1094/1094).
CI dışı başka e2e dosyaları (banka-210-*-yaris, pencere-yaris-zorla, senaryo-211-yaris-zorla, senaryo-222-yaris, senaryo-225-yaris, form-izolasyon-b4-yaris,
e2e-not-yaris, tarayici-kesme, cpu-yavaslat, esc-kapat*) senaryo değil, zorla üretme/yardımcı araçtır → koşulmadı (DENENMEYEN, adıyla).

## 4. senaryo-210 m15 (ders 20)
- 5 normal koşu: `s210-tekrar-1..5` hepsi 57/57 (+ kapıdaki 1 koşu 57/57).
- ZORLA ÜRETME (`araclar/s210-m15-zorla.mjs.txt`, sonuçlar `s210-zorla/`): Taksitler'in `/api/workspace/plans/groups` yanıtı 220–260 ms geciktirilince
  (arama kutusu Cari kapandıktan ~610 ms sonra gelir, senaryo blur + 100 ms sonra okur) aday 46db18c'de 5/8, eski kod e77447a'da 7/7 KIRMIZI; gecikmesiz 5/5 + 3/3 yeşil.
  Her kırmızıda blur'dan SONRA arama kutusuna verilen tek odak çağrısı: `guard (assets/hof-core.js:999)` — KAPANAN Cari penceresinin finish() odak bekçisinin
  700 ms vuruşu (60/250/700/1500 ms). Odak body'deyse üstteki pencerenin (o sırada yeni açılmış Taksitler) ilk alanına odak verir.
- KAYNAK: testin yarışı (blur ile okuma arasındaki 100 ms, önceki pencerenin bekledeki bekçi vuruşlarıyla çakışıyor); aynı satır eski kodda da var → 2.4.6 gerilemesi DEĞİL.
  Ürün yan notu (DÜŞÜK, düzeltilmedi): hof-core.js finish() yorumu "Bu arada başka bir pencere açıldıysa … dokunulmaz" der, kod yalnız "odak body'de mi"ye bakar;
  kullanıcı yeni açtığı pencerenin boş yerine ilk 1,5 sn içinde tıklarsa odak arama kutusuna atlar (veri etkisi yok). CI'deki tam beyaz (#fff) okuma burada birebir
  üretilemedi (geçiş ortası renk okundu), mekanizma ve kimin odak verdiği kayıtla gösterildi.

## 5. Kâhinler — hepsi GEÇTİ
kahin-defter 176/176 · kahin-cari 7408/7408 · kahin-tutar 3559/3559 · kahin-ebelge-model 114/114 · kahin-ebelge-mutasyon 55/55 · kahin-ebelge-senaryo 27/27 ·
kahin-maliyet (API) 41306/41306 · `python3 -I test/bagimsiz/maliyet/kos.py` (API + arayüz, 391 senaryo) 43758/43758, çıkış 0, BELİRSİZ yok.

## 6. Göç v2.4.5 → aday (gerçek kod, ders 17)
Veri: v2.4.5 GERÇEK kodu (etiket, ayrı kopya), kendi API'sinden, `m30-uretici` büyük hacim tohum 7, 13 ay, 2 şirket (eski kayıt tahsilatı / Tablodan Aktar verisi
2.4.5'in test anahtarlarıyla, 2.4.4'ten göçen müşteri gibi): 6.072 istek 200, EDM ihlal 0, 193 sn. 001: 3.211 cari, 002: 926 cari; tablo 12.020 satır.
Sonra v2.4.5'in kendi ucuyla elle Borç satırlarının ~yarısına Vade (+%30 Beklenen): 109 PUT 200; 386 satır kilitli dönemde 409 period-locked (beklenen ret, sayıldı;
ilk deneme bu reddi tanımadığı için düştü — araç hatası, kaydı silinip araç düzeltildi).
- `goc-goc`: iki şirket şema 33 → 36, bütünlük ok, şirket başına `pre-migration-v36` yedeği; 001 açılışı (göç dahil) 779 ms, 002 ilk erişim 248 ms. 6 maliyet_* tablosu (boş).
- `goc-fark` (sınıflayıcı 2.4.5 için yazıldı, profil 244-245): 96 olgu, EŞİT 73, BELGELİ 4, "BULGU" 19 — araç 2.4.6 kurallarını bilmediği için ÇELİŞKİ kaydı. 19 satırın
  her biri elle, 2.4.6 karar metinleriyle sınıflandı (ders 6, 40 — gerekçe veriyle):
  1. admin + maliyet.view / maliyet.manage → K1.1 YETKİ (varsayılan yalnız yönetici). Öbür kullanıcılar değişmedi.
  2. Cari kartları (001'de 1314, 002'de 474 kartın hareket özeti): `kart-fark.json` — iki sürümün kartı tek tek okundu, tek fark her harekette yeni boş `refundOf` alanı
     (4892 hareket, madde 9 v36; eski satırlar boş kalır, migrations v36 "YALNIZ EKLEYİCİ"). Toplamlar, defter satırları, Kalan (remaining) DAHİL birebir.
  3. "Yeni alanlar K6 kuralı" ×2: önce = sonra (Vade 9/100, Beklenen 2/28, Kalan 799/206, aralık dışı 0) — kural v2.4.4 tabanı içindi; değişiklik yok.
  4. Tablo Raporları cari-ekstre / vade-takip kolon "Cari" → "Kişi" ×4 → madde 7 B8 (rakamlar birebir, BELGELİ satırları).
  5. Takvim / Vade Takip carinin kalem açıklaması "Borç kaydı · …" / "Açılış bakiyesi · …" ×4 → madde 7 B6; kalem sayıları ve tutarlar birebir.
  6. Nakit Akış Projeksiyonu ×2 → madde 11 (K-P2 "her borç bir kez"): `projeksiyon-satir-farki.json` — çıkan her "Faturasız Cari Alacağı" satırı aynı kişi + aynı
     tutarla "Cari (vadeli)" kalemi olarak vadesinde geri geldi (001: 7 çıkan 36.869,88 / 6 giren 36.723,85; 002: 96 / 96, 392.766,64 = 392.766,64). Tek açık kalan
     001 Alıcı Ticaret A.Ş. 146,03 TL: vadesi 01.12.2026 (veri tabanında due_date), projeksiyon penceresinin dışında → pencerede satır yok, faturasız alacaktan da düştü
     (doğru: aynı borç iki kez sayılmaz). 001 toplam giriş +952,32 = Şükrü Öz'ün borcu (kayıt 25.08, vade 04.11.2026) gecikmişten pencereye geçti. Alacak Yaşlandırma
     raporu iki sürümde birebir (Alıcı Ticaret faturasız 146,03 aynı; rapor kayıt gününe göre yaşlandırır).
  7. Veri dosyası ×4: şema 36, yeni tablolar maliyet_* (madde 1 v34), kolonlar is_opening (madde 12 v35) + refund_of (madde 9 v36), eski tabloların satır sayıları
     aynı. is_opening = 1 satırlar 772 / 202 = "Açılış bakiyesi" açıklamalı satırlar (birebir); refund_of dolu 0.
  SONUÇ: BULGU 0 (elle sınıflama; sınıflayıcının 2.4.6 profili yok — BİLİNEN SINIR).
- `goc-tatbikat` (m30-goc tatbikat-245, aday kodu): 19/19 — yedek → çalış → geri yükle → yeniden çalış, 001/002 birbirini değiştirmiyor, Silinenler'den vadeli borç.
- `goc-donus`: aday → v2.4.5 → aday: 2.4.5 dosyayı açıyor, şema 36 kalıyor, satır sayısı aynı, cari sayısı ve Σ bakiye iki sürümde aynı (001 3211 / 11.291.153,91 TL;
  002 926 / 5.862.791,09 TL).
- `goc-ekran`: göçmüş büyük veride arayüz — giriş + ana tablo, Cari penceresi (300 satır), Taksitler (220 kart), ANLIK DURUM, sayfa hatası 0 (`goc-ekran/*.png`).
Ham olgu dosyaları (2 × ~32 MB) ve veri kopyaları not defterindeydi, kanıt alındıktan sonra silindi (ders 24).

## 7. Hız (aynı veri kopyası; v2.4.5 ve aday ayrı açılış, 3 tur sıra değişimli, ms; soğuk = açılıştan sonraki ilk istek, sıcak = 10 isteğin ortancası)
| Ölçüm | 2.4.5 soğuk | aday soğuk | 2.4.5 sıcak | aday sıcak |
|---|---|---|---|---|
| Cari kartı 001 en büyük (122 hareket) | 23 | 18 | 11,5 | 12,1 |
| Cari kartı 001 2. (70) | 16 | 14 | 7,6 | 8,1 |
| Cari kartı 001 3. (62) | 8 | 8 | 6,8 | 6,9 |
| Tahsilat Takvimi 001 | 634 | 657 | 23,6 | 23,8 |
| Vade Takip 001 | 1136 | 1275 | 74,8 | 74,1 |
| Nakit Akış Projeksiyonu 001 | 233 | 222 | 205,1 | 212,7 |
| Cari kartı 002 en büyük (33) | 10 | 10 | 6,9 | 5,1 |
| Tahsilat Takvimi 002 | 259 | 238 | 12,8 | 14,9 |
| Vade Takip 002 | 332 | 350 | 39,0 | 36,9 |
| Nakit Akış Projeksiyonu 002 | 97 | 109 | 87,4 | 86,0 |
Gerçekçi veride (en büyük cari 122 hareket) fark ölçüm gürültüsü içinde (sıcakta ±1–8 ms, soğukta ±10 %); Vade Takip 001 soğuk +139 ms (+12 %) tek fark.
Dar kontroldeki 175 → 527 ms tek carili 5.000 satır / 50 kart / sık iade yapay verisindeydi; bu veride öyle bir cari yok → uç durum olarak BİLİNEN SINIR kalır.

## 8. Kılavuz
`kilavuz-pdf-surum` 2/2. `kilavuz-pdf-denetle` 39/39 — ilk koşu "BAŞARISIZ (özet yok)": betik docs/kilavuz/…pdf'i (gitignore'da, üretim çıktısı) bekliyor; teslim
edilen client/kilavuz PDF'i oraya kopyalanıp yeniden koşuldu (aynı ad, kaydın üstüne yazıldı), kopya sonra silindi. Ayrıca kaynak HTML'den not defterinde taze PDF
üretildi: metni teslim edilen PDF ile aynı (boşluk normalleştirilmiş pdftotext), 41 = 41 sayfa (ders 42).

## DENENMEYEN
- Windows (yerel kapı yalnız Linux; Windows CI'de — ana oturum okur, ders 1).
- Uzun koşular (mutabakat 5.000 × 10, güvenilirlik 10.000 × 5 × 2) — Uzun Doğrulama'da.
- Göç: zincirleme göç (v2.3.0 / v2.4.3 → … → aday), kesinti / disk dolu / kilitli dosya arızası; maliyet verisi DOLU iken yedek tatbikatı (madde 1 dalında 24/24 vardı);
  DB1 iade geri ödemesi bağı göçmüş gerçek veride (refund_of dolu satır yok — üretici bu deseni üretmiyor).
- CI dışı yardımcı/zorla e2e dosyaları (yukarıda adıyla).
## BİLİNEN SINIRLAR
- m30-fark sınıflayıcısında 2.4.6 profili yok; 19 satır elle sınıflandı (gerekçe yukarıda, veriyle).
- senaryo-210 m15 testin yarışı (eski kodda da); hof-core odak bekçisi yorum ↔ kod farkı (DÜŞÜK).
