# Zorunlu görev raporu — CI, Windows uyumluluğu, denetim sistemi (10.10.2026)

Görev (kullanıcı, 10.10.2026): CI başarısızlıklarını gider, Windows uyumluluğunu gerçek CI ile doğrula, denetim sistemini düzelt; 8 başlıklı
rapor; Linux ve Windows AYRI; başarısız / atlanan / doğrulanmayan açıkça.

**DURUM: TASLAK — tamamlanmadı.** Aşağıda "BEKLİYOR" yazan her satır, sonucu henüz okunmamış bir koşudur; o satırlar dolmadan bu rapor
"bitti" sayılmaz.

Kaynaklar: GitHub Actions API'si (iş sonuçları), iş günlükleri (GitHub MCP `get_job_logs`), `tools/kanit.mjs` kayıtları (`docs/kanit/2026-10-10/`).
Gerçek Windows erişimi YALNIZ GitHub CI'dir (windows-latest); yerelde Windows yok, Wine sayılmaz.

## 1. Değişen dosyalar

| Commit | Dosyalar | Ne |
|---|---|---|
| d9b1044 | `test/banka-210-goc.test.mjs`, `test/banka-210-goc-zinciri.test.mjs`, `test/banka-210-islem-no.test.mjs` | Windows'ta yüklenmeyen `import(path.join(...))` → `pathToFileURL`; göç kesintisi Windows'ta sinyal adı olmadan da tanınır |
| 53133a5 | `test/mutabakat/motor.mjs`, `test/banka-210-altin.test.mjs` | Altın test v2.0.26'ya karşı banka ekseni kapalı; iade sonrası kart kırpmasında FIFO payı (442'nin kök nedeni) |
| 265b3cb | `test/platform-tasinabilirlik.test.mjs` | Windows'ta kırılan kalıplar (import(path.join), URL.pathname, SIGKILL iddiası) kaynakta yok — statik test |
| 5a7d903, 093d0d6, 09a788a, e5568ec | `tools/kanit.mjs`, `test/kanit-araci.test.mjs` | Kanıt kaydı aracı (çıkış kodu + sayılar + ham çıktı + commit/platform; çelişki/özetsiz/0 test/iptal geçmez; Windows'ta kabuksuz; çağrıldığı klasörde koşar) |
| 180a8a5 | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `tools/release.mjs`, `tools/kanit.mjs`, `.claude/settings.json`, `.gitignore`, `CLAUDE.md` | Doğrulama Kapısı işi; paket işi kapıya bağlı; yayın ve imzalı paket CI yeşiline bağlı; Stop kancası |
| 09a788a | `.claude/settings.json` | SubagentStop kancası (yardımcı ajanlar da) |
| 12ade2d (yetmedi), d2f9ddc | `test/launcher.test.mjs` | Windows'ta `bind EACCES`: UDP keşif portu UDP'nin kendi boş portundan |
| 8da9200 | `client/assets/hof-bank.js` | ÜRÜN HATASI (CI 460): "Bankaya Geçmiş Say / Kart Borcuna Aktar" kararı eski önbellekten veriliyordu → tıklama anında sunucudan |
| a714003 | `test/e2e/senaryo-banka-210.mjs` | Adım 9b yavaş sunucuda (kırmızı kanıt); adım düşünce şirket geri alınır (22 zincirleme kırmızı biter) |
| 8f6a8f8, 25645d2 (birleşme ed02107) | `test/e2e/senaryo-222.mjs`, `test/e2e/senaryo-222-yaris.mjs`, `test/e2e/cpu-yavaslat.mjs` | Test yarışı (CI 465 ve 5a7d903): ağ, kullanıcının kendi liste yüklemeleri bittikten sonra kesilir; kutu seçiciyle tıklanır |
| — | `CLAUDE.md` | Kanıt kuralı, doğrulama kapısı bölümü, geçmiş test hatalarından 20 ders |

## 2. Çalıştırılan komutlar ve gerçek sonuçlar

Ana oturumun kendi koşuları (her biri `node tools/kanit.mjs kos <ad> -- <komut>`; JSON + ham çıktı aynı klasörde):

| Koşu | Commit | Sonuç | Kayıt |
|---|---|---|---|
| senaryo-banka-210, düzeltmesiz istemci + yavaş sunucu | a714003 | BAŞARISIZ 370/371 (yanlış "POS tahsilatı yok") | `ana-oturum-9b-*` |
| senaryo-banka-210, düzeltmeli | 8da9200 | GEÇTİ 375/375 | `ana-oturum-9b-*` |
| R5 iade-210-fazla-tahsilat: önce / sonra / v2.0.26 / v2.0.23 | 9340b9c / 326b87b / 5346ff8 / 58798e9 | 0/1 · 1/1 · 0/1 · 1/1 | `ana-oturum-r4r5/` |
| R4 sirket-yedek-klasor-210: önce / sonra / v2.0.26 / v2.0.23 | f241559 / af83d46 / 5346ff8 / 58798e9 | 0/1 · 1/1 · 0/1 · 0/1 | `ana-oturum-r4r5/` |
| senaryo-222-yaris MODE=forced CPU=1, eski / yeni bekleme | 031f90c | 1/10 (9 kırmızı) · 10/10 | `ana-oturum-s222/` |
| senaryo-222 tam, birleşik kod, normal ×3 / CPU ×6 ×3 | ed02107 | 56/56 ×6 | `ana-oturum-s222/` |
| npm test (tam paket) | BEKLİYOR | BEKLİYOR | — |
| test:mutabakat (5.000 × çok tohum) | BEKLİYOR | BEKLİYOR | — |
| test:guvenilirlik (10.000 × 5 tohum × iki taban) | BEKLİYOR | BEKLİYOR | — |
| bütün arayüz senaryoları (whatsapp, ui-ux-217 dahil) | BEKLİYOR | BEKLİYOR | — |

## 3. Windows ve Linux (AYRI)

| CI koşusu | Commit | Linux N22 | Linux N24 | Windows N22 | Windows N24 | e2e | Doğrulama Kapısı |
|---|---|---|---|---|---|---|---|
| 468 | d9b1044 sonrası | success (API) | success (API) | 1728/1728 | 1728/1728 | success (API) | (kapı yoktu) |
| 474 | 180a8a5 | 1763/1763 | 1763/1763 | 1760/1763 | 1760/1763 | — | GEÇMEDİ (gerçek Windows hatası: kanıt aracı `shell: true`) |
| 481 | 093d0d6 | 1768/1768 | 1768/1768 | 1768/1768 | 1768/1768 | 12 senaryo | GEÇTİ |
| 488 | 622249b | success | success | iş success ama 1 test atlandı | failure: `bind EACCES`, 5 iptal | success | GEÇMEDİ (atlanan test ve iptal yakalandı); paket işi atlandı |
| 503 | 13ac319 | 1770/1770 (v22.23.3) | 1770/1770 (v24.21.0) | 1770/1770 (v22.23.3) | 1770/1770 (v24.21.0) | 12 kayıt, hepsi GEÇTİ (senaryo-banka-210 375/375) | GEÇTİ (kapı günlüğünden okundu) |
| 509 | a8fc5c4 (senaryo-222 düzeltmesi birleşik) | 1770/1770 (v22.23.3) | 1770/1770 (v24.21.0) | 1770/1770 (v22.23.3) | 1770/1770 (v24.21.0) | 12 kayıt, hepsi GEÇTİ (senaryo-222 56/56) | GEÇTİ (kapı günlüğünden okundu) |

## 4. Geçmiş kırmızı koşular (08.10'dan beri)

Ayrıntı: `CI-GECMISI.md` (koşu koşu tablo, ajan beyanı ↔ CI çelişkileri, okunamayan günlükler).

## 5. Kalıcı önlemler

Ayrıntı: `CI-GECMISI.md` 4. bölüm ve `CLAUDE.md` → "Doğrulama kapısı — teknik zorunluluk". Sunucu tarafında bağlayıcı olan:
`master` kural seti 24836150 (PR zorunlu, "Doğrulama Kapısı" yalnız GitHub Actions'tan, atlatma yok).

## 6. Muhasebe bütünlüğü

BEKLİYOR — eksik test turu dalı (R1, R4, R5 düzeltmeleri) birleştikten sonra son kodda koşulacak (bkz. 2).
Bu turda bulunan canlı hatalar (v2.0.26'da da var): R1 iade geri ödemesi fatura kapaması, R4 yedek klasörü (büyük/küçük harf), R5 fazla
tahsilatlı kartta iade iptali. Bağımsız kâhin (temiz oda, iki Python modeli) fark aşamasında; hakem hükmü BEKLİYOR.

## 7. Başarısız / atlanan / doğrulanmayan

- 434 Windows Node 22'de kimliği okunamayan 3 test (günlüğün ilk kısmı okunamadı) — BİLİNMİYOR.
- R4'ün Windows (NTFS) üzerindeki etkisi ölçülmedi; test dalı birleşince Windows CI koşacak.
- Stop/SubagentStop kancasının canlı etkisi bu oturumda sınanmadı (kancalar oturum açılışında yüklenir).
- `release.yml`'in kapı adımı henüz gerçek bir yayında koşmadı.

## 8. Kalan iş, nedeni, sonraki adım

- Eksik test dalının birleşmesi (ajan son doğrulamada) → ana oturum kırmızı/yeşil yeniden koşusu → birleştir → CI.
- Muhasebe bütünlüğü koşuları (6) → son kodda.
- Bağımsız kâhinin hakem aşaması.
- CI'de olmayan arayüz senaryolarının elle koşusu ve CI'ye eklenmesi (ders 8).
