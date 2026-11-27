#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 16 (cari; S155 A toplam ölçü, S158 A her kartta, S156 / S157 = C metin, S154 alan yok) — eski kâhin (bakım 15, `6453ad3b`) ↔ yeni kâhin. Program AÇILMAZ; yalnız iki
model.py koşar. (Bakım 15'in kahineski15-arac/karsilastir.py düzeni; G3 sınıfları bakım 16'ya göre — İKİ modelin `_iz15` izi (eski: s145ret / s145sus; yeni: s155ret / s155sus / s158).)

  python3 -I karsilastir.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari> [--dokum <json>] [--tohum 10] [--islem 120]

1. ÜRETİCİ: uretici.py (s1 ve ux18, tohum 1..N × işlem) iki kopyada bayt bayt aynı dizi.
2. ADIMLAR: eski kopyada da olan elle senaryoların adımları DEĞİŞMEDİ (bakım 16 d41 / d42'nin elle tablolarını değiştirir, d44'ü ekler).
3. EŞDEĞERLİK (2.4.9 / 2.4.6 / 2.4.5 / --legacy): eski kopyanın bütün elle senaryoları + yeni kopyanın yeni elle senaryoları (d39 / d40 — adım türleri eski kâhinde de var) + rastgele —
   iki modelin çıktısı (ya da hatası) bayt bayt aynı.
4. G3 (2.5.0): eski kopyanın elle senaryoları + d44 + rastgele — her değişen / kalkan / yeni denetim sınıflanır (cari cari, İKİ modelin izinden; anahtar türü sınıfın alanında olmalı):
   S155 (eski ya da yeni modelde ret / SUS — o carinin her denetimi; adımın durumu) · S158 (yeni izde s158 — kartın 'odenen' / taksit 'odenen'i) · GENEL (aynı kontrolde sınıflı değişiklik
   varken cari dışı denetim: sayaç, Kasa, mizan) · BEKLENMEYEN (0 olmalı). Bakım 15'in öbür sınıfları bu bakımda DEĞİŞMEMELİ (kural yok → BEKLENMEYEN sayılır).
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


ME, MY = yukle_modul(ESKI, "kahin_cari_eski16"), yukle_modul(YENI, "kahin_cari_yeni16")
S110_IZ = set()  # (cari, "alan" | "sus") — yeni modelin s130 izinden
ORNEKLER = []    # İKİ modelin bu senaryoda kurulan bütün örnekleri (iki dünya — S145 / S155 / SK-18 — dahil): _iz15 izleri birleşir
_orij_s130, _orij_init, _orij_init_e = MY.Model.s130, MY.Model.__init__, ME.Model.__init__


def _izle_s130(self, cari):
    r = _orij_s130(self, cari)
    if r["iz"] in ("alan", "sifir"):
        S110_IZ.add((cari, "alan"))
    elif r["iz"] == "sus":
        S110_IZ.add((cari, "sus"))
    return r


def _izle_init(self, *a, **k):
    _orij_init(self, *a, **k)
    ORNEKLER.append(self)


def _izle_init_e(self, *a, **k):
    _orij_init_e(self, *a, **k)
    ORNEKLER.append(self)


MY.Model.s130 = _izle_s130
MY.Model.__init__ = _izle_init
ME.Model.__init__ = _izle_init_e
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
        # bakım 15: başvurduğu hareketin / evrakın / şüpheli kaydının carisi (hareket_sil, hareket_geri_yukle, karsiliksiz, degersiz … — S145 iki dünyasında bağlı adımlar)
        ec = {x["ad"]: x.get("cari") for x in sen["adimlar"] if x["islem"] in ("evrak", "supheli_al") and x.get("ad")}
        return (a.get("cari") or (a.get("ad") if a.get("islem") == "cari_ac" else None) or kc.get(a.get("kayit")) or adim.get(a.get("hareket"), {}).get("cari")
                or ec.get(a.get("evrak")) or ec.get(a.get("supheli")))
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


