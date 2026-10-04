# DestekOfis 2.0.21 — Excel İş Listesi Denetimi (İki Şirket)

**Tarih:** 04.10.2026 · **Program:** DestekOfis 2.0.21 (dal `claude/kind-newton-fpmx3f`, program kodu DEĞİŞTİRİLMEDİ)
**Kaynak:** `Sirket_Is_Listesi_Stoklu.xlsx` — 4.220 iş (01.01.2024–30.09.2025), 350 cari, 50 ürün, 12 personel

> Bu rapor, 04.10.2026'da daha önce teslim edilen "MALİ-RAPOR-2.0.21-TEST" belgesinin YERİNE geçer. O belgede
> programa hiç kayıt girilmemişti (program salt okunur lisansla çalışmıştı, bütün istekler reddedilmiş, test bunları
> "başarılı" saymıştı). O belge yanlıştır ve kaldırılmıştır.

## 1. Sonuç (bir bakışta)

| Başlık | Sonuç |
|---|---|
| Excel'deki 4.220 işin programa girilmesi | **Tamamı, iki şirkete ayrı ayrı** (veri dosyasından sayıldı: 1.528 satış, 1.420 alış+gider faturası, 884 çek/senet, 286 taksit kartı, 47 taksit tahsilatı, 791 cari hareketi; eksik 0, çift 0) |
| Mali raporlar ↔ Excel'den bağımsız hesaplanan beklenen | **70 / 70 tuttu** (her şirkette 35 kalem; kuruşu kuruşuna) |
| Programın kendi Mutabakat Testi (Ana Defter dahil) | **001: 59/59 · 002: 59/59 temiz** |
| Aynı anda çalışan personel | 2 şirket × 3 personel + 2 arayüz personeli; şirket verileri karışmadı |
| Hatalı ve yetkisiz işlem denemeleri | 63 deneme; 61 beklendiği gibi reddedildi; **2 bulgu** (aşağıda) |
| Yedek denetimi ve geri yükleme tatbikatı | **30 / 30** + otomatik yedek iki şirkette doğru klasörde |
| Arayüzden (tıklayarak) bugünün işleri, iki şirket aynı anda | **14 / 14** doğru etki |
| Yük altında ekran kullanılabilirliği | **Sorunlu** — ayrıntı 5.1 ve 5.2 |

## 2. Nasıl yapıldı (açık söylüyorum: neyi ekrandan, neyi API'den)

**Ekrandan (tarayıcıda tıklayarak, gerçek kullanıcı gibi):**
- Yönetici girişi; 002 şirketi sol üstteki Şirket kutusu → "+ Yeni Şirket" ile açıldı ("002 · Şube Ticaret Ltd. Şti.").
  001'in unvanı "Merkez Ticaret A.Ş." yapıldı (Yönetim'deki yeniden adlandırma ucuyla).
- Her iki şirkette **Cari → Excel / Sheets'ten Yükle**: sizin dosyanız seçildi, program "Hangi sayfa?" diye sordu,
  "Cari Listesi" seçildi, kolonlar kendiliğinden eşlendi (Cari Kodu → Cari No, Ünvan → Ad, Tip → Tür); **350 cari açıldı**.
- Her iki şirkette **Stok → Excel'den Yükle → "Ürün Listesi"**: **50 ürün açıldı** (kod, ad, birim, alış, satış fiyatı).
- Excel yüklemesi sırasında arayüz personelinin girdiği satış faturaları, cari tahsilatları ve ödemeler. 22 denemenin
  8'i tamamlandı; yük altında tamamlanamayanlar API'ye bırakıldı (faturanın kesilmediği sayımla doğrulandıktan sonra).
- Yüklemeden sonra iki arayüz personeli iki şirkette AYNI ANDA, yalnız ekrandan: nakit / POS / çekle / taksitli satış,
  "Taksite Yaz" ile taksit tahsilatı, havaleyle cari tahsilatı, tedarikçiye nakit ödeme (14/14 doğru).
