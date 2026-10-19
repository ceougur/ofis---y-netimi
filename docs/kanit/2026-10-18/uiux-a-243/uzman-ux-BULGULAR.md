# DestekOfis 2.4.3 son aday (5966ac3) — Bağımsız Uzman UX Turu

Kök: `/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/uzman-ux-243-betikler/`
(kısaca BK). Sürücü `BK/surucu.mjs` + `BK/h.mjs`. Komutlar `BK/arsiv/komut-<oturum>/<ad>.mjs`, ham çıktılar `BK/arsiv/cikti-<oturum>/<ad>.txt`,
ekran görüntüleri `BK/ekran/<ad>*.png`. Her oturum: gerçek tarayıcı (Playwright Chromium), sahte EDM (test/einvoice-mock.mjs, ağa çıkılmadı),
`HUKUK_LICENSE_URL=http://127.0.0.1:9`, `startLicenseTimers:false`, ortak kilit altında 14 dakikalık parçalar. Ürün kodu değişmedi, commit yok.
Yazma işlemlerinden sonra sonuç veri tabanından (`app.store`) ya da API'den okundu.

## YÜKSEK

### UX1 — Aynı cariyi iki kişi düzenleyince ilk kaydedenin değişikliği sessizce siliniyor
- Persona: yönetici + muhasebe. Betik `komut-c/c12.mjs`, ekran `c11-eszamanli.png`, çıktı `cikti-c/c12.txt`.
- Adımlar: ikisi de Zeynep Kaya → Düzenle açar. Yönetici Telefon = 05551234567 yazıp kaydeder (DB: phone 05551234567). Ayşe kendi (eski)
  formunda yalnız E-Posta yazıp kaydeder → "Cari güncellendi." DB sonu: `phone ""`, `email zeynep@ornek.com`.
- Beklenen: "Bu cari siz düzenlerken başka kullanıcı tarafından değişti" (Çek: routes/cheques.mjs:480, tablo hücresi: workspace.mjs:306 bunu yapıyor).
  Gözlenen: uyarı yok, telefon kayboldu.
- En küçük düzeltme: cari formu açılırken `updatedAt` gönderilsin; PUT farklıysa 409 + "Kartı yenileyin" (çekteki kalıp).

### UX2 — Tam iade faturası Düzenle'de hiç kaydedilemiyor (çıkmaz)
- Persona: muhasebe/yönetici. Betikler `komut-g/g03.mjs`, `g04.mjs`, `g06.mjs`; ekranlar `g04-iade-duzenle-acilis.png`, `g06-tam-iade-duzenle.png`.
- Adımlar: 2 adetlik satışın 2 adedini iade et (IAD2026000000003) → Düzenle → hiçbir şeyi değiştirmeden "Değişiklikleri Kaydet".
- Gözlenen: "1. kalem (Kurulum): en çok 0 Adet iade edilebilir (faturada 2, önce iade edilen 2)." Formda aynı satırın altında "En çok 2 Adet"
  yazıyor (çelişkili). Yalnız not değiştirmek de kaydedilmiyor (g03). Kısmi iade (1/3) sorunsuz düzenleniyor (g05) — sorun iadenin kendi
  miktarını "önce iade edilen" saymasında.
- Kurala aykırı: "iade belgesi de düzenlenir" (ürün kararı).
- Olası kök: `/api/workspace/invoices/calc` (routes/invoices.mjs:2413–2416) `documentInput`'u mevcut belge olmadan koşuyor → `linesInput` existingId boş →
  `returnedQty` iadenin kendisini sayıyor. Düzeltme: calc isteğine düzenlenen belgenin kimliği gitsin ve existingId olarak aktarılsın (kayıt yolu
  zaten existingId veriyor, routes/invoices.mjs:1357).

### UX3 — Gece yarısını geçen açık Fatura penceresinde yeni fatura DÜNÜN tarihiyle kesiliyor
- Persona: muhasebe (pencereyi açık bırakıp ertesi gün devam eden). Sahte saat 31.12.2026 23:56, TZ Europe/Istanbul.
  Betikler `komut-e/e01–e05.mjs`, ekranlar `e02-gece-yarisi-form.png`, `e03-tarihler.png`.
