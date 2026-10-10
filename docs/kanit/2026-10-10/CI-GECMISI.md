# CI geçmişi denetimi — 08.10–10.10.2026 (dal `claude/kind-newton-fpmx3f`)

Hazırlanma: 10.10.2026. Kaynak: GitHub Actions API'si (iş sonuçları) ve iş günlükleri (GitHub MCP `get_job_logs`).
Ham başarısız satırlar `ci-ham/` altında (her başarısız iş için bir dosya; ilk satırında okunan/okunamayan satır sayısı).
Ayrıntılı tablo: `CI-GECMISI-434-467-HAM-OZET.md` (bir yardımcı ajan çıkardı; aşağıdaki sayıların bir kısmını ana oturum
günlükten yeniden okudu, hangileri olduğu yazılı).

## 1. Sonuç

| Dönem / koşu | Ne kırmızıydı | Kök neden | Durum |
|---|---|---|---|
| 434–467 (34 koşu, e10f598 … 46ea34c) | Windows Node 22 ve 24 `npm test`, her koşuda 38 test (434'te 37) | Test kodu: `banka-210-goc`, `banka-210-goc-zinciri`, `banka-210-islem-no` modülü `import(path.join(...))` ile yüklüyordu (Windows'ta geçersiz ESM adresi); göç kesintisi testi `signal === "SIGKILL"` bekliyordu (Windows'ta `null`, durum 1). Ürün kodunda bu kalıp yok. | DÜZELDİ d9b1044. Koşu 468: Windows Node 24 ve Node 22 **1728/1728, fail 0, skipped 0** (ana oturum günlükten okudu). |
| 442 (8dfea5b) | Linux + Windows 2 test (`banka-210-altin`, `banka-210-gg-cari`) | Test kodu (7b19038): mutabakat motoruna banka işlemleri eklenmişti; altın test banka modülü olmayan v2.0.26'ya karşı koşuyordu (404), tohumlu sıra değişince modelde FIFO payı açığı çıktı. Deterministik (yerelde 8dfea5b'de kırmızı, 53133a5'te yeşil yeniden üretildi — ajan). | DÜZELDİ 53133a5 (443'ten beri yeşil). |
| 448 (6fad463) | Windows Node 24 `launcher.test.mjs` hazırlığı: `bind EACCES`, 5 test iptal | Test, TCP için alınan rastgele portu UDP keşfi için de kullanıyordu; Windows'ta o numara UDP'de bağlanamayabiliyor. | 12ade2d (yeniden deneme) YETMEDİ: koşu 488 (622249b) Windows Node 24'te yine `bind EACCES`, 5 iptal. Asıl kök neden: Windows TCP portlarını sırayla verir; numara UDP'de dışlanmış bloğa düşünce yeniden deneme aynı blokta dolaşır. Düzeltme d2f9ddc: UDP portu UDP'nin kendi boş portundan (0), HTTP ayrı; keşif yanıtı HTTP portunu taşır. Windows CI'de doğrulama bekleniyor. |
| 434 Windows Node 22 (e10f598) | `reasoning.test.mjs:109` (38.792 ms > 6.000 ms eşik), `updater.test.mjs` 3 test, **kimliği okunamayan 3 test** | Koşucu olağan dışı yavaştı: iş 6.680 sn (öbür Windows işleri 707–1.538 sn). Eşikli/zaman aşımlı testler bilinçli. | Düzeltilmedi (bilinçli performans eşiği). Sonraki 67 Windows işinde tekrarlamadı. 3 testin kimliği bilinmiyor (bkz. 5). |
| 460 (825b198) e2e | `senaryo-banka-210` adım 9b (“Bankaya Geçmiş Say” formu 30 sn'de açılmadı) + 22 zincirleme hata | ÜRÜN HATASI: `hof-bank.js` reclassForm Eski Hareketler'e dönüşte eski görünüm önbelleğinden karar veriyordu; yenileme gelmeden basılınca POS varken “POS tahsilatı yok” diyordu (yeniden üretim: /legacy 100 ms gecikmede 8/10, 1500 ms'de 10/10 kırmızı). Test, adım düşünce şirketi geri almıyordu (22 zincirleme). | DÜZELDİ 8da9200 (ürün) + a714003 (test; şirket dönüşü finally'de). Ana oturum: a714003 eski istemcide 370/371 kırmızı, 8da9200 375/375. CI 503 (13ac319) Doğrulama Kapısı YEŞİL. |
| 465 (ac19490) ve 5a7d903 e2e | `senaryo-222.mjs:303` (kutuda “Müşteri 0”, 0 satır, “Liste alınamadı”) | TEST YARIŞI (ürün hatası değil): arama kutusu yazmayı 250 ms bekleyip yükler (`hof-accounts.js` onInput); o arada gelen arka plan yenilemesi aynı aramayla 9 satırı önce çizer, test "9 satır göründü" diye ağı keser, gecikmeli KULLANICI araması düşer → ürün kuralı gereği "Liste alınamadı" (`HOF.listPending`). Ayrıca CPU ×6'da öğe tutamacıyla tıklama "not attached to the DOM" (ayrı test hatası). | DÜZELDİ (yalnız test) 8f6a8f8 + 25645d2, birleşme ed02107. Ana oturum: `senaryo-222-yaris.mjs` MODE=forced CPU=1 eski bekleme 10'da 9 kırmızı, yeni bekleme 10/10 yeşil, ön koşul her denemede oluştu (`ana-oturum-s222/`). CI 509 (a8fc5c4): Doğrulama Kapısı GEÇTİ, senaryo-222 56/56, dört platform 1770/1770 (kapı günlüğünden okundu). |
| 517 (fecd2a2) | Dört platform 1885/1886 YEŞİL (Windows Node 22 ve 24 dahil — yol ayırıcısı düzeltmesi tuttu, 1. Windows koşusu); e2e 13 kayıt GEÇTİ (senaryo-banka-210 386/386, 210b 63/63). Doğrulama Kapısı GEÇMEDİ: her platformda 1 test atlandı | Eksik test dalından gelen `todo` test (Nakit Akış K10 başlangıcı, raporlar-210-banka:800). Kapının "atlanan test yok" kuralı doğru çalıştı — doğrulanmamış iddia yeşil sayılmaz. | Kapı GEVŞETİLMEDİ; Nakit Akış K10 düzeltmesi (T4) todo'yu kaldıracak. |
| 515 (c7a0ccf) ve 516 (00ce6d7) | Windows Node 24 (515) ve Node 22 (516): `banka-210-post-statik.test.mjs:151` — eksik test dalından gelen yeni statik test `path.relative` sonucunu `server/routes/cheques.mjs` ile karşılaştırıyordu; Windows'ta `server\\routes\\cheques.mjs` | TEST KODU (yalnız Windows). Ajan "npm test geçti" demişti (yalnız Linux) — ders 1 yine. Başarısız test adı, 516'da kanıt aracının yeni "başarısız testler" listesinden kısa günlükte okundu. | Düzeltme: yol ayırıcısı çevrilir; taşınabilirlik statik testine 4. kural (`path.relative` alanına çevrilmeden atanmaz) — kural Linux'ta bu satırı kırmızıyla yakaladı. Windows CI doğrulaması bekleniyor (ders 18: en az iki koşu). |
| 514 (85a7b50, yalnız CLAUDE.md) | Windows Node 22: `supervisor.test.mjs:139` "servis yöneticisi zorla kapatılınca uygulama da kapanır" — EBUSY unlink destekofis.sqlite, 15,3 sn (yeşil koşularda ~1,2 sn); aynı commit'in Windows Node 24'ü ve önceki commit'ler yeşil | KÖK NEDEN BİLİNMİYOR: finally'deki rmSync, açık uygulama sürecinin kilidiyle EBUSY attı ve try'daki asıl hatayı (15 sn'lik bir bekleme mi doldu?) gizledi; günlükte yalnız EBUSY var (başarısız test adı yardımcı ajanın okuduğu son 5.000 satırdan). Ana oturum 30 dk okumadı (ders 21). | Test asıl hatayı gösterecek biçimde değişti (adımlı hata + çıktı, temizlik önce süreci kapatır, silme yeniden denenir, temizlik hatası ezmez); kanıt aracı başarısız testleri çıktının sonuna yazar. Kök neden ancak bir sonraki kırmızıda görülecek; AÇIK. |
| 474 (180a8a5) | Windows Node 22/24: kanıt aracının kendi testi, 3 test | `tools/kanit.mjs` komutu Windows'ta `shell: true` ile çalıştırıyordu; boşluklu argüman kaçışsız bölündü (Node DEP0190). Linux'ta 33/33 geçiyordu. **Doğrulama Kapısı ilk koşusunda bunu yakaladı: GEÇMEDİ.** | DÜZELDİ 093d0d6. Koşu 481: **Doğrulama Kapısı GEÇTİ** — dört platform 1768/1768, atlanan 0, 12 e2e senaryosu. |

