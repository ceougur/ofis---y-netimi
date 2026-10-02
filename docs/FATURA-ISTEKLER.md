# Fatura Modülü (2.0.15) — İstek Kontrol Listesi

Kullanıcının bu sürümdeki her isteği, yapılan iş ve kanıtı. Modül bitmeden her satır "Tamam" ve kanıtlı olmalı
(CLAUDE.md, şikâyet 4: "Dediklerimi gerçekten yap").

Durum: ☐ yapılmadı · ◐ sürüyor · ☑ tamam (kanıt yazılı)

## Kullanıcının açık istekleri

| # | İstek (kullanıcının sözü özetle) | Durum | Yapılan iş / kanıt |
|---|---|---|---|
| 1 | Menüdeki "Yeni Kayıt" kalksın; tablo başlığında Dışa Aktar'ın yanına "Yeni Kayıt" | ☑ | cdebfa3; `test/e2e/run.mjs` (#hof-toolbar-new, Dışa Aktar'ın solunda) |
| 2 | Soldaki sabit menüye "Fatura" menüsü | ☐ | |
| 3 | Satış/alış faturası: stok miktarı ve maliyeti, cari borç/alacak, vadeli/taksitli → Taksit; hepsi tek atomik işlem (BEGIN IMMEDIATE/COMMIT/ROLLBACK) | ◐ | |
| 4 | GİB UBL-TR XML; KDV %1/%10/%20; tevkifat; KDV dahil/hariç; kuruş hassasiyeti; e-Arşiv / e-Fatura (Temel/Ticari); VKN/TCKN/MERSİS/adres/tüzel-gerçek doğrulaması | ◐ | `server/lib/invoice-math.mjs`, `server/lib/tax-id.mjs` |
| 5 | Entegratör Adaptör Katmanı (Logo, İzibiz, Digital Planet, QNB e-Finans, GİB) + PEPPOL/UBL | ◐ | Tek arayüz (`server/lib/einvoice/adapters.mjs`); kullanıcı kararıyla şimdilik yalnız EDM Bilişim (istek 33); PEPPOL çıktısı `buildUbl(…, { variant: "peppol" })` |
| 6 | Fatura tarihi kilitli döneme ve yanlış zaman aralığına girmez; cari/stok kilitleri denetlenir | ☐ | |
| 7 | Kesme / iptal / iade sonrası Kasa, Stok, Cari, Taksit (ve Çek/Senet) ↔ Ana Defter mutabakatı | ◐ | `server/lib/integrity.mjs` fatura denetimleri |
| 8 | Cari kartının üstünde "Alış Faturası" ve "Satış Faturası" pilleri; tıklayınca ilgili yere gider | ☐ | |
| 9 | Panelde "Alıştan İade" ve "Satıştan İade"; Kasa, cari, çek, senet ve gereken her yere entegre | ☐ | |
| 10 | İade edilecek faturayı bulan arama motoru en üstte | ☐ | |
| 11 | Fatura ekranlarında Not; faturanın altına not olarak basılır | ☐ | |
| 12 | Fatura tarihi ve saati | ☐ | |
| 13 | Kesilen faturaları görüntüleme, süzme ve seçme | ☐ | |
| 14 | Fatura kartında 2 pil | ☐ | |
| 15 | Cari ve ürün girilince: bu ürünün bu cariye ve başka carilere son satış / son alış fiyatı kendiliğinden görünür | ☐ | |
| 16 | Sorulacak yerlerde öneriyle karar ver; bitince kararları maddeler halinde yaz | ☐ | Teslim mesajı + bu belgenin "Kararlar" bölümü |
| 17 | Uzman UI, UX, baş mühendis, baş mimar gözüyle | ◐ | |
| 18 | Çek/Senet: fatura anında portföye (satış) ya da verilen evraka (alış); cari mahsup; aynı işlem; çek tarihleri kronolojik; mutabakat Çek/Senet'i kapsar | ◐ | `routes/cheques.mjs` invoiceCheques |
| 19 | Diğer bütün bölümlerle ve raporlarla entegre, doğru mantık | ☐ | |
| 20 | Cari kaydında vergi dairesi, vergi numarası ve fatura için gereken bütün alanlar | ◐ | göç 18 cari alanları, `taxInput` |
| 21 | Belirtilmeyen ama fatura modülünde olması gereken her şey | ◐ | Aşağıdaki "Benim eklediklerim" |
| 22 | Hizmet faturası, stoktan satış… tüm sektörlere; hem alış hem satış; kullanıcı en başta seçip ilerler; daha iyi alternatif varsa o | ◐ | Senaryolar (`SCENARIOS`) |
| 23 | İstekleri yeniden gözden geçir, eksik kalmasın | ◐ | Bu liste |
| 25 | Entegratör: müşteri entegratörle (Logo, İzibiz, Digital Planet, QNB e-Finans…) kendi sözleşir, kontörü kendisi alır; programa API kullanıcı bilgilerini girip kaydeder; program e-Fatura/e-Arşiv'i doğrudan entegratöre gönderir, durumunu sorgular, gelen faturaları çeker (biz aracı değiliz) | ◐ | |
| 26 | Kesilen, alınan, iptal edilen (ve taslak, iade) faturaları görüntüleme | ◐ | Fatura ekranı sekmeleri |
| 27 | Müşteri isterse e-Fatura isterse e-Arşiv kesebilmeli | ◐ | Belge türü seçilir; GİB kuralına aykırı seçim nedeniyle engellenir (`allowedProfiles`) — bağlantı açılınca görünür |
| 28 | Vergi dairesiyle henüz entegre etme; "entegre et" diyene kadar resmî hükmü olmayan müşteri fişi | ◐ | `config.edocEnabled` false; PDF başlığı "Müşteri Fişi" + "resmî fatura yerine geçmez" |
| 29 | Entegratör ayarlarına devam et, her şey hazır olsun (kapalı dursun) | ◐ | |
| 30 | Özellikle EDM Bilişim entegratörünü kusursuz hazırla (kullanıcı onunla çalışmayı düşünüyor) | ◐ | `server/lib/einvoice/edm.mjs`, `soap-contract.mjs`; `test/einvoice-edm.test.mjs` (19 test, sahte EDM sunucusu) |
| 33 | Entegratör şimdilik yalnız EDM Bilişim; anlaşılamazsa anlaşılan entegratöre göre yapılır | ☑ | `ADAPTERS = { edm }`; İzibiz istemcisi 167eefa'da arşivde |
| 31 | Modül bitince yalnız proje sahibine özel, deneyimsiz birinin anlayacağı dilde ayrıntılı kullanım kılavuzu; entegrasyonun nasıl yapılacağına kadar | ☐ | Müşteri kılavuzuna girmez; `docs/` altında ve PDF |
| 32 | Ana teste başlamadan önce: en güncel resmî ve resmî olmayan, en çok önerilen kaynaklardan "fatura modülünde neler olmalı, nasıl çalışır, arayüz, mantık" araştırması; yaptığım modülle karşılaştırma; gerekenleri yap/düzelt; testlere öyle başla | ☑ | `docs/FATURA-KARSILASTIRMA.md` (5db2819): tahsilat ekle, tekrarlayan fatura, VUK 231 7 gün uyarısı, e-Arşiv 30.000 TL kimlik, 8 gün iptal |
| 34 | (02.10.2026) Faturayı kesince o an entegratöre gönderebilmeli ya da "sonra gönder" diyebilmeli; sonra gönderde de belge kesilmiş gibi bütün işlemler (stok, cari, Kasa, taksit, çek/senet) hemen işlenir; belge "Gönderilecekler"de bekler; kullanıcı oradan silebilir — silince etkiler GERİ ALINMAZ (kullanıcı kararı) | ☑ | Formda "Kes ve Gönder" / "Kes, Sonra Gönder"; sekme "Gönderilecekler" + "Tümünü Gönder"; kartta "Listeden Sil" (belge Müşteri Fişi numarası alır, etkiler yerinde; sonra yine gönderilebilir, fiş numarası "Kâğıt Fatura No" izinde kalır). e-Belge numarası gönderim anında verilir (GİB serisinde boşluk olmaz); serideki son gönderilenden eski tarihli belge gönderilmez (kart uyarır). `test/einvoice-edm.test.mjs` 3 test, `senaryo-215` 11. adım |
| 24 | Gerçek anlamda test (süslü söz değil): `motor.mjs` — otonom, acımasız test motoru | ☑ | `test/mutabakat/motor.mjs` + `fatura-model.mjs`; `npm run test:mutabakat` |
| 24a | Differential testing: bağımsız (harici kurallarla yazılmış) model binlerce rastgele işlem üretir (fatura, tahsilat, ödeme, çek giriş/çıkış, iade, düzeltme, silme); her adımda SQLite / Ana Defter çıktısı modelle kuruşu kuruşuna karşılaştırılır; ilk sapmada durur | ☑ | Model programın hesap kodunu kullanmaz (BigInt); `test/fatura-model.test.mjs` 30.000 fatura = program; 7 tohum × 300–2.000 işlem, her işlemden sonra Kasa (3 yol), cariler, stok, taksit kartları, faturalar (durum + TL ödenecek, yetim yok), çek/senet, mutabakat kapısı, mizan 100/102/108/120/320/336 |
| 24b | Atomiklik ve ROLLBACK: zincirin bir adımında kasıtlı hata (stok yetersiz, Kasa eksi yasağı, çek doğrulama hatası); hiçbir yarım kayıt kalmaz; Kasa, Cari, Stok, Taksit, Çek/Senet tabloları işlem öncesine birebir döner | ☑ | `fatura-acid`: 3. kalemde stok-negative; Kasa engel (cash-blocked/negative); mükerrer çek serisi (stok, cari, Kasa yazıldıktan sonra cheque-duplicate) → ardından tam doğrulama; numara yanmaz (seri boşluksuz) |
| 24c | Çapraz senkron: bir kısmı nakit, bir kısmı taksit/vade, kalanı çek/senet olan fatura; tüm alt defterler ↔ cari bakiye mutabakatı | ☑ | `paymentFor` "mix": 1–2 Kasa yolu + 1–2 çek/senet + taksit ya da vade; alışta portföyden ciro; iptal ve iade geri alma; tahsil/ödeme çek olayları |
| 24d | Saha hataları: boş rapor (veri varken boş dönen sorgu), kapalı döneme / kilitli tarihe / işlem tarihinden önceye vade-çek tarihi girişimleri reddedilir; mükerrer fatura no / UBL ETTN çakışması | ☑ | `fatura-hatasi` (18 tür), `kilit-ihlali` (fatura kes/iade/iptal), `fatura-bagli`; raporlar: Satış/Alış/İade Faturaları + KDV Özeti = model, veri yokken boş; sonda seri boşluksuz, ETTN tekil, mükerrer yok |
| 24e | Test scripti koşturulur, tüm senaryoların yeşil olduğu raporlanır | ☑ | 02.10.2026: tohum 2–7 yeşil (tohum 7: 2.000 işlem, 305 fatura, 118 çek, 542 beklenen ret, 0 sapma). İlk koşuda gerçek hata bulundu ve düzeltildi: çekli faturası iptal edilmiş carinin fatura listesi/kesme yanıtı 500 veriyordu (`paymentStates`) |

