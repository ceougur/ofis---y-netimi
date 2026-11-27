import sys
d = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/watur3-betik/'
t = open(d + 'queue.diff', encoding='utf-8').read()
head, rest = t.split('\n@@', 1)
hunks = ['@@' + h for h in ('\n@@' + rest).split('\n@@')[1:]]
print(len(hunks))
groups = {'s70': [6, 8, 9], 's90': [0, 7], 't16': [1, 4, 5], 'd1': [2, 3]}
assert sorted(sum(groups.values(), [])) == list(range(len(hunks)))
for k, idx in groups.items():
    body = head + '\n' + '\n'.join(hunks[i].rstrip('\n') for i in idx) + '\n'
    open(d + 'queue-' + k + '.patch', 'w', encoding='utf-8').write(body)
    print(k, [hunks[i].split('\n')[0][:40] for i in idx])
