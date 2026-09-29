// Sektöre uygun taslak Excel (v2.0.9). Excel'i olmayan ofis açılış ekranından sektörünü seçer; taslak indirilir,
// doldurulur, aynı ekrandan yüklenir. Kolon başlıkları sektörün tanınma ipuçlarıyla (sectors.mjs) uyumludur: dolu taslak
// yüklenince program sektörü, kişi, telefon, tutar, tarih ve ödeme günü kolonlarını kendiliğinden tanır; aylık ödenen
// işlerde (aidat, kira, servis ücreti, üyelik) ay kolonları tahsilat takvimine girer.
//
// Taslakta örnek satır yoktur (silinmesi unutulan örnek gerçek kayıt gibi içeri alınırdı) ve ek açıklama sayfası
// yoktur (o da tablo sekmesi olarak alınırdı). Yol gösterme Excel'in kendi araçlarıyladır: başlığa tıklanınca çıkan
// yardım notu, açılır liste, hazır tarih / tutar / metin biçimi, sabit başlık satırı.
//
// Tanım dili: "Başlık|tür; Başlık|tür:seçenek,seçenek; …". Türler: id (numara, metin), person (kişi / firma adı),
// phone, email, date, day (her ayın ödeme günü 1–31), money, number, list:… (açılır liste), text (varsayılan).
import { sectorById } from "./sectors.mjs";

export const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const TEMPLATE_ROWS = 2000;

