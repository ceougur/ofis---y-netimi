# Fatura Modülü (2.0.15) — İstek Kontrol Listesi

Kullanıcının bu sürümdeki her isteği, yapılan iş ve kanıtı. Modül bitmeden her satır "Tamam" ve kanıtlı olmalı
(CLAUDE.md, şikâyet 4: "Dediklerimi gerçekten yap").

Durum: ☐ yapılmadı · ◐ sürüyor · ☑ tamam (kanıt yazılı)

## Kullanıcının açık istekleri

| # | İstek (kullanıcının sözü özetle) | Durum | Yapılan iş / kanıt |
|---|---|---|---|
| 1 | Menüdeki "Yeni Kayıt" kalksın; tablo başlığında Dışa Aktar'ın yanına "Yeni Kayıt" | ☑ | cdebfa3; `test/e2e/run.mjs` (#hof-toolbar-new, Dışa Aktar'ın solunda) |
| 2 | Soldaki sabit menüye "Fatura" menüsü | ☑ | `hof-workspace.js SIDE_ITEMS` (Cari, Kasa, Stok, Fatura, Çek / Senet, Taksitler); `senaryo-215` kurulum adımı menü sırasını denetler |
| 3 | Satış/alış faturası: stok miktarı ve maliyeti, cari borç/alacak, vadeli/taksitli → Taksit; hepsi tek atomik işlem (BEGIN IMMEDIATE/COMMIT/ROLLBACK) | ☑ | `writeIssued` tek `store.tx` (BEGIN IMMEDIATE) + mutabakat kapısı; `motor.mjs fatura-acid` (3. kalemde stok hatası, Kasa engeli, mükerrer çek → hiçbir satır kalmaz); QA D6/D7; `senaryo-215` adım 3–4 (stok 100→90, cari 320, Kasa +100, taksit 320) |
| 4 | GİB UBL-TR XML; KDV %1/%10/%20; tevkifat; KDV dahil/hariç; kuruş hassasiyeti; e-Arşiv / e-Fatura (Temel/Ticari); VKN/TCKN/MERSİS/adres/tüzel-gerçek doğrulaması | ☑ | `server/lib/invoice-math.mjs`, `server/lib/tax-id.mjs`; `invoice-math.mjs` (KDV %0/1/10/20, tevkifat kodları, istisna, KDV dahil/hariç, kuruş), `tax-id.mjs` (VKN/TCKN denetim hanesi, MERSİS, IBAN), `einvoice/ubl-tr.mjs` (UBL-TR 1.2), `allowedProfiles` (Temel/Ticari/e-Arşiv GİB kuralı); QA F3.4, F3.5, F6.1, F6.2, F7, N4; `test/fatura-model.test.mjs` |
| 5 | Entegratör Adaptör Katmanı (Logo, İzibiz, Digital Planet, QNB e-Finans, GİB) + PEPPOL/UBL | ◐ | Tek arayüz (`server/lib/einvoice/adapters.mjs`); kullanıcı kararıyla şimdilik yalnız EDM Bilişim (istek 33); PEPPOL çıktısı `buildUbl(…, { variant: "peppol" })` |
| 6 | Fatura tarihi kilitli döneme ve yanlış zaman aralığına girmez; cari/stok kilitleri denetlenir | ☑ | `lib/period.mjs` (ileri tarih yok, dönem kilidi 409 `period-locked`), seri kronolojisi (`chronology`); `motor.mjs kilit-ihlali` (fatura-kes/iptal/iade), `tarih-hatasi`; `senaryo-215` adım 9 (`date-future`); QA F8.4, N5 |
| 7 | Kesme / iptal / iade sonrası Kasa, Stok, Cari, Taksit (ve Çek/Senet) ↔ Ana Defter mutabakatı | ☑ | `server/lib/integrity.mjs` fatura denetimleri; `lib/integrity.mjs` fatura denetimleri; `motor.mjs` her işlemden sonra Kasa, cari, stok, taksit, fatura, çek/senet ↔ mizan; `senaryo-215` adım 8 (iade → satış iptali, her şey geri, kapı ok); QA D6, D7, E2, E3 |
| 8 | Cari kartının üstünde "Alış Faturası" ve "Satış Faturası" pilleri; tıklayınca ilgili yere gider | ☑ | Cari kartında `saleInvoice` / `purchaseInvoice` pilleri (`hof-accounts.js`); `senaryo-215` adım 4 (pilden açılan formda cari dolu); ekran `cari-karti-pilleri.png` |
| 9 | Panelde "Alıştan İade" ve "Satıştan İade"; Kasa, cari, çek, senet ve gereken her yere entegre | ☑ | Senaryolar Satıştan İade / Alıştan İade; kartta İade pili; para Kasa'dan ya da cari borcundan, taksit kartı küçülür, çek/senet geri alınır; `senaryo-215` adım 5 (2 Paket = 84; stok 92, müşteri 236, kart 236); `motor.mjs fatura-iade`; QA F3.1, E3 |
| 10 | İade edilecek faturayı bulan arama motoru en üstte | ☑ | Formun en üstünde iade arama (`[data-return]`, `li[data-original]`, `.hof-inv-return-chosen`); `senaryo-215` adım 5 |
| 11 | Fatura ekranlarında Not; faturanın altına not olarak basılır | ☑ | Form alanı Not (Belgenin Altına Basılır); PDF `invoice-pdf.mjs` "Not: …" satırı; QA F12, F14 (not basılı) |
| 12 | Fatura tarihi ve saati | ☑ | Form: Tarih + Saat (`issue_date`, `issue_time`); PDF "Tarih / Saat"; QA F9 |
| 13 | Kesilen faturaları görüntüleme, süzme ve seçme | ☑ | Liste sekmeleri, dönem/ödeme durumu/belge türü/cari/metin süzgeçleri, satır kutularıyla seçim ve seçim çubuğu; QA F1.1, F1.2, F16; `senaryo-215` adım 8 (İptal Edilenler sekmesi), 13 (seçim) |
| 14 | Fatura kartında 2 pil | ☑ | Kartta iki büyük pil: **Cari Kartı** ve **İade** (iadede **Asıl Fatura**); `hof-invoices.js renderCard .hof-inv-big-pill`; `senaryo-215` adım 5–6 |
| 15 | Cari ve ürün girilince: bu ürünün bu cariye ve başka carilere son satış / son alış fiyatı kendiliğinden görünür | ☑ | `GET /invoices/last-prices` (bu cariye son satış/alış + başka carilere son fiyatlar, iskontolu KDV hariç TL ve KDV dahil karşılığı); formda kalemin altında, tıklayınca fiyata yazılır; kılavuz ekranı `k24-fatura-formu.jpg`; QA F2.1 |
| 16 | Sorulacak yerlerde öneriyle karar ver; bitince kararları maddeler halinde yaz | ☑ | Teslim mesajı + bu belgenin "Kararlar" bölümü; Bu belgenin "Kararlar" bölümü (aşağıda, tam liste) + teslim mesajı |
| 17 | Uzman UI, UX, baş mühendis, baş mimar gözüyle | ☑ | `docs/FATURA-KARSILASTIRMA.md` (kaynak araştırması), `docs/FATURA-QA-RAPORU.md` (64 test, ISO 25010/ISTQB; UX U1–U9, duyarlı tasarım, klavye, hata mesajları), `senaryo-215` ekran görüntüleri |
| 18 | Çek/Senet: fatura anında portföye (satış) ya da verilen evraka (alış); cari mahsup; aynı işlem; çek tarihleri kronolojik; mutabakat Çek/Senet'i kapsar | ☑ | `routes/cheques.mjs` invoiceCheques; `routes/cheques.mjs invoiceCheques` (portföy/verilen evrak/ciro, iptalde `voidFor`); evrak tarihleri belge tarihinden önce olamaz (`cheque-due-before-issue`); `senaryo-215` adım 7 (çekli satış, çek kartından faturaya); `motor.mjs cek-tahsil / cek-ode`, mix ödemeler; QA D6 |
| 19 | Diğer bütün bölümlerle ve raporlarla entegre, doğru mantık | ☑ | QA entegrasyon matrisi (Cari, Kasa, Taksit, Stok, Çek/Senet, Vade Takip, Raporlar, Ana Defter ✅); `senaryo-215` adım 6 (stok, Kasa, taksit kartı → fatura bağları), 10 (raporlar); Kasa satırı "Faturadan" (B4 düzeltmesi); WhatsApp ekstre cari defterinden; Silinenler: fatura silinmez, iptal edilir |
| 20 | Cari kaydında vergi dairesi, vergi numarası ve fatura için gereken bütün alanlar | ☑ | göç 18 cari alanları, `taxInput`; Göç 18 cari alanları (vergi dairesi/no, MERSİS, ad-soyad, adres, il/ilçe, e-posta, IBAN, vade günü, e-Fatura/PK), `taxInput`, Mükellef Sorgula; Excel aktarımında Vergi No / Vergi Dairesi / İl / İlçe |
| 21 | Belirtilmeyen ama fatura modülünde olması gereken her şey | ☑ | Aşağıdaki "Benim eklediklerim"; "Benim eklediklerim" tablosu (aşağıda, hepsi kanıtlı) |
| 22 | Hizmet faturası, stoktan satış… tüm sektörlere; hem alış hem satış; kullanıcı en başta seçip ilerler; daha iyi alternatif varsa o | ☑ | Senaryolar (`SCENARIOS`); `SCENARIOS` (8 senaryo); satış ve alış tarafı; senaryo en başta seçilir (`senaryo-215` adım 3, ekran `senaryo-secimi.png`) |
| 23 | İstekleri yeniden gözden geçir, eksik kalmasın | ☑ | Bu liste 02.10.2026'da yeniden gözden geçirildi; açık satır kalmadı |
| 25 | Entegratör: müşteri entegratörle (Logo, İzibiz, Digital Planet, QNB e-Finans…) kendi sözleşir, kontörü kendisi alır; programa API kullanıcı bilgilerini girip kaydeder; program e-Fatura/e-Arşiv'i doğrudan entegratöre gönderir, durumunu sorgular, gelen faturaları çeker (biz aracı değiliz) | ☑ | Fatura Ayarları → e-Belge Bağlantısı (kullanıcı adı, parola şifreli, ortam, servis adresi, gönderici etiketi, otomatik gönderim); gönder / durum / iptal / gelen kutusu uçları; `test/einvoice-edm.test.mjs` (program uçları bölümü) |
| 26 | Kesilen, alınan, iptal edilen (ve taslak, iade) faturaları görüntüleme | ☑ | Fatura ekranı sekmeleri; Sekmeler: Satış, Alış, İadeler, Taslaklar, İptal Edilenler, Tümü (+ Gönderilecekler, Gelen Kutusu); `senaryo-215` adım 8, 11 |
| 27 | Müşteri isterse e-Fatura isterse e-Arşiv kesebilmeli | ☑ | Belge türü seçilir; GİB kuralına aykırı seçim nedeniyle engellenir (`allowedProfiles`) — bağlantı açılınca görünür; `allowedProfiles` + belge türü seçimi (e-Belge açıkken); `test/einvoice-edm.test.mjs` e-Fatura ve e-Arşiv kesme testleri |
| 28 | Vergi dairesiyle henüz entegre etme; "entegre et" diyene kadar resmî hükmü olmayan müşteri fişi | ☑ | `config.edocEnabled` false; PDF başlığı "Müşteri Fişi" + "resmî fatura yerine geçmez"; `config.edocEnabled` false; PDF başlığı "MÜŞTERİ FİŞİ" + "Bu belge bilgi amaçlıdır; resmî fatura yerine geçmez"; `test/einvoice-edm.test.mjs` "e-Belge kapalıyken" bölümü (404); QA F15 |
| 29 | Entegratör ayarlarına devam et, her şey hazır olsun (kapalı dursun) | ☑ | Altyapı tam (adaptör, UBL, gelen kutusu, Kes-Sonra-Gönder); kapalı dursa da testlerle yeşil |
| 30 | Özellikle EDM Bilişim entegratörünü kusursuz hazırla (kullanıcı onunla çalışmayı düşünüyor) | ☑ | `server/lib/einvoice/edm.mjs`, `soap-contract.mjs`; `test/einvoice-edm.test.mjs` (19 test, sahte EDM sunucusu); `edm.mjs` + `soap-contract.mjs`; `test/einvoice-edm.test.mjs` 22 test; gerçek EDM hesabıyla prova hesap alınınca (QA A2) |
| 33 | Entegratör şimdilik yalnız EDM Bilişim; anlaşılamazsa anlaşılan entegratöre göre yapılır | ☑ | `ADAPTERS = { edm }`; İzibiz istemcisi 167eefa'da arşivde |
| 31 | Modül bitince yalnız proje sahibine özel, deneyimsiz birinin anlayacağı dilde ayrıntılı kullanım kılavuzu; entegrasyonun nasıl yapılacağına kadar | ☑ | Müşteri kılavuzuna girmez; `docs/` altında ve PDF; `docs/kilavuz/FATURA-SAHIP-KILAVUZU.html` (+ PDF, 9 sayfa, teslimde): modül, ayarlar, akış, ödeme, iade/iptal, raporlar, yasal kurallar, yetkiler, entegrasyon adımları ve sorun giderme, sözlük |
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
| Yazım düzeni: ekranda/PDF'te/Excel'de her ad Başlık Yazımıyla | ☑ | `test/yazim-duzeni.test.mjs` (kaynak) ve `senaryo-211` (ekran) yeşil; fatura adları Başlık Yazımıyla (Seçilenleri Kes, Fiyat Farkı Faturası, Teslim Alan…) |
| Kılavuz: yalnız kısa "nasıl yapılır" | ☑ | Kılavuz 12. bölüm "Fatura" (hap bilgi; sürüm/teknik yok); ayrıntı proje sahibi kılavuzunda |
| İş akışı testi: arayüzden, sıfırdan, sayılarla (bakiye, Kasa, stok, KDV) | ☑ | `senaryo-215` 14 adım / 73 denetim (stok 100→90→92→89→99, cari 320/236/0, Kasa +100/0, KDV toplamları) |
| Boş veri; sıralama (cari önce / ürün önce / fatura önce); aynı adlı iki cari | ☑ | `senaryo-215` adım 1 (boş liste), 2 (cari önce, aynı adlı iki Ayşe Demir), 7 (aynı adlı ikinci müşteriye satış); `motor.mjs` rastgele sıralamalar |
| Raporlar: boş dönem, tek kayıt, geçmiş/gelecek tarih, ileri tarihli hareket, yetkisiz kullanıcı | ☑ | `senaryo-215` adım 1 (boş dönem), 9 (ileri tarih ret, personel 403 ve menüde görünmez), 10 (bu ay = geçerli satış sayısı, geçen yıl boş); QA R1–R3, F17 |
| Yayın yok: önce paket, kullanıcı doğrular | ☑ | Teslim paketi `dist/teslim-2.0.15/` (OKU-BENI.txt); PR ve yayın kullanıcı onayıyla |
| Gizli anahtar/parola hiçbir dosyaya girmez | ☑ | Entegratör parolası `secret-box` ile şifreli, ekrana/günlüğe çıkmaz (`test/einvoice-edm.test.mjs` "Ayarlar" testi); imza anahtarı depoda yok (`docs/SURUM-YAYIMLAMA.md`) |

