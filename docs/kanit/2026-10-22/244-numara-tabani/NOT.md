# Numara tabanı göçü v32 — bir kezlik tarama (2.4.4, karar 22.10.2026)

**Karar (baş mimar):** güncellemeden ÖNCE (2.4.0–2.4.3) bırakılıp e-Belge olarak gönderilmiş belgelerin fiş numaraları tek seferlik taramayla numara tabanına
(`invoice.numberFloor`) yazılır. Böylece güncellemeden sonraki ilk bırakmada ya da kâğıt kayıtta yeniden verilmezler (244-numara-tekil'deki "eski veri"
sınırı kapanır).

**Uygulama (server/lib/migrations.mjs):**
- Göç v32 `scanPaperFloors` her şirket veri tabanında bir kez koşar. İşaret `PRAGMA user_version`'dır (veri tabanının içinde).
- Güncellemeden sonra geri yüklenen eski yedekte de koşar: company-backups geri yüklemede göçleri uygular.
- Taranan kaynaklar:
  - Kâğıt Fatura No değerleri;
  - işlem geçmişindeki `invoice.withdrawn` numaraları, belge hâlâ varsa ve artık o numarada değilse (Kâğıt Fatura No önceden doluysa numara yalnız orada kalır).
- Bir numaranın sayılma koşulları (hepsi birlikte):
  - programın biçimindedir (seri + yıl + 9 hane);
  - firmanın kâğıt serilerinden birindedir (Fatura Ayarları; ayar yoksa FIS / SMM);
  - numarayı taşıyan belge o seride DURMUYORDUR.
- Seri + yıl başına en büyük sıra tabana yazılır. Taban yalnız yükselir, tarama idempotenttir.
- Şirket Verisini Sıfırla tabanı siler (app.mjs, önceki commit).

| Kanıt | Sonuç |
|---|---|
| kirmizi-e6a5a72-numara-tabani (numara tekil var, tarama yok; ayrı worktree) | 5/6 kırmızı: S1 (001: FIS…003 yeniden), S3/S4 (002: FIS…001 yeniden), S5 (geri yüklenen 2.4.3 yedeği), S6 (tarama yok), S2 (Kâğıt Fatura No kaynağı). S7 (sıfırlama) koruyucu, eski kodda da yeşil. |
| mutasyon-taban-ozet.json | 8/8 yakalandı. T1 tarama kapalı, T2 işlem geçmişi taranmaz, T3 Kâğıt Fatura No taranmaz, T4 seride duran sayılır, T5 her seri sayılır, T6 biçim gevşek (8 hane), T7 taban küçülür, T8 sıfırlamada taban kalır |
| komsu-numara-tabani | 30 dosya 342/342: goc-244-numara-tabani 6/6, numara-tekil, göç zinciri / yedek / geri yükleme / güvenilirlik göç-tatbikat-arıza, goc-243/244, personel v31, sıfırlama, şirketler, e-Belge komşuları, platform, lisans izolasyonu |

**Test verisi:** v2.4.3'ün gerçek koduyla API'den üretildi (test/goc-244-numara-tabani.test.mjs):
- 001'de A ayrıldı (FIS…001); B FIS…001'i yeniden aldı (2.4.3 hatası); K kâğıt fatura (FIS…002, Kâğıt Fatura No elle FIS…970); C ayrıldı (FIS…003).
- Elle yazılmış ve sayılmaması gereken 5 numara: biçim dışı, 15 hane, EAR, TEA, KGT.
- 002'de G'nin Kâğıt Fatura No'su önceden dolu ("EL-77"); bırakıldı FIS…001 ve gönderildi, numara yalnız işlem geçmişinde.
- 002'nin 2.4.3 yedeği alındı.

**Bilinen sınırlar:**
- Kâğıt serisi adı sonradan değiştirildiyse eski serinin numaraları taranmaz. Yeni seride çakışma olmaz.
- Taşınmış belgede programın biçiminde ve kâğıt serisinde ELLE yazılmış numara da kullanılmış sayılır (kural gereği; boşluk kalır).
- 2.4.3'te zaten iki belgeye verilmiş numara (B ve A'nın FIS…001'i) olduğu gibi kalır; göç belge değiştirmez.
