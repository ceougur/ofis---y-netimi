# 2.4.5 bağımsız dar kontrol (aday245-1 6e58c0a; fark d2cef7c..6e58c0a, server + client + tools)

Yöntem: çalışan program (startTestServer, legacy anahtarları KAPALI, HUKUK_LICENSE_URL=127.0.0.1:9) + aynı veride eski kod (d2cef7c, ayrı kopya `git archive`).
Betikler bu klasörde; `node --disable-warning=ExperimentalWarning docs/kanit/2026-10-24/245-dar/<betik>` (eski kod: `ROOT=<eski kopya>`). Kanıt: *.json + *.log (tools/kanit.mjs kos).

## D1 — ORTA: ödeme olmayan alacak satırı (Değersiz Alacak; Stok → Satış İadesi) carinin vadeli borcunu kapatmıyor → bakiye 0 iken zil / Takvim / Vade Takip "Tahsil Edilecek Borç 1.000 (gecikmiş)"
- (a) `p1-degersiz.mjs`: elle Borç 1.000 (Vade −30 gün) + fatura 500 → Şüpheli Alacağa Al 1.500 → Değersiz Alacak Yaz 1.500. Gözlenen: bakiye 0; Kalan 1.000;
  takvim `account:Tahsil Edilecek Borç:1000:overdue`; Vade Takip Gecikmiş Tahsilat 1.500 (fatura 500 + cari 1.000). Beklenen: Kalan 0, kalem yok
  (BANKA-MODULU-PLAN §3.11b/3 "Değersiz Alacak Yaz … cari bakiyesi o tutar kadar kapanır"; §3.11b/5 "hatırlatmalar şüpheli tutarı ayrı gösterir";
  Alacak Yaşlandırma bakiyeye bağlı → bu caride 0 gösterir; iki rapor çelişir).
- (b) `p1b-stok-iade.mjs`: elle Borç 1.000 (vadeli) + Stok → Giriş "Satış İadesi" (reason return, açık hesap) 1.000. Gözlenen: bakiye 0, Kalan 1.000, takvimde
  1.000 gecikmiş. Beklenen: Kalan 0 — BAŞ MİMAR KARARI S1 "bağsız ödemeler (tahsilat/ödeme, çek/senet, İADE) en eskiden başlayarak dağıtılır".
- Kök neden: `server/lib/invoice-settle.mjs` classifyLine — `case "stock"` (satır 102) alacak satırını ve `default` dalı (111; origin "doubtful") Değersiz Alacak'ı
  borç tarafı YÜKÜMLÜLÜĞÜ (payDue) sayar; alacak tarafında ödeme değildir. Yeni kalem `server/routes/accounts.mjs` openDueItems (1578) bu Kalan'ı kullanır.
- Eski kodda: aynı veride FATURA tarafı da açık kalıyor (fatura 500 / 1.000 "overdue", `p1-degersiz` eski koşu, `p1c-fatura-stok-iade.mjs` eski = yeni) →
  fatura için 2.0.13/2.3.0'dan kalan sınıf; `account|` kalemi 2.4.5'te YENİ ve bu sınıfı zile / Vade Takip'e taşıyor. Para kaydı, bakiye, yevmiye değişmez.
- SORU: Değersiz Alacak ve Satış İadesi (stok) S1'de "bağsız ödeme" mi? (öneri: evet — iade S1'de adıyla var; değersiz alacak plan §3.11b/3'te bakiyeyi kapatır).
  Elle "Alacak Yaz" KS2 ile bilerek yükümlülük; ona dokunulmaz.

## D2 — DÜŞÜK: K6d.1 uygulanmamış
- BAŞ MİMAR KARARI K6d.1: Raporlar → "Cari Ekstre" sekmesine (hof-overview.js ekstre görünümü) "Ayrıntılı Ekstre" bağlantısı. 6e58c0a'da yok:
  `client/assets/hof-overview.js:486` başlık satırında yalnız "← Mizan" ve "Cari Kartını Aç"; `grep -n "Ayrıntılı" client/assets/hof-overview.js` → 0.
  Ayrıntılı Ekstre yalnız cari kartından (hof-accounts.js:369) ve Rapor Merkezi → Cari Ekstre kutusundan açılıyor.

## Temiz bulunan alanlar (denendi)
- Faturaların kapaması DEĞİŞMEDİ: `p3-fatura-esitlik.mjs` aynı rastgele 150 işlem (borç/alacak + vade, bağlı/bağsız tahsilat, satış/alış faturası, ayrı ve
  Mevcut Borç taksit kartı + tahsilat, çek al + karşılıksız, sil, düzelt) eski ve yeni kodda: fatura açık/durum ve cari bakiyeleri birebir aynı (tohum 7, 8).
- Kart Kalan = takvim (dues) = Vade Takip kalemi: `p2-rastgele.mjs` 5 tohum × 80–150 işlem, her işlemden sonra okundu, 0 fark (önbellek bayatlığı dahil).
- Kapılar: kayıt tahsilatı yazan/değiştiren başka uç yok (yalnız POST cases/:key/payments ve PUT payments/:id; ikisi 410, oturumdan sonra ilk iş); trash geri
  yükleme, Son Aktarımlar Geri Al, B1 bağ taşıma, banka "Atanmamış" bağlama (K1.1) yeni para doğurmuyor. Tablodan Aktar'ın ekranda başka girişi yok.
  Ürün varsayılanı kapalı: config yalnız `=== true`, server/server.mjs ve 002 şirketi (overrides devri) açmıyor, ortam değişkeni yok.
- Ön dolum: Açılış Bakiyesi (accountFirst), workspace.payment, pil/zil tablo kalemi tutarı boş; openingBalance önayarı veren başka çağıran yok.
- Uyarı kapısı: tablo tutar kalemi dues / Vade Takip / Projeksiyon / öbür sayfa yolunda yok; Anlık Durum özeti tablo okumuyor; deadlines KS6 (dueSources).
- 6a: kaynak başına dal (table/plan/cheque/invoice/bank/account), Ödendi Say yalnız due|, payDoc kart-önce + kapandı/iptal/iade/yetki iletisi, Vade Takip openRef.
- 6b: hofIdHeader = sunucu IDENTIFIER_HEADER; para etkisi yok (yalnız görünüm). 6c: makbuz / fatura / e-Belge PDF'i başlık yardımcısını kullanmıyor.
- s211 CSS: gizlenen paket düğmeleri onDom'da her çizimde açılıyor; .detail-actions'a program kendi düğmesini koymuyor.
