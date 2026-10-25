# 2.4.6 madde 9 (DB1) + madde 10 — kanıt notu (dal is/db1, taban e77447a)

## Kural (önce / sonra)
- ÖNCE (2.4.5): cari kartından girilen "Ödeme" (müşteriye) her zaman borç tarafında ödemedir (lib/invoice-settle.mjs classifyLine default). Faturasız stok
  Satış İadesi ya da fatura iadesi alacağı en eski açık faturayı / vadeli borcu kapatır, geri ödeme onu yeniden AÇMAZ → açıklar iade kadar EKSİK
  (dar2 S1: B 200 + borç 300 = 500, bakiye 800). Faturasız Alış İadesi stok formunda yoktu ('preturn' yalnız birim testte).
- SONRA: Ödeme / Tahsilat "Kapatılacak Fatura"da bir İADEYE bağlanır (account_entries.refund_of, göç v36; v2.1.0 R1 düzeni — iade belgesinin kendi geri
  ödemesi gibi). Bağlı geri ödemenin iadenin geri ödenmemiş kalanı kadarı iadenin alacağını geri alan yükümlülüktür, adım R'de o iadenin alacağıyla kapanır;
  iadenin geri ödenen kısmı faturaları / borçları kapatmaz (B 500 + borç 300 = 800 = bakiye). Cari bakiye, Kasa, yevmiye DEĞİŞMEZ.
  Stok formunda "↪ Tedarikçiye İade" ('preturn'): Açık Hesap → tedarikçide Borç "Alış iadesi" (KS7 a: en eski açık alışı kapatır), yevmiye B 320 / A 153;
  Nakit / Havale → B 100 (102) / A 153; kart yolu yok (400 preturn-card); yönetim yetkisi; taksitlendirilmez; Düzelt / Sil / geri yükle nedeni korur.

## Ana oturum kararları (docs/2.4.6-IS-LISTESI.md "KARAR — 5 DK YETKİSİYLE UYGULANDI") — nerede uygulandı
- K-a (iade kadarı geri ödeme, fazlası avans): lib/invoice-settle.mjs splitOf (kalan = iade alacağı − iade belgesinin kendi geri ödemesi − önceki bağlı geri
  ödemeler, satır sırasıyla; refund = min(tutar, kalan), excess → bağsız ödeme havuzu); routes/accounts.mjs refundLink tutar sınırı KOYMAZ (fazla geri ödeme
  reddedilmez); iade silinir / iptal edilir / küçülürse bağ durur, kalan 0 → tamamı avans. Önceki "iadeyi aşan bağ 409" ve iade/stok düzeltme engelleri KALDIRILDI.
- K-b (bağsız Ödeme açık iadeler + elle Alacak tek FIFO): invoice-settle.mjs openNotes/pseudo — açık iade notu karşı tarafta tarih sırasıyla sözde yükümlülük
  olarak FIFO'ya girer (yalnız freeMoney: cari kartı / çek satırı, iade bağı olmayan); iki geçiş yalnız gerektiğinde (runs = runAll(pseudoBySide)).
- K-c (tedarikçinin Tahsilat ile geri ödemesi alış iadesine): refundTargetOf refundKind 'in' (purchase_return, stok 'preturn'); classifyLine bağlı Tahsilat → payDue.
- K-d (Ödeme'de Kapatılacak Fatura = müşterinin İADE belgesi): accounts.mjs invoiceLink yönleri (sale/smm→in, purchase→out, sale_return→out, purchase_return→in);
  entryInput iade kimliğini refund_of'a yönlendirir (invoice_id boş kalır → şüpheli alacak / fatura bağı etkilenmez); istemci tek açılır liste (hof-accounts.js
  openInvoiceOptions refundables). Öbür yönler aynen reddedilir (refund-side 409, refund-with-invoice 400, refund-missing 404, refund-not-return 409, refund-invalid 409).
