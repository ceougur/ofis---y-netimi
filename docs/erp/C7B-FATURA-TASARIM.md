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
- Komşu (G2; tur 2d listesi ∪ değişen dosyaları / API yollarını anan testler, 388 dosya) iki TZ 4024 / 4024. Ekran senaryoları (taramayla 58) iki TZ 58 / 58 çıkış 0 (senaryo-kdv-donemi-250 22 / 22). Defter kâhini
  iki TZ 183 / 187 (tabandaki dört fark — K_EYLUL, K_SON 191 / 391; yeni kırmızı yok). Kılavuz metin 954 / 954, PDF denetimi 39 / 39. Dondurma zorlaması (gozlem, bitir) onarım ve göç 52
  testinde ön koşul gerçekleşti, yeşil.
- 'Tümünü Sıfırla' da mahsupları artık siler (aynı hata o kipte de vardı; tek liste). Sıfırlama listelerinin dışında kalan öbür tablolar para tablosu değil (kullanıcı, oturum, mobil, sohbet,
  e-Belge kullanım sayacı, kur, banka tatili, ayarlar; donmuş defter ve fiş defteri ayrı yoldan silinir).

## 16. Tur 3 (20.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b3-istem.txt`) — Kartı Kapat 'Borçta Kalsın' (karar (6) / KG-23 / S205), kart küçülmesi (karar (4) / 2B-S3), S15 / S206 — KODDAN ÖNCE yazıldı
Kaynaklar (iş listesinden AYNEN; görev metni): KG-23 = A, karar (6) 2B-S5 / S10 = A, karar (4) 2B-S3 = A, S15 = A, S205 = A, S206 = A; ayrıca iş listesi C'de bulunan S210 = A / S211 = A (cari kâhini bakımı 21b'nin
SK-41 (a) / (b); 19.11 23:18 kullanıcı kuralıyla öneri uygulandı — görev metninde YOK, §16.4 / §16.6). Bugünkü davranış programın KENDİSİYLE yeniden üretildi (ders 6): `test/c7b-tur3-yoklama.mjs`
(taban c7b3-taban = b85d9e27; sahte saat 08.10.2026; kanıt docs/kanit/2026-11-20/c7b3-yoklama-*).