// months: "school" → Eylül–Haziran (içinde bulunulan eğitim yılı), "year" → Ocak–Aralık (bu yıl).
const T = {
  // ----- Hukuk -----
  "hukuk-buro": ["Dosya No|id; Müvekkil|person; Telefon|phone; Vekaletname Tarihi|date; İş Türü|list:Dava,İcra,Danışmanlık,Arabuluculuk,Diğer; Karşı Taraf; Esas No; Sorumlu Avukat; Vekalet Ücreti|money; Ödeme Günü|day; Durum|list:Açık,Beklemede,Kapandı; Not"],
  "hukuk-icra": ["Takip No|id; Borçlu|person; Borçlu Telefon|phone; Alacaklı; İcra Dairesi; Takip Tarihi|date; Takip Türü|list:İlamsız,İlamlı,Kambiyo,Kira,İpotek,Rehin; Alacak Tutarı|money; Ödeme Sözü Tarihi|date; Haciz|list:Yok,Konuldu,Kaldırıldı; Durum|list:Açık,Haciz aşamasında,Ödeme planında,Kapandı; Not"],
  "hukuk-dava": ["Dosya No|id; Müvekkil|person; Telefon|phone; Davacı; Davalı; Mahkeme; Esas No; Karar No; Dava Türü|list:Alacak,Boşanma,İş,Ceza,Kira,Tazminat,İdari,Diğer; Duruşma Tarihi|date; Vekalet Ücreti|money; Durum|list:Derdest,Karar verildi,İstinafta,Temyizde,Kesinleşti; Not"],
  "hukuk-arabuluculuk": ["Dosya No|id; Başvurucu|person; Telefon|phone; Karşı Taraf; Uyuşmazlık Türü|list:İşçi-işveren,Ticari,Tüketici,Kira,Ortaklığın giderilmesi,Diğer; Başvuru Tarihi|date; Toplantı Tarihi|date; Son Tutanak|list:Anlaşma,Anlaşmama,Kısmen anlaşma; Arabulucu Ücreti|money; Durum|list:Açık,Kapandı; Not"],
  "hukuk-noter": ["Yevmiye No|id; İşlem Sahibi|person; Telefon|phone; İşlem Türü|list:Vekaletname,İhtarname,Onaylama,Düzenleme,Satış vaadi,Diğer; Düzenleme Şekli|list:Düzenleme,Onaylama,Tasdik; İşlem Tarihi|date; Harç|money; Noter Ücreti|money; Durum|list:Tamamlandı,Bekliyor; Not"],
  "hukuk-marka-patent": ["Başvuru No|id; Başvuru Sahibi|person; Telefon|phone; Marka / Buluş Adı; Tür|list:Marka,Patent,Faydalı model,Tasarım tescil; Nice Sınıfı; Başvuru Tarihi|date; Tescil No; Bülten Tarihi|date; Yenileme Tarihi|date; Ücret|money; Durum|list:Başvuruda,İtirazda,Tescilli,Reddedildi; Not"],
  "hukuk-kurumsal": ["Dosya No|id; Müvekkil Şirket|person; Telefon|phone; Uyum / Kurumsal Konu|list:Genel kurul,Ticaret sicil,KVKK uyum,Sözleşme,Danışmanlık; Ticaret Sicil No; Genel Kurul Tarihi|date; KVKK Uyum|list:Tamam,Eksik,Başlanmadı; Sözleşme Tarihi|date; Danışmanlık Ücreti|money; Ödeme Günü|day; Durum|list:Açık,Tamamlandı; Not"],
  // ----- Finans ve muhasebe -----
  "finans-muhasebe": ["Mükellef|person; Vergi No|id; Vergi Dairesi; Telefon|phone; Mükellefiyet|list:Bilanço,İşletme,Serbest meslek,Basit usul; Beyanname|list:KDV,Muhtasar,Geçici vergi,Kurumlar,Gelir; E-Defter|list:Var,Yok; SGK Sicil No; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not"],
  "finans-cari": ["Cari Kod|id; Cari Adı|person; Telefon|phone; Vergi No; Fatura No; Fatura Tarihi|date; Vade Tarihi|date; Borç Bakiye|money; Alacak Bakiye|money; Hesap Kodu; Durum|list:Aktif,Pasif; Not"],
  "finans-tahsilat": ["Borçlu|person; Telefon|phone; Borç Tutarı|money; Kalan Borç|money; Vade Tarihi|date; Gecikme Günü|number; Ödeme Planı|list:Yok,Taksitli,Çek,Senet; Ödeme Sözü Tarihi|date; Protesto|list:Yok,Var; Durum|list:Açık,Ödeme planında,Kapandı; Not"],
  "finans-kredi": ["Başvuru No|id; Müşteri|person; Telefon|phone; Kredi Türü|list:İhtiyaç,Taşıt,Konut,Ticari; Kredi Tutarı|money; Faiz Oranı|number; Vade (ay)|number; Anapara Tutarı|money; Kefil; Findeks Kredi Notu|number; Başvuru Tarihi|date; Durum|list:İncelemede,Onaylandı,Reddedildi,Kullandırıldı; Not"],
  "finans-yatirim": ["Hesap No|id; Yatırımcı|person; Telefon|phone; Portföy; Hisse / Fon Kodu; Lot|number; Maliyet Fiyatı|money; Piyasa Değeri (TL)|money; Getiri (%)|number; Borsa|list:BIST,Yurt dışı,Fon; Durum|list:Açık,Kapalı; Not"],
  "finans-leasing": ["Sözleşme No|id; Kiracı Firma|person; Telefon|phone; Ekipman; Finansal Kiralama Tutarı|money; Kira Bedeli|money; Vade (ay)|number; Başlangıç Tarihi|date; Ödeme Günü|day; Durum|list:Aktif,Tamamlandı,Gecikmede; Not"],
  "finans-faktoring": ["İşlem No|id; Müşteri Firma|person; Telefon|phone; Keşideci; Çek No; Fatura No; Temlik Tarihi|date; Vade Tarihi|date; Tutar|money; İskonto Oranı|number; Durum|list:Açık,Tahsil edildi,Karşılıksız; Not"],
  "finans-butce": ["Fiş No|id; Bütçe Kalemi; Masraf Merkezi; Kategori|list:Kira,Personel,Ofis,Ulaşım,Pazarlama,Diğer; Planlanan Tutar|money; Gerçekleşen Harcama Tutarı|money; Harcama Tarihi|date; Onaylayan|person; Durum|list:Onay bekliyor,Onaylandı,Reddedildi; Not"],
  "finans-kuyum-doviz": ["İşlem No|id; Müşteri|person; Telefon|phone; İşlem Türü|list:Alış,Satış,Takas; Ürün|list:Gram altın,Çeyrek altın,Yarım altın,Tam altın,Bilezik,Döviz; Ayar|list:24,22,18,14; Gram|number; Milyem|number; Kur|number; Tutar|money; İşlem Tarihi|date; Not"],
  // ----- Sigorta -----
  "sigorta-acente": ["Poliçe No|id; Sigortalı|person; Telefon|phone; Sigorta Ettiren; Branş|list:Kasko,Trafik,DASK,Konut,Sağlık,İşyeri,Ferdi kaza,Nakliyat; Sigorta Şirketi; Plaka; Başlangıç Tarihi|date; Bitiş Tarihi|date; Prim|money; Zeyil|list:Yok,Var; Durum|list:Yürürlükte,Yenilenecek,İptal; Not"],
  "sigorta-hasar": ["Hasar No|id; Sigortalı|person; Telefon|phone; Poliçe No; Plaka; Kaza Tarihi|date; Hasar Tarihi|date; Eksper; Ekspertiz Tarihi|date; Tazminat Tutarı|money; Rücu|list:Yok,Var; Onarım Servisi; Durum|list:Açık,Ekspertizde,Ödendi,Reddedildi; Not"],
  "sigorta-hayat": ["Sözleşme No|id; Katılımcı|person; Telefon|phone; Ürün|list:BES,Hayat sigortası,Birikimli hayat; Katkı Payı Tutarı|money; Ödeme Günü|day; Lehtar; Fon Dağılımı; Başlangıç Tarihi|date; Emeklilik Tarihi|date; Durum|list:Yürürlükte,Askıda,Ayrıldı; Not"],
  "sigorta-saglik": ["Poliçe No|id; Sigortalı|person; Telefon|phone; Tamamlayıcı / Özel Sağlık|list:Tamamlayıcı sağlık,Özel sağlık; Anlaşmalı Kurum; Teminat Limiti|money; Provizyon No; Başlangıç Tarihi|date; Bitiş Tarihi|date; Poliçe Bedeli|money; Durum|list:Yürürlükte,Yenilenecek,İptal; Not"],
  // ----- Sağlık -----
  "saglik-klinik": ["Hasta No|id; Hasta|person; Telefon|phone; Doğum Tarihi|date; Protokol No; Poliklinik; Hekim; Muayene Tarihi|date; Tanı; Tedavi; Randevu Tarihi|date; Ücret|money; Durum|list:Tedavide,Tedavi bitti; Not"],
  "saglik-dis": ["Hasta|person; Telefon|phone; Diş Numarası; Yapılacak Tedavi|list:Dolgu,Kanal tedavisi,İmplant,Ortodonti,Protez,Kron,Zirkonyum,Beyazlatma; İmplant / Protez|list:Yok,İmplant,Protez,Kron; Ortodonti|list:Yok,Var; Diş Hekimi; Randevu Tarihi|date; Tedavi Ücreti|money; Ödenen|money; Kalan|money; Durum|list:Devam ediyor,Tamamlandı; Not"],
  "saglik-hastane": ["Protokol No|id; Hasta|person; Telefon|phone; Servis; Yatak No; Yatış Tarihi|date; Taburcu Tarihi|date; Hekim; Ameliyat|list:Yok,Planlandı,Yapıldı; Sevk; Provizyon No; Epikriz|list:Hazır,Bekliyor; Durum|list:Yatışta,Taburcu,Sevk edildi; Not"],
  "saglik-eczane": ["Reçete No|id; Hasta|person; Telefon|phone; İlaç Adı; Etken Madde; Karekod; Miat|date; Kutu|number; Reçete Tarihi|date; Tutar|money; Durum|list:Verildi,Bekliyor; Not"],
  "saglik-lab": ["Numune No|id; Hasta|person; Telefon|phone; Tetkik; Test Adı; Numune Tarihi|date; Sonuç Değeri; Referans Aralığı; Sonuç Tarihi|date; Ücret|money; Durum|list:Beklemede,Sonuçlandı,Teslim edildi; Not"],
  "saglik-fizik": ["Danışan|person; Telefon|phone; Fizyoterapist; Tedavi Bölgesi; Rehabilitasyon Programı; Seans Sayısı|number; Kalan Seans|number; Başlangıç Tarihi|date; Ücret|money; Ödeme Günü|day; Durum|list:Devam ediyor,Tamamlandı; Not"],
  "saglik-psikoloji": ["Danışan|person; Telefon|phone; Psikolog; Terapi Türü|list:Bireysel,Çift,Aile,Çocuk,Online; Seans Günü|list:Pazartesi,Salı,Çarşamba,Perşembe,Cuma,Cumartesi; İlk Görüşme|date; Ücret|money; Ödeme Günü|day; Durum|list:Devam ediyor,Ara verdi,Tamamlandı; Not"],
  "saglik-diyet": ["Danışan|person; Telefon|phone; Boy (cm)|number; Kilo|number; Hedef Kilo|number; VKİ|number; Bel Çevresi|number; Diyet Programı; Kontrol Tarihi|date; Ücret|money; Durum|list:Devam ediyor,Tamamlandı; Not"],
  "saglik-veteriner": ["Hasta No|id; Hayvan Sahibi|person; Telefon|phone; Hayvan Adı; Tür|list:Kedi,Köpek,Kuş,Tavşan,Diğer; Irk; Mikroçip No; Kuduz Aşısı|date; Karma Aşı|date; Muayene Tarihi|date; Ücret|money; Durum|list:Aktif,Pasif; Not"],
  "saglik-evde-bakim": ["Hasta|person; Telefon|phone; Adres; Hemşire; Bakım Planı; Vizit Sıklığı|list:Her gün,Haftada 3,Haftada 1; Pansuman|list:Yok,Var; Başlangıç Tarihi|date; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not"],
  "saglik-optik": ["Müşteri|person; Telefon|phone; Sağ Göz SPH; Sağ Göz CYL; Sağ Göz Aks; Sol Göz SPH; Sol Göz CYL; Sol Göz Aks; Çerçeve; Cam / Lens; Reçete Tarihi|date; Tutar|money; Durum|list:Hazırlanıyor,Teslim edildi; Not"],
  "saglik-turizm": ["Hasta|person; Telefon|phone; Ülke; Pasaport No; Tedavi Paketi; Tercüman; Geliş Tarihi|date; Transfer|list:Yok,Havalimanı,Otel-hastane; Otel; Paket Ücreti|money; Durum|list:Planlandı,Tedavide,Tamamlandı; Not"],
  // ----- Eğitim -----
  "egitim-okul": ["Öğrenci No|id; Öğrenci|person; Sınıf; Şube; Veli; Veli Telefon|phone; Kayıt Tarihi|date; Yıllık Ücret|money; Taksit Sayısı|number; Ödeme Günü|day; Devamsızlık|number; Durum|list:Aktif,Ayrıldı,Mezun; Not"],
  "egitim-kurs": ["Öğrenci|person; Veli; Veli Telefon|phone; Kurs; Hazırlandığı Sınav|list:LGS,YKS (TYT-AYT),KPSS,ALES,Diğer; Grup; Kayıt Ücreti|money; Aylık Taksit Tutarı|money; Ödeme Günü|day; Etüt; Son Deneme Sınavı Neti|number; Durum|list:Aktif,Ayrıldı; Not"],
  "egitim-dil": ["Öğrenci|person; Telefon|phone; Dil|list:İngilizce,Almanca,Fransızca,İspanyolca,Arapça,Rusça; Seviye|list:A1,A2,B1,B2,C1,C2; Kur; Placement Sonucu; Hedef Sınav|list:Yok,IELTS,TOEFL,YDS; Kayıt Tarihi|date; Kur Ücreti|money; Ödeme Günü|day; Durum|list:Aktif,Ayrıldı,Tamamladı; Not"],
  "egitim-universite": ["Öğrenci No|id; Öğrenci|person; Telefon|phone; Fakülte; Bölüm; Sınıf; AKTS|number; GNO|number; Tez Konusu; Danışman; Transkript|list:Hazır,Bekliyor; Durum|list:Aktif,Mezun,Kayıt dondurdu; Not"],
  "egitim-anaokulu": ["Öğrenci|person; Yaş Grubu|list:2 yaş,3 yaş,4 yaş,5 yaş,6 yaş; Kreş / Anaokulu Sınıfı; Veli; Telefon|phone; Kayıt Tarihi|date; Kreş Ücreti|money; Ödeme Günü|day; Durum|list:Aktif,Ayrıldı; Not", { months: "school" }],
  "egitim-surucu": ["Kursiyer|person; Telefon|phone; T.C. Kimlik No|id; Ehliyet Sınıfı|list:B,A2,A,C,D,E; MTSK Dönemi; E-Sınav Tarihi|date; Direksiyon Sınavı Tarihi|date; Sınav Hakkı|number; Kurs Ücreti|money; Ödenen|money; Kalan|money; Durum|list:Kayıtlı,Sınavda,Ehliyet aldı; Not"],
  "egitim-sertifika": ["Katılımcı|person; Telefon|phone; E-posta|email; Eğitim Adı; Modül; Oturum Tarihi|date; Yoklama|list:Katıldı,Katılmadı; Tamamlama Oranı (%)|number; Sertifika|list:Verildi,Bekliyor; Ücret|money; Durum|list:Devam ediyor,Tamamladı; Not"],
  "egitim-ozel-ders": ["Ad Soyad|person; Telefon|phone; Özel Ders|list:Matematik,Türkçe,Fen,İngilizce,Koçluk,Diğer; Ders Günü|list:Pazartesi,Salı,Çarşamba,Perşembe,Cuma,Cumartesi,Pazar; Ders Saati; Koçluk|list:Yok,Var; Ders Ücreti|money; Ödeme Günü|day; Durum|list:Aktif,Bitti; Not"],
  // ----- Gayrimenkul ve inşaat -----
  "emlak-ofisi": ["İlan No|id; Mülk Sahibi|person; Telefon|phone; Satılık / Kiralık|list:Satılık,Kiralık; Adres; Metrekare (m²)|number; Oda Sayısı|list:1+0,1+1,2+1,3+1,4+1,5+1; Bina Yaşı|number; Kat; Fiyat|money; İlan Tarihi|date; Durum|list:Aktif,Satıldı,Kiralandı,Pasif; Not"],
  "site-yonetimi": ["Daire No|id; Kat Maliki|person; Telefon|phone; Sakin; Blok; Kat|number; Aylık Aidat|money; Yakıt / Isınma Bedeli|money; Ödeme Günü|day; Durum|list:Oturuyor,Boş,Kirada; Not", { months: "year" }],
  "mulk-kira": ["Mülk; Kiracı|person; Telefon|phone; Mülk Sahibi; Adres; Kira Başlangıç|date; Kira Bedeli|money; Ödeme Günü|day; Depozito|money; Kira Artışı (%)|number; Stopaj|list:Yok,Var; Durum|list:Kirada,Boş; Not", { months: "year" }],
  "insaat-proje": ["Poz No|id; İş Kalemi; Taşeron|person; Telefon|phone; Şantiye; Birim|list:m²,m³,ton,adet,mt; Metraj|number; Birim Fiyat|money; Hakediş Tutarı|money; Hakediş Tarihi|date; Beton Sınıfı; Durum|list:Devam ediyor,Tamamlandı; Not"],
  "konut-satis": ["Daire No|id; Alıcı|person; Telefon|phone; Blok; Kat|number; Cephe|list:Kuzey,Güney,Doğu,Batı; Brüt m²|number; Net m²|number; Satış Fiyatı|money; Peşinat Tutarı|money; Taksit Tutarı|money; Sözleşme Tarihi|date; Durum|list:Satıldı,Opsiyonlu,Satılık; Not"],
  mimarlik: ["Proje No|id; İşveren|person; Telefon|phone; Proje Adı; Proje Türü|list:Avan proje,Uygulama projesi,İç mimari,Render; Mimar; Revizyon|number; Teslim Tarihi|date; Proje Bedeli|money; Ödenen|money; Durum|list:Çizimde,Revizyonda,Teslim edildi; Not"],
  harita: ["İş No|id; Müşteri|person; Telefon|phone; İl / İlçe; Ada; Parsel; Pafta; İşlem|list:Aplikasyon,İfraz,Tevhid,Cins tashihi,Kadastro; Başvuru Tarihi|date; Ücret|money; Durum|list:Sahada,Kadastroda,Tamamlandı; Not"],
  "yapi-denetim": ["Dosya No|id; Yapı Sahibi|person; Telefon|phone; Ada / Parsel; Yapı Sınıfı|list:I-A,II-A,II-B,III-A,III-B,IV-A,IV-B,V-A; Yapı Denetçi; Seviye Tespit|list:Temel,Kaba inşaat,İnce inşaat,İskân; Ruhsat Tarihi|date; Hizmet Bedeli|money; Durum|list:Devam ediyor,İskân alındı; Not"],
  // ----- Otomotiv ve ulaşım -----
  "oto-galeri": ["Plaka|id; Marka / Model; Model Yılı|number; Kilometre|number; Vites|list:Manuel,Otomatik; Yakıt|list:Benzin,Dizel,LPG,Hibrit,Elektrik; Şasi No; Motor No; Alış Fiyatı|money; Satış Fiyatı|money; Alıcı / Satıcı|person; Telefon|phone; Durum|list:Satışta,Satıldı,Rezerve; Not"],
  "oto-servis": ["İş Emri No|id; Müşteri|person; Telefon|phone; Plaka; Araç; Arıza / Şikâyet; Yapılan İşlem|list:Yağ değişimi,Periyodik bakım,Arıza,Kaporta,Diğer; Servis Tarihi|date; İşçilik Ücreti|money; Parça Tutarı|money; Toplam|money; Durum|list:Serviste,Hazır,Teslim edildi; Not"],
  "oto-kiralama": ["Kiralama No|id; Müşteri|person; Telefon|phone; Ehliyet No; Plaka; Teslim Alış Tarihi|date; İade Tarihi|date; Günlük Ücret|money; Depozito|money; Toplam|money; Durum|list:Kirada,İade edildi,Rezervasyon; Not"],
  filo: ["Plaka|id; Araç; Zimmetli Personel|person; Telefon|phone; Kilometre|number; Muayene Tarihi|date; Kasko Bitiş|date; Trafik Sigortası Bitiş|date; HGS / OGS No; Yakıt Kartı No; Durum|list:Aktif,Serviste,Pasif; Not"],
  lojistik: ["Sevkiyat No|id; Müşteri|person; Telefon|phone; Yükleme Yeri; Boşaltma Yeri; Yükleme Tarihi|date; İrsaliye No; Plaka / Dorse; Tonaj|number; Navlun Bedeli|money; Durum|list:Planlandı,Yolda,Teslim edildi; Not"],
  kargo: ["Kargo Takip No|id; Gönderici|person; Telefon|phone; Alıcı; Teslimat Adresi; Desi|number; Kurye; Gönderi Tarihi|date; Ücret|money; Durum|list:Hazırlanıyor,Yolda,Teslim edildi,İade; Not"],
  "okul-servisi": ["Öğrenci|person; Veli Adı; Veli Telefon|phone; Okul; Sınıf; Güzergâh; Servis Plaka; Aylık Ücret|money; Durum|list:Aktif,Ayrıldı; Not", { months: "school" }],
  "servis-tasima": ["Güzergâh; Firma / Kurum|person; Telefon|phone; Durak; Sefer Saati; Biniş Sayısı|number; Şoför; Araç Plaka; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not", { months: "year" }],
  "yedek-parca": ["Parça No|id; Parça Adı; OEM No; Orijinal No; Muadil; Araç Uyumu; Stok|number; Alış Fiyatı|money; Satış Fiyatı|money; Durum|list:Stokta,Tükendi,Siparişte; Not"],
  lastik: ["Müşteri|person; Telefon|phone; Plaka; Lastik Ebatı; Marka; Mevsim|list:Yaz,Kış,Dört mevsim; Jant; Lastik Oteli|list:Yok,Var; Rot Balans|list:Yapılmadı,Yapıldı; İşlem Tarihi|date; Tutar|money; Durum|list:Otelde,Teslim edildi; Not"],
  "oto-ekspertiz": ["Rapor No|id; Müşteri|person; Telefon|phone; Plaka; Marka / Model; Kilometre|number; Değişen Parça; Boyalı Parça; Lokal Boya; Ekspertiz Tarihi|date; Ücret|money; Durum|list:Tamamlandı,Bekliyor; Not"],
  otopark: ["Plaka|id; Araç Sahibi|person; Telefon|phone; Abonman|list:Günlük,Aylık,Yıllık; Giriş Saati; Çıkış Saati; Yıkama|list:Yok,İç-dış,Detaylı; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not", { months: "year" }],
  // ----- Perakende ve e-ticaret -----
  eticaret: ["Sipariş No|id; Müşteri|person; Telefon|phone; Pazaryeri|list:Web sitesi,Trendyol,Hepsiburada,N11,Amazon,Diğer; Ürün; Adet|number; Sipariş Tarihi|date; Sepet Tutarı|money; Kargo Takip No; Durum|list:Hazırlanıyor,Kargoda,Teslim edildi,İade; Not"],
  magaza: ["Ürün Kodu|id; Ürün Adı; Kategori; Stok|number; Raf; Alış Fiyatı|money; Satış Fiyatı|money; Son Alım Tarihi|date; Durum|list:Satışta,Tükendi; Not"],
  market: ["Barkod|id; Ürün Adı; Kategori; Raf; Miktar|number; SKT|date; Fiyat|money; Kasa|list:Kasa 1,Kasa 2,Kasa 3; Durum|list:Satışta,Tükendi; Not"],
  toptan: ["Sipariş No|id; Bayi|person; Telefon|phone; Ürün; Koli|number; Palet|number; Birim Fiyat|money; Tutar|money; Sipariş Tarihi|date; Vade Tarihi|date; Durum|list:Hazırlanıyor,Sevk edildi,Teslim edildi; Not"],
  giyim: ["Model Kodu|id; Ürün Adı; Beden|list:XS,S,M,L,XL,XXL; Renk; Kumaş; Sezon|list:İlkbahar-yaz,Sonbahar-kış; Stok|number; Alış Fiyatı|money; Satış Fiyatı|money; Durum|list:Satışta,Tükendi; Not"],
  mobilya: ["Sipariş No|id; Müşteri|person; Telefon|phone; Mobilya / Ürün; Ölçü; Renk; Montaj|list:Yok,Var; Teslim Tarihi|date; Tutar|money; Kapora|money; Kalan|money; Durum|list:Üretimde,Hazır,Teslim edildi; Not"],
  "teknik-servis": ["Servis Fişi No|id; Müşteri|person; Telefon|phone; Cihaz; Marka / Model; IMEI / Seri No; Arıza; Garanti|list:Garantili,Garanti dışı; Geliş Tarihi|date; Onarım Ücreti|money; Durum|list:İncelemede,Onarımda,Hazır,Teslim edildi; Not"],
  cicekci: ["Sipariş No|id; Müşteri|person; Telefon|phone; Ürün|list:Buket,Aranjman,Saksı çiçeği,Çelenk; Çiçek; Not Kartı; Teslimat Adresi; Teslim Tarihi|date; Tutar|money; Durum|list:Hazırlanıyor,Yolda,Teslim edildi; Not"],
  yayinevi: ["ISBN|id; Kitap Adı; Yazar|person; Telefon|phone; Yayınevi; Baskı; Basım Tarihi|date; Sayfa Sayısı|number; Stok|number; Satış Fiyatı|money; Telif Oranı (%)|number; Durum|list:Hazırlıkta,Baskıda,Satışta; Not"],
  abonelik: ["Abone No|id; Abone|person; Telefon|phone; Abonelik Paketi; Başlangıç Tarihi|date; Bitiş Tarihi|date; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,İptal,Dondurdu; Not", { months: "year" }],
  "yapi-market": ["Ürün Adı; Nalbur / Hırdavat Grubu|list:Vida-civata,El aleti,Boya,Elektrik,Tesisat,Bahçe; Vida / Civata Ölçüsü; Birim|list:adet,kg,mt,paket; Miktar|number; Fiyat|money; Durum|list:Satışta,Tükendi; Not"],
  petshop: ["Ürün Adı; Mama / Ürün Grubu|list:Mama,Kum,Aksesuar,Oyuncak,Sağlık; Mama Markası; Pet Türü|list:Kedi,Köpek,Kuş,Balık,Diğer; Miktar|number; SKT|date; Fiyat|money; Durum|list:Satışta,Tükendi; Not"],
  // ----- Üretim ve sanayi -----
  uretim: ["İş Emri No|id; Ürün; Müşteri|person; Makine; Vardiya|list:Sabah,Akşam,Gece; Parti No; Üretim Miktarı|number; Fire|number; Üretim Tarihi|date; Termin|date; Durum|list:Planlandı,Üretimde,Tamamlandı; Not"],
  tekstil: ["Model No|id; Müşteri|person; Telefon|phone; Kumaş; Kesim Tarihi|date; Dikim|list:İç atölye,Fason; Fason Atölye; Adet|number; Birim Fiyat|money; Termin|date; Durum|list:Kesimde,Dikimde,Ütü-paket,Sevk edildi; Not"],
  "gida-uretim": ["Parti No|id; Ürün; Üretim Tarihi|date; TETT|date; HACCP Kontrolü|list:Uygun,Uygun değil; Miktar|number; Sorumlu|person; Müşteri; Durum|list:Üretimde,Sevk edildi; Not"],
  kalite: ["Uygunsuzluk No|id; Konu; Bölüm; Sorumlu|person; Tespit Tarihi|date; Kök Neden; Düzeltici Faaliyet (DÖF); İç Tetkik; Son Tarih|date; Durum|list:Açık,Faaliyet sürüyor,Kapandı; Not"],
  bakim: ["İş Emri No|id; Ekipman No; Makine; Arıza; Bakım Türü|list:Periyodik bakım,Arıza,Kalibrasyon; Teknisyen|person; Bakım Tarihi|date; Sonraki Bakım|date; Duruş Süresi (saat)|number; Maliyet|money; Durum|list:Açık,Tamamlandı; Not"],
  matbaa: ["İş No|id; Müşteri|person; Telefon|phone; İş Tanımı; Baskı Türü|list:Ofset,Dijital baskı; Kâğıt; Gramaj|number; Adet|number; Teslim Tarihi|date; Tutar|money; Durum|list:Tasarımda,Baskıda,Teslim edildi; Not"],
  "metal-makine": ["Sipariş No|id; Müşteri|person; Telefon|phone; Parça; Teknik Resim No; Malzeme; Tolerans; İşlem|list:CNC,Torna,Freze,Kaynak,Montaj; Adet|number; Termin|date; Tutar|money; Durum|list:Planlandı,İmalatta,Sevk edildi; Not"],
  // ----- Tedarik, depo ve dış ticaret -----
  depo: ["Stok Kodu|id; Ürün Adı; Depo; Lokasyon; Birim|list:adet,koli,palet,kg; Miktar|number; Minimum Stok|number; Son Sayım Tarihi|date; Birim Fiyat|money; Sorumlu|person; Durum|list:Stokta,Kritik,Tükendi; Not"],
  satinalma: ["Talep No|id; Talep Eden|person; Birim / Departman; Ürün / Hizmet; Miktar|number; Tedarikçi; Teklif Tutarı|money; Termin|date; Satınalma Tarihi|date; Durum|list:Teklif bekleniyor,Onaylandı,Teslim alındı; Not"],
  tedarikci: ["Tedarikçi|person; Telefon|phone; E-posta|email; Ürün Grubu; Vergi No; Değerlendirme Puanı|number; Ödeme Vadesi (gün)|number; Son Sipariş Tarihi|date; Borç Bakiye|money; Durum|list:Onaylı,Değerlendirmede,Pasif; Not"],
  "dis-ticaret": ["Dosya No|id; Müşteri / Firma|person; Telefon|phone; Ülke; GTİP; Teslim Şekli (Incoterms)|list:EXW,FOB,CIF,CFR,DAP,DDP; Konteyner No; Konşimento No; Yükleme Tarihi|date; Tutar|money; Döviz|list:USD,EUR,GBP,TRY; Durum|list:Hazırlık,Yolda,Gümrükte,Teslim edildi; Not"],
  gumruk: ["Beyanname No|id; Firma|person; Telefon|phone; Gümrük İdaresi; Rejim Kodu; Antrepo; Ordino; Beyan Tarihi|date; Kıymet Tutarı|money; Ücret|money; Durum|list:Hazırlanıyor,Muayenede,Kapandı; Not"],
  // ----- Turizm ve konaklama -----
  otel: ["Rezervasyon No|id; Misafir|person; Telefon|phone; Oda No; Oda Tipi|list:Tek kişilik,Çift kişilik,Aile,Suit; Check-in|date; Check-out|date; Pansiyon|list:Oda kahvaltı,Yarım pansiyon,Tam pansiyon,Her şey dahil; Konaklama Ücreti|money; Kapora|money; Acenta; Durum|list:Onaylı,Giriş yaptı,Çıkış yaptı,İptal; Not"],
  seyahat: ["Rezervasyon No|id; Yolcu|person; Telefon|phone; PNR; Uçuş / Bilet No; Hareket Tarihi|date; Dönüş Tarihi|date; Pasaport No; Vize|list:Gerekmiyor,Başvuruldu,Alındı; Tutar|money; Durum|list:Opsiyonlu,Satıldı,İptal; Not"],
  "tur-operatoru": ["Tur Kodu|id; Tur Adı; Güzergâh; Rehber|person; Telefon|phone; Tur Tarihi|date; Kontenjan|number; Satılan|number; Kişi Başı Fiyat|money; Durum|list:Satışta,Doldu,Tamamlandı; Not"],
  "villa-kiralama": ["Rezervasyon No|id; Misafir|person; Telefon|phone; Villa / Apart; Havuz|list:Özel havuz,Ortak havuz,Yok; Giriş Tarihi|date; Çıkış Tarihi|date; Gecelik / Haftalık|list:Gecelik,Haftalık,Aylık; Tutar|money; Kapora|money; Kalan|money; Durum|list:Onaylı,Konaklıyor,Çıkış yaptı,İptal; Not"],
  etkinlik: ["Etkinlik No|id; Organizasyon; Müşteri|person; Telefon|phone; Etkinlik Tarihi|date; Mekân; Davetli Sayısı|number; Catering|list:Yok,Var; Sahne / Ses|list:Yok,Var; Toplam Ücret|money; Kapora|money; Durum|list:Planlanıyor,Onaylı,Tamamlandı; Not"],
  "dugun-salonu": ["Rezervasyon No|id; Müşteri|person; Telefon|phone; Düğün / Nişan / Kına|list:Düğün,Nişan,Kına,Söz,Sünnet; Tarih|date; Salon; Davetli Sayısı|number; Menü; Toplam Ücret|money; Kapora|money; Kalan|money; Durum|list:Opsiyonlu,Kesin,Tamamlandı; Not"],
  // ----- Yeme-içme -----
  restoran: ["Adisyon No|id; Masa No; Garson|person; Tarih|date; Menü / Ürün; Porsiyon|number; Tutar|money; Ödeme|list:Nakit,Kredi kartı,Yemek kartı; Durum|list:Açık,Kapandı; Not"],
  catering: ["Sipariş No|id; Firma|person; Telefon|phone; Öğün|list:Kahvaltı,Öğle,Akşam,Ara öğün; Tabldot / Menü; Kişi Sayısı|number; Teslim Tarihi|date; Kişi Başı Ücret|money; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not"],
  pastane: ["Sipariş No|id; Müşteri|person; Telefon|phone; Ürün|list:Yaş pasta,Kuru pasta,Ekmek,Tatlı,Börek; Kişilik|number; Pasta Yazısı; Teslim Tarihi|date; Tutar|money; Kapora|money; Durum|list:Hazırlanıyor,Hazır,Teslim edildi; Not"],
  // ----- Güzellik ve kişisel bakım -----
  kuafor: ["Müşteri|person; Telefon|phone; Randevu Tarihi|date; Randevu Saati; Kuaför / Berber; Hizmet|list:Saç kesimi,Fön,Boya,Manikür,Pedikür,Sakal; Koltuk; Ücret|money; Durum|list:Bekleniyor,Geldi,İptal; Not"],
  "guzellik-merkezi": ["Danışan|person; Telefon|phone; Lazer Epilasyon / Cilt Bakımı|list:Lazer epilasyon,Cilt bakımı,Bölgesel incelme,Kalıcı makyaj; Bölge; Kalan Seans|number; Randevu Tarihi|date; Paket Ücreti|money; Ödenen|money; Durum|list:Devam ediyor,Tamamlandı; Not"],
  spa: ["Randevu No|id; Misafir|person; Telefon|phone; Uygulama|list:Masaj,Hamam,Kese-köpük,Cilt bakımı; Terapist; Kabin; Randevu Tarihi|date; Süre (dk)|number; Ücret|money; Durum|list:Bekleniyor,Geldi,İptal; Not"],
  dovme: ["Müşteri|person; Telefon|phone; Dövme / Piercing|list:Dövme,Piercing; Bölge; Sanatçı; Seans Tarihi|date; Seans|number; Ücret|money; Kapora|money; Durum|list:Bekleniyor,Tamamlandı,İptal; Not"],
  // ----- Spor ve sağlıklı yaşam -----
  "spor-salonu": ["Üye No|id; Üye|person; Telefon|phone; Üyelik Başlangıç|date; Üyelik Bitiş|date; Paket|list:Aylık,3 aylık,6 aylık,Yıllık,PT; Antrenör; Turnike Kart No; Dondurma|list:Yok,Dondurdu; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not", { months: "year" }],
  "spor-kulubu": ["Sporcu|person; Veli; Telefon|phone; Branş|list:Futbol,Basketbol,Voleybol,Yüzme,Tenis,Diğer; Yaş Grubu|list:U9,U11,U13,U15,U17,Yetişkin; Lisans No; Antrenman Günleri; Aylık Aidat|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not", { months: "year" }],
  "pilates-yoga": ["Üye|person; Telefon|phone; Pilates / Yoga Dersi|list:Reformer pilates,Mat pilates,Yoga,Grup dersi; Ders Paketi|list:4 ders,8 ders,12 ders,Sınırsız; Kalan Ders|number; Paket Başlangıç|date; Paket Bitiş|date; Paket Ücreti|money; Durum|list:Aktif,Bitti; Not"],
  // ----- İnsan kaynakları ve hizmet -----
  "ik-personel": ["Sicil No|id; Çalışan|person; Telefon|phone; T.C. Kimlik No; Departman; Pozisyon; İşe Giriş|date; İşten Çıkış|date; SGK No; Yıllık İzin (gün)|number; Kıdem (yıl)|number; Maaş|money; Durum|list:Çalışıyor,Ayrıldı; Not"],
  "ik-ise-alim": ["Aday|person; Telefon|phone; E-posta|email; Pozisyon; Deneyim (yıl)|number; CV / Özgeçmiş; Mülakat Tarihi|date; Maaş Beklentisi|money; Değerlendirme|list:Olumlu,Olumsuz,Yedek; Durum|list:Başvurdu,Mülakatta,Teklif verildi,İşe alındı,Reddedildi; Not"],
  "ik-bordro": ["Sicil No|id; Çalışan|person; Departman; Puantaj (gün)|number; Fazla Mesai (saat)|number; Brüt Ücret|money; SGK Primi|money; Gelir Vergisi|money; Damga Vergisi|money; Net Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Ayrıldı; Not"],
  "guvenlik-hizmet": ["Ad Soyad|person; Telefon|phone; Güvenlik Görevlisi Kimlik Kartı No (ÖGG); Kart Geçerlilik|date; Silahlı / Silahsız|list:Silahlı,Silahsız; Görev Yeri; Vardiya|list:Gündüz,Gece,24 saat; Devriye Bölgesi; Maaş|money; Durum|list:Aktif,İzinde,Ayrıldı; Not"],
  temizlik: ["İş No|id; Müşteri|person; Telefon|phone; Adres; Temizlik Türü|list:Ev,Ofis,İnşaat sonrası,Merdiven,Dış cephe; Periyot|list:Tek sefer,Haftalık,Aylık; Hizmet Tarihi|date; Ekip; Ücret|money; Durum|list:Planlandı,Yapıldı,İptal; Not"],
  "kuru-temizleme": ["Fiş No|id; Müşteri|person; Telefon|phone; Ürün|list:Takım elbise,Gömlek,Mont,Perde,Halı,Gelinlik; Kuru Temizleme / Ütü / Terzi|list:Kuru temizleme,Ütü,Terzi tadilatı,Yıkama; Adet|number; Teslim Alma|date; Teslim Tarihi|date; Ücret|money; Durum|list:İşlemde,Hazır,Teslim edildi; Not"],
  // ----- Satış, pazarlama ve müşteri ilişkileri -----
  crm: ["Müşteri|person; Telefon|phone; E-posta|email; Firma; Fırsat; Lead Kaynağı|list:Web,Telefon,Referans,Fuar,Sosyal medya; Pipeline Aşaması|list:Potansiyel,Görüşme,Teklif,Pazarlık,Kazanıldı,Kaybedildi; Satış Temsilcisi; Son Görüşme|date; Sonraki Adım Tarihi|date; Tahmini Tutar|money; Durum|list:Açık,Kazanıldı,Kaybedildi; Not"],
  "cagri-merkezi": ["Talep No|id; Müşteri|person; Telefon|phone; Çağrı Türü|list:Şikâyet,Bilgi,Arıza,Öneri,İade; Konu; Ticket Açılış|date; SLA Bitiş|date; Temsilci; Çözüm; Durum|list:Açık,İşlemde,Çözüldü; Not"],
  ajans: ["Proje No|id; Müşteri|person; Telefon|phone; Kampanya; Kanal|list:Google reklam,Meta,Sosyal medya,YouTube,E-posta; Gösterim|number; Tıklama|number; CTR (%)|number; Dönüşüm|number; Reklam Bütçesi Tutarı|money; Aylık Ücret|money; Durum|list:Aktif,Durduruldu,Bitti; Not"],
  bayi: ["Bayi Kodu|id; Bayi|person; Telefon|phone; Bölge; Hedef Ciro|money; Gerçekleşen Ciro|money; Cari Bakiye|money; Son Sipariş Tarihi|date; Sözleşme Bitiş|date; Durum|list:Aktif,Pasif; Not"],
  "saha-satis": ["Ziyaret No|id; Müşteri|person; Telefon|phone; Müşteri Kodu; Rota; Ziyaret Tarihi|date; Temsilci; Sipariş Tutarı|money; Sonraki Ziyaret|date; Durum|list:Planlandı,Yapıldı,İptal; Not"],
  anket: ["Yanıt No|id; Katılımcı|person; Telefon|phone; Anket Adı; Soru; Yanıt; Memnuniyet (1-5)|number; NPS (0-10)|number; Tarih|date; Durum|list:Tamamlandı,Yarım; Not"],
  // ----- Teknoloji ve bilişim -----
  "yazilim-proje": ["Issue No|id; Başlık; Tür|list:Story,Bug,Task,Epic; Sprint; Story Point|number; Atanan|person; Öncelik|list:Düşük,Normal,Yüksek,Acil; Release / Versiyon; Son Tarih|date; Durum|list:Yapılacak,Devam ediyor,Testte,Bitti; Not"],
  "bt-destek": ["Ticket No|id; Talep Eden (Ad Soyad)|person; Telefon|phone; Birim; Envanter No; Bilgisayar / Cihaz; IP Adresi; Lisans; Açılış Tarihi|date; Durum|list:Açık,İşlemde,Çözüldü; Not"],
  telekom: ["Abone|person; Telefon|phone; GSM No; Tarife; İşlem|list:Yeni hat,Numara taşıma,Faturalıya geçiş,Cihaz satışı; IMEI; Taahhüt Bitiş|date; Aylık Ücret|money; Durum|list:Aktif,İptal; Not"],
  hosting: ["Müşteri|person; Telefon|phone; Alan Adı (Domain); Hosting Paketi; Sunucu; SSL|list:Yok,Var; Başlangıç Tarihi|date; Yenileme Tarihi|date; Yıllık Ücret|money; Durum|list:Aktif,Askıda,İptal; Not"],
  "guvenlik-sistem": ["Proje No|id; Müşteri|person; Telefon|phone; Adres; Keşif Tarihi|date; Kamera Sayısı|number; Kayıt Cihazı|list:NVR,DVR; Alarm|list:Yok,Var; Kurulum Tarihi|date; Tutar|money; Bakım Tarihi|date; Durum|list:Keşif,Kurulumda,Tamamlandı; Not"],
  // ----- Kamu, dernek ve STK -----
  dernek: ["Üye No|id; Üye|person; Telefon|phone; Üyelik Tarihi|date; Üye Türü|list:Asil üye,Onursal üye,Gönüllü,Bağışçı; Dernek / Vakıf Şubesi; Bağış Tutarı|money; Aidat|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not", { months: "year" }],
  evrak: ["Evrak No|id; Gelen / Giden Evrak|list:Gelen evrak,Giden evrak; Tarih|date; Kurum|person; Konu; İlgili Birim; Havale Edilen; EBYS No; Cevap Son Tarihi|date; Durum|list:Açık,Cevaplandı,Arşivlendi; Not"],
  belediye: ["Başvuru No|id; Vatandaş|person; Telefon|phone; Mahalle / Muhtarlık; Dilekçe Konusu; Başvuru Tarihi|date; İlgili Birim; Son Tarih|date; Durum|list:Alındı,İşlemde,Sonuçlandı; Not"],
  "sosyal-yardim": ["Hane No|id; Hane Reisi|person; Telefon|phone; Adres; Hane Nüfusu|number; İhtiyaç|list:Gıda (kumanya),Yakacak,Nakdi,Eşya,Eğitim; Son Yardım Tarihi|date; Yardım Tutarı|money; Durum|list:Değerlendirmede,Onaylandı,Reddedildi; Not"],
  // ----- Tarım ve hayvancılık -----
  tarim: ["Parsel No|id; Tarla / Yer; Çiftçi|person; Telefon|phone; Alan (dekar)|number; Ürün; Ekim Tarihi|date; Gübreleme Tarihi|date; İlaçlama Tarihi|date; Hasat Tarihi|date; Verim (kg)|number; Gelir|money; Durum|list:Ekili,Hasat edildi,Nadas; Not"],
  hayvancilik: ["Küpe No|id; Tür / Irk; Cinsiyet|list:Dişi,Erkek; Doğum Tarihi|date; Tohumlama Tarihi|date; Gebelik|list:Yok,Gebe; Buzağılama Tarihi|date; Sağım (lt/gün)|number; TÜRKVET Kaydı|list:Var,Yok; Sorumlu|person; Durum|list:Sürüde,Satıldı,Kesildi; Not"],
  "tarim-kooperatif": ["Ortaklık No|id; Ortak|person; Telefon|phone; Köy / Mahalle; Ürün; Teslim Miktarı (kg)|number; Teslim Tarihi|date; Birim Fiyat|money; Hak Ediş Tutarı|money; Kooperatif Aidatı|money; Durum|list:Aktif,Pasif; Not"],
  sera: ["Parti No|id; Sera No; Fide / Fidan; Çeşit; Ekim Tarihi|date; Adet|number; Sorumlu|person; Satış Tarihi|date; Birim Fiyat|money; Durum|list:Sera içinde,Satıldı; Not"],
  // ----- Enerji ve çevre -----
  ges: ["Proje No|id; Müşteri|person; Telefon|phone; GES Adresi; Kurulu Güç (kWp)|number; Panel Sayısı|number; İnverter; Yıllık Üretim (kWh)|number; Mahsuplaşma|list:Aylık,Saatlik; Kurulum Tarihi|date; Proje Bedeli|money; Durum|list:Projede,Kurulumda,Devrede; Not"],
  elektrik: ["İş No|id; Müşteri|person; Telefon|phone; Adres; Pano / Kablo / Trafo İşi|list:Pano,Kablo çekimi,Trafo,Sayaç,Aydınlatma; Keşif Tarihi|date; Teslim Tarihi|date; Tutar|money; Durum|list:Keşif,Devam ediyor,Tamamlandı; Not"],
  dogalgaz: ["İş No|id; Müşteri|person; Telefon|phone; Adres; Doğalgaz İşi|list:Kombi montajı,Doğalgaz projesi,Radyatör,Tesisat; Proje Onay Tarihi|date; Gaz Açma Tarihi|date; Tutar|money; Durum|list:Projede,Montajda,Gaz açıldı; Not"],
  akaryakit: ["Fiş No|id; Müşteri / Plaka|person; Yakıt|list:Benzin,Motorin,LPG; Pompa No; Litre|number; Birim Fiyat|money; Tutar|money; Vardiya|list:Sabah,Akşam,Gece; Tarih|date; Ödeme|list:Nakit,Kart,Veresiye; Not"],
  atik: ["Sevkiyat No|id; Firma|person; Telefon|phone; Atık Kodu; Miktar (kg)|number; Bertaraf / Geri Dönüşüm|list:Bertaraf,Geri dönüşüm; UATF No; MoTAT No; Sevk Tarihi|date; Ücret|money; Durum|list:Planlandı,Taşındı,Belgelendi; Not"],
  "cevre-danismanlik": ["Firma|person; Telefon|phone; Çevre İzni / Emisyon / ÇED|list:Çevre izni,Emisyon ölçümü,ÇED,Atık yönetimi; Başvuru Tarihi|date; Çevre İzni Bitiş Tarihi|date; Danışmanlık Ücreti|money; Ödeme Günü|day; Durum|list:Devam ediyor,Tamamlandı; Not"],
  // ----- Danışmanlık ve profesyonel hizmetler -----
  "yonetim-danismanligi": ["Proje No|id; Müşteri|person; Telefon|phone; Proje Adı; Faz|list:Analiz,Tasarım,Uygulama,Kapanış; Adam-Gün|number; Çıktı; Başlangıç Tarihi|date; Teslim Tarihi|date; Proje Bedeli|money; Durum|list:Devam ediyor,Tamamlandı; Not"],
  isg: ["İşyeri|person; Telefon|phone; SGK Sicil No; Tehlike Sınıfı|list:Az tehlikeli,Tehlikeli,Çok tehlikeli; Çalışan Sayısı|number; İSG Uzmanı; İşyeri Hekimi; Risk Değerlendirmesi Tarihi|date; Periyodik Kontrol Tarihi|date; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not"],
  tercume: ["İş No|id; Müşteri|person; Telefon|phone; Kaynak Dil; Hedef Dil; Belge Türü; Tercüman; Yeminli|list:Evet,Hayır; Noter Onayı|list:Yok,Var; Apostil|list:Yok,Var; Teslim Tarihi|date; Ücret|money; Durum|list:Çeviride,Noterde,Teslim edildi; Not"],
  vize: ["Başvuru No|id; Başvuru Sahibi|person; Telefon|phone; Ülke; Vize Türü|list:Turistik,Ticari,Öğrenci,Çalışma; Konsolosluk; Randevu Tarihi|date; Pasaport No; Ücret|money; Durum|list:Evrak bekleniyor,Başvuruldu,Onaylandı,Reddedildi; Not"],
  "yurtdisi-egitim": ["Öğrenci|person; Telefon|phone; Ülke; Okul / Üniversite; Program; Dil Sınavı|list:IELTS,TOEFL,Duolingo,Yok; Burs|list:Yok,Kısmi,Tam; Başvuru Tarihi|date; Başlangıç Tarihi|date; Danışmanlık Ücreti|money; Durum|list:Başvuruda,Kabul aldı,Vizede,Başladı; Not"],
  fotograf: ["Çekim No|id; Müşteri|person; Telefon|phone; Çekim Türü|list:Düğün,Dış çekim,Stüdyo,Ürün,Etkinlik; Çekim Tarihi|date; Yer; Albüm|list:Yok,Var; Teslim Tarihi|date; Ücret|money; Kapora|money; Durum|list:Planlandı,Çekildi,Teslim edildi; Not"],
  // ----- Genel -----
  genel: ["Kayıt No|id; Ad Soyad / Firma|person; Telefon|phone; E-posta|email; Konu; Kayıt Tarihi|date; Tutar|money; Ödeme Günü|day; Durum|list:Açık,Beklemede,Kapandı; Not"],
  "genel-musteri": ["Müşteri|person; Telefon|phone; E-posta|email; Firma; Adres; Şehir; Kayıt Tarihi|date; Bakiye|money; Durum|list:Aktif,Pasif; Not"],
  "genel-envanter": ["Envanter No|id; Demirbaş; Kategori; Seri No; Zimmetli Kişi|person; Yer; Alış Tarihi|date; Garanti Bitiş|date; Alış Bedeli|money; Durum|list:Kullanımda,Arızalı,Depoda,Hurda; Not"],
  "genel-randevu": ["Ad Soyad|person; Telefon|phone; Randevu Tarihi|date; Randevu Saati; Konu; Görüşecek Kişi; Ücret|money; Durum|list:Bekleniyor,Geldi,İptal; Not"],
  "genel-uyelik": ["Üye No|id; Üye|person; Telefon|phone; E-posta|email; Başlangıç Tarihi|date; Bitiş Tarihi|date; Aylık Ücret|money; Ödeme Günü|day; Durum|list:Aktif,Pasif; Not", { months: "year" }],
  "genel-gorev": ["Görev; Sorumlu|person; Telefon|phone; Başlangıç|date; Son Tarih|date; Öncelik|list:Düşük,Normal,Yüksek,Acil; Durum|list:Yapılacak,Devam ediyor,Bitti; Not"],
};