def sinif15(anahtar, c, t, supheli):
    """Bakım 16 sınıfı — anahtar türü sınıfın ALANINDA olmalı (değilse None → BEKLENMEYEN)."""
    p_ = anahtar.split(":")
    if t & {"s145ret", "s145sus", "s155ret", "s155sus"}:
        return "S155"
    if "s158" in t and len(p_) >= 4 and p_[1] == "kart" and p_[-1] == "odenen":
        return "S158"
    return None


def _sinif15_eski(anahtar, c, t, supheli):
    p = anahtar.split(":")
    tur = p[-1] if p[0] != "adim" else "adim"
    kart = len(p) >= 4 and p[1] == "kart"
    gorunum = len(p) >= 3 and p[1] in ("takvim", "vadeTakip", "projeksiyon")
    if t & {"s145ret", "s145sus"}:
        return "S145"
    if anahtar.endswith(":gecikmis") and "s149" in t:
        return "S149"
    if t & {"s140", "s140sus"} and (kart or gorunum or tur in ("kalan", "acik", "gecikmis", "acikToplam", "acikEsitBakiye", "vade", "beklenen")):
        return "S140"
    if t & {"s151", "sk32"} and kart and p[-1] == "odenen":
        return "S151"
    if "s141" in t and ((len(p) >= 4 and p[1] == "fatura" and p[-1] == "acik") or tur in ("acikToplam", "acikEsitBakiye")):
        return "S141"
    if "s144" in t and kart and anahtar.endswith(":odenen") and len(p) == 4:
        return "S144"
    if "s143" in t and kart and p[-1] == "kalan":
        return "S143"
    if "s149" in t and gorunum and p[2] == "hareket":
        return "S149"
    if supheli and anahtar.endswith(":gecikmis"):
        return "S139"
    if (t & {"s130sus", "s137", "s138", "sk30"}) and (gorunum or tur == "gecikmis"):
        return "S130-sus"
    if (t & {"s130alan", "s136"}) and (gorunum or tur == "gecikmis"):
        return "S136-alan"
    return None


def js(x):
    return "(denetim yok)" if x is YOK else x


for ad, sen in elle_eski + [(ad, s) for ad, s in elle_yeni if ad not in eski_sen] + rastgele:
    S110_IZ.clear()
    del ORNEKLER[:]
    try:
        e = ME.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"]
    except SystemExit:
        e = None
    try:
        y = MY.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"]
    except SystemExit:
        y = None
    iz15 = defaultdict(set)
    for m_ in ORNEKLER:
        for c_, t_ in m_._iz15.items():
            iz15[c_] |= t_
    for c_, t_ in S110_IZ:
        iz15[c_].add("s130" + t_)
    supheli_c = {a_["cari"] for a_ in sen["adimlar"] if a_["islem"] == "supheli_al"}
    sus_ids = {x_[0]: x_[1] for m_ in ORNEKLER for x_ in m_.sus_s145}  # iki modelin S145 / S155 iki dünya adımları (eski SK-33 / SK-34; yeni SK-35 / Y16-4) → carisi
    if e is None or y is None:
        denetle("G3 %s iki modelde de aynı biçimde koşuyor" % ad, e is None and y is None)
        continue
    toplam_eski += len(e)
    toplam_yeni += len(y)
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
        if anahtar.startswith("adim:") and anahtar.split(":")[1] in sus_ids:
            c = sus_ids[anahtar.split(":")[1]]  # carisi adımda yazılı olmayan adım (hareket_sil, hareket_geri_yukle, karsiliksiz …)
        s = sinif15(anahtar, c, iz15.get(c, set()), c in supheli_c) if c is not None else None
        if s:
            kontrolde[anahtar.split(":")[0]] += 1
        sonuc.append([anahtar, eb, yb, s])
    for x in sonuc:
        if x[3] is None:
            genel = cari_of(x[0], sen) is None and any((":%s" % g) in x[0] for g in GENEL)
            k_ = x[0].split(":")[0]
            x[3] = "GENEL" if (genel and kontrolde.get(k_)) else "BEKLENMEYEN"
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
