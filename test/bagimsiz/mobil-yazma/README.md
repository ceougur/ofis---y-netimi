# M5 Mobil Yazma (tahsilat / ödeme / stok) — Temiz Oda Kâhini (2.4.7)

Bu klasör 2.4.7'nin **M5 — mobilden yazma** işinin bağımsız kâhinidir: telefon (tablet, uzak tarayıcı) üzerinden girilen tahsilat, ödeme
ve stok hareketlerinin beklenen sonucunu (cari bakiye, fatura kapama, taksit kartı, Kasa / banka / POS / kurumsal kart, stok, adımın yanıtı)
**programın kodunu görmeden**, karar metinlerinden üretir (CLAUDE.md ders 5, KANIT KURALI 2).

Temel iddia (**eşdeğerlik**): mobil yazma *mevcut API üzerinden, para çekirdeği kurallarıyla* yapılır (CLAUDE.md Açık iş, MOBİL kararları,
26.10.2026; devir §3.1 "MOBİL YAZMA"). Bu yüzden kabul edilen her mobil istek, masaüstünden girilen AYNI işle **aynı** sayıları verir. Kâhin
para anlamını yeniden yazmaz: mevcut bağımsız **cari kâhinine** (`test/bagimsiz/cari/model.py`, kural seti 2.4.6) devreder. Mobil ya da
masaüstü kanaldan kabul edilen her istek o kâhinin aynı olayına (`tahsilat`, `odeme`, `evrak`, `kart_tahsilat`) çevrilir. Cari kâhini
**değiştirilmedi**, yalnız içe aktarıldı (test A2 + H).

Bu katmanın kendi kuralları: mobil kapılar (sunucu, tünel kesintisi, lisans, eşli cihaz, Uzaktan Bağlanabilir izni), şirket ve rol yetkisi,
istek kimliği (tekrar / yarıda kesilme / budama), hesap seçimi, Benzer İşlem, Kasa eksi bakiye, taksit kartı K8, stok ve eksi stok, tarih (gece
yarısı, ay sonu, yıl dönümü, dönem kilidi), eşzamanlılık.

## Temiz oda

**Okunan kaynaklar (karar metinleri):**
- `CLAUDE.md`: anayasa, KANIT KURALI, dersler 5, 7, 10, 13, 17, 22, 31, 32, 40, 43; Kalıcı ürün kararları (Kasa yalnız nakit; tahsilatta POS,
  ödemede Kredi Kartı; eksi stok "program sorar"; fatura kapama yöne göre, Kapatılacak Fatura; çek/senet); Açık iş MOBİL kararları
  (26.10.2026 ×3), FIFO kararı (24.10.2026 (b)).
