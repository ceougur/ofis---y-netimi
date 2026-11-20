# S223 küçük turu — ajan raporu (AYNEN; ajan a2b475536b68533c3)

S223 KÜÇÜK TURU (S223 = A + S228 = A): kod, testler ve kanıt bitti. Dal worktree-agent-a2b475536b68533c3, uç b169e197, taban c7b-aday = df7e93ca. PUSH YAPILMADI.

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
- **Cariler → Excel / Sheets'ten Yükle:** Var olan 'Hasan Işık' 0532 300 00 01 carisi için 'HASAN IŞIK' + aynı telefon satırı önce YENİ cari açıyordu (çift cari). Şimdi "Bu cari zaten var" ile atlanıyor (Güncelle kipinde var olan cari güncelleniyor). Cari No + ad yolunda da aynısı geçerli: 'C-77 ÇAĞRI ÖĞÜT' satırı 'Çağrı Öğüt' carisini buluyor. Telefonu farklı 'HASAN IŞIK' yine ayrı kişi sayılıp yeni cari açıyor. Telefonsuz ya da No'suz satır, 2.0.19 kuralı gereği yine yeni cari açıyor.
  - Ekran bildirimi önce "3 cari açıldı." (cari sayısı 6), şimdi "1 cari açıldı. 2 satır atlandı (Bu cari zaten var)." (cari sayısı 4).
- **Taksitler → Excel'den Yükle:** 'HASAN IŞIK' satırı önce yeni cari ve kart açıyordu, borç yeni cariye yazılıyordu. Şimdi kart var olan 'Hasan Işık' carisine bağlanıyor: 3.000 borç ona yazılıyor, defter 120 +3.000.
  - Aynı Excel ikinci kez yüklenince önce büyük harfli satır ikinci kartı ve ikinci borcu açıyordu. Şimdi "0 kart oluşturuldu. 2 satır atlandı (Aynı adla açık kart var)."
  - 'Şule Çakır' kartı varken 'ŞULE ÇAKIR' satırı da artık atlanıyor (önceden çift kart ve çift borç).
  - Boşluk farkı da aynı kişi sayılıyor: ' Ömer\t Çiftçi ' gibi yazımlar 'Ömer Çiftçi' ile eşleşiyor.
- **Çek / Senet portföy yükleme:** 'AHU ÖZTÜRK' keşidecisi önce bağlanmıyordu; şimdi 'Ahu Öztürk' carisine bağlanıyor.
  - Bildirim önce "2 evrak portföye alındı.", şimdi "2 evrak portföye alındı, 1 cariye bağlandı."
  - Önbellek hatası da düzeldi. Önceden aynı dosyada önce 'DENİZ IŞIK' gelince sonraki 'Deniz Işık' satırı YANLIŞ cariye ('DENİZ IŞIK') bağlanıyordu. Şimdi her yazım kendi carisine bağlanıyor. Yalnız post seçiliyse borç / alacak da yanlış cariye düşüyordu.
- **Tablodan Aktar (yalnız API; ürün varsayılanında kapalı, 410):** Ön izleme 'AHMET KOÇ' için önce "new" diyordu, şimdi "match: Ahmet Koç". Aktarım yeni cari açmıyor (accountsCreated 0). Geri Al cariyi silmiyor.
- **S228 (var olan çift cari 'Zeynep Kılıç' + 'ZEYNEP KILIÇ'):** Birebir yazım bugünkü carisine bağlanıyor, bu değişmedi. İki aday çıkan yazımda ('ZEYNEP  KILIÇ' gibi):
  - İki carinin de açık kartı varsa satır "Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin" ile atlanıyor. Önceden 3. cari ve kart açılıyordu. Bu, S228 karar metnindeki "açık kartı varsa satır atlanır" davranışı.
  - Kart yoksa bugünkü gibi yeni cari açılıyor.
- Var olan çift cariler birleştirilmedi. Göç, şema ya da dizin değişikliği yok.

## DEĞİŞEN DOSYALAR
- server/lib/names.mjs — yalnız YENİ işlevler:
  - `foldPersonName`: foldName ile aynı sonucu veriyor, bütün Unicode kod noktalarında test edildi. 100 bin adda 45 ms, foldName 355–518 ms.
  - `foldedNameIndex`: yükleme başına tek okuma, ilk sorulduğunda kuruluyor.
  - foldName değişmedi.
