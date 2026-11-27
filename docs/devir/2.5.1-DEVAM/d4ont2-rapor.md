# 2.5.1 D4 ön koşulları — TUR 2 (Windows kırmızısı) raporu

Görev metni: `docs/devir/2.5.1-DEVAM/d4ont2-istem.txt`. Taban: `t251-d4on-t2-taban` = 1fc39558. Dal ucu: bu raporun commit'i (aşağıda "Commit listesi").
Ortam (rapor anı): yük 5,36 / 4 çekirdek (başka ajanların yükü; koşularım hafif, `flock -s` altında), bellek boş 0 GB / kullanılabilir 7 GB, disk boş 11 GB.

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
Devir yedeği henüz hiçbir ekrandan çağrılmıyor (D4 çağıracak); değişiklikler D4'ün kullanacağı `createDevirBackupFor` yolunda.
1. **Windows'ta uzun yollu devir yedeği** — önce: Devri Yenile / Devri Geri Al öncesi yedek (CI'nin geçici klasöründe) ve varsayılan kurulumda (`C:\DestekOfis`) şirket adı
   ~64 (Devri Geri Al), ~66 (Devri Yenile), 80 (Devir) karakteri bulunca yedek "unable to open database file" ile düşüyordu (HTTP kodu yok, İngilizce). Sonra: SQLite'ın açtığı yol 49–57 karakter kısa; 80 karakterlik
   şirket adında varsayılan kökte günlük yolu (Devir / Devri Yenile / Devri Geri Al) 260 / 274 / 276 → 211 / 218 / 219 karakter (Y1); CI'nin geçici klasöründe testlerin
   adıyla 260 / 262 → 204 / 205 (zorla üretme tablosu §1).
2. **Yazma hatası iletisi** — önce: `unable to open database file` (status yok). Sonra: 503, örnek (Devri Yenile):
   "Devir yedeği alınamadı: veri tabanının kopyası yedek klasöründe açılamadı (klasörün yolu çok uzun ya da klasöre yazma izni yok). Devri Yenile bu yedek olmadan yapılmaz;
   verilerinizde değişiklik olmadı. Şirket adı çok uzunsa Yönetim → Şirketler'den kısaltıp ya da programı daha kısa bir klasöre kurup yeniden deneyin." (`extra.code`
   `devir-backup-write`, `extra.cause` "ERR_SQLITE_ERROR 14 unable to open database file"). Disk dolu / dosya kullanımda / bilinmeyen için ayrı nedenler.
3. **Taşıma hatası iletisi** — önce: "Devir yedeği yazıldı ama son adına alınamadı (dosya sistemi hatası EXDEV). Yedek Devir Yedekleri listesinde “Yarım Kaldı” görünür; …"
   (iç kod iletide; kodsuz hatada İngilizce `error.message`). Sonra: "Devir yedeği yazıldı ama tamamlanamadı: yedek klasörü son adına alınamadı (dosya sistemi taşımaya izin
   vermedi). Devri Geri Al bu yedek tamamlanmadan yapılmaz; verilerinizde değişiklik olmadı. Birkaç dakika bekleyip yeniden deneyin. Yazılan yedek silinmedi: Yönetim → Yedekler →
   Devir Yedekleri'nde “Yarım Kaldı” olarak görünür." (kod yalnız `extra.cause`). Virüs tarayıcısı nedeninin metni aynen kaldı.
4. **İletide iş adı** etiketten: Devir / Devri Yenile / Devri Geri Al.
5. **Yönetim → Yedekler → Devir Yedekleri listesi**: değişmedi (çalışma klasörü `.vt` listede görünmez; Y2 + N7).
6. Windows'ta iki iç dosya taşıması (kopyanın geçici adından asıl adına; çalışma klasöründen yarım klasöre) geçici hatada yeniden denenir (önce: ilki tek deneme → EPERM'de
   İngilizce hata). Klasör taşınırken programın kendi okuma tutamağı artık kapalı (önce: son dosyanın akışı kapanmamıştı → Windows'ta ilk deneme EPERM'e düşebiliyordu).
