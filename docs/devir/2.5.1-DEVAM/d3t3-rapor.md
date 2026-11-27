# D3 TUR 3 raporu — üç devir kararının kodu + "devir neden durdu" iletileri + tur 2'nin açık bıraktıkları (2.5.1)

Ajan: D3 TUR 3 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur2` (0ae33184). D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme + ön denetim + Devir Raporu).
TASLAK (adım adım doldurulur).

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
