# 2.5.1 Mİ — Müşteri İstekleri (Mİ-1, Mİ-2) Kod Ajanı Raporu (taslak, adım adım)

Görev metni: `docs/devir/2.5.1-DEVAM/mi-istem.txt` (ana ağaçta). Taban: etiket `t251-taban` = 64396478.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

### Mİ-1 — geciken taksitin numarası ("… gün gecikti (2. taksit)")
1. Taksiti SİLİNMİŞ kart: saklanan sıra 1, 3 kalır → listede "(3. taksit)", kartta "3." yazar; oysa kartta yalnız iki taksit var (boşluk).
2. Taksiti DÜZENLENMİŞ kart (vadesi öne / arkaya alınmış): kart vadeye göre sıralar, saklanan sıra değişmez → kartta "2., 1., 3." görünür; liste hangi numarayı yazar?
3. "Taksit Ekle" ile sonradan eklenen ve vadesi mevcutlardan ÖNCE olan taksit: saklanan sıra MAX+1, kartta en üstte → numara kayar.
4. İade görmüş kart (taksit iadesi, iade iptaliyle eklenen taksit): kalan / durum kuyruktan; numara gösterilen taksitle aynı mı?
5. Kapalı kart (Kartı Kapat, "Borçta Kalsın"): bugünkü kural sıradaki taksiti kapalı kartta saymıyor; ek yazılmamalı / bugünkü kural AYNEN.
6. Birden çok kart: satır vadesi en erken olan sıradaki taksitten üretiliyor → numara o taksitin KENDİ kartındaki sırası olmalı (öbür kartın değil).
7. Birden çok geciken taksit: satır en eski geciken taksitten → numara onun.
8. Bağsız (kart seçilmeden alınan) cari tahsilatıyla 1. taksit kapanmış kart: sıradaki taksit kuyruktan 2. olur; liste ile kart AYNI "2." mi?
9. Açılıştan (Excel'den önceden ödenen) gelen kart: açılış ilk taksitleri kapatır; numara yine kartın sırası.
10. Geciken yokken (sıradaki taksit ileride, bugün) ek YAZILMAMALI (yalnız "gün gecikti" satırına).
11. Numaranın BAŞKA yerlerde yazılması: makbuz PDF'i, cari ekstresi (defter satırı "Taksit Tahsilatı · 3. taksit"), WhatsApp iletisi, taksit kartı PDF'i, Taksitler listesi PDF'i (veliye verilebilir), zil / takvim, Tablo ekranı, Rapor Merkezi — bunlar müşteriye gidebilir; sayı değişecekse önce raporda yazılır, DOKUNULMAZ.
12. Listenin PDF / Excel / Yazdır çıktısı: satır orada varsa ekranla aynı olmalı.
13. Saat dilimi / gün dönümü: "gün gecikti" bugünden hesaplanır; TZ=UTC ve Europe/Istanbul'da aynı.

### Mİ-2 — cari grubuna göre görünümler (Grup Özeti + dönemlik tahsilat)
1. Grubu olmayan cari → "Grupsuz" satırına; düşerse toplam ≠ satırlar.
2. Alt gruplu grup: alt grup satırları üst grubun kırılımı; üst grup satırı alt grupları da İÇERİR (alt grubu olmayan cari üst grupta ayrı kırılım satırı).
3. Boş grup (carisi yok) → satırı 0 ile görünür (firmanın açtığı HER grup).
4. Pasif cari: durum süzgeci (Aktif / Pasif / Tümü) Grup Özeti'ne de uygulanmalı.
5. Aynı adlı iki cari: kimlikle toplanır, adla değil.
6. Tedarikçi: tedarikçiye yapılan ÖDEME tahsilat sayılmaz; raporun kuralına uyulur.
7. Dönemde hiç tahsilat yok → 0, satır kaybolmaz; boş dönem ipucu.
8. İleri tarihli tahsilat → dönem dışında kalır (bitiş günü dahil, sonrası hariç).
9. Silinmiş / geri alınmış tahsilat → sayılmaz.
10. Karşılıksız çıkan çek → raporun bugünkü kuralına uyulur.
11. İade (taksit iadesi, cariye ödeme) → raporun kuralı.
12. Taksit tahsilatı ↔ cari tahsilatı ÇİFT SAYIM: aynı para iki tabloda mı? Raporun kaynakları okunur.
13. Excel'den gelen önceden ödenen (açılış) dönem toplamına KARIŞMAZ (03.10 kararı; raporun düzeni).
14. Aynı gün birden çok yol (nakit + POS + havale + çek + senet) → kırılım her yolu ayrı, Toplam = kırılım toplamı.
15. Yolu belirlenemeyen tahsilat → "Diğer" sütunu.
16. Çek ile senet karışması (aynı tablo, tür alanı).
17. Gece yarısı / ay başı / yıl başı: Bugün / Dün / Bu Hafta / Bu Ay sınırları sunucunun "bugün"ünden; TZ=UTC ve Europe/Istanbul.
18. İki şirket: her şirket kendi verisi.
19. Yetkisiz rol: tahsilat tutarını göremeyen rol bu sütunları da görmez.
20. 2.000+ cari / 100 bin satır: toplu SQL, ≤ 2 sn; dönemsiz Liste'nin yanıtı ve süresi bugünkü gibi.
21. Süzgeç birlikteliği: grup / alt grup / tür / gecikme / bakiye / arama + "Bu Dönemde Ödeme Yapanlar" — kartlar süzgeçten SONRA; Grup Özeti TOPLAM = süzgeçsiz Liste kartları.
22. Carinin grubu değişmiş: eski tahsilatı BUGÜNKÜ grubunda (grup geçmişi yok).
23. Silinmiş cari: listede yok, tahsilatı da Grup Özeti'nde yok (rapor ne yapıyorsa).

## 1. Mİ-1 — TARAMA ve KOD

Tek kaynak: `server/lib/plans.mjs` `allocate` taksitleri vade (sonra saklanan sıra) düzeninde sıralıyor (kartın penceresi de bu düzende çiziyor); her taksite
`no` = bu düzendeki sıra (1..n, boşluksuz) eklendi; `next.no` aynı taksitten. `routes/plans.mjs` kuyruk görünümleri (`withQueue` → kart penceresi / cari kartı özeti,
`queueBrief` → Cari Listesi) `next.no`'yu aynı taksitten taşır. Saklanan `seq` (veri tabanı) DEĞİŞMEDİ — göç yok.

| # | Yer | Bugün (taban) | Ne yapıldı |
|---|-----|---------------|------------|
| 1 | Cari Listesi satırı, Taksit sütunu (`hof-accounts.js` renderList) | "15.10.2026 · 29 gün gecikti" (numara yok) | "… · 29 gün gecikti (2. taksit)" — `next.no`; yalnız gün < 0'da; "sıradaki taksit" satırı değişmez |
| 2 | Cari Listesi PDF / Excel / Yazdır (`accounts.mjs` liste.pdf, export.xlsx; Yazdır = PDF) | bu satır YOK (Taksitten Kalan tutarı var) | değişmedi (karar (b): "satır varsa") |
| 3 | Taksit kartı penceresi, taksit satırı No (`hof-plans.js` renderDetail) | saklanan `seq` ("2.", "3." — silinenden sonra boşluk; vadesi değişende "2., 1., 3.") | `item.no` (1..n) |
| 4 | aynı pencerede satır düğmelerinin erişilebilir adı ("N. taksite tahsilat gir / düzelt / sil") | `seq` | `no` |
| 5 | aynı pencerede hareket satırı "Tahsilat · N. taksit" | `seq` | `no` |
| 6 | Taksit düzelt penceresi başlığı "N. taksiti düzelt" | `seq` | `no` |
| 7 | Tahsilat formu açıklaması "sıradaki N. taksit" (kartın kendi hesabı, `ownNext`) | `seq` | `no` |
| 8 | Tahsilat formu "Hangi Taksite" seçenekleri "N. taksit · vade · kalan" | `seq` | `no` |
| 9 | Taksiti Sil onayı "N. taksit (…) silinecek" | `seq` | `no` |
| 10 | Sunucu 409 iletisi "Seçilen N. taksit ödendi" (`plans.mjs` assertRoom; kart penceresinin formunda görünür) | `seq` | `no` (ayrıntıya `no` da eklendi; `seq` kaldı) |
| 11 | Taksitler listesi ekranı "N. taksit · gün" (`hof-plans.js`:418) + Taksitler listesi PDF'i (`plans.mjs`:614 — kodda "Liste okula ya da veliye verilebilir") | `seq` | DOKUNULMADI — müşteriye gidebilen çıktı; ekranı PDF'iyle aynı kalsın diye ekran da değişmedi → KULLANICIYA SORULMALI S-Mİ1-1 |
| 12 | Taksit kartı PDF'i / Yazdır (`lib/plan-report.mjs`:139, kart ekstresi) | `seq` | DOKUNULMADI (müşteriye verilebilir) → S-Mİ1-1 |
| 13 | Taksit makbuzu PDF'i "N. taksit (vade …)" (`lib/plan-report.mjs`:204) | `seq` | DOKUNULMADI (müşteriye gider) → S-Mİ1-1 |
| 14 | Cari defteri satırı "Taksit Tahsilatı · N. taksit" (`lib/accounts.mjs`:155 ← `lib/account-lines.mjs` itemSeq): cari kartı ekranı, cari ekstresi PDF'i, WhatsApp ekstresi | `seq` | DOKUNULMADI (ekstre / WhatsApp müşteriye gider; defter kodu yasak) → S-Mİ1-1 |
| 15 | Tablo ekranı taksit bloğu (`hof-workspace.js`:81, 83, 121, 124, 1087) | `seq` | değişmedi (dosya sınırı dışı) → SONRAKİ TUR |
| 16 | Zil / takvim / Vade Takip / nakit akışı etiketleri "N. taksit" (`plans.mjs`:1706, 1750) | `seq` | değişmedi (plan notu (d) "istenirse") → SONRAKİ TUR |
| 17 | Rapor Merkezi (Taksit Tahsilatları, Taksit Vadeleri; `report-center.mjs`:2454, 2970) | `seq` | YASAK dosya — değişmedi |
| 18 | WhatsApp şablonları / iletileri | numara yazmıyor (`server/lib/whatsapp` taramasında taksit numarası yok) | — |

NOT: Numaralar ancak (a) taksit silinmişse, (b) taksitin vadesi başka taksitin önüne / arkasına alınmışsa, (c) "Taksit Ekle" ile vadesi öncekilerden önce taksit
eklenmişse ayrışır; öbür kartlarda `no` = `seq` (hiçbir yerde değişiklik görünmez).

Testler: `test/mi1-taksit-no-251.test.mjs` (8 senaryo: düz, silinmiş, sonradan eklenen, vadesi değişen, bağsız cari tahsilatı, iade, iki kart, gecikmesiz; her
senaryoda listede yazan numara = kart penceresinde AYNI taksitin numarası = cari kartı özeti; kartta 1..n; 409 iletisi) + ekran `test/e2e/senaryo-mi1-251.mjs`
(gerçek tıklama + Enter; Ayşe "(2. taksit)", Burak silinmiş "(1. taksit)" ve kartta "1.", "2.", Cem "sıradaki taksit" parantezsiz). `test/plans.test.mjs` beklentisi:
`ledger.next`'e `no: 2` eklendi (alan eklendi; sayı değişmedi).

## 2. Mİ-2 — KOD ve TESTLER

Tasarım notu: `docs/devir/2.5.1-DEVAM/mi2-tasarim.md` (koddan önce, commit 7504c4eb).

- Yeni yardımcı `server/lib/account-collections.mjs`: `periodOf` (Bugün / Dün / Bu Hafta pazartesi–pazar / Bu Ay / Tarih Aralığı), `collectionsByAccount`
  (üç `GROUP BY` sorgusu: cari tahsilatı, alınan evrak, taksit tahsilatı; kuruşla toplanır; silinmiş cari / kart sayılmaz), `addCollected`.
- `server/routes/accounts.mjs`: Liste ucuna `period`, `from`, `to`, `paid=1`; dönem yoksa yardımcı çağrılmaz, yanıtta yeni alan YOK. Yeni uçlar
  `GET /api/workspace/accounts/group-summary` (+ `.pdf`, `.xlsx`). `group=__none` / `subgroup=__none` (Grupsuz / Alt Grupsuz). Liste PDF / Excel'ine dönem
  seçiliyse Tahsilat sütunu (Excel'de kırılım + TOPLAM satırı). Liste Excel'inin "Geciken" sütunu hep BOŞTU (satır anahtarı "Gecikmiş Borç" idi) → sütun
  adı "Gecikmiş Borç", dolu.
- `client/assets/hof-accounts.js` + `hof-ui.css`: Liste ↔ Grup Özeti geçişi, dönem seçici + tarih aralığı, "Bu Dönemde Ödeme Yapanlar", Tahsilat kartı ve
  sütunu, Grup Özeti tablosu (▸ alt gruplar, Grupsuz, TOPLAM; satıra tıkla / Enter → Liste o gruba süzülür), PDF / Yazdır / Excel; "Grupsuz" ve "Alt Grupsuz"
  süzgeç seçenekleri. "Bu Dönemde Ödeme Yapanlar" açıkken "Tümüne WhatsApp" gizli ve başlık kutusu yalnız ekrandakileri seçer (WhatsApp uçları bu süzgeci
  bilmiyor; süzgeçte görünmeyen carilere gitmesin).
- Yetki (koddan): Liste ve Grup Özeti `accounts.view` (yerleşik bütün roller; personel cari kartının defterinde de her tahsilat tutarını bugün görüyor —
  `server/lib/permissions.mjs` "accounts.view": ALL). `accounts.view` olmayan özel rol dört uçta 403 (testte).

Testler: `test/mi2-grup-ozeti-251.test.mjs` (13): elle senaryo, dönemler, ödeme yapanlar + süzgeçler, Grup Özeti satırlar = TOPLAM = Liste kartları (14 süzgeç
seçeneği × her grup / alt grup satırı = o süzgeçteki Liste), rapor eşdeğerliği (3 dönem), karşılıksız çek, dönem sınırları (ay / yıl başı, hafta, artık yıl),
bitiş günü dahil / ertesi gün hariç (bellek içi küçük veri tabanı — program ileri tarihli hareketi zaten reddediyor: integrity "İleri tarihli hareket"),
PDF / Excel, yetki. Ekran: `test/e2e/senaryo-mi2-251.mjs` (23 denetim).

## 3. SON RAPOR

### Gözlenebilir davranış değişiklikleri (önce → sonra)
1. **Cari Listesi, Taksit sütunu** (Mİ-1): "13.10.2026 · 45 gün gecikti" → "13.10.2026 · 45 gün gecikti (2. taksit)". Numara, gün sayısının ait olduğu taksitin KENDİ
   kartındaki sırası; gecikme yoksa ("sıradaki taksit") ek yok. 1. taksiti silinmiş kartta "(1. taksit)".
2. **Taksit kartı penceresi** (Mİ-1 karar (c)): taksit numarası boşluksuz 1..n (vade sırası). 1. taksiti silinmiş kart "2., 3." → "1., 2."; vadesi öne alınan 3. taksit
   "3., 1., 2." → "1., 2., 3.". Aynı numara satır düğmelerinin adında, "N. taksiti düzelt" başlığında, tahsilat formunun "sıradaki N. taksit" metninde, "Hangi Taksite"
   seçeneklerinde, Taksiti Sil onayında, hareket satırındaki "· N. taksit"te ve 409 iletisinde ("Seçilen 1. taksit ödendi"). Silme / vade değişikliği / öne ekleme
   olmayan kartta numara DEĞİŞMEZ.
3. **Cari ekranında "Liste | Grup Özeti" geçişi** (Mİ-2). Grup Özeti: firmanın her grubu bir satır (boş grup dahil), ▸ ile alt grup kırılımı ("Alt Grupsuz" dahil),
   "Grupsuz", TOPLAM; sütunlar Cari, Bakiye, Taksitlerden Kalan, Gecikmiş Borç, Geciken Taksit, Tahsilat, Nakit, POS, Havale / EFT, Çek, Senet (+ değer varsa Diğer
   ve Önceden Ödenen (Açılış)). Satıra tıkla / Enter → Liste o gruba süzülür. PDF / Yazdır / Excel ekranla aynı (alt TOPLAM satırı). Dönemsiz açılırsa dönem "Bugün".
   Ekran senaryosu: A Grubu Tahsilat 600 = Nakit 100 + POS 200 + Havale / EFT 300; B Grubu 900 = Çek 400 + Senet 500; TOPLAM 1.500.
4. **Liste'de dönem seçici** (Tahsilat Dönemi: Yok / Bugün / Dün / Bu Hafta / Bu Ay / Tarih Aralığı) + "Bu Dönemde Ödeme Yapanlar"; dönem seçilince "Tahsilat" kartı
   (tutar · dönem · N cari) ve "Tahsilat" sütunu (toplam + yol kırılımı). Dönem seçilmezse liste ve yanıtı eskisi gibi (testle).
5. **Grup süzgecinde "Grupsuz", alt grup süzgecinde "Alt Grupsuz"** seçenekleri.
6. "Bu Dönemde Ödeme Yapanlar" açıkken "Tümüne WhatsApp Ekstre / Mesaj" gizli, başlık kutusu yalnız ekrandaki carileri seçer (WhatsApp toplu gönderiminin "süzgeçteki
   hepsi" çözümü bu süzgeci bilmiyor — süzgeçte görünmeyen carilere gitmesin).
7. **Liste Excel'i:** "Geciken" sütunu HEP BOŞTU (sütun adı ile satır anahtarı "Gecikmiş Borç" uyuşmuyordu) → "Gecikmiş Borç" adıyla dolu. Dönem seçiliyse Tahsilat +
   kırılım sütunları ve TOPLAM satırı; Liste PDF'ine Tahsilat sütunu + özet.

### Değişen dosyalar
client/assets/hof-accounts.js, client/assets/hof-plans.js (yalnız numara gösterimi), client/assets/hof-ui.css, server/lib/plans.mjs (allocate: `no`), server/routes/plans.mjs
(next.no; 409 iletisi), server/routes/accounts.mjs, YENİ server/lib/account-collections.mjs; testler YENİ test/mi1-taksit-no-251.test.mjs, test/mi2-grup-ozeti-251.test.mjs,
test/e2e/senaryo-mi1-251.mjs, test/e2e/senaryo-mi2-251.mjs; test/plans.test.mjs (beklenen `next`'e `no: 2` alanı; sayı aynı); belgeler docs/devir/2.5.1-DEVAM/mi-rapor.md,
mi2-tasarim.md; kanıt docs/kanit/2026-11-27/mi-251/. Göç / saklanan veri YOK; report-center.mjs, defter, banka, WhatsApp, e-Belge, devir kodu, ci.yml, package.json DEĞİŞMEDİ.

### Yeni testlerin kırmızısı (eski kod, ayrı kopya) ve yeşili
| Test | Eski kod (t251-taban) | Yeni kod |
|---|---|---|
| mi1-taksit-no-251 (8) | 0/8 — "satırın taksitinin görünen numarası (no) var" (alan yok) | 8/8 UTC + İstanbul |
| mi2-grup-ozeti-251 (13) | 2/13 (geçen: ön koşul + "dönem yokken yanıt aynı" — beklenen); 11 kırmızı: `period` yok, group-summary 404 (":id" ucuna düşüyor), yardımcı modül yok, PDF'te "Tahsilat" yok | 13/13 UTC + İstanbul |
| e2e senaryo-mi1-251 (7) | 3/7 — satırda "(N. taksit)" yok, kartta ["2.","3."] | 7/7 |
| e2e senaryo-mi2-251 (23) | yarıda: "Grup Özeti" düğmesi yok | 23/23 |

### Kabul koşulları
- **A. Kâhin (taban = son, iki TZ):** test:kahin-cari 107 senaryo, 25.298 denetim, 0 fark, 7 bilinen sınır — taban ve son AYNI; test:kahin-defter 187 denetim, 0 fark,
  0 yakalanmayan mutasyon — taban ve son AYNI.
- **B. Komşular** (`git grep` taraması, 86 dosya: cari listesi / arama / liste PDF-Excel / bulk-plan / WhatsApp seçimi / list() çağıranları + allocate / next / seq /
  planOverdueCount okuyanlar + değişen kaynakları tarayanlar): 957/957 UTC, 957/957 İstanbul. Mİ-1 ara komşu koşusu 317/317 iki TZ.
- **C. Mutantlar — hepsi kırmızı:** numara saklanan sıradan (3 test), tedarikçi ödemesi sayılır (7), önceden ödenen toplama girer (7), grupsuz düşer (1), alt grup üst
  gruba katılmaz (2), dönem sınırı bir gün kayar (9), silinmiş kartın tahsilatı (1), silinmiş carininki (1), çek ↔ senet karışır (2), "ödeme yapanlar"a açılış (1).
- **D.** Beklentisi değişen ekran senaryosu yok; yeni iki senaryo koşuldu; plans.test.mjs (alan eklendi) koşuldu, yeşil.

### Hız (temiz 100 bin kopyası /dev/shm; 1.484 cari — kopyada para dışı SQL ile 12 grup × 2 alt grup, 1.272'si gruplu; 102.295 cari satırı; ÖZEL kilit)
| Yol | Ölçüm 2 (geçerli; başta yük 0,28 taban / 0,85 yeni) |
|---|---|
| Liste dönemsiz Aktif, 300 | taban orta 790 ms (en çok 891, olay döngüsü en çok 826) · yeni orta 908 (1.009, 968) — +%15 → DOĞRULANMADI |
| Liste dönemsiz Tümü, 300 | taban 770 (961) · yeni 893 (992) — +%16; Ölçüm 1'de 735 → 766 (+%4) |
| Liste dönemli Bugün / Bu Ay / Yıl + Ödeme Yapanlar | 809 / 888 / 916 ms (en çok 921 / 1.326 / 984; döngü en çok 1.319) — ≤ 2 sn ✔ |
| Grup Özeti Bugün / Bu Ay / Yıl (Tümü) | 1.049 / 926 / 925 ms (en çok 1.169 / 1.012 / 1.199) — ≤ 2 sn ✔ |
| Grup Özeti Excel (Bu Ay) | orta 1.849, en çok 2.154 ms — her dışa aktarım Değişiklik Geçmişi'ne yazdığından önbellek her çağrıda soğuk (mevcut Liste dışa aktarımlarıyla aynı düzen) |
Ölçüm 1'de "Aktif" Excel'in yazdığı denetim satırından sonra soğuk ölçüldü (1.659 ms) → GEÇERSİZ, düzen değiştirildi. Aynı süreçte ABBA A/B ölçümü (betik-olc-mi-ab)
ÖZEL kilidi 30 dk'da alamadı (başka işlerin tam testleri) → ÖLÇÜLEMEDİ.

### KULLANICIYA SORULMALI
- **S-Mİ1-1 (müşteriye giden numaralar):** taksit makbuzu PDF'i, taksit kartı PDF'i / Yazdır, Taksitler listesi ekranı + PDF'i ("veliye verilebilir"), cari ekstresi ve
  WhatsApp ekstresi ("Taksit Tahsilatı · N. taksit") SAKLANAN sırayı yazıyor; dokunulmadı. Silinmiş / vadesi değiştirilmiş / öne eklenmiş taksitli kartta ekran "1." derken
  makbuz "2. taksit" diyebilir. A) bunlar da görünen (boşluksuz) numaraya geçsin (önceden verilmiş kâğıttakiyle farklı olabilir); B) müşteriye gidenler saklanan numarada
  kalsın; C) uç durum böyle kalsın (BİLİNEN SINIR). ÖNERİ: A.
- **S-Mİ2-1 (açılış Tahsilat'a girsin mi):** görev metni (c) "önceden ödenen AYRI, toplamına KARIŞMAZ" → uygulandı (ayrı sütun). Ancak 'Cari Bazında Tahsilat' raporunun
  Toplam'ı ve kalıcı karar (03.10.2026 "Tahsilat raporlarında toplam Excel'den gelen açılışı DAHİL eder") açılışı katıyor → rapor Toplam'ı ile Grup Özeti Tahsilat'ı
  açılış kadar farklı (testte `Tahsilat + Önceden Ödenen = rapor Toplam`). A) böyle kalsın; B) Tahsilat açılışı da katsın. ÖNERİ: A (yükleme günü "Bugün"e devasa tutar
  yazmasın; "kasaya giriş" sorusuna gerçek para).
