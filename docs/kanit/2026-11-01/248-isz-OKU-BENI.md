# İŞ Z (2.4.8, T9 ORTA) — kanıt dizini

Dal is/perf-248 (wt-perf-248), taban b2e7bf19. Kod: 16bd37db (routes/accounts.mjs waFacts + planSummaryOf; lib/whatsapp/queue.mjs plan() load → waFacts,
"Zaten Kuyrukta" tek sorgu; lib/whatsapp/defter.mjs SENT_BEFORE_SQL `+k.period_key` + SENT_BEFORE_SQL_YALNIZ_TEST). Testler / betikler: 21a3d7c1, 3908c155,
a81d9d53, dd3025d3, 0f9d44c5. Tasarım notu ve ana oturum onayı: 248-isz-tasarim-notu.md. Bütün ağır koşular `flock /tmp/destekofis-olcum.lock` ile (ders 15),
HUKUK_LICENSE_URL=http://127.0.0.1:9, sahte Meta (ders 30). Veri: T9'un taban-2910 ve gecmis-40 kopyaları (kaynak not defteri t9-4c8e1d; benim kopyam isz-7d2f5a).

| kanıt | ne | sonuç |
|---|---|---|
| 248-isz-profil-*-b2e7bf19.json, 248-isz-profil-ekleri.txt, *.mjs.txt | eski kodda profil + defter / açılış sorgusu ölçümleri | süre kişi başı accounts.detail'de; %83 openingEntryOf |
| 248-isz-eski-b2e7bf19-{UTC,Europe_Istanbul} | yeni kalıcı test ESKİ kodda (git archive b2e7bf19 + yalnız test erişimi için SENT_BEFORE_SQL dışa aktarımı) | 0/3, beklenen nedenlerle KIRMIZI (aşağıda) |
| 248-isz-mutasyon-M1..M5-UTC | yeni kodun ayrı kopyasında 5 mutasyon (248-isz-mutasyonlar.py.txt) | hepsi KIRMIZI, beklenen nedenle |
| 248-isz-esitlik-buyuk-veri | eski ↔ yeni, 3 veri (A taban göç + sınıflar @02.11.2026; B1 geçmiş + sınıflar + 8 taşınan toplu iş @02.11.2026; B2 aynı @26.03.2026) × 72–98 adım | 271/271 eşit, 295.948 kişi satırı, fark 0 |
| 248-isz-esitlik-belirsiz-tasinan | eski ↔ yeni, Sonucu Belirsiz + taşınan veri: veri B ve C (belirsiz / başarısız işlerin 10 toplu işi başka defterde) × 4 saat | 308/308 eşit, fark 0 |
| 248-isz-cari-karti-esitlik | GET cari detayı eski ↔ yeni, taban-2910'un bütün carileri (3.014 + 614) | 3.631/3.631 eşit |
| 248-isz-defter-sql-esitlik-* | R3 SQL eski metin ↔ yeni metin, 504 parametre kümesi × 2 defter (ham B; B2 koşusunun sonu) | 180.868 / 186.439 satır, fark 0 |
| 248-isz-karsilastirici-dis-kaniti.txt | karşılaştırıcının dişi: bir kişinin eleme nedeni elle bozuldu | 1 fark yakalandı |
| 248-isz-dar-{UTC,Europe_Istanbul} | WhatsApp dar listesi (94 + yeni test + mobil özet 2) + cari kartını kullanan 26 test (248-isz-dar-liste.txt) | 1.063/1.063 × 2 |
| 248-isz-e2e-* | 5 WhatsApp e2e (gonder-248 G8e/G8f dahil) | 45, 88, 37, 189, 45 — hepsi geçti |
| 248-isz-olcum-*-{eski-1,yeni-1,yeni-2} (+ -sonuc.json) | süre önce / sonra (T9 Ölçüm 1 B+C gövdeleri, 2'şer) + başka kullanıcı ayrı süreçten | aşağıdaki tablo |

Eski koddaki kırmızı iletiler (ders 38): (1) "cari servisinde waFacts yok" (yeni uç yok); (2) "önizleme kişi başı okuyor … tamKartOkuma 16, kuyrukSorgusu 10"
(15 cari + olmayan kimlik = 16 kart okuması; elemeyi geçen 10 kişiye 10 sorgu); (3) "R3 (satır) sorgusu claim_keys'i her anahtarla ayrı yokluyor: SEARCH k USING
COVERING INDEX sqlite_autoindex_claim_keys_1 (job_id=? AND attempt=? AND period_key=?)". Sınıf / eleme nedeni denetimleri eski kodda da GEÇER (davranış aynı).
Mutasyonlar: M1 waOptOut 0 → "eleme alanları farklı" + "≠ WhatsApp Mesajı İstemiyor"; M2 kartlar boş → "eleme alanları farklı" + hatırlatma; M3 duraklatılmış iş
unutuldu → "duraklatılmış işteki kişi 'Zaten Kuyrukta' değil"; M4 `+` kaldırıldı → plan yoklaması; M5 coversBalance yanlış → "cari kartındaki taksit özeti … aynı değil".

Süre (sn; her hücre süre / olay döngüsü en uzun kesinti / başka kullanıcının en uzun beklemesi; eski 2 örnek, yeni 4 örnek = 2 koşu × 2):

| veri, istek | eski | yeni (p50 / en çok) |
|---|---|---|
| taban 2.000 önizleme (6 seçenek) | 26,0–30,8 | 0,68–1,07 (her seçenek p50 ≤ 1,04) |
| taban Tümünü Seç 3.014 önizleme | 40,0 / 40,6 | 1,15 / 1,33 |
| taban başlatma 2.000 / 3.014 | 28,3 / 45,0 | 0,80–0,86 / 1,38–1,48 |
| geçmişli 2.000 önizleme (6 seçenek) | 25,0–28,8 | 0,82–1,80 (p50 ≤ 1,66) |
| geçmişli Tümünü Seç 3.014 önizleme | 42,3 / 42,5 | 1,82 / 3,37 / 2,40 / 1,88 |
| geçmişli başlatma 2.000 / 3.014 | 28,7 / 42,1 | 1,43–1,73 / 1,94–2,12 |
Olay döngüsü kesintisi ve başka kullanıcının beklemesi her satırda süreyle birlikte iner (eski ~süre kadar, yeni ~0,5–1,5 sn). Ham: *-sonuc.json.
ÖLÇÜM YÖNTEMİ NOTU: ilk ölçüm sürümü başka kullanıcının isteğini ölçülen programla AYNI süreçten gönderiyordu (program kilitliyken o süreç de istek gönderemez →
eski kodda 24 sn kilitte ~200 ms gösterdi; olay döngüsü örneği de yanıttan önce kapanıyordu). O koşular geçersiz sayıldı, kanıta alınmadı; 0f9d44c5 ile (ayrı süreç
yoklayıcı + 10 ms sayaç + yanıttan sonra 60 ms) hepsi yeniden koşuldu. İlk bitiş sürücüsü arka plan görevinin 2 saat sınırında (19:16:31 UTC) kesildi (taban yeni-2
yarıda) — ürün değil; o koşu da sayılmadı.
