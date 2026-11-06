# W-3 — WhatsApp Gönderim Kayıtlarının Saklama Süresi ve KVKK Silme Yolu (Tasarım, 2.5.0)

Durum: TASARIM (06.11.2026, W-3 kod ajanı; kodlamadan ÖNCE yazıldı; uygulama sonunda §2 hata metni kuralı, §2 denetim noktası, §3 Yönetim yolu, §7 7–8 ve §8 güncellendi). Kaynaklar: `docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md` §0, §1 W-3, §3 madde 6–7, §4 S-W3;
`docs/2.5.0-IS-LISTESI.md` D bölümü (S-W3 05.11, S29–S32 06.11 06:52, S34–S38 08:06, S42 08:54; BAŞ MİMAR KARARI Y17-6 08:52); kâhin README
`test/bagimsiz/whatsapp-248/README.md` §20 (S-W3), §21 (S29–S32), §22 (S33–S38) — kâhinin yorumları ve sürücü notları (S-59…S-83). Kâhinin KODU açılmadı.

## 1. Kararlar (AYNEN; para / "kime kaç kez" kuralı DEĞİŞMEZ)
- S-W3 = "1 yıl + anonim iz": içerik, telefon ve PDF 1 takvim yılı sonra (son denemeden, yerel saat) ya da KVKK silme talebinde HEMEN silinir; tarih, dönem, cari kimliği, şablon adı
  + deneme sonucu ve sayaçlar anonim iz kalır → aynı kişiye aynı dönemde ikinci ileti gitmez.
- S30 = A (bekleyen iş gönderilmez; Sonucu Belirsiz izi kalır), S31 = A (içeriği silinmiş EKSTRE işi yeniden gönderilemez, neden görünür), S32 = A (talepten önceki yedek geri
  yüklenince silinmiş içerik / telefon GELMEZ; talepler makinede, yedeğe girmez, geri yüklemeden sonra yeniden uygulanır), S35 = A + Y17-6 (bekleyen iş talep / dolum ANINDA
  "Atlandı — Silme Talebi" / "Atlandı — Saklama Süresi"), S36 = A (belirsiz Ekstre'nin aynı dönem yolu kalmaz), S37 = B (içeriği silinmiş ÖDEME HATIRLATMA aynı iş üzerinden
  yeniden gönderilebilir; içerik ve telefon gönderim anında karttan), S38 = A (taşımada talep kayıtları taşınır, yeni bilgisayarda da uygulanır), S42 = A ("Gönderiliyor"
  anında içerik + telefon hemen silinir; sonuç ize yazılır; yeniden gönderim gerekirse iş o anda "Atlandı — Silme Talebi"). İLKEYLE (WK 15): silinmiş kayıtta R3 "Yine de
  Gönder" açık; kapanmış işin belirsiz izi eler.

