# Kâhin cari senaryosunu en küçük örneğe indirir (ddmin; kâhine dokunmaz — kos.mjs'i kara kutu çağırır).
# Kullanım: python3 -I indir.py <senaryo.json> <ilk-kontrol-id> <anahtar-regex> <çıktı-klasörü> [--paralel 2]
#   anahtar-regex kontrol öneki ATILMIŞ fark anahtarına uygulanır (ör. 'hareket:s015$|takvim:hareket:s015$').
# Program kökü: KAHIN_PROGRAM_KOKU yoksa ajanın ağacı.
import json, sys, os, re, subprocess, copy, concurrent.futures, hashlib
W = '/home/user/ofis---y-netimi/.claude/worktrees/agent-acb2a64a5f6cdf8f2'
src, kilk, rx, out = sys.argv[1], sys.argv[2], re.compile(sys.argv[3]), sys.argv[4]
PAR = int(sys.argv[sys.argv.index('--paralel') + 1]) if '--paralel' in sys.argv else 2
os.makedirs(out, exist_ok=True)
d = json.load(open(src))
adim = []
for a in d['adimlar']:
    if a['islem'] == 'kontrol':
        if a['id'] == kilk:
            break
        continue
    adim.append(a)
REF = ('cari', 'fatura', 'supheli', 'hareket', 'evrak')
onbellek = {}


def kapali(secili):
    # bağımlılık: tanımı silinen adıma başvuran adım da düşer
    adlar = set()
    kalan = []
    for a in secili:
        refs = [a[f] for f in REF if f in a]
        if any(r not in adlar for r in refs):
            continue
        kalan.append(a)
        adlar.add(a['id'])
        if 'ad' in a:
            adlar.add(a['ad'])
    return kalan


def kos(secili, etiket):
    s = copy.deepcopy(d)
    s['adimlar'] = kapali(secili) + [{'id': 'k1', 'islem': 'kontrol'}]
    h = hashlib.sha1(json.dumps(s['adimlar'], sort_keys=True).encode()).hexdigest()[:12]
    if h in onbellek:
        return onbellek[h]
    s['ad'] = f'm-{h}'
    yol = f'{out}/{s["ad"]}.json'
    json.dump(s, open(yol, 'w'), ensure_ascii=False, indent=1)
    c = f'{out}/c-{h}'
    r = subprocess.run(['timeout', '600', 'node', '--disable-warning=ExperimentalWarning', 'test/bagimsiz/cari/kos.mjs', yol, '--mutasyonsuz', '--cikti', c],
                       cwd=W, capture_output=True, text=True)
    try:
        f = json.load(open(f'{c}/{s["ad"]}.fark.json'))['farklar']
    except Exception:
        onbellek[h] = (False, [])
        return onbellek[h]
    hit = [x for x in f if rx.search(x["anahtar"].split(":", 1)[1]) and (os.environ.get("K0") != "1" or x["beklenen"] == 0)]
    onbellek[h] = (bool(hit), hit, f)
    subprocess.run(['rm', '-rf', c])
    return onbellek[h]


def ok(secili):
    return kos(secili, '')[0]


assert ok(adim), 'tam önek hedefi üretmiyor'
# ddmin (parça çıkarma) — cari_ac / kullanici_ac adımları dahil
n = 2
cur = adim[:]
while len(cur) >= 2:
    parca = max(1, len(cur) // n)
    adaylar = [cur[:i] + cur[i + parca:] for i in range(0, len(cur), parca)]
    with concurrent.futures.ThreadPoolExecutor(PAR) as ex:
        sonuc = list(ex.map(ok, adaylar))
    ilk = next((a for a, s in zip(adaylar, sonuc) if s), None)
    if ilk is not None:
        cur = kapali(ilk)
        n = max(n - 1, 2)
        print('küçüldü', len(cur), flush=True)
    else:
        if parca == 1:
            break
        n = min(len(cur), n * 2)
s = copy.deepcopy(d)
s['ad'] = os.path.basename(out)
s['adimlar'] = kapali(cur) + [{'id': 'k1', 'islem': 'kontrol'}]
json.dump(s, open(f'{out}/EN-KUCUK.json', 'w'), ensure_ascii=False, indent=1)
r = kos(cur, '')
print('EN KÜÇÜK', len(cur), 'adım')
for a in s['adimlar']:
    print(' ', json.dumps(a, ensure_ascii=False))
for x in r[2]:
    print('  fark', x['anahtar'], 'P=', json.dumps(x['program'], ensure_ascii=False)[:150], 'K=', json.dumps(x['beklenen'], ensure_ascii=False)[:150], '|', x.get('sinif246', ''), '|', x['kural'][:80])
