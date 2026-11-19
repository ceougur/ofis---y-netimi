# Ç7b — Kitap Türetme Kuralları: Fatura / KDV / Taksit / Kayıt — Tasarım Notu (2.5.0)

Taban `c7b-taban` = 9c09f18d (sınama ucu: çalışma dalı + Ç5-A tur 3 + Ç7a + kâhin bakımı 12 + tur 2f). Görev metni `docs/devir/2.5.0-DEVAM/c7b-istem.txt`. KODDAN ÖNCE yazıldı.
Kaynaklar: kural kitabı (F-01…F-17, H-03, H-07, K-01, K-02, C-01, C-02, T-14, V-01, KG-2 / KG-3 / KG-4 / KG-7 / KG-8 / KG-23 / KG-24, G-8, §7.5 (6)), EK-1 M8 (6) / M14 / S1–S5,
EK-2 soru 37 / 38 (E16 / E17), kullanıcı kararları 05.11 17:16 ("hepsi A"), 05.11 21:30 (karar (6)), 05.11 18:55 (S1–S5), 06.11 06:26 (S25), S15, S49; BAŞ MİMAR KARARI 19.11
(carisiz Kasa girişi 649.90).

## 0. Özet — en önemli bulgu (DUR, raporla — Ç7a tur 1'in §0'ıyla aynı tür)

Defter `journal(rows)`'tan türetilir; ama türetmenin DOĞRULAYICISI (Defter Mutabakatı / Mutabakat Testi / kapı: alt defter ↔ ana defter) `server/routes/ledger.mjs expected()`'tedir ve
iki kuralın istediği girdi `routes/ledger.mjs rows()`'ta yoktur. Görev metninin dosya sınırında `routes/ledger.mjs` YOK (yazılabilir listede değil; "Başka dosya gerekirse DUR, raporla").
Ayrıca Kartı Kapat'ın cari bakiyesindeki etkisi `server/lib/account-lines.mjs`'tedir (YAZILMAZ listesinde).

