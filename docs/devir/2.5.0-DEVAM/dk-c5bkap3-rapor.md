# Ç5-B kapanış dar kontrolü 3 — incelemecinin raporu (13.11.2026; AYNEN; ajan raporu kanıt değil — bulgular ana oturumca yeniden üretilir)

# DAR KONTROL — Ç5-B KAPANIŞ 3 (fark `37b4d750^1..37b4d750`; kapsam dışı: `test/bagimsiz`) — RAPOR

**Sonuç:** YÜKSEK bulgu yok. Gerileme yok. Bir ORTA bulgu var: önceki ORTA-1'in (DK-B7) düzeltmesi bir öğe türünde eksik kalmış. Bu farkın getirdiği bir bozulma değil; eski kodda da aynı. Ayrıca iki DÜŞÜK bulgu var, ikisi de yalnız test ya da temizlik. Baş mimar kararı K-a için bir gösterim sorusu çıktı. Kod değiştirmedim, commit ve push yapmadım.

**Ortam (bitiş, 21:2x UTC):** yük 0,90 / 4 çekirdek, boş bellek 10 GB, boş disk 7,2 GB.
- Koşular sırasında yük 1,0 ile 4,2 arasındaydı.
- `fark249` koşusu yük 4,23 iken başladı. Okuma ile başlatma aynı adımdaydı ve eşiği 0,23 aştı; bunu kendi kusurum olarak yazıyorum. Sonuç bundan etkilenmez: koşu bir ölçüm değil, bir eşitlik denetimi.

## GERİLEMELER
**YOK.** Karşılaştırma `37b4d750^1`'e göre yapıldı. Bütün betikler iki kodda koşuldu, UTC ve İstanbul saat diliminde.
- Para tarafındaki her sayı iki kodda birebir aynı: bakiye, kart kalemleri, gecikmiş, Vade Takip, zil, Nakit Akışı, Cari Listesi gecikmişi, Anlık Durum.
- Ayrıştırdığım bütün kurgularda sayılar aynı. Fark yalnız gösterim alanlarında.
- v2.4.9 ile karşılaştırma fikstür üzerinden yapıldı (aşağıda).

## KAPANIŞ TABLOSU
Önceki dar kontrollerin kendi betiklerini kullandım. Hepsi ürünü API'den ya da `buildObligations` ile çağırıyor. İki saat diliminde aynı sonuç.

