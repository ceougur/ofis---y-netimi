# Ekrandan Bir Hafta — Eksiklerin Tamamlanması ve Rapor Denetimi (04.10.2026)

**Program:** DestekOfis 2.0.22 (yayındaki sürüm). **Program kodu DEĞİŞTİRİLMEDİ**; bulunan hatalar yalnız raporlandı.
**Kullanıcı kararı:** "testin eksiğini tamamla, düzeltmeyi ondan sonra değerlendirelim".

## 1. Ne eksikti, ne eklendi

İlk haftalık testte (51 işlem) eksik kalanlar ve bu turda eklenenler:

| Eksik | Bu turda |
|---|---|
| Cari tek tek açılmadı (Excel'den toplu) | **+ Yeni Cari** ile 3 cari (müşteri, ev sahibi, personel) + aynı adla ikinci cari denemesi |
| Stok formu kullanılmadı | **+ Yeni Ürün** (ilk miktar 10, "Kasa'ya yansıt"), hizmet kalemi, **+ Giriş** (havale), **− Çıkış** (nakit satış), fire (yalnız miktar) |
| Taksit penceresinin formu kullanılmadı | **Taksitler → + Yeni Kart** ("Yeni Borç", 9.000, 3 taksit) + kartın üstünden **+ Tahsilat** |
| Kira yoktu | 36.000 kira faturası (KDV dahil %20, açık) → ertesi gün cari kartından havaleyle ödeme |
| — | Yeni cariye iki kalemli satış (ürün + hizmet), cari kartından tahsilat, yeni personelin maaşı (tahakkuk + ödeme) |
| Raporlar açılmadı | **Rapor Merkezi'nden 14 rapor (16 görünüm) + ANLIK DURUM ekrandan**, iki şirkette; PDF ve Excel ekranla karşılaştırıldı |
| Bağımsız beklenen hesap yoktu | `model-hafta.py`: Excel satırlarından + ek işlemlerden, programın kodunu kullanmadan |

Ek işlemlerin tam listesi: `test/excel-denetim/veri/hafta-ekler.json` (16 işlem, 20–26 Ocak 2025).

## 2. Nasıl yapıldı

- Aynı başlangıçla iki şirket: **001 · API Şirketi** (işler programın API'sinden) ve **002 · Ekran Şirketi** (aynı işler
  tarayıcıdan, kullanıcı gibi: tıklama, harf harf yazma, listeden seçme, soru pencerelerine cevap).
- İşler **kendi gününde** girildi (Excel'in işleri ve ek işler tarih sırasında birleşik). İlk denemede ek işleri haftanın
  sonuna koymuştum; program 23 Ocak tarihli satış faturasını, seride 26 Ocak tarihli fatura varken haklı olarak reddetti
  ("numara ve tarih sırası uyuşmalı"). Bu programın doğru davranışıdır.
- Raporlar: Raporlar → Tüm Raporlar → rapor seçilir → Başlangıç/Bitiş yazılır → **Ön İzle**. Özet kutuları ve TOPLAM
  satırı ekrandan okunur. PDF ve Excel bağlantısı sağ tıkla ("bağlantıyı farklı kaydet" gibi) alınır; bağlantının
  pencerenin şirketini taşıdığı (`?hofCompany=`) ve dosyadaki sayıların ekrandakilerle aynı olduğu denetlenir.
- ANLIK DURUM: ana ekrandaki kartların tam tutarları (üstüne gelince çıkan açıklama) okunur.

## 3. Sonuçlar

### 3.1 Giriş: ekran ile API aynı sonucu verdi

- **Ekrandan 67 / 67 işlem** (51 Excel işi + 16 ek işlem), 7,8 dakika, işlem başına ortalama ~7 sn; API şirketinde 67 / 67.
- İki şirket sayı sayı karşılaştırıldı: 376 carinin (373 + 3 yeni) borç / alacak / bakiyesi, 52 kalemin stok miktarı ve stok
  değeri, faturalar (21 satış, 22 alış: adet, toplam, ödenen, açık), 8 çek/senet, 6 taksit kartı, Kasa / banka / POS, ek
  faturaların durumu → **FARK YOK**.
- Programın Mutabakat Testi iki şirkette **59 / 59**. Tarayıcıda sayfa hatası **yok**.
- Bulgu 1 (ödeme alanının silinmesi) bu koşuda tetiklenmedi: betik her alandan sonra bekleyip alanı denetleyen dikkatli bir
  kullanıcı gibi yazdı (ilk turda normal hızda yazınca alan silinmişti).

### 3.2 Raporlar ↔ bağımsız beklenen (iki şirkette, ekrandan)

(tablo: `python3 test/excel-denetim/hafta-tablo.py`)

### 3.3 Farkların açıklaması

- **Satış Faturaları · Kalan:** program 76.158,23, beklenen 79.448,83 → fark **3.290,60** = Bulgu 2: 3.000 (yeni cari Deniz
  Yapı: taksit kartının tahsilatı faturaya da sayıldı) + 290,60 (C0122'nin taksitli faturası ISL-01905, başka iş için verilen
  senetle "Ödendi" sayıldı; kendi taksit kartı ödenmemiş görünüyor).
- **Açık Faturalar · Açık Alacak:** program 68.494,23, beklenen 71.494,23 → fark **3.000** = Bulgu 2 (taksitli faturalar bu
  raporda yer almaz; 290,60 bu yüzden burada görünmez).
- **Banka ve POS · Yol = Banka / POS:** Bulgu 4; "Yol" seçimi uygulanmıyor, rapor birleşik kalıyor. Birleşik rapor doğru
  ve tablonun "Yol" kolonundan çıkarılan banka ile POS toplamları beklenenle aynı.
- Bunların dışında **açıklanmamış fark yok**: Kasa, KDV, Gider, Cari Mizanı, Cari Listesi, Taksit Kartları, Çek/Senet, Stok
  (51 kalemin her biri), yeni carinin ekstresi, Hesap Planı Mizanı (borç = alacak) ve ANLIK DURUM'un 6 kartı kuruşu
  kuruşuna tuttu.
- PDF ve Excel: her raporun iki dosyası da indi, bağlantı pencerenin şirketini taşıdı, dosyalardaki sayılar ekranla aynı.

## 4. Bulunan program hataları (kod değiştirilmedi; karar kullanıcıda)

**Bulgu 1 — Fatura formunda ödeme alanları siliniyor (ilk turda bulundu; 2.0.21'de de var).** Ödeme tutarı faturayı
tamamen karşılayınca ödeme bölümü ~0,6 sn sonra yeniden çiziliyor; bu sürede seçilen Vade tarihi ya da yazılan
Banka/Şube siliniyor. Kaydet "vade tarihini seçin" der; veri bozulmaz. Yeniden üretim: `test/excel-denetim/form-insan.mjs`.

**Bulgu 2 — Taksit kartı ile fatura kapaması birbirini tutmuyor (yeni).** `server/lib/invoice-settle.mjs` fatura
kapamasında taksit kartının borcunu ve tahsilatını genel "en eski borç" sırasına (FIFO) katıyor; Taksit modülü ise kartın
ödenenini kendi içinde sayıyor. Değişmez kural "açık faturalar + kart kalanları = cari bakiye" bozuluyor
(`test/excel-denetim/taksit-fatura-kapama.mjs`, sonuç `cikti/taksit-fatura-kapama.json`):

| Senaryo | Programda fatura | Taksit kartı | Cari bakiye | Sorun |
|---|---|---|---|---|
| A · önce fatura (12.720), sonra ayrı kart (9.000); cari kartından 5.000, karttan 3.000 tahsilat | ödenen 8.000 · açık 4.720 | kalan 6.000 | 13.720 | kartın 3.000'i faturayı da kapatıyor (çift sayım) |
| B · önce kart, sonra fatura; aynı tahsilatlar | ödenen 0 · açık 12.720 | kalan 6.000 | 13.720 | cari kartından alınan 5.000 hiçbir yerde görünmüyor |
| C · fatura 6.000 hiç ödenmedi; kart 9.000 tamamen ödendi | **"Ödendi"** | kalan 0 | 6.000 borçlu | ödenmemiş fatura "Ödendi" (hayalet ödeme) |
| D · faturanın borcu karta bölündü ("Carinin Mevcut Borcu") | açık 9.000 | kalan 9.000 | 9.000 | ikisi tutarlı; ama raporlar ikisini TOPLUYOR |
| E · taksitli fatura 3.000 (kartı faturanın kendisi); müşteri cari kartından başka iş için 5.000 öder | **"Ödendi"** | kalan 3.000 | −2.000 (müşteri alacaklı) | fatura ile kendi kartı çelişiyor; yaşlandırma/hatırlatma 3.000 bekliyor |

E türü Excel haftasında **gerçekten oldu**: C0122'nin 290,60'lık taksitli faturası (ISL-01905), aynı carinin 31.454,63'lük
senediyle (ISL-03375) "Ödendi" sayılıyor; taksit kartı 290,60 kalan gösteriyor. Bağımsız hesapla programın satış
açığı arasındaki 290,60'lık fark budur.

Etkisi: Satış Faturaları "Kalan", Açık Faturalar, fatura kartındaki durum (A, B, C, E); **Alacak Yaşlandırma** A–D
birlikteyken 47.440 diyor, carilerin gerçek toplam borcu 42.440. Koddan: Nakit Akış (`server/routes/overview.mjs:299-302`),
Vade Takip (452-455) ve tahsilat takvimi/sağ alt bildirimler (`server/routes/dues.mjs:68-72`) aynı iki listeyi birleştiriyor
(D türünde aynı borç iki kez; bunlar ölçülmedi, koddan). Kimi etkiler: aynı cariye hem fatura kesip hem Taksit
penceresinden kart açan işletmeler.

**Bulgu 3 — Raporlarda dönem düğmesi seçili cariyi siliyor (yeni).** Raporlar → Tüm Raporlar'da cari seçildikten sonra
"Tüm Zamanlar", "Bu Yıl", "Bu Ay"… düğmesine basılınca cari seçimi kalkıyor: Cari Ekstre "Önce cariyi seçin"e düşüyor;
fatura raporlarındaki isteğe bağlı cari süzgeci SESSİZCE kalkıp rapor bütün carileri gösteriyor (Deniz Yapı süzülü: 1
fatura, 1.000 TL → "Bu Yıl" → 2 fatura, 6.000 TL). Tarih yazıp "Ön İzle" seçimi korur. Kök neden:
`client/assets/hof-overview.js:715` (Raporlar penceresinin tıklama işleyicisi "Tüm Raporlar" sekmesindeki dönem
düğmelerini de işleyip sekmeyi yeniden kuruyor). Yeniden üretim: `test/excel-denetim/rapor-ekstre-secim.mjs` (gerçek
tıklamalarla; ekran görüntüleri `cikti/rapor-ekstre-secim/`).

**Bulgu 4 — Banka ve POS Hareketleri raporunda "Yol" süzgeci hiç çalışmıyor (yeni).** Kutuda "Banka (Havale / EFT)" ya da
"POS / Kredi Kartı" seçilince kutu seçimi gösterir ama rapor (ekran, PDF, Excel) hep Banka + POS birleşik kalır; "Ön İzle"
de değiştirmez. Kök neden: `server/routes/report-center.mjs:1382` rapor parametre listesinde `payMethod` yok, sunucu onu
atıyor. Bu süzgeç 2.0.17'de "Kasa yalnız nakit; banka/POS raporlarda, yol süzgeciyle" isteğiyle gelmişti; o günden beri
çalışmıyor (raporları açan arayüz testi yalnız varsayılan süzgeçle açtığı için yakalanmadı). Birleşik rakamlar doğru.
Yeniden üretim: `test/excel-denetim/rapor-ekstre-secim.mjs` (adım 8–10).

**Görünüm notu:** Kasa Hareketleri PDF'inin özet kutusunda "Güncel Kasa (tüm hareketler)" başlığı sığmayıp kesiliyor
("Güncel Kasa (tü…").

**Bulgu olmayan ama denenen:** aynı adla ikinci cari ("Mehmet Kurt") — program yazarken uyardı ("1 cari aynı adla kayıtlı"),
kaydederken "Bu Kişi Zaten Kayıtlı … Yine de yeni cari açılsın mı?" diye sordu; "Mevcut Cariyi Aç" seçildi, ikinci cari
açılmadı. Fatura numarası/tarih sırası: eski tarihli satış faturası reddedildi (doğru).

## 5. DENENEN / DENENMEYEN / BİLİNEN SINIRLAR

**DENENEN**
- Excel'deki haftanın 51 işi + 16 ek işlem, iki şirkette (001 API, 002 ekran), her iş kendi gününde.
- Ekrandan: satış (nakit, havale, açık, çek, senet, taksitli), alış (nakit, havale, kredi kartı, açık, çek, senet), gider
  faturaları (nakit, havale, kredi kartı), kira faturası (açık) + sonradan ödeme, iki kalemli satış (ürün + hizmet), cari
  kartından tahsilat/ödeme (nakit, havale, POS, senet), maaş (tahakkuk + ödeme), Çek/Senet penceresinden alınan/verilen evrak,
  cari kartından ve Taksit penceresinden taksit tahsilatı, + Yeni Cari (3), aynı ad denemesi, + Yeni Ürün (2), stok
  giriş/çıkış/fire, Taksitler → + Yeni Kart.
- Rapor Merkezi'nden 14 rapor (16 görünüm) ekrandan, iki şirkette: Kasa Hareketleri, Banka ve POS (Tümü; Yol = Banka; Yol = POS), Satış ve Alış
  Faturaları, KDV Özeti, Gider Raporu, Cari Mizanı, Cari Listesi ve Bakiyeler, Açık Faturalar, Taksit Kartları, Çek/Senet
  Portföyü, Stok Durumu (her kalemin miktarı), Cari Ekstre (yeni müşteri), Hesap Planı Mizanı; ANLIK DURUM kartları. Her
  raporun PDF'i ve Excel'i indirildi, ekrandaki sayılarla karşılaştırıldı, bağlantının şirketi denetlendi.
- Bulgu senaryoları: taksit kartı ↔ fatura (A–E), rapor dönem düğmesi (Cari Ekstre + fatura süzgeci), fatura formunda
  ödeme alanı (ilk tur).

**DENENMEYEN**
- İade faturaları, fatura iptali/düzenleme/silme/kopyalama, Mahsup Et, çek tahsili/cirosu/karşılıksız, Kasa ↔ Banka
  transferi, stokta Müşteri İadesi, dönem kilidi, yetkisiz kullanıcının rapor ekranı, ileri tarihli hareket (bu hafta
  testinde yok; 2.0.17 mali müşavir testinde ve Excel denetiminde ayrı denenmişti).
- 43 raporun 29'u bu turda açılmadı (ör. Ba-Bs, Yevmiye, Ürün Bazında Satış, Cari Bazında Tahsilat, Taksit Vadeleri).
- Vade Takip, Nakit Akış ve tahsilat takvimindeki çift sayım ölçülmedi (koddan çıkarıldı).
- PDF'lerin görsel düzenine yalnız örnek olarak bakıldı; denetim sayı karşılaştırmasıdır.

**BİLİNEN SINIRLAR**
- Bağımsız beklenen hesap benim yazdığım muhasebe kurallarıyla yapıldı (bölüm 2). Her fark tek tek incelendi; kural
  farkı mı program hatası mı olduğu bölüm 3'te yazılı.
- Test Linux'ta Chromium'la koştu; tarih kutuları tarayıcı dili yüzünden aa/gg/yyyy göründü (Türkçe Windows'ta gg.aa.yyyy).
- Lisans denetimi testte kapalı; ekrandaki "Ücretsiz deneme henüz başlamadı" kutusu bu yüzden (bulgu değil).
- Hacim küçük: 373 cari, 52 ürün, 67 işlem; yük testi değildir (yük ölçümü 2.0.22'de ayrı yapıldı).

## 6. Düzeltme önerileri (karar kullanıcıda; kod değiştirilmedi)

| Bulgu | Önem | Önerim | İş |
|---|---|---|---|
| 2 · taksit kartı ↔ fatura kapama | **Yüksek** (yanlış "Ödendi", yanlış alacak ve hatırlatma; aynı müşteriye fatura + kart kullanan herkes) | Faturasız "Yeni Borç" kartının borcu ve tahsilatı kendi içinde kapanır, fatura FIFO'suna girmez; taksitli faturada bağsız tahsilat önce faturanın taksit kartına sayılır ya da ikisi aynı kuralla kapanır (ikisi aynı sonucu göstermeli); "Mevcut Borç" kartına bölünen açık faturalar vade/yaşlandırma/takvimde bir kez görünür. Değişmez kural testi: açık faturalar + kart kalanları = cari bakiye (A–E). Eski veride durum değişimi raporu. | Orta–büyük (mimari; dikkatli göç ve test) |
| 4 · Banka/POS Yol süzgeci | Orta (rapor yanlış kapsamda; birleşik doğru) | `payMethod` parametre listesine eklenir; her raporun her süzgeci arayüzden en az bir kez denenir (test). | Küçük |
| 3 · dönem düğmesi seçimi siliyor | Orta (fatura raporunda süzgeç sessizce kalkıyor) | Raporlar penceresinin genel işleyicisi "Tüm Raporlar" içindeki tıklamaları işlemez; seçili cari dönem değişince korunur. | Küçük |
| 1 · ödeme alanı siliniyor | Düşük–orta (veri bozulmaz, kullanıcı yeniden girer) | Ödeme bölümü yeniden çizilirken yazılan değerler korunur; tutar tamamlanınca bölüm yeniden çizilmez. | Küçük |
| PDF özet başlığı kesiliyor | Düşük (görünüm) | Uzun özet başlığı iki satıra iner. | Küçük |