## Benim eklediklerim (istek 21–22)

| Ek | Durum | Not |
|---|---|---|
| Senaryo seçimi: Stoktan Satış, Hizmet Satışı, Serbest Meslek Makbuzu, Satıştan İade / Stoğa Mal Alışı, Hizmet ve Gider Alışı, Alıştan İade | ☑ | `SCENARIOS` (+ Fiyat Farkı Faturası); `senaryo-215` adım 3 |
| Gider türleri (Kira, Elektrik…, Demirbaş → 255, Reklam → 760) | ☑ | `EXPENSES` + `lineAccount`; Gider Raporu (Türüne Göre); QA E7.2 |
| Serbest Meslek Makbuzu: brüt, stopaj (193), KDV; netten brüte hesap | ☑ | `grossFromNet`, stopaj alıcı tüzel kişiyse; `motor.mjs` smm belgeleri; QA F3.1; Stopaj ve Tevkifat Özeti |
| Taslak / Proforma (deftere dokunmaz, numarasız) | ☑ | QA F3.2 (PROFORMA başlığı, deftere dokunmaz); `motor.mjs fatura-taslak` |
| Döviz ve kur (deftere TL karşılığı) | ☑ | QA D5 (1.000 USD, kur 34,2512 → TL); `try_*` kolonları |
| Genel iskonto | ☑ | QA F6.2 (satır + genel iskonto + tevkifat birlikte); `fatura-model.test.mjs` |
| İrsaliye ve sipariş no/tarih | ☑ | QA F3.3; PDF başlık kutusunda Sipariş / İrsaliye satırları |
| Çek cirosuyla alış ödemesi | ☑ | `payment.endorse`; `motor.mjs paymentFor` (alışta portföyden ciro); QA D6 |
| Kopyala; faturadan İade Oluştur (kalan miktar kadar) | ☑ | Kartta Kopyala ve İade pili; `returnable` ucu; `senaryo-215` adım 5 |
| VUK sıra-tarih uyumu; ileri tarihli fatura yok | ☑ | QA F8.1, F8.4, N5; `senaryo-215` adım 9; `motor.mjs` seri boşluksuz + tarih sırası denetimi |
| Ödeme durumu (FIFO kapama: Ödendi/Kısmen/Açık/Vadesi Geçti) ve yaşlandırma | ☑ | `lib/invoice-settle.mjs`; QA E1, E9, F11; Açık Faturalar ve Yaşlandırma raporu |
| Raporlar: Satış/Alış/İade Faturaları, KDV Özeti, Ba-Bs, Ürün Bazında Satış ve Kârlılık, Gider Raporu, Stopaj | ☑ | `routes/report-center.mjs` (9 fatura raporu); `motor.mjs` raporlar = model; QA E7.2; `senaryo-215` adım 10 |
| WhatsApp ile fatura gönderme | ☑ | Kartta WhatsApp (PDF iner + mesaj); `senaryo-215` kartta düğme; QA F14 |
| Fatura Ayarları: firma bilgisi, e-Dönüşüm, seriler, sonraki numara, varsayılanlar, IBAN | ☑ | `settingsInput`; `senaryo-215` adım 11 (firma bilgisi), 14 (logo, kaşe/imza); `test/einvoice-edm.test.mjs` ayarlar testi |
| Toplu PDF / Excel / XML | ☑ | Seçim çubuğu: toplu.pdf, export.xlsx, ubl.zip; QA F1.2, F16 |
| Vade Takip ve ANLIK DURUM'a açık faturalar | ☑ | QA E6 (yaklaşan / gecikmiş); `overview` Toplam Alacak/Borç; sağ alt bildirimler |
| Nihai tüketici (TCKN 11111111111) | ☑ | `ANONYMOUS_TCKN`; e-Arşiv 30.000 TL üstü gerçek kimlik (FATURA-KARSILASTIRMA); QA N4 |
| Cari Excel aktarımında Vergi No, Vergi Dairesi, İl, İlçe kolonları | ☑ | `mapAccountHeaders` |
| QA sonrası (02.10.2026): formda "+ Yeni Cari" | ☑ | `senaryo-215` adım 12 |
| QA sonrası: toplu kesme / toplu iptal (seçim çubuğu) | ☑ | `test/fatura-215.test.mjs`, `senaryo-215` adım 13 |
| QA sonrası: PDF'te logo (Fatura Ayarları) ve kaşe / imza kutuları | ☑ | `test/fatura-215.test.mjs`, `senaryo-215` adım 14 |
| QA sonrası: kartta E-Posta (PDF + mailto) | ☑ | `senaryo-215` adım 12 |
| QA sonrası: fatura kalemine bağlı stok kartı silinmez | ☑ | `test/fatura-215.test.mjs` |
| QA sonrası: Fiyat Farkı Faturası senaryosu | ☑ | `test/fatura-215.test.mjs` |
| Fatura ↔ icra dosyası doğrudan bağ | ☒ | Kullanıcı kararı (02.10.2026): "cariyi ekleyerek kesebilir müşteri"; yapılmayacak |

