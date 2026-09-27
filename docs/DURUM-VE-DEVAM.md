# DestekOfis — durum ve devam notu

Yeni bir oturum bu belgeyi okuyarak kaldığı yerden devam eder. Son güncelleme: 27.09.2026 (sürüm 2.0.1, yayın bekliyor).

## Nerede ne var

| Parça | Yer |
| --- | --- |
| Program (sunucu + arayüz + kurulum) | `ceougur/ofis---y-netimi`, dal `master` |
| Tanıtım sitesi, lisans API'si, operatör merkezi | `ceougur/destekofis` (`web/`), Vercel projesi `destek-ofis`, adres `https://destek-ofis.vercel.app` |
| Lisans veritabanı | Supabase projesi `lvzaeekyovhquljzesye` (eu-central-1), özel `lisans` şeması; şema `destekofis/supabase/lisans.sql` |
| Lisans servisi adresi (programda sabit) | `https://destek-ofis.vercel.app/api/lisans` (`server/lib/license.mjs`, `DEFAULT_LICENSE_SERVICES`) |
| Lisans ayrıntıları | `docs/LISANS.md` |
| Sürüm yayımlama | `docs/SURUM-YAYIMLAMA.md` |
| Operatör merkezi ve API işletimi, sır yenileme | `destekofis/README.md` |

## Tamamlananlar

- Faz 0–2 ve 1.4–1.7 ara sürümleri (bkz. `CHANGELOG.md`).
- **Faz 3 — lisans motoru (2.0.0):**
  - Tek kurulum dosyası; kurulumdan sonra 30 günlük deneme kendiliğinden başlar.
  - Denemenin 3. gününde firma bilgisi sorulur.
  - Süre dolunca veya lisans engellenince program salt okunur olur.
  - Lisanslar imzalıdır (Ed25519). İnternet 7 gün kesik kalabilir; saat geri alma koruması var.
  - İnternetsiz `DOLIS1.` kodu var.
  - 2.0 öncesi kurulumlara 30 günlük geçiş dönemi tanınır.
- **Faz 4 çekirdeği (canlı):**
  - Vercel lisans API'si (`/api/lisans/v1/activate|check|durum`).
  - Supabase şeması ve RPC'ler.
  - Operatör merkezi `/admin` (Özet, Kullananlar, Lisanslar, Hareketler, Ayarlar).
  - Site yalnızca demoyu anlatır; demo ve kullanım kılavuzu indirme, KVKK sayfası, iletişim bilgileri var.
- v2.0.0 GitHub'da yayımlı ("Latest"). Sitedeki demo düğmesi `releases/latest/download/DestekOfis-Kurulum.exe` adresine gider. Kullanıcı imzalı güncelleme paketini (`destekofis-guncelleme.json` + zip, anahtar `destekofis-2026-1`) v2.0.0 yayınına ekledi; imza ve içerik doğrulandı. 1.6/1.7 kurulumlar artık 2.0.0'a kendiliğinden güncellenir.
- **2.0.1 (hazır, dal `claude/nice-euler-jvajxv`):**
  - Veri oturumları: farklı konudaki Excel/Sheet yeni oturumda açılır; kişiye özel oturum seçici; ad değiştirme, silme. Kullanıcılar, görevler, notlar, tahsilatlar ve Kasa oturumdan bağımsızdır (`docs/MIMARI.md` → *Veri oturumları*).
  - Excel/Sheets formülleri programda çalışır (`server/lib/formula/`).
  - Tahsilat düzeltme/silme, Kasa (göç 5), işlem geçmişi eskiden yeniye, Türkçe tutar okuma.
  - Operasyon Merkezi adları kalemle değişir.
  - Serbest sayfalar: sekme şeridinde "+ Sayfa", Excel benzeri ızgara, Türkçe formüller, Σ toplamlar, doldurma, yapıştırma, geri alma; satırlar kayıt olarak detay kartında çalışır (`docs/MIMARI.md` → *Serbest sayfalar*).
  - Kayda belge ekleme, Excel'e aktarma, kolon başlıklarını adlandırma, akıllı denetim (`docs/MIMARI.md` → *Belgeler*, *Akıllı denetim*).
  - Notlar ve belgeler kayıt kimliğine bağlıdır; aynı kimliği taşıyan kayıt farklı oturumlarda aynı notları ve belgeleri görür.
  - Kurulum düzeltmesi: sunucunun üstüne yeniden kurulumda servis yeniden kurulur ve başlar (`setup.iss`, `ExistingServerInstall`).
  - `release.yml`: web arayüzünden açılan yayına da imzalı paket, `DestekOfis-Kurulum.exe` ve kılavuz eklenir (`DESTEKOFIS_RELEASE_KEY` sırrı gerekli).
  - Sitede indirme kartı ve Kasa tanıtımı (`destekofis` deposu, yerel commit; gönderilmedi).

