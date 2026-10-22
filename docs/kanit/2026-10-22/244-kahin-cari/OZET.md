# 2.4.4 madde 31a B — bağımsız cari/evrak/tutar kâhini: koşular ve farklar (22.10.2026)

Kâhin commit'i 94c9016 (taban fd0b0fc = birleştirme adayı 3). Kâhinler: `test/bagimsiz/cari/` (B1 Tablodan Aktar 5a–5c, B2 UX18),
`test/bagimsiz/tutar/` (B3 Netten Brüte, B4 e-SMM UBL). Kurallar ve kaynakları: her klasörün `KARARLAR.md`'si. Program kodu okunmadı.

## Koşular (tools/kanit.mjs kos kayıtları bu klasörde)

| Kayıt | Komut | Sonuç |
|---|---|---|
| taban-defter | `npm run test:kahin-defter` (fd0b0fc) | GEÇTİ 147/147 |
| taban-senaryo-kabul | `python3 test/bagimsiz/fark.py --senaryo test/bagimsiz/senaryolar/kabul-1-16.json` | GEÇTİ 182/182 |
| taban-senaryo-tohum3-islem200 | `python3 test/bagimsiz/fark.py --tohum 3 --islem 200` | GEÇTİ 1303/1303 |
| yeni-cari-elle-ve-tohum1-2 | `node test/bagimsiz/cari/kos.mjs` (8 elle senaryo + rastgele tohum 1–2 × 60 işlem + 13 mutasyon) | çıkış 1 · 1312/1364 · 52 fark (BULGU 12) · 13/13 mutasyon yakalandı |
| yeni-tutar-tohum1-3-adet50 | `node test/bagimsiz/tutar/kos.mjs --tohum 1-3 --adet 50` (+ 10 çapa satırı/tohum, 7 mutasyon) | GEÇTİ 3472/3472 · 7/7 mutasyon yakalandı |
| eski-163dd5d-cari | `KAHIN_PROGRAM_KOKU=<163dd5d kopyası> node test/bagimsiz/cari/kos.mjs --mutasyonsuz` | KIRMIZI 1096/1365 (269 fark) |
| eski-163dd5d-tutar | `KAHIN_PROGRAM_KOKU=<163dd5d kopyası> node test/bagimsiz/tutar/kos.mjs --tohum 1 --adet 50 --mutasyonsuz` | KIRMIZI 10/329 (gross-from-net POST 405) |

Hepsi `HUKUK_LICENSE_URL=http://127.0.0.1:9`, `nice -n 10`. Eski kod `git archive 163dd5d | tar -x` ayrı kopyada (ders 23).
Ham çıktılar: `ham-yeni-cari/`, `ham-eski-cari/`, `ham-yeni-tutar/` (fark, kâhin, program, Tablodaki Kişiler ham satırları).

## Farklar (fd0b0fc)

| # | Sınıf | Fark | En küçük yeniden üretim |
|---|---|---|---|
| F1 | **BULGU** (KULLANICI 5a "bakiye değişmez" + 5c "bir kez") | Tablodan Aktar karta taşıdığı cari tahsilatlarını Tablodaki Kişiler raporundan düşürüyor (sıfır kez sayılır): Elif 3.500 → 0, Selin 5.200 → 4.200, Burak 4.500 → 1.500; rapor kişiyi kalan borçtan fazla borçlu gösteriyor. Geri alınca döner. 163dd5d'de taşıma yok (bu yol yeni) | `b1-5a-tasima` k1, `b1-5c-rapor` k2, `b1-5a-bayat-ve-yeniden` k2, `b1-5b-borc` k1 |
| F2 | **BULGU** (PLAN §8.10 "Otomatik (En Eski)", §4.3/2 FIFO) | Faturaya bağlı evrak karşılıksız dönüp fatura yeniden açıldıktan sonra gelen bağsız tahsilat EN ESKİ açık faturayı (F1) değil daha yeni faturayı (F2) kapatıyor; yeniden açılan fatura en eskiden kapamanın dışında kalıyor. 163dd5d'de karşılıksız faturayı açmadığı için görünmüyordu (madde 15 ile gelen) | `b2-ux18-sira` k3–k5 (F1 1.000 / F2 0; kâhin F1 0 / F2 1.000); rastgele tohum 2 F20/F21, tohum 1 F5–F8 |
| F3 | İNCELE (AJAN değişmezi Σ açık = cari bakiye; kullanıcı kararı bağlı/kendi evrakı/ciroyu anıyor, bağsızı anmıyor) | Kapatılacak Fatura seçilmeden alınan evrak faturaları en eskiden kapatıyor, ama karşılıksız dönünce kapattığı faturalar açılmıyor: G1 0 / G2 500, cari bakiye 2.000 (1.500 "faturasız" kalıyor) | `b2-ux18-sira` k5; rastgele tohum 1 k3 |
| F4 | İNCELE (YAYGIN) | Tablodaki Kişiler, birden çok sekmeli tabloda (İcra + Ödeme Sözleri + Taksitler) taksit kayıtlarının Cari sütununa kişinin adı yerine iç anahtarı yazıyor ("satir:18f6814be644c238") — aynı adlı iki kişide de tek adlıda da | `b1-5c-rapor` k1–k3 (`rapor:<no>:ad`); `b1-5b-borc` |
| F5 | İNCELE (YAYGIN) | Karta doğrudan girilen taksit tahsilatı Tablodaki Kişiler alacağına girmiyor (K-3 1.500 → 0, kart tahsilatı 300 dahil) | `b1-5c-rapor` k3 |
| F6 | İNCELE (YAYGIN) | Faturanın kendi (peşin) çekinin bağı "Kapatılacak Fatura"dan kaldırılabiliyor (PUT invoiceId "" 200); fatura iptalinde o çek yine faturayla siliniyor | `b2-ux18-karsiliksiz` bdm |
| F7 | İNCELE (ÇATAL; GİB yazmıyor) | e-SMM'de stopaj belge toplamından yuvarlanıp kalemlere dağıtılıyor, KDV ve KDV tevkifatı kalem kalem yuvarlanıyor: c08 (3 kalem) stopaj 125,00 (kalem kalem 125,01), tevkifat 52,51 (belge düzeyi 52,50); 2 × 100,03'te KDV 40,02 ama stopaj 40,01. XML dip toplamları EDM anlamlarıyla ve Σ kalem = belge ile tutarlı | `ham-yeni-tutar/tutar-1.*` c07, c08 |

