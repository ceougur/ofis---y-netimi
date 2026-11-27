import json, sys
a = json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2]))
print('error', a.get('error'), b.get('error'))
for k in a['steps']:
    x = a['steps'][k]
    y = b['steps'].get(k)
    print(k, 'UTC=IST' if x == y else 'FARKLI')
