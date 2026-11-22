#!/bin/bash
# Cari kâhini bakımı 26 — yalnız öz test (kos.sh temel'in ilk adımı; ilk koşu ana oturumun özel ölçüm kilidi 1 saati aşınca flock -w 3600 ile düştü). Kullanım: oz.sh <utc|ist>
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-aba92b2d7bf349903
case "$1" in utc) export TZ=UTC ;; ist) export TZ=Europe/Istanbul ;; *) echo "kullanım: $0 utc|ist"; exit 2 ;; esac
export KANIT_DIR=$S/kc26-aba/kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
mkdir -p "$KANIT_DIR" || exit 1
cd "$W" || exit 1
echo "commit $(git rev-parse HEAD) · TZ=$TZ · $(date -u +%FT%TZ) · yük $(cat /proc/loadavg)"
flock -s -w 3600 $S/olcum.lock timeout -k 5 2400 node tools/kanit.mjs kos "kahin-cari26-oz-$1" -- python3 -I -B test/bagimsiz/cari/oz-test.py; echo "== oz: çıkış $?"
echo "bitti $(date -u +%FT%TZ)"
