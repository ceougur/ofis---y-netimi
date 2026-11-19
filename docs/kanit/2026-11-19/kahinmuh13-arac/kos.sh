#!/bin/bash
# Muhasebe kâhini bakımı 13 + defter kâhini bakımı 4 — kanıt koşusu (program AÇILMAZ). Kullanım: kos.sh <utc|ist> [mutasyonsuz]
# Çalışma dizini: bakım worktree'si (temiz ağaç); eski kopya: scratchpad/kahinmuh13-eski (git archive kahin-muh13-taban test/bagimsiz/muhasebe test/bagimsiz/defter — bakım 12 / bakım 3 kâhinleri).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a1cc7f1375640faa7
E=$S/kahinmuh13-eski
K=$S/kahinmuh13-kirmizi-$1
A=docs/kanit/2026-11-19/kahinmuh13-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist [mutasyonsuz]"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kahinmuh13-kanit
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | grep -v node_modules | head -3
# eski kâhin + yeni senaryo / test dosyaları (ders 7, 38): muhasebe — senaryolar_elle.py + test_model.py; defter — senaryo.json + senaryolar/*.json
rm -rf "$K" && mkdir -p "$K" && cp -r "$E/test/bagimsiz/muhasebe" "$E/test/bagimsiz/defter" "$K/" \
  && cp test/bagimsiz/muhasebe/senaryolar_elle.py test/bagimsiz/muhasebe/test_model.py "$K/muhasebe/" \
  && cp test/bagimsiz/defter/senaryo.json "$K/defter/" && cp test/bagimsiz/defter/senaryolar/*.json "$K/defter/senaryolar/" || exit 1
k() { timeout -k 5 6900 node tools/kanit.mjs kos "kahinmuh13-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
k muh-test python3 -I -B test/bagimsiz/muhasebe/test_model.py
k muh-eski-kirmizi python3 -I -B "$K/muhasebe/test_model.py"
k muh-g3 python3 -I -B $A/g3-muh.py --eski $E/test/bagimsiz/muhasebe --yeni test/bagimsiz/muhasebe --dokum $KANIT_DIR/kahinmuh13-muh-g3-dokum-$Z.json
k muh-g3-atif python3 -I -B $A/g3-atif.py --eski $E/test/bagimsiz/muhasebe --yeni $W/test/bagimsiz/muhasebe
k defter-oz python3 -I -B test/bagimsiz/defter/oz-test.py
k defter-eski-kirmizi python3 -I -B "$K/defter/oz-test.py"
k defter-g3 python3 -I -B $A/g3-defter.py --eski $E/test/bagimsiz/defter --yeni $W/test/bagimsiz/defter
if [ "$2" != "mutasyonsuz" ]; then
  k muh-mutasyon flock -s -w 3600 $L python3 -I -B test/bagimsiz/muhasebe/mutasyon.py
fi
echo "bitti $(date -u +%FT%TZ)"
