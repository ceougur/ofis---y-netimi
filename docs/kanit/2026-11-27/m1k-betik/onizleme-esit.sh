#!/bin/bash
# Kabul D: dar kontrolün senaryoları (A, B, C, E, F, J, L — betik dk-senaryo-kopya.mjs, değiştirilmeden) taban ve yeni kodda; mahsup ön izlemesi ve fiş satırları
# (anahtarında mahsup / onizleme / geri-al / iptal / kilit geçen her çıktı) iki kodda BİREBİR mi. Rapor satırları ayrıca dökülür (fark beklenir: bu turun işi).
# flock -s altında çağrılır. $1 = çıktı klasörü.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-af4f8faccec231727
OUT=$1
mkdir -p $OUT
for tz in UTC Europe/Istanbul; do
  tag=$([ $tz = UTC ] && echo utc || echo ist)
  for side in taban:/dev/shm/m1k-kdv/eski yeni:$WT; do
    name=${side%%:*}; code=${side#*:}
    TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1200 node $WT/docs/kanit/2026-11-27/m1k-betik/dk-senaryo-kopya.mjs $code A,B,C,E,F,J,L,L2 > $OUT/dk-$name-$tag.txt 2> $OUT/dk-$name-$tag.err
    echo "$name $tz çıkış $? · $(grep -c . $OUT/dk-$name-$tag.txt) satır"
  done
  python3 -I - "$OUT/dk-taban-$tag.txt" "$OUT/dk-yeni-$tag.txt" "$tz" <<'EOF'
import sys, re
a = [l.rstrip("\n") for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
b = [l.rstrip("\n") for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
key = lambda l: l.split(" ", 1)[0]
pick = lambda rows: [l for l in rows if re.search(r"(mahsup|onizleme|geri-al|iptal|kilit|fisler)", key(l))]
pa, pb = pick(a), pick(b)
same = pa == pb
print(f"{sys.argv[3]}: ön izleme / fiş satırı taban {len(pa)} · yeni {len(pb)} · BİREBİR {'EVET' if same else 'HAYIR'}")
if not same:
    for x, y in zip(pa, pb):
        if x != y: print("  FARK taban:", x[:300], "\n       yeni :", y[:300])
ra = {key(l): l for l in a if l not in pa}
rb = {key(l): l for l in b if l not in pb}
diff = [k for k in sorted(set(ra) | set(rb)) if ra.get(k) != rb.get(k)]
print(f"  rapor satırlarında fark (bu turun işi): {len(diff)} — {', '.join(diff)}")
EOF
done
