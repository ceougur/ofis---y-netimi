# DestekOfis — ERP Yol Haritası

**Durum: YALNIZ PLAN (21.10.2026).** Kod değişmez. Her adım, kullanıcı "başla" deyince ayrı bir sürüm olarak yapılır. Bu klasör (`docs/erp/**`)
BELGE_YOLLARI'nda: plan değişince CI koşmaz.

**Kaynak.** Kullanıcı, 21.10.2026: "ilerleyen dönemlerde kademeli olarak bunları yapalım, bunu şimdilik erp yol haritası olarak bir dosya yap içine koy.
adım adım gideriz. seninle benim anayasamıza uygunsa." Altı madde, kullanıcının paylaştığı dış değerlendirmeden (ekran görüntüsü):

1. Depo modülü (çoklu depo, transfer, depo bazlı stok)
2. Teklif → Sipariş → Satış Faturası
3. Bilanço + Gelir Tablosu
4. Tam genel muhasebe motoru (yevmiye, kebir, mizan)
5. Şirket sınırının açılması (2'den fazla şirket)
6. Resmî defter + beyanname derinliği

"Bugün kodda" bilgileri 21.10.2026 kodundan (3f6abc8) okundu. Her adım başlarken D0'da yeniden doğrulanır; satır numaraları kayabilir.

## 1. Anayasaya uygunluk

UYGUN, şu koşullarla:

- Vizyon ve sıra kullanıcınındır (Anayasa §1). Bu belge baş mimarın önerisidir.
- Verilmiş sözler önce gelir: 2.4.4 (e-SMM ve öbürleri), sonra 2.5.0 Devir Modülü. Devir Ocak–Şubat'ta kullanılır; 2.5.0 Aralık başına kadar
  yayında olmalı. ERP adımları 2.5.0'dan sonra başlar.
- Kalite çıtası: Logo, Mikro, Netsis ve uluslararası yaygın programların yerleşik çözümü. "Çalışıyor" yetmez.
- Her adımın akışı:
  1. D0: plan koda ve mevzuata karşı yeniden doğrulanır (GİB kaynağı; gerektiğinde mali müşavir).
  2. Ayrıntılı plan `docs/erp/<adım>.md` yazılır; devir planı gibi tek başına yeterli olur.
  3. Kullanıcı onaylar.
  4. Kod yazılır. Test kuralı, KANIT KURALI ve dersler 1–36 tam uygulanır; teslim düzeni aynen.
- Para, stok ya da defter çekirdeğine dokunan adımlarda (E1, E3–E6) ayrıca: bağımsız Python kâhini (ders 5), mutasyon testi, dar kontrol (ders 32),
  eski sürümlerin gerçek verisiyle göç (ders 17).
- Eski veri bozulmaz. Her göç geriye uyumludur; eski kayıtlar olduğu gibi kalır.
- Standart/Pro kuralı geçerli: her özellik varsayılan olarak herkese gider. "Pro'ya özel" ve fiyat etkisi kullanıcının kararıdır.

## 2. Bugünkü durum (özet)

| Madde | Bugün kodda |
| --- | --- |
| 1 Depo | YOK. Tek depo; maliyet son alış fiyatı; sayım ve transfer yok. |
| 2 Teklif → Sipariş → Fatura | KISMİ. Taslak fatura "PROFORMA" basılıyor; sipariş ve irsaliye yalnız faturada alan; dönüştürme ve e-İrsaliye yok. |
| 3 Bilanço + Gelir Tablosu | YOK. Mizanda 6'lı ve 7'li hesaplar var, tablo yok; 621, amortisman ve tahakkuk yok. |
| 4 Genel muhasebe motoru | BÜYÜK ÖLÇÜDE VAR. Çift taraflı defter, "Yevmiye Defteri", "Hesap Planı Mizanı", dönem kilidi. Eksik: elle fiş, kebir, hesap planı düzenleme, madde numarası. |
| 5 Şirket sınırı | Tek sabit (2); lisansa bağlı değil. |
| 6 Resmî defter + beyanname | KISMİ. KDV Özeti, KDV Mahsup Fişi, Ba-Bs listesi, Stopaj Özeti var. e-Defter, mali müşavire aktarım ve beyanname dosyası yok. |

## 3. Önerilen sıra

Neden bu sıra: defter bütün öbür adımların temelidir. Stok maliyeti hem bilançonun hem deponun ön koşuludur. Satış zinciri depodan düşer.

| Adım | Madde | Kapsam (kısa) | Ön koşul | Kaba büyüklük |
| --- | --- | --- | --- | --- |
| E1 | 4 | Elle Mahsup Fişi, Kebir ve hesap ekstresi, düzenlenebilir hesap planı, kalıcı yevmiye madde numarası | 2.5.0 | Büyük |
| E2 | 6 (ilk adım) | Mali Müşavire Aktarım | E1 | Orta |
| E3 | 1 ve 3'ün ön koşulu | Stok maliyet yöntemi, Envanter Sayımı, dönem sonu stok değerlemesi (621) | E1 | Orta–Büyük |
| E4 | 3 | Bilanço ve Gelir Tablosu; Demirbaş ve amortisman; tahakkuk; dönem kâr/zararı | E1, E3, 2.5.0 | Büyük |
| E5 | 1 | Depo modülü: çoklu depo, transfer, depo bazlı stok ve sayım | E3 | Büyük |
| E6 | 2 | Teklif → Sipariş → İrsaliye → Fatura; alış tarafı; rezervasyon; e-İrsaliye ayrı alt adım | E5 | Çok büyük |
| E7 | 6 (kalanı) | Beyanname düzenleri, resmî defter dökümü; e-Defter yalnız talep olursa | E1, E4 | Büyük (e-Defter: Çok büyük) |
| — | 5 | Şirket sınırı | Kullanıcı kararı (K3) | Teknik olarak küçük |

Büyüklükler kabadır; D0'da netleşir. E5 ve E6'nın zamanı hedef müşteri kararına bağlıdır (K2).

## 4. Adımlar

### E1 — Muhasebe motorunu tamamla (madde 4)

BUGÜN KODDA:

- Ana defter saklanmıyor; her istekte alt defterlerden aynı kuralla türetiliyor (mimari karar: `server/lib/general-ledger.mjs:3-6`; `journal()` :157).
  Kimlikler de türetiliyor (`cash:<id>`); kalıcı madde ya da fiş numarası yok.
- Hesap planı koda gömülü ve değiştirilemez: 38 Tek Düzen hesabı (`CHART`, Object.freeze, :15). Şu hesaplar yok: 621, 150–152, 157, 180/280, 257,
  335, 361, 380/381, 590/591, 690–692.
- Deftere yazanlar: Kasa, Banka Fişi, POS, fatura (satış, alış, iadeler, SMM), çek/senet, taksit, vergi ödemesi, KDV mahsubu, stopaj, şüpheli alacak
  (general-ledger.mjs:189-398). Kasa çıkışı her zaman B 770'e gidiyor; hesap seçilemiyor.
- Elle mahsup fişi yok. `server/routes/ledger.mjs` yalnız okuma, kilit ve bütünlük uçlarını veriyor (:320-354). Gizli ve dar bir "Elle Banka Fişi"
  arka ucu var (`server/lib/bank/vouchers.mjs:70, 194-217`).
- Rapor Merkezi'nde VAR: "Yevmiye Defteri" (madde numarası ve hesap süzgeci yok), "Hesap Planı Mizanı", "Alt Hesap Mizanı", "Defter Mutabakatı"
  (`server/routes/report-center.mjs:627-720, 919-941`). YOK: Kebir (büyük defter, muavin) ve Tek Düzen hesap ekstresi.
- Dönem kilidi VAR: tek tarih; kilitli döneme yazım 409 alır (`server/lib/period.mjs:30-38, 70-76`). Yıl kapanışı YOK; 2.5.0 devir planı karşılar.

YAPILACAK:

- "Mahsup Fişi" (elle yevmiye fişi). Türetilmiş mimari korunur; elle fiş yeni bir alt defter olur. Örneği zaten var: Banka Fişi ve KDV mahsubu
  satırları saklanıyor.
- Kebir ve hesap ekstresi: hesap süzgeciyle; ekran, PDF ve Excel aynı.
- Alt hesap açılabilen hesap planı ve eksik hesaplar. Otomatik eşleme kuralları sabit kalır.
- Kalıcı yevmiye madde numarası: dönem kilitlenince dondurulur. Resmî defter ve aktarım bunsuz olmaz.
- Kasa çıkışında gider hesabı seçimi.

BİTTİ ÖLÇÜTÜ: Her dönemde mizanın borç toplamı alacak toplamına eşit. Kilitli dönemde madde numarası ve tutar değişmez. Bağımsız Python kâhini
yevmiyeyi ve mizanı yalnız plandan yeniden kurar. Mutasyonları testler yakalar.

### E2 — Mali Müşavire Aktarım (madde 6'nın ilk adımı)

BUGÜN KODDA: YOK. Yalnız genel PDF/Excel dışa aktarım var (report-center.mjs:2827-2848).

YAPILACAK: Dönemin fişleri yaygın muhasebe programlarının içe alma biçiminde dışa aktarılır (Luca, Zirve, ETA, Mikro, Logo; biçimler D0'da
doğrulanır). Yalnız kilitli dönem aktarılır; aynı dönem yeniden aktarılınca çift kayıt oluşmaz.

NEDEN ÖNDE: Türkiye'de resmî defteri çoğunlukla mali müşavir kendi programında tutar. Bu adım bugünkü müşterilere de hemen değer katar.

BİTTİ ÖLÇÜTÜ: Örnek dönem, hedef programın gerçek içe alma ekranında hatasız açılır (ders 14 ve 18: gerçek ortam).

### E3 — Stok maliyeti ve sayım (madde 1 ve 3'ün ön koşulu)

BUGÜN KODDA:

- Stok değeri = miktar × son alış fiyatı. Her alışta kart fiyatı yenileniyor (`server/lib/accounts.mjs:163`, `server/routes/stock.mjs:425`).
- Ağırlıklı ortalama ve FIFO yok. Envanter sayımı belgesi yok.
- Satışta 621 satırı yok; defter aralıklı envanter kullanıyor (`server/routes/ledger.mjs:121`).

YAPILACAK:

- Mevzuata uygun maliyet yöntemi (ağırlıklı ortalama ya da FIFO). Yöntem ve VUK dayanağı D0'da doğrulanır.
- "Envanter Sayımı": sayım farkı stoğa ve deftere işlenir.
- Dönem sonu değerleme ve 621 kaydı. Aralıklı envanterle mi, sürekli envanterle mi yapılacağı D0'da kararlaştırılır.

RİSK: Maliyet yöntemi değişince geçmiş dönemlerin kârlılık raporu sayıları değişir. Kilitli dönemler değişmez; kullanıcıya önceden söylenir.

### E4 — Bilanço ve Gelir Tablosu (madde 3)

BUGÜN KODDA:

- Bilanço ve Gelir Tablosu YOK. Bu sözcükler yalnız sektör şablonlarının metinlerinde geçiyor (`server/lib/insight/*`).
- "Anlık Durum" kartı alt defter ekranlarından besleniyor (`server/routes/overview.mjs:1-10`).
- "Ürün Bazında Satış ve Kârlılık" raporu maliyeti son alış fiyatından alıyor (report-center.mjs:2030-2072).
- Demirbaş yalnız gider türü (255). 257, demirbaş kartı ve amortisman YOK. Tahakkuk YOK.

YAPILACAK:

- Tek Düzen düzeninde Bilanço ve Gelir Tablosu; karşılaştırmalı dönem; ekran, PDF ve Excel aynı. Resmî biçim D0'da mevzuattan (MSUGT) doğrulanır.
- "Demirbaş Kartı" ve amortisman fişi (257).
- Tahakkuklar (180/280/380/480).
- Dönem net kâr/zararı (590/591, 690–692).
- Döviz değerlemesi kararı: dövizli fatura bugün açık, kur değerlemesi yok (K6).

BİTTİ ÖLÇÜTÜ: Aktif toplamı pasif toplamına eşit. Gelir tablosunun net sonucu bilançodaki dönem kârına eşit. Bağımsız kâhin plandan aynı sayıları
verir.

### E5 — Depo modülü (madde 1)

BUGÜN KODDA:

- Tek depo: stok tablolarında depo ya da konum kolonu yok (`server/lib/migrations.mjs:618-657`).
- Depolar arası transfer yok.
- Eksi stok kuralı VAR (`server/routes/stock.mjs:377-382`). Stok raporları VAR (report-center.mjs:2426-2523).

YAPILACAK:

- "Depolar" tanımı ve depo bazlı miktar.
- "Depo Transferi": depolar arasında miktar hareketi, fiş yazmaz.
- Depo bazlı sayım ve raporlar.
- Fatura, POS, iade ve Excel yüklemenin hepsinde depo seçimi (ders 9: değişen kodun bütün yolları).
- Eski kayıtlar "Merkez" deposuna göçer.

### E6 — Teklif → Sipariş → İrsaliye → Fatura (madde 2)

BUGÜN KODDA:

- Belge türleri: satış, alış, iki iade, SMM (`server/lib/migrations.mjs:926`).
- Teklif KISMİ: taslak fatura "PROFORMA" başlığıyla basılıyor (`server/lib/invoice-pdf.mjs:31`).
- Sipariş ve İrsaliye yalnız faturada alan olarak var (migrations.mjs:966-969). UBL'e OrderReference ve DespatchDocumentReference olarak yazılıyor
  (`server/lib/einvoice/ubl-tr.mjs:178, 182`).
- Belge dönüştürme ve stok rezervasyonu YOK.
- e-İrsaliye YOK: EDM bağdaştırıcısı yalnız EFaturaEDM.svc'yi biliyor (`server/lib/einvoice/edm.mjs:26-31`).

YAPILACAK:

- "Teklif", "Sipariş" ve "İrsaliye" belgeleri; tek tıkla dönüştürme (Teklif → Sipariş → İrsaliye → Fatura); kısmi teslim.
- Alış tarafı: Satın Alma Siparişi → Mal Kabul → Alış Faturası.
- Siparişte stok rezervasyonu.
- e-İrsaliye ayrı alt adım: EDM e-İrsaliye servisi; zorunluluk kapsamı D0'da doğrulanır.
- İrsaliye–fatura süresi: bugünkü VUK 231 yedi gün uyarısı korunur (`server/routes/invoices.mjs:2292`).

### E7 — Resmî defter ve beyanname derinliği (madde 6'nın kalanı)

BUGÜN KODDA:

- VAR: "KDV Özeti (Beyanname Hazırlığı)" ve "KDV Mahsup Fişi Oluştur" (report-center.mjs:1931-2001).
- VAR: "Ba-Bs Formu" (5.000 TL sınırlı liste, XML yok; :2002-2028) ve "Stopaj ve Tevkifat Özeti" (:2130-2157).
- YOK: e-Defter, XBRL, berat, Defter-Beyan Sistemi; bordro ve SGK (MUHSGK).

YAPILACAK (sırayla; her biri ayrı karar):

- (a) KDV1 ve Muhtasar beyanname düzeninde döküm. GİB'e gönderim yok.
- (b) Ba-Bs dosyası (biçim D0'da doğrulanır).
- (c) Resmî defter dökümü: madde numaralı Yevmiye Defteri, Kebir ve Envanter Defteri; yalnız kilitli dönem.
- (d) e-Defter (XBRL-GL, mali mühür, berat) YALNIZ talep olursa. En büyük hukuki sorumluluk budur; GİB gereklilikleri ve mali müşavir ortaklığı önce
  doğrulanır.

### Madde 5 — Şirket sınırı (karar)

- Sınır tek sabitte: `MAX_COMPANIES = 2` (`server/lib/companies.mjs:30`). Sınırda 409 `company-limit` döner (:327-333). Lisans ya da Pro bağı yok.
  3+ şirketli eski kurulumlar açılır.
- Teknik olarak küçük: sabit, ileti metni ve dört test dosyası değişir (sirket-siniri-225, e2e/senaryo-225, e2e/senaryo-217, guvenilirlik/rastgele).
- Ama bu bir mühendislik kararı değil. Kullanıcının 05.10.2026 kararını ("en fazla 2, Pro dahil") değiştirir ve fiyata bağlıdır. Seçenekler: herkese
  N şirket, ya da lisansla açılan şirket sayısı (lisans belirtecine alan eklenir; orta iş).

## 5. Kör noktalar (dış listede yok)

1. Defter türetiliyor. Resmî defter ve aktarım için kalıcı madde numarası ve kesinleşmiş dönem şart (E1).
2. Maliyet son alış fiyatı. Bilanço ve kârlılık için mevzuata uygun bir yöntem şart (E3).
3. Dövizli fatura açık, kur değerlemesi yok. Bilançodan önce döviz (§3.12) kararı gerekir (K6).
4. İrsaliye / e-İrsaliye ve alış tarafı dış listede yok. Türk ERP'lerinde yerleşik zincir Teklif → Sipariş → İrsaliye → Fatura'dır (E6).
5. Müşterinin defter türü belirleyici. Bilanço, yevmiye ve kebir bilanço esasında zorunlu. İşletme defteri ve serbest meslek kazanç defteri GİB'in
   Defter-Beyan Sistemi'nde tutuluyor (doğrulanacak). Bugünkü müşterilerin çoğu hangi defteri tutuyor? E4 ve E7'nin değeri buna bağlı (K2).
6. Resmî defteri çoğunlukla mali müşavir tutar. Bu yüzden aktarım (E2) öne alındı.
7. Bordro ve SGK yok. Personel gideri tahakkuku ve MUHSGK yapılamaz. 2.4.4'teki Personel Özlük yalnız bilgi tutar (bordro kapsam dışı, kullanıcı
   21.10.2026).
8. Hedef pazar. Depo, sipariş ve irsaliye ticaret ve dağıtım firmalarının ihtiyacı. Bugünkü müşteriler (ofis, emlak, turizm, serbest meslek)
   çoğunlukla bunlara ihtiyaç duymaz. E5 ve E6'dan önce hedef müşteri kararlaştırılmalı (K2). E1–E4 bugünkü müşterilere ve mali müşavirlere de değer
   katar.
9. Ölçek. ERP hacmi (stok satırı, sipariş, depo) için her adımda ölçüm bütçesi yeniden yazılır (Aşama 16 düzeni).

## 6. Kullanıcı kararları (açık)

- K1. Sıra. Öneri: E1 → E2 → E3 → E4 → E5 → E6 → E7.
- K2. Hedef müşteri: bugünkü kitle mi (ofis, emlak, turizm, serbest meslek), ticaret/dağıtım mı, ikisi mi? E5 ve E6'nın zamanı buna bağlı.
- K3. Şirket sınırı (madde 5): kalsın mı, herkese mi açılsın, lisansla mı? Fiyat kararıyla birlikte verilir (CLAUDE.md "FİYAT").
- K4. Pro'ya özel adım var mı? Varsayılan: hepsi herkese.
- K5. Resmî defter kapsamı: yalnız aktarım ve döküm mü, e-Defter de mi?
- K6. Döviz (§3.12, ertelendi): E4'ten önce mi, E4'ün içinde mi?

## 7. Değişiklik geçmişi

- 21.10.2026: ilk sürüm (kullanıcı isteği; "Bugün kodda" 3f6abc8 kodundan).
