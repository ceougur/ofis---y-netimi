# 2.4.7 TAM KAPI (son aday) — fbeb813, yerel koşu 29.10.2026 15:52–18:24 UTC

Ortam: linux x64, 4 çekirdek, 16 GB, Node v22.22.0; Chromium 1194 (Playwright 1.56, `PLAYWRIGHT_BROWSERS_PATH` not defterindeki maliyet247-pw). Disk başta 5,2 GB boş,
en düşük 4,95 GB (ders 24; araç 4,5 GB'ın altında durur — durmadı). Bağımlılıklar worktree'de `npm ci` ile (ders 29). Her koşu `tools/kanit.mjs kos 247-tamkapi/<ad>`
ile, `flock <not defteri>/tamkapi247-a1cd/kos.lock` altında TEK TEK (ders 15); `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30). Kırmızı olan bir kez `<ad>-tekrar`
adıyla yeniden koşuldu (ders 20). Ürün kodu ve depo araçları DEĞİŞMEDİ; kapı betiği not defterindedir, kopyası `araclar/kapi-247.mjs.txt` (akış günlüğü
`araclar/kapi-akisi.log`, bölüm özeti `araclar/ozet.cjs.txt`). "+1 izlenmeyen" = bu kanıt klasörünün kendisi (koşu sırasında henüz commit edilmemişti).
Bütün kayıtlar aynı commit fbeb81345d0de8e917ea92c6f0cfc4ee276d69e9 (özet aracı farklı commit görmedi).

## 1. Tam npm test — GEÇTİ
`npm-test`: 3906/3906, 0 başarısız / iptal / atlanan, çıkış 0, 2007 sn.

## 2. ci.yml'nin BÜTÜN listesi (ders 37) — 85/85 GEÇTİ
- Kâhin satırları (ci.yml'deki argümanlarla aynen) `ci-kahin-*`: 8 koşu, 52697/52697 — kahin-defter 176/176 · kahin-cari 7408/7408 · kahin-tutar 3559/3559 ·
  kahin-ebelge-model 114/114 · kahin-ebelge-mutasyon 55/55 · kahin-ebelge-senaryo 27/27 · kahin-maliyet (API) 41306/41306 ·
  kahin-mobil-yazma (`--haric E02-es-havale-pos-mobil,E02-es-havale-pos-masaustu`) 52/52.
- e2e satırları `ci-e2e-*` (ci.yml'deki `kanit.mjs kos e2e-… npm run …` satırlarının TAMAMI, betik 77 satır okudu = ci.yml'deki 77 satır; altı mobil senaryo
  ve ekstre-ayrinti-247 dahil): 77 koşu, 3868/3868 denetim, hepsi ilk denemede yeşil, kırmızı 0, 3778 sn. Mobil: senaryo-mobil-247 77/77, mobil-eslesme-247 38/38,
  mobil-ozet-247 34/34, mobil-yazma-247 74/74, mobil-tunel-247 15/15; ekstre-ayrinti-247 34/34, maliyet-246 89/89. Tam liste (ad gecen/toplam): `araclar/kapi-akisi.log`.

## 3. CI dışı senaryolar (ders 8) — 14/14 GEÇTİ
package.json'daki, ci.yml'de olmayan bütün test:senaryo-* betikleri + ui-ux-217: senaryo-210 57/57, 211 59/59, 212 24/24, 213 64/64, 214 48/48, 215 73/73,
216 54/54, 217 65/65, 218 50/50, senaryo-rapor 87/87, senaryo-taslak 31/31, senaryo-whatsapp 45/45, senaryo (tablodan-aktar) 30/30, ui-ux-217 407/407
(toplam 1094/1094; hepsi ilk denemede).
CI dışı başka e2e dosyaları (hiçbir package.json betiğinde yok; senaryo değil, zorla üretme/yardımcı araç): banka-210-analiz-yaris, banka-210-fetch-yaris,
banka-210-planli-yaris, banka-210-yaris, cpu-yavaslat, e2e-not-yaris, esc-kapat, esc-kapat-ozet, form-izolasyon-b4-yaris, pencere-yaris-zorla,
senaryo-211-yaris-zorla, senaryo-222-yaris, senaryo-225-yaris, tarayici-kesme → koşulmadı (DENENMEYEN, adıyla).

## 4. CI dışı kâhinler
| Koşu | Sonuç | Not |
|---|---|---|
| `dis-kahin-maliyet-tam` — `python3 -I test/bagimsiz/maliyet/kos.py` (API + arayüz) | 43758/43758 GEÇTİ | BELİRSİZ yok |
| `dis-kahin-mobil-erisim` — mobil-erisim/program-surucu.mjs (M2+M3, kapıcı dahil) | 36/36 GEÇTİ | olay eşleşen 2124/2152 (üretilebilen 2124/2124), BULGU 0, İNCELE 0, M3_KAPICI 1 (U28 #7 — BİLİNEN KÂHİN FARKI, iş listesi), DENENMEYEN 27 = mobil yazma 10 (bu kâhinin dışında; mobil-yazma kâhini kapsar — sürücünün "405" notu M2 döneminden) + mobilde Kasa raporu 17; `erisim-karsilastirma.json` |
| `dis-kahin-mobil-yazma-tam` — `npm run test:kahin-mobil-yazma` (--haric YOK) | 52/54, 2× aynı | Kırmızı yalnız E02 çifti: `adim:t4:http: program 404 · beklenen 400`, `kod: program "bank-account-missing" · beklenen "bank-account-invalid"` — ci.yml'nin `--haric` ile dışarıda tuttuğu BİLİNEN KÂHİN FARKI (havale yoluna POS kimliği; ürün sahibi / baş mimar kararı bekler). Ürün hatası değil, yeni fark değil (ders 38: neden iletiden okundu) |
| `dis-kahin-sayac-surucu` — `TZ=Europe/Istanbul node test/bagimsiz/edm-sayac/program-surucu.mjs kabul.json …` | BELİRSİZ (çıkış 0) | Üretici adım: özet satırı basmaz, yalnız "50 senaryo yazıldı … not içeren senaryo: 15". Çıktılar `sayac-program.json`, `sayac-uretilemeyen.json`. 27.10 kaydı da aynı hükmü taşır (edm247-kahin-surucu) |
| `dis-kahin-sayac-karsilastir` — `kahin.py karsilastir … --birlesim ay=gonderim;anahtar=sirket_ettn_ortam;e11048=kesinlestirir;pencere=icinde_dahil;geri_yukleme=etkilemez` | 47/50, 2× aynı | Kırmızılar U44, U47, U48 = 27.10 son karşılaştırmasıyla (docs/kanit/2026-10-27/edm247-kahin-son) BİREBİR aynı üç senaryo ve aynı iletiler: U44, U48 DENENMEYEN (programda üretilemez), U47 BİLİNEN KÂHİN FARKI (sıfırlama izi silmez, S4). Yeni fark yok |
| `dis-kahin-sayac-kendi` — edm-sayac/kahin_test.py | 136/136 GEÇTİ | kâhinin kendi testi |
| `dis-kahin-erisim-kendi` — mobil-erisim/kahin_test.py | 123/123 GEÇTİ | |
| `dis-kahin-yazma-kendi` — mobil-yazma/kahin_test.py | 152/152 GEÇTİ | |
| `dis-kahin-maliyet-kendi` — maliyet/test_kahin.py | 119/119 GEÇTİ | |

## TOPLAM
115 koşu adı (npm test 1 + ci.yml kâhin 8 + ci.yml e2e 77 + CI dışı senaryo 14 + CI dışı kâhin 9; kırmızı üç adım ikişer kez → 118 kayıt).
Denetim: npm test 3906 + ci.yml 56565 (52697 + 3868) + CI dışı senaryo 1094 + CI dışı kâhin 44423/44428 geçti (tekrarlar sayılmadan; sürücü adımı sayısız; 5 = E02 ×2 + U44/U47/U48) → genel 105988/105993.
Ürün kodunda yeni kırmızı: YOK. Kırmızı görülen üç adımın üçü de önceden belgelenmiş kâhin farkı / üretici adımı (yukarıda; iki koşuda aynı imza).

## DENENMEYEN
- Windows (yerel kapı yalnız Linux; Windows CI'de — ana oturum okur, ders 1/18) ve windows.yml gerçek kurulum.
- Uzun koşular (mutabakat 5.000 × 10, güvenilirlik 10.000 × 5 × 2) — Uzun Doğrulama'da; mutabakat kâhin modelleri (test/bagimsiz/model_a, model_b, test_surum2–4.py) bu kapıda koşulmadı (mutabakat koşusunun parçası).
- `test:mutabakat`, `test:guvenilirlik` (UD), ölçek.
- Göç (eski sürüm verisiyle) ve hız ölçümü bu kapının kapsamında değil (ayrı iş; iş listesi "ESKİ SÜRÜM VERİSİYLE GÖÇ").
- Kılavuz PDF üretimi / pdf-denetle (paket adımında, ders 42).
- CI dışı yardımcı/zorla e2e dosyaları (§3'te adıyla).
- Gerçek telefon + gerçek Cloudflare tüneli (kullanıcının kendi kurulumunda; M4-TASARIM §8 madde 5).
## BİLİNEN SINIRLAR
- Mobil yazma kâhini E02 çifti, sayaç kâhini U44/U47/U48, mobil erişim kâhini U28 #7 (M3_KAPICI) — iş listesinde belgeli kâhin farkları; bu kapıda değişmedi.
- edm-sayac program sürücüsü özet satırı basmadığından `kanit.mjs` hükmü BELİRSİZ; asıl hüküm karşılaştırma adımındadır.