| Önceki bulgu | Betik | ^1 | 37b4d750 | Durum |
|---|---|---|---|---|
| kap2 ORTA-A (kayıt detayı "Taksit Planı") | `kayit-kart.mjs` | pencere 500/400, kayıt 0/900 | kayıt 500/400, satırlar 300/0 · 200/100 · 0/300 (pencereyle aynı) | KAPANDI |
| kap2 ORTA-B adayı (çok satırlı caride yakınsama) | `saf-dolgu-gec.mjs` 71001×150×40, PAD=900 | 113 yakınsamıyor, gecikmiş farkı 3 | çıktı bayt bayt aynı | KARARLA BİLİNEN (S153 → S163 = C; K-d) |
| kap2 DÜŞÜK-A (kapanmış eski geçmiş) | `sigma-dolgu.mjs 0,200` | göst. 560 / 810 | 560 / 810; bakiye ve gecikmiş 940 | KARARLA BİLİNEN (S143 / S163 = C), değişmedi |
| kap2 DÜŞÜK-B (iade = tahsilat) | `iade.mjs` (akan saat) | P1: Tahsil Edilen 300 | 0, Kalan 700, bakiye 1.200; P2 ve P3 aynı | KAPANDI (S151 = B) |
| kap2 DÜŞÜK-C ("Kalanı Aşan Tutar" metni) | `yer` + `iade3` (karttan 700 → 409) | "kalan …" | "kartın kendi tahsilatlarına göre kalan …" | KAPANDI (ekrandan bakmadım) |
| kap2 DÜŞÜK-D (mutant N4) | N4 mutantı ↔ yeni; `satis-kart`, `komsu1`, `iade3` | — | kimlik ve zaman damgası dışında fark 0 | KARARLA BİLİNEN (K-c) |
| kap2 DÜŞÜK-E (fikstür) | `fark249.mjs` + `bf.py` | — | aşağıda | KAPANDI |
| kap2 SORU-1 (iade) | — | — | S151 = B ile karara bağlandı | KAPANDI |
| kap2 zil okuması | `zorla.sh` (6 sn gecikme) | — | 51 geçti, 0 kaldı; 13 "bekletildi" satırı; 3 UYARI ("7601 / 7896 / 5865 ms'de yetişti") | KAPANDI (yardımcı beklediği süreyi yazıyor) |
| b7 ORTA-1 (gizli satır + Silinenler) | `b7/k.mjs` | alarm yok, Kasa 5.050 | alarm: "0 → 1 hareket; kapının görmediği yazım: 1 hareket" | **KISMEN**: kart, tek satırlık para öğeleri ve evrak kapandı; stok hareketi AÇIK (ORTA-1 aşağıda) |
| b7 DÜŞÜK-1 (N5 / N8 / N15) | repo testleri + benim M11 / M13 / M17 mutantlarım | — | dış yazımın geri yüklemeden önce geldiği sıra testte var; mutantlar öldü | KAPANDI (N15'i ayrıca koşmadım) |
| b7 DÜŞÜK-2 (`GIT_DIR`) | — | — | bu farkta değişmedi | 2.5.1 (iş listesi B) |
| b7 (C) soru 3 ("Gecikmiş" aralığı) | `vade6.mjs` | 211 | 1.111 (altı aralığın hepsi) | KAPANDI (S150 = A) |
| kap2 / b7 DENENMEYEN: v2.4.9 verisi | `fark249.mjs` | — | 144 alan eşit, 0 fark | DENENDİ |
| kap2 / b7 DENENMEYEN: Vade Takip PDF / Excel, UTC | koşmadım (vadeTakip okuması) | — | PDF ve Excel aynı `vadeTakip()` işlevini çağırıyor; UTC'de de koştum | KISMEN |

## BULGULAR

### ORTA-1 — DK-B7 ORTA-1'in düzeltmesi nakit stok hareketini kapsamıyor (KISMEN kapanış; gerileme değil)
- **Dosya:** `server/lib/trash.mjs:10`
  ```
  const ROW_TABLES = { payment: "payments", cash: "cash_entries", "plan-entry": "plan_entries", "account-entry": "account_entries" };
  ```
  `stock-move` bu listede yok. Nakit stok satışı ve alımı Kasa satırıdır (`money-lines` kaynak 7, `stock_moves`). Bu yüzden silinirken özet yazılmıyor. Geri yüklemede `expectedOf` → `hiddenExpected` → `null` dönüyor ve bugünkü "her yeni kimliği açıkla" davranışı sürüyor.
- **Betik:** `…/dk-c5bkap3-q/betik/gizli.mjs` → `kanit/gizli-{once,yeni}.json`, İstanbul saati için `gizli-ist-*.json`.
  - Kurgu: açılış 10.03, nakit stok satışı 40 TL 12.03.
  - Hareket silinir. Silinenler yükünün tarihi dışarıdan 05.03'e alınır. Öğe geri yüklenir.

| Kurgu | ^1 | yeni |
|---|---|---|
| S1 stok hareketi | özet 0; uyarı 0 → 1; alarm YOK; Kasa 5.040; satır tarihi 05.03 | aynı (alarm YOK) |
| S2 Kasa hareketi (aynı dış yazım; karşılaştırma) | alarm yok | özet 1; alarm "0 → 1 hareket; kapının görmediği yazım: 1 hareket" |
| S5 cari hareketi (aynı dış yazım) | alarm yok | alarm |

- **Kök neden:** tek satırlık özet yalnız dört Silinenler türüne yazılıyor. K-b kararı "silindikten sonra dışarıdan değişen satır alarm verir; ESKİ (özetsiz) öğede bugünkü davranış" diyor. Bu farktan SONRA silinen stok hareketi eski bir öğe değil, yine de özetsiz kalıyor.
- **Sakınca süzgeci:** Kasa'da açılış bakiyesiyle bildirimsiz çift sayım (Kasa 5.040). Bu önceki ORTA-1 ile aynı aile ve dış araç gerektiriyor. Bu yüzden ORTA.
- **En küçük düzeltme:** `ROW_TABLES`'a `"stock-move": "stock_moves"` eklemek.
  - `sigOf(payload)` stok yükünde `payload.date` ve `payload.amount` alanlarını okuyor. Para satırının kuruşu da `ROUND(m.amount*100)`; ikisi aynı ölçü.
  - Meşru geri yüklemede yanlış alarm çıkmaması için `gizli-eski` kurgusunun bir benzeri teste eklenmeli.
- **Yanlış alarm yok:** `gizli-eski.mjs`'de açılış öncesi (eski veri gibi) satırlarla meşru sil → geri yükle kurgusunu koştum. Kart (tahsilat + iade), taksit hareketi, cari hareketi, Kasa hareketi, stok hareketi ve iki kez sil / geri yükle denendi. İki kodda, iki saat diliminde uyarı 6 → 4 → 6, alarm 0, Kasa 5.477,60.
- **Kapsam notu:** çek / senet ve cari türleri için özet yazılıyor ama pratikte boş. Nakit hareketi olan evrak silinemiyor ("Tahsil … yapılmış … silinemez"). Hareketi olan cari de silinemiyor. Fatura kartı fatura iptalinde yalnız tahsilatsızsa kaldırılıyor. Yani geriye kalan tek açık stok hareketi.

### DÜŞÜK-1 — Yeni testlerde dişsiz iki yer (yaşayan mutantlar)
Mutantsız taban: 7 dosya, 80 test, 80 geçti, 0 kaldı, 29 sn. Ayrıntı `kanit/mut3-sonuc.json` ve `mut3-*.tap`.
- **M15:** makbuz PDF'inde "İade / değersiz ile kapanan" satırı kaldırıldı → 80/80 yeşil.
- **M18:** taksit ekstresi PDF'inde aynı satır kaldırıldı → 80/80 yeşil.
- **Ürün doğru:** `iade3.mjs`, akan saat, K1. Ekstre PDF'inde "İade / değersiz ile kapanan: 200,00 TL (tahsilat sayılmaz)", makbuzda "İade / değersiz ile kapanan" satırı var.
- **Öneri:** iadeli kartın makbuz ve ekstre PDF metnine bakan iki assert.
- **Sakınca:** yalnız test; para, defter ya da gerileme değil.

### DÜŞÜK-2 — Silinenler özetleri hiç temizlenmiyor
- Her silmede ayar tablosuna bir `cash-hidden:*` satırı yazılıyor. Geri yüklemeden sonra da kalıyor: `gizli-eski`'nin sonunda 5 anahtar vardı.
- Silinenler'i boşaltma ya da kalıcı silme yolu yok. Satırlar yedeğe de giriyor.
- Şirket Verisini Sıfırla'nın "yalnız hareketler" kipinde artık (öksüz) kalıyorlar. "Hepsi" kipinde siliniyorlar.
- **Sakınca:** para, defter ya da KVKK sorunu yok. Ayar tablosunu tümden okuyan sıcak bir yol bulamadım; yalnız sıfırlama okuyor. DÜŞÜK.
- **Öneri:** başarılı geri yüklemede özeti silmek.

### KAPSAM DIŞI GÖZLEMLER (bu farktan değil)
- **Mobil yazma formu** (`client/mobil/yazma.js:64`) taksit kartını kuyruk Kalan'ına göre süzüyor (`plan.totals.remaining > 0`). Masaüstü seçici kartın kendi kalanına bakıyor (S118 = B).
  - `yer` Y3 kurgusu: mobil cari kartı Kalan 0, kartın kendi kalanı 900. Mobilde bu karta tahsilat yazılamıyor.
  - S129 kodundan (a1e21511) beri böyle. Tasarım §15.1 tablosunda bu form yok. İstemci tarama testi yalnız `client/index.html` betiklerine bakıyor.
- **Tasarım notu §15.1** kalıcı tarama testini `test/tyk-birlesik8-250.test.mjs` diye anıyor. Gerçek dosya `test/tyk-birlesik8-ekranlar-250.test.mjs` (describe satırı 223).
- **Durağan saat (ders 14):** `iade3` sabit saatle koşunca satış kartı iadesinde Kalan 1.000 çıkıyor, kuyruk kalemlerinin toplamı 700. İki kodda aynı. Akan saatte görünmüyor (Kalan 700, iade 300). Gerçek kurulum koşulu değil, bulgu saymadım.

## YER LİSTESİ (kendi taramam ↔ tasarım §15.1)
`yer.mjs` her kurguda kart penceresini şu yerlerle karşılaştırıyor:
- Taksitler listesinin 5 sekmesi.
- Cari kartı satırı: paid / remaining / returned / state / next / overdueCount.
- Cari kartı "Taksitten Kalan".
- Cari Listesi: Taksitten Kalan, "N geciken", sıradaki.
- Kayıt detayı (`forCase`), satırlarıyla.
- Rapor Merkezi Taksit Kartları.
- Mobil cari kartı (`/api/mobil/accounts/:id`).

11 kurgu: bağsız, karttan, fazla ödeme, iade, kapalı (S144), vadesi bugün, avanslı (S101), elle kart (S120), iki kart, aynı adlı iki cari, stok satışı + karttan.
- **yeni:** UTC ve İstanbul'da 0 ayrışma.
- **^1:** 66 ayrışma. Kayıt detayı, cari kartı durum / sıradaki / geciken, Cari Listesi N geciken / sıradaki ve mobil ayrışıyordu.

Tablodaki 1–17 numaralı yerlerin hepsi koşuldu, 18 ve 19 kapsam dışı. Tabloda olmayan tek yer mobil yazma formu (gözlem yukarıda). Cari ekstresi ve Rapor Merkezi'nin Geciken / Sıradaki / Durum kolonlarını karşılaştırmadım.

## (3) S151 / S158 — kendi kurgularım
Betik `iade3.mjs`, akan saat, iki saat dilimi. Kurgular:
- K1 iade + karttan tahsilat: karttan 800 kabul, 700 RET (S165).
- K2 iadenin silinip Silinenler'den geri gelmesi.
- K3 Değersiz yazma ve geri alınması.
- K4 S162: kart sondan küçülüyor (600 / 0 / 600 / iade 0).
- K5a / K5b iade + bağsız tahsilat, iki sıra.

Sonuçlar:
- Her durumda Tahsil Edilen + Kalan + İade = Toplam.
- Cari kartı satırı ve Taksitler listesi pencereyle aynı.
- Para alanları ve `tum()` (bakiye, gecikmiş, Vade Takip, zil, kalemler, kendi kalanı) iki kodda birebir: fark 0.
- Tedarikçi kartı açılmıyor (400), tedarikçi yönü denenemedi.

## (4) Vade Takip
Betik `vade6.mjs`. Dört gün (20.10, 31.10, 01.11, 31.12) × iki saat dilimi × üç yön × 10 aralık. Sözleri +15, +45, +120 ve +100 olan gecikmiş borçlar ile vadesiz borç var.
- Altı hazır aralıkta gösterge aynı: tahsilat 1.111, ödeme 713. Gösterge her yerde satırların gecikmiş toplamına eşit; toplam da satırlara eşit.
- Elle aralık ve late=0 ^1 ile birebir.
- Bugün ve Yaklaşan kümeleri değişmedi.
- Nakit Akışı, Cari Listesi, kart ve Anlık Durum değişmedi.
- "Gecikmiş" aralığı: ^1 211 → yeni 1.111.

## (5) Şüpheli iletisi
Betik `supheli.mjs`. Ret kuralı iki kodda aynı:
- Önceye 300 → 409.
- Yeni borç varken → 200 (bakiye 1.200).
- Borcun yettiği 100 → 200.
- Sınır 1 TL → 409; ileti "borç 899,00 TL, açık şüpheli 900,00 TL".
- Karar örneğinin iletisi: "borç 700,00 TL, açık şüpheli 900,00 TL".
- Başka bir caride önceden var olan ihlal varken de iletide doğru carinin sayısı çıktı (700 / 900). Kuşkum üretilmedi.
- Testler genel iletinin başka nedenlerde değişmediğini denetliyor.

## GEÇERSİZ KILMA TABLOSU
- Bu fark yeni bir bellek EKLEMEDİ. Eklenen kısa yollar `queueBrief` (Cari Listesi), imzalı `keysBeforeOpening`, `recordingHidden` (yalnız silinen kaydın satırları) ve `forCase`'te cari başına kuyruk.
- `tykAll`, `queueFor` ve `saleSourceCache` değişmedi.
- **Rastgele sıra:** `yer-rastgele.mjs`, 5 tohum (11, 23, 37, 41, 59) × 2 saat dilimi, 30 rastgele yazım. Yazımlar: borç, kart, stok satışı, bağsız ve karttan tahsilat, iade, kart sil / geri yükle, Kartı Kapat, gün ilerletme.
  - Her 6 adımda bütün cariler denetlendi, toplam 300 denetim. Yazımdan sonraki ilk okuma kullanıldı.
  - Sonuç: 0 ayrışma.
- Bir sınır: rastgele üreticide kart açma çoğunlukla 400 aldı (borçtan büyük), kartlar daha çok stok satışından açıldı.

## İNTEGRITY / Ç5-A ETKİLEŞİMİ
- Bu farkın `integrity.mjs` değişikliği iki şeyden ibaret: yalnız şüpheli nedeninde değişen ileti ve sapma bulunduğunda eklenen `figures` alanı.
- Taban imzası (`code|difference|count`) `figures`'ı içermiyor.
- İleti yalnız bütün nedenler `doubtful:balance` olduğunda değişiyor. Kilit nedeni de varsa genel ileti çıkıyor.
- Kilitli dönem reddini ve Ç5-A kilit izi önbelleğiyle etkileşimi ayrıca koşmadım; yalnız kod okuması (DENENMEYEN).

## ESKİ SÜRÜM FARK TESTİ
- `fark249.mjs`: fikstür verisini v2.4.9 kodunda (git archive v2.4.9) açtım ve YENİ okuyucuyla okudum. `v249.json`'un `gosterge / odenen / taksitler / durum` alanlarında 144 alan eşit, 0 fark çıktı. Yani yeni alanlar gerçekten v2.4.9 koduyla okunmuş.
- Beklenen farklar 116 → 132. Yeni 16 farkın hepsinin karar numarası var: S129 + S50, S99, S101, S151 = B + S140 = A.
- V2'nin dayanağına S140 = A eklenmiş; karar metni "iadeyle küçülünce kendi satışını taşır … 2.4.9'dan FARKLI" diyor, uyuyor.
- V4'ün dayanağı M1e → S144 = C olmuş; uyuyor.

## TEST GEVŞETMELERİ VE MUTANTLAR
- **Beklentisi değişen eski test:** yalnız `vade-takip-soz-b7-250`. `gecikmisAraligi` artık "− sozIleride" düşmüyor. Dayanak S150 = A; eşitlik korunmuş. skip / todo yok.
- **`tyk-mutasyon-250`:** KD3-a / b / c / n desenleri yeni metne uyarlanmış, anlamları aynı.
- **Kendi 18 mutantım:** 16'sı öldü (M1–M14, M16, M17; M7 ayrı koşuda öldü). M15 ve M18 yaşıyor (DÜŞÜK-1). Mutantlar:

| Mutant | Ne değişti |
|---|---|
| M1 | Değersiz yazma tahsilat sayılır |
| M2 | Kalan iadeyi düşmez |
| M3 | Satır iadesi 0 |
| M4 | Cari kartı satırına iade gitmez |
| M5 | Cari Listesi kuyruksuz |
| M6 | Vadesi bugün olan taksit geciken sayılır |
| M7 | `forCase` kuyruksuz |
| M8 | "Gecikmiş" aralığı geri |
| M9 | 8b geri |
| M10 | 90 Gün dışarıda |
| M11 | Geri yükleme özete bakmaz |
| M12 | İmza yalnız tarih |
| M13 | Özetsiz öğe boş özet sayılır |
| M14 | İletide borç = 120 |
| M15 | Makbuzdaki iade satırı yok (yaşıyor) |
| M16 | N geciken kartın kendi hesabından |
| M17 | Tek satır özeti yazılmaz |
| M18 | Ekstredeki iade satırı yok (yaşıyor) |

## ÖLÇÜM
Temiz 100 bin satır (`ana-kabul/temiz-100k`'nın kendi kopyaları), `flock -x -n`, 21:20–21:21 UTC.
- **Cari Listesi, yazımdan sonraki ilk açılış** (`limit=300`, 6 tekrar):
  - ^1: en iyi 1.519 ms, ortanca 1.595 ms (yük 1,65 → 1,58).
  - yeni: en iyi 1.469 ms, ortanca 1.498 ms (yük 1,58 → 1,38).
  - Oran: en iyi 0,97, ortanca 0,94. Kötüleşme yok; ana oturumun oranlarıyla (0,98 / 1,01) çelişmiyor.
  - Mutlak değerler ana oturumunkinden büyük (566–581 ms'ye karşı yaklaşık 1,5 sn). Muhtemelen istek farklı (benim süzgeçlerim: `status=active&sort=name`).
  - Ilık açılış: ^1 604 / 692 ms, yeni 667 / 703 ms (en iyi / ortanca).
- **Kart silme / Silinenler'den geri yükleme: ÖLÇÜLEMEDİ.**
  - İlk koşuda seçtiğim kartlar 409 verdi (fatura kartları ya da Kasa korumasına takılanlar; nedeni okumadım). Geri yükleme bu yüzden 404 döndü.
  - Seçimi düzelttikten sonraki üç denemede (21:21) özel kilit doluydu: `flock -n` çıkış 1, hata çıktısı boş. Bekleme döngüsü kurmadım.
  - Betik hazır: `betik/olc3.mjs` (veri kopyaları silindi, yeniden `cp` gerekir).

## BAŞ MİMAR KARARLARININ DEĞERLENDİRMESİ
- **K-a:** hazır aralıklar için karar metnine uyuyor; altı aralıkta 1.111 / 713 ve gösterge = satırlar. Ancak "her aralıkta aynı sayı" ifadesi elle aralığı da kapsayabilir; iki okumaya açık. Aynı tarihler elle girilince sayı değişiyor:

  | Aralık | Hazır | Elle (aynı tarihler) |
  |---|---|---|
  | 20.10–27.10 (7 Gün) | 1.111 / 713 | 511 / 0 |
  | 20.10–19.11 (30 Gün) | 1.111 / 713 | 1.011 / 700 |

  Başlıktaki aralık metni iki durumda da aynı. Soru aşağıda.
- **K-b:** karar metnine uyuyor. Kart, tek satır, tutar, tarih ve kimlik değişiminde doğru çalışıyor; meşru yolda yanlış alarm yok. Eksik tek tür stok hareketi (ORTA-1).
- **K-c:** N4 için dışarıdan gözlenen bir yüz BULAMADIM. Mutantla yeni kod arasında stok satış kartı (akan saat), ORTA-1 komşuları ve iade kurguları kimlik ve zaman damgası dışında aynı. Excel ve Tablodan Aktar yollarında denemedim.
- **K-d:** ORTA-B adayının çıktısı iki kodda bayt bayt aynı. Kural ve kod değişmedi; S163 = C ile uyumlu.

## KULLANICIYA SORULMALI
**S-K-a (gösterim kuralı; bakiye değişmez):** "Gecikmişleri de göster" açıkken ELLE girilen aralıkta "Gecikmiş Tahsilat / Ödeme" göstergesi hazır aralıklarla aynı mı olmalı? Örnek: 20.10–27.10 elle 511 / 0, aynı tarihler "7 Gün" ile 1.111 / 713. Bakiye iki okumada da değişmiyor: alacak 1.111, borç 713.
- A: Elle aralıkta da aynı olsun; sözü aralık ötesindeki gecikmişler de satır olarak listelensin.
- B: Elle aralık bugünkü gibi kalsın; yalnız aralığın kendi kalemleri ve öncesindeki gecikmişler.
- C: Böyle kalsın (BİLİNEN SINIR).
- Öneri: A. Ekrandaki başlık iki durumda aynı aralığı yazıyor, kullanıcı farkı göremez.

## DOĞRULANMADI
- Başka bir caride önceden var olan şüpheli ihlali varken iletinin yanlış carinin sayısını göstermesi: denedim, üretilmedi.
- Kayıt detayından açılan Tahsilat penceresinin ekrandaki görünümü (API'de pencereyle aynı).
- Mobil yazma formunun ekran davranışı: yalnız kod okuması ve API verisi.

## DENENMEYEN
- Kart silme / geri yükleme ölçümü (kilit doluydu).
- Excel / Sheets toplu yükleme ve Tablodan Aktar kartı (S142 görünümü).
- İki şirket ve yedekten geri yükleme. Kod okumasına göre özetler şirketin kendi ayar tablosunda, yedeğe giriyor.
- Kilitli dönemde ret; Ç5-A kilit izi ile etkileşim (kod okuması).
- Şüpheli iletisinin borç düzeltme / silme, çek / senet ve toplu yükleme ret yollarında görünümü (testler tahsilat, Alacak, iade ve Silinenler'i kapsıyor).
- Vade Takip PDF / Excel'in ayrıca okunması (aynı işlev).
- Ekran yürüyüşü ve gece yarısı zorlaması (gün dönümü sahte günle denendi).
- Tedarikçi kartı (program 400 veriyor).
- Mutant N15.

## BIRAKILAN KLASÖRLER
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap3-q/betik`: kendi betiklerim ve önceki iki dar kontrolün düzeltilmiş kopyaları.
  - Kendi betiklerim: `gizli.mjs`, `gizli-eski.mjs`, `supheli.mjs`, `vade6.mjs`, `iade3.mjs`, `yer.mjs`, `yer-rastgele.mjs`, `fark249.mjs`, `bf.py`, `mutant3.py`, `n4.sh`, `olc3.mjs`.
  - `kos.sh` kod kopyalarını `<klasör>/once` ve `<klasör>/yeni`'den bekliyor. Kopyalar silindi; yeniden kurmak için `git archive` + `node_modules` bağı gerekir.
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap3-q/betik-b7`: DK-B7 betiklerinin kopyası.
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap3-q/kanit`: ham çıktıların hepsi (json, tap, err).

Kod kopyaları (`once`, `yeni`, `v249`, `mut`, `mutN4`) ve veri kopyaları tam yollarıyla silindi. Süren arka plan işim yok. Worktree'de commit yok; yalnız görev metninin istediği `node_modules` bağı var.

**YÜKSEK YOK. ORTA: 1 (ORTA-1, stok hareketi).**
