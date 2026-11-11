# WhatsApp Tur 3 — Tasarım Notu (2.5.0; S70, S71, S90 + beş küçük iş)

Durum: KODDAN ÖNCE yazıldı (11.11.2026, tur 3 kod ajanı, taban 1f136bb6 = çalışma dalı ucu). Kapsam yazılı listeyle SINIRLI (kullanıcı 06.11 18:53 notu: "tur 3 kapsamı yazılı listeyle
SINIRLI … yeni kapsam eklenmez"; S115 = A ile hatırlatma tutarlarının tek kuyruğa geçmesi ÇIKARILDI). "Kime kaç kez" kuralı DEĞİŞMEZ; genel ilke (31.10) (1)–(5) aynen. Karar metinlerinin
dışında kalan her seçim §11'de "BAŞ MİMAR KARARI GEREKİYOR" / "KULLANICIYA SORULMALI" diye ayrıldı (ders 40, 43, 45).

## 0. Kararlar (AYNEN, `docs/2.5.0-IS-LISTESI.md` D)
- **S70 = A**: "K1′ genel — Atlandı olmuş işe geç teslim gelirse her Atlandı sırasında "Teslim Edildi" (zincir işin eski belirsiz iletisi; İstemiyor / Şüpheli Alacağı Var nedeniyle atlanan
  Meta Bekletti işinin 1. iletisi dahil)." Baş mimar Y20-3: J10 ile "Daha Önce Gönderildi" olan işin öbür eski denemesine geç teslim de "Teslim Edildi".
- **S71 = A**: "içeriği ve kart telefonu silinmiş Ödeme Hatırlatma işinde "Yine de Gönder" → kişi "Telefon Yok" nedeniyle alınmaz, iş Sonucu Belirsiz kalır." Baş mimar Y20-10, Y20-15,
  Y20-16, Y20-17.
- **S90 = A**: "kip değişince sıfırlanan bildirim yolu işaretini yalnız şirketin ŞİMDİKİ kipinin uygulamasının adresinden (Yol 1'de uygulama düzeyi adres dahil) gelen bildirim koyar; eski yolun
  geç bildirimi işi yine 'Teslim Edildi' yapar".
- **BAŞ MİMAR KARARI 06.11 13:50 (1)**: salt okunur lisansta Webhook çifti üretilmez (bağlantı satırı + API düzeyi hücre).
- **BAŞ MİMAR KARARI 06.11 15:25 WT2-7**: Bağlantıyı Kaldır'ın "aynı WABA başka şirkette bağlı" denetimi yalnız AYNI KİPTEKİ şirketlere bakar (abonelik uygulama başınadır — WT2-1).
- **KAYIT 06.11 16:10 (b)** T16 ürün yarışı (ORTA) + kırılgan test kalıpları; **KAYIT 06.11 18:47** dar kontrol DÜŞÜK-1 / DÜŞÜK-2.

## 1. Bugünkü kod — yeniden üretim (ders 6; sayılar `docs/kanit/2026-11-11/watur3-*`)
- Program ↔ kâhin (sürücü, tam küme, hızlı uç, imzalı kip, `TZ=Europe/Istanbul`, kod = taban 1f136bb6): 398 senaryo — 28 geçen, 367 fark, 3 GEÇERSİZ. S70 / S71 / R3T / SW3-03 / S61-02:
  - S70-01: SÜRÜCÜ HATASI "sil F: 409 account-has-movements" (sürücünün "cari silindi" eşlemesi hareketli cariyi silemiyor — KISI-10 ile aynı, eski sınıf).
  - S70-02: davranış farkı yalnız SP'de ("Şüpheli Alacağı Var" gönderim anı elemesi programda YOK — S16 / S17 → Ç5 işi, bu turun kapsamı dışı) + 24 saat sayacı (W-3 BİLİNEN SINIR) + G1 gösterim.
  - S70-03: zincir işleri (ZS Silme Talebi, ZI İstemiyor) eski belirsiz iletinin geç teslim / okundu bildiriminden sonra "Atlandı" KALIYOR (beklenen Teslim Edildi / Okundu) — S70'in (b) sırası.
  - S70-04: SÜRÜCÜ HATASI "sürücü bu Meta yanıtını bilmiyor {gec …}" (S-84 gecikmeli yanıt eşlemesi yok — S42-01…04, S60-01 ile aynı, eski sınıf).
  - S70-05: J10'un ANINDA "Atlandı" olması (kâhin) ↔ programda gönderim anında (eski KÂHİN-YORUMU sınıfı "ara gösterim", J10-02 / J10-03 ile aynı); toplu iş Devam Et'e dek duraklatılmış kalıyor.
  - S70-06: yalnız K1 ara medya silme sayısı (eski ara gösterim sınıfı; son sayı aynı) + G1.
  - S71-01 / S71-02, R3T-01, SW3-03, S61-02: "Telefon Yok" / R3 uyarı yaprakları BUGÜNKÜ programla tutuyor (uygunluk denetimi işteki Yine de Gönder'de de E2 / F1 / K5'ten ÖNCE — `queue.mjs`
    plan, `eligibility` ilk). Kalan farklar W-3 24 saat sayacı, duraklatılmış zincir toplu işi, sürücünün Başarısızları Yeniden Dene hedefi (eski sınıflar) + G1.
