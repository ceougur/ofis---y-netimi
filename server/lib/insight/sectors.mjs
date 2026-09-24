// Sektör listesi ve kanıta dayalı sektör önerisi.
//
// Her sektörün bir kelime dağarcığı vardır: kayıtlara ne dendiği ("dosya", "hasta", "poliçe"), uzman rolünün adı
// ("Avukat", "Hekim", "Emlak danışmanı"), kenar çubuğu alt başlığı ve hangi ek modüllerin anlamlı olduğu.
// Öneri yalnızca verideki kanıtlardan (kolon başlıkları, değerler, dosya/sekme adları) çıkar; hiçbir veri dışarı
// gönderilmez. Kanıt yetersiz ya da iki sektör birbirine yakınsa "Genel" önerilir. Öneri hiçbir zaman kendiliğinden
// uygulanmaz: yönetici onaylar, başka bir sektör seçer ya da Genel ile devam eder.
import { foldText } from "./validators.mjs";
import { phraseAt } from "./columns.mjs";

// Başlık sinyali ağırlıkları: "!" güçlü (3), öneksiz orta (2), "~" zayıf (1).
const WEIGHTS = { "!": 3, "": 2, "~": 1 };

// [kimlik, ad, kayıt, kayıtlar, uzman rolü, alt başlık, { h: başlık sinyalleri, v: [[değer kalıbı, açıklama]], t: dosya/sekme adı
//  sinyalleri, keys: arama eş anlamlıları, roles: doğrulanmış kolon türü sinyalleri, modules, general: grubun genel sektörü }]
const GROUPS = [
  ["hukuk", "Hukuk", [
    ["hukuk-buro", "Hukuk bürosu (genel)", "dosya", "dosyalar", "Avukat", "Hukuk ofisi yönetimi", { general: true, h: ["!muvekkil", "!avukat", "!vekalet", "!vekaletname", "dava", "icra", "esas no", "~karsi taraf", "~dosya no"], t: ["hukuk", "avukat", "buro"], keys: ["avukatlık", "hukuk bürosu", "avukat", "büro", "hukuk"], modules: { haciz: true } }],
    ["hukuk-icra", "İcra ve alacak takibi", "dosya", "dosyalar", "Avukat", "Hukuk ofisi yönetimi", { h: ["!icra", "!icra dairesi", "!icra mudurlugu", "!haciz", "!borclu", "!alacakli", "!takip no", "!takip tarihi", "!odeme emri", "!kiymet takdiri", "!satis talebi", "tebligat", "esas", "~avans", "~tahsilat", "~dosya no", "~vekalet ucreti", "~odeme sozu"], v: [["icra (dairesi|mudurlugu)", "icra dairesi adları"], ["\\bhaciz\\b", "haciz kayıtları"]], t: ["icra", "takip", "alacak"], keys: ["icra takibi", "alacak takibi", "haciz", "tahsilat hukuku", "avukat"], modules: { haciz: true } }],
    ["hukuk-dava", "Dava takibi", "dosya", "dosyalar", "Avukat", "Hukuk ofisi yönetimi", { h: ["!mahkeme", "!dava", "!davaci", "!davali", "!durusma", "!karar no", "!esas no", "!bilirkisi", "!istinaf", "!temyiz", "sanik", "~muvekkil", "~karsi taraf"], v: [["(asliye|agir ceza|is mahkemesi|aile mahkemesi|idare mahkemesi|sulh hukuk|ticaret mahkemesi|tuketici mahkemesi|vergi mahkemesi)", "mahkeme adları"]], t: ["dava", "durusma", "mahkeme"], keys: ["dava takibi", "mahkeme", "duruşma", "avukat"], modules: { haciz: true } }],
    ["hukuk-arabuluculuk", "Arabuluculuk", "dosya", "dosyalar", "Arabulucu", "Arabuluculuk bürosu yönetimi", { h: ["!arabulucu", "!arabuluculuk", "!uyusmazlik", "!basvurucu", "!son tutanak", "anlasma", "~karsi taraf", "~toplanti"], t: ["arabuluculuk"], keys: ["arabulucu", "uzlaşma", "dava şartı arabuluculuk"] }],
    ["hukuk-noter", "Noterlik", "işlem", "işlemler", "Noter kâtibi", "Noterlik yönetimi", { h: ["!noter", "!yevmiye", "!yevmiye no", "!ihtarname", "!onaylama", "!duzenleme sekli", "vekaletname", "~harc"], t: ["noter"], keys: ["noter", "noterlik"] }],
    ["hukuk-marka-patent", "Marka ve patent vekilliği", "başvuru", "başvurular", "Vekil", "Marka ve patent yönetimi", { h: ["!tescil", "!tescil no", "!patent", "!basvuru no", "!nice", "!bulten", "!ruchan", "!faydali model", "!tasarim tescil", "itiraz", "marka adi", "~marka", "~sinif", "~yenileme"], v: [["turkpatent|wipo|euipo", "tescil kurumu adları"]], t: ["marka", "patent"], keys: ["marka tescil", "patent", "fikri mülkiyet", "marka vekili"] }],
    ["hukuk-kurumsal", "Kurumsal hukuk ve uyum", "dosya", "dosyalar", "Avukat", "Hukuk ofisi yönetimi", { h: ["!genel kurul", "!ticaret sicil", "!kvkk", "!uyum", "sozlesme", "~sirket", "~muvekkil"], keys: ["şirketler hukuku", "sözleşme", "hukuk danışmanlığı", "KVKK"] }],
  ]],
  ["finans", "Finans ve muhasebe", [
    ["finans-muhasebe", "Muhasebe ve mali müşavirlik", "mükellef", "mükellefler", "Mali müşavir", "Mali müşavirlik yönetimi", { general: true, h: ["!mukellef", "!beyanname", "!vergi dairesi", "!muhtasar", "!kdv beyan", "!e defter", "!e fatura", "!bilanco", "!gecici vergi", "!ba bs", "!sgk", "!tahakkuk", "vergi no", "vkn", "~donem", "~ucret"], roles: { vkn: 2 }, t: ["muhasebe", "mukellef", "beyanname"], keys: ["muhasebe", "mali müşavir", "SMMM", "vergi", "beyanname"] }],
    ["finans-cari", "Ön muhasebe ve cari hesaplar", "cari", "cariler", "Muhasebeci", "Cari hesap yönetimi", { h: ["!cari", "!cari kod", "!borc bakiye", "!alacak bakiye", "!fatura no", "!irsaliye", "!hesap kodu", "vergi no", "~vade", "~bakiye"], roles: { vkn: 1 }, t: ["cari"], keys: ["cari hesap", "ön muhasebe", "fatura", "ekstre"] }],
    ["finans-tahsilat", "Alacak ve tahsilat yönetimi", "hesap", "hesaplar", "Tahsilat uzmanı", "Tahsilat yönetimi", { h: ["!gecikme", "!gecikme gunu", "!taksit", "!odeme plani", "!protesto", "!cek", "!senet", "!yaslandirma", "vade", "borc", "bakiye", "tahsilat", "~cari", "~odeme"], t: ["tahsilat", "alacak"], keys: ["alacak", "tahsilat", "çek senet", "vadesi geçmiş"] }],
    ["finans-kredi", "Kredi ve finansman", "başvuru", "başvurular", "Kredi uzmanı", "Kredi yönetimi", { h: ["!kredi", "!faiz orani", "!kefil", "!findeks", "!kredi notu", "!anapara", "teminat", "taksit", "vade", "limit"], t: ["kredi"], keys: ["kredi", "finansman", "banka", "kredi başvurusu"] }],
    ["finans-yatirim", "Yatırım ve portföy", "hesap", "hesaplar", "Portföy yöneticisi", "Portföy yönetimi", { h: ["!portfoy", "!hisse", "!fon kodu", "!lot", "!getiri", "!borsa", "!maliyet fiyati", "!piyasa degeri", "doviz", "~fon", "~adet"], t: ["portfoy", "yatirim"], keys: ["yatırım", "borsa", "hisse", "fon", "portföy"] }],
    ["finans-leasing", "Finansal kiralama (leasing)", "sözleşme", "sözleşmeler", "Müşteri temsilcisi", "Leasing yönetimi", { h: ["!leasing", "!finansal kiralama", "!kira bedeli", "!ekipman", "!sozlesme no", "vade", "taksit"], t: ["leasing"], keys: ["leasing", "finansal kiralama"] }],
    ["finans-faktoring", "Faktoring", "işlem", "işlemler", "Müşteri temsilcisi", "Faktoring yönetimi", { h: ["!faktoring", "!temlik", "!kesideci", "!cek no", "iskonto", "fatura no", "vade"], t: ["faktoring"], keys: ["faktoring", "fatura finansmanı"] }],
    ["finans-butce", "Bütçe ve gider takibi", "gider", "giderler", "Uzman", "Bütçe yönetimi", { h: ["!butce", "!gider", "!masraf merkezi", "!harcama", "!fis no", "!gerceklesen", "planlanan", "onay", "~kategori"], t: ["butce", "gider", "harcama"], keys: ["bütçe", "gider", "masraf", "harcama"] }],
    ["finans-kuyum-doviz", "Kuyumculuk ve döviz", "işlem", "işlemler", "Uzman", "Kuyum ve döviz yönetimi", { h: ["!gram", "!ayar", "!altin", "!milyem", "!has", "!kur", "doviz", "~iscilik"], t: ["kuyum", "altin", "doviz"], keys: ["kuyumcu", "döviz bürosu", "altın"] }],
  ]],
  ["sigorta", "Sigorta", [
    ["sigorta-acente", "Sigorta acentesi", "poliçe", "poliçeler", "Sigorta uzmanı", "Sigorta acentesi yönetimi", { general: true, h: ["!police", "!police no", "!sigortali", "!sigorta ettiren", "!prim", "!zeyil", "!zeyilname", "!sigorta sirketi", "!kasko", "!trafik sigortasi", "!dask", "teminat", "brans", "~yenileme", "~bitis"], v: [["^(kasko|trafik|dask|konut|saglik|ferdi kaza|isyeri|nakliyat)$", "sigorta branşları"]], t: ["police", "sigorta"], keys: ["sigorta", "acente", "poliçe", "kasko", "trafik sigortası"] }],
    ["sigorta-hasar", "Hasar ve eksper takibi", "dosya", "dosyalar", "Eksper", "Hasar yönetimi", { h: ["!hasar", "!hasar no", "!eksper", "!ekspertiz", "!rucu", "!tazminat", "!kaza tarihi", "!hasar tarihi", "!onarim", "~police", "~plaka", "~servis"], t: ["hasar"], keys: ["hasar", "eksper", "ekspertiz", "hasar dosyası"] }],
    ["sigorta-hayat", "Hayat sigortası ve BES", "sözleşme", "sözleşmeler", "Danışman", "Hayat ve emeklilik yönetimi", { h: ["!bes", "!bireysel emeklilik", "!katki payi", "!lehtar", "!vefat", "!fon dagilimi", "!emeklilik"], t: ["bes", "emeklilik"], keys: ["BES", "hayat sigortası", "bireysel emeklilik"] }],
    ["sigorta-saglik", "Sağlık sigortası", "poliçe", "poliçeler", "Sigorta uzmanı", "Sağlık sigortası yönetimi", { h: ["!provizyon", "!anlasmali kurum", "!tamamlayici saglik", "!ozel saglik", "!teminat limiti", "police", "sigortali"], keys: ["tamamlayıcı sağlık", "özel sağlık sigortası"] }],
  ]],
  ["saglik", "Sağlık", [
    ["saglik-klinik", "Klinik ve poliklinik", "hasta", "hastalar", "Hekim", "Klinik yönetimi", { general: true, h: ["!hasta", "!hasta no", "!protokol", "!tani", "!teshis", "!muayene", "!poliklinik", "!hekim", "!doktor", "!recete", "!icd", "tedavi", "randevu", "sikayet", "~sgk"], v: [["^[a-z]\\d{2}(\\.\\d{1,2})?$", "ICD-10 tanı kodları"]], t: ["hasta", "klinik", "poliklinik", "muayene"], keys: ["klinik", "muayenehane", "poliklinik", "doktor", "sağlık"] }],
    ["saglik-dis", "Diş kliniği", "hasta", "hastalar", "Diş hekimi", "Diş kliniği yönetimi", { h: ["!dis no", "!dis hekimi", "!dis numarasi", "!implant", "!dolgu", "!kanal tedavisi", "!ortodonti", "!protez", "!kron", "!zirkonyum", "!beyazlatma", "!agiz ve dis", "hasta", "tedavi"], t: ["dis", "dental"], keys: ["diş", "dental", "ağız ve diş", "diş hekimi"] }],
    ["saglik-hastane", "Hastane", "hasta", "hastalar", "Hekim", "Hastane yönetimi", { h: ["!yatis", "!taburcu", "!epikriz", "!ameliyat", "!yatak no", "!sevk", "!provizyon", "yatak", "hasta", "~servis", "~oda no"], t: ["hastane"], keys: ["hastane", "yataklı tedavi"] }],
    ["saglik-eczane", "Eczane", "reçete", "reçeteler", "Eczacı", "Eczane yönetimi", { h: ["!ilac", "!ilac adi", "!recete no", "!etken madde", "!karekod", "!miat", "!eczaci", "recete", "~barkod", "~stok", "~kutu"], t: ["eczane", "ilac"], keys: ["eczane", "ilaç", "eczacı"] }],
    ["saglik-lab", "Laboratuvar", "numune", "numuneler", "Uzman", "Laboratuvar yönetimi", { h: ["!numune", "!tetkik", "!test adi", "!referans araligi", "!sonuc degeri", "!hemogram", "!ornek no", "~sonuc", "~barkod"], t: ["laboratuvar", "tahlil"], keys: ["laboratuvar", "tahlil", "analiz"] }],
    ["saglik-fizik", "Fizik tedavi ve rehabilitasyon", "danışan", "danışanlar", "Fizyoterapist", "Fizik tedavi yönetimi", { h: ["!fizyoterapist", "!fizik tedavi", "!rehabilitasyon", "!seans sayisi", "!kalan seans", "!egzersiz", "seans", "~tedavi plani", "~bolge"], t: ["fizik tedavi", "rehabilitasyon"], keys: ["fizik tedavi", "fizyoterapi", "rehabilitasyon"] }],
    ["saglik-psikoloji", "Psikolojik danışmanlık", "danışan", "danışanlar", "Psikolog", "Danışmanlık merkezi yönetimi", { h: ["!danisan", "!psikolog", "!terapi", "!terapist", "seans", "gorusme", "~degerlendirme"], t: ["terapi", "psikoloji"], keys: ["psikolog", "terapi", "danışmanlık merkezi", "aile danışmanı"] }],
    ["saglik-diyet", "Diyetisyen", "danışan", "danışanlar", "Diyetisyen", "Diyet danışmanlığı yönetimi", { h: ["!hedef kilo", "!vki", "!bmi", "!bel cevresi", "!kalori", "!diyet", "kilo", "olcum", "boy", "~seans"], t: ["diyet", "beslenme"], keys: ["diyetisyen", "beslenme", "diyet"] }],
    ["saglik-veteriner", "Veteriner kliniği", "hasta", "hastalar", "Veteriner hekim", "Veteriner kliniği yönetimi", { h: ["!veteriner", "!hayvan", "!irk", "!mikrocip", "!kuduz", "!karma asi", "!pet", "asi", "~sahibi", "~kilo", "~tur"], v: [["^(kedi|kopek|muhabbet kusu|tavsan|hamster|papagan)$", "hayvan türleri"]], t: ["veteriner", "pet"], keys: ["veteriner", "pet", "hayvan hastanesi"] }],
    ["saglik-evde-bakim", "Evde bakım ve hemşirelik", "hasta", "hastalar", "Hemşire", "Evde bakım yönetimi", { h: ["!evde bakim", "!hemsire", "!vizit", "!pansuman", "!bakim plani", "hasta"], t: ["evde bakim"], keys: ["evde bakım", "hemşire", "yaşlı bakımı"] }],
    ["saglik-optik", "Optik", "müşteri", "müşteriler", "Optisyen", "Optik yönetimi", { h: ["!sag goz", "!sol goz", "!sph", "!cyl", "!aks", "!cerceve", "!lens", "!optisyen", "cam", "~numara", "~recete"], t: ["optik", "gozluk"], keys: ["optik", "gözlük", "lens"] }],
    ["saglik-turizm", "Sağlık turizmi", "hasta", "hastalar", "Hasta koordinatörü", "Sağlık turizmi yönetimi", { h: ["!tedavi paketi", "!tercuman", "!pasaport", "!transfer", "ulke", "hasta", "~ucus", "~otel"], t: ["saglik turizmi", "medikal"], keys: ["sağlık turizmi", "medikal turizm"] }],
  ]],
  ["egitim", "Eğitim", [
    ["egitim-okul", "Okul", "öğrenci", "öğrenciler", "Öğretmen", "Okul yönetimi", { general: true, h: ["!ogrenci", "!ogrenci no", "!okul no", "!veli", "!sinif", "!sube", "!devamsizlik", "!not ortalamasi", "!karne", "ders", "~donem"], t: ["ogrenci", "okul", "sinif"], keys: ["okul", "kolej", "öğrenci", "eğitim kurumu"] }],
    ["egitim-kurs", "Kurs, dershane ve etüt merkezi", "öğrenci", "öğrenciler", "Öğretmen", "Kurs merkezi yönetimi", { h: ["!kurs", "!etut", "!deneme sinavi", "!lgs", "!yks", "!tyt", "!ayt", "!kpss", "!kayit ucreti", "ogrenci", "veli", "taksit", "~net", "~grup"], t: ["kurs", "dershane", "etut"], keys: ["dershane", "kurs", "etüt", "sınav hazırlık"] }],
    ["egitim-dil", "Dil okulu", "öğrenci", "öğrenciler", "Eğitmen", "Dil okulu yönetimi", { h: ["!seviye", "!kur", "!speaking", "!placement", "!ielts", "!toefl", "dil", "ogrenci"], v: [["^(a1|a2|b1|b2|c1|c2)$", "dil seviyeleri (A1–C2)"]], t: ["dil", "ingilizce"], keys: ["dil okulu", "yabancı dil", "İngilizce kursu"] }],
    ["egitim-universite", "Üniversite ve akademik birim", "öğrenci", "öğrenciler", "Akademisyen", "Akademik birim yönetimi", { h: ["!fakulte", "!akts", "!transkript", "!tez", "!gno", "bolum", "danisman", "ogrenci no", "~donem"], t: ["universite", "fakulte"], keys: ["üniversite", "fakülte", "akademik"] }],
    ["egitim-anaokulu", "Anaokulu ve kreş", "öğrenci", "öğrenciler", "Öğretmen", "Anaokulu yönetimi", { h: ["!kres", "!anaokulu", "!yas grubu", "veli", "beslenme", "ogrenci", "~servis", "~sinif"], t: ["kres", "anaokulu"], keys: ["kreş", "anaokulu", "gündüz bakımevi"] }],
    ["egitim-surucu", "Sürücü kursu", "kursiyer", "kursiyerler", "Usta öğretici", "Sürücü kursu yönetimi", { h: ["!kursiyer", "!ehliyet", "!ehliyet sinifi", "!direksiyon", "!e sinav", "!sinav hakki", "!mtsk", "teorik", "~plaka"], t: ["surucu kursu", "ehliyet"], keys: ["sürücü kursu", "ehliyet", "MTSK"] }],
    ["egitim-sertifika", "Eğitim ve sertifika programları", "katılımcı", "katılımcılar", "Eğitmen", "Eğitim yönetimi", { h: ["!katilimci", "!egitim adi", "!sertifika", "!oturum", "!modul", "!tamamlama", "!yoklama", "~egitmen"], t: ["egitim", "sertifika", "seminer"], keys: ["seminer", "sertifika programı", "kurumsal eğitim"] }],
    ["egitim-ozel-ders", "Özel ders ve koçluk", "öğrenci", "öğrenciler", "Eğitmen", "Özel ders yönetimi", { h: ["!ozel ders", "!ders saati", "!kocluk", "!ders ucreti", "ogrenci", "~konu", "~koc"], t: ["ozel ders", "kocluk"], keys: ["özel ders", "koçluk", "birebir ders"] }],
  ]],
  ["gayrimenkul", "Gayrimenkul ve inşaat", [
    ["emlak-ofisi", "Emlak ofisi", "portföy", "portföyler", "Emlak danışmanı", "Emlak ofisi yönetimi", { general: true, h: ["!ilan no", "!satilik", "!kiralik", "!metrekare", "!m2", "!oda sayisi", "!bina yasi", "!bulundugu kat", "!isitma", "!emlak", "!portfoy", "tapu", "ada", "parsel", "~aidat", "~kat"], v: [["^\\d\\s?\\+\\s?\\d$", "oda sayıları (3+1 gibi)"], ["^(satilik|kiralik)$", "satılık / kiralık"]], t: ["emlak", "portfoy", "ilan"], keys: ["emlak", "gayrimenkul", "emlakçı", "konut", "ilan"] }],
    ["site-yonetimi", "Site ve apartman yönetimi", "daire", "daireler", "Site sorumlusu", "Site yönetimi", { h: ["!daire no", "!aidat", "!kat maliki", "!sakin", "!yakit", "!isinma", "blok", "malik", "kiraci", "~site", "~borc"], t: ["site", "apartman", "aidat"], keys: ["site yönetimi", "apartman", "yönetim şirketi", "aidat"] }],
    ["mulk-kira", "Mülk ve kira yönetimi", "mülk", "mülkler", "Mülk yöneticisi", "Kira yönetimi", { h: ["!kiraci", "!kira bedeli", "!kira artisi", "!depozito", "!stopaj", "!mulk sahibi", "!kira baslangic", "!kontrat", "~sozlesme"], t: ["kira", "kiraci"], keys: ["kira", "mülk yönetimi", "kiracı", "kira takibi"] }],
    ["insaat-proje", "İnşaat ve şantiye", "iş kalemi", "iş kalemleri", "Mühendis", "Şantiye yönetimi", { h: ["!hakedis", "!metraj", "!taseron", "!santiye", "!poz no", "!is kalemi", "!beton", "!demir", "iskan", "ruhsat", "~birim fiyat", "~malzeme"], t: ["santiye", "insaat", "hakedis"], keys: ["inşaat", "şantiye", "müteahhit", "taşeron", "hakediş"] }],
    ["konut-satis", "Konut satış ofisi", "daire", "daireler", "Satış danışmanı", "Konut satış yönetimi", { h: ["!cephe", "!brut m2", "!net m2", "!pesinat", "blok", "daire", "satis fiyati", "alici", "taksit", "~kat"], t: ["konut", "proje satis"], keys: ["konut projesi", "müteahhit satış", "proje satış ofisi"] }],
    ["mimarlik", "Mimarlık ve iç mimarlık", "proje", "projeler", "Mimar", "Mimarlık ofisi yönetimi", { h: ["!avan proje", "!uygulama projesi", "!revizyon", "!cizim", "!render", "!ic mimari", "!mimar", "ruhsat", "~proje", "~teslim"], t: ["mimarlik", "mimari"], keys: ["mimarlık", "iç mimar", "proje ofisi"] }],
    ["harita", "Harita ve kadastro", "iş", "işler", "Mühendis", "Harita bürosu yönetimi", { h: ["!pafta", "!kadastro", "!ifraz", "!tevhid", "!aplikasyon", "!cins tashihi", "ada", "parsel", "tapu", "~il", "~ilce"], t: ["harita", "kadastro"], keys: ["harita", "kadastro", "tapu işlemleri"] }],
    ["yapi-denetim", "Yapı denetim", "yapı", "yapılar", "Denetçi", "Yapı denetim yönetimi", { h: ["!yapi denetim", "!yapi sinifi", "!seviye tespit", "!denetci", "ruhsat", "iskan", "hakedis", "~ada", "~parsel"], t: ["yapi denetim"], keys: ["yapı denetim", "denetim"] }],
  ]],
  ["otomotiv", "Otomotiv ve ulaşım", [
    ["oto-galeri", "Oto galeri ve araç alım-satım", "araç", "araçlar", "Satış danışmanı", "Galeri yönetimi", { general: true, h: ["!model yili", "!kilometre", "!sasi", "!sasi no", "!sase no", "!motor no", "!vites", "!kasa tipi", "!tramer", "!hasar kaydi", "yakit", "km", "marka", "model", "plaka", "~renk", "~alis fiyati", "~satis fiyati", "~ekspertiz"], roles: { plate: 2 }, v: [["^(benzin|dizel|lpg|hibrit|elektrik|benzin lpg)$", "yakıt türleri"], ["^(otomatik|manuel|yari otomatik)$", "vites türleri"]], t: ["galeri", "arac", "oto"], keys: ["galeri", "oto galeri", "ikinci el araç", "otomobil", "araç alım satım"] }],
    ["oto-servis", "Oto servis ve bakım", "iş emri", "iş emirleri", "Teknisyen", "Servis yönetimi", { h: ["!is emri", "!ariza", "!iscilik", "!yag degisimi", "!servis tarihi", "parca", "bakim", "plaka", "km", "sasi"], roles: { plate: 2 }, t: ["servis", "bakim"], keys: ["oto servis", "tamirhane", "bakım", "sanayi"] }],
    ["oto-kiralama", "Araç kiralama", "kiralama", "kiralamalar", "Temsilci", "Araç kiralama yönetimi", { h: ["!teslim alis", "!iade tarihi", "!gunluk ucret", "!kiralama", "!ehliyet no", "depozito", "plaka", "km"], roles: { plate: 2 }, t: ["kiralama", "rent"], keys: ["rent a car", "araç kiralama", "oto kiralama"] }],
    ["filo", "Filo yönetimi", "araç", "araçlar", "Filo sorumlusu", "Filo yönetimi", { h: ["!zimmet", "!muayene tarihi", "!kasko bitis", "!hgs", "!ogs", "!yakit karti", "muayene", "trafik sigortasi", "plaka", "km", "~surucu"], roles: { plate: 2 }, t: ["filo", "arac"], keys: ["filo", "şirket araçları", "araç takip"] }],
    ["lojistik", "Nakliye ve lojistik", "sevkiyat", "sevkiyatlar", "Operasyon sorumlusu", "Lojistik yönetimi", { h: ["!sevkiyat", "!irsaliye", "!yukleme", "!bosaltma", "!tonaj", "!dorse", "!navlun", "!konsimento", "!cikis yeri", "!varis", "yuk", "~sofor", "~plaka"], t: ["sevkiyat", "lojistik", "nakliye"], keys: ["nakliye", "lojistik", "taşımacılık", "tır"] }],
    ["kargo", "Kargo ve kurye", "gönderi", "gönderiler", "Operasyon sorumlusu", "Kargo yönetimi", { h: ["!gonderi", "!kargo takip", "!desi", "!gonderici", "!kurye", "kargo", "teslimat", "alici", "~sube"], t: ["kargo", "kurye"], keys: ["kargo", "kurye", "gönderi"] }],
    ["servis-tasima", "Personel ve öğrenci servisi", "güzergâh", "güzergâhlar", "Şoför", "Servis yönetimi", { h: ["!guzergah", "!durak", "!sefer", "!binis", "servis", "~sofor", "~plaka"], t: ["servis", "guzergah"], keys: ["servis taşımacılığı", "öğrenci servisi", "personel servisi"] }],
    ["yedek-parca", "Yedek parça", "parça", "parçalar", "Satış temsilcisi", "Yedek parça yönetimi", { h: ["!oem", "!parca no", "!muadil", "!orijinal no", "!arac uyumu", "stok", "~marka"], t: ["yedek parca"], keys: ["yedek parça", "otomotiv parça"] }],
    ["lastik", "Lastik ve jant", "müşteri", "müşteriler", "Usta", "Lastik oteli yönetimi", { h: ["!lastik", "!ebat", "!jant", "!mevsim", "!lastik oteli", "!rot balans", "~plaka"], v: [["\\d{3} \\d{2} r ?\\d{2}", "lastik ebatları"]], t: ["lastik"], keys: ["lastikçi", "lastik oteli", "jant"] }],
    ["oto-ekspertiz", "Oto ekspertiz", "araç", "araçlar", "Eksper", "Ekspertiz yönetimi", { h: ["!ekspertiz", "!lokal boya", "!degisen", "!boyali", "plaka", "km", "~motor"], roles: { plate: 1 }, t: ["ekspertiz"], keys: ["ekspertiz", "araç muayene"] }],
    ["otopark", "Otopark ve oto yıkama", "araç", "araçlar", "Görevli", "Otopark yönetimi", { h: ["!giris saati", "!cikis saati", "!abonman", "!yikama", "!otopark", "plaka"], roles: { plate: 1 }, t: ["otopark", "yikama"], keys: ["otopark", "oto yıkama", "vale"] }],
  ]],
  ["perakende", "Perakende ve e-ticaret", [
    ["eticaret", "E-ticaret", "sipariş", "siparişler", "Operasyon uzmanı", "E-ticaret yönetimi", { general: true, h: ["!siparis no", "!siparis tarihi", "!kargo takip", "!pazaryeri", "!sepet", "iade", "sku", "urun adi", "~adet", "~kargo"], v: [["^(trendyol|hepsiburada|n11|amazon|ciceksepeti|shopify|pazarama|web sitesi)$", "pazaryeri adları"]], t: ["siparis", "e ticaret", "eticaret"], keys: ["e-ticaret", "online mağaza", "pazaryeri", "internet satış"] }],
    ["magaza", "Mağaza ve perakende satış", "ürün", "ürünler", "Satış danışmanı", "Mağaza yönetimi", { h: ["!urun kodu", "!stok", "!satis fiyati", "!alis fiyati", "!raf", "barkod", "urun", "kdv", "kategori", "~marka"], t: ["magaza", "urun", "stok"], keys: ["mağaza", "perakende", "dükkân"] }],
    ["market", "Market ve bakkal", "ürün", "ürünler", "Kasa sorumlusu", "Market yönetimi", { h: ["!skt", "!kasa", "!raf", "barkod", "stok", "~kdv"], t: ["market"], keys: ["market", "bakkal", "süpermarket"] }],
    ["toptan", "Toptan satış ve dağıtım", "sipariş", "siparişler", "Satış temsilcisi", "Toptan satış yönetimi", { h: ["!koli", "!palet", "!bayi", "iskonto", "cari", "fatura no", "bolge", "siparis", "vade"], t: ["toptan", "dagitim"], keys: ["toptan", "distribütör", "dağıtım"] }],
    ["giyim", "Giyim ve butik", "ürün", "ürünler", "Satış danışmanı", "Butik yönetimi", { h: ["!beden", "!sezon", "!kumas", "!model kodu", "renk", "stok", "urun"], v: [["^(xs|s|m|l|xl|xxl|xxxl)$", "beden ölçüleri"]], t: ["butik", "giyim"], keys: ["butik", "giyim", "tekstil mağazası"] }],
    ["mobilya", "Mobilya ve dekorasyon", "sipariş", "siparişler", "Satış danışmanı", "Mobilya mağazası yönetimi", { h: ["!mobilya", "!montaj", "!olcu", "takim", "kumas", "teslimat", "siparis"], t: ["mobilya"], keys: ["mobilya", "dekorasyon", "ev tekstili"] }],
    ["teknik-servis", "Teknik servis (elektronik)", "cihaz", "cihazlar", "Teknisyen", "Teknik servis yönetimi", { h: ["!cihaz", "!imei", "!ariza", "!garanti", "!servis fisi", "!onarim", "seri no", "~teslim"], t: ["teknik servis", "cihaz"], keys: ["teknik servis", "tamir", "elektronik servis", "telefon tamiri"] }],
    ["cicekci", "Çiçekçi", "sipariş", "siparişler", "Tasarımcı", "Çiçekçi yönetimi", { h: ["!cicek", "!buket", "!aranjman", "!not karti", "!teslimat adresi", "siparis"], t: ["cicek"], keys: ["çiçekçi", "çiçek"] }],
    ["yayinevi", "Yayınevi ve kitabevi", "kitap", "kitaplar", "Editör", "Yayınevi yönetimi", { h: ["!isbn", "!yazar", "!yayinevi", "!baski", "!sayfa sayisi", "!telif", "!basim"], v: [["^97[89][- ]?\\d", "ISBN numaraları"]], t: ["kitap", "yayin"], keys: ["yayınevi", "kitabevi", "kitap"] }],
    ["abonelik", "Abonelik ve üyelik satışı", "abone", "aboneler", "Temsilci", "Abonelik yönetimi", { h: ["!abone", "!abonelik", "!abone no", "paket", "yenileme", "iptal"], t: ["abone"], keys: ["abonelik", "üyelik satışı"] }],
    ["yapi-market", "Yapı market ve nalbur", "ürün", "ürünler", "Satış danışmanı", "Yapı market yönetimi", { h: ["!nalbur", "!hirdavat", "!vida", "boya", "birim", "stok", "barkod"], t: ["nalbur", "hirdavat"], keys: ["nalbur", "hırdavat", "yapı market"] }],
    ["petshop", "Petshop", "ürün", "ürünler", "Satış danışmanı", "Petshop yönetimi", { h: ["!mama", "!pet", "kum", "hayvan", "stok"], t: ["pet"], keys: ["petshop", "evcil hayvan ürünleri"] }],
  ]],
  ["uretim", "Üretim ve sanayi", [
    ["uretim", "Üretim ve fabrika", "iş emri", "iş emirleri", "Üretim sorumlusu", "Üretim yönetimi", { general: true, h: ["!is emri", "!uretim", "!vardiya", "!makine", "!parti no", "!lot", "!fire", "!hammadde", "!urun recetesi", "!kalite kontrol", "hat", "operator", "~miktar"], t: ["uretim", "fabrika", "imalat"], keys: ["fabrika", "üretim", "imalat", "atölye"] }],
    ["tekstil", "Tekstil ve konfeksiyon", "sipariş", "siparişler", "Üretim sorumlusu", "Konfeksiyon yönetimi", { h: ["!model no", "!kesim", "!dikim", "!fason", "!kumas", "beden", "renk", "~ton", "~metre", "siparis"], t: ["tekstil", "konfeksiyon"], keys: ["tekstil", "konfeksiyon", "hazır giyim üretimi"] }],
    ["gida-uretim", "Gıda üretimi", "parti", "partiler", "Kalite sorumlusu", "Gıda üretim yönetimi", { h: ["!tett", "!haccp", "!uretim tarihi", "!parti no", "skt", "lot", "gramaj", "recete", "~urun"], t: ["gida"], keys: ["gıda", "gıda üretimi", "imalat"] }],
    ["kalite", "Kalite yönetimi", "uygunsuzluk", "uygunsuzluklar", "Kalite uzmanı", "Kalite yönetimi", { h: ["!uygunsuzluk", "!dof", "!duzeltici faaliyet", "!kok neden", "!ic tetkik", "iso", "denetim", "~sorumlu"], t: ["kalite", "dof"], keys: ["kalite", "ISO", "DÖF", "denetim"], modules: { tahsilat: false } }],
    ["bakim", "Makine bakım ve arıza", "iş emri", "iş emirleri", "Teknisyen", "Bakım yönetimi", { h: ["!periyodik bakim", "!durus suresi", "!ekipman no", "makine", "ariza", "bakim", "durus", "ekipman", "~yedek parca"], t: ["bakim", "ariza"], keys: ["bakım", "arıza", "makine bakım"], modules: { tahsilat: false } }],
    ["matbaa", "Matbaa ve baskı", "iş", "işler", "Grafiker", "Matbaa yönetimi", { h: ["!ofset", "!dijital baski", "!kagit", "!gramaj", "baski", "ebat", "cilt", "adet", "~renk", "~teslim"], t: ["matbaa", "baski"], keys: ["matbaa", "baskı", "reklam baskı"] }],
    ["metal-makine", "Metal ve makine imalatı", "sipariş", "siparişler", "Mühendis", "İmalat yönetimi", { h: ["!teknik resim", "!tolerans", "!cnc", "!torna", "malzeme", "agirlik", "parca no", "~kaynak", "~adet"], t: ["imalat", "cnc"], keys: ["metal", "makine imalatı", "CNC", "torna"] }],
  ]],
  ["tedarik", "Tedarik, depo ve dış ticaret", [
    ["depo", "Depo ve stok yönetimi", "ürün", "ürünler", "Depo sorumlusu", "Stok yönetimi", { general: true, h: ["!stok kodu", "!depo", "!lokasyon", "!sayim", "!minimum stok", "stok", "raf", "barkod", "sku", "birim", "~giris", "~cikis"], t: ["depo", "stok", "envanter"], keys: ["depo", "stok", "envanter"] }],
    ["satinalma", "Satınalma", "talep", "talepler", "Satınalma uzmanı", "Satınalma yönetimi", { h: ["!satinalma", "!talep no", "!teklif", "!termin", "tedarikci", "siparis no", "birim fiyat", "onay"], t: ["satinalma", "teklif"], keys: ["satınalma", "tedarik", "teklif"] }],
    ["tedarikci", "Tedarikçi yönetimi", "tedarikçi", "tedarikçiler", "Satınalma uzmanı", "Tedarikçi yönetimi", { h: ["!tedarikci", "!degerlendirme puani", "!urun grubu", "vergi no", "sozlesme"], roles: { vkn: 1 }, t: ["tedarikci"], keys: ["tedarikçi", "tedarik zinciri"] }],
    ["dis-ticaret", "Dış ticaret (ithalat-ihracat)", "dosya", "dosyalar", "Dış ticaret uzmanı", "Dış ticaret yönetimi", { h: ["!gtip", "!konteyner", "!incoterms", "!fob", "!cif", "!exw", "!konsimento", "!mense", "!ithalat", "!ihracat", "!proforma", "gumruk"], t: ["ithalat", "ihracat"], keys: ["ithalat", "ihracat", "dış ticaret"] }],
    ["gumruk", "Gümrük müşavirliği", "beyanname", "beyannameler", "Gümrük müşaviri", "Gümrük müşavirliği yönetimi", { h: ["!gumruk", "!beyanname no", "!antrepo", "!ordino", "!rejim kodu", "gtip", "musavir"], t: ["gumruk"], keys: ["gümrük", "gümrük müşaviri"] }],
  ]],
  ["turizm", "Turizm ve konaklama", [
    ["otel", "Otel ve konaklama", "rezervasyon", "rezervasyonlar", "Ön büro sorumlusu", "Otel yönetimi", { general: true, h: ["!rezervasyon", "!oda no", "!oda tipi", "!check in", "!check out", "!konaklama", "!pansiyon", "!acenta", "giris tarihi", "cikis tarihi", "gece", "misafir", "~kisi sayisi"], v: [["^(bb|hb|fb|ai|uai|oda kahvalti|yarim pansiyon|tam pansiyon|her sey dahil)$", "pansiyon tipleri"]], t: ["otel", "rezervasyon", "konaklama"], keys: ["otel", "konaklama", "pansiyon", "butik otel"] }],
    ["seyahat", "Seyahat acentesi", "rezervasyon", "rezervasyonlar", "Seyahat danışmanı", "Seyahat acentesi yönetimi", { h: ["!pnr", "!ucus", "!bilet", "!vize", "!pasaport", "!hareket tarihi", "transfer", "tur", "yolcu", "otel"], t: ["seyahat", "tur", "bilet"], keys: ["seyahat acentesi", "tur", "bilet", "turizm"] }],
    ["tur-operatoru", "Tur operatörü", "tur", "turlar", "Rehber", "Tur yönetimi", { h: ["!tur adi", "!kontenjan", "!rehber", "!guzergah", "hareket", "donus", "katilimci"], t: ["tur"], keys: ["tur operatörü", "rehber", "gezi"] }],
    ["villa-kiralama", "Villa, apart ve günlük kiralama", "rezervasyon", "rezervasyonlar", "Rezervasyon sorumlusu", "Kiralama yönetimi", { h: ["!villa", "!apart", "!gecelik", "!havuz", "kapora", "giris", "cikis", "misafir"], t: ["villa", "apart"], keys: ["villa kiralama", "günlük kiralık", "apart"] }],
    ["etkinlik", "Etkinlik ve organizasyon", "etkinlik", "etkinlikler", "Organizatör", "Organizasyon yönetimi", { h: ["!etkinlik", "!organizasyon", "!davetli", "!davetli sayisi", "!catering", "!sahne", "salon", "menu", "katilimci", "~kisi sayisi"], t: ["etkinlik", "organizasyon"], keys: ["organizasyon", "etkinlik", "event"] }],
    ["dugun-salonu", "Düğün salonu", "rezervasyon", "rezervasyonlar", "Organizasyon sorumlusu", "Düğün salonu yönetimi", { h: ["!dugun", "!nisan", "!kina", "!davetli sayisi", "salon", "kapora", "menu"], t: ["dugun"], keys: ["düğün salonu", "nikâh", "kına"] }],
  ]],
  ["yemeicme", "Yeme-içme", [
    ["restoran", "Restoran ve kafe", "sipariş", "siparişler", "Servis sorumlusu", "Restoran yönetimi", { general: true, h: ["!masa", "!menu", "!porsiyon", "!adisyon", "!garson", "rezervasyon", "kisi", "urun", "~kategori"], t: ["restoran", "kafe", "menu"], keys: ["restoran", "kafe", "lokanta", "cafe"] }],
    ["catering", "Catering ve toplu yemek", "sipariş", "siparişler", "Operasyon sorumlusu", "Catering yönetimi", { h: ["!catering", "!ogun", "!tabldot", "porsiyon", "kisi sayisi", "menu", "kurum"], t: ["catering", "yemek"], keys: ["catering", "yemek şirketi", "toplu yemek"] }],
    ["pastane", "Pastane ve fırın", "sipariş", "siparişler", "Usta", "Pastane yönetimi", { h: ["!pasta", "!kisilik", "!yas pasta", "!ekmek", "gramaj", "siparis", "~kat", "~teslim"], t: ["pastane", "firin"], keys: ["pastane", "fırın", "unlu mamul"] }],
  ]],
  ["guzellik", "Güzellik ve kişisel bakım", [
    ["kuafor", "Kuaför ve berber", "randevu", "randevular", "Uzman", "Salon yönetimi", { general: true, h: ["!kuafor", "!berber", "!sac", "!fon", "!manikur", "!pedikur", "!koltuk", "boya", "randevu", "hizmet", "~uzman"], t: ["kuafor", "berber", "salon"], keys: ["kuaför", "berber", "saç", "güzellik salonu"] }],
    ["guzellik-merkezi", "Güzellik merkezi", "danışan", "danışanlar", "Uzman", "Güzellik merkezi yönetimi", { h: ["!lazer", "!epilasyon", "!cilt bakimi", "!kalan seans", "seans", "bolge", "paket", "randevu"], t: ["guzellik", "lazer"], keys: ["güzellik merkezi", "lazer", "cilt bakımı", "epilasyon"] }],
    ["spa", "Spa ve masaj", "randevu", "randevular", "Terapist", "Spa yönetimi", { h: ["!spa", "!masaj", "!terapist", "!kabin", "seans", "randevu"], t: ["spa", "masaj"], keys: ["spa", "masaj", "hamam"] }],
    ["dovme", "Dövme stüdyosu", "randevu", "randevular", "Sanatçı", "Stüdyo yönetimi", { h: ["!dovme", "!piercing", "tasarim", "seans", "kapora"], t: ["dovme", "tattoo"], keys: ["dövme", "tattoo", "piercing"] }],
  ]],
  ["spor", "Spor ve sağlıklı yaşam", [
    ["spor-salonu", "Spor salonu ve fitness", "üye", "üyeler", "Eğitmen", "Spor salonu yönetimi", { general: true, h: ["!uyelik baslangic", "!uyelik bitis", "!pt", "!antrenor", "!dondurma", "!turnike", "uye", "uyelik", "paket", "~giris"], t: ["spor", "fitness", "gym", "uye"], keys: ["spor salonu", "fitness", "gym", "üyelik"] }],
    ["spor-kulubu", "Spor kulübü ve akademi", "sporcu", "sporcular", "Antrenör", "Kulüp yönetimi", { h: ["!sporcu", "!lisans no", "!antrenman", "!yas grubu", "brans", "takim", "mac", "aidat", "veli"], t: ["kulup", "akademi", "sporcu"], keys: ["spor kulübü", "futbol okulu", "yüzme", "akademi"] }],
    ["pilates-yoga", "Pilates ve yoga stüdyosu", "üye", "üyeler", "Eğitmen", "Stüdyo yönetimi", { h: ["!pilates", "!reformer", "!yoga", "!ders paketi", "!kalan ders", "!grup dersi", "uye"], t: ["pilates", "yoga"], keys: ["pilates", "yoga", "stüdyo"] }],
  ]],
  ["ik", "İnsan kaynakları ve hizmet", [
    ["ik-personel", "Personel ve özlük", "çalışan", "çalışanlar", "İK uzmanı", "İK yönetimi", { general: true, h: ["!sicil no", "!ise giris", "!isten cikis", "!sgk no", "!yillik izin", "!kidem", "departman", "pozisyon", "unvan", "izin", "~gorev", "~maas", "~dogum tarihi"], t: ["personel", "calisan", "ozluk"], keys: ["insan kaynakları", "personel", "özlük", "İK"], modules: { tahsilat: false } }],
    ["ik-ise-alim", "İşe alım ve aday takibi", "aday", "adaylar", "İK uzmanı", "İşe alım yönetimi", { h: ["!aday", "!mulakat", "!cv", "!ozgecmis", "!deneyim", "basvuru", "pozisyon", "referans", "teklif", "~egitim durumu"], t: ["aday", "ise alim", "basvuru"], keys: ["işe alım", "aday", "mülakat", "kariyer"], modules: { tahsilat: false } }],
    ["ik-bordro", "Bordro ve puantaj", "çalışan", "çalışanlar", "Bordro uzmanı", "Bordro yönetimi", { h: ["!puantaj", "!fazla mesai", "!gelir vergisi", "!damga vergisi", "!sgk primi", "!brut", "mesai", "kesinti", "maas", "~sicil"], t: ["bordro", "puantaj", "maas"], keys: ["bordro", "maaş", "puantaj"], modules: { tahsilat: false } }],
    ["guvenlik-hizmet", "Özel güvenlik hizmetleri", "görevli", "görevliler", "Güvenlik amiri", "Güvenlik hizmetleri yönetimi", { h: ["!guvenlik gorevlisi", "!ogg", "!silahli", "!silahsiz", "!devriye", "nokta", "vardiya"], t: ["guvenlik"], keys: ["özel güvenlik", "güvenlik şirketi"] }],
    ["temizlik", "Temizlik hizmetleri", "iş", "işler", "Ekip sorumlusu", "Temizlik hizmetleri yönetimi", { h: ["!temizlik", "!periyot", "!hizmet tarihi", "ekip", "~adres", "~metrekare"], t: ["temizlik"], keys: ["temizlik", "tesis yönetimi"] }],
    ["kuru-temizleme", "Kuru temizleme ve terzi", "sipariş", "siparişler", "Usta", "Kuru temizleme yönetimi", { h: ["!kuru temizleme", "!terzi", "!utu", "!tadilat", "fis no", "teslim"], t: ["kuru temizleme", "terzi"], keys: ["kuru temizleme", "terzi", "çamaşırhane"] }],
  ]],
  ["satis", "Satış, pazarlama ve müşteri ilişkileri", [
    ["crm", "Satış ve müşteri takibi (CRM)", "müşteri", "müşteriler", "Satış temsilcisi", "Satış yönetimi", { general: true, h: ["!firsat", "!potansiyel", "!lead", "!pipeline", "!sonraki adim", "!son gorusme", "!satis temsilcisi", "asama", "teklif", "gorusme", "musteri", "~kaynak", "~sehir"], t: ["musteri", "satis", "crm"], keys: ["CRM", "satış", "müşteri takibi", "teklif"] }],
    ["cagri-merkezi", "Çağrı merkezi ve müşteri hizmetleri", "talep", "talepler", "Müşteri temsilcisi", "Müşteri hizmetleri yönetimi", { h: ["!talep no", "!cagri", "!ticket", "!sla", "!cozum", "sikayet", "oncelik", "kanal", "~musteri"], t: ["talep", "sikayet", "destek"], keys: ["çağrı merkezi", "müşteri hizmetleri", "destek talebi"], modules: { tahsilat: false } }],
    ["ajans", "Reklam ve dijital pazarlama ajansı", "proje", "projeler", "Proje yöneticisi", "Ajans yönetimi", { h: ["!kampanya", "!reklam", "!gosterim", "!tiklama", "!ctr", "!donusum", "!sosyal medya", "!yayin tarihi", "icerik", "butce", "~marka"], t: ["ajans", "kampanya", "reklam"], keys: ["ajans", "reklam", "dijital pazarlama", "sosyal medya"] }],
    ["bayi", "Bayi ve distribütör yönetimi", "bayi", "bayiler", "Bölge sorumlusu", "Bayi yönetimi", { h: ["!bayi", "!bayi kodu", "!gerceklesen", "bolge", "hedef", "ciro", "prim", "sozlesme"], t: ["bayi"], keys: ["bayi", "distribütör", "bölge satış"] }],
    ["saha-satis", "Saha satış ve ziyaret", "ziyaret", "ziyaretler", "Saha temsilcisi", "Saha satış yönetimi", { h: ["!ziyaret", "!ziyaret tarihi", "!rota", "!musteri kodu", "konum", "temsilci", "siparis"], t: ["ziyaret", "saha"], keys: ["saha satış", "ziyaret", "plasiyer"] }],
    ["anket", "Anket ve araştırma", "yanıt", "yanıtlar", "Araştırmacı", "Araştırma yönetimi", { h: ["!anket", "!soru", "!yanit", "!memnuniyet", "!nps", "puan", "katilimci"], t: ["anket", "arastirma"], keys: ["anket", "araştırma", "memnuniyet"], modules: { tahsilat: false } }],
  ]],
  ["teknoloji", "Teknoloji ve bilişim", [
    ["yazilim-proje", "Yazılım ve proje takibi", "iş", "işler", "Proje yöneticisi", "Proje yönetimi", { general: true, h: ["!sprint", "!issue", "!bug", "!story point", "!epic", "!release", "!versiyon", "atanan", "oncelik", "durum", "~gorev"], t: ["sprint", "proje", "gorev"], keys: ["yazılım", "proje yönetimi", "görev takibi", "jira"], modules: { tahsilat: false } }],
    ["bt-destek", "BT destek ve envanter", "talep", "talepler", "Destek uzmanı", "BT yönetimi", { h: ["!envanter", "!ip adresi", "!bilgisayar", "!lisans", "!ticket", "zimmet", "ariza", "~cihaz"], t: ["bilgi islem", "envanter"], keys: ["BT", "bilgi işlem", "helpdesk", "IT"], modules: { tahsilat: false } }],
    ["telekom", "Telekom ve GSM bayi", "abone", "aboneler", "Satış danışmanı", "Bayi yönetimi", { h: ["!gsm no", "!tarife", "!numara tasima", "!imei", "hat", "taahhut", "operator", "abone"], t: ["gsm", "hat", "tarife"], keys: ["GSM", "operatör", "hat", "telekom"] }],
    ["hosting", "Hosting ve alan adı", "hizmet", "hizmetler", "Destek uzmanı", "Hizmet yönetimi", { h: ["!domain", "!alan adi", "!hosting", "!sunucu", "!ssl", "paket", "~bitis tarihi", "~yenileme"], t: ["hosting", "domain"], keys: ["hosting", "domain", "web hizmetleri"] }],
    ["guvenlik-sistem", "Güvenlik ve kamera sistemleri", "proje", "projeler", "Teknisyen", "Proje yönetimi", { h: ["!kamera", "!alarm", "!nvr", "!dvr", "!kesif", "montaj", "bakim sozlesmesi"], t: ["kamera", "alarm"], keys: ["kamera", "alarm", "güvenlik sistemleri"] }],
  ]],
  ["kamu", "Kamu, dernek ve STK", [
    ["dernek", "Dernek ve vakıf", "üye", "üyeler", "Koordinatör", "Dernek yönetimi", { general: true, h: ["!uyelik tarihi", "!bagis", "!bagisci", "!gonullu", "!dernek", "!vakif", "uye", "aidat"], t: ["dernek", "vakif", "uye"], keys: ["dernek", "vakıf", "STK", "sivil toplum"] }],
    ["evrak", "Evrak ve yazışma takibi", "evrak", "evraklar", "Sorumlu", "Evrak yönetimi", { h: ["!evrak no", "!gelen evrak", "!giden evrak", "!havale", "!ilgili birim", "!yazisma", "!ebys", "sayi", "konu", "~tebligat"], t: ["evrak", "yazisma"], keys: ["evrak", "yazışma", "arşiv", "EBYS"], modules: { tahsilat: false } }],
    ["belediye", "Belediye ve muhtarlık hizmetleri", "başvuru", "başvurular", "Memur", "Hizmet yönetimi", { h: ["!muhtarlik", "!vatandas", "!dilekce", "mahalle", "basvuru", "talep", "~ada", "~parsel"], t: ["belediye", "muhtarlik"], keys: ["belediye", "muhtarlık", "kamu"], modules: { tahsilat: false } }],
    ["sosyal-yardim", "Sosyal yardım", "hane", "haneler", "Sosyal hizmet uzmanı", "Yardım yönetimi", { h: ["!hane", "!ihtiyac", "!kumanya", "yardim", "kisi sayisi", "koli", "bagis"], t: ["yardim"], keys: ["yardım", "sosyal yardım", "gıda bankası"], modules: { tahsilat: false } }],
  ]],
  ["tarim", "Tarım ve hayvancılık", [
    ["tarim", "Tarım işletmesi", "parsel", "parseller", "Ziraat mühendisi", "Tarım işletmesi yönetimi", { general: true, h: ["!tarla", "!ekim", "!hasat", "!dekar", "!donum", "!gubre", "!ilaclama", "!sulama", "!tohum", "verim", "parsel", "~urun"], t: ["tarim", "tarla"], keys: ["tarım", "çiftçi", "ziraat"], modules: { tahsilat: false } }],
    ["hayvancilik", "Hayvancılık ve çiftlik", "hayvan", "hayvanlar", "Çiftlik sorumlusu", "Çiftlik yönetimi", { h: ["!kupe no", "!sagim", "!gebelik", "!tohumlama", "!buzagi", "!turkvet", "irk", "sut", "asi", "cinsiyet", "~agirlik"], t: ["hayvan", "ciftlik", "besi"], keys: ["hayvancılık", "çiftlik", "besi", "süt"], modules: { tahsilat: false } }],
    ["tarim-kooperatif", "Tarım kooperatifi", "ortak", "ortaklar", "Kooperatif sorumlusu", "Kooperatif yönetimi", { h: ["!ortaklik no", "!teslim miktari", "!kooperatif", "ortak", "hisse", "~kg"], t: ["kooperatif"], keys: ["kooperatif"] }],
    ["sera", "Sera ve fidancılık", "parti", "partiler", "Ziraat mühendisi", "Sera yönetimi", { h: ["!sera", "!fide", "!fidan", "!cesit", "dikim"], t: ["sera", "fidan"], keys: ["sera", "fidanlık"] }],
  ]],
  ["enerji", "Enerji ve çevre", [
    ["ges", "Güneş enerjisi (GES)", "proje", "projeler", "Mühendis", "Enerji projeleri yönetimi", { general: true, h: ["!kwp", "!kwh", "!inverter", "!ges", "!kurulu guc", "!mahsuplasma", "panel", "uretim", "~cati"], t: ["ges", "enerji", "solar"], keys: ["güneş enerjisi", "GES", "solar", "enerji"] }],
    ["elektrik", "Elektrik taahhüt ve tesisat", "iş", "işler", "Mühendis", "Taahhüt yönetimi", { h: ["!pano", "!trafo", "!kablo", "!sayac", "tesisat", "kesif", "abone no", "~proje"], t: ["elektrik"], keys: ["elektrik", "taahhüt", "elektrikçi"] }],
    ["dogalgaz", "Doğalgaz ve mekanik tesisat", "iş", "işler", "Mühendis", "Tesisat yönetimi", { h: ["!dogalgaz", "!kombi", "!proje onay", "!gaz acma", "!radyator", "tesisat", "~abone"], t: ["dogalgaz", "tesisat"], keys: ["doğalgaz", "kombi", "tesisat"] }],
    ["akaryakit", "Akaryakıt istasyonu", "işlem", "işlemler", "Vardiya sorumlusu", "İstasyon yönetimi", { h: ["!pompa", "!motorin", "!benzin", "!lpg", "litre", "yakit", "vardiya", "~plaka"], t: ["akaryakit", "istasyon"], keys: ["akaryakıt", "benzinlik", "istasyon"] }],
    ["atik", "Atık yönetimi ve geri dönüşüm", "sevkiyat", "sevkiyatlar", "Çevre sorumlusu", "Atık yönetimi", { h: ["!atik kodu", "!bertaraf", "!geri donusum", "!motat", "!uatf", "atik", "~ton"], v: [["^\\d{2} \\d{2} \\d{2}\\*?$", "atık kodları"]], t: ["atik", "geri donusum"], keys: ["atık", "geri dönüşüm", "çevre"] }],
    ["cevre-danismanlik", "Çevre danışmanlığı", "firma", "firmalar", "Çevre mühendisi", "Çevre danışmanlığı yönetimi", { h: ["!cevre izni", "!emisyon", "!ced", "olcum", "cevre", "~lisans"], t: ["cevre"], keys: ["çevre danışmanlığı", "ÇED"] }],
  ]],
  ["danismanlik", "Danışmanlık ve profesyonel hizmetler", [
    ["yonetim-danismanligi", "Yönetim danışmanlığı", "proje", "projeler", "Danışman", "Danışmanlık yönetimi", { general: true, h: ["!adam gun", "!faz", "!cikti", "danisman", "teklif", "sozlesme", "~musteri", "~proje"], t: ["danismanlik"], keys: ["danışmanlık", "consulting"] }],
    ["isg", "İş sağlığı ve güvenliği (OSGB)", "işyeri", "işyerleri", "İSG uzmanı", "İSG yönetimi", { h: ["!isg", "!is guvenligi", "!isyeri hekimi", "!tehlike sinifi", "!risk degerlendirmesi", "!periyodik kontrol", "!sgk sicil", "!osgb", "~egitim"], t: ["isg", "osgb"], keys: ["İSG", "OSGB", "iş güvenliği"] }],
    ["tercume", "Tercüme bürosu", "iş", "işler", "Tercüman", "Tercüme bürosu yönetimi", { h: ["!kaynak dil", "!hedef dil", "!tercuman", "!yeminli", "!noter onayi", "!apostil", "karakter", "~sayfa"], t: ["tercume", "ceviri"], keys: ["tercüme", "çeviri", "yeminli tercüman"] }],
    ["vize", "Vize ve yurt dışı danışmanlığı", "başvuru", "başvurular", "Danışman", "Vize danışmanlığı yönetimi", { h: ["!vize", "!konsolosluk", "pasaport", "ulke", "randevu", "basvuru tarihi"], t: ["vize"], keys: ["vize", "yurt dışı", "göç danışmanlığı"] }],
    ["yurtdisi-egitim", "Yurt dışı eğitim danışmanlığı", "öğrenci", "öğrenciler", "Danışman", "Eğitim danışmanlığı yönetimi", { h: ["!ielts", "!toefl", "!burs", "universite", "ulke", "program", "kabul", "basvuru"], t: ["yurt disi egitim"], keys: ["yurt dışı eğitim", "öğrenci danışmanlığı"] }],
    ["fotograf", "Fotoğraf ve video stüdyosu", "çekim", "çekimler", "Fotoğrafçı", "Stüdyo yönetimi", { h: ["!cekim tarihi", "!album", "!dis cekim", "cekim", "kapora", "paket", "~teslim"], t: ["cekim", "fotograf"], keys: ["fotoğraf", "stüdyo", "düğün fotoğrafçısı", "video"] }],
  ]],
  ["genel", "Genel", [
    ["genel", "Genel (sektörden bağımsız)", "kayıt", "kayıtlar", "Uzman", "Ofis yönetimi", { general: true, h: [], keys: ["genel", "diğer", "sektörsüz", "karma"] }],
    ["genel-musteri", "Müşteri ve iletişim listesi", "müşteri", "müşteriler", "Temsilci", "Müşteri yönetimi", { h: ["~musteri", "~firma", "~iletisim"], keys: ["müşteri listesi", "rehber", "iletişim listesi"] }],
    ["genel-envanter", "Envanter ve demirbaş", "demirbaş", "demirbaşlar", "Sorumlu", "Demirbaş yönetimi", { h: ["!demirbas", "!envanter no", "!garanti bitis", "zimmet", "seri no", "lokasyon", "~marka", "~model"], t: ["demirbas", "envanter"], keys: ["demirbaş", "envanter", "zimmet"], modules: { tahsilat: false } }],
    ["genel-randevu", "Randevu takibi", "randevu", "randevular", "Uzman", "Randevu yönetimi", { h: ["!randevu saati", "!randevu tarihi", "randevu", "hizmet", "~uzman"], t: ["randevu"], keys: ["randevu", "ajanda"] }],
    ["genel-uyelik", "Üyelik takibi", "üye", "üyeler", "Sorumlu", "Üyelik yönetimi", { h: ["!uye no", "uyelik", "uye"], t: ["uye"], keys: ["üyelik", "üye listesi"] }],
    ["genel-gorev", "Görev ve iş takibi", "iş", "işler", "Sorumlu", "İş takibi", { h: ["!gorev", "!son tarih", "sorumlu", "oncelik", "durum"], t: ["gorev", "is takibi", "yapilacak"], keys: ["görev", "iş takibi", "yapılacaklar"], modules: { tahsilat: false } }],
  ]],
];

