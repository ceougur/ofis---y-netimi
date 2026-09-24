# DestekOfis

Ofisler için merkezi kayıt takip ve yönetim sistemi. Ofisteki bir bilgisayar **sunucu** olur; diğer bilgisayarlar ona bağlanır ve herkes aynı kayıtları, notları, görevleri, mesajları ve değişiklik geçmişini görür.

Sektörden bağımsızdır: yüklenen Excel veya Google Sheets verisini sunucuda (internete göndermeden) çözümler, kolon türlerini doğrular, 142 sektörlük listeden sektörünü kanıtlarıyla önerir ve yönetici onaylayınca başlıklarını, rol adlarını ve araçlarını (ör. hukukta tahsilat ve haciz) buna göre ayarlar. Başlıklar kalemle kalıcı olarak değiştirilebilir.

- Sunucu: Windows servisi (nssm) · gömülü Node.js 24 LTS (dış bağımlılık yok) · SQLite
- Personel bilgisayarı: sunucuyu UDP ile kendiliğinden bulan başlatıcı (Edge/Chrome uygulama penceresi)
- Yönetim paneli: `http://SUNUCU:5123/admin.html`

## Kurulum (son kullanıcı)

1. `DestekOfis-Kurulum-<sürüm>.exe` → **Sunucu bilgisayar**. Servis kurulur, güvenlik duvarı ayarlanır, sistem açılır.
2. İlk giriş sunucunun kendisinden: **admin / Ofis2026!** — sistem yeni parola belirlemenizi ister.
3. Personel bilgisayarlarında aynı dosya → **Personel bilgisayarı** → masaüstündeki DestekOfis simgesi.

Ayrıntılar: [Kurulum ve kullanım](docs/KURULUM-VE-KULLANIM.md).

## Geliştirme

Node.js 22.13+ (önerilen 24 LTS).

```bash
npm start              # uygulama sunucusu (port 5123)
npm run start:service  # servis yöneticisiyle: HTTP kapısı + UDP keşif + bakım sayfası
npm test               # sunucu, servis yöneticisi, keşif, kurulum düzeni ve başlatıcı testleri
npm run test:e2e       # tarayıcı testleri (Playwright + Chromium)
npm run check          # tüm betiklerin sözdizimi denetimi
npm run backup         # elle yedek (sunucu çalışırken de güvenli)
npm run package        # dist/destekofis-<sürüm>.zip taşınabilir paket
npm run build:windows  # dist/DestekOfis-Kurulum-<sürüm>.exe (Go, Inno Setup; Linux'ta Wine)
npm run release -- --anahtar <gizli.pem>   # dist/guncelleme: imzalı otomatik güncelleme paketi
node tools/patch-bundle.mjs   # arayüz paketine yamaları yeniden uygular
```

Windows kurulum dosyası için: Go 1.22+, `x86_64-w64-mingw32-windres` (simge/sürüm bilgisi), Inno Setup 6 (Windows) veya Wine (Linux; `npm install` Inno Setup'ı getirir). GitHub Actions `windows.yml` kurulum dosyasını derler ve gerçek Windows'ta kurma → servis → keşif → yeniden kurma → kaldırma testlerini çalıştırır.

Ortam değişkenleri (adları uyumluluk için değişmedi): `PORT`, `HOST`, `HUKUK_DATA_DIR`, `HUKUK_BACKUP_DIR`, `HUKUK_ADMIN_USERNAME`, `HUKUK_ADMIN_PASSWORD`, `HUKUK_BACKUP_INTERVAL_HOURS`, `HUKUK_BACKUP_KEEP`, `HUKUK_LOG_LEVEL`, `HUKUK_DISCOVERY_PORT`, `HUKUK_TRUST_PROXY`, `HUKUK_UPDATES` (`0` otomatik güncellemeyi kapatır).

## Klasör yapısı

```
server/            uygulama sunucusu (app.mjs, lib/, routes/) ve servis yöneticisi (supervisor.mjs)
client/            tarayıcı arayüzü (derlenmiş paket + hof-*.js eklentileri, admin.html)
launcher/          personel bilgisayarı başlatıcısı (Go, yalnızca standart kütüphane)
packaging/windows/ setup.iss (Inno Setup), bootstrap.mjs, servis betikleri, marka görselleri
vendor/nssm/       resmi nssm 2.24-101 (özet doğrulamalı)
tools/             yedek, paketleme, Windows derleme, sözdizimi ve paket yama araçları
test/              otomatik testler ve e2e
docs/              kurulum/kullanım ve mimari belgeleri
data/, backups/    çalışma verisi ve yedekler (pakete ve depoya girmez)
```

Kurulumlar sunucu açılışında GitHub Releases'tan imzalı güncellemeleri kendiliğinden alır; sürüm yayımlama: [docs/SURUM-YAYIMLAMA.md](docs/SURUM-YAYIMLAMA.md).

Mimari ayrıntılar: [docs/MIMARI.md](docs/MIMARI.md) · Sürüm notları: [CHANGELOG.md](CHANGELOG.md)
