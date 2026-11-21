# S231 küçük turu — RAPOR (ajan a5ab5fcddbbc37322; taban s223-uc = b169e197; dal ucu **9aa46eba**; son kod commit'i **270b3ad9**; PUSH YOK)

Yük 2,2 / 4 çekirdek, bellek boş 6 GB (kullanılabilir 11), disk boş 9,8 GB (08:49 UTC).

## Davranışta ne değişti
1. **Taksitler → Excel / Sheets'ten Yükle (S231 = A).**
   - Grup ve alt grup adı artık S228 sırasıyla bulunuyor: önce bugünkü karşılaştırma (NOCASE). O bulamazsa Türkçe harf katlamalı karşılaştırma devreye giriyor; tek grup çıkarsa o seçiliyor. İkisi de tek grup bulamazsa bugünkü gibi yeni grup açılıyor.
   - S231 örneği, v2.4.9'un gerçek kodunda: önce 'Elif Su' / 'Işık Servisi' 1.000, sonra 'ELİF SU' / 'IŞIK SERVİSİ' 1.000 yüklenince **2 grup, 2 cari, 2 kart** oluşuyor. 120 hesabına bu ikisinden 2.000 yazılıyor (testteki toplam 2.600; ek 400 + 200 başka iki kart).
   - Yeni kodda aynı örnek: **1 grup, 1 cari, 1 kart**. İkinci satır "Aynı adla açık kart var" diye atlanıyor, 120 hesabına yalnız 1.000 yazılıyor.
   - Ekranda (taban → yeni): Taksitler listesinde 4 kart / 2.800 TL → 3 kart / 1.800 TL. Kartların hepsi 'Işık Servisi' grubunda; bildirim "2 kart oluşturuldu, 2 grup tanımlandı" → "2 kart oluşturuldu".
2. **Cari Excel / Sheets'in grup kolonu** (ve "Grup kolonu yoksa hepsi bu gruba" alanı) aynı sırayla çalışıyor: 'IŞIL KAFE' yazımı var olan 'Işıl Kafe' grubuna gidiyor.
3. **Tablodan Aktar.**
   - Ön izleme: sayfa adı 'IŞIL KAFE' var olan 'Işıl Kafe' grubunu buluyor. Telefonsuz kişi için "eşleşen cari" gösteriyor (önceden "yeni cari").
   - Aktarım: yeni grup ve yeni cari açmıyor.
   - Geri Al: katlamayla bulunan var olan grubu SİLMİYOR; yalnız aktarımın gerçekten açtığı grupları geri alıyor.
   - Kenar durumda bir yan etki var, aşağıda ayrıca yazdım.
4. **Çek / Senet eşleme penceresinin metni:** "Keşideci adı aynı olan (büyük / küçük harf ve boşluk farkı sayılmaz) tek cari varsa evrak o cariye bağlanır." Kılavuzda bu anlatım yok, PDF'in yeniden üretilmesi gerekmedi.
5. **Değişmeyenler:** elle grup açma, grubu yeniden adlandırma (çakışma denetimi bugünkü gibi NOCASE), tek kart formu ve tek cari formu. Testle ve mutantla gösterildi. Var olan çift gruplar birleştirilmiyor.
6. **Çek / Senet içe aktarmasının hızı** S223 öncesine döndü (aşağıda). Hangi cariye bağlandığı S223 ile birebir aynı.

## Değişen dosyalar
Hepsi dosya sınırı içinde:
- `server/routes/plans.mjs`
  - `ensureGroup`'a isteğe bağlı 4. parametre eklendi; yeni `groupFinder`.
  - `resolveGroups`'a isteğe bağlı 3. parametre.
  - Taksit Excel'i bulucuyu kullanıyor.
- `server/routes/plan-transfer.mjs`: ön izlemedeki `groupExisting` ve aktarımın `groupId`'si.
- `server/routes/accounts.mjs`
  - cari Excel'in `ensure`'u.
  - Yeni `personIndexFor`.