- server/routes/accounts.mjs:
  - matchExisting, matchPerson, planPerson, planDuplicate, createFromPlan isteğe bağlı index alıyor.
  - Yeni: personIndex, foldedCandidates (adayın güncel satırını okuyor; silinmiş, geri alınmış ya da adı değişmiş cari düşüyor), matchName.
- server/routes/plans.mjs: Excel yüklemesine ad haritası ve Türkçe katlamalı ikinci kart haritası eklendi. recordIndex'teki yerel katlama foldPersonName'e döndü (sonuç aynı).
- server/routes/plan-transfer.mjs: fold → foldPersonName; ön izleme ve aktarımda ad haritası.
- server/routes/cheques.mjs: findAccount → accounts.matchName; önbellek anahtarı artık adın kendisi.
- Testler:
  - YENİ test/s223-turkce-ad-eslesme-250.test.mjs (14 test)
  - YENİ test/s223-eski-surum-sinif-250.test.mjs (kabul D, KALICI)
  - YENİ test/e2e/senaryo-s223-250.mjs
  - test/c7bt-ayni-adli-excel-karti-250.test.mjs (11) BEKLENTİSİ DEĞİŞTİ (ders 28). 'ırmak İnce' / 'Irmak ince' artık aynı kişi; önceden ikinci kart açılıyordu.
- Kılavuz değişmedi.

## S228 = A SIRASI (kodda)
1. Önce bugünkü NOCASE karşılaştırması. Kesin TEK eşleşme varsa o cari. Birden çok varsa bugünkü şüpheli davranış.
2. Hiç eşleşme yoksa (telefon / grup süzgecinden SONRA) Türkçe katlamalı aday aranır. Tek aday varsa o cari, değilse şüpheli.
3. Yinelenen kart denetimi de aynı sırayla: NOCASE kartlarında sonuç "" ise yalnız Türkçe katlamada eşleşen kartlara bakılıyor.
- Bugün bağlanan satırın değişmediği testlerle gösterildi:
  - (6) çift caride birebir yazım bugünkü carisine;
  - (7) 'Irmak Yilmaz' ↔ 'IRMAK YILMAZ' NOCASE bağı korunuyor;
  - kabul D C2 / C5 / C9.

## TARAMA (tam tablo docs/kanit/2026-11-20/s223-rapor-taslak.md)
- **Kapsamda, değiştirildi:** matchExisting, matchPerson / planPerson / planDuplicate / createFromPlan, plans.mjs cardKey, cheques findAccount, plan-transfer matchPerson ve createFromPlan.
- **Zaten Türkçe katlıyordu, tek yardımcıya bağlandı (sonuç aynı):** plans.mjs recordIndex, plan-transfer bağsız kart ve aynı ad sayımı.
- **Kapsam dışı, değişmedi:**
  - Tek kart formu (POST /plans, cari seçilmeden; içe aktarma değil)
  - Grup adları NOCASE (plans.mjs 97 / 148, plan-transfer 218 / 430) — aşağıda soru var
  - Liste arama ve ORDER BY sıralamaları; ek alan ve tür etiketleri; çek seri no + banka adı
  - Kullanıcı / rol adları (auth, admin, app, mobile-remote, names nameConflict / resolveUserByName, access, workspace); stok ve fatura satırı adları
  - İstemcideki tek kart formu önerisi (HOF.normalize)

## TESTLER — kırmızı / yeşil
- **Yeni kod** (s223 + c7bt): UTC 25/25, Europe/Istanbul 25/25.
- **Taban c7b-aday** (ayrı kopya, yeni testlerle): her iki TZ'de 13/25, kırmızılar beklenen nedenle (ders 38):
  - (0) "foldPersonName yok"
  - (1) "yeni cari açıldı: 7 !== 1"
  - (2) C-77 + büyük harfli ad yeni cari açtı
  - (4) "kart var olan cariye bağlandı 0 !== 1"
  - (5) "çift kart: 1"
  - (6) 3. cari + kart açıldı
  - (8) "çift kart: 3"
  - (9) Oya Ünlü linked 0
  - (10) büyük harfli keşideci bağlanmadı; 'Deniz Işık' önbellekten YANLIŞ cariye
  - (11) Tablodan Aktar ön izleme "new"
  - (13) "telefonu tutan 'Ahmet Çakır' carisine 0 !== 1"
  - c7bt (11) "ırmak İnce" için ikinci kart açıldı
- (12) silinmiş cari tabanda da yeşil; yalnız mutant M7'nin bekçisi.
- Göreli tarih: sahte saat config.now 08.10.2026.

