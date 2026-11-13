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
- **Bakım 29.10.2026** (aşağıda "BAKIM 29.10.2026"): `docs/GECMIS-KARARLAR.md` 2.1.0 yargıç düzeltmesi (modül uçlarında ondalık yuvarlama);
  `docs/mobil/M5-TASARIM.md` yalnız KARAR metinleri (§2 S1–S8, §3 BAŞ MİMAR KARARLARI 3 "YUVARLANMAZ"; içindeki program dosya / satır anlatımları
  kâhini bağlamaz); ürün sahibine gösterilmiş **BAŞ MİMAR KARARI (29.10.2026)** gövdedeki / yoldaki cari kimliği; `docs/BANKA-MODULU-PLAN.md` §3.5, §7;
  `test/bagimsiz/SENARYO-DILI.md` §5.2, §5.6 [BELİRSİZ-17], §6.1, §6.2.

**Okunmayanlar:** `server/`, `client/`, `packaging/`, `tools/` (yalnız `tools/kanit.mjs` ÇALIŞTIRILDI, kodu okunmadı), `test/` altındaki program
testleri ve program sürücüleri (`test/bagimsiz/surucu.mjs`, `test/bagimsiz/cari/kos.mjs`, `test/bagimsiz/edm-sayac/program-surucu.mjs`,
`fark-analiz.mjs`, bu klasörün `program-surucu.mjs`'i ve programın çıktı dosyaları `program.json*`), git geçmişi / farkları, `docs/kanit/**`. Bakımda
yalnız `npm run test:kahin-mobil-yazma`'nın KARŞILAŞTIRMA çıktısı (TAP, fark satırları) okundu — programın değerlerinden beklenen türetilmedi (ders 5, 40).

**Karar vermedim** (ders 40, 43): metnin sustuğu her para / kapama / tekilleştirme kuralı bir **parametre** oldu (aşağıda S1–S8). Kâhin her
birleşimin (2⁸ = 256) beklenenini hesaplar; kullanıcı seçene dek program **önerilen** birleşimle karşılaştırılır ve fark **İNCELE** sayılır.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `kahin.py` | Model (yalnız standart kütüphane; cari kâhinini içe aktarır) + komut satırı (`hesapla`, `karsilastir`, `--mutasyonlar`) |
| `senaryolar.py` | 55 elle uç senaryo (beklenenler ELLE; 24'ü 12 masaüstü/mobil eşdeğerlik çifti — E42 S129 bakımında, E43 bakım 2'de) + 4 göreli çift + tohum 1–3 rastgele üretici ve onun BAĞIMSIZ akış modeli (`Akis`); `kabul.json`'u yazar |
| `kabul.json` | 58 senaryo (55 elle, 3 rastgele), 8.218 adım; elle senaryolarda ilgili parametrelerin her birleşimi, rastgelelerde 10 birleşim (öneri tam, öbürleri fark olarak); göreli çiftler |
| `kahin_test.py` | Kâhinin kendi testi (A–E, G, H, I, J, K) + 63 mutasyon (F); TAP + `# tests/pass/fail` |
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
| K7 | Hesap seçimi: verilen hesap uygun değil → 400 `bank-account-invalid`; birden çok uygun hesap + hesap yok → 400 `bank-account-required`; tek uygun → kendiliğinden; hiç yok → 102.00 / 108.00 (havale yolunda POS kimliği: BİLİNEN KÂHİN FARKI — "BAKIM 29.10.2026" (4)) | PLAN §3.5 |
| K8 | Kasa eksi (nakit ödeme): min(B(gün), B(tüm)) < 0 → Uyar 409 `cash-negative` ("Yine de Kaydet" geçer), Engelle 409 `cash-blocked` | PLAN §3.9; SENARYO-DILI §5.3 |
| K9 | Taksit kartı: kalanı aşan → 409 `plan-overpay`; Fazlasını Avans Yaz yalnız `plans.manage` (personel 403 `plan-overpay-permission`); **ödenmiş (kalan 0) karta yeni tahsilat: onaysız → 409 `plan-paid`; `plans.manage` yetkilisi "Fazlasını Avans Yaz" onaylarsa yazılır, tutarın tamamı cariye avans (cari alacak), Kasa / banka girişi normal; yetkisiz → ret** (kod: "KARAR K8-AVANS"); kartın **Ödenen'i avansı da içerir**; masaüstü ve mobil aynı; kalan BEGIN IMMEDIATE içinde okunur (eşzamanlıda biri reddedilir) | PLAN §3.10/3, §9.2/12; **KULLANICI KARAR K8-AVANS** (29.10.2026) |
| K10 | Rol yetkisi mobilde de aynı: tahsilat (nakit, havale, POS) ve taksit tahsilatı herkese; havale / kart ödemesi personelde 403; planın yazmadığı hücreler (muhasebe nakit ödeme, personel stok, muhasebe çek, muhasebe Fazlasını Avans) kâhin hesaplamaz → **göreli çift**: program iki kanalda AYNI sonucu vermeli (mobil yetki atlatma yolu değildir) | PLAN §2.5, §9; SENARYO-DILI §5.5 |
| K11 | Şirket yetkisi kullanıcı × şirket; yönetici hepsi; işaretsiz yalnız 001; değişiklik mobilde HEMEN uygulanır | MEVCUT ÜRÜN |
| K12 | Başka şirketin (ya da bulunamayan) cari / hesap kimliği isteğin şirketinde çözülemez → hiçbir şirkete yazılmaz. Cari kimliği **yolda** (cari tahsilatı / ödemesi `accounts/:id/entries`, taksit kartı `plans/:id/entries`; mobil de "mevcut API üzerinden") → **404**; **gövdede** (yeni evrak girişi: çek / senet tahsilatının carisi form alanı) → **400**; banka hesabı kimliği [400, 404] (değişmedi) | KULLANICI "Şirket = ayrı veri dosyası" + YAYGIN; **BAŞ MİMAR KARARI 29.10.2026** (gövde 400 / yol 404); yer: PLAN §7 "Genişleyen mevcut uçlar" (evrak girişinin yeri ÇIKARIM) |
| K13 | Eşli olmayan / silinmiş cihaz yazamaz; aynı kullanıcının öbür cihazı ve yeni eşlenen cihaz yazar | KULLANICI (3 cihaz, "cihaz silinince yer açılır"); iş listesi M2 "cihaz silme → erişim kesilir" |
| K14 | Uzaktan Bağlanabilir izni kaldırılınca kullanıcının cihazları düşer; izin geri verilince eski cihaz yine yazamaz (yeniden eşleme gerekir) | PLAN (PRO-UZAKTAN "Yeniden eşleme gereken durumlar: … yönetici cihazı ya da izni kaldırır") |
| K15 | Lisans bitince mobil yazamaz; yenilenince eşleme geri gelir | PLAN (PRO-UZAKTAN "Lisans süresi biter …", "yenilenince eşlemeler geri gelecek") |
| K16 | Eksi stok: çıkış stoğu eksiye düşürüyorsa program sorar; "izin ver" → eksiye düşer | KULLANICI kalıcı karar 02.10.2026 |
| K17 | Tarih: ileri tarihli hareket 400; dönem kilidi ≤ kilit → 409 `period-locked`; gün TR (UTC+3) takvim günüdür | PLAN §2.5, §4.3; V1 |
| K18 | Ret: kapıcı (sunucu, kesinti, lisans, cihaz, izin) → şirket erişimi önce ve erken döner ("4xx"). Programa ulaşan denetimlerin (403 rol → 400 girdi: tutar, tarih, hesap, mobil alan kısıtı → istek kimliği → 404/409 hedef: cari, fatura, kart, kilit, K8 → Benzer İşlem → eksi) **hepsi** değerlendirilir: **tek ihlalde** o ihlalin durum kodu ve kodu; **birden çok ihlalde yalnız durum sınıfı `"4xx"`** (kod yazılmaz); her iki durumda kayıt yok. Aynı gövdeli yineleme ("zaten kaydedildi") yalnız istek kimliğinden önceki denetimlerde ihlal yokken | SENARYO-DILI §5.6 (sıra ÇIKARIM; "Senaryo bir adımda tek ihlal kurar; kurarsa karşılaştırıcı o adımda yalnız durum sınıfını (4xx) karşılaştırır" [BELİRSİZ-17]) + kapıcı önce (YAYGIN: istek programa ulaşmaz) |
| K19 | Eşzamanlı istekler sıralanabilir: program sonucu sıralamalardan birine eşit | PLAN §9.2/12; SENARYO-DILI §5.8 |
| K20 | Tutar: **mobil** en çok 2 ondalık, 2'den çok ondalık 400 (yuvarlanmaz); **masaüstü modül ucu** (cari tahsilat / ödeme, taksit kartı, evrak girişi) 2'den çok ondalığı yarım yukarı (sıfırdan uzağa) kuruşa yuvarlar: "1,005" → 1,01, "12,345" → 12,35; biçim (virgül, binlik ayırıcısız, işaretsiz) ve aralık (0 < tutar ≤ 1e12 TL) iki kanalda aynı; yuvarlanınca 0 olan tutar 400 (ÇIKARIM) | Mobil: PLAN §9.2/9 + M5 BAŞ MİMAR KARARI 3 ("YUVARLANMAZ"); masaüstü: **`docs/GECMIS-KARARLAR.md` 2.1.0 yargıç düzeltmesi** ("modül uçları … 1,005 → 1,01 yuvarlar") + SENARYO-DILI §6.2, §6.1 |

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

## BAKIM 29.10.2026 — R1–R3 farkları ve E02 (ders 5, 40, 43)

Kâhin–program karşılaştırmasında (49/54) kalan farklar için kâhinin beklentisi YALNIZ önceden yazılmış karar metinlerinden ve ürün sahibine gösterilmiş baş
mimar kararından güncellendi; programın kodu ve çıktı dosyaları okunmadı, programın değerlerinden beklenen türetilmedi. **Para / kapama sırasını belirleyen
hiçbir kural değişmedi** (FIFO, Kapatılacak Fatura, K8, K8-AVANS, Kasa / banka yolları, eksi bakiye aynen; ders 43).

| # | Fark (kâhin ← program) | Kaynak (karar metni) | Kâhinde değişen | Sonuç |
|---|---|---|---|---|
| 1 | Masaüstü cari / taksit tutarında 3 ondalık: kâhin 400, program yazıyor (R1 t1048, R2 t1405, R3 t1425 "12,345") | `docs/GECMIS-KARARLAR.md` 2.1.0 yargıç düzeltmesi: "§5.1'in '2'den çok ondalık 400' kuralı yalnız BANKA uçları içindir; modül uçları (cari, fatura, taksit…) plana göre 'bugünkü gibi' 1,005 → 1,01 yuvarlar (kullanıcıya düzeltildi)"; SENARYO-DILI §6.2 "Modül uçları …: 3 ondalık rh ile kuruşa yuvarlanır" (rh §6.1 yarım birim sıfırdan uzağa) | `kahin.py` `kurus_modul()` (yeni) + `istek()` adım 7: masaüstü `kurus_modul`, mobil `kurus` (değişmedi — M5 BAŞ MİMAR 3 "YUVARLANMAZ"); akış modeli `senaryolar.py` `_modul_kurus()` (ayrı yazıldı: `Decimal` ROUND_HALF_UP); K20 | "12,345" → 12,35 yazılır (cari, fatura açığı, Kasa / POS 1.235 kuruş) |
| 2 | Gövdedeki (evrak girişi) başka şirket carisi: kâhin [403, 404], program 400 (R1 t539, R2 t79 / t159 / t2303) | **BAŞ MİMAR KARARI (29.10.2026; ürün sahibine gösterildi):** "isteğin GÖVDESİNDE (form alanında) gelen bulunamayan ya da başka şirketin cari kimliği 400 (doğrulama hatası) alır; YOLDA gelen kaynak kimliği 404. Plan §9.2/11 'başka şirketin hesap kimliği 404' banka hesabı içindir." Kimliğin yeri: PLAN §7 "Genişleyen mevcut uçlar" (`accounts/:id/entries`, `plans/:id/entries`, `cheques/:id/actions`); yeni evrak girişinde evrak henüz yok → cari form alanı (ÇIKARIM) | `kahin.py` `_cari_govdede()` (yeni) + `istek()` adım 9: çek / senet → 400, öbürleri → 404 (eski [403, 404] karar "YOLDA … 404" ile 404'e indi — E16 t1 / t2 / t4 ve R1–R3'teki yoldaki cariler); akış modeli aynı kural; K12 | Kayıt açılmaz, para değişmez (aynen) |
| 3 | İki ihlalli adımda ret sırası: kâhin ilk ihlalin tam kodu (400 `bank-account-required`), program 404 (R2 t191, t554: başka şirket carisi + seçilmemiş banka hesabı) | SENARYO-DILI §5.6: sıra "[ÇIKARIM §3.3 sırası]"; "Senaryo bir adımda tek ihlal kurar; kurarsa karşılaştırıcı o adımda yalnız durum sınıfını (4xx) karşılaştırır [BELİRSİZ-17]" | `kahin.py` `istek()`: ihlaller TOPLANIR (`ihlal` listesi); tek ihlal → o kod, birden çok → `"4xx"` + kod yok — GENEL kural (adım kimliğine özel değil); akış modeli aynı; K18 | Kayıt yok (aynen); kod karşılaştırılmaz |
| 4 | E02 t4: havale yoluna POS kimliği — kâhin 400 `bank-account-invalid`, program 404 `bank-account-missing` | Plan metni bu durumu **açıkça belirlemiyor**: §3.5 hesap türleri tablosunda POS yok (POS ayrı varlık, §7 `/bank/pos`, alan `posId` ≠ `bankAccountId`) — bu programın "hesap bulunamadı" okumasını destekler; ama plan ne durum kodunu ne kodu söyler (`bank-account-missing` §7 "Yeni hata kodları" listesinde YOK; §9.2/11 yalnız "başka şirketin hesap kimliği 404"). Kâhinin 400 `bank-account-invalid`'i SENARYO-DILI §5.2/4 ÇIKARIM'ıdır ("havalede kart hesabı" → 400) | **DEĞİŞMEDİ** (görev: "plan açıkça belirliyorsa değiştir; belirlemiyorsa dokunma") | **BİLİNEN KÂHİN FARKI** (aşağıda); kayıt yok, para etkisi yok; iki kanal aynı (eşdeğerlik bozulmuyor) |

**Değişmeyenler:** mobil tutar kuralı (400, yuvarlanmaz — E09); banka hesabı kimliği [400, 404]; kapıcı / şirket erişimi "4xx"; K8 / K8-AVANS, FIFO, Kapatılacak Fatura,
Kasa / banka / POS yolları; senaryoların ADIMLARI (kabul.json'da yalnız beklenenler ve E16'nın açıklaması değişti; üretici aynı adımları üretir).

**BİLİNEN KÂHİN FARKI — E02 t4 (`E02-es-havale-pos-mobil`, `E02-es-havale-pos-masaustu`):** program 404 `bank-account-missing`, kâhin 400 `bank-account-invalid`.
Neden kâhin değiştirilmedi: karar metni (plan §3.5, §7, §9.2/11) POS kimliğinin havale yolunda verilmesinin sonucunu ADIYLA söylemiyor; kâhinin değeri çıkarım
(SENARYO-DILI §5.2/4), programınki de bir okuma — programın değeri görülerek kâhini ona çekmek ders 40'ın yasakladığı "programa uydurma" olurdu. Para / kayıt
etkisi yok (iki tarafta da ret, kayıt yok, iki kanal aynı). Karar ürün sahibinde / baş mimarda: (a) programın okuması ("POS banka hesabı değil → hesap
bulunamadı, 404") karar olarak yazılırsa kâhin 404 `bank-account-missing`'e, (b) "türü uymayan hesap → 400 `bank-account-invalid`" yazılırsa program düzeltilir;
o zamana dek `ci.yml` `--haric` listesinde E02 çifti adıyla kalır.

## 2.5.0 bakımı — S129 (taksit kartının göstergeleri tek kuyruktan) (13.11.2026; kodu görmeyen AYRI el; ders 5, 40, 43)

**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / öz test sayıları kod ve kanıt commit'lerinde eklenir.**

**Girdi (AYNEN; ana oturumun özet dosyası `scratchpad/kahin-mobil-s129-kararlar.md` — "programın hesap / görünüm davranışı hakkında bilgi içermez"):**
- S129 KARAR (kullanıcı, 12.11.2026): "S129 = A — taksit kartının penceresindeki 'Tahsil Edilen' / 'Kalan' göstergeleri, Taksitler listesindeki aynı sütunlar ve taksit satırının
  'Ödenen'i de TEK KUYRUKTAN gösterilir (ekranda tek sayı: örnekte kart 900, bağsız tahsilat 500 → Tahsil Edilen 500 · Kalan 400; kart 600, bağsız tahsilat 800 → Kalan 0 ·
  Tamamlandı); tahsilat formunun sınırı / sorusu / önerilen tutarı S118 = B'deki gibi kartın KENDİ kalanından kalır."
- İLGİLİ ÖNCEKİ KARAR (kullanıcı 11.11.2026 06:14 UTC) — S118 = B: "taksit tahsilatında sınır / soru / önerilen tutar kartın KENDİ kalanından (kural değişmedi)."
- NOT (ana oturum): tek kuyruk = cari kâhininin bu alanlar için verdiği değer (kararın kâhindeki karşılığı orada bakım 14 ile işlendi — `test/bagimsiz/cari/KARARLAR.md` §25 Y14-10);
  kendi başına yeni kuyruk kuralı yazılmaz; mobil gösterim için ayrı kural YOK ("ekranda tek sayı"); cari kâhini bakım 13 / 14 ile değişti — kabul yeniden üretilir, elle beklentiler
  tek tek yeniden denetlenir.
- Birlikte okunan (kâhinin kendi belgesi): yukarıdaki K9, V10, "KARAR K8-AVANS" (kullanıcı 29.10.2026: "Kart tutarları (Ödenen avansı da içerir) bugünkü gibi kalır"), S3;
  cari kâhininin `KARARLAR.md` §25 (Y14-10, P1 / P2 / P3) ve `model.py` (`kart_odenen`, `tyk250`, `kart_ac`, `kontrol`'ün kart bölümü — yalnız içe aktarılır, DEĞİŞTİRİLMEZ).

### Kâhinin BUGÜNKÜ okuması (bakım 29.10.2026 sonrası, değişiklikten önce — açıkça)
- `kart:<k>:odenen` = kartın KENDİ tahsilatlarının (kart seçilerek girilen, `kart_tahsilat`) toplamı, avans DAHİL (K8-AVANS); `kart:<k>:kalan` = toplam − bu (avanslı kartta liste
  [0, toplam − Ödenen]); `kart:<k>:taksit<i>:odenen` = kendi tahsilatlarının (en çok kart toplamı) en eski taksitten dağılımı (V10). Kaynak `kahin.py` `kontrol()` — kartın kendi
  tablosu (`K["odemeler"]`); cari kâhininin kart değeri OKUNMUYOR (cari kâhini yalnız bakiye / fatura açığı / açılış kalanı için, kural seti `2.4.6`). Akış modeli (`Akis`) aynı okuma.
- Karta BAĞLANMADAN alınan tahsilat (taksit kartlı cariye taksit dışı tahsilat — rastgele üretici bunu kurar; S3 = `yalniz_cari` kipinde telefonun tek yolu) yalnız cari bakiyesini
  düşürür, kartın göstergelerine dokunmaz. Yani bugünkü okuma S129'un **B**'sidir (kartın kendi hesabı).
- Tahsilat sınırı / sorusu (K9: 409 `plan-overpay`, 409 `plan-paid`, Fazlasını Avans Yaz yetkisi) kartın KENDİ kalanından (kendi tahsilatları) — S118 = B ile aynı.

### Yorumlar (ders 40 — karardan; kod yazılmadan ÖNCE)
- **YS129-1 — üç alan tek kuyruktan:** `kart:<k>:odenen` ("Tahsil Edilen" / liste sütunu), `kart:<k>:kalan` ("Kalan") ve `kart:<k>:taksit<i>:odenen` (taksit satırının "Ödenen"i) =
  cari kâhininin VARSAYILAN kural setinin (`2.5.0` — tek yükümlülük kuyruğu, KARARLAR C13.4 (5) / (7), §25 Y14-10) AYNI çevrilmiş adımlar için verdiği kart ödeneni (`kart_odenen`:
  kart tahsilatı + kart seçilmeden alınan tahsilatın kuyruk payı — S50); Kalan = toplam − bu. Kâhin kendi kuyruğunu YAZMAZ: aynı çevrilmiş adımlar cari kâhinine bir kez daha
  `2.5.0` kipinde verilir, yalnız bu üç alan oradan okunur. Kararın iki örneği elle senaryo olur (kart 900 = 3 × 300 + bağsız 500 → Tahsil Edilen 500 · Kalan 400, taksitler
  300 / 200 / 0, bakiye 400; kart 600 = 2 × 300 + bağsız 800 → Tahsil Edilen 600 · Kalan 0, taksitler 300 / 300, bakiye −200 — cari kâhininin P1 / P2'si ile aynı sayılar).
- **YS129-2 — DEĞİŞMEYEN (S118 = B; kararın kendi sözü):** K9'un bütün ret denetimleri (`plan-overpay`, `plan-paid`, Fazlasını Avans Yaz ve yetkisi) kartın KENDİ kalanından
  (kendi tahsilatları) okunmaya DEVAM eder; bağsız tahsilat kartın sınırını düşürmez (örnek: kart 900 + bağsız 500 → kart seçilerek 900'e kadar tahsilat kabul, 900'ü aşan
  `plan-overpay`). `kart:<k>:fazla` (Fazlasını Avans Yaz ile yazılan avans) ve `kart:<k>:tahsilatSayisi` kartın kendi tahsilatlarından (göstergeler kararın saydıkları değil).
  Bakiye, fatura açığı, açılış kalanı, Kasa / banka / POS / portföy AYNEN (`2.4.6` kipi; bu bakım dokunmaz).
- **YS129-3 — mobil = masaüstü (NOT (4)):** karar "ekranda tek sayı" der; mobil gösterim için ayrı kural yok. Kâhin üç alanı kanaldan bağımsız aynı kaynaktan yazar (eşdeğerlik
  D2 değişmez). Mobilin `taksit = yalniz_cari` kipinde telefonun bağsız tahsilatı artık kartın göstergelerini de düşürür (S3'ün gerekçesindeki "kartı düşürmez" okuması bu
  kararla eskidi — S3 sorusunun kendisi ve seçimi değişmez).
- **YS129-4 — iki kararın ayrıştığı alt durum: KARAR K8-AVANS × S129 (kâhin SEÇMEZ — ders 43):** kartın KENDİ tahsilatları kart toplamını aştığında (Fazlasını Avans Yaz ile — E05 t3,
  E41, R1–R3'teki avanslar) K8-AVANS "Ödenen avansı da içerir" der; tek kuyruğun (cari kâhininin) kart ödeneni kart toplamını aşmaz (fazlası carinin alacağıdır — bakiye iki okumada
  aynı). S129'un sözü bu durumu ayrıca söylemiyor. İki okuma: **(a)** S129'un harfi — Tahsil Edilen = tek kuyruk ödeneni (≤ toplam); **(b)** K8-AVANS sürer — Tahsil Edilen = tek kuyruk
  ödeneni + kartın kendi avansı (`fazla`). Kâhin `kart:<k>:odenen`'de iki değeri LİSTE yazar (ikisi de kabul — mobil kâhinin K8-AVANS'taki "Kalan" düzeni); `kalan` listesi [0, toplam −
  (b)] (a'nın Kalan'ı 0 zaten içinde — değer değişmez); taksit ödenenleri iki okumada aynı (taksit tutarını aşmaz — V10). Bakiye, Kasa, banka, `fazla` iki okumada aynı → KULLANICIYA
  SORULMALI (aşağıda). Mutant 51 (K8-AVANS: "Ödenen avansı dışlar") artık okuma (a)'yı SEÇEN kâhindir (liste yerine tek değer) — elle liste onu yakalar; okuma (b)'yi seçen
  mutant 62 de. (Yorum commit'inde "51 yakalanamaz" yazıyordu; ilk öz test koşusu 51'i E05'te yakaladı — tek değer ≠ liste; düzeltildi, kural aynı.)
- **YS129-5 — cari kâhininin sustuğu yer:** cari kâhini `2.5.0` kipinde o carinin kuyruğunu tanımsız sayarsa (C13.4 (11) nedeni) ya da kartın kabulünü iki dünyalı bulursa (SK-18),
  kâhin o kartın üç gösterge alanını YAZMAZ (SUS; öbür alanlar yazılır). `2.5.0` kipi kartı reddederse (G2 (b)) bu katmanın ön denetimi eksiktir → senaryo hatası (sessizce
  geçilmez — `cari_sonuclari`'nın bugünkü düzeni).
- **YS129-6 — akış modeli (`Akis`, kâhinden ve cari kâhininden bağımsız):** üreticinin kurduğu taksit kartlı cari yalnız "açılış = kart tutarı + Carinin Mevcut Borcunu Taksitlendir
  kartı" ve tahsilatlardan oluşur (fatura / ödeme / elle kayıt yok); bu alt kümede tek kuyruğun TEK borç kalemi kartın taksitleridir → kararın örneklerindeki hesap: Tahsil Edilen =
  min(toplam, carinin bütün tahsilatları), en eski taksitten. Bu, kararın örneğinin aynı alt kümeye uygulanmasıdır (genel kuyruk kuralı DEĞİL; ÇIKARIM — fark çıkarsa iki elden
  biri yanlış: incelenir). YS129-4'ün iki okuması akışta da liste.
- **YS129-7 — etiket:** değişen üç alan KULLANICI (S129 A); S118 = B alanları kendi etiketiyle; YS129-4 listesi KULLANICI (K8-AVANS) + KARARDA YOK.

### KULLANICIYA SORULMALI (S129 bakımı; kâhin bu alt durumda SEÇMEZ — ders 43, SORU DÜZENİ; bakiye her seçenekte aynı)
- **SM-1 (K8-AVANS × S129 — Fazlasını Avans Yaz ile ödenmiş karttaki "Tahsil Edilen"; UÇ DURUM DEĞİL — her avanslı kart):** K: açılış 1.200, kart 1.200 / 3; kart tahsilatı 500, sonra
  800 Fazlasını Avans Yaz (yönetici) → avans 100, bakiye −100. **A (S129'un harfi — tek kuyruk):** Tahsil Edilen 1.200 · Kalan 0 (avans yalnız carinin alacağında görünür) / **B
  (K8-AVANS sürer):** Tahsil Edilen 1.300 · Kalan 0 ya da −100 / **C:** uç durum böyle kalsın (BİLİNEN SINIR — kâhin iki değeri de kabul eder). Taksit satırları (400 / 400 / 400),
  bakiye, Kasa iki seçenekte de aynı.

### Kurallar (kod commit'i; yorumların karşılığı)
- `kahin.py` `TYK_KURAL = "2.5.0"`, `tyk_kartlari()` (YS129-1 / YS129-5): `cari_sonuclari` kartlı cari varken aynı çevrilmiş adımları cari kâhinine bir kez daha `2.5.0` kipinde
  verir; kart başına `kart_odenen` payları, tanımsız (C13.4 (11)) / SK-18 kartta `None`; `2.5.0` kipinin reddi → `SenaryoHatasi`. `kontrol()`: üç gösterge bu paylardan; YS129-4
  listesi; `fazla` / `tahsilatSayisi` kendi tahsilatlarından. `istek()` K9 kalanı AYNEN kendi tahsilatlarından (YS129-2; yorum satırı eklendi).
- `senaryolar.py`: `KB` kartın Ödenen'inde liste kabul eder; E05 / E41 beklentileri (SM-1 listesi); yeni E42 çifti; `Akis._kontrol` YS129-6 hesabı (alt küme dışına çıkarsa
  `RuntimeError` — sessizce yanlış beklenti üretilmez).
- Mutantlar: **60** S129 B (göstergeler kartın kendi tahsilatlarından — eski okuma), **61** S118 = B'nin tersi (sınır tek kuyruğun kalanından), **62** SM-1'in okuma (b)'si
  SEÇİLİR; **51** (K8-AVANS: Ödenen avansı dışlar) bu bakımdan beri SM-1'in okuma (a)'sını SEÇER. SM-1 yanıtlanınca liste tek değere iner; seçilmeyen okumanın mutantı kalır.
- `kahin_test.py` J1: 60 ve 61 E42'nin iki kanalında DEĞERLE (iki taraf da tek sayı — liste / biçim farkı sayılmaz), 60 ayrıca R1'de akış beklentisince.
- `kahin_test.py` H2: cari kâhininin mutasyon taraması `/3` dosyalarında o kâhinin KENDİ düzeniyle (KARARLAR.md "Eşleme notları (Ç5-A / Ç5-B kod ajanı için)": "dört kip (2.5.0 +
  2.4.9 + 2.4.6 + 2.4.5)"); bakımdan önce iki kipliydi (varsayılan + 2.4.5) ve cari kâhini `2.5.0`'a geçince 2.4.6 / 2.4.9'a özgü 10 mutantı göremiyordu (H2 bakımdan ÖNCE kırmızı:
  "YAKALANMAYAN cari mutantları: 129, 130, 131, 133, 135, 136, 137, 138, 141, 143"); sonra 252/252.

### Senaryolar (elle — kâhin koşulmadan karar metninden)
- **E42-es-s129-gosterge** (yeni eşdeğerlik çifti, mobil / masaüstü): K açılış 900 + kart 900 / 3, L açılış 600 + kart 600 / 2; karta bağlanmadan K 500, L 800 → k1: KT Ödenen 500 ·
  Kalan 400 · taksitler 300 / 200 / 0, LT 600 · 0 · 300 / 300; bakiye K 400, L −200, Kasa 1.300 (kararın iki örneği AYNEN). S118 = B: KT'ye kart seçilerek 900 → ok (kendi kalanı 900;
  tek kuyruğun kalanı 400), KT'ye 1 → 409 `plan-paid`, LT'ye 700 → 409 `plan-overpay` (kendi kalanı 600), LT'ye 600 → ok (tek kuyruğun kalanı 0) → k2: KT 900 · 0 · 300 / 300 / 300,
  LT 600 · 0, K −500, L −800, Kasa 2.800, iki kartta `fazla` 0, `tahsilatSayisi` 1. `taksit = yalniz_cari`: mobil kart adımları 4xx, k2 = k1. Mobil = masaüstü (D2).
- **E05 / E41** (elle beklenti DEĞİŞTİ — SM-1): k2 `KT1:odenen` 1.300 → [1.200, 1.300]; E41 k1 `KT:odenen` 1.500 → [1.000, 1.500]. Kalan, taksitler, fazla, bakiye, Kasa AYNEN.
- Öbür 47 elle senaryonun elle tablosu DEĞİŞMEDİ ve yeni cari kâhiniyle (bakım 14) 256 birleşimin hepsinde model = elle (kartlı caride bağsız tahsilat yalnız E42'de; cari kâhini
  bakım 13 / 14 değişiklikleri — S130 şüpheli alacak, S133, S134 — bu kâhinin olay kümesine girmiyor: şüpheli / elle borç / stok satışı / dönem kilidiyle netleşme adımı yok).

### Değişen beklentiler (eski `kabul.json` ↔ yeni; döküm `docs/kanit/2026-11-13/kahinmobil-s129/kabul-fark-dokum.json`, araç `arac/kabul-fark.py`, sınıflama `arac/dokum-sinifla.py`)
| Senaryo | Alan | Eski → yeni | Karar | Sayı |
|---|---|---|---|---|
| E05 çifti (k2) | `kart:KT1:odenen` | 130000 → [120000, 130000] | SM-1 (K8-AVANS × S129 — liste) | 2 |
| E41 çifti (k1) | `kart:KT:odenen` | 150000 → [100000, 150000] | SM-1 | 2 |
| E42 çifti | senaryo YENİ | — | S129 A + S118 B | 2 senaryo |
| R1 / R2 / R3 | `kart:<k>:odenen` (skaler, arttı) | ör. R1 k1729 KT1_2 25800 → 120000 | S129 A (bağsız tahsilatın kuyruk payı) | 102 / 81 / 98 |
| R1 / R2 / R3 | `kart:<k>:kalan` (skaler, azaldı) | ör. R1 k1729 KT1_1 10904 → 0 | S129 A | 102 / 81 / 98 |
| R1 / R2 / R3 | `kart:<k>:taksit<i>:odenen` (arttı) | ör. R1 k1729 KT1_2 taksit2 1800 → 24000 | S129 A | 243 / 165 / 175 |
| R1 / R2 / R3 | `kart:<k>:odenen` (avanslı — eski değer listenin (b)'si) | ör. R1 k1729 KT1_2 180543 → [120000, 180543] | SM-1 | 48 / 59 / 52 |
Toplam 1.308 anahtar (444 Ödenen, 281 Kalan, 583 taksit Ödenen) + 2 yeni senaryo; **kararla AÇIKLANAMAYAN 0** (azalan Ödenen / artan Kalan yok; bakiye, fatura açığı, açılış kalanı, Kasa,
banka / POS, portföy, stok, adım yanıtları, `fazla`, `tahsilatSayisi` hiçbir senaryoda DEĞİŞMEDİ). Adımı değişen senaryo yok (E05 / E41'de yalnız `aciklama` metni). Rastgelelerin
beklentisi akış modeli (`Akis`, YS129-6 — cari kâhinini kullanmaz) = model, 3 tohum × 10 birleşim.

### Kanıt (S129 bakımı; `docs/kanit/2026-11-13/kahinmobil-s129/`, `tools/kanit.mjs kos`)
- Bakımdan ÖNCE (taban `44c9025d`, ayrı kopya): öz test 149/152, çıkış 1 — A1 (kabul eski), A2 ("cari kâhini değişti"), H2 (10 cari mutantı iki kipte görünmüyor) (`taban-oz-once-utc.txt`).
- İlk koşu (kod commit'inden önce, `cea78f3` + değişmiş dosyalar): 155/156 iki saat diliminde — tek kırmızı F M51 (README YS129-4'teki "yakalanamaz" yorumu yanlıştı; düzeltildi) (`kahinmobil-oz-*`).
- **Kod commit'i `03a7b6b`, temiz ağaç: öz test 158/158, çıkış 0 — TZ=UTC ve TZ=Europe/Istanbul** (`kahinmobil-s129-oz-utc|ist.{json,log}`): A1 kabul güncel, A2 cari kâhini sha
  eşleşiyor, 53 elle × 256 birleşim model = elle, R1–R3 × 10 birleşim model = akış, C4 5.000 olay, D1–D8, **62/62 mutasyon**, J1, H, H2 cari kâhini 252/252.
- ESKİ kâhin (değişiklikten önceki `kahin.py`, ayrı kopya) yeni / değişen elle beklentilerde KIRMIZI, beklenen nedenle (`eski-kirmizi.txt`): E42 iki kanalda 3 birleşimde 8 fark
  (eski: KT Ödenen 0 · Kalan 900, LT 0 · 600 — kartın kendi hesabı = S129 B), E05 / E41 iki kanalda 1 fark (eski tek değer 1.300 / 1.500, elle liste — SM-1).
- Üretici: `uretici-denetle.txt` / `uretici-yaz.txt` (elle 53 × 256, rastgele 3 tohum × 10 birleşim model = akış). Program açılmadı.

## 2.5.0 bakımı 2 — S154 / S151 / S158 / S165 (13.11.2026; kodu görmeyen AYRI el; ders 5, 40, 43)

**Bu bölümün ilk commit'i yalnız YORUMDUR (ders 40 — önce kural, sonra kod); senaryo / mutant / öz test sayıları kod ve kanıt commit'lerinde eklenir.**

**Girdi (tek kaynak; ana oturumun özet dosyası `scratchpad/kahin-mobil2-kararlar.md` — soru metinlerindeki "program bugün" sözü ve örnek sayılar kural kaynağı DEĞİL; KURAL
KAYNAĞI yalnız KARAR satırları):**
- S154 KARAR (kullanıcı 13.11.2026 07:31 UTC, AYNEN "b"): "S154 = B — 'Fazlasını Avans Yaz' ile kapanan kartta 'Tahsil Edilen' karttan alınan paranın TAMAMIDIR (örnekte kart 1.200 / 3,
  karttan 500 + 800 avanslı → 'Tahsil Edilen 1.300 · Kalan 0', fazla 100 ayrıca; bakiye −100)."
- S151 KARAR (13.11.2026 06:12 UTC, "önerilerini uygula"): "S151 = B — taksit kartının 'Tahsil Edilen'i (ve taksit satırının 'Ödenen'i) FATURASIZ stok iadesini SAYMAZ: iade tahsilat
  değildir; örnekte 'Tahsil Edilen 0', 'Kalan' yine 700, bakiye 1.200; iade ayrı gösterilir (iade faturasıyla yapılan iadede kart küçülür, Tahsil Edilen 0 — aynen)." (örnek: Borç 500 +
  stoktan satış kartı 1.000 (2 × 500) + faturasız stok iadesi 300)
- S158 KARAR (13.11.2026 08:35 UTC, "önerilerini uygula"): "S158 = A — 'iade tahsilat değildir' HER kartta geçerlidir: satış kartı olmayan kartta da faturasız stok iadesi ve Değersiz yazma
  kartın 'Tahsil Edilen'ine / taksit satırının 'Ödenen'ine SAYILMAZ (örnek: Borç 900 → kart 900 → iade 300: 'Tahsil Edilen 0', 'Kalan 600')."
- S118 = B (11.11.2026 06:14 UTC; S129 bakımında verildi): sınır / soru / önerilen tutar kartın KENDİ kalanından. S165 KARAR (13.11.2026 17:48 UTC, "önerilerin uygun"): "S165 = A — karttan
  tahsilatta 'Kalanı Aşan Tutar' sınırı YALNIZ karttan alınan parayı sayar; faturasız iade (ve Değersiz yazma gibi para dışı pay) sınırı küçültmez (örnek: Borç 900 + Borç 500 → kart 900 →
  faturasız iade 300 → karta 700 sormadan KABUL, bakiye 400; ardından aynı karta 600 RET — kalan 200)." **BAŞ MİMAR OKUMASI** (kullanıcıya gösterildi): "S118 = B gereği carinin avansıyla
  ödenmiş kısım da sınırı küçültmez (S118'in kendi örneği: kart 1.000, karttan 300, başka yerden 100 avans → sınır 700)." 'Fazlasını Avans Yaz': tutar sınırı aşıyorsa kayıt ancak 'Kalanı
  Aşan Tutar' sorusuna 'Fazlasını Avans Yaz' yanıtıyla yazılır; yanıt yoksa HİÇBİR kayıt yazılmaz (ret).
- Cari kâhini bakım 15–18 ile değişti (`test/bagimsiz/cari/KARARLAR.md` §26–§29): bu alanlarda cari kâhininin değeri kullanılır, sustuğu yerde bu kâhin de SUSAR; kendi kuyruk / gösterge kuralı
  YAZILMAZ.

### Kâhinin BUGÜNKÜ okuması (S129 bakımı sonrası, değişiklikten önce — açıkça)
- **'Tahsil Edilen' iki değer kabul ediyor:** kartın KENDİ tahsilatları kart toplamını aştığında (Fazlasını Avans Yaz — ödenmiş karta avans ya da kalanı aşan tahsilatın fazlası) `kart:<k>:odenen`
  liste [tek kuyruk ödeneni, + kendi avansı] (YS129-4 / SM-1): E05 k2 KT1 [1.200, 1.300], E41 k1 KT [1.000, 1.500], R1–R3'ün avanslı kartları; `kart:<k>:kalan` aynı kartlarda liste [0, toplam −
  (b)] (K8-AVANS "Kalan kararda yok"). Taksit 'Ödenen'i tek değer (taksit tutarını aşmaz).
- **İade:** bu dilde taksit kartlı caride iade / Değersiz adımı YOK — `iade` yalnız satış faturasının tamamı, `kart_ac` faturalı cariye açılmaz, faturasız stok iadesi ve Değersiz Alacak Yaz dilde
  yok. S151 / S158'in alanı bugün hiçbir senaryoda oluşmuyor. Kâhin üç göstergeyi cari kâhininin `kart_odenen` taksit paylarından (tek kuyrukta kapanan kısım — para dışı kapatıcı DAHİL)
  hesaplıyor: alan oluşsaydı iadeyi SAYARDI (S151 / S158'in seçilmeyen okuması).
- **Sınır:** K9'un kalanı = kart toplamı − kartın KENDİ tahsilatları (YS129-2) — kalanı aşan tutar Fazlasını Avans Yaz'sız 409 `plan-overpay`, ödenmiş kartta 409 `plan-paid` (kayıt yok). Bu dilde
  para dışı pay ve avansla ödenmiş kart (S101) oluşmadığı için S165 / BAŞ MİMAR OKUMASI ile ayrışan değer yok. 'Fazlasını Avans Yaz' yanıtının adım alanı dilde VAR (`fazlaAvans`).
- **Çeviri açığı:** kâhinin cari kâhinine verdiği `kart_tahsilat` adımı `fazlasiniAvansYaz` taşımıyor. Cari kâhini bakım 17'den (§28 Y17-2) beri `2.5.0` kipinde kartın kendi kalanını aşan
  seçeneksiz kart tahsilatını REDDEDİYOR → `tyk_kartlari` avanslı her senaryoda (E05, E41, R1–R3) "2.5.0 kipi adımı reddetti" diye durur; A2 ayrıca "cari kâhini değişti" der.

### Yorumlar (ders 40 — kararlardan; kod yazılmadan ÖNCE)
- **YM2-1 — çeviri (eşleme; kural değil):** kâhinin kabul ettiği bir kart tahsilatı 'Fazlasını Avans Yaz' ile yazıldıysa (adımda `fazlaAvans: true`, ya da yazılan tutar kartın o anki KENDİ
  kalanını aşıyorsa — olağan akışta ikincisi yalnız birincisiyle olur) cari kâhinine `kart_tahsilat {…, fazlasiniAvansYaz: true}` olarak verilir (cari kâhininin dil eki §28). Kalanı aşmayan
  tahsilatta seçenek etkisiz (cari §29 Y18-1 (a)). `2.4.6` kipi (bakiye / fatura açığı) alanı okumaz — değer değişmez.
- **YM2-2 — göstergeler cari kâhininin kontrolünden AYNEN:** `kart:<k>:odenen` ('Tahsil Edilen'), `kart:<k>:kalan` ('Kalan'), `kart:<k>:taksit<i>:odenen` (taksit 'Ödenen'i) = cari kâhininin
  `2.5.0` kipindeki KONTROL çıktısının aynı anahtarları (aynı çevrilmiş adımlar; bu katman artık `kart_odenen`'den kendi toplamını kurmaz). Böylece S154 B (Y2-3), S151 B / S158 A (para dışı pay
  sayılmaz — cari §26 Y15-7 / §27 Y16-8) ve cari kâhininin susmaları (S144 = C, S143 = C, S162 = B, S163 = C, S166 = B; C13.4 (11) tanımsız cari; SK-18) bu kâhine OLDUĞU GİBİ geçer: cari kâhini
  bir anahtarı yazmıyorsa bu kâhin de YAZMAZ; neden metni cari kâhininin `belirsiz` kaydından (kâhinin `sus` notu — karşılaştırılan çıktıya girmez). `kart:<k>:fazla` ve `kart:<k>:tahsilatSayisi`
  kartın kendi tahsilatlarından AYNEN (YS129-2). YS129-4 listesi KALKAR.
- **YM2-3 — S154 = B (tek değer; SM-1 kapanır):** Fazlasını Avans Yaz ile kapanan kartta 'Tahsil Edilen' = karttan alınan paranın tamamı, 'Kalan' 0 (kararın "Tahsil Edilen 1.300 · Kalan 0").
  E05 k2 KT1: [1.200, 1.300] → **1.300**, Kalan [0, −100] → **0**. E41 k1 KT (ödenmiş karta K8-AVANS avansı 200 + 300): [1.000, 1.500] → **1.500**, Kalan [0, −500] → **0** — K8-AVANS'ın
  "Ödenen avansı da içerir"i ile aynı yön; kartın 'Fazlasını Avans Yaz' ile kapandığı sayılır (kart kalanı 0 iken avans adımı kartın kendi kalanını AŞAN adımdır — cari §28 Y17-3 tanımı).
  R1–R3'ün avanslı kartları: liste → okuma (b) tek değer, Kalan → 0. Taksit 'Ödenen'leri, bakiye, Kasa, `fazla` DEĞİŞMEZ.
- **YM2-4 — S151 / S158 (alan açılır):** yeni MASAÜSTÜ kurulum adımı **`stok_iade {id, cari, tutar, tarih?, sirket?}`** = faturasız stok Satış İadesi (cari kâhininin `stok_iade` olayı — KS7 (a) bağsız
  kapatıcı; parasız: Kasa / banka değişmez; `cari:<ad>:hareketSayisi`'na girmez — tahsilat / ödeme kaydı değil). Mobil yolu YOK (iade ofiste girilir) → kararların örnekleri "masaüstü adımı +
  okuma (kontrol) + mobil kart tahsilatı" biçiminde. S158'in örneği AYNEN (açılış 900 → kart 900 / 3 → iade 300 ⇒ 'Tahsil Edilen 0', 'Kalan 600'; bu yapı cari kâhininin S162 = B alanı:
  kart carinin bütün borcunu taşıyor → taksit 'Ödenen'leri cari kâhininde SUS → bu kâhinde de SUS). S151'in sayıları bu dilin kartıyla (satış kartı — stoktan taksitli satış — dilde YOK):
  açılış 1.000 → Mevcut Borç kartı 1.000 / 2 → sonra fatura 500 (vadesi taksitlerden sonra) → iade 300 ⇒ 'Tahsil Edilen 0', 'Kalan 700', taksit 'Ödenen' 0 / 0, bakiye 1.200 (S158 "her kartta").
  Değersiz Alacak Yaz dilde YOK (şüpheli alacak) — DENENMEYEN.
- **YM2-5 — sınır (S165 = A + S118 = B + BAŞ MİMAR OKUMASI):** K = kart tutarı − karttan alınan para (kartın kendi tahsilatları) — bugünkü K9 AYNEN; `stok_iade` ve kart seçilmeden alınan
  tahsilatın tek kuyruk payı K'yı KÜÇÜLTMEZ (K9 yalnız kendi tahsilatlarını sayar). Avansla ödenmiş kart (S101) bu dilde oluşmaz. Kalanı aşan tutar: 'Fazlasını Avans Yaz' ile (yönetici) kabul
  — aşan kısım avans; yanıtsız → 409 `plan-overpay`, kayıt yok (kod K9'dan aynen; kararlar kodu söylemiyor). S165'in örneği (dil uyarlaması: "Borç 500" = kart açıldıktan SONRA kesilen ve
  vadesi taksitlerden SONRA olan fatura): karta 700 sormadan KABUL, bakiye 400; aynı karta 600 → `plan-overpay` (kalan 200); 600 'Fazlasını Avans Yaz' → KABUL, 'Tahsil Edilen' 1.300 (S154 B —
  iadenin payı para değil; cari §29 Y18-3 (1)), bakiye −200. Yeni adım alanı GEREKMEDİ.
- **YM2-6 — akış modeli (`Akis`, bağımsız):** üreticinin alt kümesinde (açılış = kart, yalnız tahsilat) kendi tahsilatları kart toplamını aşan kart Fazlasını Avans Yaz ile kapanmıştır (K9 başka
  yolla aşmaya izin vermez) → 'Tahsil Edilen' = kendi tahsilatlarının tamamı, 'Kalan' 0 (S154 B'nin alt kümeye uygulanışı); öbür kartlar YS129-6 aynen. Üretici DEĞİŞMEZ (`stok_iade`
  üretmez).
- **YM2-7 — mutantlar:** **51** S154 A (Tahsil Edilen kart tutarını aşmaz — eski SM-1 (a)); **62** avanslı kartın Kalan'ı eksi (toplam − Tahsil Edilen — eski K8-AVANS listesinin öbür değeri; S154
  "Kalan 0"); yeni **63** S151 A / S158 B (iade 'Tahsil Edilen' / 'Ödenen' sayılır). 60, 61 aynen.
- **YM2-8 — DEĞİŞMEYEN:** bakiye / fatura açığı / açılış kalanı `2.4.6` kipinden (BİLİNEN SINIR aynen); K9 ret kodları; S129 (E42 — bağsız tahsilatın payı); mobil = masaüstü (eşdeğerlik);
  K1–K20'nin öbür kuralları; üretici.

### KULLANICIYA SORULMALI (bakım 2)
- YOK. Kararlar ve cari kâhininin değerleri bu kâhinin alanındaki bütün alt durumları tek okumaya indirdi; susulan yerler cari kâhininin BİLİNEN SINIR'ları (S162 = B …) — yeni soru değil.

### Kurallar (kod commit'i; yorumların karşılığı)
- `kahin.py` `tyk_kartlari()` (YM2-2): çevrilmiş adımlar cari kâhinine `2.5.0` kipinde verilir, sonra cari kâhininin `kontrol`'ü koşulur; kart başına `{odenen, kalan, taksit[], ham, pd[], neden[]}` —
  `odenen` / `kalan` / `taksit` cari kâhininin `kart:<no>:odenen` / `kalan` / `taksit<i>:odenen` anahtarları (yazmadığı anahtar `None`), `neden` cari kâhininin `belirsiz` kaydı (+ C13.4 (11)
  nedeni), `ham` `kart_odenen` taksit payları (yalnız mutant 61), `pd` taksit başına para dışı pay (yalnız mutant 63). SK-18 (`sus_kart`) kartı aynen `None`.
- `kahin.py` `kontrol()`: üç gösterge yalnız cari kâhininin yazdığı yerde yazılır; yazılmayan her gösterge `sus_notlari`'na neden metniyle (karşılaştırılan çıktıya girmez; `hesapla` komutu stderr'e
  "# SUS …" yazar). YS129-4 listesi kalktı. `fazla` / `tahsilatSayisi` aynen.
- `kahin.py` `istek()` (YM2-1): kart tahsilatının cari çevirisine `fazlasiniAvansYaz: true` — adımda `fazlaAvans` ya da yazılan tutar kartın o anki kendi kalanını aşıyorsa (`asan`). K9 (sınır) DEĞİŞMEDİ.
- `kahin.py` `kurulum()` (YM2-4): yeni `stok_iade` (KURULUM listesinde; cari yok / tutar geçersiz → `SenaryoHatasi`); cari kâhininin `stok_iade` adımına çevrilir; Kasa, kayıt, kart ödemeleri değişmez.
- `senaryolar.py`: E05 / E41 elle beklentileri tek değer (YM2-3); yeni E43 çifti (YM2-4 / YM2-5); `Akis._kontrol` YM2-6 (kendi tahsilatları toplamı aşan kartta 'Tahsil Edilen' = kendi tahsilatları,
  Kalan = toplam − tek kuyruk ödeneni = 0); `siade()` yardımcısı; kabul notları.
- Mutantlar (`kahin.py --mutasyonlar`): **51** S154 A, **62** avanslı kartın Kalan'ı eksi, **63** S151 A / S158 B (YM2-7). `kahin_test.py` **K1**: 51 ve 62 E05 / E41 / E43'te, 63 E43'te DEĞERLE (iki
  taraf da tek sayı), iki kanalda, öneri ve eşdeğer birleşimde.

### Senaryolar (elle — kâhin koşulmadan karar metninden; ilk koşuda model = elle, hiçbir elle değer kâhine göre düzeltilmedi)
- **E43-es-iade-sinir** (yeni eşdeğerlik çifti, mobil / masaüstü; bugün 20.10.2026): **K** (S151'in sayıları, Mevcut Borç kartıyla): açılış 1.000 (01.07) → kart 1.000 / 2 (01.08, 01.09) → fatura FK 500
  (15.10) → masaüstü iade 300 (16.10) ⇒ k1 'Tahsil Edilen' 0 · Kalan 700 · taksit 0 / 0, bakiye 1.200. **L** (S158'in örneği AYNEN): açılış 900 → kart 900 / 3 → iade 300 ⇒ 'Tahsil Edilen' 0 · Kalan 600,
  bakiye 600; taksit 'Ödenen'leri YAZILMAZ (cari kâhini S162 = B — "kart carinin bütün açık borcunu taşıyor ve faturasız stok iadesi taksitini kapattı"). **M** (S165'in örneği): açılış 900 → kart 900 / 3
  (01.08, 01.09, 01.10) → fatura FM 500 (15.10) → iade 300 ⇒ k1 0 · 600 · 0 / 0 / 0, bakiye 1.100; kart seçilerek 700 → ok (sormadan); 600 → 409 `plan-overpay` (kalan 200) ⇒ k2 'Tahsil Edilen' 700 ·
  Kalan 0 · 300 / 300 / 100, bakiye 400, Kasa 700; 600 'Fazlasını Avans Yaz' → ok ⇒ k3 1.300 · 0 · 300 / 300 / 300, fazla 400, tahsilat sayısı 2, bakiye −200, Kasa 1.300. `taksit = yalniz_cari`: mobil
  kart adımları 4xx, k2 = k3 = k1; `onay = gecemez`: t3 409 `plan-overpay`, k3 = k2.
- **E05 / E41** (elle beklenti DEĞİŞTİ — YM2-3): E05 k2 `KT1:odenen` [1.200, 1.300] → 1.300, `KT1:kalan` [0, −100] → 0; E41 k1 `KT:odenen` [1.000, 1.500] → 1.500, `KT:kalan` [0, −500] → 0. Adımlar
  aynı (yalnız `aciklama`).
- S154'ün örneği iki kanalda = E05 çifti (kart 1.200 / 3, karttan 500, sonra 800 'Fazlasını Avans Yaz' → 1.300 · 0, fazla 100, bakiye −100). Öbür 47 elle senaryonun elle tablosu DEĞİŞMEDİ (256
  birleşimin hepsinde model = elle; E42'nin k2'si — bağsız tahsilattan sonra kart tahsilatı — yeni cari kâhininde de 900 / 600 yazılıyor, susma yok).

### Değişen beklentiler (eski `kabul.json` ↔ yeni; döküm `docs/kanit/2026-11-13/kahinmobil2/kabul-fark-dokum.json`, araç `docs/kanit/2026-11-13/kahinmobil2/arac/kabul-fark.py`)
| Senaryo | Alan | Eski → yeni | Karar | Sayı |
|---|---|---|---|---|
| E05 çifti (k2) | `kart:KT1:odenen` / `kart:KT1:kalan` | [120000, 130000] → 130000 / [0, −10000] → 0 | S154 B | 2 + 2 |
| E41 çifti (k1) | `kart:KT:odenen` / `kart:KT:kalan` | [100000, 150000] → 150000 / [0, −50000] → 0 | S154 B | 2 + 2 |
| R1 / R2 / R3 (öneri grubu) | avanslı kartların `odenen` / `kalan` | liste → okuma (b) (listenin büyüğü) / liste → 0 | S154 B | 6 + 6 / 8 + 8 / 7 + 7 |
| E43 çifti | senaryo YENİ | — | S151 B, S158 A, S162 B (cari), S165 A, S118 B, S154 B | 2 senaryo |
Toplam 50 anahtar (25 Ödenen, 25 Kalan) + 2 yeni senaryo; **kararla AÇIKLANAMAYAN 0** (eski kabuldaki 50 liste anahtarının hepsi; yeni kabulda kart göstergesinde liste YOK). Adımı değişen senaryo
yok (E05 / E41'de yalnız `aciklama`); bakiye, Kasa, banka, taksit Ödenen'leri, `fazla`, `tahsilatSayisi`, adım yanıtları hiçbir eski senaryoda değişmedi. Üst alanlar: `cari_model_sha256` (cari
kâhini bakım 17 + 18), `kaynak`, `secim_notu`. Kabul: 58 senaryo (55 elle, 3 rastgele), 8.218 adım.

### Kanıt (bakım 2; `docs/kanit/2026-11-13/kahinmobil2/`, `tools/kanit.mjs kos`; kod commit'i `831e709`, ağaçta yalnız bu kanıt klasörü izlenmeyen)
- **Öz test 162/162, çıkış 0 — TZ=UTC ve TZ=Europe/Istanbul** (`kahinmobil2-oz-utc|ist.{txt,json,log}`; iki çıktı `[kanit]` satırı dışında bayt bayt aynı): A1 kabul güncel, A2 cari kâhini sha
  eşleşiyor, 55 elle × 256 birleşim model = elle, R1–R3 × 10 birleşim model = akış, C4, D1–D8, **63/63 mutasyon** (51 / 62 E05'te, 63 E43'te ilk yakalayan), J1, **K1** (51 / 62 E05 / E41 / E43'te,
  63 E43'te değerle; iki kanal × öneri / eşdeğer), H, H2 (cari kâhininin mutasyon taraması). Koşu günlüğü `kos-gunlugu.txt` (yük 2,2 → 5,7 — 4 çekirdek; başka işlerin yükü; sonuç belirlenimci).
- Üretici denetimi (`kahinmobil2-uretici-denetle.*`): elle 55 × 256, rastgele 3 tohum × 10 birleşim model = akış; komut çıkışı 0 (kanıt aracı TAP özeti bulamadığı için "BELİRSİZ" yazar —
  komut TAP üretmez). Yazan koşu `uretici-yaz1.txt`.
- **ESKİ kâhin (bakım 2'den önceki `kahin.py`, ayrı kopya — ders 23) YENİ elle beklentilerde KIRMIZI, beklenen nedenle** (`eski-kirmizi-c18.txt`, `eski-kirmizi-c16.txt`; araç
  `arac/eski-kirmizi.py`; 55 elle × öneri / eşdeğer = 110): cari kâhini bakım 18 ile **12 kırmızı / 98 aynı** — E05 / E41 "cari kâhini (2.5.0) adımı reddetti" (çeviri açığı:
  `fazlasiniAvansYaz` yok), E43 "bilinmeyen islem: 'stok_iade'"; cari kâhini bakım 16 (`0c945d05` — eski kabulun kâhini) ile **12 kırmızı / 98 aynı** — E05 `KT1:odenen` [120000, 130000] ≠ 130000
  ve `KT1:kalan` [0, −10000] ≠ 0, E41 [100000, 150000] ≠ 150000 ve [0, −50000] ≠ 0 (SM-1 listesi — S154 öncesi okuma), E43 `stok_iade` dilde yok. Kırmızı olmayan 98 eski senaryonun beklentisi değişmedi.
- Kabul farkı (`kabul-fark-dokum.json`, `arac/kabul-fark.py`): 50 değişen anahtarın hepsi S154 B sınıfında, BEKLENMEYEN 0. Program açılmadı; `program-surucu.mjs` koşulmadı ve değişmedi.

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
| `cari_ac`, `fatura`, `iade` (satış faturasının tamamı, geri ödemesiz), `stok_iade {cari, tutar, tarih?}` (faturasız stok Satış İadesi — parasız; bakım 2), `kart_ac`, `hesap_ac`, `urun_ac`, `kasa_acilis`, `cari_sil`, `donem_kilitle`, `ayar`, `yedek_al`, `yedek_geri_yukle`, `sirket_ac` | masaüstü kurulumu (yönetici) | `kart_ac` = Carinin Mevcut Borcunu Taksitlendir (eşit taksit, ayda bir) |
| `saat`, `sunucu: kapali\|acik\|yeniden`, `cihaz_esle`, `cihaz_sil`, `uzak_izin`, `sirket_yetki`, `lisans: gecerli\|bitti`, `surum_yukselt` | ortam | `kaynakSurum` verilmişse `surum_yukselt`'e kadarki adımlar o sürümün GERÇEK koduyla, masaüstünden girilir |
| `kontrol` | — | ara / son durum |

## Çıktı (iki taraf için ortak)

Adım: `adim:<id>:durum` = `ok` · `yineleme` (zaten kaydedildi) · `ret` · `belirsiz` (telefon sonucu görmedi) · `ulasilamadi` (sunucu kapalı) · `atildi`
(telefon göndermedi, S7); `adim:<id>:http` (ret; sayı, `"4xx"` = 400–499, liste = biri), `adim:<id>:kod` (planın adını verdiği kodlar; liste = biri), `adim:<id>:sunucu`
(belirsizde sunucunun gerçek sonucu: `yok` / `ok` / `yineleme` / `ret`).

Kontrol `<k>:<şirket>:…`: `cari:<ad>:bakiye` (kuruş; + = cari borçlu), `cari:<ad>:hareketSayisi` (tahsilat/ödeme kaydı; çek/senet ve kart tahsilatı hariç),
`fatura:<ad>:acik` (satış ve alış), `acilis:<cari>:kalan`, `kart:<ad>:{odenen ('Tahsil Edilen' — cari kâhininin 2.5.0 değeri; 'Fazlasını Avans Yaz' ile kapanan kartta karttan alınan paranın tamamı — S154 B), fazla (avans), kalan, tahsilatSayisi, taksit<i>:odenen}` (odenen / kalan / taksit Ödenen cari kâhininin yazmadığı yerde YAZILMAZ — bakım 2 YM2-2), `kasa`, `kasaGun:<gün>` (sıfır
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
- **E43** (bakım 2) masaüstü faturasız stok iadesi: 'Tahsil Edilen' / taksit 'Ödenen' iadeyi saymaz (S151 B / S158 A), S162 = B susması, sınır yalnız karttan alınan para (S165 A) ve para dışı paylı
  kartta S154 B.
- Mobil özgü: **E06** kesinti önce · **E07** kesinti sonra + yeni form · **E08** aynı kimlik farklı gövde · **E09** reddedilen kimlik + tutar biçimi · **E10** sunucu
  kapalı, kuyruk yok · **E11** yeniden başlatma sonrası kimlik · **E12** silinen cihaz · **E13** uzak izni · **E14** lisans · **E15** şirket yetkisi + değişikliği ·
  **E16** başka şirketin cari / hesap kimliği (yoldaki cari 404 — bakım 29.10.2026) · **E17** aynı anda aynı cari (mobil + masaüstü; iki cihaz Benzer İşlem yarışı) · **E18** K8 yarışı · **E20** stok yarışı ·
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
| (2.5.0 bakımı S129) Bağsız tahsilat kartın göstergelerini düşürmez; sınır tek kuyruktan okunur (kendi kalanı yerine); avanslı kartta kâhin bir okumayı seçer; mobil gösterim masaüstünden ayrışır | E42, E05, E41, R1–R3 (akış YS129-6); mutant 51, 60, 61, 62; J1 |
| (2.5.0 bakımı 2) 'Fazlasını Avans Yaz' ile kapanan kartın 'Tahsil Edilen'i kart tutarına kırpılır (S154 A) ya da Kalan eksi; iade 'Tahsil Edilen' / 'Ödenen' sayılır (S151 A / S158 B); iade kartın kendi kalanını küçültür (S165 B — K9 kalanı); cari kâhininin sustuğu göstergede değer uydurulur; 'Fazlasını Avans Yaz' cari kâhinine iletilmez (çeviri) | E05, E41, E43, R1–R3 (akış YM2-6); mutant 51, 62, 63, 61; K1 |
| (Bakım 29.10.2026) Masaüstü modül ucunda 3 ondalık reddedilir ya da aşağı kesilir; mobilde yuvarlanır; gövdedeki cari 404 / yoldaki 400; iki ihlalde ilk ihlalin kodu dayatılır | R1–R3 (akış), E09, E16, I1–I3; mutant 54–59 |

## Mutasyonlar (63; `kahin_test.py` F, `kahin.py --mutasyonlar`)

Her mutasyon modelden BAĞIMSIZ beklentilerce (elle beklenen, gerekirse üreticinin akış beklentisi) yakalanmalıdır; yakalanmayan = eksik senaryo. Liste
`kahin.py --mutasyonlar`: istek kimliği (1–6, 33, 34, 35, 48), sunucu / cihaz / izin / lisans / şirket (7–12, 39, 41, 42), para yolu (13–17, 36–38, 43), K8 (18–20,
31, 44, 47, K8-AVANS 49–53), stok (21, 22, 29, 30, 46), Kasa / Benzer İşlem (23, 40), tarih (24–27, 45), rol (28), yedek (32), bakım 29.10.2026 (54 masaüstü 3 ondalık
400, 55 aşağı kesme, 56 gövdedeki cari 404, 57 yoldaki cari 400, 58 iki ihlalde ilk kod, 59 mobilde yuvarlama), 2.5.0 bakımı S129 (60 göstergeler kartın kendi hesabından, 61 sınır
tek kuyruktan, 62 SM-1'in (b)'si seçilir; 51'in anlamı bu bakımdan beri: SM-1'in (a)'sı seçilir), 2.5.0 bakımı 2 (SM-1 kapandı — S154 = B: **51** S154 A (Tahsil Edilen kart
tutarını aşmaz), **62** avanslı kartın Kalan'ı eksi; yeni **63** S151 A / S158 B (iade sayılır)).

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
- **Bakım 29.10.2026** (kanıt `docs/kanit/2026-10-29/kahin-bakim-r123/`, `tools/kanit.mjs kos`): kendi testi önce 143/143 (412ea60), sonra **152/152**, çıkış 0
  (6753ee7; I1–I3 + mutant 54–59 eklendi; **59/59 mutasyon** yakalandı — 54, 55, 56, 58 R1 akış beklentisince, 57 E16 elle, 59 E09 elle); I1–I3 ESKİ kâhin
  kopyasında (`git archive 412ea607`, ayrı not defteri klasörü — ders 23) **0/3, çıkış 1**, kırmızı nedenleri beklenen: eski kâhin "12,345"'i 400 reddediyor,
  gövdedeki / yoldaki cariye [403, 404] veriyor, iki ihlalde ilk kodu (400 `bank-account-required`) yazıyor (ders 7, 38). Program karşılaştırması (`HUKUK_LICENSE_URL=
  http://127.0.0.1:9 npm run test:kahin-mobil-yazma`, tam, `--haric`'siz): önce **49/54** (E02 çifti + R1–R3), sonra **52/54** (yalnız E02 çifti — BİLİNEN
  KÂHİN FARKI); R1–R3'ün 3 ondalıklı adımlarında (R1 t1048, R2 t1405, R3 t1425) cari, fatura açığı, Kasa / POS sayıları programla bire bir. Akış modeli yeni üç
  kuralı ayrı yazımla taşır (`_modul_kurus` Decimal; toplanan `hata` listesi): elle 51 × 256 = model, R1–R3 × 10 birleşim ve tohum 4 (6.819 adım) akış = model.
- Dersler: 3/4 (D3, G2), 5 (temiz oda, akış modeli ayrı), 7 (mutasyon + `kanit/…/kirmizi`), 10 (eşdeğerlik çiftleri: değişen ortak yolun komşuları), 13/22 (sahte saat,
  gece yarısı, ay sonu, yıl dönümü; sistem saati okunmaz), 17 (rastgele sıra, eski sürüm verisi senaryosu), 31 (D6, E32), 40/43 (S1–S8 parametre; K8-AVANS yalnız ürün sahibinin kararıyla
  netleşti — programın davranışına bakılmadı; kararın susduğu Kalan ve yetkisiz ret kodu seçilmedi, ikisi de kabul).

## DENENMEYEN

- Program tarafı (sürücü yok; ana oturumun işi): bütün karşılaştırma M5 kodu yazılınca. Gerçek telefon / tünel / kapıcı (M3–M4) üzerinden uçtan uca.
- 3 cihaz sınırı, karekod eşleme, oturum süresi (M2 kâhini `test/bagimsiz/mobil-erisim`).
- Mobil cariye bağlı stok hareketi (stok satışı / alış) — S8 ve kapsam; iade, elle borç / alacak, evrak sonraki işlemleri (karşılıksız, ciro) mobilde.
- Ondalık stok miktarı; döviz; e-Belge'li fatura.
- Yetkisi planda yazılı olmayan rol × işlem hücrelerinin MUTLAK sonucu (yalnız göreli: mobil = masaüstü).
- (Bakım 29.10.2026) Masaüstü 3 ondalık yuvarlamanın elle (sabit) kabul senaryosu programa karşı YOK — program karşılaştırmasında yalnız R1–R3'ün "12,345"
  adımları (nakit ve POS) kapsar; "1,005", 4+ ondalık, taksit kartı ve evrak girişinde ondalık yalnız kâhinin kendi testinde (I1). Gövdedeki cari için "bulunamayan"
  (hiçbir şirkette olmayan) kimlik ve mobil evrak (yalnız `yollar=evrak_dahil`, seçilmedi) programa karşı denenmedi. Kabul kümesine yeni senaryo eklenmedi
  (kapsam kararı "işi büyütme"; 54 senaryo).
- (2.5.0 bakımı S129) Program koşulmadı (görev). Kartın / taksitin DURUM metni ("Tamamlandı", "Ödendi · Kısmen · Bekliyor") ve tahsilat formunun ÖNERİLEN tutarı — dilde anahtar yok
  (yalnız sınır ret kodlarıyla: `plan-overpay` / `plan-paid`). Kartlı cari + fatura / elle borç / iade / şüpheli alacak (kart_ac bu dilde faturasız cariye açılır — S126 / S128 /
  S130 komşuluğu cari kâhininde). Cari kâhininin `2.5.0` kipinin bu kâhinin senaryolarında reddettiği / sustuğu kart (YS129-5) hiçbir senaryoda oluşmadı — o yol yalnız kodda.
  Bakiye / fatura açığı / açılış kalanının `2.4.6` yerine `2.5.0` kipinden okunması bu bakımın kapsamı dışında (aşağıda BİLİNEN SINIRLAR).

- (2.5.0 bakımı 2) Program koşulmadı (görev). `stok_iade` adımının program sürücüsü eşlemesi YOK (ana oturumun işi — `program-surucu.mjs` değiştirilmedi): E43 çifti eşlenene dek program
  karşılaştırmasında koşulamaz. Değersiz Alacak Yaz, iade faturasının artanı, satış kartı (stoktan taksitli satış), avansla ödenmiş kart (S101), Tablodan Aktar kartı — dilde yok ya da senaryo yok.
  Rastgele üretici `stok_iade` üretmez (akış modeli o alanı denetlemez). İki şirket / yedek geri yükleme ile `stok_iade`.

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
- (Bakım 29.10.2026) Birden çok ihlalli adımda yalnız durum sınıfı karşılaştırılır: öneri birleşiminde R1–R3'te 9 adımın beklentisi tam koddan `"4xx"`'e gevşedi (R1 t684;
  R2 t191, t554, t687, t2184; R3 t1493, t2257, y1285, d2555) — bu adımlarda programın HANGİ ihlali önce söylediği denetlenmez (SENARYO-DILI §5.6 bunu açıkça
  böyle ister). Kayıt yokluğu ve sonraki bütün sayılar yine denetlenir.
- (Bakım 29.10.2026) Cari kimliğinin yolda mı gövdede mi taşındığı plan §7'nin uç biçiminden çıkarıldı; yeni evrak girişinin "gövde" sayılması ÇIKARIM'dır (plan evrak
  oluşturma ucunu yazmıyor). Yuvarlanınca 0 olan masaüstü tutarı ("0,004") 400 sayılır (ÇIKARIM; karşılaştırmada böyle bir adım yok).
- **BİLİNEN KÂHİN FARKI — E02 t4** (havale yoluna POS kimliği): kâhin 400 `bank-account-invalid`, program 404 `bank-account-missing`; plan açıkça belirlemiyor (gerekçe
  "BAKIM 29.10.2026" (4)); kayıt / para etkisi yok; CI'de `--haric` ile adıyla dışarıda, karar bekler.
- (2.5.0 bakımı S129) İki kural seti birlikte: kart göstergeleri cari kâhininin `2.5.0` kipinden, bakiye / fatura açığı / açılış kalanı `2.4.6` kipinden (bakım öncesi gibi). Bu
  kâhinin olay kümesinde (vadesiz faturalar, elle borç / şüpheli / kilitli netleşme yok) iki kipin bakiyesi aynıdır; fatura açığının `2.5.0` (vade sırası) ile ayrışıp ayrışmadığı bu
  bakımda DENENMEDİ — kural setinin bütünüyle `2.5.0`'a taşınması ayrı bakım ister.
- (2.5.0 bakımı S129) SM-1 (K8-AVANS × S129) yanıtlanana dek avanslı kartın Ödenen'i iki değerli liste — **bakım 2'de KAPANDI** (S154 = B; tek değer, Kalan 0).
- (2.5.0 bakımı 2) Kart göstergelerinde cari kâhininin sustuğu her alt durum (S144 = C, S143 = C, S162 = B, S163 = C, S166 = B, C13.4 (11)) bu kâhinde de YAZILMAZ — o anahtarlarda programın
  değeri denetlenmez (E43 L: taksit 'Ödenen'leri). Neden metni yalnız `sus_notlari` / `hesapla` stderr'inde (karşılaştırma çıktısında değil).
- (2.5.0 bakımı 2) `stok_iade` masaüstü kurulum adımıdır; mobil yolu yok. S151'in satış kartı (stoktan taksitli satış) ve Değersiz Alacak Yaz (şüpheli alacak) bu dilde YOK — S151 / S158'in o kolları
  yalnız cari kâhininde (d42 / d44); bu kâhin aynı değeri cari kâhininin kontrolünden okur.
- (2.5.0 bakımı S129) Akış modeli (YS129-6) üreticinin alt kümesinde kararın örneğini uygular (kartın tek borç kalemi olduğu cari); karışık kalemli kartlı caride bağımsız ikinci
  hesap yok — orada tek kaynak cari kâhinidir.