- Çift tıklama ("Faturayı Kaydet" ve onaydaki "Evet"): her ikisinde de yalnız 1 fatura kesildi.

**API'den (programın ekranının kullandığı uçların aynısı, ayrı personel hesaplarıyla):** Excel'deki işlerin geri
kalanı. 8.440 kaydı tek tek tıklamak günler sürer; hacim bu yüzden API'den girildi. Her faturada "kaydeden" alanı
personelin kendisidir (satis001, alis001, tahsilat001 …).

**Aynı anda çalışma:** Her şirkette satış personeli (satış faturaları, tarih sırasıyla — VUK 231 numara/tarih sırası
kuralı), alış personeli (alış ve gider faturaları), tahsilat personeli (tahsilat, ödeme, maaş, taksit tahsilatı) aynı
anda çalıştı; iki şirket de aynı anda.

**Yarıda kesilme:** Yükleme, satışların yaklaşık %43'ünde (001: 662, 002: 639 satış) **SIGKILL ile sert biçimde**
durduruldu (elektrik kesintisi gibi), sonra kaldığı yerden devam ettirildi. Sonuçta eksik 0, çift 0, mutabakat temiz.

**Lisans:** Bu ortamdan lisans servisine ulaşılamadı (HTTP 403); program bu yüzden salt okunur açılıyordu. Testler
programın kendi test düzeniyle (lisans denetimi kapalı) yapıldı; lisans yolu bu denetimde denenmedi.

## 3. Mali müşavir kararları (Excel'in nasıl kayda dönüştüğü)

