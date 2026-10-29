# 2.4.7 SON ADAY — kullanıcı gözüyle ekran gezintisi (masaüstü + MOBİL) — ajan gezinti-247, 29.10.2026 14:17–15:00 UTC

Kod: a8f8f66b (worktree agent-ac1b032543a61bf62; ürün kodu DEĞİŞMEDİ). Program `sunucu.mjs` ile ÜRÜN varsayılanlarıyla açıldı (server.mjs bayrakları: edocEnabled, edocLive,
esmmEnabled, mobil kapıcı açık; `legacyCasePayments: false`, `legacyTableTransfer: false`, `mobileSyncAuto: true`; lisans `enforce: true`, etkin lisans). İŞ SAATİ sahte ve
akar (config.now, 21.10.2026 10:00 TR'den; masaüstü tarayıcı saati de aynı — ders 13); uzaktan erişim + lisans saati (config.remoteNow) gerçek andan akan DENETLENEBİLİR saat
(bilgisayar saati kayması adımı). Lisans servisi ve kapıcı YEREL ve sahte (test/kapi-yerel.mjs `startKapi`, https kendinden imzalı; sahte R2) — gerçek lisans servisine /
Cloudflare'e istek YOK (ders 30: HUKUK_LICENSE_URL=http://127.0.0.1:9; program fetch'i yalnız 127.0.0.1). Tünel = programın KENDİ tünel yöneticisi + sahte cloudflared
(test/fixtures/sahte-cloudflared.mjs; programın yazdığı yapılandırmayla uzak dinleyiciye ters vekil) → kapıcının canlı yolu o vekile (üretimdeki yol: telefon → kapıcı →
tünel → programın uzak dinleyicisi). Telefonun adresi üretimdeki gibi ofisin alt adı `https://oivymnex2rdpdcrdy.destekofis.test` (Chromium `--host-resolver-rules` kapıcıya).
Chromium (Playwright 1.56, headless): masaüstü 1366×768; telefonlar 390×844 dokunmatik iPhone imzası (`telefon1`, `telefon3`, `telefon4`), tablet 820×1180.

Adımlar CDP yerine sunucu sürecinin denetim ucuna gönderildi (`adim.mjs` → POST /adim): AYNI Playwright sayfaları, gerçek tıklama, insan hızında yazım (25–45 ms), Tab;
tarih kutuları `fill` (Chromium tarih kutusunda Tab gün/ay/yıl parçalarında dolaşıyor — 245 notu, 15'te yine görüldü). Her adımda yanıt kodu + gövde + veri tabanı (salt
okunur sqlite) / masaüstü API (ders 3). Adım kodları `adimlar/*.js` (sıra numaralı; "b/c/d/e" ekleri ilk denemenin aracı hatasından sonraki tekrarlardır, yorumda nedeni
yazılı). Sunucu + tarayıcı `flock <not defteri>/gez247-a8f8f66b/kos.lock` altında (ders 15). Disk başta 6,1 GB boş (ders 24). Uydurma veri (müşteri verisi yok).
Ekran görüntüleri `ekran/` (48 seçili, 128 renk), indirilen PDF/Excel `indirilen/`, sunucu olayları `olaylar.log`, sahte cloudflared günlüğü `sahte-cloudflared.log`
(belirteç yok; yalnız uzunluk/özet). Adımların ham JSON çıktıları ajan oturumundaydı; sayılar aşağıdaki tabloya AYNEN aktarıldı.

## Adım sonuçları — MASAÜSTÜ

