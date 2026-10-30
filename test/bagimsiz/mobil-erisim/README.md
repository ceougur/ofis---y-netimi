# Mobil Uzaktan Erişim — Temiz Oda Kâhini (2.4.7 M2 + M3/M4 erişim denetimi)

Bu klasör 2.4.7'deki **karekodlu cihaz eşleme, 3 cihaz sınırı, cihaz silme** (M2) ile **kapıcı (Worker), şifreli özet ve
tünelin erişim denetimi** (M3/M4'ün güvenlik sınırları) için bağımsız kâhindir. Para hesabı YOKTUR (o M5 kâhininde).

Kâhin programın kodu (server/, client/, packaging/, tools/ ve test/ altındaki program testleri; edm-sayac'ın sürücüleri dahil)
**görülmeden**, yalnız karar metninden yazıldı (CLAUDE.md ders 5, KANIT KURALI 2). Kaynaklar:

- CLAUDE.md → Açık iş: "MOBİL", "KARAR (kullanıcı, 26.10.2026, mobil)" ×3 (yöntem; 3 cihaz ve NETLEŞTİ hâli), 2.4.3 kararı "Anlık Durum yalnız yönetici"
- `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.1 (MOBİL)
- `docs/PRO-UZAKTAN-GORUNTULEME.md` (mimari geçerli; Pro kilidi / Standart-Pro maddeleri 26.10 kararıyla GEÇERSİZ)
- `docs/2.4.7-IS-LISTESI.md` → M2/M3/M4 satırları, "Nasıl bozulur?", "Mobil dalga 2 riskleri"
- Ana oturumun verdiği ürün kuralı: şirket görüntüleme yetkisi kullanıcı × şirket; yönetici her şirketi görür; hiçbir şirket
  kutusu işaretli olmayan kullanıcı yalnız 001'i görür; roller/yetkiler her şirkette aynı.

Metnin sustuğu her noktada kâhin **karar vermedi** (ders 40, 43): büyük sorular parametre (P1–P13, "AÇIK SORULAR"), küçük
noktalar ya "ikisi de olur" diye açık bırakıldı (beklenen sonuç `kabul|ret:x`) ya da açıkça yazılmış okuma (V…) oldu.
`kabul.json` → `secilen_birlesim` **boş** (kullanıcı kararı bekleniyor); karşılaştırma o gelene dek öneri birleşimiyle yapılır:

```
kod_sure=5;yeni_kod_eskiyi=iptal_eder;sinir_dolunca=reddet;uretimde_sinir=denetler;sinir_dusunce=mevcutlar_kalir;
cihaz_kullanici=yalniz_eslenen;oturum_bosta=15;oturum_mutlak=12;lisans_onbellek=1;ozet_yas_siniri=yok;deneme_siniri=5;
deneme_anahtari=kullanici;kilit_dk=15
```

## Dosyalar

| Dosya | İçerik |
|---|---|
| `kahin.py` | Model (yalnız standart kütüphane) + komut satırı (`hesapla`, `karsilastir`, `parametreler`) |
| `senaryolar.py` | 33 elle yazılmış uç senaryo (U01–U33, beklenenler ELLE) + tohum 1–3 rastgele üretici (R1–R3, akışın kendi beklentisi); `kabul.json`'u yazar |
| `kabul.json` | 36 senaryo, 2.242 olay. Elle senaryolarda karar ağacının bütün yaprakları (68), rastgelelerde 25 birleşimin birleşik sonuç kümesi + öneri çıktısı |
| `kahin_test.py` | Kâhinin kendi testi (A–E) + 55 mutasyon (F); TAP + `# tests/pass/fail` |
| `kanit/` | `tools/kanit.mjs kos` kayıtları (çıkış kodu, sayılar, ham çıktı, commit); `kanit/<gün>/kirmizi-*` bilerek bozuk modelle kırmızı kanıt |

## Nasıl koşulur

```sh
python3 -I test/bagimsiz/mobil-erisim/senaryolar.py             # kabul.json'u yeniden üretir (model ≠ elle/üretici → yazmaz, çıkış 1)
python3 -I test/bagimsiz/mobil-erisim/senaryolar.py --denetim   # yalnız denetim, dosya yazılmaz
KANIT_DIR=test/bagimsiz/mobil-erisim/kanit node tools/kanit.mjs kos mobil-kahin -- python3 -I test/bagimsiz/mobil-erisim/kahin_test.py
MOBIL_KAHIN_MUT=M06 python3 -I test/bagimsiz/mobil-erisim/kahin_test.py   # bilerek bozuk model → kırmızı olmalı
python3 -I test/bagimsiz/mobil-erisim/kahin.py hesapla senaryo.json [--birlesim "k=v;…"]
python3 -I test/bagimsiz/mobil-erisim/kahin.py karsilastir test/bagimsiz/mobil-erisim/kabul.json program.json [--birlesim "k=v;…"]
```

Python 3.11+ (geliştirmede 3.13). `-I` ile koşar; modüller kendi klasörlerinden açık yolla yüklenir, `__pycache__` yazılmaz.
Kendi testi ~75 sn (55 mutasyonun her biri bütün senaryoları yeniden koşar).

## Kurallar (metinden; K…)

| No | Alıntı / kaynak | Modeldeki karşılığı |
|---|---|---|
| K1 | "EŞLEME: Yönetim'de bir kart, karekod okut → eşleş" (devir §3.1) | `karekod_uret` (program, yerel) → `esle` (cihaz, kapıcı üzerinden) |
| K2 | "Yönetici 'Cihaz ekle' → … QR" (PRO-UZAKTAN) | Karekodu, cihazı silmeyi, kullanıcı iznini yalnız yönetici yapar → `yetki_yok` |
| K3 | "kullanıcı başına 'Uzaktan bağlanabilir' kutusu. İşaretsiz olan için QR üretilemez" | `uzaktan_izni_yok` |
| K4 | "tek kullanımlık, birkaç dakika geçerli QR" | Kullanılmış kod `kod_gecersiz`; süre P1 |
| K5 | "eşlenmiş cihazın yalnız kendi ofisinin dosyasını okumasına izin verir" | Kod ve cihaz ofise aittir; başka ofiste `kod_gecersiz` / `cihaz_yok` |
| K6 | "Giriş: DestekOfis kullanıcı adı/parolası" | Canlı bağlantıda `giris` |
| K7 | "Cloudflare Access KULLANILMAZ"; "Worker kapıcı cihaz yetkisini denetler" | Her uzak istekte önce kapıcı: cihaz eşli + bu ofisin + silinmemiş |
| K8 | "PRO YOK … Mobil HERKESE" (devir §3.1) | Lisansın `plan` alanı sonucu değiştirmez (U01 Standart lisans) |
| K9 | "Yeniden eşleme gereken durumlar: … yönetici cihazı ya da izni kaldırır, … lisans biter (yenilenince eşlemeler geri gelecek). Gerekmeyenler: … başka cihaz silinir, … sunucu günlerce kapalı kalır" | İzin kalkınca kullanıcının cihazları ve bekleyen kodları düşer; lisans bitince eşleme kalır, yenilenince erişim döner |
| K10 | "Program başına (iki şirket birlikte) en çok 3 EŞLİ UZAKTAN CİHAZ … Lisansta sayı alanı (varsayılan 3)" | Sınır = lisansın `cihaz_siniri` (yoksa 3) |
| K11 | "telefon, tablet, uzak tarayıcı hepsi sayılır. Kullanıcı sayısı ayrıca sınırlanmaz"; "Nasıl bozulur?": "iki şirket arasında cihaz sayısı ayrı sayılır" | Sayı ofisin bütün etkin cihazları; tür ve kullanıcı ayrımı yok |
| K12 | "Cihaz silinince yer açılır" | Silinen cihaz sayılmaz |
| K13 | "Sınır programda VE kapıcıda (Worker) uygulanır" | `kapici_dogrudan_kayit` (program atlatılırsa) kapıcıda da reddedilir |
| K14 | "Lisans süresi biter ya da engellenirse sunucu yüklemeyi durdurur, Worker o ofisin dosyasını vermez" | Geçersiz lisansta özet okuma/yükleme, giriş, istek, eşleme `lisans_gecersiz` |
| K15 | Görev: "kapıcı eski lisans önbelleğini sonsuza dek kabul etmez"; "Nasıl bozulur?": "kapıcı lisansı eski önbellekten kabul eder" | Önbellek en çok P9 kadar eski; servis yoksa P9'dan sonra `lisans_dogrulanamadi` (kapalı-kalır) |
| K16 | "Uzak oturum kısa ömürlü ve cihaza bağlı" (dalga 2 riskleri 3) | Boşta P7, mutlak P8; başka cihazdan `oturum_gecersiz` |
| K17 | "Nasıl bozulur?": "cihaz silinince açık oturum sürer"; M2: "cihaz silme → erişim kesilir" | Silme anında cihazın her isteği `cihaz_yok`, oturumları biter |
| K18 | "Tünel yalnız `/mobil/` ve `/api/mobil/` geçirir; … başka her yol uzakta reddedilir" | `yol_yasak` (kodlanmış `..`, önek hilesi, büyük harf, ters bölü, çift bölü dahil) |
| K19 | "Tünelde istekler 127.0.0.1'den gelir: giriş deneme sınırı ve yerel kurtarma kodu (`/api/auth/recovery/local-code`) uzaktan 'yerel' sanılmamalı" | Görünen adres ve `X-Forwarded-For` vb. yok sayılır; deneme sınırı uygulanır; kurtarma yolu `yol_yasak` |
| K20 | "Sunucu kapalıyken telefonda son hâl görünür; yalnız tahsilat girilemez" | Özet okunur; canlı istek, yazma, giriş, eşleme `sunucu_kapali` |
| K21 | Ürün kuralı (yukarıda) + "Anlık Durum yalnız yönetici" (CLAUDE.md 2.4.3) | Canlıda ve özette aynı kural; `yetki_yok`, olmayan şirket `sirket_yok` |
| K22 | "Worker (kapıcı): yalnız lisanslı … sunucunun yazmasına" izin verir | Cihazın özete yazması `yazma_yasak` |
| K23 | "yetkisiz kullanıcı yetkisiz şirketi/raporu/kasayı göremez" (görev) + özet şifreli, telefon kendi içinde çözer | Özette görünen içerik cihazın eşlendiği kullanıcının GÜNCEL yetkisini aşamaz |

## Varsayımlar (V…; metin söylemiyor, kâhinin okuması — program ayrışırsa önce hata sayılır, sonra sorulur: ders 6, 40)

- **V1** Saat Türkiye yerel saati, sabit UTC+3; ofsetsiz saat TR; `Z`/`+00:00` çevrilir. Model "bugün"ü hiç okumaz (ders 13, 22).
- **V2** Aynı anda olaylar: sınıf sırası bakım (lisans, sunucu) → yönetim (kullanıcı, silme, karekod, özet yükleme) → eşleme → giriş →
  istek/özet okuma; sınıf içinde olay numarası (ders 31). `grup` etiketli olaylar GERÇEKTEN eşzamanlıdır: bütün sıralamaları
  denenir, beklenen ortak sonuç kümesi `gruplar`'dadır (U22, U23).
- **V3** Süre dolduğu an geçersizdir: karekod (üretim + P1), oturum boşta (son istek + P7) ve mutlak (giriş + P8), lisans bitiş anı.
- **V4** Eşleme sunucu açıkken olur (program kaydı ve program tarafı sınır gerekir); kapalıyken `sunucu_kapali`, kod harcanmaz (U31).
- **V5** "En eski cihaz" eşleme anına göre; eşit anda cihaz kimliği.
- **V6** Her eşleme yeni cihaz kimliği üretir; aynı kimlik ikinci kez kullanılmaz (girdi kuralı). Karekod etiketi ofiste, oturum etiketi
  senaryoda tekildir.
- **V7** Sınır dolu reddinde kodun harcanıp harcanmadığı belirsiz: iki dünya (kod süresi dolana dek).
- **V8** Program cihaz silme ve izin değişikliğini lisanstan bağımsız yapar.
- **V9** Kapıcının lisans görünümü: (t − P9, t] içinde servisin erişilebilir olduğu HERHANGİ bir andaki kayıt (ne zaman tazelediğini
  metin söylemez). Servis şu an erişilemezse "doğrulanamadı" da olasıdır; pencerede hiç erişim yoksa yalnız o. Kayıttaki bitiş
  tarihi her durumda uygulanır. Pencere içindeki istek "ikisi de olur" (`kabul|ret:lisans_gecersiz`) — kâhin karar vermez.
- **V10** Programın lisans görünümü: son "Lisansı Şimdi Denetle"den (`program_lisans_denetle`) bu yana herhangi bir kayıt. Etkili sınır =
  min(program, kapıcı). Sınır bu yüzden belirsizse eşleme girdi hatasıdır (senaryo denetim + P9'dan uzun bekleme yazar).
- **V11** Program karekod üretirken lisansı denetler mi, metin söylemez: geçersiz görünümde kabul de ret de olur (iki dünya).
- **V12** Eşleme, silme ve yetki değişikliği özeti yeniden yazar (Eylül: "veri anahtarı yenilenir"). "Son güncelleme" anı yenilenebilir de
  yenilenmeyebilir de → `ozet_zamani` izin verilen küme. Görünen içerik: üst sınır = GÜNCEL yetki (K23), alt sınır = güncel ∩ son açık
  yüklemedeki görünüm.
- **V13** Sunucu yeniden açılınca eski uzak oturumun sürüp sürmediği belirsiz (`kabul|ret:oturum_gecersiz`).
- **V14** Aynı cihazda yeni giriş eski oturumu kapatır mı belirsiz.
- **V15** Deneme sayacı: ardışık yanlış parola; P11'inci yanlış kilidi başlatır (o deneme `parola_yanlis`), kilit P13 dk; kilitliyken her
  deneme (doğru parola dahil) `deneme_siniri` ve sayılmaz; başarılı giriş sayacı sıfırlar; parolası doğru ama izni olmayan giriş
  sayılmaz; zaman penceresi yok (senaryolarda denemeler ardışık).
- **V16** Ret önceliği. Uzak istek: cihaz → lisans → sınır aşımı (P5) → yol → sunucu → (sayfa dosyası oturumsuz kabul) → oturum → şirket →
  yetki. Eşleme: lisans → sunucu → kod → izin → sınır. Giriş: cihaz → lisans → sınır aşımı → sunucu → cihaz-kullanıcı (P6) → kilit →
  parola → izin. Özet okuma: cihaz → lisans → sınır aşımı → özet var mı → yaş (P10). Ret sınıfı farkı **İNCELE**, kabul ↔ ret farkı **BULGU**.
- **V17** Oturum kontrolünden geçen her istek (yetki reddi dahil) boşta süresini yeniler; `/mobil/` sayfa dosyaları oturumsuz açılır.
- **V18** Özet bölümleri Eylül listesi: kasa, cari, stok, taksit, Anlık Durum. `rapor:<id>` yetkileri özette bölüm değildir.
- **V19** Lisanstaki sayı düşünce fazla cihaz SİLİNMEZ (P5 yalnız durdurur ya da bırakır).
- **V20** Yerel (ofis içi) istekler bu kâhinin kapsamı dışındadır; olay dilinde yoktur.
- **V21** Silinen ya da izni kalkan cihazın önceden indirip çözdüğü özet telefonda kalabilir (Eylül: "bir sonraki güncellemeden itibaren
  hiçbir şey açamaz"). Kâhin yalnız kapıcının yanıtını gözler.

## AÇIK SORULAR (kullanıcıya sorulacak; kâhin karar vermedi — ders 40, 43)

Her soru bir parametredir; `kabul.json` her senaryoda bütün seçeneklerin beklenen sonucunu taşır. Öneriler en yaygın uygulamaya göredir.

| # | Soru | Seçenekler | Öneri ve gerekçe |
|---|---|---|---|
| P1 | Karekod kaç dakika geçerli? | 2 · 5 · 10 dk | **5 dk** — metin "birkaç dakika"; OWASP ASVS 4.0.3 §2.7.2 bant dışı kodlar için üst sınır 10 dk; WhatsApp/Signal cihaz bağlama karekodları kısa ömürlü ve yenilenir. Kart açıkken "Yeni Karekod" ile yenilenir. |
| P2 | Aynı kişiye ikinci karekod üretilince ilki geçersiz olsun mu? | evet · hayır | **Evet** — kişi başına tek geçerli karekod; ekranda / fotoğrafta unutulan eski kod saldırı yüzeyidir. |
| P3 | 3 cihaz doluyken yeni eşleme | reddedilir ("önce birini silin") · en eski cihaz kendiliğinden düşer | **Reddedilir** — metin "cihaz silinince yer açılır" yöneticinin silmesini anlatır; kendiliğinden düşürme, ele geçmiş bir karekodla meşru cihazı sessizce atar. Yayın/müzik uygulamalarının cihaz sınırları da böyledir. |
| P4 | Sınır doluyken karekod üretilsin mi? | hayır, kartta uyarı · üretilsin, eşlemede reddedilsin | **Hayır, kartta "3 cihaz dolu" uyarısı** — erken ve anlaşılır; eşleme anındaki denetim her iki seçenekte de vardır. |
| P5 | Operatör lisanstaki sayıyı mevcut cihazın altına düşürürse | mevcut cihazlar sürer, yalnız yeni eşleme engellenir · en son eşlenenler durur | **Mevcutlar sürer** — yanlış girilen sayı müşteride kesinti yaratmaz; sınır yeni eşlemede uygulanır. |
| P6 | Bir cihazdan başka kullanıcı (kendi parolasıyla) girebilir mi? | yalnız eşlendiği kullanıcı · ofisin izinli her kullanıcısı | **Yalnız eşlendiği kullanıcı** — cihaz bağlama (OWASP MASVS-AUTH); sunucu kapalıyken özet zaten eşlenen kullanıcının yetkisiyle şifrelenir; başka kişi kendi cihazını eşler. |
| P7 | Uzak oturum kaç dakika işlem yapılmazsa kapanır? | 15 · 30 dk | **15 dk** — ASVS 4.0.3 §3.3.2: L2 30 dk, L3 15 dk; mali veri + internetten erişim. |
| P8 | Uzak oturumun en uzun ömrü | 8 · 12 saat | **12 saat** — ASVS §3.3.2 (L2/L3 12 saat); iş günü boyunca bir kez giriş. |
| P9 | Kapıcı lisans bilgisini en çok ne kadar eski kabul eder? | 1 · 24 saat | **1 saat** — engellenen lisans en geç 1 saatte durur; ofis başına günde ≤ 24 lisans sorgusu, Worker ücretsiz katmanını zorlamaz. Servis erişilemezse süre dolunca erişim kapanır (fail-closed). |
| P10 | Sunucu günlerce kapalıyken özet ne kadar eski olabilir? | sınır yok · 30 gün | **Sınır yok** — Eylül metni: "sunucu kapalıyken veri değişmez; son kopya en güncel hâl"; ekranda "Son güncelleme" yazar; lisans denetimi zaten sınır koyar. |
| P11 | Uzaktan kaç ardışık yanlış parolada kilit? | 5 · 10 | **5** — yaygın uygulama; ana oturum programın mevcut (yerel olmayan) sınırıyla aynı olduğunu koddan doğrulamalı. |
| P12 | Yanlış deneme sayacı neye göre? | kullanıcı başına · cihaz başına | **Kullanıcı başına** — ASVS §2.2.1 hesap başına; cihaz başına sayaç 3 cihazla üç kat deneme verir. |
| P13 | Kilit süresi | 15 · 30 dk | **15 dk** — P7 ile aynı ölçek; yaygın uygulama. |

Kullanıcıya sorulacak biçim (kısa): "P1 karekod 5 dk mı? P2 ikinci karekod ilkini iptal etsin mi? P3 dolu iken yeni eşleme reddedilsin mi? …
(öneri: yukarıdaki kalın değerler)". Karar gelince `kabul.json` → `secilen_birlesim` yazılır, `kahin.py`'de öneri değişmez (geri dönüş için).

## Olay dili (giriş biçimi) ve programa eşleme

Senaryo: `{"ad", "baslangic": {"ofisler": {<ofis>: {"sirketler", "kullanicilar", "lisans", "sunucu"}}, "lisans_servisi"}, "olaylar": […]}`.
Kullanıcı: `{"rol": "yonetici|kullanici", "uzaktan": bool, "sirketler": [...], "yetkiler": [...]}`. Lisans: `{"durum": "gecerli|engelli",
"bitis": saat|null, "cihaz_siniri": 3, "plan": "standart|pro|deneme"}`. Her olay `{"no", "t", "olay", …, "grup"?}`.

| `olay` | Alanlar | Programda (sürücü önerisi) | Gözlem |
|---|---|---|---|
| `karekod_uret` | ofis, yapan, kullanici, kod | Yönetim → cihaz kartı → karekod; `yapan`'ın yerel oturumuyla; `kod` etiketi gerçek karekoda eşlenir | kabul / ret sınıfı |
| `esle` | ofis, kod, cihaz, cihaz_turu? | Telefonun karekod adresi → kapıcı → eşleme; `ofis` = isteğin gittiği ofis (başka ofis denemesi) | kabul / ret, `esli` (Yönetim cihaz listesindeki sayı), `dusen` |
| `cihaz_sil` | ofis, yapan, cihaz | Yönetim cihaz listesi → Sil | kabul / ret, `esli` |
| `kullanici_degis` | ofis, yapan, kullanici, degisiklik | Yönetim → Kullanıcılar (izin kutusu, şirket kutuları, yetkiler, rol) | kabul / ret |
| `ozet_yukle` | ofis | Programın özet yükleyicisini sahte saatle tetikle | kapıcının yükleme yanıtı |
| `ozet_oku` | ofis, cihaz | Cihaz kimliğiyle kapıcıdan özet indir + çöz | kabul / ret, `gorunur` (şirket → bölümler), `ozet_zamani` ("Son güncelleme") |
| `ozet_yaz` | ofis, cihaz | Cihaz kimliğiyle kapıcıya yazma isteği | ret beklenir |
| `kapici_dogrudan_kayit` | ofis, cihaz, kullanici | Programı atlayıp kapıcının cihaz kayıt ucuna lisans belirteciyle doğrudan istek | kabul / ret, `esli`, `dusen` |
| `giris` | ofis, cihaz, kullanici, parola (dogru/yanlis), oturum, gorunen_adres?, basliklar? | Tünelden `/api/mobil/giris`; tünel dinleyicisi 127.0.0.1'den bağlanır, `basliklar` isteğe eklenir | kabul / ret |
| `istek` | ofis, cihaz, yol, oturum?, sirket?, yetki?, yazma?, gorunen_adres?, basliklar? | Tünelden `yol`; `oturum` = girişte alınan uzak oturum; `sirket` = hofCompany; `yetki` gerçek uca eşlenir (kasa, cari, stok, taksit, anlik_durum, `rapor:<id>` = rapor merkezi, tahsilat = yazma ucu) | kabul / ret |
| `lisans_degis` | ofis, lisans | Sahte lisans sunucusunda kaydı değiştir (`HUKUK_LICENSE_URL` yerel; ders 30) | — |
| `lisans_servisi` | erisim (var/yok) | Sahte lisans servisini kapat/aç (kapıcı da ulaşamaz) | — |
| `program_lisans_denetle` | ofis | "Lisansı Şimdi Denetle" | — |
| `sunucu` | ofis, durum | Programı durdur / başlat (tünel düşer / kalkar) | — |
| `bekle` | — | Yalnız saat ilerler | — |

Saat: program `config.now` ile, kapıcı (yerel Worker) aynı sahte saatle; V9 penceresi gerçek saatle denenemez.

**Ret sınıfları** (sürücü programın yanıtını — HTTP durumu + hata kodu — bunlara çevirir; eşleme tablosu karşılaştırmadan ÖNCE yazılır,
ders 5): `cihaz_yok`, `sinir_asimi`, `lisans_gecersiz`, `lisans_dogrulanamadi`, `yol_yasak`, `sunucu_kapali`, `oturum_gecersiz`, `yetki_yok`,
`sirket_yok`, `yazma_yasak`, `ozet_yok`, `ozet_eski`, `kod_gecersiz`, `sinir_dolu`, `uzaktan_izni_yok`, `parola_yanlis`, `deneme_siniri`,
`cihaz_baska_kullanici`.

## Çıktı ve karşılaştırma

`kahin.py hesapla` çıktısı: `{"olaylar": {"<no>": {"sonuc": [...], "esli": [{ofis: n}], "dusen"?, "ozet_zamani"?, "gorunur"?: {"en_az", "en_cok"}}},
"gruplar": {"<grup>": [{"<no>": [...]}]}}`. `sonuc` birden çok değerse hepsi kabul edilir (V7, V9, V11–V14).

Program tarafı `program.json` = `{"<senaryo>": {"<no>": {"sonuc": "kabul|ret:x", "esli"?: {ofis: n}, "gorunur"?: {şirket: [bölüm]},
"ozet_zamani"?: saat, "dusen"?: [...]}}}`. `karsilastir` modeli seçilen birleşimle yeniden koşar ve **dünyaları programın gözlemiyle
süzer**: programın sonuçları tek bir tutarlı yol oluşturmalı (ör. U23'te tab1 eşlendiyse tel1 sonra `cihaz_yok`). Bakım olayı dışında
çıktıda olmayan olay FARK'tır (ders 4). `gorunur`: programın gösterdiği her şirket/bölüm üst sınırda olmalı (yetkisiz içerik = BULGU),
alt sınırdaki her bölüm görünmeli. Programın üretemediği senaryo `programda_uretilemez: true` ile DENENMEYEN'e yazılır (şu an yok).

Sürücü (program tarafı) bu kâhinin işi değildir; ana oturum / M2 geliştiricisi yazar ve bu klasöre `program-surucu.mjs` adıyla koyar
(kâhin onu okumaz).

## Senaryolar (36)

- U01 temel akış (Standart lisans) · U02 karekod 1,5/3/7/12 dk · U03 süre tam sınırda · U04 aynı kodun ikinci kullanımı · U05 ikinci karekod
- U06 4. cihaz (telefon + tablet + tarayıcı), silince yer açılır · U07 sınır iki şirkete dağılmış + aynı kişinin iki cihazı + iki ofis ayrı ·
  U08 silinen cihazın açık oturumu, yeniden eşleme · U09 başka ofisin kodu/cihazı, aynı adlı kullanıcılar
- U10 lisans biter → yenilenir (yeniden eşleme yok, önbellek penceresi) · U11 lisans engeli · U12 lisans servisine ulaşılamaz (fail-closed)
- U13 sunucu kapalı: okuma/yazma/giriş/eşleme, yeniden açılış · U14 günlerce kapalı, ay sonu, özet yaşı · U15 tünel yol beyaz listesi (17 yasak
  yol) · U16 tünelden "yerel" taklidi + kurtarma kodu + deneme sınırı · U17 deneme sayacı kullanıcı/cihaz, başarı sıfırlar
- U18 yetkisiz şirket/rapor/kasa, yetki değişimi hemen · U19 yönetici, rol düşürme, Anlık Durum yalnız yönetici · U20 gece yarısı / ay sonu ·
  U21 yıl sonu lisans bitişi (UTC ve ofsetsiz yazım) · U22 iki cihaz aynı anda son yer · U23 aynı kod iki cihazdan aynı anda
- U24 oturum mutlak ömrü (53 istek) · U25 başka kullanıcının cihazı / oturum başka cihazda · U26 izin kaldırılır ve geri verilir · U27 yönetici
  olmayan · U28 kapıcı sınırı (program atlatılırsa) · U29 lisans sayısı 3 → 2 → 3 · U30 boş veri · U31 eşleme sunucu kapalıyken ·
  U32 aynı cihazda yeniden giriş · U33 aynı saniyede silme ve istek
- R1–R3 tohum 1–3: 6 ofis (her biri bir şerit), şerit başına 8–12 akış (12 akış türü: süre, tekrar, ikinci kod, dolu sınır [karekodla ya da
  kapıcıya doğrudan], eşzamanlı son yer, yetki, yol, izin, oturum boşta, deneme/kilit, sunucu kapalı [10 dk – 40 gün], lisans engeli), 28.11 21:00'dan
  başlayıp ay sonu/gece yarısı/yıl sonu geçen saatler, %50 görünen adres taklidi; 627 / 593 / 560 olay. Akış beklentisi akışın kendi kapalı
  kuralından (yetki kuralı modelden ayrı yeniden yazıldı). Tam karar ağacı binlerce yaprak olduğundan 25 birleşimle denetlenir (öneri, her
  parametrenin tek tek öneri dışı değeri, bütün öneri dışı, tohumdan 8 rastgele).

## Mutasyonlar (55; `kahin_test.py` F)

M01 süre yok · M02 tek kullanımlık değil · M03 süre sınırı dahil · M04 başka ofisin kodu · M05 P2 ters · M06 sınır yok · M07 sınır şirket
başına · M08 sınır kullanıcı başına · M09 P3 ters · M10 silinen cihaz geçer · M11 silinince oturum sürer + kapıcı oturuma bakar · M12 silinen yer
tutar · M13 izin kalkınca cihaz düşmez · M14 yönetici olmayan karekod üretir · M15 izinsize karekod · M16 P4 ters · M17 önbellek sonsuz · M18 engel
görülmez · M19 bitiş görülmez · M20 yenileme görülmez · M21 fail-open · M22 önek bölüm sınırında değil · M23 yol çözülmeden · M24 yönetici
ayrıcalığı yok · M25 işaretsiz her şirketi görür · M26 Anlık Durum yönetici dışına · M27 127.0.0.1 yerel sayılır · M28 kurtarma yolu açık ·
M29 başarı sayacı sıfırlamaz · M30 kilitliyken doğru parola · M31 P12 ters · M32 boşta süresi yok · M33 mutlak ömür yok · M34 oturum cihaza
bağlı değil · M35 P6 ters · M36 sunucu kapalıyken yazma · M37 sunucu kapalıyken özet yok · M38 P10 ters · M39 özette lisans yok · M40 cihaz özete
yazar · M41 eski görünüm görünür · M42 P5 ters · M43 lisans bitince eşleme silinir · M44 eşleme sunucu kapalıyken · M45 aynı saniyedeki eşleme
sayılmaz (yarış) · M46 kapıcı doğrudan kayıtta sınır yok · M47 olmayan şirket · M48 P13 ters · M49 ret önceliği yol önce · M51 lisans bitiş anı
dahil · M52 boşta sınırı dahil · M53 kilit bitmez · M54 yeniden başlatma belirsizliği daraltılır · M56 özet yöneticinin görünümüyle · M57 Pro
kilidi (Standart lisansta mobil kapalı).

Bir mutasyon, elle senaryoların karar ağacında ya da rastgele senaryoların öneri birleşiminde en az bir beklentiyle ayrışmalıdır;
55/55 yakalandı, 55/55'i öneri birleşiminde de yakalandı. Bazı mutasyonlar ayrıca girdi hatası verir (ör. M01'de belirsiz sınır) — sayılmaz,
yalnız not edilir.

## DENENEN

- 33 elle senaryoda elle beklenen = model, karar ağacının 68 yaprağının hepsinde (parametreye bağlı elle kural okunduğu parametreyle yaprağı
  genişletir). 3 rastgele senaryoda (1.780 olay) üreticinin akış beklentisi = model, 25 birleşimde.
- Değişmezler: D1 olay listesinin sırası, D2 görünen adres / `X-Forwarded-For` etkisiz, D3 iki ofisin verisi karışmaz (bir ofis çıkarılınca öbürleri
  aynı), D4 hiçbir anda 3'ten fazla eşli cihaz, D5 görünür alt ⊆ üst sınır, D6 lisans 24 saatten uzun geçersizken hiçbir uzak istek kabul
  edilmez, D7 sunucu kapalıyken canlı istek/giriş/eşleme yok, D8 kabul edilen her tünel isteği izinli yolda, D9 silinen cihazın sonraki hiçbir
  isteği kabul edilmez.
- 18 girdi doğrulaması (17 hatalı girdi reddedilir, 1 geçerli girdi kabul edilir); komut satırı `hesapla` ve `karsilastir` (kendi çıktısı → 0,
  tek fark → 1, eksik olay → 1); gözlemle süzme.
- 55 mutasyon (yukarıda). Kırmızı kanıt: `MOBIL_KAHIN_MUT=M06` ve `M17` ile kendi testi kırmızı (`kanit/<gün>/kirmizi-*`; çöken bölüm de `not ok` sayılır, özet her zaman yazılır).
- Dersler: 2 (çıkış kodu + sayılar `kanit.mjs` ile), 3/4 (ret ve eksik çıktı fark sayılır), 5 (temiz oda), 7 (mutasyon + kırmızı), 13/22 (sahte
  saat, gece yarısı, ay ve yıl sonu, UTC yazımı), 17 (rastgele sıra, iki ofis), 31 (aynı an sırası açık; eşzamanlı olaylar bütün sıralarıyla),
  40/43 (13 açık soru parametre, karar kullanıcıda).

## DENENMEYEN

- Program tarafıyla karşılaştırma (M2 kodu yok; sürücü ana oturumda yazılacak).
- Gerçek Cloudflare (Worker, R2, tünel), gerçek telefon/tarayıcı (passkey/PIN kilidi, ana ekrana ekleme), gerçek ağ kesintisi.
- Şifreleme ve anahtar yenileme (zarf şifreleme) — kâhin yalnız kapıcının verdiği/vermediği yanıtı ve çözülen içeriğin yetki sınırını gözler.
- Özet yükleme zamanlaması (15 dk / 10 dk hareketsizlik / günde 20) — erişim denetimi değil; `ozet_yukle` olayla tetiklenir.
- Yerel (ofis içi) istekler, yerel deneme sayacının uzak sayaçla ilişkisi (V20); M5 (mobil yazma, para) — ayrı kâhin.
- Tünel isteğinin yarıda kesilmesi / aynı istek iki kez (M5 kâhininin konusu).

## BİLİNEN SINIRLAR

- Model, elle beklentiler ve üretici aynı elden çıktı. Bağımsızlık PROGRAMA göredir, kendi içinde değil; üretici yetki kuralını ayrı yazdı ama
  aynı kişi yazdı. V1–V21 kâhinin okumasıdır; program ayrışırsa önce yeniden üretilip hata aranır (ders 6), sonra kullanıcıya sorulur (ders 43).
- "İkisi de olur" sonuçları (V7, V9, V11–V14) testi gevşetir: o pencerelerde program her iki davranışta da geçer. Gözlemle süzme sonraki olayların
  tutarlılığını yine denetler.
- V9 penceresi gerçek saatle denenemez; kapıcı sahte saatle koşmalı (yerel Worker / Miniflare).
- Ret önceliği (V16) bir okumadır; sınıf farkları İNCELE'dir, kabul ↔ ret farkı BULGU'dur.
- Olay dilinin programa eşlenmesi (özellikle `yetki` → gerçek uç, ret sınıfı ↔ HTTP yanıtı, `ozet_oku`'da çözülen içerik → `gorunur`) program
  tarafının işidir; eşleme yanlışsa kâhin ile program aynı yanlış girdiyle ayrışmadan geçebilir (ders 5).
- Rastgele senaryoların tam karar ağacı denetlenmedi (25 birleşim); elle senaryolarda tam.
