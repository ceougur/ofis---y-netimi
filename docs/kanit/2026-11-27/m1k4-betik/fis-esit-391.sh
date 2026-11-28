#!/bin/bash
# M1 KÜÇÜK TUR 4 KOPYASI: küçük tur 3ün betiği AYNEN — yalnız yollar bu tura (ağaç agent-a7d99fd88f55969de, taban = t251-m1k3 kopyası /dev/shm/m1k4-kdv/eski, kanıt scratchpad/m1k4/kanit, ad öneki m1k4-).
# Kabul B ek (küçük tur 3): kararın örneği (m1k2-betik/yalniz-391-devreden-yoklama.mjs, DEĞİŞTİRİLMEDEN) taban ve yeni kodda, iki TZ: fiş satırları ("Mart fişi", "Nisan fişi")
# BİREBİR mi; rapor satırları dökülür (fark beklenir: Nisan 800 / 200 → 700 / 300, Mart–Nisan 200 → 300). flock -s altında çağrılır. $1 = çıktı klasörü.
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7d99fd88f55969de
OLD=/dev/shm/m1k4-kdv/eski
OUT=$1
mkdir -p $OUT
for tz in UTC Europe/Istanbul; do
  tag=$([ $tz = UTC ] && echo utc || echo ist)
  for side in taban:$OLD yeni:$WT; do
    name=${side%%:*}; code=${side#*:}
    TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 600 node $WT/docs/kanit/2026-11-27/m1k2-betik/yalniz-391-devreden-yoklama.mjs $code > $OUT/y391-$name-$tag.txt 2> $OUT/y391-$name-$tag.err
    echo "$name $tz çıkış $? · $(grep -c . $OUT/y391-$name-$tag.txt) satır"
  done
  python3 -I - "$OUT/y391-taban-$tag.txt" "$OUT/y391-yeni-$tag.txt" "$tz" <<'EOF'
import sys
a = [l.rstrip("\n") for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
b = [l.rstrip("\n") for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
fis = lambda rows: [l for l in rows if l.startswith(("Mart fişi", "Nisan fişi"))]
fa, fb = fis(a), fis(b)
print(f"{sys.argv[3]} yalnız 391: fiş satırı taban {len(fa)} · yeni {len(fb)} · BİREBİR {'EVET' if fa == fb and len(fa) == 2 else 'HAYIR'}")
for x, y in zip([l for l in a if l not in fa], [l for l in b if l not in fb]):
    if x != y: print("  rapor taban:", x[:220], "\n        yeni :", y[:220])
EOF
done
