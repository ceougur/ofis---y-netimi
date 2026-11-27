# M1 TUR 2 — KDV Özeti: devreden KDV'nin ZİNCİRLİ hesabı (2.5.1; S-M1-1 = B) — RAPOR (taslak)

Taban `t251-m1-tur1` (60f1a0a7). PUSH YOK. Defter, KDV Mahsup Fişi ve ön izlemesi DEĞİŞMEZ — yalnız rapor.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
1. Hiç mahsup fişi yok (şirket mahsubu kullanmıyor): zincir ilk KDV ayından başlar (190 açılışı yoksa 0), her ay öncekinin devredenini alır; yıllık "Sonraki Döneme Devreden" yıl boyu birikmiş devreden olmalı (A'da yalnız son ayın farkı).
2. Ortada bir ay atlanmış (mahsupsuz), sonraki aylar da mahsupsuz: atlanan ayın sonucu (aynı formül) sonraki aya taşınır; not atlanan ayı söyler.
3. Atlanan aydan SONRAKİ ay mahsup edilmiş (kopuk zincir — karar (3)): o ayın fişi defterdeki 190'la (zincirden farklı) kesilmiş → rapor ZİNCİRİ gösterir + not (fişin kullandığı / zincire göre olması gereken iki sayı); yön değişiyorsa KULLANICIYA SORULMALI.
4. Ödenecek aydan sonra yeniden devreden: ödenecek ay devredeni sıfırlar (taşınmaz); sonraki ayın önceki devredeni 0.
5. Mahsup fişi silinmiş (geri alınmış) / yeniden kesilmiş: zincir mahsup fişine bağlı olmadığı için rapor sayıları değişmez (yalnız not / uyuşmazlık değişir); ön izleme defterden okur, ayrışabilir (karar (6)).
6. Bütün aylar sırayla mahsup edilmiş: zincir = defter (190) = ön izleme, ay ay (A = B; karar (3) değişmezi). S4 (mahsuptan sonra azaltan kayıt) ve "Güncel Değil" (mahsuptan sonra artıran kayıt) aylarında da ön izlemeyle aynı (fişin devredeni taşınır).
7. Yıl başını aşan aralık (Aralık → Ocak): zincir takvim sırasıyla, yıl sınırında kopmaz.
8. Verinin ilk ayından önce başlayan aralık / boş yıl: 0 / 0 / 0; aralığın ilk ayından önceki aylar zincire girer (aralığın ilk ayından başlatılmaz).
9. Hareketsiz aylar (391 / 191 yok, mahsup yok): devreden aynen taşınır; ay satırı yok; hareketsiz ay "mahsup edilmemiş" sayılmaz.
10. 190 açılışı: zincirin başlangıcı = ilk KDV ayından önceki 190 bakiyesi (açılıştan gelen devreden). Fişle 190'a yazılamıyorsa (alt defter hesabı) başlangıç 0.
11. KDV İndirim Dönemi başka aya atılmış alış: 191 dönem ayına; zincir dönem ayıyla.
12. İadeler ve tevkifat: 391 / 191 iadeler düşülmüş (aynı tablo), zincir aynı farkla.
13. Kilitli dönem: rapor sayıları kilitten bağımsız.
14. İki şirket: her şirketin zinciri kendi verisinden.
15. Gelecek / boş dönem: bugünkü zincirin son devredeni aynen; tablo boş.
16. Ekran = PDF = Excel; tablo altı = özet; ay satırları zincir sayılarıyla.
17. A ↔ B anahtarı: A'ya dönünce tur 1'in sayıları birebir (tur 1 beklentileri A kipinde yeşil kalmalı).
