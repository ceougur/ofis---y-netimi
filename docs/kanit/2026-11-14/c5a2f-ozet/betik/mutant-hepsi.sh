#!/bin/bash
# Tur 2f mutantları: iki koşu (Europe/Istanbul, UTC), her biri bütün mutantlar + mutasyonsuz taban; yük kilidi paylaşımlı, beklemesiz.
unset GIT_DIR GIT_WORK_TREE
M=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/mutant.py
echo "başta $(date -u +%H:%M:%S) yük $(cat /proc/loadavg)"
timeout -k 5 7000 flock -s -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock bash -c "python3 -I $M Europe/Istanbul kosu1 && python3 -I $M UTC kosu2"
echo "çıkış $? sonda $(date -u +%H:%M:%S) yük $(cat /proc/loadavg)"
