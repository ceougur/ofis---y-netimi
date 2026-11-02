# 2.4.8 Aday 2 — T5 (göç) + T6 (arıza/yedek) YENİDEN KOŞU 2 (T56c, şema v44)

Aday: çalışma ağacı /home/user/wt-t56c-248, dal is/t56c-248, taban 862d7fa5 (Aday 2; şema v44 = wa_jobs.inherit_of; makine defterine CREATE IF NOT EXISTS ile
attempt_deliveries + anyway_links). Ürün kodu DEĞİŞMEDİ. Bu dalda yalnız `test/t6-248/h-goc-kesinti-v44.mjs` eklendi (8bef6682; v43 betiğinin uyarlaması; npm test dışında).
Her koşu `tools/kanit.mjs kos` ile: `docs/kanit/2026-11-01/248-t56c-*.{json,log}`. Eski kod yalnız `git archive` kopyasında (ders 23), not defterinde benzersiz
`t56c-9b41e7/` klasörü (ders 25); sahte EDM + sahte Meta Graph yalnız 127.0.0.1, `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30); süreç öldürme yalnız kendi çocuk pid'lerimiz
(ders 36); disk dolu GERÇEK tmpfs. Koşular tek tek, sırayla (ders 15). Disk başta 8,3 GB, en düşük 7,8 GB (ders 24). Araçlar `araclar/` (T56b araçlarının v44 uyarlaması).

## Nasıl bozulur? (koşudan önce; T56b listesine ek)
1. v43 → v44 adımı eski iş satırına dokunur ya da inherit_of'u boş olmayan değerle doldurur (eski işler "Yine de Gönder" zincirine bağlı sayılır).
2. Eski makine defterinde attempt_deliveries yok: eski teslim (yalnız `deliveries`) "Bu Ay"da kaybolur ya da yeni bildirimle İKİ kez sayılır (read/delivered yinelenmesi).
3. Eski defterde anyway_links yok: "Yine de Gönder" işinin kaynağı Sonucu Belirsiz olarak kalır ya da çift ileti.
4. v44 göç adımı ayrı işlem değilse SIGKILL'de ara durum (sürüm ≠ sütunlar).
5. İş O–Y (kilit, 503, resolveStatus, claim zinciri, repairPending/probeWritable) komşu arıza yollarını değiştirir (kilitli dosya, disk dolu, süreç ölümü, geri yükleme).

## T5 — v2.4.7 GERÇEK verisi → Aday 2 (v44)
| Kayıt | Hüküm | Not |
|---|---|---|
| t5-uret-v247-buyuk | GEÇTİ 6108/6108 | v2.4.7 kendi API'si, 13 ay (01.10.2025–31.10.2026), 2 şirket (3.221 + 936 cari) |
| t5-vade / waveri / olcu | GEÇTİ 110/110, 30/30, 2/2 | |
| t5-goc-v247-aday | GEÇTİ 29/29 | iki şirket 39 → 44, bütünlük ok, pre-migration-v44 yedeği; yeni tablolar yalnız wa_batches/wa_jobs (boş); eski tablolarda satır farkı 0; wa_jobs.inherit_of TEXT NOT NULL DEFAULT '' (iki şirket); makine defteri tabloları (attempt_deliveries, anyway_links dahil) şirket dosyasında YOK, defterde VAR (satır 0) |
| t5-fark-v247-aday | 85/92 (7 satır elle sınıflandı → BULGU 0) | T56b'nin 7 satırıyla BİREBİR (diff boş): admin +whatsapp.send; K6 önce = sonra ×2; şema 39 → 44 ×2; yeni tablolar ×2 |
| t5-wa-v247-aday | GEÇTİ 46/46 | S-PC A (pasif cari); wa.me v2.4.7 ↔ aday birebir; eşli telefon göçten sonra eşli, Kasa = masaüstü |
| t5-yeni / yedek / donus | GEÇTİ 12/12, 14/14, 6/6 | 2.4.7 yedeği adayda geri yükleme; geri dönüş (v2.4.7 v44 dosyayı açar, şema 44 kalır) |
| t5-uret-v244-zincir / t5-zincir | GEÇTİ 6041/6041, 6/6 | v2.4.4 → v2.4.7 → aday = doğrudan (`cikti/t5/zincir-tablo.md`) |
15 olgu önce/sonra `cikti/t5/once-sonra-tablo.md`: 30 satır aynı; tek fark admin 57 → 58 (whatsapp.send). Mizan 001 51.451.736,50 = 51.451.736,50; 002 36.400.282,81 = 36.400.282,81;
Mutabakat sapma 0 (aynı tohumla T56b'deki sayılarla da birebir).

## T5 — 2.4.8 İÇİ ara şema (v40 / v41 / v42 / v43) → v44 (`araclar/ara-kos.mjs`; eski commit'in GERÇEK kodu üretir ve "önce" ölçer, Aday 2 "sonra")
Senaryo T56b ile aynı + YENİ: bekleyenler (Yeniden Dene G4, Yine de Gönder G5, kuyruk G6/G7/G8) sürülür → kime kaç ileti, "Bu Ay" sayacı, sürüldükten sonra R3.
| Eski kod | Şema | Son kayıt | Hüküm |
|---|---|---|---|
| 7364660a | v40 | t5ara-7364660a-3 | 25/30 — 5 kırmızı = Ü1 (BİLİNEN SINIR, T56b; eski defter anahtar biçimi: G0–G3 R3 kaybı; sürüldükten sonraki önizleme de aynı kökten) |
| 2afd1d53 | v41 | t5ara-2afd1d53-3 | 25/30 — Ü1 (aynı 5) |
| 135946fe | v41 | t5ara-135946fe-3 | 24/30 — Ü1 (5) + eski kodun kendi hatası (Yeniden Dene/Yine de Gönder işi "Zaten Kuyrukta" değil; adayda doğru) |
| 83100a79 | v42 | t5ara-83100a79-3 | GEÇTİ 30/30 |
| 4affbb07 (= 781b24eb^) | v43 | t5ara-4affbb07-3 | GEÇTİ 30/30 |
Hepsinde: göç → 44, bütünlük ok, eklenen sütunlar yalnız beklenenler (inherit_of dahil), eski iş satırları aynı, key_day/send_again_after eski kodun değeri, defter eski satırları
korunur + attempt_deliveries/anyway_links eklenir (attempt_deliveries 0 satır: göç dönüştürmez); sürülünce yalnız G4–G8'e birer ileti (çift 0), Bu Ay teslim 1 (eski deliveries
satırından) / Meta Kabul Etti 5 → 10; v42/v43'te sürüldükten sonra G0–G5, G8 "Daha Önce Gönderildi" (G5: Yine de Gönder kabul → İş Q2 kararı A).
ARAÇ düzeltmeleri (ürün değil; -1 → -2 → -3): (1) "eski iş satırları" denetimi sürmeden önce okunmalı (olc artık sürüyor); (2) key_day/send_again_after beklentisi v43 verisinde eski kodun
değeri; (3) her `olc` süreci yeni sahte Meta açıyor: wamid sayacı SAHTE0001'den başlıyor → defterdeki eski wamid'lerle tekil dizin çakışması → işler "sending"de kalıyordu (gerçek Meta
wamid'i yeniden vermez; eski kod 4affbb07 de AYNI davranıyor, `araclar/hata-drain.mjs` ile yeniden üretildi; sayaç 1000'den başlatılınca 3/3 accepted); (4) yeni sahte Meta, uret sürecinin
yüklediği medyayı bilmiyordu → Yine de Gönder kaynak işin anlık görüntüsündeki medya kimliğiyle 131053 (gerçek Meta PDF'i 30 gün tutar; silinmemiş medya yeni sahteye tohumlandı).

## T6 — arıza / yedek (Aday 2)
| Kayıt | Hüküm | Sayı |
|---|---|---|
| t6-a-surec-olumu | GEÇTİ 10/10 | 10 tohum × 12 kişi: Meta'nın işlediği 120/120, ihlal (çift/kayıp) 0; 4 Sonucu Belirsiz (dördünde de Meta işlemişti, yeniden gönderilmedi); 2 sahipsiz PDF |
| t6-b-disk-dolu | GEÇTİ 3/3 | b1 dolu diskte 20 sn ileti 0, yer açılınca biter; b2 503 Türkçe, aynı istek kimliği tek toplu iş; b3 20 turda 1 yükleme, sahipsiz 0 |
| t6-c-kilitli-dosya | GEÇTİ 2/2 | kilitte ileti 0, çift 0, kilit kalkınca 6/6; HTTP yanıtı c1 enÇok 6 ms, c2 6 ms (T56b 29,4 sn → İş N 9,3 sn → şimdi; İş P "arka plan işleri kilitli şirkete yazmaz" ile uyumlu) |
| t6-de-meta-internet | GEÇTİ 4/4 | 503/500/429/kopma/131026: çift yok, belirsizler gönderilmez; internet yok → 502 Türkçe, "Bağlantı Bekleniyor", kesinti iki ileti arasında → 3/3 (hatırlatma ve ekstre) |
| t6-fg-yedek-sifirla | GEÇTİ 3/3 | f1 yedek → 4 kişi → geri yükle: toplu iş 0, R3 4 (makine defterinden), yeniden başlat 400, Yine de Gönder 1 (bilerek seçilen ikinci kopya, S9-1 (b)); f2 "Durduruldu (Geri Yükleme)", ileti 6'da kaldı, sayaç 6 = 6; g sıfırla: sonra ileti yok, çift yok |
| t6-h-goc-kesinti-v43/v42/v41/v40-v44 | GEÇTİ 3/3 ×4 | h1 20 anda SIGKILL: dağılım v43:4 v44:16 / v42:4 v44:16 / v41:4 v44:16 / v40:4 v44:16 — ara durum 0, bütünlük 20/20, tam açılışta v44 + toplu iş bitti, 20 kopyada kişi başı tam 20 (kopya başına 1); h2 COMMIT'siz ALTER (v43 → v44 dahil) → temiz v44, 5/5; h3 göçte disk dolu: dosya eski sürümde + sağlam, yer açılınca v44, 5/5 |
| t6-h3-disk-dolu-acilis-v43-aday | GEÇTİ 1/1 | dolu diskte aday ~330 ms'de çıkar, "disk I/O error" (İngilizce; bilinen DÜŞÜK, T56b ile aynı) |
| t6-eski-defter-4affbb07(-2, -ilk-read) / -83100a79(-2) | GEÇTİ 7/7 ×5 | v42/v43 kodunun yazdığı defter (attempt_deliveries, anyway_links YOK) adayda: iki tablo oluşur, eski satırlar korunur; Bu Ay teslim 1 (eski deliveries); aynı denemeye yinelenen delivered + read (ilk bildirim read olsa da) → 1 kalır (deneme satırı eski teslim anıyla yazılıyor); yeni teslim → 2; R3 sürer; bildirim ileti göndertmez |
| kaynak-tarama | GEÇTİ 15/15 | lisans izolasyonu + platform + Meta izolasyonu (yeni betik commit'inden sonra) |

## ÜRÜN BULGULARI
- YENİ YOK (YÜKSEK/ORTA/DÜŞÜK). Ü1 (2.4.8 geliştirme ara sürümlerinin defter anahtar biçimi) değişmedi, zaten BİLİNEN SINIR. Disk dolu açılışta İngilizce "disk I/O error" (bilinen DÜŞÜK) aynı.
- Gözlem: kilitli şirket dosyasında HTTP yanıtı artık ms düzeyinde (İş P'nin beklenen etkisi).

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- DENENEN: ders 2, 3, 4, 5 (beklenen plan kuralından / girilen veriden / eski sürümün kendi gösterdiğinden / kullanıcı kararlarından — S-PC A, İş Q2 A, 01.11 06:28 (5), S9-1 (b)), 6 (her kırmızı
  yeniden üretildi, eski kodla karşılaştırıldı, araç/ürün ayrıldı: hata-drain.mjs eski 4affbb07 ↔ aday aynı), 9/10 (İş O–Y komşusu: kilit, disk dolu, ölüm, yedek), 13/22 (sahte saat), 15, 17, 20 (h2 zorla,
  h3 tmpfs, ilk bildirimi read varyantı), 23, 24, 25, 30, 36, 44.
- DENENMEYEN: Windows; arayüzden (Playwright) göçmüş veri gezintisi; göçmüş v2.4.7 verisinde gerçek toplu gönderim (yalnız önizleme; ara şemada gönderim var); v2.4.5/2.4.6'dan doğrudan;
  3+ şirket; büyük hacimde WhatsApp geçmişi (T9); gerçek Meta; anyway_links'i DOLU eski defter (2.4.8 içinde anyway_links ile aynı commit'te gelen sürümler ayrıca üretilmedi).
- BİLİNEN SINIR: m30-fark'ta 2.4.8 profili yok (7 satır elle); yedek dosya adları gerçek saatle (veri sahte saatle); sahte Meta süreçler arası durum taşımaz (araç düzeltmesi 3–4).
