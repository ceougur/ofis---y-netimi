#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""2.4.6 cari kâhini eşdeğerlik denetimi (yalnız model; program açılmaz): yeni model.py'nin `--kural 2.4.5` ve `--legacy` çıktısı ESKİ model.py'nin (e77447a,
2.4.5 son hâli) aynı kipteki çıktısıyla BAYT BAYT aynı mı. Rastgele senaryolar ESKİ üreticiyle üretilir (eski kâhinin gördüğü diziler).

  git archive e77447a test/bagimsiz/cari | tar -x -C <eski_kok>
  python3 -I docs/kanit/2026-10-25/246-kahin-cari/esdeger.py <eski_kok>/test/bagimsiz/cari test/bagimsiz/cari [tohum_sayisi]

Son satır "N/M denetim geçti" (tools/kanit.mjs tanır); fark varsa çıkış 1.
"""
import glob
import hashlib
import os
import subprocess
import sys
import tempfile


def cikti(model, dosya, *kip):
    r = subprocess.run([sys.executable, "-I", model, dosya, *kip], capture_output=True, check=True)
    return hashlib.sha256(r.stdout).hexdigest()


def main(argv):
    eski, yeni = argv[1], argv[2]
    tohum = int(argv[3]) if len(argv) > 3 else 6
    gecici = tempfile.mkdtemp(prefix="esdeger-246-")
    dosyalar = sorted(glob.glob(os.path.join(yeni, "senaryolar", "*.json")))
    dosyalar = [d for d in dosyalar if os.path.exists(os.path.join(eski, "senaryolar", os.path.basename(d)))]  # yalnız eski kâhinin de bildiği senaryolar
    for t in range(1, tohum + 1):
        for tur in ("s1", "ux18"):
            yol = os.path.join(gecici, "r-%s-%d.json" % (tur, t))
            with open(yol, "wb") as f:
                f.write(subprocess.run([sys.executable, "-I", os.path.join(eski, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "120"],
                                       capture_output=True, check=True).stdout)
            dosyalar.append(yol)
    toplam = fark = 0
    for d in dosyalar:
        for eski_kip, yeni_kip in (([], ["--kural", "2.4.5"]), (["--legacy"], ["--legacy"])):
            toplam += 1
            if cikti(os.path.join(eski, "model.py"), d, *eski_kip) != cikti(os.path.join(yeni, "model.py"), d, *yeni_kip):
                fark += 1
                print("FARK: %s %s" % (os.path.basename(d), " ".join(yeni_kip)))
    for d in glob.glob(os.path.join(gecici, "*.json")):
        os.remove(d)
    os.rmdir(gecici)
    print("eşdeğerlik: %d senaryo × 2 kip (2.4.5, legacy) — eski model ile bayt bayt" % len(dosyalar))
    print("%d/%d denetim geçti" % (toplam - fark, toplam))
    return 1 if fark else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