## Proje kuralları (CLAUDE.md) — bu modülde de geçerli

| Kural | Durum | Kanıt |
|---|---|---|
| Yazım düzeni: ekranda/PDF'te/Excel'de her ad Başlık Yazımıyla | ☐ | `test/yazim-duzeni.test.mjs`, senaryo testi |
| Kılavuz: yalnız kısa "nasıl yapılır" | ☐ | |
| İş akışı testi: arayüzden, sıfırdan, sayılarla (bakiye, Kasa, stok, KDV) | ☐ | `test/e2e/senaryo-215.mjs` |
| Boş veri; sıralama (cari önce / ürün önce / fatura önce); aynı adlı iki cari | ☐ | |
| Raporlar: boş dönem, tek kayıt, geçmiş/gelecek tarih, ileri tarihli hareket, yetkisiz kullanıcı | ☐ | |
| Yayın yok: önce paket, kullanıcı doğrular | ☐ | |
| Gizli anahtar/parola hiçbir dosyaya girmez | ☐ | |

## Benim eklediklerim (istek 21–22)

| Ek | Durum | Not |
|---|---|---|
| Senaryo seçimi: Stoktan Satış, Hizmet Satışı, Serbest Meslek Makbuzu, Satıştan İade / Stoğa Mal Alışı, Hizmet ve Gider Alışı, Alıştan İade | ◐ | |
| Gider türleri (Kira, Elektrik…, Demirbaş → 255, Reklam → 760) | ◐ | |
| Serbest Meslek Makbuzu: brüt, stopaj (193), KDV; netten brüte hesap | ◐ | |
| Taslak / Proforma (deftere dokunmaz, numarasız) | ◐ | |
| Döviz ve kur (deftere TL karşılığı) | ◐ | |
| Genel iskonto | ◐ | |
| İrsaliye ve sipariş no/tarih | ◐ | |
| Çek cirosuyla alış ödemesi | ◐ | |
| Kopyala; faturadan İade Oluştur (kalan miktar kadar) | ☐ | |
| VUK sıra-tarih uyumu; ileri tarihli fatura yok | ☐ | |
| Ödeme durumu (FIFO kapama: Ödendi/Kısmen/Açık/Vadesi Geçti) ve yaşlandırma | ☐ | |
| Raporlar: Satış/Alış/İade Faturaları, KDV Özeti, Ba-Bs, Ürün Bazında Satış ve Kârlılık, Gider Raporu, Stopaj | ☐ | |
| WhatsApp ile fatura gönderme | ☐ | |
| Fatura Ayarları: firma bilgisi, e-Dönüşüm, seriler, sonraki numara, varsayılanlar, IBAN | ☐ | |
| Toplu PDF / Excel / XML | ☐ | |
| Vade Takip ve ANLIK DURUM'a açık faturalar | ☐ | |
| Nihai tüketici (TCKN 11111111111) | ☐ | |
| Cari Excel aktarımında Vergi No, Vergi Dairesi, İl, İlçe kolonları | ☑ | `mapAccountHeaders` |

