# M1 — KDV Özeti: Önceki Dönemden Devreden KDV (2.5.1; S261) — RAPOR TASLAĞI

Taban: t251-taban (64396478). Ajan: M1 kod ajanı (high). Rapor adım adım yazılır.

## 0. NASIL BOZULUR (koddan ÖNCE)
1. Devreden hiç yok (ilk ay, mahsup hiç kullanılmamış şirket) → "Önceki Dönemden Devreden KDV" 0, ödenecek = hesaplanan − indirilecek (artıysa).
2. Devreden birkaç ay taşınır (MA: Şubat 1.140 → Mart, Nisan mahsupla taşınır → Mayıs 1.200 − 1.140 = 60).
3. Ödenecek aydan sonra yeniden devreden (ödenecek ay devredeni sıfırlar; sonraki ay alışı fazla → yeni devreden).
4. Mahsup fişi kesilmemiş ay (önceki ay mahsup edilmemiş → ön izleme 190'ı defterden okur; zincir kopar) — rapor ön izlemeyle aynı sayı + not.
5. Mahsup fişi silinmiş (geri alınmış) / yeniden kesilmiş → 190 ters kayıtla sıfırlanır; rapor yeni duruma uyar.
6. Aralık yıl başını aşıyor (Aralık'tan devreden Ocak'a; önceki yıldan devreden).
7. Tek ay / çeyrek / yıl / Tüm Zamanlar / boş dönem / gelecek dönem / ay ortasında başlayan ya da biten aralık.
8. İadeler (satıştan iade 191'de, alıştan iade 391'de — defter; rapor 391 / 191 satırları iadeleri düşülmüş) — net aynı.
9. Tevkifat (alıcı olarak kesilen 2 No.lu: 191 tam KDV, 360 ayrı; satışta kesilen: 391 KDV − tevkifat).
10. KDV İndirim Dönemi başka aya atılmış alış faturası (2.5.0 kuralı) — rapor ve mahsup ay ay aynı.
11. Kilitli dönem (mahsup yazılamaz ama ön izleme sayıları gösterilir) — rapor sayıları değişmez.
12. Defter Türü bilanço dışı (işletme / serbest meslek) — KDV hesabı defter türünden bağımsız.
13. Yetkisiz rol (raporu göremeyen 403; raporu görüp mahsup yetkisi olmayan aynı sayıları görür, düğme yok).
14. İki şirket (her şirketin kendi 190'ı; öbür şirketin mahsubu karışmaz).
15. Sonradan girilen, indirilecek KDV'yi azaltan kayıt (S4: önceki mahsuptan sonra) — ön izleme bunu sonraki aya taşır; rapor aynı.
16. Ekran = PDF = Excel; alt TOPLAM satırları; yön karışık raporda her yön ayrı TOPLAM.
