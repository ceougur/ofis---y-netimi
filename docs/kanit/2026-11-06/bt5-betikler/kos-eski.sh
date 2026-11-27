#!/bin/bash
# BT5: eski kod kopyasında (ders 23, 25) verilen test dosyalarını koşar. Kullanım: kos-eski.sh <kopya-adı> <çıktı-adı> <TZ> <dosya…>
# Kopya git deposu değildir; sürüm etiketlerini okuyan testler (test/guvenilirlik/surumler.mjs bootVersion) için GIT_DIR bu ajanın worktree git klasörüne (etiketler ortak) verilir.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
COPY="$S/$1"
OUT="$S/bt5-kanit/$2.txt"
ZONE="$3"
shift 3
cd "$COPY" || exit 2
GIT_DIR=/home/user/ofis---y-netimi/.git/worktrees/agent-a731f6dec73e0177c TZ="$ZONE" HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout 3600 node --disable-warning=ExperimentalWarning --test --test-concurrency=4 "$@" > "$OUT" 2>&1
CODE=$?
echo "cikis=$CODE"
grep -E "^# (tests|pass|fail|cancelled|skipped)" "$OUT"
grep -E "^not ok|^    not ok|^        not ok" "$OUT" | head -30
exit 0
