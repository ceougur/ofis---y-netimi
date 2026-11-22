import json, sys
d = json.load(open(sys.argv[1]))
print('error', d.get('error'))
print('restore', d.get('restore'), 'staged', d.get('staged'))
for n, s in d['steps'].items():
    print('==', n)
    print('  GT D:', {k: s[k]['D'] for k in s if k.startswith('gt')})
    print('  BS 153/fark:', {k: (s[k]['s153'], s[k]['fark']) for k in s if k.startswith('bs')})
    print('  BS kar:', {k: s[k]['kar'] for k in s if k.startswith('bs')}, 'gecmis', s['bsNow']['gecmis'])
    print('  toplanir', s['toplanir'])
    print('  runs', s['runs'])
    print('  cards', s['cards'])
    print('  kartlar', s['kartlar'])
