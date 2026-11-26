# Yeni kod ↔ v2.4.9: kâhinin 'SINIF DIŞI' (2.5.0 kararıyla değişmeyen kural) farkları v2.4.9 programında da var mı?
# Kullanım: python3 -I kc-karsilastir.py <ud2-r4k9 klasörü> <senaryo adları…>
import json, os, sys, collections
S = sys.argv[1]
tot = collections.Counter()
for ad in sys.argv[2:]:
    def farklar(k):
        p = os.path.join(S, f'kc-{k}-{ad}', ad + '.fark.json')
        return {x['anahtar']: x for x in json.load(open(p))['farklar']}
    y, v = farklar('yeni'), farklar('v249')
    dis = {k: x for k, x in y.items() if x.get('sinif246') == 'SINIF DIŞI'}
    ic = {k: x for k, x in y.items() if x.get('sinif246') != 'SINIF DIŞI'}
    dis_v = [k for k in dis if k in v]
    dis_yeni = [k for k in dis if k not in v]
    tot['fark'] += len(y); tot['dis'] += len(dis); tot['dis_v249de_de'] += len(dis_v); tot['dis_yalniz_250'] += len(dis_yeni); tot['ic'] += len(ic)
    ornek = dis[dis_yeni[0]] if dis_yeni else None
    print(f"{ad}: fark {len(y)} (2.5.0 sınıfı {len(ic)}, SINIF DIŞI {len(dis)}: v2.4.9'da da fark {len(dis_v)}, YALNIZ 2.5.0'da {len(dis_yeni)})" + (f" · örnek {ornek['anahtar']}: program {ornek['program']} · kâhin {ornek['beklenen']} ({ornek['kural'][:90]}) · v2.4.9 programı {json.load(open(os.path.join(S, f'kc-v249-{ad}', ad + '.program.json'))).get(ornek['anahtar'])}" if ornek else ''))
print('TOPLAM', dict(tot))
