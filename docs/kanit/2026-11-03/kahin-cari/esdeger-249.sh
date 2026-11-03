#!/usr/bin/env bash
# 2.4.9 cari kâhini eşdeğerlik denetimi (KARARLAR.md §12): yeni model.py'nin --kural 2.4.6 / --kural 2.4.5 / --legacy çıktıları,
# C1 öncesi modelin (b02874ba) çıktılarıyla bayt bayt aynı mı — c14 dışındaki bütün elle senaryolar + rastgele ux18/s1 tohum 1–3 × 120.
# Kullanım (depo kökünden): bash docs/kanit/2026-11-03/kahin-cari/esdeger-249.sh <boş geçici klasör>
T="${1:?geçici klasör gerekli}"
mkdir -p "$T/eski" || exit 1
git show b02874ba:test/bagimsiz/cari/model.py > "$T/eski/model.py" || exit 1
git show b02874ba:test/bagimsiz/cari/uretici.py > "$T/eski/uretici.py" || exit 1
K=test/bagimsiz/cari
n=0; f=0
for t in 1 2 3; do for tur in ux18 s1; do
  python3 -I "$T/eski/uretici.py" --tur $tur --tohum $t --islem 120 > "$T/r-$tur-$t-eski.json" || exit 1
  python3 -I $K/uretici.py --tur $tur --tohum $t --islem 120 > "$T/r-$tur-$t.json" || exit 1
  n=$((n+1)); cmp -s "$T/r-$tur-$t-eski.json" "$T/r-$tur-$t.json" || { f=$((f+1)); echo "✗ üretici farklı: $tur $t"; }
done; done
for s in $(ls $K/senaryolar/*.json | grep -v '/c14') "$T"/r-ux18-?.json "$T"/r-s1-?.json; do
  for kip in "--kural 2.4.6" "--kural 2.4.5" "--legacy"; do
    python3 -I "$T/eski/model.py" "$s" $kip > "$T/a.json" 2>&1; e1=$?
    python3 -I $K/model.py "$s" $kip > "$T/b.json" 2>&1; e2=$?
    n=$((n+1))
    if [ $e1 -ne $e2 ] || ! cmp -s "$T/a.json" "$T/b.json"; then f=$((f+1)); echo "✗ fark: $(basename $s) $kip"; fi
  done
done
echo "$((n-f))/$n denetim geçti"
[ $f -eq 0 ]
