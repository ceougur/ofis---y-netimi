#!/bin/bash
# Cari kâhini bakımı 24 (§36) — kanıt koşusu. Kullanım: kos.sh <utc|ist> <temel|program|program-eski|yapim>
#   temel        : öz test, G3 (eski kâhin de403915 ↔ yeni), elle tablo farkı, yeni elle tablolar yeni kâhinde, ESKİ kâhin kırmızısı (program AÇILMAZ)
#   program      : npm run test:kahin-cari (taban dalının programı ↔ YENİ kâhin; bütün elle senaryolar + rastgele 1–2 × 60 + mutasyon taraması)
#   program-eski : aynı program ↔ ESKİ kâhin (bakım 23) — eski kâhinin kırmızısı programda (yeni senaryolar eski kâhinde)
#   yapim        : --yapim-asamasi-yaz kendi kopyada (KAHIN_YAPIM_ASAMASI)
# Çalışma dizini: bakım worktree'si; eski kopya: scratchpad/kc24/eski (git archive de403915 test/bagimsiz/cari). Her parça ≤ 40 dk (timeout 2400 sn). BÜTÜN koşular flock -s.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-af6968001b29cf05e
E=$S/kc24/eski
A=docs/kanit/2026-11-21/kahin-cari24-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist temel|program|program-eski|yapim"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kc24/kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | grep -v node_modules | head -3
k() { timeout -k 5 2400 flock -s -w 3600 "$L" node tools/kanit.mjs kos "kahin-cari24-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
D=test/bagimsiz/cari/senaryolar
YENI="$D/d53-c5-s234-kapali-kart-iade.json $D/d54-c5-s234-acik-kart-iade.json $D/d55-c5-s234-iade-iptal-gecikmis.json"
case "$2" in
  temel)
    k oz python3 -I -B test/bagimsiz/cari/oz-test.py
    k g3 python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahin-cari24-g3-dokum-$Z.json
    k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
    k elle-yeni python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
    k kirmizi-eski python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
    ;;
  program) k program node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --cikti $S/kc24/program-$Z ;;
  program-eski) KAHIN_PROGRAM_KOKU=$W k program-eski node --disable-warning=ExperimentalWarning $E/test/bagimsiz/cari/kos.mjs --mutasyonsuz --cikti $S/kc24/program-eski-$Z $D/d54-c5-s234-acik-kart-iade.json $D/d55-c5-s234-iade-iptal-gecikmis.json ;;
  yapim)
    cp test/bagimsiz/cari/YAPIM-ASAMASI.json $S/kc24/YAPIM-ASAMASI-$Z.json || exit 1
    KAHIN_YAPIM_ASAMASI=$S/kc24/YAPIM-ASAMASI-$Z.json k yapim node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz --mutasyonsuz --cikti $S/kc24/yapim-$Z
    ;;
  *) echo "kullanım: $0 utc|ist temel|program|program-eski|yapim"; exit 2 ;;
esac
echo "bitti $(date -u +%FT%TZ)"