- K-e (her ödeme yolu): nakit / havale / kart cari satırı; çek / senet: cheque_events.invoice_id iade faturasına (verilen evrak → satıştan iade, alınan → alıştan
  iade); integrity-scope.mjs CHEQUE_BOND_BAD iade yönlerini kabul eder; hof-cheques.js listesi faturasız stok iadesini göstermez (evrak bağı yalnız faturaya).
- K-f (cari türü değil açık bakiyenin tarafı): hiçbir yeni denetim cari türüne bakmaz; Tedarikçi türündeki caride satıştan iade geri ödemesi testte bağlandı.

## BAŞ MİMAR KARARI — bağsız geri ödeme (ana oturum, 25.10.2026; aday246-1 cari kâhini c8: 105 fark, 38 BULGU, kök neden bu dal)
- Kaynak: DB1 karar metni (docs/2.4.5-IS-LISTESI.md ~124) örneği DÜZ cari "Ödeme" ile kurar (bağ seçimi yok), doğru sonuç 800; değişmez Σ açık = cari bakiye.
  5fa544c'de bağsız Ödeme iadenin kapattığını yeniden açmıyordu (B 200 + borç 300 = 500).
- Kural: bağsız müşteriye Ödeme / tedarikçiden Tahsilat (evrak dahil) önce K-b ile açık iadeleri ve kendi tarafının yükümlülüklerini kapatır; ARTANI, karşı tarafta
  alacağı bir faturayı / borcu kapatmış iadenin (en eski önce) geri ödemesi sayılır — iade o kadar kapatıcı olmaktan çıkar. Açık bağ önce (bölmede önce düşer).
  Üst sınır: iadenin geri ödeme dışında kapattığı (asıl faturaya mahsup + en eski borçlar). Tarih koşulu yok. Fazlası avans (K-a gibi).
- Yer: lib/invoice-settle.mjs implicitOf (+ splitOf parts, close() closing sayacı, entries birleştirme); yalnız gerektiğinde bir geçiş daha.
- Taksitli fatura (v2.0.24 değişmezi açık = kartın kalanı; mutabakat-cekirdek tohum 2 yakaladı: "açık 67.55 ≠ imzalı açık hedefi 0,00"): taksitli faturaya mahsup üst
  sınıra girmez; açık bağ da taksitli faturanın iadesine kurulmaz (routes/accounts.mjs refundLink + invoiceLink 409 refund-planned, seçeneklerde yok; evrak da) —
  cari Tahsilat'ın taksitli faturaya bağlanmaması (v2.0.23) düzeni. Geri ödeme taksit kartından ya da iade belgesinden.
- Eski veri: v2.4.5'in bağsız geri ödemeleri göçten sonra kendiliğinden iadenin geri ödemesi sayılır (B 200 → 500, B2 200 → 500); bakiye, mizan, Kasa aynı.
- Kırmızı (5fa544c ayrı kopyada — git archive; göç testi git worktree'de, etiket gerekir): kirmizi-5fa544c-bagsiz-geri-odeme 23/35 (12 kırmızı: bağsız B 200 ≠ 500,
  kısmi, K-b sonrası artan, fazla, açık bağ + bağsız, fatura iadesi K1, tedarikçi simetriği, en eski iade önce, belge geri ödemesi üst sınırı, Σ açık = bakiye
  değişmezi, API bağsız B 500, taksitli iadesi seçeneklerde yok) · kirmizi-5fa544c-goc-bagsiz 0/1 ("bağsız eski geri ödeme iadenin geri ödemesi: B 500").
  Eski kodda yeşil kalan 23: önceki madde 9 testleri + "açık bağ bağsızdan önce" ve "bağsız olmayan alacak" bekçileri (mutasyon öldürücü; kırmızı kanıt sayılmaz).
- Yeşil: yesil-iade-geri-odeme 35/35, yesil-stok-alis-iadesi 6/6, yesil-goc-246-iade-bagi 1/1; komsu-92-dosya-bagsiz 868/868 (mutabakat-cekirdek dahil; ilk koşuda
  taksitli fatura bulgusu 866/867 → düzeltildi).
