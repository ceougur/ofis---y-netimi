# M5 — Mobilden Yazma: Tahsilat, Ödeme, Taksit Tahsilatı, Stok Girişi (2.4.7)

Kaynak: CLAUDE.md Açık iş "MOBİL" (26.10.2026: "görüntüleme + canlı + tahsilat TEK SÜRÜM 2.4.7"; "MOBİL YAZMA: … mevcut API üzerinden; para çekirdeği
kurallarıyla, kâhin + mutasyon testi zorunlu"); `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.1; `docs/2.4.7-IS-LISTESI.md` "KARARLAR — M5" S1–S8 (kullanıcının
5 dk yetkisiyle, 29.10.2026; AYNEN uygulandı); bağımsız kâhin `test/bagimsiz/mobil-yazma/` (kodu görmeden yazıldı; `secilen_birlesim` = S1–S8).
Kod: `server/lib/mobile-write.mjs`, `client/mobil/yazma.js` + `yazma.css` + `yazma-bekleyen.js`; bağlantı satırları `server/app.mjs`, `server/lib/mobile.mjs`,
`client/mobil/app.js`, `client/mobil/index.html`.

## 1. İlke: yeni para mantığı yok

Telefonun her yazma isteği, masaüstünün kullandığı MEVCUT uca çevrilir ve olağan yoldan geçer:

| Mobil uç (POST) | Programın ucu | Sabit alan | İzinli alan |
|---|---|---|---|
| `/api/mobil/accounts/:id/tahsilat` | `/api/workspace/accounts/:id/entries` | `kind: in` | `amount, method (cash/bank/card=POS), bankAccountId, posId, note, similarOk` |
| `/api/mobil/accounts/:id/odeme` | `/api/workspace/accounts/:id/entries` | `kind: out` | `amount, method (cash/bank/card=Kredi Kartı), bankAccountId, note, similarOk, cashForce` |
| `/api/mobil/plans/:id/tahsilat` | `/api/workspace/plans/:id/entries` | `kind: in` | `amount, method, bankAccountId, posId, note, similarOk, overpay` |
| `/api/mobil/stock/:id/giris` | `/api/workspace/stock/:id/moves` | `kind: in, pay: none` | `qty, note` |

Seçici: `GET /api/mobil/bank/choices` → `/api/workspace/bank/choices` (masaüstü formlarının hesap / kart / POS seçicisi; ucun kendi yetkisi).

Sıra: (uzaktan) M2 kapısı — cihaz, lisans, yol, uzak oturum (P6) → beyaz liste + alan denetimi (bu katman) → programın ucu: şirket erişimi (`hofCompany`;
olmayan 409, yetkisiz 403), istek kaynağı, lisans (salt okunurda yazma yok), rol yetkisi, istek kimliği (`bank.post`; `request_keys` şirketin veri dosyasında),
FIFO / taksit K8 / Kasa ve banka eksi bakiye / Benzer İşlem / dönem kilidi / ileri tarih. Böylece aynı iş iki kanalda aynı defter, Kasa, banka, fatura kapama ve
taksit sonucunu verir (kâhin K1 eşdeğerlik; 9 eşdeğerlik çifti + 4 göreli çift).

## 2. Kullanıcı kararları (S1–S8) programda

