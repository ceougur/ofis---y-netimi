"""Eski kâhin (d9ac9c14, ayrı kopya) ↔ yeni kâhin (2.5.0) fark dökümü — yeni senaryolar eski kâhinde beklenen nedenle farklı mı (ders 7, 38).
Kullanım: python3 -I fark_dokumu.py <depo kökü>"""
import json, os, subprocess, sys
KOK = sys.argv[1]
ESKI = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski-c5/eski/test/bagimsiz"
PY = sys.executable

def kos(argv, girdi=None):
    r = subprocess.run([PY, "-I"] + argv, capture_output=True, input=girdi)
    return r.returncode, r.stdout, r.stderr.decode()[-300:]

print("=" * 100)
print("CARİ KÂHİNİ — yeni elle senaryolar d1–d8: eski model (2.4.9 varsayılan) ↔ yeni model (2.5.0)")
for f in sorted(os.listdir(os.path.join(KOK, "test/bagimsiz/cari/senaryolar"))):
    if not f.startswith("d"):
        continue
    p = os.path.join(KOK, "test/bagimsiz/cari/senaryolar", f)
    rc_e, e, err_e = kos([os.path.join(ESKI, "cari/model.py"), p])
    rc_y, y, err_y = kos([os.path.join(KOK, "test/bagimsiz/cari/model.py"), p])
    print("-- %s (eski çıkış %d, yeni çıkış %d)" % (f, rc_e, rc_y))
    if rc_e or rc_y:
        print("   eski: %s | yeni: %s" % (err_e.strip()[-200:], err_y.strip()[-200:]))
        continue
    a, b = json.loads(e)["denetimler"], json.loads(y)["denetimler"]
    el = json.load(open(p, encoding="utf-8")).get("elleBeklenen", {})
    for k in sorted(set(a) | set(b)):
        va, vb = a.get(k, {}).get("b", "—YOK—"), b.get(k, {}).get("b", "—YOK—")
        if va != vb and (k in el or ":mizan:" in k or ":kalan" in k or ":acik" in k or ":odenen" in k or ":gecikmis" in k or k.startswith("k1:takvim:hareket")):
            print("   %s: eski %s → yeni %s%s" % (k, json.dumps(va, ensure_ascii=False)[:120], json.dumps(vb, ensure_ascii=False)[:160], "  [elle tablo]" if k in el else ""))

print("=" * 100)
print("DEFTER KÂHİNİ — yeni senaryolar: eski kahin.py yeni olay türlerini TANIMAZ; eski kâhinin tanıdığı olaylara süzülmüş senaryoda eski ↔ yeni (2.5.0)")
ESKI_TURLER = {"cari", "urun", "kasa_acilis", "banka_hesap", "kart_hesap", "pos", "cari_acilis", "fatura", "iptal", "tahsilat", "odeme", "cek", "ciro", "tahsile_ver",
               "karsiliksiz", "supheli", "karsilik", "masraf", "faiz_gelir", "faiz_gider", "virman", "kasa_gider", "taksit_tahsil", "vergi_odeme", "kdv_mahsup",
               "kdv_mahsup_geri_al", "kontrol"}
dosyalar = [os.path.join(KOK, "test/bagimsiz/defter/senaryo.json")] + [os.path.join(KOK, "test/bagimsiz/defter/senaryolar", f)
                                                                       for f in sorted(os.listdir(os.path.join(KOK, "test/bagimsiz/defter/senaryolar")))]
for p in dosyalar:
    sen = json.load(open(p, encoding="utf-8"))
    yeni_tur = sorted({o["tur"] for o in sen["olaylar"]} - ESKI_TURLER)
    rc_e, _, err_e = kos([os.path.join(ESKI, "defter/kahin.py"), p])
    suz = dict(sen, olaylar=[o for o in sen["olaylar"] if o["tur"] in ESKI_TURLER and not (o["tur"] == "karsiliksiz" and o["cek"] not in {x["id"] for x in sen["olaylar"] if x["tur"] == "cek"})])
    yol = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski-c5/suz-" + os.path.basename(p)
    json.dump(suz, open(yol, "w", encoding="utf-8"), ensure_ascii=False)
    print("-- %s: eski kâhin tam senaryoda çıkış %d (%s); yeni olay türleri: %s" % (os.path.basename(p), rc_e, err_e.strip().splitlines()[-1] if err_e.strip() else "—", ", ".join(yeni_tur) or "yok"))
    if any(o["tur"] == "goc" for o in sen["olaylar"]):
        print("   göç senaryosu — eski kâhinin dünyasında göç yok; süzülmüş karşılaştırma anlamsız (atlandı)")
        continue
    rc_e, e, err_e = kos([os.path.join(ESKI, "defter/kahin.py"), yol])
    rc_y, y, err_y = kos([os.path.join(KOK, "test/bagimsiz/defter/kahin.py"), yol])
    if rc_e or rc_y:
        print("   süzülmüş: eski %d %s | yeni %d %s" % (rc_e, err_e[-150:], rc_y, err_y[-150:]))
        continue
    a, b = json.loads(e), json.loads(y)
    for k in a["kontrolSirasi"]:
        ka, kb = a["kontroller"][k], b["kontroller"][k]
        fark = {h: (ka.get(h, 0), kb.get(h, 0)) for h in sorted(set(ka) | set(kb)) if ka.get(h, 0) != kb.get(h, 0)}
        if fark:
            print("   %s: %s" % (k, ", ".join("%s eski %d → yeni %d" % (h, x, z) for h, (x, z) in fark.items())))
    print("   retler: eski (alan yok) → yeni %s" % b.get("retler"))