- `server/routes/cheques.mjs`: keşideci adları önceden toplanıyor, `personIndexFor` kullanılıyor.
- `server/lib/names.mjs`: yalnız YENİ işlevler (`foldJoinedNames`, `foldedNameLookup`).
- `client/assets/hof-cheques.js`: yalnız pencere metni.
- Yeni testler:
  - `test/s231-grup-adi-turkce-250.test.mjs`
  - `test/s231-cek-pencere-metni-250.test.mjs`
  - `test/s231-cek-hiz-esdegerlik-250.test.mjs`
  - `test/s231-eski-surum-sinif-250.test.mjs`
  - `test/e2e/senaryo-s231-250.mjs`
- Kanıt `docs/kanit/2026-11-20/s231-*`; taslak `docs/kanit/2026-11-20/s231-rapor-taslak.md`.

## TARAMA
Tablo taslağın 1. bölümünde.
- **Kapsamda:** taksit Excel'inin grup ve alt grubu, cari Excel'in `ensure`'u, Tablodan Aktar'ın ön izlemesi ve aktarımı.
- **Değişmeyen:** elle grup açma (POST /plans/groups), yeniden adlandırma çakışması, tek kart ve tek cari formunun `resolveGroups`'u, Geri Al'ın grup silmesi, görüntü birleştirmeleri, istemci form alanları.

## Çek hızı: ölçülen neden ve düzeltme
Kaynak: profil-cek.mjs ve profil2.mjs; temiz-100k kopyası; cari ve taksit Excel'inden sonra 5.484 cari; çek 500, hepsi yeni ad.
- **Neden:** S223'ün ad haritası NOCASE'in bulamadığı ilk satırda bütün carileri satır satır okuyor (~3 ms). Her adı ayrı katlıyor (~2,3 ms) ve hepsini haritaya koyuyor (~1,5 ms). Sonuç: `matchName` 500 çağrıda ~10 ms; NOCASE sorgularının kendisi yalnız ~0,85 ms.
- **Denenip bırakılanlar:**
  - SQL'de daraltma (replace zinciri + GLOB): 16 ms, daha yavaş.
  - Düzeltme 1 (e32985e6): **ölçüm 1'de KÖTÜ** çıktı. Ayraç U+0000 seçilmişti; veri tabanı sürücüsü metni ilk U+0000'da kesiyor, bu yüzden her yükleme yedek yola düştü. Sonuç doğruydu, süre S223'ten de kötüydü. Test (3)'e "satır satır okuma 0" denetimi eklendi.
  - Düzeltme 2 (6f6aff4a): kimlik + ad metni ~400 bin karakter; **ölçüm 2'de çek 1,16 / 1,11, KÖTÜ**.
- **Düzeltme 3 (270b3ad9):**
  - `foldedNameLookup`: yalnız adlar U+001F ile tek metin halinde ve tek seferde katlanıyor. Haritaya yalnız yüklemenin keşideci adlarıyla aynı katlanan satırlar giriyor; onların carileri adla okunuyor. Boşluk düzeltmesi yalnız gerektiğinde koşuyor.
  - Aranmayan bir ad sorulursa ya da metnin parça sayısı tutmazsa `foldedNameIndex`'e (yedek yola) düşüyor.
  - Kurulum + 500 sorgu: 8,2 ms → 3,8 ms.
- **Grup kolonlu cari Excel'de** satır başına sorgu da kalktı: yalnız yüklemede açılan aday kimliğiyle yeniden okunuyor.

## HIZ TABLOSU — ölçüm 4, son kod (KABUL)
Temiz-100k taze kopya, özel kilit, c7b-aday / s223-uc / yeni dönüşümlü 6 tur. Koşu başı yükü 1,04–1,61, koşu sonu ≤ 2; geçersiz koşu 0. Değerler ms, en iyi / ortanca.

