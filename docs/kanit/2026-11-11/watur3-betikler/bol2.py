d = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/watur3-betik/'
t = open(d + 'routes.diff', encoding='utf-8').read()
head, rest = t.split('\n@@', 1)
hunks = ['@@' + h for h in ('\n@@' + rest).split('\n@@')[1:]]
assert len(hunks) == 2
for k, i in (('wt27', 0), ('we', 1)):
    open(d + 'routes-' + k + '.patch', 'w', encoding='utf-8').write(head + '\n' + hunks[i].rstrip('\n') + '\n')
print('ok')
