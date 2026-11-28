# M2 TUR 2 — Değersiz Alacak sınırı: hız + S-DKM2-2 = A + S-DKM2-3 iletisi (2.5.1; rapor taslağı)

Taban: `t251-m2t2-taban` (08f1a2d7). Görev metni: `docs/devir/2.5.1-DEVAM/m2t2-istem.txt`.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Hız düzeltmesi (YÜKSEK-1) — eşdeğerlik bu eksenlerde bozulabilir:
1. Bağlı tahsilat günü sayısı 0 / 1 / 60 / 250: aday gün kümesi boş, tek gün, çok gün; sınırın değiştiği gün ilk gün, bugün ya da ARADA.
2. Kayıt sayısı 1 / 3: öbür kaydın Değersiz satırı yeni Değersiz'den SONRA sıralanıyorsa ("later" — taşma) sınır gün ilerledikçe ARTABİLİR (F azalır, taşma kısıtı gevşer) → yalnız "ilk gün + bugün" en çok yazdıran günü kaçırabilir (önermenin karşı örneği adayı).
3. Bağsız tahsilat (her tarihte sınırı küçültür), Şüpheliden Çıkar (öbür kaydın kalanı sıfırlanır), S155 bakiye sınırı (öneri < sınır), carinin borç bakiyesi (sınır < kalan), kilitli dönem (ilk gün kilidin ertesi), ileri tarih.
4. Aynı gün sırası: Değersiz o günün bağlı payından önce (S264); geri yüklemede satır kendi yazım anıyla sıralanır (aynı günün öbür Değersiz satırlarının ARASINA girebilir).
5. Eşitlikler: birden çok günde aynı öneri / sınır → en erken gün seçilir; öneri eşit, sınır büyük olan seçilir.
6. İşlem içi (Değersiz Yaz, geri yükleme — bellek kapalı) ve işlem dışı (liste, form ucu — bellek açık) iki yol.
7. İki saat dilimi (UTC, Europe/Istanbul) — "bugün" ve gün sınırı.

S-DKM2-2 = A (iptal / iade reddi) — bozulma yolları:
8. Değersiz'den sonra fatura iptali; aynı faturanın tam iadesi; kısmi iade; iadenin düzenlenmesi (miktar artışı); faturanın silinmesi (iptali çağırır); e-Belge iptali (iptali çağırır).
9. Cari zaten eksideyken (Değersiz'den bağımsız avans) iptal / iade: "Değersiz yüzünden" iki okuma (Değersiz olmasaydı da eksi kalır mı?).
10. Fatura TUTARININ düzenlemeyle düşürülmesi; bağlı evrakın karşılıksız çıkması / iadesi (aynı kök neden mi — ÖLÇ).
11. v2.5.0 GERÇEK kodunun ürettiği veri: Değersiz → iptal o sürümde kabul edilmiş; yeni kod Mutabakat'ta YANLIŞ kırmızı vermemeli (değişmez (i): bağı iptalle kopan tahsilat).
12. Değişmez (i)'nin gevşemesi yalnız iptalden SONRA yazılmamış Değersiz satırlarını etkilemeli; gevşeme yeni yanlış kırmızı üretmez (yalnız satır çıkarır → sınır büyür).

S-DKM2-3 = C (öbür kaydın silinmesi reddi kalır, ileti düzelir):
13. Kayıt silme, kayıt geri yükleme, Değersiz satırı silme — üç yol aynı çakışma iletisini kullanır; ileti yola göre doğru anlatmalı.
14. Kapı reddinde writeoff-limit / writeoff-balance nedeni (S155 deseniyle anlaşılır ileti); başka nedenle birlikte gelirse genel ileti kalır.

(Bölümler iş ilerledikçe eklenir.)