- **S-Mİ2-2 (karşılıksız çek):** rapor da bu ekran da alınan çeki dönem tahsilatında tutar, karşılıksız çıkınca düşmez. A) raporla aynı kalsın; B) düşsün (rapor da birlikte
  değişmeli). ÖNERİ: A şimdilik; B istenirse Rapor Merkezi turunda ikisi birlikte.
- **S-Mİ2-3 ("Diğer"):** rapor POS Komisyon İadesi'ni ve tedarikçiden "Kredi Kartına İade"yi tahsilat sayıyor; bu ekran onları "Diğer"de gösteriyor. A) böyle;
  B) hiç sayılmasın (rapor da değişmeli); C) uç durum böyle kalsın (BİLİNEN SINIR). ÖNERİ: A.

### BAŞ MİMAR KARARI GEREKİYOR (uygulandı, değerlendirilmeli)
1. "Geciken Tutar" yerine Liste kartının adı "Gecikmiş Borç" (aynı sayı, iki ad olmasın); "Geciken Taksit" = satırlardaki "N geciken" toplamı.
2. Grup Özeti dönemsiz açılırsa "Bugün".  3. Ödeme yapanlar süzgecinde toplu seçim yalnız işaretlenenler.  4. Liste Excel'inin boş "Geciken" sütunu düzeltildi.
5. Grubu silinmiş (adı görünmeyen) cari "Grupsuz" sayılır (listede de öyle yazıyordu).  6. Tablo ekranı, zil / takvim, Taksitler listesi numaraları değişmedi (S-Mİ1-1).