| # | Adım | Beklenen | Gözlenen (API / DB) | Ekran | Sonuç |
|---|---|---|---|---|---|
| 1 | Giriş (kullanıcı adı, Tab, parola, Enter) | Çalışma Tablosu + Başlarken | lisans `licensed`, yazılabilir; Başlarken 5 adım | 01 | GEÇTİ |
| 2 | Başlarken → Şirket Adını Yaz → "Yıldız Duşakabin" | kaydedilir | (ilk denemede aracın seçicisi Şirket Kodu kutusunu seçti → program "üç haneli olmalı" diye REDDETTİ, 400 — doğru); sirketler.json 001 "Yıldız Duşakabin" | — | GEÇTİ |
| 3 | Ayarlar → Sektörü Değiştir → "duşakabin" | Maliyet açılır | /api/maliyet/durum önce `acik:false, genel`, sonra `acik:true, dusakabin`; settings insight.sector dusakabin; bildirim "Görünüm tüm bilgisayarlarda güncellendi" | 03 | GEÇTİ |
| 4–5 | Banka Kurulum Sihirbazı: Ziraat · Ana TL Hesabı, açılış 10.000, Bakiye Doğrulandı | hesap + açılış | POST bank/accounts 200; ZIR-TL 102.01 ₺10.000,00 Bakiye Doğrulandı | 05 | GEÇTİ |
| 6–7 | Cari → + Yeni Cari: Ayşe Demir, 0532 111 22 33 → "Cariyi Aç" | cari 1 | POST 200; DB accounts ref_no 1 customer; Telefon'dan Tab → E-Posta | 07a | GEÇTİ |
| 8–9 | Stok → + Yeni Ürün KK90 Köşe Kabin 90 (alış 3.000, satış 5.000, KDV %20, açılış 10, not STOKNOTU247) + hizmet MNT Montaj 1.000 | 2 kart | DB stock_items 2 satır, KK90 10 Adet, not yazıldı; Kasa'ya yansıt işaretsiz (Kasa 0) | 09a | GEÇTİ (D2) |
| 10–15 | Fatura → + Yeni Fatura → Stoktan Satış: cari "Ayşe" seç, KK90 × 2 + ⋯ Açıklama "Banyo kapısı 90x190, şeffaf temperli cam, krom profil", + Kalem Montaj × 1; Açık Hesap (Vadeli), Vade 20.11.2026 → Faturayı Kaydet → ONAY | 13.200 (11.000 + KDV 2.200) | ONAY "FIS2026000000001 … ₺13.200,00" (meşru soru, ders 34 — Kaydet); POST 200; invoices issued due_date 2026-11-20; invoice_lines açıklama kalemde; account_entries debt 13.200; stok 10 → 8 | 13b, 15, 15b | GEÇTİ |
| 16–18 | Cari kartı → + Taksit Planı: Carinin Mevcut Borcu, 13.200, 3 taksit, ilk vade 20.11.2026 → Kartı Aç | 3 × 4.400, İKİNCİ borç YOK | plans covers_balance 1; plan_items 4.400 × 3 (20.11 / 20.12 / 20.01); account_entries yalnız debt 13.200; cari 13.200 | 18a | GEÇTİ |
| 19–21 | + Tahsilat → Taksite Yaz: 2.000 Nakit; sonra 1.500 Havale / EFT | cari 9.700, Kasa 2.000, Banka 11.500 | POST plans/…/entries 200 ×2; "Kalan ₺11.200 / ₺9.700"; 1. taksit kalan 2.400 (formda); Kasa {in 2000}; Ziraat 11.500 | 21a, 21b | GEÇTİ |
| 22 | Cari kartı → Ayrıntılı Ekstre | alt başlık yalnız Cari No + aralık; İşlem "Satış"; açıklama "Satış FIS…"; Kalem Açıklaması; "Faturası" yok | "Cari No 1 · 01.01.2026 – 31.12.2026"; 16 kolon; "Satış" / "Satış FIS2026000000001"; kalem satırında açıklama, Montaj'da boş; STOKNOTU247 yok; GENEL TOPLAM 13.200 / 3.500 / 9.700 B | 22a | GEÇTİ (D1) |
| 23 | Sütunlar → "Yol" ve "Birim" işaretini kaldır → PDF + Excel indir | ekranda ve dosyalarda yok | PUT columns 200 ×2; ekran 14 kolon; PDF ve Excel'de Yol/Birim yok, Kalem Açıklaması + açıklama metni VAR, "Satış", "Faturası"/"Fatura kalemleriyle"/"B: borçlu" yok, Genel Toplam 9.700; Excel alt başlığında "· Bakiye: artı borçlu, eksi alacaklı" (iş listesindeki BAŞ MİMAR KARARI — bulgu değil) | 23a | GEÇTİ |
| 24 | Sayfayı yeniden yükle → Ayrıntılı Ekstre; cari kartı Cari Ekstre - PDF; Raporlar → Kasa Hareketleri + PDF + Excel | seçim hatırlanır; Kasa 2.000 | yeniden açılışta 14 kolon (Yol/Birim yok — kişi başına hatırlandı); Cari Ekstre PDF Bakiye 9.700 borçlu; Kasa Hareketleri Devir 0 + Taksit 2.000, TOPLAM 2.000 (ekran = PDF = Excel) | 24c | GEÇTİ |
| 25 | Stok → Maliyet Hesap Kartı: Cam (5 kart) ve Mika (7 kart) | etiketler "KDV"/"Maliyet"/"Masraf%" SAYISIZ, oran kutuları BOŞ, önde "%"; "Toplam" | Cam: Ara · KDV [% boş] · Toplam · Maliyet [% boş] · … CM Maliyeti; Mika: Masraf% [% boş] · Toplam · Maliyet [% boş]; bütün oran kutuları boş | 25a, 25b | GEÇTİ |
| 25 | Enter = sağa | Miktar → Birim Fiyat; KDV → Maliyet; Maliyet → Bölen | odak s1.fiyat → yuzde_ekle.oran → bolme.bolen; taslak DB'ye yazılmadı (0 satır) | — | GEÇTİ |
| 25 | Dört sekmede PDF | 4 dosya, sekme adıyla | "Cam Maliyet / Bayi Fiyat Listesi 1 / Mika Maliyet / Bayi Fiyat Listesi 2 21.10.2026.pdf", başlıkta tabela + sekme | — | GEÇTİ |
| 26 | 170 2S2Ç: miktar 2 × fiyat 100, KDV 20, Maliyet 20 → Çık → soru → Kaydet | 200 / 40 / 240 / 288 / ÷170 = 1,69; soru; kayıt | ekranda 200,00 · 40,00 · 240,00 · 288,00 · 1,69; "Kaydedilmemiş Değişiklik" (meşru, ders 34 — Kaydet yanıtlandı); "kaydedildi"; DB maliyet_satirlar s1 miktar 2 fiyat 100 | 26a, 26b | GEÇTİ |

