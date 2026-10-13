# Fatura Modülü — e-Fatura / e-Arşiv (EDM Bilişim) Bilgi Dosyası

Durum: **SIRADA, BAŞLANMADI.** Kullanıcı "fatura modülünü yap" deyince buradan başlanır. e-Belge bağlantısı bugün KAPALI
(`config.edocEnabled` false; belge "Müşteri Fişi", mali değeri yok — 13.10.2026'da koddan ve testle doğrulandı, aşağıda §2).
Sıra (kullanıcı, 13.10.2026): Perşembe kullanım sınırı sıfırlanınca → (1) banka kalan işleri → (2) bu fatura/e-Belge işi → (3) devir modülü
(`docs/devir/DEVIR-MODULU.md`).

## 1. EDM'den gelen bilgi (12.10.2026, Alper Demir — İş Geliştirme Uzmanı, EDM Bilişim; alıcı destekofis@proton.me)
- Güncel API belgeleri: EDM'nin ownCloud paylaşım bağlantısı e-postada (destekofis@proton.me gelen kutusu). Klasörler (ekran görüntüsünden):
  E-MUTABAKAT, E-MUTABAKAT REST API, E-SİGORTA, E-SMM, ENGLISH DOCUMENTS, IDIS & İlaç Tıbbi XML Örnekleri, INTERAKTİF E-ARŞİV, KEP, PHP,
  POSTMAN, RESTAPI, SSS, YTB XML Örnekleri, "WEB SERVİS ENDPOINT URL ADRESLERİ.docx", "XSLT ÖRNEKLERİ.rar" (+ listede yukarıda kalan E-FATURA /
  E-ARŞİV vb. klasörler; toplam 35,3 MB). Gerekenler: e-Fatura/e-Arşiv web servis belgesi, XML (UBL-TR) örnekleri, XSLT, uç nokta listesi, SSS.
- Test portalı: https://test.edmbilisim.com.tr/EFaturaUI21ea
- Test fatura web servisi: https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc
- Canlı fatura web servisi: https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc
- Test kullanıcı adı / parolası: e-postada. DEPOYA YAZILMAZ (depo herkese açık; anayasa: API gizli anahtarı hiçbir dosyaya girmez). Test
  koşusunda oturuma yüklenen dosyadan ya da GitHub "secret"ından okunur.

## 1a. Kullanıcının yüklediği EDM belge paketi (13.10.2026; `/root/.claude/uploads/<oturum>/…-DOK_MANLAR.rar`, 18,7 MB, RAR5 — DEPOYA KONMAZ)
Denetlendi (unar ile ayrı klasöre açıldı): 25 dosya; ilgisiz iki iç arşiv (İngilizce belgeler, E-Defter) bozuk/yarım — fatura işini etkilemez.
Fatura işi için gerekenler TAM ve sağlam:
- `E-FATURA VE E-ARŞİV FATURA/e-Fatura teknik doküman.zip` (bütünlük OK): "EDM E-Fatura Web API v4.2.1.docx" (18.05.2026), "Web API v4 Request-
  Response.docx", `EFaturaEDMConnectorLibrary.cs` (EDM'nin C# istemcisi — istek alanları/sırası için kâhin), "XML ÖRNEKLERİ.rar": satis/iade/
  istisna/ihracat/ihraç kayıtlı/özel matrah/tevkifat/SGK/yolcu beraber/dövizli — temel ve ticari, + general.xslt, generalexport.xslt.
- `XSLT ÖRNEKLERİ.rar` (19/19 sağlam): general.xslt, generalearchive.xslt, generalexport.xslt … (fatura/e-Arşiv basımı).
- `SSS/Sıkça Sorulan Sorular.docx`, `SSS/EDM E-Fatura - WebServis durum kodları ve aciklamalari.xlsx` (hata/durum kodları).
- `POSTMAN/EdmEntegration.postman_collection.json` (örnek istekler), `WEB SERVİS ENDPOINT URL ADRESLERİ.docx`, `RESTAPI/…Swagger linkleri.txt`.
- EKSİK: GİB'in resmî UBL-TR şema (XSD) + şematron paketi pakette YOK. Gerekli (Adım 1'in kâhini). ebelge.gib.gov.tr bu ortamdan erişilemiyor →
  ortam ayarında izin (ebelge.gib.gov.tr) ya da kullanıcı GİB sitesinden "UBL-TR paketi"ni indirip yükler.

## 2. Programda bugün olan (koddan, 13.10.2026; yayımlanan v2.2.0 ile aynı)
- `server/lib/config.mjs:62` `edocEnabled` yalnız testlerle açılır; ortam değişkeniyle açılmaz.
- `server/routes/invoices.mjs`: kapalıyken entegratör testi, mükellef sorgusu, gelen kutusu, gönder, durum sorgula, XML indir → 404
  `edoc-disabled`; ayarlara entegratör bilgisi kaydedilmez. Ekranda e-Belge düğmeleri gizli; "Müşteri Fişi (resmî hükmü yok)".
