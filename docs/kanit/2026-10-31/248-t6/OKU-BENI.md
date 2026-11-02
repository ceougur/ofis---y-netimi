# 2.4.8 son aday T6 (arıza ve yedek) + T8 (güvenlik)

Aday: çalışma ağacı /home/user/wt-t6-248, dal is/t6-248, aday 1 = 29c6514b. Ürün kodu DEĞİŞMEDİ; yalnız sınama betikleri eklendi: `test/t6-248/` (adları `.test.mjs`
DEĞİL → `npm test`'e girmez; `node --test test/t6-248/<ad>.mjs` ile koşulur). Her koşu `node tools/kanit.mjs kos 248-t6/<ad> -- …` (bu klasörde `<ad>.json` + `<ad>.log`).

Ortam: geçici veri `T6_KOK` = not defterinde benzersiz `t6-k7q2/kok` (ders 25), `TMPDIR` aynı yerde; `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30, çocuk süreç
denetler); Meta yalnız yerel sahte Graph (`test/whatsapp-sahte-graph.mjs`, 127.0.0.1) — sahte Meta programı yazan elden, KÂHİN DEĞİL (ders 5): beklenenler planın
kurallarından (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W2, §7a, R1, S3) ve testin girdiği veriden; sayılar sahte Meta'nın İSTEK kaydından (ders 3) ve programın veri
dosyasından. Süreçler: yalnız kendi başlattığımız çocuklar SIGKILL ile (ders 36, pkill yok). Disk dolu: GERÇEK tmpfs (`mount -t tmpfs`, kök kullanıcı) — kendi
bağlama noktalarımız, iş bitince `umount`. Eski kod (h): v40 = 7364660a (`git archive` → not defteri `t6-k7q2/eski-7364660a`, ders 23). Saat: çocuk süreçte sahte
akan saat 03.11.2026 09:00 TR (gün sınırı yok — ders 13/22).

## Nasıl bozulur? (koşudan önce)
1. Gönderim ortasında süreç ölür → yeniden açılışta aynı kişiye ikinci ileti; ya da gitmemiş ileti "gitti" sayılır / hiç gitmez.
2. Disk dolar → işçi aynı işi durmadan dener (meşgul döngü), her turda Meta'ya yeni PDF yükler (T2 kuşkusu), iş takılı kalır, toplu iş bitmez, dosya bozulur.
3. Dosya kilitli → ileti defter yazılmadan gider (çift gönderim kilidi atlanır); program donar.
4. Meta 5xx / 429 / kopma → yanıtsız istek yeniden gönderilir (çift), geçici hata Başarısız sayılır, belirsiz kendiliğinden gönderilir.
5. İnternet yok → işler Başarısız/Belirsiz olur (R1'e aykırı); iki ileti ARASINDA kesilirse havuzdaki eski soket yüzünden ilk istek Belirsiz (T1 kuşkusu).
6. Yedek → gönder → geri yükle → eski işler dirilir; makine defteri yedekte olmadığı için "Daha Önce Gönderildi" unutulur → aynı kişilere ikinci ileti; sayaç azalır.
7. Şirket Verisini Sıfırla gönderim sürerken → sonraki kişilere gider; Meta'daki ileti isteği çift yazılır.
8. Göç (v40 → v41) yarıda kesilir → yarım şema, sütun var sürüm yok; disk dolu göçte dosya bozulur.
9. Belirteç / kanca sırrı yanıtlarda, günlükte, işlem geçmişinde, veri klasöründe, yedekte, PDF/Excel'de; imzasız / sahte / yeniden oynatılmış kanca durumu değiştirir;
   başka şirketin wamid'i yanlış şirkete yazılır; yetkisiz kullanıcı / salt okunur lisans gönderir.

## Koşular (commit bfa93b6d = aday 1 + yalnız test/t6-248; ürün kodu 29c6514b ile aynı)
| Kayıt | Hüküm | Sayı |
|---|---|---|
| taban-mevcut-testler (29c6514b; w2-surec-olumu, w2-veri, w2-cekirdek, w9-kanca, t2-2, t2-4, meta-izolasyon, lisans-izolasyonu) | GEÇTİ | 51/51 |
| a-surec-olumu | GEÇTİ | 10/10 tohum |
| b-disk-dolu | BAŞARISIZ = 2 BULGU (T6-B1, T6-B2) | 1/3 |
| c-kilitli-dosya | GEÇTİ | 2/2 |
| de-meta-internet | BAŞARISIZ = 1 BULGU (T6-E2) | 3/4 |
| fg-yedek-sifirla | GEÇTİ | 3/3 |
| h-goc-kesinti | GEÇTİ | 3/3 |
| t8-guvenlik | GEÇTİ | 4/4 |
| t8-izolasyon-ve-kaynak (lisans/Meta izolasyonu + platform + yazım; yeni betikler dahil) | GEÇTİ | 21/21 (ilk koşu 19/21: yeni betiklerde iki Windows kalıbı — düzeltildi) |
Kırmızıların nedeni iletide okundu (ders 38): "BULGU T6-B1 … takılı iş: preparing", "BULGU T6-B2: 20 turda 20 PDF yüklendi", "BULGU T6-E2 (reminder): … 'Sonucu Belirsiz'".

## Senaryolar (beklenen → görülen)
- (a) SIGKILL toplu gönderimin ortasında, 10 tohum × 12 kişi (öldürme K. ileti isteğinde + 0–400 ms): çift ileti 0/120, kayıp 0; istek Meta'dayken ölen 4 iş → "Sonucu Belirsiz"
  (dördünde de Meta iletiyi işlemişti, yeniden gönderilmedi); PDF yüklenirken ölen 2 işte yükleme yinelendi → 1'er sahipsiz PDF Meta'da (30 günde düşer, bilinen). GEÇTİ.
- (b1) GERÇEK disk dolu (48 MB tmpfs), ilk PDF Meta'dayken: dolu diskte 20 sn'de PDF yüklemesi 0, ileti 0 (iyi) ama işçi 92 kez "database or disk is full" (gapMs 200 →
  üretimde ~1/sn, beklemesiz); yer açılınca 3 kişi gitti, ilk iş "Hazırlanıyor"da KALDI, toplu iş 90 sn "Sürüyor" → BULGU T6-B1. Yeniden açılışta toparlandı (4/4, çift yok), 1 sahipsiz PDF.
- (b2) disk ZATEN doluyken başlat: 503 "WhatsApp gönderim defterine yazılamadı … disk dolu olabilir. Gönderim başlatılmadı.", toplu iş 0, ileti 0; yer açılınca aynı istek kimliği tek toplu iş, 3/3. GEÇTİ.
- (b3) ZORLA (T2 kuşkusu): yalnız "UPDATE wa_jobs SET media_id" yazımı düşer → 20 turda 20 PDF yüklemesi, 20'si Meta'da sahipsiz, iş hep "Bekliyor" (bekleme yok); yazım düzelince
  1 ileti (çift yok). KUŞKU DOĞRULANDI → BULGU T6-B2.
- (c1) şirket dosyası 25 sn kilitli: kilitte ileti 0, çift yok, kilit kalkınca 6/6. Kilit sürerken programın HTTP yanıtı ~9–10 sn (busy_timeout 10 sn olay döngüsünü tutar; 4 istekte 4).
  (c2) makine defteri 25 sn kilitli: kilitte ileti 0 ("gönderim defteri yazılamadı … istek GÖNDERİLMEZ"), kabul sonucu deftere yazılamadı uyarısı, kilit kalkınca 6/6, çift yok; HTTP ~9,5 sn.
- (d) 8 kişi: PDF 503 (gövdesiz) → toplu iş "Bağlantı Bekleniyor" 30 sn, sonra sürdü; ileti 500 kod 2 ve 429 130429 → 30 sn sonra birer kez gitti; HTML 500 ve bağlantı kopması →
  "Sonucu Belirsiz" (ikisinde de Meta işlemedi; yeniden gönderilmedi); 131026 → Başarısız (kodlu); toplu iş Tamamlandı (5 kabul, 2 belirsiz, 1 başarısız); çift 0. GEÇTİ.
- (e1) internet yokken başlat → 502 "Meta'ya ulaşılamıyor; gönderim başlatılmadı…" (P2 A); gönderimin başında kesinti (havuzdaki soket ölü) → "Bağlantı Bekleniyor", 4 iş Bekliyor, Başarısız/Belirsiz 0;
  dönünce 4/4. GEÇTİ.
- (e2) ZORLA (T1 kuşkusu): kesinti iki ileti ARASINDA (canlı soket 2): EKSTRE → ilk istek PDF yüklemesi → "Bağlantı Bekleniyor", 3/3 (doğru). ÖDEME HATIRLATMA → ilk istek ileti →
  3 sn zaman aşımı → "Sonucu Belirsiz", ileti Meta'ya HİÇ ulaşmadı, kendiliğinden gönderilmedi (2/3 kişi aldı). KUŞKU DOĞRULANDI → BULGU T6-E2.
- (f1) yedek → 4 kişiye gönder → geri yükle (001: açılışta) → toplu iş 0; defterde kabul 4; önizleme "Daha Önce Gönderildi" 4; yeniden başlat 400 "Daha Önce Gönderildi: 4", ileti 4'te kaldı;
  "Yine de Gönder" (sendAgain) 1 kişiye bilerek 2. ileti. Sayaç (kabul) azalmadı. GEÇTİ.
- (f2) gönderim sürerken (2/6) yedek → bitti (6/6) → o yedek geri yüklendi → toplu iş "Durduruldu (Geri Yükleme): … zaten bitmişti", iletiler 6'da kaldı, sayaç 6 = 6, R3 6 kişi. GEÇTİ.
  (Not: yedekte bekleyen görünen 4 iş "Durduruldu" görünüyor; gerçekte gitmişlerdi — DÜŞÜK.)
- (g) ileti isteği Meta'dayken Şirket Verisini Sıfırla: 200; Meta'daki istek işlendi (2 → 3), sonra 0 ileti; kuyruk 0, iş satırı 0, defterde stop/reset, kabul 3; çift yok. Meta'da 3 PDF kaldı (iş satırları silindi → program silemez). GEÇTİ.
- (h1) v40 verisi (eski kodun kendi API'si, 5 kişi bekleyen) → yeni kod açılırken 20 anda SIGKILL (40–1940 ms): 4'ünde v40, 16'sında v41, ARA YOK, bütünlük 20/20 ok, iş satırı 5; tam açılışta v41 +
  sütunlar, 20/20 toplu iş bitti; kopyalar toplamında kişi başına ≤ 1 ileti. (h2) ZORLA: ALTER işlem içinde, COMMIT'siz ölüm → v40, sütun yok, ok → yeni kod v41, 5/5. (h3) göçte disk dolu →
  program HEMEN çıkıyor ("disk I/O error", kullanım defteri açılışı), dosya v40 + ok; yer açılınca v41, 5/5. GEÇTİ.
- T8 sızıntı: 26 yanıt (mobil özetin kaynak uçları, işlem geçmişi, 190 yankı hatası dahil), 44 günlük satırı, veri klasöründe 12 dosya (şirket, makine defteri, WAL), yedek dosyası, ekstre PDF /
  liste PDF / Excel (açılarak) → belirteç, kanca gizli yolu, doğrulama belirteci: 0 iz. secret.key yedekte yok. App Secret program kaynağında (server, client) yok; yalnız bulut/kapi.
- T8 kanca: yanlış/kısa gizli yol 404, PUT 405, yanlış doğrulama 403, bozuk JSON 400; bilinmeyen wamid yazılmadı; 002'nin wamid'i (aynı WABA) yalnız 002'ye; başka numara yok sayıldı; aynı teslim
  3 kez → Bu Ay 2 (001 + 002); read'den sonra sent/failed yok sayıldı. SAHTE İMZASIZ 131049 (Yol 1) kabul edilmiş işe → "Meta Bekletti", toplu iş yeniden "Sürüyor", 24 sa sonra 2. ileti GİTTİ (DÜŞÜK; P5).
- T8 yetki: personel (whatsapp.send yok) 15 uçta 403, Meta isteği 0; salt okunur lisans 14 uçta 403 LICENSE_READ_ONLY (toplu liste okuma 200), Meta isteği 0.

## DENENMEYEN
Windows (gerçek kilit/paylaşım ihlali, virüs tarayıcı; ders 18), gerçek ağ kablosu çekme (yerel TCP kara deliğiyle taklit), gerçek Meta (D0 kullanıcıda), kapıcı üzerinden imzalı Yol 2 kancası
(W9 testleri tabanda), supervisor/başlatıcının disk dolu çıkışını nasıl gösterdiği, arayüzden (ekran) arıza akışları, büyük hacim (T9), mobil özetin şifreli zarfı (kaynak uçları tarandı).
