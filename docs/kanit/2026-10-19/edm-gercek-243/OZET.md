# 2.4.3 son aday 05e64d0 — gerçek EDM TEST ortamı (19.10.2026, 04:25–04:34 UTC)

Komut (kimlik dosyası kullanıcının yüklediği .txt; çıktı maskeli): `node docs/kanit/2026-10-19/edm-gercek-243/betik.mjs <kimlik.txt> docs/kanit/2026-10-19/edm-gercek-243/pdf`
Commit 05e64d0 (ayrı worktree kopyası), gerçek sunucu kodu (`startTestServer`, edocLive, `testSeriesStart: null` = üretimdeki rastgele başlangıç),
sahte EDM YOK, TLS/vekil sunucu değişmedi, `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Çıkış kodu 0, 33/33 denetim (✓). Ham çıktı `kosu.log`; resmî PDF'ler `pdf/`.
Beklenen tutarlar ELLE (betikte sabit), programdan türetilmedi.

| Adım | Sonuç | EDM belge no | EDM son durum |
|---|---|---|---|
| Bağlantı sınaması | 200, giriş yapıldı, WSDL SOAP 1.1 55 işlem | — | — |
| 5 Tümünü Gönder (7 numarasız bekleyen, kayıt sırası karışık, tarihler 17/18/19.10) | 2 istek (4 + 3, remaining 3 → 0), 7 gönderildi, 0 hata | TEA…483 (17.10), …484 (17.10), …485 (18.10), …486 (19.10); TEF…116 (17.10), …117 (18.10), …118 (19.10) | 7/7 SUCCEED (e-Fatura "Alıcıya ulaştı") |
| 1 e-Fatura, mükellef + PK (Mükellef Sorgula ile), Kaydet ve Gönder | 200, TEMELFATURA SATIS | TEF2026452697119 | Alıcıya ulaştı. SUCCEED |
| 2a e-Arşiv kişi (TCKN 10000000146) | 200 | TEA2026209571487 | SUCCEED |
| 2b KÖ1 Nihai Tüketici: retail-account ilk 200 created=true, ikinci created=false aynı cari, 11111111111 carisi 1 adet | 200 | TEA2026209571488 | SUCCEED |
| 2c Nihai Tüketici 36.000 TL | 400 einvoice-party (gerçek kimlik zorunlu), belge yok | — | — |
| 3 MM1 e-Fatura: kâğıt alış "A 004512" (mükellef tedarikçi 4840847211) | referanssız 400 einvoice-return-reference (öneri A000000000004512); öneriyle 200, TEMELFATURA IADE, UBL BillingReference ID A000000000004512; asıl kayıt "A 004512" değişmedi | TEF2026452697120 | **EDM KABUL** — Alıcıya ulaştı. SUCCEED |
| 3 MM1 e-Arşiv: kâğıt alış "KR-77/2026" (mükellef olmayan şahıs 10000000078) | referanssız 400; öneri KR00000000772026 ile 200, EARSIVFATURA IADE | TEA2026209571489 | **EDM KABUL** — SUCCEED |
| 4 e-Fatura iadesi (Ticari profilli tedarikçi, asıl TBS2026000000123 TICARIFATURA; iade "TICARIFATURA" istendi) | 200, kayıt TEMELFATURA + IADE (MM2) | TEF2026452697121 | Alıcıya ulaştı. SUCCEED |
| 6 KÖ2 Müşteri Fişi Olarak Bırak | 200, FIS2026000000001, KAGIT, eStatus withdrawn; Durum Sorgula 409 einvoice-not-sent; denetim izi yalnız invoice.created + invoice.withdrawn (gönderim olayı yok) | — (EDM'ye gitmedi) | — |
| 7 Resmî PDF (1, 2a, 2b, 3×2, 4) | 6/6 200 application/pdf (80–84 KB), indirme adı "<no> Resmi Gorunum.pdf", veri klasöründe e-belge-gorunum/<ETTN>-sent.pdf önbelleği; karekod jsQR ile 6/6 çözüldü, sağ üst (0.80, 0.10); no/ETTN/tarih/VKN ve 4 belgede ELLE tutarlar fark 0 | — | — |

İade belgelerinin resmî görüntüsünde (pdftotext): "İade Edilen Fatura A000000000004512 09.10.2026" + açıklamada "İade edilen fatura: A 004512";
"KR00000000772026" + "KR-77/2026"; "TBS2026000000123".

Gözlemler (hata değil, bilgi): (a) e-Fatura durumları EDM test ortamında ~7 dk "processing" kaldı, sonra SUCCEED; (b) Mükellef Sorgula çok posta
kutulu alıcıda ilk etiketi (alfabetik) karta yazar — 3230512384 için "avsaroglupk@kollektif.com" seçildi, gönderim başarılı; (c) Müşteri Fişi olan
belgede canSend = true (2.4.3 kuralı: withdrawn belge sonradan e-Belge serisinden yeni numara alabilir).
DENENMEYEN: arayüzden (tarayıcı) aynı akış; canlı ortam; Windows; MM1'de alıcının red yanıtı (test ortamında alıcı yanıtı yok).
Kimlik bilgisi denetimi (commit öncesi): kullanıcı adı ve parola bu klasörün bütün dosyalarında (ham bayt + PDF metni) aranıp bulunmadı. Not: ilk denetimde kabuk `grep -P` Türkçe "ı" yüzünden kullanıcı adını BOŞ okudu ve her dosyayı "eşleşti" saydı (ders 4: okunamayan ≠ boş); denetim Node ile, betikle aynı kalıpla yinelendi.
