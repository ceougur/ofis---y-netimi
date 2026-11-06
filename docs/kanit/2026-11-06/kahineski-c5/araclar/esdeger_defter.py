"""Defter kâhini eşdeğerliği: eski kâhin (d9ac9c14, ayrı kopya) ↔ yeni kahin.py --kural 2.4.9, eski senaryo.json üzerinde, mutasyon 0–13.
Kullanım: python3 -I esdeger_defter.py <depo kökü>"""
import subprocess, sys, os
KOK = sys.argv[1]
# eski kopya: git archive d9ac9c14 test/bagimsiz/defter test/bagimsiz/cari | tar -x -C <klasör>  (ders 23 — ayrı kopya)
ESKI = os.path.join(sys.argv[2], "test/bagimsiz/defter") if len(sys.argv) > 2 else "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski-c5/eski/test/bagimsiz/defter"
toplam = ayni = 0
for m in range(0, 14):
    e = subprocess.run([sys.executable, "-I", os.path.join(ESKI, "kahin.py"), os.path.join(ESKI, "senaryo.json"), "--mutasyon", str(m)], capture_output=True)
    y = subprocess.run([sys.executable, "-I", os.path.join(KOK, "test/bagimsiz/defter/kahin.py"), os.path.join(ESKI, "senaryo.json"), "--mutasyon", str(m), "--kural", "2.4.9"], capture_output=True)
    if e.returncode or y.returncode:
        print("DÜŞTÜ m=%d eski=%d yeni=%d %s" % (m, e.returncode, y.returncode, y.stderr.decode()[-300:]))
        sys.exit(1)
    toplam += 1
    if e.stdout == y.stdout:
        ayni += 1
    else:
        print("FARK m=%d" % m)
print("eşdeğerlik: %d/%d bayt bayt aynı" % (ayni, toplam))
print("# tests %d\n# pass %d\n# fail %d" % (toplam, ayni, toplam - ayni))
print("%d/%d denetim geçti" % (ayni, toplam))
sys.exit(0 if ayni == toplam else 1)
