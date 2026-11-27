#!/usr/bin/env python3
# WK 22: kahin_test.py ikinci yama — I19 üreticisinde Sonucu Belirsiz (1. iletiye durum bildirimi yok) ve basış zamanı; değişmez (6): gönderilen her hatırlatmada kişinin o anki
# Şüpheli / Söz etiketleri işin işaretleme anlarında aşılmış olmalı, Tedarikçi'ye hiç gitmez (S-W21-2 A, 5.3–5.5).
import sys
yol = sys.argv[1]
s = open(yol, encoding="utf-8").read()


def degis(eski, yeni, n=1):
    global s
    k = s.count(eski)
    if k != n:
        sys.exit(f"eşleşme {k} ≠ {n}: {eski[:120]!r}")
    s = s.replace(eski, yeni)


degis('''    def meta_ileti(self, j, ts, programa):
        self.iz_ileti.append((j.sirket, j.cari, self.toplular[j.toplu].sablon, ts))''', '''    def meta_ileti(self, j, ts, programa):
        self.iz_ileti.append((j.sirket, j.cari, self.toplular[j.toplu].sablon, ts))
        self.iz_ileti_is.append((ts, j.anahtar, j.cari, self.toplular[j.toplu].sablon))    # güncelleme 22: değişmez (6) için iş anahtarıyla''')
degis('''        self.iz_ileti = []; self.iz_atla = []''', '''        self.iz_ileti = []; self.iz_atla = []; self.iz_ileti_is = []''')

degis('''                y_ = {"t": f"+{m + rnd.randint(20, 600)}m", "tur": "yine_de_gonder", "toplu": et, "cari": c_, "etiket": f"Y{k + 1}{c_}"}''',
      '''                y_ = {"t": f"+{m + rnd.randint(60, 900)}m", "tur": "yine_de_gonder", "toplu": et, "cari": c_, "etiket": f"Y{k + 1}{c_}"}''')

degis('''    mesaj = {}
    for c in ids:
        mesaj[c] = [rnd.choice(["kabul", "kabul", "kabul", {"hata": 131021}, {"hata": 131049}, "yanitsiz_kabul"]) for _ in range(4)]
    g = {"baslangic": "2026-10-30T10:00:00+03:00", "cariler": cariler, "olaylar": olaylar,
         "meta_davranis": {"mesaj": mesaj, "kanca": {"*": senaryolar.K_STD}}}''', '''    mesaj = {}; kanca = {"*": senaryolar.K_STD}
    for c in ids:
        mesaj[c] = [rnd.choice(["kabul", "kabul", "kabul", {"hata": 131021}, {"hata": 131049}, "yanitsiz_kabul"]) for _ in range(4)]
        if rnd.random() < 0.35:                                             # güncelleme 22: 1. ileti Sonucu Belirsiz (yanıtsız kabul + durum bildirimi yok) — Yine de Gönder'in yolu
            mesaj[c][0] = "yanitsiz_kabul"
            kanca[c] = {"1": [], "*": senaryolar.K_STD}
    g = {"baslangic": "2026-10-30T10:00:00+03:00", "cariler": cariler, "olaylar": olaylar,
         "meta_davranis": {"mesaj": mesaj, "kanca": kanca}}''')

degis('''    for (t_, c, n) in adaylar[:6]:''', '''    # (6) güncelleme 22 — gönderilen her Ödeme Hatırlatma iletisinde (gönderim anı = Meta anı − adım) kişinin Şüpheli / Söz etiketleri işin işaretleme anlarından birinde aşılmış;
    #     Tedarikçi'ye hiç gitmez (5.3 = S-C5C-5 A, 5.4, 5.5 = S-C5C-6 A, S-W21-2 A — README §27 Y22-5/6)
    for (ts, anahtar, c, sab) in b.iz_ileti_is:
        if sab != "hatirlatma" or "borc" not in next(cc for cc in g["cariler"] if cc["id"] == c):
            continue
        an_ = ts - b.adim
        et_ = etiket_an(c, an_)
        if kahin.TEDARIKCI in et_:
            h.append(f"(6) {anahtar} @{an_}: Tedarikçi'ye hatırlatma gitti")
        asilan = set()
        for x in isaret.get(anahtar.split("#")[0], []):
            if x <= an_:
                asilan |= etiket_an(c, x)
        kalan_ = (et_ & set(kahin.ELLE_ETIKET)) - asilan
        if kalan_:
            h.append(f"(6) {anahtar} @{an_}: işaretleme anlarında olmayan etiketle ({sorted(kalan_)}) ileti gitti")
    for (t_, c, n) in adaylar[:6]:''')
open(yol, "w", encoding="utf-8").write(s)
print("tamam")
