# CI geçmişi: koşu 434–467 (ci.yml, dal `claude/kind-newton-fpmx3f`): başarısız işler

Hazırlanma: 10.10.2026. Kod değiştirilmedi, commit yapılmadı. Bütün çıktılar bu klasörde.

## 0. Yöntem, kapsam ve okunamayan kısım

- Kapsam: 34 koşu (434–467) var ve hepsi `failure`. Başarısız iş sayısı 72:
  - 68 Windows test işi (34 × Node 22, 34 × Node 24),
  - 2 ubuntu test işi (yalnız 442),
  - 2 uçtan uca işi (460, 465).
  - ubuntu test işleri 442 dışında her koşuda yeşil. e2e işi 460 ve 465 dışında yeşil. "Dağıtım paketi" işi `needs` yüzünden hep `skipped`.
- İş listesi `gh api …/runs/<id>/jobs` ile alındı (`jobids.tsv`: koşu, commit, iş kimliği, ad, başarısız adım). Başarısız adım her test işinde `Run npm test`, e2e işinde `Run npm run test:senaryo-banka-210` (460) ve `Run npm run test:senaryo-222` (465).
- Günlükler GitHub MCP `get_job_logs` ile okundu. Blob adresi (`productionresultssa*.blob.core.windows.net`) vekil sunucuda 403 verdi ve yeniden denenmedi.
- **MCP en çok son 5.000 satırı döndürüyor.** Bu sınırın her işe etkisi şöyle:
  - **Node 24 Windows/ubuntu işleri** spec biçiminde ve 2.506–3.425 satır. Hepsi **tamamen** okundu; sondaki `✖ failing tests:` listesi eksiksiz.
  - **e2e günlükleri** (1.517 ve 774 satır) **tamamen** okundu.
  - **Node 22 işleri** TAP biçiminde ve 10.864–14.044 satır; **yalnız son 5.000 satırı** okunabildi. Node 22, TTY olmayan çıktıda TAP raporlayıcısını kullanıyor; Node 24 her zaman spec. Okunan kısım, üst düzey testlerin yaklaşık %50–65'inden sonrası. Üç `banka-210-*` dosyası alfabetik olarak başta kaldığı için okunamayan kısımda.
  - Node 22 işlerinin listesi iki yoldan çıkarıldı: (a) okunan kısımda `not ok` taraması, (b) `# tests / # pass / # fail / # cancelled` sayılarının aynı koşunun Node 24 ikiziyle karşılaştırılması. Bu **dolaylı** bir kanıttır ve tablodaki ilgili satırlarda "dolaylı" diye işaretlidir.
- Dosyalar:
  - `raw/<koşu>-<iş>.log` ve `.json`: MCP'den gelen ham günlükler.
  - `raw/_uzunluk.tsv`: özgün ve okunan satır sayıları.
  - `ham/<koşu>-<iş>.txt`: her işin ham başarısız satırları (dosya:satır, test adı, hata mesajının ilk satırı).
  - `ayrisik.json`: ayrıştırılmış veri.
  - `../ci-araclar/` (`topla.sh`, `ayristir.py`, `tablo.py`): kullanılan betikler.
  - `../ci-dogrula/` (`once` = 8dfea5b, `sonra` = 53133a5): 442'nin yerel yeniden üretimi için `git archive` kopyaları.
- Ek kanıt olarak, düzeltmeden sonraki koşu **468 (d9b1044) Windows Node 24** günlüğü (`raw/468-114175890926.log`) tamamen okundu.

"**Üçlü**" bu belgede şu 38 testi (434'te 37) ifade eder: `banka-210-goc-zinciri` (14 test; 434'te 13), `banka-210-goc` (15 test), `banka-210-islem-no` (9 test). Satır numaraları test dosyaları düzenlendikçe kayıyor (ör. goc :282 → :287 → :289 → :290 → :292); testlerin kendisi aynı.

## 1. İş başına tablo

