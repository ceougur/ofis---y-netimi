# Hukuk Ofisi Merkezi

Bu paket, Hukuk Ofisi dosya takip uygulamasının ofis ağı üzerinde çalışan server/client sürümüdür.

- Server: `start-server.cmd`
- Windows ağ kurulumu: Yönetici PowerShell ile `install-server.ps1`
- Client: Chrome/Edge ile `http://SERVER-IP:5123`
- Yönetim: `http://SERVER-IP:5123/admin.html`
- Manuel yedek: `npm run backup`
- Test: `./test-central.sh`
- Mimari rapor: `PROJE-RAPORU-MERKEZI-SURUM.md`
- Kullanım kılavuzu: `KULLANIM-KILAVUZU-MERKEZI-SURUM.md`

Server veritabanı `data/hukuk-ofisi.sqlite` altında tutulur. Client bilgisayarlar veritabanı dosyasına değil, yalnızca HTTP API’ye bağlanır. İlk admin hesabı `admin / Ofis2026!` olarak oluşturulur; ilk girişten sonra parola değiştirilmelidir.

Bu merkezi sürüm, önceki çalışır Windows tesliminden ayrı klasörde hazırlanmıştır. Orijinal teslim dosyaları korunur.

Kaynak geçmişi kullanıcı tarafından bağlanan `ceougur/ofis---y-netimi` GitHub repository’sine gönderilir; dağıtım ZIP’i `.git`, çalışma verisi ve yedek içermez.