## 2. Ajan raporları ↔ CI (çelişkiler)

KANIT KURALI'na göre çelişki = BAŞARISIZ. Aşağıdaki “geçti” beyanları yerel Linux koşusuna dayanıyordu; aynı commit'lerde CI'nin
Windows işi kırmızıydı ve kimse okumadı. Beyanlar CLAUDE.md'deki durum satırlarından, CI sonuçları API'den.

| Beyan (CLAUDE.md) | Commit aralığı | O commit'lerde CI |
|---|---|---|
| Aşama 2: “npm test 1.421/1.421 (benim koşumum da)” | 2cb93c5..72f72a6 | 434–435: Windows 2/2 iş kırmızı (1301–1421 testte 37–38 başarısız) |
| Aşama 3–4: “npm test 1.598/1.598” | f46f748..b44d133 | 437–445: Windows kırmızı (38 başarısız); 442'de Linux da kırmızı (2) |
| Aşama 5–6: “npm test 1.630/1.630” | 63f8aae, d000df3 | 446: Windows kırmızı |
| Aşama 7–8: “npm test 1.691” | 8fa8236 … cdb3646 | 447–457: Windows kırmızı; 448'de ayrıca launcher iptali |
| Aşama 9: “npm test 1.714; senaryo-banka-210 330/330” | ac5305b..825b198 | 460: Windows kırmızı **ve e2e senaryo-banka-210 275 geçti / 23 başarısız** |
| Aşama 14: banka raporları | 1eb2fee..0beded4 | 462–463: Windows kırmızı |

