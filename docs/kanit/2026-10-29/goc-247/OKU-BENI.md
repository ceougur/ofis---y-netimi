# 2.4.7 adayı — eski sürüm verisiyle göç (v2.4.6 → aday; zincir v2.3.0 → v2.4.4 → v2.4.6 → aday)

Aday: çalışma ağacı d5e70c3 (göç v37 e-Belge sayacı izi, v38 mobil cihaz tabloları — ortak katman, v39 mobile_devices.enc_key; şema 36 → 39).
Eski kod: git etiketleri v2.4.6 (= master d31b486), v2.4.4, v2.3.0 — `test/guvenilirlik/surumler.mjs` ile `git archive` kopyasında (TMPDIR = not defterinde
benzersiz `goc247-20261029T1215/tmp`; ders 23, 25). Eski sürümlerin çalışma zamanı bağımlılığı yok (node:sqlite) → `npm ci` gerekmedi. Veri o sürümün GERÇEK
koduyla, kendi API'sinden (`test/guvenilirlik/m30-uretici.mjs`); sahte EDM, sahte saat (ders 13), `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30). Ürün kodu
DEĞİŞMEDİ; araç not defterinde (2.4.6 tam kapı aracının düzeni), kopyası `araclar/goc247.mjs.txt` (+ `tani-gonder.mjs.txt`, `ozet-tablo.py.txt`, `kos.sh.txt`).

## Nasıl bozulur? (koşudan önce)
1. v37/v38/v39 eski tabloya / satıra dokunur → bakiye, mizan, Kasa, fatura açığı, taksit, çek, stok kayar; ya da eski tablo düşer.
2. v37 sayaç eski e-Belge gönderimlerini geriye dönük sayar (karar: doldurma YOK) ya da göçten sonraki gönderimi saymaz.
3. v38 cihaz/izin satırı yaratır; mobil tablolar 002'nin dosyasında dolar (ortak katman yalnız 001).
4. Göçmüş veride eşleme / uzak giriş / 3 cihaz sınırı çalışmaz; telefonun gördüğü masaüstünden farklı.
5. Ayrıntılı Cari Ekstre'nin 2.4.7 değişikliği (5, 6a, 6b) rakamları kaydırır; sütun seçimi kişi başına değil ya da yeniden açılışta unutulur.
6. Eski sürümün yedeği adayda geri yüklenince göç koşmaz / sayılar eski sürümün gösterdiğinden farklı; 001'in eski yedeği eşli cihazı siler (COMMON_TABLES).
7. Adayın yedeği → çalış → geri yükle: sayılar yedek anına dönmez; telefon oturumu düşer.
8. Geri dönüş: göçten sonra v2.4.6 açınca bozulur ya da şemayı geri alır.
9. Zincir: adım adım güncellenen ≠ doğrudan güncellenen.

## Veri
- **v2.4.6** (büyük, tohum 7; `uret-v246-buyuk`): 6.194 API isteği (6.195/6.195 denetim; 409 yalnız beklenen silme/geri yükleme reddi), EDM gönderim 495, iptal 11,
  ihlal 0, 181 sn; 29.09.2025 → 29.10.2026 (13 ay); 2 şirket. 001: 3.210 cari, 1.199 fatura, 423 çek/senet, 228 taksit kartı, 40 stok; 002: 926 cari, 631 fatura,
  174 çek/senet, 92 kart, 40 stok; tablo 12.020 satır; e-Arşiv 434, e-Fatura 113, bırakılan 79, kâğıt SMM 257, alış 395, kayıt tahsilatı + Tablodan Aktar 142 kart
  (2.4.4'ten göçen müşteri gibi, eski sürümün test anahtarlarıyla), 10 yedek (v2.4.6'nın Yedekle ucu), kullanıcılar ayse / mehmet / zeynep (özel yetkili).
  Sonra v2.4.6'nın kendi ucuyla elle Borç satırlarına Vade (+ Beklenen) (`vade-v246`): 112 PUT 200, 383 kilitli dönem reddi (409 period-locked, beklenen, sayıldı).