- Kanıt: `test/einvoice-edm.test.mjs` "e-Belge kapalıyken (varsayılan) entegratör uçları çalışmaz" (yerel 1/1, docs/kanit/2026-10-13/edoc-kapali;
  CI'de her commit Linux + Windows).
- Hazır kod: `server/lib/einvoice/edm.mjs` (v2.0.15; WCF/SOAP, i2i sözleşme ailesi: Login, SendInvoice, GetInvoice, GetInvoiceStatus,
  CheckUser, CancelInvoice, MarkInvoice; WSDL'den sözleşme okuma `soap-contract.mjs`), `ubl-tr.mjs` (UBL 2.1 / GİB UBL-TR 1.2 — e-Fatura
  Temel/Ticari, e-Arşiv), `ubl-read.mjs`, `adapters.mjs`, `integrator-error.mjs`. edm.mjs'teki test/canlı adresleri EDM'nin verdiği
  adreslerle AYNI (satır 27–28).
- Kaynak (v2.0.15'te): EDM'nin herkese açık belgeleri + açık kaynak istemci; gerçek EDM test ortamında HİÇ denenmedi.

## 3. Plan (kullanıcı: "önce uyumlu XML paketini yaptığımızı doğrulayalım, sonra testlerden geçirelim, sonra entegre et diyebileceğim hale
gelince entegre ederiz")
1. **XML uygunluğu (ağ gerekmez):** EDM paketindeki resmî UBL-TR şemaları (XSD) + GİB şematron kuralları + örnek XML'ler indirilir; programın
   ürettiği her belge türü (satış, iade, e-Arşiv, Temel/Ticari, KDV oranları, iskonto, tevkifat varsa, istisna) şemaya ve şematrona karşı
   doğrulanır; EDM'nin örnekleriyle alan alan karşılaştırılır. Kâhin: EDM/GİB örnekleri + şema (programdan bağımsız). Kırmızı kanıt: bozuk
   belge şemada düşmeli.
2. **Test ortamı:** EDM test servisine gerçek istekler — giriş, mükellef sorgusu, e-Arşiv gönder/iptal, e-Fatura gönder, durum sorgula, gelen
   fatura al; hata kodları; oturum düşmesi. EDM test portalında belgenin görünüşü ve XSLT ile basımı. Sonuçlar docs/kanit'e.
3. **Kabul ve açma:** kullanıcı "entegre et" deyince `edocEnabled` kurulumda açılabilir hâle gelir (lisans/ayar), ayrı sürüm; canlıya ilk belge
   kullanıcıyla birlikte, test faturasıyla.

## 4. Kör noktalar
- AĞ: bu bulut ortamı `test.edmbilisim.com.tr`'ye bağlanamıyor (13.10.2026 denendi: ağ politikası reddetti, 403). Adım 2 için: ortam ayarlarında
  bu alan adına izin verilir (ortam → Network access → Allowed domains: `test.edmbilisim.com.tr`, `dosya.edmbilisim.com.tr`) YA DA testler GitHub
  Actions'ta (açık internet) koşar — kimlik bilgisi GitHub secret olur. Karar kullanıcıda. Adım 1 ağsız yapılabilir (paket kullanıcıdan yüklenir).
- AĞ GÜNCEL (13.10.2026, kullanıcı ortam ayarında izin verdi): `test.edmbilisim.com.tr` ERİŞİLİYOR — `EFaturaEDM.svc?singleWsdl` 200, WSDL
  `targetNamespace="http://tempuri.org/"` (koddaki WSDL'siz varsayılan i2i ad alanından FARKLI; program WSDL'i okuduğu için uyum sağlamalı — işte
  ilk denetlenecek nokta). `dosya.edmbilisim.com.tr`'ye bağlanılamıyor: sunucunun SSL sertifika zinciri doğrulanamıyor ("unable to get local
  issuer certificate"); TLS denetimi KAPATILMAZ → belge paketi kullanıcıdan zip olarak yüklenir.
- ownCloud paketi 35,3 MB: kullanıcı "İndir" ile zip alıp oturuma yükler (ya da yalnız E-FATURA/E-ARŞİV + uç nokta docx + XSLT).
- Yasal: canlıya geçiş için firmanın EDM ile sözleşmesi, GİB'de e-Fatura/e-Arşiv kaydı ve mali mühür/e-imza (entegratör tarafında) gerekir;
  program bunu kendisi yapamaz. Test ortamından canlıya belge gitmemesi için adres + anahtar ayrımı testle korunur.
- e-Arşiv günlük rapor, iptal süreleri, e-Fatura kabul/red (ticari) ve gelen faturaların alış faturasına dönüşmesi akışları kapsamda.
