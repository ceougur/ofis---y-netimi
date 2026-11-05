# 2.4.9 TAM KAPI (son aday) — yerel koşu 05.11.2026 04:23 → 08:39 UTC

Ortam: linux x64 (6.18.44-fc-v236), 4 çekirdek, 16 GB, Node v22.22.0; Chromium headless shell 1194 (Playwright 1.56.0, `PLAYWRIGHT_BROWSERS_PATH` not defterindeki
p1-kod-ac15eb6c/pw; /opt'a dokunulmadı). Disk başta 13,7 GB boş, en düşük 13,5 GB (ders 24; betik 5 GB'ın altında durur — durmadı). Her koşu `tools/kanit.mjs kos
249-tamkapi/<ad>` ile, `flock <not defteri>/tam-npm-test.lock` altında TEK TEK (ders 15); `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30). Kırmızı olan bir kez `<ad>-tekrar`
adıyla yeniden koşulacaktı (ders 20) — gerekmedi: ürün/test kırmızısı çıkmadı. Bilinen fark taşıyan deterministik karşılaştırma koşuları (kâhin ↔ program) tekrar edilmez,
hükmü aile karşılaştırmasıyla verilir. Ürün kodu, test kodu ve depo araçları bu ajan tarafından DEĞİŞMEDİ. Kapı betiği `araclar/kapi-249.mjs.txt` (2.4.8 kapi-248 düzeni +
WhatsApp bölümü), akış günlüğü `araclar/kapi-akisi.log`, bölüm özeti `araclar/ozet.cjs.txt`, liste çıkarıcılar `araclar/e2e-liste.cjs.txt` / `betik-liste.cjs.txt`, aile
sınıflayıcı `araclar/wa-aile.cjs.txt` / `wa-iki-aile.cjs.txt`, mobil erişim karşılaştırması `araclar/erisim-kars.cjs.txt`. "+1 izlenmeyen" = node_modules sembolik bağı
(ders 29: ana depodaki node_modules'a bağ, npm ci yok) — kanıt klasörü yazılmadan önceki koşularda; sonraki kayıtlarda bu klasör de sayılır.

COMMIT: bütün kayıtlar (130) 78976042 (dal claude/compassionate-galileo-f9kghg ucu; "birleşik son dar kontrol bitti"). GÜN: hepsi 05.11 UTC içinde; gece yarısı (UTC
ve Türkiye) geçilmedi (ders 22).

## 1. Tam npm test — GEÇTİ
`npm-test`: 4652/4652, 0 başarısız / iptal / atlanan, çıkış 0, 2383 sn (2.4.8: 4468).

## 2. ci.yml'nin BÜTÜN listesi (ders 37)
- Kâhin satırları `ci-kahin-*` (ci.yml argümanlarıyla aynen; liste 2.4.8 ile aynı): 8 koşu, 53987/53987 GEÇTİ — defter 176 · cari 8698 (46 senaryo; 2.4.9 C1 cari_sil
  senaryoları c14a–c14g dahil, 0 fark, 0 yakalanmayan mutasyon, 7 bilinen sınır b3y; 12 senaryo 2.4.5 kararıyla atlanır → yalnız `--legacy`) · tutar 3559 · ebelge-model 114 ·
  ebelge-mutasyon 55 · ebelge-senaryo 27 · maliyet (API) 41306 · mobil-yazma (`--haric E02…`) 52.
- e2e satırları `ci-e2e-*`: ci.yml'de `kanit.mjs kos e2e-… npm run …` satırı 85 (grep ile sayıldı; betik de 85 okudu). 2.4.8'e göre 3 yeni: kilavuz-metin 277/277,
  senaryo-pos-kart-249 383/383, senaryo-yedeksiz-sil-249 33/33. 85 koşunun 85'i İLK denemede GEÇTİ, 5049/5049 denetim, 4259 sn. WhatsApp: ayar-248 118/118, donem-248 37/37,
  sablon-248 50/50, gonder-248 189/189; mobil-iphone-248 45/45; iz1-kasa-acilis 21/21 (2.4.8'de düzeltilen tarih bağımlılığı bugün ayın 5'inde de yeşil). Tam ad = sayı listesi
  `araclar/kapi-akisi.log`.

## 3. CI dışı senaryolar (ders 8) — 16/16 GEÇTİ (hepsi ilk denemede), 1321/1321
package.json'daki, ci.yml'de olmayan bütün test:senaryo-* betikleri (13; 2.4.8 ile aynı liste, yenisi yok — `araclar/betik-liste.cjs.txt`) + ui-ux-217 + betiksiz 2.4.8 T4/T7
e2e'leri: senaryo-210 57/57, 211 59/59, 212 24/24, 213 64/64, 214 48/48, 215 73/73, 216 54/54, 217 65/65, 218 50/50, senaryo-rapor 87/87, senaryo-taslak 31/31,
senaryo-whatsapp 45/45, senaryo (tablodan-aktar) 30/30, ui-ux-217 407/407, is-akisi-248 184/184, tarih-248 43/43.
test/e2e/ (115 .mjs) ↔ ci.yml karşılaştırması (`araclar/e2e-liste.cjs.txt`): 2.4.9'da eklenip ci.yml'de OLMAYAN senaryo YOK (2.4.9'un üç yeni e2e'si ci.yml'de). CI dışı
betiksiz yardımcı/zorla üretme araçları (senaryo değil) koşulmadı → DENENMEYEN (adıyla, aşağıda); 2.4.9'da bunlara `bildirim-yaris-zorla.mjs` eklendi (`node --import` ön
yüklemesi, mobil-yazma-247 Y9 test yarışını zorla üretir).
test:mutabakat ve test:guvenilirlik (uzun koşu) → Uzun Doğrulama'da (DENENMEYEN).

## 4. CI dışı kâhinler
| Koşu | Sonuç | Not |
|---|---|---|
| `dis-kahin-maliyet-tam` — `python3 -I test/bagimsiz/maliyet/kos.py` (API + arayüz) | 43758/43758 GEÇTİ | 2.4.8 ile aynı sayı |
| `dis-kahin-mobil-erisim` — mobil-erisim/program-surucu.mjs | 31/42 | BİLİNEN KÂHİN FARKLARI, gerileme değil: 42 senaryonun fark listeleri 2.4.8 tam kapısıyla (`docs/kanit/2026-11-01/248-tamkapi/erisim-karsilastirma.json.gz`) BİREBİR aynı (farklı senaryo 0, birleşim aynı) — `erisim-karsilastirma.json.gz` |
| `dis-kahin-mobil-yazma-tam` — `npm run test:kahin-mobil-yazma` (--haric YOK) | 52/54 | Yalnız E02 çifti (`adim:t4:http: program 404 · beklenen 400`, `bank-account-missing` ↔ `bank-account-invalid`) — 2.4.8 ile aynı imza; ci.yml'nin `--haric` ile dışarıda tuttuğu BİLİNEN KÂHİN FARKI |
| `dis-kahin-sayac-surucu` — edm-sayac/program-surucu.mjs (TZ=Europe/Istanbul) | BELİRSİZ (çıkış 0) | Üretici adım, özet satırı basmaz ("50 senaryo yazıldı … not içeren senaryo: 15"); çıktı `sayac-program.json` 2.4.8 tam kapısınınkiyle BAYT BAYT aynı (cmp) |
| `dis-kahin-sayac-karsilastir` — kahin.py karsilastir (2.4.7 birleşimi) | 47/50 | U44, U47, U48 — 2.4.8 ile aynı satırlar: U44/U48 DENENMEYEN (programda üretilemez), U47 BİLİNEN KÂHİN FARKI (S4) |
| `dis-kahin-sayac-kendi` | 136/136 GEÇTİ | |
| `dis-kahin-erisim-kendi` | 150/150 GEÇTİ | |
| `dis-kahin-yazma-kendi` | 152/152 GEÇTİ | |
| `dis-kahin-maliyet-kendi` | 119/119 GEÇTİ | |

### 4a. WhatsApp kâhini (test/bagimsiz/whatsapp-248; kâhin 292 senaryo, güncelleme 10 + W3)
| Koşu | Sonuç | Not |
|---|---|---|
| `wa-kahin-kendi-istanbul` / `wa-kahin-kendi-utc` — kahin_test.py | 315/315, 315/315 GEÇTİ | iki saat dilimi |
| `wa-sahte-meta` — sahte-meta/sunucu.test.mjs | 35/35 GEÇTİ | |
| `wa-sahte-meta-mutasyon` | 19/19 GEÇTİ | 19 mutasyonun hepsi yakalandı |
| `wa-senaryolar` — senaryolar.py (elle ↔ model) | 292/292 GEÇTİ | yeniden yazdığı `senaryolar.json` depodakiyle aynı (`git status` temiz) |
| `wa-surucu-kendi-testi` — surucu.mjs --kendi-testi | 40/40 GEÇTİ | |
| `wa-surucu-imzali-ikisi-istanbul` | 50/584 (araç BAŞARISIZ) | aile sınıflaması aşağıda — YENİ AİLE YOK |
| `wa-surucu-imzali-ikisi-utc` | 44/584 | 2.4.8 UTC ile YENİ AİLE YOK |
| `wa-surucu-yol1-hizli-istanbul` | 25/292 | 2.4.8 yol1 ile YENİ AİLE YOK |
| `wa-surucu-yol2-hizli-istanbul` | 25/292 | 2.4.8 yol2 ile YENİ AİLE YOK |
| `wa-surucu-mutasyon` — --mutasyon-denetimi | 41/48 | 7 DİŞSİZ eşleme (S6, S11, S19, S20, S22, S30, S32) — 2.4.8 `248-t1r-ek-mutasyon` ile BİREBİR aynı 7 ad; yeni eşleme (48. hücre) yakalandı. İlk deneme arka plan iş sınırında (2 sa) kesildi, kaydı yazılmadı; aynı adla baştan koşuldu |

Araç hükmü BAŞARISIZ beklenen: kâhin ↔ program fark listesi araçta kırmızı sayılır (2.4.8 T1 ölçütü: "ayrışma listesi önceki koşuyla birebir"). Asıl hüküm
`wa-surucu/aile-*.txt` karşılaştırmalarında (senaryo × uç başına davranış farkı listesi; gösterim farkları sürücünün kendi sınıflarıyla).

**Fark aileleri (imzalı, İstanbul, hızlı uç; UTC / yol1 / yol2 aynı tablo, sayılar `wa-iki-aile` çıktısı):**
| Aile | 2.4.8 son (t1z 589558bd) | 2.4.9 W öncesi (a0962e7a) | 2.4.9 tam kapı (78976042) | Sınıf |
|---|---|---|---|---|
| G1-borçlu-eki (gösterim: değişkende "(Borçlu)" eki) | 251 senaryo | 258 | 258 (+7 yeni W senaryosu; UTC/yol1/yol2 de 258) | BİLİNEN gösterim farkı, davranış değil |
| G2 / G3 / G4 gösterim sınıfları | var | var | aynı sınıflar, yeni gösterim sınıfı YOK | BİLİNEN gösterim |
| K1.pencere_farkli_alici | 12 | 12 | 12 (yol1 13) | 2.4.8'den bilinen A5 ailesi |
| K2.pencere_farkli_alici | 4 | 4 | 13 | +9 = W-KÖK'ün düzelttiği TTL senaryoları (ICERIK-10, TARIH-02, TARIH-03b, J4-01, J4-02, W1-03, W1-04, W2-01, W2-02): "Süresi Doldu" farkı kalktı, yerine yalnız "Süresi Doldu ileti 24 saat sınır penceresinde sayılmaz" kaldı = iş listesi W-KÖK SORU 2 → 03.11 yetkisiyle 2.5.0 BİLİNEN SINIR |
| GUV-09 (imzasız "delivered") | farklı beklenti | — | kâhin W1 güncellemesiyle beklenti "Gönderildi"; program Teslim Edildi | A3: Yol 1 kapıcının wa0 iletmesi BİLİNEN tasarım (yol2'de fark yok) |
| UTC'ye özgü yerel gün farkları (K1-04, K1-07, K8-02, K8-03, D4-03, D7-02, E3-01, F2-01, G2-03, G6-03, J8-05) | 2.4.8 UTC'de aynı | — | UTC koşusunda aynı | 2.4.8 UTC ile birebir (kâhinin "bugün"ü +03:00) |
| Öbür davranış aileleri (toplular.T* yok — KAYIP/G4/J3-02; pdf.donem_bas — Tüm Hareketler; meta.toplam_kabul_program; vb., 54 yol ailesi) | var | var | aynı | 2.4.8'den ve kâhin-W "C listesi"nden (58 W'den bağımsız senaryo) bilinen |

Karşılaştırma sonuçları (davranış farkı listesi, senaryo × uç):
- ↔ 2.4.8 son (t1z, hızlı, 284 ortak): AYNI 276, DEĞİŞEN 8 — CIFT-16, J1-02 (farkın TAMAMI kalktı), ICERIK-10, TARIH-02, TARIH-03b, J4-01, J4-02 (Süresi Doldu farkı kalktı,
  K2.pencere eklendi), GUV-09 (kâhin beklentisi değişti). YENİ aile YOK, KALKAN aile YOK.
- ↔ 2.4.9 W öncesi (a0962e7a, hızlı, 291 ortak): AYNI 280, DEĞİŞEN 11 — yukarıdaki 7 TTL senaryosu + W1-03, W1-04, W2-01, W2-02 (W-KÖK'ün hedefi). YENİ aile YOK.
- ↔ 2.4.8 t1r (9ef34b6e, ikisi, İstanbul ve UTC; yol1; yol2): YENİ aile YOK; değişenlerin hepsi azalma ya da yukarıdaki K2.pencere / GUV-09; J1-03'ün K1.pencere satırı
  2.4.8 son (t1z) ile aynı. yol1 ↔ imzalı farkları (CIFT-01, CIFT-04, K5-03, G5-02, H3-01, J1-04, J1-05, J3-03, J3-04, J6-01, J10-01..03) Yol 1'in imzasız (wa0) kancasının
  tasarım sonucu; 2.4.8 yol1'de de aynı.
- W3-01 (yeni, kabulde 12 sa sonra 30 gün uzar): yalnız gösterim farkı (davranış 0).
HÜKÜM: YENİ fark ailesi YOK; davranış farkları ya 2.4.8'den / kâhin-W C listesinden bilinen ya da W-KÖK'ün düzelttiği TTL farklarının yerine geçen bilinen K2.pencere
(SORU 2, 2.5.0 BİLİNEN SINIR). Gerileme görülmedi.

## TOPLAM
130 kayıt = 130 koşu adı (npm test 1 + ci.yml kâhin 8 + ci.yml e2e 85 + CI dışı senaryo 16 + CI dışı kâhin 9 + WhatsApp 11); tekrar gerekmedi.
Denetim: npm test 4652/4652 + ci.yml kâhin 53987/53987 + e2e 5049/5049 + CI dışı senaryo 1321/1321 + CI dışı kâhin 44445/44461 (16 = mobil-erisim 11 + E02 ×2 +
U44/U47/U48; sayaç sürücüsü sayısız) + WhatsApp kendi testleri 1016/1016 (315+315+35+19+292+40) + WhatsApp sürücü karşılaştırmaları (bilinen aileler, 144/1752 tam) +
sürücü mutasyon 41/48 (7 bilinen dişsiz).
Ürün kodunda yeni kırmızı: YOK. Test kırmızısı: YOK (85 + 16 e2e ilk denemede). Kırmızı görünen 9 kaydın hepsi önceden belgelenmiş kâhin farkı / üretici adımı /
dişsiz eşleme; imzaları 2.4.8 kanıtıyla birebir ya da aile düzeyinde aynı (yeni aile yok).
Süre: ~4 sa 16 dk (npm test 40 dk, ci.yml kâhin 10 dk, e2e 71 dk, CI dışı senaryo 20 dk, CI dışı kâhin 23 dk, WhatsApp 81 dk; mutasyonun kesilen ilk denemesi ~11 dk).

## DENENMEYEN
- Windows ve Node 24 (yerel kapı yalnız Linux / Node 22; GitHub CI 4 platform + windows.yml ×2 — ana oturum okur, ders 1/18/21).
- Uzun koşular (test:mutabakat 5.000 × 10, test:guvenilirlik 10.000 × 5 × 2) ve mutabakat kâhin modelleri (model_a, model_b, test_surum2–4.py) — Uzun Doğrulama'da.
- Ölçek (T9), göç zinciri tam koşusu, B2/B3 süre ölçümleri (makine boşken, ayrı adım), kılavuz PDF / pdf-denetle (paket adımında; ders 42).
- Cari kâhini `--legacy` / `--kural 2.4.5|2.4.6` kipleri (2.4.5 kararıyla geçersiz 12 senaryo + 23 senaryodaki 276 geçersiz denetim).
- WhatsApp sürücüsü: imzalı yavaş uç UTC'de koşuldu ama yol1/yol2 yalnız hızlı uç + İstanbul (yol1/yol2 × UTC, yol1/yol2 × yavaş koşulmadı).
- CI dışı betiksiz yardımcı/zorla e2e dosyaları (senaryo değil): banka-210-analiz-yaris, banka-210-fetch-yaris, banka-210-planli-yaris, banka-210-yaris, bildirim-yaris-zorla
  (2.4.9'da yeni), cpu-yavaslat, e2e-not-yaris, esc-kapat, esc-kapat-ozet, form-izolasyon-b4-yaris, pencere-yaris-zorla, senaryo-211-yaris-zorla, senaryo-222-yaris,
  senaryo-225-yaris, tarayici-kesme.
- Gerçek telefon + gerçek Cloudflare tüneli + gerçek Meta (kullanıcının kurulumunda / D0).

## BİLİNEN SINIRLAR
- Mobil erişim kâhini L1 farkları (F4/F5 metin, F7, L06#8), mobil yazma kâhini E02 çifti, sayaç kâhini U44/U47/U48 — iş listesinde belgeli; bu kapıda değişmedi.
- WhatsApp kâhini: G1-borçlu-eki (gösterim), K1/K2.pencere_farkli_alici (A5; K2'nin TTL alt kümesi W-KÖK SORU 2 → 2.5.0), GUV-09 (Yol 1 wa0 tasarımı), UTC yerel gün
  farkları, sürücünün 7 dişsiz eşlemesi — hepsi önceden belgeli; bu kapıda yeni aile yok.
- edm-sayac program sürücüsü özet satırı basmadığından `kanit.mjs` hükmü BELİRSİZ; asıl hüküm karşılaştırma adımındadır.
