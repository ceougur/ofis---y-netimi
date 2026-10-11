// Sektör önerisi için örnek tablolar: gerçek hayattaki Türkçe kolon başlıkları ve başlığa uygun üretilmiş değerler.
// "expect": beklenen öneri; "level": en az bu güven ("high" ⊃ "medium"). Genel veride öneri "genel" (düşük güven)
// olmalıdır: emin olunamayan hiçbir veriye sektör biçilmez.

const NAMES = ["Ayşe Kaya", "Mehmet Öztürk", "Zeynep Çelik", "Can Demir", "Elif Şahin", "Burak Koç", "Selin Aydın", "Hakan Yıldız", "Deniz Arslan", "Ece Polat", "Murat Aksoy", "Gamze Kurt"];
const STAFF = ["Av. Ali Veli", "Av. Seda Tan", "Av. Kerem Öz"];
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Konya"];

// Başlığa göre deterministik örnek değer (i: satır sırası).
export function sampleValue(header, i) {
  const h = header.toLocaleLowerCase("tr-TR");
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const date = offset => {
    const d = new Date(Date.UTC(2026, 8, 1) + (offset % 120) * 86_400_000);
    return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  };
  if (/tarih|vade|bitiş|başlangıç|randevu|duruşma|teslim|giriş|çıkış|son gün/.test(h)) return date(i * 7);
  if (/telefon|gsm|cep/.test(h)) return `05${pad(30 + (i % 9))} ${pad(100 + i, 3)} ${pad(i % 100)} ${pad((i * 7) % 100)}`;
  if (/e-posta|eposta|mail/.test(h)) return `kisi${i}@ornek.com`;
  if (/plaka/.test(h)) return `${pad(1 + (i % 81))} ${["AB", "KL", "M", "TR"][i % 4]} ${100 + i}`;
  if (/tutar|bedel|fiyat|ücret|borç|bakiye|prim|aidat|maaş|brüt|kira|avans|tahsilat|toplam|gider|ciro|kapora|depozito/.test(h)) return `${(1000 + i * 137).toLocaleString("tr-TR")},00 TL`;
  if (/adet|miktar|stok|sayı|km|kilo|m2|metrekare|seans|gece|yaş|puan|net/.test(h)) return String(5 + ((i * 13) % 90));
  if (/dosya no|esas/.test(h)) return `2025/${1000 + i}`;
  if (/no$|no\b|kod|numara|sicil|barkod|sku|isbn/.test(h)) return `${header.slice(0, 2).toUpperCase()}-${10_000 + i}`;
  if (/durum|aşama|statü|sonuç/.test(h)) return ["Aktif", "Beklemede", "Tamamlandı"][i % 3];
  if (/sorumlu|avukat|danışman|hekim|doktor|temsilci|öğretmen|eğitmen|uzman|eksper|teknisyen/.test(h)) return STAFF[i % 3];
  if (/şehir|^il$/.test(h)) return CITIES[i % CITIES.length];
  if (/tür|tip|kategori|grup|sınıf|branş|departman|bölüm|model|marka|renk|beden|yakıt|vites/.test(h)) return ["A", "B", "C"][i % 3] + " " + header.split(" ")[0];
  if (/açıklama|not|yorum|şikayet|talep/.test(h)) return `Görüşme yapıldı, ${i}. kayıt için bilgi verildi ve süreç takip ediliyor.`;
  if (/ad|soyad|müşteri|hasta|öğrenci|borçlu|alacaklı|müvekkil|kiracı|malik|üye|aday|çalışan|sigortalı|danışan|kursiyer|misafir|yolcu|bağışçı|mükellef|firma|sporcu|veli/.test(h)) return NAMES[i % NAMES.length];
  return `${header} ${i + 1}`;
}

