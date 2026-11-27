#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 12 (cari; S128 — bakiye kadar açılan Taksitler kartının içinde fatura / elle dışında kalem de varsa ödeme kalemleri türüne bakılmadan içine alma sırasıyla, eskiden yeniye
düşürür) — eski kâhin (bakım 11, `bb05ae9b` ağacı — çalışma dalı ucu) ↔ yeni kâhin. Program AÇILMAZ; yalnız iki model.py koşar. (Bakım 11'in kahineski11-arac/karsilastir.py düzeni; G3 sınıfları bakım 12'ye göre.)

  python3 -I karsilastir.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--dokum <json>] [--tohum 10] [--islem 120]

1. ÜRETİCİ: uretici.py (s1 ve ux18, tohum 1..N × işlem) iki kopyada bayt bayt aynı dizi.
2. ADIMLAR: eski kopyada da olan elle senaryoların adımları DEĞİŞMEDİ (bakım 12 d37'nin yalnız L14 beklentilerini değiştirir, d38'i ekler).
3. EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy): eski kopyanın bütün elle senaryoları + yeni kopyanın yeni elle senaryoları (d38 — adım türleri eski kâhinde de var) + rastgele —
   iki modelin çıktısı (ya da hatası) bayt bayt aynı.
4. G3 (2.5.0): eski kopyanın elle senaryoları + d38 + rastgele — her değişen / kalkan / yeni denetim sınıflanır: S128-alan (O = T Taksitler kartı, içinde stok veresiye satışı / karşılıksız kalemi —
   Y12-2 / Y12-7) · S128-sus (Y12-8 — S125 = C; fark 0 olmalı) · S128-SK26 (Y12-3 (iii) / (iv); fark 0 olmalı) · S128-genel (aynı kontrolde S128 değişikliği varken cari dışı anahtar) · BEKLENMEYEN
   (hiçbiri — 0 olmalı; S122 / S126 alanındaki — bakım 10 / 11 — kartların bir değişikliği de BEKLENMEYEN'dir). Sınıf, yeni modelin `_alacak_govde250` sonuçlarından (`son["s122"]` izi) cari cari
   kaydedilir — beklenen değerden değil.
Çıkış 0 yalnız: üretici aynı + adımlar değişmedi + eşdeğerlik tam + BEKLENMEYEN 0. Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import importlib.util
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict


def arg(ad, vars_=None):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else vars_


ESKI, YENI = os.path.abspath(arg("--eski")), os.path.abspath(arg("--yeni"))
TOHUM, ISLEM = int(arg("--tohum", "10")), int(arg("--islem", "120"))
DOKUM = arg("--dokum")


def yukle_modul(klasor, ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(klasor, "model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ME, MY = yukle_modul(ESKI, "kahin_cari_eski12"), yukle_modul(YENI, "kahin_cari_yeni12")
S110_IZ = set()  # (cari, "alan" | "sus") — yeni modelin her alacak tarafı hesabından
_orij = MY.Model._alacak_govde250


def _izle(self, cari, *a, **k):
    r = _orij(self, cari, *a, **k)
    for v in (r["son"].get("s122") or {}).values():
        if v.startswith("s128"):
            S110_IZ.add((cari, "alan"))
        elif v == "sk26":
            S110_IZ.add((cari, "sk26"))
        elif v == "sus":
            S110_IZ.add((cari, "sus"))
    return r


MY.Model._alacak_govde250 = _izle
gecen = kalan = 0
satirlar = []


def denetle(ad, ok, ayrinti=""):
    global gecen, kalan
    if ok:
        gecen += 1
    else:
        kalan += 1
        satirlar.append("  ✗ %s %s" % (ad, ayrinti))


def uret(klasor, tur, tohum):
    return subprocess.run([sys.executable, "-I", os.path.join(klasor, "uretici.py"), "--tur", tur, "--tohum", str(tohum), "--islem", str(ISLEM)], capture_output=True, check=True).stdout


def kos(M, sen, kural):
    try:
        return json.dumps(M.Model(json.loads(json.dumps(sen)), 0, kural).kos(), ensure_ascii=False, sort_keys=True)
    except SystemExit as e:
        return "SystemExit: %s" % e
    except Exception as e:  # noqa: BLE001 — iki modelin aynı hatayı vermesi de eşdeğerliktir
        return "%s: %s" % (type(e).__name__, e)


def elle_oku(klasor):
    out = []
    d = os.path.join(klasor, "senaryolar")
    for f in sorted(os.listdir(d)):
        if f.endswith(".json"):
            with open(os.path.join(d, f), encoding="utf-8") as g:
                out.append((f[:-5], json.load(g)))
    return out


def yeni_adimli(sen):
    return any(a["islem"] == "stok_satis_taksit" for a in sen["adimlar"])


def cari_dizisi(sen):
    fc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] == "fatura"}
    kc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] in ("kart_ac", "stok_satis_taksit")}
    d = {}
    for a in sen["adimlar"]:
        c = a.get("cari") or (a["ad"] if a["islem"] == "cari_ac" else None) or fc.get(a.get("fatura")) or kc.get(a.get("kayit")) or "<genel>"
        d.setdefault(c, []).append(json.dumps(a, sort_keys=True, ensure_ascii=False))
    return d


