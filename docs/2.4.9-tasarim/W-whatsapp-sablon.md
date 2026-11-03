# 2.4.9 W Grubu — WhatsApp Şablon: Teslim Süresi (W-6, W-T), Şablon Önbelleği (W-2), Hata 100 İletisi (W-4) — TASARIM NOTU

> Durum: TASARIM (kod yok). Yazan: W tasarım ajanı (temiz bağlam), 03.11.2026 ~18:20 UTC. Ana oturum onayından sonra kodu YENİ bir ajan yazar (ders 46).
> Kod tabanı: çalışma dalı `claude/compassionate-galileo-f9kghg` @ 35e90e47. `server/` ve `client/` bu commit'te v2.4.8 yayın commit'i 6ff09c10 ile AYNI
> (`git diff 6ff09c10 HEAD --stat -- server/ client/` boş) → "eski kod" = 6ff09c10.
> Kaynaklar: CLAUDE.md (anayasa, dersler 1–48), docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md, docs/2.4.9-IS-LISTESI.md (W-6, W-T, W-2, W-4, KARAR 03.11 ~18:10),
> docs/2.4.8-IS-LISTESI.md (D0 / ELLE KABUL, ELLE KABUL BULGUSU 2–7, 6 EKİ, BULGU 6 SONUCU), docs/erp/WHATSAPP-API-PLANI-2.4.8.md (§2.2 TTL, §7a 16–17, §11 S2/S3),
> docs/GECMIS-KARARLAR.md (01.11 06:28 onaylı 8 davranış), P3 kararı (2.4.8 iş listesi 31.10 ~03:20).

## 0. Özet ve karar bekleyenler

| Madde | Tek değişim yeri | Karar gereği |
|---|---|---|
| W-T | `META_D0_W5.utilityTtl` (meta-graph.mjs, tek sabit) → şablon açma/düzenleme değeri; `deliveryTtlSeconds` (templates.mjs) → Süresi Doldu + PDF silme | **SORU T0** (12 saat teyidi + belge parçası), **SORU T1**, **SORU T2** (iki okumalı, kime kaç kez) |
| W-6 | `templates.mjs ensure()` içindeki TTL kararı (yeni saf işlev `ttlPlan`) + meta-graph yerel aralık kapısı | BAŞ MİMAR KARARI önerileri B1–B3 (ana oturum onayı, kullanıcıya gösterilir) |
| W-2 | `queue.mjs forgetTemplates(wabaId)` (önbelleği yalnız o temizler); çağrı `ensure()` sonunda, iki şirkete `scheduler` üzerinden | KAPSAM SORUSU W-2b (ana oturum) |
| W-4 | `meta-graph.mjs` hata başlığı (yeni `metaTitle(code, { op, subcode, details })`); `kind` / `retry` DEĞİŞMEZ | yok |

ÖNEMLİ DÜZELTMELER (koddan + sahte Meta ile bu oturumda doğrulandı, §2): (a) ELLE KABUL BULGUSU 2'nin öncülü — "önizleme şablon kararını 10 dk önbellekte
tutar" — YANLIŞ: önizleme ve başlatma önbelleği atlar (`force: true`). 10 dk önbellek yalnız SÜREN toplu işte kullanılır; orada gerçek bir açık var (S4).
Pencerenin bayat görünen kısmı önbellek değil, son "Şablonları Denetle" kaydıdır (S1). (b) BULGU 6'nın "açılıştaki ret kaydı yok" önermesi genelde YANLIŞ: aynı
şirkette açılış reddi kaydedilir ve onaydan sonra düzenleme denenmez (S1). Kayıt YALNIZ üç yolda düşer: TTL'siz yeniden açma 2388024'e düşerse (S3), açma yanıtında
kimlik yoksa, şirketin kaydı yoksa (başka şirket / başka bilgisayar / eski yedek / yeniden bağlama — S2). 03.11'deki gerçek düzenleme denemesinin hangisinden geldiği
DOĞRULANAMADI (gerçek programın kaydı okunmadı); tasarım üçünü de kapatır.

## 1. Meta'nın teslim süresi (TTL) aralığı — W-T kaynağı

Meta sayfası (developers.facebook.com "Time-to-live") ve aynaları bu oturumdan AÇILAMADI (WebFetch: ENOTFOUND — ağ izni yok; chatarchitect, msg91 de aynı).
Aşağıdaki değerler YALNIZ arama motoru özetlerinden (WebSearch; Meta sayfasının ve bağımsız üçüncü taraf kopyalarının özeti):

| Şablon türü | Varsayılan (TTL verilmezse) | Özelleştirilebilir aralık (`message_send_ttl_seconds`) | Not |
|---|---|---|---|
| UTILITY (programın iki şablonu) | 30 gün | **30 – 43.200 sn (30 sn – 12 saat)** | `-1` = 30 gün (özel TTL olarak) |
| AUTHENTICATION | 10 dk (23.10.2024 öncesi açılanlar 30 gün) | 30 – 900 sn | `-1` = 30 gün |
| MARKETING | 30 gün | 43.200 – 2.592.000 sn | yalnız Marketing Messages API |

Ek bilgiler (aynı özetler): TTL süresince "delivered" bildirimi gelmeyen ileti DÜŞÜRÜLMÜŞ sayılmalı, bildirim gecikebileceği için küçük pay bırakılmalı; Meta
şablonu kendiliğinden yeniden sınıflarsa özel TTL silinir (null); daha önce TTL verilmiş şablonun TTL'i aynı alanla değiştirilebilir. TTL-yalnız düzenlemenin onaylı
şablonu YENİDEN İNCELEMEYE alıp almadığını Meta sayfası söylemiyor; tek kaynak ikincil (Zernio / "late" SDK belgesi: "TTL-only edit keeps APPROVED, no re-review").

KESİNLİK: ORTA-YÜKSEK, KESİN DEĞİL. Lehine: (1) altı ayrı üçüncü taraf + Meta sayfasının arama özeti aynı aralığı veriyor; (2) GERÇEK Meta 03.11'de 259.200 sn'yi
(72 sa) hem şablon açılışında (D0) hem onaylı şablonun düzenlemesinde (BULGU 6 SONUCU) kod 100 "Invalid parameter" ile reddetti — 12 saat üst sınırıyla tutarlı.
Aleyhine: sayfa metni okunmadı; `-1`, yeniden inceleme, listede alanın dönüp dönmediği okunmadı. KARAR 03.11 "belge okunamazsa kullanıcıya sorulur" → **SORU T0**.

