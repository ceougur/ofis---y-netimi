"""K1 sonrası kalan IADE-KAPAMA yapraklarının deseni: geri ödenmemiş iadenin artanı (model: iade belgesinin açığı) programda aynı
carinin başka açık belgesini (FIFO) kapatıyor mu? Her cari için: Σ(iade açığı: model − program) = Σ(öbür belgeler: model − program),
iade farkları ≥ 0, belge farkları ≥ 0 ve belgeler aynı yönde (satıştan iade ↔ satış; alıştan iade ↔ alış).
Kullanım: python3 -I artan-analiz.py <fark.json> <senaryo.json>"""
import json, sys
from collections import defaultdict

fark = json.load(open(sys.argv[1]))
sen = json.load(open(sys.argv[2]))
cari_of, tur_of = {}, {}
for x in sen['adimlar']:
    if x['islem'] == 'fatura':
        cari_of[x['ad']] = x['cari']
        tur_of[x['ad']] = x['tur']
for x in sen['adimlar']:
    if x['islem'] == 'iade':
        cari_of[x['ad']] = cari_of.get(x['asilFatura'])
        tur_of[x['ad']] = 'satis_iade' if tur_of.get(x['asilFatura']) == 'satis' else 'alis_iade'
by_cari = defaultdict(lambda: {'R': {}, 'F': {}})
other = []
for f in fark['farklar']:
    if f['yol'][0] == 'araDurumlar':
        continue
    if 'IADE-KAPAMA' not in json.dumps(f.get('kokSinif')):
        continue
    yol = f['yol']
    if not (yol[0] == 'faturalar' and yol[-1] == 'acik'):
        other.append(f)
        continue
    ad = yol[1]
    d = (f['a'] or 0) - (f['program'] or 0)
    kind = 'R' if tur_of.get(ad, '').endswith('iade') else 'F'
    by_cari[cari_of.get(ad)]['R' if kind == 'R' else 'F'][ad] = (d, tur_of.get(ad))
ok = True
rows = []
for c, g in by_cari.items():
    sr = sum(v[0] for v in g['R'].values())
    sf = sum(v[0] for v in g['F'].values())
    yon = {('satis' if t in ('satis', 'satis_iade') else 'alis') for (_, t) in list(g['R'].values()) + list(g['F'].values())}
    good = sr == sf and all(v[0] > 0 for v in g['R'].values()) and all(v[0] > 0 for v in g['F'].values()) and len(yon) == 1
    ok &= good
    rows.append({'cari': c, 'iadeler': g['R'], 'belgeler': g['F'], 'iadeToplam': sr, 'belgeToplam': sf, 'desen': 'ARTAN-FIFO' if good else 'BASKA'})
print(json.dumps({'senaryo': sen.get('ad'), 'cariSayisi': len(rows), 'hepsiArtanFifo': ok and not other, 'acikDisiYaprak': len(other), 'cariler': rows}, ensure_ascii=False, indent=1))
