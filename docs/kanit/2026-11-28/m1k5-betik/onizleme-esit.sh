#!/bin/bash
# M1 KÜÇÜK TUR 5 KOPYASI: küçük tur 4ün betiği AYNEN — yalnız yollar bu tura (ağaç agent-a925406d24b0912d5, taban = t251-m1k4 kopyası /dev/shm/m1k5-kdv/eski).
# Önceki başlık: M1 KÜÇÜK TUR 4 KOPYASI.
# Kabul B (küçük tur 3): küçük tur 2nin onizleme-esit.sh betiği AYNEN — yalnız yollar bu tura göre (taban = t251-m1k2 kopyası /dev/shm/m1k4-kdv/eski, yeni = bu ajanın ağacı).
# Dar kontrolün senaryoları (A, B, C, E, F, J, L, L2 — betik m1k-betik/dk-senaryo-kopya.mjs, değiştirilmeden) taban ve yeni kodda; mahsup ön izlemesi ve fiş satırları
# (anahtarında mahsup / onizleme / geri-al / iptal / kilit geçen her çıktı) iki kodda BİREBİR mi. Rapor satırları ayrıca dökülür.
# Ek (bu tur): karma yoklaması (m1k-betik/karma-yoklama.mjs) — fiş satırları ("Ocak fişi", "Şubat fişi", "fişler") taban = yeni mi; rapor satırları dökülür (fark beklenir).
# flock -s altında çağrılır. $1 = çıktı klasörü.
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a925406d24b0912d5
OLD=/dev/shm/m1k5-kdv/eski
OUT=$1
mkdir -p $OUT
for tz in UTC Europe/Istanbul; do
  tag=$([ $tz = UTC ] && echo utc || echo ist)
  for side in taban:$OLD yeni:$WT; do
    name=${side%%:*}; code=${side#*:}
    TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1200 node $WT/docs/kanit/2026-11-27/m1k-betik/dk-senaryo-kopya.mjs $code A,B,C,E,F,J,L,L2 > $OUT/dk-$name-$tag.txt 2> $OUT/dk-$name-$tag.err
    echo "$name $tz çıkış $? · $(grep -c . $OUT/dk-$name-$tag.txt) satır"
    TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 600 node $WT/docs/kanit/2026-11-27/m1k-betik/karma-yoklama.mjs $code > $OUT/karma-$name-$tag.txt 2> $OUT/karma-$name-$tag.err
    echo "$name $tz karma çıkış $? · $(grep -c . $OUT/karma-$name-$tag.txt) satır"
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
print(f"  rapor satırlarında fark: {len(diff)} — {', '.join(diff)}")
EOF
  python3 -I - "$OUT/karma-taban-$tag.txt" "$OUT/karma-yeni-$tag.txt" "$tz" <<'EOF'
import sys
a = [l.rstrip("\n") for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
b = [l.rstrip("\n") for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
fis = lambda rows: [l for l in rows if l.startswith(("Ocak fişi", "Şubat fişi", "fişler"))]
fa, fb = fis(a), fis(b)
print(f"{sys.argv[3]} karma: fiş satırı taban {len(fa)} · yeni {len(fb)} · BİREBİR {'EVET' if fa == fb and len(fa) == 3 else 'HAYIR'}")
for x, y in zip([l for l in a if l not in fa], [l for l in b if l not in fb]):
    if x != y: print("  rapor taban:", x[:260], "\n        yeni :", y[:260])
EOF
done
