# DestekOfis 2.4.7 — Teslim Notu

Yayın açma bağlantısı (etiket v2.4.7, hedef master):
https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.7&target=master&title=DestekOfis%202.4.7

## GitHub yayınına yüklenecek 5 dosya

| Dosya | Boyut | SHA-256 |
|---|---|---|
| destekofis-guncelleme-2.4.7.zip | 7.458.891 B | 776cc7b6cfc94fc3e23b18a6aa6feee54a834f8b9efb99b5048d1195b2401083 |
| destekofis-guncelleme.json (imzalı, anahtar destekofis-2026-1) | 1.242 B | 1c57ceed298c8a9955576a8f444cc17377927b408cbb952b2fe54ce9a48b4da2 |
| DestekOfis-Kullanim-Kilavuzu.pdf | 5.074.703 B | 36942a0d8b91428a7631852cff85cfe8335175684e93e8abf3db7008f58a9aed |
| DestekOfis-Kurulum.exe | 37.327.509 B | fdcc2946384d9b9aced825948ab0fc33952b8db66f0fa73842ac7e6cb2b11319 |
| DestekOfis-Kurulum.exe.sha256 | 89 B | 2bdff4da65aa82714b97bfbf04af14fed689493d277b2f5838af279ddd4abb1c |

Kurulum 30 MB'ı aştığı için iki parça + BIRLESTIR.bat da verilir: parca0 ve parca1'i BIRLESTIR.bat ile aynı klasöre koyup çift tıklayın;
"TAMAM: Özet eşleşti" yazarsa oluşan DestekOfis-Kurulum.exe yayına yüklenir (parçalar ve .bat yüklenmez).

## Sürüm notu (GitHub yayın metni)

**2.4.7 — Mobil Sürüm ve İyileştirmeler**
- Yeni: telefondan kullanım — Yönetim → Mobil Cihazlar'da karekodla eşleme; cari, kasa, banka, stok ve raporlar telefonda; telefondan tahsilat, ödeme ve stok girişi; ofisteki bilgisayar kapalıyken son özet; en çok 3 cihaz.
- İyileştirmeler: Ayrıntılı Cari Ekstre'de sütun seçimi ve kalem açıklaması, destek e-postası ve site adresi destekofis.net.

## DENENEN

