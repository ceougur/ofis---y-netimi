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

## Yeniden koşmak

```
npm run test:senaryo-mobil-yazma-247
npm run test:kahin-mobil-yazma -- --cikti /tmp/kahin-m5   # E27 için KAHIN_ESKI_SURUM_KOKU=<git archive v2.4.6 kopyası>
node test/mobil-yazma-247-mutasyon.mjs --kopya <git archive HEAD kopyası>   # kopyayı değiştirir; çalışma ağacında koşulmaz
node --test test/mobil-yazma-247.test.mjs
```
