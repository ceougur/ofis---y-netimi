# Eski kâhinler bakımı 13 — DEFTER kâhini — girdi (ana oturum yazdı; 12.11.2026)

Bu dosya bu bakımın TEK girdi kaynağıdır. İçindeki her madde ya kullanıcı kararıdır ya da "BAŞ MİMAR KARARI" diye işaretlidir (ders 40: kâhin programa uydurulmaz — aşağıdaki (1) bir PARA / DEFTER KURALI DEĞİL, senaryo dilinin ön koşuludur; nedeniyle birlikte KARARLAR.md'ye de "BAŞ MİMAR KARARI" diye yazılır).

## (1) BAŞ MİMAR KARARI 12.11.2026 — senaryo ön koşulu: "aynı adla açık kartı olan kişiye ikinci kart yüklenmez"
- Ürünün 2.0.4 sürümünden beri var olan, 2.5.0'da DEĞİŞMEYEN bir giriş denetimi: Excel / Sheets'ten taksit kartı, aynı grupta aynı adla AÇIK bir kartı (taksitli faturanın kartı dahil) bulunan kişiye YÜKLENEMEZ; yükleme reddedilir, hiçbir kayıt oluşmaz. Bu bir muhasebeleştirme kuralı değildir (hiçbir kaydın hesabını / tutarını belirlemez); yalnız "bu olay gerçekte kurulamaz" bilgisidir. Eski sürümün (2.4.9) gerçek koduyla da aynı ret görüldü.
- Kâhinin `senaryolar/g4-yeni-kayitlar.json` senaryosundaki `EX1` olayı (tür `excel_taksit_karti`, cari M1) bu ön koşulu çiğniyor: aynı senaryoda M1'in açık bir kartı var. Kâhin olayı kurulmuş sayıp sayı üretiyor; gerçekte olay hiç oluşmuyor → karşılaştırmada beş denetim ayrışıyor (hepsi bu tek olaydan).
- YAPILACAK: (a) `EX1`'i ön koşulu ÇİĞNEMEYEN bir kişiye taşı (senaryoda o an açık kartı olmayan bir cari; gerekiyorsa yeni bir cari) — olayın denediği kural (Excel taksit kartının açılış yazımı, KG-5 / B5) senaryoda KALMALI, kapsam daralmamalı; (b) beklenen değerleri kâhinin KENDİ kurallarıyla yeniden hesapla (elle, kâhin koşulmadan önce yaz); (c) kâhinin senaryo okuyucusu bu ön koşulu çiğneyen bir senaryoyu görürse sayı ÜRETMEZ, hata verir (KARARLAR.md'deki "kâhin bu durumları KURMAZ" listesine yeni madde); (d) öbür senaryolarda aynı ön koşulu çiğneyen başka olay var mı TARA — varsa tek tek yaz (aynı düzeltme).
- "Aynı adla açık kart" tanımında kâhinin KENDİ senaryo dilinde karşılığı olmayan bir ayrıntı çıkarsa (ör. grup kavramı senaryoda yoksa; kapanmış / silinmiş kart; aynı adlı iki ayrı cari) UYDURMA: en dar okumayı al ("aynı cari + o an açık kartı var"), sınırı KARARLAR.md'ye "SUSTUĞUM SINIR" diye yaz ve raporda bildir.

## (2) Kâhinin öz testi
- `oz-test.py` iki saat diliminde (UTC, Europe/Istanbul) YEŞİL olmalı. Bugün kırıksa: nedeni kâhinin KENDİ dosyalarından oku, düzelt ya da (düzeltme bir kural seçimi gerektiriyorsa) düzeltme — "KULLANICIYA SORULMALI" / "BAŞ MİMAR KARARI GEREKİYOR" diye raporla.

## (3) Bu bakımda YAPILMAYACAKLAR
- Kilitli yılın eski kuralla donmuş defteri × yeni kural konusu (kullanıcı kararı S127) bu bakımın işi DEĞİL — ayrı bakımda, ayrı girdiyle ele alınacak. Karşılaşırsan dokunma.
- Başka kural değişikliği yok. (1) ve (2) dışındaki hiçbir beklenti değişmemeli (G3: BEKLENMEYEN 0).