## Adım sonuçları — MOBİL (yerel kapıcı + tünel)

| # | Adım | Beklenen | Gözlenen (API / DB / kapıcı) | Ekran | Sonuç |
|---|---|---|---|---|---|
| 30 | Yönetim → Mobil Cihazlar (ilk) | kimse uzaktan bağlanamaz | satır "Önce Uzaktan Bağlanabilir işaretlenmeli"; Uzaktan Bağlantı "Kapalı — Eşli cihaz yok…"; Bulut Özeti "henüz yüklenmedi"; kapıcıda ofis kaydı var (lisans LIS-GEZ-247) | 30 | GEÇTİ |
| 31 | Uzaktan Bağlanabilir işaretle → Karekod Oluştur → karekodu GÖRÜNTÜDEN çöz (jsQR) → kapat | ofis alt adı; tünel kendiliğinden Bağlı | PUT access 200; ofis adresi hazırlandı; karekod `https://oivymnex2rdpdcrdy.destekofis.test/mobil/#eslesme=…` (5 dk, tek kullanımlık); kapanınca satır "Bağlı" (kapıcıya 2 başvuru, sahte cloudflared 1 açılış) | 31, 31a | GEÇTİ |
| 32 | Telefon1: adresi aç → cihaz adı → Eşleştir → kullanıcı adı, Tab, parola → Giriş | Genel Bakış canlı | eslesme 200, challenge 200, login 200; "Sunucu Bağlı"; DB mobile_devices 1; kapıcı 1 cihaz | 32a, 32b, 32 | GEÇTİ |
| 33 | Telefon sayıları = masaüstü | Kasa 2.000, Banka 11.500, cari 9.700, stok KK90 8 | telefon ₺2.000 / ₺11.500 / Cari 1 / Stok 2; Ayşe Demir ₺9.700 (API 9700, DB 9700); KK90 8 Adet; Raporlar listesi | 33a–33c | GEÇTİ |
| 33–34 | Telefonda cari kartı "Son Hareketler" | faturalar + tahsilatlar | YALNIZ "Satış Faturası … ₺13.200"; iki taksit tahsilatı (2.000, 1.500) YOK; masaüstü kartı 4 hareket (ledger) | 33a, 34a | **BULGU B2** |
| 35 | Telefon: Tahsilat Gir 500 Nakit (Tahsilat Yeri varsayılan "Cari Hesabına (En Eski Borç)") | Kasa +500, cari 9.200 | POST /api/mobil/accounts/…/tahsilat 200 "Makbuz No 3"; Kasa 2.000 → 2.500; cari 9.200; account_entries in 500 cash; telefonda yeni satır etiketi ham "in" | 35a | GEÇTİ (D7, D8) |
| 36 | Taksit kartına 300 Havale — aracın `route.fetch`'i ofis alt adını çözemedi (ENOTFOUND, araç sınırı); istek sunucuya ULAŞMADI | — | sunucuya yazım 0; telefonda "Sonucu Belirsiz İşlemler (1) … 300 TL" (IndexedDB, yeniden yüklemede de duruyor) | — | (araç) |
| 36d | Ulaşmayan istek → Yeniden Gönder | TEK kayıt | plan_entries 300 bank BİR satır (rowid 3); banka 11.500 → 11.800; bekleyen liste kalktı | — | GEÇTİ |
| 36e | YANIT KAYBI (CDP Fetch, yanıt aşamasında bağlantı koparıldı): 200 Havale taksit kartına | sunucu yazar; telefonda Sonucu Belirsiz; Yeniden Gönder → "zaten kaydedilmişti"; aynı istek 3. kez → yine tek | sunucu yanıtı 200 (telefona ulaşmadı); uyarı "Bağlantı koptu; işlem kaydedilmiş olabilir…"; plan_entries 3 → 4 (bir kez); Yeniden Gönder "Bu işlem zaten kaydedilmişti; yeni kayıt açılmadı."; 3. gönderim 200 `replayed:true`, plan_entries 4; banka 11.800 → 12.000 (bir kez); cari 8.700 | 36c, 36d | GEÇTİ |
| 37 | Telefon: Ödeme Gir 100 Nakit; Stok → Köşe Kabin 90 → Stok Girişi 5 | Kasa 2.400, cari 8.800; stok 13, Kasa değişmez | "Ödeme kaydedildi"; Kasa 2.400; cari 8.800; account_entries out 100; "Stok girişi kaydedildi"; telefon 13 Adet = masaüstü 13; Kasa 2.400 | 37a | GEÇTİ (D3) |
| 38 | MASAÜSTÜ mutabakat (elle beklenen) | Borç 13.300, Alacak 4.500, Bakiye 8.800 B; Kasa 2.400 (3 satır); Banka 12.000 | cari kartı Toplam 13.300 / 4.500; Ayrıntılı Ekstre GENEL TOPLAM 13.300 / 4.500 / 8.800 B (Makbuz 1–5 + Ödeme); Kasa Hareketleri 2.000 + 500 − 100, TOPLAM 2.500 / 100; API Kasa 2.400; Banka 12.000 | 38a, 38b | GEÇTİ |
| 39 | Tablet (820×1180) ve telefon3 ekrandan karekodla eşlenir | 3 / 3 | karekod 200 ×2; DB 3, kapıcı 3; Yönetim "3 / 3 eşli cihaz …", Karekod Oluştur PASİF + "Cihaz sınırı dolu." | 39a | GEÇTİ |
| 39b | 4. cihaz: API'den karekod | RET | 409 `remote-limit` "Eşli cihaz sınırı dolu. Yeni cihaz için … önce birini silin." | — | GEÇTİ |
| 40 | Yönetim → "Saha Telefonu" → Sil → onay sorusu → Sil; silinen telefon girişe çalışır | yer açılır; silinen reddedilir | soru "Cihaz silinsin mi? … Yer açılır." (meşru, ders 34 — Sil); DELETE 200; kapıcı 2; DB satırı revoked_at dolu (silinmiş işaretli); telefon3 challenge 401 `kapi-cihaz` → ekranda "Cihaz Eşli Değil … yeni karekod isteyin." | 40a, 40b | GEÇTİ |
| 41 | 2 eşliyken İKİ geçerli karekod (admin ekrandan, "saha" kullanıcısı API'den); AYNI tarayıcı (telefon3) yeniden eşlenir; telefon4 ikinci karekodla eşlemeye çalışır | telefon3 girer (3/3); telefon4 eşleme anında RET | telefon3 eşlendi + giriş "Sunucu Bağlı", etkin 3, kapıcı 3; telefon4 eşleme 409 `remote-limit`, ekranda gerekçe; etkin cihaz 3 | 41a, 41b | GEÇTİ |
| 42 | Bilgisayar saati +10 dk, sonra −10 dk (program; kapıcı ve telefon gerçek saat) | canlı çalışır; Yönetim'de saat uyarısı | ölçülen fark −600.428 ms / +600.118 ms; kapıcı saati düzeltildi (±0,4 sn); telefon "Sunucu Bağlı", Kasa/Banka okundu; Yönetim "Bu bilgisayarın saati 10 dakika farklı; Windows saat ayarını eşitleyin."; tünel Bağlı; lisans geçerli; −10 dk iken telefondan 50 TL tahsilat "Makbuz No 6", Kasa 2.450. (Saat SIÇRAMASI +10'da telefonun uzak oturumu 15 dk boşta kuralıyla düştü → yeniden giriş; gerçekte saat sürekli kaymış olur — ders 14, bulgu değil) | 42a, 42c | GEÇTİ |
| 43 | Program KAPANIR (kapanışta son hâl yüklenir); telefonda dokunuş, sayfa yeniden açılır | şerit + son hâl; yazma yok; Son Özeti Göster | son yükleme `neden: kapanis, ok`; şerit "Ofis sunucusuna ulaşılamıyor. Son güncelleme: 29.10.2026 17:51 — bilgiler salt okunurdur"; Kasa 2.450, Banka 12.000, cari 8.750, KK90 13 (= kapanmadan önceki masaüstü); cari kartında yazma düğmesi 0; Raporlar "ofis sunucusu açıkken alınır"; yeniden açılış "Son Özeti Göster" → özet | 43a–43c | GEÇTİ (D4) |
| 44–45 | Program yeniden açılır; telefon (kapalıyken açılmıştı) ↻ | canlı + yazma düğmeleri | tünel kendiliğinden yeni portla açıldı; telefon "Sunucu Bağlı", bakiye canlı, AMA cari kartında Tahsilat Gir / Ödeme Gir YOK; yeniden yüklenince VAR. Yeniden üretildi (45: canlı yükle → var; kapat → kapalıyken aç → Son Özeti Göster → aç → ↻ → YOK; yeniden yükle → var) | 45a | **BULGU B1** |
| 46 | Sahte servis süresi dolmuş DENEME belirtecini BAŞKA lisans kimliğiyle verdi | — | program "Lisans servisinin yanıtı bu lisansa ait değil." diye reddetti (doğru; kurulum lisanslı) | — | (araç) |
| 46b | Aynı lisansın süresi DOLMUŞ belirteci (expiresAt dün) → Lisansı Denetle (license.check) | mobil kapanır, cihazlar silinmez | lisans `expired`, yazılamaz; telefon ↻ → "Lisans geçerli değil; uzaktan erişim kapalı. Ofisinizdeki programın yöneticisi Lisans bölümüne bakmalı."; Yönetim tünel "Kapalı — Lisans geçerli değil…", durum kartı "…karekod oluşturulamaz. Eşli cihazlar silinmez…"; karekod 403 `remote-license`; etkin cihaz 3; program kapalı + lisans bitmiş → telefonda "Son Özeti Göster" YOK (kapıcı bitişte kapatır) | 46c–46e | GEÇTİ (D9) |