// Başlığa tıklanınca Excel'in gösterdiği yardım notu (en çok 255 karakter).
const PROMPTS = {
  id: "Kayda verdiğiniz numara (ör. 2026/15). Başındaki sıfırlar korunur.",
  person: "Kişi ya da firmanın adı (ör. Ayşe Yılmaz). Her satır bir kayıttır; aynı kişi bir kez yazılır.",
  phone: "Telefon (ör. 0532 111 22 33). Başındaki 0 korunur; WhatsApp ve arama düğmeleri bu numarayı kullanır.",
  email: "E-posta adresi (ör. ad@ornek.com).",
  date: "Tarih: gün.ay.yıl (ör. 15.10.2026). Program yaklaşan ve geçen tarihleri takvimde gösterir.",
  day: "Her ay ödemenin yapıldığı gün: 1–31 arası sayı (ör. 5). Program o gün tahsilatı hatırlatır.",
  money: "Tutar: yalnız sayı (ör. 1500 ya da 1.500,00). ₺ yazmanıza gerek yok.",
  number: "Sayı (ör. 12).",
  list: "Listeden seçin. Listede yoksa yazabilirsiniz.",
  month: "Bu ay ödendiyse ödenen tutarı ya da “Ödendi” yazın; ödenmediyse boş bırakın. Program ödenmeyen ayı hatırlatır.",
  text: "",
};

