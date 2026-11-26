import json, sys, copy
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))


def w(name, f):
    x = copy.deepcopy(d)
    x['ad'] = name
    f(x['adimlar'])
    if x['adimlar'][-1]['islem'] != 'kontrol':
        x['adimlar'].append({"id": "k1", "islem": "kontrol"})
    json.dump(x, open(f"{out}/{name}.json", "w"), ensure_ascii=False, indent=1)


def bagsiz(a):
    for s in a:
        if s['id'] == 's010':
            s.pop('fatura', None)


def supheli_ertesi(a):
    for s in a:
        if s['id'] in ('s011', 's011d'):
            s['tarih'] = '2026-03-18'


def degersiz_ertesi(a):
    for s in a:
        if s['id'] == 's011d':
            s['tarih'] = '2026-03-18'


def tahsilat_once_gun(a):
    for s in a:
        if s['id'] == 's010':
            s['tarih'] = '2026-03-16'


w('kc1-asil', lambda a: None)
w('kc1-bagsiz', bagsiz)
w('kc1-supheli-ertesi', supheli_ertesi)
w('kc1-degersiz-ertesi', degersiz_ertesi)
w('kc1-tahsilat-onceki-gun', tahsilat_once_gun)
