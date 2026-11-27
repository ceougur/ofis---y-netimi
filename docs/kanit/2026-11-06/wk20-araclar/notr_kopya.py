"""WK 20 nötr kopya: eski kahin.py (taban 39d6c28d) + YALNIZ iki KULLANICIYA SORULMALI hatası etkisiz — kural EKLENMEDİ.
  S59-a hatası → iş eski yoldan geçer (M263 yolu: Atlandı kalır, deneme sayılır) — karar yokken düşülecek yol;
  S61-a hatası → atlanır (S37 yolu: kişi alınır, gönderim anında 'Atlandı — Telefonsuz') — karar yokken düşülecek yol.
Kullanım: python3 -I notr_kopya.py <eski kahin klasörü> <hedef klasör>  (hedef klasöre kahin.py yazılır; öbür dosyalar KOPYALANMAZ)."""
import os
import sys

kaynak = open(os.path.join(sys.argv[1], "kahin.py"), encoding="utf-8").read()
A1 = '''            if not (j.elendi_neden in SILME_NEDEN.values() and guncel and rec.get("bekletti")):
                raise ValueError(f"KULLANICIYA SORULMALI S59-a (README §24.9): '{j.elendi_neden}' ile Atlandı olmuş işin ({j.anahtar}) "
                                 + ("son denemesi olmayan (zincirin eski / Meta Bekletti 1.) " if not guncel else "")
                                 + "iletisine geç teslim — ekran ('Teslim Edildi' / 'Atlandı') karar metninde yok (S59 yalnız silme talebiyle Atlandı olan Meta Bekletti işi) — kodlanmadı")
            if "M263" not in self.mut:'''
B1 = '''            notr_kal = not (j.elendi_neden in SILME_NEDEN.values() and guncel and rec.get("bekletti"))   # NÖTR: S59-a hatası yerine eski yol
            if "M263" not in self.mut and not notr_kal:'''
A2 = '''            if tp.sablon == "hatirlatma" and j.icerik_silindi and numara(self.kart_telefonu(j.cari))[1] == "telefonsuz":
                raise ValueError("KULLANICIYA SORULMALI S61-a (README §24.9): içeriği ve kart telefonu silinmiş Ödeme Hatırlatma işinde işteki Yine de Gönder — S61 'yeni gönderimle aynı' "
                                 "('Telefon Yok' ile alınmaz, iş Sonucu Belirsiz kalır) mı, S37 yolu (alınır, gönderim anında 'Atlandı — Telefonsuz') mı karar metninde yok — kodlanmadı")
'''
B2 = '''            pass                                                        # NÖTR: S61-a hatası yerine S37 yolu
'''
assert kaynak.count(A1) == 1 and kaynak.count(A2) == 1, "eski kodda beklenen satırlar yok"
kaynak = kaynak.replace(A1, B1).replace(A2, B2)
os.makedirs(sys.argv[2], exist_ok=True)
open(os.path.join(sys.argv[2], "kahin.py"), "w", encoding="utf-8").write(kaynak)
print("nötr kopya yazıldı:", os.path.join(sys.argv[2], "kahin.py"))
