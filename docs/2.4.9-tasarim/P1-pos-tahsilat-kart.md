# P1 — Müşteri carisinde POS tahsilatı: zorunlu "Kredi Kartı" seçimi (2.4.9 tasarım notu)

Tasarım ajanı, 03.11.2026. Kod değiştirilmedi. Kaynak bulgu: B4 kodlama ajanı, `docs/kanit/2026-11-03/b4/sonra-e2e-kilavuz-metin.log` satır 81 "BULGU (ürün)".

## Özet

- **Yeniden üretildi.** Gerçek program, arayüzden, Playwright ile (gerçek tıklama, 60 ms/tuş yazım, sahte saat 08.10.2026, `HUKUK_LICENSE_URL=http://127.0.0.1:9`).
- **Sınıf: ORTA.** Para yanlış hesaba **gitmiyor**. Tek kart tanımlıyken kayıt doğru biçimde POS'a yazılıyor. Kart seçilip gönderilirse sunucu 400 ile reddediyor. Ama şirkette **2 ya da daha çok kredi kartı** tanımlıysa müşteri carisinden POS tahsilatı ekrandan **hiç girilemiyor**. Var olan POS tahsilatı da düzeltilemiyor (✎). 0 ya da 1 kartta form yanıltıcı metin gösteriyor: kart bilgi satırı ve "İşlemden Sonra: Alacak" önizlemesi.
- **Başlangıç: 2.4.3** (163dd5d6, iş listesi maddesi C13). 2.4.2'de yok. Bugünkü kodda (3e0cfd17) değişmeden duruyor.
- **Tek değişim yeri:** `client/assets/hof-accounts.js:1069`. `card` ayarı, tahsilatta yalnız "Kredi Kartına İade" kutusu formda varken verilmeli.
- **Kullanıcıya sorulacak iki okumalı para kuralı yok** (ders 43). Plan §4.6 tablosu açık: "Satış, tahsilat (giriş) → POS tahsilatı → POS + POS Taksit Sayısı". Müşteride kutunun olmaması 2.4.3 C13 kararı.

## 1. Yeniden üretim (kanıt)

Betik: `/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/p1-pos-050a72f9/betik/p1-pos-kart.mjs`
(özetleyici `betik/ozet.cjs`). Kullanım: `ROOT=<kod kökü> OUT=<klasör> CARDS=0|1|2 node p1-pos-kart.mjs`.
Çıktılar `…/p1-pos-050a72f9/cikti/<sürüm>-kart<n>.log` ve `…/cikti/<sürüm>-kart<n>/{sonuc.json,*.png}`. Her adımda şunlar okunur:
- POST'un yanıt kodu, gönderilen gövde ve yanıt gövdesi;
- formdaki hata yazısı;
- `account_entries` satırında `fin_ref` alanının hangi hesap olduğu (POS / KART1 / KART2);
- `pos_sales` satırı;
- bakiyeler: Ziraat, kart1, kart2, POS Bekleyen brüt, Kasa;
- Mutabakat Testi.

Kurulum: Ziraat vadesiz hesap (100.000), bir POS ("Ziraat Fiziki POS"), kart sayısına göre 0, 1 ya da 2 kredi kartı ("World", "Bonus"). Cariler: müşteri ABC Ltd., tedarikçi Toptancı A.Ş.

### 1a. Müşteri + Tahsilat 500, yol POS (bugünkü kod, 3e0cfd17)

