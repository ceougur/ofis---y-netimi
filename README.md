# DestekOfis

Hukuk ofisleri için merkezi dosya takip sistemi. Ofisteki bir bilgisayar **sunucu** olur; diğer bilgisayarlar tarayıcıdan bağlanır ve herkes aynı dosyaları, notları, tahsilatları, hacizleri, görevleri ve değişiklik geçmişini görür.

- Sunucu: Node.js 22+ (dış bağımlılık yok) · SQLite
- İstemci: Chrome / Edge, adres `http://SUNUCU-IP:5123`
- Yönetim paneli: `http://SUNUCU-IP:5123/admin.html`

## Hızlı başlangıç (sunucu bilgisayarı)

1. Node.js 22 veya üzerini kurun.
2. Paketi kalıcı bir klasöre çıkarın (ör. `C:\HukukOfisiMerkezi`).
3. `start-server.cmd` dosyasını çalıştırın.
4. Tarayıcıdan `http://127.0.0.1:5123` adresini açın. İlk giriş: **admin / Ofis2026!** — sistem ilk girişte yeni parola belirlemenizi ister.

Diğer bilgisayarlar `http://SUNUCU-IP:5123` adresini kullanır. Ayrıntılar: [Kurulum ve kullanım](docs/KURULUM-VE-KULLANIM.md).

> Windows servisi, tek tıkla kurulum (setup.exe) ve istemcilerin sunucuyu otomatik bulması bir sonraki sürümde (Faz 1) geliyor.

## Geliştirme

```bash
npm start            # sunucuyu başlatır (port 5123)
npm test             # sunucu testleri (node:test)
npm run test:e2e     # tarayıcı testleri (Playwright + Chromium)
npm run check        # tüm betiklerin sözdizimi denetimi
npm run backup       # elle yedek (sunucu çalışırken de güvenli)
npm run package      # dist/destekofis-<sürüm>.zip dağıtım paketi
node tools/patch-bundle.mjs   # arayüz paketine yamaları yeniden uygular
```

Ortam değişkenleri: `PORT`, `HOST`, `HUKUK_DATA_DIR`, `HUKUK_BACKUP_DIR`, `HUKUK_ADMIN_USERNAME`, `HUKUK_ADMIN_PASSWORD`, `HUKUK_BACKUP_INTERVAL_HOURS`, `HUKUK_BACKUP_KEEP`, `HUKUK_LOG_LEVEL`.

## Klasör yapısı

```
server/            sunucu (app.mjs, lib/, routes/)
client/            tarayıcı arayüzü (derlenmiş paket + hof-*.js eklentileri, admin.html)
tools/             yedek, paketleme, sözdizimi ve paket yama araçları
test/              otomatik testler ve e2e
docs/              kurulum/kullanım ve mimari belgeleri
data/, backups/    çalışma verisi ve yedekler (pakete ve depoya girmez)
```

Mimari ayrıntılar: [docs/MIMARI.md](docs/MIMARI.md) · Sürüm notları: [CHANGELOG.md](CHANGELOG.md)
