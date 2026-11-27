# 2.5.1 D4 ön koşulları — TUR 2 (Windows kırmızısı) raporu (taslak, adım adım)

Görev metni: `docs/devir/2.5.1-DEVAM/d4ont2-istem.txt`. Taban: `t251-d4on-t2-taban` = 1fc39558.

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
