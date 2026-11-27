# WhatsApp Paketi — 2.5.0 Planı (P6)

Durum: PLAN (05.11.2026, baş mimar). Ders 45 gereği "kime kaç kez" ve "çift işlem" kuralları PLANDA yazılır ve kullanıcıya onaylatılır; son adayda yeni kural girmez.
Kaynaklar: `docs/devir/2.5.0-DEVREDEN.md` (W-1…W-5), 2.4.8 / 2.4.9 iş listeleri ve teslim notları (n3, W-KÖK SORU 2, dk18), CLAUDE.md WHATSAPP "KİME KAÇ KEZ" GENEL İLKESİ
(31.10) ve kullanıcı onaylı WhatsApp davranışları. İş listesi: `docs/2.5.0-IS-LISTESI.md` Dalga 2 (W-1…W-5, n3, WY, WE, G1) + BS-1, D6.
Paralel iş: Meta / Tech Provider başvurusu ESKİ oturumda (docs/erp/META-*.md); bu plan onun dosyalarına yazmaz.

## 0. Genel ilke (31.10, aynen uygulanır)
(1) kesin ALMADIYSA sayılmaz; (2) ALMIŞ OLABİLİRSE elenir, tek yol işteki onaylı "Yine de Gönder"; (3) ALDIYSA aynı dönemde elenir, şüphede AYNI dönem; (4) ÇIKMAZ yok — elenen
her kişinin bir gönderme yolu kalır; (5) taşınan / geri yüklenen veride aynı bilgisayardaki kurallar. İlke iki okumaya izin vermezse soru sorulur (aşağıda S-W1…S-W3).

## 1. Maddeler