| Kart | Formda ne görünüyor | Gönderim / yanıt | Yazılan satır | Bakiye etkisi |
|---|---|---|---|---|
| 0 | "Kredi Kartına İade" kutusu yok; **"Kredi Kartı Tanımla — Tanımlamadan kaydederseniz hareket Hesabı Atanmamış Eski Hareketler'de kalır."** (yanlış: hareket POS'a gider) | POST 200 | in 500 card → **POS** | POS Bekleyen +500; kartlar yok |
| 1 | **"Ziraat Bankası · World kredi kartına yazılır. Kart: Borç ₺0,00 · İşlemden Sonra: Alacak ₺500,00"** (yanlış: kart değişmez) + POS alanı | POST 200, gövdede kart kimliği yok | in 500 card → **POS** | POS Bekleyen +500; kart1 0 → 0 |
| 2 | **"Kredi Kartı *" zorunlu seçici, boş gelir** + POS alanı | **POST YOK**: `"Kredi Kartı" alanı boş bırakılamaz.` | yok | değişmez |
| 2 (A2: kullanıcı kart seçerse) | aynı | POST **400** `bank-account-invalid` "POS tahsilatı ve POS iadesi banka hesabına bağlanmaz; POS seçin (banka hesabı alanını boş bırakın)." Gövdede `bankAccountId=<kart>`, POS alanları düşmüş | yok | değişmez |

Ekran görüntüsü: `…/cikti/yeni-kart2/02-A-sonra.png`. Görüntüde aynı anda şunlar var: zorunlu "Kredi Kartı" seçicisi, "Ziraat Fiziki POS POS'una yazılır." satırı ve kırmızı "boş bırakılamaz" yazısı. Kodda hiçbir durumda paranın karta yazıldığı görülmedi. Görevdeki "tek kartta para karta gider mi" (YÜKSEK) sorusunun yanıtı **HAYIR**. Tek kart, seçicinin "tek hesap bilgi satırı" kipindedir ve kimlik göndermez (`hof-bank.js:2890`). Gövdede kart yoktur, sunucu POS'a yazar.

### 1b. Komşular (ders 10), bugünkü kod

| Adım | 0 kart | 1 kart | 2 kart |
|---|---|---|---|
| E Müşteri POS tahsilatının düzeltmesi ✎ (API ile 700 POS, ekrandan 650) | 200, satır POS 650 (form yine "Kredi Kartı Tanımla" yazıyor) | 200, satır POS 650 (form "World kredi kartına yazılır" yazıyor) | **POST YOK**, "Kredi Kartı alanı boş bırakılamaz"; satır 700 POS'ta kaldı. **Düzeltilemiyor** |
| B Tedarikçi − Ödeme 300, Kredi Kartı | 200, satır hesapsız (beklenen: kart yok) | 200 → KART1, kart −300 | 200 → seçilen KART2, kart2 −300 |
| C Tedarikçi + Tahsilat 100, "Kredi Kartına İade" işaretli | 400 "Kredi Kartına İade için etkin bir kredi kartı hesabı gerekir…" (beklenen) | 200 → KART1, borç 300 → 200, POS satışı yok | 200 → KART2, borç 300 → 200, POS satışı yok |
| D Tedarikçi + Tahsilat 50, kutu işaretsiz (POS) | 200 → POS | 200 → POS | 200 → POS (kart seçici gizli) |
| F Banka → POS → POS İşlemleri → İade 100 | 200, iade 100, POS Bekleyen −100 | 200 | 200 |

Mutabakat Testi her adımdan sonra "tamam". Kasa her durumda 0 (POS / kart Kasa'ya girmez).

### 1c. Hangi sürümden beri (eski kodun gerçek kopyası, ders 23/25)

Kopyalar `git archive` ile `…/p1-pos-050a72f9/eski-v2.4.x` klasörüne açıldı. `node_modules` için sembolik bağ kuruldu, npm koşulmadı. Koşudan sonra kopyalar silindi.

| Sürüm | 2 kart, A (yeni tahsilat) | 2 kart, E (düzeltme) | 1 kart, form |
|---|---|---|---|
| v2.4.2 | kutu görünür, kart seçici **gizli**, POST 200 → POS | 200 → POS | kart seçici gizli |
| v2.4.3 | **"Kredi Kartı" boş bırakılamaz**; kart seçilirse **400** | **boş bırakılamaz** | "World kredi kartına yazılır" + "Alacak ₺500" görünür |
| 3e0cfd17 (bugün) | v2.4.3 ile aynı | aynı | aynı |

Kök neden commit'i: `git log -S'account.type !== "customer" || entry?.cardRefund' -- client/assets/hof-accounts.js` → 163dd5d6 "DestekOfis 2.4.3 (#33)" (C13, d64ebf8 dalı).

## 2. Kök neden

1. `client/assets/hof-accounts.js:1052`: 2.4.3 C13 ile "Kredi Kartına İade" kutusu müşteride çizilmiyor (`account.type !== "customer" || entry?.cardRefund === true`). Bu bilinçli bir karardı.
2. `client/assets/hof-accounts.js:1069`: kart seçici ayarı (`card`) tahsilatta (`type === "in"`) cari türüne bakmadan **her zaman** veriliyor. Bu, C13'te kutuyla birlikte daraltılmadı.
3. `client/assets/hof-bank.js:2970` (`syncPickers`): kart seçicisini tahsilatta yalnız kutu işaretliyken açar. **Kutu formda yoksa** (`!refundToggle`) bu durum "ödeme formu" sayılır ve seçici yol Kredi Kartı iken açılır. Bu satırdaki not ("kutusu olmayan formlar (ödeme) eskisi gibi") 2.3.0'ın varsayımıdır: tahsilatta kutu her zaman vardı.
4. `client/assets/hof-bank.js:3191-3194` (`accountBody`): kutu yokken seçilen kartı `bankAccountId` yapar ve POS alanlarını düşürür. Sunucu (`server/lib/bank/module-ref.mjs:95` → `server/lib/bank/pos.mjs:432`) bunu 400 `bank-account-invalid` ile reddeder. **Sunucu doğru davranıyor**: para yanlış hesaba yazılmıyor.

Neden testler görmedi:
- `test/e2e/senaryo-cari-243.mjs` C13 adımında (satır 281–306) hiç kart tanımlı değildi. Yalnız "kutu yok" denetlendi, kart seçicinin görünmesi denetlenmedi.
- `test/e2e/senaryo-iz32-230.mjs` adım 4'te tek kart vardı. Tek kart bilgi satırı kipinde kimlik gönderilmediği için POS kaydı (CARI77) yeşil geçti; yanıltıcı "kredi kartına yazılır" satırı okunmadı.
- 2 kartlı bir müşteri POS tahsilatı hiçbir testte yok.

## 3. Tek değişim yeri ve en küçük düzeltme

`client/assets/hof-accounts.js` `editEntry`. Kutunun koşulu bir kez hesaplanır, hem alan hem `card` aynı değeri kullanır:

```js
// alanlardan önce
const refundBox = type === "in" && Boolean(HOF.bank?.attachPicker) && (account.type !== "customer" || entry?.cardRefund === true);
// :1052
...(refundBox ? [{ name: "cardRefund", … }] : []),
// :1069
const card = type === "out" ? { …değişmez… } : refundBox ? { value: entry?.cardRefund === true ? entry.finRef || "" : "", keepLabel: "" } : null;
```

Sonuç: müşteri tahsilatında `setup.card = null` olur. Bunun etkileri:
- kart seçici hiç kurulmaz: ne "Kredi Kartı Tanımla", ne bilgi satırı, ne zorunlu seçim;
- `accountBody`'de `cardAccountId` yoktur, POS alanları gider;
- `hof-bank-defined` (kind card) ve `refreshPickers` da `setup.card` boşken kart seçicisi kurmaz (`placePickers` `if (card)`).

Sunucu, `hof-bank.js` ve öbür formlar değişmez.

İsteğe bağlı savunma (öneri, zorunlu değil): `hof-bank.js:2970` koşulu, kutusu olmayan **giriş** formunda kart seçicisini açmayacak biçimde sıkılaştırılabilir: `setup.sign < 0 || refundToggle?.checked`. Bugün `type "in"` için `card` veren tek çağıran hof-accounts olduğundan gerekmez. Yapılırsa ödeme formlarının (sign −1) etkilenmediği B satırlarıyla gösterilmeli. Önerim yalnız hof-accounts değişikliği: tek yer, en küçük fark.

## 4. Çağıranlar / komşular (attachPicker'a `card` verenler)

| Çağıran | `card` | Bu düzeltmeden etkilenir mi |
|---|---|---|
| `hof-accounts.js:1075` cari Tahsilat / Ödeme | out: hep; in: **düzeltmeyle yalnız kutu varken** | evet (tek yer) |
| `hof-invoices.js:2806` fatura ödeme | satışta `null`, alışta `{}` | hayır |
| `hof-stock.js:400` stok | yalnız alımda (`incoming && !back`) | hayır |
| `hof-plans.js:795` taksit tahsilatı / iadesi | yok (yalnız `pos`) | hayır |
| `hof-workspace.js:358` kayıt tahsilatı | yok | hayır |
| `hof-cheques.js:419` çek / senet | yok | hayır |
| `hof-bank-pos.js:681` POS İşlemleri → İade | attachPicker yok | hayır |

Yardım metni (`syncEntryHelp`, hof-accounts.js:72-82) kart seçicisini yalnız `type === "out" || refund` iken okur. Müşteride metin zaten POS'a göre doğru: "seçilen POS'a yazılır". Değişmez.

## 5. Nasıl bozulur (test listesinin kaynağı)

1. Müşteri, 2+ kart, yeni POS tahsilatı (bugün kilitli).
2. Müşteri, 2+ kart, var olan POS tahsilatını ✎ düzeltme (bugün kilitli).
3. Müşteri, 1 kart: "kredi kartına yazılır" ve kart bakiye önizlemesi "Alacak" (yanıltıcı).
4. Müşteri, 0 kart: "Kredi Kartı Tanımla / Hesabı Atanmamış'ta kalır" (yanıltıcı).
5. Müşteride eski `cardRefund=true` satırının düzeltmesi. 2.3.0–2.4.2 arasında müşteriye "Kredi Kartına İade" girilmiş olabilir. Bu satırda kutu ve kart seçicisi **kalmalı**, kayıt karta yazılmaya devam etmeli. Düzeltme `refundBox`'ı kutuyla aynı koşuldan aldığı için korunur. Test ile gösterilmeli.
6. Yol değiştirme sırası: Nakit → POS → Havale/EFT → POS (Tab ile, insan hızında). Havale seçicisi ve POS alanı doğru açılıp kapanmalı.
7. Formdan "POS Tanımla" ya da "Kredi Kartı Tanımla" ile yeni hesap tanımlama (`hof-bank-defined`). Müşteride kart seçicisi yeniden doğmamalı.
8. Sunucu `bank-account-required` → `refreshPickers` yeniden kurulum. Müşteride kart seçicisi doğmamalı.
9. Tedarikçi / "Diğer" cari, 2 kart: kutu işaretsiz → POS; işaretli → seçilen karta (gerileme koruması).
10. Ödeme (out), her cari türü, 0/1/2 kart: kart seçicisi aynen kalmalı.
11. POS tanımsız (0 POS) + 2 kart, müşteri: POS alanı "POS Tanımla" der, kayıt bugünkü gibi 108.00 hesapsız. Kart seçicisi engel olmamalı.
12. Aynı adlı müşteri ve tedarikçi (tür farkı): kutunun ve seçicinin tür üzerinden doğru caride çıktığı başlıktaki Cari No ile okunur.
13. Yetkisiz kullanıcı (`bank.move` yok): müşteri POS tahsilatı yine girilebilmeli (POS tahsilatı giriştir, `requireBankOut` yalnız out).

## 6. Test matrisi (ders 7, 38: eski kodda BEKLENEN nedenle kırmızı)

Önerilen yer: `test/e2e/senaryo-iz32-230.mjs` adım 4. Bu dosya ci.yml'de var (satır 118) ve tek kartlı. Adıma ikinci bir kart eklenir, müşteri hücreleri yazılır. Ya da yeni bir `test/e2e/senaryo-pos-kart-249.mjs` yazılıp ci.yml'e ve `--beklenen` listesine eklenir. Her hücre DB satırını ve bakiyeyi okur (ders 3).

| # | Hücre | Yeni kodda beklenen | Eski kodda (3e0cfd17) beklenen kırmızı ve NEDENİ |
|---|---|---|---|
| T1 | Müşteri, 2 kart, + Tahsilat 500 POS | kart seçici yok; POST 200; satır `fin_ref = POS`; `pos_sales` 1 sale 50000; POS Bekleyen +500; kart1/kart2 değişmez; Mutabakat tamam | POST yok, form hatası `"Kredi Kartı" alanı boş bırakılamaz.` (iletide bu metin görülmeli; başka bir neden kırmızı sayılmaz) |
| T2 | Müşteri, 2 kart, ✎ 700 → 650 | POST 200; satır 650, `fin_ref = POS`; POS Bekleyen −50 | aynı iletiyle POST yok; satır 700 kalır |
| T3 | Müşteri, 1 kart, form | `[data-bank-pick="card"]` yok; "kredi kartına yazılır" metni yok; kayıt POS | `[data-bank-pick="card"]` görünür, metin "World kredi kartına yazılır" (kayıt eski kodda da POS'a: yalnız ekran hücresi kırmızı) |
| T4 | Müşteri, 0 kart, form | "Kredi Kartı Tanımla" yok | "Kredi Kartı Tanımla" görünür |
| T5 | Müşteride eski `cardRefund=true` satırı ✎ (2 kart) | kutu işaretli, kart seçici görünür, kaydet → `fin_ref` = aynı kart | yeşil (gerileme koruması) |
| T6 | Tedarikçi, 2 kart, Kredi Kartına İade 100 | → seçilen kart, borç azalır, POS satışı yok | yeşil |
| T7 | Tedarikçi, 2 kart, kutu işaretsiz POS 50 | → POS | yeşil |
| T8 | Tedarikçi − Ödeme kart, 0/1/2 kart | 0: hesapsız; 1: KART1; 2: seçilen | yeşil |
| T9 | Yol sırası Nakit → POS → Havale → POS (Tab, insan hızı), müşteri 2 kart | gönderilen gövdede `bankAccountId` yok, POS alanları var | ilk POS'ta kart seçici zorunlu → T1 nedeniyle kırmızı |
| T10 | POS İşlemleri → İade 100 | 200, refund 10000 | yeşil |

Mutasyon (ders 7): düzeltme geri alınırsa (`card` yine her tahsilatta verilirse) T1, T2 ve T9 yukarıdaki iletiyle kırmızı olmalı. Kırmızının metni iletide okunur (ders 38).

Koşulacak komşu e2e'ler (ders 9, 37: adayda zaten bütün liste koşar):
- senaryo-iz32-230, senaryo-cari-243 (C13), senaryo-pos-220;
- senaryo-banka-210 ve senaryo-banka-210b: cari tahsilat / ödeme kart yolları;
- kilavuz-metin: B4'ün bulgu satırı düzeltmeden sonra "BULGU" yazmamalı;
- senaryo-form-izolasyon-243 ve esc-kapat kullananlar: formdan bir alan kalkıyor, "Kaydetmeden Kapat" sorusu değişebilir (ders 34).

## 7. Kullanıcıya soru

**Yok.** Plan §4.6 "Alan, yöne göre değil belge türüne göre" tablosu tahsilat için yalnız POS öngörür. Müşteride "Kredi Kartına İade" kutusunun olmaması 2.4.3 C13 kararı. Düzeltme yeni bir para kuralı getirmez, kayıt yolunu değiştirmez; yalnız C13'ün eksik kalan yarısını tamamlar. Sunucu bugün de doğru hesabı seçiyor ya da reddediyor.

## 8. DENENEN / DENENMEYEN / BİLİNEN SINIRLAR

- DENENEN: Ekrandan 0/1/2 kart × A (müşteri POS tahsilatı), A2 (kart seçilirse), B (tedarikçi kart ödemesi), C (Kredi Kartına İade), D (tedarikçi POS), E (müşteri POS düzeltmesi), F (POS İşlemleri İade). Kod: 3e0cfd17, v2.4.3 (2 ve 1 kart), v2.4.2 (2 ve 1 kart). Her adımda yanıt, gövde, DB satırı, bakiye ve Mutabakat Testi okundu.
- DENENMEYEN: Windows (yalnız istemci kodu; platforma bağlı değil). "Diğer" türü cari. Yetkisiz kullanıcı. POS tanımsız + 2 kart. Eski `cardRefund=true` müşteri satırının düzeltmesi (T5). v2.3.0 ve v2.4.4–v2.4.7 ayrıca koşulmadı: satırlar 2.4.3'ten beri değişmedi (`git log -S`). v2.4.8 etiketi bu klonda yok, bugünkü kod 2.4.8'in üstünde.
- BİLİNEN SINIRLAR: Betik çıktısındaki "Kasa" alanı, `/api/workspace/cash` yanıtından okunabilen ilk bakiye anahtarıdır. Kasa'ya giren adım olmadığı için 0 beklenir ve 0 okundu. Kasa'ya giren bir adım bu betikte denetlenmedi.

## ANA OTURUM ONAYI (03.11.2026 ~19:50 UTC) — kodlama bu bölümle birlikte okunur
ONAY: sınıf ORTA (ekran görüntüsüyle doğrulandı: yeni-kart2/02-A-sonra.png — "Kredi Kartı *" boş, "Kredi Kartı alanı boş bırakılamaz"). KARAR REVİZYONU (ORTA bu sürümde)
gereği 2.4.9'a girer — BAŞ MİMAR KARARI; yeni para kuralı yok (plan §4.6 + 2.4.3 C13). Önerilen tek değişim (client/assets/hof-accounts.js, refundBox koşulu kart ayarına da
uygulanır), T1–T10, T5 gerileme koruması (2.3.0–2.4.2 müşteri cardRefund=true satırı), 0/1 kartta yanlış bilgi metinlerinin düzelmesi de testte görülür. Kod ajanı high.
