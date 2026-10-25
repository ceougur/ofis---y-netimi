#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Maliyet Hesap Kartı kâhini — KARA KUTU KOŞUCUSU (dil "destekofis-maliyet/1").

    python3 -I test/bagimsiz/maliyet/kos.py [--kabul <dosya>] [--katman api|arayuz] [--cikti <rapor.json>] [--zaman-asimi <sn>] [-- <uyarlayıcı komutu …>]

Uyarlayıcı (programı süren ayrı süreç; README §6): `--` sonrasındaki komut, yoksa MALIYET_UYARLAYICI ortam değişkeni (komut dizgesi),
yoksa bu klasördeki uyarlayici.mjs (node ile). Koşucu senaryoları (beklenenler ÇIKARILMIŞ) uyarlayıcının standart girdisine JSON olarak
verir, standart çıktısından programın yanıtını okur ve kahin.py kurallarıyla karşılaştırır. Koşucu beklenen değer HESAPLAMAZ; kabul.json'u okur.

Çıkış kodları (ders 2, 4):
  0  bütün seçili senaryolar koşuldu, fark yok; son satır "N/N denetim geçti" (tools/kanit.mjs tanır)
  1  fark var; son satır "G/N denetim geçti" (G < N) ve "✗" satırları
  3  BELİRSİZ: program/uyarlayıcı yok, yanıt okunamadı, sahte uyarlayıcı, ya da senaryo koşulmadı (karar beyanı eksik vb.).
     Bu durumda "denetim geçti" satırı YAZILMAZ; tools/kanit.mjs çıktıyı GEÇTİ saymaz.
