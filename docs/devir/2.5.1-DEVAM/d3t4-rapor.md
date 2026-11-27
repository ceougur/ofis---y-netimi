# D3 TUR 4 raporu — S-T2-1 = B, aynı yılın ikinci devri, uzman kabul ölçütlerinin saf hesap tarafı, ileti eksikleri (2.5.1)

Ajan: D3 TUR 4 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur3` (54eeb87a). D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme + ön denetim + Devir Raporu).
SON HÂL (27.11.2026). D3 tur 4'ün bütün işleri yapıldı; kabul A, B, C, E, F TAM; D'de tohum 11'in bir carisi önceden var olan (v2.5.0'dan beri) tek borç sırası kilit sınırı farkı — §7, §8 S-T4-1.

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

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Ekran YOK (D5). Değişen: ön izleme uçlarının (`POST/GET /api/admin/devir/preview…`) planı, ön denetimi ve Devir Raporu (ekran verisi + PDF + Excel). Var olan bir yolun (devir dışı) yanıtı DEĞİŞMEDİ.

| # | Ne (ekran / uç) | Önce (tur 3) | Sonra (tur 4) | Örnek (test) |
|---|---|---|---|---|
| H1 | **S-T2-1 = B** — K'den sonra yapılan Mahsup Et'in ≤K belgesi (planın açık kalemleri, cari satırları, bağ listesi) | K durumu yalnız ≤K kayıtlarla: ≤K alış K'de Aralık satışını netliyordu; mahsup yeni yılda karşı belgesiz | ≤K belge K kuyruğunda o mahsuba AYRILIR (ayrılan = devirsiz tek borç sırasının o mahsuba verdiği pay): pay yeni yıla o belgenin AÇIK KALEMİ olarak devreder, bağ listesinde mahsup o devir kalemine yönelir ("yeni-yila-ayrildi"); iki belgesi de ≤K olan K sonrası mahsup K'de uygulanmış sayılır ("k-de-kapandi"). Yeni plan alanı `newYear.mahsupAyirmalari` | Örnek AYNEN (tur 2 §9): Aralık satış 400 + alış 150, Ocak satış 300, 17.01 mahsup 150 → önce: Aralık satışı 250 açık, Ocak satışı yeni yılda 300; sonra: Aralık satışı 400 açık + alış 150 açık alacak kalemi (K bakiyesi 250 aynı), yeni yılda Ocak satışı 150; 01.01–29.01 gecikmiş 400 = devirsiz 400 (önce 250); 01.02'de 550 (devir-d3-mahsup M1; devir-d3-bag B2) |
| H2 | S-T2-1 — satış yönü, kısmi, silinmiş, iki mahsup, Alacak Yaz karşısı | (aynı tur 3 kuralı) | Aralık satışı 500 ↔ Ocak alışı 200 → satış 500 açık (200 ayrılmış); kısmi (alış 200, mahsup 150) → alışın 150'si ayrılır, 50'si satışı netler (satış 350); silinen mahsup hiçbir şey ayırmaz; aynı alışa iki mahsup (100 + 50) → 150 ayrılır; Alacak Yaz 150 karşısı → satırın açık kalemi (`line:` anahtarı, bağ satırın devir kalemine) | devir-d3-mahsup M2–M10, 002 |
| H3 | **Aynı yıl ikinci kez devredilemez** (ön denetim DURDURUR — üç yeni neden) | yok (yalnız "Kapanış Fişi zaten yazılmış" plan sorunu) | "Bu Yıl Zaten Devredildi" (çalışma dosyasının devir yılları ya da şirketin arşiv kaydı o yılı gösteriyorsa; çare Devri Yenile / Devri Geri Al; arşiv dosyası diskte yoksa "arşiv dosyası bulunamadı" + Devir Yedekleri); "Sonraki Yıl Devredilmiş" (devredilmiş yıldan önceki yıl); "Önceki Devir Yarıda Kalmış" (ayarda olup arşiv kaydında olmayan yıl — tasarım §4.2; Devir Yedekleri / destek). Öbür şirketin arşivi sayılmaz | "2026 yılı 05.01.2027 tarihinde zaten devredilmiş; şirketin 2026 arşivi kayıtlı." (devir-d3-ikinci) |
| H4 | **Ön izlemeden sonra veri değişti mi** (yeni işlev `onIzlemedenSonraDegisti(store, plan)` + ileti `onIzlemeBayatIletisi` — DURDURUR; kullanımı D4'te) | veri damgası vardı, sorulacak işlev ve ileti yoktu; damga bütün denetim izini sayıyordu (giriş, lisans, rapor görüntüleme izi damgayı değiştiriyordu) | damga yalnız verinin değişimini yazan izi sayar (fatura, cari, taksit, çek, kasa, banka, stok, şüpheli, vergi, defter, şirket, içe aktarma, ayar, personel); giriş / okuma / PDF-Excel indirme / ikinci ön izleme damgayı değiştirmez; yeni kayıt ve var olan kaydın tutar düzeltmesi değiştirir. Planın `meta.veriSurumu` değeri bu yüzden tur 3'tekinden farklıdır | devir-d3-uzman (2) |
| H5 | **Stok ürün ürün değişmezi** (planın değişmezleri: yeni `stok-urun`) | yalnız toplam (153 = DSS, Σ açılış = 153) | her ürün: arşiv K miktarı (okuyucunun bağımsız SQL'i) = açılış miktarı ve K değeri = açılış değeri; tutmazsa DURDURUR "N üründe kesim günü miktarı ya da değeri yeni yılın açılışıyla tutmuyor (Ürün P1: arşivde 6 Adet / …, açılışta 7 Adet / …)", Nereye: Stok | devir-d3-stok |
| H6 | **Devir Raporu** (ekran = PDF = Excel) | başlık kutuları: şirket, K, açılış günü, seçenek, defter türü, kimlik, veri sürümü, dönem sonucu, not | en başta YENİ "Özet" bölümü: Ön İzlemeyi Hazırlayan, Ön İzlemenin Hazırlandığı An ("05.01.2027 saat 10:00", yerel), Aktarılan Cari, Açık Fatura (satış / alış adet + tutar), Fatura Dışı Açık Kalem, Taksit Kartı, Çek / Senet, Banka Hesabı, Stok Kalemi, Şüpheli Alacak, Taşınan Hareket, Devri Durduran Neden, Uyarı, İstisnalar (eksi stok, arşiv başvurusu bağ, ayrılan mahsup); başlık kutularına "Ön İzlemeyi Hazırlayan", "Devri Durduran Neden", "Uyarı" (kısa) | "Aktarılan Cari: 2 cari (2 cari kartı yeni yıla geçer)", "Açık Fatura: 2 satış (8.000,00 TL) · 0 alış (0,00 TL)" (devir-d3-uzman (6)) |
| H7 | **İleti eksikleri** (karşılaştırma §9; tablo §3) | plan sorunlarında "Ön İzleme'yi yeniden başlat" yok; "Önceki Yıl Sonucu" tek adım; sonuç / 7 sınıfı tutarı "-15,00 TL"; modül farkında hangi modül yok; şüpheli farkında Defter Mutabakatı; stok / KDV değişmezinde Defter Mutabakatı; banka işinde tarih yok; Defter Mutabakatı'nda nasıl giderileceği tek cümle | hepsi adım adım + Ön İzleme'yi yeniden başlat + destek; "600 Yurt İçi Satışlar (Stok) alacak yönünde 15,00 TL"; "… Cari'nin / Kasa'nın / Çek / Senet'in / Banka'nın / taksit kartlarının / Şüpheli Alacaklar'ın / Stok'un açılışında …"; şüpheli → Cari › Şüpheli Alacaklar; stok değişmezi → Stok, KDV değişmezi → Vergi › KDV Mahsup Fişi; "1 banka / POS işi bekliyor (…); en eskisinin tarihi 31.12.2026"; Defter Mutabakatı: alt defterle karşılaştır → bulamazsan Mutabakat Testi + destek | devir-d3-ileti-tum, devir-d3-ileti |
| H8 | İletilerdeki an | ön izleme anı / devir günü UTC'den kesiliyordu (yalnız yeni ileti) | yerel saatle ("05.01.2027 saat 13:15" İstanbul) | devir-d3-uzman (2) |
| H9 | Uzmanın ilk kabul testi (saf hesap) | (davranış tur 3'te de doğruydu — sınıf testi yeni) | Aralık 10.000 fatura (vade 20.12.2026) − 4.000 tahsilat; 02.01.2027 1.000 banka tahsilatı; 05.01'de: cari açılışı 6.000 (iki seçenek), açık kalem 6.000 asıl vade 20.12.2026 + belge no + 01.12.2026; Ocak tahsilatı yeni yılda aynen (K sonrası sayımda, açılışa girmez); devirli = devirsiz bakiye 5.000, gecikmiş 5.000; vadesiz fatura vade = belge günü | devir-d3-uzman (1) |
| H10 | e-Belge | (sınanmamıştı) | ön izleme + PDF + Excel: sahte EDM'ye 0 istek, dışarı 0 istek, şirketin (edoc_usage / _meta / _defter) ve makinenin (e-belge-kullanim) kullanım satırları aynı | devir-d3-uzman (3) |

## 2. DEĞİŞEN DOSYALAR
- Ürün (D3): `server/lib/devir/plan-reader.mjs` (S-T2-1 ayırımı `offsetReservations` / `withReserved`; bağ listesinde Alacak / Borç Yaz karşısı; devir yılları + arşiv kaydı olgusu; `devirVeriSurumu` / `onIzlemedenSonraDegisti`; bağımsız stok miktarı `stockQtyAt`; banka işinin en eski tarihi), `server/lib/devir/plan.mjs` (açık kalem anahtarlı bağ yönlendirmesi, mahsup türü, `mahsupAyirmalari`, değişmez `stok-urun`), `server/lib/devir/preflight.mjs` (üç ikinci devir nedeni; `problemIletisi` eksikleri; `stok-urun` cümlesi; Defter Mutabakatı adımları; yerel an), `server/lib/devir/iletiler.mjs` (`devirYedekleri` hedefi, `onIzlemeBayatIletisi`, `localStamp`), `server/lib/devir/report.mjs` (Özet bölümü + kısa başlık kutuları), `server/lib/devir/plan-worker.mjs` (arşivler / hazırlayan işe), `server/routes/devir.mjs` (yalnız ön izleme işi: şirketin arşiv kaydı + dosyanın varlığı, hazırlayan, an). Başka ürün dosyası YOK (tek borç sırası, mahsup, defter, göç DOKUNULMADI).
- Testler (YENİ): `test/devir-d3-mahsup.test.mjs`, `test/devir-d3-ikinci.test.mjs`, `test/devir-d3-uzman.test.mjs`, `test/devir-d3-stok.test.mjs`, `test/devir-d3-evrak-sinif.test.mjs`, `test/devir-d3-ileti-tum.test.mjs`.
- Testler (DEĞİŞEN, beklentisi değişen — hepsi D3 dosyası): `test/devir-d3-bag.test.mjs` (S-T2-1: B2'nin açık kalemleri / bağı / devirsiz eşdeğeri B'ye — tur 2'de "sayılar SABİT; yanıta göre değişir" diye bırakılmıştı), `test/devir-d3-ileti.test.mjs` (sonuç / 7 sınıfı tutarı yönlü, modülün adı, cari farkında hesap adı), `test/devir-d3-uc.test.mjs` (rapor bölümleri "Özet" ile başlar; iş parçacığısız yola aynı hazırlayan / an). Yardımcı: `test/fixtures/devir-d3-esdeger.mjs` (bağ yönlendirmesi Alacak / Borç Yaz satırında da — D4a şartının benzetimi). CI dışı: `test/devir-d3-gercek-veri.mjs` (S-T2-1 olayı + denetimi), `test/devir-d3-mutasyon.mjs` (+14 mutant; M16 çapası), `test/devir-d3-ileti-katalog.mjs` (katalog taraması).
- Belge: `docs/devir/2.5.1-DEVAM/d3t4-rapor.md` (bu rapor), `docs/devir/2.5.1-DEVAM/d3t4-iletiler.md` (katalog).

## 3. TARAMA

### 3a. Kâhin ↔ plan karşılaştırması §9 (tur 2 kodu üzerinde) ↔ tur 3 kodu ↔ bu tur (iş 4)
EKSİK = ne yapmalı yok / iç kod; KISMİ = dört alandan biri zayıf (neden / nasıl / nereye / hangi kayıt). Her satırın tur 4 hâli kataloğun (`d3t4-iletiler.md`) testten üretilmiş cümlesidir.

| §9 maddesi | §9 (tur 2) | Tur 3 kodunda | Bu turda |
|---|---|---|---|
| `DEVIR_K_31_ARALIK` / `DEVIR_K_GELECEK` (nereye yok) | KISMİ | TAM (Ayarlar › Yıl Sonu Devri) | değişmedi |
| `e-belge-belirsiz` (neden yok) | KISMİ | TAM | değişmedi |
| `taslak-fatura` (neden yok) | KISMİ | TAM | değişmedi |
| `banka-isi` (neden yok) | KISMİ | TAM (ne oldu genel örnekti) | ne oldu'ya en eski işin tarihi |
| `defter-mutabakati` (nasıl giderileceği yok) | KISMİ | KISMİ ("farkı gösteren hesabın kayıtlarını düzeltin" tek cümle) | TAMAMLANDI: alt defter kayıtlarını Ana Defter'le karşılaştır → bulamazsan Mutabakat Testi + destek → Ön İzleme |
| `plan-yil-kapanmis` (ne yapmalı yok) | EKSİK | TAM | değişmedi (+ AYRI üç neden: H3) |
| `plan-donem-sonucu-farki` | EKSİK | KISMİ (Ön İzleme'yi yeniden başlat yok) | TAMAMLANDI |
| `plan-onceki-yil-dengesiz` | EKSİK | **EKSİK** (tek adım "farkı gösteren hesabı bulun", fark işaretli) | TAMAMLANDI (yıl adıyla hesap bul, düzelt, Ön İzleme, destek; fark yönsüz mutlak) |
| `plan-sonuc-hesabi-kaldi` (yalnız hesap kodu) | EKSİK | KISMİ ("-15,00 TL" yönsüz) | TAMAMLANDI ("alacak yönünde 15,00 TL"; düzelt adımı) |
| `plan-yedi-sinifi-kaldi` | EKSİK | KISMİ | TAMAMLANDI (yönlü; gider türü adımı) |
| `plan-modul-farki` (hangi modül yok) | EKSİK | KISMİ (cari adı var, modül yok) | TAMAMLANDI ("Kasa'nın / Çek / Senet'in / Banka'nın / Cari'nin / taksit kartlarının / Şüpheli Alacaklar'ın / Stok'un açılışında") |
| `plan-cari-satir-farki` (hangi cari yok) | EKSİK | TAM (cari adı) | hesap adı + Ön İzleme |
| `plan-supheli-farki` | EKSİK | KISMİ (nereye Defter Mutabakatı) | TAMAMLANDI (Cari › Şüpheli Alacaklar'da kayıtları denetle; nereye Şüpheli Alacaklar) |
| `plan-siniflandirilmamis-tablo` (tablo adı) | EKSİK | TAM (tablo adı yok) | Ön İzleme adımı |
| `plan-<öbür>` (varsayılan, iç kod) | EKSİK | TAM (iç kod yok) | Ön İzleme; KAYNAK TARAMASI: planın / okuyucunun hiçbir sorun türü varsayılana DÜŞMEZ (test) |
| `degismez-<kod>` | EKSİK | KISMİ (her değişmezde aynı adım; stok / KDV değişmezi Defter Mutabakatı'na; katalogda yalnız 2 değişmez) | TAMAMLANDI (stok → Stok, KDV → Vergi › KDV Mahsup Fişi; bütün değişmezler + `stok-urun` katalogda) |
| `devir-preview-failed` (iş parçacığı) | EKSİK | TAM (`beklenmeyen-hata`) | değişmedi |
| (yeni) ikinci devir ×3, ön izleme bayatladı, stok ürün ürün | — | — | YENİ, dört alan (H3–H5) |
Katalog: **56 neden** (durdurur 46, uyarı 10), kayıtlı 176 ileti; katalog taraması (iç kod / İngilizce / alan adı / ŞEMANIN TABLO ADLARI / ISO tarih / nokta ondalık) **0 ihlal**; kaynak taraması testi (`devir-d3-ileti-tum` 3): kaynaktaki her neden kodu üretildi, her sorun türünün kendi iletisi var.

### 3b. Komşular (ders 10 — 12:04 dersi; değişen işlevlerin ADLARI + çağıranları `git grep`)
`git grep -l -E "offsetReservations|withReserved|readDevirFacts|devirVeriSurumu|onIzlemedenSonraDegisti|buildDevirPlan|devirPreflight|problemIletisi|invariantText|DEVIR_TARGETS|PREFLIGHT_TARGETS|onIzlemeBayatIletisi|devirReport|runPreview|/api/admin/devir/preview|plan-reader|devir/plan\.mjs|devir/preflight|devir/report|devir/iletiler|devir-d3-esdeger|createEquivalence" -- server test tools` → yalnız `server/lib/devir/*`, `server/routes/devir.mjs` ve `test/devir-d3-*` (CI dışı hacim / gerçek veri / mutasyon / katalog betikleri dahil). Değişen `routes/devir.mjs`'nin öbür uçlarını (arşiv, devir yedeği, bakım) sınayan D2 testleri + yazım / taşınabilirlik / lisans / kanıt aracı denetimleri ayrıca:
| Koşu | TZ | Sonuç |
|---|---|---|
| `d3t4-yeni-utc` / `-ist` — D3 tur 1–4 testlerinin TAMAMI (20 dosya) | UTC / İstanbul | **132/132** / **132/132** |
| `d3t4-komsu-utc` / `-ist` — devir-arsiv-wal-250, devir-d2-arsiv-250, devir-d2-arsiv-goc-kesinti-250, devir-d2-yedek-250, devir-d2-bakim-250, yazim-duzeni, platform-tasinabilirlik, lisans-servisi-izolasyonu, kanit-araci | UTC / İstanbul | **103/103** / **103/103** |
Tek borç sırası (`obligation-queue.mjs`), girdi kurucusu, mahsup yolu (`routes/invoices.mjs`), defter, göç DEĞİŞMEDİ → onların komşuları koşulmadı (okuyucu yalnız çağırır).

## 4. Yeni / değişen testler — eski kod (t251-d3-tur3; AYRI kopya `git worktree add --detach /dev/shm/d3t4-k4/eski t251-d3-tur3`; YALNIZ 6 yeni test dosyası + yeni yardımcı `test/fixtures/devir-d3-esdeger.mjs` — ders 51) ↔ yeni kod
`d3t4-eski-utc` / `d3t4-eski-ist`: **18/35 geçti, 17 KIRMIZI** (iki TZ'de AYNI 17 test, aynı nedenler); `d3t4-yeni-utc` / `-ist`: **132/132**.

**E-1 — eski kodda KIRMIZI (neden iletiden okundu — ders 38):**
| Test | Eski kodda kırmızı nedeni | Neyin kanıtı |
|---|---|---|
| mahsup: açık kalemler | M1 `[[m1s,40000]]` beklenirken `[[m1s,25000]]` (alış K'de satışı netliyor, ayrılmıyor) | S-T2-1 = B yok |
| mahsup: ayırım listesi | "planda mahsup ayırım listesi yok" | S-T2-1 kodu yok |
| mahsup: bağ listesi | m1a / m3a / m5a / m7e "arsiv-basvurusu" (beklenen "acik-kalem"); Alacak Yaz karşısı listede yok | ayrılan belgeye yönlendirme yok |
| mahsup: DEVİRSİZ EŞDEĞER | "m1 2027-01-01 gecikmiş" (250 ↔ 400) | devirli ≠ devirsiz (tur 2'nin S-T2-1 farkı) |
| mahsup: 002 | 002'nin carisinde alış açık kalem değil | aynı |
| ikinci: y-1, y-2, y-3, y-4, y-5, y-8 | DURDURUR listesi `[]` (beklenen `devir-yil-devredilmis` / `-yarim-kalmis` / `-sonraki-yil-devredilmis`) | ikinci devir denetimi yok — eski kod aynı yılı İKİNCİ KEZ devre geçiriyordu |
| ileti-tum: §9 eksikleri | "plan-donem-sonucu-farki: Ön İzleme'yi yeniden başlat adımı" | ileti eksikleri |
| stok: plan | "ürün ürün değişmezi planda yok" | değişmez yok |
| stok: bozulma | "okuyucunun bağımsız stok miktarı yok" | değişmez yok (eski kodda yalnız toplam — toplam aynıyken GEÇİYORDU) |
| uzman (2) veri damgası | "onIzlemedenSonraDegisti yok" | işlev yok |
| uzman (2) ileti | "ileti yok" | ileti yok |
| uzman (6) rapor başlığı | "rapor Özet bölümüyle başlar" (ilk bölüm "Devri Durduran Nedenler") | başlık yok |

**E-2 — eski kodda da YEŞİL (sınıf testi; dişi mutasyonda — kırmızı kanıt diye YAZILMAZ, ders 7 / 38):** evrak-sınıf ×4 (tur 3 kodu yön × durumu zaten doğru hesaplıyordu — hata yok); ikinci: devir yokken / önceki yıl / Geri Al sonrası / bozuk ayar (yanlış durdurma yok); mahsup: veri tabanı, iki seçenek; ileti-tum: dört alan + kaynak taraması (tur 3 kodu da temizdi; eksik yalnız adımlarda); stok: veri tabanı; uzman (1) ×4 (uzmanın senaryosu tur 3 kodunda da doğruydu — hata yok), e-Belge istek 0 (tur 3 de istek göndermiyordu).
**Beklentisi değişen testler:** `devir-d3-bag` (S-T2-1 B2: açık kalem fb5 25000 → fb4 15000 + fb5 40000; bağ fb4 arşiv → açık kalem; S-T2-1 testi `[40000, 25000]` → `[40000, 40000]`; b2 devirsiz eşdeğer döngüsüne girdi), `devir-d3-ileti` (sonuç / 7 sınıfı tutarı yönlü; "modülün" → "Cari'nin"; cari farkında hesap adı), `devir-d3-uc` (rapor bölümleri "Özet" ile başlar; iş parçacığısız yola aynı hazırlayan / an). Üçü de yeni kodda iki TZ yeşil (`d3t4-yeni-*`).

## 5. Kabul koşullarının sayıları
- **A** `test:kahin-defter` UTC **187/187** + İstanbul **187/187**; `test:kahin-cari` UTC **25.298/25.298** + İstanbul **25.298/25.298** — tur 3 ile (187 / 25.298) AYNI; kâhin dosyalarına dokunulmadı.
- **B** yeni testler eski kodda beklenen nedenle kırmızı (§4: 17 test, iki TZ aynı); yeni kodda iki TZ **132/132**.
- **C** mutantlar: UTC **56/56 YAKALANDI** (`d3t4-mutasyon-utc`; taban 117/117); İstanbul: ****56/56 YAKALANDI** (`d3t4-mutasyon-ist`)**. Tur 1–3'ün 42'si AYNEN (M16'nın çapa metni yeni ada: `openInvoices.has(link.invoiceId)` → `openKeys.has(key)`, amacı aynı), bu turun 14'ü §6.
- **D** gerçek veri (v2.5.0 GERÇEK kodu → yeni kod) 3 tohum × 2 TZ: **t7 ve t23 iki TZ'de **22/22** (devirsiz eşdeğer fark 0, S-T2-1 ayırımı 8 — 6 yeni yıla + 2 K'de — carileri eşdeğerde); **t11 iki TZ'de 21/22** — devirsiz eşdeğerde 1 carinin farkı (12), S-T2-1 İLE İLGİSİZ, v2.5.0'ın tek borç sırasında da var (§7, §8 S-T4-1); S-T2-1 denetimi t11'de de YEŞİL** (tablo §7).
- **E** katalog 56 neden, 176 ileti; iç kod / İngilizce / alan adı / tablo adı **0** (katalog taraması + `devir-d3-ileti-tum` kaynak taraması).
- **F** komşular iki TZ **103/103** + D3'ün tamamı **132/132** (§3b).

## 6. Mutant tablosu (bu turun 14'ü; `test/devir-d3-mutasyon.mjs`, `git archive HEAD` kopyası)
| # | Mutant | Kırmızı test (UTC) |
|---|---|---|
| 43 | S-T2-1: K sonrası mahsubun ≤K belgesi ayrılmaz (tur 2 / 3 hâli) | mahsup açık kalemler + bağ (9 kırmızı) |
| 44 | S-T2-1: ayrılan pay yeni yıla açık kalem olarak devretmez | mahsup açık kalemler, bağ, eşdeğer (4) |
| 45 | S-T2-1: iki belgesi ≤K olan K sonrası mahsup K'de uygulanmaz | mahsup açık kalemler, eşdeğer (2) |
| 46 | ikinci devir: aynı yılın devri geçer | y-1, y-2, y-3, y-8 |
| 47 | ikinci devir: devredilmiş yıldan önceki yıl geçer | y-5 |
| 48 | ikinci devir: yarıda kalmış devir geçer | y-4 |
| 49 | stok değişmezi yalnız toplamdan | stok bozulma |
| 50 | veri damgası karşılaştırması hep "aynı" | uzman (2) |
| 51 | veri damgası düzeltmeyi görmez (yalnız satır sayısı) | uzman (2) |
| 52 | veri damgası giriş izini sayar (giriş devri yanlış durdurur) | uzman (2) |
| 53 | ön izleme e-Belge servisine istek gönderir | uzman (3) "sahte EDM'ye istek 0" |
| 54 | Devir Raporu: hazırlayan yazılmaz | uzman (6) |
| 55 | ileti eksikleri: Ön İzleme'yi yeniden başlat adımı yok | ileti-tum §9 |
| 56 | ileti eksikleri: tutar yönsüz | ileti-tum §9 + ileti |

## 7. GERÇEK VERİ (ders 17) — v2.5.0'ın GERÇEK kodu (`git worktree add --detach /dev/shm/d3t4-k4/v250 v2.5.0`), üç tohum × iki TZ
Üreteç tur 3'ünki + bu turun S-T2-1 olayı: Aralık 2026'da 10 KENDİNE AYRILMIŞ cari (havuz tahsilatlarına girmez): Aralık satış + Aralık alış; Ocak'ta beş sınıf sırayla (alış yönü tam, alış yönü kısmi, satış yönü, iki belge ≤K, sonradan silinen). Denetim: üretilen ayırım planda VAR ("yeni-yila-ayrildi" ≥ 1) ve carileri devirsiz eşdeğerin İÇİNDE (fark 0 — tur 3'ün 21 denetimine +1 = 22).
**Ders 6 — ilk koşu (tohum 7, UTC):** S-T2-1 denetimi kırmızı — "ayırım 0": üretecin ilk sürümü mahsubu havuz carisine yapıyordu; havuz carilerinin bağsız avansı faturayı kapattığı için 10 mahsubun hepsi programdan 409 "Mahsup tutarı faturanın açık tutarını (0,00 TL) aşamaz" aldı (yanıt sayımından okundu). Kök neden ÜRETEÇTE; program doğru reddetti. Üreteç kendine ayrılmış cariye geçirildi (b5f2d4e4), küçük duman koşusu (tohum 5, 40 cari) 22/22, ayırım 8 (yeni yıla 6, K'de 2), sonra üç tohum × iki TZ baştan. (İlk koşunun kanıt dosyası aynı adla üzerine yazıldı — ham çıktının bu satırları raporda.)
| Koşu (commit b5f2d4e4) | Sonuç | Devirsiz eşdeğer (karşılaştırma / fark) | Benzetim dışı cari | Bağ listesi (açık kaleme / arşive) | S-T2-1 ayırımı (yeni yıla / K'de) — carileri eşdeğerde | Süre |
|---|---|---|---|---|---|---|
| utc t7 | **22/22** | 3684 / 0 | 51 | 42 (16 / 26) | 8 (6 / 2) — 8 | 1013 sn |
| ist t7 | **22/22** | 3684 / 0 | 51 | 42 (16 / 26) | 8 (6 / 2) — 8 | 1018 sn |
| utc t11 | **21/22** — KIRMIZI 1 | 3684 / **12** | 51 | 45 (15 / 30) | 8 (6 / 2) — 8 (S-T2-1 denetimi YEŞİL) | 961 sn |
| ist t11 | **21/22** — KIRMIZI 1 | 3684 / **12** | 51 | 45 (15 / 30) | 8 (6 / 2) — 8 (S-T2-1 denetimi YEŞİL) | 961 sn |
| utc t23 | **22/22** | 3852 / 0 | 37 | 47 (20 / 27) | 8 (6 / 2) — 8 | 871 sn |
| ist t23 | **22/22** | 3852 / 0 | 37 | 47 (20 / 27) | 8 (6 / 2) — 8 | 871 sn |
| **eski kod** (t251-d3-tur3 + bu turun üreteci) utc t11 | 20/22 — KIRMIZI 2 | 3684 / **60** | 51 | — | **0** (S-T2-1 denetimi KIRMIZI) | — |
İki TZ aynı tohumda AYNI veriyi üretti (sayılar birebir). Duman (40 cari, tohum 5, UTC): 22/22, ayırım 8.

**D KABULÜ TAM DEĞİL — tohum 11'de 1 carinin farkı (her iki TZ, 6 gün × 2 seçenek = 12) — S-T2-1 İLE İLGİSİZ, ÖNCEDEN VAR (ders 6 ile ayrıştırıldı):**
- Cari "Müşteri 108" (mahsubu YOK — bu turun kodu o caride planı değiştirmez): ≤K satışlar FIS…540 (13.05.2026, 350,40) — 25.07 iadesi 175,20 (bağlı) + 11.08 havale 1.603,00'ün 175,20'si (BAĞSIZ, otomatik) ile kilitli dönemde kapanmış; **06.01.2027'de (Dönem Kilidi K'den sonra) 128,00 tahsilat FIS…540'a BAĞLI** girilmiş.
- Devirsiz program (tek borç sırası, aynı kilitle): bağlı 128,00 kilitli dönemde bağsız kapanmış faturayı KAPATIYOR (FIS…540 kapatanları: 128,00 bağlı + 175,20 iade + yalnız 47,20 havale), havalenin serbest kalan 128,00'i 19.01.2027 vadeli FIS…1287'ye gidiyor → açık kalemler 22.12.2026 | 408,00 · 19.01.2027 | 1.117,40.
- Plan (K durumu ≤K kayıtlarla, S24 = A; bağ kapanmış ≤K faturaya → arşiv başvurusu, 28 = A "bağsız gibi dağılır"): K'de FIS…540 iade + havale 175,20 ile kapalı; yeni yılda 128,00 bağsız → vadesi en önce gelen 22.12.2026 → 280,00 · 1.245,40. Bakiye AYNI (1.525,40); 01.01–19.01 gecikmiş devirsiz 408,00 ↔ devirli 280,00.
- Kök neden (koddan okundu — `server/lib/obligation-queue.mjs` karar (3) kilit sınırı, satır ~296–330): kilit duyarlı bağın sınırı, bağ SERBEST sayılan ölçüm geçişinde "hedefin kilit gününe kadar bağsız kapanmış kısmı"dan hesaplanıyor; o geçişte bağ (sıra 3) havaleden (bağsız) ÖNCE faturayı kapattığı için havalenin faturadaki payı 47,20 ölçülüyor → sınır 350,40 − 47,20 − 175,20 (iade) = 128,00 → bağ kilitli dönemin bağsız kapanışını 128,00 kaydırıyor. Kilitli dönemdeki gerçek durumda havalenin payı 175,20 → sınır 0 olmalıydı (karar 28 = A / karar (3) "kilitli dönemde bağsız kapanmış kalem sonraki bağla açılmaz").
- Eski sürüm karşılaştırması: aynı veri tabanında **v2.5.0'ın gerçek tek borç sırası da AYNI** (FIS…540: 128 bağlı + 175,20 iade + 47,20 havale; açık 408,00 / 1.117,40) → yayımlanmış 2.5.0'dan beri var; **tur 3 kodu** aynı veride aynı farkı veriyor (eski kodla tohum 11: fark 60 = bu cari 12 + S-T2-1 carileri 48 — ikincisi bu turda KAPANDI).
- Sonuç: devirin değil, CANLI programın (cari kartı / gecikmiş / Vade Takip) kilit sınırı davranışı; bu turda KODLANMADI (tek borç sırası görev dışı, para / kapama kuralı — ders 43). §8 KULLANICIYA SORULMALI S-T4-1. Yeniden üretim: `/tmp/d3-gercek-veri-B7lpyY/data/destekofis.sqlite` (UTC t11'in veri klasörü — ana oturum için BIRAKILDI) + `node /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/d3t4/incele.mjs <kök> <veri dosyası> account-53c02eea-05b7-4edb-b92c-9c04f5042953` (salt okuma kopyasında devirsiz ↔ K kuyruğunun kapatanları; kök = bu dal ya da v2.5.0 kopyası).


## 8. KULLANICIYA SORULMALI
- **S-T4-1 (para / kapama — ders 43; devirin değil CANLI programın kuralı; KODLANMADI) — Dönem Kilidi'nden SONRA, kilitli dönemde iadeyle + bağsız tahsilatla kapanmış faturaya BAĞLI tahsilat girilirse.** Gerçek veri tohum 11 (§7): "Müşteri 108" — FIS…540 (13.05.2026, 350,40) kilitli dönemde 175,20 iade + 175,20 havale (bağsız) ile kapalı; 06.01.2027'de 128,00 tahsilat FIS…540'a bağlı.
  Bugünkü program (v2.5.0'dan beri): bağ, kilit sınırını "bağ serbestken ölçülen bağsız pay"la (47,20) hesaplıyor → bağ 128,00'i alıyor, havalenin 128,00'i 19.01.2027 vadeli faturaya kayıyor: açık kalemler 22.12.2026 → 408,00, 19.01.2027 → 1.117,40; 01.01–19.01 gecikmiş 408,00. Devir planı (S24 = A, 28 = A): 280,00 / 1.245,40; gecikmiş 280,00. Bakiye ikisinde 1.525,40.
  - **A (öneri):** tek borç sırasının kilit sınırı düzeltilsin — kilitten sonra kurulan bağ, faturanın kilit anındaki GERÇEK bağsız kapanışını kaydırmaz (28 = A'nın metni: "kilitli dönemde bağsız kapanmış kalem sonraki bağla açılmaz"; bağın tutarı bağsız ödeme gibi vadesi en önce gelen borca). Sayılar: 280,00 / 1.245,40 (devirli = devirsiz); canlı cari kartının gecikmişi bu caride 408,00 → 280,00 (01.01–19.01). Kod tek borç sırasında → ayrı paket (cari kâhini + dar kontrol + mutasyon).
  - **B:** program böyle kalsın; devir planı K durumunu bu sınırla (K sonrası bağın payını K'ye katarak) kursun — S24 = A ile çelişir, plan karmaşıklaşır.
  - **C:** uç durum böyle kalsın (BİLİNEN SINIR) — kilitten sonra, kilitli dönemde iade + bağsız tahsilatla kapanmış faturaya bağlı tahsilat seyrek; bakiye aynı, yalnız kalemlerin vadesi (gecikmiş 19.01'e kadar) ayrışır; devirsiz eşdeğer testinde bu sınıf ayrı sayılır.
  - Yaygın programlarda nasıl: belgesi okunmadı — DOĞRULANMADI. Kanıt: v2.5.0 GERÇEK tek borç sırasıyla aynı veri tabanında aynı sayılar (§7); eski kodla (tur 3) aynı veride aynı fark.
- **Devir kuralında yeni para / kapama / defter sorusu ÇIKMADI.** S-T2-1 = B kararın metniyle kodlandı (iki belgesi de ≤K olan K sonrası mahsubun K'de uygulanmış sayılması kararın "eski belgeyi o mahsuba AYIRIR" + "DEVİRLİ = DEVİRSİZ" metninden türetildi — iki belge de eski, ikisi de ayrılır; devirsiz programla aynı sonuç; §9 BAŞ MİMAR).
- S-SUR-1 (POS iadesi) ve S-SUR-2 (Borçta Kalsın kalanının belge tarihi) kullanıcıda — DOKUNULMADI; bu turun testleri bu iki davranışı SABİTLEMEZ (senaryolarda POS iadesi / Borçta Kalsın kalanı yok).
- H-1 (ön izleme hızı) kullanıcıda — hız yoluna kod değişikliği yok (§10).

## 9. BAŞ MİMAR KARARI GEREKİYOR (değerlendirme; hepsi D4a şartı ya da yorum)
- **BM-T4-1 (S-T2-1, D4a şartı):** yeni yılda "yeni-yila-ayrildi" mahsubun ≤K tarafı devir kalemine yönlenir (`baglar` satırında `mahsup` alanı). ≤K taraf mahsubun ANA belgesiyse (satış yönü: `invoice_offsets.invoice_id` ≤K) yeni yılda o taraf bir `account_entries` satırıdır; `invoice_offsets.invoice_id` fatura olmak zorunda (tek borç sırası `inv:` anahtarı) → D4a satırı yeniden yazarken rolleri değiştirmeli: `invoice_id` = K sonrası karşı fatura, `counter_type 'entry'` = devir kalemi (0. adım iki yönde aynı; kilitli dönem sınırı yalnız ana belgeye bakar — yeni yılda ana belge K sonrası olduğundan sınır uygulanmaz, devirsiz programla aynı). "k-de-kapandi" mahsup yeni yılda YENİDEN uygulanmamalı (iki belge de arşivde; bugün yeni yıl kuyruğunda iki tarafın birlikte açık kalması net görünümde olanaksız olduğundan zararsız, ama D4a satırı budamalı ya da işaretlemeli). Öneri: D4a görev metnine bu iki şart.
- **BM-T4-2 (veri damgası):** `meta.veriSurumu` artık yalnız verinin değişimini yazan izi sayıyor (giriş / lisans / rapor / WhatsApp / mobil izi saymaz). Liste koddadır (`DATA_AUDIT_TYPES`); yeni bir veri modülü kendi iz türüyle eklenirse listeye girmeli — girmezse o modülün DÜZELTMESİ (satır sayısını değiştirmeyen) damgayı değiştirmez (yeni kayıt / silme yine değiştirir). Öneri: D4'te devir kopyada planı YENİDEN hesapladığı için (tasarım §4.1 adım 4) iki planın karşılaştırması asıl güvencedir; damga erken uyarıdır.
- **BM-T4-3 (Devir Raporu):** başlık bilgisi kutulardan "Özet" bölümüne taşındı (PDF'te özet kutusu uzun değeri kesiyordu — ekran ≠ PDF olurdu). D5 ekranı Özet'i başta göstermeli.
- **BM-T4-4 (ikinci devir — arşiv kaydı ile çalışma dosyasının tutarsızlığı):** kayıtta olup çalışma dosyasında olmayan ÖNCEKİ yıl (ör. kayıtta 2025, dosyada yok; 2026 devrediliyor) bugün durdurmaz (karar metni yalnız aynı yıl / sonraki yıl / yarıda kalmışı söylüyor). Bu durum geri yüklemede `assertDevirConsistent` ile engelleniyor (D2). Öneri: D4'ün takas öncesi denetimine "kayıt ↔ dosya aynı yıllar" eklensin.

## 10. HIZ
Hız yoluna YAPISAL değişiklik yok; eklenenler: (a) S-T2-1 — devirsiz kuyruk YALNIZ K sonrası mahsubu ≤K belgeye dokunan carilerde (gerçek veride 10 cari) bir kez kurulur; (b) veri damgası — denetim izinde iz türüne göre TEK sayım (bütün tablo taraması; önce MAX(rowid) idi); (c) stok — TEK GROUP BY. Öğe başına ağır okuma yok (ders 47). Temiz büyük veride ölçülmedi (görev metni: ana oturum ölçer). Gerçek verinin süre satırı (yük 6–9 / 4 çekirdek — ölçüm GEÇERSİZ, yalnız bilgi) ham çıktıda.

## 11. SONRAKİ SÜRÜME (20.11 kuralı)
- Devir Raporu'nun "Hareketler" bölümünün Kod sütununda ve "Listeler"deki bağ satırında şema tablo adı görünüyor (`account_entries`, `invoice_offsets`) — tur 3'ten; ileti değil, rapor satırı. D5'te Türkçe ada (ör. "Cari Hareketleri", "Mahsup") çevrilmeli.
- Katalog üreticisinin "ilk örnek" seçimi testlerin koşu sırasına bağlı (tur 3'ten).
- Mutasyon tabanı `devir-d3-uc` ve `devir-d3-zaman`'ı içermiyor (tur 1'den).
- "Bu Yıl Zaten Devredildi" iletisindeki gün, test benzetiminde (makeArchive) gerçek saatten geliyor (27.11.2026) — D4'ün yazacağı devir anı.

## 12. DOĞRULANMADI
- S-T2-1: Borç Yaz satırının (alış yönünde Mahsup Et'in "entry" karşısı) ayrımı — yalnız Alacak Yaz sınandı (kod iki yönde aynı yol).
- S-T2-1: ≤K belgesi K'den ÖNCEKİ kilitli dönemde olan (ör. kilit 30.06, belge 01.05) K sonrası mahsubun kilit sınırı — ayrılan tutar devirsiz kuyruğun KENDİ payından (kilit sınırı dahil) alındığı için aynı olmalı; ayrı senaryo kurulmadı.
- S-T2-1: ayrım belgeyi K kuyruğunda 0'a indirince aynı belgeye ≤K bağlı tahsilatın hedefi kuyrukta yok (bağsız gibi dağılır) — devirsizde de belge 0. adımda kapandığı için fazla aynı kurala (S255) gider; senaryo kurulmadı.
- Veri damgası: arka plan yazıcılarının (tekrarlayan fatura, e-Belge durum turu) izi — veri değişimidir, damgayı değiştirir (doğru); ayrı senaryo yok.
- Gerçek veride ikinci devir (arşiv yok — D4'ün işi).

## 13. DENENMEYEN
- Ekran (D5), ana oturumun ekran yürüyüşü (cümlelerin okunması) — katalog hazır.
- D4 yolları (bayat ön izlemenin kullanımı, takas öncesi ikinci devir denetiminin yinelenmesi).
- Mahsup Et'in taksitli faturaya / iade faturasına karşı yapılması — program izin vermiyor (409; `routes/invoices.mjs` PLANNED_OFFSET, karşı tür listesi); test edilmedi.
- Windows: `devir-d3-ikinci` arşiv klasörünü SİLER (kendi geçici klasöründe, tam yolla; program arşivi açmamışken) — ders 48: CI Windows'ta ana oturum görür.
- Tam `npm test` (ana oturum); temiz büyük veride hız (ana oturum).

## 14. CI listesine eklenecek
- Yeni 6 `test/devir-d3-*.test.mjs` npm test deseniyle kendiliğinden girer; ci.yml değişmez. Yeni ekran senaryosu YOK.
- CI DIŞI: `node test/devir-d3-gercek-veri.mjs --eski <v2.5.0> --tohum N`, `node test/devir-d3-mutasyon.mjs --kopya <kopya>`, `D3T3_KATALOG_DIR=<k> node --test …; node test/devir-d3-ileti-katalog.mjs <k> <md>` (taramada ihlal varsa çıkış 1).

## 15. Kılavuz metni önerisi (D5'te; kılavuza DOKUNULMADI)
"**Bir yıl bir kez devredilir.** Yıl Sonu Devri, devredilmiş bir yılı yeniden devretmez. Eski yılda düzeltme gerekiyorsa Devri Yenile'yi, devri baştan yapmak için önce Devri Geri Al'ı kullanın."
"**Ön izlemeden sonra kayıt girerseniz** devir durur; Ön İzleme'yi yeniden başlatıp yeni sayıları inceleyin, sonra devri yeniden onaylayın."
"**Ocak'ta Aralık faturasıyla mahsup** yaptıysanız devir bu mahsubu korur: Aralık faturası yeni yıla açık kalemiyle geçer, Ocak'taki mahsup ona bağlı kalır."
"**Devir Raporu'nun Özet bölümü** ön izlemeyi kimin hazırladığını, kaç cari, fatura, kart, çek / senet ve ürünün aktarılacağını ve uyarıları gösterir."

## 16. Commit listesi (dal `worktree-agent-a922ed4d1d1297419`, taban 54eeb87a `t251-d3-tur3`)
- 364af232 D3 tur 4: nasıl bozulur listesi (koddan önce)
- e82c90e3 D3 tur 4: S-T2-1 = B — K sonrası Mahsup Et'in ≤K belgesi K kuyruğunda o mahsuba ayrılır (devirsiz tek borç sırasının payı; yeni yıla açık kalem ya da K'de kapandı), bağ listesinde Alacak / Borç Yaz karşı satırı ve mahsup türü
- d2ceca0f D3 tur 4: S-T2-1 = B testleri — örnek AYNEN, satış yönü, kısmi, silinmiş, iki mahsup, iki belge ≤K, Alacak Yaz karşısı, K / K+1, iki şirket, iki seçenek; tur 2 bağ testinin S-T2-1 beklentisi B'ye
- 24bfd0f8 D3 tur 4: aynı yıl ikinci kez devredilemez (üç neden: bu yıl devredildi, sonraki yıl devredilmiş, yarıda kalmış devir); ön izlemeden sonra veri değişti mi işlevi + iletisi; stok ürün ürün değişmezi; Devir Raporu başlığı (hazırlayan, kalem sayıları, uyarılar / istisnalar); karşılaştırma §9'un ileti eksikleri
- ff67921e D3 tur 4: ikinci devir testi — aynı yıl (ayar + kayıt / yalnız kayıt / dosyası yok), yarıda kalmış devir, sonraki yıl, önceki yıl ve Geri Al sonrası geçer, bozuk ayar, iki şirket
- 3ad3ab52 D3 tur 4: Devir Raporu başlığı 'Özet' bölümü olarak en başta (PDF'te hücre sarılır, kesilmez); başlık kutularında kısa değerler
- 70fac59b D3 tur 4: uzmanın ilk kabul testi (açılış 6.000, Ocak tahsilatı yeni yılda, 05.01 bakiye 5.000, asıl vade, vadesiz), veri damgası işlevi + iletisi, e-Belge'ye istek 0 / kullanım aynı, Devir Raporu Özet'i ekran = PDF = Excel; uc testinde Özet bölümü
- c7293499 D3 tur 4: stok ürün ürün değişmezi testi — eksi, silinmiş, sıfır, K sonrası hareket; iki ürünün miktarı yer değiştirince (toplam aynı) değişmez kırılır, ön denetim ürün adlarıyla durur
- 1c34f309 D3 tur 4: çek / senet yön × durum sınıf testi — alınan portföy / tahsilde / ciro / karşılıksız (portföyden, cirodan) / tahsil edildi, verilen ödenmedi / ödendi; çek ve senet; kapanış = açılış, karşılıksızın carisi devirli = devirsiz
- 07e521ea D3 tur 4: ileti testi — her neden (ön denetim, plan sorunları, değişmezler, redler, bayat ön izleme) üretilir, dört alan temiz, tablo adı yok; karşılaştırma §9 eksiklerinin tamamı; kaynak taraması (yeni neden / sorun türü iletisiz kalamaz)
- 6977de86 D3 tur 4: gerçek veri üretecine S-T2-1 olayı (Aralık alışı + Ocak Mahsup Et: alış yönü tam / kısmi, satış yönü, iki belge ≤K, silinen) ve denetimi; katalog üreticisine katalog taraması (iç kod / İngilizce / alan adı / tablo adı)
- 34ea3909 D3 tur 4: mutasyon taramasına bu turun 14 mutantı (S-T2-1 ×3, ikinci devir ×3, stok ürün ürün, veri damgası ×3, e-Belge isteği, rapor başlığı, ileti eksikleri ×2); M16'nın çapası yeni ada (amacı aynen); yeni testlerde eski kod kırmızısının nedeni iddiadan
- 510125b1 D3 tur 4: iletilerde an yerel saatle (ön izleme anı, devir günü — UTC kesimi yerine)
- eca41373 D3 tur 4: stok testinde ürün sırası kimlikten bağımsız; ön izleme anı iki saat diliminde
- 7d7ef7ba D3 tur 4: ileti kataloğu (testlerin ürettiği gerçek iletilerden; 56 neden — durdurur 46, uyarı 10; 176 ileti; katalog taraması 0 ihlal)
- b5f2d4e4 D3 tur 4: gerçek veri üretecinde S-T2-1 olayı kendine ayrılmış caride (ilk koşu tohum 7: havuz carilerinin avansı faturaları kapattığı için bütün mahsuplar 409 — kök neden üreteçte); 10 olay, beş sınıf sırayla
- 1114248e Kanıt: D3 tur 4 koşuları (yeni kod 132/132 iki TZ, eski kod 17 kırmızı iki TZ, komşular 103/103 iki TZ, kâhin defter 187 / cari 25.298 iki TZ, mutasyon 56/56 iki TZ, gerçek veri 3 tohum × 2 TZ + eski kodla tohum 11, duman)
- (bu rapor commit'i — dal ucu SubagentHandback iletisinde)

## 17. Ana oturumun yeniden koşacağı komutlar
```
cd <bu dal>; export HUKUK_LICENSE_URL=http://127.0.0.1:9
T="test/devir-d3-plan.test.mjs test/devir-d3-esdeger.test.mjs test/devir-d3-uc.test.mjs test/devir-d3-zaman.test.mjs test/devir-d3-bag.test.mjs test/devir-d3-evrak.test.mjs test/devir-d3-banka.test.mjs test/devir-d3-olgu.test.mjs test/devir-d3-supheli.test.mjs test/devir-d3-ileti.test.mjs test/devir-d3-kural.test.mjs test/devir-d3-kart-tarihi.test.mjs test/devir-d3-wa.test.mjs test/devir-d3-acik.test.mjs test/devir-d3-mahsup.test.mjs test/devir-d3-ikinci.test.mjs test/devir-d3-uzman.test.mjs test/devir-d3-stok.test.mjs test/devir-d3-evrak-sinif.test.mjs test/devir-d3-ileti-tum.test.mjs"
for tz in UTC Europe/Istanbul; do TZ=$tz node tools/kanit.mjs kos d3t4-$tz -- node --test --test-concurrency=1 $T; done      # 132/132
# eski kod kırmızısı: git worktree add --detach <yer>/eski t251-d3-tur3; yalnız 6 yeni test + test/fixtures/devir-d3-esdeger.mjs → 18/35, 17 kırmızı
# komşular: node --test --test-concurrency=1 test/devir-arsiv-wal-250.test.mjs test/devir-d2-arsiv-250.test.mjs test/devir-d2-arsiv-goc-kesinti-250.test.mjs test/devir-d2-yedek-250.test.mjs test/devir-d2-bakim-250.test.mjs test/yazim-duzeni.test.mjs test/platform-tasinabilirlik.test.mjs test/lisans-servisi-izolasyonu.test.mjs test/kanit-araci.test.mjs   # 103/103
# mutasyon: git archive HEAD server test package.json | tar -x -C <kopya>; node test/devir-d3-mutasyon.mjs --kopya <kopya>   # 56/56
# gerçek veri: git worktree add --detach <yer>/v250 v2.5.0; node test/devir-d3-gercek-veri.mjs --eski <yer>/v250 --tohum 7   # 22/22
# katalog: D3T3_KATALOG_DIR=<k> node --test $T; node test/devir-d3-ileti-katalog.mjs <k> docs/devir/2.5.1-DEVAM/d3t4-iletiler.md
npm run test:kahin-defter; npm run test:kahin-cari    # 187 / 25.298
```

## 18. Ortam (bitişte)
Yük 2,3 / 4 çekirdek (koşular sırasında 5–9); bellek boş 6 GB (kullanılabilir 12 GB); disk boş 14 GB. Kendi kopyalarım: /dev/shm/d3t4-k4/eski ve /dev/shm/d3t4-k4/v250 (git worktree — KALDIRILDI; ana oturum yeniden koşacaksa kendi kopyasını kurar), mutasyon kopyaları (kaldırıldı), üretecin geçici klasörleri (kendi beşi TAM yolla silindi; /tmp/d3-gercek-veri-B7lpyY inceleme için BIRAKILDI; 11:2x tarihli üçü benim değil — dokunulmadı).
