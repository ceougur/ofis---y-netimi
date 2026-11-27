# P-D raporu — devir planının koda karşı okunması + D3 / D4 tasarımı (2.5.1)

Ajan: P-D (high), 27.11.2026. Taban `t251-taban` (64396478). KOD VE TEST YAZILMADI; hiçbir program / test koşulmadı (yalnız salt okuma taraması). Tasarım notu: `docs/devir/D3-D4-TASARIM.md`
(§1 plan ↔ kod, §2 tablo sınıflaması, §3 D3, §4 D4, §6 paketleme). `docs/devir/DEVIR-PLANI.md`'ye dokunulmadı.
Ortam (bitişte): yük 5,12 / 4 çekirdek (başka işlerin yükü; bu ajan yük başlatmadı), bellek boş ~3 GB (kullanılabilir ~9 GB), disk boş 14 GB.

## 0. Sonuç (özet)
Plan ana çizgisiyle (G1 kopyada üret → doğrula → takas, G2 ayrı açık kalem, G7 Devri Yenile / Geri Al) bugünkü kodun üstüne kurulabilir; D2 altyapısı (bakım kipi, arşiv kaydı, salt okunur
arşiv, devir yedeği) hazır, Ç2 / Ç3 / Ç5 / Ç6 çekirdeği devrin dayanacağı işlevleri veriyor. Ama 2.5.0'da değişen çekirdek planın birçok yerini eskitti ve koddan altı tasarım tehlikesi çıktı:
(1) iki satırlı "Borç ve Alacakları Aktar" tek borç sırasında gecikmiş kalemi kapatıp gecikmişi değiştirir; (2) vadesiz açık kalem K+1 satırında vadesini kaybeder; (3) yeni yılda kalan ≤K
tarihli kartlar / şüpheli kayıtlar ≤K tarihli defter maddesi üretir; (4) KDV İndirim Dönemi etiketi faturadan okunduğu için budanan Aralık faturasının Ocak'a ait KDV'si kaybolur; (5) salt
okunur arşivde WhatsApp saklama süresi / KVKK silme talebi uygulanamaz; (6) ön izleme bütçesi (100 bin satırda 10 sn) Bilanço hesabı tek başına ~6 sn sürdüğü için riskte. Hepsi için
tasarım notunda kural / öneri var. Kullanıcıya 3 para / kapama sorusu, baş mimara 12 karar kalıyor. Önerilen paketleme D4-ÖK ‖ D3 → D4a → D4b → D4c ‖ D5 → D6 → D-SON.