// ---------- Derlenmiş liste ----------
const capitalize = value => (value ? value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1) : value);
const parseSignal = raw => {
  const prefix = raw[0] === "!" || raw[0] === "~" ? raw[0] : "";
  return { phrase: foldText(prefix ? raw.slice(1) : raw), base: WEIGHTS[prefix], raw: prefix ? raw.slice(1) : raw };
};

export const SECTORS = [];
export const SECTOR_GROUPS = [];
for (const [groupId, groupName, list] of GROUPS) {
  SECTOR_GROUPS.push({ id: groupId, name: groupName });
  for (const [id, name, record, records, expert, subtitle, options = {}] of list) {
    SECTORS.push({
      id,
      name,
      group: groupId,
      groupName,
      general: Boolean(options.general),
      vocab: { record, records, Record: capitalize(record), Records: capitalize(records), expert, subtitle },
      modules: { tahsilat: true, haciz: false, ...(options.modules || {}) },
      keys: options.keys || [],
      signals: {
        headers: (options.h || []).map(parseSignal),
        values: (options.v || []).map(([pattern, label]) => ({ re: new RegExp(pattern), label })),
        titles: (options.t || []).map(item => foldText(item)),
        roles: options.roles || {},
      },
    });
  }
}
const BY_ID = new Map(SECTORS.map(sector => [sector.id, sector]));
export const sectorById = id => BY_ID.get(String(id || "")) || null;
export const GENERAL_ID = "genel";
// 1.6.0 öncesi kurulumlar yalnızca hukuk ofisleri içindi; güncellemede arayüz aynen korunur.
export const LEGACY_ID = "hukuk-buro";

