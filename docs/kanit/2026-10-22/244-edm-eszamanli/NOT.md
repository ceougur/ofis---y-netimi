# 2.4.4 iş listesi 24b — eşzamanlı e-SMM (20 + 10) gerçek EDM test ortamı düzeneği

Kullanıcı isteği (22.10.2026): "aynı anda 20-30 tane e-SMM kesip EDM'ye gönderip sonuçlarını kontrol eder misin". Düzeneği ajan yazdı ve sahte EDM'de (kuru) doğruladı;
gerçek EDM koşusunu ANA OTURUM yapar (kimlik bilgisi yalnız ortam değişkeninde). Düzenek: `tools/edm-gercek.mjs --eszamanli` (adımlar `ya`–`yf`).

## Nasıl bozulur? (ÖNCE yazıldı; testler ve değişmezler bu listeden)

| # | Bozulma | Nereden çıkar | Düzenekte hangi denetim yakalar |
|---|---|---|---|
| N1 | Eşzamanlı numara: iki istek aynı TES numarasını alır ya da numara atlanır (seride boşluk) | numara verme işlem (BEGIN IMMEDIATE) dışına taşınır; "EDM'ye ulaşılamadı → numarayı geri bırak" serinin son numarası olmayan belgede çalışır | yf: TES tekil + ardışık + önceki serinin MAX+1'den başlar, sonra başka numara yok; 5xx yok (UNIQUE dizini çiftte 500 verir) |
| N2 | Kayıp belge: istek "tamam" döner ama belge veri tabanında yok, ya da var ama gönderilmemiş ve Gönderilecekler'de görünmüyor (sessiz kayıp) | yarış, yakalanmamış hata, yanıt kaybı | yf: işaretli notla veri tabanında TAM 30 belge, id'ler yanıtlarla aynı; ye: her belge EDM'de |
| N3 | Çift belge / çift gönderim: aynı form iki belge açar; aynı belge EDM'ye iki kez gider (11048 → yanlış "Hata"); iki oturum aynı belgeyi gönderir | istek kimliği, gönderim kilidi (holdInvoice) | yf: 30 belge (fazlası yok), her belgede TAM bir `invoice.e.sent` olayı, 11048 yok; kuru: sahte EDM'de gönderilen ID'ler tekil |
| N4 | Aynı anda N giriş: oturum önbelleği boşken (sabah ilk gönderim, program yeniden açıldı, 20 dk boşta) 20 istek aynı anda Login yapar; EDM yeni girişte eski oturumu düşürürse istekler 10011 zinciriyle düşer; hesap kilidi / hız sınırı | edm.mjs ensureSession/withSession tek uçuş (single-flight) değil | BİLGİ: program Login sayısı + en çok eşzamanlı Login (ya soğuk başlar: önbellek boşaltılır — `--sicak` ile kapatılır); kuru `--ariza tek-oturum` keşif |
| N5 | EDM yavaş ya da kopuk: SendSMM 5–30 sn; arayüzün 30 sn zaman aşımı; EDM aldı ama yanıt gelmedi | ağ / EDM yükü | ya: her istek kesin yanıt (düzenek zaman aşımı gerçek 150 sn, kuru 20 sn); BİLGİ: istek süreleri, 30 sn'yi aşan istek sayısı (arayüz "sunucuda sürüyor olabilir" derdi) |
| N6 | Belirsiz gönderim: "Sonucu Belirsiz" belge Tümünü Gönder'de durum sorulmadan yeniden gönderilir → 11048 → yanlış "Hata" | uncertainSend yolu | yf: 11048 yok, her belgede tek `invoice.e.sent`; yc: son durum Kabul |
| N7 | Numaralı ama EDM'de olmayan belge: program "gönderildi" der, EDM'de yok — ya da EDM'de var, program "Gönderilmedi" der | yanıt eşleme, kayıp | ye: BAĞIMSIZ OKUYUCU (programın EDM istemcisinden ayrı; EDM belgesindeki GetSMM örneğinden yazıldı) her ETTN'i EDM'de arar, EDM'nin kaydındaki numarayı programınkiyle karşılaştırır |
| N8 | 5xx / askıda kalan istek; SQLite "database is locked"; yakalanmamış hata | eşzamanlı yazım | ya/yb: her yanıt 200 (yetkisiz 403), süre ≤ zaman aşımı |
| N9 | İki oturum aynı anda Tümünü Gönder: belge öbür oturumda gönderilirken bu oturum da gönderir; sıra bozulur; "gönderiliyor" (busy) belgeler sessizce kalır | send-pending tur kilidi, releasedWithin | yb: iki kullanıcı AYNI ANDA Tümünü Gönder (arayüzün döngüsüyle); sonunda Gönderilecekler'de bu 10'dan belge kalmaz (en çok 2 yeniden basış — ürün iletisi "yeniden basın" der), her belge tek gönderim |
| N10 | Gönderim sırasında Kes, Sonra Gönder: tur sürerken yeni bekleyen eklenir — numara alıp eski bekleyeni kalıcı engele düşürür | O1 kronoloji | ya: B'nin 10 "Kes, Sonra Gönder"i A'nın 20 "Kaydet ve Gönder"iyle AYNI istek dalgasında (2 A : 1 B karışık sıra) — numara ALMAMALI; A'nın numaraları ardışık kalmalı (yf). DENENMEDİ: Tümünü Gönder turu sürerken yeni kayıt |
| N11 | Durum sorgusu yarışı: Durum Sorgula gönderim/numara verme sürerken gelir; "bulunamadı" ile numara boşaltılır, sonra gönderim başarılı döner, durum ezilir | e-refresh kilitsiz | yb: Tümünü Gönder sürerken yönetici A belgelerine AYNI ANDA Durum Sorgula |
| N12 | EDM numarayı değiştirir / bir belgeyi başka numarayla kaydeder (çift kayıt) | entegratör | ye: bağımsız okuyucu (kuru `--ariza cift`: sahte EDM yanıtta doğru numarayı verip kaydı başka numarayla tutar → program görmez, düzenek KIRMIZI) |
| N13 | Gece yarısı (ders 22): koşu TR gece yarısını geçer → belgeler iki güne bölünür | saat | koşu sonunda gün değiştiyse çıkış 4 GEÇERSİZ; yf: belge tarihleri koşu günü |
| N14 | Ortak test hesabı: başka firma aynı anda TES numarası kullanır → 11048 (bizim hatamız değil) | EDM test hesabı ortak | h: hata kodları listesinde 11048 ayrı görünür; numara serisi rastgele büyük başlar |
| N15 | Yetkisiz kullanıcı eşzamanlı istekte belge keser / numara harcar | yetki | ya: yetkisiz (personel) istek 403, numara harcanmaz (N1'in ardışıklık denetimi) |
| N16 | Kişi alıcıya (TCKN, stopajsız) e-SMM şemaya uymaz (EDM 11029 — gercek-4'te düzenleyende görüldü) | ubl-tr Person | yf: bir VKN'li ve bir TCKN'li makbuzun UBL'i GİB UBL-TR 1.2.1 XSD'sine uygun; stopaj kuralı: VKN → %20, TCKN → 0 (talimattan) |

Testin dişi (ders 7/20/38): kuru koşuda sahte EDM'ye hata enjekte edilir (`--ariza kayip | cift | durum | aski`); düzenek her birinde KIRMIZI vermeli ve
nedeni iletiden okunmalı. Zorla araya girme (`--zorla`): sahte EDM SendSMM ve Login yanıtlarını geciktirir; yeşil yalnız ön koşul gerçekten oluşunca
(sahte EDM'de en çok eşzamanlı SendSMM ≥ 10, soğuk başta eşzamanlı Login ≥ 2) sayılır.

## Gerçek koşu (ANA OTURUM; kimlik yalnız ortam değişkeninde, hiçbir dosyaya girmez)

    cd /home/user/wt/edm-eszamanli && HUKUK_LICENSE_URL=http://127.0.0.1:9 EDM_TEST_KULLANICI=… EDM_TEST_PAROLA=… \
      node tools/kanit.mjs kos 244-edm-eszamanli/gercek -- node --disable-warning=ExperimentalWarning tools/edm-gercek.mjs --gercek --eszamanli

Çıktı `docs/kanit/<gün>/244-edm-eszamanli/gercek/` (OZET.md: 30 belgenin tablosu — aşama, oturum, Belge No, ETTN, tarih/saat, alıcı türü, tutarlar, EDM son durumu,
bağımsız okuyucunun EDM'den okuduğu numara). Varsayılan SOĞUK başlangıç: programın EDM önbelleği boşaltılır → 20 istek aynı anda Login dener (N4'ün ön koşulu);
istenmezse `--sicak`. Eşzamanlı istekte EDM girişi REDDEDİLİRSE betik Tümünü Gönder / Durum Sorgula yapmadan durur (çıkış 2). Belgeler iptal edilmez. Süre tahmini
5–10 dk (gece yarısını geçerse çıkış 4, GEÇERSİZ). Gerçek EDM'de İLK KEZ denenecekler: TCKN'li KİŞİYE e-SMM (10 belge; kuruda UBL-TR XSD'sine uygun), EDM'ye aynı anda
20 Login ve 20 SendSMM, okuyucunun GetSMM HEADER_ONLY "Y" biçimi (reddedilirse programın kanıtlı "N" biçimine bir kez döner).

## Kuru koşu ve testin dişi (commit 02a6acd; kanıtlar bu klasörde, `node tools/kanit.mjs kos` ile)

| Koşu | Sonuç | Neden (iletiden) |
|---|---|---|
| kuru-kosu (`--kuru --eszamanli`) | 134/134, çıkış 0 | — |
| kuru-zorla (`--zorla`) | 136/136, çıkış 0 | ön koşul GERÇEKTEN oluştu: sahte EDM'de 20 SendSMM ve 20 Login aynı anda |
| disi-kayip (`--ariza kayip`) | 129/134, çıkış 1 | ye: "A01 …: EDM'de 0 kayıt", "numaralı ama EDM'de olmayan belge: 1 — A01 … programda sent" (+ yb/yc/yd aynı belge) |
| disi-cift (`--ariza cift`) | 132/134, çıkış 1 | ye: "EDM'deki numara TES…730" (program …726) — program görmedi, bağımsız okuyucu gördü; sahte EDM defteri 29/30 tekil |
| disi-durum (`--ariza durum`) | 132/134, çıkış 1 | yc: "EDM son durum error (PACKAGE - FAIL)" (+ yd resmî görüntü 409) |
| disi-aski (`--ariza aski --zaman-asimi 3000`) | 133/134, çıkış 1 | ya: "A01 … ASKIDA: 3 sn içinde yanıt yok" — yalnız o; belge veri tabanından izlenir, öbür değişmezler geçer |
| mutasyon-M1-numara-boslugu (programda nextNumber TES'te +1 atlar; ayrı kopya) | 133/134, çıkış 1 | yf: "TES numaraları … boşluk 29" |
| mutasyon-M2-numara-yarisi (programda numara EDM girişini BEKLEMEDEN önce okunur; ayrı kopya, `--zorla`) | 75/97, çıkış 1 | ya: 19 × "HTTP 500" (UNIQUE dizini), yf: "TAM 30 belge (bulunan 11)" |
| kesif-tek-oturum-zorla (`--ariza tek-oturum`: Login öbür oturumları düşürür — EDM'nin bu davranışı DOĞRULANMADI) | 117/136, çıkış 1 | KEŞİF (aşağıda N4) |
| duzenek-testi (test/edm-gercek-duzenek.test.mjs) | 16/16 | kuru zorla + 4 arıza + seçenek güvenceleri + okuyucu + yardımcılar |
| komsu-birim (sahte EDM'yi kullanan e-SMM / e-Belge testleri + lisans izolasyonu + platform + kanıt aracı) | 221/221 | — |
| e2e-gg244-esmm-gonder (sahte e-SMM'yi kullanan ekran senaryosu) | 34/34 | — |

## Bulgu adayı (program; kuruda kanıtlandı, gerçek koşu karar verir)

N4 — eşzamanlı giriş tek uçuş değil: `server/lib/einvoice/edm.mjs` edmTransport `ensureSession` / `withSession` oturum önbelleği boşken her eşzamanlı çağrıda ayrı
`login()` yapar (kuru-zorla: 20 gönderim → 20 Login aynı anda). EDM her girişe ayrı oturum veriyorsa zararsız (sahte EDM varsayılanı; kayıp yok). EDM yeni girişte
eski oturumu DÜŞÜRÜYORSA (kesif-tek-oturum-zorla): 20 Kaydet ve Gönder'in 18'i "EDM oturumu sona ermiş" (integrator-session) ile numaralı ve gönderilmemiş
Gönderilecekler'e düşer — KAYIP YOK, ileti doğru, Tümünü Gönder hepsini gönderir, numaralar ardışık; ama kullanıcı 18 hata görür. Gerçek koşuda `ya`daki
integrator-session sayısı EDM'nin davranışını söyler. Öneri (karar ana oturumda; EDM bağlantısı kritik alan → kırmızı test + dar kontrol): oturum anahtarı başına
tek uçuş giriş (bekleyen giriş sözünü eşzamanlı çağıranlar paylaşır) — 20 giriş 1'e iner. Programda kayıp / çift / atlanan numara, 5xx, askı, yakalanmamış hata
GÖRÜLMEDİ (kuru, zorla dahil).

## DENENMEYEN / BİLİNEN SINIRLAR

- Gerçek EDM test ortamı bu ajanda KOŞULMADI (kimlik yalnız ana oturumda; gerçek EDM'ye bağlanılmadı). EDM'nin eşzamanlı Login / hız sınırı davranışı bilinmiyor.
- Tümünü Gönder turu SÜRERKEN yeni Kes, Sonra Gönder (N10'un ikinci yarısı); gönderim sürerken Kes, Sonra Gönder ise denendi (ya, aynı dalga).
- Gece yarısı (N13) yalnız çıkış 4 güvencesiyle; zorla gece yarısı üretilmedi. Arayüzden (tarayıcı) eşzamanlılık yok — istekler programın API'sinden (ekranın uçları).
- Aynı gün içinde saat ↔ numara ters komşu: BİLGİ (saat dakika çözünürlüğünde; GİB sıra kuralı tarih düzeyinde) — denetim değil.
- Kâhin: tutarlar karşılaştırılmadı (yalnız talimattaki stopaj kuralı: VKN %20, TCKN 0); TES ardışıklığı ve EDM numarası kuraldan.
- Mutasyon kopyalarında node_modules çalışma ağacına bağlandı (genel klasöre değil, npm ci koşulmadı; ders 29).

## N4 düzeltmesi — tek uçuş giriş (baş mimar kararı 22.10.2026, gerçek koşudan sonra)

Gerçek EDM (ana oturum, 16:41 TR, 0289fe3, soğuk): Login 20 (en çok 18 aynı anda); A03'ün girişini EDM "The caller was not authenticated by the service." ile
reddetti (aynı kimlikle 19 giriş başarılı → kimlik yanlış değil, eşzamanlı giriş). Kural: `server/lib/einvoice/edm.mjs` edmTransport'ta oturum anahtarı başına TEK
UÇUŞ giriş (withSession, ensureSession, test aynı bekleyen girişi bekler; bitince kayıt silinir; başarısızlık bütün bekleyenlere aynı hata — B3: numara ancak giriş
başarılıysa); sessionExpired yeniden denemesinde önbellek YALNIZ hata veren oturumu tutuyorsa silinir, daha yeni geçerli oturum varsa girişsiz o kullanılır. e-Fatura
ve e-SMM (aynı taşıma katmanı).

### Nasıl bozulur? (ÖNCE yazıldı; testler buradan)

| # | Bozulma | Test |
|---|---|---|
| T1 | Soğuk önbellekte 20 eşzamanlı çağrı hâlâ 20 giriş yapar (tek uçuş yok / yalnız bir yolda var) | 20 eşzamanlı gönderim, ensureSession ve e-Fatura mükellef sorgusu → Login 1 |
| T2 | Bekleyen giriş başarısız olunca kayıt kalır: sonraki her çağrı eski reddi alır, hiç yeniden denenmez | 5 eşzamanlı çağrı reddedilir (tek Login), SONRAKİ çağrı yeniden giriş yapar |
| T3 | Başarısızlık bekleyenlerden birine ulaşmaz (asılı kalır) ya da birinde başarı sayılır (B3: numara verilir) | 5 bekleyenin hepsi aynı kodla reddedilir; düzenekte numara verilmez |
| T4 | Giriş sürerken parola değişir → yeni parolanın çağrısı eski parolanın girişini bekler (yanlış hesapla oturum) | farklı anahtar: iki ayrı giriş, her biri kendi kimliğiyle |
| T5 | Giriş askıda kalır → bekleyenler sonsuza dek bekler | zaman aşımı bütün bekleyenlere döner; kayıt silinir, sonraki çağrı yeni giriş |
| T6 | Tek oturumlu EDM: yeniden giriş öbür oturumu düşürür, eşzamanlı yeniden girişler birbirini düşürür (zincir) | oturum EDM'de düşmüşken 20 eşzamanlı gönderim → yeniden giriş 1, 20/20 iletildi |
| T7 | sessionExpired'de önbellek koşulsuz silinir → başka çağıranın yeni oturumu silinip gereksiz giriş | önbellekte daha yeni oturum varken giriş yapılmaz |
| T8 | Bağlantıyı Test Et ile gönderim aynı anda: iki giriş | test() + gönderim aynı anda → Login 1 |
| T9 | resetEdmCaches bekleyen girişi temizlemez (testler arası sızıntı) | resetEdmCaches sonrası yeni giriş |
| T10 | Düzenekte (gerçek akış): eşzamanlı ikinci giriş EDM'ce reddedilir → belge Gönderilecekler'e | sahte EDM arızası `es-giris` → eski kodda belge Gönderilecekler'de, yenide 20/20 |