## KABUL A–G + G2
- **A kâhin-defter:** taban ve yeni, UTC ve İstanbul — 187 denetim, 0 fark, 0 yakalanmayan mutasyon. Dört koşu aynı.
- **B kâhin-cari:** taban ve yeni, iki TZ — 97 senaryo, 17.648 denetim, 0 fark, 7 bilinen sınır, 0 yapım aşaması.
  - KAHIN_YAPIM_ASAMASI ile kendi kopyamda yeniden üretilen liste: 0 kayıt (yeni 0, kapanan 0, değişen 0). Liste BOŞ.
- **C muhasebe sürücüsü:** taban 7.946 denetim / 7.750 geçti / 50 başarısız / 146 atlanan; yeni kod sayıları AYNI.
  - gerileme.py taban ↔ yeni: 248/248, "eski↔yeni program çıktısı BİREBİR".
  - 50 başarısız tabanın kendi satırları (sürücü bakımı 5'in konusu). Bu tur bir fark getirmedi.
- **D eski sürüm (v2.4.9, gerçek kod, bootVersion):**
  - v2.4.9'da hata var (elle beklenen): büyük harfli cari Excel 1 yeni cari açıyor (ŞÜKRÜ 2 cari), taksit Excel 1 yeni cari + kart (ZEYNEP 2 cari, borç 800 yeni cariye), çek bağlı 0.
  - Aynı veride yeni kod: 4/4 (UTC, İstanbul). Taban kodda 1/4 (yalnız v2.4.9'un kendi doğrulaması geçti).
- **E hız:** tablo aşağıda; ölçüt GEÇTİ.
- **F değişmezler:** Mutabakat Testi her yüklemeden sonra temiz ((4) (5) (6) (11), D, ekran). Bakiyeler yalnız harf varyantı satırlarında değişiyor; her biri testte yazılı (120 ve cari bakiyesi sayıyla).
- **G ekran** (senaryo-s223-250; gerçek tıklama, Tab + Enter, slowMo):
  - Yeni kod 26 geçti / 0 kaldı; taban 16 / 10 (beklenen nedenlerle).
  - Ekran görüntülerine baktım. Cari listesinde Hasan Işık 3.000 borçlu, HASAN IŞIK ayrı kişi; Taksitler'de tek kart; bildirimler doğru.
  - Tablodan Aktar'ın ekranda yolu yok (2.4.5'ten beri kapalı).
- **G2 komşular** (git grep ile seçilen 57 dosya; liste s223-komsu-listesi.txt): UTC 837/837, Europe/Istanbul 837/837.

## S228 SINIF TABLOSU (kabul D; beklenenler elle)
| Sınıf | Satır | Sonuç |
|---|---|---|
| C1 cari Excel, I/ı, tek aday | 'HASAN IŞIK' | zaten var |
| C2 cari Excel, Ş Ü Ö Ç, v2.4.9'un açtığı çift | birebir yazımlar | zaten var |
| C2 | 'Şükrü ÖZÇELİK' (iki aday) | yeni cari (bugünkü gibi) |
| C3 cari Excel, yok aday | | yeni cari |
| C4 taksit, I/ı, tek aday | 'HASAN IŞIK' | Hasan Işık'a, borç 600 ona |
| C5 taksit, çift | 'Zeynep Kılıç' | Zeynep Kılıç'a, 500 |
| C5 | 'ZEYNEP KILIÇ' | Aynı adla açık kart var |
| C5 | 'ZEYNEP  KILIÇ' | Aynı adlı birden çok kişi var (çift borç yok) |
| C6 taksit, boşluk + Ç Ö, tek aday | | Ömer Çiftçi'ye |
| C7 taksit, yok aday | | yeni cari + kart |
| C8 çek, tek aday | | bağlı |
| C9 çek, çift | birebir yazımlar | kendi carilerine |
| C9 | iki adaylı yazım | carisiz |
| C10 çek, yok aday | | carisiz |

Defter 120 +2.100; Mutabakat Testi temiz.

## MUTANTLAR (hepsi en az bir testte kırmızı)
| Mutant | Kırmızı testler |
|---|---|
| M1 katlama İngilizceye | 11 test |
| M2 çek / senette Türkçe katlama yok | (10) |
| M3 S228 sırası ters | (6) |
| M4 açılan cari haritaya eklenmez | (8) |
| M5 boşluk düzeltmesi yok | (0) (6) (8) |
| M6 yinelenen kart anahtarı eski katlamada | (4) (5) (6) (8), c7bt (11) |
| M7 silinmiş cari aday | (12) |

## HIZ (temiz-100k taze kopya, ÖZEL kilit, dönüşümlü × 3; ms)
Geçerli iş yükü: hepsi yeni ad, başlangıç yükü ≤ 1,26 / 4 çekirdek.

| Yol | taban en iyi / ortanca | yeni en iyi / ortanca | fark en iyi / ortanca | olay döngüsü en çok (taban / yeni) |
|---|---|---|---|---|
| Cari Excel 2.000 | 313 / 330 | 314 / 317 | +0,3 % / −4,2 % | 363 / 335 |
| Taksit Excel 2.000 | 6.815 / 6.922 | 6.581 / 7.082 | −3,4 % / +2,3 % | 7.327 / 7.114 |
| Çek 500 | 84,5 / 93,5 | 91,6 / 96,8 | +8,4 % / +3,5 % | 93 / 107 |
| Tablodan Aktar ön izleme | 153 / 155 | 125 / 126 | −18 % / −18 % | — |
| Tablodan Aktar aktarım | 1.386 / 1.423 | 1.366 / 1.541 | −1,5 % / +8,3 % | 1.423 / 1.617 |

- Hiçbir yol %10'dan kötü değil, ölçüt geçti.
- Not 1: Verideki 1.484 caride telefonlu, adı benzersiz cari bulunamadı. Bu yüzden 'karma' iş yükü de "hepsi yeni ad" oldu (Türkçe yedeğin en kötü durumu). Karma turu 1'in yükü 3,46 / 2,52 olduğu için o tur GEÇERSİZ; öbür karma turlarının sonuçları da ölçüte uyuyor.
- Not 2: 100.000 carili bir şirkette ad haritasının kurulması ayrı mikro ölçümde ~0,12 sn (SQL okuması hariç). Yükleme başına bir kez, NOCASE'in bulamadığı ilk satırda kuruluyor. Uçtan uca ölçülmedi.

## KULLANICIYA SORULMALI
1. **Grup adı büyük harfle yazılınca telefonsuz kişi yine çift açılıyor** (yeniden üretildi; ders 43 — borç hangi cariye):
   - Taksit Excel'de önce 'Elif Su' (telefonsuz, grup 'Işık Servisi') yüklendi. Sonra 'ELİF SU' (telefonsuz, grup 'IŞIK SERVİSİ') yüklenince yeni grup + yeni cari + kart açıldı: çift grup, çift cari, çift borç.
   - Neden: grup bulma (plans.mjs ensureGroup, plan-transfer groupExisting / groupId) NOCASE; telefonsuz eşleşme "aynı grup" istiyor. 'ŞUBE A' ↔ 'Şube A' sorun değil, I/ı ve İ/i farkı bozuyor.
   - A (öneri): içe aktarmalarda grup bulma da S228 sırasıyla Türkçe katlamalı olsun; ayrı küçük tur. ensureGroup elle grup açmada da kullanıldığı için komşuları geniş.
   - B: 2.5.1'e bırakılsın.
   - C: uç durum böyle kalsın (BİLİNEN SINIR).
   - Yaygın programlarda nasıl yapıldığına dair doğrulanmış kaynak okunmadı.
2. **S228'deki "bugünkü karşılaştırma bulamazsa" hangi düzeyde okunmalı** (kod okuma 1'i uyguluyor; test (13) bunu gösteriyor):
   - Örnek: Excel 'AHMET ÇAKIR' 0544 113 00 02; cariler 'AHMET ÇAKIR' (telefon …01, başka kişi) ve 'Ahmet Çakır' (…02).
   - Okuma 1 (uygulanan, öneri): eşleşme düzeyi. NOCASE adı buluyor ama telefon tutmuyor, Türkçe katlamada 'Ahmet Çakır' (…02) seçiliyor, borç ona yazılıyor.
   - Okuma 2: ad düzeyi. NOCASE bir ad bulduysa Türkçe katlamaya geçilmez; yeni cari açılır, borç yeni cariye yazılır. Kodda tek satırlık değişiklik.