- S90: dar kontrol betiği f1 (kopyası `scratchpad/watur3-dk/`), taban kodu, `TZ=UTC`: gec → J2 expired + "gönderilecek" (çıkış 1); kontrol → accepted + "Daha Önce Gönderildi" (çıkış 0); yeni (Yol 1'in kendi
  adresine) → expired (beklenen — şimdiki kipin adresi).
- T16 ürün yarışı: `test/whatsapp-t16-zorla.mjs urun`, taban, `TZ=UTC`: imzalı delivered → satır delivered; istek zaman aşımına düşünce satır "uncertain", ekranda "Sonucu Belirsiz"; Yine de Gönder 400
  ("Daha Önce Gönderildi: 1" — çıkmaz); defter teslimi 1, Bu Ay 1 (kime kaç kez bozulmuyor).

## 2. İş 1 — S70 (Atlandı işe geç teslim — her sırada)
- Bugün: satır yolu (`queue.mjs` applyStatuses, işin KENDİ wamid'i) Atlandı işi Teslim Edildi yapıyor (S59). Ulaşmayan sıralar:
  (b) zincir işi (işteki Yine de Gönder'in açtığı iş, `inherit_of`) Atlandı, teslim KAYNAĞIN (asıl işin) eski denemesine gelir — kaynak satırı Teslim Edildi olur, zincir işi Atlandı kalır;
  (c) işin SON denemesi olmayan eski denemesine teslim ("old" yolu, `applyOldAttempt`) — yalnız defter; satır Atlandı kalır (S42 ile 2. denemesi atlanan Meta Bekletti işi);
  (d) J10 ("Daha Önce Gönderildi" — gönderim anında kaynağın teslimi yüzünden) olmuş zincir işinin ÖBÜR kaynak denemesine teslim.
- Değişiklik (tek yardımcı `settleSkippedChain(jobId, value, at, { fresh, self })`): bir işin (X) denemesine delivered / read tanındığında (satır, eski deneme, yalnız defter yolları) —
  - X'in kendisi (yalnız satır yolu DIŞINDA; satır yolu X'i zaten yürütür) ve X'ten türeyen zincir işleri (aynı carinin `inherit_of` zinciri; dizinli `idx_wa_jobs_account` okuması — ders 47,
    tablo taraması YOK): durumu **Atlandı** olan → "Teslim Edildi" / "Okundu" (S59 düzeni AYNEN: sent_at, delivered_at / read_at, closed_at, hata kodu / metni temizlenir; `skip_reason` satırda iz
    olarak kalır — S59 ile aynı), YALNIZ bu teslim o deneme için YENİ ise (`deliveredAttempt` yazımdan ÖNCE okunur — Y20-3: aynı denemeye yinelenen bildirim yeni teslim değildir);
  - bu kuralla Teslim Edildi olmuş iş (durum delivered + `skip_reason` dolu) aynı zincirin read'iyle "Okundu"ya ilerler (yalnız ileri).
  - İptal / Durduruldu / Başarısız / Süresi Doldu / Sonucu Belirsiz zincir işleri DEĞİŞMEZ (Y20-5 kapsam dışı). failed bildirimi hiçbir şeyi değiştirmez.
  - Defter YAZILMAZ (teslim kaynağın denemesine zaten yazılıyor); toplu iş Tamamlandı'ya geçebilir (finishIfDone), ekran tazelenir.
