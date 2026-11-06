# WK 19 ön tarama (kâhinin kendi kodu üzerinde; program kodu YOK): eski senaryolarda S58–S63'ün dokunduğu durumlar var mı?
import sys, collections
sys.dont_write_bytecode = True
KAHIN = sys.argv[1]
sys.path.insert(0, KAHIN)
import kahin, senaryolar
B = kahin.Benzetim
iz = collections.defaultdict(set)
_ki = B.kanca_isle
def kanca_isle(self, t, wamid, durum, kod, ek):
    j = self.wamid_is.get(wamid) or self.isler.get(ek.get("opaque"))
    if j is not None and j.durum == kahin.ATLANDI and durum in ("delivered", "read") and ek.get("imzali"):
        iz["atlandi_gec_teslim"].add((self.sen["ad"], j.anahtar, j.elendi_neden))
    return _ki(self, t, wamid, durum, kod, ek)
B.kanca_isle = kanca_isle
_atla = B.atla
def atla(self, j, neden, t):
    _atla(self, j, neden, t)
    if j.icerik_silindi and len(j.medyalar) > j.silinen_n:
        iz["atlandi_silinmis_medyali"].add((self.sen["ad"], j.anahtar, neden))
B.atla = atla
_is = B.icerik_sil
def icerik_sil(self, j, t, neden):
    once = j.durum
    _is(self, j, t, neden)
    if once == kahin.ATLANDI and len(j.medyalar) > j.silinen_n:
        iz["onceden_atlandi_sonra_silinen_medyali"].add((self.sen["ad"], j.anahtar, j.elendi_neden))
    if once in kahin.PDF_SUSUYOR:
        iz["pdf_susuyor_silinen"].add((self.sen["ad"], j.anahtar, once))
B.icerik_sil = icerik_sil
_yd = B.yeniden_dene
def yeniden_dene(self, o, t):
    tp = self.toplular[o["toplu"]]
    for j in tp.isler:
        if j.icerik_silindi and kahin.numara(self.kart_telefonu(j.cari))[0] is None:
            iz["yeniden_dene_silinmis_telsiz"].add((self.sen["ad"], j.anahtar, tp.sablon, j.durum))
    return _yd(self, o, t)
B.yeniden_dene = yeniden_dene
_yg = B.yine_de_gonder
def yine_de_gonder(self, o, t):
    j = self.isler[f'{o["toplu"]}/{o["cari"]}']
    if j.icerik_silindi and kahin.numara(self.kart_telefonu(j.cari))[0] is None:
        iz["yine_silinmis_telsiz"].add((self.sen["ad"], j.anahtar, self.toplular[o["toplu"]].sablon))
    return _yg(self, o, t)
B.yine_de_gonder = yine_de_gonder
_ttl = B.ttl_isle
def ttl_isle(self, t):
    for j in list(self.ttl_aktif.values()):
        if t >= self.ttl_son(j) and self.yol_calisiyor(j, t):
            w = self.wabalar[j.sirket]
            ayni = [s for s, w2 in self.wabalar.items() if w2 == w]
            if len(ayni) > 1:
                iz["ttl_ortak_waba"].add((self.sen["ad"], j.anahtar))
    return _ttl(self, t)
B.ttl_isle = ttl_isle
_init = B.__init__
def init(self, sen, *a, **k):
    _init(self, sen, *a, **k)
    if len(set(self.wabalar.values())) < len(self.wabalar):
        iz["ortak_waba_senaryo"].add(sen["ad"])
B.__init__ = init
_olay = B.olay
def olay(self, o, t):
    if o["tur"] == "kvkk_sil" and not self.lisans:
        iz["kvkk_salt_okunurda"].add(self.sen["ad"])
    return _olay(self, o, t)
B.olay = olay
n = 0
for s in senaryolar.tum_senaryolar():
    try:
        kahin.hesapla(senaryolar.girdi(s)); n += 1
    except Exception as e:
        print("HATA", s["ad"], e)
print("senaryo", n)
for k in sorted(iz):
    print(k, len(iz[k]))
    for x in sorted(iz[k], key=str)[:40]:
        print("   ", x)