## BAŞ MİMAR KARARI GEREKİYOR
- **Tek kart formu** ("+ Yeni Kart", cari seçilmeden; içe aktarma değil): createFromPlan'a ad haritası verilmiyor, bugünkü NOCASE kuralı geçiyor.
  - Öneri: böyle kalsın; karar yalnız içe aktarma yollarını sayıyor ve formda istemci zaten cari öneriyor.
- **Çek / Senet eşleme penceresinin metni** "Keşideci adı birebir aynı olan tek cari varsa…" artık tam doğru değil. Büyük / küçük harf (Türkçe), boşluk ve yazım farkı sayılmıyor (NOCASE de zaten büyük / küçük harfe bakmıyordu).
  - Metin client/assets/hof-cheques.js'te, dosya sınırımın dışında. Öneri: "aynı adlı (büyük / küçük harf farkı sayılmaz) tek cari".
- **Çok büyük cari sayısında harita kurulumu** (yukarıdaki mikro ölçüm). Öneri: şimdilik böyle kalsın. Gerekirse adı yalnız ASCII olan ve I/i içermeyen satırda haritayı hiç kurmamak düşünülebilir.

## SONRAKİ SÜRÜME (2.5.1)
- Hız düzeneğinin 'karma' iş yükü bu veride aday bulamadı (ölçüm nüansı).
- Kartın adı Excel'deki yazımla ('HASAN IŞIK') kalıyor, cari adı 'Hasan Işık'. Bu eski davranış (NOCASE eşleşmesinde de aynıydı; görünüm).
- Listelerin ada göre sıralaması (kapsam dışı).
- İngilizce klavyeyle harf değişimi ('IBRAHIM' ↔ 'İbrahim') kapsam dışı. S228 sırası bugünkü 'YILMAZ' ↔ 'Yilmaz' NOCASE bağını koruyor; Türkçe katlama bu farkı yeni eşleşme saymıyor.

