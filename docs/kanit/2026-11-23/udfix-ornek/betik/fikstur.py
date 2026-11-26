# Küçültülmüş kuyruk girdisinden kalıcı fikstür: yalnız kalan satırların faturaları, kartların takvimi, satırların bağ / çek / an kayıtları; Map'ler [anahtar, değer] dizisi.
import json, sys
d = json.load(open(sys.argv[1]))['input']
lines = [{k: v for k, v in l.items() if k not in ('balance', 'note', 'label', 'receiptNo')} for l in d['lines']]
ids = {l['id'] for l in lines}
srcs = {l.get('sourceId') for l in lines}
plans = {l.get('planId') for l in lines if l.get('planId')}
m = lambda key: d[key]['__map'] if isinstance(d.get(key), dict) and '__map' in d[key] else []
out = {
    'aciklama': sys.argv[3],
    'today': d['today'],
    'lock': d['lockAt']['__lock'] if isinstance(d.get('lockAt'), dict) and '__lock' in d['lockAt'] else [],
    'lines': lines,
    'invoices': [i for i in d['invoices'] if i['id'] in srcs],
    'schedules': [e for e in m('schedules') if e[0] in plans],
    'links': [e for e in m('links') if e[0] in ids],
    'chequeEvents': [e for e in m('chequeEvents') if e[0] in ids],
    'reversals': [e for e in m('reversals') if e[0] in ids or e[1] in ids],
    'linkMoments': [e for e in m('linkMoments') if e[0] in ids],
    'linkTimes': [e for e in m('linkTimes') if e[0] in ids],
    'dueDates': [e for e in m('dueDates') if e[0] in ids],
    'promises': [e for e in m('promises') if e[0] in ids],
    'offsets': d.get('offsets') or [],
    'doubtfulRecords': d.get('doubtfulRecords') or [],
}
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print(len(lines), 'satır,', len(out['invoices']), 'fatura,', len(out['schedules']), 'kart')