| Excel | Programda |
|---|---|
| Cari Açılış | Cari kartı (Cari Listesi sayfasından; bakiye 0) |
| Mal Satışı — Tamamlandı + Nakit / Havale / Kredi Kartı | Satış faturası, tamamı peşin (Kasa / Banka / POS) |
| Mal Satışı — Tamamlandı + Çek / Senet | Satış faturası, tamamı alınan çek/senet (vade = Excel'deki Vade Tarihi) |
| Mal Satışı — Taksitli | Satış faturası, taksitlendirme (Taksit Sayısı kadar, ilk vade 1 ay sonra, aylık) |
| Mal Satışı — Beklemede / Kısmi Ödendi | Satış faturası, açık hesap (vade = Excel Vade Tarihi) — Kısmi Ödendi'de ödenen tutar Excel'de YOK |
| Mal Alımı | Alış faturası (fatura no = İşlem No); ödeme kuralları satıştaki gibi (verilen çek/senet) |
| Tahsilat / Ödeme | Cari tahsilatı / ödemesi (nakit, havale, POS); çek/senet ise portföye alınan / verilen evrak |
| "ISL-04xxx nolu taksitli satışın n. taksit ödemesi" | O satışın taksit kartından n. taksite tahsilat (çekle olanlar taksite sayılan çek) |
| Gider Ödemesi | Gider faturası (KDV DAHİL; Excel'de cari yok → "Gider: Kira" vb. 11 gider carisi), peşin ödendi |
| Maaş Ödemesi | Personel carisi (12 kişi): maaş tahakkuku (alacak) + havaleyle ödeme → bakiye 0 |

## 4. Mali denetim — program ↔ Excel (001; 002 birebir aynı)

| Kalem | Excel'den beklenen | Program |
|---|---:|---:|
| Satış faturası / alış+gider faturası | 1.528 / 1.420 | 1.528 / 1.420 |
| Satış matrahı | 32.718.967,88 | 32.718.967,88 |
| Hesaplanan KDV (391) | 3.516.789,01 | 3.516.789,01 |
| Satış genel toplamı | 36.235.756,89 | 36.235.756,89 |
| Alış + gider matrahı | 49.960.167,94 | 49.960.167,94 |
| İndirilecek KDV (191) | 4.932.097,33 | 4.932.097,33 |
| Devreden KDV | 1.415.308,32 | 1.415.308,32 |
| Gider (KDV hariç) | 10.322.609,52 | 10.322.609,52 |
| Nakit Kasa | −12.042.568,88 | −12.042.568,88 |
| Banka (Havale/EFT) | −16.663.396,13 | −16.663.396,13 |
| POS / Kredi Kartı | −5.649.345,13 | −5.649.345,13 |
| Borçlu cariler (alacağımız) | 24.956.792,84 | 24.956.792,84 |
| Alacaklı cariler (borcumuz) | 8.570.021,38 | 8.570.021,38 |
| 350 carinin her biri ayrı ayrı | 350 tutar | 350 tutar |
| 50 ürünün stok miktarı | 50 tutar | 50 tutar |
| Alınan çek/senet | 458 adet · 9.292.642,24 | 458 · 9.292.642,24 |
| Verilen çek/senet | 426 adet · 18.109.393,91 | 426 · 18.109.393,91 |
| Taksit kartları | 286 · 6.377.072,52 | 286 · 6.377.072,52 |
| Taksit tahsilatı / kalan | 66.384,02 / 6.310.688,50 | 66.384,02 / 6.310.688,50 |
| Hesap mizanı borç − alacak | 0,00 | 0,00 |
| Ana Defter mutabakatı | Tutarlı | Tutarlı |

Notlar: Birleşik Şirket Raporu'ndaki "Cari Alacak" (34.249.435,08) = borçlu cariler + portföydeki alınan çekler;
"Cari Borç" (26.679.415,29) = alacaklı cariler + verilen çekler — program çeki alacak/borçta sayıyor, tutarlı.
Denetim, saldırı denemelerinden ve yedek tatbikatından SONRA yeniden koşuldu: yine 70/70.

## 5. Programın bulguları (kod değiştirilmedi; madde madde)

**5.1 Yük altında sunucu yavaşlıyor; açık pencere sayısı yavaşlığı katlıyor.** Bu veri hacminde (2.948 fatura) bir
cari kartının yalnız notunu değiştirmek ~1 sn sürüyor (4 eşzamanlı istek: saniyede 4,1 kayıt). Aynı yükte, hiçbir şey
yapmayan **2 açık tarayıcı penceresi** varken saniyede 0,9 kayıt (yanıt 5,2 sn), **5 pencerede** 0,5 kayıt (yanıt 8,9 sn,
p95 15 sn). Excel yüklemesinde satış faturası, iki pencere açıkken dakikada 14, pencereler kapalıyken dakikada 120
girildi. Satış faturası yanıtı veri büyüdükçe ortalama 110 ms'den 565 ms'ye çıktı.

**5.2 Başka personel kayıt girerken ekran gecikiyor.** Aynı şirkette başka biri saniyede 1 kayıt girerken açık Cari
penceresinin arama kutusunda her harf ~3 sn sonra görünüyor (boşta 3–16 ms). Yazılan metin kaybolmuyor. Aynı koşulda
"+ Yeni Fatura" senaryo ekranı otomatik testte açılamadı; kesin neden belirlenmedi (test, sayfa yavaşken bastığı Escape
tuşlarının gecikmeli işlenmesinden de etkilenmiş olabilir) — gerçek kullanıcıyla teyit edilmeli.

**5.3 Excel'den cari yüklemede "Müşteri/Tedarikçi" tipi sessizce "Tedarikçi" oluyor.** Excel'de 107 cari bu tipte;
programda ikili tür yok ve yükleme raporu bunun için uyarı vermiyor (15 uyarının hepsi aynı adlı carilerle ilgili).
Bakiyeyi etkilemez; Cari listesindeki "Müşteri / Tedarikçi" süzgeci yanıltır.

**5.4 Doğrudan API'de tanımsız ödeme yolu nakit sayılıyor.** `method: "bitcoin"` gönderilen tahsilat reddedilmedi,
"Nakit" kaydedildi. Ekrandan seçilemez; yalnız doğrudan API'yle olur.

**5.5 Doğrudan API'de aynı fatura iki kez gönderilince iki fatura kesiliyor** (tekrar koruması yok; ağ kopup yeniden
gönderilirse olabilir). Ekranda çift tıklama korumalı (1 fatura).

**5.6 Lisans uyarısı.** Lisans denetimi kapalıyken bile ekranda "Ücretsiz deneme henüz başlamadı … salt okunur" kutusu
görünüyor. Gerçek kurulumda lisans servisine ulaşılamazsa program salt okunur açılır (bu ortamda 403).

**Bulgu DEĞİL (programın bilinçli kuralı, doğru çalıştı):** eksi ve sıfır tutar, 10 trilyon (üst sınır 1 trilyon), ileri
tarih, 30 Şubat, %7 KDV, eksi miktar, faturadan fazla peşin ödeme reddedildi; 1 milyar TL kabul edildi (sınırın altında);
10,005 → 10,01; kilitli döneme kayıt 409; VUK 231 numara/tarih sırası; aynı seri çek 3 kez → 1 kabul; aynı taksite aynı
anda 3 tahsilat → fazlası sonraki taksitlere dağıldı (kart toplamı bozulmadı); "Engelle" kipinde Kasa eksiye düşmedi;
yarıda kesilen istek yarım kayıt bırakmadı; faturalı ürün ve silinmiş cari korumaları; HTML/JS kodu ekranda çalışmadı;
Excel dışa aktarımında formül yok; şirketler arası her erişim 403/404; Personel rolü fatura/Kasa/çek/ödeme 403;
Muhasebe rolü yönetici işlemleri 403; 12 yanlış parola → 15 dk kilit; oturumsuz 401; saldırılardan sonra 001 ve 002'nin
sayıları birebir aynı. Muhasebe rolünün ANLIK DURUM'u görememesi programın yetki kuralıdır.

## 6. Yedek denetimi

- "Şimdi Yedek Al → Tüm Şirketler": `backups/001 - Merkez Ticaret A.Ş/destekofis-001-….sqlite` ve
  `backups/002 - Şube Ticaret Ltd. Şti/destekofis-002-….sqlite` (klasör adı sondaki noktayı Windows kuralı gereği atar).
- Her yedeğin İÇİNDE kendi şirket kimliği; her şirkete önceden konan işaret kaydı yalnız kendi yedeğinde; cari ve
  fatura sayıları yedek anıyla aynı. Klasörlerde başka şirketin dosyası ya da kimliği yok; "Yedekleri Denetle" temiz.
- Otomatik zamanlayıcı (aralık kısaltılarak tetiklendi) iki şirketi kendi klasörlerine, kendi kimlikleriyle yedekledi.
- 002 tatbikatı: yedek → 12.345,67 TL yeni tahsilat → 001'in yedeğini 002'ye yükleme denemesi **409 reddedildi** →
  yanlış parola **403** → kendi yedeğinden geri yükleme → sayılar yedek anına döndü; 001'e dokunulmadı → geri yüklenen
  veride yeniden çalışıldı.
- 001 tatbikatı: yedek → 7.777,77 TL yeni tahsilat → geri yükleme yeniden açılışa bekletildi → sunucu kapatılıp açıldı
  → 001 yedek anına döndü, 002 bozulmadı, kullanıcılar (ortak katman) korundu → yeniden çalışıldı.
- 003 deneme şirketi silinirken önce kendi klasörüne "silme-öncesi" yedeği alındı.

## 7. Excel dosyasının kendi sorunları (mali müşavir notu)

1. **Kasa / sermaye açılışı yok** → nakit Kasa −12.042.568,88, banka −16,7 milyon, POS −5,6 milyon çıkıyor; gerçekte
   olamaz. Program her eksiye düşüşte uyardı (yalnız devam bölümünde 83 kez); kullanıcı "Yine de Kaydet" der gibi geçildi.
2. **1.613 işlem, ilgili carinin "Cari Açılış" tarihinden önce** yapılmış.
3. **"Kısmi Ödendi" 240 satış/alışta ödenen tutar yok** → açık hesap olarak girildi (tahsilat uydurulmadı).
4. **165 taksitli satış "Tamamlandı" ama taksit tahsilat satırı yok** (+48 Beklemede, +45 Kısmi) → kartlar açık kaldı;
   yalnız 14 satışın (ISL-04001…) taksit tahsilatı Excel'de var. ISL-04001 6/6 ödenmiş ama "Devam Ediyor" yazıyor.
5. **Özet sayfası iş listesiyle uyuşmuyor** (Özet: satış 1.500, alım 900, tahsilat 300, maaş ~250; gerçek 1.528, 1.020,
   372, 216).
6. **Kuruş farkları:** 1.850 satırda miktar × birim fiyat ≠ toplam (en çok 0,24 TL, toplam 112,79 TL); program
   doğru aritmetikle hesapladı. 39 gider satırında KDV 1 kuruş farklı yuvarlanmış.
7. **Personel (PER-001…012) ve gider türleri** cari/ürün listelerinde yok → personel ve "Gider: …" carileri açıldı.
8. **Eksi stok:** Laptop 15.6" i5 −38 Adet, Ofis Koltuğu −58 Adet, Demir Ø12 −5,42 (satış alıştan fazla).
9. **13 ad iki farklı koda ait** (ör. "Ömer Özdemir" iki kişi) — program 15 satırı uyarıyla ayrı cari açtı, karışmadı.

## 8. DENENEN / DENENMEYEN / BİLİNEN SINIRLAR

**Denenen:** yukarıdaki her şey; 4.220 iş × 2 şirket; 63 saldırı; yedek/geri yükleme/otomatik yedek; sert kesinti;
ekran gecikmesi ve açık pencere A/B ölçümü; çift tıklama.

**Denenmeyen:** lisans yolu (servis erişilemedi); gerçek Windows hizmeti ve gerçek ağdaki ayrı bilgisayarlar (hepsi
aynı makinede, ayrı tarayıcı oturumlarıyla); disk dolu ve kilitli dosya arızaları; Google Drive yedeği; e-Fatura;
iade/iptal faturaları Excel'de olmadığı için yalnız 003'te birkaç örnek; 8.440 kaydın tamamını ekrandan girmek.

**Bilinen sınırlar:** Excel'de olmayan bilgiler (kısmi ödeme tutarları, taksit tahsilatları, Kasa açılışı) uydurulmadı;
raporlardaki eksi Kasa/banka ve açık taksitler bundan gelir. Arayüz testinde tarih kutusuna klavyeyle yazmak
otomatik tarayıcıda çalışmadığı için tarihler tarih seçiciden seçilmiş gibi verildi.

## 9. Ekler (zip içinde)

- `raporlar/001`, `raporlar/002`: programın kendi ürettiği 18 rapor × PDF + Excel (Hesap Mizanı, Cari Mizanı, Cari
  Listesi, KDV Özeti, Satış/Alış Faturaları, Gider, Kasa, Banka ve POS, Çek/Senet Portföyü, Taksit Kartları ve
  Tahsilatları, Cari Bazında Tahsilat, Açık Faturalar, Alacak Yaşlandırma, Stok Durumu, Ürün Satış Kârlılık, Defter
  Mutabakatı) ve Birleşik Şirket Raporu (PDF + Excel). Excel aşamasından sonra, saldırı ve arayüz adımlarından ÖNCE alındı.
- `ekran/`: ekran görüntüleri; `*.json`, `kayit-*.txt`: her denemenin beklenen/gerçek sonucu; `betikler/`: testin
  kendisi (model.py bağımsız hesap; kos.mjs, denetim.mjs, saldiri.mjs, yedek.mjs, arayuz.mjs…).
