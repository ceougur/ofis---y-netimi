import json, sys
d = json.load(open(sys.argv[1]))
d['input']['lockAt'] = {'__fn': 'lockAt'}
json.dump(d, open(sys.argv[2], 'w'))
print(len(d['input']['lines']), 'satır')