Kaynaklar (arama sonuçları; sayfalar açılamadı):
[Meta — Time-to-live](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/time-to-live) ·
[Meta (secure) — Time-to-live](https://developers.secure.facebook.com/documentation/business-messaging/whatsapp/templates/time-to-live/) ·
[ChatArchitect aynası](https://support.chatarchitect.com/books/meta-whatsapp/page/configure-message-time-to-live-developer-documentation/revisions/181) ·
[MSG91](https://msg91.com/help/whatsapp/time-to-live-ttl-for-whatsapp-templates-customization-defaults-and-compatibility) ·
[8x8](https://support.cpaas.8x8.com/hc/en-us/articles/59375052037785-WhatsApp-Template-Validity-Period-TTL) ·
[360dialog](https://docs.360dialog.com/partner/messaging/template-messages/sending-template-messages) ·
[YCloud](https://docs.ycloud.com/api-reference/whatsapp-templates/create-a-template) ·
[Gupshup](https://partner-docs.gupshup.io/docs/direct-send-by-meta) ·
[late SDK (TTL-yalnız düzenleme)](https://docs.rs/crate/late/0.0.1055/source/docs/UpdateWhatsAppTemplateByIdRequest.md)

## 2. Koddan doğrulama (bu oturumda koşuldu; ürün kodu değişmedi)

Betik: `/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/w-tasarim-dogrula/dogrula.mjs` (gerçek program + `test/whatsapp-sahte-graph.mjs`, aynı el —
kâhin DEĞİL), çıktı aynı klasörde `cikti.txt`, çıkış 0, commit 35e90e47. Komut: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node <betik>` (depo kökünden). Ana oturum yeniden koşar (ders 16).

| # | Senaryo | Sonuç (sayılarla) |
|---|---|---|
| S1 | Şablonlar program tarafından açıldı, Meta 259.200'ü reddetti (ttlRange [30, 43.200]) → önizleme → Meta onayladı → HEMEN ikinci önizleme (saat ilerlemedi) | açma istekleri [259200, TTL'siz, 259200, TTL'siz]; kayıt iki şablon için `rejected: true`; önizleme 1 `ok: false` "Meta onayını bekliyor"; önizleme 2 `ok: true`, Meta'ya 1 liste okuması (önbellek YOK); `sending-status` ve kart HÂLÂ "Onay Bekliyor / Hayır" (son Denetle kaydı); Denetle 2: TTL düzenleme isteği **0**, kart "Onaylandı / Evet" + "Meta teslim süresini kabul etmedi…" |
| S2 | Şablonlar Meta'da ZATEN ONAYLI, bu şirkette TTL kaydı yok (başka şirket / bilgisayar / yeniden bağlama) | Denetle 1: iki düzenleme isteği `{ message_send_ttl_seconds: 259200 }`; kartta KIRMIZI: "Ekstre şablonunun teslim süresi Meta'da ayarlanamadı: Meta isteği tanımadı: Telefon Numarası Kimliği (Phone Number ID) ya da WhatsApp Business Hesap Kimliği (WABA ID) yanlış olabilir. (Meta hata kodu 100: Invalid parameter: message_send_ttl_seconds)" (W-4 kanıtı); Denetle 2: 0 istek |
| S3 | TTL'li açma 100 ile düştü, TTL'siz yeniden açma 2388024 "zaten var" döndü | Ekstre için TTL kaydı YOK (yalnız ödeme hatırlatmanın kaydı var) → onaydan sonra Denetle aynı reddedilmiş değeri düzenlemeyle dener (W-6 açığı) |
| S4 | Süren toplu iş (3 kişi), 1. ileti gitti; Meta şablonu Pazarlama'ya aldı; kullanıcı Denetle'ye bastı (kart "Pazarlama / Hayır"); saat ilerlemeden işçi | giden **3** (2 ileti daha gitti), toplu iş "done" — kart "gönderilmez" derken gönderim 10 dk / 100 ileti önbellekle sürdü (W-2'nin gerçek etkisi) |

## 3. W-6 — Onaylı şablona TTL düzenlemesi ve açılış reddinin kaydı

### 3.1 Sorun ve kanıt
- `templates.mjs:337-348` açılışta TTL reddinde bir kez TTL'siz açar ve reddi `ttl[made.id]`'ye yazar; `made.id` boşsa YAZMAZ; TTL'siz açma 2388024'e düşerse
  (`:353-356`, "zaten var" → `continue`) YAZMAZ (S3).
- `templates.mjs:364-381` APPROVED / REJECTED / PAUSED şablonda (`META_D0_W5.ttlEditable`, meta-graph.mjs:454) kayıt yoksa ya da değer farklıysa `editTemplateTtl`
  (meta-graph.mjs:527) dener; kayıt şirket dosyasında (`whatsapp.templates`, `:406-408`) → başka şirket / bilgisayar / yeniden bağlama / eski yedek kayıtsız başlar (S2).
- İstemci kaydı/bağlamayı KENDİLİĞİNDEN izler: Elle Bağla kaydı `hof-whatsapp-ayar.js:190` (`testNow({ afterSave: true })` → `whatsappTemplates.ensure({ quiet: true })`),
  WhatsApp'ı Bağla `:299`. Sunucu ucu gövdeyi okumaz (routes/whatsapp-sablon.mjs:22-26) → kullanıcı basmadan düzenleme (BULGU 6 EKİ).
- Değer kapısı yok: `ttlHoursNow()` 1–720 saat (`templates.mjs:239-242`), ayar ucu 1–720 (queue.mjs:2038-2042); meta-graph `createTemplate` (`:519`) / `editTemplateTtl`
  (`:529`) yalnız `> 0` denetler → aralık dışı değer Meta'ya gider (D0 ve BULGU 6 SONUCU).
- Her 100 "rejected" sayılır (`templates.mjs:378`) — 24 saatte 1 düzenleme sınırı / durum uygun değil gibi 100'ler de değeri kalıcı "reddedildi" yapar (kartta yanlış uyarı).

### 3.2 Hedef (iş listesi W-6 aynen) ve kurallar
"açılışta Meta'nın TTL reddi kaydedilir; onaylı şablona TTL düzenlemesi YALNIZ kullanıcının TTL kararı Meta'nın izinli aralığındaysa ve henüz denenmemişse
(Elle Bağla kaydı / yeniden bağlama sonrası kendiliğinden denetim de aynı kurala)". Değişmezler:
- **I1** Meta'ya giden her `message_send_ttl_seconds` [30, 43.200] içinde; dışındaki değer YEREL olarak reddedilir, istek gitmez (meta-graph.mjs `createTemplate` /
  `editTemplateTtl` içinde, `META_D0_W5.utilityTtl`'den — tek yer).
- **I2** Her (WABA, şablon adı + dil, değer) için en çok BİR kesin sonuç: 200 → "kabul", 100 → "reddedildi" (bir daha denenmez); ağ / geçici / belirsiz → en erken 24 saat
  sonra yeniden (bugünkü `TTL_RETRY_MS`).
- **I3** Açılış reddi şablonun KİMLİĞİ olmasa da yazılır: anahtar `ad|dil` (+ bilinen kimlik); 2388024 yolunda da (Meta'da var, TTL durumu "reddedildi / Meta varsayılanı").
  Her denetimde liste kimliğiyle bağlanır; listedeki kimlik kayıttakinden farklıysa (şablon silinip aynı adla yeniden açılmış) kayıt o şablona uygulanmaz.
- **I4** Meta listesinde `message_send_ttl_seconds` hedefe eşitse düzenleme istenmez, "kabul" yazılır (ikinci şirket / bilgisayar gereksiz denemesin).
- **I5** 2.4.8 kayıtları (kimlik anahtarlı `{ seconds: 259200, rejected | ok }`) okunur; hedef 43.200 olduğu için bir kez (I2) denenir — iki kez değil.

### 3.3 Tasarım
- `templates.mjs`: yeni saf işlev `ttlPlan({ found, record, target, auto, now })` → `{ send: bool, why }` — açma ve düzenleme kararı YALNIZ burada; `ensure()` bunu çağırır.
  Kayıt biçimi (v1 içinde `ttl` alanı geriye uyumlu genişler): `{ id, name, language, seconds, at, outcome: "accepted"|"rejected"|"failed", stage: "create"|"edit", code, subcode, since }`
  (`since`: W-T §4.3 için Meta'nın değeri kabul ettiğinin/bildirdiğinin ilk görüldüğü an).
- TTL reddi KIRMIZI işlem iletisi DEĞİL: şablon onaylı kalır, gönderim etkilenmez → işlem `ok: true, ttl: true, rejected: true` (kart yalnız `!ok || created`'i listeler,
  hof-whatsapp-sablon.js:41) ve satırda bugünkü uyarı (`TTL_REJECTED_TEXT`, sarı `adm-wa-tpl-warn`). Uyarı yalnız GÜNCEL hedef değerin reddinde görünür (eski 259.200 reddi
  2.4.9'da uyarı üretmez). Denetim kaydına (`audit`) `ttlRejected` listesi eklenir.
- Düzenleme sonrası liste zaten yeniden okunur (`:384-391`); durum APPROVED değilse (Meta yeniden incelemeye aldıysa) kart ve gönderim kararı (sendingVerdict) bunu söyler;
  W-2 ile süren toplu iş bir sonraki adımda durur.
- **BAŞ MİMAR KARARI önerisi B1 (ana oturum onayı; kullanıcıya gösterilir — ders 40):** kendiliğinden denetim (Elle Bağla kaydı, WhatsApp'ı Bağla) ONAYLI şablonun TTL'ini
  DÜZENLEMEZ; yalnız eksik şablonu açar (TTL'li) ve durumu okur. Düzenleme yalnız kullanıcının bastığı "Şablonları Denetle ve Oluştur"da, I1–I4'le. Gerekçe: TTL-yalnız
  düzenlemenin onaylı şablonu yeniden incelemeye alıp almadığı DOĞRULANMADI (§1; gerçek onay ~23 saat sürdü) → kullanıcı basmadan şablona dokunulmaz (BULGU 6 EKİ'nin riski).
  Uygulama: istemci iki `quiet` çağrıda gövdeye `{ auto: true }` (hof-whatsapp-ayar.js:190, :299 → hof-whatsapp-sablon.js `ensure`), uç `readJson` ile okur → `ensure(user, { auto })`.
  Seçenek (iş listesinin harfi): kendiliğinden yol da aynı kuralla düzenler (I1–I4). Öneri B1, çünkü 2.4.9'dan sonra açılan her şablon TTL'i AÇILIŞTA alır; düzenleme yalnız
  2.4.8'de açılmış şablonlar (bugün yalnız kullanıcının D0 hesabı) için gerekir.
- **B2:** `ttlEditable` → yalnız `["APPROVED"]`. REJECTED / PAUSED şablonu düzenlemek onu yeniden incelemeye gönderir (K0 bağımsız sahte Meta da REJECTED → PENDING yapar,
  `test/bagimsiz/whatsapp-248/sahte-meta/sunucu.mjs:607`); program içeriği değiştirmediği için anlamsız ve kartı yanıltır.
- **B3:** 100 dışı düzenleme hatası (ağ, 1/2, belirsiz) "failed" → 24 sa sonra; 100 her alt koduyla "reddedildi" (iş listesi "aynı değer bir daha denenmesin") — 24 saat sınırı
  gibi bir 100 de bu değeri o şirkette kalıcı bırakır: BİLİNEN SINIR (kart uyarısı "kabul etmedi" der, Süresi Doldu güvenli tarafta 30 gün kalır).

### 3.4 Bütün çağıranlar
`POST /api/workspace/whatsapp/templates/ensure` (routes/whatsapp-sablon.mjs:22) ← istemci `HOF.whatsappTemplates.ensure` (hof-whatsapp-sablon.js:67): düğme (`:87-93`),
Elle Bağla kaydı (hof-whatsapp-ayar.js:190), WhatsApp'ı Bağla (`:299`). Sunucuda başka çağıran YOK (W-6 sunucu tarafında kendiliğinden denetim yapmaz). `createTemplate` /
`editTemplateTtl` yalnız templates.mjs'ten. `deliveryTtlSeconds` ← queue.mjs maintain (`:1590-1595`) + test/whatsapp-q5-son-kabul-248.test.mjs:138.

## 4. W-T — Teslim süresi = Meta'nın utility'de izin verdiği en uzun süre

### 4.1 Değer
- **BAŞ MİMAR YORUMU (kullanıcıya gösterilir):** KARAR 03.11 A'nın "en uzun süre"si özelleştirilebilir aralığın üst ucu **43.200 sn = 12 saat**'tir. `-1` (30 gün) ve "TTL
  verme" (30 gün varsayılan) SORU 1'in B seçeneğiyle aynıdır, A değildir; A'nın gerekçe metni ("bayat ekstre geç gitmez") de 12 saati gösterir.
- KÖR NOKTA (kullanıcıya): 12 saat, plan S2 A'nın 3 gününden çok kısa. Telefonu gece / hafta sonu 12 saatten uzun kapalı kalan kişiye ekstre GİTMEZ, "Süresi Doldu" olur,
  yeniden gönderilmesi gerekir (ör. Cuma 17:00 gönderim, telefon Cumartesi 08:00 açıldı → gitmedi). → **SORU T0**'da teyit.
- Tek sabit: `META_D0_W5.utilityTtl = { min: 30, max: 43_200 }` + `PROGRAM_TTL_SECONDS = utilityTtl.max` (meta-graph.mjs; kaynak satırı §1). `META_D0.defaultTtlHours` (72),
  `templates.mjs ttlHoursNow`, `createWhatsappTemplates({ ttlHours })` parametresi ve routes/whatsapp.mjs:259'daki `ttlHours: () => queue?.settings?.().ttlHours` kalkar.
- **B4 (baş mimar önerisi):** gönderim ayarındaki `ttlHours` KALKAR (arayüzü yok; yalnız API): `settings()` (queue.mjs:170-175) artık döndürmez; `PUT …/sending-settings`
  `ttlHours` alanında 400 "Teslim süresi Meta'nın izin verdiği en uzun süreye (12 saat) sabittir; değiştirilemez." (reddedilen istek başarı sayılmaz — ders 3). Kayıtlı eski değer okunmaz.
  Seçenek: 1–12 saat arası ayarlanabilir kalsın (karar A "en uzun"u söylediği için önerilmez).

### 4.2 "Süresi Doldu" ve PDF silme bu değere nasıl bağlı (bugün)
- queue.mjs maintain (`:1580-1608`): bildirim yolu canlıysa (son 7 günde WABA'ya / şirkete en az bir bildirim, `:1586-1588`, `HOOK_ALIVE_MS`) `accepted_at + TTL + 1 sa` geçen
  `accepted` / `sent` iş → `expired` + `ledger.deliveryFailed` (P3 = SAYILMAZ: "Daha Önce Gönderildi" saymaz). TTL = `deliveryTtlSeconds(store, waba, ad)` (templates.mjs:123-132):
  Meta listesindeki değer → açma yanıtının yansıttığı değer → 30 gün. Düzenleme 200'ü (`ok: true`) TEK BAŞINA değeri bilinir yapmaz (T2-5 güvenli taraf).
- PDF: `expired` FINAL'dedir (`:65`) → Süresi Doldu anında silinir; bildirim yolu yoksa 30 gün + 1 sa sonra (`:1611-1617`). Süre şablon düzeyinde, İŞ düzeyinde değil.
- Onaylı davranış (4) "Süresi Doldu (3 gün) Meta'nın son kabul ettiği denemeden ölçülür" — ölçüm kuralı aynen kalır; parantezdeki süre KARAR 03.11 A ile 12 saat olur.

### 4.3 Değişiklik ve "kime kaç kez" etkisi
- **İLKEYLE (tek okuma; iş listesine "İLKEYLE" yazılır):** TTL değişmeden ÖNCE kabul edilmiş iş eski süreyle (bilinmiyorsa 30 gün) değerlendirilir. Bugünkü şablon düzeyindeki
  kural, 30 gün → 12 saat düzenlemesinden sonra dünkü işleri 13. saatte "Süresi Doldu" yapar; Meta onları 30 gün dener → P3 ile kişi yeniden gönderilebilir (iki ileti) ve
  PDF teslimden önce silinir. İlke (2) "almış olabilirse elenir" → uzun süre. Tasarım: `deliveryTtlSeconds(store, waba, ad, acceptedAt)` — `acceptedAt < since + 1 sa` ise
  30 gün; `since` bilinmiyorsa (eski kayıt, geri yüklenen eski yedek) 30 gün. maintain kaydı turda BİR kez okur, satır başına yalnız sayı karşılaştırır (ders 47).
  `acceptedAt` verilmezse bugünkü davranış (q5 testi bozulmaz).
- Şablon yeniden sınıflanırsa Meta TTL'i siler → liste değer vermez → 30 gün (güvenli taraf; ek kural yok).
- Ödeme hatırlatma (aynı gün eşliği) ve "Bu Ay Gönderilen İleti Sayısı" (teslim sayısı) etkilenmez. Kendime Deneme (`hello_world`) etkilenmez.
- İki şirket aynı WABA: TTL WABA düzeyinde bir Meta olgusu, kayıt şirket başına → B şirketinin kaydı yoksa B 30 gün sayar (güvenli taraf); B'nin Denetle'si I4 / I2 ile bir kez dener.
  Makine defterinde (defter.mjs) WABA düzeyinde tutma seçeneği var (yeni `CREATE TABLE IF NOT EXISTS`), ÖNERİLMEZ (kapsam, kilit yolları; ders 48) → BİLİNEN SINIR.
- İki okumalı iki nokta AYRI başlıkta (§7: SORU T1, T2). Yanıt gelene kadar ne kodda ne kâhinde kesinleşir (ders 43).

## 5. W-2 — "Şablonları Denetle" gönderim yolunun önbelleğini temizler

### 5.1 Sorun ve kanıt (öncül düzeltmesiyle)
- `queue.mjs:326` `templateCache` (`${waba}|${ad}` → karar), `:77` `TEMPLATE_CHECK_MS` 10 dk, `:78` 100 ileti. Önizleme (`:646`) ve başlatma (`:718`) `force: true` →
  önbelleği ATLAR (v2.4.8 6ff09c10'da da; deb6aecf, 30.10). Önbelleği kullananlar: süren toplu işin adımı (`:1146`, `force` yok) ve izleme (`:1038-1053`).
  Temizleyenler: Devam Et (`:813`), şablon türü hata (`:1461`, `:1487`). Şablonları Denetle temizlemez → kart "gönderilmez" derken süren iş 10 dk / 100 iletiye kadar sürer (S4: +2 ileti).
- Pencerenin bayatlığı (BULGU 2'deki yaşanan): `GET …/sending-status` şablonları son Denetle kaydından okur (routes/whatsapp.mjs:269, 287) → `HOF.whatsappApi.ready`
  (hof-whatsapp-api.js:55) → pencere "Otomatik Gönder" yerine "WhatsApp Web ile Gönder" sekmesiyle açılır (hof-whatsapp.js:346); Yönetim kartı "Onay Bekliyor". Otomatik
  sekmesine geçilince önizleme taze okur ve gönderir (S1). Kullanıcıya "Denetle'ye basma" dendiği için (BULGU 6) kayıt bayat kaldı.

### 5.2 Tasarım
- Tek değişim yeri: `queue.mjs` yeni `forgetTemplates(wabaId)` → `templateCache`'ten o WABA'nın anahtarları + `watchTried`'daki aynı anahtarlar silinir (`tier|` anahtarlarına
  dokunulmaz). Dönen nesneye eklenir (`:2067`).
- Çağrı: `templates.ensure()` Meta okumasından sonra (başarılı ya da Meta hatası — `finally`'de, `busy` bırakılmadan önce) `onChecked(record.wabaId)`; bağlantı routes/whatsapp.mjs:259'da
  `onChecked: wabaId => whatsapp?.scheduler?.forgetTemplates?.(wabaId) ?? queue?.forgetTemplates?.(wabaId)` (kuyruk aşağıda kurulur — bugünkü `ttlHours` tembel kalıbı).
- İki şirket aynı WABA (ders 10): scheduler.mjs yeni `forgetTemplates(wabaId)` → kayıtlı bütün kuyruklarda `queue.forgetTemplates?.(wabaId)` (scheduler kuyrukları zaten tutar, `:9`).
- Etki: Denetle'den sonraki ilk adımda süren iş taze okur; Pazarlama / onaysız ise duraklar (`template-…`), onaylıysa sürer. Kural değişmez (R2 aralığı aynen).
- **KAPSAM SORUSU W-2b (ana oturum; kime kaç kez DEĞİL):** "onaydan hemen sonra gönderim" amacı için pencerenin varsayılan sekmesi ve kart da tazelensin mi? Öneri EVET, küçük:
  önizleme / başlatmanın taze listesi şablon kaydının yalnız `items[].meta`'sını günceller (yeni `templates.noteListing(store, record, listing)`, eşzamanlı oku-değiştir-yaz,
  `actions` / `ttl` / `at` korunur; salt okunur lisansta yazmaz). Hayır derse: kılavuza "onaydan sonra Şablonları Denetle'ye basın" (K-1).

## 6. W-4 — Meta hata 100 iletisi bağlama göre

### 6.1 Sorun ve kanıt
`META_ERRORS[100]` tek başlık (meta-graph.mjs:110) "Meta isteği tanımadı: Telefon Numarası Kimliği … ya da … WABA ID yanlış olabilir." — `request()` (`:270`) ve `uploadBytes()`
(`:592`) koddan başka bilgi almadan uygular. Gerçek / doğrulanmış yanıltıcı durumlar: onaylı şablona TTL (BULGU 6 SONUCU, S2 iletisi), aboneliksiz override (BULGU 3 kesin metin
"(#100) Before override the current callback uri, your app must be subscribed to receive messages for WhatsApp Business Account"), ileti isteğinde geçersiz değer.

### 6.2 Tasarım
- `request(method, parts, { …, op })` — her çağıran işlem adını verir; yeni `metaTitle(code, { op, subcode, details })` yalnız 100 için başlık seçer; `classifyMetaCode` `kind` /
  `retry`'ı AYNEN döndürür (templates.mjs `stop` mantığı `:359`, `metaFailure` `:247`, kuyruk `classOf` değişmez — değişmez kural, testle korunur). Sıra: alt kod 33 → kimlik;
  sonra `op`; `details` yalnız `subscribe`'da kalıpla. `details` zaten arındırılmış (redact) gelir.

| op (çağıran) | Koşul | Başlık (cümle düzeni) |
|---|---|---|
| hepsi | `error_subcode` 33 | Meta bu kimlikle bir kayıt bulamadı ya da belirtecin bu kayda erişimi yok: Telefon Numarası Kimliği (Phone Number ID), WhatsApp Business Hesap Kimliği (WABA ID) ya da Uygulama Kimliği (App ID) yanlış olabilir. |
| `template-ttl` (editTemplateTtl) | 100 | Meta şablonun teslim süresini kabul etmedi; şablon onaylı kalır, Meta 30 güne kadar teslim etmeyi dener. |
| `template-create` (createTemplate) | 100, 2388024 değil | Meta şablon açma isteğindeki bir değeri kabul etmedi; şablon açılmadı. DestekOfis desteğine başvurun. |
| `subscribe` (subscribeApp) | 100 + `details` /must be subscribed\|subscribed to receive/i | Meta bildirim adresini kaydetmedi: uygulamanızın bu WhatsApp Business hesabına aboneliği ve uygulama düzeyi webhook ayarı tamamlanmamış. Kullanım Kılavuzu'ndaki Elle Bağla ön koşullarını tamamlayıp Bağlantıyı Sına'ya basın. |
| `subscribe` | 100, başka | Meta bildirim adresi kaydını kabul etmedi (geçersiz değer). |
| `send` (sendTemplate) | 100 | Meta ileti isteğindeki bir değeri kabul etmedi (ör. alıcı numarası ya da şablon değişkeni). |
| `lookup` (phone_numbers, numara, şablon listesi, subscribed_apps GET) | 100 | Meta okuma isteğini kabul etmedi; Telefon Numarası Kimliği (Phone Number ID) ya da WhatsApp Business Hesap Kimliği (WABA ID) yanlış olabilir. |
| `media-upload`, `app-upload`, `register`, `sync`, op yok | 100 | Meta isteği geçersiz buldu. |

Başlığın sonuna bugünkü gibi "(Meta hata kodu 100: <details>)" eklenir. `test/whatsapp-w1-baglanti.test.mjs:172` (/yanlış olabilir/) iki kimlik metniyle de geçer.
Durum bildirimindeki `failed` (queue.mjs:1938) op'suz → genel metin. Eski işlerin kayıtlı `error_text`'i değişmez (göç yok, bilinçli). Abonelik metni K-1 kılavuz bölümüne dayanır.

## 7. İKİ OKUMALI NOKTALAR — KULLANICIYA SORULACAK (ders 43, 45; 5 dk yetkisi UYGULANMAZ)

- **SORU T0 (KARAR 03.11 "belge okunamazsa kullanıcıya sorulur"):** Meta sayfası bu oturumdan açılmadı; arama özetleri ve gerçek Meta reddi utility için **en çok 12 saat**
  diyor. (a) Meta "Time-to-live" sayfasının utility satırını (ekran görüntüsü ya da metin) gönderebilir misiniz? (b) 12 saat teyidi: telefonu 12 saatten uzun kapalı kişiye
  ekstre gitmez ("Süresi Doldu", yeniden gönderilir). **A (öneri, kararınız):** 12 saat. **B:** Meta varsayılanı 30 gün kalsın (bugünkü hâl).
- **SORU T1 — bildirim kaçarsa Süresi Doldu:** Bilgisayar kapalı ya da uzaktan bağlantı kopukken Meta'nın "teslim edildi" bildirimi gelemez; Meta 7 güne kadar yeniden dener.
  30 günlük sürede bu pencere pratikte yoktu; 12 saatte olağan (akşam gönderim, gece bilgisayar kapalı). Bugünkü kural sabah açılışta 13. saatte "Süresi Doldu" yazar → P3 ile
  kişi "Daha Önce Gönderildi" sayılmaz → geciken bildirim gelmeden yeni gönderimde AYNI DÖNEMDE İKİNCİ EKSTRE gidebilir. **A (öneri, ilke 2 "almış olabilirse elenir"):**
  süre içinde bildirim yolu kesintisiz açık değilse (program / tünel kapalı kalmışsa) "Süresi Doldu" ancak yol yeniden açıldıktan sonra 24 saat bekleyip yazılır; bu arada kişi
  "Daha Önce Gönderildi" sayılır, "Yine de Gönder" açık (ilke 4). **B:** bugünkü kural (kabulden 13 saat sonra; son 7 günde en az bir bildirim geldiyse).
- **SORU T2 — Meta değeri kabul etti ama bildirmiyor:** Gerçek Meta şablon listesinde `message_send_ttl_seconds`'ı veriyor mu bilinmiyor (2.4.9 elle kabulünde görülür;
  veriyorsa soru düşer). Vermiyorsa: **A:** düzenleme / açma isteği 200 döndüyse 12 saat sayılır (kararın harfi "Meta'nın kabul ettiği değer"). **B (öneri, T2-5 güvenli taraf +
  ilke 2):** yalnız Meta'nın BİLDİRDİĞİ değer sayılır; bildirmezse "Süresi Doldu" ve PDF silme 30 günde kalır (yanlış "Süresi Doldu" ve teslimden önce PDF silme olmaz; kişi
  30 gün "Daha Önce Gönderildi" sayılır, "Yine de Gönder" açık).

## 8. Nasıl bozulur? (testler buradan)
1. TTL'li açma 100 → TTL'siz açma 2388024 → kayıt yok → onaydan sonra reddedilmiş değer yeniden (S3). 2. Açma yanıtında kimlik yok → kayıt yok.
3. Kayıtsız şirket / bilgisayar / eski yedek / yeniden bağlama + kendiliğinden denetim → onaylı şablona düzenleme (S2). 4. 2.4.8 kaydı (259.200 reddedildi) → 43.200 iki kez denenir.
5. Aralık dışı değer (gelecekte sabit / ayar) Meta'ya gider. 6. 24 sa sınırı 100'ü değeri kalıcı "reddedildi" yapar. 7. Düzenleme sonrası Meta yeniden incelemeye alır → süren iş gönderir.
8. REJECTED / PAUSED şablon düzenlenip incelemeye düşer. 9. 30 gün → 12 sa geçişinde DÜNKÜ işler 13. saatte Süresi Doldu + PDF silinir (iki ileti). 10. Meta 200 dedi, değeri bildirmiyor (T2).
11. Bildirim kuyrukta, bilgisayar kapalı; açılışta önce Süresi Doldu (T1). 12. Ay sonu / gece yarısı: 31'i 20:00 gönderim, 1'i 09:00 Süresi Doldu; TZ=UTC / Europe/Istanbul (ders 13, 22).
13. Şirket Verisini Sıfırla `whatsapp.*`'ı korur (app.mjs:893) → kayıt kalır, işler gider. 14. İki şirket aynı WABA: A'nın Denetle'si B'nin süren işini durdurmaz (S4 benzeri).
15. Denetle sürerken önizleme / başlatma (önbellek temizliği sırası). 16. Denetle Meta okuması düşer → önbellek yine temizlenir (zararsız) — sayaç bozulmaz.
17. Hata 100 eşlemesi alt kod 33'ten önce op'a bakarsa kimlik hatası "abonelik" der. 18. W-4 `kind` / `retry`'ı değiştirirse ensure'ın durma ve kuyruğun duraklatma kuralı değişir.
19. Meta iletisi belirteci yankılar → yeni başlık `details`'ı arındırılmış kullanmalı. 20. `ttlHours` kalkınca eski kayıtlı değer okunur / PUT 200 döner.
21. Salt okunur lisans: ensure 403 (aynen); W-2b kaydı salt okunurda yazmamalı. 22. Kendime Deneme etkilenmemeli.

## 9. Test matrisi
Düzenek: gerçek program + `test/whatsapp-sahte-graph.mjs` (aynı el — kâhin DEĞİL; `ttlRange`, `templateEdits`, `failQueue`, `createStatus` VAR) + `test/whatsapp-248-ortak.mjs`
(`startWa`, sahte saat; iki şirket kalıbı `POST /api/companies` + `?hofCompany=` — test/whatsapp-t2-3-248.test.mjs:33-36). Sahte Graph'a eklenecekler (aynı el): `listTtl`
(listede alanı ver / verme), `editStatus` (kabul edilen düzenlemeden sonra durum, ör. PENDING), `createNoId` (açma yanıtı kimliksiz), `requireAppSubscription` (override'lı
subscribed_apps'e BULGU 3'ün kesin metniyle 100). Bağımsız K0 sahte Meta (`test/bagimsiz/whatsapp-248/sahte-meta/`) TTL bilmez — kod ajanı ona DOKUNMAZ (kâhin eli).
Kırmızı kanıt: `git archive 6ff09c10 | tar -x -C <not defteri>/w-eski-6ff09c10` (ders 23, 25; `npm ci` yok, ders 29); yeni test dosyası kopyaya alınıp koşulur, BEKLENEN NEDENLE
kırmızı görülür (ders 7, 38); her koşu `tools/kanit.mjs kos`. Süre testleri TZ=UTC ve TZ=Europe/Istanbul.

| Test (önerilen dosya) | Senaryo → beklenen | 6ff09c10'da |
|---|---|---|
| W6-1 `test/whatsapp-w6-ttl-kayit-249.test.mjs` | S3 yolu (TTL'li açma 100 → 2388024) → onaydan sonra Denetle: o değerle düzenleme 0 | KIRMIZI: 1 düzenleme (259.200) |
| W6-2 aynı | `createNoId` → onaydan sonra Denetle: reddedilen değerle düzenleme 0 | KIRMIZI: düzenleme var |
| W6-3 aynı | Onaylı şablon, kayıt yok → Denetle: tek düzenleme, değer [30, 43.200] içinde (43.200); ikinci Denetle 0 | KIRMIZI: 259.200 gider |
| W6-4 aynı | Kendiliğinden denetim (`{ auto: true }`, B1) onaylı şablonu düzenlemez; düğme düzenler | KIRMIZI: auto'da düzenleme var (B1 seçilirse) |
| W6-5 aynı | REJECTED / PAUSED şablona düzenleme yok (B2) | KIRMIZI: düzenleme var |
| W6-6 aynı | 2.4.8 kaydı (259.200 reddedildi) → 43.200 bir kez; kartta eski red uyarısı yok | KIRMIZI: 259.200 tekrar denenmez ama 43.200 hiç denenmez |
| W6-7 aynı | Listede değer hedefe eşit (`listTtl`) → düzenleme 0, "kabul" (I4) | KIRMIZI: kayıt yoksa düzenler |
| W6-8 `test/whatsapp-meta-graph.test.mjs` eki | `createTemplate` / `editTemplateTtl` 29 ve 43.201 → yerel ret, sunucuya 0 istek; 30 ve 43.200 gider | KIRMIZI: istek gider |
| W6-9 aynı (gerileme koruması) | Düzenleme ağ hatası → 24 sa içinde yeniden yok, sonra bir kez | YEŞİL (kanıt sayılmaz, gerileme koruması) |
| W6-10 aynı | `editStatus: PENDING` → kart "Onay Bekliyor", önizleme `ok: false`, süren iş sonraki adımda durur | KIRMIZI (W-2 olmadan iş sürer) |
| WT-1 `test/whatsapp-wt-ttl-sure-249.test.mjs` | Açılışta `message_send_ttl_seconds` = 43.200 | KIRMIZI: 259.200 |
| WT-2 aynı | `listTtl` açık, bildirim yolu canlı: 12 sa 59 dk'da `sent`, 13 sa 1 dk'da `expired` + PDF silindi | KIRMIZI: (ret → 30 gün) expired değil |
| WT-3 aynı (İLKEYLE) | İş 30 gün TTL'le kabul → Denetle 43.200'e düzenler → 13 sa + 1 dk'da `sent` kalır, PDF silinmez; 30 gün + 1 sa'te expired | KIRMIZI: şablon düzeyi kuralla erken expired (ön koşul: eski kopyada değer kabul edilecek şekilde `ttlRange` null) |
| WT-4 aynı | `PUT …/sending-settings { ttlHours: 48 }` → 400 (B4) | KIRMIZI: 200 |
| WT-5 aynı | SORU T2 yanıtına göre: `listTtl` kapalı + düzenleme 200 → B: 30 gün / A: 13 sa | yanıta göre |
| WT-6 aynı | SORU T1 yanıtına göre (A): bildirim yolu kabulden sonra kopuk → 13 sa'te expired YOK; yol açılıp 24 sa sonra expired; arada önizlemede "Daha Önce Gönderildi" | yanıta göre |
| W2-1 `test/whatsapp-w2-onbellek-249.test.mjs` | S4: süren iş, Pazarlama, Denetle → saat ilerlemeden adım: toplu iş `paused` / `template-marketing`, giden 1 | KIRMIZI: giden 3, `done` (S4'te görüldü) |
| W2-2 aynı | İki şirket aynı WABA: 002'de süren iş, 001'de Denetle → 002 sonraki adımda durur | KIRMIZI |
| W2-3 aynı (W-2b onaylanırsa) | Önizlemenin taze okumasından sonra `sending-status` `usable: true`, Denetle'siz | KIRMIZI: `false` (S1'de görüldü) |
| W2-4 aynı (gerileme koruması) | R2: Denetle olmadan 10 dk / 100 ileti kuralı aynen (mevcut t1-b3 B5, w2-cekirdek R2 yeşil kalır) | YEŞİL |
| W4-1 `test/whatsapp-w4-hata100-249.test.mjs` | Düzenleme 100 → iletide "teslim süresi", "Phone Number ID" YOK | KIRMIZI |
| W4-2 aynı | `requireAppSubscription` → kanca "Kaydedilemedi · Meta bildirim adresini kaydetmedi: …abonelik…" | KIRMIZI |
| W4-3 aynı | İleti isteği 100 (alt kodsuz) → iş Başarısız, metin "ileti isteğindeki bir değeri" | KIRMIZI |
| W4-4 aynı | Alt kod 33 (yanlış WABA) → kimlik metni, /yanlış olabilir/ | YEŞİL (gerileme koruması) |
| W4-5 aynı | Her op için `kind` / `retry` 6ff09c10 ile aynı (tablo karşılaştırması) | YEŞİL (değişmez koruması) |
| E2E | `test/e2e/senaryo-whatsapp-sablon-248.mjs` eki: TTL reddinde kartta kırmızı işlem YOK, satırda sarı uyarı; ders 28 gereği koşulur | KIRMIZI: kırmızı kimlik iletisi |

Kâhin: `test/bagimsiz/whatsapp-248/kahin/kahin.py:138` `TTL = 72 * SA` (§11 S2 A) → KARAR 03.11 A ile 12 saat; mutasyon M7; İLKEYLE kuralı (§4.3) ve T1/T2 yanıtları — KODU
GÖRMEYEN ayrı ajan, karar metinlerinden (ders 5, 40); `senaryolar.json` yeniden üretilir. Dar kontrol: W-T gönderim çekirdeğine (Süresi Doldu, R3) dokunduğu için xhigh.

## 10. Etkilenen mevcut testler
- `test/whatsapp-t2-5-248.test.mjs`: 259.200 beklentileri, `ttlHours: 48` düzenleme testi, "önceden açılmış şablon ilk denetimde 259.200" → 43.200'e ve B4'e göre yeniden yazılır.
- `test/whatsapp-t2-5b-248.test.mjs`: `ttlHours` parametresi kalkar; "259.200 kabul → 73. saat" testi geçersiz; ret senaryoları `ttlRange [30, 43.200]` ile artık REDDEDİLMEZ →
  `ttlRange [30, 3.600]` (ya da `failQueue` 100) ile kurulur; "43.200 kabul → 13. saat" varsayılan olur.
- `test/whatsapp-q5-son-kabul-248.test.mjs:138` `deliveryTtlSeconds(store, WABA, ad)` — 3 değişkenli çağrı bugünkü anlamıyla kalır (değişmez).
- `test/whatsapp-w5-sablon.test.mjs:227-229` alan basamakları — değişmez beklenir; okunarak doğrulanır.
- `test/whatsapp-w1-baglanti.test.mjs:172` /yanlış olabilir/ — yeni kimlik metinleriyle geçer. `test/whatsapp-w9-kanca-248.test.mjs:155` yalnız durumu okur — etkilenmez.
- CI DIŞI e2e (elle koşulur, ders 8): `test/e2e/senaryo-is-akisi-248.mjs:319-320` (açılışta 259.200 → 43.200), `test/e2e/senaryo-tarih-248.mjs:337-340` T7d-1 "73 saatte" → 13 saat.
- CI e2e: `senaryo-whatsapp-sablon-248`, `senaryo-whatsapp-ayar-248` (kendiliğinden denetim, B1), `senaryo-whatsapp-gonder-248` (pencere, W-2b) koşulur (ders 37: adayda bütün liste).

## 11. Risk
- YÜKSEK etki / bilinmeyen olasılık: Meta TTL-yalnız düzenlemede onaylı şablonu yeniden incelemeye alırsa gönderim ~1 gün durur (gerçek onay 23 saat sürdü). B1 bunu kullanıcı
  basmadıkça önler; elle kabulde ilk basış kullanıcının D0 hesabında gözlenir.
- 12 saat iş etkisi (T0): gece / hafta sonu kapalı telefonlar "Süresi Doldu" → yeniden gönderim yükü; müşteri şikâyeti olasılığı.
- Kime kaç kez (T1, T2): yanıt gelmeden W-T kodlanamaz (yalnız W-6 / W-2 / W-4 ve İLKEYLE kısmı ilerleyebilir).
- Değişen yardımcı (`deliveryTtlSeconds`, `request()` imzası) bütün çağıranlarıyla denenir (ders 10); hata sınıfı değişmez kuralı W4-5 ile korunur.

## 12. Açık sorular (ana oturuma)
1. B1 (kendiliğinden denetim düzenlemez) mi, iş listesinin harfi (aynı kural) mı? 2. B2 (yalnız APPROVED), B3, B4 onayı. 3. KAPSAM W-2b. 4. Elle kabul (2.4.9, kullanıcı
ekranında): D0 hesabında Şablonları Denetle → istek 43.200, şablon ONAYLI kalıyor mu, kayıtta `meta.message_send_ttl_seconds` var mı (T2'yi düşürür), kartta kırmızı ileti yok.
5. Meta belgesine ağ izni (developers.facebook.com) ya da kullanıcıdan belge parçası (T0).

## 13. Bu tasarım oturumunda DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- DENENEN: kod okuması (templates.mjs, meta-graph.mjs, queue.mjs, routes/whatsapp*.mjs, scheduler.mjs, hub.mjs, connection.mjs, hof-whatsapp-*.js); S1–S4 gerçek programda
  sahte Meta ile (sayılar §2). Meta aralığı yalnız arama özetlerinden.
- DENENMEYEN: Meta sayfaları (açılmadı); gerçek Meta'da 43.200 düzenlemesi; kullanıcının gerçek şirket kaydı (03.11 düzenlemesinin kaynağı); eski kodda kırmızı alımı (kod yok —
  kod ajanı alır); Windows; iki şirketli W-2 senaryosu (yalnız tasarlandı).
- BİLİNEN SINIRLAR (öneri): ikinci şirket / bilgisayar aynı değeri bir kez daha dener (I4 ile listede değer varsa denemez); 24 sa sınırı 100'ü değeri o şirkette kalıcı "reddedildi" yapar.

## 15. KULLANICI KARARI + ANA OTURUM ONAYI (03.11.2026 ~18:50 UTC) — kodlama bu bölümle birlikte okunur
- KULLANICI (AskUserQuestion, 03.11; SORU T0, 12 saatlik üst sınır öğrenildikten sonra KARAR 03.11 SORU 1 A'yı DEĞİŞTİRDİ): **TESLİM SÜRESİ = 30 GÜN (Meta varsayılanı).**
  Program şablon açarken TTL GÖNDERMEZ, onaylı şablonun TTL'ini DÜZENLEMEZ. SORU T1 ve T2 bu kararla DÜŞER (30 günde bildirim kaçma penceresi pratikte yok, §7).
- W-T yeniden: `ttlHours` ayarı ve 72 saat varsayılanı (META_D0.defaultTtlHours, ttlHoursNow, createWhatsappTemplates({ ttlHours }), routes/whatsapp.mjs:259) KALKAR;
  açma isteğinde TTL alanı yok; düzenleme yolu (editTemplateTtl / ensure içindeki TTL döngüsü) KALKAR. "Süresi Doldu" ve PDF silme: Meta listesinin bildirdiği değer varsa o,
  yoksa 30 gün (+1 sa) — bugünkü `deliveryTtlSeconds` geri dönüşü. `PUT …/sending-settings` `ttlHours` → 400 "Teslim süresi Meta'nın varsayılanıdır (30 gün); değiştirilemez."
  (B4). Kayıtlı eski TTL ret/düzenleme kayıtları okunmaz, zarar vermez; eski kurulumlarda 72 sa ile açılmış şablon varsa (Meta reddettiği için yok) liste değeri geçerli.
- W-6 yeniden: "TTL reddi kaydı" gereksizleşir (TTL hiç gönderilmez); kırmızı yanıltıcı ileti kaynağı ortadan kalkar. Var olan TTL ret kaydı kartta gösterilmez.
- W-2 ONAY (forgetTemplates; ensure sonunda; aynı WABA'daki ikinci şirkete yayılım) + W-2b ONAY (önizlemenin taze okuması kartı ve pencerenin varsayılan sekmesini de günceller).
- W-4 ONAY (op'a göre 100 başlığı; kind/retry değişmez); "teslim süresi kabul edilmedi" başlığı TTL gönderilmediği için yalnız eski kayıtlarda kalır.
- W kâhini (kahin.py TTL = 72 sa) KODU GÖRMEYEN ayrı ajanla karar metninden 30 güne güncellenir (ders 5, 40) — kod ajanı kâhine dokunmaz.
- Etkilenen testler (§10: t2-5/t2-5b, senaryo-is-akisi-248, senaryo-tarih-248 259.200 / 73 sa beklentileri) bu karara göre güncellenir ve KOŞULUR (ders 28).
- Kod ajanı xhigh (ders 46, WhatsApp gönderim çekirdeği). K-1 kılavuzu W bittikten sonra ayrı ajan.
