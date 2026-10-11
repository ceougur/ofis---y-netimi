import json, subprocess, sys, os
ROOT = '/home/user/ofis---y-netimi/.claude/worktrees/agent-ac6660b9cab091377'
tag = sys.argv[1]  # notr-sonra / notr-once
seeds = sys.argv[2:]
D = f'{ROOT}/docs/kanit/2026-10-10/k1-iade-kapanisi/kahin/{tag}'
for spec in seeds:
    t, n = spec.split(':')
    fk = f'{D}/fark-{t}-notr.json'
    sen = f'{ROOT}/test/bagimsiz/cikti/senaryolar/rastgele-{t}-{n}-notr.json'
    if not os.path.exists(fk):
        print(t, 'fark dosyası yok'); continue
    out = subprocess.run(['python3', '-I', '/tmp/claude-0/-home-user/f3fde27e-cd8e-54af-b1ca-43dd7d833c3d/scratchpad/artan-analiz.py', fk, sen], capture_output=True, text=True)
    open(f'{D}/artan-analiz-{t}.json', 'w').write(out.stdout)
    d = json.loads(out.stdout)
    fark = json.load(open(fk))
    sn = ', '.join('%s: %s' % (k, v['yaprak']) for k, v in fark['siniflar'].items())
    print(f"tohum {t}×{n}: fark {fark['farkSayisi']} sınıflar [{sn}] · IADE cari {d['cariSayisi']} · hepsi ARTAN-FIFO: {d['hepsiArtanFifo']} · açık dışı {d['acikDisiYaprak']}")
    for c in d['cariler']:
        print(f"   {c['cari']}: iade artanı {c['iadeToplam']} = öbür belgeler {c['belgeToplam']} · {c['desen']} · iadeler {c['iadeler']} belgeler {c['belgeler']}")
