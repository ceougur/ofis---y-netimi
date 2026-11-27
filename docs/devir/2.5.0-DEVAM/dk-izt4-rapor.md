# DAR KONTROL — İZLEYEN TUR 4 (883578ae^1 → 883578ae; S255 = A)

İncelediğim fark yalnız `server/lib/invoice-settle.mjs` ve `server/lib/obligation-queue.mjs` ile yeni test ve e2e dosyası. Kod değiştirmedim, commit / push yapmadım. Kendi commit'im yok. Worktree'deki node_modules bağını iş bitince kaldırdım.

## GERİLEMELER
**YOK.**
- **Temiz büyük veri:** 2 şirket, 1.484 + 406 cari, 8.798 + 986 Mevcut Borç kartı, 15.370 + 2.030 faturalı çek olayı (bağlı cari satırı 0).
  - 54.585 okuma anahtarı karşılaştırıldı: her cari liste satırı, cari kartı toplamları ve kart özetleri, Taksitler, her faturanın payState / open değeri, Vade Takip, Nakit Akışı, zil, Anlık Durum özeti, Mutabakat Testi ve 6 rapor (acik-faturalar, alacak-yaslandirma, cari-listesi, taksit-kartlari, geciken-taksitler, taksit-vadeleri).
  - Eski ↔ yeni, UTC ve Europe/Istanbul: **değer farkı 0**. Fark yalnız zaman damgasında (generatedAt / at).
- **Gerileme denetimi senaryoları (eski = yeni, iki TZ):** bağsız ödeme, kartsız cari, kartın içine almadığı fatura, kart faturadan önce açılmış, bağlı ödeme karttan önce yazılmış (B9; sonradan başka satır eklenince de), tedarikçi.

## İLK MADDELER
**1. KURAL (S255 = A, S256 = A).** Senaryo betiği `probe.mjs` + `probe2.mjs` ile 70'e yakın senaryo, yeni / eski × iki TZ. TZ farkı 0.
- **Taban (F 900, kart 600):**
  - Bağlı 300 → 0/600
  - Bağlı 600 → 300/300 · bakiye 300 · gecikmiş 0
  - Bağlı 900 → 600/0 · bakiye 0
  - Bağlı 1.200 → 600/0 · bakiye −300
  - Bağsız 900 aynı kaldı
- **Bağlı ödeme, bağsız ikiziyle her alanda birebir aynı çıktı:**
  - elle borç erken vade (15.09) → fazla elle borca; bakiye 800, gecikmiş 400, kart 0/600
  - elle borç geç vade (20.11) → fazla kartın 05.10 taksitine
  - karttan sonra F2 (vade 20.09) → fazla F2'ye
  - geriye tarihli bağlı 600 / 900
  - Kartı Kapat
- **Kartın kısmen tahsil edildiği durumlar:**
  - kart tahsilatı 200 → bağlı 600: 500/100, bakiye 100
  - bağlı 600 → kart tahsilatı 300: 600/0, bakiye 0
- **İki fatura, kart 900:** bağlı F1 600 → F2'nin gösterilen 300'ü + kartın 05.10'u; bağlı F2 600 → 300 + kartın 05.10'u. Bakiye 600.
- **Diğer:** 3 × 200 bağlı = tek 600. Bugün 20.12 iken gecikmiş taksitlerle; peşinli faturada da doğru.
- **Çek (S256 = A):** portföye giriş, Tahsile Ver (collect) ve ciro hep 300/300, bakiye 300. Karşılıksızda kart 0/600'e döner, F gösterilen 300 açık, bakiye 900.
- **Ödeme (tedarikçi) yönü:** tedarikçide Mevcut Borç kartı açılmıyor (400 "taksitlendirilecek borcu yok"); bağlı ödeme eski = yeni.