// Özgüllük: bir başlık ifadesi ne kadar çok sektörde geçiyorsa o kadar az ayırt edicidir.
const PHRASE_SECTORS = new Map();
for (const sector of SECTORS) {
  for (const signal of sector.signals.headers) {
    if (!PHRASE_SECTORS.has(signal.phrase)) PHRASE_SECTORS.set(signal.phrase, new Set());
    PHRASE_SECTORS.get(signal.phrase).add(sector.id);
  }
}
for (const sector of SECTORS) {
  for (const signal of sector.signals.headers) signal.weight = signal.base / Math.sqrt(PHRASE_SECTORS.get(signal.phrase).size);
}

// Seçici için sade liste (istemci arama ve gruplamayı kendisi yapar).
export function sectorCatalog() {
  return {
    groups: SECTOR_GROUPS.map(group => ({ ...group, sectors: SECTORS.filter(sector => sector.group === group.id).map(sector => ({ id: sector.id, name: sector.name, record: sector.vocab.records, expert: sector.vocab.expert, keys: sector.keys })) })),
  };
}

// ---------- Sınıflandırma ----------
const TEXT_ROLES = new Set(["text", "category", "status", "note", "org", "person", "responsible", "id"]);

/**
 * @param {{ analyses: Array<object>, rows: Array<Record<string,string>>, label?: string, tabs?: string[] }} input
 * @returns {{ suggestion: string, level: "high"|"medium"|"low", top: object|null, evidence: Array<object>, candidates: Array<object> }}
 */
