import json, sys, collections
# kullanım: python3 -I siniflar.py fark.json
d = json.load(open(sys.argv[1], encoding='utf-8'))
rows = d['rows']
print(f"cari {d['n']} · açılış {d['open']} ms · TYK soğuk {d['tyCold']} ms · waFacts×n {d['tWa']} ms · bugün {d['now']}")
base_ok = [r for r in rows if not r['base']]
print('ortak eleme (İstemiyor/Pasif/Telefon):', collections.Counter(r['base'] for r in rows if r['base']))
def m(x): return f"{x:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
old = [r for r in base_ok if r['old']]
neu_raw = [r for r in base_ok if r['neu']]
print(f"\nTelefonu geçerli, istemiyor/pasif olmayan cari: {len(base_ok)}")
print(f"BUGÜN seçilen (eski taksit gecikmişi): {len(old)} cari · tutar toplamı {m(sum(r['old']['amount'] for r in old))}")
print(f"TYK gecikmişi > 0 (elemesiz): {len(neu_raw)} cari · {m(sum(r['neu']['amount'] for r in neu_raw))}")
def rule(r):
    if not r['neu']: return 'gecikmis_yok'
    if r['type'] == 'supplier': return 'tedarikci'
    if r['doubtfulOpen'] > 0: return 'supheli'
    if r['promise']: return 'soz'
    return 'gider'
after = collections.Counter(rule(r) for r in base_ok)
print('SONRA (öneri sırası: tedarikçi → şüpheli → söz):', dict(after))
go = [r for r in base_ok if rule(r) == 'gider']
print(f"SONRA seçilen: {len(go)} cari · {m(sum(r['neu']['amount'] for r in go))}  (tür: {dict(collections.Counter(r['type'] for r in go))})")
# sınıflar
cls = collections.defaultdict(list)
for r in base_ok:
    o, n = r['old'], r['neu']
    if not o and not n:
        if r['oldTotalsOverdue'] > 0: cls['eski alan>0 ama açık kartın sıradakisi gecikmemiş (bugün de gitmez)'].append(r)
        continue
    kinds = n['kinds'] if n else []
    if o and not n: cls['BUGÜN gider, SONRA gecikmiş yok (TYK 0)'].append(r); continue
    tag = 'yalnız ' + '+'.join(kinds) if kinds else '?'
    key = ('bugün de' if o else 'yalnız SONRA') + ' · ' + tag + ' · ' + rule(r)
    cls[key].append(r)
print('\nSINIF | cari | bugün tutar | sonra tutar | bakiye ≤ 0')
for k in sorted(cls, key=lambda k: -len(cls[k])):
    L = cls[k]
    ot = sum(r['old']['amount'] for r in L if r['old']); nt = sum(r['neu']['amount'] for r in L if r['neu'])
    print(f"{k} | {len(L)} | {m(ot)} | {m(nt)} | {sum(1 for r in L if r['balance'] <= 0.005)}")
both = [r for r in base_ok if r['old'] and r['neu']]
up = [r for r in both if r['neu']['amount'] > r['old']['amount'] + 0.005]
dn = [r for r in both if r['neu']['amount'] < r['old']['amount'] - 0.005]
eq = [r for r in both if abs(r['neu']['amount'] - r['old']['amount']) <= 0.005]
print(f"\nİKİSİNDE DE gecikmiş: {len(both)} · tutar artan {len(up)} (+{m(sum(r['neu']['amount']-r['old']['amount'] for r in up))}) · azalan {len(dn)} (−{m(sum(r['old']['amount']-r['neu']['amount'] for r in dn))}) · aynı {len(eq)}")
dd = [r for r in both if r['neu']['since'] != r['old']['due']]
print(f"{{{{3}}}} (en eski vade) değişen: {len(dd)} · daha eski {sum(1 for r in dd if r['neu']['since'] < r['old']['due'])}")
print(f"\nbakiye ≤ 0 iken BUGÜN seçilen: {sum(1 for r in old if r['balance'] <= 0.005)}; SONRA gecikmiş>0 iken bakiye ≤ 0: {sum(1 for r in neu_raw if r['balance'] <= 0.005)}")
print(f"tedarikçi: TYK gecikmişi olan {sum(1 for r in neu_raw if r['type']=='supplier')} (bugün seçilen tedarikçi {sum(1 for r in old if r['type']=='supplier')}); Diğer tür gecikmişli {sum(1 for r in neu_raw if r['type']=='other')}")
print(f"şüpheli kaydı açık: {sum(1 for r in base_ok if r['doubtfulOpen']>0)} cari; bunlardan bugün seçilen {sum(1 for r in old if r['doubtfulOpen']>0)}, TYK şüphesiz gecikmişi olan {sum(1 for r in neu_raw if r['doubtfulOpen']>0)}; kuyruk>0 ama kayıt kapalı {sum(1 for r in base_ok if r['doubtfulQueue']>0 and not r['doubtfulOpen']>0)}; kayıt açık ama kuyruk 0 {sum(1 for r in base_ok if r['doubtfulOpen']>0 and not r['doubtfulQueue']>0)}")
print(f"Ödeme Sözü Var (söz ≥ bugün, gecikmiş>0): {sum(1 for r in neu_raw if r['promise'])}; bunlardan bugün seçilen {sum(1 for r in old if r['promise'])}; söz = bugün {sum(1 for r in neu_raw if r['promise']==d['now'][:10])}")
print("kalem türleri (TYK gecikmişli cari sayısı):", dict(collections.Counter(k for r in neu_raw for k in r['neu']['kinds'])))
