#!/bin/bash
# Cari kâhini bakımı 26 (§38) — kanıt koşusu (bakım 25 betiğinin uyarlaması). Kullanım: kos.sh <utc|ist> <temel|program|program-eski|yapim|put>
#   temel        : öz test, G3 (eski kâhin kc25-taban ↔ yeni), elle tablo farkı, yeni elle tablolar yeni kâhinde, ESKİ kâhin kırmızısı (program AÇILMAZ)
#   program      : npm run test:kahin-cari düzeni (taban dalının programı ↔ YENİ kâhin; bütün elle senaryolar + rastgele 1–2 × 60 + mutasyon taraması; depodaki yapım aşaması listesiyle)
#   program-eski : aynı program ↔ ESKİ kâhin (bakım 25) — d56 / d57 / d58
#   yapim        : --yapim-asamasi-yaz kendi kopyada (KAHIN_YAPIM_ASAMASI — not defteri)
# Eski kopya: scratchpad/kc26-aba/eski (git archive izt2-sinama test/bagimsiz/cari). Her parça ≤ 40 dk. BÜTÜN koşular flock -s (süre sınırı kilidin İÇİNDE).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aba92b2d7bf349903
E=$S/kc26-aba/eski
A=docs/kanit/2026-11-22/kahin-cari26-arac
L=$S/olcum.lock
case "$1" in
  utc) export TZ=UTC ;;
  ist) export TZ=Europe/Istanbul ;;
  *) echo "kullanım: $0 utc|ist temel|program|program-eski|yapim"; exit 2 ;;
esac
Z=$1
export KANIT_DIR=$S/kc26-aba/kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
git status -s | grep -v node_modules | head -3
k() { flock -s -w 3600 "$L" timeout -k 5 2400 node tools/kanit.mjs kos "kahin-cari26-$1-$Z" -- "${@:2}"; echo "== $1: çıkış $?"; }
D=test/bagimsiz/cari/senaryolar
YENI="$D/d56-c5-s238-s240-iade-ve-secilmeyen.json $D/d57-c5-s241-s242-duzenle.json $D/d58-c5-s246-s243-kendi-kart-duzenle.json"
YENI58="$D/d58-c5-s246-s243-kendi-kart-duzenle.json"
case "$2" in
  temel)
    k oz python3 -I -B test/bagimsiz/cari/oz-test.py
    k g3 python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahin-cari26-g3-dokum-$Z.json
    k elle-fark python3 -I -B $A/elle-fark.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari
    k elle-yeni python3 -I -B $A/elle-karsilastir.py --model test/bagimsiz/cari $YENI
    k kirmizi-eski python3 -I -B $A/elle-karsilastir.py --kirmizi-bekle --model $E/test/bagimsiz/cari $YENI
    ;;
  g3) k g3 python3 -I -B $A/karsilastir.py --eski $E/test/bagimsiz/cari --yeni test/bagimsiz/cari --dokum $KANIT_DIR/kahin-cari26-g3-dokum-$Z.json ;;
  program) k program node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --cikti $S/kc26-aba/program-$Z ;;
  program-eski) KAHIN_PROGRAM_KOKU=$W k program-eski node --disable-warning=ExperimentalWarning $E/test/bagimsiz/cari/kos.mjs --mutasyonsuz --cikti $S/kc26-aba/program-eski-$Z $YENI ;;
  yapim)
    cp test/bagimsiz/cari/YAPIM-ASAMASI.json $S/kc26-aba/YAPIM-ASAMASI-$Z.json || exit 1
    KAHIN_YAPIM_ASAMASI=$S/kc26-aba/YAPIM-ASAMASI-$Z.json k yapim node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz --mutasyonsuz --cikti $S/kc26-aba/yapim-$Z
    ;;
  *) echo "adım?"; exit 2 ;;
esac
echo "bitti $(date -u +%FT%TZ)"