- Mutasyon (40): mutasyon-bagsiz.json 34/40 — kaçan Ke1, M9, M21 (bağsız para da aynı iadenin geri ödemesi sayılınca açık bağın farkı yalnız elle Alacak varken
  görünür), Im2 (üst sınır), Im6 (en eski iade), Im7 (yalnız bağsız para) → dört test eklendi → mutasyon-bagsiz-ek.json 6/6, düşen testler amaçlanan testler. 40/40.
- Kâhin (cari, test/bagimsiz — kodu görülmeden koşucu olarak, değiştirilmeden; kahin-cari-bagsiz/): c8 507/551 (44 fark, HEPSİ projeksiyon — madde 11, bu dalda
  yok; 5fa544c'de 94 fark / 50 projeksiyon dışı), c8b 57/63 (6 fark, hepsi projeksiyon), rastgele-s1-1 578/613 (35 fark: 20 projeksiyon + 15 İNCELE YAYGIN
  "KS9 Alış İadesi bağsız ödeme; geri tahsil edilen kısmı değil — KARAR GEREKİR K-c": A1 alış faturası ve açılış S — aday246-1 koşusunda (5fa544c içeren) AYNI
  program değerleriyle vardı, bu değişiklikten değil; aday koşusundaki 28 G3 / G4 / s010 farkı bu değişiklikle kapandı).
- Son zincir (kararla birlikte): e2e-senaryo-iade-246 26/26, e2e-e2e 50/50 (flock), mutabakat-600-t3 GEÇTİ (flock), tam npm-test 3580/3580 (çıkış 0; ders 41).