Adım sayısı: masaüstü 16 satır (26 adım dosyası), mobil 21 satır (20 adım dosyası); GEÇTİ 35, BULGU 2 (ORTA), DÜŞÜK 9, araç kaynaklı 2 (36, 46 — ürün doğru davrandı).

## BULGULAR (ürün kodu değiştirilmedi)

### B1 ORTA — sunucu kapalıyken açılan telefon, sunucu dönünce kayıt giremiyor (yeniden yüklemeye kadar)
- Yeniden üretme (45, iki kez: 44 ve 45): canlıyken yüklenen sayfada cari kartında `[data-yazma]` = Tahsilat Gir, Ödeme Gir; program kapalıyken sayfa açılıp "Son Özeti Göster" ile
  özet görülür; program açılınca ↻ → üst çubuk "Sunucu Bağlı", bakiyeler canlı, AMA cari kartında yazma düğmesi YOK (stok kartının Stok Girişi de yazma.js'ten gelir —
  aynı olmalı, ekrandan DENENMEDİ); sayfa yeniden
  yüklenince geri gelir. Telefon kullanıcısına neden yazılmaz.
- Kök neden (koddan): `client/mobil/app.js:245` `import('./yazma.js').then(…).catch(()=>{})` — tek seferlik, hata yutulur, yeniden denenmez; `client/mobil/sw.js:7` kabuk
  önbelleği (ASSETS) `yazma.js`, `yazma.css`, `yazma-bekleyen.js`'i İÇERMEZ → sunucu kapalıyken kapıcı 503 JSON döner (konsol: "Refused to apply style … yazma.css … MIME type
  ('application/json')"), modül yüklenemez. Aynı nedenle çevrimdışı açılışta "Sonucu Belirsiz İşlemler" listesi de görünmez (yazma-bekleyen).
