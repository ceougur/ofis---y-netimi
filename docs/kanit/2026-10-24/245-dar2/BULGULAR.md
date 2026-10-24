# 2.4.5 ikinci bağımsız dar kontrol (aday245-2 8d73aad; fark 201ffef..8d73aad — D1/KS7 + G8 tek geçiş + istemci notu/şerit/bağlantı)

Yöntem: çalışan program (test/helpers startTestServer, legacyCasePayments/legacyTableTransfer KAPALI, HUKUK_LICENSE_URL=http://127.0.0.1:9, akan sahte saat
2026-10-20) + AYNI akış eski kodda (201ffef, `git -C /home/user/ofis---y-netimi archive 201ffef | tar -x -C <nd>/245-dar2/eski-201ffef` + node_modules cp -r).
Betikler `betik/`; çalıştırma: `cd <nd>/245-dar2/betik && node --disable-warning=ExperimentalWarning <betik>` (eski: başına `ROOT=<nd>/245-dar2/eski-201ffef`).
<nd> = /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad

## B1 — ORTA (para çekirdeği, GERİLEME): faturasız stok Satış İadesi (açık hesap) cari "Ödeme" ile geri ödenince fatura / vadeli borç açığı iade tutarı kadar EKSİK
- Yeniden üretme: `betik/s1-iade-geri-odeme.mjs` (çıktı `s1-iade-geri-odeme.txt`). Akış: satış faturası A 1.000 (−60 gün) + bağsız tahsilat 1.000 → fatura B 500
  (vade −20) → elle Borç 300 (vade −10) → Stok → Satış İadesi 300 (cariye) → cari kartından Ödeme 300 (iade bedeli geri ödendi). Bakiye 800.
- Gözlenen (8d73aad): B "200 Vadesi Geçti", borç Kalan 300 → Σ açık 500 ≠ bakiye 800; takvim/zil "Tahsil Edilecek Fatura … 200" (Vade Takip, Açık Faturalar aynı kapamadan).
  Beklenen (= 201ffef, 2.4.4 kuralı): B 500, Σ 800 = bakiye. İade alacağı en eski açık faturayı (B) kapatıyor, geri ödeme (out → borç tarafında ödeme) onu yeniden açmıyor.
- Kök: server/lib/invoice-settle.mjs:107 (stok 'return' alacak satırı → recvPay) + :128 default (cari "Ödeme" daima payPay); stok iadesinin geri ödemesine bağ yolu yok
  (fatura iadesinde iade belgesinin kendi geri ödemesi var: aynı akış "Fatura İadesi + Kendi Geri Ödemesi" 500/800 doğru).
- Dayanak (önceden yazılmış metin): invoice-settle.mjs:76 v2.1.0 R1 "iadenin GERİ ÖDEMESİ ödeme değil, iadenin alacağını geri alan yükümlülüktür … iade alacağı en eski
  açık satışı FIFO ile kapatıp geri ödeme onu yeniden açmıyordu (bakiye var, açık fatura yok)" — KS7 (a) bu sınıfı stok iadesine taşıdı; KS7 metni geri ödemeyi kapsamıyor.
- Not (fark DEĞİL, 201ffef'te de aynı): fatura iadesi + cari kartından Ödeme ile geri ödeme de 200/500 (2.1.0 R1c düzeni) — aynı sınıfın eski kolu.
- SORU (karar gerekir; düzeltme bende değil): stok iadesinin cari "Ödeme" ile geri ödenmesi R1'deki gibi iadenin alacağını geri alan yükümlülük mü sayılsın, yoksa sınır mı?

## B2 — DÜŞÜK (istemci metni para kuralını yanlış anlatıyor): "Bu ödeme carinin en eski açık borcundan başlayarak kapatır."
- client/assets/hof-accounts.js:1074 not hem Tahsilat hem ÖDEME formunda. Ödeme (out) borç tarafında ödemedir (invoice-settle.mjs:125–128): müşterinin borcunu HİÇ kapatmaz
  (B1 akışında görüldü), yalnız cariye olan borcumuzu (alış faturası, elle Alacak) kapatır. Karar metni (kullanıcı 24.10 ~19:26): "YALNIZ tahsilat formunda bilgi notu".

## Temiz bulunan alanlar (denendi, sayılarla)
- Rastgele tohumlu karışık dizi `betik/p-rastgele.mjs` tohum 1–8 × 150 işlem, eski ve yeni AYNI dizi (`rastgele-ozet-tam.txt`): stok satışı/iadesi/alımı/tedarikçiye
  çıkış, stok düzeltme (14'ü iade↔alım nedeni değişimi), stok sil + Silinenler'den geri yükle (21), şüpheliye al, Değersiz Alacak Yaz (19), değersiz sil (5) + geri
  yükle (2), cari satırı sil + geri yükle (14), Mevcut Borç kartı, bağlı/bağsız tahsilat, müşteriye Ödeme. Her işlemden sonra: fatura listesi (toplu yol, ≥9 faturalı caride
  allSettled) = fatura kartı (cari başına yol) açık/ödenen/durum; cari kartı Kalan = takvim = Vade Takip; takvim fatura kalemi = kart açığı → 8 tohum × 2 sürüm HATA 0.
  Eski↔yeni durum farkı yalnız KS7 satırı görmüş carilerde (KS7 görmemiş caride 0 fark); bakiye her adımda aynı; son yevmiye mizanı + ana defter uzlaşması + Kasa AYNI (t7, t8).
- İki şirket + 002 yedek → tahsilat → geri yükle (`betik/s2-sirket-yedek.mjs`, `s2-sirket-yedek.txt`): aynı adlı cari iki şirkette, sonuçlar karışmıyor; geri yüklemeden
  sonra takvim/fatura/Kalan yedek anındaki gibi (önbellek bayat değil; şirket başına ayrı örnek); 001 değişmedi. UYUŞMAZLIK 0 (iki sürüm).
- Kapsayan kart + KS7 (`betik/s3-kart-iade.mjs`, `s3-kart-iade.txt`): stoktan taksitli satış + eski fatura + iade 300/800 → Σ (fatura + kart kalanı) = bakiye (eski kodda 1.500/700,
  1.200/700 ayrışıyordu); trimCovers + FIFO çift saymıyor. BİLİNEN SINIR (eski kodda daha büyük): Değersiz 800 kartı küçültmez → 1.000 / bakiye 700 (eski 1.500 / 700).
- G8 kodu okundu: birleşik kapsam (invoiced ∪ dated), silinmiş cari, legacyClosing, işlem içi önbellek kuralı eski iki geçişle aynı; birim testler kapama-ks7-245 +
  kapama-tek-gecis-245 12/12 (`birim-yeni.log`). 'preturn' cari satırına ulaşmıyor (stok formu yalnız giriş+return; faturalı stok hareketi pay none).
- İstemci: şerit sırası pil nesnesini kapanışla bağlıyor (dizin kayması yok, yanlış kayda Tahsilat Gir riski yok); Ayrıntılı Ekstre bağlantısı canSee() + sunucu yetkisi.

## DENENMEYEN
- KS7 carilerindeki eski↔yeni farkların her birinin yönü tek tek kâhinle doğrulanmadı (kâhin c7 ana oturumda); e2e/ekran yok (API); 30+ cari ölçek yok; 'preturn' cari yolu yok.