### SONRAKİ SÜRÜME / SONRAKİ TUR
Rapor Merkezi kısmı (görev (d)); S-Mİ1-1'e göre öbür numara yerleri; "Tahsilat (çoktan aza)" sıralaması, "Ödeme Yapmayanlar"; dönem seçiminin hatırlanması; dışa
aktarımın Değişiklik Geçmişi yazısının önbelleği soğutması (Excel / PDF'ten sonraki ilk okuma ~2 kat; mevcut düzen).

### DOĞRULANMADI
- Dönemsiz Liste ≤ %10 bütçesi: iki geçerli ölçüm çelişkili (+%4 ve +%15/16); ikincisinde yeni kodun DÖNEMLİ (daha çok iş yapan) yolları dönemsizden hızlı çıktı → sıra /
  ısınma yanlılığı kuşkusu; dönemsiz yola eklenen iş birkaç koşul + satır başına `no` alanı. ABBA ölçümü ÖLÇÜLEMEDİ → ana oturum yeniden ölçmeli.
- Windows koşusu (dosyaya dokunan yeni test yok; CI'de okunacak).

### DENENMEYEN
Excel kartının açılışının taksit numarasına etkisi; kapalı kart ("Borçta Kalsın") numara senaryosu (kural değişmedi); iki şirket; 2.000+ cari ekranda (hız 1.484 cari /
100 bin satırda); Tarih Aralığı'nın ekrandan girişi (API'de denendi); mobil görünüm; Yazdır (PDF ile aynı adres).

### BİLİNEN SINIRLAR
Grup geçmişi tutulmuyor: carinin eski tahsilatı BUGÜNKÜ grubunda sayılır (teslim notuna). İleri tarihli tahsilat program tarafından reddediliyor; sınır davranışı bellek
içi veriyle denendi.

### CI listesine eklenecek
test/e2e/senaryo-mi1-251.mjs, test/e2e/senaryo-mi2-251.mjs (`node test/e2e/<dosya>`; package.json'a betik eklenmedi).

### Kılavuz metni önerisi (Cari)
- **Gruba göre özet:** Cari penceresinde "Grup Özeti"ne tıklayın. Her grubun cari sayısı, bakiyesi, gecikmiş borcu ve seçtiğiniz dönemdeki tahsilatı (nakit, POS, havale /
  EFT, çek, senet) görünür. ▸ ile alt grupları açın; bir satıra tıklayınca liste o gruba süzülür.
- **Bugün kim ödedi:** Listede "Tahsilat Dönemi"nden Bugün'ü seçin, "Bu Dönemde Ödeme Yapanlar"ı işaretleyin; grup süzgeciyle birlikte kullanabilirsiniz.
- **Hangi taksit gecikti:** Taksit sütununda "45 gün gecikti (2. taksit)" geciken taksitin numarasını gösterir.

### Ana oturumun yeniden koşacağı komutlar (eski kod: `git worktree add --detach <yol> t251-taban`)
- `TZ=UTC` ve `TZ=Europe/Istanbul`: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/mi1-taksit-no-251.test.mjs test/mi2-grup-ozeti-251.test.mjs`
- `PLAYWRIGHT_BROWSERS_PATH=<pw-1194> node test/e2e/senaryo-mi1-251.mjs` ve `… senaryo-mi2-251.mjs` (eski: `DEPO=<eski kök>`)
- `npm run test:kahin-cari`, `npm run test:kahin-defter` (iki TZ)
- mutantlar: docs/kanit/2026-11-27/mi-251/betik-mutantlar.sh.txt (+ betik-mutant.py.txt)
- hız A/B: `flock -x <olcum.lock> node betik-olc-mi-ab.mjs.txt'nin .mjs kopyası <taban kökü> <taban veri kopyası> <yeni kökü> <yeni veri kopyası> 12`
