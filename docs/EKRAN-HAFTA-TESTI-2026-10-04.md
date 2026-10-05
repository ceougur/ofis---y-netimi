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

**Yeniden koşmak:** `cd test/excel-denetim && node ekran-hafta.mjs` (yaklaşık 16 dk; kayıt `cikti/ekran-hafta-kayit.txt`,
sonuç `cikti/ekran-hafta-sonuc.json`, beklenen `cikti/beklenen-hafta.json`, ekran görüntüleri ve indirilen PDF/Excel
`cikti/ekran-hafta/`), sonra `python3 hafta-tablo.py` (aşağıdaki tablo). Bulgu denemeleri: `node taksit-fatura-kapama.mjs`,
`node rapor-ekstre-secim.mjs`, `node form-insan.mjs`.

## 3. Sonuçlar

### 3.1 Giriş: ekran ile API aynı sonucu verdi

- **Ekrandan 67 / 67 işlem** (51 Excel işi + 16 ek işlem), 7,8 dakika, işlem başına ortalama ~7 sn; API şirketinde 67 / 67.
- İki şirket sayı sayı karşılaştırıldı: 376 carinin (373 + 3 yeni) borç / alacak / bakiyesi, 52 kalemin stok miktarı ve stok
  değeri, faturalar (21 satış, 22 alış: adet, toplam, ödenen, açık), 8 çek/senet, 6 taksit kartı, Kasa / banka / POS, ek
  faturaların durumu → **FARK YOK**.
- Programın Mutabakat Testi iki şirkette **59 / 59**. Tarayıcıda sayfa hatası **yok**.
- Bulgu 1 bu koşuda tetiklenmedi, çünkü betik ödeme alanlarını programla doldurdu ve her alanı yeniden denetledi. Gerçek
  klavye kullanıcısında evrak uyarısız düşüyor (bölüm 4, Bulgu 1).

### 3.2 Raporlar ↔ bağımsız beklenen (iki şirkette, ekrandan)

Tablo `python3 test/excel-denetim/hafta-tablo.py` ile ikinci tam koşunun sonucundan üretildi (ilk koşu aynı sayıları verdi).

