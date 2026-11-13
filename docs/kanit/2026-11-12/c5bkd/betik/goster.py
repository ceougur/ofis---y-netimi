import json, sys
d = json.load(open(sys.argv[1]))
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1400
def show(k, v, ind=0):
    if isinstance(v, dict) and any(isinstance(x, dict) and 'bakiye' in x for x in v.values()):
        print(' ' * ind + k + ':')
        for kk, vv in v.items():
            show(kk, vv, ind + 2)
    else:
        print(' ' * ind + k, json.dumps(v, ensure_ascii=False)[:W])
for k, v in d.items():
    show(k, v)