| # | Sınıf | İş | Kime kaç kez / çift işlem kuralı |
|---|---|---|---|
| W-1 | [XH] | BELİRTEÇ: (a) şimdi — bağlantının belirteç süresini izle; bitişe 7 gün kala ve sonra her gün en çok bir kez "WhatsApp bağlantınızın süresi doluyor — yeniden bağlayın" uyarısı (Yönetim → WhatsApp + bildirim); süre dolunca gönderim başlatılamaz, neden görünür yazı; "Yeniden Bağla" her zaman açık. (b) Meta onayından sonra — kapıcıda yenileme ucu (POST /<CLIENT_BUSINESS_ID>/system_user_access_tokens, appsecret_proof); program bitişe 10 gün kala kendiliğinden yeniler. | Yenileme tek uçuşta bir kez (şirket + WABA başına kilit); yeni belirteç kaydedilmeden eskisi silinmez; sonucu belirsiz yenileme (ağ kopması) sonraki turda yeniden denenir — iki belirteç olursa en yeni süreli olan geçer. İleti göndermez → kişiye ileti etkisi yok. Uyarı günde en çok bir kez. |
| W-2 | [H] | "Bağlantıyı Kaldır" Meta'da da: abonelik (subscribed_apps) silinir + belirteç iptali; sonra yerel kayıt silinir. | Yerel kaldırma HER ZAMAN yapılır (ilke 4: çıkmaz yok); Meta çağrısı düşerse "Meta tarafında kaldırılamadı" uyarısı + destekofis.net/veri-silme adımı. İkinci "Kaldır" etkisiz. Bekleyen işler "Durduruldu" (ilke 1: almadıysa sayılmaz). |
| W-3 | [XH] | Gönderim kayıtları saklama süresi + KVKK silme yolu (wa_jobs, wa_job_pdfs, makine defteri — bugün süresiz, defter silme tetikle engelli). | S-W3 kararına göre. Önerilen: içerik ve telefon süre sonunda ya da silme talebinde silinir; "gönderildi" izi (tarih, dönem, cari kimliği, şablon) anonim kalır → aynı kişiye aynı dönemde ikinci ileti gitmez (ilke 3, 5). |
| W-4 | [M] | Bağlama sayfasında autoLogAppEvents false (bulut/kapi/wa-bagla.mjs). Worker dağıtımı CANLI → kullanıcı onayı. | İleti etkisi yok. |
| W-5 | [M] | Data Deletion Callback — YALNIZ App Review isterse. | W-3 silme yoluna bağlanır. |
| n3 | [XH] | Kuyruktaki ikinci iş + birincinin geç teslimi → aynı kişiye aynı dönemde 2 ileti (2.4.8'den BİLİNEN SINIR). | S-W1 kararına göre. |
| SORU 2 | [XH] | W-KÖK SORU 2: "Süresi Doldu" ileti Meta'nın 24 saatlik alıcı sınırı penceresinde sayılsın mı (bugün sayılmaz — deliveryFailed sayaçtan düşer; kâhin düşürmüyor). | S-W2 kararına göre. |
| WY | [H] | Yol 2'de imzasız bildirim 503 (2.4.8 dk18): yeniden üretilir; imzası doğrulanamayan bildirim "tanınmadı" kaydıyla ele alınır, Meta'nın yeniden denemesi bildirimi kaybettirmez. | Bildirim kaybı yok; aynı bildirim iki kez gelirse tek işlenir (wamid + durum). |
| WE | [H] | Elle Bağla: webhook Callback URL + Verify token'ı program kendisi gösterir (kurulum başına üretilen belirteç, kapıcı adresi); kılavuzdaki "destekten alın" kalkar. | İleti etkisi yok; belirteç yalnız yöneticiye görünür. |
| G1 | [M] | Graph API v26 → güncel sürüm: Meta'nın kaldırma takvimine bakılır; v26 kaldırılmadan en az 6 ay önce geçilir. | Davranış aynen (eşdeğerlik testi). |
| BS-1 | [M] | hookFailure gerilemesi: Meta yalnız hata kodu dönünce "(Meta hata kodu N)" yeniden görünür. | — |
| D6 | [XH] | Devri Geri Al / geri yükleme: makine defteri dokunulmaz, dosyadaki wa_jobs ile birleşir (ilke 5). | Geri alınan dosyada "gönderilmemiş" görünen ama defterde gönderilmiş kişi elenir. |
| — | [M] | 2.4.9 DÜŞÜK-1 testi (queue.mjs wabaId koşulu) n3 ile aynı dosyada. | — |

## 2. Sıra ve bağımlılık
- W-1(a) İLK (Yol 2 satışından önce zorunlu). W-1(b), Meta App Review'da `business_management` izni verildikten sonra (eski oturuma iletildi; izin başvuruda yoksa ikinci tur gerekir).
- n3, SORU 2, W-3 kullanıcı yanıtından sonra (aynı ajan değil; n3 + SORU 2 aynı dosya → tek ajan).
- Her madde: WhatsApp kâhini (2.4.8 K0) karara göre güncellenir (kâhin kuralı yalnız karar metninden, ders 40); her düzeltmeden sonra dar kontrol (xhigh); düzeltme ajanı tur başına yeni (ders 46).

## 3. Nasıl bozulur?
1. İki şirket aynı WABA: yenileme tek; biri kaldırınca öbürünün bağlantısı (W-2 kapsamı yalnız kendi aboneliği).
2. Yenileme sırasında süreç ölür / ağ kopar → eski belirteç sürer, sonraki turda yenilenir; saat ileri / geri.
3. Süre dolmuşken kuyrukta iş → "Durduruldu", neden görünür; yeniden bağlanınca onaylı "Yine de Gönder".
4. n3: birinci iş Meta Kabul Etti (teslim bekliyor) + ikinci iş kuyrukta → karara göre; birincinin teslimi 5 dk / 24 sa / 7 gün geç gelir; birinci Başarısız olur.
5. Süresi Doldu ileti sınıra yakın günde; ertesi gün pencere.
6. Saklama süresi dolan kayıt + aynı dönem yeni gönderim denemesi; KVKK silme talebinden sonra aynı kişi yeniden seçilir.
7. Geri yükleme / devir Geri Al sonrası aynı dönem gönderimi.
8. Kaldır → yeniden bağla → kuyruktaki eski işler.

## 4. KULLANICI KARARLARI (05.11.2026 ~16:48 UTC, AskUserQuestion; aynen)
- S-W1 (n3) = "İkinci de gitsin" → bugünkü davranış KALIR (kod değişmez); n3 BİLİNEN SINIR değil KARAR. Genel ilke (2)'nin bu duruma özel istisnası (kullanıcı kararı).
  WhatsApp kâhini "kuyruktaki ikinci iş, birincinin teslimi beklenirken de gider" kuralına göre (ders 40: kural karar metninden).
- S-W2 (SORU 2) = "Sayılmasın" → bugünkü kural KALIR (Süresi Doldu ileti 24 saatlik alıcı sınırına sayılmaz). WhatsApp kâhini buna göre güncellenir (`pencere_farkli_alici`
  ailesindeki TTL farkları kural farkı olarak kapanır).
- S-W3 (W-3) = "1 yıl + anonim iz (Önerilen)" → içerik, telefon ve PDF 1 yıl sonra ya da silme talebinde hemen silinir; tarih, dönem, cari kimliği ve şablon adı anonim iz kalır.

- W-1 SÜRE DOLUNCA (05.11 ~18:37, AskUserQuestion) = "Duraklasın, sonra sürsün (Önerilen)" → iş 'Duraklatıldı' olur; yeniden bağlanınca 'Devam Et' ile yalnız kalan kişilere gider,
  kimseye ikinci ileti gitmez (bugünkü Meta 190 davranışı). §3 madde 3'teki "Durduruldu + Yine de Gönder" notunun YERİNE geçer.

- W-1 META 190 ALAN KİŞİ (05.11 ~19:15, AskUserQuestion) = "Bekleyenlere dönsün (Önerilen)" → iletisi kesin gitmedi; kalan kişilerle bekler, yeniden bağlanınca 'Devam Et' ile ona da gider.

## 4a. Sorulan sorular (ders 43, 45 — iki seçenek + öneri; KAYIT)
- S-W1 (n3): Kuyrukta bekleyen ikinci iş, aynı kişiye aynı dönem için gönderilmiş ve teslimi beklenen ("Meta Kabul Etti") bir ileti varken ne olsun?
  A (ÖNERİ): elenir ("Zaten Gönderiliyor"); birinci Başarısız olursa ikinci için onaylı "Yine de Gönder" yolu açılır — ilke 2 ("almış olabilirse elenir").
  B: ikinci de gider (bugünkü davranış; nadiren aynı kişiye 2 ileti).
- S-W2 (SORU 2): Teslim süresi dolan ("Süresi Doldu") ileti, Meta'nın 24 saatlik alıcı sınırı hesabında sayılsın mı?
  A (ÖNERİ, güvenli taraf): sayılır — sınıra yaklaşılan günde program biraz erken durur; Meta reddi hiç yaşanmaz. B: sayılmaz (bugünkü) — sınıra yakın günde Meta birkaç iletiyi reddedebilir
  (red zaten işleniyor, ileti kaybolmaz, ertesi gün gider). Meta belgesi Süresi Doldu iletiyi sayıp saymadığını açık yazmıyor (DOĞRULANMADI).
- S-W3 (W-3): Gönderim kayıtları ne kadar saklansın, silme talebinde ne kalsın?
  A (ÖNERİ): içerik, telefon ve PDF 1 yıl sonra (ya da silme talebinde hemen) silinir; tarih, dönem, cari kimliği ve şablon adı anonim iz olarak kalır → aynı kişiye aynı dönemde ikinci
  ileti gitmez. B: silme talebinde her şey silinir — o kişiye aynı dönem iletisi yeniden gidebilir.