### 16.1 Bugünkü davranış (örnek tutarla)
| # | Örnek | Bugün (taban) | Kararın istediği |
|---|---|---|---|
| (6) | Yeni Borç kartı 900 (3 × 300; 05.10 / 05.11 / 05.12), 05.10 tahsilat 300, 08.10 Kartı Kapat | cari bakiye 600 → **0**; gecikmiş 0 (12.10'da da 0); Mizan 120 600 → 0, **689 0 → 600**; cari ekstresinde "Kart kapatıldı · kalan düşüldü" 600 alacak | bakiye **600** kalır, madde YOK, 12.10'da gecikmiş **600** (S205: kalanın tamamı 09.10'dan), hatırlatma gider |
| (4) | taksitli fatura 900 (3 × 300; 06.10 / 06.11 / 06.12), 06.10 tahsilat 300, 07.10 iade 300 | kart 06.10 300 (ödendi) · **06.11 300 açık** · 06.12 silindi (son taksitten geriye) | 06.10 300 (ödendi) · 06.11 silinir · **06.12 300 açık** (en önce gelen AÇIK taksitten); kalan toplam aynı (300) |
| S15 | taksitli fatura 900 (3 × 300), kendi kartına 05.10 tahsilat 300, İptal Et | **409 plan-has-payments** "fatura iptal edilemez. Borcu düşürmek için iade faturası kesin."; bakiye 600, kart açık 900 | iptal KABUL; kart kapanır; 300 carinin avansı (bakiye **−300**) |
| S206 | fatura 900 açık, Taksitler'den Mevcut Borç kartı 900 (3 × 300), kart tahsilatı 300, fatura İptal Et, 06.10 fatura 500 | iptal 200, bakiye −300; **kart AÇIK** (tutar 900; taksitlerin kalanı 0 — kuyruk kartın tüketemediğini kırpıyor); 500'lük fatura açık 200, bakiye 200, gecikmiş 200 | aynı bakiye / açık; **kart KAPANIR** |

### 16.2 Değişecek yer ve DOSYA SINIRI bulgusu — (6) / S205 KODLANAMAZ (DUR, raporla — B-11)
Kapatılan kartın kalanını düşen bugünkü kural TEK yerde değil; kapalı kartı `tutar − net tahsilat` kadar alacak sayan her okuyucu (tarama `status === "closed"|p.status = 'closed'` server/**):
| Okuyucu | Dosya | Görev metninde |
|---|---|---|
| cari ekstresi / bakiye ("Kart kapatıldı · kalan düşüldü" satırı) — Tek Yükümlülük Kuyruğu'nun da girdisi (kuyruk bu satırı kart tahsilatı gibi okur) | `server/lib/accounts.mjs` accountLedger | **YAZILMAZ** listesinde |
| genel defter 689 maddesi | `server/lib/general-ledger.mjs` journal "plan-close" | izinli |
| Defter Mutabakatı / kapı: carinin bakiye SQL'i (partyTotals) ve carisiz kartın 127 beklenini | `server/routes/ledger.mjs` | listede YOK |
| cari kartının "Taksit Alacağı" (planCredit) ve tarihli bakiye süzgeci | `server/routes/accounts.mjs` | listede YOK |
| kilit izi `plans_close_lock` (waived), kart toplamları denetimi | `server/lib/integrity.mjs`, `server/lib/integrity-scope.mjs` | listede YOK |
| şüpheli alacak ayırıcısının "plan-close" kalemi | `server/lib/bank/doubtful.mjs` | **YAZILMAZ** (`bank/**`) |
| "önceden kapatılmış kartlar olduğu gibi kalır" için kart başına kural işareti | `server/lib/migrations.mjs` (göç 53) | listede YOK |
| Tablodan Aktar'ın "kalan alacaktan vazgeçildi" iletisi | `server/routes/plan-transfer.mjs` | listede YOK |
| kapatılmış kartın kalan kalemlerinin vadesi (S205 — kapatma gününün ertesi günü) | `server/lib/obligation-input.mjs` / `obligation-queue.mjs` | izinli |
`account-lines.mjs` kapalı kartın kalanını DÜŞMEZ (yalnız kart satırlarını okur); düşen `accounts.mjs`. Yalnız izinli dosyalar değişirse 689 kalkar ama cari bakiyesi / kuyruk / Defter
Mutabakatı eski kuralda kalır → 120 mutabakatı kırılır (§9 B-4'ün öngördüğü durum). Bu yüzden (6) ve S205 bu turda KODLANMADI; onay metni bugünkü davranışı söylemeye devam eder, kılavuza girmedi.
**B-11 (BAŞ MİMAR KARARI GEREKİYOR):** (A) sonraki temiz tura yukarıdaki dosyalara YALNIZ kapalı kartın kalanı için izin + kart başına kural işareti (göç 53: `plans.close_rule TEXT NOT NULL DEFAULT ''`;
göçte var olan kapalı kartlar '2.4.9' = eski kural, yeni Kartı Kapat '' = Borçta Kalsın; kilit izine girer) ve TEK yardımcı (`waivedOf(plan)`) bütün okuyuculara; (B) kart kapatılırken kalanı ayrı bir
kayda taşımak (madde yok) — okuyucular kapalı kartı 0 sayar. Öneri A (tek kural, eski veri işaretiyle; ders 10 — bütün okuyucular aynı yardımcıdan).

### 16.3 Kart küçülmesi (karar (4)) — `server/routes/plans.mjs cutPlan`
- Bugün: `cutPlan` taksitleri SONDAN geriye keser (`shrinkPlan` keseni kalanla sınırlar). Çağıranlar: `shrinkPlan` (iade → faturanın kendi kartı `ownCard`, kapsayan Mevcut Borç kartı `retarget`;
  açılış onarımı), `trimCovers` (carinin borcundan büyük kalan Mevcut Borç kartları).
- Yeni: kesim vadesi EN ÖNCE gelen taksitin AÇIK kısmından başlar (açık kısım `lib/plans.mjs allocate` ile — kart ekranının kendi hesabı; bağlı tahsilat önce kendi taksitine); ödenmiş kısma
  dokunulmaz; tutarı 0'a inen bağsız taksit silinir, tahsilat bağlı olan 0 kalır (bugünkü gibi). Açık kısım yetmezse (olmamalı — keseni kalan sınırlar) artanı bugünkü gibi sondan.
- Fazla avans: `shrinkPlan` keseni kartın kalanıyla sınırlar; iadenin kalanı aşan kısmı carinin bakiyesinde alacak (avans) olarak kalır — bugünkü davranış, kalıcı testle. Parası geri verilen iade
  kartı küçültmez (`refundOf`, G1) — bugünkü davranış, kalıcı testle.
- Ayna: `routes/invoices.mjs` açılış onarımı (2.1.0) kesilecek taksitleri KİLİT denetimi için kendisi hesaplıyor ("son taksitten geriye"); yön değişince ayna aynı yardımcıdan okur
  (`plans().cutTargets`), yoksa onarım kilitli döneme düşen taksiti kesebilir. Görev metninin invoices.mjs iznindeki "iptal / silme" dışında TEK yerlik ayna değişikliği — raporda BAŞ MİMAR KARARI'na.
- Büyüme (iade iptali, `growForInvoice`) SON taksite ekler — karar (4) büyümeyi söylemiyor; iade → iade iptali gidiş-dönüşünde takvim ilk hâline dönmez → KULLANICIYA SORULMALI (§16.6 K-3b).

### 16.4 S15 = A, S206 = A (+ S211) — `routes/plans.mjs removeForInvoice` / `closeForInvoice`, `routes/invoices.mjs cancel`
- Faturanın KENDİ kartı (invoice_id): tahsilatsızsa bugünkü gibi kaldırılır (EK-2B 35). Tahsilatlıysa (S15) iptal KABUL: kart kapanır (closed_at = iptal günü). KOD SÜRERKEN DEĞİŞTİ (koddan önceki
  tasarım 'kart tutarı = net tahsilat' idi): kapının 'Fatura ↔ taksit kartı bağı' denetimi (lib/integrity.mjs — dosya sınırı dışı) faturayla açılan kartın YALNIZ kesilmiş faturada yaşamasını
  ister → iptal 409 ledger-integrity ile geri alındı (yoklama). Uygulanan: kart faturadan AYRILIR (invoice_id = '', iz audit'te) ve tutarı 0'a iner; kart borç taşımaz, tahsilatlarının tamamı kartın
  fazlasıdır → kuyrukta 'Taksit kartından artan ödeme' (kartın son tahsilat gününde bağsız alacak). Tutar = net tahsilat bırakılsaydı faturasız Mevcut Borç kartı açılış anındaki öbür açık
  borçları tüketirdi. BAŞ MİMAR KARARI GEREKİYOR B-12 (§16.6). Kalan 0 olduğundan "Kart kapatıldı · kalan düşüldü" satırı / 689 YAZILMAZ (bugünkü formül max(0, tutar − tahsilat) = 0) — (6)'nın dosya sınırına
  takılmaz. Kartın tahsilatları carinin defterinde alacak olarak kalır → fatura borcu kalkınca carinin avansı (kitap §7.3: avans CH'de alacaklı bakiye — yeni madde YOK; tahsilatın B 100 / A 120
  maddesi aynen). Karta çek / senet sayılmışsa bugünkü 409 `plan-has-cheques` aynen. Kapatma günü kilitliyse 409 (Kartı Kapat'la aynı kural).
- Düzenle (eski etkileri geri alır) ve SİLME tahsilatlı kartın faturasında BUGÜNKÜ gibi 409 (muhasebe kâhini s58 "tahsilatlı kartta silme red"; silme önce iptali çağırır — silmeden gelen
  iptal eski kuralı ister).
- Kapsayan Mevcut Borç kartı (S206): iptalden ÖNCE faturanın kart payları (`coverState(...).coveredBy`; kapama defteri) okunur; iptalden sonra her kart payı kadar karar (4) ile küçülür
  (`shrinkPlan`: kalanla sınırlı — payın kalanı aşan kısmı avans); küçülmeden sonra kalanı 0 olan kart KAPANIR (S206: tahsilatlı; S211: tahsilatsız — tutar 0'a iner). Kartta başka borç da varsa
  (S210 — SK-41 (a)) kart payı kadar küçülür ve AÇIK kalır (karar (4)'ün harfi; muhasebe kâhini s58 bunu bekliyor) → S210 = A ile çelişki KULLANICIYA SORULMALI (§16.6 K-3a).
- e-Belge iptal kuralları DEĞİŞMEZ (iptal yolunun başındaki denetimler aynen; dryRun aynı işlemde geri alınır).

### 16.5 Okuyucular (tarama `plan_items|cutPlan|shrinkPlan|removeForInvoice|plan-has-payments` server/** + test/**)
Taksitler ekranı (kart penceresi; liste), cari ekstresi (accountLedger — kart satırları değişmez; kalanı 0 kapalı kartta düşüm satırı yok), Tek Yükümlülük Kuyruğu (gecikmiş, hatırlatma, Vade Takip,
Takvim — kartın takvimi `obligation-input` scheduleOf; dağılım değişir), WhatsApp Ödeme Hatırlatma seçimi (kuyruğun gecikmişini okur), mobil özet (kart özeti), Taksit raporları (`lib/plan-report.mjs`),
kilit izi / kapı (`integrity*.mjs`: kapalı kartın `waived` = 0), şüpheli alacak ayırıcısı (`plan-close` kalemi yalnız kalan > 0), mutabakat motoru modeli `test/mutabakat/motor.mjs` (plan-has-payments).

### 16.6 KULLANICIYA SORULMALI (iki seçenek + öneri)
- **K-3a — S210 = A ↔ karar (4) (kapsayan kartta başka borç da varken faturanın iptali):** örnek elle Borç 400 + fatura 500 → kart 900 → tahsilat 300 → fatura iptal. (A) S210'un harfi: kart kapanır,
  elle borç kendi vadesiyle kuyruğa döner, 300 avans. (B) karar (4)'ün harfi ("kartın faturası iptal / silinince küçülme … en önce gelen açık taksitten"): kart 400'e küçülür, açık kalır
  ('Tahsil Edilen 300 · Kalan 100'); muhasebe kâhini s58 (TK3 2.000, kapalı değil) bunu bekliyor. (C) uç durum böyle kalsın (BİLİNEN SINIR). Bu turda B kodlandı (bakiye iki okumada aynı).
- **K-3b — iade iptalinde kartın büyümesi (karar (4) yalnız küçülmeyi söylüyor):** (A) büyüme küçülmenin tersi (kesilen taksitlere geri — takvim ilk hâline döner); (B) bugünkü gibi son taksite.
  (C) uç durum böyle kalsın (BİLİNEN SINIR). Bu turda B (bugünkü).

- **B-12 (BAŞ MİMAR KARARI GEREKİYOR) — S15'te kendi kartın faturadan ayrılması:** (A) bu turdaki gibi: kart faturadan ayrılır, tutarı 0, tahsilatı kartın fazlası (avans kartın SON tahsilat gününde
  — çok tahsilatlı kartta her tahsilatın kendi günü değil); (B) integrity.mjs / integrity-scope.mjs'e 'iptal edilmiş faturanın kapalı kartı' istisnası (dosya izni) — kart faturaya bağlı kalır.
  Öneri A (kapı kuralı değişmez; kart ekranında fatura bağı görünmez — iz audit'te).
- **Kartı Kapat'la önceden kapatılmış tahsilatlı kendi kartın faturası:** iptal bugünkü gibi 409 (kalan ikinci kez düşülürdü); ileti 'Önce kartı Yeniden Aç ile açın'. Kararlarda yok — BİLİNEN SINIR önerisi.

### 16.7 Nasıl bozulur? (önce yazıldı; testler buradan)
1. Sıra: tahsilat → iade ↔ iade → tahsilat; bağlı tahsilatlı ('Hangi Taksite') kartta küçülme bağlı taksitin ödenmiş kısmını kesmez.
2. Kısmen ödenmiş ilk taksit: kesim yalnız açık kısmından.
3. İade kalanı aşar → kart kalanı 0, fazlası avans; parası geri verilen iade kartı küçültmez.
4. S15: iptal → bakiye −tahsilat; sonraki fatura avanstan kapanır; Kasa / mizan değişmez (yalnız satış maddesi kalkar); 689 YOK; Mutabakat Testi / Defter Mutabakatı temiz.
5. S15 + kilit: tahsilat kilitli dönemde → bugünkü bağ kilidi (S160) aynen; kapatma günü kilitli → 409.
6. Silme / Düzenle tahsilatlı kartın faturasında 409 (bugünkü gibi); tahsilatsız kart iptalde kaldırılır (bugünkü gibi).
7. S206: tahsilatlı / tahsilatsız (S211) kapsayan kart kapanır; başka borçlu kart küçülür, açık kalır (K-3a).
8. Eski sürüm verisi (v2.4.9 gerçek kodu): taksitli kart, kapatılmış kart, küçülmüş kart → güncellemeden sonra değerler aynen (bu tur yalnız YENİ yazımları değiştirir).
9. İki kişi aynı anda: iptal ile kart tahsilatı (tek işlem — bank.post / store.tx).
10. Geri yükleme: iptal edilmiş faturanın kapalı kartı yedekte aynen.

### 16.8 Tur 3 devamı (20.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b3-devam-istem.txt`; ana oturumun kararları iş listesi D 'BAŞ MİMAR KARARI 20.11 04:15', C S216 / S217)
- (1) B-11 = A: (6) Borçta Kalsın + S205 ayrı tur 3b'de — bu turda DOKUNULMADI; Kartı Kapat onay metni ve kılavuzu bugünkü davranışı anlatmaya devam eder. (2) B-12 = A: §16.4'teki kod aynen.
- (3) **S210 = A** (K-3a'nın yanıtı — özel karar karar (4)'ün genel metninin önünde): faturayı içine almış Mevcut Borç kartı faturanın iptalinde KARTTA BAŞKA BORÇ DA OLSA kapanır. Uygulama
  (`routes/invoices.mjs cancel` → `routes/plans.mjs settleCoverOnCancel`): iptalden ÖNCE faturanın kart payları kart / bağ defterinden okunur (`coverState(...).coveredBy` — iadedeki okumanın
  aynısı; carinin açık Mevcut Borç kartı yoksa okunmaz, `hasOpenCover`); payı olan her kart `closeForInvoice` ile kapanır (kalanı karar (4) sırasıyla kesilir → kart tutarı = net tahsilat; kalan 0
  olduğundan "kalan düşüldü" satırı / 689 YAZILMAZ). Karttaki öbür borç (elle Borç) kartın dışına çıkar ve kendi vadesiyle carinin kuyruğuna döner; kartın tahsilatı carinin alacağı (avans) olarak
  kalır. Payı olmayan öbür Mevcut Borç kartları önceki gibi `trimCovers` ile borçtan büyük kalmaz (kalanı 0'a inen kapanır). Örnek (test `c7b-tur3-kart-250` 6. sınama; sahte saat 08.10.2026): elle Borç
  400 (07.10) + fatura 500 → kart 900 (10.10 / 10.11 / 10.12) → tahsilat 300 → fatura İptal Et → kart KAPALI, tutar 300; bakiye 100; gecikmiş **100** (elle borç 07.10'dan; önceki kodda kart açık 400 /
  kalan 100, gecikmiş 0). İptal Et penceresi (cancelNotice) kartın kapanacağını, tahsilatın avans olacağını ve öbür borcun kendi vadesiyle kalacağını söyler. Muhasebe kâhininin s58 beklentisi (TK3
  açık) bu yüzden programdan AYRILIR — kâhine dokunulmadı; "S210 = A — kâhin bakımı bekliyor".
- (4) S216 = C: iade iptalinde kartın büyümesi bugünkü gibi SON taksite (kod değişmedi; kalıcı testle gösterilir). (5) **S217 = A**: Kartı Kapat'la önceden kapatılmış tahsilatlı kendi kartın faturasının
  İptal Et'i 409 (`plan-has-payments`), ileti "Faturanın taksit kartı (“…”) kapatılmış ve N tahsilatı var; fatura iptal edilemez. Önce kartı Yeniden Aç ile açın." (6) Açılış onarımının kilit
  aynasının `cutTargets`'tan okunması KABUL (§16.3).

### 16.9 Tur 3 devamı 3 (20.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b3-devam3-istem.txt`) — S218 = B
- Bulgu (devam 2 ajanının G2 komşusu, ders 6): açılış onarımı (2.1.0; 2.0.24–2.0.26'da iade geri ödemesiyle yanlış büyümüş kartı küçülten) karar (4)'ün yönünü almıştı (`shrinkPlan` → `cutPlan`
  en önce gelen açık taksitten; kilit aynası `cutTargets`'tan). Küçülecek ilk açık taksit KİLİTLİ dönemdeyse kart onarılmıyordu (`test/acilis-onarimi-hiz-250` kırmızı: FIS2026000000047 kartı
  kalan 1.300 → hedef 1.250; taksitler 19.09 666,66 · 19.10 683,34, kilit 07.10 — eski kod 50'yi 19.10'dan keserek onarıyordu).
- **S218 = B** (iş listesi C; kullanıcı kuralıyla öneri uygulandı 20.11 07:49): açılış onarımı ve onun kilit aynası ESKİ YÖNDE (son taksitten geriye, taksit tutarından) keser; karar (4) yalnız YENİ
  küçülmeler içindir (iade, iptal / silme, `trimCovers` — bunlar DEĞİŞMEDİ).
- Kod: `routes/plans.mjs cutTargets(planId, cut, open, { order })` — `order: "tail"` eski döngünün birebiri (ziyaret edilen her taksit, kesilen 0 olsa da; tutarı 0'a inen bağsız taksit silinir);
  `cutPlan` / `shrinkPlan` `order`'ı geçirir (varsayılan "due" = karar (4)). `routes/invoices.mjs repairOwnCards`: kilit aynası `cutTargets(..., { order: "tail" })`, kesim `shrinkPlan(..., { order: "tail" })`
  — ayna ile kesim yine TEK yardımcıdan ((6) KABUL korunur). Başka çağıran `order` vermez.

### 16.10 Tur 3 devamı 3 — kabul E'nin hız bulgusu ve düzeltmesi (ders 47, 53 (a); KODLA BİRLİKTE)
- Bulgu (devam 2 ajanının kilitsiz ölçümü da458f89 ↔ c7b3-taban, temiz 100 bin satır; ölçülen cari 4 açık Mevcut Borç kartlı): fatura kartı (GET, İptal Et notu) 91 → 144 ms, satış yazımı
  (yanıt fatura kartını döndürür) 171 → 229 ms, fatura iptali / silme 102 → 322 ms. Kök neden (CPU profili, ana kopyada yeniden üretildi): (a) `coverCancelText` ve iptalin `coverIds`'i her
  faturada kapsam okumasını (`coverState` → `settledFor`: carinin bütün defteri + kapama, ~100 ms) yapıyordu; (b) iptalin `settleCoverOnCancel` → `trimCovers`'ı `accounts().detail`'i
  kuyruklu (Tek Yükümlülük Kuyruğu + Kalan eki) okuyordu (~230 ms). Ölçümdeki 'Taksitler Geciken listesi' farkı kod değil, VERİ ayrışmasıdır (yeni kodda döngünün iptalleri kartları
  kapatıp küçültüyor; tanı betiğinde aynı veride iki kod aynı).
- Düzeltme (davranış AYNEN): (1) `routes/invoices.mjs mayBeCovered`: Mevcut Borç kartı yalnız açıldığı ANA kadar doğmuş borcu kapsar (`lib/invoice-settle.mjs`: kapsam yalnız
  `born <= plan.at`; plan.at = kartın created_at, faturanın born'u = COALESCE(NULLIF(issued_at, ''), created_at)) → faturadan sonra açılmış etkin Mevcut Borç kartı yoksa kapsam okunmaz
  (eşitlikte ve ISO-UTC dışı biçimde okunur — koruyucu); (2) `routes/plans.mjs trimCovers` `accounts().detail(..., { withRemaining: false })` (okuduğu bakiye, kart özetinin kendi
  toplamları ve defter satırları iki yolda aynı; kuyruk gerekirse `openByQueue` kurar). Eşdeğerlik + dişi: `test/c7b-tur3-hiz-250.test.mjs`.

## 17. Tur 3b (20.11.2026; görev metni `docs/devir/2.5.0-DEVAM/c7b3b-istem.txt`) — Kartı Kapat 'Borçta Kalsın' (karar (6) / KG-23 / S205; B-11 = A) — KODDAN ÖNCE yazıldı
Kararlar (iş listesinden AYNEN; görev metni): KG-23 = A ("Alacak CH'de kalır (madde yok)"); (6) 2B-S5 / S10 = A "Borçta Kalsın: Kartı Kapat yalnız ödeme planını bitirir; kalan carinin borcunda kalır,
ertesi günden gecikmiş, hatırlatma gider; vazgeçme ayrı ve görünür işlemle (Alacak Yaz ya da Şüpheli → Değersiz; VUK md. 322). … önceden kapatılmış kartlar olduğu gibi kalır"; S205 = A
("kalan 600'ün tamamı 11.04'ten gecikmiş"); BAŞ MİMAR KARARI 20.11 04:15 (1) B-11 = A (kart başına kural işareti, var olan kapalı kartlar eski kural, TEK yardımcı bütün okuyuculara).

### 17.1 Kart başına kural işareti — göç 53
- Sütun `plans.close_rule TEXT NOT NULL DEFAULT ''`. Değerler: `'2.4.9'` = ESKİ kural (kapatılınca kalan carinin borcundan düşülür: cari ekstresinde "Kart kapatıldı · kalan düşüldü", defterde
  B 689 / A CH); `''` = Borçta Kalsın (kalan borçta kalır; madde YOK). Göç 53 (bu tabandaki son göç 52): sütun BU göçte eklendiyse `UPDATE plans SET close_rule = '2.4.9' WHERE status =
  'closed'` (silinmiş kartlar dahil — Silinenler'den geri yüklenen kapalı kart da eski kuralla döner); yeniden koşuda (sütun var) dokunulmaz (eşgüçlü). Tutar / tarih / durum DEĞİŞMEZ.
- Yazım: Kartı Kapat / Yeniden Aç (routes/plans.mjs PUT, durum değişince) `close_rule = ''` — Yeniden Aç → yeniden Kapat YENİ kuralla (gerekçe: kural, kapatma İŞLEMİNE bağlıdır; "önceden
  kapatılmış kartlar olduğu gibi kalır" kapalı durumu süren kartı söyler — Yeniden Aç ile kart artık kapatılmış değildir, eski 689 / "kalan düşüldü" bugünkü gibi kalkar; yeniden kapatma
  yeni bir Kartı Kapat'tır; para kuralı açısından iki okuma yok: Yeniden Aç anında borç geri gelir (bugünkü davranış), yeni kapatmada borç yerinde kalır). `closeForInvoice` (S15 / S206 / S210
  iptal kapanışı) da `''` yazar (kalan 0 — iki kuralda aynı). Program başka yerde yazmaz.
- Kilit izi: `lib/integrity.mjs` LOCK_SQL'e `plans_close_rule_lock` = `SELECT id, close_rule FROM plans WHERE close_rule <> '' AND <kapanış günü> <= ?1` (requires `plans.close_rule`, since
  "2.5.2" — tanım sürümü AYNI, 2.5.2 yayımlanmadı). Yalnız eski kurallı (işaretli) kartlar satır üretir. Kapı dışı '2.4.9' ↔ '' değişimi kilitli dönemde izi değiştirir. `plans_close_lock`
  (vazgeçilen kalanın izi) YALNIZ kalanı düşülen kartlarla (`… AND close_rule = '2.4.9'`): göç 53'ten sonra v2.4.9 verisinde satırlar AYNEN (bütün kapalı kartlar '2.4.9') → eski koşuların
  izinde yanlış alarm yok; Borçta Kalsın kartının kapanışı defter olayı değildir, kilide girmez.
- Göç öncesi (≤ 52) yedeğin geri yüklenmesi göç 53'ü koşar → o yedeğin kapalı kartları eski kural. İki şirket: her dosya kendi göçüyle. Eski sürüme dönüş (v2.4.9 programı) işareti bilmez →
  Borçta Kalsın kartının kalanını düşer (BİLİNEN SINIR — eski programın kendi kuralı).

### 17.2 TEK yardımcı — `server/lib/accounts.mjs` (saf; veri tabanına dokunmaz)
- `CLOSE_RULE_WAIVE = "2.4.9"`; `waivesRemaining(plan)` = `plan.status === "closed" && plan.closeRule === CLOSE_RULE_WAIVE` (alan yoksa / boşsa Borçta Kalsın — alan SEÇİLMEYEN okuyucu
  eski kuralı sessizce taşımasın: testler bunu yakalar); `waivedOf(plan, paid)` = waivesRemaining ? max(0, tutar − net tahsilat) : 0 (yuvarlanmış TL).
- SQL ikizi: `waivesSql(alias, { column = true } = {})` = `(alias.status = 'closed' AND alias.close_rule = '2.4.9')` — sütun yoksa (`column: false`, göç öncesi depo) `alias.status = 'closed'`
  (eski veri = eski kural). `closeDaySql(alias)` = kapanış günü (689'un tarihi; bugünkü ifade aynen: MAX(COALESCE(closed_at, substr(updated_at, 1, 10)), Kayıt Tarihi)).
- S205 vadesi: `keptDueOf(dueDate, closeDay)` = min(kalemin vadesi, KAPANIŞ GÜNÜ) ve SQL ikizi `keptDueSql(planAlias, dueColumn)` = Borçta Kalsın ile kapatılmış kartta
  `MIN(due, <kapanış günü>)`, öbür kartlarda `due`. Kuyruğun kuralı "vade < gün" → kalem kapanışın ERTESİ gününden gecikmiş (S205 örneği: kapanış 10.04 → 11.04'ten; §16.1: 08.10 →
  09.10'dan; "bugün açılan taksitsiz kart ertesi günden gecikir" S1 ile aynı). KOD SÜRERKEN DÜZELTİLDİ: ilk taslak vadeyi kapanış ertesi yazıyordu (gecikmiş bir gün geç başlardı). "Kalemin kendi vadesine bakılmaz" görev metninin S205 açıklamasıdır (soru vadesi GELMEMİŞ kalemi soruyordu);
  vadesi kapanıştan ÖNCE geçmiş kalem KENDİ vadesiyle gecikmiş kalır (MIN) — harfiyen okuma (hepsi kapanış ertesi) kapatma günü gecikmişi 0'a indirir ve gecikme yaşını küçültürdü; gecikmiş
  TUTARI kapanış ertesinden itibaren iki okumada aynı (rapor: KULLANICIYA SORULMALI).

### 17.3 Okuyucular (tarama `status === "closed"|status = 'closed'|plan-close|closeDayOf` server/** — ders 10)
| Okuyucu | Dosya:işlev | Bağlantı |
|---|---|---|
| cari ekstresi / bakiye (satır "Kart kapatıldı · kalan düşüldü") — Tek Yükümlülük Kuyruğu'nun girdisi de bu satırlardan | `lib/accounts.mjs` accountLedger | `waivedOf(plan, paid)`; plan nesnesi `closeRule` taşır (`lib/account-lines.mjs` ledgerPlansByAccount / ledgerPlansOf seçer; `routes/plans.mjs` PLAN_SQL / forAccount) |
| genel defter 689 | `lib/general-ledger.mjs` journal | `waivedOf(plan, plan.paid)`; `routes/ledger.mjs` rows() `p.close_rule AS closeRule` (sütun yoksa '2.4.9') |
| Defter Mutabakatı: carisiz kartın 127 beklenini | `routes/ledger.mjs` expected() | `waivedOf` |
| Defter Mutabakatı / kapı: carinin bakiye SQL'i | `routes/ledger.mjs` partyTotals | `CASE WHEN waivesSql('p') …` |
| kapı: carisiz kart (kart bazında) | `lib/integrity.mjs` party:plans, `lib/integrity-scope.mjs` party:plans | `waivedOf` (SQL'e close_rule) |
| kilit izi | `lib/integrity.mjs` LOCK_SQL plans_close_lock + plans_close_rule_lock | `waivesSql('p')`, `closeDaySql('p')` |
| süzgeç: "kapatılmış kart kilitli dönem" / "kapatılmış kartın tahsilatı" | `lib/integrity-scope.mjs` | yalnız kalanı düşülen kart (`waivesRemaining`; alan listesine `close_rule`) |
| kapanış günü kilidi (Yeniden Aç, silme, geri yükleme, tutar, tahsilat; Tablodan Aktar bağı `plan-transfer.mjs` bunu çağırır) | `routes/plans.mjs` closeDayOf / assertCloseOpen | yalnız kalanı düşülen kart (Borçta Kalsın kartın kapanışı defter olayı değil) — `plan-transfer.mjs` DEĞİŞMEZ (closeDayOf'tan okur) |
| cari "tarihli" kilit (lockedSince — silme / geri yükleme / tür) | `routes/accounts.mjs` lockedSince | `waivesSql('p')` |
| Cari Listesi bakiye (planCredit) | `routes/accounts.mjs` list | `paid + waivedOf(plan, paid)` (= bugünkü max(tutar, ödenen) eski kuralda) |
| şüpheli ayırıcısının "plan-close" kalemi | `lib/bank/doubtful.mjs` doubtfulCredits | `WHERE waivesSql('p')` |
| Tek Yükümlülük Kuyruğu girdisi: kart takvimi (S205; vade = min(kalem, kapanış günü)) | `lib/obligation-input.mjs` obligationExtras / settleTables / accountSettleInput | `keptDueSql('p', 'i.due_date')` (üç sorgu aynı ifade) |
| kart penceresi / Taksitler / cari kartı özeti / zil / Vade Takip / nakit akışı / yaşlandırma (kuyruk görünümü) | `routes/plans.mjs` withQueue, shownTotalsOf, queueExtras, summariesByAccount, dueItems, openItems | Borçta Kalsın kapalı kart AÇIK kart gibi kuyruktan gösterilir (durumu "Kapalı" kalır); kalemin günü `keptDueOf`; dueItems / openItems kalanı düşülmemiş kapalı kartı da alır |
| Kartı Kapat onay penceresi | `client/assets/hof-plans.js` closePlan | metin sonucu söyler |
`lib/obligation-queue.mjs` DEĞİŞMEZ (vade girdiden). `lib/ledger-rule-249/**` DEĞİŞMEZ (2.4.9 kopyası: her kapalı kartta 689 — yalnız eski kuralla donan dönemi türetir; Borçta Kalsın kartı
güncellemeden sonra açık dönemde kapanır). WhatsApp Ödeme Hatırlatma (`lib/whatsapp/queue.mjs` overdueOf: eski anlamlı totals.overdue + AÇIK kart) YAZILMAZ → Borçta Kalsın kartının gecikmişi
WhatsApp hatırlatmasına Ç5-C'de (WhatsApp'ın kuyruğun gecikmişine geçişi) girer (BAŞ MİMAR KARARI GEREKİYOR, rapor). Zil (dueItems) bu turda alır.

### 17.4 Nasıl bozulur? (önce yazıldı; testler buradan)
1. Aynı caride eski kapalı kart ('2.4.9', kalan düşülmüş) + yeni Borçta Kalsın kartı: bakiye = yalnız yenisinin kalanı; 689 yalnız eskisinin; Defter Mutabakatı / Mutabakat Testi temiz.
2. Yeniden Aç → yeniden Kapat: eski kurallı kart yeniden açılınca borç geri gelir (bugünkü), yeniden kapatınca Borçta Kalsın (689 kalkar, bakiye kalır).
3. Kapatıldıktan sonra: cari tahsilatı (gecikmişi kapatır), kart tahsilatı (kapalı karta), iade faturası (kendi kartı kapalı — küçülmez, iade alacağı kalemi kapatır), Alacak Yaz (vazgeçme), Şüpheliye alma.
4. S205: kapanış günü gecikmiş = kapanıştan önce vadesi geçmişler; ertesi gün kalanın tamamı; vadesi gelmemiş kalem kapanış ertesine çekilir; mutant 'kalem vadesinden başlat' kırmızı.
5. Kilitli dönemde kapatılmış ESKİ kart: Yeniden Aç 409 (bugünkü); Borçta Kalsın kartı kilitli kapanışta Yeniden Aç / tahsilat serbest; işaret kapı dışı değişirse kilit izi değişir.
6. Yedek → geri yükleme: ≤ 52 yedeği → göç 53 → kapalı kartlar eski kural; 53 yedeği işaretiyle.
7. v2.4.9 gerçek kodun verisi: kapatılmış kart göçten sonra eski kuralda — bakiye, ekstre, defter (689) AYNI; Kural Değişikliği Farkı çıkmaz.
8. İki şirket: her dosyanın kendi işareti. Carisiz eski kart: 127 beklenen = defter.
9. Aynı gün sıra (ders 31): kapanış günü tek; gecikme yüklemi yalnız tarih.

## 18. Ç7b DK + S229 ALTIN birleşik küçük tur (21.11.2026; görev metni `docs/devir/2.5.0-DEVAM/dkfix-istem.txt`) — S234 = A, S235 = B, altın test uyarlaması — KODDAN ÖNCE yazıldı
Kararlar (iş listesinden AYNEN; görev metni): S234 = A ("karar (4) kapalı (kalanı borçta kalan) karta da uygulanır — kart küçülür (vadesi en önce gelen açık taksitten), Kalan 300"), S235 = B ("bugünkü
gibi — Düzenle yeni ödeme planı kurar, kart açılır; Düzenle penceresi kartın YENİDEN AÇILACAĞINI söyler"), karar (4) 2B-S3 = A, (6) 2B-S5 / S10 = A, S205 = A, S226 = C (iptalde DOKUNULMAZ), S229 = A,
S230 = A. Bugünkü davranış programın KENDİSİYLE yeniden üretildi (ders 6; taban dkfix-taban = 94a7b475; sahte saat 08.10.2026; yoklama betikleri not defteri `dkfix-ab23/probe/` — Ç7b dar kontrolünün
p2 / p3 / p4'ü + kendi kartı için p6).

### 18.1 Bugünkü davranış (örnek tutarla; taban)
| # | Örnek | Bugün (taban) | Kararın istediği |
|---|---|---|---|
| S234-a | fatura 900 (07.10, açık hesap) → Mevcut Borç kartı 900 (3 × 300; 10.10 / 10.11 / 10.12) → 08.10 kart tahsilatı 300 → 08.10 Kartı Kapat ('Kalan 600') → 08.10 iade 300 (borçtan) | bakiye 300; gecikmiş 08.10 0 / 09.10 300 (doğru); kart penceresi, cari kartı özeti, Taksitler listesi **Kalan 600** (satır kalanları 300; tutar 900); Yeniden Aç → Kartı Kapat onayı **'Kalan 600'** | kart 600'e küçülür (en önce gelen AÇIK taksitten), Kalan **300** her üç yerde; onay 300; bakiye / gecikmiş / defter AYNEN |
| S234-a (kontrol, kart açık) | aynı, Kartı Kapat yok | kart 600 (10.11 taksiti silinir, 10.12 kalır), Kalan 300 | değişmez |
| S234-b (kendi kartı) | taksitli fatura 900 (06.10; 06.10 / 06.11 / 06.12) → 08.10 kart tahsilatı 300 → Kartı Kapat → iade 300 → iade iptali | iade sonrası tutar 900, **Tahsil Edilen 600** (iade alacağı kuyrukta 'tahsil edilen'), Kalan 300; iade iptali → Kalan 600 | karar (4) kapalı karta da: tutar 600, Tahsil Edilen 300, Kalan 300 (açık kartla aynı); iade iptali → kart 900'e geri büyür (S216 = C: son taksite), Kalan 600; bakiye / gecikmiş AYNEN |
| S234-c (Düzenle) | fatura 900 → Mevcut Borç kartı 900 → Kartı Kapat → faturayı Düzenle ile 300'e indir | bakiye 300; kart **Kalan 900** (satırlar 300) — **AÇIK kartta da aynı** (Kalan 900; Düzenle hiçbir kartı küçültmüyor) | §18.3 — DOSYA SINIRI |
| S235 | taksitli fatura 900 (3 × 300; 06.10), tahsilatsız, 08.10 Kartı Kapat, 09.10 Düzenle (3 → 4 adet) | kapalı kart silinir, YENİ AÇIK kart 1.200; bakiye 1.200; gecikmiş 09.10 900 → 400 (kapanış sessizce kalkar); Düzenle onayı yalnız genel metin | davranış AYNEN; onay metni kartın yeniden açılacağını söyler |

### 18.2 S234 = A — değişecek yer (`server/routes/plans.mjs`; DOSYA SINIRI: yalnız kart küçülmesinin kapalı karta uygulanması)
- `shrinkPlan` (iade → faturanın kendi kartı `ownCard`, kapsayan Mevcut Borç kartı `retarget`): bugün `status === "closed"` → 0. Yeni: kalanı DÜŞÜLMEMİŞ (Borçta Kalsın — `!waivesRemaining`) kapalı kart da
  karar (4) sırasıyla (`cutTargets` "due") küçülür; eski kurallı ('2.4.9', kalanı düşülmüş) kapalı kart bugünkü gibi 0 (kalanı zaten carinin borcunda değil). Açılış onarımı (`order: "tail"`, S218 = B)
  kapalı kartı bugünkü gibi atlar (onarım 2.0.24–2.0.26'nın yanlış büyüttüğü kartlar içindir; değişmez).
- `trimCovers` (iade sonrası carinin borcundan büyük kalan Mevcut Borç kartları; faturasız stok iadesi `stock.mjs`; iptal `settleCoverOnCancel`): bugün `status === "closed"` atlanır. Yeni: Borçta Kalsın
  kapalı kart da kırpılır — YALNIZ iade / alacak yollarında; İPTAL yolu (`settleCoverOnCancel` → `trimCovers(..., { closed: false })`) kapalı kartı bugünkü gibi atlar (S226 = C: iptal BİLİNEN SINIR,
  davranış AYNEN). Faturasız stok iadesi (`stock.mjs`, cariye alacak) iade yolu sayılır (karar (4) "iade borçtan düşülünce") — kodu değişmez, `trimCovers`'ın varsayılanını alır.
- `growForInvoice` (küçülmenin TERSİ: iade iptali / iade düzenlemesi `restoreCuts`, kendi kartı `ownCard`): bugün kapalı kart büyümez. Küçülme kapalı karta uygulanınca tersi de uygulanmazsa iade → iade
  iptali sonunda kart borçtan KÜÇÜK kalır (iade iptalinin geri getirdiği borç kartın dışında, faturanın kendi vadesiyle kuyruğa düşer → gecikmiş değişir). Yeni: Borçta Kalsın kapalı kart da büyür
  (S216 = C: son taksite — bugünkü kural); eski kurallı kapalı kart bugünkü gibi büyümez. (Görev metnindeki 'doğrudan yardımcı' — küçülmenin kayıtlı tersi `coverCuts`; raporda ayrıca yazılır.)
- Değişmeyen: `cutTargets` / `cutPlan` (sıra karar (4)), `closeForInvoice` (iptal kapanışı), Kartı Kapat / Yeniden Aç, kural işareti, kuyruk, defter. Kesim kalemlerin kendi vadesini değiştirmez; Borçta
  Kalsın kartında kalemin günü `keptDueOf` = min(vade, kapanış günü) — en önce gelen açık taksitten kesmek kuyruğun alacağı FIFO kapamasıyla aynı kalemi kapatır → gecikmiş tutarı ve günü AYNI (§18.6 (2)).
- Okuyucular (tarama `trimCovers|shrinkPlan|growForInvoice|coverCuts|plan.trimmed|plan.grown` server/** + test/**): `routes/invoices.mjs` retarget / restoreCuts / ownCard / repairOwnCards (açılış onarımı),
  `routes/stock.mjs` (stok iadesi), `lib/account-lines.mjs` (kart olayları), kart penceresi / Taksitler / cari kartı özeti / zil / Vade Takip (withQueue — Borçta Kalsın kapalı kart kuyruktan), Kartı Kapat
  onayı (shownRemaining), mutabakat motoru modeli `test/mutabakat/motor.mjs` (trimCovers / syncOwn / iade iptali büyümesi — model bu kurala göre güncellenir: iade / stok iadesi yolunda kapalı kart da;
  iptal yolunda değil), testler (G2 komşu; tam liste raporda).

### 18.3 S234-c — Düzenle ile azaltma: DOSYA SINIRI (KODLANMADI; BAŞ MİMAR KARARI GEREKİYOR)
Fatura Düzenle (`routes/invoices.mjs editInvoice`: eski etkiler geri alınır → `writeIssued`) kapsayan Mevcut Borç kartına HİÇ dokunmaz — `retarget` / `trimCovers` yalnız iade belgesinde çağrılır. Tabanda
AÇIK kartta da Düzenle 900 → 300 sonrası kart Kalan 900 / bakiye 300 (önceden var; Ç7b dar kontrolünün 'Açık kartta Alacak Yaz' gözlemiyle aynı aile). `plans.mjs` içinde Düzenle'nin geçtiği tek yer
faturanın KENDİ kartını kaldıran `removeForInvoice`; kapsayan karta ulaşan çağrı ancak `invoices.mjs editInvoice`'a eklenebilir (görev metninde invoices.mjs YALNIZ `ownPayState`). Ayrıca yalnız kapalı karta
eklenirse açık kartla ayrışır; ikisine eklenirse açık kartın bugünkü davranışı da değişir (karar (4) Düzenle'yi söylemiyor). → raporda BAŞ MİMAR KARARI GEREKEN (öneri: `editInvoice`'ta iadedeki gibi
`coverState` önce / sonra farkı kadar kapsayan kartı küçült + `trimCovers` — açık ve Borçta Kalsın kapalı kartta aynı; ayrı küçük tur).

### 18.4 S235 = B — Düzenle onayı (`client/assets/hof-invoices.js` YALNIZ onay metni)
- Fatura kartı GET'i `plan` (faturanın KENDİ kartı: id, ad, tutar, durum) taşır — sunucu değişmez. Form `startForm({ modify })` kapalı kartı `form.modifyPlanClosed` olarak tutar; 'Değişiklikler
  Kaydedilsin mi?' onayına YALNIZ bu durumda cümle eklenir: yeni ödeme Taksitlendir ise "Bu faturanın kapatılmış taksit kartı yeniden açılır; kalan borç yeni ödeme planına girer.", Açık Hesap'a
  çevrildiyse "Bu faturanın kapatılmış taksit kartı kaldırılır; kalan borç faturanın vadesiyle açık hesapta izlenir." (ikisi de bugünkü davranış — p3 a1 'taksitsiz yap'). Kart açıksa / yoksa metin yok.
  Tahsilatlı kapalı kartta Düzenle bugünkü gibi pasif (modifyBlock) — metin görünmez. Eski kurallı ('2.4.9') kapalı kartta da cümle doğrudur (kart kaldırılır, yeni kart açılır) — aynı metin.

### 18.5 S229 ALTIN TEST UYARLAMASI (test + yalnız-okuma alan)
- (a) `routes/invoices.mjs shape`: yalnız `inPlan` varken (ownOpen gibi) `ownPayState` = faturanın KENDİ kapama durumu (shownState'ten önceki ad). Sınır, kapama, gösterim DEĞİŞMEZ. K1 yardımcısı
  (`test/guvenilirlik/kapama-k1-fark.mjs invoiceStates`) faturanın KENDİ açığını / durumunu okur (`ownOpen ?? open`, `ownPayState ?? payState`); ekran tutarlılığı S230'a göre: ödenen + GÖSTERİLEN açık +
  inPlan = ödenecek (kendi açıkla: ödenen + kendi açık = ödenecek).
- (b) `test/banka-210-altin.test.mjs`: yeni tarafın Anlık Durum'unda `invoices.openSale` / `overdueSale`'e S230 karar numaralı katlama — kartların aldığı açık kısım (satış faturası başına ownOpen −
  open; overdueSale'de vadesi geçenler) geri eklenir, katlanan tutar sayılır ve günlüğe yazılır (bu veride 1.840,97 TL). Katlamadan sonra kalan her alan v2.0.26 ile birebir.
- (c) `open` / `payState` okuyan öbür altın / göç / güvenilirlik testleri taranır (`test/` + `npm run` betikleri) ve koşulur.

### 18.6 Nasıl bozulur? (önce yazıldı; testler buradan)
1. Kapalı (Borçta Kalsın) Mevcut Borç kartı + iade (borçtan) → kart küçülür, Kalan = carinin karttaki borcu (pencere, cari kartı özeti, Taksitler listesi); bakiye / gecikmiş (kapanış günü ve ertesi) /
   Mizan 120 / Mutabakat Testi önce / sonra AYNI.
2. Kapanıştan ÖNCE vadesi geçmiş açık taksit varken iade: kesim o taksitten (en önce gelen açık) — kuyruğun FIFO'suyla aynı kalem → kapanış günü gecikmişi tabanla AYNI.
3. İade kalanı aşar → kart kalanı 0, fazlası avans (kalanla sınırlı); parası geri verilen iade kartı küçültmez (G1).
4. İade → iade iptali (ve iade Düzenle): kapalı kart geri büyür (son taksite); Kalan = borç; bakiye / gecikmiş AYNI.
5. Yeniden Aç → Kartı Kapat onayı küçülmüş kalanı sorar (300); yeniden kapatma Borçta Kalsın.
6. ESKİ kuralla (689; '2.4.9') kapanmış kart + iade: DEĞİŞMEZ (küçülmez, büyümez; 689 / bakiye aynı).
7. İptal (S226 = C): kapalı kartlı caride faturanın İptal Et'i — kapalı kart DEĞİŞMEZ (açık Mevcut Borç kartı da varken bile).
8. Silme (faturanın Sil'i iptali çağırır) — 7 ile aynı.
9. İki kart aynı caride (biri açık, biri Borçta Kalsın kapalı) + iade: en yeni karttan (trimCovers sırası); iki kartın Kalan toplamı = borç.
10. Kapalı karta sonradan tahsilat + iade: küçülme kartın KENDİ kalanıyla sınırlı.
11. Kilitli dönem: kart küçülmesi Kartı Kapat'ın kilidine takılmaz (Borçta Kalsın kapanışı defter olayı değil — closeDayOf ''); iadenin kendi tarih kilidi aynen.
12. v2.4.9 verisinden göç: bütün kapalı kartlar '2.4.9' → değişmez (6).
13. Kendi kartı (taksitli fatura) Borçta Kalsın kapalı + iade → kart küçülür (karar (4)); faturanın açığı = kartın kalanı (v2.0.24 değişmezi).
14. Açılış onarımı (order "tail"): kapalı kart bugünkü gibi atlanır.
15. S235: kapalı kartlı taksitli faturada Düzenle → onayda cümle (Taksitlendir / Açık Hesap'a göre); açık kartta cümle YOK; davranış (yeni kart / kart kaldırılır) aynen.

### 18.7 Kod ve sonuç (kodla birlikte; kanıt docs/kanit/2026-11-21/dkfix-*)
- `routes/plans.mjs`: `shrinkable(row, order)` (açık kart; ya da kalanı düşülmemiş kapalı kart, order "tail" dışında) — `shrinkPlan`, `trimCovers` (yeni seçenek `{ closed = true }`; `settleCoverOnCancel`
  `closed: false`), `growForInvoice` (+ FREEZE_CLOSE) aynı yüklemi okur. `routes/invoices.mjs shape`: `ownPayState` (yalnız inPlan varken). `client/assets/hof-invoices.js`: `form.modifyPlanClosed` + onay
  cümlesi. Testler: `test/dkfix-s234-kapali-kart-250.test.mjs` (T1–T9), `test/e2e/senaryo-dkfix-250.mjs` (A–D + E gözlem), altın test S230 katlaması, K1 yardımcısı, mutabakat motoru.
- KOD SÜRERKEN GÖRÜLDÜ (önce / sonra sayıyla, yoklama pk.mjs; ders 6):
  (a) §18.6 (2) — kapanıştan önce vadesi geçmiş açık taksitli kapalı kartta iade: KAPANIŞ GÜNÜ gecikmişi taban 300 → yeni 0 (kuyruk tabanda iade alacağını kartın SON kalemine kapatıyordu; karar (4) en önce
      gelen açık taksiti keser — açık kartla aynı); ertesi gün aynı (600). Kararın "gecikmiş her seçenekte AYNI" önermesi bu alt durumda tutmuyor → KULLANICIYA SORULMALI (uç durum).
  (b) §18.6 (9) — iki Mevcut Borç kartı aynı caride (eski kapalı kart fatura 900'ü almış, yeni açık kart sonraki fatura 300'ü almış), ilk faturaya iade 300: kapalı kart 600'e küçülünce Tek Yükümlülük
      Kuyruğu yeni kartın kapsamını kapama defterinden AYRI dağıtıyor — kapama defteri (cardLedgerState) ikinci faturayı yeni kartça kapsanmış sayıyor (covered 300), kuyruk ise ikinci faturayı kapsamsız
      'Gecikti' ve yeni kartın taksitlerini 'Ödendi' gösteriyor → gecikmiş 08.10 0 → 300, 09.10 600 → 900. TABANDA AÇIK iki kartta da aynı (iade sonrası açık kart 600 + ikinci fatura 300 gecikmiş;
      doğrusu 0) — kök neden kuyrukta (dosya sınırı dışı); S234 = A bunu kapalı karta da taşıyor → BULGU (ORTA aday) + BAŞ MİMAR KARARI GEREKEN.
  (c) Düzenle formu (önceden var, en az v2.4.9'dan): kaydedilmiş taksitli faturada kalan ödeme 'Açık Hesap (Vadeli)' seçili açılıyor (istemci `payFrom` payment.rest === "installments" arıyor; kaydedilmiş
      belgede rest tutar, mode "installments") → değiştirmeden Kaydet taksit kartını kaldırıyor (ekran senaryosu E gözlemi). S235'in onay cümlesi bu yüzden Açık Hesap seçiliyken 'kaldırılır' der → BULGU.

## 19. İzleyen küçük tur (21.11.2026; görev metni `docs/devir/2.5.0-DEVAM/izt-istem.txt`) — P-2, P-1 / S238, S234-c, BULGU-1, BULGU-2, fatura kartı GET, S239 / S240 — KODDAN ÖNCE yazıldı
Kararlar (görev metninden AYNEN): karar (4) 2B-S3 = A ("kart küçülmesi … vadesi en önce gelen açık taksitten başlar; küçülme kartın açık kalanını aşarsa fazlası carinin avansı; parası geri verilen iadede
kart değişmez"), (6) 2B-S5 / S10 = A, S234 = A, S237 = A, S238 = A ("geri gelen tutar küçülmenin TERSİYLE, iadenin küçülttüğü AYNI taksite döner (iade hiç olmamış gibi)"), S239 = A ("iade önce faturanın kart
DIŞINDAKİ açık kısmını kapatır"), S240 = A ("S126'daki dağılım sırası AYNEN kalır"); BAŞ MİMAR KARARI 21.11 12:50 (yedi iş). Bugünkü davranış programın kendisiyle üretildi (taban izt-taban = 44a1762d;
yoklama not defteri `izt-a68/probe/iz.mjs`, çıktı `taban.txt`; kopyası docs/kanit/2026-11-21/izt-kos/).

### 19.1 Bugünkü davranış (taban; örnek tutarla)
| # | Örnek | Taban | Kararın istediği |
|---|---|---|---|
| P-2 (d55 B2) | fatura 900 → Mevcut Borç kartı 900 (05.10 / 05.11 / 05.12) → kart tahsilatı 600 → iade 600 | kart 600, **Tahsil Edilen 300, Kalan 300**; iade belgesinin açığı 0; bakiye −300 (kapalı kartta da aynı) | kart 600, Tahsil Edilen 600, Kalan 0; fazlası 300 carinin avansı (iade belgesinin açığı 300); bakiye −300 |
| P-2 kendi kartı | taksitli fatura 900 → kart tahsilatı 600 → iade 600 | kart 600 / T600 / K0, iadenin açığı 300 (DOĞRU) | değişmez |
| P-1 (d55 B1) | kart 900 → tahsilat 300 → 10.11 iade 300 (05.11 taksiti silinir) → 20.11 iade iptali | kart 900: 05.10 300 (ödendi) + **05.12 600**; 20.11 gecikmiş **0** (açık kart) | 05.11 taksiti 300 geri gelir; 20.11 gecikmiş 300; açık / kapalı / kendi kartı aynı |
| BULGU-1 (T8) | fatura 900 (05.10) → kart q 900 → fatura 300 (06.10) → kart r 300 → ilk faturaya iade 300 | q 600, r 300 'Ödendi'; ikinci fatura kapsamsız 'Gecikti' → gecikmiş 08.10 **300** (açık) / kapalı q: 08.10 300, 09.10 **900** | açık: 0; kapalı q: 08.10 0, 09.10 600; bakiye 900 değişmez |
| S234-c (D1) | fatura 900 → kart 900 → Düzenle 900 → 300 | kart **900 / Kalan 900**, bakiye 300 (açık ve kapalı kart) | kart iade gibi küçülür (300; kesim vadesi en önce gelen açık taksitten) |
| SK-42 (a) (D2a) | kart 900, tahsilat 600 → Düzenle 900 → 300 | kart 900 / T300 / K600, bakiye −300 | (kararda yok — §19.8) |
| SK-42 (b) (D2b) | fatura 300 → kart 300 → Düzenle 300 → 900 | kart 300 değişmez; artan 600 faturanın vadesiyle (01.09) kuyrukta → gecikmiş 600 | (kararda yok — §19.8) |
| S239 | fatura 900 → kart 600 (faturanın 600'ü kartta) → iade 300 | kart 600 değişmez; dışarıdaki 300 kapanır | A ile AYNI (sınamayla kalıcı) |
| S240 | elle borç 300 + fatura 900 → kart 1200 → tahsilat 300 → iade 300 (fatura) | kart 900 / T300 / K600; bakiye 600 | A ile AYNI (sınamayla kalıcı) |
| BULGU-2 | kaydedilmiş taksitli fatura → Düzenle → değiştirmeden Kaydet | form 'Açık Hesap (Vadeli)' açılır; Kaydet kartı siler (bakiye aynı, borç faturanın vadesiyle) | form 'Taksitli' açılır; Kaydet kartı ve taksitleri AYNEN bırakır |

### 19.2 Kök neden — P-2 ve BULGU-1 (Tek Yükümlülük Kuyruğu, `lib/obligation-queue.mjs`)
Kapama defteri (`lib/invoice-settle.mjs`) Mevcut Borç kartının kapsamını kartın AÇILDIĞI ANDAKİ tutarla kurar (`coverTotal` = bugünkü tutar + iade kesintileri; yalnız karttan önce doğmuş satırlar); sonradan
gelen iade kartın kapsadığı borcu kapatır. Kuyruk ise kartın kapsamını hem ön geçişte (`coverForcing`, kartın anındaki satırlar) hem asıl geçişte `min(coverTotal, bugünkü taksit toplamı)` ile kurar:
(a) BULGU-1 — ön geçişte q'nun kapsamı iadeyle küçülmüş taksitlerden okunur (600); iade o anda bilinmediği için ilk faturanın 300'ü 'kapsamsız' görünür, sonraki kart r onu alır (S120 s2 sırası),
ikinci fatura kapsamsız kalır. (b) P-2 — asıl geçişte iade (sıra 4) asıl faturayı kartın kapsamından ÖNCE kapatır (600); kart yalnız kalan 300'ü kapsar, kart tahsilatı 600 taksitleri kapatır, S101 ölçümü kartı
kırpar → kart Kalan 300 / Tahsil Edilen 300 (carinin borcu yokken).
TEK KURAL (iki hesap aynı okumaya): kartın kapsamı = AÇILDIĞI ANDAKİ tutarı (bugünkü tutar + o andan SONRA doğan iadelerin bu karttan kestiği tutar). Tek yardımcı `lib/obligation-queue.mjs`
`coverCutsAfter` (iade belgelerinin `coverCuts`'ından; kapama defterinin `coverTotal`'ı aynı kesintileri ekler). Kuyrukta:
1. Ön geçiş (kartın / sonraki kartın anı): kartın kapasitesi = bugünkü taksit toplamı + o andan SONRA doğan iadelerin bu karttan kestiği tutar (girdiye `coverCuts` alanı — `lib/obligation-input.mjs` iki fatura
   sorgusu). Taksitler değişmez (kırpma bugünkü kapasiteyle — fazla kapsam kırpma doğurmaz).
2. Asıl geçiş: iadenin asıl faturaya mahsubu (sıra 4) faturanın kartlarca TUTULAN kısmına dokunmaz — tutulan = kartın ön geçişteki kapsamı − o faturanın iadelerinin o karttan kestiği tutar (en çok kartın
   kapasitesi). İadenin kalanı (mahsup edilemeyen) bağsız alacaktır (iade belgesinin açığı = carinin avansı; kapama defterinin 'excess'i ile aynı).
Değişmeyen: S110 / S120 seçimi, S101 ön ödeme, Y-1, kilit, kart tahsilatı sırası, kendi kartı (taksitli fatura; P-2'de zaten doğru), iadesi olmayan her girdi (kesintisiz kartta 1 ve 2 etkisiz — eşdeğerlik).

### 19.3 P-1 / S238 = A — iade iptalinde aynı taksite geri büyüme (`routes/plans.mjs`, `routes/invoices.mjs`)
- Kesim kaydı: `cutPlan` kestiği her taksiti (kimlik, sıra, vade, not, kesilen) döndürür; iade (`retarget`: kapsayan kart + `trimCovers`; `ownCard`: kendi kartı) bunları iade belgesine yazar
  (`payment_json.coverCutItems` — kart → taksitler; `ownCutItems` — kendi kart). `coverCuts` (tutar) aynen.
- Büyüme (`growForInvoice`, yeni `items` seçeneği): kayıtlı taksitler TERS sırayla geri yazılır — taksit duruyorsa tutarı kesilen kadar artar, silinmişse aynı kimlik / sıra / vadeyle yeniden açılır; kayıtla
  karşılanmayan büyüme (eski veri, kayıt yok) bugünkü gibi SON taksite. Sınır (`cap`) aynen. İade iptali (`cancel` → `restoreCuts` + `ownCard`) ve iade Düzenle'si (`restoreCuts`) kaydı okur.
- Kapalı (Borçta Kalsın) kart: aynı (S234 = A'nın tersi); kalemin günü kuyrukta `keptDueOf` (S205) — geri gelen taksit kapanış ertesinden gecikmiş.

### 19.4 P-2 kartın kendi hesabı
`shrinkPlan` keseni kalanla sınırlar (bugünkü); kuyruk düzeltmesiyle kartın Tahsil Edilen / Kalan'ı (S129: kuyruktan) kartın kendi hesabıyla aynı olur: kart 600 / T600 / K0. İadenin kalan 300'ü carinin avansı.

### 19.5 S234-c — Düzenle ile azaltma (`routes/invoices.mjs editInvoice`)
EKRAN YOLU: fatura kartı → Düzenle → Kaydet = `POST /api/workspace/invoices/:id/edit` (gövde: `scenario, accountId, issueDate, lines[], payment{cash[], cheques[], endorse[], rest, dueDate, installments}, force…`);
yalnız KAYDEDİLMİŞ (status 'issued') belgede (taslakta 409 `invoice-not-issued`). `PUT /api/workspace/invoices/:id` yalnız TASLAK içindir (kesilmişte 409 `invoice-not-draft`) — kâhinin yoklamadığı yol bu.
Kural (S234 = A + kâhin KAPSAM (e) "azaltılan tutar iade gibi"): satış faturasının (iade belgesi değil, taksitsiz) Düzenle'sinde kapsayan Mevcut Borç kartlarının payı (`coverState(...).coveredBy`, kapama defteri)
Düzenle'den ÖNCE okunur; yeni etkiler yazıldıktan sonra yeniden okunur; her kart payı ne kadar azaldıysa karar (4) ile küçülür (`shrinkPlan` — kalanla sınırlı; açık ve Borçta Kalsın kapalı kart, eski kurallı
kapalı kart değişmez), sonra `trimCovers` (iadedeki gibi). Kesim kaydı Düzenle'de yazılmaz (iade belgesi yok). Carinin kartı yoksa okunmaz (ders 47).

### 19.6 BULGU-2 — Düzenle formu (`client/assets/hof-invoices.js payFrom`) + değiştirmeden Kaydet (`routes/invoices.mjs`)
- Form: kaydedilmiş belgenin ödemesi `mode: "installments"` ise kalan 'Taksitli' seçili; Taksit Sayısı / İlk Vade / Kaç Ayda Bir kayıttan.
- Sunucu: Düzenle'de faturanın KENDİ kartı AÇIK, tahsilatsız ve yeni ödeme planı kayıtlıyla AYNI (kalan tutar = kart tutarı, taksit sayısı, ilk vade, aralık) ise kart kaldırılıp yeniden kurulmaz — kart ve
  taksitleri (kimlik, kart no, vadeler, tutarlar) AYNEN kalır. Bir şey değiştiyse bugünkü gibi (eski kart kaldırılır, yeni kart). Kapalı kart (S235 = B): bugünkü gibi yeniden kurulur, kart açılır — onay
  cümlesi "yeniden açılır" doğru kalır. Tahsilatlı kartta Düzenle bugünkü gibi 409.

### 19.7 Fatura kartı GET (+26 ms; Ç7b) — `routes/invoices.mjs`
İptal notunun kapsam okuması (`coverCancelText` → `coverState` → `settledFor`: carinin cari kartı + kapama defteri). Düzeltme ölçümle seçilir (önce / sonra aynı kopya); eşdeğerlik testiyle.

### 19.8 KULLANICIYA SORULMALI (kodla karar verilmez — ders 43)
- SK-42 (a) Düzenle ile kartın açık kalanından FAZLA azaltma; (b) Düzenle ile ARTIRMA. §19.5'in kodundan sonraki sayılar raporda.

### 19.9 Nasıl bozulur? (önce yazıldı; testler buradan)
1. P-2: açık / kapalı (Borçta Kalsın) Mevcut Borç kartı, tahsilat 600 + iade 600 → kart 600 / T600 / K0, iade açığı 300, bakiye −300; kendi kart değişmez.
2. P-1: iade → iade iptali → kart taksitleri iade öncesiyle AYNI (vade, tutar); açık kartta gecikmiş geri gelir; kapalı kartta S205; kendi kartı; kaydı olmayan eski iade → son taksit.
3. BULGU-1: iki kart (açık / kapalı q) → gecikmiş 0 / 0 ve 600; bakiye, Mutabakat Testi aynı; kartlar Kalan = borç.
4. İadesi olmayan girdi: kuyruk sonucu AYNEN (eşdeğerlik — kesinti yoksa yeni dallar çalışmaz).
5. S234-c: Düzenle 900 → 300 açık / kapalı kart → kart 300; Düzenle tahsilatlı kartta (SK-42 a) ve artırma (SK-42 b) sayıları yazılır; kendi kartlı fatura Düzenle'si bugünkü (S235).
6. BULGU-2: değiştirmeden Kaydet → plan kimliği / kart no / taksitler / bakiye aynı; taksit sayısı değişince yeni kart (bugünkü); kapalı kart yeniden açılır (S235).
7. Parası geri verilen iade kartı değiştirmez (G1) — kayıt da yazılmaz.
8. Kilitli dönem: iadenin / iptalin tarih kilidi aynen; geri yazılan taksit Mutabakat Testi'ni bozmaz.

### 19.10 Kod ve sonuç (kodla birlikte; kanıt docs/kanit/2026-11-21/izt-*)
- `lib/obligation-queue.mjs`: `returnCutsOf` / `coverCutsAfter` (yeni, dışa açık); `coverForcing` ön geçişe `extraCap` + o anda bilinen iadeler (`cutList`); `queueOnce` `holds` (kart → faturanın tutulan kısmı; sıra 4 mahsubu
  `target.left − held`; tutulan yüzünden mahsup edilemeyen pay `linkOverflow` sayılmaz); `coverEvent` kapasite `+ extra` (kırpma bugünkü kapasiteyle). `lib/obligation-input.mjs`: iki fatura sorgusuna `coverCuts` sütunu.
- `routes/plans.mjs`: `cutPlan` / `shrinkPlan` `log`; `trimCovers` sonucu `items`; `growForInvoice` `items` (aynı taksitlere geri, kalan son taksite); `hasShrinkableCover`.
- `routes/invoices.mjs`: `retarget` → `coverCutItems` / `ownCutItems`; `restoreCuts` / iade İptal Et → kayıtlı taksitlere; `ownCard` `log` / `restore`; `editInvoice` → `shrinkCoversByEdit` (YALNIZ tutar azalınca —
  KOD SÜRERKEN DEĞİŞTİ: ilk hâli her Düzenle'de kapsam okuyordu, hız ölçümü 1'de 'Düzenle (aynı içerik)' +%20; ayrıca Düzenle'de eklenen peşin ödeme kartı küçültüyordu — ödeme iade değildir; sınama C2);
  `ownPlanToKeep` / `samePlanShape` / `reverseEffects keepPlanId` / `writeIssued keepPlan` (BULGU-2); `ledgerFor` / `settledFor` önbelleği, `paymentStates` → `obligationsOf` (İş 6).
- `client/assets/hof-invoices.js payFrom`: `mode === "installments"` → 'Taksitli'.
- Sonuç (yoklama `izt-kos/iz.mjs`, sınama `test/izt-izleyen-tur-250.test.mjs` 16, ekran `test/e2e/senaryo-izt-250.mjs` 20): P-2 kart 600 / T600 / K0, iade açığı 300; P-1 taksitler iade öncesiyle aynı, 20.11 gecikmiş 300;
  BULGU-1 gecikmiş 0 / 0 (kapalı q: 0 / 600); S234-c kart 300; BULGU-2 kart kimliği / no / taksitler aynı; fatura kartı GET 69,4 / 80,0 → 36,0 / 38,1 ms (Ç7b öncesi 42,9 / 44,4).
- SK-42 (KULLANICIYA SORULMALI) bugünkü sayılar (yeni kod): (a) kart 900, tahsilat 600, Düzenle 900 → 300 → kart 600, kartın kendi hesabı Tahsil Edilen 600 / Kalan 0 ama kuyruk görünümü Tahsil Edilen 300 / Kalan 300,
  bakiye −300 (Düzenle kesintisi iade kaydı gibi tutulmadığı için kuyruk kartı açıldığı andaki tutarla kuramıyor — P-2'nin Düzenle ikizi); (b) fatura 300 → kart 300 → Düzenle 300 → 900: kart 300 değişmez,
  artan 600 faturanın vadesiyle kuyrukta (01.09 → 10.09'da gecikmiş 600).
- KOD SÜRERKEN GÖRÜLDÜ (BAŞ MİMAR KARARI GEREKEN; önceden var, taban ve yeni kodda AYNI — yoklama `izt-kos/ayr.mjs`, `ayrisma-yeni-eski.txt`): carinin açık borcu kart tutarından fazlayken (S120 kolu)
  kuyruk kartı EN ESKİ faturaya (s2), kapama defteri EN YENİ faturaya (newestFirst) bağlıyor. Örnek: A 600 (01.09), B 600 (02.09), kart 600 (03.09): ekranda A 'Taksitte', B 'Gecikti'; ama A'nın İptal Et'i kartı
  değiştirmiyor, B'nin İptal Et'i kartı KAPATIYOR (0 / K0; bakiye 600 — A'nın borcu kartsız kalır); iade de aynı ayrışmayla yanlış kartı küçültür. Tek yardımcı (kapama defterinin seçimi S110 / S120'ye
  getirilmeli) yazma yollarının (iade, iptal, Düzenle) davranışını değiştirir — bu turun kapsamı dışında.