"""
import json
import os
import shlex
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
for _akis in (sys.stdout, sys.stderr):
    if hasattr(_akis, "reconfigure"):
        _akis.reconfigure(encoding="utf-8", errors="replace")   # Windows: -I ile PYTHONIOENCODING yok sayılır, boru ANSI kod sayfasına düşer
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import kahin  # noqa: E402

BELIRSIZ = 3
SAHTE = "kahin-sahte"


def belirsiz(neden, ek=()):
    print(f"BELİRSİZ — {neden}")
    for satir in ek:
        print(f"  {satir}")
    print("Hiçbir sonuç GEÇTİ sayılmaz (ders 4: okunamayan veri boş değildir).")
    return BELIRSIZ


def secenekler(argv):
    o = {"kabul": os.path.join(HERE, "kabul.json"), "katman": None, "cikti": None, "zaman": 3600.0, "kendi": False, "komut": None}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--":
            o["komut"] = argv[i + 1:]
            break
        if a in ("--kabul", "--katman", "--cikti", "--zaman-asimi"):
            o[{"--kabul": "kabul", "--katman": "katman", "--cikti": "cikti", "--zaman-asimi": "zaman"}[a]] = argv[i + 1]
            i += 2
            continue
        if a == "--kendi-testi":
            o["kendi"] = True
            i += 1
            continue
        raise SystemExit(f"bilinmeyen seçenek {a}")
    if o["katman"] not in (None, "api", "arayuz"):
        raise SystemExit("--katman api ya da arayuz")
    o["zaman"] = float(o["zaman"])
    return o


def uyarlayici_bul(o):
    if o["komut"]:
        return o["komut"], "komut satırı"
    env = os.environ.get("MALIYET_UYARLAYICI", "").strip()
    if env:
        return shlex.split(env, posix=os.name != "nt"), "MALIYET_UYARLAYICI"
    dosya = os.path.join(HERE, "uyarlayici.mjs")
    if os.path.isfile(dosya):
        return ["node", dosya], "uyarlayici.mjs"
    return None, None


def main(argv):
    o = secenekler(argv)
    komut, kaynak = uyarlayici_bul(o)
    if not komut:
        return belirsiz("program yok: Maliyet Hesap Kartı uyarlayıcısı bulunamadı", [
            "aranan: '-- <komut>', MALIYET_UYARLAYICI, test/bagimsiz/maliyet/uyarlayici.mjs",
            "programın uyması gereken sözleşme: test/bagimsiz/maliyet/README.md §6"])
    try:
        with open(o["kabul"], encoding="utf-8") as f:
            kabul = json.load(f)
    except (OSError, ValueError) as e:
        return belirsiz(f"kabul dosyası okunamadı: {e}")
    if kabul.get("dil") != kahin.DIL:
        return belirsiz(f"kabul dili {kabul.get('dil')!r}, beklenen {kahin.DIL!r}")
    senaryolar = [s for s in kabul["senaryolar"] if o["katman"] is None or s["katman"] == o["katman"]]
    secilmeyen = len(kabul["senaryolar"]) - len(senaryolar)
    istek = {"dil": kahin.DIL, "senaryolar": [{k: v for k, v in s.items() if k != "beklenen"} for s in senaryolar]}
    print(f"uyarlayıcı ({kaynak}): {' '.join(komut)}")
    print(f"kabul: {o['kabul']} — {len(senaryolar)} senaryo gönderiliyor" + (f" (katman {o['katman']}; {secilmeyen} senaryo seçilmedi)" if secilmeyen else ""))
    with tempfile.TemporaryDirectory(prefix="kahin-maliyet-kos-") as gecici:
        istek_yolu = os.path.join(gecici, "istek.json")
        with open(istek_yolu, "w", encoding="utf-8", newline="\n") as f:
            json.dump(istek, f, ensure_ascii=False)
        try:
            with open(istek_yolu, "rb") as giris:
                p = subprocess.run(komut, stdin=giris, capture_output=True, timeout=o["zaman"])
        except FileNotFoundError as e:
            return belirsiz(f"uyarlayıcı başlatılamadı: {e}")
        except subprocess.TimeoutExpired:
            return belirsiz(f"uyarlayıcı {o['zaman']:.0f} sn içinde bitmedi (YARIDA)")
    hata = p.stderr.decode("utf-8", "replace").strip().splitlines()
    if p.returncode != 0:
        return belirsiz(f"uyarlayıcı çıkış kodu {p.returncode}", hata[-15:])
    try:
        yanit = json.loads(p.stdout.decode("utf-8"))
    except ValueError as e:
        return belirsiz(f"uyarlayıcı yanıtı JSON değil: {e}", hata[-15:])
    if not isinstance(yanit, dict) or yanit.get("dil") != kahin.DIL or not isinstance(yanit.get("sonuclar"), list):
        return belirsiz("uyarlayıcı yanıtı sözleşmeye uymuyor (dil / sonuclar)")
    kim = yanit.get("uyarlayici") or {}
    print(f"program: {kim.get('ad', '?')} sürüm {kim.get('program_surumu', '?')} commit {kim.get('commit', '?')}")
    if kim.get("ad") == SAHTE and not o["kendi"]:
        return belirsiz("sahte uyarlayıcı (kâhinin kendisi) — program sınanmadı; yalnız --kendi-testi ile koşulur")
    beyan = yanit.get("beyan") or {}
    ayar = {"bos_sifir_sayilir": bool(beyan.get("bos_sifir_sayilir"))}
    if isinstance(beyan.get("gosterim_basamak"), int):
        ayar["gosterim_tol"] = 0.5 * 10 ** (-beyan["gosterim_basamak"])
    katmanlar = beyan.get("katmanlar") if isinstance(beyan.get("katmanlar"), list) else []
    sonuclar = {}
    for r in yanit["sonuclar"]:
        if isinstance(r, dict) and isinstance(r.get("kimlik"), str):
            sonuclar[r["kimlik"]] = r

    toplam = gecen = 0
    farklar, kosulmadi = [], []
    for s in senaryolar:
        neden = None
        if s["katman"] not in katmanlar:
            neden = f"katman {s['katman']} uyarlayıcıda yok"
        anahtar = kahin.secenek_anahtari(s, beyan)
        if neden is None and anahtar is None:
            neden = f"KARAR {s['karar']} beyan edilmedi (README K1/K2)"
        for g in s.get("gerektirir", []):
            kar, _, deg = g.partition("=")
            if neden is None and beyan.get(kar) != deg:
                neden = f"{g} gerekli, beyan {kar}={beyan.get(kar)!r}"
        if neden:
            kosulmadi.append(f"{s['kimlik']}: {neden}")
            continue
        r = sonuclar.get(s["kimlik"])
        if r is None:
            toplam += 1
            farklar.append(f"{s['kimlik']}: sonuç yok (okunamadı — fark sayılır)")
            continue
        n, ff = kahin.senaryo_karsilastir(s, s["beklenen"][anahtar], r.get("adimlar"), ayar)
        toplam += n
        gecen += n - len(ff)
        farklar += [f"{s['kimlik']}: {x}" for x in ff]

    rapor = {"dil": kahin.DIL, "uyarlayici": kim, "beyan": beyan, "kabul": o["kabul"], "katman": o["katman"], "senaryo": len(senaryolar),
             "koşulmadı": kosulmadi, "denetim": toplam, "fark": len(farklar), "farklar": farklar}
    if o["cikti"]:
        with open(o["cikti"], "w", encoding="utf-8", newline="\n") as f:
            json.dump(rapor, f, ensure_ascii=False, indent=1)
    for x in farklar[:80]:
        print(f"✗ {x}")
    if len(farklar) > 80:
        print(f"… {len(farklar) - 80} fark daha (--cikti ile tamamı)")
    if kosulmadi:
        print(f"koşulmayan senaryo: {len(kosulmadi)}")
        for x in kosulmadi[:20]:
            print(f"  {x}")
        print(f"koşulan denetim: {toplam}, geçen: {gecen}, fark: {len(farklar)}")
        return belirsiz(f"{len(kosulmadi)} senaryo koşulmadı; kâhin kabulü tamamlanmadı")
    if toplam == 0:
        return belirsiz("hiç denetim koşmadı")
    print(f"{gecen}/{toplam} denetim geçti" + (f", {len(farklar)} fark" if farklar else ""))
    return 1 if farklar else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
