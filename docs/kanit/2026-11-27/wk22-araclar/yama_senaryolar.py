#!/usr/bin/env python3
# WK 22: senaryolar.py yaması — S23-04 / S29-03 tek okumaya iner (S-W21-3 = A), 5 yeni SW21 senaryosu (README §27.5; beklenenler ELLE).
import sys

yol = sys.argv[1]
s = open(yol, encoding="utf-8").read()


def degis(eski, yeni, n=1):
    global s
    k = s.count(eski)
    if k != n:
        sys.exit(f"eşleşme {k} ≠ {n}: {eski[:120]!r}")
    s = s.replace(eski, yeni)


degis('''# güncelleme 21 (README §26.4 S-W21-3): Meta Bekletti 2. denemesinden önce elle sayılan işin içeriği — taslak 5.2 ↔ S23 / S29 (iki okuma; kime / kaç kez aynı)
MBS = (''', '''# güncelleme 21 (README §26.4 S-W21-3): Meta Bekletti 2. denemesinden önce elle sayılan işin içeriği — taslak 5.2 ↔ S23 / S29 (iki okuma; kime / kaç kez aynı).
# Güncelleme 22 (README §27 Y22-8): S-W21-3 = A — okuma KALKTI; sabit yalnız tarihsel (hiçbir beklentide kullanılmıyor)
MBS = (''')

degis('''            "C5C4", "C5C5", "C5C6", "C5C7", "C5C8", "C5C9")   # kahin_test I4: bu başlıklar "eski senaryo" değil''',
      '''            "C5C4", "C5C5", "C5C6", "C5C7", "C5C8", "C5C9", "SW21")   # kahin_test I4: bu başlıklar "eski senaryo" değil (SW21: güncelleme 22)''')

degis('''   # güncelleme 21 (README §26.8): eski "16.10.2026 / 250,00 TL" → iki okuma (S-W21-3): S23 gönderim anı 16.10.2026 / 250,00 TL ya da 5.2 1. denemenin içeriği 06.10.2026 / 650,00 TL
   "isler.T1/MK.degiskenler": ["Mine Bekletilen", FIRMA, {"secenek": ["16.10.2026", "06.10.2026"], "susuyor": MBS}, {"secenek": ["250,00 TL", "650,00 TL"], "susuyor": MBS}, SUS7],''',
      '''   # güncelleme 21 (README §26.8): eski "16.10.2026 / 250,00 TL" → iki okuma (S-W21-3); güncelleme 22 (README §27.7): S-W21-3 = A — S23 gönderim anı: 16.10.2026 / 250,00 TL (B: 06.10.2026 / 650,00 TL — M321)
   "isler.T1/MK.degiskenler": ["Mine Bekletilen", FIRMA, "16.10.2026", "250,00 TL", SUS7],''')

degis('''   # güncelleme 21 (README §26.8): eski "30.10.2026 / 200,00 TL" → iki okuma (S-W21-3): S29 gönderim anı 30.10.2026 / 200,00 TL ya da 5.2 1. denemenin içeriği 06.10.2026 / 400,00 TL
   "isler.T1/MZ.degiskenler": ["Mert Bekleme", FIRMA, {"secenek": ["30.10.2026", "06.10.2026"], "susuyor": MBS}, {"secenek": ["200,00 TL", "400,00 TL"], "susuyor": MBS}, SUS7],''',
      '''   # güncelleme 21 (README §26.8): eski "30.10.2026 / 200,00 TL" → iki okuma (S-W21-3); güncelleme 22 (README §27.7): S-W21-3 = A — S29 gönderim anı: 30.10.2026 / 200,00 TL (B: 06.10.2026 / 400,00 TL — M321)
   "isler.T1/MZ.degiskenler": ["Mert Bekleme", FIRMA, "30.10.2026", "200,00 TL", SUS7],''')

