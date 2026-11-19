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
