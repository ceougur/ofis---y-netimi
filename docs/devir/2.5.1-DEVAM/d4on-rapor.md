# 2.5.1 D4-ÖN — rapor taslağı (devir yedeği taşımasına Windows yeniden denemesi, belge temizliği arşivi görür, iki yorum)

Görev metni: `docs/devir/2.5.1-DEVAM/d4on-istem.txt` (ana oturumda). Taban: etiket `t251-taban` (64396478).

## 0. Nasıl bozulur? (koddan ÖNCE yazıldı; testler buradan)
Devir yedeği taşıması (`.yaziliyor` → son ad):
1. Taşıma bir / birkaç kez geçici hata verir (EPERM, EBUSY, EACCES, ENOTEMPTY — Windows'ta antivirüs / dizinleyici yeni yazılan dosyayı kısa süre tutar) → yeniden denenmeli, sonunda başarmalı; yedek "Tamam", doğrulama geçer.
2. Taşıma kalıcı hata verir (tutamak hiç bırakılmaz) → sınırlı denemeden sonra anlaşılır Türkçe hata; tam yazılmış yarım klasör listede "yarım" kalır (silinmez — içerik tam; temizlik hatası asıl hatayı ezmez, ders 21).
3. Yeniden denenmeyen hata türü (ör. EXDEV, EIO) → hemen hata (bekleme yok), yine "yarım".
4. Hedef ad zaten var (aynı damga + etiket) → 409 bugünkü gibi (taşımadan önce); yarışta taşıma sırasında oluşursa kalıcı hata yolu.
5. Yarım klasör kalır (önceki çalışmadan) → aynı ad yeniden alınırken silinir (bugünkü gibi), listede "yarım".
6. Süreç taşıma sırasında ölür → klasör ya eski adla ("yarım") ya yeni adla ("tamam", bildirge yazılmış) — rename atomik; arası yok.
7. Aynı anda iki yedek → adlar damgayla ayrı; aynı damga ise 409.
8. Windows'ta GERÇEK ön koşul: klasördeki bir dosya açık tutamakla tutulurken klasör taşınamaz (EPERM) → tutamak bırakılınca yeniden denemeyle başarır (ders 18, 20, 48).

Belge temizliği (belgeler/ — arşiv ile çalışma yılı AYNI klasörü paylaşır, G8):
9. Belge çalışma yılında silinmiş (30 günü geçmiş) ama arşiv gösteriyor → dosya KALMALI.
10. Arşivde de yok → silinir (bugünkü gibi).
11. Arşiv kaydı var ama dosyası açılamıyor (bozuk / eksik / kilitli) → hiçbir belge dosyası SİLİNMEZ (güvenli taraf); arşiv değişmez.
12. Arşivsiz şirket → davranış ve hız AYNEN (tek ek maliyet: arşiv listesinin okunması).
13. İki şirket → bir şirketin arşivi öbürünün temizliğini etkilemez (her şirketin belgeler/ klasörü ayrı).
14. Birden çok arşiv yılı → belgeyi gösteren yıl ilk / son / ortada olabilir; hepsine bakılmalı.
15. Arşivin kendi silinmiş (30 günü geçmemiş) belge kaydı → dosya KALMALI (çalışma yılındaki kuralın aynısı); 30 günü geçmiş silinmiş arşiv kaydı → göstermiyor sayılır.
16. Temizlik arşive YAZMAZ, göç ETTİRMEZ; okuma bitince arşiv bağlantısı KAPANIR (Windows'ta açık tutamak D4'ün taşımasını düşürür — ders 48).