| Rapor | Kalem | Bağımsız Beklenen | Ekran Şirketi (002) | API Şirketi (001) | Sonuç |
|---|---|---|---|---|---|
| Kasa Hareketleri | Devir | 2.409,43 | 2.409,43 | 2.409,43 | ✓ |
| Kasa Hareketleri | Dönem Giriş | 84.693,95 | 84.693,95 | 84.693,95 | ✓ |
| Kasa Hareketleri | Dönem Çıkış | 182.636,87 | 182.636,87 | 182.636,87 | ✓ |
| Banka ve POS Hareketleri (Tümü) | Devir | 0,00 | 0,00 | 0,00 | ✓ |
| Banka ve POS Hareketleri (Tümü) | Dönem Giriş | 139.997,01 | 139.997,01 | 139.997,01 | ✓ |
| Banka ve POS Hareketleri (Tümü) | Dönem Çıkış | 563.226,58 | 563.226,58 | 563.226,58 | ✓ |
| Banka ve POS Hareketleri (Tümü) | Banka (tüm hareketler) | −59.240,78 | −59.240,78 | −59.240,78 | ✓ |
| Banka ve POS Hareketleri (Tümü) | POS / Kredi Kartı (tüm hareketler) | −363.988,79 | −363.988,79 | −363.988,79 | ✓ |
| Banka ve POS · Yol kolonundan | Banka Giriş | 126.647,20 | 126.647,20 | 126.647,20 | ✓ |
| Banka ve POS · Yol kolonundan | Banka Çıkış | 185.887,98 | 185.887,98 | 185.887,98 | ✓ |
| Banka ve POS · Yol kolonundan | POS / Kredi Kartı Giriş | 13.349,81 | 13.349,81 | 13.349,81 | ✓ |
| Banka ve POS · Yol kolonundan | POS / Kredi Kartı Çıkış | 377.338,60 | 377.338,60 | 377.338,60 | ✓ |
| Banka ve POS · Yol = Banka | Dönem Giriş | 126.647,20 | 139.997,01 | 139.997,01 | ✗ Bulgu 4 |
| Banka ve POS · Yol = Banka | Dönem Çıkış | 185.887,98 | 563.226,58 | 563.226,58 | ✗ Bulgu 4 |
| Banka ve POS · Yol = POS | Dönem Giriş | 13.349,81 | 139.997,01 | 139.997,01 | ✗ Bulgu 4 |
| Banka ve POS · Yol = POS | Dönem Çıkış | 377.338,60 | 563.226,58 | 563.226,58 | ✗ Bulgu 4 |
| Satış Faturaları | Satış Faturası | 18 | 18 | 18 | ✓ |
| Satış Faturaları | Matrah | 336.251,74 | 336.251,74 | 336.251,74 | ✓ |
| Satış Faturaları | KDV | 20.417,58 | 20.417,58 | 20.417,58 | ✓ |
| Satış Faturaları | Ödenecek | 356.669,32 | 356.669,32 | 356.669,32 | ✓ |
| Satış Faturaları | Kalan | 79.448,83 | 76.158,23 | 76.158,23 | ✗ Bulgu 2 (Kalan) |
| Alış Faturaları | Alış Faturası | 22 | 22 | 22 | ✓ |
| Alış Faturaları | Matrah | 667.965,10 | 667.965,10 | 667.965,10 | ✓ |
| Alış Faturaları | KDV | 77.396,74 | 77.396,74 | 77.396,74 | ✓ |
| Alış Faturaları | Ödenecek | 745.361,84 | 745.361,84 | 745.361,84 | ✓ |
| Alış Faturaları | Kalan | 78.476,09 | 78.476,09 | 78.476,09 | ✓ |
| KDV Özeti | Hesaplanan KDV (391) | 20.417,58 | 20.417,58 | 20.417,58 | ✓ |
| KDV Özeti | İndirilecek KDV (191) | 77.396,74 | 77.396,74 | 77.396,74 | ✓ |
| KDV Özeti | Devreden KDV | 56.979,16 | 56.979,16 | 56.979,16 | ✓ |
| Gider Raporu | Toplam Gider | 119.799,54 | 119.799,54 | 119.799,54 | ✓ |
| Cari Mizanı | Dönem Borç | 1.208.535,31 | 1.208.535,31 | 1.208.535,31 | ✓ |
| Cari Mizanı | Dönem Alacak | 1.224.897,90 | 1.224.897,90 | 1.224.897,90 | ✓ |
| Cari Mizanı | Borçlular Toplamı | 161.764,30 | 161.764,30 | 161.764,30 | ✓ |
| Cari Mizanı | Alacaklılar Toplamı | 173.524,58 | 173.524,58 | 173.524,58 | ✓ |
| Cari Listesi ve Bakiyeler | Toplam Borç (Anlaşılan) | 1.215.547,05 | 1.215.547,05 | 1.215.547,05 | ✓ |
| Cari Listesi ve Bakiyeler | Toplam Alacak (Ödenen) | 1.227.307,33 | 1.227.307,33 | 1.227.307,33 | ✓ |
| Cari Listesi ve Bakiyeler | Borçlular | 161.764,30 | 161.764,30 | 161.764,30 | ✓ |
| Cari Listesi ve Bakiyeler | Alacaklılar | 173.524,58 | 173.524,58 | 173.524,58 | ✓ |
| Açık Faturalar | Açık Alacak | 71.494,23 | 68.494,23 | 68.494,23 | ✗ Bulgu 2 (Açık Alacak) |
| Açık Faturalar | Açık Borç | 78.476,09 | 78.476,09 | 78.476,09 | ✓ |
| Taksit Kartları (Tümü) | Kart | 6 | 6 | 6 | ✓ |
| Taksit Kartları (Tümü) | Toplam | 23.966,34 | 23.966,34 | 23.966,34 | ✓ |
| Taksit Kartları (Tümü) | Ödenen | 8.054,94 | 8.054,94 | 8.054,94 | ✓ |
| Taksit Kartları (Tümü) | Kalan | 15.911,40 | 15.911,40 | 15.911,40 | ✓ |
| Çek / Senet Portföyü | Portföyde (alınan) | 158.314,13 | 158.314,13 | 158.314,13 | ✓ |
| Çek / Senet Portföyü | Ödenecek (verilen) | 119.252,54 | 119.252,54 | 119.252,54 | ✓ |
| Stok Durumu | 51 kalemin Mevcut miktarı | 51 | 51 | 51 | ✓ |
| Cari Ekstre · Deniz Yapı (yeni cari) | Dönem Borç | 21.720,00 | 21.720,00 | 21.720,00 | ✓ |
| Cari Ekstre · Deniz Yapı (yeni cari) | Dönem Alacak | 8.000,00 | 8.000,00 | 8.000,00 | ✓ |
| Cari Ekstre · Deniz Yapı (yeni cari) | Dönem Sonu | 13.720,00 | 13.720,00 | 13.720,00 | ✓ |
| Hesap Planı Mizanı | Fark | 0,00 | 0,00 | 0,00 | ✓ |
| ANLIK DURUM | Nakit Kasa | −95.533,49 | −95.533,49 | −95.533,49 | ✓ |
| ANLIK DURUM | Banka / POS | −423.229,57 | −423.229,57 | −423.229,57 | ✓ |
| ANLIK DURUM | Alacak Cari | 161.764,30 | 161.764,30 | 161.764,30 | ✓ |
| ANLIK DURUM | Alacak Çek | 158.314,13 | 158.314,13 | 158.314,13 | ✓ |
| ANLIK DURUM | Borç Cari | 173.524,58 | 173.524,58 | 173.524,58 | ✓ |
| ANLIK DURUM | Borç Çek | 119.252,54 | 119.252,54 | 119.252,54 | ✓ |

