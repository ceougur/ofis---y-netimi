# 2.4.4 madde 8 (UI11) — dışa aktarım düğmeleri envanteri (önce → sonra)

Kaynak: 3a2f46a (madde 17 dalı) üstünde; satırlar SONRAKİ kod. Tür: L = liste, R = rapor (tek ad "PDF"/"Excel"); K = kart/belge (adlı kalır, 2.0.16).
Hepsi ortak aile: `HOF.outputButton` (hof-core.js) → `.hof-rep-out is-pdf | is-xlsx | is-print`, ortak simge, `aria-label` = "<ne> - <ad>", `title` dolu.

| # | Yer (dosya:satır) | Ekran | Tür | Önce (ad / aile) | Sonra (ad · erişilebilir ad) |
|---|---|---|---|---|---|
| 1 | hof-plans.js:421 (outputButtons :362) | Taksitler listesi | L | "Liste - PDF" + "Yazdır" / nötr hof-button | "PDF" · "Taksit Listesi - PDF"; "Yazdır" |
| 2 | hof-plans.js:483 | Taksit kartı | K | "Taksit Ekstresi - PDF" + "Yazdır" / nötr | aynı ad, ortak aile |
| 3 | hof-accounts.js:308, :322 | Cari listesi | L | "Cari Listesi - PDF" + "Yazdır" + "Excel" / nötr, Excel simgesiz | "PDF" · "Cari Listesi - PDF"; "Yazdır"; "Excel" · "Cari Listesi - Excel" |
| 4 | hof-accounts.js:361 | Cari kartı | K | "Cari Ekstre - PDF" + "Yazdır" / nötr | aynı ad, ortak aile |
| 5 | hof-stock.js:181 | Stok listesi | L | "PDF" + "Yazdır" + "Excel" (data-xlsx yok) / nötr | "PDF" · "Stok Listesi - PDF"; "Yazdır"; "Excel" (+ data-xlsx) |
| 6 | hof-stock.js:208 | Stok kartı | K | "Stok Kartı - PDF" + "Yazdır" / nötr | aynı ad, ortak aile |
| 7 | hof-invoices.js:2356 | Fatura kartı | K | "<Belge Türü> - PDF" / "Proforma - PDF" + "Yazdır" / nötr | aynı ad, ortak aile |
| 8 | hof-invoices.js:293 | Fatura listesi | L | "Liste - PDF" / "Liste - Excel" / renkli, simgesiz, ipucusuz | "PDF" / "Excel" · "Fatura Listesi - …" |
| 9 | hof-invoices.js:306 | Fatura seçim çubuğu | L (seçim) | "Seçilenleri PDF" / "Seçilenleri Excel" / nötr | AD KALDI (çubuktaki "Seçilenleri Kaydet/İptal Et/Sil/Gönder" ile aynı kalıp), ortak aile + ipucu |
| 10 | hof-cheques.js:161 | Çek / Senet listesi | L | "Liste - PDF" / "Liste - Excel" / renkli, simgesiz | "PDF" / "Excel" · "Çek / Senet Listesi - …" |
| 11 | hof-overview.js:366 exportButtons (kullanım :479, :519, :553, :683) | Raporlar → Cari Ekstre, Vade Takip, Nakit Akış, Çek / Senet | R | "PDF İndir" / "Excel İndir" / renkli, simgeli | "PDF" / "Excel" · "<sekme> - …" |
| 12 | hof-report-center.js:329-330 | Raporlar → Tüm Raporlar | R | "PDF İndir" / "Excel İndir" / renkli, simgesiz, ipucusuz | "PDF" / "Excel" · "<rapor adı> - …" |
| 13 | hof-bank.js:1681-1682 | Banka → Hareketler | R | "PDF İndir" / "Excel İndir" / renkli, simgesiz | "PDF" / "Excel" · "Banka Hareketleri - …" |
| 14 | hof-workspace.js:628 | Kasa | K (belge) | "Kasa Dökümü - PDF" / nötr, simgesiz | aynı ad, ortak aile |
| 15 | hof-reports.js:178 | Raporlar → Tablo Raporları | R | "Excel" / "PDF" / "Yazdır" (Yazdır dolu yeşil) / nötr | aynı ad, ortak aile · "Tablo Raporu - …" |
| 16 | client/admin.html:110 | Yönetim → Şirketler → Birleşik Rapor | R | "PDF" / "Excel" / nötr | aynı ad, ortak aile · "Birleşik Rapor - …" |
| 17 | hof-whatsapp.js:155 | WhatsApp ekstre gönderimi | K | "Ekstre PDF" / nötr büyük | "Cari Ekstre - PDF" (2.0.16 adı), ortak aile |
| 18 | hof-export.js:59-79, :168 | Ana tablo "Dışa Aktar" menüsü | menü | "Excel Dosyası (.xlsx)" … | DEĞİŞMEDİ (menü, düğme ailesi değil) |

Kapsam dışı (dışa aktarım değil, belge/satır işlemi): satırdaki "Makbuz" (hof-accounts.js:342, hof-plans.js:467, hof-workspace.js:1192/1196), e-Belge
"Resmî Görüntü" / "XML İndir" (hof-invoices.js:2336, :3530), "e-Belge XML (ZIP)" (seçim çubuğu), kurtarma anahtarı "Yazdır" (hof-auth.js), kılavuz bağlantısı.

Çift başlık: Fatura listesindeki `<h3>Fatura</h3>` kalktı (hof-invoices.js:288; pencere başlığı h2 "Fatura" kalır; kart/form/ayar h3'leri değişmedi).

Boy: ortak 32 px; süzgeç satırında (Taksitler/Cari/Stok) seçicilerle aynı 36 px (2.4.3 A12); Kasa araç satırı bütün düğmeleri satır boyuna (40 px) uzatır.

## Nasıl bozulur? (testler buradan)
1. Ad değişir, tam metin bekleyen test/kılavuz kırılır → senaryo-banka-210:2578, kılavuz 226/227/364 güncellendi; kaynak taraması eski adları yakalar.
2. Sınıf/öznitelik değişir, kod okuyucusu bozulur (Rapor Merkezi href güncellemesi `.hof-rep-out.is-pdf`, Yazdır `a[data-pdf]`, Kasa `data-pdf`, tablo raporu
   `data-export` / `data-print`) → öznitelikler korundu; e2e bağlantı adresi/indirme özniteliği denetler; run.mjs / senaryo-raporlar / banka-210 indirir.
3. Boy kayar (süzgeç satırında iki satıra kırılma) → uiux-ui11-244 Cari 36/36 px, senaryo-cari-243 A12.
4. Erişilebilir ad görünen yazıyı içermez ya da boş → uiux-ui11-244 her düğmede.
5. Fatura liste h3'ü kalkınca kart/form h3'ü de kalkar → senaryo-215/216/217, uiux-b-243 (kart/ayar h3'ü bekler).
6. Pasif (aria-disabled) Rapor Merkezi bağlantısı tıklanır → onClick `.hof-rep-out[aria-disabled]` aynı; CSS pasif görünüm korunur.
7. Yetkisiz kullanıcı / 002 şirketi: düğme yetkisi ve `<a href>` şirket yeniden yazımı (hof-boot.js) değişmedi (adres biçimi aynı) — ayrı test eklenmedi.