function parseSpec(spec) {
  return spec
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [label, type = "text"] = part.split("|").map(item => item.trim());
      if (type.startsWith("list:")) return { label, kind: "list", options: type.slice(5).split(",").map(item => item.trim()).filter(Boolean) };
      return { label, kind: type };
    });
}

// İçinde bulunulan eğitim yılı (Eylül'den itibaren yeni yıl) ya da takvim yılı; başlıkta yılla (takvim yılı çıkarımı
// gerekmez: "Eylül 2026").
export function monthHeaders(kind, now = new Date()) {
  const year = now.getFullYear();
  if (kind === "school") {
    const start = now.getMonth() >= 7 ? year : year - 1; // Ağustos ve sonrası: yeni eğitim yılına hazırlık
    return [8, 9, 10, 11, 0, 1, 2, 3, 4, 5].map(month => `${MONTHS[month]} ${month >= 8 ? start : start + 1}`);
  }
  return MONTHS.map(month => `${month} ${year}`);
}

// Özel sektör (Kendi sektörünüz, v2.0.2): ofisin tanıttığı başlıklar + ad, telefon, durum, not.
function customColumns(sector) {
  const own = (sector.keys || []).slice(1).filter(Boolean).slice(0, 12).map(label => ({ label, kind: "text" }));
  return [{ label: sector.vocab?.Record || "Ad Soyad", kind: "person" }, { label: "Telefon", kind: "phone" }, ...own, { label: "Tutar", kind: "money" }, { label: "Ödeme Günü", kind: "day" }, { label: "Durum", kind: "list", options: ["Aktif", "Pasif"] }, { label: "Not", kind: "text" }];
}