| Yol | c7b-aday | s223-uc | yeni | yeni ÷ c7b | olay döngüsü en çok (c7b / s223 / yeni) |
|---|---|---|---|---|---|
| Çek 500 | 74,8 / 80,7 | 84,3 / 89,0 | 77,3 / 82,2 | **1,03 / 1,02** | 78,7 / 117,1 / 83,1 |
| Cari Excel 2.000 | 306 / 328 | 317 / 337 | 319 / 330 | 1,04 / 1,01 | 351 / 340 / 342 |
| Taksit Excel 2.000 | 6.674 / 6.817 | 6.731 / 6.892 | 6.780 / 6.970 | 1,02 / 1,02 | 7.931 / 7.294 / 7.302 |
| Tablodan Aktar ön izleme | 157,6 / 165,6 | 123,5 / 135,1 | 122,8 / 128,9 | 0,78 / 0,78 | — |
| Tablodan Aktar aktarım | 1.398 / 1.424 | 1.332 / 1.398 | 1.284 / 1.360 | 0,92 / 0,96 | 1.483 / 1.540 / 1.549 |
| Cari Excel 2.000, grup kolonlu (yeni yol) | 312 / 336 | 321 / 326 | 324 / 336 | 1,04 / 1,00 | 430 / 352 / 397 |
| Taksit Excel 2.000, grup kolonlu (yeni yol) | 11.743 / 12.366 | 11.714 / 12.183 | 11.977 / 12.244 | 1,02 / 0,99 | 12.784 / 12.575 / 12.474 |

Ölçüt sağlandı: hiçbir yol c7b-aday'a göre en iyide ve ortancada %10'dan kötü değil.

