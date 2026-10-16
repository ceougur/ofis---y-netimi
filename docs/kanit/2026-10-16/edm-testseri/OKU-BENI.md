# EDM test ortamı — test serisi ve "TEST ORTAMI" şeridi (16.10.2026, İz 8)
Kurulum üretimdeki gibi: e-Belge açık, canlı kilitli (`startTestServer({ edocEnabled: true })`). Programın kendi API'siyle e-Fatura ve e-Arşiv kaydedilip
gönderildi. Numara TEF / TEA serisinden verildi (firmanın EFT serisi 1'de kaldı); EDM ikisini de kabul etti (e-Arşiv ~1 dk, e-Fatura ~6 dk SUCCEED);
EDM'nin çizdiği resmî PDF'in üstünde "TEST ORTAMI — Bu belge deneme amaçlıdır; yasal geçerliliği yoktur." şeridi (bizim görünüm şablonu). Kimlik bilgisi
yalnız yüklenen dosyadan; depoya alınan dosyalar tarandı (sızıntı yok). Komut: `NODE_EXTRA_CA_CERTS=… node testseri.mjs <kimlik-dosyası> ./cikti`.