Kalem: 57 · iki şirkette de beklenenle aynı 51 · bilinen bulgudan farklı 6 · açıklanmamış 0
PDF/Excel: 64/64 dosyada ekrandaki sayılar aynı ve bağlantı pencerenin şirketini taşıyor

### 3.3 Farkların açıklaması

- **Satış Faturaları · Kalan:** program 76.158,23, beklenen 79.448,83 → fark **3.290,60** = 3.000 (yeni cari Deniz Yapı:
  taksit kartının tahsilatı faturaya da sayıldı — Bulgu 2 A, gerçek hata) + 290,60 (C0122'nin taksitli faturası ISL-01905,
  aynı carinin senediyle en eski borç sırasında "Ödendi" sayıldı; cari alacaklı olduğu için faturanın kapanması savunulabilir,
  bu 290,60 bir KURAL FARKIDIR; yanlış olan kartın ödenmemiş görünmesidir — Bulgu 2 E).
- **Açık Faturalar · Açık Alacak:** program 68.494,23, beklenen 71.494,23 → fark **3.000** = Bulgu 2 (taksitli faturalar bu
  raporda yer almaz; 290,60 bu yüzden burada görünmez).
- **Banka ve POS · Yol = Banka / POS:** Bulgu 4; "Yol" seçimi uygulanmıyor, rapor birleşik kalıyor. Birleşik rapor doğru
  ve tablonun "Yol" kolonundan çıkarılan banka ile POS toplamları beklenenle aynı.
- Bunların dışında **açıklanmamış fark yok**: Kasa, KDV, Gider, Cari Mizanı, Cari Listesi, Taksit Kartları, Çek/Senet, Stok
  (51 kalemin her biri), yeni carinin ekstresi, Hesap Planı Mizanı (borç = alacak) ve ANLIK DURUM'un 6 kartı kuruşu
  kuruşuna tuttu.
