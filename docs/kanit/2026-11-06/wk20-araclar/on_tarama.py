"""WK 20 ön tarama (program kodu YOK; yalnız kâhinin kendi kopyası dışarıdan sarılır, kâhine yama yok).
Kullanım: python3 -I on_tarama.py <kahin klasörü>
(a) R3 sayımı: başlatmada R3 adımından ÖNCE elenen (silindi / pasif / istemiyor / telefonsuz / gecersiz / şüpheli / gecikmiş borç yok / net) ama aynı dönemde
    daha önce almış (onceden_gonderildi ≠ None) kişi — senaryo, etiket, cari, neden, uyarı var mı.
(b) Atlandı işe geç teslim: kanca_isle'ye girerken iş Atlandı + teslim olayı → senaryo, iş, neden, olay.
(c) işteki Yine de Gönder: içeriği silinmiş Ödeme Hatırlatma işi (kart telefonu türü, iş durumu, hedef)."""
import json
import sys

sys.dont_write_bytecode = True
klasor = sys.argv[1]
sys.path.insert(0, klasor)
import kahin  # noqa: E402
import senaryolar  # noqa: E402

ONCE = {"silindi", "pasif", "istemiyor", "telefonsuz", "gecersiz", "supheli_alacak", "gecikmis_borc_yok", "net_borc_yok"}
KAYIT = []
AKTIF = {"ad": None}
B = kahin.Benzetim
eski_baslat = B.baslat


def baslat(self, o, t):
    r = eski_baslat(self, o, t)
    et = o["etiket"]
    el = self.elenen.get(et) or {}
    sablon = o.get("sablon", "ekstre")
    sirket = o.get("sirket", "A")
    for cid, neden in el.items():
        n = neden if isinstance(neden, str) else json.dumps(neden, ensure_ascii=False)
        if n in ONCE or not isinstance(neden, str):
            coz = kahin.donem_coz(o.get("donem"), t, self.tz, sablon, self.mut)
            ctx = self.kisi_ctx(coz, cid)
            ot = self.onceden_gonderildi(cid, sablon, ctx, sirket, t)
            if ot is not None:
                KAYIT.append(("a", AKTIF["ad"], et, cid, n, et in self.onceki_uyari))
    return r


B.baslat = baslat
eski_kanca = B.kanca_isle


def kanca_isle(self, t, wamid, durum, kod, ek):
    j = self.wamid_is.get(wamid) or (self.isler.get(ek.get("opaque")) if ek.get("imzali") else None)
    if j is not None and j.durum == kahin.ATLANDI and durum in ("delivered", "read"):
        KAYIT.append(("b", AKTIF["ad"], j.anahtar, j.elendi_neden, durum))
    return eski_kanca(self, t, wamid, durum, kod, ek)


B.kanca_isle = kanca_isle
eski_yine = B.yine_de_gonder


def yine_de_gonder(self, o, t):
    j = self.isler.get(f'{o["toplu"]}/{o["cari"]}')
    tp = self.toplular.get(o["toplu"])
    if j is not None and tp is not None and tp.sablon == "hatirlatma" and j.icerik_silindi:
        KAYIT.append(("c", AKTIF["ad"], j.anahtar, kahin.numara(self.kart_telefonu(j.cari))[1], j.durum, o.get("hedef")))
    return eski_yine(self, o, t)


B.yine_de_gonder = yine_de_gonder

hata = 0
for s in senaryolar.tum_senaryolar():
    AKTIF["ad"] = s["ad"]
    try:
        kahin.hesapla(senaryolar.girdi(s))
    except Exception as e:  # noqa: BLE001
        hata += 1
        print("HATA", s["ad"], type(e).__name__, str(e)[:200])
print(f"senaryo {len(senaryolar.tum_senaryolar())}, hata {hata}")
gor = set()
for k in KAYIT:
    if k in gor:
        continue
    gor.add(k)
    print(*k, sep=" | ")
