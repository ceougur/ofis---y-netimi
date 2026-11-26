# Kâhin cari çıktı klasörünü özetler: senaryo başına fark sayısı, ilk fark, adım türleri; kural etiketine göre toplam.
# --degersizsiz <klasör>: farklı senaryoların 'degersiz' adımları atılmış kopyalarını yazar (sınıflama denemesi; kâhine dokunulmaz).
import json, os, sys, re, collections, copy
src = sys.argv[1]
oz = json.load(open(os.path.join(src, 'ozet.json')))
print('özet:', json.dumps(oz.get('farkSinifi')), 'genelToplam', oz.get('genelToplam'), 'genelFark', oz.get('genelFark'))
etiket = collections.Counter()
failing = []
for s in oz['ozet']:
    if not s['fark']:
        continue
    ad = s['ad']
    f = json.load(open(os.path.join(src, ad + '.fark.json')))
    sc = json.load(open(os.path.join(src, ad + '.json')))
    turler = sorted({a['islem'] for a in sc['adimlar']} & {'degersiz', 'supheli_al', 'karsiliksiz', 'iade', 'kart_ac', 'kart_tahsilat', 'donem_kilitle', 'fatura_iptal'})
    farklar = f['farklar']
    ilk = farklar[0] if farklar else {}
    for x in farklar:
        k = x.get('kural') or x.get('neden') or ''
        etiket[re.split(r'[:(]', str(k))[0].strip()[:40]] += 1
    failing.append(ad)
    print(f"{ad}: fark {s['fark']} bulgu {s['bulgu']} · türler {turler} · ilk {json.dumps(ilk, ensure_ascii=False)[:260]}")
print('kural başına:', etiket.most_common(15))
if '--degersizsiz' in sys.argv:
    out = sys.argv[sys.argv.index('--degersizsiz') + 1]
    os.makedirs(out, exist_ok=True)
    for ad in failing:
        sc = json.load(open(os.path.join(src, ad + '.json')))
        x = copy.deepcopy(sc)
        x['ad'] = ad + '-degersizsiz'
        x['adimlar'] = [a for a in x['adimlar'] if a['islem'] != 'degersiz']
        json.dump(x, open(os.path.join(out, x['ad'] + '.json'), 'w'), ensure_ascii=False)
    print('yazıldı', len(failing))