## 1. Yazılan belgeler
- `docs/devir/D3-D4-TASARIM.md` — bölüm 1–4 ve 6.
- `docs/devir/2.5.1-DEVAM/pd-rapor.md` — bu dosya (bölüm 5, 7 + özet).
- Not defteri betiği (depoda değil): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pd-betik/tablolar.py` (şemadaki tabloları G3 metniyle karşılaştırır).

## 5. SORULAR

### 5.1 G13'ün dört sorusu — hepsi YANITLANMIŞ
| G13 | Yanıt | Kaynak |
|---|---|---|
| (1) Ocak'ta Aralık faturasının iadesi | arşivdeki faturaya salt okunur başvuru; iade yeni yılda 610 / 191 ↔ cari; açık kalem varsa önce onu kapatır; KDV iade ayında; stok yeni yıla girer; e-Belge'de asıl belgeye başvuru | DEVIR-PLANI G14 (1) (mali müşavir P, 05.11); kâhin s34 |
| (2) kapanış akışı ve 590 / 591 ↔ 570 / 580 | sıra: değerleme → yansıtma → 6xx → 690 → 691 (= 0) → 692 → 590 / 591; 691 692'ye kapanır; 590 / 591 yeni yıla AYNEN; 570 / 580'e aktarım program DIŞI; kapanmamış önceki yıllar yıl yıl 570 / 580 | G14 (2), çekirdek §13, kitap N-01 … N-08, EK-1 M4, EK-2 S40, §11.1, KG-12 = A (kullanıcı 05.11 17:16) — AMA aşağıdaki S-1 bu yanıtın açık bıraktığı yeni durum |
| (3) iki satır + açık kalemlerin ekstre düzeni | ekstrede "Borç Toplamı" / "Alacak Toplamı" (açık kalemler düşülmüş) + açık kalemler kendi tarih ve vadesiyle; satır tarihi K+1, belge tarihi açıklamada; defterde cari başına tek net madde | G14 (3), KG-17 A, EK-1 M3, M12 (BAŞ MİMAR KARARI 05.11 18:55, kullanıcıya gösterildi) |
| (4) Devri Yenile uyarı metni | "Bu yılın beyannamesi verildiyse ya da e-Defter beratı yüklendiyse burada yapacağınız düzeltme yasal defterinizi ve beyannamenizi değiştirmez; düzeltme beyannamesi gerekebilir. Mali müşavirinizle görüşün." + 30 Nisan'dan sonra ikinci onay | G14 (4) |

### 5.2 Taramada çıkan, karar metninde YANITI BULUNANLAR (YANITLANMIŞ — kodlanabilir, kâhine girer)
- K yalnız 31 Aralık, yıl ortası red — EK-1 M11 (BAŞ MİMAR 05.11 18:55).
- Devirde her açık borç kalemi (fatura dışı da) kendi vadesiyle — EK-1 M2 A (BAŞ MİMAR 05.11 18:55) + B1 A (kullanıcı 05.11 17:16).
- Ocak'ta devirden önce yazılmış karşılıksız / bağ K kilidiyle — S24 = A (kullanıcı 06.11 06:26).
- Kilitli / devredilmiş dönemde bağsız kapanmış kalem sonraki bağla açılmaz — 2B-S2 / 28 = A (kullanıcı 05.11 21:30 (3)); kilitli dönemde kapanan fatura karşılıksızla açılmaz — S11 = A.
- Devri Yenile çakışması yalnız tamamen kapanan / yok olan kalemde — EK-1 M9 (BAŞ MİMAR 05.11 18:55).
- Devri Yenile yalnız devrin fişlerini silip yeniden yazar, yevmiyede tek açılış fişi — karar (7) A (kullanıcı 05.11 21:30).
- Aralık KDV mahsubu yapılmadan devir: dönemi ≤ Aralık 191 / 391 yeni yılın mahsubuna girmez, tek yol Devri Yenile; G4 uyarır — KG-7 = A + EK-1 M8 1–5 (kullanıcı 05.11 17:16; BAŞ MİMAR 18:55).
- Eksi stok devri: miktar eksi dahil, değer 0 — KG-9 = A + M5. Silinmiş ürün envantere girmez — S207 = A (19.11; plan §8.6 "153'te kalır" ESKİDİ).
- Şüpheli kuyruğu devirde 128 ayrı, açık kalem olarak taşınmaz — M13 (BAŞ MİMAR 05.11 18:55).
- Kartı Kapat kalanı borçta kalır (devirde açık kalem) — 2B-S5 / S10 = A.
- Kesin Değil "Önceki Yıl KDV Mahsubu Yapılmamış" — EK-2 S34.
- WhatsApp: Devri Geri Al / geri yükleme → genel ilke (5) İLKEYLE; Devri Yenile'den sonra gecikmiş değişen cariye hatırlatma → ilke (3) İLKEYLE (soru değil; ders 45 ilkesi 31.10 "a").

### 5.3 KULLANICIYA SORULMALI (para / kapama — ders 43; yanıta kadar ne kodda ne kâhinde kesinleşir)

**S-1 — Önceki yılın kârı yeni yılda nerede durur, bir sonraki devirde nereye kapanır? (kapanış sırası; UÇ DURUM DEĞİL — kâr / zarar eden her şirkette)**
Bugünkü karar (§11.1): "590 Dönem Net Kârı / 591 Dönem Net Zararı yeni yıla olduğu gibi açılır; 570 / 580'e aktarım mali müşavirin işidir, program yapmaz." KODDAN: 2.5.1'de elle fiş
(Mahsup Fişi) ekranı YOK (plan §6 alınmaz) ve Açılış Eşleştirme yalnız 519'u dağıtır → kullanıcının 590'ı 570'e aktaracak yolu yok. Bilanço hesabı (`financial-statements.mjs:789`) "Dönem Net
Kârı" kaleminde 590 bakiyesi ile yeni yılın hesaplanan kârını TOPLAR. Örnek: 2026 kârı 100.000, 2027 Ocak devri, 2027 kârı 80.000.
- **A (ÖNERİ):** 590 / 591 yeni yıla AYNEN açılır (bugünkü karar ve "her hesap kapanış = açılış" değişmezi korunur); yeni yıl Bilanço'sunda bu tutar "Dönem Net Kârı" kaleminde DEĞİL,
  "Geçmiş Yıllar Kârları (Zararları)" kaleminde "Önceki Yıl Kârı — Dağıtılmamış (2026)" satırıyla gösterilir; bir SONRAKİ devrin kapanışında (31.12.2027) program önce 590'daki 2026 tutarını
  570.2026'ya aktarır, sonra 2027'yi kapatır. Sayılar: 2027 Bilanço'su Geçmiş Yıllar 100.000, Dönem Net Kârı 80.000; 2028 açılışı 570.2026 = 100.000, 590 = 80.000. Özkaynak toplamı 180.000.
- **B:** devir açılışında 590 doğrudan 570.2026'ya (591 → 580.2026) açılır. Sayılar: 2027 açılışı 570.2026 = 100.000, 590 = 0; Bilanço aynı görünür. Bedeli: "590 kapanışı = 590 açılışı" değişmezi
  yerine "570 + 590 toplamı" değişmezi; kâhin değişir.
- (Bugünkü harfî okuma, önerilmez: 590 aynen açılır, gösterim değişmez → 2027 Bilanço'sunda "Dönem Net Kârı" 180.000 görünür; 2027 kapanışında 590 = 180.000 — iki yılın kârı birikir.)
- Yaygın programlarda nasıl: belgesi okunmadı — DOĞRULANMADI (hafızadan dayanak yazılmaz).
- Zaman: gösterim farkı Ç6-EKRAN (2.5.1) ile görünür olur; kapanış farkı ilk kez Ocak 2028 devrinde. A seçilirse kapanış adımı 2.5.1'de kodlanabilir ya da 2.5.2'ye kalabilir (ikinci devirden önce).

**S-2 — "Açılış Olabilir" listesinde onay bekleyen eski kayıt varken devir yapılabilsin mi? (açılış kuralı; UÇ DURUM — yalnız 2.5.0 öncesinden kalan "Açılış…" açıklamalı kayıtlarda)**
KG-16 = A: aday onaylanana kadar defterde açılış sayılır (519). Devirden sonra aday arşivde kalır ve arşiv salt okunur → karar artık yalnız Devri Yenile ile verilebilir. Örnek: "Açılış bakiyesi"
açıklamalı 5.000'lik eski Borç Yaz, onay bekliyor.
- **A (ÖNERİ):** devri DURDURUR — ön denetim "Açılış Olabilir Kayıtları Onaylayın" der (Git bağlantısı). Onay → 519 (açılış); ret → 602.90 (gelir) → 2026 kârı 5.000 artar.
- **B:** UYARIR, devir sürer; aday açılış sayılır (519'da 5.000 yeni yıla taşınır); değiştirmek için Devri Yenile.
- **C:** uç durum böyle kalsın (BİLİNEN SINIR) — B'nin davranışı, uyarısız.

**S-3 — Eski kuralla donmuş kilitli dönemin "Kural Değişikliği Farkı" düzeltilmeden devir yapılabilsin mi? (KG-15; UÇ DURUM — yalnız 2.5.0'dan önce dönem kilidi koymuş şirketlerde)**
KG-15 = A: fark "Kural Farkı Düzeltme Fişi" ile kilidin ertesi günü düzeltilir; fark aynı yılsa eski hesabın tersiyle, önceki yılsa 671 / 681 (M7). Devirden sonra fark arşivde donar.
Örnek: 2.4.9'da kilitlenmiş dönemde açılış çeki 3.000 602'ye (gelir) yazılmış; 2.5.0 kuralı 519.
- **A (ÖNERİ):** devri DURDURUR — "Önce Kural Farkı Düzeltme Fişi'ni yazın" (fiş K yılı içinde, eski hesabın tersi: B 602 / A 519) → 2026 kârı 3.000 azalır, arşiv doğru kapanır.
- **B:** UYARIR, devir sürer; fark 2027'nin ilk açık gününe (01.01.2027) 681 / 519 ile taşınır (M7 son cümlesi) → 2026 kârı 3.000 fazla kalır, 2027'de 3.000 "Önceki Dönem Gider ve Zararları".
- **C:** uç durum böyle kalsın (BİLİNEN SINIR) — fark arşivde "Kural Değişikliği Farkı" uyarısıyla kalır, düzeltme yok.

## BAŞ MİMAR KARARI GEREKİYOR (mimari / sınıflama; para kuralı değil — kullanıcıya gösterilir, ders 40)
- **B-1 WhatsApp içeriği arşivde (KVKK):** arşiv `wa_jobs` / `wa_job_pdfs` / `wa_batches` / `message_sends` kopyasını taşır; salt okunur arşivde 1 yıl saklama ve silme talepleri UYGULANAMAZ
  (S-W3, S32, S38 kararları arşivde delinir). Öneri: arşiv üretilirken bu tabloların içerik / telefon / PDF alanları anonim ize indirilir (tarih, dönem, cari kimliği, şablon, sonuç kalır —
  S-W3'ün anonim izi); tam kayıt yeni yıl dosyasında durur (DOKUNULMAZ) ve saklama orada çalışır. KVKK etkili → kullanıcıya gösterilir.
- **B-2 G3'te olmayan 5 tablonun sınıfı:** `ledger_vouchers`, `ledger_voucher_lines`, `ledger_snapshot_runs`, `ledger_snapshots`, `ledger_valuation_cards` → öneri "≤K budanır, yeni yılda açılış /
  kapsam K" (C2 §11, C3 §11 önerileriyle aynı).
- **B-3 Devir satırını tanıma:** dizinli `devir_run` sütunu (göç G-2) mı, deterministik kimlik öneki mi (göçsüz)? Öneri: sütun (Devri Yenile'nin dar silmesi, ekran koruması, sorgu dizini).
- **B-4 KDV açılışının (190, 191@dönem, 391@dönem, 360) alt defter yeri:** K6 fişe izin vermiyor. Öneri: ayrı alt defter satırı (yeni tablo ya da KDV alt defterinde açılış türü; göç G-3) +
  `figureTable` dönem etiketini oradan okur + Defter Mutabakatı beklenenine eklenir.
- **B-5 Devri Yenile'de yeniden yazılan fişin numarası** (C2 kısıt (3)): öneri aynı numara (yerinde güncelleme; yevmiyede boşluk yok). Mali müşavir S'de görüş.
- **B-6 Arşivli şirkette Şirket Verisini Sıfırla** (D2 K5): öneri izinli; `devir.*` korunur, devir tabanı K öncesine yazımı engeller.
- **B-7 Defter kural sürümü** (`general-ledger.mjs:27`): devir satırı kuralları eklenince artırılsın mı — öneri artırılır; yanlış "Kural Değişikliği Farkı" alarmı testle denenir.
- **B-8 D4'ün üçe bölünmesi** (D4a kurallar, D4b uygulayıcı + takas + Geri Al, D4c Devri Yenile) — öneri bu (tek ajan turuna sığmaz; birleşik kabul daha zor).
- **B-9 Ön izleme hız önlemi:** kapanış bilançosu için tam `balanceSheet` yerine hesap bazında mizan + Ç6'nın dönem sonucu / değerleme işlevleri (06.11 (2) "tek kaynak" kararının yorumu —
  dönem sonucu ve N-01 yine Ç6'dan). Ölçümden sonra kesinleşir.
- **B-10 Devri Geri Al'da `belgeler/`** yedekten geri yazılmaz, yalnız eksik dosyalar tamamlanır (devirden sonra eklenen belge kaybolmasın).
- **B-11 Ön denetimde Aralık KDV mahsubu:** G4 "UYARIR" aynen, ama sihirbazda belirgin uyarı + "Önce Aralık Mahsubunu Yapın" bağlantısı (Ocak başındaki devirlerin çoğu buna düşer).
- **B-12 Kopyadaki tek büyük işlemin 1 M'de parçalanması** (freezeSync iş parçacığı kipi) — 1 M ölçümünden sonra.
- Türetilmiş kurallar (soru değil; BAŞ MİMAR KARARI olarak gösterilir — tasarım notu §3.5, §3.8, §4.4): devir Borç / Alacak Toplamı TYK'dan önce netleşir; vadesiz açık kalemin `due_date`'i
  belge günü; Ödeme Sözü taşınır; kapalı kart da tek açılış alır; ≤K kaynaklı türetme yeni yılda kapalı; devir tabanı (kilitten bağımsız); G2 / G3 iç çelişkisinde G2 geçerli.

## Planın eskiyen yerleri (DEVIR-PLANI.md'de düzeltilecek — ayrıntı tasarım notu §1.3)
Durum satırı ve §10 "2.5.0"; §2 yerinde budama; §3 tablosu (audit_events, trash, cari is_opening); §4.1 "karşı hesap 500", "is_opening eklenir"; §4.2 devir faturası; §4.3 "fiş saklamaz", "690…692
yok", "opening-diff"; §4.4 / §5 / §6 / §7.4 / G11 satır numaraları; §7.1 "son göç 30"; §7.2 dosya adları; §7.4 ve G2 "invoice-settle"; §7.6 busyCompanies; §8.6 "silinmiş ürün 153'te kalır" (S207 = A);
§9 kâhin yeri; G1.1 "e-Belge turları"; G2 ↔ G3 açık fatura iç çelişkisi; G3 "75 tablo", "ledger_snapshots ölü ad", listede olmayan 5 tablo; G3 doubtful / plans / cheques "açık kalır" (≤K tarihli
madde sorunu); G3 bank_accounts "kural D2'de" (D2 yapmadı); G8 belge temizliği (D2 yapmadı), users (doğrulanmadı); G12 sıra; G13 "açık" (G14'te yanıtlı).

## Önerilen paketleme ve sıra (tasarım notu §6)
D4-ÖK (Windows yeniden denemeli taşıma ×2, belge temizliği, iki yorum) ‖ D3 (saf hesap + rapor + ön denetim; çekirdeğe dokunmaz) → D4a (devirli dosyanın kuralları + göçler; M1, M2 ana dala
girdikten SONRA — `tax.mjs` / şüpheli modülü çakışması; H yapısal hız ile aynı dalgada değil) → D4b (uygulayıcı + takas + Geri Al) → D4c (Devri Yenile) ‖ D5 (sihirbaz, arşiv görünümü, kılavuz)
→ D6 (WhatsApp ilke 5; Ç5-C'den sonra ya da aynı ajanda) → D-SON (mutasyon, bağımsız gözden geçirme, mali müşavir S, UD, elle kabul). Kritik yol D3 → D4a → D4b → D4c. UYARI: D4c (Devri Yenile)
kesme çizgisine girmemeli — Aralık KDV mahsubu ve geç gelen Aralık faturasının tek yolu.

## 7. Kâhin bakımına girdi (yalnız EKSİK SINIF + karar dayanağı; kural metnini ana oturum yazar — ders 5, 40)
Mevcut: muhasebe kâhininde devir olayları (`devir`, `devri_yenile`, `devri_geri_al`) ve 28 senaryo + 3 rastgele tohum (s21–s29, s31, s32, s34, s39, s45–s48, s50, s56, s63, s66, s72, s73, s04,
rastgele 1–3); sürücü devir olaylarını bugün "uygulanmadı" sayıyor (`test/bagimsiz/muhasebe-surucu/program.mjs:1219`). Cari kâhininde ve WhatsApp kâhininde devir sınıfı YOK.
Devir senaryolarında HİÇ geçmeyen sınıflar (senaryo dosyalarında olay adı taraması):
1. Kredi (300.NN) devri — kitap M-06 / N-09, §6.4.
2. Hesabı atanmamış 102.00 / 108.00 bakiyesi ve Devir Kapanışı × devir — S179, S184, S215 (+ kitap §6.2).
3. KG-16 "Açılış Olabilir" onay bekleyen aday × devir — KG-16 = A, S47; S-2'nin yanıtına bağlı.
4. Kural Farkı (KG-15) × devir; arşivlenmiş yıldaki farkın yeni yıla taşınması — KG-15 = A, EK-1 M7 son cümlesi (README'de "senaryoda yok" diye yazılı); S-3'ün yanıtına bağlı.
5. Excel'den yüklenmiş taksit kartı (KG-5) açıkken devir — KG-5 = A, G3 "kart kalır".
6. Kapalı / ödenmiş taksit kartı × devir (tek açılış) — G3, M2 değişmezi.
7. Değersiz Alacak (J-05) ≤K × devir — M13, G3 (kapanmış şüpheli budanır).
8. ≤K kayıt silme / iptal / düzenleme × devir ve yeni yılda Silinenler'den ≤K geri alma reddi — G3 (trash seçici), plan §7.5 ("devir-closed"), kitap R-04.
9. e-SMM / gelen SMM ve Serbest Meslek / İşletme Hesabı Defter Türü × devir (arşiv kendi Defter Türü) — iş listesi D4 notu (Ç4 dar kontrolü).
10. Cari türü değişimi × devir — kitap G-2.
11. Ödeme Sözü olan açık kalem × devir — EK-1 M2 değişmezi, S67, S69.
12. Ödeme Hatırlatma (hatırlatma çıktısı) devirli = devirsiz — S3 / S7 = A (Ç5-C'ye bağlı).
13. Devri Geri Al → yeniden devir — plan §8.11.
14. İkinci yıl devri (önceki yılın 590 / 591'i) — §11.1 + S-1'in yanıtı (README "zincirleme ikinci yıl devri senaryoda yok").
15. 691 ≠ 0 ile kapanış — EK-2 S40 (kâhinde yazan olay yok; D4 birim testi de gerekir).
16. WhatsApp kâhini: Devri Geri Al / devir öncesi yedeğe dönüşte wa_jobs ↔ makine defteri birleşimi — WhatsApp genel ilkesi (5), DEVIR-PLANI G5.
DOĞRULANMADI (senaryo içeriği okunmadı, yalnız olay adı tarandı): vadesiz açık kalem (S1 × M2), iki seçenekte K'de gecikmiş kalem (s26a / s26b), Devri Yenile'de Aralık KDV mahsubu (s28) —
var olan senaryolar kapsıyor olabilir; kâhin bakım ajanı kendi dizininden denetler.

## DOĞRULANMADI
- Hiçbir ölçüm yapılmadı: D3 ön izleme süresi tahmini yalnız S224'ün ölçülmüş Bilanço / Gelir Tablosu sürelerinden; TYK'nın bütün cariler için toplu süresi bilinmiyor.
- Kartın "alttaki borç" eşlemesinin (M1e) devir net satırını nasıl göreceği yalnız tasarım düzeyinde (obligation-queue.mjs derin okunmadı).
- `stock-valuation.mjs`'in devirli dosyada DBS = açılış hareketleri yolu (C6 §3'ten okundu, kod koşulmadı); eksi açılış miktarının 0 sayılması (M5).
- Hesapsız 102.00 / 108.00 bakiyesinin banka alt defterindeki yeri.
- `message_sends`'in içerik / telefon taşıyıp taşımadığı (B-1 kapsamı) — tablo şeması ayrıntılı okunmadı.
- G8 "arşivde users ortak katmandan okunur".
- `ledger_voucher_lines_closed` tetikleyicisinin N-13 boyutunda maliyeti.
- Çek modülünde durumun olaydan mı alandan mı türetildiği (devir olayının biçimini etkiler).

## SONRAKİ SÜRÜME / SONRAYA (20.11 kuralı — programı etkilemeyen)
- `DEVIR-PLANI.md`'nin eskiyen satırlarının düzeltilmesi (belge işi; ana oturum).
- Muhasebe kâhini README'sinin "güncel kurallar dizini" + "bakım geçmişi" diye bölünmesi (2.5.1 iç işi; bu okumada dizin yoktu).

## Commit listesi (dal `worktree-agent-ae4427ae91f2e0bac`, taban 64396478)
- 696664b6 P-D: devir planı ↔ kod eşlemesi ve tablo sınıflaması (§1–§2)
- 33f231ed P-D: D3 tasarımı (§3)
- 8c87a7b8 P-D: D4 tasarım iskeleti (§4)
- 4700a779 P-D: paketleme önerisi (§6)
- (bu rapor commit'i — dal ucu raporun sonundaki son satırda değil, SubagentHandback iletisinde)