## Kalanlar (öncelik sırasıyla)

1. **2.0.1'i yayımlamak (kullanıcı onayıyla).**
   - Dal `master`'a birleştirilir; site deposu (`destekofis`) `main`'e gönderilir.
   - GitHub → depo → *Settings → Secrets and variables → Actions* → `DESTEKOFIS_RELEASE_KEY` = güncelleme `.pem` dosyasının tüm içeriği (bir kez).
   - GitHub → *Releases → Draft a new release* → etiket `v2.0.1` (hedef `master`) → *Publish release*. `release.yml` testlerden sonra imzalı paketi, kurulum dosyalarını ve kılavuzu ekler; 2.0.0 kurulumlar kendiliğinden 2.0.1'e geçer.
   - Sır tanımlanmazsa: `node tools/release.mjs --anahtar <pem>` ile paket yerelde üretilip yayına elle yüklenir (`docs/SURUM-YAYIMLAMA.md` → B).
2. **2.1.0 — ofis dışından erişim (kullanıcı erteledi, talimat bekleniyor).** Lisanslı kullanıcı ofis dışından (başka bilgisayar, telefon) kendi sunucusuna bağlanıp veri girebilsin. Bugün "Personel bilgisayarı" kurulumu sunucuyu yalnızca ofis ağında (UDP keşfi) bulur. Önerilen yol: satıcı tarafında tek ücretsiz Cloudflare hesabı + alan adı (`destekofis.net` alınınca) ile her ofise Cloudflare Tunnel alt adresi; müşteriye ek maliyet ve modem ayarı yok, CGNAT'ta da çalışır. Programda: yöneticinin açıp kapattığı uzaktan erişim, kullanıcı bazlı izin, uzaktan girişte iki adımlı doğrulama, oturum listesi/kapatma, tünelin sunucuyla başlatılması, lisans servisinde ofis adresi, demoda "Ofisime bağlan", telefonda ana ekrana eklenebilen uygulama; KVKK metnine Cloudflare üzerinden şifreli geçiş eklenmeli. Modem port yönlendirmesi (gerçek IP gerekir) ve hesapsız hızlı tünel (deneme amaçlı, adres değişir) yedek seçenek olarak konuşuldu.
3. **Faz 4 kalanı: alan adı.**
   - `destekofis.net` alınıp Vercel'e bağlanacak.
   - Ardından KVKK veri sorumlusu ve adresi güncellenecek. Şu an "Uğur Çetin, Karatay / Konya / Türkiye".
   - `destek-ofis.vercel.app` açık kalmalı, çünkü program lisans servisine bu adresten bağlanır. Yeni adres bir sonraki sürümde `DEFAULT_LICENSE_SERVICES`'e ikinci adres olarak eklenir.
4. **Faz 4 kalanı: site içerikleri.** Fiyat ve satın alma yolu, video oynatıcı, sürüm notları vb. Kullanıcıyla konuşulacak.
5. **Tanıtım videosu.** Ses kararı bekleniyor.
6. **Ticari hazırlık.**
   - Kod imzalama sertifikası (Windows "tanınmayan uygulama" uyarısı için).
   - Depoyu gizliye alma. Önce demo indirme bağlantısı ve güncelleme kaynağı başka yere taşınmalı.
7. **İsteğe bağlı:** Tabloda uygulamada eklenen yeni kayıtlar şu an sekmenin en üstünde görünür (kullanıcı "alta eklensin" isteğini işlem geçmişi ve kasa için onayladı); istenirse tablo için de değiştirilebilir.

## Kalıcı kurallar

- GitHub'a gönderme ve yayın yalnızca kullanıcının onayıyla yapılır.
- Etiketler zorla taşınmaz.
- Gizli anahtarlar hiçbir depoya, zip'e veya belgeye konmaz. Bu anahtarlar şunlardır:
  - güncelleme imza anahtarı;
  - lisans imza anahtarı;
  - API sırrı;
  - operatör parolası.

  Lisans anahtarı ve API sırrı yalnızca Vercel'in gizli ortam değişkenlerindedir.
- Yeni sürümde kurulum dosyası release'e sürüm numarasız `DestekOfis-Kurulum.exe` adıyla da eklenir.
- Müvekkil verisine erişilmez. Analiz internetsiz yapılır.
- Teslimler: zip ve HTML/PDF rehber; kullanıcıya teknik olmayan dille anlatılır.
