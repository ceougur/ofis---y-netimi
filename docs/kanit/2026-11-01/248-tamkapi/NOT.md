# 2.4.8 T10 TAM KAPI (son aday, Aday 2 + İş Z) — yerel koşu 01.11.2026 21:03 → 02.11.2026 00:01 UTC

Ortam: linux x64, 4 çekirdek, 16 GB, Node v22.22.0; Chromium 1194 (Playwright 1.56.0, `PLAYWRIGHT_BROWSERS_PATH` not defterindeki w1-248-q7m3/pw; /opt/pw-browsers'taki
1243 uyumsuz). Disk başta 13,1 GB boş, en düşük 12,8 GB (ders 24; betik 5 GB'ın altında durur — durmadı). Her koşu `tools/kanit.mjs kos 248-tamkapi/<ad>` ile,
`flock /tmp/destekofis-olcum.lock` altında TEK TEK (ders 15); `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30). Kırmızı olan bir kez `<ad>-tekrar` adıyla yeniden
koşuldu (ders 20); kırmızının nedeni ham günlükten okundu (ders 6, 38). Ürün kodu ve depo araçları bu ajan tarafından DEĞİŞMEDİ. Kapı betiği `araclar/kapi-248.mjs.txt`
(2.4.7 kapi-247 düzeni; iki gün klasörüne bakar, GEÇTİ kaydını atlar), akış günlüğü `araclar/kapi-akisi.log`, bölüm özeti `araclar/ozet.cjs.txt`.
"+1/+2 izlenmeyen" = bu kanıt klasörlerinin kendisi.

COMMIT: koşu 054f72f9 üzerinde başladı (program kodu = 589558bd: Aday 2 + İş Z). 22:46 UTC'de ana oturum aynı ağaçta cdb06535'i commit etti (YALNIZ
test/e2e/senaryo-iz1-kasa-acilis.mjs, +4 satır; ürün kodu aynı) → 57 kayıt 054f72f9, 66 kayıt cdb06535 (ozet.cjs çıktısı). Program kodu bütün kayıtlarda aynı.
GÜN: kanit.mjs gün klasörünü koşu başındaki UTC günden seçer; gece yarısından sonra başlayan iki kayıt `docs/kanit/2026-11-02/248-tamkapi/`'de
(dis-kahin-whatsapp248-kendi, ci-e2e-senaryo-iz1-kasa-acilis-duzeltme). Ders 22: UTC gece yarısını yalnız `dis-kahin-maliyet-kendi` (23:59:36 → 00:00:23; kâhinin
kendi Python birim testi, 119/119) geçti; Türkiye gece yarısı (21:00 UTC) kapı başlamadan önceydi. Gün denetimi taşıyan e2e'ler (is-akisi-248, tarih-248) GEÇTİ.

## 1. Tam npm test — GEÇTİ
`npm-test`: 4468/4468, 0 başarısız / iptal / atlanan, çıkış 0, 2666 sn (054f72f9).

## 2. ci.yml'nin BÜTÜN listesi (ders 37)
- Kâhin satırları `ci-kahin-*` (ci.yml argümanlarıyla aynen): 8 koşu, 52697/52697 GEÇTİ — defter 176 · cari 7408 · tutar 3559 · ebelge-model 114 · ebelge-mutasyon 55 ·
  ebelge-senaryo 27 · maliyet (API) 41306 · mobil-yazma (`--haric E02…`) 52.
- e2e satırları `ci-e2e-*`: ci.yml'de `kanit.mjs kos e2e-… npm run …` satırı 82 (grep ile sayıldı; betik de 82 okudu; 2.4.8'in 5 yenisi senaryo-mobil-iphone-248,
  senaryo-whatsapp-ayar/donem/sablon/gonder-248 dahil). 82 koşu: 81 ilk denemede GEÇTİ; 1 kırmızı:
  - `senaryo-iz1-kasa-acilis` 11/14, tekrar 11/14 (aynı imza). Başarısız: "Kasa'da açılış satırı", "yürüyen bakiye açılışla başlar", ardından ✎ düğmesi 30 sn
    zaman aşımı. KÖK NEDEN (ekran görüntüsü 03-kasa-acilis-satiri: Kasa "Bu Ay" açık, tek satır "Devreden Kasa ₺26.000,00", "Bu dönemde kasa hareketi yok"): test
    ilk hareketi `day(-5)` ile girer; bugün ayın 1'i → 27.10, geçen ay; Kasa penceresi varsayılan "Bu Ay" → satırlar devreden bakiyede. Veri doğru (gösterge 26.000,
    Ana Defter 100/500/649 doğru, Mutabakat tamam). SINIF: TEST — ders 13 (tarihe bağlı; her ayın ilk 5 günü kırmızı). Ana oturum eski kodda (b2e7bf19, ayrı kopya)
    aynı 3 kırmızıyı gördü → gerileme değil; DÜZELTİLDİ cdb06535 (openCash "Tümü"). Düzeltme koşusu `ci-e2e-senaryo-iz1-kasa-acilis-duzeltme` 21/21 GEÇTİ (02.11 klasörü).
  - e2e toplam (düzeltme dahil, iki kırmızı kayıt hariç): 82 senaryo, 4304/4304 denetim; 2.4.8 WhatsApp: ayar-248 88/88, donem-248 37/37, sablon-248 45/45,
    gonder-248 189/189 (G8e/G8f dahil); mobil-iphone-248 45/45. Tam ad = sayı listesi `araclar/kapi-akisi.log`.
  - Aynı kalıp (day(-N) + "Bu Ay" varsayılanlı liste) başka e2e'de kırmızı VERMEDİ.

## 3. CI dışı senaryolar (ders 8) — 16/16 GEÇTİ (hepsi ilk denemede)
package.json'daki, ci.yml'de olmayan bütün test:senaryo-* betikleri (13; 2.4.7 ile aynı liste, yenisi yok) + ui-ux-217 + package.json'da betiği olmayan 2.4.8 T4/T7 e2e'leri
(iş listesi "Ders 16: T10'da bu iki e2e ana oturumca koşulur"): senaryo-210 57/57, 211 59/59, 212 24/24, 213 64/64, 214 48/48, 215 73/73, 216 54/54, 217 65/65,
218 50/50, senaryo-rapor 87/87, senaryo-taslak 31/31, senaryo-whatsapp 45/45, senaryo (tablodan-aktar) 30/30, ui-ux-217 407/407, is-akisi-248 184/184,
tarih-248 40/40 — toplam 1318/1318. WhatsApp 248 e2e'lerinin dördü ci.yml'de (§2).
CI dışı başka e2e dosyaları (betiksiz zorla üretme/yardımcı araç; senaryo değil): banka-210-analiz-yaris, banka-210-fetch-yaris, banka-210-planli-yaris,
banka-210-yaris, cpu-yavaslat, e2e-not-yaris, esc-kapat, esc-kapat-ozet, form-izolasyon-b4-yaris, pencere-yaris-zorla, senaryo-211-yaris-zorla, senaryo-222-yaris,
senaryo-225-yaris, tarayici-kesme → koşulmadı (DENENMEYEN, adıyla).

## 4. CI dışı kâhinler
| Koşu | Sonuç | Not |
|---|---|---|
| `dis-kahin-maliyet-tam` — `python3 -I test/bagimsiz/maliyet/kos.py` (API + arayüz) | 43758/43758 GEÇTİ | |
| `dis-kahin-mobil-erisim` — mobil-erisim/program-surucu.mjs | 31/42, 2× aynı | BİLİNEN KÂHİN FARKLARI, gerileme değil: 11 senaryo (U10 4, U11 3, U21 2, L01 6, L02 2, L04 9, L05 5, L06 2, R1 3, R2 18, R3 21 fark) ve fark satırları 30.10 son L1 karşılaştırmasıyla (`docs/kanit/2026-10-30/248-l1-kahin-2.log`; ana oturum ayrıca `248-l1-kahin-f3-karsilastirma.log` ile) BİREBİR aynı (diff boş); kabul/ret sonuçları aynı, farklar uyarı/ileti metninde = iş listesi L1 KÂHİN satırındaki F4/F5 metin kararları (BAŞ MİMAR), F7 ve L06#8 (kâhin/sürücü farkı). 2.4.7'nin 36/36'sı U01–U33(+M3) kümesiydi; L ve R 2.4.8'de eklendi. Karşılaştırma `erisim-karsilastirma.json.gz` |
| `dis-kahin-mobil-yazma-tam` — `npm run test:kahin-mobil-yazma` (--haric YOK) | 52/54, 2× aynı | Yalnız E02 çifti: `adim:t4:http: program 404 · beklenen 400`, `kod: "bank-account-missing" · beklenen "bank-account-invalid"` — ci.yml'nin `--haric` ile dışarıda tuttuğu BİLİNEN KÂHİN FARKI; 2.4.7 ile aynı imza |
| `dis-kahin-sayac-surucu` — edm-sayac/program-surucu.mjs (TZ=Europe/Istanbul) | BELİRSİZ (çıkış 0) | Üretici adım, özet satırı basmaz ("50 senaryo yazıldı … not içeren senaryo: 15"); çıktı `sayac-program.json` 2.4.7'ninkiyle (JSON) AYNI |
| `dis-kahin-sayac-karsilastir` — kahin.py karsilastir (2.4.7 birleşimi) | 47/50, 2× aynı | U44, U47, U48 — 2.4.7 kapısıyla BİREBİR aynı satırlar (diff boş): U44/U48 DENENMEYEN (programda üretilemez), U47 BİLİNEN KÂHİN FARKI (S4) |
| `dis-kahin-sayac-kendi` | 136/136 GEÇTİ | |
| `dis-kahin-erisim-kendi` | 150/150 GEÇTİ | (2.4.7: 123; L1 güncellemesiyle 150) |
| `dis-kahin-yazma-kendi` | 152/152 GEÇTİ | |
| `dis-kahin-maliyet-kendi` | 119/119 GEÇTİ | gece yarısını geçti (birim testi) |
| `dis-kahin-whatsapp248-kendi` — `python3 -I test/bagimsiz/whatsapp-248/kahin/kahin_test.py` | 307/307 GEÇTİ | 02.11 klasörü. WhatsApp T1 sürücü koşusu bu kapıda koşulmadı (ana oturum 01.11'de yaptı, 054f72f9) |

## TOPLAM
118 koşu adı (npm test 1 + ci.yml kâhin 8 + ci.yml e2e 82 + iz1 düzeltme 1 + CI dışı senaryo 16 + CI dışı kâhin 10); tekrarlarla 123 kayıt (iz1, mobil-erisim,
mobil-yazma-tam, sayac-surucu, sayac-karsilastir ikişer). Denetim (tekrarlar ve iz1'in iki kırmızı kaydı sayılmadan): npm test 4468 + ci.yml kâhin 52697 + e2e 4304
+ CI dışı senaryo 1318 + CI dışı kâhin 44752/44768 (16 = mobil-erisim 11 senaryo + E02 ×2 + U44/U47/U48; sürücü adımı sayısız).
Ürün kodunda yeni kırmızı: YOK. Tek yeni kırmızı (iz1-kasa-acilis) TEST hatası (ders 13), düzeltildi (cdb06535), düzeltme 21/21. Öbür kırmızılar önceden belgelenmiş
kâhin farkları / üretici adımı, imzaları önceki koşularla birebir aynı.
Süre: ~3 sa (npm test 44 dk, ci.yml kâhin 11 dk, e2e 69 dk, CI dışı senaryo 22 dk, CI dışı kâhin 31 dk).

## DENENMEYEN
- Windows (yerel kapı yalnız Linux; Windows CI'de ve windows.yml'de — ana oturum okur, ders 1/18).
- Uzun koşular (mutabakat 5.000 × 10, güvenilirlik 10.000 × 5 × 2) ve mutabakat kâhin modelleri (model_a, model_b, test_surum2–4.py) — Uzun Doğrulama'da.
- Ölçek (T9), göç (T5/T6) — bu kapının kapsamı dışında. Kılavuz PDF / pdf-denetle — paket adımında (ders 42).
- WhatsApp T1 sürücü koşusu (ana oturum bugün yaptı; tekrar edilmedi), WhatsApp kâhininin `senaryolar.py` üretici denetimi (depo dosyası yazabildiği için koşulmadı).
- CI dışı yardımcı/zorla e2e dosyaları (§3'te adıyla).
- Gerçek telefon + gerçek Cloudflare tüneli + gerçek Meta (kullanıcının kurulumunda / D0).

## BİLİNEN SINIRLAR
- Mobil erişim kâhini L1 farkları (F4/F5 metin, F7, L06#8), mobil yazma kâhini E02 çifti, sayaç kâhini U44/U47/U48 — iş listesinde belgeli; bu kapıda değişmedi.
- edm-sayac program sürücüsü özet satırı basmadığından `kanit.mjs` hükmü BELİRSİZ; asıl hüküm karşılaştırma adımındadır.
- Kayıtların bir kısmı 054f72f9, bir kısmı cdb06535'te (fark yalnız bir e2e test dosyası).
