"""Cari kâhini eşdeğerliği: eski model (d9ac9c14, ayrı kopya) ↔ yeni model.py, kural setleri 2.4.9 / 2.4.6 / 2.4.5 / --legacy, bütün elle senaryolar +
rastgele (uretici ux18 / s1, tohum 1–3 × 60). Üretici: eski ↔ yeni çıktı bayt bayt. Ayrıca 2.5.0 kâhini her senaryoda çökmeden koşar mı.
Kullanım: python3 -I esdeger_cari.py <depo kökü> <çıktı klasörü>"""
import json, os, subprocess, sys
KOK, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
# eski kopya: git archive d9ac9c14 test/bagimsiz/defter test/bagimsiz/cari | tar -x -C <klasör>  (ders 23 — ayrı kopya); 3. argüman
ESKI = os.path.join(sys.argv[3], "test/bagimsiz/cari") if len(sys.argv) > 3 else "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski-c5/eski/test/bagimsiz/cari"
YENI = os.path.join(KOK, "test/bagimsiz/cari")
PY = sys.executable

def kos(argv):
    r = subprocess.run([PY, "-I"] + argv, capture_output=True)
    return r.returncode, r.stdout, r.stderr.decode()[-400:]

dosyalar = [os.path.join(YENI, "senaryolar", f) for f in sorted(os.listdir(os.path.join(YENI, "senaryolar"))) if f.endswith(".json")]
eski_elle = set(f for f in os.listdir(os.path.join(ESKI, "senaryolar")) if f.endswith(".json"))
uretim = {"toplam": 0, "ayni": 0}
for tur in ("ux18", "s1"):
    for t in (1, 2, 3):
        _, e, _ = kos([os.path.join(ESKI, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "60"])
        rc, y, err = kos([os.path.join(YENI, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "60"])
        uretim["toplam"] += 1
        uretim["ayni"] += int(e == y and rc == 0)
        yol = os.path.join(OUT, "rastgele-%s-%d.json" % (tur, t))
        open(yol, "wb").write(y)
        dosyalar.append(yol)
print("üretici: %d/%d bayt bayt aynı" % (uretim["ayni"], uretim["toplam"]))
toplam = ayni = 0
farklar = []
cokme250 = []
for d in dosyalar:
    ad = os.path.basename(d)
    eski_var = (not d.startswith(YENI)) or ad in eski_elle
    for kip in (["--kural", "2.4.9"], ["--kural", "2.4.6"], ["--kural", "2.4.5"], ["--legacy"]):
        if not eski_var:
            continue
        rce, e, erre = kos([os.path.join(ESKI, "model.py"), d] + kip)
        rcy, y, erry = kos([os.path.join(YENI, "model.py"), d] + kip)
        if rce != 0 and rcy != 0:
            continue  # iki sürümde de bu kipte koşmayan senaryo (dil / kural uyumsuz)
        toplam += 1
        if rce == rcy and e == y:
            ayni += 1
        else:
            farklar.append("%s %s eski=%d yeni=%d %s" % (ad, " ".join(kip), rce, rcy, erry[-200:]))
    rc, _, err = kos([os.path.join(YENI, "model.py"), d])
    if rc != 0:
        cokme250.append("%s: %s" % (ad, err))
print("eşdeğerlik (eski ↔ yeni, 2.4.9 / 2.4.6 / 2.4.5 / legacy): %d/%d bayt bayt aynı" % (ayni, toplam))
for f in farklar[:20]:
    print("  FARK", f)
print("2.5.0 kâhini çökmeden: %d/%d" % (len(dosyalar) - len(cokme250), len(dosyalar)))
for c in cokme250[:20]:
    print("  ÇÖKTÜ", c)
t_ = toplam + uretim["toplam"] + len(dosyalar)
g_ = ayni + uretim["ayni"] + len(dosyalar) - len(cokme250)
print("# tests %d\n# pass %d\n# fail %d" % (t_, g_, t_ - g_))
print("%d/%d denetim geçti" % (g_, t_))
sys.exit(0 if (ayni == toplam and uretim["ayni"] == uretim["toplam"] and not cokme250) else 1)
