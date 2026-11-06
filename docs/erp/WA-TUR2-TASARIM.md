# WhatsApp Tur 2 — Tasarım Notu (2.5.0; bildirim yolu + KVKK)

Durum: KODDAN ÖNCE yazıldı (06.11.2026, tur 2 kod ajanı, taban 329d5d1b = WhatsApp tur 1 + W-3). Ders 46: WhatsApp ailesinde iki dar kontrol üst üste gerileme verdi
(kullanıcı S64 = A) → bu turda her değişikliğin komşusu DAR, her yeni yolun "kime kaç kez" etkisi aşağıda önceden yazılı. "Kime kaç kez" kuralı DEĞİŞMEZ; genel ilke (31.10)
(1)–(5) aynen. Yeni kural YOK; karar metinlerinin dışında kalan her seçim §11'de "BAŞ MİMAR KARARI GEREKİYOR" / "KULLANICIYA SORULMALI" diye ayrıldı (ders 40, 43, 45).

## 0. Kararlar (AYNEN, `docs/2.5.0-IS-LISTESI.md` D)
- **S58 = A**: WhatsApp bağlantı yolu (kip) değişince "bildirim yolu çalışıyor" işareti sıfırlanır.
- **S62 = A**: salt okunur lisansta KVKK silme talebi AÇIK.
- **S63 = A**: kanca kaydı WABA + uygulama başına; adres denetimi yalnız kendi uygulamasının satırı; S41 denetimi yalnız Elle Bağla şirketiyle.
- **S64 = A**: tek tur 2 (tur 1 dk ORTA-1 + DÜŞÜK-2, S58, S62, S63, W-3 dk bulguları; sahte Meta'ya iki uygulamalı vekil; dk betikleri teste).
- **BAŞ MİMAR KARARLARI 06.11 12:33 (W-3 dk)**: ORTA-4 → A (KVKK araması Silinenler'deki ama WhatsApp kaydı olan carileri de bulur); DÜŞÜK-1 (PDF hücresi) + MX3 (scrubDigits testi) →
  bu turda test.

## 1. İş 1 — tur 1 dk ORTA-1: v2.4.9'un WABA düzeyi `hook_seen` satırı yükseltmeden sonra okunuyor
- Yol: `server/lib/whatsapp/queue.mjs:1938–1943` (maintain): `seen = max(ledger.hookSeenAt(WABA), şirket işareti)`. Tur 1'den beri kanca `hook_seen` YAZMAZ, ama v2.4.9'un yazdığı
  satır (wamid'i tanınmayan / imzasız / başka şirketin bildirimi de koyuyordu) yükseltmeden sonra 7 gün "bildirim yolu çalışıyor" sayılıyor → teslim bilgisi gelmeyen iş TTL + 1 sa'te
  "Süresi Doldu" → almış olabilecek kişi aynı dönemde "gönderilecek".
- Değişiklik: bakım turu YALNIZ şirket işaretini okur (`ledger.hookSeenAt` çağrısı kalkar; defter tablosu ve yazıcı işlevi dokunulmadan kalır — eski veri okunmaz, silinmez).
- Kime kaç kez: ilke 2 (almış olabilir → elenir). v2.4.9 verisinde tanınan bildirim alan şirketin işareti şirket ayarında zaten var (v2.4.9 `applyStatuses` de yazıyordu) →
  tek şirkette gerçek bildirim alan kurulumun davranışı aynı; yalnız tanınmayan / başka şirketin bildirimi artık işaret saymaz (S33 / S43'ün eski veriye uygulanması).
- Test: v2.4.9 GERÇEK koduyla programın kendi API'sinden üretilmiş veri (fikstür `test/fixtures/whatsapp-kanca-v249-tek`, üretim betiği `uret.mjs.txt`; dk betiği f1 kalıbı) → yeni kodla
  13,5 sa sonra bakım turu → iş "Meta Kabul Etti", önizleme "Daha Önce Gönderildi".

## 2. İş 2 — S58: kip değişince işaret sıfırlanır
- Bugün: işaret şirket ayarı `whatsapp.hookSeen` (an); `queue.mjs:2287` (`applyStatuses` başı) yazar; kipten habersiz.
- Değişiklik (en dar):
  1. `applyStatuses` işaretle birlikte o anki kipi de yazar: `whatsapp.hookSeenMode` = `manual` | `embedded` (yalnız değişince). Kanca `applyStatuses`'ı yalnız şirketin kipine göre
     kabul edilen bildirimde çağırır (`hook.mjs:311`, aynen) → kip o an bilinir.
  2. `connection.mjs` `save` (Elle Bağla, `:289`) ve `saveEmbedded` (WhatsApp'ı Bağla, `:332`): yeni kip işaretin kipinden farklıysa işaret ve kipi silinir. İşaretin kipi yoksa
     (v2.4.9 / tur 1 verisi) önceki bağlantının kipi sayılır; önceki bağlantı da yoksa (Bağlantıyı Kaldır sonrası yeniden bağlama) kip BİLİNMİYOR → silinir (güvenli yön, ilke 2).
  3. ~~`maintain` işaretin kipi şimdiki kipten farklıysa işareti saymaz~~ — UYGULAMADA KALDIRILDI (06.11, kodlama sırasında): kip yalnız `save` / `saveEmbedded`'de değişir; geri
     yüklenen / taşınan dosyada işaret, kipi ve bağlantı birlikte gelir (tutarlı). Bu ikinci kilide giden bir yol yok → testle ölçülemeyen (mutantı yakalanamayan) savunma kodu
     yazılmadı.
- Her iki yön (Yol 1 → Yol 2, Yol 2 → Yol 1), geri dönüş (Yol 1 → Yol 2 → Yol 1: eski işaret DİRİLMEZ), aynı kipte Bilgileri Değiştir (işaret KALIR — karar yalnız kip der),
  Kaldır + başka kiple bağla (silinir), Kaldır + aynı kiple bağla (işaretin kipi kayıtlıysa KALIR; kip bilinmiyorsa silinir).
- Kime kaç kez: işaretin silinmesi güvenli yöndür (iş "Meta Kabul Etti"de kalır, kişi "Daha Önce Gönderildi", R3 "Yine de Gönder" açık — ilke 2 + 4). Yeni yolun ilk tanınan
  bildirimi işareti yeniden koyar (tur 1 kuralı aynen).
- Yedek / geri yükleme / sıfırlama / taşıma (ilke 5): iki ayar da `whatsapp.` önekinde — bağlantıyla AYNI dosyada, aynı kuralla gelir / korunur (KEEP_SETTINGS "whatsapp"); geri
  yüklenen dosyada işaret ve kipi bağlantısıyla tutarlıdır. Şirket dosyasına yeni yazım yalnız `applyStatuses`'ın zaten yazdığı yerde (kapılı şirkete kanca zaten yazmaz — BS-7).
- Test: kısa teslim süreli şablon (12 sa, Meta listesinde) ile; her yön + geri dönüş + aynı kip + Kaldır/yeniden bağla.

## 3. İş 3 — S63: kanca kaydı WABA + UYGULAMA başına
### 3.1 Uygulama kimliği
- Meta'da alternatif adres (WABA, uygulama) başına tektir. Programda uygulama = bağlantının KİPİ: Elle Bağla (`manual`) = müşterinin kendi Meta uygulaması, WhatsApp'ı Bağla
  (`embedded`) = DestekOfis uygulaması (karar metni S63 de iki uygulamayı iki kiple anlatır). Belirteçten uygulama kimliği OKUNAMAZ (`meta-graph.mjs:496` D0-W5-4: debug_token uygulama
  belirteci ister); Elle Bağla'daki App ID isteğe bağlı ve elle yazılır (yanlış / boş olabilir) → anahtar olarak KULLANILMAZ.
- BİLİNEN SINIR (§11 B1): aynı WABA'yı Elle Bağla ile iki FARKLI müşteri uygulamasından bağlayan iki şirket tek kaydı paylaşır (bugünkü davranış; çok uç).
### 3.2 Defter (`server/lib/whatsapp/defter.mjs`; göç numarası YOK — makine defteri, şirket dosyası değil)
- `hook_events`'e `app TEXT NOT NULL DEFAULT ''` sütunu (yeni defterde CREATE'te; eskisinde açılışta tek `ALTER TABLE … ADD COLUMN` — yalnız eklenir tetikleri UPDATE / DELETE'e
  bakar, ALTER etkilenmez). Yeni olaylar `manual` / `embedded` yazılır.
- `hookOf(WABA, app)`: o uygulamanın son olayı. `hookOf(WABA)` (uygulamasız; S41 "kaydı olan WABA" denetimi) her uygulamanın son olayı — anlamı aynen.
- `hookByPath(karma)`: karma bir (WABA, uygulama) kaydının GEÇERLİ yolu ise o kayıt (yenilenmiş / eski yol → null, aynen).
- `requestedAt` / `registeredAt` (WABA, yol) ile okunur (yol 32 baytlık rastgele — uygulamalar arasında çakışmaz).
### 3.3 Eski kayıtların göçü (WABA başına tek kayıt → WABA + uygulama)
- Eski satırlar `app = ''`. İlk kullanımda (bildirim / bakım turu; açılış taramasından SONRA — ortak kayıt her şirketin kipini deftere yazmıştır, `hub.mjs` noteMode) WABA'nın eski
  dizisinin sahibi kararlaştırılır ve deftere YAZILIR (`meta` "hookLegacy:<WABA>"; bir kez — sonra kip değişse de karar değişmez):
  - defterde bu WABA için bilinen kiplerin HEPSİ `embedded` → eski dizi `embedded`'in;
  - kiplerin hepsi `manual` ya da hiç kip bilinmiyor → `manual`'ın (BAŞ MİMAR KARARI WY (1): kipi bilinmeyen bağlantı Yol 1; 2.5.0'dan önce Yol 2 ileti gönderemezdi);
  - iki kip birden (S63'ün kendisi: v2.4.9'da iki uygulama tek kaydı eziyordu, son kaydeden bilinmez) → `mixed`: eski dizi hiçbir uygulamanın değil → iki uygulama da ilk bakım
    turunda HEMEN kendi adresini kaydeder (kayıt yokken bekleme yok — `connection.mjs:738`); bu arada eski dizinin son yolu, iki uygulamadan biri kendi kaydını yazana dek geçerli
    sayılır (Meta'nın o anda gönderdiği bildirim düşmez).
  - Karar yazılamazsa (defter başka süreçte kilitli — kısa sınama) bellekte hesaplanır, sonraki kullanımda yeniden yazılmaya çalışılır.
- Sonuç: v2.4.9'da tek şirket Elle Bağla (gerçek kurulumların tamamı) → eski yol aynen çalışır, Meta'ya yeni kayıt gitmez.
### 3.4 Bağlantı (`server/lib/whatsapp/connection.mjs`)
- `hookView` (`:654`), `registerHook` (`:682`; "arada başka kayıt" denetimi kendi uygulamasının kaydına), `ensureHook` (`:723`), `forgetHook` (`:446`), `hookMatches` / `verifyMatches`
  (`:768`) kendi uygulamasının (kipinin) kaydını okur / yazar.
- **Adres denetimi yalnız kendi uygulamasının satırı**: `GET /<WABA>/subscribed_apps` yanıtındaki satırlardan yalnız BU uygulamanın kaydındaki yolu taşıyan satır "bizim" sayılır.
  Yol rastgele 32 bayttır ve Meta'ya yalnız bu uygulamanın belirteciyle yazılır → başka uygulamanın satırı bu yolu taşıyamaz. Meta'nın listeleme davranışı DOĞRULANMADI: (hepsi)
  WABA'ya abone bütün uygulamaları döndürür / (kendi) yalnız çağıranınkini — iki modelde de karar aynı: kendi yolu varsa "Kayıtlı", yoksa kendi belirteciyle yeniden kaydeder
  (başka uygulamanın adresi değişmez). Bugünkü kod tek kayıtla karşılaştırıyordu: (hepsi) öbür uygulamanın satırı "bizim" sanılıyordu, (kendi) öbürünün yolu bizimki sanılıp
  yeniden kaydediliyor ve öbürü 404'e düşüyordu.
### 3.5 S41 (`server/lib/whatsapp/hook.mjs:141` recheckAddress)
- Uygulama düzeyi adres yalnız Elle Bağla'nın (müşterinin uygulamasının) panel ayarıdır → Meta'daki adres yalnız Elle Bağla (`manual`) şirketinin bağlantısıyla yeniden denetlenir.
  Uygun Elle Bağla şirketi yoksa denetim yapılmaz (günlük; bakım turu yine dener). Bildirimin İŞLENMESİ aynen (Yol 1 imzasız kabul, Yol 2 yalnız imzalı).
- `app-webhook.mjs`'e DOKUNULMAZ (birleşik tur 5'in dosyası; S63 için gerekmedi).
### 3.6 Kime kaç kez
- İki uygulamanın teslim bilgisi artık kaybolmaz (404 yok) → teslim edilen iş "Teslim Edildi", kişi "Daha Önce Gönderildi" (ilke 3). Kayıt / denetim yalnız kendi uygulamasının
  Meta adresine dokunur. İşaret kuralı (tur 1 + S58) değişmez.
### 3.7 Sahte Meta düzeneği
- `test/whatsapp-sahte-graph.mjs`'e iki uygulamalı vekil (dk betiği f2'nin vekili): belirtece göre uygulama, `subscribed_apps` uygulama başına; `LIST` = `hepsi` | `kendi`.
  Öbür istekler programın sahte Graph'ına geçer. (Aynı el — kâhin DEĞİL, ders 5.)

## 4. İş 4 — S62: salt okunur lisansta KVKK silme talebi açık
- Yol: `server/lib/license.mjs:68` `READ_ONLY_ALLOWED`'a YALNIZ `^/api/workspace/whatsapp/kvkk-erase$` (tam yol; sorgu dizgesi yolun parçası değil). Başka hiçbir uç açılmaz;
  şema kapısı (BS-7, `app.mjs` assertSchemaWritable) aynen çalışır (kapılı şirkette 409).
- Kime kaç kez: talep yeni iş / ileti ÜRETMEZ; bekleyen iş "Atlandı — Silme Talebi" (S35), sayaçlar azalmaz. Salt okunurda gönderim başlamaz (aynen).
- Test: salt okunurda talep 200 + içerik / telefon silinir; aynı oturumda toplu gönderim, önizleme, Bildirim Yolu kaydı, bağlantı kaydı hâlâ 403 LICENSE_READ_ONLY.

## 5. İş 5 — W-3 dk ORTA-1: defter anonimleştirmesi düşerse yeniden denenir
- Bugün (`queue.mjs:1016` anonymizeLedger): düşerse günlük; talep makinede olduğu hâlde `reapplyRequests` (`:1066`) yalnız DOSYADA henüz silinmemiş işleri deftere verir → defterdeki
  telefon / açık wamid kalır. `:1609` S42: istek sürerken silinen işin kabulü yalnız DEFTERDEN "silindi mi" diye bakıyor → defter yazılamadıysa açık wamid dosyaya ve deftere yazılıyor.
- Değişiklik:
  1. Defter: `pendingAnonJobs(şirket, cari, an, ekİşler)` — o carinin talep anından önceki (ilk talebi ≤ an) ve verilen işlerden telefonu / wamid'i hâlâ açık olanlar (toplu SQL, iş
     başına okuma yok — ders 47).
  2. `reapplyRequests` her talep için: dosyada talep anından önce açılmış BÜTÜN işler (silinmiş olanlar dahil) ∪ defterdeki işleri → açık kalanları `anonymizeJobs`'a (eşgüçlü).
  3. Bakım turu: anonimleştirme düştüyse (bayrak) sonraki turda aynı yeniden uygulama (yalnız defter; dosya kuralı aynen), talepler arasında olay döngüsüne sıra verilir.
     UYGULAMADA DEĞİŞTİ (06.11, ölçüm — ders 47): "ayrıca saatte bir" KALDIRILDI — 200 talep × 500 işte bayraksız saatlik yeniden uygulama olay döngüsünü 1.332 ms tutuyordu
     (docs/kanit/2026-11-06/watur2-olcum). Bayrak düşmüş her yazımı kapsar; program yeniden açılırsa açılıştaki reapplyRequests aynısını yapar.
  4. S42: `erasedInFlight` = defter (`jobAnonymized`) ∪ dosya (`erasedOf(params_json)`; dosya okunamazsa yalnız defter).
  5. Saklama süpürmesi: dosyada içeriği silinmiş ama `wamid`'i özet olmayan satırlar (bugünkü kodun ürettiği veri) özetlenir — aynı satır numarası penceresi içinde.
- Kime kaç kez: değişmez (yalnız telefon / wamid biçimi; sayaç alıcıyı işin kimliğiyle sayar — W-3 aynen; geç bildirim özetle eşleşir).
- Test: dk e2 kalıbı (programın kesinti kancası `whatsappLedgerFault "anonymize"`): talep anında defter yazılamaz → yeniden açılış (`recover`) ve bakım turundan sonra defterde ve
  dosyada telefon / açık wamid 0 (bayt taraması: veri klasörünün BÜTÜN dosyaları, WAL dahil).

## 6. İş 6 — W-3 dk ORTA-2: silinmiş işe SONRADAN yazılan hata metni
- Bugün: `eraseJobs` (`queue.mjs:979`) talep anındaki metni `scrubDigits`'ten geçirir; sonra `failJob` / `retryLater` / `applyStatuses` / toparlama (`updateJob`, `:205`) metni AYNEN yazar.
- Değişiklik: `updateJob` `error_text` yazarken satırın içeriği silinmişse (`params_json LIKE '{%'`, aynı UPDATE içinde SQL CASE — ek okuma yok, yarış yok) metni `scrubDigits`'ten geçirir.
  Bütün yazım yolları `updateJob`'dan geçer (eraseJobs zaten temizler).
- Test: e3 (a) S42 + Meta hatası (ayrıntıda "+90 532 111 22 33"), (b) kabul + talep + sonra `failed` bildirimi (ayrıntıda "905334445566"); ayrıca tireli / parantezli biçimler; MX3
  (scrubDigits etkisiz) yakalanmalı.

## 7. İş 7 — W-3 dk ORTA-3: denetim noktası düşerse yeniden denenir
- Bugün: `saklama.mjs:117` checkpoint dosya başka bağlantıda okunurken düşer (200 ms), sonuç atılır; sonraki silmeye kadar WAL / ana dosyada eski sayfa kalır.
- Değişiklik: şirket kuyruğu (`queue.mjs`) ve defter (`defter.mjs`) sonucu bayrakta tutar; bakım turu bayrak varsa yeniden dener (dosya + defter), başarıda bayrak iner. Bayraksız turda
  denetim noktası YOK (tasarım W-3 §2: yalnız bir şey silindiyse).
- Test: e8 kalıbı — dış okuyucu (açık okuma işlemi) varken talep → okuyucu kapanınca BİR bakım turu sonra veri klasöründe (ana dosya + WAL) silinen telefon 0.

## 8. İş 8 — W-3 dk ORTA-4: KVKK araması Silinenler'deki carileri de bulur
- Yeni dar uç `GET /api/workspace/whatsapp/kvkk-deleted?q=` (WhatsApp yönlendiricisinde; `routes/accounts.mjs`'e DOKUNULMAZ), yetki `system.manage`: Silinenler'deki (deleted_at
  dolu) VE WhatsApp kaydı (wa_jobs ya da message_sends) olan cariler; eşleşme cari aramasının kuralıyla (ad / not … küçük harf tr-TR; telefon rakamla ≥ 3 hane; Cari No tam). Yanıt
  { id, name, refNo, deleted: true } — telefon YANITA GİRMEZ. En çok 10.
- İstemci (`hof-whatsapp-ayar.js` findKvkk): var olan cari araması + bu uç; silinmiş satırda "Silinenler'de" etiketi, kart bağlantısı YOK, yalnız "Gönderim Kayıtlarını Sil (KVKK)".
- Ders 47: silinmiş cariler üzerinde tek SQL (EXISTS dizinli: idx_wa_jobs_account, idx_message_sends_account), eşleşme bellekte yalnız silinmiş + kaydı olan carilerde.
- Test: e4 kalıbı + yetki (Muhasebe / Avukat / Personel 403; uç ve talep).

## 9. İş 9 — test boşlukları (prensip §4)
- Tur 1 dk DÜŞÜK-2: defter kilitli (kısa sınama false) + kaydı olmayan WABA'nın uygulama düzeyi bildirimi → 200, Meta'ya istek yok; M12 ("kaydı olan WABA" denetimi kalkar) → 503 ile
  yakalanır.
- W-3 dk DÜŞÜK-1: talep anında hazırlanmış (PDF'i dondurulmuş) açık işin `wa_job_pdfs` satırı silinir; MX2 yakalanır.

## 10. KVKK sızıntı denetimi (her iş)
- Telefon / içerik / açık wamid hiçbir dosyada (şirket dosyası + WAL, makine defteri + WAL, talep dosyası), yedekte, günlükte: İş 5–7 testleri veri klasörünün bütün dosyalarında ham bayt
  arar. Yeni ayar `whatsapp.hookSeenMode` kişisel veri taşımaz; `hook_events.app` yalnız kip; KVKK araması yanıtına telefon girmez; günlük iletilerine numara / wamid yazılmaz (yalnız sayı
  ve kod). Fikstürler yalnız test verisi (sahte ad / numara) ve gizli anahtar dosyası (secret.key) TAŞIMAZ.

## 11. Nasıl bozulur? (testler buradan)
1. v2.4.9 defterinde tanınmayan wamid'in `hook_seen`'i → 13,5 sa sonra iş "Süresi Doldu" OLMAZ (İş 1).
2. Yol 1 işaretli → Yol 2 → kısa teslim süreli iş TTL + 1 sa sonra "Meta Kabul Etti"; ters yön; geri dönüş; aynı kip (işaret kalır); Kaldır + bağla (iki kip) (İş 2).
3. İki şirket aynı WABA, iki uygulama (hepsi / kendi): kayıt, Bağlantıyı Sına, bakım turu (1 sa sonra), S41 (uygulama düzeyi) — her adımdan sonra iki şirketin teslimi 200; Meta'ya
   giden kayıt / okuma yalnız ilgili uygulamanın belirteciyle (İş 3).
4. S41'de Elle Bağla şirketi denetleyemiyor (belirteç süresi dolmuş) → WhatsApp'ı Bağla şirketiyle DENETLENMEZ (Meta'ya B belirteciyle istek yok) (İş 3).
5. v2.4.9 tek şirket Elle Bağla defteri → eski yol 200, Meta'ya yeni kayıt yok (iki modelde); v2.4.9 iki şirket iki uygulama → ilk bakım turundan sonra iki şirketin teslimi 200 (iki modelde) (İş 3).
6. Salt okunur: talep 200 + silinir; toplu gönderim / önizleme / kanca kaydı / bağlantı 403; kapılı şirkette 409 (İş 4).
7. Talep anında defter yazılamaz (teslim edilmiş iş + istek sürerken iş) → yeniden açılış / bakım turu sonrası defterde ve dosyada telefon / açık wamid 0; dosyada silinmiş ama açık
   wamid'li eski satır süpürmede özetlenir (İş 5).
8. Silinmiş işe sonradan hata metni (S42 hatası, failed bildirimi, geçici hata) → numara "…" (boşluklu, tireli, parantezli) (İş 6).
9. Dış okuyucu açıkken talep → okuyucu kapanınca bir bakım turunda WAL / dosya temiz (İş 7).
10. Silinmiş cari KVKK aramasında (ad, telefon); yetkisiz 403; telefon yanıtta yok (İş 8).
11. Kilitli defter + kaydı olmayan WABA → 200; açık işin PDF'i talepte silinir (İş 9).
12. İki saat dilimi (UTC, Europe/Istanbul) — sahte saat; gece yarısı / yıl dönümü bu turun kuralı değil (W-3 testleri aynen).

## 12. Ölçüm (ders 47)
- 100.000 iş + 100.000 defter satırında: bakım turu (yeniden anonimleştirme + denetim noktası denemesi + özet süpürmesi) ve KVKK araması — yanıt süresi + olay döngüsü en çok;
  `flock scratchpad/olcum.lock`.

## 13. Windows (ders 48)
- Dosya silen / taşıyan / kilitleyen yeni test: fikstürler geçici klasöre açılır (removeTestDir); dış okuyucu (İş 7) dosyayı salt okunur açar, kapanmadan silinmez. Raporda listelenir.

## 14. Seçimler (ders 40, 43, 45) — rapora
- BAŞ MİMAR KARARI GEREKİYOR: B1 uygulama = kip (§3.1); B2 eski kayıt göçünün sahibi (§3.3); B3 S58'de Kaldır sonrası kip bilinmiyorsa silinir (§2); B4 adres denetiminde "kendi
  satırı" yolla tanınır, App ID ile değil (§3.4).
- KULLANICIYA SORULMALI (uç durum; "kime kaç kez"): aynı kipte WABA değişince (Bilgileri Değiştir ile başka WhatsApp hesabı) işaret sıfırlanmıyor — S58 yalnız kip der; seçenekler
  §rapor. W-2 Bağlantıyı Kaldır'ın "aynı WABA başka şirkette bağlı" denetimi uygulamayı ayırmıyor (başka uygulamadaki şirket yüzünden müşterinin uygulamasının aboneliği Meta'da
  korunuyor — veri tarafı; kime kaç kez değil).