- PDF ve Excel: her raporun iki dosyası da indi, bağlantı pencerenin şirketini taşıdı ve ekrandaki her tutar dosyada da
  geçiyor. Bu bir içerme denetimidir (tutarın dosyada bir yerde bulunması), dosyanın satır satır ekranla aynı olduğunun kanıtı
  değildir; adetler denetime girmedi.

## 4. Bulunan program hataları (kod değiştirilmedi; karar kullanıcıda)

**Bulgu 1 — Fatura formunda çek/senet ödeme satırı doldurulamıyor; klavyeyle girilince evrak SESSİZCE düşüyor (önem:
YÜKSEK).** İlk turda "vade/banka siliniyor, veri bozulmaz" demiştim; bağımsız gözden geçirme bunun eksik ve yanlış olduğunu
gösterdi, yeniden ürettim (`test/excel-denetim/odeme-alani-kaydet.mjs`, sonuç `cikti/odeme-alani-kaydet.json`):

| Giriş biçimi (alış faturası, ödeme "Senet") | Ne oluyor |
|---|---|
| Klavye: Tutar → Tab → Vade → Tab → No → Tab → Banka, tam ödeme 240 | Tutar'dan sonra odak sayfaya düşüyor; Vade boş, "Ziraat" Tutar kutusuna yazılıyor. Kaydet yalnız olağan "kaydedilecek" sorusunu soruyor; **fatura "Açık 240" kaydediliyor, senet YOK** |
| Klavye, kısmi ödeme 100 | aynı: **fatura açık, senet yok, uyarı yok** |
| Fare: her alana tıklayıp yazma (kısmi ve tam) | Vade ve Banka'ya yazılan kayboluyor; Kaydet "1. evrakın vade tarihini seçin" der, kaydetmez |

Kök neden (koddan, gözden geçirmeyle): değer her tuşta forma yazılıyor; ama bir ödeme alanından çıkılınca `change`
işleyicisi (`client/assets/hof-invoices.js:1171-1174`) ödeme bölümünü HEMEN yeniden çiziyor (`:901`). Tıklanan ya da Tab ile
gidilen alan çizimden önce sayfadan kopuyor, odak sayfaya düşüyor; sonraki tuşlar başka alana gidiyor. Tutarı 0 sayılan evrak
kayıtta sessizce atılıyor (`:965`). İlk turdaki "≥ 600 ms beklenirse alan kalıyor" gözlemi yalnız tam ödemede ilk geçişi
kurtarıyor; sonraki alanda yine bozuluyor. Kullanıcı senetle ödedim sanırken fatura ödenmemiş, portföy senetsiz kalır.
Hafta testindeki çekli/senetli faturalar doğru girildi, çünkü betik alanları programla doldurup her alanı yeniden denetledi
(iki şirket karşılaştırması da bunu doğruladı); gerçek klavye kullanıcısı bunu yapmaz.

**Bulgu 2 — Taksit kartı ile fatura kapaması birbirini tutmuyor (yeni).** `server/lib/invoice-settle.mjs` fatura
kapamasında taksit kartının borcunu ve tahsilatını genel "en eski borç" sırasına (FIFO) katıyor; Taksit modülü ise kartın
ödenenini kendi içinde sayıyor; aynı para iki yerde sayılıyor ya da hiçbir yerde sayılmıyor. Denemede her cari yalnız
fatura + kart taşıdığı için ölçü "açık faturalar + kart kalanları = cari bakiye" (D, E, F, G'de doğru ölçü satırda yazılı;
genel bir kural olarak bu ölçü alacaklı caride ve faturasız borçta geçerli değildir — gözden geçirme notu)
(`test/excel-denetim/taksit-fatura-kapama.mjs`, sonuç `cikti/taksit-fatura-kapama.json`):

