import json, sys
B = '/tmp/claude-0/-home-user/f3fde27e-cd8e-54af-b1ca-43dd7d833c3d/scratchpad/fark-once/'
A = '/home/user/ofis---y-netimi/.claude/worktrees/agent-ac6660b9cab091377/docs/kanit/2026-10-10/k1-iade-kapanisi/kahin/'
seeds = [int(x) for x in sys.argv[1:]] or [1, 2, 3, 4, 5]
out = {}
for t in seeds:
    b = json.load(open(B + f'fark-{t}.json'))
    a = json.load(open(A + f'fark-{t}.json'))
    cb = {k: v['yaprak'] for k, v in b['siniflar'].items()}
    ca = {k: v['yaprak'] for k, v in a['siniflar'].items()}
    print(f"tohum {t}: fark {b['farkSayisi']} -> {a['farkSayisi']}; sınıf {len(cb)} -> {len(ca)}; program {a['programEk'].get('commit')}")
    for k in sorted(set(cb) | set(ca)):
        if cb.get(k) != ca.get(k):
            print(f"   {k}: {cb.get(k)} -> {ca.get(k)}")
    out[t] = {'once': {'fark': b['farkSayisi'], 'siniflar': cb, 'program': b['programEk'].get('commit')}, 'sonra': {'fark': a['farkSayisi'], 'siniflar': ca, 'program': a['programEk'].get('commit')}}
json.dump(out, open(A + 'sinif-karsilastirma.json', 'w'), ensure_ascii=False, indent=1)
