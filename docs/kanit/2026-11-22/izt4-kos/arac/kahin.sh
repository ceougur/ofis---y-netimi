#!/bin/bash
# İzleyen tur 4: kâhin ↔ program iki saat diliminde (CI adımları) + yapım aşaması listesi not defterine (depodaki listeye DOKUNULMAZ).
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-ad3ee8a705a609628 || exit 1
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3
L=$N/kahin.log
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do
  t=$(echo $tz | tr '/' '-' | tr 'A-Z' 'a-z')
  for k in cari defter; do
    echo "== $k $tz $(date -u +%H:%M:%S) yük $(cat /proc/loadavg)" >> $L
    TZ=$tz node tools/kanit.mjs kos izt4-kahin-$k-$t -- npm run test:kahin-$k > $N/kahin-$k-$t.out 2>&1
    echo "$k $tz rc=$? $(date -u +%H:%M:%S)" >> $L
    tail -n 6 $N/kahin-$k-$t.out >> $L
  done
done
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $N/yapim-depo.json
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $N/yapim-yeni.json
echo "== yapım $(date -u +%H:%M:%S)" >> $L
KAHIN_YAPIM_ASAMASI=$N/yapim-yeni.json node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $N/yapim.out 2>&1
echo "yapım rc=$?" >> $L
tail -n 8 $N/yapim.out >> $L
python3 -I -c "import json,sys; a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2])); f=lambda x: x if isinstance(x,list) else x.get('kayitlar', x.get('items', x)); print('depo', len(f(a)) if hasattr(f(a),'__len__') else '?', 'yeni', len(f(b)) if hasattr(f(b),'__len__') else '?', 'ayni' if a==b else 'FARKLI')" $N/yapim-depo.json $N/yapim-yeni.json >> $L 2>&1
echo BITTI >> $L