| Senaryo | Programda fatura | Taksit kartı | Cari bakiye | Sorun |
|---|---|---|---|---|
| A · önce fatura (12.720), sonra ayrı kart (9.000); cari kartından 5.000, karttan 3.000 tahsilat | ödenen 8.000 · açık 4.720 | kalan 6.000 | 13.720 | kartın 3.000'i faturayı da kapatıyor (çift sayım) |
| B · önce kart, sonra fatura; aynı tahsilatlar | ödenen 0 · açık 12.720 | kalan 6.000 | 13.720 | cari kartından alınan 5.000 hiçbir yerde görünmüyor |
| C · fatura 6.000 hiç ödenmedi; kart 9.000 tamamen ödendi | **"Ödendi"** | kalan 0 | 6.000 borçlu | ödenmemiş fatura "Ödendi" (hayalet ödeme) |
| D · faturanın borcu karta bölündü ("Carinin Mevcut Borcu") | açık 9.000 | kalan 9.000 | 9.000 | ikisi tutarlı; ama raporlar ikisini TOPLUYOR |
| E · taksitli fatura 3.000 (kartı faturanın kendisi); müşteri cari kartından 5.000 öder (bağsız) | **"Ödendi"** | kalan 3.000 | −2.000 (müşteri alacaklı) | fatura ile kendi kartı çelişiyor; yaşlandırma/hatırlatma kart üzerinden 3.000 bekliyor |
| F · taksitli fatura 3.000; cari kartından "Kapatılacak Fatura" seçilerek 1.000 tahsilat | açık 2.000 | ödenen 0 · kalan 3.000 | 2.000 | bağlı tahsilat bile kartı kapatmıyor (gözden geçirmede bulundu) |
| G · fatura 12.720 + ayrı kart 9.000; karttan 3.000; kart kapatılır (kalan 6.000 silinir) | ödenen 9.000 · açık 3.720 | kapalı | 12.720 | kartın silinen kalanı faturaya "ödeme" sayılıyor (gözden geçirmede bulundu; kod yorumu "kart kapatma ödeme değildir" diyor) |

E türü Excel haftasında da görüldü: C0122'nin 290,60'lık taksitli faturası (ISL-01905), aynı carinin 31.454,63'lük senediyle
(ISL-03375) "Ödendi" sayılıyor; kendi taksit kartı 290,60 kalan gösteriyor. Dürüst not (gözden geçirme): C0122 o anda
31.164,03 alacaklı; bu durumda faturanın en eski borç sırasıyla "Ödendi" sayılması savunulabilir. Asıl yanlış, kartın hâlâ
ödenmemiş görünmesi. Benim bağımsız hesabım da kartı ödenmemiş saydığı için "Taksit Kartları tuttu" satırı bu caride kartın
doğruluğunu kanıtlamaz. Verideki senedin "başka bir iş için" verildiği bilgisi yok; ilk özetimde öyle yazmıştım, yanlıştı.

**Etkisi.** Cari bakiyesi, Kasa ve mizan DOĞRU; bozuk olan "hangi tahsilat hangi borcu kapattı" eşleştirmesi:
- Fatura kartındaki durum ve Satış Faturaları "Kalan" (A, B, C, E, F, G); Açık Faturalar (A, B, C, G; taksitli faturalar
  bu rapora girmez, E ve F burada görünmez).
- **Alacak Yaşlandırma:** her cari ayrı ayrı yanlış; tek toplam yanıltır. Son koşuda (A–G) cari başına hata (yaşlandırma −
  gerçek alacak): A −3.000, B +5.000, C −6.000, D +9.000, E +3.000 (müşteri alacaklı, kart 3.000 bekleniyor), F +1.000 (kart
  3.000, gerçek 2.000), G −9.000 (kart kapalı, fatura 3.720, gerçek 12.720). Bu koşuda hatalar toplamda tam sıfırlanıyor
  (yaşlandırma 57.160 = gerçek alacak 57.160): toplama bakan biri hatayı göremez.
- Koddan (ölçülmedi): Nakit Akış (`server/routes/overview.mjs:299-302`), Vade Takip (451-455) ve tahsilat takvimi / sağ alt
  bildirimler (`server/routes/dues.mjs:68-72`) aynı iki listeyi birleştiriyor; A, B, C ve D türlerinde orada da yanlış.
