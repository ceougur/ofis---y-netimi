# D3 TUR 3 raporu — üç devir kararının kodu + "devir neden durdu" iletileri + tur 2'nin açık bıraktıkları (2.5.1)

Ajan: D3 TUR 3 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur2` (0ae33184). D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme + ön denetim + Devir Raporu).
SON HÂL (27.11.2026). Üç kararın kodu (S-KD-1 = A, S-KD-2 = A, S-KD-3 = B — EK İZİN kullanıldı), DEVİR NEDEN DURDU ileti düzeni (tek yardımcı), S-C5C-9 uyarısı; yeni para / kapama sorusu yok (§9); BAŞ MİMAR maddeleri §10.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Her satır: "ne ters giderse kullanıcı yanlış yönlenir / devir yanlış geçer / devir yanlış durur". Yanlış DURDURMA da hatadır (kullanıcı devir yapamaz).
Test adları planlanan adlardır (son hâli §4).

### S-KD-1 — düzeltme fişinin düzeltemediği alt defter farkı (KULLANICI: A — devir DURUR; "Kilidi Aç → Yeniden Kilitle" ile geçer)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| k1-1 | Kural farkı cari başına toplamda 0 (aynı caride 120 +4.000 / 128 −4.000) ama ön denetim farkı TOPLAMDAN (Σ = 0) ararsa devir yanlış GEÇER | DURDURUR; ilette iki satır da (cari adı, hesap, tutar) | devir-d3-kural (S-KD-1) |
| k1-2 | İki AYRI caride +4.000 / −4.000 (hesap toplamı 0) | DURDURUR (cari başına) | devir-d3-kural |
| k1-3 | Aynı cari, aynı hesap, iki yılda +4.000 / −4.000 (kilit günündeki birikim 0) | DURDURMAZ (birikim 0 — fark yok; yanlış durdurma olmasın) | devir-d3-kural |
| k1-4 | İletide çare yok ya da "Kural Farkı Düzeltme Fişi'ni yazın" der (fiş alt defteri düzeltemez → kullanıcı çıkmaza girer) | ileti: "Kilidi Aç → Yeniden Kilitle" adım adım; Nereye: Dönem Kilidi | devir-d3-kural |
| k1-5 | Çare uygulandıktan sonra (gerçek API: kilidi aç, yeniden kilitle, dondurma biter) devir hâlâ durur | GEÇER; plan güncel kuralla (donmuş = canlı) | devir-d3-kural |
| k1-6 | Fark hiç yokken durdurma | DURDURMAZ | devir-d3-kural |
| k1-7 | Hem fişle düzeltilebilen hem alt defter farkı | ikisi de listede (fiş satırları + alt defter satırları); adımlar ikisini de söyler | devir-d3-kural |

### S-KD-2 — kilit tam K'de iken düzeltme fişi K+1'e düşer (KULLANICI: A — devir DURUR; kilit geri alınır, fiş eski yılda, kâr ait olduğu yılda)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| k2-1 | Kilit = K, fişle düzeltilebilen ≤K farkı var; ileti genel "Fişi yazın" derse kullanıcı fişi 01.01'e yazar (fark yanlış yıla) | DURDURUR; ileti: Dönem Kilidi'ni K'den önceki güne al → fişi (K tarihli, tutarı) yaz → yeniden K'ye kilitle; eski yılın kârına etkisi SAYIYLA | devir-d3-kural (S-KD-2) |
| k2-2 | Kilit = K iken kullanıcı fişi 01.01'e YAZMIŞ (fiş K+1): plan satırı kalmadığı için devir yanlış GEÇER | DURDURUR (fiş yeni yılda); ileti: fişi Ters Kaydet → kilidi geri al → fişi eski yılda yaz → yeniden kilitle | devir-d3-kural |
| k2-3 | Kilit K'den ÖNCE (30.06): fiş 01.07 (eski yıl) — S-KD-2 iletisi yanlışlıkla çıkarsa kullanıcı gereksiz kilit oynatır | S-3 iletisi (fişi yaz); fiş yazılınca GEÇER; eski yılın kârı fiş tutarı kadar değişir | devir-d3-kural |
| k2-4 | Kilit hiç yok: kural farkı tanımsız | DURDURMAZ; kâr canlı türetmeden | devir-d3-kural |
| k2-5 | Kilit K'yi AŞIYOR (15.01) ve fark ≤K maddede | DURDURUR (S-KD-2 — fiş K'den sonraya düşer) | devir-d3-kural |
| k2-6 | Kilit K'yi aşıyor ve fark YALNIZ K'den sonraki maddede | S-KD-2 DEĞİL (fark yeni yılın; S-3 genel iletisi) | devir-d3-kural |
| k2-7 | Çare uygulanınca (gerçek API: kilit 30.12 → fiş 31.12 → kilit 31.12) devir hâlâ durur ya da kâr değişmez | GEÇER; `archive.donemSonucuMinor` fiş tutarı kadar değişmiş (elle sayı) | devir-d3-kural |
| k2-8 | İlette yanlış tutar (fiş tutarı / kâr etkisi veriden farklı) | ilette yazan tutar = Kural Farkı Düzeltme ön izlemesinin (aynı yılın) tutarı | devir-d3-kural + mutant |

### S-KD-3 — Excel'den yüklenen kart: Kayıt Tarihi ≤K, yükleme anı >K (KULLANICI: B — Kayıt Tarihi esas; eski yıla sayılır, yeni yıla açılışla gelir)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| k3-1 | Defter maddesi yükleme gününde (K sonrası), cari ekstresi / kart Kayıt Tarihi'nde → arşivin 120'si ile carinin K bakiyesi ayrışır, devir yanlış DURUR ya da kart iki yılda birden sayılır | ÖNCE ÖLÇ (veri tabanı + defter türetmesi; v2.5.0 gerçek koduyla); karar: kart ve defter maddesi ESKİ yılda; 9.000 yeni yıla açılışla | devir-d3-kart-tarihi (S-KD-3) |
| k3-2 | Kayıt Tarihi = K (31.12) | eski yıl | devir-d3-kart-tarihi |
| k3-3 | Kayıt Tarihi = K+1 (01.01) | yeni yıl (açılışa girmez) | devir-d3-kart-tarihi |
| k3-4 | Elle girilmiş kart ile Excel'den yüklenmiş kart (aynı Kayıt Tarihi, aynı tutar) farklı sonuç | aynı plan sayıları (cari K bakiyesi, kart açılışı) | devir-d3-kart-tarihi |
| k3-5 | Tablodan Aktar yolu (Excel ile aynı defter kuralı) | Excel ile aynı | devir-d3-kart-tarihi (varsa) |
| k3-6 | Defter düzeltmesi (EK İZİN) komşuları bozar: Excel / Sheets yükleme, kart ekranı, cari ekstresi, mizan / KDV, geri yükleme, kilitli dönem (Kural Farkı) | komşu testleri iki TZ; kilitli dönemdeki eski veride çıkan farklar SAYIYLA | komşular |

### S-C5C-9 eki — devirde durdurulacak WhatsApp gönderimi (UYARI; durdurmaz)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| w-1 | Süren toplu iş varken uyarı yok → kullanıcı gönderimin kesileceğini bilmez | UYARIR: kaç iş, kaç kişi (süren / duraklatılmış / sınır nedeniyle bekleyen) | devir-d3-wa |
| w-2 | Uyarı DURDURUR sayılır → devir yanlış durur | yalnız `uyarir`'da; `gecebilir` değişmez | devir-d3-wa + mutant |
| w-3 | Bitmiş / iptal / durdurulmuş iş sayılır | sayılmaz | devir-d3-wa |
| w-4 | Öbür şirketin işi sayılır | sayılmaz (şirket dosyası ayrı) | devir-d3-wa |
| w-5 | Hiç iş yokken boş uyarı | uyarı YOK | devir-d3-wa |
| w-6 | Okuma kuyruğu değiştirir | önce = sonra (wa_batches / wa_jobs) | devir-d3-wa |

### İleti düzeni (DEVİR NEDEN DURDU — tek yardımcı)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| i-1 | Bir durdurma nedeni yardımcıyı atlar (ham metin, İngilizce, iç kod, 'undefined' / 'null' / 'NaN' / '[object') | her madde dört alanlı; yasak kalıp yok | devir-d3-ileti (a) |
| i-2 | İletideki tutar / tarih / cari adı veriden farklı | iletide yazan = veri tabanındaki | devir-d3-ileti (a) |
| i-3 | İlk durdurmada kesme (kullanıcı tek tek düzeltip yeniden dener) | bütün nedenler birlikte; sıra kararlı (iki koşu aynı) | devir-d3-ileti (b) |
| i-4 | Uyarı durdurur listesine (ya da tersi) karışır | ayrı listeler; `gecebilir` yalnız durdururdan | devir-d3-ileti (c) |
| i-5 | Yeni bir durdurma yolu yardımcıyı atlayarak eklenir | kaynak tarayan test kırılır (`/\r?\n/`) | devir-d3-ileti (d) |
| i-6 | Devir Raporu'nda (ekran / PDF / Excel) cümleler farklı ya da durdurur ↔ uyarı tek başlıkta | iki başlık "Devri Durduran Nedenler" / "Uyarılar", aynı cümleler | devir-d3-ileti (e) |
| i-7 | Ön izleme ucunun beklenmeyen hatası ham ileti / yığın izi döndürür | Türkçe cümle + "Verileriniz değişmedi."; ham ileti günlüğe | devir-d3-ileti |
| i-8 | Kesim tarihi / seçenek reddi (400) iç kodla ya da tek cümleyle döner | dört alanlı ileti (kod makine alanında) | devir-d3-ileti |
| i-9 | Plan sorunu ("Devir Hesabı Tutmuyor") iletisi hangi cari / hesap olduğunu söylemez | cari adı / hesap / iki tutar | devir-d3-ileti |
| i-10 | Yanlış "Nereye" (yazım düzeni dışı ekran adı) | ekran adları yazım düzeninde | devir-d3-ileti |
| i-11 | Tutar biçimi ("1234.5", "-0,00 TL") ya da tarih biçimi (ISO) kullanıcıya gider | "1.234,50 TL", gün.ay.yıl | devir-d3-ileti |

### Tur 2'nin açık bıraktıkları (bu dosya sınırında kapanabilenler)
| # | Madde (tur 2 raporu) | Bu turda | Test |
|---|---|---|---|
| t2-1 | K'den sonra fatura Düzenle'siyle eklenen peşin ödeme (`source = 'invoice'` satırı K sonrası) bağ listesine giriyor mu | senaryo + sonuç | devir-d3-acik |
| t2-2 | K'den önce alınmış çekin bağının K'den sonra değiştirilmesi | senaryo + sonuç | devir-d3-acik |
| t2-3 | BM-T2-4: test serili gönderilmemiş belge — iletinin NE YAPMALI kısmı (gönder / iptal / Durum Sorgula) | ileti | devir-d3-ileti |
| t2-4 | S-T2-1 (para / kapama — kullanıcıda) | KODLANMAZ; tur 2 testinin sayıları DOKUNULMAZ | — |

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Ekran YOK (D5). Değişen: ön izleme uçlarının (`POST/GET /api/admin/devir/preview…`) ön denetim maddeleri, Devir Raporu (ekran verisi + PDF + Excel), ön izleme reddi / hatası — ve **S-KD-3 ile var olan bir yolun yanıtı: Excel'den / tablodan yüklenen taksit kartının Ana Defter maddesinin TARİHİ** (Yevmiye, Mizan, Bilanço / Gelir Tablosu dönem kesitleri, Kural Değişikliği Farkı).

| # | Ne (ekran / uç) | Önce (tur 2 / v2.5.0) | Sonra (tur 3) | Örnek (test) |
|---|---|---|---|---|
| H1 | Ön denetimin HER maddesi (sihirbazın 2. adımı — D5; şimdilik ön izleme yanıtı `onDenetim.durdurur[] / uyarir[]`) | `{ kod, seviye, baslik, metin, git }` — tek cümle, bazısında sayı / belge yok | dört alan: `neOldu` (kayıt / cari / tutar / tarih — sayıyla), `neden`, `neYapmali[]` (adım adım), `nereye` { ekran, hedef, kayit? }; `metin` = dördünün birleşik cümlesi; `git` = `nereye` (eski okuyucular) | "31.12.2026 ve öncesi tarihli 1 e-Belge Gönderilecekler'de bekliyor (ör. numarasız belge — Ayşe Demir, 31.12.2026, 1.200,00 TL)." → adımlar: Faturalar › Gönderilecekler'i açın · Gönder · iptal · Ön İzleme'yi yeniden başlatın (devir-d3-ileti) |
| H2 | Kural Değişikliği Farkı — alt defter (S-KD-1 = A) | `kural-farki` tek madde, "… alt defter hesabındaki fark için Kilidi Aç → Yeniden Kilitle", gidilecek yer Kural Farkı Düzeltme Fişi; cari / hesap / tutar yok | AYRI madde `kural-farki-alt-defter` "Kilidi Açıp Yeniden Kilitleyin": cari başına, hesap başına yönlü tutar ("Kural Müşterisi A — 120 Alıcılar (Müşteri Carileri): alacak yönünde 4.000,00 TL ve … 128 …: borç yönünde 4.000,00 TL. Carinin toplamı 0,00 TL görünse de hesaplar ayrı ayrı tutmuyor."); adımlar Kilidi Aç → Yeniden Kilitle → Ön İzleme; gidilecek yer Dönem Kilidi. Durdurma koşulu AYNI (cari / alt hesap başına, toplamdan değil — tur 1'den beri) | devir-d3-kural S-KD-1 |
| H3 | Kural farkının fişi kilit yüzünden yeni yıla düşüyor (S-KD-2 = A) | genel `kural-farki` "Kural Farkı Düzeltme Fişi'ni yazın" — kullanıcı fişi 01.01'e yazınca satır kalmadığı için devir GEÇİYORDU (eski yılın kârı yanlış) | `kural-farki-kilit` DURDURUR: "Dönem Kilidi 31.12.2026 gününde; … Kural Farkı Düzeltme Fişi kilit yüzünden 01.01.2027 tarihine, yani yeni yıla düşüyor (bugünkü fiş: …)"; neden "… Fiş 2026 içinde yazılınca 2026 yılının dönem sonucu 3.000,00 TL azalır"; adımlar kilit 30.12.2026 → fiş (31.12.2026, 3.000,00 TL) → kilit 31.12.2026 → Ön İzleme. Fiş yeni yıla YAZILMIŞSA `kural-farki-fis-yeni-yilda` DURDURUR (Ters Kaydet → …) | devir-d3-kural S-KD-2 (dönem sonucu 10.000,00 → 7.000,00); v2.4.9 GERÇEK fikstürü (kilit 31.12.2025) |
| H4 | **S-KD-3 = B — Excel / tablodan yüklenen kartın defter maddesi** (Yevmiye Defteri, Hesap Planı Mizanı, dönem raporları; KG-5 maddesi B CH (T − P) / A 519) | yüklemenin (plan_imports.created_at) YEREL günü (KG-5, B5 BİLİNEN SINIR: ekstrede Kayıt Tarihi, defterde yükleme günü) | kartın KAYIT TARİHİ (cari ekstresiyle aynı gün; B5 sınırı kalktı) | Kayıt 20.12.2026, yükleme 03.01.2027, 9.000: madde 03.01.2027 → 20.12.2026; planda carinin K bakiyesi 0 → 9.000,00, kart eski yılda açık 9.000 (devir-d3-kart-tarihi) |
| H5 | S-KD-3'ün kilitli veriye etkisi (S127 eski yapı bağı — `oldRulePinnedPlans` aynı tarihi okur) | 2.4.9 kuralıyla donmuş dönemde bağlı kartlar i / ii-0 / ters / ters-0 | bağlı kartlar YALNIZ açılış satırı (P > 0) olan i / ters; P = 0 kartlar (ii-0, ters-0) iki kuralda da kilit sınırının aynı yanında (Kayıt Tarihi) — eski yapıya bağlanmaz, tek madde; mizan / 120 = cariler / donmuş 2025 mizanı bayt bayt AYNI (s127-tek-kez-250 1–4, 6, 7 değişmeden geçti) | s127-tek-kez-250 (5) |
| H6 | v2.5.0 ile yüklenip SONRA K'de kilitlenmiş kart (Kayıt ≤K, yükleme >K) | donmuş defterde yok, canlıda yükleme gününde → devir planı carinin K bakiyesini 0 sayıyordu (iki yıla bölünmüş kart) | güncellemeden sonra kilitli dönemde ALT DEFTER kural farkı (120 / 519) → devir `kural-farki-alt-defter` ile DURUR; Kilidi Aç → Yeniden Kilitle sonrası GEÇER, kart eski yılda | gerçek veri (v2.5.0 GERÇEK kodu, 5 kart) §8 |
| H7 | WhatsApp gönderimi (S-C5C-9 eki) | ön denetimde yok | UYARIR (durdurmaz) `whatsapp-gonderim` "WhatsApp Gönderimi Durdurulacak": "2 toplu WhatsApp gönderimi bitmedi (1 süren ve 1 duraklatılmış); 3 kişiye ileti henüz gitmedi" (kuyruktan sayılır, kuyruk değişmez; öbür şirketin işi sayılmaz) | devir-d3-wa |
| H8 | Devir Raporu (ekran = PDF = Excel) | ön denetim maddeleri "Listeler" bölümünde karışık ("Durdurur · …" ön ekli, tek satır) | en başta İKİ ayrı bölüm: "Devri Durduran Nedenler" ve "Uyarılar"; her nedenin dört satırı (Ne Oldu / Neden Duruyor (uyarıda Neden Önemli) / Ne Yapmalı / Nereye); neden yoksa "Yok — Devri durduran neden yok." ; PDF'te hücre 40 satıra kadar sarılır (önce 4 satırda "…" ile kesilirdi) | devir-d3-ileti (e), devir-d3-uc |
| H9 | Ön izleme isteğinin reddi (400) | `error` = ham cümle ("Devir için son işlem tarihi yalnız bir yılın 31 Aralık'ı olabilir.") | `error` = ileti metni + `ileti` (dört alan, "Verileriniz değişmedi."); `code` makine alanında AYNI (DEVIR_K_31_ARALIK / DEVIR_K_GELECEK / DEVIR_SECENEK) | "Seçilen son işlem tarihi (30.06.2026) bir yılın son günü değil. …" |
| H10 | Ön izlemenin beklenmeyen hatası (iş `failed`) | `error.message` "Devir ön izlemesi hesaplanamadı." (sunucu günlüğüne yazılmıyordu) | Türkçe dört alan + "Verileriniz değişmedi."; ham ileti / yığın izi yanıta girmez, SUNUCU GÜNLÜĞÜNE yazılır | devir-d3-ileti (beklenmeyen hata) |
| H11 | Ön izleme bulunamadı (404) / bitmedi (409; rapor isteği) | ham cümle | dört alanlı ileti | devir-d3-ileti |
| H12 | Plan sorunları ("Devir Hesabı Tutmuyor") | tek başlık, iç kodlu cümle ("Bir carinin devir satırları …", tablo adı "integrity_log_v20") | türüne göre başlık + cari ADI / hesap adı / iki tutar ("Kural Müşterisi carisinin devir satırları 31.12.2026 bakiyesini vermiyor (bakiye 700,00 TL, satırların toplamı 500,00 TL)."); tablo adı makine alanında | devir-d3-ileti (olgu) |
| H13 | e-Belge maddelerinde örnek belge | yok (adet) | ilk 3 belge: numara (yoksa "numarasız belge") — cari, tarih, tutar; test serili (TEF / TEA / TES) gönderilmemiş belge varsa ayrı adım "… göndermeyin, iptal edin" (BM-T2-4) | devir-d3-ileti (a) |

## 2. DEĞİŞEN DOSYALAR
- Ürün (D3): YENİ `server/lib/devir/iletiler.mjs` (TEK ileti yardımcısı); `server/lib/devir/preflight.mjs` (bütün maddeler yardımcıdan; S-KD-1 / S-KD-2 / WhatsApp maddeleri; `problemIletisi`), `server/lib/devir/plan-reader.mjs` (kural farkı ayrıntısı, S-KD-2 eski yıl fişi, yeni yıl fişleri, WhatsApp sayımı, e-Belge örneğinin carisi / tutarı), `server/lib/devir/report.mjs` (iki başlık, PDF hücre satırı), `server/lib/devir/plan-worker.mjs` (cari adları ön denetime), `server/routes/devir.mjs` (yalnız ön izleme uçları: `refuse`, beklenmeyen hata günlüğe).
- Ürün — EK İZİN (S-KD-3, AYRI commit d3d2a319): `server/lib/general-ledger.mjs` (yüklenen kartın maddesinin tarihi: `localDayOf(plan.importedAt) || plan.date` → `plan.date`), `server/lib/ledger-opening.mjs` (`oldRulePinnedPlans`'ın "yeni kuralın yerleşimi" aynı tarih; kullanılmayan içe aktarma). Başka satır yok.
- Testler (YENİ): `test/devir-d3-ileti.test.mjs`, `test/devir-d3-kural.test.mjs`, `test/devir-d3-kart-tarihi.test.mjs`, `test/devir-d3-wa.test.mjs`, `test/devir-d3-acik.test.mjs`, `test/fixtures/devir-d3-ileti-katalog.mjs`, `test/devir-d3-ileti-katalog.mjs` (katalog üreticisi, CI dışı).
- Testler (DEĞİŞEN, sınır içi): `test/devir-d3-plan.test.mjs` (alt defter satırı → `kural-farki-alt-defter`, Dönem Kilidi), `test/devir-d3-olgu.test.mjs` (aynı), `test/devir-d3-uc.test.mjs` (rapor bölümleri iki başlıkla), `test/devir-d3-mutasyon.mjs` (M11 / M12 yeni metne, +13 mutant), `test/devir-d3-gercek-veri.mjs` (Excel kartı + S-KD-1 çaresi).
- Testler (DEĞİŞEN, **DOSYA SINIRI DIŞI** — S-KD-3'ün beklentisi değişen komşuları; ayrı commit'ler 88b8cf20, 659a03a3, d0fc3ce4 — §10 BAŞ MİMAR): `test/acilis-519-250.test.mjs`, `test/defter-hiz-esdegerlik-250.test.mjs`, `test/s127-tek-kez-250.test.mjs`.

## 3. TARAMA
### 3a. Durdurma / hata yolları (iş 2 kapsam taraması — `git grep -n -E 'throw |HttpError\(|refuse\(|entry\.error|block\(|notice\(|stop\.push|warn\.push'` server/lib/devir/{plan,plan-reader,preflight,report,plan-worker,iletiler}.mjs + server/routes/devir.mjs)
| Yol | Yardımcıdan geçiyor mu | Not |
|---|---|---|
| preflight.mjs — 11 DURDURUR (e-belge ×3, taslak, banka işi, Defter Mutabakatı, Açılış Olabilir, dondurma sürüyor, kural farkı ×4: `kural-farki`, `kural-farki-kilit`, `kural-farki-alt-defter`, `kural-farki-fis-yeni-yilda`) | EVET (`block` → `devirIletisi`) | S-2 / S-3 dalı TEK yerde (`byDecision`) |
| preflight.mjs — plan sorunları (9 tür) + değişmezler (12) | EVET (`problemIletisi` → `devirIletisi`) | sorun nesnesi `ayrinti`'de (makine) |
| preflight.mjs — 10 UYARIR (Aralık mahsubu, içe aktarma, şablon, gelen kutusu, iptal süresi, eksi stok, eksi kasa, WhatsApp, 001 yeniden başlatma, erken devir) | EVET (`notice`) | |
| plan.mjs `checkCutoff` / `buildDevirPlan` (400 DEVIR_K_31_ARALIK, DEVIR_K_GELECEK, DEVIR_SECENEK — ham `Error`) | iş parçacığında atılır → routes/devir.mjs `finish` → `onIzlemeReddiIletisi(code)`; istek anında `refuse(…)` | ham cümle yanıta GİRMEZ |
| plan-worker.mjs `reply.ok = false` (beklenmeyen hata: ileti + yığın) | routes/devir.mjs `finish` → `beklenmeyenHataIletisi()`; ham ileti `log.warn` | |
| routes/devir.mjs ön izleme bölümü: seçenek, kurulum yok (503), kesim reddi, bulunamadı (404), bitmedi (409), başarısız iş | EVET (`refuse` — bölümde TEK `new HttpError`) | kaynak tarayan test (d) |
| routes/devir.mjs `runPreviewWorker` iç aktarımı (`new HttpError(message.status, message.message …)`) | iç (yanıta gitmez; `finish` iletiye çevirir) | bölüm dışı |
| routes/devir.mjs `companyFor` 404 "Şirket bulunamadı …", D2 uçları (arşiv / yedek) | HAYIR — devri durduran neden değil (istek / yetki hatası; D2'nin uçları) | SONRAKİ (D5 isterse) |
| D4 yolları (yarıda kesilme, kilitli dosya, yer yok, Devri Geri Al / Devri Yenile redleri) | bu turda YOK — aynı `devirIletisi` / `DEVIR_TARGETS` ile kurulacak (§13) | |

### 3b. S-KD-3 komşuları (ders 9, 10) — `git grep -l -E 'Taksit kartı açılışı \(Excel|importedAt|yüklemenin (yerel )?gün|plans/import|plan-transfer|oldRulePinnedPlans|pinnedOld|S127|KG-5|rule-diff-correction|kural-farki|tablodan-aktar|/plans/transfer' -- 'test/*.test.mjs'` (63) + geri yükleme / dondurma / kilit izi / şema kapısı (banka-210-sira, donmus-defter-yasam-250, kasa-acilis-iz-250, kural-farki-kapi-disi-250, sema-kapisi-bs7) = 68 dosya (`scratchpad/d3t3/komsu-kd3.txt` listesi rapor ekinde)
| Koşu | TZ | Sonuç |
|---|---|---|
| `d3t3-komsu-kd3-utc` (68 dosya; S-KD-3'ten hemen sonra, beklentiler düzeltilmeden) | UTC | 824/828 — 4 kırmızı YALNIZ KG-5 "madde yükleme gününde" iddialarında: acilis-519-250 (KG-5 tarihi), defter-hiz-esdegerlik-250 ×2 (iki fikstür), s127-tek-kez-250 (bağlı kart kümesi / tarihler) |
| `d3t3-komsu-degisen-utc` (bu 3 dosya, beklenti S-KD-3 = B'ye göre) | UTC | 26/26 |
| `d3t3-komsu-kd3-ist` (68 dosya, düzeltilmiş beklentiler) | İstanbul | 829/829, 0 iptal, 0 atlanan |

## 4. S-KD-3 ÖLÇÜMÜ (koddan önce; iş 1) — sonuç: **(ii) YÜKLEME ANIYLA yazıyor**
Betik `scratchpad/d3t3/kd3-olc.mjs` (Excel kartı Kayıt Tarihi 20.12.2026, yükleme 03.01.2027 10:00, 9.000; ham çıktı `docs/kanit/2026-11-27/d3t3-kd3-olcum-*.txt`):
| Kod | plans.registered_on | plan_imports.created_at | Defter maddesi (ledger.build) | Plan (K 31.12.2026) |
|---|---|---|---|---|
| t251-d3-tur2 | 2026-12-20 | 2027-01-03T07:00Z | `plan:<kart>` **2027-01-03** B 120 / A 519 9.000 | carinin K bakiyesi 0, kart açık 9.000 (iki yıla bölünmüş) |
| v2.5.0 GERÇEK kodu (`git worktree add --detach /dev/shm/d3t3-k3/v250 v2.5.0`) | 2026-12-20 | 2027-01-03T07:00Z | **2027-01-03** (aynı) | (ön izleme yok) |
| tur 3 (S-KD-3) | 2026-12-20 | aynı | **2026-12-20** | K bakiyesi 9.000, kart açık 9.000 |
Eski veride yılı değişen kayıtlar (SAYIYLA; `scratchpad/d3t3/kd3-sayim.py`, salt okuma): v2.4.9 GERÇEK koduyla üretilmiş fikstür `surum-2.4.9-s127` — yüklenen kart 6, tarihi değişen 6, **yılı değişen 4 (Σ 12.400,00 TL)**, kilit 31.12.2025 sınırını aşan 4; `surum-2.4.9-s127-kilitsiz` — aynı 6 / 6 / 4 (12.400,00 TL), kilit yok; ana oturumun temiz 100 bin verisi (001 + 002) — yüklenen kart 0. Gerçek veri üretecinin 001'i (v2.5.0) — 5 kart, yılı değişen 4 (§8).

## 5. Yeni / değişen testler — eski kod (t251-d3-tur2, AYRI kopya `git worktree add --detach /dev/shm/d3t3-k3/eski t251-d3-tur2`; YALNIZ yeni 5 test dosyası + yeni yardımcı `test/fixtures/devir-d3-ileti-katalog.mjs` — ders 51) ↔ yeni kod
Koşular `d3t3-eski-utc` / `d3t3-eski-ist`: **10/34 geçti, 24 KIRMIZI** (iki TZ'de AYNI 24 test, aynı nedenler); `d3t3-yeni-utc` / `d3t3-yeni-ist`: **97/97** (tur 1 + tur 2'nin 63'ü + bu turun 34'ü). Ön denetim testlerine eklenen dört alan denetimi ve katalog kaydından sonra `devir-d3-plan` + `devir-d3-olgu` yeniden: `d3t3-katalog-ek-utc` / `-ist` 26/26.

**E-1 — tur 2 kodunda KIRMIZI (beklenen neden iletiden okundu — ders 38):**
| Test | Eski kodda kırmızı nedeni | Neyin kanıtı |
|---|---|---|
| ileti (a) her DURDURUR nedeni | `e-belge-bekleyen: neOldu boş` | ileti düzeni yok |
| ileti (a) UYARIR maddeleri | `aralik-mahsubu: neOldu boş` | ileti düzeni yok |
| ileti (e) Devir Raporu iki başlık | rapor satırında `Devri Durduran Nedenler` yok (alanlar tanımsız → `map` hatası) | rapor bölümü yok |
| ileti Defter Mutabakatı (kanca) | dört alan yok (`neOldu` tanımsız) | ileti düzeni yok |
| ileti plan sorunları (olgu) | `problemIletisi is not a function` | ileti düzeni yok |
| ileti (c) temiz şirket | rapor bölümleri farklı (`Devri Durduran Nedenler › Yok` yok) | iki başlık yok |
| ileti ret (400) / beklenmeyen hata | yanıtta `ileti` yok (`reading 'kod'`) | ret / hata iletisi yok |
| ileti (d) kaynak tarayan ×4 | `iletiler.mjs` yok (kapı — bu dört test yardımcının kendisini sınar) | yardımcı yok |
| kart-tarihi: defter maddesi / plan / elle = Excel | madde `2027-01-03` (beklenen 2026-12-20); carinin K bakiyesi `0` (beklenen 900000); elle kart 900000 ↔ Excel 0 | S-KD-3 kodu yok |
| kural S-KD-1 aynı cari / iki cari | DURDURUR `kural-farki, plan-supheli-farki, plan-modul-farki, degismez-gecici-hesap` — `kural-farki-alt-defter` yok | S-KD-1 maddesi / çaresi yok |
| kural S-KD-2 kilit = K | yalnız genel `kural-farki` | S-KD-2 kodu yok |
| kural S-KD-2 fiş yeni yılda | DURDURUR boş (devir yanlış GEÇİYORDU) | S-KD-2 kodu yok |
| kural S-3 kilit K'den önce | `kural-farki: dört alan (ileti düzeni)` | ileti düzeni yok |
| kural kilit K'yi aşıyor | `kural-farki` (kilit değil) | S-KD-2 kodu yok |
| kural v2.4.9 GERÇEK fikstürü | `kural-farki` (kilit değil) | S-KD-2 kodu yok (gerçek veride) |
| wa 001 uyarı / 002 kendi işi | uyarılar `aralik-mahsubu, yeniden-baslatma, erken-devir` — `whatsapp-gonderim` yok | S-C5C-9 eki yok |

**E-2 — tur 2 kodunda da YEŞİL (yeni sınıf testi; dişi mutasyonda — kırmızı kanıt diye YAZILMAZ, ders 7, 38):** açık (t2-1 / t2-2) ×3 — tur 2 kodu bu iki durumu ZATEN doğru hesaplıyordu (hata yok); kart-tarihi veri tabanı; kural: aynı yılda +/− (birikim 0) durdurmaz, fark yokken durdurmaz, kilit yokken durdurmaz; wa: veri tabanı, işler bitince uyarı yok; ileti (b) iki ön izleme bayt bayt aynı.

**Beklentisi değişen testler (eski beklenti → yeni; nedeni):** `devir-d3-plan` satırı altDefter → `kural-farki-alt-defter` / Dönem Kilidi (S-KD-1); `devir-d3-olgu` kural testi aynı; `devir-d3-uc` rapor bölümleri iki başlıkla; **sınır dışı** `acilis-519-250` (KG-5 tarihi yükleme günü → Kayıt Tarihi), `defter-hiz-esdegerlik-250` (iki fikstürde aynı), `s127-tek-kez-250` (bağlı kart kümesi i / ii-0 / ters / ters-0 → i / ters; iii / iv / ii-0 / ters-0 maddesi Kayıt Tarihi'nde — veri tabanından) — üçü de ilk koşuda (`d3t3-komsu-kd3-utc`) TAM bu iddialarda kırmızıydı (KG-5 "yükleme gününde"); düzeltme sonrası `d3t3-komsu-degisen-utc` 26/26, İstanbul tam komşu koşusu içinde.

## 6. Kabul koşullarının sayıları
- **A** `test:kahin-defter` UTC 187/187 + İstanbul 187/187; `test:kahin-cari` UTC 25.298/25.298 + İstanbul 25.298/25.298 — tur 2 ile (187 / 25.298) AYNI. EK İZİN kullanıldı (S-KD-3) ama kâhinlerin sayıları değişmedi (kâhinlerin senaryolarında Kayıt Tarihi ≠ yükleme günü olan yüklenmiş kart YOK — S-KD-3'ü kâhin sınamıyor; §10 BM-T3-4).
- **B** tur 1 + tur 2 + tur 3 testleri **97/97** iki TZ; komşular (68 dosya): İstanbul **829/829** (`d3t3-komsu-kd3-ist`); UTC ilk koşu 824/828 — 4 kırmızı yalnız beklentisi değişen 3 dosyada (KG-5 yükleme günü iddiaları), düzeltmeden sonra o 3 dosya UTC **26/26** (`d3t3-komsu-degisen-utc`).
- **C** mutantlar **42/42** YAKALANDI iki TZ (`d3t3-mutasyon-utc`, `d3t3-mutasyon-ist`; taban 82/82). Tur 1-2'nin 29'u AYNEN; bu turun 13'ü aşağıda.
- **D** gerçek veri: üç tohum × iki TZ — 6/6 koşu tam yeşil (tablo §8).
- **E** §5. **F** katalog `docs/devir/2.5.1-DEVAM/d3t3-iletiler.md` — testlerin ön izleme yanıtından kaydettiği iletilerden (`D3T3_KATALOG_DIR` + `test/devir-d3-ileti-katalog.mjs`), **39 neden** (durdurur 29, uyarı 10); commit aaec66ce.

## 7. Mutant tablosu (bu turun 13'ü; `test/devir-d3-mutasyon.mjs`, `git archive HEAD` kopyası)
| # | Mutant | Kırmızı test |
|---|---|---|
| 30 | S-KD-1: alt defter farkı TOPLAMDAN aranır | kural: aynı caride 120 −4.000 / 128 +4.000 |
| 31 | S-KD-1: çare söylenmez (Kural Farkı Düzeltme'ye yönlendirir) | kural: aynı caride … |
| 32 | S-KD-2: kilidin K'de olduğu görülmez | kural: kilit = 31.12.2026 |
| 33 | S-KD-2: yeni yıla yazılmış fiş görülmez | kural: fiş YENİ YILA yazılmış |
| 34 | S-KD-2: iletide yanlış fiş tutarı | kural: kilit = 31.12.2026 |
| 35 | S-KD-3: Kayıt Tarihi yerine yükleme anı (tur 2 / v2.5.0 hâli) | kart-tarihi: defter maddesi / plan |
| 36 | ilk durdurmada kesme | ileti (a) |
| 37 | ilette yanlış tutar (e-Belge örneği KDV'siz) | ileti (a) |
| 38 | uyarıyı durdurma sayma (WhatsApp) | wa: 001 UYARIR |
| 39 | plan sorunu yardımcıyı atlar (ham iç kodlu metin) | ileti (a) / (d) |
| 40 | Devir Raporu: uyarılar durduranlar başlığına | ileti (e) |
| 41 | beklenmeyen hatanın HAM iletisi yanıta | ileti beklenmeyen hata / (d) |
| 42 | WhatsApp uyarısı bitmiş / iptal işleri de sayar | wa: işler bitince |

## 8. GERÇEK VERİ (iş 7; ders 17) — v2.5.0'ın GERÇEK koduyla, üç tohum × iki TZ
Üreteç tur 2'ninki + bu turun sınıfları: 01.01.2027 03:10'da (kilitten ÖNCE, K'den SONRA) Excel'den 5 taksit kartı — Kayıt Tarihi 15.11.2026, 05.12.2026, 20.12.2026, 31.12.2026 (K), 01.01.2027 (K+1); v2.5.0 maddeyi yükleme gününe (01.01.2027) yazar ve kilit K'de donar; yeni kod (S-KD-3) maddeyi Kayıt Tarihi'ne taşır → kilitli dönemde ALT DEFTER kural farkı → **çare öncesi ön denetim YALNIZ `kural-farki-alt-defter` DURDURUR, farkın carileri = Kayıt Tarihi ≤K olan 4 kartın carileri**; çare yeni kodun API'siyle (Dönem Kilidi aç → 31.12.2026) → tur 2'nin bütün denetimleri + "Excel kartları Kayıt Tarihi'ne göre (≤K 4 eski yılda — K bakiyesi = kart, planda açık kart; K+1 1 yeni yılda)". Kural farkının fişle düzeltilebilen (S-KD-2) sınıfı v2.5.0 ↔ yeni kod arasında doğmaz (aynı kural sürümü) — gerçek veride S-KD-2: v2.4.9 fikstürü (devir-d3-kural son bölüm).
Duman (30 cari, tohum 5): iki TZ 21/21. Ders 6 — ilk duman koşusunda (TZ=UTC) iki ayrışma: yükleme 00:10 +03 UTC'de 31.12'nin yerel günüydü (madde K'ye düştü, S-KD-1 doğmadı) ve K+1 Kayıt Tarihi "bugünden ileri" diye program tarafından 31.12'ye çekildi — kök neden ÜRETEÇTE (saat); yükleme 03:10 / kilit 03:30 +03 yapıldı, beklenti Kayıt Tarihi veri tabanından (14f05a80). Program hatası değil.
| Koşu (commit b7b90e6) | Sonuç | Devirsiz eşdeğer (karşılaştırma / fark) | Benzetim dışı cari | Bağ listesi (açık kaleme / arşive) | Bu turun sınıfları | 001 / 002 işlem |
|---|---|---|---|---|---|---|
| utc t7 | 21/21 | 3612 / 0 | 47 | 31 (6 / 25) | S-KD-1 çare öncesi ok; Excel ≤K 4 / >K 1 | 5124 / 1288 |
| ist t7 | 21/21 | 3612 / 0 | 47 | 31 (6 / 25) | S-KD-1 çare öncesi ok; Excel ≤K 4 / >K 1 | 5124 / 1288 |
| utc t11 | 21/21 | 3552 / 0 | 52 | 37 (7 / 30) | S-KD-1 çare öncesi ok; Excel ≤K 4 / >K 1 | 5124 / 1288 |
| ist t11 | 21/21 | 3552 / 0 | 52 | 37 (7 / 30) | S-KD-1 çare öncesi ok; Excel ≤K 4 / >K 1 | 5124 / 1288 |
| utc t23 | 21/21 | 3732 / 0 | 37 | 34 (9 / 25) | S-KD-1 çare öncesi ok; Excel ≤K 4 / >K 1 | 5124 / 1288 |
| ist t23 | 21/21 | 3732 / 0 | 37 | 34 (9 / 25) | S-KD-1 çare öncesi ok; Excel ≤K 4 / >K 1 | 5124 / 1288 |

İki TZ aynı tohumda AYNI veriyi üretti (sayılar birebir). Her koşuda: çare öncesi DURDURUR YALNIZ `kural-farki-alt-defter` (carileri = Kayıt Tarihi ≤K olan 4 Excel kartının carileri); çare yeni kodun API'siyle (kilit aç → 31.12.2026); sonra üç ön izleme, plan sorunu yok, 12 değişmez, bayt bayt aynı plan, DURDURUR yok, iki seçenekte açık kalemler ve net aynı, ≤K + >K = toplam, Excel kartları Kayıt Tarihi'ne göre, 002 ayrı. Sınıf sayıları (kart, evrak, şüpheli, KDV, banka …) tur 2'nin tablosundaki üretecin AYNISI (ham çıktıda `# üretilen sınıflar`); tur 2'ye göre fark: 5 Excel kartı (+5 cari) ve rastgele dizinin kayması (t7 tur 2'de 3.600 / 43 → 3.612 / 47).
İlk koşular (commit 14f05a8; kanıt `d3t3-ilk-gercek-*`): t7 iki TZ 21/21; t11 iki TZ üretim sırasında v2.5.0 kapısının 500'üyle ("dates:future") durdu — kök neden ÜRETEÇTE (ajanda saatini geri alıyordu; §12), saat tekdüze yapıldı (b7b90e6), üç tohum × iki TZ yeniden koşuldu (yukarıda).

