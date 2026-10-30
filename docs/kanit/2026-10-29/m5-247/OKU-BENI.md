# M5 — Mobilden Yazma (2.4.7) · Kanıt

Dal `worktree-agent-ac5df26589a6fb9c9` (taban 53192737). Commit'ler: eef95704 (uçlar + kâhin sürücüsü), a1e299b6 (telefon ekranları + e2e), c2bf0657 (mutasyon
taraması), f9c9e4bb (form.elements + e2e Y2b), sonuncusu bu belge ve tam test kanıtı. Tasarım ve kararlar: `docs/mobil/M5-TASARIM.md`.

Her koşu `node tools/kanit.mjs kos` ile (KANIT_DIR bu klasör → çıktılar `2026-10-29/` alt klasöründe; `.json` = çıkış kodu + sayılar + commit, `.log` = ham çıktı).
Eski kod (kırmızı kanıt, ders 23/25): `git archive 53192737` → not defteri `m5-247-eski-53192737` (benzersiz klasör), yeni testler üstüne kopyalandı.

## Yeşil (yeni kod)

| Koşu | Komut | Sonuç | Commit |
|---|---|---|---|
| m5-e2e-senaryo-mobil-yazma-247 | `npm run test:senaryo-mobil-yazma-247` (telefon 390×844, gerçek tıklama/Tab, uzak dinleyici) | GEÇTİ 61/61 | f9c9e4bb |
| m5-e2e-senaryo-mobil-247 | `npm run test:senaryo-mobil-247` (M1 + T7 yeni beklenti) | GEÇTİ 77/77 | f9c9e4bb |
| m5-e2e-senaryo-mobil-eslesme-247 | `npm run test:senaryo-mobil-eslesme-247` (M2) | GEÇTİ 35/35 | f9c9e4bb |
| m5-mutasyon | `node test/mobil-yazma-247-mutasyon.mjs --kopya <git archive c2bf0657>` | 22/22 mutasyon yakalandı | c2bf0657 |
| m5-kahin-cari | `npm run test:kahin-cari` | GEÇTİ 7408/7408 | c2bf0657 |
| m5-kahin-mobil-yazma | `KAHIN_ESKI_SURUM_KOKU=<git archive v2.4.6> node test/bagimsiz/mobil-yazma/program-surucu.mjs --cikti …` | 45/52 senaryo eşleşti; 7 fark aşağıda | f9c9e4bb |
| m5-tam-npm-test | `npm test` (bir kez, bitişte) | 3757/3758 — 1 kırmızı: `test/ci-kapi-listesi.test.mjs` "her test:kahin-* betiği CI'de kanit.mjs kos ile koşar" (yeni `test:kahin-mobil-yazma` CI'de yoktu) | f9c9e4bb |
| m5-duzeltme-dar | düzeltmeden sonra: ci-kapi-listesi, kanit-araci, lisans-servisi-izolasyonu, lisans-nobetci, platform-tasinabilirlik, mobil-yazma-247, mobil-247, yazim-duzeni | GEÇTİ 119/119 | f9c9e4bb + ci.yml / sürücü değişikliği (sonraki commit) |
| m5-kahin-mobil-yazma-ci | CI'deki adımın aynısı: `npm run test:kahin-mobil-yazma -- --haric E02×2,E05×2,R1–R3` (E27 v2.4.6 etiketinden kendiliğinden `git archive`) | GEÇTİ 45/45, göreli 2 aynı + 2 uygulanmaz | aynı |

Kâhin çıktısı: `kahin-cikti/karsilastirma.tap`, `notlar.json`, `program.json.gz`. Birleşim (S1–S8): `kapatilacak=yalniz_fifo;yollar=nakit_havale_pos;taksit=kart_secilir;
onay=sorar;eksi_stok=sorar;tarih=sunucu_gunu;gec_yeniden=telefon_24s;stok_yonu=yalniz_giris` (kâhinin beklentilerine dokunulmadı; yalnız `secilen_birlesim`). Göreli çiftler:
G1 aynı, G4 aynı, G2 uygulanmaz (S8; bilgi aynı), G3 uygulanmaz (S2; bilgi fark — mobilde evrak yok, beklenen).

## Kırmızı (eski kod 53192737 — `kirmizi/`)

| Koşu | Sonuç | Neden (iletiden) |
|---|---|---|
| m5-eski-53192737-birim | 0/19 (19 başarısız) | `405 mobile-read-only` — yazma ucu yok; oturum özetinde yazma hakkı yok; `yazma-bekleyen.js` yok |
| m5-eski-53192737-e2e-mobil-yazma | 2/12 | "kayıt girişi açık notu" yok; `[data-yazma]` düğmesi yok (bekleme 8 sn doldu) |
| m5-eski-53192737-kahin (E01/E05/E07/E19/E30) | 1/6 (yalnız masaüstü E01 eşleşti) | mobil adımlar `405 mobile-read-only`, beklenen 200 / 409 plan-overpay |
| m5-y2b-secici-mutasyonu-e2e.log | 60/61 | seçiciyi yok sayan mutasyon: "İkinci 1000 → 1000, Ana 1000 → 1250" (para yanlış hesaba) |

Mutasyonlar (22): yön ×3, tutar ×2, hesap ×2, S1 ×2, istek kimliği ×3, şirket, S6, S4 ×3, S8, yetki (ekran), yetki (çekirdek accounts.mjs), FIFO (çekirdek
invoice-settle.mjs), yineleme yanıtı. Birim 21/22 (kaçırdığı: #7 POS/Kredi Kartı yolunu nakde çevirme — kâhin yakaladı); kâhin alt kümesi (19 senaryo) 17/22
(kaçırdıkları: #4 virgüllü tutar — alt kümedeki mobil tutarlar ondalıksız ya da reddi beklenen biçimde (E09 "12,345", "1.234,56"); #12 kimliksiz istek — sürücü her istekte kimlik gönderir; #14 telefon tarihi — telefon tarih göndermez; #19 oturum
özetindeki yazma hakları — kâhin ekran özetini okumaz; #20 personelin NAKİT ödemesi — E28 yalnız havale / kart ödemesini dener; dördünü de birim yakaladı). Birlikte 22/22.

## Kâhin farkları (7 senaryo; kök neden sınıfları — `analiz` not defteri betiğiyle her adım farkı bir sınıfa, her kontrol farkı önceki adım farkına bağlandı)

| Sınıf | Adet | Nerede | Kök neden | Hüküm |
|---|---|---|---|---|
| K8-AVANS | 14 adım | R1–R3 | Ödenmiş karta (kalan 0) gelen tahsilatta program `plans.manage` yetkilisine "Fazlasını Avans Yaz" izni verir (masaüstü 2.3.0'dan beri; `hof-plans.js` plan-paid'de de sunar); kâhin 409 plan-paid bekler. Mobil = masaüstü. | KULLANICIYA SORU (ders 43) — kural değişmedi |
| ODENEN-TANIM | E05 çifti + R1–R3'te 9 kontrol | kart "Ödenen" | Program kart Ödenen'ine avansa giden kısmı da katar; kâhin katmaz. `tani:…odenenAvansHaric` her durumda kâhinin beklentisine EŞİT; fazla, kalan, cari bakiye, Kasa eşleşir. | İNCELE (tanım; para sonucu aynı) |
| POS-HAVALE | 2 adım | E02 çifti | Havale yoluna POS kimliği: program 404 bank-account-missing, kâhin 400 bank-account-invalid; iki kanal aynı, kayıt yok. | İNCELE (ret kodu) |
| UC-ONDALIK | 3 adım | R1–R3 (masaüstü) | Masaüstü API `12,345` gibi 3 ondalıklı tutarı yuvarlayarak kabul eder; plan §9.2/9 en çok 2 ondalık. Mobil yol reddeder (400 mobile-amount). | BULGU — masaüstü, M5 dışı |
| CEK-ISTEK-KIMLIGI | 2 adım | R2, R3 (masaüstü) | Masaüstü çek / senet girişinde (`POST /api/workspace/cheques`) istek kimliği yok → aynı istek iki evrak açar (plan §3.10/1). S2 gereği mobilde evrak yok. | BULGU — masaüstü, M5 dışı |
| CEK-BASKA-SIRKET-CARISI | 4 adım | R1, R2 (masaüstü) | Başka şirketin cari kimliğiyle evrak: program 400, kâhin 403/404; kayıt yok. | İNCELE |
| RET-SIRASI | 2 adım | R2 | Silinmiş cari + hesapsız havale: program 404 (cari önce), kâhin 400 bank-account-required (hesap önce); kayıt yok. | İNCELE (ret sırası) |

Kontrol farklarının geri kalanı (R1 27, R2 40, R3 43) bu adım farklarının zincir sonucudur (aynı şirket, aynı cari/kart/hesap, sonraki kontrol); bağlanamayan kontrol
farkı yalnız ODENEN-TANIM.

## CI'de kâhin (düzeltme)

Tam `npm test`'in tek kırmızısı üzerine kâhin CI'ye girdi (ci.yml e2e işi, kahin-maliyet'ten sonra; kapının `--beklenen` listesinin sonuna `kahin-mobil-yazma`). Kullanıcı
kararı bekleyen K8-AVANS (R1–R3) ve İNCELE farklı E02/E05 çiftleri `--haric` ile adıyla dışarıda; çıktıda her biri "HARİÇ" satırıyla yazılır, bilinmeyen ad hatadır.
Karar / düzeltme gelince listeden çıkarılır (o zaman R1–R3 de CI'de koşar). E27 CI'de v2.4.6'nın gerçek koduyla (etiketten AYRI geçici klasöre `git archive`, sonra silinir).

## K8 sonrası (taban 35ee4992 → dal m5-k8-247): R1–R3 farklarının kök nedenleri

Kullanıcı K8-AVANS'ta (a)'yı seçti; kâhin bakımcısı kâhini güncelledi (143/143). Ana oturumun koşusu 49/54 (E05 ve yeni E41 eşleşti). Kalan adım farkları tek tek
yeniden üretildi (kâhinin adım tanımı + programın yanıtı + aynı cari/şirketteki önceki adımlar; ders 6), her biri bir kök nedene bağlandı. Kontrol farklarının HEPSİ
(R1 C2_05, R2 C2_01, R3 C1_04: bakiye / Kasa / POS / fatura açığı 1.235 kuruş + 1 hareket) 3 ondalık adımının zinciridir; bağlanamayan kontrol farkı yok.

| Adım(lar) | Ne | Kök neden | Sınıf | Kanıt |
|---|---|---|---|---|
| R2 d2182, R3 d197 (masaüstü evrak, aynı istek kimliği) | program ikinci evrakı açtı, kâhin 409 | `POST /api/workspace/cheques` istek kimliği almıyordu (plan §3.10/1 "bütün kapsamlar"); masaüstü formu da göndermiyordu — yanıtı kaybolan Kaydet ikinci evrak, carinin borcu iki kez düşer | **PROGRAM HATASI — DÜZELTİLDİ** (5f371c36, c499809c) | birim 5/5 (eski 1/5: "İKİNCİ EVRAK AÇTI (2 evrak; cari bakiye 3000)"), e2e 12/12 (eski 5/12; istemci mutasyonu da 5/12), mutasyon 23–25 3/3; kâhinde ikisi eşleşti |
| R1 t1048, R2 t1405, R3 t1425 (masaüstü cari tahsilatı "12,345") | program yuvarlayıp kaydetti, kâhin 400 | Plan §5.1 "Girdi: **Banka uçlarında** `parseMinor`; 2'den çok ondalık 400"; 2.1.0 yargıç düzeltmesi (`docs/GECMIS-KARARLAR.md` 1058: "§5.1'in … kuralı yalnız BANKA uçları içindir; modül uçları (cari, fatura, taksit…) plana göre 'bugünkü gibi' 1,005 → 1,01 yuvarlar") | **KÂHİN OKUMA HATASI** (§9.2/9 cari ucuna uygulanmış) — program değişmedi | mobil yol 3 ondalığı reddeder (400 mobile-amount, BAŞ MİMAR KARARI 3) |
| R1 t539, R2 t159 / t2303 / t79 (masaüstü evrak, gövdede başka şirketin carisi) | program 400, kâhin [403, 404] | Gövdedeki kimlik alanı programda 400 (taksit, stok, evrak, fatura uçlarında aynı düzen: "Seçilen cari bulunamadı"); yoldaki cari 404 (E16 eşleşir). Plan §9.2/11 "başka şirketin hesap kimliği 404" banka HESABI içindir | **KÂHİN ÇIKARIMI** (SENARYO-DILI §5.6 grup 4 genellemesi) — program değişmedi | kayıt açılmaz; para etkisi yok |
| R2 t191 (mobil), t554 (masaüstü) havale: başka şirket carisi + seçilmemiş banka hesabı | program 404 (cari), kâhin 400 bank-account-required | İki ihlal tek adımda. SENARYO-DILI §5.6 sıralamayı ÇIKARIM sayar ve "senaryo tek ihlal kurar; kurarsa karşılaştırıcı o adımda yalnız durum sınıfını (4xx) karşılaştırır [BELİRSİZ-17]" der; kâhin tam kodu karşılaştırıyor | **KÂHİN OKUMA HATASI** — program değişmedi | iki taraf da 4xx, kayıt yok |
| E02 çifti t4 (havale yoluna POS kimliği) | program 404 bank-account-missing, kâhin 400 bank-account-invalid | Kâhin POS'u "hesap" sayar; programda POS banka hesabı değil (ayrı tablo) → hesap bulunamadı | **KÂHİN MODEL FARKI** (bilinen, İNCELE) — program değişmedi | iki kanal aynı, kayıt yok |

Sonuç (5f371c36): tam kâhin 49/54 (`m5k8-kahin-mobil-yazma-tam`; farklar yukarıdaki üç kâhin sınıfı + E02; ana oturumun koşusundaki d2182/d197 eşleşti); CI kipi
(`--haric E02×2,R1–R3`) 49/49 (`m5k8-kahin-mobil-yazma-ci`); cari kâhini 7408/7408 (`m5k8-kahin-cari`). Kâhin çıktısı `kahin-cikti-k8/`.

Mutasyon (`m5k8-mutasyon`, 25 mutasyon): 24/25 — #24 ("Yine de Kaydet" onayı içerik sayılır) kaçtı: test yalnız bayraklı tekrarı deniyordu. Test güçlendirildi
(onaylı kaydın bayraksız yeniden gönderimi = formun Kaydet'i), hedefli tarama 23–25 3/3 (`m5k8-mutasyon-evrak-23-25`). İstemci mutasyonu (form kimlik
göndermez) e2e'de kırmızı: `kirmizi/m5k8-istemci-kimlik-mutasyonu-e2e.log` (5/12).

e2e (c499809c, `m5k8-e2e-*`): senaryo-cek-istek-kimligi-247 12/12 (yeni), senaryo-mobil-yazma-247 61/61, senaryo-mobil-247 77/77, senaryo-mobil-eslesme-247 35/35;
komşu evrak yolları (ders 9, 10 — Çek / Senet formunu açan / kullanan senaryolar): senaryo-banka-220 76/76, senaryo-224 63/63, senaryo-226 22/22,
senaryo-form-izolasyon-243 183/183, senaryo-211 59/59.
Tam `npm test` (bir kez, 2548c867, temiz ağaç): 3838/3838, çıkış 0 (`m5k8-tam-npm-test`).

## Yeniden koşmak

```
npm run test:senaryo-mobil-yazma-247
npm run test:kahin-mobil-yazma -- --cikti /tmp/kahin-m5   # E27 için KAHIN_ESKI_SURUM_KOKU=<git archive v2.4.6 kopyası>
node test/mobil-yazma-247-mutasyon.mjs --kopya <git archive HEAD kopyası>   # kopyayı değiştirir; çalışma ağacında koşulmaz
node --test test/mobil-yazma-247.test.mjs
```