export function classifySector({ analyses, rows, label = "", tabs = [] }) {
  const scores = new Map();
  const add = (sector, item) => {
    if (!scores.has(sector.id)) scores.set(sector.id, { sector, score: 0, evidence: [], columns: new Set(), strong: 0 });
    const entry = scores.get(sector.id);
    entry.score += item.weight;
    entry.evidence.push(item);
    if (item.column) entry.columns.add(item.column);
    if (item.base >= 3) entry.strong += 1;
  };

  // 1) Kolon başlıkları: her kolon, her sektöre en fazla bir kez (en güçlü eşleşmesiyle) katkı verir.
  const headerWords = analyses.map(item => ({ item, words: foldText(item.column).split(" ").filter(Boolean) }));
  for (const sector of SECTORS) {
    for (const { item, words } of headerWords) {
      if (item.role === "empty") continue;
      let best = null;
      for (const signal of sector.signals.headers) {
        if (!signal.phrase || !phraseAt(words, signal.phrase)) continue;
        if (!best || signal.weight > best.weight) best = signal;
      }
      if (best) add(sector, { kind: "header", column: item.column, signal: best.raw, weight: best.weight, base: best.base });
    }
  }

  // 2) Değerler: metin kolonlarından örnek; kalıp kolonun en az %10'unda görülmeli.
  const textColumns = analyses.filter(item => TEXT_ROLES.has(item.role) && item.stats.nonEmpty >= 3).map(item => item.column);
  if (textColumns.length) {
    const step = Math.max(1, Math.floor(rows.length / 1500));
    const samples = new Map(textColumns.map(column => [column, []]));
    for (let index = 0; index < rows.length; index += step) {
      for (const column of textColumns) {
        const value = rows[index][column];
        if (value && String(value).trim()) samples.get(column).push(foldText(value));
      }
    }
    for (const sector of SECTORS) {
      for (const signal of sector.signals.values) {
        for (const [column, values] of samples) {
          if (values.length < 3) continue;
          let hits = 0;
          for (const value of values) if (signal.re.test(value)) hits += 1;
          const share = hits / values.length;
          if (share >= 0.1) add(sector, { kind: "value", column, signal: signal.label, weight: share >= 0.3 ? 3 : 1.5, base: share >= 0.3 ? 3 : 1.5 });
        }
      }
    }
  }

  // 3) Doğrulanmış kolon türleri (ör. geçerli plakalar → araçla ilgili sektörler).
  const roleCount = {};
  for (const item of analyses) roleCount[item.role] = (roleCount[item.role] || 0) + 1;
  for (const sector of SECTORS) {
    for (const [role, weight] of Object.entries(sector.signals.roles)) {
      if (roleCount[role]) add(sector, { kind: "role", role, column: analyses.find(item => item.role === role)?.column, signal: role, weight, base: weight });
    }
  }

  // 4) Dosya ve sekme adları (zayıf kanıt, toplamda en fazla 1,5).
  const titleWords = [label.replace(/\.(xlsx?|csv)$/i, ""), ...tabs].map(text => foldText(text).split(" ").filter(Boolean));
  for (const sector of SECTORS) {
    const matched = sector.signals.titles.find(phrase => titleWords.some(words => phraseAt(words, phrase)));
    if (matched) add(sector, { kind: "title", signal: matched, weight: 1.5, base: 1.5 });
  }

  const ranked = [...scores.values()].filter(entry => entry.sector.id !== GENERAL_ID).sort((a, b) => b.score - a.score || a.sector.id.localeCompare(b.sector.id));
  const top = ranked[0] || null;
  const candidates = ranked.slice(0, 5).map(entry => ({ id: entry.sector.id, name: entry.sector.name, groupName: entry.sector.groupName, score: Math.round(entry.score * 10) / 10 }));
  if (!top) return { suggestion: GENERAL_ID, level: "low", top: null, evidence: [], candidates };

  // Rakip: başka bir gruptaki en güçlü sektör. "Genel" grubundaki şablonlar (üyelik, randevu…) rakip sayılmaz;
  // her sektörün verisinde bulunabilecek genel kelimelerle puan alırlar.
  const otherGroup = ranked.find(entry => entry.sector.group !== top.sector.group && entry.sector.group !== "genel");
  const sameGroup = ranked.find(entry => entry !== top && entry.sector.group === top.sector.group);
  const margin = otherGroup ? top.score / otherGroup.score : Infinity;
  const columns = top.columns.size;
  let level = "low";
  if (top.score >= 7 && columns >= 3 && top.strong >= 1 && margin >= 1.8) level = "high";
  else if (top.score >= 4 && columns >= 2 && margin >= 1.4) level = "medium";

  // Aynı gruptan iki sektör başa baş ise grubun genel sektörü önerilir (ör. icra mı dava mı belli değilse
  // "Hukuk bürosu"); grubun genel sektörü yoksa güven bir kademe düşer.
  let chosen = top.sector;
  if (level !== "low" && sameGroup && sameGroup.score >= top.score * 0.8) {
    const general = SECTORS.find(sector => sector.group === top.sector.group && sector.general);
    if (general && general.id !== top.sector.id) chosen = general;
    else if (!general) level = level === "high" ? "medium" : "low";
  }
  const evidence = top.evidence
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map(({ kind, column, signal, role }) => ({ kind, column: column || null, signal, role: role || null }));
  return {
    suggestion: level === "low" ? GENERAL_ID : chosen.id,
    level,
    top: { id: top.sector.id, name: top.sector.name, score: Math.round(top.score * 10) / 10, columns, strong: top.strong },
    evidence,
    candidates,
  };
}