**2. SIRA VE GERİ ALMA.**
- **Düzenle (PUT) ve silme:** PUT tutar 300 → 600 = taze 600; bağ ekleme (bağsız → bağlı) = bağlı 600; bağ kaldırma ve bağ F → F2 eski = yeni; silme ve Silinenler'den geri yükleme (tamamı kartta F 600 dahil) doğru.
- **Kart ve fatura işlemleri:** kart silme eski = yeni. Fatura İptal Et ve iade 600, bağsız ikiziyle aynı. Kartı Kapat bağsızla aynı.
- **İade sırası:** iade → bağlı, bağlı → iade, iki iade art arda ve PUT ile bağın iadeden sonra eklenmesi denendi; bağlı ile bağsız aynı görünüm, bakiye doğru.
- **Kilit:** bağlı 600'den sonra kilit koymak görünümü değiştirmiyor. İlk taksiti kilitli dönemde olan kartta sonuç kilitsiz ikiziyle aynı. Kilitten sonra bağlı ödemenin silinmesi eski = yeni.
- **v2.4.9 verisi:** etiketin gerçek koduyla (`bootVersion("v2.4.9")`) 7 cari üretildi, sonra yeni ve eski kodla göç edildi (iki TZ).
  - kartsız, bağsız 900 ve bağlı 300: AYNI
  - bağlı 600 / 900 / 1.200 ve çek 600: taze veriyle aynı S255 sayıları
  - göçten sonra bağlı +300 → 300/300, bakiye 300; kart tahsilatı 100 → 400/200, bakiye 200; Mutabakat temiz.
- **Yedek → geri yükleme:** B10 testi yeni kodda yeşil (aşağıda).
- **İki okuma:** her adımda kart penceresi = cari kartı özeti = Taksitler listesi oldu; Vade Takip toplamı = bakiye (elle borç hariç, aşağıdaki nota bakın); Mutabakat her senaryoda ok.

**3. GERİLEME:** Yukarıda — YOK.

**4. ŞÜPHELİ / MAHSUP / S259:** Bakiye bozulan durum görülmedi.

**5. CANLI YENİLEME:** Sunucu tarafında her yazımdan (tahsilat, PUT, silme, çek olayları, iade) hemen sonra kart, cari, liste ve fatura taze okundu; personel / muhasebe oturumlarının kart görünümü de güncel. İki tarayıcı oturumlu ekran denemesi yapılmadı (DENENMEYEN).

**6. BEKLENTİSİ DEĞİŞEN TEST:** `git diff --diff-filter=M … -- test ':!test/bagimsiz'` boş. Yalnız yeni dosya eklendi.

**7. TESTİN DİŞİ:** `test/izt4-s255-bagli-odeme-250.test.mjs`
- yeni kodda 17/17 geçti
- eski kodda (ayrı kopya; ders 51) 14 kırmızı, hepsi beklenen nedenle ("kart penceresi" / "Vade Takip: kartın kalan taksitleri" farkı)
- eski kodda geçen 3 test bekçi testi (bağlı 300, bağsız 900, B9) — beklenen.

## BULGULAR
**YÜKSEK / ORTA YOK.**

