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
| 5 | Entegratör Adaptör Katmanı (Logo, İzibiz, Digital Planet, QNB e-Finans, GİB) + PEPPOL/UBL | ☐ | |
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
| 24 | Gerçek anlamda test (süslü söz değil): `motor.mjs` — otonom, acımasız test motoru | ☐ | |
| 24a | Differential testing: bağımsız (harici kurallarla yazılmış) model binlerce rastgele işlem üretir (fatura, tahsilat, ödeme, çek giriş/çıkış, iade, düzeltme, silme); her adımda SQLite / Ana Defter çıktısı modelle kuruşu kuruşuna karşılaştırılır; ilk sapmada durur | ☐ | |
| 24b | Atomiklik ve ROLLBACK: zincirin bir adımında kasıtlı hata (stok yetersiz, Kasa eksi yasağı, çek doğrulama hatası); hiçbir yarım kayıt kalmaz; Kasa, Cari, Stok, Taksit, Çek/Senet tabloları işlem öncesine birebir döner | ☐ | |
| 24c | Çapraz senkron: bir kısmı nakit, bir kısmı taksit/vade, kalanı çek/senet olan fatura; tüm alt defterler ↔ cari bakiye mutabakatı | ☐ | |
| 24d | Saha hataları: boş rapor (veri varken boş dönen sorgu), kapalı döneme / kilitli tarihe / işlem tarihinden önceye vade-çek tarihi girişimleri reddedilir; mükerrer fatura no / UBL ETTN çakışması | ☐ | |
| 24e | Test scripti koşturulur, tüm senaryoların yeşil olduğu raporlanır | ☐ | |

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

Teslimde maddeler halinde yazılır.