Kâhin hatası olarak düzeltilenler (programla karşılaştırmadan önce, senaryo geçerliliği): aynı seride fatura tarihleri artan olmalı (VUK sıra-tarih
reddi), faturanın kendi çeki ayrı silinemez/iptalde faturayla kalkar, açılış B 120 / A 500, nihai tüketicide 11111111111 ve 30.000 TL eşiği,
çözümsüz Netten Brüte (öbür kalemler Net'i aşıyor) reddi — hepsi KARARLAR.md'de etiketiyle.

## Tutan kurallar (fd0b0fc)

5a taşıma (tarih sırası, bütün, sığmayanda durma, en eski taksitten sayma, bakiye/Kasa aynı, geri al), 5b (mevcut borç, kısmi borçta
atlama + neden, faturalı/seçenek kapalı yeni borç, açılışsız cari yeni borç), 5c çift sekmede tek sayım (taşıma öncesi), ön izleme bayatlayınca
ret; UX18 bağlı kapama, fazlanın en eski açığa gitmesi, karşılıksızda bağlı/kendi evrakı faturasının açılması, tahsil/ciro, fatura iptalinde
bağın düşmesi, sil/geri yükle, bağ değiştir, 7 yasak bağın reddi (hiçbir satır yazılmadan), mizan 100/101/120/121/320/600/610/770;
Netten Brüte stopaj oranı (GVK 94/1, 94/2-b, elle oran), Net Ücret = yazılan tutar, en küçük brüt, KDV dahil fiyat, KDV/tevkifat/ödenecek,
ön hesap = kayıt, e-SMM XML dip toplamları ve kalem kimlikleri.

## Önerilen iş akışı satırları (ana oturum ekler; .github/workflows'a dokunulmadı)

package.json: `"test:kahin-cari": "node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs"`,
`"test:kahin-tutar": "node --disable-warning=ExperimentalWarning test/bagimsiz/tutar/kos.mjs --tohum 1-3 --adet 50"` (test/ci-kapi-listesi.test.mjs
her test:kahin-* betiğinin bir iş akışında koşmasını ister — betik iş akışıyla birlikte eklenmeli).
ci.yml (F1/F2 düzelince ya da bilinen sınıf kararı verilince): `node tools/kanit.mjs kos kahin-cari npm run test:kahin-cari` ve
`node tools/kanit.mjs kos kahin-tutar npm run test:kahin-tutar` + kapı `--beklenen` listesine `kahin-cari,kahin-tutar`.
Uzun Doğrulama: `node tools/kanit.mjs kos kahin-cari-tohum1-30-islem120 --sure 120 -- npm run test:kahin-cari -- --tohum 1-30 --islem 120`
ve `node tools/kanit.mjs kos kahin-tutar-tohum1-20-adet200 --sure 60 -- node --disable-warning=ExperimentalWarning test/bagimsiz/tutar/kos.mjs --tohum 1-20 --adet 200`.

## DENENMEYEN

Ekran yolları (Taksitler → Tablodan Aktar penceresi, carideki "+ Tahsilat" Çek/Senet yolunda Kapatılacak Fatura'nın korunması, Netten Brüte
düğmesi), 002 şirketi, yetkisiz kullanıcı, iki kişi aynı anda gerçek eşzamanlı istek (yalnız ön izleme–aktarım arası araya giren tahsilat),
eski sürüm verisinden göç, Excel'de ödenmiş taksit bilgili tablo (B7 türü) ve faturalı caride 5a/5b kapsamı dışı ayrıntılar, taksitli faturalı
caride bağsız tahsilat (SENARYO-DILI BELİRSİZ-7), iskontolu SMM'de birim fiyat (yalnız Net Ücret ve türetmeler), "ticari faaliyeti olan gerçek
kişi" alıcı (program TCKN'li kişiyi hep stopajsız sayıyor; GVK 94/1 basit usul dışı tacir gerçek kişiyi yükümlü sayar — elle oranla girilir),
e-SMM'nin gerçek EDM'ye gönderimi, GİB e-SMM UBL kılavuzu (bulunamadı), Windows.