## Kararlar (sorulacak yerde verdiğim karar)

Teslimde maddeler hâlinde yazıldı (02.10.2026). Tam liste:

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
- Senaryo önce seçilir (müşteri: "en başta seçip ilerlesin"): sekiz senaryo; stok, KDV ve ödeme kuralları senaryodan
  gelir. Yaygın programlardaki "belge türü seç → form" kalıbı korundu.
- e-Belge kapalıyken belge adı "Müşteri Fişi" ve altında "resmî fatura yerine geçmez" ibaresi (resmî fatura ancak matbu
  forma ya da e-Belge olarak düzenlenir; programın kâğıt çıktısı yasal fatura sayılmasın).
- Kendi serimizde numara elle değiştirilemez; alış ve müşterinin kestiği iade faturasında elle numara (karşı tarafın belgesi).
  Müşteri iade faturası kesmediyse program "IAD" iç serisinden numara verir.
- Kesilen belge düzeltilmez (yasal belge): yanlışsa iptal ya da iade. Taslak düzenlenir. İptalde numara korunur.
- Tekrarlayan fatura kendiliğinden kesilmez, taslak hazırlar (kesilen belge geri alınamaz).
- Fatura ↔ icra dosyası doğrudan bağ yapılmadı (kullanıcı kararı 02.10.2026: "cariyi ekleyerek kesebilir müşteri").
- "Kes, Sonra Gönder"de resmî numara gönderim anında verilir (GİB serisinde boşluk kalmasın); "Listeden Sil" etkileri geri
  almaz (kullanıcı kararı), belge Müşteri Fişi numarasıyla kalır ve sonra yine gönderilebilir.
