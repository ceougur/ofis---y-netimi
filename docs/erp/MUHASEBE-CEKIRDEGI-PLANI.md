# Muhasebe Çekirdeği Temeli — Uygulama Planı (2.5.0, Kapsam A)

Durum: PLAN (05.11.2026, baş mimar). Mali müşavir P incelemesinden geçmeden kesinleşmez; para / kapama / açılış kuralı gerektiren her nokta önce kullanıcıya
(ders 43). Kaynaklar: kullanıcı talimatı `docs/erp/MUHASEBE-CEKIRDEGI-TALIMATI.md` (aynen), ERP haritası E1–E4, `docs/devir/DEVIR-PLANI.md`, 30.10 "Açılış kayıtları
düzeni", P2 bulguları (`docs/2.5.0-IS-LISTESI.md` E kaydı 05.11 ~16:31; ana oturum beş kritik iddiayı koddan yeniden doğruladı). İş listesi: `docs/2.5.0-IS-LISTESI.md` Ç1–Ç6.

## 0. Kararlar ve sınırlar
- KAPSAM A (kullanıcı 05.11): hesap planı eksikleri; saklanan fiş defteri; kilitli dönemin defterini dondurma; Defter Türü; Büyük Defter; Gelir Tablosu; Bilanço; açılış düzeni (30.10);
  B1. Elle Mahsup Fişi ekranı, düzenlenebilir hesap planı, amortisman, tahakkuk, stok maliyet yöntemi, mali analiz, nakit akış / özkaynak tabloları, mali müşavire aktarım → 2.5.1.
- TEMEL İLKE (talimat §1, §3; ERP E1): türetilmiş defter KORUNUR. İkinci bir para motoru, paralel bakiye kaynağı ya da "defteri baştan yazma" YOK. Yeni olan yalnız: hesap
  sınıflaması, saklanan fiş alt defteri (bank_lines ve vat_offsets gibi), kilitte donmuş defter, mali tablo raporları.
- Tek ticari olay = tek muhasebe etkisi. Para kuruş tamsayı. Hayali denkleştirme kaydı YOK: eşitlik tutmazsa rapor "Kesin Değil" der ve farkı gösterir.
- HEDEF: devir 1 Ocak 2027'den önce yayında. KESME ÇİZGİSİ: gecikirse Gelir Tablosu ve Bilanço ekranları 2.5.1'e; Ç1–Ç5 kalır (devir onlara dayanır).

## 1. Bugünkü durum (P2, kodla doğrulandı)
- Hesap planı koda gömülü `CHART` (general-ledger.mjs:15-66), 38 hesap; tür / mali tablo sınıfı alanı yok. Alt hesap: banka 102.NN / 300 / 309, POS 108.NN, evrak 101.01/.02, 121.01/.02;
  cari boyutu `party` (muavin). Yok: 590, 591, 690, 692, 621, 570, 580, 631/632/660, 761/771/781.
- Giderler 7/A'da: Kasa çıkışı ve elle Alacak Yaz 770, satış giderleri 760, finansman 780. 770'in adı "Genel Giderler ve Alış Faturaları" (Tek Düzen dışı ad).
- Hesap kodu SAKLANAN alt defterler: bank_lines, invoices.gl_json (fatura hesap netleri). Tutarı saklanan, satırı koddan kurulan: vat_offsets, şüpheli alacaklar. Geri kalanı türetme.
- AÇILIŞ: kasa / stok / taksit / banka is_opening ya da opening alanından; CARİ AÇILIŞI ise AÇIKLAMADAN (`/^açılış/i`, general-ledger.mjs:77; rows() is_opening'i okumuyor,
  routes/ledger.mjs:80-84) → açıklaması değişen açılış 500'den 602/770'e kayar; 2.4.6'dan beri açılış sayılmayan "Açılış bakiyesi" açıklamalı elle borç defterde hâlâ 500'e gider.
  Cariye işlenmemiş evrak (Excel "Açılış portföyü") 602 / 770'e (gelir / gider) gider.
