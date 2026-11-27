#!/usr/bin/env bash
# Ç2 tur 3 — test düzeltmesinden (5a2c2844) sonra yinelenen koşular: test ailesi iki TZ, eski kod kırmızısı iki TZ, mutasyon (bütün 55 UTC + yeni 36–55 İstanbul).
# Kod 3f662426'dan beri değişmedi → G2, G6, e2e, v2.4.9 banka koşuları geçerli (yinelenmez).
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7280bb16b4491d5b
OLD=$S/c2t3-eski-bc495a1c
MUT=$S/c2t3-mut-5a2c2844
GD=/home/user/ofis---y-netimi/.git
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export KANIT_DIR=$S/c2t3-kanit
OZET=$S/c2t3-calisma/kos-ozet.txt
NT="node --disable-warning=ExperimentalWarning --test --test-concurrency=1"
FAMILY="test/fis-defteri-kayit-250.test.mjs test/banka-onarim-kayit-250.test.mjs test/fis-defteri-250.test.mjs test/fis-defteri-yasam-250.test.mjs test/fis-defteri-koruma-250.test.mjs"
cd "$WT" || exit 1
k() { local name=$1; shift; local t0=$(date -u +%H:%M:%S); node "$WT/tools/kanit.mjs" kos "$name" -- "$@" > "$S/c2t3-calisma/$name.kos.txt" 2>&1; local code=$?; echo "$t0 → $(date -u +%H:%M:%S) $name çıkış $code" >> "$OZET"; }
echo "ikinci başlangıç $(date -u +%FT%TZ) HEAD $(git -C "$WT" rev-parse --short HEAD)" >> "$OZET"
TZ=UTC k c2t3-yeni-utc $NT $FAMILY
TZ=Europe/Istanbul k c2t3-yeni-ist $NT $FAMILY
TZ=UTC k c2t3-eski-bc495a1c-utc env GIT_DIR=$GD $NT $OLD/test/fis-defteri-kayit-250.test.mjs $OLD/test/banka-onarim-kayit-250.test.mjs
TZ=Europe/Istanbul k c2t3-eski-bc495a1c-ist env GIT_DIR=$GD $NT $OLD/test/fis-defteri-kayit-250.test.mjs $OLD/test/banka-onarim-kayit-250.test.mjs
TZ=UTC k c2t3-mutasyon-utc node --disable-warning=ExperimentalWarning test/fis-defteri-250-mutasyon.mjs --kopya $MUT
TZ=Europe/Istanbul k c2t3-mutasyon-yeni-ist node --disable-warning=ExperimentalWarning test/fis-defteri-250-mutasyon.mjs --kopya $MUT --yalniz 36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55
echo "ikinci bitiş $(date -u +%FT%TZ)" >> "$OZET"
df -h / | tail -1 >> "$OZET"