- Kime kaç kez: (1) yeni ileti yok, iş gönderime dönmez; (2) değişmez; (3) teslim defterde kaynak denemesine — R3 "Daha Önce Gönderildi", "Bu Ay" +1 (değişmez); (4) yol R3 Yine de Gönder; (5) taşınan /
  geri yüklenen veride aynı kural (satır dosyada ise).
- KALAN (kodlanmaz — §11 B1): J10'un anı (kâhin: kaynağın ilk teslimi anında Atlandı; program: gönderim anında) ve İKİ kaynak denemesi de gönderim ANINDAN önce teslim edildiyse programın son durumu
  "Atlandı — Daha Önce Gönderildi", kâhininki Teslim Edildi.

## 3. İş 2 — S71
- Bugün DOĞRU (yeniden üretim §1: S71-01 / 02 "Telefon Yok", iş Sonucu Belirsiz; YB'nin telefonu girilince alınıyor). Kod DEĞİŞMEZ; karar tablosu hücresi + mutant (kişi alınır; telefon denetimi F1 /
  K5'ten SONRA) ile kilitlenir. İlke 4 (çıkmaz yok): kalan yol = kart telefonu yeniden girilince işteki Yine de Gönder (ya da yeni gönderim) — testte ölçülür.
- Y20-15 / Y20-16 (R3 uyarısı telefonsuz kişiyi sayar, son tarih ondan, tek başına uyarı): program bugün böyle (R3T-01 davranış farkı 0). Y20-17 bugünkü davranış kalır (dokunulmaz).

## 4. İş 3 — S90 (işareti yalnız şimdiki kipin uygulamasının adresi koyar)
- Kanca (`hook.mjs`): bildirimin geldiği adresin uygulaması `via` — alternatif adreste kaydın uygulaması (`hookByPath` → `app`: `manual` | `embedded`; tur 2 öncesi tek kaydın 'mixed' sahibi →
  `''`), uygulama düzeyi adreste `manual` (Elle Bağla'nın uygulaması). `deliver` → `applyStatuses(…, { via })`.
- `queue.mjs` applyStatuses: işaret ve kipi YALNIZ `via` şirketin şimdiki kipinin uygulamasıysa (`hookAppOf(record.mode)`) yazılır; `via` verilmemiş iç çağrı (test / araç) eskisi gibi. Durumların
  işlenmesi (Teslim Edildi, R3, Bu Ay) DEĞİŞMEZ.
- İLKEYLE (ilke 2): 'mixed' eski tek kaydın yoluna gelen bildirim hangi uygulamanın olduğu bilinmediği için işaret KOYMAZ (güvenli yön; iki uygulama ilk bakım turunda kendi kaydını yazar).
- Kime kaç kez: işaretin konmaması güvenli yön (iş Meta Kabul Etti'de kalır, kişi "Daha Önce Gönderildi", R3 Yine de Gönder açık — ilke 2 + 4).
- UYGULAMADA (11.11, komşu koşusu): tur 1'in iki hücresi bu kararla çelişti — T1-7 (001 Elle Bağla'nın bildirimi 002'nin WhatsApp'ı Bağla adresinden; tek yollu eski düzenek) ve T1-10
  (Yol 2'de uygulama düzeyi adrese İMZALI bildirim → işaret). Karar metni AYNEN uygulandı: öbür uygulamanın adresi işaret koymaz (T1-7'de 001'in kendi teslimi artık kendi adresinden;
  öbür adresten gelen ayrı adım: Teslim Edildi, işaret yok); uygulama düzeyi adres yalnız Yol 1'in → T1-10'da imzalı bildirim Teslim Edildi, işaret YOK. BAŞ MİMAR KARARI GEREKİYOR
  (teyit): B seçeneği — imzalı (DestekOfis sırrıyla doğrulanmış) uygulama düzeyi bildirimi Yol 2'nin sayılır (T1-10 eski beklentisi); pratikte Yol 2'de bu adrese bildirim gelmez.

## 5. İş 4 — salt okunur lisansta Webhook çifti üretilmez
- `routes/whatsapp.mjs` app-webhook ucu: `reveal(publicUrl, { writable: writable() })` (tek satır). Var olan çift gösterilir (bugünkü davranış); S62 (salt okunurda KVKK talebi) dokunulmaz.

## 6. İş 5 — WT2-7 (Kaldır'ın paylaşım denetimi kipe göre)
- `routes/whatsapp.mjs` sharedWaba(wabaId, mode): öbür şirketin özeti aynı WABA'da VE aynı kipte (`summary.mode`) ise "paylaşılıyor". `connection.mjs` unsubscribeAtMeta → `sharedWaba(record.wabaId,
  record.mode)`. Kip bilinmeyen eski özet `manual` sayılır (summaryOf aynen).
- Yanlış yönde hata YOK: aynı kipte aynı WABA'yı kullanan başka şirket varken abonelik SİLİNMEZ (ayrı test + mutant).

## 7. İş 6 — T16 ürün yarışı
- `applyFailure` yanıtsız dalı (`queue.mjs` ~1866) ve beklenmeyen hata dalı (~1689): satır hâlâ BU denemede "Gönderiliyor" ise Sonucu Belirsiz + art arda hata sayacı; değilse (istek sürerken imzalı
  bildirimle Teslim Edildi / Okundu / Başarısız olmuş) satıra dokunulmaz, sayaç artmaz. Defterin "uncertain" sonucu AYNEN yazılır (teslim satırı defterde; R3 / Bu Ay teslimi sayar — kime kaç kez).
- Ters yön: teslim bildirimi yanıtsız daldan SONRA gelirse iş yine Teslim Edildi (bugünkü yol, S70 ile uyumlu) — testte.

## 8. İş 7 — kırılgan test kalıpları (yalnız TEST)
- (A) süreyle kurulan "istek Meta'dayken" (sahte Meta `delayMs` + bekleme döngüsü + kısa istemci süre sınırı) → KAPI (`hold`/`release`, T35r / T16 yöntemi), program süre sınırı kapıdan uzun.
- (B) ters kalıp: kapı varken kısa istemci süre sınırı (800 ms) — kapıda iken test iş yapar; yüklü makinede süre dolar → süre sınırı uzatılır; "yanıt yok" adımı süre yerine kapıdan sonra bağlantı
  kopmasıyla (aynı "yanıtsız" dal) kurulur. Beklenti GEVŞETİLMEZ; dişler mutantla gösterilir.
- Yerler: listedekiler + taramada aynı kalıpla bulunanlar (rapor tablosu).

## 9. İş 8 — dar kontrol DÜŞÜK-1 / DÜŞÜK-2
- DÜŞÜK-1: bakım turunun bayraklı defter yeniden uygulaması (`retryLedgerErasures`; açılışta talep varsa kurulur — ilk bakım turu) her talep için o carinin içeriği silinmiş işlerinin hata metnini
  `scrubDigits`'ten geçirir (dizinli okuma, yalnız değişen satıra yazım, secure_delete + denetim noktası); eşgüçlü. Saatlik tam tarama YOK (WT2-5).
- DÜŞÜK-2: DK9 (talepten SONRA açılan işin defter telefonu yeniden uygulamada silinmez) testi.

## 10. KVKK sızıntı denetimi
- Yeni alan / ayar YOK. `via` yalnız kip adı. Günlüğe yeni ileti numara / wamid taşımaz. DÜŞÜK-1 testi veri klasörünün BÜTÜN dosyalarında (WAL dahil) ham bayt arar.

## 11. Nasıl bozulur? (testler buradan)
1. S70: Meta Bekletti → 2. deneme anında İstemiyor / Pasif / Telefonsuz Atlandı → geç delivered / read; S42 ile 2. denemesi atlanan işin 1. iletisine geç teslim ("old" yolu); zincir işi Silme
   Talebi / İstemiyor Atlandı → kaynağın eski iletisine geç teslim / okundu; J10 zincir işi + öbür kaynak denemesi; aynı denemeye yinelenen teslim (değişmez); geç failed (değişmez); iki TZ.
2. S71: içerik + kart telefonu silinmiş Hatırlatma → işteki ve asıl işteki Yine de Gönder "Telefon Yok", iş Sonucu Belirsiz; bekleyen iş varken (Zaten Kuyrukta'dan önce); telefon girilince alınır.
3. S90: Yol 2 → Yol 1 (eski B adresine geç teslim → işaret yok; A adresi / uygulama düzeyi → işaret); Yol 1 → Yol 2 (eski A adresi ve uygulama düzeyi → işaret yok; B → var); geri dönüş; Kaldır + aynı
   kiple bağla (işaret kalır, kendi adresi koyar); her durumda iş Teslim Edildi.
4. Salt okunur: çift yokken GET app-webhook → ready false, ayar satırı yok; çift varken aynı çift; KVKK talebi 200 (S62 komşu).
5. WT2-7: 001 Elle + 002 WhatsApp'ı Bağla aynı WABA → 001 Kaldır aboneliği siler (002'nin B aboneliği durur, teslimi 200); 001 + 002 aynı kip → silmez; iki liste modeli (hepsi / kendi).
6. T16: kapıda tutulan istek + imzalı delivered + zaman aşımı → satır delivered, sayaç 0; ters sıra (zaman aşımı → sonra delivered) → delivered; failed + zaman aşımı → failed.
7. Eski sürüm verisi: DÜŞÜK-1 için W-3 kodunun (329d5d1b, tur 2 öncesi — gerçek kod, kendi API'si) ürettiği veri → yeni kodla açılış + bakım turu → veri klasöründe numara 0.
8. Yarıda kesilme / iki şirket / geri yükleme: S70 kuralı yalnız şirket dosyasındaki satırlara; S90 işareti şirket ayarında (bağlantıyla aynı dosya — yedek / taşıma aynı kural).

## 12. Ölçüm (ders 47 / 53)
- S70 / S90 bildirim işleme yolu ve DÜŞÜK-1 bakım turu: 100.000 iş + 100.000 defter satırında önce / sonra, aynı veri kopyası, `flock -x` (kilit doluysa DENENMEYEN).

## 13. Windows (ders 48)
- Dosya silen / kilitleyen yeni test: DÜŞÜK-1 eski-veri testi (geçici kök, kendi tam yolu). Raporda listelenir.

## 14. Tur 3 hız (11.11.2026; WhatsApp tur 3 hız düzeltme ajanı; KODDAN ÖNCE yazıldı — BAŞ MİMAR KARARI 11.11 11:21 "100 BİN SATIRLIK HIZ ÖLÇÜMÜ")
- BULGU (ana oturumun ölçümü; 100.000 iş + 100.000 defter satırı): 100 teslim bildirimi tek çağrıda 173 (111) → 291 (230) ms, 1.000 teslim bildirimi ayrı çağrılarla 1.682 → 2.753 ms. Neden: §2'nin
  `settleSkippedChain`'i (`server/lib/whatsapp/queue.mjs:2404–2436`) satır yolunda (applyStatuses `:2588`, `self: false`) her delivered / read bildiriminde işin carisinin `inherit_of`'u dolu
  bütün satırlarını okuyor (`:2408`; `idx_wa_jobs_account` ile carinin BÜTÜN işleri taranıp tablodan okunur — ölçüm şablonunda cari başına 500 iş: ~0,77 ms / bildirim; ayrıca `jobRow` ~0,02 ms).
  Olağan veride (hiç "Yine de Gönder" zinciri olmayan) bu okumaların hepsi BOŞ döner.
- DEĞİŞİKLİK (davranış AYNI; yalnız okuma atlanır):
  1. Zincir KAYNAK kümesi (`queue.mjs`, settleSkippedChain'in yanında): şirket dosyasında `inherit_of`'u dolu satırların gösterdiği iş kimlikleri (`SELECT DISTINCT inherit_of … WHERE inherit_of <> ''`,
     BÜTÜN cariler; 100 bin işte ~21 ms, yalnız yeniden kurulurken). Bir işin kimliği kümede YOKSA hiçbir satırın `inherit_of`'u o işi göstermiyor → §2 yürüyüşünün ilk katmanı boş → zincir hedefi
     YOK (kesin).
  2. `settleSkippedChain(jobId, …)`: küme kimliği İÇERMİYORSA — `self: false` (satır yolu): `jobRow` dahil hiçbir okuma yapılmadan 0 döner (bugün de hedef yok → 0, yazım yok, bildirim yok);
     `self: true` (eski deneme / yalnız defter yolu): yalnız işin kendisi (`jobRow`) değerlendirilir, carinin zincir okuması atlanır (bugün de `rows` içinde bu işi gösteren satır yok → hedef
     yalnız işin kendisi). Küme kimliği İÇERİYORSA ya da küme bilinmiyorsa: BUGÜNKÜ okuma ve yürüyüş AYNEN (`:2408`–`:2436`, 200 sınırı, sıra, `fresh` / `self` kuralları değişmez).
  3. Küme ne zaman geçerli (ÜST KÜME kalmalı — eksik kimlik davranışı değiştirir, fazla kimlik yalnız bugünkü okumaya döndürür): kurulduğu andaki bağlantının `PRAGMA data_version`'ı aynıysa (başka
     bağlantının / sürecin yazımı görülür; ölçüm ~0,002 ms); bu bağlantının `inherit_of` yazımı YALNIZ `createBatch`'te (`:833`, `:837` — işteki Yine de Gönder ve zincirli Başarısızları Yeniden
     Dene) → o işlemden sonra küme DÜŞÜRÜLÜR (sonraki ilk bildirim yeniden kurar). İşlem İÇİNDE küme KURULMAZ (geri alınabilir yazım görülmesin — ledger-snapshots ile aynı ilke); işlem içinde
     geçerli küme kullanılabilir (kurulduğu andan beri bu bağlantıda kimlik ekleyen yazım yok). `data_version` okunamazsa küme yok sayılır (bugünkü yol). Silinen satır kümeden çıkmaz (fazla kimlik).
     Geri yükleme / şirket kapama yeni bağlantı + yeni kuyruk açar (küme sıfırdan).
  4. `freshDelivery` (`:2578`, defter okuması) AYNEN kalır (ucuz, dizinli; arıza yolunda bugünkü davranış — atlanırsa defter kilitliyken hata türü değişebilirdi).
- KORUMA (kalıcı test): `server/` altında `inherit_of`'a yazan deyim yalnız `queue.mjs` createBatch'te ve hemen ardından küme düşürülüyor — kaynak tarayan denetim (yeni bir yazar eklenirse
  test kırılır; CRLF — ders 27).
- Nasıl bozulur? (eşdeğerlik testi bu listeden; tur 3'ün bildirim-başına GERÇEK kodu (sinama-wa3 028e1b76) aynı tohumlu dizide referans — fikstür o kodla üretilir, ders 5 / 6 / 23):
  1. aynı çağrıda aynı işe iki bildirim (delivered + delivered; delivered + read) — ikincisi birincinin yazdığı durumu görmeli;
  2. teslim + okundu aynı çağrıda, zincir işi ile kaynağı aynı çağrıda (zincir işinin kendi wamid'i + kaynağın geç teslimi, iki sırayla);
  3. küme kurulduktan SONRA açılan zincir (işteki Yine de Gönder, zincirli Başarısızları Yeniden Dene) → kaynağın geç teslimi zincir işini Teslim Edildi yapmalı (küme düşürülmezse Atlandı kalır);
  4. başka bağlantının yazımı (program açıkken dışarıdan `inherit_of` — taşınan / onarılan veri benzetimi) → `data_version`;
  5. eski deneme yolu (`applyOldAttempt`) ve yalnız defter yolu (`applyLedgerOnly`) — `self: true`;
  6. iki şirket: her şirketin kuyruğu kendi kümesini tutar; 002'de açılan zincir 001'in kümesine girmez, 002'ninkini düşürür;
  7. çağrı ortasında durum değişimi: zincir işinin aynı çağrıda önce kendi bildirimiyle değişmesi, sonra kaynağın teslimi (yürüyüş satırı TAZE okur — bugünkü gibi);
  8. zincirsiz olağan veri (ölçümün yolu) — hiç okuma yok; tanınmayan wamid, failed, sent (zincir yürüyüşü yok — bugünkü gibi).
- MUTANTLAR (eşdeğerlik testi DEĞERLE yakalamalı): (M1) küme denetimi yanlış durumda atlar (ör. `self: true`'da da erken dönüş / küme düşürülmez); (M2) toplu okuma yanlış cariye / kimliğe bakar
  (kümede kaynağın değil zincir işinin kimliği); (M3) aynı çağrıdaki ikinci bildirim eski durumu görür (çağrı başında okunan satır anlık görüntüsü kullanılır).
- Ölçüm: aynı şablon, `flock -x`, sıra çalışma dalı → tur 3 → yeni → çalışma dalı → tur 3 → yeni; HEDEF iki bildirim ölçümü ve olay döngüsü çalışma dalından en çok %10 kötü.
