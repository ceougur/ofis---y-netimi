#!/usr/bin/env python3
# Dar kontrol görev metinleri (27.11 gece; sınama ağacı 3 birleşimi d183d780'dan sonra): D3 tur 1–5, Değersiz sınırı, müşteri istekleri tur 1–2,
# devir ön koşulları tur 2. Kullanıcı ve baş mimar kararları iş listesinden AYNEN çekilir. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
_t = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read()
_i = _t.find('def dar('); _j = _t.find('\nDK_D4ON', _i)
exec(_t[_i:_j])
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def parca(anahtar, bas, son, metin=IS):
    s = satir(anahtar, metin); a = s.find(bas); assert a >= 0, bas
    b = s.find(son, a) if son else len(s); assert b > a, son
    return s[a:b].strip()

def k(anahtar):  # kullanıcı kararı satırı, baş mimar uygulaması çıkarılmış
    return satir(anahtar).split(' UYGULAMA (baş mimar')[0]

YASAK_GENEL = "düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md`), ana oturumun yeniden koşu not defterleri"

# ---------------------------------------------------------------- D3 tur 1–5
DK_D3 = dar("dk-d3", "D3 (devir saf hesabı tur 1–5)", "t251-taban..t251-d3-tur5",
 "devir saf hesabı (ön izleme planı: kapanış / açılış satırları, açık kalemlerin tek borç sırasından üretimi, stok, çek / senet, KDV, banka), ön denetim (devri DURDURAN ve UYARAN nedenler — DEVİR NEDEN DURDU ileti yardımcısı), Devir Raporu, veri damgası (ön izlemeden sonra veri değişti mi), devir rotasının ön izleme uçları, plan okuyucunun şemadaki her tablo için sınıf listesi; testler, gerçek veri karşılaştırma üreteci, mutasyon betiği. EK: ana oturumun sınama ağacında yaptığı tek test düzeltmesi 3895eddf (maliyet bağsızlık taramasına devir tablo sınıfı listesi için yalnız D izni) — `git show 3895eddf` ayrıca incele.",
 "\n".join([
  k('KULLANICI KARARI 27.11 07:07 UTC (AYNEN: "önerini uygula" — bekleyen dört'),
  k('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0],
  k('KULLANICI KARARI 27.11 14:18 UTC'),
  k('KULLANICI KARARI 27.11 18:16 UTC'),
  k('KULLANICI KARARI 27.11 20:12 UTC (AYNEN: "bekleyen soruya önerini uygula"'),
  parca('KULLANICI SORUSU 27.11 15:21 UTC', 'KULLANICI SORUSU', ' YANIT (plan'),
  parca('KULLANICI SORUSU 27.11 15:00 UTC', 'KULLANICI SORUSU', ' — YANIT'),
  k('KULLANICI KARARI 27.11 18:36 UTC'),
 ]),
 "\n".join([
  "- " + parca('BAŞ MİMAR KARARI 27.11 06:50 UTC (P-D RAPORU', '(13) Türetilmiş kurallar', ' (14) PAKETLEME'),
  "- " + parca('KULLANICI SORUSU 27.11 15:21 UTC', 'EKSİK BULUNANLAR', ' UYGULAMA:'),
  "- " + parca('KULLANICI SORUSU 27.11 15:00 UTC', 'BAŞ MİMARIN BULDUĞU BOŞLUK', None),
  "- " + parca('BAŞ MİMAR KARARI 27.11 12:24 UTC', '(1) tur 3 =', None),
  "- " + parca('BAŞ MİMAR KARARI 27.11 15:54 UTC', 'KULLANICI SONUCU', ' TUR 4 (devir yeri'),
  "- " + parca('BAŞ MİMAR KARARI 27.11 18:09 UTC', 'KARARLAR:', ' (7) TUR 5'),
  "- " + parca('BAŞ MİMAR KARARI 27.11 20:04 UTC', 'KARARLAR:', ' Hız:'),
  "- KÂHİN OKUMALARI (muhasebe kâhini bakımı 2; baş mimar KABUL): " + parca('BAŞ MİMAR KARARI 27.11 18:15 UTC', 'KÂHİNİN SORULARI:', ' KÂHİN YORUMLARI:'),
  "- " + parca('BAŞ MİMAR KARARI 27.11 20:37 UTC', 'KARAR:', None),
  "- Test düzeltmesi 3895eddf (ana oturum; prensip §4 'yalnız teste dokunan DÜŞÜK'): tam testte düşen maliyet bağsızlık taraması — devirin tablo sınıfı listesi maliyet tablolarını 'D — dokunulmaz' diye adıyla anıyordu; izin yalnız o liste ve yalnız D için.",
 ]),
 "DEVİRLİ = DEVİRSİZ ölçütünün delindiği her sınıf (plan ↔ devirsiz programın aynı tarihteki açık kalemleri, gecikmiş, bakiye; iki aktarma seçeneği); tek borç sırası girdisinin devir için doğru okunması (K öncesi / sonrası bağlar, iade, POS, mahsup, şüpheli, kart, Borçta Kalsın); ön denetimin durdurması gereken ama durdurmadığı durum (S-2, S-3, S-KD-1, S-KD-2, aynı yılın ikinci devri, sonraki yılı devredilmiş yıl, yarıda kalmış önceki devir, ön izlemeden sonra veri değişimi); DEVİR NEDEN DURDU iletilerinde iç kod / İngilizce / tablo adı / eksik alan (ne oldu / neden / ne yapmalı / nereye); veri damgasının veriyi değiştiren bir yazımı kaçırması ya da değiştirmeyen yazımla devri sebepsiz durdurması; KDV, stok (ürün ürün), çek / senet (yön × durum) satırlarının tutarlılığı; kesim günü K = 31.12, K+1, saat dilimi (TZ=UTC ve TZ=Europe/Istanbul — gün sınırı); iki şirket; v2.5.0 gerçek kodunun ürettiği veri; plan hesabının kendisinin bir şey YAZMADIĞI (salt okunur); öğe başına ağır okuma (ders 47 — hız düzeltmesi bu sürümde yok ama yeni ağır okuma eklenmiş mi); test 3895eddf'nin dişi ve gevşetmenin kapsamı.",
 YASAK_GENEL + "; `docs/devir/2.5.1-DEVAM/d3*` (iletiler kataloğu dahil — kendin üret), `sur-*`, kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma)")

# ---------------------------------------------------------------- Değersiz sınırı (M2)
DK_M2 = dar("dk-m2", "M2 (Değersiz Alacak sınırı)", "t251-m2-taban..t251-m2-kod",
 "Değersiz Alacak Yaz'ın yazılabilecek en çok tutarı (S270 + S268): sunucu şüpheli alacak modülü ve rotası (sınır hesabı, fazla yazım reddi, önerilen tutar), cari istemcisindeki Değersiz Alacak Yaz formu (tutar önerisi, iki sınırın ve nedeninin ipucu), testler, bir ekran senaryosu.",
 "\n".join([
  "- 2.5.0'dan gelen kararlar (S270, S268) ve kâhin girdisi: `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (ana oturumun yazdığı karar özeti — kullanıcı kararları AYNEN; OKU, tamamı).",
  k('KULLANICI KARARI 27.11 07:32 UTC'),
  k('KULLANICI KARARI 27.11 09:29 UTC'),
  k('KULLANICI KARARI 27.11 18:36 UTC'),
 ]),
 "\n".join([
  "- " + parca('BAŞ MİMAR KARARI 27.11 08:46 UTC', 'KARARLAR:', ' SIRA:'),
  "- Kod ajanının baş mimara bıraktığı dört madde (DEĞERLENDİR): BM-1 mutabakat değişmezinin durum biçimi yazım SIRASINI okur (meşru sıra ↔ bozuk sıra aynı son durum); BM-2 Değersiz Yaz düğmesinin görünürlüğü için aday günler (ilk açık gün, bugün, aradaki bağlı satır günleri — ara günlerde daha büyük sınır olmadığı kanıtlanmadı); BM-3 formda tarih kendiliğinden geriye KURULMAZ, bugünün tarihiyle yazılabilecek tutar yoksa tutar boş, ipucu en çok yazdıran günü söyler; BM-4 S155 bakiye reddi kapıdan gelir (ret kodu ledger-integrity, ekran önerilen tutarla buna düşmez).",
 ]),
 "S-M2-1 = B'nin iki sınırı (şüpheliye alma günüyle tam tutar, sonraki tarihle kalan) her yolda doğru mu (form, API, Excel / toplu yol varsa, Silinenler'den geri yükleme, düzenleme, silme); önerilen tutar = iki sınırın küçüğü (bakiye sınırı S155 dahil); aynı gün işlem sırası (yazım sırası — ders 31); kısmi Değersiz'den sonra kalanın yazılması; Şüpheliden Çıkar / bağlı tahsilat düzenlemesi sonrası sınır; kilitli dönem ve kilit sınırında gün; fazla yazımın her yolda reddi ve Türkçe nedeni; iki şirket; v2.5.0 verisi; tarih kendiliğinden geriye kurulmuyor mu (BM-3); ekran = API sayıları; yapım aşaması listesinin (cari kâhini) bu kodla boş olduğu (`npm run test:kahin-cari` — kodunu okumadan koş).",
 YASAK_GENEL + "; `docs/devir/2.5.1-DEVAM/m2-istem.txt`, `m2-rapor.md`, `m2k-istem.txt`; kâhin klasörleri `test/bagimsiz/**` (yalnız komutla koş)")

# ---------------------------------------------------------------- Müşteri istekleri tur 1–2 (Mİ)
DK_MI = dar("dk-mi", "Mİ (müşteri istekleri tur 1–2)", "t251-taban..t251-mi-tur2",
 "Mİ-1 geciken taksitin numarası (cari listesi, kartlar, Taksitler, Vade Takip, zil, takvim, nakit akışı; müşteriye giden çıktılar: makbuz, taksit kartı PDF'i, Taksitler listesi PDF'i, cari ekstresi, WhatsApp ekstresi) + sıra numarası boşluğu — tek taksit numarası gösterim modülü, tek borç sırasının girdisinin numarasız kalması; Mİ-2 cari grubuna göre görünümler (Grup Özeti, Tahsilat Dönemi seçici, 'Bu Dönemde Ödeme Yapanlar' süzgeci, yol kırılımı); testler, iki ekran senaryosu.",
 "\n".join([
  "- 2.5.1 plan taslağı `docs/devir/2.5.1-PLAN-TASLAK.md` §3 (Mİ-1 / Mİ-2 — OKU, yalnız §3).",
  satir('KULLANICI KARARI 27.11 (AYNEN: "kasaya giriş derken'),
  k('KULLANICI KARARI 27.11 08:06 UTC'),
  k('KULLANICI KARARI 27.11 18:36 UTC'),
 ]),
 "\n".join([
  "- " + satir('BAŞ MİMAR KARARI 27.11 (Mİ-1 / Mİ-2 ayrıntıları'),
  "- " + parca('BAŞ MİMAR KARARI 27.11 07:58 UTC (Mİ RAPORU', 'KARARLAR:', ' SIRA:'),
  "- " + parca('BAŞ MİMAR KARARI 27.11 12:04 UTC', 'YENİDEN ÜRETİM', ' (d) DERS'),
  "- " + parca('BAŞ MİMAR KARARI 27.11 15:15 UTC', 'KARARLAR:', None),
  "- EKRAN YÜRÜYÜŞÜ (ana oturum, 27.11 20:04): taksit kartı / hareket / makbuz numarası tutarlı, cari kartında Gecikmiş Borç = kart geciken, Taksitler listesinde 'N. taksit · X gün gecikti', Cari Listesi'nde 'Tahsilat Dönemi:' etiketi görünüyor. MAKBUZ PDF'İ ve WHATSAPP EKSTRESİ GÖRÜNTÜSÜ YOK → SEN bak (sahte Meta; gerçek servis YOK).",
 ]),
 "ŞART (baş mimar, tur 2): tek borç sırasına girdi veren HER defter / cari okumasının numarasız yolu kullandığı (kuyruk girdisinde görünen numara olmamalı — hakem dosyaları DEĞİŞMEDİ, değişmemeli); bir taksiti silinmiş / vadesi öne alınmış / araya taksit eklenmiş kartta her ekran ve çıktı AYNI numarayı yazıyor mu (ekran ↔ makbuz PDF ↔ taksit kartı PDF ↔ Taksitler PDF ↔ ekstre ↔ WhatsApp ekstresi); Grup Özeti toplamı = satırlar = Cari Bazında Tahsilat raporunun tanımı (açılış 'Önceden Ödenen' ayrı; karşılıksız çek; POS Komisyon İadesi / Kredi Kartına İade 'Diğer'); dönem seçicinin her seçeneği (ders 11: Bugün, Bu Ay, Geçen Ay, aralık, boş dönem, gelecek tarih); grubu silinmiş cari 'Grupsuz'; 'Bu Dönemde Ödeme Yapanlar' açıkken toplu WhatsApp gizli mi; yetkisiz kullanıcı; iki şirket; mobil ekran; ekran = PDF = Excel; hız (dönemsiz Cari Listesi — kullanıcı kararıyla iki rapor yavaşlaması BİLİNEN SINIR, ÖTEKİ yollarda kötüleşme var mı).",
 YASAK_GENEL + "; `docs/devir/2.5.1-DEVAM/mi-*`, `mi2-*`; kâhin klasörleri `test/bagimsiz/**` (yalnız komutla koş)")

# ---------------------------------------------------------------- Devir ön koşulları tur 2 (D4-ÖN tur 2)
DK_D4ON2 = dar("dk-d4on2", "D4-ÖN TUR 2", "t251-d4on-t2-taban..t251-d4on-t2",
 "devir yedeğinin veri tabanı kopyasının KISA çalışma klasöründe yazılıp taşınması (Windows 260 karakter yol sınırı — CI #1115'te iki taşıma testi 'unable to open database file' ile düşmüştü), yazma / taşıma hatalarının DEVİR NEDEN DURDU düzeninde Türkçe iletisi, yedek modülüne yalnız devir yedeğinin kullandığı yeniden deneme seçeneği; testler.",
 "\n".join([
  k('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' (I) ')[0] + " (II) DEVİR NEDEN DURDU: " + parca('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken', '(II) YENİ İSTEK', ' UYGULAMA SIRASI:'),
 ]),
 "\n".join([
  "- " + parca('BAŞ MİMAR KARARI 27.11 14:54 UTC', 'KARARLAR:', None),
  "- " + parca('BAŞ MİMAR KARARI 27.11 13:57 UTC', 'DÜŞÜK-1', None),
 ]),
 "kısa klasörün kendisinin yol uzunluğu / çakışması (iki şirket aynı anda, aynı ad); taşıma başarısızsa kısa klasörde artık kalıyor mu, sonraki denemede temizleniyor mu; 'Yarım Kaldı' klasörleri birikiyor mu; yeniden deneme seçeneğinin ÖTEKİ yedek yollarında davranışı DEĞİŞTİRMEDİĞİ (rutin / elle / güvenlik yedeği, geri yükleme — ders 10: şema kapısı + geri yükleme testleri komşu); iletide iç kod / İngilizce / 'virüs tarayıcısı' gibi her EACCES'e aynı cümle; Linux'ta zorla üretilen 260 karakter koşulunun gerçekten Windows'taki koşulla aynı olduğu (Windows'a özgü kuşku DOĞRULANMADI'ya — CI'de okunur, ders 18).",
 YASAK_GENEL + "; `docs/devir/2.5.1-DEVAM/d4on*`, `dk-d4on-*`")

for ad, metin in [('dk-d3', DK_D3), ('dk-m2', DK_M2), ('dk-mi', DK_MI), ('dk-d4on2', DK_D4ON2)]:
    open(f'/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/{ad}-istem.txt', 'w', encoding='utf-8').write(metin)
    print(ad, len(metin))