- "Ödendi" görünen fatura "Kapatılacak Fatura" ve Mahsup listelerine girmediği için arayüzde düzeltme yolu da yok.
- Programın Mutabakat Testi kapama eşleştirmesini denetlemiyor (`server/lib/integrity.mjs`); 59/59 bunu yakalayamaz.

**Kimi etkiler:** aynı cariye hem fatura kesip hem de faturasız taksit kartı kullanan herkes. Faturasız kartlar yalnız
Taksitler → + Yeni Kart'tan değil, Taksit Excel'i / Tablodan Aktar (`server/routes/plans.mjs:1188`, `covers_balance` 0) ve
Toplu Taksitlendir "yeni borç" (`server/routes/accounts.mjs:974`) ile de açılıyor. Taksitli fatura kesip müşteriden cari kartından
tahsilat alan herkes (E, F).

**Bulgu 3 — Raporlarda dönem düğmesi seçili cariyi siliyor (yeni).** Raporlar → Tüm Raporlar'da cari seçildikten sonra
"Tüm Zamanlar", "Bu Yıl", "Bu Ay"… düğmesine basılınca cari seçimi kalkıyor: Cari Ekstre "Önce cariyi seçin"e düşüyor;
fatura raporlarındaki isteğe bağlı cari süzgeci SESSİZCE kalkıp rapor bütün carileri gösteriyor (Deniz Yapı süzülü: 1
fatura, 1.000 TL → "Bu Yıl" → 2 fatura, 6.000 TL). Tarih yazıp "Ön İzle" seçimi korur. Kök neden:
`client/assets/hof-overview.js:715-718` — dönem tıklaması önce rapor merkezinde işleniyor, sonra Raporlar penceresinin genel
işleyicisine kabarıyor; o da sekmeyi baştan kuruyor (`mount`), yeni kurulan merkezde cari yok (`hof-report-center.js:66-67`,
`select()` → `center.account = null`). Ölçüldü (gözden geçirmeyle): tek "Bu Yıl" tıklaması 3 rapor isteği, 2 katalog isteği ve
gereksiz bir çek listesi isteği (`/cheques?limit=1000`) gönderiyor. "Tüm Zamanları Göster" düğmesi de aynı. Koddan
(denenmedi): yalnız İşlem Geçmişi yetkisi olan kullanıcıda o çek isteği 403 döner; her dönem tıklamasında hata bildirimi
çıkabilir. Yeniden üretim: `test/excel-denetim/rapor-ekstre-secim.mjs` (gerçek
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
- Excel'deki haftanın 51 işi + 16 ek işlem, iki şirkette (001 API, 002 ekran), her iş kendi gününde; tam koşu iki kez.
- Ekrandan: satış (nakit, havale, açık, çek, senet, taksitli), alış (nakit, havale, kredi kartı, açık, çek, senet), gider
  faturaları (nakit, havale, kredi kartı), kira faturası (açık) + sonradan ödeme, iki kalemli satış (ürün + hizmet), cari
  kartından tahsilat/ödeme (nakit, havale, POS, senet), maaş (tahakkuk + ödeme), Çek/Senet penceresinden alınan/verilen evrak,
  cari kartından ve Taksit penceresinden taksit tahsilatı, + Yeni Cari (3), aynı ad denemesi, + Yeni Ürün (2), stok
  giriş/çıkış/fire, Taksitler → + Yeni Kart.
- Rapor Merkezi'nden 14 rapor (16 görünüm) ekrandan, iki şirkette: Kasa Hareketleri, Banka ve POS (Tümü; Yol = Banka; Yol =
  POS), Satış ve Alış Faturaları, KDV Özeti, Gider Raporu, Cari Mizanı, Cari Listesi ve Bakiyeler, Açık Faturalar, Taksit
  Kartları, Çek/Senet Portföyü, Stok Durumu (her kalemin miktarı), Cari Ekstre (yeni müşteri), Hesap Planı Mizanı; ANLIK DURUM
  kartları. Her raporun PDF'i ve Excel'i indirildi; ekrandaki tutarların dosyada geçtiği ve bağlantının şirketi denetlendi.
