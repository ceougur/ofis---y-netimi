# M1 KÜÇÜK TUR — KDV Özeti: S-DKM1-1 = A, S-M1-3 notu, S-M1-2 yön notu, tablo altı ve not kartları (2.5.1) — RAPOR (TASLAK)

Taban `t251-m1k-taban` (837f515b). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve defter DEĞİŞMEZ — yalnız rapor görünümü.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
S-DKM1-1 = A'nın sınırı: mahsup fişi kesilmiş ayın kayıtları sonradan İndirilecek KDV'yi AZALTIRSA o ayın sonucu kesilmiş fişten; azalma (S4) sonraki
mahsupta düşülür → her azalma bir kez sayılır, bütün aylar sırayla mahsupluysa aralığın Ödenecek KDV'si = fişlerin ödeneceği (360).
1. AZALTAN ↔ ARTIRAN: yalnız azaltan fark (İ düştü) fişten; artıran fark (İ arttı ya da 391 değişti — program "Güncel Değil" der) S-M1-3 = C:
   sayılar bugünkü hâliyle kalır + "mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin" notu. İkisi AYNI ayda (karma) — kararlar ayrı
   ayrı söylüyor; birlikte gelince hangisi geçer? (kodlamadan önce bakılacak; para kuralıysa sorulur).
2. FİŞ ZİNCİRDE / KOPUK: fiş zincirdeyse sonuç fişten; kopuksa (önceki ay atlanmış) rapor zinciri gösterir. Kopukluk YALNIZ devredenle değil,
   S4 emilimiyle de olabilir: mahsupsuz ay azalmayı zincirde zaten düşmüşken sonraki ayın fişi aynı azalmayı yeniden düşmüş (dar kontrol L) →
   fişe güvenilirse azalma İKİ KEZ sayılır (Ocak–Mart 2.100). Fiş zincirde sayılmak için devreden + S4 emilimi zincirle aynı olmalı.
3. AZALMA FİŞİ KESİLMİŞ SONRAKİ AYDAN SONRA GELİRSE (Ocak + Şubat fişi, sonra Ocak alışı iptal, sonra Mart): Şubat'ın fişi azalmayı görmedi; azalma
   Mart'ta düşülmeli; Şubat'a "kayıtları değişti" notu YANLIŞ olur (Şubat'ın kendi kaydı değişmedi).
4. AY ARALIĞIN ORTASINDA / BAŞINDA / SONUNDA: tek ay, çeyrek (azalan ay ilk ayda), aralık azalan aydan sonra başlıyor (önceki devreden fişten mi),
   aralık azalan ayda bitiyor (sonraki döneme devreden fişten mi), "Tüm Zamanlar".
5. YIL DÖNÜMÜ: Aralık fişi, Aralık alışı Ocak'ta iptal; Bu Yıl (Ocak) önceki devreden ve Ocak ödeneceği.
6. MAHSUBU GERİ ALINMIŞ AY: azalan ayın fişi geri alınınca ay artık zincirde mahsupsuz → bugünkü kayıtlardan, not kalkar; yeniden kesilince yeni fiş.
7. DEVREDEN YÖNÜNDE AZALMA: fiş "sonraki döneme devreden" yazmış ay (ödenecek değil) — sonraki ayın önceki devredeni fişin devredeni.
8. EKRAN = PDF = EXCEL: ay satırları, tablo altı, özet ve not satırları üç çıktıda aynı; not kartında uzun cümle normal yazıyla; dar pencerede
   tablo altının bütün satırları görünür (üst üste binmez).
9. EKSİK TESTLER (dar kontrolün yaşayan mutantları): mahsupsuz ayın S4 emilimi zincirde unutulursa; "Mahsup Edilmemiş Ay" en çok 6 ay sınırı 5'e
   inerse — her biri o mutantta kırmızı olmalı.
10. NOT METİNLERİ: yön farkı (fiş devreden, zincir ödenecek) notta; aynı devredenle ama farklı emilimle kesilmiş fişte "0,00 TL devredenle kesilmiş,
    0,00 TL olmalıydı" gibi anlamsız cümle çıkmamalı; notlar cümle düzeninde (yazım düzeni).
11. İKİ ŞİRKET, YETKİ, KİLİT: değişmez (komşu testler).
