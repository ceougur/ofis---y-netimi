"""model_b mutasyon testi: model.py'ye bilerek 33 hata enjekte eder (geçici kopyalarda; 22 sürüm 1–2 + 11 sürüm 4); her birinde
test_model.py kırmızı olmalı. Koşu: python3 -I test/bagimsiz/model_b/mutasyon.py  (çıkış 1 = kaçan mutant var)."""
import os, shutil, subprocess, sys
KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import tempfile
HEDEF = tempfile.mkdtemp(prefix="model_b_mut_")
MUT = [
 ("rh taban bölme", "return (2 * a + b) // (2 * b)", "return a // b"),
 ("BSMV hariç oranı", "bsmv = rh(u * 5, 100)", "bsmv = rh(u * 5, 1000)"),
 ("transfer ücreti BSMV'siz", 'g = u + rh(u * 5, 100) if a["ucretVergi"] == "bsmv_haric" else u', "g = u"),
 ("FIFO ters sıra", "        for _, _, bk in alacak:\n", "        for _, _, bk in reversed(alacak):\n"),
 ("eksi: yalnız Bh(d)", "m = min(d.bakiye(kod, tarih), d.bakiye(kod)) + limit", "m = d.bakiye(kod, tarih) + limit"),
 ("eksi: limit yok", "m = min(d.bakiye(kod, tarih), d.bakiye(kod)) + limit", "m = min(d.bakiye(kod, tarih), d.bakiye(kod))"),
 ("tek hesap kendiliğinden değil", "            if len(uygun) == 1:\n                return uygun[0]\n", ""),
 ("benzer kapalı", "    if etkin and not c.a.get(\"benzerOnay\"):\n        c.ekle(5, 409, \"bank-similar\", \"PLAN\")", "    pass"),
 ("iade KDV yönü", 'satirlar = [("610", "B", m_top, None), ("391", "B", k_top, None), (cari_kod, "A", t_top, ck)]',
                   'satirlar = [("610", "B", m_top + 2 * k_top, None), ("391", "A", k_top, None), (cari_kod, "A", t_top, ck)]'),
 ("Kasa açılışı 649", 'satirlar = [("100", "B", t, None), ("500", "A", t, None)]        # [YAYGIN] §4.8',
                      'satirlar = [("100", "B", t, None), ("649", "A", t, None)]'),
 ("ters tarihi hep asıl", 'tarih = h["tarih"] if (d.kilit is None or h["tarih"] > d.kilit) else d.bugun', 'tarih = h["tarih"]'),
 ("birim fiyattan yuvarlama", "        h = rh(brut * 100, 100 + r)\n        if p == 0:\n            m = h\n",
                              "        h = rh(brut * 100, 100 + r)\n        if p == 0:\n            m = q * rh(f * 100, 100 + r)\n"),
 ("BELİRSİZ-7 yok", 'nedenler.append("BELİRSİZ-7")', 'pass'),
 ("iade sınırı yok", "            c.ekle(4, \"4xx\")\n            break\n    if tarih < asil", "            break\n    if tarih < asil"),
 ("personel transfer serbest", '"transfer": {"yonetici": 200, "muhasebe": 200, "personel": 403}', '"transfer": {"yonetici": 200, "muhasebe": 200, "personel": 200}'),
 ("açılış düzelt eşit gün", "if ilk is not None and yeni > ilk:", "if ilk is not None and yeni >= ilk:"),
 ("kilit sınır günü", "if self.d.kilit is not None and t <= self.d.kilit:", "if self.d.kilit is not None and t < self.d.kilit:"),
 ("açılış öncesi kuralı yok", '            self.ekle(4, "4xx", "bank-before-opening", "CIKARIM")', "            pass"),
 ("stopaj netten düşmez", 'satirlar = [(d.hesap_alt(hk), "B", f - s, None), ("193", "B", s, None), ("642", "A", f, None)]',
                          'satirlar = [(d.hesap_alt(hk), "B", f, None), ("193", "B", s, None), ("642", "A", f + s, None)]'),
 ("istek kimliği yinelemesi yok", "                raise Yineleme(onceki)", "                pass"),
 ("kart odenen silinmişi sayar", 'return sum(p["tutar"] for p in d.para if p["etkin"] and p.get("kart") == tk)',
                                 'return sum(p["tutar"] for p in d.para if p.get("kart") == tk)'),
 ("engelle uyar gibi", '    if c.a.get("yineDeKaydet") and not engel:', '    if c.a.get("yineDeKaydet"):'),
 # ── sürüm 4: şüpheli alacak (PLAN §3.11b; KABUL K1–K9) ve K8 taksit (PLAN §3.10/3)
 ("644: tahsil kadar (plan-only okuma)", 'fazla = s["karsilik"] - s["kalan"]        # KABUL K6: karşılık ≤ kalan',
                                          'fazla = min(s["karsilik"], x)'),
 ("644 kuralı yok", "                        if fazla > 0:\n", "                        if False:\n"),
 # ("aynı gün tür sırası yok": eşdeğer mutant — BELİRSİZ-35 kuralı aynı günde tür sırasının adım sırasından ayrıştığı her
 #  birleşimi senaryo dışı bıraktığı için tür sırası olmadan da aynı sonuç çıkar; 15.10.2026'da görüldü, listeden çıkarıldı)
 ("en yeni kayıt önce", "                    acik.sort()\n", "                    acik.sort(reverse=True)\n"),
 ("değersiz hep 659", '                    y = min(s["karsilik"], veri["tutar"])', "                    y = 0"),
 ("çıkarmada karşılık 644'e gitmez", '                    if s["karsilik"] > 0:\n                        satirlar.append(("129", "B", s["karsilik"], None, tarih))',
                                      '                    if False:\n                        satirlar.append(("129", "B", s["karsilik"], None, tarih))'),
 ("cari bakiyesinde 128 yok", 'return self.bakiye(self.cari_kodu(ck), cari=ck) + (self.bakiye("128", cari=ck) if self.cariler[ck]["tur"] == "musteri" else 0)',
                              'return self.bakiye(self.cari_kodu(ck), cari=ck)'),
 ("120 sınırı şüpheliyi düşmez", "        yuz_yirmi = d.cari_bakiye(ck) - acik_kalan", "        yuz_yirmi = d.cari_bakiye(ck)"),
 ("karşılık sınırı kayıt tutarı", 'elif k is not None and s["karsilik"] + k > s["kalan"]:', 'elif k is not None and s["karsilik"] + k > r["T"]:'),
 ("evrak alacak satırı değil", 'ALACAK_SATIRI_TURLERI = {"cari_tahsilat", "taksit_tahsilat", "iade", "evrak_al"} if KABUL_KURALLARI',
                               'ALACAK_SATIRI_TURLERI = {"cari_tahsilat", "taksit_tahsilat", "iade"} if KABUL_KURALLARI'),
 ("plan-paid yok", '        if not fazla and kalan == 0:\n            c.ekle(4, 409, "plan-paid", "PLAN")',
                   '        if False:\n            c.ekle(4, 409, "plan-paid", "PLAN")'),
 ("kart kalanı eksiye düşer", 'return max(0, d.kartlar[tk]["toplam"] - kart_odenen(d, tk))', 'return d.kartlar[tk]["toplam"] - kart_odenen(d, tk)'),
]
kaynak = open(os.path.join(KOK, "model_b", "model.py"), encoding="utf-8").read()
yakalanmayan = []
for ad, eski, yeni in MUT:
    assert kaynak.count(eski) >= 1, ("mutasyon yeri yok", ad)
    k = os.path.join(HEDEF, "k")
    shutil.rmtree(k, ignore_errors=True)
    os.makedirs(os.path.join(k, "test", "bagimsiz", "model_b"))
    shutil.copytree(os.path.join(KOK, "senaryolar"), os.path.join(k, "test", "bagimsiz", "senaryolar"))
    open(os.path.join(k, "test", "bagimsiz", "model_b", "model.py"), "w", encoding="utf-8").write(kaynak.replace(eski, yeni, 1))
    shutil.copy(os.path.join(KOK, "model_b", "test_model.py"), os.path.join(k, "test", "bagimsiz", "model_b"))
    r = subprocess.run([sys.executable, "-I", os.path.join(k, "test", "bagimsiz", "model_b", "test_model.py")], capture_output=True)
    son = r.stderr.decode().strip().splitlines()[-1]
    durum = "YAKALANDI" if r.returncode != 0 else "KAÇTI"
    if r.returncode == 0: yakalanmayan.append(ad)
    print(f"{durum:10} {ad:32} {son}")
print("toplam", len(MUT), "yakalanan", len(MUT) - len(yakalanmayan), "kaçan", yakalanmayan)
print("%d geçti, %d kaldı" % (len(MUT) - len(yakalanmayan), len(yakalanmayan)))   # tools/kanit.mjs özeti
shutil.rmtree(HEDEF, ignore_errors=True)
sys.exit(1 if yakalanmayan else 0)