- Bulgu senaryoları: taksit kartı ↔ fatura (A–G), rapor dönem düğmesi (Cari Ekstre + fatura süzgeci) ve tek tıkta giden
  istekler, Banka/POS Yol süzgeci, fatura formunda çek/senet satırı (klavye ve fare; tam ve kısmi; kaydedilen sonuç).
- Bağımsız gözden geçirme (ayrı ajan, yalnız hata arar): bulguları kodla karşılaştırdı, iki yeni durum (F, G) ve Bulgu 1'in
  gerçek etkisini buldu; hepsi tarafımdan yeniden üretildi (bölüm 7).

**DENENMEYEN**
- İade faturaları, fatura iptali/düzenleme/silme/kopyalama, Mahsup Et, çek tahsili/cirosu/karşılıksız, Kasa ↔ Banka
  transferi, stokta Müşteri İadesi, dönem kilidi, yetkisiz kullanıcının rapor ekranı, ileri tarihli hareket (bu hafta
  testinde yok; 2.0.17 mali müşavir testinde ve Excel denetiminde eski sürümlerde, çoğu API'den denenmişti).
- 43 raporun 29'u bu turda açılmadı (ör. Ba-Bs, Yevmiye, Ürün Bazında Satış, Cari Bazında Tahsilat, Taksit Vadeleri); açılan
  raporlarda da süzgeçlerin hepsi denenmedi (Bulgu 4 bu yüzden 2.0.17'den beri fark edilmemişti).
- Vade Takip, Nakit Akış ve tahsilat takvimindeki yanlış sayım ölçülmedi (koddan çıkarıldı).
- Bulgu 3'ün yalnız İşlem Geçmişi yetkili kullanıcıda 403 hatası vermesi denenmedi (koddan).

**BİLİNEN SINIRLAR**
- Bağımsız beklenen hesap benim yazdığım muhasebe kurallarıyla yapıldı (bölüm 2). C0122'de (alacaklı cari) modelin kuralı
  programınkinden farklı; 290,60'lık fark bu yüzden bir kural farkıdır (bölüm 3.3).
- PDF/Excel denetimi bir içerme denetimidir: ekrandaki tutar dosyada bir yerde bulunuyor mu; dosyanın satır satır aynı olduğu
  kanıtlanmadı, adetler denetlenmedi.
- Koşudaki rapor karşılaştırması tutarların mutlak değerine bakıyordu; sonuç kayıtlı veriden işaretiyle yeniden hesaplandı
  (`hafta-tablo.py`), sonuç aynı. Betik artık işaretiyle karşılaştırıyor.
- İşlem başına "✓" ekrandaki formun kapanmasına bakar; asıl kanıt sondaki iki şirket karşılaştırmasıdır (fark yok).
- Test Linux'ta Chromium'la koştu; tarih kutuları tarayıcı dili yüzünden aa/gg/yyyy göründü (Türkçe Windows'ta gg.aa.yyyy).
- Lisans denetimi testte kapalı; ekrandaki "Ücretsiz deneme henüz başlamadı" kutusu bu yüzden (bulgu değil).
- Hacim küçük: 376 cari, 52 kalem, 67 işlem; yük testi değildir (yük ölçümü 2.0.22'de ayrı yapıldı).

## 6. Düzeltme önerileri (karar kullanıcıda; kod değiştirilmedi)

| Bulgu | Önem | Önerim | İş |
|---|---|---|---|
| 1 · fatura formunda çek/senet satırı | **Yüksek** (klavyeyle girilen senet/çek uyarısız düşüyor; fatura ödenmemiş, portföy eksik) | Ödeme satırları alan değişince yeniden çizilmez, yalnız "Kalan" kutusu güncellenir; tutarı geçersiz ya da 0 olan evrak satırı varken kaydetmeye izin verilmez ("1. evrakın tutarı yok"). Test: klavye ve fare, tam ve kısmi, kayıt sonucu. | Küçük–orta |
| 2 · taksit kartı ↔ fatura kapama | **Yüksek** (yanlış "Ödendi", yanlış alacak ve hatırlatma; arayüzde düzeltme yolu yok) | Faturasız kart (`covers_balance` 0 ve hiçbir faturanın kartı değil) kendi borcunu ve tahsilatını kendi içinde kapatır; karttan artan ödeme genel havuza düşer. Kart kapatma (kalanın silinmesi) ödeme sayılmaz. Taksitli faturada fatura ile kart aynı kuralla kapanır (cari kartından tahsilat önce faturanın kartına, kayıt yazmadan yalnız hesapta sayılır; aksi hâlde Kasa çift sayar). "Mevcut Borç" kartına bölünen açık faturalar vade/yaşlandırma/takvimde bir kez görünür (dağıtım kuralı ya da şema değişikliği gerekir). Değişmez kural testi doğru tanımla: bir tahsilat en çok bir borcu kapatır; fatura ve kendi kartı aynı açığı gösterir; aynı borç iki listede görünmez. Eski veride durum değişimi raporu. Bozulmaması gerekenler: 2.0.17 yön kuralı, Mahsup, iade bağı, iptal. | Orta–büyük (mimari; dikkatli göç ve test) |
| 4 · Banka/POS Yol süzgeci | Orta (rapor yanlış kapsamda; birleşik doğru) | `payMethod` sunucunun parametre listesine eklenir; her raporun her süzgeci arayüzden en az bir kez denenir (test). | Küçük |
| 3 · dönem düğmesi seçimi siliyor | Orta (fatura raporunda süzgeç sessizce kalkıyor; tek tıkta 6 istek) | Raporlar penceresinin genel işleyicisi "Tüm Raporlar" içindeki tıklamaları işlemez; seçili cari dönem değişince korunur. | Küçük |
| PDF özet başlığı kesiliyor | Düşük (görünüm) | Uzun özet başlığı iki satıra iner. | Küçük |

## 7. Bağımsız gözden geçirme ne düzeltti

Ayrı bir ajan (yalnız hata arar, kod değiştirmez) bulguları kodla karşılaştırdı. Hepsini yeniden ürettim; belgeye işlendi:
- **Bulgu 1'in etkisini küçük göstermişim:** "veri bozulmaz" yanlıştı; klavyeyle girilen evrak uyarısız düşüyor.
  Mekanizmayı da yanlış yere bağlamışım (600 ms'lik yeniden çizim değil, alan değişince anında yeniden çizim).
- **Bulgu 2'ye iki yeni durum:** F (Kapatılacak Fatura ile bağlı tahsilat da taksitli faturanın kartını kapatmıyor) ve G
  (kartı kapatmak ödenmemiş faturayı kapatıyor).
- **47.440'lık yaşlandırma toplamı eski bir koşudandı;** tek toplam hataları gizliyor, cari başına yazıldı.
- **E, Açık Faturalar'ı etkilemiyor;** A, B, C ise Nakit Akış/Vade Takip/takvimi de etkiliyor.
- **C0122'nin 290,60'ı bir kural farkı;** "başka iş için" bilgisi veride yok.
- **Değişmez kuralı fazla geniş yazmışım** (alacaklı caride ve faturasız borçta geçerli değil).
- **Bulgu 3'ün mekanizması eksikti;** tek tıkta 6 istek ölçüldü.
- **Bulgu 4 doğru;** başka düşen parametre yok.
- **Test betiklerinde zayıf yerler:** mutlak değer karşılaştırması, NaN'ın geçmesi, içerme tabanlı PDF/Excel denetimi.
  İlk ikisi düzeltildi; üçüncüsü belgede açıkça yazıldı.
