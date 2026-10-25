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
- test/goc-246-iade-bagi.test.mjs: v2.4.5 GERÇEK kodu (etiket, ayrı kopya) API'sinden veri → güncel kod: v36 kolonu boş, bakiye / fatura / borç Kalan'ı / mizan /
  Kasa / takvim v2.4.5 ile aynı (eski bağsız geri ödemeler kendiliğinden bağlanmaz); Düzelt ile bağlanınca B 500, B2 500, para aynı; v2.4.5'te silinen
  ödeme bağsız döner; geri dönüş v2.4.5 ile açılır (bakiye aynı, eski kural B 200).

## Bilinen sınırlar
- K-b iki geçişli: açık iade notlarının boyu birinci geçişten alınır; aynı caride İKİ YÖNDE açık iade + iki yönde bağsız para varsa sıra yaklaşık (kırpılır).
- Faturasız stok iadesinin çek / senetle geri ödemesine açık bağ yolu yok (evrak bağı yalnız faturaya); bağsız ciro / evrak K-b FIFO ile iadeyi kapatır.
- Tedarikçiye İade'de kart yolu yok (Açık Hesap + Tahsilat → Kredi Kartına İade, Kapatılacak Fatura: bu iade).
- Göç numarası v36 (v34 / v35 öbür 2.4.6 dallarına ayrıldı); birleştirmede sıra korunmalı.
- tools m30-fark göç profili (244-245) yalnız due_date / expected_date kolonlarını bekler; 2.4.6 göç koşusunda refund_of eklenmeli.