## 2. Veri nerede, ne silinir, ne kalır
| Yer | Kişisel veri | Silme / anonimleştirme | Kalan iz |
|---|---|---|---|
| Şirket dosyası `wa_jobs` | `phone_e164`, `account_name`, `params_json` (ad, firma, dönem, bakiye, vade), `pdf_name` (ad taşır), `wamid` (Meta ileti kimliği; alıcının numarasını base64 içinde taşır — DOĞRULANMADI, yaygın gözlem), `error_text` (Meta metni; içinde numara olabilir) | `phone_e164 = ''`, `account_name = ''`, `params_json = {"icerikSilindi": "talep"\|"sure", "at": …}` (İŞARET; normal içerik her zaman dizi `[`), `pdf_name = ''`, `wamid = 'h:' + SHA-256(wamid)` (geç bildirim yine eşleşir), `error_text` içindeki 10+ haneli sayı dizileri (telefon numarası; + ve ayraçlarıyla) `…` — Meta hata kodları (en çok 7 hane) ve metnin geri kalanı iz olarak kalır | id, batch_id, account_id (cari kimliği), template, lang, period_*, state, skip_reason, error_code, attempt, temp_tries, retry_131049, bütün zaman alanları, billable, media_* (Meta'daki kopyanın silinmesi için), inherit_of |
| Şirket dosyası `wa_job_pdfs` | ekstre PDF'i | satır silinir | — |
| Şirket dosyası `wa_batches` | yok (dönem, şablon, kullanıcı) | — | aynen |
| Şirket dosyası `message_sends` (elle wa.me yolu) | `phone`, `body` (tam ileti metni) | `phone = ''`, `body = ''` (BAŞ MİMAR KARARI §7 (3)) | kind, status, created_at, account_id |
| Makine defteri `whatsapp-gonderim.sqlite` `claims` | `phone` (24 saat sınırı sayacı) | `phone = 'silinmis:<iş>'` (sayaç alıcıyı işin kimliğiyle sayar — kâhin Y16-13; silme sayacı AZALTMAZ) | job, deneme, toplu iş, şirket, WABA, cari, tür, dönem anahtarı, an |
| Makine defteri `outcomes`, `learned_wamids` | `wamid` | `'h:' + SHA-256(wamid)` | sonuç, an |
| Makine defterinin öbür tabloları | yok | — | aynen (R3, "Bu Ay", belirsiz izi bunlardan) |
| Silme talepleri `whatsapp-silme-talepleri.sqlite` (YENİ, ana veri klasöründe) | yok (yalnız şirket kimliği + cari kimliği + talep anı) | — | §4 |
| Yedekler | yedeğin alındığı andaki dosya | yedek dosyası DEĞİŞTİRİLMEZ (S32 kararı): geri yüklenince talep yeniden uygulanır, 1 yıl kuralı da | — |

Defterin "yalnız eklenir" tetikleri (plan W-3 satırı: "defter silme tetikle engelli"): `claims_no_update`, `outcomes_no_update`, `learned_wamids_no_update` YALNIZ tek bir dönüşüme izin
verecek biçimde yeniden yazılır (WHEN koşulu): `claims` → yalnız `phone` sütunu `'silinmis:' || job_id` olur, öbür her sütun aynı; `outcomes` / `learned_wamids` → yalnız `wamid`
boş olmayan açık değerden `'h:'` önekli 66 karakterlik özete geçer. Başka her UPDATE ve her DELETE yine "gönderim defteri yalnız eklenir" ile düşer. Eski defter açılışta bir
kez yükseltilir (tetik metni denetlenir; DROP + CREATE tek işlemde).

Dosya artıkları (KVKK sızıntı denetimi): silme `PRAGMA secure_delete = ON` altında yapılır (serbest kalan hücre / taşma sayfası sıfırlanır), sonra `PRAGMA wal_checkpoint(TRUNCATE)`
(WAL'daki eski çerçeveler gider). Şirket dosyası VE makine defteri için. Bakım turunun kesinleşen işte PDF satırını silmesi de (2.4.9 B3) secure_delete altında.
Denetim noktası YALNIZ bir şey silindiyse ve kısa bekleme süresiyle (200 ms; bağlantının önceki `busy_timeout`'u geri konur) denenir: dosya başka süreçte kilitliyken 10 sn
bekleyip olay döngüsünü tutmaz (dk11 İş N düzeni); kilitliyse WAL sonraki silmede / süpürmede boşalır. Süpürme şirket dosyasında 4.000 satırlık rowid pencereleriyle ilerler,
pencereler arasında olay döngüsüne sıra verir, denetim noktası turun sonunda bir kez.

## 3. Ne zaman
- **KVKK silme talebi** (yönetici, `system.manage`): Cari kartı → WhatsApp → "Gönderim Kayıtlarını Sil (KVKK)" → onay; ya da Yönetim → WhatsApp → "Gönderim Kayıtları ve
  KVKK" bölümünde cari aranır (telefonsuz / silinmiş telefonlu cari de bulunur) → aynı düğme. Uç `POST /api/workspace/whatsapp/kvkk-erase`
  `{ accountId, confirm: true }`. Sıra: (1) talep makine dosyasına yazılır (yazılamazsa 503, hiçbir şey silinmez — yarım silme açılışta tamamlanır); (2) şirket dosyasında o
  carinin BÜTÜN işleri (iki şablon, her toplu iş) tek işlemde: bekleyen işler (Bekliyor, Sınır, Duraklatıldı, Hazırlanıyor, Meta Bekletti; Lisans / açılışta sorulan =
  Duraklatıldı) "Atlandı — Silme Talebi" (S35); "Gönderiliyor" durumu korunur, içerik silinir (S42); öbürleri yalnız içerik; (3) makine defterinde o carinin ve o işlerin
  telefonu / wamid'i; (4) elle yol kayıtları; (5) secure_delete + checkpoint; (6) işlem geçmişine yalnız cari kimliği ve sayılar.
- **1 yıl dolumu**: başlangıç = işin SON gönderim denemesinin anı (`sending_at`), denemesi yoksa toplu işin açılış anı (`created_at`); bitiş = yerel saat diliminde aynı tarih ve saat
  bir yıl sonra (29 Şubat → 28 Şubat; an hassasiyeti). SQL ön süzgeci (başlangıç ≤ şimdi − 364 gün; işaretsiz) + aday satırda kesin denetim (toplu SQL, öğe başına ağır okuma yok —
  ders 47). Turlar: (a) açılışta (recover); (b) bakım turunda program saatiyle saatte bir (sahte saatte de); (c) BEKLEYEN işler için ayrıca önizleme / başlatma / yeniden deneme /
  Yine de Gönder öncesinde ve işçi işi ele almadan hemen önce (Y17-6 "dolum anında": dolmuş bekleyen iş "Zaten Kuyrukta" ile kimseyi elemez, gönderilmez). Bekleyen iş "Atlandı —
  Saklama Süresi". Makine defterinde aynı kural işin son talep anıyla.
- **Gönderiliyor anında talep (S42)**: içerik + telefon (şirket dosyası ve defter) HEMEN silinir; istek yanıtı gelince: kabul → wamid özetle yazılır ("gönderildi" izi), yanıtsız →
  Sonucu Belirsiz izi; yanıt yeniden gönderim gerektirirse (geçici hata 30 sn → 2 dk → 15 dk, Bağlantı Bekleniyor, 190, Meta Bekletti) iş o anda "Atlandı — Silme Talebi".
  Kabul edilmiş işe sonradan 131049 gelirse de aynı (yeniden deneme yok).
- **Geri yükleme / taşıma / sıfırlama sonrası (S32, S38)**: şirket kuyruğu açılırken (recover — geri yükleme toparlamasından SONRA, ilk istekten önce) makinedeki talepler şirket
  dosyasına yeniden uygulanır: o carinin talep anından ÖNCE açılmış (`created_at ≤ talep anı`) ve işaretsiz işleri silinir; bekleyenler önce §7a 26 ile "Durduruldu (Geri
  Yükleme)" olur, sonra içerik silinir (Y16-23). Talepten SONRA açılan iş kalır (Y16-22). 1 yıl kuralı aynı turda (Y15-18).

## 4. Silme talebi kaydı (makinede, yedek dışı)
Ana veri klasöründe ayrı dosya `whatsapp-silme-talepleri.sqlite` (makine defteriyle aynı klasör, ayrı dosya): `requests (company_id, account_id, at)` — birincil anahtar (şirket,
cari), aynı kişinin sonraki talebi öncekinin anını ilerletir. Şirket yedeğine (VACUUM INTO / ham güvenlik kopyası şirket dosyasınındır) GİRMEZ; geri yükleme ve sıfırlama ona
dokunmaz (S32). Veri klasörü yeni bilgisayara taşınınca (sürücünün `tasindi` olayı: gönderim defteri bilgisayara özgü kalır, öbür dosyalar gider) bu dosya da gider (S38);
zincirleme taşımada da. Yeni bilgisayarda yapılan talep aynı dosyaya eklenir.

## 5. Gönderim yollarındaki davranış
| Yol | Silinmiş Ekstre işi | Silinmiş Ödeme Hatırlatma işi |
|---|---|---|
| Başarısızları Yeniden Dene | kişi alınmaz, neden "İçeriği Silindi" (S31; E2 sırasından ÖNCE) | alınır; içerik ve telefon gönderim anında karttan (S37) |
| İşteki Yine de Gönder (Sonucu Belirsiz) | alınmaz ("İçeriği Silindi"; satırdaki düğme pasif + neden) | alınır; silinmiş içerik DEVRALINMAZ, gönderim anında karttan (S37) |
| Yeni toplu iş (R3 dahil) | iz R3 / Sonucu Belirsiz / dönem elemesinde silinmemiş kayıt gibi (S-W3, S36; İLKEYLE R3 Yine de Gönder açık) | aynı |
| Devam Et | bekleyen iş zaten Atlandı (S35) | aynı |
Kart telefonu da silindiyse gönderim anında "Telefon yok" (eligibility; kâhinde `telefonsuz`).

## 6. Nasıl bozulur? (testler bu listeden)
1. Talep anında iş Bekliyor / Sınır / Duraklatıldı / Meta Bekletti / Hazırlanıyor / Gönderiliyor / Sonucu Belirsiz / Teslim — her biri (S35, S42, S30).
2. Talepten sonra aynı kişiye aynı dönem yeni gönderim (kapanan iş "Zaten Kuyrukta" saymaz; R3 kalır; belirsiz eler).
3. Silinmiş Ekstre'ye Yeniden Dene / Yine de Gönder (S31); silinmiş Hatırlatma'ya (S37) — kart telefonu da silinmiş.
4. Gönderiliyor sırasında talep + Meta kabul / zaman aşımı / geçici hata / 131049 (S42).
5. 1 yıl sınırı ±1 sa, yerel gece yarısı ≠ UTC (iki TZ), 29 Şubat'ı geçen yıl, bekleyen iş 1 yılını doldurur + aynı dönem yeni gönderim (Y17-6).
6. Talepten ÖNCE alınmış yedek geri yüklenir (001 ve 002); talepten SONRA alınmış yedek (talepten sonraki içerik kalır).
7. Taşıma (defter yok) + eski yedek; zincirleme taşıma; yeni bilgisayarda yeni talep.
8. İki şirket: talep yalnız kendi şirketinin carisini siler; aynı cari kimliği öbür şirkette yok sayılır.
9. Silme yarıda kesilir (talep yazıldı, dosya yazılamadı) → açılışta tamamlanır; talep yazılamaz → 503, hiçbir şey silinmez.
10. Sızıntı: günlük, veri klasöründeki BÜTÜN dosyalar (şirket dosyası, WAL, makine defteri, talep dosyası) ve sonradan alınan yedek silinen telefonu / içeriği / wamid'i taşımaz.
11. Geç bildirim silinmiş işe gelir (özetlenmiş wamid eşleşir; teslim sayılır, içerik silinmiş kalır, pencere sayacı alıcıyı işin kimliğiyle sayar).
12. Ölçek: 100.000 iş satırında ilk süpürme (süre + olay döngüsü en çok; ders 47).
13. Eski defter (2.4.9 tetikleri) açılır → tetik yükseltilir; öbür UPDATE / DELETE yine reddedilir.
14. Yetkisiz kullanıcı (whatsapp.send ama yönetici değil) → 403; salt okunur lisans → 403 (BİLİNEN SINIR §8).

## 7. BAŞ MİMAR KARARLARI (ders 40; kullanıcıya gösterilir)
1. "Telefon silinir" wamid'i de kapsar: Meta'nın ileti kimliği alıcının numarasını kodlanmış taşır → SHA-256 özetine çevrilir (geç bildirim özetle eşleşir; kime / kaç kez aynı).
2. Kart adı da içerik sayılır: `wa_jobs.account_name` silinir; ekranlar adı cari kartından (o anki adı) gösterir.
3. Elle (wa.me) yolun kayıtları (`message_sends.phone`, `body`) da aynı kuralla silinir (aynı kişisel veri, aynı talep; R3 ve sayaç etkisi yok).
4. 1 yıl başlangıcı `COALESCE(sending_at, created_at)`; defterde işin son talep anı.
5. Talep dosyası ayrı makine dosyası (yedeğe girmez — S32; veri klasörüyle taşınır — S38). Yalnız yedek dosyasıyla yapılan taşımada talep gitmez → BİLİNEN SINIR.
6. Süpürme saatte bir + açılışta; bekleyen iş için ayrıca her başlatma / işçi adımı öncesinde (Y17-6 "dolum anında").

7. Meta Bekletti (131049) iken talep / dolumla kapanan işin bırakılmış denemesi R3'te sayılmaz (iptal edilmiş toplu işteki gibi — K7 düzeni; kâhin Y17-9): makine defterine
   `job_stops` satırı (yalnız eklenir); geç teslim gelirse sayılır.
8. Meta'daki PDF kopyası KULLANICI KARARI S3 A ile silinir (yalnız kesin sonuçta ya da kabulden 30 gün + 1 sa sonra): içeriği silinmiş Meta Kabul Etti / Sonucu Belirsiz işin
   kopyası erken silinmez (sürücünün "kesin öncesi medya silme" değişmezi; ilk denemede erken siliniyordu → geri alındı).

## 8. BİLİNEN SINIRLAR
- Salt okunur lisansta silme talebi uç düzeyinde 403 (genel yazma kapısı `lib/license.mjs` `allowedWhenReadOnly`; bu ajanın kapsamı dışı) — 1 yıl süpürmesi lisanstan bağımsız sürer.
  Kâhin S30-02 senaryosu bu yüzden GEÇERSİZ (talep oluşmadı). Öneri: kapıda `/api/workspace/whatsapp/kvkk-erase` salt okunurda da açık (veri silme, yeni iş üretmez).
- Talepten önce alınmış yedek dosyası diskte aynen durur (S32 kararı: geri yüklenince yeniden uygulanır). Yalnız yedek dosyasıyla (veri klasörü olmadan) yapılan taşımada talep
  dosyası gitmez → o kopyada talep uygulanmaz (S32 "yedeğe girmez" ile S38 "taşınır" arasında; veri klasörüyle taşımada uygulanır).
- 24 saatlik farklı alıcı sayacı: silinen kişinin talepleri işin kimliğiyle sayılır → aynı kişiye talepten sonra 24 saat içinde yeni ileti gidince o kişi iki alıcı sayılır (sayaç
  en çok birkaç kişi fazla, program Meta sınırından biraz ERKEN durur; ikinci ileti doğmaz). Telefon silindiği için başka yol yok (karar: telefon HEMEN silinir).
- Meta'daki PDF kopyası (Meta Kabul Etti / Sonucu Belirsiz silinmiş işte) Meta'nın 30 günlük ömrüyle düşer (S3 A).
- secure_delete eski sürümlerin serbest bıraktığı sayfaları geriye dönük sıfırlamaz (VACUUM yok — B3-4); erişilemez artık.
- Şirket Verisini Sıfırla / Şirketi Sil'in sildiği WhatsApp satırları secure_delete'siz (app.mjs; kapsam dışı).
- Cari kartının kendisi ve işlem geçmişi (audit_events: kartın açılış / düzenleme kaydı ad ve telefon taşır) karar gereği değişmez (TTK; kart ayrı olaydır).
