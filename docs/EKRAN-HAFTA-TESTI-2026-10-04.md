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
| Raporlar açılmadı | **Rapor Merkezi'nden 15 rapor + ANLIK DURUM ekrandan**, iki şirkette; PDF ve Excel ekranla karşılaştırıldı |
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

(koşu sonucu)

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

Etkisi: Satış Faturaları "Kalan", Açık Faturalar, fatura kartındaki durum (A, B, C); **Alacak Yaşlandırma** A–D
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

**Görünüm notu:** Kasa Hareketleri PDF'inin özet kutusunda "Güncel Kasa (tüm hareketler)" başlığı sığmayıp kesiliyor
("Güncel Kasa (tü…").

**Bulgu olmayan ama denenen:** aynı adla ikinci cari ("Mehmet Kurt") — program yazarken uyardı ("1 cari aynı adla kayıtlı"),
kaydederken "Bu Kişi Zaten Kayıtlı … Yine de yeni cari açılsın mı?" diye sordu; "Mevcut Cariyi Aç" seçildi, ikinci cari
açılmadı. Fatura numarası/tarih sırası: eski tarihli satış faturası reddedildi (doğru).

## 5. DENENEN / DENENMEYEN / BİLİNEN SINIRLAR

(koşu sonucu)