- KİLİT İZİ (integrity.mjs LOCK_SQL) kaynak satırlarını korur, türetme kodunu korumaz: kural değişince kilitli dönemin yevmiyesi sessizce değişir (senet 101 → 121/321'de yaşandı).
  Planlanıp yapılmamış `ledger_snapshots` (BANKA-MODULU-PLAN §3.11).
- PERFORMANS: yevmiye ana iş parçacığında, her istekte bütün geçmişten (2.1.0: 100 bin satır 2.793 ms, 1 M 55.322 ms); "Bu Ay" yevmiyesi de bütün geçmişi kurar; Hesap Planı
  Mizanı gereksiz yere expected() + bütün cari listesini hesaplar. Defter raporları worker'da değil.
- RAPORLAR: Rapor Merkezi 63 rapor, ortak model (ekran = PDF = Excel); asOf, çeyrek, önceki yıl yok; satırdan kaynağa inme yok.
- Muhasebe rolü dönem kilidini koyamaz (system.manage yok). Şirket Verisini Sıfırla KEEP_SETTINGS ön ekleri dışındaki ayarları siler.

## 2. Ç1 — Hesap planı ve sınıflama [XH]
- CHART kodda kalır (düzenlenebilir plan 2.5.1). Her hesaba alan eklenir: `tur` (aktif / pasif / gelir / gider / kapanış), `duzenleyici` (−), `bilanco` (MSUGT bilanço kalemi:
  ör. "I.A Hazır Değerler"), `gelirTablosu` (MSUGT gelir tablosu kalemi), `ters` (ters bakiyede gideceği kalem; mali müşavir P'nin kuralı).
- Eklenecek hesaplar (kesin liste mali müşavir P'den): 590, 591, 690, (691, 692 akışı), 621, 570, 580, geçici açılış hesabı (kod önerisi 5 sınıfında boş bir kod, ör. 509 ya da 599;
  bilançoda Özkaynaklar altında ayrı, uyarılı satır), 7/A için yansıtma hesapları (631/632/660 ↔ 761/771/781) — 7/A mı 7/B mi kararıyla.
- 770'in adı Tek Düzen adıyla ("Genel Yönetim Giderleri") — tutar etkisi yok; kilitli dönemde ad farkı dondurmada görünmez (ad saklanmaz, kod saklanır).
- Kanıt: her hesap tam bir bilanço / gelir tablosu kalemine düşer (denetim testi: CHART'ta sınıfsız hesap → kırmızı).

## 3. Ç2 — Saklanan fiş defteri [XH]
- Tablolar (göç numarasını ana oturum verir): `ledger_vouchers` (id, no — yıl bazlı ayrı sayaç, `fin_events.no` ile karışmaz; tarih; tür: closing | opening | opening-match |
  reversal | manual (2.5.1); açıklama; kaynak (ör. devir kimliği); istek kimliği UNIQUE; created_by/at; reversal_of) ve `ledger_voucher_lines` (voucher_id, sıra, hesap, alt hesap,
  cari, borç kuruş, alacak kuruş, açıklama).
- Değişmezler: fiş başına Σ borç = Σ alacak > 0 (assertLines deseni); tek işlemde (store.tx) yazılır, yarım fiş yok; UPDATE / DELETE tetikle engelli (edoc_usage deseni) →
  düzeltme yalnız ters kayıt fişiyle (vat_offsets deseni); aynı istek kimliği ikinci kez yazmaz (eşzamanlı iki kaydet → tek fiş).
- Deftere giriş: journal() bu satırları bank_lines gibi aynen alır; JOURNAL_CLASS'a "kapanış" (günün sonu) ve "açılış" (günün başı) sınıfları. Dönem kilidi: tarihi kilitli
  döneme düşen fiş 409 (devir sürecinin kendi kapanış fişi kilit konmadan önce, aynı işlemde yazılır).
- Kapı: `FINANCIAL` kümesi (db.mjs) + integrity-scope + LOCK_SQL girdisi (`since: "2.5.0"`). DOĞRULANACAK (P2 DOĞRULANMADI): invoices ve vat_offsets FINANCIAL'da değil — kapı
  kapsamı boşluğu mu, bilinçli mi; Ç2 başında yazılı karara bağlanır.

## 4. Ç3 — Kilitli dönemin defterini dondurma [XH] (Ç5'TEN ÖNCE BİTMELİ)
- Kilit konunca / ilerletilince (routes/ledger.mjs:338 ucu) eski kilit ile yeni kilit arasındaki dönemin TÜRETİLMİŞ yevmiye satırları `ledger_snapshots` tablosuna satır
  düzeyinde yazılır: madde kimliği, seq, sınıf, tarih, hesap, alt hesap, cari, borç, alacak, kural sürümü. Raporlar kilitli dönemi bu tablodan, açık dönemi türetmeden okur.
- Kilit geri çekilirse açılan dönemin donmuş satırları (denetim kaydıyla) kaldırılır, yeniden türetilir; yeniden kilitlenince yeniden donar.
- Fark denetimi: güncel türetme ile donmuş defter kilitli dönemde ayrışırsa Defter Mutabakatı ve kapı "Kural Değişikliği Farkı" gösterir (sessiz değişiklik yok; düzeltme yok).
- GÖÇ (2.5.0'a yükselişte, mevcut kilitli şirketler): donmuş defter 2.4.9 KURALIYLA üretilir — kural değişikliği (Ç5) donmadan önce devreye girmez. Bunun için 2.4.9 türetmesi
  `kural sürümü 2.4.9` olarak dondurulmuş bir kopyada tutulur ve yalnız göçte kullanılır. BİLİNEN SINIR (kullanıcıya söylenir): 2.4.9'dan önceki kural değişiklikleri (ör. senet
  121/321, 2.3.0) geri alınmaz; donma 2.4.9 sonucudur.
- Devir arşivi: devirde arşivin K'ye kadarki dönemi kilitlenir ve donar → beyan edilmiş yıl sonraki sürümlerde değişmez.
- Hacim: 1 M satırda türetme ~55 sn → dondurma iş parçacığında (integrity-scan-worker deseni) hesaplanır; kilit ile donmuş satırlar TUTARLI ve ATOMİK yazılır; olay döngüsü
  kilitlenmez (ders 47). Mekanizma Ç3 tasarım notunda, ölçümle (aynı veri kopyası, önce / sonra, ders 15).
- Yan kazanç: kilitli ve devredilmiş yıllar tablodan okunur → canlı türetme yalnız açık dönemi kapsar → raporlar hızlanır.

## 5. Ç4 — Defter Türü [M]
- Ayar `accounting.bookType` (ayrı ön ek; KEEP_SETTINGS'e "accounting." eklenir — sıfırlamada korunur; "ledger." eklenmez, kilit bilerek siliniyor): Bilanço Esası /
  İşletme Hesabı Esası / Serbest Meslek Kazanç Defteri / Seçilmedi. Şirket başına (her şirket ayrı dosya).
- Ekran: firma bilgileri (Fatura Ayarları → Firma) yanında; yetki invoices.settings (yönetici + muhasebe). Mevcut şirketlerde "Seçilmedi": ilk Bilanço / Gelir Tablosu açılışında
  sorulur; sessiz çıkarım yok (partyKind / VKN uzunluğu yanıltıcı).
- Etki: Bilanço ve Gelir Tablosu bilanço esasında resmî MSUGT biçiminde; öteki türlerde ve "Seçilmedi"de üst başlıkta "Bilgi Amaçlı". İşletme Hesabı Özeti / Serbest Meslek özeti 2.5.1.

## 6. Ç5 — Açılış düzeni ve B1 [XH]
- Bütün modül açılışlarının karşı hesabı 500 yerine GEÇİCİ AÇILIŞ HESABI (kasa, cari, taksit, stok, banka / kart / kredi, açılış çekleri). Cariye işlenmemiş açılış evrakı 602 / 770'e
  DEĞİL geçici hesaba (30.10 (1)). Değişen yerler: general-ledger.mjs :208, :254-255, :284, :308; bank/voucher.mjs ROLE_GL opening / closing; routes/ledger.mjs build 602 / 770.
- Cari açılışı `is_opening`'den tanınır (açıklamadan değil); rows() is_opening'i okur. Kilitli dönemler Ç3 sayesinde değişmez.
- AÇILIŞ EŞLEŞTİRME FİŞİ (30.10 (3)): yetkili kullanıcı geçici hesap bakiyesini açılış bilançosuna göre dağıtır (öz sermaye 500 / 570 / 580 ve gerekirse öteki bilanço hesapları);
  Ç2 fişi, tür opening-match; yalnız geçici hesabı kapatan satırlara izin (serbest elle fiş 2.5.1). Geçici hesap ≠ 0 iken Bilanço "Kesin Değil — Tamamlanmamış Açılış".
- Devirde: devir açılış fişi geçici hesabı arşivin kapanış bilançosuyla kendiliğinden kapatır (S4); arşivde eşleştirilmemiş geçici bakiye varsa aynen taşınır.
- 500 artık mutabakatta denetlenir (expected()'te bugün yok).
- B1: tek ortak "gecikmiş" yardımcısı (vadeli satır + taksit; fatura KULLANICI KARARINA bağlı — iş listesi C). Okuyan bütün yollar birlikte değişir (ders 10): cari kartı, cari listesi,
  Anlık Durum, WhatsApp Ödeme Hatırlatma (iki yol), Cari Mizanı süzgeci, Vade Takip. Toplu SQL (ders 47). WhatsApp elemesi değiştiği için "kime kaç kez" ilkesiyle denenir (ders 45).

## 7. Ç6 — Büyük Defter, Gelir Tablosu, Bilanço [XH]
- BÜYÜK DEFTER (Kebir) + hesap ekstresi: hesap (ve alt hesap / cari) seçimi, dönem; dönem başı devir + tarih sıralı hareketler + kümülatif bakiye + toplamlar; satırdan kaynağa
  "Kayda Git". Yevmiye Defteri'ne hesap süzgeci.
- GELİR TABLOSU (MSUGT): Brüt Satışlar, Satış İndirimleri (−), Net Satışlar, Satışların Maliyeti (−), Brüt Satış Kârı, Faaliyet Giderleri (−), Faaliyet Kârı, Diğer Faaliyetlerden
  Olağan Gelir ve Kârlar, Olağan Gider ve Zararlar (−), Finansman Giderleri (−), Olağan Kâr, Olağandışı Gelir / Gider, Dönem Kârı, Vergi Karşılıkları (−) (program YAPMAZ; satır boş ve
  açıklamalı), Dönem Net Kârı. 7/A giderleri ilgili kalemlere yansıtma kuralıyla (mali müşavir P). Aylık, çeyrek, yıllık, özel aralık, önceki dönemle karşılaştırmalı.
- SATIŞLARIN MALİYETİ: dönem sonu değerleme kaydı (621) yoksa BAŞ MİMAR ÖNERİSİ (mali müşavir P onayı ister): ağırlıklı ortalama alış fiyatıyla (devir değerlemesiyle AYNI işlev)
  hesaplanır, satırda "Tahmini" ve rapor başında "Kesin Değil" (talimat: tahmin kesin gibi sunulmaz). Alternatif: satır "Hesaplanmadı".
- BİLANÇO (MSUGT): Dönen / Duran Varlıklar; Kısa / Uzun Vadeli Yabancı Kaynaklar; Özkaynaklar. Tarih itibarıyla (asOf), önceki dönem sonuyla karşılaştırmalı, ana hesap → alt hesap →
  Büyük Defter'e inme. Ters bakiyeler kural kitabındaki sınıfa (ör. alacaklı 120, borçlu 320, eksi 102). Dönem kapanmadıysa "Dönem Net Kârı" 6 / 7 bakiyelerinden HESAPLANMIŞ satır
  (kayıt değil). Aktif = Pasif; tutmazsa fark satırı + "Kesin Değil" (denkleştirme kaydı YOK).
- "KESİN DEĞİL" nedenleri (rapor başında, madde madde): geçici açılış hesabı ≠ 0; satışların maliyeti tahmini; defter mutabakatı farkı ya da dengesiz madde; Kural Değişikliği
  Farkı; Defter Türü bilanço esası değil ("Bilgi Amaçlı").
- Rapor altyapısı: "Mali Tablolar" grubu (GROUP_ORDER); queryOf'a asOf / glAccount / compare (listede olmayan parametre sessizce düşer — Bulgu 4 dersi); hazır dönemlere çeyrek ve
  önceki yıl; rowMarks (girinti) ve footers (alt toplam); ekran = PDF = Excel; yazım düzeni (her sözcüğün ilk harfi büyük).
- Yetki: Ana Defter raporlarıyla aynı (Muhasebe görür).

## 8. Hacim bütçesi (ders 47 — geliştirme sırasında programın kendi ürettiği büyük veride ölçülür)
| Yol | 100.000 satır | 1.000.000 satır | Olay döngüsü |
|---|---|---|---|
| Büyük Defter / Gelir Tablosu / Bilanço (açık dönem canlı, kilitli dönem donmuş) | ≤ 3 sn (worker) | ölçülür; hedef ≤ 60 sn, ilerleme | en çok ≤ 50 ms |
| Hesap Planı Mizanı (yalnız mizan, expected() yok) | ≤ 3 sn | ölçülür | ≤ 50 ms |
| Dönem kilidi + dondurma | ≤ 10 sn | ölçülür; hedef ≤ 2 dk, ilerleme | ≤ 50 ms |
Desenler: defter servisi rapor iş parçacığına (integrity-scan-worker örneği); veri değişmedikçe önbellek (fingerprintNow); bakiye toplamlarında SQL ikizi (partyTotals / subTrialData).

## 9. Nasıl bozulur? (testler buradan)
1. Kilit koy → sürüm yükselt (kural değişir) → kilitli dönemin mizanı ve yevmiyesi BİREBİR aynı (2.4.9 gerçek koduyla üretilmiş veri, fark testi — ders 17).
2. Kilit kaldır → kayıt değiştir → yeniden kilitle; kilitliyken açılış satırının açıklamasını değiştirme denemesi.
3. Açılış: açıklaması değişen açılış (artık 500 → geçici sabit), "Açılış bakiyesi" açıklamalı ama is_opening = 0 elle borç (artık 602), açılış çeki (carisiz), geçici ≠ 0 → Kesin Değil.
4. Fiş: dengesiz fiş reddi; eşzamanlı iki kaydet (aynı istek kimliği) → tek fiş; süreç öldürme / disk dolu → yarım fiş yok; ters kayıt sonrası bakiye; kilitli tarihe fiş 409.
5. İki şirket: fiş, donmuş defter, Defter Türü karışmaz; Şirket Verisini Sıfırla → Defter Türü korunur, fiş ve donmuş defter silinir; yedek → geri yükle → tutarlı.
6. Gelir Tablosu: 7/A yansıtma; iade (610) ve iskonto (matrahtan); KDV'siz faturasız satış; POS komisyonu (653); kredi faizi (780); vergi ödemesi (689 / 360); boş dönem; çeyrek sınırı.
7. Bilanço: Aktif = Pasif; ters bakiyeler (alacaklı müşteri, borçlu tedarikçi, eksi banka); dönem net kârı satırı; asOf geçmiş / gelecek / ileri tarihli hareket.
8. Tarih: ay sonu, yıl dönümü, 29 Şubat, sahte saat (ders 13, 22); TZ=UTC ve TZ=Europe/Istanbul.
9. Yetki: Muhasebe görür, personel görmez; dönem kilidi yalnız system.manage.
10. Hacim: §8 bütçesi 100 bin ve 1 M satırda; olay döngüsü ölçümü.
11. B1: aynı cari için cari kartı = cari listesi = Anlık Durum = WhatsApp seçimi = Vade Takip "gecikmiş" tutarı; WhatsApp elemesi kime kaç kez ilkesine uyar.

## 10. Kanıt (KANIT KURALI, BAĞIMSIZ DOĞRULAMA PRENSİBİ)
- Mali müşavir P (kodu görmez): bu plan + devir planı + kararlar; MUHASEBELEŞTİRME KURAL KİTABI (olay → madde). Kâhin (kodu görmez, Python) kural kitabından; önce bugünkü kodla
  karşılaştırma — farklar ya hata ya kullanıcı sorusu (ders 6, 43).
- Mutasyon: fiş denkliği, ters kayıt, dondurma (kilitli dönemde güncel türetmeye düşme), açılış karşı hesabı, sınıflama (hesap → kalem), Kesin Değil nedenleri.
- Kırmızı kanıt eski kodda (ayrı kopya, ders 23, 38). Her paketten sonra yalnız o farka dar kontrol (xhigh). Mali müşavir A (ara kabul) Ç1–Ç6 bitince; S son adayda.
- e2e: Büyük Defter, Gelir Tablosu, Bilanço ekrandan (insan hızı + klavye), ekran = PDF = Excel sayıları; Defter Türü sorusu; Açılış Eşleştirme Fişi.

## 11. Sıra, göç numaraları, ajanlar
- Sıra: Ç1 → Ç2 → Ç3 → Ç5 (Ç3 bitmeden Ç5'in kural değişikliği girmez) → Ç6. Ç4 Ç1'den sonra paralel. B1 kullanıcı yanıtından sonra (Ç5 içinde).
- Göç numaraları ana oturumca: Ç2 ledger_vouchers, Ç3 ledger_snapshots; devirin göçleri sonra (DEVIR-PLANI). İki ajan aynı numarayı almaz.
- Efor: Ç1, Ç2, Ç3, Ç5, Ç6 [XH] (defter çekirdeği); Ç4 [M]. Her paket ayrı worktree, push yok, ana oturum birleştirir; düzeltme ajanı tur başına yeni (ders 46).

## 12. Mali müşavir P'ye açık sorular (kural kitabıyla yanıtlanır; para kuralıysa kullanıcıya)
1. 7/A mı 7/B mi; 760 / 770 / 780 → 631 / 632 / 660 yansıtma; kapanışta 7xx'in de kapanması.
2. Dönem sonu akışı: 690 → (691) → 692 → 590 / 591; vergi karşılığı program dışı (DEVIR-PLANI §11.5).
3. Geçici açılış hesabının kodu ve bilançodaki yeri.
4. Açılış eşleştirmede 570 / 580 dağıtımı ile DEVIR-PLANI §11.1 ("aktarım mali müşavirin işi") arasındaki çelişki.
5. Ters bakiye sınıflaması (alacaklı 120, borçlu 320 / 159, eksi 102 / 300); KDV'nin mahsupsuz aylarda gösterimi (191 / 391).
6. Satışların maliyeti: tahmini gösterim mi, "Hesaplanmadı" mı.
7. Defter Türü "Seçilmedi" ve İşletme Hesabı / Serbest Meslek'te "Bilgi Amaçlı" biçim yeterli mi.
8. Kasa çıkışının hep 770 olması (hesap seçimi 2.5.1) bilançoda hangi kalemleri gizler; rapor dipnotu.

## 13. Mali müşavir P sonuçları (05.11.2026 17:12 UTC; kural kitabı docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md — kodu görmeden yazıldı, araç kaydı denetlendi: yasak klasöre dokunulmadı)
KABUL EDİLENLER (BAŞ MİMAR KARARI, ders 40 — mali müşavir önerisi, sınıflama / gösterim; para kuralı değil):
- YÜKSEK-1: satışların maliyeti hangi seçenekle olursa olsun Gelir Tablosu VE Bilanço'ya BİRLİKTE uygulanır; değişmez "Gelir Tablosu dönem kârı = Bilanço dönem kârı" (kâhin + test).
- 7/A kalır; yansıtma 760→761/631, 770→771/632, 780→781/660; kapanış sırası: stok değerlemesi (621) → yansıtma → 6xx → 690 → (691 = 0, program ayırmaz) → 692 → 590 / 591.
- Geçici açılış hesabı kodu 519 "Eşleştirilecek Açılış Bakiyeleri" (Tek Düzen'de boş grup 51; GÖRÜŞ); Bilanço'da Özkaynaklar sonunda uyarılı satır.
- Açılış eşleştirmesinin hedefi bütün 5 sınıfı (500–503, 52x, 54x, 570, 580, 590 / 591; enflasyon düzeltmesinden kalan 502 / 503 / 52x dahil).
- Ters bakiye: cari bazında brütleştirme — alacaklı 120 → 340, borçlu 320 → 159, borçlu 336 → 136, eksi 102 → 300, borçlu 309 → 136, borçlu 360 → 198 + Kesin Değil;
  eksi kasa / stok / evrak → Kesin Değil; 191 / 391 mahsupsuz aylarda netleşmez, biten ay mahsupsuzsa uyarı.
- Dipnotlar: Bilanço Esası "yasal (TTK / KÜMİ FRS) finansal tablo değildir, dönem sonu işlemleri dahil değildir"; Serbest Meslek "tahsil esası; müvekkil adına alınan para kazanç değildir";
  590 "vergi öncesi" etiketi (vergi karşılığı program dışı — 20.10 §11.5 kararı aynen).
- Kasa çıkışı (hesap seçimi 2.5.1'e kadar) "770.90 Sınıflandırılmamış" alt hesap + Gelir Tablosu'nda "Sınıflandırılmamış Kasa / Banka Giderleri" satırı + kalıcı dipnot.
- Stok birim maliyeti DÖNEMSEL ağırlıklı ortalama: (dönem başı stok + o yılın alışları); önceki yıl sonları için de değerleme (KG-12 ile).
- 2.5.1'e (DÜŞÜK): POS komisyonu 653 → 760; kredi 300 / 400 vade ayrımı dipnotu; özel hesap dönemi; "Defter Tutmuyor" Defter Türü seçeneği; kilit kaldırma uyarısı; Muhasebe rolüne dönem kilidi
  (GÖRÜŞ); kılavuzdaki "karşılığı açılış hesabı 500" cümlesi (kılavuz Ç5 ile birlikte güncellenir — 2.5.0).
KULLANICI KARARI 05.11 17:16 "hepsi A" — aşağıdaki maddelerin HEPSİ A (iş listesi D). Önceki başlık: KULLANICIYA SORULACAKLAR (para / kapama / açılış kuralı; ders 43; mali müşavir önerisi A): B1, KG-2, KG-3, KG-5, KG-6, KG-7, KG-9, KG-11, KG-12, KG-15, KG-16 (iş listesi C). KG-4 (Borç Yaz /
Alacak Yaz bugünkü 602 / 770 + ".90" alt hesap) ve KG-13 (vergi karşılığı yok, 20.10 kararı) yeni kural değil → sorulmaz. Kâhin yanıt gelene kadar bu maddelerde iki dallı kurulur.
