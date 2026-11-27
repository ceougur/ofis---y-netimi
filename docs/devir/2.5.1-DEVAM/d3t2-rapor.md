# D3 TUR 2 raporu — devir saf hesabının eksik testleri + DOĞRULANMADI maddeleri + gerçek veri kapsamı (2.5.1)

Ajan: D3 TUR 2 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur1` (e1a6f263). Yeni özellik YOK; D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme).
SON HÂL (27.11.2026). Bulunan beş plan hatası düzeltildi (§1); bir para / kapama sorusu (§9); D4a şartları (§10).

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Her satır "ne ters giderse devirli ≠ devirsiz olur ya da plan yanlış sayı / yanlış madde verir". Sağdaki numara tur 1'in 42 maddelik tablosundaki karşılığı (d3-rapor.md §0).
Test adları planlanan adlardır (son hâli §4).

### (a) K'den SONRA yazılmış, K'den ÖNCEKİ belgeye bağlı kayıt — bağ yönlendirmesi (tur 1: 1, 23, 28)
| # | Bozulma | Beklenen (plan) | Test |
|---|---|---|---|
| a1 | Ocak tahsilatı "Kapatılacak Fatura" ile Aralık'ta AÇIK faturaya bağlı | `baglar[]` satırı `tur: acik-kalem`, `yeniHedef = devir-<yıl>-kalem-inv:<fatura>`; açık kalem tutarı K'deki kalan (Ocak tahsilatı DÜŞMEZ) | devir-d3-bag |
| a2 | Ocak tahsilatı K'de KAPANMIŞ (≤K ödenmiş) faturaya bağlı | `tur: arsiv-basvurusu` + `arsiv { yil, no, tarih }`; açık kalem YOK | devir-d3-bag |
| a3 | Kısmi bağ: ≤K bağlı kısmi tahsilat + K sonrası bağlı kalan tahsilat | açık kalem = fatura − ≤K bağlı tutar; K sonrası bağ açık kaleme | devir-d3-bag |
| a4 | K sonrası Mahsup Et: `invoice_offsets.invoice_id` ≤K faturada (karşısı ≤K ya da >K) | bağ listesinde; karşı taraf ≤K ise o da (counter_id) | devir-d3-bag |
| a5 | K sonrası Mahsup Et: `invoice_id` >K fatura, KARŞI fatura (`counter_id`) ≤K | bağ listesinde (karşı tarafın yönlendirmesi) — okuyucu yalnız `invoice_id`'ye bakarsa KAÇAR | devir-d3-bag |
| a6 | K sonrası iade faturası (`invoices.original_id`) ≤K faturanın iadesi | bağ listesinde (iade → asıl fatura bağı, TYK karar (2)) — okuyucu `original_id`'ye bakmazsa KAÇAR | devir-d3-bag |
| a7 | K sonrası alınan çek "Kapatılacak Fatura" ile ≤K faturaya bağlı (`cheque_events.invoice_id`) | bağ listesinde | devir-d3-bag |
| a8 | K sonrası banka havalesi faturaya bağlı (`account_entries.invoice_id`, source 'bank') | bağ listesinde | devir-d3-bag |
| a9 | ≤K tarihli satır ≤K faturaya bağlı (bağın İKİ tarafı da K'den önce) | bağ listesinde YOK (arşivde kalır) | devir-d3-bag |
| a10 | Bağ K sonrası satırdan K sonrası faturaya (iki taraf da >K) | bağ listesinde YOK | devir-d3-bag |
| a11 | Bağlı K sonrası tahsilatın tutarı açık kalemden büyük (fazlası serbest) | bağ yine açık kaleme; devirsiz bakiye = devirli satırlar + K sonrası | devir-d3-bag (bakiye) |

### (b) Evrakın K'deki durumu (tur 1: 4, 28)
Koddaki durumlar (`lib/cheques.mjs` STATUSES): portfolio, endorsed, collected, bounced, pending, paid; bankada tahsilde (`cheque_collections`: pending / collected / withdrawn / returned).
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| b1 | Alınan çek K'de portföyde | `evraklar[]` durum portfolio, 101.01; modül farkı yok | devir-d3-evrak |
| b2 | Alınan senet K'de portföyde | portfolio, 121.01 | devir-d3-evrak |
| b3 | Çek ≤K bankaya tahsile verilmiş, K'de tahsilde | bank, 101.02 | devir-d3-evrak |
| b4 | Çek ≤K tahsile, K'den SONRA tahsil edilmiş | K'de bank (sonraki olay sayılmaz) | devir-d3-evrak |
| b5 | Çek ≤K tahsile, ≤K tahsil edilmiş | listede YOK (kapanmış) | devir-d3-evrak |
| b6 | Çek ≤K ciro edilmiş | endorsed, hesap yok (iz) | devir-d3-evrak |
| b7 | Çek ≤K ciro, K'den SONRA karşılıksız | K'de endorsed | devir-d3-evrak |
| b8 | Çek ≤K karşılıksız (carisine borç) | bounced, hesap yok; carinin açık kalemi `karsiliksiz` | devir-d3-evrak |
| b9 | Çek K'de portföyde, K'den SONRA tahsil / karşılıksız / ciro | K'de portfolio (sonraki durum TAŞINMAZ) | devir-d3-evrak |
| b10 | Verilen çek K'de ödenmemiş | pending, 103; verilen senet 321 | devir-d3-evrak |
| b11 | Verilen çek ≤K ödenmiş | listede YOK | devir-d3-evrak |
| b12 | Verilen çek K'den SONRA ödenmiş | K'de pending | devir-d3-evrak |
| b13 | Vadesi K'den sonra olan portföy çeki | vade aynen; durum portfolio | devir-d3-evrak |
| b14 | K'den SONRA alınmış çek | listede YOK | devir-d3-evrak |
| b15 | Silinmiş evrak / Geri Al'ınmış olay | silinmiş listede YOK; geri alınan olay sayılmaz | devir-d3-evrak |
| b16 | Tahsile verilip ≤K bankadan geri alınmış | K'de portfolio (101.01) | devir-d3-evrak |
| b17 | "Teminata verilmiş" | programda böyle durum YOK (STATUSES) — sınanamaz, raporda | — |

### (c) Alt hesaplı öbür hesaplar (tur 1: 5, 35)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| c1 | Banka hesabı 102.NN havale / EFT tahsilat ve ödemeleri | `banka[]` 102.NN = K bakiyesi; modül farkı yok | devir-d3-banka |
| c2 | İki banka arası virman | iki alt hesap ayrı, Σ değişmez | devir-d3-banka |
| c3 | POS tahsilatı K'de, valörü K'den sonra | 108.NN bekleyen = brüt; K'den sonra valörlenen 102'ye geçmemiş | devir-d3-banka |
| c4 | Kredi kartıyla ödeme (309.NN) + karttan ödeme (card_payment) | 309.NN = K borcu (alacak bakiyeli) | devir-d3-banka |
| c5 | Kredi kullanımı (300.NN) | 300.NN = K borcu | devir-d3-banka |
| c6 | K'den SONRA olan banka hareketleri | K bakiyesine girmez | devir-d3-banka |
| c7 | Her alt hesap: arşiv kapanış = yeni yıl açılış | `modul-farki` yok, `banka[]` tutarları = `kapanisBakiyeleri` | devir-d3-banka |

### (d) Şablonlar ve e-Belge olguları — GERÇEK veri tabanından (tur 1: 14, 19, 22)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| d1 | Aktif tekrarlayan fatura (≤K şablon) | `sablonlar[]` satırı + UYARIR; durdurulmuş tekrar listede YOK; >K şablon YOK | devir-d3-olgu |
| d2 | ≤K e-Belge gönderim bekliyor / Listeden Sil'inmiş / sonucu belirsiz | ön denetim DURDURUR (adet okuyucunun SQL'inden); >K olan sayılmaz | devir-d3-olgu |
| d3 | Taslak fatura ≤K | ön denetimde (adet) | devir-d3-olgu |
| d4 | Numara sayaçları | planda sayaç alanı VAR MI — yoksa raporda (D4a'nın ihtiyacı) | devir-d3-olgu (tarama) |

### (e) Şüpheli cari, K'den sonra faturaya bağlı tahsilat (tur 1 DOĞRULANMADI)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| e1 | Fatura ≤K, Şüpheliye Al ≤K, faturaya bağlı tahsilat K'den SONRA | 128 = K'deki şüpheli kalan; `supheli-farki` YOK (yanlış DURDURMA da hata) | devir-d3-supheli |
| e2 | Aynısı, ≤K kısmi bağlı tahsilat + K sonrası bağlı tahsilat | 128 = K'deki kalan (yalnız ≤K tahsilat düşer) | devir-d3-supheli |
| e3 | Karşılık ≤K, Değersiz K'den SONRA | 129 = K'deki karşılık | devir-d3-supheli |
| e4 | BM-1: şüpheli carinin "Alacak Toplamı" (bugünkü sayılar SABİT) | ELLE yazılı sayılar | devir-d3-supheli |

### (f) K'den SONRA "Borçta Kalsın" ile kapanan kart (tur 1 BM-5)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| f1 | Kart K'de açık, Ocak'ta Borçta Kalsın | plan K'de `acik`; taksit vadeleri kartın ASIL vadeleri (kapanış günü DEĞİL); açık kalem yok | devir-d3-supheli (kart) |
| f2 | Aynı kart devirsiz eşdeğer: gecikmiş(t) devirli = devirsiz | — | devir-d3-supheli (kart) |
| f3 | Kart ≤K Borçta Kalsın (kontrol) | `kapali`, kalan açık kalem `kart-kalani` | devir-d3-supheli (kart) |

### (g) Dönem Kilidi (tur 1 DOĞRULANMADI)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| g1 | Kilit yok / kilit K'den önce / kilit K'yi kapsıyor (= K, > K) | plan (veriSurumu hariç) AYNI; değişmezler tutar | devir-d3-olgu |
| g2 | Ön izleme kilit geçmişine dokunur | `ledger.lockedUntil` ve denetim izindeki kilit satırları önce = sonra | devir-d3-olgu |

### (h) K günü ve K+1 günü aynı tutarlı iki kayıt (tur 1: 9)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| h1 | 31.12 ve 01.01'de aynı cariye aynı tutarlı tahsilat / Borç Yaz | 31.12 K bakiyesinde, 01.01 yeni yılda; tablo sayımında biri ≤K biri >K | devir-d3-bag |

### BM-6 (planın ödeme satırını yazmaya yetecek alanları)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| m1 | Ödeme rolündeki açık kalemde rol / asıl tarih / tutar / karşı kalem eksik | her ödeme kaleminde `rol: odeme`, `vade` (asıl tarih), `tutarMinor`, `belge.satirId` (karşı kalem = kaynak satır), `yon` | devir-d3-supheli (BM-6) |

### Gerçek veri (ders 17)
Tur 1 üreteci yalnız fatura / tahsilat / ödeme / stok üretiyordu → v2.5.0 GERÇEK koduyla kart, evrak, şüpheli, KDV mahsubu, vergi ödemesi, banka, iade, sil + geri yükle, pasif cari, aynı adlı iki cari
eklenir; bozulma "devirsiz eşdeğer ≠ 0" ya da sorun / değişmez kırmızısı.

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Ekran YOK (D5). Değişen yalnız ön izleme uçlarının (`POST/GET /api/admin/devir/preview…`) sonucu — planın, ön denetimin ve Devir Raporu'nun sayıları. Var olan hiçbir yolun yanıtı değişmedi (kâhin defter / cari tur 1 ile AYNI — §6 A).

| # | Ne | Önce (tur 1) | Sonra (tur 2) | Örnek (test) |
|---|---|---|---|---|
| H1 | Bağ listesi (`newYear.baglar`) | K sonrası Mahsup Et'in KARŞI belgesi (`invoice_offsets.counter_id`) ve K sonrası iade faturasının ≤K asıl faturası (`invoices.original_id`) listede YOKTU → D4a bu bağları yönlendiremezdi | ikisi de listede (`alan: "counter_id"` / `tablo: "invoices", alan: "original_id"`) | B1: 15.01.2027 mahsubun karşı alışı AL-B2 → arşiv başvurusu; A4: 18.01.2027 iade → F5'in devir kalemi (devir-d3-bag) |
| H2 | M12: K'de bakiyesi 0, açık kalemsiz ama HAREKETLİ cari | iki eşit satır ("Devir — Borç Toplamı" 350,00 + "Devir — Alacak Toplamı" 350,00) yazılıyordu; Devir Raporu ve "açılış yazılacak cari" sayısında görünüyordu | HİÇ satır yok (EK-1 M12 AYNEN: "iki seçenekte de") | Z carisi: 350,00 çek alındı + karşılıksız → satır 0 (devir-d3-evrak) |
| H3 | POS'un 108.NN bakiyesi | `atanmamis: true`, ad "Kredi Kartı Tahsilatları (POS)", sahibi yok → D4a bunu "alt defter yeri belirsiz" (BM-2) sayardı | sahibi POS tanımı: `posTerminali: <pos kimliği>`, `tur: "pos"`, `atanmamis: false`, ad = POS adı ("Mağaza POS") | 108.01 780,00 (devir-d3-banka) |
| H4 | Ön denetim — e-Belge | "Gönderilecek e-Belge" yalnız `e_status = 'waiting'`; "Sonucu Belirsiz" yalnız `processing` → numara almış gönderilmemiş / hata almış belge ve yanıtı kaybolan gönderim (programın "Sonucu Belirsiz"i) devri DURDURMUYORDU | programın tanımıyla (Gönderilecekler = `unsentSql`; Sonucu Belirsiz = `uncertainSend` + İşleniyor); belirsiz olan bekleyen sayılmaz | 10.02.2027: DURDURUR bekleyen 1 → 2 (W1 + W6), belirsiz 0 → 1 (W3) (devir-d3-olgu) |
| H5 | 129 Şüpheli Alacak Karşılığı | cari boyutunda bekleniyordu; program 129'u CARİSİZ yazar → karşılığı olan HER şirkette `supheli-farki` + `modul-farki` → devir yanlışlıkla DURUYORDU ("Devir Hesabı Tutmuyor") | carisiz 129 hücresi karşılıkların toplamıyla karşılaştırılır (cari boyutlu hücre varsa eskisi gibi) | D3: karşılık 500,00 → sorun 3 → 0 (devir-d3-supheli) |

Plan biçimi tur 1'e göre (sürücü ajanı ve D4a için): `newYear.banka[]` satırına `posTerminali` ("" ya da pos_terminals.id) eklendi; 108'de `tur: "pos"`. `newYear.baglar[]` satırında `alan` artık `"counter_id"` olabilir, `tablo` artık `"invoices"` (alan `"original_id"`) olabilir. Başka alan değişmedi. BM-6 alanları (rol, vade = asıl tarih, tutar, yön, `belge.satirId`, `kaynakKimlik`) zaten vardı — testle SABİTLENDİ, ekleme gerekmedi.

## 2. DEĞİŞEN DOSYALAR
- Ürün (D3 modülleri): `server/lib/devir/plan-reader.mjs` (H1, H3 okuma, H4), `server/lib/devir/plan.mjs` (H2, H3, H5). Başka ürün dosyası değişmedi (tek borç sırası, mali tablo, değerleme, defter, D2, şüpheli / evrak / kart modülleri OKUNDU).
- Yeni testler: `test/devir-d3-bag.test.mjs` (6), `test/devir-d3-evrak.test.mjs` (3), `test/devir-d3-banka.test.mjs` (2), `test/devir-d3-olgu.test.mjs` (5), `test/devir-d3-supheli.test.mjs` (5).
- Değişen test araçları: `test/fixtures/devir-d3-esdeger.mjs` (bağ yönlendirmesi benzetimi `redirect`; devir satırlarının kayıt anı; K sonrası şüpheli kayıt), `test/devir-d3-gercek-veri.mjs` (zengin üreteç; `--sade` = tur 1 üreteci), `test/devir-d3-mutasyon.mjs` (+14 mutant), YENİ `test/devir-d3-hacim-tyk.mjs` (hız incelemesi, CI dışı).

## 3. TARAMA (ders 10)
`git grep -l -E "obligation-queue|financial-statements|stock-valuation|routes/devir|lib/devir/|ledger-snapshots|registerDevirRoutes|fixtures/devir-d3" -- 'test/*.test.mjs'` → 42 dosya (tur 1'in 33'ü + D3'ün 9 dosyası) + kaynak tarayan / statik 8 (yazim-duzeni, lisans-servisi-izolasyonu, platform-tasinabilirlik, banka-210-post-statik, banka-210-statik, banka-210-yetki-matrisi, banka-210-rapor-is-parcacigi-kapanis, sema-kapisi-bs7) + `devir-d2-arsiv-250` (bütün yazma uçları).

| Koşu | TZ | Sonuç |
|---|---|---|
| d3t2-komsu-utc | UTC | GEÇTİ 514/514, 0 iptal, 0 atlanan |
| d3t2-komsu-ist | Europe/Istanbul | GEÇTİ 514/514, 0 iptal, 0 atlanan |

## 4. Yeni testler — eski kod (t251-d3-tur1, AYRI kopya `git worktree add --detach /dev/shm/d3t2-t2/eski t251-d3-tur1`; yalnız yeni 5 test dosyası + yeni yardımcı `test/fixtures/devir-d3-esdeger.mjs` — ders 51) ↔ yeni kod

Koşular: `d3t2-eski-son-utc` / `-ist` 16/21 geçti, 5 KIRMIZI (iki TZ'de AYNI beş test); `d3t2-yeni-son-utc` / `-ist` 63/63 (tur 1'in 42 testi + bu turun 21'i). İlk hâl koşuları (`d3t2-eski-*`, `d3t2-yeni-*`, commit 4af4ba8) aynı sonuç.

**E-1 — tur 1 kodunda KIRMIZI olanlar = bulunan hatalar (neden iletiden okundu — ders 38):**
| Test | Kırmızı nedeni (eski kod iletisi) | Hata |
|---|---|---|
| devir-d3-bag › bağ listesi (elle) | beklenen `invoice_offsets/counter_id` (AL-B2, AL-B4) ve `invoices/original_id` (F5) satırları YOK | H1 |
| devir-d3-banka › her alt hesap K bakiyesiyle | 108.01: `posTerminali` alanı yok, `atanmamis: true`, ad "Kredi Kartı Tahsilatları (POS)" | H3 |
| devir-d3-evrak › kapanış = açılış | Z carisi (bakiye 0, kalemsiz): satır sayısı 2, beklenen 0 | H2 |
| devir-d3-olgu › ön denetim (10.02.2027) | `e-belge-bekleyen` 1 (beklenen 2), `e-belge-belirsiz` YOK (beklenen 1) | H4 |
| devir-d3-supheli › (e) şüpheli K payı | sorunlar: `supheli-farki` 129 cari "" (−500,00 ↔ 0) + `modul-farki` 129 | H5 |

**E-2 — tur 1 kodunda da YEŞİL olanlar (yeni sınıf testi — dişi mutasyonda; kırmızı kanıt diye YAZILMAZ — ders 7, 38):** bağ: açık kalemler (elle), DEVİRSİZ EŞDEĞER (yönlendirmeli), S-T2-1 sayıları, DİŞ (yönlendirmesiz fark), K / K+1 (h1); evrak: her evrak K durumuyla, ön izleme sayıları; banka: kapanış = açılış; olgu: veri tabanı durumları, iptal süresi, Dönem Kilidi dört durum, kilitli dönemde kural değişikliği; şüpheli: BM-1 sabit sayılar, (f) K sonrası Borçta Kalsın, (f) devirsiz eşdeğer taksitler, BM-6. Dişleri mutantlarda (§5: M16–M29).

## 5. Mutant tablosu (`test/devir-d3-mutasyon.mjs`, `git archive HEAD` kopyası /dev/shm/d3t2-t2/mut, commit f6ce2988; taban 48/48)
`d3t2-mutasyon-utc` 29/29 YAKALANDI · `d3t2-mutasyon-ist` 29/29 YAKALANDI. Tur 1'in 15 mutantı AYNEN yakalanıyor (M1–M15). Bu turun 14'ü:
| # | Mutant | Sınıf | Kırmızı test |
|---|---|---|---|
| 16 | K sonrası bağ açık faturanın devir kalemine değil arşive | bağ yönlendirmesi | bağ listesi |
| 17 | Mahsup Et'in karşı belgesi okunmaz | bağ | bağ listesi |
| 18 | iade → asıl fatura okunmaz | bağ | bağ listesi |
| 19 | bankada tahsildeki evrak portföyde sayılır | evrak durumu | her evrak / sayılar / kapanış |
| 20 | K'deki değil BUGÜNKÜ son olay | evrak durumu | her evrak / sayılar / kapanış |
| 21 | 309 banka açılışlarına girmez | alt hesap açılışı | her alt hesap / kapanış |
| 22 | POS alt hesabının sahibi okunmaz | alt hesap | her alt hesap |
| 23 | K sonrası tahsilat / Değersiz de şüpheliden düşülür | şüphelinin K payı | (e) |
| 24 | 129 cari boyutunda (tur 1 hâli) | şüpheli | (e) |
| 25 | K'den sonra kapanan kart K'de kapalı | kart (vade / durum) | (f) |
| 26 | kilitli dönemde donmuş defter yerine canlı türetme | kilit | kural değişikliği |
| 27 | M12 satırı yazılır | cari satırı | evrak kapanış |
| 28 | Sonucu Belirsiz sayılmaz | e-Belge olgusu | ön denetim |
| 29 | numaralı gönderilmemiş belge sayılmaz | e-Belge olgusu | ön denetim |

## 6. Kabul koşullarının sayıları
- **A** `test:kahin-defter` 187/187 UTC + İstanbul; `test:kahin-cari` 25.298/25.298 UTC + İstanbul — tur 1 ile AYNI (d3t2-kahin-*).
- **B** tur 1'in bütün testleri + bu turun testleri 63/63 iki TZ (d3t2-yeni-son-*); komşular 514/514 iki TZ (d3t2-komsu-*).
- **C** mutantlar 29/29 iki TZ (d3t2-mutasyon-*).
- **D** gerçek veri: §7.
- **E** §4.

## 7. GERÇEK VERİ (iş 3; ders 17) — v2.5.0'ın GERÇEK koduyla, üç tohum × iki TZ
Üretim: `git worktree add --detach /dev/shm/d3t2-t2/v250 v2.5.0` (v2.5.0 ↔ t251-taban arasında server/ farkı YOK). 001'de zengin sınıflar, TAKVİM SIRASIYLA (sahte saat her olayın gününe; ileri tarihli satır yok), ≤K veri bitince Dönem Kilidi K (01.01.2027 00:30), K sonrası olaylar kilitten sonra (S24 = A — devirsiz eşi "aynı kilitle"); 002 tur 1 üreteciyle. Her koşu: üç ön izleme (iki seçenek), sorun yok, 12 değişmez, bayt bayt aynı plan, DURDURUR yok, iki seçenekte açık kalemler ve net aynı, ≤K + >K = toplam, 002 ayrı, DEVİRSİZ EŞDEĞER (bağ yönlendirmeli; ≤K kartlı / ≤K şüpheli cariler benzetim dışı — sayısı aşağıda).

| Koşu (commit f6ce298) | Sonuç | Devirsiz eşdeğer (karşılaştırma / fark) | Benzetim dışı cari | Bağ listesi (açık kaleme / arşive) |
|---|---|---|---|---|
| utc t7 (-son) · ist t7 | 16/16 · 16/16 | 3.600 / 0 · 3.600 / 0 | 43 | 32 (6 / 26) |
| utc t11 (-son) · ist t11 | 16/16 · 16/16 | 3.540 / 0 · 3.540 / 0 | 48 | 37 (8 / 29) |
| utc t23 (-son) · ist t23 | 16/16 · 16/16 | 3.720 / 0 · 3.720 / 0 | 33 | 31 (10 / 21) |

İki TZ aynı tohumda AYNI veriyi üretti (sınıf sayıları birebir). 001: 343 cari (300 müşteri + 40 tedarikçi + 2 aynı adlı + 1 pasif), ~5.100 işlem, 14 ay; 002: 1.288 işlem.

**Üretilen sınıf sayıları (API yanıtı 2xx; "ret" = reddedilen istek, veri üretmedi — ders 3)** — tohum 7 / 11 / 23 (iki TZ'de aynı):
| Sınıf | t7 | t11 | t23 |
|---|---|---|---|
| satış / alış / tahsilat / ödeme / Borç Yaz / Kasa | 1.680 / 280 / 1.260 / 168 / 336 / 84 | aynı | aynı |
| bağlı tahsilat (Kapatılacak Fatura) | 311 | 311 | 314 |
| — K'den SONRA, ≤K faturaya bağlı | 24 | 24 | 20 |
| taksit kartı (Mevcut Borç) (ilk denemede ret: borç tutarı aşan toplam — programın söylediği tutarla bir kez yeniden) | 34 (ilk ret 72) | 35 (67) | 30 (69) |
| taksit tahsilatı / son taksit / erken kapama | 34 (ret 1) / 17 (ret 1) / 5 | 43 / 14 (ret 1) / 7 | 30 (ret 1) / 15 (ret 1) / 7 |
| Borçta Kalsın ≤K / K'den SONRA | 3 / 0 | 5 / 0 | 3 / 1 |
| çek alındı / senet alındı / verilen evrak | 119 / 49 / 56 | 125 / 43 / 56 | 121 / 47 / 56 |
| evrak: tahsil / ciro / ciro sonrası karşılıksız / karşılıksız / ödendi | 31 / 24 / 6 / 10 / 41 | 27 / 32 / 9 / 24 / 43 | 36 / 21 / 5 / 8 / 43 |
| evrak: bankaya tahsile / bankadan tahsil / bankadan geri al | 52 / 27 / 17 | 41 / 22 / 16 | 39 / 18 / 17 |
| evrak sil + geri yükle | 8 + 8 | 5 + 5 | 16 + 16 |
| Şüpheliye Al (ret: borç bakiyesini aşan tutar) | 18 (ret 24) | 23 (ret 19) | 11 (ret 31) |
| Karşılık / kısmi Değersiz / tam Değersiz / Şüpheliden Çıkar | 5 / 6 / 0 (ret 1) / 3 | 8 / 7 / 0 (ret 4) / 2 | 6 / 4 / — / 3 |
| şüpheli cariye K'den SONRA bağlı tahsilat | 4 | 7 | 6 |
| KDV Mahsup Fişi (aylar atlanarak) / Vergi Ödemesi | 7 / 7 | 8 / 8 | 9 / 9 |
| Aralık mahsubu K'den sonra (K kilidi reddetti — beklenen) | — | ret 1 | ret 1 |
| iade faturası (≤K / K'den SONRA) | 75 / 4 | 74 (ret 1) / 6 | 75 (ret 1) / 5 |
| banka: havale / EFT / POS / kartla ödeme / karttan ödeme / virman / kredi | 252 / 56 / 168 / 28 / 14 / 14 / 1 | aynı | aynı |
| tahsilat sil + Silinenler'den geri yükle | 14 + 14 | 14 + 14 | 14 + 14 |
| pasif cari / aynı adlı iki cari | 1 / 2 | 1 / 2 | 1 / 2 |
Veri tabanından (t7): evrak durumları bounced 16 · collected 58 · endorsed 18 · paid 41 · pending 15 · portfolio 76; tahsil kaydı 52; şüpheli kayıt 18, karşılık 5; aktif KDV mahsubu 7; iade 79; banka olayı 2.778; POS kalemi 168; kilit 31.12.2026. Plan (t23): evrak 115 (portföy 73, tahsilde 3, ciroda 16, karşılıksız 12, verilen 11); kart 29; şüpheli 7 kayıt; vergi satırı 8.

**Farklar ve kök nedenleri (ders 6):** ilk koşularda utc t7 (12 karşılaştırma, bir cari) ve utc t11 (12, bir cari) AYRIŞTI. Yeniden üretildi (kalan veri kopyasında, `scratchpad/d3t2/incele.mjs`, `hepsi.mjs`): (1) t7 — eşit vadeli iki devir kaleminde benzetim, yönlendirilen fatura kaleminin ASIL kayıt anını taşıyordu (öbür devir satırının kayıt anı boş) → K sonrası bağsız iade tutarı yanlış kaleme gitti. Plan doğru (kalemler vade, belge tarihi sırasında); benzetim düzeltildi (d219fcb0) — D4a şartı BM-T2-2. (2) t11 — 14.01.2027'de Şüpheliye Al'ınan cari: devirsiz kuyruk bu kaydın payını tutuyor, benzetim yeni yılın kuyruğuna şüpheli kaydı hiç koymuyordu. Plan doğru (K'de kayıt yok); benzetim düzeltildi (f6ce2988: K'den sonraki kayıt yeni yılın kuyruğuna). İkisinde de aynı veride yeniden karşılaştırma 0 fark; son koşular yukarıda.

## 8. HIZ İNCELEMESİ (iş 5; KOD DEĞİŞİKLİĞİ YOK — H-1 kararı kullanıcıda)
ÖZEL kilit `flock -x -w 1800 olcum.lock`: istek 12:12:10, ALINDI 12:36:03 UTC. Yük başta 1,50 / sonda 1,18 (en yüksek 1 dk 1,5 ≤ 2) → **GEÇERLİ** (ders 52). Veri: `ana-kabul/temiz-100k` kendi kopyam (/dev/shm/d3t2-t2/veri100k; 261.326 para satırı, 1.484 cari), K = 31.12.2025, şimdi 08.10.2026. Kod: ölçüm kopyası (/dev/shm/d3t2-t2/olcum = commit 4af4ba8 ürün kodu + YALNIZ buildObligations'a süre sayaçları; ürün kodu değişmedi). Ham çıktı `docs/kanit/2026-11-27/d3t2-hiz-tyk.log`. Ana iş parçacığında, tek okuma işleminde.

| Bileşen | ms | Not |
|---|---|---|
| **okuyucu toplam** | **15.085** | (iş parçacığı yok; uç iş parçacığında aynı iş) |
| · okuma (SQL, sayımlar) | 838 | |
| · yevmiye (canlı türetme + karma yevmiye) | 2.495 | canlı türetme 2.264, karma 28 |
| · **tek borç sırası bölümü** | **9.736** | ayrıntı aşağıda |
| · değerleme | 465 | |
| · ön denetim | 1.550 | Defter Mutabakatı + Kural Farkı + sayımlar |
| plan | 1.293 | Bilanço 488 + Gelir Tablosu K 86 + 3 önceki yıl 246 dahil |
| **toplam (okuyucu + plan)** | **~16.4 sn** | bütçe ≤ 10 sn — ~1,6 kat AŞIYOR |

Tek borç sırası bölümünün İÇİ (ayrı adım adım koşu): şüpheli ayırımı 8 · `ledgerLines` 1.953 (124.025 satır; 24.791'i K'den SONRA — okunup süzülüyor) · `settleTables` 623 · `obligationExtras` 244 · döngü 7.853 (süzgeç 45 · girdi 396 · **buildObligations 7.400**).
buildObligations İÇİ (1.484 çağrı): withEditCuts 4 · implicitRefunds 585 · **runQueue "side" (fatura durumu görünümü) 3.204 (%43)** · runQueue "net" (TYK) 3.070 (%41) · assemble 531. Cari başına: ortanca 2,4 ms, %90 14,1, %99 23, en çok 34 ms (98 satır / 19 fatura). CPU profili (öz süre): queueOnce 2.282 · çöp toplayıcı 1.053 · add 819 · coverForcing 456 · coverEvent 351 · arrive 291 · addInstallments 242.

**Devrin ihtiyaç duymadığı hesaplar:** planın okuduğu yalnız `items` (net görünümün kalemleri) ve `installments`; "side" görünümünün asıl ürünü fatura durumu (`invoices`: ödendi / kısmi / kapatanlar) devirde KULLANILMIYOR. assemble "side"dan yalnız iade notlarını (notesOf) alır — net kalemlere etkisi DOĞRULANMADI.

**'Devre özel dar kip' tahmini (SAYIYLA):** "side" koşusu atlanırsa buildObligations 7,4 → ~4,2 sn (−3,2 sn); assemble'ın fatura durumu kısmı da atlanırsa ~−0,3 sn daha. Tek borç sırası bölümü 9,7 → ~6,2 sn; toplam ~16,4 → **~12,9 sn** — dar kip TEK BAŞINA bütçeyi (10 sn) KARŞILAMAZ. `ledgerLines`'ın ≤K süzgeçli okuması (K sonrası %20 satır) ~−0,4 sn daha (tek borç sırası girdi kurucusu — dosya sınırı dışı) → ~12,5 sn.
**Tek borç sırasını DEĞİŞTİRMEDEN devir tarafında:** (1) değerlemenin ikinci `at(K)` çağrısı (planın yinelemesi) yalnız 6,6 ms — kazanç yok; (2) karma yevmiye 28 ms (canlı türetme TEK kez — yineleme yok); (3) önceki 3 yılın Gelir Tablosu 246 ms + Bilanço 488 ms — B-9 kararı (tam Bilanço kalsın) aynen, kazanç < 0,5 sn; (4) ön denetim 1,55 sn — Defter Mutabakatı'nın beklenenleri (`ledger.expected`) cari listesi verilmeden kendi okumasını yapıyor: listenin verilmesi ölçülmedi (DOĞRULANMADI, tahmini < 0,3 sn); (5) okuma 838 ms — tablo sayımında satır başına alt sorgu (invoice_lines / bank_lines / ledger_voucher_lines / ledger_valuation_cards) JOIN'e çevrilirse tahmini ≤ 0,4 sn (ölçülmedi). Devir tarafındaki kazançların toplamı ~1 sn civarı — bütçeyi kurtarmaz.
**Sonuç (karar için):** ölçülmüş geçerli toplam ~16,4 sn (100 bin satır, ana iş parçacığı). Dar kip + devir tarafı kazançlarıyla tahminen ~11,5–12,5 sn; 10 sn için TYK'nın "net" koşusunun kendisinin de hızlanması gerekir (H yapısal hız işi). H-1 seçenekleri (tur 1 raporu §8) bu sayılarla kullanıcıya.

## 9. KULLANICIYA SORULMALI
**S-T2-1 (para / kapama — ders 43; uç durum): K'den SONRA yapılan "Mahsup Et"in KARŞI belgesi K'den önceki bir alış faturası olursa.**
Ne oluyor (test `devir-d3-bag` B2, elle): Aralık'ta satış 400,00 (vade 20.12) ve alış 150,00; Ocak'ta yeni satış 300,00 (vade 30.01) kesilip 17.01.2027'de bu Ocak satışı Aralık alışıyla 150,00 Mahsup Et yapılıyor.
Program (devirsiz) Mahsup Et'i tarihten bağımsız uyguladığı için Aralık alışını o mahsuba ayırır: Aralık satışı 400,00 açık, Ocak satışı 150,00 açık. Devir planı ise K durumunu yalnız K ve öncesi kayıtlarla kurar: K'de alış Aralık satışını netlemiştir → Aralık satışı 250,00 açık; alış arşivde kalır, Ocak mahsubu yeni yılda karşı belgesiz kalır → Ocak satışı 300,00 açık.
Bakiye iki yolda da AYNI (550,00); gecikmiş 01.01–29.01 arası devirsiz 400,00 ↔ devirli 250,00 (01.02'den sonra ikisi de 550,00). Ocak satışının "açık" tutarı devirden önce 150,00, sonra 300,00 görünür.
- **A:** böyle kalsın — K durumu yalnız ≤K kayıtlarla (bugünkü plan; S24 = A'nın ruhu); mahsubun karşı belgesi arşiv başvurusu olur, mahsup yeni yılda etkisiz. Sayılar: Aralık satışı 250,00 (gecikmiş), Ocak satışı 300,00.
- **B (öneri):** plan K sonrası Mahsup Et'lerin ≤K karşı belgesini K kuyruğunda o mahsuba AYIRIR (karşı alış yeni yıla açık alacak kalemi olarak devreder, mahsup ona yönelir) → devirli = devirsiz: Aralık satışı 400,00, Ocak satışı 150,00. Plan + D4a değişikliği (bağ listesinde zaten var).
- **C:** uç durum böyle kalsın (BİLİNEN SINIR).
Yaygın programlarda nasıl: belgesi okunmadı — DOĞRULANMADI. Öneri B: kullanıcının yaptığı mahsup devirden sonra "kaybolmaz", fatura açıkları değişmez (DEVİRLİ = DEVİRSİZ değişmezi). Şimdilik KODLANMADI; testte sayılar SABİT (yanıta göre tek test değişir).

## 10. BAŞ MİMAR KARARI GEREKİYOR
- **BM-T2-1 (D4a şartı — bağ yönlendirmesi):** tek borç sırası bağı yalnız FATURA kalemine (`inv:<fatura>`) kurar. Planın `yeniHedef`i (devir kalemi) bir cari satırıdır; D4a açık fatura kalemini, K sonrası bağların (Kapatılacak Fatura, çek olayı, iade → asıl fatura, Mahsup Et, banka havalesi) ona tutunabileceği biçimde yazmalı. Benzetim (`redirect`: kalem kuyruğa faturanın kendi satırı gibi, K+1 tarihli, planın tutarı ve vadesiyle) devirli = devirsiz verdi; yönlendirmesiz (bağsız dağılan) benzetim A8'de AYRIŞIYOR (diş testi). Öneri: D4a'da fatura kalemi için "devir belgesi" (faturanın kimliğiyle tutulan açılış kaydı) ya da TYK'ya devir kalemini bağ hedefi olarak tanıtma — tek borç sırası dosya sınırı dışında, ayrı paket + dar kontrol.
- **BM-T2-2 (D4a şartı — yazım sırası):** devir satırları aynı tarihte (K+1) ve aynı kayıt anında olacağı için tek borç sırasının S2 eşitlik bozucusu (belge tarihi) kaybolur; eşit vadeli açık kalemlerin sırası ancak YAZIM SIRASI ile korunur. Plan satırları zaten (vade, belge tarihi) sırasında — D4a bu sırayla yazmalı. Gerçek veride (UTC tohum 7) benzetimdeki bir sapma bunu gösterdi (kök neden benzetimde; düzeltildi).
- **BM-T2-3 (bilgi; S205 = A'nın sonucu):** K'den SONRA Borçta Kalsın ile kapanan kartın K'deki taksit vadesi "MIN(asıl vade, kapanış günü)" görünür (örnek: 4. taksit 01.02.2027 yerine 10.01.2027). Devirsiz program bugün aynısını gösterir; plan = devirsiz (değişmez sağlanıyor). Tur 1 BM-5 böylece kapandı — "K anındaki" vade değil, programın bugünkü vadesi. Öneri: böyle kalsın (davranış değişmedi).
- **BM-T2-4:** ön denetimin "Gönderilecek e-Belge" sayımı programın Gönderilecekler tanımını izliyor; yalnız CANLI ortamda test serili (TEF / TEA / TES) gönderilmemiş belgenin Gönderilecekler'den düşülmesi kolu YOK (okuyucu ortam ayarını bilmiyor) → canlıda böyle bir ≤K belge varsa devir "Gönderilecek" diye durur (program o belgeyi "iptal edilmeli" diye ayrı gösterir). Öneri: durdurmaya devam etsin ama metin "iptal edin" desin — D5 metin işi.
- Tur 1'in BM-2'si (alt defter yeri belirsiz hücreler) DARALDI: POS'un 108.NN'si artık belirsiz değil (H3); 102.00 / 108.00 (gerçekten atanmamış) ve 336.90 aynen.

## 11. SONRAKİ SÜRÜME (20.11 kuralı — programı / kullanıcıyı etkilemeyen)
- Ön izleme sayısı "POS bekleyen" tasarım §3.3'te "brüt" diye tanımlı; planın sayısı defterin 108 bakiyesi (komisyon tahsilat günü gider yazıldığı için NET; örnek 800,00 tahsilat → 780,00). Sayı defterle doğru — görünüm adı / tanım (D5).
- Gerçek veri betiği her koşuda veriyi baştan üretiyor (~13 dk / tohum); `--veri` (hazır veriyi yeniden kullanma) eklenmedi.
- Benzetim (`test/fixtures/devir-d3-esdeger.mjs`) ≤K kartlı / ≤K şüpheli carileri kapsamıyor (D4a'nın yazımı) — gerçek veride bu cariler eşdeğerin dışında (sayısı §7'de).

## 12. DOĞRULANMADI
- Dar kipin kazancı (−3,2 sn) "side" koşusunun süresinden tahmin; assemble'ın iade notlarını "side"dan almasının net kalemlere etkisi ölçülmedi.
- Ön denetimde `ledger.expected`'e cari listesi verilmesinin ve tablo sayımının JOIN'e çevrilmesinin kazancı (tahmin; ölçülmedi).
- 1 M satırda hız (betik hazır; ana oturum).
- BM-1 içeriği kâhinle karşılaştırılmadı (sayılar SABİT; kâhin karşılaştırma ajanı).

## 13. DENENMEYEN
- K'den ÖNCE alınmış çekin bağının K'den SONRA değiştirilmesi (evrak düzeltmesiyle "Kapatılacak Fatura" — bağ anı denetim izinde, olay tarihi ≤K): okuyucu yalnız K sonrası OLAY tarihine bakar → bu bağ listede yok. Uç durum; test yazılmadı.
- K'den sonra fatura Düzenle'siyle eklenen peşin ödeme (`source = 'invoice'` satırı K sonrası tarihli): bağ listesine girip girmediği sınanmadı.
- "Teminata verilmiş" evrak: programda böyle durum YOK (STATUSES) — sınanamaz.
- Gelen e-Fatura kutusu (gerçek veri tabanından; sahte EDM gelen kutusu kurulmadı) — tur 1'deki olgu testi aynen.
- Numara sayaçları: planda sayaç alanı YOK; sayaçlar `settings` (D sınıfı — dokunulmaz) ve yıl bazlı seri — D3'te okunacak bir şey yok, D4'ün işi.
- Windows: yeni testler dosya silmez / taşımaz (ders 48 kapsamı dışı); CI'de ana oturum görür.
- 002 zengin veri (zengin sınıflar yalnız 001'de; 002 tur 1 üreteciyle).
- Tam `npm test` (ana oturum).

## 14. Tur 1'in DOĞRULANMADI / DENENMEYEN listesinin SON durumu
| Tur 1 maddesi | Son durum |
|---|---|
| DOĞRULANMADI: hız / olay döngüsü kesin ölçüm | KAPANDI (geçerli ölçüm, yük 1,5): okuyucu + plan ~16,4 sn (§8); 1 M ve olay döngüsü ölçülmedi (hız incelemesi bileşen içiydi) |
| DOĞRULANMADI: K sonrası bağlı tahsilatı olan şüpheli caride K payı (olası yanlış durdurma) | KAPANDI — K payı doğru (D1 / D2: 128 = 600,00). AYRICA hata bulundu ve düzeltildi: 129 karşılıklı her şirkette yanlış DURDURMA (H5) |
| DOĞRULANMADI: K'den sonra Borçta Kalsın kartının vadeleri (BM-5) | KAPANDI — plan = devirsiz (S205 = A geriye işler; BM-T2-3) |
| DOĞRULANMADI: Defter Mutabakatı ↔ tam Mutabakat (BM-3) | AÇIK — BM-3 kabul edildi (BAŞ MİMAR 27.11), değişmez |
| DOĞRULANMADI: evrakın K durumu, karşılıksız / iade sınıfları | KAPANDI — bütün durumlar API verisiyle (devir-d3-evrak) + gerçek veride (§7). Ayrıca H2 bulundu |
| DOĞRULANMADI: kilit geçmişine K eklenmedi | KAPANDI — dört kilit durumunda plan aynı, ön izleme kilide / ize dokunmuyor; kural değişikliğinde donmuş defter okunuyor (devir-d3-olgu) |
| DOĞRULANMADI: BM-1 içeriği kâhinle | AÇIK — sayılar SABİTLENDİ (Borç Toplamı 600,00 / Alacak Toplamı 600,00 / açık kalem 400,00); kâhin karşılaştırması ayrı ajan |
| DENENMEYEN: madde 1 K sonrası bağın yönlendirilmesi | KAPANDI — test + benzetim; hata H1 bulundu ve düzeltildi; D4a şartı BM-T2-1; kural sorusu S-T2-1 |
| DENENMEYEN: madde 4 / 28 evrak | KAPANDI (yukarıda) |
| DENENMEYEN: madde 5 / 35'in 108 / 309 / 300 alt hesapları | KAPANDI — devir-d3-banka; hata H3 |
| DENENMEYEN: madde 22 şablon okuyucu SQL'i | KAPANDI — devir-d3-olgu (etkin ≤K var, durdurulmuş ve K sonrası yok) |
| DENENMEYEN: madde 14 / 19 e-Belge okuyucu SQL'i | KAPANDI — hata H4 |
| DENENMEYEN: gerçek veride kart, çek, şüpheli, KDV mahsubu, banka | KAPANDI — zengin üreteç (§7) |
| DENENMEYEN: D4 / D5 maddeleri (11, 15, 17, 18, 21, 23–26; 33'ün yeni yıl tarafı) | AÇIK — D3 yazmaz (değişmedi) |
| DENENMEYEN: kâhin ↔ plan, ekran senaryosu, tam npm test | AÇIK — ayrı ajan / D5 / ana oturum |

## 15. CI listesine eklenecek
- `test/devir-d3-bag|evrak|banka|olgu|supheli.test.mjs` npm test deseniyle (`test/**/*.test.mjs`) kendiliğinden girer — ci.yml'ye ekleme GEREKMEZ. Yeni ekran senaryosu YOK.
- CI DIŞI (elle / Uzun Doğrulama adayı): `node test/devir-d3-gercek-veri.mjs --eski <v2.5.0 kopyası> --tohum <n>` (zengin; `--sade` tur 1 üreteci), `node test/devir-d3-mutasyon.mjs --kopya <git archive HEAD>`, `node test/devir-d3-hacim-tyk.mjs <ölçüm kopyası> <veri kopyası> [K] [şimdi]` (iç adımlar için kod kökü buildObligations'a sayaç eklenmiş ayrı kopya; yoksa iç adımlar "okunamadı").

## 16. Kılavuz metni önerisi (D5'te; bu pakette kılavuza DOKUNULMADI)
Tur 1'in metnine ek: "Ön Denetim, Gönderilecekler'deki (gönderilmemiş ya da hata almış) ve sonucu belirsiz e-Belgeleri de durdurur: önce gönderin ya da Durum Sorgula ile sonucunu öğrenin." · "Ocak'ta yaptığınız ve Aralık belgesine bağlı tahsilat, çek, iade ve mahsuplar devirden sonra o belgenin devir satırına bağlı kalır."

## 17. DEVİR NEDEN DURDU (kullanıcı 27.11 11:39 kuralı)
Bu tur yeni DURDURUR nedeni EKLEMEDİ; düzeltilen iki yol mevcut Türkçe maddeleri kullanır ("Gönderilecek e-Belge … Devirden önce gönderin.", "Sonucu Belirsiz e-Belge Gönderimi … Sonucunu sorgulayın.", gidilecek yer Faturalar › Gönderilecekler). H5 bir YANLIŞ "Devir Hesabı Tutmuyor" (iç kodlu ayrıntıyla) maddesini kaldırdı. İç kod (`plan-supheli-farki` vb.) maddenin `kod` alanında — ekranda gösterilmemesi D5'in işi.

## 18. Commit listesi (dal `worktree-agent-a60e6bc6251c04493`, taban e1a6f263 `t251-d3-tur1`)
- a1479204 nasıl bozulur listesi (koddan önce)
- e3b8f132 K sonrası bağlar — Mahsup Et'in karşı belgesi ve iade → asıl fatura bağı (H1); bağ yönlendirmesinin devirsiz eşdeğer testi (S-T2-1 sayılarıyla)
- ecefab44 evrakın K'deki durumu; M12 (H2)
- 0cdd5c29 banka / POS / kredi kartı / kredi; POS'un 108'i POS tanımına (H3)
- f70fe733 ön denetim olguları gerçek veri tabanından — e-Belge (H4); şablon, taslak, iptal süresi; Dönem Kilidi
- 59472dd3 129 carisiz (H5); şüpheli K payı, K sonrası Borçta Kalsın, BM-1, BM-6 testleri
- f5a40ad2 gerçek veri üreteci zengin sınıflarla
- 4af4ba88 kilitli dönemde kural değişikliği testi; 14 yeni mutant
- afa8138f hız incelemesi betiği
- cc97bfc0 gerçek veri betiği kendi geçici klasörünü siler
- b25a9e3c eşdeğer yardımcısının kapsam açıklaması
- 5f324364 rapor taslağı (ara durum)
- d219fcb0 eşdeğer benzetimi — devir satırlarının kayıt anı (gerçek veri t7)
- f6ce2988 eşdeğer benzetimi — K sonrası şüpheli kayıt (gerçek veri t11)
- 5d2f23e4 Kanıt: D3 tur 2 koşuları
- (bu rapor commit'i — dal ucu SubagentHandback iletisinde)

## 19. Ana oturumun yeniden koşacağı komutlar
```
cd <bu dal>; export HUKUK_LICENSE_URL=http://127.0.0.1:9
T="test/devir-d3-plan.test.mjs test/devir-d3-esdeger.test.mjs test/devir-d3-uc.test.mjs test/devir-d3-zaman.test.mjs test/devir-d3-bag.test.mjs test/devir-d3-evrak.test.mjs test/devir-d3-banka.test.mjs test/devir-d3-olgu.test.mjs test/devir-d3-supheli.test.mjs"
for tz in UTC Europe/Istanbul; do TZ=$tz node tools/kanit.mjs kos d3t2-$tz -- node --test --test-concurrency=1 $T; done          # 63/63
# eski kod kırmızısı: git worktree add --detach <yer>/eski t251-d3-tur1; yalnız yeni 5 test + test/fixtures/devir-d3-esdeger.mjs kopyalanır → 16/21, beş kırmızı (§4)
# mutasyon: git archive HEAD server test package.json | tar -x -C <kopya>; node test/devir-d3-mutasyon.mjs --kopya <kopya>   # 29/29
# gerçek veri: git worktree add --detach <yer>/v250 v2.5.0; TZ=UTC node test/devir-d3-gercek-veri.mjs --eski <yer>/v250 --tohum 7   # ~13 dk / tohum
# hız (ÖZEL kilit): ölçüm kopyası = git archive HEAD + buildObligations'a sayaç (yalnız kopyada); flock -x -w 1800 scratchpad/olcum.lock node test/devir-d3-hacim-tyk.mjs <ölçüm kopyası> <temiz-100k kopyası> 2025-12-31 2026-10-08T12:00:00+03:00
npm run test:kahin-defter; npm run test:kahin-cari
```
Ortam (bitişte): yük ~3,5 / 4 çekirdek, bellek kullanılabilir ~9 GB, disk boş ~9,5 GB. Kendi kopyalarım (/dev/shm/d3t2-t2: eski kod, v2.5.0, mutasyon, ölçüm, 100 bin veri kopyaları) ve iki git worktree kaydı iş bitince TAM yolla kaldırıldı; /tmp/d3-gercek-veri-3ZbYX5 kalan bir duman koşusu klasörü olabilir (benim olduğundan emin değilim — silinmedi).