- **v2.3.0** (küçük, tohum 11; `uret-v230-kucuk`): 2.660/2.660, 44 sn, 2 şirket (420 Excel + 146 elle cari, 940 tablo satırı, 438 kâğıt fatura, 10 yedek; e-Belge yok —
  2.3.0'da yoktu).

## Göç ve önce / sonra
- `goc-v246-aday` 16/16: iki şirket şema 36 → 39, bütünlük ok, şirket başına `…-pre-migration-v39.sqlite`; yeni tablolar YALNIZ edoc_usage, edoc_usage_meta,
  mobile_access/codes/devices/sessions; eski tablo düşmedi, ESKİ TABLOLARIN SATIR SAYILARI AYNI (iki şirkette fark 0); mobil tabloları boş; edoc_usage boş;
  mobile_devices.enc_key var. 001 açılışı (göç dahil) 837 ms, 002 ilk erişim 248 ms.
- `fark-v246-aday` (m30-fark sınıflayıcısı, profil 244-245): 92 olgu — EŞİT 82, BELGELİ 4, "BULGU" 6. Altı satırın hepsi sınıflayıcının 2.4.5 profilinden
  (BİLİNEN SINIR — 2.4.7 profili yok; 2.4.6 tam kapıdaki gibi elle sınıflandı, veriyle):
  - "cari hareketlerinin yeni alanları K6 kuralı tutmuyor" ×2: önce = sonra BİREBİR (001 Vade 11 / Beklenen 3 / Kalan 798; 002 101 / 28 / 207; aralık dışı 0) — kural
    v2.4.4 tabanı (Vade 0) içindi; v2.4.6 verisinde Vade'yi v2.4.6 yazdı (vade adımı). Değişiklik yok.
  - "veri dosyası şema / tablolar" ×4: şema 36 → 39, yeni tablolar = v37 + v38 (yukarıda), eski tablolarda kolon/satır değişikliği 0, due_date dolu 11/101 = önce.
  - SONUÇ: BULGU 0. Cari kartları (her carinin hareketleri, defter satırları, toplamlar), mizanın her hesabı, Mutabakat Testi, Kasa, banka, çek/senet, faturaların her
    alanı ve açıkları, e-Belge kartları, sıradaki numaralar, taksit, stok, KDV mahsup, Silinenler, ANLIK DURUM, takvim, rapor merkezinin bütün raporları, yevmiye,
    kullanıcı yetkileri EŞİT.
- Temel sayılar: `cikti/once-sonra-tablo.md` (iki şirkette 15 olgu + kullanıcılar; hepsi "aynı"). Örn. 001 Σ cari bakiye 11.040.953,10 TL, Kasa bakiyesi
  4.891.859,13, banka 2.608.813,66, fatura açığı 8.869.006,26, taksit kalanı 3.361.309,20 (228 kart), portföy 31 evrak 250.717,44, stok Σ 24.990; 002 Σ bakiye
  5.372.506,74, fatura açığı 5.279.280,68 — önce = sonra.

## Zincir (`zincir-v230-v244-v246-aday-2` 6/6)
v2.3.0 verisi (şema 26) → v2.4.4 kendi koduyla (32) → v2.4.6 kendi koduyla (36) → aday (39); aynı veri doğrudan v2.3.0 → aday. v2.4.6 ↔ aday: 92 olgu, EŞİT 82, BELGELİ
6, "BULGU" 4 (yalnız şema/yeni tablo satırları, yukarıdaki gibi; satır sayısı farkı 0). Yol bağımsızlığı: adım adım = doğrudan (iki şirkette fark yok), şema 39 + bütünlük
ok ×2; veri dosyalarında tablolar aynı, satır sayısı farkı yalnız sessions/audit_events (001: adım adım yolda iki ara sürüm açılışının girişi, 4/2 ve 1326/1324).
İLK KOŞU `zincir-v230-v244-v246-aday` 5/6 KIRMIZI = ARAÇ HATASI: denetimin izin listesinde tablo adı yanlıştı ("audit_log"; doğrusu audit_events); düzeltilip -2 koşuldu,
kayıt silinmedi.

## Yedek (`yedek-v246-aday-2` 14/14; `tatbikat-245-aday` 19/19)
- v2.4.6'nın aldığı son yedekler (001 ve 002) v2.4.6'da ve adayda (göçmüş kopyada) Geri Yükle ile açıldı: adayda şema 39 (yedek 36), bütünlük ok; iki sürümün gösterdiği
  (cari, mizan, Kasa, banka, çek, fatura, taksit, stok, raporlar — stableDiff) AYNI (0 bölüm, iki şirket).
- Adayda eşlenmiş telefon (karekod → eşle → uzak giriş) 001'in ESKİ yedeği geri yüklenip program yeniden açıldıktan sonra da eşli (1 cihaz) ve oturumu 200 — ortak katman
  geri yüklemede canlı hâl (COMMON_TABLES).
- Adayda yedek → ara çalışma (Kasa 1.234,56 + yeni cari; değişen bölümler görüldü) → geri yükle → olgular yedek anıyla aynı (0 bölüm) → yeniden çalışma 200, Mutabakat Testi
  sapma 0 (iki şirket); telefon oturumu sürüyor.
- `tatbikat-245-aday` (tools/m30-goc.mjs, 2.4.5 tatbikatı adayda): vadeli borç / Beklenen / kısmi tahsilat / Tabela Adı → yedek → çalış → geri yükle → yeniden çalış →
  Silinenler — 19/19.
- İLK KOŞU `yedek-v246-aday` KIRMIZI (özet yok, ECONNREFUSED) = ARAÇ HATASI: 001 geri yüklemesinden sonra program yeniden açılınca uzaktan erişim dinleyicisi yeni portta
  açılır; araç telefonu eski porta yönlendiriyordu. Araç telefonu yeni porta yönlendirecek şekilde düzeltildi (gerçekte tünel yeniden bağlanır), -2 koşuldu.

## Yeni özellikler eski veride (`yeni-ozellikler-2` 13/13; `ekstre-v246-aday` 9/9; `maliyet-sablon-v246`)
- EDM sayacı: göçmüş veride iki şirkette pencere 0, iz 0, eşitlenen 0 (eski veride 1.199 + 631 e-Belge kartı) — geriye dönük doldurma yok. Göçten sonra yeni e-Arşiv +
  Gönderilecekler'deki 5 eski belge Tümünü Gönder → EDM'nin kabul ettiği 6 = sayaç 2026-10 test 6 (e-Arşiv 5, e-Fatura 1); önceki aylar 0, canlı 0 (gönderim ayı kuralı S1).
  İLK KOŞU `yeni-ozellikler` 11/13 KIRMIZI: (1) "Kes ve Gönder" belgesi Gönderilecek'te kaldı → yeniden üretildi (`tani-gonder-v2.4.6`, `tani-gonder-aday`): v2.4.6'da da
  AYNI (5 eski bekleyen; GİB sıra kuralı yeni belgeyi bekletir) → ürün farkı değil, aracın varsayımı yanlıştı; araç kullanıcının yolunu (Tümünü Gönder) izleyecek şekilde
  düzeltildi. (2) oturum denetimi şirket kimliğini "sirket-002" sanıyordu (002'nin kimliği UUID'li) → araç hatası.
- Mobil: göçmüş veride eşli cihaz 0 / sınır 3; admin için Uzaktan Bağlanabilir + karekod + eşleme + uzak giriş 200; telefondan oturum iki şirketi görür; telefondaki Kasa ve
  cari kartı = masaüstü (iki şirket); 2. ve 3. cihaz 200, 4. karekod 409 (program başına 3); cihazlar 001'in dosyasında 3, 002'de 0.
- Ayrıntılı Cari Ekstre (items=1), aynı veri v2.4.6 ↔ aday, en çok faturalı 80 cari, 3.048 satır: satır sayısı, rakam kolonları (Miktar … Bakiye), TOPLAM ve özet BİREBİR;
  metin farkları yalnız müşteri isteği (5): İşlem "Satış Faturası" → "Satış" (389), "Alış Faturası" → "Alış" (395), iade türleri (14); Açıklama'da aynı kısaltma; alt
  başlıktan "Fatura kalemleriyle · B: borçlu · A: alacaklı" kalktı (80) — beklenmeyen 0 (`cikti/ekstre.json`). Sütun seçimi: göçmüş veride ilk açılışta gizli yok;
  ["Yol", "İsk. %"] kaydedildi, ekranda yok ve kalan rakamlar aynı; PDF ve Excel 200; mehmet kendi seçimini (boş) görür; program yeniden açılınca hatırlanır.
- Maliyet Hesap Kartı şablonu (`test/maliyet-sablon-247-eski-surum.mjs`, v2.4.6 gerçek kodu): 19 denetim geçti, çıkış 0 — kaydedilmiş kartlar AYNEN, kaydedilmemişlerde oran
  boş; v2.4.6'ya dönüş. kanit.mjs özet satırını tanımadığı için BELİRSİZ yazar (2.4.6'daki gibi; ham günlük `maliyet-sablon-v246.log`).