Rutin / elle / güvenlik / göç öncesi yedeklerde DEĞİŞİKLİK YOK (`moveRetry` varsayılanı `false`, aynı `renameSync`).

## DEĞİŞEN DOSYALAR
- `server/lib/devir/devir-backups.mjs` (kısa çalışma klasörü, iki iletinin dört parçalı Türkçe biçimi, `writeFailure`, `operationOf`, liste süzgeci, özetin `close`'da dönmesi)
- `server/lib/backup.mjs` (YALNIZ `createBackup`'a `moveRetry` seçeneği — devir yedeğinin iç dosya taşıması; görev metnindeki dosya sınırı içinde)
- `test/devir-d4on-yol-251.test.mjs` (YENİ, Y1–Y5), `test/devir-d4on-yedek-tasima-251.test.mjs` (3. testin ileti beklentisi + baş yorum), `test/devir-d4on-251-mutasyon-t2.mjs` (YENİ, 10 mutant)
- Kanıt: `docs/kanit/2026-11-27/d4ont2-*` (iki zorla üretme betiği + ham çıktılar). Rapor: bu dosya.

## TARAMA (komşular — ders 10; `git grep` ile: createBackup / lib/backup.mjs / devir-backups / devir-yedekleri)
| Komşu | Neden | Sonuç (UTC / İstanbul) |
|---|---|---|
| backup, yedek-220, yedek-220-inceleme, yedek-denetim-221, geri-yukleme-uyari-244, drive-kaldirildi | `createBackup`'ın öbür yolları (değişmemeli) | 135/135 + 135/135 (toplu koşu) |
| devir-d2-yedek-250, devir-d2-bakim-250, devir-arsiv-wal-250, devir-d4on-belge-temizligi-251 | devir yedeği / listesi / doğrulaması | aynı koşuda |
| guvenilirlik-221-ariza / -bulgular / -goc | yedek arızası, göç öncesi yedek | aynı koşuda |
| sema-kapisi-bs7 (yedeğe yazan değişiklik — ders 10), platform-tasinabilirlik (ders 33), yazim-duzeni, lisans-servisi-izolasyonu (ders 30) | kaynak / şema denetimleri | aynı koşuda |
| test/e2e/senaryo-220-yedek.mjs | `lib/backup.mjs` komşusu (ekran) | KOŞULMADI (aşağıda DENENMEYEN) |
| test/bagimsiz/edm-sayac/program-surucu.mjs, test/guvenilirlik/*.mjs, devir-d2-hacim-250.mjs | sürücü / hacim betiği (test dosyası değil) | koşulmadı (değişen yolu varsayılanla çağırır) |
Kayıtlar: `d4ont2-komsu-utc` / `d4ont2-komsu-ist` GEÇTİ, 135/135, 0 başarısız / iptal / atlanan.

## YENİ / DEĞİŞEN TESTLER — kırmızı nedeni (eski kod, ayrı kopya `/dev/shm/d4ont2-ys/eski` = taban, yalnız yeni test dosyası girdi) + yeşil
| Test | Eski kodda kırmızı (okunan neden) | Yeni kod |
|---|---|---|
| Y1 yol uzunluğu (varsayılan kök + 80 karakterlik ad) | "günlük yolu 260 karakter (sınır 259; kopya 252)" — `devir-oncesi`'nde bile | yeşil |
| Y2 yazma hatası | "undefined unable to open database file · undefined !== 503" (CI #1115'in birebir iletisi) | yeşil |
| Y3 iç dosya taşımaları | "taşıma yeniden denenmeliydi: undefined EPERM: test: enjekte, rename" | yeşil |
| Y4 açık okuma tutamağı | "taşıma anında kapanmamış okuma akışı: ["secret.key"]" | yeşil |
| Y5 iletide iç kod yok | ileti "…son adına alınamadı (dosya sistemi hatası EXDEV)…" beklenen düzene uymadı | yeşil |
| tur 1 testi 3 (değişen beklenti) | (eski iletide `EXDEV` geçtiği için yeni beklentiyle kırmızı olur — Y5 aynı nedeni ayrıca gösterir) | yeşil |
Kayıtlar: `d4ont2-yol-taban-utc` / `-ist` BAŞARISIZ 0/5 (beş testin beşi, nedenler iki TZ'de aynı); `d4ont2-yol-yeni-utc` / `-ist` GEÇTİ 9/9 (yeni 5 + tur 1'in 4'ü).
Saat: testler `now` sabit (2026-11-02T10:00+03:00); yedek adları gerçek saatten (ms) — tarih hesabı yok, TZ'ye bağlı değil (iki TZ yeşil).

## KABUL KOŞULLARI (sayılar yanıt gövdesinden / diskten)
- Zorla üretme eski kod: 4 etiketten 2'si (testteki 2 ve 3) `status=undefined`, ileti "unable to open database file"; 2'si Tamam — CI #1115 ile birebir. Yeni kod: 4/4 Tamam.
- Y2: 503, `devir-backup-write`, yarım klasör 0, listede `.vt` 0. Y3: iç taşıma 3 deneme + çalışma klasöründen 3 deneme, yedek `tamam`, doğrulama `ok`. Y5: iki durumda 503 `devir-backup-move`,
  `cause` EXDEV / kodsuz iletinin kendisi, listede Yarım 1'er.
- Tur 1 testleri: 4/4 (test 2'de 12 deneme, ≥ 3 sn bekleme aynen).

## MUTANTLAR
- Tur 1 betiği AYNEN (`test/devir-d4on-251-mutasyon.mjs`, ayrı kopya `/dev/shm/d4ont2-ys/mut`): **11/11 YAKALANDI** (`d4ont2-mutasyon-t1`).
- Yeni betik (`test/devir-d4on-251-mutasyon-t2.mjs`): **10/10 YAKALANDI** (`d4ont2-mutasyon-t2`), her biri beklenen testte:
  N1 kopyayı yine yarım klasöre yaz → Y1; N2 / N10 iç taşıma tek deneme (devir-backups / backup.mjs) → Y3; N3 çalışma klasöründen taşıma tek deneme → Y3; N4 özet `end`'de → Y4;
  N5 yazma hatası olduğu gibi → Y2 ("undefined unable to open database file"); N6 taşıma iletisine kod sızar → Y5 + tur 1 test 3; N7 `.vt` listede → Y2; N8 açılamama nedeni genel iletiye → Y2;
  N9 iş adı hep "Devir" → Y2 / Y5.
(Hüküm sütunu kanit aracında "BELİRSİZ" — mutasyon betiği `# tests` özeti basmaz, tur 1'deki gibi; sonuç satırı ham çıktıda.)

## HIZ
Ölçülmedi: yük 5–7 / 4 çekirdek (başka ajanlar) → ders 52 gereği ölçüm geçersiz olurdu. Değişen yolun ek işi: aynı diskte bir dosya taşıma + çalışma klasörü yarat / sil + özetin
`close` olayını beklemesi (dosya başına µs düzeyi); VACUUM INTO / kopya / özet aynı. Ana oturum ölçer: `flock -x …/olcum.lock node test/devir-d2-hacim-250.mjs` (kalıcı devir yedeği
satırı + olay döngüsü en çok), taban ve dal ucunda aynı veriyle.

## KULLANICIYA SORULMALI
Yok (para / kapama / defter kuralına dokunulmadı).

## BAŞ MİMAR KARARI GEREKİYOR
1. **D4'ün Devri Geri Al'ı (geri yükleme) için kalan yol payı**: son adındaki kopyayı (`devir-yedekleri\<zaman>-<etiket>\destekofis-<kod>-<zaman>-<etiket>.sqlite`) geri yükleme
   `inspectBackup` ile SQLite'ta DOĞRUDAN açıyor. Varsayılan kökte 80 karakterlik adda bu yol 232 / 246 / 248 karakter (salt okunur açılış; günlük açılmaz) — sınırın altında ama pay 11 karakter;
   kurulum `C:\Program Files\DestekOfis` gibi daha derin bir klasördeyse aşar. Seçenekler: (A) D4, geri yüklemeden önce kopyayı kısa bir çalışma yoluna alıp oradan açar (öneri; devir
   yedeğinin adı / D2 sözleşmesi değişmez); (B) devir yedeğinin içindeki kopyanın adı kısaltılır (ör. etiketsiz) — D2 testindeki ad beklentisi ve bildirge `database` alanı değişir.
   Bu turda kodlanmadı (kapsam dışı; D4 tasarımına girdi olarak).
2. `backup.mjs`'e `moveRetry` seçeneği görev metninin dosya sınırı ("YALNIZ devir yedeğinin iç dosya taşıması") içinde eklendi; dar kontrolün DOĞRULANMADI maddesine karşılık.
   İstenmezse N10 / Y3'ün o yarısıyla birlikte geri alınabilir (öbür yedek yolları zaten aynı).

## SONRAKİ SÜRÜME (2.5.1 kuralı: programı / kullanıcıyı etkilemeyen)
- Rutin / elle / güvenlik yedeklerinin iç taşıması (`createBackup` → `renameSync`) Windows'ta antivirüs tutarsa yine tek deneme — bu turun kapsamı dışı (görev metni: başka yedek
  yolu değişmez). Bugüne kadar bu yollardan Windows kırmızısı görülmedi.
- `kanit.mjs` mutasyon betiklerini "BELİRSİZ" yazıyor (özet satırı yok) — araç yasak dosya.

## DOĞRULANMADI
- Windows'ta SQLite'ın günlük yolunu GERÇEKTEN 260'ta reddettiği bu ortamda koşulamadı; kanıt dolaylı ama birebir: iki düşen test tam olarak günlük yolu ≥ 260 olan iki etiket,
  geçen ikisi 246; ileti ve `status` birebir. CI'nin Windows koşucusunda uzun yol desteğinin (LongPathsEnabled) kapalı olduğu varsayımı bu sonuçtan çıkarıldı, okunmadı.
- Y2'nin Windows'ta "günlüğün yerinde klasör" durumunda da SQLITE_CANTOPEN (14) vereceği (SQLite'ın Windows sürücüsünde klasör denetimi var; CI görecek).
- Windows Node 22'nin CI #1115'teki sonucu (görev metninde "sürüyordu / bilinmiyor").

## DENENMEYEN
- Windows (bu ortamda yok) — **ana oturum: CI'de Windows Node 22 ve 24, İKİ koşu (ders 18, 48).** Windows'ta denetlenen: tur 1 testinin 2. ve 3. testi (uzun etiketli devir yedeği
  CI'nin derin geçici klasöründe GERÇEK SQLite ile — eski kodda düşen ön koşulun kendisi), Y1 (gerçek üç yedek + varsayılan köke çevrilmiş uzunluk), Y2 (gerçek SQLite açılamama →
  Türkçe 503), Y3 (iki iç taşıma; Windows'un gerçek geçici hataları da yalnız geçici türde kabul), Y4 (taşıma anında açık okuma akışı yok), Y5, tur 1 testi 4 (gerçek açık tutamak).
- `test/e2e/senaryo-220-yedek.mjs` (ekran; `lib/backup.mjs` komşusu): koşulmadı — değişiklik varsayılan yolda birebir aynı çağrı (`false ? … : renameSync`); yük yüksekti.
  Ana oturumun tam kapısında / CI'de koşar.
- Hız ölçümü (yukarıda). Tam `npm test` (görev gereği ana oturum).

## CI listesine eklenecek
Yok — yeni test `test/devir-d4on-yol-251.test.mjs` `npm test`'in düz `node --test` taramasına girer (ekran senaryosu açılmadı).

## Kılavuz metni önerisi (son adayda toplu)
"Devir yedeği alınamazsa: program nedenini yazar ve devri başlatmaz; verileriniz değişmez. Şirket adı çok uzunsa Yönetim → Şirketler'den kısaltın ya da birkaç dakika bekleyip yeniden
deneyin. Yarım kalan yedek Yönetim → Yedekler → Devir Yedekleri'nde “Yarım Kaldı” olarak görünür; silinmez."

## 0. NASIL BOZULUR + KÖK NEDEN HİPOTEZLERİ (koddan ÖNCE)

Olay: CI #1115 (1c903a36) Windows Node 24 — test 2 (`devri-yenile-oncesi-2026`) ve test 3 (`devri-geri-al-oncesi-2026`) `failure.status` = undefined,
`failure.message` = "unable to open database file". Test 1 (`devir-oncesi-2026`) ve test 4 (`devir-oncesi-2027`, GERÇEK açık tutamaklı) Windows'ta GEÇTİ.

"unable to open database file" SQLite'ın SQLITE_CANTOPEN iletisidir (HttpError değil → `status` yok). Bu iletiyi üretebilecek çağrılar (devir yedeği yolunda):
`createBackup` → `VACUUM INTO '<yarım klasör>/<ad>.sqlite.yaziliyor'` (hedef dosya + `-journal` günlüğü açılır), `writeBackupIdentity` (`new DatabaseSync` +
iki yazım; hatası yutulur), `copyUsageRows` (kullanım satırı varsa). Testin sahte `renameSync`'i SQLite iletisi ÜRETEMEZ (yalnız `fsError(<kod>)` atar).

Hipotezler ve Linux'ta zorla üretme yolu:
- H1 (YOL UZUNLUĞU — Windows MAX_PATH 260): devir yedeğinde veri tabanı kopyası `devir-yedekleri/<zaman>-<etiket>.yaziliyor/destekofis-<kod>-<zaman>-<etiket>.sqlite.yaziliyor`
  yoluna yazılır; zaman + etiket yolda İKİ KEZ geçer. SQLite'ın Windows sürücüsü dosyayı `\\?\` öneki olmadan açar → 260 karakteri (sondaki NUL dahil) aşan yol açılamaz.
  Uzun etiketlerde (`devri-yenile-oncesi`, `devri-geri-al-oncesi`) günlük dosyası (`-journal`) sınırı aşar, kısa etikette (`devir-oncesi`) aşmaz → TAM OLARAK test 2 / 3 düşer,
  test 1 / 4 geçer. Zorla üretme: (a) `path.win32` ile CI'nin geçici klasörü (`C:\Users\RUNNER~1\AppData\Local\Temp`) üzerinden her VACUUM INTO hedefinin ve günlüğünün
  Windows uzunluğu hesaplanır; (b) SQLite'ın günlüğü açamaması, hedefin `-journal` yoluna klasör konarak Linux'ta GERÇEK SQLite hatasıyla üretilir (yalnız Windows
  uzunluğu ≥ 260 olan etikette) → ileti ve `status` CI ile birebir mi.
- H2 (testin sahtesi iç dosya taşımasını yakalıyor; Windows yol ayırıcısı): `isMove` `path.basename(path.dirname(from)) === "devir-yedekleri"` — iç dosyanın üst klasörü
  `<ad>.yaziliyor` olduğundan iki platformda da eşleşmez; eşleşse bile sahte SQLite iletisi değil `EBUSY` / `EXDEV` atar → iletiyle ÇELİŞİR. Linux'ta `path.win32`
  biçimli yollarla `isMove` karşılaştırması koşulur (beklenen: iç dosya eşleşmez).
- H3 (taşınamayan klasördeki veri tabanı Windows'ta açık tutamak yüzünden açılamıyor): test 2 / 3'te taşıma hiç olmaz; ama SQLite iletisi taşımadan SONRA değil
  taşımadan ÖNCE (createBackup içinde) gelir — 503 yolu hiç çalışmaz (`status` undefined). Test 4 GERÇEK açık tutamakla Windows'ta geçti. Linux'ta: önceki testin
  klasöründe `openSync` ile açık tutamak bırakılıp sonraki yedek alınır (beklenen: etkisiz — her yedek kendi klasörüne yazar).
- H4 (tutamak kapanış gecikmesi — özet akışının `end`'den sonra kapanması): taşıma hatası üretir (EPERM), SQLite iletisi üretmez; test 1 / 4'te yeniden deneme
  zaten bunu karşılıyor. Linux'ta: özet sonrası gecikmeli kapanış öykünmesi gerekmez — iletiyle çelişir (DOĞRULANMADI olarak kalır, Windows'ta CI görür).

Beklenen gözlem (H1 doğruysa): Linux zorla üretmede etiket 2 / 3 → `undefined unable to open database file`, etiket 1 / 4 → yedek Tamam.
Ürün riski (H1 doğruysa): gerçek kurulumda kök `C:\DestekOfis\backups\` (22) + `<kod> - <ad>` (şirket adı 80 karaktere kadar) → şirket adı ~64 karakteri aşınca
(ör. "… Sanayi ve Ticaret Limited Şirketi") Windows'ta devir yedeği HİÇ alınamaz ve kullanıcıya İngilizce SQLite iletisi gider (DEVİR NEDEN DURDU kararına aykırı).

## 1. KÖK NEDEN (ders 6) — Linux'ta ZORLA üretildi

**H1 DOĞRULANDI (ürün hatası).** `createBackup` veri tabanı kopyasını yarım klasöre DOĞRUDAN yazıyordu:
`…\devir-yedekleri\<zaman>-<etiket>.yaziliyor\destekofis-<kod>-<zaman>-<etiket>.sqlite.yaziliyor` — zaman + etiket yolda İKİ KEZ geçiyor. SQLite VACUUM INTO
sırasında hedefin yanında `-journal` günlüğünü açıyor (strace: hedef açılır → `…sqlite.yaziliyor-journal` açılır → silinir; `docs/kanit/2026-11-27/d4ont2-zorla.mjs`).
SQLite'ın Windows sürücüsü yolu `\\?\` öneki olmadan açar → 260 karakteri (NUL dahil; en çok 259) aşan günlük açılamaz → `SQLITE_CANTOPEN` = "unable to open database file",
HttpError değil (`status` undefined) → kullanıcıya İngilizce ileti.

Zorla üretme (`d4ont2-zorla-taban`, eski kod; CI'nin geçici klasörü `C:\Users\RUNNER~1\AppData\Local\Temp` ile `path.win32` hesabı; günlük ≥ 260 ise günlüğün yerine klasör
konur → SQLite günlüğü Linux'ta da GERÇEKTEN açamaz):

| Etiket (testteki sıra) | Kopya / günlük (Windows uzunluğu) | Eski kod sonucu | CI #1115 Windows Node 24 |
|---|---|---|---|
| devir-oncesi-2026 (test 1) | 238 / 246 | Tamam | geçti |
| devri-yenile-oncesi-2026 (test 2) | 252 / **260** | `HATA status=undefined ileti="unable to open database file"` | **düştü, aynı ileti** |
| devri-geri-al-oncesi-2026 (test 3) | 254 / **262** | `HATA status=undefined ileti="unable to open database file"` | **düştü, aynı ileti** |
| devir-oncesi-2027 (test 4) | 238 / 246 | Tamam | geçti |

Sınır tam olarak testlerin arasından geçiyor: kopya dosyası (252) açılıyor, günlüğü (260) açılamıyor. Yeni kodda aynı dört etiket 189–197 / 197–205 → dördü de Tamam (`d4ont2-zorla-yeni`).
Linux'ta neden yeşildi: unix sürücüsünün sınırı ~504 karakter (ölçüldü: 500 açılıyor, 510 "unable to open database"); Windows'ta 260.

Öbür hipotezler:
- H2 (testin sahtesi / Windows yol ayırıcısı) ELENDİ: `path.win32` yollarıyla `isMove(klasör)=true`, `isMove(iç dosya)=false`, ileri eğik çizgide de `true`; sahte zaten SQLite iletisi üretemez.
- H3 (önceki yedekte açık tutamak) ELENDİ: ilk yedeğin kopyası açık tutulurken sonraki üç yedek etkilenmedi (yalnız uzunluk sınırını aşanlar düştü).
- H4 (özet akışının tutamağı `end`'den sonra kapanıyor) DOĞRULANDI ama bu kırmızının nedeni DEĞİL: eski kodda üç taşımanın üçünde de klasör taşınırken programın kendi okuma
  akışı (`secret.key`) kapanmamıştı (`close` olayı gelmemiş; Linux'ta `/proc/self/fd` o anda boş — işletim sistemi düzeyinde kapanış yarışlı). Windows'ta ilk taşıma denemesi
  EPERM alıp 50 ms sonra yeniden denenebiliyordu; düzeltildi (özet `close`'da döner), yeni kodda 3/3 kapanmamış akış 0 (`d4ont2-zorla-h4-taban` / `-yeni`).

ÜRÜN ETKİSİ (yalnız Windows): kurulumun varsayılan kökü `C:\DestekOfis\backups\` (22) + `<kod> - <ad>` (şirket adı 80 karaktere kadar). Eski kodda günlük yolu 80 karakterlik adda
`devir-oncesi` için bile 260 (Y1 kırmızısı); kabaca 64 karakteri aşan şirket adında (ör. "… Sanayi ve Ticaret Limited Şirketi …") ya da daha derin kurulum klasöründe
Devir / Devri Yenile / Devri Geri Al öncesi yedek HİÇ alınamaz, kullanıcı İngilizce SQLite iletisi görürdü. Devir 2.5.1'de henüz ekrana bağlı değil (D4 çağıracak) — müşteriye
ulaşmadan yakalandı.

## 2. DÜZELTME
- `server/lib/devir/devir-backups.mjs`: kopya KISA çalışma klasöründe (`devir-yedekleri\.vt\`) yazılır, sonra yarım klasöre taşınır (node:fs uzun yolu taşır; `renameWithRetry`).
  Kopyanın adı, içeriği, bildirgesi değişmedi (`destekofis-<kod>-<zaman>-<etiket>.sqlite`; D2 testi aynen geçer). `.vt` listede görünmez; boşalınca kaldırılır; 1 saatten eski kalıntısı
  sonraki yedekte silinir.
- Yazma hatası (VACUUM / kopya / özet) artık `503 devir-backup-write` + açık Türkçe ileti; iç kod / SQLite iletisi yalnız `extra.cause`'ta (DEVİR NEDEN DURDU).
- Taşıma hatası iletisi dört parçalı (ne oldu / neden / ne yapmalı / nereye), iç kod iletiden çıktı (`EXDEV` ve kodsuz hata → "dosya sistemi taşımaya izin vermedi"; kod `extra.cause`'ta).
- İleti iş adını etiketten alır: "Devir" / "Devri Yenile" / "Devri Geri Al".
- Özet (`hashFile`) okuma akışının tutamağı kapanınca (`close`) döner (H4).
- `server/lib/backup.mjs`: `createBackup`'a `moveRetry` seçeneği — YALNIZ devir yedeği verir; kopyanın geçici adından asıl adına taşınması (dar kontrolün DOĞRULANMADI maddesi:
  "`.sqlite.yaziliyor` → ad düz `renameSync`") yeniden denenir. Öbür yedek yolları (rutin, elle, güvenlik, göç öncesi) değişmedi: varsayılan `false` → aynı `renameSync`.