- Toplu kesme tarih sırasıyla (eski önce), toplu iptal en yeni önce (iade asıl belgeden önce); her belge kendi işleminde,
  biri düşerse diğerleri sürer; başarısızlar seçili kalır. En çok 200 belge.
- Logo yalnız JPEG (tarayıcı her görseli çevirir), ≤150 KB ve ≤1200 px; belgeye kopyalanmaz (seller_json'a girmez), PDF
  güncel logoyu basar; alış ve müşterinin iade faturasında basılmaz (karşı tarafın belgesi). Kaşe/imza kutuları varsayılan
  açık, ayardan kapanır; alış belgesinde basılmaz.
- E-Posta gönderimi tarayıcının mailto'suyla (PDF indirilir, ek elle); SMTP ayarı istenmedi, şifre tutulmaz.
- Fatura kalemine bağlı stok kartı silinmez (409); önce fatura iptal edilir ya da iade kesilir.
- "Fiyat Farkı Faturası" ayrı tür değil satış senaryosu (stoksuz kalem); Ana Defter 600.
- Nihai tüketici için TCKN 11111111111 kabul; e-Arşiv'de 30.000 TL üstü gerçek kimlik ve adres zorunlu.
- VUK 231 (7 gün) uyarır, engellemez; e-Arşiv iptali 8 günle sınırlı; ileri tarih reddedilir.
- Cari ödemeleri faturalara FIFO ile (en eski açık belgeden) sayılır; taksitli belge taksit kartından izlenir.
- Çek/senet evrak tarihleri belge tarihinden önce olamaz; alış ödemesinde portföyden ciro mümkün.
- Personel Fatura menüsünü görmez (CSS kuralı + sunucu 403); yetki üçlüsü view / manage / settings.
- QA'da çıkan mantık hataları (B1–B4) yayından önce düzeltildi; A1 kullanıcı kararıyla kapsam dışı, A2 hesap gerektirir.
- Gelen e-Fatura: çekilenler okundu işaretlenir; "Alış Faturası Olarak Al" taslak açar (cari VKN ile bulunur ya da
  açılır, kalemler stok kartına kod ya da adla eşlenir, toplam belgeyle karşılaştırılır). Taslak silinirse belge yeniden
  "Yeni" olur.