export const CORPUS = [
  // --- Hukuk ---
  { name: "icra takip listesi", expect: "hukuk-icra", level: "high", label: "İcra Takip.xlsx", headers: ["DOSYA NO", "BORÇLU", "ALACAKLI", "İCRA DAİRESİ", "TAKİP TARİHİ", "TUTAR", "HACİZ TARİHİ", "DOSYANIN SON DURUMU"] },
  { name: "icra (kullanıcının sayfası gibi)", expect: "hukuk-icra", level: "high", headers: ["DOSYA NO", "BORÇLU", "ALACAKLI", "İCRA", "TELEFON", "ÖDEME SÖZÜ", "SON DURUM"] },
  { name: "dava takip", expect: "hukuk-dava", level: "high", headers: ["Esas No", "Mahkeme", "Davacı", "Davalı", "Dava Türü", "Duruşma Tarihi", "Sorumlu Avukat"] },
  { name: "genel hukuk bürosu", expect: "hukuk-buro", level: "medium", headers: ["Müvekkil", "Dosya No", "Konu", "Avukat", "Vekalet Tarihi", "Telefon"] },
  { name: "arabuluculuk", expect: "hukuk-arabuluculuk", level: "medium", headers: ["Başvuru No", "Başvurucu", "Karşı Taraf", "Uyuşmazlık Türü", "Arabulucu", "Toplantı Tarihi", "Son Tutanak"] },
  { name: "marka tescil", expect: "hukuk-marka-patent", level: "medium", headers: ["Marka Adı", "Başvuru No", "Nice Sınıfı", "Tescil No", "Bülten Tarihi", "İtiraz Durumu", "Müvekkil"] },
  // --- Finans ---
  { name: "mali müşavir mükellef listesi", expect: "finans-muhasebe", level: "high", headers: ["Mükellef", "Vergi No", "Vergi Dairesi", "KDV Beyan Dönemi", "Muhtasar", "E-Defter", "Aylık Ücret"] },
  { name: "cari hesap ekstresi", expect: "finans-cari", level: "medium", headers: ["Cari Kod", "Cari Unvan", "Fatura No", "Borç Bakiye", "Alacak Bakiye", "Vade Tarihi"] },
  { name: "tahsilat / yaşlandırma", expect: "finans-tahsilat", level: "medium", headers: ["Müşteri", "Taksit No", "Vade Tarihi", "Gecikme Günü", "Kalan Borç", "Ödeme Planı"] },
  { name: "kuyumcu", expect: "finans-kuyum-doviz", level: "medium", headers: ["Ürün", "Gram", "Ayar", "Milyem", "Has", "İşçilik", "Tarih"] },
  // --- Sigorta ---
  { name: "sigorta acentesi poliçeleri", expect: "sigorta-acente", level: "high", headers: ["Poliçe No", "Sigortalı", "Branş", "Sigorta Şirketi", "Prim", "Başlangıç Tarihi", "Bitiş Tarihi", "Plaka"] },
  { name: "hasar dosyaları", expect: "sigorta-hasar", level: "high", headers: ["Hasar No", "Poliçe No", "Sigortalı", "Kaza Tarihi", "Eksper", "Tazminat Tutarı", "Rücu Durumu"] },
  // --- Sağlık ---
  { name: "poliklinik hastaları", expect: "saglik-klinik", level: "high", label: "hasta listesi.xlsx", headers: ["Hasta No", "Ad Soyad", "Telefon", "Muayene Tarihi", "Tanı", "Hekim", "Reçete"] },
  { name: "diş kliniği", expect: "saglik-dis", level: "high", headers: ["Hasta", "Diş No", "İşlem", "İmplant", "Diş Hekimi", "Randevu Tarihi", "Ücret"] },
  { name: "veteriner", expect: "saglik-veteriner", level: "high", headers: ["Hayvan Adı", "Tür", "Irk", "Sahibi", "Mikroçip No", "Kuduz Aşısı", "Telefon"] },
  { name: "diyetisyen", expect: "saglik-diyet", level: "high", headers: ["Danışan", "Boy", "Kilo", "Hedef Kilo", "VKİ", "Bel Çevresi", "Ölçüm Tarihi"] },
  { name: "eczane", expect: "saglik-eczane", level: "medium", headers: ["İlaç Adı", "Barkod", "Etken Madde", "Miat", "Stok", "Satış Fiyatı"] },
  { name: "optik", expect: "saglik-optik", level: "medium", headers: ["Müşteri", "Sağ Göz SPH", "Sol Göz SPH", "CYL", "AKS", "Çerçeve", "Cam"] },
  // --- Eğitim ---
  { name: "okul öğrenci listesi", expect: "egitim-okul", level: "high", headers: ["Öğrenci No", "Ad Soyad", "Sınıf", "Şube", "Veli", "Veli Telefon", "Devamsızlık"] },
  { name: "dershane", expect: "egitim-kurs", level: "high", headers: ["Öğrenci", "Veli", "Kurs", "TYT Net", "AYT Net", "Deneme Sınavı", "Kayıt Ücreti", "Taksit"] },
  { name: "sürücü kursu", expect: "egitim-surucu", level: "high", headers: ["Kursiyer", "Ehliyet Sınıfı", "E-Sınav Tarihi", "Direksiyon Tarihi", "Sınav Hakkı", "Ödeme"] },
  // --- Gayrimenkul ---
  { name: "emlak portföyü", expect: "emlak-ofisi", level: "high", headers: ["İlan No", "Satılık/Kiralık", "İlçe", "Oda Sayısı", "Metrekare", "Bina Yaşı", "Fiyat", "Emlak Danışmanı"] },
  { name: "site aidat", expect: "site-yonetimi", level: "high", headers: ["Blok", "Daire No", "Kat Maliki", "Kiracı", "Aidat", "Yakıt", "Borç"] },
  { name: "şantiye hakediş", expect: "insaat-proje", level: "high", headers: ["Poz No", "İş Kalemi", "Birim", "Metraj", "Birim Fiyat", "Taşeron", "Hakediş No"] },
  { name: "kira takibi", expect: "mulk-kira", level: "medium", headers: ["Mülk", "Kiracı", "Kira Bedeli", "Depozito", "Kira Başlangıç", "Kira Artışı", "Telefon"] },
  // --- Otomotiv ---
  { name: "galeri stok", expect: "oto-galeri", level: "high", headers: ["Plaka", "Marka", "Model", "Model Yılı", "Kilometre", "Yakıt", "Vites", "Satış Fiyatı"] },
  { name: "oto servis iş emirleri", expect: "oto-servis", level: "high", headers: ["İş Emri", "Plaka", "Müşteri", "KM", "Arıza", "Parça", "İşçilik", "Servis Tarihi"] },
  { name: "nakliye sevkiyat", expect: "lojistik", level: "high", headers: ["Sevkiyat No", "İrsaliye No", "Çıkış Yeri", "Varış", "Tonaj", "Şoför", "Plaka", "Navlun"] },
  { name: "kargo gönderileri", expect: "kargo", level: "high", headers: ["Gönderi No", "Gönderici", "Alıcı", "Kargo Takip", "Desi", "Teslimat Tarihi", "Şube"] },
  // --- Perakende ---
  { name: "e-ticaret siparişleri", expect: "eticaret", level: "high", headers: ["Sipariş No", "Sipariş Tarihi", "Müşteri", "Ürün Adı", "Adet", "Tutar", "Pazaryeri", "Kargo Takip"] },
  { name: "butik stok", expect: "giyim", level: "medium", headers: ["Model Kodu", "Ürün", "Beden", "Renk", "Sezon", "Stok", "Satış Fiyatı"] },
  { name: "teknik servis", expect: "teknik-servis", level: "high", headers: ["Servis Fişi", "Müşteri", "Cihaz", "IMEI", "Arıza", "Garanti", "Teslim Tarihi"] },
  { name: "yayınevi", expect: "yayinevi", level: "high", headers: ["ISBN", "Kitap Adı", "Yazar", "Baskı", "Sayfa Sayısı", "Telif", "Fiyat"] },
  // --- Üretim / tedarik ---
  { name: "üretim iş emirleri", expect: "uretim", level: "high", headers: ["İş Emri", "Ürün", "Hat", "Vardiya", "Makine", "Parti No", "Fire", "Operatör"] },
  { name: "kalite DÖF", expect: "kalite", level: "high", headers: ["DÖF No", "Uygunsuzluk", "Kök Neden", "Düzeltici Faaliyet", "Sorumlu", "Termin", "Durum"] },
  { name: "depo stok", expect: "depo", level: "high", headers: ["Stok Kodu", "Ürün", "Depo", "Raf", "Lokasyon", "Miktar", "Birim", "Minimum Stok"] },
  { name: "ihracat dosyaları", expect: "dis-ticaret", level: "high", headers: ["Dosya No", "Alıcı Firma", "Ülke", "GTİP", "Teslim Şekli (Incoterms)", "FOB Değer", "Konteyner No"] },
  // --- Turizm / yeme-içme ---
  { name: "otel rezervasyonları", expect: "otel", level: "high", headers: ["Rezervasyon No", "Misafir", "Oda Tipi", "Giriş Tarihi", "Çıkış Tarihi", "Gece", "Pansiyon", "Acenta"] },
  { name: "seyahat acentesi", expect: "seyahat", level: "high", headers: ["PNR", "Yolcu", "Uçuş", "Hareket Tarihi", "Otel", "Transfer", "Vize", "Tutar"] },
  { name: "restoran", expect: "restoran", level: "medium", headers: ["Masa", "Menü", "Porsiyon", "Adisyon No", "Garson", "Tutar"] },
  { name: "düğün salonu", expect: "dugun-salonu", level: "high", headers: ["Rezervasyon", "Düğün Tarihi", "Salon", "Davetli Sayısı", "Menü", "Kapora", "Telefon"] },
  // --- Güzellik / spor ---
  { name: "kuaför randevu", expect: "kuafor", level: "medium", headers: ["Randevu Tarihi", "Müşteri", "Hizmet", "Kuaför", "Saç Boyası", "Ücret"] },
  { name: "lazer epilasyon", expect: "guzellik-merkezi", level: "high", headers: ["Danışan", "Bölge", "Paket", "Seans", "Kalan Seans", "Lazer Tipi", "Randevu Tarihi"] },
  { name: "spor salonu üyeleri", expect: "spor-salonu", level: "high", headers: ["Üye No", "Üye", "Üyelik Başlangıç", "Üyelik Bitiş", "Paket", "PT", "Telefon"] },
  { name: "pilates stüdyosu", expect: "pilates-yoga", level: "high", headers: ["Üye", "Ders Paketi", "Kalan Ders", "Reformer", "Grup Dersi", "Telefon"] },
  // --- İK / satış / teknoloji ---
  { name: "personel özlük", expect: "ik-personel", level: "high", headers: ["Sicil No", "Ad Soyad", "Departman", "Pozisyon", "İşe Giriş Tarihi", "SGK No", "Yıllık İzin"] },
  { name: "aday takibi", expect: "ik-ise-alim", level: "high", headers: ["Aday", "Pozisyon", "Başvuru Tarihi", "Mülakat Tarihi", "Deneyim", "CV", "Durum"] },
  { name: "bordro", expect: "ik-bordro", level: "high", headers: ["Sicil", "Çalışan", "Brüt Maaş", "SGK Primi", "Gelir Vergisi", "Damga Vergisi", "Fazla Mesai"] },
  { name: "CRM fırsatları", expect: "crm", level: "high", headers: ["Müşteri", "Fırsat", "Aşama", "Teklif Tutarı", "Satış Temsilcisi", "Son Görüşme", "Sonraki Adım"] },
  { name: "destek talepleri", expect: "cagri-merkezi", level: "high", headers: ["Talep No", "Müşteri", "Kanal", "Öncelik", "Şikayet", "SLA", "Çözüm"] },
  { name: "sprint görevleri", expect: "yazilim-proje", level: "high", headers: ["Issue", "Epic", "Sprint", "Story Point", "Atanan", "Öncelik", "Durum"] },
  // --- Kamu / tarım / enerji / danışmanlık ---
  { name: "dernek üyeleri", expect: "dernek", level: "medium", headers: ["Üye", "Üyelik Tarihi", "Aidat", "Bağış", "Gönüllü", "Telefon"] },
  { name: "gelen giden evrak", expect: "evrak", level: "high", headers: ["Evrak No", "Gelen Evrak Tarihi", "Sayı", "Konu", "Havale", "İlgili Birim", "EBYS No"] },
  { name: "süt çiftliği", expect: "hayvancilik", level: "high", headers: ["Küpe No", "Irk", "Doğum Tarihi", "Cinsiyet", "Günlük Süt", "Tohumlama Tarihi", "Gebelik"] },
  { name: "tarla kayıtları", expect: "tarim", level: "high", headers: ["Parsel", "Tarla", "Dekar", "Ekim Tarihi", "Hasat Tarihi", "Gübre", "Verim"] },
  { name: "GES projeleri", expect: "ges", level: "high", headers: ["Proje", "Kurulu Güç (kWp)", "Panel", "İnverter", "Yıllık Üretim (kWh)", "Mahsuplaşma", "Durum"] },
  { name: "OSGB işyerleri", expect: "isg", level: "high", headers: ["İşyeri", "SGK Sicil", "Tehlike Sınıfı", "İş Güvenliği Uzmanı", "İşyeri Hekimi", "Risk Değerlendirmesi Tarihi"] },
  { name: "tercüme işleri", expect: "tercume", level: "high", headers: ["İş No", "Müşteri", "Kaynak Dil", "Hedef Dil", "Karakter", "Yeminli", "Noter Onayı", "Teslim Tarihi"] },
  // --- Genel / belirsiz: sektör biçilmemeli ---
  { name: "düz iletişim listesi", expect: "genel", level: "low", headers: ["Ad Soyad", "Telefon", "E-posta", "Şehir"] },
  { name: "anlamsız başlıklar", expect: "genel", level: "low", headers: ["Kolon 1", "Kolon 2", "Kolon 3", "Kolon 4"] },
  { name: "kısa karma tablo", expect: "genel", level: "low", headers: ["Ad", "Tarih", "Tutar", "Açıklama"] },
  { name: "İngilizce genel", expect: "genel", level: "low", headers: ["Name", "Email", "Phone", "City", "Notes"] },
  { name: "tek anlamlı kolon", expect: "genel", level: "low", headers: ["Müşteri", "Telefon", "Adres", "Not"] },
];

export function corpusRows(entry, count = 24) {
  return Array.from({ length: count }, (_, i) => Object.fromEntries(entry.headers.map(header => [header, sampleValue(header, i)])));
}
