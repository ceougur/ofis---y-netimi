# D3 raporu — devir saf hesabı + Devir Raporu + ön denetim (2.5.1)

Ajan: D3 KOD ajanı (high), 27.11.2026. Taban `t251-taban` (64396478). Tasarım: `docs/devir/D3-D4-TASARIM.md` §3 (ana ağaçtan okundu; bu ağaca KOPYALANMADI).
Taslak adım adım yazılır; son hâl raporun kendisidir.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Kaynak: DEVIR-PLANI §8 (1–16), G10 (17–28), tasarım notu §3.11 (29–42). D3 HİÇBİR ŞEY YAZMAZ: yazım / takas / arşiv / ekran maddeleri D4 / D5'in testidir; D3'te
karşılığı "planın o durumda doğru sayı / doğru madde / doğru ön denetim maddesi vermesi"dir. Test adları planlanan adlardır (son hâli §5'te).

| # | Bozulma | D3'te karşılığı | Test (planlanan) |
|---|---|---|---|
| 1 | Aralık faturası Ocak'ta tahsil edilmiş (bağlı ödeme K sonrası) | ≤K kuyrukta fatura AÇIK kalem; K sonrası bağ `links[]`'de açık kalemin devir kimliğine yönelir | devir-d3-plan (bağ yönlendirme) |
| 2 | Kısmi ödenmiş fatura + FIFO serbest tahsilat | açık kalem = kuyruğun kalanı; net satır = K bakiyesi − Σ açık kalem (çift sayım yok) | devir-d3-plan (elle) + devir-d3-esdeger |
| 3 | Taksit kartına bağlı fatura, kısmi taksit, avans, Kasa Dışı açılışlı kart | kartın tükettiği kalem açık kalem DEĞİL; kart `plans[]`'de (≤K tahsilat tek açılış); avans net satırda | devir-d3-plan (kart) |
| 4 | Çek: portföy / tahsilde / ciro / karşılıksız; K sonrası tahsil | K'deki durum ≤K olaylardan; durum bazında adet + tutar; karşılıksızın cari borcu açık kalem | devir-d3-plan (çek) |
| 5 | POS valörü K sonrası; kredi kartı borcu; Devir Kapanışı yapılmış hesap | 108.NN / 309.NN / 300.NN K bakiyesi alt hesap boyutunda; 102.00 / 108.00 dahil | devir-d3-plan (banka) |
| 6 | Eksi stok, sıfır stok, silinmiş ürün | açılış miktarı = K miktarı (eksi dahil), değer 0; sıfır / silinmiş üründe açılış YOK (S207 = A; §8.6'nın "153'te kalır"ı ESKİDİ — sınanmaz) | devir-d3-plan (stok) |
| 7 | Aynı adlı iki cari; pasif cari; bakiyesi 0 ama açık kalemli (+/−) cari | kimlikle ayrılır; bakiyesi 0 + açık kalemsiz → satır YOK; bakiyesi 0 + ters yönlü kalemler → kalemler + toplam satırları | devir-d3-plan (M12) |
| 8 | İade faturası, mahsup, KDV Mahsup, Vergi Ödemesi, şüpheli | 191 / 391 dönem boyutu, 360, 128 / 129 (M13: aynı tutar iki kez taşınmaz) | devir-d3-plan (KDV, şüpheli) |
| 9 | K'de (31.12 23:59) / K+1'de (01.01 00:00) kayıt; sahte saat; Şubat'ta devir | sınır günü kuyruk ve sayımda doğru tarafta; iki TZ | devir-d3-zaman |
| 10 | İki kullanıcı yazıyor; yarıda kesilme | ön izleme salt okuma; iş parçacığı öldürülünce veri aynı | devir-d3-uc (kesinti) |
| 11 | Geri Al → yeniden devir; güncelleme → arşiv | D4 | DENENMEYEN (D4b) |
| 12 | İki şirket; yalnız seçilen | 002'nin planı 001'in verisini saymaz; 001'de ortak katman budama sayısına girmez | devir-d3-uc (iki şirket) |
| 13 | Eski sürüm verisi | v2.5.0 GERÇEK koduyla üretilmiş veride plan + değişmezler | devir-d3-gercek-veri |
| 14 | e-Belge bekleyen gönderim | ön denetim DURDURUR | devir-d3-onden (e-Belge) |
| 15 | Arşivde yazma ucu | D4 / D2 | DENENMEYEN (D4b) |
| 16 | Şemadaki her tablo sınıflamada | planın budama listesi tasarım §2 sınıflamasıyla; şemada olup listede olmayan tablo testte kırılır | devir-d3-plan (sınıflama) |
| 17 | 001'de devir, güncelleme denemesi, mobil 503 | D4 | DENENMEYEN (D4b) |
| 18 | Devir öncesi yedeğin geri yüklenmesi | D4 | DENENMEYEN (D4b) |
| 19 | ≤K Listeden Sil'inmiş e-Belge | ön denetim DURDURUR | devir-d3-onden |
| 20 | Aralık KDV mahsubu devirden sonra | ön denetim UYARIR (Aralık mahsubu yapılmamış); dönemi ≤ Aralık 191 / 391 planda dönem etiketiyle | devir-d3-onden + devir-d3-plan (KDV) |
| 21 | Gelen kutusu Aralık belgesi | D4 (einvoice_inbox DOKUNULMAZ — sınıflamada) | DENENMEYEN (D4b) |
| 22 | Aktif tekrarlayan faturanın ≤K şablonu | planın `repeats[]` listesi + UYARIR | devir-d3-onden |
| 23 | Ocak'ta Aralık iadesi | D4 / D5 | DENENMEYEN |
| 24 | Devri Yenile | D4c | DENENMEYEN |
| 25 | Eski sürüme dönüş | D4 | DENENMEYEN |
| 26 | Arşiv klasörü silinmiş | D2 / D4 | DENENMEYEN |
| 27 | edoc_usage / inbox / audit / integrity_log korunur; trash seçici | budama listesinde DOKUNULMAZ; trash yalnız para kalemi | devir-d3-plan (sınıflama) |
| 28 | Bekleyen POS kalemi; tahsildeki çek; açık şüpheli | plan satırları (108.NN, 101.02 / 121.02, 128 / 129) | devir-d3-plan |
| 29 | İki satırlı seçenekte Alacak Toplamı gecikmiş kalemi kapatır | planda iki satır + `kuyrugaGiren` net (BAŞ MİMAR KARARI); devirsiz eşdeğer: iki seçenek × gecikmiş kalem | devir-d3-esdeger |
| 30 | Vadesiz açık kalem K+1'de vadesini kaybeder | açık kalemin vadesi = asıl vade, vadesizde asıl belge günü | devir-d3-plan + devir-d3-esdeger |
| 31 | Ödeme Sözü taşınmaz | açık kalemde `beklenenTarih` | devir-d3-plan |
| 32 | Kapalı / Borçta Kalsın kart; KG-5 Excel kartı; fatura kartı | kapalı kart da tek açılış; Borçta Kalsın kalanı açık kalem; kart taşıdığı kalemi açık kaleme koymaz | devir-d3-plan (kart) |
| 33 | Açık şüpheli kendi ≤K tarihinde madde üretir | D4a (≤K türetme kapalı); D3'te 128 / 129 N-12 açılışı + CH açık kalemlerinden şüpheli payı düşülmüş | devir-d3-plan (şüpheli) |
| 34 | Dönemi Ocak olan Aralık alışı | 191 açılışı dönem etiketiyle (Ocak) | devir-d3-plan (KDV) |
| 35 | 102.00 / 108.00 ve Devir Kapanışı yapılmış hesap | alt hesap K bakiyesi taşınır (değişmez 2) | devir-d3-plan (banka) |
| 36 | KG-16 "Açılış Olabilir" onay bekleyen aday | ön denetim DURDURUR (S-2 = A) | devir-d3-onden |
| 37 | Kural Değişikliği Farkı düzeltilmemiş | ön denetim DURDURUR (S-3 = A) | devir-d3-onden |
| 38 | Ön izlemeden sonra kayıt girilir | sonuçta `dataVersion`; kayıt girilince değişir | devir-d3-uc |
| 39 | Aynı veride iki ön izleme; sürerken sıfırla / geri yükle | aynı şirkette tek iş (ikinci istek sürenin kimliği); belirlenimli (iki koşu bayt bayt) | devir-d3-uc |
| 40 | Ön izleme sürerken bakım kipi | sonuç "bayat" işaretli | devir-d3-uc |
| 41 | Silinmiş ürünün K miktarı | açılış yok (S207 = A) | devir-d3-plan (stok) |
| 42 | 001'de ön izleme | budama sayıları users / roles / sessions / mobile_* saymaz | devir-d3-uc |
