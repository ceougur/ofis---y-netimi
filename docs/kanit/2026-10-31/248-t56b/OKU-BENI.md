# 2.4.8 Aday 2 — T5 (göç) + T6 (arıza/yedek) YENİDEN KOŞU (T56b)

Aday: çalışma ağacı /home/user/wt-t56b-248, dal is/t56b-248, taban is/aday2-248 21ea0474 (Aday 2; şema v43). Ürün kodu DEĞİŞMEDİ. Bu dalda yalnız
`test/t6-248/h-goc-kesinti-v43.mjs` eklendi (93eed936; npm test dışında). Her koşu `tools/kanit.mjs kos` ile: `docs/kanit/2026-10-31/248-t56b-*.{json,log}`.
Eski kod yalnız `git archive` kopyasında (ders 23), not defterinde benzersiz `t56b-*` klasörleri (ders 25); sahte EDM + sahte Meta Graph yalnız 127.0.0.1,
`HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30); süreç öldürme yalnız kendi çocuk pid'lerimiz (ders 36); disk dolu GERÇEK tmpfs. Disk başta 9,5 GB, en düşük 8,9 GB (ders 24).
Araçlar: `araclar/` (goc248.mjs = ilk tur aracı + şema 43 + v41–v43 sütun / makine defteri denetimi + S-PC A; ara.mjs + ara-kos.mjs = 2.4.8 içi ara şema; h3-zorla.mjs).

## Nasıl bozulur? (koşudan önce; ilk turun listesine ek)
1. v41 → v42 → v43 adımları eski satıra dokunur, toplu işin dönemini/kararını boş olmayan değerle doldurur (eski işler başka dönem sayılır).
2. Makine defteri (whatsapp-gonderim.sqlite) eski bir sürümün yazdığı biçimde kalır: learned_wamids / claim_keys yok, eski `claims.period_key` biçimi
   yeni kuralla eşleşmez → "Daha Önce Gönderildi" unutulur, aynı kişiye ikinci ekstre gider.
3. Göç adımı başına işlem değilse öldürmede ara durum (sürüm ≠ sütunlar).
4. T6-B1/B2/E2 düzeltmeleri komşu yolları değiştirir (kilitli dosya, disk dolu).

## T5 — v2.4.7 GERÇEK verisi → Aday 2
| Kayıt | Hüküm | Not |
|---|---|---|
| t5-uret-v247-buyuk | GEÇTİ 6108/6108 | v2.4.7 kendi API'si 6.107 istek (1 × 409 beklenen ret), 01.10.2025–31.10.2026 (13 ay), 2 şirket; EDM ihlali 0 |
| t5-vade-v247 / waveri / olcu | GEÇTİ 110/110, 30/30, 2/2 | 385 kilitli dönem reddi (409, beklenen, sayıldı) |
| t5-goc-v247-aday | GEÇTİ 27/27 | iki şirket 39 → 43, bütünlük ok, pre-migration-v43 yedeği; yeni tablolar yalnız wa_batches/wa_jobs (boş); eski tablolarda satır farkı 0; wa_jobs.prepared_at/pdf_blob, wa_batches.send_again_after/key_day (TEXT NOT NULL DEFAULT ''); learned_wamids/claim_keys şirket dosyasında YOK, makine defterinde VAR (satır 0) |
| t5-fark-v247-aday | 85/92 (7 satır elle sınıflandı → BULGU 0) | admin +whatsapp.send (plan §189); "K6" önce = sonra birebir ×2; şema 39 → 43 ×2; yeni tablolar ×2 (satır farkı 0) — ilk turla aynı 7 |
| t5-wa-v247-aday | KIRMIZI 38/46 = ARAÇ | yeni `passive` alanı + KARAR S-PC A (cb6b2b8a, aday 1'den sonra: wa.me yolu da Pasif Cari'yi eler); fark yalnız "WA Göç Pasif" carisi (geçerli → "Pasif Cari") |
| t5-wa-v247-aday-2 | GEÇTİ 46/46 | beklenti karara göre (yalnız pasif cari); wa.me v2.4.7 ↔ aday birebir; sayaç; wa.me geçmişi; eşli telefon göçten sonra eşli, Kasa = masaüstü; önizleme 10 özel cari plandan |
| t5-yeni-aday / yedek / donus | GEÇTİ 12/12, 14/14, 6/6 | 2.4.7 yedeği 2.4.8'de geri yükleme 0 bölüm fark; geri dönüş (v2.4.7 açar) fark yok, şema 43 kalır |
| t5-uret-v244-zincir / t5-zincir | GEÇTİ 6041/6041, 6/6 | v2.4.4 → v2.4.7 → aday = doğrudan; 15 olgu × 2 şirket üç sürümde aynı (`cikti/t5/zincir-tablo.md`) |
15 olgu önce/sonra: `cikti/t5/once-sonra-tablo.md` — 30 satır aynı; tek fark admin 57 → 58 yetki (whatsapp.send). Mizan 001 51.451.736,50 = 51.451.736,50; 002 36.400.282,81 = 36.400.282,81; Mutabakat sapma 0.

## T5 — 2.4.8 İÇİ ara şema (v40 / v41 / v42) → v43 (ara-kos.mjs; eski commit'in GERÇEK kodu üretir ve "önce" ölçer, Aday 2 "sonra")
Senaryo: 10 cari; ekstre Bu Ay G0–G4 (G0 teslim, G4 131026 Başarısız), G5 Sonucu Belirsiz, hatırlatma G9 kabul, kuyrukta B2 hatırlatma G6/G7 + B3 ekstre G8.
| Eski kod | Şema | Defter anahtar biçimi | Hüküm |
|---|---|---|---|
| 7364660a | v40 | `2026-11-01\|2026-11-03` | 20/24 — R3 KAYBI (aşağıda Ü1) |
| 2afd1d53 | v41 (learned_wamids var) | `2026-11-01\|2026-11-03` | 20/24 — R3 KAYBI (Ü1) |
| 135946fe | v41 | `ay\|thisMonth\|2026-11` | 19/24 — R3 KAYBI (Ü1) + eski kodun kendi hatası (Yeniden Dene / Yine de Gönder işleri "Zaten Kuyrukta" sayılmıyordu; adayda doğru) |
| 83100a79 | v42 (claim_keys var) | `ay\|2026-11` (bugünkü) | GEÇTİ 24/24 |
Her dördünde: göç → 43, bütünlük ok, eklenen sütunlar yalnız beklenenler, eski iş satırları aynı, göçmüş toplu işlerde key_day = send_again_after = '', defter eski satırları korunur;
"Zaten Kuyrukta" (şirket dosyasından), hatırlatma R3 (`gun|` anahtarı değişmedi), Başarısızları Yeniden Dene (yalnız G4), Yine de Gönder (onaysız 409, onaylı G5) önce = sonra.

## T6 — arıza / yedek (Aday 2)
| Kayıt | Hüküm | Sayı |
|---|---|---|
| t6-a-surec-olumu | GEÇTİ 10/10 | 10 tohum × 12 kişi: Meta'nın işlediği 120/120, çift 0, kayıp 0; 4 Sonucu Belirsiz (dördünde de Meta işlemişti, yeniden gönderilmedi); 2 sahipsiz PDF |
| t6-b-disk-dolu | GEÇTİ 3/3 | T6-B1 (takılı "Hazırlanıyor") ve T6-B2 (her turda yeni PDF: 20 turda 1 yükleme, sahipsiz 0) DÜZELMİŞ; b2 503 + Türkçe, aynı istek kimliği tek toplu iş |
| t6-c-kilitli-dosya (+ -2, + eski-bfa93b6d) | GEÇTİ 2/2 ×3 | kilitte ileti 0, çift 0, kilit kalkınca 6/6 — ama c1 HTTP yanıtı 29,4 sn (iki koşuda), aday 1 aynı makinede 9,3 sn (Ü2) |
| t6-de-meta-internet | GEÇTİ 4/4 | T6-E2 DÜZELMİŞ: kesinti iki ileti arasında → "Bağlantı Bekleniyor", 3/3, belirsiz 0 (hatırlatma ve ekstre) |
| t6-fg-yedek-sifirla | GEÇTİ 3/3 | f1 yedek → 4 kişi → geri yükle: toplu iş 0, R3 4 (makine defterinden), yeniden başlat 400, Yine de Gönder 1; f2 "Durduruldu (Geri Yükleme)", ileti 6'da kaldı, sayaç 6 = 6; g sıfırla: sonra 0 ileti, çift yok |
| t6-h-goc-kesinti-v42-v43 / v41 / v40 | h1 + h2 GEÇTİ; h3 KIRMIZI = ARAÇ | h1: 20 anda SIGKILL, sürüm dağılımı v42:5 v43:15 / v41:5 v43:15 / v40:4 v43:16 — ara durum 0, bütünlük 20/20, tam açılışta v43 + toplu iş bitti, kopya başına kişi başı ≤ 1 ileti; h2 COMMIT'siz ALTER → temiz v43, 5/5. h3 araç hatası: sütunlar göçten SONRA okunuyordu → düzeltildi |
| t6-h-goc-kesinti-v4x-v43-h3-2 | GEÇTİ 1/1 ×3 | göçte disk dolu: dosya eski sürümde + sağlam, yer açılınca v43, 5/5 |
| t6-h3-disk-dolu-acilis-aday1-aday2(-2) | 1. ARAÇ (salt okunur okuma dolu diskte), 2. GEÇTİ 2/2 | aday 1 ve Aday 2 aynı: ~350 ms'de çıkış "disk I/O error" (İngilizce; bilinen DÜŞÜK); h3'teki "45 sn hazır değil" iletisi ortak.mjs'in boş çıktıyı erken yazmasıydı |
| kaynak-tarama(-2) | GEÇTİ 15/15 ×2 | lisans izolasyonu + platform + Meta izolasyonu (yeni betik commit'ten sonra) |

## ÜRÜN BULGULARI
- Ü1 (DÜŞÜK önerisi — sınıf ana oturumda): makine defterinin `claims.period_key` biçimi 2.4.8 geliştirmesinde iki kez değişti (1f8aab63 T2-1; 1f264264 "takvim ayı"),
  eski satırlar dönüştürülmüyor → 1f264264'ten ÖNCEKİ bir 2.4.8 yapısının defterini Aday 2 açınca "Bu Ay" ekstresinde "Daha Önce Gönderildi" kaybolur (G0–G3 gönderilebilir
  görünür; eski kod aynı veride 4'ünü eler). Müşteride bu biçim YOK (2.4.7'de WhatsApp API defteri yok; 2.4.8 yayımlanmadı) → yalnız geliştirme/test kurulumları. Kalıcı ders:
  anahtar biçimi değişirse defter (yalnız eklenir) için dönüştürme gerekir (ör. açılışta eski anahtarlara claim_keys satırı eklemek). Betik ara-kos.mjs, kanıt t5ara-*.
- Ü2 (DÜŞÜK, gerileme): şirket dosyası 25 sn kilitliyken programın HTTP yanıtı aday 1'de ~9,3 sn, Aday 2'de ~29,4 sn (olay döngüsü ~3 × busy_timeout tutuluyor). Kök neden
  (koddan): T6-B1/B2 düzeltmesi `deferLocal` ilk yazım düşünce iki yazım daha deniyor (wa_jobs UPDATE + trouble() updateBatch), her biri 10 sn bekliyor. Veri kaybı/çift yok.
  Bilinen 2.5.0 DÜŞÜK'ünün ("kilitli dosyada yanıt ~9–10 sn") 3 katı. Makine defteri kilidinde (c2) değişmedi (~9,4 sn).

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- DENENEN: ders 2, 3, 4, 5 (beklenen plan kuralından / eski sürümün kendi gösterdiğinden; S-PC A beklentisi programdan önce yazılmış kullanıcı kararından — ders 40), 6 (her kırmızı yeniden
  üretildi, eski kodla karşılaştırıldı, araç/ürün ayrıldı), 9/10 (T6-B1/B2/E2 düzeltmelerinin komşusu kilitli dosya), 13/22 (sahte saat), 17, 20 (h2 zorla, h3 zorla, kilit karşılaştırması), 23, 24, 25, 30, 36, 44.
- DENENMEYEN: Windows; arayüzden (Playwright) göçmüş veri gezintisi; göçmüş v2.4.7 verisinde gerçek toplu gönderim (yalnız önizleme; ara şemada gönderim var); v2.4.5/2.4.6'dan doğrudan;
  3+ şirket; büyük hacimde WhatsApp geçmişi (T9); gerçek Meta.
- BİLİNEN SINIR: m30-fark'ta 2.4.8 profili yok (7 / 5 satır elle); Yedek dosya adları gerçek saatle (veri sahte saatle).