## Kararlar (sorulacak yerde verdiğim karar)

Teslimde maddeler halinde yazılır. Şimdiye kadar:

- EDM sözleşmesi ezberlenmez: program ilk bağlantıda EDM sunucusunun WSDL'ini (`?singleWsdl`) okur; SOAPAction, ad
  alanı, SOAP sürümü ve alan sırası oradan gelir. Sözleşmede olmayan zorunlu alan varsa istek hiç gönderilmez, hangi
  alan olduğu söylenir. WSDL alınamazsa i2i varsayılanıyla çalışılır. (Neden: EDM belge sitesi bu ortamdan erişilemedi;
  canlı adres ve SOAPAction kesin bilinmiyor — tahminle göndermek yerine sunucunun kendi sözleşmesi esas.)
- EDM'de Logout çağrılmaz: EDM belgesine göre Logout aynı kullanıcının başka yerlerdeki oturumlarını da kapatır. Oturum
  bellekte tutulur; "Aktif session bulunamadı" (10011) gelince bir kez yeniden giriş yapılıp istek tekrarlanır.
- e-Fatura ve e-Arşiv aynı SendInvoice ile gider (EDM belge türünü UBL ProfileID'den anlar); sözleşmede
  INVOICE/HEADER/EARCHIVE varsa işaret konur. e-Arşivde UBL'e GİB "gönderim şekli" (SendingType: ELEKTRONIK/KAGIT) yazılır.
- UBL'e `cac:Signature` (imzalayan taraf) eklenir; imzayı EDM mali mühürle atar, program imza anahtarı tutmaz.
- Entegratör parolası veritabanında AES-256-GCM ile şifreli; anahtar veri klasöründe ayrı dosyada, yedeğe girmez.
  Ekrana ve günlüğe parola çıkmaz.
- Gönderimde EDM reddederse durum "Hata" olur (düzeltilip yeniden gönderilir); bağlantı koparsa durum değişmez (aynı ETTN
  ikinci kez kabul edilmez; önce Durum Sorgula). Aynı belgeye eşzamanlı iki gönderim engellenir.
- e-Arşiv iptali: önce programdaki iptal denenir ve geri alınır (iade, kilitli dönem, tahsil edilmiş çek, stok…), geçerse
  EDM'de iptal edilir, sonra programda. Gönderilmiş e-Fatura entegratörden iptal edilmez (alıcı reddi / iade faturası).
- Gelen e-Fatura: çekilenler okundu işaretlenir; "Alış Faturası Olarak Al" taslak açar (cari VKN ile bulunur ya da
  açılır, kalemler stok kartına kod ya da adla eşlenir, toplam belgeyle karşılaştırılır). Taslak silinirse belge yeniden
  "Yeni" olur.
