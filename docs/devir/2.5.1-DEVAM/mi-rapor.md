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