# ── 1. üretici
rastgele = []
ayni_dizi = 0
for tur in ("s1", "ux18"):
    for t in range(1, TOHUM + 1):
        e, y = uret(ESKI, tur, t), uret(YENI, tur, t)
        denetle("üretici %s tohum %d aynı dizi" % (tur, t), e == y)
        ayni_dizi += e == y
        rastgele.append(("rastgele-%s-%d" % (tur, t), json.loads(y)))
print("ÜRETİCİ: %d/%d aynı dizi (tur s1 + ux18, tohum 1–%d × %d işlem)" % (ayni_dizi, 2 * TOHUM, TOHUM, ISLEM))

# ── 2. adımlar
elle_eski, elle_yeni = elle_oku(ESKI), elle_oku(YENI)
eski_sen = dict(elle_eski)
degisen = []
for ad, s in elle_yeni:
    if ad not in eski_sen:
        continue
    if s["adimlar"] == eski_sen[ad]["adimlar"]:
        gecen += 1
        continue
    degisen.append(ad)
    denetle("adımları değişen eski senaryo yok: %s" % ad, False)
print("ADIMLAR: eski kopyadaki %d elle senaryonun %d'inin adımları değişti: %s · yeni elle senaryo: %s" % (len(elle_eski), len(degisen), ", ".join(degisen) or "yok", ", ".join(ad for ad, _ in elle_yeni if ad not in eski_sen)))

# ── 3. eşdeğerlik (eski kural setleri)
kume = [("eski:" + ad, s) for ad, s in elle_eski] + [("yeni:" + ad, s) for ad, s in elle_yeni if ad not in eski_sen] + rastgele
disarida = []
esdeger = toplam_esdeger = 0
for ad, sen in kume:
    for kural in ("2.4.9", "2.4.6", "2.4.5", "2.4.4"):
        toplam_esdeger += 1
        a, b = kos(ME, sen, kural), kos(MY, sen, kural)
        denetle("eşdeğerlik %s [%s]" % (ad, "legacy" if kural == "2.4.4" else kural), a == b, "(çıktı farklı)")
        esdeger += a == b
print("EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy; eski kopyanın %d elle + yeni kopyanın yeni %d elle + %d rastgele senaryo × 4 kip): %d/%d bayt bayt aynı"
      % (len(elle_eski), len(kume) - len(elle_eski) - len(rastgele), len(rastgele), esdeger, toplam_esdeger))

# ── 4. G3 (2.5.0)
YOK = object()
GENEL = ("kasa", "kasaRapor", "nakit", "mizan", "takvim:cariKalemSayisi", "projeksiyon:cari", "rapor")


def cari_of(anahtar, sen):
    p = anahtar.split(":")
    adim = {a["id"]: a for a in sen["adimlar"]}
    fc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] == "fatura"}
    kc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] in ("kart_ac", "stok_satis_taksit")}
    if p[0] == "adim" and len(p) >= 3:
        a = adim.get(p[1], {})
        return a.get("cari") or (a.get("ad") if a.get("islem") == "cari_ac" else None) or kc.get(a.get("kayit"))
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "hareket":
        if p[3] == "acilis":
            return ":".join(p[4:])
        return adim.get(":".join(p[3:]), {}).get("cari")
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "fatura":
        return fc.get(":".join(p[3:]))
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "cariToplam":
        return ":".join(p[3:])
    if len(p) >= 4 and p[1] == "hareket":
        if p[2] == "acilis":
            return ":".join(p[3:-1])  # bakım 9: açılış satırının kimliği "acilis:<cari>" (adım kimliği değil)
        return adim.get(":".join(p[2:-1]), {}).get("cari")
    if len(p) >= 4 and p[1] == "fatura":
        return fc.get(":".join(p[2:-1]))
    if len(p) >= 4 and p[1] == "cari":
        return ":".join(p[2:-1])
    if len(p) >= 4 and p[1] == "kart":
        return kc.get(p[2])
    return None


g3 = defaultdict(Counter)
ornek = defaultdict(list)
dokum = []
toplam_eski = toplam_yeni = 0
etiket_degisen = 0


def js(x):
    return "(denetim yok)" if x is YOK else x


