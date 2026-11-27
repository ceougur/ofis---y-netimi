#!/bin/bash
# UD tur 2: en küçük örneklerin (API) çıktılarını kanıt klasörüne yazar.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud2-r4k9
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a3efe37d598ece90c
K=$W/docs/kanit/2026-11-26/ud2-ornek
mkdir -p $K/betik $K/cikti
cd $S || exit 1
for k in yeni eski v249 eski-kilitsiz; do
  A=""
  case $k in
    yeni) R=$W;;
    eski) R=$S/eski-kanca;;
    eski-kilitsiz) R=$S/eski-kanca; A=--kilitsiz;;
    v249) R=$S/v249;;
  esac
  {
    echo "# ROOT=$k (eski = aday e7934c5e git archive + yalnız obligationInputFor okuma kancası; v249 = git archive v2.4.9) · F2_VADE=2026-09-29 · node surucu3.mjs $A"
    F2_VADE=2026-09-29 ROOT=$R timeout 300 node surucu3.mjs $A 2>&1 | grep -v ExperimentalWarning | grep -v trace-warnings
  } > $K/cikti/tohum3-api-$k.txt
  echo "$k: $(grep 'Kuyruğu' $K/cikti/tohum3-api-$k.txt | cut -c1-110)"
done
for k in yeni v249; do
  case $k in yeni) R=$W;; v249) R=$S/v249;; esac
  for g in "" --ertesi-gun; do
    {
      echo "# ROOT=$k · node surucu8.mjs $g"
      ROOT=$R timeout 300 node surucu8.mjs $g 2>&1 | grep -v ExperimentalWarning | grep -v trace-warnings
    } > $K/cikti/tohum8-supheli-api-$k$g.txt
    echo "$k $g: $(grep 'Tahsilat' $K/cikti/tohum8-supheli-api-$k$g.txt | cut -c1-90)"
  done
done
cp $S/surucu3.mjs $S/surucu8.mjs $S/saf.mjs $S/karma.mjs $S/t6.mjs $S/kmin-kos.sh $S/eski-kos.sh $S/kc-sinif.py $S/kc-karsilastir.py $S/kc1-uret.py $S/kc2-uret.py $S/mut.sh $S/ornek-kanit.sh $S/tohum3-api.json $K/betik/