- Neden ORTA: para/veri bozulmaz, ama gerçek kullanım sırası (sabah telefondan ana ekran simgesiyle açıp ofis bilgisayarı sonra açılınca) M5'in ana işi olan telefondan
  tahsilatı o oturumda kapatır; kullanıcı düğmenin neden olmadığını bilemez (müşteriye sorun çıkarır). Önerilen düzeltme yönü (karar ana oturumda): yazma dosyalarını kabuk
  önbelleğine ekle ve/veya canlıya dönüşte (serverState → bağlı) modülü yeniden yükle; e2e: senaryo-mobil-ozet-247'ye "kapalıyken aç → sunucu dön → ↻ → yazma düğmesi var".

### B2 ORTA (kuşkuda ORTA — CLAUDE.md "kuşkuda müşteriye sorun çıkarır sayılır") — telefonda cari "Son Hareketler" taksit tahsilatlarını göstermiyor; etiketler ham
- Yeniden üretme (33, 34 — telefon kartı iki kez açıldı; 43 çevrimdışı özette de aynı): Ayşe Demir'in 2.000 ve 1.500 taksit tahsilatı (masaüstünden) ve telefondan girilen 300 / 200
  taksit tahsilatı telefondaki "Son Hareketler"de YOK; bakiye doğru (9.700 → 8.750). Masaüstü cari kartı aynı anda 8 hareket gösteriyor (38; ledger).