- Adımlar: Fatura penceresi 23:56'da açık. 00:00'dan sonra aynı pencerede "+ Yeni Fatura" → Hizmet Satışı → Kaydet ve Gönder.
- Gözlenen (DB): `TEA2026000000002 issue_date 2026-12-31 issue_time 00:00` (gerçek an 01.01.2027 00:00). Aynı pencerede yeni form tarih
  2026-12-31 / saat 00:01 açılıyor; pencere kapatılıp açılınca 2027-01-01 geliyor (e05). Uyarı yok.
- Etkisi: belge yanlış güne, ay/yıl sonunda yanlış KDV dönemine ve yanlış yılın serisine yazılıyor; sonraki doğru tarihli belgelerle sıra kuralı da
  bozuluyor (e03'te geriye tarihli denemede "son belge 31.12.2026 tarihli" engeli).
- Kök: `client/assets/hof-invoices.js:29` `todayIso = () => meta?.today …` — meta yalnız pencere açılışında yüklenir.
  Düzeltme: yeni formda tarih `HOF.localToday()`/sunucu saatinden o an alınsın ya da meta.today gün değişince yenilensin.

### UX4 — Onay pencerelerinde varsayılan odak YIKICI düğmede; Esc + Enter doldurulmuş faturayı siliyor
- Persona: muhasebe. Betikler `komut-b/b08.mjs, b09.mjs, b15.mjs, b16.mjs`; `komut-f/f08.mjs`; ekranlar `b15-esc-onay.png`, `b15-enter-sonrasi.png`,
  `f08-hareket-sil-onay.png`.
- Adımlar: Yeni fatura (cari + kalem + 5.000 TL) → yanlışlıkla Esc → "Kaydedilmemiş Değişiklik" penceresinde odak "Kaydetmeden Kapat" → Enter →
  fatura formu ve Fatura penceresi kapandı; geri getirme yok (taslak yok, DB'de kayıt yok).
  İkinci yol: faturadan "+ Yeni Cari" kaydedilince odak pencerenin × (Kapat) düğmesine düşüyor (b08) → Enter → soru → Enter → kayıp.
  Aynı kalıp "Hareketi Sil" (odak "Sil"), "Listeden Sil" (odak "Listeden Sil", e06) onaylarında.
- Kök: `hof-core.js:1160` HOF.confirm her zaman `data-answer="yes"`'e `autofocus` veriyor, `danger:true` olsa da.
- Düzeltme: `danger` onaylarında autofocus "Vazgeç / Forma Dön"de olsun (yaygın programların davranışı).

## ORTA

### UX5 — e-Fatura işaretini elle kaldırma sessiz; sonraki düzeltme açık formu güncellemiyor, ileti yanlış yol gösteriyor, seçilen posta kutusu siliniyor
- Betikler `komut-c/c03–c09.mjs`, ekranlar `c03-coklu-kutu.png`, `c07-yanlis-earsiv.png`, `c08-yeniden.png`, `c09-yeniden-sec.png`.
- Adımlar: Yeni cari, Mükellef Sorgula → 2 PK → defaultpk seçilir. "e-Fatura mükellefi" kutusuna tıklanınca işaret kalkıyor, ileti YOK (koyarken
  ileti var). Kaydet → karttan Satış Faturası → form "e-Arşiv kesilir" → Kaydet ve Gönder → sunucu yakalıyor (iyi): "…Cari kartı e-Fatura mükellefi
  olarak işaretlendi… yeniden kaydedin: e-Fatura olarak kesilir." Ama açık form hâlâ "e-Arşiv kesilir"/TEA numarası; yeniden kaydet → ikinci 400
  ("GİB kuralı gereği e-Arşiv değil e-Fatura…"). Ancak cariyi × ile kaldırıp yeniden seçince form düzeliyor; o da PK ve vergi dairesi eksik diyor.
  DB: cari `e_alias` = "" — kullanıcının seçtiği defaultpk silinmiş.
- Düzeltme: sunucu bu düzeltmeyi yaptığında form carinin bilgisini yeniden çeksin; ileti "yeniden kaydedin" yerine yapılacak adımı söylesin;
  çok PK'de mevcut seçili etiket korunsun; kutu kaldırılınca da yol gösteren ileti.

### UX6 — "Kaydet ve Gönder" onayı "Yanlışsa sonradan Düzenle ile düzeltilir" diyor; gönderilen belgede Düzenle kapalı
- Betikler `komut-b/b11.mjs, b12.mjs`; ekranlar `b11-gonder-onay.png`, `b12-gonderildi.png`.
- Onay: "…Yanlışsa sonradan kartındaki "Düzenle" ile düzeltilir. Belge kaydedilir kaydedilmez entegratöre gönderilir." Gönderim sonrası:
  "Düzenle kapalı: Bu belge e-Belge olarak gönderildi; düzenlenmez. İptal ya da iade faturasıyla düzeltin."
- Düzeltme: e-Belge gönderimli onayda cümle "Gönderildikten sonra düzenlenemez; yanlışsa iptal ya da iade gerekir." olsun.

### UX7 — Muhasebe hareket silebiliyor; onay "Yönetim → Silinenler'den geri yüklenebilir" diyor, oraya erişemiyor
- Betikler `komut-f/f08.mjs, f09.mjs`; ekranlar `f08-hareket-sil-onay.png`, `f09-ayse-silinenler.png`.
- Ayşe (Muhasebe; `records.delete=false`) tahsilatı × ile siliyor; ileti yönetim paneline yönlendiriyor; admin.html "Bu sayfa yöneticiler içindir";
  yan kartta Yönetim yok; bildirimde "Geri Al" yok.
- Düzeltme: yönetici olmayana "Yöneticiniz Yönetim → Silinenler'den geri yükleyebilir" yazılsın ve/veya bildirimde birkaç saniyelik "Geri Al".

### UX8 — Taksit kartında "Kapat" onaysız ve pencerenin "Kapat"ıyla aynı ad
- Betik `komut-f/f07.mjs`, ekran `f07-kapat.png`.
- Açık 3.000 TL'lik kartta üstteki "Kapat" (title: "Kart kapanır; uyarı vermez…") tek tıkla kartı Kapalı yaptı; altta pencereyi kapatan bir "Kapat"
  daha var. Gecikme uyarıları susar; geri dönüş "Yeniden Aç" ile var ama kullanıcı fark etmeyebilir.
- Düzeltme: düğme adı "Kartı Kapat"; kalan > 0 ise onay ("Kalan ₺3.000 açıkken kart kapatılsın mı?").

### UX9 — e-Belge zorunlu alanları (il, tüzel alıcıda vergi dairesi) faturada ortaya çıkıyor; formdan düzeltme yolu yok
- Betikler `komut-b/b18–b26.mjs`, `komut-c/c09.mjs`; ekranlar `b18-nakit.png`, `b19-il-yok-gonder.png`, `b24-cari-duzelt.png`, `b25-taslak-duzenle.png`.
- Faturadan açılan yeni cari formunda il/vergi dairesi "zorunlu" işaretsiz; faturada "Cari (alıcı): il zorunludur (adres)." Fatura formunda cariyi
  düzeltecek bağlantı yok (Ctrl+K pencere açıkken çalışmıyor). Yol: Taslak Olarak Kaydet → taslaktaki "Cari Kartı" (Fatura penceresi kapanır, Cari
  açılır) → Düzenle → il → cari kartındaki taslak satırı → Düzenle ve Kaydet → ödeme yeniden. ~8 adım.
- Düzeltme: faturadaki uyarının yanına "Cariyi Düzenle" (üstte açılan cari formu, kaydedince fatura yenilenir); e-Belge açıksa cari formunda il
  (ve tüzelde vergi dairesi) zorunlu işaretli.

### UX10 — Odak yönetimi tutarsız (klavye kullanıcısı)
- Betikler `komut-b/b02.mjs, b03.mjs, b08.mjs, b17/18`; `komut-b/b31.mjs`.
- Cari ve Tahsilat formları ilk alana odaklanıyor; ama "+ Yeni Fatura" senaryo ekranı, Hizmet Satışı formu ve İade formu açılınca odak `body`
  (Tab sırası sayfanın başından); faturadan yeni cari kaydedilince odak pencerenin × düğmesinde (UX4'ün tetikleyicisi); "Müşteriyi seçin" hatasında
  odak "Kaydet ve Gönder"de kalıyor, cari alanına gitmiyor.
- Düzeltme: form açılışında ilk boş zorunlu alana (Cari) odak; yeni cari seçilince ilk kalem adına; doğrulama hatasında hatalı alana.

### UX11 — Muhasebe rol açıklaması "Görev atama ve raporlar yok" — ama Raporlar açık (18.10 kararı)
- Ekran `a02/a03` (Yönetim → Kullanıcılar → Roller) ve `d01-raporlar.png`; kaynak `client/assets/admin.js:160`.
- Yönetici yanlış bilgiyle yetki kararı verir. Düzeltme: "…Finans raporları açık; görev atama yok." gibi güncel metin.

### UX12 — Eski doğrulama iletisi ekranda kalıyor
- Betik `komut-g/g02.mjs`, ekranlar `b19-il-yok-gonder.png`, `g02-eski-hata.png`.
- Carisiz kaydet → form altında kırmızı "Müşteriyi (cariyi) seçin." Cari seçilip kalem değişince de duruyor (`.hof-form-error`). Kullanıcı formun hâlâ
  hatalı olduğunu sanıyor. Düzeltme: alan değişince form hatası temizlensin.

### UX13 — Mükellef Sorgula, yazılan unvanla GİB'deki unvan farklıyken sessiz
- Betik `komut-b/b06.mjs`, ekran `b06-sorgu.png`. Yazılan "Beta Yazılım A.Ş.", sorgu "e-Fatura mükellefi: ALICI TİCARET A.Ş." diyor; ad değişmiyor,
  öneri yok; e-Fatura yazılan adla gidiyor (b12, DB). Logo/Mikro'da sorgu unvanı doldurur ya da sorar.
- Düzeltme: farklıysa "Unvanı GİB'deki ile değiştir?" sorusu (tek tık).

## DÜŞÜK

- UX14 — Tümünü Gönder hata iletisinde teknik kod: "1 belge gönderildi; 1 belge gönderilemedi: EDM'ye bağlanılamadı: UND_ERR_SOCKET; EDM'ye
  ulaşılamadı…" (`komut-g/g08.mjs`, `g07-tumunu-gonder-hata.png`). Kod kaldırılsın, tekrar eden ifade sadeleşsin; tek bağlantı kopmasında toplu iş
  duruyor — bir kez otomatik yeniden deneme düşünülebilir.
- UX15 — Geriye tarihli belgede numara/tarih sırası çakışması formda değil, numarayı gösteren onaydan SONRA hata olarak çıkıyor (`komut-e/e03.mjs`).
  Formdaki uyarı yalnız VUK 7 gün. Çakışma formda önceden gösterilsin.
- UX16 — Faturadan "+ Yeni Cari": seçicide yazılan ad yeni cari formuna taşınmıyor (`b04/b05`); genel seçici taşıyor (hof-accounts.js:515),
  fatura düğmesi taşımıyor (hof-invoices.js:696).
- UX17 — Ödenmiş faturanın başlığında "Tahsil Edilecek ₺600,00" (`b27-odendi-tahsil-edilecek.png`). "Genel Toplam" ya da duruma göre "Kalan".
- UX18 — Fatura "Tahsilat Ekle"de yol yalnız Nakit/Havale/POS; cari "+ Tahsilat"ta Çek/Senet de var (`b29` ↔ `f01`). Aynı iş iki ekranda farklı.
- UX19 — Cari kartı Hareketler süzgeci "Kasa 1" havale tahsilatını da sayıyor (`a15`, hof-accounts.js:85). Kasa = yalnız nakit kararıyla çelişen ad;
  "Tahsilat / Ödeme" adı önerilir.
- UX20 — EDM'ye ulaşılamayınca aynı anda başarı ve hata bildirimi; başarı metni "Satış Faturası Gönderilecek kaydedildi." (durum adı numara yerine)
  (`komut-b/b33.mjs`, `b33-ag-hatasi.png`).
- UX21 — Posta Kutusu Seçin penceresinde açılır listede Enter seçmiyor; Tab ile "Seç"e gitmek gerekiyor (`komut-c/c04.mjs`).
- UX22 — Yeni Kullanıcı: "İlk Parola" üretilmiş parolayla dolu; fareyle tıklayıp yazınca sona ekleniyor (DB parolası "JNrA-DpdB-Y3atAyse-2026-Parola";
  ekran `a06-form-dolu.png`). Odakta tümü seçilsin.
- UX23 — Pencere başlığı yazım düzeni dışı: "Stok eksiye düşecek" (hof-invoices.js:2075; kural "Stok Eksiye Düşecek"). Eksi stokta ayrıca iki ardışık
  onay (Faturayı Kaydet + Stok) — tek onayda birleşebilir (`komut-f/f12–f13`).
- UX24 — Ekranda TOPLAM satırı olmayan veri dolu raporlar: KDV Özeti (Beyanname Hazırlığı), Açık Faturalar ve Yaşlandırma (`d03-kdv.png`,
  `d08-acik-faturalar.png`; 62 raporluk tarama `cikti-d/d07.txt`). Kutucuklar toplamı veriyor; "her raporda alt TOPLAM" kararına uyum kontrol edilsin.
- UX25 — Fatura listesi "Belge Türü" süzgecinde kapalı özellik "e-SMM" görünüyor (`cikti-b/b01.txt`).
- UX26 — Fatura Ayarları açıkken Esc tüm Fatura penceresini kapatıyor (listeye dönmüyor) (`cikti-g/g01.txt`).
- UX27 — Gönderilmiş belgede pasif "Düzenle" dolu/vurgulu görünüyor (pasif "Sil" gri) (`b27-odendi-tahsil-edilecek.png`).
- UX28 — İade düzenlemesinde "Müşterinin İade Faturası No" kutusunda programın kendi iç numarası (IAD2026000000003) görünüyor (`g06-tam-iade-duzenle.png`).

## Karar önerileri (ürün kararına dokunanlar)
- KÖ1 Perakende/nihai tüketici satışında her seferinde cari zorunlu (`b17`): "Nihai Tüketici (kimliksiz)" hazır cari ya da hızlı seçenek.
- KÖ2 "Listeden Sil" adı (bilinçli karar) silme çağrıştırıyor; belge Müşteri Fişi olarak kalıyor (`e06`). "Gönderme — Müşteri Fişi Olarak Bırak" önerilir.
- KÖ3 Yeni kurulumun ilk ekranı muhasebe kullanıcısına "Excelini yükle" diyor; firma bilgisi/Fatura Ayarları/ilk banka hesabı için ilk kurulum
  listesi yok, şirket adı "Şirket 1" (a02). İlk açılış kontrol listesi önerilir.
- KÖ4 e-Fatura işaretini elle kaldırmak (B6 kararı) serbest ve sessiz — en azından bilgi iletisi (UX5).

## Çürütülen adaylar
1. Şirketler → Kullanıcı Yetkileri kutuları boş görünüyor (a07) → DOM'da işaretli (a09).
2. Banka açılışında boş tutarla "Bakiye Doğrulandı" (a17) → DB balance_confirmed 0 (a18).
3. Açılış stoğu varsayılan Kasa'ya gider gibi (f10) → kutu varsayılan kapalı, Kasa satırı yok (f11).
4. e-Fatura işareti kalkınca alıcıya e-Arşiv gider (c05) → gönderimde yakalanıyor, numara harcanmadı, EDM'ye gitmedi (c07).
5. Çekin kapattığı fatura yeni faturaya kayıyor (f12–f16) → test saati oturumlar arasında geri gitti (yeni fatura 09:03Z < eski 09:08Z); "en eski" kuralı doğru.
6. Formu 23:56'da açıp 00:00'dan sonra kaydedince tarih 31.12 (e02) → form önceki gün açıldı, tarih görünür, VUK süresi içinde (UX3 bundan ayrıdır).
7. Gönderilmiş e-Faturada İptal Et yanıltıcı (b13) → onay "alıcı reddetti ya da GİB'den iptal edildi; programda da iptal" diye açık.
8. EDM yokken numara yanıyor (b33) → numarasız Gönderilecekler'e düştü, Tümünü Gönder bağlantı gelince numaralayıp gönderdi (c02).
9. Eksi stok sessiz (f12) → satırda kayıttan önce uyarı + kayıtta soru.
10. Aynı adlı iki cari (a12) → "Aynı Adlı Cari Var" + no/telefonla karşılaştırma; aynı kullanıcı adı → açık ileti.
11. Kasa'ya havale düşüyor mu (a16) → Kasa yalnız nakit, açıklaması yazılı.
12. e-Arşiv il eksikken numara harcanıyor mu (b19) → kaydedilmedi, numara harcanmadı.

## DENENEN
Persona 1 (ilk açılış varsayılan parola → parola değiştirme, hatalı/uyuşmaz parola iletisi; Yönetim → Kullanıcılar: muhasebe + personel ekranlardan
oluşturma, aynı kullanıcı adı; Şirketler/Yedekler sayfaları; banka kurulum sihirbazı ve hesapsız havale aktarımı). Persona 2 (cari + aynı ad; fatura
önce/cari önce; e-Fatura (mükellef, çok PK), e-Arşiv (şahıs), carisiz, il eksik → taslak → düzelt; nakit/havale/POS (tanımsız)/çek tahsilatı; iade
(tam/kısmi) ve düzenleme; Kaydet, Sonra Gönder; EDM yokken Kaydet ve Gönder; Gönderilecekler/Tümünü Gönder (bağlantı kopması); Listeden Sil;
stoktan satış eksi stok; taksit kartı (eşit taksit, Kapat); hareket silme; yıl sonu 23:56→00:00 (TZ İstanbul); geçmiş tarih; 62 raporun TOPLAM taraması,
KDV Özeti, Açık Faturalar). Persona 3 (personel yan kartı, cari kartı düğmeleri). İki kullanıcı aynı cari / aynı iade. Klavye: Tab sıraları, Enter/Esc,
Ctrl+Enter, öneri listesinde ok tuşları. Ders 3 (sonuç DB'den), ders 12 (insan hızında yazım), ders 13 (sahte saat), ders 30.

## DENENMEYEN
- "Kayıt önce" yolu (Çalışma Tablosu Excel/Sheets yükleme, Tablodan Aktar), Excel'den cari/stok yükleme.
- F5 / Geri: headless Chromium'da F5 tuşu sayfayı yenilemedi, Alt+← gezinmedi — sonuç YOK (c13); gerçek Edge uygulama penceresinde denenmeli.
- "Şimdi Yedek Al" tıklanmadı (bulucum Yedekler sekmesine tıkladı); yedek/geri yükleme, ikinci şirket.
- Ay sonu (yalnız yıl sonu), hafta sonu/bayram; kasa/cari formlarında gün değişimi (UX3 yalnız fatura için kanıtlı).
- Alış faturası, SMM, fiyat farkı, döviz, banka/POS tanımlı tahsilat, çek tahsile verme/ciro, taksit tahsilatı, gelen e-Faturalar, e-Fatura ticari
  senaryo kabul/red, Durum Sorgula, Resmî Görüntü, PDF/Excel çıktılarının içeriği, rapor süzgeçlerinin her seçeneği (ders 11), WhatsApp.
- Dar ekran/mobil, ekran okuyucu, yüksek yük.
- a-oturumunun komut/çıktı dosyaları ikinci oturum başlarken silindi (ekran görüntüleri `ekran/a*.png` duruyor); o oturumdan raporda yalnız UX11 (kaynağı
  admin.js:160 ile de doğrulandı), UX19, UX22 var.

## BİLİNEN SINIRLAR
- Sahte EDM; lisans "deneme başlamadı / salt okunur" bandı test ortamından (enforce:false, yazma serbest).
- İlk oturumlarda tarayıcı ve sunucu UTC (saatler 09:00 görünür), e–g oturumlarında Europe/Istanbul. Tarih kutusu headless'ta mm/dd/yyyy görünüyor
  (ortam); tarih alanına klavyeyle yazım bu yüzden kanıt sayılmadı (f03).
- Test saati her oturumda yeniden başladı (oturumlar arası geri gitti) — f12 adayı bu yüzden çürütüldü.
- Bazı ön veriler API ile girildi (b01 kullanıcı/firma/entegratör; g05–g07 faturalar); bulgu adımlarının kendisi ekrandan.
- Tek ajan, tek tur; bulgular başka ajanların listesiyle karşılaştırılmadı (bağımsızlık gereği).