- **S1** Kapatılacak Fatura yok: `invoiceId` / `refundOf` alanı 400 `mobile-field` (sessizce FIFO'ya çevrilmez). Formda bilgi notu "en eski açık borcu kapatır".
- **S2** Çek / senet yok: yol yalnız Nakit, Havale / EFT, POS (tahsilat) / Kredi Kartı (ödeme); başka yol 400; evrak ucu beyaz listede yok.
- **S3** Taksit kartına tahsilat var (Tahsilat Yeri seçimi); K8 aynen (plan-paid, plan-overpay, Fazlasını Avans Yaz yalnız `plans.manage`).
- **S4** Sorular masaüstüyle aynı: 409 `cash-negative` / `bank-similar` → "Yine de Kaydet"; 409 `plan-overpay` / `plan-paid` → "Fazlasını Avans Yaz" (yalnız
  yetkiliye, masaüstü `hof-plans.js` gibi). Onay aynı istek kimliğiyle; bayraklar istek içeriğine girmez (`idempotency.mjs` VOLATILE).
- **S5** Eksi stok masaüstü gibi sorar (stok ucu; mobilde yalnız giriş olduğundan soru doğmaz).
- **S6** Tarih sunucunun günü: telefon tarih göndermez, `date` alanı 400; uç tarih yoksa `period.today()` yazar.
- **S7** Sonucu belirsiz istek formun açılışından 24 saat içinde aynı kimlikle "Yeniden Gönder"; sonra gönderilmez (`yazma-bekleyen.js`; sürücü de aynı modülü
  kullanır).
- **S8** Stokta yalnız parasız giriş: `kind` / `pay` / `reason` / `force` alanı 400; çıkış yolu yok.

## 3. BAŞ MİMAR KARARLARI (para kuralı değil; ders 40 — kullanıcıya gösterilir)

1. Mobil yazma, programın ucuna **süreç içinde** iletilir (aynı istek işaretleri: uzak istek / uzak oturum, çerez, kaynak); HTTP vekil yok. Gerekçe: uç kodu
   tek kaynak, yetki tekrar edilmez.
2. Kapalı ya da bilinmeyen alan reddedilir (400 `mobile-field`, alan adıyla) — sessizce düşürülmez (kâhin V4; para verisi sessizce değişmez).
3. Tutar yalnız `1234,56` (virgül, en çok 2 ondalık, binlik ayırıcısız) ya da en çok 2 ondalıklı sayı; biçim dışı tutar 400 `mobile-amount`, YUVARLANMAZ
   (banka planı §9.2/9). Telefon formu "1.250,50" yazımını kendisi çevirir.
4. İstek kimliği (`x-hof-request`) ve şirket (`company=`) mobil yazmada zorunlu (400). Kimlik form açılınca telefonda üretilir.
5. Taksit seçimi yok: tahsilat kartın en eski açık taksidine yazılır (masaüstünün önerilen varsayılanı; para sonucu aynı). `itemId` 400.
6. Telefonun "Tahsilat Yeri" listesinde yalnız kalanı olan etkin kartlar; ödenmiş karta avans masaüstünden (soru yalnız sunucunun 409'unda, yetkiliye).
7. `bank/choices` seçicisi mobil beyaz listeye eklendi (yalnız GET; ucun kendi seçici izinleri ve bakiye görünürlüğü).
8. Belirsiz istekler telefonun yerel deposunda (localStorage) durur; sunucu kapalıyken kuyruk ya da kendiliğinden gönderim YOK — kullanıcı "Yeniden Gönder"e basar.
9. Oturum özetinde `writesEnabled` + `writes` (tahsilat / ödeme / taksit / avans / stok) yetki listesinden; salt okunur lisansta yetki listesi yazma yetkisi
   taşımadığı için yazma kapalı görünür. **M3 için:** şifreli özet (sunucu kapalı) sayfası `writesEnabled: false` vermeli — yazma ekranı yalnız canlı oturumda.
10. Sunucunun "bugün"ü kurulu bilgisayarın yerel günüdür (Türkiye) — masaüstüyle aynı kaynak; ayrıca sabit UTC+3 hesaplanmaz.
11. Kâhin CI'de koşar (ci.yml, kapı listesinde `kahin-mobil-yazma`); kâhinin bakımcısına iletilen okuma / model farklı R1–R3 ve E02 çifti `--haric` ile adıyla
    dışarıda (K8-AVANS kararından sonra E05 çıktı), kâhin güncellenince listeden çıkar. Gerekçe: kök nedeni yazılmış farklar kapıyı sürekli kırmızı tutmasın, kalan
    49 senaryonun gerilemesi görülsün.

## 4. Kâhin karşılaştırması ve açık konular

Ayrıntı ve sayılar: `docs/kanit/2026-10-29/m5-247/OKU-BENI.md`. Kâhinin beklentilerine dokunulmadı; yalnız `secilen_birlesim` (S1–S8) yazıldı.

- **K8-AVANS — KARAR (kullanıcı, 29.10.2026: "A ÖNERİN UYGUN"; docs/2.4.7-IS-LISTESI.md "KARAR — K8-AVANS"):** ödenmiş karta onaylı "Fazlasını Avans Yaz"
  `plans.manage` yetkilisine açık kalır (masaüstü 2.3.0'dan beri, mobil aynı); kart "Ödenen"i avansı içerir. Program değişmedi; kâhin bakımcısı kâhini karara göre
  güncelledi (E05 ve yeni E41 çifti eşleşiyor).
- **Düzeltilen program hatası (masaüstü, para yolu):** çek / senet girişinde kalıcı istek kimliği yoktu (plan §3.10/1 "bütün kapsamlar") — yanıtı kaybolan "Kaydet"in
  yeniden gönderimi ikinci evrak açıyor, carinin borcu iki kez düşüyordu. `server/routes/cheques.mjs` (kapsam `cheque.create`; "Yine de Kaydet" içerik sayılmaz) +
  `client/assets/hof-cheques.js` (form açılışında kimlik). Kâhin R2 d2182 / R3 d197 eşleşir.
- **Kâhinin okuma / model farkları (program değişmedi; bakımcıya iletilir):** (1) masaüstü cari / taksit tutarında 3 ondalık — plan §5.1 "Banka uçlarında `parseMinor`;
  2'den çok ondalık 400" yalnız BANKA uçları; 2.1.0 yargıç düzeltmesi (`docs/GECMIS-KARARLAR.md` "§5.1'in … kuralı yalnız BANKA uçları içindir; modül uçları (cari,
  fatura, taksit…) … 1,005 → 1,01 yuvarlar") — program doğru, kâhin 400 bekliyor; (2) gövdedeki (evrak formu) başka şirket carisi: program 400 (gövdedeki kimlik
  alanı — taksit, stok, evrak, fatura uçlarıyla aynı düzen), kâhin [403, 404] (plan §9.2/11 "başka şirketin hesap kimliği 404" banka hesabı içindir; yoldaki cari
  için program 404 verir, E16 eşleşir); (3) iki ihlalli adımda ret sırası (başka şirket carisi + seçilmemiş banka hesabı): SENARYO-DILI §5.6 sırayı ÇIKARIM sayar ve
  "senaryo tek ihlal kurar; kurarsa yalnız durum sınıfı (4xx) karşılaştırılır" der — kâhin tam kodu karşılaştırıyor; (4) E02: POS kimliğiyle havale — kâhin POS'u
  "hesap" sayıp 400 `bank-account-invalid`, programda POS banka hesabı değil → 404 `bank-account-missing`; kayıt yok.
