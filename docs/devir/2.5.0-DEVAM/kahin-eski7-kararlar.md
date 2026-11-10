# Cari kâhini bakımı 7 — GİRDİLER (ana oturumun yazdığı özet dosya; ders 5 koruması)

Bu dosya kâhine yalnız iki girdi verir. Programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez; içerdiği iki madde programın ADIM KABUL kurallarıdır (hangi girişi kabul eder / reddeder) ve kullanıcının / baş mimarın kararıdır.

## G1 — Fatura adımlarının sırası (mevcut ürün kuralı; 2.4.x'ten beri)
Program aynı fatura serisinde belgeleri TARİH SIRASIYLA kabul eder: seride son kaydedilen belgeden DAHA ESKİ tarihli yeni belge reddedilir ("numara ve tarih sırası uyuşmalı"). Bir senaryoda bütün fatura (ve seriden numara alan iade) adımları, hangi cariye ait olursa olsun, tarih sırasıyla (eşit ya da artan) girilmelidir. Bakım 6'nın S99 senaryoları (d27, d28, d29) faturaları cari cari giriyor (ör. bir carinin 10.05 tarihli faturasından sonra başka carinin 02.05 tarihli faturası) → program o adımları reddediyor. Bu bir SENARYO düzeni sorunudur; kâhinin kuralı ve beklenen değerleri bununla DEĞİŞMEZ.

## G2 — "Carinin Mevcut Borcunu Taksitlendir" kartı ve S101 (BAŞ MİMAR KARARI 10.11.2026; kullanıcıya gösterildi)
KARAR (iş listesi D, 10.11 — AYNEN özü): müşterinin borcu avansla kapanmışken ELLE "Carinin Mevcut Borcunu Taksitlendir" kartı açılamaz — bu yol bugünkü gibi REDDEDİLİR (mevcut kural: kart tutarı carinin taksitlendirilebilecek borcundan büyük olamaz; taksitlendirilecek borç yoksa kart açılmaz). S101 = A yalnız kartın SATIŞLA BİRLİKTE açıldığı yolda oluşur: stoktan veresiye satış yapılırken aynı işlemde taksitlendirme (kullanıcının S101 örneği de budur: "stoktan 600 veresiye satış + 2 taksit"). Gerekçe: borcu kalmamış müşteriye elle 'Bitti' kart açtırmak kullanıcıyı yanıltır.
Sonuç: bakım 6'nın S101 senaryoları (d30, d31, d32) kartı ayrı bir "mevcut borç kartı aç" adımıyla açıyor → program o adımı reddediyor, sonraki kart tahsilatı adımları da karşılıksız kalıyor.

## S101 karar metni (iş listesi D, 10.11 — AYNEN)
S101 = A — müşterinin borcu AVANSLA zaten kapanmışken o satış için taksit kartı açılırsa tek kuyruk ilkesi aynen uygulanır: avans satışı kapatmıştır, kart 'Bitti' görünür; kartın tahsilatı müşterinin avansına eklenir; sonraki borç avanstan kapanır. Örnek: 1.000 avans → 600 veresiye satış 2 taksit (300 + 300) → Taksit Tahsilatı 300 → Borç Yaz 500 ⇒ takvim / zil boş, gecikmiş 0, müşteri 200 alacaklı; kalemler toplamı = bakiye.