YENI = r'''

# ======================================================================== kâhin güncellemesi 22 (2.5.1 Ç5-C, KULLANICI KARARI 27.11.2026 17:01 UTC "önerilerini uygula" — S-W21-1 / 2 / 3 = A; README §27)
# Elle beklenen YALNIZ karar girdisinden (kahin.KARARLAR SW21; c5c2-kararlar.md §1.1, §4) ve README §27.2 yorumlarından (kodlamadan önce yazıldı ve commit'lendi). Kime / tutar / neden GİRDİ (`borc`).
# Hesaplar her senaryonun açıklamasında. T0 = 30.10.2026 10:00 (İstanbul).
S("SW21-01-sonucu-belirsiz-yine-de-gonder-suren-soz-elle-gider-ayni-gun-bir-ertesi-gun-serbest", "SW21",
  "P1'in hatırlatması (1.000,00 TL) Sonucu Belirsiz; 11:00'de 20.10'a söz verilir (girdi: elle değer borcun tamamı 1.000,00 TL — taslak 2.3). 12:00 işteki Yine de Gönder: söz SÜRÜYOR → elle "
  "seçim sayılır (S-W21-1 = A, Y22-1/2), onay penceresinde 'Ödeme Sözü Var' (Y22-3 → soz_etiketi), ileti gönderim anındaki elle tutarla 05.10.2026 / 1.000,00 TL gider (POST 2; B olsaydı "
  "'Atlandı — Ödeme Sözü Var', POST 1). 13:00 yeni hatırlatma: 'Ödeme Sözü Var' ile elenir (2.5); 13:10 'Yine de Ekle' ile: söz aşılır ama o gün ileti gitti → 'Daha Önce Gönderildi' (4.1; uyarı 1, "
  "son 30.10; 6.4 elle seçim bunu aşmaz) — aynı gün en çok bir (onaylı Yine de Gönder dışında). 31.10 10:00 'Yine de Ekle' ile ertesi gün serbest → 1.000,00 TL gider. P1'e 3 POST",
  "SW21 (S-W21-1) + C5C6 (6.1, 6.4) + C5C4 (4.1, 2.5) + S16 (Y13-4) + H1 + K1 ★5", [
   bc("P1", "Pınar Söz", "0561 700 00 01", [bk("+0s", vade="05.10.2026", tutar="1000.00", bakiye="1000.00"),
                                            bk("+1h", SOZ_, elle=ell("05.10.2026", "1000.00", "1000.00"))])],
  [hb("+0s", "T1", ["P1"]), olay("+2h", "yine_de_gonder", toplu="T1", cari="P1", etiket="Y1"),
   hb("+3h", "T2", ["P1"]), hb("+3h10m", "T3", ["P1"], yine_de_ekle=["P1"]), hb("+1d", "T4", ["P1"], yine_de_ekle=["P1"])],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["P1"], "oneri": None, "soz_etiketi": ["P1"]},
   "isler.T1/P1.durum": TESLIM_E, "isler.T1/P1.post": 2, "isler.T1/P1.degiskenler": hd("Pınar Söz", "05.10.2026", "1.000,00 TL"),
   "elenen": {"T2": {"P1": SOZ_}, "T3": {"P1": DO}}, "olusmadi": ["T2", "T3"], "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}},
   "isler.T4/P1.durum": TESLIM_E, "isler.T4/P1.degiskenler": hd("Pınar Söz", "05.10.2026", "1.000,00 TL"),
   "meta.post": {"P1": 3}},
  meta_davranis={"mesaj": {"P1": ["yanitsiz_kabul", "kabul", "kabul"]}, "kanca": {"T1/P1": {"1": [], "*": K_STD}, "*": K_STD}})

S("SW21-02-bekleyen-belirsizlik-onayli-iste-soz-asil-iste-yeniden-basma-elle-ikinci-deneme-gonderim-anindaki-tutar", "SW21",
  "Q1'in hatırlatması Sonucu Belirsiz; 11:00'de işteki Yine de Gönder (söz YOK): ileti 06.10.2026 / 400,00 TL / bakiye 650,00 TL ile hazırlanır, Meta Bekletti (131049). 12:00'de söz verilir (girdi: "
  "elle değer borcun tamamı 650,00 TL). 14:00 asıl işte yeniden Yine de Gönder: S23'ün söz karşılığı (S-W21-1 = A 'aynı kural bekleyen belirsizlik onaylı işte …'; Y22-4) — bekleyen iş elle "
  "sayılır (elle_sayilan + soz_etiketi), yeni iş açılmaz, F1 uygulanmaz, Meta Bekletti beklemesi sürer (POST 2). 31.10 ~10:00 2. deneme: iz değişti → S-W21-3 = A: içerik gönderim anında "
  "elle değerlerle 06.10.2026 / 650,00 TL / 650,00 TL (B olsaydı donmuş 400,00 TL). Gün dönümü: ileti 31.10'da gitti → 31.10 11:10 'Yine de Ekle' ile yeni hatırlatma 'Daha Önce Gönderildi' "
  "(uyarı 1, son 31.10). POST 3",
  "SW21 (S-W21-1, S-W21-3) + S23 (Y15-1…4) + C5C5 (5.2) + C5C4 (4.1, N30) + §7a 14", [
   bc("Q1", "Kaan Söz Bekletilen", "0561 700 00 11", [bk("+0s", vade="06.10.2026", tutar="400.00", bakiye="650.00"),
                                                      bk("+2h", SOZ_, elle=ell("06.10.2026", "650.00", "650.00"))])],
  [hb("+0s", "T1", ["Q1"]), olay("+1h", "yine_de_gonder", toplu="T1", cari="Q1", etiket="Y1"), kontrol("+3h", "K1"),
   olay("+4h", "yine_de_gonder", toplu="T1", cari="Q1", etiket="Y2", hedef="asil"), kontrol("+5h", "K2"), kontrol("+25h5m", "K3"),
   hb("+25h10m", "T2", ["Q1"], yine_de_ekle=["Q1"])],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["Q1"], "oneri": None},
   "kontroller.K1.isler": {"T1/Q1": BEKLETTI},
   "yeniden.Y2": {"elenen": {}, "alinan": [], "oneri": None, "soz_etiketi": ["Q1"], "elle_sayilan": ["Q1"]},
   "kontroller.K2.isler": {"T1/Q1": BEKLETTI}, "kontroller.K2.toplam_post": 2,
   "kontroller.K3.isler": {"T1/Q1": TESLIM_E},
   "isler.T1/Q1.degiskenler": hd("Kaan Söz Bekletilen", "06.10.2026", "650,00 TL", "650,00 TL"), "isler.T1/Q1.post": 3,
   "elenen": {"T2": {"Q1": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}},
   "meta.post": {"Q1": 3}},
  meta_davranis={"mesaj": {"Q1": ["yanitsiz_kabul", "kabul", "kabul"]}, "kanca": {"Q1": {"1": [], "2": K49, "3": K_STD}, "*": K_STD}})

S("SW21-03-yine-de-ekle-sonradan-gelen-etiketle-atlanir-baslatmada-iki-etiket-birlikte-asilir-ayni-gun-yol", "SW21",
  "Hatırlatma X1 (söz), X2 (şüpheli), X3 (Şüpheli + Söz birlikte), X4 (Şüpheli + Söz, işaretsiz); 'Yine de Ekle' X1, X2, X3. Başlatma: X4 'Şüpheli Alacağı Var' ile elenir (2.5 sırasının ilki); "
  "toplu iş duraklatılır. 10:30'da X1'e şüpheli kaydı açılır, X2'ye söz verilir (girdi). 11:00 Devam Et (gönderim anı — S-W21-2 = A, Y22-5): X1 'Atlandı — Şüpheli Alacağı Var', X2 'Atlandı — "
  "Ödeme Sözü Var' (iz yalnız işaretlendiği andaki etiketi aşar); X3'ün izi iki etiketi birlikte aşar (Y22-7) → elle değerlerle 22.10.2026 / 250,00 TL / 800,00 TL gider. 12:00 yeni hatırlatma, "
  "'Yine de Ekle' X1, X2 (o anki iki etiket birlikte aşılır): Atlandı o gün almamış (ilke 1, 4.3) → X1 20.10.2026 / 700,00 TL / 1.000,00 TL, X2 21.10.2026 / 300,00 TL / 900,00 TL gider "
  "(çıkmaz yok — ilke 4); X4 yine 'Şüpheli Alacağı Var'. POST: X1 1, X2 1, X3 1",
  "SW21 (S-W21-2) + C5C6 (6.1) + C5C5 (5.3, 5.4) + C5C4 (4.3, 2.5) + G0 (1, 4)", [
   bc("X1", "Ayşe Sözlü", "0561 700 00 21", [bk("+0s", SOZ_, elle=ell("20.10.2026", "1000.00", "1000.00")),
                                              bk("+30m", SUP_, etiketler=[SUP_, SOZ_], elle=ell("20.10.2026", "700.00", "1000.00"))]),
   bc("X2", "Bora Şüpheli", "0561 700 00 22", [bk("+0s", SUP_, elle=ell("21.10.2026", "300.00", "900.00")),
                                                bk("+30m", SUP_, etiketler=[SUP_, SOZ_], elle=ell("21.10.2026", "300.00", "900.00"))]),
   bc("X3", "Cansu İki Etiket", "0561 700 00 23", [bk("+0s", SUP_, etiketler=[SUP_, SOZ_], elle=ell("22.10.2026", "250.00", "800.00"))]),
   bc("X4", "Deniz İki Etiket", "0561 700 00 24", [bk("+0s", SUP_, etiketler=[SUP_, SOZ_], elle=ell("23.10.2026", "150.00", "600.00"))])],
  [hb("+0s", "T1", ["X1", "X2", "X3", "X4"], yine_de_ekle=["X1", "X2", "X3"]), olay("+0s", "duraklat", toplu="T1"), olay("+1h", "devam", toplu="T1"),
   kontrol("+1h30m", "K1"), hb("+2h", "T2", ["X1", "X2", "X4"], yine_de_ekle=["X1", "X2"])],
  {"elenen": {"T1": {"X4": SUP_}, "T2": {"X4": SUP_}}, "olusmadi": [],
   "kontroller.K1.isler": {"T1/X1": ATL, "T1/X2": ATL, "T1/X3": TESLIM_E},
   "isler.T1/X1.atlanma_nedeni": SUP_, "isler.T1/X2.atlanma_nedeni": SOZ_, "isler.T1/X1.post": 0, "isler.T1/X2.post": 0,
   "isler.T1/X3.degiskenler": hd("Cansu İki Etiket", "22.10.2026", "250,00 TL", "800,00 TL"),
   "isler.T2/X1.durum": TESLIM_E, "isler.T2/X1.degiskenler": hd("Ayşe Sözlü", "20.10.2026", "700,00 TL", "1.000,00 TL"),
   "isler.T2/X2.durum": TESLIM_E, "isler.T2/X2.degiskenler": hd("Bora Şüpheli", "21.10.2026", "300,00 TL", "900,00 TL"),
   "meta.post": {"X1": 1, "X2": 1, "X3": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("SW21-04-yine-de-gonder-basma-anindaki-iki-etiket-birlikte-asilir-elle-iz-degismeyen-meta-bekletti-ayni-icerik", "SW21",
  "Y1'in hatırlatması (500,00 TL) Sonucu Belirsiz; 10:30'da Y1'e şüpheli kaydı açılır VE söz verilir (girdi: elle 200,00 TL / 500,00 TL). 11:00 işteki Yine de Gönder: basma anındaki iki etiket "
  "birlikte aşılır (S16 + S-W21-1 = A; S-W21-2 'işaretlendiği andaki etiketler' — Y22-2), onay penceresinde ikisi ('Şüpheli Alacağı Var', 'Ödeme Sözü Var'), ileti 07.10.2026 / 200,00 TL / "
  "500,00 TL gider (POST 2). Z1 'Yine de Ekle' (söz, elle 1.000,00 TL) ile seçilir; Meta Bekletti (131049); 12:00'de Z1 200 TL öder (girdi: elle 800,00 TL), söz sürer; 31.10 10:00 2. deneme: elle iz "
  "DEĞİŞMEDİ → 5.2 aynen, 1. denemenin içeriği 19.10.2026 / 1.000,00 TL (S-W21-3 = A 'elle iz değişmediyse 5.2 aynen'). POST: Y1 2, Z1 2",
  "SW21 (S-W21-1, S-W21-2, S-W21-3) + S16 (Y13-4) + C5C5 (5.2) + C5C6 (6.1) + §7a 14", [
   bc("Y1", "Emre İki Etiket", "0561 700 00 31", [bk("+0s", vade="07.10.2026", tutar="500.00", bakiye="500.00"),
                                                  bk("+30m", SUP_, etiketler=[SUP_, SOZ_], elle=ell("07.10.2026", "200.00", "500.00"))]),
   bc("Z1", "Figen Söz Bekletti", "0561 700 00 32", [bk("+0s", SOZ_, elle=ell("19.10.2026", "1000.00", "1000.00")),
                                                     bk("+2h", SOZ_, elle=ell("19.10.2026", "800.00", "800.00"))])],
  [hb("+0s", "T1", ["Y1"]), hb("+0s", "T2", ["Z1"], yine_de_ekle=["Z1"]), olay("+1h", "yine_de_gonder", toplu="T1", cari="Y1", etiket="Y1"),
   kontrol("+3h", "K1"), kontrol("+1d1h", "K2")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["Y1"], "oneri": None, "supheli_etiketi": ["Y1"], "soz_etiketi": ["Y1"]},
   "isler.T1/Y1.durum": TESLIM_E, "isler.T1/Y1.post": 2, "isler.T1/Y1.degiskenler": hd("Emre İki Etiket", "07.10.2026", "200,00 TL", "500,00 TL"),
   "kontroller.K1.isler": {"T1/Y1": TESLIM_E, "T2/Z1": BEKLETTI}, "kontroller.K2.isler": {"T1/Y1": TESLIM_E, "T2/Z1": TESLIM_E},
   "isler.T2/Z1.post": 2, "isler.T2/Z1.degiskenler": hd("Figen Söz Bekletti", "19.10.2026", "1.000,00 TL"),
   "meta.post": {"Y1": 2, "Z1": 2}},
  meta_davranis={"mesaj": {"Y1": ["yanitsiz_kabul", "kabul"], "Z1": [{"hata": 131049}, "kabul"]}, "kanca": {"T1/Y1": {"1": [], "*": K_STD}, "*": K_STD}})

S("SW21-05-soz-icin-elle-bekleyen-ise-supheli-asil-iste-yeniden-basma-s23-iz-iki-etiketi-asar", "SW21",
  "W1 'Yine de Ekle' ile (söz; elle 900,00 TL) seçilir; ileti Sonucu Belirsiz. 11:00 işteki Yine de Gönder: söz sürüyor (iz zaten aşıyor) → alınır, onayda 'Ödeme Sözü Var' (Y22-3), ileti 10.10.2026 / "
  "900,00 TL ile hazırlanır, Meta Bekletti. 12:00'de şüpheli kaydı açılır (girdi: elle 500,00 TL / 900,00 TL). 14:00 asıl işte yeniden Yine de Gönder: iz basma anındaki Şüpheli'yi aşmıyor → S23 "
  "(Y22-4 genel okuma): bekleyen iş elle sayılır, iz iki etiketi aşar (elle_sayilan + supheli_etiketi + soz_etiketi), F1 uygulanmaz. 31.10 2. deneme: iz değişti → S-W21-3 = A: gönderim anında "
  "elle değerlerle 10.10.2026 / 500,00 TL / 900,00 TL (iletide şüpheli tutar yok; B olsaydı donmuş 900,00 TL). POST 3",
  "SW21 (S-W21-1, S-W21-2, S-W21-3) + S23 (Y15-1…4) + C5C6 (6.1) + §7a 14", [
   bc("W1", "Gül Söz Şüpheli", "0561 700 00 41", [bk("+0s", SOZ_, elle=ell("10.10.2026", "900.00", "900.00")),
                                                  bk("+2h", SUP_, etiketler=[SUP_, SOZ_], elle=ell("10.10.2026", "500.00", "900.00"))])],
  [hb("+0s", "T1", ["W1"], yine_de_ekle=["W1"]), olay("+1h", "yine_de_gonder", toplu="T1", cari="W1", etiket="Y1"), kontrol("+3h", "K1"),
   olay("+4h", "yine_de_gonder", toplu="T1", cari="W1", etiket="Y2", hedef="asil"), kontrol("+25h5m", "K2")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["W1"], "oneri": None, "soz_etiketi": ["W1"]},
   "kontroller.K1.isler": {"T1/W1": BEKLETTI},
   "yeniden.Y2": {"elenen": {}, "alinan": [], "oneri": None, "supheli_etiketi": ["W1"], "soz_etiketi": ["W1"], "elle_sayilan": ["W1"]},
   "kontroller.K2.isler": {"T1/W1": TESLIM_E},
   "isler.T1/W1.degiskenler": hd("Gül Söz Şüpheli", "10.10.2026", "500,00 TL", "900,00 TL"), "isler.T1/W1.post": 3,
   "meta.post": {"W1": 3}},
  meta_davranis={"mesaj": {"W1": ["yanitsiz_kabul", "kabul", "kabul"]}, "kanca": {"W1": {"1": [], "2": K49, "3": K_STD}, "*": K_STD}})
'''

degis('''  **iki_sirket(), meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== üretim / denetim
''', '''  **iki_sirket(), meta_davranis={"kanca": {"*": K_STD}})
''' + YENI + '''

# ======================================================================== üretim / denetim
''')

open(yol, "w", encoding="utf-8").write(s)
print("tamam")