| Kural | Türetme (general-ledger) | Doğrulayıcı / girdi | Dosya sınırında mı | Sonuç |
|---|---|---|---|---|
| F-06 / M14 (760 / 770 / 780 / 255) | gider türünün hesabı faturanın `gl_json`'ında (lib/invoice-math.mjs EXPENSES) | — | — | 760 / 770 / 255 / 653 ZATEN UYUYOR (kalıcı test); 780 türü listede YOK → §9 B-1 |
| K-01 / K-02 / C-01 / C-02 (.90 alt hesapları) | journal | 6xx / 7xx'in alt defter beklenini yok | EVET | KODLANIR (§2.1) |
| KG-2 (600.90 / 610.90; H-03) | journal | 6xx beklenini yok | EVET | KODLANIR (§2.2) |
| KG-3 (kayıt tahsilatı 336.90) | journal | `expected()[336]` = "Diğer" carilerin toplamı → 336.90 Defter Mutabakatı'nı kırar | HAYIR | KODLANMADI → §9 B-2 |
| KG-24 (ihracat 601) | journal | rows().invoices yalnız `gl_json` (hesap → net) taşır; kalemin istisna kodu (301 / 302) YOK | HAYIR | KODLANMADI → §9 B-3 |
| KG-8 / F-08 (iade KDV'si 191 / 391) | journal | `expected()[191]` / `[391]` faturalardan SQL'le eski yönle → Defter Mutabakatı kırılır | HAYIR | KODLANMADI → §9 B-2 |
| S4 (mahsuptan sonra 191'i azaltan kayıt) | KDV Mahsup ön izlemesi (`routes/tax.mjs monthFigures`) | — | EVET | KODLANIR (§2.3) |
| Karar (6) / KG-23 Kartı Kapat "Borçta Kalsın" | journal `plan-close` (B 689 / A CH) | cari bakiyesi `lib/account-lines.mjs` "plan-close" satırı, `routes/ledger.mjs` 127 beklenini + cari bakiye SQL'i, kuyruk | HAYIR (YAZILMAZ) | KODLANMADI → §9 B-4 |
| YB-1 (eskimiş "Kalan X" onayı) | — | `routes/plans.mjs` PUT + `hof-plans.js closePlan` | EVET | KODLANIR (§2.4) |
| S15 / S25 (a)–(c) | Ç5-A tur 3c / birleşik tur 8'de yapıldı | — | — | yalnız kalıcı test (§2.5) |
| KG-7 (KDV İndirim Dönemi) | journal DEĞİŞMEZ (191 belge tarihinde); mahsubun seçimi `tax.mjs`'te | göç 51 + `invoices.mjs` + fatura formu + `tax.mjs` | EVET | KODLANIR (§2.6) |

## 1. Bugünkü maddeler (koddan, `journal()`'ın kendisiyle yeniden üretildi — not defteri `c7b-ana/uretim/taban.txt`; ders 6)

Örnek (Mart 2026; TL): kayıt tahsilatı nakit 1.000 · Kasa + 300 · Kasa − 200 · Borç Yaz 500 · Alacak Yaz 150 · stok veresiye satış 1.200 · stok satış iadesi (cari) 240 · taksit
Yeni Borç 6.000 · stok peşin satış 600 · stok peşin iade 120 · satış faturası 10.000 + KDV 2.000 · ihracat 5.000 (%0, 301) · satıştan iade 1.000 + 200 · gider alışı 770 2.000 /
760 1.000 / 255 500 + 700 · alıştan iade 200 + 40 · kart (1.000, 400 ödendi) Kartı Kapat.

| Olay | Bugün (taban) | Kitap | Bu turda |
|---|---|---|---|
| kayıt tahsilatı (T-14) | B 100 / A 602 1.000 | B 100 / A 336.90 (KG-3 A) + Kesin Değil | KODLANMADI (§0) |
| Kasa + (K-01) | B 100 / A 649 300 | B 100 / A 649.90 (KG-3 A + BAŞ MİMAR KARARI 19.11) | **B 100 / A 649.90** |
| Kasa − (K-02) | B 770 / A 100 200 | B 770.90 / A 100 | **B 770.90 / A 100** |
| Borç Yaz (C-01) | B 120 / A 602 500 | B CH / A 602.90 (KG-4 A) | **A 602.90** |
| Alacak Yaz (C-02) | B 770 / A 120 150 | B 770.90 / A CH (KG-4 A) | **B 770.90** |
| stok veresiye satış (S-03) | B 120 / A 600 1.200 | A 600.90 (KG-2 A, KDV ayrılmaz) | **A 600.90** |
| stok satış iadesi, cari (S-04) | B 610 / A 120 240 | B 610.90 | **B 610.90** |
| stok peşin satış / iade | A 600 600 · B 610 120 | 600.90 / 610.90 | **600.90 / 610.90** |
| taksit Yeni Borç (H-03) | B 120 / A 602 6.000 | B CH / A 600.90 (KG-2 A) | **A 600.90** (ana hesap 602 → 600) |
| satış faturası (F-01) | B 120 12.000 / A 600 10.000, A 391 2.000 | aynı | değişmez |
| ihracat (F-02, KG-24) | A 600 5.000 | A 601 | KODLANMADI (§0) |
| satıştan iade (F-07, KG-8) | B 610 1.000, **B 391 200** / A 120 | B 610, **B 191** | KODLANMADI (§0) |
| gider alışı (F-06) | B 770 / 760 / 255, B 191 / A 320 | aynı (M14) | değişmez — kalıcı test |
| alıştan iade (F-08) | B 320 / A 153 200, **A 191 40** | A 153, **A 391** | KODLANMADI (§0) |
| Kartı Kapat (H-07, KG-23 A, karar (6)) | B 689 / A 120 600 | madde yok, alacak CH'de | KODLANMADI (§0) |

Değişmeyen (kitaba zaten uyan): F-01, F-03…F-05, F-06 (760 / 770 / 255 / 653), F-10, F-11, F-15 (iptal maddesiz), S-02, S-05, H-01, H-02, H-04, H-05, V-01'in NET formülü (monthFigures
191 / 391'i net okuyor — EK-1 M8 (6) "İ = NET hareket" bugün de böyle; S4'ün açığı yalnız ay seçimidir, §2.3).

## 2. Tasarım

### 2.1 .90 alt hesapları (K-01, K-02, C-01, C-02; G-8; EK-2 E16 / E17)
`journal()`: Kasa carisiz girişi `{ 649, 649.90 }`, carisiz çıkışı `{ 770, 770.90 }` (vergi ödemesi ve açılış dalları değişmez); işaretsiz Borç Yaz `{ 602, 602.90 }`, Alacak Yaz
`{ 770, 770.90 }` (açılış işaretli olanlar 519 — değişmez). Ana hesap bakiyeleri DEĞİŞMEZ (yalnız alt hesap kırılımı). Faturalı gider alışı 770 ana hesapta kalır (E17: belgeli giderin
varsayılanı 770; .90 yalnız tanınmayan değer ve belgesiz çıkış). Tanınmayan gider türü kodu bugün `lineAccount` ile 770 olur (lib/invoice-math.mjs — dosya sınırı dışında; §9 B-1).

### 2.2 KG-2 = A (600.90 / 610.90; H-03, S-03, S-04)
`journal()`: stok modülü veresiye satış (`account_entries.source = 'stock'`, borç, iade dışı) ve peşin satış (`stock_moves` çıkış, iade dışı) `{ 600, 600.90 }`; müşteri iadesi (cari ve peşin)
`{ 610, 610.90 }`; taksit kartı Yeni Borç (`!coversBalance && !importId`) `{ 600, 600.90 }` (ana hesap 602 → 600; GT A Brüt Satışlar içinde kalır, net kâr aynı). KDV ayrılmaz (tutarın tamamı).
Tedarikçi iadesi (153) ve stok + giriş (153) değişmez. Dipnot (§7.5 (6)) Ç6'nın işi.

### 2.3 S4 = A — mahsuptan sonra girilen, indirilecek KDV'yi azaltan kayıt (`routes/tax.mjs`)
Bugün: ay M'nin ön izlemesi YALNIZ tarihi M'de olan 191 / 391 hareketini okur. Mahsubu yapılmış ay k'ye (k < M) sonradan düşen ve 191'i alacaklandıran kayıt (ör. Mart'ın faturalı banka masrafının
Nisan'da Ters Kaydet'i — tarihi Mart; s43) hiçbir mahsuba girmez → 191 kalıcı eksi, 360 eksik.
Tasarım (S4'ün metni: "indirilecek KDV'yi AZALTAN kayıt → girildiği ayın mahsubunda"): şimdi(k) = k ayının bugünkü net 191'i (KG-7 dönemine göre), saklı(k) = k'nin ETKİN mahsubunun İ'si.
Ay M'nin ön izlemesinde C = Σ_{k < M, k'nin etkin mahsubu var} (şimdi(k) − saklı(k)) (birikmiş fark); İ_M = şimdi(M) + min(0, C). Yalnız AZALTAN birikmiş fark taşınır; artıran fark (geç gelen
fatura, 391 farkı) bugünkü gibi o ayın "Güncel Değil" uyarısı + Geri Al ile (EK-1 M8 (6) son cümlesi; ders 45 — yeni engel yok). Çift sayım yok: M'nin mahsubu yazılınca saklı(M) = şimdi(M) + min(0, C)
→ M + 1'in birikmiş farkı C + (şimdi(M) − saklı(M)) = C − min(0, C) = max(0, C) (azaltan kısım sıfırlanır).
Güncel Değil (`stale`) işareti: 391 için bugünkü gibi (şimdi ≠ saklı); 191 için şimdi(k) + min(0, C_{<k}) − saklı(k) > 0 (yalnız ARTIRAN fark uyarır; azaltan fark sonraki mahsuba taşınır, uyarı
değildir — bekleyen tutar ön izlemede "önceki ayların mahsubundan sonra girilen … X TL bu aya eklendi" satırıyla görünür). Karışık ay (aynı ayda hem artıran hem azaltan sonradan kayıt): net
artıransa ay Güncel Değil, taşıma yok (Geri Al + yeniden — iki kayıt birlikte girer; BİLİNEN SINIR). Kilitli ay: kilitli ayın mahsubu yazılamaz / geri alınamaz (bugünkü gibi); fark ilk
açık ayın mahsubuna girer. Defter: mahsup fişi saklı tutarlarla türetilir (değişmez); 191 ay sonunda (taşıma bekleyen ay) eksi görünebilir — taşındığı mahsuptan sonra 0.

### 2.4 YB-1 — eskimiş "Kalan X" ile Kartı Kapat
İstemci (`hof-plans.js closePlan`) onayladığı kalanı gövdede `closeRemaining` olarak gönderir (kalansız kart dahil). Sunucu (`routes/plans.mjs` PUT, işlemin İÇİNDE güncel kartla) `status`
closed'a geçerken `closeRemaining` verilmişse kartın GÜNCEL kalanı (kart penceresinin gösterdiği `detail().totals.remaining`) ile kuruşu kuruşuna karşılaştırır; farklıysa 409
`plan-close-stale` + güncel kalan; istemci güncel kalanla YENİDEN sorar (eski onay kullanılmaz). Gövdede alan yoksa (eski istemci) bugünkü gibi. Kartı Kapat'ın defter / cari etkisi bu
turda DEĞİŞMEZ (karar (6) — §0, B-4); pencere metni bugünkü davranışı söylemeye devam eder.

### 2.5 S15 = A, S25 = A (a)–(c)
Ç5-A tur 3c (S25; C5-ACILIS-TASARIM §19) ve Ç5-B / birleşik tur 8 (S15: iptal edilen faturanın kartı kapanır, kartın tahsilatları avans) koddadır → bu turda yalnız bugünkü kodda
yeniden üretim + kalıcı test.

### 2.6 KG-7 = A — "KDV İndirim Dönemi" (KDVK 29/3)
- Şema: göç 51 `invoices.vat_period TEXT NOT NULL DEFAULT ''` (YYYY-AA; boş = belge ayı). Yalnız ekleyici; eski veri boş → belge ayı (bugünkü davranış). Şema kapısı / geri yükleme
  komşudur (ders 10).
- Alan: yalnız ALIŞ faturasında (purchase; Stoğa Mal Alışı ve Hizmet ve Gider Alışı). Seçenekler: belge ayı … belge yılını izleyen yılın Aralık'ı (EK-1 M8 (1)); belge ayından önce olamaz.
  Kaydedilmiş (kesilmiş) faturada da düzenlenir (Düzenle yolu; kilitli dönemde ay seçimi kilitli olamaz: seçilen ayın sonu kilit gerisindeyse 409). e-Belge çıktısı DEĞİŞMEZ (UBL'e girmez).
- Mahsup: `monthFigures(M)` — alış faturasının 191 satırı `vat_period`'u M ise M'ye, belge ayı M ama `vat_period` başka aysa M'den düşülür. Tek toplu SQL (vat_period ≠ '' ve ≠ belge ayı
  olan faturalar; ders 47). Defter maddesi DEĞİŞMEZ (191 belge tarihinde; ay sonu 191 bakiyesi mahsupsuz kalan tutarı gösterir — §7.3 "191 mahsupsuz aylarda netleştirilmez").
- Alıştan iade faturası: asıl faturanın dönemini izlemez (S4 / KDVK 35: iade kendi ayında) — alan iadede YOK.

## 3. Okuyucular (ders 10)
| Okuyucu | 2.1 / 2.2 | 2.3 | 2.4 | 2.6 |
|---|---|---|---|---|
| Yevmiye, Hesap Planı Mizanı, Alt Hesap Mizanı (journal / trialBalance / subTrial) | alt hesap satırları değişir; ana hesap bakiyesi yalnız taksit Yeni Borç'ta 602 → 600 | — | — | — |
| Defter Mutabakatı / Mutabakat Testi / kapı (`expected()`) | 6xx / 7xx beklenini yok → etkilenmez | — | — | — |
| Kural Değişikliği Farkı / Kural Farkı Düzeltme Fişi (Ç3 / Ç5-A) | kilitli dönemde 649 → 649.90 vb. alt hesap farkı ve 602 → 600.90 farkı görünür; fiş farkın yılına göre (aynı yıl: eski hesabın tersi; önceki yıl 671 / 681 — M7) | — | — | — |
| "Kilitlenmemiş Geçmiş Yıl … Yeni Kuralla Hesaplandı" (lib/ledger-opening.mjs unlockedPastYears: 519 / 649.90 / 770.90) | Kasa'lı geçmiş kilitsiz yılda da bilgi satırı çıkar (dosya YAZILMAZ; metin açılış kurallarını sayar — §9 B-5) | — | — | — |
| KDV Mahsup ön izleme / liste / `stale` | — | değişir | — | değişir |
| Taksit kartı penceresi / liste | — | — | kapatma onayı | — |
| Fatura formu / listesi / PDF / UBL | — | — | — | yalnız form (alış); PDF ve UBL değişmez |
| Mobil özet, yedek / geri yükleme, dondurma, bütünlük kapısı | journal'dan okur; şema 51 yedekle taşınır | — | — | şema |

## 4. Nasıl bozulur? (önce yazıldı; testler buradan)
1. Sıra: aynı gün Kasa girişi + Borç Yaz + stok satışı → alt hesap toplamları sıradan bağımsız.
2. Açılış işaretli Borç Yaz / Kasa açılışı / vergi ödemesi yanlışlıkla .90'a gider (dallar ayrı kalmalı).
3. Kasa ↔ Banka transferi 649.90 / 770.90'a düşer (transfer dalı ayrı kalmalı).
4. Mevcut Borç (coversBalance) ve Excel kartı (importId) 600.90'a düşer (yalnız Yeni Borç).
5. Kilitli v2.4.9 verisi: donmuş defter değişmez; kural farkı 649 → 649.90 vb. alt hesap farklarını ve 602 → 600.90'ı TAM gösterir; Kural Farkı Düzeltme Fişi → Düzeltildi.
6. S4: (a) mahsup → Ters Kaydet (önceki ay tarihli) → sonraki ayın mahsubu kalıntıyı alır, 191 = 0; (b) iki ay üst üste kalıntı → çift sayılmaz; (c) sonraki ay mahsubu Geri Al → kalıntı geri
   döner; (d) artıran kalıntı (geç gelen fatura) → taşınmaz, Güncel Değil uyarısı; (e) kilitli ay.
7. YB-1: tahsilat silinince / tutar değişince eski onay 409; güncel kalanla yeniden soru; kalansız kartta (eski kalan 0, yeni kalan > 0) da 409; eski istemci (alan yok) bugünkü gibi.
8. KG-7: belge ayı < dönem ≤ izleyen yıl Aralık; sınır dışı 400; Aralık faturası Ocak dönemine (yıl dönümü); iki TZ'de ay sonu; dönemi değişen faturanın eski ay mahsubu Güncel Değil;
   alış dışı türde alan reddedilir / yok sayılır; e-Belge çıktısı aynı; eski şema (≤ 50) yedeği geri yüklenince göç 51 koşar; iki şirket.
9. Yarıda kesilme: mahsup ve kart kapatma tek işlem (store.tx) — bugünkü gibi.

## 9. BAŞ MİMAR KARARI GEREKİYOR (mimari — seçenek + öneri + gerekçe; ders 40)
- **B-1 — F-06 / M14 finansman (780) gider türü ve tanınmayan tür (770.90).** Gider türü listesinde (lib/invoice-math.mjs EXPENSES) finansman türü YOK; tanınmayan kod 770'e düşer. (A) listeye
  "Finansman Giderleri (Kredi Faizi, Kredi Masrafı)" → 780 ve tanınmayan → 770.90 (invoice-math.mjs; kayıt anında gl_json'a yazılır — eski faturalar değişmez); (B) 2.5.1. Öneri: B (görev
  metni: "yeni alan bu işin kapsamında değil — varsayılan 770 kalır"; kredi faizi bugün Banka Fişi'nden 780'e yazılıyor — K-11).
- **B-2 — `routes/ledger.mjs expected()`'e yazma izni (KG-3, KG-8, F-08).** Gereken en küçük ek: `out[336] −= Σ kayıt tahsilatı` (payments; 336.90 satırları cari değildir) ve 191 / 391 SQL'inde
  satıştan iade KDV'si 191'e (+), alıştan iade KDV'si 391'e (−). Türetme ile aynı turda (ikisi ayrı turda olursa arada Defter Mutabakatı kırmızı). Öneri: sonraki Ç7b turuna
  `routes/ledger.mjs` YALNIZ expected() izni.
- **B-3 — `routes/ledger.mjs rows()`'a kalem istisna kodu (KG-24).** `gl_json` hesap → net taşır; ihracat kalemi (istisna 301 / 302) ayrılamaz. (A) rows().invoices'a kalem bazında
  `exportNet` (SUM net WHERE exemption_code IN ('301', '302')) — journal 600'ün o kısmını 601'e taşır (eski veri de; kural farkı görünür); (B) kayıt anında gl_json'a 601 — eski veri değişmez,
  kilitli farkı görünmez (Ç7a §0 bu yolu reddetti). Öneri: A.
- **B-4 — karar (6) / KG-23 "Borçta Kalsın" dosya sınırı.** Kalanın carinin borcundan düşmesi `lib/account-lines.mjs` (kartın "Kart kapatıldı · kalan düşüldü" satırı; YAZILMAZ — kuyruk),
  `routes/ledger.mjs` (127 beklenini, cari bakiye SQL'i), `lib/obligation-queue.mjs` (kapalı kartın kalanı) ve journal'ın `plan-close` maddesinde. Yalnız journal değişirse 120 Defter
  Mutabakatı kırılır. Öneri: kuyruk dosyalarına dokunma izniyle ayrı tur (Ç5-B'nin kuyruk kuralıyla birlikte; cari kâhini önce / sonra).
- **B-5 — "Kilitlenmemiş Geçmiş Yıl" bilgi satırı (`lib/ledger-opening.mjs unlockedPastYears`).** 649.90 / 770.90'ı Ç5-A işareti sayar; §2.1'den sonra Kasa'lı her kilitsiz geçmiş yılda çıkar ve
  metni yalnız açılış kurallarını sayar. (A) işaret listesini korumak (bilgi satırı geniş, ama doğru: yıl yeni kuralla hesaplandı); (B) metne "ve sınıflandırılmamış alt hesaplar" eklemek
  (ledger-opening.mjs izni). Öneri: A şimdilik, metin Ç6-HESAP'ta.

## 10. KULLANICIYA SORULMALI
- (yok — kodlanan kurallar kullanıcı kararlarından; S4'ün "yalnız azaltan kalıntı" okuması kararın metnidir: "indirilecek KDV'yi azaltan kayıt".)

## 11. Tur 2 (19.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b2-istem.txt`) — §9'un kararları ve kod sürerken değişen yerler
Kararlar (iş listesi D, BAŞ MİMAR KARARI 19.11 04:03): B-1 = B (780 türü ve tanınmayan türün 770.90'ı 2.5.1); B-2 = İZİN (`routes/ledger.mjs` YALNIZ expected()'in 336 / 191 / 391 kalemleri, türetmeyle
aynı turda); B-3 = A (rows().invoices'a kalem bazında ihracat payı); B-4 = AYRI TUR (karar (6) / KG-23 "Borçta Kalsın" Ç7b TUR 3; YB-1 bu turda); B-5 = A (işaret listesi korunur). Böylece §0
tablosunda KG-3, KG-24, KG-8 / F-08 "KODLANIR"a geçti; Kartı Kapat'ın defter / cari etkisi DEĞİŞMEZ (tur 3).

### 11.1 Kod sürerken değişen / eklenen yerler
- `server/lib/general-ledger.mjs`: `UNCLASSIFIED_GL` (cashIn / cashOut / debtWrite / creditWrite / sale / saleReturn / collection — §2.1, §2.2, KG-3); `EXPORT_SALES_GL` = "601",
  `EXPORT_EXEMPTIONS` = 301 / 302 (lib/invoice-math.mjs EXEMPTIONS'ta "11/1-a Mal İhracatı" / "11/1-a Hizmet İhracatı" — başka kod ihracat sayılmaz; ihraç kayıtlı 701–704 vb. 600'de kalır),
  `exportSplit()`; hesap planına **601 "Yurt Dışı Satışlar"** (gelir, GT A — kural kitabı §2 satırı; plan tanımında yoktu). Kayıt tahsilatı A 336.90 (party YOK — cari değil).
- `server/routes/ledger.mjs`: rows().invoices `exportJson` (yalnız ihracat kalemi olan satış / SMM'de, hesap → [ihracat neti, toplam net] kuruş; fatura başına `invoice_lines(invoice_id, seq)` indeksiyle bir arama);
  expected(): 336 −= Σ payments (KG-3), 191 = alış + satıştan iade, 391 = −(satış + alıştan iade) (KG-8 / F-08). Defter Mutabakatı'nın öbür kalemleri ve kilit izi DEĞİŞMEDİ.
- Satıştan iadenin ihracat kalemi 610'da kalır (F-07; kalem hesabı lineAccount("sale_return") = 610 — KG-24 yalnız satış / SMM).
- Kural sürümü: `LEDGER_RULE_VERSION` "2.5.0-defter" GENİŞLER (B15 (a) / Ç7a B2 düzeni: yayımlanmamış ara kural; 2.4.9 kopyası `lib/ledger-rule-249` değişmez) — kilitli v2.4.9 verisinde fark
  ruleDiff'te görünür. Hangi fark fişe girer: 6 / 7 sınıfı (649 → 649.90, 770 → 770.90, 602 → 602.90 / 600.90, 600 → 600.90 / 601, 610 → 610.90) Kural Farkı Düzeltme Fişi'ne; 336 / 191 / 391
  ALT DEFTER hesabıdır (subledgerAccounts = expected()'in anahtarları) → B14 (a): fişe yazılmaz, birikimli farkı sıfır değilse katkı veren maddelerin BÜTÜN farkı fişin dışında kalır.
- "Kesin Değil" (KG-3 B "336.90 … + Kesin Değil"): bugün defter / mizan ekranında alt hesap için gösterge YOK (ACCOUNT_PLAN'ın `ters` alanı yalnız bilanço sunumu — Ç6). Yeni ekran açılmadı;
  bağlantı noktası Ç6-HESAP (336.90 satırı party taşımaz → bilanço brütleştirmesinde "cari" boyutuna girmez).

### 11.2 Yeni bulgu — KG-8 ile ESKİ KDV mahsupları (BAŞ MİMAR KARARI GEREKİYOR: B-6)
KDV Mahsup Fişi saklı tutarlarla türetilir (vat_offsets.out_minor / in_minor). KG-8 / F-08 iade KDV'sini 391 ↔ 191 arasında taşıyınca, KURAL DEĞİŞMEDEN ÖNCE yazılmış ve ayında iade olan
mahsupta H ve İ ikisi de Δ = (satıştan iade KDV'si + alıştan iade KDV'si) kadar "güncel"den ayrışır (ödenecek / devreden DEĞİŞMEZ: H − İ aynı). Sonuç: o ay "Güncel Değil" görünür ve mahsuptan
sonra 191 = +Δ (borç), 391 = −Δ (alacak) kalır (toplamı 0; 360 / 190 doğru). Kilitli ayda 191 / 391 alt defter hesabı → fişle düzeltilmez (B14). Seçenekler: (A) göç 51'de etkin + geri alınmış
her mahsubun out_minor / in_minor'ına o ayın iade KDV'si Δ eklenir (H − İ, ödenecek, devreden, ters fiş aynı kalır; kilitli ayda donmuş ↔ güncel birikimli 191 / 391 farkı ay sonunda 0);
(B) dokunulmaz — kullanıcı açık ayda Geri Al + yeniden yapar (yalnız en son mahsup geri alınabildiğinden zincir geri alınır), kilitli ayda BİLİNEN SINIR. Öneri: A (para değişmez, yalnız
sınıflama; tek seferlik ve göç numarası zaten ayrıldı). Bu turda KODLANMADI (göç 51'in izni yalnız KG-7) — §11.3'ün kalıcı testi bugünkü (B) davranışını sayıyla gösterir.

### 11.3 S4 kodu (§2.3'ün uygulaması) ve F-08 ile ilişkisi
`routes/tax.mjs`: `figureTable()` (ayların 191 / 391 hareketi tek geçişte), `carriedBefore()` (etkin mahsupların İ farkı Σ, yalnız min(0, C) taşınır); ön izlemeye `carriedInMinor` + bilgi satırı;
listede `stale` = H farkı ya da İ'nin ARTIRAN farkı. Not: F-08'le alıştan iade (Ters Kaydet'in yazdığı bugün tarihli Alıştan İade dahil) 191'i değil 391'i hareket ettirir → sürücünün s43
örneği ("ters madde A 191 Mart'a etiketli") programda S4'e değil kendi ayının 391'ine düşer; S4 kalıntısını programda doğuran yollar: geçmiş aya düşen İptal Et / Düzenle / silme (alış faturası).

### 11.4 YARIM — kırık komşular (G2 taraması 185 dosya, UTC: 1970 / 2048 geçti, 66 başarısız, 12 iptal; ham çıktı not defteri `c7b2/komsu-utc1.out`)
Düzeltildi, HENÜZ KOŞULMADI (ölçüm kilidi dolu): acilis-519-250 (KG-4), hesap-plani-sinif-250 (601), banka-210-gg2-fis (F-08: 191 +20 / 391 −20), banka-220-pos-kabul (KG-8: 391 −7.000,
191 +500), mutabakat motoru 336 modeli (KG-3; banka-210-gg-cari, banka-210-gg2-hiz, banka-210-hiz-esdegerlik), eski düzen katlaması `test/guvenilirlik/defter-olgulari.mjs` (Ç7b → 2.4.9;
banka-210-altin, banka-210-goc-zinciri). DOKUNULMADI (sonraki tur): banka-220-senet-121 (eski veride kural farkı uyarısı — Ç7b sınıfları), banka-220-tahsile-ver-tur2 ("602 yalnız taksitli
satışlar" → 600.90), kapi-para-245 (incelenmedi), kasa-acilis-once-250 ("yalnız 500 → 519" → Kasa 649.90 / 770.90), kural-farki-duzeltme-250 ve kural-farki-yil-250 (Düzeltme Fişi satırlarına
Ç7b'nin 6 / 7 sınıfı farkları girer — kabul D'nin elle beklenenleri buradan), donmus-defter-250 / -bellek / -tur1 / -tur3 / -tur4 / -yasam (Ç3'ün 2.4.9 kopyası ↔ güncel türetme açıklama
kümelerine Ç7b kural kimlikleri: Kasa ± .90, Borç / Alacak Yaz .90, stok / taksit 600.90 / 610.90, kayıt tahsilatı 336.90, 601, iade KDV'si), defter-kaynak-iz-250 (aşağıda B-7).

### 11.5 Yeni bulgular
- **S15 = A KODDA YOK** (§2.5'in "Ç5-B / birleşik tur 8'de yapıldı" okuması YANLIŞ): tahsilatı olan taksitli faturanın İptal Et'i bugün 409 `plan-has-payments` ("fatura iptal edilemez. Borcu
  düşürmek için iade faturası kesin."); test/ertelenen-224 bu reddi bekliyor. Kodu `routes/invoices.mjs` iptal yolu + kartın kapanması (dosya sınırı dışında: invoices.mjs bu turda YALNIZ
  KG-7 / KG-24) → DUR, raporla. Yeniden üretim testi not defterinde (`c7b2/s15/c7b-s15-iptal-250.test.mjs`; depoya girmedi — kırmızı).
- **B-7 (BAŞ MİMAR KARARI GEREKİYOR) — KG-24'ün girdisi kilit izinde değil:** rows().invoices artık `invoice_lines.exemption_code / gl_account / net` okuyor; defter-kaynak-iz-250 bunları
  "kilit izinde olmayan türetme sütunu" diye kırıyor. (A) LOCK_SQL'e invoice_lines(exemption_code, gl_account, net) eklemek (kilit izi sürümü artar — `integrity.mjs` kilit izine bu turda
  dokunma yasak); (B) gerekçeli istisna (kesilmiş faturanın kalemi yalnız Düzenle ile değişir; Düzenle kilitli dönemde 409; gl_json zaten izde). Öneri: A (kalem istisna kodu gl_json'da yok —
  kapı dışı değişiklik izsiz kalır).
- **KDV Özeti raporu (report-center kdv-ozeti) DEĞİŞMEDİ:** "Hesaplanan" = satış − satıştan iade, "İndirilecek" = alış − alıştan iade (beyanname görünümü); defter artık KG-8 / F-08 ile
  391 = satış + alıştan iade, 191 = alış + satıştan iade. Ödenecek aynı; iki ekranın kalemleri ayrışır → KULLANICIYA SORULMALI (A rapor beyanname düzeninde kalsın — öneri; B defterle aynı).

## 12. Tur 2b (19.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b2b-istem.txt`) — kararlar ve kod sürerken değişen yerler
Kararlar (iş listesi D, BAŞ MİMAR KARARI 19.11 04:35): B-6 = saklı mahsup tutarı DEĞİŞMEZ, mahsubu güncellemeden ÖNCE yazılmış ayın iade KDV'si ESKİ yönle (göç 51 yalnız işaret); B-7 =
kalem alanları kilit izine (sürüm artar, var olan kilitte yanlış alarm yok); KDV Özeti DEĞİŞMEZ (A); S15 → tur 3.

### 12.1 Kırık komşular (§11.4'ün devamı) — beklenti değişiklikleri (her biri testte "BEKLENTİ BİLEREK DEĞİŞTİ" + karar numarasıyla)
- Ortak çeviri `test/fixtures/c7b-kural.mjs` (YENİ): 2.4.9 kopyasının maddesi → Ç7b güncel kuralı (K-01 / K-02, C-01 / C-02, KG-2, KG-3, KG-8, F-08; KG-24 kalem ister — çevrilmez) ve Kural
  Farkı Düzeltme Fişi'nin Ç7b payı (`c7bCorrectionLines`: aynı yıl aynı hesap, önceki yılın 6 / 7 sınıfı 671 / 681 — M7, alt defter hesabına dokunan madde fiş dışı — B14 (a)).
- `test/guvenilirlik/defter-olgulari.mjs`: Defter Mutabakatı / Mutabakat Testi'nin alt defter denetimleri (336 / 191 / 391) BÜTÜN canlı türetmeyi okur → katlamanın bütün zaman farkı
  (`deltaAll`) iki yana birlikte eklenir (`c5aReconciliationChecks`, `c5aIntegrity`, `c5aReconciliationReport`). `test/mutabakat/motor.mjs`: Hesap Planı Mizanı raporunun 336'sı da KG-3'le.
- banka-220-senet-121 (KG-2: kilitli kartın 900 TL'si 602 → 600.90; kural farkı 3 madde, 101.100 TL), banka-220-tahsile-ver-tur2 (KG-2: 600 −4.700), hesap-plani-sinif (istisna kodu 301 / 302
  hesap kodu değil), kapi-para-245 ve kasa-acilis-once (KG-3: kayıt tahsilatı 602 → 336), kural-farki-yil y7 / y10 (C-01: reddedilen Borç Yaz 602.90), kural-farki-duzeltme [2] / [4] / [7] / [8]
  (Ç7b sınıflama farkları fişte; [7] bozulan satır tahsilat; [8] elle Borç Yaz 1.000 602 → 602.90), donmus-defter-250 (kural tuzağı Ç7b çevirisiyle; 649 → 642 benzetiminde alt hesap düşer),
  defter-kaynak-iz-250 (karma ihracat satışı — B-7).

### 12.2 B-7 kodu
`server/lib/integrity.mjs` LOCK_SQL `invoice_lines_export_lock` (since "2.5.1"; yalnız ihracat kalemi olan satış / SMM faturasının kalemleri: id, fatura, hesap, istisna kodu, net) ve
LOCK_SQL_VERSION "2.5.1" (kilit izi TANIMININ sürümü). Önceki tanımla kaydedilmiş koşunun izi kendi sürümüyle karşılaştırılır (girdi atlanır). Süzgeç (`lib/integrity-scope.mjs` LOCK_FIELDS)
DEĞİŞMEDİ (dosya sınırı): kilitli kaleme programın yolundan yazım yok (Düzenle kilitte 409); kapı dışı yazım tam taramada görülür. Test `test/c7b-kilit-izi-250.test.mjs` (v2.4.9 gerçek kodu).

### 12.3 Yeni bulgular (DUR, raporla — dosya sınırı / karar)
- **B-8 — alt defter hesabına dokunan Ç7b kuralları kilitli dönemde "Düzeltildi"ye ulaşmaz.** KG-3 (602 → 336.90) ve KG-8 / F-08 (391 ↔ 191) kilitli eski veride ALT DEFTER farkıdır → B14 (a):
  maddenin bütün farkı fişin dışında, Kural Değişikliği Farkı uyarısı fişle kapanmaz (ipucu "alt defter hesabı farkı fişle düzeltilmez"). Kilitli döneminde kayıt tahsilatı ya da (mahsupsuz ayda)
  iade faturası olan HER eski kurulumda uyarı kalıcı. Seçenekler: (A) bu üç kuralın yeni yönü yalnız açık dönemden (güncellemedeki kilit gününden sonra) — kilitli dönemdeki kayıt eski yönle
  (B-6'nın genellemesi; göç 51 kural geçiş gününü işaretler); (B) uyarı kalır (BİLİNEN SINIR). Öneri A. Testler bugünkü davranışı sabitler (kural-farki-duzeltme [2] / [4]).
- **B-9 — süzgecin fatura formülü eski yönde.** `lib/integrity-scope.mjs` (dosya sınırı DIŞI; "süzgece DOKUNMA") fatura yazımında 191 / 391'i Ç7b öncesi yönle hesaplar → iade faturası yazımında
  süzgeç bulgu verir, tam kapı kabul eder (üretimde doğruluk değil hız: tam kapı + "invoice" ailesine güvensizlik; testte eşdeğerlik ihlali — banka-210-gg-cari kırmızı, tabanda yeşil). B-6
  süzgeçte de aynı ay kuralını ister. Öneri: integrity-scope.mjs'e YALNIZ 191 / 391 formülü (+ KG-3'ün 336'sı) için izin.
- **B-10 — Alt Hesap Mizanı (Banka modülü, `lib/bank/**` hızlı yolu) Ç7b'nin banka dışı .90 alt hesaplarını göstermez** (336.90, 600.90, 602.90, 610.90, 649.90, 770.90); Ana Defter'in
  subTrial'ı gösterir → banka-210-gg2-hiz kırmızı. Seçenekler: (A) hızlı yol bu alt hesapları da listeler (lib/bank izni; Ç6-EKRAN ile); (B) Alt Hesap Mizanı yalnız banka / evrak alt hesapları
  (test süzer). Öneri: karar baş mimarın — Ç6-EKRAN'ın alt hesap raporu tasarımına bağlı.
- **Önceki yılın sınıflama farkı 671 / 681 brüt çifti:** kilitli önceki yıldaki yalnız alt hesap / aynı Gelir Tablosu kalemi içi farklar (649 → 649.90, 602 → 600.90) M7 ile fişe 671 ve 681
  ÇİFTİ olarak girer (net 0; v2.0.26 verisinde 155.990,50 TL). Kural metniyle tutarlı; MA'da (mali müşavir ara kabulü) gözden geçirilmeli.

## 13. Tur 2c (19.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b2c-istem.txt`) — KURAL GEÇİŞ GÜNÜ (B-8 = A + B-6), B-9, B-10 — KODDAN ÖNCE yazıldı
Kararlar (iş listesi D, BAŞ MİMAR KARARI 19.11 04:35 ve 05:07): KG-3 (kayıt tahsilatı 602 → 336.90), KG-8 (satıştan iade KDV'si 391 → 191) ve F-08 (alıştan iade KDV'si 191 → 391)
YENİ YÖNÜ yalnız KURAL GEÇİŞ GÜNÜ'nden SONRAKİ kayıtlara; geçiş günü = güncellemedeki kilit tarihi (kilitsiz dosyada geçiş yok — hepsi yeni kural); geçiş gününden önceki (≤) kayıt eski
yönde kalır (kilit sonradan açılıp kapansa da — tek tanım). B-6: KG-8 / F-08'de ayrıca güncellemeden ÖNCE yazılmış (etkin) KDV mahsubunun ayı eski yönde; mahsup ters kaydedilirse o ay
yeni yöne geçer (yeniden yazılan mahsup yeni yönle). Göç 51 YALNIZ işaret (TUTAR YOK). KG-2, KG-24, .90 alt hesapları (alt defter dışı) Kural Farkı Düzeltme Fişi'yle eskisi gibi.

### 13.1 Tek yardımcı — `server/lib/ledger-rule-shift.mjs` (YENİ)
- Girdi (göç 51'in işaretleri): `settings['ledger.ruleShiftThrough']` = geçiş günü (YYYY-AA-GG; '' = geçiş yok — göç kilitsiz dosyada da '' yazar, böylece yeniden koşan göç sonradan
  konan kilitle geçiş YARATMAZ) ve `vat_offsets.rule_version` ('2.4.9' = güncellemeden önce yazılmış mahsup; '' = güncel kuralla yazılmış — sütunun varsayılanı, yazım yolu değişmez).
- `ruleShiftOf(store)` → `{ through, oldVatMonths }` (oldVatMonths: rule_version = '2.4.9' VE status = 'active' mahsupların ayları, YYYY-AA kümesi). Tablo / sütun yoksa geçiş yok.
- Saf yüklemler (türetme): `oldCollection(shift, date)` = through ≠ '' VE date ≤ through (KG-3); `oldReturnVat(shift, date)` = oldCollection(shift, date) VEYA ay(date) ∈ oldVatMonths
  (KG-8 / F-08). SQL karşılıkları (beklenen + süzgeç; AYNI tanım): `oldCollectionSql(shift, sütun)`, `oldReturnVatSql(shift, sütun)` — değerler biçimle doğrulanıp yazına gömülür
  (YYYY-AA-GG / YYYY-AA dışı değer geçiş yok sayılır). `NO_SHIFT` = hiç geçiş yok (journal'a girdi verilmezse).
- Ay = tarih metninin ilk 7 karakteri (yevmiye tarihi yerel gün metnidir — iki TZ'de aynı).

### 13.2 Okuyucular (tarama: `UNCLASSIFIED_GL|336\.90|KG-8|F-08|KG-3|"391"|"191"` server/** — ders 10)
| Okuyucu | Dosya | Nasıl |
|---|---|---|
| Türetme (yevmiye, mizan, karma defter, dondurma, kural farkı, KDV mahsubu ön izleme / Güncel Değil — hepsi `build()` = `journal(rows())`) | `lib/general-ledger.mjs` journal | `rows.ruleShift` → kayıt tahsilatı eskiyse A 602, satıştan iade KDV'si eskiyse B 391, alıştan iade KDV'si eskiyse A 191 |
| journal'ın girdisi | `routes/ledger.mjs` rows() | `out.ruleShift = ruleShiftOf(store)` — TEK SATIR (süzgeçli ve süzgeçsiz kurulum; dosya sınırı: rows() listede yok → rapor 'BAŞ MİMAR KARARI GEREKİYOR'da) |
| Defter Mutabakatı / Mutabakat Testi / tam kapı beklenen | `routes/ledger.mjs` expected() | 336: yalnız geçiş sonrası tahsilatlar düşülür; 191 / 391: iade KDV'si CASE ile eski / yeni yön |
| Süzgeç (dokunulan faturalar) | `lib/integrity-scope.mjs` fatura bölümü | 191 / 391 aynı CASE (B-9: süzgeç Ç7b öncesi yöndeydi — artık türetmeyle aynı kural, geçiş dahil) |
| KDV Mahsubu ön izleme / liste / `stale` | `routes/tax.mjs` | `ledger().build()` okur → kendiliğinden geçişli; ayrı kod GEREKMEZ (ters kaydedilen eski mahsubun ayı yeniden yazımda yeni yönle hesaplanır) |
| 2.4.9 kopyası | `lib/ledger-rule-249/**` | DEĞİŞMEZ (eski yön zaten) |
| KDV Özeti, Stopaj ve Tevkifat Özeti | `routes/report-center.mjs` | DEĞİŞMEZ (beyanname düzeni; karar KDV ÖZETİ = A) |
| partyTotals (ağır cari SQL'i) | `routes/ledger.mjs` | 336.90 cari satırı değil, 191 / 391 cari değil → etkilenmez |

### 13.3 Göç 51 (YALNIZ işaret; para alanı yok; kilit izine girmez)
`settings` 'ledger.ruleShiftThrough' = o anki 'ledger.lockedUntil' (tam tarih değilse '') — INSERT OR IGNORE (yeniden koşuda var olan değer DEĞİŞMEZ); `vat_offsets.rule_version TEXT NOT
NULL DEFAULT ''` eklenir ve YALNIZ sütun bu göçte eklendiyse var olan bütün satırlar (etkin + geri alınmış) '2.4.9' işaretlenir (yeniden koşuda yeni mahsuplar eski sayılmaz).
Geri yükleme: ≤ 50 yedeği açılınca göç 51 o yedeğin kilidiyle koşar; 51 yedeği işaretleriyle gelir. İki şirket: her dosyanın kendi işareti. Şirket Verisini Sıfırla "Tümünü": 'ledger.'
ayarları silinir → geçiş yok; "Hareketleri": ayar kalır (app.mjs dosya sınırı dışı — rapor).

### 13.4 Nasıl bozulur? (önce yazıldı; testler buradan)
1. Geçiş günü TAM o gün tarihli tahsilat / iade (eski), bir gün önce (eski), bir gün sonra (yeni) — '<' ↔ '≤' mutantı.
2. Kilit güncellemeden sonra İLERİ alınır (geçiş sabit; ileri kilitte yeni yön donar), GERİ alınır / açılır ve geçiş öncesine kayıt girilir (eski yön — tek tanım).
3. Eski mahsuplu ay: Güncel Değil YOK; ters kayıt → ay yeni yöne; yeniden mahsup → tutarlar yeni yönle; Defter Mutabakatı her adımda temiz (191 / 391).
4. Kilitsiz eski dosya: geçiş yok → hepsi yeni (bugünkü Ç7b); eski mahsup ayları yine eski (B-6).
5. Yeni şirket (göç zinciri sıfırdan): geçiş yok, işaretli mahsup yok.
6. v2.0.26 ve v2.4.9 gerçek kodun verisi (fikstür): güncellemeden sonra 336 / 191 / 391 için Kural Değişikliği Farkı ÇIKMAZ; KG-2 / KG-24 / .90 farkı fişle 'Düzeltildi'.
7. Geri yükleme (≤ 50 yedeği → göç 51 yeniden), iki şirket (biri kilitli biri kilitsiz).
8. Aynı gün sıra (ders 31): geçiş yüklemi yalnız tarihe bakar — sınıf / yazım sırası etkisiz.
9. Süzgeç ↔ tam kapı eşdeğerliği: iade faturası yazımında süzgeç bulgu VERMEZ (gg-cari), geçiş öncesi tarihli iade (kilit açıkken) de.
10. Kapı dışı: ayar / rule_version elle değişirse türetme değişir — kilitli dönemde donmuş ↔ güncel farkı (Kural Değişikliği Farkı) görünür; kilit izine girmez (integrity.mjs dosya sınırı dışı).

### 13.5 B-9 / B-10
B-9: süzgecin 191 / 391 formülü = beklenen (13.1'in SQL'i). B-10 = B: banka modülünün Alt Hesap Mizanı kendi kümesini (102 / 108 / 300 / 309 + 101.0x / 121.0x) gösterir; `gg2-hiz` eşdeğerliği bu
kümeye süzülür — ürün kodu DEĞİŞMEZ.

### 13.6 Tur 2c — kod ve sonuç (kodla birlikte; kanıt docs/kanit/2026-11-19/c7b2c-*)
- Kod: `lib/ledger-rule-shift.mjs` (YENİ), journal (kayıt tahsilatı / iki iade KDV'si satırı), routes/ledger.mjs rows() TEK SATIR girdi (`out.ruleShift`) + expected() 336 / 191 / 391,
  integrity-scope fatura bölümü (B-9), göç 51. `routes/tax.mjs` DEĞİŞMEDİ (ön izleme / liste / Güncel Değil `build()`'i okur — kendiliğinden geçişli; test (3) bunu sayıyla gösterir).
- 336 ayrışmasının yeniden üretimi (tur 2b: v2.0.26 verisi, fişten sonra 336 karma −750 ↔ Defter Mutabakatı −1.500): TABAN (c7b2c-taban) açılışta da fişten sonra da 336 karma −750 · canlı
  −1.500 · beklenen −1.500, 191 karma 5.376 · canlı 5.466, 391 karma −69.517,50 · canlı −69.607,50 (kilitli 750 TL kayıt tahsilatı + kilitli iade KDV'si 90 TL donmuş defterde 2.4.9
  yönünde, canlı türetmede Ç7b yönünde — B14 (a) yüzünden fişle kapanamıyordu; ÜRÜN HATASI DEĞİL, B-8'in kendisi). YENİ KOD: üç hesapta karma = canlı = beklenen (336 −750; 191 5.376; 391
  −69.517,50), fiş ön izlemesinde dışarıda kalan fark yok, fişten sonra kural farkı "Düzeltildi" (yalnız eski sürümün ileri tarihli evrak satırı kalır).
- Göç 51'in işaretini kilit izine almak (`vat_offsets.rule_version`, `settings['ledger.ruleShiftThrough']`) lib/integrity.mjs ister — dosya sınırı dışı: test/defter-kaynak-iz-250'de gerekçeli
  açık istisna (SINIF 3; BAŞ MİMAR KARARI GEREKİYOR). Şirket Verisini Sıfırla "Hareketleri" geçiş gününü silmez (app.mjs dosya sınırı dışı; rapor).
- Ç3 testlerinin tohumu (donmus-defter-tur1 / tur3 / tur4 / yasam): Ç5-A G3'ün ilkesiyle iki kuralda AYNI türetilen veriye çevrildi (Borç Yaz → satış faturası, carisiz Kasa girişi →
  carinin nakit tahsilatı); tur1'in kural benzetimi faturanın 600'üne (642). bellek: 2.4.9 kopyası ↔ güncel farkı Ç5-A hesapları + Ç7b kural kimlikleri (c7b-kural çevirisi, geçiş günü
  dosyanın işaretinden). gg2-hiz (B-10 = B): eşdeğerlik banka Alt Hesap Mizanı'nın kümesine süzüldü.

## 14. Tur 2d (19.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b2d-istem.txt`) — KG-7 "KDV İndirim Dönemi" + kilit izi eki + Sıfırla eki — KODDAN ÖNCE yazıldı
Kaynaklar: kural kitabı KG-7 = A ("varsayılan belge ayı, kullanıcı kayıt ayına alabilir — KDVK 29/3: izleyen yıl sonuna kadar"), EK-1 M8 (1) (üst sınır belge yılını izleyen yılın Aralık'ı),
M8 (2) (V-01 satırları dönem etiketine göre), M8 (6) / S4 (mahsuptan sonra düzenleme: engel konmaz, Güncel Değil + Geri Al; azaltan fark sonraki mahsuba — §2.3), §2.6 (bu notun KG-7 tasarımı;
göç numarası 51 yerine **52** — 51 tur 2c'nin). Tur 2c kararı (2) ve (3) (iş listesi D 19.11 06:39).

### 14.1 Şema — göç 52
`invoices.vat_period TEXT NOT NULL DEFAULT ''` (YYYY-AA; **boş = belge ayı**). Yalnız ekleyici, eşgüçlü (sütun varsa hiçbir şey yapmaz; değer YAZMAZ — eski faturalar '' = bugünkü davranış). Tablo
yoksa atlanır. Para alanı değil; defter maddesi okumaz (journal DEĞİŞMEZ). Yedek: sütun dosyayla taşınır; ≤ 51 yedeği geri yüklenince göç 52 koşar ('' — belge ayı).

### 14.2 Alan ve doğrulama (`routes/invoices.mjs documentInput`)
- Gövde alanı `vatPeriod` ('' ya da YYYY-AA); verilmezse var olan faturanınki (Düzenle / taslağı kes), yoksa ''. Saklanan değer NORMAL: belge ayına eşitse '' (alan boşken belge tarihi değişirse
  dönem yeni belge ayını izler).
- Yalnız ALIŞ faturasında (`purchase`; Stoğa Mal Alışı ve Hizmet ve Gider Alışı). Başka türde dolu değer **400** `vat-period-kind` ("KDV İndirim Dönemi yalnız alış faturasında seçilir.") —
  sessizce yok sayılmaz (ders 3). Alıştan iade de dahil DEĞİL (§2.6: iade kendi ayında).
- Biçim YYYY-AA değilse 400 `vat-period` ("KDV İndirim Dönemi Yıl-Ay biçiminde olmalı (ör. 2027-01)."). Sınır: belge ayı ≤ dönem ≤ belge yılı + 1'in Aralık'ı; dışı **400** `vat-period-range`
  ("KDV İndirim Dönemi faturanın ayından (Aralık 2026) önce olamaz." / "KDV İndirim Dönemi en geç Aralık 2027 olabilir (fatura yılını izleyen yılın sonu)."). Taslakta da aynı denetim. Belge
  tarihi düzenlenip dolu dönem aralık dışına düşerse aynı 400 (kullanıcı dönemi düzeltir; sessiz düzeltme yok).
- Bugünden sonraki ay seçilebilir (kitap yalnız izleyen yıl sonunu sınırlar); o ayın mahsubu ay bitmeden yazılamaz (bugünkü kural).
- KİLİT: dönem ≥ belge ayı olduğundan seçilen ayın sonu ≥ belge tarihi; belge kilitli dönemdeyse kaydetme / Düzenle zaten 409 (period.assertOpen / modifyBlock). Ayrı kilit denetimi ERİŞİLEMEZ
  (§2.6'nın "seçilen ayın sonu kilit gerisindeyse 409" cümlesi bu yüzden kodlanmaz — ölü kod yazılmaz; test kilitli belgede Düzenle'nin 409'unu gösterir).
- MAHSUBU YAZILMIŞ AYA ALMA / AYDAN ÇIKARMA: ENGEL YOK (M8 (6): "Engel konmaz (yeni kural sayılmaz; ders 45)"). Mahsubu yapılmış aya taşınan KDV ARTIRAN farktır → o ay "Güncel Değil" (Geri Al
  + yeniden — bugünkü kural); mahsubu yapılmış aydan çıkan KDV AZALTAN farktır → S4 (§2.3) ile sonraki ilk mahsuba taşınır (İ_M = şimdi(M) + min(0, C)): KDV iki kez indirilmez, saklı mahsup
  değişmez. KULLANICIYA SORU GEREKMEZ (kitabın ve S4'ün metni).
- Yol: Düzenle (kaydedilmiş faturada da; §2.6). Düzenle'nin pasif olduğu belgede (iadesi olan, banka masrafı, kilitli…) alan da değişmez — nedeni bugünkü gibi görünür yazı.

### 14.3 Mahsup seçimi (`routes/tax.mjs` YALNIZ `figureTable`)
`figureTable(entries)` ayların 191 hareketini maddenin tarihine göre topluyordu. EK: dönemi belge ayından farklı kesilmiş alış faturalarının kimlikleri TEK toplu SQL ile
(`SELECT id, vat_period FROM invoices WHERE kind = 'purchase' AND status = 'issued' AND vat_period <> '' AND vat_period <> substr(issue_date, 1, 7)`; ders 47) okunur; `invoice:<id>` maddesinin 191
satırı dönem ayına yazılır (391 ve öbür hesaplar değişmez). Ön izleme (İ), liste (`stale`), S4 birikimi (`carriedBefore` aynı tabloyu okur) ve KDV Özeti'nin "Mahsuptan Sonra Değişen Ay"
satırı (offsetList) böylece aynı kuralla. Defter maddesi DEĞİŞMEZ: 191 belge tarihinde; dönemi ileri alınmış faturanın ayının sonunda 191 bakiyesi mahsupsuz tutarı gösterir (§7.3; EK-1 M8
(4)'ün "Bilanço'da brüt" cümlesi). Kural farkı / dondurma / Defter Mutabakatı journal'dan okur → etkilenmez. 2.4.9 kopyası değişmez.

### 14.4 Düzenle, iade, iptal, silme, taslak, tekrar
- Düzenle: dönem değişince eski ay azaltan (S4 taşıması), yeni ay artıran (mahsupluysa Güncel Değil). Belge tarihi değişince alan '' ise yeni ayı izler.
- İade (alıştan iade): alanı yok; asıl faturanın dönemini izlemez (KDVK 35 — iade kendi ayında; F-08 391'de).
- İptal Et: iptal edilmiş belge türetmeden çıkar (G-7) → KDV'si hiçbir aya girmez (dönem alanı kalır, etkisiz).
- Silinenler'den geri yükleme: belge iptal edilmiş (etkisiz) olarak döner; eski satırda sütun yoksa '' (göç).
- Taslak: alan saklanır; taslağı kes yolunda taşınır. Tekrarlanan fatura (runRepeats) şablonun dönemini ALMAZ (yeni belge kendi ayında). Kopyala (istemci): dönem kopyalanmaz.
- Gelen e-Fatura kutusundan alınan alış faturası: '' (belge ayı); kullanıcı Düzenle ile seçer.

### 14.5 Ekran (fatura formu `client/assets/hof-invoices.js`)
- Yalnız alış faturasında, başlıkta "Tedarikçinin Fatura No"dan sonra açılır liste **"KDV İndirim Dönemi"** (yazım düzeni): seçenekler belge ayı ("Aralık 2026 (Fatura Ayı)") … belge yılını
  izleyen yılın Aralık'ı; altında kısa açıklama (cümle düzeni). Tarih değişince seçenekler yeniden kurulur; seçili ay yeni aralıkta değilse fatura ayına döner ve bunu söyleyen görünür yazı çıkar.
  Satış / iade / makbuz formunda alan YOK. Tab sırası DOM sırası (tabindex yok): … → Tedarikçinin Fatura No → KDV İndirim Dönemi. Belge kartında dönem belge ayından farklıysa "KDV İndirim
  Dönemi" satırı. PDF / UBL / Excel dışa aktarma DEĞİŞMEZ.

### 14.6 Tur 2c kararı (2) — kilit izi eki (`lib/integrity.mjs`)
B-7 düzeni: LOCK_SQL'e iki girdi, `since "2.5.2"`, `LOCK_SQL_VERSION` "2.5.1" → "2.5.2" (kilit izi TANIMININ sürümü): `rule_shift_lock` = `settings` 'ledger.ruleShiftThrough' (değer '' değilse
tek satır) ve `vat_offsets_rule_lock` = `vat_offsets(id, rule_version)` (rule_version ≠ '' VE tarih ≤ kilit). Kilitsiz geçişsiz dosyada ve güncel kuralla yazılmış mahsuplarda satır YOK. Önceki
tanımla (2.5.1 ve öncesi) kaydedilmiş donmuş defter koşusu kendi sürümüyle karşılaştırılır → var olan kilitlerde yanlış alarm yok. Geçiş günü ayarını program yolu yazmaz (yalnız göç 51 — INSERT
OR IGNORE — ve Sıfırla'nın silmesi; Sıfırla kilidi de kaldırır), rule_version'ı yalnız göç 51 yazar. Kapı dışı değişiklik: donmuş dönemin kaynağı değişti uyarısı (ledger:snapshot).
`test/defter-kaynak-iz-250` istisnasından `vat_offsets.rule_version` çıkar. (`invoices.vat_period` kilit izine GİRMEZ — bu turun izni yok; bkz. 14.9 B-12.)

### 14.7 Tur 2c kararı (3) — Sıfırla eki (`server/app.mjs`)
"Tüm Hareketleri Sil" ('movements') kipinde 'ledger.ruleShiftThrough' da silinir (sıfırlanan dosyada eski veri kalmaz — eski yön anlamsız). "Tümünü Sıfırla" ('all') zaten siliyordu ("ledger."
KEEP_SETTINGS'te yok). Göç 51 yeniden koşmaz (şema 52) → sıfırlanan dosyada geçiş yok, bütün yeni kayıtlar yeni kuralla.

### 14.8 Nasıl bozulur? (önce yazıldı; testler buradan)
1. Sınır: belge ayı (kabul, '' saklanır), belge ayından bir ay önce (400), izleyen yılın Aralık'ı (kabul), izleyen yılın Ocak'ı (400) — sınırı bir ay kaydıran mutant.
2. Aralık faturası Ocak dönemine: Aralık mahsubunun İ'sinde YOK, Ocak'ta VAR; iki TZ (Europe/Istanbul, UTC) — ay sonu 31.12 belge tarihi.
3. Alan yok sayılırsa (hep belge ayı) — mutant: Ocak İ eksik.
4. Mahsubu yapılmış aya sonradan dönemi o ay olan fatura → o ay Güncel Değil; mahsubu yapılmış aydan sonraki aya alınan fatura → sonraki ayın ön izlemesinde S4 taşıması (iki kez indirim yok).
5. Satış / alıştan iade / makbuzda dolu alan 400; boş alan kabul.
6. Düzenle: tarih ileri alınıp dolu dönem aralık dışı → 400; alan '' iken tarih değişince yeni ay.
7. İptal Et: dönemi ileri alınmış fatura iptal → dönem ayının İ'sinden düşer.
8. Göç 52: eski veri (v2.4.9 gerçek kodu) → '' ve mahsup tutarları göç öncesiyle aynı; yeniden koşu eşgüçlü; mutant: göç sütunu varsayılansız (NULL).
9. Kilit izi: geçiş günü ve rule_version kapı dışı değişince iz değişir (2.5.2), 2.5.1 tanımında değişmez; v2.4.9 kilitli veride güncellemeden sonra yanlış alarm yok (ledger:snapshot, period-lock).
10. Sıfırla 'movements': geçiş günü silinir; 'all' zaten.
11. e-Belge: alış faturası gönderilmez; satış faturasının UBL'i değişmez.
12. Form: alış formunda görünür, satışta yok; Tab ile ulaşılır; seçim kaydedilir (veri tabanı okunur); tarih değişince seçenekler.

### 14.9 BAŞ MİMAR KARARI GEREKİYOR (bu turda kodlanmadı — dosya sınırı)
- **B-11 — KDV Özeti (Beyanname Hazırlığı) belge ayına göre gruplar** (`routes/report-center.mjs` kdv-ozeti: `substr(i.issue_date, 1, 7)`): dönemi ileri alınmış alış faturasının İndirilecek KDV'si
  raporda belge ayında, KDV Mahsup Fişi'nde dönem ayında görünür → "Beyanname Hazırlığı" ile mahsup ayrışır. (A) rapor alış satırlarını `vat_period`'a göre (boşsa belge ayı) gruplar ve aralık
  süzgecini de döneme uygular (report-center.mjs izni); (B) rapor belge ayında kalır + dipnot. Öneri: A (raporun adı beyanname hazırlığı; KDVK 29/3 indirim dönemi beyannamenin dönemidir).
- **B-12 — `invoices.vat_period` kilit izinde değil:** kilitli Aralık faturasının dönemi Ocak ise açık Ocak mahsubu bu alana bağlı; program yolundan değişmez (Düzenle kilitte 409), kapı dışı
  değişiklik izsiz. (A) LOCK_SQL'e `invoices(id, vat_period)` (vat_period ≠ '', since 2.5.2 — aynı sürüm artışı); (B) gerekçeli istisna (journal okumaz). Öneri: A, sonraki turda integrity.mjs izniyle.

### 14.10 Tur 2d — kod ve sonuç (kodla birlikte; kanıt docs/kanit/2026-11-19/c7b2d-*)
- Kod: göç 52 (`lib/migrations.mjs`), `routes/invoices.mjs` (vatPeriodOf + INVOICE_SQL / documentInput / writeIssued / writeDraft / detail), `routes/tax.mjs` (vatPeriods + figureTable'ın
  191 anahtarı), `lib/integrity.mjs` (rule_shift_lock, vat_offsets_rule_lock, LOCK_SQL_VERSION 2.5.2), `app.mjs` (Sıfırla 'movements' geçiş gününü siler), `client/assets/hof-invoices.js`
  (alan + seçenekler + tarih değişince yeniden kurma + belge kartı satırı), kılavuz. Defter maddesi, 2.4.9 kopyası, süzgeç DEĞİŞMEDİ. §2.6'nın erişilemeyen kilit 409'u kodlanmadı (§14.2).
- Ekran: alan iki sütun genişliğinde (tek sütunda "Aralık 2025 (Fatura Ay" kesiliyordu — ekran görüntüsüyle görüldü, düzeltildi). Tarih değişince seçili dönem aralık dışına düşerse yazı
  kullanıcı dönemi kendisi seçene dek kalır (aynı tarihin ikinci change olayı silmez).
- Sonuç: yeni testler (c7b-kdv-donemi-250, c7b-goc52-kilit-izi-250, ekran senaryosu senaryo-kdv-donemi-250) tabanda nedenleriyle KIRMIZI, yeni kodda iki TZ'de YEŞİL; 10 karşı mutant
  yakalandı; G2 komşu 323 dosya iki TZ 3401 / 3402 (tek kırmızı tabanda da var — aşağıda); 46 ekran senaryosu iki TZ yeşil; defter kâhini 183 / 187 (tabandaki dört fark).
- Yeni bulgular (dosya sınırı / kapsam dışı; kodlanmadı):
  (1) **Sıfırla ↔ KDV mahsubu:** "Tüm Hareketleri Sil" `vat_offsets`'i silmiyor (MOVEMENT_TABLES'ta yok; 2.4.3'ten beri) — sıfırlanan şirkette mizan 360 −200 / 391 +200 kalır, Mutabakat
  Testi yakalamıyor (tabanda da aynı; c7b2d-bulgu-sifirla-kdv-mahsup.txt). Öneri: app.mjs MOVEMENT_TABLES'a "vat_offsets" (+ kalıcı test) — ayrı küçük iş.
  (2) **test/acilis-onarimi-hiz-250 'eşdeğerlik' tabanda kırmızı** (Ç7b tur 2–2c'den kalma; Ç7b öncesi kodda yeşil): v2.0.26 fikstüründe kilitli Kasa carisiz hareketinin 649 / 770 → .90 alt
  hesabı (K-01 / K-02) Kural Değişikliği Farkı uyarısı verir, beklenen döküm Ç7b öncesi kodla üretilmiş → BEKLENTİ değişmesi TUR 2e'de (komşu taraması o dosyayı kaçırmıştı).
  (3) Kılavuz maddesindeki "Kartı Kapat'ın kalanı borçta bırakması" bugünkü kodda DOĞRU DEĞİL (onay metni "carinin borcundan düşülür"; 'Borçta Kalsın' TUR 3) → kılavuza yazılmadı, TUR 3'e.

## 15. Tur 2e (19.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b2e-istem.txt`) — B-11, B-12, Sıfırla ↔ KDV mahsubu, onarım eşdeğerliği — KODDAN ÖNCE yazıldı
Kararlar (iş listesi D, BAŞ MİMAR KARARI 19.11 09:29 UTC — Ç7b TUR 2d RAPOR): (B-11) = A, (B-12) = A, SIFIRLA ↔ KDV MAHSUBU = HATA (düzeltilir), ONARIM EŞDEĞERLİĞİ = ÖNCE HATA (ders 6).
Bugünkü davranış taban kodda (c7b2e-taban = 9d933883) yeniden üretildi (not defteri `c7b2e-ana/uc-madde-taban.out`, `onarim-kok-yeni.out`, `onarim-kok-onc7b.out`). Örnek (tur 2d raporunun):
sahte saat 10.02.2027; Aralık 2026 satış 10.000 + KDV 2.000, alış P1 1.000 + 200 (15.12), alış P2 2.000 + 400 (31.12, KDV İndirim Dönemi Ocak 2027); Ocak 2027 satış 1.000 + 200, alış P3 500 + 100.

### 15.1 B-11 — KDV Özeti (Beyanname Hazırlığı) alış satırları KDV İndirim Dönemi'ne göre (`routes/report-center.mjs` YALNIZ kdv-ozeti)
- BUGÜN: rapor belge ayına göre gruplar. Aralık (01.12–31.12): Alış 2 belge, KDV 600; İndirilecek KDV (191) 600; Ödenecek 1.400. Ocak: Alış 1 belge, KDV 100; Ödenecek 100. KDV Mahsup Fişi ise
  Aralık İ 200, Ocak İ 500 (dönem ayına) → rapor ile mahsup ay ay AYRIŞIR.
- DEĞİŞECEK: raporun iki sorgusu (satırlar ve özet başlıkları) belgenin "KDV günü"nü kullanır: alış faturasında (kind = 'purchase') `vat_period` dolu ve belge ayından farklıysa dönem ayının
  İLK günü (`vat_period || '-01'`), değilse belge tarihi. Ay grubu bu günün ayı; aralık süzgeci (from / to) bu güne uygulanır. Satış, SMM, satıştan iade ve alıştan iade belge tarihinde
  (§14.4: iade kendi ayında). "Mahsuptan Sonra Değişen Ay" / "KDV Mahsup Fişi" özet satırları değişmez (offsetList zaten dönem ayıyla). Sütun yoksa (göç 52 öncesi şema — ör. salt okunur
  arşiv) bugünkü sorgu (belge tarihi).
- NEDEN AYIN İLK GÜNÜ (yorum; dönem bir AYDIR, günü yok): ay grubu her seçenekte aynı; günlük aralıkta (Son 30 Gün, elle aralık) belge YALNIZ BİR aralıkta sayılır — iki bitişik aralığın
  toplamı birleşik aralığa eşit (ay ortasında bölünen aralıkta çift sayım yok); "Bu Ay" / "Geçen Ay" / "Bu Yıl" tam ay olduğundan sonuç ayın hangi günü seçilse de aynı; programda ay kalemini
  ayın ilk gününe yazma örneği var (lib/finance-report.mjs vade takibi: "Tablodaki ay kalemi … ayın ilk gününe yazılır"). Sonuç: "Tüm Zamanlar" (bugüne kadar) gelecekteki bir aya alınmış
  faturayı o ay gelene dek göstermez (dönemi henüz başlamamış indirim — beyannamede de o ay). Rapor 'BAŞ MİMAR KARARI GEREKİYOR'da gösterir (değiştirilebilir).
- SONRA (örnek): Aralık Alış 1 belge, matrah 1.000, KDV 200, İndirilecek 200, Ödenecek 1.800 = mahsup; Ocak Alış 2 belge, matrah 2.500, KDV 500, Net KDV Devreden 300 = mahsup.
- TEST (`test/c7b-kdv-ozeti-donem-250.test.mjs`, YENİ): her süzgeç seçeneği (Bu Ay, Geçen Ay, Bu Yıl, Tüm Zamanlar, Son 30 Gün, elle Aralık / Ocak / 15.12–15.01 / bölünmüş iki aralık) için
  toplam = satırlar (TOPLAM Alış = Σ alış satırı), özetin 191'i = TOPLAM Alış − TOPLAM Alıştan İade, ekran = PDF metni = Excel hücreleri; ay ay KDV Mahsup Fişi ön izlemesinin İ'si = raporun
  İndirilecek KDV'si (iadesiz örnekte); iki TZ (Europe/Istanbul, UTC); belge tarihi 31.12 (ay / yıl sonu).

### 15.2 B-12 — faturanın KDV İndirim Dönemi kilit izine (`lib/integrity.mjs` YALNIZ LOCK_SQL eki)
- BUGÜN: kilit 31.12.2026; kilitli P2'nin dönemi kapı dışı Ocak → Şubat değişince kilit izi DEĞİŞMEZ; açık Ocak'ın mahsup ön izlemesi İ 500 → 100 olur (izsiz).
- DEĞİŞECEK: LOCK_SQL'e `invoices_vat_period_lock` = `SELECT id, vat_period FROM invoices WHERE status <> 'draft' AND vat_period <> '' AND issue_date <= ?1 ORDER BY id`, `requires
  ["invoices.vat_period"]`, `since "2.5.2"` (tanım sürümü AYNI — 2.5.2 yayımlanmadı; tur 2d'nin iki ekiyle aynı sürüm). Yalnız DOLU dönemli faturalar satır üretir → dönemsiz veride iz
  aynı; v2.4.9 verisinde (sütun '' ) güncellemeden sonra yanlış alarm yok; 2.5.1 ve öncesinin koşuları kendi tanımıyla.
- TEST: `test/defter-kaynak-iz-250` kaynak taramasına KDV mahsubunun okuduğu sorgular da girer (routes/tax.mjs `offsetList` — yevmiye + `vatPeriods` + mahsup satırları); veriye dönemi ileri
  alınmış kilitli bir alış faturası eklenir. Bu sınıf açık (mahsubun okuduğu sütun izde değil) yeniden kaçarsa test kırılır: eki çıkaran mutant KIRMIZI. Yalnız listede görünen
  `vat_offsets.reversed_at` gerekçeli istisna (taramada çıkarsa). `test/c7b-goc52-kilit-izi-250` (b)'ye: kilitli faturanın dönemi kapı dışı değişince güncel iz değişir, 2.5.1 izi değişmez.

### 15.3 Sıfırla ↔ KDV mahsubu (`server/app.mjs` YALNIZ MOVEMENT_TABLES)
- BUGÜN: Aralık mahsubu yazılmış dosyada "Tüm Hareketleri Sil" → faturalar 0, `vat_offsets` 1 satır kalır; mizan 191 −200 / 360 −1.800 / 391 +2.000 (faturasız); Mutabakat Testi YEŞİL; KDV
  Mahsup Fişi listesinde "Aralık 2026 — Güncel Değil". "Tümünü Sıfırla" da aynı listeyi (MOVEMENT_TABLES + CARD_TABLES) kullanır → aynı hata orada da.
- DEĞİŞECEK: MOVEMENT_TABLES'a "vat_offsets" (iki kip de siler; mahsup bir hareket kaydıdır — fatura gibi). Başka değişiklik yok (kartlar, ayarlar, kilit kaldırma aynen).
- NEDEN MUTABAKAT YAKALAMIYOR: Defter Mutabakatı'nın / Mutabakat Testi'nin beklenen 391 / 191 / 190 / 360'ı (routes/ledger.mjs expected) etkin mahsupların tutarlarını `vat_offsets`'in
  KENDİSİNDEN ekler; yevmiyenin mahsup maddesi de aynı satırdan türer → yetim mahsup iki yana EŞİT girer, fark sıfır. Mahsubun saklı tutarını o ayın gerçek 391 / 191 hareketiyle
  karşılaştıran denetim Mutabakat'ta YOK; bu karşılaştırma yalnız KDV mahsubunun "Güncel Değil" işaretidir (routes/tax.mjs offsetList — uyarı, kapı değil). Kapı değişikliği ayrı karar.
- TEST (`test/c7b-sifirla-kdv-mahsup-250.test.mjs`, YENİ): iki kip ayrı veride; sonra mizan 191 / 360 / 391 / 190 = 0, Mutabakat Testi yeşil, mahsup listesi boş, kartlar (movements) kalır;
  sıfırlamadan sonra yeni ayın mahsubu sıfırdan doğru (eski mahsup "sonraki ay mahsup edilmiş" engeli koymaz).

### 15.4 Onarım eşdeğerliği — kök neden (ders 6; ÖNCE HATA diye ele alındı)
- YENİDEN ÜRETİM (`test/acilis-onarimi-hiz-250` fikstürü = v2.0.26 gerçek kodu verisi; bugün 06.11.2026, kilit 07.10.2026; göç 51 geçiş günü 07.10.2026): açılışta dondurma koşusu 2.4.9 kuralıyla
  (rule_version "2.4.9" — `lib/ledger-rule-249/`) donar. Kural Değişikliği Farkı TEK madde: `cash:cash-57559235…` 08.08.2026 "Açılış" carisiz Kasa girişi 200.000 TL — DONMUŞ 100 / 649
  (alt hesapsız), CANLI 100 / 649.90 (K-01, §2.1). Hesap başına (ana hesap) fark 0: −200.000 649'dan 649.90'a geçer, 649'un bakiyesi aynı → `difference` 0, `breakdown` boş; madde sayısı 1
  → uyarı (ok false). Ç7b öncesi kodda (c7b2-taban) aynı veride fark yok (ok true) — beklenen döküm o kodla üretilmiş.
- B-8 ÖLÇÜSÜ: B-8 (= A + B-6; §13 başlığı) yalnız alt defter hesabına dokunan üç kuralı (KG-3, KG-8, F-08) geçiş gününe bağlar ve AÇIKÇA "KG-2, KG-24, .90 alt hesapları (alt defter dışı)
  Kural Farkı Düzeltme Fişi'yle eskisi gibi" der; §3 (okuyucu tablosu) ve §4 (5) ".90 farkı kilitli dönemde görünür, fişle Düzeltildi" der; §13.4 (6) aynı. → B-8 bu kaydı KAÇIRMIYOR: .90
  farkı B-8'in kapsamı DIŞINDA, kararla. Kural farkı uyarısı TASARIMIN SONUCU; ürün hatası değil.
- FİŞLE KAPANIYOR MU (yeniden üretildi): Kural Farkı Düzeltme Fişi ön izlemesi 08.10.2026 B 649 200.000 / A 649.90 200.000; fiş yazılınca Mutabakat Testi = Ç7b öncesi kodun sonucu (ok true).
- 'FARKSIZ UYARI' AYRI HATA MI: hayır — uyarı GERÇEK bir alt hesap farkıdır (madde sayısı doğru). `difference` / `breakdown` ana hesap düzeyinde toplanır (yalnız alt hesap kayan maddede 0
  / boş); Yönetim ekranı fark tutarını yalnız sıfırdan farklıysa yazar ("1 madde … fark Kural Farkı Düzeltme ile ilk açık güne alınır") — "0 TL farkı var" demiyor; breakdown istemcide
  gösterilmiyor. Alt hesap kırılımında tutarın görünmemesi DÜŞÜK gözlem: lib/ledger-snapshots.mjs (dosya sınırı DIŞI) → rapor 'BAŞ MİMAR KARARI GEREKİYOR'.
- DEĞİŞECEK (yalnız test): `test/acilis-onarimi-hiz-250` "eşdeğerlik" — BEKLENTİ BİLEREK DEĞİŞTİ (K-01 §2.1; B-8 kapsamı §13 başlığı; §4 (5); §13.4 (6)): bütün bölümler eski dökümle birebir;
  YALNIZ Mutabakat Testi bölümü: yeni {ok:false, failures:[ledger:rule-diff]} ve kural farkı TAM OLARAK bu tek madde (649 → 649.90, 200.000 TL; B-8'in üç kuralından madde YOK); sonra Kural
  Farkı Düzeltme Fişi yazılır ve Mutabakat Testi eski dökümün Mutabakat'ıyla BİREBİR (ok true). Fikstür ve beklenen döküm dosyası DEĞİŞMEZ (kâhin = eski kodun gerçek çıktısı).
  `lib/ledger-rule-shift.mjs` DEĞİŞMEZ.
- KOMŞU: v2.4.9 gerçek kodu verisi (`test/c7b-goc52-kilit-izi-250`) ve v2.0.26 verisinin öbür testleri (kural-farki-*, donmus-defter-*) G2 taramasında.

### 15.5 Nasıl bozulur? (önce yazıldı; testler buradan)
1. KDV Özeti belge ayına geri döner (mutant) → Aralık / Ocak İ mahsupla ayrışır; süzgeç dönemi belge tarihine uygular → bölünmüş aralıkta belge kaybolur ya da iki kez sayılır.
2. Özet (191) sorgusu satırlardan farklı kuralla → TOPLAM Alış ≠ İndirilecek KDV.
3. Alıştan iade de dönemle gruplanır → iade kendi ayından kayar (§14.4).
4. PDF / Excel ekrandan farklı (aynı `run` — denetlenir).
5. Kilit izinden dönem eki çıkar → kaynak tarama ve (b) testi kırmızı; ek sürüme bağlı değil → 2.5.1 koşusunda yanlış alarm.
6. Sıfırla mahsubu silmez → mizan 360 / 391 / 191 ≠ 0; 'all' kipi unutulur.
7. Onarım eşdeğerliği: beklenti gevşer (her rule-diff kabul) → B-8'in üç kuralından kilitli fark sızarsa görülmez — test fark maddesini tek tek sayar.

### 15.6 Tur 2e — kod ve sonuç (kodla birlikte; kanıt docs/kanit/2026-11-19/c7b2e-*)
- Kod: `routes/report-center.mjs` (kdv-ozeti: KDV günü ifadesi — satırlar ve özet başlıkları; sütun yoksa belge tarihi), `lib/integrity.mjs` (`invoices_vat_period_lock`, since 2.5.2;
  LOCK_SQL_VERSION AYNI 2.5.2), `app.mjs` (MOVEMENT_TABLES'a `vat_offsets`). `lib/ledger-rule-shift.mjs` DEĞİŞMEDİ (madde 4 ürün hatası değil — §15.4). Kılavuz: KDV İndirim Dönemi maddesine
  "KDV Özeti'nde de dönemi ileri alınan alış faturası seçilen dönemde görünür." + PDF.
- Testler: YENİ `c7b-kdv-ozeti-donem-250` (4), `c7b-sifirla-kdv-mahsup-250` (2); DEĞİŞEN `defter-kaynak-iz-250` (taramaya KDV mahsubunun sorguları + dönemi ileri alınmış kilitli alış faturası;
  `vat_offsets.reversed_at` gerekçeli istisna), `c7b-goc52-kilit-izi-250` (b) (kilitli faturanın dönemi kapı dışı), `acilis-onarimi-hiz-250` eşdeğerlik (BEKLENTİ BİLEREK DEĞİŞTİ — §15.4; ön koşul:
  açılışın dondurması bitti), `test/guvenilirlik/onarim-dokum.mjs` (isteğe bağlı afterDump), ekran senaryosu `senaryo-kdv-donemi-250` D adımı (KDV Özeti ekranda dönem ayında).
- Kırmızı / yeşil: yeni / değişen testler c7b2e-taban kopyasında NEDENLERİYLE kırmızı (Aralık KDV 660 ≠ 200; 'kilit izinde OLMAYAN … invoices.vat_period'; 'kilitli faturanın KDV İndirim
  Dönemi: güncel kilit izi değişmeli'; 'faturalar ve KDV mahsupları silindi' [0,2] ≠ [0,0] iki kipte; ekran 'Bu dönemde kayıt yok'); onarım testinin yeni beklentisi Ç7b öncesi kodda kırmızı
  (kural farkı yok); yeni kodda iki TZ yeşil.
- Karşı mutantlar (değerle, 2 koşu = iki TZ): M1 belge ayı, M1b özet başlığı belge tarihi, M1c süzgeç belge tarihi, M1d ayın son günü, M2 kilit izinde dönem yok, M2b ek sürüme bağlı değil,
  M3 Sıfırla mahsubu silmez, M3b yalnız Tümünü Sıfırla — 8 / 8 YAKALANDI. M4 / M4b (B-8 kuralları sızar) onarım testinde KAÇTI: fikstürün kilitli döneminde kayıt tahsilatı / iade KDV'si yok
  — onarım testi B-8'in koruyucusu DEĞİL; aynı iki mutant B-8'in kendi testinde (`c7b-gecis-gunu-250`) iki TZ'de YAKALANDI ('geçiş gününde / öncesinde iade KDV'si eski yönde', 'KG-3: geçiş
  gününde ve öncesinde 602').
- Komşu (G2; tur 2d listesi ∪ değişen dosyaları / API yollarını anan testler, 388 dosya) iki TZ 4024 / 4024. Ekran senaryoları (taramayla 58) iki TZ — sayılar kanıt dosyasında. Defter kâhini
  iki TZ 183 / 187 (tabandaki dört fark — K_EYLUL, K_SON 191 / 391; yeni kırmızı yok). Kılavuz metin 954 / 954, PDF denetimi 39 / 39. Dondurma zorlaması (gozlem, bitir) onarım ve göç 52
  testinde ön koşul gerçekleşti, yeşil.
- 'Tümünü Sıfırla' da mahsupları artık siler (aynı hata o kipte de vardı; tek liste). Sıfırlama listelerinin dışında kalan öbür tablolar para tablosu değil (kullanıcı, oturum, mobil, sohbet,
  e-Belge kullanım sayacı, kur, banka tatili, ayarlar; donmuş defter ve fiş defteri ayrı yoldan silinir).