Ölçüm 3 gürültülüydü (başka ajanların yükü vardı; s223'ün DEĞİŞMEMİŞ grup yolu bile +%14 çıktı). Bu yüzden 6 turla yeniden ölçtüm ve tablo betiğine koşu sonu yük denetimini ekledim. Ölçüm 1–4'ün hepsi `docs/kanit/2026-11-20/s231-hiz/olcum1..4` altında.

## Testlerin kırmızı nedenleri ve yeşilleri (iki TZ)
- **Grup testi** (12 parça):
  - Tabanda 8 kırmızı, hepsi beklenen nedenle: "yeni grup açıldı (çift grup 'IŞIK SERVİSİ'): rapor groups=1", "yeni grup açıldı: 4", Tablodan Aktar ön izlemesinde account `new`, "tek grup beklenirdi, açılan: 3" gibi.
  - (6) çift grup, (6b) S228 sırası, (8) kilitli dönem ve (11) elle form tabanda da yeşil. Bunlar bekçi; dişleri mutantlarla gösterildi.
- **Çek metni testi:** tabanda kırmızı (eski metin).
- **Eşdeğerlik testi:** tabanda 0/3 (işlevler yok).
- **Kabul D testi:** tabanda yalnız v2.4.9 doğrulaması geçiyor; G1–G4 kırmızı ("Aynı adla açık kart var" tek kalıyor, yeni grup açılıyor).
- **Son kodda:** yeni testler + S223'ün testleri + c7bt + names.test **55/55 UTC ve İstanbul**.

## Kabul A–G ve G2 (hepsi son kod 270b3ad9)
- **A:** kâhin-defter 187/187 (taban ve yeni, iki TZ); kâhin-cari 17.648/17.648 (yeni iki TZ; taban iki TZ zincir 3'te). Yapım aşaması listesi kendi kopyamda **0 kayıt**.
- **B:** muhasebe sürücüsünde taban = yeni (7.946 denetimde 7.750 geçti / 50 kırmızı / 146 atlandı; 50 kırmızı tabanın kendi satırları). gerileme.py **248/248 BİREBİR, FARKLI 0**.
- **C:** S223'ün testleri + c7bt yeşil (iki TZ). Ekran senaryosu senaryo-s223-250 yenide 26/0.
- **D (v2.4.9'un gerçek kodu):**
  - v2.4.9'da hata var: ikinci yüklemede created 1, groups 1; 2 grup, 2 Elif carisi; 120 = 2.600.
  - Aynı veride yeni kod, sınıf listesiyle: G1 tek aday büyük harf (kart atlanıyor, 'ılgaz hattı' doğru grupta); G2 v2.4.9'un çift grubunda birebir yazım kendi grubuna, iki adaylı yazım yeni grup; G3 alt grup; G4 cari Excel; G5 aday yok → yeni grup.
  - 120 hesabı +800; Mutabakat Testi temiz (kural farkı dışında). Sınıf listesi kalıcı testte: `test/s231-eski-surum-sinif-250.test.mjs`.
- **E:** yukarıdaki hız tablosu — GEÇTİ.
- **F:** Mutabakat Testi her yüklemeden sonra temiz. Bakiye yalnız grup varyantı satırlarında değişiyor; her biri testte 120 ve kart sayısıyla yazılı.
- **G (ekran):**
  - senaryo-s231-250 yenide 22/0, tabanda 14/8 (beklenen nedenlerle). Gerçek tıklama, Tab + Enter, insan hızında.
  - Ekran görüntülerine baktım: `docs/kanit/2026-11-20/s231-ekran/{yeni,taban}`.
    - Yenide Taksitler listesinde 3 kart, hepsi 'Işık Servisi' grubunda.
    - Tabanda ELİF SU ikinci kartı ve 'IŞIK SERVİSİ' / 'ışık servisi' grupları açılmış.
    - Çek penceresinde yeni cümle görünüyor.
- **G2:** komşular 57 dosya (`git grep` taraması; S223 listesi + grup / çek / ad dosyaları, liste kanıtta) **829/829 UTC ve İstanbul**.

## Mutantlar — 11/11 kırmızı
| Mutant | Yakalayan test |
|---|---|
| M1 grup katlamasını kaldır | 8 test |
| M2 S228 sırasını ters çevir | (6b) |
| M3 elle grup formunu katlamalı yap | (6), (11) |
| M4 aynı yüklemede açılan grubu haritaya ekleme | (7) |
| M5a çek önbelleği yanlış anahtar: aranan adların anahtarı | eşdeğerlik (2), (3) |
| M5b çek önbelleği yanlış anahtar: harita anahtarı | eşdeğerlik (2), (3) |
| M6 ayraç yanındaki boşluğu kırpma | eşdeğerlik (1), (2) |
| M7 parça sayısı denetimini kaldır | eşdeğerlik (2), (3) |
| M8 aranmayan adı boş sonuca gönder | eşdeğerlik (2) |
| M9 bulunan grubu Geri Al listesine koy | (9), (10) |
| M10 geri alınmış iç işlemin grubunu aday say | (8) |
| M11 boşluk düzeltmesini atla | eşdeğerlik (1), (2) |

Betik: `docs/kanit/2026-11-20/s231-mutant.py`.

## BAŞ MİMAR KARARI GEREKİYOR
1. **Dosya sınırı ↔ KAPSAM çelişkisi.** Görev metni `accounts.mjs` için "yalnız çek hızı / S223 ad yardımcıları; davranış aynen" diyor; aynı metnin KAPSAM satırı ise "cari Excel'in grup sütunu varsa o da" diyor. Cari Excel'in `ensure`'unu da bulucuya bağladım; değişiklik tek satır. Gerekçe: aksi halde cari Excel 'IŞIK SERVİSİ' grubunu ayrı açar ve sonraki telefonsuz taksit satırı çift cari açar. Geri almak tek satır.
2. **Tablodan Aktar Geri Al'ın kenar durumu.** Önceden ham adın NOCASE'i bulamayıp `ensureGroup`'un kırpılmış adla VAR OLAN grubu bulduğu durumda (baş / son boşluk) o var olan grup Geri Al listesine giriyordu. Grup kartsızsa Geri Al onu siliyordu (cariler içinde kalsa da). Şimdi listeye yalnız gerçekten açılan grup giriyor. Bu bir düzeltme, ama gözlenebilir davranış değişikliği; kayıt adları zaten kırpılmış geldiğinde fark yok.

KULLANICIYA SORULMALI: yok. Kararların söylemediği bir kişi / para eşleştirmesi çıkmadı.

## SONRAKİ SÜRÜME (2.5.1)
- Cari / taksit Excel'i ve Tablodan Aktar hâlâ S223'ün `personIndex`'ini kullanıyor; hız ölçütü geçtiği için dokunmadım. Aynı `foldedNameLookup` oralarda da uygulanabilir.
- Hız düzeneğinin gürültüsü: tek koşuluk ~75 ms'lik çek yolunda ±%15. 6 tur ve koşu sonu yük denetimi önerilir.
- Profil betikleri kanıtta duruyor (`s231-hiz/profil*.mjs`).

## DOĞRULANMADI
- 100 bin CARİLİ veride `personIndexFor`'un süresi ölçülmedi; ölçümdeki veride 5.484 cari vardı. Doğrusal ölçekleniyor (5.484 caride ~3,8 ms).

## DENENMEYEN
- Google Sheets kaynağı ayrıca (aynı uca gidiyor).
- İki şirket.
- Tablodan Aktar ekranı (ürün varsayılanında kapalı; API testi var).
- Cari Excel'in alt grup kolonu ayrıca (aynı `ensure`).
- Çekte "Bağlanan carilere de işle".
- Kilitli dönem yalnız taksit Excel'inde denendi.
- Tam `npm test` koşulmadı (görev metni yasaklıyor).

## CI listesine eklenecek
- `test/e2e/senaryo-s231-250.mjs`. `test/e2e/senaryo-s223-250.mjs` de henüz listede değil.

## Commit listesi (s223-uc..9aa46eba, 17 commit; yazar Claude, model adı yok)
- 97866b60, 73c5506f — nasıl bozulur listesi (cherry-pick 30c0638f) ve TARAMA
- bcb4f263 — S231 = A kodu + grup testi
- e6f82743 — çek penceresi metni
- e32985e6 — çek hızı 1 + testler + hız düzeneği
- 7ab911be — rapor taslağı
- 2f83e84c — test ön koşulu
- 73e055d8 — Kanıt
- db008537 — Kanıt (ölçüm 1 KÖTÜ)
- 6f6aff4a — çek hızı 2 + grup bulucu hızı
- 7ccd990e — rapor taslağı
- 4454e666 — Kanıt
- 270b3ad9 — çek hızı 3 (SON KOD)
- 339bab71 — Kanıt
- 3fd6724e — Kanıt (hız ölçümü 4 GEÇTİ)
- 9aa46eba — Kanıt (son kod kabul)

Dal ucu: **worktree-agent-a5ab5fcddbbc37322 = 9aa46eba**.

Temizlik: RAM kopyalarını (/dev/shm/s231-a5ab: eski, c7b, yeni, mut, sürücü çıktıları) zorlamadan kaldırdım. Not defteri: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/s231-a5ab`.

## Ana oturumun yeniden koşacağı komutlar
Hepsinde `HUKUK_LICENSE_URL=http://127.0.0.1:9`, paylaşılan kilit; eski kod = s223-uc kopyası, yeni testler eski kopyaya yalnız kopya olarak.
- **Testler, iki TZ:** `TZ=UTC|Europe/Istanbul node tools/kanit.mjs kos <ad> -- node --test test/s231-grup-adi-turkce-250.test.mjs test/s231-cek-pencere-metni-250.test.mjs test/s231-cek-hiz-esdegerlik-250.test.mjs test/s231-eski-surum-sinif-250.test.mjs test/s223-turkce-ad-eslesme-250.test.mjs test/s223-eski-surum-sinif-250.test.mjs test/c7bt-ayni-adli-excel-karti-250.test.mjs test/names.test.mjs`
- **Kâhinler:** `npm run test:kahin-cari` ve `npm run test:kahin-defter`, iki TZ.
- **Yapım aşaması:** `KAHIN_YAPIM_ASAMASI=<kopya> node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz`
- **Sürücü:** `node test/bagimsiz/muhasebe-surucu/kos.mjs --program <kök> --cikti <dizin>` (eski ve yeni), sonra `python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py <eski> <yeni>`
- **Hız:** `bash docs/kanit/2026-11-20/s231-hiz/hiz.sh <yeni kök> <çıktı> 6`. Betik /dev/shm/s231-a5ab/{c7b,eski} kopyalarını bekliyor; onları c7b-aday ve s223-uc'den yeniden açın. Tablo: `python3 -I docs/kanit/2026-11-20/s231-hiz/tablo.py <çıktı>`
- **Ekran:** `PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 node test/e2e/senaryo-s231-250.mjs`; eski kod için `DEPO=<eski kök>`.
- **Mutantlar:** `python3 -I docs/kanit/2026-11-20/s231-mutant.py <yeni kodun ayrı kopyası> <çıktı>`
- **Komşu listesi:** `docs/kanit/2026-11-20/s231-kanit/kod-6f6aff4a/komsu-listesi.txt`