## Geri dönüş (`donus-aday-v246-aday` 6/6)
Göçmüş veriyi v2.4.6 açar: gösterdiği = göçten önce gösterdiği (iki şirket, fark yok), şema 39 kalır, mobil tablolar durur; sonra aday yeniden = göç ölçüsü.

## Yeniden koşma (sıra; R = aday, S = not defteri klasörü)
`araclar/kos.sh.txt` (TMPDIR=S/tmp, kanit.mjs kos): `uret --hacim buyuk --tohum 7` → `vade` → `olcu` → `goc` → `fark` → `ekstre` → `yeni` → `yedek` → `donus`;
`uret --surum v2.3.0 --hedef zb-taban --hacim kucuk --tohum 11` → `zincir --ad zb --kaynak zb-taban --yol v2.4.4,v2.4.6`;
`node tools/m30-goc.mjs tatbikat-245 --kok S/kok`; `node test/maliyet-sablon-247-eski-surum.mjs`. Ölçümler sabit sahte saatte (üretimin son günü 17:00).
Ham olgular (2 × 32 MB + zincir 3 × 6,6 MB) ve veri kopyaları not defterinde; depoda denetim / fark / ekstre / yedek çıktıları (`cikti/`).

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- DENENEN: ders 2 (kanit kos, çıkış + sayı; BELİRSİZ ve KIRMIZI kayıtlar silinmedi), 3 (her yanıt okundu; kilitli dönem reddi sayıldı), 4, 5 (beklenen = eski sürümün
  kendi gösterdiği; v2.4.6'nın kendi geri yüklediği yedek), 6 (iki uyuşmazlık yeniden üretildi, eski sürümün gerçek koduyla karşılaştırıldı, kök neden yazıldı —
  ikisi de araç), 10 (Ayrıntılı Cari Ekstre'nin komşu kolonları/özeti, mobil okuma = masaüstü), 13/22 (sabit sahte saat, aynı gün), 17 (eski sürümlerin gerçek
  verisi, yedek, geri dönüş, zincir), 23/25 (eski kod ayrı kopya, benzersiz klasör), 24 (df: başta 7,8 GB, sonda 6,5 GB boş), 30, 36 (pkill/joker silme yok).
- DENENMEYEN: göç sırasında kesinti / disk dolu / kilitli dosya (`m30-goc kesinti` bu turda koşulmadı); arayüzden (Playwright) göçmüş veri gezintisi; kalem açıklaması
  DOLU eski fatura (üretici fatura satırına açıklama yazmıyor → "Kalem Açıklaması" kolonu iki sürümde de boş/gizli; 6b eski veride sınanmadı); mobil yazma (M5: tahsilat /
  ödeme / stok) göçmüş veride; e-SMM gönderimi göçmüş veride (sayaçta e-SMM 0); v2.4.4 ve v2.4.5 verisinden doğrudan adaya; 3+ şirketli veri; Windows.
- BİLİNEN SINIR: m30-fark sınıflayıcısında 2.4.7 profili yok — 6 (zincirde 4) satır elle sınıflandı (yukarıda, veriyle). Rol listesi ucu iki sürümde de boş döndü
  (özel rol üreticide kişiye özel yetkiyle; etkin yetkiler 4 kullanıcıda birebir). Ölçüm süreleri paylaşımlı makinede (başka ajanlar), mutlak ms ±%15.
