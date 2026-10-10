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
| 448 (6fad463) | Windows Node 24 `launcher.test.mjs` hazırlığı: `bind EACCES`, 5 test iptal | Test, TCP için alınan rastgele portu UDP keşfi için de kullanıyordu; Windows'ta o numara UDP'de bağlanamayabiliyor. | DÜZELDİ 12ade2d (yerel benzetim: eski test 0/5 · 5 iptal, yeni 6/6). |
| 434 Windows Node 22 (e10f598) | `reasoning.test.mjs:109` (38.792 ms > 6.000 ms eşik), `updater.test.mjs` 3 test, **kimliği okunamayan 3 test** | Koşucu olağan dışı yavaştı: iş 6.680 sn (öbür Windows işleri 707–1.538 sn). Eşikli/zaman aşımlı testler bilinçli. | Düzeltilmedi (bilinçli performans eşiği). Sonraki 67 Windows işinde tekrarlamadı. 3 testin kimliği bilinmiyor (bkz. 5). |
| 460 (825b198) e2e | `senaryo-banka-210` adım 9b (“Bankaya Geçmiş Say” formu 30 sn'de açılmadı) + 22 zincirleme hata | Kök neden ARAŞTIRILIYOR (ayrı ajan, yeniden üretim + düzeltme). Adım düşünce şirket geri alınmadığı için sonraki adımlar 002'de koştu. | AÇIK |
| 465 (ac19490) ve 5a7d903 e2e | `senaryo-222.mjs:303` (kutuda “Müşteri 0”, 0 satır, “Liste alınamadı”) | Kök neden ARAŞTIRILIYOR (ayrı ajan). Olası yarış: test ağı kesen yönlendirmeyi kurduğunda kullanıcının kendi arama isteği hâlâ uçuşta. | AÇIK |
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