## Bağımsız dar kontrol düzeltmeleri (aday246-2 bc1253c; kanıt dal is/dar-246 775161d docs/kanit/2026-10-25/246-dar) — 49c41f9 üstüne
- Yeniden üretme (betikler 246-dar/betik, not defteri kopyası; dar-yeniden/once-49c41f9 → dar-yeniden/sonra):
  - B1 (ORTA) f2 bağsız: Vade Takip / projeksiyon 1.300 → 1.000 (fatura kalemi yok; kart 500 + 500). Kök: kapsam döngüsü bağsız geri ödemeyi görmüyordu → kapsam ve
    son kapama aynı `passes` (açık bağ + K-b + KS8.1) ile. m-goc (v2.4.5 gerçek kodu → güncel): M Altı 1.300 → 1.000 (betik sonra açılış dalının is_opening kolonunu
    okurken düşer — o kolon bu dalda yok; göç adımı 2 çıktısı tam).
  - B2 (ORTA) saf1: Ödeme 350/400/500 → Borç kalan 50/100/200 (= bakiye; 600 → 100 avans, K-a); fatura iadesi 400/500 → S açık 100/200. f1a Borç 100, f1b A 200 / iade 0,
    e-supheli tedarikçi Alacak 100, f1-bagli aynı. Kök: son geçişte açık iade kalemi ile adım R aynı açığı iki kez tüketiyordu → K-b'nin açık iadeye verdiği bağsız para
    da iadenin GERİ ÖDEMESİ (adım R'de), son geçişte açık iade kalemi yok; eski karşı taraf adımı kalktı. m-goc M Yedi (F1 düzeni) Borç 100.
  - B3 (DÜŞÜK, ders 31) g-sira: aynı gün + aynı kayıt anında yazım sırası (girdinin sırası; rank) → "iade önce" Alacak 200, "Alacak önce" 0.
- Kırmızı (49c41f9 ayrı kopyada): kirmizi-49c41f9-dar-b1-b3 35/43 (8 kırmızı: B2 F1a / değişmez / bir kez tüketim / tedarikçi, B3 saf, B1 API, B2 F1b API, B3 API —
  nedenleri iş sayısı). Yeşil: yesil-iade-geri-odeme 43/43.
- Mutasyon: mutasyon-dar.json 43/44 (+ B1m, B2m, B2m2, B3m; Im1 dizgesi güncellendi) — kaçan B2m2 (son geçişte açık iade kalemi kalır) → "bir kez tüketilir" testi →
  mutasyon-dar-ek.json 1/1. 44/44.
- Kâhin (cari, commit'li 5e7905a, varsayılan kural, kodu görülmeden; kahin-cari-varsayilan/): 7006 denetim, 293 fark, 0 okuma hatası, 0 yakalanmayan mutasyon, 7 bilinen
  sınır: 278 projeksiyon (madde 11 bu dalda yok; dar kontrolün birleşik ağacında 0) + 15 İNCELE YAYGIN rastgele-s1-1 tedarikçi S (K-c — kc-deneme-OZET.txt; KARAR GEREKİR).
- Son zincir (B1–B3 ile): komsu-92-dosya-dar 880/880 (mutabakat-cekirdek, taksitli fatura v2.0.24 dahil), e2e-senaryo-iade-246 26/26, e2e-e2e 50/50 (flock),
  mutabakat-600-t3 GEÇTİ (flock), tam npm-test 3588/3588 (çıkış 0; ders 41).
- K-c: ana oturumun "önce iadenin geri ödemesi" yönergesi K-b (tek sıra, en eski önce), KS8.1 "önce kendi tarafı" testi ve B3'ün "Alacak önce → 0" beklentisiyle
  çelişiyor; deneme kâhinin beklentisini de karşılamadı → UYGULANMADI, karar ana oturumda (kc-deneme-OZET.txt).

## Yeniden üretme (ders 6)
- dar2 betiği (docs/kanit/2026-10-24/245-dar2/betik/s1-iade-geri-odeme.mjs) e77447a'da koşuldu: "Stok İadesi + Cari Ödeme" B 200, Σ 500 ≠ 800;
  "Fatura İadesi + Cari Ödeme" B 200, Σ 500; "Kendi Geri Ödemesi" 500/800 (not defteri 246-db1/yeniden/s1-e77447a.json).

## Kırmızı / yeşil (ders 7, 23, 38)
- Eski kod AYRI KOPYADA (git archive e77447a → not defteri 246-db1/eski-e77447a; kanıt aracı commit alanı "undefined" çünkü kopya git deposu değil):
  kirmizi-e77447a-iade-geri-odeme 4/23 (19 kırmızı; ilk düşen denetimler iş sonucu: "200 !== 500" B açığı, "200 !== 300" kısmi, ret beklenirken 200/404,
  K-b "Alacak 0 ≠ 200") · kirmizi-e77447a-stok-alis-iadesi 1/6 (5 kırmızı). Eski kodda yeşil kalan 5 test eski davranışın KORUNDUĞUNU denetler (bağsız
  Ödeme/Tahsilat R1c, bağsız iade B 200, iadesi silinmiş bağ = bağsız, elle Alacak iadeden eskiyse önce Alacak, KS7.1 nedensiz çıkış) — gerileme bekçisi,
  kırmızı kanıt sayılmaz.
- Yeni kod: yesil-iade-geri-odeme 23/23, yesil-stok-alis-iadesi 6/6, yesil-goc-246-iade-bagi 1/1 (v2.4.5 gerçek kodu; tek test, çok denetim).

## Mutasyon (ders 7, para çekirdeği)
- Not defteri 246-db1/mutasyon.py (ayrı kopyada, her mutasyon sonra geri alınır). Tur 1 (K kararlarından önce): 21'in 18'i; kaçan M7, M19, M20 için test →
  tur 2 4/4 (mutasyon-sonuc.json, mutasyon-ek.json). SON TUR (K kararlarıyla, 30 mutasyon: invoice-settle bölme/yan/FIFO/çek bağı, accounts bağ/yön/K-d
  yönlendirme/kalan, integrity kapısı, göç, takvim parmak izi): 29/30 (mutasyon-son.json); KAÇAN Ka3 (iade belgesinin kendi geri ödemesi kalandan düşmüyor —
  B yine 500, fark yalnız bağlı satırın Kalan'ında) → "iade belgesinin kendi geri ödemesi" testine çekirdek Kalan denetimi eklendi → Ka3 YAKALANDI
  (mutasyon-ka3.json; düşen test adı bu test).

## Komşular (ders 10)
- K kararlarından önce komsu-79-dosya 718/718. K kararlarından sonra komşu birim/API dosyaları tam npm test içinde: npm-test 3568/3568 (çıkış 0, iptal/atlanan 0;
  ders 41: bir kez, bitişte).
- e2e komşuları (K kararlarından ve birleşik açılır listeden SONRA, flock, kanıt aracı; e2e-*.json): ana e2e 50/50, 211 58/58, 213 64/64, 216 54/54, 217 65/65,
  222 60/60 (istek sayısı), banka-220 76/76, cari-243 53/53, cari-vade-245 31/31, ekstre-ayrinti-245 30/30, form-izolasyon-243 183/183, iade-246 26/26, k8-230 17/17,
  pil-karti-245 78/78, pos-220 113/113, supheli-230 67/67, tahsile-ver-220 140/140, ux18-244 27/27. Ekran: ekran/iade-246-geri-odeme.png (Ödeme formunda
  Kapatılacak Fatura = "İade Geri Ödemesi · Satış İadesi (Faturasız) …"), ekran/iade-246-tedarikciye-iade.png.
- Mutabakat (kısa): mutabakat-600-t3 GEÇTİ (600 işlem, tohum 3; her işlemden sonra Kasa, cari, stok, taksit, fatura, çek, defter tutarlı).

## Eski sürüm verisi (ders 17, 23)
- test/goc-246-iade-bagi.test.mjs: v2.4.5 GERÇEK kodu (etiket, ayrı kopya) API'sinden veri → güncel kod: v36 kolonu boş; bakiye / mizan / Kasa v2.4.5 ile aynı;
  BAŞ MİMAR KARARI ile eski bağsız geri ödemeler iadenin geri ödemesi sayılır → B 500, B2 500, borç 300, takvim B 500 (v2.4.5'te 200 / 200); Düzelt ile bağlamak
  sayıları değiştirmez; v2.4.5'te silinen ödeme bağsız döner; geri dönüş v2.4.5 ile açılır (bakiye aynı, eski kural B 200).

## Bilinen sınırlar
- Geri Ödenen İade seçenek listesinin "kalan"ı yalnız açık bağları sayar; bağsız geri ödemenin geri ödeme sayılan kısmı listeye yansımaz (para etkisi yok: aynı
  ödemeyi sonradan bağlamak sayıları değiştirmez; yeni bir ödemeyi bu iadeye bağlamak onu öne alır, eski bağsız ödeme avansa döner).
- Taksitli faturanın iadesinin geri ödemesi cari kartından / evrakla iadeye bağlanmaz (409 refund-planned); taksit kartından ya da iade belgesinden girilir.
- K-b iki geçişli: açık iade notlarının boyu birinci geçişten alınır; aynı caride İKİ YÖNDE açık iade + iki yönde bağsız para varsa sıra yaklaşık (kırpılır).
- Faturasız stok iadesinin çek / senetle geri ödemesine açık bağ yolu yok (evrak bağı yalnız faturaya); bağsız ciro / evrak K-b FIFO ile iadeyi kapatır.
- Tedarikçiye İade'de kart yolu yok (Açık Hesap + Tahsilat → Kredi Kartına İade, Kapatılacak Fatura: bu iade).
- Göç numarası v36 (v34 / v35 öbür 2.4.6 dallarına ayrıldı); birleştirmede sıra korunmalı.
- tools m30-fark göç profili (244-245) yalnız due_date / expected_date kolonlarını bekler; 2.4.6 göç koşusunda refund_of eklenmeli.