- Son aday tam kapı (fbeb8134): tam npm test 3906/3906; ci.yml'nin bütün e2e'leri 85/85; CI dışı senaryolar 14/14; kâhinler (yalnız belgeli farklar: mobil yazma E02, sayaç U44/U47/U48). Ders 8, 35, 37.
- Son aday gezintisi (37 adım, telefon boyutu dahil): B1/B2 ORTA + D1–D9 düzeltildi (D7 Tahsilat Yeri boş gelir — kullanıcı kararı).
- Mobil hız ölçümü (29.10, büyük veri: 100.084 + 12.138 para satırı, 3.000 cari, programın kendi API'siyle üretildi): iki ORTA bulgu bulundu ve 2.4.7'de düzeltildi (03e0f55a, kullanıcı kararı):
  - Telefonun Kasa yanıtı bütün kasa hareketlerini taşıyordu (13 MB) → yalnız bakiye/toplamlar (341 B); özet 3 kullanıcıda kapıcı sınırını aşıp yüklenmiyordu (413) → 1,35 MB, yükleniyor.
  - Özet hazırlanırken masaüstü istekleri ~10 sn bekliyordu → özet art arda hazırlanırken (en kötü durum) masaüstü p95 172–393 ms, en uzun 1,6 sn (özetsiz p95 4–246 ms).
  - Kalıcı test test/mobil-ozet-olcek-247: eski kodda 3/3 kırmızı (beklenen nedenle), yenide 3/3. Mobil/kapıcı/tünel testleri 230/230, mobil e2e 5 senaryo 238/238 adım, bağımsız mobil erişim kâhini 36/36.
- Bağımsız koşucu (03e0f55a): CI #920 7/7 (Linux + Windows × Node 22/24, Chromium e2e, Doğrulama Kapısı, paket); gerçek Windows kurulum denemesi windows.yml #62 ve #63 ikisi de yeşil (ders 18); Uzun Doğrulama #840 (mutabakat 5.000 × 10 tohum + Windows, tek sıralı 10.000, güvenilirlik 10.000 × 5 × 2 taban + Windows, kâhinler) — sonucu PR birleşmeden önce okundu (aşağıda).
- Kapıcı canlıda yeni kodla (5eaae21d); m. ve kapi.destekofis.net bu ortamdan doğrulandı.
- Paket: imza programın kendi doğrulayıcısıyla ok; tahrif ve imza bozulması reddedildi; eski sürümlerin GERÇEK güncelleyicisi (2.4.6, 2.4.5) iki yolda da "available 2.4.7" (paket indirildi + özet doğrulandı); BIRLESTIR.bat Wine'da sağlam/bozuk parça ile sınandı.

## DENENMEYEN

- Gerçek telefon + gerçek Cloudflare tüneli uçtan uca (bu kapsayıcıdan yapılamaz) → aşağıdaki elle kabul listesi, sizin 2.4.7 kurulumunuzda.
- Windows masaüstünde fareyle gerçek kullanıcı gezintisi (Windows'ta sessiz kurulum/servis/güncelleme/kaldırma windows.yml'de koştu).
- 03e0f55a düzeltmesinden sonra CI dışı 14 senaryo yeniden koşulmadı (son koşu fbeb8134'te 14/14; düzeltme yalnız mobil Kasa yanıtı ve özet üreticisinin sıralaması — mobil e2e'lerin hepsi ve CI'nin bütün e2e'leri yeniden koştu).
- Ölçek koşusu (10/20 eşzamanlı kullanıcı, yedekleme sırasında yük) — 2.5.0'da (2.4.4 kararı). Mobil ölçümde tünel ağ gecikmesi yok (yerel kapıcı).

## BİLİNEN SINIRLAR

- Büyük ofiste telefonda Kasa'yı açmak sunucuda ~1 sn sürer (bakiye için kasa raporu hesaplanır) + tünel gecikmesi.
- Özetin hazırlanması 3 eşli kullanıcıda ~10 sn sürer (en çok 15 dk'da bir, arka planda; masaüstü yukarıdaki sürelerle çalışır).
- Ücretli lisans bitince mobil HEMEN kapanır (30 gün hoşgörü sonraki sürümde — kullanıcı kararı).
- Lisans elle denetlendikten sonraki ≤ 30 sn içinde açılan telefon "ofis kapalı" görebilir (D9).
- ~12 milyon TL üstü tutarlarda 1366 px ekranda Ayrıntılı Cari Ekstre kutu içinde kaydırılır (D1).
- Kapıcının günlük 50 yeni ofis tavanı bütün kurulumlar için ortaktır; dolarsa o günün yeni kurulumlarının mobili ertesi güne kalır (veri/para etkisi yok).
- Kapıcı: devralmadan sonra son özet bir sonraki veri değişikliğine dek boş olabilir; dönen ofisin tüneli temizlikle çakışırsa 3 denemede kendiliğinden yeniden açılır (sonraki sürüm).
- Çek Excel içe aktarması ve diğer içe aktarmalar istek kimliği almıyor: zaman aşımından sonra yeniden yükleme no'suz satırları ikinci kez açabilir (sonraki sürüm).
- Test altyapısı: mutabakat testleri her yıl 1 Ocak–30 Nisan arası yanlış kırmızı verebilir (motor modeli yıl bilmiyor; ürün doğru) — devir sürümünden önce düzeltilecek.

## BAŞ MİMAR KARARLARI (ders 40)
docs/2.4.7-IS-LISTESI.md "BAŞ MİMAR KARARLARI" bölümleri (kapıcı B1–B5 düzeltme yönü, A ajanının sapmaları, motor yıl kuralı — FATURA-QA N5'ten).

## ELLE KABUL LİSTESİ (yayından önce sizin Windows kurulumunuzda, ~15 dk)

1. 2.4.7 kurulumunu (ya da güncellemesini) yapın → program açılır, sürüm 2.4.7, verileriniz yerinde (Cari Listesi bakiyesi önceki gibi).
2. Yönetim → Mobil Cihazlar → kullanıcıya "Uzaktan Bağlanabilir" verin → Karekod Oluştur → telefonun kamerasıyla okutun → telefonda giriş ekranı açılır; giriş yapın.
3. Telefonda Genel Bakış: Nakit Kasa ve Banka bakiyesi masaüstündeki Kasa / Banka bakiyesiyle aynı.
4. Telefonda bir cariyi açın → bakiye masaüstündeki cari kartıyla aynı; "Son Hareketler" masaüstü ekstresiyle aynı satırlar.
5. Telefondan o cariye küçük bir Tahsilat Gir (ör. 1 TL, Nakit) → masaüstünde Kasa +1 TL, carinin bakiyesi −1 TL; sonra masaüstünden silin.
6. Masaüstünde programı kapatın (ya da bilgisayarı kapatın) → 1–2 dk sonra telefonda sayfayı yenileyin → "son özet" görünür (bakiyeler, üstte son güncelleme saati); tahsilat düğmesi çalışmaz.
7. Programı yeniden açın → telefon birkaç saniye içinde canlıya döner.
8. Yönetim → Mobil Cihazlar → telefonu silin → telefonda oturum düşer; yeniden kullanmak için yeni karekodla eşleme gerekir (cihaz sayısı 1 azalır).
Bir adım beklenenden farklıysa yayını açmadan bana yazın.