- Kök neden: `client/mobil/app.js:74` `listOf(d, 'entries')` — `/api/workspace/accounts/:id` yanıtındaki `entries` yalnız account_entries (fatura, cari tahsilat/ödeme);
  taksit tahsilatları `ledger`'da (yanıtta var: entries 1, plans 1, ledger 4 — adım 34). Ayrıca `app.js:72` `accountEvent` etiket alanı bulunamayınca `kind`'a düşüyor →
  telefondan girilen tahsilat ekranda "in", ödeme "out" (İngilizce ham değer); tarih ISO "2026-10-21".
- Etki: para doğru; ama telefonda fatura 13.200 görünüp tahsilatlar görünmeyince kullanıcı tahsilatın kaydedilmediğini sanıp İKİNCİ kez girebilir (S3 kararıyla telefondan
  girilen taksit tahsilatı da kendi listesinde görünmüyor). Düzeltme yönü: `ledger` (etiketli, yürüyen bakiyeli) kullanmak; çevrimdışı özetin de aynı alanı taşıması.

### DÜŞÜK (2.4.7 kararı gereği SONRAKİ SÜRÜME; programın çalışmasını / parayı / güvenliği etkilemez)
- D1 Ayrıntılı Cari Ekstre 1366×768'de tablo 962 > 953 px (9 px yatay taşma); Bakiye kolonunda "₺13.200,00 B"nin "B"si kesik (22a). Kolon metni "Taksit Planı (mevcut borç)" uzun.
- D2 Hizmet kartı açarken de düğme "Ürünü Aç", bildirim "Ürün açıldı." (09b).
- D3 Mobil formlarda bilgi notu seçime uymuyor: Tahsilat Yeri "Taksit Kartı" seçilince de "Tahsilat carinin en eski açık borcunu kapatır"; Ödeme Gir'de "Ödeme carinin en eski
  açık borcunu kapatır" (müşteriye ödeme borcu artırır) (36e, 37) — `client/mobil/yazma.js:114`.