Hiçbir beyanda Windows sonucu yoktu; hiçbiri CI'ye bakmadı. Ana oturum (ben) ajan beyanlarını CI'yi okumadan aktardım.

## 3. Süreç kök nedeni (neden 34 koşu fark edilmedi)

1. CI hiçbir şeyi durdurmuyordu: `ci.yml`'de yalnız “Dağıtım paketi” işi testlere bağlıydı; `master`'da kural seti yoktu;
   `release.yml` testleri yalnız Linux'ta koşuyordu; `tools/release.mjs` hiç denetim yapmıyordu.
2. “Geçti” beyanı yerel Linux koşusundan (çoğu kez boru `| tail` arkasından) okunuyordu; çıkış kodu ve platform yazılmıyordu.
3. Ajan raporu kanıt yerine konuyordu; ana oturum CI'yi bağımsız okumuyordu.

## 4. Kalıcı önlemler (yapıldı, CI'de doğrulandı)

| Önlem | Commit | Gerçek CI kanıtı |
|---|---|---|
| Windows'ta kırılan kalıplar için statik test (`test/platform-tasinabilirlik.test.mjs`) | 265b3cb | 46ea34c'de 4 satırı yakalıyor; bugün 4/4 |
| Kanıt kaydı aracı `tools/kanit.mjs` (çıkış kodu + sayılar; çelişki/özetsiz/0 test geçmez) | 5a7d903, 093d0d6 | CI'de her test adımı bununla koşuyor |
| CI'de **Doğrulama Kapısı** işi (4 platform + e2e kaydı, Linux = Windows test sayısı, atlanan yok, needs başarılı) | 180a8a5 | 474: GEÇMEDİ (gerçek Windows hatası); 481: GEÇTİ (1768 × 4) |
| `master` kural seti: PR zorunlu + “Doğrulama Kapısı” yalnız GitHub Actions'tan, atlatma yok | kullanıcı (API'den okundu) | ruleset 24836150; `current_user_can_bypass: never` |
| İmzalı paket ve yayın kapıya bağlı (`tools/release.mjs`, `release.yml`) | 180a8a5 | birim testleri + mutasyon; yayında henüz koşmadı |
| Stop / SubagentStop kancası (yeşil değilse yanıtı bir kez durdurup makine durumunu dayatır) | 180a8a5, 09a788a | birim testleri; bu oturumda canlı etkisi sınanmadı (kancalar oturum açılışında yüklenir) |

## 5. Okunamayan / doğrulanmayan

- GitHub MCP günlüklerin en çok son 5.000 satırını veriyor. Node 22 işleri TAP biçiminde ve 10.864–14.044 satır: ilk kısmı
  okunamadı. Node 22 işlerinin başarısız listesi, okunan kısımda `not ok` olmaması ve sayıların aynı koşunun Node 24 ikiziyle
  birebir tutmasıyla **dolaylı** çıkarıldı. 434 Windows Node 22'deki 3 testin kimliği bu yüzden BİLİNMİYOR.
- Ham günlüklerin tamamı (51 MB) depoya konmadı; GitHub'da saklama süresi boyunca (90 gün) iş sayfalarından okunabilir.
- Ana oturumun günlükten bizzat okudukları: 442 Linux Node 22 sayıları (1538/1536/2), 468 Windows Node 24 ve 22 (1728/1728),
  474 Windows Node 24 başarısız testleri, 474 ve 481 kapı tabloları. Öbür satırlar ajanın okumasıdır.
- 528 (c383f03, 16:11–16:37 UTC): T4 birleşmesi — dört platform 1899/1899, atlanan 0, 13 e2e yeşil; **Doğrulama Kapısı ilk kez GEÇTİ** (todo kalktı).
