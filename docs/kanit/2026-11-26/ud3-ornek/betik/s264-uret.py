import json, sys, copy
out = sys.argv[1]
base = {"dil": "destekofis-cari/3", "bugun": "2026-10-08", "aciklama": "UD turu 3 S264 testinin kâhin karşılığı", "dayanak": "S264 = A", "adimlar": [
    {"id": "c-e", "islem": "cari_ac", "ad": "E", "isim": "Degersiz S264", "tarih": "2026-09-01"},
    {"id": "s001", "islem": "fatura", "ad": "G1", "cari": "E", "tutar": "2900,00", "tarih": "2026-09-05"},
    {"id": "s002", "islem": "borc", "cari": "E", "tutar": "3400,00", "tarih": "2026-09-11", "vade": "2026-12-31"},
    {"id": "s003", "islem": "tahsilat", "cari": "E", "tutar": "2876,45", "tarih": "2026-09-17", "fatura": "G1"},
    {"id": "s004", "islem": "supheli_al", "ad": "SP", "cari": "E", "tutar": "3000,00", "tarih": "2026-09-17"},
    {"id": "s005", "islem": "degersiz", "supheli": "SP", "tutar": "3000,00", "tarih": "2026-09-17"},
    {"id": "k1", "islem": "kontrol"}]}


def w(name, f):
    x = copy.deepcopy(base)
    x['ad'] = name
    f(x['adimlar'])
    json.dump(x, open(f"{out}/{name}.json", "w"), ensure_ascii=False, indent=1)


def by(a, i):
    return next(s for s in a if s['id'] == i)


w('s264-a-ayni-gun-bagli', lambda a: None)
w('s264-b-ayni-gun-bagsiz', lambda a: by(a, 's003').pop('fatura'))


def c(a):
    by(a, 's004')['tarih'] = '2026-09-15'
    by(a, 's005')['tarih'] = '2026-09-18'


w('s264-c-sonra-bagli', c)


def e(a):
    by(a, 's005')['tutar'] = '3000,01'


w('s264-e-asim', e)


def f(a):
    by(a, 's003')['tutar'] = '1000,00'
    a.insert(4, {"id": "s003b", "islem": "tahsilat", "cari": "E", "tutar": "500,00", "tarih": "2026-09-17"})
    by(a, 's005')['tutar'] = '2500,00'


w('s264-f-bagli-bagsiz', f)


def g(a):
    f(a)
    by(a, 's005')['tutar'] = '2500,01'


w('s264-g-bagli-bagsiz-asim', g)
