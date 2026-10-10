# Zorunlu görev raporu — CI, Windows uyumluluğu, denetim sistemi (10.10.2026)

Görev (kullanıcı, 10.10.2026): CI başarısızlıklarını gider, Windows uyumluluğunu gerçek CI ile doğrula, denetim sistemini düzelt; 8 başlıklı
rapor; Linux ve Windows AYRI; başarısız / atlanan / doğrulanmayan açıkça.

**DURUM: KAPANDI (10.10.2026; mühür CI 517 fecd2a2 + art arda 518–521).** Kullanıcının önerisi ("CI 517 ile mühürle ve kapat; tek bir kararsız
test için süreci durdurma, gerekiyorsa karantinaya al") üzerine baş mimar kararı: kapatıldı, **karantina yapılmadı** — gerekçe:
(1) kararsız test yok: 517–521'de dört platform art arda beş koşu 1885/1886 yeşil; (2) kapıyı kırmızı tutan tek şey bilinçli `todo` test
(Nakit Akış K10 başlangıcı, `raporlar-210-banka.test.mjs:800`) — kararsız değil, bilinen bir rapor hatası; testi atlamak/karantinaya almak
kapının "atlanan test = o platformda doğrulanmadı" kuralını deler (kanıt kuralı, ders 2 ve 16). Bu hata 2.1.0 temel sürüm iş listesinde
(T4) düzeltiliyor; düzeltme birleşince kapı yeşile döner ve o koşu buraya ek olarak yazılır. **Kapı bugün YEŞİL DEĞİLDİR; bu rapor öyle demez.**

Kaynaklar: GitHub Actions API'si (iş sonuçları), iş günlükleri (GitHub MCP `get_job_logs`, en çok son 5.000 satır), `tools/kanit.mjs` kayıtları
(`docs/kanit/2026-10-10/`). Gerçek Windows erişimi YALNIZ GitHub CI'dir (windows-latest); yerelde Windows yok, Wine sayılmaz. Tam CI günlüğü ve
kanıt dosyaları bu ortamda indirilemiyor (`*.blob.core.windows.net` ağ politikasıyla kapalı; kullanıcı kararı: ayar eklenmez).

## 1. Değişen dosyalar

| Commit | Dosyalar | Ne |
|---|---|---|
| d9b1044 | `test/banka-210-goc.test.mjs`, `test/banka-210-goc-zinciri.test.mjs`, `test/banka-210-islem-no.test.mjs` | Windows'ta yüklenmeyen `import(path.join(...))` → `pathToFileURL`; göç kesintisi Windows'ta sinyal adı olmadan da tanınır (434–467'nin kalıcı nedeni) |
| 53133a5 | `test/mutabakat/motor.mjs`, `test/banka-210-altin.test.mjs` | Altın test v2.0.26'ya karşı banka ekseni kapalı; iade sonrası kart kırpmasında FIFO payı (442) |
| 265b3cb, fecd2a2 | `test/platform-tasinabilirlik.test.mjs` | Windows'ta kırılan kalıplar kaynakta yok — 4 kural: import(path.join), URL.pathname, SIGKILL iddiası, `path.relative` alanı çevrilmeden |
| 5a7d903, 093d0d6, 09a788a, e5568ec, 00ce6d7, fecd2a2 | `tools/kanit.mjs`, `test/kanit-araci.test.mjs` | Kanıt aracı: çıkış kodu + sayılar + ham çıktı + commit/platform; çelişki/özetsiz/0 test/iptal geçmez; Windows'ta kabuksuz; çağrıldığı klasörde; başarısız testlerin adı/yeri/hatası çıktının SONUNDA ve kapı özetinde (TODO/SKIP hariç); `ci --bekle` koşunun oluşmasını bekler |
| 180a8a5, c7a0ccf | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `tools/release.mjs`, `.claude/settings.json`, `test/ci-kapi-listesi.test.mjs` | Doğrulama Kapısı işi (4 platform + 13 e2e kaydı, aynı sayı, atlanan yok); paket ve imzalı paket CI yeşiline bağlı; Stop/SubagentStop kancası; kapının beklenen listesi ↔ CI adımları testi |
| 12ade2d (yetmedi), d2f9ddc | `test/launcher.test.mjs` | Windows `bind EACCES`: UDP keşif portu UDP'nin kendi boş portundan |
| 8da9200 | `client/assets/hof-bank.js` | ÜRÜN HATASI (CI 460): "Bankaya Geçmiş Say / Kart Borcuna Aktar" kararı eski önbellekten → tıklama anında sunucudan |
| a714003 | `test/e2e/senaryo-banka-210.mjs` | Adım 9b yavaş sunucuda (kırmızı kanıt); adım düşünce şirket geri alınır |
| 8f6a8f8, 25645d2 (ed02107) | `test/e2e/senaryo-222.mjs`, `senaryo-222-yaris.mjs`, `cpu-yavaslat.mjs` | Test yarışı (CI 465): ağ, kullanıcının kendi yüklemeleri bittikten sonra kesilir; kutu seçiciyle tıklanır |
| 00ce6d7 | `test/supervisor.test.mjs` | CI 514: temizlik hatası (EBUSY) asıl hatayı ezmez; her bekleme adımı adıyla ve çıktıyla düşer |
| fecd2a2 | `test/banka-210-post-statik.test.mjs` | CI 515/516: yol ayırıcısı (Windows) |
| 1311200, 042fbc9 | `.github/workflows/uzun-dogrulama.yml`, `test/ci-kapi-listesi.test.mjs` | Uzun Doğrulama (mutabakat 5.000 × 10, güvenilirlik 10.000 × 5 × 2 + Windows) GitHub'da paralel; en çok 6 + 6 iş; depo özel yapılırsa başlamaz |
| 04bd8c1 (birleşme) | eksik test turu | R1–R5, D2 düzeltmeleri + 38 rapor, yetki matrisi, kabul mizanı, arıza testleri (bkz. 6) |
| — | `CLAUDE.md` | Kanıt kuralı, doğrulama kapısı bölümü, 21 ders, kullanıcı kararları |

## 2. Çalıştırılan komutlar ve gerçek sonuçlar (ana oturumun KENDİ koşuları)

Her biri `node tools/kanit.mjs kos <ad> -- <komut>`; JSON + ham çıktı belirtilen klasörde.

| Koşu | Commit | Sonuç | Kayıt |
|---|---|---|---|
| senaryo-banka-210, düzeltmesiz istemci + yavaş sunucu / düzeltmeli | a714003 / 8da9200 | 370/371 / 375/375 | `ana-oturum-9b-*` |
| R1/R2 banka-210-rapor-bulgu: önce / R1 sonrası / R2 sonrası | 3b57042 / 1249a0c / b5f2ba3 | 1/6 · 5/6 · 6/6 | `ana-oturum-r123/` |
| R3 banka-210-eslesmis: önce / sonra | cbf889d / 31b7117 | 0/7 · 7/7 | `ana-oturum-r123/` |
| R4 sirket-yedek-klasor-210: önce / sonra / v2.0.26 / v2.0.23 | f241559 / af83d46 / 5346ff8 / 58798e9 | 0/1 · 1/1 · 0/1 · 0/1 | `ana-oturum-r4r5/` |
| R5 iade-210-fazla-tahsilat: önce / sonra / v2.0.26 / v2.0.23 | 9340b9c / 326b87b / 5346ff8 / 58798e9 | 0/1 · 1/1 · 0/1 · 1/1 | `ana-oturum-r4r5/` |
| D2 senaryo-banka-210b: düzeltmesiz istemci / düzeltmeli | 7814bcf | 62/63 · 63/63 | `ana-oturum-r123/` |
| Failed to fetch süzgeci: eski / yeni / yeni + sunucu reddi | 7814bcf | 0/3 · 3/3 · 3/3 (hata sayıldı) | `ana-oturum-r123/` |
| senaryo-222-yaris (zorla yarış), eski / yeni bekleme | 031f90c | 1/10 · 10/10 | `ana-oturum-s222/` |
| senaryo-222 tam, birleşik, normal ×3 / CPU ×6 ×3 | ed02107 | 56/56 ×6 | `ana-oturum-s222/` |
| **npm test (tam paket), birleşik kod** | c7a0ccf | **1879/1880, 0 başarısız, 1 todo** (Linux, Node v22.22.0) | `ana-oturum-npm/` |
| kanit-araci (+ mutasyon: boş liste → 3 kırmızı, beklemeyen ci → 1 kırmızı) | 00ce6d7, fecd2a2 | 42/42 | `ana-oturum-kanit-araci/` |
| supervisor (+ mutasyon: hazır olmayan uygulama → adım adıyla hata) | 00ce6d7 | 8/8 | `ana-oturum-supervisor/` |
| ci-kapi-listesi (eski ci.yml → kırmızı; Uzun Doğrulama mutasyonları → kırmızı) | c7a0ccf…042fbc9 | 3/3 | `ana-oturum-kapi-listesi/`, `ana-oturum-uzun-dogrulama/` |
| platform-tasinabilirlik (yeni kural önce 4/5 kırmızı) | fecd2a2 | 5/5 | `ana-oturum-tasinabilirlik/` |

## 3. Windows ve Linux (AYRI) — CI'den, kapı günlüğünden okunan sayılar

| CI | Commit | Linux N22 | Linux N24 | Windows N22 | Windows N24 | e2e | Doğrulama Kapısı |
|---|---|---|---|---|---|---|---|
| 468 | d9b1044 sonrası | success | success | 1728/1728 | 1728/1728 | success | (kapı yoktu) |
| 474 | 180a8a5 | 1763/1763 | 1763/1763 | 1760/1763 | 1760/1763 | — | GEÇMEDİ (kanıt aracı `shell: true`) |
| 481 | 093d0d6 | 1768/1768 | 1768/1768 | 1768/1768 | 1768/1768 | 12 | GEÇTİ |
| 488 | 622249b | success | success | 1 test atlandı | `bind EACCES`, 5 iptal | success | GEÇMEDİ |
| 503 | 13ac319 | 1770/1770 | 1770/1770 | 1770/1770 | 1770/1770 | 12 GEÇTİ | GEÇTİ |
| 509 | a8fc5c4 | 1770/1770 | 1770/1770 | 1770/1770 | 1770/1770 | 12 GEÇTİ | GEÇTİ |
| 514 | 85a7b50 (yalnız CLAUDE.md) | 1770/1770 | 1770/1770 | **1769/1770** (supervisor EBUSY) | 1770/1770 | 12 GEÇTİ | GEÇMEDİ |
| 515 / 516 | c7a0ccf / 00ce6d7 | yeşil | yeşil | ikisinde de failure: 1 başarısız (yol ayırıcısı, `banka-210-post-statik`) | ikisinde de failure (aynı test) | GEÇTİ | GEÇMEDİ |
| **517** | **fecd2a2** | **1885/1886** | **1885/1886** | **1885/1886** | **1885/1886** | **13 GEÇTİ** (banka-210 386, 210b 63) | GEÇMEDİ — yalnız 1 `todo` (Nakit Akış K10) |
| 518, 519, 520, 521 | 6f91b46, 99066d8, f5259dd, 1311200 | yeşil (519: 1885/1886) | yeşil | yeşil (iş success) | yeşil (iş success) | yeşil | GEÇMEDİ — 519'da günlükten okundu: yalnız aynı tek `todo` (4 platformda 1 atlanan) |

Windows: yol ayırıcısı düzeltmesinden sonra art arda 5 koşu yeşil (ders 18 şartı: en az 2). Linux ve Windows aynı test sayısını koşuyor.

## 4. Geçmiş kırmızı koşular (08.10'dan beri)

Koşu koşu tablo, ajan beyanı ↔ CI çelişkileri ve okunamayan günlükler: `CI-GECMISI.md`. Özet: 34 koşu Windows kırmızısı test kodundandı
(d9b1044); 442 test/model hatası; 448/488 launcher portu (d2f9ddc); 460 ÜRÜN hatası (8da9200); 465 test yarışı (ed02107); 474 kanıt aracının
kendi Windows hatası (kapı yakaladı); 514 supervisor (kök neden bilinmiyor, bkz. 7); 515/516 yol ayırıcısı. Ajanların "geçti" beyanları 6 kez
CI ile çelişti (hepsi yalnız Linux koşusuna dayanıyordu) — `CI-GECMISI.md` 2. bölüm.

## 5. Kalıcı önlemler

| Önlem | Bağlayıcılık |
|---|---|
| `master` kural seti 24836150: PR zorunlu, "Doğrulama Kapısı" yalnız GitHub Actions'tan (integration 15368), atlatma yok | Sunucu tarafı (kullanıcı açtı, API'den okundu) |
| Doğrulama Kapısı: 4 platform + 13 e2e kaydı bu commit'te GEÇTİ, Linux = Windows test sayısı, atlanan/todo yok | CI |
| Kapının beklenen listesi ↔ CI adımları ve Uzun Doğrulama matrisi testle eşlenir | npm test |
| İmzalı paket (`tools/release.mjs`) ve yayın (`release.yml`) CI YEŞİL değilse üretilmez | araç + CI |
| Kanıt aracı: gerçek çıkış kodu + sayılar; başarısız test adları kısa günlükte | CI'nin her test adımı |
| Taşınabilirlik statik testi (4 kural) | npm test (Linux'ta da yakalar) |
| Uzun Doğrulama iş akışı (plan alt sınırı, bağımsız koşucu, ücretsiz, CI'yi bekletmez) | elle / `[uzun-dogrulama]` |
| Stop + SubagentStop kancası | yerel (bkz. 7) |
| CLAUDE.md: kanıt kuralı (5 madde), 21 ders | süreç |

## 6. Muhasebe bütünlüğü

- **Bağımsız kâhin** (plandan, program kodunu görmeden iki Python modeli; `docs/kanit/2026-10-10/kahin/`): kabul 1–16 üç tarafta fark 0
  (planın 28 sayısı); 33 tohum (30 × 500 + 3 × 2.000 işlem); 13 fark sınıfı, açıklanamayan 0; hakem her sınıfı en küçük senaryoya indirip
  v2.0.26 gerçek koduyla ölçtü.
- **Bulunan ve DÜZELTİLEN** (ana oturum kırmızı/yeşil koştu): R1 iade geri ödemesi başka faturayı kapatıyordu (canlı), R2 Gider Raporu
  gruplaması (canlı), R3 eşleşmiş satır koruması, R4 yedek klasörü (canlı; testi Windows'ta da geçiyor, CI 517–521), R5 fazla tahsilatlı kartta
  iade iptali (canlı), D2 Düzenle numarası, CI 460 ürün hatası.
- **Bulunan, DÜZELTİLMEKTE** (2.1.0 temel sürüm iş listesine devredildi, CLAUDE.md'de): K1 iade kapanışı (canlı), K2 kurumsal kart bağı (teslime
  engel), K3 Kasa elle hareketi istek kimliği (canlı), K4 nakit ön denetimi sırası, K5 banka eksi kodu, K6 Kasa açılışı 649 (canlı, ertelendi),
  K7 KMH, K8 kredi; Nakit Akış K10 başlangıcı.
- **Koşular:** npm test birleşik 1879/1880 (ana oturum); mutabakat 5.000 × tohum 1/2/3 ve güvenilirlik 3.000 × 2 × 2 (eksik test ajanı —
  ajan koşusu, ana oturum yeniden koşmadı); Uzun Doğrulama #2 GitHub'da SÜRÜYOR (mutabakat 5.000 × 10 + Windows, güvenilirlik 10.000 × 5 × 2 +
  Windows) — sonucu 2.1.0 KANIT'ına yazılır; bu rapor onu "geçti" saymaz.

## 7. Başarısız / atlanan / doğrulanmayan

- **Doğrulama Kapısı bugün GEÇMİYOR:** tek neden `todo` test (Nakit Akış K10) → T4 ile kapanacak. Karantina yapılmadı.
- **CI 514 supervisor (Windows Node 22) kök nedeni BİLİNMİYOR:** asıl hata EBUSY tarafından gizlenmişti; test artık asıl hatayı gösterir;
  sonraki 7 koşuda tekrarlamadı.
- 434 Windows Node 22'de kimliği okunamayan 3 test — BİLİNMİYOR (günlüğün başı okunamadı).
- Uzun Doğrulama #2 sürüyor (bkz. 6); 20.000 işlemlik tek sıralı mutabakat henüz koşulmadı (yerelde, son adayda).
- `senaryo-whatsapp`, `ui-ux-217` ve CI'de olmayan arayüz senaryoları bu turda ana oturumca koşulmadı (eksik test ajanı 27/27 dedi — ajan
  beyanı, kanıt sayılmaz) → son doğrulamada (T7).
- Stop/SubagentStop kancasının canlı etkisi bu oturumda sınanmadı (kancalar oturum açılışında yüklenir).
- `release.yml` kapı adımı henüz gerçek bir yayında koşmadı.
- Yerel koşuların hepsi Linux; Windows yalnız CI'den.

## 8. Kalan iş, nedeni, sonraki adım

Zorunlu görevin kendi hedefi (CI başarısızlıkları giderildi, Windows gerçek CI'de doğrulandı, denetim sistemi kuruldu ve çalışıyor) tamam.
Açık kalan her şey 2.1.0 temel sürüm iş listesine devredildi (CLAUDE.md "KARAR … TEMEL SÜRÜME BAŞLA"):
1. T4 Nakit Akış K10 → kapı yeşile döner (o koşu bu rapora ek olarak yazılır).
2. T2/T3 K1–K8 düzeltmeleri → ana oturum kırmızı/yeşil → birleştir → CI.
3. T6 yargıç + eleştirmen; T7 son doğrulama (Uzun Doğrulama, 20.000 işlem, bütün e2e, ölçek) + paket.