## K1–K3 DEĞERLENDİRMESİ
- **K1 — karar metnine uyuyor.** Bağlı 600 sonrası fatura kartı 'Taksitte', gösterilen açık 0; kapama defterinde kart F'nin 600'ünü almış, kartın kalanı 300 (faturanın kart içindeki kendi açığı 300).
- **K2 — uyuyor.** Eski anlamdaki taksit gecikmişi (Ödeme Hatırlatma'nın okuduğu) bağlı ve bağsız ödemede aynı: bağlı 900 / bağsız 900'de bakiye 0 iken 200; kilitli ilk taksitli senaryoda 400. Yani müşteriye bakiyesi 0 iken 200 gecikmiş hatırlatması gidebilir. Bu Ç5-C'nin (2.5.1) BİLİNEN SINIRI; teslim notunda sayıyla yazılmalı.
- **K3 — uyuyor.** Çek, ciro, Tahsile Ver ve Silinenler yolları bağlı tahsilatla aynı sayıyı verdi; karşılıksızda kart eski hâline döndü.

## KULLANICIYA SORULMALI
YOK. Yeni iki okumalı kural bulmadım.

## ÖNCEDEN VAR — bu birleşimle gelmedi, bağsız ödemede ve eski kodda da aynı
1. **Mevcut Borç kartı açma sınırı kartın kendi hesabından okunuyor.**
   - Senaryo: F 900, kart 600, tahsilat 600 (bağlı ya da bağsız), sonra F2 600, sonra K2 600.
   - Sonuç: 400 "taksitlendirilebilecek borcu 300 TL". Oysa kuyrukta kart dışı açık borç 600 (F2).
   - Neden: `server/routes/plans.mjs:676 uncoveredDebt`, kartın kendi hesabını (tahsil 0) kullanıyor.
   - Eski kodda da 400. Kullanıcıyı etkiliyor ama Ç5-C ailesi; ana oturum Ç5-C / BİLİNEN SINIR listesine eklemeli.
2. **Kart kırpılması (S259 = C ailesi):** iade ya da Düzenle sonrası kart 0'a iniyor; bağlı ve bağsız aynı, bakiye doğru.
3. **İadede kesilen taksit sırası farklı:** bağsız 300 → iade 300'de kartın sondan, bağlı 300 → iade 300'de baştan kesiliyor. Gecikmiş 200'e karşı 0. Eski kod da aynı.
4. **Vade Takip elle Borç Yaz kalemini göstermiyor:** kartsız caride de, eski kodda da aynı. Kapsam dışı.

## SONRAKİ SÜRÜME (2.5.1)
Çekli kolun kâhin denetimi (K3'te zaten yazılı). Yeni madde yok.

## DOĞRULANMADI
- Kapama defteri (invoice-settle) ile kuyruğun ayrışması: bağlı ödemenin fazlası defterde en eski serbest kaleme (ör. F2), kuyrukta en erken vadeye gidiyor. Bu, kararın "bağsız ödemedeki gibi" sözüyle aynı; bağsızda da var. Kullanıcıya görünen bir bakiye bozulması üretemedim (F2 iadesi bağsızla aynı, bakiye doğru).

## DENENMEYEN
- e2e / ekran ve iki oturumlu canlı yenileme: client kodu ve önbellek anahtarı değişmediği için ayrıca koşmadım.
- Hız: resmi ölçüm yapmadım. Büyük veride tam okuma kabaca yeni 244 / 232 sn, eski 234 / 254 sn; değişen yollarda öğe başına alt sorgu görmedim (kayıt anı haritası WeakMap ile girdi başına bir kez).
- İki şirket arası etkileşim (her şirket kendi verisinde, iki şirketlik büyük veriyle birlikte okundu).
- Mahsup ve Şüpheli payı alt durumları (S257 / S258 = C; bakiye bozulması görülmedi).
- Reddedilen istek izi: personel ve muhasebe zaten yetkili (200 + 1 satır); bu farkta yetki kodu yok.

## NOT DEFTERİ
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-izt4-a7e/`
- Taslak: `rapor-taslak.md`
- Betikler `betik/` altında: `probe.mjs`, `probe2.mjs`, `buyuk.mjs`, `v249.mjs`, `tablo.py`, `bfark.py`, `bfark2.py`, `sorgu.cjs`
- Ham çıktılar: senaryo `*.jsonl`, `tablo-utc.txt`, `tablo2-utc.txt`; büyük veri `b-*.jsonl`; v2.4.9 `v249-*.json`; eski kodda test koşusu `eski-test.txt`; yeni test koşusunun kanıtı `2026-11-22/` (kanit.mjs).
- Eski kod kopyası, temiz-100k kopyası ve v2.4.9 veri klasörü tam yollarıyla silindi. Boş disk 9,4 GB.
