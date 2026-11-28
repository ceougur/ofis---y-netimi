#!/bin/bash
# M1 KÜÇÜK TUR 5 — kabul D ek: kararın örneği + yan etki (m1k5-betik/yan-etki.mjs) taban (t251-m1k4 kopyası /dev/shm/m1k5-kdv/eski) ve yeni kodda, iki TZ: fiş, ön izleme ve defter
# satırları ("… fişi", "<n>: fişler", "Nisan ön izlemesi", "<n>: defter") BİREBİR mi; rapor satırları dökülür (fark beklenir: Nisan 500 → 700, Ocak–Nisan 1.400 → 1.600, Nisan
# fişliyken uyuşmazlık notu). flock -s altında çağrılır. $1 = çıktı klasörü.
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a925406d24b0912d5
OLD=/dev/shm/m1k5-kdv/eski
OUT=$1
mkdir -p "$OUT"
for tz in UTC Europe/Istanbul; do
  tag=$([ $tz = UTC ] && echo utc || echo ist)
  for side in taban:$OLD yeni:$WT; do
    name=${side%%:*}; code=${side#*:}
    ROOT=$code TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 600 node --disable-warning=ExperimentalWarning $WT/docs/kanit/2026-11-28/m1k5-betik/yan-etki.mjs > "$OUT/s4-$name-$tag.txt" 2> "$OUT/s4-$name-$tag.err"
    echo "$name $tz çıkış $? · $(grep -c . "$OUT/s4-$name-$tag.txt") satır"
  done
  python3 -I "$WT/docs/kanit/2026-11-28/m1k5-betik/fis-esit-s4.py" "$OUT/s4-taban-$tag.txt" "$OUT/s4-yeni-$tag.txt" "$tz"
done