- `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.1; `docs/2.4.7-IS-LISTESI.md` ("Nasıl bozulur?", "Mobil dalga 2 riskleri", "KARAR — K8-AVANS" — kullanıcı,
  29.10.2026 "A ÖNERİN UYGUN"; aşağıda "KARAR K8-AVANS").
- `docs/PRO-UZAKTAN-GORUNTULEME.md` (mimari, "Yetki ve cihaz eşleme", "Yeniden eşleme gereken durumlar", lisans; Pro kilidi kısmı 26.10 kararıyla
  geçersiz — mimari geçerli).
- `docs/BANKA-MODULU-PLAN.md` §2.5, §3.3, §3.5, §3.9, §3.10 (istek kimliği, Benzer İşlem, K8), §9; `test/bagimsiz/SENARYO-DILI.md` §3–§5
  (yetki tablosu, ret önceliği, ret kataloğu, eşzamanlı adımlar).
- `test/bagimsiz/cari/` (`model.py`, `KARARLAR.md`, elle senaryolar) — öbür temiz oda kâhini; `test/bagimsiz/edm-sayac/README.md`,
  `kahin_test.py` (yalnız klasör ve test düzeni için).
- **MEVCUT ÜRÜN** (ana oturum programın kodundan doğrulayıp veri olarak verdi): şirket görüntüleme yetkisi kullanıcı × şirket; yönetici her şirketi
  görür; hiç işaretsiz kullanıcı yalnız 001; roller / yetkiler her şirkette aynı.

**Okunmayanlar:** `server/`, `client/`, `packaging/`, `tools/` (yalnız `tools/kanit.mjs` ÇALIŞTIRILDI, kodu okunmadı), `test/` altındaki program
testleri ve program sürücüleri (`test/bagimsiz/surucu.mjs`, `test/bagimsiz/cari/kos.mjs`, `test/bagimsiz/edm-sayac/program-surucu.mjs`,
`fark-analiz.mjs`), git geçmişi / farkları, `docs/kanit/**`.

**Karar vermedim** (ders 40, 43): metnin sustuğu her para / kapama / tekilleştirme kuralı bir **parametre** oldu (aşağıda S1–S8). Kâhin her
birleşimin (2⁸ = 256) beklenenini hesaplar; kullanıcı seçene dek program **önerilen** birleşimle karşılaştırılır ve fark **İNCELE** sayılır.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `kahin.py` | Model (yalnız standart kütüphane; cari kâhinini içe aktarır) + komut satırı (`hesapla`, `karsilastir`, `--mutasyonlar`) |
| `senaryolar.py` | 51 elle uç senaryo (beklenenler ELLE; 20'si 10 masaüstü/mobil eşdeğerlik çifti) + 4 göreli çift + tohum 1–3 rastgele üretici ve onun BAĞIMSIZ akış modeli (`Akis`); `kabul.json`'u yazar |
| `kabul.json` | 54 senaryo (51 elle, 3 rastgele), 8.160 adım; elle senaryolarda ilgili parametrelerin her birleşimi, rastgelelerde 10 birleşim (öneri tam, öbürleri fark olarak); göreli çiftler |
| `kahin_test.py` | Kâhinin kendi testi (A–E, G, H) + 53 mutasyon (F); TAP + `# tests/pass/fail` |
| `kanit/<gün>/` | `tools/kanit.mjs kos` kayıtları (çıkış kodu, sayılar, ham çıktı, commit) ve `kirmizi/` bilerek kırmızı kanıt |

## Nasıl koşulur

```sh
python3 -I test/bagimsiz/mobil-yazma/senaryolar.py              # kabul.json'u yeniden üretir (model ≠ elle ya da ≠ akış → YAZMAZ, çıkış 1)
python3 -I test/bagimsiz/mobil-yazma/senaryolar.py --olay 5000  # büyük hacimle yalnız denetim (dosya yazılmaz)
python3 -I test/bagimsiz/mobil-yazma/senaryolar.py --senaryo E22-gece-yarisi-yeniden > e22.json   # sürücü için tek senaryo
KANIT_DIR=test/bagimsiz/mobil-yazma/kanit node tools/kanit.mjs kos kahin-mobil-yazma -- python3 -I test/bagimsiz/mobil-yazma/kahin_test.py
python3 -I test/bagimsiz/mobil-yazma/kahin.py hesapla e22.json --param tarih=form_tarihi
python3 -I test/bagimsiz/mobil-yazma/kahin.py karsilastir test/bagimsiz/mobil-yazma/kabul.json program.json --birlesim "kapatilacak=secilir;…"
```

Python 3.11+ (geliştirmede 3.13), hep `-I`. Modüller açık yolla yüklenir; `__pycache__` yazılmaz.

## Etiketler ve fark sınıfı

| Etiket | Kaynak | Program kâhinden farklıysa |
|---|---|---|
| KULLANICI | CLAUDE.md kullanıcı kararı | **BULGU** |
| PLAN | BANKA-MODULU-PLAN / PRO-UZAKTAN (kullanıcıyla tek tek konuşulmuş) açık sözü | **BULGU** |
| CARİ | cari kâhininin kuralı (para anlamı; o kâhinin kendi etiketi geçer) | o kâhindeki sınıf; mobil ≠ masaüstü her durumda **BULGU** (eşdeğerlik KULLANICI kararı) |
| MEVCUT ÜRÜN | ana oturumun koddan doğruladığı kural (aynı el — ders 5) | İNCELE |
| ÇIKARIM / YAYGIN | metin susuyor; plandan çıkarım ya da yaygın uygulama (gerekçe aşağıda) | İNCELE |
| PARAMETRE | AÇIK SORU (S1–S8): seçilen birleşimde beklenen; seçim gelene dek öneri | İNCELE (karar gelince karar etiketi) |
| ÇATAL | metin iki sonucu da açık bırakıyor; program alternatiflerden birine eşit olmalı | yalnız hiçbir alternatife uymazsa |

## Kurallar (kaynağıyla)

| No | Kural | Kaynak / etiket |
|---|---|---|
| K1 | Mobil yazma mevcut API'den, para çekirdeği kurallarıyla: kabul edilen mobil istek = aynı masaüstü işi (cari bakiye, FIFO, Kapatılacak Fatura, çek/senet, taksit, Kasa/banka) | KULLANICI (26.10 MOBİL; devir §3.1) → cari kâhini |
| K2 | Sunucu kapalıyken telefonda yazma YOK; istek kuyruğa alınmaz, sunucu açılınca kendiliğinden yazılmaz | KULLANICI ("sunucu kapalıysa … sadece tahsilat giremeyecekti") |
| K3 | Kasa yalnız nakit; havale banka hesabına, POS POS hesabına, Kredi Kartı (ödeme) kurumsal karta; çek/senet portföye | KULLANICI kalıcı karar; PLAN §3.5, §3.11a |
| K4 | İstek kimliği kalıcı; anahtar kullanıcı \| kapsam \| kimlik; aynı kimlik + aynı içerik → "zaten kaydedildi" (yazmaz), farklı içerik → 409; yeniden başlatmadan sonra da hatırlanır; reddedilen isteğin kimliği hatırlanmaz | PLAN §3.10/1, Aşama 2; SENARYO-DILI §5.4 (ÇIKARIM) |
| K5 | "30 günden eskiler budanır": 30 gün içinde kesin hatırlanır; sonrası budama ANI yazılı olmadığı için ÇATAL (zaten kaydedildi / yeni kayıt) | PLAN §3.10/1 + ÇATAL |
| K6 | Benzer İşlem yalnız hesaba bağlı (havale / POS / kart, hesabı atanmış) satırda; anahtar yön, yol, hesap, cari, tutar, gün, hedef; kanal anahtara girmez (masaüstü + mobil aynı) | PLAN §3.10/2 |
| K7 | Hesap seçimi: verilen hesap uygun değil → 400 `bank-account-invalid`; birden çok uygun hesap + hesap yok → 400 `bank-account-required`; tek uygun → kendiliğinden; hiç yok → 102.00 / 108.00 | PLAN §3.5 |
| K8 | Kasa eksi (nakit ödeme): min(B(gün), B(tüm)) < 0 → Uyar 409 `cash-negative` ("Yine de Kaydet" geçer), Engelle 409 `cash-blocked` | PLAN §3.9; SENARYO-DILI §5.3 |
| K9 | Taksit kartı: kalanı aşan → 409 `plan-overpay`; Fazlasını Avans Yaz yalnız `plans.manage` (personel 403 `plan-overpay-permission`); **ödenmiş (kalan 0) karta yeni tahsilat: onaysız → 409 `plan-paid`; `plans.manage` yetkilisi "Fazlasını Avans Yaz" onaylarsa yazılır, tutarın tamamı cariye avans (cari alacak), Kasa / banka girişi normal; yetkisiz → ret** (kod: "KARAR K8-AVANS"); kartın **Ödenen'i avansı da içerir**; masaüstü ve mobil aynı; kalan BEGIN IMMEDIATE içinde okunur (eşzamanlıda biri reddedilir) | PLAN §3.10/3, §9.2/12; **KULLANICI KARAR K8-AVANS** (29.10.2026) |
| K10 | Rol yetkisi mobilde de aynı: tahsilat (nakit, havale, POS) ve taksit tahsilatı herkese; havale / kart ödemesi personelde 403; planın yazmadığı hücreler (muhasebe nakit ödeme, personel stok, muhasebe çek, muhasebe Fazlasını Avans) kâhin hesaplamaz → **göreli çift**: program iki kanalda AYNI sonucu vermeli (mobil yetki atlatma yolu değildir) | PLAN §2.5, §9; SENARYO-DILI §5.5 |
| K11 | Şirket yetkisi kullanıcı × şirket; yönetici hepsi; işaretsiz yalnız 001; değişiklik mobilde HEMEN uygulanır | MEVCUT ÜRÜN |
| K12 | Başka şirketin cari / hesap kimliği isteğin şirketinde çözülemez → hiçbir şirkete yazılmaz (403/404) | KULLANICI "Şirket = ayrı veri dosyası" + YAYGIN |
| K13 | Eşli olmayan / silinmiş cihaz yazamaz; aynı kullanıcının öbür cihazı ve yeni eşlenen cihaz yazar | KULLANICI (3 cihaz, "cihaz silinince yer açılır"); iş listesi M2 "cihaz silme → erişim kesilir" |
| K14 | Uzaktan Bağlanabilir izni kaldırılınca kullanıcının cihazları düşer; izin geri verilince eski cihaz yine yazamaz (yeniden eşleme gerekir) | PLAN (PRO-UZAKTAN "Yeniden eşleme gereken durumlar: … yönetici cihazı ya da izni kaldırır") |
| K15 | Lisans bitince mobil yazamaz; yenilenince eşleme geri gelir | PLAN (PRO-UZAKTAN "Lisans süresi biter …", "yenilenince eşlemeler geri gelecek") |
| K16 | Eksi stok: çıkış stoğu eksiye düşürüyorsa program sorar; "izin ver" → eksiye düşer | KULLANICI kalıcı karar 02.10.2026 |
| K17 | Tarih: ileri tarihli hareket 400; dönem kilidi ≤ kilit → 409 `period-locked`; gün TR (UTC+3) takvim günüdür | PLAN §2.5, §4.3; V1 |
| K18 | Ret önceliği: kapıcı (sunucu, kesinti, lisans, cihaz, izin) → şirket → 403 rol → 400 girdi (tutar, tarih, hesap, mobil alan kısıtı) → istek kimliği → 404/409 hedef (cari, fatura, kart, kilit, K8) → Benzer İşlem → eksi | SENARYO-DILI §5.6 (ÇIKARIM) + kapıcı önce (YAYGIN: istek programa ulaşmaz) |
| K19 | Eşzamanlı istekler sıralanabilir: program sonucu sıralamalardan birine eşit | PLAN §9.2/12; SENARYO-DILI §5.8 |

## Varsayımlar (V…; metnin açıkça söylemediği, kâhinin seçtiği okuma — program ayrışırsa İNCELE)

- **V1** Gün, Türkiye yerel saatine (sabit UTC+3) göre takvim günüdür (gece yarısı, ay sonu, yıl dönümü). UTC günü kullanmak hatadır (mutant 24).
- **V2** Tünel kesintisi iki türlüdür: **önce** (istek sunucuya ulaşmadı → kayıt yok) ve **sonra** (sunucu işledi, yanıt kayboldu → sunucunun sonucu ne ise o).
  İkisinde de telefon "sonucu belirsiz" görür; aynı kimlikle **yeniden gönderim** (aynı form) bir kez yazar.
- **V3** Mobil isteğin kullanıcısı cihazdan gelir (oturum cihaza bağlı); istek başka kullanıcı adına yazılmaz.
- **V4** Mobilin **veri alanı** kısıtı (S1 Kapatılacak Fatura, S2 çek/senet, S3 taksit kartı, S8 stok çıkışı) kapalıyken o alanı taşıyan istek (eski form /
  el yapımı) **reddedilir** (4xx) — sessizce FIFO'ya / başka yola çevrilmez (para verisi sessizce değişmez).
- **V5** Mobilin **onay bayrağı** kısıtı (S4, S5) "geçemez" iken telefon bayrağı göndermez: uyarı varsa yazılmaz, uyarı yoksa iş yürür.
- **V6** Onay bayrakları (Yine de Kaydet, Benzer İşlem onayı, eksi stok onayı) istek kimliğinin içerik karşılaştırmasına girmez (PLAN "similarOk VOLATILE").
  Fazlasını Avans Yaz bir seçimdir, içeriğe girer.
- **V7** İstek kimliği şirketin veri dosyasındadır (PLAN: `request_keys` şirket tablolarıyla birlikte; "Şirket = ayrı veri dosyası"): aynı kimlik iki şirkette iki kayıt.
- **V8** Yeniden gönderimde içerik aynıdır; "sunucu günü" kipinde gün yeniden gönderimin anıdır (ilk deneme gece yarısından önce, yeniden gönderim sonra ise yeni gün), "form
  tarihi" kipinde formun günü.
- **V9** Stok miktarı tamsayı (Adet); ondalık miktar bu dil sürümünde yok. Eksi stok denetimi son duruma (bütün hareketler) göredir; geçmiş tarihli stok
  hareketinin o güne göre eksisi denetlenmez.
- **V10** Kart ödemesinin fazlası (Fazlasını Avans Yaz) kartta `fazla` (avans); carinin bakiyesi tahsilatın tamamı kadar düşer (PLAN §3.10/3 "fazlası kartta extra,
  caride alacak"). Kartın `odenen`'i avansı DA içerir (KARAR K8-AVANS — eski "ödenen kart tutarında kalır" okumasının yerine); taksit başına `taksit<i>:odenen` taksit
  tutarını aşmaz (fazla hiçbir taksite yazılmaz — eski okuma, karar söylemiyor; program ayrışırsa İNCELE).
- **V11** POS hesabı komisyonsuz ve valörsüz kurulur (sürücü öyle kurar): `pos:<hesap>` = POS tahsilatlarının brüt toplamı.
- **V12** Yedekten geri yükleme şirket verisini istek kimlikleriyle **aynı anlık görüntüye** döndürür: yedekten sonra yazılmış (yanıtı kaybolmuş) istek geri
  yüklemeyle kaybolur ve aynı kimlikle yeniden gönderilince YENİDEN yazılır (E25). "Zaten kaydedildi" deyip kayıt olmaması para kaybıdır (mutant 32). YAYGIN.
- **V13** Silinmiş cari kimliği ada göre yeniden eşlenmez (aynı adla açılan yeni cariye yazılmaz, 404 — E38).
- **V14** Uzak izni kaldırma o kullanıcının bütün eşli cihazlarını düşürür (K14); 3 cihaz sınırı ve eşleme (karekod) M2 kâhininin konusudur: bu kâhin 4. cihazı kurmaz.

## AÇIK SORULAR (kullanıcı karar verecek; kâhin seçmedi — her biri parametre, iki seçenek de hesaplanır)

| # | Soru | Seçenekler | Öneri ve gerekçe |
|---|---|---|---|
| S1 `kapatilacak` | Mobil tahsilat / ödemede **Kapatılacak Fatura** seçilebilsin mi? | `secilir` (masaüstü gibi bağlı) · `yalniz_fifo` (mobilde fatura alanı yok, para en eskiden kapatır; alanlı istek reddedilir) | **`yalniz_fifo`**. Sahada tahsilatı yaygın mobil uygulamalar (saha satış / tahsilat) cariye işler, eşleştirme ofiste yapılır; küçük ekranda yanlış fatura seçimi riski kalkar; 24.10.2026 (b) kararıyla aynı ruh (FIFO + bilgi notu). Sonuç masaüstündeki bağsız tahsilatla aynı. |
| S2 `yollar` | Mobilde **çek / senet** tahsilatı olsun mu? | `nakit_havale_pos` · `evrak_dahil` | **`nakit_havale_pos`** (2.4.7'de). Çekin seri no / banka / vade / keşideci bilgisi uzun formdur; evrak fiziksel olarak ofise gelir ve portföye ofiste girer. Evrak ileride eklenirse kâhin hazır (E31). |
| S3 `taksit` | Mobilden **taksit kartına** tahsilat girilsin mi? | `kart_secilir` (K8 kuralları aynen) · `yalniz_cari` | **`kart_secilir`**. Yalnız cari tahsilatı girilirse taksitli müşterinin ödemesi kartı düşürmez, zil ve takvim "ödenmedi" der — sahada en sık iş taksit tahsilatıdır. K8 sunucu kuralı olduğu için mobil ayrı bir risk getirmez (E05, E18). |
| S4 `onay` | Mobil "Yine de Kaydet" (Kasa Uyar), Benzer İşlem onayı ve "Fazlasını Avans Yaz"ı geçebilsin mi? | `sorar` (masaüstündeki soru mobilde de) · `gecemez` (telefon bayrağı göndermez) | **`sorar`**. Aynı API, aynı soru, aynı yetki (eşdeğerlik); sahada aynı gün aynı tutarda iki gerçek tahsilat olağandır. Yetki kuralı (Fazlasını Avans yalnız `plans.manage`) mobilde de geçer. |
| S5 `eksi_stok` | Mobil stok çıkışında eksi stok sorusu | `sorar` (kalıcı karar gibi: "izin ver" → eksi) · `gecemez` | **`sorar`** — kalıcı ürün kararı (02.10.2026) "program sorar"; mobil ayrı kural gerektirmez. |
| S6 `tarih` | Mobil işlemin tarihi | `sunucu_gunu` (telefon tarih göndermez; sunucunun TR günü) · `form_tarihi` (masaüstü gibi formun tarihi; geriye tarih seçilebilir) | **`sunucu_gunu`**. Telefonun saati / saat dilimi güvenilmez (ileri saat 400, geri saat sessizce geriye tarih); gece yarısı belirlenimci; geriye tarihli giriş masaüstünde kalır. Bedeli: gece yarısını geçen yeniden gönderim yeni güne yazılır (E22) ve gece 23:59'da açılıp 00:00'da gönderilen form yeni yıla düşer (E23). |
| S7 `gec_yeniden` | Sonucu belirsiz isteği telefon ne kadar sonra yeniden gönderebilir? | `sunucu_karar` (her zaman; sunucu 30 gün hatırlar, sonrası ÇATAL) · `telefon_24s` (24 saatten eski belirsiz isteği telefon göndermez, "Cari'den kontrol edin" der) | **`telefon_24s`**. Yaygın ödeme API'lerinde (ör. Stripe) istek kimliği 24 saat geçerlidir; 30 gün sonra budanmış kimlikle ikinci kayıt riski kalkar; ertesi günün tarihine kayma sınırlanır. Bedeli: 24 saati geçen ulaşmamış istek kullanıcıca yeniden girilir. |
| S8 `stok_yonu` | Mobil stok hareketi yönü | `giris_cikis` · `yalniz_giris` | **`yalniz_giris`** — karar metni harfiyen "tahsilat / ödeme / **stok girişi**"; çıkış istenirse S5 geçerli (E19, E20). |

Kâhinin karar vermediği ama çatallanan nokta (soru değil, ÇATAL): **K5** — 30 günden eski kimlik budanmış mıdır (budama zamanı planda yok)? Kâhin iki dünyayı
da kabul eder (E24); S7 = `telefon_24s` seçilirse bu durum oluşmaz.

## KARAR K8-AVANS (ürün sahibi kararı; ders 40, 43 — kâhin–program farkından SONRA kullanıcıya soruldu, kullanıcı karar verdi)

**Kaynak:** `docs/2.4.7-IS-LISTESI.md` "KARAR — K8-AVANS (ders 43; kullanıcı, 29.10.2026: 'A ÖNERİN UYGUN')": "Ödenmiş (kalan 0) taksit kartına yeni tahsilat gelince
program BUGÜNKÜ GİBİ: `plans.manage` yetkilisine 'Fazlasını Avans Yaz' seçeneği; fazla cariye avans. Masaüstü ve mobil aynı. Kart tutarları (Ödenen avansı da içerir)
bugünkü gibi kalır." Kâhin bu karara göre KÂHİN TARAFINDA güncellendi (kodu görmeyen ajan; programın davranışına bakılmadı, yalnız karar metni).

**Değişen okuma:** önceki kâhin (a) ödenmiş karta her yeni tahsilatı — Fazlasını Avans Yaz onaylı olsa da — 409 `plan-paid` ile reddediyordu (PLAN §3.10/3 "Kalan 0 ise
409 plan-paid" harfiyen), (b) kartın `odenen`'ini kart toplamıyla sınırlıyordu (avansı içermez). İkisi de bu kararla değişti:

| Durum (ödenmiş, kalan 0 kart) | Beklenen | Etiket |
|---|---|---|
| Fazlasını Avans Yaz yok (onay vermeyen; telefon "geçemez" kipinde bayrağı göndermeyen) | 409 `plan-paid`, kayıt yok | KULLANICI (K8-AVANS) + PLAN §3.10/3 |
| Fazlasını Avans Yaz + `plans.manage` (yönetici) | yazılır; tutarın tamamı avans: cari bakiye tutar kadar düşer (alacak), Kasa (nakit) / banka (havale) / POS normal, kart `fazla` artar | KULLANICI (K8-AVANS) |
| Fazlasını Avans Yaz + yetkisiz (personel) | ret, kayıt yok; kod **403 `plan-overpay-permission` ya da 409 `plan-paid`** (liste — ikisi de kabul) | KULLANICI (ret) + kod KARARDA YOK |
| Fazlasını Avans Yaz + muhasebe | planda yazılı değil (B) — kâhin hesaplamaz (G4 göreli çiftiyle aynı sınıf) | PLAN susuyor |
| Kart değerleri (avanslı her kart — ödenmiş karttaki avans da, kalanı aşan tahsilatın fazlası da) | `odenen` = bütün kart tahsilatları (avans DAHİL); `fazla` = avans; `kalan` **0 ya da toplam − Ödenen (eksi)** (liste) | KULLANICI (Ödenen) + Kalan KARARDA YOK |

**Kararın kapsamadığı (kâhin SEÇMEDİ, ikisini de kabul eder; kullanıcıya raporlanır):** (1) avanslı kartın **Kalan**'ı — karar yalnız "Ödenen avansı da içerir" der;
Kalan 0'da mı durur (kalan eksiye inmez) yoksa toplam − Ödenen (eksi) mi gösterilir yazılı değil; para etkisi yok (cari bakiye, Kasa, banka, avans aynı). (2) Yetkisiz
kullanıcının (Fazlasını Avans Yaz bayrağıyla) ödenmiş karta tahsilatının **ret kodu** — karar "ret" der, kodu söylemez; kayıt açılmadığı sürece iki kod da kabul.
(3) Taksit başına dağılım (`taksit<i>:odenen`) — eski okuma sürer (taksit tutarını aşmaz); karar söylemiyor, program ayrışırsa İNCELE.

**Senaryolar:** E05 (beklenen değişti: Ödenen 1.200 → 1.300, Kalan 0 → [0, −100]); **E41** (yeni eşdeğerlik çifti, beklenenler karar metninden elle); R1–R3 akış
modeli (`Akis`) aynı kurala getirildi (üretici DEĞİŞMEDİ, adımlar aynı; öneri birleşiminde R1 3, R2 5, R3 3 istek ödenmiş karta avans olarak yazılır — 2'si
kesintiden sonra "belirsiz / sunucu ok", 2 yeniden gönderim "zaten kaydedildi", 1 yeniden gönderim yazar; R1'de 1 yetkisiz deneme reddedilir). **Mutasyonlar** 49–53.

## Senaryo dili `destekofis-mobil-yazma/1`

```json
{"dil": "destekofis-mobil-yazma/1", "ad": "E22-gece-yarisi-yeniden", "aciklama": "…",
 "baslangic": {"simdi": "2026-10-31T23:59:58+03:00", "sirketler": {"001": {"kasaEksi": "uyar"}, "002": {}},
               "kullanicilar": {"P": {"rol": "personel", "uzak": true, "sirketler": []}}, "cihazlar": {"DY": "Y", "DP": "P"},
               "lisans": "gecerli", "kaynakSurum": null},
 "adimlar": [ … ]}
```

`Y` her zaman yöneticidir ve uzak izinlidir. Tutar metin `"1234,56"` (PLAN §9.2/9; virgül, en çok 2 ondalık, binlik ayırıcı yok); tarih `yyyy-aa-gg`;
saat ISO (ofsetsiz → TR). Her adımın `id`'si tekil; takma adlar (`cari`, `fatura`, `kart`, `hesap`, `urun`) senaryoda tekil.

| Adım | Alanlar | Anlamı |
|---|---|---|
| `tahsilat` | `sirket, kanal: mobil\|masaustu, cihaz` (mobil) / `kullanici` (masaüstü), `cari, tutar, yol: nakit\|havale\|pos\|cek\|senet, hesap?, fatura?, kart?, fazlaAvans?, tarih?, formAcilis?, istekKimligi, yineDeKaydet?, benzerOnay?, kesinti?: once\|sonra, ayniAnda?` | Cariden tahsilat (kart = taksit kartı tahsilatı; fatura = Kapatılacak Fatura) |
| `odeme` | aynı; `yol: nakit\|havale\|kart` | Cariye ödeme (kart = Kredi Kartı, kurumsal kart hesabı) |
| `stok` | `sirket, kanal, …, urun, yon: giris\|cikis, miktar, eksiOnay?, istekKimligi, kesinti?` | Parasız stok hareketi |
| `yeniden_gonder` | `adim, kesinti?` | Aynı isteğin (aynı kimlik, içerik, cihaz) yeniden gönderimi |
| `cari_ac`, `fatura`, `iade` (satış faturasının tamamı, geri ödemesiz), `kart_ac`, `hesap_ac`, `urun_ac`, `kasa_acilis`, `cari_sil`, `donem_kilitle`, `ayar`, `yedek_al`, `yedek_geri_yukle`, `sirket_ac` | masaüstü kurulumu (yönetici) | `kart_ac` = Carinin Mevcut Borcunu Taksitlendir (eşit taksit, ayda bir) |
| `saat`, `sunucu: kapali\|acik\|yeniden`, `cihaz_esle`, `cihaz_sil`, `uzak_izin`, `sirket_yetki`, `lisans: gecerli\|bitti`, `surum_yukselt` | ortam | `kaynakSurum` verilmişse `surum_yukselt`'e kadarki adımlar o sürümün GERÇEK koduyla, masaüstünden girilir |
| `kontrol` | — | ara / son durum |

## Çıktı (iki taraf için ortak)

Adım: `adim:<id>:durum` = `ok` · `yineleme` (zaten kaydedildi) · `ret` · `belirsiz` (telefon sonucu görmedi) · `ulasilamadi` (sunucu kapalı) · `atildi`
(telefon göndermedi, S7); `adim:<id>:http` (ret; sayı, `"4xx"` = 400–499, liste = biri), `adim:<id>:kod` (planın adını verdiği kodlar; liste = biri), `adim:<id>:sunucu`
(belirsizde sunucunun gerçek sonucu: `yok` / `ok` / `yineleme` / `ret`).

Kontrol `<k>:<şirket>:…`: `cari:<ad>:bakiye` (kuruş; + = cari borçlu), `cari:<ad>:hareketSayisi` (tahsilat/ödeme kaydı; çek/senet ve kart tahsilatı hariç),
`fatura:<ad>:acik` (satış ve alış), `acilis:<cari>:kalan`, `kart:<ad>:{odenen (avans dahil — K8-AVANS), fazla (avans), kalan (avanslı kartta liste = biri), tahsilatSayisi, taksit<i>:odenen}`, `kasa`, `kasaGun:<gün>` (sıfır
olmayan günler), `banka|pos|kartHesap:<hesap>` (işaretli defter bakiyesi: kurumsal kart ödemesi eksi), `hesapsiz:102.00|108.00`, `portfoy`, `evrakSayisi`,
`stok:<ürün>:{miktar, hareketSayisi}`. Taksit kartlı caride fatura / açılış kalanı yazılmaz (cari kâhini: tanımsız).

Eşzamanlı (`ayniAnda`) adımlar ve K5 çatalı için `alternatifler`: değişen anahtarların tutarlı atamaları; programın değerleri alternatiflerden BİRİNE tamamen uymalı.

## Programa eşleme (sürücü yazarken; uç adı değil davranış)

- **Kanal:** masaüstü adımı masaüstü oturumunun yazma yolundan, mobil adımı **telefonun kullandığı yoldan** (kapıcı + tünel + mobil API; M1 notu: uzakta yalnız
  `/mobil/` ve `/api/mobil/` geçer) gönderilir. Mobil adımın kullanıcısı cihazın eşlendiği kullanıcıdır. S4, S5, S7 telefon davranışıdır → mobil e2e (telefon
  boyutu, sahte saat) ya da telefonun gönderdiği isteğin aynısı.
- **`kesinti: once`:** istek gönderilmez (telefon zaman aşımı gösterir). **`kesinti: sonra`:** istek gönderilir, yanıt sürücüce okunmaz (gizli sonuç
  `adim:<id>:sunucu` olarak ayrıca kaydedilir). **`yeniden_gonder`:** aynı kimlik ve aynı gövde, aynı cihazın oturumuyla.
- **`sunucu: kapali`:** ofis programı durdurulur (ya da tünel kapatılır); telefonun yazma denemesi "ulaşılamadı" görmeli. `acik`: yeniden başlatılır;
  kontrol sayıları kapalıyken yapılan denemeyi İÇERMEMELİ. `yeniden`: program kapatılıp aynı veriyle açılır.
- **`lisans: bitti`:** sahte lisans sunucusunda (HUKUK_LICENSE_URL yerel — ders 30) lisans bitmiş döner; kapıcı yazmayı reddetmeli.
- **Kontrol:** cari bakiyesi carinin bakiyesinden; fatura açığı faturanın açık tutarından; kart değerleri taksit kartından; Kasa Kasa'dan; banka / POS / kurumsal
  kart bakiyesi hesabın bakiyesinden; hareket sayısı carinin hareket listesinden; stok ürünün miktarı ve hareket listesinden. Okunamayan alan "okunamadı"
  yazılır (ders 4); eksik anahtar FARKTIR.
- **Saat:** `config.now` / sahte saat adımın anına (TR); ders 13 ve 22: uzun koşu gün sınırını geçerse sürücü sahte saatle çalışır.
- **Eski sürüm (E27):** `surum_yukselt`'e kadar v2.4.6 etiketinin GERÇEK koduyla girilir, sonra 2.4.7 aynı veriyle açılır (test kuralı).
- **Göreli çiftler:** iki yan ayrı boş şirkette koşulur; bütün anahtarlar (adım yanıtları dahil) iki kanalda aynı olmalı.
- **Kabul edilmeyen eşleme:** programın ürettiği alan değerinden (ör. kendi "Mutabakat tamam") beklenen türetilmez (ders 5).

## Senaryolar (kabul.json)

Elle (beklenenler elle; 256 birleşimde model = elle):
- Eşdeğerlik çiftleri (`-mobil` / `-masaustu`): **E41** ödenmiş karta Fazlasını Avans Yaz (KARAR K8-AVANS: yönetici avans — nakit / havale, onaysız ve
  personel ret) · **E01** nakit FIFO + avans + avansın yeni faturayı kapatması · **E02** havale / POS / hesap seçimi (400 kodları) ·
  **E03** Kapatılacak Fatura, başka carinin / ters yön faturası (S1) · **E04** tedarikçiye nakit / havale / Kredi Kartı + Kapatılacak · **E05** taksit kartı K8, Fazlasını
  Avans (S3, S4) · **E19** stok + eksi stok sorusu (S5, S8) · **E30** Kasa Uyar / Engelle (S4) · **E31** çek / senet (S2) · **E40** müşteriye ödeme = iade geri
  ödemesi (KS8.1; bağlı ödeme K-d) — mobilin açtığı para yolunun cari çekirdekteki komşusu (ders 10).
- Mobil özgü: **E06** kesinti önce · **E07** kesinti sonra + yeni form · **E08** aynı kimlik farklı gövde · **E09** reddedilen kimlik + tutar biçimi · **E10** sunucu
  kapalı, kuyruk yok · **E11** yeniden başlatma sonrası kimlik · **E12** silinen cihaz · **E13** uzak izni · **E14** lisans · **E15** şirket yetkisi + değişikliği ·
  **E16** başka şirketin cari / hesap kimliği · **E17** aynı anda aynı cari (mobil + masaüstü; iki cihaz Benzer İşlem yarışı) · **E18** K8 yarışı · **E20** stok yarışı ·
  **E21** gece yarısı, UTC tuzağı, form tarihi, ileri tarih (S6) · **E22** gece yarısını geçen yeniden gönderim · **E23** yıl dönümü + dönem kilidi · **E24** kimlik
  ömrü 29 / 45 gün, 24 saat (K5 çatalı, S7) · **E25** yedekten geri yükleme + yeniden gönderim (V12) · **E26** aynı adlı üç cari, iki şirket · **E27** 2.4.6 verisi
  üzerine mobil · **E28** rol yetkisi (personel) · **E29** Benzer İşlem (mobil + masaüstü) · **E32a/b** aynı gün yazım sırası (ders 31) · **E34** aynı kimlik iki
  şirkette · **E35** aynı kimlik iki kullanıcıda · **E36** cihaz yarıda silindi · **E37** belirsiz istek + sunucu kapandı · **E38** silinip aynı adla açılan cari ·
  **E39** çift dokunuş: aynı istek aynı anda iki kez (tek kayıt).
- Göreli çiftler (B hücreleri; program iki kanalda aynı): G1 muhasebe nakit ödeme · G2 personel stok girişi · G3 muhasebe çek · G4 muhasebe Fazlasını Avans Yaz.

Rastgele (tohum 1–3, ~2.550 adım her biri; 2 şirket, 4 kullanıcı, cihaz değişimi, sunucu / lisans kesintisi, kesinti + yeniden gönderim (bir kısmı 24 saati aşar),
aynı kimlik / farklı gövde, Benzer İşlem, Kasa eksi (001 Uyar, 002 Engelle), K8, stok, ay sonu ve gece yarısına yığılmış saatler, yıl dönümü, eşzamanlı
çiftler): üreticinin BAĞIMSIZ akış modeli (`Akis`, kendi FIFO'su — kahin.py'yi ve cari kâhinini kullanmaz) = model, 10 birleşimde. Ek: tohum 4, 5.000 olay
(dosyaya yazılmaz).

## Nasıl bozulur? (önce yazıldı) → senaryo

| Bozulma | Senaryo / denetim |
|---|---|
| Tünel kopar: istek yarıda; aynı istek kimliği iki kez (ardışık ya da aynı anda); yeniden gönderim ikinci kayıt | E06, E07, E11, E22, E36, E37, E39, rastgele; D5; mutant 1, 35, 48 |
| Aynı kimlik farklı içerik; reddedilen kimlik hatırlanır; anahtarda kullanıcı / şirket yok | E08, E09, E34, E35; mutant 2–6 |
| İki cihaz aynı anda; masaüstü + mobil aynı cari; K8 / Benzer İşlem / stok yarışı | E17, E18, E20, E32a/b; mutant 31, 40 |
| Sunucu kapalıyken yazma kuyruğa alınıp sonra yazılır | E10, E37; D3; mutant 7 |
| Silinmiş / izni kaldırılmış cihaz, lisans bitti, yanlış kullanıcı | E12, E13, E14, E36; mutant 8–10, 41 |
| Yetkisiz kullanıcı (rol), yetkisiz şirket, yetki değişikliği gecikir | E15, E28, G1–G4; mutant 11, 20, 28, 42 |
| Başka şirketin cari / hesap kimliği; şirket yok sayılır | E16, E34; D4; mutant 12, 39 |
| Mobilde para anlamı sapar (FIFO yerine en yeni, Kapatılacak yok sayılır, ödeme yönü ters, iade geri ödemesi, POS / havale / çek Kasa'ya) | E01–E05, E31, E40; D2; mutant 13–17, 36–38 |
| Eksi stok / Kasa / Benzer İşlem / K8 mobilde atlanır ya da 'geçemez' delinir | E05, E19, E29, E30; mutant 18–23, 40 |
| Ödenmiş karta avans (KARAR K8-AVANS): onaylı avans reddedilir, yetkisiz avans yazar, avans cariye / Kasa'ya yazılmaz, Ödenen avansı dışlar; mobil ≠ masaüstü | E05, E41, R1–R3; mutant 49–53 |
| Gece yarısı / ay sonu / yıl dönümü; UTC günü; form tarihi; ileri tarih; dönem kilidi | E21–E23; mutant 24–27, 45 |
| Eski sürüm verisi (2.4.6) | E27 |
| Yedekten geri yükleme ve istek kimliği | E25; mutant 32 |
| Kimlik ömrü / geç yeniden gönderim | E24; mutant 33, 34 |
| Sil + aynı adla aç; aynı adlı iki kişi | E38, E26 |
| Rastgele sıra, binlerce olay, 2 şirket (ders 17) | R1–R3, C4; D1, D3–D7 |

## Mutasyonlar (53; `kahin_test.py` F, `kahin.py --mutasyonlar`)

Her mutasyon modelden BAĞIMSIZ beklentilerce (elle beklenen, gerekirse üreticinin akış beklentisi) yakalanmalıdır; yakalanmayan = eksik senaryo. Liste
`kahin.py --mutasyonlar`: istek kimliği (1–6, 33, 34, 35, 48), sunucu / cihaz / izin / lisans / şirket (7–12, 39, 41, 42), para yolu (13–17, 36–38, 43), K8 (18–20,
31, 44, 47, K8-AVANS 49–53), stok (21, 22, 29, 30, 46), Kasa / Benzer İşlem (23, 40), tarih (24–27, 45), rol (28), yedek (32).

## DENENEN

- 51 elle uç senaryoda elle yazılmış beklenen = model, 256 birleşimin HEPSİNDE; 10 eşdeğerlik çiftinde masaüstü (her birleşim) = mobil (masaüstü eşdeğeri birleşim).
- 3 rastgele senaryoda (≈7.700 adım) ve 5.000 olaylık ek koşuda üreticinin bağımsız akış beklentisi = model (10 / 2 birleşim). İki ayrı FIFO (cari kâhini ↔ `Akis`).
- Değişmezler: belirlenimcilik; reddedilen / ulaşılamayan / atılan adım silinince sayılar aynı (ders 3); şirket yalıtımı; istek kimliği başına ≤ 1 kayıt; aynı
  tarihli sıranın sonuca etkisizliği (ders 31); Kasa = Σ gün; kayıt sayısı azalmaz; göreli çiftlerin biçimi.
- 18 hatalı girdi reddedilir, geçerli temel kabul edilir; komut satırı `hesapla` / `karsilastir` (eksik senaryo FARK — ders 4).
- 53/53 mutasyon modelden bağımsız beklentilerce (elle; gerekirse akış) yakalandı. KARAR K8-AVANS mutasyonları 49–53 elle senaryolarca (E41, E05) yakalanır;
  ayrıca 49, 51, 52, 53 R1–R3'ün üçünde, 50 R1'de akış beklentisinden de ayrışır (iki ayrı beklenti). Cari kâhininin 47 elle senaryosu içe aktarılan modelle koşar ve o kâhinin
  kendi mutasyon taraması (model tek başına, KARARLAR C10b kipleri) 141/141 yakalar (H2); cari kâhini klasörü değişmedi (A2 + H).
- Mevcut cari kâhininin program karşılaştırması (`npm run test:kahin-cari`) bu dalda: 7.408/7.408 denetim, 0 fark, 7 bilinen sınır, 0 yakalanmayan mutasyon
  (`kanit/2026-10-29/kahin-cari-mevcut`).
- Kanıt (`tools/kanit.mjs kos`): KARAR K8-AVANS işlendikten sonra `kanit/2026-10-29/kahin-mobil-yazma-k8-avans.{json,log}` 143/143, çıkış 0 (kayıt
  OKU-BENI'de); karardan önceki teslim `kanit/2026-10-29/kahin-mobil-yazma-teslim.{json,log}` 136/136, çıkış 0; bilerek kırmızı (ayrı kopyada POS → Kasa)
  `kanit/kirmizi/2026-10-29/` 128/136, çıkış 1 — kırmızılar beklenen nedenle (Kasa / POS farkı; A1, E02 çifti, E28, rastgeleler). İlk kanıt koşusundaki tek
  kırmızı testin kendi hatasıydı (H2 kip listesi; kök neden `kanit/2026-10-29/OKU-BENI.md`).
- Dersler: 3/4 (D3, G2), 5 (temiz oda, akış modeli ayrı), 7 (mutasyon + `kanit/…/kirmizi`), 10 (eşdeğerlik çiftleri: değişen ortak yolun komşuları), 13/22 (sahte saat,
  gece yarısı, ay sonu, yıl dönümü; sistem saati okunmaz), 17 (rastgele sıra, eski sürüm verisi senaryosu), 31 (D6, E32), 40/43 (S1–S8 parametre; K8-AVANS yalnız ürün sahibinin kararıyla
  netleşti — programın davranışına bakılmadı; kararın susduğu Kalan ve yetkisiz ret kodu seçilmedi, ikisi de kabul).

## DENENMEYEN

- Program tarafı (sürücü yok; ana oturumun işi): bütün karşılaştırma M5 kodu yazılınca. Gerçek telefon / tünel / kapıcı (M3–M4) üzerinden uçtan uca.
- 3 cihaz sınırı, karekod eşleme, oturum süresi (M2 kâhini `test/bagimsiz/mobil-erisim`).
- Mobil cariye bağlı stok hareketi (stok satışı / alış) — S8 ve kapsam; iade, elle borç / alacak, evrak sonraki işlemleri (karşılıksız, ciro) mobilde.
- Ondalık stok miktarı; döviz; e-Belge'li fatura.
- Yetkisi planda yazılı olmayan rol × işlem hücrelerinin MUTLAK sonucu (yalnız göreli: mobil = masaüstü).

## BİLİNEN SINIRLAR

- Model, elle beklentiler, üretici ve akış modeli bu kâhinin elinden çıktı: bağımsızlık PROGRAMA göredir, kendi içinde değil. Para anlamı başka bir temiz oda
  kâhininden (cari) gelir; akış modeli FIFO'yu ayrıca yapar — iki FIFO ancak aynı karar metnini paylaşır (ders 5).
- MEVCUT ÜRÜN kuralı (şirket yetkisi) ana oturumun koddan okumasıdır → kâhin sayılmaz; fark İNCELE.
- Olayların programın gerçek durumlarına eşlenmesi (özellikle "kesinti sonra"nın gizli sonucu, sunucu kapalı / tünel kapalı ayrımı, telefon davranışları S4/S5/S7)
  sürücünün işidir; eşleme yanlışsa kâhin ile program aynı yanlış girdiyle ayrışmadan geçebilir.
- HTTP kodlarında planın adını vermediği yerler `"4xx"` ya da liste (ör. şirket yetkisizliği, cihaz / lisans reddi, eksi stok sorusu); kodun kendisi denetlenmez.
- Türkiye saat dilimi sabit UTC+3.
- KARAR K8-AVANS'ın susduğu iki değer liste (ikisi de kabul): avanslı kartın `kalan`'ı (0 ya da toplam − Ödenen) ve yetkisiz Fazlasını Avans Yaz'ın ret kodu
  (403 `plan-overpay-permission` ya da 409 `plan-paid`). Bu iki değerde iki seçenek arasındaki sapma yakalanmaz (para etkisi yok); kullanıcı seçerse tek değere iner.
