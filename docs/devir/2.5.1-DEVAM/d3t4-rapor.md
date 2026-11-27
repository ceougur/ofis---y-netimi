# D3 TUR 4 raporu — S-T2-1 = B, aynı yılın ikinci devri, uzman kabul ölçütlerinin saf hesap tarafı, ileti eksikleri (2.5.1)

Ajan: D3 TUR 4 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur3` (54eeb87a). D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme + ön denetim + Devir Raporu).
TASLAK — adım adım doldurulur; son hâli raporun sonundaki "SON HÂL" satırıyla işaretlenir.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Her satır: "ne ters giderse devir yanlış geçer / yanlış durur / kullanıcı yanlış yönlenir". Yanlış DURDURMA da hatadır.

### S-T2-1 = B — K'den SONRA yapılan Mahsup Et'in ≤K belgesi K kuyruğunda o mahsuba AYRILIR (devirli = devirsiz)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| m-1 | Örnek AYNEN (alış yönü: Ocak satışı ↔ Aralık alışı 150): ≤K alış K'de Aralık satışını netler | Aralık satışı 400 açık, Aralık alışı 150 AÇIK ALACAK KALEMİ (mahsuba ayrılmış), Ocak satışı 150 (yeni yılda); bakiye 550; 01.01–29.01 gecikmiş 400 (devirsiz ile aynı) | devir-d3-mahsup |
| m-2 | Satış yönü (K sonrası alışın ana belge olduğu mahsup, karşı belge ≤K satış) | ≤K satışın mahsuba giden payı açık kalemde KALIR; devirli = devirsiz | devir-d3-mahsup |
| m-3 | Kısmi mahsup (alış 200, mahsup 150) | 150 ayrılır, kalan 50 K'de netleşir; devirli = devirsiz | devir-d3-mahsup |
| m-4 | Mahsup sonradan silinir (Mahsup Fişi kaldırıldı) | hiçbir şey ayrılmaz (mahsup yokmuş gibi); devirli = devirsiz | devir-d3-mahsup |
| m-5 | Aynı eski belgeye iki K sonrası mahsup (100 + 50) | ayrılan 150 (toplam), iki mahsup da yeni yılda aynı açık kaleme yönelir | devir-d3-mahsup |
| m-6 | İki belge de ≤K, mahsup K'den sonra (tur 2 B1) | mahsup K'de UYGULANMIŞ sayılır (iki belge de ondan payını verir); yeni yılda tekrar uygulanmaz (D4a şartı); devirli = devirsiz | devir-d3-mahsup + devir-d3-bag |
| m-7 | Karşı belge Alacak Yaz / Borç Yaz satırı (Mahsup Et'in "entry" karşısı) ≤K | satır ayrılır, bağ listesinde satırın devir kalemine yönelir (`line:`) | devir-d3-mahsup |
| m-8 | Karşı belge taksitli (kartlı) fatura / iade faturası | program Mahsup Et'e izin vermez (409) — sınanır, ayrım yok | devir-d3-mahsup |
| m-9 | Mahsup tarihi K (31.12) | ≤K mahsup — K kuyruğunun olağan 0. adımı (değişmedi) | devir-d3-mahsup |
| m-10 | Mahsup tarihi K+1 (01.01), belge K+1 | ayrılır (K sonrası) | devir-d3-mahsup |
| m-11 | İki şirket: 002'deki mahsup 001'in planını değiştirir | değiştirmez (dosya ayrı) | devir-d3-mahsup |
| m-12 | Ayırma tutarı programın kendi kuyruğundan değil elle formülden gelir (kilitli dönem sınırı, sıra) | ayrılan = devirsiz tek borç sırasının o mahsuba verdiği pay (aynı işlev) | devir-d3-mahsup + mutant |
| m-13 | Ayrılan kalem bağ listesinde arşiv başvurusu kalır (tur 2 davranışı) | bağ "acik-kalem" (devir kalemine) | devir-d3-bag (beklentisi değişen) |
| m-14 | Gerçek veride (v2.5.0 GERÇEK kodu) K sonrası mahsup → planda fark | gerçek veri üretecine mahsup olayı; devirsiz eşdeğer fark 0 | devir-d3-gercek-veri |

### Aynı yılın ikinci devri (BAŞ MİMAR KARARI 27.11)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| y-1 | Aynı yıl yeniden devredilir (çalışma dosyasının devir yılları o yılı gösteriyor) | DURDURUR "bu yıl zaten devredildi"; çare Devri Yenile / Devri Geri Al | devir-d3-ikinci |
| y-2 | Aynı yıl — şirketin arşiv kaydı o yılı gösteriyor, dosya ayarı göstermiyor | DURDURUR (aynı ileti) | devir-d3-ikinci |
| y-3 | Arşiv kaydı var ama arşiv dosyası yok | DURDURUR (aynı ileti; dosyanın bulunamadığı da yazılır, Devir Yedekleri) | devir-d3-ikinci |
| y-4 | Devir yılları ayarı var, arşiv kaydı yok (yarıda kalmış devir — tasarım §4.2) | DURDURUR ayrı ileti "önceki devir yarıda kalmış olabilir"; nereye Yedekler / destek | devir-d3-ikinci |
| y-5 | Sonraki yıl (2027) devredilmiş, önceki yıl (2026) seçildi | DURDURUR "sonraki yıl devredilmiş — önceki yıl devredilemez" | devir-d3-ikinci |
| y-6 | Önceki yıl (2025) devredilmiş, 2026 seçildi | GEÇER (yanlış durdurma yok) | devir-d3-ikinci |
| y-7 | Devri Geri Al'dan sonra (kayıt ve ayar kalkmış) | GEÇER | devir-d3-ikinci |
| y-8 | Öbür şirketin (002) arşivi / ayarı | sayılmaz | devir-d3-ikinci |
| y-9 | Ayar bozuk JSON | ayar yok sayılır (okunamayan ayar "devredilmedi" değil — arşiv kaydı yine denetler) | devir-d3-ikinci |
| y-10 | İleti iç kod / İngilizce / "undefined" taşır | dört alan temiz (iletiDenetimi) | devir-d3-ikinci + devir-d3-ileti (d) |

### Uzmanın ilk kabul testi (saf hesap tarafı) ve ek ölçütler
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| u-1 | Aralık 10.000 fatura, 4.000 tahsilat; 02.01 1.000 banka tahsilatı; sahte saat 05.01 — açılış 6.000 değil | cari açılışı (K bakiyesi) 6.000; açık kalem 6.000, ASIL VADE + belge no + belge tarihi | devir-d3-uzman |
| u-2 | K sonrası 1.000 tahsilat budanır ya da açılışa katılır | yeni yılda aynen (≤K / >K sayımında >K; K bakiyesinde yok) | devir-d3-uzman |
| u-3 | 05.01'de devirli ≠ devirsiz | bakiye 5.000, gecikmiş aynı (iki seçenek) | devir-d3-uzman |
| u-4 | Vadesiz fatura: açık kalemin vadesi K+1 olur (gecikmişten çıkar) | vade = belge günü | devir-d3-uzman |
| d-1 | Ön izlemeden sonra kayıt girildi ama "aynı" denir | veri değişti → DURDURUR iletisi (yeni ön izlemeyi inceleyip yeniden onaylayın) | devir-d3-uzman |
| d-2 | Kayıt girilmeden "değişti" denir (giriş, rapor açma, PDF indirme, yeni ön izleme) | değişmedi | devir-d3-uzman |
| d-3 | Var olan kaydın tutarı düzenlenir (satır sayısı aynı) | değişti | devir-d3-uzman |
| e-1 | Ön izleme e-Belge servisine istek gönderir / kullanım kaydını değiştirir | sahte EDM'ye 0 istek; kullanım satırları aynı | devir-d3-uzman |
| s-1 | Stok değişmezi yalnız TOPLAMDAN: iki ürünün miktarı yer değiştirir, toplam aynı | ürün ürün: arşiv K miktarı = açılış miktarı ve değer; tutmazsa DURDURUR (ürün adıyla) | devir-d3-stok |
| s-2 | Eksi stok / silinmiş ürün / sıfır stok değişmezi yanlış kırar | eksi: miktar aynen, değer 0; silinmiş: açılış yok (S207 = A); sıfır: satır yok — değişmez TUTAR | devir-d3-stok |
| c-1 | Çek / senet yön × durum (alınan portföy, bankada tahsilde, ciro, karşılıksız, tahsil edildi; verilen ödenmedi, ödendi) × çek / senet | her sınıf doğru hesap / alt hesap / yönde; kapanmış evrak listede yok; modül farkı yok | devir-d3-evrak-sinif |
| r-1 | Devir Raporu başlığında hazırlayan kullanıcı, aktarılan kalem sayıları, uyarılar / istisnalar yok ya da ekran ≠ PDF ≠ Excel | başlık satırları üçünde aynı | devir-d3-uzman |

### İleti eksikleri (kâhin ↔ plan karşılaştırması §9)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| i-1 | §9'un EKSİK / KISMİ maddelerinden biri tur 3'te hâlâ eksik | tablo (§4) — eksik kalan her madde dört alana tamamlanır | devir-d3-ileti-tum |
| i-2 | Katalogda üretilmemiş neden (testi olmayan ileti) | her plan sorunu ve her değişmez kodu en az bir kez üretilir ve kataloğa girer | devir-d3-ileti-tum |
| i-3 | Katalogda iç kod / İngilizce / tablo adı | 0 (kaynak taraması + katalog taraması) | devir-d3-ileti-tum |
