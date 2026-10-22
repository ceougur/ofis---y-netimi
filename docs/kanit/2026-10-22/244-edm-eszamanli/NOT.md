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
