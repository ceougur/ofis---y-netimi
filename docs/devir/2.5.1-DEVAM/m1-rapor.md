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

## 1. TARAMA (koddan ÖNCE; taban t251-taban)
| Yer | Ne üretiyor / gösteriyor | M1'de |
|---|---|---|
| `server/routes/report-center.mjs` kdv-ozeti `build` — özet | "Hesaplanan KDV (391)", "İndirilecek KDV (191)" (fatura başlıklarından; iadeler düşülmüş), tevkifat, `[result ≥ 0 ? "Ödenecek KDV" : "Devreden KDV"]` = 391 − 191 (devreden YOK) | DEĞİŞTİ |
| aynı — tablo altı (`footerGroups.net`) | "Net KDV (Ödenecek)" / "Net KDV (Devreden)" = satırların işaretli KDV toplamı (devreden YOK) | DEĞİŞTİ (rapor `footers` verir) |
| aynı — özet "KDV Mahsup Fişi" / "Mahsuptan Sonra Değişen Ay" | `tax().offsetList()` (Ana Defter bir kez kurulur) | aynı liste, aynı kuruluştan (vatView.offsets) |
| `footerRows` (report-center.mjs, ortak) | yönü karışık raporda TOPLAM + Net | DEĞİŞMEDİ (KDV Özeti belge TOPLAM'larını yine bundan alır) |
| `run()` → `reportPdf` / `reportXlsx` (`server/lib/report-files.mjs`, `report-pdf.mjs`) | ekran = PDF = Excel aynı `rows` / `footers` / `summary` | DEĞİŞMEDİ (genel) |
| `client/assets/hof-report-center.js` | özet kartları ve tfoot genel çizim | DEĞİŞMEDİ |
| `client/assets/hof-tax.js` (KDV Mahsup Fişi penceresi) | ön izleme "Ödenecek KDV (360)" / "Sonraki Aya Devreden KDV (190)" · "kullanılan devreden" | DEĞİŞMEDİ |
| `server/routes/tax.mjs` `preview()` | devreden = `figureTable.of(ay).carry` = ay başından ÖNCEKİ bütün 190 satırlarının neti (max 0), S4 taşıması, fark o − i − p | hesap `monthPosition`'a ayrıldı (davranış AYNEN), `vatView()` ile rapora açıldı |
| `server/lib/general-ledger.mjs` `vatOffsetLines` | mahsup fişinin satırları | DEĞİŞMEDİ |
| `server/lib/report-worker.mjs` | KDV Özeti iş parçacığında koşmaz (`worker` bayrağı yok; orada `tax` yok) | DEĞİŞMEDİ |
| Mobil (`/api/mobil/reports/kdv-ozeti`) | 404 (mobilde fatura / vergi raporu yok) | DEĞİŞMEDİ |
| ANLIK DURUM / zil / Vade Takip | KDV göstermez (`git grep "Ödenecek KDV\|Devreden KDV\|Net KDV"`) | — |
| Kılavuz (HTML 371, 391) | "Net KDV" anlatımı | DOKUNULMADI (öneri §12) |

AÇIK NOKTA (koddan okundu): ön izlemenin "önceki aydan devreden"i **defterdeki 190 bakiyesidir** — ay ay hesap değil. 190'a yalnız KDV Mahsup Fişi yazar (`general-ledger.mjs` 786–794; geri alınan fiş aynı gün ters kayıtla sıfırlanır). Önceki ay mahsup edilmemişse zincir kopar: ön izleme o ayın sonucunu görmez, yalnız bir önceki ay için uyarı yazar ("… mahsup edilmedi; devreden KDV o ayın mahsubundan gelir"). İki okuma çıktı → §9 KULLANICIYA SORULMALI. Kodlanan: rapor ön izlemeyle AYNI sayı (görev metni: "Rapor mahsup ön izlemesiyle AYNI sayıyı göstermeli") + özette "Mahsup Edilmemiş Ay" notu.
