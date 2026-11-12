DAR KONTROL — Ç5-B KAPANIŞ (birleşim 8d6ea9c9; fark `8d6ea9c9^1..8d6ea9c9`) — RAPOR

Sonuç: YÜKSEK yok; 2 ORTA (biri GERİLEME), 4 DÜŞÜK, 3 KULLANICIYA SORULMALI. Düzeltme / commit / push yapılmadı (ağaçta yalnız izlenmeyen `node_modules` bağı).
Not defteri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7 (betikler `betik/`, ham çıktılar `kanit/`).
Ortam (bitişte): Yük 2,3 / 4 çekirdek, bellek boş 9 GB, disk boş 6,6 GB.

---

## GERİLEMELER

**G-1 (= ORTA-1) — 8d6ea9c9^1'e VE v2.4.9'a göre.** Stoktan veresiye satışla açılan kartın tutarı açılıştan sonra düzenlenince kart kendi satışını tanımıyor, carinin elle borcunu içine alıyor. Aynı kurgu: v2.4.9 ve ^1'de elle Borç 500 (vade ileri) ayrı kalem; yeni kodda o kalem Vade Takip'ten kayboluyor, Gecikmiş Borç 700 → 1.200.

Başka gerileme bulunmadı. ORTA-2 gerileme DEĞİL (^1'de de aynı sayı).

---

## BULGULAR

### ORTA-1 (GERİLEME) — satışla açılan kart "kendi satışını" tutar eşitliği ya da kayıt anı AYNI ise tanıyor; gerçek saatte ikisi de tutmuyor
- Dosya: `server/lib/obligation-queue.mjs:628–637` (`ownSaleOf`), `server/lib/accounts.mjs:101` (`coverGross`).
- Betik: `betik/satis-kart.mjs akan|duragan tutar800` → `kanit/sk-{yeni,once,v249}-{akan,duragan}.json`, 8 tekrar `kanit/sk-tekrar-*.json`; v2.4.9 gerçek veriyle `betik/goc.mjs` → `kanit/goc-{v249,once,yeni}.json` (sınıf G1).
- Kurgu (API, akan saat): elle Borç 500 (−50, vade +30) → stoktan veresiye satış 1.000 + 2 taksit (−20 / +10) → kart tutarı 1.000 → 800 (PUT /api/workspace/plans/:id — Tutarı Düzenle).

| | Gecikmiş Borç (cari kartı = liste = Vade Takip) | Vade Takip kalemleri | kural |
|---|---|---|---|
| v2.4.9 | (alan yok) | Borç 500 @19.11 ayrı + taksit 500, 300 | — |
| 8d6ea9c9^1 | 700 | cari 200 @05.09 + Borç 500 @19.11 + taksit 500, 300 | — |
| 8d6ea9c9, akan saat | **1.200** | cari **700** @05.09 + taksit 500, 300 (Borç 500 @19.11 YOK) | S120 |
| 8d6ea9c9, durağan test saati | 700 | ^1 ile aynı | S110-satis |

- 8 / 8 tekrarda S120 (satış ↔ kart kayıt anı 2 ms farklı; başka koşularda 0–1 ms de görüldü → sonuç zamanlamaya bağlı). v2.4.9 verisi güncellenince de aynı: ^1 700 → yeni 1.200. Bakiye değişmiyor (1.500).
- Kök neden: tanıma `newest.amount === card.coverGross || newest.recorded === card.at`. `coverGross` = BUGÜNKÜ tutar + fatura iadesi kesintisi; tutar düzenlenince eşitlik bozulur. Kayıt anı eşitliği yalnız durağan test saatinde tutar (ders 14 — testler bu yüzden yeşil). Tanınmayan kart elle kola (S120) düşer.
- Karar: S110 = A "stoktan satışta o satışı … 2.4.9'daki gibi".
- En küçük düzeltme önerisi: kartın AÇILIŞ tutarını denetim izinden al (`plan.created` yükünde `total` var — `server/routes/plans.mjs:1733`) ya da satış kartına kalıcı kaynak işareti; kayıt anı eşitliğine dayanma. Test: akan saatle Tutarı Düzenle + faturasız stok iadesi.
- Komşu (bulgu değil): stok iadesi 800 ile küçülen kart — yeni = v2.4.9 (taksit [500, 200], Borç kartın içinde), ^1'den farklı (gecikmiş 0 → 500); S110 "2.4.9'daki gibi" ile açıklanıyor.

### ORTA-2 — "kalemler toplamı = cari bakiyesi" tutmuyor; Gecikmiş Borç bakiyeyi aşıyor (S101 ön ödeme döngüsü 12 geçişte yakınsamıyor)
- Dosya: `server/lib/obligation-queue.mjs:223–229` (`runQueue`, `pass < 12`).
- Betik: `betik/sigma-bozan.mjs` (doğal kayıt sırası, akan saat) → `kanit/sigma-{yeni,once}.json`; bulan `betik/saf-rastgele.mjs`; API'de oynatan `betik/saf-oynat.mjs`, indirgeyen `betik/saf-indir.mjs`; kök neden izi `betik/gecis-izle.mjs`.
- Kurgu (hepsi 200, yönetici onayı gerektirmiyor; kayıt sırasıyla): stoktan veresiye satış 810 (−43) → Mevcut Borç kartı 810, Kayıt Tarihi eski, taksit 405 (−43) + 405 (−67) → Alacak Yaz 250 (−230) → kart tahsilatı 490 (−217) → fatura 960 (−5) → Borç Yaz 360 (−73) → bağsız tahsilat 450 (−69).
- Sonuç: cari bakiyesi **940**; Σ kalem **960**; Gecikmiş Borç **960** (cari kartı = liste); Vade Takip fatura 960; Mutabakat Testi "tamam". Beklenen 940. İki saat diliminde aynı.
- ^1'de de aynı (FARK 20) → gerileme değil; ama bu birleşim S101 dışlamasını kaldırıp "dışarıda bırakılan sınıf KALMADI" diyor (test/tyk-250.test.mjs:515–523) ve kullanıcının koşulu "değişmez bu durumlarda da tutar (tutmazsa hata)".
- Sıklık: kendi tohumlarımla 57 / 482.000 rastgele kartlı cari (`kanit/saf-22, saf-40, saf-70, saf-k8, saf-k10, saf-k13.json`). Depodaki değişmez testi 3 tohum × 200 cari → görmüyor. Geriye tarihli Alacak / kart tahsilatı gerekiyor; doğal tarihli iki varyantta fark 0.
- Kök neden (izle kanıtlandı): net görünümde ölçülen ön ödeme her geçişte 20 TL ilerliyor (90 → 110 → … → 330, 12. geçişte hâlâ değişiyor); döngü yakınsamadan bitince son ölçüm uygulanmıyor. Sınır 400 yapılınca denediğim 7 örneğin 7'sinde 15–27 geçişte yakınsıyor ve Σ = bakiye.
- En küçük düzeltme önerisi: yakınsayana dek sür (üst sınır kart / taksit sayısına bağlı), yakınsamazsa son ölçümü uygulayan güvenli kapanış; değişmez testine çok daha fazla tohum.

### DÜŞÜK-1 — karar (3) × taksite bağlanmamış kart tahsilatı: kilitli dönemde avansla kapanmış 2. taksit kilitten sonraki kart tahsilatıyla "Bağlı" kapanıyor
- `obligation-queue.mjs:569–580`; `betik/karar3.mjs D2_S99_kilit_kartTahsilati` → `kanit/karar3-yeni.json`.
- Avans 600 → taksitli fatura 600 (2 × 300) → kilit → kart tahsilatı 300: kapatanlar [Otomatik 300, **Bağlı 300**], "cari tahsilatıyla kapanan pay" 600 → 300. Bakiye (−300), gecikmiş (0), taksit kalanları (0 / 0) aynı.
- Neden: bağsız kart tahsilatında yalnız ilk geçişte ULAŞILAN taksit ölçülüyor. ^1'de net görünümde de vardı; fatura durumunda S99 istisnası kalkınca görünür oldu.
- Sakınca süzgeci: para / bakiye yanlış değil, yalnız kapatan gösterimi → DÜŞÜK.

### DÜŞÜK-2 — test dişi: 18 yeni mutanttan 10'u yaşadı (aşağıda)

### DÜŞÜK-3 — mutabakat motoru gevşetmesi dişini kaybetmiş (aşağıda; öneri kanıtlı; yalnız test)

### DÜŞÜK-4 — taksit tahsilatı formu kendi içinde çelişiyor (S129 turuna girdi)
Ekranda (`kanit/ekran-s118.json` + görüntüler `kanit/ekran-s118/`): açıklama "sıradaki 1. taksit ₺300,00 (40 gün gecikti)" derken aynı penceredeki satır "1. … Ödendi". Satırdaki ₺ düğmesi ve "Hangi Taksite" listesi kuyruk kalanına bakıyor (`client/assets/hof-plans.js:467, 786`); avansla kapanmış ama kartın kendi hesabında açık taksit seçilemiyor.

---

## KARAR TABLOSU
`betik/s95-98.mjs`, `karar1.mjs`, `karar2.mjs`, `karar3.mjs` (API; karar1 TZ=UTC ve Europe/Istanbul'da birebir aynı; hepsinde Mutabakat Testi tamam).

| Karar | Kararın örneği → programın sayısı | Uyuyor | Komşu / çakışma |
|---|---|---|---|
| S95 | satış 10.000 açık (vade +10), alış Ödendi, gecikmiş 0 | evet | tedarikçi simetrisi (D3): alış 10.000 açık, satış Ödendi — evet; × kilit (D1) → SORU-2 |
| S96 | tedarikçi avansı 700: gecikmiş = liste = Vade Takip = zil = 700; müşteriye 250 aynı | evet | — |
| S97 | iki yazım sırası: bakiye −300, Alacak Kalan 0, takvim boş | evet | — |
| S98 | avans 50 (gecikmiş) + Borç 100 açık | evet | — |
| S99 | B Ödendi (Otomatik 150 + 150), A 300 açık, Σ = bakiye 300 | evet | × S118 (C6): karta 600 → Bağlı 300 + 300, bakiye −400 — evet; × kilit → DÜŞÜK-1 |
| S101 | takvim / zil boş, gecikmiş 0, bakiye −200 | evet | kısmi avans + karta 200 + sil + Silinenler'den geri al (C7): simetrik — evet; × S95 (C5): Σ tutuyor |
| S102 | X 300 açık, Y 0, bakiye −600 | evet | — |
| S103 | alış Ödendi, bakiye −300, kalem yok | evet | — |
| S104 | Alacak 200 açık (vade +30), bakiye −400 | evet | — |
| S105 | iade 0, avans 250 | evet | — |
| S110 | elle: 3 × 300 + F 600, gecikmiş 900; stok: [500, 500] + Borç 500, gecikmiş 1.000 | evet | tutar düzenlenince → ORTA-1; elle kart + eşit stok satışı → SORU-1; karşı yönlü kalemle (D5) Σ tutuyor |
| S118 | öneri kartın kendi sıradaki taksiti + not; 701 → 409 plan-overpay, 700 → 200. Ekranda insan hızı + Tab: öneri 300,00, not "…500,00 TL'sini kapatıyor", 901 → "Kalanı Aşan Tutar" (kayıt 0), 600 → sorusuz (kayıt 1 / 600, bakiye −200) | evet | × S122 (C3): Σ tutuyor |
| S120 | kartta X 500 + Y 400; ayrı F 600 + Y 300; 600'lük örnek de | evet | × S128 (C4): S ve F ayrı; karta 400 → X 0, Y 400 — evet |
| S122 | karta 300 → X Kalan 200, Y 700 | evet | — |
| S126 | F açık 300, X Kalan 300, bakiye 600 | evet | kısmi ödenmiş F (D4): F 100, X 300 — evet; başka taksitli fatura varken → SORU-3 |
| S128 | S açığı 100, X Kalan 300, bakiye 400, kart kalanı 400, gecikmiş 50 her ekranda | evet | — |

Rastgele sıra, gerçek program (`betik/rastgele2.mjs`): 6 tohum (7301–7306) × ~275 işlem, UTC ve Europe/Istanbul dönüşümlü, akan saat + 3–7 gün dönümü; 32 işlem türü. Sorun 0 (önbellek = tek cari belleği = baştan kurulan; Σ kalem = bakiye; 0 ≤ gecikmiş ≤ max(0, bakiye); liste = kart; kart yazım yanıtı = hemen ardından GET, ~700 kart yazımı; her 40 işlemde Vade Takip gecikmişi + Mutabakat Testi). ORTA-2 sınıfını bu üretici görmedi (geriye tarih gerekiyor).

Her süzgeç (`betik/suzgec.mjs`, 9 karışık cari): cari listesi 6 bakiye × 3 tür seçeneğinin hepsinde satır = baştan kuyruk, Σ satır = toplam, "Gecikmiş Borcu Olan" = gecikmişi olanlar; Anlık Durum 3.100 = liste; zil 2.700 (ufuk dışı sözlü 400 hariç). Nakit akışı sayıları ve mobil özet ayrıca denenmedi (mobil aynı uçlara yönleniyor — `server/lib/mobile.mjs:99`).

---

## BELLEK GEÇERSİZ KILMA TABLOSU
`betik/bayat.mjs`, DURAĞAN saat → `kanit/bayat-yeni.json`. Her adımda önbellek = tek cari belleği = baştan kurulan; liste gecikmişi; kart GET taksit kalanları: 27 / 27 adım EŞİT, sorun 0.

Kod okuması: anahtar `total_changes | data_version | gün` (`routes/invoices.mjs:733, 1048–1065`); bellek örnek (şirket) başına kapanışta; işlem içinde okunmuyor / yazılmıyor.

| Yazım türü | Belleği düşüren | Denendi | Sonuç |
|---|---|---|---|
| gün dönümü, yazımsız | anahtardaki gün | evet (taksit bugün → gecikti 300) | eşit |
| gün dönümü + yazım | gün + total_changes | evet | eşit |
| kilit koy / ilerlet / kaldır | total_changes + kilit izi | evet | eşit |
| kilitten sonra bağlı tahsilat | total_changes | evet | eşit |
| satır sayısı değişmeyen düzeltme (tutar, vade, bağ kur / kaldır) | total_changes + iz kolonları | evet | eşit |
| carisi değişen kayıt | iki carinin izi | evet + rastgele 43 kez | eşit |
| kart aç / tahsilat / düzelt / sil | total_changes | evet + rastgele | eşit |
| Silinenler'den geri alma | total_changes | evet (kart hareketi); rastgele 38 kez | eşit |
| kart silme | total_changes | evet | eşit (geri alma 409 — kurgum) |
| toplu taksitlendirme | total_changes | evet | eşit |
| ikinci bağlantıdan yazım (tutar; taksit vadesi) | data_version | evet | eşit |
| iç içe 6 yazım + 6 okuma | — | evet | eşit |
| reddedilen yazım | — | evet (404 — kurgum) | eşit |
| cari silme / geri alma | accounts.deleted_at izi | 409 (kartı var) | DENENMEDİ |
| yedekten geri yükleme | kök şirkette yeniden açılış, öbüründe yeni örnek | yalnız kod + depodaki test | DENENMEDİ |
| şirket değişimi | örnek başına kapanış | yalnız kod | DENENMEDİ |
| Excel / Sheets toplu yükleme, kalıcı silme, ayar | total_changes | hayır | DENENMEDİ |

Not: kartın `import_id` kolonu izde yok ama yalnız INSERT'te yazılıyor (tarandı). Yetkisi kısıtlı kullanıcı: yazım yanıtı okumayla aynı işlevden; fazla alan görmedim (ayrıca koşmadım).

---

## İKİ TEST GEVŞETMESİ

**(a) `test/mutabakat/motor.mjs:435` (eşitlik → üst sınır) — dişini KAYBETMİŞ.** `betik/motor-mutant.sh` + `motor-mutant2.sh` → `kanit/motor-mutant*.out`, `kanit/mm-*.out`.

| Koşu (500 işlem, her işlemde doğrulama) | Çıkış |
|---|---|
| mutantsız + depodaki motor (tohum 7) | 0 |
| MUTANT (fatura durumunda taksitli faturanın 1. taksiti hep kapalı) + depodaki motor | **0 — yakalanmıyor** |
| aynı mutant + önerilen ek denetim | 1 (ilk işlemde: "açık 1199.99 < kartın KUYRUK kalanı 1439,98") |
| mutantsız + önerilen ek denetim (tohum 7 ve 11) | 0, 0 |

Mutant API'de görünür (`kanit/mm-dene-mutant.json`: fatura açığı 600, taksit kalanları 300 / 300 / 300).
- Gerekçe (S99) kararın zorunlu sonucu; ama "mutabakat modeli bu kararla güncellenir" yerine denetim gevşetilmiş.
- En küçük yol (kanıtlı): üst sınıra ek ALT SINIR — `açık ≥ min(kart GET items[].remaining toplamı, tryPayable)`. Sınırı: program içi tutarlılık (fatura durumu ↔ net görünüm); iki görünümü birden bozan hatayı görmez — onun için motorun bağımsız cari bakiyesine karşı "Σ açık kalem = bakiye" gerekir (ORTA-2'yi de o yakalardı; denenmedi).

**(b) `test/tyk-250.test.mjs:358` (sıralı liste → küme) — para açısından dişini kaybetmedi** (kalem → kalan çiftleri hâlâ birebir; kaybolan yalnız liste sırası). Baş mimar okumasına katılıyorum. İki not (`betik/esit-sira.mjs` → `kanit/esit-{yeni,once}.json`):
- Tarih + kayıt anı eşit kalemlerde girdi sırası parayı değiştiriyor — bu birleşimden ÖNCE de: iki eşit Borç 500 + tahsilat 500 → düz sırada "B açık", ters sırada "A açık" (^1'de aynı).
- S95 geri almasıyla YENİ yüz: aynı an iki Alacak 300 + tahsilat 700 → hangisinin açılacağı girdi sırasına bağlı (düz Y, ters X; ^1'de ikisi de kapalı).
Gerçek programda sıra defter sırasından (tarih, kayıt anı, rowid) geliyor; Silinenler'den dönen kaydın sırası DOĞRULANMADI.

Öbür beklenti değişiklikleri (bulgu-223, cari-vade-245, iade-geri-odeme-246, plans, tyk-kilit-taksitli, ux18, whatsapp-onizleme-olcek) karar numarasıyla açıklı; `skip` / `todo` / silinen `assert` yok. `test/e2e/senaryo-tyk-tur2a-250.mjs` yalnız ekleme (+176; E8–E12); senaryo-k8-230 değişmemiş.

---

## YENİ MUTANTLAR
`betik/mutant-kap.mjs` → `kanit/mutant-kap.out`. Taban: 268 test, 267 geçti, 0 kaldı, 1 atlandı (tyk-goc-249-250 — kopyamda git etiketi yok). 18 mutant: 8 öldü, **10 yaşadı**.

Yaşayanlar (eksik test):
- K1 — S101: kırpılan tahsilatsız kartın kararlılık koşulu
- K3 — S101: aynı para iki kartta "avansla ödenmiş" (advClaimed düşülmez)
- K5 — S110: en son stok satışı tutarı EŞİT olmasa da "kartın satışı"
- K6 — S110: stok iadesi / alış iadesi de "kartın satışı"
- K8 — S110 tetiği: öbür kartların açık taksitleri sayılmaz (SORU-3'ün sınırı)
- K22 — tek cari yolunda Excel / Tablodan Aktar kartı tanınmaz (kart ekranı ↔ liste)
- K24 — coverGross'a iade kesintisi eklenmez
- K25 — faturasız stok iadesi netleşmeyi geri almaz
- K28 — POS komisyon tahsili kaynaklı avans kalem değil
- K35 — faturalı Alış İadesi S105 önceliği almaz

Ölenler: K10, K14 (bellek anahtarında gün yok), K19 (S128 türe göre içine alma), K27 (silme yanıtı kartın kendi hesabı), K31, K32 (geçiş sınırı 2 → Σ ≠ bakiye; ORTA-2'nin aynası), K33 (S118 ownNext), K34.
K5 / K6 / K24 ORTA-1 ile aynı aile. K1 / K3 eşdeğer olabilir (DOĞRULANMADI).

---

## ESKİ SÜRÜM (v2.4.9 gerçek koduyla üretilmiş veri)
`betik/goc.mjs` → üçlü karşılaştırma `betik/goc-dok.py`.
- G1 satış kartı + Tutarı Düzenle → ORTA-1.
- G2 stok iadesiyle küçülen satış kartı: yeni = v2.4.9, ^1 farklı — S110.
- G8 değişmemiş satış kartı + elle borç: ^1 kart "Bitti", gecikmiş 1.500 → yeni gecikmiş 1.000 (taksit 500 + Borç 500) — S110.
- G7 elle kart + eşit stok satışı ve G9 Mevcut Borç + tahsilatlar: üç sürüm aynı.
- G4 Kartı Kapat: ^1 = yeni (bu farktan değil; aşağıda).

`test/tyk-fark-v249-250.test.mjs` fikstürünün (45 cari) KAPSAMADIĞI sınıflar: karşılıksız çek / senet; Şüpheli Alacak; Kartı Kapat; açılış bakiyesi / Excel bakiyeli kart; faturalı satış iadesi ve iade geri ödemesi; Mahsup Et; Silinenler; Tablodan Aktar; açık borç > kart iken tutarı düzenlenmiş / iadeyle küçülmüş satış kartı; kilit yalnız tek sınıfta ("P Kilitli"); çoğu sınıf "eksik / tam" ayrımı olmadan.

---

## S129 = A İÇİN ALAN / YER LİSTESİ (bugün kartın KENDİ hesabından)
Sunucu:
- `routes/plans.mjs` `shape` → `totals.paid / remaining / paidOut`, `items[].paid`. `withQueue` yalnız `items[].remaining / state`'i kuyruktan veriyor (:224–271).
- Taksitler listesi (:397–404): `totals.paid / remaining` kendi; AYNI yanıtta `totals.month` (Bu Ay Beklenen) ve `overdue` kuyruktan; sıralama `remaining` (:438).
- Taksit Listesi PDF satır ve özet (:484–490).
- Taksit ekstresi PDF ve makbuz (:1149–1160) `detail()` ile — satır "Ödenen / Kalan / Durum" da kartın kendi hesabı; ekrandaki satır Kalan / Durum ise kuyruktan → ekran ≠ PDF (`lib/plan-report.mjs:91, 134, 139, 209–213`).
- Rapor Merkezi: Taksit Listesi (`routes/report-center.mjs:2274–2281`), taksit vade raporu "Ödenen / Kalan" (:2901), aylık toplam (:2336).
- Cari kartının taksit özeti ve "Taksitten Kalan": `lib/accounts.mjs:84, 139`; `routes/accounts.mjs:319–327, 407`; Cari Listesi PDF / Excel (:1266, :1333).
- WhatsApp `routes/whatsapp.mjs:138–141` (kartın `next`'i — Ç5-C kararıyla birlikte).
- Mobil: `lib/mobile.mjs:99` → aynı /plans ucu.
- DEĞİŞMEMESİ gerekenler (kartın kendi hesabını okuyor): Mutabakat Testi `plans:totals` (`lib/integrity.mjs:446–450`, `lib/integrity-scope.mjs:596–600`); mutabakat motoru; K8 sınırı ve S118 = B (`ownNext`, `ownRemaining`). Alan adları ayrılmazsa bu denetimler kırılır.

İstemci:
- `hof-plans.js:401` (yüzde), :419 (liste satırı), :424 (liste göstergeleri), :467 ve :508 (taksit satırı "Ödenen" ve tablo toplamı), :504 (pencere göstergeleri), :792–807 (form), :864 ("Tahsilat kaydedildi. Kalan …").
- `hof-accounts.js:306, 315, 362, 400, 1363–1370` ("Taksite Yaz … Kalan").

---

## ÖLÇÜM VE HIZ GİRDİSİ
- **Soğuk ↔ ılık: ÖLÇÜLEMEDİ.** Özel ölçüm kilidi 17:14 ve 17:43'te doluydu (başka oturumun aday koşuları paylaşımlı tutuyordu), yük 2,6. Bekleme döngüsü kurulmadı. Betik hazır: `betik/olc-soguk.sh`, `olc-soguk.mjs`, `olc-hepsi.sh`.
- Sayaçlar (zamanlama değil; temiz 100 bin; `betik/hiz-sayac.mjs` → `kanit/hiz-sayac.json`): 1.484 cari, 8.798 Mevcut Borç kartı 848 caride. Bütün carilerin bir kez kurulması 40.620 motor geçişi: kartsız 636 cari 2.232 (cari başına 3,5), kartlı 848 cari **38.388 (cari başına 45)**. Ön ödeme geçişi 424 + kilit ölçümü 594 — toplamın %2,5'i. 96.844 kart olayının 76.012'sinde S110 / S120 dalı her seferinde kümeleri kuruyor; ölçüm yalnız 21.364'ünde gerekli.
- Yalnız motorun işlemci süresi (KABUL ÖLÇÜMÜ DEĞİL; yük 1,5–3,7; `betik/hiz-saf.mjs` → `kanit/hiz-saf.out`; en iyi ms):

| | hepsi | kartlı | kartsız |
|---|---|---|---|
| ^1 | 5.128 / 5.138 | 4.716 / 4.752 | 373 / 378 |
| yeni | 6.504 (öbür koşu 11.307 — gürültü) | 5.993 | 377 |
| yeni + üç tembel yama | 6.036 / 6.267 | 5.539 / 5.854 | 400–456 |

- Okuma: artışın (~+%27) tamamına yakını Mevcut Borç kartlı carilerde. Denediğim üç ucuz yama (ölçüm kümesinin ve S110 / S120 "taşınan borç" kümesinin yalnız gerekince kurulması; fatura durumunda karşı tarafta bağsız para yokken dizi kopyalanmaması — `betik/hiz-yama.py`) 267 / 267 testle eşdeğer ama kazanç küçük ve gürültü içinde (−4…−9 puan). Tek başına kabul koşulunu karşılayacağını GÖSTEREMEDİM.
- Baş mimarın kök neden cümlesine düzeltme: "ek geçiş" değil — geçiş sayısı aynı sınıfta, geçiş BAŞINA iş artmış. Asıl kaldıraç kartlı caride cari başına 45 geçiş (kart başına ön geçiş × iki görünüm). Ilık zilin +108 ms'sinin hangi adımdan geldiği ayrıştırılamadı.

---

## BAŞ MİMAR YORUMLARININ DEĞERLENDİRMESİ
- 12:09 (1) iz taramasının yeri "davranış / sayı değişmez": doğrulandı.
- 12:09 (4), 13:21 (5) iki gevşetme: (a) "test boşluğu" doğru ve mutantla kanıtlandı; (b) "dişini kaybetmedi" — katılıyorum, yukarıdaki iki notla.
- 12:09 (6), 13:21 (6) "bakiyeyi değiştiren alt durum çıkmadı / açık soru yok": bakiye değişmiyor; ama ORTA-2'de kalemler bakiyeden 20 fazla ve üç yeni okuma ayrışması var.
- Tasarım §13.2 "S126 / S128 kural zaten kuyrukta": karar örnekleri için doğru; S126'nın TETİĞİ başka taksitli fatura varken ^1'e göre değişti (SORU-3).
- Tasarım §12.5 "geçişlerin %90'ı 1, en çok 9": örneklem küçük; 15–27 geçiş isteyen girdiler var.
- 16:05 kök neden: yukarıdaki düzeltme.
- S110 "aynı kayıt anı da yeter (fikstür C)": gerçek saatte tutmuyor (ORTA-1).

---

## KULLANICIYA SORULMALI (iş listesi C / D'de arandı; üçü de yok; üçünde de bakiye iki okumada aynı)
**SORU-1 (S110 × S120; uç):** Taksitler'den ELLE açılan kartın tutarı, en son kaydedilen taksitsiz stok veresiye satışına eşitse kart hangisini taşır? Örnek: elle X 500 (vade +30) → stok satışı 500 (vadesiz) → elle kart 500.
- A: en son kaydedilen satışı (program bugün; v2.4.9 ile aynı) → gecikmiş 0.
- B: S120'nin harfi — tutarı eşit TEK elle borcu → gecikmiş 500 (kayıt sırası ters olunca program zaten bunu veriyor).
- C: Uç durum böyle kalsın (BİLİNEN SINIR).
- Bakiye 1.000. Öneri: A, ORTA-1'in düzeltmesiyle birlikte kartın kaynağı kalıcı tutulursa belirsizlik kalkar.

**SORU-2 (S95 × dönem kilidi; uç):** Kilitli dönemde netleşmiş karşı kalem, kilitten sonraki bağsız ödemeyle yeniden açılır mı? Örnek: Borç 1.000 → Alacak 300 (netleşir) → kilit → tahsilat 1.000.
- A: açılır (program; kilitli = kilitsiz) → takvimde "Ödenecek 300, gecikmiş".
- B: kilitli dönemdeki netleşme kalır → müşterinin avansı 300, takvim boş.
- C: Uç durum böyle kalsın.
- Bakiye −300. Öneri: C (S119 = C ile aynı aile).

**SORU-3 (S126 tetiği; uç; S131'in komşusu):** "Kart carinin BÜTÜN açık borcuna eşitse" — başka kartın / taksitli faturanın açık taksitleri "bütün açık borca" sayılır mı? Örnek: F 600 + X 300 + ayrıca taksitli fatura B 300; kart 900; karta 300.
- A: sayılır (program) → S120 kolu: X Kalan 0, F açık 600.
- B: sayılmaz → S126: F açık 300, X Kalan 300 (^1 bunu veriyordu).
- C: Uç durum böyle kalsın.
- Bakiye 900. Öneri: C.

---

## DOĞRULANMADI
- Toplu yol ↔ tek cari yolunda kart sırası farkı (`forAccount` aktif önce + kayıt anı ↔ `ledgerPlansByAccount` sırasız): aynı kayıt anlı, biri kapalı iki kartta kart ekranı ↔ liste ayrışabilir — üretilmedi.
- Silinenler'den dönen kaydın eşit kalemlerdeki sırası.
- K1 / K3'ün eşdeğer olup olmadığı.
- DÜŞÜK-1'in net görünümdeki kısmının ^1'de de aynı olduğu (yalnız kod okuması).
- Yetkisi kısıtlı kullanıcıya fazla veri (yalnız kod okuması).

## DENENMEYEN
- Soğuk / ılık ölçüm (ÖLÇÜLEMEDİ).
- Excel / Sheets'ten bakiyeli kart, Tablodan Aktar, faturadan taksit sonrası iade / iptal.
- Çek / senet yolları (karşılıksız, ciro, taksite sayma) gerçek programda.
- Tedarikçi kartı; kart iadesi × kilit.
- Yedekten geri yükleme, şirket değişimi, kalıcı silme, ayar değişikliği, cari silme / geri alma.
- Nakit akışı sayıları, PDF / Excel çıktıları, mobil özet, WhatsApp metni.
- Ekran senaryoları yeniden koşulmadı (ana oturum koştu); yalnız kendi S118 form yürüyüşüm. Taksit satırındaki ₺ düğmesinin önerisi ekrandan okunmadı (betiğim yanlış düğmeyi seçti).
- Gece yarısı zorlaması (gün dönümü sahte saatle denendi).

## KAPSAM DIŞI GÖZLEM (bu farktan değil; ^1'de de aynı)
- Vade Takip "Gecikmiş Tahsilat", vadesi geçmiş ama ileri tarihli Ödeme Sözü olan borcu saymıyor: cari kartı Gecikmiş Borç 400, Vade Takip'te "15 gün kaldı" (toplam 2.700 ↔ 3.100).
- v2.4.9'da kapatılmış kartın ödenmemiş taksitleri güncellemeden sonra "Ödendi / kalan 0" (v2.4.9: "Kapalı / 300"), kendi Kalan 600 — S129 turu aynı görünüme dokunacak.

---

## BIRAKILAN KLASÖRLER
- /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7/betik
- /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7/kanit (ekran görüntüleri `kanit/ekran-s118/`)
- /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7/goc (v2.4.9 verisi + iki kopyası, 5 MB)

Kod kopyaları (once, v249, mut, mut2) ve ölçüm kopyaları silindi; süren arka plan işim yok. `betik/kos.sh` "once" / "v249" için `…/dk-c5bkap-x7/once` ve `…/v249` yollarını bekler — yeniden koşmak için `git archive 8d6ea9c9^1 ':!docs' | tar -x -C <klasör>` + node_modules bağı, ya da dördüncü argümana tam yol.
En hızlı yeniden üretim: `ROOT=<kod kökü> node betik/sigma-bozan.mjs` (ORTA-2) ve `ROOT=<kod kökü> node betik/satis-kart.mjs akan tutar800` (ORTA-1).
