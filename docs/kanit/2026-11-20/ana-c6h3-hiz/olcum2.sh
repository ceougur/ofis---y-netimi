#!/bin/bash
H=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-c6h3h
echo "başta yük $(cat /proc/loadavg)" > $H/olcum2.out
flock -x -w 600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock -c "for k in eski yeni eski yeni; do bash $H/betik/hiz.sh kilitsiz \$k 5 > $H/tekrar-kilitsiz-\$k-\$(date -u +%H%M%S).log 2>&1; echo \"\$k bitti \$(date -u +%H:%M:%S) yük \$(cat /proc/loadavg)\"; done" >> $H/olcum2.out 2>&1
echo "çıkış $?" >> $H/olcum2.out
