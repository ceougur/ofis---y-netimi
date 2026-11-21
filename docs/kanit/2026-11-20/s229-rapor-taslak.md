# S229 + S230 küçük program turu — rapor taslağı (adım adım)

Taban: surucu5-uc = fce3d272. Ajan ağacı: .claude/worktrees/agent-a343eda2c3de7a0a1. Eski kod kopyası: scratchpad/s229-a343/eski (git archive surucu5-uc).

## 0. NASIL BOZULUR (koddan ÖNCE)
Gösterilen açık = faturanın kendi açığı − kart(lar)ın aldığı kısım. Bozulma yolları ve her birinde beklenen:
1. Kart faturanın bir KISMINI alır (S200 = A örneği: F1 50.000 + Borç Yaz 30.000, kart 60.000) → Açık Faturalar F1 20.000; fatura kartı "Açık 20.000" + "Taksit Kartında: <kart> · 30.000"; Faturalar listesi Kalan 20.000; Tahsilat Ekle / Mahsup Et 20.000 önerir.
2. Kart faturanın TAMAMINI alır → Açık Faturalar'da satır yok; Anlık Durum toplamına girmez; fatura kartı / liste "Taksitte"; Ödeme Durumu "Açık" süzgecinde (taksitli gibi), "Ödenmedi" süzgecinde değil.
3. Bir faturayı İKİ kart alır → iki "Taksit Kartında" satırı; gösterilen açık iki kartın payı düşülmüş.
4. Kart elle borç + iki fatura alır (S200 sırası: önce elle borçlar, eksik kısım faturalardan vade sırasıyla) → yalnız eski vadeli fatura düşer; iki TZ'de aynı.
5. Kartın taksiti tahsil edilir → fatura gösterilen açığı DEĞİŞMEZ (kart ödemesi önce kartın tükettiği eski kaleme — tüketim sırası); kartın kendi kalanı düşer (S118 = B).
6. Faturaya doğrudan tahsilat → kapama bugünkü gibi (fatura kendi açığına, fazlası en eski açık borca); veri tabanı satırları eski kodla BİREBİR.
7. Kart silinir / iptal edilir / Kartı Kapat 'Borçta Kalsın' (S205 / S220) → kartın kuralına göre fatura açığı geri gelir mi (kapsam payı sıfırlanırsa açık geri gelir).
8. Fatura iptali (S210 = A: kart kapanır) → iptal fatura listede İptal; kart kuralı değişmez.
9. İade faturası kartı küçültür (v2.0.24 coveredBy) → gösterilen açık iade sonrası.
10. Alış faturası / Alacak Yaz'lı cari (karar (5) netleşmesi) → Açık Faturalar'a GİRMEZ: alış faturası kendi tarafında, satış faturası netleşmeden.
11. Şüpheliye alınmış fatura (S213 = B) → Açık Faturalar'da kalır (withoutDoubtful YOK).
12. Değersiz yazılmış kısım (S227 = C) → bugünkü kural.
13. Mahsup edilmemiş iade belgesi (K1) → kendi satırında kalır.
14. Eski kapama düzeni (legacyView / legacyClosing) açık şirket → aynı kural (covered eski hesaptan).
15. Kilitli dönem; iki şirket; gün dönümü ve iki TZ (UTC, Europe/Istanbul); boş dönem; ileri tarihli kart / fatura; yetkisiz kullanıcı (Muhasebe rolü).
16. SINIR: Tahsilat / Mahsup formunun kabul ettiği tutar ve sunucunun kapaması DEĞİŞMEZ (aynı istek → aynı satırlar); Mahsup sunucu sınırı faturanın KENDİ açığı.
17. Yanlış düzeltme tuzakları (mutant listesi): kart payını düşmeyi unut; net: true'ya geç (karar (5) netleşmesi sızar); tam alınan faturayı listede bırak; iki karttan yalnız birini düş; Tahsilat Ekle önerisinde eski açığı bırak; Anlık Durum'u eski hesapta bırak.

