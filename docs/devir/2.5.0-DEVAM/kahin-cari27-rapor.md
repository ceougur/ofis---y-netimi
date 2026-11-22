## Cari kâhini bakımı 27: rapor (KARARLAR.md §39)

**Dal ucu:** `16f22bdc`, dal `worktree-agent-a911ce76a62d46cac`, taban `edd5f828`. Push yapılmadı.

### Özet
- Üç karar kâhine işlendi: S249 = A (kendi kartında Düzenle ile azaltma), S251 = A (iadeli faturanın Düzenle'si ret), S250 = C (SK-49 susması aynen).
- Bakım 26'nın SK-48 (azaltma) ve SK-50 (iadeli Düzenle) susmaları kalktı.
- Programla iki saat diliminde **24.613/24.613, 0 fark**. Bakım 26'nın P-1'i kapandı. Yapım aşaması listesi **0 → 0**.
- Bir yeni susma çıktı: **SK-51 (uç durum)**. Kapanmış ve ödemeli kendi kartında Düzenle ile azaltma. Kararın kolları bu durumu saymıyor; artırmadaki eşi S250 = C idi.

### Değişen ve kalkan susmalar
| Kural | Girdinin satırı | Kâhinin yeni davranışı | Senaryo |
|---|---|---|---|
| S249 (a) ödemeli kart | §1 seçenek A, KAPSAM "(a) ödemeli kart" | Kart yeni tutarla eşit taksitlerle yeniden kurulur. Ödeme tek kuyrukta aynen kalır; artanı avanstır, sonra doğan kalemi kapatır. | d57 K3 (kararın örneği: kart 300, Kalan 0, bakiye −300), d58 T1, d59 U1 / U2 |
| S249 (b) kapanmış, tahsilatsız | KAPSAM "(b) … S235 = B: kart AÇIK kurulur" | Kart açık kurulur | d58 T2 (gecikmiş 200), d59 U4 |
| S249 (c) açık, tahsilatsız | §1 "900 → 600 ise kart 3 × 200" | Kart 3 × 200 | d58 T3 (gecikmiş 0 → 200; P-1 kapandı) |
| §36 KAPSAM (e), kendi kart kolu | KAPSAM "kendi kart için GEÇERSİZDİR" | Kalktı. Mevcut Borç kartında aynen sürüyor | — |
| SK-51 (yeni susma) | KAPSAM "kararın söylemediği alt durum → SUS" | Yalnız bakiye yazılır | d59 U3 |
| S251 = A | §2 seçenek A, KAPSAM "REDDEDİLİR; … DEĞİŞMEZ" | Adım `ret`; sayılar Düzenle'den önceki gibi. Taksitli, Mevcut Borç kartlı ve kartsız faturada aynı | d58 R4, d59 U5 / U6 |
| İade iptalinden sonra Düzenle | KAPSAM §2 "olağan kurallarla" | S249 (c) ile kurulur | d59 U7 |
| S250 = C | §3 | SK-49 aynen; neden metni "BİLİNEN SINIR (kullanıcı kararı S250 = C)" | d58 R3 (belirsiz kaydı iki parçalı) |

- Elle tablolar kâhin koşulmadan, karar metninden yazıldı (`uret-d59.py`). İlk kâhin koşusunda 475 elle denetimin hepsi tuttu; elle hesap düzeltmesi gerekmedi.
- Üreteç, bakım 26'nın dosyalarından da kendi çıktısından da depodaki dosyaları bayt bayt aynı üretiyor.

### Öz test ve mutasyon
- Öz test **8.855/8.855**, UTC ve Europe/Istanbul.
- 351 artık S249 B mutantı (kartı iade gibi küçültür), 354 artık S251 B mutantı (Düzenle'yi kabul eder). İkisi de değerle yakalanıyor.
- Yeni mutantlar 355 (fazla ödeme avansa gitmez), 356 (ret yalnız taksitli faturada) ve 357 (SK-51 susmaz) de yakalanıyor. Mutant 350 S249 (b) kolunu da kapsıyor.
- Susma kuralı mutantları kümesi artık {316, 324, 353, 357}.
- Programla koşudaki mutasyon taramasında yakalanmayan mutant yok.

### G3 (bakım 26 ↔ bakım 27)
- **665/665**, BEKLENMEYEN 0; döküm iki saat diliminde bayt bayt aynı.
- Üretici 20/20 aynı dizi. Eski kural setlerinde eşdeğerlik 532/532.
- Toplam 83 değişiklik:
  - S249: 49 yeni, 2 değişen (T3 ve U7 gecikmişi 0 → 200).
  - S251: 30 yeni.
  - GENEL: 2 yeni (d59'da mizan 120 / 600; eski kâhin susmalı senaryoda mizanı yazmıyordu).
- Farklar yalnız d57, d58 ve d59'da.

### Program ↔ kâhin (taban dalının programı)
| Koşu | Sonuç |
|---|---|
| İlk koşu (`e05251ce`, UTC) | 24.610/24.613 — 3 fark, aşağıda |
| Son koşu (`fe9126b2`), UTC | **24.613/24.613** |
| Son koşu (`fe9126b2`), Europe/Istanbul | **24.613/24.613** |

- İlk koşunun 3 farkı d58 R4'ün kendi kartında "okunamadı" idi. Neden kâhinin bağdaştırıcısıydı: reddedilen Düzenle'den sonra kartı kayda almıyordu. Ham yanıt 409 `invoice-locked` idi. `e7562f53` yalnız bu okumayı düzeltir, kural değildir.
- Son koşuda 0 okuma hatası, 0 yapım aşaması kaydı var; 7 bilinen sınır (b3y, bu bakımla ilgisiz); 12 atlanan senaryo (bugünkü gibi).
- `fe9126b2` ile dal ucu arasında model ve bağdaştırıcı kodu aynı; `a6393855` yalnız d58'in elle tablosunu değiştirdi.
- Program, ret durumlarında 409 `invoice-locked` ile "Bu faturanın 1 iade faturası var; düzenlenmez. Önce iadeleri iptal edin." döndürüyor.
- Program ↔ eski kâhin (d57–d59): **638/642**. Farklar T3 ve U7 gecikmişi ile d59'da mizan 120 / 600.

### Yapım aşaması listesi
- Kendi kopyamda iki saat diliminde üretildi: **0 kayıt**. Eski listeyle fark yok (yeni 0, kapanan 0, değişen 0).
- Üretilen liste depodakiyle bayt bayt aynı; depodaki liste değişmedi, ayrı commit yok.
- Bu koşunun kanıt durumu "BELİRSİZ (özet satırı tanınmadı)" çıkıyor. Bu beklenen: liste yazma koşusu bir test değil.

### Eski kâhin kırmızısı
- Bakım 26 kâhininde **68/475 elle denetim kırmızı**; iki saat diliminde aynı.
- S249: 45 (K3 7, T1 7, T2 7, T3 1, U1 7, U2 8, U4 7, U7 1).
- S251: 21 (R4 10, U5 6, U6 5).
- SK-51: 1. S250 = C: 1 (R3'ün neden metni).

### P listesi
**Yok.** Kâhin programa uydurulmadı. Bakım 26'nın P-1'i S249'un kendi metniyle kapandı.

### KULLANICIYA SORULMALI
**SK-51 (uç durum): Borçta Kalsın ile kapanmış ve ödemesi olan kendi kartında Düzenle ile azaltma.**
- Örnek: fatura 900 (3 × 300), 03.09'da tahsilat 300, 08.10'da Kartı Kapat, Düzenle 3 → 2 adet.
- **A:** kart S235 = B gibi açık kurulur (3 × 200, Kalan 300). 09.10 gecikmişi 0. Programın bugünkü davranışı bu; bu bir gözlem, kural kaynağı değil.
- **B:** kapanış korunur (kart 600, Kalan 300, kapalı). 09.10 gecikmişi 300.
- **C (ÖNERİ):** Uç durum böyle kalsın (BİLİNEN SINIR). Artırmadaki eşi S250 = C ile aynı aile.
- Bakiye (300), kart tutarı ve Kalan her seçenekte aynı; ayrışan yalnız kartın açık / kapalı durumu ve gecikmiş.
- Yaygın programlarda: doğrulanmış kaynak okunmadı.

### SONRAKİ SÜRÜME (2.5.1)
- Bakım 26'nın SK-50 kod yolu ve G3 aracındaki `sk50` sınıfı artık etkisiz; temizlenebilir.
- Bakım 26'nın 2.5.1 listesi aynen sürüyor: S244 kart Kalan'ı, rastgele üreticiye Düzenle / Kartı Kapat / iade + Düzenle adımları, öz test zorlaması, kos.sh kilit düzeni.

### DENENMEYEN
- Programın ret iletisinin metni ve Düzenle formundaki ödeme planı önizlemesi. API'den okunmuyor; ekran yürüyüşü gerekir.
- Düzenle'de taksit sayısı ya da ilk vade değişmesi. Dilde Düzenle yalnız miktarı değiştiriyor.
- Kendi kartına kart seçilerek ödeme, avans ya da evrakla ödenmiş kol.
- S249 ile yeniden kurulmuş kartın sonradan iadesi ya da ikinci Düzenle'si. SK-47 susmasına düşer; yeni senaryo yazılmadı.
- Rastgele üreticide Düzenle / Kartı Kapat yok.

### Kural sapmaları
- İlk KARARLAR.md başlık taraması (tek python satırı, birkaç saniye) flock'suz koşuldu. Okuma komutları (grep, sed, cat) da kilitsizdi.
- Program İstanbul ve sonraki koşuların başlığında "+1 değişmiş dosya" görünür. Bu, koşuların okumadığı üretecin o anki commit'lenmemiş hâli; `a6393855`'te commit'li.

### Değişen yollar
- `test/bagimsiz/cari/`: `model.py`, `oz-test.py`, `kos.mjs` (yalnız okuma eşlemesi), `KARARLAR.md` (§39)
- `test/bagimsiz/cari/senaryolar/`: `d57-c5-s241-s242-duzenle.json`, `d58-c5-s246-s243-kendi-kart-duzenle.json`, yeni `d59-c5-s249-s251-kendi-kart-azaltma-iadeli-duzenle.json`
- `docs/kanit/2026-11-22/kahin-cari27-arac/`: `kos.sh`, `zincir.sh`, `uret-d59.py`, `karsilastir.py`, `elle-fark.py`, `elle-karsilastir.py`, `yapim-ayir.py`
- `docs/kanit/2026-11-22/kahin-cari27-kanit/` (ham çıktılar, ilk program koşusu dahil)
- `docs/kanit/2026-11-22/kahin-cari27-rapor-taslak.md`

### Commit listesi
- `0954125c` yorumlar
- `5d07ff6f` elle tablolar ve üreteç
- `8f19f6cc` kural kodu
- `e05251ce` öz test ve araçlar
- `e7562f53` bağdaştırıcı okuması
- `fe9126b2` zincir betiği
- `a6393855` S250 elleBelirsiz kaydı
- `069cc26e` §39 kalan bölümleri
- `16f22bdc` Kanıt

### Ana oturumun yeniden koşacağı komutlar
Eski kopya önce açılır: `git archive edd5f828 test/bagimsiz/cari | tar -x -C <not defteri>/eski`. Betikte yollar `kc27-a91`'e sabit; kendi kopyanda `W`, `N` ve `E` değişkenleri uyarlanır.

- `docs/kanit/2026-11-22/kahin-cari27-arac/kos.sh <utc|ist> oz`
- `kos.sh <utc|ist> g3`
- `kos.sh <utc|ist> elle` (elle fark, yeni elle ve eski kâhin kırmızısı birlikte)
- `kos.sh <utc|ist> program`
- `kos.sh utc program-eski`
- `kos.sh <utc|ist> yapim`
- Hepsi birden: `kahin-cari27-arac/zincir.sh`
- Bütün adımlar `flock -s -w 3600 …/olcum.lock timeout -k 5 2400` altında koşar.
