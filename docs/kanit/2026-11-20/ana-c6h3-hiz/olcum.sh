#!/bin/bash
H=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-c6h3h
L=$(cut -d' ' -f1 /proc/loadavg); echo "başta yük $(cat /proc/loadavg)" > $H/olcum.out
flock -x -w 600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock -c "bash $H/betik/hiz-hepsi.sh" >> $H/olcum.out 2>&1
echo "çıkış $? · sonda yük $(cat /proc/loadavg)" >> $H/olcum.out
