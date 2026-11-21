import sys
p = sys.argv[1]
t = open(p, encoding='utf-8').read()


def rep(old, new, cnt=1):
    global t
    n = t.count(old)
    assert n == cnt, (old[:80], n)
    t = t.replace(old, new)


# (a) ETIKET / KIMLIK: C7b6-KAPAT kalkar
i = t.index('    "C7b6-KAPAT": ("kullanıcı kararı 05.11 21:30 (6)')
j = t.index('\n', i)
t = t[:i] + t[j + 1:]
rep('    "C7b6-KAPAT": "Ç7b-(6)",\n', '')
rep('''    # KG8-IADE-KDV, KG24-IHRACAT, F06-GIDER-TURU BUGÜN dönüşümleri kalktı (program = kâhin olmalı; değilse fark önce HATADIR — ders 6). Kalan: Kartı Kapat 'Borçta Kalsın' (Ç7b tur 3).
''', '''    # KG8-IADE-KDV, KG24-IHRACAT, F06-GIDER-TURU BUGÜN dönüşümleri kalktı (program = kâhin olmalı; değilse fark önce HATADIR — ders 6). Kalan: Kartı Kapat 'Borçta Kalsın' (Ç7b tur 3).
    # SÜRÜCÜ BAKIMI 5 (20.11.2026; Ç7b tur 3b + taksit küçük turu + kâhin bakımı 14): C7b6-KAPAT dönüşümü KALKTI — Kartı Kapat 'Borçta Kalsın' (karar (6), S205 / S220 = A) programda
    # (Ç7b tur 3b; kartın kapanış kuralı işareti). Kâhinin `eski: true` kartı programda göç 53'ün işaretiyle ('2.4.9') kurulur (program.mjs taksit_kapat). BUGÜN görünümünde Kartı Kapat = kâhin.
''')
rep('''    if tur == "taksit_kapat" and v.get("bugun_eski"):
        et.add("C7b6-KAPAT")        # BUGÜN modelinde Kartı Kapat 2.4.9 kuralıyla (kâhin `eski`): kalan 689 / CH — karar (6) "Borçta Kalsın" Ç7b'de
''', '')
rep('''def bugun_olay(o):
    """BUGÜN modeli için olay: Kartı Kapat bugün (2.4.9) kalanı 689'la borçtan düşer — kâhinin kendi `eski` dalı (README R6; karar (6) Ç7b'de değişir)."""
    if o.get("tur") == "taksit_kapat" and not o.get("eski"):
        return dict(o, eski=True, bugun_eski=True)
    return o''', '''def bugun_olay(o):
    """BUGÜN modeli için olay. SÜRÜCÜ BAKIMI 5: Kartı Kapat 'Borçta Kalsın' (karar (6), S205 / S220 = A) programda (Ç7b tur 3b) — önceki 2.4.9 dönüşümü (kalan 689;
    kâhinin `eski` dalı) KALKTI; olay olduğu gibi (kâhinin `eski: true` kartı iki görünümde de eski kural — program.mjs göç 53 işaretiyle kurar)."""
    return o''')
# BEKLEYEN_ONEK: Ç7b koda girdi
rep('BEKLEYEN_ONEK = ("Ç7b", "D4", "D2")   # henüz ana dala girmemiş paketler: bu kimlikli satırda eski kuralın (BUGÜN) karşılığı geçerli kalır (U)',
    'BEKLEYEN_ONEK = ("D4", "D2")   # henüz koda girmemiş paketler: bu kimlikli satırda eski kuralın (BUGÜN) karşılığı geçerli kalır (U). SÜRÜCÜ BAKIMI 5: "Ç7b" kalktı —\n'
    "# Ç7b'nin kuralları (karar (4) kart küçülmesi, S15 = A, karar (6) / S205 / S220 Borçta Kalsın, S210 / S211) sınanan kodda (c7b-aday); fark artık önce HATADIR (ders 6).")
# S213 susması (S192 biçimi)
rep('''SUSMALAR = [(x["cari"], x["tarih"], x.get("kaynak", ""), x.get("kural", "")) for x in (B["dallar"].get("A", {}).get("susmalar") or []) if x.get("kural") != "S192"]''',
    '''# SÜRÜCÜ BAKIMI 5: kâhin bakımı 14'ün `susmalar` "S213" kaydı (Açık Faturalar ↔ Değersiz yazılmış şüpheli fatura; biçimi S192 ile aynı — README bakım 14 "Sürücü için" A3) S192 gibi
# yalnız listelenen raporda; önceki sürücü S192 dışındaki her kaydı S168 sayardı (S213 o günden sonraki BÜTÜN raporlarda 120 / 128'i susturacaktı).
RAPOR_SUSMALARI = ("S192", "S213")
SUSMALAR = [(x["cari"], x["tarih"], x.get("kaynak", ""), x.get("kural", "")) for x in (B["dallar"].get("A", {}).get("susmalar") or []) if x.get("kural") not in RAPOR_SUSMALARI]''')
rep('''S192 = {(x["cari"], x["rapor"]): x for x in (B["dallar"].get("A", {}).get("susmalar") or []) if x.get("kural") == "S192"}''',
    '''S192 = {(x["cari"], x["rapor"]): x for x in (B["dallar"].get("A", {}).get("susmalar") or []) if x.get("kural") in RAPOR_SUSMALARI}''')
rep('''    return f"kâhin susar (S192; kâhin bakımı 13 `susmalar`): {c} {rapor_adi} {x.get('tarih', '')} — kalem / vade dağılımı karşılaştırılmaz"''',
    '''    if x.get("kural") == "S213":
        return f"kâhin susar (S213; kâhin bakımı 14 `susmalar`): {c} {rapor_adi} {x.get('tarih', '')} — Değersiz yazılmış şüpheli faturalı carinin Açık Faturalar satırları karşılaştırılmaz (toplam karşılaştırılır)"
    return f"kâhin susar (S192; kâhin bakımı 13 `susmalar`): {c} {rapor_adi} {x.get('tarih', '')} — kalem / vade dağılımı karşılaştırılmaz"''')
# Excel kartı: programın eşlediği cari (README bakım 14 "Sürücü için" A6)
rep('''mk = Izli(S, DAL)        # KÂHİN''', '''# SÜRÜCÜ BAKIMI 5 (kâhin bakımı 14 "Sürücü için" A6 — S219 / S221 / S222): Excel kartı kâhine PROGRAMIN EŞLEDİĞİ cariyle verilir (`taksit_excel {cari}`); program.mjs kartın
# bağlandığı cariyi kâhin anahtarına çevirir (`esle_cari`). Programın atladığı satır (durum "atlandi") kâhine uygulanmaz (yalnız "yapildi" uygulanır). Öz denetim (OZ)
# senaryonun kendi hâliyle yukarıda koştu; değişiklik yalnız bellekteki kopyada (kâhinin dosyasına yazılmaz).
EXCEL_ESLE = {}
for x in P["olaylar"]:
    if x.get("tur") == "taksit_excel" and x.get("esle_cari"):
        o_ = S["olaylar"][int(x["no"]) - 1]
        if x["esle_cari"] != o_.get("cari"):
            EXCEL_ESLE[int(x["no"])] = (o_.get("cari"), x["esle_cari"])
            S["olaylar"][int(x["no"]) - 1] = dict(o_, cari=x["esle_cari"])
mk = Izli(S, DAL)        # KÂHİN''')
open(p, 'w', encoding='utf-8').write(t)
print("tamam")