## DOĞRULANMADI
- 100 bin carili bir şirkette uçtan uca hız (yalnız mikro ölçüm var).
- CI ve Windows koşusu (push yok).

## DENENMEYEN
- Tam npm test (yasak).
- Google Sheets kaynağıyla yükleme: aynı uç ve aynı matris; ayrı denenmedi.
- Tablodan Aktar ekranı (ürün varsayılanında kapalı).
- İki şirket ayrı testle denenmedi. Harita her istekte o şirketin store'undan kuruluyor; komşu testlerde şirket testleri var mı, bakılmadı.
- Kilitli dönem yalnız taksit Excel'de denendi (9); cari Excel ve çek için ayrı kilit testi yok.
- Çekte "Bağlanan carilere de işle" (post) seçeneği ekrandan denenmedi; API testlerinde de post kapalıydı.

## CI listesine eklenecek
- test/e2e/senaryo-s223-250.mjs
- Yeni .test.mjs dosyaları npm test'in kapsamına zaten giriyor. s223-eski-surum-sinif-250 v2.4.9 etiketi yoksa atlanıyor.

## COMMIT LİSTESİ (c7b-aday..HEAD)
8bf82730, 49e92fd5 (kod), 98d5b832, c0a58136, f95986e4, e299ca11, c4351980, 565b1572, 96aa4d5b, 97106ac8, 06130ed0, b169e197 (uç).
Kanıtlar docs/kanit/2026-11-20/s223-*; rapor taslağı s223-rapor-taslak.md.

## ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR (dal ucu b169e197, kendi kopyasında)
- `TZ=UTC` ve `TZ=Europe/Istanbul` ile: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/s223-turkce-ad-eslesme-250.test.mjs test/c7bt-ayni-adli-excel-karti-250.test.mjs test/s223-eski-surum-sinif-250.test.mjs` (beklenen 25 + 4)
- Eski kod kırmızısı: `git archive c7b-aday | tar -x` kopyasına yalnız yeni test dosyaları; beklenen 13/25 ve aynı nedenler. Kabul D'nin taban koşusu git worktree'de (etiket gerekir).
- `npm run test:kahin-cari` ve `npm run test:kahin-defter` (iki TZ)
- `node test/bagimsiz/muhasebe-surucu/kos.mjs --program <kök>` + `gerileme.py`
- Ekran: `PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 node test/e2e/senaryo-s223-250.mjs`; eski kod için `DEPO=<eski kök>`.
- Komşu listesi: docs/kanit/2026-11-20/s223-komsu-listesi.txt
- Hız düzeneği: docs/kanit/2026-11-20/s223-hiz/ (olc-s223.mjs, hiz.sh)

## ORTAM VE TEMİZLİK
- Not defteri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/s223-k1 (günlükler; taban kopyası silindi).
- v2.4.9 ve c7b-aday git worktree'leri zorlamadan kaldırıldı.
- Disk boş 7,7 GB.
- Çalışma ağacında yalnız izlenmeyen node_modules bağı var.
- Arka plan işim kalmadı.
