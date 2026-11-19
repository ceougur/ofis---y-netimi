#!/bin/bash
# Muhasebe kâhini bakımı 12 + cari kâhini bakımı 20 — kanıt koşusu (program AÇILMAZ). Kullanım: kos.sh <utc|ist>
# Çalışma dizini: bakım worktree'si (temiz ağaç); eski kopya: scratchpad/kahinmuh12-eski (git archive kahin-muh12-taban test/bagimsiz/muhasebe test/bagimsiz/cari — bakım 11 / bakım 19 kâhinleri).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/kahin-muh12-aa91
E=$S/kahinmuh12-eski
K=$S/kahinmuh12-kirmizi-$1
A=docs/kanit/2026-11-14/kahinmuh12-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahinmuh12-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | head -3
# eski kâhin + yeni senaryo / test dosyaları (muhasebe; ders 7, 38)
mkdir -p "$K" && cp -r "$E/test/bagimsiz/muhasebe" "$K/" && cp test/bagimsiz/muhasebe/senaryolar_elle.py test/bagimsiz/muhasebe/test_model.py "$K/muhasebe/" || exit 1
D=test/bagimsiz/cari/senaryolar
YENI="$D/d47-c5-s168-s181-bagli-tahsilat.json $D/d44-c5-s155-s158.json"
k() { timeout -k 5 5400 node tools/kanit.mjs kos "kahinmuh12-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
k muh-test python3 -I -B test/bagimsiz/muhasebe/test_model.py
k muh-mutasyon flock -s -w 3600 $L python3 -I -B test/bagimsiz/muhasebe/mutasyon.py
k muh-eski-kirmizi python3 -I -B "$K/muhasebe/test_model.py"
k muh-g3 python3 -I -B $A/g3-muh.py --eski $E/test/bagimsiz/muhasebe --yeni test/bagimsiz/muhasebe --dokum $KANIT_DIR/kahinmuh12-muh-g3-dokum-$Z.json
k muh-yeni-mutantlar flock -s -w 3600 $L python3 -I -B $A/yeni-mutantlar-muh.py $W/test/bagimsiz/muhasebe
k cari-oz flock -s -w 3600 $L python3 -I -B test/bagimsiz/cari/oz-test.py
k cari-mutasyon flock -s -w 3600 $L python3 -I -B $A/mutasyon-tara.py --model test/bagimsiz/cari
k cari-g3 flock -s -w 3600 $L python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahinmuh12-cari-g3-dokum-$Z.json
k cari-elle-yeni python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
k cari-kirmizi-eski python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
k cari-elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
k cari-g1-tara python3 -I -B $A/g1-tara.py $D --sert
k cari-mutant-senaryo python3 -I -B $A/mutant-senaryo.py --model test/bagimsiz/cari
k cari-genis-tarama flock -s -w 3600 $L python3 -I -B $A/genis-tarama.py --model test/bagimsiz/cari
timeout -k 5 1800 python3 -I -B $A/ozet-tara.py test/bagimsiz/cari > $KANIT_DIR/kahinmuh12-cari-ozet-tara-$Z.txt 2>&1; echo "== ozet-tara: çıkış $?"
echo "bitti $(date -u +%FT%TZ)"
