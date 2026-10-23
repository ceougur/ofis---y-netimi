# 31e tur 7 (N1–N6) — is/r31e-f, kod commit 82e2791 (taban aday17 = 30e9c90)

## Nasıl bozulur (testlerden önce yazıldı)
- N3: aynı adlı iki kişi yer değiştirir, ikisinin de tutarı değişir → bağ konuma göre yanlış kişiye gider.
- N1: Dosya No'lu tabloda dosya kapanıp aynı kişiye yeni numara açılır → eski dosyanın tahsilatı yeni dosyaya geçer, yeni dosyanın borcu eksik görünür.
- N5: Veriyi Kaldır / Sheet'te Olmayanları Kaldır / Sayfayı Sil bağlı kaydı uyarısız kaldırır → tahsilat, not, düzeltme hiçbir satırda görünmez.
  Ayrıca: aynı anahtar başka sayfada da var (yanlış uyarı); onay yeniden gönderilmez; liste bağı göstermez.
- N6: eski karttan bayat satir: anahtarına belge, görev, düzeltme, kayıt notu yazılır → kayıtsız veri.
- N4: tek tutar kolonu vergi başlıklı sekme ("Vergi Tutarı", "KDV", "Emlak Vergisi") Tablodaki Kişiler'den notsuz düşer, Vadeler'de görünür.
  Ayrıca seyrek "Kalan Borç" kolonu Takvim'de var, Kişiler'de yok. Tutar + KDV sekmesinde KDV borç sayılmamalı.
- N2: 20.000 satır, ters sıra + kolon: karesel kişi araması (Yerine Koy 18 + 16 sn, eşitleme 62 sn). Bekletilen eşitleme her turda yeniden hesaplanır.

## Kırmızı (aday17) → yeşil (82e2791)
- `ham/kirmizi-aday17-yeni-testler.out`: yeni testler aday17 kopyasında (/home/user/wt/r31e-f-eski, git worktree 30e9c90) 9 kırmızı. Nedenler iletide:
  - N3 f2 ve N5 Veriyi Kaldır / Sayfayı Sil: 409 beklendi, 200 geldi.
  - N1: kişiyle taşıma 1, beklenen 0.
  - N5 liste: `bonds` alanı yok. N2: `unchanged` yok. N6: belge 200.
  - N4: Kişiler'de yalnız İlker Su + Jale Er; Ali Seyrek yok.
  - Bu çıktıdaki eski söz notu beklentisi sonra kaldırıldı; aşağıdaki nota bakın.
- `ham/n5-n6-aday17.out` ↔ `ham/n5-n6-yeni.out` (betik/n5-n6-durum.mjs) — her yolun yanıt kodu ve DB sayısı:
  - aday17: belge, görev, düzeltme ve kayıt notu 200; bayat anahtara 4 satır yazıldı. Sheet'te yok kaldırma ve Veriyi Kaldır 200.
  - 82e2791: hepsi 409 record-gone, 0 satır yazıldı. Kaldırma yolları 409 bonds-unmatched, adla: "1 kaydın notu kaldırılacak satırlarda: Lale Ak."
- N4 (betik/tablo-kos.mjs):
  - vergi-tek: Kişiler aday17'de 900, 82e2791'de 19.500 = Vadeler 19.500.
  - vergi-tek2: Kişiler 64.800 = Vadeler.
  - notsuz: Ali Seyrek 500 Kişiler'de. Vadeler'deki fazla 3.300 söz kalemlerinin tutarıdır (söz borç değil, U2).
- Testler: `komsu-testler` 1061/1061 (75 dosya, liste not defterinde), `mutasyon-kimlik-bag` 27/27, `mutasyon-kimlik-bag-n2-yeniden` 2/2.
  - Son ikisi, bekleme anahtarına veri damgası eklendikten sonra M27 ve M28 için yeniden koşuldu.
  - `goc-v243` 46/46: v2.4.3'ün gerçek koduyla üretilen veri.
- e2e (flock altında):
  - senaryo-kayit-bag-31e 43/43: yeni D/E/F adımları; ekran görüntüleri `ekran/06–09`.
  - senaryo-225 55/55, senaryo-iz1-sayfa 21/21, senaryo-rapor 90/90, senaryo (Tablodan Aktar) 47/47, uiux-ui11-244 153/153, e2e (run) 50/50.

## Hız (N2), 20.000 satır + 5.000 not, tek tek, flock
- `ham/hiz-tablo.md`: aday16 (/home/user/wt/r31e-b-eski = 624810b) ile 82e2791 aynı makinede, art arda ölçüldü. Ham veri `ham/hiz-aday16-ve-82e2791.out`.
- Aday17 ölçümü koordinatörün turundan: `ham/hiz-aday17-koordinator.out` (P6 17.876 / 15.964 ms, P7 61.780 ms).
- Hedef senaryolarda (ters sıra + kolon) aday16'ya oran: P6 Yerine Koy toplam 1,25×, P7 eşitleme 1,36×.
- Diğer senaryolar en çok 1,45× (P4 Devamı toplam). P4'ün uygulama süresi 1,5–1,8× arasında oynuyor (üç ölçüm).
- Aday16 bağları taşımıyordu (görünen not 0). 82e2791 5.000 notu taşıyor (görünen not 5.000).
- Komut: `KOK=<ağaç> KOD=<ad> HUKUK_LICENSE_URL=http://127.0.0.1:9 node betik/hiz-20k.mjs`. Betikteki NB değişkeni geçici klasördür; değiştirilebilir.

## Not: söz sekmesi
- Ara sürümde, yalnız "Söz Tutarı" olan sekme için Tablodaki Kişiler'e bir not eklendi. Bu not A1 kararına aykırıydı: "söz sekmesi (borç değil) not açmaz", Nasıl bozulur B4.
- Sonuç: tablo-borc-r31e.test.mjs:195 kırmızıya döndü.
- Ürün geri alındı, A1 testinin beklentisi değişmedi. Sonra `komsu-testler` 1061/1061 geçti.