## 1. TARAMA (koddan önce; `git grep openItems( / .open / payState / coveredBy / covered` server + client/assets, mobil, PDF / Excel, paylaşım metinleri)
| Yol | Bugün (taban) | Kapsamda mı | Yapılan |
|---|---|---|---|
| Açık Faturalar raporu (report-center `acik-faturalar` → `openItems(day, { returns: true })`; ekran + PDF + Excel + TOPLAM + özet) | faturanın kendi açığı | S229 | `openItems` net istemeyen yol gösterilen açığı okur (shownState); kartın tamamını aldığı fatura satır vermez |
| Anlık Durum fatura özeti (overview `openItems(day)`: açık / vadesi geçen satış, alış) — mobil `/api/mobil/overview` aynı uç | kendi açığı | S230 baş mimar yorumu (S229'u izler) | otomatik (openItems) |
| Fatura kartı: Açık satırı, ödeme durumu, büyük rakam, Tahsilat Ekle görünürlüğü ve önerisi, "Açık tutar" metni | kendi açığı | S230 | shape → shownState; `inPlans` (Taksit Kartında: <kart> · tutar, `data-open-plan`); `inPlan`, `ownOpen` alanları; Kalan büyük rakamı kart payında da |
| Faturalar listesi: Kalan, Açık Bakiye, Vadesi Geçmiş, Ödeme Durumu süzgeci (sayfalı leanRow + sayfasız), PDF (`liste.pdf`), Excel (`export.xlsx`) | kendi açığı | S230 | leanRow + shape → shownState (LIST_SQL'e plan_id eklendi — taksitli fatura kendi kuralında); kartın tamamını aldığı fatura "Taksitte" ('Açık' süzgecinde, 'Ödenmedi'de değil) |
| Mahsup Et formu (offsets GET): "Açık tutar", önerilen tutar, karşı fatura etiketi | kendi açığı | S230 | `suggest` (gösterilen) + karşı faturada `shownOpen`; SINIR `open` (kendi açığı) DEĞİŞMEDİ; kartın tamamını aldığı karşı fatura seçenek listesinde görünmez (istemci; taksitli fatura gibi) |
| Cari kartının fatura sekmesi (hof-accounts, liste ucu `tab=all&account`) | kendi açığı | aynı kalem → aynı kural | otomatik (liste ucu) |
| Cari tahsilat formu "Kapatılacak Fatura" seçenekleri (hof-accounts, liste ucu `pay=open`) | kendi açığı ("açık X") | aynı kalem → aynı kural | otomatik: kısmi "açık 20.000"; kartın tamamını aldığı fatura seçenek değil (taksitli gibi). Sunucu kabulü değişmedi |
| Satış / Alış / İade Faturaları raporları (report-center invoiceListReport → `list`): Ödenen, Kalan, Durum | kendi açığı | aynı kalem → aynı kural | otomatik; Ödenecek = Ödenen + Kalan + taksit kartında (sütun yok → 2.5.1) |
| Fatura e-posta / WhatsApp paylaşım metni (vade satırı `doc.open > 0`) | kendi açığı | aynı kural | otomatik: kartın tamamını aldığı faturada vade satırı yok |
| payDoc (zil / takvimden Tahsilat) | — | gösterim | kartta olan faturada "taksit kartında; tahsilat kartın taksitlerinden" bildirimi |
| Birleşik listeler (`openItems(day, { net: true })`: yaşlandırma, nakit akışı, Vade Takip, zil / takvim, `dueItems`) | TYK net (kart payı + karar (5) + şüpheli) | KAPSAM DIŞI | değişmedi (eski kapamanın net yolu da aynı formül) |
| Kapama, yazma yolları (`coverState`, `ownTarget`, `settledFor`, `repairScreen`), Mahsup sınırı (`addOffset`), editInvoice taksitlendirme reddi (`state.covered`) | kendi açığı | KAPSAM DIŞI | değişmedi (paymentStates çıktısı aynı; gösterim ayrı işlevde) |
| Kartın kendi kalanı, bakiye, gecikmiş, defter, mutabakat | — | KAPSAM DIŞI | değişmedi (para değişmezi betiği: BİREBİR) |
| e-Belge (UBL `covered` = ödeme kodu, ilgisiz), WhatsApp çekirdeği, banka | — | ilgisiz | dokunulmadı |

## 2. KOD (6e28069e)
- `server/routes/invoices.mjs`: `shownState(row, state)` TEK yer (paymentStates'in yanında): gösterilen açık = open − covered (taksitsiz, iade olmayan faturada); tamamı kartta → `installment` ("Taksitte"); alanlar `ownOpen`, `inPlan`. Okuyanlar: `shape` (fatura kartı + Faturalar listesi sayfasız / PDF / Excel / sayfadaki satırlar), `leanRow` (sayfalı süzgeç / toplam; LIST_SQL'e `plan_id`), `openItems` net istemeyen yol (Açık Faturalar + Anlık Durum), `inPlansOf` (fatura kartında kart adları — tek sorgu), `offsetCandidates.suggest` + karşı faturada `shownOpen` (SINIR `open` aynen).
- `client/assets/hof-invoices.js`: "Taksit Kartında: <kart> · <tutar>" (`data-in-plan`, `data-open-plan`); Kalan büyük rakamı kart payında da ("· taksit kartında X"); `isClosed` Taksitte'yi kapalı saymaz; Tahsilat / Mahsup metnine "Taksit kartındaki X kartın taksitlerinden tahsil edilir."; Mahsup önerisi `suggest`; karşı fatura etiketi / önerisi `shownOpen`, tamamı kartta olan karşı fatura seçenek değil; payDoc "taksit kartında" bildirimi.

## 3. TESTLER (kırmızı / yeşil)
- test/s229-acik-fatura-kart-payi-250.test.mjs (13 test): yeni kodda 13/13 UTC + İstanbul; taban (surucu5-uc) 11 kırmızı iki TZ — nedenler "Açık Faturalar F1: kalan 50000 (20.000 beklendi)", "kartın tamamını aldığı fatura listede: 50000", "Açık 40000" (K5), "50000 !== 20000" (K8, K12, K10 eski kapama); K9 (iptal) ve K11 (iade belgesi) değişmezlik testleri tabanda da yeşil (beklenen).
- Komşu (G2) 77 dosya, iki TZ: 1003/1021 — 18 kırmızı İKİ TZ'DE AYNI, hepsi eski gösterimi (fatura açığı = kart kalanı / kendi açığı) bekleyen beklentiler: bulgu-223 (5), iade-210, iade-geri-odeme-246, iade-kapama-k1, kapama-rastgele-223 (3 tohum; yalnız 'ödenen + açık = tutar' değişmezi), raporlar-210-banka, raporlar-224 (2), tyk-kapanis-dis-250, tyk-son-250, ux18-cek-fatura-244 (2). Güncellendi (6af09410): kapama kuralı testleri `ownOpen` okur + gösterilen ayrıca denetlenir; rapor testlerinin bağımsız beklenenine kartın kalanı düşüldü; değişmez 'ödenen + açık + kartta = tutar' ve 'kendi − kartta = gösterilen'. Güncel: 263/263 UTC + İstanbul; aynı 10 dosyanın ÖZGÜN hâli tabanda 262/262.
- Para değişmezi (test/s229-para-degismezi.mjs; 13 istek, biri bilinçli red): eski ↔ yeni cari satırları, kartlar, taksitler, kart tahsilatları, mahsup, şüpheli, fin_events, mizan, Mutabakat, Alacak Yaşlandırma, Geciken Taksitler, Taksit Kartları, nakit akışı, Vade Takip, zil, Anlık Durum (fatura özeti hariç) BİREBİR (fark 0) UTC + İstanbul. Mahsup sınırı iki kodda aynı: 45.000 kabul (gösterilen 40.000'den fazla), 10.000 red "faturanın açık tutarını (5.000,00 TL) aşamaz".
- Mutantlar (7/7 yakalandı): M1 kart payını düşme (11 kırmızı), M2 net: true (K6, K11), M3a tam alınan Taksitte değil (3), M3b tam alınan Açık Faturalar'da (3), M4 iki karttan biri (K3), M5a Mahsup önerisi eski (K1), M6 Anlık Durum eski (K1, K2). İstemcinin Tahsilat önerisi ekran yürüyüşünde (eski kodda "50000" → BEKLENEN DEĞİL).

## D. v2.4.9
- test/s229-eski-surum-250.test.mjs (bootVersion v2.4.9 → güncel): v2.4.9'da P / T / I 50.000 (Açık Faturalar, liste, kart 'Vadesi Geçti', Anlık Durum 150.000); güncelde (TYK ve eski kapama) P 20.000, T yok / Taksitte 0, I 20.000 + iki satır, Anlık Durum 40.000; bakiye aynı. Yeni 3/3 iki TZ; taban (surucu5-uc git worktree) 2 kırmızı iki TZ ("Açık Faturalar {P:50000,T:50000,I:50000}").
- İki en küçük örnek (test/s229-en-kucuk.mjs) v2.4.9 GERÇEK kodunda (git worktree --detach v2.4.9): Örnek 1 F1 50.000 (18 gün), Örnek 2 F1 50.000 (18 gün) — iki TZ; taban aynı (50.000 / 50.000); yeni: Örnek 1 F1 20.000 + "Örnek 1 Kartı · 30000", Örnek 2 satır yok, "Taksitte". Bakiye 80.000 / 50.000 üçünde aynı.

## G. Ekran yürüyüşü (test/e2e/yuruyus-s229-250.mjs; görüntüler docs/kanit/2026-11-20/s229-ekran/{yeni,eski})
- Yeni kod: beklenen dışı 0, sayfa hatası yok. Açık Faturalar (Tüm / cari süzgeci / tam kapsanan cari): F1 Kalan ₺20.000, TOPLAM Alacak ₺20.000, tam kapsanan satır yok; fatura kartı "Açık: ₺20.000" + "Taksit Kartında: Yürüyüş Kısmi Kartı · ₺30.000" (bağlantı taksit kartını açtı), başlık "Kalan ₺20.000 · Genel Toplam ₺50.000 · taksit kartında ₺30.000"; Mahsup Et önerisi 20000, Tahsilat Ekle önerisi 20000; ekrandan insan hızıyla 20.000 tahsilat → veri tabanında F1'e bağlı TEK 20.000 satırı, F1 "Taksitte"; tam kapsanan fatura "Taksitte", Tahsilat Ekle yok; Faturalar listesi 'Açık' süzgecinde iki satış "Taksitte" (Kalan —), Açık Bakiye ₺30.000 (yalnız alış); Anlık Durum açık / vadesi geçen satış 0 / 0, açık alış 30.000.
- Eski kod (aynı betik): 16 beklenen dışı (Açık Faturalar 50.000 ve tam kapsanan satırı, öneriler 50000 / 30000, Taksit Kartında yok, Açık Bakiye 110.000, Anlık Durum 80.000) — tahsilatın veri tabanı satırı eski kodda da aynı (20.000, F1'e bağlı).
- Gözlem (S229 = A'nın sonucu, karar dışı değil): cari süzgeçli Açık Faturalar'da "Net (Borç Fazlası) ₺10.000" — Alacak 20.000 − alış 30.000; cari bakiyesi 50.000 alacak (kartın 60.000'i raporda değil). Önceden Net 20.000 Alacak Fazlası idi (o da bakiyeye eşit değildi: Borç Yaz raporda yok).

## A–C, G (ders 28)
- A. Defter kâhini: yeni 187/187 UTC + İstanbul, taban 187/187 UTC + İstanbul (Açık Faturalar'ın R-S200 farkı bu kümede yok — o fark sürücüde; değişen denetim yok).
- B. Cari kâhini: taban 17.648/17.648 iki TZ; yeni 17.602/17.648 iki TZ — 46 fark, iki TZ'de aynı, hepsi Mevcut Borç kartlı senaryolarda (c11-ks81, d34-s110, d36-s122, d37-s126, d38-s128): `k*:fatura:<F>:acik` (program gösterilen 0 / 10.000–30.000 ↔ kâhin faturanın kendi açığı) ve onlardan türeyen `k*:cari:<C>:acikToplam` + `acikEsitBakiye` (KS8.1 Σ açık = bakiye). Yapım aşaması listesi kendi kopyada yeniden üretildi: 0 → 46 kayıt, hepsi "AYRIŞTIRILMADI". → BAŞ MİMAR KARARI GEREKİYOR (aşağıda).
- C. Muhasebe sürücüsü (değiştirilmedi) iki TZ: s118 af1 / af3 AYNI (R-S200 kalktı; program artık kâhinin listelemediği satırı vermiyor → 2 denetim eksildi). Toplam AYNI 7.252 · U 508 · P 18 · K 0 · R 4 (yalnız R-B5, UTC) · SINIFLANMADI 0 · ÖLÇÜLEMEDİ 120 · SUSMA 22 · # fail 22 (taban 28 = −6, R-S200 satırları). Yeni fark YOK. siniflama.json'daki R-S200 kuralı artık ateşlemiyor → sürücü bakımına (kaldırılabilir).
- G (ders 28): Mevcut Borç kartı + fatura gösteren 6 ekran senaryosu (senaryo-213, senaryo-c7b-tur3-250, senaryo-ekstre-ayrinti-247, senaryo-is-akisi-248, senaryo-mobil-yazma-247, senaryo-tyk-tur2a-250) yeni kodda GEÇTİ (64 + 32 + 34 + 184 + 74 + 51 = 439/439). Kılavuz testleri + yazım düzeni 23/23; pdf-denetle 39/39.

## E. Hız (s229-kanit/hiz.txt, hiz-tablo.md)
Temiz 100 bin kopyası (1.484 cari, 102.295 cari satırı, 34.026 fatura, 10.600 Mevcut Borç kartı) her koşuda taze (/dev/shm); özel kilit; eski ↔ yeni dönüşümlü 3 tur × 3 tekrar; başta yük 1,07–1,59 (hepsi < 2). Kötüleşen yol 0. En yakın: soğuk ilk Açık Faturalar en iyi 1.619 → 1.757 ms (+%8,5), ortanca 1.651 → 1.804 (+%9,2). Olay döngüsü ölçeri soğuk Anlık Durum'da (önbelleksiz ~2,6 sn, iki kodda aynı) örneklerin çoğunda 0 yazdı — iki kodda aynı ölçer; ölçüm nüansı (2.5.1).

## F. Değişmezler
Para değişmezi betiği BİREBİR (iki TZ); her test sonrası Mutabakat true (para değişmezi dökümünde); kâhinlerin defter mutabakatı denetimleri yeşil.

## KULLANICIYA SORULMALI
Yok (S229 / S230 / S200 / S213 / S210 / S118 kararlarının söylemediği para kuralı çıkmadı).

## BAŞ MİMAR KARARI GEREKİYOR
1. Cari kâhini 46 fark + yapım aşaması listesi 0 → 46 (CI'nin kâhin-cari adımı kırmızı olur). Kâhin `k*:fatura:<F>:acik` (C13.4: faturanın KENDİ açığı) ve KS8.1 (Σ açık = bakiye) için programdan fatura kartının `open` alanını okuyor; S230 = A ile o alan GÖSTERİLEN açık oldu, kendi açığı `ownOpen`. Seçenekler: (a) ÖNERİ — kâhin sürücüsü (test/bagimsiz/cari, ana oturum) C13.4 / KS8.1 için `ownOpen ?? open` okusun (kapama kuralı değişmedi → kâhin beklentisi değişmez); S229 / S230 gösterim kuralı sonraki kâhin bakımında ayrı denetim olarak eklenir; (b) API'de `open` faturanın kendi açığı kalsın, gösterim yeni alanda (shownOpen) — 10 komşu test değişmezdi, kâhin yeşil kalırdı ama her gösterim yolu (fatura kartı, iki liste ucu, cari kartı fatura sekmesi, Kapatılacak Fatura seçicisi, Satış / Alış Faturaları raporları, PDF / Excel, paylaşım metinleri) tek tek yeni alana geçmek zorunda — bir yol kaçarsa sessizce eski sayıyı gösterir. Gerekçe (a): tek kural tek alanda; kaçan gösterim yolu riski yok.
2. Kartın tamamını aldığı karşı fatura Mahsup Et seçeneklerinde ve cari tahsilat formunun "Kapatılacak Fatura" seçeneklerinde artık görünmüyor (taksitli faturalar gibi; sunucu kabulü ve sınırı DEĞİŞMEDİ). Karar metni "taksitli faturalar gibi" diyor; yorum olarak işaretlenir.
3. Kartın tamamını aldığı fatura her zaman "Taksitte" (kartın taksiti gecikse de "Vadesi Geçti" değil — kart birden çok kalem taşıdığı için gecikmiş faturaya atanamaz); taksitli faturanın kendi kartında gecikmiş "Vadesi Geçti" olur. Karar metni "'Taksitte' görünür" diyor.

## SONRAKİ SÜRÜME (2.5.1)
- Faturalar Excel'i ve Satış / Alış / İade Faturaları raporunda "Taksit Kartında" sütunu yok: Ödenecek = Ödenen + Kalan + taksit kartında (sayılar doğru; görünüm ayrıntısı).
- Sürücü siniflama.json'daki R-S200 kuralı artık ateşlemiyor (sürücü iç bakımı).
- Hız ölçerinin olay döngüsü örneklemesi soğuk istekte 0 yazıyor (ölçüm nüansı).
- Cari süzgeçli Açık Faturalar'da Net (Alacak − Borç) cari bakiyesine eşit değil (Borç Yaz ve kart raporda yok) — S229 öncesi de böyleydi.

## DOĞRULANMADI
- Birleşik şirket raporunun "Açık Satış Faturası" sütunu (companies.mjs, Anlık Durum'u okur) iki şirketle denenmedi; koddan aynı `compute()`.
- Mobil özet (/api/mobil/overview → aynı uç) ayrıca açılmadı.

## DENENMEYEN
- Kilitli dönemde kapsanan fatura; ileri tarihli kart / fatura; boş dönem (Açık Faturalar tarih süzgeci yok); iki şirket; Değersiz yazılmış kısım (S227 = C).
- Tam `npm test` (görev gereği yok); ci.yml'nin bütün e2e listesi (yalnız Mevcut Borç kartı + fatura gösteren 6 senaryo).
- Mutantlar yalnız s229 testinde UTC'de.

## CI listesine eklenecek
- test/s229-acik-fatura-kart-payi-250.test.mjs, test/s229-eski-surum-250.test.mjs (node --test kümesi; dosya adı kalıbıyla zaten girer mi ana oturum denetler); test/e2e/yuruyus-s229-250.mjs (ekran — ci.yml'ye EKLENMEDİ).
