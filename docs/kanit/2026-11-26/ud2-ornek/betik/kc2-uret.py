import json, sys, copy
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))


def w(name, drop):
    x = copy.deepcopy(d)
    x['ad'] = name
    x['adimlar'] = [s for s in x['adimlar'] if s['id'] not in drop]
    json.dump(x, open(f"{out}/{name}.json", "w"), ensure_ascii=False, indent=1)


w('kc2-tahsilatsiz', {'s046'})
w('kc2-stoksuz', {'s011'})
w('kc2-iadesiz', {'s007'})
w('kc2-s054suz', {'s054'})
w('kc2-s050suz', {'s050'})
w('kc2-s012suz', {'s012'})