for ad, sen in elle_eski + [(ad, s) for ad, s in elle_yeni if ad not in eski_sen] + rastgele:
    try:
        e = ME.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"]
    except SystemExit:
        e = None
    S110_IZ.clear()
    try:
        y = MY.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"]
    except SystemExit:
        y = None
    if e is None or y is None:
        denetle("G3 %s iki modelde de aynı biçimde koşuyor" % ad, e is None and y is None)
        continue
    toplam_eski += len(e)
    toplam_yeni += len(y)
    alan = {c for c, t in S110_IZ if t == "alan"}
    sus = {c for c, t in S110_IZ if t == "sus"}
    sk26 = {c for c, t in S110_IZ if t == "sk26"}
    farklar = []
    for anahtar in sorted(set(e) | set(y)):
        eb = e[anahtar]["b"] if anahtar in e else YOK
        yb = y[anahtar]["b"] if anahtar in y else YOK
        if eb is not YOK and yb is not YOK and eb == yb:
            etiket_degisen += e[anahtar]["e"] != y[anahtar]["e"]
            continue
        farklar.append((anahtar, eb, yb))
    kontrolde = Counter()
    sonuc = []
    for anahtar, eb, yb in farklar:
        c = cari_of(anahtar, sen)
        s = ("S128-sus" if c in sus else "S128-alan" if c in alan else "S128-SK26" if c in sk26 else None) if c is not None else None
        if s:
            kontrolde[anahtar.split(":")[0]] += 1
        sonuc.append([anahtar, eb, yb, s])
    for x in sonuc:
        if x[3] is None:
            genel = cari_of(x[0], sen) is None and any((":%s" % g) in x[0] for g in GENEL)
            k_ = x[0].split(":")[0]
            x[3] = "S128-genel" if (genel and kontrolde.get(k_)) else "BEKLENMEYEN"
    for anahtar, eb, yb, s in sonuc:
        tur = "kalkan" if yb is YOK else ("yeni" if eb is YOK else "degisen")
        g3[ad][(s, tur)] += 1
        dokum.append({"senaryo": ad, "anahtar": anahtar, "eski": js(eb), "yeni": js(yb), "sinif": s, "tur": tur})
        if len(ornek[(s, tur)]) < 4:
            ornek[(s, tur)].append("%s %s: %s → %s" % (ad, anahtar, json.dumps(js(eb), ensure_ascii=False)[:110], json.dumps(js(yb), ensure_ascii=False)[:110]))

genel = Counter()
for ad, c in g3.items():
    for kt, n in c.items():
        genel[kt] += n
beklenmeyen = sum(n for (s, _t), n in genel.items() if s == "BEKLENMEYEN")
print("G3 (kural 2.5.0; %d senaryo — eski kopyanın %d elle senaryosu + yeni elle + %d rastgele): eski %d denetim · yeni %d denetim · değişen / kalkan / yeni toplam %d · BEKLENMEYEN %d · yalnız etiketi değişen %d"
      % (len(elle_eski) + len(elle_yeni) - len(eski_sen) + len(rastgele), len(elle_eski), len(rastgele), toplam_eski, toplam_yeni, sum(genel.values()), beklenmeyen, etiket_degisen))
for (s, t), n in sorted(genel.items()):
    print("  %-14s %-8s %5d" % (s, t, n))
    for o in ornek[(s, t)]:
        print("      örn. %s" % o)
print("G3 senaryo senaryo (sınıf/tür: adet; listede olmayan senaryoda fark 0):")
for ad in sorted(g3):
    print("  %-40s %s" % (ad, " · ".join("%s/%s %d" % (s, t, n) for (s, t), n in sorted(g3[ad].items()))))
denetle("G3 BEKLENMEYEN 0", beklenmeyen == 0, "%d beklenmeyen değişiklik" % beklenmeyen)
for x in dokum:
    if x["sinif"] == "BEKLENMEYEN":
        satirlar.append("    BEKLENMEYEN %s %s: %s → %s" % (x["senaryo"], x["anahtar"], json.dumps(x["eski"], ensure_ascii=False)[:160], json.dumps(x["yeni"], ensure_ascii=False)[:160]))
if DOKUM:
    with open(DOKUM, "w", encoding="utf-8") as f:
        json.dump({"ozet": {"%s/%s" % k: v for k, v in sorted(genel.items())}, "senaryo": {ad: {"%s/%s" % k: v for k, v in sorted(c.items())} for ad, c in sorted(g3.items())},
                   "etiket_degisen": etiket_degisen, "dokum": dokum}, f, ensure_ascii=False, indent=1)
if satirlar:
    print("BAŞARISIZ:")
    print("\n".join(satirlar[:120]))
toplam = gecen + kalan
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
