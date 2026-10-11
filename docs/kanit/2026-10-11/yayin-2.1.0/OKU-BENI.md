# 2.1.0 yayın denetimi (11.10.2026)

- PR ceougur/ofis---y-netimi#27 squash → master 7c6405f; ağaç 75ca810e = paketlenen 0f6b364 (CI 0f6b364 push koşusu 38162376506 YEŞİL,
  Doğrulama Kapısı dahil). Etiket v2.1.0 → 7c6405f.
- Yayın 409850249 (18:45:44 UTC): 5 dosya, GitHub özetleri ve indirilen baytlar teslimle aynı (`yayin-dosyalari-sha256.txt`); latest/ altındaki
  exe, json, zip, pdf aynı (`latest-sha256.txt`); `sha256sum -c DestekOfis-Kurulum.exe.sha256` OK.
- Yayın öncesi (`yayin-oncesi-guncelleyici-eski-kodlarla.txt`): sahte GitHub ile 2.1.0, v2.0.26 ve v2.0.22'nin GERÇEK güncelleyici koduyla 18
  eski sürüm × 3 = 54/54 available + sha256 eşleşti; kurcalanmış bildirge 3/3 reddedildi.
- Canlı GitHub (`canli-github-guncelleyici.txt`): 2.1.0 ve v2.0.26 güncelleyici koduyla 12 eski sürüm (2.0.26…2.0.17, 2.0.4, 1.7.0) × API ve API
  kapalı yedek yol → 48/48 available 2.1.0 + indirme sha256 eşleşti; kurulu 2.1.0 → up-to-date (2.1.0 kodu 2/2). TEK ✗: v2.0.26 kodu "kurulu
  2.1.0 + API kapalı" (gerçekte olmayan birleşim) bir koşuda "HTTP 403" — eski kodun tasarımı: yedek yol bildirgesi inemezse API hatasını
  (yeniden denenebilir) bildirir; yeniden koşuda 3/3 up-to-date, yedek yol isteği 200 (`tek-210.mjs`). Hangi isteğin düştüğü ilk koşuda
  kaydedilmedi (bilinmiyor); ürün davranışı değil, ağ.
