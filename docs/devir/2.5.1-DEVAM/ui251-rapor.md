# 2.5.1 son aday — UI düzeltme turu raporu (UI-1 / UI-2 / UI-3 + D1)

TASLAK — koşular sürüyor (komşu e2e iki saat dilimi, mutasyon). Son hâli ajanın son iletisidir.

## Değişen gözlenebilir davranışlar (önce → sonra)
1. UI-1 Cari kartı (pencere) → Ödeme / Borç × → Sil → Değersiz Alacak reddi (760 harf, "Ne yapmalı:"):
   önce 380 px, 22 satır / 426 px, pencerenin üst ortasında, Değersiz satırının ×'ını örtüyor (1440×900: × (601, 363) bildirimin altında), ~30 sn'de kapanıyor;
   sonra 720 px, 8 satır / 208 px, pencerenin ALTINDA ortada (1440×900: y 679–886; 1366×768: y 547–754; 1280×720: y 499–706), × örtülmüyor (üç kaydırma konumunda),
   süreyle kapanmıyor, yalnız ×; en çok iki uzun bildirim; sonradan açılan pencere (ör. Değersiz × → "silinsin mi?") açıkken gizli, kapanınca geri gelir.
2. UI-2 Raporlar → KDV Özeti, 1366×768 ve 1280×720: önce 6 kart tek satırda, "Ödenecek KDV" kesik / "Sonraki Döneme Devreden KDV" gizli (1280'de üç kart);
   sonra kartlar iki satıra sarılır, altısı da tam görünür. 1440×900 (2 satır) ve 1920×1080 (1 satır) aynı; öbür raporlar alçak ekranda eskisi gibi tek satır.
3. UI-3 KDV Mahsup Fişi → Mahsup Edilen Aylar: önce tablo 878 px / kutu 760 px, Geri Al yalnız yana kaydırınca; sonra tablo 760/760, Geri Al görünür
   (tutar başlıkları ve "Mahsuptan Sonra Değişti" rozeti iki satıra kırılır).
4. D1 Değersiz Alacak Yaz formu: "659 Diğer Olağandışı Gider'den" → "659 Diğer Olağan Gider ve Zararlar'dan".