/**
 * Sektörün taslak tanımı: kolonlar (başlık, tür, seçenekler, yardım notu), sayfa ve dosya adı.
 * @param {string} id  sektör kimliği
 * @param {{ now?: Date, custom?: object|null }} options  custom: özel sektör (customSector biçiminde)
 */
export function sectorTemplate(id, { now = new Date(), custom = null } = {}) {
  const sector = custom || sectorById(id);
  if (!sector) return null;
  const entry = T[sector.id];
  const columns = entry ? parseSpec(entry[0]) : customColumns(sector);
  const months = entry?.[1]?.months || "";
  if (months) {
    // Ay kolonları tutar kolonlarından sonra, "Durum"dan önce: satır okunurken ücret ve aylar yan yana.
    const at = columns.findIndex(column => column.label === "Durum");
    const list = monthHeaders(months, now).map(label => ({ label, kind: "month" }));
    columns.splice(at >= 0 ? at : columns.length, 0, ...list);
  }
  for (const column of columns) column.prompt = PROMPTS[column.kind] ?? "";
  const sheet = String(sector.vocab?.Records || "Kayıtlar").slice(0, 31);
  const safe = String(sector.name).replace(/[\\/:*?"<>|()]+/g, " ").replace(/\s+/g, " ").trim();
  return { sector: { id: sector.id, name: sector.name, records: sector.vocab?.records || "kayıtlar" }, sheet, columns, months, fileName: `DestekOfis taslak - ${safe}.xlsx` };
}

export const templateIds = () => Object.keys(T);

// ---------- Excel dosyası ----------
const FORMATS = { date: "dd.mm.yyyy", money: "#,##0.00", phone: "@", id: "@", day: "0" };
const WIDTHS = { person: 26, phone: 17, email: 26, date: 14, money: 15, day: 12, number: 12, id: 14, month: 14, list: 18, text: 20 };

/** Taslağın .xlsx sayfası (buildXlsx girdisi): başlık satırı, kolon biçimleri, açılır listeler ve yardım notları. */
export function templateSheet(template) {
  const formats = {};
  const widths = {};
  const validations = [];
  template.columns.forEach((column, index) => {
    if (FORMATS[column.kind]) formats[index] = FORMATS[column.kind];
    widths[index] = Math.min(46, Math.max(WIDTHS[column.kind] || 16, column.label.length + 4, column.label === "Not" ? 30 : 0));
    const title = column.label;
    if (column.kind === "list") validations.push({ column: index, type: "list", options: column.options, title, prompt: column.prompt, rows: TEMPLATE_ROWS });
    else if (column.kind === "day") validations.push({ column: index, type: "whole", min: 1, max: 31, error: "Ödeme günü 1 ile 31 arasında bir sayı olmalı (ör. 5).", title, prompt: column.prompt, rows: TEMPLATE_ROWS });
    else if (column.prompt) validations.push({ column: index, type: "none", title, prompt: column.prompt, rows: TEMPLATE_ROWS });
  });
  return { name: template.sheet, columns: template.columns.map(column => column.label), rows: [], formats, widths, validations };
}
