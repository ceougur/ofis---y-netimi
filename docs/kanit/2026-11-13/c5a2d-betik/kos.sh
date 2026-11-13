#!/bin/bash
# kos.sh <ad> <test dosyaları...> — KOS_DIR (varsayılan: mutant kopyam) içinde testleri koşar; yük kilidi paylaşımlı (-n: doluysa hemen döner), süre sınırlı.
# Eski sürüm etiketi isteyen testler için depo erişimi (git archive kopyasında .git yok).
Q=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2d-q
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
ad=$1; shift
cd "${KOS_DIR:-$Q/mut}" || exit 1
T0=$(date +%s)
flock -s -n $L timeout -k 5 "${KOS_SURE:-2400}" env GIT_DIR="${KOS_GIT:-/home/user/ofis---y-netimi/.git}" TZ="${TZ:-Europe/Istanbul}" HUKUK_LICENSE_URL=http://127.0.0.1:9 node --disable-warning=ExperimentalWarning --test --test-concurrency="${KOS_PAR:-3}" "$@" > "$Q/kos-$ad.out" 2>&1
rc=$?
echo "$ad rc=$rc sure=$(( $(date +%s)-T0 ))s yuk=$(cut -d' ' -f1 /proc/loadavg) $(grep -E '^# (tests|pass|fail|cancelled|skipped|todo)' "$Q/kos-$ad.out" | tr '\n' ' ')"
grep -E "^not ok|^    not ok|^  not ok" "$Q/kos-$ad.out" | head -8