| koşu | commit | iş | # tests | # pass | # fail | başarısız test dosyaları (dosya:satır ×adet) |
|---|---|---|---:|---:|---:|---|
| 434 | e10f598 | win, Node 22 | 1301 | 1257 | 44 | **reasoning :109** — “200 bin satırda makul sürede biter”<br>**updater :199, :213, :238** — “daha önce başarısız olan sürüm atlanır; kurulum …”; “imzalı bildirge adresi (GitHub dışı kaynak) da d…”; “yayın etiketi ile bildirge sürümü uyuşmazsa veya…”<br>+ okunamayan baştaki 40 başarısız (37'si üçlü varsayılırsa **3'ünün kimliği bilinmiyor**) |
| 434 | e10f598 | win, Node 24 | 1301 | 1264 | 37 | banka-210-goc-zinciri :35×13<br>banka-210-goc :282×13, :386, :459<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :116, :132, :144 |
| 435 | 72f72a6 | win, Node 22 | 1421 | 1383 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 435 | 72f72a6 | win, Node 24 | 1421 | 1383 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :287×13, :391, :464<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 436 | 0c4aaa6 | win, Node 22 | 1421 | 1383 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 436 | 0c4aaa6 | win, Node 24 | 1421 | 1383 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :287×13, :391, :464<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 437 | f46f748 | win, Node 22 | 1463 | 1425 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 437 | f46f748 | win, Node 24 | 1463 | 1425 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :289×13, :393, :466<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 438 | b48462d | win, Node 22 | 1463 | 1425 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 438 | b48462d | win, Node 24 | 1463 | 1425 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :289×13, :393, :466<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 439 | b99dfc4 | win, Node 22 | 1528 | 1490 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 439 | b99dfc4 | win, Node 24 | 1528 | 1490 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :290×13, :394, :467<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 440 | c926ed5 | win, Node 22 | 1528 | 1490 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 440 | c926ed5 | win, Node 24 | 1528 | 1490 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :290×13, :394, :467<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 441 | 48a08f0 | win, Node 22 | 1528 | 1490 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 441 | 48a08f0 | win, Node 24 | 1528 | 1490 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :290×13, :394, :467<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 442 | 8dfea5b | ubuntu, Node 22 | 1538 | 1536 | 2 | okunan son 5.000 satırda yok; sayılar ubuntu Node 24 ile aynı → altin + gg-cari (dolaylı) |
| 442 | 8dfea5b | ubuntu, Node 24 | 1538 | 1536 | 2 | **banka-210-altin :182** — “v2.0.26'nın kendi koduyla üretilen veri (mutabak…”<br>**banka-210-gg-cari :39** — “rastgele mutabakat motoru (eşik 0: her cari SQL …” |
| 442 | 8dfea5b | win, Node 22 | 1538 | 1498 | 40 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → üçlü 38 + altin + gg-cari (dolaylı) |
| 442 | 8dfea5b | win, Node 24 | 1538 | 1498 | 40 | **banka-210-altin :182** — “v2.0.26'nın kendi koduyla üretilen veri (mutabak…”<br>**banka-210-gg-cari :39** — “rastgele mutabakat motoru (eşik 0: her cari SQL …”<br>banka-210-goc-zinciri :37×14<br>banka-210-goc :290×13, :394, :467<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 443 | 9c224a3 | win, Node 22 | 1592 | 1554 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 443 | 9c224a3 | win, Node 24 | 1592 | 1554 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 444 | b44d133 | win, Node 22 | 1598 | 1560 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 444 | b44d133 | win, Node 24 | 1598 | 1560 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 445 | 3c8c163 | win, Node 22 | 1598 | 1560 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 445 | 3c8c163 | win, Node 24 | 1598 | 1560 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 446 | 93bdb3a | win, Node 22 | 1630 | 1592 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 446 | 93bdb3a | win, Node 24 | 1630 | 1592 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 447 | 8fa8236 | win, Node 22 | 1646 | 1608 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 447 | 8fa8236 | win, Node 24 | 1646 | 1608 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 448 | 6fad463 | win, Node 22 | 1646 | 1608 | 38 | okunan son 5.000 satırda yok (launcher burada `ok`); # fail 38 = üçlü (dolaylı) |
| 448 | 6fad463 | win, Node 24 | 1646 | 1603 | 38 (+5 iptal) | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145<br>**launcher :25, :54, :63, :76, :85, :89** — “'-kesfet' ağdaki sunucuyu ofis adı ve kurulum ki…”; “'-kesfet-dosya' sonucu kurulum sihirbazının okuy…”; “Windows için derlenir (GUI alt sistemi)”; “bulunan sunucuyu kaydeder ve sonraki açılışta do…”; “istemci başlatıcısı (Go)”; “sunucu yoksa anlaşılır biçimde başarısız olur” |
| 449 | fc939d2 | win, Node 22 | 1646 | 1608 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 449 | fc939d2 | win, Node 24 | 1646 | 1608 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 450 | c65e68a | win, Node 22 | 1646 | 1608 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 450 | c65e68a | win, Node 24 | 1646 | 1608 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 451 | cd32ef9 | win, Node 22 | 1654 | 1616 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 451 | cd32ef9 | win, Node 24 | 1654 | 1616 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 452 | 042a0c5 | win, Node 22 | 1654 | 1616 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 452 | 042a0c5 | win, Node 24 | 1654 | 1616 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 453 | 604a873 | win, Node 22 | 1654 | 1616 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 453 | 604a873 | win, Node 24 | 1654 | 1616 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 454 | 6745636 | win, Node 22 | 1654 | 1616 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 454 | 6745636 | win, Node 24 | 1654 | 1616 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 455 | 19a5900 | win, Node 22 | 1654 | 1616 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 455 | 19a5900 | win, Node 24 | 1654 | 1616 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 456 | b937266 | win, Node 22 | 1654 | 1616 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 456 | b937266 | win, Node 24 | 1654 | 1616 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 457 | cdb3646 | win, Node 22 | 1672 | 1634 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 457 | cdb3646 | win, Node 24 | 1672 | 1634 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 458 | ab2cdfa | win, Node 22 | 1672 | 1634 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 458 | ab2cdfa | win, Node 24 | 1672 | 1634 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 459 | aa2520d | win, Node 22 | 1713 | 1675 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 459 | aa2520d | win, Node 24 | 1713 | 1675 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 460 | 825b198 | win, Node 22 | 1714 | 1676 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 460 | 825b198 | win, Node 24 | 1714 | 1676 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 460 | 825b198 | Uçtan uca (Chromium) | – | – | – | adım `test:senaryo-banka-210`: 275 denetim geçti, **23 başarısız** (ilk: adım 9b, `senaryo-banka-210.mjs:639` waitForSelector 30 sn zaman aşımı; adım 12–24b zincirleme) |
| 461 | e35615d | win, Node 22 | 1714 | 1676 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 461 | e35615d | win, Node 24 | 1714 | 1676 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 462 | 0beded4 | win, Node 22 | 1728 | 1690 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 462 | 0beded4 | win, Node 24 | 1728 | 1690 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 463 | 0603260 | win, Node 22 | 1728 | 1690 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 463 | 0603260 | win, Node 24 | 1728 | 1690 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 464 | feab2ae | win, Node 22 | 1728 | 1690 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 464 | feab2ae | win, Node 24 | 1728 | 1690 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 465 | ac19490 | win, Node 22 | 1728 | 1690 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 465 | ac19490 | win, Node 24 | 1728 | 1690 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 465 | ac19490 | Uçtan uca (Chromium) | – | – | – | adım `test:senaryo-222`: 55 geçti, **1 kaldı** (“Pencere bozulmaz…”: `senaryo-222.mjs:303` — kutuda "Müşteri 0", 0 satır, “Liste alınamadı”) |
| 466 | 9c3d013 | win, Node 22 | 1728 | 1690 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 466 | 9c3d013 | win, Node 24 | 1728 | 1690 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |
| 467 | 46ea34c | win, Node 22 | 1728 | 1690 | 38 | okunan son 5.000 satırda yok; sayılar Node 24 ikiziyle aynı → aynı üçlü (dolaylı) |
| 467 | 46ea34c | win, Node 24 | 1728 | 1690 | 38 | banka-210-goc-zinciri :37×14<br>banka-210-goc :292×13, :396, :469<br>banka-210-islem-no :63, :70, :78, :86, :93, :105, :117, :133, :145 |

