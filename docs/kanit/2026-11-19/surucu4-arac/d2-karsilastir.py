import sys
p = sys.argv[1]
t = open(p, encoding="utf-8").read()


def rep(a, b, n=1):
    global t
    assert t.count(a) == n, (a[:80], t.count(a))
    t = t.replace(a, b)


rep('''SUSMALAR = [(x["cari"], x["tarih"], x.get("kaynak", ""), x.get("kural", "")) for x in (B["dallar"].get("A", {}).get("susmalar") or [])]
''', '''SUSMALAR = [(x["cari"], x["tarih"], x.get("kaynak", ""), x.get("kural", "")) for x in (B["dallar"].get("A", {}).get("susmalar") or []) if x.get("kural") != "S192"]
# SÜRÜCÜ BAKIMI 4 — `susmalar` S192 (kâhin bakımı 13, README "Sürücü için" A5 / Ü14): {kural: "S192", rapor, cari, tarih, dosya} — o carinin o RAPORU (kalem / vade dağılımı)
# karşılaştırılmaz, toplamlar karşılaştırılır. Yalnız listelenen raporda (S168 gibi o günden sonraki her raporda DEĞİL); atlanan anahtar SUSMA (# skipped) diye sayılır.
# Açık faturalar raporunda carinin açık fatura TOPLAMI ayrıca karşılaştırılır (satır 'fatura_toplam').
S192 = {(x["cari"], x["rapor"]): x for x in (B["dallar"].get("A", {}).get("susmalar") or []) if x.get("kural") == "S192"}


def s192_cariler(rapor_adi):
    return {c for (c, r) in S192 if r == rapor_adi}


def s192_aciklama(c, rapor_adi):
    x = S192.get((c, rapor_adi)) or {}
    return f"kâhin susar (S192; kâhin bakımı 13 `susmalar`): {c} {rapor_adi} {x.get('tarih', '')} — kalem / vade dağılımı karşılaştırılmaz"
''')
rep('''def tyk_susma(alan, anahtar, rapor_adi, cariler):
    return {"alan": alan, "anahtar": anahtar, "sinif": "SUSMA", "aciklama": sus_aciklama(cariler)}
''', '''def tyk_susma(alan, anahtar, rapor_adi, cariler):
    s192 = [c for c in cariler if (c, rapor_adi) in S192]
    return {"alan": alan, "anahtar": anahtar, "sinif": "SUSMA", "aciklama": "; ".join([s192_aciklama(c, rapor_adi) for c in s192] + ([sus_aciklama(cariler)] if set(cariler) - set(s192) else []))}
''')
rep('''    sus = sus_cariler(t)
    if rr == "gecikmis":''', '''    sus = sus_cariler(t) | s192_cariler(rapor_adi)   # SÜRÜCÜ BAKIMI 4: S192 yalnız listelenen raporda
    if rr == "gecikmis":''')
rep('''        if o["cari"] in sus:
            return [tyk_susma("fatura", f, rapor_adi, {o["cari"]}) for f in sorted(set(prg) | set(kahd))]''', '''        if o["cari"] in sus:
            out = [tyk_susma("fatura", f, rapor_adi, {o["cari"]}) for f in sorted(set(prg) | set(kahd))]
            if (o["cari"], rapor_adi) in S192:   # S192: toplam karşılaştırılır
                out.append(tyk_satir("fatura_toplam", o["cari"], sum(prg.values()), sum(kahd.values()), YOK_BUGUN, set(SENARYO_KIMLIK) or {"Ç5-B1"}, rapor_adi))
            return out''')
open(p, "w", encoding="utf-8").write(t)
print("tamam")