## 9. KULLANICIYA SORULMALI
- **Yeni para / kapama / defter sorusu ÇIKMADI.** S-T2-1 (tur 2, K'den sonra Mahsup Et'in karşı belgesi ≤K alış) hâlâ kullanıcıda — KODLANMADI, tur 2 testinin sayılarına dokunulmadı.
- **S-KD-3'ün yan etkisi (bilgi; kararın kapsamında okundu — değiştirmek isterse kullanıcı söyler):** v2.5.0 ile Kayıt Tarihi ≤K, yüklemesi K'den sonra olan kartı OLUP dönemi K'de kilitlenmiş müşteride, güncellemeden sonra Mutabakat Testi "Kural Değişikliği Farkı" (alt defter, 120 / 519) gösterir ve devir S-KD-1 ile durur; "Kilidi Aç → Yeniden Kilitle" sonrası kart eski yılda (B'nin istediği). Kayıt Tarihi ve yükleme günü kilitli dönemin İÇİNDE ve aynı yılda olan kartta Mutabakat Testi uyarısı (fark tutarı 0) çıkar, devri durdurmaz. Bu, S-KD-3 = B'nin doğrudan sonucudur; ayrı soru açılmadı.

## 10. BAŞ MİMAR KARARI GEREKİYOR
- **BM-T3-1 (dosya sınırı — S-KD-3'ün komşu testleri):** EK İZİN yalnız defter türetmesindeki TARİH seçimini veriyordu; üç komşu test KG-5 / B5'in "madde yükleme gününde" beklentisini AÇIKÇA sınıyordu ve S-KD-3 = B ile çelişiyordu: `test/acilis-519-250.test.mjs` (KG-5 tarihi), `test/defter-hiz-esdegerlik-250.test.mjs` (iki fikstürde "madde yükleme gününde"), `test/s127-tek-kez-250.test.mjs` (S127 bağlı kart kümesi ve iii / iv tarihleri). Beklentileri kararla güncelledim (yalnız o iddialar; açıklama satırlı; AYRI commit'ler 88b8cf20, 659a03a3, d0fc3ce4). Öneri: kabul — bunlarsız ana dal kırmızı kalır; istemezsen bu üç commit geri alınır ve S-KD-3 commit'i (d3d2a319) de birlikte çıkar.
- **BM-T3-2 (S127 anlamı değişti; bilgi + onay):** yeni kuralın yerleşimi Kayıt Tarihi olunca 2.4.9 kuralıyla donmuş yılın İKİ YANINA düşen kart yalnız açılış satırı (P > 0) olan karttır (Kart Bir, Ters Kart); P = 0 kartlar (Kart İki, Ters Sıfır) iki kuralda aynı tarafta → eski yapıya bağlanmaz, tek madde yeni kuralla. s127 testinin "bir olay tek kez", "donmuş 2025 mizanı bayt bayt aynı", "120 = cariler", "Kilidi Aç → Yeniden Kilitle" iddiaları DEĞİŞMEDEN geçti. Öneri: kabul.
- **BM-T3-3 (kural sürümü):** S-KD-3 bir türetme kuralı değişikliğidir ama `LEDGER_RULE_VERSION` ("2.5.0-defter") DEĞİŞMEDİ (EK İZİN "başka hiçbir şey"). Sonuç: v2.5.0'da "2.5.0-defter" kuralıyla donmuş dönemde Kayıt Tarihi ↔ yükleme günü ayrışan kart, güncellemeden sonra Kural Değişikliği Farkı olarak görünür (yukarıda §9). Sürüm yükseltmesi (ayrı kural kopyası + eski kurala bağlama) daha temiz ama büyük iş (Ç3 / S127 makinesi). Öneri: sürüm değişmesin — 2.5.0 27.11'de yayımlandı, etkilenecek kilitli veri az; çare ileti ile (S-KD-1) kullanıcıya söyleniyor. Ana oturum karar verirse ayrı paket.
- **BM-T3-4 (kâhin):** kâhin defter / cari sayıları S-KD-3'ten sonra da AYNI (187 / 25.298, iki TZ) — kâhinin senaryolarında Kayıt Tarihi ≠ yükleme günü olan Excel kartı yok, yani S-KD-3'ü KODU GÖRMEYEN taraf henüz sınamıyor. Öneri: muhasebe kâhini devir bakımı 2'nin girdisine S-KD-3 = B eklensin (kart + madde Kayıt Tarihi'nde; K'den önce Kayıt, K'den sonra yükleme → eski yıl, açılışla 9.000) — yapım aşaması listesi kuralı aynen.
- BM-T2-1 / BM-T2-2 (D4a şartları) değişmedi. BM-T2-4: ileti adımı eklendi (test serili belgeyi "göndermeyin, iptal edin"); okuyucu ortamı bilmediği için adım yalnız örnek listesinde TEF / TEA / TES numaralı belge varsa çıkar — ilk 20 örnek dışındaki test serili belge için adım çıkmaz (D5'te sayılabilir).

## 11. SONRAKİ SÜRÜME (20.11 kuralı)
- Katalog üreticisinin "ilk örnek" seçimi testlerin koşu sırasına bağlı (örnek seçimi; cümleler değişmez).
- `companyFor` 404 ve D2 uçlarının (arşiv / yedek doğrulama) iletileri tek cümle — devri durduran neden değil; D5 isterse aynı yardımcıya.
- WhatsApp uyarısının "sınır nedeniyle bekleyen" sayısı API ile üretilemedi (sahte Meta'yla sınır kurulmadı) — sayım SQL'i aynı tablodan; test 0.
- Benzetim (`test/fixtures/devir-d3-esdeger.mjs`) kartlı / şüpheli carileri hâlâ kapsamıyor (tur 2'den).

## 12. DOĞRULANMADI
- Kural farkının "eski kurallı" donmuş dönemi testte kancalı türetmenin eşzamanlı dondurmasıyla (freezeSync — postAll lockThrough'un yolu) kuruldu; PUT period-lock'un iş parçacığı dondurması kancayı görmez. Çarelerin kendisi (Kilidi Aç, Yeniden Kilitle, fiş, Ters Kaydet) GERÇEK API. Gerçek eski kural verisiyle S-KD-2: v2.4.9 fikstürü (devir-d3-kural son bölüm); S-KD-1: gerçek veri üreteci (v2.5.0 → yeni kod, §8).
- S-KD-3'ün v2.5.0 müşterisinin kilitli verisindeki sayısı (müşteri verisine erişilmez): fikstür ve üreteç sayıları §4 / §8.
- §9'daki "Kayıt Tarihi ve yükleme günü kilitli dönemin içinde, aynı yılda olan kartta Mutabakat Testi uyarısı (tutar farkı 0), devri durdurmaz" — koddan çıkarım (Kural Değişikliği Farkı maddeyi tarihiyle karşılaştırır; tutar farkı yıl × hesap × cari başına 0); ayrı testle üretilmedi.
- Gerçek veri ilk koşusunda tohum 11'in v2.5.0 kapısı 500'ü ("dates:future" — ileri tarihli satır): kök neden üretecin ajanda saatini GERİ almasıydı (ileti + kod okumasından); saat tekdüze yapıldı, yeniden koşu §8. Programın saat geri alınınca kapının 500 vermesi gerçek kurulumda saat geri alınmadıkça doğmaz — kovalanmadı.

## 13. DENENMEYEN
- Ekran (D5) ve ana oturumun ekran yürüyüşü (cümlelerin okunarak denetimi) — ileti kataloğu okunmaya hazır.
- D4 durmaları (yarıda kesilme, kilitli dosya, yer yok) ve Devri Geri Al / Devri Yenile redleri — D4 (yardımcı hazır).
- Tablodan Aktar yolu ile yüklenen kart (S-KD-3 k3-5): üretimde kapalı (410); aynı `import_id` dalından geçer, ayrı test yazılmadı (komşu `test/tablodan-aktar-244.test.mjs`, `test/plan-transfer.test.mjs` iki TZ geçti).
- Windows: yeni testler dosya silmez / taşımaz (ders 48 kapsamı dışı); CI'de ana oturum.
- Tam `npm test` (ana oturum).

## 14. CI listesine eklenecek
- Yeni `test/devir-d3-*.test.mjs` (5) npm test deseniyle kendiliğinden girer; ci.yml değişmez. Yeni ekran senaryosu YOK.
- CI DIŞI: `node test/devir-d3-ileti-katalog.mjs <kayıt klasörü> <çıktı.md>` (katalog), `node test/devir-d3-gercek-veri.mjs`, `node test/devir-d3-mutasyon.mjs`.

## 15. Kılavuz metni önerisi (D5'te; bu pakette kılavuza DOKUNULMADI)
"**Devir neden durdu?** Ön Denetim, devri durduran her nedeni ve yapmanız gerekeni adım adım yazar; nedenlerin hepsi birlikte listelenir. Düzelttikten sonra Ön İzleme'yi yeniden başlatın. Sarı maddeler uyarıdır, devri durdurmaz. Aynı liste Devir Raporu'nun başında da vardır."
"**Kural Değişikliği Farkı:** Ön Denetim 'Kilidi Açıp Yeniden Kilitleyin' diyorsa Yönetim › Sistem › Dönem Kilidi'nde Kilidi Aç'ı seçip kilidi aynı güne yeniden koyun. 'Kural Farkı Eski Yılda Düzeltilmeli' diyorsa kilidi bir gün geriye alın, Kural Farkı Düzeltme Fişi'ni kaydedin, kilidi yeniden yıl sonuna koyun."
"**Excel'den yüklenen taksit kartı** Kayıt Tarihi'ne göre o yılın hesabına girer; devirden önce yüklediğiniz eski tarihli kartlar eski yılda kalır, yeni yıla açılışla geçer."

## 16. D4 / D5 bu yardımcıyı nasıl kullanacak (kısa)
- D4: her durma `devirIletisi({ kod, seviye: "durdurur", baslik, neOldu, neden, neYapmali, nereye: DEVIR_TARGETS.x, guvence })` ile; beklenmeyen hata `beklenmeyenHataIletisi({ is: "Devir", veriDegismedi })` (yarıda kesilmede veri GERİ ALINDIYSA "Verileriniz değişmedi", değilse güvence verilmez); yanıt `refuse(status, ileti)` deseniyle (`error` = metin, `ileti`, `code`). Devir Raporu'nun iki başlığı `devirReport(plan, onDenetim)` ile aynı.
- D5: ekran `neOldu` / `neden` / `neYapmali` / `nereye.ekran` alanlarını ayrı gösterir (metin birleşik); `nereye.hedef` yönlendirme, `nereye.kayit` kayda götüren bağlantı; `kod` GÖSTERİLMEZ; DURDURUR varsa İleri pasif, uyarılar ayrı başlıkta.

## 17. Plan biçiminde tur 2'ye göre DEĞİŞEN alanlar (sürücü ajanı ve D4a için)
- `plan` nesnesi (archive / newYear / degismezler / sorunlar / sayilar) DEĞİŞMEDİ.
- Ön izleme sonucunun `onDenetim` maddeleri: `{ kod, seviye, baslik, neOldu, neden, neYapmali[], nereye { ekran, hedef, kayit? }, git (= nereye), metin, adet?, ornek?, belirgin?, ayrinti?, guvence? }` (önce `{ kod, seviye, baslik, metin, adet?, git, ornek?, belirgin?, ayrinti? }`). Yeni kodlar: `kural-farki-alt-defter`, `kural-farki-kilit`, `kural-farki-fis-yeni-yilda`, `whatsapp-gonderim`. `ornek[]` satırına `cari`, `tutarMinor`.
- `rapor.rows`: başa "Devri Durduran Nedenler" ve "Uyarılar" bölümleri (her neden 4 satır); "Listeler"den ön denetim satırları çıktı; `rapor.pdfCellLines = 40`.
- Ön izleme reddi / başarısız iş: `error.ileti` (dört alan), `error.code` = ileti kodu.
- S-KD-3: planın girdisi olan karma yevmiyede yüklenen kartın maddesi Kayıt Tarihi'nde → kartlı carinin `kBakiyeMinor`'ü ve `archive.kapanisBakiyeleri` 120 / 519 hücreleri buna göre.

## 18. Tur 2'nin açık listesinin SON durumu
| Tur 2 maddesi | Son durum |
|---|---|
| DENENMEYEN: K'den sonra fatura Düzenle'siyle eklenen peşin (source 'invoice' satırı) | KAPANDI — program peşini FATURANIN tarihine (15.12.2026) yazar (10.01.2027'de yazılsa da) → ≤K satırı; K durumu peşini içerir (açık kalem 600 → çekle 300), bağ listesinde yok, devirsiz eşi (Faturalar listesinin kalanı) aynı (devir-d3-acik). Hata yok. |
| DENENMEYEN: K'den önce alınmış çekin bağının K'den sonra değiştirilmesi | KAPANDI — bağ çekin İLK (≤K) olayına yazılır → ≤K bağ, K durumuna girer; devirsiz eşiyle aynı (devir-d3-acik). Kilitli dönemde bu düzeltme zaten yapılamaz. |
| BM-T2-4 (test serili belge iletisi) | YAPILDI — ileti adımı (§1 H13) |
| S-T2-1 (para / kapama) | AÇIK — kullanıcıda; KODLANMADI |
| "Teminata verilmiş" evrak | AÇIK — programda durum YOK |
| Gelen e-Fatura kutusu (sahte EDM gelen kutusu) | AÇIK — sınır dışı (sahte EDM'de gelen kutusu kurulmadı); olgu testi aynen |
| Numara sayaçları | AÇIK — D4'ün işi |
| 002 zengin veri | AÇIK — SONRAKİ (test aracı) |
| DOĞRULANMADI: dar kip / hız tahminleri, 1 M | AÇIK — H-1 kullanıcıda, KOD DEĞİŞİKLİĞİ YOK |
| DOĞRULANMADI: BM-1 kâhinle | AÇIK — kâhin karşılaştırma ajanı |
| Windows | AÇIK — CI'de ana oturum |

## 19. Commit listesi (dal `worktree-agent-af273e8dbdb200a7c`, taban 0ae33184 `t251-d3-tur2`)
- cd05549f D3 tur 3: nasıl bozulur listesi (koddan önce)
- 0b84254b D3 tur 3: DEVİR NEDEN DURDU ileti düzeni — tek yardımcı (dört alan), ön denetim / plan sorunları / ön izleme reddi ve beklenmeyen hata bu yardımcıdan; Devir Raporu'nda iki başlık; S-KD-1 / S-KD-2 / WhatsApp olguları okuyucuda
- 1d245e53 D3 tur 3: S-KD-1 / S-KD-2 testleri — alt defter farkı cari başına (toplamı 0 da durdurur), kilit K'de / K'yi aşarken fiş yeni yıla düşer → durur; çareler gerçek API ile, kâr eski yılda fiş kadar değişir
- d3d2a319 S-KD-3: Excel'den / tablodan yüklenen taksit kartının defter maddesi Kayıt Tarihi'nde (yükleme günü değil) — kullanıcı kararı S-KD-3 = B (27.11.2026); yalnız tarih seçimi, eşi oldRulePinnedPlans aynı tarihi okur
- bc13cdef D3 tur 3: S-KD-3 testi — Kayıt Tarihi 20.12 / 31.12 / 01.01, yükleme 03.01: defter maddesi, plan (eski yıl / yeni yıl), elle kart = Excel kartı
- 817f2c4a D3 tur 3: S-C5C-9 eki testi — devirde durdurulacak WhatsApp gönderimi UYARIR (süren / duraklatılmış, kişi sayısı kuyruktan; öbür şirket sayılmaz; kuyruk değişmez)
- 88b8cf20 S-KD-3: beklentisi değişen iki komşu test (KG-5 B5 'madde yükleme gününde' → Kayıt Tarihi; kullanıcı kararı S-KD-3 = B) — dosya sınırı dışı, ana oturumun onayına
- 756564c5 D3 tur 3: tur 2'nin açıkları testi (Düzenle peşini, K sonrası çek bağı); S-KD-2 gerçek eski sürüm verisiyle (v2.4.9 fikstürü); gerçek veri üretecine Excel kartı (K sonrası yükleme) + S-KD-1 çaresi; 13 yeni mutant; ileti kataloğu üreticisi
- fabacad3 D3 tur 3: yeni testlerde modül kapısı yerine davranış iddiası önce (eski kodda kırmızının nedeni karar / ileti düzeni)
- 659a03a3 S-KD-3: beklentisi değişen komşu test s127-tek-kez-250 (yeni yerleşim Kayıt Tarihi → P = 0 kartlar eski yapıya bağlanmaz; iii / iv maddesi Kayıt Tarihi'nde) — dosya sınırı dışı, ana oturumun onayına
- d0fc3ce4 S-KD-3: s127 komşu testinde Kayıt Tarihi veri tabanından
- aaec66ce D3 tur 3: ileti kataloğu (testlerin ürettiği gerçek iletilerden, 39 neden); tur 1-2 ön denetim testleri dört alanı denetler ve kataloğa yazar
- 14f05a80 D3 tur 3: gerçek veri üreteci — Excel yüklemesi ve kilit iki TZ'de 01.01'in yerel gününde (03:10 / 03:30); kartın Kayıt Tarihi veri tabanından
- b7b90e6e D3 tur 3: gerçek veri üreteci — ajanda saati geri alınmaz (tohum 11: Ocak'ta şüpheliye alınan carinin önceki güne düşen bağlı tahsilatı kapıyı ileri tarihli satırla düşürüyordu)
- 7aeaed70 Kanıt: D3 tur 3 koşuları (yeni / eski kod iki TZ, S-KD-3 komşuları, kâhin defter / cari, mutasyon 42, gerçek veri 3 tohum × 2 TZ, S-KD-3 ölçümü)
- (bu rapor commit'i — dal ucu SubagentHandback iletisinde)

## 20. Ana oturumun yeniden koşacağı komutlar
```
cd <bu dal>; export HUKUK_LICENSE_URL=http://127.0.0.1:9
T="test/devir-d3-plan.test.mjs test/devir-d3-esdeger.test.mjs test/devir-d3-uc.test.mjs test/devir-d3-zaman.test.mjs test/devir-d3-bag.test.mjs test/devir-d3-evrak.test.mjs test/devir-d3-banka.test.mjs test/devir-d3-olgu.test.mjs test/devir-d3-supheli.test.mjs test/devir-d3-ileti.test.mjs test/devir-d3-kural.test.mjs test/devir-d3-kart-tarihi.test.mjs test/devir-d3-wa.test.mjs test/devir-d3-acik.test.mjs"
for tz in UTC Europe/Istanbul; do TZ=$tz node tools/kanit.mjs kos d3t3-$tz -- node --test --test-concurrency=1 $T; done        # 97/97
# eski kod kırmızısı: git worktree add --detach <yer>/eski t251-d3-tur2; yalnız test/devir-d3-{ileti,kural,kart-tarihi,wa,acik}.test.mjs + test/fixtures/devir-d3-ileti-katalog.mjs → 10/34, 24 kırmızı
# S-KD-3 komşuları (68 dosya; liste docs/kanit/2026-11-27/d3t3-komsu-kd3-liste.txt): node --test --test-concurrency=1 $(cat <liste>)   # İstanbul 829/829
# mutasyon: git archive HEAD server test package.json | tar -x -C <kopya>; node test/devir-d3-mutasyon.mjs --kopya <kopya>   # 42/42
# gerçek veri: git worktree add --detach <yer>/v250 v2.5.0; node test/devir-d3-gercek-veri.mjs --eski <yer>/v250 --tohum 7
# katalog: D3T3_KATALOG_DIR=<k> node --test $T; node test/devir-d3-ileti-katalog.mjs <k> docs/devir/2.5.1-DEVAM/d3t3-iletiler.md
npm run test:kahin-defter; npm run test:kahin-cari
```
Ortam (bitişte): yük 3,4 / 4 çekirdek, bellek boş 4 GB (kullanılabilir 13 GB), disk boş 9,8 GB. Kendi kopyalarım: /dev/shm/d3t3-k3/eski (git worktree — kaldırıldı), /dev/shm/d3t3-k3/mut-utc ve mut-ist (kaldırıldı), /dev/shm/d3t3-k3/v250 (git worktree — rapordan sonra kaldırılacak), üretecin yarıda kalan geçici klasörleri (/tmp/d3-gercek-veri-…, yalnız kendi beşi TAM yolla silindi; 11:2x tarihli üçü benim değil — dokunulmadı).