"dolaylı" yazan satırlardaki liste günlükte görülmedi. Okunan son 5.000 satırda `not ok` yok, sayılar ikizle birebir aynı ve üçlünün hatası Node sürümüne bağlı değil. Liste buna dayanarak çıkarıldı.

## 2. Başarısız test dosyaları: ilk ve son kırılma, platform, hata türü

| test dosyası (testler) | ilk kırık | son kırık | kırık iş | Windows'a özgü mü | hata türü (ilk satır) | durum |
|---|---|---|---|---|---|---|
| `banka-210-goc-zinciri.test.mjs` :35→:37. Her `surum-*` fikstürü için bir test: 434'te 13, 435'ten itibaren 14 (`surum-2.0.26-turler` eklendi) | 434 / e10f598 (dosya 720a038 ile aynı push'ta eklendi) | 467 / 46ea34c | Win N24 34/34 doğrudan; Win N22 33/34 dolaylı (434 N22: bkz. 4. bölüm) | **Evet.** ubuntu'da 34 koşunun hiçbirinde kırılmadı | **Kütüphane yok / import(path.join):** `Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. On Windows, absolute paths must be valid file:// URLs` (s.57 `await import(path.join(ROOT,"server/lib/integrity.mjs"))`) | d9b1044 düzeltti (pathToFileURL). 468 Win N24'te ✔ |
| `banka-210-goc.test.mjs`: 13 × "surum-X: her şirket dosyası satır satır aynı…" (:282→:292) | 434 / e10f598 (720a038) | 467 | aynı | Evet | **Kütüphane yok:** `AssertionError: integrity.lockDigestOf yok`. `optional()` içinde `import(path.join)` başarısız olunca `undefined` dönüyor | d9b1044 |
| `banka-210-goc.test.mjs`: "yalnız ortak katmanda: 002'nin kullanıcı kopyası…" (:386→:396) | 434 | 467 | aynı | Evet | **Kütüphane yok:** `AssertionError: bank/grants.mjs migrateBankGrants yok` | d9b1044 |
| `banka-210-goc.test.mjs`: "v20 yarıda kalırsa…" (:459→:469, describe "göç ortasında kesinti (SIGKILL)") | 434 | 467 | aynı | Evet | **SIGKILL sinyali:** `süreç göç ortasında ölmeliydi (1 ) \| null !== 'SIGKILL'`. Windows'ta `spawnSync` sonucu `signal: null`, `status: 1` | d9b1044 (Windows'ta durum 1 ve "göç bitti" yoksa ölmüş sayılır). 468'de ✔ |
| `banka-210-islem-no.test.mjs`: 9 test (:63, :70, :78, :86, :93, :105, :116→117, :132→133, :144→145) | 434 / e10f598 (dosya bu commit'le eklendi) | 467 | aynı | Evet | **Kütüphane yok:** :63 `server/lib/bank/event-no.mjs yok`, kalan 8 `AssertionError: kütüphane yok` (`import(path.join(ROOT,"server/lib/bank/event-no.mjs"))`) | d9b1044. 468'de ✔ |
| `banka-210-altin.test.mjs:182` "v2.0.26'nın kendi koduyla üretilen veri (mutabakat motoru…)" | 442 / 8dfea5b | 442 | 4 iş: ubuntu N22, N24 ve Win N22, N24 (N22 dolaylı) | **Hayır, Linux'ta da** | **Gerçek hata (test tarafı), deterministik:** `Error: banka hesabı açılamadı: 404 {"ok":false,"error":"Endpoint bulunamadı."}` (`test/mutabakat/motor.mjs:184`) | 53133a5 (`bank: false`). 443'ten itibaren yeşil |
| `banka-210-gg-cari.test.mjs:39` "rastgele mutabakat motoru (eşik 0…)" | 442 / 8dfea5b | 442 | 4 iş (aynı) | **Hayır** | **Gerçek iddia farkı (model), deterministik:** `AssertionError: motor: her işlemde tutarlı`, ayrıntısı "işlem 400 (fatura-alis): Taksit kartı Müşteri 7 T5 … program 13085.18/0 · model 10760,39/0,00" | 53133a5 (modelde FIFO payı) |
| `launcher.test.mjs`: suite "istemci başlatıcısı (Go)" :25 (before kancası) ve 5 test (:54, :63, :76, :85, :89) | 448 / 6fad463 | 448 | yalnız Win N24 (aynı koşunun Win N22'sinde ✔) | **Evet (kararsız)** | **Ortam/port:** `Error: bind EACCES 127.0.0.1:61687`. 5 test `test did not finish before its parent and was cancelled` (`# cancelled 5`; `# fail`'e sayılmadı) | Düzeltilmedi. Diğer 67 Windows işinde ✔. Kararsızlık riski sürüyor |
| `reasoning.test.mjs:109` "200 bin satırda makul sürede biter" | 434 / e10f598 | 434 | yalnız Win N22 | Evet, bu koşuda (kararsız) | **Zaman/performans eşiği:** `'38792 ms'` (eşik 6.000 ms, s.118). İş 6.680 sn sürdü; diğer Windows işleri 707–1.538 sn | Diğer 67 Windows işinin hepsinde (spec'te `✔`, TAP'ın okunan kısmında `ok`) ve 468'de ✔ |
| `updater.test.mjs:199, :213, :238` (sahte GitHub ile güncelleyici) | 434 | 434 | yalnız Win N22 | Evet, bu koşuda (kararsız) | **Zaman aşımı/bağlantı:** :199 `The input did not match /imza/. Input: 'Güncelleme sunucusuna bağlanılamadı.'`; :213 ve :238 `'error' !== 'available'` | Diğer 67 Windows işinde ✔ (spec listesinde yok; TAP'ın okunan kısmında `ok`; sayılar üçlüye eşit) |
| **Kimliği bilinmeyen 3 test** | 434 | 434 | yalnız Win N22 | ? | Günlüğün okunamayan ilk 5.864 satırında: alfabetik ilk 54 dosya, `accounts-stock` … `guvenilirlik-221-ariza` | Sonraki 33 Win N22 işinde `# fail` üçlüyle tam eşit (442'de üçlü + 2), yani tekrarlamadı |
| e2e `test/e2e/senaryo-banka-210.mjs` (23 denetim) | 460 / 825b198 | 460 | Uçtan uca (Chromium), ubuntu | Hayır, Linux | **Zaman aşımı ve zincirleme:** adım 9b `page.waitForSelector: Timeout 30000ms` (s.639). Ardından 22 sonuç hatası | Kararsız. Aynı kod 461'de ✔ (3. bölüm) |
| e2e `test/e2e/senaryo-222.mjs:303` (1 denetim) | 465 / ac19490 | 465 | Uçtan uca, ubuntu | Hayır, Linux | **Yarış/zamanlama:** "liste ve arama kutusu yerinde": kutuda "Müşteri 0", **0 satır**, "Liste alınamadı: Sunucuya ulaşılamadı…" | Kararsız. Aynı kod 464 ve 466'da ✔ |

Hata türü kısaltmaları:
- "Kütüphane yok": `import(path.join(...))` Windows'ta `D:\…` yolu geçerli ESM adresi değil.
- "SIGKILL sinyali": Windows sinyal adını bildirmiyor.
- "Gerçek iddia farkı": deterministik.
- "Zaman aşımı/eşik": yavaş koşucu.
- "Ortam/port": Windows ayrılmış/dolu port.

## 3. Linux'ta kırılan 442 ve ekran işinin kırıldığı 460 ile 465

### 3a. Koşu 442 (8dfea5b): ubuntu Node 22/24 "# fail 2". Gerçek hata, düzeltildi; kararsız değil
- **Testler:** `banka-210-altin.test.mjs:182` ve `banka-210-gg-cari.test.mjs:39`. Aynı ikisi Windows'ta da üçlünün üstüne eklendi (Win `# fail 40` = 38 + 2). ubuntu N24 ile N22'nin sayıları aynı: 1538/1536/2.
- **Mesajlar:**
  - altin: `Error: banka hesabı açılamadı: 404 {"ok":false,"error":"Endpoint bulunamadı."}` (`runReconciliation`, `test/mutabakat/motor.mjs:184`).
  - gg-cari: `motor: her işlemde tutarlı`, ayrıntısı `işlem 400 (fatura-alis, 2026-10-09)`, `Taksit kartı Müşteri 7 T5 … program 13085.18/0 · model 10760,39/0,00`.
- **Neden:** 441 (48a08f0) ile 442 arasında giren **7b19038** ("mutabakat motoruna ve rastgele sıra testine banka işlemleri"). Bu commit yalnız test kodunu değiştirdi: `test/mutabakat/motor.mjs` +196 ve `test/guvenilirlik/rastgele.mjs`. Motor artık banka hesabı açıyor ve banka fişi kesiyor. Bunun iki sonucu oldu:
  - (a) altin testi motoru banka modülü olmayan **v2.0.26** koduna karşı koşuyor; v2.0.26 banka hesabı ucunu bilmediği için 404 dönüyor.
  - (b) banka işlemleri tohumlu rastgele sırayı değiştirdi; gg-cari (tohum 5, 400 işlem) 400. işlemde modelin bir açığına çarptı: iade sonrası kart kırpmasında FIFO payı.
- **Düzeltme:** 442 ile 443 arasındaki **53133a5** ("Mutabakat motoru: banka ekseni seçeneği ve iade sonrası kart kırpmasında FIFO payı"). Yalnız test kodunu değiştirdi: `test/banka-210-altin.test.mjs` `bank: false` ve `test/mutabakat/motor.mjs`. Commit mesajı: "program değişmedi". Arada `server/` ve `client/` dosyalarına dokunan 7 commit de var (bf241fe, 49ab804, 3ccb7e5, 4d6eefe, a6d58ea, 8c53e31, d100a9b). Yeşile dönüşün 53133a5'ten geldiği yerel olarak kanıtlandı.
- **Yerel yeniden üretim (kanıt):** Node 22.22.0, `../ci-dogrula/` içindeki `git archive` kopyalarıyla:
  - 8dfea5b'de `banka-210-gg-cari`: `ℹ fail 1`, **aynı mesaj** (işlem 400 fatura-alis, Müşteri 7 T5, program 13085.18 · model 10760,39; tarih yerelde 2026-10-10).
  - 8dfea5b'de `banka-210-altin` (`GIT_DIR` deponun `.git`'i): `ℹ fail 1`.
  - **53133a5'te ikisi de `ℹ fail 0`.**
- **Sonuç:** Deterministik bir test (model/koşum) hatası. 4 işin hepsinde aynı biçimde kırıldı, yerelde de tekrarlandı ve 53133a5 ile düzeldi. **Kararsız değil, ürün hatası değil.**

### 3b. Koşu 460 (825b198), adım `test:senaryo-banka-210`: kararsız
- Sonuç satırı: `BAŞARISIZ: 275 denetim geçti, 23 başarısız.` (`ham/460-114043723547.txt`)
- **İlk hata, adım 9b** ("Eski hareketleri aktar (ikinci şirkette)…"): `senaryo-banka-210.mjs:639`, `admin.waitForSelector('.hof-modal-backdrop.is-visible:last-of-type form [name="amount"]')` 30 sn içinde gelmedi. Test 05.10 tarihli 1.500 POS'u API'den girdikten sonra Eski Hareketler'i açıp **"Bankaya Geçmiş Say"**a ikinci kez basıyor; form açılmadı.
- **Zincirleme hatalar (12–24b):** adım 9b, şirket 001'e geri dönen son satırlardan (`/api/companies/select` ve `goto`) önce düştü. Bu yüzden 12–24b adımları **002 şirketinde** koştu. Orada "Ziraat" hesabı, 100.000 açılışlı ve 2.000 havalesi bağlanmış "Ana TL Hesabı". Bu yüzden şu hatalar çıktı:
  - `party_in 2000 → 102000`,
  - `Ziraat 99.869,50`,
  - `alt hesaplar: 102.01 102709 / 100709, 102.02 NaN`,
  - adım 15, 18, 19, 20, 22'de beklenen öğe yok (zaman aşımı),
  - adım 21 ve 23b'de `Cannot read properties of undefined (reading 'id')`.
  
  Kendi şirketini açan adımlar (24c ve sonrası, 26–40 Kabul) geçti.
- **Sonraki koşuda neden geçti:** 461 (e35615d) ile 825b198 arasındaki tek fark `CLAUDE.md` (`git diff --stat`: 1 dosya, +7). **Aynı kod 461'de e2e ✔.** Adım 9b'nin kodu 459'dan (aa2520d, e2e ✔) beri değişmedi. 459→460 arasında yalnız `client/assets/hof-bank.js` (transfer ekranı) ve testin 3b bölümü değişti; bu kod 461'de de var ve geçti. 455–467 arasındaki 13 e2e koşusunun 11'i ✔. → **Kararsız (flaky).**
- Olası mekanizma (kanıtlanmadı): API POST'unun canlı yenilemesi "Eski Hareketler" panelini `waitForSelector(reclass-bank)` ile `click` arasında yeniden çiziyor ve tık boşa gidiyor.
- Ayrıca bir test tasarımı zaafı var: adım düşünce şirket bağlamı geri alınmıyor ve tek hata 22 sonuç hatası üretiyor. Öneri: geri dönüş `finally` içinde yapılmalı; bu belgede yalnız öneri olarak duruyor.

### 3c. Koşu 465 (ac19490), adım `test:senaryo-222`: kararsız
- Sonuç: `Senaryo 2.0.22: 55 geçti, 1 kaldı.` Kalan denetim "Pencere bozulmaz…" adımı, `senaryo-222.mjs:303`. Beklenen: kutuda "Müşteri 0", 9 satır, hata yazısı yok. Gerçek: kutu doğru ama **0 satır** ve `Liste alınamadı: Sunucuya ulaşılamadı. Ağ bağlantısını kontrol edin. Yeniden Dene`.
- **Neden geçti / kanıt:**
  - 464 (feab2ae) → 465 arasında yalnız `docs/kilavuz/ekran-banka.mjs` (+308) ve `docs/kilavuz/ekran-cek.mjs` değişti; ikisi kılavuz ekran betiği.
  - 465 → 466 (9c3d013) arasında yalnız `CLAUDE.md` değişti.
  - **Ürün ve test kodu aynıyken 464 ve 466'da e2e ✔.** 464 ile 465 aynı dakikada (07:18 ve 07:19) koştu. → **Kararsız (flaky).**
- Olası mekanizma (kanıtlanmadı): test 9 satırı gördükten sonra bütün `GET /api/workspace/accounts` isteklerini kesen bir yönlendirme kuruyor (s.287–293). İstemcinin "Müşteri 0" için geciktirilmiş kendi arama isteği o an hâlâ uçuştaysa ya da sonra çıktıysa kesiliyor. Bu kullanıcının kendi araması sayıldığı için tasarım gereği hata yazısı ve boş liste gösteriliyor. Yarış testin zamanlamasında, ürün kodunda değil. Düzeltilmedi; risk sürüyor.

## 4. Windows'ta üçlü dışında kırılan test var mı? (en kritik)

**Kalıcı olarak: HAYIR.** Doğrudan okunan 34 Windows Node 24 işinin hepsinde ve dolaylı olarak 33 Windows Node 22 işinde **kalıcı** başarısızlar yalnız üçlüdür:
- `banka-210-goc-zinciri`: 14 test,
- `banka-210-goc`: 15 test,
- `banka-210-islem-no`: 9 test.

Hata sayısı tabloya göre:

| hata | adet (34 Win N24 işi) |
|---|---:|
| `ERR_UNSUPPORTED_ESM_URL_SCHEME` (goc-zinciri) | 475 = 13 + 14×33 |
| `integrity.lockDigestOf yok` (goc) | 442 = 13×34 |
| `migrateBankGrants yok` (goc) | 34 |
| SIGKILL (goc) | 34 |
| `kütüphane yok` (islem-no) | 272 = 8×34 |
| `event-no.mjs yok` (islem-no) | 34 |

**Geçici ya da Windows dışı olanlar:**
1. **434 Win Node 22 (e10f598)**, yavaş koşucu (6.680 sn; diğer Windows işleri 707–1.538 sn):
   - `reasoning.test.mjs:109` (38.792 ms > 6.000 ms),
   - `updater.test.mjs:199, :213, :238` ("Güncelleme sunucusuna bağlanılamadı" / `'error' ≠ 'available'`),
   - **kimliği bilinmeyen 3 test** (`# fail 44` = 37 üçlü + 4 görünen + 3; ilk 54 dosyadan birinde). Okunamayan baş kısımda kaldığı için kim oldukları bu araçla belirlenemedi.
   - Bu testler diğer 67 Windows işinin hepsinde ✔.
2. **448 Win Node 24 (6fad463):** `launcher.test.mjs` before kancası `bind EACCES 127.0.0.1:61687` ve 5 iptal. Aynı commit'in Win Node 22'sinde ve diğer 67 Windows işinde ✔. Kararsız ve düzeltilmedi.
   - Test, `listen(0)` ile aldığı TCP portunun numarasını UDP keşif yanıtlayıcısına da veriyor (`launcher.test.mjs:41–44`). Windows'ta o UDP portu ayrılmış ya da kullanımda olabilir.
3. **442 (8dfea5b):** `banka-210-altin`, `banka-210-gg-cari`. Windows'a özgü değil (Linux'ta da var); 53133a5 ile düzeldi (3a).

**Düzeltmeden sonra (d9b1044):**
- Koşu **468 Windows Node 24: `ℹ tests 1728 · pass 1728 · fail 0 · cancelled 0`** (günlük tamamı okundu). Önceden maskelenen gövdeler de ✔: `surum-2.0.26-zincir` göç zinciri, "v20 yarıda kalırsa…", "şirketlerin sayacı ayrı", "yalnız ortak katmanda…".
- Koşu 470 (d5f1b9a) Windows **Node 22: `# tests 1728 · # pass 1728 · # fail 0 · # cancelled 0`** (günlüğün son 28 satırı okundu). Aynı koşunun Windows Node 24 işi de `success`.
- Koşu 469 (35fb884) Windows Node 22 ve Node 24 `success` (API'deki iş sonucu; günlüğü okunmadı).
- Koşu 468'in Windows Node 22 işi bu yazı hazırlanırken hâlâ sürüyordu.
- Sonuç: düzeltmeden sonra Windows iki Node sürümünde de yeşil.

**Gizli atlama yok:**
- 72 işin hepsinde `skipped 0`, `todo 0`.
- 46ea34c'deki `test/*.test.mjs` dosyalarında `win32`'ye bağlı atlama yok; tek eşleşme `launcher.test.mjs:34`'te ikili dosya adı.

**Hâlâ açık kararsızlık riskleri:**
- `launcher.test.mjs` (Windows port).
- `reasoning.test.mjs:109`: 468 Win N24'te test 32 sn sürdü; ölçülen kısım 6 sn eşiğinin altında kaldı ama yavaş koşucuda yine düşebilir.
- `updater.test.mjs` (yavaş koşucu).
- e2e `senaryo-banka-210` adım 9b ve `senaryo-222:303`.
