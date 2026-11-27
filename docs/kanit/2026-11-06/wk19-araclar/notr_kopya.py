# WK 19: eski kâhinin (eaa29f94, değişiklikten ÖNCE alınmış kopya) NÖTR kopyası — YALNIZ yeni girdi düzeneği, KURAL YOK:
#   (1) `yol_degisti {sirket, yol}` olayı tanınır: şirketin kipi değişir — işaret SIFIRLANMAZ (S58 kuralı yok);
#   (2) `kanca_kaydi {sirket}` olayı tanınır: etkisiz (S63'ün "kaybettirmez"i eski kâhinde zaten öyle — kayıt modeli yoktu);
#   (3) `ayar.baglanti_yollari {şirket: kip}`: imza kuralı (Meta bildiriminin imzası gönderimde, kabul varışta) şirketin kipine göre — işaret eskisi gibi WABA başına (S63 / BAŞ MİMAR (1) kuralı yok).
# Kullanım: python3 -I notr_kopya.py <eski kahin.py> <çıkış kahin.py>
import sys
s = open(sys.argv[1], encoding="utf-8").read()


def degistir(eski, yeni):
    global s
    n = s.count(eski)
    if n != 1:
        raise SystemExit(f"eşleşme {n}: {eski[:80]!r}")
    s = s.replace(eski, yeni)


degistir('''        if self.yol not in BAGLANTI_YOLLARI:
            raise ValueError(f"girdi: ayar.baglanti_yolu {self.yol!r} (yol1 / yol2)")
''', '''        if self.yol not in BAGLANTI_YOLLARI:
            raise ValueError(f"girdi: ayar.baglanti_yolu {self.yol!r} (yol1 / yol2)")
        self.yollar = dict(self.ayar.get("baglanti_yollari") or {})      # NÖTR: yalnız girdi düzeneği
''')
degistir('''        elif tur == "sirket_sil":''', '''        elif tur == "yol_degisti":                                      # NÖTR: kip değişir, işaret SIFIRLANMAZ (kural yok)
            self.yollar[o.get("sirket", "A")] = o["yol"]
        elif tur == "kanca_kaydi":                                      # NÖTR: etkisiz
            pass
        elif tur == "sirket_sil":''')
degistir('''        if not ek.get("imzali") and self.yol == "yol1" and "M250" not in self.mut:''',
         '''        if not ek.get("imzali") and self.yollar.get(self.bildirim_sirketi(wamid, ek) or "A", self.yol) == "yol1" and "M250" not in self.mut:''')
degistir('''            ek["olay_t"] = olay_t; ek["imzali"] = self.yol != "yol1"''',
         '''            ek["olay_t"] = olay_t; ek["imzali"] = self.yollar.get(j.sirket, self.yol) != "yol1"''')
open(sys.argv[2], "w", encoding="utf-8").write(s)
print("nötr kopya yazıldı")