- D4 Çevrimdışı Genel Bakış notu "Mobil görünüm salt okunurdur; tahsilat, ödeme ve stok hareketi masaüstü programdan girilir." — M5 öncesi metin (canlıda "…cari ve stok
  kartından yapılır") (`client/mobil/app.js:63`; dosya başı yorum `app.js:3` "SALT OKUNUR" da eski).
- D5 `yazma.css` çevrimdışı uygulanmıyor (B1 ile aynı kök).
- D6 Tablet (iPhone imzalı 820 px) Yönetim'de tür "Telefon" (imzaya göre; beklenen sayılabilir).
- D7 Telefonda Tahsilat Yeri varsayılanı "Cari Hesabına (En Eski Borç)"; masaüstü + Tahsilat ise önce "Taksite Yaz / Taksit Dışı" sordurur. Telefondan varsayılanla girilen
  500 sonrası "Taksitlerden Kalan" (9.700) > bakiye (9.200). Tutarlar doğru (karar S3 / desktop "Taksit Dışı" ile aynı anlam) — para kuralı olduğu için baş mimar karar vermez
  (ders 43); ürün sahibine soru olarak not edildi.
- D8 Telefonda hareket tarihi ISO "2026-10-21" (Türkçe gg.aa.yyyy değil).
- D9 Lisans bitmiş + program açıkken tabletin yeniden açılışı giriş ekranını gösteriyor (tünel kapalı → `kapi-ofis-kapali`), lisans iletisini göstermiyor; telefon1 (oturumu
  açık) doğru iletiyi gösterdi.

## Test ortamı notları (ürün hatası DEĞİL, ders 14)
- 36: Playwright `route.fetch()` isteği Node tarafında yeniden gönderir, tarayıcının `--host-resolver-rules` eşlemesini kullanmaz → ENOTFOUND; yanıt kaybı 36e'de CDP Fetch
  (tarayıcının kendi ağ yığını) ile üretildi.
- 42: saatin anlık SIÇRATILMASI uzak oturumu 15 dk boşta kuralıyla düşürdü; gerçek kurulumda saat sürekli kaymıştır (son görülme de aynı saatle yazılır).
- 46: sahte servisin başka lisans kimliğiyle deneme belirteci vermesi programca reddedildi (doğru). DENEME bitişi aynı kapıyı (lisans yazılabilir mi) kullanır; deneme yolu
  `test/mobil-deneme-bitis-247.test.mjs` (tam kapıda koşulur).
- PDF/Excel "Oluşturma" saati sahte iş saatiyle (21.10.2026); Yönetim ve karekod geçerlilik saatleri uzaktan erişim saatiyle (gerçek, 29.10.2026 17:xx TR) — iki saat bilerek ayrı.

## DENENEN / DENENMEYEN
- DENENEN (ders 3, 6, 12, 13, 14, 15, 24, 30, 34, 36): yukarıdaki tablo; her soru penceresi (fatura ONAY, Maliyet "Kaydedilmemiş Değişiklik", cihaz silme ONAY) beklenen ve
  meşru, yanıtı günlükte; sapmalar (B1, B2) yeniden üretildi; araç kaynaklı iki sapma ürün davranışıyla ayrıldı.
- DENENMEYEN: gerçek telefon (iOS Safari / Android Chrome), gerçek Cloudflare tüneli ve gerçek kapıcı (kullanıcının 2.4.7 kurulumunda, M4-TASARIM §8 madde 5); gerçek
  Windows + Edge masaüstü; 002 şirketi ve şirket değiştirme (telefonda tek şirket vardı); personel rolüyle telefon (yalnız Tahsilat Gir) — e2e senaryo-mobil-yazma-247 Y9'da;
  POS / kredi kartı yolu; eksi stok sorusu telefonda; gece yarısı / 24 saat kuralı (e2e Y7/Y8'de); DENEME süresinin ekrandan bitmesi (aynı kapı; birim testte); Uzaktan
  Bağlanabilir işaretini kaldırınca cihazların düşmesi; e-Belge gönderimi (müşteri e-Fatura mükellefi değildi → Kâğıt Belge).
