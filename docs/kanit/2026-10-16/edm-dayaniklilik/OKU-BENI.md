# e-Belge Dayanıklılık Testi (4–5 saat, ekrandan, iki şirket × 5 kullanıcı)

Dosyalar:

- `dayaniklilik.mjs`: Betik. Programı üretim ayarıyla açar (`edocEnabled` + `edocLive`, Ortam = Test, `HUKUK_LICENSE_URL` ölü adres, ders 30). İki şirket, şirket başına 5 kullanıcı (muhasebe ve avukat karışık), her kullanıcı ayrı tarayıcı oturumundadır. Kullanıcılar AYNI ANDA, `SURE_DK` boyunca döngüde, programın ekranından belge keser. Süre bitince sırasıyla: son durum, XML ve PDF indirme, denetimler, kâhin, diş kanıtı.
- `kahin.py`: Bağımsız kâhin (ders 5). Python 3 ile, yalnız standart kütüphaneyle yazıldı. Programın tutar kodu (server/routes/invoices.mjs, server/lib/einvoice/*, server/lib/invoice-math.mjs) OKUNMADAN yazıldı. Kurallar dosyanın başındadır.
- `dis-kaniti.mjs`: Testin dişi var mı (ders 7)? Üç bozulmanın üçü de kırmızı vermeli, bozulmamış kontrol yeşil vermeli.

## Komutlar

Kuru koşu sahte EDM ile yapılır (test/einvoice-mock.mjs); belge harcamaz, kimlik dosyası istemez:

    cd /home/user/ofis---y-netimi
    KURU=1 SURE_DK=10 TEMPO_SN=20 TOHUM=1 node docs/kanit/2026-10-16/edm-dayaniklilik/dayaniklilik.mjs - <çıktı> <çalışma>

Gerçek koşu EDM test ortamında yapılır. Kimlik dosyası yalnız okunur; günlükte ve dosyalarda maskelenir. Başlamadan önce `df -h /` ile en az 5 GB boş yer olduğunu doğrulayın (ders 24):

    cd /home/user/ofis---y-netimi
    SURE_DK=270 TEMPO_SN=90 TOHUM=1 node docs/kanit/2026-10-16/edm-dayaniklilik/dayaniklilik.mjs <KİMLİK> <çıktı> <çalışma> > <çıktı>.log 2>&1; echo "çıkış $?"

Kâhin ve diş kanıtı betikten ayrı olarak yeniden koşulabilir:

    python3 -I docs/kanit/2026-10-16/edm-dayaniklilik/kahin.py <çıktı>                                       # görev kuralı: KDV oran başına
    python3 -I docs/kanit/2026-10-16/edm-dayaniklilik/kahin.py <çıktı> --kdv-kurali satir --cikis <dosya>    # KDV satır başına
    node docs/kanit/2026-10-16/edm-dayaniklilik/dis-kaniti.mjs <çıktı> <boş-çalışma-klasörü>

### Ayarlar (ortam değişkenleri)

| Değişken | Varsayılan | Anlamı |
| --- | --- | --- |
| `SURE_DK` | 270 | Kesim süresi (dk) |
| `TEMPO_SN` | 90 | Bir kullanıcının iki belgesi arasındaki ortalama bekleme (sn); her seferinde ±%50 oynar |
| `TOHUM` | 1 | Planın tohumu. Aynı tohum, kullanıcı başına aynı belge sırasını ve girdileri verir (mulberry32; Math.random kullanılmaz) |
| `SETTLE_DK` | 40 (KURU 3) | Son durum için en uzun bekleme. Yoklama 40–60 sn arayla yapılır |
| `ARA_RAPOR_DK` | 15 (KURU 2) | Konsola yazılan tek satırlık ara raporun aralığı |
| `PROGRAM_PDF_ORAN` | 5 (KURU 1) | Programın kendi PDF'i (karekodu) kaç belgede bir indirilir |
| `IPTAL_YAS_DK` | 5 (KURU 0) | İptal edilecek e-Arşiv en az kaç dakika önce kesilmiş olmalı |
| `ISCI` | min(4, çekirdek) | XSD, şematron, görünüm ve karekod denetimini paralel yapan süreç sayısı |
| `SERI_BASLANGIC` | kriptografik rastgele | TEF/TEA seri başlangıcı. 002, 001'in 500.000 ilerisinden başlar |

## Kesim planı (tohumlu)

**Şirketler**

- 001 DESTEK OFİS (hizmet satışı) şu sektörlerde keser: yazılım, danışmanlık, hukuk, emlak komisyonu, turizm/konaklama (%10), eğitim, temizlik, yemek, personel ve arşiv.
- 002 ATLAS YAPI (stoktan satış, 16 stok kartı) şu sektörlerde keser: inşaat (Çuval, Kg, Teneke, M², Adet, Lt), gıda (%1: Kg, Adet, Paket, Lt), tekstil (%10: Adet, Metre, Takım) ve elektronik (%20: Adet, Kutu). Bunlara hizmet satırları da karışır.

**Belge türleri**

| Belge türü | Oran |
| --- | --- |
| e-Fatura TEMEL | %35 |
| e-Fatura TİCARİ | %20 |
| e-Arşiv kişiye (TCKN 10000000146 / 10000000078) | %28 |
| e-Arşiv mükellef olmayan firmaya | %17 |

Firmanın VKN'si sahte EDM'nin vkn() biçimiyle üretilir. EDM'de "kayıtlı değil" yanıtı gelene kadar denenir.

**Kalemler**

- Bir belgede 1 ile 5 arası kalem olur. Miktarlar ondalık olabilir (Kg, Lt, M², Metre).
- Kalemlerin %25'inde iskonto vardır: %2, %5, %7,5, %10, %12,5 ya da %15.
- KDV oranları belgede tek ya da karışık olabilir: %0, %1, %10, %20.
- KDV tevkifatı firma alıcıda %18 olasılıkla eklenir. Kodlar 602 (9/10), 604 (5/10), 606 (9/10), 612 (9/10) ve 616 (5/10). Programın listesinde olmayan kod kullanılmaz.
- İstisna firma alıcıda %12 olasılıkla eklenir. Kodlar 301, 302, 304, 350 ve 351.
- Tevkifatla istisna aynı belgede %5 olasılıkla birlikte gelir. Bu durumda istisna kodu yalnız 351 olur, çünkü program 351 dışındaki kodları GİB kuralıyla reddediyor. Bu ret KURU koşu 1'de ekranda görüldü.

**Davranışlar**

- %70 Kaydet ve Gönder. %30 Kaydet, Sonra Gönder; ardından karttan e-Belge Gönder.
- Belgeden sonra %8 olasılıkla kendi belgesinden birinde Durum Sorgula.
- Belgeden sonra %5,5 olasılıkla, kendi kestiği ve gönderilmiş bir e-Arşivi iptal eder. EDM "henüz işleniyor" derse kart açılır, Durum Sorgula'ya basılır, beklenir ve iptal en çok 3 kez denenir.
- Sayılar insan hızında yazılır (keyboard.type, 20–25 ms gecikme). Sayfa her 25 belgede bir yenilenir, ayrıca 3 ardışık hatada da yenilenir.
- Cariler (şirket başına 4 e-Fatura mükellefi, 2 kişi, 1 firma) yönetici oturumunda ekrandan açılır. Stok kartları ve ayarlar API ile girilir.

**e-SMM**

e-SMM döngüye girmez. Başta bir kez denenir ve sonucu `sonuc.json → bulgular` alanına yazılır. Test başarısız sayılmaz. Kabul edilen iki davranış:

- **(a) 2.4.0:** Makbuz TES/ESMM numarası alır ve gönderim 409 ile reddedilir. Sonuç: "e-SMM gönderilemiyor".
- **(b) 2.4.1:** Entegratör Ayarları → Firma / Etiket Tanımları'nda `input[data-i="esmm"]` yoktur, `PUT {esmm:true}` 400 `esmm-unavailable` döner, makbuz kâğıttır (SMM serisi, KAGIT). Sonuç: "e-SMM gizli (beklenen)".

## Çıktı klasörü

| Dosya | İçerik |
| --- | --- |
| `plan.jsonl` | Her denemenin EKRANA YAZILAN girdileri: tohum, kullanıcı, şirket, senaryo, alıcı türü ve kimliği, kalemler (ad, miktar, birim fiyat, birim, iskonto, KDV, tevkifat, istisna) |
| `belgeler.jsonl` | Program çıktısı: id, numara, ETTN, profil, tip, durum, e-Durum, ödenecek. Koşu sırasında eklenir, sonda son durumla yeniden yazılır |
| `xml/<no>.xml` | Programın UBL-TR XML'i |
| `pdf/<no>.pdf` | EDM resmî PDF'i (resmi.pdf ucu) |
| `pdf-program/<no>.pdf` | Programın kendi PDF'i |
| `karekod.jsonl` | Çözülen karekod JSON'ları |
| `olaylar.jsonl` | Ekran hataları, iptal denemeleri, Durum Sorgula sonuçları |
| `kahin-sonuc.txt`, `kahin-sonuc-satir.txt` | Kâhin tabloları (KDV oran başına / satır başına) |
| `sonuc.json` | Bütün ✓/✗, dağılım, bulgular, ara raporlar |
| `ekran/` | Hata anı ve e-SMM ekran görüntüleri |

## Betik içi denetimler

- Numaralar şirket ve seri (TEF/TEA) başına benzersiz ve boşluksuzdur. Veri tabanındaki numara sayısı izlenen belge sayısına eşittir. İzlenmeyen satış belgesi yoktur.
- ETTN'ler benzersizdir.
- Her belge EDM'ye bir kez gönderilmiştir (`invoice.e.sent`) ve kesen kullanıcının adıyla gönderilmiştir.
- Son durum Gönderildi ya da Kabul'dür. İptal edilen e-Arşivde durum cancelled/cancelled'dir.
- Profil ve fatura tipi plana uyar: tevkifatlı belge TEVKIFAT, düz belge SATIS. İstisnalı ve karışık belgede tip yalnız bilgi olarak yazılır.
- XML, OASIS UBL 2.1 XSD'sine ve GİB şematronuna uyar. Denetim e-Arşivde `{type: "earsiv"}` ile yapılır (tools/ebelge/dogrula.mjs).
- Görünüm şablonu (XML'e gömülü XSLT, renderView ile çizilir) logoyu, `img alt="GİB"` öğesini ve "Kaşe / İmza" yazısını içerir.
- Karekod pdftoppm ve jsQR ile, programdan bağımsız çözülür. no, ettn, satıcı VKN ve ödenecek tutar belgeyle aynı olmalıdır. Resmî PDF gerçek koşuda denetlenir; KURU koşuda bu denetim atlanır, çünkü sahte EDM'nin PDF'inde karekod yok. Programın kendi PDF'inin karekodu her iki kipte de denetlenir.
- Her carinin bakiyesi, o cariye kesilen ve iptal edilmeyen belgelerin ödenecek toplamına eşittir.
- 002'de stok = açılış − plan miktarlarının toplamı (iptaller hariç).
- Defter bütünlüğü temizdir. İki şirketin verisi birbirine karışmaz; 001 kullanıcısı 002'nin belgesini açamaz (404).
- Kullanıcı sayfalarında hata yoktur.
- Senaryo kapsamı denetlenir: dört belge türü en az 3 kez çıkmalı; her tevkifat ve istisna kodu, her birim (Çuval ve Teneke dahil), KDV %0, %1, %10 ve %20, karışık KDV, iskonto, tevkifat + istisna, Sonra Gönder, iptal, Durum Sorgula ve her sektör en az bir kez çıkmalı.
- Kâhin iki kuralla koşar ve diş kanıtı yapılır.
- Her `ARA_RAPOR_DK` dakikada konsola tek satır yazılır: `ARA RAPOR <dk> — belge … durum {…} ekran hatası … iptal … sayfa hatası …`.

## Bilinen durumlar ve sınırlar

- **KDV yuvarlaması (kural kararı ana oturumda).** Görev tanımındaki kural "KDV oran başına kuruşa yuvarlanır" idi. Program KDV'yi satır başına yuvarlayıp topluyor; bu, XML'deki satır `TaxTotal` değerlerinden görüldü, programın kodu okunmadı. Çok satırlı belgelerin bir kısmında ödenecek tutar 1 kuruş farklı çıkıyor. Kâhin varsayılan kuralda bu belgeleri FARKLI der ve satırına "[BİLGİ: satır başına yuvarlamayla AYNI]" ekler. `--kdv-kurali satir` ile yeniden koşulunca açıklanamayan fark kalırsa, o fark gerçek uyuşmazlıktır.
- **Kısmi ayar gönderimi.** `PUT /invoices/settings` kısmi `start` haritası alırsa öbür serilerin başlangıcı sıfırlanıyor (KURU koşu 2'de TEF 000000001'den başladı). Betik bu yüzden haritayı bütün olarak gönderir. Ekran haritayı hep bütün gönderdiği için bu bir API anlamı sayıldı, ürün bulgusu sayılmadı.
- **İptal edilen belgenin XML'i (GÖZLEM, karar ana oturumda).** İptal edilmiş e-Arşivin UBL XML'i programdan indirilemiyor: `ubl.xml` 409 "Yalnız kaydedilmiş faturanın e-Belgesi (UBL-TR XML) üretilir." döndürüyor; resmî PDF ise iniyor. Bu, KURU koşu 3'te görüldü. Betik bu yüzden XML'i iptalden önce indirir ("XML İndir"); gözlem `sonuc.json → gozlemler` alanına yazılır.
- **İptal edilen belgenin PDF'inde karekod (GÖZLEM).** İptal edilmiş belgenin program PDF'inde karekod yok; sayfada "İPTAL EDİLDİ" damgası var. Bu, KURU koşu 4'te 5 iptalin 5'inde görüldü. Betik programın PDF'ini ve EDM resmî PDF'ini iptalden önce indirir; karekod denetimini bu PDF'lerle yapar. İptal sonrası PDF'ler `<no>-iptal-sonrasi.pdf` adıyla saklanır; bunlardaki karekod sayısı gözlem olarak yazılır.
- **Tekrarlanabilirlik.** Plan aynı tohumla aynıdır. İptal edilecek belgenin seçimi ise koşu anındaki duruma bağlıdır (gönderilmiş ve yeterince eski e-Arşivler arasından tohumlu seçilir).
- **Gece yarısı.** Koşu gece yarısını geçerse belgeler ertesi günün tarihini alır. Denetimler tarihe bağlı değildir; karekod tarihi denetlenmez (ders 22).

## KURU koşu (sahte EDM; 16.10.2026, ağaç 2.4.0 kodu, commit 120c9b2 + bu klasör)

Komut: `KURU=1 SURE_DK=10 TEMPO_SN=20 TOHUM=1 node docs/kanit/2026-10-16/edm-dayaniklilik/dayaniklilik.mjs - <çıktı> <çalışma>`. Başlamadan önce disk okundu: 18 GB boş. Ham çıktı `kuru-kosu/` klasöründedir.

**Sonuç: çıkış kodu 1 — 68 ✓, 1 ✗.**

| Ölçüm | Değer |
| --- | --- |
| Ekrandan kesilen belge | 174 (planlanan 174) |
| Ekran hatası | 0 |
| Ortalama belge süresi | 13,7 sn |
| e-Arşiv iptali | 5/5 |
| Durum Sorgula | 12/12 |
| XSD + şematron | 174/174 |
| Görünüm (logo, GİB, kaşe) | 174/174 |
| Program PDF karekodu | 174/174 |

Numaralar boşluksuzdu, ETTN'ler benzersizdi, her belge bir kez gönderildi. Bakiye, stok, defter ve şirket ayrımı ✓; senaryo kapsamı ✓.

**Tek ✗:** kâhin, görev kuralıyla (KDV oran başına yuvarlanır) koşulunca 17 belgede 1 kuruş fark buldu. Bu 17 belgenin 17'si de satır başına yuvarlamayla AYNI çıkıyor. Kâhin `--kdv-kurali satir` ile koşulunca 174/174 AYNI.

Diş kanıtında üç bozulma da kırmızı verdi; kontroller yeşil kaldı.

**e-SMM bulgusu (a):** makbuz TES2026…, profil ESMM; formda yalnız "Makbuzu Kaydet" var; gönderim 409 `einvoice-not-sendable` "Bu belge gönderilemez."

Gerçek koşu için tahmin (270 dk, 10 kullanıcı, `TEMPO_SN` 90):

- Bir döngü yaklaşık 110–115 sn sürer: ekran ve EDM 15–20 sn, bekleme ortalama 90 sn, ek eylemler.
- Kullanıcı başına yaklaşık 145 belge, toplam yaklaşık **1.400–1.500 belge** (TEF ve TEA aşağı yukarı yarı yarıya).
- Kesimden sonra şunlar eklenir: son durum en çok 40 dk, indirme yaklaşık 5–10 dk, denetim yaklaşık 25–30 dk (4 işçi). Toplam yaklaşık 5–6 saat.
- Görünüm derleme önbelleği çalışma klasöründe birikir (belge başına yaklaşık 0,3 MB, yani yaklaşık 0,5 GB).
